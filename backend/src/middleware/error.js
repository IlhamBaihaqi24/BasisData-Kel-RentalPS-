"use strict";
/* Penanganan error terpusat: semua error jadi JSON { error: "pesan" } */
function notFoundHandler(req, res) {
  res.status(404).json({ error: `Endpoint ${req.method} ${req.originalUrl} tidak ada.` });
}
// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Body bukan JSON yang valid." });
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? "Terjadi kesalahan di server." : err.message });
}
module.exports = { notFoundHandler, errorHandler };
