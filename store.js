// --- إدارة واجهة المتجر بنمط Shawy Card والأقسام الثلاثية ---

let currentSelectedCategory = null;

document.addEventListener("DOMContentLoaded", () => {
  renderStoreBranding();
  renderCategories();
  setupTheme();
});

// تطبيق إعدادات اسم الموقع والشعار والرصيد
function renderStoreBranding() {
  const settings = getDB("site_settings", {
    siteName: "Mohannad kard",
    siteLogo: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=100&q=80"
  });

  const titleEl = document.getElementById("site-title");
  const logoEl = document.getElementById("site-logo");

  if (titleEl) titleEl.innerText = settings.siteName || "Mohannad kard";
  if (logoEl && settings.siteLogo) logoEl.src = settings.siteLogo;
  document.title = settings.siteName || "Mohannad kard";

  if (currentUser) {
    applyUserSession();
  }
}

// عرض الأقسام في المتجر بنمط 3 أعمدة (Shawy Style)
function renderCategories(filterText = "") {
  const container = document.getElementById("categories-container");
  if (!container) return;

  const categories = getDB("categories", []);
  container.innerHTML = "";

  const filtered = categories.filter(c => 
    c.name.toLowerCase().includes(filterText.toLowerCase())
  );

  if (filtered.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">لا توجد أقسام متوفرة</div>`;
    return;
  }

  filtered.forEach(cat => {
    const item = document.createElement("div");
    item.className = "cat-app-item";
    item.onclick = () => openCategoryProducts(cat.id);
    item.innerHTML = `
      <div class="cat-app-avatar">
        <img src="${cat.image || 'https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=300&q=80'}" alt="${cat.name}">
      </div>
      <div class="cat-app-label">${cat.name}</div>
    `;
    container.appendChild(item);
  });
}

function filterCategories() {
  const query = document.getElementById("category-search").value;
  renderCategories(query);
}

// فتح منتجات القسم المختار
function openCategoryProducts(categoryId) {
  currentSelectedCategory = categoryId;
  const categories = getDB("categories", []);
  const cat = categories.find(c => c.id === categoryId);

  const categoriesGrid = document.getElementById("categories-container");
  const productsView = document.getElementById("products-view");
  const categoryTitle = document.getElementById("current-category-title");

  if (categoriesGrid) categoriesGrid.classList.add("hidden");
  if (productsView) productsView.classList.remove("hidden");
  if (categoryTitle && cat) categoryTitle.innerText = cat.name;

  renderProducts();
}

// الرجوع لشبكة الأقسام
function backToCategories() {
  currentSelectedCategory = null;
  const categoriesGrid = document.getElementById("categories-container");
  const productsView = document.getElementById("products-view");

  if (categoriesGrid) categoriesGrid.classList.remove("hidden");
  if (productsView) productsView.classList.add("hidden");
}

// عرض منتجات القسم
function renderProducts() {
  const container = document.getElementById("products-container");
  if (!container) return;

  const products = getDB("products", []);
  container.innerHTML = "";

  const list = products.filter(p => p.categoryId === currentSelectedCategory);

  if (list.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">لا توجد خدمات في هذا القسم حالياً</div>`;
    return;
  }

  list.forEach(prod => {
    const card = document.createElement("div");
    card.className = "prod-item-card";
    card.innerHTML = `
      <img src="${prod.image || 'https://via.placeholder.com/150'}" alt="${prod.name}">
      <h4>${prod.name}</h4>
      <p>${prod.desc || 'تسليم فوري'}</p>
      <div class="prod-item-footer">
        <div class="price-box">
          <span class="p-usd">$${Number(prod.priceUSD).toFixed(2)}</span>
          <span class="p-syp">${Number(prod.priceSYP).toLocaleString()} ل.س</span>
        </div>
        <button class="btn-buy-app" onclick="handleBuyProduct('${prod.id}')">شراء</button>
      </div>
    `;
    container.appendChild(card);
  });
}

// شراء منتج
function handleBuyProduct(productId) {
  if (!currentUser) {
    alert("يرجى تسجيل الدخول أولاً لتتمكن من الشراء");
    openAuthModal();
    return;
  }

  const products = getDB("products", []);
  const prod = products.find(p => p.id === productId);
  if (!prod) return;

  if (currentUser.balanceUSD < prod.priceUSD) {
    alert("رصيدك الحالي غير كافٍ لإتمام العملية. يرجى شحن الرصيد.");
    openDepositModal();
    return;
  }

  if (!confirm(`تأكيد شراء: ${prod.name} بقيمة $${prod.priceUSD}؟`)) return;

  currentUser.balanceUSD = Number((currentUser.balanceUSD - prod.priceUSD).toFixed(2));
  if (currentUser.balanceSYP >= prod.priceSYP) {
    currentUser.balanceSYP -= prod.priceSYP;
  } else {
    currentUser.balanceSYP = 0;
  }

  currentUser.ordersCount = (currentUser.ordersCount || 0) + 1;
  currentUser.successPurchases = (currentUser.successPurchases || 0) + 1;

  const users = getDB("users", []);
  const idx = users.findIndex(u => u.id === currentUser.id);
  if (idx !== -1) {
    users[idx] = currentUser;
    setDB("users", users);
  }

  localStorage.setItem("mk_session", JSON.stringify(currentUser));
  applyUserSession();
  alert("تم تنفيذ طلبك بنجاح!");
}

// فتح وإغلاق القائمة الجانبية (Drawer)
function toggleSidebar() {
  const drawer = document.getElementById("sidebar-drawer");
  const backdrop = document.getElementById("drawer-backdrop");
  if (drawer) drawer.classList.toggle("open");
  if (backdrop) backdrop.classList.toggle("hidden");
}

function showStore() {
  closeAdminPanel();
  backToCategories();
}

// تبديل المظهر
function toggleTheme() {
  const isLight = document.body.classList.toggle("theme-light");
  const icon = document.getElementById("theme-icon");
  if (icon) {
    icon.className = isLight ? "fa-solid fa-sun" : "fa-solid fa-moon";
  }
  localStorage.setItem("mk_theme", isLight ? "light" : "dark");
}

function setupTheme() {
  const saved = localStorage.getItem("mk_theme");
  if (saved === "light") {
    document.body.classList.add("theme-light");
    const icon = document.getElementById("theme-icon");
    if (icon) icon.className = "fa-solid fa-sun";
  }
}
