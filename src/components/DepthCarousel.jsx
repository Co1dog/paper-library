// Adapted from React Bits DepthCarousel (live JS-CSS registry, 2026-10-23).
// Changes: symmetric arc, semantic paper covers, owner-library events, safe drag and optional autoplay.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import './DepthCarousel.css';



const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const normalizeItem = it => (typeof it === 'string' ? { image: it, alt: '' } : it);

const DepthCarousel = ({
  items = [],
  cardWidth = 300,
  cardHeight = 380,
  radius = 18,
  tint = '#05060a',
  depth = 220,
  spread = 90,
  tilt = 22,
  tiltDirection = 'right',
  perspective = 1400,
  visibleCards = 4,
  falloff = 0.2,
  blur = 6,
  duration = 700,
  ease = 'power3.out',
  autoplay = false,
  autoplayDelay = 3200,
  loop = true,
  showControls = true,
  showIndicators = true,
  onChange,
  onOpen,
  renderCard,
  className = ''
}) => {
  const data = useMemo(() => (Array.isArray(items) ? items : []).map(normalizeItem), [items]);
  const count = data.length;

  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const cardRefs = useRef([]);
  const overlayRefs = useRef([]);
  const shadowRefs = useRef([]);
  const sceneRef = useRef({x:0,y:0});
  const sceneToRef = useRef(null);
  const pulseRef = useRef(0);
  const directionRef = useRef(1);

  const posRef = useRef(0);
  const focusRef = useRef(0);
  const tweenRef = useRef(null);
  const scaleRef = useRef(1);
  const cfgRef = useRef({});
  const onChangeRef = useRef(onChange);

  const dragRef = useRef(null);
  const wheelTimerRef = useRef(null);
  const autoTimerRef = useRef(null);
  const reducedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const clickTimerRef = useRef(null);
  const intersectingRef = useRef(true);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  const [active, setActive] = useState(0);

  onChangeRef.current = onChange;
  cfgRef.current = {
    count,
    depth,
    spread,
    tilt,
    tiltDirection,
    visibleCards,
    falloff,
    blur,
    duration,
    ease,
    loop,
    cardWidth,
    cardHeight,
    autoplayDelay
  };

  const layout = useCallback(pos => {
    const cfg = cfgRef.current;
    const n = cfg.count;
    if (!n) return;
    const dir = cfg.tiltDirection === 'left' ? -1 : 1;
    const sc = scaleRef.current;

    for (let i = 0; i < n; i++) {
      const el = cardRefs.current[i];
      if (!el) continue;

      let d = i - pos;
      if (cfg.loop && n > 1) {
        d = ((d % n) + n) % n;
        if (d > n / 2) d -= n;
      }

      const az = Math.abs(d);
      const shown = az <= cfg.visibleCards + 0.5;
      // A deeper cylindrical orbit: the central volume sits in front of the focal plane.
      const angle = d * 0.64;
      const tx = d * cfg.spread * 1.2;
      const pulse=pulseRef.current;
      const ty = (1 - Math.cos(angle)) * 92 - pulse * 34 * Math.max(0,1-az*.3);
      const tz = 55 - (1 - Math.cos(angle)) * cfg.depth * 1.65 - az * 32;
      const ry = -Math.sign(d)*Math.min(az*cfg.tilt,68) + pulse * directionRef.current * 8;
      const rz = d * 2.5 + pulse * directionRef.current * 2.5;
      const opacity = shown ? clamp((cfg.visibleCards + 0.5 - az) * 1.5, 0, 1) : 0;
      const zi = Math.round(2000 - az * 100);
      el.style.transform = `translate(-50%, -50%) scale(${sc}) translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, ${tz.toFixed(2)}px) rotateX(${(-4+pulse*7).toFixed(2)}deg) rotateY(${ry.toFixed(3)}deg) rotateZ(${rz.toFixed(3)}deg)`;
      el.style.opacity = opacity.toFixed(3);
      el.style.zIndex = String(zi);
      el.style.pointerEvents = shown && opacity > 0.05 ? 'auto' : 'none';
      const ov = overlayRefs.current[i];
      if (ov) ov.style.opacity = clamp(az * cfg.falloff, 0, 0.42).toFixed(3);
      const shadow=shadowRefs.current[i];
      if(shadow){shadow.style.transform=`translate(-50%,-50%) scale(${sc}) translate3d(${tx.toFixed(2)}px,${(cfg.cardHeight/2+45+ty*.15).toFixed(2)}px,${tz.toFixed(2)}px) rotateX(60deg) scale(${1-az*.13+pulse*.15})`;shadow.style.opacity=String(opacity*Math.max(.025,.12-az*.035));}
    }
    if(stageRef.current){const scene=sceneRef.current;stageRef.current.style.transform=`rotateX(${scene.y}deg) rotateY(${scene.x}deg) rotateZ(${pulseRef.current*directionRef.current*-.8}deg)`;}
  }, []);

  const notify = useCallback(
    idx => {
      setActive(idx);
      onChangeRef.current?.(idx, data[idx]);
    },
    [data]
  );

  const tweenTo = useCallback(
    (target, animate) => {
      tweenRef.current?.kill();
      const cfg = cfgRef.current;
      const proxy = { p: posRef.current, phase:0 };
      directionRef.current=Math.sign(target-posRef.current)||1;
      const dur = animate && !reducedRef.current ? cfg.duration / 1000 : 0;
      tweenRef.current = gsap.to(proxy, {
        p: target,
        phase:1,
        duration: dur,
        ease: cfg.ease,
        onUpdate: () => {
          posRef.current = proxy.p;
          pulseRef.current=Math.sin(Math.min(proxy.phase,1)*Math.PI);
          layout(proxy.p);
        },
        onComplete: () => {
          const n = cfg.count;
          pulseRef.current=0;
          if (n > 0) posRef.current = ((posRef.current % n) + n) % n;
          layout(posRef.current);
        }
      });
    },
    [layout]
  );

  const setFocus = useCallback(
    (rawIndex, animate = true) => {
      const cfg = cfgRef.current;
      const n = cfg.count;
      if (!n) return;
      const idx = cfg.loop ? ((rawIndex % n) + n) % n : clamp(rawIndex, 0, n - 1);
      let delta = idx - posRef.current;
      if (cfg.loop && n > 1) {
        delta = ((delta % n) + n) % n;
        if (delta > n / 2) delta -= n;
      }
      tweenTo(posRef.current + delta, animate);
      if (idx !== focusRef.current) {
        focusRef.current = idx;
        notify(idx);
      }
    },
    [tweenTo, notify]
  );

  const navigateBy = useCallback(step => setFocus(focusRef.current + step, true), [setFocus]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      const cfg = cfgRef.current;
      const needed = cfg.cardWidth * 2.25;
      const h=entries[0].contentRect.height;
      scaleRef.current = clamp(Math.min(w/needed,(h-70)/(cardHeight*1.15)),0.48,1);
      root.style.setProperty('--dc-scale',scaleRef.current);
      layout(posRef.current);
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, [layout,cardHeight]);

  useEffect(()=>{
    const ctx=gsap.context(()=>{
      const scene=sceneRef.current;
      sceneToRef.current={x:gsap.quickTo(scene,'x',{duration:.75,ease:'power3.out',onUpdate:()=>layout(posRef.current)}),y:gsap.quickTo(scene,'y',{duration:.75,ease:'power3.out',onUpdate:()=>layout(posRef.current)})};
    },rootRef);
    return ()=>{ctx.revert();sceneToRef.current=null;};
  },[layout]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = e => {
      const cfg = cfgRef.current;
      if (cfg.count < 2) return;
      // Preserve normal page scrolling; only horizontal trackpad gestures navigate the arc.
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      tweenRef.current?.kill();
      const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const delta = e.deltaMode === 1 ? raw * 24 : raw;
      const step = clamp(delta / (cfg.cardWidth * 0.9), -0.6, 0.6);
      posRef.current += step;
      layout(posRef.current);
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = setTimeout(() => setFocus(Math.round(posRef.current), true), 130);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    };
  }, [layout, setFocus]);

  const onPointerDown = useCallback(e => {
    const cfg = cfgRef.current;
    if (cfg.count < 2) return;
    if (e.target.closest('button, a')) return;
    suppressClickRef.current = false;
    tweenRef.current?.kill();
    dragRef.current = {
      x: e.clientX,
      startPos: posRef.current,
      lastX: e.clientX,
      lastT: performance.now(),
      v: 0,
      moved: false,
      id: e.pointerId
    };
  }, []);

  const onPointerMove = useCallback(
    e => {
      const drag = dragRef.current;
      if (!drag) {
        if(e.pointerType==='mouse'&&!reducedRef.current&&sceneToRef.current){const rect=rootRef.current.getBoundingClientRect();sceneToRef.current.x((e.clientX-rect.left-rect.width/2)/rect.width*7);sceneToRef.current.y(-(e.clientY-rect.top-rect.height/2)/rect.height*5);}
        return;
      }
      const cfg = cfgRef.current;
      const stepPx = Math.max(cfg.cardWidth * 0.55 * scaleRef.current, 40);
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 4) {
        drag.moved = true;
        rootRef.current?.setPointerCapture(drag.id);
      }
      if (!drag.moved) return;
      const now = performance.now();
      const dt = Math.max(now - drag.lastT, 1);
      drag.v = (e.clientX - drag.lastX) / dt;
      drag.lastX = e.clientX;
      drag.lastT = now;
      posRef.current = drag.startPos - dx / stepPx;
      pulseRef.current=Math.min(Math.abs(drag.v)*.12,.35);
      layout(posRef.current);
    },
    [layout]
  );

  const onPointerEnd = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (!drag.moved) return;
    suppressClickRef.current = true;
    clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => { suppressClickRef.current = false; }, 180);
    if (rootRef.current?.hasPointerCapture(drag.id)) rootRef.current.releasePointerCapture(drag.id);
    const cfg = cfgRef.current;
    const stepPx = Math.max(cfg.cardWidth * 0.55 * scaleRef.current, 40);
    const velocity=performance.now()-drag.lastT>100?0:drag.v;
    const projected = posRef.current - clamp((velocity * 220) / stepPx,-2,2);
    setFocus(clamp(Math.round(projected),Math.round(drag.startPos)-2,Math.round(drag.startPos)+2), true);
  }, [setFocus]);

  const onKeyDown = useCallback(
    e => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateBy(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateBy(1);
      }
    },
    [navigateBy]
  );

  const onCardClick = useCallback(
    index => {
      if (suppressClickRef.current) { suppressClickRef.current = false; return; }
      if (index === focusRef.current) onOpenRef.current?.(data[index]);
      else setFocus(index, true);
    },
    [setFocus, data]
  );

  useEffect(() => {
    reducedRef.current = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!autoplay || reducedRef.current || count < 2) return;
    const root = rootRef.current;
    let hovered = false;
    let focused = false;
    const stop = () => {
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    };
    const start = () => {
      stop();
      autoTimerRef.current = window.setInterval(
        () => {
          if (!reducedRef.current && !hovered && !focused && !document.hidden && intersectingRef.current && !document.querySelector('dialog[open]')) navigateBy(1);
        },
        Math.max(cfgRef.current.autoplayDelay, 600)
      );
    };
    const onEnter = () => {
      hovered = true;
    };
    const onLeave = () => {
      hovered = false;
    };
    const onFocusIn = () => {
      focused = true;
    };
    const onFocusOut = () => {
      focused = false;
    };
    root?.addEventListener('mouseenter', onEnter);
    root?.addEventListener('mouseleave', onLeave);
    root?.addEventListener('focusin', onFocusIn);
    root?.addEventListener('focusout', onFocusOut);
    start();
    return () => {
      stop();
      root?.removeEventListener('mouseenter', onEnter);
      root?.removeEventListener('mouseleave', onLeave);
      root?.removeEventListener('focusin', onFocusIn);
      root?.removeEventListener('focusout', onFocusOut);
    };
  }, [autoplay, autoplayDelay, count, navigateBy]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => { reducedRef.current = query.matches; if (query.matches) { tweenRef.current?.kill();sceneToRef.current?.x.tween.pause();sceneToRef.current?.y.tween.pause();sceneRef.current.x=0;sceneRef.current.y=0; setFocus(focusRef.current, false); } };
    onChange(); query.addEventListener('change', onChange);
    const observer = new IntersectionObserver(([entry]) => { intersectingRef.current = entry.isIntersecting; });
    if (rootRef.current) observer.observe(rootRef.current);
    return () => { query.removeEventListener('change', onChange); observer.disconnect(); };
  }, [setFocus]);

  useEffect(() => {
    layout(posRef.current);
  }, [layout, depth, spread, tilt, tiltDirection, visibleCards, falloff, blur, cardWidth, cardHeight, radius, count]);

  useEffect(
    () => () => {
      tweenRef.current?.kill();
      clearTimeout(clickTimerRef.current);
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    },
    []
  );

  return (
    <div
      ref={rootRef}
      className={`depth-carousel ${className}`.trim()}
      style={{ '--dc-perspective': `${perspective}px` }}
      role="group"
      aria-roledescription="carousel"
      aria-label="论文立体弧形轮播，左右方向键切换"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={()=>{if(sceneToRef.current&&!reducedRef.current){sceneToRef.current.x(0);sceneToRef.current.y(0);}}}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onKeyDown={onKeyDown}
    >
      <div className="depth-carousel__stage" ref={stageRef}>
        {data.map((_,i)=><div key={'shadow-'+i} className="depth-carousel__shadow" ref={el=>(shadowRefs.current[i]=el)} aria-hidden="true"/>)}
        {data.map((item, i) => (
          <div
            key={i}
            className="depth-carousel__card"
            ref={el => (cardRefs.current[i] = el)}
            style={{ width: cardWidth, height: cardHeight, borderRadius: radius }}
            role="button"
            tabIndex={active === i ? 0 : -1}
            onKeyDown={event => { if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onCardClick(i); } }}
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${count}：${item.alt || item.title}`}
            onClick={() => onCardClick(i)}
          >
            {renderCard ? renderCard(item, i, active === i) : <img className="depth-carousel__img" src={item.image} alt={item.alt || ''} draggable={false} />}
            <span
              className="depth-carousel__tint"
              ref={el => (overlayRefs.current[i] = el)}
              style={{ background: tint }}
            />
          </div>
        ))}
      </div>

      {showControls && count > 1 && (
        <>
          <button
            type="button"
            className="depth-carousel__arrow depth-carousel__arrow--prev"
            aria-label="上一篇论文"
            onClick={() => navigateBy(-1)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                d="M15 5l-7 7 7 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className="depth-carousel__arrow depth-carousel__arrow--next"
            aria-label="下一篇论文"
            onClick={() => navigateBy(1)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                d="M9 5l7 7-7 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </>
      )}

      {showIndicators && count > 1 && count <=8 && (
        <div className="depth-carousel__dots" role="group" aria-label="选择轮播论文">
          {data.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={active === i}
              aria-label={`切换到第 ${i + 1} 篇：${data[i].alt}`}
              className={`depth-carousel__dot${active === i ? ' is-active' : ''}`}
              onClick={() => setFocus(i, true)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DepthCarousel;
