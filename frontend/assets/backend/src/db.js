"use strict";
/* Database MySQL / MariaDB (yang sama dengan phpMyAdmin di XAMPP): koneksi, skema tabel, pembuat ID, data contoh.
   Pengaturan koneksi bisa diubah lewat environment (bawaan XAMPP: user root, tanpa password):
   DB_HOST (127.0.0.1) · DB_PORT (3306) · DB_USER (root) · DB_PASSWORD ("") · DB_NAME (titiktemu) */
const mysql = require("mysql2/promise");
const path = require("path");
const fs = require("fs");
const { hashPassword } = require("./middleware/auth");

const CONFIG = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: +(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
};
const DB_NAME = process.env.DB_NAME || "titiktemu";

let pool;
/* Pembungkus tipis: db.all / db.get / db.run (dan di dalam transaksi: t.all / t.get / t.run) */
const bungkus = (c) => ({
  all: async (sql, p = []) => (await c.query(sql, p))[0],
  get: async (sql, p = []) => (await c.query(sql, p))[0][0],
  run: async (sql, p = []) => (await c.query(sql, p))[0], // hasil: { affectedRows, insertId }
});
const db = {
  all: (...a) => bungkus(pool).all(...a),
  get: (...a) => bungkus(pool).get(...a),
  run: (...a) => bungkus(pool).run(...a),
  /* Semua perintah di dalam fn(t) satu transaksi: sukses semua atau dibatalkan semua */
  async transaction(fn) {
    const c = await pool.getConnection();
    try {
      await c.beginTransaction();
      const hasil = await fn(bungkus(c));
      await c.commit();
      return hasil;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  },
};

/* Skema tabel (sama dengan database/titiktemu.sql yang bisa di-import lewat phpMyAdmin) */
const SKEMA = [
  `CREATE TABLE IF NOT EXISTS pegawai (
    id_pegawai VARCHAR(10) NOT NULL PRIMARY KEY, username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, nama VARCHAR(100) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS pelanggan (
    id_pelanggan VARCHAR(10) NOT NULL PRIMARY KEY, nama VARCHAR(100) NOT NULL, no_hp VARCHAR(20) NOT NULL UNIQUE,
    alamat VARCHAR(200) NOT NULL DEFAULT '', password VARCHAR(255) NOT NULL DEFAULT ''
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS unit_ps (
    id_unit VARCHAR(10) NOT NULL PRIMARY KEY, jenis ENUM('PS5','PS4') NOT NULL, nomor INT NOT NULL,
    kondisi VARCHAR(30) NOT NULL DEFAULT 'baik', UNIQUE KEY uq_unit (jenis, nomor)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS ruangan (
    id_ruangan VARCHAR(10) NOT NULL PRIMARY KEY, nama VARCHAR(50) NOT NULL UNIQUE,
    tipe ENUM('VVIP','VIP','Reguler') NOT NULL, kapasitas INT NOT NULL, tarif_tambahan INT NOT NULL DEFAULT 0,
    fasilitas VARCHAR(200) NOT NULL DEFAULT ''
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS penyewaan (
    id_sewa VARCHAR(10) NOT NULL PRIMARY KEY, id_pelanggan VARCHAR(10) NOT NULL, id_unit VARCHAR(10) NOT NULL,
    id_ruangan VARCHAR(10) NOT NULL, nama_ruangan VARCHAR(50) NOT NULL DEFAULT '',
    mulai BIGINT NOT NULL, durasi INT NOT NULL, total INT NOT NULL,
    CONSTRAINT fk_sewa_pelanggan FOREIGN KEY (id_pelanggan) REFERENCES pelanggan (id_pelanggan),
    CONSTRAINT fk_sewa_unit FOREIGN KEY (id_unit) REFERENCES unit_ps (id_unit),
    CONSTRAINT fk_sewa_ruangan FOREIGN KEY (id_ruangan) REFERENCES ruangan (id_ruangan)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS pembayaran (
    id_bayar VARCHAR(10) NOT NULL PRIMARY KEY, id_sewa VARCHAR(10) NOT NULL UNIQUE,
    tanggal BIGINT NOT NULL, metode ENUM('Tunai','Transfer','QRIS') NOT NULL, jumlah INT NOT NULL,
    status ENUM('Menunggu','Verifikasi','Lunas','Ditolak') NOT NULL,
    bukti VARCHAR(100) NOT NULL DEFAULT '', alasan VARCHAR(200) NOT NULL DEFAULT '',
    bukti_tipe VARCHAR(30) NOT NULL DEFAULT '', bukti_data MEDIUMBLOB NULL,
    CONSTRAINT fk_bayar_sewa FOREIGN KEY (id_sewa) REFERENCES penyewaan (id_sewa)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS pengaturan (kunci VARCHAR(50) NOT NULL PRIMARY KEY, nilai TEXT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS urutan (nama VARCHAR(30) NOT NULL PRIMARY KEY, nilai INT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  // Aturan di tingkat database: Transfer/QRIS tidak boleh disimpan tanpa foto bukti
  `DROP TRIGGER IF EXISTS bukti_wajib`,
  `CREATE TRIGGER bukti_wajib BEFORE INSERT ON pembayaran FOR EACH ROW
   BEGIN
     IF NEW.metode <> 'Tunai' AND (NEW.bukti_data IS NULL OR LENGTH(NEW.bukti_data) = 0) THEN
       SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bukti pembayaran wajib untuk Transfer/QRIS';
     END IF;
   END`,
];

/* ID berurutan, contoh: nextId(t, "pelanggan", "PL-", 3) -> PL-007. t = transaksi (aman dari balapan). */
async function nextId(t, nama, prefix, lebar) {
  await t.run("INSERT INTO urutan (nama, nilai) VALUES (?, 1) ON DUPLICATE KEY UPDATE nilai = nilai + 1", [nama]);
  const n = (await t.get("SELECT nilai FROM urutan WHERE nama = ?", [nama])).nilai;
  return prefix + String(n).padStart(lebar, "0");
}

async function getSetting(kunci, fallback) {
  const r = await db.get("SELECT nilai FROM pengaturan WHERE kunci = ?", [kunci]);
  return r ? JSON.parse(r.nilai) : fallback;
}
async function setSetting(t, kunci, nilai) {
  await t.run("INSERT INTO pengaturan (kunci, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)", [kunci, JSON.stringify(nilai)]);
}
const getTarif = () => getSetting("tarif", { PS5: 12000, PS4: 8000 });

/* Data contoh, hanya diisi bila database masih kosong */
async function seed() {
  if ((await db.get("SELECT COUNT(*) c FROM pegawai")).c > 0) return;
  const H = 3600000, M = 60000, N = Date.now();
  await db.transaction(async (t) => {
    await t.run("INSERT INTO pegawai VALUES (?,?,?,?)", ["PG-01", "kasir.dinda", hashPassword("123456"), "Dinda"]);
    await t.run("INSERT INTO pegawai VALUES (?,?,?,?)", ["PG-02", "admin", hashPassword("123456"), "Admin"]);
    await setSetting(t, "tarif", { PS5: 12000, PS4: 8000 });
    for (const x of [
      ["Rizky Pratama", "0812-3456-7890", "Jakarta Selatan"],
      ["Salsa Amelia", "0857-2211-9034", "Depok"],
      ["Bimo Aditya", "0813-9087-6612", "Jakarta Selatan"],
      ["Nadia Putri", "0896-4410-2275", "Bekasi"],
      ["Fajar Ramadhan", "0821-7765-3308", "Jakarta Selatan"],
      ["Citra Maharani", "0878-5521-4096", "Tangerang Selatan"],
    ])
      await t.run("INSERT INTO pelanggan VALUES (?,?,?,?,?)", [await nextId(t, "pelanggan", "PL-", 3), ...x, hashPassword("123456")]);
    for (const x of [["PS5", 1, "baik"], ["PS5", 2, "baik"], ["PS5", 3, "baik"], ["PS4", 4, "baik"],
      ["PS4", 5, "rusak ringan"], ["PS4", 6, "baik"], ["PS4", 7, "baik"], ["PS4", 8, "baik"]])
      await t.run("INSERT INTO unit_ps VALUES (?,?,?,?)", [await nextId(t, "unit", "U-", 2), ...x]);
    for (const x of [["VVIP Room 1", "VVIP", 8, 30000, "TV 65 inci, AC, sofa, kulkas mini"],
      ["VVIP Room 2", "VVIP", 8, 30000, "TV 65 inci, AC, sofa, kulkas mini"],
      ["VIP Room 1", "VIP", 6, 15000, "TV 55 inci, AC, sofa"],
      ["VIP Room 2", "VIP", 6, 15000, "TV 55 inci, AC, sofa"],
      ["VIP Room 3", "VIP", 6, 15000, "TV 55 inci, AC, sofa"],
      ["Reguler 1", "Reguler", 4, 0, "TV 43 inci, kipas angin"],
      ["Reguler 2", "Reguler", 4, 0, "TV 43 inci, kipas angin"]])
      await t.run("INSERT INTO ruangan (id_ruangan, nama, tipe, kapasitas, tarif_tambahan, fasilitas) VALUES (?,?,?,?,?,?)", [await nextId(t, "ruangan", "R-", 2), ...x]);
    const tarif = { PS5: 12000, PS4: 8000 };
    const contoh = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "assets", "icon-192.png")); // foto bukti contoh
    const add = async (pl, un, room, mulai, dur, metode) => {
      const jenis = (await t.get("SELECT jenis FROM unit_ps WHERE id_unit = ?", [un])).jenis;
      const r = await t.get("SELECT nama, tarif_tambahan t FROM ruangan WHERE id_ruangan = ?", [room]);
      const total = (tarif[jenis] + r.t) * dur;
      const id = await nextId(t, "penyewaan", "SW-", 4);
      await t.run("INSERT INTO penyewaan (id_sewa, id_pelanggan, id_unit, id_ruangan, mulai, durasi, total, nama_ruangan) VALUES (?,?,?,?,?,?,?,?)", [id, pl, un, room, mulai, dur, total, r.nama]);
      const tunai = metode === "Tunai";
      await t.run("INSERT INTO pembayaran (id_bayar, id_sewa, tanggal, metode, jumlah, status, bukti, bukti_tipe, bukti_data) VALUES (?,?,?,?,?,?,?,?,?)", [
        await nextId(t, "pembayaran", "PB-", 4), id, mulai - 20 * M, metode, total, tunai ? "Menunggu" : "Lunas",
        tunai ? "" : id + ".png", tunai ? "" : "image/png", tunai ? null : contoh]);
    };
    // riwayat (sudah selesai)
    await add("PL-002", "U-04", "R-06", N - 52 * H, 3, "QRIS");
    await add("PL-001", "U-01", "R-03", N - 30 * H, 2, "Tunai");
    await add("PL-005", "U-03", "R-07", N - 10 * H, 1, "QRIS");
    await add("PL-004", "U-06", "R-04", N - 8 * H, 2, "Tunai");
    await add("PL-003", "U-02", "R-01", N - 6 * H, 3, "Transfer");
    // sedang berlangsung
    await add("PL-002", "U-04", "R-06", N - 105 * M, 3, "QRIS");
    await add("PL-001", "U-01", "R-01", N - 30 * M, 2, "Tunai");
    // akan datang
    await add("PL-006", "U-03", "R-03", N + 3 * H, 2, "Transfer");
  });
}

/* Dijalankan sekali saat server mulai: buat database + tabel bila belum ada, lalu isi data contoh */
async function init() {
  let admin;
  try {
    admin = await mysql.createConnection(CONFIG);
  } catch (e) {
    e.pesanRamah = e.code === "ER_ACCESS_DENIED_ERROR"
      ? `MySQL menolak user "${CONFIG.user}". Cek DB_USER / DB_PASSWORD (bawaan XAMPP: root tanpa password).`
      : `Tidak bisa terhubung ke MySQL di ${CONFIG.host}:${CONFIG.port}. Nyalakan MySQL (tombol Start di XAMPP Control Panel) lalu jalankan lagi.`;
    throw e;
  }
  try {
    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
    // foto bukti disimpan di database; paket data MySQL lama (1 MB) terlalu kecil untuk foto 4 MB
    await admin.query("SET GLOBAL max_allowed_packet = 16777216").catch(() => {});
  } finally {
    await admin.end();
  }
  pool = mysql.createPool({ ...CONFIG, database: DB_NAME, connectionLimit: 10, decimalNumbers: true, charset: "utf8mb4" });
  for (const sql of SKEMA) await pool.query(sql);
  await seed();
}
const tutup = () => pool && pool.end();

module.exports = { db, init, tutup, nextId, getSetting, setSetting, getTarif, DB_NAME, CONFIG };
