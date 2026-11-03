import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const read=(path)=>JSON.parse(readFileSync(resolve(root,path),'utf8'));
const en=read('src/content/fixtures/home.en.json');
const bn=read('src/content/fixtures/home.bn.json');
const messagesEn=read('src/messages/en.json');
const messagesBn=read('src/messages/bn.json');

function fields(obj,prefix=''){
 return Object.entries(obj).flatMap(([key,val])=>{
  const path=prefix?`${prefix}.${key}`:key;
  return val && typeof val==='object' && !Array.isArray(val) ? fields(val,path) : [path];
 }).sort();
}
test('locales expose the same homepage content keys and navigation keys',()=>{
 assert.deepEqual(fields(en),fields(bn));
 assert.deepEqual(fields(messagesEn),fields(messagesBn));
});
test('all seven homepage acts have content in both locales',()=>{
 for(const home of [en,bn]){
  for(const key of ['hero','capabilities','work','learn','publishing','publisher','insights']){
   assert.equal(typeof home[key],'object',`missing ${key}`);
  }
  assert.equal(home.capabilities.items.length,4);
  assert.equal(home.work.items.length,2);
  assert.equal(home.insights.topics.length,3);
  for(const service of home.capabilities.items){
   assert.ok(service.title.trim() && service.desc.trim() && service.href.startsWith('/services/'));
  }
 }
});
test('research/commerce preview never contains invented prices or metrics',()=>{
 const joined=JSON.stringify({en,bn});
 assert.doesNotMatch(joined,/৳\s*\d+|BDT\s*\d+/);
 assert.match(en.publisher.bookNote,/Temporary cover/);
 assert.match(en.publishing.searchDisabled,/not active/);
});
test('approved asset is included and it is a conceptual illustration',()=>{
 const asset=readFileSync(resolve(root,'public/illustrations/atlas-map.svg'),'utf8');
 assert.match(asset,/Conceptual research atlas/);
 assert.match(asset,/<svg/);
});
