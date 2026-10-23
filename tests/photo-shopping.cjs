const assert = require("node:assert/strict");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const os = require("node:os");
const { chromium } = require("playwright");
(async () => {
  const root = process.cwd();
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.clock.setFixedTime(new Date("2026-10-19T17:00:00Z"));
    await page.route("https://cdn.jsdelivr.net/**", route => route.fulfill({ contentType: "text/javascript", body: `
      window.supabase = { createClient: () => ({
        from: table => {
          const data = table === "products" ? [
            { id: "bread", name: "Classic White", price_cents: 1000, capacity_units: 1, category: "Everyday", product_type: "standard", image_url: "assets/classic_white.PNG", active: true },
            { id: "soap", name: "Foaming Hand Soap - Almond", display_group: "Foaming Hand Soap", option_label: "Almond", price_cents: 1000, capacity_units: 0, category: "Bath & Body", product_type: "standard", image_url: "assets/foaming_soap.png", active: true }
          ] : [{ id: "date", pickup_date: "2026-10-23", capacity: 14, ordered_count: 0, is_open: true }];
          const q = { select: () => q, gte: () => q, eq: () => q, order: () => q, then: resolve => Promise.resolve({ data, error: null }).then(resolve) };
          return q;
        },
        rpc: async () => ({ data: [{ tax_cents: 0, shipping_cents: 0, final_total_cents: 2000 }], error: null })
      }) };
    ` }));
    const url = pathToFileURL(path.join(root, "index.html")).href;
    await page.goto(url);
    await page.waitForFunction(() => !document.querySelector("[data-shop-collection]").disabled);
    assert.equal(await page.locator("#menu-section").isVisible(), false);
    assert.equal(await page.locator("#customer-section").isVisible(), false);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator(".shop-collections img").evaluateAll(images => Promise.all(images.map(img => img.decode())));
      const bounds = await page.locator(".shop-collections").boundingBox();
      assert(bounds.y + bounds.height < 844, "Both photo choices visible in first viewport at width " + width);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.locator(".site-logo").evaluate(img => img.getBoundingClientRect().width <= 160), true);
      await page.screenshot({ path: path.join(process.env.TEST_SCREENSHOT_DIR || os.tmpdir(), "photo-shopping-" + width + ".png"), fullPage: true });
    }
    await page.locator('[data-shop-collection="bath-body"]').click();
    assert.equal(await page.locator("#date-section").isVisible(), false);
    assert.equal(await page.locator("#reward-banner").isVisible(), false);
    assert.match(await page.locator("#product-list").innerText(), /Foaming Hand Soap/);
    await page.locator(".product-options-disclosure > summary").click();
    await page.locator('[data-product-id="soap"][data-action="plus"]').click();
    assert.match(await page.locator("#review-content").innerText(), /Almond/);
    await page.locator('[data-shop-collection="baked-goods"]').click();
    assert.equal(await page.locator("#date-section").isVisible(), true);
    assert.equal(await page.locator("#product-list").isVisible(), false);
    await page.locator(".date-button").click();
    await page.locator('[data-product-id="bread"][data-action="plus"]').click();
    assert.match(await page.locator("#review-content").innerText(), /Classic White/);
    assert.match(await page.locator("#review-content").innerText(), /Almond/);
    await page.locator('[data-shop-collection="bath-body"]').click();
    assert.match(await page.locator("#review-content").innerText(), /Classic White/);
    assert.equal(await page.locator(".capacity-pill").isVisible(), false);
    await page.reload();
    await page.waitForFunction(() => !document.querySelector("[data-shop-collection]").disabled);
    assert.equal(await page.locator("#menu-section").isVisible(), true);
    assert.match(await page.locator("#review-content").innerText(), /Classic White/);
    assert.match(await page.locator("#review-content").innerText(), /Almond/);
    await page.evaluate(async () => {
      el.shopCollections.hidden = true;
      el.successSection.hidden = false;
      await startAnotherOrder();
    });
    assert.equal(await page.locator("#shop-collections").isVisible(), true);
    assert.equal(await page.locator("#menu-section").isVisible(), false);
    assert.equal(await page.locator("#customer-section").isVisible(), false);
    assert.deepEqual(errors, []);
    console.log("Passed: both photo choices and all images visible on desktop/mobile; smaller logo; collection selection; food date gating; mixed cart and refresh preservation.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
