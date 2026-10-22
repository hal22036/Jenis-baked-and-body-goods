-- Run after supabase-extra-bake-batches.sql.
begin;
create or replace function public.admin_save_extra_bake_batch_with_date(
  p_batch_id uuid, p_pickup_date_id uuid, p_special_pickup_date date,
  p_batch_name text, p_items jsonb
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_date_id uuid := p_pickup_date_id;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if (p_pickup_date_id is null) = (p_special_pickup_date is null) then
    raise exception 'Choose an existing bake date or a special date';
  end if;
  if p_special_pickup_date is not null then
    -- A special date stays closed to website orders. Existing date settings are preserved.
    insert into public.pickup_dates(pickup_date, capacity, is_open)
    values(p_special_pickup_date, 14, false)
    on conflict on constraint pickup_dates_pickup_date_key do nothing;
    select d.id into v_date_id from public.pickup_dates d
    where d.pickup_date = p_special_pickup_date for update;
  end if;
  return public.admin_save_extra_bake_batch(p_batch_id, v_date_id, p_batch_name, p_items);
end;
$$;
revoke all on function public.admin_save_extra_bake_batch_with_date(uuid,uuid,date,text,jsonb) from public;
grant execute on function public.admin_save_extra_bake_batch_with_date(uuid,uuid,date,text,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
