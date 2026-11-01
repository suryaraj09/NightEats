-- Issue #25: admin-managed coupons replace the hard-coded BOGO1ST.
--
-- Deploy note: the old place_order(jsonb, text, boolean) and bogo_available() are kept as thin wrappers so the
-- currently deployed frontend keeps working while the new one rolls out. A later migration can drop them.
-- Behaviour change: orders the owner cancels no longer count against a coupon's limits (BOGO1ST used to be burned).

------------------------------------------------------------------ coupons (rules)
create table public.coupons (
  id          bigint generated always as identity primary key,
  code        text not null unique check (code ~ '^[A-Z0-9_-]{3,20}$'),
  description text not null default '' check (char_length(description) <= 200),
  type        text not null check (type in ('percent','flat','buy_x_get_y','free_item','bundle')),

  -- type parameters
  percent_off  int check (percent_off between 1 and 100),
  max_discount int check (max_discount >= 0),                     -- optional rupee cap for percent coupons
  flat_off     int check (flat_off > 0),
  buy_qty      int check (buy_qty >= 1),
  free_qty     int check (free_qty >= 1),
  free_item_id bigint references public.menu_items(id) on delete set null,   -- the freebie (regular variant)
  bundle_qty   int check (bundle_qty >= 2),
  bundle_price int check (bundle_price >= 0),

  -- which items count
  applies_to text not null default 'cart' check (applies_to in ('cart','category','items')),
  category   text check (category in ('Burger','Sandwich','Tikka Pav','Fries')),
  item_ids   bigint[] not null default '{}',

  -- rules
  min_qty            int not null default 0 check (min_qty >= 0),            -- eligible units
  min_order_value    int not null default 0 check (min_order_value >= 0),    -- whole-cart subtotal, rupees
  max_total_uses     int check (max_total_uses > 0),
  max_uses_per_user  int check (max_uses_per_user > 0),
  max_uses_per_phone int check (max_uses_per_phone > 0),
  first_order_only   boolean not null default false,
  starts_at          timestamptz,
  ends_at            timestamptz,
  days_of_week       int[] check (days_of_week <@ array[0,1,2,3,4,5,6]),    -- 0 = Sunday, Asia/Kolkata; null/empty = every day
  start_time         time,                                                    -- Asia/Kolkata; may wrap past midnight
  end_time           time,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),

  constraint coupons_type_params check (
    (type = 'percent'     and percent_off is not null) or
    (type = 'flat'        and flat_off is not null) or
    (type = 'buy_x_get_y' and buy_qty is not null and free_qty is not null) or
    (type = 'free_item') or                    -- free_item_id becomes null if the menu item is deleted; checked when applied
    (type = 'bundle'      and bundle_qty is not null and bundle_price is not null)
  ),
  constraint coupons_scope check (
    (applies_to = 'cart') or
    (applies_to = 'category' and category is not null) or
    (applies_to = 'items' and cardinality(item_ids) > 0)
  ),
  constraint coupons_time_window check (
    (start_time is null and end_time is null) or (start_time is not null and end_time is not null and start_time <> end_time)
  ),
  constraint coupons_dates check (starts_at is null or ends_at is null or starts_at < ends_at)
);

------------------------------------------------------------------ coupon_redemptions (usage)
create table public.coupon_redemptions (
  id          bigint generated always as identity primary key,
  coupon_id   bigint not null references public.coupons(id) on delete cascade,
  user_id     uuid   not null references auth.users(id) on delete cascade,
  phone       text   not null,
  order_id    bigint references public.orders(id) on delete set null,
  redeemed_at timestamptz not null default now()
);
create index coupon_redemptions_coupon_idx on public.coupon_redemptions (coupon_id);
create index coupon_redemptions_user_idx   on public.coupon_redemptions (user_id);
create index coupon_redemptions_phone_idx  on public.coupon_redemptions (phone);

-- Orders remember the code and the money, so editing or deleting a coupon never changes past orders.
alter table public.orders add column coupon_code text;

------------------------------------------------------------------ RLS
alter table public.coupons            enable row level security;
alter table public.coupon_redemptions enable row level security;
revoke all on public.coupons            from anon;
revoke all on public.coupon_redemptions from anon, authenticated;

create policy "coupons: admin select" on public.coupons for select using (public.is_admin());
create policy "coupons: admin insert" on public.coupons for insert with check (public.is_admin());
create policy "coupons: admin update" on public.coupons for update using (public.is_admin()) with check (public.is_admin());
create policy "coupons: admin delete" on public.coupons for delete using (public.is_admin());
-- Redemptions are written only by place_order(); the admin may read them, nobody else.
grant select on public.coupon_redemptions to authenticated;
create policy "redemptions: admin select" on public.coupon_redemptions for select using (public.is_admin());

-- Uses per coupon for the admin Coupons tab (cancelled orders do not count, same as the enforcement).
create view public.coupon_usage with (security_invoker = true) as
  select r.coupon_id, count(*)::int as uses
  from public.coupon_redemptions r
  left join public.orders o on o.id = r.order_id
  where o.status is distinct from 'cancelled'
  group by r.coupon_id;
revoke all on public.coupon_usage from anon;
grant select on public.coupon_usage to authenticated;

------------------------------------------------------------------ BOGO1ST becomes a normal coupon
insert into public.coupons (code, description, type, buy_qty, free_qty, max_uses_per_user, max_uses_per_phone)
values ('BOGO1ST', '૧ મોબાઈલ નંબર પર ૧ વાર સૌથી સસ્તી આઇટમ ફ્રી!', 'buy_x_get_y', 1, 1, 1, 1);

insert into public.coupon_redemptions (coupon_id, user_id, phone, order_id, redeemed_at)
select (select id from public.coupons where code = 'BOGO1ST'), b.user_id, b.phone, b.order_id, b.redeemed_at
from public.bogo_redemptions b;

update public.orders set coupon_code = 'BOGO1ST' where bogo_applied;
alter table public.orders drop column bogo_applied;
drop table public.bogo_redemptions;

------------------------------------------------------------------ helper: price a cart from the database
-- Never trusts the client: prices, names and stock come from menu_items. Rows that fail any check are dropped,
-- so callers compare the row count with the length of p_items to detect unavailable lines.
create function public._cart_lines(p_items jsonb)
returns table (menu_item_id bigint, category text, name text, variant text, unit_price int, qty int)
language sql stable set search_path = public, pg_temp as $$
  select m.id,
         m.category,
         case when i.variant = 'cheese' then m.name || ' (Double Cheese)'
              when m.cheese_price is not null then m.name || ' (Regular)'
              else m.name end,
         i.variant,
         case when i.variant = 'cheese' then m.cheese_price else m.price end,
         i.qty
  from jsonb_to_recordset(p_items) as i(menu_item_id bigint, variant text, qty int)
  join public.menu_items m on m.id = i.menu_item_id
  where i.qty between 1 and 20 and i.variant in ('reg','cheese') and m.in_stock
    and (i.variant = 'reg' or m.cheese_price is not null);
$$;
revoke all on function public._cart_lines(jsonb) from public, anon, authenticated;

------------------------------------------------------------------ helper: evaluate one coupon against a cart
-- Always returns exactly one row. ok = false carries a Gujarati reason for the customer.
-- p_lock = true takes a row lock on the coupon so concurrent redemptions cannot exceed its limits.
create function public._apply_coupon(p_code text, p_uid uuid, p_items jsonb, p_lock boolean default false)
returns table (coupon_id bigint, ok boolean, reason text, discount int, free_item_id bigint, free_item_name text)
language plpgsql security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare
  c         public.coupons%rowtype;
  v_code    text := upper(trim(coalesce(p_code, '')));
  v_phone   text;
  v_reason  text;
  v_local   timestamp := now() at time zone 'Asia/Kolkata';
  v_time    time := (now() at time zone 'Asia/Kolkata')::time;
  v_wrap    boolean;
  v_day     int;
  v_count   int;
  v_elig    jsonb;
  v_cart_sub int;
  v_elig_qty int;
  v_elig_sub int;
  v_need    int;
  v_disc    int := 0;
  v_groups  int;
  v_free    public.menu_items%rowtype;
begin
  <<chk>>
  begin
    if p_lock then
      select * into c from public.coupons where code = v_code for update;
    else
      select * into c from public.coupons where code = v_code;
    end if;
    if not found or not c.is_active then v_reason := 'આ કોડ માન્ય નથી.'; exit chk; end if;

    if c.starts_at is not null and now() < c.starts_at then v_reason := 'આ કોડ હજી શરૂ થયો નથી.'; exit chk; end if;
    if c.ends_at   is not null and now() >= c.ends_at   then v_reason := 'આ કોડની મુદત પૂરી થઈ ગઈ છે.'; exit chk; end if;

    -- time-of-day window and weekday (IST). A window like 22:00-02:00 belongs to the day it started on.
    v_day := extract(dow from v_local)::int;
    if c.start_time is not null then
      v_wrap := c.start_time > c.end_time;
      if v_wrap then
        if not (v_time >= c.start_time or v_time < c.end_time) then v_reason := 'આ કોડ હમણાં માન્ય નથી.'; exit chk; end if;
        if v_time < c.end_time then v_day := (v_day + 6) % 7; end if;
      elsif not (v_time >= c.start_time and v_time < c.end_time) then
        v_reason := 'આ કોડ હમણાં માન્ય નથી.'; exit chk;
      end if;
    end if;
    if coalesce(cardinality(c.days_of_week), 0) > 0 and not (v_day = any (c.days_of_week)) then
      v_reason := 'આ કોડ આજના દિવસે માન્ય નથી.'; exit chk;
    end if;

    if p_uid is null then v_reason := 'કોડ વાપરવા માટે લૉગિન કરો.'; exit chk; end if;
    select p.phone into v_phone from public.profiles p where p.id = p_uid;
    if v_phone is null then v_reason := 'પહેલા તમારી પ્રોફાઇલ પૂરી કરો.'; exit chk; end if;

    -- usage limits (orders the owner cancelled do not count)
    if c.first_order_only and exists (select 1 from public.orders o where o.user_id = p_uid and o.status <> 'cancelled') then
      v_reason := 'આ કોડ ફક્ત પહેલા ઓર્ડર માટે છે.'; exit chk;
    end if;
    if c.max_total_uses is not null then
      select count(*) into v_count from public.coupon_redemptions r left join public.orders o on o.id = r.order_id
      where r.coupon_id = c.id and o.status is distinct from 'cancelled';
      if v_count >= c.max_total_uses then v_reason := 'આ કોડની મર્યાદા પૂરી થઈ ગઈ છે.'; exit chk; end if;
    end if;
    if c.max_uses_per_user is not null then
      select count(*) into v_count from public.coupon_redemptions r left join public.orders o on o.id = r.order_id
      where r.coupon_id = c.id and r.user_id = p_uid and o.status is distinct from 'cancelled';
      if v_count >= c.max_uses_per_user then v_reason := 'તમે આ કોડ અગાઉ વાપરી ચૂક્યા છો.'; exit chk; end if;
    end if;
    if c.max_uses_per_phone is not null then
      select count(*) into v_count from public.coupon_redemptions r left join public.orders o on o.id = r.order_id
      where r.coupon_id = c.id and r.phone = v_phone and o.status is distinct from 'cancelled';
      if v_count >= c.max_uses_per_phone then v_reason := 'આ મોબાઈલ નંબર પર આ કોડ અગાઉ વપરાઈ ચૂક્યો છે.'; exit chk; end if;
    end if;

    -- cart rules
    select coalesce(sum(l.unit_price * l.qty), 0) into v_cart_sub from public._cart_lines(p_items) l;
    select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb) into v_elig
    from public._cart_lines(p_items) l
    where c.applies_to = 'cart'
       or (c.applies_to = 'category' and l.category = c.category)
       or (c.applies_to = 'items' and l.menu_item_id = any (c.item_ids));
    select coalesce(sum(e.unit_price * e.qty), 0), coalesce(sum(e.qty), 0) into v_elig_sub, v_elig_qty
    from jsonb_to_recordset(v_elig) as e(menu_item_id bigint, category text, name text, variant text, unit_price int, qty int);

    if v_elig_qty = 0 then v_reason := 'આ કોડ તમારા કાર્ટની આઇટમ્સ પર લાગુ પડતો નથી.'; exit chk; end if;

    v_need := greatest(c.min_qty, case c.type
                                    when 'buy_x_get_y' then c.buy_qty + c.free_qty
                                    when 'bundle' then c.bundle_qty
                                    else 1 end);
    if v_elig_qty < v_need then v_reason := 'આ કોડ માટે ઓછામાં ઓછી ' || v_need || ' આઇટમ્સ જોઈએ.'; exit chk; end if;
    if v_cart_sub < c.min_order_value then v_reason := 'આ કોડ માટે ઓછામાં ઓછા ₹' || c.min_order_value || 'નો ઓર્ડર જોઈએ.'; exit chk; end if;

    -- discount by type
    if c.type = 'percent' then
      v_disc := (v_elig_sub * c.percent_off) / 100;                      -- integer division rounds down
      if c.max_discount is not null then v_disc := least(v_disc, c.max_discount); end if;
    elsif c.type = 'flat' then
      v_disc := least(c.flat_off, v_elig_sub);
    elsif c.type = 'buy_x_get_y' then                                    -- cheapest free_qty eligible units are free
      select coalesce(sum(s.p), 0) into v_disc from (
        select e.unit_price as p
        from jsonb_to_recordset(v_elig) as e(menu_item_id bigint, category text, name text, variant text, unit_price int, qty int),
             generate_series(1, e.qty)
        order by e.unit_price limit c.free_qty) s;
    elsif c.type = 'bundle' then                                         -- every bundle_qty units cost bundle_price (cheapest units first)
      v_groups := v_elig_qty / c.bundle_qty;
      select coalesce(sum(s.p), 0) - v_groups * c.bundle_price into v_disc from (
        select e.unit_price as p
        from jsonb_to_recordset(v_elig) as e(menu_item_id bigint, category text, name text, variant text, unit_price int, qty int),
             generate_series(1, e.qty)
        order by e.unit_price limit v_groups * c.bundle_qty) s;
      v_disc := greatest(v_disc, 0);
    elsif c.type = 'free_item' then
      select * into v_free from public.menu_items m where m.id = c.free_item_id;
      if not found or not v_free.in_stock then v_reason := 'ફ્રી આઇટમ હમણાં ઉપલબ્ધ નથી.'; exit chk; end if;
    end if;

    if c.type <> 'free_item' and v_disc <= 0 then v_reason := 'આ કોડથી તમારા કાર્ટમાં કોઈ બચત થતી નથી.'; exit chk; end if;
  end;

  if v_reason is not null then
    return query select c.id, false, v_reason, 0, null::bigint, null::text;
  else
    return query select c.id, true, null::text, least(v_disc, v_cart_sub), v_free.id, v_free.name;
  end if;
end $$;
revoke all on function public._apply_coupon(text, uuid, jsonb, boolean) from public, anon, authenticated;

------------------------------------------------------------------ validate_coupon: live preview for the cart
create function public.validate_coupon(p_code text, p_items jsonb)
returns table (valid boolean, reason text, discount int, free_item_name text, coupon_code text, coupon_desc text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
begin
  if auth.uid() is null then
    return query select false, 'કોડ વાપરવા માટે લૉગિન કરો.', 0, null::text, null::text, null::text; return;
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    return query select false, 'કાર્ટ ખાલી છે.', 0, null::text, null::text, null::text; return;
  end if;
  if (select count(*) from public._cart_lines(p_items)) <> jsonb_array_length(p_items) then
    return query select false, 'કાર્ટની કેટલીક આઇટમ્સ હમણાં ઉપલબ્ધ નથી.', 0, null::text, null::text, null::text; return;
  end if;
  return query
    select a.ok, a.reason, a.discount, a.free_item_name, c.code, c.description
    from public._apply_coupon(p_code, auth.uid(), p_items, false) a
    left join public.coupons c on c.id = a.coupon_id;
end $$;
revoke all on function public.validate_coupon(text, jsonb) from public, anon;
grant execute on function public.validate_coupon(text, jsonb) to authenticated;

------------------------------------------------------------------ place_order(items, address, coupon_code)
-- Same guards as 0003 (shop open, profile, limits, caps) plus server-side coupon pricing. The client never sends a
-- discount amount. A free_item coupon adds the freebie as a Rs 0 order line.
create function public.place_order(p_items jsonb, p_address text, p_coupon_code text default null)
returns table (order_id bigint, customer_name text, customer_phone text, subtotal int, discount int, total int, coupon_code text, lines jsonb)
language plpgsql security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_subtotal int;
  v_discount int := 0;
  v_code text := nullif(upper(trim(coalesce(p_coupon_code, ''))), '');
  v_coupon record;
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

  if (select count(*) from public._cart_lines(p_items)) <> jsonb_array_length(p_items) then
    raise exception 'some items are unavailable';
  end if;
  select sum(l.unit_price * l.qty) into v_subtotal from public._cart_lines(p_items) l;

  if v_code is not null then
    select * into v_coupon from public._apply_coupon(v_code, v_uid, p_items, true);
    if not v_coupon.ok then raise exception 'COUPON: %', v_coupon.reason; end if;
    v_discount := v_coupon.discount;
  end if;

  insert into public.orders (user_id, customer_name, customer_phone, address, pincode, subtotal, discount, total, coupon_code)
  values (v_uid, v_profile.name, v_profile.phone, trim(p_address), '380007', v_subtotal, v_discount, v_subtotal - v_discount, v_code)
  returning id into v_order_id;

  insert into public.order_items (order_id, menu_item_id, name, variant, unit_price, qty)
  select v_order_id, l.menu_item_id, l.name, l.variant, l.unit_price, l.qty from public._cart_lines(p_items) l;

  if v_code is not null then
    if v_coupon.free_item_id is not null then
      insert into public.order_items (order_id, menu_item_id, name, variant, unit_price, qty)
      values (v_order_id, v_coupon.free_item_id, v_coupon.free_item_name || ' (FREE)', 'reg', 0, 1);
    end if;
    insert into public.coupon_redemptions (coupon_id, user_id, phone, order_id)
    values (v_coupon.coupon_id, v_uid, v_profile.phone, v_order_id);
  end if;

  select jsonb_agg(jsonb_build_object('name', oi.name, 'unit_price', oi.unit_price, 'qty', oi.qty) order by oi.id)
  into v_lines from public.order_items oi where oi.order_id = v_order_id;

  return query select v_order_id, v_profile.name, v_profile.phone, v_subtotal, v_discount, v_subtotal - v_discount, v_code, v_lines;
end $$;
revoke all on function public.place_order(jsonb, text, text) from public, anon;
grant execute on function public.place_order(jsonb, text, text) to authenticated;

------------------------------------------------------------------ compatibility wrappers (drop in a later migration)
create or replace function public.place_order(p_items jsonb, p_address text, p_use_bogo boolean)
returns table (order_id bigint, customer_name text, customer_phone text, subtotal int, discount int, total int, lines jsonb)
language sql security definer set search_path = public, pg_temp as $$
  select p.order_id, p.customer_name, p.customer_phone, p.subtotal, p.discount, p.total, p.lines
  from public.place_order(p_items, p_address, case when p_use_bogo then 'BOGO1ST' else null end) p;
$$;

create or replace function public.bogo_available() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.phone is not null)
     and not exists (
       select 1
       from public.coupon_redemptions r
       join public.coupons c on c.id = r.coupon_id and c.code = 'BOGO1ST'
       where r.user_id = auth.uid()
          or r.phone = (select p.phone from public.profiles p where p.id = auth.uid())
     );
$$;
