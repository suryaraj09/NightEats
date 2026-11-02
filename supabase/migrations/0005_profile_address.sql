-- Remember the delivery address on the profile so returning customers don't retype it.
-- Additive and safe on the live project: a nullable column, a NOT VALID length check and one extra column grant.
-- The old frontend never reads or writes it; the new one falls back gracefully until this is applied.

alter table public.profiles add column address text;
alter table public.profiles
  add constraint profiles_address_length check (address is null or char_length(address) <= 300) not valid;

-- 0003 limited client updates to name + phone (+ updated_at); the address is the one extra editable field.
grant update (address) on public.profiles to authenticated;
