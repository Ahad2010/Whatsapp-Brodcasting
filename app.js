/* =========================================================================
   WaBlast — WhatsApp Broadcast SaaS (frontend-only mock)
   Stack: HTML + Tailwind (CDN) + Vanilla JS + Lucide icons
   NOTE: No backend. All data is in-memory. Replace sendBroadcast() with a
         real Meta WhatsApp Cloud API call when the backend is ready.
   ========================================================================= */

/* ------------------------------ Mock data ------------------------------ */

// All app data starts empty and is loaded from the backend (MongoDB) at login.
// Only what the user actually creates (contacts they add) and real broadcasts
// they send are ever stored — no demo/seed data.
let contacts = [];
let groups = [];
let campaigns = [];
let templates = [];

let currentUser = { name: "", email: "" };
let authToken = "";  // JWT from login/signup, attached as a Bearer token on every API call

/* WhatsApp per-message pricing (USD). Editable in Settings → Pricing.
   Real Meta rates vary by category + country; these are editable placeholders. */
let pricing = {
  currency: "USD",
  symbol: "$",
  rates: { Marketing: 0.030, Utility: 0.010, Authentication: 0.015, Service: 0.000 },
};

function messageCost(count, category) {
  const rate = pricing.rates[category] ?? 0;
  return count * rate;
}
function fmtMoney(amount) {
  return pricing.symbol + Number(amount).toFixed(2);
}

/* ---- Persistence: save app data to localStorage so it survives a refresh.
   (The backend SQLite DB is the production store; this keeps the frontend-only
   demo stateful even when the backend isn't running.) ---- */
const STORAGE_KEY = "wablast_state_v1";

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ contacts, groups, campaigns, templates, pricing }));
  } catch (e) { /* storage unavailable (private mode / restricted) — stay in-memory */ }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (Array.isArray(s.contacts))  contacts  = s.contacts;
    if (Array.isArray(s.groups))    groups    = s.groups;
    if (Array.isArray(s.campaigns)) campaigns = s.campaigns;
    if (Array.isArray(s.templates)) templates = s.templates;
    if (s.pricing && s.pricing.rates) pricing = s.pricing;
  } catch (e) { /* corrupt data — ignore and keep seed defaults */ }
}

async function resetData() {
  if (dataSource === "api") { try { await api.post("/api/dev/reset"); } catch (e) {} }
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  location.reload();
}

/* ---- Account (single-user auth). Stored separately from app data so
   "Reset demo data" never deletes the login. Backend auth comes later. ---- */
const ACCOUNT_KEY = "wablast_account";
function getAccount() {
  try { return JSON.parse(localStorage.getItem(ACCOUNT_KEY)); } catch (e) { return null; }
}
function saveAccount(acc) {
  try { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(acc)); } catch (e) {}
}

/* ---- Session: keeps the user logged in across page refreshes.
   Expires after SESSION_TTL (1 day) so a fresh login is only needed
   once a day, not on every reload. ---- */
const SESSION_KEY = "wablast_session";
const SESSION_TTL = 24 * 60 * 60 * 1000; // 1 day in ms

function saveSession(user) {
  try {
    // Persist the JWT alongside the user so a page refresh stays authenticated.
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...user, token: authToken, ts: Date.now() }));
  } catch (e) {}
}
// Returns the saved user if the session is still valid, else null (and clears it).
function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (!s || !s.ts) return null;
    if (Date.now() - s.ts > SESSION_TTL) { clearSession(); return null; }
    return { name: s.name, email: s.email, token: s.token || "" };
  } catch (e) { return null; }
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
}

/* Compose page working state */
let composeSelectedGroups = new Set();
let composeCategory = "Marketing";

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

// Parse pasted phone numbers (one per line / comma / space separated).
// Keeps digits only, requires >=10 digits (country code), de-duplicates.
function parsePastedNumbers(text) {
  const seen = new Set();
  const out = [];
  (text || "").split(/[\s,;]+/).forEach(tok => {
    const digits = tok.replace(/\D/g, "");
    if (digits.length >= 10 && !seen.has(digits)) { seen.add(digits); out.push(digits); }
  });
  return out;
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

// Quick probe so auth can decide DB vs. local without touching the status pill.
async function isBackendReachable() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`${API_BASE}/`, { cache: "no-store", signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch { return false; }
}

// FastAPI returns errors as {"detail": "..."} — pull that out for the toast.
function cleanAuthError(msg = "") {
  try { const d = JSON.parse(msg).detail; if (d) return d; } catch {}
  return msg || "Something went wrong. Please try again.";
}

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

  form.addEventListener("submit", async e => {
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

    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const online = await isBackendReachable();

      if (authMode === "signup") {
        const name = $("#auth-name").value.trim() || "New User";
        if (online) {
          // Save the account in MongoDB via the backend.
          const user = await api.post("/api/auth/signup", { name, email, password: pass });
          authToken = user.access_token || "";
          currentUser = { name: user.name, email: user.email };
          toast("Account created — saved to the database!");
        } else {
          // Backend offline: keep the old local-only behaviour as a fallback.
          saveAccount({ name, email, password: pass });
          currentUser = { name, email };
          toast("Account created locally (backend offline).", "info");
        }
        await enterApp();
      } else {
        // Sign in — only an account that exists in the database can log in.
        if (online) {
          const user = await api.post("/api/auth/login", { email, password: pass });
          authToken = user.access_token || "";
          currentUser = { name: user.name, email: user.email };
          await enterApp();
        } else {
          const acc = getAccount();
          if (!acc) { toast("No account yet. Please sign up first.", "error"); return; }
          if (acc.email.toLowerCase() !== email.toLowerCase() || acc.password !== pass) {
            toast("Incorrect email or password.", "error"); return;
          }
          currentUser = { name: acc.name, email: acc.email };
          await enterApp();
        }
      }
    } catch (err) {
      toast(cleanAuthError(err.message), "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  $("#connect-wa-btn").addEventListener("click", () => {
    toast("WhatsApp Business connection is handled by the backend (Embedded Signup). This is a UI placeholder.", "info");
  });
}

async function enterApp() {
  saveSession(currentUser);   // remember the login so a refresh doesn't kick back to the login page
  $("#auth-screen").classList.add("hidden");
  $("#app-shell").classList.remove("hidden");
  $("#user-name").textContent = currentUser.name;
  $("#user-email-label").textContent = currentUser.email;
  $("#user-avatar").textContent = initials(currentUser.name);
  await bootstrapData();   // load contacts/groups/campaigns/templates from DB (or local)
  navigateTo("dashboard");
  setupAssistant();        // build the AI assistant widget (shown only when the backend is online)
  refreshIcons();
  // Re-check periodically so the badge reflects the backend going up/down, and
  // recover real data if we started offline and the backend later comes online.
  if (backendInterval) clearInterval(backendInterval);
  backendInterval = setInterval(async () => {
    await checkBackend();
    await recoverBackendData();
  }, 8000);
}

/* ---- Backend connection status ---- */
let backendOnline = false;
let backendInterval = null;

async function checkBackend(announce = false) {
  const dot = $("#backend-dot"), label = $("#backend-label"), pill = $("#backend-status");
  if (!pill) return;
  const base = "hidden sm:flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition";
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`${API_BASE}/`, { cache: "no-store", signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error("bad status");
    const data = await res.json();
    backendOnline = true;
    dot.className = "h-2 w-2 rounded-full bg-wa-green animate-pulse";
    pill.className = base + " bg-wa-green/10 text-wa-green";
    label.textContent = `API connected · ${data.mode}`;
    if (announce) toast(`Backend connected at ${API_BASE} (${data.mode} mode).`);
  } catch {
    backendOnline = false;
    dot.className = "h-2 w-2 rounded-full bg-amber-500";
    pill.className = base + " bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400";
    label.textContent = "API offline · local mock";
    if (announce) toast(`Backend not reachable at ${API_BASE}. Using local mock. Start it with: uvicorn main:app --reload`, "error");
  }
}

/* =========================================================================
   DATA LAYER — backend (SQLite) when online, localStorage when offline.
   `dataSource` is decided once at login and drives every mutation.
   ========================================================================= */
let dataSource = "local"; // "api" | "local"
const GROUP_PALETTE = ["#25D366", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444", "#14b8a6"];

// Build request headers, attaching the JWT as a Bearer token when we have one.
function authHeaders(extra) {
  const h = { ...(extra || {}) };
  if (authToken) h["Authorization"] = `Bearer ${authToken}`;
  return h;
}

// A 401 on a protected route means the token is missing/expired — bounce to login.
// (Auth endpoints themselves return 401 for wrong passwords; those are handled inline.)
function handleUnauthorized(path, status) {
  if (status === 401 && !path.startsWith("/api/auth/")) {
    forceLogout("Your session expired. Please sign in again.");
    return true;
  }
  return false;
}

const api = {
  async get(path) {
    const r = await fetch(`${API_BASE}${path}`, { cache: "no-store", headers: authHeaders() });
    if (handleUnauthorized(path, r.status)) throw new Error("Unauthorized");
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(`${API_BASE}${path}`, {
      method: "POST", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(body),
    });
    if (handleUnauthorized(path, r.status)) throw new Error("Unauthorized");
    if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
    return r.status === 204 ? null : r.json();
  },
  async put(path, body) {
    const r = await fetch(`${API_BASE}${path}`, {
      method: "PUT", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(body),
    });
    if (handleUnauthorized(path, r.status)) throw new Error("Unauthorized");
    if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
    return r.status === 204 ? null : r.json();
  },
  async del(path) {
    const r = await fetch(`${API_BASE}${path}`, { method: "DELETE", headers: authHeaders() });
    if (handleUnauthorized(path, r.status)) throw new Error("Unauthorized");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  },
};

// Map backend shapes -> the shapes the render code already expects.
const mapContact  = c => ({ id: c.id, name: c.name, phone: c.phone, status: c.status, added: (c.added || "").slice(0, 10), group: c.group || "Uncategorized" });
const mapGroup    = g => ({ id: g.id, name: g.name, desc: g.description, memberIds: g.member_ids || [], color: GROUP_PALETTE[g.id % GROUP_PALETTE.length] });
const mapCampaign = c => ({ id: c.id, name: c.name, date: c.date, group: c.group, category: c.category, recipients: c.recipients, delivered: c.delivered, read: c.read, failed: c.failed, cost: c.cost, status: c.status });
const mapTemplate = t => ({ id: t.id, name: t.name, body: t.body, category: t.category });

async function reloadContacts()  { contacts  = (await api.get("/api/contacts")).map(mapContact); }
async function reloadGroups()    { groups    = (await api.get("/api/groups")).map(mapGroup); }
async function reloadCampaigns() { campaigns = (await api.get("/api/broadcast/campaigns")).map(mapCampaign); }
async function reloadTemplates() { templates = (await api.get("/api/templates")).map(mapTemplate); }
async function reloadSettings()  {
  const s = await api.get("/api/settings");
  if (s && s.rates) pricing = { currency: s.currency, symbol: s.symbol, rates: s.rates };
}

// Load all data at login from the backend (MongoDB). The backend can be slow to
// answer the first request (e.g. a hosted DB waking up), so retry a few times
// before giving up — this prevents the brief flash of the "offline" empty state.
async function bootstrapData() {
  // The old frontend-only build cached demo contacts/campaigns in localStorage.
  // That stale cache is what used to reappear before the backend connected —
  // drop it so real MongoDB data is the only source of truth.
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}

  for (let attempt = 0; attempt < 4; attempt++) {
    await checkBackend();
    if (backendOnline) {
      try {
        await Promise.all([reloadContacts(), reloadGroups(), reloadCampaigns(), reloadTemplates(), reloadSettings()]);
        dataSource = "api";
        return;
      } catch (e) {
        console.warn("Backend data load failed, retrying:", e);
      }
    }
    await new Promise(r => setTimeout(r, 700)); // brief backoff before retry
  }

  // Truly offline: show an empty app (NOT stale demo data). Real data loads
  // automatically once the backend comes back (see the recovery check below).
  dataSource = "local";
  contacts = []; groups = []; campaigns = []; templates = [];
}

// If we started offline and the backend later comes online, pull real data and
// refresh the view — no manual refresh needed.
async function recoverBackendData() {
  if (dataSource === "api" || !backendOnline) return;
  try {
    await Promise.all([reloadContacts(), reloadGroups(), reloadCampaigns(), reloadTemplates(), reloadSettings()]);
    dataSource = "api";
    navigateTo(currentPage);
    setupAssistant(); // enable the assistant now that the backend is reachable
  } catch (e) { /* stay offline; try again on the next tick */ }
}

// Run a mutation against the backend (with reloads) or locally (with persist).
async function mutate(apiFn, localFn) {
  if (dataSource === "api") {
    try { await apiFn(); }
    catch (e) { toast(`Backend error: ${e.message}`, "error"); return false; }
  } else {
    localFn();
    persist();
  }
  return true;
}

// Return to the login screen and forget the token/session. Shared by the
// logout button and the automatic 401 handler.
function forceLogout(message) {
  clearSession();
  authToken = "";
  $("#app-shell").classList.add("hidden");
  $("#auth-screen").classList.remove("hidden");
  closeAssistant();
  if (backendInterval) { clearInterval(backendInterval); backendInterval = null; }
  if (message) toast(message, "error");
}

function setupLogout() {
  $("#logout-btn").addEventListener("click", () => {
    forceLogout();
    toast("You've been signed out.", "info");
  });
}

/* ========================================================================
   AI ASSISTANT (Groq-powered) — chat that guides you and performs actions.
   Broadcasts are only *prepared*; you confirm before anything is sent.
   ======================================================================== */

let assistantEnabled = false;
let assistantOpen = false;
let assistantBusy = false;
let assistantHistory = [];        // raw OpenAI-format messages replayed to the backend
let assistantDisplay = [];        // { role, text } shown in the panel
let pendingBroadcast = null;      // draft awaiting user confirmation

async function setupAssistant() {
  const root = $("#assistant-root");
  if (!root) return;
  root.innerHTML = `
    <button id="assistant-launcher" title="AI Assistant"
      class="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-wa-green text-white shadow-lg shadow-wa-green/30 flex items-center justify-center hover:scale-105 transition">
      <i data-lucide="sparkles" class="h-6 w-6"></i>
    </button>
    <div id="assistant-panel" class="hidden fixed bottom-24 right-6 z-40 w-[22rem] max-w-[calc(100vw-2rem)] h-[32rem] max-h-[calc(100vh-8rem)] flex flex-col card overflow-hidden">
      <div class="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-wa-green/5">
        <div class="flex items-center gap-2">
          <span class="h-8 w-8 rounded-lg bg-wa-green/15 text-wa-green flex items-center justify-center"><i data-lucide="sparkles" class="h-4 w-4"></i></span>
          <div>
            <p class="text-sm font-semibold text-gray-900 dark:text-white">AI Assistant</p>
            <p class="text-[11px] text-gray-400">Ask me to add contacts, make groups, or draft a broadcast</p>
          </div>
        </div>
        <button id="assistant-close" class="text-gray-400 hover:text-gray-600"><i data-lucide="x" class="h-5 w-5"></i></button>
      </div>
      <div id="assistant-messages" class="flex-1 overflow-y-auto p-4 space-y-3 text-sm"></div>
      <div id="assistant-pending" class="px-4"></div>
      <form id="assistant-form" class="p-3 border-t border-gray-100 dark:border-gray-800 flex items-end gap-2">
        <textarea id="assistant-input" rows="1" placeholder="Type a message…"
          class="input-field py-2 resize-none flex-1 max-h-24"></textarea>
        <button type="submit" class="btn-primary px-3 py-2 shrink-0"><i data-lucide="send" class="h-4 w-4"></i></button>
      </form>
    </div>`;
  refreshIcons();

  $("#assistant-launcher").addEventListener("click", toggleAssistant);
  $("#assistant-close").addEventListener("click", closeAssistant);
  $("#assistant-form").addEventListener("submit", e => { e.preventDefault(); sendAssistantMessage(); });
  const input = $("#assistant-input");
  input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 96) + "px"; });
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAssistantMessage(); }
  });

  // Only offer the assistant if the backend has it configured (Groq key set).
  try {
    const s = await api.get("/api/assistant/status");
    assistantEnabled = !!s.enabled;
  } catch { assistantEnabled = false; }
  $("#assistant-launcher").classList.toggle("hidden", dataSource !== "api");

  if (!assistantDisplay.length) {
    assistantDisplay.push({
      role: "assistant",
      text: assistantEnabled
        ? "Hi! I can add contacts, create groups & templates, and prepare broadcasts for you. Try: “Add Ahmed 923001234567 to VIP”."
        : "The assistant isn't set up yet. Add a free Groq API key (GROQ_API_KEY) in backend/.env to enable me.",
    });
  }
  renderAssistantMessages();
}

function toggleAssistant() { assistantOpen ? closeAssistant() : openAssistant(); }
function openAssistant() {
  assistantOpen = true;
  $("#assistant-panel")?.classList.remove("hidden");
  refreshIcons();
  $("#assistant-input")?.focus();
}
function closeAssistant() {
  assistantOpen = false;
  $("#assistant-panel")?.classList.add("hidden");
}

function renderAssistantMessages() {
  const box = $("#assistant-messages");
  if (!box) return;
  box.innerHTML = assistantDisplay.map(m => m.role === "user"
    ? `<div class="flex justify-end"><div class="bg-wa-green text-white rounded-2xl rounded-br-sm px-3 py-2 max-w-[85%] whitespace-pre-wrap">${escapeHtml(m.text)}</div></div>`
    : `<div class="flex justify-start"><div class="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-2xl rounded-bl-sm px-3 py-2 max-w-[85%] whitespace-pre-wrap">${escapeHtml(m.text)}</div></div>`
  ).join("") + (assistantBusy
    ? `<div class="flex justify-start"><div class="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-sm px-3 py-2 text-gray-400">…thinking</div></div>`
    : "");
  box.scrollTop = box.scrollHeight;
}

function renderPendingBroadcast() {
  const box = $("#assistant-pending");
  if (!box) return;
  if (!pendingBroadcast) { box.innerHTML = ""; return; }
  const p = pendingBroadcast;
  box.innerHTML = `
    <div class="rounded-xl border border-wa-green/40 bg-wa-green/5 p-3 mb-2 text-sm">
      <p class="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5"><i data-lucide="send" class="h-4 w-4 text-wa-green"></i> Confirm broadcast</p>
      <p class="text-gray-600 dark:text-gray-300 mt-1">To <b>${escapeHtml(String(p.recipient_count))}</b> recipient(s) · ${escapeHtml(p.target || "")}</p>
      <p class="text-gray-500 mt-1 italic line-clamp-3">“${escapeHtml(p.message)}”</p>
      <div class="flex gap-2 mt-2">
        <button id="pb-cancel" class="btn-secondary flex-1 justify-center py-1.5 text-xs">Cancel</button>
        <button id="pb-send" class="btn-primary flex-1 justify-center py-1.5 text-xs">Send now</button>
      </div>
    </div>`;
  refreshIcons();
  $("#pb-cancel").addEventListener("click", () => { pendingBroadcast = null; renderPendingBroadcast(); });
  $("#pb-send").addEventListener("click", confirmPendingBroadcast);
}

async function confirmPendingBroadcast() {
  if (!pendingBroadcast) return;
  const p = pendingBroadcast;
  const btn = $("#pb-send");
  if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
  try {
    const res = await api.post("/api/broadcast/send", {
      message: p.message, group_ids: p.group_ids || [], phones: p.phones || [], category: p.category || "Marketing",
    });
    pendingBroadcast = null;
    renderPendingBroadcast();
    if (res.delivered === 0 && res.error) {
      toast(`Send failed: ${res.error}`, "error");
      assistantDisplay.push({ role: "assistant", text: `⚠️ Couldn't send: ${res.error}` });
    } else {
      toast(`Broadcast sent — ${res.delivered} delivered, ${res.failed} failed.`, res.delivered ? "success" : "error");
      assistantDisplay.push({ role: "assistant", text: `✅ Sent to ${res.delivered} recipient(s). You can see it in History.` });
    }
    renderAssistantMessages();
    await refreshAfterAssistant();
  } catch (e) {
    toast(`Could not send: ${e.message}`, "error");
    if (btn) { btn.disabled = false; btn.textContent = "Send now"; }
  }
}

// Re-pull data from the backend and re-render the current page after the
// assistant changes something (added a contact, created a group, sent a broadcast).
async function refreshAfterAssistant() {
  if (dataSource !== "api") return;
  try {
    await Promise.all([reloadContacts(), reloadGroups(), reloadCampaigns(), reloadTemplates(), reloadSettings()]);
    navigateTo(currentPage);
  } catch (e) { /* leave the view as-is if a reload fails */ }
}

async function sendAssistantMessage() {
  const input = $("#assistant-input");
  const text = (input?.value || "").trim();
  if (!text || assistantBusy) return;
  if (!assistantEnabled) {
    toast("Add a Groq API key (GROQ_API_KEY) in backend/.env to enable the assistant.", "error");
    return;
  }
  input.value = ""; input.style.height = "auto";
  assistantDisplay.push({ role: "user", text });
  assistantBusy = true;
  renderAssistantMessages();
  try {
    const res = await api.post("/api/assistant/chat", { message: text, history: assistantHistory });
    assistantHistory = res.history || assistantHistory;
    assistantDisplay.push({ role: "assistant", text: res.reply || "Done." });
    pendingBroadcast = res.pending_broadcast || null;
    await refreshAfterAssistant();
  } catch (e) {
    assistantDisplay.push({ role: "assistant", text: `⚠️ ${cleanAuthError(e.message)}` });
  } finally {
    assistantBusy = false;
    renderAssistantMessages();
    renderPendingBroadcast();
  }
}

/* ========================================================================
   ROUTER + NAV
   ======================================================================== */

const PAGE_TITLES = {
  dashboard: "Dashboard", contacts: "Contacts", groups: "Groups",
  compose: "Compose", history: "History", templates: "Templates", settings: "Settings",
};

let currentPage = "dashboard";

function navigateTo(page) {
  currentPage = page;
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
  updateCreditsWidget();
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

// ----- Message credits widget (sidebar + Settings billing) -----
// Credits reflect ONLY messages actually sent — one credit per recipient a
// broadcast went out to, summed across every campaign. No mock numbers.
const CREDIT_QUOTA = 10000;

function messagesSentTotal() {
  return campaigns.reduce((s, c) => s + (c.recipients || 0), 0);
}

// Refresh the sidebar "Message credits" widget from the real sent count.
function updateCreditsWidget() {
  const used = messagesSentTotal();
  const label = $("#credits-label");
  const bar = $("#credits-bar");
  if (label) label.textContent = `${used.toLocaleString()} / ${CREDIT_QUOTA.toLocaleString()}`;
  if (bar) bar.style.width = Math.min(100, (used / CREDIT_QUOTA) * 100) + "%";
}

// Build the last-7-days "messages sent" series from real campaigns.
function trendSeries() {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const value = campaigns
      .filter(c => c.date === key)
      .reduce((sum, c) => sum + (c.delivered || 0), 0);
    out.push({ day: days[d.getDay()], value });
  }
  return out;
}

function trendChart() {
  const trendData = trendSeries();
  const max = Math.max(1, ...trendData.map(d => d.value)); // avoid divide-by-zero when empty
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

  // Real stats derived from the campaigns the user has actually sent.
  const today = new Date().toISOString().slice(0, 10);
  const sentToday = campaigns
    .filter(c => c.date === today)
    .reduce((sum, c) => sum + (c.delivered || 0), 0);
  const totalRecipients = campaigns.reduce((s, c) => s + (c.recipients || 0), 0);
  const totalDelivered = campaigns.reduce((s, c) => s + (c.delivered || 0), 0);
  const deliveryRate = totalRecipients ? ((totalDelivered / totalRecipients) * 100).toFixed(1) + "%" : "—";
  const weekTotal = trendSeries().reduce((s, d) => s + d.value, 0);

  const recentRows = campaigns.length ? campaigns.slice(0, 5).map(c => `
    <tr class="data-row border-t border-gray-50 dark:border-gray-800">
      <td class="py-3 px-4 font-medium text-gray-900 dark:text-white">${escapeHtml(c.name)}</td>
      <td class="py-3 px-4 text-sm text-gray-500 hidden sm:table-cell">${c.group}</td>
      <td class="py-3 px-4 text-sm text-gray-500 hidden md:table-cell">${c.date}</td>
      <td class="py-3 px-4">${statusBadge(c.status)}</td>
    </tr>`).join("")
    : `<tr><td colspan="4" class="py-12 text-center text-gray-400">No broadcasts yet. Send your first one to see it here.</td></tr>`;

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
        ${statCard({ icon: "users",        label: "Total Contacts",     value: totalContacts,  sub: { up: false, text: `${activeContacts().length} active` }, tint: "#25D366" })}
        ${statCard({ icon: "users-round",  label: "Total Groups",       value: groups.length,  sub: { up: false, text: `${groups.length} segment${groups.length === 1 ? "" : "s"}` }, tint: "#3b82f6" })}
        ${statCard({ icon: "message-circle",label:"Messages Sent Today", value: sentToday,      sub: { up: false, text: "Delivered today" }, tint: "#a855f7" })}
        ${statCard({ icon: "check-circle", label: "Delivery Rate",      value: deliveryRate,   sub: { up: false, text: `${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"}` }, tint: "#f59e0b" })}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="card p-6 lg:col-span-2">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-semibold text-gray-900 dark:text-white">Messages sent</h3>
              <p class="text-xs text-gray-400">Last 7 days</p>
            </div>
            <span class="text-sm font-semibold text-wa-green">${weekTotal.toLocaleString()} total</span>
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

const TODAY = new Date().toISOString().slice(0, 10);

function contactStatusBadge(status) {
  return status === "active"
    ? `<span class="badge bg-wa-green/10 text-wa-green"><i data-lucide="check" class="h-3 w-3"></i>Active</span>`
    : `<span class="badge bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"><i data-lucide="ban" class="h-3 w-3"></i>Opted-out</span>`;
}

// Green chip confirming a just-added contact is instantly eligible for the next auto-send
function readyChip(c) {
  return (c.status === "active" && c.added === TODAY)
    ? `<span class="badge bg-wa-green/10 text-wa-green"><i data-lucide="check-circle" class="h-3 w-3"></i>Ready for broadcast</span>`
    : "";
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

function contactRowHtml(c) {
  return `
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
      <td class="py-3 px-4"><div class="flex flex-wrap items-center gap-1.5">${contactStatusBadge(c.status)}${readyChip(c)}</div></td>
    </tr>`;
}

function contactsTbodyHtml() {
  const list = filteredContacts();
  return list.length
    ? list.map(contactRowHtml).join("")
    : `<tr><td colspan="6" class="py-12 text-center text-gray-400">No contacts match your filter.</td></tr>`;
}

function renderContacts() {
  const groupOptions = ['<option value="all">All groups</option>', ...groups.map(g => `<option value="${g.name}">${g.name}</option>`)].join("");

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
            <tbody id="contacts-tbody">${contactsTbodyHtml()}</tbody>
          </table>
        </div>
      </div>
    </div>`;

  // Wire controls once per full render. Search/filter update ONLY the table body
  // so the search input keeps focus while typing.
  $("#contact-search").addEventListener("input", e => { contactFilter.search = e.target.value; updateContactsTable(); });
  const gf = $("#contact-group-filter");
  gf.value = contactFilter.group;
  gf.addEventListener("change", e => { contactFilter.group = e.target.value; updateContactsTable(); });
  $("#select-all").addEventListener("change", e => {
    filteredContacts().forEach(c => e.target.checked ? selectedContactIds.add(c.id) : selectedContactIds.delete(c.id));
    updateContactsTable();
  });
  wireRowChecks();
  syncSelectAll();
}

// Re-render only the rows (keeps search input + its focus intact).
function updateContactsTable() {
  const tbody = $("#contacts-tbody");
  if (!tbody) return;
  tbody.innerHTML = contactsTbodyHtml();
  refreshIcons();
  wireRowChecks();
  syncSelectAll();
  updateBulkBar();
}

function wireRowChecks() {
  $$(".row-check").forEach(cb => cb.addEventListener("change", e => {
    const id = +e.target.dataset.id;
    e.target.checked ? selectedContactIds.add(id) : selectedContactIds.delete(id);
    updateBulkBar();
    syncSelectAll();
  }));
}

function syncSelectAll() {
  const selectAll = $("#select-all");
  if (!selectAll) return;
  const list = filteredContacts();
  selectAll.checked = list.length > 0 && list.every(c => selectedContactIds.has(c.id));
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
          <select id="nc-group" class="input-field">${groups.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join("")}</select>
        </div>
        <div class="flex gap-3 pt-2">
          <button type="button" data-close class="btn-secondary flex-1 justify-center">Cancel</button>
          <button type="submit" class="btn-primary flex-1 justify-center">Add Contact</button>
        </div>
      </form>
    </div>`);

  $("#add-contact-form").addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("#nc-name").value.trim();
    const phone = $("#nc-phone").value.replace(/\D/g, "");
    const gid = +$("#nc-group").value;
    const groupName = groups.find(g => g.id === gid)?.name || "Uncategorized";
    if (!name || phone.length < 10) { toast("Please enter a valid name and phone number.", "error"); return; }
    const ok = await mutate(
      async () => { await api.post("/api/contacts", { name, phone, group_ids: gid ? [gid] : [] }); await reloadContacts(); await reloadGroups(); },
      () => {
        const id = Math.max(0, ...contacts.map(c => c.id)) + 1;
        contacts.push({ id, name, phone, group: groupName, added: TODAY, status: "active" });
        const g = groups.find(g => g.id === gid); if (g) g.memberIds.push(id);
      }
    );
    if (!ok) return;
    closeModal();
    renderContacts(); refreshIcons();
    toast(`${escapeHtml(name)} added to ${groupName} — ready for broadcast.`);
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
  $("#atg-confirm").addEventListener("click", async () => {
    const gid = +$("#atg-group").value;
    const g = groups.find(g => g.id === gid);
    const ids = [...selectedContactIds];
    const ok = await mutate(
      async () => { await api.post(`/api/groups/${gid}/members`, ids); await reloadContacts(); await reloadGroups(); },
      () => {
        ids.forEach(id => {
          const c = contacts.find(c => c.id === id);
          if (c) c.group = g.name;
          if (g && !g.memberIds.includes(id)) g.memberIds.push(id);
        });
      }
    );
    if (!ok) return;
    selectedContactIds.clear();
    closeModal();
    renderContacts(); refreshIcons();
    toast(`${ids.length} contacts added to ${g.name}.`);
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
  $("#import-confirm").addEventListener("click", async () => {
    const ok = await mutate(
      async () => {
        const payload = rows.map(r => {
          const g = groups.find(g => g.name === r.group);
          return { name: r.name, phone: r.phone.replace(/\D/g, ""), group_ids: g ? [g.id] : [] };
        });
        await api.post("/api/contacts/bulk", payload);
        await reloadContacts(); await reloadGroups();
      },
      () => {
        let nextId = Math.max(0, ...contacts.map(c => c.id));
        rows.forEach(r => {
          const phone = r.phone.replace(/\D/g, "");
          const groupName = groups.find(g => g.name === r.group) ? r.group : "New Leads";
          const id = ++nextId;
          contacts.push({ id, name: r.name, phone, group: groupName, added: TODAY, status: "active" });
          const g = groups.find(g => g.name === groupName); if (g) g.memberIds.push(id);
        });
      }
    );
    if (!ok) return;
    closeModal();
    renderContacts(); refreshIcons();
    toast(`Imported ${rows.length} contacts — all ready for broadcast.`);
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

  $("#create-group-form").addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("#cg-name").value.trim();
    if (!name) return;
    const memberIds = $$(".cg-member:checked").map(cb => +cb.value);
    const desc = $("#cg-desc").value.trim() || "Custom group";
    const ok = await mutate(
      async () => { await api.post("/api/groups", { name, description: desc, member_ids: memberIds }); await reloadGroups(); await reloadContacts(); },
      () => {
        const id = Math.max(0, ...groups.map(g => g.id)) + 1;
        groups.push({ id, name, desc, memberIds, color: GROUP_PALETTE[id % GROUP_PALETTE.length] });
      }
    );
    if (!ok) return;
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
  $("#del-confirm").addEventListener("click", async () => {
    const ok = await mutate(
      async () => { await api.del(`/api/groups/${id}`); await reloadGroups(); await reloadContacts(); },
      () => { groups = groups.filter(x => x.id !== id); }
    );
    if (!ok) return;
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
  composeMode = "groups";
  navigateTo("compose");
}

/* ========================================================================
   PAGE: COMPOSE (core feature)
   ======================================================================== */

let composeMode = "groups"; // "groups" | "contacts" | "numbers"
let composeSelectedContacts = new Set();
let composePastedNumbers = [];
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
  if (composeMode === "numbers") return composePastedNumbers.length;
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
            <div class="mt-3 flex items-start gap-2 rounded-xl bg-wa-green/5 border border-wa-green/20 p-3">
              <i data-lucide="info" class="h-4 w-4 text-wa-green shrink-0 mt-0.5"></i>
              <p class="text-xs text-gray-600 dark:text-gray-300">Messages are sent automatically via WhatsApp Cloud API to every selected contact — no manual sending required.</p>
            </div>
          </div>

          <div class="card p-6">
            <div class="flex flex-wrap items-center gap-2 mb-4">
              <button id="tab-groups" class="px-3 py-1.5 text-sm font-semibold rounded-lg ${composeMode==='groups' ? 'bg-wa-green/10 text-wa-green' : 'text-gray-400'}" onclick="setComposeMode('groups')">Select Groups</button>
              <button id="tab-contacts" class="px-3 py-1.5 text-sm font-semibold rounded-lg ${composeMode==='contacts' ? 'bg-wa-green/10 text-wa-green' : 'text-gray-400'}" onclick="setComposeMode('contacts')">Individual Contacts</button>
              <button id="tab-numbers" class="px-3 py-1.5 text-sm font-semibold rounded-lg ${composeMode==='numbers' ? 'bg-wa-green/10 text-wa-green' : 'text-gray-400'}" onclick="setComposeMode('numbers')">Paste Numbers</button>
            </div>
            <div id="recipient-groups" class="${composeMode==='groups' ? '' : 'hidden'} grid grid-cols-1 sm:grid-cols-2 gap-2">${groupChecklist}</div>
            <div id="recipient-contacts" class="${composeMode==='contacts' ? '' : 'hidden'}">
              <div class="border border-gray-100 dark:border-gray-800 rounded-xl max-h-64 overflow-y-auto p-1">${contactChecklist}</div>
            </div>
            <div id="recipient-numbers" class="${composeMode==='numbers' ? '' : 'hidden'}">
              <textarea id="compose-numbers" rows="6" class="input-field resize-none font-mono text-sm" placeholder="Paste phone numbers with country code — one per line or comma-separated.&#10;923001234567&#10;923019876543&#10;923022223344">${composePastedNumbers.join("\n")}</textarea>
              <div class="flex items-center justify-between mt-2">
                <p class="text-xs text-gray-400 flex items-center gap-1"><i data-lucide="info" class="h-3.5 w-3.5"></i> No names or contacts needed — messages go straight to these numbers.</p>
                <span class="text-xs whitespace-nowrap"><span id="numbers-valid" class="font-bold text-wa-green">${composePastedNumbers.length}</span> valid numbers</span>
              </div>
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

            <div class="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3">
              <div class="flex items-center gap-2">
                <label class="text-sm text-gray-500 dark:text-gray-400">Message type</label>
                <select id="msg-category" class="input-field py-1.5 w-auto text-sm">
                  <option value="Marketing">Marketing</option>
                  <option value="Utility">Utility</option>
                  <option value="Authentication">Authentication</option>
                  <option value="Service">Service (free)</option>
                </select>
              </div>
              <div class="text-sm text-gray-600 dark:text-gray-300">
                Estimated cost: <span id="cost-estimate" class="font-bold text-gray-900 dark:text-white">${pricing.symbol}0.00</span>
                <span id="cost-rate" class="text-xs text-gray-400 block sm:inline"></span>
              </div>
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

  const numbersBox = $("#compose-numbers");
  numbersBox.addEventListener("input", e => {
    composePastedNumbers = parsePastedNumbers(e.target.value);
    const vc = $("#numbers-valid");
    if (vc) vc.textContent = composePastedNumbers.length;
    updateRecipientCount();
  });

  const catSel = $("#msg-category");
  catSel.value = composeCategory;
  catSel.addEventListener("change", e => { composeCategory = e.target.value; updateCostEstimate(); });

  updateRecipientCount();
  refreshIcons();
}

function updateCostEstimate() {
  const count = composeRecipientCount();
  const rate = pricing.rates[composeCategory] ?? 0;
  const el = $("#cost-estimate");
  if (el) el.textContent = fmtMoney(messageCost(count, composeCategory));
  const rl = $("#cost-rate");
  if (rl) rl.textContent = `${count} × ${pricing.symbol}${rate.toFixed(3)} (${composeCategory})`;
}

function setComposeMode(mode) {
  composeMode = mode;
  $("#recipient-groups").classList.toggle("hidden", mode !== "groups");
  $("#recipient-contacts").classList.toggle("hidden", mode !== "contacts");
  $("#recipient-numbers").classList.toggle("hidden", mode !== "numbers");
  const cls = m => `px-3 py-1.5 text-sm font-semibold rounded-lg ${mode===m ? 'bg-wa-green/10 text-wa-green' : 'text-gray-400'}`;
  $("#tab-groups").className = cls("groups");
  $("#tab-contacts").className = cls("contacts");
  $("#tab-numbers").className = cls("numbers");
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
  updateCostEstimate();
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
      <div class="mt-4 flex items-center justify-between rounded-xl bg-wa-green/5 border border-wa-green/20 p-3 text-sm">
        <span class="text-gray-500 dark:text-gray-400">${composeCategory} · ${count} messages</span>
        <span class="font-bold text-gray-900 dark:text-white">Est. cost ${fmtMoney(messageCost(count, composeCategory))}</span>
      </div>
      <div class="mt-3 rounded-xl bg-gray-50 dark:bg-gray-800 p-3 text-sm text-gray-600 dark:text-gray-300 max-h-24 overflow-y-auto">${escapeHtml(message).replace(/\n/g,"<br>")}</div>
      <div class="flex gap-3 mt-6">
        <button data-close class="btn-secondary flex-1 justify-center">Cancel</button>
        <button id="confirm-send" class="btn-primary flex-1 justify-center">${composeScheduled ? "Schedule" : "Send Now"}</button>
      </div>
    </div>`);

  $("#confirm-send").addEventListener("click", () => runBroadcast(message, count));
}

async function runBroadcast(message, count) {
  const wasScheduled = composeScheduled;
  const category = composeCategory;
  const schedDate = wasScheduled ? $("#sched-date").value : "2026-07-11";
  const schedTime = wasScheduled ? $("#sched-time").value : "";
  const groupName = composeMode === "groups"
    ? [...composeSelectedGroups].map(id => groups.find(g => g.id === id)?.name).filter(Boolean).join(", ")
    : composeMode === "numbers" ? "Pasted numbers" : "Individual contacts";

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

  // Send only the recipients from the active tab, so the send matches the counter.
  const gIds  = composeMode === "groups"   ? [...composeSelectedGroups]  : [];
  const cIds  = composeMode === "contacts" ? [...composeSelectedContacts] : [];
  const pNums = composeMode === "numbers"  ? [...composePastedNumbers]    : [];

  const result = await sendBroadcast(message, gIds, cIds, pNums, category, (done) => {
    const pct = Math.round((done / count) * 100);
    const bar = $("#prog-bar"), pc = $("#prog-count");
    if (bar) bar.style.width = pct + "%";
    if (pc) pc.textContent = done;
  }, count, !wasScheduled);

  // Record campaign
  if (dataSource === "api" && !wasScheduled) {
    // Backend already saved the campaign — pull the fresh list from the DB.
    try { await reloadCampaigns(); } catch (e) { /* it's persisted in the DB regardless */ }
  } else {
    const id = Math.max(0, ...campaigns.map(c => c.id), 0) + 1;
    const cost = wasScheduled
      ? messageCost(count, category)                                 // estimated (not sent yet)
      : (result.cost != null ? result.cost : messageCost(result.delivered, category));
    campaigns.unshift({
      id,
      name: message.slice(0, 24) + (message.length > 24 ? "…" : ""),
      date: schedDate,
      group: groupName || "Custom",
      category,
      recipients: count,
      delivered: wasScheduled ? 0 : result.delivered,
      read: wasScheduled ? 0 : result.read,
      failed: wasScheduled ? 0 : result.failed,
      cost,
      status: wasScheduled ? "scheduled" : "sent",
    });
    if (dataSource !== "api") persist();
  }

  closeModal();
  // reset compose
  composeSelectedGroups.clear();
  composeSelectedContacts.clear();
  composePastedNumbers = [];
  composeScheduled = false;

  if (wasScheduled) {
    toast(`Broadcast scheduled for ${count} contacts on ${schedDate}${schedTime ? " at " + schedTime : ""}.`);
  } else if (result.delivered === 0 && result.error) {
    // Live send failed for every recipient — show Meta's real reason.
    toast(`Send failed: ${result.error}`, "error");
  } else {
    toast(`Message sent to ${result.delivered} of ${count} contacts · via ${result.via}.`,
          result.failed && !result.delivered ? "error" : "success");
  }
  navigateTo("history");
}

/* ---- Send function: calls the FastAPI backend, falls back to a local mock ----
   The backend runs in "simulate" mode without Meta credentials, so this works
   end-to-end offline. When real Meta creds are added to backend/.env, the exact
   same call automatically sends real WhatsApp messages — no frontend change. */
/* Where the backend lives. Resolved once, in priority order:
   1. URL saved from Settings → Backend API Connection (localStorage) — change it live, no redeploy.
   2. window.WABLAST_API_BASE from config.js — set this when you deploy.
   3. http://localhost:8000 — local development default. */
const API_BASE = (() => {
  const clean = u => (u || "").trim().replace(/\/+$/, ""); // strip trailing slash(es)
  const saved = clean(localStorage.getItem("wablast_api_base"));
  if (saved) return saved;
  const configured = clean(typeof window !== "undefined" ? window.WABLAST_API_BASE : "");
  if (configured) return configured;
  return "http://localhost:8000";
})();

// Save/clear the backend URL from the Settings screen, then reload to apply it.
function saveApiBase(url) {
  const clean = (url || "").trim().replace(/\/+$/, "");
  try {
    if (clean) localStorage.setItem("wablast_api_base", clean);
    else localStorage.removeItem("wablast_api_base");
  } catch (e) {}
  location.reload();
}

async function sendBroadcast(message, groupIds, contactIds, phones, category, onProgress, total, doSend = true) {
  // Visual progress animation (runs regardless of transport).
  const animate = () => new Promise(res => {
    let done = 0;
    const tick = () => {
      done++;
      onProgress(done);
      if (done < total) setTimeout(tick, Math.max(80, 700 / total));
      else res();
    };
    setTimeout(tick, 150);
  });

  // Scheduled sends: don't hit the backend (no scheduler yet) — just animate.
  if (!doSend) { await animate(); return { delivered: 0, failed: 0, read: 0, via: "scheduled" }; }

  // Try the real backend; fall back to a local mock if it's unreachable.
  const callBackend = fetch(`${API_BASE}/api/broadcast/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, group_ids: groupIds, contact_ids: contactIds, phones, category }),
  }).then(r => (r.ok ? r.json() : null)).catch(() => null);

  const [, backend] = await Promise.all([animate(), callBackend]);

  if (backend) {
    return {
      delivered: backend.delivered,
      failed: backend.failed,
      read: Math.round(backend.delivered * 0.75),
      cost: backend.cost,
      error: backend.error || null,
      via: backend.simulated ? "backend (simulate)" : "backend (live)",
    };
  }

  // ---- Local fallback: backend offline or page opened directly as a file ----
  let delivered = 0, failed = 0;
  for (let i = 0; i < total; i++) (Math.random() < 0.04 ? failed++ : delivered++);
  return { delivered, failed, read: Math.round(delivered * 0.75), via: "local mock" };
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
      <td class="py-3 px-4 text-sm text-center font-medium text-gray-700 dark:text-gray-300">${fmtMoney(c.cost ?? messageCost(c.delivered, c.category || "Marketing"))}</td>
      <td class="py-3 px-4">${statusBadge(c.status)}</td>
    </tr>`).join("");

  const totalSpend = campaigns
    .filter(c => c.status === "sent")
    .reduce((sum, c) => sum + (c.cost ?? messageCost(c.delivered, c.category || "Marketing")), 0);

  $("#page-content").innerHTML = `
    <div class="max-w-7xl mx-auto space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">Campaign History</h2>
          <p class="text-gray-500 dark:text-gray-400 text-sm mt-0.5">${campaigns.length} campaigns · click a row for details.</p>
        </div>
        <div class="card px-4 py-2.5 flex items-center gap-3">
          <span class="h-9 w-9 rounded-lg bg-wa-green/10 text-wa-green flex items-center justify-center"><i data-lucide="wallet" class="h-4 w-4"></i></span>
          <div>
            <div class="text-xs text-gray-400">Total spend (sent)</div>
            <div class="text-lg font-bold text-gray-900 dark:text-white">${fmtMoney(totalSpend)}</div>
          </div>
        </div>
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
                <th class="py-2.5 px-4 font-medium text-center">Cost</th>
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
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">${c.group} · ${c.date} · ${c.category || "Marketing"} · ${statusBadge(c.status)}</p>
      <div class="flex items-center justify-between rounded-xl bg-wa-green/5 border border-wa-green/20 p-3 mb-5 text-sm">
        <span class="text-gray-500 dark:text-gray-400">Campaign cost</span>
        <span class="font-bold text-gray-900 dark:text-white">${fmtMoney(c.cost ?? messageCost(c.delivered, c.category || "Marketing"))}</span>
      </div>

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
  $("#tpl-form").addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("#tpl-name").value.trim();
    const category = $("#tpl-cat").value;
    const body = $("#tpl-body").value.trim();
    const ok = await mutate(
      async () => { await api.post("/api/templates", { name, body, category }); await reloadTemplates(); },
      () => { const id = Math.max(0, ...templates.map(t => t.id)) + 1; templates.push({ id, name, category, body }); }
    );
    if (!ok) return;
    closeModal(); renderTemplates(); refreshIcons();
    toast("Template saved.");
  });
}

async function deleteTemplate(id) {
  const ok = await mutate(
    async () => { await api.del(`/api/templates/${id}`); await reloadTemplates(); },
    () => { templates = templates.filter(t => t.id !== id); }
  );
  if (!ok) return;
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

      <!-- Backend / API connection -->
      <div class="card p-6">
        <h3 class="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><i data-lucide="server" class="h-5 w-5 text-wa-green"></i> Backend API Connection</h3>
        <div class="flex items-center justify-between p-4 rounded-xl border ${backendOnline ? 'bg-wa-green/5 border-wa-green/20' : 'bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20'}">
          <div class="flex items-center gap-3">
            <span class="h-2.5 w-2.5 rounded-full ${backendOnline ? 'bg-wa-green animate-pulse' : 'bg-amber-500'}"></span>
            <div>
              <div class="text-sm font-semibold text-gray-900 dark:text-white">${backendOnline ? 'Connected' : 'Not connected (using local mock)'}</div>
              <div class="text-xs text-gray-400 font-mono">${API_BASE}</div>
            </div>
          </div>
          <button class="btn-secondary py-2" onclick="checkBackend(true)"><i data-lucide="refresh-cw" class="h-4 w-4"></i> Test connection</button>
        </div>
        <div class="mt-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Backend URL</label>
          <div class="flex flex-col sm:flex-row gap-2">
            <input id="api-base-input" class="input-field py-2 flex-1 font-mono text-sm" placeholder="https://your-backend.up.railway.app" value="${escapeHtml(API_BASE)}">
            <button class="btn-primary py-2 shrink-0" onclick="saveApiBase(document.getElementById('api-base-input').value)"><i data-lucide="save" class="h-4 w-4"></i> Save & reload</button>
          </div>
          <p class="text-xs text-gray-400 mt-2">Paste your deployed (Railway) backend URL and press Save. Leave empty to use <code class="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">http://localhost:8000</code> for local dev.</p>
        </div>
        <div class="mt-4 pt-4 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between gap-3">
          <p class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5"><i data-lucide="save" class="h-3.5 w-3.5 text-wa-green"></i> Data is stored in ${dataSource === "api" ? "the connected database" : "this browser"} and survives a refresh.</p>
          <button class="btn-secondary py-2 text-xs shrink-0" onclick="resetData()"><i data-lucide="rotate-ccw" class="h-4 w-4"></i> Reset demo data</button>
        </div>
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

      <!-- Pricing -->
      <div class="card p-6">
        <h3 class="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2"><i data-lucide="dollar-sign" class="h-5 w-5"></i> Message Pricing (per message, ${pricing.currency})</h3>
        <p class="text-xs text-gray-400 mb-4">Used for cost estimates on Compose &amp; History. Real Meta rates vary by category and country — adjust to match your account.</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          ${Object.keys(pricing.rates).map(cat => `
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">${cat}</label>
              <div class="relative">
                <span class="absolute left-3 top-2.5 text-gray-400 text-sm">${pricing.symbol}</span>
                <input type="number" step="0.001" min="0" id="price-${cat}" class="input-field pl-7" value="${pricing.rates[cat].toFixed(3)}">
              </div>
            </div>`).join("")}
        </div>
        <button class="btn-primary mt-4" onclick="savePricing()"><i data-lucide="check" class="h-4 w-4"></i> Save rates</button>
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
          <div class="flex justify-between text-sm mb-1"><span class="text-gray-500">Message credits used</span><span class="font-semibold">${messagesSentTotal().toLocaleString()} / ${CREDIT_QUOTA.toLocaleString()}</span></div>
          <div class="h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden"><div class="h-full bg-wa-green rounded-full" style="width:${Math.min(100, (messagesSentTotal() / CREDIT_QUOTA) * 100)}%"></div></div>
          <p class="text-xs text-gray-400 mt-2">Resets on 1 Aug 2026.</p>
        </div>
      </div>
    </div>`;
}

async function savePricing() {
  Object.keys(pricing.rates).forEach(cat => {
    const input = $(`#price-${cat}`);
    if (input) {
      const v = parseFloat(input.value);
      if (!isNaN(v) && v >= 0) pricing.rates[cat] = v;
    }
  });
  const ok = await mutate(
    async () => { await api.put("/api/settings", { rates: pricing.rates }); await reloadSettings(); },
    () => persist(),
  );
  if (ok) toast("Pricing rates updated.");
}

/* ========================================================================
   INIT
   ======================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  setupAuth();
  setupLogout();
  setupNav();
  setupTheme();
  $("#backend-status").addEventListener("click", () => checkBackend(true));

  // Restore a still-valid session so a refresh keeps you in the dashboard
  // instead of bouncing back to the login screen.
  const session = getSession();
  if (session) {
    authToken = session.token || "";
    currentUser = { name: session.name, email: session.email };
    enterApp();
  }

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
window.savePricing = savePricing;
window.checkBackend = checkBackend;
window.saveApiBase = saveApiBase;
window.resetData = resetData;
window.toast = toast;
