renderSidebar("predict");
const today = new Date(), iso = d => d.toISOString().slice(0, 10);
const EXAMPLE = { food_name: "Fresh Milk", category: "Dairy Products", purchase_date: iso(new Date(today - 2 * 864e5)), storage_type: "Refrigerator", temperature: 4, humidity: 60, packaging_type: "Original Packaging", freshness_condition: "Good", storage_duration_days: 2 };
let last = null, lastInput = null, saved = false;
const ICON = { "Fresh": ["circle-check", "#2E7D32"], "Use Soon": ["clock", "#F9A825"], "Near Estimated Expiry": ["triangle-exclamation", "#EF6C00"], "Estimated Shelf Life Exceeded": ["circle-xmark", "#D84343"] };
(async () => {
  try { buildForm(document.getElementById("form"), "f", await Api.categories()); }
  catch (e) { document.getElementById("alert").innerHTML = `<div class="alert alert-danger">${esc(e.message)}</div>`; }
})();
document.getElementById("example").onclick = () => fillForm("f", EXAMPLE);
document.getElementById("reset").onclick = () => { document.getElementById("form").reset(); clearErrors("f"); };
document.getElementById("form").addEventListener("submit", e => e.preventDefault());
document.getElementById("go").onclick = async () => {
  document.getElementById("alert").innerHTML = "";
  if (!validateClient("f")) return;
  lastInput = readForm("f"); spin(true);
  try { last = await Api.predict(lastInput); saved = false; show(last); }
  catch (e) { showFieldErrors("f", e.fields); document.getElementById("alert").innerHTML = `<div class="alert alert-${e.status === 0 || e.status >= 500 ? "danger" : "warning"}">${esc(e.message)}</div>`; }
  spin(false);
};
function show(r) {
  const [ic, col] = ICON[r.status], pct = r.total_shelf_life_days ? Math.max(0, Math.min(100, r.estimated_remaining_days / r.total_shelf_life_days * 100)) : 0;
  document.getElementById("result").innerHTML = `<div class="card p-4 fade-in"><div class="text-center"><i class="fa-solid fa-${ic} result-icon" style="color:${col}"></i><h3 class="mt-2">${esc(r.food_name)}</h3>${badge(r.status)}</div>
  <div class="row text-center my-3"><div class="col"><div class="display-6 fw-bold">${r.estimated_remaining_days}</div><small class="text-muted">days remaining</small></div><div class="col"><div class="fs-4 fw-bold mt-2">${esc(r.predicted_expiry_date)}</div><small class="text-muted">estimated expiry</small></div></div>
  <div class="progress mb-1" style="height:14px"><div class="progress-bar" style="width:${pct}%;background:${col}"></div></div><small class="text-muted">${pct.toFixed(0)}% of the ${r.total_shelf_life_days}-day estimated total shelf life remains</small>
  <hr><p class="mb-1"><b>Storage:</b> ${esc(r.storage_summary)}</p><p class="mb-1"><b>Predicted at:</b> ${esc(r.prediction_timestamp)}</p><p class="mb-1"><b>Model:</b> Random Forest Regressor, ${esc(r.model_version)} (trained on synthetic data)</p>
  <p class="small text-muted mb-2"><b>Categories:</b> Fresh &gt;7 days left · Use Soon 3–7 · Near Estimated Expiry 1–2 · Estimated Shelf Life Exceeded 0 or less.</p><p class="small text-muted">${esc(r.disclaimer)}</p>
  <div class="d-flex gap-2 flex-wrap"><button class="btn btn-success" id="save">Save to Inventory</button><a class="btn btn-outline-success" href="history.html">View Prediction History</a><button class="btn btn-outline-secondary" id="again">Predict Another Food</button><button class="btn btn-outline-secondary" id="dl"><i class="fa-solid fa-download"></i> Download Report</button></div></div>`;
  document.getElementById("again").onclick = () => { document.getElementById("reset").click(); window.scrollTo(0, 0); };
  document.getElementById("save").onclick = async e => {
    if (saved) return toast("Already saved to inventory", "warning");
    try { await Api.saveFood({ ...lastInput, prediction_id: last.prediction_id }); saved = true; e.target.disabled = true; toast("Saved to inventory"); }
    catch (er) { toast(er.message, "danger"); }
  };
  document.getElementById("dl").onclick = () => {
    const t = `SMART FOOD EXPIRY PREDICTION REPORT\n\nFood: ${r.food_name}\nCategory: ${r.category}\nStorage: ${r.storage_summary}\nEstimated total shelf life: ${r.total_shelf_life_days} days\nEstimated remaining: ${r.estimated_remaining_days} days\nEstimated expiry: ${r.predicted_expiry_date}\nStatus: ${r.status}\nPredicted at: ${r.prediction_timestamp}\nModel: ${r.model_version}\n\n${r.disclaimer}\n`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([t], { type: "text/plain" })); a.download = `prediction-${r.prediction_id}.txt`; a.click();
  };
}
