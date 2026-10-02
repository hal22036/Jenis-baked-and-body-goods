-- Run this file in the Supabase SQL Editor after supabase.sql.
-- It is safe to run more than once: existing products are updated by name and
-- missing products are inserted.

begin;

-- Correct active bread descriptions and names that currently contain typos,
-- missing allergens, or ingredients copied from another loaf.
update public.products
set description = E'Ingredients: Bread Flour (Bleached Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Sourdough Starter (Bread Flour, Water), Butter, Brown Sugar, Cinnamon, Milk, Powdered Sugar, Salt, Olive or Avocado Oil.\nContains: Wheat, Milk.'
where id = '01fab002-d921-4c71-9e44-e55ee43dd828';

update public.products
set description = E'Ingredients: Bread Flour (Bleached Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Sourdough Starter (Bread Flour, Water), Mozzarella Cheese, Parmesan Cheese, Everything Bagel Seasoning, Salt, Olive or Avocado Oil.\nContains: Wheat, Milk, Sesame.'
where id = '3318bb3c-c605-499b-9e13-d27bd4ff9ad9';

update public.products
set description = E'Ingredients: Bread Flour (Bleached Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Whole Wheat Flour, Water, Sourdough Starter (Bread Flour, Water), Honey, Rolled Oats, Salt, Olive or Avocado Oil.\nContains: Wheat.'
where id = '263b6244-0eb3-4dc7-ba1c-1e1aed04d96b';

update public.products
set description = E'Ingredients: Bread Flour (Bleached Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Sourdough Starter (Bread Flour, Water), Sharp Cheddar Cheese, Hot Honey, Olive or Avocado Oil, Red Pepper Flakes, Salt, Black Pepper.\nContains: Wheat, Milk.'
where id = 'fc14e979-e10f-4bc4-ba3b-f005a9d21236';

update public.products
set description = E'Ingredients: Bread Flour (Bleached Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Sourdough Starter (Bread Flour, Water), Mozzarella Cheese, Parmesan Cheese, Olive or Avocado Oil, Italian Seasoning, Garlic Powder, Onion Powder, Dried Oregano, Salt.\nContains: Wheat, Milk.'
where id = '2ebc6580-1177-4b8b-93cb-e189a491bd57';

update public.products
set description = E'8x8 Ingredients: Bread Flour (Bleached Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Sourdough Starter (Bread Flour, Water), Olive or Avocado Oil, Minced Garlic, Butter, Garlic Powder, Dried Rosemary, Dried Oregano, Parsley, Flaky Sea Salt, Salt.\nContains: Wheat, Milk.'
where id = 'e1481315-234b-4849-8641-49ba603ccfbf';

update public.products
set description = E'Ingredients: Bread Flour (Bleached Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Sourdough Starter (Bread Flour, Water), White Chocolate Chips, Craisins, Olive or Avocado Oil, Salt.\nContains: Wheat, Milk, Soy.'
where id = '2e201826-4b19-4e34-8376-b95c427022c3';

update public.products
set description = E'Ingredients: Bread Flour (Bleached Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Sourdough Starter (Bread Flour, Water), Olive or Avocado Oil, Salt.\nContains: Wheat.'
where id = 'a7462cc2-6320-4c61-b9ac-053368cb418b';

update public.products
set description = E'Ingredients: Bread Flour (Bleached Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Sourdough Starter (Bread Flour, Water), Brown Sugar, Sliced Almonds, Unsweetened Coconut, Olive or Avocado Oil, Almond Extract, Coconut Extract, Salt.\nContains: Wheat, Tree Nuts (Almonds).'
where id = '135cf8c8-efd8-46f4-9859-1e26f8357e5a';

update public.products
set name = 'Double Chocolate',
    description = E'Ingredients: Bread Flour (Bleached Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Sourdough Starter (Bread Flour, Water), Chocolate Chips, Cocoa Powder, Brown Sugar, Salt.\nContains: Wheat, Milk, Soy.'
where id = '6d500e45-b379-47fa-9e49-c9e7ff053db7';

update public.products
set description = E'Ingredients: Bread Flour (Bleached Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Sourdough Starter (Bread Flour, Water), Chocolate Chips, Brown Sugar, Sliced Almonds, Unsweetened Coconut, Olive or Avocado Oil, Almond Extract, Coconut Extract, Salt.\nContains: Wheat, Milk, Soy, Tree Nuts (Almonds).'
where id = 'c84068ab-3b17-4586-b9e4-1a3e00a55956';

update public.products
set name = 'Jalapeño Pepper Jack',
    description = E'Ingredients: Bread Flour (Bleached Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Sourdough Starter (Bread Flour, Water), Pepper Jack Cheese, Jalapeños, Olive or Avocado Oil, Salt.\nContains: Wheat, Milk.'
where id = '38abab70-82d0-4186-8390-12f266804858';

update public.products
set description = E'Ingredients: Bread Flour (Bleached Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Sourdough Starter (Bread Flour, Water), Raisins, Brown Sugar, Cinnamon, Olive or Avocado Oil, Salt.\nContains: Wheat.'
where id = '0692d261-5fce-4e46-8448-005b18e5123f';

-- This update also repairs Pepperoni Pizza when the product is currently
-- inactive or archived and therefore is not visible through the public API.
update public.products
set description = E'Ingredients: Bread Flour (Bleached Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Sourdough Starter (Bread Flour, Water), Pepperoni, Mozzarella Cheese, Pepper Jack Cheese, Parmesan Cheese, Olive or Avocado Oil, Italian Seasoning, Garlic Powder, Salt.\nContains: Wheat, Milk.'
where lower(trim(name)) = 'pepperoni pizza';

create temporary table jbg_new_loaves (
  name text primary key,
  description text not null,
  price_cents integer not null,
  capacity_units integer not null,
  category text not null,
  display_group text,
  option_label text,
  image_url text,
  shippable boolean not null,
  tax_category text not null,
  track_inventory boolean not null,
  inventory_quantity integer not null,
  active boolean not null,
  archived boolean not null,
  sort_order integer not null
) on commit drop;

insert into jbg_new_loaves values
  (
    'Raspberry White Chocolate',
    E'Ingredients: Bread Flour (Bleached Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Sourdough Starter (Bread Flour, Water), White Chocolate Chips, Raspberries, Brown Sugar, Olive or Avocado Oil, Vanilla Extract, Raspberry Oil, Salt.\nContains: Wheat, Milk, Soy.',
    1800, 1, 'Sweet', null, null, null, false, 'home_bakery', false, 0, true, false, 10
  ),
  (
    'Light Banana Sourdough',
    E'Ingredients: Bread Flour (Bleached Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Sourdough Starter (Bread Flour, Water), Banana, Brown Sugar, Olive or Avocado Oil, Vanilla Extract, Banana Extract, Cinnamon, Salt.\nContains: Wheat.',
    1200, 1, 'Sweet', 'Banana Sourdough', 'Plain', 'assets/banana.png', false, 'home_bakery', false, 0, true, false, 1
  ),
  (
    'Banana White Chocolate',
    E'Ingredients: Bread Flour (Bleached Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Sourdough Starter (Bread Flour, Water), Banana, White Chocolate Chips, Brown Sugar, Olive or Avocado Oil, Vanilla Extract, Banana Extract, Cinnamon, Salt.\nContains: Wheat, Milk, Soy.',
    1700, 1, 'Sweet', 'Banana Sourdough', 'White Chocolate', 'assets/banana.png', false, 'home_bakery', false, 0, true, false, 2
  ),
  (
    'Banana Chocolate Chip',
    E'Ingredients: Bread Flour (Bleached Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Sourdough Starter (Bread Flour, Water), Banana, Chocolate Chips, Brown Sugar, Olive or Avocado Oil, Vanilla Extract, Banana Extract, Cinnamon, Salt.\nContains: Wheat, Milk, Soy.',
    1500, 1, 'Sweet', 'Banana Sourdough', 'Chocolate Chip', 'assets/banana.png', false, 'home_bakery', false, 0, true, false, 3
  ),
  (
    'Banana Pecan',
    E'Ingredients: Bread Flour (Bleached Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Sourdough Starter (Bread Flour, Water), Banana, Pecans, Brown Sugar, Olive or Avocado Oil, Vanilla Extract, Banana Extract, Cinnamon, Salt.\nContains: Wheat, Tree Nuts (Pecans).',
    1800, 1, 'Sweet', 'Banana Sourdough', 'Pecan', 'assets/banana.png', false, 'home_bakery', false, 0, true, false, 4
  ),
  (
    'Lemon Raspberry White Chocolate',
    E'Ingredients: Bread Flour (Bleached Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Sourdough Starter (Bread Flour, Water), White Chocolate Chips, Raspberries, Sugar, Olive or Avocado Oil, Vanilla Extract, Lemon Oil, Salt.\nContains: Wheat, Milk, Soy.',
    1900, 1, 'Sweet', null, null, null, false, 'home_bakery', false, 0, true, false, 11
  ),
  (
    'Lemon White Chocolate',
    E'Ingredients: Bread Flour (Bleached Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Sourdough Starter (Bread Flour, Water), White Chocolate Chips, Sugar, Olive or Avocado Oil, Vanilla Extract, Lemon Oil, Salt.\nContains: Wheat, Milk, Soy.',
    1800, 1, 'Sweet', null, null, null, false, 'home_bakery', false, 0, true, false, 12
  ),
  (
    'Pumpkin White Chocolate',
    E'Ingredients: Bread Flour (Bleached Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Sourdough Starter (Bread Flour, Water), Pumpkin Puree, White Chocolate Chips, Brown Sugar, Olive or Avocado Oil, Pumpkin Pie Spice, Cinnamon, Vanilla Extract, Salt.\nContains: Wheat, Milk, Soy.',
    1700, 1, 'Sweet', 'Pumpkin Sourdough', 'White Chocolate', 'assets/pumpkin_chocolate_chip.png', false, 'home_bakery', false, 0, true, false, 1
  ),
  (
    'Pumpkin Chocolate Chip',
    E'Ingredients: Bread Flour (Bleached Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Sourdough Starter (Bread Flour, Water), Pumpkin Puree, Chocolate Chips, Brown Sugar, Olive or Avocado Oil, Pumpkin Pie Spice, Cinnamon, Vanilla Extract, Salt.\nContains: Wheat, Milk, Soy.',
    1500, 1, 'Sweet', 'Pumpkin Sourdough', 'Chocolate Chip', 'assets/pumpkin_chocolate_chip.png', false, 'home_bakery', false, 0, true, false, 2
  ),
  (
    'Pumpkin Pecan',
    E'Ingredients: Bread Flour (Bleached Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Sourdough Starter (Bread Flour, Water), Pumpkin Puree, Pecans, Brown Sugar, Olive or Avocado Oil, Pumpkin Pie Spice, Cinnamon, Vanilla Extract, Salt.\nContains: Wheat, Tree Nuts (Pecans).',
    1900, 1, 'Sweet', 'Pumpkin Sourdough', 'Pecan', 'assets/pumpkin_chocolate_chip.png', false, 'home_bakery', false, 0, true, false, 3
  ),
  (
    'Pumpkin Spice Streusel',
    E'Ingredients: Bread Flour (Bleached Wheat Flour, Malted Barley Flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid), Water, Sourdough Starter (Bread Flour, Water), Pumpkin Puree, Brown Sugar, Butter, Maple Syrup, Olive or Avocado Oil, Pumpkin Pie Spice, Cinnamon, Vanilla Extract, Salt.\nContains: Wheat, Milk.',
    1500, 1, 'Sweet', null, null, 'assets/pumpkin_spice.png', false, 'home_bakery', false, 0, true, false, 13
  );

-- Refresh matching rows first so rerunning this script also applies future
-- description, price, grouping, or image corrections.
update public.products as p
set
  description = c.description,
  price_cents = c.price_cents,
  capacity_units = c.capacity_units,
  category = c.category,
  display_group = c.display_group,
  option_label = c.option_label,
  image_url = c.image_url,
  shippable = c.shippable,
  tax_category = c.tax_category,
  track_inventory = c.track_inventory,
  inventory_quantity = case when p.track_inventory then p.inventory_quantity else c.inventory_quantity end,
  active = c.active,
  archived = c.archived,
  sort_order = c.sort_order
from jbg_new_loaves as c
where lower(trim(p.name)) = lower(c.name);

insert into public.products (
  name,
  description,
  price_cents,
  capacity_units,
  category,
  display_group,
  option_label,
  image_url,
  shippable,
  tax_category,
  track_inventory,
  inventory_quantity,
  active,
  archived,
  sort_order
)
select
  c.name,
  c.description,
  c.price_cents,
  c.capacity_units,
  c.category,
  c.display_group,
  c.option_label,
  c.image_url,
  c.shippable,
  c.tax_category,
  c.track_inventory,
  c.inventory_quantity,
  c.active,
  c.archived,
  c.sort_order
from jbg_new_loaves as c
where not exists (
  select 1
  from public.products as p
  where lower(trim(p.name)) = lower(c.name)
);

commit;

-- Verification query: this should return 11 new product rows. Banana and
-- pumpkin variants should share their display_group values.
select
  name,
  price_cents,
  category,
  display_group,
  option_label,
  active,
  archived
from public.products
where name in (
  'Raspberry White Chocolate',
  'Light Banana Sourdough',
  'Banana White Chocolate',
  'Banana Chocolate Chip',
  'Banana Pecan',
  'Lemon Raspberry White Chocolate',
  'Lemon White Chocolate',
  'Pumpkin White Chocolate',
  'Pumpkin Chocolate Chip',
  'Pumpkin Pecan',
  'Pumpkin Spice Streusel'
)
order by category, display_group nulls last, sort_order, name;
