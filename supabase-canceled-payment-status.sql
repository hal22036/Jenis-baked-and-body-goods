-- Run in Supabase SQL Editor to allow Canceled as a payment status.
begin;

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
check (payment_status in ('pending','paid','refunded','canceled'));

create or replace function public.admin_update_order_status(
  p_order_id uuid,
  p_pickup_date_id uuid,
  p_payment_method text,
  p_payment_status text,
  p_fulfillment_status text,
  p_archived boolean,
  p_invoice_requested boolean,
  p_invoice_sent boolean,
  p_customer_email text,
  p_customer_phone text
)
returns table(
  order_id uuid,
  payment_status text,
  fulfillment_status text,
  archived boolean,
  invoice_requested boolean,
  invoice_sent boolean,
  customer_email text,
  customer_phone text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_capacity integer;
  v_existing_loaves integer;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select o.id, o.pickup_date_id, o.total_loaves, o.fulfillment_status
  into v_order
  from public.orders o
  where o.id = p_order_id
  for update;

  if v_order.id is null then
    raise exception 'Order not found';
  end if;

  select capacity
  into v_capacity
  from public.pickup_dates
  where id = p_pickup_date_id
  for update;

  if v_capacity is null then
    raise exception 'Pickup date not found';
  end if;

  if p_payment_method not in ('Venmo','Zelle','PayPal','CashApp','CashAtPickup') then
    raise exception 'Invalid payment method';
  end if;

  if p_payment_status not in ('pending','paid','refunded','canceled') then
    raise exception 'Invalid payment status';
  end if;

  if p_fulfillment_status not in ('new','prepping','ready','fulfilled','canceled') then
    raise exception 'Invalid fulfillment status';
  end if;

  if p_fulfillment_status <> 'canceled' then
    select coalesce(sum(o.total_loaves), 0)
    into v_existing_loaves
    from public.orders o
    where o.pickup_date_id = p_pickup_date_id
      and o.id <> p_order_id
      and o.fulfillment_status <> 'canceled';

    if v_existing_loaves + coalesce(v_order.total_loaves, 0) > v_capacity then
      raise exception 'This pickup date only has % loaf spots left', greatest(v_capacity - v_existing_loaves, 0);
    end if;
  end if;

  if (coalesce(p_invoice_requested, false) or coalesce(p_invoice_sent, false))
    and nullif(trim(coalesce(p_customer_email, '')), '') is null then
    raise exception 'Receipt email is required when a receipt is requested';
  end if;

  if v_order.fulfillment_status <> 'canceled' and p_fulfillment_status = 'canceled' then
    perform public.adjust_product_inventory(oi.product_id, -oi.quantity)
    from public.order_items oi
    where oi.order_id = p_order_id
      and oi.product_id is not null;
  elsif v_order.fulfillment_status = 'canceled' and p_fulfillment_status <> 'canceled' then
    perform public.adjust_product_inventory(oi.product_id, oi.quantity)
    from public.order_items oi
    where oi.order_id = p_order_id
      and oi.product_id is not null;
  end if;

  update public.orders as o
  set
    pickup_date_id = p_pickup_date_id,
    payment_method = p_payment_method,
    payment_status = p_payment_status,
    fulfillment_status = p_fulfillment_status,
    archived = p_archived,
    invoice_requested = coalesce(p_invoice_requested, false) or coalesce(p_invoice_sent, false),
    invoice_sent = coalesce(p_invoice_sent, false),
    customer_email = nullif(trim(coalesce(p_customer_email, '')), ''),
    customer_phone = trim(coalesce(p_customer_phone, ''))
  where o.id = p_order_id;

  if not found then
    raise exception 'Order not found';
  end if;

  return query
  select
    o.id,
    o.payment_status,
    o.fulfillment_status,
    o.archived,
    o.invoice_requested,
    o.invoice_sent,
    o.customer_email,
    o.customer_phone
  from public.orders o
  where o.id = p_order_id;
end;
$$;

create or replace function public.admin_create_manual_order(
  p_pickup_date_id uuid,
  p_special_pickup_date date,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_notes text,
  p_payment_method text,
  p_payment_status text,
  p_fulfillment_status text,
  p_total_loaves integer,
  p_discount_cents integer,
  p_items jsonb
)
returns table(order_id uuid, order_code text, total_cents integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_code text;
  v_pickup_date_id uuid;
  v_capacity integer;
  v_existing_loaves integer;
  v_total_loaves integer := greatest(coalesce(p_total_loaves, 0), 0);
  v_calculated_loaves integer := 0;
  v_subtotal integer := 0;
  v_home_bakery_subtotal integer := 0;
  v_general_product_subtotal integer := 0;
  v_discount integer := greatest(coalesce(p_discount_cents, 0), 0);
  v_bundle_discount integer := 0;
  v_totals record;
  v_item jsonb;
  v_product_id uuid;
  v_item_name text;
  v_tax_category text;
  v_quantity integer;
  v_unit_price_cents integer;
  v_item_loaf_spots integer;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if nullif(trim(coalesce(p_customer_name, '')), '') is null then
    raise exception 'Customer name is required';
  end if;

  if p_payment_method not in ('Venmo','Zelle','PayPal','CashApp','CashAtPickup') then
    raise exception 'Invalid payment method';
  end if;

  if p_payment_status not in ('pending','paid','refunded','canceled') then
    raise exception 'Invalid payment status';
  end if;

  if p_fulfillment_status not in ('new','prepping','ready','fulfilled','canceled') then
    raise exception 'Invalid fulfillment status';
  end if;

  if coalesce(jsonb_typeof(p_items), '') <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one order item';
  end if;

  if p_pickup_date_id is null and p_special_pickup_date is null then
    raise exception 'Order date is required';
  end if;

  if p_pickup_date_id is not null and p_special_pickup_date is not null then
    raise exception 'Choose an existing order date or a special date, not both';
  end if;

  if p_special_pickup_date is not null then
    insert into public.pickup_dates (pickup_date, capacity, is_open)
    values (p_special_pickup_date, greatest(14, v_total_loaves), false)
    on conflict on constraint pickup_dates_pickup_date_key
    do update set
      capacity = greatest(public.pickup_dates.capacity, excluded.capacity)
    returning id into v_pickup_date_id;
  else
    v_pickup_date_id := p_pickup_date_id;
  end if;

  select capacity
  into v_capacity
  from public.pickup_dates
  where id = v_pickup_date_id
  for update;

  if v_capacity is null then
    raise exception 'Pickup date not found';
  end if;

  select coalesce(sum(o.total_loaves), 0)
  into v_existing_loaves
  from public.orders o
  where o.pickup_date_id = v_pickup_date_id
    and o.fulfillment_status <> 'canceled';

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := null;
    v_item_name := nullif(trim(coalesce(v_item->>'name', '')), '');
    v_tax_category := lower(trim(coalesce(v_item->>'tax_category', 'home_bakery')));
    v_quantity := coalesce((v_item->>'quantity')::integer, 0);
    v_unit_price_cents := coalesce((v_item->>'unit_price_cents')::integer, 0);
    v_item_loaf_spots := greatest(coalesce((v_item->>'loaf_spots')::integer, 0), 0);

    if nullif(trim(coalesce(v_item->>'product_id', '')), '') is not null then
      v_product_id := (v_item->>'product_id')::uuid;
    end if;

    if v_item_name is null then
      raise exception 'Each item needs a name';
    end if;

    if v_quantity <= 0 then
      raise exception 'Each item quantity must be at least 1';
    end if;

    if v_unit_price_cents < 0 then
      raise exception 'Item prices cannot be negative';
    end if;

    if v_tax_category not in ('home_bakery','general_product') then
      raise exception 'Invalid item tax type';
    end if;

    v_subtotal := v_subtotal + (v_quantity * v_unit_price_cents);
    v_calculated_loaves := v_calculated_loaves + v_item_loaf_spots;
    if v_tax_category = 'general_product' then
      v_general_product_subtotal := v_general_product_subtotal + (v_quantity * v_unit_price_cents);
    else
      v_home_bakery_subtotal := v_home_bakery_subtotal + (v_quantity * v_unit_price_cents);
    end if;
  end loop;

  if v_calculated_loaves > 0 then
    v_total_loaves := v_calculated_loaves;
  end if;

  if p_fulfillment_status <> 'canceled'
    and v_existing_loaves + v_total_loaves > v_capacity then
    raise exception 'This pickup date only has % loaf spots left', greatest(v_capacity - v_existing_loaves, 0);
  end if;

  v_bundle_discount := public.product_bundle_discount(p_items);
  v_discount := v_discount + v_bundle_discount;

  if v_discount > v_subtotal then
    raise exception 'Discount cannot be more than the subtotal';
  end if;

  select *
  into v_totals
  from public.calculate_order_totals(v_subtotal, v_home_bakery_subtotal, v_general_product_subtotal, v_discount, 'items', 'pickup', null);

  insert into public.orders (
    pickup_date_id,
    customer_name,
    customer_email,
    customer_phone,
    notes,
    payment_method,
    payment_status,
    fulfillment_status,
    subtotal_cents,
    discount_cents,
    tax_cents,
    shipping_cents,
    total_cents,
    total_loaves,
    fulfillment_method,
    invoice_requested,
    invoice_sent
  )
  values (
    v_pickup_date_id,
    trim(p_customer_name),
    nullif(trim(coalesce(p_customer_email, '')), ''),
    trim(coalesce(p_customer_phone, '')),
    nullif(trim(coalesce(p_notes, '')), ''),
    p_payment_method,
    p_payment_status,
    p_fulfillment_status,
    v_subtotal,
    v_discount,
    v_totals.tax_cents,
    0,
    v_totals.final_total_cents,
    v_total_loaves,
    'pickup',
    false,
    false
  )
  returning orders.id, orders.order_code
  into v_order_id, v_order_code;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := null;

    if nullif(trim(coalesce(v_item->>'product_id', '')), '') is not null then
      v_product_id := (v_item->>'product_id')::uuid;
    end if;

    if p_fulfillment_status <> 'canceled' and v_product_id is not null then
      perform public.adjust_product_inventory(v_product_id, (v_item->>'quantity')::integer);
    end if;

    insert into public.order_items (
      order_id,
      product_id,
      custom_name,
      custom_tax_category,
      custom_capacity_units,
      item_note,
      quantity,
      unit_price_cents
    )
    values (
      v_order_id,
      v_product_id,
      case when v_product_id is null then trim(v_item->>'name') else null end,
      lower(trim(coalesce(v_item->>'tax_category', 'home_bakery'))),
      case
        when v_product_id is null
          then (greatest(coalesce((v_item->>'loaf_spots')::integer, 0), 0) / greatest((v_item->>'quantity')::integer, 1))::integer
        else 0
      end,
      nullif(trim(coalesce(v_item->>'item_note', '')), ''),
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price_cents')::integer
    );
  end loop;

  return query select v_order_id, v_order_code, v_totals.final_total_cents;
end;
$$;

notify pgrst, 'reload schema';
commit;
