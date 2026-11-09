// --- إدارة الحسابات، تسجيل الدخول، إنشاء الحساب، وتأكيد الخروج ---

let isSignUpMode = false;

// فتح نافذة الدخول
function openAuthModal() {
  const modal = document.getElementById("auth-modal");
  if (modal) {
    modal.classList.remove("hidden");
    setAuthMode(false); // الافتراضي هو تسجيل الدخول
  }
}

// إغلاق نافذة الدخول
function closeAuthModal() {
  const modal = document.getElementById("auth-modal");
  if (modal) modal.classList.add("hidden");
}

// التبديل بين الدخول وإنشاء حساب
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

// معالجة نموذج الدخول / التسجيل
function handleAuthSubmit(e) {
  e.preventDefault();

  const identifier = document.getElementById("auth-identifier").value.trim();
  const password = document.getElementById("auth-password").value.trim();
  const users = getDB("users", []);

  if (isSignUpMode) {
    // إنشاء حساب جديد
    const fullname = document.getElementById("auth-fullname").value.trim();
    if (!fullname || !identifier || !password) {
      alert("يرجى ملء جميع الحقول");
      return;
    }

    const exists = users.some(u => u.name.toLowerCase() === identifier.toLowerCase());
    if (exists) {
      alert("اسم المستخدم هذا مستخدم مسبقاً، يرجى اختيار اسم آخر");
      return;
    }

    const newUser = {
      id: "u_" + Date.now(),
      name: identifier,
      fullname: fullname,
      password: password,
      balanceUSD: 0.00,
      role: "VIP 1",
      ordersCount: 0,
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80"
    };

    users.unshift(newUser);
    setDB("users", users);
    
    alert(`🎉 أهلاً بك يا ${fullname}! تم إنشاء حسابك بنجاح.`);
    closeAuthModal();
    if (typeof updateUserUI === "function") updateUserUI();
  } else {
    // تسجيل الدخول
    const user = users.find(u => 
      (u.name.toLowerCase() === identifier.toLowerCase() || (u.email && u.email.toLowerCase() === identifier.toLowerCase()))
    );

    if (!user) {
      alert("اسم المستخدم غير مسجل، يمكنك الضغط على 'إنشاء حساب جديد'");
      return;
    }

    // نقل المستخدم الحالي ليصبح الأول في المصفوفة
    const index = users.indexOf(user);
    if (index > 0) {
      users.splice(index, 1);
      users.unshift(user);
      setDB("users", users);
    }

    alert(`مرحباً بعودتك يا ${user.name}!`);
    closeAuthModal();
    if (typeof updateUserUI === "function") updateUserUI();
  }
}

// --- نافذة تأكيد الخروج ---
function logoutUser() {
  const modal = document.getElementById("logout-confirm-modal");
  if (modal) modal.classList.remove("hidden");
}

function closeLogoutModal() {
  const modal = document.getElementById("logout-confirm-modal");
  if (modal) modal.classList.add("hidden");
}

function confirmLogoutAction() {
  closeLogoutModal();
  if (typeof toggleSidebar === "function") toggleSidebar(false);
  
  // إعادة تعيين الرصيد أو تصفير الواجهة كزائر
  alert("تم تسجيل الخروج بنجاح.");
  openAuthModal();
}
