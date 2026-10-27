begin;
do $$
declare v_flavor record; v_source public.products%rowtype;
begin
  for v_flavor in select * from (values ('Plain','Plain',1),('Chocolate','Chocolate',2),('Craisins','Craisins',3),('Craisins & Chocolate','Craisins and Chocolate',4)) f(label,source_label,position)
  loop
    select p.* into v_source from public.products p
    where lower(trim(p.display_group))='homemade granola'
      and (lower(trim(p.option_label))=lower(v_flavor.source_label)
        or lower(p.name) like '%with ' || lower(v_flavor.source_label)
        or lower(p.name) like '%- ' || lower(v_flavor.source_label))
    order by p.archived, p.id limit 1;
    if v_source.id is null then raise exception 'Missing full-size granola flavor: %',v_flavor.source_label; end if;
    update public.products set price_cents=400,capacity_units=0,category='Other Delicious Treats',
      display_group='Mini Granola Gift Pouches',option_label=v_flavor.label,image_url='assets/mini_granola_4oz.png',
      description=regexp_replace(v_source.description,'Homemade Granola[^' || chr(10) || chr(13) || ']*','Mini Granola Gift Pouches - 4 oz'),
      label_ingredients=coalesce(nullif(v_source.label_ingredients,''),substring(v_source.description from '(?is)Ingredients:.*')),label_net_weight='4 oz (113 g)',
      tax_category=v_source.tax_category,shippable=v_source.shippable,track_inventory=false,inventory_group=null,
      active=true,archived=false,sort_order=v_flavor.position
    where name='Mini Granola - ' || v_flavor.label;
    if not found then
      insert into public.products(name,price_cents,capacity_units,category,display_group,option_label,image_url,description,
        label_ingredients,label_net_weight,tax_category,shippable,track_inventory,active,archived,sort_order)
      values('Mini Granola - ' || v_flavor.label,400,0,'Other Delicious Treats','Mini Granola Gift Pouches',v_flavor.label,
        'assets/mini_granola_4oz.png',regexp_replace(v_source.description,'Homemade Granola[^' || chr(10) || chr(13) || ']*','Mini Granola Gift Pouches - 4 oz'),
        coalesce(nullif(v_source.label_ingredients,''),substring(v_source.description from '(?is)Ingredients:.*')),'4 oz (113 g)',v_source.tax_category,v_source.shippable,false,true,false,v_flavor.position);
    end if;
  end loop;
end;
$$;

-- Apply to the final order contents, including admin edits and multi-flavor orders.
create or replace function public.check_mini_granola_minimum()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_order uuid; v_count integer; v_orders uuid[];
begin
  if TG_TABLE_NAME='orders' then
    v_orders:=array[OLD.id,NEW.id];
  elsif TG_OP='INSERT' then
    v_orders:=array[NEW.order_id];
  elsif TG_OP='DELETE' then
    v_orders:=array[OLD.order_id];
  else
    v_orders:=array[OLD.order_id,NEW.order_id];
  end if;
  for v_order in select distinct id from unnest(v_orders) id where id is not null
  loop
    if not exists(select 1 from public.orders where id=v_order and fulfillment_status <> 'canceled') then continue; end if;
    select coalesce(sum(oi.quantity),0) into v_count from public.order_items oi
    join public.products p on p.id=oi.product_id
    where oi.order_id=v_order and lower(trim(p.display_group))='mini granola gift pouches';
    if v_count > 0 and v_count < 5 then
      raise exception 'Mini granola requires at least 5 pouches total. Mix and match any flavors.';
    end if;
  end loop;
  return null;
end;
$$;
revoke all on function public.check_mini_granola_minimum() from public;
drop trigger if exists mini_granola_minimum on public.order_items;
create constraint trigger mini_granola_minimum after insert or update or delete on public.order_items
  deferrable initially deferred for each row execute function public.check_mini_granola_minimum();
drop trigger if exists mini_granola_order_minimum on public.orders;
create constraint trigger mini_granola_order_minimum after update on public.orders
  deferrable initially deferred for each row execute function public.check_mini_granola_minimum();

-- Exclude minis from full-size granola reward earning and redemption.
do $$
declare v_function record; v_definition text; v_updated text;
begin
  for v_function in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('place_order','get_customer_rewards','admin_list_rewards')
  loop
    v_definition:=pg_get_functiondef(v_function.oid);
    v_updated:=replace(v_definition,
      'or lower(trim(p.name)) like ''%granola%''',
      'or (lower(trim(p.name)) like ''%granola%'' and lower(trim(p.name)) not like ''mini granola%'')');
    v_updated:=replace(v_updated,
      'or lower(trim(coalesce(p.name, oi.custom_name, ''''))) like ''%granola%''',
      'or (lower(trim(coalesce(p.name, oi.custom_name, ''''))) like ''%granola%'' and lower(trim(coalesce(p.name, oi.custom_name, ''''))) not like ''mini granola%'')');
    if v_updated <> v_definition then execute v_updated; end if;
  end loop;
end;
$$;
notify pgrst, 'reload schema';
commit;
