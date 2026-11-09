"use strict";
/* Endpoint ADMIN (wajib login): melihat riwayat + memverifikasi pembayaran Transfer/QRIS */
const router = require("express").Router();
const path = require("path");
const { BUKTI_DIR, db } = require("../db");
const { bad, notFound, conflict, str, JAM, statusSewa, BAYAR_SAH, mapPelanggan, SQL_SEWA, mapSewa } = require("../util");

/* GET /api/admin/riwayat?q=kata&status=Berlangsung&metode=QRIS&tanggal=YYYY-MM-DD */
router.get("/riwayat", (req, res) => {
  const k = [BAYAR_SAH], v = []; // pesanan yang buktinya belum disetujui tidak masuk riwayat booking
  if (req.query.metode) { k.push("b.metode = ?"); v.push(str(req.query.metode)); }
  if (req.query.tanggal) {
    const t0 = new Date(req.query.tanggal + "T00:00:00").getTime();
    if (Number.isNaN(t0)) throw bad("format tanggal harus YYYY-MM-DD");
    k.push("s.mulai >= ? AND s.mulai < ?");
    v.push(t0, t0 + 24 * JAM);
  }
  if (req.query.q) {
    k.push("lower(s.id_sewa || ' ' || p.nama || ' ' || p.no_hp || ' ' || r.nama) LIKE ?");
    v.push(`%${str(req.query.q).toLowerCase()}%`);
  }
  let list = db.prepare(`${SQL_SEWA} ${k.length ? "WHERE " + k.join(" AND ") : ""} ORDER BY s.mulai DESC`).all(...v).map(mapSewa);
  if (req.query.status) list = list.filter((s) => s.status === req.query.status);
  res.json(list);
});

/* GET /api/admin/verifikasi -> pembayaran Transfer/QRIS yang menunggu disetujui (terlama di atas) */
router.get("/verifikasi", (_req, res) => {
  res.json(db.prepare(`${SQL_SEWA} WHERE b.status = 'Verifikasi' ORDER BY b.tanggal ASC`).all().map(mapSewa));
});

/* GET /api/admin/bukti/:id -> foto bukti bayar milik satu pesanan (hanya admin) */
router.get("/bukti/:id", (req, res) => {
  const r = db.prepare("SELECT bukti FROM pembayaran WHERE id_sewa = ?").get(req.params.id);
  if (!r || !r.bukti) throw notFound("Bukti pembayaran tidak ada");
  res.set("Cache-Control", "private, max-age=300");
  res.sendFile(path.join(BUKTI_DIR, path.basename(r.bukti)));
});

/* Ambil pesanan yang sedang menunggu verifikasi, atau error bila sudah diproses */
function menunggu(id) {
  const r = db.prepare(SQL_SEWA + " WHERE s.id_sewa = ?").get(id);
  if (!r) throw notFound("Data sewa tidak ditemukan");
  if (r.bayar_status !== "Verifikasi") throw conflict("Pembayaran ini tidak sedang menunggu verifikasi");
  return r;
}

/* POST /api/admin/pembayaran/:id/setujui -> bukti valid: pembayaran Lunas, pesanan resmi jadi booking */
router.post("/pembayaran/:id/setujui", (req, res) => {
  menunggu(req.params.id);
  db.prepare("UPDATE pembayaran SET status = 'Lunas', alasan = '' WHERE id_sewa = ?").run(req.params.id);
  res.json(mapSewa(db.prepare(SQL_SEWA + " WHERE s.id_sewa = ?").get(req.params.id)));
});

/* POST /api/admin/pembayaran/:id/tolak {alasan} -> bukti tidak valid: pesanan batal, PS dan ruangan dibuka lagi */
router.post("/pembayaran/:id/tolak", (req, res) => {
  menunggu(req.params.id);
  const alasan = str((req.body || {}).alasan).slice(0, 200) || "Bukti pembayaran tidak valid";
  db.prepare("UPDATE pembayaran SET status = 'Ditolak', alasan = ? WHERE id_sewa = ?").run(alasan, req.params.id);
  res.json(mapSewa(db.prepare(SQL_SEWA + " WHERE s.id_sewa = ?").get(req.params.id)));
});

/* GET /api/admin/riwayat/:id */
router.get("/riwayat/:id", (req, res) => {
  const r = db.prepare(SQL_SEWA + " WHERE s.id_sewa = ?").get(req.params.id);
  if (!r) throw notFound("Data sewa tidak ditemukan");
  res.json(mapSewa(r));
});

/* GET /api/admin/pelanggan -> pelanggan beserta jumlah sewa dan total belanja */
router.get("/pelanggan", (_req, res) => {
  const rows = db.prepare(`
    SELECT p.*, COUNT(s.id_sewa) jumlah_sewa, COALESCE(SUM(s.total),0) total_belanja
    FROM pelanggan p LEFT JOIN (
      SELECT s.* FROM penyewaan s JOIN pembayaran b ON b.id_sewa = s.id_sewa WHERE ${BAYAR_SAH}
    ) s ON s.id_pelanggan = p.id_pelanggan
    GROUP BY p.id_pelanggan ORDER BY p.id_pelanggan`).all();
  res.json(rows.map((r) => ({ ...mapPelanggan(r), jumlahSewa: r.jumlah_sewa, totalBelanja: r.total_belanja })));
});

/* GET /api/admin/ringkasan -> angka untuk kartu di atas daftar riwayat */
router.get("/ringkasan", (_req, res) => {
  const now = Date.now();
  const hari = new Date(); hari.setHours(0, 0, 0, 0);
  const semua = db.prepare(`SELECT s.mulai, s.durasi, s.total, b.metode FROM penyewaan s JOIN pembayaran b ON b.id_sewa = s.id_sewa WHERE ${BAYAR_SAH}`).all();
  const hariIni = semua.filter((s) => s.mulai >= hari.getTime() && s.mulai < hari.getTime() + 24 * JAM);
  res.json({
    menungguVerifikasi: db.prepare("SELECT COUNT(*) c FROM pembayaran WHERE status = 'Verifikasi'").get().c,
    totalPesanan: semua.length,
    berlangsung: semua.filter((s) => statusSewa(s.mulai, s.durasi, now) === "Berlangsung").length,
    akanDatang: semua.filter((s) => statusSewa(s.mulai, s.durasi, now) === "Akan datang").length,
    pesananHariIni: hariIni.length,
    pendapatanHariIni: hariIni.reduce((a, s) => a + s.total, 0),
    perMetode: ["Tunai", "Transfer", "QRIS"].map((m) => ({ metode: m, jumlah: semua.filter((s) => s.metode === m).length })),
  });
});

module.exports = router;
