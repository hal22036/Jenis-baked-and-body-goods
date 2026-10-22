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
        }], error: null };
        if (name === "admin_save_extra_bake_batch") {
          if (fixture.rejectSave) return { error: { message: "Not enough loaf spots" } };
          fixture.extras = args.p_items.map((item, index) => ({
            ...item, id: "extra-" + index, batch_id: args.p_batch_id || "batch-1",
            batch_name: args.p_batch_name, pickup_date_id: args.p_pickup_date_id,
            pickup_date: "2026-10-23", is_flight_box: false,
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
    state.pickupDates = [{ id: "date-1", pickup_date: "2026-10-23", capacity: 14, ordered_count: 3, is_open: true }];
    state.products = [{ id: "bread-1", name: "Classic White", category: "Everyday",
      capacity_units: 1, price_cents: 1000, active: true, label_ingredients: "Ingredients: Flour, water, salt.",
      label_net_weight: "910 g" }, {
        id: "treat-1", name: "Honey Butter - 8 oz", category: "Other Delicious Treats",
        display_group: "Honey Butter", option_label: "8 oz", capacity_units: 0, active: true
      }];
    renderExtraBakeFormOptions();
    await loadOrders();
    el.adminPanel.hidden = false;
    el.loginPanel.hidden = true;
  });
  assert.equal(await page.locator(".extra-bake-row").count(), 1, "Extra-only dates must render without customer orders");
  assert.match(await page.locator(".baking-breakdown").innerText(), /Bread loaf orders[\s\S]*Classic White[\s\S]*3/);
  assert.doesNotMatch(await page.locator(".baking-breakdown").innerText(), /Extra bake items/);
  const combined = await page.evaluate(() => {
    const node = document.createElement("div");
    node.innerHTML = bakingBreakdownMarkup([{ total_cents: 2000, fulfillment_status: "new", items: [
      { name: "Classic White", capacity_units: 1, quantity: 2 }
    ] }], state.extraBakeItems);
    return { rows: [...node.querySelectorAll("tbody tr")].map(row => row.innerText), income: node.querySelector(".weekly-income").innerText };
  });
  assert.equal(combined.rows.length, 1);
  assert.match(combined.rows[0], /Classic White\s+5/);
  assert.match(combined.income, /\$20\.00/);
  assert.match(await page.locator(".weekly-income").innerText(), /\$0\.00/, "Extras must not increase income");
  await page.locator('[data-extra-bake-action="print"]').click();
  assert.equal(await page.locator("[data-order-label-index]").count(), 3, "Print one order tag per extra item");
  assert.equal(await page.locator("[data-label-note-index]").first().inputValue(), "No coconut");
  assert.equal(await page.locator("[data-ingredient-order-index]").count(), 3, "Include ingredient labels");
  await page.locator("#close-label-review").click();
  await page.locator('[data-print-labels="baked"]').click();
  assert.equal(await page.locator("[data-order-label-index]").count(), 3, "Batch print must include extras");
  await page.locator("#close-label-review").click();
  await page.locator('[data-extra-bake-action="edit"]').click();
  await page.locator("[data-extra-quantity]").fill("4");
  assert.match(await page.locator("#extra-bake-total").innerText(), /4 loaf spots/);
  await page.locator("[data-extra-note]").fill("For samples");
  await page.locator("#extra-bake-add-item").click();
  await page.locator("[data-extra-product]").nth(1).selectOption("treat-1");
  await page.locator("[data-extra-quantity]").nth(1).fill("2");
  assert.match(await page.locator("#extra-bake-total").innerText(), /4 loaf spots/);
  await page.evaluate(() => { fixture.rejectSave = true; });
  await page.locator('#extra-bake-form [type="submit"]').click();
  await page.waitForFunction(() => document.querySelector("#extra-bake-message").textContent === "Not enough loaf spots");
  assert.equal(await page.locator("[data-extra-row]").count(), 2, "Failed save retains all draft items");
  assert.equal(await page.evaluate(() => fixture.extras[0].quantity), 3, "Failed save retains old batch");
  await page.evaluate(() => { fixture.rejectSave = false; });
  await page.locator('#extra-bake-form [type="submit"]').click();
  await page.waitForFunction(() => document.querySelector("#extra-bake-message").textContent === "Extra bake batch saved.");
  assert.equal(await page.locator(".extra-bake-row").count(), 1, "Saved items stay in one batch");
  assert.match(await page.locator(".extra-bake-row").innerText(), /Classic White × 4/);
  assert.match(await page.locator(".extra-bake-row").innerText(), /Honey Butter - 8 oz × 2/);
  assert.match(await page.locator(".baking-breakdown").innerText(), /Other Delicious Treats[\s\S]*Honey Butter - 8 oz[\s\S]*2/);
  await page.locator('[data-extra-bake-action="edit"]').click();
  assert.equal(await page.locator("[data-extra-row]").count(), 2, "Editing restores every item");
  await page.locator("#extra-bake-add-item").click();
  await page.locator("[data-remove-extra-row]").nth(2).click();
  assert.equal(await page.locator("[data-extra-row]").count(), 2, "Removing one input keeps the others");
  const calls = await page.evaluate(() => fixture.calls);
  assert.equal(calls.filter(call => /manual_order|sync|reward/.test(call.name)).length, 0, "Extras must never create orders, rewards, or sheet sync calls");
  await page.locator("[data-extra-product]").first().selectOption("other");
  assert.equal(await page.locator("[data-extra-name]").first().isVisible(), true);
  assert.equal(await page.locator("[data-extra-capacity]").first().getAttribute("readonly"), null);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, "No horizontal overflow at width " + width);
    await page.screenshot({ path: path.join(process.env.TEST_SCREENSHOT_DIR || os.tmpdir(), "extra-bake-" + width + ".png"), fullPage: true });
  }
  page.on("dialog", dialog => dialog.accept());
  await page.locator('[data-extra-bake-action="remove"]').click();
  await page.waitForFunction(() => document.querySelector("#extra-bake-message").textContent.includes("loaf spots released"));
  assert.equal(await page.locator(".extra-bake-row").count(), 0);
  assert.deepEqual(errors, []);
  await browser.close();
  console.log("Passed: combined bake totals, income exclusion, label batches, multiple-item edit/save, failed-save preservation, custom capacity, item and batch removal, desktop/mobile layout.");
})().catch(error => { console.error(error); process.exit(1); });
