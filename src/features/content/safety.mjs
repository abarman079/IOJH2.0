/** Security-sensitive, browser-free primitives used by C06 code and Node unit tests. */
export const RESERVED_CMS_SLUGS = new Set([
  'admin','api','account','auth','cart','checkout','sign-in','sign-up','forgot-password','reset-password',
  'verify-email','en','bn','_next','favicon','robots','sitemap','search','media','preview','cms'
]);
export function validCmsSlug(value) {
  return typeof value === 'string' && value.length <= 90 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && !RESERVED_CMS_SLUGS.has(value);
}
export function safeCmsHref(value) {
  if (typeof value !== 'string' || value.length > 300 || /[\\\x00-\x1f\x7f<>]/.test(value)) return false;
  if (/^\/(?!\/)[a-zA-Z0-9/_-]+$/.test(value) && !value.includes('..')) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.port &&
      parsed.hostname.includes('.') && !/^(localhost|127\.|10\.|192\.168\.)/.test(parsed.hostname) &&
      !/[\\<>]/.test(parsed.href) && parsed.href === value;
  } catch { return false; }
}
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
function u32(b, pos) { return b.readUInt32BE(pos); }
function pngCrc32(b,start,end){let crc=0xffffffff;for(let i=start;i<end;i++){crc^=b[i];for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function fail() { throw new Error('Image type, dimensions, or signature rejected'); }
function dimensions(w,h) { if(!w||!h||w>6000||h>6000||w*h>20000000) fail(); return {width:w,height:h}; }
/** Checks magic bytes, structural bounds and obvious metadata/animation hazards. No SVG. */
export function inspectImage(input, mime) {
 const b=Buffer.isBuffer(input)?input:Buffer.from(input);
 if (b.length < 64 || b.length > MAX_IMAGE_BYTES) fail();
 if (mime === 'image/png') {
   if (!b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) fail();
   if(u32(b,8)!==13||b.toString('ascii',12,16)!=='IHDR') fail();
   const wh=dimensions(u32(b,16),u32(b,20));
   let off=8,ended=false,idat=false;
   while(off+12<=b.length){const len=u32(b,off),type=b.toString('ascii',off+4,off+8);
     if(len>b.length-off-12||pngCrc32(b,off+4,off+8+len)!==u32(b,off+8+len)||!['IHDR','PLTE','IDAT','IEND','tRNS','gAMA','sRGB','pHYs'].includes(type))fail();
     if(type==='IDAT')idat=true;
     if(type==='IEND'){if(len!==0||off+12!==b.length)fail();ended=true;break;}
     off+=12+len;
   }
   if(!ended||!idat)fail();
   return {ext:'png',...wh};
 }
 if(mime==='image/jpeg'){
   if(b[0]!==0xff||b[1]!==0xd8||b[b.length-2]!==0xff||b[b.length-1]!==0xd9)fail();
   let pos=2,wh=null;
   while(pos+4<b.length){if(b[pos]!==0xff){break;}let marker=b[pos+1];pos+=2;
     if(marker===0xd9||marker===0xda)break;
     if(marker>=0xd0&&marker<=0xd7)continue;
     if(pos+2>b.length)fail();const len=b.readUInt16BE(pos);
     if(len<2||pos+len>b.length)fail();
     if(marker===0xe1||marker===0xed)fail(); // Reject EXIF and Photoshop segments.
     if([0xc0,0xc1,0xc2,0xc3].includes(marker)){
       if(len<7)fail();wh=dimensions(b.readUInt16BE(pos+5),b.readUInt16BE(pos+3));
     }
     pos+=len;
   }
   if(!wh)fail();return {ext:'jpg',...wh};
 }
 if(mime==='image/webp'){
   if(b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WEBP'||b.readUInt32LE(4)!==b.length-8)fail();
   const kind=b.toString('ascii',12,16);
   if(!['VP8 ','VP8L','VP8X'].includes(kind)||b.includes(Buffer.from('EXIF'))||b.includes(Buffer.from('ANIM'))||b.includes(Buffer.from('XMP ')))fail();
   // The chunk parser below limits the first chunk, and checks dimensions for VP8X.
   const size=b.readUInt32LE(16);if(size+20>b.length)fail();
   let wh;
   if(kind==='VP8X'){if(size<10||b[20]&2)fail();wh=dimensions(1+b.readUIntLE(24,3),1+b.readUIntLE(27,3));}
   else if(kind==='VP8L'){if(size<5||b[20]!==0x2f)fail();const bits=b.readUInt32LE(21);wh=dimensions((bits&0x3fff)+1,((bits>>14)&0x3fff)+1);}
   else {if(size<10||b[23]!==0x9d||b[24]!==0x01||b[25]!==0x2a)fail();wh=dimensions(b.readUInt16LE(26)&0x3fff,b.readUInt16LE(28)&0x3fff);}
   return {ext:'webp',...wh};
 }
 fail();
}
