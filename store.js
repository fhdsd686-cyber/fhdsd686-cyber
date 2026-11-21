// --- store.js (النسخة الكاملة: تغيير رقم واتساب الإدارة والزبون + المحرك الشامل للموردين + تنظيف 24 ساعة) ---
let bannerInterval = null;
let currentDepositCurrency = "USD";
let activeDepositMethod = null;
let depositReceiptBase64 = "";
let displayCurrency = (typeof getDB === "function") ? getDB("display_currency", "USD") : "USD";
const STORE_EXCHANGE_RATE = 155;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
let currentParentCategory = null;
let lastNotifCount = -1;

const SUPPLIER_WORKER_URL = "https://rapid-dew-4b71.fhdsd686.workers.dev/";
const DEFAULT_SUPPLIER_BASE = "https://api.shams4store.com";
const DEFAULT_SUPPLIER_TOKEN = "fd7769b4023103836b0ae5fcbc13f9df6f5ac6a7c519a427";

function getAdminWhatsAppNumber() {
  const s = getDB("site_settings", {});
  const raw = (s.whatsapp || getDB("admin_whatsapp", "0957455972")).toString().replace(/\D/g, "");
  if (!raw) return "963957455972";
  return raw.startsWith("09") ? "963" + raw.slice(1) : (raw.startsWith("963") ? raw : raw);
}

function isCurrentUserAdmin(user) {
  if (!user) return false;
  const email = (user.email || "").toLowerCase().trim();
  const role = (user.role || "").trim();
  return email === "fhdsd686@gmail.com" || role === "مدير" || role === "admin" || user.isAdmin === true;
}

function promptChangeUserWhatsApp() {
  const users = getDB("users", []);
  if (!users[0] || !users[0].name || users[0].name === "زائر") {
    if (typeof openAuthModal === "function") openAuthModal();
    return;
  }
  const currentPhone = users[0].phone || users[0].whatsapp || "";
  const entered = prompt("أدخل رقم الواتساب الخاص بك (ليصلك إشعار فور شحن رصيدك):", currentPhone);
  if (entered === null) return;
  const cleanPhone = entered.trim();
  users[0].phone = cleanPhone;
  users[0].whatsapp = cleanPhone;
  setDB("users", users);

  const registry = getDB("cloud_users_registry", {});
  const regKey = (users[0].email || users[0].name || "").toLowerCase().trim();
  if (registry[regKey]) {
    registry[regKey].phone = cleanPhone;
    registry[regKey].whatsapp = cleanPhone;
    setDB("cloud_users_registry", registry);
  }
  updateUserUI();
  alert(cleanPhone ? `✅ تم حفظ رقم الواتساب الخاص بك: ${cleanPhone}` : "تم مسح رقم الواتساب.");
}

function promptChangeUserAvatar() {
  const users = getDB("users", []);
  if (!users[0] || !users[0].name || users[0].name === "زائر") {
    if (typeof openAuthModal === "function") openAuthModal();
    return;
  }
  const url = prompt("أدخل رابط الصورة الشخصية الجديدة (URL):", users[0].avatar || "");
  if (!url || !url.trim()) return;
  users[0].avatar = url.trim();
  setDB("users", users);
  updateUserUI();
  alert("✅ تم تحديث الصورة الشخصية بنجاح!");
}

function generateUUIDv4() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function detectSupplierAdapter(customUrl = "", customToken = "", forcedType = "") {
  const savedUrl = (customUrl || getDB("supplier_api_url", "") || `${DEFAULT_SUPPLIER_BASE}/client/api/products`).trim();
  const savedToken = (customToken || getDB("supplier_api_key", "") || DEFAULT_SUPPLIER_TOKEN).trim();
  let baseUrl = DEFAULT_SUPPLIER_BASE;
  try { baseUrl = new URL(savedUrl).origin; } catch (e) {}
  const lower = savedUrl.toLowerCase();

  let type = forcedType;
  if (!type) {
    if (lower.includes("/client/api")) {
      type = "shams_style";
    } else if (lower.includes("parabyte") || lower.includes("/api/v2/products") || lower.includes("/api/v2/order")) {
      type = "parabyte_v2";
    } else if (lower.endsWith("/api/v2") || lower.endsWith("/api/v2/") || lower.endsWith("/api") || lower.includes("action=services") || lower.includes("smm")) {
      type = "smm_panel";
    } else {
      type = "rest_generic";
    }
  }

  if (type === "shams_style") {
    return {
      type,
      productsUrl: savedUrl,
      baseUrl,
      orderUrl: `${baseUrl}/client/api/newOrder`,
      checkUrl: `${baseUrl}/client/api/check`,
      token: savedToken
    };
  }
  if (type === "parabyte_v2") {
    return {
      type,
      productsUrl: savedUrl,
      baseUrl,
      orderUrl: `${baseUrl}/api/v2/order`,
      checkUrl: `${baseUrl}/api/v2/check`,
      token: savedToken
    };
  }
  if (type === "smm_panel") {
    const cleanEndpoint = savedUrl.split("?")[0];
    return {
      type,
      productsUrl: cleanEndpoint,
      baseUrl,
      orderUrl: cleanEndpoint,
      checkUrl: cleanEndpoint,
      token: savedToken
    };
  }
  return {
    type: "rest_generic",
    productsUrl: savedUrl,
    baseUrl,
    orderUrl: savedUrl.replace(/\/(products|services)\/?$/i, "/orders"),
    checkUrl: savedUrl.replace(/\/(products|services)\/?$/i, "/orders"),
    token: savedToken
  };
}

function getActiveSupplierConfig(product = null) {
  if (product && product.supplierApiUrl && product.supplierApiKey) {
    return detectSupplierAdapter(product.supplierApiUrl, product.supplierApiKey, product.supplierApiType || "");
  }
  return detectSupplierAdapter();
}

function isNoTargetProduct(catName, product = null) {
  if (product && product.noParams === true) return true;
  const text = `${catName || ""} ${product?.name || ""}`.toLowerCase();
  return (
    text.includes("chatgpt") ||
    text.includes("gpt") ||
    text.includes("حساب جاهز") ||
    text.includes("حسابات جاهزة") ||
    text.includes("تسليم فوري") ||
    text.includes("كود") ||
    text.includes("بطاقة")
  );
}

function cleanupExpiredOrders24h() {
  const orders = getDB("orders", []);
  if (!Array.isArray(orders) || orders.length === 0) return [];
  const now = Date.now();
  const freshOrders = orders.filter(o => {
    const createdTime = Number(o.timestamp || (String(o.id || "").startsWith("ord_") ? String(o.id).split("_")[1] : 0));
    if (!createdTime || isNaN(createdTime)) return true;
    return (now - createdTime) < TWENTY_FOUR_HOURS_MS;
  });
  if (freshOrders.length !== orders.length) {
    setDB("orders", freshOrders);
  }
  return freshOrders;
}

function getUserDailyOrdersStats(user) {
  const orders = cleanupExpiredOrders24h();
  if (!user || user.name === "زائر") return { count: 0, total: 0 };
  const myOrders = orders.filter(o =>
    (user.email && o.userEmail === user.email) || (o.userName === user.name)
  );
  return {
    count: myOrders.length,
    total: myOrders.reduce((s, o) => s + Number(o.price || 0), 0)
  };
}

function loadSiteSettings() {
  const settings = getDB("site_settings", {});
  const titleEl = document.getElementById("site-title");
  if (titleEl && settings.name) titleEl.innerText = settings.name;

  const logoEl = document.getElementById("site-logo");
  if (logoEl && settings.logo) logoEl.src = settings.logo;

  const bannerImg = document.querySelector(".banner-card img");
  const banners = Array.isArray(settings.banners) && settings.banners.length > 0
    ? settings.banners
    : (settings.banner ? [settings.banner] : []);

  if (bannerImg && banners.length > 0) {
    bannerImg.src = banners[0];
    if (banners.length > 1) {
      let bIdx = 0;
      if (bannerInterval) clearInterval(bannerInterval);
      bannerInterval = setInterval(() => {
        bIdx = (bIdx + 1) % banners.length;
        bannerImg.src = banners[bIdx];
      }, 4500);
    }
  }

  const waNum = getAdminWhatsAppNumber();
  const drawerWa = document.getElementById("drawer-whatsapp-link");
  if (drawerWa) drawerWa.href = `https://wa.me/${waNum}`;
  const maintWa = document.getElementById("maintenance-whatsapp-link");
  if (maintWa) maintWa.href = `https://wa.me/${waNum}?text=${encodeURIComponent("مرحباً، أستفسر عن موعد انتهاء صيانة المتجر")}`;

  const isMaint = !!getDB("maintenance_mode", false);
  const users = getDB("users", []);
  const maintModal = document.getElementById("maintenance-modal");
  if (maintModal) {
    if (isMaint && !isCurrentUserAdmin(users[0])) {
      maintModal.classList.remove("hidden");
    } else {
      maintModal.classList.add("hidden");
    }
  }
}

function toggleDisplayCurrency(e) {
  if (e) e.stopPropagation();
  displayCurrency = displayCurrency === "USD" ? "SYP" : "USD";
  setDB("display_currency", displayCurrency);
  updateUserUI();
}

function formatPriceDisplay(usdVal) {
  const num = Number(usdVal || 0);
  if (displayCurrency === "SYP") {
    return `${Math.round(num * STORE_EXCHANGE_RATE).toLocaleString()} ل.س`;
  }
  return `${num.toFixed(3)} $`;
}

function renderCategories() {
  const container = document.getElementById("categories-container");
  if (!container) return;

  let cats = getDB("categories", []);
  if ((!Array.isArray(cats) || cats.length === 0) && typeof initialCategories !== "undefined") {
    cats = initialCategories;
    setDB("categories", cats);
  }

  const mainCats = cats.filter(c => !c.parentId);
  container.innerHTML = mainCats.map(c => `
    <div class="cat-app-item" onclick="openCategory('${c.id}', '${c.name.replace(/'/g, "\\'")}', '${c.image || ""}', null)">
      <div class="cat-app-avatar">
        <img src="${c.image || "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=300&q=80"}" alt="${c.name}">
      </div>
      <span class="cat-app-label">${c.name}</span>
    </div>
  `).join("");
}

function filterCategories() {
  const q = (document.getElementById("category-search")?.value || "").trim().toLowerCase();
  const items = document.querySelectorAll("#categories-container .cat-app-item");
  items.forEach(el => {
    const label = (el.querySelector(".cat-app-label")?.innerText || "").toLowerCase();
    el.style.display = label.includes(q) ? "" : "none";
  });
}

function openCategory(catId, catName, catImg, parentObj) {
  if (parentObj) currentParentCategory = parentObj;

  const cats = getDB("categories", []);
  const subCats = cats.filter(c => c.parentId === catId);

  document.getElementById("categories-container")?.classList.add("hidden");
  document.querySelector(".search-pill-box")?.classList.add("hidden");
  const prodView = document.getElementById("products-view");
  if (prodView) prodView.classList.remove("hidden");
  const titleEl = document.getElementById("current-category-title");
  if (titleEl) titleEl.innerText = catName;

  const prodContainer = document.getElementById("products-container");
  if (!prodContainer) return;

  if (subCats.length > 0) {
    prodContainer.innerHTML = subCats.map(sc => `
      <div class="cat-app-item" onclick="openCategory('${sc.id}', '${sc.name.replace(/'/g, "\\'")}', '${sc.image || ""}', {id:'${catId}', name:'${catName.replace(/'/g, "\\'")}', image:'${catImg || ""}'})">
        <div class="cat-app-avatar">
          <img src="${sc.image || catImg || "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=300&q=80"}" alt="${sc.name}">
        </div>
        <span class="cat-app-label">${sc.name}</span>
      </div>
    `).join("");
    return;
  }

  const products = getDB("products", []).filter(p => p.categoryId === catId);
  if (products.length === 0) {
    prodContainer.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:#94a3b8;">لا توجد باقات متاحة في هذا القسم حالياً.</div>`;
    return;
  }

  prodContainer.innerHTML = products.map((p, idx) => `
    <div class="product-card" style="background:#0c1527; border:1px solid rgba(56,189,248,0.2); border-radius:16px; padding:12px; display:flex; flex-direction:column; justify-content:space-between; gap:8px;">
      <img src="${p.image || catImg || "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=300&q=80"}" alt="${p.name}" style="width:100%; height:95px; object-fit:cover; border-radius:12px;">
      <div style="font-size:0.84rem; font-weight:800; color:#fff;">${p.name}</div>
      <div style="font-size:0.82rem; font-weight:900; color:#38bdf8;">${formatPriceDisplay(p.priceUSD)}</div>
      <button onclick="selectProductForOrder('${p.id}', '${catName.replace(/'/g, "\\'")}')" style="background:#0284c7; color:#fff; border:none; padding:8px; border-radius:10px; font-weight:800; font-size:0.8rem; cursor:pointer;">شراء الآن</button>
    </div>
  `).join("");
}

function selectProductForOrder(prodId, catName) {
  const products = getDB("products", []);
  const product = products.find(p => p.id === prodId);
  if (!product) return;

  const prodContainer = document.getElementById("products-container");
  if (!prodContainer) return;

  const noTarget = isNoTargetProduct(catName, product);
  const isVariable = product.productType === "variable";

  prodContainer.innerHTML = `
    <div style="grid-column:1/-1; background:#0c1527; border:1px solid rgba(56,189,248,0.3); border-radius:18px; padding:16px; color:#fff;">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">
        <img src="${product.image}" style="width:54px; height:54px; border-radius:12px; object-fit:cover;">
        <div>
          <div style="font-size:0.95rem; font-weight:900;">${product.name}</div>
          <div style="font-size:0.85rem; color:#38bdf8; font-weight:800;">السعر: ${formatPriceDisplay(product.priceUSD)}</div>
        </div>
      </div>
      ${product.desc ? `<p style="font-size:0.8rem; color:#cbd5e1; margin-bottom:12px;">${product.desc}</p>` : ""}
      ${isVariable ? `
        <div style="margin-bottom:12px;">
          <label class="field-label" style="display:block; font-size:0.82rem; margin-bottom:5px;">الكمية المطلوبة:</label>
          <input type="number" id="srv-qty-input" value="1" min="1" oninput="updateOrderLiveTotal(${product.priceUSD})" style="width:100%; padding:11px; border-radius:12px; background:#050b18; border:1px solid #334155; color:#fff;">
        </div>
      ` : `<input type="hidden" id="srv-qty-input" value="1">`}
      ${!noTarget ? `
        <div style="margin-bottom:12px;">
          <label class="field-label" style="display:block; font-size:0.82rem; margin-bottom:5px;">معرف اللاعب (ID) أو الحساب</label>
          <input type="text" id="srv-target-input" placeholder="أدخل المعرف (ID) المطلوب" style="width:100%; padding:11px; border-radius:12px; background:#050b18; border:1px solid #334155; color:#fff;">
        </div>
      ` : ""}
      <div style="font-size:0.88rem; font-weight:800; color:#10b981; margin-bottom:12px;">
        الإجمالي للدفع: <span id="srv-live-total">${formatPriceDisplay(product.priceUSD)}</span>
      </div>
      <button id="btn-confirm-order" onclick="submitStoreOrder('${product.id}', '${catName.replace(/'/g, "\\'")}')" style="width:100%; background:#0284c7; color:#fff; border:none; padding:13px; border-radius:14px; font-weight:800; font-size:0.95rem; cursor:pointer;">
        تأكيد الطلب والشحن الفوري
      </button>
    </div>
  `;
}

function updateOrderLiveTotal(unitUSD) {
  const qty = Math.max(1, parseFloat(document.getElementById("srv-qty-input")?.value) || 1);
  const el = document.getElementById("srv-live-total");
  if (el) el.innerText = formatPriceDisplay(unitUSD * qty);
}

async function submitStoreOrder(prodId, catName) {
  const users = getDB("users", []);
  if (!users[0] || !users[0].name || users[0].name === "زائر") {
    if (typeof openAuthModal === "function") openAuthModal();
    return;
  }

  const product = getDB("products", []).find(p => p.id === prodId);
  if (!product) return;

  const isNoTarget = isNoTargetProduct(catName, product);
  const targetInput = isNoTarget ? "تسليم فوري" : (document.getElementById("srv-target-input")?.value || "").trim();
  if (!isNoTarget && !targetInput) {
    alert("يرجى إدخال المعرف أو الرابط المطلوب!");
    return;
  }

  const orderQty = Math.max(1, parseFloat(document.getElementById("srv-qty-input")?.value) || 1);
  const totalPrice = Number((Number(product.priceUSD || 0) * orderQty).toFixed(4));

  if (Number(users[0].balanceUSD || 0) < totalPrice) {
    alert("رصيدك غير كافٍ لإتمام هذه العملية! يرجى شحن المحفظة أولاً.");
    openDepositModal();
    return;
  }

  const btn = document.getElementById("btn-confirm-order");
  if (btn) { btn.disabled = true; btn.innerText = "جاري تنفيذ الطلب..."; }

  const supCfg = getActiveSupplierConfig(product);
  let supOrderId = "";
  let immediateReply = "";
  let orderStatus = "قيد التنفيذ";

  if (product.supplierId) {
    try {
      const orderUuid = generateUUIDv4();
      let targetUrl = `${supCfg.orderUrl}?product_id=${encodeURIComponent(product.supplierId)}&qty=${encodeURIComponent(orderQty)}&playerId=${encodeURIComponent(targetInput)}&order_uuid=${encodeURIComponent(orderUuid)}`;
      if (supCfg.type === "smm_panel") {
        targetUrl = `${supCfg.orderUrl}?key=${encodeURIComponent(supCfg.token)}&action=add&service=${encodeURIComponent(product.supplierId)}&link=${encodeURIComponent(targetInput)}&quantity=${encodeURIComponent(orderQty)}`;
      }
      const res = await fetch(`${SUPPLIER_WORKER_URL}?url=${encodeURIComponent(targetUrl)}&token=${encodeURIComponent(supCfg.token)}`);
      const data = await res.json();
      if (data && (data.status === "OK" || data.order || data.order_id || data.data?.order_id)) {
        supOrderId = String(data.order || data.order_id || data.data?.order_id || orderUuid);
        immediateReply = data.reply || data.code || data.data?.reply || "";
        orderStatus = immediateReply ? "مكتمل" : "قيد التنفيذ";
      } else {
        if (btn) { btn.disabled = false; btn.innerText = "تأكيد الطلب والشحن الفوري"; }
        alert("تعذر تنفيذ الطلب من المورد: " + (data?.message || data?.error || "حاول لاحقاً"));
        return;
      }
    } catch (err) {
      if (btn) { btn.disabled = false; btn.innerText = "تأكيد الطلب والشحن الفوري"; }
      alert("خطأ في الاتصال بالمورد: " + err.message);
      return;
    }
  }

  users[0].balanceUSD = Number((users[0].balanceUSD - totalPrice).toFixed(3));
  setDB("users", users);

  const unitSupplierCost = Number(product.supplierPriceUSD !== undefined ? product.supplierPriceUSD : (product.priceUSD || 0));
  const totalSupplierCost = Number((unitSupplierCost * orderQty).toFixed(4));
  const orderProfitUSD = Number(Math.max(0, totalPrice - totalSupplierCost).toFixed(4));

  const nowTs = Date.now();
  const orders = cleanupExpiredOrders24h();
  orders.unshift({
    id: "ord_" + nowTs,
    timestamp: nowTs,
    userName: users[0].name,
    userEmail: users[0].email || "",
    supplierOrderId: supOrderId,
    supplierApiUrl: supCfg.productsUrl,
    supplierApiKey: supCfg.token,
    supplierApiType: supCfg.type,
    supplierReply: immediateReply,
    categoryName: catName,
    packageName: product.name,
    qty: orderQty,
    target: targetInput,
    price: totalPrice,
    supplierCost: totalSupplierCost,
    profitUSD: orderProfitUSD,
    date: new Date(nowTs).toLocaleString("ar-SY"),
    status: orderStatus
  });
  setDB("orders", orders);

  const dailyStats = getUserDailyOrdersStats(users[0]);
  if (btn) { btn.disabled = false; btn.innerText = "تأكيد الطلب والشحن الفوري"; }
  updateUserUI();
  alert(`✅ تم إرسال الطلب بنجاح!\n${isNoTarget ? "سيصل الحساب الجاهز في تفاصيل الطلب فور التنفيذ" : `المستلم: ${targetInput}`}\n📊 عدد طلباتك اليوم: ${dailyStats.count}`);
  backToCategories();
}

function backToCategories() {
  if (currentParentCategory) { const p = currentParentCategory; currentParentCategory = null; openCategory(p.id, p.name, p.image, null); return; }
  document.getElementById("products-view")?.classList.add("hidden");
  document.getElementById("categories-container")?.classList.remove("hidden");
  document.querySelector(".search-pill-box")?.classList.remove("hidden");
}

function openDepositModal() {
  const users = getDB("users", []);
  if (!users[0] || !users[0].name || users[0].name === "زائر") {
    if (typeof openAuthModal === "function") openAuthModal();
    return;
  }
  toggleSidebar(false);
  const modal = document.getElementById("deposit-modal");
  if (!modal) return;
  modal.classList.remove("hidden");

  let methods = getDB("depositMethods", []);
  if ((!Array.isArray(methods) || methods.length === 0) && typeof initialDepositMethods !== "undefined") {
    methods = initialDepositMethods;
    setDB("depositMethods", methods);
  }

  const pillsEl = document.getElementById("deposit-methods-selector");
  if (pillsEl && methods.length > 0) {
    pillsEl.innerHTML = methods.map((m, i) => `
      <button type="button" class="method-pill-btn ${i === 0 ? "active" : ""}" onclick="selectDepositMethod('${m.id}', this)">
        <span>${m.name}</span>
      </button>
    `).join("");
    selectDepositMethod(methods[0].id);
  }
}

function closeDepositModal() {
  document.getElementById("deposit-modal")?.classList.add("hidden");
}

function selectDepositMethod(methodId, btnEl) {
  const methods = getDB("depositMethods", []);
  const m = methods.find(x => String(x.id) === String(methodId)) || methods[0];
  if (!m) return;
  activeDepositMethod = m;

  if (btnEl) {
    document.querySelectorAll(".method-pill-btn").forEach(b => b.classList.remove("active"));
    btnEl.classList.add("active");
  }

  if (document.getElementById("deposit-active-name")) document.getElementById("deposit-active-name").innerText = m.name;
  if (document.getElementById("deposit-active-logo")) document.getElementById("deposit-active-logo").src = m.icon || "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=100&q=80";
  if (document.getElementById("deposit-active-qr")) document.getElementById("deposit-active-qr").src = m.qr || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(m.account)}`;
  if (document.getElementById("deposit-display-account")) document.getElementById("deposit-display-account").innerText = m.account;
  if (document.getElementById("deposit-rate-info")) document.getElementById("deposit-rate-info").innerText = `(1$ = ${m.rate || 155} ل.س)`;
  calculateDepositConversion();
}

function copyDepositNumber() {
  const txt = document.getElementById("deposit-display-account")?.innerText || "";
  if (!txt) return;
  navigator.clipboard?.writeText(txt);
  alert("✅ تم نسخ رقم المحفظة: " + txt);
}

function setDepositCurrency(curr) {
  currentDepositCurrency = curr;
  document.getElementById("tab-curr-usd")?.classList.toggle("active", curr === "USD");
  document.getElementById("tab-curr-syp")?.classList.toggle("active", curr === "SYP");
  const lbl = document.getElementById("deposit-amount-label");
  if (lbl) lbl.innerText = curr === "USD" ? "المبلغ المطلوب شحنه (USD):" : "المبلغ المطلوب شحنه (ل.س):";
  calculateDepositConversion();
}

function calculateDepositConversion() {
  const val = parseFloat(document.getElementById("deposit-input-val")?.value) || 0;
  const rate = parseFloat(activeDepositMethod?.rate) || STORE_EXCHANGE_RATE;
  const usd = currentDepositCurrency === "USD" ? val : (val / rate);
  const out = document.getElementById("deposit-converted-val");
  if (out) out.innerText = `${usd.toFixed(2)} $`;
}

function onDepositFileChosen(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const txt = document.getElementById("deposit-file-text");
  if (txt) txt.innerText = file.name;
  const reader = new FileReader();
  reader.onload = ev => { depositReceiptBase64 = ev.target.result; };
  reader.readAsDataURL(file);
}

function handleDepositSubmit(e) {
  e.preventDefault();
  const users = getDB("users", []);
  if (!users[0] || users[0].name === "زائر") return;

  const rawVal = parseFloat(document.getElementById("deposit-input-val")?.value) || 0;
  const rate = parseFloat(activeDepositMethod?.rate) || STORE_EXCHANGE_RATE;
  const amountUSD = currentDepositCurrency === "USD" ? rawVal : +(rawVal / rate).toFixed(3);
  const sender = document.getElementById("deposit-sender-info")?.value.trim() || "";
  const note = document.getElementById("deposit-note")?.value.trim() || "";

  const requests = getDB("deposit_requests", []);
  requests.push({
    id: "dep_" + Date.now(),
    userId: users[0].id,
    userName: users[0].name,
    methodName: activeDepositMethod?.name || "إيداع",
    amountUSD,
    sender,
    note,
    receiptImage: depositReceiptBase64,
    status: "pending",
    date: new Date().toLocaleString("ar-SY")
  });
  setDB("deposit_requests", requests);
  depositReceiptBase64 = "";
  e.target.reset();
  closeDepositModal();
  alert("✅ تم إرسال طلب الإيداع بنجاح! سيتم مراجعته وإضافة الرصيد لحسابك فوراً.");
}

function openFeatureModal(type) {
  toggleSidebar(false);
  const modal = document.getElementById("feature-modal");
  const titleEl = document.getElementById("feature-modal-title");
  const bodyEl = document.getElementById("feature-modal-body");
  if (!modal || !titleEl || !bodyEl) return;

  modal.classList.remove("hidden");
  const users = getDB("users", []);
  const user = users[0] || { name: "زائر", role: "عضو" };

  if (type === "orders") {
    titleEl.innerText = "سجل الطلبات (آخر 24 ساعة)";
    const orders = cleanupExpiredOrders24h().filter(o => (user.email && o.userEmail === user.email) || o.userName === user.name);
    bodyEl.innerHTML = orders.length === 0
      ? `<p style="color:#94a3b8; text-align:center;">لا توجد طلبات خلال آخر 24 ساعة.</p>`
      : orders.map(o => `
        <div style="background:#050b18; border:1px solid rgba(56,189,248,0.2); border-radius:12px; padding:12px; margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; font-weight:800; color:#fff;">
            <span>${o.packageName}</span>
            <span style="color:#38bdf8;">$${Number(o.price || 0).toFixed(3)}</span>
          </div>
          <div style="font-size:0.78rem; color:#94a3b8; margin-top:4px;">
            المستلم: ${o.target} | الحالة: <strong style="color:#10b981;">${o.status}</strong><br>
            ${o.supplierReply ? `<span style="color:#f59e0b;">الرد/الكود: ${o.supplierReply}</span><br>` : ""}
            ${o.date}
          </div>
        </div>
      `).join("");
  } else if (type === "levels") {
    titleEl.innerText = "المستويات والعضويات";
    bodyEl.innerHTML = `<p style="color:#cbd5e1;">مستواك الحالي: <strong style="color:#38bdf8;">${user.role || "عضو"}</strong></p><p style="font-size:0.82rem; color:#94a3b8;">كلما زادت طلباتك اليومية ارتفع مستواك للحصول على خصومات حصرية.</p>`;
  } else {
    titleEl.innerText = type === "notifications" ? "الإشعارات" : "معلومات الحساب";
    bodyEl.innerHTML = `<p style="color:#94a3b8; text-align:center;">لا توجد إشعارات جديدة حالياً.</p>`;
  }
}

function closeFeatureModal() {
  document.getElementById("feature-modal")?.classList.add("hidden");
}

function toggleTheme() {
  document.body.classList.toggle("light-mode");
  const isLight = document.body.classList.contains("light-mode");
  const lbl = document.getElementById("theme-status-label");
  if (lbl) lbl.innerText = isLight ? "الوضع المظلم: معطل" : "الوضع المظلم: مفعل";
}

function updateUserUI() {
  const users = getDB("users", []);
  const user = (Array.isArray(users) && users[0] && users[0].name !== "زائر") ? users[0] : { name: "زائر", balanceUSD: 0, role: "عضو", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80" };
  const balUSD = Number(user.balanceUSD || 0), balSYP = (balUSD * STORE_EXCHANGE_RATE).toFixed(2);
  const hBal = document.getElementById("header-balance-usd");
  if (hBal) hBal.innerHTML = `${displayCurrency === "SYP" ? balSYP + " ل.س" : balUSD.toFixed(3) + " $"} <span onclick="toggleDisplayCurrency(event)" style="background:rgba(56,189,248,0.2);color:#38bdf8;padding:1px 6px;border-radius:8px;font-size:0.72rem;">⇄</span>`;
  const dBal = document.getElementById("drawer-balance-text");
  if (dBal) dBal.innerText = displayCurrency === "SYP" ? `${balSYP} ل.س` : `$ ${balUSD.toFixed(3)}`;
  if (document.getElementById("side-user-name")) document.getElementById("side-user-name").innerText = user.fullname || user.name || "زائر";
  if (document.getElementById("side-user-rank")) document.getElementById("side-user-rank").innerText = user.role || "عضو";
  if (document.getElementById("header-user-rank")) document.getElementById("header-user-rank").innerText = user.role || "عضو";
  if (document.getElementById("drawer-avatar")) document.getElementById("drawer-avatar").src = user.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80";
  const waLabel = document.getElementById("user-whatsapp-label");
  if (waLabel) waLabel.innerText = user.phone ? `واتساب: ${user.phone}` : "إضافة / تغيير رقم واتساب";
  const adminLink = document.getElementById("admin-panel-link");
  if (adminLink) adminLink.style.display = isCurrentUserAdmin(user) ? "flex" : "none";
}

function showStore() { currentParentCategory = null; backToCategories(); toggleSidebar(false); }
function toggleSidebar(force) {
  const drawer = document.getElementById("sidebar-drawer"), backdrop = document.getElementById("drawer-backdrop");
  if (!drawer || !backdrop) return;
  const isOpen = (typeof force === "boolean") ? !force : drawer.classList.contains("open");
  drawer.classList.toggle("open", !isOpen);
  backdrop.classList.toggle("hidden", isOpen);
}
