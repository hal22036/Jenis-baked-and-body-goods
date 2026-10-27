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
            {id:"mini0",name:"Mini Granola - Plain",display_group:"Mini Granola Gift Pouches",option_label:"Plain",price_cents:400,capacity_units:0,category:"Other Delicious Treats",image_url:"assets/mini_granola_4oz.png",active:true},
{id:"mini1",name:"Mini Granola - Chocolate",display_group:"Mini Granola Gift Pouches",option_label:"Chocolate",price_cents:400,capacity_units:0,category:"Other Delicious Treats",image_url:"assets/mini_granola_4oz.png",active:true},
{id:"mini2",name:"Mini Granola - Craisins",display_group:"Mini Granola Gift Pouches",option_label:"Craisins",price_cents:400,capacity_units:0,category:"Other Delicious Treats",image_url:"assets/mini_granola_4oz.png",active:true},
{id:"mini3",name:"Mini Granola - Craisins & Chocolate",display_group:"Mini Granola Gift Pouches",option_label:"Craisins & Chocolate",price_cents:400,capacity_units:0,category:"Other Delicious Treats",image_url:"assets/mini_granola_4oz.png",active:true},
{id:"regular",name:"Granola - Plain",display_group:"Homemade Granola",option_label:"Plain",price_cents:1200,capacity_units:0,category:"Other Delicious Treats",active:true},
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
    const plus = i => page.locator('[data-product-id="mini'+i+'"][data-action="plus"]');
    assert.match(await page.locator('#product-list').innerText(),/0 of 5 minimum pouches/);
    for(let i=0;i<4;i++) await plus(i).click();
    assert.equal(await page.evaluate(()=>miniGranolaQuantity()),4);
    assert.match(await page.locator('#review-content').innerText(),/Add 1 more/);
    await page.evaluate(async()=>{document.querySelector('input[name="payment"][value="Venmo"]').checked=true;await submitReviewedOrder();});
    assert.match(await page.locator('#form-message').innerText(),/at least 5/);
    await plus(0).click();
    assert.equal(await page.evaluate(()=>miniGranolaMinimumMessage()),"");
    assert.match(await page.locator('#product-list').innerText(),/5 pouches.*20.00/);
    assert.equal(await page.evaluate(()=>selectedTotalCents()),2000);
    const miniCard=page.locator('.product').filter({hasText:'Mini Granola Gift Pouches - 4 oz'});
    await miniCard.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
    for(const width of [1440,390,320]) {
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    await miniCard.screenshot({path:path.join(process.env.TEST_SCREENSHOT_DIR||os.tmpdir(),'mini-granola.png')});
    assert.equal(await page.evaluate(()=>granolaRewardDiscountCents()),0);
    await page.reload();await page.waitForFunction(()=>typeof state!=='undefined'&&state.products.length>0);
    assert.equal(await page.evaluate(()=>miniGranolaQuantity()),5);
    await page.locator('[data-product-id="mini0"][data-action="minus"]').click();
    assert.match(await page.locator('#review-content').innerText(),/at least 5/);
    await page.evaluate(()=>{state.quantities.regular=1;});
    assert.equal(await page.evaluate(()=>granolaRewardDiscountCents()),1200);
    await page.evaluate(()=>{state.products.filter(isMiniGranolaProduct).forEach(p=>state.quantities[p.id]=0);});
    assert.equal(await page.evaluate(()=>miniGranolaMinimumMessage()),"");
    const sql=fs.readFileSync(path.join(root,'supabase-mini-granola.sql'),'utf8');
    assert(sql.includes('v_count > 0 and v_count < 5'));
    assert(sql.includes('deferrable initially deferred'));
    assert(sql.includes("not like ''mini granola%''"));
    assert.deepEqual(errors,[]);
    console.log('Passed: four flavors, mixed-flavor five-pouch minimum, checkout rejection at four, $20 total, refresh retention, and full-size-only rewards. Database SQL requires live application.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
