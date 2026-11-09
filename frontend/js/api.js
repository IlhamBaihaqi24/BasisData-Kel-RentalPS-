"use strict";
/* Penghubung ke backend REST API. Semua data berasal dari server. */

/* Alamat API.
   - Dibuka lewat http://localhost:3000  -> "/api" (satu alamat dengan server)
   - Dibuka lewat file:// atau server lain -> http://localhost:3000/api
   Bisa diganti dengan mendefinisikan window.TITIKTEMU_API sebelum file ini dimuat. */
const API_URL =
  window.TITIKTEMU_API ||
  (location.protocol === "file:" || (location.port && location.port !== "3000") ? "http://localhost:3000/api" : "/api");

const Auth = {
  get token() {
    try { return sessionStorage.getItem("tt-token") || ""; } catch (e) { return ""; }
  },
  set token(v) {
    try { v ? sessionStorage.setItem("tt-token", v) : sessionStorage.removeItem("tt-token"); } catch (e) {}
  },
};

/* Satu pintu untuk semua permintaan. Error dilempar sebagai Error(pesan); err.offline = true bila server mati. */
async function api(method, path, body) {
  let res;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: Object.assign({ "Content-Type": "application/json" }, Auth.token ? { Authorization: "Bearer " + Auth.token } : {}),
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
    throw err;
  }
  return data;
}
