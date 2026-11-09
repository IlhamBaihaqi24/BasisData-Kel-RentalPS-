"use strict";
const router = require("express").Router();
const { db } = require("../db");
const { HttpError, bad, str } = require("../util");
const { createSession, destroySession, requireAuth } = require("../middleware/auth");

/* POST /api/auth/login */
router.post("/login", (req, res) => {
  const username = str(req.body.username),
    pin = str(req.body.pin);
  if (!username || !pin) throw bad("username dan pin wajib diisi");
  const p = db.prepare("SELECT * FROM pegawai WHERE username = ?").get(username);
  if (!p || p.pin !== pin) throw new HttpError(401, "ID pegawai atau PIN salah");
  res.json({ token: createSession(p), pegawai: { id: p.id_pegawai, nama: p.nama, username: p.username } });
});
/* POST /api/auth/logout */
router.post("/logout", requireAuth, (req, res) => {
  destroySession(req);
  res.json({ pesan: "Berhasil keluar" });
});
/* GET /api/auth/me */
router.get("/me", requireAuth, (req, res) => res.json(req.user));

module.exports = router;
