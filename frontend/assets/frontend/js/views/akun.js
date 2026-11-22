"use strict";
/* Customer: masuk / daftar akun, bilah akun, dan SIDEBAR Riwayat pemesanan */

const AK = { mode: "masuk", galat: "", busy: false, next: "#/pesan" };

/* Tombol kecil di pojok header: nama + Riwayat (bila sudah masuk) atau Masuk */
function custBar() {
  const p = Cust.profil;
  return p
    ? '<span class="cbar"><button class="btn btn-soft btn-sm" data-act="riwayat">' + ic("clock") + 'Riwayat</button><button class="chip-user" data-act="riwayat" title="' + esc(p.nama) + '">' + esc(p.nama.split(" ")[0]) + "</button></span>"
    : '<a class="btn btn-soft btn-sm" href="#/masuk">Masuk</a>';
}

function akunView() {
  const daftar = AK.mode === "daftar";
  return (
    '<main class="wrap narrow login">' + pageHead(daftar ? "Daftar customer" : "Masuk customer") +
    '<form class="card form" data-form="akun" novalidate><div class="center">' + logo(64) + "</div>" +
    "<h2>" + (daftar ? "Buat akun" : "Masuk dulu ya") + '</h2><p class="muted small">' +
    (daftar ? "Cukup sekali. Akun dipakai untuk memesan dan melihat riwayat pesananmu." : "Masuk dengan no. HP dan password untuk memesan dan melihat riwayat.") + "</p>" +
    (daftar ? '<label class="field">Nama lengkap<input name="nama" placeholder="contoh: Rizky Pratama" autocomplete="name"></label>' : "") +
    '<label class="field">No. HP / WhatsApp<input name="hp" inputmode="tel" placeholder="0812-3456-7890" autocomplete="tel"></label>' +
    '<label class="field">Password' + (daftar ? " (minimal 6 karakter)" : "") + '<input name="password" type="password" autocomplete="' + (daftar ? "new-password" : "current-password") + '"></label>' +
    '<p class="galat" id="galat" role="alert"' + (AK.galat ? "" : " hidden") + ">" + esc(AK.galat) + "</p>" +
    '<button class="btn btn-primary btn-block" type="submit">' + (daftar ? "Daftar &amp; masuk" : "Masuk") + "</button>" +
    '<p class="small muted center">' + (daftar ? "Sudah punya akun? " : "Belum punya akun? ") + '<button type="button" class="link" data-act="akunMode">' + (daftar ? "Masuk" : "Daftar") + "</button></p>" +
    (daftar ? "" : '<p class="small muted center">Akun contoh: 0812-3456-7890 / 123456</p>') + "</form></main>"
  );
}

async function kirimAkun(f) {
  const daftar = AK.mode === "daftar";
  const b = { hp: f.hp.value.trim(), password: f.password.value };
  if (daftar) b.nama = f.nama.value.trim();
  if (daftar && !b.nama) return tampilGalat("Nama wajib diisi");
  if (b.hp.replace(/\D/g, "").length < 9) return tampilGalat("No. HP belum benar");
  if (!b.password) return tampilGalat("Password wajib diisi");
  if (daftar && b.password.length < 6) return tampilGalat("Password minimal 6 karakter");
  try {
    const r = await api("POST", daftar ? "/publik/daftar" : "/publik/masuk", b);
    Cust.token = r.token;
    Cust.profil = r.pelanggan;
    AK.galat = "";
    toast("Halo, " + r.pelanggan.nama.split(" ")[0] + "!");
    const n = AK.next && AK.next !== "#/masuk" && AK.next !== "#/daftar" ? AK.next : "#/";
    if (location.hash === n) tampil(); // alamat sama: tidak ada hashchange, gambar ulang manual
    else location.hash = n;
  } catch (e) {
    if (e.offline) throw e;
    tampilGalat(e.message);
  }
}
function tampilGalat(m) {
  AK.galat = m;
  const g = $("#galat");
  if (g) { g.textContent = m; g.hidden = false; }
}

async function keluarCustomer() {
  try { await api("POST", "/publik/keluar", {}); } catch (e) {}
  Cust.token = "";
  Cust.profil = null;
  W = W0();
  tutupRiwayat();
  location.hash = "#/";
  tampil();
}

/* ---- Sidebar riwayat pemesanan ---- */
const ordCard = (s) =>
  '<a class="row ord" href="#/struk/' + s.id + '" data-act="tutupRiwayat"><div class="grow"><div class="ttl">' + esc(s.ruangan.nama) + " · " + s.unit.jenis + " " + pad(s.unit.nomor) + "</div>" +
  '<div class="small muted">' + dayName(s.mulai) + ", " + dmy(s.mulai) + " · " + hm(s.mulai) + "–" + hm(s.selesai) + "</div>" +
  '<div class="small muted">' + s.id + " · " + rp(s.total) + "</div></div>" + badgeStatus(s.status) + "</a>";

async function bukaRiwayat() {
  if (!Cust.token) { AK.next = "#/"; location.hash = "#/masuk"; return toast("Masuk dulu untuk melihat riwayat"); }
  const side = $("#side"), isi = side.querySelector(".side-body");
  side.hidden = false;
  document.body.classList.add("side-open");
  isi.innerHTML = '<div class="empty">Memuat riwayat…</div>';
  try {
    const list = await api("GET", "/publik/pesanan");
    const p = Cust.profil || { nama: "", hp: "" };
    isi.innerHTML =
      '<div class="side-user"><b>' + esc(p.nama) + '</b><span class="small muted">' + esc(p.hp) + "</span></div>" +
      '<div class="side-sum small muted">' + list.length + " pesanan</div>" +
      '<div class="list">' + (list.length ? list.map(ordCard).join("") : empty("Belum ada pesanan. Yuk pesan PS pertamamu!")) + "</div>";
  } catch (e) {
    isi.innerHTML = e.offline ? offlineView() : empty(esc(e.message));
  }
}
function tutupRiwayat() {
  $("#side").hidden = true;
  document.body.classList.remove("side-open");
}
