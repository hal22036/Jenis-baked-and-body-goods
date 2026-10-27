-- Add a separate seasonal product without changing regular Honey Butter.
begin;
do $$
declare v_source public.products%rowtype; v_name text;
begin
  if not exists(select 1 from public.products where lower(trim(display_group))='honey butter' and active and not archived) then
    raise exception 'No currently offered regular Honey Butter sizes were found';
  end if;
  for v_source in select * from public.products
    where lower(trim(display_group))='honey butter' and active and not archived
    order by sort_order,price_cents,id
  loop
    if nullif(trim(v_source.option_label),'') is null then raise exception 'Regular Honey Butter needs size labels'; end if;
    v_name := 'Pumpkin Spice Honey Butter - ' || trim(v_source.option_label);
    update public.products set price_cents=v_source.price_cents,capacity_units=0,
      category=v_source.category,display_group='Pumpkin Spice Honey Butter',option_label=v_source.option_label,
      image_url='assets/pump_spice_honey_butter.png',tax_category=v_source.tax_category,
      shippable=v_source.shippable,sort_order=v_source.sort_order,active=true,archived=false
    where name=v_name;
    if not found then
      insert into public.products(name,description,price_cents,capacity_units,category,display_group,option_label,
        image_url,tax_category,shippable,track_inventory,active,archived,sort_order,label_net_weight)
      values(v_name,'Pumpkin Spice Honey Butter.',v_source.price_cents,0,v_source.category,'Pumpkin Spice Honey Butter',
        v_source.option_label,'assets/pump_spice_honey_butter.png',v_source.tax_category,v_source.shippable,
        false,true,false,v_source.sort_order,v_source.label_net_weight);
    end if;
  end loop;
end;
$$;
notify pgrst, 'reload schema';
commit;
