// One-off generator: public/icon.svg -> favicon.ico, apple-touch-icon.png,
// icon-512.png. Not part of the build; rerun manually if icon.svg changes.
// Usage: node scripts/generate-icons.mjs
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const svgPath = join(root, "public/icon.svg");
const svg = await readFile(svgPath);

async function renderPng(size) {
  return sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();
}

// Minimal ICO container holding PNG-compressed frames (valid since Vista,
// what every modern browser/OS expects from a favicon.ico).
function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * count;
  let offset = headerSize + dirSize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  for (const { size, buf } of pngBuffers) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height (0 = 256)
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buf.length, 8); // size of image data
    entry.writeUInt32LE(offset, 12); // offset of image data
    dirEntries.push(entry);
    offset += buf.length;
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers.map((p) => p.buf)]);
}

const icoSizes = [16, 32, 48];
const icoPngs = await Promise.all(
  icoSizes.map(async (size) => ({ size, buf: await renderPng(size) }))
);
await writeFile(join(root, "public/favicon.ico"), buildIco(icoPngs));

await writeFile(
  join(root, "public/apple-touch-icon.png"),
  await renderPng(180)
);

await writeFile(join(root, "public/icon-512.png"), await renderPng(512));

console.log("Generated public/favicon.ico, apple-touch-icon.png, icon-512.png");
