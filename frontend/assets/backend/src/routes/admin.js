"use strict";
/* Endpoint ADMIN (wajib login): melihat riwayat + memverifikasi pembayaran Transfer/QRIS */
const router = require("express").Router();
const { db } = require("../db");
const { bad, notFound, conflict, str, JAM, statusSewa, BAYAR_SAH, mapPelanggan, SQL_SEWA, mapSewa } = require("../util");

/* GET /api/admin/riwayat?q=kata&status=Berlangsung&metode=QRIS&tanggal=YYYY-MM-DD */
router.get("/riwayat", async (req, res) => {
  const k = [BAYAR_SAH], v = []; // pesanan yang buktinya belum disetujui tidak masuk riwayat booking
  if (req.query.metode) { k.push("b.metode = ?"); v.push(str(req.query.metode)); }
  if (req.query.tanggal) {
    const t0 = new Date(req.query.tanggal + "T00:00:00").getTime();
    if (Number.isNaN(t0)) throw bad("format tanggal harus YYYY-MM-DD");
    k.push("s.mulai >= ? AND s.mulai < ?");
    v.push(t0, t0 + 24 * JAM);
  }
  if (req.query.q) {
    k.push("lower(CONCAT_WS(' ', s.id_sewa, p.nama, p.no_hp, s.nama_ruangan)) LIKE ?");
    v.push(`%${str(req.query.q).toLowerCase()}%`);
  }
  let list = (await db.all(`${SQL_SEWA} WHERE ${k.join(" AND ")} ORDER BY s.mulai DESC`, v)).map(mapSewa);
  if (req.query.status) list = list.filter((s) => s.status === req.query.status);
  res.json(list);
});

/* GET /api/admin/verifikasi -> pembayaran Transfer/QRIS yang menunggu disetujui (terlama di atas) */
router.get("/verifikasi", async (_req, res) => {
  res.json((await db.all(`${SQL_SEWA} WHERE b.status = 'Verifikasi' ORDER BY b.tanggal ASC`)).map(mapSewa));
});

/* GET /api/admin/bukti/:id -> foto bukti bayar milik satu pesanan (hanya admin) */
router.get("/bukti/:id", async (req, res) => {
  const r = await db.get("SELECT bukti_tipe, bukti_data FROM pembayaran WHERE id_sewa = ?", [req.params.id]);
  if (!r || !r.bukti_data) throw notFound("Bukti pembayaran tidak ada");
  res.set({ "Content-Type": r.bukti_tipe, "Cache-Control": "private, max-age=300" });
  res.send(Buffer.from(r.bukti_data)); // foto dibaca langsung dari kolom BLOB di database
});

/* Ambil pesanan yang sedang menunggu verifikasi, atau error bila sudah diproses */
async function menunggu(id) {
  const r = await db.get(SQL_SEWA + " WHERE s.id_sewa = ?", [id]);
  if (!r) throw notFound("Data sewa tidak ditemukan");
  if (r.bayar_status !== "Verifikasi") throw conflict("Pembayaran ini tidak sedang menunggu verifikasi");
  return r;
}

/* POST /api/admin/pembayaran/:id/setujui -> bukti valid: pembayaran Lunas, pesanan resmi jadi booking */
router.post("/pembayaran/:id/setujui", async (req, res) => {
  await menunggu(req.params.id);
  // syarat status = Verifikasi ikut di UPDATE supaya dua admin yang menekan bersamaan tidak saling menimpa
  const h = await db.run("UPDATE pembayaran SET status = 'Lunas', alasan = '' WHERE id_sewa = ? AND status = 'Verifikasi'", [req.params.id]);
  if (!h.affectedRows) throw conflict("Pembayaran ini tidak sedang menunggu verifikasi");
  res.json(mapSewa(await db.get(SQL_SEWA + " WHERE s.id_sewa = ?", [req.params.id])));
});

/* POST /api/admin/pembayaran/:id/tolak {alasan} -> bukti tidak valid: pesanan batal, PS dan ruangan dibuka lagi */
router.post("/pembayaran/:id/tolak", async (req, res) => {
  await menunggu(req.params.id);
  const alasan = str((req.body || {}).alasan).slice(0, 200) || "Bukti pembayaran tidak valid";
  const h = await db.run("UPDATE pembayaran SET status = 'Ditolak', alasan = ? WHERE id_sewa = ? AND status = 'Verifikasi'", [alasan, req.params.id]);
  if (!h.affectedRows) throw conflict("Pembayaran ini tidak sedang menunggu verifikasi");
  res.json(mapSewa(await db.get(SQL_SEWA + " WHERE s.id_sewa = ?", [req.params.id])));
});

/* GET /api/admin/riwayat/:id */
router.get("/riwayat/:id", async (req, res) => {
  const r = await db.get(SQL_SEWA + " WHERE s.id_sewa = ?", [req.params.id]);
  if (!r) throw notFound("Data sewa tidak ditemukan");
  res.json(mapSewa(r));
});

/* GET /api/admin/pelanggan -> pelanggan beserta jumlah sewa dan total belanja */
router.get("/pelanggan", async (_req, res) => {
  const rows = await db.all(`
    SELECT p.*, COUNT(s.id_sewa) jumlah_sewa, COALESCE(SUM(s.total),0) total_belanja
    FROM pelanggan p LEFT JOIN (
      SELECT s.* FROM penyewaan s JOIN pembayaran b ON b.id_sewa = s.id_sewa WHERE ${BAYAR_SAH}
    ) s ON s.id_pelanggan = p.id_pelanggan
    GROUP BY p.id_pelanggan, p.nama, p.no_hp, p.alamat, p.password ORDER BY p.id_pelanggan`);
  res.json(rows.map((r) => ({ ...mapPelanggan(r), jumlahSewa: r.jumlah_sewa, totalBelanja: r.total_belanja })));
});

/* GET /api/admin/ringkasan -> angka untuk kartu di atas daftar riwayat */
router.get("/ringkasan", async (_req, res) => {
  const now = Date.now();
  const hari = new Date(); hari.setHours(0, 0, 0, 0);
  const semua = await db.all(`SELECT s.mulai, s.durasi, s.total, b.metode FROM penyewaan s JOIN pembayaran b ON b.id_sewa = s.id_sewa WHERE ${BAYAR_SAH}`);
  const hariIni = semua.filter((s) => s.mulai >= hari.getTime() && s.mulai < hari.getTime() + 24 * JAM);
  res.json({
    menungguVerifikasi: (await db.get("SELECT COUNT(*) c FROM pembayaran WHERE status = 'Verifikasi'")).c,
    totalPesanan: semua.length,
    berlangsung: semua.filter((s) => statusSewa(s.mulai, s.durasi, now) === "Berlangsung").length,
    akanDatang: semua.filter((s) => statusSewa(s.mulai, s.durasi, now) === "Akan datang").length,
    pesananHariIni: hariIni.length,
    pendapatanHariIni: hariIni.reduce((a, s) => a + s.total, 0),
    perMetode: ["Tunai", "Transfer", "QRIS"].map((m) => ({ metode: m, jumlah: semua.filter((s) => s.metode === m).length })),
  });
});

module.exports = router;
