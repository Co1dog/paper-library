import {Component, memo, useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import gsap from 'gsap';
import DepthCarousel from './components/DepthCarousel.jsx';
import './arc-gallery.css';

function PaperFigure({variant}) {
 const common={fill:'none',stroke:'currentColor',strokeWidth:1.2};
 return <svg viewBox="0 0 200 85" aria-hidden="true" className="paper-figure">
  {variant%4===0?<g {...common}><circle cx="79" cy="42" r="27"/><circle cx="119" cy="42" r="27"/><circle cx="79" cy="42" r="4"/><circle cx="119" cy="42" r="4"/><path d="M10 42h35m109 0h36M100 6v73" strokeDasharray="3 5"/></g>:
   variant%4===1?<g {...common}><path d="M10 65h180M10 18h180" opacity=".25"/>{[15,49,83,117,151].map((x,i)=><rect key={x} x={x} y={29+(i%2)*9} width="25" height={24-(i%2)*4}/>)}<path d="M40 42h8m26 0h8m26 0h8m26 0h8"/></g>:
   variant%4===2?<g {...common}><path d="M5 44h18l8-14 9 29 13-48 12 63 12-42 9 20 11-9h16l8-18 11 34 11-44 12 53 11-27 9 3h15"/><path d="M5 70h185M5 15h185" opacity=".2"/></g>:
   <g {...common}><path d="M30 62 67 22 103 56 143 17 175 50M30 62 103 56M67 22 143 17M67 22 88 75 143 17" opacity=".7"/>{[[30,62],[67,22],[103,56],[143,17],[175,50],[88,75]].map(([cx,cy])=><circle key={cx} cx={cx} cy={cy} r="5" fill="var(--cover-ground)"/>)}</g>}
 </svg>;
}
const PaperCover=memo(function PaperCover({paper,index,demo,active}){
 return <div className={`paper-volume cover-${index%4}${active?' is-current':''}`}>
 <div className="book-back" aria-hidden="true"/><div className="book-spine" aria-hidden="true"><span>Paper Library</span></div><div className="book-pages" aria-hidden="true"/><div className="book-pages-top" aria-hidden="true"/>
 <div className="paper-cover">
  <div className="cover-imprint"><span>Paper Library</span><span>{demo?'示例':paper.year||'文献'}</span></div>
  <span className="cover-topic">{paper.topic}</span>
  <div className="cover-title">{paper.title}</div>
  <div className="cover-authors">{paper.authors||'作者待补充'}</div>
  <PaperFigure variant={index}/>
  <div className="cover-foot"><span>{demo?'演示文献卡片':paper.venue||'我的阅读记录'}</span><span>{paper.favorite?'重点收藏':'阅读收藏'}</span></div>
 </div></div>;
});
class GalleryBoundary extends Component {
 constructor(props){super(props);this.state={failed:false};}
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<p className="arc-fallback">书架暂时无法显示。<button data-open-library>浏览论文目录 →</button></p>:this.props.children;}
}
function ArcIsland(){
 const [payload,setPayload]=useState(null),[active,setActive]=useState(0),[playing,setPlaying]=useState(false);
 const [mode,setMode]=useState(()=>{try{return localStorage.getItem('paper-library-display')==='list'?'list':'wheel';}catch{return 'wheel';}});
 const titleRef=useRef(null),previewRef=useRef(null),rowsRef=useRef([]),currentRef=useRef(null);
 const exhibitionRef=useRef(null),flightRef=useRef(null),switchModeRef=useRef(null);
 const [flight,setFlight]=useState(null);
 const selection=useMemo(()=>payload?payload.papers.map(p=>({...p,alt:p.title})):[],[payload]);
 const selectionKey=useMemo(()=>JSON.stringify(selection),[selection]);
 const selected=Math.min(active,Math.max(0,selection.length-1)),current=selection[selected];
 currentRef.current=current;
 const switchMode=next=>{
  next=next==='list'?'list':'wheel';if(next===mode)return;
  const source=mode==='list'?previewRef.current:exhibitionRef.current?.querySelectorAll('.depth-carousel__card')[selected];
  if(current&&source&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
   const box=source.getBoundingClientRect();
   setFlight({paper:current,index:selected,demo:payload.isDemo,from:{left:box.left,top:box.top,width:box.width,height:box.height}});
  }
  setMode(next);
 };
 switchModeRef.current=switchMode;
 const openPaper=paper=>{if(paper)window.dispatchEvent(new CustomEvent('paper-library:open',{detail:{id:paper.id}}));};
 useEffect(()=>{
  let last='';
  const receive=event=>{const value=event.detail,signature=JSON.stringify(value);if(signature===last)return;last=signature;setPayload(value);setActive(0);};
  const toggle=()=>setPlaying(value=>!value);
  const changeView=event=>switchModeRef.current?.(event.detail);
  const openCurrent=()=>openPaper(currentRef.current);
  window.addEventListener('paper-library:update',receive);
  window.addEventListener('paper-library:toggle-motion',toggle);
  window.addEventListener('paper-library:display',changeView);
  window.addEventListener('paper-library:open-current',openCurrent);
  window.dispatchEvent(new Event('paper-library:carousel-ready'));
  return ()=>{window.removeEventListener('paper-library:update',receive);window.removeEventListener('paper-library:toggle-motion',toggle);window.removeEventListener('paper-library:display',changeView);window.removeEventListener('paper-library:open-current',openCurrent);};
 },[]);
 useEffect(()=>{
  const button=document.getElementById('motion-toggle');
  if(button){button.setAttribute('aria-pressed',String(playing));button.innerHTML=(playing?'暂停自动轮播':'开启自动轮播')+' <span>→</span>';}
 },[playing]);
 useEffect(()=>{
  try{localStorage.setItem('paper-library-display',mode);}catch{}
  document.querySelectorAll('[data-gallery-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.galleryView===mode)));
 },[mode]);
 useEffect(()=>{
  const button=document.getElementById('selection-open');if(button)button.disabled=!current;
  if(!current||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const context=gsap.context(()=>{
   if(titleRef.current)gsap.fromTo(titleRef.current,{y:24,opacity:.3},{y:0,opacity:1,duration:.55,ease:'power3.out'});
   if(previewRef.current)gsap.fromTo(previewRef.current,{y:16,rotation:2,opacity:.4},{y:0,rotation:0,opacity:1,duration:.5,ease:'power3.out'});
  },titleRef);
  return ()=>context.revert();
 },[selected,mode,payload]);
 useEffect(()=>{
  if(!flight||!flightRef.current)return;
  const target=mode==='list'?previewRef.current:exhibitionRef.current?.querySelectorAll('.depth-carousel__card')[selected];
  if(!target){setFlight(null);return;}
  const box=target.getBoundingClientRect(),from=flight.from;
  const context=gsap.context(()=>{
   gsap.fromTo(flightRef.current,{x:0,y:0,scaleX:from.width/248,scaleY:from.height/340},{x:box.left-from.left,y:box.top-from.top,scaleX:box.width/248,scaleY:box.height/340,duration:.72,ease:'power3.inOut',onComplete:()=>setFlight(null)});
  },exhibitionRef);
  return ()=>context.revert();
 },[flight,mode]);
 const focusRow=(event,index)=>{
  if(event.key!=='ArrowDown'&&event.key!=='ArrowUp')return;
  event.preventDefault();const next=(index+(event.key==='ArrowDown'?1:-1)+selection.length)%selection.length;
  setActive(next);rowsRef.current[next]?.focus();rowsRef.current[next]?.scrollIntoView({block:'nearest'});
 };
 const titleScale=current?Math.max(.52,Math.min(1,Math.sqrt(46/Math.max(current.title.length,1)))):1;
 const next=selection[(selected+1)%selection.length];
 return <div ref={exhibitionRef} className={`exhibition exhibition--${mode}${flight?' is-transitioning':''}`} data-display={mode}>
  <div className="display-switch" role="group" aria-label="论文展示方式">
   <button aria-pressed={mode==='wheel'} onClick={()=>switchMode('wheel')}>Wheel</button><span aria-hidden="true">,</span><button aria-pressed={mode==='list'} onClick={()=>switchMode('list')}>List</button>
  </div>
  {!payload?<p className="arc-fallback">正在整理你的书架…</p>:!current?<div className="arc-no-results"><h2>没有匹配的论文</h2><button data-open-library>调整搜索与筛选 →</button></div>:<>
   <div className="exhibition-title" aria-live={playing?'off':'polite'} aria-atomic="true" style={{'--title-scale':titleScale}}><h2 ref={titleRef}>{current.title}</h2></div>
   {mode==='wheel'?<>
    <div className="arc-stage-wrap"><DepthCarousel key={selectionKey} items={selection} initialIndex={selected} cardWidth={248} cardHeight={340} radius={2} perspective={1800} duration={800} autoplay={playing} autoplayDelay={5600} showControls={false} showIndicators={false} showShadows={false} onChange={index=>setActive(index)} onOpen={openPaper} renderCard={(paper,index,isActive)=><PaperCover paper={paper} index={index} demo={payload.isDemo} active={isActive}/>}/></div>
    {selection.length>1&&<div className="exhibition-next" aria-hidden="true">{next.title}</div>}
   </>:<>
    <div className="exhibition-list" role="region" aria-label="论文标题目录"><ol>{selection.map((paper,index)=><li key={paper.id}><button ref={node=>{rowsRef.current[index]=node;}} className={selected===index?'is-current':''} aria-current={selected===index?'true':undefined} aria-label={`查看 ${paper.title}`} onPointerEnter={event=>{if(event.pointerType==='mouse')setActive(index);}} onFocus={()=>setActive(index)} onKeyDown={event=>focusRow(event,index)} onClick={()=>openPaper(paper)}><span className="list-position" aria-hidden="true">{index+1}</span><span className="list-title">{paper.title}</span></button></li>)}</ol></div>
    <button className="list-preview" ref={previewRef} aria-label={`打开 ${current.title} 的阅读笔记`} onClick={()=>openPaper(current)}><PaperCover paper={current} index={selected} demo={payload.isDemo} active/></button>
   </>}
   {flight&&<div ref={flightRef} className="cover-flight" aria-hidden="true" style={{left:flight.from.left,top:flight.from.top}}><PaperCover paper={flight.paper} index={flight.index} demo={flight.demo} active/></div>}
   <span className="exhibition-position" aria-label={`第 ${selected+1} 篇，共 ${selection.length} 篇${payload.isDemo?'示例':''}`}>{selected+1}<span> / {selection.length}{payload.isDemo?' · 示例':''}</span></span>
   <span className="exhibition-hint" aria-hidden="true">{mode==='wheel'?'Scroll ↕':'Select ↗'}</span>
  </>}
 </div>;
}
const host=document.getElementById('arc-gallery');
if(host)createRoot(host).render(<GalleryBoundary><ArcIsland/></GalleryBoundary>);
