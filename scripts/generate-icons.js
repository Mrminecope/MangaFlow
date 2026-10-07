import fs from 'fs';
import zlib from 'zlib';
import path from 'path';

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  chunk.writeUInt32BE(crc32(typeAndData), 8 + len);
  return chunk;
}

function createPng(width, height, pixelFn) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const scanlines = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  for (let y = 0; y < height; y++) {
    scanlines[offset++] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      scanlines[offset++] = r;
      scanlines[offset++] = g;
      scanlines[offset++] = b;
      scanlines[offset++] = a;
    }
  }

  const compressed = zlib.deflateSync(scanlines, { level: 9 });
  const idat = createChunk('IDAT', compressed);
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, createChunk('IHDR', ihdr), idat, iend]);
}

function renderMangaIcon(x, y, w, h, maskable = false) {
  const cx = w / 2;
  const cy = h / 2;
  const scale = maskable ? 0.35 : 0.42;
  const radius = w * scale;

  // Background
  const distCenter = Math.hypot(x - cx, y - cy);
  const cornerRadius = w * 0.22;
  
  let bgR = 14, bgG = 14, bgB = 18, bgA = 255;
  if (distCenter < w * 0.48) {
    bgR = 10 + Math.round((1 - y / h) * 12);
    bgG = 12 + Math.round((1 - y / h) * 18);
    bgB = 24 + Math.round((1 - y / h) * 35);
  }

  const nx = (x - cx) / radius;
  const ny = (y - cy) / radius;
  const d = Math.hypot(nx, ny);

  // Outer glowing ring
  if (d >= 0.85 && d <= 1.0) {
    return [56, 189, 248, 255]; // Sky 400
  }
  if (d > 1.0 && d < 1.15) {
    const alpha = Math.max(0, 1 - (d - 1.0) / 0.15);
    return [
      Math.round(bgR * (1 - alpha) + 56 * alpha),
      Math.round(bgG * (1 - alpha) + 189 * alpha),
      Math.round(bgB * (1 - alpha) + 248 * alpha),
      255
    ];
  }

  // Eye shape
  // Upper and lower eye arcs: y^2 + (x * 0.8)^2 <= 0.6
  const eyeArc = Math.abs(ny) - (1 - nx * nx) * 0.45;
  if (eyeArc <= 0.08 && eyeArc >= -0.08 && Math.abs(nx) < 0.85) {
    return [248, 250, 252, 255]; // White eye border
  }

  // Pupil / iris in center
  const irisD = Math.hypot(nx, ny * 1.2);
  if (irisD < 0.28) {
    if (irisD < 0.12) {
      return [10, 15, 30, 255]; // Center pupil
    }
    return [56, 189, 248, 255]; // Sky iris
  }

  // Open pages lines at bottom
  if (ny > 0.45 && ny < 0.75 && Math.abs(nx) < 0.7) {
    const pageCurve = Math.sin(nx * 3) * 0.08;
    if (Math.abs(ny - (0.6 + pageCurve)) < 0.05) {
      return [129, 140, 248, 255]; // Indigo line
    }
  }

  return [bgR, bgG, bgB, bgA];
}

const publicDir = path.resolve('public');
fs.mkdirSync(publicDir, { recursive: true });

// 192x192
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPng(192, 192, (x, y, w, h) => renderMangaIcon(x, y, w, h, false)));
// 512x512
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPng(512, 512, (x, y, w, h) => renderMangaIcon(x, y, w, h, false)));
// 512x512 Maskable (safe zone)
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPng(512, 512, (x, y, w, h) => renderMangaIcon(x, y, w, h, true)));
// apple-touch-icon.png (180x180)
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180, (x, y, w, h) => renderMangaIcon(x, y, w, h, false)));

console.log('Generated all PWA PNG icons successfully!');
