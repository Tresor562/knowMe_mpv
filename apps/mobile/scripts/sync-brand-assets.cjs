/* Generate Android/iOS brand bitmaps from the exact official Web logo.
 * This runs when Expo loads app.config.js; generated PNG files are build artifacts.
 * No new native dependency is required for the existing Expo SDK 53 project.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const MOBILE_ROOT = path.resolve(__dirname, '..');
const SOURCE_LOGO = path.resolve(MOBILE_ROOT, '../web/public/brand/knowme-logo.svg');
const OUTPUT_DIR = path.join(MOBILE_ROOT, 'assets/branding');
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function writeIfChanged(destination, bytes) {
  if (fs.existsSync(destination) && fs.readFileSync(destination).equals(bytes)) return false;
  fs.writeFileSync(destination, bytes);
  return true;
}

function officialPngFromWeb() {
  const svg = fs.readFileSync(SOURCE_LOGO, 'utf8');
  const match = svg.match(/href="data:image\/png;base64,([A-Za-z0-9+/=]+)"/);
  if (!match) throw new Error('KnowMe official Web logo has no embedded PNG');
  const png = Buffer.from(match[1], 'base64');
  if (png.length < 100 || !png.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('KnowMe official logo PNG is invalid');
  }
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (width !== height || width < 192 || height > 4096) {
    throw new Error('KnowMe official logo must be a square raster >= 192px');
  }
  return png;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, bytes) {
  const label = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([label, bytes])));
  return Buffer.concat([length, label, bytes, checksum]);
}

function pngFromRgba(width, height, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const start = y * (1 + width * 4);
    scanlines[start] = 0; // PNG filter None
    pixels.copy(scanlines, start + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(scanlines, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function segmentDistance(x, y, x1, y1, x2, y2) {
  const vx = x2 - x1, vy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((x - x1) * vx + (y - y1) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(x - x1 - t * vx, y - y1 - t * vy);
}

// Android status-bar icons must be flat white silhouettes on a transparent PNG.
// This simplified K is derived from the silhouette of the official KnowMe mark.
function createMonochromeMark(size = 192) {
  const pixels = Buffer.alloc(size * size * 4);
  const strokes = [
    [.335, .265, .335, .755, .065],
    [.385, .515, .680, .255, .064],
    [.385, .515, .680, .755, .064]
  ];
  const samples = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let covered = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const nx = (x + (sx + .5) / samples) / size;
          const ny = (y + (sy + .5) / samples) / size;
          if (strokes.some(([x1, y1, x2, y2, radius]) =>
            segmentDistance(nx, ny, x1, y1, x2, y2) <= radius)) covered++;
        }
      }
      const index = (y * size + x) * 4;
      pixels[index] = pixels[index + 1] = pixels[index + 2] = 255;
      pixels[index + 3] = Math.round(covered / (samples * samples) * 255);
    }
  }
  return pngFromRgba(size, size, pixels);
}

function syncBrandAssets() {
  const source = officialPngFromWeb();
  const monochrome = createMonochromeMark();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const results = {};
  for (const [name, png] of [
    ['knowme-icon.png', source],
    ['knowme-splash.png', source],
    ['knowme-adaptive-foreground.png', source],
    ['knowme-monochrome.png', monochrome],
    ['knowme-notification.png', monochrome]
  ]) {
    const target = path.join(OUTPUT_DIR, name);
    results[name] = { path: target, changed: writeIfChanged(target, png) };
  }
  return results;
}

if (require.main === module) {
  const results = syncBrandAssets();
  process.stdout.write('KnowMe brand assets verified: ' + Object.keys(results).join(', ') + '\n');
}

module.exports = { syncBrandAssets, officialPngFromWeb, createMonochromeMark };
