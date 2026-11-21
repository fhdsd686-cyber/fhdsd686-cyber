// ============================================================================
// قاعدة البيانات والمزامنة السحابية الفورية مع Firebase (data.js - v=160)
// ============================================================================

const initialCategories = [
  {
    id: "cat_games",
    name: "قسم شحن جميع الألعاب",
    parentId: null,
    image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "cat_apps",
    name: "قسم شحن التطبيقات",
    parentId: null,
    image: "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "cat_social",
    name: "خدمات السوشال ميديا",
    parentId: null,
    image: "https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "cat_syria_balance",
    name: "قسم خدمات الرصيد السوري",
    parentId: null,
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "cat_subscriptions",
    name: "قسم الاشتراكات",
    parentId: null,
    image: "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "cat_numbers",
    name: "قسم الأرقام",
    parentId: null,
    image: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=300&q=80"
  }
];

const initialDepositMethods = [
  {
    id: "dm_sham_syp",
    name: "شام كاش سوري",
    account: "b7a6624b69166fb60e741400cee2b8bd",
    currency: "USD",
    rate: 155,
    qrImage: "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=b7a6624b69166fb60e741400cee2b8bd",
    icon: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=100&q=80"
  }
];

// مفاتيح البيانات المشتركة بين جميع المستخدمين في السحابة (باستثناء الجلسة المحلية users)
const CLOUD_SYNC_KEYS = [
  "categories",
  "products",
  "depositMethods",
  "deposit_requests",
  "cloud_users_registry",
  "user_notifications",
  "orders",
  "site_settings",
  "admin_whatsapp",
  "global_profit_percent",
  "category_profit_percents",
  "maintenance_mode",
  "supplier_api_url",
  "supplier_api_key",
  "supplier_catalog"
];

function getDB(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined || raw === "undefined") {
      return defaultValue;
    }
    return JSON.parse(raw);
  } catch (e) {
    return defaultValue;
  }
}

function setDB(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("Storage write error:", e);
  }

  // رفع التغيير فوراً إلى Firebase Firestore إذا كان المفتاح مشتركاً
  if (CLOUD_SYNC_KEYS.includes(key) && typeof firebase !== "undefined" && firebase.firestore) {
    try {
      const db = firebase.firestore();
      db.collection("store_data").doc("main_db").set(
        {
          [key]: JSON.stringify(value),
          updatedAt: Date.now()
        },
        { merge: true }
      ).catch(err => console.warn("Cloud save error:", err));
    } catch (e) {}
  }
}

// تهيئة البيانات الأساسية والمزامنة الفورية من Firebase عند فتح الموقع
(function initCloudDatabaseSync() {
  if (!getDB("categories")) {
    localStorage.setItem("categories", JSON.stringify(initialCategories));
  }
  if (!getDB("depositMethods")) {
    localStorage.setItem("depositMethods", JSON.stringify(initialDepositMethods));
  }

  if (typeof firebase === "undefined" || !firebase.firestore) return;
  const db = firebase.firestore();

  db.collection("store_data").doc("main_db").onSnapshot(
    doc => {
      if (!doc.exists) return;
      const cloud = doc.data() || {};
      let uiNeedsRefresh = false;

      CLOUD_SYNC_KEYS.forEach(key => {
        if (cloud[key] !== undefined && cloud[key] !== null) {
          try {
            const parsed = typeof cloud[key] === "string" ? JSON.parse(cloud[key]) : cloud[key];
            const currentRaw = localStorage.getItem(key);
            const nextRaw = JSON.stringify(parsed);
            if (currentRaw !== nextRaw) {
              localStorage.setItem(key, nextRaw);
              uiNeedsRefresh = true;
            }
          } catch (e) {}
        }
      });

      // تحديث رصيد المستخدم المسجل حالياً فوراً من السحابة
      const reg = getDB("cloud_users_registry", {});
      const localUsers = getDB("users", []);
      if (Array.isArray(localUsers) && localUsers[0] && localUsers[0].name !== "زائر") {
        const uEmail = (localUsers[0].email || "").toLowerCase().trim();
        const uName = (localUsers[0].name || "").toLowerCase().trim();
        const uFull = (localUsers[0].fullname || "").toLowerCase().trim();

        const matched = Object.values(reg).find(
          u =>
            u &&
            ((uEmail && (u.email || "").toLowerCase().trim() === uEmail) ||
              (uName && ((u.name || "").toLowerCase().trim() === uName || (u.fullname || "").toLowerCase().trim() === uName)) ||
              (uFull && ((u.name || "").toLowerCase().trim() === uFull || (u.fullname || "").toLowerCase().trim() === uFull)))
        );

        if (matched) {
          const newBal = Number(matched.balanceUSD || 0);
          if (Number(localUsers[0].balanceUSD || 0) !== newBal || (matched.role && matched.role !== localUsers[0].role)) {
            localUsers[0].balanceUSD = newBal;
            if (matched.role) localUsers[0].role = matched.role;
            localStorage.setItem("users", JSON.stringify(localUsers));
            uiNeedsRefresh = true;
          }
        }
      }

      if (uiNeedsRefresh) {
        if (typeof loadSiteSettings === "function") loadSiteSettings();
        if (typeof renderCategories === "function") renderCategories();
        if (typeof updateUserUI === "function") updateUserUI();
        if (typeof checkIncomingNotifications === "function") checkIncomingNotifications();
        if (typeof checkMaintenanceGate === "function") checkMaintenanceGate();
      }
    },
    err => console.warn("Firestore snapshot error:", err)
  );
})();
