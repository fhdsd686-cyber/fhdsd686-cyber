/* ==========================================
   لوحة تحكم متجر مهند - admin.js
   ========================================== */

// فتح لوحة التحكم
function openAdminPanel() {
  const panel = document.getElementById("admin-wrapper");
  if (panel) panel.classList.remove("hidden");
  loadAdminStats();
  loadAdminUsers();
  loadAdminProducts();
  loadAdminCategories();
  loadAdminDepositRequests();
  loadAdminDepositMethods();
  loadSiteSettingsIntoForm();
}

// إغلاق لوحة التحكم
function closeAdminPanel() {
  const panel = document.getElementById("admin-wrapper");
  if (panel) panel.classList.add("hidden");
}

// التنقل بين أقسام لوحة التحكم
function switchAdminSection(sectionId) {
  const sections = [
    'sec-stats', 'sec-pricing-offers', 'sec-site-settings', 
    'sec-users', 'sec-upgrade-user', 'sec-products', 
    'sec-import-supplier', 'sec-add-product', 'sec-categories', 
    'sec-add-category', 'sec-deposit-requests', 'sec-deposit-methods', 
    'sec-add-deposit-method'
  ];

  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  const target = document.getElementById(`sec-${sectionId}`);
  if (target) target.classList.remove('hidden');

  // تحديث الزر النشط في القائمة الجانبية للإدارة
  document.querySelectorAll('.admin-nav-item').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
}

// تحميل الإحصائيات العامة
function loadAdminStats() {
  const salesEl = document.getElementById("stat-sales");
  const ordersEl = document.getElementById("stat-orders-count");
  const depositsEl = document.getElementById("stat-total-deposits");

  if (salesEl) salesEl.innerText = "$125.50";
  if (ordersEl) ordersEl.innerText = "18";
  if (depositsEl) depositsEl.innerText = "$340.00";
}

// تحميل إعدادات المتجر الحالية في النموذج
function loadSiteSettingsIntoForm() {
  const nameInput = document.getElementById("setting-site-name");
  const whatsappInput = document.getElementById("setting-whatsapp-number");
  const logoInput = document.getElementById("setting-site-logo");
  const channelInput = document.getElementById("setting-whatsapp-channel");

  if (nameInput) nameInput.value = localStorage.getItem("site_name") || "Mohannad kard";
  if (whatsappInput) whatsappInput.value = localStorage.getItem("site_whatsapp") || "0957455972";
  if (logoInput) logoInput.value = localStorage.getItem("site_logo") || "";
  if (channelInput) channelInput.value = localStorage.getItem("site_whatsapp_channel") || "https://whatsapp.com/channel/";
}

// حفظ إعدادات وهوية المتجر
function handleSiteSettingsUpdate(event) {
  event.preventDefault();
  
  const name = document.getElementById("setting-site-name")?.value.trim();
  const whatsapp = document.getElementById("setting-whatsapp-number")?.value.trim();
  const logo = document.getElementById("setting-site-logo")?.value.trim();
  const channel = document.getElementById("setting-whatsapp-channel")?.value.trim();

  if (name) localStorage.setItem("site_name", name);
  if (whatsapp) localStorage.setItem("site_whatsapp", whatsapp);
  if (logo) localStorage.setItem("site_logo", logo);
  if (channel) localStorage.setItem("site_whatsapp_channel", channel);

  alert("🎉 تم حفظ إعدادات وهوية المتجر ورابط القناة بنجاح!");
}

// تبديل وضع الصيانة
function toggleMaintenanceMode() {
  const btn = document.getElementById("admin-maintenance-btn");
  let isMaint = localStorage.getItem("site_maintenance") === "true";
  isMaint = !isMaint;
  localStorage.setItem("site_maintenance", isMaint);

  if (btn) {
    if (isMaint) {
      btn.style.background = "#ef4444";
      btn.innerHTML = `<i class="fa-solid fa-power-off"></i> وضع الصيانة: مفعل`;
    } else {
      btn.style.background = "#10b981";
      btn.innerHTML = `<i class="fa-solid fa-power-off"></i> وضع الصيانة: معطل`;
    }
  }
}

// إدارة المستخدمين (عرض وهمي أو من الـ DB)
function loadAdminUsers() {
  const container = document.getElementById("admin-users-list");
  if (!container) return;
  container.innerHTML = `
    <table class="data-table">
      <thead><tr><th>المستخدم</th><th>الرصيد</th><th>المستوى</th></tr></thead>
      <tbody>
        <tr><td>الأسطورة (مدير النظام)</td><td>$863.66</td><td><span class="vip-badge-tag">الأسطورة</span></td></tr>
      </tbody>
    </table>
  `;
}

// ترقية مستخدم
function submitUserUpgrade() {
  const username = document.getElementById("upgrade-search-input")?.value;
  const role = document.getElementById("upgrade-role-select")?.value;
  if (!username) {
    alert("يرجى إدخال اسم المستخدم أو البريد!");
    return;
  }
  alert(`✅ تم ترقية المستخدم (${username}) إلى مستوى (${role}) بنجاح!`);
}

// جلب وتحديث جدول المنتجات
function loadAdminProducts() {
  const table = document.getElementById("admin-products-table");
  if (!table) return;
  table.innerHTML = `
    <tr><td>شحن شدات ببجي 60 UC</td><td>شحن ألعاب</td><td>$0.99</td><td><button style="background:#ef4444; color:#fff; border:none; padding:4px 8px; border-radius:6px;">حذف</button></td></tr>
  `;
}

// إدارة الأقسام
function loadAdminCategories() {
  const table = document.getElementById("admin-categories-table");
  if (!table) return;
  table.innerHTML = `
    <tr><td>شحن ألعاب</td><td>رئيسي</td><td><button style="background:#ef4444; color:#fff; border:none; padding:4px 8px; border-radius:6px;">حذف</button></td></tr>
    <tr><td>اتصالات سوريا</td><td>رئيسي</td><td><button style="background:#ef4444; color:#fff; border:none; padding:4px 8px; border-radius:6px;">حذف</button></td></tr>
  `;
}

// إضافة منتج جديد
function handleAddProduct(event) {
  event.preventDefault();
  alert("✅ تم إضافة المنتج بنجاح إلى المتجر!");
  event.target.reset();
}

// إضافة قسم جديد
function handleAddCategory(event) {
  event.preventDefault();
  alert("✅ تم إضافة القسم الجديد بنجاح!");
  event.target.reset();
}

// طلبات الإيداع
function loadAdminDepositRequests() {
  const container = document.getElementById("deposit-requests-container");
  if (!container) return;
  container.innerHTML = `<p style="color:#94a3b8; text-align:center; padding:20px;">لا توجد طلبات إيداع معلقة حالياً.</p>`;
}

// طرق الإيداع في لوحة التحكم
function loadAdminDepositMethods() {
  const container = document.getElementById("admin-methods-container");
  if (!container) return;
  container.innerHTML = `<p style="color:#38bdf8; font-weight:bold;">طرق الإيداع مفعلة وتعمل بنجاح (شام كاش، سيريتل كاش، كود الهدية، وغيرها).</p>`;
}

// إضافة طريقة إيداع جديدة
function handleAddDepositMethod(event) {
  event.preventDefault();
  alert("✅ تم إضافة طريقة الإيداع الجديدة بنجاح!");
  event.target.reset();
}
