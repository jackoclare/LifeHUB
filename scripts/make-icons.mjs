// Generates the app icons in public/icons from an SVG.
// Usage: node scripts/make-icons.mjs   (needs the `sharp` package)
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const out = new URL("../public/icons/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const svg = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff8a5c"/>
      <stop offset="1" stop-color="#e8452a"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="#0c0d10"/>
  <g transform="translate(${pad} ${pad}) scale(${(1024 - pad * 2) / 1024})">
    <rect x="152" y="152" width="720" height="720" rx="190" fill="url(#g)"/>
    <path d="M330 690V340h70l112 160 112-160h70v350h-82V480l-100 140-100-140v210z" fill="#fff"/>
  </g>
</svg>`;

const jobs = [
  ["icon-192.png", 192, 0],
  ["icon-512.png", 512, 0],
  ["apple-touch-icon.png", 180, 0],
  ["icon-maskable-512.png", 512, 90],
];

for (const [name, size, pad] of jobs) {
  await sharp(Buffer.from(svg(pad))).resize(size, size).png().toFile(out + name);
  console.log("wrote", name);
}
