// --- إدارة واجهة المتجر، الأقسام، المنتجات والمظهر ---

let currentSelectedCategory = null;

document.addEventListener("DOMContentLoaded", () => {
  renderStoreBranding();
  renderCategories();
  renderAnnouncement();
  setupTheme();
});

// تطبيق إعدادات اسم الموقع والشعار
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
}

// عرض شريط الإعلان العلوي
function renderAnnouncement() {
  const settings = getDB("site_settings", {});
  const bar = document.getElementById("announcement-bar");
  const textEl = document.getElementById("announcement-text");

  if (bar && settings.adActive && settings.adText) {
    textEl.innerText = settings.adText;
    bar.classList.remove("hidden");
  } else if (bar) {
    bar.classList.add("hidden");
  }
}

function closeAnnouncement() {
  const bar = document.getElementById("announcement-bar");
  if (bar) bar.classList.add("hidden");
}

// عرض الأقسام في المتجر
function renderCategories(filterText = "") {
  const container = document.getElementById("categories-container");
  if (!container) return;

  const categories = getDB("categories", []);
  container.innerHTML = "";

  const filtered = categories.filter(c => 
    c.name.toLowerCase().includes(filterText.toLowerCase())
  );

  if (filtered.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">لا توجد أقسام متوفرة حالياً</div>`;
    return;
  }

  filtered.forEach(cat => {
    const card = document.createElement("div");
    card.className = "cat-card";
    card.onclick = () => openCategoryProducts(cat.id);
    card.innerHTML = `
      <img src="${cat.image || 'https://via.placeholder.com/60'}" alt="${cat.name}">
      <h4>${cat.name}</h4>
      <span>${cat.desc || 'خدمات فورية'}</span>
    `;
    container.appendChild(card);
  });
}

function filterCategories() {
  const query = document.getElementById("category-search").value;
  renderCategories(query);
}

// فتح المنتجات التابعة للقسم المختار
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
function renderProducts(filterText = "") {
  const container = document.getElementById("products-container");
  if (!container) return;

  const products = getDB("products", []);
  container.innerHTML = "";

  let list = products.filter(p => p.categoryId === currentSelectedCategory);
  if (filterText) {
    list = list.filter(p => p.name.toLowerCase().includes(filterText.toLowerCase()));
  }

  if (list.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">لا توجد خدمات متاحة في هذا القسم حالياً</div>`;
    return;
  }

  list.forEach(prod => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <img src="${prod.image || 'https://via.placeholder.com/150'}" alt="${prod.name}">
      <div class="prod-info">
        <h4>${prod.name}</h4>
        <p>${prod.desc || 'تسليم فوري ومضمون'}</p>
        <div class="prod-footer">
          <div class="price-tag">
            <span class="price-usd">$${Number(prod.priceUSD).toFixed(2)}</span>
            <span class="price-syp">${Number(prod.priceSYP).toLocaleString()} ل.س</span>
          </div>
          <button class="btn-buy" onclick="handleBuyProduct('${prod.id}')">شراء</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function filterProducts() {
  const query = document.getElementById("product-search").value;
  renderProducts(query);
}

// عملية شراء المنتج والخصم من الرصيد
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
    alert("رصيدك الحالي غير كافٍ لإتمام عملية الشراء. يرجى شحن الرصيد أولاً.");
    openDepositModal();
    return;
  }

  const confirmBuy = confirm(`هل تؤكد شراء: ${prod.name} بقيمة $${prod.priceUSD}؟`);
  if (!confirmBuy) return;

  // خصم الرصيد
  currentUser.balanceUSD = Number((currentUser.balanceUSD - prod.priceUSD).toFixed(2));
  if (currentUser.balanceSYP >= prod.priceSYP) {
    currentUser.balanceSYP -= prod.priceSYP;
  } else {
    currentUser.balanceSYP = 0;
  }

  currentUser.ordersCount = (currentUser.ordersCount || 0) + 1;
  currentUser.successPurchases = (currentUser.successPurchases || 0) + 1;

  // تحديث قاعدة المستخدمين
  const users = getDB("users", []);
  const index = users.findIndex(u => u.id === currentUser.id);
  if (index !== -1) {
    users[index] = currentUser;
    setDB("users", users);
  }

  localStorage.setItem("mk_session", JSON.stringify(currentUser));
  applyUserSession();
  alert("تم إتمام الطلب بنجاح!");
}

// التحكم في القائمة الجانبية (Sidebar Drawer)
function toggleSidebar() {
  const drawer = document.getElementById("sidebar-drawer");
  if (drawer) drawer.classList.toggle("open");
}

function showStore() {
  closeAdminPanel();
  backToCategories();
}

// تبديل المظهر (Dark / Light)
function toggleTheme() {
  const isLight = document.body.classList.toggle("theme-light");
  document.body.classList.toggle("theme-dark", !isLight);
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
    document.body.classList.remove("theme-dark");
    const icon = document.getElementById("theme-icon");
    if (icon) icon.className = "fa-solid fa-sun";
  }
}
