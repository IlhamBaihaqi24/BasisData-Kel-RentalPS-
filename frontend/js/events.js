"use strict";
/* Semua klik, ketikan, dan submit ditangani di sini (event delegation) */

document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-act]");
  if (!el || el.tagName === "SELECT") return;
  const d = el.dataset;
  try {
    switch (d.act) {
      case "retry": return tampil();
      case "closeModal": return closeModal();
      case "wNext": return await WZ.next();
      case "wBack": return await WZ.back();
      case "wBayar": return await WZ.bayar();
      case "wHari": W.hari = +d.n; W.jam = W.hari === 0 ? "now" : slotJam(W.hari)[0].v; return tampil();
      case "wDur": W.durasi = Math.min(12, Math.max(1, W.durasi + +d.d)); return tampil();
      case "wUnit": W.idUnit = d.id; return tampil();
      case "wRuang": W.idRuangan = d.id; return tampil();
      case "wMetode": W.metode = d.m; return tampil();
      case "copy": await navigator.clipboard.writeText(d.t); return toast("Nomor disalin");
      case "copyStruk": await navigator.clipboard.writeText(strukText(window._struk)); return toast("Struk disalin");
      case "logout": Auth.token = ""; try { await api("POST", "/auth/logout"); } catch (x) {} location.hash = "#/admin"; return tampil();
      case "detail": return await detailAdmin(d.id);
      case "setujui": return await aksiBayar(d.id, "setujui");
      case "tolak": return await aksiBayar(d.id, "tolak");
      case "filter": AD[d.k] = d.v; return tampil();
    }
  } catch (err) {
    if (err.offline) $("#app").innerHTML = offlineView();
    else toast(err.message);
  }
});

/* Isi form wizard / pencarian tanpa menggambar ulang halaman */
document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.w) W[t.dataset.w] = t.value;
  if (t.dataset.o) ORD[t.dataset.o] = t.value;
  if (t.dataset.in) {
    AD[t.dataset.in] = t.value;
    clearTimeout(events_t);
    events_t = setTimeout(async () => {
      try { await muatRiwayat(); $("#tbl").innerHTML = adminListHtml(); } catch (x) { toast(x.message); }
    }, 250);
  }
});
let events_t;

document.addEventListener("change", (e) => {
  if (e.target.dataset.act === "wJam") { W.jam = e.target.value; tampil(); }
  if (e.target.dataset.act === "wBukti") WZ.bukti(e.target.files[0]);
});

document.addEventListener("submit", async (e) => {
  const f = e.target.closest("[data-form]");
  if (!f) return;
  e.preventDefault();
  try {
    if (f.dataset.form === "cari") {
      if (ORD.hp.replace(/\D/g, "").length < 9) return toast("Isi no. HP yang benar");
      Simpan.set("tt-hp", ORD.hp);
      ORD.list = null;
      return tampil();
    }
    if (f.dataset.form === "login") {
      const r = await api("POST", "/auth/login", { username: f.username.value, pin: f.pin.value });
      Auth.token = r.token;
      return tampil();
    }
  } catch (err) {
    if (err.offline) $("#app").innerHTML = offlineView();
    else toast(err.message);
  }
});

document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
