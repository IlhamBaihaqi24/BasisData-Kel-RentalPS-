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
      case "wHari": W.hari = +d.n; W.jam = ""; W.idUnit = W.idRuangan = ""; return tampil();
      case "wJam": W.jam = d.v; W.idUnit = W.idRuangan = ""; return tampil();
      case "riwayat": return await bukaRiwayat();
      case "tutupRiwayat": return tutupRiwayat();
      case "keluarCust": return await keluarCustomer();
      case "akunMode": AK.mode = AK.mode === "daftar" ? "masuk" : "daftar"; AK.galat = ""; return tampil();
      case "wDur": W.durasi = Math.min(12, Math.max(1, W.durasi + +d.d)); W.idUnit = W.idRuangan = ""; return tampil();
      case "wUnit": W.idUnit = d.id; return tampil();
      case "wRuang": W.idRuangan = d.id; return tampil();
      case "wMetode": W.metode = d.m; return tampil();
      case "copy": await navigator.clipboard.writeText(d.t); return toast("Nomor disalin");
      case "copyStruk": await navigator.clipboard.writeText(strukText(window._struk)); return toast("Struk disalin");
      case "admNav": AD.tab = d.tab; document.body.classList.remove("adm-open"); return tampil();
      case "admMenu": return document.body.classList.toggle("adm-open");
      case "logout": document.body.classList.remove("adm-open"); Auth.token = ""; try { await api("POST", "/auth/logout"); } catch (x) {} location.hash = "#/admin"; return tampil();
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
  if (e.target.dataset.act === "wBukti") WZ.bukti(e.target.files[0]);
});

document.addEventListener("submit", async (e) => {
  const f = e.target.closest("[data-form]");
  if (!f) return;
  e.preventDefault();
  try {
    if (f.dataset.form === "akun") return await kirimAkun(f);
    if (f.dataset.form === "login") {
      AD.galat = ""; AD.user = f.username.value.trim();
      try {
        const r = await api("POST", "/auth/login", { username: f.username.value.trim(), password: f.password.value });
        Auth.token = r.token;
        AD.nama = r.pegawai.nama;
      } catch (err) {
        if (err.offline) throw err;
        AD.galat = err.status === 401 ? "Password/nama salah" : err.message; // pesan jelas di bawah form
        return tampil();
      }
      return tampil();
    }
  } catch (err) {
    if (err.offline) $("#app").innerHTML = offlineView();
    else toast(err.message);
  }
});

document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeModal(); tutupRiwayat(); } });
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
