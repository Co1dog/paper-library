// Adapt the existing XRAY annotator without rewriting its source or storage keys.
export function connectAnnotations(frame,{toggle,download,status,filename}){
 let win,doc;
 try{win=frame.contentWindow;doc=frame.contentDocument;if(!win.XRAY||!doc.querySelector('#xrPen'))throw new Error();}
 catch{status.textContent='此解读暂无内置标注工具';return ()=>{};}
 const events=new AbortController(),on=(node,event,handler)=>node.addEventListener(event,handler,{signal:events.signal});
 let frameID=0;
 const pen=doc.querySelector('#xrPen'),save=doc.querySelector('#xrSave');
 const storageKey='xray:'+decodeURIComponent(new URL(frame.src).pathname);
 const update=()=>{
  const active=doc.body.classList.contains('xr-annot');toggle.setAttribute('aria-pressed',String(active));toggle.textContent=active?'✎ 标注已开启':'✎ 开启标注';
  const state=win.XRAY.state(),count=state.marks.filter(mark=>mark.type==='note').length;
  let saved=false;try{saved=JSON.parse(win.localStorage.getItem(storageKey)||'null')?.updated===state.updated;}catch{}
  status.textContent=state.updated&&!saved?'笔记暂未保存，可下载副本':count?`${count} 条笔记 · 自动保存在此浏览器`:'选中文字 → 笔记 · 自动保存在此浏览器';
 };
 const exportNotes=()=>{
  try{
   const html=win.XRAY.serialize(),blob=new Blob([html],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);status.textContent='已下载带笔记的 HTML 副本';
  }catch{status.textContent='下载未完成，请重试或在新窗口打开解读。';}
 };
 toggle.disabled=false;download.disabled=false;doc.documentElement.dataset.libraryReader='true';
 // Online reading starts ready to annotate; this button also controls the old pen.
 if(!doc.body.classList.contains('xr-annot'))pen.click();
 on(toggle,'click',()=>{pen.click();update();});on(pen,'click',update);on(download,'click',exportNotes);
 const oldSave=save?.onclick;if(save){save.onclick=exportNotes;save.title='下载带笔记的 HTML 副本';save.setAttribute('aria-label',save.title);}
 // XRAY originally watches mouseup only. Selection changes cover keyboard and touch.
 const showTools=()=>{
  frameID=0;const bar=doc.querySelector('.xr-bar'),selection=win.getSelection();
  if(!bar)return;
  if(!doc.body.classList.contains('xr-annot')||!selection?.rangeCount||selection.isCollapsed){bar.style.display='none';return;}
  const range=selection.getRangeAt(0),ancestor=range.commonAncestorContainer,node=ancestor.nodeType===1?ancestor:ancestor.parentElement;
  if(!doc.querySelector('main')?.contains(node)||node.closest('script,style,svg,.katex-mathml,.xr-ui,.xr-card,.xr-margin,textarea,button,.fk-ctl,.toc')||!selection.toString().trim())return;
  const box=range.getBoundingClientRect();bar.style.display='block';bar.style.left=Math.max(8,Math.min(win.innerWidth-bar.offsetWidth-8,box.left+box.width/2-bar.offsetWidth/2))+'px';bar.style.top=Math.max(8,Math.min(win.innerHeight-bar.offsetHeight-8,box.top>60?box.top-bar.offsetHeight-8:box.bottom+8))+'px';
 };
 on(doc,'selectionchange',()=>{if(!frameID)frameID=win.requestAnimationFrame(showTools);});
 on(doc,'input',event=>{if(event.target.matches('.xr-card textarea'))update();});
 const observer=new win.MutationObserver(()=>queueMicrotask(update));observer.observe(doc.querySelector('main'),{childList:true,subtree:true});
 update();
 return ()=>{events.abort();observer.disconnect();win.cancelAnimationFrame(frameID);if(save)save.onclick=oldSave;};
}
