import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stbDir = path.join(__dirname, '../native/image_compress/third_party/stb');

const files = [
  [
    'stb_image.h',
    'https://raw.githubusercontent.com/nothings/stb/master/stb_image.h',
  ],
  [
    'stb_image_write.h',
    'https://raw.githubusercontent.com/nothings/stb/master/stb_image_write.h',
  ],
];

function download(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

async function main() {
  let need = false;
  for (const [name] of files) {
    const p = path.join(stbDir, name);
    if (!fs.existsSync(p) || fs.statSync(p).size < 1000) {
      need = true;
      break;
    }
  }
  if (!need) {
    process.stderr.write('stb headers already present\n');
    return;
  }

  fs.mkdirSync(stbDir, { recursive: true });

  for (const [name, url] of files) {
    const buf = await download(url);
    fs.writeFileSync(path.join(stbDir, name), buf);
    process.stderr.write(`Wrote ${name} (${buf.length} bytes)\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
