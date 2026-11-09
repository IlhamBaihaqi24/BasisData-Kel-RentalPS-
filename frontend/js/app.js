"use strict";
/* Titik masuk. Kalau halaman dibuka langsung dari folder (file://) tapi server sudah menyala,
   langsung pindah ke http://localhost:3000 supaya semuanya berjalan. */
(async function start() {
  if (location.protocol === "file:") {
    try {
      const r = await fetch("http://localhost:3000/api/health");
      if (r.ok) return location.replace("http://localhost:3000/");
    } catch (e) {}
  }
  tampil();
})();
