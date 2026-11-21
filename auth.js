// --- auth.js (v=161: ربط الحسابات والرصيد لحظياً مع السحابة cloud_users_registry + Google + واتساب) ---

let isSignUpMode = false;

const ADMIN_EMAIL = "fhdsd686@gmail.com";
const ADMIN_PASS = "f123456f";
const ADMIN_WHATSAPP = "963957455972";

// مزامنة وحفظ بيانات المستخدم في السجل السحابي (cloud_users_registry) ليظهر في الإدارة ويتحدث رصيده على جميع الأجهزة
function syncAccountWithCloudRegistry(userObj, isNewRegistration = false) {
  if (!userObj || !userObj.name || userObj.name === "زائر") return userObj;

  const registry = getDB("cloud_users_registry", {});
  const emailKey = (userObj.email || "").toLowerCase().trim();
  const nameKey = (userObj.name || "").toLowerCase().trim();
  const primaryKey = emailKey || nameKey;

  // البحث عن سجل موجود مسبقاً للمستخدم في السحابة
  const existingKey = Object.keys(registry).find(k => {
    const u = registry[k];
    if (!u) return false;
    const kLow = k.toLowerCase().trim();
    const uEmail = (u.email || "").toLowerCase().trim();
    const uName = (u.name || "").toLowerCase().trim();
    return (emailKey && (kLow === emailKey || uEmail === emailKey)) ||
           (nameKey && (kLow === nameKey || uName === nameKey));
  });

  if (existingKey && !isNewRegistration) {
    const cloudUser = registry[existingKey];
    // سحب الرصيد والرتبة وحالة الحظر المعتمدة من السحابة
    userObj.balanceUSD = Number(cloudUser.balanceUSD !== undefined ? cloudUser.balanceUSD : (userObj.balanceUSD || 0));
    if (cloudUser.role) userObj.role = cloudUser.role;
    if (cloudUser.isBanned !== undefined) userObj.isBanned = cloudUser.isBanned;
    if (cloudUser.phone && !userObj.phone) userObj.phone = cloudUser.phone;
    if (cloudUser.whatsapp && !userObj.whatsapp) userObj.whatsapp = cloudUser.whatsapp;

    registry[existingKey] = {
      ...cloudUser,
      name: userObj.name,
      fullname: userObj.fullname || cloudUser.fullname || userObj.name,
      email: userObj.email || cloudUser.email || "",
      phone: userObj.phone || userObj.whatsapp || cloudUser.phone || "",
      whatsapp: userObj.whatsapp || userObj.phone || cloudUser.whatsapp || "",
      password: userObj.password || cloudUser.password || "",
      balanceUSD: userObj.balanceUSD,
      role: userObj.role,
      isBanned: !!userObj.isBanned,
      avatar: userObj.avatar || cloudUser.avatar || ""
    };
  } else {
    registry[primaryKey] = {
      id: userObj.id || ("u_" + Date.now()),
      name: userObj.name,
      fullname: userObj.fullname || userObj.name,
      email: userObj.email || "",
      phone: userObj.phone || userObj.whatsapp || "",
      whatsapp: userObj.whatsapp || userObj.phone || "",
      password: userObj.password || "",
      balanceUSD: Number(userObj.balanceUSD || 0),
      role: userObj.role || "VIP 1",
      isBanned: !!userObj.isBanned,
      avatar: userObj.avatar || ""
    };
  }

  setDB("cloud_users_registry", registry);
  return userObj;
}

// إرسال إشعار واتساب تلقائي عند إنشاء حساب جديد بالموقع
function sendNewAccountWhatsappAlert(userObj, methodLabel) {
  const adminWa = (typeof getAdminWhatsAppNumber === "function") ? getAdminWhatsAppNumber() : ADMIN_WHATSAPP;
  const waMsg = encodeURIComponent(
    `🆕 *تسجيل حساب جديد في متجر Mohannad kard*\n\n` +
    `👤 الاسم: ${userObj.fullname || userObj.name}\n` +
    `🆔 اسم المستخدم: ${userObj.name}\n` +
    `📧 البريد: ${userObj.email || "غير مضاف"}\n` +
    `📱 واتساب العضو: ${userObj.whatsapp || userObj.phone || "غير مضاف"}\n` +
    `🔐 طريقة التسجيل: ${methodLabel}\n` +
    `⏰ الوقت: ${new Date().toLocaleString("ar-SY")}`
  );

  const notifs = getDB("user_notifications", []);
  notifs.unshift({
    id: "notif_" + Date.now(),
    userName: userObj.name,
    userEmail: userObj.email || "",
    title: "🎉 تم إنشاء حسابك بنجاح!",
    message: `أهلاً بك يا ${userObj.fullname || userObj.name} في متجر Mohannad kard. نتمنى لك تجربة مميزة!`,
    date: new Date().toLocaleString("ar-SY"),
    read: false
  });
  setDB("user_notifications", notifs);

  window.open(`https://wa.me/${adminWa}?text=${waMsg}`, "_blank");
}

// التقاط نتيجة تسجيل الدخول عبر Google
document.addEventListener("DOMContentLoaded", () => {
  if (typeof firebase !== "undefined" && firebase.auth) {
    firebase.auth().getRedirectResult()
      .then((result) => {
        if (result && result.user) {
          processGoogleFirebaseUser(result.user, true);
        }
      })
      .catch((err) => {
        console.error("Redirect Auth Error:", err);
      });

    firebase.auth().onAuthStateChanged((gUser) => {
      if (gUser && gUser.email) {
        const users = getDB("users", []);
        const currentLogged = (Array.isArray(users) && users.length > 0 && users[0].name !== "زائر") ? users[0] : null;
        if (!currentLogged) {
          processGoogleFirebaseUser(gUser, false);
        }
      }
    });
  }
});

// معالجة بيانات مستخدم Google ومزامنتها مع السحابة
function processGoogleFirebaseUser(gUser, showAlertMsg = true) {
  const email = (gUser.email || "").toLowerCase().trim();
  const displayName = gUser.displayName || email.split("@")[0];
  const photoURL = gUser.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80";

  const isAdmin = (email === ADMIN_EMAIL.toLowerCase());
  const registry = getDB("cloud_users_registry", {});
  const cloudExisting = Object.values(registry).find(u => u && (u.email || "").toLowerCase().trim() === email);

  let users = getDB("users", []);
  if (!Array.isArray(users)) users = [];

  let existingUser = users.find(u => u.email && u.email.toLowerCase() === email);
  let isBrandNewUser = !existingUser && !cloudExisting;
  let activeUserObj = null;

  if (existingUser || cloudExisting) {
    const base = { ...(cloudExisting || {}), ...(existingUser || {}) };
    if (base.isBanned && !isAdmin) {
      alert("🚫 عذراً، تم حظر حسابك من قبل إدارة المتجر.");
      if (typeof firebase !== "undefined" && firebase.auth) {
        firebase.auth().signOut().catch(() => {});
      }
      return;
    }
    if (isAdmin) base.role = "الأسطورة";
    base.avatar = photoURL;
    base.fullname = displayName;
    base.email = email;
    activeUserObj = syncAccountWithCloudRegistry(base, false);
    users = users.filter(u => !u.email || u.email.toLowerCase() !== email);
    users.unshift(activeUserObj);
  } else {
    activeUserObj = {
      id: "u_" + gUser.uid,
      name: isAdmin ? "Mohannad" : displayName,
      fullname: displayName,
      email: email,
      phone: "",
      whatsapp: "",
      password: isAdmin ? ADMIN_PASS : "google_auth",
      balanceUSD: isAdmin ? 1415.613 : 0.00,
      role: isAdmin ? "الأسطورة" : "VIP 1",
      ordersCount: 0,
      avatar: photoURL
    };
    activeUserObj = syncAccountWithCloudRegistry(activeUserObj, true);
    users.unshift(activeUserObj);
  }

  setDB("users", users);

  if (showAlertMsg) {
    alert(isAdmin 
      ? `👑 أهلاً بك يا مهند! تم الدخول بحساب الإدارة عبر Google.` 
      : `✅ أهلاً بك يا ${displayName}! تم تسجيل الدخول بحساب Google بنجاح.`
    );
  }

  finishLoginSuccess();

  if (isBrandNewUser && !isAdmin && activeUserObj) {
    sendNewAccountWhatsappAlert(activeUserObj, "حساب Google");
  }
}

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
  const groupWhatsapp = document.getElementById("group-signup-whatsapp");
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
    if (groupWhatsapp) groupWhatsapp.classList.remove("hidden");
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
    if (groupWhatsapp) groupWhatsapp.classList.add("hidden");
    if (idLabel) idLabel.innerText = "اسم المستخدم أو البريد الإلكتروني";
    if (idInput) idInput.placeholder = "أدخل اسم المستخدم أو الإيميل";
    if (forgotWrap) forgotWrap.classList.remove("hidden");
  }
}

// معالجة نموذج الدخول وإنشاء الحساب التقليدي مع السحابة
function handleAuthSubmit(e) {
  e.preventDefault();

  const identifier = document.getElementById("auth-identifier").value.trim();
  const password = document.getElementById("auth-password").value.trim();
  let users = getDB("users", []);
  if (!Array.isArray(users)) users = [];

  const registry = getDB("cloud_users_registry", {});
  const allCloudUsers = Object.values(registry);

  if (isSignUpMode) {
    const fullname = document.getElementById("auth-fullname").value.trim();
    const email = document.getElementById("auth-email").value.trim();
    const whatsappInput = document.getElementById("auth-whatsapp");
    const whatsapp = whatsappInput ? whatsappInput.value.trim() : "";

    if (!fullname || !identifier || !password) {
      alert("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    const existsLocal = users.some(u => 
      (u.name && u.name.toLowerCase() === identifier.toLowerCase()) ||
      (email && u.email && u.email.toLowerCase() === email.toLowerCase())
    );
    const existsCloud = allCloudUsers.some(u => 
      u && ((u.name && u.name.toLowerCase() === identifier.toLowerCase()) ||
            (email && u.email && u.email.toLowerCase() === email.toLowerCase()))
    );

    if (existsLocal || existsCloud) {
      alert("اسم المستخدم أو البريد الإلكتروني مسجل مسبقاً!");
      return;
    }

    const isAdmin = (email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
    let newUser = {
      id: "u_" + Date.now(),
      name: identifier,
      fullname: fullname,
      email: email || "",
      phone: whatsapp,
      whatsapp: whatsapp,
      password: password,
      balanceUSD: isAdmin ? 1415.613 : 0.00,
      role: isAdmin ? "الأسطورة" : "VIP 1",
      ordersCount: 0,
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80"
    };

    newUser = syncAccountWithCloudRegistry(newUser, true);
    users.unshift(newUser);
    setDB("users", users);
    
    alert(`🎉 أهلاً بك يا ${fullname}! تم إنشاء حسابك بنجاح.`);
    finishLoginSuccess();

    if (!isAdmin) {
      sendNewAccountWhatsappAlert(newUser, "تسجيل مباشر في الموقع");
    }
  } else {
    const lowerId = identifier.toLowerCase();

    // التحقق من حساب الآدمن
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
      }
      adminUser.role = "الأسطورة";
      adminUser.email = ADMIN_EMAIL;
      adminUser = syncAccountWithCloudRegistry(adminUser, false);

      users = users.filter(u => !(u.email && u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) && !(u.name && u.name.toLowerCase() === "mohannad"));
      users.unshift(adminUser);
      setDB("users", users);

      alert("👑 مرحباً بعودتك يا مهند! تم تفعيل حساب الإدارة ولوحة التحكم.");
      finishLoginSuccess();
      return;
    }

    // البحث في المحلي والسحابة معاً لتمكين الدخول من أي جهاز
    let user = users.find(u => 
      (u.name && u.name.toLowerCase() === lowerId) ||
      (u.email && u.email.toLowerCase() === lowerId)
    ) || allCloudUsers.find(u => 
      u && ((u.name && u.name.toLowerCase() === lowerId) ||
            (u.email && u.email.toLowerCase() === lowerId))
    );

    if (!user) {
      alert("الحساب غير مسجل! اضغط على 'إنشاء حساب جديد' أو سجل بحساب Google.");
      return;
    }

    if (user.isBanned) {
      alert("🚫 عذراً، تم حظر حسابك من قبل إدارة المتجر.");
      return;
    }

    if (user.password && user.password !== password) {
      alert("❌ كلمة المرور غير صحيحة! إذا نسيتها اضغط على 'نسيت كلمة السر؟'");
      return;
    }

    user = syncAccountWithCloudRegistry({ ...user }, false);
    users = users.filter(u => !((u.name && u.name.toLowerCase() === lowerId) || (u.email && u.email.toLowerCase() === lowerId)));
    users.unshift(user);
    setDB("users", users);

    alert(`مرحباً بعودتك يا ${user.fullname || user.name}!`);
    finishLoginSuccess();
  }
}

// تسجيل الدخول عبر Google
function loginWithGoogle() {
  if (typeof firebase === "undefined" || !firebase.auth) {
    alert("جاري تحميل خدمة Google، يرجى المحاولة بعد ثوانٍ...");
    return;
  }

  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  firebase.auth().signInWithPopup(provider)
    .then((result) => {
      if (result && result.user) {
        processGoogleFirebaseUser(result.user, true);
      }
    })
    .catch((error) => {
      console.error("Google Popup Error:", error);
      if (
        error.code === "auth/popup-blocked" ||
        error.code === "auth/popup-closed-by-user" ||
        error.code === "auth/cancelled-popup-request" ||
        error.code === "auth/web-storage-unsupported"
      ) {
        firebase.auth().signInWithRedirect(provider);
        return;
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

// استعادة / تغيير كلمة السر ومزامنتها مع السحابة
function handleForgotPassword() {
  const targetInput = prompt("أدخل اسم المستخدم أو البريد الإلكتروني لاستعادة كلمة المرور:");
  if (!targetInput || !targetInput.trim()) return;

  const cleanTarget = targetInput.trim().toLowerCase();

  if (cleanTarget === ADMIN_EMAIL.toLowerCase() || cleanTarget === "mohannad") {
    alert("لحماية حساب الإدارة، يمكنك الدخول مباشرة عبر زر Google بحسابك أو التواصل مع الدعم الفني.");
    return;
  }

  let users = getDB("users", []);
  const registry = getDB("cloud_users_registry", {});
  const user = users.find(u => 
    (u.name && u.name.toLowerCase() === cleanTarget) ||
    (u.email && u.email.toLowerCase() === cleanTarget)
  ) || Object.values(registry).find(u => 
    u && ((u.name && u.name.toLowerCase() === cleanTarget) ||
          (u.email && u.email.toLowerCase() === cleanTarget))
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
  syncAccountWithCloudRegistry(user, false);
  setDB("users", users);
  alert("✅ تم تحديث كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.");
}

// إغلاق نافذة الدخول وتحديث المتجر
function finishLoginSuccess() {
  const closeBtn = document.querySelector(".auth-top-close");
  if (closeBtn) closeBtn.style.display = "flex";
  const authModal = document.getElementById("auth-modal");
  if (authModal) authModal.classList.add("hidden");

  if (typeof renderCategories === "function") renderCategories();
  if (typeof loadSiteSettings === "function") loadSiteSettings();
  if (typeof updateUserUI === "function") updateUserUI();
  if (typeof checkMaintenanceGate === "function") checkMaintenanceGate();
  if (typeof checkIncomingNotifications === "function") checkIncomingNotifications();
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
