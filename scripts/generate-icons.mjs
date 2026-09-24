import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'assets', 'gurules-icon.svg');
const outputDir = path.join(root, 'public', 'icons');

fs.mkdirSync(outputDir, { recursive: true });

for (const size of [192, 512]) {
  await sharp(source, { density: 384 })
    .resize(size, size, { fit: 'cover' })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(outputDir, `gurules-${size}.png`));
}

console.log('GuruLes icons generated: 192x192, 512x512');
