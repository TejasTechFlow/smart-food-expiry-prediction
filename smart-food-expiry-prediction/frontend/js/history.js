renderSidebar("history");
let rows = [];
async function load() {
  try {
    rows = await Api.history({ search: q.value, category: fc.value, date_from: df.value, date_to: dt.value, sort: so.value });
    document.getElementById("rows").innerHTML = rows.length ? rows.map(h => { const f = h.input_features;
      return `<tr><td>${esc(h.food_name)}</td><td>${catIcon(h.category)}${esc(h.category)}</td><td class="small">${esc(f.storage_type)}, ${f.temperature} °C, ${f.humidity}% RH, ${esc(f.packaging_type)}</td><td>${h.estimated_remaining_days} d</td><td>${esc(h.predicted_expiry_date)}</td><td>${esc(h.prediction_date.replace("T", " "))}</td><td>${badge(h.status)}</td>
      <td class="text-nowrap"><button class="btn btn-sm btn-outline-success" data-view="${h.id}">Details</button> <button class="btn btn-sm btn-outline-danger" data-del="${h.id}"><i class="fa-solid fa-trash"></i></button></td></tr>`; }).join("")
      : `<tr><td colspan="8" class="text-center text-muted py-4">No predictions found.</td></tr>`;
  } catch (e) { document.getElementById("rows").innerHTML = `<tr><td colspan="8"><div class="alert alert-danger mb-0">${esc(e.message)}</div></td></tr>`; }
}
(async () => { try { (await Api.categories()).categories.forEach(c => fc.insertAdjacentHTML("beforeend", `<option>${esc(c)}</option>`)); } catch {} load(); })();
[q, fc, df, dt, so].forEach(el => el.addEventListener("input", load));
document.addEventListener("click", async e => {
  const v = e.target.closest("[data-view]"), d = e.target.closest("[data-del]");
  if (v) { const h = rows.find(x => x.id == v.dataset.view), f = h.input_features;
    document.getElementById("dmt").textContent = h.food_name;
    document.getElementById("dmb").innerHTML = `<p>${badge(h.status)}</p><dl class="row mb-0">` + Object.entries({ "Remaining (days)": h.estimated_remaining_days, "Expiry date": h.predicted_expiry_date, "Predicted on": h.prediction_date, "Model": h.model_version, "Purchase date": f.purchase_date, "Storage": f.storage_type, "Temperature (°C)": f.temperature, "Humidity (%)": f.humidity, "Packaging": f.packaging_type, "Freshness": f.freshness_condition, "Days stored": f.storage_duration_days, "In inventory": h.food_item_id ? "Yes" : "No" }).map(([k, x]) => `<dt class="col-6">${k}</dt><dd class="col-6">${esc(x)}</dd>`).join("") + `</dl>`;
    new bootstrap.Modal("#dm").show(); }
  if (d && confirm("Delete this prediction record?")) { try { await Api.deleteHistory(d.dataset.del); toast("Record deleted"); load(); } catch (er) { toast(er.message, "danger"); } }
});
document.getElementById("csv").onclick = () => {
  if (!rows.length) return toast("Nothing to export", "warning");
  const cols = ["id", "food_name", "category", "storage_type", "temperature", "humidity", "packaging_type", "freshness_condition", "storage_duration_days", "estimated_remaining_days", "predicted_expiry_date", "prediction_date", "status", "model_version"];
  const cell = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(",")].concat(rows.map(h => cols.map(c => cell(h[c] ?? h.input_features[c])).join(","))).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "prediction_history.csv"; a.click();
};
