// --- منطق المتجر، عرض المنتجات، محول العملات اللحظي، وصلاحيات الإدارة عبر الإيميل ---

let bannerInterval = null;
let currentDepositCurrency = "USD";
let activeDepositMethod = null;
let depositReceiptBase64 = "";

document.addEventListener("DOMContentLoaded", () => {
  loadSiteSettings();
  renderCategories();
  updateUserUI();

  if (typeof checkMaintenanceGate === "function") {
    checkMaintenanceGate();
  }

  if (typeof checkAuthGate === "function") {
    checkAuthGate();
  }
});

// دالة مساعدة للتحقق هل المستخدم الحالي هو الآدمن
function isCurrentUserAdmin(user) {
  if (!user) return false;
  return (
    user.role === "الأسطورة" ||
    user.role === "Admin" ||
    (user.email && user.email.toLowerCase() === "fhdsd686@gmail.com") ||
    (user.name && user.name.toLowerCase() === "mohannad")
  );
}

// فحص وضع الصيانة
function checkMaintenanceGate() {
  const isMaintenance = getDB("maintenance_mode", false);
  const modal = document.getElementById("maintenance-modal");
  const users = getDB("users", []);
  const currentUser = (Array.isArray(users) && users.length > 0) ? users[0] : null;

  if (isMaintenance && !isCurrentUserAdmin(currentUser)) {
    if (modal) modal.classList.remove("hidden");
  } else {
    if (modal) modal.classList.add("hidden");
  }
}

function loadSiteSettings() {
  const defaultBanners = [
    "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=600&q=80"
  ];

  const settings = getDB("site_settings", {
    name: "Mohannad kard",
    logo: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=100&q=80",
    banners: defaultBanners
  });

  const logoEl = document.getElementById("site-logo");
  const titleEl = document.getElementById("site-title");

  if (logoEl && settings && settings.logo) logoEl.src = settings.logo;
  if (titleEl && settings && settings.name) titleEl.innerText = settings.name;

  initBannerSlider((settings && settings.banners && settings.banners.length > 0) ? settings.banners : defaultBanners);
}

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
    if (imgEl && banners[currentIndex]) {
      imgEl.src = banners[currentIndex];
    }
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
    }, 3500);
  }
}

function promptChangeUserAvatar() {
  const newUrl = prompt("ضع رابط صورتك الشخصية الجديدة:");
  if (!newUrl || !newUrl.trim()) return;

  let users = getDB("users", []);
  if (!Array.isArray(users) || users.length === 0) return;

  users[0].avatar = newUrl.trim();
  setDB("users", users);
  updateUserUI();
  alert("تم تغيير صورتك الشخصية بنجاح!");
}

// --- نظام الإيداع الديناميكي والباركود ---
function openDepositModal() {
  const users = getDB("users", []);
  const hasValidUser = Array.isArray(users) && users.length > 0 && users[0].name && users[0].name !== "زائر";
  if (!hasValidUser) {
    if (typeof openAuthModal === "function") openAuthModal();
    return;
  }

  renderDepositMethodsSelector();

  const modal = document.getElementById("deposit-modal");
  if (modal) modal.classList.remove("hidden");
}

function closeDepositModal() {
  const modal = document.getElementById("deposit-modal");
  if (modal) modal.classList.add("hidden");
}

function renderDepositMethodsSelector() {
  const selector = document.getElementById("deposit-methods-selector");
  if (!selector) return;

  const methods = getDB("depositMethods", initialDepositMethods);
  if (!Array.isArray(methods) || methods.length === 0) return;

  // الحفاظ على الطريقة المختارة أو تحديد الأولى افتراضياً
  if (!activeDepositMethod || !methods.find(m => m.id === activeDepositMethod.id)) {
    activeDepositMethod = methods[0];
  }

  const defaultIcon = "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=100&q=80";

  selector.innerHTML = methods.map(m => {
    const isActive = activeDepositMethod && activeDepositMethod.id === m.id;
    const iconUrl = (m.icon && m.icon.trim().length > 5) ? m.icon : defaultIcon;
    return `
      <button type="button" class="method-pill-btn ${isActive ? 'active' : ''}" onclick="selectDepositMethod('${m.id}')">
        <img src="${iconUrl}" alt="${m.name}" style="width: 20px; height: 20px; border-radius: 6px; object-fit: cover;" onerror="this.src='${defaultIcon}'">
        <span>${m.name}</span>
      </button>
    `;
  }).join("");

  applyActiveDepositMethodUI();
}

function selectDepositMethod(methodId) {
  const methods = getDB("depositMethods", initialDepositMethods);
  const found = methods.find(m => m.id === methodId);
  if (!found) return;

  activeDepositMethod = found;
  renderDepositMethodsSelector();
}

function applyActiveDepositMethodUI() {
  if (!activeDepositMethod) return;

  const defaultIcon = "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=100&q=80";
  const logoEl = document.getElementById("deposit-active-logo");
  const nameEl = document.getElementById("deposit-active-name");
  const accountEl = document.getElementById("deposit-display-account");
  const qrEl = document.getElementById("deposit-active-qr");
  const qrWrap = document.getElementById("deposit-qr-wrapper");

  if (logoEl) {
    logoEl.src = (activeDepositMethod.icon && activeDepositMethod.icon.trim().length > 5)
      ? activeDepositMethod.icon
      : defaultIcon;
  }
  if (nameEl) nameEl.innerText = activeDepositMethod.name || "وسيلة إيداع";
  if (accountEl) accountEl.innerText = activeDepositMethod.account || "";

  // عرض صورة الباركود المخصصة أو توليدها تلقائياً من عنوان الحساب
  if (qrEl && qrWrap) {
    const qrSrc = (activeDepositMethod.qrImage && activeDepositMethod.qrImage.trim().length > 5)
      ? activeDepositMethod.qrImage.trim()
      : `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(activeDepositMethod.account || "")}`;
    qrEl.src = qrSrc;
    qrWrap.style.display = "inline-flex";
  }

  calculateDepositConversion();
}

function getActiveExchangeRate() {
  if (activeDepositMethod && Number(activeDepositMethod.rate) > 1) {
    return Number(activeDepositMethod.rate);
  }
  return 15000;
}

function copyDepositNumber() {
  const accountText = activeDepositMethod ? activeDepositMethod.account : "b7a6624b69166fb60e741400cee2b8bd";
  navigator.clipboard.writeText(accountText).then(() => {
    alert("✅ تم نسخ عنوان الحساب بنجاح:\n" + accountText);
  }).catch(() => {
    prompt("انسخ عنوان الحساب يدوياً:", accountText);
  });
}

function setDepositCurrency(curr) {
  currentDepositCurrency = curr;
  const tabUsd = document.getElementById("tab-curr-usd");
  const tabSyp = document.getElementById("tab-curr-syp");
  const label = document.getElementById("deposit-amount-label");
  const input = document.getElementById("deposit-input-val");

  if (!tabUsd || !tabSyp || !label || !input) return;

  if (curr === "USD") {
    tabUsd.classList.add("active");
    tabSyp.classList.remove("active");
    label.innerText = "المبلغ المطلوب شحنه (USD):";
    input.placeholder = "مثال: 10";
  } else {
    tabSyp.classList.add("active");
    tabUsd.classList.remove("active");
    label.innerText = "المبلغ المطلوب شحنه (ليرة سورية):";
    input.placeholder = "مثال: 150000";
  }

  calculateDepositConversion();
}

function calculateDepositConversion() {
  const inputEl = document.getElementById("deposit-input-val");
  const convertedEl = document.getElementById("deposit-converted-val");
  const rateInfoEl = document.getElementById("deposit-rate-info");
  if (!inputEl || !convertedEl || !rateInfoEl) return;

  const rate = getActiveExchangeRate();
  const inputVal = parseFloat(inputEl.value) || 0;

  if (currentDepositCurrency === "USD") {
    convertedEl.innerText = `${inputVal.toFixed(2)} $`;
    const sypEquiv = Math.round(inputVal * rate).toLocaleString("en-US");
    rateInfoEl.innerText = `(ما يعادل: ${sypEquiv} ل.س)`;
  } else {
    const usdEquiv = (inputVal / rate).toFixed(3);
    convertedEl.innerText = `${usdEquiv} $`;
    rateInfoEl.innerText = `(سعر الصرف: 1$ = ${rate.toLocaleString()} ل.س)`;
  }
}

function onDepositFileChosen(e) {
  const file = e.target.files[0];
  const textEl = document.getElementById("deposit-file-text");
  if (!file) return;

  if (textEl) textEl.innerText = file.name;

  const reader = new FileReader();
  reader.onload = function(event) {
    depositReceiptBase64 = event.target.result;
  };
  reader.readAsDataURL(file);
}

function handleDepositSubmit(e) {
  e.preventDefault();

  const inputVal = parseFloat(document.getElementById("deposit-input-val").value) || 0;
  const senderInfo = document.getElementById("deposit-sender-info").value.trim();
  const note = document.getElementById("deposit-note").value.trim();

  if (inputVal <= 0) {
    alert("يرجى إدخال مبلغ صحيح!");
    return;
  }

  const rate = getActiveExchangeRate();
  const methodName = activeDepositMethod ? activeDepositMethod.name : "شام كاش سوري";
  const amountUSD = currentDepositCurrency === "USD" ? inputVal : Number((inputVal / rate).toFixed(3));
  const amountSYP = currentDepositCurrency === "SYP" ? inputVal : Math.round(inputVal * rate);

  const users = getDB("users", []);
  const currentUser = users[0] || { name: "زائر" };

  const newDepositRequest = {
    id: "dep_" + Date.now(),
    userName: currentUser.name,
    methodName: methodName,
    amountUSD: amountUSD,
    amountSYP: amountSYP,
    currency: currentDepositCurrency,
    sender: senderInfo,
    note: note,
    receipt: depositReceiptBase64,
    date: new Date().toLocaleString("ar-SY"),
    status: "معلق"
  };

  const allRequests = getDB("deposit_requests", []);
  allRequests.unshift(newDepositRequest);
  setDB("deposit_requests", allRequests);

  const waMsg = encodeURIComponent(
    `طلب شحن رصيد جديد (${methodName}):\n` +
    `👤 المستخدم: ${currentUser.name}\n` +
    `💵 المبلغ بالدولار: ${amountUSD} $\n` +
    `🇸🇾 المبلغ بالليرة: ${amountSYP.toLocaleString()} ل.س\n` +
    `👤 اسم المرسل: ${senderInfo}\n` +
    `📝 ملاحظة: ${note || "لا يوجد"}`
  );

  alert("✅ تم إرسال طلب الشحن بنجاح!\nسيتم تحويلك إلى واتساب لإرسال صورة الإشعار وتأكيد التعبئة.");
  closeDepositModal();

  window.open(`https://wa.me/963957455972?text=${waMsg}`, "_blank");
}

function renderCategories(filterText = "") {
  const container = document.getElementById("categories-container");
  if (!container) return;

  const categories = getDB("categories", initialCategories);
  const mainCategories = Array.isArray(categories) ? categories.filter(c => !c.parentId) : [];

  const filtered = mainCategories.filter(c => 
    c.name && c.name.toLowerCase().includes((filterText || "").toLowerCase())
  );

  container.innerHTML = "";

  if (filtered.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color: var(--text-muted); padding: 20px;">لا توجد أقسام متوفرة</p>`;
    return;
  }

  const defaultImg = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80";

  filtered.forEach(cat => {
    const item = document.createElement("div");
    item.className = "cat-app-item";
    item.onclick = () => openCategory(cat.id, cat.name, cat.image);

    const imgSrc = (cat.image && cat.image.trim().length > 10) ? cat.image : defaultImg;

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

function openCategory(catId, catName, catImage) {
  const users = getDB("users", []);
  const hasValidUser = Array.isArray(users) && users.length > 0 && users[0].name && users[0].name !== "زائر";
  
  if (!hasValidUser) {
    if (typeof openAuthModal === "function") openAuthModal();
    return;
  }

  document.getElementById("categories-container").classList.add("hidden");
  const searchBox = document.querySelector(".search-pill-box");
  if (searchBox) searchBox.classList.add("hidden");

  const prodView = document.getElementById("products-view");
  if (prodView) prodView.classList.remove("hidden");

  const titleEl = document.getElementById("current-category-title");
  if (titleEl) titleEl.innerText = catName;

  const products = getDB("products", initialProducts);
  const catProducts = Array.isArray(products) ? products.filter(p => p.categoryId === catId) : [];
  const container = document.getElementById("products-container");
  if (!container) return;

  const fallbackImg = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80";
  const defaultImg = (catImage && catImage.trim().length > 10) ? catImage : fallbackImg;

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

  let packageOptions = `<option value="" disabled selected>اختر الباقة</option>`;
  catProducts.forEach(prod => {
    packageOptions += `<option value="${prod.id}" data-price="${prod.priceUSD}">
      ${prod.name} &nbsp;&nbsp;&nbsp;&nbsp; (${prod.priceUSD} $)
    </option>`;
  });

  container.className = "service-order-wrapper";
  container.innerHTML = `
    <div class="service-top-card">
      <div class="service-logo-box">
        <img src="${defaultImg}" alt="${catName}" onerror="this.src='${fallbackImg}'">
      </div>
      <h2 class="service-title-text">${catName}</h2>
    </div>

    <form class="service-order-form" onsubmit="handleServiceOrder(event, '${catId}', '${catName}')">
      <div class="field-block">
        <label class="field-label">رقم الهاتف أو المعرف</label>
        <input type="text" id="srv-target-input" class="field-input" placeholder="أدخل الرقم أو المعرف المطلوب" required dir="ltr">
      </div>

      <div class="field-block">
        <label class="field-label">اختر الباقة</label>
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
  if (!select || !display) return;
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

  const products = getDB("products", initialProducts);
  const product = products.find(p => p.id === prodId);
  if (!product) return;

  let users = getDB("users", []);
  if (!Array.isArray(users) || users.length === 0 || !users[0].name || users[0].name === "زائر") {
    alert("يرجى تسجيل الدخول أو إنشاء حساب لإتمام عملية الشحن.");
    if (typeof openAuthModal === "function") openAuthModal();
    return;
  }

  const currentUser = users[0];
  const price = Number(product.priceUSD);
  if ((currentUser.balanceUSD || 0) < price) {
    alert(`عذراً، رصيدك الحالي ($${currentUser.balanceUSD || 0}) لا يكفي لشراء هذه الباقة ($${price})! يرجى شحن رصيدك.`);
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
  const prodView = document.getElementById("products-view");
  const catGrid = document.getElementById("categories-container");
  const searchBox = document.querySelector(".search-pill-box");

  if (prodView) prodView.classList.add("hidden");
  if (catGrid) catGrid.classList.remove("hidden");
  if (searchBox) searchBox.classList.remove("hidden");
}

function updateUserUI() {
  const users = getDB("users", []);
  const hasUser = Array.isArray(users) && users.length > 0 && users[0].name && users[0].name !== "زائر";
  
  const user = hasUser ? users[0] : {
    name: "زائر",
    balanceUSD: 0,
    role: "عضو",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80"
  };

  const headerBal = document.getElementById("header-balance-usd");
  const drawerBal = document.getElementById("drawer-balance-text");
  const sideName = document.getElementById("side-user-name");
  const drawerAvatar = document.getElementById("drawer-avatar");
  const sideRank = document.getElementById("side-user-rank");
  const headerRank = document.getElementById("header-user-rank");
  const adminLink = document.getElementById("admin-panel-link");

  if (headerBal) headerBal.innerText = `${Number(user.balanceUSD || 0).toFixed(3)} $`;
  if (drawerBal) drawerBal.innerText = `${Number(user.balanceUSD || 0).toFixed(3)} $`;
  if (sideName) sideName.innerText = user.fullname || user.name || "زائر";
  if (sideRank) sideRank.innerText = user.role || "عضو";
  if (headerRank) headerRank.innerText = user.role || "عضو";
  if (drawerAvatar) drawerAvatar.src = user.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80";

  if (adminLink) {
    if (isCurrentUserAdmin(user)) {
      adminLink.style.display = "flex";
    } else {
      adminLink.style.display = "none";
    }
  }
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

function toggleTheme() {
  document.body.classList.toggle("light-mode");
}
