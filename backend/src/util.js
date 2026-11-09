"use strict";
/* Fungsi bantu: error HTTP, pemetaan baris database ke JSON API */

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const bad = (m) => new HttpError(400, m);
const notFound = (m) => new HttpError(404, m);
const conflict = (m) => new HttpError(409, m);

const digits = (s) => String(s || "").replace(/\D/g, "");
const str = (v) => (v == null ? "" : String(v).trim());
const int = (v) => (Number.isInteger(+v) && v !== "" && v !== null ? +v : NaN);

const JAM = 3600000;
/* Status sewa dihitung dari waktu, tidak disimpan: akan datang / berlangsung / selesai */
const statusSewa = (mulai, durasi, now = Date.now()) =>
  now < mulai ? "Akan datang" : now < mulai + durasi * JAM ? "Berlangsung" : "Selesai";

/* Booking sah = Tunai (bayar di kasir) atau sudah Lunas. Verifikasi/Ditolak belum dihitung. */
const BAYAR_SAH = "b.status IN ('Menunggu','Lunas')";

const mapPelanggan = (r) => r && { id: r.id_pelanggan, nama: r.nama, hp: r.no_hp, alamat: r.alamat };
const mapUnit = (r) => r && { id: r.id_unit, jenis: r.jenis, nomor: r.nomor, kondisi: r.kondisi };
const mapRuangan = (r) =>
  r && { id: r.id_ruangan, nama: r.nama, tipe: r.tipe, kapasitas: r.kapasitas, tarif: r.tarif_tambahan, fasilitas: r.fasilitas };

/* Satu baris riwayat lengkap: hasil JOIN penyewaan + pelanggan + unit + ruangan + pembayaran */
const SQL_SEWA = `
  SELECT s.*, p.nama, p.no_hp, p.alamat, u.jenis, u.nomor, r.nama AS ruang, r.tipe,
         b.id_bayar, b.metode, b.jumlah, b.status AS bayar_status, b.tanggal AS bayar_tgl, b.bukti, b.alasan
  FROM penyewaan s
  JOIN pelanggan p ON p.id_pelanggan = s.id_pelanggan
  JOIN unit_ps u ON u.id_unit = s.id_unit
  JOIN ruangan r ON r.id_ruangan = s.id_ruangan
  JOIN pembayaran b ON b.id_sewa = s.id_sewa`;
const mapSewa = (r) =>
  r && {
    id: r.id_sewa,
    pelanggan: { id: r.id_pelanggan, nama: r.nama, hp: r.no_hp, alamat: r.alamat },
    unit: { id: r.id_unit, jenis: r.jenis, nomor: r.nomor },
    ruangan: { id: r.id_ruangan, nama: r.ruang, tipe: r.tipe },
    mulai: r.mulai,
    durasi: r.durasi,
    selesai: r.mulai + r.durasi * JAM,
    total: r.total,
    // Sebelum admin menyetujui bayarnya, pesanan belum jadi booking: statusnya ikut status pembayaran
    status: r.bayar_status === "Verifikasi" ? "Menunggu verifikasi" : r.bayar_status === "Ditolak" ? "Ditolak" : statusSewa(r.mulai, r.durasi),
    pembayaran: { id: r.id_bayar, metode: r.metode, jumlah: r.jumlah, status: r.bayar_status, tanggal: r.bayar_tgl, adaBukti: !!r.bukti, alasan: r.alasan },
  };

module.exports = { HttpError, bad, notFound, conflict, digits, str, int, JAM, statusSewa, BAYAR_SAH, mapPelanggan, mapUnit, mapRuangan, SQL_SEWA, mapSewa };
