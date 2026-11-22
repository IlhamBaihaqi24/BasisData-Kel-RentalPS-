"use strict";
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 20) {
  console.error(`Node.js ${process.versions.node} terlalu lama. TitikTemu butuh Node.js 20 atau lebih baru (https://nodejs.org).`);
  process.exit(1);
}
const app = require("./app");
const PORT = process.env.PORT || 3000;
app.ready
  .then(() => app.listen(PORT, () => console.log(`TitikTemu berjalan. Buka http://localhost:${PORT} di browser (API: /api)`)))
  .catch((e) => {
    console.error("\nGAGAL MEMULAI: " + (e.pesanRamah || e.message) + "\n");
    process.exit(1);
  });
