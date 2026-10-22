-- Run after supabase-extra-bake-items.sql. Existing single items become individual batches.
begin;
alter table public.extra_bake_items add column if not exists batch_id uuid not null default gen_random_uuid();
create index if not exists extra_bake_items_batch_idx on public.extra_bake_items(batch_id);

drop function if exists public.admin_list_extra_bake_items();
create function public.admin_list_extra_bake_items()
returns table(id uuid, pickup_date_id uuid, pickup_date date, product_id uuid,
  item_name text, batch_name text, quantity integer, capacity_units integer,
  is_flight_box boolean, note text, batch_id uuid)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query select e.id, e.pickup_date_id, d.pickup_date, e.product_id,
    e.item_name, e.batch_name, e.quantity, e.capacity_units, e.is_flight_box, e.note, e.batch_id
  from public.extra_bake_items e
  join public.pickup_dates d on d.id = e.pickup_date_id
  order by d.pickup_date, e.created_at, e.id;
end;
$$;

create or replace function public.admin_save_extra_bake_batch(
  p_batch_id uuid, p_pickup_date_id uuid, p_batch_name text, p_items jsonb
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_batch_id uuid := coalesce(p_batch_id, gen_random_uuid());
  v_item jsonb;
  v_item_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Add at least one bake item';
  end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'Add at least one bake item'; end if;
  perform 1 from public.pickup_dates where id = p_pickup_date_id for update;
  if not found then raise exception 'Choose a bake date'; end if;
  perform pg_advisory_xact_lock(7142026, 4);
  if p_batch_id is not null then
    perform 1 from public.extra_bake_items where batch_id = p_batch_id for update;
    if not found then raise exception 'Extra bake batch no longer exists. Refresh and try again.'; end if;
  end if;
  -- Replacement is atomic; capacity triggers check the completed batch at commit.
  delete from public.extra_bake_items where batch_id = v_batch_id;
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_item_id := public.admin_save_extra_bake_item(
      null, p_pickup_date_id, nullif(v_item->>'product_id', '')::uuid,
      v_item->>'item_name', p_batch_name, (v_item->>'quantity')::integer,
      (v_item->>'capacity_units')::integer, v_item->>'note'
    );
    update public.extra_bake_items set batch_id = v_batch_id where id = v_item_id;
  end loop;
  return v_batch_id;
end;
$$;

create or replace function public.admin_remove_extra_bake_batch(p_batch_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  delete from public.extra_bake_items where batch_id = p_batch_id;
end;
$$;
revoke all on function public.admin_list_extra_bake_items() from public;
revoke all on function public.admin_save_extra_bake_batch(uuid,uuid,text,jsonb) from public;
revoke all on function public.admin_remove_extra_bake_batch(uuid) from public;
grant execute on function public.admin_list_extra_bake_items() to authenticated;
grant execute on function public.admin_save_extra_bake_batch(uuid,uuid,text,jsonb) to authenticated;
grant execute on function public.admin_remove_extra_bake_batch(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
