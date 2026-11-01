-- pgTAP tests for place_order, RLS and the security hardening (#15, #11). Run with: npm run test:db
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

------------------------------------------------------------------ helpers (all die with the transaction)
create function pg_temp.as_postgres() returns void language sql as $$
  select set_config('request.jwt.claims', '', true), set_config('role', 'postgres', true);
$$;
create function pg_temp.as_anon() returns void language sql as $$
  select set_config('request.jwt.claims', '{"role":"anon"}', true), set_config('role', 'anon', true);
$$;
create function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true),
         set_config('role', 'authenticated', true);
$$;
-- email_confirmed => confirmed address; google => has a linked Google identity
create function pg_temp.new_user(p_email text, p_name text, p_phone text, p_confirmed boolean default true, p_google boolean default true)
returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  perform pg_temp.as_postgres();
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role)
  values (v, p_email, case when p_confirmed then now() end, jsonb_build_object('full_name', p_name), 'authenticated', 'authenticated');
  if p_google then
    insert into auth.identities (provider_id, user_id, identity_data, provider)
    values (v::text, v, jsonb_build_object('sub', v::text, 'email', p_email), 'google');
  end if;
  update public.profiles set phone = p_phone where id = v;
  return v;
end $$;
create function pg_temp.it(p_name text, p_variant text, p_qty int) returns jsonb language sql as $$
  select jsonb_build_object('menu_item_id', (select id from public.menu_items where name = p_name), 'variant', p_variant, 'qty', p_qty);
$$;
-- number of rows an UPDATE touched (RLS-filtered updates silently touch 0)
create function pg_temp.rows_changed(p_sql text) returns int language plpgsql as $$
declare n int;
begin execute p_sql; get diagnostics n = row_count; return n; end $$;
create function pg_temp.settle() returns void language plpgsql as $$
declare r text := current_setting('role'); c text := current_setting('request.jwt.claims', true);
begin
  perform set_config('role', 'postgres', true);
  update public.orders set status = 'delivered' where status = 'new';
  perform set_config('role', r, true);
  perform set_config('request.jwt.claims', coalesce(c, ''), true);
end $$;

select pg_temp.new_user('parikhdhairy13@gmail.com', 'Owner', '9000000000') as admin \gset
select pg_temp.new_user('alice@example.com', 'Alice', '9111111111') as alice \gset
select pg_temp.new_user('bob@example.com', 'Bob', '9222222222') as bob \gset
select pg_temp.new_user('nophone@example.com', 'No Phone', null) as nophone \gset

------------------------------------------------------------------ pricing comes from the database
select pg_temp.as_user(:'alice');
select is((select subtotal from public.place_order(jsonb_build_array(pg_temp.it('Island Delight','reg',2)), '12 Test Society, Vasna', null::text)),
          160, 'subtotal is priced from menu_items (2 x 80)');
select pg_temp.settle();

select pg_temp.as_postgres();
update public.menu_items set price = 90 where name = 'Island Delight';
select pg_temp.as_user(:'alice');
select is((select total from public.place_order(jsonb_build_array(pg_temp.it('Island Delight','reg',2)), '12 Test Society, Vasna', null::text)),
          180, 'a price change in the database is used immediately');
select pg_temp.settle();

select is((select total from public.place_order(jsonb_build_array(pg_temp.it('Island Delight','cheese',1)), '12 Test Society, Vasna', null::text)),
          100, 'double cheese variant uses cheese_price');
select pg_temp.settle();

select is((select string_agg(oi.name || 'x' || oi.qty, ',' order by oi.id) from public.order_items oi
           join public.orders o on o.id = oi.order_id where o.user_id = :'alice'::uuid and oi.name like 'Island Delight (Double%'),
          'Island Delight (Double Cheese)x1', 'order line records the variant name');
select is((select count(*)::int from public.orders where user_id = :'alice'::uuid and pincode = '380007'), 3, 'orders always carry the fixed pincode');

------------------------------------------------------------------ rejected input
select throws_ok(format($$select * from public.place_order(%L::jsonb, '12 Test Society, Vasna', null::text)$$,
                        jsonb_build_array(jsonb_build_object('menu_item_id', 999999, 'variant', 'reg', 'qty', 1))),
                 'P0001', 'some items are unavailable', 'unknown menu item is rejected');
select throws_ok(format($$select * from public.place_order(%L::jsonb, '12 Test Society, Vasna', null::text)$$,
                        jsonb_build_array(pg_temp.it('Salted French Fries (100g)','cheese',1))),
                 'P0001', 'some items are unavailable', 'cheese variant on an item without cheese_price is rejected');
select throws_ok(format($$select * from public.place_order(%L::jsonb, '12 Test Society, Vasna', null::text)$$,
                        jsonb_build_array(pg_temp.it('Island Delight','reg',0))),
                 'P0001', 'some items are unavailable', 'quantity 0 is rejected');
select throws_ok(format($$select * from public.place_order(%L::jsonb, '12 Test Society, Vasna', null::text)$$,
                        jsonb_build_array(pg_temp.it('Island Delight','reg',21))),
                 'P0001', 'some items are unavailable', 'quantity above 20 is rejected');
select throws_ok($$select * from public.place_order('[]'::jsonb, '12 Test Society, Vasna', null::text)$$,
                 'P0001', 'cart is empty', 'empty cart is rejected');
select throws_ok(format($$select * from public.place_order(%L::jsonb, 'x', null::text)$$, jsonb_build_array(pg_temp.it('Island Delight','reg',1))),
                 'P0001', 'address required', 'short address is rejected');
select throws_ok(format($$select * from public.place_order(%L::jsonb, %L, null::text)$$, jsonb_build_array(pg_temp.it('Island Delight','reg',1)), repeat('a', 301)),
                 'P0001', 'address required', 'address over 300 chars is rejected');
select throws_ok(format($$select * from public.place_order(%L::jsonb, '12 Test Society, Vasna', null::text)$$,
                        (select jsonb_agg(pg_temp.it('Island Delight','reg',1)) from generate_series(1, 31))),
                 'P0001', 'cart too large', 'more than 30 cart lines is rejected');

select pg_temp.as_postgres();
update public.menu_items set in_stock = false where name = 'Tandoori Blast';
select pg_temp.as_user(:'alice');
select throws_ok(format($$select * from public.place_order(%L::jsonb, '12 Test Society, Vasna', null::text)$$, jsonb_build_array(pg_temp.it('Tandoori Blast','reg',1))),
                 'P0001', 'some items are unavailable', 'out-of-stock item is rejected');

select pg_temp.as_user(:'nophone');
select throws_ok(format($$select * from public.place_order(%L::jsonb, '12 Test Society, Vasna', null::text)$$, jsonb_build_array(pg_temp.it('Island Delight','reg',1))),
                 'P0001', 'complete your profile first', 'profile without a phone cannot order');

select pg_temp.as_anon();
select throws_ok(format($$select * from public.place_order(%L::jsonb, '12 Test Society, Vasna', null::text)$$, jsonb_build_array(pg_temp.it('Island Delight','reg',1))),
                 '42501', null, 'anon cannot call place_order');

select pg_temp.as_postgres();
update public.shop_settings set is_open = false;
select pg_temp.as_user(:'bob');
select throws_ok(format($$select * from public.place_order(%L::jsonb, '12 Test Society, Vasna', null::text)$$, jsonb_build_array(pg_temp.it('Island Delight','reg',1))),
                 'P0001', 'shop closed', 'ordering is refused while the shop is closed');
select pg_temp.as_postgres();
update public.shop_settings set is_open = true;

------------------------------------------------------------------ rate limit: 3 pending orders
select pg_temp.as_user(:'bob');
select lives_ok(format($$select * from public.place_order(%L::jsonb, '12 Test Society, Vasna', null::text)$$, jsonb_build_array(pg_temp.it('Island Delight','reg',1))), 'pending order 1');
select lives_ok(format($$select * from public.place_order(%L::jsonb, '12 Test Society, Vasna', null::text)$$, jsonb_build_array(pg_temp.it('Island Delight','reg',1))), 'pending order 2');
select lives_ok(format($$select * from public.place_order(%L::jsonb, '12 Test Society, Vasna', null::text)$$, jsonb_build_array(pg_temp.it('Island Delight','reg',1))), 'pending order 3');
select throws_ok(format($$select * from public.place_order(%L::jsonb, '12 Test Society, Vasna', null::text)$$, jsonb_build_array(pg_temp.it('Island Delight','reg',1))),
                 'P0001', 'too many pending orders, please wait for the shop to confirm', 'a 4th pending order is refused');
select pg_temp.settle();
select lives_ok(format($$select * from public.place_order(%L::jsonb, '12 Test Society, Vasna', null::text)$$, jsonb_build_array(pg_temp.it('Island Delight','reg',1))), 'ordering works again once orders are actioned');
select pg_temp.settle();
-- 10 per hour: bob has 4 orders so far
select pg_temp.as_postgres();
insert into public.orders (user_id, customer_name, customer_phone, address, subtotal, total, status)
select :'bob'::uuid, 'Bob', '9222222222', 'seeded address', 80, 80, 'delivered' from generate_series(1, 6);
select pg_temp.as_user(:'bob');
select throws_ok(format($$select * from public.place_order(%L::jsonb, '12 Test Society, Vasna', null::text)$$, jsonb_build_array(pg_temp.it('Island Delight','reg',1))),
                 'P0001', 'too many orders, please try again later', 'an 11th order within an hour is refused');

------------------------------------------------------------------ RLS on orders
select pg_temp.as_user(:'alice');
select is((select count(*)::int from public.orders where user_id <> :'alice'::uuid), 0, 'a customer sees only their own orders');
select is((select count(*)::int from public.order_items oi join public.orders o on o.id = oi.order_id where o.user_id <> :'alice'::uuid), 0, 'a customer sees only their own order items');
select throws_ok($$insert into public.orders (user_id, customer_name, customer_phone, address, subtotal, total) values (gen_random_uuid(), 'x', '9', 'addr12345', 1, 1)$$,
                 null, null, 'clients cannot insert orders directly');
select is(pg_temp.rows_changed($q$update public.orders set status = 'cancelled', total = 0$q$), 0, 'a customer cannot update orders');
select pg_temp.as_anon();
select is((select count(*)::int from public.orders), 0, 'anon sees no orders');
select pg_temp.as_user(:'admin');
select cmp_ok((select count(*)::int from public.orders), '>', 5, 'the admin sees everyone''s orders');
select is(pg_temp.rows_changed($q$update public.orders set status = 'confirmed' where id = (select min(id) from public.orders)$q$), 1, 'the admin can update order status');

------------------------------------------------------------------ profiles: column grants
select pg_temp.as_user(:'alice');
select lives_ok($$update public.profiles set name = 'Alice B' where id = auth.uid()$$, 'a user can change their name');
select lives_ok($$update public.profiles set phone = '9333333333' where id = auth.uid()$$, 'a user can change their phone');
select throws_ok($$update public.profiles set phone = '123' where id = auth.uid()$$, '23514', null, 'phone must be 10 digits');
select throws_ok($$update public.profiles set email = 'admin@example.com' where id = auth.uid()$$, '42501', null, 'a user cannot change their email column');
select throws_ok($$update public.profiles set created_at = now() - interval '1 year' where id = auth.uid()$$, '42501', null, 'a user cannot change created_at');
select is(pg_temp.rows_changed($q$update public.profiles set name = 'Hacked' where id <> auth.uid()$q$), 0, 'a user cannot edit someone else''s profile');
select is((select count(*)::int from public.profiles), 1, 'a user reads only their own profile');
select throws_ok($$update public.profiles set name = repeat('a', 101) where id = auth.uid()$$, '23514', null, 'names over 100 chars are refused');

------------------------------------------------------------------ admin check
select pg_temp.as_user(:'admin');
select is(public.is_admin(), true, 'confirmed owner email with a Google identity is admin');
select pg_temp.as_user(:'alice');
select is(public.is_admin(), false, 'ordinary users are not admin');

-- email is unique in auth.users, so weaken the owner's own account instead of making a lookalike
select pg_temp.as_postgres();
delete from auth.identities where user_id = :'admin'::uuid;
select pg_temp.as_user(:'admin');
select is(public.is_admin(), false, 'owner email without a Google identity is not admin');
select pg_temp.as_postgres();
insert into auth.identities (provider_id, user_id, identity_data, provider)
values (:'admin', :'admin'::uuid, '{}'::jsonb, 'google');
update auth.users set email_confirmed_at = null where id = :'admin'::uuid;
select pg_temp.as_user(:'admin');
select is(public.is_admin(), false, 'owner email that is not confirmed is not admin');

select pg_temp.as_user(:'alice');
select is(pg_temp.rows_changed($q$update public.menu_items set price = 1$q$), 0, 'a customer cannot change the menu');
select throws_ok($$select public.reset_menu()$$, 'P0001', 'not authorized', 'a customer cannot reset the menu');
select is(pg_temp.rows_changed($q$update public.shop_settings set is_open = false$q$), 0, 'a customer cannot close the shop');
select pg_temp.as_anon();
select is((select count(*)::int from public.admin_emails), 0, 'anon cannot read admin_emails');
select pg_temp.as_user(:'alice');
select is((select count(*)::int from public.admin_emails), 0, 'a customer cannot read admin_emails');

select * from finish();
rollback;
