"use strict";
/* Alur pesan customer, 4 langkah: data diri -> PS dan jam -> ruangan -> bayar */

const W0 = () => ({ step: 1, hari: 0, jam: "", jadwal: null, durasi: 1, idUnit: "", idRuangan: "", metode: "QRIS", bukti: "", units: [], rooms: [], info: null, busy: false });
let W = W0();
const LANGKAH = ["Data diri", "PS & jam", "Ruangan", "Bayar"];

/* Awal hari (00:00 waktu perangkat) untuk "hari ke-n dari sekarang" */
const hariTs = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d.getTime(); };
/* Jam mulai yang dipilih customer (timestamp), atau 0 bila belum memilih */
const mulaiTs = () => (W.jam ? +W.jam : 0);
const hariLabel = (n) => (n === 0 ? "Hari ini" : n === 1 ? "Besok" : dayName(Date.now() + n * 24 * JAM));
const unitSel = () => W.units.find((u) => u.id === W.idUnit);
const roomSel = () => W.rooms.find((r) => r.id === W.idRuangan);
const totalEst = () => {
  const u = unitSel(), r = roomSel();
  return ((u ? u.tarif : 0) + (r ? r.tarif : 0)) * W.durasi;
};

async function muatJadwal() {
  W.jadwal = await api("GET", "/publik/jadwal?hari=" + hariTs(W.hari) + "&durasi=" + W.durasi);
  const j = W.jadwal.jam.find((x) => String(x.mulai) === W.jam);
  if (j && !j.tersedia) W.jam = ""; // jam yang dipilih sudah penuh
}
async function muatUnit() {
  await muatJadwal();
  W.units = W.jam ? await api("GET", "/publik/unit?mulai=" + mulaiTs() + "&durasi=" + W.durasi) : [];
  if (unitSel() && !unitSel().tersedia) W.idUnit = "";
}
async function muatRuangan() {
  W.rooms = await api("GET", "/publik/ruangan?mulai=" + mulaiTs() + "&durasi=" + W.durasi);
  if (roomSel() && !roomSel().tersedia) W.idRuangan = "";
}

async function wizardView() {
  if (!W.info) W.info = await api("GET", "/publik/info");
  const me = Cust.profil;
  if (W.step === 2) await muatUnit();
  if (W.step === 3) await muatRuangan();
  const dots = LANGKAH.map(
    (n, i) => '<li class="' + (i + 1 === W.step ? "on" : i + 1 < W.step ? "done" : "") + '"><b>' + (i + 1 < W.step ? ic("check") : i + 1) + "</b><span>" + n + "</span></li>",
  ).join("");
  const body = [null, stepData, stepPs, stepRuang, stepBayar][W.step]();
  return (
    '<main class="wrap narrow">' + pageHead("Pesan PS", W.step === 1 ? "#/" : "act") +
    '<ol class="progress" aria-label="Langkah">' + dots + "</ol>" + body + "</main>"
  );
}

function stepData() {
  const p = Cust.profil;
  return (
    '<div class="card form"><h2>Data diri</h2><p class="muted small">Data diambil dari akunmu. Pastikan sudah benar sebelum lanjut.</p>' +
    '<label class="field">Nama lengkap<input value="' + esc(p.nama) + '" readonly></label>' +
    '<label class="field">No. HP / WhatsApp<input value="' + esc(p.hp) + '" readonly></label>' +
    '<p class="small muted">Bukan kamu? <button type="button" class="link" data-act="keluarCust">Ganti akun</button></p>' +
    '<button class="btn btn-primary btn-block" data-act="wNext">Lanjut pilih PS</button></div>'
  );
}

function stepPs() {
  const hari = [0, 1, 2, 3, 4].map((n) => '<button class="chip ' + (W.hari === n ? "on" : "") + '" data-act="wHari" data-n="' + n + '">' + hariLabel(n) + "</button>").join("");
  const slots = (W.jadwal ? W.jadwal.jam : []).map((x) =>
    '<button class="slot ' + (String(x.mulai) === W.jam ? "sel" : "") + (x.tersedia && x.psKosong <= 2 ? " low" : "") + '" data-act="wJam" data-v="' + x.mulai + '"' + (x.tersedia ? "" : " disabled") + ">" +
    x.jam + "<small>" + (x.lewat ? "lewat" : x.tersedia ? x.psKosong + " PS kosong" : "penuh") + "</small></button>",
  ).join("");
  const unit = W.units.map((u) =>
    '<button class="opt ' + (W.idUnit === u.id ? "sel" : "") + '" data-act="wUnit" data-id="' + u.id + '"' + (u.tersedia ? "" : " disabled") + ">" +
    '<span class="opt-ic ' + (u.jenis === "PS5" ? "c1" : "c2") + '">' + ic("gamepad") + '</span><span class="grow"><b>' + u.jenis + " · " + pad(u.nomor) + "</b><span class=\"small muted\">" + rp(u.tarif) + " / jam</span></span>" +
    (u.tersedia ? '<span class="badge b-ok">Kosong</span>' : '<span class="badge ' + (u.kondisi !== "baik" ? "b-warn" : "b-busy") + '">' + (u.kondisi !== "baik" ? "Servis" : "Terpakai") + "</span>") + "</button>",
  ).join("");
  return (
    '<div class="card form"><h2>PS &amp; jam main</h2>' +
    '<div class="field">Hari<div class="chips">' + hari + "</div></div>" +
    '<div class="field">Durasi<div class="stepper"><button class="m" data-act="wDur" data-d="-1" aria-label="Kurangi">' + ic("minus") + "</button><b>" + W.durasi + ' jam</b><button class="p" data-act="wDur" data-d="1" aria-label="Tambah">' + ic("plus") + "</button></div></div>" +
    '<div class="field">Jam mulai <span class="tiny muted">(buka 10:00 – 23:00, angka = PS yang masih kosong)</span><div class="slots">' + slots + "</div></div>" +
    '<div class="field">Pilih PS' + (W.jam ? '<div class="list">' + unit + "</div>" : '<p class="small muted box">Pilih jam dulu untuk melihat PS yang kosong.</p>') + "</div>" +
    '<div class="sum">Perkiraan: <b>' + rp(totalEst()) + "</b><span class=\"tiny muted\"> (belum termasuk ruangan)</span></div>" +
    '<div class="two"><button class="btn btn-ghost" data-act="wBack">Kembali</button><button class="btn btn-primary" data-act="wNext">Pilih ruangan</button></div></div>'
  );
}

function stepRuang() {
  const tipe = { VVIP: "c3", VIP: "c1", Reguler: "c2" };
  const rooms = W.rooms.map((r) =>
    '<button class="opt ' + (W.idRuangan === r.id ? "sel" : "") + '" data-act="wRuang" data-id="' + r.id + '"' + (r.tersedia ? "" : " disabled") + ">" +
    '<span class="opt-ic ' + tipe[r.tipe] + '">' + ic("door") + '</span><span class="grow"><b>' + esc(r.nama) + '</b><span class="small muted">' + r.kapasitas + " orang · " + (r.tarif ? "+" + rp(r.tarif) + "/jam" : "tanpa biaya tambahan") + "</span><span class=\"tiny muted\">" + esc(r.fasilitas) + "</span></span>" +
    (r.tersedia ? '<span class="badge b-ok">Kosong</span>' : '<span class="badge b-busy">Terpakai</span>') + "</button>",
  ).join("");
  return (
    '<div class="card form"><h2>Pilih ruangan</h2><p class="muted small">' + hariLabel(W.hari) + ", jam " + hm(+W.jam) + " · " + W.durasi + " jam</p>" +
    '<div class="list">' + rooms + "</div>" +
    '<div class="sum">Perkiraan: <b>' + rp(totalEst()) + "</b></div>" +
    '<div class="two"><button class="btn btn-ghost" data-act="wBack">Kembali</button><button class="btn btn-primary" data-act="wNext">Lanjut bayar</button></div></div>'
  );
}

function stepBayar() {
  const u = unitSel(), r = roomSel(), mulai = mulaiTs();
  const rek = W.info.rekening;
  const met = [["Tunai", "cash", "Bayar di kasir"], ["Transfer", "bank", "Transfer bank"], ["QRIS", "qr", "Scan QRIS"]]
    .map(([m, i, t]) => '<button class="pm ' + (W.metode === m ? "sel" : "") + '" data-act="wMetode" data-m="' + m + '">' + ic(i) + "<b>" + m + '</b><span class="tiny">' + t + "</span></button>").join("");
  let detail = "";
  if (W.metode === "QRIS")
    detail = '<div class="qris"><img src="' + esc(W.info.qris || "assets/qris.png") + '" alt="Kode QRIS TitikTemu"><p class="small muted">Scan dengan e-wallet atau mobile banking, bayar sesuai total, lalu unggah bukti bayarnya di bawah.</p></div>';
  if (W.metode === "Transfer")
    detail = '<div class="rek"><span class="small muted">' + esc(rek.bank) + " a.n. " + esc(rek.nama) + '</span><b class="num">' + esc(rek.no) + '</b><button class="btn btn-soft btn-sm" data-act="copy" data-t="' + esc(rek.no) + '">' + ic("copy") + "Salin nomor</button></div>";
  if (W.metode !== "Tunai")
    detail +=
      '<div class="upl"><b>Bukti pembayaran <span class="badge b-warn">Wajib</span></b><p class="small muted">Unggah foto atau screenshot bukti ' + (W.metode === "QRIS" ? "pembayaran QRIS" : "transfer") + ". Pesananmu aktif setelah admin memeriksanya.</p>" +
      (W.bukti ? '<img src="' + W.bukti + '" alt="Bukti pembayaran yang dipilih">' : "") +
      '<label class="btn btn-soft btn-sm">' + ic("upload") + (W.bukti ? "Ganti foto" : "Pilih foto bukti") +
      '<input type="file" accept="image/*" data-act="wBukti" hidden></label></div>';
  if (W.metode === "Tunai") detail = '<p class="small muted box">Pesananmu tercatat. Bayar tunai ke kasir saat tiba di TitikTemu.</p>';
  return (
    '<div class="card form"><h2>Ringkasan &amp; bayar</h2><div class="receipt-mini">' +
    '<div class="r"><span>Pemesan</span><b>' + esc(Cust.profil.nama) + "</b></div>" +
    '<div class="r"><span>PS</span><b>' + u.jenis + " · " + pad(u.nomor) + "</b></div>" +
    '<div class="r"><span>Ruangan</span><b>' + esc(r.nama) + "</b></div>" +
    '<div class="r"><span>Waktu</span><b>' + dmy(mulai) + ", " + hm(mulai) + " – " + hm(mulai + W.durasi * JAM) + "</b></div>" +
    '<div class="r"><span>Durasi</span><b>' + W.durasi + " jam</b></div></div>" +
    '<div class="total"><b>Total</b><b>' + rp(totalEst()) + "</b></div>" +
    '<div class="pms">' + met + "</div>" + detail +
    '<div class="two"><button class="btn btn-ghost" data-act="wBack">Kembali</button><button class="btn btn-coral" data-act="wBayar"' + (W.busy || (W.metode !== "Tunai" && !W.bukti) ? " disabled" : "") + ">" + (W.metode === "Tunai" ? "Pesan sekarang" : W.bukti ? "Saya sudah bayar" : "Unggah bukti dulu") + "</button></div></div>"
  );
}

/* Aksi tombol wizard dipanggil dari events.js */
const WZ = {
  async next() {
    if (W.step === 2 && !W.jam) return toast("Pilih jam mulai dulu");
    if (W.step === 2 && !W.idUnit) return toast("Pilih PS dulu");
    if (W.step === 3 && !W.idRuangan) return toast("Pilih ruangan dulu");
    W.step++;
    await tampil();
  },
  async back() {
    W.step = Math.max(1, W.step - 1);
    await tampil();
  },
  async bukti(file) {
    if (!file) return;
    try {
      W.bukti = await kecilkanGambar(file);
      await tampil();
    } catch (e) {
      toast(e.message);
    }
  },
  async bayar() {
    if (W.busy) return;
    if (W.metode !== "Tunai" && !W.bukti) return toast("Unggah bukti pembayaran dulu");
    W.busy = true;
    try {
      const s = await api("POST", "/publik/pesanan", {
        idUnit: W.idUnit, idRuangan: W.idRuangan,
        durasi: W.durasi, mulai: mulaiTs(), metode: W.metode, buktiData: W.metode === "Tunai" ? undefined : W.bukti,
      });
      W = W0();
      location.hash = "#/struk/" + s.id + "?baru=1";
    } catch (e) {
      W.busy = false;
      if (e.offline) throw e;
      toast(e.message);
      if (e.status === 401) { location.hash = "#/masuk"; return tampil(); }
      if (e.status === 409) { W.step = 2; W.idUnit = W.idRuangan = ""; await tampil(); }
    }
  },
};
