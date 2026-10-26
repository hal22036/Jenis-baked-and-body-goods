-- Spa boxes consume one unit of the existing shared hand-soap inventory.
begin;
do $$
declare v_stock integer; v_group text; v_count integer; v_price integer; v_ingredients text;
begin
  select inventory_group into v_group from public.products
  where lower(trim(display_group)) = 'foaming hand soap' and track_inventory
    and nullif(trim(inventory_group), '') is not null limit 1;
  if v_group is null then raise exception 'Configure shared hand-soap inventory before adding spa boxes'; end if;
  perform 1 from public.products where inventory_group = v_group order by id for update;
  select min(inventory_quantity) into v_stock from public.products where inventory_group = v_group and track_inventory;
  select string_agg(kind || ': ' || ingredients, E'\n') into v_ingredients from (
    select distinct on (lower(trim(display_group))) display_group as kind, label_ingredients as ingredients
    from public.products where lower(trim(display_group)) in ('foaming hand soap','whipped sugar scrub','bath bombs')
      and not archived and nullif(trim(label_ingredients),'') is not null
    order by lower(trim(display_group)), id
  ) ingredients;
  for v_count in 1..3 loop
    v_price := 1800 + (v_count - 1) * 400;
    update public.products set price_cents=v_price, description='One 8 oz foaming hand soap, one 4 oz sugar scrub, and ' || v_count || ' four-ounce bath bomb' || case when v_count=1 then '.' else 's.' end,
      category='Bath & Body', display_group='Spa Gift Box', option_label=v_count || ' bath bomb' || case when v_count=1 then '' else 's' end,
      image_url='assets/spa_gift_box_3.png', label_ingredients=v_ingredients,
      track_inventory=true, inventory_group=v_group, inventory_quantity=v_stock,
      capacity_units=0, tax_category='general_product', active=true, archived=false, sort_order=v_count
    where name='Spa Gift Box - ' || v_count || ' bath bomb' || case when v_count=1 then '' else 's' end;
    if not found then
      insert into public.products(name,price_cents,description,category,display_group,option_label,image_url,label_ingredients,
        capacity_units,tax_category,track_inventory,inventory_group,inventory_quantity,active,archived,sort_order,shippable)
      values('Spa Gift Box - ' || v_count || ' bath bomb' || case when v_count=1 then '' else 's' end,v_price,
        'One 8 oz foaming hand soap, one 4 oz sugar scrub, and ' || v_count || ' four-ounce bath bomb' || case when v_count=1 then '.' else 's.' end,
        'Bath & Body','Spa Gift Box',v_count || ' bath bomb' || case when v_count=1 then '' else 's' end,
        'assets/spa_gift_box_3.png',v_ingredients,0,'general_product',true,v_group,v_stock,true,false,v_count,false);
    end if;
  end loop;
end;
$$;
notify pgrst, 'reload schema';
commit;
