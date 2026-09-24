# GuruLes — Play Store Release Checklist

## Release identity

- App name: **GuruLes**
- Publisher: **Arieftoteles Production**
- Package/Application ID: `com.arieftoteles.gurules`
- Version name awal: `1.0.0`
- Version code awal: `1`
- Target SDK: **Android 16 / API 36**
- Minimum SDK: **API 24**
- Production web/PWA: `https://guru-les-beta.vercel.app`
- Privacy policy: `https://guru-les-beta.vercel.app/privacy.html`

> Package ID tidak boleh diubah setelah aplikasi pertama kali diterbitkan di Google Play.

## 1. Upload Key

Upload key GuruLes tidak disimpan di repository.

Gunakan paket privat:
`GuruLes_Android_Upload_Key_SECURE.zip`

Di dalamnya terdapat:
- `gurules-upload-key.jks`
- `gurules-upload-certificate.pem`
- `GITHUB_SECRETS.txt`
- petunjuk penyimpanan

Simpan minimal dua backup privat. Jangan kirim private keystore melalui chat publik, email massal, atau repository.

## 2. GitHub Repository Secrets

Buka:

**GitHub → ariefupgriss3-eng/GuruLes → Settings → Secrets and variables → Actions → New repository secret**

Tambahkan persis empat secret berikut memakai nilai dari `GITHUB_SECRETS.txt`:

1. `ANDROID_KEYSTORE_BASE64`
2. `ANDROID_KEYSTORE_PASSWORD`
3. `ANDROID_KEY_ALIAS`
4. `ANDROID_KEY_PASSWORD`

Jangan menaruh nilainya di source code, issue, pull request, atau file repository.

## 3. Build signed AAB

Setelah secrets tersedia:

**Actions → Build Android AAB (signed) → Run workflow**

Untuk rilis pertama:
- `version_code = 1`
- `version_name = 1.0.0`

Artifact:
`gurules-signed-aab-v1.0.0-1`

Isi utama:
- `app-release.aab`
- `app-release.aab.sha256`

Workflow juga melakukan verifikasi signature sebelum artifact diunggah.

Untuk rilis berikutnya:
- versionCode **harus selalu naik**: 2, 3, 4, ...
- versionName mengikuti versi produk: 1.0.1, 1.1.0, 2.0.0, dst.

## 4. Android permissions

Release GuruLes menggunakan permission minimum:

- `android.permission.INTERNET`
- `android.permission.ACCESS_COARSE_LOCATION`
- `android.permission.ACCESS_FINE_LOCATION`

Lokasi hanya dipakai saat pengguna memilih **Gunakan Lokasi Perangkat**. Pengguna tetap dapat memakai lokasi manual bila permission lokasi ditolak.

Belum ditambahkan permission push notification karena GuruLes saat ini menggunakan notifikasi dalam aplikasi. Tambahkan hanya jika push notification native benar-benar diimplementasikan.

## 5. Native branding

Build Android memakai aset branding yang sama dengan PWA:

- launcher icon: `public/icons/gurules-512.png`
- background: `#F5FBFF`
- splash: icon GuruLes di atas background GuruLes
- app name: `GuruLes`

Script `scripts/android-postsync.mjs` menerapkan:
- API 36
- versionCode/versionName
- signing config
- permission GPS
- launcher/adaptive icon
- splash
- cleartext HTTP disabled

## 6. Testing sebelum upload Play Console

Uji di perangkat Android nyata:

- install dan cold start
- login/logout
- registrasi orang tua/murid
- registrasi pengajar
- GPS permission allow
- GPS permission deny + lokasi manual
- cari pengajar dan radius
- jadwal
- paket 4/8/12 sesi
- booking
- chat
- pembayaran eksternal
- kembali ke aplikasi setelah pembayaran
- konfirmasi sesi
- review
- feedback pilot
- notifikasi dalam aplikasi
- kebijakan privasi
- rotasi/background/resume
- koneksi lambat dan koneksi putus

## 7. Play Console

Untuk aplikasi baru:

1. Buat aplikasi **GuruLes**.
2. Gunakan package `com.arieftoteles.gurules`.
3. Aktifkan **Play App Signing**.
4. Upload signed `app-release.aab`.
5. Isi Store Listing.
6. Isi App Content / Data Safety berdasarkan data yang benar-benar diproses GuruLes.
7. Cantumkan URL Privacy Policy.
8. Isi Content Rating dan Target Audience.
9. Mulai dari **Internal testing**.
10. Lanjut Closed testing / Production setelah pilot Android stabil.

## 8. Data Safety — bahan pengisian

Periksa kembali di Play Console sebelum submit. GuruLes saat ini dapat memproses:

- data akun/profil
- nomor kontak/login yang digunakan sistem
- profil pengajar dan pelajar
- lokasi perkiraan/presisi ketika pengguna memberi izin
- booking dan jadwal
- referensi/status pembayaran
- chat
- review dan feedback
- data teknis keamanan/operasional

Tujuan utama:
- fungsi aplikasi
- pencocokan lokasi
- transaksi/booking
- komunikasi
- keamanan
- dukungan pengguna
- peningkatan produk

Jangan menyatakan data yang tidak benar-benar dikumpulkan, dan jangan mengurangi deklarasi untuk data yang memang diproses.

## 9. Aturan keamanan release

- Jangan commit keystore.
- Jangan commit password.
- Jangan commit service-role key Supabase.
- Jangan mengubah RLS demi kebutuhan Android.
- Jangan menonaktifkan HTTPS.
- Jangan menyimpan data transaksi kritis di cache PWA/native.
- Upload key dan Play App Signing key harus dipisahkan pengelolaannya.
