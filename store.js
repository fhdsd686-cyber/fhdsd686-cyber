// --- منطق المتجر، الميزات التفاعلية، محول العملات اللحظي، وصلاحيات الإدارة والحظر ---

let bannerInterval = null;
let currentDepositCurrency = "USD";
let activeDepositMethod = null;
let depositReceiptBase64 = "";

document.addEventListener("DOMContentLoaded", () => {
  loadSiteSettings();
  renderCategories();
  updateUserUI();
  initSavedTheme();

  if (typeof checkMaintenanceGate === "function") {
    checkMaintenanceGate();
  }

  if (typeof checkAuthGate === "function") {
    checkAuthGate();
  }
});

// استعادة وضع المظهر المحفوظ (مظلم / نهاري)
function initSavedTheme() {
  const savedTheme = getDB("site_theme", "dark");
  const icon = document.getElementById("theme-icon");
  const label = document.getElementById("theme-status-label");

  if (savedTheme === "light") {
    document.body.classList.remove("dark-drawer");
    document.body.classList.add("light-mode");
    if (icon) { icon.className = "fa-solid fa-sun"; icon.style.color = "#f59e0b"; }
    if (label) label.innerText = "الوضع المظلم: معطل (نهاري)";
  } else {
    document.body.classList.add("dark-drawer");
    document.body.classList.remove("light-mode");
    if (icon) { icon.className = "fa-solid fa-moon"; icon.style.color = "#38bdf8"; }
    if (label) label.innerText = "الوضع المظلم: مفعل";
  }
}

// تبديل الوضع المظلم والنهاري
function toggleTheme() {
  const isCurrentlyDark = document.body.classList.contains("dark-drawer");
  const icon = document.getElementById("theme-icon");
  const label = document.getElementById("theme-status-label");

  if (isCurrentlyDark) {
    document.body.classList.remove("dark-drawer");
    document.body.classList.add("light-mode");
    setDB("site_theme", "light");
    if (icon) { icon.className = "fa-solid fa-sun"; icon.style.color = "#f59e0b"; }
    if (label) label.innerText = "الوضع المظلم: معطل (نهاري)";
  } else {
    document.body.classList.add("dark-drawer");
    document.body.classList.remove("light-mode");
    setDB("site_theme", "dark");
    if (icon) { icon.className = "fa-solid fa-moon"; icon.style.color = "#38bdf8"; }
    if (label) label.innerText = "الوضع المظلم: مفعل";
  }
}

// --- فتح نوافذ الميزات التفاعلية (المستويات، الحماية، الجلسات، مفضلتي، الإشعارات، الطلبات) ---
function openFeatureModal(type) {
  toggleSidebar(false);

  const modal = document.getElementById("feature-modal");
  const titleEl = document.getElementById("feature-modal-title");
  const iconEl = document.getElementById("feature-modal-icon");
  const bodyEl = document.getElementById("feature-modal-body");
  if (!modal || !titleEl || !iconEl || !bodyEl) return;

  const users = getDB("users", []);
  const currentUser = (Array.isArray(users) && users.length > 0 && users[0].name !== "زائر") ? users[0] : null;

  if (type === "levels") {
    iconEl.className = "fa-solid fa-crown";
    iconEl.style.color = "#f59e0b";
    titleEl.innerText = "نظام المستويات والعضويات";
    const currentRank = currentUser ? (currentUser.role || "عضو") : "زائر";

    const levels = [
      { name: "عضو", desc: "الحساب الأساسي لجميع المستخدمين الجدد.", badge: "#64748b" },
      { name: "VIP 1", desc: "أولوية في معالجة الطلبات وتنفيذ أسرع.", badge: "#0284c7" },
      { name: "VIP 4", desc: "خصومات خاصة على البطاقات والباقات + دعم مباشر.", badge: "#8b5cf6" },
      { name: "الأسطورة", desc: "أعلى مستوى في المتجر مع كامل الصلاحيات وأفضل الأسعار.", badge: "#f59e0b" }
    ];

    bodyEl.innerHTML = `
      <div style="background:#050b18; border:1px solid rgba(56,189,248,0.25); padding:12px; border-radius:14px; margin-bottom:12px; text-align:center;">
        مستواك الحالي: <strong style="color:#38bdf8; font-size:1.05rem;">${currentRank}</strong>
      </div>
      ${levels.map(l => `
        <div style="background:#0f172a; border:1px solid ${currentRank === l.name ? '#38bdf8' : 'rgba(255,255,255,0.08)'}; padding:12px; border-radius:14px; margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <strong style="color:#fff;">${l.name}</strong>
            <span style="background:${l.badge}; color:#fff; font-size:0.72rem; padding:2px 10px; border-radius:20px;">
              ${currentRank === l.name ? 'مستواك الحالي ✓' : 'متاح'}
            </span>
          </div>
          <p style="font-size:0.8rem; color:#94a3b8; margin:0;">${l.desc}</p>
        </div>
      `).join("")}
    `;
  }

  else if (type === "security") {
    if (!currentUser) {
      if (typeof openAuthModal === "function") openAuthModal();
      return;
    }
    iconEl.className = "fa-solid fa-shield-halved";
    iconEl.style.color = "#10b981";
    titleEl.innerText = "إعدادات الأمان والحماية";

    bodyEl.innerHTML = `
      <div style="background:#050b18; border:1px solid rgba(16,185,129,0.3); padding:12px; border-radius:14px; margin-bottom:14px; font-size:0.85rem;">
        <div style="color:#10b981; font-weight:800; margin-bottom:4px;"><i class="fa-solid fa-circle-check"></i> حسابك محمي ومؤمّن</div>
        <div style="color:#94a3b8;">البريد المرتبط: <strong style="color:#fff;" dir="ltr">${currentUser.email || "غير مرتبط"}</strong></div>
      </div>

      <form onsubmit="handleQuickPasswordChange(event)">
        <div class="deposit-input-group">
          <label class="deposit-label">تعيين كلمة مرور جديدة للحساب:</label>
          <input type="password" id="sec-new-password" class="deposit-field" placeholder="أدخل كلمة المرور الجديدة (6 أحرف على الأقل)" required minlength="6">
        </div>
        <button type="submit" class="btn-send-deposit" style="background:#10b981;">
          <i class="fa-solid fa-key"></i> تحديث كلمة المرور
        </button>
      </form>
    `;
  }

  else if (type === "sessions") {
    iconEl.className = "fa-solid fa-mobile-screen";
    iconEl.style.color = "#38bdf8";
    titleEl.innerText = "الجلسات النشطة";

    const deviceInfo = navigator.userAgent.includes("Android") ? "هاتف Android" :
                       navigator.userAgent.includes("iPhone") ? "هاتف iPhone" : "متصفح ويب";
    const nowTime = new Date().toLocaleString("ar-SY");

    bodyEl.innerHTML = `
      <div style="background:#0f172a; border:1px solid #38bdf8; padding:14px; border-radius:14px; margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <strong style="color:#fff;"><i class="fa-solid fa-mobile-screen-button" style="color:#38bdf8;"></i> ${deviceInfo} (الجلسة الحالية)</strong>
          <span style="background:#10b981; color:#fff; font-size:0.7rem; padding:2px 8px; border-radius:20px;">نشط الآن</span>
        </div>
        <div style="font-size:0.78rem; color:#94a3b8;">آخر نشاط: ${nowTime}</div>
      </div>
      <button type="button" onclick="closeFeatureModal(); logoutUser();" class="btn-send-deposit" style="background:#ef4444;">
        <i class="fa-solid fa-right-from-bracket"></i> إنهاء الجلسة وتسجيل الخروج
      </button>
    `;
  }

  else if (type === "favorites") {
    iconEl.className = "fa-solid fa-heart";
    iconEl.style.color = "#ef4444";
    titleEl.innerText = "الأقسام المفضلة";

    const categories = getDB("categories", initialCategories);
    const favIds = getDB("user_favorites", ["cat_syriatel", "cat_mtn", "cat_superlive"]);
    const favCats = categories.filter(c => favIds.includes(c.id));

    if (favCats.length === 0) {
      bodyEl.innerHTML = `<p style="text-align:center; color:#94a3b8; padding:20px;">لا توجد عناصر في المفضلة حالياً.</p>`;
    } else {
      bodyEl.innerHTML = favCats.map(c => `
        <div style="background:#0f172a; border:1px solid rgba(255,255,255,0.08); padding:10px 12px; border-radius:14px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:10px;">
            <img src="${c.image}" style="width:38px; height:38px; border-radius:10px; object-fit:cover;">
            <strong style="font-size:0.88rem; color:#fff;">${c.name}</strong>
          </div>
          <button onclick="closeFeatureModal(); openCategory('${c.id}', '${c.name}', '${c.image}')" style="background:#0284c7; border:none; color:#fff; padding:6px 12px; border-radius:8px; font-size:0.78rem; font-weight:bold; cursor:pointer;">
            فتح
          </button>
        </div>
      `).join("");
    }
  }

  else if (type === "notifications") {
    iconEl.className = "fa-solid fa-bell";
    iconEl.style.color = "#f59e0b";
    titleEl.innerText = "الإشعارات والتنبيهات";

    const deposits = getDB("deposit_requests", []);
    const userDeposits = currentUser ? deposits.filter(d => d.userName === currentUser.name) : [];

    let html = `
      <div style="background:#0f172a; border-right:3px solid #38bdf8; padding:12px; border-radius:12px; margin-bottom:10px;">
        <div style="font-weight:800; font-size:0.88rem; color:#fff;">أهلاً بك في متجر Mohannad kard 🇸🇾</div>
        <div style="font-size:0.78rem; color:#94a3b8; margin-top:4px;">يمكنك شحن رصيدك فوراً عبر شام كاش والباركود والاستمتاع بالشحن السريع.</div>
      </div>
    `;

    userDeposits.forEach(d => {
      const color = d.status === "مقبول" ? "#10b981" : (d.status === "مرفوض" ? "#ef4444" : "#f59e0b");
      html += `
        <div style="background:#0f172a; border-right:3px solid ${color}; padding:12px; border-radius:12px; margin-bottom:10px;">
          <div style="font-weight:800; font-size:0.85rem; color:#fff;">طلب إيداع بقيمة $${d.amountUSD} (${d.methodName || "شام كاش"})</div>
          <div style="font-size:0.78rem; color:${color}; font-weight:bold; margin-top:4px;">الحالة: ${d.status} • <span style="color:#94a3b8; font-weight:normal;">${d.date}</span></div>
        </div>
      `;
    });

    bodyEl.innerHTML = html;
  }

  else if (type === "orders") {
    iconEl.className = "fa-solid fa-cart-shopping";
    iconEl.style.color = "#38bdf8";
    titleEl.innerText = "سجل طلباتي";

    const orders = getDB("orders", []);
    if (!Array.isArray(orders) || orders.length === 0) {
      bodyEl.innerHTML = `<p style="text-align:center; color:#94a3b8; padding:24px;">لم تقم بأي طلب شراء حتى الآن.</p>`;
    } else {
      bodyEl.innerHTML = orders.map(o => `
        <div style="background:#0f172a; border-right:3px solid #10b981; padding:12px; border-radius:12px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:0.88rem; color:#fff;">${o.packageName}</strong>
            <span style="color:#38bdf8; font-weight:800;">$${o.price}</span>
          </div>
          <div style="font-size:0.78rem; color:#94a3b8; margin-top:4px;">
            القسم: ${o.categoryName} | المستلم: <strong style="color:#fff;">${o.target}</strong>
          </div>
          <div style="font-size:0.74rem; color:#10b981; margin-top:4px;">الحالة: ${o.status} • ${o.date}</div>
        </div>
      `).join("");
    }
  }

  modal.classList.remove("hidden");
}

function closeFeatureModal() {
  const modal = document.getElementById("feature-modal");
  if (modal) modal.classList.add("hidden");
}

function handleQuickPasswordChange(e) {
  e.preventDefault();
  const newPass = document.getElementById("sec-new-password").value.trim();
  if (newPass.length < 6) {
    alert("يجب أن تكون كلمة المرور 6 أحرف على الأقل.");
    return;
  }
  const users = getDB("users", []);
  if (Array.isArray(users) && users.length > 0) {
    users[0].password = newPass;
    setDB("users", users);
    alert("✅ تم تحديث كلمة المرور بنجاح!");
    closeFeatureModal();
  }
}

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
  const users = getDB("users", []);
  if (Array.isArray(users) && users[0] && users[0].isBanned) {
    alert("🚫 عذراً، تم حظر حسابك من قبل إدارة المتجر.");
    return;
  }

  const newUrl = prompt("ضع رابط صورتك الشخصية الجديدة:");
  if (!newUrl || !newUrl.trim()) return;

  if (!Array.isArray(users) || users.length === 0) return;

  users[0].avatar = newUrl.trim();
  setDB("users", users);
  updateUserUI();
  alert("تم تغيير صورتك الشخصية بنجاح!");
}

// --- نظام الإيداع الديناميكي والباركود ---
function openDepositModal() {
  toggleSidebar(false);
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

  const users = getDB("users", []);
  if (Array.isArray(users) && users[0] && users[0].isBanned) {
    alert("🚫 عذراً، تم حظر حسابك من قبل إدارة المتجر.");
    return;
  }

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

  if (users[0] && users[0].isBanned) {
    alert("🚫 عذراً، تم حظر حسابك من قبل إدارة المتجر.");
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

  let users = getDB("users", []);
  if (!Array.isArray(users) || users.length === 0 || !users[0].name || users[0].name === "زائر") {
    alert("يرجى تسجيل الدخول أو إنشاء حساب لإتمام عملية الشحن.");
    if (typeof openAuthModal === "function") openAuthModal();
    return;
  }

  if (users[0] && users[0].isBanned) {
    alert("🚫 عذراً، تم حظر حسابك من قبل إدارة المتجر.");
    return;
  }

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
