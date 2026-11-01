-- pgTAP tests for admin-managed coupons (#25). Run with: npm run test:db
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
create function pg_temp.new_user(p_email text, p_name text, p_phone text) returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  perform pg_temp.as_postgres();
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role)
  values (v, p_email, now(), jsonb_build_object('full_name', p_name), 'authenticated', 'authenticated');
  insert into auth.identities (provider_id, user_id, identity_data, provider)
  values (v::text, v, jsonb_build_object('sub', v::text, 'email', p_email), 'google');
  update public.profiles set phone = p_phone where id = v;
  return v;
end $$;
create function pg_temp.it(p_name text, p_variant text, p_qty int) returns jsonb language sql as $$
  select jsonb_build_object('menu_item_id', (select id from public.menu_items where name = p_name), 'variant', p_variant, 'qty', p_qty);
$$;
create function pg_temp.rows_changed(p_sql text) returns int language plpgsql as $$
declare n int;
begin execute p_sql; get diagnostics n = row_count; return n; end $$;
-- run a statement as postgres, then go back to the previous role
create function pg_temp.admin_sql(p_sql text) returns void language plpgsql as $$
declare r text := current_setting('role'); c text := current_setting('request.jwt.claims', true);
begin
  perform set_config('role', 'postgres', true);
  execute p_sql;
  perform set_config('role', r, true);
  perform set_config('request.jwt.claims', coalesce(c, ''), true);
end $$;
create function pg_temp.settle() returns void language sql as $$
  select pg_temp.admin_sql($q$update public.orders set status = 'delivered' where status = 'new'$q$);
$$;
create function pg_temp.vr(p_code text, p_items jsonb) returns text language sql as $$
  select case when valid then 'OK:' || discount else reason end from public.validate_coupon(p_code, p_items);
$$;
create function pg_temp.starts(v text, prefix text, descr text) returns text language sql as $$
  select ok(v like prefix || '%', descr);
$$;
create function pg_temp.addr() returns text language sql as $$ select '12 Test Society, Vasna' $$;

select pg_temp.new_user('parikhdhairy13@gmail.com', 'Owner', '9000000000') as admin \gset
select pg_temp.new_user('alice@example.com', 'Alice', '9111111111') as alice \gset
select pg_temp.new_user('bob@example.com', 'Bob', '9222222222') as bob \gset
-- carol shares Alice's phone number
select pg_temp.new_user('carol@example.com', 'Carol', '9111111111') as carol \gset

-- Test carts. Prices: Island Delight / Tandoori Blast 80 (cheese 100), fries 70 / 90, Cheese Grilled sandwich 140, Tikka Pav 100.
-- cart_a = 2 x burger 80 + 1 x salted fries 70 = 230
\set cart_a 'jsonb_build_array(pg_temp.it(''Island Delight'',''reg'',2), pg_temp.it(''Salted French Fries (100g)'',''reg'',1))'
\set one_burger 'jsonb_build_array(pg_temp.it(''Island Delight'',''reg'',1))'
\set fries_only 'jsonb_build_array(pg_temp.it(''Salted French Fries (100g)'',''reg'',2))'

------------------------------------------------------------------ BOGO1ST was migrated and still works
select pg_temp.as_user(:'alice');
select is(pg_temp.vr('BOGO1ST', :one_burger), 'આ કોડ માટે ઓછામાં ઓછી 2 આઇટમ્સ જોઈએ.', 'BOGO1ST needs 2 items');
select is(pg_temp.vr('BOGO1ST', :cart_a), 'OK:70', 'BOGO1ST makes the cheapest unit free');
select is(pg_temp.vr('bogo1st ', :cart_a), 'OK:70', 'codes are case-insensitive and trimmed');
select is((select discount from public.place_order(:cart_a, pg_temp.addr(), 'BOGO1ST')), 70, 'place_order applies BOGO1ST server-side');
select is((select coupon_code from public.orders where user_id = :'alice'::uuid), 'BOGO1ST', 'the order stores the coupon code');
select is(pg_temp.vr('BOGO1ST', :cart_a), 'તમે આ કોડ અગાઉ વાપરી ચૂક્યા છો.', 'once per account');
select pg_temp.settle();
select pg_temp.as_user(:'carol');
select is(pg_temp.vr('BOGO1ST', :cart_a), 'આ મોબાઈલ નંબર પર આ કોડ અગાઉ વપરાઈ ચૂક્યો છે.', 'once per phone number (another account, same phone)');
select throws_ok(format($$select * from public.place_order(%L::jsonb, %L, 'BOGO1ST')$$, :cart_a, pg_temp.addr()),
                 'P0001', 'COUPON: આ મોબાઈલ નંબર પર આ કોડ અગાઉ વપરાઈ ચૂક્યો છે.', 'place_order refuses a used coupon');
select pg_temp.as_user(:'bob');
select is((select discount from public.place_order(:cart_a, pg_temp.addr(), true)), 70, 'old place_order(items, addr, boolean) wrapper still applies BOGO1ST');
select pg_temp.settle();
select is(public.bogo_available(), false, 'old bogo_available() wrapper reports the use');

------------------------------------------------------------------ percent
select pg_temp.admin_sql($q$insert into public.coupons (code, type, percent_off) values ('TEN', 'percent', 10)$q$);
select pg_temp.admin_sql($q$insert into public.coupons (code, type, percent_off, max_discount) values ('TENCAP', 'percent', 10, 15)$q$);
select pg_temp.as_user(:'alice');
select is(pg_temp.vr('TEN', :cart_a), 'OK:23', '10% of 230');
select is(pg_temp.vr('TENCAP', :cart_a), 'OK:15', 'percent is capped by max_discount');

------------------------------------------------------------------ flat
select pg_temp.admin_sql($q$insert into public.coupons (code, type, flat_off) values ('FLAT30', 'flat', 30), ('FLAT999', 'flat', 999)$q$);
select is(pg_temp.vr('FLAT30', :cart_a), 'OK:30', 'flat 30 off');
select is(pg_temp.vr('FLAT999', :one_burger), 'OK:80', 'flat discount never exceeds the subtotal');

------------------------------------------------------------------ buy X get Y (buy 2 get 1, not repeating)
select pg_temp.admin_sql($q$insert into public.coupons (code, type, buy_qty, free_qty) values ('B2G1', 'buy_x_get_y', 2, 1)$q$);
select is(pg_temp.vr('B2G1', jsonb_build_array(pg_temp.it('Island Delight','reg',2))), 'આ કોડ માટે ઓછામાં ઓછી 3 આઇટમ્સ જોઈએ.', 'buy 2 get 1 needs 3 units');
select is(pg_temp.vr('B2G1', :cart_a), 'OK:70', 'buy 2 get 1: the cheapest of 3 is free');
select is(pg_temp.vr('B2G1', jsonb_build_array(pg_temp.it('Island Delight','reg',6))), 'OK:80', 'it does not repeat: still only one free unit');

------------------------------------------------------------------ free item above a minimum order value
select pg_temp.admin_sql($q$insert into public.coupons (code, type, free_item_id, min_order_value)
  values ('FREEFRIES', 'free_item', (select id from public.menu_items where name = 'Salted French Fries (100g)'), 200)$q$);
select pg_temp.starts(pg_temp.vr('FREEFRIES', :one_burger), 'આ કોડ માટે ઓછામાં ઓછા ₹200', 'free item needs the minimum order value');
select is(pg_temp.vr('FREEFRIES', :cart_a), 'OK:0', 'free item above the minimum: no money discount');
select is((select free_item_name from public.validate_coupon('FREEFRIES', :cart_a)), 'Salted French Fries (100g)', 'validate_coupon names the freebie');
select pg_temp.admin_sql($q$update public.menu_items set in_stock = false where name = 'Salted French Fries (100g)'$q$);
select is(pg_temp.vr('FREEFRIES', jsonb_build_array(pg_temp.it('Island Delight','reg',3))), 'ફ્રી આઇટમ હમણાં ઉપલબ્ધ નથી.', 'an out-of-stock freebie invalidates the coupon');
select pg_temp.admin_sql($q$update public.menu_items set in_stock = true where name = 'Salted French Fries (100g)'$q$);
select pg_temp.as_user(:'bob');
select is((select total from public.place_order(:cart_a, pg_temp.addr(), 'FREEFRIES')), 230, 'free item does not change the total');
select is((select string_agg(oi.name || ':' || oi.unit_price || 'x' || oi.qty, ',' order by oi.id) from public.order_items oi
           where oi.order_id = (select max(id) from public.orders where user_id = :'bob'::uuid) and oi.unit_price = 0),
          'Salted French Fries (100g) (FREE):0x1', 'the freebie is added as a Rs 0 order line');
select pg_temp.settle();

------------------------------------------------------------------ bundle: any 2 burgers for 140
select pg_temp.admin_sql($q$insert into public.coupons (code, type, bundle_qty, bundle_price, applies_to, category)
  values ('BURGER2', 'bundle', 2, 140, 'category', 'Burger')$q$);
select pg_temp.as_user(:'alice');
select is(pg_temp.vr('BURGER2', jsonb_build_array(pg_temp.it('Island Delight','reg',2))), 'OK:20', '2 burgers for 140 saves 20');
select is(pg_temp.vr('BURGER2', jsonb_build_array(pg_temp.it('Island Delight','reg',3))), 'OK:20', '3 burgers: one bundle');
select is(pg_temp.vr('BURGER2', jsonb_build_array(pg_temp.it('Island Delight','reg',4))), 'OK:40', '4 burgers: two bundles');
select is(pg_temp.vr('BURGER2', :one_burger), 'આ કોડ માટે ઓછામાં ઓછી 2 આઇટમ્સ જોઈએ.', 'a bundle needs its full quantity');
select is(pg_temp.vr('BURGER2', jsonb_build_array(pg_temp.it('Island Delight','cheese',2))), 'OK:60', 'bundle compares against the actual unit prices (2 x 100 -> 140)');

------------------------------------------------------------------ scope: category and specific items
select pg_temp.admin_sql($q$insert into public.coupons (code, type, percent_off, applies_to, category) values ('FRIES50', 'percent', 50, 'category', 'Fries')$q$);
select is(pg_temp.vr('FRIES50', :cart_a), 'OK:35', 'category scope discounts only that category (50% of 70)');
select is(pg_temp.vr('FRIES50', jsonb_build_array(pg_temp.it('Island Delight','reg',2))), 'આ કોડ તમારા કાર્ટની આઇટમ્સ પર લાગુ પડતો નથી.', 'category scope needs an item from the category');
select pg_temp.admin_sql($q$insert into public.coupons (code, type, flat_off, applies_to, item_ids)
  values ('TANDOORI', 'flat', 25, 'items', array[(select id from public.menu_items where name = 'Tandoori Blast')])$q$);
select is(pg_temp.vr('TANDOORI', :cart_a), 'આ કોડ તમારા કાર્ટની આઇટમ્સ પર લાગુ પડતો નથી.', 'item scope ignores other items');
select is(pg_temp.vr('TANDOORI', jsonb_build_array(pg_temp.it('Tandoori Blast','reg',1))), 'OK:25', 'item scope applies to the listed item');

------------------------------------------------------------------ minimums
select pg_temp.admin_sql($q$insert into public.coupons (code, type, flat_off, min_qty, min_order_value) values ('MINS', 'flat', 10, 3, 250)$q$);
select is(pg_temp.vr('MINS', jsonb_build_array(pg_temp.it('Island Delight','reg',2))), 'આ કોડ માટે ઓછામાં ઓછી 3 આઇટમ્સ જોઈએ.', 'minimum quantity');
select pg_temp.starts(pg_temp.vr('MINS', :cart_a), 'આ કોડ માટે ઓછામાં ઓછા ₹250', 'minimum order value (3 units but only 230)');
select is(pg_temp.vr('MINS', jsonb_build_array(pg_temp.it('Island Delight','reg',4))), 'OK:10', 'minimums met (4 units, 320)');

------------------------------------------------------------------ validity: active, dates
select pg_temp.admin_sql($q$insert into public.coupons (code, type, flat_off, is_active) values ('OFF', 'flat', 10, false)$q$);
select pg_temp.admin_sql($q$insert into public.coupons (code, type, flat_off, starts_at) values ('SOON', 'flat', 10, now() + interval '1 day')$q$);
select pg_temp.admin_sql($q$insert into public.coupons (code, type, flat_off, ends_at) values ('GONE', 'flat', 10, now() - interval '1 day')$q$);
select is(pg_temp.vr('NOPE', :cart_a), 'આ કોડ માન્ય નથી.', 'unknown code');
select is(pg_temp.vr('OFF', :cart_a), 'આ કોડ માન્ય નથી.', 'switched-off coupon');
select is(pg_temp.vr('SOON', :cart_a), 'આ કોડ હજી શરૂ થયો નથી.', 'not started yet');
select is(pg_temp.vr('GONE', :cart_a), 'આ કોડની મુદત પૂરી થઈ ગઈ છે.', 'expired');
select is(pg_temp.vr('TEN,FLAT30', :cart_a), 'આ કોડ માન્ય નથી.', 'only one coupon per order: two codes in one field are not a code');

------------------------------------------------------------------ time window and weekday (Asia/Kolkata)
select pg_temp.admin_sql(format($q$insert into public.coupons (code, type, flat_off, start_time, end_time) values
  ('NOWWIN', 'flat', 10, ((now() at time zone 'Asia/Kolkata')::time - interval '1 hour'), ((now() at time zone 'Asia/Kolkata')::time + interval '1 hour')),
  ('LATER',  'flat', 10, ((now() at time zone 'Asia/Kolkata')::time + interval '1 hour'), ((now() at time zone 'Asia/Kolkata')::time + interval '2 hours')),
  ('WRAP',   'flat', 10, ((now() at time zone 'Asia/Kolkata')::time + interval '2 hours'), ((now() at time zone 'Asia/Kolkata')::time + interval '1 hour'))$q$));
select is(pg_temp.vr('NOWWIN', :cart_a), 'OK:10', 'inside the happy-hour window');
select is(pg_temp.vr('LATER', :cart_a), 'આ કોડ હમણાં માન્ય નથી.', 'outside the window');
select is(pg_temp.vr('WRAP', :cart_a), 'OK:10', 'a window that wraps past midnight includes the current time');
select pg_temp.admin_sql($q$insert into public.coupons (code, type, flat_off, days_of_week) values
  ('TODAY', 'flat', 10, array[extract(dow from now() at time zone 'Asia/Kolkata')::int]),
  ('NOTTODAY', 'flat', 10, array[((extract(dow from now() at time zone 'Asia/Kolkata')::int + 3) % 7)])$q$);
select is(pg_temp.vr('TODAY', :cart_a), 'OK:10', 'valid on today''s weekday');
select is(pg_temp.vr('NOTTODAY', :cart_a), 'આ કોડ આજના દિવસે માન્ય નથી.', 'not valid on other weekdays');

------------------------------------------------------------------ usage limits
select pg_temp.admin_sql($q$insert into public.coupons (code, type, flat_off, first_order_only) values ('FIRST', 'flat', 10, true)$q$);
select pg_temp.new_user('dave@example.com', 'Dave', '9666666666') as dave \gset
select pg_temp.as_user(:'dave');
select is(pg_temp.vr('FIRST', :cart_a), 'OK:10', 'first order only: allowed on the first order');
select lives_ok(format($$select * from public.place_order(%L::jsonb, %L, null::text)$$, :one_burger, pg_temp.addr()), 'dave places an order');
select is(pg_temp.vr('FIRST', :cart_a), 'આ કોડ ફક્ત પહેલા ઓર્ડર માટે છે.', 'first order only: refused afterwards');
select pg_temp.settle();

select pg_temp.admin_sql($q$insert into public.coupons (code, type, flat_off, max_total_uses) values ('ONLY1', 'flat', 10, 1)$q$);
select pg_temp.new_user('erin@example.com', 'Erin', '9777777777') as erin \gset
select pg_temp.new_user('frank@example.com', 'Frank', '9888888888') as frank \gset
select pg_temp.as_user(:'erin');
select lives_ok(format($$select * from public.place_order(%L::jsonb, %L, 'ONLY1')$$, :cart_a, pg_temp.addr()), 'erin uses the last available redemption');
select pg_temp.as_user(:'frank');
select is(pg_temp.vr('ONLY1', :cart_a), 'આ કોડની મર્યાદા પૂરી થઈ ગઈ છે.', 'total uses exhausted');
select pg_temp.admin_sql($q$update public.orders set status = 'cancelled' where coupon_code = 'ONLY1'$q$);
select is(pg_temp.vr('ONLY1', :cart_a), 'OK:10', 'a cancelled order frees the coupon use');

select pg_temp.admin_sql($q$insert into public.coupons (code, type, flat_off, max_uses_per_user) values ('TWICE', 'flat', 10, 2)$q$);
select pg_temp.as_user(:'frank');
select lives_ok(format($$select * from public.place_order(%L::jsonb, %L, 'TWICE')$$, :cart_a, pg_temp.addr()), 'use 1 of 2');
select lives_ok(format($$select * from public.place_order(%L::jsonb, %L, 'TWICE')$$, :cart_a, pg_temp.addr()), 'use 2 of 2');
select is(pg_temp.vr('TWICE', :cart_a), 'તમે આ કોડ અગાઉ વાપરી ચૂક્યા છો.', 'per-account limit of 2');
select pg_temp.settle();

------------------------------------------------------------------ orders keep their own numbers
select pg_temp.as_user(:'alice');
select is((select discount from public.place_order(:cart_a, pg_temp.addr(), 'TEN')), 23, 'order placed with TEN');
select pg_temp.admin_sql($q$update public.coupons set percent_off = 50 where code = 'TEN'$q$);
select is((select discount from public.orders where coupon_code = 'TEN' and user_id = :'alice'::uuid), 23, 'editing a coupon does not change past orders');
select pg_temp.admin_sql($q$delete from public.coupons where code = 'TEN'$q$);
select is((select coupon_code || ':' || discount from public.orders where coupon_code = 'TEN' and user_id = :'alice'::uuid), 'TEN:23', 'deleting a coupon keeps the order''s code and discount');
select is(pg_temp.vr('TEN', :cart_a), 'આ કોડ માન્ય નથી.', 'a deleted coupon no longer works');
select pg_temp.settle();

------------------------------------------------------------------ validate_coupon edge cases
select is(pg_temp.vr('FLAT30', '[]'::jsonb), 'કાર્ટ ખાલી છે.', 'empty cart');
select pg_temp.admin_sql($q$update public.menu_items set in_stock = false where name = 'Tandoori Blast'$q$);
select is(pg_temp.vr('FLAT30', jsonb_build_array(pg_temp.it('Tandoori Blast','reg',1))), 'કાર્ટની કેટલીક આઇટમ્સ હમણાં ઉપલબ્ધ નથી.', 'out-of-stock cart item');
select pg_temp.as_anon();
select throws_ok($$select * from public.validate_coupon('FLAT30', '[]'::jsonb)$$, '42501', null, 'anon cannot call validate_coupon');

------------------------------------------------------------------ RLS
select pg_temp.as_user(:'alice');
select is((select count(*)::int from public.coupons), 0, 'customers cannot list coupons');
select is((select count(*)::int from public.coupon_redemptions), 0, 'customers cannot read redemptions');
select throws_ok($$insert into public.coupons (code, type, flat_off) values ('HACK', 'flat', 999)$$, '42501', null, 'customers cannot create coupons');
select is(pg_temp.rows_changed($q$update public.coupons set flat_off = 1$q$), 0, 'customers cannot edit coupons');
select is(pg_temp.rows_changed($q$delete from public.coupons$q$), 0, 'customers cannot delete coupons');
select throws_ok($$insert into public.coupon_redemptions (coupon_id, user_id, phone) values (1, auth.uid(), '9')$$, '42501', null, 'customers cannot write redemptions');
select pg_temp.as_anon();
select throws_ok($$select * from public.coupon_redemptions$$, '42501', null, 'anon has no access to redemptions');
select throws_ok($$select * from public.coupons$$, '42501', null, 'anon has no access to coupons');
select pg_temp.as_user(:'admin');
select cmp_ok((select count(*)::int from public.coupons), '>', 10, 'the admin lists coupons');
select lives_ok($$insert into public.coupons (code, type, percent_off, description) values ('NEWONE', 'percent', 5, 'test')$$, 'the admin creates a coupon');
select lives_ok($$update public.coupons set percent_off = 6 where code = 'NEWONE'$$, 'the admin edits a coupon');
select cmp_ok((select count(*)::int from public.coupon_redemptions), '>', 3, 'the admin reads redemptions');
select is((select uses from public.coupon_usage where coupon_id = (select id from public.coupons where code = 'BOGO1ST')), 2, 'coupon_usage counts BOGO1ST uses (alice and bob)');
select lives_ok($$delete from public.coupons where code = 'NEWONE'$$, 'the admin deletes a coupon');

------------------------------------------------------------------ constraints
select pg_temp.as_postgres();
select throws_ok($$insert into public.coupons (code, type) values ('NOPARAM', 'percent')$$, '23514', null, 'a percent coupon needs percent_off');
select throws_ok($$insert into public.coupons (code, type, flat_off) values ('bad code', 'flat', 5)$$, '23514', null, 'codes must be upper-case A-Z, 0-9, _ or -');
select throws_ok($$insert into public.coupons (code, type, flat_off, applies_to) values ('NOCAT', 'flat', 5, 'category')$$, '23514', null, 'category scope needs a category');
select throws_ok($$insert into public.coupons (code, type, flat_off, start_time) values ('HALFWIN', 'flat', 5, '10:00')$$, '23514', null, 'a time window needs both ends');
select throws_ok($$insert into public.coupons (code, type, flat_off) values ('BOGO1ST', 'flat', 5)$$, '23505', null, 'codes are unique');

select * from finish();
rollback;
