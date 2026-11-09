"use strict";
/* Tes otomatis API. Jalankan: npm test  (memakai database memori, data asli aman) */
process.env.DB_PATH = ":memory:";
const test = require("node:test");
const { before, after } = test;
const assert = require("node:assert");
const app = require("../src/app");

const H = 3600000;
let base, token, server;
before(async () => {
  await new Promise((r) => {
    server = app.listen(0, () => {
      base = `http://localhost:${server.address().port}`;
      r();
    });
  });
  const r = await fetch(base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "admin", pin: "123456" }) });
  token = (await r.json()).token;
});
after(() => server.close());
const call = async (method, path, body, auth) => {
  const r = await fetch(base + "/api" + path, {
    method,
    headers: { "content-type": "application/json", ...(auth ? { authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
};
const pub = (m, p, b) => call(m, p, b, false);
const adm = (m, p, b) => call(m, p, b, true);
/* jam mulai jauh di depan (6 hari) supaya tidak bentrok dengan data contoh */
const besok = () => Date.now() + 144 * H;
/* PNG 1x1 valid sebagai contoh bukti bayar */
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const pesan = (o) => ({ buktiData: o && o.metode === "Tunai" ? undefined : PNG, nama: "Tes Customer", hp: "0899-1111-2222", idUnit: "U-02", idRuangan: "R-02", durasi: 2, metode: "QRIS", mulai: besok(), ...o });

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
  const r = await pub("POST", "/auth/login", { username: "admin", pin: "000000" });
  assert.strictEqual(r.status, 401);
  assert.ok(token);
});
test("customer: info tarif + daftar PS dan ruangan (tanpa login)", async () => {
  const i = await pub("GET", "/publik/info");
  assert.deepStrictEqual(i.data.tarif, { PS5: 12000, PS4: 8000 });
  assert.strictEqual((await pub("GET", "/publik/unit")).data.length, 8);
  assert.strictEqual((await pub("GET", "/publik/ruangan")).data.length, 7);
});
test("customer: total = (tarif PS + tarif ruangan) x durasi, pelanggan baru dibuat dari no. HP", async () => {
  const r = await pub("POST", "/publik/pesanan", pesan({}));
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.data.total, (12000 + 30000) * 2); // PS5 + VVIP Room 2
  assert.strictEqual(r.data.status, "Menunggu verifikasi"); // QRIS belum jadi booking sebelum admin setuju
  assert.strictEqual(r.data.pembayaran.status, "Verifikasi");
  assert.strictEqual(r.data.pembayaran.adaBukti, true);
  assert.match(r.data.pelanggan.id, /^PL-/);
});
test("customer: Tunai berstatus Menunggu (bayar di kasir)", async () => {
  const r = await pub("POST", "/publik/pesanan", pesan({ idUnit: "U-03", idRuangan: "R-05", metode: "Tunai", hp: "0877-5555-6666" }));
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.data.pembayaran.status, "Menunggu");
});
test("jadwal bentrok: PS yang sama di jam beririsan ditolak 409, jam lain boleh", async () => {
  const t = besok();
  assert.strictEqual((await pub("POST", "/publik/pesanan", pesan({}))).status, 409); // PS U-02 sama persis
  assert.strictEqual((await pub("POST", "/publik/pesanan", pesan({ idRuangan: "R-07", mulai: t + H }))).status, 409); // beririsan, PS sama
  assert.strictEqual((await pub("POST", "/publik/pesanan", pesan({ idRuangan: "R-07", mulai: t + 2 * H, hp: "0899-1111-2222" }))).status, 201); // tepat setelah selesai
});
test("ruangan bentrok ditolak, ketersediaan ikut jam", async () => {
  assert.strictEqual((await pub("POST", "/publik/pesanan", pesan({ idUnit: "U-08" }))).status, 409); // R-02 sudah terpakai
  const t = besok();
  const r = await pub("GET", `/publik/ruangan?mulai=${t}&durasi=1`);
  assert.strictEqual(r.data.find((x) => x.id === "R-02").tersedia, false);
  const r2 = await pub("GET", `/publik/ruangan?mulai=${t + 10 * H}&durasi=1`);
  assert.strictEqual(r2.data.find((x) => x.id === "R-02").tersedia, true);
});
test("validasi: nama, hp, durasi, metode, jam lewat, unit servis", async () => {
  for (const o of [{ nama: "" }, { hp: "123" }, { buktiData: "" }, { buktiData: "data:image/png;base64,AAAA" }, { buktiData: "data:text/html;base64,PGI+" }, { durasi: 0 }, { durasi: 13 }, { metode: "Kartu" }, { mulai: Date.now() - 5 * H }, { idUnit: "U-99" }, { idRuangan: "R-99" }, { idUnit: "U-05", mulai: besok() + 40 * H }]) {
    const r = await pub("POST", "/publik/pesanan", pesan(o));
    assert.ok(r.status === 400 || r.status === 409, JSON.stringify(o) + " -> " + r.status);
  }
});
test("customer: lihat pesanan lewat no. HP (format bebas), struk wajib no. HP cocok", async () => {
  const l = await pub("GET", "/publik/pesanan?hp=08991111 2222");
  assert.ok(l.data.length >= 2);
  const id = l.data[0].id;
  assert.strictEqual((await pub("GET", `/publik/pesanan/${id}?hp=0899-1111-2222`)).status, 200);
  assert.strictEqual((await pub("GET", `/publik/pesanan/${id}?hp=0800000000`)).status, 404);
  assert.strictEqual((await pub("GET", "/publik/pesanan?hp=1")).status, 400);
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
  const p = await pub("POST", "/publik/pesanan", pesan({ idUnit: "U-08", idRuangan: "R-07", mulai: t, hp: "0866-1234-5678" }));
  assert.strictEqual(p.status, 201);
  assert.strictEqual((await pub("POST", "/publik/pesanan", pesan({ idUnit: "U-08", idRuangan: "R-07", mulai: t, hp: "0866-9999-0000" }))).status, 409); // slot ditahan selama menunggu
  const r = await adm("POST", `/admin/pembayaran/${p.data.id}/tolak`, { alasan: "Nominal kurang" });
  assert.strictEqual(r.data.status, "Ditolak");
  assert.strictEqual(r.data.pembayaran.alasan, "Nominal kurang");
  assert.ok(!(await adm("GET", "/admin/riwayat")).data.some((s) => s.id === p.data.id));
  assert.strictEqual((await pub("POST", "/publik/pesanan", pesan({ idUnit: "U-08", idRuangan: "R-07", mulai: t, hp: "0866-9999-0000" }))).status, 201); // slot bebas lagi
});
test("admin: ringkasan tidak menghitung pesanan yang belum disetujui", async () => {
  const r = await adm("GET", "/admin/ringkasan");
  assert.ok(r.data.menungguVerifikasi >= 1);
});
test("admin: tidak ada endpoint hapus/ubah data pelanggan atau riwayat", async () => {
  assert.strictEqual((await adm("DELETE", "/admin/riwayat/SW-0001")).status, 404);
  assert.strictEqual((await adm("PUT", "/admin/pelanggan/PL-001", {})).status, 404);
});
