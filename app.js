'use strict';
const OWNER = 'Co1dog';
const REPO = 'paper-library';
const REPO_URL = `https://github.com/${OWNER}/${REPO}`;
const MARKER = '<!-- paper-library:v1 -->';
const DRAFT_KEY = 'paper-library-draft-v1';
const DEMO = [
 {id:'demo-1',title:'Anticipatory gaze & event memory',authors:'示例作者',year:2025,venue:'示例期刊',topic:'眼动与记忆',summary:'示例收获：把研究问题、关键方法和自己的想法，留在同一个地方。',notes:'这是一条演示笔记，不是真实论文结论。\n\n研究问题\n这篇论文试图回答什么？\n\n方法与证据\n哪些实验真正支撑了结论？\n\n我的想法\n它和正在进行的研究有什么联系？',readDate:'2026-10-22',favorite:true},
 {id:'demo-2',title:'How the brain organizes continuous experience',authors:'示例作者',year:2025,venue:'示例期刊',topic:'事件记忆',summary:'示例收获：一句话写下最值得记住的观点，下次回看时迅速找回阅读线索。',notes:'这是一条演示笔记，不是真实文献记录。\n\n可以记录事件边界、实验设计，以及需要重新查看的 Figure。',readDate:'2026-10-20',favorite:true},
 {id:'demo-3',title:'Neural dynamics during naturalistic viewing',authors:'示例作者',year:2026,venue:'示例预印本',topic:'自然情境 EEG',summary:'示例收获：给同一研究方向的论文一个主题，让相关的阅读自然聚在一起。',notes:'',readDate:'2026-10-18',favorite:false},
 {id:'demo-4',title:'From perception to episodic recollection',authors:'示例作者',year:2024,venue:'示例期刊',topic:'事件记忆',summary:'示例收获：保留原始标题与作者，查找时可以同时搜索中文笔记和英文关键词。',notes:'这是一条演示笔记。\n\n记录核心变量、行为指标，以及文章仍没有回答的问题。',readDate:'2026-10-15',favorite:false},
 {id:'demo-5',title:'A computational lens on human memory',authors:'示例作者',year:2025,venue:'示例会议',topic:'计算模型',summary:'示例收获：记录一个方法如何解释现象，以及它能如何迁移到自己的研究。',notes:'',readDate:'2026-10-12',favorite:true},
 {id:'demo-6',title:'Eye movements as a window into cognition',authors:'示例作者',year:2023,venue:'示例期刊',topic:'眼动与记忆',summary:'示例收获：把值得重读的论文标为重点收藏，让好想法随时可以重新打开。',notes:'',readDate:'2026-10-10',favorite:false}
];
let papers = [], currentView = 'all', activeTopics = new Set(), isDemo = true, busy = false;
const $ = id => document.getElementById(id);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL = value => {try {const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'';} catch{return '';}};
function starIcon(filled){return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"${filled?' style="fill:currentColor"':''}><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.8-5.4 2.8 1-6-4.4-4.3 6.1-.9Z"/></svg>`;}
function notify(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('toast').hidden=true,3500);}
function showDialog(dialog){if(!dialog.open)dialog.showModal();}
function getSource(){return isDemo?DEMO:papers;}
function recentPaper(p){const d=new Date(p.readDate+'T00:00:00');const now=new Date();const days=(new Date(now.getFullYear(),now.getMonth(),now.getDate())-d)/86400000;return days>=0&&days<=30;}
function updateStats(){
 const topics=new Set(papers.map(p=>p.topic));
 $('stat-papers').textContent=String(papers.length);
 $('stat-topics').textContent=String(topics.size);
 $('stat-notes').textContent=String(papers.filter(p=>p.notes.trim()).length);
 $('nav-all').textContent=papers.length;
 $('nav-recent').textContent=papers.filter(recentPaper).length;
 $('nav-favorite').textContent=papers.filter(p=>p.favorite).length;
 $('nav-notes').textContent=papers.filter(p=>p.notes.trim()).length;
}
function topicControls(){
 const topics=[...new Set(getSource().map(p=>p.topic))];
 $('filters').innerHTML='<button class="chip'+(!activeTopics.size?' active':'')+'" data-topic="">全部主题</button>'+topics.map(t=>`<button class="chip${activeTopics.has(t)?' active':''}" data-topic="${escapeHTML(t)}" aria-pressed="${activeTopics.has(t)}">${escapeHTML(t)}</button>`).join('');
 $('sidebar-topics').innerHTML=topics.map(t=>`<button class="topic-item${activeTopics.has(t)?' active':''}" data-topic="${escapeHTML(t)}"><span class="topic-dot"></span>${escapeHTML(t)}${isDemo?' <span class="demo-label">示例</span>':''}</button>`).join('')||'<p class="sidebar-empty">添加论文后，<br>主题会在这里慢慢生长。</p>';
}
function updateCarousel(){window.dispatchEvent(new CustomEvent('paper-library:update',{detail:{papers:getSource(),isDemo}}));}
window.addEventListener('paper-library:carousel-ready',updateCarousel);
window.addEventListener('paper-library:open',event=>detail(String(event.detail?.id||'')));
function render(){
 updateCarousel();updateStats();topicControls();$('demo-banner').hidden=!isDemo;
 const query=$('search').value.trim().toLocaleLowerCase();
 let found=getSource().filter(p=>(!activeTopics.size||activeTopics.has(p.topic))&&(!query||[p.title,p.authors,p.venue,p.topic,p.summary,p.notes,String(p.year)].join(' ').toLocaleLowerCase().includes(query)));
 if(currentView==='favorite')found=found.filter(p=>p.favorite);
 if(currentView==='notes')found=found.filter(p=>p.notes.trim());
 if(currentView==='recent')found=found.filter(recentPaper);
 const sort=$('sort').value;
 found.sort((a,b)=>sort==='year'?(b.year||0)-(a.year||0):sort==='title'?a.title.localeCompare(b.title):b.readDate.localeCompare(a.readDate));
 $('result-count').textContent=`${found.length} ${isDemo?'篇示例':'篇'}`;
 $('papers').innerHTML=found.map(p=>{
 const idx=[...new Set(getSource().map(x=>x.topic))].indexOf(p.topic)%3;
 return `<article class="paper-card" data-color="${idx}"><div class="card-top"><span class="topic-pill">${escapeHTML(p.topic)}${isDemo?' · 示例':''}</span><span class="card-star ${p.favorite?'filled':''}" title="${p.favorite?'重点收藏':'普通收藏'}">${starIcon(p.favorite)}</span></div><button class="card-open" data-detail="${escapeHTML(p.id)}" aria-label="查看 ${escapeHTML(p.title)}"><h3 class="paper-title">${escapeHTML(p.title)}</h3><span class="card-authors">${escapeHTML(p.authors||'作者待补充')}</span><span class="card-venue">${escapeHTML(p.venue||'期刊待补充')} ${p.year?' / '+p.year:''}</span><p class="card-summary">${escapeHTML(p.summary||'打开论文，回看阅读笔记。')}</p></button><div class="card-bottom"><span>◷ ${escapeHTML(p.readDate||'日期待补充')}</span><button data-detail="${escapeHTML(p.id)}">${p.notes.trim()?'▧ 阅读笔记':'查看详情'} ↗</button></div></article>`;
 }).join('');
 $('empty').hidden=found.length>0;
}
function detail(id){
 const p=getSource().find(x=>String(x.id)===id);if(!p)return;
 const url=safeURL(p.url),issue=safeURL(p.issueURL);
 $('detail-content').innerHTML=`<div class="detail-source">${isDemo?'示例文献':'来自我的书架'}</div><h2 class="detail-title">${escapeHTML(p.title)}</h2><div class="detail-meta">${escapeHTML(p.authors||'作者待补充')}<br>${escapeHTML(p.venue||'期刊待补充')} ${p.year?' / '+p.year:''}<br><span class="topic-pill">${escapeHTML(p.topic)}</span>　阅读于 ${escapeHTML(p.readDate)} ${p.favorite?' · 重点收藏':''}</div>${p.summary?`<div class="detail-summary">${escapeHTML(p.summary)}</div>`:''}<h3 class="notes-heading">READING NOTES / 阅读笔记</h3><div class="detail-notes">${escapeHTML(p.notes||'还没有笔记。可以在 GitHub 中补充你的想法。')}</div><div class="detail-actions">${url?`<a class="primary" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">打开原文 ↗</a>`:''}${issue?`<a class="secondary" href="${escapeHTML(issue)}" target="_blank" rel="noopener noreferrer">在 GitHub 编辑 ↗</a>`:''}</div>${isDemo?'<div class="detail-demo">这是设计示例，不是真实文献条目。添加你的第一篇论文后，书架会显示自己的阅读记录。</div>':''}`;
 showDialog($('detail-dialog'));
}
function normalizePaper(raw,issue){
 if(!raw||typeof raw!=='object'||typeof raw.title!=='string'||!raw.title.trim()||typeof raw.topic!=='string'||!raw.topic.trim())return null;
 const text=(key,max)=>typeof raw[key]==='string'?raw[key].slice(0,max):'';
 const readDate=/^\d{4}-\d{2}-\d{2}$/.test(raw.readDate||'')&&!isNaN(Date.parse(raw.readDate))?raw.readDate:issue.created_at.slice(0,10);
 return {id:String(issue.number),title:text('title',250),topic:text('topic',60),authors:text('authors',200),venue:text('venue',120),year:Number.isInteger(raw.year)&&raw.year>=1600&&raw.year<=2100?raw.year:null,url:safeURL(raw.url),summary:text('summary',400),notes:text('notes',5000),favorite:raw.favorite===true,readDate,issueURL:issue.html_url};
}
async function loadPapers(){
 if(busy)return;busy=true;$('refresh').disabled=true;$('cloud-status').classList.remove('error');$('cloud-status').textContent='◌ 正在读取 GitHub';$('notice').hidden=true;
 try{
  const collected=[];let invalid=0;
  for(let page=1;page<=10;page++){
   const response=await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/issues?state=open&creator=${OWNER}&per_page=100&page=${page}`,{cache:'no-store',headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw new Error(response.status===403||response.status===429?'GitHub 读取频率达到上限，请稍后刷新。':response.status===404?'暂时无法找到公开仓库，请稍后刷新。':`GitHub 暂时无法读取（${response.status}）。`);
   const issues=await response.json();if(!Array.isArray(issues))throw new Error('GitHub 返回的记录格式不正确。');
   for(const issue of issues){
    if(issue.pull_request||issue.user?.login?.toLowerCase()!==OWNER.toLowerCase()||!issue.body?.includes(MARKER))continue;
    try{
     const match=issue.body.match(/```json\s*\n([\s\S]*?)\n```/);
     if(!match)throw new Error('No JSON');
     const p=normalizePaper(JSON.parse(match[1]),issue);if(!p)throw new Error('Invalid record');collected.push(p);
    }catch{invalid++;}
   }
   if(issues.length<100)break;
   if(page===10)throw new Error('记录超过一次读取范围（1000 条）。请归档早期记录后再刷新。');
  }
  papers=collected;isDemo=!papers.length;activeTopics.clear();
  $('cloud-status').textContent='已从 GitHub 更新';
  if(invalid){$('notice').textContent=`有 ${invalid} 条记录的 JSON 格式需要修复；其他论文已正常显示。请在 GitHub 查看。`;$('notice').hidden=false;}
  render();
 }catch(error){
  $('cloud-status').textContent='○ GitHub 连接待恢复';$('cloud-status').classList.add('error');
  $('notice').textContent=error.message+' 页面保留当前内容；可点击右上角刷新重试。';$('notice').hidden=false;
 }finally{busy=false;$('refresh').disabled=false;}
}
function localDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
const form=$('add-form');
function draftData(){const d=Object.fromEntries(new FormData(form));d.favorite=form.elements.favorite.checked;return d;}
function openAdd(){
 $('form-error').textContent='';
 if(!form.elements.readDate.value)form.elements.readDate.value=localDate();
 showDialog($('add-dialog'));
}
try{const draft=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');if(draft){for(const [key,value] of Object.entries(draft)){const el=form.elements.namedItem(key);if(el){if(el.type==='checkbox')el.checked=value===true;else el.value=String(value);}}}}catch{}
form.addEventListener('input',()=>{try{localStorage.setItem(DRAFT_KEY,JSON.stringify(draftData()));}catch{}});
form.addEventListener('submit',event=>{
 event.preventDefault();$('form-error').textContent='';if(!form.reportValidity())return;
 const raw=draftData();
 if(raw.url&&!safeURL(raw.url)){$('form-error').textContent='原文链接请使用 https:// 或 http://。';return;}
 const record={...raw,title:raw.title.trim(),topic:raw.topic.trim(),year:raw.year?Number(raw.year):null};
 if(!record.title||!record.topic){$('form-error').textContent='请填写论文标题与研究主题。';return;}
 // JSON code fences inside notes must not terminate the outer code block.
 const json=JSON.stringify(record,null,2).replace(/`/g,'\\u0060');
 const body=`${MARKER}\n\n这是一条 Paper Library 阅读记录。编辑时请保留下方 JSON 格式。\n\n\`\`\`json\n${json}\n\`\`\``;
 const url=new URL(`${REPO_URL}/issues/new`);url.searchParams.set('title','[Paper] '+record.title);
 let transfer=$('transfer');if(transfer)transfer.remove();
 if(encodeURIComponent(body).length+url.href.length<7500){url.searchParams.set('body',body);}
 else{
  transfer=document.createElement('div');transfer.id='transfer';
  const hint=document.createElement('p');hint.className='form-hint';hint.textContent='这篇笔记较长。请复制下面的完整记录，在 GitHub 新 Issue 的正文中粘贴后提交。';
  const area=document.createElement('textarea');area.readOnly=true;area.value=body;area.rows=5;area.setAttribute('aria-label','待粘贴到 GitHub 的完整论文记录');
  const copy=document.createElement('button');copy.type='button';copy.className='secondary full';copy.textContent='复制完整记录';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(body);notify('已复制，请到 GitHub 正文中粘贴');}catch{area.select();notify('请手动复制已选中的记录');}});
  transfer.append(hint,area,copy);$('submit-link').before(transfer);
 }
 $('submit-link').href=url.href;$('submit-link').hidden=false;$('submit-link').textContent=transfer?'记录已准备好，前往 GitHub 粘贴并提交 ↗':'记录已准备好，点击前往 GitHub 确认提交 ↗';
 $('submit-link').scrollIntoView({block:'nearest',behavior:'smooth'});
});
document.addEventListener('click',event=>{
 const target=event.target.closest('[data-open-add],[data-close],[data-detail],[data-topic],[data-view]');if(!target)return;
 if(target.hasAttribute('data-open-add'))openAdd();
 if(target.hasAttribute('data-close'))target.closest('dialog').close();
 if(target.hasAttribute('data-detail'))detail(target.dataset.detail);
 if(target.hasAttribute('data-topic')){const topic=target.dataset.topic;if(!topic)activeTopics.clear();else if(activeTopics.has(topic))activeTopics.delete(topic);else activeTopics.add(topic);render();}
 if(target.hasAttribute('data-view')){
  currentView=target.dataset.view;document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===currentView));
  $('view-name').textContent=({all:'全部论文',recent:'最近阅读',favorite:'重点收藏',notes:'阅读笔记'})[currentView];
  $('library-title').firstChild.textContent=({all:'我的论文书架 ',recent:'最近 30 天阅读 ',favorite:'重点收藏 ',notes:'我的阅读笔记 '})[currentView];render();
 }
});
$('search').addEventListener('input',render);$('sort').addEventListener('change',render);$('refresh').addEventListener('click',loadPapers);
$('clear-filters').addEventListener('click',()=>{activeTopics.clear();$('search').value='';currentView='all';document.querySelector('[data-view="all"]').click();});
$('grid-view').addEventListener('click',()=>setLayout(false));$('list-view').addEventListener('click',()=>setLayout(true));
function setLayout(list){$('papers').classList.toggle('list',list);$('list-view').classList.toggle('active',list);$('grid-view').classList.toggle('active',!list);$('list-view').setAttribute('aria-pressed',String(list));$('grid-view').setAttribute('aria-pressed',String(!list));}
$('help-open').addEventListener('click',()=>showDialog($('help-dialog')));
$('help-mobile').addEventListener('click',()=>showDialog($('help-dialog')));
$('export').addEventListener('click',()=>{
 const blob=new Blob([JSON.stringify({version:1,repository:REPO_URL,exportedAt:new Date().toISOString(),papers},null,2)],{type:'application/json'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`paper-library-${localDate()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);notify(`已导出 ${papers.length} 篇真实论文记录`);
});
$('repo-link').href=REPO_URL;
document.addEventListener('keydown',event=>{if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)&&!document.querySelector('dialog[open]')){event.preventDefault();$('search').focus();}});
render();loadPapers();
