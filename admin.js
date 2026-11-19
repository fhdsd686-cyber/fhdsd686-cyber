// ============================================================================
// لوحة تحكم الإدارة الكاملة + حساب الأرباح اليومية + نظام المورد (admin.js - v139)
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
    if (drawer && drawer.classList.contains("open")) toggleSidebar();
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
    .reduce((sum, d) => sum + (parseFloat(d.amountUSD || 0)), 0);

  const salesEl = document.getElementById("stat-sales");
  const ordersEl = document.getElementById("stat-orders-count");
  const depEl = document.getElementById("stat-total-deposits");

  if (salesEl) salesEl.textContent = `$${dailySalesUSD.toFixed(2)}`;
  if (ordersEl) ordersEl.textContent = dailyOrders.length;
  if (depEl) depEl.textContent = `$${approvedDeposits.toFixed(2)}`;

  const statsGrid = document.querySelector("#sec-stats .stats-grid");
  if (statsGrid) {
    let profitCard = document.getElementById("stat-daily-profit-card");
    if (!profitCard) {
      profitCard = document.createElement("div");
      profitCard.id = "stat-daily-profit-card";
      profitCard.className = "stat-card";
      profitCard.style.cssText = "border: 1.5px solid #10b981; background: linear-gradient(135deg, #06281e, #0b192c);";
      statsGrid.prepend(profitCard);
    }
    const profitSYP = (dailyProfitUSD * 155).toFixed(2);
    profitCard.innerHTML = `
      <span style="color:#10b981; font-weight:800;"><i class="fa-solid fa-coins"></i> صافي الأرباح اليومية (24س)</span>
      <p style="color:#10b981; font-size:1.35rem; font-weight:900; margin:4px 0;">$${dailyProfitUSD.toFixed(3)}</p>
      <small style="color:#cbd5e1; font-size:0.75rem;">ما يعادل: ${profitSYP} ل.س</small>
    `;
  }
}

function renderPricingOffersSection() {
  const globalInput = document.getElementById("global-profit-percent");
  const globalPercent = parseFloat(getDB("global_profit_percent", 0)) || 0;
  if (globalInput) globalInput.value = globalPercent;

  const listEl = document.getElementById("category-offers-list");
  if (!listEl) return;

  const categories = getDB("categories", typeof initialCategories !== "undefined" ? initialCategories : []);
  const catPercents = getDB("category_profit_percents", {});

  listEl.innerHTML = categories.map(cat => {
    const val = catPercents[cat.id] !== undefined ? catPercents[cat.id] : "";
    return `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; background:#0c1527; padding:12px; border-radius:12px; margin-bottom:8px; border:1px solid rgba(255,255,255,0.08);">
        <span style="font-size:0.85rem; font-weight:700;">${cat.name}</span>
        <div style="display:flex; align-items:center; gap:6px;">
          <input type="number" step="any" id="cat-offer-${cat.id}" value="${val}" placeholder="${globalPercent}%" style="width:90px; padding:6px 8px; border-radius:8px; background:#050b18; border:1px solid #38bdf8; color:#fff;">
          <button type="button" class="btn-submit" style="width:auto; padding:6px 12px; margin:0;" onclick="saveCategoryOfferPercent('${cat.id}')">حفظ</button>
        </div>
      </div>
    `;
  }).join("");
}

function saveGlobalProfitPercent() {
  const val = parseFloat(document.getElementById("global-profit-percent")?.value || 0) || 0;
  setDB("global_profit_percent", val);
  recalculateAllProductsPrices();
  alert(`تم حفظ النسبة العامة (${val}%) وتحديث أسعار جميع المنتجات!`);
}

function saveCategoryOfferPercent(catId) {
  const raw = document.getElementById(`cat-offer-${catId}`)?.value;
  const catPercents = getDB("category_profit_percents", {});
  if (raw === "" || raw === null || raw === undefined) {
    delete catPercents[catId];
  } else {
    catPercents[catId] = parseFloat(raw) || 0;
  }
  setDB("category_profit_percents", catPercents);
  recalculateAllProductsPrices();
  alert("تم حفظ نسبة القسم وتحديث الأسعار!");
}

function recalculateAllProductsPrices() {
  const products = getDB("products", []);
  const globalPercent = parseFloat(getDB("global_profit_percent", 0)) || 0;
  const catPercents = getDB("category_profit_percents", {});

  const updated = products.map(p => {
    const base = parseFloat(p.supplierPriceUSD || p.priceUSD || 0);
    const pct = p.customPercent !== undefined && p.customPercent !== ""
      ? parseFloat(p.customPercent)
      : (catPercents[p.categoryId] !== undefined ? parseFloat(catPercents[p.categoryId]) : globalPercent);
    const finalUSD = +(base * (1 + pct / 100)).toFixed(3);
    return {
      ...p,
      supplierPriceUSD: base,
      priceUSD: finalUSD,
      priceSYP: Math.round(finalUSD * 15000)
    };
  });

  setDB("products", updated);
}

function loadSiteSettingsIntoForm() {
  const settings = getDB("site_settings", {
    siteName: "Mohannad kard",
    logo: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=100&q=80",
    banners: ["https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=600&q=80"]
  });

  const nameEl = document.getElementById("setting-site-name");
  const logoEl = document.getElementById("setting-site-logo");
  const bannerEl = document.getElementById("setting-site-banner");

  if (nameEl) nameEl.value = settings.siteName || settings.name || "Mohannad kard";
  if (logoEl) logoEl.value = settings.logo || "";
  if (bannerEl) {
    const arr = Array.isArray(settings.banners) ? settings.banners : (settings.banner ? [settings.banner] : []);
    bannerEl.value = arr.join("\n");
  }
}

function handleSiteSettingsUpdate(e) {
  e.preventDefault();
  const siteName = document.getElementById("setting-site-name")?.value.trim() || "Mohannad kard";
  const logo = document.getElementById("setting-site-logo")?.value.trim();
  const bannerRaw = document.getElementById("setting-site-banner")?.value || "";
  const banners = bannerRaw.split("\n").map(s => s.trim()).filter(Boolean);

  setDB("site_settings", { name: siteName, siteName, logo, banner: banners[0] || "", banners });
  if (typeof loadSiteSettings === "function") loadSiteSettings();
  alert("تم حفظ إعدادات وهوية المتجر ومزامنتها!");
}

function renderAdminUsers() {
  const container = document.getElementById("admin-users-list");
  if (!container) return;

  const registry = getDB("cloud_users_registry", {});
  const localUsers = getDB("users", []);
  const combined = { ...registry };

  localUsers.forEach(u => {
    if (u && u.name && u.name !== "زائر") {
      const k = (u.email || u.name).toLowerCase().trim();
      combined[k] = { ...combined[k], ...u };
    }
  });

  const usersList = Object.values(combined);
  if (!usersList.length) {
    container.innerHTML = `<p style="color:#94a3b8;">لا يوجد مستخدمون مسجلون حالياً.</p>`;
    return;
  }

  container.innerHTML = usersList.map(u => {
    const key = (u.email || u.name).toLowerCase().trim();
    const bal = parseFloat(u.balanceUSD || 0).toFixed(3);
    return `
      <div style="background:#0c1527; padding:12px; border-radius:12px; margin-bottom:10px; border:1px solid rgba(56,189,248,0.2);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <strong>${u.name} (${u.role || "عضو"})</strong>
          <span style="color:#38bdf8; font-weight:800;">$${bal}</span>
        </div>
        <div style="font-size:0.78rem; color:#94a3b8; margin-bottom:8px;">${u.email || ""}</div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button type="button" class="btn-submit" style="width:auto; padding:5px 10px; font-size:0.75rem; margin:0;" onclick="adminAdjustUserBalance('${key}', 1)">+1$</button>
          <button type="button" class="btn-submit" style="width:auto; padding:5px 10px; font-size:0.75rem; margin:0; background:#0284c7;" onclick="adminPromptCustomBalance('${key}')">تعديل الرصيد</button>
          <button type="button" class="btn-submit" style="width:auto; padding:5px 10px; font-size:0.75rem; margin:0; background:${u.isBanned ? '#10b981' : '#ef4444'};" onclick="adminToggleBanUser('${key}')">${u.isBanned ? 'فك الحظر' : 'حظر'}</button>
        </div>
      </div>
    `;
  }).join("");
}

function adminAdjustUserBalance(userKey, delta) {
  const registry = getDB("cloud_users_registry", {});
  if (!registry[userKey]) return;
  registry[userKey].balanceUSD = Math.max(0, +((parseFloat(registry[userKey].balanceUSD || 0) + delta).toFixed(3)));
  setDB("cloud_users_registry", registry);
  renderAdminUsers();
}

function adminPromptCustomBalance(userKey) {
  const registry = getDB("cloud_users_registry", {});
  if (!registry[userKey]) return;
  const val = prompt("أدخل الرصيد الجديد بالدولار ($):", registry[userKey].balanceUSD || 0);
  if (val === null) return;
  const num = parseFloat(val);
  if (isNaN(num)) return;
  registry[userKey].balanceUSD = +num.toFixed(3);
  setDB("cloud_users_registry", registry);
  renderAdminUsers();
}

function adminToggleBanUser(userKey) {
  const registry = getDB("cloud_users_registry", {});
  if (!registry[userKey]) return;
  registry[userKey].isBanned = !registry[userKey].isBanned;
  setDB("cloud_users_registry", registry);
  renderAdminUsers();
}

function submitUserUpgrade() {
  const query = (document.getElementById("upgrade-search-input")?.value || "").trim().toLowerCase();
  const newRole = document.getElementById("upgrade-role-select")?.value || "VIP 1";
  if (!query) { alert("أدخل اسم أو بريد المستخدم."); return; }

  const registry = getDB("cloud_users_registry", {});
  const foundKey = Object.keys(registry).find(k =>
    k.includes(query) || (registry[k].name && registry[k].name.toLowerCase().includes(query))
  );

  if (!foundKey) { alert("لم يتم العثور على المستخدم."); return; }
  registry[foundKey].role = newRole;
  setDB("cloud_users_registry", registry);
  alert(`تمت ترقية ${registry[foundKey].name} إلى ${newRole} بنجاح!`);
}

function populateAdminProductCategories() {
  const sel = document.getElementById("prod-category-select");
  if (!sel) return;
  const categories = getDB("categories", typeof initialCategories !== "undefined" ? initialCategories : []);
  sel.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
}

function renderAdminProducts() {
  const tbody = document.getElementById("admin-products-table");
  if (!tbody) return;
  const products = getDB("products", []);
  const categories = getDB("categories", typeof initialCategories !== "undefined" ? initialCategories : []);

  tbody.innerHTML = products.map(p => {
    const cat = categories.find(c => c.id === p.categoryId);
    const sup = parseFloat(p.supplierPriceUSD || p.priceUSD || 0).toFixed(2);
    const fin = parseFloat(p.priceUSD || 0).toFixed(3);
    return `
      <tr>
        <td>${p.name}</td>
        <td>${cat ? cat.name : "-"}</td>
        <td>$${sup} / <strong style="color:#38bdf8;">$${fin}</strong></td>
        <td><button type="button" style="background:#ef4444; color:#fff; border:none; padding:4px 8px; border-radius:6px; cursor:pointer;" onclick="deleteAdminProduct('${p.id}')">حذف</button></td>
      </tr>
    `;
  }).join("");
}

function handleAddProduct(e) {
  e.preventDefault();
  const categoryId = document.getElementById("prod-category-select")?.value;
  const name = document.getElementById("prod-name")?.value.trim();
  const supplierPriceUSD = parseFloat(document.getElementById("prod-price-usd")?.value || 0);
  const customPctRaw = document.getElementById("prod-custom-percent")?.value;
  const desc = document.getElementById("prod-desc")?.value.trim() || "";
  const image = document.getElementById("prod-image")?.value.trim() || "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=300&q=80";

  const globalPercent = parseFloat(getDB("global_profit_percent", 0)) || 0;
  const catPercents = getDB("category_profit_percents", {});
  const appliedPct = (customPctRaw !== "" && customPctRaw !== undefined)
    ? parseFloat(customPctRaw)
    : (catPercents[categoryId] !== undefined ? parseFloat(catPercents[categoryId]) : globalPercent);

  const finalPriceUSD = +(supplierPriceUSD * (1 + appliedPct / 100)).toFixed(3);
  const manualSYP = parseFloat(document.getElementById("prod-price-syp")?.value || 0);
  const finalPriceSYP = manualSYP > 0 ? manualSYP : Math.round(finalPriceUSD * 15000);

  const products = getDB("products", []);
  products.push({
    id: "prod_" + Date.now(),
    categoryId,
    name,
    supplierPriceUSD,
    customPercent: customPctRaw !== "" ? parseFloat(customPctRaw) : undefined,
    priceUSD: finalPriceUSD,
    priceSYP: finalPriceSYP,
    desc,
    image
  });

  setDB("products", products);
  e.target.reset();
  alert("تمت إضافة المنتج وحفظه بنجاح!");
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
    return `
      <div style="background:#0c1527; padding:12px; border-radius:12px; margin-bottom:10px; border:1px solid rgba(56,189,248,0.2);">
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <strong>${req.userName || "مستخدم"}</strong>
          <span style="color:#38bdf8; font-weight:800;">$${parseFloat(req.amountUSD || 0).toFixed(2)}</span>
        </div>
        <div style="font-size:0.78rem; color:#cbd5e1; margin-bottom:6px;">الوسيلة: ${req.methodName || "-"} | المرسل: ${req.sender || "-"}</div>
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
    const registry = getDB("cloud_users_registry", {});
    const userKey = (requests[idx].userEmail || requests[idx].userName || "").toLowerCase().trim();
    if (registry[userKey]) {
      registry[userKey].balanceUSD = +((parseFloat(registry[userKey].balanceUSD || 0) + parseFloat(requests[idx].amountUSD || 0)).toFixed(3));
      setDB("cloud_users_registry", registry);
    }
  }

  renderAdminDepositRequests();
  alert(approve ? "تم قبول الطلب وإضافة الرصيد لحساب المستخدم!" : "تم رفض الطلب.");
}

function renderAdminDepositMethods() {
  const container = document.getElementById("admin-methods-container");
  if (!container) return;
  const methods = getDB("depositMethods", typeof initialDepositMethods !== "undefined" ? initialDepositMethods : []);

  container.innerHTML = methods.map(m => `
    <div style="display:flex; justify-content:space-between; align-items:center; background:#0c1527; padding:12px; border-radius:12px; margin-bottom:8px;">
      <div>
        <strong>${m.name}</strong>
        <div style="font-size:0.75rem; color:#38bdf8;">${m.account} (1$ = ${m.rate} ل.س)</div>
      </div>
      <button type="button" style="background:#ef4444; color:#fff; border:none; padding:5px 10px; border-radius:8px; cursor:pointer;" onclick="deleteDepositMethod('${m.id}')">حذف</button>
    </div>
  `).join("");
}

function handleAddDepositMethod(e) {
  e.preventDefault();
  const name = document.getElementById("method-name")?.value.trim();
  const account = document.getElementById("method-account")?.value.trim();
  const currency = document.getElementById("method-currency")?.value.trim() || "USD";
  const rate = parseFloat(document.getElementById("method-rate")?.value || 15000);
  const qrImage = document.getElementById("method-qr")?.value.trim() || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(account)}`;
  const icon = document.getElementById("method-icon")?.value.trim() || "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=100&q=80";

  const methods = getDB("depositMethods", typeof initialDepositMethods !== "undefined" ? initialDepositMethods : []);
  methods.push({ id: "dm_" + Date.now(), name, account, currency, rate, qrImage, icon });

  setDB("depositMethods", methods);
  e.target.reset();
  alert("تمت إضافة وسيلة الإيداع بنجاح!");
  switchAdminSection("deposit-methods");
}

function deleteDepositMethod(id) {
  if (!confirm("هل تريد حذف وسيلة الإيداع هذه؟")) return;
  setDB("depositMethods", getDB("depositMethods", []).filter(m => m.id !== id));
  renderAdminDepositMethods();
}

// ============================================================================
// 9. نظام جلب المنتجات من المورد (Shams4Store / Parabyte عبر وسيط Cloudflare)
// ============================================================================

const ADMIN_SHAMS_URL = "https://api.shams4store.com/client/api/products";
const ADMIN_SHAMS_TOKEN = "fd7769b4023103836b0ae5fcbc13f9df6f5ac6a7c519a427";
const ADMIN_WORKER_URL = "https://rapid-dew-4b71.fhdsd686.workers.dev/";

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
    const finalUSD = +(item.supplierPriceUSD * (1 + appliedPercent / 100)).toFixed(3);
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
              سعر المورد: <strong style="color:#f59e0b;">$${item.supplierPriceUSD.toFixed(3)}</strong>
              | سعر البيع: <strong style="color:#10b981;">$${finalUSD.toFixed(3)}</strong>
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

  const finalPriceUSD = +(item.supplierPriceUSD * (1 + appliedPercent / 100)).toFixed(3);
  const finalPriceSYP = Math.round(finalPriceUSD * 15000);

  products.push({
    id: "prod_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    supplierId: item.supplierId,
    categoryId: targetCatId,
    name: item.name,
    supplierPriceUSD: item.supplierPriceUSD,
    priceUSD: finalPriceUSD,
    priceSYP: finalPriceSYP,
    productType: item.productType || "package",
    qtyValues: item.qtyValues || null,
    paramField: item.paramField || "playerId",
    desc: item.desc || "",
    image: item.image
  });

  setDB("products", products);
  renderAdminProducts();
  searchSupplierCatalog();
}
