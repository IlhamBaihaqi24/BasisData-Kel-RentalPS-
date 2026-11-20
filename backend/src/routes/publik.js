"use strict";
/* Endpoint PUBLIK: customer mendaftar / masuk, melihat jam kosong, memesan, dan melihat pesanannya sendiri */
const router = require("express").Router();
const { db, nextId, getTarif, getSetting } = require("../db");
const { hashPassword, cekPassword, createSession, destroySession, requireCustomer } = require("../middleware/auth");
const { HttpError, bad, notFound, conflict, digits, str, int, JAM, mapUnit, mapRuangan, SQL_SEWA, mapSewa } = require("../util");

/* Jendela waktu dari query ?mulai=<ms>&durasi=<jam>. Tanpa query: mulai sekarang, 1 jam. */
function jendela(q) {
  const mulai = q.mulai == null ? Date.now() : int(q.mulai);
  const durasi = q.durasi == null ? 1 : int(q.durasi);
  if (!(mulai > 0)) throw bad("mulai harus berupa timestamp (ms)");
  if (!(durasi >= 1 && durasi <= 12)) throw bad("durasi harus 1 sampai 12 jam");
  return { mulai, akhir: mulai + durasi * JAM, durasi };
}
/* Bentrok bila rentang waktu saling tumpang tindih. x = db atau transaksi. */
const bentrok = async (x, kolom, id, w) =>
  !!(await x.get(
    `SELECT 1 AS ada FROM penyewaan s JOIN pembayaran b ON b.id_sewa = s.id_sewa
     WHERE s.${kolom} = ? AND b.status <> 'Ditolak' AND s.mulai < ? AND s.mulai + s.durasi * ${JAM} > ? LIMIT 1`,
    [id, w.akhir, w.mulai],
  ));

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
  return { buf, ext: m[1] === "jpeg" ? "jpg" : m[1], tipe: "image/" + m[1] };
}

/* GET /api/publik/info -> tarif, rekening, QRIS */
router.get("/info", async (_req, res) =>
  res.json({
    tarif: await getTarif(),
    rekening: await getSetting("rekening", { bank: "BCA", no: "1234567890", nama: "TitikTemu Rental PS" }),
    qris: await getSetting("qris", null),
  }),
);

/* ---------- Akun customer: daftar, masuk, keluar ---------- */
const profil = (p) => ({ id: p.id_pelanggan, nama: p.nama, hp: p.no_hp, alamat: p.alamat });
const cariHp = async (hp) => (await db.all("SELECT * FROM pelanggan")).find((x) => digits(x.no_hp) === digits(hp));
const sesiCustomer = (p) => ({ token: createSession("customer", { id: p.id_pelanggan }), pelanggan: profil(p) });

/* POST /api/publik/daftar {nama, hp, password, alamat?} -> buat akun customer */
router.post("/daftar", async (req, res) => {
  const b = req.body || {};
  const nama = str(b.nama), hp = str(b.hp), alamat = str(b.alamat), password = String(b.password || "");
  if (!nama) throw bad("nama wajib diisi");
  if (digits(hp).length < 9 || digits(hp).length > 15) throw bad("no. HP tidak valid");
  if (password.length < 6) throw bad("password minimal 6 karakter");
  const p = await cariHp(hp);
  if (p && p.password) throw conflict("No. HP ini sudah terdaftar, silakan masuk");
  if (p) await db.run("UPDATE pelanggan SET nama=?, alamat=?, password=? WHERE id_pelanggan=?", [nama, alamat || p.alamat, hashPassword(password), p.id_pelanggan]); // pelanggan lama (data dari kasir) mengaktifkan akunnya
  else
    await db.transaction(async (t) => {
      const id = await nextId(t, "pelanggan", "PL-", 3);
      await t.run("INSERT INTO pelanggan (id_pelanggan, nama, no_hp, alamat, password) VALUES (?,?,?,?,?)", [id, nama, hp, alamat, hashPassword(password)]);
    });
  res.status(201).json(sesiCustomer(await cariHp(hp)));
});

/* POST /api/publik/masuk {hp, password} */
router.post("/masuk", async (req, res) => {
  const hp = str((req.body || {}).hp), password = String((req.body || {}).password || "");
  if (!hp || !password) throw bad("No. HP dan password wajib diisi");
  const p = await cariHp(hp);
  if (!p || !cekPassword(password, p.password)) throw new HttpError(401, "No. HP atau password salah");
  res.json(sesiCustomer(p));
});
/* POST /api/publik/keluar */
router.post("/keluar", requireCustomer, (req, res) => {
  destroySession(req);
  res.json({ pesan: "Berhasil keluar" });
});
/* GET /api/publik/saya -> profil customer yang sedang masuk */
router.get("/saya", requireCustomer, async (req, res) => {
  const p = await db.get("SELECT * FROM pelanggan WHERE id_pelanggan = ?", [req.user.id]);
  if (!p) throw new HttpError(401, "Akun tidak ditemukan");
  res.json(profil(p));
});

/* GET /api/publik/jadwal?hari=<ms tengah malam>&durasi=1 -> jam buka 10:00-23:00 dan berapa PS/ruangan yang masih kosong */
router.get("/jadwal", async (req, res) => {
  const hari = int(req.query.hari), durasi = req.query.durasi == null ? 1 : int(req.query.durasi);
  if (!(hari > 0)) throw bad("hari harus berupa timestamp (ms) tengah malam");
  if (!(durasi >= 1 && durasi <= 12)) throw bad("durasi harus 1 sampai 12 jam");
  const unit = await db.all("SELECT id_unit FROM unit_ps WHERE kondisi = 'baik'"), room = await db.all("SELECT id_ruangan FROM ruangan");
  const now = Date.now(), jam = [];
  for (let h = 10; h <= 23; h++) {
    const mulai = hari + h * JAM, w = { mulai, akhir: mulai + durasi * JAM };
    let psKosong = 0, ruKosong = 0;
    for (const u of unit) if (!(await bentrok(db, "id_unit", u.id_unit, w))) psKosong++;
    for (const r of room) if (!(await bentrok(db, "id_ruangan", r.id_ruangan, w))) ruKosong++;
    const lewat = mulai <= now;
    jam.push({ jam: String(h).padStart(2, "0") + ":00", mulai, lewat, psKosong, ruanganKosong: ruKosong, tersedia: !lewat && psKosong > 0 && ruKosong > 0 });
  }
  res.json({ hari, durasi, jam });
});

/* GET /api/publik/unit?mulai=&durasi= -> unit PS + apakah kosong di jendela waktu itu */
router.get("/unit", async (req, res) => {
  const w = jendela(req.query);
  const tarif = await getTarif();
  const hasil = [];
  for (const u of await db.all("SELECT * FROM unit_ps ORDER BY nomor"))
    hasil.push({ ...mapUnit(u), tarif: tarif[u.jenis], tersedia: u.kondisi === "baik" && !(await bentrok(db, "id_unit", u.id_unit, w)) });
  res.json(hasil);
});

/* GET /api/publik/ruangan?mulai=&durasi= -> ruangan + apakah kosong di jendela waktu itu */
router.get("/ruangan", async (req, res) => {
  const w = jendela(req.query);
  const hasil = [];
  for (const r of await db.all("SELECT * FROM ruangan ORDER BY id_ruangan"))
    hasil.push({ ...mapRuangan(r), tersedia: !(await bentrok(db, "id_ruangan", r.id_ruangan, w)) });
  res.json(hasil);
});

/* POST /api/publik/pesanan  (wajib login customer)
   Customer memilih PS + ruangan + jam, lalu cara bayar. Transfer/QRIS WAJIB menyertakan foto bukti (buktiData). */
router.post("/pesanan", requireCustomer, async (req, res) => {
  const b = req.body || {};
  const metode = str(b.metode), durasi = int(b.durasi), mulai = int(b.mulai);
  const pel = await db.get("SELECT * FROM pelanggan WHERE id_pelanggan = ?", [req.user.id]);
  if (!pel) throw new HttpError(401, "Akun tidak ditemukan, silakan masuk lagi");
  if (!(durasi >= 1 && durasi <= 12)) throw bad("durasi harus 1 sampai 12 jam");
  if (!["Tunai", "Transfer", "QRIS"].includes(metode)) throw bad("metode harus Tunai, Transfer, atau QRIS");
  if (!(mulai >= Date.now() - 10 * 60000)) throw bad("jam mulai tidak boleh sudah lewat");
  if (mulai > Date.now() + 7 * 24 * JAM) throw bad("pesan maksimal 7 hari ke depan");

  // Transfer/QRIS wajib menyertakan bukti (disimpan di database); Tunai dibayar di kasir
  const bukti = metode === "Tunai" ? null : bacaBukti(b.buktiData);
  const w = { mulai, akhir: mulai + durasi * JAM };

  const idSewa = await db.transaction(async (t) => {
    // kunci baris PS dan ruangan supaya dua pesanan bersamaan tidak lolos cek bentrok sekaligus
    const unit = await t.get("SELECT * FROM unit_ps WHERE id_unit = ? FOR UPDATE", [str(b.idUnit)]);
    const room = await t.get("SELECT * FROM ruangan WHERE id_ruangan = ? FOR UPDATE", [str(b.idRuangan)]);
    if (!unit) throw bad("PS yang dipilih tidak ditemukan");
    if (!room) throw bad("ruangan yang dipilih tidak ditemukan");
    if (unit.kondisi !== "baik") throw conflict("PS ini sedang servis");
    if (await bentrok(t, "id_unit", unit.id_unit, w)) throw conflict("PS itu sudah dipesan di jam tersebut, pilih PS atau jam lain");
    if (await bentrok(t, "id_ruangan", room.id_ruangan, w)) throw conflict("Ruangan itu sudah dipesan di jam tersebut, pilih ruangan atau jam lain");

    const total = ((await getTarif())[unit.jenis] + room.tarif_tambahan) * durasi;
    const id = await nextId(t, "penyewaan", "SW-", 4);
    await t.run("INSERT INTO penyewaan (id_sewa, id_pelanggan, id_unit, id_ruangan, mulai, durasi, total, nama_ruangan) VALUES (?,?,?,?,?,?,?,?)",
      [id, pel.id_pelanggan, unit.id_unit, room.id_ruangan, mulai, durasi, total, room.nama]);
    // Tunai: Menunggu (bayar di kasir). Transfer/QRIS: Verifikasi = menunggu admin mengecek bukti, belum jadi booking
    await t.run("INSERT INTO pembayaran (id_bayar, id_sewa, tanggal, metode, jumlah, status, bukti, bukti_tipe, bukti_data) VALUES (?,?,?,?,?,?,?,?,?)",
      [await nextId(t, "pembayaran", "PB-", 4), id, Date.now(), metode, total, metode === "Tunai" ? "Menunggu" : "Verifikasi",
        bukti ? id + "." + bukti.ext : "", bukti ? bukti.tipe : "", bukti ? bukti.buf : null]);
    return id;
  });
  res.status(201).json(mapSewa(await db.get(SQL_SEWA + " WHERE s.id_sewa = ?", [idSewa])));
});

/* GET /api/publik/pesanan -> riwayat pesanan milik customer yang sedang masuk (dipakai sidebar Riwayat) */
router.get("/pesanan", requireCustomer, async (req, res) => {
  res.json((await db.all(SQL_SEWA + " WHERE s.id_pelanggan = ? ORDER BY s.mulai DESC", [req.user.id])).map(mapSewa));
});

/* GET /api/publik/pesanan/:id -> satu pesanan (struk); hanya milik sendiri */
router.get("/pesanan/:id", requireCustomer, async (req, res) => {
  const r = await db.get(SQL_SEWA + " WHERE s.id_sewa = ? AND s.id_pelanggan = ?", [req.params.id, req.user.id]);
  if (!r) throw notFound("Pesanan tidak ditemukan");
  res.json(mapSewa(r));
});

module.exports = router;
