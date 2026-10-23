begin;

create or replace function public.sugar_scrub_bundle_discount(p_items jsonb)
returns integer
language sql
security definer
set search_path = public
as $$
  select (coalesce(sum((item->>'quantity')::integer), 0)::integer / 2) * 200
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) item
  join public.products p on p.id = (item->>'product_id')::uuid
  where lower(trim(coalesce(p.display_group, ''))) = 'whipped sugar scrub'
    and coalesce(item->>'quantity', '') ~ '^[0-9]+$';
$$;

revoke all on function public.sugar_scrub_bundle_discount(jsonb) from public;
grant execute on function public.sugar_scrub_bundle_discount(jsonb) to anon, authenticated;

create or replace function public.product_bundle_discount(p_items jsonb)
returns integer
language sql
security definer
set search_path = public
as $$
  select public.bath_bomb_bundle_discount(p_items)
    + public.foaming_hand_soap_bundle_discount(p_items)
    + public.sugar_scrub_bundle_discount(p_items);
$$;

update public.products set price_cents = 600
where lower(trim(display_group)) = 'whipped sugar scrub'
  and not archived;

notify pgrst, 'reload schema';
commit;
