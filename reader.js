import {ContinuousPDF} from './pdf-scroll.js?v=cloud-fast-20261105-v4';
import {connectAnnotations} from './reader-annotations.js?v=reader-tools-20261105';
// The reader owns one PDF task and one commentary frame; closing releases both.
import {paperKeywords,keywordGroup} from './search-core.js?v=cloud-fast-20261105-v4';
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
 const pdfURL=readerAssetURL(paper.pdfURL),notesURL=readerAssetURL(paper.readerURL||paper.readingURL),source=safe(paper.url);
 const keywords=paperKeywords(paper),groups=[...new Set(keywords.map(keywordGroup))];
 host.innerHTML=`<div class="reading-room"><header class="reader-header"><button class="reader-back" data-close autofocus>← 返回书架</button><span class="reader-brand">paper library <span>/ 阅读室</span></span><button class="reader-info-toggle" aria-expanded="false" aria-controls="reader-info">论文信息</button></header><div class="reader-layout"><aside class="reader-info" id="reader-info"><p class="reader-source">${isDemo?'示例论文':escape(paper.venue||'我的书架')} ${paper.year?' / '+escape(paper.year):''}</p><h2 id="reader-title">${escape(paper.title)}</h2><p class="reader-authors">${escape(paper.authors||'作者待补充')}</p><div class="reader-keywords">${groups.map(group=>`<div><span class="reader-group-label">${escape(group)}</span><span class="paper-keywords">${keywords.filter(k=>keywordGroup(k)===group).map(k=>`<span class="keyword-tag">${escape(k)}</span>`).join('')}</span></div>`).join('')}</div>${paper.summary?`<p class="reader-summary">${escape(paper.summary)}</p>`:''}<details class="reader-record"><summary>阅读记录</summary><p>${escape(paper.notes||'暂无补充记录。')}</p><p>阅读于 ${escape(paper.readDate||'日期待补充')}</p></details><div class="reader-sources">${source?`<a href="${escape(source)}" target="_blank" rel="noopener noreferrer">论文来源 ↗</a>`:''}${safe(paper.issueURL)?`<a href="${escape(safe(paper.issueURL))}" target="_blank" rel="noopener noreferrer">编辑记录 ↗</a>`:''}</div></aside><section class="reader-main" aria-label="论文阅读区"><div class="reader-navigation"><div class="reader-tabs" role="tablist" aria-label="阅读内容"><button id="reader-pdf-tab" role="tab" aria-controls="reader-pdf-panel" aria-selected="true" tabindex="0">原文 PDF</button><button id="reader-notes-tab" role="tab" aria-controls="reader-notes-panel" aria-selected="false" tabindex="-1">中文解读</button></div><a id="reader-external" target="_blank" rel="noopener noreferrer">新窗口打开 ↗</a></div><section id="reader-pdf-panel" class="reader-panel" role="tabpanel" aria-labelledby="reader-pdf-tab"><div class="pdf-controls"><div class="pdf-pagination"><label><span class="sr-only">PDF 页码</span><input id="pdf-page" type="number" min="1" value="1" aria-label="PDF 页码" disabled></label><span id="pdf-total">/ —</span><span class="pdf-scroll-hint">上下滚动阅读</span></div><div class="pdf-zoom"><button id="pdf-out" aria-label="缩小原文" disabled>−</button><button id="pdf-fit" disabled>适合宽度</button><button id="pdf-in" aria-label="放大原文" disabled>＋</button></div></div><div class="pdf-viewport" id="pdf-viewport" tabindex="0" aria-label="原文页面；可滚动阅读"><p class="reader-message" id="pdf-message" role="status">正在载入原文…</p><div class="pdf-document" id="pdf-document" hidden></div></div></section><section id="reader-notes-panel" class="reader-panel" role="tabpanel" aria-labelledby="reader-notes-tab" hidden><div class="notes-controls"><button id="notes-annotate" aria-pressed="false" disabled>✎ 开启标注</button><span id="notes-save-status" role="status">选中文字后可写笔记</span><button id="notes-cloud">连接 GitHub</button><button id="notes-download" disabled>下载笔记副本 ↓</button></div><div class="notes-document"><p class="reader-message" id="notes-message" role="status">正在载入中文解读…</p><iframe id="reader-notes-frame" title="${escape(paper.title)} · 中文解读" hidden></iframe></div></section></section></div></div>`;
 dialog.setAttribute('aria-labelledby','reader-title');
 const $=id=>host.querySelector('#'+id),events=new AbortController();
 let alive=true,loading=null,doc=null,pdfjs=null,scroller=null,annotations=null,page=1,zoom=1,notesStarted=false,resizeTimer,mode='pdf',notesTimer;
 const on=(node,event,fn)=>node.addEventListener(event,fn,{signal:events.signal});
 const message=(id,text)=>{$(id).textContent=text;$(id).hidden=false;};
 const updateControls=()=>{
  $('pdf-page').value=page;$('pdf-page').max=doc?.numPages||1;$('pdf-total').textContent='/ '+(doc?.numPages||'—');
  for(const id of ['pdf-page','pdf-fit','pdf-in','pdf-out'])$(id).disabled=!doc;
  $('pdf-out').disabled=!doc||zoom<=.5;$('pdf-in').disabled=!doc||zoom>=2.5;
  $('pdf-fit').textContent=zoom===1?'适合宽度':Math.round(zoom*100)+'%';
 };
 async function startPDF(){
  if(!pdfURL){message('pdf-message','这篇论文尚未上传原文 PDF，可从左侧论文来源查看。');return;}
  try{
   pdfjs=await import('./assets/vendor/pdfjs/pdf.mjs');if(!alive)return;
   pdfjs.GlobalWorkerOptions.workerSrc=new URL('./assets/vendor/pdfjs/pdf.worker.mjs',import.meta.url).href;
   loading=pdfjs.getDocument({url:pdfURL,isEvalSupported:false,disableAutoFetch:true,disableStream:true,rangeChunkSize:131072});doc=await loading.promise;
   if(!alive)return;
   scroller=new ContinuousPDF({doc,pdfjs,viewport:$('pdf-viewport'),mount:$('pdf-document'),onPage:number=>{page=number;updateControls();}});
   await scroller.init();if(!alive)return;$('pdf-message').hidden=true;updateControls();
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
    if(inner){inner.documentElement.dataset.theme='dark';const style=inner.createElement('link');style.rel='stylesheet';style.href=new URL('./reader-notes.css?v=reader-tools-20261105',import.meta.url).href;inner.head.append(style);annotations?.();annotations=connectAnnotations(frame,{toggle:$('notes-annotate'),download:$('notes-download'),status:$('notes-save-status'),filename:(paper.id||'paper')+'-notes.html',paperId:paper.id,cloudButton:$('notes-cloud'),originalURL:readerAssetURL(paper.readingURL)});}
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
  if(mode==='notes')startNotes();else scroller?.resize(zoom);
 }
 for(const tab of ['pdf','notes']){
  on($('reader-'+tab+'-tab'),'click',()=>switchTab(tab));
  on($('reader-'+tab+'-tab'),'keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?'pdf':event.key==='End'?'notes':tab==='pdf'?'notes':'pdf';switchTab(next);$('reader-'+next+'-tab').focus();}});
 }
 on($('pdf-page'),'change',event=>scroller?.jump(event.target.value));
 on($('pdf-page'),'keydown',event=>{if(event.key==='Enter'){event.preventDefault();scroller?.jump(event.target.value);$('pdf-viewport').focus();}});
 on($('pdf-in'),'click',()=>{zoom=Math.min(2.5,zoom+.25);scroller?.resize(zoom);updateControls();});on($('pdf-out'),'click',()=>{zoom=Math.max(.5,zoom-.25);scroller?.resize(zoom);updateControls();});on($('pdf-fit'),'click',()=>{zoom=1;scroller?.resize(zoom);updateControls();});
 on(host.querySelector('.reader-info-toggle'),'click',event=>{const open=host.querySelector('.reading-room').classList.toggle('info-open');event.currentTarget.setAttribute('aria-expanded',String(open));});
 const resize=new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(mode==='pdf')scroller?.resize(zoom);},160);});resize.observe($('pdf-viewport'));
 dispose=()=>{alive=false;events.abort();resize.disconnect();clearTimeout(resizeTimer);clearTimeout(notesTimer);scroller?.destroy();annotations?.();loading?.destroy()?.catch(()=>{});$('reader-notes-frame')?.removeAttribute('src');};
 on(dialog,'close',()=>{dispose?.();dispose=null;host.replaceChildren();});
 showDialog(dialog);switchTab('pdf');startPDF();
}
