"use strict";
/* Database SQLite: skema tabel, pembuat ID, dan data contoh */
const { DatabaseSync } = require("node:sqlite"); // bawaan Node 22+, tanpa instal tambahan
const path = require("path");
const fs = require("fs");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data", "titiktemu.db");
if (DB_PATH !== ":memory:") fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

/* Foto bukti bayar disimpan sebagai file (bukan di dalam database) */
const BUKTI_DIR =
  process.env.BUKTI_DIR ||
  (DB_PATH === ":memory:" ? fs.mkdtempSync(path.join(require("os").tmpdir(), "tt-bukti-")) : path.join(path.dirname(DB_PATH), "bukti"));
fs.mkdirSync(BUKTI_DIR, { recursive: true });

const raw = new DatabaseSync(DB_PATH);
raw.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

/* Pembungkus tipis: db.prepare / db.exec / db.transaction(fn) */
const db = {
  prepare: (sql) => raw.prepare(sql),
  exec: (sql) => raw.exec(sql),
  transaction: (fn) => () => {
    raw.exec("BEGIN");
    try {
      const hasil = fn();
      raw.exec("COMMIT");
      return hasil;
    } catch (e) {
      raw.exec("ROLLBACK");
      throw e;
    }
  },
};

/* Migrasi: database lama belum punya status Verifikasi/Ditolak dan kolom bukti/alasan.
   SQLite tidak bisa mengubah CHECK, jadi tabel dibuat ulang dan datanya disalin. */
const _bayar = raw.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='pembayaran'").get();
if (_bayar && !_bayar.sql.includes("Verifikasi")) {
  raw.exec(`
    PRAGMA foreign_keys = OFF;
    BEGIN;
    ALTER TABLE pembayaran RENAME TO pembayaran_lama;
    CREATE TABLE pembayaran (
      id_bayar TEXT PRIMARY KEY, id_sewa TEXT NOT NULL UNIQUE REFERENCES penyewaan(id_sewa),
      tanggal INTEGER NOT NULL, metode TEXT NOT NULL CHECK (metode IN ('Tunai','Transfer','QRIS')),
      jumlah INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Menunggu','Verifikasi','Lunas','Ditolak')),
      bukti TEXT NOT NULL DEFAULT '', alasan TEXT NOT NULL DEFAULT ''
    );
    INSERT INTO pembayaran (id_bayar, id_sewa, tanggal, metode, jumlah, status)
      SELECT id_bayar, id_sewa, tanggal, metode, jumlah, status FROM pembayaran_lama;
    DROP TABLE pembayaran_lama;
    COMMIT;
    PRAGMA foreign_keys = ON;
  `);
}

db.exec(`
CREATE TABLE IF NOT EXISTS pegawai (
  id_pegawai TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, pin TEXT NOT NULL, nama TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pelanggan (
  id_pelanggan TEXT PRIMARY KEY, nama TEXT NOT NULL, no_hp TEXT NOT NULL UNIQUE, alamat TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS unit_ps (
  id_unit TEXT PRIMARY KEY, jenis TEXT NOT NULL CHECK (jenis IN ('PS5','PS4')), nomor INTEGER NOT NULL,
  kondisi TEXT NOT NULL DEFAULT 'baik', UNIQUE (jenis, nomor)
);
CREATE TABLE IF NOT EXISTS ruangan (
  id_ruangan TEXT PRIMARY KEY, nama TEXT NOT NULL UNIQUE, tipe TEXT NOT NULL CHECK (tipe IN ('VVIP','VIP','Reguler')),
  kapasitas INTEGER NOT NULL, tarif_tambahan INTEGER NOT NULL DEFAULT 0, fasilitas TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS penyewaan (
  id_sewa TEXT PRIMARY KEY,
  id_pelanggan TEXT NOT NULL REFERENCES pelanggan(id_pelanggan),
  id_unit TEXT NOT NULL REFERENCES unit_ps(id_unit),
  id_ruangan TEXT NOT NULL REFERENCES ruangan(id_ruangan),
  mulai INTEGER NOT NULL, durasi INTEGER NOT NULL, total INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS pembayaran (
  id_bayar TEXT PRIMARY KEY, id_sewa TEXT NOT NULL UNIQUE REFERENCES penyewaan(id_sewa),
  tanggal INTEGER NOT NULL, metode TEXT NOT NULL CHECK (metode IN ('Tunai','Transfer','QRIS')),
  jumlah INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Menunggu','Verifikasi','Lunas','Ditolak')),
  bukti TEXT NOT NULL DEFAULT '', alasan TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS pengaturan (kunci TEXT PRIMARY KEY, nilai TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS urutan (nama TEXT PRIMARY KEY, nilai INTEGER NOT NULL);
`);

/* ID berurutan, contoh: nextId("pelanggan", "PL-", 3) -> PL-007 */
function nextId(nama, prefix, lebar) {
  db.prepare(
    "INSERT INTO urutan (nama, nilai) VALUES (?, 1) ON CONFLICT(nama) DO UPDATE SET nilai = nilai + 1",
  ).run(nama);
  const n = db.prepare("SELECT nilai FROM urutan WHERE nama = ?").get(nama).nilai;
  return prefix + String(n).padStart(lebar, "0");
}

function getSetting(kunci, fallback) {
  const r = db.prepare("SELECT nilai FROM pengaturan WHERE kunci = ?").get(kunci);
  return r ? JSON.parse(r.nilai) : fallback;
}
function setSetting(kunci, nilai) {
  db.prepare(
    "INSERT INTO pengaturan (kunci, nilai) VALUES (?, ?) ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai",
  ).run(kunci, JSON.stringify(nilai));
}
const getTarif = () => getSetting("tarif", { PS5: 12000, PS4: 8000 });

/* Data contoh, hanya diisi bila database masih kosong */
function seed() {
  if (db.prepare("SELECT COUNT(*) c FROM pegawai").get().c > 0) return;
  const H = 3600000, M = 60000, N = Date.now();
  const tx = db.transaction(() => {
    db.prepare("INSERT INTO pegawai VALUES (?,?,?,?)").run("PG-01", "kasir.dinda", "123456", "Dinda");
    db.prepare("INSERT INTO pegawai VALUES (?,?,?,?)").run("PG-02", "admin", "123456", "Admin");
    setSetting("tarif", { PS5: 12000, PS4: 8000 });
    [
      ["Rizky Pratama", "0812-3456-7890", "Jakarta Selatan"],
      ["Salsa Amelia", "0857-2211-9034", "Depok"],
      ["Bimo Aditya", "0813-9087-6612", "Jakarta Selatan"],
      ["Nadia Putri", "0896-4410-2275", "Bekasi"],
      ["Fajar Ramadhan", "0821-7765-3308", "Jakarta Selatan"],
      ["Citra Maharani", "0878-5521-4096", "Tangerang Selatan"],
    ].forEach((x) =>
      db.prepare("INSERT INTO pelanggan VALUES (?,?,?,?)").run(nextId("pelanggan", "PL-", 3), ...x),
    );
    [["PS5", 1, "baik"], ["PS5", 2, "baik"], ["PS5", 3, "baik"], ["PS4", 4, "baik"],
     ["PS4", 5, "rusak ringan"], ["PS4", 6, "baik"], ["PS4", 7, "baik"], ["PS4", 8, "baik"],
    ].forEach((x) => db.prepare("INSERT INTO unit_ps VALUES (?,?,?,?)").run(nextId("unit", "U-", 2), ...x));
    [["VVIP Room 1", "VVIP", 8, 30000, "TV 65 inci, AC, sofa, kulkas mini"],
     ["VVIP Room 2", "VVIP", 8, 30000, "TV 65 inci, AC, sofa, kulkas mini"],
     ["VIP Room 1", "VIP", 6, 15000, "TV 55 inci, AC, sofa"],
     ["VIP Room 2", "VIP", 6, 15000, "TV 55 inci, AC, sofa"],
     ["VIP Room 3", "VIP", 6, 15000, "TV 55 inci, AC, sofa"],
     ["Reguler 1", "Reguler", 4, 0, "TV 43 inci, kipas angin"],
     ["Reguler 2", "Reguler", 4, 0, "TV 43 inci, kipas angin"],
    ].forEach((x) => db.prepare("INSERT INTO ruangan VALUES (?,?,?,?,?,?)").run(nextId("ruangan", "R-", 2), ...x));
    const tarif = getTarif();
    const add = (pl, un, room, mulai, dur, metode) => {
      const jenis = db.prepare("SELECT jenis FROM unit_ps WHERE id_unit = ?").get(un).jenis;
      const tamb = db.prepare("SELECT tarif_tambahan t FROM ruangan WHERE id_ruangan = ?").get(room).t;
      const total = (tarif[jenis] + tamb) * dur;
      const id = nextId("penyewaan", "SW-", 4);
      db.prepare("INSERT INTO penyewaan VALUES (?,?,?,?,?,?,?)").run(id, pl, un, room, mulai, dur, total);
      db.prepare("INSERT INTO pembayaran (id_bayar, id_sewa, tanggal, metode, jumlah, status) VALUES (?,?,?,?,?,?)").run(
        nextId("pembayaran", "PB-", 4), id, mulai - 20 * M, metode, total, metode === "Tunai" ? "Menunggu" : "Lunas");
    };
    // riwayat (sudah selesai)
    add("PL-002", "U-04", "R-06", N - 52 * H, 3, "QRIS");
    add("PL-001", "U-01", "R-03", N - 30 * H, 2, "Tunai");
    add("PL-005", "U-03", "R-07", N - 10 * H, 1, "QRIS");
    add("PL-004", "U-06", "R-04", N - 8 * H, 2, "Tunai");
    add("PL-003", "U-02", "R-01", N - 6 * H, 3, "Transfer");
    // sedang berlangsung
    add("PL-002", "U-04", "R-06", N - 105 * M, 3, "QRIS");
    add("PL-001", "U-01", "R-01", N - 30 * M, 2, "Tunai");
    // akan datang
    add("PL-006", "U-03", "R-03", N + 3 * H, 2, "Transfer");
  });
  tx();
}

module.exports = { BUKTI_DIR, db, nextId, getSetting, setSetting, getTarif, seed };
