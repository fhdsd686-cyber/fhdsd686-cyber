// --- قاعدة البيانات الأولية والتخزين المحلي ---

// بيانات المشرف الثابتة لحماية اللوحة
const ADMIN_EMAIL = "fhdsd686@gmail.com";
const ADMIN_PASS = "f123456f";

// تهيئة المستخدمين مع حساب المشرف كأول مستخدم
const initialUsers = [
  {
    id: "admin-1",
    name: "Mohannad (Admin)",
    email: ADMIN_EMAIL,
    password: ADMIN_PASS,
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
    role: "مدير",
    rank: "مضيف",
    balanceUSD: 0.00,
    balanceSYP: 0,
    ordersCount: 0,
    successPurchases: 0,
    depositsCount: 0,
    totalSuccessfulDepositsUSD: 0.00,
    joinedDate: "2026/11/01"
  }
];

// تهيئة الأقسام الافتراضية للخدمات
const initialCategories = [
  {
    id: "cat-1",
    name: "رصيد سيريتل كاش",
    parent: "main",
    desc: "شحن رصيد سيريتل كاش فوري وآمن",
    image: "https://images.unsplash.com/photo-1556742049-0a67c5574f73?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "cat-2",
    name: "رصيد MTN كاش",
    parent: "main",
    desc: "تعبئة وتحويل رصيد MTN كاش",
    image: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "cat-3",
    name: "شحن منصة SuperLive",
    parent: "main",
    desc: "شحن نقاط وعملات سوبر لايف بأفضل الأسعار",
    image: "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "cat-4",
    name: "خدمات أبل وآيكلاود",
    parent: "main",
    desc: "بيع حسابات أبل جاهزة وبطاقات آيتونز",
    image: "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=300&q=80"
  }
];

// تهيئة المنتجات الافتراضية
const initialProducts = [
  {
    id: "prod-1",
    categoryId: "cat-1",
    name: "سيريتل كاش - 50,000 ل.س",
    priceUSD: 3.30,
    priceSYP: 50000,
    desc: "تحويل رصيد سيريتل كاش فوري",
    image: "https://images.unsplash.com/photo-1556742049-0a67c5574f73?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "prod-2",
    categoryId: "cat-3",
    name: "سوبر لايف - 10,000 نقطة",
    priceUSD: 10.00,
    priceSYP: 150000,
    desc: "شحن فوري بالمعرف ID",
    image: "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=300&q=80"
  }
];

// تهيئة طرق الإيداع الافتراضية (بما فيها شام كاش)
const initialDepositMethods = [
  {
    id: "method-1",
    name: "شام كاش دولار",
    account: "b69166fb60e741400cee2b8bd",
    currency: "USD",
    rateToUSD: 1,
    instructions: "يرجى تحويل المبلغ بدقة إلى معرف شام كاش الموضح وإرفاق إشعار الدفع.",
    qrImage: "",
    iconImage: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "method-2",
    name: "شام كاش سوري",
    account: "0999000111",
    currency: "SYP",
    rateToUSD: 15000,
    instructions: "تحويل مباشر بالليرة السورية ثم كتابة رقم الإشعار.",
    qrImage: "",
    iconImage: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=150&q=80"
  }
];

// دوال القراءة والكتابة من التخزين المحلي (LocalStorage)
function getDB(key, fallback) {
  const data = localStorage.getItem("mk_" + key);
  return data ? JSON.parse(data) : fallback;
}

function setDB(key, value) {
  localStorage.setItem("mk_" + key, JSON.stringify(value));
}

// تهيئة البيانات عند فتح الموقع لأول مرة
if (!localStorage.getItem("mk_users")) setDB("users", initialUsers);
if (!localStorage.getItem("mk_categories")) setDB("categories", initialCategories);
if (!localStorage.getItem("mk_products")) setDB("products", initialProducts);
if (!localStorage.getItem("mk_deposit_methods")) setDB("deposit_methods", initialDepositMethods);
if (!localStorage.getItem("mk_deposit_requests")) setDB("deposit_requests", []);
if (!localStorage.getItem("mk_site_settings")) {
  setDB("site_settings", {
    siteName: "Mohannad kard",
    siteLogo: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=100&q=80",
    adText: "أهلاً بكم في متجر Mohannad kard - تسليم فوري وتلقائي لكافة الخدمات الرقمية",
    adActive: true
  });
}
