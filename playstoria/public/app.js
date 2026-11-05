/* Playstoria front-end */
(() => {
"use strict";
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const state = { user: null, sort: "new", projects: [], authMode: "register", dashTab: "projects", currentProject: null };
const glyphs = { Games: "🎮", Education: "📚", Productivity: "⚡", Entertainment: "🎬", Tools: "🛠️", Other: "✨" };
const colors = ["", "color-1", "color-2", "color-3", "color-4", "color-5"];
const CATEGORIES = ["Games", "Education", "Productivity", "Entertainment", "Tools", "Other"];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const bytes = n => n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
const platformName = p => ({ android: "Android app", pc: "PC game", browser: "Browser game", other: "Software" }[p] || "Project");
const prettyStatus = s => ({ approved: "Published", pending: "Under review", awaiting_payment: "Payment needed", rejected: "Not approved", paid: "Paid" }[s] || s);
const stars = n => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));
const icon = (name) => `<svg class="i" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const BASE_TITLE = document.title;
let config = { feeEtb: 0, limitsMb: { android: 250, pc: 1000, browser: 100, other: 250 } };
let toastTimer, lastFocus = null, searchTimer;

function toast(message, error = false) {
  const el = $("#toast"); el.textContent = message; el.classList.toggle("error", error); el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3800);
}

async function api(url, options = {}) {
  const opts = { credentials: "same-origin", ...options, headers: { ...(options.headers || {}) } };
  if (opts.body && !(opts.body instanceof FormData) && typeof opts.body !== "string") {
    opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(opts.body);
  }
  let res;
  try { res = await fetch(url, opts); } catch { throw new Error("Can't reach Playstoria. Check your connection and try again."); }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    if (!res.ok) throw new Error((await res.text()).slice(0, 200) || "Something went wrong.");
    return {};
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

/* Upload with real progress (fetch can't report upload progress) */
function uploadWithProgress(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url); xhr.withCredentials = true; xhr.responseType = "json";
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100)); };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.onload = () => {
      const data = xhr.response || {};
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || (xhr.status === 429 ? "Too many uploads. Please wait a while and try again." : "Upload failed.")));
    };
    xhr.send(formData);
  });
}

/* ---------- Modals ---------- */
function openModal(id) {
  lastFocus = document.activeElement;
  $(id).hidden = false; document.body.style.overflow = "hidden";
  setTimeout(() => { const f = $(id + " [data-close]"); f && f.focus({ preventScroll: true }); }, 30);
}
function closeModal(id) {
  const el = $(id); if (!el || el.hidden) return;
  el.hidden = true;
  if (id === "#projectModal") {
    state.currentProject = null; document.title = BASE_TITLE;
    if (/^\/app\/\d+/.test(location.pathname)) history.pushState({}, "", "/");
  }
  if (!$$(".modal-backdrop").some(m => !m.hidden)) document.body.style.overflow = "";
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
}
$$("[data-close]").forEach(b => b.addEventListener("click", () => closeModal("#" + b.closest(".modal-backdrop").id)));
$$(".modal-backdrop").forEach(el => el.addEventListener("mousedown", e => { if (e.target === el) closeModal("#" + el.id); }));
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  const open = $$(".modal-backdrop").filter(m => !m.hidden).pop();
  if (open) closeModal("#" + open.id);
  else closeNav();
});

/* ---------- Navigation ---------- */
const nav = $("#mainNav"), menuBtn = $("#menuBtn");
function closeNav() { nav.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); }
menuBtn.addEventListener("click", e => { e.stopPropagation(); const open = nav.classList.toggle("open"); menuBtn.setAttribute("aria-expanded", String(open)); });
$$("a", nav).forEach(a => a.addEventListener("click", closeNav));
document.addEventListener("click", e => { if (!nav.contains(e.target) && !menuBtn.contains(e.target)) closeNav(); });
const header = $("#siteHeader");
const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

/* ---------- Auth ---------- */
function openAuth(mode = "register") { setAuthMode(mode); openModal("#authModal"); setTimeout(() => { const f = mode === "register" ? $("#authForm [name=username]") : $("#authForm [name=email]"); f && f.focus(); }, 60); }
function setAuthMode(mode) {
  state.authMode = mode;
  $("#authTitle").textContent = mode === "register" ? "Create your account." : "Welcome back.";
  $("#authSub").textContent = mode === "register" ? "One account to discover and publish great work." : "Sign in to manage your projects and profile.";
  $("#usernameWrap").hidden = mode === "login";
  $("#usernameWrap input").required = mode === "register";
  const pw = $("#authForm [name=password]");
  pw.autocomplete = mode === "login" ? "current-password" : "new-password";
  pw.placeholder = mode === "login" ? "Your password" : "At least 10 characters";
  $("#authSubmit").textContent = mode === "register" ? "Create account" : "Sign in";
  $("#authError").textContent = "";
  $$("[data-mode]").forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
}
$$("[data-mode]").forEach(b => b.addEventListener("click", () => setAuthMode(b.dataset.mode)));
$("#pwToggle").addEventListener("click", () => {
  const pw = $("#authForm [name=password]"), show = pw.type === "password";
  pw.type = show ? "text" : "password"; $("#pwToggle").textContent = show ? "Hide" : "Show";
  $("#pwToggle").setAttribute("aria-label", show ? "Hide password" : "Show password");
});
$("#authForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.currentTarget; // keep a reference: currentTarget is null after the first await
  const data = Object.fromEntries(new FormData(form).entries()); const mode = state.authMode; const err = $("#authError");
  err.textContent = "";
  if (mode === "register" && !/^[a-zA-Z0-9_]{3,24}$/.test(data.username || "")) return err.textContent = "Username must be 3–24 letters, numbers, or underscores.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || "")) return err.textContent = "Enter a valid email address.";
  if (!data.password) return err.textContent = "Enter your password.";
  if (mode === "register" && data.password.length < 10) return err.textContent = "Password must be at least 10 characters.";
  const btn = $("#authSubmit"); btn.disabled = true; const label = btn.textContent; btn.textContent = "Please wait…";
  try {
    if (mode === "login") delete data.username;
    const result = await api(mode === "register" ? "/api/register" : "/api/login", { method: "POST", body: data });
    if (result.requiresVerification) { closeModal("#authModal"); toast(result.message); form.reset(); return; }
    state.user = result.user; form.reset(); closeModal("#authModal"); updateHeader();
    toast(mode === "register" ? "Welcome to Playstoria! 🎉" : "You're signed in.");
    if (state.wantsUpload) { state.wantsUpload = false; openDashboard("upload"); }
  } catch (ex) { err.textContent = ex.message; }
  finally { btn.disabled = false; btn.textContent = label; }
});
async function logout() {
  try { await api("/api/logout", { method: "POST" }); } catch {}
  state.user = null; closeModal("#dashboardModal"); updateHeader(); toast("You have signed out.");
}
$("#logoutBtn").addEventListener("click", logout);

function publishIntent() { if (!state.user) { state.wantsUpload = true; return openAuth("register"); } openDashboard("upload"); }
function updateHeader() {
  const login = $("#loginOpen"), signup = $("#signupOpen"), bottom = $("#bottomSignup"), publish = $("#publishCta");
  if (state.user) {
    login.textContent = "@" + state.user.username; login.onclick = () => openDashboard();
    signup.textContent = "Dashboard"; signup.onclick = () => openDashboard();
    bottom.textContent = "Open your dashboard"; bottom.onclick = () => openDashboard();
    publish.innerHTML = `Publish a project ${icon("arrow")}`;
  } else {
    login.textContent = "Sign in"; login.onclick = () => openAuth("login");
    signup.textContent = "Create account"; signup.onclick = () => openAuth("register");
    bottom.textContent = "Join Playstoria"; bottom.onclick = () => openAuth("register");
    publish.innerHTML = `Start publishing ${icon("arrow")}`;
  }
}
$("#footerLogin").addEventListener("click", e => { e.preventDefault(); state.user ? openDashboard() : openAuth("login"); });
$("#heroPublish").addEventListener("click", publishIntent);
$("#publishCta").addEventListener("click", publishIntent);

async function loadConfig() {
  try {
    config = await api("/api/config");
    $("#googleSignIn").hidden = !config.googleSignInEnabled; $("#googleDivider").hidden = !config.googleSignInEnabled;
  } catch {}
}
async function loadMe() { try { state.user = (await api("/api/me")).user; } catch { state.user = null; } updateHeader(); }

/* ---------- Store ---------- */
function stateFilters() { return { q: $("#searchInput").value.trim(), platform: $("#platformFilter").value, category: $("#categoryFilter").value }; }
function projectCard(p, i = 0) {
  const paid = p.price_type === "paid";
  const rating = p.rating_count ? `<span class="stars">★ ${p.rating}</span>` : `<span>New</span>`;
  return `<a class="project-card" href="/app/${p.id}" data-project="${p.id}" aria-label="View ${esc(p.title)}">
    <div class="project-art ${colors[(p.id + i) % colors.length]}">
      ${p.cover_image_url ? `<img class="project-cover" src="${esc(p.cover_image_url)}" alt="${esc(p.title)} cover" loading="lazy">` : `<div class="project-glyph">${glyphs[p.category] || "✨"}</div>`}
      <span class="pill">${esc(platformName(p.platform))}</span>
    </div>
    <div class="project-body">
      <div class="project-topline"><h3>${esc(p.title)}</h3><span class="price-tag ${paid ? "paid" : ""}">${paid ? Number(p.price_etb) + " ETB" : "FREE"}</span></div>
      <p class="project-desc">${esc(p.description)}</p>
      <div class="project-foot">${rating}<span>↓ ${p.downloads}</span></div>
    </div></a>`;
}
function emptyStore(filtered) {
  return filtered
    ? `<div class="empty-state"><div class="empty-icon">🔍</div><h3>No matches found.</h3><p>Try a different word or clear your filters.</p><button class="btn btn-outline" data-act="clear" type="button">Clear filters</button></div>`
    : `<div class="empty-state"><div class="empty-icon">✨</div><h3>The shelves are waiting for you.</h3><p>No projects are published yet — be one of the first creators on Playstoria.</p><button class="btn btn-primary" data-act="publish" type="button">Publish a project</button></div>`;
}
let loadToken = 0;
async function loadProjects() {
  const token = ++loadToken, f = stateFilters(), params = new URLSearchParams();
  if (f.q) params.set("q", f.q); if (f.platform) params.set("platform", f.platform); if (f.category) params.set("category", f.category);
  if (state.sort === "downloads") params.set("sort", "downloads");
  const filtered = Boolean(f.q || f.platform || f.category);
  $("#clearFilters").hidden = !filtered;
  const grid = $("#projectGrid");
  grid.innerHTML = '<div class="empty-state loading"><div class="loader"></div><h3>Loading the store…</h3><p>Finding projects to explore.</p></div>';
  try {
    const d = await api("/api/projects?" + params);
    if (token !== loadToken) return;
    state.projects = d.projects;
    $("#resultCount").textContent = `${d.projects.length} ${d.projects.length === 1 ? "project" : "projects"}`;
    grid.innerHTML = d.projects.length ? d.projects.map(projectCard).join("") : emptyStore(filtered);
  } catch (err) {
    if (token !== loadToken) return;
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>The store could not load.</h3><p>${esc(err.message)}</p><button class="btn btn-outline" data-act="retry" type="button">Try again</button></div>`;
  }
}
// One delegated handler for grid cards and empty-state buttons (no inline handlers: they are blocked by CSP).
$("#projectGrid").addEventListener("click", e => {
  const btn = e.target.closest("[data-act]");
  if (btn) { const a = btn.dataset.act; if (a === "clear") clearFilters(); else if (a === "retry") loadProjects(); else if (a === "publish") publishIntent(); return; }
  const card = e.target.closest("[data-project]");
  if (card && !(e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1)) { e.preventDefault(); showProject(card.dataset.project, true); }
});
function clearFilters() { $("#searchInput").value = ""; $("#heroSearchInput").value = ""; $("#platformFilter").value = ""; $("#categoryFilter").value = ""; loadProjects(); }
$("#clearFilters").addEventListener("click", clearFilters);
$("#searchForm").addEventListener("submit", e => { e.preventDefault(); loadProjects(); });
$("#searchInput").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadProjects, 350); });
$("#platformFilter").addEventListener("change", loadProjects);
$("#categoryFilter").addEventListener("change", loadProjects);
$$(".tab").forEach(b => b.addEventListener("click", () => { $$(".tab").forEach(t => t.classList.remove("active")); b.classList.add("active"); state.sort = b.dataset.sort; loadProjects(); }));
$("#heroSearch").addEventListener("submit", e => { e.preventDefault(); $("#searchInput").value = $("#heroSearchInput").value.trim(); loadProjects(); $("#discover").scrollIntoView({ behavior: "smooth" }); });
$$("[data-quick-category],[data-quick-platform]").forEach(b => b.addEventListener("click", () => {
  $("#categoryFilter").value = b.dataset.quickCategory || ""; $("#platformFilter").value = b.dataset.quickPlatform || "";
  loadProjects(); $("#discover").scrollIntoView({ behavior: "smooth" });
}));

/* ---------- Project detail ---------- */
async function showProject(id, push = false) {
  try {
    const d = await api("/api/projects/" + id); const p = d.project; state.currentProject = p;
    const paid = p.price_type === "paid";
    let action;
    if (!paid) action = `<a class="btn btn-primary btn-large" href="/api/download/${p.id}">${icon("download")} Download for free</a>`;
    else if (d.purchased || d.isOwner) action = `<a class="btn btn-primary btn-large" href="/api/download/${p.id}">${icon("download")} Download</a>`;
    else if (d.paymentPending) action = `<button class="btn btn-outline btn-large" type="button" disabled>Payment under review</button>`;
    else action = `<button class="btn btn-primary btn-large" id="buyPaidBtn" type="button">Buy for ${Number(p.price_etb)} ETB</button>`;
    const note = d.paymentPending ? `<div class="notice">Your payment is waiting for admin verification. Your download unlocks as soon as it's approved.</div>` : (d.purchased ? `<div class="notice ok">You own this app — thanks for supporting the developer!</div>` : "");
    $("#projectDetail").innerHTML = `
      <div class="detail-art">${p.cover_image_url ? `<img class="detail-cover" src="${esc(p.cover_image_url)}" alt="${esc(p.title)} cover">` : (glyphs[p.category] || "✨")}</div>
      <div class="eyebrow">${esc(p.category)}</div>
      <h2 id="projectTitle">${esc(p.title)}</h2>
      <div class="detail-meta"><span>${esc(platformName(p.platform))}</span><span>Version ${esc(p.version)}</span><span>${bytes(p.file_size)}</span><span>${p.rating_count ? `★ ${p.rating} (${p.rating_count})` : "★ New"}</span><span>${paid ? Number(p.price_etb) + " ETB" : "Free"}</span></div>
      <p class="detail-description">${esc(p.description)}</p>
      <p class="project-meta"><span>Made by <b>@${esc(p.username)}</b></span><span>↓ ${p.downloads} downloads</span></p>
      ${note}
      <div class="detail-actions">${action}<button class="btn btn-outline" id="shareBtn" type="button">${icon("share")} Share</button><button class="btn btn-quiet" id="reportBtn" type="button">${icon("flag")} Report</button></div>
      <div class="review-form"><h3>Community reviews</h3>
        ${state.user ? `<form id="reviewForm"><label>Rating<select name="rating"><option value="5">★★★★★ — Loved it</option><option value="4">★★★★ — Good</option><option value="3">★★★ — Okay</option><option value="2">★★ — Needs work</option><option value="1">★ — Poor</option></select></label><label>Your review<textarea name="comment" maxlength="500" placeholder="Share a helpful, respectful review (optional)"></textarea></label><button class="btn btn-primary" type="submit">Post review</button></form>` : `<p class="detail-description">Sign in to leave a review.</p>`}
        <div class="review-list">${d.reviews.length ? d.reviews.map(r => `<div class="review"><strong>${esc(r.username)}</strong> <span class="stars">${stars(r.rating)}</span><p>${esc(r.comment || "No written comment.")}</p></div>`).join("") : '<p class="detail-description" style="margin-top:12px">No reviews yet. Be the first to share feedback.</p>'}</div>
      </div>`;
    document.title = `${p.title} — Playstoria`;
    if (push && location.pathname !== `/app/${p.id}`) history.pushState({ project: p.id }, "", `/app/${p.id}`);
    if ($("#projectModal").hidden) openModal("#projectModal"); else $("#projectModal").scrollTo(0, 0);
    wireProject(p, d);
  } catch (e) { toast(e.message, true); if (/^\/app\//.test(location.pathname)) history.replaceState({}, "", "/"); }
}
function wireProject(p, d) {
  $("#shareBtn").addEventListener("click", async () => {
    const url = `${location.origin}/app/${p.id}`;
    try { if (navigator.share) { await navigator.share({ title: p.title, text: `Check out ${p.title} on Playstoria`, url }); return; } } catch (e) { if (e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(url); toast("Link copied to clipboard."); } catch { prompt("Copy this link:", url); }
  });
  $("#reportBtn").addEventListener("click", () => { $("#reportForm").reset(); $("#reportError").textContent = ""; openModal("#reportModal"); });
  $("#buyPaidBtn")?.addEventListener("click", () => {
    if (!state.user) { closeModal("#projectModal"); openAuth("login"); return; }
    if ($("#purchaseForm")) return;
    const box = document.createElement("div"); box.className = "pay-box";
    box.innerHTML = `<h3>Pay with Telebirr</h3><p class="detail-description">Send exactly <b>${Number(p.price_etb)} ETB</b> to this Telebirr number, then upload a screenshot of the confirmation. Never share your PIN or OTP with anyone.</p>
      <div class="pay-number">${esc(config.telebirrNumber || "Not configured yet")}</div>
      ${config.telebirrNumber ? "" : '<p class="notice">The store owner has not set a Telebirr number yet. Please don\'t pay until one is shown here.</p>'}
      <form id="purchaseForm"><label>Transaction reference<input name="transactionRef" required minlength="4" maxlength="120" placeholder="e.g. CJK1234567"></label><label>Payment screenshot<input name="screenshot" type="file" required accept="image/jpeg,image/png,image/webp"></label><div class="form-error" id="purchaseError" role="alert"></div><button class="btn btn-primary" type="submit"${config.telebirrNumber ? "" : " disabled"}>Submit payment for verification</button></form>`;
    $(".detail-actions").after(box); box.scrollIntoView({ behavior: "smooth", block: "center" });
    $("#purchaseForm").addEventListener("submit", async ev => {
      ev.preventDefault(); const fd = new FormData(ev.currentTarget); fd.append("projectId", String(p.id));
      const btn = ev.currentTarget.querySelector("button[type=submit]"); btn.disabled = true; $("#purchaseError").textContent = "";
      try { const r = await api("/api/purchases", { method: "POST", body: fd }); toast(r.message); await showProject(p.id); }
      catch (err) { $("#purchaseError").textContent = err.message; btn.disabled = false; }
    });
  });
  $("#reviewForm")?.addEventListener("submit", async e => {
    e.preventDefault(); const data = Object.fromEntries(new FormData(e.currentTarget));
    try { await api(`/api/projects/${p.id}/reviews`, { method: "POST", body: data }); toast("Thanks for your review!"); await showProject(p.id); loadProjects(); }
    catch (err) { toast(err.message, true); }
  });
}
$("#reportForm").addEventListener("submit", async e => {
  e.preventDefault(); const p = state.currentProject; if (!p) return;
  const reason = String(new FormData(e.currentTarget).get("reason") || "").trim();
  if (reason.length < 5) return $("#reportError").textContent = "Please explain the reason in a few words.";
  const btn = e.currentTarget.querySelector("button[type=submit]"); btn.disabled = true;
  try { await api(`/api/projects/${p.id}/report`, { method: "POST", body: { reason } }); closeModal("#reportModal"); toast("Report sent to the moderation team."); }
  catch (err) { $("#reportError").textContent = err.message; }
  finally { btn.disabled = false; }
});
window.addEventListener("popstate", () => {
  const m = location.pathname.match(/^\/app\/(\d+)/);
  if (m) showProject(m[1]); else if (!$("#projectModal").hidden) { $("#projectModal").hidden = true; state.currentProject = null; document.title = BASE_TITLE; if (!$$(".modal-backdrop").some(x => !x.hidden)) document.body.style.overflow = ""; }
});

/* ---------- Dashboard ---------- */
async function openDashboard(tab = "projects") {
  if (!state.user) { openAuth("login"); return; }
  state.dashTab = tab; $("#adminTab").hidden = state.user.role !== "admin";
  if ($("#dashboardModal").hidden) openModal("#dashboardModal");
  await renderDash();
}
$$("[data-dash]").forEach(b => b.addEventListener("click", () => { state.dashTab = b.dataset.dash; renderDash(); }));
async function renderDash() {
  $("#dashContent").innerHTML = '<div class="dashboard-empty">Loading…</div>';
  $$("[data-dash]").forEach(b => b.classList.toggle("active", b.dataset.dash === state.dashTab));
  try {
    const t = state.dashTab;
    if (t === "upload") return await renderUpload();
    if (t === "profile") return renderProfile();
    if (t === "earnings") return await renderEarnings();
    if (t === "settings") return renderSettings();
    if (t === "admin") return await renderAdmin();
    return await renderMyProjects();
  } catch (e) {
    if (/sign in/i.test(e.message)) { state.user = null; updateHeader(); closeModal("#dashboardModal"); openAuth("login"); return; }
    $("#dashContent").innerHTML = `<div class="dashboard-empty">${esc(e.message)}</div>`;
  }
}
async function renderMyProjects() {
  const d = await api("/api/my/projects");
  const downloads = d.projects.reduce((a, p) => a + Number(p.downloads || 0), 0);
  $("#dashContent").innerHTML = `
    <div class="dash-summary"><div class="dash-stat"><strong>${d.publishedCount}</strong><span>Published projects</span></div><div class="dash-stat"><strong>${d.projects.length}</strong><span>Total submissions</span></div><div class="dash-stat"><strong>${downloads}</strong><span>Total downloads</span></div></div>
    <button class="btn btn-primary" id="newUploadBtn" type="button">+ Upload a project</button>
    <div style="margin-top:14px">${d.projects.length ? d.projects.map(p => `
      <div class="dashboard-project">
        <div class="dash-thumb">${p.cover_image_url ? `<img src="${esc(p.cover_image_url)}" alt="" loading="lazy">` : (glyphs[p.category] || "✨")}</div>
        <div class="dash-project-info"><strong>${esc(p.title)}</strong><small>${esc(platformName(p.platform))} · ${bytes(p.file_size)} · ${p.downloads} downloads · ${p.price_type === "paid" ? p.price_etb + " ETB" : "Free"}</small></div>
        <span class="status status-${esc(p.status)}">${esc(prettyStatus(p.status))}</span>
        ${p.status === "approved" ? `<button class="btn btn-outline btn-small" data-view="${p.id}" type="button">View</button>` : ""}
        <button class="icon-btn" data-delete="${p.id}" data-title="${esc(p.title)}" type="button" aria-label="Delete ${esc(p.title)}">Delete</button>
      </div>`).join("") : '<div class="dashboard-empty">You have not uploaded any projects yet. Your first project could be right here.</div>'}</div>`;
  $("#newUploadBtn").addEventListener("click", () => { state.dashTab = "upload"; renderDash(); });
  $$("[data-view]").forEach(b => b.addEventListener("click", () => { closeModal("#dashboardModal"); showProject(b.dataset.view, true); }));
  $$("[data-delete]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm(`Delete “${b.dataset.title}”? This permanently removes the project and its files.`)) return;
    try { await api("/api/my/projects/" + b.dataset.delete, { method: "DELETE" }); toast("Project deleted."); await renderMyProjects(); loadProjects(); }
    catch (e) { toast(e.message, true); }
  }));
}
async function renderUpload() {
  const L = config.limitsMb;
  $("#dashContent").innerHTML = `
    <div class="upload-guidance">Upload as many projects as you like — there's no upload fee. Every submission is reviewed before it goes public. Limits: <b>${L.android} MB</b> Android · <b>${L.pc} MB</b> PC · <b>${L.browser} MB</b> browser games · <b>${L.other} MB</b> other. Browser game ZIPs need an <b>index.html</b> at the root.</div>
    <form class="dash-form" id="uploadForm" style="margin-top:18px">
      <label>Project name<input name="title" required maxlength="80" placeholder="e.g. Addis Runner"></label>
      <label>Version<input name="version" maxlength="30" value="1.0" required></label>
      <label>Platform<select name="platform" required><option value="android">Android app / game (.apk)</option><option value="pc">PC game / software</option><option value="browser">Browser game (.zip)</option><option value="other">Other software</option></select></label>
      <label>Category<select name="category" required>${CATEGORIES.map(c => `<option>${c}</option>`).join("")}</select></label>
      <label class="full">Description<textarea name="description" required minlength="10" maxlength="1500" placeholder="What does it do? What makes it useful or fun?"></textarea></label>
      <label class="full">Cover image (required)<input name="coverImage" type="file" required accept="image/jpeg,image/png,image/webp"><small>JPG, PNG or WebP · max 5 MB · shown on the store. A 16:10 image looks best.</small>
        <div id="coverPreviewWrap" class="cover-preview-wrap" hidden><img id="coverPreview" alt="Cover image preview"><button type="button" class="btn btn-quiet btn-small" id="removeCoverBtn">Remove image</button></div></label>
      <label>Pricing<select name="priceType" id="priceType"><option value="free">Free</option><option value="paid">Paid</option></select></label>
      <label id="priceEtbWrap" hidden>Price (ETB)<input name="priceEtb" type="number" min="1" max="100000" step="1" value="50"><small>You keep 90% of each approved sale.</small></label>
      <label class="full">Project file<input name="file" type="file" required accept=".apk"><small id="fileHint">Only upload files you own or have permission to distribute.</small></label>
      <div class="full upload-progress-bar" id="uploadBar" hidden><span></span></div>
      <div class="full form-error" id="uploadError" role="alert"></div>
      <button class="btn btn-primary" type="submit">Submit for review</button>
    </form>`;
  const form = $("#uploadForm"), priceType = $("#priceType"), cover = $("[name=coverImage]", form), file = $("[name=file]", form);
  priceType.addEventListener("change", () => { const paid = priceType.value === "paid"; $("#priceEtbWrap").hidden = !paid; $("#priceEtbWrap input").required = paid; });
  cover.addEventListener("change", () => {
    const f = cover.files[0]; const wrap = $("#coverPreviewWrap");
    if (!f) { wrap.hidden = true; return; }
    if (f.size > 5 * 1024 * 1024) { cover.value = ""; wrap.hidden = true; return toast("Cover images must be 5 MB or smaller.", true); }
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) { cover.value = ""; wrap.hidden = true; return toast("Choose a JPG, PNG or WebP image.", true); }
    $("#coverPreview").src = URL.createObjectURL(f); wrap.hidden = false;
  });
  $("#removeCoverBtn").addEventListener("click", () => { cover.value = ""; $("#coverPreview").removeAttribute("src"); $("#coverPreviewWrap").hidden = true; });
  const accepts = { android: ".apk", pc: ".zip,.7z,.rar,.exe,.msi,.dmg,.appimage", browser: ".zip", other: ".zip,.7z,.rar,.exe,.msi,.dmg,.appimage,.pdf" };
  $("[name=platform]", form).addEventListener("change", e => { file.value = ""; file.accept = accepts[e.target.value]; $("#fileHint").textContent = `Allowed: ${accepts[e.target.value].replace(/\./g, "").replace(/,/g, ", ")}. Only upload files you own or have permission to distribute.`; });
  form.addEventListener("submit", async e => {
    e.preventDefault(); const btn = form.querySelector("button[type=submit]"), err = $("#uploadError"), bar = $("#uploadBar"), fill = $("span", bar);
    err.textContent = ""; btn.disabled = true; btn.textContent = "Uploading…"; bar.hidden = false; fill.style.width = "0";
    try {
      const r = await uploadWithProgress("/api/projects", new FormData(form), pct => { fill.style.width = pct + "%"; btn.textContent = pct < 100 ? `Uploading… ${pct}%` : "Processing…"; });
      toast(r.message); state.dashTab = "projects"; await renderDash();
    } catch (ex) { err.textContent = ex.message; btn.disabled = false; btn.textContent = "Submit for review"; bar.hidden = true; }
  });
}
function renderProfile() {
  const u = state.user;
  $("#dashContent").innerHTML = `<form id="profileForm" class="dash-form"><label class="full">Developer name<input value="@${esc(u.username)}" disabled></label><label class="full">Email<input value="${esc(u.email)}" disabled></label><label class="full">Short bio<textarea name="bio" maxlength="300" placeholder="Tell the community what you build…">${esc(u.bio || "")}</textarea></label><div class="full form-error" id="profileError" role="alert"></div><button class="btn btn-primary" type="submit">Save profile</button></form>`;
  $("#profileForm").addEventListener("submit", async e => {
    e.preventDefault();
    try { const r = await api("/api/developer/profile", { method: "POST", body: { bio: new FormData(e.currentTarget).get("bio") } }); state.user = r.user; toast("Profile saved."); }
    catch (err) { $("#profileError").textContent = err.message; }
  });
}
function renderSettings() {
  const u = state.user;
  $("#dashContent").innerHTML = `<h3 style="font-size:20px">Account</h3><p class="dash-note">Signed in as <b>@${esc(u.username)}</b> (${esc(u.email)}).</p><button class="btn btn-outline" id="settingsSignOut" type="button">Sign out</button><p class="dash-note" style="margin-top:20px">For account security, use a unique password and never share verification codes or your Telebirr PIN.</p>`;
  $("#settingsSignOut").addEventListener("click", logout);
}
async function renderEarnings() {
  const d = await api("/api/my/earnings");
  $("#dashContent").innerHTML = `
    <div class="dash-summary"><div class="dash-stat"><strong>${d.totals.gross} ETB</strong><span>Gross sales</span></div><div class="dash-stat"><strong>${d.totals.commission} ETB</strong><span>Playstoria commission (10%)</span></div><div class="dash-stat"><strong>${d.available} ETB</strong><span>Available balance</span></div></div>
    <p class="dash-note">You earn 90% of each approved sale. Payouts are manual and may take time while the admin verifies and sends the money. Minimum withdrawal: 100 ETB.</p>
    <form id="withdrawForm" class="dash-form"><label>Amount (ETB)<input name="amountEtb" type="number" min="100" step="1" max="${d.available}" required ${d.available < 100 ? "disabled" : ""}></label><label>Telebirr number<input name="telebirrNumber" required maxlength="40" inputmode="tel" placeholder="09…" ${d.available < 100 ? "disabled" : ""}></label><div class="full form-error" id="withdrawError" role="alert"></div><button class="btn btn-primary" type="submit" ${d.available < 100 ? "disabled" : ""}>Request withdrawal</button></form>
    <h3 class="admin-title">Sales history</h3>${d.ledger.length ? d.ledger.map(l => `<div class="admin-row"><b>${esc(l.title)}</b><p style="margin:4px 0 0">Sale ${l.gross_etb} ETB · commission ${l.commission_etb} ETB · you earn <b style="color:var(--mint)">${l.net_etb} ETB</b></p></div>`).join("") : '<p class="dash-note">No approved sales yet.</p>'}
    <h3 class="admin-title">Withdrawal requests</h3>${d.withdrawals.length ? d.withdrawals.map(w => `<div class="admin-row" style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span><b>${w.amount_etb} ETB</b> · ${esc(w.telebirr_number)}</span><span class="status status-${esc(w.status)}">${esc(prettyStatus(w.status))}</span></div>`).join("") : '<p class="dash-note">No withdrawal requests.</p>'}`;
  $("#withdrawForm").addEventListener("submit", async e => {
    e.preventDefault();
    try { const r = await api("/api/my/withdrawals", { method: "POST", body: Object.fromEntries(new FormData(e.currentTarget)) }); toast(r.message); renderEarnings(); }
    catch (err) { $("#withdrawError").textContent = err.message; }
  });
}
async function renderAdmin() {
  if (state.user.role !== "admin") { $("#dashContent").innerHTML = '<div class="dashboard-empty">Admin access required.</div>'; return; }
  const [d, pd] = await Promise.all([api("/api/admin/overview"), api("/api/admin/payments")]);
  const safe = fn => async () => { try { await fn(); } catch (e) { toast(e.message, true); } };
  $("#dashContent").innerHTML = `
    <div class="dash-summary"><div class="dash-stat"><strong>${d.stats.accounts}</strong><span>Total accounts</span></div><div class="dash-stat"><strong>${d.stats.published}</strong><span>Published</span></div><div class="dash-stat"><strong>${d.stats.pending}</strong><span>Awaiting action</span></div></div>
    <h3 class="admin-title">Uploads awaiting action</h3>
    ${d.projects.length ? d.projects.map(p => `<div class="admin-row"><h4>${esc(p.title)} <span style="color:var(--faint);font-weight:400;font-size:13px">by @${esc(p.username)}</span></h4><p>${esc(p.description)}<br>${esc(platformName(p.platform))} · ${bytes(p.file_size)} · ${esc(p.original_name)} · ${p.price_type === "paid" ? p.price_etb + " ETB" : "Free"}<br>Status: ${esc(prettyStatus(p.status))}</p>
      <div class="admin-actions"><a class="btn btn-outline btn-small" href="/api/admin/projects/${p.id}/file">Download file</a>${p.cover_image ? `<a class="btn btn-outline btn-small" target="_blank" rel="noopener" href="/api/project-cover/${p.id}">View cover</a>` : ""}${p.status !== "approved" ? `<button class="btn btn-primary btn-small" data-admin="approve" data-id="${p.id}" type="button">Approve &amp; publish</button>` : ""}${p.status !== "rejected" ? `<button class="btn btn-danger btn-small" data-admin="reject" data-id="${p.id}" type="button">Reject</button>` : ""}</div></div>`).join("") : '<div class="dashboard-empty">No uploads need review.</div>'}
    <h3 class="admin-title">Open reports (${d.reports.length})</h3>
    ${d.reports.length ? d.reports.map(r => `<div class="admin-row"><h4>${esc(r.title)}</h4><p>${esc(r.reason)} · reported by ${esc(r.username || "guest")}</p><button class="btn btn-outline btn-small" data-report-close="${r.id}" type="button">Close report</button></div>`).join("") : '<div class="dashboard-empty">No open reports.</div>'}
    <h3 class="admin-title">Purchase verification</h3>
    ${pd.payments.length ? pd.payments.map(x => `<div class="admin-row"><b>${esc(x.project_title)}</b><p>Buyer @${esc(x.buyer_username)} · developer @${esc(x.developer_username)} · ${x.amount_etb} ETB<br>Reference: ${esc(x.transaction_ref)} · <span class="status status-${esc(x.status)}">${esc(prettyStatus(x.status))}</span></p><div class="admin-actions"><a class="btn btn-outline btn-small" target="_blank" rel="noopener" href="/api/admin/payment-screenshot/${x.id}">View screenshot</a>${x.status === "pending" ? `<button class="btn btn-primary btn-small" data-pay-approve="${x.id}" type="button">Approve payment</button><button class="btn btn-danger btn-small" data-pay-reject="${x.id}" type="button">Reject</button>` : ""}</div></div>`).join("") : '<p class="dash-note">No payment submissions yet.</p>'}
    <h3 class="admin-title">Developer withdrawals</h3>
    ${pd.withdrawals.length ? pd.withdrawals.map(w => `<div class="admin-row"><b>@${esc(w.username)} — ${w.amount_etb} ETB</b><p>Telebirr: ${esc(w.telebirr_number)} · <span class="status status-${esc(w.status)}">${esc(prettyStatus(w.status))}</span></p>${w.status === "pending" ? `<div class="admin-actions"><button class="btn btn-primary btn-small" data-w-paid="${w.id}" type="button">Mark paid (after sending)</button><button class="btn btn-danger btn-small" data-w-reject="${w.id}" type="button">Reject</button></div>` : ""}</div>`).join("") : '<p class="dash-note">No withdrawal requests yet.</p>'}`;
  $$("[data-admin]").forEach(b => b.addEventListener("click", safe(async () => { await api(`/api/admin/projects/${b.dataset.id}/${b.dataset.admin}`, { method: "POST" }); toast(b.dataset.admin === "approve" ? "Project published." : "Project rejected."); await renderAdmin(); loadProjects(); })));
  $$("[data-report-close]").forEach(b => b.addEventListener("click", safe(async () => { await api(`/api/admin/reports/${b.dataset.reportClose}/close`, { method: "POST" }); toast("Report closed."); await renderAdmin(); })));
  $$("[data-pay-approve]").forEach(b => b.addEventListener("click", safe(async () => { if (!confirm("Only approve after you've confirmed the money arrived in Telebirr.")) return; const r = await api(`/api/admin/payments/${b.dataset.payApprove}/approve`, { method: "POST" }); toast(r.message); await renderAdmin(); })));
  $$("[data-pay-reject]").forEach(b => b.addEventListener("click", safe(async () => { await api(`/api/admin/payments/${b.dataset.payReject}/reject`, { method: "POST" }); toast("Payment rejected."); await renderAdmin(); })));
  $$("[data-w-paid]").forEach(b => b.addEventListener("click", safe(async () => { if (!confirm("Only confirm after you have actually sent the Telebirr payout.")) return; await api(`/api/admin/withdrawals/${b.dataset.wPaid}/paid`, { method: "POST" }); toast("Payout recorded."); await renderAdmin(); })));
  $$("[data-w-reject]").forEach(b => b.addEventListener("click", safe(async () => { await api(`/api/admin/withdrawals/${b.dataset.wReject}/reject`, { method: "POST" }); toast("Withdrawal rejected."); await renderAdmin(); })));
}

/* ---------- Boot ---------- */
$("#year").textContent = new Date().getFullYear();
document.addEventListener("visibilitychange", () => { if (!document.hidden) loadMe(); });
(async () => {
  await Promise.all([loadConfig(), loadMe()]);
  await loadProjects();
  const params = new URLSearchParams(location.search);
  if (params.get("auth") === "google-cancelled") toast("Google sign-in was cancelled.", true);
  if (location.search) history.replaceState({}, "", location.pathname + location.hash);
  const m = location.pathname.match(/^\/app\/(\d+)/);
  if (m) showProject(m[1]);
})();
})();
