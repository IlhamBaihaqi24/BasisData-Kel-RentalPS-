"use strict";
/* Menyusun aplikasi Express: middleware, rute, penanganan error, dan penyajian frontend */
const express = require("express");
const cors = require("cors");
const path = require("path");
const { seed } = require("./db");
const { requireAuth } = require("./middleware/auth");
const { notFoundHandler, errorHandler } = require("./middleware/error");

seed();
const app = express();
app.use(cors());
app.use(express.json({ limit: "8mb" })); // bukti bayar dikirim sebagai gambar base64

app.get("/api/health", (_req, res) => res.json({ status: "ok", layanan: "TitikTemu API" }));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/publik", require("./routes/publik")); // customer, tanpa login
app.use("/api/admin", requireAuth, require("./routes/admin")); // admin, wajib login

/* Frontend ikut disajikan dari server yang sama: buka http://localhost:3000 */
app.use(express.static(path.join(__dirname, "..", "..", "frontend")));

app.use("/api", notFoundHandler);
app.use(errorHandler);
module.exports = app;
