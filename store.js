// --- store.js (النسخة الكاملة: حرية تعديل الكمية + عداد الطلبات اليومية + حذف تلقائي كل 24 ساعة) ---
let bannerInterval = null;
let currentDepositCurrency = "USD";
let activeDepositMethod = null;
let depositReceiptBase64 = "";
let displayCurrency = (typeof getDB === "function") ? getDB("display_currency", "USD") : "USD";
const STORE_EXCHANGE_RATE = 155;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
let currentParentCategory = null;

const SUPPLIER_WORKER_URL = "https://rapid-dew-4b71.fhdsd686.workers.dev/";
const DEFAULT_SUPPLIER_BASE = "https://api.shams4store.com";
const DEFAULT_SUPPLIER_TOKEN = "fd7769b4023103836b0ae5fcbc13f9df6f5ac6a7c519a427";

function generateUUIDv4() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getActiveSupplierConfig() {
  const savedUrl = (getDB("supplier_api_url", "") || `${DEFAULT_SUPPLIER_BASE}/client/api/products`).trim();
  const savedToken = (getDB("supplier_api_key", "") || DEFAULT_SUPPLIER_TOKEN).trim();
  let baseUrl = DEFAULT_SUPPLIER_BASE;
  try { baseUrl = new URL(savedUrl).origin; } catch (e) {}
  const isParabyte = savedUrl.toLowerCase().includes("parabyte") || savedUrl.toLowerCase().includes("/api/v2/products");
  return {
    type: isParabyte ? "parabyte_v2" : "shams_style",
    productsUrl: savedUrl,
    baseUrl,
    orderUrl: isParabyte ? `${baseUrl}/api/v2/order` : `${baseUrl}/client/api/newOrder`,
    checkUrl: isParabyte ? `${baseUrl}/api/v2/check` : `${baseUrl}/client/api/check`,
    token: savedToken
  };
}

// تنظيف الطلبات التي مرّ عليها أكثر من 24 ساعة تلقائياً
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

// حساب إحصائيات الطلبات اليومية للمستخدم الحالي (آخر 24 ساعة)
function getUserDailyOrdersStats(user) {
  const freshOrders = cleanupExpiredOrders24h();
  if (!user || !user.name || user.name === "زائر") {
    return { count: 0, totalUSD: 0, userOrders: [] };
  }
  const uName = (user.name || "").toLowerCase().trim();
  const uEmail = (user.email || "").toLowerCase().trim();

  const userOrders = freshOrders.filter(o => {
    // إذا كان الطلب قديماً بدون حقل userName نعرضه للمستخدم الحالي، وإلا نطابق الاسم أو الإيميل
    if (!o.userName && !o.userEmail) return true;
    const oName = (o.userName || "").toLowerCase().trim();
    const oEmail = (o.userEmail || "").toLowerCase().trim();
    return (uName && oName === uName) || (uEmail && oEmail === uEmail);
  });

  const totalUSD = userOrders.reduce((sum, o) => sum + Number(o.price || 0), 0);
  return { count: userOrders.length, totalUSD, userOrders };
}

document.addEventListener("DOMContentLoaded", () => {
  try { cleanupExpiredOrders24h(); } catch (e) {}
  try { loadSiteSettings(); } catch (e) {}
  try { renderCategories(); } catch (e) {}
  try { updateUserUI(); } catch (e) {}
  try { initSavedTheme(); } catch (e) {}
  try { checkIncomingNotifications(); } catch (e) {}
  setInterval(() => {
    try { cleanupExpiredOrders24h(); } catch (e) {}
    try { checkIncomingNotifications(); } catch (e) {}
  }, 60000);
  if (typeof checkMaintenanceGate === "function") checkMaintenanceGate();
  if (typeof checkAuthGate === "function") checkAuthGate();
});

function checkIncomingNotifications() {
  const users = getDB("users", []);
  const currentUser = (Array.isArray(users) && users.length > 0 && users[0].name !== "زائر") ? users[0] : null;
  if (!currentUser) return;
  const notifications = getDB("user_notifications", []);
  const myUnread = notifications.filter(n => n.userName === currentUser.name && !n.read);
  document.querySelectorAll(".fa-bell").forEach(icon => {
    const parent = icon.parentElement;
    if (!parent) return;
    parent.style.position = "relative";
    let badge = parent.querySelector(".notif-red-dot");
    if (myUnread.length > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "notif-red-dot";
        badge.style.cssText = "position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font-size:0.65rem;font-weight:900;min-width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;padding:0 3px;";
        parent.appendChild(badge);
      }
      badge.innerText = myUnread.length;
    } else if (badge) badge.remove();
  });
}

function calculateProductFinalPrice(product) {
  if (!product) return 0;
  const supplierPrice = Number(product.supplierPriceUSD !== undefined ? product.supplierPriceUSD : (product.priceUSD || 0));
  const globalPercent = Number(getDB("global_profit_percent", 0));
  const categoryOffers = getDB("category_profit_percents", {});
  let appliedPercent = globalPercent;
  if (product.categoryId && categoryOffers[product.categoryId] !== undefined && categoryOffers[product.categoryId] !== "") {
    appliedPercent = Number(categoryOffers[product.categoryId]);
  }
  if (product.customPercent !== undefined && product.customPercent !== "") {
    appliedPercent = Number(product.customPercent);
  }
  return Number((supplierPrice + (supplierPrice * (appliedPercent / 100))).toFixed(5));
}

function isVariableQuantityProduct(product) {
  if (!product) return false;
  if (Array.isArray(product.qtyValues) && product.qtyValues.length > 0) return true;
  if (product.qtyValues && typeof product.qtyValues === "object" && Number(product.qtyValues.max) > 1) return true;
  const nameLower = (product.name || "").toLowerCase();
  if (nameLower.includes("رصيد mtn") || nameLower.includes("رصيد سيرياتيل") || nameLower.includes("syriatel") || nameLower.includes("وحدات")) return true;
  if (product.productType === "package") return false;
  const unitPrice = Number(product.supplierPriceUSD !== undefined ? product.supplierPriceUSD : (product.priceUSD || 0));
  return (unitPrice > 0 && unitPrice < 0.05 && !nameLower.includes("كازية") && !/\d{2,}/.test(nameLower));
}

function toggleDisplayCurrency(e) {
  if (e) e.stopPropagation();
  displayCurrency = (displayCurrency === "USD") ? "SYP" : "USD";
  setDB("display_currency", displayCurrency);
  updateUserUI();
  if (typeof onPackageSelectChange === "function") onPackageSelectChange(true);
}

function formatStoreAmount(usdAmount) {
  const val = Number(usdAmount || 0);
  return displayCurrency === "SYP" ? `${(val * STORE_EXCHANGE_RATE).toFixed(2)} ل.س` : `${val.toFixed(3)} $`;
}

function initSavedTheme() {
  const savedTheme = getDB("site_theme", "dark");
  const icon = document.getElementById("theme-icon");
  const label = document.getElementById("theme-status-label");
  const isLight = savedTheme === "light";
  document.body.classList.toggle("dark-drawer", !isLight);
  document.body.classList.toggle("light-mode", isLight);
  if (icon) { icon.className = isLight ? "fa-solid fa-sun" : "fa-solid fa-moon"; icon.style.color = isLight ? "#f59e0b" : "#38bdf8"; }
  if (label) label.innerText = isLight ? "الوضع المظلم: معطل (نهاري)" : "الوضع المظلم: مفعل";
}

function toggleTheme() {
  setDB("site_theme", document.body.classList.contains("dark-drawer") ? "light" : "dark");
  initSavedTheme();
}

async function syncOrdersWithSupplier() {
  const orders = cleanupExpiredOrders24h();
  if (!Array.isArray(orders) || orders.length === 0) return false;
  const pending = orders.filter(o => o.supplierOrderId && !o.isFinalized && o.status !== "مكتمل ✓" && !String(o.status).includes("مرفوض"));
  if (pending.length === 0) return false;
  const supCfg = getActiveSupplierConfig();
  try {
    const targetUrl = `${supCfg.checkUrl}?orders=${encodeURIComponent(pending.map(o => o.supplierOrderId).join(","))}`;
    const res = await fetch(`${SUPPLIER_WORKER_URL}?url=${encodeURIComponent(targetUrl)}&token=${encodeURIComponent(supCfg.token)}`, {
      headers: { "Accept": "application/json", "api-token": supCfg.token }
    });
    const data = await res.json();
    const statusMap = {};
    const items = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : (data.orders ? Object.values(data.orders) : []));
    items.forEach(item => { if (item && (item.order_id || item.id)) statusMap[String(item.order_id || item.id)] = item; });
    let changed = false, refundUSD = 0;
    const users = getDB("users", []);
    orders.forEach(o => {
      const info = statusMap[String(o.supplierOrderId)];
      if (!info || o.isFinalized) return;
      const st = String(info.status || info.state || "").toLowerCase();
      if (["accept", "completed", "complete", "success", "done", "مكتمل"].includes(st)) {
        o.status = "مكتمل ✓"; o.isFinalized = true; changed = true;
      } else if (["reject", "rejected", "canceled", "cancelled", "fail", "failed", "مرفوض"].includes(st)) {
        o.status = "مرفوض ✕"; o.isFinalized = true; changed = true;
        if (!o.refunded) { o.refunded = true; refundUSD += Number(o.price || 0); }
      }
    });
    if (refundUSD > 0 && users[0] && users[0].name !== "زائر") {
      users[0].balanceUSD = Number(((users[0].balanceUSD || 0) + refundUSD).toFixed(3));
      setDB("users", users); updateUserUI();
    }
    if (changed) setDB("orders", orders);
    return changed;
  } catch (e) { return false; }
}

function showOrderDetailsModal(orderId) {
  const order = cleanupExpiredOrders24h().find(o => String(o.id) === String(orderId));
  if (!order) return;
  const modal = document.getElementById("feature-modal"), titleEl = document.getElementById("feature-modal-title"), bodyEl = document.getElementById("feature-modal-body");
  if (!modal || !titleEl || !bodyEl) return;
  const createdMs = Number(order.timestamp || Date.now());
  const remainingHrs = Math.max(0, Math.ceil((TWENTY_FOUR_HOURS_MS - (Date.now() - createdMs)) / (1000 * 60 * 60)));

  titleEl.innerText = "تفاصيل الطلب";
  bodyEl.innerHTML = `<div style="background:#050b18;padding:14px;border-radius:14px;margin-bottom:12px;">
    <p><strong>المنتج:</strong> ${order.packageName}</p>
    <p><strong>الكمية:</strong> ${order.qty || 1}</p>
    <p><strong>المستلم:</strong> ${order.target}</p>
    <p><strong>المبلغ:</strong> ${formatStoreAmount(order.price)}</p>
    <p><strong>الحالة:</strong> ${order.status}</p>
    <p><strong>رقم المورد:</strong> ${order.supplierOrderId || order.id}</p>
    <p style="font-size:0.78rem;color:#f59e0b;margin-top:8px;">⏳ يُحذف تلقائياً من السجل بعد: ${remainingHrs} ساعة</p>
  </div><button onclick="openFeatureModal('orders')" class="btn-send-deposit">رجوع</button>`;
  modal.classList.remove("hidden");
}

function openFeatureModal(type) {
  toggleSidebar(false);
  const modal = document.getElementById("feature-modal"), titleEl = document.getElementById("feature-modal-title"), bodyEl = document.getElementById("feature-modal-body");
  if (!modal || !titleEl || !bodyEl) return;
  const users = getDB("users", []);
  const currentUser = (Array.isArray(users) && users.length > 0 && users[0].name !== "زائر") ? users[0] : null;
  if (type === "orders") {
    titleEl.innerText = "سجل الطلبات اليومية (24 ساعة)";
    const render = () => {
      const stats = getUserDailyOrdersStats(currentUser);
      const orders = stats.userOrders;
      const summaryHeader = `
        <div style="background:linear-gradient(135deg,#0c1e3a,#091428);border:1px solid rgba(56,189,248,0.35);padding:12px;border-radius:14px;margin-bottom:12px;display:flex;justify-content:space-around;text-align:center;">
          <div>
            <div style="font-size:0.75rem;color:#94a3b8;">طلباتك اليوم (24س)</div>
            <strong style="font-size:1.2rem;color:#38bdf8;">${stats.count} طلب</strong>
          </div>
          <div style="width:1px;background:rgba(255,255,255,0.1);"></div>
          <div>
            <div style="font-size:0.75rem;color:#94a3b8;">إجمالي مشتريات اليوم</div>
            <strong style="font-size:1.1rem;color:#10b981;">${formatStoreAmount(stats.totalUSD)}</strong>
          </div>
        </div>
        <div style="font-size:0.72rem;color:#94a3b8;text-align:center;margin-bottom:10px;">
          <i class="fa-solid fa-clock-rotate-left" style="color:#f59e0b;"></i> يتم تصفير وحذف كل طلب تلقائياً بعد مرور 24 ساعة من إرساله
        </div>
      `;
      bodyEl.innerHTML = summaryHeader + (orders.length ? orders.map(o => `<div style="background:#0f172a;padding:12px;border-radius:12px;margin-bottom:8px;border-right:3px solid ${String(o.status).includes('مكتمل') ? '#10b981' : (String(o.status).includes('مرفوض') ? '#ef4444' : '#f59e0b')};">
        <div style="display:flex;justify-content:space-between;"><strong>${o.packageName} (×${o.qty || 1})</strong><span style="color:#38bdf8;">${formatStoreAmount(o.price)}</span></div>
        <div style="font-size:0.78rem;color:#94a3b8;margin-top:4px;">المستلم: ${o.target} | ${o.status}</div>
        <button onclick="showOrderDetailsModal('${o.id}')" style="margin-top:6px;background:#0284c7;border:none;color:#fff;padding:4px 10px;border-radius:6px;font-size:0.76rem;">التفاصيل</button>
      </div>`).join("") : `<p style="text-align:center;color:#94a3b8;padding:16px;">لا توجد طلبات خلال آخر 24 ساعة.</p>`);
    };
    render();
    syncOrdersWithSupplier().then(u => { if (u) render(); });
  } else if (type === "notifications") {
    titleEl.innerText = "الإشعارات";
    const notifs = currentUser ? getDB("user_notifications", []).filter(n => n.userName === currentUser.name) : [];
    bodyEl.innerHTML = notifs.map(n => `<div style="background:#0f172a;padding:10px;border-radius:10px;margin-bottom:8px;"><strong>${n.title}</strong><p style="font-size:0.8rem;">${n.message}</p></div>`).join("") + `<div style="background:#0f172a;padding:10px;border-radius:10px;">أهلاً بك في Mohannad kard 🇸🇾</div>`;
  } else {
    const stats = getUserDailyOrdersStats(currentUser);
    titleEl.innerText = "معلومات الحساب";
    bodyEl.innerHTML = `<div style="background:#0f172a;padding:14px;border-radius:12px;text-align:center;">
      <p style="margin-bottom:8px;">المستوى الحالي: <strong style="color:#38bdf8;">${currentUser ? (currentUser.role || "عضو") : "زائر"}</strong></p>
      <p style="margin:0;">عدد طلباتك اليوم: <strong style="color:#10b981;">${stats.count} طلب</strong> (${formatStoreAmount(stats.totalUSD)})</p>
    </div>`;
  }
  modal.classList.remove("hidden");
}

function closeFeatureModal() { document.getElementById("feature-modal")?.classList.add("hidden"); }
function isCurrentUserAdmin(u) { return u && (u.role === "الأسطورة" || u.role === "Admin" || (u.email && u.email.toLowerCase() === "fhdsd686@gmail.com") || (u.name && u.name.toLowerCase() === "mohannad")); }
function checkMaintenanceGate() {
  const modal = document.getElementById("maintenance-modal");
  const users = getDB("users", []);
  if (modal) modal.classList.toggle("hidden", !(getDB("maintenance_mode", false) && !isCurrentUserAdmin(users[0])));
}

function loadSiteSettings() {
  const def = ["https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=600&q=80"];
  const s = getDB("site_settings", { name: "Mohannad kard", logo: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=100&q=80", banners: def });
  if (document.getElementById("site-logo") && s.logo) document.getElementById("site-logo").src = s.logo;
  if (document.getElementById("site-title")) document.getElementById("site-title").innerText = s.name || s.siteName || "Mohannad kard";
  const banners = (s.banners && s.banners.length) ? s.banners : def;
  const imgEl = document.querySelector(".banner-card img");
  if (imgEl) imgEl.src = banners[0];
}

function promptChangeUserAvatar() {
  const users = getDB("users", []);
  const url = prompt("ضع رابط صورتك الشخصية:");
  if (url && users[0]) { users[0].avatar = url.trim(); setDB("users", users); updateUserUI(); }
}

function openDepositModal() {
  toggleSidebar(false);
  const users = getDB("users", []);
  if (!users[0] || !users[0].name || users[0].name === "زائر") { if (typeof openAuthModal === "function") openAuthModal(); return; }
  const fallback = typeof initialDepositMethods !== "undefined" ? initialDepositMethods : [];
  let methods = getDB("depositMethods", fallback);
  if (!Array.isArray(methods) || !methods.length) methods = fallback;
  if (methods.length) {
    if (!activeDepositMethod) activeDepositMethod = methods[0];
    const sel = document.getElementById("deposit-methods-selector");
    if (sel) sel.innerHTML = methods.map(m => `<button type="button" class="method-pill-btn ${activeDepositMethod.id === m.id ? 'active' : ''}" onclick="selectDepositMethod('${m.id}')"><span>${m.name}</span></button>`).join("");
    if (document.getElementById("deposit-active-name")) document.getElementById("deposit-active-name").innerText = activeDepositMethod.name;
    if (document.getElementById("deposit-display-account")) document.getElementById("deposit-display-account").innerText = activeDepositMethod.account;
    if (document.getElementById("deposit-active-qr")) document.getElementById("deposit-active-qr").src = activeDepositMethod.qrImage || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(activeDepositMethod.account)}`;
  }
  document.getElementById("deposit-modal")?.classList.remove("hidden");
}

function selectDepositMethod(id) {
  const fallback = typeof initialDepositMethods !== "undefined" ? initialDepositMethods : [];
  const found = getDB("depositMethods", fallback).find(m => m.id === id);
  if (found) { activeDepositMethod = found; openDepositModal(); }
}

function closeDepositModal() { document.getElementById("deposit-modal")?.classList.add("hidden"); }
function copyDepositNumber() { if (activeDepositMethod) navigator.clipboard.writeText(activeDepositMethod.account).then(() => alert("تم النسخ")); }
function setDepositCurrency(c) { currentDepositCurrency = c; document.getElementById("tab-curr-usd")?.classList.toggle("active", c === "USD"); document.getElementById("tab-curr-syp")?.classList.toggle("active", c === "SYP"); calculateDepositConversion(); }
function calculateDepositConversion() {
  const v = parseFloat(document.getElementById("deposit-input-val")?.value) || 0;
  const rate = (activeDepositMethod && Number(activeDepositMethod.rate) > 1) ? Number(activeDepositMethod.rate) : STORE_EXCHANGE_RATE;
  const el = document.getElementById("deposit-converted-val");
  if (el) el.innerText = currentDepositCurrency === "USD" ? `${v.toFixed(2)} $` : `${(v / rate).toFixed(3)} $`;
}
function onDepositFileChosen(e) {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader(); r.onload = ev => { depositReceiptBase64 = ev.target.result; }; r.readAsDataURL(f);
}
function handleDepositSubmit(e) {
  e.preventDefault();
  const users = getDB("users", []);
  const v = parseFloat(document.getElementById("deposit-input-val").value) || 0;
  const sender = document.getElementById("deposit-sender-info").value.trim();
  const rate = (activeDepositMethod && Number(activeDepositMethod.rate) > 1) ? Number(activeDepositMethod.rate) : STORE_EXCHANGE_RATE;
  const amountUSD = currentDepositCurrency === "USD" ? v : Number((v / rate).toFixed(3));
  const reqs = getDB("deposit_requests", []);
  reqs.unshift({ id: "dep_" + Date.now(), userName: users[0]?.name || "زائر", userEmail: users[0]?.email || "", methodName: activeDepositMethod?.name || "شام كاش", amountUSD, sender, receipt: depositReceiptBase64, date: new Date().toLocaleString("ar-SY"), status: "معلق" });
  setDB("deposit_requests", reqs);
  alert("✅ تم إرسال طلب الشحن!"); closeDepositModal();
}

function renderCategories(filterText = "") {
  const container = document.getElementById("categories-container");
  if (!container) return;
  const fallback = typeof initialCategories !== "undefined" ? initialCategories : [];
  let cats = getDB("categories", fallback);
  if (!Array.isArray(cats) || cats.length === 0) cats = fallback;
  const mainCats = cats.filter(c => !c.parentId && c.name && c.name.toLowerCase().includes((filterText || "").toLowerCase()));
  container.innerHTML = "";
  const defImg = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80";
  mainCats.forEach(cat => {
    const item = document.createElement("div");
    item.className = "cat-app-item";
    item.onclick = () => openCategory(cat.id, cat.name, cat.image, null);
    const imgSrc = (cat.image && cat.image.trim().length > 10) ? cat.image : defImg;
    item.innerHTML = `<div class="cat-app-avatar"><img src="${imgSrc}" alt="${cat.name}" onerror="this.src='${defImg}'"></div><span class="cat-app-label">${cat.name}</span>`;
    container.appendChild(item);
  });
}

function filterCategories() { renderCategories(document.getElementById("category-search")?.value.trim() || ""); }

function getTargetFieldConfig(catName) {
  const n = (catName || "").toLowerCase();
  if (n.includes("متابع") || n.includes("فيسبوك") || n.includes("تيك") || n.includes("انست") || n.includes("يوتيوب") || n.includes("تيلي")) return { label: "رابط الصفحة أو الحساب", placeholder: "ضع رابط الصفحة هنا (https://...)" };
  if (n.includes("mtn") || n.includes("سيرياتيل") || n.includes("syriatel") || n.includes("رصيد") || n.includes("وحدات")) return { label: "رقم الهاتف (بدون +963)", placeholder: "مثال: 09xxxxxxxx" };
  return { label: "معرف اللاعب (ID) أو الحساب", placeholder: "أدخل المعرف (ID) المطلوب" };
}

function openCategory(catId, catName, catImage, parentInfo = null) {
  const users = getDB("users", []);
  if (!users[0] || !users[0].name || users[0].name === "زائر") { if (typeof openAuthModal === "function") openAuthModal(); return; }
  currentParentCategory = parentInfo;
  document.getElementById("categories-container").classList.add("hidden");
  document.querySelector(".search-pill-box")?.classList.add("hidden");
  document.getElementById("products-view")?.classList.remove("hidden");
  document.getElementById("current-category-title").innerText = catName;
  const container = document.getElementById("products-container");
  const defImg = (catImage && catImage.trim().length > 10) ? catImage : "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80";

  const fallbackCats = typeof initialCategories !== "undefined" ? initialCategories : [];
  let allCats = getDB("categories", fallbackCats);
  if (!Array.isArray(allCats) || !allCats.length) allCats = fallbackCats;
  const subs = allCats.filter(c => c.parentId === catId);
  if (subs.length > 0) {
    container.className = "categories-app-grid";
    container.innerHTML = subs.map(s => `<div class="cat-app-item" onclick="openCategory('${s.id}','${s.name.replace(/'/g, "\\'")}','${s.image || defImg}',{id:'${catId}',name:'${catName.replace(/'/g, "\\'")}',image:'${defImg}'})"><div class="cat-app-avatar"><img src="${s.image || defImg}"></div><span class="cat-app-label">${s.name}</span></div>`).join("");
    return;
  }

  const catProducts = getDB("products", []).filter(p => p.categoryId === catId);
  if (!catProducts.length) {
    container.className = "products-compact-grid";
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;"><p>لا توجد باقات حالياً.</p><button class="btn-back-pill" onclick="backToCategories()">رجوع</button></div>`;
    return;
  }

  let opts = `<option value="" disabled selected>اختر الباقة</option>`;
  catProducts.forEach(p => {
    const unitUSD = calculateProductFinalPrice(p);
    const isVar = isVariableQuantityProduct(p);
    const hasList = Array.isArray(p.qtyValues) && p.qtyValues.length > 0;
    const nl = (p.name || "").toLowerCase();
    const defMin = nl.includes("mtn") ? 10 : (nl.includes("سيرياتيل") || nl.includes("syriatel") ? 1.92 : 1);
    const minQ = hasList ? Number(p.qtyValues[0]) : (p.qtyValues?.min || defMin);
    const maxQ = hasList ? Number(p.qtyValues[p.qtyValues.length - 1]) : (p.qtyValues?.max || 100000);
    const listStr = hasList ? encodeURIComponent(JSON.stringify(p.qtyValues)) : "";
    opts += `<option value="${p.id}" data-price="${unitUSD}" data-varqty="${isVar ? '1' : '0'}" data-min="${minQ}" data-max="${maxQ}" data-qtylist="${listStr}">${p.name} (${isVar ? formatStoreAmount(unitUSD) + ' للوحدة' : formatStoreAmount(unitUSD)})</option>`;
  });

  const cfg = getTargetFieldConfig(catName);
  container.className = "service-order-wrapper";
  container.innerHTML = `<div class="service-top-card"><div class="service-logo-box"><img src="${defImg}"></div><h2 class="service-title-text">${catName}</h2></div>
    <form class="service-order-form" onsubmit="handleServiceOrder(event,'${catId}','${catName.replace(/'/g, "\\'")}')">
      <div class="field-block"><label class="field-label">${cfg.label}</label><input type="text" id="srv-target-input" class="field-input" placeholder="${cfg.placeholder}" required dir="ltr"></div>
      <div class="field-block"><label class="field-label">اختر الباقة</label><div class="select-dropdown-box"><select id="srv-package-select" class="field-select" required onchange="onPackageSelectChange()">${opts}</select></div></div>
      <div class="field-block hidden" id="srv-qty-block"><label class="field-label" id="srv-qty-label" style="color:#38bdf8;">الكمية المطلوبة:</label><div id="srv-qty-control-wrap"></div></div>
      <div class="order-summary-bar"><span>السعر المطلوب:</span><strong id="srv-price-display" style="color:var(--accent-cyan);font-size:1.1rem;">${formatStoreAmount(0)}</strong></div>
      <button type="submit" id="btn-submit-service-order" class="btn-confirm-order"><i class="fa-solid fa-paper-plane"></i> تأكيد الطلب والشحن الفوري</button>
    </form>`;
}

function onPackageSelectChange(preserveQty = false) {
  const select = document.getElementById("srv-package-select"), display = document.getElementById("srv-price-display");
  const qtyBlock = document.getElementById("srv-qty-block"), qtyWrap = document.getElementById("srv-qty-control-wrap"), qtyLabel = document.getElementById("srv-qty-label");
  if (!select || !display) return;
  const opt = select.options[select.selectedIndex];
  if (!opt || !opt.dataset.price) { display.innerText = formatStoreAmount(0); qtyBlock?.classList.add("hidden"); return; }

  const unitUSD = parseFloat(opt.dataset.price) || 0, isVar = opt.dataset.varqty === "1";
  const minQ = parseFloat(opt.dataset.min || "1"), maxQ = parseFloat(opt.dataset.max || "100000");
  let qtyList = null;
  try { qtyList = opt.dataset.qtylist ? JSON.parse(decodeURIComponent(opt.dataset.qtylist)) : null; } catch (e) {}
  let qty = 1;

  if (qtyBlock && qtyWrap) {
    qtyBlock.classList.toggle("hidden", !isVar);
    if (isVar) {
      if (Array.isArray(qtyList) && qtyList.length > 0) {
        if (!preserveQty || !document.getElementById("srv-qty-select")) {
          qtyWrap.innerHTML = `<div class="select-dropdown-box"><select id="srv-qty-select" class="field-select" onchange="onPackageSelectChange(true)" dir="ltr">${qtyList.map(q => `<option value="${q}">${q}</option>`).join("")}</select></div>`;
        }
        if (qtyLabel) qtyLabel.innerText = "اختر الكمية المعتمدة:";
        qty = parseFloat(document.getElementById("srv-qty-select")?.value || String(qtyList[0]));
      } else {
        // حرية كاملة للمستخدم بمسح الرقم وكتابة أي كمية يريدها دون مقاطعة أثناء الكتابة
        if (!preserveQty || !document.getElementById("srv-qty-input")) {
          qtyWrap.innerHTML = `<input type="number" id="srv-qty-input" class="field-input" min="${minQ}" max="${maxQ}" step="any" value="${minQ}" placeholder="أدخل الكمية (أقل كمية ${minQ})" oninput="onPackageSelectChange(true)" dir="ltr">`;
        }
        const inp = document.getElementById("srv-qty-input");
        if (qtyLabel) qtyLabel.innerText = `الكمية المطلوبة (من ${minQ} إلى ${maxQ}):`;
        const typedVal = parseFloat(inp?.value || "0");
        qty = (!isNaN(typedVal) && typedVal > 0) ? typedVal : 0;
      }
    }
  }
  display.innerText = formatStoreAmount(unitUSD * qty);
}

async function handleServiceOrder(e, catId, catName) {
  e.preventDefault();
  const users = getDB("users", []);
  if (!users[0] || !users[0].name || users[0].name === "زائر") { if (typeof openAuthModal === "function") openAuthModal(); return; }
  const targetInput = document.getElementById("srv-target-input").value.trim();
  const selectEl = document.getElementById("srv-package-select");
  const prodId = selectEl.value;
  const product = getDB("products", []).find(p => p.id === prodId);
  if (!product) return;

  const isVar = isVariableQuantityProduct(product);
  const opt = selectEl.options[selectEl.selectedIndex];
  const minAllowed = parseFloat(opt?.dataset.min || "1");
  const rawQty = document.getElementById("srv-qty-select")?.value || document.getElementById("srv-qty-input")?.value || "1";
  const orderQty = isVar ? parseFloat(rawQty) : 1;

  if (isVar && (isNaN(orderQty) || orderQty < minAllowed)) {
    alert(`⚠️ أقل كمية مسموحة لهذه الخدمة هي: ${minAllowed}`);
    return;
  }

  const totalPrice = Number((calculateProductFinalPrice(product) * orderQty).toFixed(3));
  if ((users[0].balanceUSD || 0) < totalPrice) { alert("رصيدك لا يكفي!"); return; }

  const supId = (product.supplierId || "").trim();
  if (!supId) { alert("⚠️ المنتج غير مربوط برقم المورد! أعد استيراده من لوحة التحكم."); return; }

  const btn = document.getElementById("btn-submit-service-order");
  if (btn) { btn.disabled = true; btn.innerText = "جاري الإرسال..."; }

  const supCfg = getActiveSupplierConfig();
  const uuid = generateUUIDv4();
  let supOrderId = "", orderStatus = "تم الإرسال للمورد ✓";

  try {
    let res;
    if (supCfg.type === "parabyte_v2") {
      res = await fetch(`${SUPPLIER_WORKER_URL}?url=${encodeURIComponent(supCfg.orderUrl)}&token=${encodeURIComponent(supCfg.token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json", "api-token": supCfg.token },
        body: JSON.stringify({ product_id: isNaN(Number(supId)) ? supId : Number(supId), qty: orderQty, order_uuid: uuid, params: { [product.paramField || "player_id"]: targetInput } })
      });
    } else {
      const pKey = product.paramField || "playerId";
      const tUrl = `${supCfg.orderUrl}/${encodeURIComponent(supId)}/params?qty=${encodeURIComponent(orderQty)}&${encodeURIComponent(pKey)}=${encodeURIComponent(targetInput)}&playerId=${encodeURIComponent(targetInput)}&order_uuid=${encodeURIComponent(uuid)}`;
      res = await fetch(`${SUPPLIER_WORKER_URL}?url=${encodeURIComponent(tUrl)}&token=${encodeURIComponent(supCfg.token)}`, {
        headers: { "Accept": "application/json", "api-token": supCfg.token }
      });
    }
    const raw = await res.text();
    let result = {};
    try { result = JSON.parse(raw); } catch (err) { alert("⚠️ رد غير متوقع:\n" + raw.slice(0, 200)); if (btn) { btn.disabled = false; btn.innerText = "تأكيد الطلب والشحن الفوري"; } return; }

    const errMsg = result.detail?.message || result.msg || result.message || result.error || "";
    const ok = res.ok && !result.detail && !result.error && (String(result.status || "").toUpperCase() === "OK" || result.status === true || Boolean(result.order_id) || Boolean(result.data?.order_id || result.data?.id));
    if (!ok) { alert("⚠️ رفض المورد الطلب:\n" + (errMsg || raw.slice(0, 200))); if (btn) { btn.disabled = false; btn.innerText = "تأكيد الطلب والشحن الفوري"; } return; }
    supOrderId = result.data?.order_id || result.data?.id || result.order_id || uuid;
  } catch (err) {
    alert("⚠️ خطأ اتصال: " + err.message);
    if (btn) { btn.disabled = false; btn.innerText = "تأكيد الطلب والشحن الفوري"; }
    return;
  }

  users[0].balanceUSD = Number((users[0].balanceUSD - totalPrice).toFixed(3));
  setDB("users", users);

  const nowTs = Date.now();
  const orders = cleanupExpiredOrders24h();
  orders.unshift({
    id: "ord_" + nowTs,
    timestamp: nowTs,
    userName: users[0].name,
    userEmail: users[0].email || "",
    supplierOrderId: supOrderId,
    categoryName: catName,
    packageName: product.name,
    qty: orderQty,
    target: targetInput,
    price: totalPrice,
    date: new Date(nowTs).toLocaleString("ar-SY"),
    status: orderStatus
  });
  setDB("orders", orders);

  const dailyStats = getUserDailyOrdersStats(users[0]);
  if (btn) { btn.disabled = false; btn.innerText = "تأكيد الطلب والشحن الفوري"; }
  updateUserUI();
  alert(`✅ تم إرسال الطلب بنجاح!\nالمستلم: ${targetInput}\nالكمية: ${orderQty}\n📊 عدد طلباتك اليوم: ${dailyStats.count}`);
  backToCategories();
}

function backToCategories() {
  if (currentParentCategory) { const p = currentParentCategory; currentParentCategory = null; openCategory(p.id, p.name, p.image, null); return; }
  document.getElementById("products-view")?.classList.add("hidden");
  document.getElementById("categories-container")?.classList.remove("hidden");
  document.querySelector(".search-pill-box")?.classList.remove("hidden");
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
