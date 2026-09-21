/* Original SVG source; Sharp is a build-time tool only, never shipped to users.
 * Run with `node _build/make_icons.cjs` wherever Sharp is installed. */
const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = path.join(__dirname, 'icon.svg');
const version = 'v1.3.0';
(async () => {
  for (const size of [32, 180, 192, 512]) {
    const png = await sharp(source).resize(size, size).png().toBuffer();
    fs.writeFileSync(path.join(root, 'icons', `icon-${version}-${size}.png`), png);
    // Existing bookmarks may retain old icon URLs: update their content too.
    fs.writeFileSync(path.join(root, 'icons', size === 32 ? 'favicon-32.png' : `icon-${size}.png`), png);
    if ([192,512].includes(size)) {
      fs.writeFileSync(path.join(root,'icons',`icon-${version}-${size}-maskable.png`),png);
      fs.writeFileSync(path.join(root,'icons',`icon-${size}-maskable.png`),png);
    }
  }
  // Review the exact shipped pixels at native small sizes and with OS-style masks.
  const composite=[];
  for (const [size,x,y,radius] of [[192,32,34,43],[80,286,90,18],[60,414,100,14],[32,526,114,7],[96,614,82,48]]) {
    const mask=Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="white"/></svg>`);
    const icon=await sharp(source).resize(size,size).composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
    composite.push({input:icon,left:x,top:y});
  }
  await sharp({create:{width:742,height:260,channels:4,background:'#E8EEEE'}}).composite(composite).png().toFile(path.join(root,'docs/icon-preview.png'));
  console.log('Generated original icon at 32, 180, 192, and 512px, including opaque maskable assets.');
})().catch(error=>{console.error(error);process.exitCode=1;});
