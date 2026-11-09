# Product Requirement Document (PRD)
## TitikTemu: Pemesanan Rental PlayStation

| | |
|----------|----------|
| Mata kuliah | Basis Data A, Teknik Informatika, Universitas Pancasila |
| Dosen | Dhandi Adam |
| Kelompok | Ilham Baihaqi (4525210029), Vika Elda Lestari (4525210088), Ardhelia Salsabila (4525210092), Rayza Aqsha Aditya (4525210101), Khaira Rahma Apriliani (4525210108), Ayu Arimbi (4525210140) |
| Versi | 2.1 (revisi: customer unggah bukti bayar, admin memverifikasi pembayaran) |

## 1. Ringkasan produk
TitikTemu adalah aplikasi web rental PlayStation. **Customer** memesan sendiri dari HP atau laptop: mengisi data diri, memilih PS dan jam main, memilih ruangan (VVIP / VIP / Reguler), lalu membayar (Tunai, Transfer, atau QRIS). Untuk Transfer dan QRIS, customer **wajib mengunggah bukti bayar** dan pesanannya berstatus *Menunggu verifikasi* (belum jadi booking). **Admin** masuk dengan akun pegawai, **memeriksa bukti bayar lalu menyetujui atau menolaknya**, dan melihat riwayat pesanan tanpa mengisi data ulang.

## 2. Latar belakang dan masalah
Rental PlayStation yang masih mencatat di buku sering salah hitung tarif, tidak tahu PS atau ruangan mana yang kosong pada jam tertentu, dan sulit mencari riwayat pelanggan. Customer juga harus datang atau menghubungi dulu hanya untuk tahu ketersediaan.

## 3. Tujuan dan ukuran keberhasilan
| Tujuan | Ukuran |
|-----------------------------------------------|-------------------------------------------------------------|
| Customer bisa memesan tanpa bantuan kasir | Pesanan selesai dalam 4 langkah, kurang dari 2 menit |
| Tidak ada PS atau ruangan yang dipesan ganda | Sistem menolak jadwal yang tumpang tindih (409) |
| Total bayar selalu benar | Dihitung server: (tarif PS + tarif ruangan) x jam |
| Admin cepat menemukan riwayat | Pencarian dan filter, hasil kurang dari 1 detik |
| Pembayaran Transfer / QRIS tidak otomatis lunas | Wajib bukti; status Lunas hanya setelah admin menyetujui |
| Admin tidak mengubah data selain pembayaran | Satu-satunya endpoint tulis admin: setujui / tolak pembayaran |

## 4. Pengguna
| Peran | Kebutuhan | Hak akses |
|----------|----------------------------------------------------------------------|-------------------------------------------------------------|
| Customer | Memesan PS dan ruangan, membayar, melihat struk, mengecek pesanannya | Tanpa login; dikenali dari no. HP |
| Admin | Memverifikasi bukti bayar (setujui / tolak), melihat semua riwayat pesanan, mencari, memfilter, melihat detail | Login ID pegawai + PIN; **baca + setujui / tolak pembayaran** |

## 5. Ruang lingkup
**Termasuk:** beranda dengan sampul game dan tarif; pemesanan 4 langkah; ketersediaan PS dan ruangan per jam; pembayaran Tunai / Transfer / QRIS dengan unggah bukti bayar; status *Menunggu verifikasi*; verifikasi pembayaran oleh admin (lihat bukti, setujui, tolak); struk; cek pesanan lewat no. HP; login admin; riwayat dengan pencarian, filter, dan detail; REST API dan dokumentasinya; desain Figma 2 POV.

**Tidak termasuk (versi ini):** verifikasi pembayaran otomatis dari bank / QRIS (verifikasi dilakukan admin secara manual lewat bukti), unggah ulang bukti setelah ditolak, batas waktu otomatis untuk pesanan yang menunggu verifikasi, pembatalan atau perubahan pesanan, pengaturan tarif lewat layar, manajemen master PS / ruangan lewat layar (diisi lewat data awal), notifikasi WhatsApp, laporan bulanan. Katalog game bukan fitur; sampul game hanya tampil di beranda.

## 6. Alur utama
**A. Customer memesan PS**

1. Beranda → *Pesan sekarang*.
2. **Data diri:** nama, no. HP, alamat (opsional).
3. **PS dan jam:** pilih hari (hari ini sampai 2 hari ke depan), jam mulai, durasi 1–12 jam, lalu PS yang kosong.
4. **Ruangan:** pilih ruangan yang kosong di jam itu.
5. **Bayar:** ringkasan dan total, pilih Tunai / Transfer / QRIS. Untuk Transfer / QRIS, **unggah foto bukti bayar** dulu; tombol *Saya sudah bayar* baru bisa dipakai setelah bukti dipilih. Tunai cukup menekan *Pesan sekarang*.
6. **Struk** tampil. Tunai berstatus *Menunggu* (bayar di kasir); Transfer / QRIS berstatus **Menunggu verifikasi** sampai admin menyetujui. Status bisa dicek lagi lewat tombol *Perbarui status* atau *Cek pesanan saya* dengan no. HP. Bila ditolak, struk menampilkan alasannya.

**B. Admin memverifikasi pembayaran**

1. Buka halaman admin, masuk dengan ID pegawai dan PIN.
2. Panel **Menunggu verifikasi** menampilkan pesanan Transfer / QRIS yang belum disetujui (diperbarui otomatis tiap 10 detik).
3. Klik *Periksa bukti*, cocokkan nominal dan waktu pada foto bukti.
4. Tekan **Setujui** (pembayaran jadi Lunas, pesanan resmi jadi booking) atau **Tolak** dengan alasan (pesanan batal, PS dan ruangan dibuka lagi).

**C. Admin melihat riwayat**

1. Lihat ringkasan (total pesanan, berlangsung, akan datang, pendapatan hari ini); hanya booking yang sah yang dihitung.
2. Cari / filter status, metode bayar, tanggal.
3. Klik satu baris untuk melihat detail (data customer, PS, ruangan, waktu, pembayaran, bukti bila ada).

## 7. Kebutuhan fungsional
| Kode | Kebutuhan | Prioritas |
|----------|----------------------------------------------------------------------|-----------|
| C-01 | Beranda menampilkan sampul game dan tarif per jam | Sedang |
| C-02 | Customer mengisi nama dan no. HP (alamat opsional) dengan validasi | Tinggi |
| C-03 | Customer memilih hari, jam mulai, durasi, dan melihat PS kosong / terpakai / servis | Tinggi |
| C-04 | Customer memilih ruangan; ruangan terpakai tidak bisa dipilih | Tinggi |
| C-05 | Sistem menghitung total otomatis | Tinggi |
| C-06 | Pembayaran Tunai (bayar di kasir), Transfer (nomor rekening), QRIS (gambar QRIS) | Tinggi |
| C-07 | Struk dapat dilihat dan disalin | Sedang |
| C-08 | Cek pesanan lewat no. HP; struk hanya terbuka bila no. HP cocok | Sedang |
| C-09 | Sistem menolak PS atau ruangan yang jadwalnya bentrok | Tinggi |
| C-10 | Transfer / QRIS wajib mengunggah foto bukti bayar sebelum menekan *Saya sudah bayar* | Tinggi |
| C-11 | Struk dan *Pesanan saya* menampilkan status Menunggu verifikasi / Lunas / Ditolak (beserta alasan) | Tinggi |
| A-01 | Admin login dengan ID pegawai dan PIN; logout | Tinggi |
| A-02 | Ringkasan angka di atas riwayat | Sedang |
| A-03 | Daftar riwayat pesanan, terbaru di atas | Tinggi |
| A-04 | Pencarian (nama, no. HP, ID, ruangan) dan filter status, metode, tanggal | Sedang |
| A-05 | Detail satu pesanan | Tinggi |
| A-06 | Admin tidak dapat menambah atau menghapus data; satu-satunya perubahan adalah status pembayaran (A-09, A-10) | Tinggi |
| A-07 | Panel *Menunggu verifikasi* berisi pesanan Transfer / QRIS yang belum diproses | Tinggi |
| A-08 | Admin melihat foto bukti bayar (hanya admin yang bisa membukanya) | Tinggi |
| A-09 | Admin menyetujui bukti: pembayaran Lunas dan pesanan resmi jadi booking | Tinggi |
| A-10 | Admin menolak bukti dengan alasan: pesanan batal dan jadwal dibuka lagi | Tinggi |

## 8. Aturan bisnis

1. Total = (tarif PS + tarif tambahan ruangan) x durasi. Tarif PS5 Rp 12.000/jam, PS4 Rp 8.000/jam. Tambahan ruangan: VVIP Rp 30.000, VIP Rp 15.000, Reguler Rp 0.
2. Satu PS dan satu ruangan tidak boleh dipakai dua pesanan di waktu yang tumpang tindih. Pesanan yang mulai tepat saat pesanan lain selesai diperbolehkan.
3. PS berkondisi "rusak ringan" tidak bisa dipesan.
4. Pelanggan dikenali dari no. HP (hanya angka dibandingkan). Pelanggan baru dibuat otomatis.
5. Status sewa dihitung dari waktu: *Akan datang*, *Berlangsung*, *Selesai*.
6. Status pembayaran: Tunai *Menunggu* (dibayar di kasir); Transfer dan QRIS dimulai dari *Verifikasi* (menunggu admin), lalu *Lunas* bila disetujui atau *Ditolak* bila ditolak.
7. Pemesanan maksimal 7 hari ke depan; jam mulai tidak boleh sudah lewat.
8. Pesanan berstatus *Verifikasi* **belum jadi booking**: tidak muncul di riwayat, tidak dihitung di ringkasan dan pendapatan, dan statusnya *Menunggu verifikasi*. Namun PS dan ruangan tetap **ditahan** agar tidak dipesan orang lain; bila *Ditolak*, jadwalnya dibuka lagi.
9. Hanya pembayaran berstatus *Verifikasi* yang bisa disetujui atau ditolak; yang sudah diproses ditolak sistem (409).
10. Bukti bayar berupa gambar PNG / JPG / WEBP maksimal 4 MB; jenis file dicek dari isinya.

## 9. Kebutuhan non-fungsional

- Frontend dan backend **terpisah**, komunikasi lewat REST API (JSON).
- Tampilan responsif: nyaman di HP dan laptop.
- Data di database SQLite; pembuatan pesanan memakai transaksi (semua tersimpan atau tidak sama sekali).
- Endpoint admin dilindungi token; customer tidak bisa membuka riwayat orang lain. Foto bukti bayar disimpan sebagai berkas di server dan hanya bisa dibuka admin.
- Pesan error berbahasa Indonesia yang jelas; bila server belum menyala, tampil layar petunjuk, bukan pesan teknis.
- Bisa dijalankan dengan sekali klik (`Jalankan.bat`).

## 10. Arsitektur dan teknologi
```
[Browser: HTML + CSS + JavaScript]  --HTTP JSON-->  [Backend Node.js + Express]  -->  [SQLite]
        frontend/                                          backend/                     backend/data/
```

- Frontend: JavaScript biasa (tanpa framework), halaman tunggal dengan router hash.
- Backend: Node.js 22, Express 5, SQLite (`node:sqlite`).
- Dokumentasi endpoint: `backend/API.md`. Tes otomatis: `npm test` (16 tes).

## 11. Data
Tabel: **Pelanggan, Unit_PS, Ruangan, Penyewaan, Pembayaran, Pegawai, Pengaturan**. ERD: `docs/diagram/01-ERD.svg`.

Perubahan dari laporan awal:
| Laporan awal | Sekarang | Alasan |
|----------------------------------|----------------------------------------------------------------------|----------------------------------------------------------------------|
| Tabel Game dan Detail_Game | Dihapus | Game tidak menjadi fitur sewa; diganti pilihan ruangan |
| (belum ada) | Tabel Ruangan; Penyewaan memiliki id_ruangan | Customer memilih ruangan (VVIP Room 1 dst) |
| Penyewaan: tanggal_sewa, jam_mulai | Satu kolom `mulai` (timestamp) | Memudahkan pengecekan bentrok jadwal |
| Pembayaran tanpa status | Ditambah `status` (Menunggu / Verifikasi / Lunas / Ditolak), `bukti`, `alasan` | Membedakan Tunai di kasir, Transfer / QRIS yang menunggu admin, serta menyimpan bukti dan alasan penolakan |
| (belum ada) | Tabel Pengaturan | Menyimpan tarif PS, rekening, QRIS |

## 12. Desain UI (Figma)
Dua Section pada satu halaman Figma:

- **POV Customer (HP), 31 layar:** Beranda, Data diri (kosong / galat / terisi), PS dan jam (hari ini, besok, pilih jam, durasi, PS terpakai / servis), Ruangan (termasuk ruangan terpakai), Bayar (QRIS / Transfer / Tunai, masing-masing Transfer / QRIS dengan kotak unggah bukti dan versi bukti sudah dipilih), Struk (Transfer / QRIS *Menunggu verifikasi*, Tunai, salin, dan dari Pesanan saya termasuk versi *Ditolak*), Pesanan saya (kosong, galat, hasil dengan status menunggu / ditolak, tidak ada).
- **POV Admin (Laptop), 18 layar:** Login (termasuk PIN salah), Riwayat pesanan (semua, filter status, filter metode bayar, pencarian, hasil kosong), Detail pesanan (akan datang, berlangsung, selesai), serta alur verifikasi: Riwayat + panel Menunggu verifikasi, Periksa bukti bayar (tombol Setujui / Tolak), dan hasil setelah disetujui atau ditolak.
- Prototype dapat diklik penuh (405 tautan); jalur mengikuti satu contoh pesanan, pilihan yang menghitung dan menyimpan ada di aplikasi web.

Layar disimpan sebagai SVG di `docs/figma/customer` dan `docs/figma/admin`; plugin pembuat halaman Figma ada di `docs/figma/plugin`.

## 13. Diagram
| Diagram | Berkas |
|----------------------------------------|-----------------------------------------------|
| ERD | `docs/diagram/01-ERD.svg` |
| Use Case | `docs/diagram/02-UseCase.svg` |
| Class | `docs/diagram/03-ClassDiagram.svg` |
| Sequence: Customer memesan | `docs/diagram/04-Sequence-Customer-Pesan.svg` |
| Sequence: Admin melihat riwayat | `docs/diagram/05-Sequence-Admin-Riwayat.svg` |
| Sequence: Admin memverifikasi pembayaran | `docs/diagram/06-Sequence-Admin-Verifikasi.svg` |

Sumber yang bisa diedit: `docs/diagram/TitikTemu-Diagram.drawio` (buka di app.diagrams.net, 6 halaman).

## 14. Pengujian

- Otomatis: 16 tes API (total, bentrok jadwal PS / ruangan, validasi termasuk bukti bayar, pesanan lewat no. HP, hak akses admin, alur setujui / tolak, riwayat tidak memuat pesanan yang belum disetujui).
- Manual: alur customer dan admin di HP dan laptop (daftar centang di `LANGKAH.md`).

## 15. Kriteria selesai

- Semua kebutuhan C-01 sampai A-06 dapat didemokan.
- `npm test` lolos.
- Aplikasi berjalan lewat `Jalankan.bat` dan `http://localhost:3000`.
- Setiap anggota memiliki Pull Request yang sudah di-merge.

## 16. Risiko dan batasan
| Risiko | Penanganan |
|------------------------------------------------------------------|----------------------------------------------------------------------|
| Node.js di laptop anggota terlalu lama | Wajib Node.js 22 LTS; server memberi pesan jelas bila versi lama |
| Bukti bayar palsu atau tidak sesuai | Admin mencocokkan nominal dan waktu sebelum menyetujui; verifikasi otomatis dengan bank dicatat sebagai pengembangan lanjutan |
| Pesanan menunggu verifikasi menahan PS / ruangan tanpa batas waktu | Admin menolak bukti yang tidak valid; batas waktu otomatis dicatat sebagai pengembangan lanjutan |
| Token admin hilang saat server dimulai ulang | Admin tinggal login lagi (token disimpan di memori) |

## 17. Riwayat revisi
| Versi | Isi |
|----------|----------------------------------------------------------------------|
| 1.0 | Aplikasi kasir: pegawai mengisi data penyewa lalu memilih PS dan ruangan |
| 2.0 | Customer memesan sendiri; admin hanya melihat riwayat; jadwal bentrok dicek per jam; Figma 2 POV |
| 2.1 | Transfer / QRIS wajib unggah bukti dan berstatus Menunggu verifikasi; admin menyetujui atau menolak; ERD, Use Case, Class, Sequence, dan Figma diperbarui |

## 18. Pembagian tugas
Lihat `LANGKAH.md` di folder utama repo.
