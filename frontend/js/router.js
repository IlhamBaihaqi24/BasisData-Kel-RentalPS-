"use strict";
/* Router sederhana berbasis hash: #/  #/pesan  #/pesanan  #/struk/ID  #/admin */

let _seq = 0;
async function tampil() {
  const my = ++_seq;
  const app = $("#app");
  const [, a, b] = location.hash.replace(/\?.*$/, "").split("/");
  const baru = /[?&]baru=1/.test(location.hash);
  let html;
  try {
    if (a === "pesan") html = await wizardView();
    else if (a === "pesanan") { ORD.list = null; ORD.hp = ORD.hp || Simpan.get("tt-hp"); html = await ordersView(); }
    else if (a === "struk" && b) html = await strukView(b, baru);
    else if (a === "admin") html = Auth.token ? await adminView() : adminLoginView();
    else html = await homeView();
  } catch (e) {
    if (!e.offline) toast(e.message);
    html = e.offline ? offlineView() : empty("Terjadi masalah: " + esc(e.message));
  }
  if (my !== _seq) return; // ada navigasi yang lebih baru
  app.innerHTML = html;
  document.body.dataset.page = a || "home";
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", tampil);
