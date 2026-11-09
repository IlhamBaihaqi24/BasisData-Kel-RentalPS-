"use strict";
/* Elemen tampilan umum: toast, modal, header, kotak kosong */

let _tt;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(_tt);
  _tt = setTimeout(() => (t.hidden = true), 3000);
}
function openModal(title, body) {
  const m = $("#modal");
  m.innerHTML =
    '<div class="sheet"><div class="sheet-h"><h2>' + title + '</h2><button class="iconbtn" aria-label="Tutup" data-act="closeModal">' +
    ic("x") + "</button></div>" + body + "</div>";
  m.hidden = false;
}
const closeModal = () => ($("#modal").hidden = true);

const empty = (t) => '<div class="empty">' + t + "</div>";
const loading = () => '<div class="empty">Memuat…</div>';
const brand = (s) =>
  '<span class="brand">' + logo(s || 36) + '<b>Titik<span>Temu</span></b></span>';
/* Header halaman pelanggan: tombol kembali + judul */
const pageHead = (title, back) =>
  '<header class="phead">' +
  (back === "act"
    ? '<button class="iconbtn" data-act="wBack" aria-label="Kembali">' + ic("back") + "</button>"
    : '<a class="iconbtn" href="' + (back || "#/") + '" aria-label="Kembali">' + ic("back") + "</a>") +
  "<h1>" + title + "</h1></header>";
