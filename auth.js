// --- إدارة المستخدمين وتسجيل الدخول والحماية ---

let isSignUpMode = false;
let currentUser = null;

// فحص الجلسة عند تحميل الصفحة
document.addEventListener("DOMContentLoaded", () => {
  const savedUser = localStorage.getItem("mk_session");
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    applyUserSession();
  } else {
    updateHeaderUI();
  }
});

// فتح نافذة الدخول
function openAuthModal() {
  const modal = document.getElementById("auth-modal");
  if (modal) modal.classList.remove("hidden");
}

// إغلاق نافذة الدخول
function closeAuthModal() {
  const modal = document.getElementById("auth-modal");
  if (modal) modal.classList.add("hidden");
}

// التبديل بين تسجيل الدخول وإنشاء حساب
function toggleAuthMode() {
  isSignUpMode = !isSignUpMode;
  const nameGroup = document.getElementById("group-name");
  const authTitle = document.getElementById("auth-title");
  const submitBtn = document.getElementById("auth-submit-btn");
  const switchText = document.getElementById("auth-switch-text");
  const toggleBtn = document.getElementById("auth-toggle-mode");

  if (isSignUpMode) {
    if (nameGroup) nameGroup.style.display = "block";
    if (authTitle) authTitle.innerText = "إنشاء حساب جديد";
    if (submitBtn) submitBtn.innerText = "إنشاء حساب";
    if (switchText) switchText.innerText = "لديك حساب بالفعل؟";
    if (toggleBtn) toggleBtn.innerText = "تسجيل الدخول";
  } else {
    if (nameGroup) nameGroup.style.display = "none";
    if (authTitle) authTitle.innerText = "تسجيل الدخول";
    if (submitBtn) submitBtn.innerText = "دخول";
    if (switchText) switchText.innerText = "ليس لديك حساب؟";
    if (toggleBtn) toggleBtn.innerText = "إنشاء حساب جديد";
  }
}

// إرسال نموذج تسجيل الدخول أو إنشاء الحساب
function handleAuthSubmit(event) {
  event.preventDefault();

  const identifier = document.getElementById("auth-identifier").value.trim();
  const password = document.getElementById("auth-password").value.trim();
  const users = getDB("users", []);

  if (isSignUpMode) {
    // عملية إنشاء حساب جديد
    const username = document.getElementById("auth-username").value.trim();
    if (!username) {
      alert("يرجى إدخال اسم المستخدم");
      return;
    }

    // التحقق من تكرار البريد أو الاسم
    const exists = users.find(u => u.email.toLowerCase() === identifier.toLowerCase() || u.name.toLowerCase() === username.toLowerCase());
    if (exists) {
      alert("البريد الإلكتروني أو اسم المستخدم مستخدم بالفعل!");
      return;
    }

    const newUser = {
      id: "user-" + Date.now(),
      name: username,
      email: identifier,
      password: password,
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
      role: (identifier.toLowerCase() === ADMIN_EMAIL.toLowerCase()) ? "مدير" : "عميل",
      rank: "مضيف",
      balanceUSD: 0.00,
      balanceSYP: 0,
      ordersCount: 0,
      successPurchases: 0,
      depositsCount: 0,
      totalSuccessfulDepositsUSD: 0.00,
      joinedDate: new Date().toISOString().split("T")[0]
    };

    users.push(newUser);
    setDB("users", users);
    currentUser = newUser;
    localStorage.setItem("mk_session", JSON.stringify(currentUser));
    alert("تم إنشاء الحساب بنجاح!");
  } else {
    // عملية تسجيل الدخول (بالاسم أو البريد)
    const user = users.find(u => 
      (u.email.toLowerCase() === identifier.toLowerCase() || u.name.toLowerCase() === identifier.toLowerCase()) && 
      u.password === password
    );

    if (!user) {
      alert("بيانات الدخول غير صحيحة، يرجى التأكد من البريد/الاسم وكلمة المرور.");
      return;
    }

    currentUser = user;
    localStorage.setItem("mk_session", JSON.stringify(currentUser));
    alert("مرحباً بك مجدداً يا " + currentUser.name);
  }

  closeAuthModal();
  applyUserSession();
}

// تطبيق بيانات المستخدم في الموقع والقائمة الجانبية
function applyUserSession() {
  if (!currentUser) return;

  // تحديث شريط الهيدر
  const headerBtn = document.getElementById("auth-header-btn");
  if (headerBtn) {
    headerBtn.innerHTML = `<i class="fa-solid fa-user-check"></i> ${currentUser.name}`;
    headerBtn.onclick = () => toggleSidebar();
  }

  // تحديث الرصيد
  updateHeaderBalances(currentUser.balanceUSD, currentUser.balanceSYP);

  // تحديث القائمة الجانبية
  const sideName = document.getElementById("side-user-name");
  const sideRank = document.getElementById("side-user-rank");
  const logoutLink = document.getElementById("logout-link");
  const adminLink = document.getElementById("admin-panel-link");

  if (sideName) sideName.innerText = currentUser.name;
  if (sideRank) sideRank.innerText = currentUser.role === "مدير" ? "مدير النظام" : currentUser.rank;
  if (logoutLink) logoutLink.classList.remove("hidden");

  // حماية لوحة الإدارة: تظهر فقط لحسابك المشرف
  if (adminLink) {
    if (currentUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      adminLink.classList.remove("hidden");
    } else {
      adminLink.classList.add("hidden");
    }
  }
}

// تحديث الرصيد في الشريط العلوي
function updateHeaderBalances(usd, syp) {
  const usdEl = document.getElementById("header-balance-usd");
  const sypEl = document.getElementById("header-balance-syp");
  if (usdEl) usdEl.innerText = `$${Number(usd || 0).toFixed(2)}`;
  if (sypEl) sypEl.innerText = `${Number(syp || 0).toLocaleString()} ل.س`;
}

// تحديث واجهة الهيدر في حال الزائر غير مسجل
function updateHeaderUI() {
  const headerBtn = document.getElementById("auth-header-btn");
  if (headerBtn) {
    headerBtn.innerHTML = `<i class="fa-solid fa-user"></i> دخول`;
    headerBtn.onclick = () => openAuthModal();
  }
  updateHeaderBalances(0, 0);
}

// تسجيل الخروج
function logoutUser() {
  localStorage.removeItem("mk_session");
  currentUser = null;
  location.reload();
}
