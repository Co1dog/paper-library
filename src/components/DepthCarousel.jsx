// A DOM wheel carousel inspired by the circular motion of the supplied CRL reference.
// GSAP drives one shared playhead; cards follow a circular orbit without a WebGL dependency.
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import gsap from 'gsap';
import './DepthCarousel.css';

const clamp=(value,min,max)=>Math.min(Math.max(value,min),max);
const wrap=(value,count)=>((value%count)+count)%count;

export default function DepthCarousel({items=[],cardWidth=268,cardHeight=366,radius=3,perspective=1600,
 duration=760,initialIndex=0,autoplay=false,autoplayDelay=5600,onChange,onOpen,renderCard,className='',showControls=true,showIndicators=true}){
 const data=useMemo(()=>items.map(item=>typeof item==='string'?{image:item,alt:''}:item),[items]);
 const count=data.length;
 const rootRef=useRef(null),stageRef=useRef(null),cardsRef=useRef([]),shadowsRef=useRef([]);
 const posRef=useRef(initialIndex),targetRef=useRef(initialIndex),activeRef=useRef(initialIndex),pullRef=useRef(0),scaleRef=useRef(1);
 const sizeRef=useRef({width:900,height:600});
 const playhead=useRef({p:initialIndex}),driveRef=useRef(null),dragRef=useRef(null),wheelTimer=useRef(null),clickTimer=useRef(null);
 const reducedRef=useRef(false),suppressClick=useRef(false),intersecting=useRef(true);
 const changeRef=useRef(onChange),openRef=useRef(onOpen);
 changeRef.current=onChange;openRef.current=onOpen;
 const [active,setActive]=useState(initialIndex);

 const layout=useCallback(position=>{
  if(!count||!rootRef.current)return;
  posRef.current=position;
  const {width,height}=sizeRef.current,scale=scaleRef.current;
  const orbitRadius=Math.min(width*.9,height*1.7);
  const step=width<600?.45:.38;
  const limit=Math.min(2.8,(count-1)/2);
  const force=reducedRef.current?0:clamp(targetRef.current-position,-1.2,1.2);
  pullRef.current+=(force-pullRef.current)*.16;
  const pull=pullRef.current;
  const selected=wrap(Math.round(position),count);
  if(selected!==activeRef.current){activeRef.current=selected;setActive(selected);changeRef.current?.(selected,data[selected]);}
  rootRef.current.dataset.activeIndex=String(selected);
  rootRef.current.dataset.wheelPosition=position.toFixed(3);
  for(let i=0;i<count;i++){
   const card=cardsRef.current[i];if(!card)continue;
   let distance=wrap(i-position,count);if(distance>count/2)distance-=count;
   const absolute=Math.abs(distance);
   const opacity=count===1?1:clamp((limit+.45-absolute)*2.2,0,1);
   if(opacity<=.001){card.style.visibility='hidden';card.style.pointerEvents='none';card.setAttribute('aria-hidden','true');if(shadowsRef.current[i])shadowsRef.current[i].style.opacity='0';continue;}
   const angle=distance*step;
   const x=orbitRadius*Math.sin(angle),y=orbitRadius*(1-Math.cos(angle));
   const rotation=angle*180/Math.PI*1.12+pull*3;
   const z=-absolute*13;
   card.style.visibility='visible';card.style.opacity=String(opacity);card.style.pointerEvents='auto';
   card.style.zIndex=String(Math.round(2000-absolute*100));
   card.style.transform=`translate(-50%,-50%) translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px) rotateZ(${rotation.toFixed(2)}deg) rotateY(${(-distance*2.5+pull*4).toFixed(2)}deg) rotateX(-2deg) skewY(${(-pull*1.2).toFixed(2)}deg) scale(${scale})`;
   card.setAttribute('aria-hidden','false');
   const shadow=shadowsRef.current[i];
   if(shadow){shadow.style.opacity=String(opacity*.075);shadow.style.transform=`translate(-50%,-50%) translate3d(${x.toFixed(2)}px,${(y+cardHeight*scale*.57+20).toFixed(2)}px,-40px) rotateZ(${rotation.toFixed(2)}deg) scale(${scale})`;}
  }
 },[count,data,cardHeight]);

 const moveTo=useCallback((target,immediate=false)=>{
  if(!count)return;
  targetRef.current=target;
  if(immediate||reducedRef.current){driveRef.current?.tween.pause();playhead.current.p=target;pullRef.current=0;layout(target);}
  else driveRef.current?.(target);
 },[count,layout]);
 const focus=useCallback(index=>{
  if(!count)return;
  const selected=wrap(index,count);let delta=selected-posRef.current;
  delta=wrap(delta,count);if(delta>count/2)delta-=count;
  moveTo(posRef.current+delta);
 },[count,moveTo]);
 const navigate=useCallback(step=>{clearTimeout(wheelTimer.current);moveTo(Math.round(targetRef.current)+step);},[moveTo]);

 useEffect(()=>{
  const context=gsap.context(()=>{
   driveRef.current=gsap.quickTo(playhead.current,'p',{duration:duration/1000,ease:'power3.out',onUpdate:()=>layout(playhead.current.p),onComplete:()=>{pullRef.current=0;layout(playhead.current.p);}});
  },rootRef);
  layout(posRef.current);
  return ()=>{context.revert();driveRef.current=null;};
 },[duration,layout]);

 useEffect(()=>{
  const root=rootRef.current;if(!root)return;
  const resize=new ResizeObserver(([entry])=>{
   const {width,height}=entry.contentRect;sizeRef.current={width,height};
   scaleRef.current=clamp(Math.min(width/(cardWidth*2.25),(height-75)/(cardHeight*1.15)),.46,1);
   root.style.setProperty('--dc-scale',scaleRef.current);
   layout(posRef.current);
  });resize.observe(root);return ()=>resize.disconnect();
 },[cardWidth,cardHeight,layout]);

 useEffect(()=>{
  const root=rootRef.current,area=root?.closest('main')||root;if(!area)return;
  const wheel=event=>{
   if(count<2||event.ctrlKey||event.metaKey||document.querySelector('dialog[open]'))return;
   // A phone can scroll its reading text normally; the wheel itself still accepts trackpad input.
   if(innerWidth<=760&&!root.contains(event.target))return;
   const raw=Math.abs(event.deltaY)>=Math.abs(event.deltaX)?event.deltaY:event.deltaX;
   if(!raw)return;
   event.preventDefault();clearTimeout(wheelTimer.current);
   const pixels=raw*(event.deltaMode===1?20:event.deltaMode===2?innerHeight:1);
   if(reducedRef.current){wheelTimer.current=setTimeout(()=>navigate(Math.sign(pixels)),90);return;}
   moveTo(targetRef.current+clamp(pixels/180,-1.25,1.25));
   wheelTimer.current=setTimeout(()=>moveTo(Math.round(targetRef.current)),170);
  };
  area.addEventListener('wheel',wheel,{passive:false});
  return ()=>{area.removeEventListener('wheel',wheel);clearTimeout(wheelTimer.current);};
 },[count,moveTo,navigate]);

 const pointerDown=event=>{
  if(count<2||event.target.closest('button,a')||event.button>0)return;
  clearTimeout(wheelTimer.current);driveRef.current?.tween.pause();targetRef.current=posRef.current;
  suppressClick.current=false;
  dragRef.current={x:event.clientX,y:event.clientY,start:posRef.current,last:event.clientX,lastY:event.clientY,time:performance.now(),velocity:0,moved:false,id:event.pointerId,axis:null};
 };
 const pointerMove=event=>{
  const drag=dragRef.current;if(!drag)return;
  const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
  if(!drag.moved&&Math.hypot(dx,dy)>5){drag.moved=true;drag.axis=Math.abs(dx)>=Math.abs(dy)?'x':'y';rootRef.current.setPointerCapture(drag.id);}
  if(!drag.moved)return;
  const now=performance.now(),time=Math.max(1,now-drag.time),isX=drag.axis==='x';
  drag.velocity=((isX?event.clientX:event.clientY)-(isX?drag.last:drag.lastY))/time;
  drag.last=event.clientX;drag.lastY=event.clientY;drag.time=now;
  const travel=isX?dx:dy,step=Math.max(cardWidth*scaleRef.current*.75,90);
  const position=drag.start-travel/step;
  targetRef.current=position-drag.velocity*.09;
  playhead.current.p=position;layout(position);
 };
 const pointerEnd=()=>{
  const drag=dragRef.current;if(!drag)return;dragRef.current=null;
  if(!drag.moved)return;
  suppressClick.current=true;clearTimeout(clickTimer.current);clickTimer.current=setTimeout(()=>{suppressClick.current=false;},220);
  if(rootRef.current.hasPointerCapture(drag.id))rootRef.current.releasePointerCapture(drag.id);
  const velocity=performance.now()-drag.time<100?drag.velocity:0;
  const projected=posRef.current-clamp(velocity*.4,-1.4,1.4);
  moveTo(Math.round(projected));
 };
 const openCard=index=>{if(suppressClick.current)return;if(index===activeRef.current)openRef.current?.(data[index]);else focus(index);};

 useEffect(()=>{
  const query=matchMedia('(prefers-reduced-motion: reduce)');
  const update=()=>{reducedRef.current=query.matches;if(query.matches)moveTo(Math.round(posRef.current),true);};
  update();query.addEventListener('change',update);
  const observer=new IntersectionObserver(([entry])=>{intersecting.current=entry.isIntersecting;});
  if(rootRef.current)observer.observe(rootRef.current);
  return ()=>{query.removeEventListener('change',update);observer.disconnect();};
 },[moveTo]);
 useEffect(()=>{
  if(!autoplay||count<2)return;
  const timer=setInterval(()=>{if(!reducedRef.current&&!document.hidden&&intersecting.current&&!dragRef.current&&!document.querySelector('dialog[open]')&&!cardsRef.current.some(card=>card?.matches(':hover'))&&!rootRef.current?.contains(document.activeElement))navigate(1);},Math.max(autoplayDelay,1200));
  return ()=>clearInterval(timer);
 },[autoplay,autoplayDelay,count,navigate]);
 useEffect(()=>()=>{clearTimeout(wheelTimer.current);clearTimeout(clickTimer.current);},[]);

 return <div ref={rootRef} className={`depth-carousel wheel-carousel ${className}`} style={{'--dc-perspective':`${perspective}px`}} role="group" aria-roledescription="carousel" aria-label="论文循环轮盘，滚轮、拖动或左右方向键翻阅" tabIndex={0}
  onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}
  onKeyDown={event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();navigate(event.key==='ArrowRight'?1:-1);}}}>
  <div className="depth-carousel__stage" ref={stageRef}>
   {data.map((_,i)=><div key={'shadow-'+i} ref={el=>{shadowsRef.current[i]=el;}} className="depth-carousel__shadow" aria-hidden="true"/>)}
   {data.map((item,i)=><div key={item.id??i} ref={el=>{cardsRef.current[i]=el;}} className="depth-carousel__card" style={{width:cardWidth,height:cardHeight,borderRadius:radius}} role="button" tabIndex={active===i?0:-1} aria-roledescription="slide" aria-label={`${i+1} / ${count}：${item.alt||item.title}`} onClick={()=>openCard(i)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openCard(i);}}}>
    {renderCard?renderCard(item,i,active===i):<img src={item.image} alt={item.alt||''} draggable={false}/>}
   </div>)}
  </div>
  {showControls&&count>1&&<><button type="button" className="depth-carousel__arrow depth-carousel__arrow--prev" aria-label="上一篇论文" onClick={()=>navigate(-1)}>←</button><button type="button" className="depth-carousel__arrow depth-carousel__arrow--next" aria-label="下一篇论文" onClick={()=>navigate(1)}>→</button></>}
  {showIndicators&&count>1&&count<=8&&<div className="depth-carousel__dots" role="group" aria-label="选择轮盘论文">{data.map((item,i)=><button key={item.id??i} type="button" className={`depth-carousel__dot${active===i?' is-active':''}`} aria-pressed={active===i} aria-label={`切换到第 ${i+1} 篇：${item.alt}`} onClick={()=>focus(i)}/>)}</div>}
 </div>;
}
