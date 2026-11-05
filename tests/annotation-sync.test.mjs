import test from 'node:test';import assert from 'node:assert/strict';
import {emptyAnnotations,localSnapshot,mergeAnnotations} from '../annotation-core.js';
import {AnnotationSync} from '../annotation-sync.js';
import {GitHubLibrary,toBase64,fromBase64} from '../upload-core.js';
const mark=(id,note)=>({id,type:'note',quote:'原文片段',prefix:'',suffix:'',note,t:'2026-11-05T10:00:00.000Z'});
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};
test('two devices merge different notes and keep conflicting text versions',()=>{
 const base=emptyAnnotations('paper-1'),left=localSnapshot(base,[mark('a','甲')]),right=localSnapshot(base,[mark('b','乙')]);
 assert.equal(mergeAnnotations(base,left,right).snapshot.marks.length,2);
 const common=localSnapshot(base,[mark('a','原笔记')]);
 const result=mergeAnnotations(common,localSnapshot(common,[mark('a','电脑改写')]),localSnapshot(common,[mark('a','浏览器改写')]));
 assert.equal(result.conflicts.length,1);assert.deepEqual(new Set(result.snapshot.marks.map(m=>m.note)),new Set(['电脑改写','浏览器改写']));
});
test('deletions synchronize without reviving old annotations',()=>{
 const before=localSnapshot(emptyAnnotations('paper-1'),[mark('a','删除我')],'2026-11-05T10:00:00.000Z');
 const removed=localSnapshot(before,[],'2026-11-05T11:00:00.000Z');
 assert.equal(mergeAnnotations(before,before,removed).snapshot.marks.length,0);
 assert.equal(mergeAnnotations(emptyAnnotations('paper-1'),before,removed).snapshot.marks.length,0);
});
test('GitHub writes retry a file SHA race and preserve another device note',async()=>{
 let data=emptyAnnotations('paper-1'),sha=null,writes=0;const calls=[];
 const client=new GitHubLibrary(async(url,options)=>{
  const path=new URL(url).pathname,body=options.body?JSON.parse(options.body):null;calls.push({path,options});
  if(path==='/repos/Co1dog/paper-library')return new Response(JSON.stringify({owner:{login:'Co1dog'},name:'paper-library',permissions:{push:true}}));
  if(path.endsWith('/git/ref/heads/reading-notes'))return new Response(JSON.stringify({object:{sha:'notes-head'}}));
  if(options.method==='PUT'){
   writes++;assert.ok(body.content);assert.equal(body.branch,'reading-notes');
   if(writes===1){data=localSnapshot(data,[mark('remote','另一设备')]);sha='concurrent';return new Response('{}',{status:409});}
   assert.equal(body.sha,'concurrent');data=JSON.parse(new TextDecoder().decode(fromBase64(body.content)));sha='saved';return new Response(JSON.stringify({content:{sha},commit:{sha:'commit'}}));
  }
  return sha?new Response(JSON.stringify({sha,content:toBase64(new TextEncoder().encode(JSON.stringify(data)))})):new Response('{}',{status:404});
 });
 await client.connect('github_pat_TEST_ONLY');
 const base=emptyAnnotations('paper-1'),result=await client.saveAnnotations('paper-1',base,localSnapshot(base,[mark('local','本机')]));
 assert.equal(writes,2);assert.equal(result.snapshot.marks.length,2);
 assert.ok(calls.every(c=>!c.options.body?.includes('github_pat_')));
});
test('fresh browser restores cloud notes; offline drafts survive and retry',async()=>{
 let cloud=emptyAnnotations('paper-1'),fail=true;const disk=storage();const client={connected:true,async readAnnotations(){return {snapshot:cloud};},async saveAnnotations(id,base,draft){if(fail)throw new Error('offline');cloud=mergeAnnotations(base,draft,cloud).snapshot;return {snapshot:cloud,conflicts:[]};}};
 const first=new AnnotationSync({paperId:'paper-1',client,storage:disk,delay:999999});first.observe([mark('a','换电脑继续')]);await first.flush();assert.equal(first.dirty,true);first.close();
 const retry=new AnnotationSync({paperId:'paper-1',client,storage:disk,delay:999999});fail=false;await retry.flush();assert.equal(retry.dirty,false);
 let restored;const second=new AnnotationSync({paperId:'paper-1',client,storage:storage(),apply:value=>{restored=value;},delay:999999});await second.pull();assert.equal(restored.marks[0].note,'换电脑继续');retry.close();second.close();
});
test('typing during an in-flight save remains pending and is saved next',async()=>{
 let finish,cloud=emptyAnnotations('paper-1'),call=0;const client={connected:true,readAnnotations:async()=>({snapshot:cloud}),saveAnnotations:async(id,base,draft)=>{if(++call===1)await new Promise(r=>finish=r);cloud=mergeAnnotations(base,draft,cloud).snapshot;return {snapshot:cloud,conflicts:[]};}};
 const sync=new AnnotationSync({paperId:'paper-1',client,storage:storage(),delay:999999});sync.observe([mark('a','第一版')]);const pending=sync.flush();sync.observe([mark('a','继续编辑')]);finish();await pending;assert.equal(sync.dirty,true);await sync.flush();assert.equal(cloud.marks[0].note,'继续编辑');sync.close();
});

test('reopening unchanged restored notes does not schedule another cloud write',async()=>{
 const disk=storage(),remote=localSnapshot(emptyAnnotations('paper-1'),[mark('a','已同步')],'2026-11-05T10:00:00.000Z');
 const client={connected:false,readAnnotations:async()=>({snapshot:remote})};
 const first=new AnnotationSync({paperId:'paper-1',client,storage:disk});await first.pull();first.close();
 const next=new AnnotationSync({paperId:'paper-1',client,storage:disk,marks:remote.marks,updatedAt:'2026-11-05T11:00:00.000Z'});
 assert.equal(next.dirty,false);next.close();
});

test('a remote update deferred while typing is not mistaken for a new local edit after reopen',async()=>{
 const disk=storage(),base=localSnapshot(emptyAnnotations('paper-1'),[mark('a','旧文字')],'2026-11-05T10:00:00.000Z');let remote=base,editing=false;
 const client={connected:false,readAnnotations:async()=>({snapshot:remote})};
 const first=new AnnotationSync({paperId:'paper-1',client,storage:disk,apply:()=>!editing});await first.pull();
 editing=true;remote=localSnapshot(base,[mark('a','另一电脑的新文字')],'2026-11-05T11:00:00.000Z');await first.pull();first.close();
 let restored;const next=new AnnotationSync({paperId:'paper-1',client,storage:disk,marks:base.marks,updatedAt:base.updatedAt,apply:s=>{restored=s;}});
 assert.equal(restored.marks.length,1);assert.equal(restored.marks[0].note,'另一电脑的新文字');assert.equal(next.dirty,false);next.close();
});

test('first annotation save creates a dedicated branch without changing main',async()=>{
 let branch=false;const writes=[];
 const client=new GitHubLibrary(async(url,options)=>{const path=new URL(url).pathname,body=options.body?JSON.parse(options.body):null;
  if(path==='/repos/Co1dog/paper-library')return new Response(JSON.stringify({owner:{login:'Co1dog'},name:'paper-library',permissions:{push:true}}));
  if(path.endsWith('/git/ref/heads/reading-notes'))return branch?new Response(JSON.stringify({object:{sha:'main-head'}})):new Response('{}',{status:404});
  if(path.endsWith('/git/ref/heads/main'))return new Response(JSON.stringify({object:{sha:'main-head'}}));
  if(options.method==='POST'){assert.equal(body.ref,'refs/heads/reading-notes');branch=true;writes.push(body);return new Response('{}',{status:201});}
  if(options.method==='PUT'){assert.equal(body.branch,'reading-notes');writes.push(body);return new Response(JSON.stringify({content:{sha:'notes-file'},commit:{sha:'notes-commit'}}));}
  return new Response('{}',{status:404});
 });
 await client.connect('github_pat_TEST_ONLY');await client.saveAnnotations('paper-1',emptyAnnotations('paper-1'),localSnapshot(emptyAnnotations('paper-1'),[mark('a','独立笔记分支')]));
 assert.equal(writes.length,2);
});
