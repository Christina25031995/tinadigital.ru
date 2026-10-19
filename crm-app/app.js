/* Tina CRM — статический SPA на Supabase. Ключ ниже публичный (publishable), доступ ограничен RLS. */
"use strict";
const SUPABASE_URL = "https://fyxvsvxyyekdutndkwwo.supabase.co";
const SUPABASE_KEY = "sb_publishable_dIjJSWBG2GxO2GCSUzYLhw_H7IIr9V9";

const STATUSES = [["new","Новый"],["sent","Написала"],["replied","Ответил"],["call","Созвон"],["call2","Второй созвон"],["offer","КП отправлено"],["client","Клиент"],["later","Позже"],["lost","Отказ"]];
// у рекомендателя своя цепочка (раздел 5а ТЗ)
const REF_STATUSES = [["new","Новый"],["sent","Написала"],["replied","Ответил"],["brought","Привёл лида"],["bonus_paid","Бонус выплачен"],["later","Позже"],["lost","Отказ"]];
const SL = Object.fromEntries([...STATUSES, ...REF_STATUSES]);
const FINAL = new Set(["client", "lost", "bonus_paid"]); // для них следующее касание не обязательно
const statusesOf = l => l?.contact_type === "referrer" ? REF_STATUSES : STATUSES;
const TYPES = { cold: "Холодный", warm: "Тёплый" };
const KINDS = { new: "Новый", former: "Бывший", subscriber: "Абонент" };
const PERIODS = { once: "разовая", daily: "ежедневная", weekly: "еженедельная", monthly: "ежемесячная", event: "по событию" };
const TASK_ST = { active: "активна", done: "сделана", paused: "пауза" };
const MONTHS = ["январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь"];
const LABELS = { // как называть лидов: [мн. число, «добавить …», «новый …»]
  "Лиды": ["Лиды", "лида", "Новый лид"],
  "Клиенты": ["Клиенты", "клиента", "Новый клиент"],
  "Заявки": ["Заявки", "заявку", "Новая заявка"],
};
const DEFAULT_GOAL = 500000;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const link = v => /^https?:\/\//.test(v || "") ? `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(v.replace(/^https?:\/\//, ""))}</a>` : esc(v || "—");
const fmt = d => d ? d.split("-").reverse().slice(0, 2).join(".") : "";
const rub = n => Math.round(Number(n || 0)).toLocaleString("ru-RU");
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const nicheOf = l => l.type === "warm" ? "Мои клиенты" : (l.niche || "Без ниши");
const clampHot = v => Math.max(1, Math.min(5, Math.round(+v) || 3));
const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const addMonths = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };
const short = s => String(s || "").split(",")[0];
const store = { get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }, set(k,v){ try { localStorage.setItem(k, v); } catch(e){} } };

/* ---------- ошибки по-русски ---------- */
function ruErr(e) {
  if (!e) return "Неизвестная ошибка";
  console.warn("[crm]", e);
  const m = String(e.message || e.error_description || e.msg || e).toLowerCase();
  const code = String(e.code || "");
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed") || m.includes("network request failed")) return "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.";
  if (code === "invalid_credentials" || m.includes("invalid login credentials")) return "Неверный email или пароль.";
  if (code === "email_not_confirmed" || m.includes("email not confirmed")) return "Почта ещё не подтверждена. Откройте письмо от Supabase или попросите владельца.";
  if (code === "user_already_exists" || m.includes("already registered")) return "Такой email уже зарегистрирован — перейдите на вкладку «Войти».";
  if (code === "weak_password" || m.includes("password should")) return "Пароль слишком простой: минимум 8 символов, лучше с цифрами и буквами.";
  if (m.includes("rate limit") || e.status === 429 || code === "over_email_send_rate_limit") return "Слишком много попыток подряд. Подождите пару минут и попробуйте снова.";
  if (m.includes("invalid email") || m.includes("unable to validate email") || code === "email_address_invalid") return "Проверьте адрес почты — похоже, в нём ошибка.";
  if (m.includes("signups not allowed") || code === "signup_disabled") return "Регистрация новых пользователей выключена. Попросите владельца CRM.";
  if (m.includes("jwt") || code === "PGRST301" || e.status === 401) return "Сессия истекла. Обновите страницу и войдите снова.";
  if (m.includes("expired") || (m.includes("invalid") && m.includes("link")) || code === "otp_expired") return "Ссылка устарела или уже использована. Запросите новую.";
  if (code === "42501" || m.includes("row-level security") || m.includes("permission denied")) return "Нет прав на это действие в этом пространстве.";
  if (code === "23505") return "Такая запись уже есть.";
  if (code === "23503") return "Нельзя удалить: с этой записью связаны лиды или оплаты.";
  if (code === "PGRST204" || code === "42703" || code === "42P01") return "На сервере не хватает новых полей (миграция 004). Напишите владельцу CRM.";
  if (code === "23514") return "Недопустимое значение в одном из полей.";
  if (code === "22P02" || code === "22007" || code === "22008") return "Неверный формат числа или даты.";
  if (code === "PGRST202" || code === "42883") return "На сервере нет нужной функции (см. README, раздел «Миграции»).";
  return "Не получилось. Попробуйте ещё раз.";
}
let toastT;
function toast(text, isErr) {
  const t = $("#toast"); t.textContent = text; t.className = "toast" + (isErr ? " err" : ""); t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, isErr ? 6000 : 2500);
}
const fail = e => toast(ruErr(e), true);
function setStatus(sel, text, isErr) { const el = $(sel); if (!el) return; el.textContent = text || ""; el.classList.toggle("err", !!isErr); }

/* ---------- клиент ---------- */
let sb = null;
try {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  window.__crm = { sb }; // для отладки
} catch (e) {
  console.error(e);
}

/* ---------- состояние ---------- */
const S = {
  user: null, workspaces: [], roles: {}, ws: null,
  leads: [], scripts: [], brief: null, income: [],
  funnels: [], tasks: [], touches: [], presets: [], templates: [],
  filterStatus: "", filterNiche: store.get("crmNiche") || "", filterNoNext: false, openId: null,
  period: store.get("crmPeriod") || "month", openFunnel: null, touchOpen: null,
  channel: null, realtime: false, pendingRender: false, editingScript: null, importData: null,
};
const leadById = id => S.leads.find(l => l.id === id);
const funnelById = id => S.funnels.find(f => f.id === id);
const funnelName = id => funnelById(id)?.name || "";
const isOwner = () => S.ws && S.roles[S.ws.id] === "owner";
const label = () => LABELS[S.ws?.lead_label] || [S.ws?.lead_label || "Лиды", "лида", "Новая запись"];

function show(screen) {
  for (const id of ["bootScreen", "authScreen", "wsScreen", "app"]) $("#" + id).hidden = id !== screen;
}

/* ---------- вход ---------- */
function authErrorFromUrl() {
  const h = new URLSearchParams(location.hash.slice(1)), q = new URLSearchParams(location.search);
  const err = h.get("error_description") || q.get("error_description");
  const code = h.get("error_code") || q.get("error_code");
  if (!err && !code) return null;
  history.replaceState(null, "", location.origin + location.pathname);
  return ruErr({ message: err || "", code: code || "" });
}

let authMode = "login";
function setAuthMode(mode) {
  authMode = mode;
  const su = mode === "signup";
  $("#tabLogin").setAttribute("aria-selected", String(!su));
  $("#tabSignup").setAttribute("aria-selected", String(su));
  $("#authPass2Wrap").hidden = !su;
  $("#authPass").autocomplete = su ? "new-password" : "current-password";
  $("#authBtn").textContent = su ? "Зарегистрироваться" : "Войти";
  $("#authHint").textContent = su ? "Пароль — минимум 8 символов. Если вас пригласили, регистрируйтесь с той почтой, на которую пришло приглашение." : "Забыли пароль? Напишите владельцу пространства.";
  $("#authAsk").hidden = false; $("#authSent").hidden = true;
  setStatus("#authStatus", "");
}
$("#tabLogin").onclick = () => setAuthMode("login");
$("#tabSignup").onclick = () => setAuthMode("signup");

$("#authForm").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("#authEmail").value.trim().toLowerCase(), pass = $("#authPass").value;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setStatus("#authStatus", "Проверьте адрес почты — похоже, в нём ошибка.", true); return; }
  if (pass.length < 8) { setStatus("#authStatus", "Пароль должен быть не короче 8 символов.", true); return; }
  if (authMode === "signup" && pass !== $("#authPass2").value) { setStatus("#authStatus", "Пароли не совпадают.", true); return; }
  if (!sb) { setStatus("#authStatus", "Не загрузилась библиотека Supabase. Проверьте интернет и обновите страницу.", true); return; }
  const btn = $("#authBtn"); btn.disabled = true; setStatus("#authStatus", authMode === "signup" ? "Регистрирую…" : "Вхожу…");
  try {
    store.set("crmEmail", email);
    if (authMode === "signup") {
      const { data, error } = await sb.auth.signUp({ email, password: pass, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) throw error;
      // при включённом подтверждении почты Supabase не выдаёт ошибку для уже существующего адреса, а возвращает пользователя без identities
      if (!data.session && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw { code: "user_already_exists" };
      if (data.session) { setStatus("#authStatus", ""); $("#authPass").value = ""; $("#authPass2").value = ""; return; } // onAuthStateChange откроет CRM
      $("#authSentTo").textContent = email; $("#authAsk").hidden = true; $("#authSent").hidden = false; setStatus("#authStatus", "");
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
      setStatus("#authStatus", ""); $("#authPass").value = "";
    }
  } catch (err) { setStatus("#authStatus", ruErr(err), true); }
  finally { btn.disabled = false; }
});
$("#authAgain").onclick = () => { setAuthMode("login"); $("#authPass").focus(); };

document.addEventListener("click", async e => {
  if (!e.target.closest("[data-signout]")) return;
  try { await sb.auth.signOut(); } catch (err) { /* всё равно выходим локально */ }
  S.user = null; teardownRealtime(); show("authScreen");
});

let booted = false, acceptedFor = null;
async function onSession(session) {
  if (!session) { S.user = null; teardownRealtime(); $("#authEmail").value = store.get("crmEmail") || ""; show("authScreen"); return; }
  if (S.user?.id === session.user.id && booted) return;
  S.user = session.user; booted = true;
  $("#whoami").textContent = session.user.email || "";
  if (acceptedFor !== session.user.id) {
    acceptedFor = session.user.id;
    try {
      const { data, error } = await sb.rpc("accept_invites");
      if (error) throw error;
      if (data > 0) toast(data === 1 ? "Вас добавили в новое пространство" : `Вас добавили в пространства: ${data}`);
    } catch (err) { console.warn("accept_invites", err); }
  }
  await loadWorkspaces();
}

async function loadWorkspaces(preferId) {
  try {
    const [ws, mem] = await Promise.all([
      sb.from("workspaces").select("id,name,lead_label,created_by,created_at").order("created_at"),
      sb.from("workspace_members").select("workspace_id,role").eq("user_id", S.user.id),
    ]);
    if (ws.error) throw ws.error; if (mem.error) throw mem.error;
    S.workspaces = ws.data; S.roles = Object.fromEntries(mem.data.map(m => [m.workspace_id, m.role]));
  } catch (err) { show("wsScreen"); setStatus("#wsStatus", ruErr(err), true); return; }
  if (!S.workspaces.length) { $("#wsCancel").hidden = true; show("wsScreen"); $("#wsName").focus(); return; }
  const want = preferId || store.get("crmWs");
  const ws = S.workspaces.find(w => w.id === want) || S.workspaces[0];
  await openWorkspace(ws.id);
}

function renderWsSelect() {
  $("#wsSelect").innerHTML = S.workspaces.map(w => `<option value="${esc(w.id)}" ${w.id === S.ws?.id ? "selected" : ""}>${esc(w.name)}</option>`).join("")
    + `<option value="__new">+ Новое пространство…</option>`;
  $("#myRole").textContent = isOwner() ? "владелец" : "участник";
}
$("#wsSelect").addEventListener("change", e => {
  const v = e.target.value;
  if (v === "__new") { e.target.value = S.ws?.id || ""; $("#wsCancel").hidden = false; $("#wsName").value = ""; setStatus("#wsStatus", ""); show("wsScreen"); $("#wsName").focus(); return; }
  openWorkspace(v);
});
$("#wsCancel").onclick = () => show("app");

$("#wsForm").addEventListener("submit", async e => {
  e.preventDefault();
  const name = $("#wsName").value.trim(); if (!name) { setStatus("#wsStatus", "Введите название", true); return; }
  const lead_label = ($$("input[name=wsLabel]").find(r => r.checked) || {}).value || "Лиды";
  const id = crypto.randomUUID();
  const btn = $("#wsCreateBtn"); btn.disabled = true; setStatus("#wsStatus", "Создаю…");
  try {
    // без .select(): строка станет видна только после триггера, назначающего владельца
    const { error } = await sb.from("workspaces").insert({ id, name, lead_label, created_by: S.user.id });
    if (error) throw error;
    setStatus("#wsStatus", ""); e.target.reset();
    await loadWorkspaces(id);
  } catch (err) { setStatus("#wsStatus", ruErr(err), true); }
  finally { btn.disabled = false; }
});

/* ---------- загрузка данных пространства ---------- */
async function fetchAll(table, cols = "*", order = "created_at") {
  const out = []; const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await sb.from(table).select(cols).eq("workspace_id", S.ws.id).order(order, { ascending: false }).range(from, from + page - 1);
    if (error) throw error;
    out.push(...data); if (data.length < page) break;
  }
  return out;
}
const loaders = {
  leads: async () => { S.leads = await fetchAll("leads"); },
  scripts: async () => { S.scripts = await fetchAll("scripts"); },
  income: async () => { S.income = await fetchAll("income"); },
  funnels: async () => { S.funnels = (await fetchAll("funnels")).sort((a, b) => (Number(a.ord) || 0) - (Number(b.ord) || 0) || (a.created_at || "").localeCompare(b.created_at || "")); },
  funnel_tasks: async () => { S.tasks = (await fetchAll("funnel_tasks")).sort((a, b) => (Number(a.ord) || 0) - (Number(b.ord) || 0)); },
  touches: async () => { S.touches = await fetchAll("touches"); },
  briefs: async () => {
    const { data, error } = await sb.from("briefs").select("data,updated_at").eq("workspace_id", S.ws.id).maybeSingle();
    if (error) throw error; S.brief = data ? (data.data || {}) : null;
  },
};
async function reload(...tables) {
  const wsId = S.ws?.id; if (!wsId) return;
  try { await Promise.all((tables.length ? tables : Object.keys(loaders)).map(t => loaders[t]())); }
  catch (err) { fail(err); }
  if (S.ws?.id === wsId) safeRender();
}

async function loadPresets() {
  if (S.presets.length) return;
  try {
    const [p, t] = await Promise.all([sb.from("funnel_presets").select("*").order("ord"), sb.from("funnel_templates").select("*").order("ord")]);
    if (p.error) throw p.error; if (t.error) throw t.error;
    S.presets = p.data; S.templates = t.data;
  } catch (err) { console.warn("presets", err); }
}

async function openWorkspace(id) {
  S.ws = S.workspaces.find(w => w.id === id); if (!S.ws) return;
  store.set("crmWs", id);
  S.leads = []; S.scripts = []; S.income = []; S.brief = null; S.openId = null; S.filterStatus = ""; S.importData = null;
  S.funnels = []; S.tasks = []; S.touches = []; S.openFunnel = null; S.touchOpen = null; S.filterNoNext = false;
  loadPresets();
  closeSheets(); renderWsSelect(); applyLabels(); show("app");
  $("#todayList").innerHTML = `<li class="empty">Загружаю…</li>`; $("#list").innerHTML = "";
  await reload();
  setupRealtime();
}

function applyLabels() {
  const [plural, acc, fresh] = label();
  $("#addBtn").textContent = "+ Добавить " + acc;
  $("#addH").textContent = fresh;
  $("#jumpLeads").textContent = plural;
  $("#listH").textContent = "Все " + plural.toLowerCase();
  $$("[data-owner]").forEach(el => { el.hidden = !isOwner(); });
  document.title = `${S.ws.name} · Tina CRM`;
}

/* ---------- реалтайм ---------- */
let rtTimers = {};
function teardownRealtime() { if (S.channel) { try { sb.removeChannel(S.channel); } catch (e) {} S.channel = null; } S.realtime = false; }
function setupRealtime() {
  teardownRealtime();
  const wsId = S.ws.id;
  const bump = table => { clearTimeout(rtTimers[table]); rtTimers[table] = setTimeout(() => reload(table), 250); };
  try {
    const ch = sb.channel("ws-" + wsId);
    for (const t of ["leads", "scripts", "income", "briefs", "funnels", "funnel_tasks", "touches"]) {
      ch.on("postgres_changes", { event: "*", schema: "public", table: t, filter: `workspace_id=eq.${wsId}` }, () => bump(t));
    }
    ch.subscribe(status => {
      S.realtime = status === "SUBSCRIBED";
      $("#dbNote").textContent = S.realtime ? "" : (status === "CHANNEL_ERROR" || status === "TIMED_OUT" ? "Живые обновления недоступны — данные обновляются после ваших изменений. Чтобы увидеть правки коллег, обновите страницу." : "");
    });
    S.channel = ch;
  } catch (e) { console.warn("realtime", e); }
}
// если вкладка долго была в фоне — перечитать
document.addEventListener("visibilitychange", () => { if (!document.hidden && S.ws && !S.realtime) reload(); });

/* ---------- отрисовка ---------- */
function safeRender() {
  const a = document.activeElement;
  if (a && a.closest && a.closest("#list, #scripts, #incList, #funnelScreen, #todayList") && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { S.pendingRender = true; return; }
  render();
}
document.addEventListener("focusout", () => { if (S.pendingRender) setTimeout(() => { if (S.pendingRender) { S.pendingRender = false; safeRender(); } }, 0); });

function render() {
  if (!S.ws) return;
  fillSelects();
  renderBrief(); renderToday(); renderLeads(); renderFunnels(); renderScripts(); renderIncome();
  $("#nicheList").innerHTML = [...new Set([...S.leads.map(l => l.niche), ...S.scripts.map(s => s.niche)].filter(Boolean))].sort().map(n => `<option value="${esc(n)}">`).join("");
}

/* ---------- справочники для выпадающих списков ---------- */
const owners = () => [...new Set(S.leads.map(l => (l.owner_name || "").trim()).filter(Boolean))].sort();
const funnelOptions = (cur, emptyText) => (emptyText != null ? `<option value="">${esc(emptyText)}</option>` : "")
  + S.funnels.map(f => `<option value="${esc(f.id)}" ${f.id === cur ? "selected" : ""}>${esc(f.name)}${f.subtitle ? " · " + esc(f.subtitle) : ""}${f.status === "paused" ? " (пауза)" : ""}</option>`).join("");
const referrerOptions = (cur, selfId) => `<option value="">— никто —</option>` + S.leads.filter(l => l.contact_type === "referrer" && l.id !== selfId)
  .sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(r => `<option value="${esc(r.id)}" ${r.id === cur ? "selected" : ""}>${esc(short(r.name))}</option>`).join("");
function keepSelect(sel, html) { const el = $(sel), cur = el.value; el.innerHTML = html; if ([...el.options].some(o => o.value === cur)) el.value = cur; }
function fillSelects() {
  const ow = owners();
  $("#teamList").innerHTML = ow.map(o => `<option value="${esc(o)}">`).join("");
  const ownerOpts = `<option value="">Все ведущие</option>` + ow.map(o => `<option>${esc(o)}</option>`).join("");
  keepSelect("#fOwner", ownerOpts); keepSelect("#fOwnerF", ownerOpts);
  keepSelect("#fFunnel", `<option value="">Все воронки</option><option value="__none">Без воронки</option>` + funnelOptions());
  if ($("#addForm").hidden) {
    keepSelect("#f_funnel", S.funnels.length ? `<option value="">— выберите —</option>` + funnelOptions(null) : `<option value="">Сначала создайте воронку</option>`);
    keepSelect("#f_ref", referrerOptions(""));
  }
  if ($("#scriptForm").hidden) keepSelect("#s_funnel", funnelOptions(null, "— без воронки —"));
  if ($("#incForm").hidden) keepSelect("#i_lead", `<option value="">— не привязывать —</option>` + S.leads.filter(l => l.contact_type !== "referrer")
    .sort((a, b) => (b.status === "client") - (a.status === "client") || (a.name || "").localeCompare(b.name || "")).map(l => `<option value="${esc(l.id)}">${esc(short(l.name))}${l.status === "client" ? " · клиент" : ""}</option>`).join(""));
}

function incomeTotals() {
  const m = today().slice(0, 7);
  const received = S.income.filter(r => r.kind === "received" && (r.happened_on || r.created_at || "").slice(0, 7) === m).reduce((s, r) => s + Number(r.amount || 0), 0);
  const expected = S.income.filter(r => r.kind === "expected").reduce((s, r) => s + Number(r.amount || 0), 0);
  return { received, expected, has: S.income.length > 0 };
}
function moneyHtml() {
  const b = S.brief || {}, t = incomeTotals();
  const got = t.has ? t.received : Number(b.monthIncome || 0);
  const exp = t.has ? t.expected : Number(b.expected || 0);
  const goal = Number(b.goal) || DEFAULT_GOAL;
  const monthName = t.has ? MONTHS[new Date().getMonth()] : (b.monthName || MONTHS[new Date().getMonth()]);
  const pct = Math.min(100, Math.round(got / goal * 100));
  return `<div class="nums"><span>Доход за ${esc(monthName)}: <b>${rub(got)} ₽</b></span><span class="note">ожидается ещё ${rub(exp)} ₽ · цель ${rub(goal)} ₽ (${pct}%)</span></div><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Выполнение цели"><i style="width:${pct}%"></i></div>`;
}

/* ---------- задачи воронок ---------- */
// окно, за которое считается факт: ежедневная — сегодня, остальные — с начала текущего цикла
function taskWindowStart(t) { return t.period === "daily" ? today() : (t.cycle_start || (t.created_at || today()).slice(0, 10)); }
function taskFact(t) {
  const from = taskWindowStart(t), to = today();
  const manual = t.period === "daily" && t.cycle_start !== today() ? 0 : (t.manual_done || 0);
  const auto = t.counts_touches ? S.touches.filter(x => x.funnel_id === t.funnel_id && x.happened_on >= from && x.happened_on <= to).length : 0;
  return auto + manual;
}
const taskDue = t => t.status === "active" && t.period !== "event" && t.next_date && t.next_date <= today() && funnelById(t.funnel_id)?.status !== "paused";
function factText(t) { const f = taskFact(t); return t.norm_n ? `${f} из ${t.norm_n}` : String(f); }
function nextCycleDate(t) {
  const d = today();
  if (t.period === "daily") return addDays(d, 1);
  if (t.period === "weekly") return addDays(d, 7);
  if (t.period === "monthly") return addMonths(d, 1);
  return null;
}
// пункты «По воронкам» для брифа: задачи на сегодня + невыплаченные бонусы рекомендателям
function autoPlanItems() {
  const items = S.tasks.filter(taskDue).sort((a, b) => funnelName(a.funnel_id).localeCompare(funnelName(b.funnel_id)) || (Number(a.ord) || 0) - (Number(b.ord) || 0))
    .map(t => ({ html: `<b>${esc(funnelName(t.funnel_id))}:</b> ${esc(t.title)}${t.norm ? ` — ${esc(t.norm)}` : ""} <span class="note">(сделано ${esc(factText(t))})</span>`, fid: t.funnel_id }));
  for (const r of pendingBonuses()) items.push({ html: `<b>Бонус:</b> выплатить ${esc(short(r.ref.name))}${r.ref.bonus ? ` (${esc(r.ref.bonus)})` : ""} за клиента ${esc(short(r.lead.name))}`, goto: r.ref.id });
  return items;
}
function pendingBonuses() {
  const out = [];
  for (const l of S.leads) {
    if (l.status !== "client" || !l.referred_by) continue;
    const ref = leadById(l.referred_by);
    if (ref && ref.status !== "bonus_paid" && !ref.bonus_paid_on) out.push({ lead: l, ref });
  }
  return out;
}

function renderBrief() {
  const b = S.brief || {};
  $("#briefDate").textContent = b.date || "";
  $("#money").innerHTML = moneyHtml();
  const y = b.yesterday || [], p = b.plan || [];
  const auto = autoPlanItems();
  $("#briefYesterday").innerHTML = y.length ? y.map(x => `<li>${esc(x)}</li>`).join("") : `<li class="empty" style="list-style:none;margin-left:-20px">—</li>`;
  $("#briefPlan").innerHTML = p.length ? p.map(x => `<li>${esc(x)}</li>`).join("") : `<li class="empty" style="list-style:none;margin-left:-20px">${auto.length ? "Ручного плана нет." : isOwner() ? "Плана пока нет — нажмите «Изменить»." : "Плана пока нет."}</li>`;
  $("#briefAutoWrap").hidden = !auto.length;
  $("#briefAuto").innerHTML = auto.map(i => `<li>${i.fid ? `<button type="button" class="linky" data-open-funnel="${esc(i.fid)}">${i.html}</button>` : i.goto ? `<button type="button" class="linky" data-goto="${esc(i.goto)}">${i.html}</button>` : i.html}</li>`).join("");
}

/* ---------- «Кому написать сегодня» ---------- */
const needsNext = l => !FINAL.has(l.status);
function touchFormHtml(l, compact) {
  const next = addDays(today(), 3);
  return `<form class="touchform" data-touch-form="${esc(l.id)}">
    <div class="grid">
      <label>Когда<input type="date" name="on" value="${today()}" required></label>
      <label>Канал<input name="channel" list="channelList" placeholder="Telegram" value=""></label>
      <label class="wide">Что отправила<input name="what" value="${esc(compact ? l.next_action || "" : "")}" placeholder="кейс + вопрос про сроки"></label>
    </div>
    ${needsNext(l) ? `<div class="grid">
      <label>Следующее касание *<input type="date" name="next" value="${next}" required></label>
      <label class="wide">Что сделать *<input name="action" required placeholder="Напомнить, прислать кейс, позвонить"></label>
    </div>` : ""}
    <div class="row"><span class="status" data-tst></span><span class="btns"><button class="btn small" type="button" data-touch-cancel>Отмена</button><button class="btn primary small" type="submit">Сохранить касание</button></span></div>
  </form>`;
}
function renderToday() {
  const t = today();
  const due = S.leads.filter(l => l.next_date && l.next_date <= t && needsNext(l))
    .sort((a, b) => (b.hotness || 0) - (a.hotness || 0) || a.next_date.localeCompare(b.next_date));
  const noNext = S.leads.filter(l => !l.next_date && needsNext(l)).length;
  const items = due.map(l => `<li class="tli">
    <div class="tl-main"><button type="button" class="linky" data-goto="${esc(l.id)}">${esc(short(l.name))}</button>
      <span class="note">${[l.city, SL[l.status], funnelName(l.funnel_id), l.owner_name].filter(Boolean).map(esc).join(" · ")}</span>
      ${l.next_date < t ? `<span class="late">просрочено с ${fmt(l.next_date)}</span>` : ""}</div>
    ${l.next_action ? `<div class="tl-act">${esc(l.next_action)}</div>` : ""}
    ${S.touchOpen === l.id ? touchFormHtml(l, true) : `<div><button class="btn small" type="button" data-touch-open="${esc(l.id)}">Касание сделано → назначить следующее</button></div>`}
  </li>`);
  $("#todayList").innerHTML = (items.length ? items.join("") : `<li class="empty">На сегодня касаний нет.</li>`)
    + (noNext ? `<li class="nonext"><button type="button" class="linky warnlink" data-nonext>Без даты следующего касания: ${noNext} — назначить</button></li>` : "");
}

/* ---------- лиды ---------- */
function leadFilters() {
  return { q: $("#q").value.trim().toLowerCase(), ft: $("#fType").value, fc: $("#fCity").value, ff: $("#fFunnel").value, fo: $("#fOwner").value, fx: $("#fCtype").value };
}
function renderLeads() {
  const L = S.leads;
  const hasRef = L.some(l => l.contact_type === "referrer");
  const chips = hasRef ? [...STATUSES, ...REF_STATUSES.filter(([k]) => !STATUSES.some(([s]) => s === k))] : STATUSES;
  $("#funnel").innerHTML = chips.map(([k, v]) => `<button class="chip" type="button" data-f="${k}" aria-pressed="${S.filterStatus === k}"><small>${v}</small><b>${L.filter(l => l.status === k).length}</b></button>`).join("");
  const cities = [...new Set(L.map(l => l.city).filter(Boolean))].sort();
  keepSelect("#fCity", `<option value="">Все города</option>` + cities.map(c => `<option>${esc(c)}</option>`).join(""));
  const { q, ft, fc, ff, fo, fx } = leadFilters(), so = $("#fSort").value;
  const niches = {}; L.forEach(l => { const n = nicheOf(l); niches[n] = (niches[n] || 0) + 1; });
  const order = Object.keys(niches).sort((a, b) => a === "Мои клиенты" ? -1 : b === "Мои клиенты" ? 1 : niches[b] - niches[a]);
  if (S.filterNiche && !niches[S.filterNiche] && !S.scripts.some(s => s.niche === S.filterNiche)) S.filterNiche = "";
  $("#nicheTabs").innerHTML = [`<button class="tab" role="tab" type="button" data-n="" aria-selected="${!S.filterNiche}">Все<span>${L.length}</span></button>`,
    ...order.map(n => `<button class="tab" role="tab" type="button" data-n="${esc(n)}" aria-selected="${S.filterNiche === n}">${esc(cap(n))}<span>${niches[n]}</span></button>`)].join("");
  const rows = L.filter(l => (!S.filterNiche || nicheOf(l) === S.filterNiche) && (!S.filterStatus || l.status === S.filterStatus) && (!ft || l.type === ft) && (!fc || l.city === fc)
    && (!ff || (ff === "__none" ? !l.funnel_id : l.funnel_id === ff)) && (!fo || (l.owner_name || "").trim() === fo) && (!fx || (l.contact_type || "lead") === fx)
    && (!S.filterNoNext || (!l.next_date && needsNext(l)))
    && (!q || [l.name, l.city, l.niche, l.hook, l.contact, l.notes, l.instagram, l.decision_maker, l.next_action].join(" ").toLowerCase().includes(q)));
  rows.sort(so === "hot" ? (a, b) => (b.hotness || 0) - (a.hotness || 0) : so === "next" ? (a, b) => (a.next_date || "9").localeCompare(b.next_date || "9") : (a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  $("#count").innerHTML = `${rows.length} из ${L.length}` + (S.filterNoNext ? ` · <button type="button" class="linky" data-nonext-off>без даты касания ✕</button>` : "");
  let html = "";
  if (!L.length) html = `<p class="empty">Пока пусто. Нажмите «${esc($("#addBtn").textContent)}»${isOwner() ? " или импортируйте JSON из меню" : ""}.</p>`;
  else if (!rows.length) html = `<p class="empty">Под фильтр ничего не попало.</p>`;
  else if (S.filterNiche) html = rows.map(card).join("");
  else order.forEach(n => { const g = rows.filter(l => nicheOf(l) === n); if (g.length) html += `<h3 class="group">${esc(cap(n))}<span>${g.length}</span></h3>` + g.map(card).join(""); });
  $("#list").innerHTML = html;
}

const touchesOf = id => S.touches.filter(x => x.lead_id === id).sort((a, b) => (b.happened_on || "").localeCompare(a.happened_on || "") || (b.created_at || "").localeCompare(a.created_at || ""));
function card(l) {
  const ref = l.contact_type === "referrer";
  const opts = statusesOf(l).map(([k, v]) => `<option value="${k}" ${l.status === k ? "selected" : ""}>${v}</option>`).join("");
  const nm = l.name || "";
  const tc = touchesOf(l.id);
  const brought = ref ? S.leads.filter(x => x.referred_by === l.id) : [];
  const refBy = !ref && l.referred_by ? leadById(l.referred_by) : null;
  const pillDate = l.next_date ? " · " + fmt(l.next_date) : (needsNext(l) ? " · нет даты" : "");
  return `<details class="lead" data-id="${esc(l.id)}" ${S.openId === l.id ? "open" : ""}>
  <summary><span class="heat" data-h="${l.hotness || 0}" title="Горячесть">${l.hotness || "–"}</span>
    <span class="who"><b>${esc(short(nm))}${ref ? ` <span class="tag">рекомендатель</span>` : ""}</b><span>${l.city ? `<strong class="city">📍 ${esc(l.city)}</strong> · ` : ""}${esc([funnelName(l.funnel_id) || (ref ? "" : "без воронки"), l.niche, l.owner_name].filter(Boolean).join(" · "))}${tc.length ? ` · ✉ ${tc.length}` : ""}</span></span>
    <span class="pill" data-s="${esc(l.status)}" ${!l.next_date && needsNext(l) ? 'data-warn="1"' : ""}>${SL[l.status] || esc(l.status)}${pillDate}</span>
    ${l.next_action && needsNext(l) ? `<span class="hook">→ ${esc(l.next_action)}</span>` : l.hook ? `<span class="hook">${esc(l.hook)}</span>` : ""}</summary>
  <div class="body">
    ${l.message ? `<div class="msg"><div class="row"><b>Готовое сообщение</b><button class="btn copy small" type="button" data-copy>Скопировать</button></div><p>${esc(l.message)}</p></div>` : ""}
    <dl class="facts">
      ${nm.includes(",") ? `<div><dt>Кто</dt><dd>${esc(nm.split(",").slice(1).join(",").trim())}</dd></div>` : ""}
      <div><dt>Сайт</dt><dd>${link(l.site)}${l.site_note ? ` — ${esc(l.site_note)}` : ""}</dd></div>
      ${l.instagram ? `<div><dt>Instagram</dt><dd>${link(l.instagram)}</dd></div>` : ""}
      ${l.socials ? `<div><dt>Соцсети</dt><dd>${link(l.socials)}</dd></div>` : ""}
      <div><dt>Контакт</dt><dd>${link(l.contact)}</dd></div>
      ${l.reviews != null ? `<div><dt>Отзывы</dt><dd>${esc(l.reviews)}</dd></div>` : ""}
      ${l.source ? `<div><dt>Источник</dt><dd>${link(l.source)}</dd></div>` : ""}
      ${refBy ? `<div><dt>Привёл</dt><dd><button type="button" class="linky" data-goto="${esc(refBy.id)}">${esc(short(refBy.name))}</button></dd></div>` : ""}
      ${brought.length ? `<div><dt>Привёл лидов</dt><dd>${brought.map(b => `<button type="button" class="linky" data-goto="${esc(b.id)}">${esc(short(b.name))}</button> <span class="note">${esc(SL[b.status] || "")}</span>`).join(", ")}</dd></div>` : ""}
    </dl>
    <div class="grid">
      <label>Воронка${ref ? "" : " *"}<select data-k="funnel_id">${!l.funnel_id ? `<option value="">— выберите —</option>` : ""}${funnelOptions(l.funnel_id)}</select></label>
      <label>Тип контакта<select data-k="contact_type"><option value="lead" ${!ref ? "selected" : ""}>Лид</option><option value="referrer" ${ref ? "selected" : ""}>Рекомендатель</option></select></label>
      <label>Статус<select data-k="status">${opts}</select></label>
      <label>Кто ведёт<input data-k="owner_name" list="teamList" value="${esc(l.owner_name || "")}" placeholder="Катя"></label>
    </div>
    <div class="grid">
      <label>Следующее касание${needsNext(l) ? " *" : ""}<input type="date" data-k="next_date" value="${esc(l.next_date || "")}"></label>
      <label class="wide">Что сделать${needsNext(l) ? " *" : ""}<input data-k="next_action" value="${esc(l.next_action || "")}" placeholder="Написать: кейс + вопрос"></label>
    </div>
    <div class="grid">
      <label>Горячесть<input type="number" min="1" max="5" data-k="hotness" inputmode="numeric" value="${l.hotness || ""}"></label>
      <label>Тип клиента<select data-k="client_kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${(l.client_kind || "new") === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <label>Город<input data-k="city" value="${esc(l.city || "")}"></label>
      <label>Ниша<input data-k="niche" list="nicheList" value="${esc(l.niche || "")}"></label>
      <label>Instagram<input data-k="instagram" value="${esc(l.instagram || "")}" placeholder="ссылка"></label>
      <label>Сайт<input data-k="site" value="${esc(l.site || "")}" placeholder="ссылка"></label>
      <label>ЛПР<input data-k="decision_maker" value="${esc(l.decision_maker || "")}" placeholder="имя + контакт"></label>
      ${ref ? `<label>Бонус<input data-k="bonus" value="${esc(l.bonus || "")}" placeholder="10 000 ₽ / 100 $ / скидка"></label>
      <label>Бонус выплачен<input type="date" data-k="bonus_paid_on" value="${esc(l.bonus_paid_on || "")}"></label>`
      : `<label>Кто привёл<select data-k="referred_by">${referrerOptions(l.referred_by, l.id)}</select></label>`}
    </div>
    <label>Заметки<textarea data-k="notes" placeholder="Возражения, что обсуждали, что обещала отправить">${esc(l.notes || "")}</textarea></label>
    <div class="touches">
      <div class="row"><b class="role">Касания${tc.length ? ` · ${tc.length}` : ""}</b>${S.touchOpen === l.id ? "" : `<button class="btn small" type="button" data-touch-open="${esc(l.id)}">+ касание</button>`}</div>
      ${S.touchOpen === l.id ? touchFormHtml(l, false) : ""}
      ${tc.length ? `<ul class="tlog">${tc.map(x => `<li><span class="d">${fmt(x.happened_on)}</span><span>${x.channel ? `<b>${esc(x.channel)}</b> · ` : ""}${esc(x.what || "—")}${x.by_email ? ` <span class="note">· ${esc(x.by_email.split("@")[0])}</span>` : ""}</span><span data-askwrap><button class="btn small" type="button" data-ask="touch" data-id="${esc(x.id)}" aria-label="Удалить касание">✕</button></span></li>`).join("")}</ul>` : `<p class="note" style="margin:0">Касаний пока не было.</p>`}
    </div>
    <div class="row"><span class="status" data-st></span><span data-askwrap><button class="btn small" type="button" data-ask="lead" data-id="${esc(l.id)}">Удалить</button></span></div>
  </div></details>`;
}

/* ---------- воронки ---------- */
function periodRange() {
  const t = today();
  if (S.period === "month") return [t.slice(0, 8) + "01", t];
  if (S.period === "30") return [addDays(t, -29), t];
  return ["0000-01-01", "9999-12-31"];
}
function funnelStats(fid) {
  const [from, to] = periodRange(), inR = d => !!d && d.slice(0, 10) >= from && d.slice(0, 10) <= to;
  const fo = $("#fOwnerF").value;
  const leads = S.leads.filter(l => (fid === "__none" ? !l.funnel_id : l.funnel_id === fid) && (!fo || (l.owner_name || "").trim() === fo));
  const ids = new Set(leads.map(l => l.id));
  const touches = S.touches.filter(x => (fid === "__none" ? !x.funnel_id : x.funnel_id === fid) && inR(x.happened_on) && (!fo || ids.has(x.lead_id))).length;
  const replied = leads.filter(l => inR(l.replied_at)).length;
  const calls = leads.filter(l => inR(l.call_at)).length;
  const clients = leads.filter(l => inR(l.client_at)).length;
  const income = S.income.filter(r => r.kind === "received" && r.lead_id && ids.has(r.lead_id) && inR(r.happened_on || r.created_at)).reduce((s, r) => s + Number(r.amount || 0), 0);
  return { leads: leads.length, touches, replied, calls, clients, income };
}
const pct = (a, b) => b ? (Math.round(a / b * 1000) / 10).toLocaleString("ru-RU") + " %" : "—";
function renderFunnels() {
  $$("#periodSeg [data-period]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.period === S.period)));
  if (S.openFunnel && !funnelById(S.openFunnel)) S.openFunnel = null;
  $("#funnelHome").hidden = !!S.openFunnel; $("#funnelScreen").hidden = !S.openFunnel;
  if (S.openFunnel) { renderFunnelScreen(funnelById(S.openFunnel)); return; }
  if (!S.funnels.length) {
    $("#funnelGrid").innerHTML = `<div class="empty-card"><p>Воронок пока нет. Воронка — это способ поиска клиентов со своим регламентом задач, лидами и цифрами.</p>
      <div class="btns"><button class="btn primary" type="button" id="seedFunnels">Создать стартовый набор (6 воронок)</button><button class="btn" type="button" data-funnel-new>+ Своя воронка</button></div></div>`;
    $("#funnelSummary").innerHTML = ""; return;
  }
  $("#funnelGrid").innerHTML = S.funnels.map(f => {
    const s = funnelStats(f.id), due = S.tasks.filter(t => t.funnel_id === f.id && taskDue(t)).length;
    return `<button type="button" class="fcard" data-open-funnel="${esc(f.id)}" ${f.status === "paused" ? 'data-paused="1"' : ""}>
      <span class="fhead"><b>${esc(f.name)}</b><span class="pill" data-s="${f.status === "paused" ? "lost" : "client"}">${f.status === "paused" ? "пауза" : "активна"}</span></span>
      ${f.subtitle ? `<span class="note">${esc(f.subtitle)}</span>` : ""}
      <span class="fnums"><span><b>${s.touches}</b><small>касаний</small></span><span><b>${s.replied}</b><small>ответили</small></span><span><b>${s.clients}</b><small>клиентов</small></span><span><b>${rub(s.income)}</b><small>доход, ₽</small></span></span>
      <span class="note">${s.leads} в воронке${due ? ` · задач на сегодня: ${due}` : ""}</span>
    </button>`;
  }).join("") + `<button type="button" class="fcard add" data-funnel-new><b>+ Воронка</b><span class="note">новый способ поиска клиентов</span></button>`;
  // сводный срез
  const rows = S.funnels.map(f => ({ name: f.name + (f.subtitle ? ` · ${f.subtitle}` : ""), id: f.id, ...funnelStats(f.id) }));
  const none = funnelStats("__none"); if (none.leads || none.touches) rows.push({ name: "Без воронки", id: "", ...none });
  const tot = rows.reduce((a, r) => ({ touches: a.touches + r.touches, replied: a.replied + r.replied, calls: a.calls + r.calls, clients: a.clients + r.clients, income: a.income + r.income }), { touches: 0, replied: 0, calls: 0, clients: 0, income: 0 });
  const tr = (r, isTot) => `<tr${isTot ? ' class="tot"' : ""}><th scope="row">${isTot ? "Итого" : r.id ? `<button type="button" class="linky" data-open-funnel="${esc(r.id)}">${esc(r.name)}</button>` : esc(r.name)}</th><td>${r.touches}</td><td>${r.replied}</td><td>${r.calls}</td><td>${r.clients}</td><td>${pct(r.clients, r.touches)}</td><td>${rub(r.income)}</td></tr>`;
  $("#funnelSummary").innerHTML = `<h3 class="group" style="margin:0 0 6px">Срез по воронкам · ${{ month: "этот месяц", "30": "последние 30 дней", all: "всё время" }[S.period]}</h3>
    <div class="tablewrap"><table class="stat"><thead><tr><th scope="col">Воронка</th><th scope="col">Касаний</th><th scope="col">Ответили</th><th scope="col">Созвонов</th><th scope="col">Клиентов</th><th scope="col">Касание → клиент</th><th scope="col">Доход, ₽</th></tr></thead>
    <tbody>${rows.map(r => tr(r)).join("")}${tr(tot, true)}</tbody></table></div>
    <p class="note">Цифры считаются сами: касания из лога, ответы, созвоны и клиенты по датам смены статуса, доход по оплатам, привязанным к лидам.</p>`;
}

function renderFunnelScreen(f) {
  const s = funnelStats(f.id);
  const tasks = S.tasks.filter(t => t.funnel_id === f.id);
  const leads = S.leads.filter(l => l.funnel_id === f.id).sort((a, b) => (a.next_date || "9").localeCompare(b.next_date || "9"));
  const scripts = S.scripts.filter(x => x.funnel_id === f.id);
  const canDelete = !leads.length && !S.touches.some(x => x.funnel_id === f.id);
  $("#funnelScreen").innerHTML = `<div class="fscreen" data-fid="${esc(f.id)}">
    <div class="row"><button class="btn small" type="button" data-funnel-back>← Все воронки</button>
      <span class="btns">${canDelete ? `<span data-askwrap><button class="btn small" type="button" data-ask="funnel" data-id="${esc(f.id)}">Удалить воронку</button></span>` : `<span class="note">Удалить нельзя: в воронке есть лиды. Можно поставить на паузу.</span>`}</span></div>
    <div class="grid">
      <label>Название<input data-fk="name" value="${esc(f.name)}" maxlength="80"></label>
      <label>Уточнение<input data-fk="subtitle" value="${esc(f.subtitle || "")}" maxlength="120" placeholder="ниша, гео"></label>
      <label>Статус<select data-fk="status"><option value="active" ${f.status !== "paused" ? "selected" : ""}>Активна</option><option value="paused" ${f.status === "paused" ? "selected" : ""}>Пауза</option></select></label>
    </div>
    <div class="fnums big"><span><b>${s.touches}</b><small>касаний</small></span><span><b>${s.replied}</b><small>ответили</small></span><span><b>${s.calls}</b><small>созвонов</small></span><span><b>${s.clients}</b><small>клиентов</small></span><span><b>${rub(s.income)}</b><small>доход, ₽</small></span><span><b>${pct(s.clients, s.touches)}</b><small>касание → клиент</small></span></div>

    <div class="row"><h3 class="group" style="margin:0">Задачи воронки</h3><button class="btn small" type="button" data-task-add="${esc(f.id)}">+ Задача</button></div>
    ${tasks.length ? `<div class="tasks">${tasks.map(taskRow).join("")}</div>` : `<p class="note">Задач нет. Добавьте регламент: что и сколько делать по этому способу.</p>`}
    <p class="note">Факт по задачам «сообщения/касания» считается сам из лога касаний лидов этой воронки, по остальным — кнопкой «+1». Ежедневные и еженедельные после «Готово» переносятся на следующий срок, разовые закрываются.</p>

    <div class="row"><h3 class="group" style="margin:0">Лиды воронки<span>${leads.length}</span></h3><button class="btn small" type="button" data-add-to-funnel="${esc(f.id)}">+ Лид в воронку</button></div>
    ${leads.length ? `<ul class="flist">${leads.map(l => `<li><button type="button" class="linky" data-goto="${esc(l.id)}">${esc(short(l.name))}</button><span class="pill" data-s="${esc(l.status)}">${esc(SL[l.status] || l.status)}${l.next_date ? " · " + fmt(l.next_date) : ""}</span><span class="note">${esc([l.owner_name, l.next_action].filter(Boolean).join(" · "))}</span></li>`).join("")}</ul>` : `<p class="note">Лидов пока нет.</p>`}

    <h3 class="group">Скрипты воронки<span>${scripts.length}</span></h3>
    ${scripts.length ? scripts.map(x => `<article class="script"><h3>${esc(x.title)}</h3>${x.when ? `<div class="when">${esc(x.when)}</div>` : ""}<p>${esc(x.text)}</p><button class="btn copy small" type="button" data-copy>Скопировать</button></article>`).join("") : `<p class="note">Привяжите скрипт к воронке в разделе «Скрипты» (поле «Воронка»).</p>`}
  </div>`;
}
function taskRow(t) {
  const due = taskDue(t);
  return `<div class="task" data-tid="${esc(t.id)}" ${t.status !== "active" ? 'data-off="1"' : ""}>
    <label class="tt">Задача<input data-tk="title" value="${esc(t.title)}"></label>
    <label>Периодичность<select data-tk="period">${Object.entries(PERIODS).map(([k, v]) => `<option value="${k}" ${t.period === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
    <label>Норма<input data-tk="norm" value="${esc(t.norm || "")}" placeholder="10 в день"></label>
    <label>Норма, шт<input data-tk="norm_n" type="number" min="0" inputmode="numeric" value="${t.norm_n ?? ""}"></label>
    <div class="fact"><small>Факт</small><b>${esc(factText(t))}</b>${t.counts_touches ? `<span class="note">из касаний</span>` : ""}</div>
    <label>Следующая дата<input type="date" data-tk="next_date" value="${esc(t.next_date || "")}" ${t.period === "event" ? "disabled" : ""}></label>
    <label>Статус<select data-tk="status">${Object.entries(TASK_ST).map(([k, v]) => `<option value="${k}" ${t.status === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
    <label class="chk"><input type="checkbox" data-tk="counts_touches" ${t.counts_touches ? "checked" : ""}> считать из касаний</label>
    <div class="btns tact">${due ? `<span class="late">на сегодня</span>` : ""}<button class="btn small" type="button" data-task-plus="${esc(t.id)}">+1</button>${t.status === "active" && t.period !== "event" ? `<button class="btn small primary" type="button" data-task-done="${esc(t.id)}">Готово</button>` : ""}<span data-askwrap><button class="btn small" type="button" data-ask="task" data-id="${esc(t.id)}" aria-label="Удалить задачу">✕</button></span></div>
  </div>`;
}

async function createFunnel({ name, subtitle, preset }, ord) {
  const id = crypto.randomUUID();
  const { error } = await sb.from("funnels").insert({ id, workspace_id: S.ws.id, name, subtitle: subtitle || "", preset: preset || null, ord: ord ?? (S.funnels.length + 1) });
  if (error) throw error;
  const tpl = S.templates.filter(t => t.preset === preset);
  if (tpl.length) {
    const d = today();
    const rows = tpl.map(t => ({ workspace_id: S.ws.id, funnel_id: id, title: t.title, period: t.period, norm: t.norm || "", norm_n: t.norm_n, counts_touches: !!t.counts_touches, next_date: t.period === "event" ? null : d, cycle_start: d, ord: t.ord }));
    const r = await sb.from("funnel_tasks").insert(rows); if (r.error) throw r.error;
  }
  return id;
}

function renderScripts() {
  const fn = S.filterNiche;
  const sc = S.scripts.filter(s => !fn || s.niche === fn).sort((a, b) => (a.niche || "").localeCompare(b.niche || "") || (Number(a.ord) || 0) - (Number(b.ord) || 0));
  $("#scriptsNote").textContent = fn ? `ниша: ${cap(fn)}` : "все ниши · выберите вкладку выше";
  $("#scripts").innerHTML = sc.length ? sc.map(s => `<article class="script" data-sid="${esc(s.id)}"><h3>${esc(s.title)}${fn ? "" : ` <span class="note">· ${esc(cap(s.niche || "без ниши"))}</span>`}${s.funnel_id && funnelName(s.funnel_id) ? ` <span class="tag">${esc(funnelName(s.funnel_id))}</span>` : ""}</h3>${s.when ? `<div class="when">${esc(s.when)}</div>` : ""}<p>${esc(s.text)}</p>
    <div class="row"><button class="btn copy small" type="button" data-copy>Скопировать</button><span class="btns"><button class="btn small" type="button" data-edit-script="${esc(s.id)}">Изменить</button><span data-askwrap><button class="btn small" type="button" data-ask="script" data-id="${esc(s.id)}">Удалить</button></span></span></div></article>`).join("")
    : `<p class="empty">${fn ? "Для этой ниши скриптов пока нет." : "Скриптов пока нет."} Нажмите «+ Скрипт».</p>`;
}

function renderIncome() {
  const t = incomeTotals(), b = S.brief || {}, goal = Number(b.goal) || DEFAULT_GOAL;
  const pct = Math.min(100, Math.round(t.received / goal * 100));
  $("#incMoney").innerHTML = `<div class="nums"><span>Получено в ${MONTHS[new Date().getMonth()].replace(/ь$/, "е").replace(/й$/, "е").replace(/т$/, "те")}: <b>${rub(t.received)} ₽</b></span><span>Ожидается: <b>${rub(t.expected)} ₽</b></span><span class="note">цель ${rub(goal)} ₽ · ${pct}%</span></div><div class="bar"><i style="width:${pct}%"></i></div>`;
  const rows = S.income.slice().sort((a, b) => (b.happened_on || b.created_at || "").localeCompare(a.happened_on || a.created_at || ""));
  $("#incList").innerHTML = rows.length ? rows.map(r => {
    const l = r.lead_id ? leadById(r.lead_id) : null;
    const tail = l ? `${r.what || r.kind === "expected" ? " · " : ""}<button type="button" class="linky" data-goto="${esc(l.id)}">${esc(short(l.name))}</button>${l.funnel_id ? ` <span class="note">(${esc(funnelName(l.funnel_id))})</span>` : ""}` : "";
    return `<li class="${r.kind === "expected" ? "exp" : ""}">
    <span class="d">${r.happened_on ? fmt(r.happened_on) + "." + r.happened_on.slice(2, 4) : "—"}</span>
    <span class="w">${esc(r.client || "—")}<small>${esc(r.what || "")}${r.kind === "expected" ? `${r.what ? " · " : ""}<span class="kind">ожидается</span>` : ""}${tail}</small></span>
    <span class="amt">${rub(r.amount)} ₽</span>
    <span data-askwrap><button class="btn small" type="button" data-ask="income" data-id="${esc(r.id)}" aria-label="Удалить строку">✕</button></span></li>`;
  }).join("")
    : `<li class="empty">Строк пока нет. Добавьте первую оплату или ожидаемый платёж.</li>`;
}

/* ---------- лиды: сохранение ---------- */
// когда у лида появляется «Кто привёл», рекомендатель переходит в «Привёл лида»
async function markBrought(refId) {
  const r = leadById(refId); if (!r || !["new", "sent", "replied", "later"].includes(r.status)) return;
  const { error } = await sb.from("leads").update({ status: "brought" }).eq("id", refId);
  if (!error) r.status = "brought";
}
async function saveLead(id, patch, el) {
  const l = S.leads.find(x => x.id === id); if (!l) return;
  const prevStatus = l.status;
  Object.assign(l, patch);
  const st = el?.closest(".lead")?.querySelector("[data-st]");
  if (st) { st.textContent = "Сохраняю…"; st.classList.remove("err"); }
  try {
    const { error } = await sb.from("leads").update(patch).eq("id", id);
    if (error) throw error;
    if (st) st.textContent = "Сохранено";
    if (patch.status === "client" && prevStatus !== "client" && l.referred_by) {
      const ref = leadById(l.referred_by);
      if (ref && ref.status !== "bonus_paid") toast(`Клиент от рекомендателя ${short(ref.name)}: после оплаты выплатите бонус${ref.bonus ? " (" + ref.bonus + ")" : ""}. Напоминание — в брифе.`);
    }
    if (!S.realtime) reload("leads");
  } catch (err) { if (st) { st.textContent = ruErr(err); st.classList.add("err"); } else fail(err); reload("leads"); }
}
const LEAD_NULLABLE = new Set(["next_date", "funnel_id", "referred_by", "bonus_paid_on"]);
function leadFieldError(el, text) {
  const st = el.closest(".lead")?.querySelector("[data-st]");
  if (st) { st.textContent = text; st.classList.add("err"); } else toast(text, true);
}
document.addEventListener("change", e => {
  const k = e.target.dataset?.k, d = e.target.closest(".lead"); if (!k || !d) return;
  const l = leadById(d.dataset.id); if (!l) return;
  let v = e.target.value;
  if (k === "hotness") { v = clampHot(v); e.target.value = v; }
  if (LEAD_NULLABLE.has(k)) v = v || null;
  const patch = { [k]: v };
  // правило ТЗ: у всех, кроме «Клиент», «Отказ» (и «Бонус выплачен»), должно быть следующее касание
  if (k === "next_date" && !v && needsNext(l)) { e.target.value = l.next_date || ""; leadFieldError(e.target, "Без даты следующего касания карточка не сохраняется. Если работа закончена — поставьте статус «Клиент» или «Отказ»."); return; }
  if (k === "next_action" && !v.trim() && needsNext(l) && l.next_action) { e.target.value = l.next_action; leadFieldError(e.target, "Опишите, что сделать на следующем касании."); return; }
  if (k === "status" && !FINAL.has(v) && !l.next_date) { e.target.value = l.status; leadFieldError(e.target, "Сначала поставьте дату следующего касания, потом меняйте статус."); return; }
  if (k === "funnel_id" && !v && l.contact_type !== "referrer") { e.target.value = l.funnel_id || ""; leadFieldError(e.target, "Воронка у лида обязательна."); return; }
  if (k === "contact_type") { const list = (v === "referrer" ? REF_STATUSES : STATUSES).map(([s]) => s); if (!list.includes(l.status)) patch.status = "new"; }
  if (k === "status" && v === "bonus_paid" && !l.bonus_paid_on) patch.bonus_paid_on = today();
  if (k === "bonus_paid_on" && v && l.contact_type === "referrer" && l.status !== "bonus_paid") patch.status = "bonus_paid";
  saveLead(d.dataset.id, patch, e.target);
  if (k === "referred_by" && v) markBrought(v);
  if (k !== "notes") setTimeout(render, 0);
});
document.addEventListener("toggle", e => { if (e.target.classList?.contains("lead")) { if (e.target.open) S.openId = e.target.dataset.id; else if (S.openId === e.target.dataset.id) S.openId = null; } }, true);

/* ---------- касания ---------- */
document.addEventListener("submit", async e => {
  const f = e.target.closest("[data-touch-form]"); if (!f) return;
  e.preventDefault();
  const l = leadById(f.dataset.touchForm); if (!l) return;
  const val = n => (f.elements[n]?.value || "").trim();
  const st = f.querySelector("[data-tst]");
  if (needsNext(l) && (!val("next") || !val("action"))) { st.textContent = "Назначьте следующее касание: дата и что сделать."; st.classList.add("err"); return; }
  st.textContent = "Сохраняю…"; st.classList.remove("err");
  try {
    const r = await sb.from("touches").insert({ workspace_id: S.ws.id, lead_id: l.id, funnel_id: l.funnel_id || null, happened_on: val("on") || today(), channel: val("channel"), what: val("what"), by_email: S.user?.email || "" });
    if (r.error) throw r.error;
    const patch = {};
    if (needsNext(l)) { patch.next_date = val("next"); patch.next_action = val("action"); }
    if (l.status === "new") patch.status = "sent";
    if (Object.keys(patch).length) { const u = await sb.from("leads").update(patch).eq("id", l.id); if (u.error) throw u.error; Object.assign(l, patch); }
    S.touchOpen = null; toast("Касание записано");
    await reload("touches", "leads");
  } catch (err) { st.textContent = ruErr(err); st.classList.add("err"); }
});

/* ---------- воронки: правка ---------- */
document.addEventListener("change", async e => {
  const fk = e.target.dataset?.fk, tk = e.target.dataset?.tk;
  if (fk) {
    const fid = e.target.closest("[data-fid]")?.dataset.fid, f = funnelById(fid); if (!f) return;
    const v = e.target.value.trim();
    if (fk === "name" && !v) { e.target.value = f.name; toast("У воронки должно быть название", true); return; }
    try { const { error } = await sb.from("funnels").update({ [fk]: v }).eq("id", fid); if (error) throw error; f[fk] = v; toast("Сохранено"); if (!S.realtime) reload("funnels"); else safeRender(); }
    catch (err) { fail(err); reload("funnels"); }
  }
  if (tk) {
    const tid = e.target.closest("[data-tid]")?.dataset.tid, t = S.tasks.find(x => x.id === tid); if (!t) return;
    let v = tk === "counts_touches" ? e.target.checked : e.target.value;
    if (tk === "norm_n") v = v === "" ? null : Math.max(0, parseInt(v, 10) || 0);
    if (tk === "next_date") v = v || null;
    if (tk === "title" && !String(v).trim()) { e.target.value = t.title; toast("Название задачи не может быть пустым", true); return; }
    const patch = { [tk]: v };
    if (tk === "period" && v === "event") patch.next_date = null;
    if (tk === "period" && v !== "event" && !t.next_date) patch.next_date = today();
    if (tk === "status" && v === "active" && !t.next_date && t.period !== "event") patch.next_date = today();
    try { const { error } = await sb.from("funnel_tasks").update(patch).eq("id", tid); if (error) throw error; Object.assign(t, patch); if (!S.realtime) reload("funnel_tasks"); else setTimeout(render, 0); }
    catch (err) { fail(err); reload("funnel_tasks"); }
  }
});
async function taskPlusOne(t) {
  const d = today();
  const fresh = t.period === "daily" ? t.cycle_start !== d : false;
  const patch = fresh ? { manual_done: 1, cycle_start: d } : { manual_done: (t.manual_done || 0) + 1 };
  const { error } = await sb.from("funnel_tasks").update(patch).eq("id", t.id); if (error) throw error;
  Object.assign(t, patch);
}
async function taskDone(t) {
  const patch = t.period === "once" ? { status: "done" } : (() => { const n = nextCycleDate(t); return { next_date: n, cycle_start: n, manual_done: 0 }; })();
  const { error } = await sb.from("funnel_tasks").update(patch).eq("id", t.id); if (error) throw error;
  Object.assign(t, patch);
  return patch;
}

/* ---------- общие клики ---------- */
const DELETERS = {
  lead: async id => { const { error } = await sb.from("leads").delete().eq("id", id); if (error) throw error; S.leads = S.leads.filter(l => l.id !== id); await reload("leads", "touches"); },
  script: async id => { const { error } = await sb.from("scripts").delete().eq("id", id); if (error) throw error; S.scripts = S.scripts.filter(s => s.id !== id); await reload("scripts"); },
  income: async id => { const { error } = await sb.from("income").delete().eq("id", id); if (error) throw error; S.income = S.income.filter(s => s.id !== id); await reload("income"); },
  member: async id => { const { error } = await sb.from("workspace_members").delete().eq("workspace_id", S.ws.id).eq("user_id", id); if (error) throw error; await loadMembers(); },
  invite: async id => { const { error } = await sb.from("workspace_invites").delete().eq("id", id); if (error) throw error; await loadMembers(); },
  touch: async id => { const { error } = await sb.from("touches").delete().eq("id", id); if (error) throw error; S.touches = S.touches.filter(x => x.id !== id); await reload("touches"); },
  task: async id => { const { error } = await sb.from("funnel_tasks").delete().eq("id", id); if (error) throw error; S.tasks = S.tasks.filter(x => x.id !== id); await reload("funnel_tasks"); },
  funnel: async id => {
    if (S.leads.some(l => l.funnel_id === id)) throw { code: "23503" };
    const { error } = await sb.from("funnels").delete().eq("id", id); if (error) throw error;
    S.funnels = S.funnels.filter(f => f.id !== id); S.openFunnel = null; await reload("funnels", "funnel_tasks", "scripts");
  },
};
const ASK_TEXT = { lead: "Удалить насовсем?", script: "Удалить скрипт?", income: "Удалить?", member: "Убрать из пространства?", invite: "Отменить приглашение?", touch: "Удалить касание?", task: "Удалить задачу?", funnel: "Удалить воронку вместе с задачами?" };

function gotoLead(id) {
  S.openId = id; S.filterStatus = ""; S.filterNiche = ""; S.filterNoNext = false;
  for (const s of ["#q", "#fType", "#fCity", "#fFunnel", "#fOwner", "#fCtype"]) $(s).value = "";
  render();
  const el = document.querySelector(`.lead[data-id="${CSS.escape(id)}"]`);
  if (el) { el.open = true; el.scrollIntoView({ behavior: "smooth", block: "start" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1500); }
}
function openFunnel(id) {
  S.openFunnel = id; render();
  $("#funnelsSec").scrollIntoView({ behavior: "smooth", block: "start" });
}

document.addEventListener("click", async e => {
  const t = e.target;
  // меню: закрывать при клике снаружи
  const menu = $("#menu"); if (menu.open && !t.closest("#menu")) menu.open = false;

  const per = t.closest("[data-period]"); if (per) { S.period = per.dataset.period; store.set("crmPeriod", S.period); renderFunnels(); return; }
  const chip = t.closest(".chip"); if (chip) { S.filterStatus = S.filterStatus === chip.dataset.f ? "" : chip.dataset.f; render(); return; }
  const tab = t.closest(".tab"); if (tab && tab.dataset.n !== undefined) { S.filterNiche = tab.dataset.n; store.set("crmNiche", S.filterNiche); render(); return; }

  const cp = t.closest("[data-copy]");
  if (cp) {
    const p = cp.closest(".msg,.script").querySelector("p");
    try { await navigator.clipboard.writeText(p.textContent); cp.textContent = "Скопировано ✓"; }
    catch (err) { const r = document.createRange(); r.selectNodeContents(p); const s = getSelection(); s.removeAllRanges(); s.addRange(r); cp.textContent = "Выделено — скопируйте"; }
    setTimeout(() => { cp.textContent = "Скопировать"; }, 2000); return;
  }

  const go = t.closest("[data-goto]"); if (go) { gotoLead(go.dataset.goto); return; }
  if (t.closest("[data-nonext]")) { S.filterNoNext = true; S.filterStatus = ""; S.filterNiche = ""; render(); $("#listSec").scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if (t.closest("[data-nonext-off]")) { S.filterNoNext = false; render(); return; }

  // касания
  const to = t.closest("[data-touch-open]"); if (to) { S.touchOpen = to.dataset.touchOpen; render(); document.querySelector(`[data-touch-form="${CSS.escape(S.touchOpen)}"] input[name=channel]`)?.focus(); return; }
  if (t.closest("[data-touch-cancel]")) { S.touchOpen = null; render(); return; }

  // воронки
  const of = t.closest("[data-open-funnel]"); if (of) { openFunnel(of.dataset.openFunnel); return; }
  if (t.closest("[data-funnel-back]")) { S.openFunnel = null; render(); return; }
  if (t.closest("[data-funnel-new]") || t.id === "funnelAddBtn") { openFunnelForm(); return; }
  if (t.id === "seedFunnels") {
    t.disabled = true; t.textContent = "Создаю…";
    try {
      await loadPresets();
      if (!S.presets.length) throw { message: "presets" };
      for (const p of S.presets) await createFunnel({ name: p.name, subtitle: p.subtitle, preset: p.key }, p.ord);
      toast("Создано 6 воронок с задачами"); await reload("funnels", "funnel_tasks");
    } catch (err) { fail(err); t.disabled = false; t.textContent = "Создать стартовый набор (6 воронок)"; await reload("funnels", "funnel_tasks"); }
    return;
  }
  const ta = t.closest("[data-task-add]");
  if (ta) {
    const fid = ta.dataset.taskAdd, ord = Math.max(0, ...S.tasks.filter(x => x.funnel_id === fid).map(x => Number(x.ord) || 0)) + 1;
    try { const { error } = await sb.from("funnel_tasks").insert({ workspace_id: S.ws.id, funnel_id: fid, title: "Новая задача", period: "daily", norm: "", next_date: today(), cycle_start: today(), ord }); if (error) throw error; await reload("funnel_tasks"); toast("Задача добавлена — переименуйте её"); }
    catch (err) { fail(err); }
    return;
  }
  const tp = t.closest("[data-task-plus]"); if (tp) { const task = S.tasks.find(x => x.id === tp.dataset.taskPlus); if (task) { try { await taskPlusOne(task); render(); } catch (err) { fail(err); } } return; }
  const td = t.closest("[data-task-done]");
  if (td) {
    const task = S.tasks.find(x => x.id === td.dataset.taskDone); if (!task) return;
    try { const p = await taskDone(task); toast(p.status === "done" ? "Разовая задача закрыта" : `Готово. Следующий раз: ${fmt(p.next_date)}`); render(); } catch (err) { fail(err); }
    return;
  }
  const atf = t.closest("[data-add-to-funnel]"); if (atf) { openAddForm(atf.dataset.addToFunnel); return; }

  // удаление с подтверждением внутри страницы
  const ask = t.closest("[data-ask]");
  if (ask) {
    const wrap = ask.closest("[data-askwrap]"), kind = ask.dataset.ask, id = ask.dataset.id;
    wrap.dataset.orig = wrap.innerHTML;
    wrap.innerHTML = `<span class="ask">${ASK_TEXT[kind]} <button class="btn danger small" type="button" data-yes="${esc(kind)}" data-id="${esc(id)}">Да, удалить</button><button class="btn small" type="button" data-no>Отмена</button></span>`;
    wrap.querySelector("[data-no]").focus();
    return;
  }
  const no = t.closest("[data-no]"); if (no) { const w = no.closest("[data-askwrap]"); w.innerHTML = w.dataset.orig || ""; return; }
  const yes = t.closest("[data-yes]");
  if (yes) {
    yes.disabled = true; yes.textContent = "Удаляю…";
    try { await DELETERS[yes.dataset.yes](yes.dataset.id); toast("Удалено"); }
    catch (err) { fail(err); const w = yes.closest("[data-askwrap]"); if (w) w.innerHTML = w.dataset.orig || ""; }
    return;
  }

  const es = t.closest("[data-edit-script]"); if (es) { openScriptForm(S.scripts.find(s => s.id === es.dataset.editScript)); return; }

  const op = t.closest("[data-open]");
  if (op) { menu.open = false; openSheet(op.dataset.open); return; }
  const cl = t.closest("[data-close]"); if (cl) { cl.closest(".sheet").hidden = true; return; }
});
document.addEventListener("keydown", e => { if (e.key === "Escape") { const m = $("#menu"); if (m.open) { m.open = false; m.querySelector("summary").focus(); } } });

function closeSheets() { for (const id of ["membersSheet", "importSheet", "addForm", "scriptForm", "incForm", "briefForm", "funnelForm"]) $("#" + id).hidden = true; $("#briefLists").hidden = false; }
function openSheet(id) {
  closeSheets(); $("#" + id).hidden = false; $("#" + id).scrollIntoView({ behavior: "smooth", block: "start" });
  if (id === "membersSheet") loadMembers();
  if (id === "importSheet") { $("#importFile").value = ""; $("#importPreview").hidden = true; $("#importGo").disabled = true; setStatus("#importStatus", ""); S.importData = null; }
}

["q", "fType", "fCity", "fSort", "fFunnel", "fOwner", "fCtype"].forEach(id => $("#" + id).addEventListener("input", renderLeads));
$("#fOwnerF").addEventListener("input", renderFunnels);

/* ---------- новая воронка ---------- */
function openFunnelForm() {
  $("#fn_preset").innerHTML = `<option value="">Без шаблона (пустая)</option>` + S.presets.map(p => `<option value="${esc(p.key)}">${esc(p.name)}</option>`).join("");
  $("#fn_name").value = ""; $("#fn_sub").value = ""; setStatus("#funnelStatus", "");
  $("#funnelForm").hidden = false; $("#funnelForm").scrollIntoView({ behavior: "smooth", block: "start" }); $("#fn_preset").focus({ preventScroll: true });
}
$("#fn_preset").addEventListener("change", e => { const p = S.presets.find(x => x.key === e.target.value); if (p) { $("#fn_name").value = p.name; $("#fn_sub").value = p.subtitle || ""; } });
$("#funnelCancel").onclick = () => { $("#funnelForm").hidden = true; };
$("#funnelForm").addEventListener("submit", async e => {
  e.preventDefault();
  const name = $("#fn_name").value.trim(); if (!name) { setStatus("#funnelStatus", "Введите название", true); return; }
  setStatus("#funnelStatus", "Создаю…");
  try {
    const id = await createFunnel({ name, subtitle: $("#fn_sub").value.trim(), preset: $("#fn_preset").value || null });
    $("#funnelForm").hidden = true; toast("Воронка создана"); await reload("funnels", "funnel_tasks"); openFunnel(id);
  } catch (err) { setStatus("#funnelStatus", ruErr(err), true); }
});

/* ---------- добавление лида ---------- */
function openAddForm(funnelId) {
  closeSheets(); fillSelects(); $("#addForm").hidden = false; setStatus("#addStatus", "");
  if (funnelId) $("#f_funnel").value = funnelId;
  if (!$("#f_next").value) $("#f_next").value = today();
  $("#f_refWrap").hidden = $("#f_ctype").value === "referrer";
  $("#addForm").scrollIntoView({ behavior: "smooth", block: "start" }); $("#f_name").focus({ preventScroll: true });
}
$("#addBtn").onclick = () => openAddForm(S.openFunnel);
$("#addCancel").onclick = () => { $("#addForm").hidden = true; };
$("#f_ctype").addEventListener("change", e => { $("#f_refWrap").hidden = e.target.value === "referrer"; });
$("#addForm").addEventListener("submit", async e => {
  e.preventDefault();
  const v = id => $("#" + id).value.trim();
  const ref = v("f_ctype") === "referrer";
  if (!v("f_name")) { setStatus("#addStatus", "Заполните имя", true); return; }
  if (!v("f_funnel") && !ref) { setStatus("#addStatus", S.funnels.length ? "Выберите воронку — без неё лид не сохраняется." : "Сначала создайте воронку в разделе «Воронки».", true); return; }
  if (!v("f_next") || !v("f_action")) { setStatus("#addStatus", "Укажите следующее касание: дату и что сделать.", true); return; }
  const row = { workspace_id: S.ws.id, name: v("f_name"), contact_type: ref ? "referrer" : "lead", funnel_id: v("f_funnel") || null, owner_name: v("f_owner"),
    next_date: v("f_next"), next_action: v("f_action"), city: v("f_city"), niche: v("f_niche"), type: v("f_type"), client_kind: v("f_kind") || "new",
    hotness: clampHot(v("f_hot")), site: v("f_site"), instagram: v("f_insta"), contact: v("f_contact"), decision_maker: v("f_dm"),
    referred_by: ref ? null : (v("f_ref") || null), hook: v("f_hook"), message: v("f_message"), status: "new", source: "вручную" };
  setStatus("#addStatus", "Сохраняю…");
  try {
    const { error } = await sb.from("leads").insert(row); if (error) throw error;
    if (row.referred_by) await markBrought(row.referred_by);
    e.target.reset(); $("#f_hot").value = 3; $("#addForm").hidden = true; setStatus("#addStatus", ""); toast("Добавлено");
    await reload("leads");
  } catch (err) { setStatus("#addStatus", ruErr(err), true); }
});

/* ---------- скрипты ---------- */
function openScriptForm(s) {
  S.editingScript = s || null;
  $("#scriptFormH").textContent = s ? "Изменить скрипт" : "Новый скрипт";
  $("#s_niche").value = s ? (s.niche || "") : (S.filterNiche || "");
  const maxOrd = Math.max(0, ...S.scripts.filter(x => x.niche === $("#s_niche").value).map(x => Number(x.ord) || 0));
  $("#s_ord").value = s ? (s.ord ?? 1) : maxOrd + 1;
  $("#s_title").value = s?.title || ""; $("#s_when").value = s?.when || ""; $("#s_text").value = s?.text || "";
  $("#s_funnel").innerHTML = funnelOptions(s ? s.funnel_id : S.openFunnel, "— без воронки —");
  setStatus("#scriptStatus", ""); $("#scriptForm").hidden = false; $("#scriptForm").scrollIntoView({ behavior: "smooth", block: "start" }); $("#s_title").focus({ preventScroll: true });
}
$("#scriptAddBtn").onclick = () => openScriptForm(null);
$("#scriptCancel").onclick = () => { $("#scriptForm").hidden = true; };
$("#scriptForm").addEventListener("submit", async e => {
  e.preventDefault();
  const row = { niche: $("#s_niche").value.trim(), ord: Number($("#s_ord").value) || 1, title: $("#s_title").value.trim(), when: $("#s_when").value.trim(), text: $("#s_text").value, funnel_id: $("#s_funnel").value || null };
  if (!row.title || !row.text.trim()) { setStatus("#scriptStatus", "Заполните название и текст", true); return; }
  setStatus("#scriptStatus", "Сохраняю…");
  try {
    const q = S.editingScript ? sb.from("scripts").update(row).eq("id", S.editingScript.id) : sb.from("scripts").insert({ ...row, workspace_id: S.ws.id });
    const { error } = await q; if (error) throw error;
    $("#scriptForm").hidden = true; toast("Скрипт сохранён"); await reload("scripts");
  } catch (err) { setStatus("#scriptStatus", ruErr(err), true); }
});

/* ---------- бриф ---------- */
$("#briefEditBtn").onclick = () => {
  const b = S.brief || {};
  $("#b_date").value = b.date || new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" });
  $("#b_goal").value = Number(b.goal) || DEFAULT_GOAL;
  $("#b_yesterday").value = (b.yesterday || []).join("\n"); $("#b_plan").value = (b.plan || []).join("\n");
  setStatus("#briefStatus", ""); $("#briefLists").hidden = true; $("#briefForm").hidden = false; $("#b_plan").focus();
};
$("#briefCancel").onclick = () => { $("#briefForm").hidden = true; $("#briefLists").hidden = false; };
$("#briefForm").addEventListener("submit", async e => {
  e.preventDefault();
  const lines = s => s.split("\n").map(x => x.replace(/^\s*(\d+[.)]|[-•*])\s*/, "").trim()).filter(Boolean);
  const data = { ...(S.brief || {}), date: $("#b_date").value.trim(), goal: Math.max(0, Number($("#b_goal").value) || DEFAULT_GOAL), yesterday: lines($("#b_yesterday").value), plan: lines($("#b_plan").value) };
  setStatus("#briefStatus", "Сохраняю…");
  try {
    const { error } = await sb.from("briefs").upsert({ workspace_id: S.ws.id, data, updated_at: new Date().toISOString() }, { onConflict: "workspace_id" });
    if (error) throw error;
    S.brief = data; $("#briefForm").hidden = true; $("#briefLists").hidden = false; toast("Бриф сохранён"); await reload("briefs");
  } catch (err) { setStatus("#briefStatus", ruErr(err), true); }
});

/* ---------- доход ---------- */
$("#incAddBtn").onclick = () => { fillSelects(); $("#incForm").hidden = false; $("#i_date").value = today(); setStatus("#incStatus", ""); $("#i_client").focus(); };
$("#incCancel").onclick = () => { $("#incForm").hidden = true; };
$("#i_lead").addEventListener("change", e => { const l = leadById(e.target.value); if (l && !$("#i_client").value.trim()) $("#i_client").value = short(l.name); });
$("#incForm").addEventListener("submit", async e => {
  e.preventDefault();
  const amount = Number($("#i_amount").value);
  if (!(amount > 0)) { setStatus("#incStatus", "Укажите сумму больше нуля", true); return; }
  const row = { workspace_id: S.ws.id, kind: $("#i_kind").value, happened_on: $("#i_date").value || null, client: $("#i_client").value.trim(), what: $("#i_what").value.trim(), amount, lead_id: $("#i_lead").value || null };
  setStatus("#incStatus", "Сохраняю…");
  try {
    const { error } = await sb.from("income").insert(row); if (error) throw error;
    const l = row.lead_id ? leadById(row.lead_id) : null, ref = l?.referred_by ? leadById(l.referred_by) : null;
    e.target.reset(); $("#incForm").hidden = true;
    toast(row.kind === "received" && ref && ref.status !== "bonus_paid" ? `Оплата от лида рекомендателя ${short(ref.name)} — выплатите бонус${ref.bonus ? " (" + ref.bonus + ")" : ""} и отметьте «Бонус выплачен».` : "Добавлено");
    await reload("income");
  } catch (err) { setStatus("#incStatus", ruErr(err), true); }
});

/* ---------- участники ---------- */
async function loadMembers() {
  if (!S.ws) return;
  setStatus("#membersStatus", "Загружаю…");
  try {
    // 1) функция из migrations/002 (с email); 2) запасной вариант — без email
    let members;
    const r = await sb.rpc("workspace_members_list", { ws: S.ws.id });
    if (!r.error) members = r.data;
    else {
      const m = await sb.from("workspace_members").select("user_id,role,created_at").eq("workspace_id", S.ws.id).order("created_at");
      if (m.error) throw m.error; members = m.data;
    }
    $("#membersList").innerHTML = members.map(m => {
      const me = m.user_id === S.user.id;
      const who = me ? `${esc(S.user.email)} <span class="note">(вы)</span>` : (m.email ? esc(m.email) : `<span class="note">участник ${esc(String(m.user_id).slice(0, 8))}…</span>`);
      return `<li><span>${who} · <span class="role">${m.role === "owner" ? "владелец" : "участник"}</span></span>${!me && isOwner() ? `<span data-askwrap><button class="btn small" type="button" data-ask="member" data-id="${esc(m.user_id)}">Убрать</button></span>` : ""}</li>`;
    }).join("");
    const inv = await sb.from("workspace_invites").select("id,email,role,created_at").eq("workspace_id", S.ws.id).order("created_at");
    if (inv.error) throw inv.error;
    $("#invitesBox").hidden = !inv.data.length;
    $("#invitesList").innerHTML = inv.data.map(i => `<li><span>${esc(i.email)} · <span class="role">${i.role === "owner" ? "владелец" : "участник"}</span></span><span data-askwrap><button class="btn small" type="button" data-ask="invite" data-id="${esc(i.id)}">Отменить</button></span></li>`).join("");
    setStatus("#membersStatus", "");
  } catch (err) { setStatus("#membersStatus", ruErr(err), true); }
}
$("#inviteForm").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("#inviteEmail").value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setStatus("#membersStatus", "Проверьте адрес почты", true); return; }
  setStatus("#membersStatus", "Приглашаю…");
  try {
    const { error } = await sb.from("workspace_invites").insert({ workspace_id: S.ws.id, email, role: $("#inviteRole").value });
    if (error) { if (error.code === "23505") throw { message: "dup", code: "dup" }; throw error; }
    e.target.reset(); await loadMembers();
    setStatus("#membersStatus", `Готово. Попросите ${email} зарегистрироваться на crm.tinadigital.ru с этим email (или войти заново, если уже есть аккаунт).`);
  } catch (err) { setStatus("#membersStatus", err.code === "dup" ? "Этот email уже приглашён." : ruErr(err), true); }
});

/* ---------- импорт / экспорт ---------- */
const pick = (o, ...keys) => { for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k]; return undefined; };
const str = v => v == null ? "" : String(v);
const dateOnly = v => { const s = str(v).trim(); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null; };
const ts = v => { const s = str(v).trim(); return s && !isNaN(Date.parse(s)) ? new Date(s).toISOString() : undefined; };
function mapLead(x) {
  const name = str(pick(x, "name")).trim(); if (!name) return null;
  const rv = pick(x, "reviews"); const reviews = rv === undefined || rv === "" ? null : parseInt(rv, 10);
  const row = {
    workspace_id: S.ws.id, name, city: str(x.city), niche: str(x.niche), type: x.type === "warm" ? "warm" : "cold",
    hotness: clampHot(pick(x, "hotness") ?? 3), site: str(x.site), site_note: str(pick(x, "siteNote", "site_note")), socials: str(x.socials),
    contact: str(x.contact), hook: str(x.hook), message: str(x.message), status: SL[x.status] ? x.status : "new",
    next_date: dateOnly(pick(x, "nextDate", "next_date")), notes: str(x.notes), source: str(x.source), reviews: Number.isFinite(reviews) ? reviews : null,
  };
  const c = ts(pick(x, "createdAt", "created_at")), u = ts(pick(x, "updatedAt", "updated_at"));
  if (c) row.created_at = c; if (u) row.updated_at = u;
  return row;
}
function mapScript(x) {
  const title = str(x.title).trim(); if (!title) return null;
  return { workspace_id: S.ws.id, niche: str(x.niche), ord: Number(pick(x, "order", "ord")) || 1, title, when: str(x.when), text: str(x.text) };
}
function mapIncome(x) {
  const amount = Number(str(pick(x, "amount", "sum")).replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(amount)) return null;
  const kind = pick(x, "kind") === "expected" ? "expected" : "received";
  return { workspace_id: S.ws.id, kind, happened_on: dateOnly(pick(x, "happenedOn", "happened_on", "date")), client: str(x.client), what: str(pick(x, "what", "comment")), amount };
}
$("#importFile").addEventListener("change", async e => {
  const f = e.target.files[0]; S.importData = null; $("#importGo").disabled = true; $("#importPreview").hidden = true;
  if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    const arr = v => Array.isArray(v) ? v : [];
    const src = Array.isArray(j) ? { leads: j } : j;
    const key = l => (l.name + "|" + l.city).toLowerCase().trim();
    const have = new Set(S.leads.map(key));
    const mapped = arr(src.leads).map(mapLead).filter(Boolean);
    const leads = [], seen = new Set(); let dup = 0;
    for (const l of mapped) { const k = key(l); if (have.has(k) || seen.has(k)) { dup++; continue; } seen.add(k); leads.push(l); }
    const haveS = new Set(S.scripts.map(s => (s.niche + "|" + s.title).toLowerCase()));
    const scripts = arr(src.scripts).map(mapScript).filter(s => s && !haveS.has((s.niche + "|" + s.title).toLowerCase()));
    const income = arr(src.income).map(mapIncome).filter(Boolean);
    const brief = src.brief && typeof src.brief === "object" && !Array.isArray(src.brief) ? src.brief : null;
    const skipped = arr(src.leads).length - mapped.length;
    if (!leads.length && !scripts.length && !income.length && !brief) { setStatus("#importStatus", dup ? `Все ${dup} записей уже есть — добавлять нечего.` : "В файле не нашлось данных для импорта. Нужен объект с полями leads, scripts, brief или income.", true); return; }
    S.importData = { leads, scripts, income, brief };
    $("#importPreview").innerHTML = `<p><b>Будет добавлено:</b> ${label()[0].toLowerCase()} — ${leads.length}, скрипты — ${scripts.length}, строки дохода — ${income.length}${brief ? ", бриф будет заменён" : ""}.${dup ? `<br>Пропущено как дубли: ${dup}.` : ""}${skipped ? `<br>Без имени (пропущены): ${skipped}.` : ""}</p>`;
    $("#importPreview").hidden = false; $("#importGo").disabled = false; setStatus("#importStatus", "");
  } catch (err) { setStatus("#importStatus", err instanceof SyntaxError ? "Файл не похож на JSON — проверьте, что выбрали правильный." : ruErr(err), true); }
});
async function insertChunks(table, rows, onProgress) {
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await sb.from(table).insert(rows.slice(i, i + 200)); if (error) throw error;
    onProgress?.(Math.min(rows.length, i + 200), rows.length);
  }
}
$("#importGo").onclick = async () => {
  const d = S.importData; if (!d) return;
  const btn = $("#importGo"); btn.disabled = true;
  try {
    await insertChunks("leads", d.leads, (n, t) => setStatus("#importStatus", `Записи: ${n} из ${t}…`));
    if (d.scripts.length) { setStatus("#importStatus", "Скрипты…"); await insertChunks("scripts", d.scripts); }
    if (d.income.length) { setStatus("#importStatus", "Доход…"); await insertChunks("income", d.income); }
    if (d.brief) { const { error } = await sb.from("briefs").upsert({ workspace_id: S.ws.id, data: d.brief, updated_at: new Date().toISOString() }, { onConflict: "workspace_id" }); if (error) throw error; }
    setStatus("#importStatus", "Импорт завершён."); toast("Импорт завершён"); S.importData = null; $("#importFile").value = ""; $("#importPreview").hidden = true;
    await reload();
  } catch (err) { setStatus("#importStatus", "Импорт остановлен: " + ruErr(err) + " Часть данных могла успеть загрузиться — повторный импорт пропустит дубли лидов и скриптов.", true); btn.disabled = false; await reload(); }
};

$("#exportBtn").onclick = () => {
  $("#menu").open = false;
  const out = {
    exportedAt: new Date().toISOString(), workspace: S.ws.name,
    leads: S.leads.map(l => ({ name: l.name, city: l.city, niche: l.niche, type: l.type, hotness: l.hotness, site: l.site, siteNote: l.site_note, socials: l.socials, contact: l.contact, hook: l.hook, message: l.message, status: l.status, nextDate: l.next_date || "", notes: l.notes, source: l.source, reviews: l.reviews, createdAt: l.created_at, updatedAt: l.updated_at,
      funnel: funnelName(l.funnel_id), nextAction: l.next_action, contactType: l.contact_type, clientKind: l.client_kind, ownerName: l.owner_name, instagram: l.instagram,
      decisionMaker: l.decision_maker, referredBy: l.referred_by ? short(leadById(l.referred_by)?.name) : "", bonus: l.bonus, bonusPaidOn: l.bonus_paid_on,
      touches: touchesOf(l.id).map(x => ({ on: x.happened_on, channel: x.channel, what: x.what, by: x.by_email })) })),
    scripts: S.scripts.map(s => ({ niche: s.niche, order: Number(s.ord), title: s.title, when: s.when, text: s.text, funnel: funnelName(s.funnel_id) })),
    brief: S.brief || {},
    income: S.income.map(r => ({ kind: r.kind, happenedOn: r.happened_on, client: r.client, what: r.what, amount: Number(r.amount), lead: r.lead_id ? short(leadById(r.lead_id)?.name) : "" })),
    funnels: S.funnels.map(f => ({ name: f.name, subtitle: f.subtitle, status: f.status, tasks: S.tasks.filter(t => t.funnel_id === f.id).map(t => ({ title: t.title, period: t.period, norm: t.norm, normN: t.norm_n, nextDate: t.next_date, status: t.status })) })),
  };
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `tina-crm-${(S.ws.name || "export").replace(/[^\p{L}\p{N}]+/gu, "-")}-${today()}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

/* ---------- тема ---------- */
function applyTheme(t) {
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  $("#themeBtn").textContent = "Тема: " + ({ light: "светлая", dark: "тёмная" }[t] || "авто");
}
applyTheme(store.get("crmTheme") || "auto");
$("#themeBtn").onclick = () => { const cur = store.get("crmTheme") || "auto"; const next = { auto: "light", light: "dark", dark: "auto" }[cur]; store.set("crmTheme", next); applyTheme(next); };

/* ---------- старт ---------- */
(async function start() {
  const urlErr = authErrorFromUrl();
  if (!sb) { show("authScreen"); setStatus("#authStatus", "Не загрузилась библиотека Supabase. Проверьте интернет и обновите страницу.", true); return; }
  sb.auth.onAuthStateChange((event, session) => {
    // не вызываем запросы прямо внутри колбэка (рекомендация supabase-js)
    setTimeout(() => {
      if (event === "SIGNED_OUT") onSession(null);
      else if (event === "SIGNED_IN" || event === "INITIAL_SESSION") onSession(session);
    }, 0);
  });
  if (urlErr) setTimeout(() => setStatus("#authStatus", urlErr, true), 50);
})();
