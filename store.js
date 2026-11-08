// --- منطق المتجر وعرض المنتجات وتحديث هوية المستخدم وسلايدر الإعلانات ---

let bannerInterval = null;

document.addEventListener("DOMContentLoaded", () => {
  loadSiteSettings();
  renderCategories();
  updateUserUI();
});

// تحميل هوية واسم ولوجو وإعلانات الموقع
function loadSiteSettings() {
  const defaultBanners = [
    "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80"
  ];

  const settings = getDB("site_settings", {
    name: "Mohannad kard",
    logo: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=100&q=80",
    banners: defaultBanners
  });

  const logoEl = document.getElementById("site-logo");
  const titleEl = document.getElementById("site-title");

  if (logoEl && settings.logo) logoEl.src = settings.logo;
  if (titleEl && settings.name) titleEl.innerText = settings.name;

  // تشغيل سلايدر الإعلانات المتعددة
  initBannerSlider(settings.banners || defaultBanners);
}

// سلايدر الإعلانات التلقائي
function initBannerSlider(banners) {
  const bannerCard = document.querySelector(".banner-card");
  if (!bannerCard || !banners || banners.length === 0) return;

  let currentIndex = 0;
  const imgEl = bannerCard.querySelector("img");
  const dotsContainer = bannerCard.querySelector(".banner-dots");

  if (dotsContainer) {
    dotsContainer.innerHTML = banners.map((_, i) => 
      `<span class="b-dot ${i === 0 ? 'active' : ''}"></span>`
    ).join("");
  }

  function showSlide(index) {
    currentIndex = index;
    if (imgEl) imgEl.src = banners[currentIndex];
    const dots = bannerCard.querySelectorAll(".b-dot");
    dots.forEach((dot, i) => {
      dot.classList.toggle("active", i === currentIndex);
    });
  }

  showSlide(0);

  if (bannerInterval) clearInterval(bannerInterval);
  if (banners.length > 1) {
    bannerInterval = setInterval(() => {
      currentIndex = (currentIndex + 1) % banners.length;
      showSlide(currentIndex);
    }, 3500); // الانتقال كل 3.5 ثانية
  }
}

// تغيير الصورة الشخصية للمستخدم بالنقر المباشر
function promptChangeUserAvatar() {
  const newUrl = prompt("ضع رابط صورتك الشخصية الجديدة (من Postimages أو أي رابط مباشر):");
  if (!newUrl || !newUrl.trim()) return;

  const users = getDB("users", []);
  if (users.length === 0) {
    users.push({
      id: "u_1",
      name: "Mohannad",
      avatar: newUrl.trim(),
      balanceUSD: 1415.613,
      role: "الأسطورة",
      ordersCount: 0
    });
  } else {
    users[0].avatar = newUrl.trim();
  }

  setDB("users", users);
  updateUserUI();
  alert("تم تغيير صورتك الشخصية بنجاح!");
}

// 1. عرض الأقسام الرئيسية
function renderCategories(filterText = "") {
  const container = document.getElementById("categories-container");
  if (!container) return;

  const categories = getDB("categories", []);
  const mainCategories = categories.filter(c => !c.parentId);

  const filtered = mainCategories.filter(c => 
    c.name.toLowerCase().includes(filterText.toLowerCase())
  );

  container.innerHTML = "";

  if (filtered.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color: var(--text-muted); padding: 20px;">لا توجد أقسام متوفرة</p>`;
    return;
  }

  filtered.forEach(cat => {
    const item = document.createElement("div");
    item.className = "cat-app-item";
    item.onclick = () => openCategory(cat.id, cat.name, cat.image);

    const defaultImg = "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?w=300";
    const imgSrc = cat.image || defaultImg;

    item.innerHTML = `
      <div class="cat-app-avatar">
        <img src="${imgSrc}" alt="${cat.name}" onerror="this.src='${defaultImg}'">
      </div>
      <span class="cat-app-label">${cat.name}</span>
    `;
    container.appendChild(item);
  });
}

function filterCategories() {
  const input = document.getElementById("category-search");
  if (input) {
    renderCategories(input.value.trim());
  }
}

// 2. فتح القسم ونظام واجهة الطلب (Shawy Card Service Order)
function openCategory(catId, catName, catImage) {
  document.getElementById("categories-container").classList.add("hidden");
  const searchBox = document.querySelector(".search-pill-box");
  if (searchBox) searchBox.classList.add("hidden");

  const prodView = document.getElementById("products-view");
  prodView.classList.remove("hidden");

  const titleEl = document.getElementById("current-category-title");
  if (titleEl) titleEl.innerText = catName;

  const products = getDB("products", []);
  const catProducts = products.filter(p => p.categoryId === catId);
  const container = document.getElementById("products-container");

  const defaultImg = catImage || "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?w=300";

  if (catProducts.length === 0) {
    container.className = "products-compact-grid";
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding: 30px;">
        <p style="color:var(--text-muted); margin-bottom: 12px;">لا توجد باقات مضافة في هذا القسم حالياً.</p>
        <button class="btn-back-pill" onclick="backToCategories()">الرجوع للأقسام</button>
      </div>
    `;
    return;
  }

  let packageOptions = `<option value="" disabled selected>اختر اختر_الباقة</option>`;
  catProducts.forEach(prod => {
    packageOptions += `<option value="${prod.id}" data-price="${prod.priceUSD}">
      ${prod.name} &nbsp;&nbsp;&nbsp;&nbsp; (${prod.priceUSD} $)
    </option>`;
  });

  container.className = "service-order-wrapper";
  container.innerHTML = `
    <div class="service-top-card">
      <div class="service-logo-box">
        <img src="${defaultImg}" alt="${catName}" onerror="this.src='https://images.unsplash.com/photo-1614680376593-902f749f7ffc?w=300'">
      </div>
      <h2 class="service-title-text">${catName}</h2>
    </div>

    <form class="service-order-form" onsubmit="handleServiceOrder(event, '${catId}', '${catName}')">
      <div class="field-block">
        <label class="field-label">رقم_الهاتف_09</label>
        <input type="tel" id="srv-target-input" class="field-input" placeholder="أدخل رقم_الهاتف_09" required dir="ltr">
      </div>

      <div class="field-block">
        <label class="field-label">اختر_الباقة</label>
        <div class="select-dropdown-box">
          <select id="srv-package-select" class="field-select" required onchange="onPackageSelectChange()">
            ${packageOptions}
          </select>
        </div>
      </div>

      <div class="order-summary-bar">
        <span>السعر المطلوب:</span>
        <strong id="srv-price-display" style="color: var(--accent-cyan); font-size: 1.1rem;">0.00 $</strong>
      </div>

      <button type="submit" class="btn-confirm-order">
        <i class="fa-solid fa-paper-plane"></i> تأكيد الطلب والشحن الفوري
      </button>
    </form>
  `;
}

function onPackageSelectChange() {
  const select = document.getElementById("srv-package-select");
  const display = document.getElementById("srv-price-display");
  const selectedOpt = select.options[select.selectedIndex];
  if (selectedOpt && selectedOpt.dataset.price) {
    display.innerText = `${selectedOpt.dataset.price} $`;
  } else {
    display.innerText = `0.00 $`;
  }
}

function handleServiceOrder(e, catId, catName) {
  e.preventDefault();

  const targetInput = document.getElementById("srv-target-input").value.trim();
  const select = document.getElementById("srv-package-select");
  const prodId = select.value;

  if (!prodId) {
    alert("يرجى اختيار الباقة أولاً");
    return;
  }

  const products = getDB("products", []);
  const product = products.find(p => p.id === prodId);
  if (!product) return;

  const users = getDB("users", []);
  const currentUser = users[0] || { name: "Mohannad", balanceUSD: 1415.613, ordersCount: 0 };

  const price = Number(product.priceUSD);
  if ((currentUser.balanceUSD || 0) < price) {
    alert(`عذراً، رصيدك الحالي ($${currentUser.balanceUSD}) لا يكفي لشراء هذه الباقة ($${price})! يرجى شحن رصيدك.`);
    return;
  }

  currentUser.balanceUSD = Number((currentUser.balanceUSD - price).toFixed(3));
  currentUser.ordersCount = (currentUser.ordersCount || 0) + 1;
  setDB("users", users);

  const orders = getDB("orders", []);
  orders.unshift({
    id: "ord_" + Date.now(),
    categoryName: catName,
    packageName: product.name,
    target: targetInput,
    price: price,
    date: new Date().toLocaleString("ar-SY"),
    status: "مكتمل"
  });
  setDB("orders", orders);

  updateUserUI();
  alert(`✅ تم تنفيذ طلب الشحن بنجاح!\nالرقم: ${targetInput}\nالباقة: ${product.name}\nالمبلغ المخصوم: ${price} $`);
  backToCategories();
}

function backToCategories() {
  document.getElementById("products-view").classList.add("hidden");
  document.getElementById("categories-container").classList.remove("hidden");
  const searchBox = document.querySelector(".search-pill-box");
  if (searchBox) searchBox.classList.remove("hidden");
}

function updateUserUI() {
  const users = getDB("users", []);
  const user = users[0] || { name: "Mohannad", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80", balanceUSD: 1415.613, role: "الأسطورة" };

  const headerBal = document.getElementById("header-balance-usd");
  const drawerBal = document.getElementById("drawer-balance-text");
  const sideName = document.getElementById("side-user-name");
  const drawerAvatar = document.getElementById("drawer-avatar");

  if (headerBal) headerBal.innerText = `${Number(user.balanceUSD || 0).toFixed(3)} $`;
  if (drawerBal) drawerBal.innerText = `${Number(user.balanceUSD || 0).toFixed(3)} $`;
  if (sideName) sideName.innerText = user.name || "Mohannad";
  if (drawerAvatar && user.avatar) drawerAvatar.src = user.avatar;
}

function showStore() {
  backToCategories();
  toggleSidebar(false);
}

function toggleSidebar(force) {
  const drawer = document.getElementById("sidebar-drawer");
  const backdrop = document.getElementById("drawer-backdrop");
  if (!drawer || !backdrop) return;

  const isOpen = (typeof force === "boolean") ? !force : drawer.classList.contains("open");
  if (isOpen) {
    drawer.classList.remove("open");
    backdrop.classList.add("hidden");
  } else {
    drawer.classList.add("open");
    backdrop.classList.remove("hidden");
  }
}

function openDepositModal() {
  alert("لإيداع الرصيد، يرجى التواصل مع الإدارة عبر زر الواتساب أو التلغرام في القائمة الجانبية.");
}

function openAuthModal() {
  const modal = document.getElementById("auth-modal");
  if (modal) modal.classList.remove("hidden");
}

function closeAuthModal() {
  const modal = document.getElementById("auth-modal");
  if (modal) modal.classList.add("hidden");
}

function logoutUser() {
  alert("تم تسجيل الخروج");
}

function toggleTheme() {
  document.body.classList.toggle("light-mode");
}
