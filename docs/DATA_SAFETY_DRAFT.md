# GuruLes — Draft Data Safety Google Play

> Dokumen kerja. Jawaban final harus dicocokkan lagi dengan formulir Data Safety yang tampil di Play Console pada saat submit.

## Data yang diproses GuruLes

### Personal info

GuruLes memproses:
- Nama
- Nomor HP
- User ID internal
- Lokasi/wilayah profil bila diisi pengguna

Tujuan:
- Account management
- App functionality
- Fraud prevention / security
- User support
- Marketplace matching

### Location

GuruLes dapat memproses:
- Approximate location
- Precise location

Catatan:
- Lokasi perangkat hanya diminta ketika pengguna memilih **Gunakan Lokasi Perangkat**.
- Jika izin ditolak, lokasi manual tetap tersedia.
- Lokasi dipakai untuk menghitung jarak dan radius layanan.

Tujuan:
- App functionality
- Personalization / marketplace matching

### Messages

GuruLes memproses:
- Pesan chat dalam aplikasi antara pencari guru dan pengajar.

Tujuan:
- App functionality
- User communication
- Safety / dispute support bila diperlukan

### Photos

GuruLes dapat memproses:
- Foto/avatar pengajar
- Banner/cover pengajar

Tujuan:
- Profile / app functionality

### Financial / purchase-related data

GuruLes menyimpan data transaksi seperti:
- Nilai booking
- Status pembayaran
- Referensi transaksi/pembayaran
- Status payout

GuruLes tidak dimaksudkan menyimpan nomor kartu pembayaran atau kredensial perbankan pengguna di frontend aplikasi.

Tujuan:
- Transaction processing
- Accounting
- Fraud prevention
- Dispute/refund handling

### App activity

GuruLes menyimpan aktivitas fungsional seperti:
- Booking
- Jadwal
- Favorite
- Review
- Referral
- Feedback pilot

Tujuan:
- App functionality
- Product improvement
- Security

## Shared data

Periksa kembali sebelum submit:
- Data yang diperlukan untuk menjalankan layanan dapat diproses oleh penyedia infrastruktur/backend.
- Data booking tertentu terlihat oleh pihak yang terlibat dalam transaksi.
- Jangan menandai data sebagai "shared" atau "not shared" hanya berdasarkan asumsi; ikuti definisi Google Play pada formulir terbaru.

## Encryption and deletion

- Transport: HTTPS.
- Backend: Supabase Auth + RLS.
- Account deletion tersedia:
  - In-app: **Akun Saya → Akun**
  - Web: `https://guru-les-beta.vercel.app/delete-account.html`
- Data pribadi dihapus atau dianonimkan ketika permintaan dipenuhi, kecuali catatan tertentu yang wajib dipertahankan untuk transaksi, keamanan, hukum, akuntansi, refund, atau sengketa.

## Poin yang wajib dicek sebelum submit

1. Pastikan daftar SDK/library final tidak menambah data collection baru.
2. Cocokkan kategori data dengan definisi Data Safety terbaru.
3. Pastikan Privacy Policy sama dengan perilaku aplikasi.
4. Pastikan precise location ditandai optional dan user-initiated.
5. Jangan deklarasikan data kartu kredit jika GuruLes tidak pernah menerimanya.
6. Deklarasikan chat/messages karena isi pesan diproses backend.
7. Deklarasikan user-uploaded images bila avatar/banner tetap aktif.
