"use strict";
/* Admin: masuk, memverifikasi bukti bayar Transfer/QRIS, dan melihat riwayat */

const AD = { q: "", status: "", metode: "", tanggal: "", list: [], pending: [], ring: null };

function adminLoginView() {
  return (
    '<main class="wrap narrow login">' + pageHead("Admin") +
    '<form class="card form" data-form="login"><div class="center">' + logo(64) + "</div><h2>Masuk admin</h2><p class=\"muted small\">Admin memverifikasi pembayaran dan melihat riwayat pesanan.</p>" +
    '<label class="field">ID pegawai<input name="username" value="admin" autocomplete="username"></label>' +
    '<label class="field">PIN<input name="pin" type="password" value="123456" inputmode="numeric" autocomplete="current-password"></label>' +
    '<button class="btn btn-primary btn-block" type="submit">Masuk</button>' +
    '<p class="small muted center">Akun contoh: admin / 123456</p></form></main>'
  );
}

const rowAdmin = (s) =>
  '<button class="trow" data-act="detail" data-id="' + s.id + '">' +
  '<span class="c-id"><b>' + s.id + '</b><span class="tiny muted">' + dmy(s.mulai) + "</span></span>" +
  '<span class="c-nm"><b>' + esc(s.pelanggan.nama) + '</b><span class="tiny muted">' + esc(s.pelanggan.hp) + "</span></span>" +
  '<span class="c-ps">' + s.unit.jenis + " · " + pad(s.unit.nomor) + '<span class="tiny muted">' + esc(s.ruangan.nama) + "</span></span>" +
  '<span class="c-jm">' + hm(s.mulai) + "–" + hm(s.selesai) + '<span class="tiny muted">' + s.durasi + " jam</span></span>" +
  '<span class="c-by">' + s.pembayaran.metode + '<span class="tiny muted">' + (s.pembayaran.status === "Lunas" ? "Lunas" : "Menunggu") + "</span></span>" +
  '<span class="c-tt num"><b>' + rp(s.total) + "</b></span>" + '<span class="c-st">' + badgeStatus(s.status) + "</span></button>";

function adminListHtml() {
  return AD.list.length
    ? '<div class="thead"><span>ID / Tanggal</span><span>Customer</span><span>PS / Ruangan</span><span>Jam</span><span>Bayar</span><span>Total</span><span>Status</span></div>' + AD.list.map(rowAdmin).join("")
    : empty("Tidak ada data yang cocok.");
}
async function muatRiwayat() {
  const p = new URLSearchParams();
  for (const k of ["q", "status", "metode", "tanggal"]) if (AD[k]) p.set(k, AD[k]);
  AD.list = await api("GET", "/admin/riwayat?" + p);
}

/* Panel pembayaran Transfer/QRIS yang menunggu disetujui admin (belum jadi booking) */
const verifCard = (s) =>
  '<button class="vcard" data-act="detail" data-id="' + s.id + '"><span class="grow"><b>' + esc(s.pelanggan.nama) + '</b><span class="small muted">' +
  s.id + " · " + s.unit.jenis + " " + pad(s.unit.nomor) + " · " + esc(s.ruangan.nama) + "</span>" +
  '<span class="small muted">' + dmy(s.mulai) + ", " + hm(s.mulai) + "–" + hm(s.selesai) + "</span></span>" +
  '<span class="vr"><b class="num">' + rp(s.total) + '</b><span class="badge b-soft">' + s.pembayaran.metode + '</span></span><span class="btn btn-primary btn-sm">Periksa bukti</span></button>';
const verifHtml = () =>
  AD.pending.length
    ? '<h2>Menunggu verifikasi <span class="badge b-warn">' + AD.pending.length + '</span></h2><p class="muted small">Cek bukti bayar, lalu setujui agar pesanan jadi booking dan berstatus lunas.</p><div class="vlist">' + AD.pending.map(verifCard).join("") + "</div>"
    : "";

async function adminView() {
  try {
    [AD.ring, AD.pending] = await Promise.all([api("GET", "/admin/ringkasan"), api("GET", "/admin/verifikasi"), muatRiwayat()]);
  } catch (e) {
    if (e.status === 401) { Auth.token = ""; location.hash = "#/admin"; }
    throw e;
  }
  const r = AD.ring;
  const chip = (k, v, t) => '<button class="chip ' + (AD[k] === v ? "on" : "") + '" data-act="filter" data-k="' + k + '" data-v="' + v + '">' + t + "</button>";
  return (
    '<main class="wrap wide"><header class="ahead">' + brand(34) + '<span class="grow"></span><span class="badge b-soft">Admin</span>' +
    '<button class="btn btn-soft btn-sm" data-act="logout">' + ic("logout") + "Keluar</button></header>" +
    "<h1>Riwayat pesanan</h1><p class=\"muted\">Pesanan yang sudah resmi jadi booking (Tunai, atau Transfer/QRIS yang sudah disetujui).</p>" +
    '<section class="verif" id="verif">' + verifHtml() + "</section>" +
    '<div class="stats">' +
    '<div class="stat c1"><span class="small">Total pesanan</span><b>' + r.totalPesanan + "</b></div>" +
    '<div class="stat c2"><span class="small">Sedang berlangsung</span><b>' + r.berlangsung + "</b></div>" +
    '<div class="stat c3"><span class="small">Akan datang</span><b>' + r.akanDatang + "</b></div>" +
    '<div class="stat c4"><span class="small">Pendapatan hari ini</span><b>' + rp(r.pendapatanHariIni) + "</b></div></div>" +
    '<div class="filters"><div class="search">' + ic("search") + '<input data-in="q" value="' + esc(AD.q) + '" placeholder="Cari nama, no. HP, ID, ruangan" aria-label="Cari"></div>' +
    '<label class="field dt">Tanggal<input type="date" data-in="tanggal" value="' + esc(AD.tanggal) + '"></label></div>' +
    '<div class="chips">' + chip("status", "", "Semua") + chip("status", "Berlangsung", "Berlangsung") + chip("status", "Akan datang", "Akan datang") + chip("status", "Selesai", "Selesai") + "</div>" +
    '<div class="chips sp">' + chip("metode", "", "Semua bayar") + chip("metode", "Tunai", "Tunai") + chip("metode", "Transfer", "Transfer") + chip("metode", "QRIS", "QRIS") + "</div>" +
    '<div class="table" id="tbl">' + adminListHtml() + "</div></main>"
  );
}

/* Ambil foto bukti (butuh token admin, jadi lewat fetch lalu jadi blob URL) */
async function muatBukti(id) {
  const r = await fetch(API_URL + "/admin/bukti/" + id, { headers: { Authorization: "Bearer " + Auth.token } });
  if (!r.ok) throw new Error("Bukti tidak bisa dimuat");
  return URL.createObjectURL(await r.blob());
}

async function detailAdmin(id) {
  const s = await api("GET", "/admin/riwayat/" + id);
  const b = s.pembayaran;
  const cek = b.status === "Verifikasi";
  openModal(
    "Detail " + s.id,
    '<div class="receipt-mini">' +
      '<div class="r"><span>Status sewa</span>' + badgeStatus(s.status) + "</div>" +
      '<div class="r"><span>Nama</span><b>' + esc(s.pelanggan.nama) + "</b></div>" +
      '<div class="r"><span>No. HP</span><b>' + esc(s.pelanggan.hp) + "</b></div>" +
      '<div class="r"><span>Alamat</span><b>' + esc(s.pelanggan.alamat || "-") + "</b></div>" +
      '<div class="dash"></div>' +
      '<div class="r"><span>PS</span><b>' + s.unit.jenis + " · " + pad(s.unit.nomor) + "</b></div>" +
      '<div class="r"><span>Ruangan</span><b>' + esc(s.ruangan.nama) + " (" + s.ruangan.tipe + ")</b></div>" +
      '<div class="r"><span>Waktu</span><b>' + dmy(s.mulai) + ", " + hm(s.mulai) + " – " + hm(s.selesai) + "</b></div>" +
      '<div class="r"><span>Durasi</span><b>' + s.durasi + " jam</b></div>" +
      '<div class="dash"></div>' +
      '<div class="r"><span>Pembayaran</span><b>' + b.metode + " · " + b.id + "</b></div>" +
      '<div class="r"><span>Status bayar</span>' + badgeBayar(b) + "</div>" +
      (b.status === "Ditolak" ? '<div class="r"><span>Alasan ditolak</span><b>' + esc(b.alasan) + "</b></div>" : "") + "</div>" +
      '<div class="total"><b>Total</b><b>' + rp(s.total) + "</b></div>" +
      (b.adaBukti ? '<div class="bukti" id="bukti"><span class="small muted">Memuat bukti bayar…</span></div>' : "") +
      (cek
        ? '<label class="field">Alasan jika ditolak (opsional)<input id="alasan" maxlength="200" placeholder="contoh: nominal tidak sesuai"></label>' +
          '<div class="two"><button class="btn btn-ghost" data-act="tolak" data-id="' + s.id + '">Tolak</button><button class="btn btn-primary" data-act="setujui" data-id="' + s.id + '">Setujui · Lunas</button></div>'
        : ""),
  );
  if (b.adaBukti) {
    try {
      const url = await muatBukti(s.id);
      const box = $("#bukti");
      if (box) box.innerHTML = '<span class="small muted">Bukti bayar (klik untuk memperbesar)</span><a href="' + url + '" target="_blank" rel="noopener"><img src="' + url + '" alt="Bukti pembayaran ' + esc(s.id) + '"></a>';
    } catch (e) {
      const box = $("#bukti");
      if (box) box.innerHTML = '<span class="small muted">' + esc(e.message) + "</span>";
    }
  }
}

/* Setujui / tolak bukti bayar, lalu muat ulang daftar */
async function aksiBayar(id, aksi) {
  const alasan = aksi === "tolak" ? ($("#alasan") || {}).value || "" : undefined;
  await api("POST", "/admin/pembayaran/" + id + "/" + aksi, aksi === "tolak" ? { alasan } : {});
  closeModal();
  toast(aksi === "setujui" ? "Pembayaran disetujui. Pesanan resmi jadi booking." : "Pembayaran ditolak. PS dan ruangan dibuka lagi.");
  await tampil();
}

/* Cek berkala: bukti bayar baru muncul di panel tanpa perlu muat ulang halaman */
setInterval(async () => {
  if (!/^#\/admin/.test(location.hash) || !Auth.token || !$("#verif")) return;
  try {
    const baru = await api("GET", "/admin/verifikasi");
    if (baru.map((x) => x.id).join() !== AD.pending.map((x) => x.id).join()) {
      AD.pending = baru;
      $("#verif").innerHTML = verifHtml();
    }
  } catch (e) {}
}, 10000);
