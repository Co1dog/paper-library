// The reader owns one PDF task and one commentary frame; closing releases both.
import {paperKeywords,keywordGroup} from './search-core.js?v=reading-room-20261104-v2';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safe=value=>{try{const u=new URL(value);return /^https?:$/.test(u.protocol)?u.href:'';}catch{return '';}};
export function readerAssetURL(value,base=import.meta.url){
 const url=safe(value);if(!url)return '';
 const source=new URL(url);
 if(source.origin==='https://co1dog.github.io'&&source.pathname.startsWith('/paper-library/'))return new URL('./'+source.pathname.slice('/paper-library/'.length)+source.search,base).href;
 return url;
}
let dispose=null;
export function openReader(paper,{isDemo=false,showDialog}={}){
 dispose?.();
 const dialog=document.getElementById('detail-dialog'),host=document.getElementById('detail-content');
 const pdfURL=readerAssetURL(paper.pdfURL),notesURL=readerAssetURL(paper.readingURL),source=safe(paper.url);
 const keywords=paperKeywords(paper),groups=[...new Set(keywords.map(keywordGroup))];
 host.innerHTML=`<div class="reading-room"><header class="reader-header"><button class="reader-back" data-close autofocus>← 返回书架</button><span class="reader-brand">paper library <span>/ 阅读室</span></span><button class="reader-info-toggle" aria-expanded="false" aria-controls="reader-info">论文信息</button></header><div class="reader-layout"><aside class="reader-info" id="reader-info"><p class="reader-source">${isDemo?'示例论文':escape(paper.venue||'我的书架')} ${paper.year?' / '+escape(paper.year):''}</p><h2 id="reader-title">${escape(paper.title)}</h2><p class="reader-authors">${escape(paper.authors||'作者待补充')}</p><div class="reader-keywords">${groups.map(group=>`<div><span class="reader-group-label">${escape(group)}</span><span class="paper-keywords">${keywords.filter(k=>keywordGroup(k)===group).map(k=>`<span class="keyword-tag">${escape(k)}</span>`).join('')}</span></div>`).join('')}</div>${paper.summary?`<p class="reader-summary">${escape(paper.summary)}</p>`:''}<details class="reader-record"><summary>阅读记录</summary><p>${escape(paper.notes||'暂无补充记录。')}</p><p>阅读于 ${escape(paper.readDate||'日期待补充')}</p></details><div class="reader-sources">${source?`<a href="${escape(source)}" target="_blank" rel="noopener noreferrer">论文来源 ↗</a>`:''}${safe(paper.issueURL)?`<a href="${escape(safe(paper.issueURL))}" target="_blank" rel="noopener noreferrer">编辑记录 ↗</a>`:''}</div></aside><section class="reader-main" aria-label="论文阅读区"><div class="reader-navigation"><div class="reader-tabs" role="tablist" aria-label="阅读内容"><button id="reader-pdf-tab" role="tab" aria-controls="reader-pdf-panel" aria-selected="true" tabindex="0">原文 PDF</button><button id="reader-notes-tab" role="tab" aria-controls="reader-notes-panel" aria-selected="false" tabindex="-1">中文解读</button></div><a id="reader-external" target="_blank" rel="noopener noreferrer">新窗口打开 ↗</a></div><section id="reader-pdf-panel" class="reader-panel" role="tabpanel" aria-labelledby="reader-pdf-tab"><div class="pdf-controls"><div class="pdf-pagination"><button id="pdf-prev" aria-label="上一页" disabled>←</button><label><span class="sr-only">PDF 页码</span><input id="pdf-page" type="number" min="1" value="1" aria-label="PDF 页码" disabled></label><span id="pdf-total">/ —</span><button id="pdf-next" aria-label="下一页" disabled>→</button></div><div class="pdf-zoom"><button id="pdf-out" aria-label="缩小原文" disabled>−</button><button id="pdf-fit" disabled>适合宽度</button><button id="pdf-in" aria-label="放大原文" disabled>＋</button></div></div><div class="pdf-viewport" id="pdf-viewport" tabindex="0" aria-label="原文页面；可滚动阅读"><p class="reader-message" id="pdf-message" role="status">正在载入原文…</p><div class="pdf-page-wrap" id="pdf-sheet" hidden></div></div></section><section id="reader-notes-panel" class="reader-panel" role="tabpanel" aria-labelledby="reader-notes-tab" hidden><p class="reader-message" id="notes-message" role="status">正在载入中文解读…</p><iframe id="reader-notes-frame" title="${escape(paper.title)} · 中文解读" hidden></iframe></section></section></div></div>`;
 dialog.setAttribute('aria-labelledby','reader-title');
 const $=id=>host.querySelector('#'+id),events=new AbortController();
 let alive=true,loading=null,doc=null,pdfjs=null,renderTask=null,textLayer=null,page=1,zoom=1,sequence=0,notesStarted=false,resizeTimer,mode='pdf',notesTimer;
 const on=(node,event,fn)=>node.addEventListener(event,fn,{signal:events.signal});
 const message=(id,text)=>{$(id).textContent=text;$(id).hidden=false;};
 const updateControls=()=>{
  $('pdf-page').value=page;$('pdf-page').max=doc?.numPages||1;$('pdf-total').textContent='/ '+(doc?.numPages||'—');
  for(const id of ['pdf-page','pdf-fit','pdf-in','pdf-out'])$(id).disabled=!doc;
  $('pdf-prev').disabled=!doc||page===1;$('pdf-next').disabled=!doc||page===doc.numPages;
  $('pdf-out').disabled=!doc||zoom<=.5;$('pdf-in').disabled=!doc||zoom>=2.5;
  $('pdf-fit').textContent=zoom===1?'适合宽度':Math.round(zoom*100)+'%';
 };
 async function paint(resetScroll=false){
  if(!doc||!alive||mode!=='pdf')return;
  const ticket=++sequence;renderTask?.cancel();textLayer?.cancel();
  try{
   const pdfPage=await doc.getPage(page);if(!alive||ticket!==sequence)return;
   const viewport=$('pdf-viewport'),oldScroll=viewport.scrollTop,oldHeight=$('pdf-sheet').offsetHeight,base=pdfPage.getViewport({scale:1});
   const scale=Math.max(.2,(viewport.clientWidth-48)/base.width)*zoom,view=pdfPage.getViewport({scale});
   const ratio=Math.min(devicePixelRatio||1,2),canvas=document.createElement('canvas');
   canvas.width=Math.floor(view.width*ratio);canvas.height=Math.floor(view.height*ratio);
   canvas.style.width=view.width+'px';canvas.style.height=view.height+'px';
   canvas.setAttribute('aria-label',`原文第 ${page} 页，共 ${doc.numPages} 页`);
   const sheet=$('pdf-sheet');sheet.replaceChildren(canvas);sheet.style.width=view.width+'px';sheet.style.height=view.height+'px';sheet.style.setProperty('--scale-factor',scale);sheet.style.setProperty('--total-scale-factor',scale);sheet.hidden=false;
   $('pdf-message').hidden=true;viewport.scrollTop=resetScroll?0:oldScroll*(oldHeight?view.height/oldHeight:1);updateControls();
   renderTask=pdfPage.render({canvasContext:canvas.getContext('2d'),viewport:view,transform:ratio===1?null:[ratio,0,0,ratio,0,0]});
   await renderTask.promise;if(!alive||ticket!==sequence)return;
   const text=document.createElement('div');text.className='textLayer';sheet.append(text);
   textLayer=new pdfjs.TextLayer({textContentSource:pdfPage.streamTextContent(),container:text,viewport:view});
   await textLayer.render();if(alive&&ticket===sequence)sheet.dataset.page=String(page);
  }catch(error){if(alive&&ticket===sequence&&error.name!=='RenderingCancelledException'&&error.name!=='AbortException')message('pdf-message','这一页暂时无法显示，请重试翻页或在新窗口打开原文。');}
 }
 async function startPDF(){
  if(!pdfURL){message('pdf-message','这篇论文尚未上传原文 PDF，可从左侧论文来源查看。');return;}
  try{
   pdfjs=await import('./assets/vendor/pdfjs/pdf.mjs');if(!alive)return;
   pdfjs.GlobalWorkerOptions.workerSrc=new URL('./assets/vendor/pdfjs/pdf.worker.mjs',import.meta.url).href;
   loading=pdfjs.getDocument({url:pdfURL,isEvalSupported:false});doc=await loading.promise;
   if(!alive)return;updateControls();await paint();
  }catch(error){if(alive)message('pdf-message','原文暂时无法载入，请检查网络，或选择「新窗口打开」。');}
 }
 function startNotes(){
  if(notesStarted)return;notesStarted=true;
  if(!notesURL){message('notes-message','这篇论文尚未上传中文解读，可在「论文信息」中查看阅读记录。');return;}
  const frame=$('reader-notes-frame'),url=new URL(notesURL);url.searchParams.set('theme','dark');
  on(frame,'load',()=>{
   if(!alive)return;clearTimeout(notesTimer);
   try{
    const inner=frame.contentDocument;
    if(inner){inner.documentElement.dataset.theme='dark';const style=inner.createElement('link');style.rel='stylesheet';style.href=new URL('./reader-notes.css?v=reading-room-20261104-v2',import.meta.url).href;inner.head.append(style);}
   }catch{}
   $('notes-message').hidden=true;frame.hidden=false;
  });
  frame.src=url.href;
  notesTimer=setTimeout(()=>{if(alive&&!$('notes-message').hidden)message('notes-message','解读仍在载入，可稍候或选择「新窗口打开」。');},15000);
 }
 function switchTab(next){
  mode=next;
  for(const name of ['pdf','notes']){const selected=name===mode;$('reader-'+name+'-tab').setAttribute('aria-selected',String(selected));$('reader-'+name+'-tab').tabIndex=selected?0:-1;$('reader-'+name+'-panel').hidden=!selected;}
  const external=mode==='pdf'?pdfURL:notesURL;$('reader-external').hidden=!external;$('reader-external').href=external||'#';
  if(mode==='notes')startNotes();else if(doc)paint();
 }
 for(const tab of ['pdf','notes']){
  on($('reader-'+tab+'-tab'),'click',()=>switchTab(tab));
  on($('reader-'+tab+'-tab'),'keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?'pdf':event.key==='End'?'notes':tab==='pdf'?'notes':'pdf';switchTab(next);$('reader-'+next+'-tab').focus();}});
 }
 const go=next=>{if(!doc)return;page=Math.max(1,Math.min(doc.numPages,Math.round(Number(next))||page));paint(true);};
 on($('pdf-prev'),'click',()=>go(page-1));on($('pdf-next'),'click',()=>go(page+1));on($('pdf-page'),'change',event=>go(event.target.value));
 on($('pdf-in'),'click',()=>{zoom=Math.min(2.5,zoom+.25);paint();});on($('pdf-out'),'click',()=>{zoom=Math.max(.5,zoom-.25);paint();});on($('pdf-fit'),'click',()=>{zoom=1;paint();});
 on($('pdf-viewport'),'keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();go(page+(event.key==='ArrowRight'?1:-1));}});
 on(host.querySelector('.reader-info-toggle'),'click',event=>{const open=host.querySelector('.reading-room').classList.toggle('info-open');event.currentTarget.setAttribute('aria-expanded',String(open));});
 const resize=new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>paint(),160);});resize.observe($('pdf-viewport'));
 dispose=()=>{alive=false;sequence++;events.abort();resize.disconnect();clearTimeout(resizeTimer);clearTimeout(notesTimer);renderTask?.cancel();textLayer?.cancel();loading?.destroy()?.catch(()=>{});$('reader-notes-frame')?.removeAttribute('src');};
 on(dialog,'close',()=>{dispose?.();dispose=null;host.replaceChildren();});
 showDialog(dialog);switchTab('pdf');startPDF();
}
