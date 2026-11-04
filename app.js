import {openReader} from './reader.js?v=reading-room-20261104-v2';
import {mergePapers,fromBase64,DRAFT_KEY} from './upload-core.js?v=reading-room-20261104-v2';
import {paperKeywords,matchesPaper,keywordGroup,KEYWORD_GROUPS} from './search-core.js?v=reading-room-20261104-v2';
import {setupUploader} from './upload.js?v=reading-room-20261104-v2';
'use strict';
const OWNER = 'Co1dog';
const REPO = 'paper-library';
const REPO_URL = `https://github.com/${OWNER}/${REPO}`;
const MARKER = '<!-- paper-library:v1 -->';
const DEMO = [
 {id:'demo-1',title:'Anticipatory gaze & event memory',authors:'示例作者',year:2025,venue:'示例期刊',topic:'眼动与记忆',summary:'示例收获：把研究问题、关键方法和自己的想法，留在同一个地方。',notes:'这是一条演示笔记，不是真实论文结论。\n\n研究问题\n这篇论文试图回答什么？\n\n方法与证据\n哪些实验真正支撑了结论？\n\n我的想法\n它和正在进行的研究有什么联系？',readDate:'2026-10-22',favorite:true},
 {id:'demo-2',title:'How the brain organizes continuous experience',authors:'示例作者',year:2025,venue:'示例期刊',topic:'事件记忆',summary:'示例收获：一句话写下最值得记住的观点，下次回看时迅速找回阅读线索。',notes:'这是一条演示笔记，不是真实文献记录。\n\n可以记录事件边界、实验设计，以及需要重新查看的 Figure。',readDate:'2026-10-20',favorite:true},
 {id:'demo-3',title:'Neural dynamics during naturalistic viewing',authors:'示例作者',year:2026,venue:'示例预印本',topic:'自然情境 EEG',summary:'示例收获：给同一研究方向的论文一个主题，让相关的阅读自然聚在一起。',notes:'',readDate:'2026-10-18',favorite:false},
 {id:'demo-4',title:'From perception to episodic recollection',authors:'示例作者',year:2024,venue:'示例期刊',topic:'事件记忆',summary:'示例收获：保留原始标题与作者，查找时可以同时搜索中文笔记和英文关键词。',notes:'这是一条演示笔记。\n\n记录核心变量、行为指标，以及文章仍没有回答的问题。',readDate:'2026-10-15',favorite:false},
 {id:'demo-5',title:'A computational lens on human memory',authors:'示例作者',year:2025,venue:'示例会议',topic:'计算模型',summary:'示例收获：记录一个方法如何解释现象，以及它能如何迁移到自己的研究。',notes:'',readDate:'2026-10-12',favorite:true},
 {id:'demo-6',title:'Eye movements as a window into cognition',authors:'示例作者',year:2023,venue:'示例期刊',topic:'眼动与记忆',summary:'示例收获：把值得重读的论文标为重点收藏，让好想法随时可以重新打开。',notes:'',readDate:'2026-10-10',favorite:false}
];
const pendingRecords=new Map(),coverPreviews=new Map();
let papers = [], currentView = 'all', activeKeywords = new Set(), isDemo = true, busy = false;
const $ = id => document.getElementById(id);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL = value => {try {const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'';} catch{return '';}};
function starIcon(filled){return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"${filled?' style="fill:currentColor"':''}><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.8-5.4 2.8 1-6-4.4-4.3 6.1-.9Z"/></svg>`;}
function notify(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('toast').hidden=true,3500);}
function showDialog(dialog){if(dialog!==$('menu-dialog')&&$('menu-dialog').open)$('menu-dialog').close();if(!dialog.open)dialog.showModal();}
function getSource(){return isDemo?DEMO:papers;}
function recentPaper(p){const d=new Date(p.readDate+'T00:00:00');const now=new Date();const days=(new Date(now.getFullYear(),now.getMonth(),now.getDate())-d)/86400000;return days>=0&&days<=30;}
function updateStats(){
 const topics=new Set(papers.flatMap(paperKeywords));
 $('stat-papers').textContent=String(papers.length);
 $('stat-topics').textContent=String(topics.size);
 $('stat-notes').textContent=String(papers.filter(p=>p.notes.trim()||p.readingURL).length);
 $('nav-all').textContent=papers.length;
 $('nav-recent').textContent=papers.filter(recentPaper).length;
 $('nav-favorite').textContent=papers.filter(p=>p.favorite).length;
 $('nav-notes').textContent=papers.filter(p=>p.notes.trim()||p.readingURL).length;
}
function keywordControls(){
 const tags=[...new Set(getSource().flatMap(paperKeywords))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
 const host=$('filters'),signature=JSON.stringify(tags);
 if(host.dataset.signature!==signature){
  host.innerHTML=KEYWORD_GROUPS.map(group=>{const members=tags.filter(tag=>keywordGroup(tag)===group);return members.length?`<fieldset class="keyword-group"><legend>${escapeHTML(group)}</legend><div>${members.map(tag=>`<label class="keyword-choice"><input type="checkbox" data-keyword="${escapeHTML(tag)}"><span>${escapeHTML(tag)}</span></label>`).join('')}</div></fieldset>`:'';}).join('');host.dataset.signature=signature;
 }
 host.querySelectorAll('[data-keyword]').forEach(input=>{input.checked=activeKeywords.has(input.dataset.keyword);input.closest('label').classList.toggle('is-selected',input.checked);});
 $('keyword-selection').textContent=activeKeywords.size?'同时包含：'+[...activeKeywords].join(' + '):'可组合勾选；同时包含全部所选关键词';
 $('clear-keywords').disabled=!activeKeywords.size;
 $('search-indicator').hidden=!activeKeywords.size&&!$('search').value.trim();
}
function updateCarousel(found){window.dispatchEvent(new CustomEvent('paper-library:update',{detail:{papers:found.map(p=>coverPreviews.has(p.id)?{...p,coverURL:coverPreviews.get(p.id)}:p),isDemo}}));}
window.addEventListener('paper-library:carousel-ready',render);
window.addEventListener('paper-library:open',event=>detail(String(event.detail?.id||'')));
function render(){
 updateStats();keywordControls();$('demo-banner').hidden=!isDemo;
 const query=$('search').value.trim();
 let found=getSource().filter(p=>matchesPaper(p,query,activeKeywords));
 if(currentView==='favorite')found=found.filter(p=>p.favorite);
 if(currentView==='notes')found=found.filter(p=>p.notes.trim()||p.readingURL);
 if(currentView==='recent')found=found.filter(recentPaper);
 const sort=$('sort').value;
 found.sort((a,b)=>sort==='year'?(b.year||0)-(a.year||0):sort==='title'?a.title.localeCompare(b.title):b.readDate.localeCompare(a.readDate));
 updateCarousel(found);
 const scope=({all:'全部论文',recent:'最近 30 天阅读',favorite:'重点收藏',notes:'阅读笔记'})[currentView];
 $('shelf-scope').textContent=scope+(activeKeywords.size?' / '+[...activeKeywords].join('、'):'')+(query?' / 搜索：'+$('search').value.trim():'');
 $('shelf-state').textContent=isDemo?'示例书架 · 真实阅读记录 0 篇':`${papers.length} 篇已读论文 · GitHub 云端同步`;
 $('result-count').textContent=`${found.length} ${isDemo?'篇示例':'篇'}`;
 $('papers').innerHTML=found.map(p=>{
 const idx=[...new Set(getSource().map(x=>x.topic))].indexOf(p.topic)%3;
 return `<article class="paper-card" data-color="${idx}"><div class="card-top"><span class="paper-keywords">${paperKeywords(p).map(tag=>`<span class="keyword-tag">${escapeHTML(tag)}</span>`).join('')}${isDemo?' · 示例':''}</span><span class="card-star ${p.favorite?'filled':''}" title="${p.favorite?'重点收藏':'普通收藏'}">${starIcon(p.favorite)}</span></div><button class="card-open" data-detail="${escapeHTML(p.id)}" aria-label="查看 ${escapeHTML(p.title)}"><h3 class="paper-title">${escapeHTML(p.title)}</h3><span class="card-authors">${escapeHTML(p.authors||'作者待补充')}</span><span class="card-venue">${escapeHTML(p.venue||'期刊待补充')} ${p.year?' / '+p.year:''}</span><p class="card-summary">${escapeHTML(p.summary||'打开论文，回看阅读笔记。')}</p></button><div class="card-bottom"><span>◷ ${escapeHTML(p.readDate||'日期待补充')}</span><button data-detail="${escapeHTML(p.id)}">${p.notes.trim()?'▧ 阅读笔记':'查看详情'} ↗</button></div></article>`;
 }).join('');
 $('empty').hidden=found.length>0;
}
function detail(id){
 const p=getSource().find(x=>String(x.id)===id);if(!p)return;
 openReader(p,{isDemo,showDialog});
}
function normalizePaper(raw,issue){
 if(!raw||typeof raw!=='object'||typeof raw.title!=='string'||!raw.title.trim())return null;
 const keywords=paperKeywords(raw);if(!keywords.length)return null;
 const text=(key,max)=>typeof raw[key]==='string'?raw[key].slice(0,max):'';
 const readDate=/^\d{4}-\d{2}-\d{2}$/.test(raw.readDate||'')&&!isNaN(Date.parse(raw.readDate))?raw.readDate:issue.created_at.slice(0,10);
 return {id:String(raw.id||issue.number),title:text('title',250),keywords,topic:keywords.join('、'),authors:text('authors',200),venue:text('venue',120),year:Number.isInteger(raw.year)&&raw.year>=1600&&raw.year<=2100?raw.year:null,url:safeURL(raw.url),pdfURL:safeURL(raw.pdfURL),readingURL:safeURL(raw.readingURL),coverURL:safeURL(raw.coverURL),summary:text('summary',400),searchTerms:text('searchTerms',400),notes:text('notes',5000),favorite:raw.favorite===true,readDate,issueURL:issue.html_url,pdfSHA256:text('pdfSHA256',64)};
}
async function loadPapers(){
 if(busy)return;busy=true;$('refresh').disabled=true;$('cloud-status').classList.remove('error');$('cloud-status').textContent='正在读取书架';$('notice').hidden=true;
 const warnings=[];let catalog=null,issues=null,keywordSchema=0;
 try{
  const local=await fetch('./papers/library.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(local.ok){const data=await local.json();if(data.version===1&&Array.isArray(data.papers)){
   catalog=data.papers;keywordSchema=data.keywordSchema||0;
   papers=mergePapers([...pendingRecords.values()],catalog.filter(p=>p&&typeof p==='object').map(p=>normalizePaper(p,{number:p.id,created_at:'2026-11-03',html_url:p.issueURL||''})).filter(Boolean));
   isDemo=!papers.length;render();
  }}
 }catch{}
 try{
  const remote=await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/papers/library.json?ref=main&t=${Date.now()}`,{cache:'no-store',headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});
  if(remote.ok){const data=await remote.json();const parsed=JSON.parse(new TextDecoder().decode(fromBase64(data.content)));if(parsed.version===1&&Array.isArray(parsed.papers)){
   const published=new Map((catalog||[]).map(p=>[p.id,p]));
   catalog=parsed.papers.map(p=>{const local=published.get(p.id);return local&&keywordSchema>(parsed.keywordSchema||0)?{...p,keywords:local.keywords,topic:local.topic,searchTerms:local.searchTerms}:{...p,keywords:p.keywords?.length?p.keywords:local?.keywords};});
  }}
  else if(!catalog)warnings.push('云端目录暂时无法读取。');
 }catch{if(!catalog)warnings.push('云端目录连接待恢复。');}
 try{
  const collected=[];let invalid=0;
  for(let page=1;page<=10;page++){
   const response=await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/issues?state=open&creator=${OWNER}&per_page=100&page=${page}`,{cache:'no-store',headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw new Error('旧版 Issue 记录暂时无法更新。');
   const data=await response.json();if(!Array.isArray(data))throw new Error('旧版记录格式不正确。');
   for(const issue of data){
    if(issue.pull_request||issue.user?.login?.toLowerCase()!==OWNER.toLowerCase()||!issue.body?.includes(MARKER))continue;
    try{const match=issue.body.match(/```json\s*\n([\s\S]*?)\n```/);if(!match)throw new Error();const p=normalizePaper(JSON.parse(match[1]),issue);if(!p)throw new Error();collected.push(p);}catch{invalid++;}
   }
   if(data.length<100)break;
   if(page===10)throw new Error('Issue 记录超过一次读取范围（1000 条）。');
  }
  issues=collected;if(invalid)warnings.push(`有 ${invalid} 条旧版记录的 JSON 需要修复。`);
 }catch(error){warnings.push(error.message);}
 if(catalog!==null||issues!==null){
  const normalized=(catalog||[]).filter(p=>p&&typeof p==='object').map(p=>normalizePaper(p,{number:p.id,created_at:'2026-11-03',html_url:p.issueURL||''})).filter(Boolean);
  papers=mergePapers([...pendingRecords.values()],normalized,issues||[]);isDemo=!papers.length;render();
  $('cloud-status').textContent=warnings.length?'书架已载入 · 部分同步待恢复':'已从 GitHub 更新';
 }else{$('cloud-status').textContent='GitHub 连接待恢复';$('cloud-status').classList.add('error');}
 if(warnings.length){$('notice').textContent=warnings.join(' ')+' 可稍后刷新。';$('notice').hidden=false;}
 busy=false;$('refresh').disabled=false;
}
function localDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
const form=$('add-form');
function draftData(){const d=Object.fromEntries(new FormData(form));d.favorite=form.elements.favorite.checked;return d;}
function openAdd(){
 $('form-error').textContent='';
 if($('library-dialog').open)$('library-dialog').close();
 if(!form.elements.readDate.value)form.elements.readDate.value=localDate();
 showDialog($('add-dialog'));
}
try{const draft=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');if(draft){for(const [key,value] of Object.entries(draft)){const el=form.elements.namedItem(key==='topic'?'keywords':key);if(el){if(el.type==='checkbox')el.checked=value===true;else el.value=String(value);}}}}catch{}
form.addEventListener('input',()=>{try{localStorage.setItem(DRAFT_KEY,JSON.stringify(draftData()));}catch{}});
setupUploader({onSaved:(record,preview)=>{
 pendingRecords.set(record.id,record);coverPreviews.set(record.id,preview);
 papers=mergePapers([record],papers);isDemo=false;activeKeywords.clear();render();
 $('cloud-status').textContent='已保存到 GitHub';notify('论文已加入书架');
}});
document.addEventListener('click',event=>{
 const target=event.target.closest('[data-open-add],[data-open-library],[data-close],[data-detail],[data-topic],[data-view]');if(!target)return;
 if(target.hasAttribute('data-open-add'))openAdd();
 if(target.hasAttribute('data-open-library'))openLibrary();
 if(target.hasAttribute('data-close'))target.closest('dialog').close();
 if(target.hasAttribute('data-detail'))detail(target.dataset.detail);

 if(target.hasAttribute('data-view')){
  currentView=target.dataset.view;document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===currentView));
  $('view-name').textContent=({all:'全部论文',recent:'最近阅读',favorite:'重点收藏',notes:'阅读笔记'})[currentView];
  $('library-title').firstChild.textContent=({all:'我的论文书架 ',recent:'最近 30 天阅读 ',favorite:'重点收藏 ',notes:'我的阅读笔记 '})[currentView];render();if($('menu-dialog').open)$('menu-dialog').close();
 }
});
document.addEventListener('change',event=>{const input=event.target;if(!input.matches('[data-keyword]'))return;const tag=input.dataset.keyword;if(input.checked)activeKeywords.add(tag);else activeKeywords.delete(tag);render();});
$('clear-keywords').addEventListener('click',()=>{activeKeywords.clear();render();});
$('search-toggle').addEventListener('click',openLibrary);
$('search').addEventListener('input',render);$('sort').addEventListener('change',render);$('refresh').addEventListener('click',loadPapers);
$('clear-filters').addEventListener('click',()=>{activeKeywords.clear();$('search').value='';currentView='all';document.querySelector('[data-view="all"]').click();});
$('grid-view').addEventListener('click',()=>setLayout(false));$('list-view').addEventListener('click',()=>setLayout(true));
function setLayout(list){$('papers').classList.toggle('list',list);$('list-view').classList.toggle('active',list);$('grid-view').classList.toggle('active',!list);$('list-view').setAttribute('aria-pressed',String(list));$('grid-view').setAttribute('aria-pressed',String(!list));}
$('help-open').addEventListener('click',()=>showDialog($('help-dialog')));
function openLibrary(){showDialog($('library-dialog'));$('search').focus();}
$('menu-toggle').addEventListener('click',()=>{showDialog($('menu-dialog'));$('menu-toggle').setAttribute('aria-expanded','true');});
$('menu-dialog').addEventListener('close',()=>{$('menu-toggle').setAttribute('aria-expanded','false');});
$('motion-toggle').addEventListener('click',()=>{window.dispatchEvent(new Event('paper-library:toggle-motion'));});
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target!==dialog||dialog.dataset.busy==='true')return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}));
$('export').addEventListener('click',()=>{
 const blob=new Blob([JSON.stringify({version:1,repository:REPO_URL,exportedAt:new Date().toISOString(),papers},null,2)],{type:'application/json'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`paper-library-${localDate()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);notify(`已导出 ${papers.length} 篇真实论文记录`);
});
$('repo-link').href=REPO_URL;
document.addEventListener('keydown',event=>{if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)&&!document.querySelector('dialog[open]')){event.preventDefault();openLibrary();}});
render();loadPapers();

// The exhibition and utility drawer share one display mode and current selection.
document.querySelectorAll('[data-gallery-view]').forEach(button=>button.addEventListener('click',()=>{window.dispatchEvent(new CustomEvent('paper-library:display',{detail:button.dataset.galleryView}));$('menu-dialog').close();}));
$('selection-open').addEventListener('click',()=>window.dispatchEvent(new Event('paper-library:open-current')));
