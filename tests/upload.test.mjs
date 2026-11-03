import test from 'node:test';
import assert from 'node:assert/strict';
import {GitHubLibrary,toBase64,fromBase64,validateRecord,validateFiles,mergePapers,sha256} from '../upload-core.js';

const token='github_pat_TEST_ONLY_NOT_A_REAL_CREDENTIAL';
const raw={title:'示例研究 / Paper',topic:'事件记忆',readDate:'2026-11-03',year:2026,url:'https://doi.org/10.123/example',notes:'中文与 Unicode 🔬'};
const files={pdf:new TextEncoder().encode('%PDF-1.7\nORIGINAL'),reading:new TextEncoder().encode('<!doctype html><p>中文解读</p>'),cover:Uint8Array.of(137,80,78,71)};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
function backend({race=false,duplicate=false,deny=false,badCatalog=false,writeFailure=false}={}) {
 const requests=[];let ref='base',patched=0;let savedTree=null;
 const fetcher=async(url,options)=>{
  const path=new URL(url).pathname.replace('/repos/Co1dog/paper-library','');
  const body=options.body?JSON.parse(options.body):null;requests.push({path,method:options.method,body,headers:options.headers});
  assert.equal(new URL(url).origin,'https://api.github.com');
  assert.equal(options.headers.Authorization,`Bearer ${token}`);
  if(path==='')return response({owner:{login:'Co1dog'},name:'paper-library',permissions:{push:!deny}});
  if(path==='/git/ref/heads/main')return response({object:{sha:ref}});
  if(path.startsWith('/git/commits/'))return response({tree:{sha:'tree-'+ref}});
  if(path==='/contents/papers/library.json')return response({content:toBase64(new TextEncoder().encode(JSON.stringify(badCatalog?{oops:true}:{version:1,papers:[{id:'existing',title:'Existing paper'},...(ref==='other'?[{id:'concurrent',title:'Concurrent paper'}]:[]),...(duplicate?[{title:raw.title}]:[])]})))});
  if(path==='/git/blobs')return response({sha:'blob-'+requests.length},201);
  if(path==='/git/trees'){savedTree=body;return response({sha:'new-tree'},201);}
  if(path==='/git/commits')return response({sha:'new-commit-'+ref},201);
  if(path==='/git/refs/heads/main'){
   patched++;
   assert.equal(body.force,false);
   if(race&&patched===1){ref='other';return response({message:'not fast forward'},422);}
   if(writeFailure)return response({message:'write forbidden'},403);
   ref=body.sha;return response({object:{sha:ref}});
  }
  throw new Error('Unexpected endpoint '+path);
 };
 return {fetcher,requests,getTree:()=>savedTree};
}
test('UTF-8 and binary bytes survive GitHub base64 transport',()=>{
 const bytes=Uint8Array.from({length:100001},(_,i)=>i%256);
 assert.deepEqual(fromBase64(toBase64(bytes)),bytes);
 assert.equal(new TextDecoder().decode(fromBase64(toBase64(new TextEncoder().encode(raw.notes)))),raw.notes);
});
test('validates public links and rejects unsupported or oversized source files',()=>{
 assert.throws(()=>validateRecord({...raw,url:'javascript:alert(1)'}));
 assert.throws(()=>validateRecord({...raw,readDate:'not-a-date'}));
 assert.throws(()=>validateFiles({name:'x.pdf',size:61*1024*1024},{name:'x.html',size:1}));
 assert.throws(()=>validateFiles({name:'x.exe',size:1},{name:'x.html',size:1}));
 assert.equal(validateRecord(raw).notes,raw.notes);
});
test('refuses a read-only account and clears failed authorization',async()=>{
 const b=backend({deny:true}),client=new GitHubLibrary(b.fetcher);
 await assert.rejects(client.connect(token),/写入权限/);
 assert.equal(client.connected,false);
 await assert.rejects(client.publish(raw,files),/先连接/);
});
test('one commit keeps source bytes, existing catalog and new record together',async()=>{
 const b=backend(),client=new GitHubLibrary(b.fetcher);await client.connect(token);
 const result=await client.publish(raw,files);
 const blobs=b.requests.filter(r=>r.path==='/git/blobs');
 assert.deepEqual(fromBase64(blobs[0].body.content),files.pdf);
 assert.deepEqual(fromBase64(blobs[1].body.content),files.reading);
 const tree=b.getTree();assert.equal(tree.base_tree,'tree-base');assert.equal(tree.tree.length,4);
 const catalog=JSON.parse(tree.tree.find(e=>e.path==='papers/library.json').content);
 assert.equal(catalog.papers.length,2);assert.equal(catalog.papers[0].id,'existing');
 assert.equal(catalog.papers[1].pdfSHA256,await sha256(files.pdf));
 assert.equal(result.record.title,raw.title);
 client.disconnect();assert.equal(client.connected,false);
});
test('concurrent changes are merged without a forced update or lost records',async()=>{
 const b=backend({race:true}),client=new GitHubLibrary(b.fetcher);await client.connect(token);await client.publish(raw,files);
 const tree=b.getTree();assert.equal(tree.base_tree,'tree-other');
 const catalog=JSON.parse(tree.tree.find(e=>e.path==='papers/library.json').content);
 assert.deepEqual(catalog.papers.slice(0,2).map(p=>p.id),['existing','concurrent']);
 assert.equal(b.requests.filter(r=>r.path==='/git/blobs').length,3);
});
test('a malformed catalog or duplicate paper produces no visible write',async()=>{
 for(const config of [{badCatalog:true},{duplicate:true}]) {
  const b=backend(config),client=new GitHubLibrary(b.fetcher);await client.connect(token);
  await assert.rejects(client.publish(raw,files));assert.equal(b.requests.some(r=>r.method==='PATCH'),false);
 }
});
test('failed publication does not report success',async()=>{
 const b=backend({writeFailure:true}),client=new GitHubLibrary(b.fetcher);await client.connect(token);
 await assert.rejects(client.publish(raw,files),/拒绝写入/);
});
test('migration deduplicates legacy Issues while retaining all real papers',()=>{
 const manifest=[{id:'nau-2025',title:'Nau',url:'https://doi.org/nau'}];
 const issues=[{id:'1',title:'Nau',url:'https://doi.org/nau/'},{id:'2',title:'Other',url:'https://doi.org/other'}];
 assert.deepEqual(mergePapers(manifest,issues).map(p=>p.id),['nau-2025','2']);
});
