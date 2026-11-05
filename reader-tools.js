// Keep the embedded commentary's navigation independent of XRAY's desktop grid.
export function connectReadingTools(doc){
 const nav=doc.querySelector('#xrNav'),theme=doc.querySelector('#xrTheme'),toc=doc.querySelector('.wrap > .toc');
 const events=new AbortController(),on=(node,type,fn)=>node?.addEventListener(type,fn,{signal:events.signal});
 const oldNav=nav?.onclick,oldTheme=theme?.onclick;
 const setOpen=(open,focus=false)=>{
  doc.body.classList.toggle('library-toc-open',open);
  nav?.setAttribute('aria-expanded',String(open));
  if(nav){nav.textContent=open?'收起目录':'目录';nav.title=open?'收起章节目录':'打开章节目录';}
  if(toc){toc.inert=!open;toc.setAttribute('aria-hidden',String(!open));}
  if(focus)(open?toc?.querySelector('a'):nav)?.focus();
 };
 if(nav&&toc){
  toc.id||='library-toc';toc.setAttribute('aria-label','解读章节目录');
  nav.setAttribute('aria-controls',toc.id);nav.setAttribute('aria-label','章节目录');
  nav.onclick=()=>setOpen(!doc.body.classList.contains('library-toc-open'),true);
  on(toc,'click',event=>{
   const link=event.target.closest('a[href^="#"]');if(!link)return;
   setOpen(false);
   // The original handler reveals folded sections; focus the resulting heading.
   const heading=doc.getElementById(decodeURIComponent(link.hash.slice(1)));
   if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
  });
  on(doc,'pointerdown',event=>{if(!toc.contains(event.target)&&!nav.contains(event.target))setOpen(false);});
  on(doc,'keydown',event=>{if(event.key==='Escape'&&doc.body.classList.contains('library-toc-open')){event.preventDefault();event.stopPropagation();setOpen(false,true);}});
  setOpen(false);
 }
 const paintTheme=()=>{
  if(!theme)return;
  const light=doc.documentElement.dataset.theme==='light';
  theme.textContent=light?'深色阅读':'明亮阅读';
  theme.title=light?'切换为深色阅读':'切换为明亮阅读';
  theme.setAttribute('aria-label',theme.title);theme.setAttribute('aria-pressed',String(light));
 };
 if(theme){theme.onclick=()=>{doc.documentElement.dataset.theme=doc.documentElement.dataset.theme==='light'?'dark':'light';paintTheme();};paintTheme();}
 // These actions already have their single, persistent controls above the iframe.
 for(const id of ['xrPen','xrSave']){const button=doc.getElementById(id);if(button)button.hidden=true;}
 const hint=doc.querySelector('main .reading-start');
 if(hint)hint.textContent='选中文字可划线、写笔记或标记阅读反馈。标注开关与「下载笔记副本」位于阅读区顶部，连接 GitHub 后笔记会自动同步。各节标题左侧可折叠内容。';
 return ()=>{events.abort();setOpen(false);if(nav)nav.onclick=oldNav;if(theme)theme.onclick=oldTheme;};
}
