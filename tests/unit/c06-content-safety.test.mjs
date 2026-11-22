import test from 'node:test';
import assert from 'node:assert/strict';
import {safeCmsHref,validCmsSlug,inspectImage,MAX_IMAGE_BYTES} from '../../src/features/content/safety.mjs';

test('reserved and unsafe slugs are rejected',()=>{
 for(const bad of ['admin','api','account','cms','sign-in','Bad Slug','../files','foo/bar','a'.repeat(91)])assert.equal(validCmsSlug(bad),false,bad);
 for(const good of ['research-evidence','field-study-2026','knowledge'])assert.equal(validCmsSlug(good),true,good);
});
test('safe href allowlist excludes script protocols, credentials and traversal',()=>{
 for(const bad of ['javascript:alert(1)','//evil.example','/foo/../admin','https://u:p@example.com/','http://example.com','data:text/html;base64','/a\\b','https://localhost/x'])assert.equal(safeCmsHref(bad),false,bad);
 assert.equal(safeCmsHref('/en/contact'),true);
 assert.equal(safeCmsHref('https://example.org/research'),true);
});
test('upload size and signature guard rejects SVG and fake PNG',()=>{
 assert.equal(MAX_IMAGE_BYTES,4194304);
 assert.throws(()=>inspectImage(Buffer.from('<svg></svg>'),'image/png'));
 assert.throws(()=>inspectImage(Buffer.alloc(128),'image/png'));
 assert.throws(()=>inspectImage(Buffer.alloc(MAX_IMAGE_BYTES+1),'image/png'));
});
test('PNG validates header, dimensions, and requires IDAT/IEND chunks',()=>{
 const head=Buffer.from('89504e470d0a1a0a0000000d4948445200000064000000640806000000','hex');
 assert.throws(()=>inspectImage(Buffer.concat([head,Buffer.alloc(80)]),'image/png'));
});
test('JPEG rejects EXIF segments and forged termination',()=>{
 const b=Buffer.alloc(90,0);b[0]=255;b[1]=216;b[2]=255;b[3]=225;b[4]=0;b[5]=8;b[88]=255;b[89]=217;
 assert.throws(()=>inspectImage(b,'image/jpeg'));
});
test('WebP malformed RIFF envelope fails',()=>{
 const b=Buffer.alloc(90,0);b.write('RIFF');b.write('WEBP',8);b.write('VP8 ',12);
 assert.throws(()=>inspectImage(b,'image/webp'));
});

test('valid PNG, JPEG and WebP fixtures report truthful dimensions',async()=>{
 const {readFile}=await import('node:fs/promises');
 for(const [ext,mime] of [['png','image/png'],['jpg','image/jpeg'],['webp','image/webp']]){
  const bytes=await readFile(new URL(`../fixtures/c06/small.${ext}`,import.meta.url));
  const result=inspectImage(bytes,mime);
  assert.equal(result.ext,ext);assert.equal(result.width,16);assert.equal(result.height,12);
 }
});
test('broken PNG chunk CRC is rejected',async()=>{
 const {readFile}=await import('node:fs/promises');
 const png=Buffer.from(await readFile(new URL('../fixtures/c06/small.png',import.meta.url)));
 png[42]^=4;
 assert.throws(()=>inspectImage(png,'image/png'));
});
