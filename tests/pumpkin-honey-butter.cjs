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
            {id:"regular4",name:"Honey Butter - 4 oz",display_group:"Honey Butter",option_label:"4 oz",price_cents:300,sort_order:1,capacity_units:0,category:"Other Delicious Treats",active:true},
{id:"pumpkin4",name:"Pumpkin Spice Honey Butter - 4 oz",display_group:"Pumpkin Spice Honey Butter",option_label:"4 oz",price_cents:300,sort_order:1,image_url:"assets/pump_spice_honey_butter.png",capacity_units:0,category:"Other Delicious Treats",active:true},
{id:"regular8",name:"Honey Butter - 8 oz",display_group:"Honey Butter",option_label:"8 oz",price_cents:600,sort_order:2,capacity_units:0,category:"Other Delicious Treats",active:true},
{id:"pumpkin8",name:"Pumpkin Spice Honey Butter - 8 oz",display_group:"Pumpkin Spice Honey Butter",option_label:"8 oz",price_cents:600,sort_order:2,image_url:"assets/pump_spice_honey_butter.png",capacity_units:0,category:"Other Delicious Treats",active:true},
{id:"regular16",name:"Honey Butter - 16 oz",display_group:"Honey Butter",option_label:"16 oz",price_cents:1200,sort_order:3,capacity_units:0,category:"Other Delicious Treats",active:true},
{id:"pumpkin16",name:"Pumpkin Spice Honey Butter - 16 oz",display_group:"Pumpkin Spice Honey Butter",option_label:"16 oz",price_cents:1200,sort_order:3,image_url:"assets/pump_spice_honey_butter.png",capacity_units:0,category:"Other Delicious Treats",active:true},
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

    await page.locator('[data-shop-collection="baked-goods"]').click();
    await page.locator('.date-button').click();
    const pumpkin=page.locator('.product').filter({hasText:'Pumpkin Spice Honey Butter'});
    assert.equal(await pumpkin.count(),1);
    assert.equal(await pumpkin.locator('[data-action="plus"]').count(),3);
    assert.deepEqual(await pumpkin.locator('.option-copy > strong').allTextContents(),['4 oz','8 oz','16 oz']);
    assert.deepEqual(await pumpkin.locator('.option-price').allTextContents(),['$3.00','$6.00','$12.00']);
    await pumpkin.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
    await pumpkin.locator('[data-product-id="pumpkin8"][data-action="plus"]').click();
    assert.equal(await page.evaluate(()=>selectedTotalCents()),600);
    assert.equal(await page.evaluate(()=>selectedCapacityUnits()),0);
    assert.match(await page.locator('#review-content').innerText(),/Pumpkin Spice Honey Butter/);
    assert.equal(await page.locator('[data-product-id="regular8"][data-action="plus"]').count(),1);
    for(const width of [1440,390,320]) {
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    assert.deepEqual(errors,[]);
    console.log('Passed: separate Pumpkin Spice Honey Butter card, three matching size/price options, photo loading, cart totals, no loaf spots, and responsive layout.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
