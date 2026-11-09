"use strict";
/* Endpoint PUBLIK (tanpa login): dipakai customer untuk memesan dan melihat pesanannya */
const router = require("express").Router();
const fs = require("fs");
const path = require("path");
const { BUKTI_DIR, db, nextId, getTarif, getSetting } = require("../db");
const { bad, notFound, conflict, digits, str, int, JAM, mapUnit, mapRuangan, SQL_SEWA, mapSewa } = require("../util");

/* Jendela waktu dari query ?mulai=<ms>&durasi=<jam>. Tanpa query: mulai sekarang, 1 jam. */
function jendela(q) {
  const mulai = q.mulai == null ? Date.now() : int(q.mulai);
  const durasi = q.durasi == null ? 1 : int(q.durasi);
  if (!(mulai > 0)) throw bad("mulai harus berupa timestamp (ms)");
  if (!(durasi >= 1 && durasi <= 12)) throw bad("durasi harus 1 sampai 12 jam");
  return { mulai, akhir: mulai + durasi * JAM, durasi };
}
/* Bentrok bila rentang waktu saling tumpang tindih */
const bentrok = (kolom, id, w) =>
  !!db.prepare(
    `SELECT 1 FROM penyewaan s JOIN pembayaran b ON b.id_sewa = s.id_sewa
     WHERE s.${kolom} = ? AND b.status <> 'Ditolak' AND s.mulai < ? AND s.mulai + s.durasi * ${JAM} > ?`,
  ).get(id, w.akhir, w.mulai);

/* Bukti bayar: data URL gambar (png/jpg/webp), maks 4 MB. Jenis file dicek dari isi, bukan dari nama. */
function bacaBukti(dataUrl) {
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!m) throw bad("Bukti pembayaran wajib berupa foto/gambar (PNG, JPG, atau WEBP)");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > 4 * 1024 * 1024) throw bad("Ukuran bukti pembayaran maksimal 4 MB");
  const ok =
    (m[1] === "png" && buf.subarray(0, 4).toString("hex") === "89504e47") ||
    (m[1] === "jpeg" && buf.subarray(0, 3).toString("hex") === "ffd8ff") ||
    (m[1] === "webp" && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP");
  if (!ok) throw bad("File bukti pembayaran bukan gambar yang valid");
  return { buf, ext: m[1] === "jpeg" ? "jpg" : m[1] };
}

/* GET /api/publik/info -> tarif, rekening, QRIS */
router.get("/info", (_req, res) =>
  res.json({ tarif: getTarif(), rekening: getSetting("rekening", { bank: "BCA", no: "1234567890", nama: "TitikTemu Rental PS" }), qris: getSetting("qris", null) }),
);

/* GET /api/publik/unit?mulai=&durasi= -> unit PS + apakah kosong di jendela waktu itu */
router.get("/unit", (req, res) => {
  const w = jendela(req.query);
  const tarif = getTarif();
  res.json(
    db.prepare("SELECT * FROM unit_ps ORDER BY nomor").all().map((u) => ({
      ...mapUnit(u),
      tarif: tarif[u.jenis],
      tersedia: u.kondisi === "baik" && !bentrok("id_unit", u.id_unit, w),
    })),
  );
});

/* GET /api/publik/ruangan?mulai=&durasi= -> ruangan + apakah kosong di jendela waktu itu */
router.get("/ruangan", (req, res) => {
  const w = jendela(req.query);
  res.json(
    db.prepare("SELECT * FROM ruangan ORDER BY id_ruangan").all().map((r) => ({ ...mapRuangan(r), tersedia: !bentrok("id_ruangan", r.id_ruangan, w) })),
  );
});

/* POST /api/publik/pesanan
   Customer mengisi data diri, memilih PS + ruangan + jam, lalu memilih cara bayar. */
router.post("/pesanan", (req, res) => {
  const b = req.body || {};
  const nama = str(b.nama), hp = str(b.hp), alamat = str(b.alamat), metode = str(b.metode);
  const durasi = int(b.durasi), mulai = int(b.mulai);
  if (!nama) throw bad("nama wajib diisi");
  if (digits(hp).length < 9 || digits(hp).length > 15) throw bad("no. HP tidak valid");
  if (!(durasi >= 1 && durasi <= 12)) throw bad("durasi harus 1 sampai 12 jam");
  if (!["Tunai", "Transfer", "QRIS"].includes(metode)) throw bad("metode harus Tunai, Transfer, atau QRIS");
  if (!(mulai >= Date.now() - 10 * 60000)) throw bad("jam mulai tidak boleh sudah lewat");
  if (mulai > Date.now() + 7 * 24 * JAM) throw bad("pesan maksimal 7 hari ke depan");

  const unit = db.prepare("SELECT * FROM unit_ps WHERE id_unit = ?").get(str(b.idUnit));
  const room = db.prepare("SELECT * FROM ruangan WHERE id_ruangan = ?").get(str(b.idRuangan));
  if (!unit) throw bad("PS yang dipilih tidak ditemukan");
  if (!room) throw bad("ruangan yang dipilih tidak ditemukan");
  if (unit.kondisi !== "baik") throw conflict("PS ini sedang servis");
  const w = { mulai, akhir: mulai + durasi * JAM };
  if (bentrok("id_unit", unit.id_unit, w)) throw conflict("PS itu sudah dipesan di jam tersebut, pilih PS atau jam lain");
  if (bentrok("id_ruangan", room.id_ruangan, w)) throw conflict("Ruangan itu sudah dipesan di jam tersebut, pilih ruangan atau jam lain");

  // Transfer/QRIS wajib menyertakan bukti; Tunai dibayar di kasir
  const bukti = metode === "Tunai" ? null : bacaBukti(b.buktiData);

  const total = (getTarif()[unit.jenis] + room.tarif_tambahan) * durasi;
  const idSewa = db.transaction(() => {
    let p = db.prepare("SELECT * FROM pelanggan").all().find((x) => digits(x.no_hp) === digits(hp));
    if (p) db.prepare("UPDATE pelanggan SET nama=?, alamat=? WHERE id_pelanggan=?").run(nama, alamat || p.alamat, p.id_pelanggan);
    else {
      p = { id_pelanggan: nextId("pelanggan", "PL-", 3) };
      db.prepare("INSERT INTO pelanggan VALUES (?,?,?,?)").run(p.id_pelanggan, nama, hp, alamat);
    }
    const id = nextId("penyewaan", "SW-", 4);
    db.prepare("INSERT INTO penyewaan VALUES (?,?,?,?,?,?,?)").run(id, p.id_pelanggan, unit.id_unit, room.id_ruangan, mulai, durasi, total);
    // Tunai: Menunggu (bayar di kasir). Transfer/QRIS: Verifikasi = menunggu admin mengecek bukti, belum jadi booking
    let file = "";
    if (bukti) {
      file = id + "." + bukti.ext;
      fs.writeFileSync(path.join(BUKTI_DIR, file), bukti.buf);
    }
    db.prepare("INSERT INTO pembayaran (id_bayar, id_sewa, tanggal, metode, jumlah, status, bukti) VALUES (?,?,?,?,?,?,?)").run(
      nextId("pembayaran", "PB-", 4), id, Date.now(), metode, total, metode === "Tunai" ? "Menunggu" : "Verifikasi", file);
    return id;
  })();
  res.status(201).json(mapSewa(db.prepare(SQL_SEWA + " WHERE s.id_sewa = ?").get(idSewa)));
});

/* GET /api/publik/pesanan?hp=0812... -> semua pesanan milik no. HP itu */
router.get("/pesanan", (req, res) => {
  const hp = digits(req.query.hp);
  if (hp.length < 9) throw bad("isi no. HP yang dipakai saat memesan");
  const rows = db.prepare(SQL_SEWA + " ORDER BY s.mulai DESC").all().filter((r) => digits(r.no_hp) === hp);
  res.json(rows.map(mapSewa));
});

/* GET /api/publik/pesanan/:id?hp=0812... -> satu pesanan (struk); no. HP harus cocok */
router.get("/pesanan/:id", (req, res) => {
  const r = db.prepare(SQL_SEWA + " WHERE s.id_sewa = ?").get(req.params.id);
  if (!r || digits(r.no_hp) !== digits(req.query.hp)) throw notFound("Pesanan tidak ditemukan");
  res.json(mapSewa(r));
});

module.exports = router;
