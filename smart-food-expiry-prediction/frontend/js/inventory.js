renderSidebar("inventory");
let editId = null, modal;
const ids = { q: "q", category: "fc", status: "fs", sort: "so" };
async function load() {
  const f = { search: q.value, category: fc.value, status: fs.value, sort: so.value };
  try {
    const items = await Api.foods(f);
    document.getElementById("list").innerHTML = items.length ? items.map(i => {
      const cls = i.status === "Estimated Shelf Life Exceeded" ? "item-bad" : (i.status === "Use Soon" || i.status === "Near Estimated Expiry") ? "item-warn" : "";
      return `<div class="col-md-6 col-xl-4"><div class="card p-3 h-100 ${cls}"><div class="d-flex justify-content-between"><h5>${catIcon(i.category)}${esc(i.food_name)}</h5>${badge(i.status)}</div>
      <div class="text-muted small">${esc(i.category)} · ${esc(i.storage_type)}</div><div class="my-2">Expires <b>${esc(i.predicted_expiry_date)}</b> (${i.days_until_expiry} days from today)</div>
      <div class="mt-auto"><button class="btn btn-sm btn-outline-success me-1" data-edit="${i.id}"><i class="fa-solid fa-pen"></i> Edit</button><button class="btn btn-sm btn-outline-danger" data-del="${i.id}" data-name="${esc(i.food_name)}"><i class="fa-solid fa-trash"></i> Delete</button></div></div></div>`;
    }).join("") : `<div class="card p-5 text-center text-muted">No food items found. Use "Add Food Item" or save a prediction.</div>`;
    window._items = items;
  } catch (e) { document.getElementById("list").innerHTML = `<div class="alert alert-danger">${esc(e.message)}</div>`; }
}
(async () => {
  try {
    const o = await Api.categories(); buildForm(document.getElementById("fmform"), "m", o);
    o.categories.forEach(c => fc.insertAdjacentHTML("beforeend", `<option>${esc(c)}</option>`));
  } catch (e) { toast(e.message, "danger"); }
  modal = new bootstrap.Modal("#fm"); load();
})();
[q, fc, fs, so].forEach(el => el.addEventListener("input", load));
document.getElementById("add").onclick = () => { editId = null; document.getElementById("fmt").textContent = "Add Food Item"; document.getElementById("fmform").querySelectorAll("input,select").forEach(i => i.value = ""); clearErrors("m"); modal.show(); };
document.getElementById("fsave").onclick = async () => {
  if (!validateClient("m")) return; spin(true);
  try {
    const d = readForm("m"); editId ? await Api.updateFood(editId, d) : await Api.saveFood(d);
    modal.hide(); toast(editId ? "Item updated" : "Item added"); load();
  } catch (e) { showFieldErrors("m", e.fields); toast(e.message, e.status === 422 ? "warning" : "danger"); }
  spin(false);
};
document.addEventListener("click", async e => {
  const ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
  if (ed) { editId = +ed.dataset.edit; fillForm("m", window._items.find(i => i.id === editId)); document.getElementById("fmt").textContent = "Edit Food Item"; modal.show(); }
  if (del && confirm(`Delete "${del.dataset.name}" from the inventory?`)) {
    try { await Api.deleteFood(del.dataset.del); toast("Item deleted"); load(); } catch (er) { toast(er.message, "danger"); }
  }
});
