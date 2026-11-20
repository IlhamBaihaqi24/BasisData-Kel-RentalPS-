"use strict";
/* Fungsi bantu: ambil elemen, escape HTML, format uang dan tanggal */

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const rp = (n) => "Rp " + Math.round(n).toLocaleString("id-ID");
const pad = (n, w = 2) => String(n).padStart(w, "0");
const hm = (ts) => pad(new Date(ts).getHours()) + ":" + pad(new Date(ts).getMinutes());
const MON = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const DAY = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const dmy = (ts) => {
  const d = new Date(ts);
  return d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear();
};
const dayName = (ts) => DAY[new Date(ts).getDay()];
const JAM = 3600000;

/* Penyimpanan ringan di browser (aman bila diblokir) */
const Simpan = {
  get(k) {
    try { return localStorage.getItem(k) || ""; } catch (e) { return ""; }
  },
  set(k, v) {
    try { localStorage.setItem(k, v); } catch (e) {}
  },
};

/* Lencana status sewa */
const STATUS_KELAS = { "Akan datang": "b-soft", Berlangsung: "b-ok", Selesai: "b-muted", "Menunggu verifikasi": "b-warn", Ditolak: "b-busy" };
const badgeStatus = (s) => '<span class="badge ' + (STATUS_KELAS[s] || "b-soft") + '">' + esc(s) + "</span>";
const BAYAR_LABEL = { Lunas: "Lunas", Menunggu: "Bayar di kasir", Verifikasi: "Menunggu verifikasi", Ditolak: "Ditolak" };
const BAYAR_KELAS = { Lunas: "b-ok", Menunggu: "b-warn", Verifikasi: "b-warn", Ditolak: "b-busy" };
const badgeBayar = (b) => '<span class="badge ' + BAYAR_KELAS[b.status] + '">' + BAYAR_LABEL[b.status] + "</span>";

/* Kecilkan foto (maks 1600 px, JPEG) supaya upload bukti bayar ringan; hasilnya data URL */
function kecilkanGambar(file, maks = 1600) {
  return new Promise((ok, gagal) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, maks / Math.max(img.width, img.height)), c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ok(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); gagal(new Error("File itu bukan gambar")); };
    img.src = url;
  });
}
