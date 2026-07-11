/* =========================================================================
   WaBlast — WhatsApp Broadcast SaaS (frontend-only mock)
   Stack: HTML + Tailwind (CDN) + Vanilla JS + Lucide icons
   NOTE: No backend. All data is in-memory. Replace sendBroadcast() with a
         real Meta WhatsApp Cloud API call when the backend is ready.
   ========================================================================= */

/* ------------------------------ Mock data ------------------------------ */

let contacts = [
  { id: 1,  name: "Ali Raza",        phone: "923001234567", group: "VIP Customers", added: "2026-05-02", status: "active" },
  { id: 2,  name: "Sara Khan",       phone: "923019876543", group: "VIP Customers", added: "2026-05-04", status: "active" },
  { id: 3,  name: "Bilal Ahmed",     phone: "923022223344", group: "New Leads",     added: "2026-05-11", status: "active" },
  { id: 4,  name: "Ayesha Malik",    phone: "923033334455", group: "Newsletter",    added: "2026-05-15", status: "active" },
  { id: 5,  name: "Usman Tariq",     phone: "923044445566", group: "New Leads",     added: "2026-05-19", status: "opted-out" },
  { id: 6,  name: "Fatima Noor",     phone: "923055556677", group: "VIP Customers", added: "2026-05-22", status: "active" },
  { id: 7,  name: "Hamza Sheikh",    phone: "923066667788", group: "Newsletter",    added: "2026-06-01", status: "active" },
  { id: 8,  name: "Zainab Iqbal",    phone: "923077778899", group: "New Leads",     added: "2026-06-03", status: "active" },
  { id: 9,  name: "Omar Farooq",     phone: "923088889900", group: "Newsletter",    added: "2026-06-08", status: "active" },
  { id: 10, name: "Hina Aslam",      phone: "923099990011", group: "VIP Customers", added: "2026-06-12", status: "opted-out" },
  { id: 11, name: "Kashif Mehmood",  phone: "923100011122", group: "New Leads",     added: "2026-06-18", status: "active" },
  { id: 12, name: "Rabia Yousuf",    phone: "923111122233", group: "Newsletter",    added: "2026-06-25", status: "active" },
];

let groups = [
  { id: 1, name: "VIP Customers", desc: "High-value repeat buyers",        memberIds: [1, 2, 6, 10], color: "#25D366" },
  { id: 2, name: "New Leads",     desc: "Prospects from the last 30 days", memberIds: [3, 5, 8, 11], color: "#3b82f6" },
  { id: 3, name: "Newsletter",    desc: "Opted-in newsletter subscribers", memberIds: [4, 7, 9, 12], color: "#a855f7" },
];

let campaigns = [
  { id: 1, name: "June Flash Sale",       date: "2026-07-08", group: "VIP Customers", recipients: 4,   delivered: 4,   read: 3,   failed: 0, status: "sent" },
  { id: 2, name: "Welcome Series #1",     date: "2026-07-07", group: "New Leads",     recipients: 4,   delivered: 3,   read: 2,   failed: 1, status: "sent" },
  { id: 3, name: "Weekly Newsletter",     date: "2026-07-05", group: "Newsletter",    recipients: 4,   delivered: 4,   read: 4,   failed: 0, status: "sent" },
  { id: 4, name: "Eid Greetings",         date: "2026-07-12", group: "VIP Customers", recipients: 4,   delivered: 0,   read: 0,   failed: 0, status: "scheduled" },
  { id: 5, name: "Cart Reminder",         date: "2026-07-04", group: "New Leads",     recipients: 4,   delivered: 2,   read: 1,   failed: 2, status: "failed" },
];

let templates = [
  { id: 1, name: "Flash Sale Alert",  body: "Hi {{name}}! Our flash sale is LIVE — up to 40% off for the next 24 hours only. Tap here to shop before it ends.", category: "Marketing" },
  { id: 2, name: "Welcome Message",   body: "Welcome to the family, {{name}}! We're thrilled to have you. Reply MENU to see what we offer.", category: "Onboarding" },
  { id: 3, name: "Order Confirmation",body: "Thanks {{name}}, your order #{{order}} is confirmed and being prepared. We'll notify you when it ships.", category: "Transactional" },
  { id: 4, name: "Feedback Request",  body: "Hi {{name}}, how did we do? We'd love a quick 1-word reply: GREAT, OKAY, or POOR. It really helps us improve.", category: "Engagement" },
];

// 7-day trend (messages sent per day)
const trendData = [
  { day: "Mon", value: 320 },
  { day: "Tue", value: 480 },
  { day: "Wed", value: 410 },
  { day: "Thu", value: 620 },
  { day: "Fri", value: 780 },
  { day: "Sat", value: 540 },
  { day: "Sun", value: 690 },
];

let currentUser = { name: "Jane Cooper", email: "demo@wablast.io" };

/* Compose page working state */
let composeSelectedGroups = new Set();

/* ------------------------------ Helpers ------------------------------ */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function refreshIcons() {
  if (window.lucide) lucide.createIcons();
}

function initials(name) {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function activeContacts() {
  return contacts.filter(c => c.status === "active");
}

function groupMemberCount(g) {
  return g.memberIds.length;
}

function escapeHtml(str = "") {
  return str.replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}

/* ------------------------------ Toasts ------------------------------ */

function toast(message, type = "success") {
  const root = $("#toast-root");
  const config = {
    success: { icon: "check-circle", cls: "text-wa-green", bar: "bg-wa-green" },
    error:   { icon: "x-circle",     cls: "text-red-500",  bar: "bg-red-500" },
    info:    { icon: "info",         cls: "text-blue-500", bar: "bg-blue-500" },
  }[type] || {};

  const el = document.createElement("div");
  el.className = "toast card p-4 flex items-start gap-3 relative overflow-hidden";
  el.innerHTML = `
    <span class="absolute left-0 top-0 bottom-0 w-1 ${config.bar}"></span>
    <i data-lucide="${config.icon}" class="h-5 w-5 ${config.cls} shrink-0 mt-0.5"></i>
    <p class="text-sm text-gray-700 dark:text-gray-200 flex-1">${message}</p>
    <button class="text-gray-400 hover:text-gray-600"><i data-lucide="x" class="h-4 w-4"></i></button>
  `;
  root.appendChild(el);
  refreshIcons();

  const remove = () => { el.style.opacity = "0"; el.style.transform = "translateX(20px)"; el.style.transition = "all .2s"; setTimeout(() => el.remove(), 200); };
  el.querySelector("button").addEventListener("click", remove);
  setTimeout(remove, 4000);
}

/* ------------------------------ Modals ------------------------------ */

function openModal(html, maxWidth = "max-w-lg") {
  const root = $("#modal-root");
  root.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" data-close></div>
      <div class="modal-panel relative card w-full ${maxWidth} max-h-[90vh] overflow-y-auto">${html}</div>
    </div>
  `;
  refreshIcons();
  root.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", closeModal));
}
function closeModal() { $("#modal-root").innerHTML = ""; }
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

/* ========================================================================
   AUTH
   ======================================================================== */

let authMode = "signin"; // or "signup"

function setupAuth() {
  const form = $("#auth-form");
  const switchBtn = $("#auth-switch-btn");

  switchBtn.addEventListener("click", () => {
    authMode = authMode === "signin" ? "signup" : "signin";
    const signup = authMode === "signup";
    $("#auth-heading").textContent = signup ? "Create your account" : "Welcome back";
    $("#auth-sub").textContent = signup ? "Start broadcasting in minutes." : "Sign in to your broadcasting dashboard.";
    $("#auth-submit-label").textContent = signup ? "Create account" : "Sign in";
    $("#auth-switch-text").textContent = signup ? "Already have an account?" : "Don't have an account?";
    switchBtn.textContent = signup ? "Sign in" : "Sign up";
    $("#name-field").classList.toggle("hidden", !signup);
    refreshIcons();
  });

  form.addEventListener("submit", e => {
    e.preventDefault();
    const email = $("#auth-email").value.trim();
    const pass = $("#auth-password").value;
    let ok = true;
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    $("#err-email").classList.toggle("hidden", emailValid);
    if (!emailValid) ok = false;
    const passValid = pass.length >= 6;
    $("#err-pass").classList.toggle("hidden", passValid);
    if (!passValid) ok = false;
    if (!ok) return;

    if (authMode === "signup") {
      const name = $("#auth-name").value.trim() || "New User";
      currentUser = { name, email };
    } else {
      currentUser = { name: "Jane Cooper", email };
    }
    enterApp();
  });

  $("#connect-wa-btn").addEventListener("click", () => {
    toast("WhatsApp Business connection is handled by the backend (Embedded Signup). This is a UI placeholder.", "info");
  });
}

function enterApp() {
  $("#auth-screen").classList.add("hidden");
  $("#app-shell").classList.remove("hidden");
  $("#user-name").textContent = currentUser.name;
  $("#user-email-label").textContent = currentUser.email;
  $("#user-avatar").textContent = initials(currentUser.name);
  navigateTo("dashboard");
  refreshIcons();
}

function setupLogout() {
  $("#logout-btn").addEventListener("click", () => {
    $("#app-shell").classList.add("hidden");
    $("#auth-screen").classList.remove("hidden");
    toast("You've been signed out.", "info");
  });
}

/* ========================================================================
   ROUTER + NAV
   ======================================================================== */

const PAGE_TITLES = {
  dashboard: "Dashboard", contacts: "Contacts", groups: "Groups",
  compose: "Compose", history: "History", templates: "Templates", settings: "Settings",
};

function navigateTo(page) {
  $("#page-title").textContent = PAGE_TITLES[page] || "Dashboard";
  $$("#nav-links .nav-link").forEach(l => l.classList.toggle("active", l.dataset.page === page));

  const content = $("#page-content");
  content.classList.remove("page-enter");
  void content.offsetWidth; // reflow to restart animation
  content.classList.add("page-enter");

  const renderers = {
    dashboard: renderDashboard, contacts: renderContacts, groups: renderGroups,
    compose: renderCompose, history: renderHistory, templates: renderTemplates, settings: renderSettings,
  };
  (renderers[page] || renderDashboard)();
  refreshIcons();
  closeSidebar();
  content.scrollTo?.(0, 0);
}

function setupNav() {
  $$("#nav-links .nav-link").forEach(link => {
    link.addEventListener("click", e => { e.preventDefault(); navigateTo(link.dataset.page); });
  });
  $("#hamburger").addEventListener("click", openSidebar);
  $("#sidebar-backdrop").addEventListener("click", closeSidebar);
}
function openSidebar() {
  $("#sidebar").classList.remove("-translate-x-full");
  $("#sidebar-backdrop").classList.remove("hidden");
}
function closeSidebar() {
  if (window.innerWidth < 1024) {
    $("#sidebar").classList.add("-translate-x-full");
    $("#sidebar-backdrop").classList.add("hidden");
  }
}

/* ========================================================================
   THEME
   ======================================================================== */
function setupTheme() {
  $("#theme-toggle").addEventListener("click", () => {
    document.documentElement.classList.toggle("dark");
    refreshIcons();
  });
}

/* ========================================================================
   PAGE: DASHBOARD
   ======================================================================== */

function statCard({ icon, label, value, sub, tint }) {
  return `
    <div class="card p-5">
      <div class="flex items-start justify-between">
        <div>
          <p class="text-sm text-gray-500 dark:text-gray-400">${label}</p>
          <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">${value}</p>
          <p class="text-xs mt-2 ${sub.up ? 'text-wa-green' : 'text-gray-400'} flex items-center gap-1">
            ${sub.up ? '<i data-lucide="trending-up" class="h-3.5 w-3.5"></i>' : ''}${sub.text}
          </p>
        </div>
        <div class="h-11 w-11 rounded-xl flex items-center justify-center" style="background:${tint}1a;color:${tint}">
          <i data-lucide="${icon}" class="h-5 w-5"></i>
        </div>
      </div>
    </div>`;
}

function trendChart() {
  const max = Math.max(...trendData.map(d => d.value));
  const bars = trendData.map(d => {
    const h = Math.round((d.value / max) * 100);
    return `
      <div class="flex-1 flex flex-col items-center gap-2 group">
        <div class="w-full flex items-end justify-center h-40">
          <div class="w-7 sm:w-9 rounded-t-lg bg-wa-green/80 group-hover:bg-wa-green transition-all relative" style="height:${h}%">
            <span class="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-semibold text-gray-600 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition">${d.value}</span>
          </div>
        </div>
        <span class="text-xs text-gray-400">${d.day}</span>
      </div>`;
  }).join("");
  return `<div class="flex items-end gap-2 sm:gap-4 pt-6">${bars}</div>`;
}

function statusBadge(status) {
  const map = {
    sent:      { cls: "bg-wa-green/10 text-wa-green",   icon: "check",  label: "Sent" },
    scheduled: { cls: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400", icon: "clock", label: "Scheduled" },
    failed:    { cls: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400", icon: "x", label: "Failed" },
  }[status] || { cls: "bg-gray-100 text-gray-500", icon: "circle", label: status };
  return `<span class="badge ${map.cls}"><i data-lucide="${map.icon}" class="h-3 w-3"></i>${map.label}</span>`;
}

function renderDashboard() {
  const totalContacts = contacts.length;
  const sentToday = 690;
  const deliveryRate = "97.4%";

  const recentRows = campaigns.slice(0, 5).map(c => `
    <tr class="data-row border-t border-gray-50 dark:border-gray-800">
      <td class="py-3 px-4 font-medium text-gray-900 dark:text-white">${escapeHtml(c.name)}</td>
      <td class="py-3 px-4 text-sm text-gray-500 hidden sm:table-cell">${c.group}</td>
      <td class="py-3 px-4 text-sm text-gray-500 hidden md:table-cell">${c.date}</td>
      <td class="py-3 px-4">${statusBadge(c.status)}</td>
    </tr>`).join("");

  $("#page-content").innerHTML = `
    <div class="max-w-7xl mx-auto space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">Good to see you, ${escapeHtml(currentUser.name.split(" ")[0])}</h2>
          <p class="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Here's what's happening with your broadcasts.</p>
        </div>
        <button class="btn-primary" onclick="navigateTo('compose')">
          <i data-lucide="plus" class="h-4 w-4"></i> New Broadcast
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        ${statCard({ icon: "users",        label: "Total Contacts",     value: totalContacts,  sub: { up: true, text: "+12 this week" }, tint: "#25D366" })}
        ${statCard({ icon: "users-round",  label: "Total Groups",       value: groups.length,  sub: { up: false, text: "3 active segments" }, tint: "#3b82f6" })}
        ${statCard({ icon: "message-circle",label:"Messages Sent Today", value: sentToday,      sub: { up: true, text: "+18% vs yesterday" }, tint: "#a855f7" })}
        ${statCard({ icon: "check-circle", label: "Delivery Rate",      value: deliveryRate,   sub: { up: true, text: "Above target" }, tint: "#f59e0b" })}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="card p-6 lg:col-span-2">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-semibold text-gray-900 dark:text-white">Messages sent</h3>
              <p class="text-xs text-gray-400">Last 7 days</p>
            </div>
            <span class="text-sm font-semibold text-wa-green">3,840 total</span>
          </div>
          ${trendChart()}
        </div>

        <div class="card p-6">
          <h3 class="font-semibold text-gray-900 dark:text-white mb-4">Quick actions</h3>
          <div class="space-y-2">
            <button class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-left" onclick="navigateTo('compose')">
              <span class="h-9 w-9 rounded-lg bg-wa-green/10 text-wa-green flex items-center justify-center"><i data-lucide="send" class="h-4 w-4"></i></span>
              <span class="text-sm font-medium">Start a broadcast</span>
            </button>
            <button class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-left" onclick="navigateTo('contacts')">
              <span class="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center"><i data-lucide="user-plus" class="h-4 w-4"></i></span>
              <span class="text-sm font-medium">Import contacts</span>
            </button>
            <button class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-left" onclick="navigateTo('groups')">
              <span class="h-9 w-9 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center"><i data-lucide="folder-plus" class="h-4 w-4"></i></span>
              <span class="text-sm font-medium">Create a group</span>
            </button>
            <button class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-left" onclick="navigateTo('templates')">
              <span class="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center"><i data-lucide="file-text" class="h-4 w-4"></i></span>
              <span class="text-sm font-medium">Manage templates</span>
            </button>
          </div>
        </div>
      </div>

      <div class="card overflow-hidden">
        <div class="p-6 pb-4 flex items-center justify-between">
          <h3 class="font-semibold text-gray-900 dark:text-white">Recent campaigns</h3>
          <button class="text-sm text-wa-green font-medium hover:underline" onclick="navigateTo('history')">View all</button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="text-xs uppercase tracking-wide text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                <th class="py-2.5 px-4 font-medium">Campaign</th>
                <th class="py-2.5 px-4 font-medium hidden sm:table-cell">Group</th>
                <th class="py-2.5 px-4 font-medium hidden md:table-cell">Date</th>
                <th class="py-2.5 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>${recentRows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

/* ========================================================================
   PAGE: CONTACTS
   ======================================================================== */

let contactFilter = { search: "", group: "all" };
let selectedContactIds = new Set();

function contactStatusBadge(status) {
  return status === "active"
    ? `<span class="badge bg-wa-green/10 text-wa-green"><i data-lucide="check" class="h-3 w-3"></i>Active</span>`
    : `<span class="badge bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"><i data-lucide="ban" class="h-3 w-3"></i>Opted-out</span>`;
}

function filteredContacts() {
  return contacts.filter(c => {
    const matchSearch = !contactFilter.search ||
      c.name.toLowerCase().includes(contactFilter.search.toLowerCase()) ||
      c.phone.includes(contactFilter.search);
    const matchGroup = contactFilter.group === "all" || c.group === contactFilter.group;
    return matchSearch && matchGroup;
  });
}

function renderContacts() {
  const list = filteredContacts();
  const groupOptions = ['<option value="all">All groups</option>', ...groups.map(g => `<option value="${g.name}">${g.name}</option>`)].join("");

  const rows = list.map(c => `
    <tr class="data-row border-t border-gray-50 dark:border-gray-800">
      <td class="py-3 px-4"><input type="checkbox" class="row-check accent-wa-green h-4 w-4 rounded" data-id="${c.id}" ${selectedContactIds.has(c.id) ? "checked" : ""}></td>
      <td class="py-3 px-4">
        <div class="flex items-center gap-3">
          <div class="h-9 w-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-semibold text-gray-500">${initials(c.name)}</div>
          <span class="font-medium text-gray-900 dark:text-white">${escapeHtml(c.name)}</span>
        </div>
      </td>
      <td class="py-3 px-4 text-sm text-gray-500 font-mono">+${c.phone}</td>
      <td class="py-3 px-4 hidden sm:table-cell"><span class="badge bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">${c.group}</span></td>
      <td class="py-3 px-4 text-sm text-gray-500 hidden md:table-cell">${c.added}</td>
      <td class="py-3 px-4">${contactStatusBadge(c.status)}</td>
    </tr>`).join("");

  $("#page-content").innerHTML = `
    <div class="max-w-7xl mx-auto space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">Contacts</h2>
          <p class="text-gray-500 dark:text-gray-400 text-sm mt-0.5">${contacts.length} contacts · ${activeContacts().length} active</p>
        </div>
        <div class="flex gap-2">
          <button class="btn-secondary" onclick="openImportModal()"><i data-lucide="upload" class="h-4 w-4"></i> Import CSV</button>
          <button class="btn-primary" onclick="openAddContactModal()"><i data-lucide="user-plus" class="h-4 w-4"></i> Add Contact</button>
        </div>
      </div>

      <div class="card overflow-hidden">
        <div class="p-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between border-b border-gray-50 dark:border-gray-800">
          <div class="relative flex-1 max-w-sm">
            <i data-lucide="search" class="h-4 w-4 text-gray-400 absolute left-3 top-2.5"></i>
            <input id="contact-search" class="input-field pl-9 py-2" placeholder="Search name or phone..." value="${escapeHtml(contactFilter.search)}">
          </div>
          <div class="flex items-center gap-2">
            <div id="bulk-bar" class="${selectedContactIds.size ? '' : 'hidden'} flex items-center gap-2">
              <span class="text-sm text-gray-500">${selectedContactIds.size} selected</span>
              <button class="btn-secondary py-2" onclick="openAddToGroupModal()"><i data-lucide="folder-plus" class="h-4 w-4"></i> Add to Group</button>
            </div>
            <select id="contact-group-filter" class="input-field py-2 w-auto">${groupOptions}</select>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="text-xs uppercase tracking-wide text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                <th class="py-2.5 px-4 w-10"><input type="checkbox" id="select-all" class="accent-wa-green h-4 w-4 rounded"></th>
                <th class="py-2.5 px-4 font-medium">Name</th>
                <th class="py-2.5 px-4 font-medium">Phone</th>
                <th class="py-2.5 px-4 font-medium hidden sm:table-cell">Group</th>
                <th class="py-2.5 px-4 font-medium hidden md:table-cell">Added</th>
                <th class="py-2.5 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody id="contacts-tbody">${rows || `<tr><td colspan="6" class="py-12 text-center text-gray-400">No contacts match your filter.</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </div>`;

  // wire up
  $("#contact-search").addEventListener("input", e => { contactFilter.search = e.target.value; rerenderContactRows(); });
  $("#contact-group-filter").value = contactFilter.group;
  $("#contact-group-filter").addEventListener("change", e => { contactFilter.group = e.target.value; rerenderContactRows(); });
  wireContactChecks();
}

function rerenderContactRows() {
  renderContacts();
  refreshIcons();
}

function wireContactChecks() {
  $$(".row-check").forEach(cb => cb.addEventListener("change", e => {
    const id = +e.target.dataset.id;
    e.target.checked ? selectedContactIds.add(id) : selectedContactIds.delete(id);
    updateBulkBar();
  }));
  const selectAll = $("#select-all");
  if (selectAll) {
    selectAll.checked = filteredContacts().every(c => selectedContactIds.has(c.id)) && filteredContacts().length > 0;
    selectAll.addEventListener("change", e => {
      filteredContacts().forEach(c => e.target.checked ? selectedContactIds.add(c.id) : selectedContactIds.delete(c.id));
      rerenderContactRows();
    });
  }
}

function updateBulkBar() {
  const bar = $("#bulk-bar");
  if (!bar) return;
  if (selectedContactIds.size) {
    bar.classList.remove("hidden");
    bar.querySelector("span").textContent = `${selectedContactIds.size} selected`;
  } else {
    bar.classList.add("hidden");
  }
}

function openAddContactModal() {
  openModal(`
    <div class="p-6">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white">Add Contact</h3>
        <button data-close class="text-gray-400 hover:text-gray-600"><i data-lucide="x" class="h-5 w-5"></i></button>
      </div>
      <form id="add-contact-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full name</label>
          <input id="nc-name" class="input-field" placeholder="e.g. Ahmed Khan" required>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone number</label>
          <input id="nc-phone" class="input-field" placeholder="923001234567" required>
          <p class="text-xs text-gray-400 mt-1">Include country code, no + or spaces.</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Group</label>
          <select id="nc-group" class="input-field">${groups.map(g => `<option>${g.name}</option>`).join("")}</select>
        </div>
        <div class="flex gap-3 pt-2">
          <button type="button" data-close class="btn-secondary flex-1 justify-center">Cancel</button>
          <button type="submit" class="btn-primary flex-1 justify-center">Add Contact</button>
        </div>
      </form>
    </div>`);

  $("#add-contact-form").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("#nc-name").value.trim();
    const phone = $("#nc-phone").value.replace(/\D/g, "");
    const groupName = $("#nc-group").value;
    if (!name || phone.length < 10) { toast("Please enter a valid name and phone number.", "error"); return; }
    const id = Math.max(0, ...contacts.map(c => c.id)) + 1;
    contacts.push({ id, name, phone, group: groupName, added: "2026-07-11", status: "active" });
    const g = groups.find(g => g.name === groupName); if (g) g.memberIds.push(id);
    closeModal();
    renderContacts(); refreshIcons();
    toast(`${escapeHtml(name)} added to ${groupName}.`);
  });
}

function openAddToGroupModal() {
  if (!selectedContactIds.size) return;
  openModal(`
    <div class="p-6">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white">Add ${selectedContactIds.size} contacts to group</h3>
        <button data-close class="text-gray-400 hover:text-gray-600"><i data-lucide="x" class="h-5 w-5"></i></button>
      </div>
      <select id="atg-group" class="input-field mb-4">${groups.map(g => `<option value="${g.id}">${g.name}</option>`).join("")}</select>
      <div class="flex gap-3">
        <button data-close class="btn-secondary flex-1 justify-center">Cancel</button>
        <button id="atg-confirm" class="btn-primary flex-1 justify-center">Add to Group</button>
      </div>
    </div>`);
  $("#atg-confirm").addEventListener("click", () => {
    const gid = +$("#atg-group").value;
    const g = groups.find(g => g.id === gid);
    let count = 0;
    selectedContactIds.forEach(id => {
      const c = contacts.find(c => c.id === id);
      if (c) { c.group = g.name; }
      if (g && !g.memberIds.includes(id)) { g.memberIds.push(id); count++; }
    });
    selectedContactIds.clear();
    closeModal();
    renderContacts(); refreshIcons();
    toast(`${count} contacts added to ${g.name}.`);
  });
}

function openImportModal() {
  openModal(`
    <div class="p-6">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white">Import Contacts</h3>
        <button data-close class="text-gray-400 hover:text-gray-600"><i data-lucide="x" class="h-5 w-5"></i></button>
      </div>
      <div id="import-step-1">
        <label class="block border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-wa-green transition">
          <i data-lucide="file-up" class="h-8 w-8 text-gray-400 mx-auto mb-2"></i>
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Click to upload CSV or Excel</p>
          <p class="text-xs text-gray-400 mt-1">Columns: name, phone, group</p>
          <input type="file" id="import-file" accept=".csv,.txt" class="hidden">
        </label>
        <div class="mt-4 rounded-xl bg-gray-50 dark:bg-gray-800 p-3 text-xs text-gray-500">
          <span class="font-semibold">Example CSV:</span><br>
          <code>name,phone,group<br>Ahmed Khan,923001112233,New Leads</code>
        </div>
        <button id="import-sample" class="text-sm text-wa-green font-medium hover:underline mt-3">Or load sample data instead</button>
      </div>
      <div id="import-step-2" class="hidden"></div>
    </div>`, "max-w-2xl");

  $("#import-file").addEventListener("change", handleImportFile);
  $("#import-sample").addEventListener("click", () => {
    const sample = "name,phone,group\nTariq Jameel,923201112233,New Leads\nMaria Butt,923202223344,Newsletter\nSaad Ali,923203334455,VIP Customers";
    showImportPreview(parseCsv(sample));
  });
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => showImportPreview(parseCsv(ev.target.result));
  reader.readAsText(file);
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const cells = line.split(",");
    const obj = {};
    headers.forEach((h, i) => obj[h] = (cells[i] || "").trim());
    return obj;
  }).filter(r => r.name && r.phone);
}

function showImportPreview(rows) {
  $("#import-step-1").classList.add("hidden");
  const step2 = $("#import-step-2");
  step2.classList.remove("hidden");
  const previewRows = rows.slice(0, 8).map(r => `
    <tr class="border-t border-gray-50 dark:border-gray-800">
      <td class="py-2 px-3">${escapeHtml(r.name)}</td>
      <td class="py-2 px-3 font-mono text-xs text-gray-500">${escapeHtml(r.phone)}</td>
      <td class="py-2 px-3 text-gray-500">${escapeHtml(r.group || "Uncategorized")}</td>
    </tr>`).join("");
  step2.innerHTML = `
    <div class="flex items-center gap-2 mb-3 text-sm text-wa-green"><i data-lucide="check-circle" class="h-4 w-4"></i> ${rows.length} valid contacts found</div>
    <div class="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
      <table class="w-full text-left text-sm">
        <thead class="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase text-gray-400 sticky top-0">
          <tr><th class="py-2 px-3">Name</th><th class="py-2 px-3">Phone</th><th class="py-2 px-3">Group</th></tr>
        </thead>
        <tbody>${previewRows}</tbody>
      </table>
    </div>
    ${rows.length > 8 ? `<p class="text-xs text-gray-400 mt-2">+ ${rows.length - 8} more rows…</p>` : ""}
    <div class="flex gap-3 mt-5">
      <button data-close class="btn-secondary flex-1 justify-center">Cancel</button>
      <button id="import-confirm" class="btn-primary flex-1 justify-center">Import ${rows.length} Contacts</button>
    </div>`;
  refreshIcons();
  $("#import-step-2 [data-close]").addEventListener("click", closeModal);
  $("#import-confirm").addEventListener("click", () => {
    let nextId = Math.max(0, ...contacts.map(c => c.id));
    rows.forEach(r => {
      const phone = r.phone.replace(/\D/g, "");
      const groupName = groups.find(g => g.name === r.group) ? r.group : "New Leads";
      const id = ++nextId;
      contacts.push({ id, name: r.name, phone, group: groupName, added: "2026-07-11", status: "active" });
      const g = groups.find(g => g.name === groupName); if (g) g.memberIds.push(id);
    });
    closeModal();
    renderContacts(); refreshIcons();
    toast(`Imported ${rows.length} contacts successfully.`);
  });
}

/* ========================================================================
   PAGE: GROUPS
   ======================================================================== */

function renderGroups() {
  const cards = groups.map(g => `
    <div class="card p-5">
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3">
          <div class="h-11 w-11 rounded-xl flex items-center justify-center" style="background:${g.color}1a;color:${g.color}">
            <i data-lucide="users-round" class="h-5 w-5"></i>
          </div>
          <div>
            <h3 class="font-semibold text-gray-900 dark:text-white">${escapeHtml(g.name)}</h3>
            <p class="text-xs text-gray-400">${groupMemberCount(g)} members</p>
          </div>
        </div>
        <div class="relative">
          <button class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" onclick="deleteGroup(${g.id})" title="Delete group">
            <i data-lucide="trash-2" class="h-4 w-4 text-gray-400 hover:text-red-500"></i>
          </button>
        </div>
      </div>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-3">${escapeHtml(g.desc)}</p>
      <div class="flex -space-x-2 mt-4">
        ${g.memberIds.slice(0, 5).map(id => {
          const c = contacts.find(c => c.id === id);
          return c ? `<div class="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-white dark:border-gray-900 flex items-center justify-center text-[10px] font-semibold text-gray-500">${initials(c.name)}</div>` : "";
        }).join("")}
        ${g.memberIds.length > 5 ? `<div class="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-900 flex items-center justify-center text-[10px] font-semibold text-gray-500">+${g.memberIds.length - 5}</div>` : ""}
      </div>
      <div class="flex gap-2 mt-5">
        <button class="btn-secondary flex-1 justify-center py-2" onclick="viewGroupMembers(${g.id})"><i data-lucide="eye" class="h-4 w-4"></i> View</button>
        <button class="btn-secondary flex-1 justify-center py-2" onclick="composeToGroup(${g.id})"><i data-lucide="send" class="h-4 w-4"></i> Broadcast</button>
      </div>
    </div>`).join("");

  $("#page-content").innerHTML = `
    <div class="max-w-7xl mx-auto space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">Groups &amp; Segments</h2>
          <p class="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Organize contacts into targeted audiences.</p>
        </div>
        <button class="btn-primary" onclick="openCreateGroupModal()"><i data-lucide="plus" class="h-4 w-4"></i> Create Group</button>
      </div>

      <div class="flex gap-2 border-b border-gray-100 dark:border-gray-800">
        <button class="px-4 py-2 text-sm font-semibold text-wa-green border-b-2 border-wa-green">Manual Groups</button>
        <button class="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-600" onclick="openSmartSegmentInfo()">Smart Segments <span class="badge bg-wa-green/10 text-wa-green ml-1">New</span></button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">${cards}</div>
    </div>`;
}

function openSmartSegmentInfo() {
  openModal(`
    <div class="p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><i data-lucide="sparkles" class="h-5 w-5 text-wa-green"></i> Smart Segments</h3>
        <button data-close class="text-gray-400 hover:text-gray-600"><i data-lucide="x" class="h-5 w-5"></i></button>
      </div>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Instead of manually picking contacts, build audiences that update automatically based on behavior:</p>
      <div class="space-y-2">
        ${["Opened last 3 messages","No reply in 30 days","Clicked a link this week","New in the last 7 days"].map(s => `
          <div class="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
            <i data-lucide="filter" class="h-4 w-4 text-wa-green"></i>
            <span class="text-sm font-medium">${s}</span>
          </div>`).join("")}
      </div>
      <p class="text-xs text-gray-400 mt-4">Requires the analytics backend — shown here as a product placeholder.</p>
      <button data-close class="btn-primary w-full justify-center mt-5">Got it</button>
    </div>`);
}

function openCreateGroupModal() {
  const checklist = contacts.map(c => `
    <label class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
      <input type="checkbox" class="cg-member accent-wa-green h-4 w-4 rounded" value="${c.id}">
      <div class="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-semibold text-gray-500">${initials(c.name)}</div>
      <div class="flex-1"><span class="text-sm font-medium">${escapeHtml(c.name)}</span></div>
      <span class="text-xs text-gray-400 font-mono">+${c.phone}</span>
    </label>`).join("");

  openModal(`
    <div class="p-6">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white">Create Group</h3>
        <button data-close class="text-gray-400 hover:text-gray-600"><i data-lucide="x" class="h-5 w-5"></i></button>
      </div>
      <form id="create-group-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Group name</label>
          <input id="cg-name" class="input-field" placeholder="e.g. Black Friday Buyers" required>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <input id="cg-desc" class="input-field" placeholder="Short description">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select members</label>
          <div class="border border-gray-100 dark:border-gray-800 rounded-xl max-h-56 overflow-y-auto p-1">${checklist}</div>
        </div>
        <div class="flex gap-3 pt-1">
          <button type="button" data-close class="btn-secondary flex-1 justify-center">Cancel</button>
          <button type="submit" class="btn-primary flex-1 justify-center">Create Group</button>
        </div>
      </form>
    </div>`, "max-w-lg");

  $("#create-group-form").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("#cg-name").value.trim();
    if (!name) return;
    const memberIds = $$(".cg-member:checked").map(cb => +cb.value);
    const palette = ["#25D366","#3b82f6","#a855f7","#f59e0b","#ef4444","#14b8a6"];
    const id = Math.max(0, ...groups.map(g => g.id)) + 1;
    groups.push({ id, name, desc: $("#cg-desc").value.trim() || "Custom group", memberIds, color: palette[id % palette.length] });
    closeModal();
    renderGroups(); refreshIcons();
    toast(`Group "${escapeHtml(name)}" created with ${memberIds.length} members.`);
  });
}

function deleteGroup(id) {
  const g = groups.find(g => g.id === id);
  openModal(`
    <div class="p-6">
      <div class="h-12 w-12 rounded-full bg-red-100 dark:bg-red-500/15 flex items-center justify-center mb-4">
        <i data-lucide="alert-triangle" class="h-6 w-6 text-red-500"></i>
      </div>
      <h3 class="text-lg font-bold text-gray-900 dark:text-white">Delete "${escapeHtml(g.name)}"?</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">The group will be removed. Contacts themselves are not deleted.</p>
      <div class="flex gap-3 mt-6">
        <button data-close class="btn-secondary flex-1 justify-center">Cancel</button>
        <button id="del-confirm" class="flex-1 justify-center inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-semibold text-sm py-2.5 rounded-xl">Delete</button>
      </div>
    </div>`, "max-w-sm");
  $("#del-confirm").addEventListener("click", () => {
    groups = groups.filter(x => x.id !== id);
    closeModal(); renderGroups(); refreshIcons();
    toast(`Group "${escapeHtml(g.name)}" deleted.`, "info");
  });
}

function viewGroupMembers(id) {
  const g = groups.find(g => g.id === id);
  const members = g.memberIds.map(mid => contacts.find(c => c.id === mid)).filter(Boolean);
  openModal(`
    <div class="p-6">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white">${escapeHtml(g.name)} · ${members.length} members</h3>
        <button data-close class="text-gray-400 hover:text-gray-600"><i data-lucide="x" class="h-5 w-5"></i></button>
      </div>
      <div class="space-y-1 max-h-80 overflow-y-auto">
        ${members.map(c => `
          <div class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
            <div class="h-9 w-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-semibold text-gray-500">${initials(c.name)}</div>
            <div class="flex-1"><div class="text-sm font-medium">${escapeHtml(c.name)}</div><div class="text-xs text-gray-400 font-mono">+${c.phone}</div></div>
            ${contactStatusBadge(c.status)}
          </div>`).join("") || '<p class="text-sm text-gray-400 text-center py-6">No members yet.</p>'}
      </div>
    </div>`);
}

function composeToGroup(id) {
  composeSelectedGroups = new Set([id]);
  navigateTo("compose");
}

/* ========================================================================
   PAGE: COMPOSE (core feature)
   ======================================================================== */

let composeMode = "groups"; // or "contacts"
let composeSelectedContacts = new Set();
let composeScheduled = false;

function composeRecipientCount() {
  if (composeMode === "groups") {
    const ids = new Set();
    composeSelectedGroups.forEach(gid => {
      const g = groups.find(g => g.id === gid);
      g?.memberIds.forEach(mid => {
        const c = contacts.find(c => c.id === mid);
        if (c && c.status === "active") ids.add(mid);
      });
    });
    return ids.size;
  }
  return composeSelectedContacts.size;
}

function renderCompose() {
  const groupChecklist = groups.map(g => `
    <label class="flex items-center gap-3 p-3 rounded-xl border ${composeSelectedGroups.has(g.id) ? 'border-wa-green bg-wa-green/5' : 'border-gray-100 dark:border-gray-800'} cursor-pointer transition">
      <input type="checkbox" class="cmp-group accent-wa-green h-4 w-4 rounded" value="${g.id}" ${composeSelectedGroups.has(g.id) ? "checked" : ""}>
      <div class="h-9 w-9 rounded-lg flex items-center justify-center" style="background:${g.color}1a;color:${g.color}"><i data-lucide="users-round" class="h-4 w-4"></i></div>
      <div class="flex-1"><div class="text-sm font-medium">${escapeHtml(g.name)}</div><div class="text-xs text-gray-400">${groupMemberCount(g)} members</div></div>
    </label>`).join("");

  const contactChecklist = activeContacts().map(c => `
    <label class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
      <input type="checkbox" class="cmp-contact accent-wa-green h-4 w-4 rounded" value="${c.id}" ${composeSelectedContacts.has(c.id) ? "checked" : ""}>
      <div class="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-semibold text-gray-500">${initials(c.name)}</div>
      <div class="flex-1"><span class="text-sm font-medium">${escapeHtml(c.name)}</span></div>
      <span class="text-xs text-gray-400 font-mono">+${c.phone}</span>
    </label>`).join("");

  const templateOptions = ['<option value="">Insert a template…</option>', ...templates.map(t => `<option value="${t.id}">${t.name}</option>`)].join("");

  $("#page-content").innerHTML = `
    <div class="max-w-7xl mx-auto space-y-6">
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">Compose Broadcast</h2>
        <p class="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Write once, reach your entire audience — compliantly.</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <!-- Left: composer -->
        <div class="lg:col-span-3 space-y-6">
          <div class="card p-6">
            <div class="flex items-center justify-between mb-3">
              <label class="text-sm font-semibold text-gray-900 dark:text-white">Message</label>
              <select id="template-select" class="input-field py-1.5 w-auto text-sm">${templateOptions}</select>
            </div>
            <textarea id="compose-message" rows="6" class="input-field resize-none" placeholder="Type your message… Use {{name}} to personalize."></textarea>
            <div class="flex items-center justify-between mt-2">
              <div class="flex items-center gap-2">
                <button class="btn-secondary py-1.5 text-xs" onclick="toast('Attachment upload is UI-only in this demo.', 'info')"><i data-lucide="image" class="h-4 w-4"></i> Image</button>
                <button class="btn-secondary py-1.5 text-xs" onclick="toast('Attachment upload is UI-only in this demo.', 'info')"><i data-lucide="paperclip" class="h-4 w-4"></i> Document</button>
              </div>
              <span id="char-count" class="text-xs text-gray-400">0 characters</span>
            </div>
          </div>

          <div class="card p-6">
            <div class="flex items-center gap-2 mb-4">
              <button id="tab-groups" class="px-3 py-1.5 text-sm font-semibold rounded-lg ${composeMode==='groups' ? 'bg-wa-green/10 text-wa-green' : 'text-gray-400'}" onclick="setComposeMode('groups')">Select Groups</button>
              <button id="tab-contacts" class="px-3 py-1.5 text-sm font-semibold rounded-lg ${composeMode==='contacts' ? 'bg-wa-green/10 text-wa-green' : 'text-gray-400'}" onclick="setComposeMode('contacts')">Individual Contacts</button>
            </div>
            <div id="recipient-groups" class="${composeMode==='groups' ? '' : 'hidden'} grid grid-cols-1 sm:grid-cols-2 gap-2">${groupChecklist}</div>
            <div id="recipient-contacts" class="${composeMode==='contacts' ? '' : 'hidden'}">
              <div class="border border-gray-100 dark:border-gray-800 rounded-xl max-h-64 overflow-y-auto p-1">${contactChecklist}</div>
            </div>
          </div>

          <div class="card p-6">
            <div class="flex flex-col sm:flex-row gap-3">
              <label id="opt-now" class="flex items-center gap-3 flex-1 p-3 rounded-xl border ${!composeScheduled ? 'border-wa-green bg-wa-green/5' : 'border-gray-100 dark:border-gray-800'} cursor-pointer" onclick="setSchedule(false)">
                <i data-lucide="zap" class="h-5 w-5 text-wa-green"></i>
                <div><div class="text-sm font-semibold">Send Now</div><div class="text-xs text-gray-400">Deliver immediately</div></div>
              </label>
              <label id="opt-later" class="flex items-center gap-3 flex-1 p-3 rounded-xl border ${composeScheduled ? 'border-wa-green bg-wa-green/5' : 'border-gray-100 dark:border-gray-800'} cursor-pointer" onclick="setSchedule(true)">
                <i data-lucide="clock" class="h-5 w-5 text-amber-500"></i>
                <div><div class="text-sm font-semibold">Schedule for Later</div><div class="text-xs text-gray-400">Pick a date &amp; time</div></div>
              </label>
            </div>
            <div id="schedule-picker" class="${composeScheduled ? '' : 'hidden'} mt-3 grid grid-cols-2 gap-3">
              <input type="date" id="sched-date" class="input-field" value="2026-07-12">
              <input type="time" id="sched-time" class="input-field" value="10:00">
            </div>

            <div class="flex items-center justify-between mt-5 pt-5 border-t border-gray-50 dark:border-gray-800">
              <div class="flex items-center gap-2 text-sm">
                <i data-lucide="users" class="h-4 w-4 text-wa-green"></i>
                <span class="text-gray-500 dark:text-gray-400">You are about to message</span>
                <span id="recipient-count" class="font-bold text-gray-900 dark:text-white">0</span>
                <span class="text-gray-500 dark:text-gray-400">contacts</span>
              </div>
              <button id="send-broadcast-btn" class="btn-primary" onclick="confirmBroadcast()">
                <i data-lucide="send" class="h-4 w-4"></i> <span id="send-label">Send Broadcast</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Right: live preview -->
        <div class="lg:col-span-2">
          <div class="card overflow-hidden sticky top-24">
            <div class="bg-wa-teal text-white px-4 py-3 flex items-center gap-3">
              <div class="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center"><i data-lucide="megaphone" class="h-4 w-4"></i></div>
              <div><div class="text-sm font-semibold">Your Business</div><div class="text-xs text-white/70">Broadcast preview</div></div>
            </div>
            <div class="wa-chat-bg p-4 min-h-[320px] flex flex-col justify-end">
              <div class="self-end max-w-[85%] bg-wa-bubble text-gray-800 rounded-xl rounded-tr-sm px-3 py-2 shadow-sm">
                <p id="preview-text" class="text-sm whitespace-pre-wrap break-words">Type your message to see the preview…</p>
                <div class="flex items-center justify-end gap-1 mt-1">
                  <span class="text-[10px] text-gray-500">10:24</span>
                  <i data-lucide="check-check" class="h-3.5 w-3.5 text-blue-500"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  // wire
  const msg = $("#compose-message");
  const updatePreview = () => {
    const text = msg.value;
    $("#char-count").textContent = `${text.length} characters`;
    const sample = text.replace(/\{\{name\}\}/g, "Ali").replace(/\{\{\w+\}\}/g, "…");
    $("#preview-text").textContent = sample || "Type your message to see the preview…";
  };
  msg.addEventListener("input", updatePreview);

  $("#template-select").addEventListener("change", e => {
    const t = templates.find(t => t.id === +e.target.value);
    if (t) { msg.value = t.body; updatePreview(); e.target.value = ""; toast(`Template "${t.name}" inserted.`, "info"); }
  });

  $$(".cmp-group").forEach(cb => cb.addEventListener("change", e => {
    const id = +e.target.value;
    e.target.checked ? composeSelectedGroups.add(id) : composeSelectedGroups.delete(id);
    e.target.closest("label").classList.toggle("border-wa-green", e.target.checked);
    e.target.closest("label").classList.toggle("bg-wa-green/5", e.target.checked);
    updateRecipientCount();
  }));
  $$(".cmp-contact").forEach(cb => cb.addEventListener("change", e => {
    const id = +e.target.value;
    e.target.checked ? composeSelectedContacts.add(id) : composeSelectedContacts.delete(id);
    updateRecipientCount();
  }));

  updateRecipientCount();
  refreshIcons();
}

function setComposeMode(mode) {
  composeMode = mode;
  $("#recipient-groups").classList.toggle("hidden", mode !== "groups");
  $("#recipient-contacts").classList.toggle("hidden", mode !== "contacts");
  $("#tab-groups").className = `px-3 py-1.5 text-sm font-semibold rounded-lg ${mode==='groups' ? 'bg-wa-green/10 text-wa-green' : 'text-gray-400'}`;
  $("#tab-contacts").className = `px-3 py-1.5 text-sm font-semibold rounded-lg ${mode==='contacts' ? 'bg-wa-green/10 text-wa-green' : 'text-gray-400'}`;
  updateRecipientCount();
}

function setSchedule(scheduled) {
  composeScheduled = scheduled;
  $("#schedule-picker").classList.toggle("hidden", !scheduled);
  $("#send-label").textContent = scheduled ? "Schedule Broadcast" : "Send Broadcast";
  // Toggle highlight on the two option cards without re-rendering (preserves message text)
  const base = "flex items-center gap-3 flex-1 p-3 rounded-xl border cursor-pointer";
  const on = " border-wa-green bg-wa-green/5";
  const off = " border-gray-100 dark:border-gray-800";
  $("#opt-now").className = base + (scheduled ? off : on);
  $("#opt-later").className = base + (scheduled ? on : off);
}

function updateRecipientCount() {
  const el = $("#recipient-count");
  if (el) el.textContent = composeRecipientCount();
}

function confirmBroadcast() {
  const message = $("#compose-message").value.trim();
  const count = composeRecipientCount();
  if (!message) { toast("Please write a message first.", "error"); return; }
  if (!count) { toast("Please select at least one recipient.", "error"); return; }

  const when = composeScheduled
    ? `on <span class="font-semibold">${$("#sched-date").value} at ${$("#sched-time").value}</span>`
    : `<span class="font-semibold">right now</span>`;

  openModal(`
    <div class="p-6">
      <div class="h-12 w-12 rounded-full bg-wa-green/10 flex items-center justify-center mb-4">
        <i data-lucide="send" class="h-6 w-6 text-wa-green"></i>
      </div>
      <h3 class="text-lg font-bold text-gray-900 dark:text-white">Confirm broadcast</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">This will send your message to <span class="font-semibold text-gray-900 dark:text-white">${count} people</span> ${when}. Are you sure?</p>
      <div class="mt-4 rounded-xl bg-gray-50 dark:bg-gray-800 p-3 text-sm text-gray-600 dark:text-gray-300 max-h-24 overflow-y-auto">${escapeHtml(message).replace(/\n/g,"<br>")}</div>
      <div class="flex gap-3 mt-6">
        <button data-close class="btn-secondary flex-1 justify-center">Cancel</button>
        <button id="confirm-send" class="btn-primary flex-1 justify-center">${composeScheduled ? "Schedule" : "Send Now"}</button>
      </div>
    </div>`);

  $("#confirm-send").addEventListener("click", () => runBroadcast(message, count));
}

async function runBroadcast(message, count) {
  const wasScheduled = composeScheduled;
  const schedDate = wasScheduled ? $("#sched-date").value : "2026-07-11";
  const schedTime = wasScheduled ? $("#sched-time").value : "";
  const groupName = composeMode === "groups"
    ? [...composeSelectedGroups].map(id => groups.find(g => g.id === id)?.name).filter(Boolean).join(", ")
    : "Individual contacts";

  // Progress modal
  openModal(`
    <div class="p-6 text-center">
      <div class="h-12 w-12 rounded-full bg-wa-green/10 flex items-center justify-center mx-auto mb-4">
        <i data-lucide="loader-2" class="h-6 w-6 text-wa-green animate-spin"></i>
      </div>
      <h3 class="text-lg font-bold text-gray-900 dark:text-white">${composeScheduled ? "Scheduling…" : "Sending broadcast…"}</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1"><span id="prog-count">0</span> of ${count} processed</p>
      <div class="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden mt-4">
        <div id="prog-bar" class="h-full bg-wa-green rounded-full transition-all duration-200" style="width:0%"></div>
      </div>
    </div>`, "max-w-sm");
  refreshIcons();

  const result = await sendBroadcast(message, [...composeSelectedGroups], (done) => {
    const pct = Math.round((done / count) * 100);
    const bar = $("#prog-bar"), pc = $("#prog-count");
    if (bar) bar.style.width = pct + "%";
    if (pc) pc.textContent = done;
  }, count);

  // Record campaign
  const id = Math.max(0, ...campaigns.map(c => c.id)) + 1;
  campaigns.unshift({
    id,
    name: message.slice(0, 24) + (message.length > 24 ? "…" : ""),
    date: schedDate,
    group: groupName || "Custom",
    recipients: count,
    delivered: wasScheduled ? 0 : result.delivered,
    read: wasScheduled ? 0 : result.read,
    failed: wasScheduled ? 0 : result.failed,
    status: wasScheduled ? "scheduled" : "sent",
  });

  closeModal();
  // reset compose
  composeSelectedGroups.clear();
  composeSelectedContacts.clear();
  composeScheduled = false;

  if (wasScheduled) {
    toast(`Broadcast scheduled for ${count} contacts on ${schedDate}${schedTime ? " at " + schedTime : ""}.`);
  } else {
    toast(`Message sent to ${result.delivered} of ${count} contacts.`);
  }
  navigateTo("history");
}

/* ---- Mock send function — replace with real backend call later ---- */
async function sendBroadcast(message, groupIds, onProgress, total) {
  // TODO: Replace with a real backend endpoint once the Meta WhatsApp Cloud API is connected.
  // Example real call:
  // const res = await fetch('/api/send-broadcast', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ message, groupIds }),
  // });
  // return res.json();

  console.log("sendBroadcast() → groups:", groupIds, "message:", message);

  // Simulate a rate-limited queue sending one-by-one with delay + progress.
  return new Promise(resolve => {
    let done = 0, delivered = 0, failed = 0;
    const tick = () => {
      done++;
      // ~4% simulated failure rate
      if (Math.random() < 0.04) failed++; else delivered++;
      onProgress(done);
      if (done < total) {
        setTimeout(tick, Math.max(120, 900 / total));
      } else {
        resolve({ delivered, failed, read: Math.round(delivered * 0.75) });
      }
    };
    setTimeout(tick, 200);
  });
}

/* ========================================================================
   PAGE: CAMPAIGN HISTORY
   ======================================================================== */

function renderHistory() {
  const rows = campaigns.map(c => `
    <tr class="data-row border-t border-gray-50 dark:border-gray-800 cursor-pointer" onclick="viewCampaign(${c.id})">
      <td class="py-3 px-4 font-medium text-gray-900 dark:text-white">${escapeHtml(c.name)}</td>
      <td class="py-3 px-4 text-sm text-gray-500 hidden md:table-cell">${c.date}</td>
      <td class="py-3 px-4 text-sm text-gray-500 hidden sm:table-cell">${c.group}</td>
      <td class="py-3 px-4 text-sm text-center">${c.recipients}</td>
      <td class="py-3 px-4 text-sm text-center text-wa-green font-medium">${c.delivered}</td>
      <td class="py-3 px-4 text-sm text-center text-blue-500 font-medium hidden sm:table-cell">${c.read}</td>
      <td class="py-3 px-4 text-sm text-center text-red-500 font-medium">${c.failed}</td>
      <td class="py-3 px-4">${statusBadge(c.status)}</td>
    </tr>`).join("");

  $("#page-content").innerHTML = `
    <div class="max-w-7xl mx-auto space-y-6">
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">Campaign History</h2>
        <p class="text-gray-500 dark:text-gray-400 text-sm mt-0.5">${campaigns.length} campaigns · click a row for details.</p>
      </div>
      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="text-xs uppercase tracking-wide text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                <th class="py-2.5 px-4 font-medium">Campaign</th>
                <th class="py-2.5 px-4 font-medium hidden md:table-cell">Date</th>
                <th class="py-2.5 px-4 font-medium hidden sm:table-cell">Group</th>
                <th class="py-2.5 px-4 font-medium text-center">Recipients</th>
                <th class="py-2.5 px-4 font-medium text-center">Delivered</th>
                <th class="py-2.5 px-4 font-medium text-center hidden sm:table-cell">Read</th>
                <th class="py-2.5 px-4 font-medium text-center">Failed</th>
                <th class="py-2.5 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function viewCampaign(id) {
  const c = campaigns.find(c => c.id === id);
  const deliveredPct = c.recipients ? Math.round((c.delivered / c.recipients) * 100) : 0;
  const readPct = c.recipients ? Math.round((c.read / c.recipients) * 100) : 0;
  const failedPct = c.recipients ? Math.round((c.failed / c.recipients) * 100) : 0;

  // Fabricate per-contact statuses for the detail list
  const sampleContacts = contacts.slice(0, c.recipients);
  const perContact = sampleContacts.map((ct, i) => {
    let st = "read";
    if (i < c.failed) st = "failed";
    else if (i < c.failed + (c.delivered - c.read)) st = "delivered";
    else if (i >= c.delivered) st = "pending";
    const map = {
      read:      { icon: "eye",        cls: "text-blue-500",  label: "Read" },
      delivered: { icon: "check-check",cls: "text-wa-green",  label: "Delivered" },
      failed:    { icon: "x",          cls: "text-red-500",   label: "Failed" },
      pending:   { icon: "clock",      cls: "text-gray-400",  label: "Pending" },
    }[st];
    return `
      <div class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
        <div class="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-semibold text-gray-500">${initials(ct.name)}</div>
        <div class="flex-1"><div class="text-sm font-medium">${escapeHtml(ct.name)}</div><div class="text-xs text-gray-400 font-mono">+${ct.phone}</div></div>
        <span class="badge bg-gray-50 dark:bg-gray-800 ${map.cls}"><i data-lucide="${map.icon}" class="h-3 w-3"></i>${map.label}</span>
      </div>`;
  }).join("");

  openModal(`
    <div class="p-6">
      <div class="flex items-center justify-between mb-1">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white">${escapeHtml(c.name)}</h3>
        <button data-close class="text-gray-400 hover:text-gray-600"><i data-lucide="x" class="h-5 w-5"></i></button>
      </div>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-5">${c.group} · ${c.date} · ${statusBadge(c.status)}</p>

      <div class="grid grid-cols-3 gap-3 mb-5">
        <div class="rounded-xl bg-wa-green/5 p-3 text-center">
          <div class="text-xl font-bold text-wa-green">${c.delivered}</div>
          <div class="text-xs text-gray-400">Delivered (${deliveredPct}%)</div>
        </div>
        <div class="rounded-xl bg-blue-500/5 p-3 text-center">
          <div class="text-xl font-bold text-blue-500">${c.read}</div>
          <div class="text-xs text-gray-400">Read (${readPct}%)</div>
        </div>
        <div class="rounded-xl bg-red-500/5 p-3 text-center">
          <div class="text-xl font-bold text-red-500">${c.failed}</div>
          <div class="text-xs text-gray-400">Failed (${failedPct}%)</div>
        </div>
      </div>

      <div class="mb-5">
        <div class="flex justify-between text-xs text-gray-400 mb-1"><span>Delivery progress</span><span>${deliveredPct}%</span></div>
        <div class="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex">
          <div class="h-full bg-blue-500" style="width:${readPct}%"></div>
          <div class="h-full bg-wa-green" style="width:${deliveredPct - readPct}%"></div>
          <div class="h-full bg-red-500" style="width:${failedPct}%"></div>
        </div>
      </div>

      <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">Per-contact status</h4>
      <div class="space-y-1 max-h-56 overflow-y-auto">${perContact || '<p class="text-sm text-gray-400">No recipient data.</p>'}</div>
    </div>`, "max-w-lg");
}

/* ========================================================================
   PAGE: TEMPLATES
   ======================================================================== */

function renderTemplates() {
  const cards = templates.map(t => `
    <div class="card p-5 flex flex-col">
      <div class="flex items-start justify-between">
        <span class="badge bg-wa-green/10 text-wa-green">${t.category}</span>
        <div class="flex gap-1">
          <button class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" onclick="useTemplate(${t.id})" title="Use in compose"><i data-lucide="send" class="h-4 w-4 text-gray-400 hover:text-wa-green"></i></button>
          <button class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" onclick="deleteTemplate(${t.id})" title="Delete"><i data-lucide="trash-2" class="h-4 w-4 text-gray-400 hover:text-red-500"></i></button>
        </div>
      </div>
      <h3 class="font-semibold text-gray-900 dark:text-white mt-3">${escapeHtml(t.name)}</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 flex-1">${escapeHtml(t.body)}</p>
      <button class="btn-secondary justify-center mt-4 py-2" onclick="useTemplate(${t.id})"><i data-lucide="arrow-up-right" class="h-4 w-4"></i> Use Template</button>
    </div>`).join("");

  $("#page-content").innerHTML = `
    <div class="max-w-7xl mx-auto space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">Message Templates</h2>
          <p class="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Save frequently used messages and reuse them in one click.</p>
        </div>
        <button class="btn-primary" onclick="openTemplateModal()"><i data-lucide="plus" class="h-4 w-4"></i> New Template</button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">${cards}</div>
    </div>`;
}

function openTemplateModal() {
  openModal(`
    <div class="p-6">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white">New Template</h3>
        <button data-close class="text-gray-400 hover:text-gray-600"><i data-lucide="x" class="h-5 w-5"></i></button>
      </div>
      <form id="tpl-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template name</label>
          <input id="tpl-name" class="input-field" placeholder="e.g. Order Shipped" required>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
          <select id="tpl-cat" class="input-field">
            <option>Marketing</option><option>Onboarding</option><option>Transactional</option><option>Engagement</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message body</label>
          <textarea id="tpl-body" rows="4" class="input-field resize-none" placeholder="Hi {{name}}, ..." required></textarea>
          <p class="text-xs text-gray-400 mt-1">Use {{name}} for personalization.</p>
        </div>
        <div class="flex gap-3 pt-1">
          <button type="button" data-close class="btn-secondary flex-1 justify-center">Cancel</button>
          <button type="submit" class="btn-primary flex-1 justify-center">Save Template</button>
        </div>
      </form>
    </div>`);
  $("#tpl-form").addEventListener("submit", e => {
    e.preventDefault();
    const id = Math.max(0, ...templates.map(t => t.id)) + 1;
    templates.push({ id, name: $("#tpl-name").value.trim(), category: $("#tpl-cat").value, body: $("#tpl-body").value.trim() });
    closeModal(); renderTemplates(); refreshIcons();
    toast("Template saved.");
  });
}

function deleteTemplate(id) {
  templates = templates.filter(t => t.id !== id);
  renderTemplates(); refreshIcons();
  toast("Template deleted.", "info");
}

function useTemplate(id) {
  const t = templates.find(t => t.id === id);
  navigateTo("compose");
  setTimeout(() => {
    const msg = $("#compose-message");
    if (msg) {
      msg.value = t.body;
      msg.dispatchEvent(new Event("input"));
      toast(`Template "${t.name}" loaded into composer.`, "info");
    }
  }, 60);
}

/* ========================================================================
   PAGE: SETTINGS
   ======================================================================== */

function renderSettings() {
  const team = [
    { name: currentUser.name, email: currentUser.email, role: "Owner" },
    { name: "Bilal Ahmed", email: "bilal@wablast.io", role: "Admin" },
    { name: "Sara Khan", email: "sara@wablast.io", role: "Editor" },
  ];
  $("#page-content").innerHTML = `
    <div class="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">Settings</h2>
        <p class="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Manage your account, team and WhatsApp connection.</p>
      </div>

      <!-- Connection -->
      <div class="card p-6">
        <h3 class="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><i data-lucide="message-circle" class="h-5 w-5 text-wa-green"></i> WhatsApp Business Connection</h3>
        <div class="flex items-center justify-between p-4 rounded-xl bg-wa-green/5 border border-wa-green/20">
          <div class="flex items-center gap-3">
            <span class="h-2.5 w-2.5 rounded-full bg-wa-green animate-pulse"></span>
            <div>
              <div class="text-sm font-semibold text-gray-900 dark:text-white">Connected</div>
              <div class="text-xs text-gray-400">Business account · +92 300 0000000 · Verified</div>
            </div>
          </div>
          <button class="btn-secondary py-2" onclick="toast('Managed via Meta Embedded Signup on the backend.', 'info')">Manage</button>
        </div>
      </div>

      <!-- Profile -->
      <div class="card p-6">
        <h3 class="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><i data-lucide="user" class="h-5 w-5"></i> Profile</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full name</label><input class="input-field" value="${escapeHtml(currentUser.name)}"></div>
          <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label><input class="input-field" value="${escapeHtml(currentUser.email)}"></div>
        </div>
        <button class="btn-primary mt-4" onclick="toast('Profile saved.')"><i data-lucide="check" class="h-4 w-4"></i> Save changes</button>
      </div>

      <!-- Team -->
      <div class="card p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><i data-lucide="users" class="h-5 w-5"></i> Team members</h3>
          <button class="btn-secondary py-2" onclick="toast('Invite flow is a UI placeholder.', 'info')"><i data-lucide="user-plus" class="h-4 w-4"></i> Invite</button>
        </div>
        <div class="space-y-2">
          ${team.map(m => `
            <div class="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800">
              <div class="h-9 w-9 rounded-full bg-wa-green/15 text-wa-green flex items-center justify-center text-xs font-semibold">${initials(m.name)}</div>
              <div class="flex-1"><div class="text-sm font-medium">${escapeHtml(m.name)}</div><div class="text-xs text-gray-400">${escapeHtml(m.email)}</div></div>
              <span class="badge bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">${m.role}</span>
            </div>`).join("")}
        </div>
      </div>

      <!-- Billing -->
      <div class="card p-6">
        <h3 class="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><i data-lucide="credit-card" class="h-5 w-5"></i> Billing &amp; Usage</h3>
        <div class="flex items-center justify-between mb-4">
          <div>
            <div class="text-sm text-gray-500 dark:text-gray-400">Current plan</div>
            <div class="text-lg font-bold text-gray-900 dark:text-white">Growth · $49/mo</div>
          </div>
          <button class="btn-primary" onclick="toast('Upgrade flow is a UI placeholder.', 'info')">Upgrade</button>
        </div>
        <div class="rounded-xl bg-gray-50 dark:bg-gray-800 p-4">
          <div class="flex justify-between text-sm mb-1"><span class="text-gray-500">Message credits used</span><span class="font-semibold">6,120 / 10,000</span></div>
          <div class="h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden"><div class="h-full bg-wa-green rounded-full" style="width:61%"></div></div>
          <p class="text-xs text-gray-400 mt-2">Resets on 1 Aug 2026.</p>
        </div>
      </div>
    </div>`;
}

/* ========================================================================
   INIT
   ======================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  setupAuth();
  setupLogout();
  setupNav();
  setupTheme();
  refreshIcons();
});

// Expose functions used by inline onclick handlers
window.navigateTo = navigateTo;
window.openAddContactModal = openAddContactModal;
window.openImportModal = openImportModal;
window.openAddToGroupModal = openAddToGroupModal;
window.openCreateGroupModal = openCreateGroupModal;
window.openSmartSegmentInfo = openSmartSegmentInfo;
window.deleteGroup = deleteGroup;
window.viewGroupMembers = viewGroupMembers;
window.composeToGroup = composeToGroup;
window.setComposeMode = setComposeMode;
window.setSchedule = setSchedule;
window.confirmBroadcast = confirmBroadcast;
window.viewCampaign = viewCampaign;
window.openTemplateModal = openTemplateModal;
window.deleteTemplate = deleteTemplate;
window.useTemplate = useTemplate;
window.toast = toast;
