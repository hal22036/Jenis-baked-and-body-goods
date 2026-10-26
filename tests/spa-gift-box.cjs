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
            { id: "gift", name: "Spa Gift Box - 2 bath bombs", display_group: "Spa Gift Box", option_label: "2 bath bombs", price_cents: 2200, capacity_units: 0, category: "Bath & Body", image_url: "assets/spa_gift_box_3.png", track_inventory: true, inventory_group: "foaming-hand-soap", inventory_quantity: 10, active: true },
            { id: "bread", name: "Classic White", price_cents: 1000, capacity_units: 1, category: "Everyday", product_type: "standard", image_url: "assets/classic_white.PNG", active: true },
            { id: "soap", name: "Foaming Hand Soap - Almond", display_group: "Foaming Hand Soap", option_label: "Almond", price_cents: 1000, capacity_units: 0, category: "Bath & Body", product_type: "standard", image_url: "assets/foaming_soap.png", active: true },
            { id: "scrub", name: "Whipped Sugar Scrub - 4 oz - Almond", display_group: "Whipped Sugar Scrub", option_label: "Almond", description: "Top: Citrus, Almond", price_cents: 500, capacity_units: 0, category: "Bath & Body", track_inventory: false, inventory_quantity: 0, active: true },
            { id: "bomb", name: "Bath Bombs - 4 oz - Almond", display_group: "Bath Bombs", option_label: "Almond", description: "Top: Citrus, Almond", price_cents: 500, capacity_units: 0, category: "Bath & Body", track_inventory: false, inventory_quantity: 0, active: true }
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
    assert.match(await page.locator("#product-list").innerText(), /Whipped Sugar Scrub - 4 oz/);
    assert.match(await page.locator("#product-list").innerText(), /\$6 each or mix and match 2 for \$10/);
    const scrubDiscounts = await page.evaluate(() => {
      const discounts = [0, 1, 2, 3, 4, 5].map(quantity => {
        state.quantities.scrub = quantity;
        return sugarScrubBundleDiscountCents();
      });
      state.quantities.scrub = 0;
      return discounts;
    });
    assert.deepEqual(scrubDiscounts, [0, 0, 200, 200, 400, 400]);
    assert.equal(await page.locator("#product-list").getByText(/Please allow 4-5 days/).count(), 2);
    assert.equal(await page.locator(".product-options-disclosure > summary").allTextContents().then(labels => labels.every(label => /View .*options/.test(label))), true);
    await page.locator(".product-options-disclosure > summary").evaluateAll(summaries => summaries.forEach(summary => !summary.parentElement.open && summary.click()));
    assert.equal(await page.locator("#product-list").getByText("Scent notes", { exact: true }).count(), 2);
    assert.equal(await page.locator('[data-spa-scent]').first().isVisible(),true);
    assert.equal(await page.locator('[data-qty="gift"]').innerText(),"0");
    assert.equal(await page.locator('[data-spa-scent]').count(),4);
    const chosen = ["Almond & Vanilla", "Be Joyful", "Coconut Lavender", "Watermelon Tide"];
    const scentSelects = await page.locator('[data-spa-scent]').all();
    for (let i = 0; i < scentSelects.length; i++) {
      assert.equal(await scentSelects[i].locator('option').count(),12);
      await scentSelects[i].selectOption(chosen[i]);
    }
    await page.locator('[data-product-id="gift"][data-action="plus"]').click();
    assert.deepEqual(await page.locator('[data-spa-scent]').evaluateAll(selects => selects.map(select => select.value)),chosen);
    for (const width of [1440,390,320]) {
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    await page.screenshot({path:path.join(process.env.TEST_SCREENSHOT_DIR || os.tmpdir(),"spa-configure-first.png"),fullPage:true});
    assert.match(await page.locator('#review-content').innerText(), /Hand soap: Almond & Vanilla/);
    assert.match(await page.locator('#review-content').innerText(), /Bath bomb 2: Watermelon Tide/);
    assert.equal(await page.evaluate(() => productBundleDiscountCents()),0);
    await page.locator('[data-product-id="gift"][data-action="plus"]').click();
    assert.equal(await page.locator('[data-spa-scent]').count(),8);
    assert.deepEqual(await page.locator('[data-spa-scent]').evaluateAll(selects => selects.slice(0,4).map(select => select.value)),chosen);
    assert.equal(await page.evaluate(()=>spaGiftFields(state.products.find(p=>p.id==='gift')).some(field=>!spaGiftScent(state.products.find(p=>p.id==='gift'),field))),true);
    const secondBox = ["Milk Violet","Frosted Snowberry","Hawaiian Sunrise","Citrus By Dae"];
    for (let i=0;i<4;i++) await page.locator('[data-spa-scent]').nth(i+4).selectOption(secondBox[i]);
    assert.match(await page.locator('#review-content').innerText(), /Box 2 - Hand soap: Milk Violet/);
    assert.equal(await page.evaluate(()=>spaGiftFields(state.products.find(p=>p.id==='gift')).some(field=>!spaGiftScent(state.products.find(p=>p.id==='gift'),field))),false);
    await page.reload();
    await page.waitForSelector('[data-spa-scent]');
    assert.deepEqual(await page.locator('[data-spa-scent]').evaluateAll(selects => selects.map(select => select.value)),[...chosen,...secondBox]);
    await page.locator('[data-product-id="gift"][data-action="minus"]').click();
    assert.equal(await page.locator('[data-spa-scent]').count(),4);
    assert.doesNotMatch(await page.locator('#review-content').innerText(), /Box 2/);
    await page.locator('[data-product-id="gift"][data-action="minus"]').click();
    await page.locator('[data-product-id="bomb"][data-action="plus"]').evaluate(button => button.closest('details').open = true);

    for (let i = 0; i < 5; i++) await page.locator('[data-product-id="bomb"][data-action="plus"]').click();
    assert.match(await page.locator("#review-content").innerText(), /Bath Bombs/);
    assert.match(await page.locator("#review-content").innerText(), /Please allow 4-5 days/);
    for (let i = 0; i < 5; i++) await page.locator('[data-product-id="bomb"][data-action="minus"]').click();
    assert.doesNotMatch(await page.locator("#review-content").innerText(), /Please allow 4-5 days/);
    await page.locator('[data-product-id="soap"][data-action="plus"]').evaluate(button => button.closest(".product-options-disclosure").open = true);
    await page.locator('[data-product-id="soap"][data-action="plus"]').click();
    assert.match(await page.locator("#review-content").innerText(), /Almond/);
    assert.equal(await page.locator("#review-content .satisfaction-notice").count(), 0);
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
