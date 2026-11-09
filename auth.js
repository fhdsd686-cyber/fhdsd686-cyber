// --- إدارة الحسابات، تسجيل الدخول، إنشاء الحساب، وتأكيد الخروج مع نظام القفل الإجباري ---

let isSignUpMode = false;

// فحص أمني إجباري: منع الزائر من رؤية الخدمات قبل تسجيل الدخول أو إنشاء الحساب
function checkAuthGate() {
  const users = getDB("users", []);
  const hasValidUser = Array.isArray(users) && users.length > 0 && users[0].name && users[0].name !== "زائر";
  
  const authModal = document.getElementById("auth-modal");
  const closeBtn = document.querySelector(".auth-top-close");

  if (!hasValidUser) {
    if (authModal) authModal.classList.remove("hidden");
    if (closeBtn) closeBtn.style.display = "none"; // إخفاء زر الإغلاق لإجباره على الدخول
    setAuthMode(false);
  } else {
    if (authModal) authModal.classList.add("hidden");
    if (closeBtn) closeBtn.style.display = "flex";
  }
}

// فتح نافذة الدخول يدوياً
function openAuthModal() {
  const modal = document.getElementById("auth-modal");
  const closeBtn = document.querySelector(".auth-top-close");
  const users = getDB("users", []);
  const hasValidUser = Array.isArray(users) && users.length > 0 && users[0].name && users[0].name !== "زائر";

  if (modal) {
    modal.classList.remove("hidden");
    if (closeBtn) closeBtn.style.display = hasValidUser ? "flex" : "none";
    setAuthMode(false);
  }
}

// محاولة إغلاق نافذة الدخول (ممنوعة إذا لم يكن مسجلاً)
function closeAuthModal() {
  const users = getDB("users", []);
  const hasValidUser = Array.isArray(users) && users.length > 0 && users[0].name && users[0].name !== "زائر";
  
  if (!hasValidUser) {
    alert("يرجى تسجيل الدخول أو إنشاء حساب أولاً للوصول إلى الخدمات والمتجر!");
    return;
  }

  const modal = document.getElementById("auth-modal");
  if (modal) modal.classList.add("hidden");
}

// التبديل بين تسجيل الدخول وإنشاء حساب
function toggleAuthMode() {
  setAuthMode(!isSignUpMode);
}

function setAuthMode(signUp) {
  isSignUpMode = signUp;
  
  const bannerTitle = document.getElementById("auth-banner-title");
  const bannerDesc = document.getElementById("auth-banner-desc");
  const formTitle = document.getElementById("auth-form-title");
  const formSubtitle = document.getElementById("auth-form-subtitle");
  const actionBtn = document.getElementById("auth-action-btn");
  const switchText = document.getElementById("auth-switch-text");
  const switchBtn = document.getElementById("auth-switch-btn");
  const groupName = document.getElementById("group-signup-name");

  if (isSignUpMode) {
    if (bannerTitle) bannerTitle.innerText = "حساب جديد";
    if (bannerDesc) bannerDesc.innerText = "انضم إلينا واستمتع بأفضل خدمات الشحن الفوري";
    if (formTitle) formTitle.innerText = "إنشاء حساب";
    if (formSubtitle) formSubtitle.innerText = "أدخل بياناتك لإنشاء حسابك فوراً";
    if (actionBtn) actionBtn.innerText = "إنشاء الحساب";
    if (switchText) switchText.innerText = "لديك حساب بالفعل؟";
    if (switchBtn) switchBtn.innerText = "تسجيل الدخول";
    if (groupName) groupName.classList.remove("hidden");
  } else {
    if (bannerTitle) bannerTitle.innerText = "أهلاً بعودتك";
    if (bannerDesc) bannerDesc.innerText = "سجّل دخولك للوصول إلى حسابك وخدماتك";
    if (formTitle) formTitle.innerText = "تسجيل الدخول";
    if (formSubtitle) formSubtitle.innerText = "مرحباً بك مجدداً!";
    if (actionBtn) actionBtn.innerText = "تسجيل الدخول";
    if (switchText) switchText.innerText = "ليس لديك حساب؟";
    if (switchBtn) switchBtn.innerText = "إنشاء حساب جديد";
    if (groupName) groupName.classList.add("hidden");
  }
}

// معالجة نموذج الدخول وإنشاء الحساب
function handleAuthSubmit(e) {
  e.preventDefault();

  const identifier = document.getElementById("auth-identifier").value.trim();
  const password = document.getElementById("auth-password").value.trim();
  let users = getDB("users", []);

  if (!Array.isArray(users)) users = [];

  if (isSignUpMode) {
    // 1. إنشاء حساب جديد
    const fullname = document.getElementById("auth-fullname").value.trim();
    if (!fullname || !identifier || !password) {
      alert("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    const exists = users.some(u => u.name && u.name.toLowerCase() === identifier.toLowerCase());
    if (exists) {
      alert("اسم المستخدم هذا مسجل مسبقاً، اختر اسماً آخر");
      return;
    }

    const isMohannad = identifier.toLowerCase() === "mohannad";
    const newUser = {
      id: "u_" + Date.now(),
      name: identifier,
      fullname: fullname,
      password: password,
      balanceUSD: isMohannad ? 1415.613 : 0.00,
      role: isMohannad ? "الأسطورة" : "VIP 1",
      ordersCount: 0,
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80"
    };

    users.unshift(newUser);
    setDB("users", users);
    
    alert(`🎉 أهلاً بك يا ${fullname}! تم إنشاء حسابك بنجاح.`);
    
    const closeBtn = document.querySelector(".auth-top-close");
    if (closeBtn) closeBtn.style.display = "flex";
    const authModal = document.getElementById("auth-modal");
    if (authModal) authModal.classList.add("hidden");
    
    if (typeof updateUserUI === "function") updateUserUI();
  } else {
    // 2. تسجيل الدخول
    if (identifier.toLowerCase() === "mohannad" && !users.some(u => u.name.toLowerCase() === "mohannad")) {
      const adminUser = {
        id: "u_admin",
        name: "Mohannad",
        fullname: "مهند",
        password: password,
        balanceUSD: 1415.613,
        role: "الأسطورة",
        ordersCount: 0,
        avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80"
      };
      users.unshift(adminUser);
      setDB("users", users);
      alert(`مرحباً بعودتك يا Mohannad! تم تفعيل لوحة الإدارة.`);
      
      const closeBtn = document.querySelector(".auth-top-close");
      if (closeBtn) closeBtn.style.display = "flex";
      const authModal = document.getElementById("auth-modal");
      if (authModal) authModal.classList.add("hidden");

      if (typeof updateUserUI === "function") updateUserUI();
      return;
    }

    const user = users.find(u => 
      u.name && u.name.toLowerCase() === identifier.toLowerCase()
    );

    if (!user) {
      alert("اسم المستخدم غير مسجل، اضغط على 'إنشاء حساب جديد' بالأسفل");
      return;
    }

    const index = users.indexOf(user);
    if (index > 0) {
      users.splice(index, 1);
      users.unshift(user);
      setDB("users", users);
    }

    alert(`مرحباً بعودتك يا ${user.name}!`);

    const closeBtn = document.querySelector(".auth-top-close");
    if (closeBtn) closeBtn.style.display = "flex";
    const authModal = document.getElementById("auth-modal");
    if (authModal) authModal.classList.add("hidden");

    if (typeof updateUserUI === "function") updateUserUI();
  }
}

// نافذة تأكيد تسجيل الخروج
function logoutUser() {
  const users = getDB("users", []);
  if (!users || users.length === 0 || !users[0].name || users[0].name === "زائر") {
    openAuthModal();
    return;
  }

  const modal = document.getElementById("logout-confirm-modal");
  if (modal) modal.classList.remove("hidden");
}

function closeLogoutModal() {
  const modal = document.getElementById("logout-confirm-modal");
  if (modal) modal.classList.add("hidden");
}

function confirmLogoutAction() {
  closeLogoutModal();
  
  let users = getDB("users", []);
  if (users.length > 0) {
    const guestUser = { name: "زائر", balanceUSD: 0, role: "عضو", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80" };
    users = users.filter(u => u.name !== "زائر");
    users.unshift(guestUser);
    setDB("users", users);
  }

  if (typeof updateUserUI === "function") updateUserUI();
  if (typeof toggleSidebar === "function") toggleSidebar(false);

  alert("تم تسجيل الخروج بنجاح.");
  checkAuthGate();
}
