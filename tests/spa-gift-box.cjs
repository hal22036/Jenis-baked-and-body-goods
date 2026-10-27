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
            {id:"gift1",name:"Spa Gift Box - 1 bath bombs",display_group:"Spa Gift Box",option_label:"1 bath bombs",price_cents:1800,capacity_units:0,category:"Bath & Body",image_url:"assets/spa_gift_box_3.png",track_inventory:true,inventory_group:"soap",inventory_quantity:8,active:true},
{id:"gift2",name:"Spa Gift Box - 2 bath bombs",display_group:"Spa Gift Box",option_label:"2 bath bombs",price_cents:2200,capacity_units:0,category:"Bath & Body",image_url:"assets/spa_gift_box_3.png",track_inventory:true,inventory_group:"soap",inventory_quantity:8,active:true},
{id:"gift3",name:"Spa Gift Box - 3 bath bombs",display_group:"Spa Gift Box",option_label:"3 bath bombs",price_cents:2600,capacity_units:0,category:"Bath & Body",image_url:"assets/spa_gift_box_3.png",track_inventory:true,inventory_group:"soap",inventory_quantity:8,active:true},
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

    const giftBadge = page.locator('.product').filter({has:page.locator('[data-add-spa-box]')}).locator('.shipping-badge');
    assert.equal(await giftBadge.innerText(), 'Pickup only');
    await page.evaluate(() => { state.products.find(p => p.id === 'gift1').shippable = true; renderProducts(); });
    assert.equal(await giftBadge.innerText(), 'Some options can ship');
    await page.evaluate(() => { state.products.filter(isSpaGiftProduct).forEach(p => p.shippable = true); renderProducts(); });
    assert.equal(await giftBadge.innerText(), 'Can ship');
    const box = index => page.locator('[data-spa-box]').nth(index);
    const scent = (index,field,value) => box(index).locator('[data-spa-box-field="'+field+'"]').selectOption(value);
    assert.equal(await page.locator('[data-spa-box]').count(),1);
    assert.equal(await box(0).locator('[data-spa-box-field]').count(),5);
    assert.equal(await box(0).locator('[data-spa-box-field="3"]').inputValue(),"");
    await scent(0,0,"Almond & Vanilla");
    await scent(0,1,"Be Joyful");
    await scent(0,2,"Watermelon Tide");
    assert.equal(await box(0).locator('[data-spa-box-price]').innerText(),"$18.00");
    await scent(0,3,"Milk Violet");
    assert.equal(await box(0).locator('[data-spa-box-price]').innerText(),"$22.00");
    await scent(0,4,"Coconut Lavender");
    assert.equal(await box(0).locator('[data-spa-box-price]').innerText(),"$26.00");
    await page.locator('[data-add-spa-box]').click();
    assert.equal(await page.locator('[data-spa-box]').count(),2);
    await scent(1,0,"Be Joyful");await scent(1,1,"Milk Violet");await scent(1,2,"Hawaiian Sunrise");
    assert.equal(await page.evaluate(()=>selectedTotalCents()),4400);
    assert.equal(await page.evaluate(()=>selectedItemsWithDetails().length),2);
    assert.equal(await page.evaluate(()=>selectedItemsWithDetails().every(item => item.shippable)),true);
    assert.equal(await page.evaluate(()=>productBundleDiscountCents()),0);
    await page.reload();await page.waitForSelector('[data-spa-box-field]');
    assert.equal(await page.locator('[data-spa-box]').count(),2);
    assert.equal(await box(0).locator('[data-spa-box-field="4"]').inputValue(),"Coconut Lavender");
    await scent(0,3,"");await scent(0,4,"");
    assert.equal(await page.evaluate(()=>selectedTotalCents()),3600);
    const items=await page.evaluate(()=>selectedItemsWithDetails());
    assert.match(items[0].item_note,/Hand soap: Almond & Vanilla/);
    assert.equal(await page.locator('[data-remove-spa]').count(),2);
    await page.locator('[data-remove-spa]').first().click();
    assert.equal(await page.locator('[data-spa-box]').count(),1);
    assert.equal(await box(0).locator('[data-spa-box-field="0"]').inputValue(),"Be Joyful");
    assert.equal(await page.evaluate(()=>selectedTotalCents()),1800);
    for(const width of [1440,390,320]) {
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    await page.screenshot({path:path.join(process.env.TEST_SCREENSHOT_DIR||os.tmpdir(),"spa-builder.png"),fullPage:true});
    await page.evaluate(()=>startAnotherOrder());
    assert.equal(await page.evaluate(()=>state.spaBoxes.length),0);
    assert.deepEqual(errors,[]);
    console.log("Passed: per-box scents, optional bombs, $18/$22/$26 pricing, independent boxes, no deal stacking, refresh, removal, and responsive layout.");
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
