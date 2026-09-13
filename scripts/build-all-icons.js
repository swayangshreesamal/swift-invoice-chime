import fs from 'fs';
import { execSync } from 'child_process';
import { createPng } from './make-png.js';

// 1. Read squircle-antialiased.png as BMP to manipulate RGBA
execSync('sips -s format bmp scripts/squircle-antialiased.png -o scripts/squircle-antialiased.bmp');
const buf = fs.readFileSync('scripts/squircle-antialiased.bmp');
const offset = buf.readUInt32LE(0x0a);
const srcW = buf.readInt32LE(0x12);
const srcH = Math.abs(buf.readInt32LE(0x16));
const bpp = buf.readUInt16LE(0x1c);
const rowSize = Math.floor((bpp * srcW + 31) / 32) * 4;

console.log('Source size:', srcW, 'x', srcH);

// 2. Center into a square 601 x 601 canvas
const sqSize = Math.max(srcW, srcH); // 601
const padX = Math.floor((sqSize - srcW) / 2); // 13
const padY = Math.floor((sqSize - srcH) / 2); // 0

const transparentSq = Buffer.alloc(sqSize * sqSize * 4, 0);
const solidSq = Buffer.alloc(sqSize * sqSize * 4, 0);

// Default solid background color matching the icon corner green
const cornerGreen = { r: 24, g: 55, b: 39 };

for (let y = 0; y < sqSize; y++) {
  for (let x = 0; x < sqSize; x++) {
    const dstIdx = (y * sqSize + x) * 4;

    const srcX = x - padX;
    const srcY = y - padY;

    if (srcX >= 0 && srcX < srcW && srcY >= 0 && srcY < srcH) {
      const pos = offset + srcY * rowSize + srcX * (bpp / 8);
      const b = buf[pos];
      const g = buf[pos + 1];
      const r = buf[pos + 2];
      const a = bpp === 32 ? buf[pos + 3] : 255;

      transparentSq[dstIdx] = r;
      transparentSq[dstIdx + 1] = g;
      transparentSq[dstIdx + 2] = b;
      transparentSq[dstIdx + 3] = a;

      if (a < 255) {
        // Blend with corner green for solid iOS icon
        const alphaFrac = a / 255;
        solidSq[dstIdx] = Math.round(r * alphaFrac + cornerGreen.r * (1 - alphaFrac));
        solidSq[dstIdx + 1] = Math.round(g * alphaFrac + cornerGreen.g * (1 - alphaFrac));
        solidSq[dstIdx + 2] = Math.round(b * alphaFrac + cornerGreen.b * (1 - alphaFrac));
        solidSq[dstIdx + 3] = 255;
      } else {
        solidSq[dstIdx] = r;
        solidSq[dstIdx + 1] = g;
        solidSq[dstIdx + 2] = b;
        solidSq[dstIdx + 3] = 255;
      }
    } else {
      // Outside padding
      transparentSq[dstIdx] = 0;
      transparentSq[dstIdx + 1] = 0;
      transparentSq[dstIdx + 2] = 0;
      transparentSq[dstIdx + 3] = 0;

      solidSq[dstIdx] = cornerGreen.r;
      solidSq[dstIdx + 1] = cornerGreen.g;
      solidSq[dstIdx + 2] = cornerGreen.b;
      solidSq[dstIdx + 3] = 255;
    }
  }
}

// 3. Write intermediate master PNGs
const transMasterPng = createPng(sqSize, sqSize, transparentSq);
fs.writeFileSync('scripts/master-transparent.png', transMasterPng);

const solidMasterPng = createPng(sqSize, sqSize, solidSq);
fs.writeFileSync('scripts/master-solid.png', solidMasterPng);

console.log('Master square PNGs created:', sqSize, 'x', sqSize);

// 4. Generate all production icons using sips high-quality resampling
console.log('Resampling production icons...');

// High-res app icon (1024x1024)
execSync('sips -z 1024 1024 scripts/master-transparent.png -o public/app-icon.png');

// PWA manifest icons
execSync('sips -z 512 512 scripts/master-transparent.png -o public/icon-512.png');
execSync('sips -z 192 192 scripts/master-transparent.png -o public/icon-192.png');

// Apple touch icon (180x180 solid background so iOS does not render black corners)
execSync('sips -z 180 180 scripts/master-solid.png -o public/apple-touch-icon.png');

// Favicons
execSync('sips -z 48 48 scripts/master-transparent.png -o public/favicon-48x48.png');
execSync('sips -z 32 32 scripts/master-transparent.png -o public/favicon-32x32.png');
execSync('sips -z 16 16 scripts/master-transparent.png -o public/favicon-16x16.png');

// Favicon .ico format (32x32)
execSync('sips -s format ico public/favicon-32x32.png -o public/favicon.ico');

// SVG Favicon with high-res embedded PNG
const fav64Png = execSync('sips -z 64 64 scripts/master-transparent.png -o scripts/fav64.png && cat scripts/fav64.png').toString('base64');
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <image width="64" height="64" href="data:image/png;base64,${fav64Png}" />
</svg>
`;
fs.writeFileSync('public/favicon.svg', svgContent);

console.log('All public icon assets generated successfully!');
