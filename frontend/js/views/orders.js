"use strict";
/* Customer: daftar "Pesanan saya" (dicari lewat no. HP) dan struk */

let ORD = { hp: Simpan.get("tt-hp"), list: null };

const ordCard = (s) =>
  '<a class="row ord" href="#/struk/' + s.id + '"><div class="grow"><div class="ttl">' + esc(s.ruangan.nama) + " · " + s.unit.jenis + " " + pad(s.unit.nomor) + "</div>" +
  '<div class="small muted">' + dayName(s.mulai) + ", " + dmy(s.mulai) + " · " + hm(s.mulai) + "–" + hm(s.selesai) + "</div>" +
  '<div class="small muted">' + s.id + " · " + rp(s.total) + "</div></div>" + badgeStatus(s.status) + "</a>";

async function ordersView() {
  if (ORD.hp && ORD.list === null) {
    try { ORD.list = await api("GET", "/publik/pesanan?hp=" + encodeURIComponent(ORD.hp)); } catch (e) { if (e.offline) throw e; ORD.list = null; }
  }
  return (
    '<main class="wrap narrow">' + pageHead("Pesanan saya") +
    '<form class="card form" data-form="cari"><label class="field">No. HP yang dipakai saat memesan<input data-o="hp" value="' + esc(ORD.hp) + '" inputmode="tel" placeholder="0812-3456-7890"></label>' +
    '<button class="btn btn-primary btn-block" type="submit">' + ic("search") + "Cari pesanan</button></form>" +
    '<div class="list sp">' + (ORD.list === null ? "" : ORD.list.length ? ORD.list.map(ordCard).join("") : empty("Belum ada pesanan untuk nomor ini.")) + "</div></main>"
  );
}

function strukText(s) {
  return [
    "TitikTemu · " + s.id, dayName(s.mulai) + ", " + dmy(s.mulai), "Pemesan: " + s.pelanggan.nama,
    "PS: " + s.unit.jenis + " " + pad(s.unit.nomor), "Ruangan: " + s.ruangan.nama,
    "Jam: " + hm(s.mulai) + " - " + hm(s.selesai) + " (" + s.durasi + " jam)",
    "Bayar: " + s.pembayaran.metode + " (" + BAYAR_LABEL[s.pembayaran.status].toLowerCase() + ")", "Total: " + rp(s.total),
  ].join("\n");
}

async function strukView(id, baru) {
  const hp = Simpan.get("tt-hp");
  let s;
  try { s = await api("GET", "/publik/pesanan/" + id + "?hp=" + encodeURIComponent(hp)); } catch (e) {
    if (e.offline) throw e;
    return '<main class="wrap narrow">' + pageHead("Struk", "#/pesanan") + empty("Struk tidak ditemukan. Cari lewat menu Pesanan saya.") + "</main>";
  }
  window._struk = s;
  const b = s.pembayaran;
  return (
    '<main class="wrap narrow">' +
    (baru
      ? '<div class="success"><div class="ck ' + (b.status === "Verifikasi" ? "ck-wait" : b.status === "Ditolak" ? "ck-bad" : "") + '">' + ic(b.status === "Verifikasi" ? "clock" : b.status === "Ditolak" ? "x" : "check") + "</div><h1>" + (b.status === "Verifikasi" ? "Bukti terkirim!" : b.status === "Ditolak" ? "Pembayaran ditolak" : "Pesanan berhasil!") + "</h1><p class=\"muted\">" + (b.status === "Ditolak" ? "Maaf, " + esc(s.pelanggan.nama.split(" ")[0]) + ". Lihat alasannya di bawah." : (b.status === "Lunas" ? "Pembayaran diterima. " : b.status === "Verifikasi" ? "Admin sedang mengecek pembayaranmu. " : "Bayar tunai di kasir ya. ") + "Selamat main, " + esc(s.pelanggan.nama.split(" ")[0]) + ".") + "</p></div>"
      : pageHead("Struk", "#/pesanan")) +
    '<div class="receipt"><div class="rc-h">' + logo(34) + '<b>Titik<span>Temu</span></b><span class="small muted">' + s.id + '</span></div><div class="dash"></div>' +
    '<div class="r"><span>Pemesan</span><b>' + esc(s.pelanggan.nama) + "</b></div>" +
    '<div class="r"><span>Tanggal</span><b>' + dayName(s.mulai) + ", " + dmy(s.mulai) + "</b></div>" +
    '<div class="r"><span>Jam main</span><b>' + hm(s.mulai) + " – " + hm(s.selesai) + " (" + s.durasi + " jam)</b></div>" +
    '<div class="r"><span>PS</span><b>' + s.unit.jenis + " · " + pad(s.unit.nomor) + "</b></div>" +
    '<div class="r"><span>Ruangan</span><b>' + esc(s.ruangan.nama) + "</b></div>" +
    '<div class="dash"></div><div class="r"><span>Pembayaran</span><b>' + b.metode + "</b></div>" +
    '<div class="r"><span>Status</span>' + badgeBayar(b) + "</div>" +
    '<div class="r"><span>Status sewa</span>' + badgeStatus(s.status) + "</div>" +
    '<div class="total"><b>Total</b><b>' + rp(s.total) + "</b></div></div>" +
    (b.status === "Verifikasi"
      ? '<p class="small box sp">Pesananmu <b>belum jadi booking</b> sampai admin menyetujui bukti bayarmu. Statusnya berubah jadi lunas setelah disetujui.</p><button class="btn btn-soft btn-block" data-act="retry">Perbarui status</button>'
      : "") +
    (b.status === "Ditolak"
      ? '<p class="small box sp"><b>Pembayaran ditolak:</b> ' + esc(b.alasan) + ". Pesanan ini dibatalkan. Silakan pesan lagi dan unggah bukti yang benar.</p>"
      : "") +
    '<div class="two sp"><button class="btn btn-ghost" data-act="copyStruk">' + ic("copy") + 'Salin struk</button><a class="btn btn-primary" href="' + (baru ? "#/" : "#/pesanan") + '">' + (baru ? "Selesai" : "Tutup") + "</a></div></main>"
  );
}
