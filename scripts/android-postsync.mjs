import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = path.join(root, 'android');
const appDir = path.join(androidDir, 'app');
const resDir = path.join(appDir, 'src', 'main', 'res');

if (!fs.existsSync(androidDir)) {
  throw new Error('Folder android belum ada. Jalankan "npm run android:init" terlebih dahulu.');
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const versionCode = Number(process.env.ANDROID_VERSION_CODE || 1);
const versionName = String(process.env.ANDROID_VERSION_NAME || pkg.version || '1.0.0');

if (!Number.isInteger(versionCode) || versionCode < 1) {
  throw new Error('ANDROID_VERSION_CODE harus berupa bilangan bulat >= 1.');
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function replaceOrThrow(content, regex, replacement, label) {
  if (!regex.test(content)) {
    throw new Error('Tidak menemukan pola ' + label + '. Template Android mungkin berubah.');
  }
  return content.replace(regex, replacement);
}

// Google Play mulai 31 Agustus 2026 mewajibkan aplikasi baru menargetkan API 36+.
const variablesFile = path.join(androidDir, 'variables.gradle');
let variables = read(variablesFile);
variables = variables
  .replace(/minSdkVersion\s*=\s*\d+/, 'minSdkVersion = 24')
  .replace(/compileSdkVersion\s*=\s*\d+/, 'compileSdkVersion = 36')
  .replace(/targetSdkVersion\s*=\s*\d+/, 'targetSdkVersion = 36');
write(variablesFile, variables);

// Versi aplikasi + release signing dari environment variables.
const gradleFile = path.join(appDir, 'build.gradle');
let gradle = read(gradleFile);
gradle = gradle
  .replace(/versionCode\s+\d+/, 'versionCode ' + versionCode)
  .replace(/versionName\s+["'][^"']+["']/, 'versionName "' + versionName + '"');

if (!gradle.includes('GURULES_SIGNING_PATH')) {
  gradle = replaceOrThrow(
    gradle,
    /apply plugin: 'com\.android\.application'\s*/,
    "apply plugin: 'com.android.application'\n\n// GURULES_SIGNING_PATH\ndef gurulesKeystorePath = System.getenv('ANDROID_KEYSTORE_PATH')\n",
    'apply plugin Android'
  );
}

if (!gradle.includes('GURULES_SIGNING_CONFIG')) {
  gradle = replaceOrThrow(
    gradle,
    /\n\s*buildTypes\s*\{/,
    `
    // GURULES_SIGNING_CONFIG
    signingConfigs {
        release {
            if (gurulesKeystorePath) {
                storeFile file(gurulesKeystorePath)
                storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
                keyAlias System.getenv('ANDROID_KEY_ALIAS')
                keyPassword System.getenv('ANDROID_KEY_PASSWORD')
            }
        }
    }

    buildTypes {`,
    'buildTypes'
  );
}

if (!gradle.includes('GURULES_RELEASE_SIGNING')) {
  gradle = replaceOrThrow(
    gradle,
    /(buildTypes\s*\{\s*release\s*\{)/,
    `$1
            // GURULES_RELEASE_SIGNING
            if (gurulesKeystorePath) {
                signingConfig signingConfigs.release
            }`,
    'release buildType'
  );
}
write(gradleFile, gradle);

// Permission minimum untuk WebView + GPS native.
const manifestFile = path.join(appDir, 'src', 'main', 'AndroidManifest.xml');
let manifest = read(manifestFile);
const permissions = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
];
for (const permission of permissions) {
  if (!manifest.includes(permission)) {
    manifest = manifest.replace(
      '</manifest>',
      '    <uses-permission android:name="' + permission + '" />\n</manifest>'
    );
  }
}
if (!manifest.includes('android:usesCleartextTraffic=')) {
  manifest = manifest.replace(
    'android:allowBackup="true"',
    'android:allowBackup="true"\n        android:usesCleartextTraffic="false"'
  );
}
write(manifestFile, manifest);

// Branding launcher icon dari icon PWA yang sama.
const iconSource = path.join(root, 'public', 'icons', 'gurules-512.png');
if (!fs.existsSync(iconSource)) {
  throw new Error('Icon PWA public/icons/gurules-512.png tidak ditemukan.');
}

const drawableNoDpi = path.join(resDir, 'drawable-nodpi');
fs.mkdirSync(drawableNoDpi, { recursive: true });

// Re-encode agar PNG web menjadi PNG Android yang deterministik dan aman untuk AAPT2.
await sharp(iconSource)
  .resize(512, 512, { fit: 'contain', background: '#F5FBFF' })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(path.join(drawableNoDpi, 'gurules_icon.png'));

const launcherSizes = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

for (const [density, size] of Object.entries(launcherSizes)) {
  const dir = path.join(resDir, 'mipmap-' + density);
  fs.mkdirSync(dir, { recursive: true });
  for (const name of ['ic_launcher.png', 'ic_launcher_round.png']) {
    await sharp(iconSource)
      .resize(size, size, { fit: 'contain', background: '#F5FBFF' })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(path.join(dir, name));
  }
}

write(
  path.join(resDir, 'drawable', 'gurules_launcher_foreground.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<inset xmlns:android="http://schemas.android.com/apk/res/android"
    android:drawable="@drawable/gurules_icon"
    android:inset="18%" />
`
);

const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/gurules_launcher_background" />
    <foreground android:drawable="@drawable/gurules_launcher_foreground" />
</adaptive-icon>
`;
write(path.join(resDir, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptive);
write(path.join(resDir, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptive);

write(
  path.join(resDir, 'values', 'gurules_colors.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="gurules_launcher_background">#F5FBFF</color>
    <color name="gurules_splash_background">#F5FBFF</color>
</resources>
`
);

// Hilangkan splash bawaan Capacitor lalu gunakan splash GuruLes sederhana dan aman.
const baseSplashPng = path.join(resDir, 'drawable', 'splash.png');
if (fs.existsSync(baseSplashPng)) fs.rmSync(baseSplashPng);

if (fs.existsSync(resDir)) {
  for (const entry of fs.readdirSync(resDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('drawable-')) continue;
    const candidate = path.join(resDir, entry.name, 'splash.png');
    if (fs.existsSync(candidate)) fs.rmSync(candidate);
  }
}

write(
  path.join(resDir, 'drawable', 'splash.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item>
        <shape android:shape="rectangle">
            <solid android:color="@color/gurules_splash_background" />
        </shape>
    </item>
    <item android:gravity="center" android:width="160dp" android:height="160dp">
        <bitmap android:src="@drawable/gurules_icon" android:gravity="center" />
    </item>
</layer-list>
`
);

const stylesFile = path.join(resDir, 'values', 'styles.xml');
let styles = read(stylesFile);
styles = styles.replace(
  /<style name="AppTheme\.NoActionBarLaunch" parent="Theme\.SplashScreen">[\s\S]*?<\/style>/,
  `<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">@color/gurules_splash_background</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/gurules_icon</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>`
);
write(stylesFile, styles);

console.log(
  'GuruLes Android siap: API 36, versionCode=' +
    versionCode +
    ', versionName=' +
    versionName +
    (process.env.ANDROID_KEYSTORE_PATH ? ', release signing=ON' : ', release signing=OFF')
);
