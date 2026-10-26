-- The existing $2 discount per pair makes two $9 soaps cost $16.
-- Only current catalog prices change; saved order prices are untouched.
begin;
update public.products set price_cents = 900
where lower(trim(display_group)) = 'foaming hand soap' and not archived;
commit;
