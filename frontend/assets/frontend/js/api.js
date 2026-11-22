"use strict";
/* Penghubung ke backend REST API. Semua data berasal dari server. */

/* Alamat API.
   - Dibuka lewat http://localhost:3000  -> "/api" (satu alamat dengan server)
   - Dibuka lewat file:// atau server lain -> http://localhost:3000/api
   Bisa diganti dengan mendefinisikan window.TITIKTEMU_API sebelum file ini dimuat. */
const API_URL =
  window.TITIKTEMU_API ||
  (location.protocol === "file:" || (location.port && location.port !== "3000") ? "http://localhost:3000/api" : "/api");

/* Dua jenis token: admin (sessionStorage, hilang saat tab ditutup) dan customer (localStorage, tetap masuk) */
const simpanToken = (store, key) => ({
  get token() {
    try { return store().getItem(key) || ""; } catch (e) { return ""; }
  },
  set token(v) {
    try { v ? store().setItem(key, v) : store().removeItem(key); } catch (e) {}
  },
});
const Auth = simpanToken(() => sessionStorage, "tt-token"); // admin
const Cust = simpanToken(() => localStorage, "tt-ctoken"); // customer
Cust.profil = null; // {id, nama, hp, alamat} setelah masuk

/* Endpoint /admin dan /auth memakai token admin, selebihnya token customer */
const tokenUntuk = (path) => (/^\/(admin|auth)/.test(path) ? Auth.token : Cust.token);


/* Satu pintu untuk semua permintaan. Error dilempar sebagai Error(pesan); err.offline = true bila server mati. */
async function api(method, path, body) {
  let res;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: Object.assign({ "Content-Type": "application/json" }, tokenUntuk(path) ? { Authorization: "Bearer " + tokenUntuk(path) } : {}),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    const err = new Error("Server belum menyala.");
    err.offline = true;
    throw err;
  }
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    const err = new Error((data && data.error) || "Permintaan gagal (" + res.status + ")");
    err.status = res.status;
    if (res.status === 401 && !/^\/(auth|publik\/(masuk|daftar))/.test(path) && tokenUntuk(path) && !/^\/admin/.test(path)) { Cust.token = ""; Cust.profil = null; } // token customer kedaluwarsa
    throw err;
  }
  return data;
}

/* Muat profil customer bila sudah punya token; token yang sudah mati dibersihkan */
async function muatProfil() {
  if (!Cust.token) return (Cust.profil = null);
  try { Cust.profil = await api("GET", "/publik/saya"); } catch (e) { if (e.offline) throw e; Cust.token = ""; Cust.profil = null; }
  return Cust.profil;
}
