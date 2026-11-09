"use strict";
/* Autentikasi sederhana: token acak disimpan di memori server */
const crypto = require("crypto");
const { HttpError } = require("../util");

const sessions = new Map();

function createSession(pegawai) {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, { id: pegawai.id_pegawai, nama: pegawai.nama, username: pegawai.username });
  return token;
}
function requireAuth(req, _res, next) {
  const h = req.headers.authorization || "";
  const user = sessions.get(h.replace(/^Bearer\s+/i, ""));
  if (!user) return next(new HttpError(401, "Belum masuk. Kirim header Authorization: Bearer <token>."));
  req.user = user;
  next();
}
const destroySession = (req) => sessions.delete((req.headers.authorization || "").replace(/^Bearer\s+/i, ""));

module.exports = { createSession, requireAuth, destroySession };
