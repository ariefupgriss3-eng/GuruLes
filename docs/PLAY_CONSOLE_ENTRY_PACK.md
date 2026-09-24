# GuruLes — Play Console Entry Pack

Dokumen operasional untuk pengisian Google Play Console setelah akun developer aktif.

## 1. Identitas aplikasi

- App name: **GuruLes**
- Default language: **Indonesian (Indonesia) / id-ID**
- App or game: **App**
- Free or paid: **Free**
- Category: **Education**
- Developer / Publisher: **Arieftoteles Production**
- Package name: `com.arieftoteles.gurules`
- Release version: **1.1.8**
- Version code: **12**
- Target SDK: **API 36**
- Minimum SDK: **API 24**

## 2. URL resmi

- Website: `https://guru-les-beta.vercel.app`
- Privacy Policy: `https://guru-les-beta.vercel.app/privacy.html`
- Account deletion: `https://guru-les-beta.vercel.app/delete-account.html`

Kedua URL kebijakan harus tetap dapat diakses tanpa login.

## 3. Store Listing

### App name
GuruLes

### Short description
Temukan guru dan pelatih privat, pilih jadwal dan booking dengan mudah.

### Full description

**GuruLes — Guru tepat, belajar lebih cepat.**

GuruLes adalah marketplace yang mempertemukan murid dan orang tua dengan guru, pengajar, serta pelatih untuk berbagai kebutuhan belajar dan keterampilan.

Cari pengajar berdasarkan bidang, lokasi, jarak, jadwal, metode belajar, tarif, dan profil layanan. Pengguna dapat berkomunikasi dengan pengajar, memilih jadwal yang tersedia, melakukan booking, mengikuti sesi belajar, lalu memberikan review setelah sesi selesai.

GuruLes menyediakan pilihan pengajar untuk pelajaran akademik, bahasa, matematika, teknologi dan komputer, musik, seni, renang, olahraga, bela diri, agama, dan berbagai keterampilan lainnya.

Fitur utama GuruLes meliputi pencarian guru dan pelatih berdasarkan kategori dan lokasi, profil pengajar, jadwal ketersediaan, booking sesi privat, paket belajar beberapa sesi, chat, pengajar favorit, review, referral, serta pengelolaan profil pelajar oleh orang tua atau wali.

GuruLes mendukung pembelajaran ke rumah, di lokasi latihan, maupun daring sesuai layanan yang disediakan masing-masing pengajar.

Akses lokasi hanya digunakan ketika pengguna memilih fitur lokasi perangkat. Jika izin lokasi tidak diberikan, pengguna tetap dapat menentukan wilayah secara manual.

Pengguna dapat meminta penghapusan akun dari aplikasi maupun melalui halaman penghapusan akun GuruLes.

**GuruLes**
Guru tepat, belajar lebih cepat.

**Arieftoteles Production**

## 4. Release notes — Internal Testing

### Release name
GuruLes 1.1.8 (12) — Internal Testing

### Release notes
Rilis awal Android GuruLes untuk pengujian internal.

- Pencarian guru dan pelatih berdasarkan kategori dan lokasi.
- Profil dan verifikasi pengajar.
- Jadwal ketersediaan dan booking.
- Paket belajar 4, 8, dan 12 sesi.
- Chat antara pencari guru dan pengajar.
- Favorit dan review.
- Referral dan Founding Teacher.
- Pengelolaan profil pelajar.
- Permintaan penghapusan akun.
- Perbaikan stabilitas dan kesiapan distribusi Android.

Pembayaran layanan belajar dilakukan langsung antara pengguna dan pengajar. Produk promosi digital GuruLes tidak ditawarkan di build Android Play Store v1.1.8.

## 5. App Access

GuruLes memiliki bagian yang membutuhkan login.

Pilih:
- **All or some functionality is restricted**

Siapkan satu akun reviewer khusus sebelum submit ke Google.

Akun reviewer harus:
- aktif;
- tidak membutuhkan OTP;
- tidak membutuhkan verifikasi admin tambahan;
- dapat login dengan nomor/ID dan password;
- mempunyai akses cukup untuk meninjau alur utama aplikasi.

Jangan menyimpan password reviewer di repository.

Instruksi reviewer yang dimasukkan ke Play Console:

> Masuk menggunakan akun reviewer yang disediakan. Setelah login, reviewer dapat melihat dashboard pengguna, mencari pengajar, melihat profil, jadwal, dan alur booking. Tidak diperlukan OTP, kode undangan, atau perangkat khusus.

## 6. Ads

Untuk build Android Play Store v1.1.8:
- **Contains ads: No**

Alasan:
- slot sponsor tidak ditampilkan di build native Android;
- monetisasi sponsor tetap berada di kanal web/PWA pada release ini.

Jika iklan native Android diaktifkan pada versi mendatang, jawaban ini harus diperbarui sebelum rilis.

## 7. Data Safety — draft operasional

Jawaban utama:
- **Does your app collect or share required user data types? Yes**
- **Is all user data encrypted in transit? Yes**
- **Do users have a way to request deletion of their data? Yes**

Data yang diproses:

### Personal info
- Name
- Phone number
- User IDs
- Address / service-area style location text bila diisi pengguna

Tujuan:
- App functionality
- Account management
- Fraud prevention / security
- User support

### Location
- Approximate location
- Precise location

Catatan:
- hanya ketika pengguna memilih fitur lokasi perangkat;
- lokasi manual tetap tersedia;
- dipakai untuk pencarian dan perhitungan jarak.

Tujuan:
- App functionality
- Personalization / marketplace matching

### Messages
- In-app chat antara pencari guru dan pengajar

Tujuan:
- App functionality
- User communication
- Safety / dispute handling

### Photos
- Avatar / foto profil
- Banner / cover pengajar bila digunakan

Tujuan:
- App functionality
- Profile presentation

### Financial / purchase-related information
GuruLes dapat menyimpan:
- nilai booking;
- status transaksi;
- referensi pembayaran.

GuruLes tidak menyimpan nomor kartu atau kredensial perbankan pengguna pada frontend.

### App activity
- Booking
- Jadwal
- Favorite
- Review
- Referral
- Feedback

Tujuan:
- App functionality
- Product improvement
- Security

Catatan penting:
- Jawaban final untuk "shared" harus mengikuti definisi Google Play pada formulir saat submit.
- Transfer data yang dilakukan pengguna secara sengaja kepada pengajar/pencari guru harus dinilai berdasarkan definisi Play Console yang tampil saat itu.
- Jangan mengurangi deklarasi hanya agar formulir lebih sederhana.

## 8. Content Rating — profil konten GuruLes

Karakter aplikasi:
- marketplace pendidikan;
- tidak menyediakan perjudian;
- tidak menyediakan pornografi;
- tidak menyediakan penjualan narkotika/alkohol;
- tidak menyediakan kekerasan sebagai konten aplikasi.

Fitur interaksi:
- **User interaction: Yes**
- **User-generated content: Yes**, karena terdapat profil, chat, dan review.

Untuk kategori sensitif seperti bahasa kasar, kekerasan, seksual, perjudian, dan zat terkontrol:
- jawab berdasarkan konten yang disediakan oleh aplikasi;
- jangan menganggap chat pengguna sebagai konten editorial GuruLes;
- ikuti pertanyaan spesifik IARC yang muncul di Play Console.

## 9. Target audience

GuruLes adalah aplikasi pendidikan dan marketplace jasa.

Draft target:
- pengguna dewasa/orang tua/wali;
- guru/pengajar/pelatih;
- siswa dapat menjadi penerima layanan belajar.

Jangan memilih kategori "Designed for Families" kecuali seluruh persyaratan program keluarga telah sengaja dipenuhi dan ditinjau kembali.

Jika Play Console meminta rentang usia, pilih berdasarkan model akun dan kebijakan produk yang benar-benar digunakan pada saat submit.

## 10. Android permissions

Build v1.1.8 menggunakan:
- `android.permission.INTERNET`
- `android.permission.ACCESS_COARSE_LOCATION`
- `android.permission.ACCESS_FINE_LOCATION`

Tidak ada permission push notification native pada release ini.

## 11. Payment policy profile

Di build Android Play Store v1.1.8:
- pembayaran les/pelatihan adalah transaksi layanan belajar langsung antara pengguna dan pengajar;
- Boost, Featured, GuruLes Pro, Rate Card digital, dan checkout eksternal untuk benefit digital tidak ditampilkan;
- slot sponsor juga tidak ditampilkan.

Jangan menambahkan tombol/link dalam build Android yang mengarahkan pengguna membeli benefit digital melalui checkout eksternal.

## 12. Internal Testing

Gunakan file:
`app-release.aab`

Release:
- Version name: **1.1.8**
- Version code: **12**

Uji minimal:
- cold start;
- register/login/logout;
- pencarian pengajar;
- GPS allow;
- GPS deny + lokasi manual;
- profil pengajar;
- jadwal;
- booking;
- paket 4/8/12 sesi;
- chat;
- favorite;
- review;
- referral;
- account deletion;
- privacy policy;
- background/resume;
- koneksi putus/lambat.

## 13. Closed Testing

Jika akun developer terkena persyaratan closed testing untuk akun personal baru:
- rekrut sedikitnya 15 orang agar tersedia cadangan;
- target operasional: 5 pengajar + 10 pencari guru;
- jangan meminta tester keluar dari program sebelum masa pengujian yang diwajibkan selesai.

## 14. Aset yang harus tersedia

- App icon: 512 x 512
- Feature graphic: 1024 x 500
- Phone screenshots: gunakan screenshot asli aplikasi Android
- Screenshot harus menunjukkan UI aktual, bukan mockup yang menyesatkan

Prioritas screenshot:
1. Home / pencarian pengajar
2. Filter lokasi dan kategori
3. Profil pengajar
4. Jadwal
5. Booking
6. Dashboard pengguna
7. Chat
8. Referral / Pertumbuhan

## 15. Urutan eksekusi setelah akun developer aktif

1. Create app GuruLes.
2. Lengkapi identitas dasar.
3. Internal testing → Create new release.
4. Aktifkan Play App Signing.
5. Upload AAB v1.1.8 (12).
6. Tambahkan tester internal.
7. Isi App Access.
8. Isi Ads.
9. Isi Content Rating.
10. Isi Data Safety.
11. Isi Target Audience.
12. Isi Store Listing.
13. Upload icon, feature graphic, dan screenshot.
14. Tambahkan Privacy Policy.
15. Submit Internal Testing.
16. Pasang dari link tester dan lakukan smoke test.
17. Perbaiki blocker bila ada.
18. Lanjut Closed Testing / Production sesuai status akun Play Console.
