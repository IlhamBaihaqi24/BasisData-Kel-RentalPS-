# LANGKAH: dari sekarang sampai dinilai

## 1. Jalankan dulu (5 menit)
1. Pasang Node.js (versi 20 ke atas) dari https://nodejs.org dan **XAMPP** dari https://www.apachefriends.org (sekali saja).
2. Buka XAMPP Control Panel, **Start MySQL** (dan Apache bila mau membuka phpMyAdmin). Opsional: di `http://localhost/phpmyadmin` pilih **Import** → `database/titiktemu.sql`.
3. Ekstrak zip, klik dua kali `Jalankan.bat` (Mac/Linux: `bash Jalankan.sh`).
4. Browser terbuka di `http://localhost:3000`. Daftar atau masuk sebagai customer (contoh `0812-3456-7890` / `123456`), coba pesan, lalu buka `http://localhost:3000/#/admin` (`admin` / `123456`) dan lihat pesananmu masuk.
5. Jangan buka `frontend/index.html` dengan klik dua kali. Halaman butuh server.

## 2. Siapkan GitHub (satu orang, ketua)
1. Buat repository baru di GitHub (mis. `titiktemu`), undang 5 anggota lain sebagai Collaborator.
2. Di folder proyek: `git init`, `git add .`, `git commit -m "Awal: struktur proyek"`, `git branch -M main`, `git remote add origin <url-repo>`, `git push -u origin main`.

## 3. Pull Request per anggota
Setiap anggota: `git clone <url>` → `git checkout -b nama/tugas` → ubah file bagiannya → `git add .` → `git commit -m "pesan jelas"` → `git push -u origin nama/tugas` → buka **Pull Request** di GitHub → ketua mereview dan **Merge**.

Usulan pembagian (silakan ubah sesuai kesepakatan kelompok). Tiap anggota membuat satu PR kecil yang nyata, misalnya memperbaiki teks, menambah komentar, atau melengkapi dokumen di bagiannya:

| Anggota | Bagian | Berkas |
|---|---|---|
| Ilham Baihaqi | Backend dan API | `backend/src/`, `backend/API.md` |
| Vika Elda Lestari | Frontend customer | `frontend/js/views/home.js`, `wizard.js`, `orders.js` |
| Ardhelia Salsabila | Frontend admin | `frontend/js/views/admin.js`, `frontend/css/admin.css` |
| Rayza Aqsha Aditya | Figma | `docs/figma/` |
| Khaira Rahma Apriliani | ERD, Use Case, Class, Sequence | `docs/diagram/` |
| Ayu Arimbi | PRD dan pengujian | `docs/PRD.md`, `backend/tests/` |

## 4. Figma
Ikuti `docs/figma/BACA-DULU.md` (Cara A pakai plugin, Cara B manual). Hasilnya 2 Section: POV Customer dan POV Admin. Plugin belum pernah diuji di aplikasi Figma asli, jadi kalau ada langkah yang beda, pakai Cara B dan kabari saya.

## 5. Daftar centang sebelum dinilai
- [ ] `npm test` di folder `backend` lolos (21 tes)
- [ ] Customer: pesan PS dengan Tunai (bayar di kasir) lalu Transfer dan QRIS; untuk Transfer/QRIS tombol "Saya sudah bayar" baru jalan setelah foto bukti dipilih, struk berstatus Menunggu verifikasi
- [ ] Pesan PS yang sama di jam yang sama: muncul pesan ditolak
- [ ] Login customer: daftar, masuk, salah password muncul pesan; kisi jam menampilkan sisa PS kosong
- [ ] Sidebar Riwayat pemesanan (tombol Riwayat) menampilkan pesanan sendiri
- [ ] `npm run db pembayaran` menunjukkan kolom `bukti_data` berisi BLOB, `npm run db penyewaan` menunjukkan `nama_ruangan`
- [ ] Admin salah nama/password: muncul "Password/nama salah"
- [ ] Admin: login, panel Menunggu verifikasi muncul, buka bukti, Setujui (jadi Lunas dan masuk riwayat) dan Tolak (muncul alasan di struk customer); cari, filter, buka detail
- [ ] Tampilan nyaman di HP (lebar 390) dan laptop
- [ ] Figma: 2 Section dan prototype bisa di-Present
- [ ] PRD, ERD, Use Case, Class, Sequence, `API.md` sudah dibaca semua anggota
- [ ] Setiap anggota punya PR yang sudah di-merge

## 6. Bahan presentasi
Demo urut: beranda → daftar/masuk → pesan (4 langkah) → struk → admin melihat riwayat → tunjukkan `API.md` dan jalankan `npm test` → tunjukkan Figma dan diagram.
