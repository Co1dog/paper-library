// Per-paper JSON is small and can be merged without rewriting the commentary HTML.
export const emptyAnnotations=paperId=>({version:1,paperId,marks:[],deleted:[]});
const clone=value=>JSON.parse(JSON.stringify(value));
const content=mark=>{if(!mark)return null;const {modifiedAt,...rest}=mark;return JSON.stringify(rest);};
export function validPaperId(id){return typeof id==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(id);}
export function validateAnnotations(value,paperId){
 if(!validPaperId(paperId)||!value||value.version!==1||value.paperId!==paperId||!Array.isArray(value.marks)||!Array.isArray(value.deleted))throw new Error('云端笔记格式不正确，已保留本地记录。');
 if(value.marks.length>10000||value.deleted.length>10000)throw new Error('这篇论文的笔记超过一次同步范围。');
 const ids=new Set();
 for(const mark of value.marks){if(!mark||typeof mark.id!=='string'||!/^[-_a-zA-Z0-9]{1,200}$/.test(mark.id)||typeof mark.quote!=='string'||!['note','hl','fb'].includes(mark.type)||ids.has(mark.id))throw new Error('云端笔记条目不正确。');ids.add(mark.id);}
 for(const item of value.deleted)if(!item||typeof item.id!=='string'||typeof item.modifiedAt!=='string')throw new Error('云端笔记的删除记录不正确。');
 return clone(value);
}
export function localSnapshot(base,marks,now=new Date().toISOString()){
 const prior=new Map(base.marks.map(m=>[m.id,m])),live=new Set(marks.map(m=>m.id));
 const deleted=new Map(base.deleted.map(d=>[d.id,d]));
 for(const m of base.marks)if(!live.has(m.id))deleted.set(m.id,{id:m.id,modifiedAt:now});
 const next=marks.map(mark=>{const old=prior.get(mark.id);deleted.delete(mark.id);return {...clone(mark),modifiedAt:content(mark)===content(old)?old.modifiedAt||mark.modifiedAt||now:old?now:mark.modifiedAt||now};});
 return {...base,marks:next,deleted:[...deleted.values()],updatedAt:now};
}
function hash(text){let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(36);}
export function mergeAnnotations(base,local,remote){
 const b=new Map(base.marks.map(m=>[m.id,m])),l=new Map(local.marks.map(m=>[m.id,m])),r=new Map(remote.marks.map(m=>[m.id,m]));
 const ld=new Map(local.deleted.map(d=>[d.id,d])),rd=new Map(remote.deleted.map(d=>[d.id,d]));
 const marks=new Map(),deleted=new Map(),conflicts=[];
 for(const id of new Set([...b.keys(),...l.keys(),...r.keys(),...ld.keys(),...rd.keys()])){
  const before=b.get(id),left=l.get(id),right=r.get(id);
  const leftChanged=content(left)!==content(before),rightChanged=content(right)!==content(before);
  let chosen;
  if(leftChanged&&rightChanged&&content(left)!==content(right)){
   // Parallel edits keep both text versions. A delete/edit collision keeps the edit.
   chosen=right||left;conflicts.push(id);
   if(left&&right){const copy={...left,id:id+'-copy-'+hash(content(left))};marks.set(copy.id,copy);}
  }else if(leftChanged)chosen=left;else if(rightChanged)chosen=right;else chosen=right||left;
  // Tombstones prevent a new browser from reviving marks already removed elsewhere.
  const tombstone=[ld.get(id),rd.get(id)].filter(Boolean).sort((a,b)=>String(b.modifiedAt).localeCompare(String(a.modifiedAt)))[0];
  if(chosen&&!(tombstone&&!(leftChanged&&rightChanged)&&String(tombstone.modifiedAt)>=String(chosen.modifiedAt||'')))marks.set(id,chosen);
  else if(tombstone)deleted.set(id,tombstone);
 }
 return {snapshot:{version:1,paperId:base.paperId,marks:[...marks.values()],deleted:[...deleted.values()],updatedAt:new Date().toISOString()},conflicts};
}
export function sameAnnotations(a,b){
 const stable=x=>JSON.stringify({marks:[...x.marks].sort((a,b)=>a.id.localeCompare(b.id)),deleted:[...x.deleted].sort((a,b)=>a.id.localeCompare(b.id))});return stable(a)===stable(b);
}
