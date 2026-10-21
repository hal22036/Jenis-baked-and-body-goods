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
      extras: [{ id: "extra-1", pickup_date_id: "date-1", pickup_date: "2026-10-23",
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
        if (name === "admin_save_extra_bake_item") {
          Object.assign(fixture.extras[0], { quantity: args.p_quantity, note: args.p_note });
          return { data: "extra-1", error: null };
        }
        if (name === "admin_remove_extra_bake_item") {
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
      label_net_weight: "910 g" }];
    renderExtraBakeFormOptions();
    await loadOrders();
    el.adminPanel.hidden = false;
    el.loginPanel.hidden = true;
  });
  assert.equal(await page.locator(".extra-bake-row").count(), 1, "Extra-only dates must render without customer orders");
  assert.match(await page.locator(".baking-breakdown").innerText(), /Extra bake items[\s\S]*Classic White[\s\S]*3/);
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
  await page.locator("#extra-bake-quantity").fill("4");
  assert.match(await page.locator("#extra-bake-total").innerText(), /4 loaf spots/);
  await page.locator("#extra-bake-note").fill("For samples");
  await page.locator('#extra-bake-form [type="submit"]').click();
  await page.waitForFunction(() => document.querySelector("#extra-bake-message").textContent === "Extra bake item saved.");
  assert.match(await page.locator(".extra-bake-row").innerText(), /Qty 4/);
  const calls = await page.evaluate(() => fixture.calls);
  assert.equal(calls.filter(call => /manual_order|sync|reward/.test(call.name)).length, 0, "Extras must never create orders, rewards, or sheet sync calls");
  await page.locator("#extra-bake-product").selectOption("other");
  assert.equal(await page.locator("#extra-bake-name").isVisible(), true);
  assert.equal(await page.locator("#extra-bake-capacity").getAttribute("readonly"), null);
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
  console.log("Passed: extras-only bake list, income exclusion, individual and batch labels, edit/save, custom capacity, removal, desktop/mobile layout.");
})().catch(error => { console.error(error); process.exit(1); });
