renderSidebar("dashboard");
const COLORS = { "Fresh": "#2E7D32", "Use Soon": "#F9A825", "Near Estimated Expiry": "#EF6C00", "Estimated Shelf Life Exceeded": "#D84343" };
const charts = [];
async function load() {
  spin(true);
  try {
    const s = await Api.stats();
    document.getElementById("err").innerHTML = "";
    const card = (i, t, v) => `<div class="col-sm-6 col-xl-3"><div class="card stat p-3 d-flex flex-row align-items-center gap-3"><i class="fa-solid fa-${i}"></i><div><div class="text-muted small">${t}</div><div class="fs-4 fw-bold">${v}</div></div></div></div>`;
    document.getElementById("cards").innerHTML = card("basket-shopping", "Total Food Items", s.total) + card("hourglass-half", "Items Expiring Soon", s.expiring_soon) +
      card("triangle-exclamation", "Items Marked as Expired", s.expired) + card("calendar-days", "Avg Predicted Shelf Life", s.avg_shelf_life == null ? "—" : s.avg_shelf_life + " days");
    const has = s.total > 0;
    document.getElementById("empty").classList.toggle("d-none", has); document.getElementById("charts").classList.toggle("d-none", !has);
    charts.forEach(c => c.destroy()); charts.length = 0;
    if (has) {
      const sl = Object.keys(s.status_counts), cl = Object.keys(s.category_counts);
      charts.push(new Chart("c1", { type: "doughnut", data: { labels: sl, datasets: [{ data: sl.map(k => s.status_counts[k]), backgroundColor: sl.map(k => COLORS[k]) }] } }));
      charts.push(new Chart("c2", { type: "bar", data: { labels: cl, datasets: [{ label: "Items", data: cl.map(k => s.category_counts[k]), backgroundColor: "#2E7D32" }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } }));
      charts.push(new Chart("c3", { type: "line", data: { labels: s.trend.map(t => t.date), datasets: [{ label: "Avg remaining days", data: s.trend.map(t => t.avg_remaining), borderColor: "#2E7D32", tension: .3 }] } }));
    }
    document.getElementById("recent").innerHTML = s.recent.length ? s.recent.map(r => `<tr><td>${esc(r.food_name)}</td><td>${catIcon(r.category)}${esc(r.category)}</td><td>${esc(r.prediction_date.replace("T", " "))}</td><td>${r.estimated_remaining_days} d</td><td>${esc(r.predicted_expiry_date)}</td><td>${badge(r.status)}</td><td><button class="btn btn-sm btn-outline-success" data-id="${r.id}">View details</button></td></tr>`).join("") : `<tr><td colspan="7" class="text-center text-muted">No predictions yet.</td></tr>`;
    window._recent = s.recent;
  } catch (e) { document.getElementById("err").innerHTML = `<div class="alert alert-danger">${esc(e.message)}</div>`; }
  spin(false);
}
document.addEventListener("click", e => {
  const b = e.target.closest("button[data-id]"); if (!b) return;
  const r = window._recent.find(x => x.id == b.dataset.id);
  document.getElementById("dmt").textContent = r.food_name;
  document.getElementById("dmb").innerHTML = `<p>${badge(r.status)}</p><p>Remaining: <b>${r.estimated_remaining_days} days</b><br>Expiry: <b>${esc(r.predicted_expiry_date)}</b><br>Category: ${esc(r.category)}</p><a href="history.html">Open full history</a>`;
  new bootstrap.Modal("#dm").show();
});
load();
