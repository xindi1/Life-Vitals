const STORAGE_KEY = "lifeVitalsData_v1";
const DRAFTS_KEY = "lifeVitalsDrafts_v1";

const MODULES = {
  sleep: { label: "Sleep" },
  exercise: { label: "Exercise" },
  nutrition: { label: "Nutrition" },
  sex: { label: "Sex" },
  journal: { label: "Journal" }
};

const defaultData = {
  sleep: [],
  exercise: [],
  nutrition: [],
  sex: [],
  journal: []
};

const state = {
  data: loadData(),
  drafts: loadDrafts(),
  activeTab: "sleep",
  filters: {
    module: "all",
    date: "",
    text: ""
  }
};

let deferredPrompt = null;

document.addEventListener("DOMContentLoaded", () => {
  setCurrentDate();
  seedDefaultDates();
  bindTabs();
  bindForms();
  bindGlobalActions();
  bindFilters();
  bindQuickFill();
  renderAll();
  restoreDrafts();
  registerServiceWorker();
  setupInstallPrompt();
});

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultData);
    const parsed = JSON.parse(raw);
    return {
      sleep: Array.isArray(parsed.sleep) ? parsed.sleep : [],
      exercise: Array.isArray(parsed.exercise) ? parsed.exercise : [],
      nutrition: Array.isArray(parsed.nutrition) ? parsed.nutrition : [],
      sex: Array.isArray(parsed.sex) ? parsed.sex : [],
      journal: Array.isArray(parsed.journal) ? parsed.journal : []
    };
  } catch (error) {
    console.error("Failed to load data:", error);
    return structuredClone(defaultData);
  }
}

function loadDrafts() {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.error("Failed to load drafts:", error);
    return {};
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function saveDrafts() {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(state.drafts));
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

function pad(value) {
  return String(value).padStart(2, "0");
}

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function seedDefaultDates() {
  const today = todayString();
  const time = currentTime24();

  [
    "sleepDate",
    "exerciseDate",
    "nutritionDate",
    "sexDate",
    "journalDate"
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = today;
  });

  [
    "exerciseTime",
    "nutritionTime",
    "sexTime",
    "journalTime"
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = time;
  });
}

function bindTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      state.activeTab = tab;

      tabButtons.forEach((b) => b.classList.toggle("active", b === btn));
      panels.forEach((panel) => {
        panel.classList.toggle("active", panel.id === `${tab}Tab`);
      });

      document.getElementById(`${tab}Tab`)?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  });
}

function bindForms() {
  document.getElementById("sleepForm").addEventListener("submit", handleSleepSubmit);
  document.getElementById("exerciseForm").addEventListener("submit", handleExerciseSubmit);
  document.getElementById("nutritionForm").addEventListener("submit", handleNutritionSubmit);
  document.getElementById("sexForm").addEventListener("submit", handleSexSubmit);
  document.getElementById("journalForm").addEventListener("submit", handleJournalSubmit);

  document.querySelectorAll("[data-reset-form]").forEach((btn) => {
    btn.addEventListener("click", () => resetForm(btn.dataset.resetForm));
  });

  setupAutoSaveDrafts();
}

function setupAutoSaveDrafts() {
  const fields = document.querySelectorAll("form input, form textarea, form select");

  fields.forEach((field) => {
    field.addEventListener("input", () => {
      const form = field.closest("form");
      if (!form) return;
      const module = form.id.replace("Form", "");
      state.drafts[module] = serializeForm(module);
      saveDrafts();
    });

    field.addEventListener("change", () => {
      const form = field.closest("form");
      if (!form) return;
      const module = form.id.replace("Form", "");
      state.drafts[module] = serializeForm(module);
      saveDrafts();
    });
  });
}

function restoreDrafts() {
  Object.keys(MODULES).forEach((module) => {
    const draft = state.drafts[module];
    if (!draft) return;
    fillForm(module, draft, false);
  });
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

function clearDraft(module) {
  delete state.drafts[module];
  saveDrafts();
}

function formFieldMap() {
  return {
    sleep: {
      id: "sleepId",
      date: "sleepDate",
      bedtime: "sleepBedtime",
      wakeTime: "sleepWakeTime",
      totalHours: "sleepHours",
      quality: "sleepQuality",
      dreams: "sleepDreams",
      notes: "sleepNotes"
    },
    exercise: {
      id: "exerciseId",
      date: "exerciseDate",
      time: "exerciseTime",
      type: "exerciseType",
      duration: "exerciseDuration",
      intensity: "exerciseIntensity",
      regulation: "exerciseRegulation",
      notes: "exerciseNotes"
    },
    nutrition: {
      id: "nutritionId",
      date: "nutritionDate",
      time: "nutritionTime",
      title: "nutritionTitle",
      mealType: "nutritionMealType",
      notes: "nutritionNotes",
      hydration: "nutritionHydration",
      cravings: "nutritionCravings"
    },
    sex: {
      id: "sexId",
      date: "sexDate",
      time: "sexTime",
      libido: "sexLibido",
      activityType: "sexActivityType",
      tone: "sexTone",
      satisfaction: "sexSatisfaction",
      notes: "sexNotes"
    },
    journal: {
      id: "journalId",
      date: "journalDate",
      time: "journalTime",
      text: "journalText"
    }
  };
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

function resetForm(module) {
  const form = document.getElementById(`${module}Form`);
  form.reset();

  const idField = document.getElementById(`${module}Id`);
  if (idField) idField.value = "";

  if (module === "sleep") {
    document.getElementById("sleepDate").value = todayString();
  } else {
    const dateField = document.getElementById(`${module}Date`);
    const timeField = document.getElementById(`${module}Time`);
    if (dateField) dateField.value = todayString();
    if (timeField) timeField.value = currentTime24();
  }

  clearDraft(module);
}

function upsertEntry(module, payload) {
  const collection = state.data[module];
  const entry = {
    ...payload,
    id: payload.id || generateId(),
    updatedAt: new Date().toISOString()
  };

  const index = collection.findIndex((item) => item.id === entry.id);

  if (index >= 0) {
    collection[index] = entry;
  } else {
    collection.push(entry);
  }

  collection.sort(sortEntriesDesc);
  saveData();
  clearDraft(module);
  renderAll();
}

function sortEntriesDesc(a, b) {
  const aStamp = `${a.date || ""} ${a.time || a.bedtime || "00:00"}`;
  const bStamp = `${b.date || ""} ${b.time || b.bedtime || "00:00"}`;
  return bStamp.localeCompare(aStamp);
}

function handleSleepSubmit(event) {
  event.preventDefault();
  const values = getFormValues("sleep");

  if (!values.date || !values.bedtime || !values.wakeTime || !values.quality) {
    return;
  }

  upsertEntry("sleep", values);
  resetForm("sleep");
}

function handleExerciseSubmit(event) {
  event.preventDefault();
  const values = getFormValues("exercise");

  if (!values.date || !values.time || !values.type || !values.duration || !values.intensity || !values.regulation) {
    return;
  }

  upsertEntry("exercise", values);
  resetForm("exercise");
}

function handleNutritionSubmit(event) {
  event.preventDefault();
  const values = getFormValues("nutrition");

  if (!values.date || !values.time || !values.title || !values.mealType) {
    return;
  }

  upsertEntry("nutrition", values);
  resetForm("nutrition");
}

function handleSexSubmit(event) {
  event.preventDefault();
  const values = getFormValues("sex");

  if (!values.date || !values.time || !values.libido || !values.activityType || !values.tone || !values.satisfaction) {
    return;
  }

  upsertEntry("sex", values);
  resetForm("sex");
}

function handleJournalSubmit(event) {
  event.preventDefault();
  const values = getFormValues("journal");

  if (!values.date || !values.time || !values.text) {
    return;
  }

  upsertEntry("journal", values);
  resetForm("journal");
}

function bindGlobalActions() {
  document.getElementById("exportBtn").addEventListener("click", exportData);
  document.getElementById("importFile").addEventListener("change", importData);
  document.getElementById("todayBtn").addEventListener("click", jumpToTodayView);
}

function bindQuickFill() {
  document.querySelectorAll("[data-fill-today]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const module = btn.dataset.fillToday;
      if (!module) return;

      const dateField = document.getElementById(`${module}Date`);
      const timeField = document.getElementById(`${module}Time`);

      if (dateField) dateField.value = todayString();
      if (timeField) timeField.value = currentTime24();

      if (module === "sleep") {
        document.getElementById("sleepDate").value = todayString();
      }
    });
  });
}

function bindFilters() {
  document.getElementById("filterModule").addEventListener("change", (e) => {
    state.filters.module = e.target.value;
    renderAll();
  });

  document.getElementById("filterDate").addEventListener("change", (e) => {
    state.filters.date = e.target.value;
    renderAll();
  });

  document.getElementById("filterText").addEventListener("input", (e) => {
    state.filters.text = e.target.value.trim().toLowerCase();
    renderAll();
  });

  document.getElementById("clearFiltersBtn").addEventListener("click", () => {
    state.filters = { module: "all", date: "", text: "" };
    document.getElementById("filterModule").value = "all";
    document.getElementById("filterDate").value = "";
    document.getElementById("filterText").value = "";
    renderAll();
  });
}

function renderAll() {
  renderSummary();
  renderHistory("sleep");
  renderHistory("exercise");
  renderHistory("nutrition");
  renderHistory("sex");
  renderHistory("journal");
}

function renderSummary() {
  const today = todayString();
  const summaryCards = document.getElementById("summaryCards");

  const todaySleep = state.data.sleep.filter((e) => e.date === today);
  const todayExercise = state.data.exercise.filter((e) => e.date === today);
  const todayNutrition = state.data.nutrition.filter((e) => e.date === today);
  const todaySex = state.data.sex.filter((e) => e.date === today);
  const todayJournal = state.data.journal.filter((e) => e.date === today);

  const libidoAvg = todaySex.length
    ? (
        todaySex.reduce((sum, item) => sum + Number(item.libido || 0), 0) /
        todaySex.length
      ).toFixed(1)
    : "—";

  const items = [
    { label: "Sleep", value: todaySleep.length ? "Logged" : "Not yet" },
    { label: "Exercise", value: todayExercise.length ? `${todayExercise.length} logged` : "Not yet" },
    { label: "Nutrition", value: todayNutrition.length ? `${todayNutrition.length} logged` : "Not yet" },
    { label: "Sex / libido", value: todaySex.length ? `${todaySex.length} logged` : "Not yet" },
    { label: "Journal", value: todayJournal.length ? "Updated" : "Not yet" }
  ];

  summaryCards.innerHTML = items
    .map(
      (item) => `
        <div class="summary-item">
          <span class="label">${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </div>
      `
    )
    .join("");

  document.getElementById("todayExerciseCount").textContent = String(todayExercise.length);
  document.getElementById("todayNutritionCount").textContent = String(todayNutrition.length);
  document.getElementById("todayJournalCount").textContent = String(todayJournal.length);
  document.getElementById("todayLibidoAvg").textContent = libidoAvg;
}

function renderHistory(module) {
  const container = document.getElementById(`${module}History`);
  const entries = getFilteredEntries(module);

  if (!entries.length) {
    container.innerHTML = `<div class="empty-state">No matching ${MODULES[module].label.toLowerCase()} entries yet.</div>`;
    return;
  }

  const grouped = groupByDate(entries);
  container.innerHTML = "";

  Object.keys(grouped)
    .sort((a, b) => b.localeCompare(a))
    .forEach((date) => {
      const groupEl = document.createElement("div");
      groupEl.className = "day-group";

      const heading = document.createElement("h3");
      heading.className = "day-heading";
      heading.textContent = formatDateDisplay(date);
      groupEl.appendChild(heading);

      grouped[date].forEach((entry) => {
        groupEl.appendChild(buildEntryCard(module, entry));
      });

      container.appendChild(groupEl);
    });
}

function getFilteredEntries(module) {
  let entries = [...state.data[module]];

  const { module: filterModule, date, text } = state.filters;

  if (filterModule !== "all" && filterModule !== module) {
    return [];
  }

  if (date) {
    entries = entries.filter((entry) => entry.date === date);
  }

  if (text) {
    entries = entries.filter((entry) => {
      return Object.values(entry).some((value) =>
        String(value || "").toLowerCase().includes(text)
      );
    });
  }

  return entries.sort(sortEntriesDesc);
}

function groupByDate(entries) {
  return entries.reduce((acc, entry) => {
    const date = entry.date || "Undated";
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {});
}

function buildEntryCard(module, entry) {
  const template = document.getElementById("historyCardTemplate");
  const node = template.content.firstElementChild.cloneNode(true);

  const meta = node.querySelector(".entry-meta");
  meta.innerHTML = `<div>${escapeHtml(primaryMeta(module, entry))}</div>`;

  const body = node.querySelector(".entry-body");
  const rows = entryRows(module, entry);

  body.innerHTML = rows
    .map(
      (row) => `
        <div class="entry-row">
          <span class="entry-key">${escapeHtml(row.key)}:</span>
          <span>${escapeHtml(row.value)}</span>
        </div>
      `
    )
    .join("");

  node.querySelector(".edit-btn").addEventListener("click", () => {
    fillForm(module, entry, true);
    state.activeTab = module;
    activateTab(module);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  node.querySelector(".delete-btn").addEventListener("click", () => {
    const confirmed = window.confirm(`Delete this ${MODULES[module].label.toLowerCase()} entry?`);
    if (!confirmed) return;

    state.data[module] = state.data[module].filter((item) => item.id !== entry.id);
    saveData();
    renderAll();
  });

  return node;
}

function primaryMeta(module, entry) {
  switch (module) {
    case "sleep":
      return `${entry.date} • ${entry.bedtime} → ${entry.wakeTime}`;
    case "exercise":
      return `${entry.date} • ${entry.time} • ${entry.type}`;
    case "nutrition":
      return `${entry.date} • ${entry.time} • ${entry.title}`;
    case "sex":
      return `${entry.date} • ${entry.time} • ${entry.activityType}`;
    case "journal":
      return `${entry.date} • ${entry.time}`;
    default:
      return entry.date || "";
  }
}

function entryRows(module, entry) {
  switch (module) {
    case "sleep":
      return compactRows([
        ["Estimated total sleep hours", entry.totalHours],
        ["Sleep quality", entry.quality],
        ["Dreams", entry.dreams],
        ["Notes", entry.notes]
      ]);

    case "exercise":
      return compactRows([
        ["Duration", entry.duration ? `${entry.duration} min` : ""],
        ["Intensity", entry.intensity],
        ["Regulation effect", entry.regulation],
        ["Notes", entry.notes]
      ]);

    case "nutrition":
      return compactRows([
        ["Meal type", entry.mealType],
        ["Notes", entry.notes],
        ["Hydration", entry.hydration],
        ["Cravings", entry.cravings]
      ]);

    case "sex":
      return compactRows([
        ["Libido", entry.libido],
        ["Emotional tone", entry.tone],
        ["Satisfaction", entry.satisfaction],
        ["Notes", entry.notes]
      ]);

    case "journal":
      return compactRows([
        ["Journal", entry.text]
      ]);

    default:
      return [];
  }
}

function compactRows(items) {
  return items
    .filter(([, value]) => String(value || "").trim() !== "")
    .map(([key, value]) => ({ key, value: String(value) }));
}

function formatDateDisplay(dateStr) {
  if (!dateStr || !dateStr.includes("-")) return dateStr;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(dt);
}

function activateTab(module) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === module);
  });

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${module}Tab`);
  });
}

function jumpToTodayView() {
  document.getElementById("filterDate").value = todayString();
  state.filters.date = todayString();
  renderAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function exportData() {
  const payload = {
    app: "Life Vitals",
    exportedAt: new Date().toISOString(),
    data: state.data
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `life-vitals-export-${todayString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const imported = parsed.data || parsed;

      const merged = {
        sleep: Array.isArray(imported.sleep) ? imported.sleep : [],
        exercise: Array.isArray(imported.exercise) ? imported.exercise : [],
        nutrition: Array.isArray(imported.nutrition) ? imported.nutrition : [],
        sex: Array.isArray(imported.sex) ? imported.sex : [],
        journal: Array.isArray(imported.journal) ? imported.journal : []
      };

      const confirmed = window.confirm(
        "Import data and replace current local Life Vitals data?"
      );
      if (!confirmed) return;

      state.data = merged;
      saveData();
      renderAll();
      alert("Import complete.");
    } catch (error) {
      console.error(error);
      alert("Import failed. Please use a valid Life Vitals JSON file.");
    } finally {
      event.target.value = "";
    }
  };

  reader.readAsText(file);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch((error) => {
        console.error("Service worker registration failed:", error);
      });
    });
  }
}