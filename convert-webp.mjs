const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, 'images');
let converted = 0;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { walk(full); continue; }
    const ext = path.extname(e.name).toLowerCase();
    if (['.jpg', '.jpeg', '.png'].includes(ext)) {
      const webpName = e.name.replace(ext, '.webp');
      const webpPath = path.join(dir, webpName);
      if (fs.existsSync(webpPath)) continue; // skip if already exists
      sharp(full)
        .webp({ quality: 82, effort: 4 })
        .toFile(webpPath)
        .then(() => { converted++; })
        .catch(err => console.error('Error:', e.name, err.message));
    }
  }
}

walk(IMAGES_DIR);
console.log('Conversion complete!');
