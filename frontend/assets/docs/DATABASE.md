# Database TitikTemu (MySQL + phpMyAdmin)

Database: **MySQL / MariaDB** bernama `titiktemu`, dikelola lewat **phpMyAdmin** (paket XAMPP). Backend terhubung memakai paket `mysql2`
(bawaan XAMPP: host `127.0.0.1`, port `3306`, user `root`, tanpa password). Skema ada di `database/titiktemu.sql` dan di `backend/src/db.js`.
Frontend tidak menyentuh database langsung; semuanya lewat REST API.

## Cara melihat tabel (untuk asdos / dosen)
**Cara 1, phpMyAdmin (utama):**
1. XAMPP Control Panel: Start **Apache** dan **MySQL**.
2. Buka `http://localhost/phpmyadmin` → pilih database **titiktemu** di sebelah kiri.
3. Tab **Struktur** menampilkan kolom, tipe, dan kunci; tab **Telusuri** menampilkan isi tabel; tab **Desainer** (pada database) menampilkan **relasi antartabel** seperti ERD.
4. Belum ada database? Tab **Import** → pilih `database/titiktemu.sql` → **Import** (membuat 7 tabel + data contoh). Atau cukup jalankan backend sekali, database terbentuk otomatis.

**Cara 2, terminal:**
```
cd backend
npm run db              # semua tabel: kolom, isi, dan relasi foreign key
```

## 7 tabel dan field-nya
| Tabel | Field (PK = primary key, FK = foreign key) |
|---|---|
| **pelanggan** | `id_pelanggan` PK (PL-001) · `nama` · `no_hp` (UNIQUE) · `alamat` · `password` (hash scrypt, untuk login customer) |
| **unit_ps** | `id_unit` PK (U-01) · `jenis` (PS5 / PS4) · `nomor` · `kondisi` (baik / rusak ringan) · UNIQUE(jenis, nomor) |
| **ruangan** | `id_ruangan` PK (R-01) · `nama` (UNIQUE) · `tipe` (VVIP / VIP / Reguler) · `kapasitas` · `tarif_tambahan` · `fasilitas` |
| **penyewaan** | `id_sewa` PK (SW-0001) · `id_pelanggan` FK → pelanggan · `id_unit` FK → unit_ps · `id_ruangan` FK → ruangan · **`nama_ruangan`** (salinan nama ruangan saat dipesan) · `mulai` (BIGINT, timestamp ms) · `durasi` (jam) · `total` |
| **pembayaran** | `id_bayar` PK (PB-0001) · `id_sewa` FK → penyewaan (UNIQUE) · `tanggal` (BIGINT, timestamp ms) · `metode` (Tunai / Transfer / QRIS) · `jumlah` · `status` (Menunggu / Verifikasi / Lunas / Ditolak) · `alasan` (bila ditolak) · **`bukti`** (nama berkas) · **`bukti_tipe`** (image/png, image/jpeg, image/webp) · **`bukti_data`** (MEDIUMBLOB: isi foto bukti bayar) |
| **pegawai** | `id_pegawai` PK · `username` (UNIQUE) · `password` (hash scrypt) · `nama` |
| **pengaturan** | `kunci` PK · `nilai` (tarif PS, rekening, QRIS dalam JSON) |

(Tabel kecil `urutan` hanya pencatat nomor ID berikutnya.)

**Aturan di tingkat database:** *trigger* MySQL `bukti_wajib` menolak `INSERT` ke `pembayaran` bila `metode` Transfer/QRIS tetapi `bukti_data` kosong. Jadi bukti bayar wajib walau seseorang memakai SQL langsung. Tunai tidak butuh bukti (dibayar di kasir).

## Relasi
```
pelanggan 1 ─────< penyewaan >───── 1 unit_ps
                       │ N
                       ├────────── 1 ruangan
                       │ 1
                       └─ 1 pembayaran (berisi foto bukti)
```
- Satu **pelanggan** bisa punya banyak **penyewaan** (1 : N).
- Satu **unit_ps** dan satu **ruangan** bisa dipakai di banyak penyewaan pada jam yang berbeda (1 : N). Sistem menolak jam yang tumpang tindih.
- Satu **penyewaan** punya tepat satu **pembayaran** (1 : 1, dijamin `UNIQUE id_sewa`).
- Tabel **pegawai** dan **pengaturan** berdiri sendiri (login admin dan tarif).

## Saat customer memesan, field apa yang terisi?
Customer **login dulu** (akunnya ada di tabel `pelanggan`: nama, no. HP, password), lalu memilih PS, ruangan, jam, durasi, dan metode bayar (Transfer/QRIS: wajib unggah foto bukti). Satu kali klik "pesan" menyimpan dua baris sekaligus dalam satu **transaksi**:

**0. `pelanggan`** (dibuat saat *Daftar*, bukan saat memesan)
| id_pelanggan | nama | no_hp | alamat | password |
|---|---|---|---|---|
| PL-001 | Rizky Pratama | 0812-3456-7890 | Jakarta Selatan | `3f9a…:b71c…` (hash) |

**1. `penyewaan`**
| id_sewa | id_pelanggan | id_unit | id_ruangan | nama_ruangan | mulai | durasi | total |
|---|---|---|---|---|---|---|---|
| SW-0009 | PL-001 | U-02 (PS5 · 02) | R-02 | VVIP Room 2 | 1794074627187 | 2 | 84000 |

`total` dihitung server: (tarif PS5 12.000 + tarif ruangan VVIP 30.000) × 2 jam = 84.000.
`mulai` berupa timestamp (milidetik); kalau diubah ke tanggal dan jam, hasilnya jam mulai yang dipilih customer.

**2. `pembayaran`**
| id_bayar | id_sewa | tanggal | metode | jumlah | status | bukti | bukti_tipe | bukti_data |
|---|---|---|---|---|---|---|---|---|
| PB-0009 | SW-0009 | 1794066627187 | QRIS | 84000 | Verifikasi | SW-0009.jpg | image/jpeg | `<BLOB 182340 byte>` |

Tunai berstatus `Menunggu` (dibayar di kasir, tanpa bukti). Transfer/QRIS berstatus `Verifikasi` sampai admin memeriksa bukti: **Setujui** → `Lunas`, **Tolak** → `Ditolak` (+ `alasan`).

## Query contoh (riwayat yang dilihat admin)
```sql
SELECT s.id_sewa, p.nama, p.no_hp, u.jenis, u.nomor, s.nama_ruangan,
       s.durasi, s.total, b.metode, b.status
FROM penyewaan s
JOIN pelanggan p ON p.id_pelanggan = s.id_pelanggan
JOIN unit_ps  u ON u.id_unit      = s.id_unit
JOIN pembayaran b ON b.id_sewa    = s.id_sewa
ORDER BY s.mulai DESC;
```
Pengecekan jadwal bentrok (PS yang sama di jam beririsan):
```sql
SELECT 1 FROM penyewaan s JOIN pembayaran b ON b.id_sewa = s.id_sewa
WHERE s.id_unit = 'U-01' AND b.status <> 'Ditolak'
  AND s.mulai < :akhir AND s.mulai + s.durasi * 3600000 > :mulai;
```

## Kenapa MySQL (bukan SQLite)
Versi sebelumnya memakai SQLite. Proyek ini dipindah ke **MySQL** karena materi kuliah memakai MySQL dan phpMyAdmin, dan karena MySQL lebih sesuai bila dipakai banyak pengguna sekaligus.
Perubahan teknis yang ikut terjadi:
- Tipe kolom: ID `VARCHAR`, waktu `BIGINT`, pilihan tetap memakai `ENUM` (`jenis`, `tipe`, `metode`, `status`), foto bukti `MEDIUMBLOB`.
- Relasi memakai `FOREIGN KEY` pada mesin **InnoDB**; pemesanan berjalan dalam **transaksi** dan baris PS / ruangan dikunci (`SELECT ... FOR UPDATE`) sehingga dua pesanan bersamaan tidak bisa mengambil PS yang sama.
- Backend otomatis menaikkan `max_allowed_packet` (batas ukuran paket MySQL) menjadi 16 MB supaya foto bukti sampai 4 MB bisa disimpan.

## Catatan jujur
- Password pegawai dan customer disimpan sebagai **hash scrypt** (bukan teks biasa). Akun contoh memakai password `123456`.
- Foto bukti bayar disimpan di database (`MEDIUMBLOB`, maks. 16 MB per foto; aplikasi membatasi 4 MB). Cukup untuk skala toko kecil; untuk skala besar lazimnya foto disimpan di penyimpanan file/cloud dan database hanya menyimpan alamatnya.
- User `root` tanpa password hanya cocok untuk komputer belajar. Untuk server sungguhan buat user khusus dan atur `DB_USER` / `DB_PASSWORD`.
- Alamat dan no. HP customer tersimpan; admin hanya bisa membacanya lewat API (tidak bisa mengubah).
- Tes otomatis memakai database terpisah `titiktemu_test` (dihapus dan dibuat ulang tiap `npm test`), jadi data asli aman.
