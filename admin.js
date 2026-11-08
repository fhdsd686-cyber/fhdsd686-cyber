// --- محرك لوحة الإدارة المتكاملة (10 أقسام + الإعدادات) ---

// فتح لوحة الإدارة مع فحص الحماية
function openAdminPanel() {
  if (!currentUser || currentUser.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    alert("عذراً، هذه اللوحة مخصصة لإدارة النظام فقط!");
    return;
  }
  const adminWrapper = document.getElementById("admin-wrapper");
  if (adminWrapper) {
    adminWrapper.classList.remove("hidden");
    switchAdminSection("stats");
    loadAdminCategoriesSelect();
  }
}

// إغلاق لوحة الإدارة والعودة للمتجر
function closeAdminPanel() {
  const adminWrapper = document.getElementById("admin-wrapper");
  if (adminWrapper) adminWrapper.classList.add("hidden");
}

// التنقل بين الأقسام العشرة
function switchAdminSection(sectionName) {
  const sections = [
    "stats", "users", "upgrade-user", "products", "add-product",
    "categories", "add-category", "deposit-requests", "deposit-methods",
    "add-deposit-method", "site-settings"
  ];

  sections.forEach(sec => {
    const el = document.getElementById("sec-" + sec);
    if (el) el.classList.add("hidden");
  });

  const target = document.getElementById("sec-" + sectionName);
  if (target) target.classList.remove("hidden");

  // تحديث الزر النشط في الشريط الجانبي
  document.querySelectorAll(".admin-nav-item").forEach(btn => btn.classList.remove("active"));
  const activeBtn = Array.from(document.querySelectorAll(".admin-nav-item")).find(b => 
    b.getAttribute("onclick") && b.getAttribute("onclick").includes(sectionName)
  );
  if (activeBtn) activeBtn.classList.add("active");

  // تشغيل دوال العرض حسب القسم
  if (sectionName === "stats") updateStats();
  if (sectionName === "users") renderAdminUsers();
  if (sectionName === "products") renderAdminProducts();
  if (sectionName === "categories") renderAdminCategories();
  if (sectionName === "deposit-requests") renderDepositRequests();
  if (sectionName === "deposit-methods") renderAdminDepositMethods();
  if (sectionName === "add-product" || sectionName === "add-category") loadAdminCategoriesSelect();
}

// --- 1. قسم الإحصائيات ---
function updateStats() {
  const filterDate = document.getElementById("stats-date-filter")?.value;
  const requests = getDB("deposit_requests", []);
  const users = getDB("users", []);

  let acceptedDeposits = requests.filter(r => r.status === "accepted");
  if (filterDate) {
    acceptedDeposits = acceptedDeposits.filter(r => r.date === filterDate);
  }

  const totalDepositsUSD = acceptedDeposits.reduce((sum, r) => sum + Number(r.amountUSD || 0), 0);
  const totalOrders = users.reduce((sum, u) => sum + Number(u.ordersCount || 0), 0);
  const totalPurchasesUSD = users.reduce((sum, u) => sum + (Number(u.totalSuccessfulDepositsUSD || 0) - Number(u.balanceUSD || 0)), 0);

  const salesEl = document.getElementById("stat-sales");
  const ordersEl = document.getElementById("stat-orders-count");
  const depositsEl = document.getElementById("stat-total-deposits");

  if (salesEl) salesEl.innerText = `$${Math.max(0, totalPurchasesUSD).toFixed(2)}`;
  if (ordersEl) ordersEl.innerText = totalOrders;
  if (depositsEl) depositsEl.innerText = `$${totalDepositsUSD.toFixed(2)}`;
}

// --- 2. قسم المستخدمين ---
function renderAdminUsers() {
  const container = document.getElementById("admin-users-list");
  if (!container) return;

  const filter = document.getElementById("users-filter")?.value || "all";
  let users = getDB("users", []);

  if (filter === "has_balance") {
    users = users.filter(u => Number(u.balanceUSD || 0) > 0 || Number(u.balanceSYP || 0) > 0);
  } else if (filter === "no_balance") {
    users = users.filter(u => Number(u.balanceUSD || 0) <= 0 && Number(u.balanceSYP || 0) <= 0);
  }

  container.innerHTML = "";
  if (users.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted); text-align:center;">لا يوجد مستخدمين مطابقين</p>`;
    return;
  }

  users.forEach(u => {
    const card = document.createElement("div");
    card.className = "user-admin-card";
    card.innerHTML = `
      <div class="user-admin-header">
        <img src="${u.avatar || 'https://via.placeholder.com/45'}" alt="Avatar">
        <div>
          <strong>${u.name}</strong> <span class="badge-rank">${u.role === 'مدير' ? 'مدير' : (u.rank || 'مضيف')}</span>
          <div style="font-size:0.8rem; color:var(--text-muted);">${u.email}</div>
        </div>
      </div>
      <div class="user-stats-row">
        <div><strong>الرصيد:</strong> $${Number(u.balanceUSD || 0).toFixed(2)} | ${Number(u.balanceSYP || 0).toLocaleString()} ل.س</div>
        <div><strong>الطلبات:</strong> ${u.ordersCount || 0}</div>
        <div><strong>المشتريات الناجحة:</strong> ${u.successPurchases || 0}</div>
        <div><strong>الإيداعات:</strong> ${u.depositsCount || 0}</div>
      </div>
      <div style="font-size:0.8rem; color:var(--accent-neon); margin-top:4px;">
        <strong>مجموع الإيداعات الناجحة:</strong> $${Number(u.totalSuccessfulDepositsUSD || 0).toFixed(2)}
      </div>
      <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted);">
        <span><strong>المستوى الحالي:</strong> ${u.rank || 'مضيف'}</span>
        <span><strong>تاريخ التسجيل:</strong> ${u.joinedDate || 'غير مسجل'}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

// --- 3. قسم رفع مستوى مستخدم ---
function submitUserUpgrade() {
  const query = document.getElementById("upgrade-search-input").value.trim().toLowerCase();
  const newRank = document.getElementById("upgrade-role-select").value;

  if (!query) {
    alert("يرجى إدخال اسم أو بريد المستخدم المراد ترقيته");
    return;
  }

  const users = getDB("users", []);
  const user = users.find(u => u.email.toLowerCase() === query || u.name.toLowerCase() === query);

  if (!user) {
    alert("لم يتم العثور على أي مستخدم بهذا البريد أو الاسم!");
    return;
  }

  user.rank = newRank;
  setDB("users", users);

  if (currentUser && currentUser.id === user.id) {
    currentUser.rank = newRank;
    localStorage.setItem("mk_session", JSON.stringify(currentUser));
    applyUserSession();
  }

  alert(`تم بنجاح رفع مستوى المستخدم (${user.name}) إلى رتبة: [${newRank}]`);
  document.getElementById("upgrade-search-input").value = "";
}

// --- 4. قسم المنتجات والتحكم بها ---
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
      <td><img src="${p.image}" style="width:35px; height:35px; border-radius:6px; object-fit:cover;"></td>
      <td>${p.name}</td>
      <td>${cat ? cat.name : 'غير محدد'}</td>
      <td>$${Number(p.priceUSD).toFixed(2)}</td>
      <td>${Number(p.priceSYP).toLocaleString()} ل.س</td>
      <td>
        <button class="btn-danger-sm" onclick="deleteProduct('${p.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
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
  renderProducts();
}

// --- 5. قسم إضافة منتج ---
function handleAddProduct(event) {
  event.preventDefault();
  const categoryId = document.getElementById("prod-category-select").value;
  const name = document.getElementById("prod-name").value.trim();
  const priceUSD = parseFloat(document.getElementById("prod-price-usd").value);
  const priceSYP = parseInt(document.getElementById("prod-price-syp").value);
  const desc = document.getElementById("prod-desc").value.trim();
  const image = document.getElementById("prod-image").value.trim();

  const products = getDB("products", []);
  const newProd = {
    id: "prod-" + Date.now(),
    categoryId,
    name,
    priceUSD,
    priceSYP,
    desc,
    image
  };

  products.push(newProd);
  setDB("products", products);
  alert("تمت إضافة المنتج بنجاح!");
  document.getElementById("add-product-form").reset();
  switchAdminSection("products");
}

// --- 6. قسم الأقسام الحالية والتحكم بها ---
function renderAdminCategories() {
  const tbody = document.getElementById("admin-categories-table");
  if (!tbody) return;

  const categories = getDB("categories", []);
  tbody.innerHTML = "";

  categories.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><img src="${c.image}" style="width:35px; height:35px; border-radius:6px; object-fit:cover;"></td>
      <td>${c.name}</td>
      <td>${c.parent === 'main' ? 'رئيسي' : 'فرعي'}</td>
      <td>
        <button class="btn-danger-sm" onclick="deleteCategory('${c.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function deleteCategory(id) {
  if (!confirm("هل أنت متأكد من حذف هذا القسم وكافة المنتجات داخله؟")) return;
  let categories = getDB("categories", []);
  let products = getDB("products", []);

  categories = categories.filter(c => c.id !== id);
  products = products.filter(p => p.categoryId !== id);

  setDB("categories", categories);
  setDB("products", products);
  renderAdminCategories();
  renderCategories();
}

// --- 7. قسم إضافة قسم ---
function handleAddCategory(event) {
  event.preventDefault();
  const name = document.getElementById("cat-name").value.trim();
  const parent = document.getElementById("cat-parent-select").value;
  const desc = document.getElementById("cat-desc").value.trim();
  const image = document.getElementById("cat-image").value.trim();

  const categories = getDB("categories", []);
  const newCat = {
    id: "cat-" + Date.now(),
    name,
    parent,
    desc,
    image
  };

  categories.push(newCat);
  setDB("categories", categories);
  alert("تمت إضافة القسم بنجاح!");
  document.getElementById("add-category-form").reset();
  renderCategories();
  switchAdminSection("categories");
}

function loadAdminCategoriesSelect() {
  const catSelect = document.getElementById("prod-category-select");
  const parentSelect = document.getElementById("cat-parent-select");
  const categories = getDB("categories", []);

  if (catSelect) {
    catSelect.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
  }
  if (parentSelect) {
    parentSelect.innerHTML = `<option value="main">قسم رئيسي</option>` + 
      categories.map(c => `<option value="${c.id}">تابع لـ: ${c.name}</option>`).join("");
  }
}

// --- 8. قسم طلبات الإيداع بحالاتها الأربع وتكبير الصورة ---
function renderDepositRequests() {
  const container = document.getElementById("deposit-requests-container");
  if (!container) return;

  const filter = document.getElementById("deposit-status-filter")?.value || "all";
  let requests = getDB("deposit_requests", []);

  if (filter !== "all") {
    requests = requests.filter(r => r.status === filter);
  }

  container.innerHTML = "";
  if (requests.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted); text-align:center;">لا توجد طلبات إيداع في هذا القسم</p>`;
    return;
  }

  requests.forEach(r => {
    const card = document.createElement("div");
    card.className = "deposit-req-card";
    card.innerHTML = `
      <div class="deposit-req-header">
        <strong>${r.userName}</strong>
        <span class="badge-rank">${r.methodName}</span>
      </div>
      <div style="font-size:0.85rem; color:var(--accent-neon);">
        المبلغ المحول: ${r.amountRaw} ${r.currency} ⇦ ($${Number(r.amountUSD).toFixed(2)})
      </div>
      <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted);">
        <span>التاريخ: ${r.date}</span>
        <span>البريد: ${r.userEmail}</span>
      </div>
      <div>
        <label style="font-size:0.75rem; color:var(--text-muted);">إشعار التحويل (اضغط للتكبير):</label><br>
        <img src="${r.proofImage}" class="deposit-proof-img" onclick="window.open('${r.proofImage}', '_blank')" alt="إشعار التحويل">
      </div>
      <div style="margin-top:8px; display:flex; gap:8px;">
        ${r.status === 'pending' ? `
          <button class="btn-primary-sm" onclick="handleDepositDecision('${r.id}', 'accepted')">قبول وإضافة الرصيد</button>
          <button class="btn-danger-sm" onclick="handleDepositDecision('${r.id}', 'rejected')">رفض</button>
        ` : `
          <span style="font-size:0.8rem; font-weight:bold; color:${r.status === 'accepted' ? 'var(--success)' : 'var(--danger)'};">
            الحالة: ${r.status === 'accepted' ? 'مقبول وتم الشحن' : 'مرفوض'}
          </span>
        `}
      </div>
    `;
    container.appendChild(card);
  });
}

function handleDepositDecision(reqId, decision) {
  let requests = getDB("deposit_requests", []);
  let users = getDB("users", []);
  const req = requests.find(r => r.id === reqId);
  if (!req) return;

  req.status = decision;

  if (decision === "accepted") {
    const user = users.find(u => u.email.toLowerCase() === req.userEmail.toLowerCase());
    if (user) {
      user.balanceUSD = Number((Number(user.balanceUSD || 0) + Number(req.amountUSD)).toFixed(2));
      user.balanceSYP = Number(user.balanceSYP || 0) + Number(req.amountSYP || 0);
      user.depositsCount = (user.depositsCount || 0) + 1;
      user.totalSuccessfulDepositsUSD = Number(((user.totalSuccessfulDepositsUSD || 0) + Number(req.amountUSD)).toFixed(2));

      if (currentUser && currentUser.id === user.id) {
        currentUser = user;
        localStorage.setItem("mk_session", JSON.stringify(currentUser));
        applyUserSession();
      }
    }
  }

  setDB("deposit_requests", requests);
  setDB("users", users);
  renderDepositRequests();
  updateStats();
  alert(decision === "accepted" ? "تم قبول الطلب وإضافة الرصيد لحساب العميل بنجاح!" : "تم رفض الطلب.");
}

// --- 9. قسم طرق الإيداع الحالية ---
function renderAdminDepositMethods() {
  const container = document.getElementById("admin-methods-container");
  if (!container) return;

  const methods = getDB("deposit_methods", []);
  container.innerHTML = "";

  methods.forEach(m => {
    const card = document.createElement("div");
    card.className = "cat-card";
    card.style.textAlign = "right";
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <strong>${m.name}</strong>
        <button class="btn-danger-sm" onclick="deleteDepositMethod('${m.id}')"><i class="fa-solid fa-trash"></i></button>
      </div>
      <p style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">الحساب: ${m.account}</p>
      <p style="font-size:0.8rem; color:var(--accent-neon);">العملة: ${m.currency} | سعر الصرف: ${m.rateToUSD}</p>
    `;
    container.appendChild(card);
  });
}

function deleteDepositMethod(id) {
  if (!confirm("هل أنت متأكد من حذف وسيلة الإيداع هذه؟")) return;
  let methods = getDB("deposit_methods", []);
  methods = methods.filter(m => m.id !== id);
  setDB("deposit_methods", methods);
  renderAdminDepositMethods();
}

// --- 10. قسم إضافة طريقة إيداع (7 خانات) ---
function handleAddDepositMethod(event) {
  event.preventDefault();
  const name = document.getElementById("method-name").value.trim();
  const account = document.getElementById("method-account").value.trim();
  const currency = document.getElementById("method-currency").value.trim();
  const rateToUSD = parseFloat(document.getElementById("method-rate").value);
  const instructions = document.getElementById("method-instructions").value.trim();
  const qrImage = document.getElementById("method-qr").value.trim();
  const iconImage = document.getElementById("method-icon").value.trim();

  const methods = getDB("deposit_methods", []);
  const newMethod = {
    id: "method-" + Date.now(),
    name,
    account,
    currency,
    rateToUSD,
    instructions,
    qrImage,
    iconImage
  };

  methods.push(newMethod);
  setDB("deposit_methods", methods);
  alert("تمت إضافة طريقة الإيداع بنجاح!");
  document.getElementById("add-method-form").reset();
  switchAdminSection("deposit-methods");
}

// --- 11. إعدادات الموقع ونشر الإعلانات وتغيير الاسم والشعار ---
function saveSiteBranding() {
  const siteName = document.getElementById("setting-site-name").value.trim();
  const siteLogo = document.getElementById("setting-site-logo").value.trim();

  const settings = getDB("site_settings", {});
  if (siteName) settings.siteName = siteName;
  if (siteLogo) settings.siteLogo = siteLogo;

  setDB("site_settings", settings);
  renderStoreBranding();
  alert("تم حفظ اسم الموقع والشعار بنجاح!");
}

function saveAnnouncement() {
  const adText = document.getElementById("setting-ad-text").value.trim();
  const adActive = document.getElementById("setting-ad-active").checked;

  const settings = getDB("site_settings", {});
  settings.adText = adText;
  settings.adActive = adActive;

  setDB("site_settings", settings);
  renderAnnouncement();
  alert("تم تحديث ونشر الإعلان بنجاح!");
}

// نافذة طلب الإيداع للزبائن
function openDepositModal() {
  if (!currentUser) {
    alert("يرجى تسجيل الدخول أولاً لشحن رصيدك!");
    openAuthModal();
    return;
  }
  const methods = getDB("deposit_methods", []);
  if (methods.length === 0) {
    alert("لا توجد طرق إيداع مفعلة حالياً");
    return;
  }
  const method = methods[0];
  const amount = prompt(`طريقة الشحن المتاحة: ${method.name}\nالحساب: ${method.account}\n\nاكتب المبلغ المحول بـ ${method.currency}:`);
  if (!amount || isNaN(amount)) return;

  const proof = prompt("انسخ رابط صورة إشعار التحويل:") || "https://via.placeholder.com/200";

  const rate = Number(method.rateToUSD) || 1;
  const amountUSD = method.currency === "USD" || method.currency === "USDT" ? Number(amount) : (Number(amount) / rate);
  const amountSYP = method.currency === "SYP" ? Number(amount) : (amountUSD * 15000);

  const requests = getDB("deposit_requests", []);
  requests.push({
    id: "req-" + Date.now(),
    userName: currentUser.name,
    userEmail: currentUser.email,
    methodName: method.name,
    currency: method.currency,
    amountRaw: amount,
    amountUSD: amountUSD.toFixed(2),
    amountSYP: amountSYP,
    date: new Date().toISOString().split("T")[0],
    proofImage: proof,
    status: "pending"
  });

  setDB("deposit_requests", requests);
  alert("تم إرسال طلب الشحن بنجاح! سيتم مراجعته وإضافة الرصيد لحسابك قريباً.");
}
