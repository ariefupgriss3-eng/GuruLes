# GuruLes Android / AAB

GuruLes memakai satu frontend React/Vite untuk Web, PWA, dan Android. Container Android disiapkan dengan Capacitor v8.

## Identitas aplikasi

- App name: GuruLes
- Application ID: `com.arieftoteles.gurules`
- Web directory: `dist`
- Production web: `https://guru-les-beta.vercel.app`
- Backend: Supabase project GuruLes yang sama dengan PWA

## Persiapan pertama di laptop Windows

1. Install Node.js versi yang didukung Capacitor v8, Android Studio, Android SDK, dan JDK sesuai dokumentasi Capacitor.
2. Di root repository jalankan:
   - `npm install`
   - `npm run android:init`
3. Setelah folder `android/` terbentuk, sinkronkan aplikasi:
   - `npm run android:sync`
4. Buka Android Studio:
   - `npm run android:open`

## Build AAB

Untuk Windows:

```
npm run android:aab:windows
```

Untuk macOS/Linux:

```
npm run android:aab:unix
```

AAB release akan berada di:

`android/app/build/outputs/bundle/release/app-release.aab`

Build release awal bisa belum signed. Untuk Google Play, buat Upload Key/keystore yang hanya dimiliki pemilik aplikasi, lalu konfigurasikan signing release di Android Studio/Gradle. Jangan pernah commit file keystore atau password ke GitHub.

## Sebelum Google Play

- Uji login, GPS, booking, pembayaran, notifikasi, dan feedback pilot pada perangkat Android nyata.
- Pastikan ikon launcher, adaptive icon, splash screen, dan nama aplikasi sudah final.
- Tambahkan privacy policy URL.
- Siapkan Play Console, data safety, content rating, target audience, dan store listing.
- Gunakan package name `com.arieftoteles.gurules` secara permanen; jangan diubah setelah aplikasi diterbitkan.
- Aktifkan Play App Signing saat rilis produksi.


## Build otomatis dari GitHub

Workflow `.github/workflows/android-aab.yml` dapat dijalankan manual dari tab **Actions → Build Android AAB (unsigned) → Run workflow**.

Workflow akan membangun frontend, membuat container Android, menjalankan `bundleRelease`, lalu mengunggah AAB sebagai artifact selama 7 hari. Artifact ini untuk validasi teknis dan belum siap dikirim ke Play Store sampai release signing dengan Upload Key dikonfigurasi.


## Signed release

Signed AAB dibangun melalui workflow:

`.github/workflows/android-signed-aab.yml`

Workflow membutuhkan empat GitHub Actions Repository Secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Upload key **tidak boleh** disimpan di repository.

Android native GuruLes menggunakan:
- Capacitor v8
- target SDK 36
- min SDK 24
- native geolocation plugin dengan fallback lokasi manual
- HTTPS-only WebView
- package `com.arieftoteles.gurules`

Detail rilis terdapat di `docs/PLAY_STORE_RELEASE.md`.
