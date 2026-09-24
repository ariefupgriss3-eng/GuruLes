# GuruLes — Rencana Testing Google Play

## Tahap 1 — Internal testing

Tujuan:
- Memastikan AAB terpasang dari Google Play.
- Menguji native GPS, login, booking, pembayaran, chat, dan lifecycle Android.

Rekomendasi awal:
- 3–5 perangkat Android berbeda.
- Android versi berbeda bila tersedia.
- Minimal satu akun Pengajar dan dua akun Pencari Guru.

Checklist:
- Install dari link Internal testing
- Login/logout
- Daftar akun
- GPS Allow
- GPS Deny + lokasi manual
- Cari pengajar
- Filter radius
- Chat
- Booking
- Paket 4/8/12 sesi
- Pembayaran
- Background/resume app
- Review
- Feedback Pilot
- Hapus akun / request deletion
- Privacy Policy terbuka
- Tidak ada crash saat cold start

## Tahap 2 — Closed testing (jika diwajibkan akun Play Console)

Untuk akun developer personal baru yang terkena persyaratan Google Play:
- Minimal **12 tester**
- Tester harus opted-in terus menerus
- Durasi minimal **14 hari**
- Setelah syarat terpenuhi, ajukan Production access di Play Console.

Saran GuruLes:
- Rekrut 15 tester agar ada cadangan.
- Komposisi: 5 pengajar + 10 orang tua/murid/pengguna.
- Minta semua tester tetap opted-in sampai masa 14 hari selesai.

## Jadwal 14 hari

Hari 1–2:
- Install
- Login/registrasi
- GPS/lokasi
- Profil

Hari 3–5:
- Search/filter
- Chat
- Favorite
- Jadwal

Hari 6–9:
- Booking
- Paket belajar
- Pembayaran
- Reschedule/cancel

Hari 10–12:
- Konfirmasi sesi
- Review
- Feedback pilot
- Notifikasi

Hari 13–14:
- Pengujian ulang bug yang ditemukan
- Account deletion request
- Pemeriksaan privacy policy
- Final feedback

## Data feedback minimum

Minta tester melaporkan:
- Tipe perangkat
- Versi Android
- Fitur yang diuji
- Berhasil/gagal
- Screenshot bila gagal
- Langkah untuk mereproduksi
- Tingkat keparahan: ringan/sedang/kritis
