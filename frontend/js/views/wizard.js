"use strict";
/* Alur pesan customer, 4 langkah: data diri -> PS dan jam -> ruangan -> bayar */

const W0 = () => ({ step: 1, nama: "", hp: Simpan.get("tt-hp"), alamat: "", hari: 0, jam: "now", durasi: 1, idUnit: "", idRuangan: "", metode: "QRIS", bukti: "", units: [], rooms: [], info: null, busy: false });
let W = W0();
const LANGKAH = ["Data diri", "PS & jam", "Ruangan", "Bayar"];

/* Daftar jam mulai untuk hari yang dipilih (buka 10:00 - 23:00) */
function slotJam(hari) {
  const now = new Date(), base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + hari);
  const out = [];
  if (hari === 0) out.push({ v: "now", t: "Sekarang" });
  for (let h = 10; h <= 23; h++) {
    const ts = base.getTime() + h * JAM;
    if (hari === 0 && ts <= Date.now()) continue;
    out.push({ v: String(ts), t: pad(h) + ":00" });
  }
  return out;
}
const mulaiTs = () => {
  if (W.jam === "now") return Date.now() + 60000;
  const slot = slotJam(W.hari).find((s) => s.v === W.jam);
  return slot ? +W.jam : Date.now() + 60000;
};
const hariLabel = (n) => (n === 0 ? "Hari ini" : n === 1 ? "Besok" : dayName(Date.now() + n * 24 * JAM));
const unitSel = () => W.units.find((u) => u.id === W.idUnit);
const roomSel = () => W.rooms.find((r) => r.id === W.idRuangan);
const totalEst = () => {
  const u = unitSel(), r = roomSel();
  return ((u ? u.tarif : 0) + (r ? r.tarif : 0)) * W.durasi;
};

async function muatUnit() {
  W.units = await api("GET", "/publik/unit?mulai=" + mulaiTs() + "&durasi=" + W.durasi);
  if (unitSel() && !unitSel().tersedia) W.idUnit = "";
}
async function muatRuangan() {
  W.rooms = await api("GET", "/publik/ruangan?mulai=" + mulaiTs() + "&durasi=" + W.durasi);
  if (roomSel() && !roomSel().tersedia) W.idRuangan = "";
}

async function wizardView() {
  if (!W.info) W.info = await api("GET", "/publik/info");
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
  return (
    '<div class="card form"><h2>Data diri</h2><p class="muted small">Cukup sekali isi. No. HP dipakai untuk mengecek pesananmu nanti.</p>' +
    '<label class="field">Nama lengkap<input data-w="nama" value="' + esc(W.nama) + '" placeholder="contoh: Rizky Pratama" autocomplete="name"></label>' +
    '<label class="field">No. HP / WhatsApp<input data-w="hp" value="' + esc(W.hp) + '" inputmode="tel" placeholder="0812-3456-7890" autocomplete="tel"></label>' +
    '<label class="field">Alamat (boleh dikosongkan)<input data-w="alamat" value="' + esc(W.alamat) + '" placeholder="contoh: Jakarta Selatan" autocomplete="street-address"></label>' +
    '<button class="btn btn-primary btn-block" data-act="wNext">Lanjut pilih PS</button></div>'
  );
}

function stepPs() {
  const hari = [0, 1, 2].map((n) => '<button class="chip ' + (W.hari === n ? "on" : "") + '" data-act="wHari" data-n="' + n + '">' + hariLabel(n) + "</button>").join("");
  const slots = slotJam(W.hari);
  const opts = slots.map((s) => '<option value="' + s.v + '"' + (s.v === W.jam ? " selected" : "") + ">" + s.t + "</option>").join("");
  const unit = W.units.map((u) =>
    '<button class="opt ' + (W.idUnit === u.id ? "sel" : "") + '" data-act="wUnit" data-id="' + u.id + '"' + (u.tersedia ? "" : " disabled") + ">" +
    '<span class="opt-ic ' + (u.jenis === "PS5" ? "c1" : "c2") + '">' + ic("gamepad") + '</span><span class="grow"><b>' + u.jenis + " · " + pad(u.nomor) + "</b><span class=\"small muted\">" + rp(u.tarif) + " / jam</span></span>" +
    (u.tersedia ? '<span class="badge b-ok">Kosong</span>' : '<span class="badge ' + (u.kondisi !== "baik" ? "b-warn" : "b-busy") + '">' + (u.kondisi !== "baik" ? "Servis" : "Terpakai") + "</span>") + "</button>",
  ).join("");
  return (
    '<div class="card form"><h2>PS &amp; jam main</h2>' +
    '<div class="field">Hari<div class="chips">' + hari + "</div></div>" +
    '<div class="row2"><label class="field">Jam mulai<select data-act="wJam">' + opts + "</select></label>" +
    '<div class="field">Durasi<div class="stepper"><button class="m" data-act="wDur" data-d="-1" aria-label="Kurangi">' + ic("minus") + "</button><b>" + W.durasi + ' jam</b><button class="p" data-act="wDur" data-d="1" aria-label="Tambah">' + ic("plus") + "</button></div></div></div>" +
    '<div class="field">Pilih PS<div class="list">' + unit + "</div></div>" +
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
    '<div class="card form"><h2>Pilih ruangan</h2><p class="muted small">' + hariLabel(W.hari) + ", " + (W.jam === "now" ? "mulai sekarang" : "jam " + hm(+W.jam)) + " · " + W.durasi + " jam</p>" +
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
      '<div class="upl"><b>Bukti pembayaran</b><p class="small muted">Unggah foto atau screenshot bukti ' + (W.metode === "QRIS" ? "pembayaran QRIS" : "transfer") + ". Pesananmu aktif setelah admin memeriksanya.</p>" +
      (W.bukti ? '<img src="' + W.bukti + '" alt="Bukti pembayaran yang dipilih">' : "") +
      '<label class="btn btn-soft btn-sm">' + ic("upload") + (W.bukti ? "Ganti foto" : "Pilih foto bukti") +
      '<input type="file" accept="image/*" data-act="wBukti" hidden></label></div>';
  if (W.metode === "Tunai") detail = '<p class="small muted box">Pesananmu tercatat. Bayar tunai ke kasir saat tiba di TitikTemu.</p>';
  return (
    '<div class="card form"><h2>Ringkasan &amp; bayar</h2><div class="receipt-mini">' +
    '<div class="r"><span>Pemesan</span><b>' + esc(W.nama) + "</b></div>" +
    '<div class="r"><span>PS</span><b>' + u.jenis + " · " + pad(u.nomor) + "</b></div>" +
    '<div class="r"><span>Ruangan</span><b>' + esc(r.nama) + "</b></div>" +
    '<div class="r"><span>Waktu</span><b>' + dmy(mulai) + ", " + hm(mulai) + " – " + hm(mulai + W.durasi * JAM) + "</b></div>" +
    '<div class="r"><span>Durasi</span><b>' + W.durasi + " jam</b></div></div>" +
    '<div class="total"><b>Total</b><b>' + rp(totalEst()) + "</b></div>" +
    '<div class="pms">' + met + "</div>" + detail +
    '<div class="two"><button class="btn btn-ghost" data-act="wBack">Kembali</button><button class="btn btn-coral" data-act="wBayar"' + (W.busy ? " disabled" : "") + ">" + (W.metode === "Tunai" ? "Pesan sekarang" : "Saya sudah bayar") + "</button></div></div>"
  );
}

/* Aksi tombol wizard dipanggil dari events.js */
const WZ = {
  async next() {
    if (W.step === 1) {
      if (!W.nama.trim()) return toast("Nama wajib diisi");
      if (W.hp.replace(/\D/g, "").length < 9) return toast("No. HP belum benar");
    }
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
        nama: W.nama.trim(), hp: W.hp.trim(), alamat: W.alamat.trim(), idUnit: W.idUnit, idRuangan: W.idRuangan,
        durasi: W.durasi, mulai: mulaiTs(), metode: W.metode, buktiData: W.metode === "Tunai" ? undefined : W.bukti,
      });
      Simpan.set("tt-hp", W.hp.trim());
      W = W0();
      location.hash = "#/struk/" + s.id + "?baru=1";
    } catch (e) {
      W.busy = false;
      if (e.offline) throw e;
      toast(e.message);
      if (e.status === 409) { W.step = 2; W.idUnit = W.idRuangan = ""; await tampil(); }
    }
  },
};
