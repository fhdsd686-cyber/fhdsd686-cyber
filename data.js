// --- قاعدة البيانات السحابية المتزامنة (Firebase Firestore + LocalStorage Cache) ---

const initialCategories = [
  { id: "cat_subs", name: "قسم الاشتراكات", parentId: null, image: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=300&q=80" },
  { id: "cat_syria_telecom", name: "خدمات شركات الاتصالات السورية", parentId: null, image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=300&q=80" },
  { id: "cat_social", name: "خدمات السوشال ميديا", parentId: null, image: "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?auto=format&fit=crop&w=300&q=80" },
  { id: "cat_games", name: "قسم شحن جميع الألعاب", parentId: null, image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=300&q=80" },
  { id: "cat_live", name: "قسم شحن عملات لمنصات البثوث", parentId: null, image: "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=300&q=80" }
];

const initialProducts = [];

const initialDepositMethods = [
  {
    id: "dm_shamcash",
    name: "شام كاش سوري",
    account: "b7a6624b69166fb60e741400cee2b8bd",
    currency: "USD",
    rate: 15000,
    qrImage: "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=b7a6624b69166fb60e741400cee2b8bd",
    icon: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=100&q=80"
  }
];

// قائمة المفاتيح المشتركة التي تتزامن بين جميع الهواتف عبر السحابة
const CLOUD_SHARED_KEYS = [
  "site_settings",
  "categories",
  "products",
  "depositMethods",
  "deposit_requests",
  "orders",
  "global_profit_percent",
  "category_profit_percents",
  "maintenance_mode",
  "user_notifications",
  "cloud_users_registry"
];

let firestoreDB = null;
let isApplyingRemoteSnapshot = false;

// تهيئة الاتصال مع Firestore بمجرد تحميل الصفحة
(function initCloudSync() {
  if (typeof firebase !== "undefined" && firebase.firestore) {
    firestoreDB = firebase.firestore();
    startRealtimeCloudListeners();
  }
})();

// قراءة البيانات محلياً مع ضمان السرعة الفائقة
function getDB(key, defaultValue) {
  try {
    const raw = localStorage.getItem("mk_" + key);
    if (raw === null || raw === undefined) return defaultValue;
    return JSON.parse(raw);
  } catch (e) {
    return defaultValue;
  }
}

// حفظ البيانات محلياً ومزامنتها فوراً مع السحابة لجميع الهواتف
function setDB(key, value) {
  try {
    localStorage.setItem("mk_" + key, JSON.stringify(value));
  } catch (e) {
    console.error("Local Save Error:", e);
  }

  // إذا تم تحديث قائمة المستخدمين المحلية، نرفع بيانات المستخدم النشط إلى السجل السحابي المشترك
  if (key === "users" && Array.isArray(value) && value.length > 0 && value[0].name !== "زائر") {
    syncCurrentUserToCloudRegistry(value[0]);
  }

  // رفع المفتاح إلى Firestore إذا كان ضمن المفاتيح المشتركة ولم يكن قادماً من تحديث سحابي
  if (firestoreDB && !isApplyingRemoteSnapshot && CLOUD_SHARED_KEYS.includes(key)) {
    firestoreDB.collection("store_data").doc(key).set({
      payload: JSON.stringify(value),
      updatedAt: Date.now()
    }).catch(err => console.warn("Cloud Sync Write Warning:", err));
  }
}

// مزامنة بيانات المستخدم الحالي (رصيده، رتبته، حالة الحظر) مع السجل السحابي
function syncCurrentUserToCloudRegistry(localUser) {
  if (!firestoreDB || !localUser || !localUser.name || localUser.name === "زائر") return;

  const registry = getDB("cloud_users_registry", {});
  const userKey = (localUser.email || localUser.name).toLowerCase().trim();

  registry[userKey] = {
    ...registry[userKey],
    ...localUser,
    lastSeen: Date.now()
  };

  isApplyingRemoteSnapshot = true;
  localStorage.setItem("mk_cloud_users_registry", JSON.stringify(registry));
  isApplyingRemoteSnapshot = false;

  firestoreDB.collection("store_data").doc("cloud_users_registry").set({
    payload: JSON.stringify(registry),
    updatedAt: Date.now()
  }).catch(() => {});
}

// الاستماع اللحظي لأي تغيير يحدث من أي هاتف وتحديث الشاشة فوراً
function startRealtimeCloudListeners() {
  if (!firestoreDB) return;

  CLOUD_SHARED_KEYS.forEach((key) => {
    firestoreDB.collection("store_data").doc(key).onSnapshot((doc) => {
      if (!doc.exists) {
        // إذا كانت السحابة فارغة لأول مرة، ارفع البيانات الموجودة على هذا الهاتف إليها
        const existingLocal = getDB(key, null);
        if (existingLocal !== null) {
          firestoreDB.collection("store_data").doc(key).set({
            payload: JSON.stringify(existingLocal),
            updatedAt: Date.now()
          }).catch(() => {});
        }
        return;
      }

      const data = doc.data();
      if (!data || !data.payload) return;

      try {
        const parsed = JSON.parse(data.payload);
        isApplyingRemoteSnapshot = true;
        localStorage.setItem("mk_" + key, JSON.stringify(parsed));
        isApplyingRemoteSnapshot = false;

        // تحديث واجهة المتجر تلقائياً حسب البيانات الجديدة
        refreshUIAfterCloudSync(key, parsed);
      } catch (e) {
        isApplyingRemoteSnapshot = false;
      }
    });
  });
}

// تحديث عناصر الواجهة فور وصول بيانات جديدة من السحابة
function refreshUIAfterCloudSync(key, parsedData) {
  if (key === "site_settings" && typeof loadSiteSettings === "function") {
    loadSiteSettings();
  }
  if ((key === "categories" || key === "category_profit_percents" || key === "global_profit_percent") && typeof renderCategories === "function") {
    renderCategories();
  }
  if (key === "maintenance_mode" && typeof checkMaintenanceGate === "function") {
    checkMaintenanceGate();
  }
  if (key === "user_notifications" && typeof checkIncomingNotifications === "function") {
    checkIncomingNotifications();
  }
  if (key === "deposit_requests" && typeof renderAdminDepositRequests === "function") {
    renderAdminDepositRequests();
  }

  // تحديث رصيد ورتبة وحالة حظر المستخدم الحالي إذا عدّلها المدير من هاتف آخر
  if (key === "cloud_users_registry" && parsedData) {
    const users = getDB("users", []);
    if (Array.isArray(users) && users.length > 0 && users[0].name !== "زائر") {
      const userKey = (users[0].email || users[0].name).toLowerCase().trim();
      const cloudProfile = parsedData[userKey];
      if (cloudProfile) {
        users[0].balanceUSD = cloudProfile.balanceUSD;
        users[0].role = cloudProfile.role;
        users[0].isBanned = cloudProfile.isBanned;
        localStorage.setItem("mk_users", JSON.stringify(users));
        if (typeof updateUserUI === "function") updateUserUI();
      }
    }
  }
}
