# Dokumentasi API TitikTemu

Base URL: `http://localhost:3000/api` · Format: JSON · Bahasa pesan error: Indonesia.

Ada tiga kelompok endpoint:

| Kelompok | Awalan | Login? | Dipakai oleh |
|---|---|---|---|
| Publik | `/api/publik` | Sebagian | Customer: lihat jam/PS/ruangan (tanpa login); **daftar, masuk, pesan, riwayat** (login customer) |
| Auth | `/api/auth` | Sebagian | Admin (masuk / keluar) |
| Admin | `/api/admin` | **Ya** (Bearer token) | Admin (melihat riwayat + **memverifikasi pembayaran**) |

Satu-satunya data yang bisa diubah admin adalah status pembayaran Transfer/QRIS (setujui / tolak). Tidak ada endpoint hapus.

Ada **dua jenis token**, keduanya dikirim lewat header `Authorization: Bearer <token>`: token **customer** (dari `/publik/masuk` atau `/publik/daftar`) dan token **admin** (dari `/auth/login`). Token satu peran ditolak (`401`) di endpoint peran lain.

Format error selalu `{ "error": "pesan" }`. Kode status:
`200` OK · `201` dibuat · `400` data tidak valid · `401` belum masuk / login salah · `404` tidak ketemu · `409` bentrok jadwal.

## Aturan penting

- **Total** = (tarif PS + tarif tambahan ruangan) × durasi jam. Tarif PS5 Rp 12.000, PS4 Rp 8.000 per jam. Tambahan ruangan: VVIP 30.000, VIP 15.000, Reguler 0.
- **Bentrok jadwal**: PS atau ruangan yang sama tidak boleh dipesan di rentang waktu yang saling tumpang tindih. Pesanan yang mulai tepat saat pesanan lain selesai **boleh**.
- **Status sewa** dihitung dari waktu (tidak disimpan): `Akan datang` → `Berlangsung` → `Selesai`.
- **Pelanggan** punya akun: no. HP (unik; hanya angkanya dibandingkan, jadi `0812-3456-7890` dan `08123456 7890` dianggap sama) dan password (minimal 6 karakter, disimpan sebagai hash scrypt). **Memesan dan melihat riwayat wajib login.** Customer hanya bisa melihat pesanannya sendiri.
- **Nama ruangan** disimpan juga di tabel `penyewaan` (kolom `nama_ruangan`) sehingga riwayat tetap terbaca walau nama ruangan di master diganti.
- **Bukti bayar** untuk Transfer/QRIS **wajib** dan disimpan **di dalam database** (kolom BLOB `bukti_data`). Database menolak baris Transfer/QRIS tanpa bukti (trigger `bukti_wajib`), jadi aturan ini tetap berlaku walau API dilewati.
- **Pembayaran**:
  - `Tunai` → `Menunggu` (dibayar di kasir), langsung jadi booking.
  - `Transfer` / `QRIS` → customer **wajib** mengirim foto bukti (`buktiData`). Status awal `Verifikasi` (status sewa: `Menunggu verifikasi`). Pesanan **belum jadi booking**: tidak muncul di riwayat admin, tidak dihitung di ringkasan/pendapatan.
  - Admin `setujui` → `Lunas` dan pesanan resmi jadi booking. Admin `tolak` → `Ditolak` (status sewa `Ditolak`), disertai alasan.
  - Selama `Verifikasi`, PS dan ruangan itu **tetap ditahan** supaya tidak dipesan orang lain. Bila `Ditolak`, jadwalnya dibuka lagi.
- Waktu memakai **timestamp milidetik** (`Date.now()` di JavaScript).

---

## Publik (tanpa login)

### GET `/api/publik/info`
Tarif, rekening, dan gambar QRIS toko.
```json
{ "tarif": { "PS5": 12000, "PS4": 8000 },
  "rekening": { "bank": "BCA", "no": "1234567890", "nama": "TitikTemu Rental PS" },
  "qris": null }
```
`qris: null` artinya memakai gambar bawaan `frontend/assets/qris.png`.

### GET `/api/publik/jadwal?hari=<ms tengah malam>&durasi=<jam>`
Jam yang bisa dilihat customer: jam buka **10:00–23:00** pada hari itu, beserta sisa PS dan ruangan yang masih kosong per jam. `hari` = timestamp ms pukul 00:00 hari yang dimaksud (waktu perangkat customer).
```json
{ "hari": 1794009600000, "durasi": 1,
  "jam": [ { "jam": "10:00", "mulai": 1794045600000, "lewat": false, "psKosong": 5, "ruanganKosong": 6, "tersedia": true } ] }
```
`tersedia` = `false` bila jam sudah lewat atau semua PS/ruangan terpakai.

### POST `/api/publik/daftar`
Buat akun customer. Body `{ "nama": "Rizky Pratama", "hp": "0812-3456-7890", "password": "rahasia1", "alamat": "Jakarta" }` (`alamat` opsional). Respons `201`: `{ "token": "…", "pelanggan": { "id", "nama", "hp", "alamat" } }`. Error: `400` (nama kosong, no. HP tidak valid, password < 6), `409` "No. HP ini sudah terdaftar, silakan masuk".

### POST `/api/publik/masuk`
Body `{ "hp": "0812-3456-7890", "password": "123456" }`. Respons sama seperti `daftar`. Salah → `401` `"No. HP atau password salah"`. Akun contoh: `0812-3456-7890 / 123456`.

### POST `/api/publik/keluar` · GET `/api/publik/saya` (login customer)
Keluar (token dimatikan) dan profil customer yang sedang masuk.

### GET `/api/publik/unit?mulai=<ms>&durasi=<jam>`
Semua PS beserta apakah kosong di jendela waktu itu. Tanpa query: mulai sekarang, 1 jam.
```json
[ { "id": "U-02", "jenis": "PS5", "nomor": 2, "kondisi": "baik", "tarif": 12000, "tersedia": true } ]
```
`tersedia` = `false` bila PS sedang servis atau jadwalnya bentrok. Error 400 bila `durasi` di luar 1–12.

### GET `/api/publik/ruangan?mulai=<ms>&durasi=<jam>`
```json
[ { "id": "R-01", "nama": "VVIP Room 1", "tipe": "VVIP", "kapasitas": 8, "tarif": 30000,
    "fasilitas": "TV 65 inci, AC, sofa, kulkas mini", "tersedia": false } ]
```

### POST `/api/publik/pesanan` (login customer)
Customer yang sudah masuk memilih PS + ruangan + jam, dan metode bayar. Nama dan no. HP diambil dari akun. Satu permintaan membuat penyewaan dan pembayaran dalam satu transaksi database.

Body:
```json
{ "idUnit": "U-02", "idRuangan": "R-02", "mulai": 1794013859857, "durasi": 2, "metode": "QRIS",
  "buktiData": "data:image/jpeg;base64,/9j/4AAQ..." }
```
| Field | Aturan |
|---|---|
| `idUnit`, `idRuangan` | harus ada; PS tidak sedang servis |
| `mulai` | timestamp ms; tidak boleh lewat lebih dari 10 menit; maksimal 7 hari ke depan |
| `durasi` | 1–12 jam |
| `metode` | `Tunai`, `Transfer`, atau `QRIS` |
| `buktiData` | **wajib untuk Transfer/QRIS** (`400` "Bukti pembayaran wajib…" bila kosong): data URL gambar (`png`/`jpeg`/`webp`), maks 4 MB, isi file dicek, lalu disimpan di database. Diabaikan untuk Tunai |

Respons `201`:
```json
{ "id": "SW-0009",
  "pelanggan": { "id": "PL-001", "nama": "Rizky Pratama", "hp": "0812-3456-7890", "alamat": "Jakarta Selatan" },
  "unit": { "id": "U-02", "jenis": "PS5", "nomor": 2 },
  "ruangan": { "id": "R-02", "nama": "VVIP Room 2", "tipe": "VVIP" },
  "mulai": 1794013859857, "durasi": 2, "selesai": 1794021059857, "total": 84000, "status": "Menunggu verifikasi",
  "pembayaran": { "id": "PB-0009", "metode": "QRIS", "jumlah": 84000, "status": "Verifikasi", "tanggal": 1793754659881, "adaBukti": true, "buktiNama": "SW-0009.png", "alasan": "" } }
```
Tanpa token: `401`. Error `409`: `{ "error": "PS itu sudah dipesan di jam tersebut, pilih PS atau jam lain" }` (atau untuk ruangan).

### GET `/api/publik/pesanan` (login customer)
Riwayat pesanan **milik customer yang sedang masuk**, terbaru dulu (array, bentuk sama dengan di atas). Dipakai oleh sidebar *Riwayat pemesanan*.

### GET `/api/publik/pesanan/:id` (login customer)
Satu pesanan (untuk struk). Hanya milik sendiri; pesanan orang lain → `404`.

---

## Auth

### POST `/api/auth/login`
```json
{ "username": "admin", "password": "123456" }
```
Respons `200`: `{ "token": "…", "pegawai": { "id": "PG-02", "nama": "Admin", "username": "admin" } }`. Nama atau password salah → `401` `"Nama atau password salah"` (frontend menampilkannya sebagai **"Password/nama salah"**). Password pegawai disimpan sebagai hash.

Akun contoh: `admin / 123456` dan `kasir.dinda / 123456`.

Semua endpoint admin butuh header: `Authorization: Bearer <token>`.

### POST `/api/auth/logout` (login)
`{ "pesan": "Berhasil keluar" }`

### GET `/api/auth/me` (login)
Data pegawai yang sedang masuk.

---

## Admin (wajib login)

Tanpa token admin: `401` `{ "error": "Belum masuk sebagai admin. Kirim header Authorization: Bearer <token>." }`

### GET `/api/admin/riwayat`
Hanya memuat booking sah (Tunai, atau Transfer/QRIS yang sudah `Lunas`). Pesanan `Verifikasi`/`Ditolak` tidak ikut.
Riwayat semua pesanan customer, terbaru dulu. Semua filter opsional dan bisa digabung:

| Query | Contoh | Arti |
|---|---|---|
| `q` | `rizky` | cari di ID sewa, nama, no. HP, nama ruangan |
| `status` | `Berlangsung` | `Akan datang`, `Berlangsung`, `Selesai` |
| `metode` | `QRIS` | `Tunai`, `Transfer`, `QRIS` |
| `tanggal` | `2026-11-04` | pesanan yang mulai pada hari itu (format `YYYY-MM-DD`) |

Respons: array pesanan (bentuk sama dengan respons `POST /publik/pesanan`).

### GET `/api/admin/verifikasi`
Daftar pembayaran Transfer/QRIS yang menunggu disetujui (terlama di atas). Isi sama seperti satu item riwayat.

### GET `/api/admin/bukti/:id`
Foto bukti bayar pesanan `:id` (mis. `SW-0014`), dibaca langsung dari kolom BLOB `pembayaran.bukti_data` di database. Hanya admin. `404` bila tidak ada bukti (pesanan Tunai).

### POST `/api/admin/pembayaran/:id/setujui`
Bukti valid: pembayaran jadi `Lunas`, pesanan resmi jadi booking. `409` bila pembayaran tidak sedang `Verifikasi` (sudah diproses).

### POST `/api/admin/pembayaran/:id/tolak`
Body opsional: `{ "alasan": "Nominal kurang" }` (maks 200 huruf; default "Bukti pembayaran tidak valid"). Pembayaran jadi `Ditolak`, PS dan ruangan dibuka lagi. `409` bila sudah diproses.

### GET `/api/admin/riwayat/:id`
Detail satu pesanan. `404` bila tidak ada.

### GET `/api/admin/ringkasan`
```json
{ "totalPesanan": 9, "berlangsung": 2, "akanDatang": 2, "pesananHariIni": 5, "pendapatanHariIni": 334000,
  "perMetode": [ { "metode": "Tunai", "jumlah": 3 }, { "metode": "Transfer", "jumlah": 2 }, { "metode": "QRIS", "jumlah": 4 } ] }
```

### GET `/api/admin/pelanggan`
Daftar pelanggan dengan `jumlahSewa` dan `totalBelanja`. (Disediakan untuk pengembangan lanjutan; belum dipakai di tampilan.)

---

## Mencoba cepat dengan curl
```bash
curl http://localhost:3000/api/publik/info
curl -X POST http://localhost:3000/api/auth/login -H "content-type: application/json" -d '{"username":"admin","password":"123456"}'
curl http://localhost:3000/api/admin/riwayat -H "Authorization: Bearer <token>"
curl -X POST http://localhost:3000/api/publik/masuk -H "content-type: application/json" -d '{"hp":"0812-3456-7890","password":"123456"}'
```

## Tes otomatis
`cd backend && npm test` (MySQL harus menyala; tes memakai database terpisah `titiktemu_test`) menjalankan 21 tes (login admin dan customer, jadwal jam, bukti wajib di database, nama ruangan, jadwal bentrok, total, hak akses antar peran, setujui/tolak pembayaran, dst) memakai database memori sehingga data asli tidak tersentuh.
