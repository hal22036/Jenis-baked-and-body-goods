-- Run this file in the Supabase SQL Editor to limit flight boxes to four per week.
-- Deferred checks validate the finished order after its items have been saved.
create or replace function public.lock_weekly_flight_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(7142026, 4);
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

create or replace function public.check_weekly_flight_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_week date;
  v_count bigint;
begin
  if TG_TABLE_NAME = 'orders' then
    v_order_id := NEW.id;
  else
    v_order_id := NEW.order_id;
  end if;

  select date_trunc('week', d.pickup_date::timestamp)::date
  into v_week
  from public.orders o
  join public.pickup_dates d on d.id = o.pickup_date_id
  where o.id = v_order_id;

  if v_week is null then return NEW; end if;

  select coalesce(sum(oi.quantity), 0)
  into v_count
  from public.orders o
  join public.pickup_dates d on d.id = o.pickup_date_id
  join public.order_items oi on oi.order_id = o.id
  join public.products p on p.id = oi.product_id
  where d.pickup_date >= v_week
    and d.pickup_date < v_week + 7
    and o.fulfillment_status <> 'canceled'
    and p.product_type = 'flight_box';

  if v_count > 4 then
    raise exception 'Only 4 mini loaf flight boxes are available per pickup week. Please reduce the flight box quantity or choose another week.';
  end if;
  return NEW;
end;
$$;

drop trigger if exists lock_flight_capacity_orders on public.orders;
create trigger lock_flight_capacity_orders
before insert or update or delete on public.orders
for each row execute function public.lock_weekly_flight_capacity();

drop trigger if exists lock_flight_capacity_items on public.order_items;
create trigger lock_flight_capacity_items
before insert or update or delete on public.order_items
for each row execute function public.lock_weekly_flight_capacity();

drop trigger if exists check_flight_capacity_orders on public.orders;
create constraint trigger check_flight_capacity_orders
after insert or update on public.orders
deferrable initially deferred
for each row execute function public.check_weekly_flight_capacity();

drop trigger if exists check_flight_capacity_items on public.order_items;
create constraint trigger check_flight_capacity_items
after insert or update on public.order_items
deferrable initially deferred
for each row execute function public.check_weekly_flight_capacity();

revoke all on function public.lock_weekly_flight_capacity() from public;
revoke all on function public.check_weekly_flight_capacity() from public;
