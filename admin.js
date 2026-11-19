function renderAdminUsers() {
  const container = document.getElementById("admin-users-list");
  if (!container) return;

  const registry = getDB("cloud_users_registry", {});
  const localUsers = getDB("users", []);
  const combined = { ...registry };

  localUsers.forEach(u => {
    if (u && u.name && u.name !== "زائر") {
      const k = (u.email || u.name).toLowerCase().trim();
      combined[k] = { ...combined[k], ...u };
    }
  });

  const usersList = Object.values(combined);
  if (!usersList.length) {
    container.innerHTML = `<p style="color:#94a3b8;">لا يوجد مستخدمون مسجلون حالياً.</p>`;
    return;
  }

  container.innerHTML = usersList.map(u => {
    const key = (u.email || u.name).toLowerCase().trim();
    const bal = parseFloat(u.balanceUSD || 0).toFixed(3);
    const isMainAdmin = (u.email || "").toLowerCase() === "fhdsd686@gmail.com";

    return `
      <div style="background:#0c1527; padding:12px; border-radius:12px; margin-bottom:10px; border:1px solid rgba(56,189,248,0.2);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <strong>${u.fullname || u.name} (${u.role || "عضو"})</strong>
          <span style="color:#38bdf8; font-weight:800;">$${bal}</span>
        </div>
        <div style="font-size:0.78rem; color:#94a3b8; margin-bottom:8px;">${u.name} | ${u.email || ""} ${u.phone ? `| 📱 ${u.phone}` : ""}</div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button type="button" class="btn-submit" style="width:auto; padding:5px 10px; font-size:0.75rem; margin:0;" onclick="adminAdjustUserBalance('${key}', 1)">+1$</button>
          <button type="button" class="btn-submit" style="width:auto; padding:5px 10px; font-size:0.75rem; margin:0; background:#0284c7;" onclick="adminPromptCustomBalance('${key}')">تعديل الرصيد</button>
          <button type="button" class="btn-submit" style="width:auto; padding:5px 10px; font-size:0.75rem; margin:0; background:${u.isBanned ? '#10b981' : '#f59e0b'};" onclick="adminToggleBanUser('${key}')">${u.isBanned ? 'فك الحظر' : 'حظر'}</button>
          ${!isMainAdmin ? `<button type="button" class="btn-submit" style="width:auto; padding:5px 10px; font-size:0.75rem; margin:0; background:#e11d48;" onclick="adminDeleteUser('${key}')"><i class="fa-solid fa-trash"></i> حذف</button>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

function adminDeleteUser(userKey) {
  const registry = getDB("cloud_users_registry", {});
  const targetUser = registry[userKey];
  const displayName = targetUser?.fullname || targetUser?.name || userKey;

  if (!confirm(`⚠️ هل أنت متأكد من حذف حساب المستخدم (${displayName}) نهائياً؟`)) return;

  // 1. الحذف من سجل السحابة (cloud_users_registry) بكل المفاتيح المطابقة
  const targetEmail = (targetUser?.email || "").toLowerCase().trim();
  const targetName = (targetUser?.name || "").toLowerCase().trim();
  Object.keys(registry).forEach(k => {
    const u = registry[k];
    const kLow = k.toLowerCase().trim();
    if (
      kLow === userKey ||
      (targetEmail && ((u?.email || "").toLowerCase().trim() === targetEmail || kLow === targetEmail)) ||
      (targetName && ((u?.name || "").toLowerCase().trim() === targetName || kLow === targetName))
    ) {
      delete registry[k];
    }
  });
  setDB("cloud_users_registry", registry);

  // 2. الحذف من قائمة المستخدمين المحلية إن وجد
  const localUsers = getDB("users", []);
  const filteredLocal = localUsers.filter(u => {
    if (!u) return false;
    const uKey = (u.email || u.name || "").toLowerCase().trim();
    return uKey !== userKey && (!targetEmail || (u.email || "").toLowerCase().trim() !== targetEmail);
  });
  if (filteredLocal.length !== localUsers.length) {
    setDB("users", filteredLocal);
  }

  renderAdminUsers();
  alert(`✅ تم حذف المستخدم (${displayName}) بنجاح!`);
}
