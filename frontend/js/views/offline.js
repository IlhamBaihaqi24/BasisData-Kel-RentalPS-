"use strict";
/* Layar ramah saat server belum menyala (menggantikan pesan error membingungkan) */
function offlineView() {
  const lewatFile = location.protocol === "file:";
  return (
    '<main class="wrap narrow offline"><div class="card">' +
    '<div class="off-ic">' + ic("power") + "</div>" +
    "<h1>Servernya belum menyala</h1>" +
    '<p class="muted">' +
    (lewatFile
      ? "Halaman ini dibuka langsung dari folder (alamat diawali <b>C:/</b>), jadi belum terhubung ke backend."
      : "Aplikasi tidak bisa menghubungi backend.") +
    " Nyalakan dulu, lalu coba lagi.</p>" +
    '<ol class="steps">' +
    "<li><b>Windows:</b> klik dua kali <code>Jalankan.bat</code> di folder utama proyek.</li>" +
    "<li><b>Atau lewat terminal:</b> <code>cd backend</code>, <code>npm install</code>, <code>npm start</code>.</li>" +
    "<li>Biarkan jendela hitam tetap terbuka, lalu klik tombol di bawah.</li></ol>" +
    '<button class="btn btn-primary btn-block" data-act="retry">Coba lagi</button>' +
    '<p class="small muted" style="margin-top:12px">Alamat yang benar: <b>http://localhost:3000</b></p></div></main>'
  );
}
