let currentParentCategory = null;

function openCategory(catId, catName, catImage, parentInfo = null) {
  const users = getDB("users", []);
  const hasValidUser = Array.isArray(users) && users.length > 0 && users[0].name && users[0].name !== "زائر";
  
  if (!hasValidUser) {
    if (typeof openAuthModal === "function") openAuthModal();
    return;
  }

  if (users[0] && users[0].isBanned) {
    alert("🚫 عذراً، تم حظر حسابك من قبل إدارة المتجر.");
    return;
  }

  currentParentCategory = parentInfo;

  document.getElementById("categories-container").classList.add("hidden");
  const searchBox = document.querySelector(".search-pill-box");
  if (searchBox) searchBox.classList.add("hidden");

  const prodView = document.getElementById("products-view");
  if (prodView) prodView.classList.remove("hidden");

  const titleEl = document.getElementById("current-category-title");
  if (titleEl) titleEl.innerText = catName;

  const container = document.getElementById("products-container");
  if (!container) return;

  const fallbackImg = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80";
  const defaultImg = (catImage && catImage.trim().length > 10) ? catImage : fallbackImg;

  // 1. التحقق أولاً من وجود أقسام فرعية (مثل PUBG، Free Fire، MTN، Syriatel)
  const allCategories = getDB("categories", initialCategories);
  const subCategories = Array.isArray(allCategories) ? allCategories.filter(c => c.parentId === catId) : [];

  if (subCategories.length > 0) {
    const categoryOffers = getDB("category_profit_percents", {});
    const globalPercent = Number(getDB("global_profit_percent", 0));

    container.className = "categories-app-grid";
    container.innerHTML = subCategories.map(sub => {
      const subImg = (sub.image && sub.image.trim().length > 10) ? sub.image : fallbackImg;
      const hasOffer = categoryOffers[sub.id] !== undefined && categoryOffers[sub.id] !== "" && Number(categoryOffers[sub.id]) < globalPercent;
      const offerBadge = hasOffer
        ? `<span style="position:absolute; top:-4px; left:6px; background:#ef4444; color:#fff; font-size:0.65rem; font-weight:900; padding:2px 7px; border-radius:10px; z-index:2; box-shadow:0 2px 6px rgba(239,68,68,0.5);">عرض 🔥</span>`
        : "";

      return `
        <div class="cat-app-item" style="position:relative;" onclick="openCategory('${sub.id}', '${sub.name.replace(/'/g, "\\'")}', '${subImg.replace(/'/g, "\\'")}', { id: '${catId}', name: '${catName.replace(/'/g, "\\'")}', image: '${defaultImg.replace(/'/g, "\\'")}' })">
          ${offerBadge}
          <div class="cat-app-avatar">
            <img src="${subImg}" alt="${sub.name}" onerror="this.src='${fallbackImg}'">
          </div>
          <span class="cat-app-label">${sub.name}</span>
        </div>
      `;
    }).join("");
    return;
  }

  // 2. إذا لم يكن هناك أقسام فرعية، عرض نموذج اختيار الباقات والشحن
  const products = getDB("products", initialProducts);
  const catProducts = Array.isArray(products) ? products.filter(p => p.categoryId === catId) : [];

  if (catProducts.length === 0) {
    container.className = "products-compact-grid";
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding: 30px;">
        <p style="color:var(--text-muted); margin-bottom: 12px;">لا توجد باقات مضافة في هذا القسم حالياً.</p>
        <button class="btn-back-pill" onclick="backToCategories()">الرجوع</button>
      </div>
    `;
    return;
  }

  let packageOptions = `<option value="" disabled selected>اختر الباقة</option>`;
  catProducts.forEach(prod => {
    const finalUSD = calculateProductFinalPrice(prod);
    const offerInfo = getProductAppliedOfferInfo(prod);
    const formattedPrice = formatStoreAmount(finalUSD);
    const offerTag = offerInfo.isSpecialOffer ? " 🔥 عرض خاص" : "";

    packageOptions += `<option value="${prod.id}" data-price="${finalUSD}">
      ${prod.name} &nbsp;&nbsp; (${formattedPrice})${offerTag}
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
        <strong id="srv-price-display" style="color: var(--accent-cyan); font-size: 1.1rem;">${formatStoreAmount(0)}</strong>
      </div>

      <button type="submit" class="btn-confirm-order">
        <i class="fa-solid fa-paper-plane"></i> تأكيد الطلب والشحن الفوري
      </button>
    </form>
  `;
}

function backToCategories() {
  if (currentParentCategory) {
    const parent = currentParentCategory;
    currentParentCategory = null;
    openCategory(parent.id, parent.name, parent.image, null);
    return;
  }

  const prodView = document.getElementById("products-view");
  const catGrid = document.getElementById("categories-container");
  const searchBox = document.querySelector(".search-pill-box");

  if (prodView) prodView.classList.add("hidden");
  if (catGrid) catGrid.classList.remove("hidden");
  if (searchBox) searchBox.classList.remove("hidden");
}
