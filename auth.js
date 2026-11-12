// --- إدارة الحسابات: تسجيل الدخول الحقيقي بحسابات Google عبر Firebase، الاسم/الإيميل، وحساب الآدمن ---

let isSignUpMode = false;

// بيانات الإدارة المعتمدة
const ADMIN_EMAIL = "fhdsd686@gmail.com";
const ADMIN_PASS = "f123456f";

// فحص أمني إجباري عند فتح الموقع
function checkAuthGate() {
  const users = getDB("users", []);
  const hasValidUser = Array.isArray(users) && users.length > 0 && users[0].name && users[0].name !== "زائر";
  
  const authModal = document.getElementById("auth-modal");
  const closeBtn = document.querySelector(".auth-top-close");

  if (!hasValidUser) {
    if (authModal) authModal.classList.remove("hidden");
    if (closeBtn) closeBtn.style.display = "none";
    setAuthMode(false);
  } else {
    if (authModal) authModal.classList.add("hidden");
    if (closeBtn) closeBtn.style.display = "flex";
  }
}

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
  const groupEmail = document.getElementById("group-signup-email");
  const idLabel = document.getElementById("auth-identifier-label");
  const idInput = document.getElementById("auth-identifier");
  const forgotWrap = document.getElementById("forgot-pass-container");

  if (isSignUpMode) {
    if (bannerTitle) bannerTitle.innerText = "حساب جديد";
    if (bannerDesc) bannerDesc.innerText = "انضم إلينا واستمتع بأفضل خدمات الشحن الفوري";
    if (formTitle) formTitle.innerText = "إنشاء حساب";
    if (formSubtitle) formSubtitle.innerText = "أدخل بياناتك لإنشاء حسابك فوراً";
    if (actionBtn) actionBtn.innerText = "إنشاء الحساب";
    if (switchText) switchText.innerText = "لديك حساب بالفعل؟";
    if (switchBtn) switchBtn.innerText = "تسجيل الدخول";
    if (groupName) groupName.classList.remove("hidden");
    if (groupEmail) groupEmail.classList.remove("hidden");
    if (idLabel) idLabel.innerText = "اسم المستخدم";
    if (idInput) idInput.placeholder = "اختر اسم مستخدم";
    if (forgotWrap) forgotWrap.classList.add("hidden");
  } else {
    if (bannerTitle) bannerTitle.innerText = "أهلاً بعودتك";
    if (bannerDesc) bannerDesc.innerText = "سجّل دخولك للوصول إلى حسابك وخدماتك";
    if (formTitle) formTitle.innerText = "تسجيل الدخول";
    if (formSubtitle) formSubtitle.innerText = "مرحباً بك مجدداً!";
    if (actionBtn) actionBtn.innerText = "تسجيل الدخول";
    if (switchText) switchText.innerText = "ليس لديك حساب؟";
    if (switchBtn) switchBtn.innerText = "إنشاء حساب جديد";
    if (groupName) groupName.classList.add("hidden");
    if (groupEmail) groupEmail.classList.add("hidden");
    if (idLabel) idLabel.innerText = "اسم المستخدم أو البريد الإلكتروني";
    if (idInput) idInput.placeholder = "أدخل اسم المستخدم أو الإيميل";
    if (forgotWrap) forgotWrap.classList.remove("hidden");
  }
}

// معالجة نموذج الدخول وإنشاء الحساب التقليدي
function handleAuthSubmit(e) {
  e.preventDefault();

  const identifier = document.getElementById("auth-identifier").value.trim();
  const password = document.getElementById("auth-password").value.trim();
  let users = getDB("users", []);

  if (!Array.isArray(users)) users = [];

  if (isSignUpMode) {
    const fullname = document.getElementById("auth-fullname").value.trim();
    const email = document.getElementById("auth-email").value.trim();

    if (!fullname || !identifier || !password) {
      alert("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    const exists = users.some(u => 
      (u.name && u.name.toLowerCase() === identifier.toLowerCase()) ||
      (email && u.email && u.email.toLowerCase() === email.toLowerCase())
    );
    if (exists) {
      alert("اسم المستخدم أو البريد الإلكتروني مسجل مسبقاً!");
      return;
    }

    const isAdmin = (email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
    const newUser = {
      id: "u_" + Date.now(),
      name: identifier,
      fullname: fullname,
      email: email || "",
      password: password,
      balanceUSD: isAdmin ? 1415.613 : 0.00,
      role: isAdmin ? "الأسطورة" : "VIP 1",
      ordersCount: 0,
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80"
    };

    users.unshift(newUser);
    setDB("users", users);
    
    alert(`🎉 أهلاً بك يا ${fullname}! تم إنشاء حسابك بنجاح.`);
    finishLoginSuccess();
  } else {
    const lowerId = identifier.toLowerCase();

    // التحقق من حساب الآدمن (fhdsd686@gmail.com وكلمة السر f123456f)
    if (lowerId === ADMIN_EMAIL.toLowerCase() || lowerId === "mohannad") {
      if (password !== ADMIN_PASS) {
        alert("❌ كلمة المرور غير صحيحة لحساب الإدارة!");
        return;
      }

      let adminUser = users.find(u => 
        (u.email && u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) || 
        (u.name && u.name.toLowerCase() === "mohannad")
      );

      if (!adminUser) {
        adminUser = {
          id: "u_admin",
          name: "Mohannad",
          fullname: "مهند",
          email: ADMIN_EMAIL,
          password: ADMIN_PASS,
          balanceUSD: 1415.613,
          role: "الأسطورة",
          ordersCount: 0,
          avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80"
        };
        users.unshift(adminUser);
      } else {
        adminUser.role = "الأسطورة";
        adminUser.email = ADMIN_EMAIL;
        const idx = users.indexOf(adminUser);
        if (idx > 0) {
          users.splice(idx, 1);
          users.unshift(adminUser);
        }
      }

      setDB("users", users);
      alert("👑 مرحباً بعودتك يا مهند! تم تفعيل حساب الإدارة ولوحة التحكم.");
      finishLoginSuccess();
      return;
    }

    const user = users.find(u => 
      (u.name && u.name.toLowerCase() === lowerId) ||
      (u.email && u.email.toLowerCase() === lowerId)
    );

    if (!user) {
      alert("الحساب غير مسجل! اضغط على 'إنشاء حساب جديد' أو سجل بحساب Google.");
      return;
    }

    if (user.password && user.password !== password) {
      alert("❌ كلمة المرور غير صحيحة! إذا نسيتها اضغط على 'نسيت كلمة السر؟'");
      return;
    }

    const index = users.indexOf(user);
    if (index > 0) {
      users.splice(index, 1);
      users.unshift(user);
      setDB("users", users);
    }

    alert(`مرحباً بعودتك يا ${user.fullname || user.name}!`);
    finishLoginSuccess();
  }
}

// تسجيل الدخول الحقيقي عبر نافذة حسابات Google في الهاتف (Firebase Google Auth)
function loginWithGoogle() {
  if (typeof firebase === "undefined" || !firebase.auth) {
    alert("جاري تحميل خدمة Google، يرجى المحاولة بعد ثوانٍ...");
    return;
  }

  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  firebase.auth().signInWithPopup(provider)
    .then((result) => {
      const gUser = result.user;
      const email = (gUser.email || "").toLowerCase();
      const displayName = gUser.displayName || email.split("@")[0];
      const photoURL = gUser.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80";

      const isAdmin = (email === ADMIN_EMAIL.toLowerCase());

      let users = getDB("users", []);
      if (!Array.isArray(users)) users = [];

      let existingUser = users.find(u => u.email && u.email.toLowerCase() === email);

      if (existingUser) {
        if (isAdmin) existingUser.role = "الأسطورة";
        existingUser.avatar = photoURL;
        existingUser.fullname = displayName;
        users = users.filter(u => !u.email || u.email.toLowerCase() !== email);
        users.unshift(existingUser);
      } else {
        users.unshift({
          id: "u_" + gUser.uid,
          name: isAdmin ? "Mohannad" : displayName,
          fullname: displayName,
          email: email,
          password: isAdmin ? ADMIN_PASS : "google_auth",
          balanceUSD: isAdmin ? 1415.613 : 0.00,
          role: isAdmin ? "الأسطورة" : "VIP 1",
          ordersCount: 0,
          avatar: photoURL
        });
      }

      setDB("users", users);
      alert(isAdmin 
        ? `👑 أهلاً بك يا مهند! تم الدخول بحساب الإدارة عبر Google.` 
        : `✅ أهلاً بك يا ${displayName}! تم تسجيل الدخول بحساب Google بنجاح.`
      );
      finishLoginSuccess();
    })
    .catch((error) => {
      console.error("Google Auth Error:", error);
      if (error.code === "auth/popup-closed-by-user") {
        return; // أغلق المستخدم النافذة بنفسه
      }
      if (error.code === "auth/unauthorized-domain") {
        alert("⚠️ يجب إضافة رابط الموقع (fhdsd686-cyber.github.io) في قائمة النطاقات المصرح بها (Authorized domains) داخل إعدادات Firebase Authentication.");
        return;
      }
      if (error.code === "auth/operation-not-allowed") {
        alert("⚠️ يجب تفعيل خيار Google في قسم Sign-in method داخل لوحة تحكم Firebase Authentication.");
        return;
      }
      alert("تعذر إتمام الدخول عبر Google: " + error.message);
    });
}

// استعادة / تغيير كلمة السر (نسيت كلمة السر؟)
function handleForgotPassword() {
  const targetInput = prompt("أدخل اسم المستخدم أو البريد الإلكتروني لاستعادة كلمة المرور:");
  if (!targetInput || !targetInput.trim()) return;

  const cleanTarget = targetInput.trim().toLowerCase();

  if (cleanTarget === ADMIN_EMAIL.toLowerCase() || cleanTarget === "mohannad") {
    alert("لحماية حساب الإدارة، يمكنك الدخول مباشرة عبر زر Google بحسابك أو التواصل مع الدعم الفني.");
    return;
  }

  let users = getDB("users", []);
  const user = users.find(u => 
    (u.name && u.name.toLowerCase() === cleanTarget) ||
    (u.email && u.email.toLowerCase() === cleanTarget)
  );

  if (!user) {
    alert("لم يتم العثور على حساب بهذا الاسم أو البريد الإلكتروني!");
    return;
  }

  const newPass = prompt(`تم العثور على الحساب (${user.name}).\nأدخل كلمة المرور الجديدة لحسابك:`);
  if (!newPass || newPass.trim().length < 4) {
    alert("يجب أن تتكون كلمة المرور الجديدة من 4 أحرف على الأقل.");
    return;
  }

  user.password = newPass.trim();
  setDB("users", users);
  alert("✅ تم تحديث كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.");
}

// إغلاق نافذة الدخول وتحديث المتجر
function finishLoginSuccess() {
  const closeBtn = document.querySelector(".auth-top-close");
  if (closeBtn) closeBtn.style.display = "flex";
  const authModal = document.getElementById("auth-modal");
  if (authModal) authModal.classList.add("hidden");

  if (typeof updateUserUI === "function") updateUserUI();
  if (typeof checkMaintenanceGate === "function") checkMaintenanceGate();
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

  // تسجيل الخروج من جلسة Firebase أيضاً إن وجدت
  if (typeof firebase !== "undefined" && firebase.auth) {
    firebase.auth().signOut().catch(() => {});
  }
  
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
