const sharp=require('sharp');
const path=require('node:path');
(async()=>{
 const tiles=[];
 for(const [i,name] of ['a','b','c'].entries()) {
  const x=i*300;
  for(const [size,left,top] of [[208,46,60],[60,76,292],[32,184,306]]) {
   const mask=Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size*.225}" fill="white"/></svg>`);
   tiles.push({input:await sharp(path.join(__dirname,`${name}.svg`)).resize(size,size).composite([{input:mask,blend:'dest-in'}]).png().toBuffer(),left:x+left,top});
  }
 }
 const labels=Buffer.from(`<svg width="900" height="400"><g font-family="Helvetica,Arial,sans-serif" fill="#183C4B" text-anchor="middle"><text x="150" y="35" font-size="18">A · Gentle sway</text><text x="450" y="35" font-size="18">B · Rooted palm</text><text x="750" y="35" font-size="18">C · Windward sweep</text><g font-size="12" fill="#526973"><text x="150" y="383">60 px / 32 px</text><text x="450" y="383">60 px / 32 px</text><text x="750" y="383">60 px / 32 px</text></g></g></svg>`);
 tiles.push({input:labels,left:0,top:0});
 await sharp({create:{width:900,height:400,channels:4,background:'#E8EEEE'}}).composite(tiles).png().toFile(path.join(__dirname,'../../docs/icon-options.png'));
})();
