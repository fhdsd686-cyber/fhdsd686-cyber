// --- قاعدة البيانات الأولية المعتمدة لجميع المستخدمين والزوار ---

const DEFAULT_BANNER = "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=600&q=80";

const initialCategories = [
  {
    id: "cat_syriatel",
    name: "رصيد سيريتل كاش",
    parentId: null,
    image: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "cat_mtn",
    name: "رصيد MTN كاش",
    parentId: null,
    image: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "cat_superlive",
    name: "شحن منصة SuperLive",
    parentId: null,
    image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "cat_apple",
    name: "خدمات أبل وآيكلاود",
    parentId: null,
    image: "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "cat_social",
    name: "خدمات السوشال ميديا",
    parentId: null,
    image: "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "cat_cards",
    name: "قسم بطاقات المنصات والمحافظ",
    parentId: null,
    image: "https://images.unsplash.com/photo-1556742049-0a67c5574f73?auto=format&fit=crop&w=300&q=80"
  }
];

const initialProducts = [
  { id: "p1", categoryId: "cat_syriatel", name: "شحن 10,000 ل.س سيريتل", priceUSD: 0.70, priceSYP: 10000 },
  { id: "p2", categoryId: "cat_syriatel", name: "شحن 25,000 ل.س سيريتل", priceUSD: 1.75, priceSYP: 25000 },
  { id: "p3", categoryId: "cat_syriatel", name: "شحن 50,000 ل.س سيريتل", priceUSD: 3.50, priceSYP: 50000 },
  { id: "p4", categoryId: "cat_mtn", name: "شحن 10,000 ل.س MTN", priceUSD: 0.70, priceSYP: 10000 },
  { id: "p5", categoryId: "cat_superlive", name: "1,000 ماسة SuperLive", priceUSD: 1.20, priceSYP: 17000 },
  { id: "p6", categoryId: "cat_apple", name: "بطاقة آيتونز 5$", priceUSD: 5.00, priceSYP: 75000 }
];

// طرق الإيداع الافتراضية (تشمل شام كاش بباركود حسابك الرسمي)
const initialDepositMethods = [
  {
    id: "method_shamcash",
    name: "شام كاش سوري",
    account: "b7a6624b69166fb60e741400cee2b8bd",
    currency: "USD",
    rate: 15000,
    qrImage: "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=b7a6624b69166fb60e741400cee2b8bd",
    icon: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=100&q=80"
  }
];

// دالة آمنة تقرأ البيانات دون أخطاء برمجية
function getDB(key, defaultVal) {
  try {
    const data = localStorage.getItem(key);
    if (!data || data === "undefined" || data === "null") {
      if (key === "categories") return initialCategories;
      if (key === "products") return initialProducts;
      if (key === "depositMethods") return initialDepositMethods;
      return defaultVal;
    }
    const parsed = JSON.parse(data);
    if (key === "categories" && (!Array.isArray(parsed) || parsed.length === 0)) {
      return initialCategories;
    }
    if (key === "products" && (!Array.isArray(parsed) || parsed.length === 0)) {
      return initialProducts;
    }
    if (key === "depositMethods" && (!Array.isArray(parsed) || parsed.length === 0)) {
      return initialDepositMethods;
    }
    return parsed;
  } catch (e) {
    if (key === "categories") return initialCategories;
    if (key === "products") return initialProducts;
    if (key === "depositMethods") return initialDepositMethods;
    return defaultVal;
  }
}

function setDB(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error("Storage error:", e);
  }
}
