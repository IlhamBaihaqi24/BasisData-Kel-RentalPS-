"use strict";
/* Autentikasi sederhana: token acak disimpan di memori server.
   Ada dua peran: "admin" (pegawai) dan "customer" (pelanggan). Token satu peran tidak berlaku untuk peran lain. */
const crypto = require("crypto");
const { HttpError } = require("../util");

const sessions = new Map();

/* Kata sandi disimpan sebagai hash scrypt: "salt:hash" (tidak pernah teks biasa) */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return salt + ":" + crypto.scryptSync(String(password), salt, 32).toString("hex");
}
function cekPassword(password, tersimpan) {
  const [salt, hash] = String(tersimpan || "").split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex"), b = crypto.scryptSync(String(password), salt, 32);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createSession(role, data) {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, { role, ...data });
  return token;
}
const tokenDari = (req) => (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
const requireRole = (role, pesan) => (req, _res, next) => {
  const user = sessions.get(tokenDari(req));
  if (!user || user.role !== role) return next(new HttpError(401, pesan));
  req.user = user;
  next();
};
const requireAuth = requireRole("admin", "Belum masuk sebagai admin. Kirim header Authorization: Bearer <token>.");
const requireCustomer = requireRole("customer", "Silakan masuk dulu (login customer).");
const destroySession = (req) => sessions.delete(tokenDari(req));

module.exports = { hashPassword, cekPassword, createSession, requireAuth, requireCustomer, destroySession };
