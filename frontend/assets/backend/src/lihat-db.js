"use strict";
/* Menampilkan isi database di terminal (alternatif cepat dari phpMyAdmin): npm run db */
const mysql = require("mysql2/promise");
const { CONFIG, DB_NAME } = require("./db");

(async () => {
  const c = await mysql.createConnection({ ...CONFIG, database: DB_NAME, decimalNumbers: true });
  const [tabel] = await c.query("SHOW TABLES");
  console.log(`\nDatabase MySQL "${DB_NAME}" di ${CONFIG.host}:${CONFIG.port}\n`);
  for (const baris of tabel) {
    const t = Object.values(baris)[0];
    if (t === "urutan") continue;
    const [kol] = await c.query(`SHOW COLUMNS FROM \`${t}\``);
    const [[{ n }]] = await c.query(`SELECT COUNT(*) n FROM \`${t}\``);
    console.log(`== ${t}  (${n} baris)`);
    console.log("   kolom: " + kol.map((k) => `${k.Field} ${k.Type}${k.Key === "PRI" ? " [PK]" : k.Key === "MUL" ? " [FK]" : ""}`).join(", "));
    const [rows] = await c.query(`SELECT * FROM \`${t}\` LIMIT 10`);
    console.table(rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Buffer.isBuffer(v) ? `<BLOB ${v.length} byte>` : k === "password" ? String(v).slice(0, 8) + "…(hash)" : v]))));
  }
  console.log("== Relasi (foreign key)");
  const [fk] = await c.query(
    "SELECT TABLE_NAME t, COLUMN_NAME k, REFERENCED_TABLE_NAME rt, REFERENCED_COLUMN_NAME rk FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL",
    [DB_NAME],
  );
  console.table(fk.map((r) => ({ dari: `${r.t}.${r.k}`, ke: `${r.rt}.${r.rk}` })));
  await c.end();
})().catch((e) => {
  console.error("Gagal membaca database:", e.message, "\nPastikan MySQL menyala dan server TitikTemu pernah dijalankan (npm start) agar tabelnya terbentuk.");
  process.exit(1);
});
