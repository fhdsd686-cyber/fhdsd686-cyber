// --- منطق لوحة إدارة النظام والتحكم بوضع الصيانة والبيانات ---

document.addEventListener("DOMContentLoaded", () => {
  updateMaintenanceBtnUI();
});

// فتح وإغلاق لوحة الإدارة
function openAdminPanel() {
  const users = getDB("users", []);
  const currentUser = (Array.isArray(users) && users.length > 0) ? users[0] : null;

  if (!currentUser || (currentUser.role !== "الأسطورة" && currentUser.role !== "Admin" && currentUser.name !== "Mohannad")) {
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

// التنقل بين أقسام لوحة التحكم
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
}

// 1. الإحصائيات
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

// 2. تحديث هوية المتجر
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

// 3. إدارة المنتجات
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

// 4. إدارة الأقسام
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

// 5. إدارة طرق الإيداع
function renderAdminDepositMethods() {
  const container = document.getElementById("admin-methods-container");
  if (!container) return;
  const methods = getDB("deposit_methods", []);
  container.innerHTML = methods.map(m => `
    <div style="background:#162444; padding:10px; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
      <div><strong>${m.name}</strong> - الحساب: ${m.account} (${m.currency})</div>
      <button style="background:#ef4444; border:none; color:#fff; padding:4px 8px; border-radius:6px; cursor:pointer;" onclick="deleteAdminDepositMethod('${m.id}')">حذف</button>
    </div>
  `).join("");
}

function handleAddDepositMethod(e) {
  e.preventDefault();
  const name = document.getElementById("method-name").value.trim();
  const account = document.getElementById("method-account").value.trim();
  const currency = document.getElementById("method-currency").value.trim();
  const rate = parseFloat(document.getElementById("method-rate").value);
  const icon = document.getElementById("method-icon").value.trim();

  const methods = getDB("deposit_methods", []);
  methods.push({ id: "dm_" + Date.now(), name, account, currency, rate, icon });
  setDB("deposit_methods", methods);
  alert("تمت إضافة طريقة الإيداع بنجاح!");
  e.target.reset();
  renderAdminDepositMethods();
  switchAdminSection("deposit-methods");
}

function deleteAdminDepositMethod(id) {
  let methods = getDB("deposit_methods", []);
  methods = methods.filter(m => m.id !== id);
  setDB("deposit_methods", methods);
  renderAdminDepositMethods();
}

// 6. إدارة المستخدمين والترقيات
function renderAdminUsers() {
  const container = document.getElementById("admin-users-list");
  if (!container) return;
  const users = getDB("users", []);
  container.innerHTML = users.map(u => `
    <div style="background:#162444; padding:10px; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
      <div><strong>${u.name}</strong> - الرتبة: ${u.role || "عضو"} - الرصيد: $${Number(u.balanceUSD || 0).toFixed(2)}</div>
    </div>
  `).join("");
}

function submitUserUpgrade() {
  const search = document.getElementById("upgrade-search-input").value.trim().toLowerCase();
  const newRole = document.getElementById("upgrade-role-select").value;

  let users = getDB("users", []);
  const user = users.find(u => (u.name && u.name.toLowerCase() === search) || (u.fullname && u.fullname.toLowerCase() === search));

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
