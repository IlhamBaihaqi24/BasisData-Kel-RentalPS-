"use strict";
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`Node.js ${process.versions.node} terlalu lama. TitikTemu butuh Node.js 22.13 atau lebih baru (https://nodejs.org).`);
  process.exit(1);
}
const app = require("./app");
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`TitikTemu berjalan. Buka http://localhost:${PORT} di browser (API: /api)`));
