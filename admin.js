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
  alert(next ? "تم تفعيل وضع الصيانة للزوار." : "تم إيقاف وضع الصيانة وعاد المتجر للعمل.");
}

function updateMaintenanceAdminBtn() {
  const btn = document.getElementById("admin-maintenance-btn");
  if (!btn) return;
  const isMaint = !!getDB("maintenance_mode", false);
  btn.style.background = isMaint ? "#f59e0b" : "#10b981";
  btn.innerHTML = `<i class="fa-solid fa-power-off"></i> وضع الصيانة: ${isMaint ? "مفعل" : "معطل"}`;
}

// ----------------------------------------------------------------------------
// 1. الإحصائيات العامة
// ----------------------------------------------------------------------------
function renderAdminStats() {
  const allOrders = getDB("orders", []);
  const deposits = getDB("deposit_requests", []);
  const products = getDB("products", []);
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  const dailyOrders = allOrders.filter(o => {
    const ts = Number(o.timestamp || (String(o.id || "").startsWith("ord_") ? String(o.id).split("_")[1] : now));
    const isNotRejected = !String(o.status || "").includes("مرفوض");
    return isNotRejected && (now - ts) < oneDayMs;
  });

  let dailySalesUSD = 0;
  let dailyProfitUSD = 0;

  dailyOrders.forEach(o => {
    const sale = parseFloat(o.price || o.priceUSD || 0);
    dailySalesUSD += sale;

    if (o.profitUSD !== undefined && !isNaN(parseFloat(o.profitUSD))) {
      dailyProfitUSD += parseFloat(o.profitUSD);
    } else {
      const matchedProd = products.find(p => p.name === o.packageName);
      if (matchedProd && matchedProd.supplierPriceUSD !== undefined) {
        const qty = parseFloat(o.qty || 1);
        const cost = parseFloat(matchedProd.supplierPriceUSD) * qty;
        dailyProfitUSD += Math.max(0, sale - cost);
      }
    }
  });

  const approvedDeposits = deposits
    .filter(d => d.status === "approved" || d.status === "مقبول")
    .reduce((sum, d) => sum + (parseFloat(d.amountUSD || d.amount || 0)), 0);

  const salesEl = document.getElementById("stat-sales");
  const ordersEl = document.getElementById("stat-orders-count");
  const depEl = document.getElementById("stat-total-deposits");

  if (salesEl) {
    salesEl.innerHTML = `$${dailySalesUSD.toFixed(2)} <div style="font-size:0.75rem; color:#10b981; margin-top:4px;">الربح الصافي (24س): +$${dailyProfitUSD.toFixed(2)}</div>`;
  }
  if (ordersEl) ordersEl.textContent = dailyOrders.length;
  if (depEl) depEl.textContent = `$${approvedDeposits.toFixed(2)}`;
}

// ----------------------------------------------------------------------------
// 2. نظام التسعير والعروض
// ----------------------------------------------------------------------------
function renderPricingOffersSection() {
  const globalInput = document.getElementById("global-profit-percent");
  if (globalInput) {
    globalInput.value = parseFloat(getDB("global_profit_percent", 0)) || 0;
  }

  const listEl = document.getElementById("category-offers-list");
  if (!listEl) return;

  const categories = getDB("categories", []);
  const catPercents = getDB("category_profit_percents", {});

  listEl.innerHTML = categories.map(cat => {
    const currentVal = catPercents[cat.id] !== undefined ? catPercents[cat.id] : "";
    return `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; background:#0c1527; padding:12px; border-radius:12px; margin-bottom:8px; border:1px solid rgba(56,189,248,0.15);">
        <div style="font-weight:700; font-size:0.88rem; color:#fff;">${cat.name}</div>
        <div style="display:flex; align-items:center; gap:6px;">
          <input type="number" step="any" id="cat-offer-${cat.id}" value="${currentVal}" placeholder="عام" style="width:75px; padding:6px 8px; border-radius:8px; background:#050b18; border:1px solid #334155; color:#fff; text-align:center;">
          <button type="button" onclick="saveCategoryProfitPercent('${cat.id}')" style="background:#0284c7; color:#fff; border:none; padding:6px 12px; border-radius:8px; font-weight:700; cursor:pointer;">حفظ</button>
        </div>
      </div>
    `;
  }).join("");
}

function saveGlobalProfitPercent() {
  const val = parseFloat(document.getElementById("global-profit-percent")?.value) || 0;
  setDB("global_profit_percent", val);
  recalculateAllProductPrices();
  alert(`تم حفظ النسبة العامة (${val}%) وتحديث أسعار جميع المنتجات!`);
}

function saveCategoryProfitPercent(catId) {
  const raw = document.getElementById(`cat-offer-${catId}`)?.value;
  const catPercents = getDB("category_profit_percents", {});
  if (raw === "" || raw === null || isNaN(parseFloat(raw))) {
    delete catPercents[catId];
  } else {
    catPercents[catId] = parseFloat(raw);
  }
  setDB("category_profit_percents", catPercents);
  recalculateAllProductPrices();
  alert("تم تحديث نسبة العرض لهذا القسم وتعديل أسعار منتجاته!");
}

function recalculateAllProductPrices() {
  const products = getDB("products", []);
  const globalPercent = parseFloat(getDB("global_profit_percent", 0)) || 0;
  const catPercents = getDB("category_profit_percents", {});

  const updated = products.map(p => {
    const baseCost = parseFloat(p.supplierPriceUSD !== undefined ? p.supplierPriceUSD : p.priceUSD) || 0;
    const pct = (p.customPercent !== undefined && p.customPercent !== null && p.customPercent !== "")
      ? parseFloat(p.customPercent)
      : (catPercents[p.categoryId] !== undefined ? parseFloat(catPercents[p.categoryId]) : globalPercent);
    const newUSD = +(baseCost * (1 + pct / 100)).toFixed(4);
    return {
      ...p,
      supplierPriceUSD: baseCost,
      priceUSD: newUSD,
      priceSYP: Math.round(newUSD * 155)
    };
  });

  setDB("products", updated);
}

// ----------------------------------------------------------------------------
// 3. إعدادات وهوية المتجر
// ----------------------------------------------------------------------------
function loadSiteSettingsIntoForm() {
  const settings = getDB("site_settings", {});
  if (document.getElementById("setting-site-name")) document.getElementById("setting-site-name").value = settings.name || "Mohannad kard";
  if (document.getElementById("setting-whatsapp-number")) document.getElementById("setting-whatsapp-number").value = settings.whatsapp || "0957455972";
  if (document.getElementById("setting-site-logo")) document.getElementById("setting-site-logo").value = settings.logo || "";
  if (document.getElementById("setting-site-banner")) document.getElementById("setting-site-banner").value = Array.isArray(settings.banners) ? settings.banners.join("\n") : (settings.banner || "");
}

function handleSiteSettingsUpdate(e) {
  e.preventDefault();
  const name = document.getElementById("setting-site-name").value.trim();
  const whatsapp = document.getElementById("setting-whatsapp-number").value.trim();
  const logo = document.getElementById("setting-site-logo").value.trim();
  const bannerText = document.getElementById("setting-site-banner").value.trim();
  const banners = bannerText ? bannerText.split("\n").map(s => s.trim()).filter(Boolean) : [];

  setDB("site_settings", {
    name,
    whatsapp,
    logo,
    banner: banners[0] || "",
    banners
  });

  if (typeof loadSiteSettings === "function") loadSiteSettings();
  alert("تم حفظ إعدادات وهوية المتجر بنجاح!");
}

// ----------------------------------------------------------------------------
// 4. إدارة المستخدمين والترقيات
// ----------------------------------------------------------------------------
function renderAdminUsers() {
  const container = document.getElementById("admin-users-list");
  if (!container) return;

  const users = getDB("users", []);
  if (users.length === 0) {
    container.innerHTML = `<p style="color:#94a3b8;">لا يوجد مستخدمون مسجلون حالياً.</p>`;
    return;
  }

  container.innerHTML = users.map(u => `
    <div style="background:#0c1527; border:1px solid rgba(56,189,248,0.2); border-radius:14px; padding:14px; margin-bottom:10px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <div>
          <strong style="color:#fff; font-size:0.95rem;">${u.name || u.username}</strong>
          <span style="background:#0284c7; color:#fff; font-size:0.72rem; padding:2px 8px; border-radius:10px; margin-right:6px;">${u.rank || "عضو"}</span>
          <div style="font-size:0.78rem; color:#94a3b8;">${u.email || ""} ${u.whatsapp ? " | واتساب: " + u.whatsapp : ""}</div>
        </div>
        <div style="font-weight:900; color:#10b981; font-size:1rem;">$${(parseFloat(u.balanceUSD) || 0).toFixed(3)}</div>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <button onclick="adminAdjustUserBalance('${u.id}', 1)" style="background:#10b981; color:#fff; border:none; padding:6px 10px; border-radius:8px; font-size:0.78rem; font-weight:700; cursor:pointer;">+ تعديل رصيد</button>
        <button onclick="adminDeleteUser('${u.id}')" style="background:#ef4444; color:#fff; border:none; padding:6px 10px; border-radius:8px; font-size:0.78rem; font-weight:700; cursor:pointer;">حذف المستخدم</button>
      </div>
    </div>
  `).join("");
}

function adminAdjustUserBalance(userId) {
  const users = getDB("users", []);
  const idx = users.findIndex(u => String(u.id) === String(userId));
  if (idx === -1) return;

  const valStr = prompt(`الرصيد الحالي لـ (${users[idx].name || users[idx].username}) هو $${(parseFloat(users[idx].balanceUSD) || 0).toFixed(3)}.\nأدخل المبلغ المراد إضافته (أو بالسالب للخصم):`);
  if (valStr === null || valStr.trim() === "") return;
  const delta = parseFloat(valStr);
  if (isNaN(delta)) { alert("يرجى إدخال رقم صحيح!"); return; }

  users[idx].balanceUSD = Math.max(0, +((parseFloat(users[idx].balanceUSD) || 0) + delta).toFixed(4));
  setDB("users", users);

  const cur = getDB("currentUser", null);
  if (cur && String(cur.id) === String(userId)) {
    setDB("currentUser", users[idx]);
    if (typeof updateUserUI === "function") updateUserUI();
  }

  renderAdminUsers();
  alert("تم تحديث رصيد المستخدم بنجاح!");
}

function adminDeleteUser(userId) {
  if (!confirm("هل أنت متأكد من حذف هذا المستخدم نهائياً؟")) return;
  const users = getDB("users", []).filter(u => String(u.id) !== String(userId));
  setDB("users", users);
  renderAdminUsers();
}

function submitUserUpgrade() {
  const query = (document.getElementById("upgrade-search-input")?.value || "").trim().toLowerCase();
  const newRank = document.getElementById("upgrade-role-select")?.value || "VIP 1";
  if (!query) { alert("أدخل اسم أو بريد المستخدم!"); return; }

  const users = getDB("users", []);
  const idx = users.findIndex(u =>
    (u.email && u.email.toLowerCase() === query) ||
    (u.username && u.username.toLowerCase() === query) ||
    (u.name && u.name.toLowerCase() === query)
  );

  if (idx === -1) { alert("لم يتم العثور على المستخدم!"); return; }
  users[idx].rank = newRank;
  setDB("users", users);

  const cur = getDB("currentUser", null);
  if (cur && String(cur.id) === String(users[idx].id)) {
    setDB("currentUser", users[idx]);
    if (typeof updateUserUI === "function") updateUserUI();
  }

  alert(`تمت ترقية المستخدم إلى (${newRank}) بنجاح!`);
}

// ----------------------------------------------------------------------------
// 5. إدارة الأقسام والمنتجات
// ----------------------------------------------------------------------------
function populateAdminProductCategories() {
  const sel = document.getElementById("prod-category-select");
  if (!sel) return;
  const cats = getDB("categories", []);
  sel.innerHTML = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
}

function populateAdminParentCategories() {
  const sel = document.getElementById("cat-parent-select");
  if (!sel) return;
  const cats = getDB("categories", []).filter(c => !c.parentId);
  sel.innerHTML = `<option value="">قسم رئيسي (يظهر في الواجهة)</option>` +
    cats.map(c => `<option value="${c.id}">قسم فرعي داخل: ${c.name}</option>`).join("");
}

function handleAddCategory(e) {
  e.preventDefault();
  const name = document.getElementById("cat-name").value.trim();
  const parentId = document.getElementById("cat-parent-select").value || null;
  const image = document.getElementById("cat-image").value.trim() || "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=300&q=80";

  const cats = getDB("categories", []);
  cats.push({
    id: "cat_" + Date.now(),
    name,
    parentId,
    image
  });
  setDB("categories", cats);
  e.target.reset();
  renderAdminCategories();
  if (typeof renderCategories === "function") renderCategories();
  alert("تمت إضافة القسم بنجاح!");
}

function renderAdminCategories() {
  const tbody = document.getElementById("admin-categories-table");
  if (!tbody) return;
  const cats = getDB("categories", []);
  tbody.innerHTML = cats.map(c => {
    const parent = c.parentId ? cats.find(p => p.id === c.parentId) : null;
    return `
      <tr>
        <td>${c.name}</td>
        <td>${parent ? "فرعي (" + parent.name + ")" : "رئيسي"}</td>
        <td>
          <button onclick="deleteAdminCategory('${c.id}')" style="background:#ef4444; color:#fff; border:none; padding:5px 10px; border-radius:6px; cursor:pointer;">حذف</button>
        </td>
      </tr>
    `;
  }).join("");
}

function deleteAdminCategory(catId) {
  if (!confirm("هل تريد حذف هذا القسم؟")) return;
  const cats = getDB("categories", []).filter(c => c.id !== catId && c.parentId !== catId);
  setDB("categories", cats);
  renderAdminCategories();
  if (typeof renderCategories === "function") renderCategories();
}

function handleAddProduct(e) {
  e.preventDefault();
  const categoryId = document.getElementById("prod-category-select").value;
  const name = document.getElementById("prod-name").value.trim();
  const supplierPriceUSD = parseFloat(document.getElementById("prod-price-usd").value) || 0;
  const customPctRaw = document.getElementById("prod-custom-percent")?.value;
  const sypManual = parseFloat(document.getElementById("prod-price-syp")?.value);
  const desc = document.getElementById("prod-desc")?.value.trim() || "";
  const image = document.getElementById("prod-image")?.value.trim() || "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=300&q=80";

  const globalPercent = parseFloat(getDB("global_profit_percent", 0)) || 0;
  const catPercents = getDB("category_profit_percents", {});
  const pct = (customPctRaw !== "" && customPctRaw !== undefined && !isNaN(parseFloat(customPctRaw)))
    ? parseFloat(customPctRaw)
    : (catPercents[categoryId] !== undefined ? parseFloat(catPercents[categoryId]) : globalPercent);

  const finalUSD = +(supplierPriceUSD * (1 + pct / 100)).toFixed(4);
  const finalSYP = !isNaN(sypManual) && sypManual > 0 ? sypManual : Math.round(finalUSD * 155);

  const products = getDB("products", []);
  products.push({
    id: "prod_" + Date.now(),
    categoryId,
    name,
    supplierPriceUSD,
    customPercent: (customPctRaw !== "" && !isNaN(parseFloat(customPctRaw))) ? parseFloat(customPctRaw) : null,
    priceUSD: finalUSD,
    priceSYP: finalSYP,
    desc,
    image
  });

  setDB("products", products);
  e.target.reset();
  renderAdminProducts();
  alert("تمت إضافة المنتج بنجاح!");
}

function renderAdminProducts() {
  const tbody = document.getElementById("admin-products-table");
  if (!tbody) return;
  const products = getDB("products", []);
  const cats = getDB("categories", []);

  tbody.innerHTML = products.map(p => {
    const cat = cats.find(c => c.id === p.categoryId);
    const cost = parseFloat(p.supplierPriceUSD || p.priceUSD || 0).toFixed(3);
    const sell = parseFloat(p.priceUSD || 0).toFixed(3);
    return `
      <tr>
        <td>${p.name}</td>
        <td>${cat ? cat.name : "-"}</td>
        <td>$${cost} / <strong style="color:#10b981;">$${sell}</strong></td>
        <td>
          <button onclick="deleteAdminProduct('${p.id}')" style="background:#ef4444; color:#fff; border:none; padding:5px 10px; border-radius:6px; cursor:pointer;">حذف</button>
        </td>
      </tr>
    `;
  }).join("");
}

function deleteAdminProduct(prodId) {
  if (!confirm("هل تريد حذف هذا المنتج؟")) return;
  const products = getDB("products", []).filter(p => p.id !== prodId);
  setDB("products", products);
  renderAdminProducts();
}

// ----------------------------------------------------------------------------
// 6. جلب المنتجات من المورد
// ----------------------------------------------------------------------------
const ADMIN_SHAMS_URL = "https://api.shams4store.com/client/api/products";
const ADMIN_SHAMS_TOKEN = "fd7769b4023103836b0ae5fcbc13f9df6f5ac6a7c519a427";

function getSupplierCatalog() {
  return getDB("supplier_catalog", []);
}

function populateSupplierCategoriesDropdown() {
  const sel = document.getElementById("supplier-target-category");
  if (!sel) return;
  const cats = getDB("categories", []);
  sel.innerHTML = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join("");

  const urlInput = document.getElementById("supplier-api-url");
  const keyInput = document.getElementById("supplier-api-key");
  if (urlInput && !urlInput.value) urlInput.value = getDB("supplier_api_url", ADMIN_SHAMS_URL);
  if (keyInput && !keyInput.value) keyInput.value = getDB("supplier_api_key", ADMIN_SHAMS_TOKEN);

  searchSupplierCatalog();
}

function searchSupplierCatalog() {
  const container = document.getElementById("supplier-results-container");
  const infoEl = document.getElementById("supplier-results-info");
  if (!container) return;

  const query = (document.getElementById("supplier-search-input")?.value || "").trim().toLowerCase();
  const targetCatId = document.getElementById("supplier-target-category")?.value;
  const catalog = getSupplierCatalog();
  const existingProducts = getDB("products", []);

  const filtered = query
    ? catalog.filter(item =>
        (item.name && item.name.toLowerCase().includes(query)) ||
        (item.app && item.app.toLowerCase().includes(query))
      )
    : catalog;

  if (infoEl) {
    infoEl.textContent = `إجمالي المنتجات المتاحة في المورد: ${catalog.length} | المعروض: ${Math.min(filtered.length, 120)}`;
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

// ----------------------------------------------------------------------------
// 7. طلبات وطرق الإيداع
// ----------------------------------------------------------------------------
function renderAdminDepositRequests() {
  const container = document.getElementById("deposit-requests-container");
  if (!container) return;

  const requests = getDB("deposit_requests", []);
  if (requests.length === 0) {
    container.innerHTML = `<p style="color:#94a3b8;">لا توجد طلبات إيداع حالياً.</p>`;
    return;
  }

  container.innerHTML = requests.slice().reverse().map(req => `
    <div style="background:#0c1527; border:1px solid rgba(56,189,248,0.25); border-radius:14px; padding:14px; margin-bottom:10px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
        <strong style="color:#fff;">${req.userName || "مستخدم"}</strong>
        <span style="color:#38bdf8; font-weight:800;">$${parseFloat(req.amountUSD || 0).toFixed(2)}</span>
      </div>
      <div style="font-size:0.8rem; color:#cbd5e1; margin-bottom:6px;">
        الوسيلة: ${req.methodName || "-"} | المرسل: ${req.sender || "-"}<br>
        الحالة: <strong>${req.status || "قيد المراجعة"}</strong>
      </div>
      ${req.receiptImage ? `<img src="${req.receiptImage}" style="max-width:100%; max-height:180px; border-radius:10px; margin-bottom:8px;">` : ""}
      ${req.status === "pending" || req.status === "قيد المراجعة" ? `
        <div style="display:flex; gap:8px;">
          <button onclick="approveDepositRequest('${req.id}')" style="flex:1; background:#10b981; color:#fff; border:none; padding:8px; border-radius:8px; font-weight:700; cursor:pointer;">قبول وإضافة الرصيد</button>
          <button onclick="rejectDepositRequest('${req.id}')" style="flex:1; background:#ef4444; color:#fff; border:none; padding:8px; border-radius:8px; font-weight:700; cursor:pointer;">رفض</button>
        </div>
      ` : ""}
    </div>
  `).join("");
}

function approveDepositRequest(reqId) {
  const requests = getDB("deposit_requests", []);
  const reqIdx = requests.findIndex(r => String(r.id) === String(reqId));
  if (reqIdx === -1) return;

  const req = requests[reqIdx];
  requests[reqIdx].status = "approved";
  setDB("deposit_requests", requests);

  const users = getDB("users", []);
  const uIdx = users.findIndex(u => String(u.id) === String(req.userId));
  if (uIdx !== -1) {
    users[uIdx].balanceUSD = +((parseFloat(users[uIdx].balanceUSD) || 0) + (parseFloat(req.amountUSD) || 0)).toFixed(4);
    setDB("users", users);

    const cur = getDB("currentUser", null);
    if (cur && String(cur.id) === String(req.userId)) {
      setDB("currentUser", users[uIdx]);
      if (typeof updateUserUI === "function") updateUserUI();
    }
  }

  renderAdminDepositRequests();
  alert("تم قبول طلب الإيداع وإضافة الرصيد لحساب المستخدم!");
}

function rejectDepositRequest(reqId) {
  const requests = getDB("deposit_requests", []);
  const reqIdx = requests.findIndex(r => String(r.id) === String(reqId));
  if (reqIdx === -1) return;

  requests[reqIdx].status = "rejected";
  setDB("deposit_requests", requests);
  renderAdminDepositRequests();
  alert("تم رفض طلب الإيداع.");
}

function renderAdminDepositMethods() {
  const container = document.getElementById("admin-methods-container");
  if (!container) return;

  const methods = getDB("depositMethods", []);
  container.innerHTML = methods.map(m => `
    <div style="display:flex; justify-content:space-between; align-items:center; background:#0c1527; padding:12px; border-radius:12px; margin-bottom:8px; border:1px solid rgba(56,189,248,0.2);">
      <div>
        <strong style="color:#fff;">${m.name}</strong>
        <div style="font-size:0.78rem; color:#94a3b8;">${m.account} (1$ = ${m.rate})</div>
      </div>
      <button onclick="deleteDepositMethod('${m.id}')" style="background:#ef4444; color:#fff; border:none; padding:6px 10px; border-radius:8px; cursor:pointer;">حذف</button>
    </div>
  `).join("");
}

function handleAddDepositMethod(e) {
  e.preventDefault();
  const name = document.getElementById("method-name").value.trim();
  const account = document.getElementById("method-account").value.trim();
  const currency = document.getElementById("method-currency").value.trim() || "USD";
  const rate = parseFloat(document.getElementById("method-rate").value) || 155;
  const qr = document.getElementById("method-qr").value.trim() || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(account)}`;
  const icon = document.getElementById("method-icon").value.trim() || "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=100&q=80";

  const methods = getDB("depositMethods", []);
  methods.push({
    id: "m_" + Date.now(),
    name,
    account,
    currency,
    rate,
    qr,
    icon
  });
  setDB("depositMethods", methods);
  e.target.reset();
  renderAdminDepositMethods();
  alert("تمت إضافة طريقة الإيداع بنجاح!");
}

function deleteDepositMethod(methodId) {
  if (!confirm("هل تريد حذف طريقة الإيداع هذه؟")) return;
  const methods = getDB("depositMethods", []).filter(m => String(m.id) !== String(methodId));
  setDB("depositMethods", methods);
  renderAdminDepositMethods();
}
