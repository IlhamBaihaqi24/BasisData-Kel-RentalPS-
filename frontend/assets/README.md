# TitikTemu

*Main bareng, pesan gampang*

TitikTemu adalah website pemesanan rental PlayStation. Customer memesan PS (PS4/PS5) dan ruangan (Reguler, VIP, VVIP) secara online lewat kisi jam kosong, lalu membayar secara Tunai, Transfer, atau QRIS. Admin melihat riwayat pesanan dan memverifikasi bukti bayar. Pembayaran bersifat simulasi (tanpa payment gateway).

Tugas kelompok Basis Data A, Program Studi Teknik Informatika, Universitas Pancasila. 
Dosen: Dr. Ir. Iman Paryudi, M.Sc.

> Panduan endpoint ada di [`backend/API.md`](./backend/API.md). Penjelasan database ada di [`docs/DATABASE.md`](./docs/DATABASE.md). Langkah kerja tim dan panduan GitHub ada di [`LANGKAH.md`](./LANGKAH.md).

## Fitur

- Daftar dan masuk sebagai **Customer** (nomor HP dan password). Admin masuk lewat `/#/admin`, dan salah nama atau password menampilkan "Password/nama salah".
- Pesan PS: pilih tanggal dan **jam** (10:00 sampai 23:00, maksimal 7 hari ke depan). Kisi jam menunjukkan sisa PS yang kosong.
- Pilih ruangan beserta tarif tambahan. Total dihitung oleh server: (tarif PS + tambahan ruangan) × durasi.
- Bayar Tunai, Transfer, atau QRIS. Untuk Transfer dan QRIS **bukti bayar wajib** diunggah dan disimpan di database.
- Struk pesanan dan **riwayat pemesanan** di sidebar.
- Admin melihat riwayat (cari dan filter), memeriksa bukti bayar, lalu **Setujui** atau **Tolak**.
- Jadwal PS dan ruangan tidak bisa bentrok, termasuk saat dua orang memesan bersamaan (transaksi dan penguncian baris).
- Tampilan responsif untuk HP dan laptop, mengikuti desain Figma.

## Teknologi

| Bagian | Teknologi |
| :-- | :-- |
| Backend | Node.js 20+, Express 5, REST API (JSON), token login, password di-hash (scrypt) |
| Database | MySQL / MariaDB (paket `mysql2`), dikelola lewat **phpMyAdmin** (XAMPP) |
| Frontend | HTML, CSS, dan JavaScript biasa (tanpa framework) |
| Pengujian | `node:test` (21 tes otomatis) dan uji browser dengan Playwright |
| Desain dan dokumen | Figma (2 sudut pandang), PRD, ERD, UML (Use Case, Class, Sequence) |

Frontend dan backend **terpisah**; satu-satunya penghubung adalah REST API.

## Struktur Folder

```
titiktemu-repo/
├── README.md                          file ini
├── LANGKAH.md                         langkah kerja, pembagian tugas, panduan GitHub
├── Jalankan.bat / Jalankan.sh         peluncur sekali klik
├── package.json
├── .gitignore
│
├── backend/                           REST API (Express + MySQL)
│   ├── package.json
│   ├── .env.contoh                    contoh pengaturan koneksi database
│   ├── API.md                         dokumentasi endpoint
│   ├── src/
│   │   ├── server.js, app.js          titik mulai server dan susunan Express
│   │   ├── db.js                      koneksi MySQL, pembuatan tabel, data contoh
│   │   ├── lihat-db.js                `npm run db`: tampilkan isi tabel di terminal
│   │   ├── util.js                    pembantu (format data sewa, dll.)
│   │   ├── middleware/                auth.js, error.js
│   │   └── routes/                    publik.js, auth.js, admin.js
│   └── tests/
│       └── api.test.js                pengujian endpoint
│
├── database/
│   └── titiktemu.sql                  skema + data contoh (import lewat phpMyAdmin)
│
├── frontend/                          website (JavaScript biasa)
│   ├── index.html, manifest.webmanifest
│   ├── css/                           gaya dipisah per bagian (tokens, layout, booking, admin, dll.)
│   ├── js/
│   │   ├── api.js, app.js, router.js  pemanggilan API, titik mulai, rute
│   │   ├── events.js, ui.js, utils.js
│   │   └── views/                     home, akun, wizard (pesan), orders, admin, offline
│   └── assets/                        logo, sampul game, QRIS
│
└── docs/
    ├── PRD.md, PRD-TitikTemu.docx     Product Requirements Document
    ├── DATABASE.md                    penjelasan tabel dan relasi
    ├── diagram/                       ERD, Use Case, Class, Sequence (.drawio, .svg, .png)
    └── figma/                         desain UI/UX
        ├── customer/                  layar sisi customer
        └── admin/                     layar sisi admin
```

## Menjalankan

Prasyarat: **Node.js 20 atau lebih baru** dan **XAMPP** (untuk MySQL dan phpMyAdmin).

**1. Nyalakan database**
- Buka XAMPP Control Panel, tekan **Start** pada **MySQL** (dan **Apache** bila mau membuka phpMyAdmin).
- *(Opsional)* buka `http://localhost/phpmyadmin`, tab **Import**, pilih `database/titiktemu.sql`. Langkah ini boleh dilewati karena backend membuat database `titiktemu` dan tabelnya sendiri saat pertama dijalankan.

**2. Jalankan aplikasi**
- Windows: klik dua kali `Jalankan.bat`. Mac / Linux: `bash Jalankan.sh`.
- Atau lewat terminal dari folder utama repositori:
```
cd backend
npm install                 # hanya sekali
npm start                   # http://localhost:3000
```
Frontend ikut disajikan oleh backend, jadi cukup buka http://localhost:3000.

- Lihat isi tabel di terminal: `npm run db`
- Pengujian: `npm test` (memakai database terpisah `titiktemu_test`, MySQL harus menyala)
- Pengaturan koneksi bawaan XAMPP: host `127.0.0.1`, port `3306`, user `root`, tanpa password. Kalau berbeda, atur `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (contoh di `backend/.env.contoh`).
- Jangan membuka `frontend/index.html` dengan klik dua kali; halaman butuh server.

**Akun contoh**
- Customer: `0812-3456-7890` / `123456`
- Admin: buka `http://localhost:3000/#/admin`, masuk `admin` / `123456`

## Database

Tujuh tabel: `pegawai`, `pelanggan`, `unit_ps`, `ruangan`, `penyewaan`, `pembayaran`, `pengaturan`, ditambah tabel pencacah ID `urutan`. Relasi memakai foreign key, dan trigger `bukti_wajib` menolak pembayaran Transfer/QRIS tanpa foto bukti. Foto bukti disimpan sebagai `MEDIUMBLOB`. Penjelasan lengkap ada di [`docs/DATABASE.md`](./docs/DATABASE.md).

## Dokumentasi

| Dokumen | Sumber |
| :-- | :-- |
| Product Requirements Document (PRD) | [PRD](./docs/PRD.md) · [DOCX](./docs/PRD-TitikTemu.docx) |
| ERD | [ERD](./docs/diagram/01-ERD.png) |
| Use Case Diagram | [Use Case](./docs/diagram/02-UseCase.png) |
| Class Diagram | [Class](./docs/diagram/03-ClassDiagram.png) |
| Sequence Diagram | [Customer pesan](./docs/diagram/04-Sequence-Customer-Pesan.png) · [Admin riwayat](./docs/diagram/05-Sequence-Admin-Riwayat.png) · [Admin verifikasi](./docs/diagram/06-Sequence-Admin-Verifikasi.png) |
| Desain UI/UX | [Figma](ISI-LINK-FIGMA) |
| Dokumentasi API | [backend/API.md](./backend/API.md) |

## Kontribusi

- Cabang `main` hanya diubah lewat pull request, dengan minimal satu peninjau.
- Nama cabang: `fitur/nama-fitur`, `perbaikan/nama-masalah`, atau `dokumen/nama-dokumen`.
- Sebelum mulai bekerja jalankan `git pull`. Jangan commit `.env`, `node_modules`, atau berkas data database.
- Pembagian tugas per anggota ada di [`LANGKAH.md`](./LANGKAH.md).

## Anggota Kelompok

| No. | Nama | NPM |
|---|---|---|
| 1 | Ilham Baihaqi | 4525210029 |
| 2 | Vika Elda Lestari | 4525210088 |
| 3 | Ardhelia Salsabila | 4525210092 |
| 4 | Rayza Aqsha Aditya | 4525210101 |
| 5 | Khaira Rahma Apriliani | 4525210108 |
| 6 | Ayu Arimbi | 4525210140 |
