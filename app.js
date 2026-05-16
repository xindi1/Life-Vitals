const STORAGE_KEY = "lifeVitalsUnifiedData_v2";
const LEGACY_STORAGE_KEY = "lifeVitalsUnifiedData_v1";
const OLDER_STORAGE_KEY = "lifeVitalsData_v2";
const DRAFTS_KEY = "lifeVitalsUnifiedDrafts_v2";
const LEGACY_DRAFTS_KEY = "lifeVitalsUnifiedDrafts_v1";
const THEME_KEY = "lifeVitalsTheme";

const MODULES = {
  sleep: { label: "Sleep", zone: "vitals" },
  exercise: { label: "Exercise", zone: "vitals" },
  nutrition: { label: "Nutrition", zone: "vitals" },
  sex: { label: "Sex", zone: "vitals" },
  work: { label: "Work", zone: "activity" },
  build: { label: "Build", zone: "activity" },
  events: { label: "Events", zone: "activity" },
  admin: { label: "Admin", zone: "activity" },
  write: { label: "Narrative", zone: "narrative" }
};

const defaultData = Object.fromEntries(Object.keys(MODULES).map((key) => [key, []]));

const state = {
  data: loadData(),
  drafts: loadDrafts(),
  activeTab: "sleep",
  activeStream: "timeline",
  filters: { zone: "all", module: "all", date: "", text: "" }
};

let deferredPrompt = null;

document.addEventListener("DOMContentLoaded", () => {
  loadTheme();
  setCurrentDate();
  seedDefaultDates();
  bindTabs();
  bindForms();
  bindGlobalActions();
  bindFilters();
  bindQuickFill();
  bindDateFormatting();
  bindTimeFormatting();
  bindTimeline();
  bindStreamTabs();
  renderAll();
  restoreDrafts();
  registerServiceWorker();
  setupInstallPrompt();
});

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || localStorage.getItem(OLDER_STORAGE_KEY);
    if (!raw) return structuredClone(defaultData);
    const parsed = JSON.parse(raw);
    return sanitizeImportedData(parsed.data || parsed);
  } catch (error) {
    console.error("Failed to load data:", error);
    return structuredClone(defaultData);
  }
}

function loadDrafts() {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY) || localStorage.getItem(LEGACY_DRAFTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const clean = {};
    Object.keys(MODULES).forEach((module) => { clean[module] = parsed[module] || {}; });
    return clean;
  } catch (error) {
    console.error("Failed to load drafts:", error);
    return {};
  }
}

function sanitizeImportedData(imported) {
  const clean = {};
  Object.keys(MODULES).forEach((module) => {
    clean[module] = Array.isArray(imported[module]) ? imported[module].map((entry) => normalizeEntry(module, entry)) : [];
  });
  return clean;
}

function normalizeEntry(module, entry) {
  const clean = { ...entry };
  if (!clean.id) clean.id = generateId();
  if (module === "write") {
    clean.entryDensity = clean.entryDensity || "";
    clean.keyRealization = clean.keyRealization || inferRealization(clean.body || "");
    clean.emotionalTone = clean.emotionalTone || "";
    clean.physicalState = clean.physicalState || "";
    clean.people = clean.people || "";
    clean.place = clean.place || "";
    clean.themes = clean.themes || clean.tags || "";
    clean.connectedEntries = clean.connectedEntries || "";
    clean.whatChanged = clean.whatChanged || "";
    clean.followOnAction = clean.followOnAction || "";
  }
  return clean;
}

function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data)); }
function saveDrafts() { localStorage.setItem(DRAFTS_KEY, JSON.stringify(state.drafts)); }

function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "dark";
  document.body.classList.toggle("light", saved === "light");
  updateThemeMeta();
}
function toggleTheme() {
  const isLight = document.body.classList.toggle("light");
  localStorage.setItem(THEME_KEY, isLight ? "light" : "dark");
  updateThemeMeta();
}
function updateThemeMeta() {
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute("content", document.body.classList.contains("light") ? "#eef4fb" : "#0f1720");
}
function setCurrentDate() {
  const el = document.getElementById("currentDate");
  if (!el) return;
  el.textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date());
}
function todayString() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
function currentTime24() {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
function pad(value) { return String(value).padStart(2, "0"); }
function generateId() { return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`; }
function formatDateInput(value) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}
function normalizeDate(value) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length < 8) return formatDateInput(digits);
  let year = parseInt(digits.slice(0, 4), 10);
  let month = Math.max(1, Math.min(12, parseInt(digits.slice(4, 6), 10) || 1));
  const maxDay = new Date(year, month, 0).getDate();
  let day = Math.max(1, Math.min(maxDay, parseInt(digits.slice(6, 8), 10) || 1));
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const test = new Date(year, month - 1, day);
  return test.getFullYear() === year && test.getMonth() === month - 1 && test.getDate() === day;
}
function formatTimeInput(value) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}
function normalizeTime(value) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length < 4) return formatTimeInput(digits);
  let hours = Math.max(0, Math.min(23, parseInt(digits.slice(0, 2), 10) || 0));
  let minutes = Math.max(0, Math.min(59, parseInt(digits.slice(2, 4), 10) || 0));
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
function isValidTime(value) { return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value); }

function seedDefaultDates() {
  const today = todayString();
  const time = currentTime24();
  Object.keys(MODULES).forEach((module) => {
    const dateEl = document.getElementById(`${module}Date`);
    const timeEl = document.getElementById(`${module}Time`);
    if (dateEl && !dateEl.value) dateEl.value = today;
    if (timeEl && !timeEl.value) timeEl.value = time;
  });
  ["sleepBedtime", "sleepWakeTime"].forEach((id) => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = time;
  });
}

function bindDateFormatting() {
  ["filterDate", ...Object.keys(MODULES).map((m) => `${m}Date`)].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => { el.value = formatDateInput(el.value); });
    el.addEventListener("blur", () => { el.value = normalizeDate(el.value); if (id === "filterDate" && el.value && !isValidDate(el.value)) el.value = ""; });
  });
}
function bindTimeFormatting() {
  [...new Set(["sleepBedtime", "sleepWakeTime", ...Object.keys(MODULES).map((m) => `${m}Time`)])].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => { el.value = formatTimeInput(el.value); });
    el.addEventListener("blur", () => { el.value = normalizeTime(el.value); });
  });
}

function bindTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      state.activeTab = tab;
      buttons.forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
      panels.forEach((p) => p.classList.toggle("active", p.id === `${tab}Tab`));
      document.getElementById(`${tab}Tab`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function bindForms() {
  Object.keys(MODULES).forEach((module) => {
    const form = document.getElementById(`${module}Form`);
    if (form) form.addEventListener("submit", (event) => handleGenericSubmit(event, module));
  });
  document.querySelectorAll("[data-reset-form]").forEach((btn) => btn.addEventListener("click", () => resetForm(btn.dataset.resetForm)));
  setupAutoSaveDrafts();
}

function setupAutoSaveDrafts() {
  document.querySelectorAll("form input, form textarea, form select").forEach((field) => {
    const saveFieldDraft = () => {
      const form = field.closest("form");
      if (!form) return;
      const module = form.id.replace("Form", "");
      if (!MODULES[module]) return;
      state.drafts[module] = serializeForm(module);
      saveDrafts();
    };
    field.addEventListener("input", saveFieldDraft);
    field.addEventListener("change", saveFieldDraft);
  });
}
function restoreDrafts() {
  Object.keys(MODULES).forEach((module) => {
    if (state.drafts[module]) fillForm(module, state.drafts[module], false);
  });
}

function formFieldMap() {
  return {
    sleep: { id: "sleepId", date: "sleepDate", bedtime: "sleepBedtime", wakeTime: "sleepWakeTime", totalHours: "sleepHours", quality: "sleepQuality", dreams: "sleepDreams", notes: "sleepNotes" },
    exercise: { id: "exerciseId", date: "exerciseDate", time: "exerciseTime", type: "exerciseType", duration: "exerciseDuration", intensity: "exerciseIntensity", regulation: "exerciseRegulation", notes: "exerciseNotes" },
    nutrition: { id: "nutritionId", date: "nutritionDate", time: "nutritionTime", title: "nutritionTitle", mealType: "nutritionMealType", notes: "nutritionNotes", hydration: "nutritionHydration", cravings: "nutritionCravings" },
    sex: { id: "sexId", date: "sexDate", time: "sexTime", libido: "sexLibido", activityType: "sexActivityType", tone: "sexTone", satisfaction: "sexSatisfaction", notes: "sexNotes" },
    work: { id: "workId", date: "workDate", time: "workTime", type: "workType", duration: "workDuration", output: "workOutput", friction: "workFriction", notes: "workNotes" },
    build: { id: "buildId", date: "buildDate", time: "buildTime", project: "buildProject", stage: "buildStage", action: "buildAction", momentum: "buildMomentum", notes: "buildNotes" },
    events: { id: "eventsId", date: "eventsDate", time: "eventsTime", type: "eventsType", energyBefore: "eventsEnergyBefore", energyAfter: "eventsEnergyAfter", moment: "eventsMoment", notes: "eventsNotes" },
    admin: { id: "adminId", date: "adminDate", time: "adminTime", task: "adminTask", duration: "adminDuration", load: "adminLoad", completed: "adminCompleted", notes: "adminNotes" },
    write: { id: "writeId", date: "writeDate", time: "writeTime", type: "writeType", entryDensity: "writeEntryDensity", title: "writeTitle", body: "writeBody", keyRealization: "writeKeyRealization", emotionalTone: "writeEmotionalTone", physicalState: "writePhysicalState", people: "writePeople", place: "writePlace", themes: "writeThemes", connectedEntries: "writeConnectedEntries", whatChanged: "writeWhatChanged", followOnAction: "writeFollowOnAction", tags: "writeTags" }
  };
}
function serializeForm(module) {
  const payload = {};
  Object.entries(formFieldMap()[module]).forEach(([key, id]) => { const el = document.getElementById(id); if (el) payload[key] = el.value; });
  return payload;
}
function getFormValues(module) {
  const payload = {};
  Object.entries(formFieldMap()[module]).forEach(([key, id]) => { const el = document.getElementById(id); payload[key] = el ? el.value.trim() : ""; });
  return payload;
}
function fillForm(module, entry, includeId = true) {
  const normalized = normalizeEntry(module, entry);
  Object.entries(formFieldMap()[module]).forEach(([key, id]) => {
    if (!includeId && key === "id") return;
    const el = document.getElementById(id);
    if (el) el.value = normalized[key] ?? "";
  });
}
function clearDraft(module) { delete state.drafts[module]; saveDrafts(); }
function resetForm(module) {
  const form = document.getElementById(`${module}Form`);
  if (!form) return;
  form.reset();
  const idField = document.getElementById(`${module}Id`);
  const dateField = document.getElementById(`${module}Date`);
  const timeField = document.getElementById(`${module}Time`);
  if (idField) idField.value = "";
  if (dateField) dateField.value = todayString();
  if (timeField) timeField.value = currentTime24();
  if (module === "sleep") {
    document.getElementById("sleepDate").value = todayString();
    document.getElementById("sleepBedtime").value = currentTime24();
    document.getElementById("sleepWakeTime").value = currentTime24();
  }
  clearDraft(module);
}
function sortEntriesDesc(a, b) {
  const aStamp = `${a.date || ""} ${a.time || a.bedtime || "00:00"}`;
  const bStamp = `${b.date || ""} ${b.time || b.bedtime || "00:00"}`;
  return bStamp.localeCompare(aStamp);
}
function upsertEntry(module, payload) {
  const entry = normalizeEntry(module, { ...payload, id: payload.id || generateId(), updatedAt: new Date().toISOString() });
  const collection = state.data[module];
  const index = collection.findIndex((item) => item.id === entry.id);
  if (index >= 0) collection[index] = entry; else collection.push(entry);
  collection.sort(sortEntriesDesc);
  saveData(); clearDraft(module); renderAll(); resetForm(module);
}
function validateModuleValues(module, values) {
  const validators = {
    sleep: () => isValidDate(values.date) && isValidTime(values.bedtime) && isValidTime(values.wakeTime) && values.quality,
    exercise: () => isValidDate(values.date) && isValidTime(values.time) && values.type && values.duration && values.intensity && values.regulation,
    nutrition: () => isValidDate(values.date) && isValidTime(values.time) && values.title && values.mealType,
    sex: () => isValidDate(values.date) && isValidTime(values.time) && values.libido && values.activityType && values.tone && values.satisfaction,
    work: () => isValidDate(values.date) && isValidTime(values.time) && values.type && values.duration && values.output && values.friction,
    build: () => isValidDate(values.date) && isValidTime(values.time) && values.project && values.stage && values.action && values.momentum !== "",
    events: () => isValidDate(values.date) && isValidTime(values.time) && values.type && values.energyBefore && values.energyAfter && values.moment,
    admin: () => isValidDate(values.date) && isValidTime(values.time) && values.task && values.duration && values.load && values.completed,
    write: () => isValidDate(values.date) && isValidTime(values.time) && values.type && values.body
  };
  return validators[module]?.() || false;
}
function handleGenericSubmit(event, module) {
  event.preventDefault();
  const values = getFormValues(module);
  if (!validateModuleValues(module, values)) return;
  upsertEntry(module, values);
}

function bindGlobalActions() {
  document.getElementById("exportBtn")?.addEventListener("click", exportData);
  document.getElementById("importFile")?.addEventListener("change", importData);
  document.getElementById("todayBtn")?.addEventListener("click", jumpToTodayView);
  document.getElementById("themeToggle")?.addEventListener("click", toggleTheme);
  document.getElementById("entryJumpBtn")?.addEventListener("click", () => { document.querySelector('[data-tab="write"]')?.click(); document.getElementById("entryComposer")?.scrollIntoView({ behavior: "smooth", block: "start" }); });
}
function bindQuickFill() {
  document.querySelectorAll("[data-fill-today]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const module = btn.dataset.fillToday;
      const dateField = document.getElementById(`${module}Date`);
      const timeField = document.getElementById(`${module}Time`);
      if (dateField) dateField.value = todayString();
      if (timeField) timeField.value = currentTime24();
      if (module === "sleep") { document.getElementById("sleepDate").value = todayString(); document.getElementById("sleepBedtime").value = currentTime24(); document.getElementById("sleepWakeTime").value = currentTime24(); }
    });
  });
}
function bindFilters() {
  document.getElementById("filterZone")?.addEventListener("change", (e) => { state.filters.zone = e.target.value; renderAll(); });
  document.getElementById("filterModule")?.addEventListener("change", (e) => { state.filters.module = e.target.value; renderAll(); });
  const date = document.getElementById("filterDate");
  date?.addEventListener("input", (e) => { e.target.value = formatDateInput(e.target.value); state.filters.date = e.target.value.trim(); renderAll(); });
  date?.addEventListener("blur", (e) => { e.target.value = normalizeDate(e.target.value); state.filters.date = e.target.value.trim(); if (state.filters.date && !isValidDate(state.filters.date)) { state.filters.date = ""; e.target.value = ""; } renderAll(); });
  document.getElementById("filterText")?.addEventListener("input", (e) => { state.filters.text = e.target.value.trim().toLowerCase(); renderAll(); });
  document.getElementById("clearFiltersBtn")?.addEventListener("click", () => {
    state.filters = { zone: "all", module: "all", date: "", text: "" };
    ["filterZone", "filterModule"].forEach((id) => document.getElementById(id).value = "all");
    document.getElementById("filterDate").value = ""; document.getElementById("filterText").value = ""; renderAll();
  });
}
function bindStreamTabs() {
  document.querySelectorAll(".stream-tab").forEach((btn) => {
    btn.addEventListener("click", () => { state.activeStream = btn.dataset.stream; document.querySelectorAll(".stream-tab").forEach((b) => b.classList.toggle("active", b === btn)); renderContinuityStream(); });
  });
}

function renderAll() {
  renderSummary();
  Object.keys(MODULES).forEach(renderHistory);
  renderEntriesView();
  renderTimeline();
  renderContinuityStream();
}
function renderSummary() {
  const today = todayString();
  const summaryCards = document.getElementById("summaryCards");
  const todayExercise = state.data.exercise.filter((e) => e.date === today);
  const todaySleep = state.data.sleep.filter((e) => e.date === today);
  const todayWrite = state.data.write.filter((e) => e.date === today);
  const sleepHours = todaySleep.reduce((sum, item) => sum + Number(item.totalHours || 0), 0);
  const exerciseMinutes = todayExercise.reduce((sum, item) => sum + Number(item.duration || 0), 0);
  const realizationCount = todayWrite.filter((e) => e.keyRealization).length;
  const deepCount = todayWrite.filter((e) => ["Deep Reflection", "Synthesis"].includes(e.entryDensity)).length;
  if (summaryCards) summaryCards.innerHTML = `<div class="summary-item"><span class="label">Sleep hours</span><strong>${sleepHours || "—"}</strong></div><div class="summary-item"><span class="label">Exercise minutes</span><strong>${exerciseMinutes || "—"}</strong></div><div class="summary-item"><span class="label">Realizations</span><strong>${realizationCount || "—"}</strong></div><div class="summary-item"><span class="label">Deep entries</span><strong>${deepCount || "—"}</strong></div>`;
  const vitalsCount = ["sleep", "exercise", "nutrition", "sex"].reduce((sum, m) => sum + state.data[m].filter((e) => e.date === today).length, 0);
  const activityCount = ["work", "build", "events", "admin"].reduce((sum, m) => sum + state.data[m].filter((e) => e.date === today).length, 0);
  setText("todayVitalsCount", vitalsCount); setText("todayActivityCount", activityCount); setText("todayNarrativeCount", todayWrite.length); setText("todayRealizationCount", realizationCount);
}
function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = String(value); }
function getFilteredEntries(module) {
  return [...state.data[module]].filter((entry) => {
    if (state.filters.zone !== "all" && state.filters.zone !== MODULES[module].zone) return false;
    if (state.filters.module !== "all" && state.filters.module !== module) return false;
    if (state.filters.date && entry.date !== state.filters.date) return false;
    if (state.filters.text && !Object.values(entry).join(" ").toLowerCase().includes(state.filters.text)) return false;
    return true;
  }).sort(sortEntriesDesc);
}
function renderHistory(module) {
  const container = document.getElementById(`${module}History`);
  if (!container) return;
  const entries = getFilteredEntries(module).slice(0, module === "write" ? 8 : 12);
  container.innerHTML = entries.length ? entries.map((e) => historyCard(module, e)).join("") : `<div class="empty-state">No ${MODULES[module].label.toLowerCase()} entries match the current filters.</div>`;
  bindEntryActions(container, module);
}
function renderEntriesView() {
  const container = document.getElementById("entriesHistory");
  if (!container) return;
  const entries = getFilteredEntries("write");
  container.innerHTML = entries.length ? entries.map((e) => historyCard("write", e)).join("") : `<div class="empty-state">No narrative entries match the current filters.</div>`;
  bindEntryActions(container, "write");
}
function bindEntryActions(container, module) {
  container.querySelectorAll("[data-edit-id]").forEach((btn) => btn.addEventListener("click", () => editEntry(module, btn.dataset.editId)));
  container.querySelectorAll("[data-delete-id]").forEach((btn) => btn.addEventListener("click", () => deleteEntry(module, btn.dataset.deleteId)));
}
function historyCard(module, entry) {
  const titleMap = {
    sleep: `${entry.date} · ${entry.bedtime || "—"} → ${entry.wakeTime || "—"}`,
    exercise: `${entry.date} · ${entry.time || "—"} · ${entry.type || "Exercise"}`,
    nutrition: `${entry.date} · ${entry.time || "—"} · ${entry.title || "Nutrition"}`,
    sex: `${entry.date} · ${entry.time || "—"} · ${entry.activityType || "Sex"}`,
    work: `${entry.date} · ${entry.time || "—"} · ${entry.type || "Work"}`,
    build: `${entry.date} · ${entry.time || "—"} · ${entry.project || "Build"}`,
    events: `${entry.date} · ${entry.time || "—"} · ${entry.type || "Event"}`,
    admin: `${entry.date} · ${entry.time || "—"} · ${entry.task || "Admin"}`,
    write: `${entry.date} · ${entry.time || "—"} · ${entry.title || entry.type || "Narrative"}`
  };
  const meta = entryMeta(module, entry);
  const body = entryBody(module, entry);
  const insight = module === "write" ? insightBlock(entry) : "";
  return `<article class="history-entry"><div class="entry-zone-tag">${escapeHtml(MODULES[module].zone)}</div><h3>${escapeHtml(titleMap[module])}</h3><div class="entry-meta">${escapeHtml(meta)}</div>${insight}${body ? `<div class="entry-body">${escapeHtml(body)}</div>` : ""}<div class="entry-actions"><button class="mini-btn" type="button" data-edit-id="${entry.id}">Edit</button><button class="mini-btn" type="button" data-delete-id="${entry.id}">Delete</button></div></article>`;
}
function entryMeta(module, entry) {
  const map = {
    sleep: [`Hours: ${entry.totalHours || "—"}`, `Quality: ${entry.quality || "—"}`, entry.dreams ? `Dreams: ${entry.dreams}` : ""],
    exercise: [`Duration: ${entry.duration || "—"} min`, `Intensity: ${entry.intensity || "—"}`, `Effect: ${entry.regulation || "—"}`],
    nutrition: [`Meal: ${entry.mealType || "—"}`, entry.hydration ? `Hydration: ${entry.hydration}` : "", entry.cravings ? `Cravings: ${entry.cravings}` : ""],
    sex: [`Libido: ${entry.libido || "—"}`, `Tone: ${entry.tone || "—"}`, `Satisfaction: ${entry.satisfaction || "—"}`],
    work: [`Duration: ${entry.duration || "—"} min`, `Output: ${entry.output || "—"}`, `Friction: ${entry.friction || "—"}`],
    build: [`Stage: ${entry.stage || "—"}`, `Action: ${entry.action || "—"}`, `Momentum: ${entry.momentum || "—"}`],
    events: [`Before: ${entry.energyBefore || "—"}`, `After: ${entry.energyAfter || "—"}`, `Moment: ${entry.moment || "—"}`],
    admin: [`Duration: ${entry.duration || "—"} min`, `Load: ${entry.load || "—"}`, `Completed: ${entry.completed || "—"}`],
    write: [`Type: ${entry.type || "—"}`, entry.entryDensity ? `Density: ${entry.entryDensity}` : "", entry.themes ? `Themes: ${entry.themes}` : (entry.tags ? `Tags: ${entry.tags}` : "")]
  };
  return map[module].filter(Boolean).join(" • ");
}
function entryBody(module, entry) {
  if (module === "write") return entry.body || "";
  if (module === "events") return [entry.moment, entry.notes].filter(Boolean).join("\n");
  if (module === "build") return [entry.action, entry.notes].filter(Boolean).join("\n");
  return entry.notes || "";
}
function insightBlock(entry) {
  const lines = [
    entry.keyRealization ? `<div><strong>Realization:</strong> ${escapeHtml(entry.keyRealization)}</div>` : "",
    entry.emotionalTone ? `<div><strong>Tone:</strong> ${escapeHtml(entry.emotionalTone)}</div>` : "",
    entry.physicalState ? `<div><strong>Body:</strong> ${escapeHtml(entry.physicalState)}</div>` : "",
    entry.people ? `<div><strong>People:</strong> ${escapeHtml(entry.people)}</div>` : "",
    entry.place ? `<div><strong>Place:</strong> ${escapeHtml(entry.place)}</div>` : "",
    entry.connectedEntries ? `<div><strong>Thread:</strong> ${escapeHtml(entry.connectedEntries)}</div>` : "",
    entry.whatChanged ? `<div><strong>Changed:</strong> ${escapeHtml(entry.whatChanged)}</div>` : "",
    entry.followOnAction ? `<div><strong>Next:</strong> ${escapeHtml(entry.followOnAction)}</div>` : ""
  ].filter(Boolean).join("");
  return lines ? `<div class="insight-card">${lines}</div>` : "";
}

function allTimelineItems(dateFilter = todayString()) {
  const items = [];
  Object.keys(MODULES).forEach((module) => {
    state.data[module].forEach((entry) => {
      if (dateFilter && entry.date !== dateFilter) return;
      items.push({ module, zone: MODULES[module].zone, time: entry.time || entry.bedtime || "00:00", title: itemTitle(module, entry), subtitle: entryMeta(module, entry), body: module === "write" ? (entry.keyRealization || entry.body || "") : entryBody(module, entry), id: entry.id });
    });
  });
  return items.sort((a, b) => a.time.localeCompare(b.time));
}
function itemTitle(module, entry) { return entry.title || entry.type || entry.project || entry.task || entry.activityType || entry.mealType || MODULES[module].label; }
function renderTimeline() {
  const items = allTimelineItems(todayString());
  const list = document.getElementById("timelineList");
  const summary = document.getElementById("timelineSummary");
  if (!list || !summary) return;
  summary.textContent = items.length ? `${items.length} total entries for ${todayString()}` : `No entries logged yet for ${todayString()}.`;
  list.innerHTML = items.length ? items.map(timelineCard).join("") : `<div class="empty-state">No timeline items for today yet.</div>`;
}
function timelineCard(item) {
  return `<article class="timeline-entry timeline-${escapeHtml(item.zone)}"><div class="timeline-time">${escapeHtml(item.time)}</div><div class="timeline-tag">${escapeHtml(MODULES[item.module].label)}</div><div class="timeline-zone-tag">${escapeHtml(item.zone)}</div><h3>${escapeHtml(item.title)}</h3>${item.subtitle ? `<div class="timeline-meta">${escapeHtml(item.subtitle)}</div>` : ""}${item.body ? `<div class="timeline-body">${escapeHtml(truncate(item.body, 600))}</div>` : ""}</article>`;
}
function renderContinuityStream() {
  const container = document.getElementById("continuityStream");
  if (!container) return;
  if (state.activeStream === "timeline") {
    const items = allTimelineItems(state.filters.date || todayString());
    container.innerHTML = items.length ? items.map(timelineCard).join("") : `<div class="empty-state">No entries for this date yet.</div>`;
  } else if (state.activeStream === "realizations") {
    const entries = getFilteredEntries("write").filter((e) => e.keyRealization || inferRealization(e.body || ""));
    container.innerHTML = entries.length ? entries.map((e) => realizationCard(e)).join("") : `<div class="empty-state">No realizations captured yet. Add one in the Insight Layer.</div>`;
  } else {
    renderLinkedThreads(container);
  }
}
function realizationCard(entry) {
  const realization = entry.keyRealization || inferRealization(entry.body || "");
  return `<article class="history-entry realization-entry"><div class="entry-zone-tag">realization</div><h3>${escapeHtml(entry.title || entry.type || "Narrative")}</h3><div class="entry-meta">${escapeHtml([entry.date, entry.time, entry.themes || entry.tags].filter(Boolean).join(" • "))}</div><div class="entry-body">${escapeHtml(realization)}</div></article>`;
}
function renderLinkedThreads(container) {
  const groups = {};
  state.data.write.forEach((entry) => {
    const raw = entry.connectedEntries || entry.themes || entry.tags || "Unthreaded";
    raw.split(",").map((s) => s.trim()).filter(Boolean).forEach((key) => {
      groups[key] ||= [];
      groups[key].push(entry);
    });
  });
  const html = Object.entries(groups).sort((a, b) => b[1].length - a[1].length).map(([key, entries]) => `<article class="thread-card"><div class="entry-zone-tag">thread</div><h3>${escapeHtml(key)}</h3><div class="entry-meta">${entries.length} connected entr${entries.length === 1 ? "y" : "ies"}</div>${entries.slice(0, 5).map((e) => `<div class="thread-row"><strong>${escapeHtml(e.date)}</strong> · ${escapeHtml(e.title || e.type || "Narrative")}</div>`).join("")}</article>`).join("");
  container.innerHTML = html || `<div class="empty-state">No linked threads yet. Use “Connected entries / thread” in the Insight Layer.</div>`;
}
function inferRealization(text) {
  const patterns = ["key takeaway", "strongest realization", "another realization", "clearest takeaway", "what i realized", "i realized", "important realization", "the realization"];
  const paragraphs = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const hit = paragraphs.find((p) => patterns.some((pattern) => p.toLowerCase().includes(pattern)));
  return hit ? truncate(hit.replace(/^[-*\s]+/, ""), 280) : "";
}
function truncate(value, limit) { return value && value.length > limit ? `${value.slice(0, limit).trim()}…` : value; }

function bindTimeline() {
  const trigger = document.getElementById("timelineTrigger");
  const modal = document.getElementById("timelineModal");
  const closeBtn = document.getElementById("closeTimelineBtn");
  if (!trigger || !modal || !closeBtn) return;
  trigger.addEventListener("click", () => { renderTimeline(); modal.classList.remove("hidden"); modal.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; });
  closeBtn.addEventListener("click", closeTimeline);
  modal.querySelectorAll("[data-close-timeline='true']").forEach((el) => el.addEventListener("click", closeTimeline));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !modal.classList.contains("hidden")) closeTimeline(); });
}
function closeTimeline() { const modal = document.getElementById("timelineModal"); if (modal) { modal.classList.add("hidden"); modal.setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; } }
function editEntry(module, id) { const entry = state.data[module].find((item) => item.id === id); if (!entry) return; fillForm(module, entry, true); document.querySelector(`[data-tab="${module}"]`)?.click(); }
function deleteEntry(module, id) { state.data[module] = state.data[module].filter((item) => item.id !== id); saveData(); renderAll(); }
function exportData() {
  const payload = { app: "Life Vitals vNext", exportedAt: new Date().toISOString(), data: state.data };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = `life-vitals-vnext-export-${todayString()}.json`; link.click(); URL.revokeObjectURL(url);
}
function importData(event) {
  const file = event.target.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { try { const parsed = JSON.parse(reader.result); state.data = sanitizeImportedData(parsed.data || parsed); saveData(); renderAll(); } catch (error) { console.error("Import failed:", error); alert("Import failed. Please use a valid JSON export."); } finally { event.target.value = ""; } };
  reader.readAsText(file);
}
function jumpToTodayView() {
  state.filters = { zone: "all", module: "all", date: todayString(), text: "" };
  document.getElementById("filterZone").value = "all"; document.getElementById("filterModule").value = "all"; document.getElementById("filterDate").value = todayString(); document.getElementById("filterText").value = "";
  renderAll(); document.querySelector(".focus-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
function escapeHtml(value = "") { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
function registerServiceWorker() { if (!("serviceWorker" in navigator)) return; window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch((e) => console.error("Service worker registration failed:", e))); }
function setupInstallPrompt() {
  const installBtn = document.getElementById("installBtn"); if (!installBtn) return;
  window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); deferredPrompt = event; installBtn.classList.remove("hidden"); });
  installBtn.addEventListener("click", async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; installBtn.classList.add("hidden"); });
  window.addEventListener("appinstalled", () => installBtn.classList.add("hidden"));
}
