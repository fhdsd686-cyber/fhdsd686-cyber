// --- منطق المتجر، الإشعارات الفورية، التسعير التلقائي، المزامنة مع المورد، ومواصفات الطلب ---

let bannerInterval = null;
let currentDepositCurrency = "USD";
let activeDepositMethod = null;
let depositReceiptBase64 = "";
let displayCurrency = getDB("display_currency", "USD");
const STORE_EXCHANGE_RATE = 15000;
let currentParentCategory = null;

const SUPPLIER_WORKER_URL = "https://rapid-dew-4b71.fhdsd686.workers.dev/";
const SHAMS_ORDER_ENDPOINT = "https://api.shams4store.com/client/api/newOrder";
const SHAMS_CHECK_ORDERS_ENDPOINT = "https://api.shams4store.com/client/api/check";
const SHAMS_DEFAULT_TOKEN = "fd7769b4023103836b0ae5fcbc13f9df6f5ac6a7c519a427";

document.addEventListener("DOMContentLoaded", () => {
  loadSiteSettings();
  renderCategories();
  updateUserUI();
  initSavedTheme();
  requestBrowserNotificationPermission();
  checkIncomingNotifications();
  setInterval(checkIncomingNotifications, 4000);
  if (typeof checkMaintenanceGate === "function") checkMaintenanceGate();
  if (typeof checkAuthGate === "function") checkAuthGate();
});

function requestBrowserNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

function checkIncomingNotifications() {
  const users = getDB("users", []);
  const currentUser = (Array.isArray(users) && users.length > 0 && users[0].name !== "زائر") ? users[0] : null;
  if (!currentUser) return;

  const notifications = getDB("user_notifications", []);
  const myUnread = notifications.filter(n => n.userName === currentUser.name && !n.read);
  updateBellBadge(myUnread.length);

  const unshown = myUnread.find(n => !n.toastShown);
  if (unshown) {
    unshown.toastShown = true;
    setDB("user_notifications", notifications);
    showInAppNotificationToast(unshown.title, unshown.message, unshown.type);
  }
}

function updateBellBadge(count) {
  document.querySelectorAll(".fa-bell").forEach(icon => {
    const parent = icon.parentElement;
    if (!parent) return;
    parent.style.position = "relative";
    let badge = parent.querySelector(".notif-red-dot");
    if (count > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "notif-red-dot";
        badge.style.cssText = "position:absolute; top:-4px; right:-4px; background:#ef4444; color:#fff; font-size:0.65rem; font-weight:900; min-width:16px; height:16px; border-radius:50%; display:flex; align-items:center; justify-content:center; padding:0 3px; border:1.5px solid #0b1329;";
        parent.appendChild(badge);
      }
      badge.innerText = count;
    } else if (badge) {
      badge.remove();
    }
  });
}

function showInAppNotificationToast(title, message, type = "success") {
  const oldToast = document.getElementById("live-notif-toast");
  if (oldToast) oldToast.remove();

  const borderColor = type === "danger" ? "#ef4444" : "#10b981";
  const toast = document.createElement("div");
  toast.id = "live-notif-toast";
  toast.style.cssText = `position:fixed; top:16px; left:50%; transform:translateX(-50%); width:92%; max-width:390px; background:#0b1329; border:1.5px solid ${borderColor}; border-radius:18px; padding:14px 16px; color:#fff; z-index:999999; box-shadow:0 15px 40px rgba(0,0,0,0.75); display:flex; align-items:flex-start; justify-content:space-between; gap:10px;`;
  toast.innerHTML = `
    <div style="text-align:right; flex:1; cursor:pointer;" onclick="this.parentElement.remove(); openFeatureModal('notifications');">
      <div style="font-weight:900; font-size:0.92rem; color:${borderColor}; margin-bottom:4px;">${title}</div>
      <div style="font-size:0.8rem; color:#e2e8f0; line-height:1.5;">${message}</div>
    </div>
    <button onclick="this.parentElement.remove()" style="background:rgba(255,255,255,0.1); border:none; color:#fff; width:26px; height:26px; border-radius:50%; cursor:pointer;">✕</button>
  `;
  document.body.appendChild(toast);
  setTimeout(() => { if (toast && toast.parentElement) toast.remove(); }, 7000);
}

function calculateProductFinalPrice(product) {
  if (!product) return 0;
  const supplierPrice = Number(product.supplierPriceUSD !== undefined ? product.supplierPriceUSD : (product.priceUSD || 0));
  const globalPercent = Number(getDB("global_profit_percent", 0));
  const categoryOffers = getDB("category_profit_percents", {});
  let appliedPercent = globalPercent;
  if (product.categoryId && categoryOffers[product.categoryId] !== undefined && categoryOffers[product.categoryId] !== null && categoryOffers[product.categoryId] !== "") {
    appliedPercent = Number(categoryOffers[product.categoryId]);
  }
  if (product.customPercent !== undefined && product.customPercent !== null && product.customPercent !== "") {
    appliedPercent = Number(product.customPercent);
  }
  return Number((supplierPrice + (supplierPrice * (appliedPercent / 100))).toFixed(3));
}

function getProductAppliedOfferInfo(product) {
  const globalPercent = Number(getDB("global_profit_percent", 0));
  const categoryOffers = getDB("category_profit_percents", {});
  if (product.customPercent !== undefined && product.customPercent !== null && product.customPercent !== "") {
    const p = Number(product.customPercent);
    return { percent: p, isSpecialOffer: p < globalPercent };
  }
  if (product.categoryId && categoryOffers[product.categoryId] !== undefined && categoryOffers[product.categoryId] !== null && categoryOffers[product.categoryId] !== "") {
    const p = Number(categoryOffers[product.categoryId]);
    return { percent: p, isSpecialOffer: p < globalPercent };
  }
  return { percent: globalPercent, isSpecialOffer: false };
}

function toggleDisplayCurrency(e) {
  if (e) e.stopPropagation();
  displayCurrency = (displayCurrency === "USD") ? "SYP" : "USD";
  setDB("display_currency", displayCurrency);
  updateUserUI();
  if (typeof onPackageSelectChange === "function") onPackageSelectChange();
}

function formatStoreAmount(usdAmount) {
  const val = Number(usdAmount || 0);
  if (displayCurrency === "SYP") {
    return `${Math.round(val * STORE_EXCHANGE_RATE).toLocaleString("en-US")} ل.س`;
  }
  return `${val.toFixed(3)} $`;
}

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

function toggleTheme() {
  const isCurrentlyDark = document.body.classList.contains("dark-drawer");
  setDB("site_theme", isCurrentlyDark ? "light" : "dark");
  initSavedTheme();
}

async function syncOrdersWithSupplier() {
  const orders = getDB("orders", []);
  if (!Array.isArray(orders) || orders.length === 0) return false;
  const pendingOrders = orders.filter(o => o.supplierOrderId && !o.isFinalized && o.status !== "مكتمل" && o.status !== "مكتمل ✓" && !String(o.status).includes("مرفوض"));
  if (pendingOrders.length === 0) return false;

  const apiToken = (getDB("supplier_api_key", "") || SHAMS_DEFAULT_TOKEN).trim();
  const idsList = pendingOrders.map(o => o.supplierOrderId).join(",");

  try {
    const targetUrl = `${SHAMS_CHECK_ORDERS_ENDPOINT}?orders=${encodeURIComponent(idsList)}`;
    const workerUrl = `${SUPPLIER_WORKER_URL}?url=${encodeURIComponent(targetUrl)}&token=${encodeURIComponent(apiToken)}`;
    const res = await fetch(workerUrl, {
      method: "GET",
      headers: { "Accept": "application/json", "api-token": apiToken, "Authorization": `Bearer ${apiToken}` }
    });
    const data = await res.json();
    const statusMap = {};
    const items = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : (data.orders ? Object.values(data.orders) : (data.data && typeof data.data === "object" ? Object.values(data.data) : [])));
    items.forEach(item => {
      if (item && typeof item === "object") {
        const oid = String(item.order_id || item.id || item.order || "");
        if (oid) statusMap[oid] = item;
      }
    });
    if (data && typeof data === "object" && !Array.isArray(data)) {
      Object.keys(data).forEach(k => {
        if (k.startsWith("ID_") || /^\d+$/.test(k)) {
          statusMap[k] = typeof data[k] === "object" ? data[k] : { status: data[k] };
        }
      });
    }

    let changed = false;
    let totalRefundedUSD = 0;
    const users = getDB("users", []);

    orders.forEach(order => {
      if (!order.supplierOrderId || order.isFinalized) return;
      const supInfo = statusMap[String(order.supplierOrderId)];
      if (!supInfo) return;
      const rawStatus = String(supInfo.status || supInfo.state || "").toLowerCase();
      const supReply = supInfo.reply || supInfo.replay || supInfo.note || supInfo.reason || supInfo.message || "";
      if (supReply) order.supplierReply = supReply;

      if (["accept", "completed", "complete", "success", "done", "مكتمل"].includes(rawStatus)) {
        order.status = "مكتمل ✓";
        order.isFinalized = true;
        changed = true;
      } else if (["reject", "rejected", "canceled", "cancelled", "fail", "failed", "مرفوض"].includes(rawStatus)) {
        order.status = "مرفوض ✕";
        order.isFinalized = true;
        changed = true;
        if (!order.refunded) {
          order.refunded = true;
          totalRefundedUSD += Number(order.price || 0);
        }
      }
    });

    if (totalRefundedUSD > 0 && Array.isArray(users) && users.length > 0 && users[0].name !== "زائر") {
      users[0].balanceUSD = Number(((users[0].balanceUSD || 0) + totalRefundedUSD).toFixed(3));
      setDB("users", users);
      updateUserUI();
      showInAppNotificationToast("🔄 استرجاع رصيد تلقائي", `تم رفض أحد الطلبات من المورد وأُعيد مبلغ ${formatStoreAmount(totalRefundedUSD)} إلى رصيدك تلقائياً.`, "danger");
    }
    if (changed) setDB("orders", orders);
    return changed;
  } catch (e) {
    return false;
  }
}

function showOrderDetailsModal(orderId) {
  const orders = getDB("orders", []);
  const order = orders.find(o => String(o.id) === String(orderId));
  if (!order) return;

  const modal = document.getElementById("feature-modal");
  const titleEl = document.getElementById("feature-modal-title");
  const iconEl = document.getElementById("feature-modal-icon");
  const bodyEl = document.getElementById("feature-modal-body");
  if (!modal || !titleEl || !iconEl || !bodyEl) return;

  const isRejected = String(order.status).includes("مرفوض");
  const isCompleted = String(order.status).includes("مكتمل");
  const statusColor = isRejected ? "#ef4444" : (isCompleted ? "#10b981" : "#f59e0b");

  iconEl.className = "fa-solid fa-receipt";
  iconEl.style.color = "#38bdf8";
  titleEl.innerText = "مواصفات وتفاصيل الطلب";

  bodyEl.innerHTML = `
    <div style="background:#050b18; border:1px solid rgba(56,189,248,0.25); border-radius:16px; padding:14px; margin-bottom:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:10px; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.08);">
        <span style="color:#94a3b8; font-size:0.82rem;">حالة الطلب:</span>
        <span style="background:${statusColor}22; color:${statusColor}; border:1px solid ${statusColor}; padding:3px 12px; border-radius:20px; font-size:0.8rem; font-weight:800;">${order.status}</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.84rem;"><span style="color:#94a3b8;">المنتج:</span><strong style="color:#fff;">${order.packageName}</strong></div>
      <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.84rem;"><span style="color:#94a3b8;">القسم:</span><strong style="color:#e2e8f0;">${order.categoryName}</strong></div>
      <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.84rem;"><span style="color:#94a3b8;">الكمية المرسلة:</span><strong style="color:#38bdf8;">${order.qty || 1}</strong></div>
      <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.84rem;"><span style="color:#94a3b8;">المستلم:</span><strong style="color:#38bdf8; word-break:break-all; max-width:60%; text-align:left;" dir="ltr">${order.target}</strong></div>
      <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.84rem;"><span style="color:#94a3b8;">المبلغ:</span><strong style="color:#10b981;">${formatStoreAmount(order.price)}</strong></div>
      <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.84rem;"><span style="color:#94a3b8;">التاريخ:</span><span style="color:#cbd5e1; font-size:0.78rem;">${order.date}</span></div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.08); font-size:0.8rem;">
        <span style="color:#94a3b8;">رقم العملية:</span>
        <div style="display:flex; align-items:center; gap:6px;">
          <code style="color:#38bdf8; background:#0f172a; padding:3px 8px; border-radius:8px;" dir="ltr">${order.supplierOrderId || order.id}</code>
          <button type="button" onclick="navigator.clipboard.writeText('${order.supplierOrderId || order.id}'); alert('تم نسخ رقم العملية');" style="background:#0284c7; border:none; color:#fff; padding:4px 8px; border-radius:6px; font-size:0.72rem; cursor:pointer;">نسخ</button>
        </div>
      </div>
      ${order.refunded ? `<div style="margin-top:10px; background:rgba(16,185,129,0.15); border:1px solid #10b981; color:#10b981; padding:8px 10px; border-radius:10px; font-size:0.78rem; font-weight:700; text-align:center;">✓ تم إرجاع مبلغ (${formatStoreAmount(order.price)}) إلى محفظتك تلقائياً</div>` : ""}
      ${order.supplierReply ? `<div style="margin-top:10px; background:#0f172a; border-right:3px solid #f59e0b; padding:8px 10px; border-radius:8px; font-size:0.78rem; color:#e2e8f0;"><strong style="color:#f59e0b;">ملاحظة التنفيذ:</strong> ${order.supplierReply}</div>` : ""}
    </div>
    <button type="button" onclick="openFeatureModal('orders')" class="btn-send-deposit" style="background:#1e293b; border:1px solid rgba(56,189,248,0.3);"><i class="fa-solid fa-arrow-right"></i> رجوع إلى سجل الطلبات</button>
  `;
  modal.classList.remove("hidden");
}

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
    iconEl.className = "fa-solid fa-crown"; iconEl.style.color = "#f59e0b"; titleEl.innerText = "نظام المستويات والعضويات";
    const currentRank = currentUser ? (currentUser.role || "عضو") : "زائر";
    const levels = [
      { name: "عضو", desc: "الحساب الأساسي لجميع المستخدمين الجدد.", badge: "#64748b" },
      { name: "VIP 1", desc: "أولوية في معالجة الطلبات وتنفيذ أسرع.", badge: "#0284c7" },
      { name: "VIP 4", desc: "خصومات خاصة على البطاقات والباقات + دعم مباشر.", badge: "#8b5cf6" },
      { name: "الأسطورة", desc: "أعلى مستوى في المتجر مع كامل الصلاحيات وأفضل الأسعار.", badge: "#f59e0b" }
    ];
    bodyEl.innerHTML = `<div style="background:#050b18; border:1px solid rgba(56,189,248,0.25); padding:12px; border-radius:14px; margin-bottom:12px; text-align:center;">مستواك الحالي: <strong style="color:#38bdf8; font-size:1.05rem;">${currentRank}</strong></div>` +
      levels.map(l => `<div style="background:#0f172a; border:1px solid ${currentRank === l.name ? '#38bdf8' : 'rgba(255,255,255,0.08)'}; padding:12px; border-radius:14px; margin-bottom:8px;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;"><strong style="color:#fff;">${l.name}</strong><span style="background:${l.badge}; color:#fff; font-size:0.72rem; padding:2px 10px; border-radius:20px;">${currentRank === l.name ? 'مستواك الحالي ✓' : 'متاح'}</span></div><p style="font-size:0.8rem; color:#94a3b8; margin:0;">${l.desc}</p></div>`).join("");
  } else if (type === "security") {
    if (!currentUser) { if (typeof openAuthModal === "function") openAuthModal(); return; }
    iconEl.className = "fa-solid fa-shield-halved"; iconEl.style.color = "#10b981"; titleEl.innerText = "إعدادات الأمان والحماية";
    bodyEl.innerHTML = `<div style="background:#050b18; border:1px solid rgba(16,185,129,0.3); padding:12px; border-radius:14px; margin-bottom:14px; font-size:0.85rem;"><div style="color:#10b981; font-weight:800; margin-bottom:4px;">✓ حسابك محمي ومؤمّن</div><div style="color:#94a3b8;">البريد: <strong style="color:#fff;" dir="ltr">${currentUser.email || "غير مرتبط"}</strong></div></div><form onsubmit="handleQuickPasswordChange(event)"><div class="deposit-input-group"><label class="deposit-label">كلمة مرور جديدة:</label><input type="password" id="sec-new-password" class="deposit-field" required minlength="6"></div><button type="submit" class="btn-send-deposit" style="background:#10b981;">تحديث كلمة المرور</button></form>`;
  } else if (type === "sessions") {
    iconEl.className = "fa-solid fa-mobile-screen"; iconEl.style.color = "#38bdf8"; titleEl.innerText = "الجلسات النشطة";
    bodyEl.innerHTML = `<div style="background:#0f172a; border:1px solid #38bdf8; padding:14px; border-radius:14px; margin-bottom:14px;"><strong style="color:#fff;">الجلسة الحالية نشطة</strong><div style="font-size:0.78rem; color:#94a3b8; margin-top:4px;">${new Date().toLocaleString("ar-SY")}</div></div><button type="button" onclick="closeFeatureModal(); logoutUser();" class="btn-send-deposit" style="background:#ef4444;">تسجيل الخروج</button>`;
  } else if (type === "favorites") {
    iconEl.className = "fa-solid fa-heart"; iconEl.style.color = "#ef4444"; titleEl.innerText = "الأقسام المفضلة";
    const categories = getDB("categories", initialCategories);
    const favIds = getDB("user_favorites", ["cat_syriatel", "cat_mtn"]);
    const favCats = categories.filter(c => favIds.includes(c.id));
    bodyEl.innerHTML = favCats.length ? favCats.map(c => `<div style="background:#0f172a; padding:10px 12px; border-radius:14px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;"><strong style="color:#fff;">${c.name}</strong><button onclick="closeFeatureModal(); openCategory('${c.id}', '${c.name.replace(/'/g, "\\'")}', '${c.image}')" style="background:#0284c7; border:none; color:#fff; padding:6px 12px; border-radius:8px;">فتح</button></div>`).join("") : `<p style="text-align:center; color:#94a3b8;">لا توجد عناصر في المفضلة.</p>`;
  } else if (type === "notifications") {
    iconEl.className = "fa-solid fa-bell"; iconEl.style.color = "#f59e0b"; titleEl.innerText = "الإشعارات والتنبيهات";
    const allNotifs = getDB("user_notifications", []);
    const myNotifs = currentUser ? allNotifs.filter(n => n.userName === currentUser.name) : [];
    if (currentUser && myNotifs.some(n => !n.read)) {
      allNotifs.forEach(n => { if (n.userName === currentUser.name) n.read = true; });
      setDB("user_notifications", allNotifs);
      updateBellBadge(0);
    }
    bodyEl.innerHTML = myNotifs.map(n => `<div style="background:#0f172a; border-right:3px solid ${n.type === 'danger' ? '#ef4444' : '#10b981'}; padding:12px; border-radius:12px; margin-bottom:10px;"><div style="font-weight:900; color:#fff;">${n.title}</div><div style="font-size:0.8rem; color:#e2e8f0; margin-top:4px;">${n.message}</div></div>`).join("") + `<div style="background:#0f172a; border-right:3px solid #38bdf8; padding:12px; border-radius:12px;"><div style="font-weight:800; color:#fff;">أهلاً بك في متجر Mohannad kard 🇸🇾</div></div>`;
  } else if (type === "orders") {
    iconEl.className = "fa-solid fa-cart-shopping"; iconEl.style.color = "#38bdf8"; titleEl.innerText = "سجل طلباتي";
    const renderOrdersListHTML = () => {
      const orders = getDB("orders", []);
      if (!Array.isArray(orders) || orders.length === 0) {
        bodyEl.innerHTML = `<p style="text-align:center; color:#94a3b8; padding:24px;">لم تقم بأي طلب شراء حتى الآن.</p>`;
        return;
      }
      bodyEl.innerHTML = orders.map(o => {
        const isRejected = String(o.status).includes("مرفوض");
        const isCompleted = String(o.status).includes("مكتمل");
        const borderCol = isRejected ? "#ef4444" : (isCompleted ? "#10b981" : "#f59e0b");
        const textCol = isRejected ? "#ef4444" : (isCompleted ? "#10b981" : "#f59e0b");
        return `
          <div style="background:#0f172a; border-right:3px solid ${borderCol}; padding:12px; border-radius:12px; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="font-size:0.9rem; color:#fff;">${o.packageName}</strong>
              <span style="color:#38bdf8; font-weight:800;">${formatStoreAmount(o.price)}</span>
            </div>
            <div style="font-size:0.78rem; color:#94a3b8; margin-top:4px;">القسم: ${o.categoryName} | المستلم: <strong style="color:#fff;">${o.target}</strong></div>
            ${o.supplierOrderId ? `<div style="font-size:0.74rem; color:#38bdf8; margin-top:3px;">رقم طلب المورد: #${o.supplierOrderId}</div>` : ""}
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.06);">
              <span style="font-size:0.74rem; color:${textCol}; font-weight:700;">الحالة: ${o.status}</span>
              <button type="button" onclick="showOrderDetailsModal('${o.id}')" style="background:#0284c7; border:none; color:#fff; padding:5px 12px; border-radius:8px; font-size:0.75rem; font-weight:800; cursor:pointer;">مواصفات الطلب</button>
            </div>
          </div>
        `;
      }).join("");
    };
    renderOrdersListHTML();
    syncOrdersWithSupplier().then(updated => { if (updated) renderOrdersListHTML(); });
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
  if (newPass.length < 6) return;
  const users = getDB("users", []);
  if (Array.isArray(users) && users.length > 0) {
    users[0].password = newPass;
    setDB("users", users);
    alert("✅ تم تحديث كلمة المرور بنجاح!");
    closeFeatureModal();
  }
}

function isCurrentUserAdmin(user) {
  if (!user) return false;
  return user.role === "الأسطورة" || user.role === "Admin" || (user.email && user.email.toLowerCase() === "fhdsd686@gmail.com") || (user.name && user.name.toLowerCase() === "mohannad");
}

function checkMaintenanceGate() {
  const isMaintenance = getDB("maintenance_mode", false);
  const modal = document.getElementById("maintenance-modal");
  const users = getDB("users", []);
  const currentUser = (Array.isArray(users) && users.length > 0) ? users[0] : null;
  if (modal) modal.classList.toggle("hidden", !(isMaintenance && !isCurrentUserAdmin(currentUser)));
}

function loadSiteSettings() {
  const defaultBanners = ["https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=600&q=80"];
  const settings = getDB("site_settings", { name: "Mohannad kard", logo: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=100&q=80", banners: defaultBanners });
  const logoEl = document.getElementById("site-logo");
  const titleEl = document.getElementById("site-title");
  if (logoEl && settings.logo) logoEl.src = settings.logo;
  if (titleEl && (settings.name || settings.siteName)) titleEl.innerText = settings.name || settings.siteName;
  initBannerSlider((settings.banners && settings.banners.length > 0) ? settings.banners : defaultBanners);
}

function initBannerSlider(banners) {
  const bannerCard = document.querySelector(".banner-card");
  if (!bannerCard || !banners || banners.length === 0) return;
  let currentIndex = 0;
  const imgEl = bannerCard.querySelector("img");
  const dotsContainer = bannerCard.querySelector(".banner-dots");
  if (dotsContainer) dotsContainer.innerHTML = banners.map((_, i) => `<span class="b-dot ${i === 0 ? 'active' : ''}"></span>`).join("");
  const showSlide = (idx) => {
    currentIndex = idx;
    if (imgEl && banners[currentIndex]) imgEl.src = banners[currentIndex];
    bannerCard.querySelectorAll(".b-dot").forEach((d, i) => d.classList.toggle("active", i === currentIndex));
  };
  showSlide(0);
  if (bannerInterval) clearInterval(bannerInterval);
  if (banners.length > 1) bannerInterval = setInterval(() => showSlide((currentIndex + 1) % banners.length), 3500);
}

function promptChangeUserAvatar() {
  const users = getDB("users", []);
  if (Array.isArray(users) && users[0] && users[0].isBanned) { alert("🚫 حسابك محظور."); return; }
  const newUrl = prompt("ضع رابط صورتك الشخصية الجديدة:");
  if (!newUrl || !newUrl.trim() || !Array.isArray(users) || users.length === 0) return;
  users[0].avatar = newUrl.trim();
  setDB("users", users);
  updateUserUI();
}

function openDepositModal() {
  toggleSidebar(false);
  const users = getDB("users", []);
  if (!Array.isArray(users) || users.length === 0 || !users[0].name || users[0].name === "زائر") {
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
  if (!activeDepositMethod || !methods.find(m => m.id === activeDepositMethod.id)) activeDepositMethod = methods[0];
  const defaultIcon = "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=100&q=80";
  selector.innerHTML = methods.map(m => `<button type="button" class="method-pill-btn ${activeDepositMethod.id === m.id ? 'active' : ''}" onclick="selectDepositMethod('${m.id}')"><img src="${m.icon || defaultIcon}" style="width:20px;height:20px;border-radius:6px;"><span>${m.name}</span></button>`).join("");
  applyActiveDepositMethodUI();
}

function selectDepositMethod(methodId) {
  const found = getDB("depositMethods", initialDepositMethods).find(m => m.id === methodId);
  if (found) { activeDepositMethod = found; renderDepositMethodsSelector(); }
}

function applyActiveDepositMethodUI() {
  if (!activeDepositMethod) return;
  const logoEl = document.getElementById("deposit-active-logo");
  const nameEl = document.getElementById("deposit-active-name");
  const accountEl = document.getElementById("deposit-display-account");
  const qrEl = document.getElementById("deposit-active-qr");
  if (logoEl) logoEl.src = activeDepositMethod.icon || "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=100&q=80";
  if (nameEl) nameEl.innerText = activeDepositMethod.name || "";
  if (accountEl) accountEl.innerText = activeDepositMethod.account || "";
  if (qrEl) qrEl.src = activeDepositMethod.qrImage || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(activeDepositMethod.account || "")}`;
  calculateDepositConversion();
}

function getActiveExchangeRate() {
  return (activeDepositMethod && Number(activeDepositMethod.rate) > 1) ? Number(activeDepositMethod.rate) : STORE_EXCHANGE_RATE;
}

function copyDepositNumber() {
  const txt = activeDepositMethod ? activeDepositMethod.account : "";
  navigator.clipboard.writeText(txt).then(() => alert("✅ تم نسخ العنوان: " + txt));
}

function setDepositCurrency(curr) {
  currentDepositCurrency = curr;
  document.getElementById("tab-curr-usd")?.classList.toggle("active", curr === "USD");
  document.getElementById("tab-curr-syp")?.classList.toggle("active", curr === "SYP");
  const label = document.getElementById("deposit-amount-label");
  if (label) label.innerText = curr === "USD" ? "المبلغ المطلوب شحنه (USD):" : "المبلغ المطلوب شحنه (ليرة سورية):";
  calculateDepositConversion();
}

function calculateDepositConversion() {
  const inputVal = parseFloat(document.getElementById("deposit-input-val")?.value) || 0;
  const convertedEl = document.getElementById("deposit-converted-val");
  const rateInfoEl = document.getElementById("deposit-rate-info");
  if (!convertedEl || !rateInfoEl) return;
  const rate = getActiveExchangeRate();
  if (currentDepositCurrency === "USD") {
    convertedEl.innerText = `${inputVal.toFixed(2)} $`;
    rateInfoEl.innerText = `(ما يعادل: ${Math.round(inputVal * rate).toLocaleString("en-US")} ل.س)`;
  } else {
    convertedEl.innerText = `${(inputVal / rate).toFixed(3)} $`;
    rateInfoEl.innerText = `(1$ = ${rate.toLocaleString()} ل.س)`;
  }
}

function onDepositFileChosen(e) {
  const file = e.target.files[0];
  if (!file) return;
  const textEl = document.getElementById("deposit-file-text");
  if (textEl) textEl.innerText = file.name;
  const reader = new FileReader();
  reader.onload = ev => { depositReceiptBase64 = ev.target.result; };
  reader.readAsDataURL(file);
}

function handleDepositSubmit(e) {
  e.preventDefault();
  const users = getDB("users", []);
  const inputVal = parseFloat(document.getElementById("deposit-input-val").value) || 0;
  const senderInfo = document.getElementById("deposit-sender-info").value.trim();
  const note = document.getElementById("deposit-note").value.trim();
  if (inputVal <= 0) return;

  const rate = getActiveExchangeRate();
  const methodName = activeDepositMethod ? activeDepositMethod.name : "شام كاش";
  const amountUSD = currentDepositCurrency === "USD" ? inputVal : Number((inputVal / rate).toFixed(3));
  const amountSYP = currentDepositCurrency === "SYP" ? inputVal : Math.round(inputVal * rate);
  const currentUser = users[0] || { name: "زائر" };

  const allRequests = getDB("deposit_requests", []);
  allRequests.unshift({ id: "dep_" + Date.now(), userName: currentUser.name, userEmail: currentUser.email || "", methodName, amountUSD, amountSYP, sender: senderInfo, note, receipt: depositReceiptBase64, date: new Date().toLocaleString("ar-SY"), status: "معلق" });
  setDB("deposit_requests", allRequests);

  const waMsg = encodeURIComponent(`طلب شحن (${methodName}):\nالمستخدم: ${currentUser.name}\nالمبلغ: ${amountUSD} $ (${amountSYP.toLocaleString()} ل.س)\nالمرسل: ${senderInfo}`);
  alert("✅ تم إرسال طلب الشحن!");
  closeDepositModal();
  window.open(`https://wa.me/963957455972?text=${waMsg}`, "_blank");
}

function renderCategories(filterText = "") {
  const container = document.getElementById("categories-container");
  if (!container) return;
  const categories = getDB("categories", initialCategories);
  const mainCategories = Array.isArray(categories) ? categories.filter(c => !c.parentId) : [];
  const filtered = mainCategories.filter(c => c.name && c.name.toLowerCase().includes((filterText || "").toLowerCase()));
  container.innerHTML = "";
  const defaultImg = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80";

  filtered.forEach(cat => {
    const item = document.createElement("div");
    item.className = "cat-app-item";
    item.onclick = () => openCategory(cat.id, cat.name, cat.image, null);
    const imgSrc = (cat.image && cat.image.trim().length > 10) ? cat.image : defaultImg;
    item.innerHTML = `<div class="cat-app-avatar"><img src="${imgSrc}" alt="${cat.name}" onerror="this.src='${defaultImg}'"></div><span class="cat-app-label">${cat.name}</span>`;
    container.appendChild(item);
  });
}

function filterCategories() {
  const input = document.getElementById("category-search");
  if (input) renderCategories(input.value.trim());
}

function getTargetFieldConfig(catName) {
  const nameLower = (catName || "").toLowerCase();
  if (nameLower.includes("متابع") || nameLower.includes("فيسبوك") || nameLower.includes("تيك") || nameLower.includes("انست") || nameLower.includes("يوتيوب") || nameLower.includes("تيلي") || nameLower.includes("صفح") || nameLower.includes("لايك") || nameLower.includes("مشاهد")) {
    return { label: "رابط الصفحة أو الحساب", placeholder: "ضع رابط الصفحة أو الحساب هنا (https://...)" };
  }
  if (nameLower.includes("mtn") || nameLower.includes("سيرياتيل") || nameLower.includes("رصيد") || nameLower.includes("كاش") || nameLower.includes("وحدات")) {
    return { label: "رقم الهاتف", placeholder: "أدخل رقم الهاتف المطلوب (مثال: 09xxxxxxxx)" };
  }
  return { label: "معرف اللاعب (ID) أو الحساب", placeholder: "أدخل المعرف (ID) المطلوب" };
}

function openCategory(catId, catName, catImage, parentInfo = null) {
  const users = getDB("users", []);
  if (!Array.isArray(users) || users.length === 0 || !users[0].name || users[0].name === "زائر") {
    if (typeof openAuthModal === "function") openAuthModal();
    return;
  }
  currentParentCategory = parentInfo;
  document.getElementById("categories-container").classList.add("hidden");
  document.querySelector(".search-pill-box")?.classList.add("hidden");
  document.getElementById("products-view")?.classList.remove("hidden");
  const titleEl = document.getElementById("current-category-title");
  if (titleEl) titleEl.innerText = catName;

  const container = document.getElementById("products-container");
  if (!container) return;
  const fallbackImg = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80";
  const defaultImg = (catImage && catImage.trim().length > 10) ? catImage : fallbackImg;

  const subCategories = getDB("categories", initialCategories).filter(c => c.parentId === catId);
  if (subCategories.length > 0) {
    container.className = "categories-app-grid";
    container.innerHTML = "";
    subCategories.forEach(sub => {
      const subImg = (sub.image && sub.image.trim().length > 10) ? sub.image : fallbackImg;
      const subItem = document.createElement("div");
      subItem.className = "cat-app-item";
      subItem.onclick = () => openCategory(sub.id, sub.name, subImg, { id: catId, name: catName, image: defaultImg });
      subItem.innerHTML = `<div class="cat-app-avatar"><img src="${subImg}" alt="${sub.name}"></div><span class="cat-app-label">${sub.name}</span>`;
      container.appendChild(subItem);
    });
    return;
  }

  const catProducts = getDB("products", initialProducts).filter(p => p.categoryId === catId);
  if (catProducts.length === 0) {
    container.className = "products-compact-grid";
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px;"><p style="color:var(--text-muted); margin-bottom:12px;">لا توجد باقات مضافة في هذا القسم حالياً.</p><button class="btn-back-pill" onclick="backToCategories()">الرجوع</button></div>`;
    return;
  }

  let packageOptions = `<option value="" disabled selected>اختر الباقة</option>`;
  catProducts.forEach(prod => {
    const finalUSD = calculateProductFinalPrice(prod);
    packageOptions += `<option value="${prod.id}" data-price="${finalUSD}">${prod.name} (${formatStoreAmount(finalUSD)})</option>`;
  });

  const fieldCfg = getTargetFieldConfig(catName);
  container.className = "service-order-wrapper";
  container.innerHTML = `
    <div class="service-top-card">
      <div class="service-logo-box"><img src="${defaultImg}" alt="${catName}"></div>
      <h2 class="service-title-text">${catName}</h2>
    </div>
    <form class="service-order-form" onsubmit="handleServiceOrder(event, '${catId}', '${catName.replace(/'/g, "\\'")}')">
      <div class="field-block">
        <label class="field-label">${fieldCfg.label}</label>
        <input type="text" id="srv-target-input" class="field-input" placeholder="${fieldCfg.placeholder}" required dir="ltr">
      </div>
      <div class="field-block">
        <label class="field-label">اختر الباقة</label>
        <div class="select-dropdown-box">
          <select id="srv-package-select" class="field-select" required onchange="onPackageSelectChange()">${packageOptions}</select>
        </div>
      </div>
      <div class="order-summary-bar">
        <span>السعر المطلوب:</span>
        <strong id="srv-price-display" style="color:var(--accent-cyan); font-size:1.1rem;">${formatStoreAmount(0)}</strong>
      </div>
      <button type="submit" id="btn-submit-service-order" class="btn-confirm-order"><i class="fa-solid fa-paper-plane"></i> تأكيد الطلب والشحن الفوري</button>
    </form>
  `;
}

function onPackageSelectChange() {
  const select = document.getElementById("srv-package-select");
  const display = document.getElementById("srv-price-display");
  if (!select || !display) return;
  const opt = select.options[select.selectedIndex];
  display.innerText = (opt && opt.dataset.price) ? formatStoreAmount(opt.dataset.price) : formatStoreAmount(0);
}

async function handleServiceOrder(e, catId, catName) {
  e.preventDefault();
  let users = getDB("users", []);
  if (!Array.isArray(users) || users.length === 0 || !users[0].name || users[0].name === "زائر") {
    if (typeof openAuthModal === "function") openAuthModal();
    return;
  }
  const targetInput = document.getElementById("srv-target-input").value.trim();
  const prodId = document.getElementById("srv-package-select").value;
  if (!prodId) { alert("يرجى اختيار الباقة أولاً"); return; }

  const product = getDB("products", initialProducts).find(p => p.id === prodId);
  if (!product) return;
  const currentUser = users[0];
  const price = calculateProductFinalPrice(product);
  if ((currentUser.balanceUSD || 0) < price) { alert("عذراً، رصيدك الحالي لا يكفي!"); return; }

  const submitBtn = document.getElementById("btn-submit-service-order");
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = "جاري الإرسال..."; }

  // تحديد الكمية تلقائياً (مثلاً MTN 50 ترسل qty=50 لخدمات الرصيد والمتابعين، و qty=1 للبطاقات الثابتة)
  let orderQty = 1;
  const fullServiceTitle = `${catName} ${product.name}`.toLowerCase();
  const isQuantityService =
    fullServiceTitle.includes("رصيد") ||
    fullServiceTitle.includes("وحدات") ||
    fullServiceTitle.includes("mtn") ||
    fullServiceTitle.includes("سيرياتيل") ||
    fullServiceTitle.includes("متابع") ||
    fullServiceTitle.includes("لايك") ||
    fullServiceTitle.includes("مشاهد");

  if (isQuantityService) {
    const numMatch = product.name.match(/\d+/);
    if (numMatch && Number(numMatch[0]) > 1) {
      orderQty = Number(numMatch[0]);
    }
  }

  const supplierProductId = product.supplierId || "";
  const apiToken = (getDB("supplier_api_key", "") || SHAMS_DEFAULT_TOKEN).trim();
  const orderReference = "ORD-" + Date.now();
  let supplierOrderId = "";
  let orderStatus = "مكتمل";

  if (supplierProductId) {
    try {
      const targetUrl = `${SHAMS_ORDER_ENDPOINT}/${encodeURIComponent(supplierProductId)}/params?qty=${orderQty}&playerId=${encodeURIComponent(targetInput)}&order_uuid=${encodeURIComponent(orderReference)}`;
      const workerRequestUrl = `${SUPPLIER_WORKER_URL}?url=${encodeURIComponent(targetUrl)}&token=${encodeURIComponent(apiToken)}`;
      const response = await fetch(workerRequestUrl, { method: "GET", headers: { "Accept": "application/json", "api-token": apiToken, "Authorization": `Bearer ${apiToken}` } });
      const result = await response.json();
      if (!response.ok || result.status === false || result.error || (result.code && result.code !== 200 && result.code !== 0 && !result.data)) {
        alert(`⚠️ لم يتم الشحن من المورد:\n${result.msg || result.message || result.error || "خطأ"}`);
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> تأكيد الطلب والشحن الفوري`; }
        return;
      }
      supplierOrderId = (result.data && (result.data.order_id || result.data.id)) || result.order_id || result.id || orderReference;
      orderStatus = "تم الإرسال للمورد ✓";
    } catch (err) {
      alert(`⚠️ خطأ في الاتصال: ${err.message}`);
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> تأكيد الطلب والشحن الفوري`; }
      return;
    }
  }

  currentUser.balanceUSD = Number((currentUser.balanceUSD - price).toFixed(3));
  currentUser.ordersCount = (currentUser.ordersCount || 0) + 1;
  setDB("users", users);

  const orders = getDB("orders", []);
  orders.unshift({ id: "ord_" + Date.now(), supplierOrderId, categoryName: catName, packageName: product.name, qty: orderQty, target: targetInput, price, date: new Date().toLocaleString("ar-SY"), status: orderStatus });
  setDB("orders", orders);

  if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> تأكيد الطلب والشحن الفوري`; }
  updateUserUI();
  alert(`✅ تم تنفيذ طلب الشحن بنجاح!\nالمستلم: ${targetInput}\nالباقة: ${product.name}\nالكمية: ${orderQty}`);
  backToCategories();
}

function backToCategories() {
  if (currentParentCategory) {
    const parent = currentParentCategory;
    currentParentCategory = null;
    openCategory(parent.id, parent.name, parent.image, null);
    return;
  }
  document.getElementById("products-view")?.classList.add("hidden");
  document.getElementById("categories-container")?.classList.remove("hidden");
  document.querySelector(".search-pill-box")?.classList.remove("hidden");
}

function updateUserUI() {
  const users = getDB("users", []);
  const hasUser = Array.isArray(users) && users.length > 0 && users[0].name && users[0].name !== "زائر";
  const user = hasUser ? users[0] : { name: "زائر", balanceUSD: 0, role: "عضو", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80" };

  const headerBal = document.getElementById("header-balance-usd");
  const drawerBal = document.getElementById("drawer-balance-text");
  const sideName = document.getElementById("side-user-name");
  const drawerAvatar = document.getElementById("drawer-avatar");
  const sideRank = document.getElementById("side-user-rank");
  const headerRank = document.getElementById("header-user-rank");
  const adminLink = document.getElementById("admin-panel-link");

  const balUSD = Number(user.balanceUSD || 0);
  const balSYP = Math.round(balUSD * STORE_EXCHANGE_RATE).toLocaleString("en-US");

  if (headerBal) {
    const formattedHeader = displayCurrency === "SYP" ? `${balSYP} ل.س` : `${balUSD.toFixed(3)} $`;
    headerBal.innerHTML = `${formattedHeader} <span onclick="toggleDisplayCurrency(event)" style="background:rgba(56,189,248,0.2); color:#38bdf8; padding:1px 6px; border-radius:8px; font-size:0.72rem; margin-right:4px;">⇄</span>`;
  }
  if (drawerBal) {
    drawerBal.innerHTML = `<div style="cursor:pointer;" onclick="toggleDisplayCurrency(event)"><div>${displayCurrency === "SYP" ? `${balSYP} ل.س` : `$ ${balUSD.toFixed(3)}`}</div><div style="font-size:0.78rem; color:#94a3b8;">${displayCurrency === "SYP" ? `($ ${balUSD.toFixed(3)})` : `(${balSYP} ل.س)`}</div></div>`;
  }
  if (sideName) sideName.innerText = user.fullname || user.name || "زائر";
  if (sideRank) sideRank.innerText = user.role || "عضو";
  if (headerRank) headerRank.innerText = user.role || "عضو";
  if (drawerAvatar) drawerAvatar.src = user.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80";
  if (adminLink) adminLink.style.display = isCurrentUserAdmin(user) ? "flex" : "none";
}

function showStore() {
  currentParentCategory = null;
  backToCategories();
  toggleSidebar(false);
}

function toggleSidebar(force) {
  const drawer = document.getElementById("sidebar-drawer");
  const backdrop = document.getElementById("drawer-backdrop");
  if (!drawer || !backdrop) return;
  const isOpen = (typeof force === "boolean") ? !force : drawer.classList.contains("open");
  drawer.classList.toggle("open", !isOpen);
  backdrop.classList.toggle("hidden", isOpen);
}
