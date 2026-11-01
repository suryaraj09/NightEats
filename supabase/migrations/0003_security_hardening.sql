-- Issue #11: security hardening from the RLS / place_order review.
-- Safe to run on the live project (idempotent where it matters, constraints are NOT VALID so old rows can't block it).
-- NOTE: written without a local Postgres to test against; run it on a Supabase branch/staging project first.

------------------------------------------------------------------ profiles: only name + phone are client-editable
-- The old "update own" policy allowed changing ANY column of your own row (email, created_at, ...).
-- Column-level grants limit the client to the two fields the app actually edits.
revoke update on public.profiles from anon, authenticated;
grant  update (name, phone, updated_at) on public.profiles to authenticated;

alter table public.profiles
  add constraint profiles_name_length check (name is null or char_length(name) <= 100) not valid;

------------------------------------------------------------------ admin check: require a real Google identity
-- Before: a confirmed email matching admin_emails. Now also requires a linked Google identity, so the admin
-- cannot be impersonated through any other (e.g. email/password) provider that is accidentally enabled.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, auth, pg_temp as $$
  select exists (
    select 1
    from auth.users u
    join public.admin_emails a on lower(a.email) = lower(u.email)
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google')
  );
$$;

------------------------------------------------------------------ function hygiene: search_path + grants
alter function public._seed_menu()      set search_path = public, pg_temp;
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.reset_menu()      set search_path = public, pg_temp;
alter function public.bogo_available()  set search_path = public, pg_temp;

-- Trigger function: nothing should ever call it directly.
revoke all on function public.handle_new_user() from public, anon, authenticated;
-- is_admin() stays executable by anon/authenticated: RLS policies call it as the requesting role (it just returns false).

------------------------------------------------------------------ orders: server-side pincode + sanity limits
-- The delivery area is fixed. The app never sends a pincode (place_order has no such parameter, and there is no
-- INSERT policy), so this constraint makes the rule explicit at the database level too.
alter table public.orders
  add constraint orders_pincode_served check (pincode = '380007') not valid,
  add constraint orders_address_length check (char_length(address) between 5 and 300) not valid;

------------------------------------------------------------------ place_order: rate limits + input caps
-- Same as 0002 plus: search_path pinned (pg_temp last so temp tables can't shadow real ones), a cap on cart size,
-- address length, at most 3 un-actioned ('new') orders per account, and at most 10 orders per account per hour.
create or replace function public.place_order(p_items jsonb, p_address text, p_use_bogo boolean)
returns table (order_id bigint, customer_name text, customer_phone text, subtotal int, discount int, total int, lines jsonb)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_subtotal int := 0;
  v_units int := 0;
  v_min_price int;
  v_discount int := 0;
  v_order_id bigint;
  v_lines jsonb;
begin
  if v_uid is null then raise exception 'login required'; end if;
  if not coalesce((select s.is_open from public.shop_settings s), true) then raise exception 'shop closed'; end if;

  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.name is null or v_profile.phone is null then raise exception 'complete your profile first'; end if;
  if char_length(trim(coalesce(p_address, ''))) not between 5 and 300 then raise exception 'address required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'cart is empty'; end if;
  if jsonb_array_length(p_items) > 30 then raise exception 'cart too large'; end if;

  -- Serialise this user's orders so two parallel calls can't both slip under the limits below.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  if (select count(*) from public.orders o where o.user_id = v_uid and o.status = 'new') >= 3 then
    raise exception 'too many pending orders, please wait for the shop to confirm';
  end if;
  if (select count(*) from public.orders o where o.user_id = v_uid and o.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'too many orders, please try again later';
  end if;

  create temp table _lines on commit drop as
  select m.id as menu_item_id,
         case when i.variant = 'cheese' then m.name || ' (Double Cheese)'
              when m.cheese_price is not null then m.name || ' (Regular)'
              else m.name end as name,
         i.variant,
         case when i.variant = 'cheese' then m.cheese_price else m.price end as unit_price,
         i.qty
  from jsonb_to_recordset(p_items) as i(menu_item_id bigint, variant text, qty int)
  join public.menu_items m on m.id = i.menu_item_id
  where i.qty between 1 and 20 and i.variant in ('reg','cheese') and m.in_stock
    and (i.variant = 'reg' or m.cheese_price is not null);

  if (select count(*) from _lines) <> jsonb_array_length(p_items) then
    raise exception 'some items are unavailable';
  end if;

  select sum(unit_price * qty), sum(qty), min(unit_price) into v_subtotal, v_units, v_min_price from _lines;

  if p_use_bogo then
    if v_units < 2 then raise exception 'BOGO needs at least 2 items'; end if;
    if not public.bogo_available() then raise exception 'BOGO1ST already used'; end if;
    v_discount := v_min_price;
  end if;

  insert into public.orders (user_id, customer_name, customer_phone, address, pincode, subtotal, discount, total, bogo_applied)
  values (v_uid, v_profile.name, v_profile.phone, trim(p_address), '380007', v_subtotal, v_discount, v_subtotal - v_discount, p_use_bogo)
  returning id into v_order_id;

  insert into public.order_items (order_id, menu_item_id, name, variant, unit_price, qty)
  select v_order_id, menu_item_id, name, variant, unit_price, qty from _lines;

  if p_use_bogo then
    insert into public.bogo_redemptions (phone, user_id, order_id) values (v_profile.phone, v_uid, v_order_id);
  end if;

  select jsonb_agg(jsonb_build_object('name', l.name, 'unit_price', l.unit_price, 'qty', l.qty)) into v_lines from _lines l;

  return query select v_order_id, v_profile.name, v_profile.phone, v_subtotal, v_discount, v_subtotal - v_discount, v_lines;
end $$;
-- create or replace keeps the grants from 0001 (authenticated only).
