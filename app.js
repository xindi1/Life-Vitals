const STORAGE_KEY = "lifeVitalsUnifiedData_v1";
const LEGACY_STORAGE_KEY = "lifeVitalsData_v2";
const DRAFTS_KEY = "lifeVitalsUnifiedDrafts_v1";
const LEGACY_DRAFTS_KEY = "lifeVitalsDrafts_v2";
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
  write: { label: "Write", zone: "narrative" }
};

const defaultData = Object.fromEntries(Object.keys(MODULES).map((key) => [key, []]));

const state = {
  data: loadData(),
  drafts: loadDrafts(),
  activeTab: "sleep",
  filters: {
    zone: "all",
    module: "all",
    date: "",
    text: ""
  }
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
  renderAll();
  restoreDrafts();
  registerServiceWorker();
  setupInstallPrompt();
});

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
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
    Object.keys(MODULES).forEach((module) => {
      clean[module] = parsed[module] || {};
    });
    return clean;
  } catch (error) {
    console.error("Failed to load drafts:", error);
    return {};
  }
}

function sanitizeImportedData(imported) {
  const clean = {};
  Object.keys(MODULES).forEach((module) => {
    clean[module] = Array.isArray(imported[module]) ? imported[module] : [];
  });
  return clean;
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function saveDrafts() {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(state.drafts));
}

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
  if (!themeMeta) return;
  themeMeta.setAttribute("content", document.body.classList.contains("light") ? "#eef4fb" : "#0f1720");
}

function setCurrentDate() {
  const dateEl = document.getElementById("currentDate");
  const now = new Date();
  dateEl.textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(now);
}

function todayString() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function currentTime24() {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function formatDateInput(value) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function normalizeDate(value) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length === 0) return "";
  if (digits.length < 8) return formatDateInput(digits);

  let year = parseInt(digits.slice(0, 4), 10);
  let month = parseInt(digits.slice(4, 6), 10);
  let day = parseInt(digits.slice(6, 8), 10);

  if (Number.isNaN(year)) year = new Date().getFullYear();
  if (Number.isNaN(month)) month = 1;
  if (Number.isNaN(day)) day = 1;

  month = Math.max(1, Math.min(12, month));
  const maxDay = new Date(year, month, 0).getDate();
  day = Math.max(1, Math.min(maxDay, day));

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
  if (digits.length === 0) return "";
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function normalizeTime(value) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length === 0) return "";
  if (digits.length < 4) return formatTimeInput(digits);

  let hours = parseInt(digits.slice(0, 2), 10);
  let minutes = parseInt(digits.slice(2, 4), 10);

  if (Number.isNaN(hours)) hours = 0;
  if (Number.isNaN(minutes)) minutes = 0;

  hours = Math.max(0, Math.min(23, hours));
  minutes = Math.max(0, Math.min(59, minutes));

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function isValidTime(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function seedDefaultDates() {
  const today = todayString();
  const time = currentTime24();
  Object.keys(MODULES).forEach((module) => {
    const dateEl = document.getElementById(`${module}Date`);
    if (dateEl && !dateEl.value) dateEl.value = today;
    const timeEl = document.getElementById(`${module}Time`);
    if (timeEl && !timeEl.value) timeEl.value = time;
  });
  ["sleepBedtime", "sleepWakeTime"].forEach((id) => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = time;
  });
}

function bindDateFormatting() {
  const dateIds = ["filterDate", ...Object.keys(MODULES).map((module) => `${module}Date`)];
  dateIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => {
      el.value = formatDateInput(el.value);
    });
    el.addEventListener("blur", () => {
      el.value = normalizeDate(el.value);
      if (id === "filterDate" && el.value && !isValidDate(el.value)) el.value = "";
    });
  });
}

function bindTimeFormatting() {
  const timeIds = ["sleepBedtime", "sleepWakeTime", ...Object.keys(MODULES).map((module) => `${module}Time`)];
  [...new Set(timeIds)].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => {
      el.value = formatTimeInput(el.value);
    });
    el.addEventListener("blur", () => {
      el.value = normalizeTime(el.value);
    });
  });
}

function bindTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      state.activeTab = tab;
      tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
      panels.forEach((panel) => panel.classList.toggle("active", panel.id === `${tab}Tab`));
      document.getElementById(`${tab}Tab`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function bindForms() {
  Object.keys(MODULES).forEach((module) => {
    const form = document.getElementById(`${module}Form`);
    if (!form) return;
    form.addEventListener("submit", (event) => handleGenericSubmit(event, module));
  });
  document.querySelectorAll("[data-reset-form]").forEach((btn) => {
    btn.addEventListener("click", () => resetForm(btn.dataset.resetForm));
  });
  setupAutoSaveDrafts();
}

function setupAutoSaveDrafts() {
  const fields = document.querySelectorAll("form input, form textarea, form select");
  fields.forEach((field) => {
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
    const draft = state.drafts[module];
    if (!draft) return;
    fillForm(module, draft, false);
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
    write: { id: "writeId", date: "writeDate", time: "writeTime", type: "writeType", title: "writeTitle", body: "writeBody", tags: "writeTags" }
  };
}

function serializeForm(module) {
  const map = formFieldMap()[module];
  const payload = {};
  Object.entries(map).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el) payload[key] = el.value;
  });
  return payload;
}

function getFormValues(module) {
  const map = formFieldMap()[module];
  const payload = {};
  Object.entries(map).forEach(([key, id]) => {
    const el = document.getElementById(id);
    payload[key] = el ? el.value.trim() : "";
  });
  return payload;
}

function fillForm(module, entry, includeId = true) {
  const map = formFieldMap()[module];
  Object.entries(map).forEach(([key, id]) => {
    if (!includeId && key === "id") return;
    const el = document.getElementById(id);
    if (!el) return;
    el.value = entry[key] ?? "";
  });
}

function clearDraft(module) {
  delete state.drafts[module];
  saveDrafts();
}

function resetForm(module) {
  const form = document.getElementById(`${module}Form`);
  if (!form) return;
  form.reset();
  const idField = document.getElementById(`${module}Id`);
  if (idField) idField.value = "";
  const dateField = document.getElementById(`${module}Date`);
  const timeField = document.getElementById(`${module}Time`);
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
  const collection = state.data[module];
  const entry = { ...payload, id: payload.id || generateId(), updatedAt: new Date().toISOString() };
  const index = collection.findIndex((item) => item.id === entry.id);
  if (index >= 0) collection[index] = entry; else collection.push(entry);
  collection.sort(sortEntriesDesc);
  saveData();
  clearDraft(module);
  renderAll();
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
  return validators[module] ? validators[module]() : false;
}

function handleGenericSubmit(event, module) {
  event.preventDefault();
  const values = getFormValues(module);
  if (!validateModuleValues(module, values)) return;
  upsertEntry(module, values);
  resetForm(module);
}

function bindGlobalActions() {
  document.getElementById("exportBtn").addEventListener("click", exportData);
  document.getElementById("importFile").addEventListener("change", importData);
  document.getElementById("todayBtn").addEventListener("click", jumpToTodayView);
  document.getElementById("themeToggle").addEventListener("click", toggleTheme);
}

function bindQuickFill() {
  document.querySelectorAll("[data-fill-today]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const module = btn.dataset.fillToday;
      if (!module || !MODULES[module]) return;
      const dateField = document.getElementById(`${module}Date`);
      const timeField = document.getElementById(`${module}Time`);
      if (dateField) dateField.value = todayString();
      if (timeField) timeField.value = currentTime24();
      if (module === "sleep") {
        document.getElementById("sleepDate").value = todayString();
        document.getElementById("sleepBedtime").value = currentTime24();
        document.getElementById("sleepWakeTime").value = currentTime24();
      }
    });
  });
}

function bindFilters() {
  document.getElementById("filterZone").addEventListener("change", (e) => {
    state.filters.zone = e.target.value;
    renderAll();
  });
  document.getElementById("filterModule").addEventListener("change", (e) => {
    state.filters.module = e.target.value;
    renderAll();
  });
  const filterDate = document.getElementById("filterDate");
  filterDate.addEventListener("input", (e) => {
    e.target.value = formatDateInput(e.target.value);
    state.filters.date = e.target.value.trim();
    renderAll();
  });
  filterDate.addEventListener("blur", (e) => {
    e.target.value = normalizeDate(e.target.value);
    state.filters.date = e.target.value.trim();
    if (state.filters.date && !isValidDate(state.filters.date)) {
      state.filters.date = "";
      e.target.value = "";
    }
    renderAll();
  });
  document.getElementById("filterText").addEventListener("input", (e) => {
    state.filters.text = e.target.value.trim().toLowerCase();
    renderAll();
  });
  document.getElementById("clearFiltersBtn").addEventListener("click", () => {
    state.filters = { zone: "all", module: "all", date: "", text: "" };
    document.getElementById("filterZone").value = "all";
    document.getElementById("filterModule").value = "all";
    document.getElementById("filterDate").value = "";
    document.getElementById("filterText").value = "";
    renderAll();
  });
}

function renderAll() {
  renderSummary();
  Object.keys(MODULES).forEach(renderHistory);
  renderEntriesView();
  renderTimeline();
}

function renderSummary() {
  const today = todayString();
  const summaryCards = document.getElementById("summaryCards");
  const vitalsModules = ["sleep", "exercise", "nutrition", "sex"];
  const activityModules = ["work", "build", "events", "admin"];

  const todaySleep = state.data.sleep.filter((e) => e.date === today);
  const todayExercise = state.data.exercise.filter((e) => e.date === today);
  const todayWork = state.data.work.filter((e) => e.date === today);
  const todayBuild = state.data.build.filter((e) => e.date === today);
  const todayWrite = state.data.write.filter((e) => e.date === today);

  const sleepHours = todaySleep.reduce((sum, item) => sum + Number(item.totalHours || 0), 0);
  const exerciseMinutes = todayExercise.reduce((sum, item) => sum + Number(item.duration || 0), 0);
  const workMinutes = todayWork.reduce((sum, item) => sum + Number(item.duration || 0), 0);
  const buildMomentum = todayBuild.reduce((sum, item) => sum + Number(item.momentum || 0), 0);

  summaryCards.innerHTML = `
    <div class="summary-item"><span class="label">Sleep hours</span><strong>${sleepHours || "—"}</strong></div>
    <div class="summary-item"><span class="label">Exercise minutes</span><strong>${exerciseMinutes || "—"}</strong></div>
    <div class="summary-item"><span class="label">Work minutes</span><strong>${workMinutes || "—"}</strong></div>
    <div class="summary-item"><span class="label">Build momentum</span><strong>${buildMomentum || "—"}</strong></div>
  `;

  const vitalsCount = vitalsModules.reduce((sum, module) => sum + state.data[module].filter((e) => e.date === today).length, 0);
  const activityCount = activityModules.reduce((sum, module) => sum + state.data[module].filter((e) => e.date === today).length, 0);
  const narrativeCount = todayWrite.length;

  document.getElementById("todayVitalsCount").textContent = String(vitalsCount);
  document.getElementById("todayActivityCount").textContent = String(activityCount);
  document.getElementById("todayNarrativeCount").textContent = String(narrativeCount);
  document.getElementById("todayTotalCount").textContent = String(vitalsCount + activityCount + narrativeCount);
}

function getFilteredEntries(module) {
  return [...state.data[module]].filter((entry) => {
    const zone = MODULES[module].zone;
    if (state.filters.zone !== "all" && state.filters.zone !== zone) return false;
    if (state.filters.module !== "all" && state.filters.module !== module) return false;
    if (state.filters.date && entry.date !== state.filters.date) return false;
    if (state.filters.text) {
      const haystack = Object.values(entry).join(" ").toLowerCase();
      if (!haystack.includes(state.filters.text)) return false;
    }
    return true;
  }).sort(sortEntriesDesc);
}

function renderHistory(module) {
  const container = document.getElementById(`${module}History`);
  if (!container) return;
  const entries = getFilteredEntries(module);
  if (!entries.length) {
    container.innerHTML = `<div class="empty-state">No ${MODULES[module].label.toLowerCase()} entries match the current filters.</div>`;
    return;
  }
  container.innerHTML = entries.map((entry) => historyCard(module, entry)).join("");
  container.querySelectorAll("[data-edit-id]").forEach((btn) => {
    btn.addEventListener("click", () => editEntry(module, btn.dataset.editId));
  });
  container.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", () => deleteEntry(module, btn.dataset.deleteId));
  });
}

function renderEntriesView() {
  const container = document.getElementById("entriesHistory");
  if (!container) return;
  const entries = getFilteredEntries("write");
  if (!entries.length) {
    container.innerHTML = `<div class="empty-state">No narrative entries match the current filters.</div>`;
    return;
  }
  container.innerHTML = entries.map((entry) => historyCard("write", entry)).join("");
  container.querySelectorAll("[data-edit-id]").forEach((btn) => {
    btn.addEventListener("click", () => editEntry("write", btn.dataset.editId));
  });
  container.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", () => deleteEntry("write", btn.dataset.deleteId));
  });
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

  const metaMap = {
    sleep: [`Hours: ${entry.totalHours || "—"}`, `Quality: ${entry.quality || "—"}`, entry.dreams ? `Dreams: ${entry.dreams}` : ""],
    exercise: [`Duration: ${entry.duration || "—"} min`, `Intensity: ${entry.intensity || "—"}`, `Effect: ${entry.regulation || "—"}`],
    nutrition: [`Meal: ${entry.mealType || "—"}`, entry.hydration ? `Hydration: ${entry.hydration}` : "", entry.cravings ? `Cravings: ${entry.cravings}` : ""],
    sex: [`Libido: ${entry.libido || "—"}`, `Tone: ${entry.tone || "—"}`, `Satisfaction: ${entry.satisfaction || "—"}`],
    work: [`Duration: ${entry.duration || "—"} min`, `Output: ${entry.output || "—"}`, `Friction: ${entry.friction || "—"}`],
    build: [`Stage: ${entry.stage || "—"}`, `Action: ${entry.action || "—"}`, `Momentum: ${entry.momentum || "—"}`],
    events: [`Before: ${entry.energyBefore || "—"}`, `After: ${entry.energyAfter || "—"}`, `Moment: ${entry.moment || "—"}`],
    admin: [`Duration: ${entry.duration || "—"} min`, `Load: ${entry.load || "—"}`, `Completed: ${entry.completed || "—"}`],
    write: [`Type: ${entry.type || "—"}`, entry.tags ? `Tags: ${entry.tags}` : ""]
  };

  const bodyMap = {
    sleep: entry.notes || "",
    exercise: entry.notes || "",
    nutrition: entry.notes || "",
    sex: entry.notes || "",
    work: entry.notes || "",
    build: entry.notes || "",
    events: entry.notes || "",
    admin: entry.notes || "",
    write: entry.body || ""
  };

  return `
    <article class="history-entry">
      <div class="entry-zone-tag">${escapeHtml(MODULES[module].zone)}</div>
      <h3>${escapeHtml(titleMap[module])}</h3>
      <div class="entry-meta">${escapeHtml(metaMap[module].filter(Boolean).join(" • "))}</div>
      ${bodyMap[module] ? `<div class="entry-body">${escapeHtml(bodyMap[module])}</div>` : ""}
      <div class="entry-actions">
        <button class="mini-btn" type="button" data-edit-id="${entry.id}">Edit</button>
        <button class="mini-btn" type="button" data-delete-id="${entry.id}">Delete</button>
      </div>
    </article>
  `;
}

function buildTodayTimeline() {
  const today = todayString();
  const items = [];

  state.data.sleep.forEach((entry) => {
    if (entry.date === today && entry.bedtime) {
      items.push({ module: "sleep", zone: "vitals", time: entry.bedtime, title: "Bedtime", subtitle: entry.totalHours ? `Estimated sleep: ${entry.totalHours} hrs` : (entry.quality ? `Quality: ${entry.quality}/5` : ""), body: entry.notes || "" });
    }
    if (entry.date === today && entry.wakeTime) {
      items.push({ module: "sleep", zone: "vitals", time: entry.wakeTime, title: "Wake time", subtitle: entry.totalHours ? `Estimated sleep: ${entry.totalHours} hrs` : (entry.quality ? `Quality: ${entry.quality}/5` : ""), body: entry.dreams ? `Dreams: ${entry.dreams}${entry.notes ? `\n${entry.notes}` : ""}` : (entry.notes || "") });
    }
  });

  state.data.exercise.forEach((entry) => {
    if (entry.date === today) {
      items.push({ module: "exercise", zone: "vitals", time: entry.time || "00:00", title: entry.type || "Exercise", subtitle: `${entry.duration || "—"} min${entry.intensity ? ` • Intensity ${entry.intensity}/5` : ""}`, body: entry.notes || "" });
    }
  });

  state.data.nutrition.forEach((entry) => {
    if (entry.date === today) {
      items.push({ module: "nutrition", zone: "vitals", time: entry.time || "00:00", title: entry.title || "Nutrition", subtitle: entry.mealType || "", body: [entry.notes, entry.hydration ? `Hydration: ${entry.hydration}` : "", entry.cravings ? `Cravings: ${entry.cravings}` : ""].filter(Boolean).join("\n") });
    }
  });

  state.data.sex.forEach((entry) => {
    if (entry.date === today) {
      items.push({ module: "sex", zone: "vitals", time: entry.time || "00:00", title: entry.activityType || "Sex", subtitle: [entry.libido ? `Libido ${entry.libido}/5` : "", entry.tone || "", entry.satisfaction ? `Satisfaction ${entry.satisfaction}/5` : ""].filter(Boolean).join(" • "), body: entry.notes || "" });
    }
  });

  state.data.work.forEach((entry) => {
    if (entry.date === today) {
      items.push({ module: "work", zone: "activity", time: entry.time || "00:00", title: entry.type || "Work", subtitle: `${entry.duration || "—"} min • Output: ${entry.output || "—"}`, body: entry.notes || "" });
    }
  });

  state.data.build.forEach((entry) => {
    if (entry.date === today) {
      items.push({ module: "build", zone: "activity", time: entry.time || "00:00", title: entry.project || "Build", subtitle: `${entry.stage || "—"} • Momentum ${entry.momentum || "—"}`, body: [entry.action, entry.notes].filter(Boolean).join("\n") });
    }
  });

  state.data.events.forEach((entry) => {
    if (entry.date === today) {
      items.push({ module: "events", zone: "activity", time: entry.time || "00:00", title: entry.type || "Event", subtitle: `Energy ${entry.energyBefore || "—"} → ${entry.energyAfter || "—"}`, body: [entry.moment, entry.notes].filter(Boolean).join("\n") });
    }
  });

  state.data.admin.forEach((entry) => {
    if (entry.date === today) {
      items.push({ module: "admin", zone: "activity", time: entry.time || "00:00", title: entry.task || "Admin", subtitle: `${entry.duration || "—"} min • Load ${entry.load || "—"} • ${entry.completed || "—"}`, body: entry.notes || "" });
    }
  });

  state.data.write.forEach((entry) => {
    if (entry.date === today) {
      items.push({ module: "write", zone: "narrative", time: entry.time || "00:00", title: entry.title || entry.type || "Narrative", subtitle: [entry.type || "", entry.tags ? `Tags: ${entry.tags}` : ""].filter(Boolean).join(" • "), body: entry.body || "" });
    }
  });

  return items.sort((a, b) => a.time.localeCompare(b.time));
}

function renderTimeline() {
  const items = buildTodayTimeline();
  const timelineList = document.getElementById("timelineList");
  const timelineSummary = document.getElementById("timelineSummary");
  if (!timelineList || !timelineSummary) return;

  timelineSummary.textContent = items.length
    ? `${items.length} total entries for ${todayString()}`
    : `No entries logged yet for ${todayString()}.`;

  if (!items.length) {
    timelineList.innerHTML = `<div class="empty-state">No timeline items for today yet.</div>`;
    return;
  }

  timelineList.innerHTML = items.map((item) => `
    <article class="timeline-entry timeline-${escapeHtml(item.zone)}">
      <div class="timeline-time">${escapeHtml(item.time)}</div>
      <div class="timeline-tag">${escapeHtml(MODULES[item.module].label)}</div>
      <div class="timeline-zone-tag">${escapeHtml(item.zone)}</div>
      <h3>${escapeHtml(item.title)}</h3>
      ${item.subtitle ? `<div class="timeline-meta">${escapeHtml(item.subtitle)}</div>` : ""}
      ${item.body ? `<div class="timeline-body">${escapeHtml(item.body)}</div>` : ""}
    </article>
  `).join("");
}

function bindTimeline() {
  const trigger = document.getElementById("timelineTrigger");
  const modal = document.getElementById("timelineModal");
  const closeBtn = document.getElementById("closeTimelineBtn");

  if (!trigger || !modal || !closeBtn) return;

  trigger.addEventListener("click", () => {
    renderTimeline();
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  });

  closeBtn.addEventListener("click", closeTimeline);

  modal.querySelectorAll("[data-close-timeline='true']").forEach((el) => {
    el.addEventListener("click", closeTimeline);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) closeTimeline();
  });
}

function closeTimeline() {
  const modal = document.getElementById("timelineModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function editEntry(module, id) {
  const entry = state.data[module].find((item) => item.id === id);
  if (!entry) return;
  fillForm(module, entry, true);
  document.querySelector(`[data-tab="${module}"]`)?.click();
}

function deleteEntry(module, id) {
  state.data[module] = state.data[module].filter((item) => item.id !== id);
  saveData();
  renderAll();
}

function exportData() {
  const payload = { app: "Life Vitals Unified", exportedAt: new Date().toISOString(), data: state.data };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `life-vitals-unified-export-${todayString()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      state.data = sanitizeImportedData(parsed.data || parsed);
      saveData();
      renderAll();
    } catch (error) {
      console.error("Import failed:", error);
      alert("Import failed. Please use a valid JSON export.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function jumpToTodayView() {
  state.filters = { zone: "all", module: "all", date: todayString(), text: "" };
  document.getElementById("filterZone").value = "all";
  document.getElementById("filterModule").value = "all";
  document.getElementById("filterDate").value = todayString();
  document.getElementById("filterText").value = "";
  renderAll();
  document.querySelector(".filter-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
}

function setupInstallPrompt() {
  const installBtn = document.getElementById("installBtn");
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installBtn.classList.remove("hidden");
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.classList.add("hidden");
  });

  window.addEventListener("appinstalled", () => {
    installBtn.classList.add("hidden");
  });
}
