import {Component, useEffect, useMemo, useRef, useState} from 'react';
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
function PaperCover({paper,index,demo,active}){
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
}
class GalleryBoundary extends Component {
 constructor(props){super(props);this.state={failed:false};}
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<p className="arc-fallback">轮播暂时无法显示。<button data-open-library>继续浏览完整书架 →</button></p>:this.props.children;}
}
function ArcIsland(){
 const [payload,setPayload]=useState(null),[active,setActive]=useState(0),[playing,setPlaying]=useState(false);
 const captionRef=useRef(null);
 useEffect(()=>{
  if(!captionRef.current||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const context=gsap.context(()=>{gsap.fromTo(captionRef.current.children,{y:14,autoAlpha:0},{y:0,autoAlpha:1,duration:.42,stagger:.035,ease:'power3.out'});},captionRef);
  return ()=>context.revert();
 },[active,payload]);
 useEffect(()=>{
  let last='';
  const receive=event=>{const value=event.detail;const signature=JSON.stringify(value);if(signature===last)return;last=signature;setPayload(value);setActive(0);};
  window.addEventListener('paper-library:update',receive);
  window.dispatchEvent(new Event('paper-library:carousel-ready'));
  return ()=>window.removeEventListener('paper-library:update',receive);
 },[]);
 useEffect(()=>{
  const toggle=()=>setPlaying(value=>!value);
  window.addEventListener('paper-library:toggle-motion',toggle);
  return ()=>window.removeEventListener('paper-library:toggle-motion',toggle);
 },[]);
 useEffect(()=>{
  const button=document.getElementById('motion-toggle');
  if(button){button.setAttribute('aria-pressed',String(playing));button.innerHTML=(playing?'暂停自动轮播':'开启自动轮播')+' <span>→</span>';}
 },[playing]);
 const selection=useMemo(()=>{
  if(!payload)return [];
  return payload.papers.map(p=>({...p,alt:p.title}));
 },[payload]);
 const current=selection[Math.min(active,selection.length-1)];
 const openPaper=paper=>window.dispatchEvent(new CustomEvent('paper-library:open',{detail:{id:paper.id}}));
 if(!payload)return <p className="arc-fallback">正在整理你的书架… <button data-open-library>查看全部论文 →</button></p>;
 if(!current)return <div className="arc-no-results"><h2>书架里暂时没有匹配的论文。</h2><button className="secondary" data-open-library>调整搜索与筛选 →</button></div>;
 return <>
  <div className="arc-stage-wrap">
   <DepthCarousel key={JSON.stringify(selection)} items={selection} cardWidth={268} cardHeight={366} radius={3} perspective={1800} duration={800} autoplay={playing} autoplayDelay={5600} showControls showIndicators onChange={index=>setActive(index)} onOpen={openPaper} renderCard={(paper,index,isActive)=><PaperCover paper={paper} index={index} demo={payload.isDemo} active={isActive}/>}/>
  </div>
  <div className="arc-bottom"><div className="arc-caption" ref={captionRef} aria-live={playing?'off':'polite'} aria-atomic="true"><span>{payload.isDemo?'示例文献':current.topic} · {active+1} / {selection.length}</span><h2>{current.title}</h2><p>{current.summary||current.topic}</p></div><button className="arc-open" onClick={()=>openPaper(current)}>打开{payload.isDemo?'示例笔记':'阅读笔记'} <span aria-hidden="true">↗</span></button></div>
  <div className="arc-utility"><span>滚轮翻阅 · 拖动 / ← →</span><button data-open-library>浏览全部论文 ↗</button></div>
 </>;
}
const host=document.getElementById('arc-gallery');
if(host)createRoot(host).render(<GalleryBoundary><ArcIsland/></GalleryBoundary>);
