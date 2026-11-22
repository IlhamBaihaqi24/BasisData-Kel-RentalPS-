"use strict";
/* Tes otomatis API. Jalankan: npm test
   Butuh MySQL menyala. Tes memakai database terpisah "titiktemu_test" (dihapus dan dibuat ulang), data asli aman. */
process.env.DB_NAME = "titiktemu_test";
const test = require("node:test");
const { before, after } = test;
const assert = require("node:assert");
const mysql = require("mysql2/promise");
let app, db;

const H = 3600000;
let base, token, server;
before(async () => {
  const c = await mysql.createConnection({ host: process.env.DB_HOST || "127.0.0.1", port: +(process.env.DB_PORT || 3306), user: process.env.DB_USER || "root", password: process.env.DB_PASSWORD || "" });
  await c.query("DROP DATABASE IF EXISTS titiktemu_test");
  await c.end();
  app = require("../src/app");
  db = require("../src/db");
  await app.ready;
  await new Promise((r) => {
    server = app.listen(0, () => {
      base = `http://localhost:${server.address().port}`;
      r();
    });
  });
  const r = await fetch(base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "admin", password: "123456" }) });
  token = (await r.json()).token;
});
after(async () => {
  server.close();
  await db.tutup();
});
const call = async (method, path, body, tok) => {
  const r = await fetch(base + "/api" + path, {
    method,
    headers: { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
};
const pub = (m, p, b, tok) => call(m, p, b, tok);
const adm = (m, p, b) => call(m, p, b, token);
/* akun customer untuk tes: daftar sekali per no. HP, lalu pakai tokennya */
const akun = {};
async function cust(hp = "0899-1111-2222", nama = "Tes Customer") {
  if (!akun[hp]) {
    const r = await pub("POST", "/publik/daftar", { nama, hp, password: "rahasia1" });
    assert.strictEqual(r.status, 201, JSON.stringify(r.data));
    akun[hp] = r.data.token;
  }
  return akun[hp];
}
/* jam mulai jauh di depan (6 hari) supaya tidak bentrok dengan data contoh */
const besok = () => Date.now() + 144 * H;
/* PNG 1x1 valid sebagai contoh bukti bayar */
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const body = (o) => ({ buktiData: o && o.metode === "Tunai" ? undefined : PNG, idUnit: "U-02", idRuangan: "R-02", durasi: 2, metode: "QRIS", mulai: besok(), ...o });
/* pesan sebagai customer: o.hp memilih akun */
const pesan = async (o = {}) => pub("POST", "/publik/pesanan", body(o), await cust(o.hp));

test("health + frontend disajikan", async () => {
  assert.strictEqual((await pub("GET", "/health")).data.status, "ok");
  const r = await fetch(base + "/");
  assert.strictEqual(r.status, 200);
  assert.match(await r.text(), /TitikTemu/);
});
test("admin tanpa token ditolak 401", async () => {
  assert.strictEqual((await pub("GET", "/admin/riwayat")).status, 401);
});
test("login salah 401, login benar dapat token", async () => {
  const r = await pub("POST", "/auth/login", { username: "admin", password: "salah" });
  assert.strictEqual(r.status, 401);
  assert.strictEqual(r.data.error, "Nama atau password salah");
  assert.strictEqual((await pub("POST", "/auth/login", { username: "tidakada", password: "123456" })).data.error, "Nama atau password salah");
  assert.ok(token);
});
test("customer: info tarif + daftar PS dan ruangan (tanpa login)", async () => {
  const i = await pub("GET", "/publik/info");
  assert.deepStrictEqual(i.data.tarif, { PS5: 12000, PS4: 8000 });
  assert.strictEqual((await pub("GET", "/publik/unit")).data.length, 8);
  assert.strictEqual((await pub("GET", "/publik/ruangan")).data.length, 7);
});
test("customer: total = (tarif PS + tarif ruangan) x durasi, pelanggan baru dibuat dari no. HP", async () => {
  const r = await pesan({});
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.data.total, (12000 + 30000) * 2); // PS5 + VVIP Room 2
  assert.strictEqual(r.data.status, "Menunggu verifikasi"); // QRIS belum jadi booking sebelum admin setuju
  assert.strictEqual(r.data.pembayaran.status, "Verifikasi");
  assert.strictEqual(r.data.pembayaran.adaBukti, true);
  assert.match(r.data.pelanggan.id, /^PL-/);
});
test("customer: Tunai berstatus Menunggu (bayar di kasir)", async () => {
  const r = await pesan({ idUnit: "U-03", idRuangan: "R-05", metode: "Tunai", hp: "0877-5555-6666" });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.data.pembayaran.status, "Menunggu");
});
test("jadwal bentrok: PS yang sama di jam beririsan ditolak 409, jam lain boleh", async () => {
  const t = besok();
  assert.strictEqual((await pesan({})).status, 409); // PS U-02 sama persis
  assert.strictEqual((await pesan({ idRuangan: "R-07", mulai: t + H })).status, 409); // beririsan, PS sama
  assert.strictEqual((await pesan({ idRuangan: "R-07", mulai: t + 2 * H, hp: "0899-1111-2222" })).status, 201); // tepat setelah selesai
});
test("ruangan bentrok ditolak, ketersediaan ikut jam", async () => {
  assert.strictEqual((await pesan({ idUnit: "U-08" })).status, 409); // R-02 sudah terpakai
  const t = besok();
  const r = await pub("GET", `/publik/ruangan?mulai=${t}&durasi=1`);
  assert.strictEqual(r.data.find((x) => x.id === "R-02").tersedia, false);
  const r2 = await pub("GET", `/publik/ruangan?mulai=${t + 10 * H}&durasi=1`);
  assert.strictEqual(r2.data.find((x) => x.id === "R-02").tersedia, true);
});
test("validasi: bukti, durasi, metode, jam lewat, unit servis", async () => {
  for (const o of [{ buktiData: "" }, { buktiData: undefined }, { buktiData: "data:image/png;base64,AAAA" }, { buktiData: "data:text/html;base64,PGI+" }, { durasi: 0 }, { durasi: 13 }, { metode: "Kartu" }, { mulai: Date.now() - 5 * H }, { idUnit: "U-99" }, { idRuangan: "R-99" }, { idUnit: "U-05", mulai: besok() + 40 * H }]) {
    const r = await pesan(o);
    assert.ok(r.status === 400 || r.status === 409, JSON.stringify(o) + " -> " + r.status);
  }
});
test("customer: riwayat hanya milik sendiri, struk orang lain tidak bisa dibuka", async () => {
  const t1 = await cust(), t2 = await cust("0877-5555-6666", "Customer Dua");
  const l = await pub("GET", "/publik/pesanan", null, t1);
  assert.ok(l.data.length >= 2 && l.data.every((s) => s.pelanggan.nama === "Tes Customer"));
  const id = l.data[0].id;
  assert.strictEqual((await pub("GET", `/publik/pesanan/${id}`, null, t1)).status, 200);
  assert.strictEqual((await pub("GET", `/publik/pesanan/${id}`, null, t2)).status, 404); // bukan miliknya
  assert.strictEqual((await pub("GET", "/publik/pesanan")).status, 401); // tanpa login
});
test("login customer: daftar, masuk, salah password, no. HP ganda, pesan wajib login", async () => {
  const d = await pub("POST", "/publik/daftar", { nama: "Budi Baru", hp: "0813-0000-1111", password: "abcdef" });
  assert.strictEqual(d.status, 201);
  assert.strictEqual(d.data.pelanggan.nama, "Budi Baru");
  assert.strictEqual((await pub("POST", "/publik/daftar", { nama: "X", hp: "0813 0000 1111", password: "abcdef" })).status, 409); // sudah terdaftar
  assert.strictEqual((await pub("POST", "/publik/daftar", { nama: "X", hp: "0813-9999-1111", password: "123" })).status, 400); // password pendek
  assert.strictEqual((await pub("POST", "/publik/daftar", { nama: "", hp: "0813-9999-1111", password: "abcdef" })).status, 400);
  const salah = await pub("POST", "/publik/masuk", { hp: "0813-0000-1111", password: "salah!" });
  assert.strictEqual(salah.status, 401);
  assert.strictEqual(salah.data.error, "No. HP atau password salah");
  const ok = await pub("POST", "/publik/masuk", { hp: "081300001111", password: "abcdef" });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual((await pub("GET", "/publik/saya", null, ok.data.token)).data.nama, "Budi Baru");
  assert.strictEqual((await pub("POST", "/publik/pesanan", body({}))).status, 401); // tanpa token
  assert.strictEqual((await pub("POST", "/publik/pesanan", body({}), token)).status, 401); // token admin bukan customer
  assert.strictEqual((await pub("GET", "/admin/riwayat", null, ok.data.token)).status, 401); // token customer bukan admin
  const seed = await pub("POST", "/publik/masuk", { hp: "0812-3456-7890", password: "123456" }); // akun contoh
  assert.strictEqual(seed.status, 200);
  assert.strictEqual((await pub("POST", "/publik/keluar", {}, ok.data.token)).status, 200);
  assert.strictEqual((await pub("GET", "/publik/saya", null, ok.data.token)).status, 401); // token sudah mati
});
test("bukti bayar: wajib untuk Transfer/QRIS, tersimpan di database (BLOB), Tunai tanpa bukti", async () => {
  for (const metode of ["Transfer", "QRIS"]) {
    const r = await pesan({ metode, buktiData: undefined, idUnit: "U-07", idRuangan: "R-06", mulai: besok() + 8 * H });
    assert.strictEqual(r.status, 400, metode);
    assert.match(r.data.error, /Bukti pembayaran wajib/);
  }
  const ok = await pesan({ metode: "Transfer", idUnit: "U-07", idRuangan: "R-06", mulai: besok() + 8 * H });
  assert.strictEqual(ok.status, 201);
  const row = await db.db.get("SELECT bukti, bukti_tipe, LENGTH(bukti_data) n FROM pembayaran WHERE id_sewa = ?", [ok.data.id]);
  assert.strictEqual(row.bukti_tipe, "image/png");
  assert.ok(row.n > 50, "foto harus ada di kolom bukti_data");
  const tunai = await pesan({ metode: "Tunai", idUnit: "U-07", idRuangan: "R-06", mulai: besok() + 12 * H });
  assert.strictEqual(tunai.data.pembayaran.adaBukti, false);
  // aturan juga dijaga database: INSERT tanpa bukti ditolak trigger
  await assert.rejects(db.db.run("INSERT INTO pembayaran (id_bayar, id_sewa, tanggal, metode, jumlah, status) VALUES ('PB-X','SW-0001',1,'QRIS',1,'Verifikasi')"), /Bukti pembayaran wajib/);
});
test("nama ruangan tersimpan di tabel penyewaan", async () => {
  const r = await pesan({ idUnit: "U-08", idRuangan: "R-04", mulai: besok() + 16 * H });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.data.ruangan.nama, "VIP Room 2");
  assert.strictEqual((await db.db.get("SELECT nama_ruangan FROM penyewaan WHERE id_sewa = ?", [r.data.id])).nama_ruangan, "VIP Room 2");
  assert.strictEqual((await db.db.get("SELECT COUNT(*) c FROM penyewaan WHERE nama_ruangan = ''")).c, 0);
});
test("jadwal jam: customer melihat jam buka dan sisa PS/ruangan per jam", async () => {
  const hari = new Date(besok()); hari.setHours(0, 0, 0, 0);
  const j = await pub("GET", `/publik/jadwal?hari=${hari.getTime()}&durasi=1`);
  assert.strictEqual(j.status, 200);
  assert.strictEqual(j.data.jam.length, 14); // 10:00 - 23:00
  assert.strictEqual(j.data.jam[0].jam, "10:00");
  assert.ok(j.data.jam.every((x) => x.psKosong <= 7 && x.ruanganKosong <= 7));
  assert.ok(j.data.jam.some((x) => x.psKosong < 7), "pesanan tes di hari itu harus mengurangi PS kosong");
  const lalu = new Date(); lalu.setDate(lalu.getDate() - 1); lalu.setHours(0, 0, 0, 0);
  assert.ok((await pub("GET", `/publik/jadwal?hari=${lalu.getTime()}`)).data.jam.every((x) => x.lewat && !x.tersedia));
  assert.strictEqual((await pub("GET", "/publik/jadwal")).status, 400);
});
test("dua pesanan bersamaan untuk PS yang sama: hanya satu yang lolos (transaksi MySQL)", async () => {
  const mulai = besok() + 12 * H;
  const [a, b] = await Promise.all([
    pesan({ idUnit: "U-01", idRuangan: "R-01", mulai }),
    pesan({ idUnit: "U-01", idRuangan: "R-02", mulai, hp: "0877-5555-6666" }),
  ]);
  assert.deepStrictEqual([a.status, b.status].sort(), [201, 409], JSON.stringify([a.data, b.data]));
});
test("admin: riwayat hanya memuat booking sah (Tunai / sudah disetujui), pending masuk panel verifikasi", async () => {
  const semua = await adm("GET", "/admin/riwayat");
  assert.strictEqual(semua.status, 200);
  assert.ok(!semua.data.some((s) => s.pembayaran.status === "Verifikasi"), "pending tidak boleh ada di riwayat");
  assert.ok(semua.data.some((s) => s.pelanggan.nama === "Tes Customer")); // yang Tunai
  const v = await adm("GET", "/admin/verifikasi");
  assert.ok(v.data.length >= 2 && v.data.every((s) => s.pembayaran.status === "Verifikasi"));
  const q = await adm("GET", "/admin/riwayat?q=tes customer");
  assert.ok(q.data.length >= 1 && q.data.every((s) => /tes customer/i.test(s.pelanggan.nama)));
  const st = await adm("GET", "/admin/riwayat?status=Berlangsung");
  assert.ok(st.data.length >= 2 && st.data.every((s) => s.status === "Berlangsung"));
  const m = await adm("GET", "/admin/riwayat?metode=Transfer");
  assert.ok(m.data.every((s) => s.pembayaran.metode === "Transfer"));
  assert.strictEqual((await adm("GET", "/admin/riwayat?tanggal=salah")).status, 400);
});
test("admin: detail, pelanggan, ringkasan", async () => {
  const d = await adm("GET", "/admin/riwayat/SW-0001");
  assert.strictEqual(d.data.status, "Selesai");
  assert.strictEqual((await adm("GET", "/admin/riwayat/SW-9999")).status, 404);
  const p = await adm("GET", "/admin/pelanggan");
  assert.ok(p.data[0].jumlahSewa >= 1);
  const r = await adm("GET", "/admin/ringkasan");
  assert.ok(r.data.totalPesanan >= 9 && r.data.berlangsung >= 2);
});
test("verifikasi: bukti hanya bisa dilihat admin, setujui -> Lunas & resmi booking", async () => {
  const id = (await adm("GET", "/admin/verifikasi")).data[0].id;
  assert.strictEqual((await pub("GET", `/admin/bukti/${id}`)).status, 401);
  const img = await fetch(base + `/api/admin/bukti/${id}`, { headers: { authorization: "Bearer " + token } });
  assert.strictEqual(img.status, 200);
  assert.match(img.headers.get("content-type"), /image\/png/);
  assert.strictEqual((await pub("POST", `/admin/pembayaran/${id}/setujui`)).status, 401);
  const ok = await adm("POST", `/admin/pembayaran/${id}/setujui`);
  assert.strictEqual(ok.data.pembayaran.status, "Lunas");
  assert.strictEqual(ok.data.status, "Akan datang");
  assert.ok((await adm("GET", "/admin/riwayat")).data.some((s) => s.id === id));
  assert.strictEqual((await adm("POST", `/admin/pembayaran/${id}/setujui`)).status, 409); // sudah diproses
});
test("verifikasi: tolak -> Ditolak, jadwal PS & ruangan dibuka lagi", async () => {
  const t = besok() + 20 * H;
  const p = await pesan({ idUnit: "U-08", idRuangan: "R-07", mulai: t, hp: "0866-1234-5678" });
  assert.strictEqual(p.status, 201);
  assert.strictEqual((await pesan({ idUnit: "U-08", idRuangan: "R-07", mulai: t, hp: "0866-9999-0000" })).status, 409); // slot ditahan selama menunggu
  const r = await adm("POST", `/admin/pembayaran/${p.data.id}/tolak`, { alasan: "Nominal kurang" });
  assert.strictEqual(r.data.status, "Ditolak");
  assert.strictEqual(r.data.pembayaran.alasan, "Nominal kurang");
  assert.ok(!(await adm("GET", "/admin/riwayat")).data.some((s) => s.id === p.data.id));
  assert.strictEqual((await pesan({ idUnit: "U-08", idRuangan: "R-07", mulai: t, hp: "0866-9999-0000" })).status, 201); // slot bebas lagi
});
test("admin: ringkasan tidak menghitung pesanan yang belum disetujui", async () => {
  const r = await adm("GET", "/admin/ringkasan");
  assert.ok(r.data.menungguVerifikasi >= 1);
});
test("admin: tidak ada endpoint hapus/ubah data pelanggan atau riwayat", async () => {
  assert.strictEqual((await adm("DELETE", "/admin/riwayat/SW-0001")).status, 404);
  assert.strictEqual((await adm("PUT", "/admin/pelanggan/PL-001", {})).status, 404);
});
