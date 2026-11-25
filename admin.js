// ============================================================================
// لوحة تحكم الإدارة الكاملة + الحذف التلقائي للإيداعات القديمة (admin.js)
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
  "add-deposit-method",
  "payment-gateway-setup"
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

  if (salesEl) salesEl.textContent = `$${dailySalesUSD.toFixed(2)}`;
  if (ordersEl) ordersEl.textContent = dailyOrders.length;
  if (depEl) depEl.textContent = `$${approvedDeposits.toFixed(2)}`;
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
  alert(`تم حفظ النسبة العامة (${val}%) بنجاح!`);
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
  alert("تم حفظ نسبة القسم بنجاح!");
}

function loadSiteSettingsIntoForm() {
  const settings = getDB("site_settings", {
    siteName: "Mohannad kard",
    whatsapp: "0957455972",
    logo: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=100&q=80",
    banners: ["https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=600&q=80"]
  });

  const nameEl = document.getElementById("setting-site-name");
  const waEl = document.getElementById("setting-whatsapp-number");
  const logoEl = document.getElementById("setting-site-logo");
  const bannerEl = document.getElementById("setting-site-banner");

  if (nameEl) nameEl.value = settings.siteName || settings.name || "Mohannad kard";
  if (waEl) waEl.value = settings.whatsapp || getDB("admin_whatsapp", "0957455972");
  if (logoEl) logoEl.value = settings.logo || "";
  if (bannerEl) {
    const arr = Array.isArray(settings.banners) ? settings.banners : (settings.banner ? [settings.banner] : []);
    bannerEl.value = arr.join("\n");
  }
}

function handleSiteSettingsUpdate(e) {
  e.preventDefault();
  const siteName = document.getElementById("setting-site-name")?.value.trim() || "Mohannad kard";
  const whatsapp = document.getElementById("setting-whatsapp-number")?.value.trim() || "0957455972";
  const logo = document.getElementById("setting-site-logo")?.value.trim();
  const bannerRaw = document.getElementById("setting-site-banner")?.value || "";
  const banners = bannerRaw.split("\n").map(s => s.trim()).filter(Boolean);

  setDB("admin_whatsapp", whatsapp);
  setDB("site_settings", { name: siteName, siteName, whatsapp, logo, banner: banners[0] || "", banners });
  if (typeof loadSiteSettings === "function") loadSiteSettings();
  alert("✅ تم حفظ إعدادات المتجر ورقم الواتساب الجديد بنجاح!");
}

window.savePaymentGatewaySettings = function() {
  const provider = document.getElementById("gateway-provider-select")?.value;
  const endpoint = document.getElementById("gateway-api-endpoint")?.value.trim();
  const token = document.getElementById("gateway-secret-token")?.value.trim();

  if (!endpoint || !token) {
    alert("⚠️ يرجى إدخال الرابط والمفتاح السري بشكل صحيح!");
    return;
  }

  setDB("gateway_settings", { provider, endpoint, token, active: true });
  alert("🎉 تم حفظ إعدادات بوابة الدفع الأوتوماتيكية بنجاح وأصبحت جاهزة للربط!");
};

// إدارة المستخدمين
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
    const isBanned = !!u.isBanned;

    return `
      <div style="background:#0c1527; padding:14px; border-radius:12px; margin-bottom:12px; border:1px solid ${isBanned ? '#ef4444' : 'rgba(56,189,248,0.2)'};">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <strong>${u.fullname || u.name} (${u.role || "عضو"}) ${isBanned ? '<span style="color:#ef4444; font-size:0.75rem;">[محظور]</span>' : ''}</strong>
          <span style="color:#38bdf8; font-weight:800;">$${bal}</span>
        </div>
        <div style="font-size:0.78rem; color:#94a3b8; margin-bottom:10px;">${u.name} | ${u.email || ""}</div>
        
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button type="button" onclick="adminEditUserBalance('${key}')" style="flex:1; min-width:85px; background:#0284c7; color:#fff; border:none; padding:6px; border-radius:8px; font-size:0.75rem; font-weight:bold; cursor:pointer;">
            <i class="fa-solid fa-wallet"></i> تعديل الرصيد
          </button>
          <button type="button" onclick="adminToggleBanUser('${key}')" style="flex:1; min-width:85px; background:${isBanned ? '#10b981' : '#f59e0b'}; color:#fff; border:none; padding:6px; border-radius:8px; font-size:0.75rem; font-weight:bold; cursor:pointer;">
            <i class="fa-solid ${isBanned ? 'fa-unlock' : 'fa-ban'}"></i> ${isBanned ? 'إلغاء الحظر' : 'حظر'}
          </button>
          <button type="button" onclick="adminDeleteUser('${key}')" style="flex:1; min-width:85px; background:#ef4444; color:#fff; border:none; padding:6px; border-radius:8px; font-size:0.75rem; font-weight:bold; cursor:pointer;">
            <i class="fa-solid fa-trash"></i> حذف
          </button>
        </div>
      </div>
    `;
  }).join("");
}

window.adminEditUserBalance = function(userKey) {
  const registry = getDB("cloud_users_registry", {});
  const users = getDB("users", []);

  let currentBal = 0;
  if (registry[userKey]) currentBal = parseFloat(registry[userKey].balanceUSD || 0);
  else {
    const found = users.find(u => (u.email || u.name).toLowerCase().trim() === userKey);
    if (found) currentBal = parseFloat(found.balanceUSD || 0);
  }

  const newAmount = prompt(`أدخل الرصيد الجديد للمستخدم (الرصيد الحالي: $${currentBal}):`, currentBal);
  if (newAmount === null) return;

  const parsed = parseFloat(newAmount);
  if (isNaN(parsed)) {
    alert("⚠️ يرجى إدخال رقم صحيح!");
    return;
  }

  if (registry[userKey]) {
    registry[userKey].balanceUSD = parsed;
    setDB("cloud_users_registry", registry);
  }

  const uIdx = users.findIndex(u => (u.email || u.name).toLowerCase().trim() === userKey);
  if (uIdx !== -1) {
    users[uIdx].balanceUSD = parsed;
    setDB("users", users);
  }

  alert(`✅ تم تحديث رصيد المستخدم إلى $${parsed.toFixed(3)} بنجاح!`);
  renderAdminUsers();
};

window.adminToggleBanUser = function(userKey) {
  const registry = getDB("cloud_users_registry", {});
  const users = getDB("users", []);

  let isCurrentlyBanned = false;
  if (registry[userKey]) isCurrentlyBanned = !!registry[userKey].isBanned;
  else {
    const found = users.find(u => (u.email || u.name).toLowerCase().trim() === userKey);
    if (found) isCurrentlyBanned = !!found.isBanned;
  }

  const nextState = !isCurrentlyBanned;
  if (!confirm(nextState ? "⚠️ هل أنت متأكد من حظر هذا المستخدم؟" : "فك حظر هذا المستخدم؟")) return;

  if (registry[userKey]) {
    registry[userKey].isBanned = nextState;
    setDB("cloud_users_registry", registry);
  }

  const uIdx = users.findIndex(u => (u.email || u.name).toLowerCase().trim() === userKey);
  if (uIdx !== -1) {
    users[uIdx].isBanned = nextState;
    setDB("users", users);
  }

  alert(nextState ? "🚫 تم حظر المستخدم بنجاح!" : "🟢 تم إلغاء حظر المستخدم بنجاح!");
  renderAdminUsers();
};

window.adminDeleteUser = function(userKey) {
  if (!confirm("⚠️ هل أنت متأكد من رغبتك في حذف هذا الحساب نهائياً؟")) return;

  const registry = getDB("cloud_users_registry", {});
  if (registry[userKey]) {
    delete registry[userKey];
    setDB("cloud_users_registry", registry);
  }

  let users = getDB("users", []);
  users = users.filter(u => (u.email || u.name).toLowerCase().trim() !== userKey);
  setDB("users", users);

  alert("🗑️ تم حذف الحساب بنجاح!");
  renderAdminUsers();
};

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
    const fin = parseFloat(p.priceUSD || 0).toFixed(3);
    return `
      <tr>
        <td>${p.name}</td>
        <td>${cat ? cat.name : "-"}</td>
        <td><strong style="color:#38bdf8;">$${fin}</strong></td>
        <td><button type="button" style="background:#ef4444; color:#fff; border:none; padding:4px 8px; border-radius:6px; cursor:pointer;" onclick="deleteAdminProduct('${p.id}')">حذف</button></td>
      </tr>
    `;
  }).join("");
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
  sel.innerHTML = `<option value="">قسم رئيسي</option>` + categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
}

function renderAdminCategories() {
  const tbody = document.getElementById("admin-categories-table");
  if (!tbody) return;
  const categories = getDB("categories", typeof initialCategories !== "undefined" ? initialCategories : []);
  tbody.innerHTML = categories.map(c => `<tr><td>${c.name}</td><td>رئيسي</td><td>-</td></tr>`).join("");
}

// 🌟 طلبات الإيداع مع الحذف التلقائي بعد 48 ساعة وأزرار القبول والرفض
function renderAdminDepositRequests() {
  const container = document.getElementById("deposit-requests-container");
  if (!container) return;
  
  let requests = getDB("deposit_requests", []);
  const now = Date.now();
  const fortyEightHoursMs = 48 * 60 * 60 * 1000;

  const filteredRequests = requests.filter(req => {
    if (!req.timestamp) return true;
    const reqTime = new Date(req.timestamp).getTime();
    return (now - reqTime) <= fortyEightHoursMs;
  });

  if (filteredRequests.length !== requests.length) {
    setDB("deposit_requests", filteredRequests);
    requests = filteredRequests;
  }

  if (!requests.length) {
    container.innerHTML = `<p style="color:#94a3b8; text-align:center; padding:20px;">لا توجد طلبات إيداع حديثة (تم حذف الطلبات الأقدم من 48 ساعة تلقائياً).</p>`;
    return;
  }

  container.innerHTML = requests.slice().reverse().map((req, revIdx) => {
    const originalIndex = requests.length - 1 - revIdx;
    const amt = parseFloat(req.amountUSD || req.amount || 0);
    const isPending = !req.status || req.status === "pending" || req.status === "معلق";

    const actionsHTML = isPending
      ? `<div style="display:flex; gap:8px; margin-top:10px;">
           <button type="button" onclick="approveDepositRequest(${originalIndex})" style="flex:1; background:#10b981; color:#fff; border:none; padding:8px; border-radius:8px; font-weight:bold; cursor:pointer;">
             <i class="fa-solid fa-check"></i> قبول وإضافة الرصيد
           </button>
           <button type="button" onclick="rejectDepositRequest(${originalIndex})" style="flex:1; background:#ef4444; color:#fff; border:none; padding:8px; border-radius:8px; font-weight:bold; cursor:pointer;">
             <i class="fa-solid fa-xmark"></i> رفض
           </button>
         </div>`
      : "";

    return `
      <div style="background:#0c1527; padding:12px; border-radius:12px; margin-bottom:10px; border:1px solid rgba(56,189,248,0.2);">
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <strong>${req.userName || req.userEmail || "مستخدم"}</strong>
          <span style="color:#38bdf8; font-weight:800;">$${amt.toFixed(2)}</span>
        </div>
        <div style="font-size:0.78rem; color:#cbd5e1;">المرسل: ${req.sender || "-"} | الحالة: ${req.status || "معلق"}</div>
        ${actionsHTML}
      </div>
    `;
  }).join("");
}

window.approveDepositRequest = function(index) {
  const requests = getDB("deposit_requests", []);
  const req = requests[index];
  if (!req) return;

  const amt = parseFloat(req.amountUSD || req.amount || 0);
  const userKey = (req.userEmail || req.userName || "").toLowerCase().trim();

  const registry = getDB("cloud_users_registry", {});
  if (registry[userKey]) {
    registry[userKey].balanceUSD = (parseFloat(registry[userKey].balanceUSD || 0) + amt);
    setDB("cloud_users_registry", registry);
  }

  const users = getDB("users", []);
  const uIdx = users.findIndex(u => (u.email || u.name || "").toLowerCase().trim() === userKey);
  if (uIdx !== -1) {
    users[uIdx].balanceUSD = (parseFloat(users[uIdx].balanceUSD || 0) + amt);
    setDB("users", users);
  }

  const currentUser = getDB("currentUser", null);
  if (currentUser && (currentUser.email || currentUser.name || "").toLowerCase().trim() === userKey) {
    currentUser.balanceUSD = (parseFloat(currentUser.balanceUSD || 0) + amt);
    setDB("currentUser", currentUser);
  }

  requests[index].status = "approved";
  setDB("deposit_requests", requests);

  alert(`✅ تم قبول الطلب وإضافة $${amt.toFixed(2)} لحساب المستخدم بنجاح!`);
  renderAdminDepositRequests();
  renderAdminStats();
};

window.rejectDepositRequest = function(index) {
  if (!confirm("هل أنت متأكد من رفض هذا الطلب؟")) return;
  const requests = getDB("deposit_requests", []);
  if (!requests[index]) return;

  requests[index].status = "مرفوض";
  setDB("deposit_requests", requests);
  renderAdminDepositRequests();
};

function renderAdminDepositMethods() {
  const container = document.getElementById("admin-methods-container");
  if (!container) return;
  const methods = getDB("depositMethods", []);
  container.innerHTML = methods.map(m => `<div style="background:#0c1527; padding:12px; border-radius:12px; margin-bottom:8px;"><strong>${m.name}</strong> - ${m.account}</div>`).join("");
}

function populateSupplierCategoriesDropdown() {
  const selectEl = document.getElementById("supplier-target-category");
  if (!selectEl) return;
  const categories = getDB("categories", []);
  selectEl.innerHTML = categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join("");
}

function searchSupplierCatalog() {
  const container = document.getElementById("supplier-results-container");
  if (!container) return;
  container.innerHTML = `<div style="color:#94a3b8; text-align:center; padding:10px;">جاهز لجلب المنتجات...</div>`;
}
