// --- إدارة لوحة التحكم (Admin Panel) ---

document.addEventListener("DOMContentLoaded", () => {
  setupAdminNavigation();
  populateCategorySelects();
  updateStats();
});

// التنقل بين أقسام لوحة الإدارة
function switchAdminSection(sectionName) {
  const sections = [
    'stats', 'users', 'upgrade-user', 'products', 'add-product',
    'categories', 'add-category', 'deposit-requests', 'deposit-methods', 'add-deposit-method'
  ];

  sections.forEach(sec => {
    const el = document.getElementById(`sec-${sec}`);
    if (el) el.classList.add('hidden');
  });

  const activeSec = document.getElementById(`sec-${sectionName}`);
  if (activeSec) activeSec.classList.remove('hidden');

  // تحديث تمييز الأزرار في الشريط
  const navBtns = document.querySelectorAll('.admin-nav-item');
  navBtns.forEach(btn => btn.classList.remove('active'));
  
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
  }

  // تحميل بيانات القسم المختار
  if (sectionName === 'stats') updateStats();
  if (sectionName === 'users') renderAdminUsers();
  if (sectionName === 'products') renderAdminProducts();
  if (sectionName === 'categories') renderAdminCategories();
  if (sectionName === 'deposit-requests') renderDepositRequests();
  if (sectionName === 'deposit-methods') renderAdminMethods();
  if (sectionName === 'add-product' || sectionName === 'add-category') populateCategorySelects();
}

function openAdminPanel() {
  const wrapper = document.getElementById("admin-wrapper");
  if (wrapper) wrapper.classList.remove("hidden");
  switchAdminSection('stats');
}

function closeAdminPanel() {
  const wrapper = document.getElementById("admin-wrapper");
  if (wrapper) wrapper.classList.add("hidden");
}

// 1. الإحصائيات
function updateStats() {
  const users = getDB("users", []);
  const products = getDB("products", []);
  const deposits = getDB("deposit_requests", []);

  let totalSales = 0;
  let totalOrders = 0;
  users.forEach(u => {
    totalOrders += (u.ordersCount || 0);
  });

  let totalDeposits = 0;
  deposits.filter(d => d.status === 'accepted').forEach(d => {
    totalDeposits += Number(d.amountUSD || 0);
  });

  const salesEl = document.getElementById("stat-sales");
  const ordersEl = document.getElementById("stat-orders-count");
  const depositsEl = document.getElementById("stat-total-deposits");

  if (salesEl) salesEl.innerText = `$${totalSales.toFixed(2)}`;
  if (ordersEl) ordersEl.innerText = totalOrders;
  if (depositsEl) depositsEl.innerText = `$${totalDeposits.toFixed(2)}`;
}

// 2. إدارة المستخدمين
function renderAdminUsers() {
  const list = document.getElementById("admin-users-list");
  if (!list) return;

  const users = getDB("users", []);
  const filter = document.getElementById("users-filter") ? document.getElementById("users-filter").value : "all";

  let filtered = users;
  if (filter === "has_balance") filtered = users.filter(u => (u.balanceUSD > 0 || u.balanceSYP > 0));
  if (filter === "no_balance") filtered = users.filter(u => (!u.balanceUSD && !u.balanceSYP));

  list.innerHTML = "";
  if (filtered.length === 0) {
    list.innerHTML = "<p style='color:var(--text-muted);'>لا يوجد مستخدمين مسجلين</p>";
    return;
  }

  filtered.forEach(u => {
    const card = document.createElement("div");
    card.className = "user-admin-card";
    card.innerHTML = `
      <div class="user-admin-header">
        <img src="${u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}" alt="Avatar">
        <div>
          <strong>${u.name}</strong> (${u.role || 'عضو'})<br>
          <small style="color:var(--text-muted);">${u.email || u.username}</small>
        </div>
      </div>
      <div class="user-stats-row">
        <span>الرصيد: $${Number(u.balanceUSD || 0).toFixed(2)} | ${Number(u.balanceSYP || 0).toLocaleString()} ل.س</span>
        <span>الطلبات: ${u.ordersCount || 0}</span>
      </div>
    `;
    list.appendChild(card);
  });
}

// 3. ترقية المستخدمين
function submitUserUpgrade() {
  const query = document.getElementById("upgrade-search-input").value.trim().toLowerCase();
  const newRole = document.getElementById("upgrade-role-select").value;

  if (!query) {
    alert("يرجى كتابة اسم أو بريد المستخدم");
    return;
  }

  const users = getDB("users", []);
  const user = users.find(u => 
    (u.name && u.name.toLowerCase().includes(query)) || 
    (u.email && u.email.toLowerCase().includes(query)) ||
    (u.username && u.username.toLowerCase().includes(query))
  );

  if (!user) {
    alert("لم يتم العثور على هذا المستخدم");
    return;
  }

  user.role = newRole;
  setDB("users", users);
  alert(`تمت ترقية ${user.name} إلى رتبة: ${newRole}`);
  document.getElementById("upgrade-search-input").value = "";
}

// 4. عرض المنتجات
function renderAdminProducts() {
  const tbody = document.getElementById("admin-products-table");
  if (!tbody) return;

  const products = getDB("products", []);
  const categories = getDB("categories", []);
  tbody.innerHTML = "";

  products.forEach(p => {
    const cat = categories.find(c => c.id === p.categoryId);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.name}</td>
      <td>${cat ? cat.name : 'بدون قسم'}</td>
      <td>$${p.priceUSD}</td>
      <td><button onclick="deleteProduct('${p.id}')" style="background:#ef4444; border:none; color:#fff; padding:4px 8px; border-radius:6px; cursor:pointer;">حذف</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function deleteProduct(id) {
  if (!confirm("هل أنت متأكد من حذف هذا المنتج؟")) return;
  let products = getDB("products", []);
  products = products.filter(p => p.id !== id);
  setDB("products", products);
  renderAdminProducts();
  if (typeof renderProducts === "function") renderProducts();
}

// 5. إضافة منتج جديد
function handleAddProduct(e) {
  if (e) e.preventDefault();

  const catId = document.getElementById("prod-category-select").value;
  const name = document.getElementById("prod-name").value.trim();
  const priceUSD = parseFloat(document.getElementById("prod-price-usd").value) || 0;
  const priceSYP = parseFloat(document.getElementById("prod-price-syp").value) || 0;
  const desc = document.getElementById("prod-desc").value.trim();
  const image = document.getElementById("prod-image").value.trim();

  if (!name) {
    alert("يرجى كتابة اسم المنتج");
    return;
  }

  const products = getDB("products", []);
  const newProd = {
    id: "prod_" + Date.now(),
    categoryId: catId,
    name: name,
    priceUSD: priceUSD,
    priceSYP: priceSYP,
    desc: desc,
    image: image || "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?w=300"
  };

  products.push(newProd);
  setDB("products", products);
  alert("تمت إضافة المنتج بنجاح!");

  document.getElementById("add-product-form").reset();
  switchAdminSection("products");
}

// 6. عرض الأقسام الحالية
function renderAdminCategories() {
  const tbody = document.getElementById("admin-categories-table");
  if (!tbody) return;

  const categories = getDB("categories", []);
  tbody.innerHTML = "";

  categories.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.name}</td>
      <td>${c.parentId ? 'فرعي' : 'رئيسي'}</td>
      <td><button onclick="deleteCategory('${c.id}')" style="background:#ef4444; border:none; color:#fff; padding:4px 8px; border-radius:6px; cursor:pointer;">حذف</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function deleteCategory(id) {
  if (!confirm("هل أنت متأكد من حذف هذا القسم؟")) return;
  let categories = getDB("categories", []);
  categories = categories.filter(c => c.id !== id);
  setDB("categories", categories);
  renderAdminCategories();
  populateCategorySelects();
  if (typeof renderCategories === "function") renderCategories();
}

// 7. دالة إضافة قسم (المحدثة والمرنة)
function handleAddCategory(e) {
  if (e) e.preventDefault();

  const nameInput = document.getElementById("cat-name");
  const parentSelect = document.getElementById("cat-parent-select");
  const imageInput = document.getElementById("cat-image");

  if (!nameInput || !nameInput.value.trim()) {
    alert("يرجى إدخال اسم القسم");
    return;
  }

  const name = nameInput.value.trim();
  const parentId = parentSelect ? parentSelect.value : "main";
  const image = (imageInput && imageInput.value.trim()) 
    ? imageInput.value.trim() 
    : "https://images.unsplash.com/photo-1611605698335-8b1569810432?w=300";

  const categories = getDB("categories", []);

  const newCat = {
    id: "cat_" + Date.now(),
    name: name,
    parentId: parentId === "main" ? null : parentId,
    image: image
  };

  categories.push(newCat);
  setDB("categories", categories);

  alert("تمت إضافة القسم بنجاح!");

  // تصفير الخانات وتحديث الواجهة
  nameInput.value = "";
  if (imageInput) imageInput.value = "";

  populateCategorySelects();
  if (typeof renderCategories === "function") renderCategories();
  switchAdminSection("categories");
}

// تعبئة قوائم اختيار الأقسام
function populateCategorySelects() {
  const categories = getDB("categories", []);
  const prodCatSelect = document.getElementById("prod-category-select");
  const catParentSelect = document.getElementById("cat-parent-select");

  if (prodCatSelect) {
    prodCatSelect.innerHTML = "";
    categories.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      prodCatSelect.appendChild(opt);
    });
  }

  if (catParentSelect) {
    catParentSelect.innerHTML = `<option value="main">قسم رئيسي</option>`;
    categories.filter(c => !c.parentId).forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `تابع لـ: ${c.name}`;
      catParentSelect.appendChild(opt);
    });
  }
}

// 8. طلبات الإيداع
function renderDepositRequests() {
  const container = document.getElementById("deposit-requests-container");
  if (!container) return;

  const requests = getDB("deposit_requests", []);
  const filter = document.getElementById("deposit-status-filter") ? document.getElementById("deposit-status-filter").value : "all";

  let filtered = requests;
  if (filter !== "all") filtered = requests.filter(r => r.status === filter);

  container.innerHTML = "";
  if (filtered.length === 0) {
    container.innerHTML = "<p style='color:var(--text-muted);'>لا توجد طلبات إيداع</p>";
    return;
  }

  filtered.forEach(req => {
    const card = document.createElement("div");
    card.className = "deposit-req-card";
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between;">
        <strong>المستخدم: ${req.userName || req.userId}</strong>
        <span style="color:#38bdf8;">$${req.amountUSD} (${req.amountLocal || 0})</span>
      </div>
      <small style="color:var(--text-muted);">الطريقة: ${req.methodName}</small>
      ${req.proofImage ? `<img src="${req.proofImage}" class="deposit-proof-img" onclick="window.open('${req.proofImage}')">` : ''}
      <div style="margin-top:8px; display:flex; gap:8px;">
        ${req.status === 'pending' ? `
          <button onclick="resolveDeposit('${req.id}', 'accepted')" style="background:#10b981; border:none; color:#fff; padding:6px 12px; border-radius:6px; cursor:pointer;">قبول</button>
          <button onclick="resolveDeposit('${req.id}', 'rejected')" style="background:#ef4444; border:none; color:#fff; padding:6px 12px; border-radius:6px; cursor:pointer;">رفض</button>
        ` : `<span>الحالة: ${req.status === 'accepted' ? 'مقبول' : 'مرفوض'}</span>`}
      </div>
    `;
    container.appendChild(card);
  });
}

function resolveDeposit(reqId, status) {
  const requests = getDB("deposit_requests", []);
  const req = requests.find(r => r.id === reqId);
  if (!req) return;

  req.status = status;
  if (status === 'accepted') {
    const users = getDB("users", []);
    const user = users.find(u => u.id === req.userId);
    if (user) {
      user.balanceUSD = Number((user.balanceUSD || 0) + Number(req.amountUSD));
      setDB("users", users);
    }
  }

  setDB("deposit_requests", requests);
  renderDepositRequests();
  updateStats();
}

// 9. طرق الإيداع
function renderAdminMethods() {
  const container = document.getElementById("admin-methods-container");
  if (!container) return;

  const methods = getDB("deposit_methods", []);
  container.innerHTML = "";

  methods.forEach(m => {
    const card = document.createElement("div");
    card.style = "background:#1e293b; padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;";
    card.innerHTML = `
      <div><strong>${m.name}</strong> (${m.currency})<br><small>${m.account}</small></div>
      <button onclick="deleteMethod('${m.id}')" style="background:#ef4444; border:none; color:#fff; padding:4px 8px; border-radius:6px; cursor:pointer;">حذف</button>
    `;
    container.appendChild(card);
  });
}

function deleteMethod(id) {
  if (!confirm("هل تريد حذف طريقة الإيداع؟")) return;
  let methods = getDB("deposit_methods", []);
  methods = methods.filter(m => m.id !== id);
  setDB("deposit_methods", methods);
  renderAdminMethods();
}

// 10. إضافة طريقة إيداع
function handleAddDepositMethod(e) {
  if (e) e.preventDefault();

  const name = document.getElementById("method-name").value.trim();
  const account = document.getElementById("method-account").value.trim();
  const currency = document.getElementById("method-currency").value.trim();
  const rate = parseFloat(document.getElementById("method-rate").value) || 1;
  const icon = document.getElementById("method-icon").value.trim();

  const methods = getDB("deposit_methods", []);
  methods.push({
    id: "meth_" + Date.now(),
    name: name,
    account: account,
    currency: currency,
    rate: rate,
    icon: icon || ""
  });

  setDB("deposit_methods", methods);
  alert("تمت إضافة طريقة الإيداع!");
  document.getElementById("add-method-form").reset();
  switchAdminSection("deposit-methods");
}

function setupAdminNavigation() {}
