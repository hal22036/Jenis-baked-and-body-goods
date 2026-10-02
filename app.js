/*
  Bakery owner setup:
  1. Run supabase.sql in your Supabase project.
  2. Replace SUPABASE_URL and SUPABASE_ANON_KEY with your public API values.
  3. Edit STORE_SETTINGS for your bakery name, pickup notes, and payment links.

  Never put a Supabase service_role key or private bank credentials in this file.
*/

const SUPABASE_URL = "https://qvxrbipxxlygmmecgjxf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-w4Ef_bqgM_l9bY00thSpg_xohk7e9M";
const ASSET_VERSION = "20260921-new-product-photos";

const STORE_SETTINGS = {
  bakeryName: "Jeni's Home Made Goods",
  intro:
    "Small-batch goods made to order. Choose Baked Goods for Friday pickup items or Bath & Body for handmade gifts.",
  pickupWindow: "4-7 pm",
  pickupAddress: "7140 Anchor Terrace St.",
  gateCode: "#7716",
  contactPhone: "801-602-8443",
  pickupNote: "Pickup details are shown after your order is submitted.",
  maxLoavesPerDate: 14,
  orderCutoffWeekday: 3, // 0 = Sunday, 3 = Wednesday.
  orderCutoffHour: 17,
  bakeryTimeZone: "America/Los_Angeles",
  categoryOrder: [
    "Everyday",
    "Sweet",
    "Savory",
    "Turn Up the Heat",
    "Other Delicious Treats",
    "Bath & Body"
  ],
  productTabs: [
    {
      id: "baked-goods",
      label: "Baked Goods",
      categories: ["Everyday", "Sweet", "Savory", "Turn Up the Heat", "Other Delicious Treats"]
    },
    {
      id: "bath-body",
      label: "Bath & Body",
      categories: ["Bath & Body"]
    }
  ],
  paymentOptions: {
    Venmo: {
      label: "Venmo",
      link: "https://venmo.com/u/Jeni-Hales",
      instructions: "Send payment by Venmo and include your order number in the note."
    },
    Zelle: {
      label: "Zelle",
      link: "",
      qrImage: "assets/zelle-qr.jpeg",
      instructions: "Send payment by Zelle to jeni.hales@live.com. Add your order number in the memo."
    },
    PayPal: {
      label: "PayPal",
      link: "https://paypal.me/JeniHales",
      instructions: "Send payment by PayPal and include your order number in the note."
    },
    CashApp: {
      label: "CashApp",
      link: "https://cash.app/$JeniHales10",
      instructions: "Send payment by CashApp and include your order number in the note."
    },
    CashAtPickup: {
      label: "Cash at Pickup",
      link: "",
      instructions: "Please bring exact cash at pickup, as change is not available."
    }
  }
};

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const ORDER_DRAFT_KEY = "jenisOrderDraftV1";

const state = {
  dates: [],
  products: [],
  activeProductTab: "baked-goods",
  selectedDate: null,
  quantities: {},
  itemNotes: {},
  coupon: null,
  reward: null,
  rewardStatus: null,
  rewardPhone: null,
  orderTotals: null,
  lastOrder: null,
  isSubmitting: false
};

const el = {
  intro: document.querySelector("[data-store-intro]"),
  pickupNote: document.querySelector("[data-pickup-note]"),
  dateList: document.querySelector("#date-list"),
  dateSection: document.querySelector("#date-section"),
  dateStatus: document.querySelector("#date-status"),
  menuSection: document.querySelector("#menu-section"),
  customerSection: document.querySelector("#customer-section"),
  productList: document.querySelector("#product-list"),
  productTabs: document.querySelector("#product-tabs"),
  rewardBanner: document.querySelector("#reward-banner"),
  capacityMessage: document.querySelector("#capacity-message"),
  capacityPill: document.querySelector(".capacity-pill"),
  selectedCount: document.querySelector("#selected-count"),
  orderTotal: document.querySelector("#order-total"),
  form: document.querySelector("#order-form"),
  formMessage: document.querySelector("#form-message"),
  customerPhone: document.querySelector("#customer-phone"),
  fulfillmentOptions: document.querySelector("#fulfillment-options"),
  shippingOption: document.querySelector("#shipping-option"),
  shippingAddressField: document.querySelector("#shipping-address-field"),
  shippingStreet: document.querySelector("#shipping-street"),
  shippingCity: document.querySelector("#shipping-city"),
  shippingState: document.querySelector("#shipping-state"),
  shippingZip: document.querySelector("#shipping-zip"),
  shippingMessage: document.querySelector("#shipping-message"),
  couponCode: document.querySelector("#coupon-code"),
  couponMessage: document.querySelector("#coupon-message"),
  applyCoupon: document.querySelector("#apply-coupon"),
  removeCoupon: document.querySelector("#remove-coupon"),
  checkRewards: document.querySelector("#check-rewards"),
  rewardMessage: document.querySelector("#reward-message"),
  rewardOptions: document.querySelector("#reward-options"),
  tipAmount: document.querySelector("#tip-amount"),
  submit: document.querySelector("#submit-order"),
  reviewSection: document.querySelector("#review-section"),
  reviewContent: document.querySelector("#review-content"),
  invoiceRequested: document.querySelector("#invoice-requested"),
  invoiceEmailField: document.querySelector("#invoice-email-field"),
  invoiceEmail: document.querySelector("#invoice-email"),
  editOrder: document.querySelector("#edit-order"),
  confirmOrder: document.querySelector("#confirm-order"),
  reviewMessage: document.querySelector("#review-message"),
  successSection: document.querySelector("#success-section"),
  successContent: document.querySelector("#success-content"),
  copyMessage: document.querySelector("#copy-message"),
  imageViewer: document.querySelector("#image-viewer"),
  imageViewerImage: document.querySelector("#image-viewer-image"),
  imageViewerCaption: document.querySelector("#image-viewer-caption"),
  imageViewerClose: document.querySelector("#image-viewer-close"),
  paymentChoices: document.querySelector("#payment-choices")
};

function money(cents) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number(cents || 0) / 100);
}

function dollarsToCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function prettyDate(dateString) {
  if (!dateString) return "Date to be confirmed";

  const [year, month, day] = dateString.split("-").map(Number);

  if (!year || !month || !day) return String(dateString);

  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric"
  });
}

function phoneDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }

  return digits.slice(0, 10);
}

function formatPhone(value) {
  const digits = phoneDigits(value);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function syncPhoneFormat() {
  el.customerPhone.value = formatPhone(el.customerPhone.value);
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function bakeryDateTimeParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_SETTINGS.bakeryTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);

  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function comparableDateTime(parts) {
  return Number(`${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}`);
}

function cutoffForPickupDate(pickupDateString) {
  const [year, month, day] = pickupDateString.split("-").map(Number);
  const pickupDate = new Date(year, month - 1, day);
  const daysSinceCutoff =
    (pickupDate.getDay() - STORE_SETTINGS.orderCutoffWeekday + 7) % 7;

  pickupDate.setDate(pickupDate.getDate() - daysSinceCutoff);

  return {
    year: String(pickupDate.getFullYear()),
    month: String(pickupDate.getMonth() + 1).padStart(2, "0"),
    day: String(pickupDate.getDate()).padStart(2, "0"),
    hour: String(STORE_SETTINGS.orderCutoffHour).padStart(2, "0"),
    minute: "00"
  };
}

function isOrderablePickupDate(date) {
  const remaining = remainingFor(date);
  const now = comparableDateTime(bakeryDateTimeParts());
  const cutoff = comparableDateTime(cutoffForPickupDate(date.pickup_date));

  return date.is_open && remaining > 0 && now < cutoff;
}

function isPlaceholder(value) {
  return !value || value.includes("YOUR_");
}

function selectedQuantity() {
  return Object.values(state.quantities).reduce((sum, qty) => sum + Number(qty || 0), 0);
}

function capacityUnitsFor(product) {
  return Number.isInteger(product.capacity_units) ? product.capacity_units : 1;
}

function productTracksInventory(product) {
  return product.track_inventory === true ||
    product.track_inventory === 1 ||
    String(product.track_inventory).toLowerCase() === "true";
}

function inventoryQuantityFor(product) {
  return Math.max(Number(product.inventory_quantity || 0), 0);
}

function selectedInventoryQuantity(product) {
  return state.quantities[product.id] || 0;
}

function productHasInventory(product) {
  return !productTracksInventory(product) || inventoryQuantityFor(product) > 0;
}

function selectedCapacityUnits() {
  return state.products.reduce((sum, product) => {
    return sum + Number(state.quantities[product.id] || 0) * capacityUnitsFor(product);
  }, 0);
}

function selectedTotalCents() {
  return state.products.reduce((sum, product) => {
    return sum + Number(state.quantities[product.id] || 0) * Number(product.price_cents || 0);
  }, 0);
}

function bathBombQuantity() {
  return state.products.reduce((sum, product) => {
    if (cleanText(product.display_group).toLowerCase() !== "bath bombs") return sum;
    return sum + Number(state.quantities[product.id] || 0);
  }, 0);
}

function bathBombBundleDiscountCents() {
  return Math.floor(bathBombQuantity() / 4) * 200;
}

function isBathBombGroup(groupName) {
  return cleanText(groupName).toLowerCase() === "bath bombs";
}

function bathBombPromoMarkup(groupName) {
  if (!isBathBombGroup(groupName)) return "";

  return `
    <div class="product-promo-banner">
      <strong>$5 each or mix and match 4 for $18.</strong>
      <span>Discount reflects at checkout.</span>
    </div>
  `;
}

function discountCents() {
  return state.coupon?.discount_cents || 0;
}

function isGranolaProduct(product) {
  const group = cleanText(product?.display_group).toLowerCase();
  const name = cleanText(product?.name).toLowerCase();
  return group === "homemade granola"
    || name.includes("granola")
    || name.startsWith("toasted coconut almond");
}

function classicWhiteRewardDiscountCents() {
  const product = state.products.find(item =>
    cleanText(item.name).toLowerCase() === "classic white"
      && Number(state.quantities[item.id] || 0) > 0
  );
  return Number(product?.price_cents || 0);
}

function granolaRewardDiscountCents() {
  const granolaSubtotal = state.products.reduce((sum, product) => {
    if (!isGranolaProduct(product)) return sum;
    return sum + Number(state.quantities[product.id] || 0) * Number(product.price_cents || 0);
  }, 0);
  return Math.min(1200, granolaSubtotal);
}

function rewardDiscountCents() {
  if (state.reward?.type === "bread") return classicWhiteRewardDiscountCents();
  if (state.reward?.type === "granola") return granolaRewardDiscountCents();
  return 0;
}

function rewardLabel(type = state.reward?.type) {
  return type === "bread" ? "Free Classic White loaf" : "$12 granola reward";
}

function totalDiscountCents() {
  return discountCents() + bathBombBundleDiscountCents() + rewardDiscountCents();
}

function itemNoteFor(productId) {
  return cleanText(state.itemNotes[productId] || "");
}

function tipCents() {
  return Math.max(dollarsToCents(el.tipAmount?.value || 0), 0);
}

function finalTotalCents() {
  if (state.orderTotals) return state.orderTotals.final_total_cents + tipCents();
  return Math.max(selectedTotalCents() - totalDiscountCents(), 0) + tipCents();
}

function discountedSubtotalCents() {
  return Math.max(selectedTotalCents() - totalDiscountCents(), 0);
}

function selectedSubtotalByTaxCategory(taxCategory) {
  return state.products.reduce((sum, product) => {
    if ((product.tax_category || "home_bakery") !== taxCategory) return sum;
    return sum + Number(state.quantities[product.id] || 0) * Number(product.price_cents || 0);
  }, 0);
}

function couponAppliesToLabel(value) {
  return {
    items: "items",
    shipping: "shipping",
    order: "whole order"
  }[value] || "order";
}

function categoryFor(product) {
  return product.category || "Everyday";
}

function productTabFor(product) {
  const category = categoryFor(product);
  return STORE_SETTINGS.productTabs.find(tab => tab.categories.includes(category))?.id || "baked-goods";
}

function productsForActiveTab() {
  return state.products.filter(product => productTabFor(product) === state.activeProductTab);
}

function selectedFoodItems() {
  return state.products.filter(product =>
    productTabFor(product) === "baked-goods" && (state.quantities[product.id] || 0) > 0
  );
}

function selectedBathBodyItems() {
  return state.products.filter(product =>
    productTabFor(product) === "bath-body" && (state.quantities[product.id] || 0) > 0
  );
}

function orderNeedsFoodPickupDate() {
  return selectedFoodItems().length > 0;
}

function shouldShowPickupDates() {
  return state.activeProductTab === "baked-goods" || orderNeedsFoodPickupDate();
}

function effectiveOrderDate() {
  return state.selectedDate || state.dates[0] || null;
}

function availableProductTabs() {
  const productTabs = new Set(state.products.map(productTabFor));
  return STORE_SETTINGS.productTabs.filter(tab => productTabs.has(tab.id));
}

function categorySortIndex(category) {
  const index = STORE_SETTINGS.categoryOrder.indexOf(category);
  return index === -1 ? STORE_SETTINGS.categoryOrder.length : index;
}

function compareText(a = "", b = "") {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function compareSortOrder(a, b) {
  const aSort = Number.isFinite(Number(a.sort_order)) ? Number(a.sort_order) : 0;
  const bSort = Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : 0;

  return aSort - bSort;
}

function compareCardOrder(a, b) {
  const aPrice = Math.min(...a.map(product => product.price_cents));
  const bPrice = Math.min(...b.map(product => product.price_cents));

  return aPrice - bPrice || compareText(cardTitleFor(a[0]), cardTitleFor(b[0]));
}

function cleanText(value) {
  return String(value || "").trim();
}

function escapeAttribute(value) {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtml(value) {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function explicitGroupFor(product) {
  return cleanText(product.display_group);
}

function inferredGroupFor(product) {
  const name = cleanText(product.name);
  const dashedName = name.match(/^(.+?)\s+-\s+(.+)$/);

  if (dashedName) return dashedName[1].trim();

  const sizedName = splitSizedName(name);

  if (sizedName) return sizedName.groupName;

  return "";
}

function groupNameFor(product) {
  return explicitGroupFor(product) || inferredGroupFor(product);
}

function cardKeyFor(product) {
  const groupName = groupNameFor(product);
  return groupName ? groupName.toLocaleLowerCase() : product.id;
}

function cardTitleFor(product) {
  return groupNameFor(product) || cleanText(product.name);
}

function displayNameFor(product) {
  const groupName = groupNameFor(product);
  const optionLabel = optionLabelFor(product);

  if (groupName && optionLabel && optionLabel !== cleanText(product.name)) {
    return `${groupName} - ${optionLabel}`;
  }

  return cleanText(product.name);
}

function optionLabelFor(product) {
  const explicitOption = cleanText(product.option_label);
  if (explicitOption) return explicitOption;

  const name = cleanText(product.name);
  const dashedName = name.match(/^(.+?)\s+-\s+(.+)$/);

  if (dashedName) return dashedName[2].trim();

  const sizedName = splitSizedName(name);

  if (sizedName) return sizedName.optionLabel;

  return name;
}

function splitSizedName(name) {
  const parts = cleanText(name).split(/\s+/);
  const sizeIndex = parts.findIndex(part => /^\d+$/.test(part));
  const unit = parts[sizeIndex + 1]?.toLowerCase();

  if (sizeIndex <= 0 || !["oz", "ounce", "ounces"].includes(unit)) {
    return null;
  }

  return {
    groupName: parts.slice(0, sizeIndex).join(" "),
    optionLabel: parts.slice(sizeIndex).join(" ")
  };
}

function imageUrlFor(products) {
  const productWithImage = products.find(product => cleanText(product.image_url));
  return productWithImage ? cleanText(productWithImage.image_url) : "";
}

function cacheBustedAssetUrl(url) {
  const cleanUrl = cleanText(url);
  if (!cleanUrl || cleanUrl.startsWith("http")) return cleanUrl;

  const separator = cleanUrl.includes("?") ? "&" : "?";
  return `${cleanUrl}${separator}v=${ASSET_VERSION}`;
}

function productImageMarkup(products, altText) {
  const imageUrl = cacheBustedAssetUrl(imageUrlFor(products));

  if (!imageUrl) return "";

  return `
    <button
      class="product-image-button"
      type="button"
      data-image-viewer-src="${escapeAttribute(imageUrl)}"
      data-image-viewer-alt="${escapeAttribute(altText)}"
      aria-label="View larger image of ${escapeAttribute(altText)}"
    >
      <img
        class="product-image"
        src="${escapeAttribute(imageUrl)}"
        alt="${escapeAttribute(altText)}"
        loading="lazy"
        onerror="this.closest('.product-image-button').hidden=true"
      />
    </button>
  `;
}

function openImageViewer(src, altText) {
  if (!el.imageViewer || !el.imageViewerImage) return;

  el.imageViewerImage.src = src;
  el.imageViewerImage.alt = altText;
  if (el.imageViewerCaption) el.imageViewerCaption.textContent = altText;
  el.imageViewer.hidden = false;
  document.body.classList.add("image-viewer-open");
  el.imageViewerClose?.focus();
}

function closeImageViewer() {
  if (!el.imageViewer || !el.imageViewerImage) return;

  el.imageViewer.hidden = true;
  el.imageViewerImage.removeAttribute("src");
  el.imageViewerImage.alt = "";
  document.body.classList.remove("image-viewer-open");
}

function invoiceItemImageMarkup(item) {
  if (!item.image_url) return "";
  const imageUrl = cacheBustedAssetUrl(item.image_url);

  return `
    <img
      class="invoice-item-image"
      src="${escapeAttribute(imageUrl)}"
      alt="${escapeAttribute(item.name)}"
      loading="lazy"
      onerror="this.hidden=true"
    />
  `;
}

function itemSubtotalCents(product) {
  return Number(state.quantities[product.id] || 0) * Number(product.price_cents || 0);
}

function cardSubtotalCents(products) {
  return products.reduce((sum, product) => sum + itemSubtotalCents(product), 0);
}

function productDescriptionMarkup(description, className = "product-description") {
  const text = cleanText(description);
  return text ? `<p class="${className}">${escapeHtml(text)}</p>` : "";
}

function optionDescriptionMarkup(description) {
  const text = cleanText(description);

  if (!text) return "";

  return `
    <details class="option-description">
      <summary>Ingredients &amp; allergens</summary>
      <p>${escapeHtml(text)}</p>
    </details>
  `;
}

function remainingFor(date) {
  if (!date) return 0;
  return Math.max(date.capacity - date.ordered_count, 0);
}

function remainingForSelectedDate() {
  return remainingFor(state.selectedDate);
}

function setMessage(message = "", type = "") {
  el.formMessage.textContent = message;
  el.formMessage.className = type ? `message ${type}` : "message";
}

function setReviewMessage(message = "", type = "") {
  el.reviewMessage.textContent = message;
  el.reviewMessage.className = type ? `message ${type}` : "message";
}

function setCouponMessage(message = "", type = "") {
  el.couponMessage.textContent = message;
  el.couponMessage.className = type ? `message ${type}` : "message";
}

function resetCoupon(message = "") {
  state.coupon = null;
  state.orderTotals = null;
  el.removeCoupon.hidden = true;
  if (message) setCouponMessage(message, "error");
}

function setRewardMessage(message = "", type = "") {
  el.rewardMessage.textContent = message;
  el.rewardMessage.className = type ? `message ${type}` : "message";
}

function rewardAvailability(type) {
  return Number(state.rewardStatus?.[`${type}_rewards_available`] || 0);
}

function rewardProgress(type) {
  return Number(state.rewardStatus?.[`${type}_progress`] || 0);
}

function rewardEligibleInCart(type) {
  return type === "bread"
    ? classicWhiteRewardDiscountCents() > 0
    : granolaRewardDiscountCents() > 0;
}

function rewardOptionMarkup(type, title, description) {
  const available = rewardAvailability(type);
  const progress = rewardProgress(type);
  const eligible = rewardEligibleInCart(type);
  const applied = state.reward?.type === type;
  const actionLabel = applied ? "Remove reward" : "Use reward";
  const availabilityText = available
    ? `${available} available &middot; ${progress} of 10 toward the next`
    : `${progress} of 10 toward the next reward`;
  const cartMessage = available && !eligible
    ? (type === "bread" ? "Add a Classic White loaf to use this reward." : "Add a granola bag to use this reward.")
    : description;

  return `
    <div class="checkout-reward-option ${applied ? "is-applied" : ""}">
      <strong>${title}</strong>
      <span>${availabilityText}</span>
      <span>${cartMessage}</span>
      <button
        class="${applied ? "secondary-button" : ""} compact-button"
        type="button"
        data-checkout-reward="${type}"
        ${!applied && (!available || !eligible) ? "disabled" : ""}
      >${actionLabel}</button>
    </div>
  `;
}

function renderRewardOptions() {
  if (!state.rewardStatus) {
    el.rewardOptions.hidden = true;
    el.rewardOptions.innerHTML = "";
    return;
  }

  el.rewardOptions.hidden = false;
  el.rewardOptions.innerHTML = [
    rewardOptionMarkup("bread", "Bread reward", "One free Classic White loaf."),
    rewardOptionMarkup("granola", "Granola reward", "Up to $12 off eligible granola.")
  ].join("");
}

function clearAppliedReward(message = "", type = "") {
  state.reward = null;
  state.orderTotals = null;
  renderRewardOptions();
  setRewardMessage(message, type);
  updateSummary();
  refreshCheckoutReview();
}

function resetRewards(message = "", type = "") {
  state.reward = null;
  state.rewardStatus = null;
  state.rewardPhone = null;
  state.orderTotals = null;
  renderRewardOptions();
  setRewardMessage(message, type);
}

async function lookupCustomerRewards() {
  const phone = phoneDigits(el.customerPhone.value);
  if (phone.length !== 10) {
    resetRewards("Enter a 10-digit phone number above first.", "error");
    el.customerPhone.focus();
    return;
  }

  el.checkRewards.disabled = true;
  setRewardMessage("Checking rewards...");

  const { data, error } = await supabaseClient.rpc("get_customer_rewards", {
    p_customer_phone: phone
  });

  el.checkRewards.disabled = false;
  if (error) {
    resetRewards(error.message || "Rewards could not be loaded. Please try again.", "error");
    return;
  }

  state.reward = null;
  state.rewardStatus = (Array.isArray(data) ? data[0] : data) || {};
  state.rewardPhone = phone;
  state.orderTotals = null;
  renderRewardOptions();

  const available = rewardAvailability("bread") + rewardAvailability("granola");
  setRewardMessage(
    available ? "Your rewards are ready to use." : "No rewards are available yet. Your progress is shown below.",
    available ? "success" : ""
  );
  refreshCheckoutReview();
}

function toggleCheckoutReward(type) {
  if (state.reward?.type === type) {
    clearAppliedReward("Reward removed.");
    return;
  }

  if (state.coupon) {
    setRewardMessage("Remove the coupon before applying a reward.", "error");
    return;
  }

  if (!rewardAvailability(type) || !rewardEligibleInCart(type)) return;

  state.reward = { type };
  state.orderTotals = null;
  renderRewardOptions();
  setRewardMessage(`${rewardLabel(type)} applied.`, "success");
  updateSummary();
  refreshCheckoutReview();
}

function fulfillmentMethod() {
  return document.querySelector('input[name="fulfillment"]:checked')?.value || "pickup";
}

function selectedNonShippableItems() {
  return state.products.filter(product =>
    (state.quantities[product.id] || 0) > 0 && !productIsShippable(product)
  );
}

function selectedShippableItems() {
  return state.products.filter(product =>
    (state.quantities[product.id] || 0) > 0 && productIsShippable(product)
  );
}

function shippingCanBeSelected() {
  return selectedShippableItems().length > 0;
}

function productIsShippable(product) {
  return product.shippable === true ||
    product.shippable === 1 ||
    String(product.shippable).toLowerCase() === "true";
}

function shippingIsSelected() {
  return fulfillmentMethod() === "shipping";
}

function fulfillmentLabel(value = fulfillmentMethod()) {
  return value === "shipping" ? "Shipping" : "Pickup";
}

function itemFulfillmentLabel(details, item) {
  return details.fulfillmentMethod === "shipping" && item.shippable ? "Ships" : "Pickup";
}

function itemFulfillmentBadge(details, item) {
  const label = itemFulfillmentLabel(details, item);
  const className = label === "Ships" ? "ships" : "pickup";
  return `<span class="item-fulfillment-tag ${className}">${label}</span>`;
}

function fulfillmentSummary(details, items) {
  if (details.fulfillmentMethod !== "shipping") return "Pickup";

  const hasShipping = items.some(item => item.shippable);
  const hasPickup = items.some(item => !item.shippable);

  if (hasShipping && hasPickup) return "Shipping + Pickup";
  if (hasShipping) return "Shipping";
  return "Pickup";
}

function orderTimingLabel(details, items) {
  const hasFoodItems = items.some(item => item.productTab === "baked-goods");

  if (details.fulfillmentMethod === "shipping" && !hasFoodItems) return "Ship";
  if (!hasFoodItems) return "Timing";
  return details.fulfillmentMethod === "shipping" ? "Ship/Pickup" : "Pickup";
}

function orderTimingValue(details, items) {
  const orderDate = effectiveOrderDate();
  const hasFoodItems = items.some(item => item.productTab === "baked-goods");

  if (!hasFoodItems && details.fulfillmentMethod === "shipping") return "Shipping timing will be confirmed";
  if (!orderDate) return "Jeni will contact you";
  if (!hasFoodItems && details.fulfillmentMethod !== "shipping") return "Jeni will contact you for pickup";
  return prettyDate(orderDate.pickup_date);
}

function pickupDetailsMarkup(pickupDate) {
  return `
    <div class="pickup-details">
      <h3>Pickup details</h3>
      <p>
        Pickup is on ${prettyDate(pickupDate)} between ${STORE_SETTINGS.pickupWindow}.
      </p>
      <p>
        Address: ${STORE_SETTINGS.pickupAddress}<br>
        Gate Code: ${STORE_SETTINGS.gateCode}<br>
        Please call/text with any questions: ${STORE_SETTINGS.contactPhone}.
      </p>
    </div>
  `;
}

function shippingDetailsMarkup(pickupDate) {
  return `
    <div class="pickup-details">
      <h3>Shipping details</h3>
      <p>Your shippable items are planned for ${prettyDate(pickupDate)}.</p>
      <p>Please call/text with any questions: ${STORE_SETTINGS.contactPhone}.</p>
    </div>
  `;
}

function fulfillmentDetailsMarkup(details, items) {
  const orderDate = effectiveOrderDate();
  const hasFoodItems = items.some(item => item.productTab === "baked-goods");

  if (!hasFoodItems && details.fulfillmentMethod !== "shipping") {
    return `
      <div class="pickup-details">
        <h3>Pickup details</h3>
        <p>Jeni will contact you to arrange pickup for Bath & Body items.</p>
        <p>Please call/text with any questions: ${STORE_SETTINGS.contactPhone}.</p>
      </div>
    `;
  }

  if (!hasFoodItems && details.fulfillmentMethod === "shipping") {
    return `
      <div class="pickup-details">
        <h3>Shipping details</h3>
        <p>Jeni will contact you if any shipping details need to be confirmed.</p>
        <p>Please call/text with any questions: ${STORE_SETTINGS.contactPhone}.</p>
      </div>
    `;
  }

  if (!orderDate) return "";

  if (details.fulfillmentMethod !== "shipping") {
    return pickupDetailsMarkup(orderDate.pickup_date);
  }

  const hasPickupItems = items.some(item => !item.shippable);

  return `
    ${shippingDetailsMarkup(orderDate.pickup_date)}
    ${hasPickupItems ? pickupDetailsMarkup(orderDate.pickup_date) : ""}
  `;
}

function shippingAddressFields() {
  return [el.shippingStreet, el.shippingCity, el.shippingState, el.shippingZip];
}

function shippingAddress() {
  const street = cleanText(el.shippingStreet.value);
  const city = cleanText(el.shippingCity.value);
  const stateValue = cleanText(el.shippingState.value).toUpperCase();
  const zip = cleanText(el.shippingZip.value);

  return [street, [city, stateValue, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

function firstMissingShippingField() {
  return shippingAddressFields().find(field => !cleanText(field.value));
}

function saveOrderDraft() {
  if (state.isSubmitting) return;

  const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value || "";
  const fulfillmentMethodValue = fulfillmentMethod();
  const draft = {
    selectedDateId: state.selectedDate?.id || null,
    activeProductTab: state.activeProductTab,
    quantities: state.quantities,
    itemNotes: state.itemNotes,
    customerName: document.querySelector("#customer-name").value,
    customerPhone: el.customerPhone.value,
    customerNotes: document.querySelector("#customer-notes").value,
    paymentMethod,
    fulfillmentMethod: fulfillmentMethodValue,
    shippingStreet: el.shippingStreet.value,
    shippingCity: el.shippingCity.value,
    shippingState: el.shippingState.value,
    shippingZip: el.shippingZip.value,
    couponCode: el.couponCode.value,
    tipAmount: el.tipAmount.value,
    invoiceRequested: el.invoiceRequested.checked,
    invoiceEmail: el.invoiceEmail.value,
    savedAt: new Date().toISOString()
  };

  try {
    localStorage.setItem(ORDER_DRAFT_KEY, JSON.stringify(draft));
  } catch (error) {
    console.warn("Could not save order draft", error);
  }
}

function clearOrderDraft() {
  try {
    localStorage.removeItem(ORDER_DRAFT_KEY);
  } catch (error) {
    console.warn("Could not clear order draft", error);
  }
}

function restoreOrderDraft() {
  let draft = null;

  try {
    draft = JSON.parse(localStorage.getItem(ORDER_DRAFT_KEY) || "null");
  } catch (error) {
    console.warn("Could not read order draft", error);
    clearOrderDraft();
    return;
  }

  if (!draft) return;

  const productIds = new Set(state.products.map(product => String(product.id)));
  const restoredQuantities = {};
  Object.entries(draft.quantities || {}).forEach(([productId, quantity]) => {
    const cleanQuantity = Math.max(Number(quantity || 0), 0);
    if (productIds.has(String(productId)) && cleanQuantity > 0) {
      restoredQuantities[productId] = cleanQuantity;
    }
  });

  state.quantities = restoredQuantities;
  state.itemNotes = {};
  Object.entries(draft.itemNotes || {}).forEach(([productId, note]) => {
    if (restoredQuantities[productId] && cleanText(note)) {
      state.itemNotes[productId] = note;
    }
  });

  if (draft.selectedDateId) {
    state.selectedDate = state.dates.find(date => date.id === draft.selectedDateId) || null;
  }

  if (STORE_SETTINGS.productTabs.some(tab => tab.id === draft.activeProductTab)) {
    state.activeProductTab = draft.activeProductTab;
  }

  document.querySelector("#customer-name").value = draft.customerName || "";
  el.customerPhone.value = draft.customerPhone || "";
  document.querySelector("#customer-notes").value = draft.customerNotes || "";
  el.couponCode.value = draft.couponCode || "";
  el.tipAmount.value = draft.tipAmount || "";
  el.invoiceRequested.checked = Boolean(draft.invoiceRequested);
  el.invoiceEmail.value = draft.invoiceEmail || "";
  updateInvoiceEmailField();

  const paymentInput = [...document.querySelectorAll('input[name="payment"]')]
    .find(input => input.value === draft.paymentMethod);
  if (paymentInput) paymentInput.checked = true;

  const fulfillmentInput = [...document.querySelectorAll('input[name="fulfillment"]')]
    .find(input => input.value === draft.fulfillmentMethod);
  if (fulfillmentInput) fulfillmentInput.checked = true;

  el.shippingStreet.value = draft.shippingStreet || "";
  el.shippingCity.value = draft.shippingCity || "";
  el.shippingState.value = draft.shippingState || "";
  el.shippingZip.value = draft.shippingZip || "";

  state.coupon = null;
  state.orderTotals = null;
  renderDates();
  renderProducts();
  updateShippingFields();
  syncPageFlow();

  if (draft.couponCode) {
    setCouponMessage("Coupon restored. Tap Update total before checkout.");
  }
}

function updateShippingFields() {
  const nonShippableItems = selectedNonShippableItems();
  const canSelectShipping = shippingCanBeSelected();
  const shippingInput = el.shippingOption.querySelector('input[value="shipping"]');
  const pickupInput = document.querySelector('input[name="fulfillment"][value="pickup"]');

  el.fulfillmentOptions.hidden = !canSelectShipping;
  el.shippingOption.hidden = !canSelectShipping;
  shippingInput.disabled = !canSelectShipping;

  if (!canSelectShipping && shippingInput.checked) {
    pickupInput.checked = true;
  }

  const isShipping = shippingIsSelected();

  if (state.coupon) {
    resetCoupon("Coupon removed because the checkout option changed. Apply it again before checkout.");
  }

  el.shippingAddressField.hidden = !isShipping;
  shippingAddressFields().forEach(field => {
    field.required = isShipping;
  });

  if (!isShipping) {
    shippingAddressFields().forEach(field => {
      field.value = "";
    });
    el.shippingMessage.textContent = "";
  } else if (nonShippableItems.length) {
    el.shippingMessage.textContent =
      `Shippable items will be mailed. Pickup-only items will still be picked up: ${nonShippableItems.map(product => displayNameFor(product)).join(", ")}.`;
  } else {
    el.shippingMessage.textContent = "Only items marked shippable by Jeni can be mailed.";
  }

  state.orderTotals = null;
  updateSummary();
  refreshCheckoutReview();
}

function syncPageFlow() {
  const showPickupDates = shouldShowPickupDates();

  if (!el.reviewSection.hidden || !el.successSection.hidden) return;

  el.dateSection.hidden = !showPickupDates;
  el.menuSection.hidden = false;
  el.customerSection.hidden = false;
  safelyRenderCheckoutReview();
}

function refreshCheckoutReview() {
  if (!el.customerSection.hidden) {
    safelyRenderCheckoutReview();
  }
}

function safelyRenderCheckoutReview() {
  try {
    renderCheckoutReview();
  } catch (error) {
    console.error(error);
    el.reviewContent.innerHTML = `<p class="message error">Could not update the invoice summary: ${escapeHtml(error.message || "Please refresh and try again.")}</p>`;
  }
}

async function calculateOrderTotals() {
  const { data, error } = await supabaseClient.rpc("calculate_order_totals", {
    p_subtotal_cents: selectedTotalCents(),
    p_home_bakery_subtotal_cents: selectedSubtotalByTaxCategory("home_bakery"),
    p_general_product_subtotal_cents: selectedSubtotalByTaxCategory("general_product"),
    p_discount_cents: totalDiscountCents(),
    p_coupon_applies_to: bathBombBundleDiscountCents() || rewardDiscountCents()
      ? "items"
      : state.coupon?.applies_to || null,
    p_shipping_method: fulfillmentMethod(),
    p_tax_state: shippingIsSelected() ? cleanText(el.shippingState.value).toUpperCase() : null
  });

  if (error) throw error;

  const totals = Array.isArray(data) ? data[0] : data;
  state.orderTotals = totals;
  return totals;
}

async function applyCouponCode() {
  const code = cleanText(el.couponCode.value).toUpperCase();
  const subtotal = Math.max(selectedTotalCents() - bathBombBundleDiscountCents(), 0);

  if (state.reward) {
    setCouponMessage("Remove the reward before applying a coupon.", "error");
    return false;
  }

  if (!code) {
    resetCoupon();
    setCouponMessage("Enter a coupon code first.", "error");
    el.couponCode.focus();
    return false;
  }

  if (subtotal <= 0) {
    resetCoupon();
    setCouponMessage("Add items before applying a coupon.", "error");
    return false;
  }

  el.applyCoupon.disabled = true;
  setCouponMessage("Checking coupon...");

  const { data, error } = await supabaseClient.rpc("validate_coupon_code", {
    p_coupon_code: code,
    p_subtotal_cents: subtotal,
    p_fulfillment_method: fulfillmentMethod()
  });

  el.applyCoupon.disabled = false;

  if (error) {
    resetCoupon();
    setCouponMessage(error.message || "Coupon code is not valid.", "error");
    updateSummary();
    return false;
  }

  const coupon = Array.isArray(data) ? data[0] : data;
  state.coupon = coupon;
  state.orderTotals = null;
  el.couponCode.value = coupon.code;
  el.removeCoupon.hidden = false;
  setCouponMessage(
    `Coupon applied: ${money(coupon.discount_cents)} off ${couponAppliesToLabel(coupon.applies_to)}.`,
    "success"
  );
  updateSummary();
  return true;
}

function applyStoreSettings() {
  document.title = `${STORE_SETTINGS.bakeryName} | Bread Orders`;
  el.intro.textContent = STORE_SETTINGS.intro;
  el.pickupNote.textContent = STORE_SETTINGS.pickupNote;

  el.paymentChoices.innerHTML = Object.entries(STORE_SETTINGS.paymentOptions)
    .map(([value, option]) => `
      <label class="radio">
        <input type="radio" name="payment" value="${value}" required />
        <span>${option.label}</span>
      </label>
    `)
    .join("");
}

async function loadStore() {
  applyStoreSettings();

  if (isPlaceholder(SUPABASE_URL) || isPlaceholder(SUPABASE_ANON_KEY)) {
    el.dateStatus.textContent =
      "Add your Supabase URL and anon key in app.js before using the live store.";
    el.dateStatus.className = "error";
    return;
  }

  const [{ data: dates, error: dateError }, { data: products, error: productError }] =
    await Promise.all([
      supabaseClient
        .from("pickup_date_status")
        .select("*")
        .gte("pickup_date", localDateString())
        .eq("is_open", true)
        .order("pickup_date", { ascending: true }),
      supabaseClient
        .from("products")
        .select("*")
        .eq("active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true })
    ]);

  if (dateError || productError) {
    console.error(dateError || productError);
    el.dateStatus.textContent = "Could not load the store. Please try again.";
    el.dateStatus.className = "error";
    return;
  }

  state.dates = dates || [];
  state.dates = state.dates.filter(isOrderablePickupDate);
  state.products = products || [];

  renderDates();
  renderProducts();
  syncPageFlow();
  updateShippingFields();
  restoreOrderDraft();
}

function renderDates() {
  el.dateList.innerHTML = "";

  if (!state.dates.length) {
    el.dateStatus.textContent =
      "There are no open future pickup dates right now. Add dates in Supabase when you are ready to take orders.";
    return;
  }

  el.dateStatus.textContent = "";

  state.dates.forEach(date => {
    const remaining = remainingFor(date);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "date-button";
    btn.disabled = remaining <= 0;
    btn.setAttribute("aria-pressed", state.selectedDate?.id === date.id ? "true" : "false");
    btn.innerHTML = `<strong>${prettyDate(date.pickup_date)}</strong>`;
    btn.addEventListener("click", () => selectDate(date.id));
    el.dateList.appendChild(btn);
  });
}

function selectDate(dateId) {
  state.selectedDate = state.dates.find(d => d.id === dateId);
  state.orderTotals = null;
  resetCoupon();
  el.couponCode.value = "";
  updateShippingFields();

  el.dateSection.hidden = false;
  el.intro.hidden = false;
  el.menuSection.hidden = false;
  el.customerSection.hidden = false;
  el.reviewSection.hidden = true;
  el.successSection.hidden = true;

  renderDates();
  renderProducts();
  updateSummary();
  setMessage();
  saveOrderDraft();
}

function renderProducts() {
  el.productList.hidden = false;
  el.productList.innerHTML = "";
  renderProductTabs();

  if (!state.products.length) {
    el.productList.innerHTML = "<p class=\"muted\">No active items are listed yet.</p>";
    return;
  }

  if (state.activeProductTab === "baked-goods" && !state.selectedDate) {
    el.productList.hidden = true;
    return;
  }

  const visibleProducts = productsForActiveTab().filter(productHasInventory);

  if (!visibleProducts.length) {
    el.productList.innerHTML = "<p class=\"muted\">No active items are listed in this section yet.</p>";
    return;
  }

  const productsByCategory = visibleProducts
    .slice()
    .sort((a, b) => {
      const categoryDifference =
        categorySortIndex(categoryFor(a)) - categorySortIndex(categoryFor(b));

      if (categoryDifference !== 0) return categoryDifference;

      return compareText(categoryFor(a), categoryFor(b));
    })
    .reduce((groups, product) => {
      const category = categoryFor(product);
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(product);
      return groups;
    }, new Map());

  productsByCategory.forEach((products, category) => {
    const categorySection = document.createElement("section");
    categorySection.className = "product-category";
    categorySection.innerHTML = `
      <div class="category-heading">
        <h3>${category}</h3>
      </div>
      <div class="category-grid"></div>
    `;

    const categoryGrid = categorySection.querySelector(".category-grid");

    const productCards = products.reduce((cards, product) => {
      const key = cardKeyFor(product);
      if (!cards.has(key)) cards.set(key, []);
      cards.get(key).push(product);
      return cards;
    }, new Map());

    [...productCards.values()]
      .sort(compareCardOrder)
      .forEach(cardProducts => {
        cardProducts.forEach(product => {
          state.quantities[product.id] = state.quantities[product.id] || 0;
        });

        categoryGrid.appendChild(renderProductCard(cardProducts));
      });

    el.productList.appendChild(categorySection);
  });
}

function renderProductTabs() {
  const tabs = availableProductTabs();

  if (tabs.length <= 1) {
    el.productTabs.hidden = true;
    el.productTabs.innerHTML = "";
    if (tabs[0]) state.activeProductTab = tabs[0].id;
    el.rewardBanner.hidden = state.activeProductTab !== "baked-goods";
    return;
  }

  if (!tabs.some(tab => tab.id === state.activeProductTab)) {
    state.activeProductTab = tabs[0].id;
  }

  el.productTabs.hidden = false;
  el.rewardBanner.hidden = state.activeProductTab !== "baked-goods";
  el.productTabs.innerHTML = tabs.map(tab => `
    <button
      class="product-tab ${tab.id === state.activeProductTab ? "is-active" : ""}"
      type="button"
      data-product-tab="${tab.id}"
      aria-pressed="${tab.id === state.activeProductTab ? "true" : "false"}"
    >
      ${tab.label}
    </button>
  `).join("");

  el.productTabs.querySelectorAll("[data-product-tab]").forEach(button => {
    button.addEventListener("click", () => {
      state.activeProductTab = button.dataset.productTab;
      renderProducts();
      updateSummary();
      syncPageFlow();
    });
  });
}

function renderProductCard(products) {
  const card = document.createElement("article");
  const sortedProducts = products
    .slice()
    .sort((a, b) => compareSortOrder(a, b) || compareText(optionLabelFor(a), optionLabelFor(b)));
  const primaryProduct = sortedProducts[0];
  const groupName = groupNameFor(primaryProduct);
  const isGrouped = products.length > 1 || Boolean(groupName);
  card.className = `product ${isGrouped ? "option-product" : ""}`;

  if (!isGrouped) {
    card.innerHTML = `
      ${productImageMarkup([primaryProduct], primaryProduct.name)}
      <div>
        <h3>${primaryProduct.name}</h3>
        <span class="shipping-badge ${productIsShippable(primaryProduct) ? "can-ship" : "pickup-only"}">
          ${productIsShippable(primaryProduct) ? "Can ship" : "Pickup only"}
        </span>
        ${productDescriptionMarkup(primaryProduct.description)}
      </div>
      <div class="product-bottom">
        <div>
          <strong>${money(primaryProduct.price_cents)}</strong>
          <span class="item-subtotal">Item subtotal: ${money(itemSubtotalCents(primaryProduct))}</span>
        </div>
        <div class="quantity" aria-label="${primaryProduct.name} quantity">
          <button type="button" data-action="minus" data-product-id="${primaryProduct.id}" aria-label="Remove one ${primaryProduct.name}">-</button>
          <span data-qty="${primaryProduct.id}">${state.quantities[primaryProduct.id]}</span>
          <button type="button" data-action="plus" data-product-id="${primaryProduct.id}" aria-label="Add one ${primaryProduct.name}">+</button>
        </div>
      </div>
      ${state.quantities[primaryProduct.id] > 0 ? itemNoteMarkup(primaryProduct) : ""}
    `;
  } else {
    card.innerHTML = `
      ${productImageMarkup(sortedProducts, groupName || primaryProduct.name)}
      <div class="option-card-heading">
        <div>
          <h3>${groupName || primaryProduct.name}</h3>
          <span class="shipping-badge ${sortedProducts.some(product => productIsShippable(product)) ? "can-ship" : "pickup-only"}">
            ${sortedProducts.every(product => productIsShippable(product)) ? "Can ship" : sortedProducts.some(product => productIsShippable(product)) ? "Some options can ship" : "Pickup only"}
          </span>
        </div>
        <div class="group-subtotal">
          <span>Item subtotal</span>
          <strong>${money(cardSubtotalCents(sortedProducts))}</strong>
        </div>
      </div>
      ${bathBombPromoMarkup(groupName || primaryProduct.name)}
      <div class="option-table">
        <div class="option-table-head">
          <span>Option</span>
          <div class="option-controls option-table-labels">
            <span>Quantity</span>
            <span>Price</span>
            <span>Subtotal</span>
          </div>
        </div>
        ${sortedProducts.map(product => `
          <div class="option-row">
            <div class="option-copy">
              <strong>${optionLabelFor(product)}</strong>
              ${optionDescriptionMarkup(product.description)}
            </div>
            <div class="option-controls">
              <div class="quantity" aria-label="${displayNameFor(product)} quantity">
                <button type="button" data-action="minus" data-product-id="${product.id}" aria-label="Remove one ${displayNameFor(product)}">-</button>
                <span data-qty="${product.id}">${state.quantities[product.id]}</span>
                <button type="button" data-action="plus" data-product-id="${product.id}" aria-label="Add one ${displayNameFor(product)}">+</button>
              </div>
              <span class="option-price">${money(product.price_cents)}</span>
              <span class="option-subtotal">${money(itemSubtotalCents(product))}</span>
            </div>
            ${state.quantities[product.id] > 0 ? itemNoteMarkup(product) : ""}
          </div>
        `).join("")}
      </div>
      <div class="card-subtotal">
        <span>Item subtotal</span>
        <strong>${money(cardSubtotalCents(sortedProducts))}</strong>
      </div>
    `;
  }

  card.querySelectorAll("[data-action]").forEach(button => {
    const product = products.find(item => item.id === button.dataset.productId);
    button.disabled = isQuantityButtonDisabled(button.dataset.action, product);
    button.addEventListener("click", () => updateProductQuantity(button.dataset.action, product));
  });

  card.querySelectorAll("[data-image-viewer-src]").forEach(button => {
    button.addEventListener("click", () => {
      openImageViewer(button.dataset.imageViewerSrc, button.dataset.imageViewerAlt || "Product image");
    });
  });

  card.querySelectorAll("[data-item-note]").forEach(input => {
    input.addEventListener("input", () => {
      state.itemNotes[input.dataset.itemNote] = input.value;
      saveOrderDraft();
      refreshCheckoutReview();
    });
  });

  return card;
}

function itemNoteMarkup(product) {
  return `
    <label class="item-note-field">
      Item note
      <input
        type="text"
        data-item-note="${product.id}"
        value="${escapeAttribute(itemNoteFor(product.id))}"
        placeholder="Optional requests/notes"
        maxlength="120"
      />
    </label>
  `;
}

function isQuantityButtonDisabled(action, product) {
  if (action === "remove") return false;
  if (action === "minus") return state.quantities[product.id] === 0;
  if (productTracksInventory(product) && selectedInventoryQuantity(product) >= inventoryQuantityFor(product)) return true;
  if (capacityUnitsFor(product) > 0 && !state.selectedDate) return true;

  return (
    capacityUnitsFor(product) > 0 &&
    selectedCapacityUnits() + capacityUnitsFor(product) > remainingForSelectedDate()
  );
}

function updateProductQuantity(action, product) {
  state.orderTotals = null;

  if (state.coupon) {
    resetCoupon("Coupon removed because the order changed. Apply it again before checkout.");
  }

  if (action === "remove") {
    state.quantities[product.id] = 0;
    delete state.itemNotes[product.id];
    setMessage(`${displayNameFor(product)} removed from your cart.`);
  } else if (action === "minus") {
    if (state.quantities[product.id] > 0) {
      state.quantities[product.id]--;
    }
    if (state.quantities[product.id] === 0) {
      delete state.itemNotes[product.id];
    }
  } else {
    const remaining = remainingForSelectedDate();
    const productCapacity = capacityUnitsFor(product);

    if (productTracksInventory(product) && selectedInventoryQuantity(product) >= inventoryQuantityFor(product)) {
      setMessage(`${displayNameFor(product)} is sold out.`, "error");
      return;
    }

    if (
      productCapacity > 0 &&
      selectedCapacityUnits() + productCapacity > remaining
    ) {
      setMessage(
        `Only ${remaining} loaf spot${remaining === 1 ? "" : "s"} remain for this pickup date.`,
        "error"
      );
      return;
    }

    state.quantities[product.id]++;
    setMessage();
  }

  if (state.reward && !rewardEligibleInCart(state.reward.type)) {
    const removedReward = rewardLabel(state.reward.type);
    state.reward = null;
    setRewardMessage(`${removedReward} was removed because the qualifying item left your cart.`, "error");
  }
  renderRewardOptions();

  updateSummary();
  renderProducts();
  syncPageFlow();
  updateShippingFields();
  saveOrderDraft();
  safelyRenderCheckoutReview();
}

function updateSummary() {
  const remaining = remainingForSelectedDate();
  const count = selectedCapacityUnits();
  const showLoafCounter = state.activeProductTab === "baked-goods" && Boolean(state.selectedDate);

  el.capacityMessage.textContent = "";

  el.capacityPill.hidden = !showLoafCounter;
  el.selectedCount.textContent =
    `You have claimed: ${count} loaf spot${count === 1 ? "" : "s"}, ${remaining} left.`;
  el.orderTotal.textContent = money(selectedTotalCents());
}

el.customerPhone.addEventListener("input", () => {
  syncPhoneFormat();
  if (state.rewardPhone && phoneDigits(el.customerPhone.value) !== state.rewardPhone) {
    resetRewards("Phone number changed. View rewards again for the new number.");
    refreshCheckoutReview();
  }
});
el.customerPhone.addEventListener("blur", syncPhoneFormat);
el.checkRewards.addEventListener("click", lookupCustomerRewards);
el.rewardOptions.addEventListener("click", event => {
  const button = event.target.closest("[data-checkout-reward]");
  if (button) toggleCheckoutReward(button.dataset.checkoutReward);
});
document.querySelectorAll('input[name="fulfillment"]').forEach(input => {
  input.addEventListener("change", () => {
    updateShippingFields();
    saveOrderDraft();
  });
});
shippingAddressFields().forEach(field => {
  field.addEventListener("input", () => {
    state.orderTotals = null;
    refreshCheckoutReview();
    saveOrderDraft();
  });
});
[
  document.querySelector("#customer-name"),
  el.customerPhone,
  document.querySelector("#customer-notes"),
  el.couponCode,
  el.tipAmount,
  el.invoiceEmail
].forEach(field => {
  field.addEventListener("input", saveOrderDraft);
});
document.querySelectorAll('input[name="payment"]').forEach(input => {
  input.addEventListener("change", saveOrderDraft);
});
el.applyCoupon.addEventListener("click", async () => {
  const applied = await applyCouponCode();
  if (applied) {
    renderCheckoutReview();
    saveOrderDraft();
  }
});
el.removeCoupon.addEventListener("click", () => {
  resetCoupon();
  el.couponCode.value = "";
  setCouponMessage("Coupon removed.");
  updateSummary();
  renderCheckoutReview();
  saveOrderDraft();
});

el.tipAmount.addEventListener("input", () => {
  refreshCheckoutReview();
  saveOrderDraft();
});

el.imageViewerClose?.addEventListener("click", closeImageViewer);

el.imageViewer?.addEventListener("click", event => {
  if (event.target === el.imageViewer) {
    closeImageViewer();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && el.imageViewer && !el.imageViewer.hidden) {
    closeImageViewer();
  }
});

el.form.addEventListener("submit", async event => {
  event.preventDefault();

  if (state.isSubmitting) return;

  const totalQty = selectedQuantity();
  const itemsNeedPickupDate = orderNeedsFoodPickupDate();

  if (itemsNeedPickupDate && !state.selectedDate) {
    setMessage("Please choose a pickup date.", "error");
    el.dateSection.hidden = false;
    window.scrollTo({ top: el.dateSection.offsetTop - 16, behavior: "smooth" });
    return;
  }

  if (totalQty < 1) {
    setMessage("Please add at least one item.", "error");
    return;
  }

  if (!effectiveOrderDate()) {
    setMessage("Orders are not available right now. Please check back when Jeni has added an order date.", "error");
    return;
  }

  if (itemsNeedPickupDate && selectedCapacityUnits() > remainingForSelectedDate()) {
    setMessage("That pickup date does not have enough loaf spots left. Please choose another date or reduce your quantity.", "error");
    return;
  }

  const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value;

  syncPhoneFormat();

  if (phoneDigits(el.customerPhone.value).length !== 10) {
    setMessage("Please enter a 10-digit phone number.", "error");
    el.customerPhone.focus();
    return;
  }

  if (!paymentMethod) {
    setMessage("Please choose a payment option.", "error");
    return;
  }

  if (shippingIsSelected()) {
    const missingShippingField = firstMissingShippingField();
    if (missingShippingField) {
      setMessage("Please complete the shipping address.", "error");
      missingShippingField.focus();
      return;
    }
  }

  await submitReviewedOrder();
});

function selectedItemsWithDetails() {
  const productsById = new Map(state.products.map(product => [String(product.id), product]));

  return Object.entries(state.quantities)
    .map(([productId, quantity]) => ({
      product: productsById.get(String(productId)),
      quantity: Math.max(Number(quantity || 0), 0)
    }))
    .filter(({ product, quantity }) => product && quantity > 0)
    .map(({ product, quantity }) => ({
      product_id: product.id,
      name: displayNameFor(product) || "Order item",
      quantity,
      item_note: itemNoteFor(product.id),
      price_cents: Number(product.price_cents || 0),
      capacity_units: capacityUnitsFor(product),
      image_url: cleanText(product.image_url),
      shippable: productIsShippable(product),
      productTab: productTabFor(product)
    }))
    .sort((a, b) => compareText(a.name, b.name));
}

function customerDetails() {
  return {
    name: document.querySelector("#customer-name").value.trim(),
    email: el.invoiceEmail.value.trim(),
    phone: formatPhone(el.customerPhone.value),
    notes: document.querySelector("#customer-notes").value.trim(),
    paymentMethod: document.querySelector('input[name="payment"]:checked')?.value,
    fulfillmentMethod: fulfillmentMethod(),
    shippingAddress: shippingAddress()
  };
}

function hasValidPaymentMethod(paymentMethod) {
  return Boolean(paymentMethod && STORE_SETTINGS.paymentOptions[paymentMethod]);
}

function updateInvoiceEmailField() {
  const invoiceRequested = el.invoiceRequested.checked;
  el.invoiceEmailField.hidden = !invoiceRequested;
  el.invoiceEmail.required = invoiceRequested;

  if (!invoiceRequested) {
    el.invoiceEmail.value = "";
  }
}

function renderCheckoutReview() {
  if (!el.reviewContent) return;

  const items = selectedItemsWithDetails();
  const details = {
    fulfillmentMethod: fulfillmentMethod(),
    shippingAddress: shippingAddress()
  };
  const totals = state.orderTotals;

  if (!items.length) {
    el.reviewContent.innerHTML = "<p class=\"muted\">Add items above to build your invoice.</p>";
    return;
  }

  el.reviewContent.innerHTML = `
    <dl class="receipt invoice-receipt">
      <div><dt>${orderTimingLabel(details, items)}</dt><dd>${orderTimingValue(details, items)}</dd></div>
      <div><dt>Method</dt><dd>${fulfillmentSummary(details, items)}</dd></div>
      ${selectedCapacityUnits() ? `<div><dt>Loaf spots</dt><dd>${selectedCapacityUnits()}</dd></div>` : ""}
    </dl>
    ${details.fulfillmentMethod === "shipping" && details.shippingAddress ? `
      <p class="admin-notes"><strong>Shipping address:</strong> ${escapeHtml(details.shippingAddress)}</p>
    ` : ""}
    <div class="invoice-items">
      ${items.map(item => `
        <div class="checkout-review-item">
          <span class="invoice-item-name">
            ${invoiceItemImageMarkup(item)}
            <span class="invoice-item-text">${item.quantity}x ${item.name} ${itemFulfillmentBadge(details, item)}</span>
          </span>
          ${item.item_note ? `<p class="item-note-display invoice-item-note"><strong>Item note:</strong> ${escapeHtml(item.item_note)}</p>` : ""}
          <div class="checkout-review-controls">
            <div class="quantity" aria-label="${escapeAttribute(item.name)} checkout quantity">
              <button type="button" data-review-action="minus" data-product-id="${item.product_id}" aria-label="Remove one ${escapeAttribute(item.name)}">-</button>
              <span data-qty="${item.product_id}">${item.quantity}</span>
              <button type="button" data-review-action="plus" data-product-id="${item.product_id}" aria-label="Add one ${escapeAttribute(item.name)}">+</button>
            </div>
            <strong>${money(item.quantity * item.price_cents)}</strong>
            <button class="remove-cart-item" type="button" data-review-action="remove" data-product-id="${item.product_id}">
              Remove
            </button>
          </div>
        </div>
      `).join("")}
    </div>
    ${details.notes ? `<p class="admin-notes"><strong>Questions/comments:</strong> ${escapeHtml(details.notes)}</p>` : ""}
    <div class="satisfaction-notice invoice-satisfaction-notice" role="note">
      <strong>Customer satisfaction</strong>
      <p>
        Your order matters to me. Because each item is made to order, refunds are not available.
        If something is wrong with your order, please reach out as soon as possible so I can help
        make it right with a replacement item of equal or lesser value when appropriate.
      </p>
    </div>
    <div class="summary">
      <div class="total-lines">
        <div><span>Subtotal</span><span>${money(selectedTotalCents())}</span></div>
        ${bathBombBundleDiscountCents() ? `
          <div class="discount-line">
            <span>Bath bomb deal</span>
            <span>-${money(bathBombBundleDiscountCents())}</span>
          </div>
        ` : ""}
        ${state.coupon ? `
          <div class="discount-line">
            <span>Coupon ${state.coupon.code} (${couponAppliesToLabel(state.coupon.applies_to)})</span>
            <span>-${money(discountCents())}</span>
          </div>
        ` : ""}
        ${state.reward ? `
          <div class="discount-line">
            <span>${rewardLabel()}</span>
            <span>-${money(rewardDiscountCents())}</span>
          </div>
        ` : ""}
        <div><span>Tax</span><span>${totals ? money(totals.tax_cents) : "Updates before order is placed"}</span></div>
        ${totals?.shipping_cents ? `
          <div><span>Shipping</span><span>${money(totals.shipping_cents)}</span></div>
        ` : ""}
        ${tipCents() ? `<div><span>Tip</span><span>${money(tipCents())}</span></div>` : ""}
        <div><strong>${totals ? "Total" : "Current total"}</strong><strong>${money(finalTotalCents())}</strong></div>
      </div>
    </div>
  `;

  el.reviewContent.querySelectorAll("[data-review-action]").forEach(button => {
    const product = state.products.find(item => item.id === button.dataset.productId);
    if (!product) return;

    button.disabled = isQuantityButtonDisabled(button.dataset.reviewAction, product);
    button.addEventListener("click", () => updateProductQuantity(button.dataset.reviewAction, product));
  });
}

el.editOrder?.addEventListener("click", () => {
  el.intro.hidden = false;
  el.dateSection.hidden = false;
  el.menuSection.hidden = false;
  el.customerSection.hidden = false;
  el.reviewSection.hidden = true;
  el.successSection.hidden = true;
  window.scrollTo({ top: el.menuSection.offsetTop - 16, behavior: "smooth" });
});

el.confirmOrder?.addEventListener("click", submitReviewedOrder);

el.invoiceRequested.addEventListener("change", () => {
  updateInvoiceEmailField();
  setMessage();
  saveOrderDraft();
});

async function submitReviewedOrder() {
  if (state.isSubmitting) return;

  const details = customerDetails();
  const invoiceRequested = el.invoiceRequested.checked;

  if (!hasValidPaymentMethod(details.paymentMethod)) {
    setMessage("Please choose a payment option before placing your order.", "error");
    window.scrollTo({ top: el.customerSection.offsetTop - 16, behavior: "smooth" });
    return;
  }

  if (invoiceRequested && (!details.email || !el.invoiceEmail.checkValidity())) {
    setMessage("Please enter a valid email address for the receipt.", "error");
    el.invoiceEmail.focus();
    return;
  }

  const items = selectedItemsWithDetails().map(item => ({
    product_id: item.product_id,
    quantity: item.quantity,
    item_note: item.item_note
  }));

  state.isSubmitting = true;
  el.submit.disabled = true;
  setMessage("Submitting your order...", "");

  try {
    await calculateOrderTotals();
    renderCheckoutReview();
  } catch (error) {
    state.isSubmitting = false;
    el.submit.disabled = false;
    setMessage(error.message || "Could not calculate your order total. Please try again.", "error");
    return;
  }

  const orderPayload = {
    p_pickup_date_id: effectiveOrderDate().id,
    p_customer_name: details.name,
    p_customer_email: invoiceRequested ? details.email : null,
    p_customer_phone: details.phone,
    p_notes: details.notes,
    p_payment_method: details.paymentMethod,
    p_invoice_requested: invoiceRequested,
    p_coupon_code: state.coupon?.code || null,
    p_fulfillment_method: details.fulfillmentMethod,
    p_shipping_address: details.fulfillmentMethod === "shipping" ? details.shippingAddress : null,
    p_tip_cents: tipCents(),
    p_reward_type: state.reward?.type || null,
    p_items: items
  };

  const appliedReward = state.reward
    ? { ...state.reward, discount_cents: rewardDiscountCents() }
    : null;

  let { data, error } = await supabaseClient.rpc("place_order", orderPayload);

  const databaseNeedsRewardUpgrade =
    error?.code === "PGRST202" && error.message?.includes("p_reward_type");

  if (databaseNeedsRewardUpgrade && !state.reward) {
    const legacyPayload = { ...orderPayload };
    delete legacyPayload.p_reward_type;
    ({ data, error } = await supabaseClient.rpc("place_order", legacyPayload));
  }

  const databaseNeedsTipUpgrade =
    error?.code === "PGRST202" && error.message?.includes("p_tip_cents");

  if (databaseNeedsTipUpgrade && tipCents() === 0) {
    const legacyPayload = { ...orderPayload };
    delete legacyPayload.p_tip_cents;
    ({ data, error } = await supabaseClient.rpc("place_order", legacyPayload));
  }

  state.isSubmitting = false;
  el.submit.disabled = false;

  if (error) {
    console.error(error);

    const errorMessage = String(error.message || "");
    const message = databaseNeedsRewardUpgrade && state.reward
      ? "Rewards are temporarily unavailable. Please try again after the checkout update is complete."
      : errorMessage.toLowerCase().includes("reward")
        ? errorMessage
      : databaseNeedsTipUpgrade && tipCents() > 0
      ? "Optional tips are temporarily unavailable. Please remove the tip and place your order again."
      : errorMessage.includes("Not enough capacity")
      ? "That pickup date filled up while you were ordering. Please choose another date or reduce your quantity."
      : errorMessage.includes("Not enough inventory")
        ? "One of those items just sold out. Please review your quantities and try again."
        : "Your order could not be submitted. Please check your details and try again.";

    setMessage(message, "error");
    await refreshSelectedDate();
    return;
  }

  const result = Array.isArray(data) ? data[0] : data;
  clearOrderDraft();
  showSuccess(
    result,
    details.paymentMethod,
    invoiceRequested,
    selectedItemsWithDetails(),
    details,
    state.coupon,
    appliedReward,
    state.orderTotals
  );
  await refreshSelectedDate();
}

async function refreshSelectedDate() {
  if (!state.selectedDate) return;

  const { data } = await supabaseClient
    .from("pickup_date_status")
    .select("*")
    .eq("id", state.selectedDate.id)
    .single();

  if (data) {
    const index = state.dates.findIndex(d => d.id === data.id);
    if (index !== -1) state.dates[index] = data;
    state.selectedDate = data;
    renderDates();
    updateSummary();
    renderProducts();
  }
}

function showSuccess(result, paymentMethod, invoiceRequested, items, details, coupon, reward, totals) {
  const payment = STORE_SETTINGS.paymentOptions[paymentMethod];
  const linkIsUsable = /^https?:\/\//.test(payment?.link || "");
  const paymentAction = linkIsUsable
    ? `<a class="payment-link success-pay-button" href="${payment.link}" target="_blank" rel="noopener">Pay with ${payment.label}</a>`
    : "";

  el.intro.hidden = true;
  el.dateSection.hidden = true;
  el.menuSection.hidden = true;
  el.customerSection.hidden = true;
  el.reviewSection.hidden = true;
  el.successSection.hidden = false;

  state.lastOrder = {
    ...result,
    paymentMethod
  };

  el.successContent.innerHTML = `
    <dl class="receipt">
      <div><dt>${orderTimingLabel(details, items)}</dt><dd>${orderTimingValue(details, items)}</dd></div>
      <div><dt>Order number</dt><dd>${result.order_code}</dd></div>
      <div><dt>Total</dt><dd>${money(result.total_cents)}</dd></div>
        ${coupon ? `<div><dt>Coupon</dt><dd>${coupon.code} (${couponAppliesToLabel(coupon.applies_to)}) -${money(coupon.discount_cents)}</dd></div>` : ""}
        ${reward ? `<div><dt>Reward</dt><dd>${rewardLabel(reward.type)} -${money(reward.discount_cents)}</dd></div>` : ""}
        ${tipCents() ? `<div><dt>Tip</dt><dd>${money(tipCents())}</dd></div>` : ""}
        <div><dt>Payment</dt><dd data-payment-label></dd></div>
      <div><dt>Method</dt><dd>${fulfillmentSummary(details, items)}</dd></div>
      <div><dt>Receipt email</dt><dd>${invoiceRequested ? "Requested" : "Not requested"}</dd></div>
      ${invoiceRequested ? `<div><dt>Email</dt><dd>${details.email}</dd></div>` : ""}
    </dl>
    ${details.fulfillmentMethod === "shipping" ? `
      <p class="admin-notes"><strong>Shipping address:</strong> ${escapeHtml(details.shippingAddress)}</p>
    ` : ""}
    <div class="success-actions">
      <button class="copy-button" type="button" data-copy-order-code="${result.order_code}">
        Copy order number
      </button>
      <div id="success-payment-details">
        <p>${payment.instructions}</p>
        ${paymentQrMarkup(payment)}
        ${paymentAction}
      </div>
      <details class="edit-payment">
        <summary>Edit payment option</summary>
        <label>
          Payment option
          <select id="success-payment-select">
            ${Object.entries(STORE_SETTINGS.paymentOptions)
              .map(([value, option]) => `
                <option value="${value}" ${value === paymentMethod ? "selected" : ""}>
                  ${option.label}
                </option>
              `)
              .join("")}
          </select>
        </label>
        <button class="secondary-button" type="button" id="save-payment-method">
          Save payment option
        </button>
        <p id="payment-edit-message" class="message" role="status"></p>
      </details>
    </div>
    <div class="invoice-items">
      ${items.map(item => `
        <div class="invoice-line-item">
          <span class="invoice-item-name">
            ${invoiceItemImageMarkup(item)}
            <span class="invoice-item-text">${item.quantity}x ${item.name} ${itemFulfillmentBadge(details, item)}</span>
          </span>
          ${item.item_note ? `<p class="item-note-display invoice-item-note"><strong>Item note:</strong> ${escapeHtml(item.item_note)}</p>` : ""}
          <span class="invoice-line-total">${money(item.quantity * item.price_cents)}</span>
        </div>
      `).join("")}
    </div>
    ${details.notes ? `<p class="admin-notes"><strong>Questions/comments:</strong> ${escapeHtml(details.notes)}</p>` : ""}
    <div class="satisfaction-notice invoice-satisfaction-notice" role="note">
      <strong>Customer satisfaction</strong>
      <p>
        Your order matters to me. Because each item is made to order, refunds are not available.
        If something is wrong with your order, please reach out as soon as possible so I can help
        make it right with a replacement item of equal or lesser value when appropriate.
      </p>
    </div>
    <div class="summary">
      <div class="total-lines">
        <div><span>Subtotal</span><span>${money(selectedTotalCents())}</span></div>
        ${bathBombBundleDiscountCents() ? `<div class="discount-line"><span>Bath bomb deal</span><span>-${money(bathBombBundleDiscountCents())}</span></div>` : ""}
        ${coupon ? `<div class="discount-line"><span>Coupon ${coupon.code} (${couponAppliesToLabel(coupon.applies_to)})</span><span>-${money(coupon.discount_cents)}</span></div>` : ""}
        ${reward ? `<div class="discount-line"><span>${rewardLabel(reward.type)}</span><span>-${money(reward.discount_cents)}</span></div>` : ""}
        <div><span>Tax</span><span>${money(totals?.tax_cents || 0)}</span></div>
        ${totals?.shipping_cents ? `<div><span>Shipping</span><span>${money(totals.shipping_cents)}</span></div>` : ""}
        ${tipCents() ? `<div><span>Tip</span><span>${money(tipCents())}</span></div>` : ""}
        <div><strong>Total</strong><strong>${money(result.total_cents)}</strong></div>
      </div>
    </div>
    ${fulfillmentDetailsMarkup(details, items)}
    <button class="secondary-button" type="button" id="make-another-order">
      Make another order
    </button>
  `;

  el.successContent
    .querySelector("[data-copy-order-code]")
    .addEventListener("click", copyOrderCode);
  el.successContent
    .querySelector("#make-another-order")
    .addEventListener("click", startAnotherOrder);
  el.successContent
    .querySelector("#save-payment-method")
    .addEventListener("click", saveSuccessPaymentMethod);

  renderSuccessPaymentDetails(paymentMethod);
  el.form.reset();
  el.invoiceRequested.checked = false;
  updateInvoiceEmailField();
  resetCoupon();
  resetRewards();
  el.couponCode.value = "";
  el.tipAmount.value = "";
  state.quantities = {};
  state.itemNotes = {};
  clearOrderDraft();
  updateShippingFields();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function startAnotherOrder() {
  state.lastOrder = null;
  state.selectedDate = null;
  state.quantities = {};
  state.itemNotes = {};
  state.orderTotals = null;
  resetCoupon();
  resetRewards();
  el.couponCode.value = "";
  el.tipAmount.value = "";
  clearOrderDraft();

  el.successSection.hidden = true;
  el.dateSection.hidden = false;
  el.intro.hidden = false;
  el.menuSection.hidden = false;
  el.customerSection.hidden = false;
  el.reviewSection.hidden = true;
  el.successContent.innerHTML = "";
  el.copyMessage.textContent = "";

  await loadStore();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderSuccessPaymentDetails(paymentMethod) {
  const payment = STORE_SETTINGS.paymentOptions[paymentMethod];
  const paymentLabel = el.successContent.querySelector("[data-payment-label]");
  const paymentDetails = el.successContent.querySelector("#success-payment-details");
  const linkIsUsable = /^https?:\/\//.test(payment?.link || "");
  const paymentAction = linkIsUsable
    ? `<a class="payment-link success-pay-button" href="${payment.link}" target="_blank" rel="noopener">Pay with ${payment.label}</a>`
    : "";

  paymentLabel.textContent = payment.label;
  paymentDetails.innerHTML = `
    <p>${payment.instructions}</p>
    ${paymentQrMarkup(payment)}
    ${paymentAction}
  `;
}

function paymentQrMarkup(payment) {
  if (!payment?.qrImage) return "";

  return `
    <figure class="payment-qr">
      <img src="${payment.qrImage}" alt="${payment.label} payment QR code" />
      <figcaption>Scan to pay with ${payment.label}</figcaption>
    </figure>
  `;
}

async function saveSuccessPaymentMethod() {
  if (!state.lastOrder) return;

  const select = el.successContent.querySelector("#success-payment-select");
  const message = el.successContent.querySelector("#payment-edit-message");
  const button = el.successContent.querySelector("#save-payment-method");
  const paymentMethod = select.value;

  button.disabled = true;
  message.textContent = "Saving payment option...";
  message.className = "message";

  const { error } = await supabaseClient.rpc("update_order_payment_method", {
    p_order_code: state.lastOrder.order_code,
    p_payment_method: paymentMethod
  });

  button.disabled = false;

  if (error) {
    console.error(error);
    message.textContent = `Could not update payment option: ${error.message}`;
    message.className = "message error";
    return;
  }

  state.lastOrder.paymentMethod = paymentMethod;
  renderSuccessPaymentDetails(paymentMethod);
  message.textContent = "Payment option updated.";
  message.className = "message success";
}

async function copyOrderCode(event) {
  const orderCode = event.currentTarget.dataset.copyOrderCode;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(orderCode);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = orderCode;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }

    el.copyMessage.textContent = "Order number copied.";
    el.copyMessage.className = "message success";
  } catch (error) {
    console.error(error);
    el.copyMessage.textContent = "Could not copy automatically. Select the order number and copy it manually.";
    el.copyMessage.className = "message error";
  }
}

loadStore();
