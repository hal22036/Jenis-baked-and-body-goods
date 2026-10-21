-- Extra bake items: private production entries, separate from customer orders.
begin;

create table if not exists public.extra_bake_items (
  id uuid primary key default gen_random_uuid(),
  pickup_date_id uuid not null references public.pickup_dates(id),
  product_id uuid references public.products(id),
  item_name text not null check (length(trim(item_name)) > 0),
  batch_name text not null default 'Extra Stock',
  quantity integer not null check (quantity > 0),
  capacity_units integer not null check (capacity_units >= 0),
  is_flight_box boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists extra_bake_items_pickup_date_idx
  on public.extra_bake_items(pickup_date_id);
alter table public.extra_bake_items enable row level security;
revoke all on public.extra_bake_items from anon, authenticated;

create or replace function public.admin_list_extra_bake_items()
returns table(id uuid, pickup_date_id uuid, pickup_date date, product_id uuid,
  item_name text, batch_name text, quantity integer, capacity_units integer,
  is_flight_box boolean, note text)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query
  select e.id, e.pickup_date_id, d.pickup_date, e.product_id,
    e.item_name, e.batch_name, e.quantity, e.capacity_units, e.is_flight_box, e.note
  from public.extra_bake_items e
  join public.pickup_dates d on d.id = e.pickup_date_id
  order by d.pickup_date, e.created_at;
end;
$$;

create or replace function public.admin_save_extra_bake_item(
  p_id uuid, p_pickup_date_id uuid, p_product_id uuid,
  p_item_name text, p_batch_name text, p_quantity integer,
  p_capacity_units integer, p_note text
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
  v_units integer;
  v_flight boolean := false;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'Quantity must be at least 1'; end if;
  perform 1 from public.pickup_dates where id = p_pickup_date_id for update;
  if not found then raise exception 'Choose a pickup date'; end if;
  perform pg_advisory_xact_lock(7142026, 4);

  v_name := nullif(trim(p_item_name), '');
  v_units := p_capacity_units;
  if p_product_id is not null then
    select case when nullif(p.display_group, '') is not null and nullif(p.option_label, '') is not null
      then p.display_group || ' - ' || p.option_label else p.name end,
      p.capacity_units, p.product_type = 'flight_box'
    into v_name, v_units, v_flight
    from public.products p
    where p.id = p_product_id and p.category <> 'Bath & Body';
    if not found then raise exception 'Choose a baked goods product'; end if;
  end if;
  if v_name is null then raise exception 'Enter an item name'; end if;
  if v_units is null or v_units < 0 then raise exception 'Loaf spots cannot be negative'; end if;

  if p_id is null then
    insert into public.extra_bake_items(pickup_date_id, product_id, item_name, batch_name,
      quantity, capacity_units, is_flight_box, note)
    values(p_pickup_date_id, p_product_id, v_name, coalesce(nullif(trim(p_batch_name), ''), 'Extra Stock'),
      p_quantity, v_units, v_flight, coalesce(trim(p_note), ''))
    returning id into v_id;
  else
    update public.extra_bake_items
    set pickup_date_id = p_pickup_date_id, product_id = p_product_id, item_name = v_name,
      batch_name = coalesce(nullif(trim(p_batch_name), ''), 'Extra Stock'),
      quantity = p_quantity, capacity_units = v_units, is_flight_box = v_flight,
      note = coalesce(trim(p_note), '')
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Extra bake item not found'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.admin_remove_extra_bake_item(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  delete from public.extra_bake_items where id = p_id;
end;
$$;

-- Keep the existing availability API shape; ordered_count includes reserved extras.
create or replace view public.pickup_date_status as
select d.id, d.pickup_date, d.capacity, d.is_open,
  (coalesce((select sum(o.total_loaves) from public.orders o
    where o.pickup_date_id = d.id and o.fulfillment_status <> 'canceled'), 0)
  + coalesce((select sum(e.quantity::bigint * e.capacity_units) from public.extra_bake_items e
    where e.pickup_date_id = d.id), 0))::integer as ordered_count
from public.pickup_dates d;

create or replace function public.check_extra_bake_capacity()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_date_id uuid;
  v_used bigint;
  v_capacity integer;
  v_week date;
  v_flights bigint;
begin
  if TG_TABLE_NAME = 'orders' or TG_TABLE_NAME = 'extra_bake_items' then
    v_date_id := NEW.pickup_date_id;
  elsif TG_TABLE_NAME = 'order_items' then
    select o.pickup_date_id into v_date_id from public.orders o where o.id = NEW.order_id;
  else
    v_date_id := NEW.id;
  end if;
  select d.capacity, date_trunc('week', d.pickup_date::timestamp)::date
    into v_capacity, v_week from public.pickup_dates d where d.id = v_date_id for update;
  if not found then return NEW; end if;

  select coalesce((select sum(o.total_loaves) from public.orders o
    where o.pickup_date_id = v_date_id and o.fulfillment_status <> 'canceled'), 0)
    + coalesce((select sum(e.quantity::bigint * e.capacity_units) from public.extra_bake_items e
    where e.pickup_date_id = v_date_id), 0) into v_used;
  if v_used > v_capacity then
    raise exception 'Not enough loaf spots: customer orders and extra bake items use % spots; this date has %.', v_used, v_capacity;
  end if;

  select coalesce((select sum(oi.quantity) from public.orders o
    join public.pickup_dates d on d.id = o.pickup_date_id
    join public.order_items oi on oi.order_id = o.id
    join public.products p on p.id = oi.product_id
    where d.pickup_date >= v_week and d.pickup_date < v_week + 7
      and o.fulfillment_status <> 'canceled' and p.product_type = 'flight_box'), 0)
    + coalesce((select sum(e.quantity) from public.extra_bake_items e
    join public.pickup_dates d on d.id = e.pickup_date_id
    where d.pickup_date >= v_week and d.pickup_date < v_week + 7 and e.is_flight_box), 0)
    into v_flights;
  if v_flights > 4 then
    raise exception 'Only 4 flight boxes can be baked per week, including extra bake items.';
  end if;
  return NEW;
end;
$$;

drop trigger if exists check_extra_bake_orders on public.orders;
create constraint trigger check_extra_bake_orders after insert or update on public.orders
  deferrable initially deferred for each row execute function public.check_extra_bake_capacity();
drop trigger if exists check_extra_bake_order_items on public.order_items;
create constraint trigger check_extra_bake_order_items after insert or update on public.order_items
  deferrable initially deferred for each row execute function public.check_extra_bake_capacity();
drop trigger if exists check_extra_bake_entries on public.extra_bake_items;
create constraint trigger check_extra_bake_entries after insert or update on public.extra_bake_items
  deferrable initially deferred for each row execute function public.check_extra_bake_capacity();
drop trigger if exists check_extra_bake_dates on public.pickup_dates;
create constraint trigger check_extra_bake_dates after update on public.pickup_dates
  deferrable initially deferred for each row execute function public.check_extra_bake_capacity();

revoke all on function public.admin_list_extra_bake_items() from public;
revoke all on function public.admin_save_extra_bake_item(uuid,uuid,uuid,text,text,integer,integer,text) from public;
revoke all on function public.admin_remove_extra_bake_item(uuid) from public;
revoke all on function public.check_extra_bake_capacity() from public;
grant execute on function public.admin_list_extra_bake_items() to authenticated;
grant execute on function public.admin_save_extra_bake_item(uuid,uuid,uuid,text,text,integer,integer,text) to authenticated;
grant execute on function public.admin_remove_extra_bake_item(uuid) to authenticated;
grant select on public.pickup_date_status to anon, authenticated;
notify pgrst, 'reload schema';
commit;
