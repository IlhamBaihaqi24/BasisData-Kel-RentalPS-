"use strict";
/* Login ADMIN (pegawai). Login customer ada di routes/publik.js */
const router = require("express").Router();
const { db } = require("../db");
const { HttpError, bad, str } = require("../util");
const { createSession, destroySession, requireAuth, cekPassword } = require("../middleware/auth");

/* POST /api/auth/login  {username, password}  (field lama "pin" masih diterima) */
router.post("/login", async (req, res) => {
  const username = str(req.body.username),
    password = str(req.body.password || req.body.pin);
  if (!username || !password) throw bad("Nama dan password wajib diisi");
  const p = await db.get("SELECT * FROM pegawai WHERE username = ?", [username]);
  if (!p || !cekPassword(password, p.password)) throw new HttpError(401, "Nama atau password salah");
  res.json({ token: createSession("admin", { id: p.id_pegawai, nama: p.nama, username: p.username }), pegawai: { id: p.id_pegawai, nama: p.nama, username: p.username } });
});
/* POST /api/auth/logout */
router.post("/logout", requireAuth, (req, res) => {
  destroySession(req);
  res.json({ pesan: "Berhasil keluar" });
});
/* GET /api/auth/me */
router.get("/me", requireAuth, (req, res) => res.json(req.user));

module.exports = router;
