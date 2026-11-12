// --- منطق لوحة إدارة النظام والتحكم بوضع الصيانة والبيانات والطلبات والمستخدمين ---

document.addEventListener("DOMContentLoaded", () => {
  updateMaintenanceBtnUI();
});

// فتح وإغلاق لوحة الإدارة
function openAdminPanel() {
  const users = getDB("users", []);
  const currentUser = (Array.isArray(users) && users.length > 0) ? users[0] : null;

  const isAdmin = currentUser && (
    currentUser.role === "الأسطورة" || 
    currentUser.role === "Admin" || 
    (currentUser.email && currentUser.email.toLowerCase() === "fhdsd686@gmail.com") ||
    (currentUser.name && currentUser.name.toLowerCase() === "mohannad")
  );

  if (!isAdmin) {
    alert("عذراً، هذه اللوحة مخصصة لإدارة المتجر فقط!");
    return;
  }

  const wrapper = document.getElementById("admin-wrapper");
  if (wrapper) wrapper.classList.remove("hidden");
  if (typeof toggleSidebar === "function") toggleSidebar(false);

  renderAdminStats();
  renderAdminProducts();
  renderAdminCategories();
  renderAdminDepositMethods();
  renderAdminUsers();
  renderAdminDepositRequests();
  updateMaintenanceBtnUI();
}

function closeAdminPanel() {
  const wrapper = document.getElementById("admin-wrapper");
  if (wrapper) wrapper.classList.add("hidden");
}

// زر تشغيل وإيقاف وضع الصيانة
function toggleMaintenanceMode() {
  const currentStatus = getDB("maintenance_mode", false);
  const newStatus = !currentStatus;
  setDB("maintenance_mode", newStatus);

  updateMaintenanceBtnUI();

  if (newStatus) {
    alert("⚠️ تم تفعيل وضع الصيانة بنجاح! سيتم إغلاق الموقع وحجب الخدمات عن جميع الزوار الآن.");
  } else {
    alert("✅ تم إيقاف وضع الصيانة! الموقع متاح الآن للجميع بشكل طبيعي.");
  }

  if (typeof checkMaintenanceGate === "function") {
    checkMaintenanceGate();
  }
}

function updateMaintenanceBtnUI() {
  const isMaintenance = getDB("maintenance_mode", false);
  const btn = document.getElementById("admin-maintenance-btn");
  if (!btn) return;

  if (isMaintenance) {
    btn.style.background = "#ef4444";
    btn.innerHTML = `<i class="fa-solid fa-power-off"></i> وضع الصيانة: مفعل (شغال)`;
  } else {
    btn.style.background = "#10b981";
    btn.innerHTML = `<i class="fa-solid fa-power-off"></i> وضع الصيانة: معطل (طبيعي)`;
  }
}

function switchAdminSection(secId) {
  const sections = document.querySelectorAll(".admin-content-area section");
  sections.forEach(s => s.classList.add("hidden"));

  const target = document.getElementById(`sec-${secId}`);
  if (target) target.classList.remove("hidden");

  const navItems = document.querySelectorAll(".admin-nav-item");
  navItems.forEach(btn => btn.classList.remove("active"));

  const clicked = Array.from(navItems).find(btn => {
    const attr = btn.getAttribute("onclick");
    return attr && attr.includes(`'${secId}'`);
  });
  if (clicked) clicked.classList.add("active");

  if (secId === 'add-product') loadCategoriesIntoSelect('prod-category-select');
  if (secId === 'add-category') loadParentCategoriesSelect('cat-parent-select');
  if (secId === 'deposit-requests') renderAdminDepositRequests();
  if (secId === 'deposit-methods') renderAdminDepositMethods();
  if (secId === 'users') renderAdminUsers();
}

function renderAdminStats() {
  const orders = getDB("orders", []);
  const deposits = getDB("deposit_requests", []);

  const totalSales = orders.reduce((sum, o) => sum + Number(o.price || 0), 0);
  const totalDeposits = deposits.filter(d => d.status === "مقبول").reduce((sum, d) => sum + Number(d.amountUSD || 0), 0);

  const sSales = document.getElementById("stat-sales");
  const sOrders = document.getElementById("stat-orders-count");
  const sDeposits = document.getElementById("stat-total-deposits");

  if (sSales) sSales.innerText = `$${totalSales.toFixed(2)}`;
  if (sOrders) sOrders.innerText = orders.length;
  if (sDeposits) sDeposits.innerText = `$${totalDeposits.toFixed(2)}`;
}

function handleSiteSettingsUpdate(e) {
  e.preventDefault();
  const name = document.getElementById("setting-site-name").value.trim();
  const logo = document.getElementById("setting-site-logo").value.trim();
  const bannersText = document.getElementById("setting-site-banner").value.trim();

  let banners = [];
  if (bannersText) {
    banners = bannersText.split("\n").map(u => u.trim()).filter(u => u.length > 0);
  }

  setDB("site_settings", { name, logo, banners });
  alert("تم حفظ إعدادات وهوية المتجر بنجاح!");
  if (typeof loadSiteSettings === "function") loadSiteSettings();
}

function renderAdminProducts() {
  const tbody = document.getElementById("admin-products-table");
  if (!tbody) return;
  const products = getDB("products", []);
  const categories = getDB("categories", []);

  tbody.innerHTML = products.map(p => {
    const cat = categories.find(c => c.id === p.categoryId);
    return `
      <tr>
        <td>${p.name}</td>
        <td>${cat ? cat.name : "عام"}</td>
        <td>$${p.priceUSD}</td>
        <td><button style="background:#ef4444; border:none; color:#fff; padding:4px 8px; border-radius:6px; cursor:pointer;" onclick="deleteAdminProduct('${p.id}')">حذف</button></td>
      </tr>
    `;
  }).join("");
}

function handleAddProduct(e) {
  e.preventDefault();
  const categoryId = document.getElementById("prod-category-select").value;
  const name = document.getElementById("prod-name").value.trim();
  const priceUSD = parseFloat(document.getElementById("prod-price-usd").value);
  const priceSYP = parseFloat(document.getElementById("prod-price-syp").value);
  const desc = document.getElementById("prod-desc").value.trim();
  const image = document.getElementById("prod-image").value.trim();

  const products = getDB("products", []);
  products.unshift({
    id: "p_" + Date.now(),
    categoryId,
    name,
    priceUSD,
    priceSYP,
    desc,
    image
  });
  setDB("products", products);
  alert("تمت إضافة المنتج بنجاح!");
  e.target.reset();
  renderAdminProducts();
  switchAdminSection("products");
}

function deleteAdminProduct(id) {
  if (!confirm("هل أنت متأكد من حذف هذا المنتج؟")) return;
  let products = getDB("products", []);
  products = products.filter(p => p.id !== id);
  setDB("products", products);
  renderAdminProducts();
}

function loadCategoriesIntoSelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const categories = getDB("categories", []);
  select.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
}

function renderAdminCategories() {
  const tbody = document.getElementById("admin-categories-table");
  if (!tbody) return;
  const categories = getDB("categories", []);

  tbody.innerHTML = categories.map(c => `
    <tr>
      <td>${c.name}</td>
      <td>${c.parentId ? "فرعي" : "رئيسي"}</td>
      <td><button style="background:#ef4444; border:none; color:#fff; padding:4px 8px; border-radius:6px; cursor:pointer;" onclick="deleteAdminCategory('${c.id}')">حذف</button></td>
    </tr>
  `).join("");
}

function handleAddCategory(e) {
  e.preventDefault();
  const name = document.getElementById("cat-name").value.trim();
  const parentVal = document.getElementById("cat-parent-select").value;
  const parentId = parentVal === "none" ? null : parentVal;
  const image = document.getElementById("cat-image").value.trim();

  const categories = getDB("categories", []);
  categories.push({
    id: "cat_" + Date.now(),
    name,
    parentId,
    image
  });
  setDB("categories", categories);
  alert("تمت إضافة القسم بنجاح!");
  e.target.reset();
  renderAdminCategories();
  if (typeof renderCategories === "function") renderCategories();
  switchAdminSection("categories");
}

function deleteAdminCategory(id) {
  if (!confirm("هل أنت متأكد من حذف هذا القسم؟")) return;
  let categories = getDB("categories", []);
  categories = categories.filter(c => c.id !== id);
  setDB("categories", categories);
  renderAdminCategories();
  if (typeof renderCategories === "function") renderCategories();
}

function loadParentCategoriesSelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const categories = getDB("categories", []).filter(c => !c.parentId);
  select.innerHTML = `<option value="none">-- قسم رئيسي --</option>` + 
    categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
}

function renderAdminDepositRequests() {
  const container = document.getElementById("deposit-requests-container");
  if (!container) return;

  const requests = getDB("deposit_requests", []);
  if (requests.length === 0) {
    container.innerHTML = `<p style="color:#94a3b8; text-align:center; padding:20px;">لا توجد طلبات إيداع جديدة</p>`;
    return;
  }

  container.innerHTML = requests.map(r => `
    <div style="background:#162444; border-radius:12px; padding:14px; margin-bottom:12px; border-right:4px solid ${r.status === 'مقبول' ? '#10b981' : '#f59e0b'};">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <strong>المستخدم: ${r.userName} (${r.methodName || "شام كاش"})</strong>
        <span style="font-size:0.8rem; color:#94a3b8;">${r.date}</span>
      </div>
      <div style="font-size:0.9rem; margin-bottom:6px;">
        المبلغ: <span style="color:#38bdf8; font-weight:bold;">$${r.amountUSD}</span> (${Number(r.amountSYP).toLocaleString()} ل.س)
      </div>
      <div style="font-size:0.85rem; color:#cbd5e1; margin-bottom:8px;">
        اسم المرسل: <span style="color:#fff; font-weight:bold;">${r.sender}</span> | ملاحظة: ${r.note || "لا يوجد"}
      </div>
      ${r.receipt ? `<div style="margin-bottom:8px;"><a href="${r.receipt}" target="_blank" style="color:#38bdf8; font-size:0.85rem; text-decoration:underline;">عرض صورة الإشعار</a></div>` : ''}
      <div style="display:flex; gap:8px;">
        ${r.status === 'معلق' ? `
          <button onclick="approveDepositRequest('${r.id}')" style="background:#10b981; border:none; color:#fff; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.85rem;">قبول وشحن الرصيد</button>
          <button onclick="rejectDepositRequest('${r.id}')" style="background:#ef4444; border:none; color:#fff; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.85rem;">رفض</button>
        ` : `<span style="font-size:0.85rem; font-weight:bold; color:${r.status === 'مقبول' ? '#10b981' : '#ef4444'};">الحالة: ${r.status}</span>`}
      </div>
    </div>
  `).join("");
}

function approveDepositRequest(reqId) {
  let requests = getDB("deposit_requests", []);
  const req = requests.find(r => r.id === reqId);
  if (!req) return;

  let users = getDB("users", []);
  const user = users.find(u => u.name === req.userName);
  if (user) {
    user.balanceUSD = Number(((user.balanceUSD || 0) + Number(req.amountUSD)).toFixed(3));
    setDB("users", users);
  }

  req.status = "مقبول";
  setDB("deposit_requests", requests);
  alert(`✅ تم شحن $${req.amountUSD} في حساب ${req.userName} بنجاح!`);
  renderAdminDepositRequests();
  renderAdminStats();
  if (typeof updateUserUI === "function") updateUserUI();
}

function rejectDepositRequest(reqId) {
  let requests = getDB("deposit_requests", []);
  const req = requests.find(r => r.id === reqId);
  if (!req) return;

  req.status = "مرفوض";
  setDB("deposit_requests", requests);
  alert("تم رفض طلب الشحن.");
  renderAdminDepositRequests();
}

// --- إدارة طرق الإيداع والباركود من لوحة التحكم ---
function renderAdminDepositMethods() {
  const container = document.getElementById("admin-methods-container");
  if (!container) return;

  const methods = getDB("depositMethods", initialDepositMethods);
  if (!Array.isArray(methods) || methods.length === 0) {
    container.innerHTML = `<p style="color:#94a3b8; text-align:center; padding:20px;">لا توجد طرق إيداع مضافة حالياً.</p>`;
    return;
  }

  container.innerHTML = methods.map(m => {
    const qrPreview = (m.qrImage && m.qrImage.trim().length > 5)
      ? m.qrImage.trim()
      : `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(m.account || "")}`;

    return `
      <div style="background:#162444; padding:12px; border-radius:12px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; gap:12px;">
        <div style="display:flex; align-items:center; gap:12px; overflow:hidden;">
          <img src="${qrPreview}" alt="QR" style="width:48px; height:48px; background:#fff; padding:3px; border-radius:8px; flex-shrink:0;">
          <div style="overflow:hidden;">
            <div style="font-weight:800; color:#fff; font-size:0.95rem;">${m.name} (${m.currency || "USD"})</div>
            <div style="font-size:0.78rem; color:#38bdf8; word-break:break-all;" dir="ltr">${m.account}</div>
            <div style="font-size:0.75rem; color:#94a3b8;">سعر الصرف: 1$ = ${Number(m.rate || 15000).toLocaleString()} ل.س</div>
          </div>
        </div>
        <button style="background:#ef4444; border:none; color:#fff; padding:6px 12px; border-radius:8px; cursor:pointer; font-weight:bold; flex-shrink:0;" onclick="deleteAdminDepositMethod('${m.id}')">حذف</button>
      </div>
    `;
  }).join("");
}

function handleAddDepositMethod(e) {
  e.preventDefault();
  const name = document.getElementById("method-name").value.trim();
  const account = document.getElementById("method-account").value.trim();
  const currency = document.getElementById("method-currency").value.trim() || "USD";
  const rate = parseFloat(document.getElementById("method-rate").value) || 15000;
  const qrInput = document.getElementById("method-qr") ? document.getElementById("method-qr").value.trim() : "";
  const icon = document.getElementById("method-icon").value.trim();

  const qrImage = qrInput.length > 5
    ? qrInput
    : `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(account)}`;

  const methods = getDB("depositMethods", initialDepositMethods);
  methods.push({
    id: "dm_" + Date.now(),
    name,
    account,
    currency,
    rate,
    qrImage,
    icon
  });

  setDB("depositMethods", methods);
  alert("✅ تمت إضافة طريقة الإيداع والباركود بنجاح!");
  e.target.reset();
  renderAdminDepositMethods();
  switchAdminSection("deposit-methods");
}

function deleteAdminDepositMethod(id) {
  if (!confirm("هل أنت متأكد من حذف طريقة الإيداع هذه؟")) return;
  let methods = getDB("depositMethods", initialDepositMethods);
  methods = methods.filter(m => m.id !== id);
  setDB("depositMethods", methods);
  renderAdminDepositMethods();
}

// --- إدارة المستخدمين المتقدمة (عرض المواصفات + حظر + حذف + تعديل الرصيد) ---
function renderAdminUsers() {
  const container = document.getElementById("admin-users-list");
  if (!container) return;
  const users = getDB("users", []);

  if (!Array.isArray(users) || users.length === 0) {
    container.innerHTML = `<p style="color:#94a3b8; text-align:center; padding:20px;">لا يوجد مستخدمون مسجلون حالياً.</p>`;
    return;
  }

  container.innerHTML = users.map((u, idx) => {
    const isBanned = Boolean(u.isBanned);
    const displayName = u.fullname || u.name || "مستخدم";
    const statusBadge = isBanned
      ? `<span style="background:#ef4444; color:#fff; font-size:0.7rem; padding:2px 8px; border-radius:20px; margin-right:6px;">محظور 🚫</span>`
      : `<span style="background:#10b981; color:#fff; font-size:0.7rem; padding:2px 8px; border-radius:20px; margin-right:6px;">نشط ✓</span>`;

    return `
      <div style="background:#162444; border: 1px solid ${isBanned ? '#ef4444' : 'rgba(56,189,248,0.2)'}; padding:14px; border-radius:14px; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
          <div>
            <div style="font-weight:800; color:#fff; font-size:0.95rem;">
              ${displayName} ${statusBadge}
            </div>
            <div style="font-size:0.8rem; color:#94a3b8; margin-top:4px;">
              ${u.email || "بدون إيميل"} | الرتبة: <strong style="color:#38bdf8;">${u.role || "عضو"}</strong> | الرصيد: <strong style="color:#10b981;">$${Number(u.balanceUSD || 0).toFixed(2)}</strong>
            </div>
          </div>

          <button onclick="openUserDetailsModal(${idx})" style="background:#0284c7; border:none; color:#fff; padding:8px 14px; border-radius:10px; cursor:pointer; font-weight:800; font-size:0.82rem; display:flex; align-items:center; gap:6px;">
            <i class="fa-solid fa-eye"></i> عرض المواصفات وإدارة
          </button>
        </div>
      </div>
    `;
  }).join("");
}

// نافذة منبثقة لعرض جميع مواصفات ومميزات الحساب مع أزرار الحظر والحذف
function openUserDetailsModal(userIndex) {
  const users = getDB("users", []);
  const u = users[userIndex];
  if (!u) return;

  // إزالة أي نافذة سابقة إن وجدت
  const oldModal = document.getElementById("admin-user-inspect-modal");
  if (oldModal) oldModal.remove();

  const isBanned = Boolean(u.isBanned);
  const isProtectedAdmin = (u.email && u.email.toLowerCase() === "fhdsd686@gmail.com") || u.role === "الأسطورة";

  const modal = document.createElement("div");
  modal.id = "admin-user-inspect-modal";
  modal.style.cssText = "position:fixed; inset:0; background:rgba(3,7,18,0.88); backdrop-filter:blur(6px); z-index:100000; display:flex; align-items:center; justify-content:center; padding:16px;";

  modal.innerHTML = `
    <div style="width:100%; max-width:410px; background:#0b1329; border:1.5px solid #38bdf8; border-radius:22px; padding:22px 18px; color:#fff; position:relative; box-shadow:0 20px 50px rgba(0,0,0,0.7);">
      <button onclick="document.getElementById('admin-user-inspect-modal').remove()" style="position:absolute; top:14px; left:14px; background:rgba(255,255,255,0.1); border:none; color:#fff; width:32px; height:32px; border-radius:50%; cursor:pointer; font-size:1rem;">✕</button>

      <div style="text-align:center; margin-bottom:16px;">
        <img src="${u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}" style="width:68px; height:68px; border-radius:50%; object-fit:cover; border:2.5px solid #38bdf8; margin-bottom:8px;">
        <h3 style="font-size:1.15rem; font-weight:900; margin:0;">${u.fullname || u.name || "مستخدم"}</h3>
        <span style="display:inline-block; margin-top:4px; font-size:0.78rem; padding:3px 12px; border-radius:20px; background:${isBanned ? '#ef4444' : '#10b981'}; font-weight:bold;">
          ${isBanned ? 'الحساب محظور حالياً 🚫' : 'الحساب نشط ومفعّل ✓'}
        </span>
      </div>

      <div style="background:#050b18; border:1px solid rgba(56,189,248,0.2); border-radius:14px; padding:12px 14px; font-size:0.85rem; line-height:1.9; margin-bottom:14px;">
        <div><span style="color:#94a3b8;">اسم المستخدم:</span> <strong>${u.name || "غير محدد"}</strong></div>
        <div><span style="color:#94a3b8;">البريد الإلكتروني:</span> <strong dir="ltr">${u.email || "بدون إيميل"}</strong></div>
        <div><span style="color:#94a3b8;">المستوى / الرتبة:</span> <strong style="color:#f59e0b;">${u.role || "عضو"}</strong></div>
        <div><span style="color:#94a3b8;">الرصيد المتوفر:</span> <strong style="color:#10b981;">$${Number(u.balanceUSD || 0).toFixed(3)}</strong></div>
        <div><span style="color:#94a3b8;">عدد الطلبات المنفذة:</span> <strong>${u.ordersCount || 0} طلب</strong></div>
        <div><span style="color:#94a3b8;">صلاحية الإدارة:</span> <strong>${isProtectedAdmin ? "مدير النظام (كاملة)" : "مستخدم متجر"}</strong></div>
      </div>

      <!-- تعديل الرصيد السريع -->
      <div style="display:flex; gap:8px; margin-bottom:14px;">
        <input type="number" step="any" id="quick-edit-balance" value="${Number(u.balanceUSD || 0)}" placeholder="الرصيد الجديد ($)" style="flex:1; background:#050b18; border:1px solid #38bdf8; border-radius:10px; padding:9px 12px; color:#fff; font-weight:bold;">
        <button onclick="adminUpdateUserBalance(${userIndex})" style="background:#10b981; border:none; color:#fff; padding:0 14px; border-radius:10px; font-weight:800; cursor:pointer;">حفظ الرصيد</button>
      </div>

      <!-- أزرار الحظر والحذف -->
      <div style="display:flex; gap:10px;">
        <button onclick="adminToggleBanUser(${userIndex})" style="flex:1; background:${isBanned ? '#10b981' : '#f59e0b'}; border:none; color:#fff; padding:11px; border-radius:12px; font-weight:800; font-size:0.88rem; cursor:pointer;">
          <i class="fa-solid ${isBanned ? 'fa-unlock' : 'fa-ban'}"></i> ${isBanned ? 'فك الحظر' : 'حظر الحساب'}
        </button>
        <button onclick="adminDeleteUser(${userIndex})" style="flex:1; background:#ef4444; border:none; color:#fff; padding:11px; border-radius:12px; font-weight:800; font-size:0.88rem; cursor:pointer;">
          <i class="fa-solid fa-trash"></i> حذف الحساب
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function adminUpdateUserBalance(userIndex) {
  const input = document.getElementById("quick-edit-balance");
  if (!input) return;
  const newVal = parseFloat(input.value);
  if (isNaN(newVal) || newVal < 0) {
    alert("يرجى إدخال رصيد صحيح!");
    return;
  }

  const users = getDB("users", []);
  if (!users[userIndex]) return;

  users[userIndex].balanceUSD = Number(newVal.toFixed(3));
  setDB("users", users);
  alert(`✅ تم تحديث رصيد ${users[userIndex].name} إلى $${users[userIndex].balanceUSD} بنجاح!`);
  renderAdminUsers();
  openUserDetailsModal(userIndex);
  if (typeof updateUserUI === "function") updateUserUI();
}

function adminToggleBanUser(userIndex) {
  const users = getDB("users", []);
  const u = users[userIndex];
  if (!u) return;

  if (u.email && u.email.toLowerCase() === "fhdsd686@gmail.com") {
    alert("لا يمكن حظر حساب المدير الأساسي للمتجر!");
    return;
  }

  const nextBanState = !Boolean(u.isBanned);
  const confirmMsg = nextBanState
    ? `هل أنت متأكد من حظر حساب "${u.fullname || u.name}" ومنعه من استخدام المتجر؟`
    : `هل تريد فك الحظر عن حساب "${u.fullname || u.name}"؟`;

  if (!confirm(confirmMsg)) return;

  u.isBanned = nextBanState;
  setDB("users", users);
  alert(nextBanState ? "🚫 تم حظر الحساب بنجاح!" : "✅ تم فك الحظر عن الحساب بنجاح!");
  renderAdminUsers();
  openUserDetailsModal(userIndex);
}

function adminDeleteUser(userIndex) {
  const users = getDB("users", []);
  const u = users[userIndex];
  if (!u) return;

  if (u.email && u.email.toLowerCase() === "fhdsd686@gmail.com") {
    alert("لا يمكن حذف حساب المدير الأساسي للمتجر!");
    return;
  }

  if (!confirm(`⚠️ تحذير: هل أنت متأكد من حذف حساب "${u.fullname || u.name}" نهائياً؟`)) return;

  users.splice(userIndex, 1);
  setDB("users", users);

  const modal = document.getElementById("admin-user-inspect-modal");
  if (modal) modal.remove();

  alert("🗑️ تم حذف الحساب نهائياً.");
  renderAdminUsers();
  if (typeof updateUserUI === "function") updateUserUI();
}

function submitUserUpgrade() {
  const search = document.getElementById("upgrade-search-input").value.trim().toLowerCase();
  const newRole = document.getElementById("upgrade-role-select").value;

  let users = getDB("users", []);
  const user = users.find(u => 
    (u.name && u.name.toLowerCase() === search) || 
    (u.email && u.email.toLowerCase() === search) || 
    (u.fullname && u.fullname.toLowerCase() === search)
  );

  if (!user) {
    alert("لم يتم العثور على المستخدم!");
    return;
  }

  user.role = newRole;
  setDB("users", users);
  alert(`تمت ترقية المستخدم ${user.name} إلى ${newRole} بنجاح!`);
  renderAdminUsers();
  if (typeof updateUserUI === "function") updateUserUI();
}
