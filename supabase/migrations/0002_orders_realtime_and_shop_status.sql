-- Issue #7: live orders for the admin portal + shop open/closed switch.
-- Safe to run on the live project: the shop defaults to OPEN, so ordering is not interrupted.

------------------------------------------------------------------ shop_settings (single row)
create table public.shop_settings (
  id         boolean primary key default true check (id),   -- check (id) + pk = at most one row
  is_open    boolean not null default true,
  note       text,
  updated_at timestamptz not null default now()
);
insert into public.shop_settings default values;

alter table public.shop_settings enable row level security;
create policy "shop: public read"  on public.shop_settings for select using (true);
create policy "shop: admin update" on public.shop_settings for update using (public.is_admin()) with check (public.is_admin());
-- No insert/delete policies: the single row is managed here only.

------------------------------------------------------------------ realtime
alter publication supabase_realtime add table public.shop_settings;
alter publication supabase_realtime add table public.orders;  -- RLS still applies: only the owner/admin receives other people's orders

------------------------------------------------------------------ place_order: refuse while the shop is closed
-- Same function as 0001 plus the shop-closed check (create or replace keeps the existing grants).
create or replace function public.place_order(p_items jsonb, p_address text, p_use_bogo boolean)
returns table (order_id bigint, customer_name text, customer_phone text, subtotal int, discount int, total int, lines jsonb)
language plpgsql security definer set search_path = public as $$
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
  if length(trim(coalesce(p_address, ''))) < 5 then raise exception 'address required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'cart is empty'; end if;

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
  where i.qty > 0 and i.variant in ('reg','cheese') and m.in_stock
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

  insert into public.orders (user_id, customer_name, customer_phone, address, subtotal, discount, total, bogo_applied)
  values (v_uid, v_profile.name, v_profile.phone, trim(p_address), v_subtotal, v_discount, v_subtotal - v_discount, p_use_bogo)
  returning id into v_order_id;

  insert into public.order_items (order_id, menu_item_id, name, variant, unit_price, qty)
  select v_order_id, menu_item_id, name, variant, unit_price, qty from _lines;

  if p_use_bogo then
    insert into public.bogo_redemptions (phone, user_id, order_id) values (v_profile.phone, v_uid, v_order_id);
  end if;

  select jsonb_agg(jsonb_build_object('name', l.name, 'unit_price', l.unit_price, 'qty', l.qty)) into v_lines from _lines l;

  return query select v_order_id, v_profile.name, v_profile.phone, v_subtotal, v_discount, v_subtotal - v_discount, v_lines;
end $$;
