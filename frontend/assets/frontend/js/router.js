"use strict";
/* Router sederhana berbasis hash: #/  #/masuk  #/pesan  #/struk/ID  #/admin
   Pesan dan struk butuh akun customer; Riwayat dibuka sebagai sidebar (tombol Riwayat). */

let _seq = 0;
async function tampil() {
  const my = ++_seq;
  if (typeof tutupRiwayat === "function" && ($("#side") && !$("#side").hidden)) tutupRiwayat(); // pindah halaman = sidebar tertutup
  const app = $("#app");
  const [, a, b] = location.hash.replace(/\?.*$/, "").split("/");
  const baru = /[?&]baru=1/.test(location.hash);
  let html;
  try {
    if (a !== "admin") await muatProfil();
    if ((a === "pesan" || a === "struk") && !Cust.profil) { AK.next = location.hash; location.hash = "#/masuk"; return; } // wajib login dulu
    if (a === "pesan") html = await wizardView();
    else if (a === "masuk" || a === "daftar") html = Cust.profil ? await homeView() : akunView();
    else if (a === "struk" && b) html = await strukView(b, baru);
    else if (a === "admin") html = Auth.token ? await adminView() : adminLoginView();
    else html = await homeView();
  } catch (e) {
    if (e.status === 401 && a !== "admin") { AK.next = location.hash; location.hash = "#/masuk"; return; }
    if (!e.offline) toast(e.message);
    html = e.offline ? offlineView() : empty("Terjadi masalah: " + esc(e.message));
  }
  if (my !== _seq) return; // ada navigasi yang lebih baru
  app.innerHTML = html;
  document.body.dataset.page = a || "home";
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", tampil);
