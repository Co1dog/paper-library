import {emptyAnnotations,localSnapshot,mergeAnnotations,sameAnnotations,validateAnnotations} from './annotation-core.js?v=cloud-fast-20261105-v4';
const clone=value=>JSON.parse(JSON.stringify(value));
export class AnnotationSync{
 constructor({paperId,client,marks=[],updatedAt,storage=globalThis.localStorage,apply=()=>true,status=()=>{},delay=2200}){
  Object.assign(this,{paperId,client,storage,apply,status,delay});this.key='paper-library:annotations:'+paperId;this.base=emptyAnnotations(paperId);this.draft=emptyAnnotations(paperId);this.timer=0;this.error='';this.loaded=false;this.inflight=null;this.closed=false;this.generation=0;
  let cached=null;
  try{cached=JSON.parse(storage.getItem(this.key)||'null');if(cached){this.base=validateAnnotations(cached.base,paperId);this.draft=validateAnnotations(cached.draft,paperId);}}catch{cached=null;}
  if(cached?.observed){
   const observed=validateAnnotations(cached.observed,paperId);
   if(updatedAt&&updatedAt>String(observed.updatedAt||'')){const local=localSnapshot(observed,marks,updatedAt);this.draft=mergeAnnotations(observed,local,this.draft).snapshot;this.observed=local;}
   else this.observed=observed;
  }else{
   const local=localSnapshot(emptyAnnotations(paperId),marks,updatedAt||new Date().toISOString());
   this.draft=mergeAnnotations(emptyAnnotations(paperId),local,this.draft).snapshot;this.observed=clone(this.draft);
  }
  this.persist();this.applyPending();this.report();
 }
 get dirty(){return !sameAnnotations(this.base,this.draft);}
 persist(){try{this.storage.setItem(this.key,JSON.stringify({base:this.base,draft:this.draft,observed:this.observed}));}catch{this.error='浏览器缓存未能写入，请保持页面打开并同步。';}}
 report(){if(!this.closed)this.status({connected:this.client.connected,dirty:this.dirty,saving:Boolean(this.inflight),loaded:this.loaded,error:this.error,count:this.draft.marks.filter(m=>m.type==='note').length,conflicts:this.conflicts||0});}
 applyPending(){if(!this.closed&&this.apply(clone(this.draft))!==false){this.observed=clone(this.draft);this.persist();}}
 observe(marks){
  const local=localSnapshot(this.observed,marks);
  this.draft=mergeAnnotations(this.observed,local,this.draft).snapshot;this.observed=local;this.generation++;this.error='';this.persist();this.report();this.schedule();
 }
 schedule(){clearTimeout(this.timer);if(this.dirty&&this.client.connected&&!this.closed)this.timer=setTimeout(()=>this.flush(),this.delay);}
 async pull(){
  try{
   const remote=await this.client.readAnnotations(this.paperId);if(this.closed)return;
   const result=mergeAnnotations(this.base,this.draft,remote.snapshot);this.loaded=true;this.base=remote.snapshot;this.draft=result.snapshot;this.conflicts=result.conflicts.length;this.error='';this.persist();this.applyPending();this.report();this.schedule();
  }catch(error){this.error=error.message;this.report();}
 }
 flush(){
  clearTimeout(this.timer);if(this.inflight)return this.inflight;
  if(!this.client.connected||!this.dirty){this.report();return Promise.resolve();}
  const sent=clone(this.draft),base=clone(this.base);
  this.inflight=(async()=>{
   try{
    const result=await this.client.saveAnnotations(this.paperId,base,sent);
    const latest=mergeAnnotations(sent,this.draft,result.snapshot);this.loaded=true;this.base=result.snapshot;this.draft=latest.snapshot;this.conflicts=result.conflicts.length+latest.conflicts.length;this.error='';this.persist();this.applyPending();
   }catch(error){this.error=error.message;this.persist();}
   finally{this.inflight=null;this.report();if(!this.error&&this.dirty&&!this.closed)this.schedule();}
  })();this.report();return this.inflight;
 }
 retry(){this.error='';return this.pull().then(()=>this.flush());}
 close(){clearTimeout(this.timer);if(this.dirty&&this.client.connected)this.flush();this.closed=true;}
}
