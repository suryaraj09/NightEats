-- Night Eats schema. Run once in Supabase → SQL Editor (or `supabase db push`).

------------------------------------------------------------------ profiles
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  name       text,
  phone      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_phone_format check (phone is null or phone ~ '^[0-9]{10}$')
);

-- Create an (incomplete) profile whenever someone signs up. Google gives us a name; phone comes later.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

------------------------------------------------------------------ admin binding
-- Only the Google/email accounts listed here are admins. NO PIN.
create table public.admin_emails (email text primary key);
alter table public.admin_emails enable row level security;  -- no policies = invisible to clients

-- Owner/admin Gmail
insert into public.admin_emails (email) values (lower('parikhdhairy13@gmail.com'));

-- True only if the signed-in user's email is listed AND has been verified
-- (so nobody can sign up with the owner's address by password and gain admin).
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1
    from auth.users u
    join public.admin_emails a on lower(a.email) = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;

alter table public.profiles enable row level security;
create policy "profiles: read own"   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles: update own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

------------------------------------------------------------------ menu
create table public.menu_items (
  id           bigint generated always as identity primary key,
  sort_order   int  not null default 0,
  name         text not null,
  category     text not null check (category in ('Burger','Sandwich','Tikka Pav','Fries')),
  price        int  not null check (price >= 0),
  cheese_price int  check (cheese_price is null or cheese_price >= 0),
  description  text not null default '',
  in_stock     boolean not null default true
);

alter table public.menu_items enable row level security;
create policy "menu: public read"  on public.menu_items for select using (true);
create policy "menu: admin insert" on public.menu_items for insert with check (public.is_admin());
create policy "menu: admin update" on public.menu_items for update using (public.is_admin()) with check (public.is_admin());
create policy "menu: admin delete" on public.menu_items for delete using (public.is_admin());

alter publication supabase_realtime add table public.menu_items;

create function public._seed_menu() returns void language sql as $$
  insert into public.menu_items (sort_order, name, category, price, cheese_price, description) values
    (1,  'Island Delight',                'Burger',    80, 100, 'Fresh crispy patty with Island special dressings'),
    (2,  'Tandoori Blast',                'Burger',    80, 100, 'Spiced paneer/veg patty with smoky tandoori sauce'),
    (3,  'Butter Makhani',                'Burger',    80, 100, 'Rich royal buttery makhani fusion burger'),
    (4,  'Mexican Masti',                 'Burger',    80, 100, 'Tangy Mexican salsa & creamy herbs filling'),
    (5,  'Mexican Cheese (3 Layer)',      'Sandwich', 160, null, 'Triple layer loaded cheese with Mexican herbs'),
    (6,  'Tandoori Cheese (3 Layer)',     'Sandwich', 150, null, 'Triple layer grilled sandwich with smoky cheese'),
    (7,  'Cheese Grilled (3 Layer)',      'Sandwich', 140, null, 'Crispy grilled bread packed with melted cheese'),
    (8,  'Classic Tandoori Twist',        'Tikka Pav',100, null, 'Tandoori glazed spicy tikka filled in soft pav'),
    (9,  'Royal Makhani Pav',             'Tikka Pav',100, null, 'Creamy butter makhani stuffed pav delight'),
    (10, 'Spicy Mexican Tikka',           'Tikka Pav',100, null, 'Fiery Mexican marinated stuffing in butter toasted pav'),
    (11, 'Paneer Mayo Blast',             'Tikka Pav',140, null, 'Rich paneer chunks with overloaded premium mayonnaise'),
    (12, 'Paneer Mexican',                'Tikka Pav',140, null, 'Juicy paneer chunks with authentic Mexican seasoning'),
    (13, 'Tandoori Tikki',                'Tikka Pav',120, null, 'Crunchy spicy patty nestled with smoky tandoori dressing'),
    (14, 'Salted French Fries (100g)',    'Fries',     70, null, 'Golden classic crispy salted potato fries'),
    (15, 'Peri Peri French Fries (100g)', 'Fries',     90, null, 'Tossed in fiery hot peri-peri spice dust'),
    (16, 'Cheese Burst French Fries (130g)','Fries',  120, null, 'Crispy fries smothered in delicious liquid cheese');
$$;
revoke all on function public._seed_menu() from public, anon, authenticated;

select public._seed_menu();

-- "મૂળ મેનૂ રીસ્ટોર" button
create function public.reset_menu() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  delete from public.menu_items where true;
  perform public._seed_menu();
end $$;

------------------------------------------------------------------ orders
create table public.orders (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references auth.users(id),
  customer_name  text not null,
  customer_phone text not null,
  address        text not null,
  pincode        text not null default '380007',
  subtotal       int  not null,
  discount       int  not null default 0,
  total          int  not null,
  bogo_applied   boolean not null default false,
  status         text not null default 'new' check (status in ('new','confirmed','delivered','cancelled')),
  created_at     timestamptz not null default now()
);

create table public.order_items (
  id           bigint generated always as identity primary key,
  order_id     bigint not null references public.orders(id) on delete cascade,
  menu_item_id bigint references public.menu_items(id) on delete set null,
  name         text not null,
  variant      text not null check (variant in ('reg','cheese')),
  unit_price   int  not null,
  qty          int  not null check (qty > 0)
);

alter table public.orders      enable row level security;
alter table public.order_items enable row level security;
-- No INSERT policies: clients can only create orders through place_order() below.
create policy "orders: read own or admin" on public.orders for select using (user_id = auth.uid() or public.is_admin());
create policy "orders: admin update"      on public.orders for update using (public.is_admin()) with check (public.is_admin());
create policy "order_items: read via order" on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
);

------------------------------------------------------------------ BOGO1ST (one use per phone number AND per account)
create table public.bogo_redemptions (
  phone       text primary key,
  user_id     uuid not null unique references auth.users(id),
  order_id    bigint references public.orders(id) on delete set null,
  redeemed_at timestamptz not null default now()
);
alter table public.bogo_redemptions enable row level security;  -- server-side only

create function public.bogo_available() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.phone is not null)
     and not exists (
       select 1 from public.bogo_redemptions r
       where r.user_id = auth.uid()
          or r.phone = (select phone from public.profiles where id = auth.uid())
     );
$$;

------------------------------------------------------------------ place_order
-- p_items: [{"menu_item_id": 1, "variant": "reg"|"cheese", "qty": 2}, ...]
-- Prices come from menu_items, never from the client. BOGO = cheapest single unit free, needs >= 2 units.
create function public.place_order(p_items jsonb, p_address text, p_use_bogo boolean)
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

revoke all on function public.place_order(jsonb, text, boolean) from public, anon;
grant execute on function public.place_order(jsonb, text, boolean) to authenticated;
revoke all on function public.reset_menu() from public, anon;
grant execute on function public.reset_menu() to authenticated;
revoke all on function public.bogo_available() from public, anon;
grant execute on function public.bogo_available() to authenticated;
