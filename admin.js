// ============================================================================
// لوحة تحكم الإدارة الكاملة + زر حذف المستخدم + واتساب + الأرباح اليومية (admin.js - v145)
// ============================================================================

const ADMIN_SECTIONS = [
  "stats",
  "pricing-offers",
  "site-settings",
  "users",
  "upgrade-user",
  "products",
  "add-product",
  "import-supplier",
  "categories",
  "add-category",
  "deposit-requests",
  "deposit-methods",
  "add-deposit-method"
];

function openAdminPanel() {
  const wrapper = document.getElementById("admin-wrapper");
  if (!wrapper) return;
  if (typeof toggleSidebar === "function") {
    const drawer = document.getElementById("sidebar-drawer");
    if (drawer && drawer.classList.contains("open")) toggleSidebar(false);
  }
  wrapper.classList.remove("hidden");
  wrapper.style.display = "block";
  updateMaintenanceAdminBtn();
  switchAdminSection("stats");
}

function closeAdminPanel() {
  const wrapper = document.getElementById("admin-wrapper");
  if (wrapper) {
    wrapper.classList.add("hidden");
    wrapper.style.display = "none";
  }
  if (typeof renderCategories === "function") renderCategories();
  if (typeof loadSiteSettings === "function") loadSiteSettings();
}

function switchAdminSection(secName) {
  ADMIN_SECTIONS.forEach(id => {
    const el = document.getElementById("sec-" + id);
    if (el) el.classList.add("hidden");
  });

  const target = document.getElementById("sec-" + secName);
  if (target) target.classList.remove("hidden");

  document.querySelectorAll(".admin-nav-item").forEach(btn => {
    btn.classList.remove("active");
    if (btn.getAttribute("onclick") && btn.getAttribute("onclick").includes(`'${secName}'`)) {
      btn.classList.add("active");
    }
  });

  if (secName === "stats") renderAdminStats();
  if (secName === "pricing-offers") renderPricingOffersSection();
  if (secName === "site-settings") loadSiteSettingsIntoForm();
  if (secName === "users") renderAdminUsers();
  if (secName === "products") renderAdminProducts();
  if (secName === "add-product") populateAdminProductCategories();
  if (secName === "import-supplier") populateSupplierCategoriesDropdown();
  if (secName === "categories") renderAdminCategories();
  if (secName === "add-category") populateAdminParentCategories();
  if (secName === "deposit-requests") renderAdminDepositRequests();
  if (secName === "deposit-methods") renderAdminDepositMethods();
}

function toggleMaintenanceMode() {
  const current = !!getDB("maintenance_mode", false);
  const next = !current;
  setDB("maintenance_mode", next);
  updateMaintenanceAdminBtn();
}

function updateMaintenanceAdminBtn() {
  const btn = document.getElementById("admin-maintenance-btn");
  if (!btn) return;
  const isMaint = !!getDB("maintenance_mode", false);
  btn.innerText = isMaint ? "وضع الصيانة: مفعل" : "وضع الصيانة: معطل";
  btn.style.background = isMaint ? "#ef4444" : "#10b981";
}

function renderAdminStats() {
  const salesEl = document.getElementById("stat-sales");
  const countEl = document.getElementById("stat-orders-count");
  const depEl = document.getElementById("stat-total-deposits");
  
  const orders = getDB("user_orders", []);
  const deposits = getDB("deposit_requests", []).filter(d => d.status === "approved");
  
  let totalSales = orders.reduce((sum, o) => sum + (parseFloat(o.totalUSD) || 0), 0);
  let totalDep = deposits.reduce((sum, d) => sum + (parseFloat(d.amountUSD) || 0), 0);

  if (salesEl) salesEl.innerText = `$${totalSales.toFixed(2)}`;
  if (countEl) countEl.innerText = orders.length;
  if (depEl) depEl.innerText = `$${totalDep.toFixed(2)}`;
}

function renderPricingOffersSection() {
  const globalInput = document.getElementById("global-profit-percent");
  if (globalInput) globalInput.value = getDB("global_profit_percent", 0);

  const container = document.getElementById("category-offers-list");
  if (!container) return;

  const categories = getDB("categories", typeof initialCategories !== "undefined" ? initialCategories : []);
  const catPercents = getDB("category_profit_percents", {});

  container.innerHTML = categories.map(cat => `
    <div style="display:flex; justify-content:space-between; align-items:center; background:#0c1527; padding:10px; border-radius:10px; margin-bottom:8px; border:1px solid rgba(56,189,248,0.2);">
      <span style="font-size:0.85rem; font-weight:700; color:#fff;">${cat.name}</span>
      <div style="display:flex; gap:6px; align-items:center;">
        <input type="number" step="any" id="cat-pct-${cat.id}" value="${catPercents[cat.id] !== undefined ? catPercents[cat.id] : ''}" placeholder="النسبة %" style="width:90px; background:#162444; border:1px solid #334155; color:#fff; padding:6px; border-radius:8px; text-align:center;">
        <button type="button" onclick="saveCategoryProfitPercent('${cat.id}')" style="background:#0284c7; color:#fff; border:none; padding:6px 12px; border-radius:8px; font-weight:700; cursor:pointer;">حفظ</button>
      </div>
    </div>
  `).join("");
}

function saveGlobalProfitPercent() {
  const val = parseFloat(document.getElementById("global-profit-percent")?.value) || 0;
  setDB("global_profit_percent", val);
  alert("تم حفظ نسبة الربح العامة بنجاح!");
}

function saveCategoryProfitPercent(catId) {
  const val = parseFloat(document.getElementById(`cat-pct-${catId}`)?.value);
  const catPercents = getDB("category_profit_percents", {});
  if (isNaN(val)) {
    delete catPercents[catId];
  } else {
    catPercents[catId] = val;
  }
  setDB("category_profit_percents", catPercents);
  alert("تم حفظ نسبة القسم بنجاح!");
}

function loadSiteSettingsIntoForm() {
  const settings = getDB("site_settings", {
    siteName: "Mohannad kard",
    whatsapp: "963957455972",
    logo: "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=100&q=80",
    banner: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1000&q=80"
  });

  const nameEl = document.getElementById("setting-site-name");
  const waEl = document.getElementById("setting-whatsapp-number");
  const logoEl = document.getElementById("setting-site-logo");
  const bannerEl = document.getElementById("setting-site-banner");

  if (nameEl) nameEl.value = settings.siteName || "";
  if (waEl) waEl.value = settings.whatsapp || "";
  if (logoEl) logoEl.value = settings.logo || "";
  if (bannerEl) bannerEl.value = settings.banner || "";
}

function handleSiteSettingsUpdate(e) {
  e.preventDefault();
  const settings = {
    siteName: document.getElementById("setting-site-name")?.value.trim() || "Mohannad kard",
    whatsapp: document.getElementById("setting-whatsapp-number")?.value.trim() || "963957455972",
    logo: document.getElementById("setting-site-logo")?.value.trim() || "",
    banner: document.getElementById("setting-site-banner")?.value.trim() || ""
  };

  setDB("site_settings", settings);
  alert("تم حفظ إعدادات المتجر بنجاح!");
  if (typeof loadSiteSettings === "function") loadSiteSettings();
}

function renderAdminUsers() {
  const container = document.getElementById("admin-users-list");
  if (!container) return;
  const users = getDB("app_users", []);

  if (!users.length) {
    container.innerHTML = `<p style="color:#94a3b8;">لا يوجد مسجلين حالياً.</p>`;
    return;
  }

  container.innerHTML = users.map(u => `
    <div style="background:#0c1527; padding:12px; border-radius:12px; margin-bottom:10px; border:1px solid rgba(56,189,248,0.2); display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-weight:800; color:#fff;">${u.name || "مستخدم"}</div>
        <div style="font-size:0.78rem; color:#94a3b8;">${u.email} | الرتبة: <span style="color:#38bdf8;">${u.rank || "عضو"}</span></div>
        <div style="font-size:0.78rem; color:#10b981; font-weight:700;">الرصيد: $${(parseFloat(u.balance) || 0).toFixed(2)}</div>
      </div>
      <button type="button" onclick="deleteAppUser('${u.email}')" style="background:#ef4444; color:#fff; border:none; padding:6px 10px; border-radius:8px; font-weight:700; cursor:pointer;">حذف</button>
    </div>
  `).join("");
}

function deleteAppUser(email) {
  if (!confirm(`هل أنت متأكد من حذف المستخدم ${email}؟`)) return;
  const users = getDB("app_users", []).filter(u => u.email !== email);
  setDB("app_users", users);
  renderAdminUsers();
}

function submitUserUpgrade() {
  const query = document.getElementById("upgrade-search-input")?.value.trim().toLowerCase();
  const newRole = document.getElementById("upgrade-role-select")?.value;
  if (!query) { alert("أدخل البريد أو اسم المستخدم"); return; }

  const users = getDB("app_users", []);
  const user = users.find(u => u.email.toLowerCase() === query || (u.name && u.name.toLowerCase().includes(query)));

  if (!user) { alert("لم يتم العثور على المستخدم!"); return; }

  user.rank = newRole;
  setDB("app_users", users);
  alert(`تم ترقية المستخدم ${user.name} إلى (${newRole}) بنجاح!`);
}

function renderAdminProducts() {
  const tbody = document.getElementById("admin-products-table");
  if (!tbody) return;
  const products = getDB("products", typeof initialProducts !== "undefined" ? initialProducts : []);

  tbody.innerHTML = products.map(p => `
    <tr>
      <td>${p.name}</td>
      <td>${p.categoryId || "-"}</td>
      <td>$${parseFloat(p.priceUSD || 0).toFixed(2)}</td>
      <td><button type="button" style="background:#ef4444; color:#fff; border:none; padding:4px 8px; border-radius:6px; cursor:pointer;" onclick="deleteAdminProduct('${p.id}')">حذف</button></td>
    </tr>
  `).join("");
}

function populateAdminProductCategories() {
  const sel = document.getElementById("prod-category-select");
  if (!sel) return;
  const categories = getDB("categories", typeof initialCategories !== "undefined" ? initialCategories : []);
  sel.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
}

function handleAddProduct(e) {
  e.preventDefault();
  const categoryId = document.getElementById("prod-category-select")?.value;
  const name = document.getElementById("prod-name")?.value.trim();
  const priceUSD = parseFloat(document.getElementById("prod-price-usd")?.value) || 0;
  const desc = document.getElementById("prod-desc")?.value.trim() || "";
  const image = document.getElementById("prod-image")?.value.trim() || "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=300&q=80";

  const products = getDB("products", typeof initialProducts !== "undefined" ? initialProducts : []);
  products.push({
    id: "prod_" + Date.now(),
    categoryId,
    name,
    priceUSD,
    priceSYP: Math.round(priceUSD * 155),
    desc,
    image
  });

  setDB("products", products);
  e.target.reset();
  alert("تمت إضافة المنتج بنجاح!");
  switchAdminSection("products");
}

function deleteAdminProduct(prodId) {
  if (!confirm("هل تريد حذف هذا المنتج؟")) return;
  setDB("products", getDB("products", []).filter(p => p.id !== prodId));
  renderAdminProducts();
}

function populateAdminParentCategories() {
  const sel = document.getElementById("cat-parent-select");
  if (!sel) return;
  const categories = getDB("categories", typeof initialCategories !== "undefined" ? initialCategories : []);
  const mainCats = categories.filter(c => !c.parentId);
  sel.innerHTML = `<option value="">قسم رئيسي</option>` + mainCats.map(c => `<option value="${c.id}">فرعي داخل: ${c.name}</option>`).join("");
}

function renderAdminCategories() {
  const tbody = document.getElementById("admin-categories-table");
  if (!tbody) return;
  const categories = getDB("categories", typeof initialCategories !== "undefined" ? initialCategories : []);

  tbody.innerHTML = categories.map(c => {
    const parent = c.parentId ? categories.find(p => p.id === c.parentId) : null;
    return `
      <tr>
        <td>${c.name}</td>
        <td>${parent ? `فرعي (${parent.name})` : "رئيسي"}</td>
        <td><button type="button" style="background:#ef4444; color:#fff; border:none; padding:4px 8px; border-radius:6px; cursor:pointer;" onclick="deleteAdminCategory('${c.id}')">حذف</button></td>
      </tr>
    `;
  }).join("");
}

function handleAddCategory(e) {
  e.preventDefault();
  const name = document.getElementById("cat-name")?.value.trim();
  const parentId = document.getElementById("cat-parent-select")?.value || null;
  const image = document.getElementById("cat-image")?.value.trim() || "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=300&q=80";

  const categories = getDB("categories", typeof initialCategories !== "undefined" ? initialCategories : []);
  categories.push({ id: "cat_" + Date.now(), name, parentId: parentId || null, image });

  setDB("categories", categories);
  e.target.reset();
  alert("تمت إضافة القسم بنجاح!");
  switchAdminSection("categories");
}

function deleteAdminCategory(catId) {
  if (!confirm("هل تريد حذف هذا القسم؟")) return;
  setDB("categories", getDB("categories", []).filter(c => c.id !== catId && c.parentId !== catId));
  renderAdminCategories();
}

function renderAdminDepositRequests() {
  const container = document.getElementById("deposit-requests-container");
  if (!container) return;
  const requests = getDB("deposit_requests", []);

  if (!requests.length) {
    container.innerHTML = `<p style="color:#94a3b8;">لا توجد طلبات إيداع حالياً.</p>`;
    return;
  }

  container.innerHTML = requests.slice().reverse().map(req => {
    const isPending = req.status === "pending" || req.status === "معلق" || req.status === "قيد الانتظار" || !req.status;
    const amt = parseFloat(req.amountUSD || req.amount || 0);
    return `
      <div style="background:#0c1527; padding:12px; border-radius:12px; margin-bottom:10px; border:1px solid rgba(56,189,248,0.2);">
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <strong>${req.userName || "مستخدم"}</strong>
          <span style="color:#38bdf8; font-weight:800;">$${amt.toFixed(2)}</span>
        </div>
        <div style="font-size:0.78rem; color:#cbd5e1; margin-bottom:6px;">الوسيلة: ${req.methodName || "-"} | المرسل: ${req.sender || "-"}</div>
        ${req.note ? `<div style="font-size:0.75rem; color:#94a3b8; margin-bottom:6px;">ملاحظة: ${req.note}</div>` : ""}
        ${(req.receipt || req.receiptImage) ? `<img src="${req.receipt || req.receiptImage}" style="max-width:140px; border-radius:8px; margin-bottom:8px; display:block;">` : ""}
        ${isPending ? `
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn-submit" style="background:#10b981; margin:0; padding:6px;" onclick="processDepositRequest('${req.id}', true)">قبول وإضافة الرصيد</button>
            <button type="button" class="btn-submit" style="background:#ef4444; margin:0; padding:6px;" onclick="processDepositRequest('${req.id}', false)">رفض</button>
          </div>
        ` : `<span style="font-size:0.78rem; color:${req.status === 'approved' ? '#10b981' : '#ef4444'};">الحالة: ${req.status === 'approved' ? 'مقبول' : 'مرفوض'}</span>`}
      </div>
    `;
  }).join("");
}

function processDepositRequest(reqId, approve) {
  const requests = getDB("deposit_requests", []);
  const idx = requests.findIndex(r => String(r.id) === String(reqId));
  if (idx === -1) return;

  requests[idx].status = approve ? "approved" : "rejected";
  setDB("deposit_requests", requests);

  if (approve) {
    const req = requests[idx];
    const amountToAdd = parseFloat(req.amountUSD || req.amount || 0);
    const users = getDB("app_users", []);
    const user = users.find(u => u.email === req.userEmail || u.name === req.userName);
    if (user) {
      user.balance = (parseFloat(user.balance) || 0) + amountToAdd;
      setDB("app_users", users);
    }
  }

  renderAdminDepositRequests();
  alert(approve ? "تم قبول الطلب وإضافة الرصيد بنجاح!" : "تم رفض الطلب.");
}

function renderAdminDepositMethods() {
  const container = document.getElementById("admin-methods-container");
  if (!container) return;
  const methods = getDB("deposit_methods", typeof initialDepositMethods !== "undefined" ? initialDepositMethods : []);

  if (!methods.length) {
    container.innerHTML = `<p style="color:#94a3b8;">لا توجد وسائل إيداع مضافة.</p>`;
    return;
  }

  container.innerHTML = methods.map(m => `
    <div style="background:#0c1527; padding:12px; border-radius:12px; margin-bottom:10px; border:1px solid rgba(56,189,248,0.2); display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-weight:800; color:#fff;">${m.name}</div>
        <div style="font-size:0.78rem; color:#94a3b8;">الحساب: ${m.account} | الصرف: ${m.rate} ل.س</div>
      </div>
      <button type="button" onclick="deleteAdminDepositMethod('${m.id}')" style="background:#ef4444; color:#fff; border:none; padding:6px 10px; border-radius:8px; font-weight:700; cursor:pointer;">حذف</button>
    </div>
  `).join("");
}

function handleAddDepositMethod(e) {
  e.preventDefault();
  const name = document.getElementById("method-name")?.value.trim();
  const account = document.getElementById("method-account")?.value.trim();
  const rate = parseFloat(document.getElementById("method-rate")?.value) || 155;
  const qr = document.getElementById("method-qr")?.value.trim() || "";
  const icon = document.getElementById("method-icon")?.value.trim() || "";

  const methods = getDB("deposit_methods", typeof initialDepositMethods !== "undefined" ? initialDepositMethods : []);
  methods.push({ id: "m_" + Date.now(), name, account, rate, qr, icon });

  setDB("deposit_methods", methods);
  e.target.reset();
  alert("تمت إضافة وسيلة الدفع بنجاح!");
  switchAdminSection("deposit-methods");
}

function deleteAdminDepositMethod(mId) {
  if (!confirm("هل تريد حذف وسيلة الدفع هذه؟")) return;
  setDB("deposit_methods", getDB("deposit_methods", []).filter(m => m.id !== mId));
  renderAdminDepositMethods();
}

const ADMIN_SHAMS_URL = "https://api.shams4store.com/client/api/products";
const ADMIN_SHAMS_TOKEN = "fd7769b4023103836b0ae5fcbc13f9df6f5ac6a7c519a427";

const defaultSupplierCatalog = [
  { supplierId: "SUP-101", app: "PUBG Mobile", name: "شحن 60 شدة ببجي عالمية (ID)", supplierPriceUSD: 0.92, image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=300&q=80", desc: "شحن فوري عبر الآيدي (ID) خلال ثوانٍ" },
  { supplierId: "SUP-102", app: "PUBG Mobile", name: "شحن 325 شدة ببجي عالمية (ID)", supplierPriceUSD: 4.55, image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=300&q=80", desc: "شحن مباشر بالآيدي لجميع الحسابات العالمية" },
  { supplierId: "SUP-103", app: "PUBG Mobile", name: "شحن 660 شدة ببجي عالمية (ID)", supplierPriceUSD: 9.10, image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=300&q=80", desc: "شحن فوري وآمن 100% بالآيدي" },
  { supplierId: "SUP-201", app: "Free Fire", name: "شحن 100 جوهرة فري فاير (ID)", supplierPriceUSD: 1.05, image: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=300&q=80", desc: "شحن مباشر بالآيدي خلال دقيقة" },
  { supplierId: "SUP-301", app: "TikTok", name: "1000 متابع تيك توك حقيقي ومستقر", supplierPriceUSD: 1.40, image: "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?auto=format&fit=crop&w=300&q=80", desc: "ضع رابط الحساب - تنفيذ تلقائي سريع" }
];

function getSupplierCatalog() {
  const customCatalog = getDB("supplier_catalog", []);
  return [...customCatalog, ...defaultSupplierCatalog];
}

function populateSupplierCategoriesDropdown() {
  const selectEl = document.getElementById("supplier-target-category");
  if (!selectEl) return;

  const categories = getDB("categories", typeof initialCategories !== "undefined" ? initialCategories : []);
  if (!categories.length) {
    selectEl.innerHTML = `<option value="">لا توجد أقسام - أضف قسماً أولاً</option>`;
    return;
  }

  selectEl.innerHTML = categories.map(cat => {
    const parent = cat.parentId ? categories.find(c => c.id === cat.parentId) : null;
    const label = parent ? `${parent.name} ⬅ ${cat.name}` : cat.name;
    return `<option value="${cat.id}">${label}</option>`;
  }).join("");

  const savedUrl = getDB("supplier_api_url", ADMIN_SHAMS_URL);
  const savedKey = getDB("supplier_api_key", ADMIN_SHAMS_TOKEN);

  const urlInput = document.getElementById("supplier-api-url");
  const keyInput = document.getElementById("supplier-api-key");
  if (urlInput) urlInput.value = savedUrl;
  if (keyInput) keyInput.value = savedKey;

  searchSupplierCatalog();
}

function searchSupplierCatalog() {
  const query = (document.getElementById("supplier-search-input")?.value || "").trim().toLowerCase();
  const container = document.getElementById("supplier-results-container");
  const infoEl = document.getElementById("supplier-results-info");
  const targetCatId = document.getElementById("supplier-target-category")?.value;

  if (!container) return;

  const catalog = getSupplierCatalog();
  const existingProducts = getDB("products", []);

  const filtered = query
    ? catalog.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.app.toLowerCase().includes(query) ||
        (item.desc && item.desc.toLowerCase().includes(query))
      )
    : catalog;

  if (infoEl) infoEl.textContent = `عدد المنتجات المطابقة في المورد: ${filtered.length} منتج`;

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8; background:#0c1527; border-radius:12px;">لا توجد منتجات مطابقة لـ "${query}"</div>`;
    return;
  }

  const globalPercent = parseFloat(getDB("global_profit_percent", 0)) || 0;
  const catPercents = getDB("category_profit_percents", {});
  const appliedPercent = (targetCatId && catPercents[targetCatId] !== undefined)
    ? parseFloat(catPercents[targetCatId])
    : globalPercent;

  container.innerHTML = filtered.slice(0, 120).map(item => {
    const finalUSD = +(item.supplierPriceUSD * (1 + appliedPercent / 100)).toFixed(4);
    const alreadyAdded = existingProducts.some(
      p => p.categoryId === targetCatId && (p.supplierId === item.supplierId || p.name === item.name)
    );

    return `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; background:#0c1527; border:1px solid rgba(56,189,248,0.2); padding:12px; border-radius:14px;">
        <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
          <img src="${item.image}" alt="${item.name}" style="width:46px; height:46px; border-radius:10px; object-fit:cover; flex-shrink:0;">
          <div style="min-width:0;">
            <div style="font-size:0.72rem; color:#38bdf8; font-weight:700;">${item.app}</div>
            <div style="font-size:0.86rem; font-weight:800; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.name}</div>
            <div style="font-size:0.75rem; color:#94a3b8;">
              سعر المورد: <strong style="color:#f59e0b;">$${item.supplierPriceUSD.toFixed(4)}</strong>
              | سعر البيع: <strong style="color:#10b981;">$${finalUSD.toFixed(4)}</strong>
            </div>
          </div>
        </div>

        <button type="button"
          onclick="addSupplierProductToStore('${item.supplierId.replace(/'/g, "\\'")}')"
          style="background:${alreadyAdded ? '#10b981' : '#0284c7'}; color:#fff; border:none; padding:8px 14px; border-radius:10px; font-family:'Cairo'; font-size:0.8rem; font-weight:800; cursor:pointer; flex-shrink:0; display:flex; align-items:center; gap:5px;">
          <i class="fa-solid ${alreadyAdded ? 'fa-check' : 'fa-plus'}"></i>
          ${alreadyAdded ? 'مُضاف' : 'إضافة'}
        </button>
      </div>
    `;
  }).join("");
}

function addSupplierProductToStore(supplierId) {
  const targetCatId = document.getElementById("supplier-target-category")?.value;
  if (!targetCatId) { alert("يرجى اختيار القسم المستهدف في موقعك أولاً!"); return; }

  const catalog = getSupplierCatalog();
  const item = catalog.find(i => i.supplierId === supplierId);
  if (!item) return;

  const products = getDB("products", []);
  const globalPercent = parseFloat(getDB("global_profit_percent", 0)) || 0;
  const catPercents = getDB("category_profit_percents", {});
  const appliedPercent = (catPercents[targetCatId] !== undefined)
    ? parseFloat(catPercents[targetCatId])
    : globalPercent;

  const finalPriceUSD = +(item.supplierPriceUSD * (1 + appliedPercent / 100)).toFixed(4);
  const finalPriceSYP = Math.round(finalPriceUSD * 155);

  products.push({
    id: "prod_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    supplierId: item.supplierId,
    supplierApiUrl: item.supplierApiUrl || getDB("supplier_api_url", ADMIN_SHAMS_URL),
    supplierApiKey: item.supplierApiKey || getDB("supplier_api_key", ADMIN_SHAMS_TOKEN),
    supplierApiType: item.supplierApiType || "",
    categoryId: targetCatId,
    name: item.name,
    supplierPriceUSD: item.supplierPriceUSD,
    priceUSD: finalPriceUSD,
    priceSYP: finalPriceSYP,
    productType: item.productType || "package",
    qtyValues: item.qtyValues || null,
    paramField: item.paramField || "playerId",
    noParams: !!item.noParams,
    desc: item.desc || "",
    image: item.image
  });

  setDB("products", products);
  renderAdminProducts();
  searchSupplierCatalog();
}
