-- Run in Supabase SQL Editor. Retired products are archived, never deleted.
-- Scrubs and bath bombs copy the current hand-soap scent list and are made to order.
begin;
do $$
declare
  v_kind record;
  v_scent record;
  v_template public.products%rowtype;
  v_product_id uuid;
  v_keep uuid[];
  v_ingredients text;
  v_default_price integer;
begin
  if not exists (
    select 1 from public.products p
    where lower(trim(p.display_group)) = 'foaming hand soap'
      and not p.archived and nullif(trim(p.option_label), '') is not null
  ) then
    raise exception 'No current hand-soap scents were found. Update the hand-soap products first.';
  end if;
  if exists (
    select lower(trim(p.option_label)) from public.products p
    where lower(trim(p.display_group)) = 'foaming hand soap'
      and not p.archived and nullif(trim(p.option_label), '') is not null
    group by lower(trim(p.option_label)) having count(*) > 1
  ) then
    raise exception 'Duplicate hand-soap scent names were found. Keep one current soap product per scent.';
  end if;

  for v_kind in select * from (values
    ('scrub', 'Whipped Sugar Scrub', 'assets/sugar_scrub.png',
      'Ingredients: Glycerin, Water, Sodium Cocoyl Isethionate, Sorbitol, Propylene Glycol, Disodium Lauryl Sulfosuccinate, Stearic Acid, Sodium Chloride, Diazolidinyl Urea (and) Iodopropynyl Butylcarbamate, Regular Granulated Sugar, Sunflower Oil, IFRA-compliant Fragrance Oil, Vitamin E Oil, Mica Powder. Caution: For external use only. Not for consumption. Avoid contact with eyes. Discontinue use if irritation occurs.'),
    ('bomb', 'Bath Bombs', 'assets/bath_bombs.png',
      'Ingredients: Baking Soda, Citric Acid, Cornstarch, Epsom Salt, Kaolin Clay, Sunflower Oil, Polysorbate 80, Witch Hazel, IFRA-compliant Fragrance Oil, Mica Colorant, Isopropyl Alcohol. Caution: For external use only. Not for consumption. Avoid contact with eyes. Discontinue use if irritation occurs.')
  ) as kinds(kind, group_name, image_url, ingredients)
  loop
    v_keep := array[]::uuid[];
    select p.* into v_template from public.products p
    where (
      (v_kind.kind = 'scrub' and (lower(trim(p.display_group)) in ('whipped sugar scrub', 'sugar scrub', 'whipped sugar scrubs')
        or lower(p.name) like 'whipped sugar scrub%'))
      or (v_kind.kind = 'bomb' and (lower(trim(p.display_group)) in ('bath bombs', 'bath bomb') or lower(p.name) like 'bath bomb%'))
    )
      and (v_kind.kind <> 'scrub' or concat_ws(' ', p.name, p.option_label, p.label_net_weight) !~* '(^|[^0-9])8[[:space:]]*oz')
    order by p.archived, not p.active,
      (concat_ws(' ', p.name, p.option_label, p.label_net_weight) ~* '(^|[^0-9])4[[:space:]]*oz') desc,
      p.price_cents, p.id
    limit 1;
    v_default_price := coalesce(v_template.price_cents, 500);
    v_ingredients := coalesce(nullif(trim(v_template.label_ingredients), ''), v_kind.ingredients);

    for v_scent in
      select trim(p.option_label) as name, p.description as scent_notes, p.sort_order
      from public.products p
      where lower(trim(p.display_group)) = 'foaming hand soap'
        and not p.archived and nullif(trim(p.option_label), '') is not null
      order by p.sort_order, p.option_label
    loop
      v_product_id := null;
      select p.id into v_product_id from public.products p
      where (
        (v_kind.kind = 'scrub' and (lower(trim(p.display_group)) in ('whipped sugar scrub', 'sugar scrub', 'whipped sugar scrubs')
          or lower(p.name) like 'whipped sugar scrub%'))
        or (v_kind.kind = 'bomb' and (lower(trim(p.display_group)) in ('bath bombs', 'bath bomb') or lower(p.name) like 'bath bomb%'))
      )
        and (v_kind.kind <> 'scrub' or concat_ws(' ', p.name, p.option_label, p.label_net_weight) !~* '(^|[^0-9])8[[:space:]]*oz')
        and (
          lower(trim(regexp_replace(coalesce(p.option_label, ''), '^[[:space:]]*[0-9]+([.][0-9]+)?[[:space:]]*oz[[:space:]:-]*', '', 'i'))) = lower(v_scent.name)
          or lower(trim(p.name)) = lower(v_kind.group_name || ' - ' || v_scent.name)
          or lower(trim(p.name)) = lower(v_kind.group_name || ' - 4 oz - ' || v_scent.name)
        )
      order by p.archived, not p.active, p.id
      limit 1;

      if v_product_id is null then
        insert into public.products(name, description, price_cents, capacity_units,
          category, display_group, option_label, image_url, label_ingredients,
          label_net_weight, shippable, tax_category, track_inventory, inventory_quantity,
          inventory_group, active, archived, sort_order)
        values(v_kind.group_name || ' - 4 oz - ' || v_scent.name, v_scent.scent_notes,
          v_default_price, 0, 'Bath & Body', v_kind.group_name, v_scent.name,
          v_kind.image_url, v_ingredients, '4 oz (113 g)',
          coalesce(v_template.shippable, false), 'general_product', false, 0,
          null, true, false, v_scent.sort_order)
        returning id into v_product_id;
      else
        -- Keep the existing product ID and price for prior orders.
        update public.products set
          description = v_scent.scent_notes, capacity_units = 0, category = 'Bath & Body',
          display_group = v_kind.group_name, option_label = v_scent.name,
          image_url = v_kind.image_url, label_ingredients = v_ingredients,
          label_net_weight = '4 oz (113 g)', tax_category = 'general_product',
          track_inventory = false, inventory_group = null,
          active = true, archived = false, sort_order = v_scent.sort_order
        where id = v_product_id;
      end if;
      v_keep := array_append(v_keep, v_product_id);
    end loop;

    update public.products p set active = false, archived = true
    where (
      (v_kind.kind = 'scrub' and (lower(trim(p.display_group)) in ('whipped sugar scrub', 'sugar scrub', 'whipped sugar scrubs')
        or lower(p.name) like 'whipped sugar scrub%'))
      or (v_kind.kind = 'bomb' and (lower(trim(p.display_group)) in ('bath bombs', 'bath bomb') or lower(p.name) like 'bath bomb%'))
    ) and not (p.id = any(v_keep));
  end loop;
end;
$$;
notify pgrst, 'reload schema';
commit;
