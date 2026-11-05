import test from 'node:test';import assert from 'node:assert/strict';import {readFile,access} from 'node:fs/promises';import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);const catalog=JSON.parse(await readFile(new URL('papers/library.json',root)));
test('light reading views keep every original embedded image byte-for-byte',async()=>{
 for(const paper of catalog.papers){
  const dir=new URL(`papers/${paper.id}/`,root),original=await readFile(new URL('reading.html',dir),'utf8'),view=await readFile(new URL('view.html',dir),'utf8');
  const images=[...original.matchAll(/<img\b[^>]*\bsrc=["']data:image\/([^;,]+);base64,([A-Za-z0-9+/=\s]+)["'][^>]*>/g)];
  const targets=[...view.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)];assert.equal(targets.length,images.length);
  for(let i=0;i<images.length;i++){const binary=Buffer.from(images[i][2],'base64'),saved=await readFile(new URL(targets[i][1],dir));assert.equal(createHash('sha256').update(saved).digest('hex'),createHash('sha256').update(binary).digest('hex'));}
 }
});
test('reading entry HTML is small and all local script/style links resolve',async()=>{
 for(const paper of catalog.papers){
  const dir=new URL(`papers/${paper.id}/`,root),view=await readFile(new URL('view.html',dir),'utf8'),original=await readFile(new URL('reading.html',dir));
  assert.ok(Buffer.byteLength(view)<100000);assert.ok(Buffer.byteLength(view)<original.length*.15);
  assert.equal(/data:font\//.test(view),false);assert.equal(/<img\b[^>]*src=["']data:/.test(view),false);
  for(const link of view.matchAll(/(?:src|href)=["'](\.\.\/\.\.\/[^"']+)["']/g))await access(new URL(link[1],dir));
  assert.ok(paper.readerURL.endsWith('/view.html'));
 }
});
