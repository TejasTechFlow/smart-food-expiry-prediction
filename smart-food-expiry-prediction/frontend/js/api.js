// ---- API layer (no UI code here except helpers below) ----
const API_BASE = "http://localhost:8000/api";
const START_CMD = "python -m uvicorn app.main:app --app-dir backend --reload --port 8000";
class ApiError extends Error { constructor(m, status = 0, fields = {}) { super(m); this.status = status; this.fields = fields; } }

async function api(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(API_BASE + path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  } catch { throw new ApiError(`Cannot reach the backend. Start it from the project root with: ${START_CMD}`); }
  if (res.status === 204) return null;
  let data;
  try { data = await res.json(); } catch { throw new ApiError("The server sent a response that could not be read.", res.status); }
  if (!res.ok) {
    const fields = {}; let msg = `Request failed (${res.status})`;
    if (Array.isArray(data.detail)) {
      data.detail.forEach(e => { fields[e.loc[e.loc.length - 1]] = e.msg.replace("Value error, ", ""); });
      msg = "Please fix the highlighted fields.";
    } else if (data.detail) msg = data.detail;
    throw new ApiError(msg, res.status, fields);
  }
  return data;
}
const qs = o => { const p = new URLSearchParams(); Object.entries(o).forEach(([k, v]) => v && p.append(k, v)); const s = p.toString(); return s ? "?" + s : ""; };
const Api = {
  categories: () => api("/categories"), predict: d => api("/predict", { method: "POST", body: d }),
  stats: () => api("/stats"), metrics: () => api("/model/metrics"),
  foods: f => api("/foods" + qs(f || {})), saveFood: d => api("/foods", { method: "POST", body: d }),
  updateFood: (id, d) => api("/foods/" + id, { method: "PUT", body: d }), deleteFood: id => api("/foods/" + id, { method: "DELETE" }),
  history: f => api("/history" + qs(f || {})), deleteHistory: id => api("/history/" + id, { method: "DELETE" }),
};

// ---- UI helpers ----
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const STATUS_CLS = { "Fresh": "Fresh", "Use Soon": "Use", "Near Estimated Expiry": "Near", "Estimated Shelf Life Exceeded": "Estimated" };
const badge = s => `<span class="status-badge badge-${STATUS_CLS[s]}">${esc(s)}</span>`;
const CAT_ICON = { "Fruits": "apple-whole", "Vegetables": "carrot", "Dairy Products": "cheese", "Meat": "drumstick-bite", "Fish and Seafood": "fish", "Bakery Products": "bread-slice", "Cooked Food": "bowl-food", "Other": "utensils" };
const catIcon = c => `<i class="fa-solid fa-${CAT_ICON[c] || "utensils"} text-success me-1"></i>`;
const spin = (on) => document.getElementById("spinner")?.classList.toggle("d-none", !on);
function toast(msg, type = "success") {
  let box = document.getElementById("toasts");
  if (!box) { box = document.createElement("div"); box.id = "toasts"; document.body.appendChild(box); }
  const el = document.createElement("div"); el.className = `alert alert-${type} shadow fade-in`; el.textContent = msg; box.appendChild(el);
  setTimeout(() => el.remove(), type === "danger" ? 8000 : 3500);
}
function renderSidebar(active) {
  const links = [["index", "house", "Home"], ["dashboard", "chart-pie", "Dashboard"], ["predict", "wand-magic-sparkles", "Predict Expiry"],
    ["inventory", "boxes-stacked", "Food Inventory"], ["history", "clock-rotate-left", "History"], ["about", "circle-info", "About"]];
  document.getElementById("sidebar").innerHTML = `<a class="brand" href="index.html"><i class="fa-solid fa-leaf me-2"></i>Smart Food Expiry</a><nav class="nav flex-column">` +
    links.map(([p, i, t]) => `<a class="nav-link ${p === active ? "active" : ""}" href="${p}.html"><i class="fa-solid fa-${i}"></i>${t}</a>`).join("") + `</nav>`;
  document.getElementById("menuBtn")?.addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
}
// ---- Shared food form (used by Predict page and Inventory modal) ----
const FIELDS = [["food_name", "Food Name", "text", "e.g. Fresh milk"], ["category", "Food Category", "select", "categories"],
  ["purchase_date", "Purchase Date", "date", "Date you bought the food"], ["storage_type", "Storage Type", "select", "storage_types"],
  ["temperature", "Storage Temperature (°C)", "number", "-40 to 60. Freezer must be 0 or below."],
  ["humidity", "Relative Humidity (%)", "number", "0 to 100"], ["packaging_type", "Packaging Type", "select", "packaging_types"],
  ["freshness_condition", "Freshness Condition", "select", "freshness_conditions"],
  ["storage_duration_days", "Storage Duration (days)", "number", "Days the food has already been stored (0 to 365)"]];
function buildForm(el, p, opts) {
  el.innerHTML = `<div class="row g-3">` + FIELDS.map(([k, label, type, hint]) => {
    const id = `${p}_${k}`; let input;
    if (type === "select") input = `<select class="form-select" id="${id}" required><option value="">Choose...</option>${opts[hint].map(o => `<option>${esc(o)}</option>`).join("")}</select>`;
    else { const ex = k === "temperature" ? 'min="-40" max="60" step="0.1"' : k === "humidity" ? 'min="0" max="100" step="0.1"' : k === "storage_duration_days" ? 'min="0" max="365" step="1"' : k === "purchase_date" ? `max="${new Date().toISOString().slice(0, 10)}"` : 'maxlength="100"';
      input = `<input class="form-control" id="${id}" type="${type}" ${ex} required>`; }
    return `<div class="col-md-6"><label class="form-label fw-semibold" for="${id}">${label}</label>${input}<div class="invalid-feedback" id="${id}_err"></div>${type === "select" ? "" : `<div class="form-text">${hint.startsWith("e.g") || type === "date" || hint.includes("-") || hint.includes("0 to") ? hint : ""}</div>`}</div>`;
  }).join("") + `</div>`;
}
function readForm(p) {
  const v = k => document.getElementById(`${p}_${k}`).value;
  return { food_name: v("food_name").trim(), category: v("category"), purchase_date: v("purchase_date"), storage_type: v("storage_type"),
    temperature: parseFloat(v("temperature")), humidity: parseFloat(v("humidity")), packaging_type: v("packaging_type"),
    freshness_condition: v("freshness_condition"), storage_duration_days: parseInt(v("storage_duration_days"), 10) };
}
function fillForm(p, d) { FIELDS.forEach(([k]) => { document.getElementById(`${p}_${k}`).value = d[k] ?? ""; }); clearErrors(p); }
function clearErrors(p) { FIELDS.forEach(([k]) => { document.getElementById(`${p}_${k}`)?.classList.remove("is-invalid"); }); }
function showFieldErrors(p, fields) {
  clearErrors(p);
  Object.entries(fields).forEach(([k, m]) => { const i = document.getElementById(`${p}_${k}`); if (i) { i.classList.add("is-invalid"); document.getElementById(`${p}_${k}_err`).textContent = m; } });
}
function validateClient(p) {  // browser validation + friendly messages
  clearErrors(p); const f = {};
  FIELDS.forEach(([k]) => { const i = document.getElementById(`${p}_${k}`); if (!i.checkValidity()) f[k] = i.validationMessage || "Invalid value"; });
  showFieldErrors(p, f); return Object.keys(f).length === 0;
}
