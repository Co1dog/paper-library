import {AnnotationSync} from './annotation-sync.js?v=cloud-fast-20261105-v4';
import {githubClient,onGitHubConnection} from './github-session.js?v=cloud-fast-20261105-v4';
import {connectReadingTools} from './reader-tools.js?v=reader-tools-20261105';
// Adapt the existing XRAY annotator without rewriting its source or storage keys.
export function connectAnnotations(frame,{toggle,download,status,filename,paperId,cloudButton,originalURL}){
 let win,doc;
 try{win=frame.contentWindow;doc=frame.contentDocument;if(!win.XRAY||!doc.querySelector('#xrPen'))throw new Error();}
 catch{status.textContent='此解读暂无内置标注工具';return ()=>{};}
 const events=new AbortController(),on=(node,event,handler)=>node.addEventListener(event,handler,{signal:events.signal});
 let frameID=0;
 const pen=doc.querySelector('#xrPen'),save=doc.querySelector('#xrSave');
 const storageKey='xray:'+decodeURIComponent(new URL(originalURL||frame.src).pathname);
 let signature=JSON.stringify(win.XRAY.state().marks);
 const renderCloud=info=>{
  const active=doc.body.classList.contains('xr-annot');toggle.setAttribute('aria-pressed',String(active));toggle.textContent=active?'✎ 标注已开启':'✎ 开启标注'; // taste-skill-ignore: functional pen control inherited from XRAY
  const count=info.count?`${info.count} 条笔记 · `:'';
  status.textContent=info.error?count+'已保留本机记录 · '+info.error:info.saving?count+'正在同步到 GitHub…':info.dirty?count+(info.connected?'等待同步到 GitHub…':'已保存本机 · 连接 GitHub 后同步'):info.loaded?count+(info.conflicts?'GitHub 已同步，并行版本已保留':'GitHub 云端已同步'):'正在读取 GitHub 云端笔记…';
  cloudButton.textContent=!info.connected?'连接 GitHub':info.error?'重试同步':info.dirty?'立即同步':'刷新云端';
 };
 let cloud=new AnnotationSync({paperId,client:githubClient,marks:win.XRAY.state().marks,updatedAt:win.XRAY.state().updated,status:renderCloud,apply:snapshot=>{
  if(JSON.stringify(win.XRAY.state().marks)===JSON.stringify(snapshot.marks))return true;
  if(doc.hasFocus()&&doc.activeElement?.matches('.xr-card textarea'))return false;
  if(win.XRAY.restore)win.XRAY.restore(snapshot);
  else{
   const value={updated:snapshot.updatedAt,marks:snapshot.marks,folds:win.XRAY.state().folds};
   try{win.localStorage.setItem(storageKey,JSON.stringify(value));}catch{}
   frame.contentWindow.location.reload();return false;
  }
  signature=JSON.stringify(win.XRAY.state().marks);return true;
 }});
 const update=()=>{
  const next=JSON.stringify(win.XRAY.state().marks);
  if(next!==signature){signature=next;cloud.observe(win.XRAY.state().marks);}else cloud.report();
 };
 const exportNotes=async()=>{
  try{
   let html=win.XRAY.serialize();
   if(originalURL&&new URL(originalURL).pathname!==new URL(frame.src).pathname){status.textContent='正在生成完整 HTML 副本…';const response=await fetch(originalURL,{cache:'force-cache'});if(!response.ok)throw new Error();html=(await response.text()).replace(/(<script type="application\/json" id="xray-notes">)[\s\S]*?(<\/script>)/,(_,a,b)=>a+JSON.stringify(win.XRAY.state()).replace(/</g,'\\u003c')+b);}
   const blob=new Blob([html],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);status.textContent='已下载带笔记的 HTML 副本';
  }catch{status.textContent='下载未完成，请重试或在新窗口打开解读。';}
 };
 toggle.disabled=false;download.disabled=false;doc.documentElement.dataset.libraryReader='true';
 const stopTools=connectReadingTools(doc);
 // Online reading starts ready to annotate; this button also controls the old pen.
 if(!doc.body.classList.contains('xr-annot'))pen.click();
 on(toggle,'click',()=>{pen.click();update();});
 on(cloudButton,'click',()=>{if(!githubClient.connected)window.dispatchEvent(new Event('paper-library:connect'));else if(cloud.error)cloud.retry();else if(cloud.dirty)cloud.flush();else cloud.pull();});
 on(doc,'focusout',()=>queueMicrotask(()=>cloud.applyPending()));
 const stopConnection=onGitHubConnection(()=>{if(githubClient.connected)cloud.retry();else cloud.report();});
 on(window,'focus',()=>{if(!frame.closest('[hidden]'))cloud.pull();});
 on(window,'beforeunload',event=>{if(githubClient.connected&&cloud.dirty){event.preventDefault();event.returnValue='';}});
 const poll=setInterval(()=>{if(githubClient.connected&&!document.hidden&&!frame.closest('[hidden]')&&!cloud.inflight)cloud.pull();},60000);on(pen,'click',update);on(download,'click',exportNotes);
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
 update();cloud.pull();
 return ()=>{cloud.close();stopConnection();stopTools();clearInterval(poll);events.abort();observer.disconnect();win.cancelAnimationFrame(frameID);if(save)save.onclick=oldSave;};
}
