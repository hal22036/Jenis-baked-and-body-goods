-- Run once in Supabase SQL Editor to activate K&C-LAW.
begin;

alter table public.coupons
add column if not exists required_product_id uuid references public.products(id);

create or replace function public.validate_coupon_code(
  p_coupon_code text,
  p_subtotal_cents integer,
  p_fulfillment_method text,
  p_items jsonb
)
returns table(
  code text,
  description text,
  applies_to text,
  discount_cents integer,
  final_total_cents integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon public.coupons%rowtype;
  v_code text;
  v_subtotal integer;
  v_shipping_cents integer;
  v_discount_base integer;
  v_used_count integer;
  v_discount integer;
  v_gift_price integer;
  v_gift_name text;
  v_fulfillment_method text;
begin
  v_code := upper(trim(coalesce(p_coupon_code, '')));
  v_subtotal := greatest(coalesce(p_subtotal_cents, 0), 0);
  v_fulfillment_method := lower(trim(coalesce(p_fulfillment_method, 'pickup')));

  if v_code = '' then
    raise exception 'Enter a coupon code';
  end if;

  select *
  into v_coupon
  from public.coupons c
  where c.code = v_code
    and c.active = true
    and (c.starts_on is null or c.starts_on <= (now() at time zone 'America/Los_Angeles')::date)
    and (c.ends_on is null or c.ends_on >= (now() at time zone 'America/Los_Angeles')::date)
  for update;

  if not found then
    raise exception 'Coupon code is not valid';
  end if;

  if v_subtotal < v_coupon.minimum_subtotal_cents then
    raise exception 'Order subtotal does not meet the coupon minimum';
  end if;

  select coalesce(nullif(value, '')::integer, 0)
  into v_shipping_cents
  from public.app_settings
  where key = 'shipping_flat_cents';

  v_shipping_cents := greatest(coalesce(v_shipping_cents, 0), 0);

  if v_fulfillment_method <> 'shipping' then
    v_shipping_cents := 0;
  end if;

  if v_coupon.applies_to = 'shipping' and v_shipping_cents <= 0 then
    raise exception 'Coupon only applies to shipping orders';
  end if;

  v_discount_base := case v_coupon.applies_to
    when 'shipping' then v_shipping_cents
    when 'order' then v_subtotal + v_shipping_cents
    else v_subtotal
  end;

  if v_discount_base <= 0 then
    raise exception 'Coupon cannot be applied to this order';
  end if;

  if v_coupon.max_uses is not null then
    select count(*)::integer
    into v_used_count
    from public.orders o
    where o.coupon_code = v_coupon.code
      and o.fulfillment_status <> 'canceled';

    if v_used_count >= v_coupon.max_uses then
      raise exception 'Coupon code has already been used';
    end if;
  end if;

  if v_coupon.required_product_id is not null then
    select p.price_cents, p.name into v_gift_price, v_gift_name
    from public.products p
    where p.id = v_coupon.required_product_id and p.active and not p.archived;

    if not found then raise exception 'The gift certificate item is not currently available'; end if;
    if jsonb_typeof(p_items) is distinct from 'array' then
      raise exception 'Add the gift certificate item to your cart and apply the code again';
    end if;
    if not exists (
      select 1 from jsonb_array_elements(p_items) item
      where item->>'product_id' = v_coupon.required_product_id::text
        and coalesce(item->>'quantity', '') ~ '^[1-9][0-9]*$'
    ) then
      raise exception 'Add % to your cart to use this gift certificate', v_gift_name;
    end if;
    if v_coupon.applies_to <> 'items' then
      raise exception 'Free-item certificates must apply to items';
    end if;
    v_discount := v_gift_price;
  elsif v_coupon.discount_type = 'percent' then
    v_discount := floor(v_discount_base * v_coupon.percent_off / 100.0)::integer;
  else
    v_discount := v_coupon.amount_off_cents;
  end if;

  v_discount := least(v_discount, v_discount_base);

  return query
  select
    v_coupon.code,
    coalesce(v_coupon.description, ''),
    v_coupon.applies_to,
    v_discount,
    greatest(v_subtotal + v_shipping_cents - v_discount, 0);
end;
$$;

create or replace function public.validate_coupon_code(
  p_coupon_code text,
  p_subtotal_cents integer,
  p_fulfillment_method text default 'pickup'
)
returns table(code text, description text, applies_to text,
  discount_cents integer, final_total_cents integer)
language sql security definer set search_path = public
as $$
  select * from public.validate_coupon_code(
    p_coupon_code, p_subtotal_cents, p_fulfillment_method, null::jsonb
  );
$$;

create or replace function public.place_order(
  p_pickup_date_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_notes text,
  p_payment_method text,
  p_invoice_requested boolean,
  p_coupon_code text,
  p_fulfillment_method text,
  p_shipping_address text,
  p_tip_cents integer,
  p_reward_type text,
  p_items jsonb
)
returns table(order_id uuid, order_code text, total_cents integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity integer;
  v_current integer;
  v_requested integer;
  v_total integer;
  v_home_bakery_total integer;
  v_general_product_total integer;
  v_item_count integer;
  v_order_id uuid;
  v_order_code text;
  v_item jsonb;
  v_quantity integer;
  v_price integer;
  v_capacity_units integer;
  v_shippable boolean;
  v_tax_category text;
  v_track_inventory boolean;
  v_inventory_quantity integer;
  v_coupon record;
  v_coupon_code text;
  v_coupon_applies_to text;
  v_discount integer;
  v_bundle_discount integer;
  v_totals record;
  v_fulfillment_method text;
  v_shipping_address text;
  v_tip integer;
  v_phone text;
  v_reward_type text;
  v_reward_discount integer := 0;
  v_reward_status record;
  v_product_type text;
  v_item_note text;
begin
  if p_payment_method not in ('Venmo', 'Zelle', 'PayPal', 'CashApp', 'CashAtPickup') then
    raise exception 'Invalid payment method';
  end if;

  if nullif(trim(p_customer_name), '') is null
    or nullif(trim(p_customer_phone), '') is null then
    raise exception 'Customer name and phone are required';
  end if;

  if length(regexp_replace(p_customer_phone, '\D', '', 'g')) <> 10 then
    raise exception 'A 10-digit phone number is required';
  end if;

  v_phone := regexp_replace(p_customer_phone, '\D', '', 'g');
  v_reward_type := lower(nullif(trim(coalesce(p_reward_type, '')), ''));

  if v_reward_type is not null and v_reward_type not in ('bread', 'granola') then
    raise exception 'Invalid reward selection';
  end if;

  if coalesce(p_invoice_requested, false)
    and nullif(trim(coalesce(p_customer_email, '')), '') is null then
    raise exception 'Email is required when an invoice is requested';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Order items must be an array';
  end if;

  v_fulfillment_method := lower(trim(coalesce(p_fulfillment_method, 'pickup')));
  v_shipping_address := nullif(trim(coalesce(p_shipping_address, '')), '');
  v_tip := greatest(coalesce(p_tip_cents, 0), 0);

  if v_fulfillment_method not in ('pickup', 'shipping') then
    raise exception 'Invalid fulfillment method';
  end if;

  if v_fulfillment_method = 'shipping' and v_shipping_address is null then
    raise exception 'Shipping address is required';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    where (item->>'product_id') is null
      or (item->>'quantity') is null
      or (item->>'quantity') !~ '^[0-9]+$'
      or (item->>'quantity')::integer <= 0
  ) then
    raise exception 'Every order item must include a product and positive quantity';
  end if;

  -- Lock the pickup-date row so two customers cannot claim the same final spots.
  select capacity
  into v_capacity
  from pickup_dates
  where id = p_pickup_date_id
    and is_open = true
    and (now() at time zone 'America/Los_Angeles') < (
      pickup_date
      - (((extract(dow from pickup_date)::integer - 3 + 7) % 7) * interval '1 day')
      + time '17:00'
    )
  for update;

  if not found then
    raise exception 'Pickup date is closed, past, or past the Wednesday 5 PM ordering cutoff';
  end if;

  select coalesce(sum(o.total_loaves), 0)::integer
  into v_current
  from public.orders o
  where o.pickup_date_id = p_pickup_date_id
    and o.fulfillment_status <> 'canceled';

  v_total := 0;
  v_home_bakery_total := 0;
  v_general_product_total := 0;
  v_item_count := 0;
  v_requested := 0;

  for v_item in
    select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;

    select price_cents, capacity_units, shippable, tax_category, track_inventory, inventory_quantity, product_type
    into v_price, v_capacity_units, v_shippable, v_tax_category, v_track_inventory, v_inventory_quantity, v_product_type
    from products
    where id = (v_item->>'product_id')::uuid
      and active = true
    for update;

    if v_price is null then
      raise exception 'Invalid product';
    end if;

    if v_product_type = 'flight_box' then
      if v_quantity <> 1 then
        raise exception 'Each configured flight box must be submitted separately';
      end if;
      v_price := public.flight_box_price(v_item->'flight_choices');
    end if;

    if coalesce(v_track_inventory, false) and v_inventory_quantity < v_quantity then
      raise exception 'Not enough inventory available';
    end if;

    v_total := v_total + v_price * v_quantity;
    if v_tax_category = 'general_product' then
      v_general_product_total := v_general_product_total + v_price * v_quantity;
    else
      v_home_bakery_total := v_home_bakery_total + v_price * v_quantity;
    end if;
    v_item_count := v_item_count + v_quantity;
    v_requested := v_requested + v_capacity_units * v_quantity;
  end loop;

  if v_item_count <= 0 then
    raise exception 'Order must contain at least one item';
  end if;

  if v_current + v_requested > v_capacity then
    raise exception 'Not enough capacity';
  end if;

  v_coupon_code := upper(trim(coalesce(p_coupon_code, '')));
  v_coupon_applies_to := null;
  v_bundle_discount := public.product_bundle_discount(p_items);
  v_discount := v_bundle_discount;

  if v_reward_type is not null and v_coupon_code <> '' then
    raise exception 'Rewards cannot be combined with a coupon code';
  end if;

  if v_reward_type is not null then
    perform pg_advisory_xact_lock(hashtext('customer-reward:' || v_phone));

    select *
    into v_reward_status
    from public.get_customer_rewards(v_phone);

    if v_reward_type = 'bread' then
      if coalesce(v_reward_status.bread_rewards_available, 0) < 1 then
        raise exception 'A bread reward is no longer available for this phone number';
      end if;

      select max(p.price_cents)
      into v_reward_discount
      from jsonb_array_elements(p_items) item
      join public.products p on p.id = (item->>'product_id')::uuid
      where lower(trim(p.name)) = 'classic white'
        and (item->>'quantity')::integer > 0;

      if coalesce(v_reward_discount, 0) <= 0 then
        raise exception 'Add a Classic White loaf to use a bread reward';
      end if;
    else
      select least(
        1200,
        coalesce(sum(p.price_cents * (item->>'quantity')::integer), 0)::integer
      )
      into v_reward_discount
      from jsonb_array_elements(p_items) item
      join public.products p on p.id = (item->>'product_id')::uuid
      where (
        lower(trim(coalesce(p.display_group, ''))) = 'homemade granola'
        or lower(trim(p.name)) like '%granola%'
        or lower(trim(p.name)) like 'toasted coconut almond%'
      )
        and (item->>'quantity')::integer > 0;

      if coalesce(v_reward_discount, 0) <= 0 then
        raise exception 'Add a granola bag to use a granola reward';
      end if;
    end if;

    v_discount := v_discount + v_reward_discount;
  end if;

  if v_coupon_code <> '' then
    select *
    into v_coupon
    from public.validate_coupon_code(
      v_coupon_code,
      greatest(v_total - v_bundle_discount, 0),
      v_fulfillment_method,
      p_items
    );

    v_coupon_code := v_coupon.code;
    v_coupon_applies_to := v_coupon.applies_to;
    v_discount := v_bundle_discount + v_coupon.discount_cents;
  else
    v_coupon_code := null;
  end if;

  if v_bundle_discount > 0 or v_reward_discount > 0 then
    v_coupon_applies_to := 'items';
  end if;

  select *
  into v_totals
  from public.calculate_order_totals(
    v_total,
    v_home_bakery_total,
    v_general_product_total,
    v_discount,
    v_coupon_applies_to,
    v_fulfillment_method,
    case
      when v_fulfillment_method = 'shipping' then regexp_replace(v_shipping_address, '^.*, ([A-Za-z]{2}) [0-9-]+$', '\1')
      else null
    end
  );

  insert into orders (
    pickup_date_id,
    customer_name,
    customer_email,
    customer_phone,
    notes,
    payment_method,
    invoice_requested,
    coupon_code,
    coupon_applies_to,
    reward_type,
    reward_discount_cents,
    subtotal_cents,
    discount_cents,
    tip_cents,
    tax_cents,
    shipping_cents,
    total_cents,
    total_loaves,
    fulfillment_method,
    shipping_address
  )
  values (
    p_pickup_date_id,
    trim(p_customer_name),
    nullif(trim(coalesce(p_customer_email, '')), ''),
    trim(p_customer_phone),
    nullif(p_notes, ''),
    p_payment_method,
    coalesce(p_invoice_requested, false),
    v_coupon_code,
    v_coupon_applies_to,
    v_reward_type,
    v_reward_discount,
    v_total,
    v_discount,
    v_tip,
    v_totals.tax_cents,
    v_totals.shipping_cents,
    v_totals.final_total_cents + v_tip,
    v_requested,
    v_fulfillment_method,
    case when v_fulfillment_method = 'shipping' then v_shipping_address else null end
  )
  returning id into v_order_id;

  select orders.order_code
  into v_order_code
  from orders
  where id = v_order_id;

  for v_item in
    select * from jsonb_array_elements(p_items)
  loop
    perform public.adjust_product_inventory(
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::integer
    );

    select price_cents, product_type
    into v_price, v_product_type
    from products
    where id = (v_item->>'product_id')::uuid;

    v_item_note := nullif(trim(coalesce(v_item->>'item_note', '')), '');

    if v_product_type = 'flight_box' then
      v_price := public.flight_box_price(v_item->'flight_choices');
      v_item_note := concat_ws(E'\n', public.flight_box_description(v_item->'flight_choices'), v_item_note);
    end if;

    insert into order_items (
      order_id,
      product_id,
      item_note,
      quantity,
      unit_price_cents
    )
    values (
      v_order_id,
      (v_item->>'product_id')::uuid,
      v_item_note,
      (v_item->>'quantity')::integer,
      v_price
    );
  end loop;

  return query select v_order_id, v_order_code, v_totals.final_total_cents + v_tip;
end;
$$;

create or replace function public.admin_save_coupon(
  p_original_code text,
  p_code text,
  p_description text,
  p_applies_to text,
  p_discount_type text,
  p_percent_off integer,
  p_amount_off_cents integer,
  p_minimum_subtotal_cents integer,
  p_starts_on date,
  p_ends_on date,
  p_max_uses integer,
  p_active boolean
)
returns table(saved_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_original_code text;
  v_code text;
  v_applies_to text;
  v_discount_type text;
  v_used_count integer;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  v_original_code := nullif(upper(trim(coalesce(p_original_code, ''))), '');
  v_code := upper(trim(coalesce(p_code, '')));
  v_applies_to := lower(trim(coalesce(p_applies_to, 'items')));
  v_discount_type := lower(trim(coalesce(p_discount_type, '')));

  if v_code = '' then
    raise exception 'Coupon code is required';
  end if;

  if v_code !~ '^[A-Z0-9_&-]+$' then
    raise exception 'Coupon code can only use letters, numbers, ampersands, underscores, and dashes';
  end if;

  if v_discount_type not in ('percent', 'amount') then
    raise exception 'Discount type must be percent or amount';
  end if;

  if v_applies_to not in ('items', 'shipping', 'order') then
    raise exception 'Coupon must apply to items, shipping, or whole order';
  end if;

  if v_discount_type = 'percent' and coalesce(p_percent_off, 0) not between 1 and 100 then
    raise exception 'Percent coupons need a percent from 1 to 100';
  end if;

  if v_discount_type = 'amount' and coalesce(p_amount_off_cents, 0) <= 0 then
    raise exception 'Dollar amount coupons need an amount greater than zero';
  end if;

  if p_starts_on is not null and p_ends_on is not null and p_starts_on > p_ends_on then
    raise exception 'Start date must be before end date';
  end if;

  if p_max_uses is not null and p_max_uses <= 0 then
    raise exception 'Max uses must be blank or greater than zero';
  end if;

  if v_original_code is not null and v_original_code <> v_code then
    select count(*)::integer
    into v_used_count
    from public.orders
    where coupon_code = v_original_code;

    if v_used_count > 0 then
      raise exception 'Coupon code cannot be renamed after it has been used';
    end if;

    delete from public.coupons
    where code = v_original_code;
  end if;

  insert into public.coupons (
    code,
    description,
    applies_to,
    discount_type,
    percent_off,
    amount_off_cents,
    minimum_subtotal_cents,
    starts_on,
    ends_on,
    max_uses,
    active
  )
  values (
    v_code,
    nullif(trim(coalesce(p_description, '')), ''),
    v_applies_to,
    v_discount_type,
    case when v_discount_type = 'percent' then p_percent_off else null end,
    case when v_discount_type = 'amount' then p_amount_off_cents else null end,
    greatest(coalesce(p_minimum_subtotal_cents, 0), 0),
    p_starts_on,
    p_ends_on,
    p_max_uses,
    coalesce(p_active, true)
  )
  on conflict (code)
  do update set
    description = excluded.description,
    applies_to = excluded.applies_to,
    discount_type = excluded.discount_type,
    percent_off = excluded.percent_off,
    amount_off_cents = excluded.amount_off_cents,
    minimum_subtotal_cents = excluded.minimum_subtotal_cents,
    starts_on = excluded.starts_on,
    ends_on = excluded.ends_on,
    max_uses = excluded.max_uses,
    active = excluded.active;

  return query select v_code;
end;
$$;

revoke all on function public.validate_coupon_code(text,integer,text,jsonb) from public;
grant execute on function public.validate_coupon_code(text,integer,text,jsonb) to anon, authenticated;

-- Issue the wedding gift against the store's single focaccia product.
do $$
declare
  v_product_id uuid;
  v_matches integer;
begin
  select count(*) into v_matches
  from public.products p
  where not p.archived and p.product_type <> 'flight_box'
    and (p.name ilike '%focaccia%' or p.display_group ilike '%focaccia%');
  if v_matches <> 1 then
    raise exception 'Expected exactly one focaccia product; found %. Select the intended product before issuing this gift.', v_matches;
  end if;
  select p.id into v_product_id
  from public.products p
  where not p.archived and p.product_type <> 'flight_box'
    and (p.name ilike '%focaccia%' or p.display_group ilike '%focaccia%');

  insert into public.coupons(code, description, applies_to, discount_type,
    percent_off, amount_off_cents, minimum_subtotal_cents, ends_on,
    max_uses, active, required_product_id)
  values('K&C-LAW', 'Wedding gift: one complimentary focaccia. Single use through January 31, 2027.',
    'items', 'percent', 100, null, 0, date '2027-01-31', 1, true, v_product_id)
  on conflict (code) do update
    set description = excluded.description, applies_to = excluded.applies_to,
      discount_type = excluded.discount_type, percent_off = excluded.percent_off,
      amount_off_cents = excluded.amount_off_cents, minimum_subtotal_cents = 0,
      starts_on = null, ends_on = excluded.ends_on, max_uses = 1,
      active = true, required_product_id = excluded.required_product_id;
end;
$$;

notify pgrst, 'reload schema';
commit;
