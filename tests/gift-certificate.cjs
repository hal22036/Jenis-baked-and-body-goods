const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const root = process.cwd();
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const source = app.slice(app.indexOf("async function applyCouponCode()"), app.indexOf("function applyStoreSettings()"));
  assert(source.startsWith("async function applyCouponCode()"));
  const calls = [];
  const sandbox = {
    state: { reward: null },
    el: { couponCode: { value: " k&c-law " }, applyCoupon: {}, removeCoupon: {} },
    cleanText: text => text.trim(),
    selectedTotalCents: () => 4200,
    productBundleDiscountCents: () => 0,
    fulfillmentMethod: () => "pickup",
    selectedItemsWithDetails: () => [
      { product_id: "focaccia", quantity: 2, price_cents: 1500 },
      { product_id: "bread", quantity: 1, price_cents: 1200 }
    ],
    setCouponMessage: () => {},
    resetCoupon: () => { sandbox.state.coupon = null; },
    updateSummary: () => {},
    money: cents => "$" + (cents / 100).toFixed(2),
    couponAppliesToLabel: () => "items",
    supabaseClient: { rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: [{ code: "K&C-LAW", discount_cents: 1500, applies_to: "items" }], error: null };
    } }
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  assert.equal(await sandbox.applyCouponCode(), true);
  assert.equal(calls[0].args.p_coupon_code, "K&C-LAW");
  assert.equal(JSON.stringify(calls[0].args.p_items), JSON.stringify([
    { product_id: "focaccia", quantity: 2 }, { product_id: "bread", quantity: 1 }
  ]));
  assert.equal(sandbox.state.coupon.discount_cents, 1500);
  sandbox.supabaseClient.rpc = async () => ({ error: { message: "Coupon code has already been used" } });
  assert.equal(await sandbox.applyCouponCode(), false);
  assert.equal(sandbox.state.coupon, null);
  assert.equal(sandbox.el.applyCoupon.disabled, false);

  const migration = fs.readFileSync(path.join(root, "supabase-focaccia-gift-certificate.sql"), "utf8");
  const schema = fs.readFileSync(path.join(root, "supabase.sql"), "utf8").replace(/\r\n/g, "\n");
  assert(migration.includes("date '2027-01-31', 1, true, v_product_id"));
  assert(migration.includes("^[1-9][0-9]*$'"));
  assert(migration.includes("v_discount := v_gift_price;"));
  assert(migration.includes("p_coupon_code, p_subtotal_cents, p_fulfillment_method, null::jsonb"));
  for (const sql of [migration, schema]) {
    assert(sql.includes("v_fulfillment_method,\n      p_items\n    );"));
    assert.equal((sql.match(/\$\$/g) || []).length % 2, 0, "SQL dollar-quoted blocks must be balanced");
  }

  const browser = await chromium.launch({ headless: true, channel: process.env.TEST_BROWSER_CHANNEL || "chrome" });
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
  await page.goto("file:///" + path.join(root, "gift-certificates", "focaccia-wedding.html").replaceAll("\\", "/"));
  assert.match(await page.locator(".code").innerText(), /K&C-LAW/);
  assert.match(await page.locator(".expiry").innerText(), /January 31, 2027/);
  assert.equal(await page.locator("img").evaluate(img => img.complete && img.naturalWidth > 0), true);
  await page.emulateMedia({ media: "print" });
  const height = await page.locator("main").evaluate(node => node.getBoundingClientRect().height);
  assert(height < 9.7 * 96, "Certificate must fit one letter page inside its print margins");
  if (process.env.TEST_SCREENSHOT_DIR) {
    await page.screenshot({ path: path.join(process.env.TEST_SCREENSHOT_DIR, "focaccia-gift-certificate.png"), fullPage: true });
  }
  await browser.close();
  console.log("Passed: checkout sends selected products and quantities; redeemed-code errors clear the coupon; certificate code, expiry, logo, and one-page print layout. Live SQL redemption not run.");
})().catch(error => { console.error(error); process.exit(1); });
