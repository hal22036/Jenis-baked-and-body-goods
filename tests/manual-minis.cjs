const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const root = process.cwd();
  const browser = await chromium.launch({ headless: true, channel: process.env.TEST_BROWSER_CHANNEL || "chrome" });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = [];
  await page.clock.setFixedTime(new Date("2026-10-19T17:00:00Z"));
  page.on("pageerror", error => errors.push(error.message));
  const html = fs.readFileSync(path.join(root, "admin.html"), "utf8")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")
    .replace(/<link\b[^>]*>/g, "")
    .replace(/<img\b[^>]*>/g, "");
  await page.setContent(html);
  await page.addStyleTag({ content: fs.readFileSync(path.join(root, "styles.css"), "utf8") });
  await page.addStyleTag({ content: fs.readFileSync(path.join(root, "admin.css"), "utf8") });
  await page.evaluate(() => {
    window.fixture = {
      extras: [{ id: "extra-1", batch_id: "batch-1", pickup_date_id: "date-1", pickup_date: "2026-10-23",
        product_id: "bread-1", item_name: "Classic White", batch_name: "Samples",
        quantity: 3, capacity_units: 1, is_flight_box: false, note: "No coconut" }],
      calls: []
    };
    window.supabase = { createClient: () => ({
      rpc: async (name, args) => {
        fixture.calls.push({ name, args });
        if (name === "admin_list_orders") return { data: [], error: null };
        if (name === "admin_list_extra_bake_items") return { data: fixture.extras, error: null };
        if (name === "admin_list_pickup_dates") return { data: [{
          id: "date-1", pickup_date: "2026-10-23", capacity: 14, ordered_count: 3, is_open: true
        }, { id: "past-1", pickup_date: "2026-10-16", capacity: 14, is_open: true },
        { id: "closed-1", pickup_date: "2026-11-06", capacity: 14, is_open: false }], error: null };
        if (name === "admin_save_extra_bake_batch_with_date") {
          if (fixture.rejectSave) return { error: { message: "Not enough loaf spots" } };
          fixture.extras = args.p_items.map((item, index) => ({
            ...item, id: "extra-" + index, batch_id: args.p_batch_id || "batch-1",
            batch_name: args.p_batch_name, pickup_date_id: args.p_pickup_date_id || "special-1",
            pickup_date: args.p_special_pickup_date || "2026-10-23", is_flight_box: false,
            item_name: item.product_id === "bread-1" ? "Classic White" : item.product_id === "treat-1" ? "Honey Butter - 8 oz" : item.item_name
          }));
          return { data: "batch-1", error: null };
        }
        if (name === "admin_remove_extra_bake_batch") {
          fixture.extras = [];
          return { data: null, error: null };
        }
        throw new Error("Unexpected RPC: " + name);
      }
    }) };
  });
  const source = fs.readFileSync(path.join(root, "admin.js"), "utf8").replace(/boot\(\);\s*$/, "");
  await page.addScriptTag({ content: source });
  await page.evaluate(async () => {
    await loadPickupDates();
    state.products = [{ id: "bread-1", name: "Classic White", category: "Everyday",
      capacity_units: 1, price_cents: 1000, active: true, label_ingredients: "Ingredients: Flour, water, salt.",
      label_net_weight: "910 g" }, {
        id: "treat-1", name: "Honey Butter - 8 oz", category: "Other Delicious Treats",
        display_group: "Honey Butter", option_label: "8 oz", capacity_units: 0, active: true
      }];
    refreshManualProductSelects();
    await loadOrders();
    el.adminPanel.hidden = false;
    el.loginPanel.hidden = true;
  });

  const result = await page.evaluate(() => {
    state.products[0].flight_eligible=true;
    state.products[0].mini_price_cents=700;
    state.products.push({id:"flight",name:"Mini Loaf Flight Box",product_type:"flight_box",price_cents:3500,capacity_units:1,category:"Specials",active:true});
    refreshManualProductSelects();
    const row=el.manualItemsList.firstElementChild;
    const select=row.querySelector("[data-manual-product-select]");
    select.value="flight";
    select.dispatchEvent(new Event("change",{bubbles:true}));
    const choices=[...row.querySelectorAll("[data-manual-flight-choice]")];
    choices.forEach(s=>s.value="bread-1");
    const flight=manualOrderItems()[0];
    select.value="mini:bread-1";
    select.dispatchEvent(new Event("change",{bubbles:true}));
    return {count:choices.length,flight,mini:manualOrderItems()[0]};
  });
  assert.equal(result.count,4);
  assert.equal(result.flight.unit_price_cents,2800);
  assert.match(result.flight.item_note,/Loaf 4: Classic White/);
  assert.equal(result.mini.unit_price_cents,700);
  assert.equal(result.mini.name,"Classic White - Mini");
  assert.equal(result.mini.product_id,null);
  assert.deepEqual(errors,[]);
  await browser.close();
  console.log("Passed: flight choices, calculated price, notes, and individual mini sale.");
})().catch(error => { console.error(error); process.exit(1); });
