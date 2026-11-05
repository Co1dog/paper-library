
/* ===== XRAY JS START: copy whole block ===== */
var XRAY = (function () {
  'use strict';
  var EN = !/^zh/i.test(document.documentElement.lang || 'zh');
  var L = EN ? { hl: 'Highlight', note: 'Note', fb: 'Feedback', confused: 'Lost', verbose: 'Too long', known: 'Got it', undo: 'Undo', got: 'Feedback received', saved: 'Saved into this file', dl: 'Downloaded. Replace the old file with it', ph: 'Write a note or a question', toc: 'Contents', theme: 'Theme', pen: 'Annotate', save: 'Save annotations into this file', fold: 'Fold section' }
               : { hl: '划线', note: '笔记', fb: '反馈', confused: '不懂', verbose: '啰嗦', known: '已懂', undo: '撤销', got: '已收到反馈', saved: '已保存到这个文件', dl: '已下载，用它替换原文件即可', ph: '写笔记或问题', toc: '目录', theme: '明暗', pen: '标注', save: '保存标注到这个文件', fold: '收起本节' };
  var queue = [], SRC = '', state, dirty = false, handle = null, main, KEY = 'xray:' + decodeURIComponent(location.pathname.replace(/\/view\.html$/, '/reading.html'));
  var SKIP = 'script,style,svg,.katex-mathml,.xr-ui,.xr-card,.xr-margin,textarea,button,.fk-ctl,.toc';

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  function now() { return new Date().toISOString(); }
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------- source snapshot: taken before any figure, math or mark touches the DOM ----------
  function snapshot() {
    var c = document.documentElement.cloneNode(true);
    c.removeAttribute('data-theme');
    $$('.xr-ui', c).forEach(function (n) { n.remove(); });
    SRC = '<!doctype html>\n' + c.outerHTML;
    var bad = [];
    $$('.fk-fig', c).forEach(function (h) { if (h.children.length) bad.push('#' + h.id); });
    if ($('.katex', c)) bad.push('.katex');
    if (bad.length) console.warn('[XRAY] content was generated before load; move it into XRAY.ready: ' + bad.join(' '));
  }
  function serialize() {
    var json = JSON.stringify(state).replace(/</g, '\\u003c');
    return SRC.replace(/(<script type="application\/json" id="xray-notes">)[\s\S]*?(<\/script>)/, function (_, a, b) { return a + json + b; });
  }

  // ---------- state ----------
  function load() {
    var emb = {}; try { emb = JSON.parse($('#xray-notes').textContent); } catch (e) {}
    var loc = null; try { loc = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    state = emb; state.marks = state.marks || []; state.folds = state.folds || [];
    if (loc && loc.updated && (!emb.updated || loc.updated > emb.updated)) { state.marks = loc.marks || []; state.folds = loc.folds || []; state.updated = loc.updated; dirty = true; }
  }
  function changed() {
    state.updated = now(); dirty = true;
    try { localStorage.setItem(KEY, JSON.stringify({ updated: state.updated, marks: state.marks, folds: state.folds })); } catch (e) {}
    paintDirty(); autosave();
  }
  function paintDirty() { var b = $('#xrSave'); if (b) b.classList.toggle('dirty', dirty); }

  // ---------- saving ----------
  function idb(fn) {
    return new Promise(function (res) {
      try { var r = indexedDB.open('xray', 1); r.onupgradeneeded = function () { r.result.createObjectStore('h'); }; r.onsuccess = function () { var tx = r.result.transaction('h', 'readwrite'); fn(tx.objectStore('h'), res); }; r.onerror = function () { res(null); }; } catch (e) { res(null); }
    });
  }
  function getHandle() { return idb(function (s, res) { var q = s.get(KEY); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; }); }
  function putHandle(h) { return idb(function (s, res) { s.put(h, KEY); res(true); }); }
  function fileName() { return decodeURIComponent(location.pathname.split('/').pop() || 'xray.html'); }
  function write(h) {
    state.saved = now();
    return h.createWritable().then(function (w) { return w.write(serialize()).then(function () { return w.close(); }); })
      .then(function () { dirty = false; paintDirty(); });
  }
  var timer = null;
  function autosave() {
    if (!handle || !handle.queryPermission) return;
    clearTimeout(timer);
    timer = setTimeout(function () { handle.queryPermission({ mode: 'readwrite' }).then(function (p) { if (p === 'granted') write(handle).catch(function () {}); }); }, 800);
  }
  function save() {
    if (window.showSaveFilePicker) {
      var go = handle ? handle.requestPermission({ mode: 'readwrite' }).then(function (p) { if (p !== 'granted') throw 0; return handle; })
                      : window.showSaveFilePicker({ suggestedName: fileName(), types: [{ description: 'HTML', accept: { 'text/html': ['.html'] } }] });
      go.then(function (h) { handle = h; putHandle(h); return write(h); }).then(function () { toast(L.saved); })
        .catch(function () { if (handle) { handle = null; save(); } });
      return;
    }
    state.saved = now();
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([serialize()], { type: 'text/html' })); a.download = fileName();
    document.body.appendChild(a); a.click(); a.remove(); dirty = false; paintDirty(); toast(L.dl);
  }

  // ---------- text index: offsets over visible text, same rules for saving and restoring ----------
  function nodes() {
    var out = [], w = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { return n.parentNode && n.parentNode.closest && n.parentNode.closest(SKIP) ? 2 : 1; } });
    while (w.nextNode()) out.push(w.currentNode);
    return out;
  }
  function index() {
    var ns = nodes(), starts = [], s = 0, txt = '';
    ns.forEach(function (n) { starts.push(s); s += n.data.length; txt += n.data; });
    return { ns: ns, starts: starts, txt: txt };
  }
  function rangeOffsets(r, ix) {
    var a = -1, b = -1;
    ix.ns.forEach(function (n, k) {
      if (!r.intersectsNode(n)) return;
      var lo = n === r.startContainer ? r.startOffset : 0, hi = n === r.endContainer ? r.endOffset : n.data.length;
      if (hi <= lo) return;
      if (a < 0) a = ix.starts[k] + lo;
      b = ix.starts[k] + hi;
    });
    return a < 0 ? null : [a, b];
  }
  function wrap(a, b, m) {
    var ix = index(), first = null;
    ix.ns.forEach(function (n, k) {
      var s = ix.starts[k], e = s + n.data.length, lo = Math.max(a, s) - s, hi = Math.min(b, e) - s;
      if (hi <= lo) return;
      var mid = n.splitText(lo); mid.splitText(hi - lo);
      var el = document.createElement('mark');
      el.className = 'xr-m xr-' + m.type; el.setAttribute('data-id', m.id); if (m.fb) el.setAttribute('data-fb', m.fb);
      el.title = m.type === 'fb' ? L[m.fb] : '';
      mid.parentNode.replaceChild(el, mid); el.appendChild(mid);
      if (!first) first = el;
    });
    return first;
  }
  function anchor(m) {
    var ix = index(), best = -1, score = -1, i = ix.txt.indexOf(m.quote);
    while (i >= 0) {
      var p = ix.txt.slice(Math.max(0, i - m.prefix.length), i), q = ix.txt.slice(i + m.quote.length, i + m.quote.length + m.suffix.length), sc = 0;
      for (var k = 1; k <= p.length && p[p.length - k] === m.prefix[m.prefix.length - k]; k++) sc++;
      for (k = 0; k < q.length && q[k] === m.suffix[k]; k++) sc++;
      if (sc > score) { score = sc; best = i; }
      i = ix.txt.indexOf(m.quote, i + 1);
    }
    return best < 0 ? null : wrap(best, best + m.quote.length, m);
  }
  function section(el) {
    var h = null, n = el;
    while (n && n !== main) {
      var p = n.previousElementSibling;
      while (p) { if (/^H[23]$/.test(p.tagName)) { h = p; break; } if (p.classList && p.classList.contains('xr-sec')) { var hh = $$('h2,h3', p).pop(); if (hh) { h = hh; break; } } p = p.previousElementSibling; }
      if (h) break; n = n.parentNode;
    }
    return h ? h.textContent.replace(/^[▾▸]\s*/, '').trim() : '';
  }

  // ---------- marks ----------
  function add(type, fb) {
    var sel = getSelection(); if (!sel.rangeCount) return;
    var r = sel.getRangeAt(0), ix = index(), off = rangeOffsets(r, ix); if (!off) return;
    var m = { id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), type: type, quote: ix.txt.slice(off[0], off[1]), prefix: ix.txt.slice(Math.max(0, off[0] - 32), off[0]), suffix: ix.txt.slice(off[1], off[1] + 32), t: now() };
    if (fb) m.fb = fb;
    if (type === 'note') m.note = '';
    var el = wrap(off[0], off[1], m); if (!el) return;
    m.sec = section(el); state.marks.push(m); sel.removeAllRanges(); hideBar();
    if (type === 'note') { cards(); var ta = $('.xr-card[data-id="' + m.id + '"] textarea'); if (ta) ta.focus(); }
    if (type === 'fb') toast(L.got + ' · ' + L[fb]);
    changed();
  }
  function remove(id) {
    $$('mark.xr-m[data-id="' + id + '"]').forEach(function (el) { var p = el.parentNode; while (el.firstChild) p.insertBefore(el.firstChild, el); p.removeChild(el); p.normalize(); });
    state.marks = state.marks.filter(function (m) { return m.id !== id; });
    cards(); changed();
  }

  // ---------- margin cards ----------
  var margin;
  function cards() {
    $$('.xr-card').forEach(function (c) { c.remove(); });
    if (!margin) { margin = document.createElement('div'); margin.className = 'xr-margin'; main.appendChild(margin); }
    var notes = state.marks.some(function (m) { return m.type === 'note'; }), mw = main.getBoundingClientRect().width;
    var wide = notes && mw >= 960;
    main.style.setProperty('--measure', wide ? 'min(88ch, ' + (mw - 330) + 'px)' : '88ch');
    var probe = $('main > p, .xr-sec > p') || main, mr = main.getBoundingClientRect(), right = Math.min(probe.getBoundingClientRect().right - mr.left, mr.width);
    margin.style.left = (right + 30) + 'px'; margin.style.width = Math.min(300, mr.width - right - 36) + 'px';
    var y = 0;
    state.marks.filter(function (m) { return m.type === 'note'; }).map(function (m) { return { m: m, el: $('mark.xr-m[data-id="' + m.id + '"]') }; })
      .filter(function (x) { return x.el && !x.el.closest('.xr-sec.closed'); })
      .sort(function (a, b) { return a.el.getBoundingClientRect().top - b.el.getBoundingClientRect().top; })
      .forEach(function (x) {
      var m = x.m, el = x.el;
      var c = document.createElement('div'); c.className = 'xr-card' + (wide ? '' : ' inline'); c.setAttribute('data-id', m.id);
      c.innerHTML = '<div class="q">' + esc(m.quote) + '</div><textarea rows="1" placeholder="' + L.ph + '"></textarea>';
      var ta = c.querySelector('textarea'); ta.value = m.note || '';
      var fit = function () { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
      ta.addEventListener('input', function () { m.note = ta.value; fit(); changed(); });
      c.addEventListener('mouseenter', function () { $$('mark[data-id="' + m.id + '"]').forEach(function (x) { x.classList.add('flash'); }); });
      c.addEventListener('mouseleave', function () { $$('mark[data-id="' + m.id + '"]').forEach(function (x) { x.classList.remove('flash'); }); });
      if (wide) { var top = el.getBoundingClientRect().top - mr.top - 8; top = Math.max(top, y); c.style.top = top + 'px'; margin.appendChild(c); fit(); y = top + c.offsetHeight + 10; }
      else { var blk = el.closest('p,li,td,blockquote,div') || el; blk.parentNode.insertBefore(c, blk.nextSibling); fit(); }
    });
  }

  // ---------- floating UI ----------
  var bar, menu, toastEl;
  function ui() {
    bar = document.createElement('div'); bar.className = 'xr-ui xr-bar';
    bar.innerHTML = '<button data-a="hl">' + L.hl + '</button><span class="sep"></span><button data-a="note">' + L.note + '</button><span class="sep"></span><button class="fbbtn" data-a="fbopen">' + L.fb + ' ›</button>' +
      '<button class="fb" data-a="confused">' + L.confused + '</button><button class="fb" data-a="verbose">' + L.verbose + '</button><button class="fb" data-a="known">' + L.known + '</button>';
    bar.addEventListener('mousedown', function (e) { e.preventDefault(); });
    bar.addEventListener('click', function (e) {
      var a = e.target.getAttribute && e.target.getAttribute('data-a'); if (!a) return;
      if (a === 'fbopen') { bar.classList.add('fbopen'); return; }
      if (a === 'hl' || a === 'note') add(a); else add('fb', a);
    });
    menu = document.createElement('div'); menu.className = 'xr-ui xr-menu'; menu.innerHTML = '<button>' + L.undo + '</button>';
    toastEl = document.createElement('div'); toastEl.className = 'xr-ui xr-toast';
    document.body.appendChild(bar); document.body.appendChild(menu); document.body.appendChild(toastEl);
  }
  function hideBar() { bar.style.display = 'none'; bar.classList.remove('fbopen'); }
  function showBar() {
    if (!document.body.classList.contains('xr-annot')) return hideBar();
    var s = getSelection(); if (!s.rangeCount || s.isCollapsed) return hideBar();
    var r = s.getRangeAt(0), c = r.commonAncestorContainer; c = c.nodeType === 1 ? c : c.parentNode;
    if (!main.contains(c) || c.closest(SKIP) || !s.toString().trim()) return hideBar();
    var b = r.getBoundingClientRect(); bar.style.display = 'block';
    bar.style.left = Math.max(8, Math.min(innerWidth - bar.offsetWidth - 8, b.left + b.width / 2 - bar.offsetWidth / 2)) + 'px';
    bar.style.top = (b.top > 52 ? b.top - bar.offsetHeight - 8 : b.bottom + 8) + 'px';
  }
  function toast(msg) {
    toastEl.innerHTML = '<i>✓</i>' + esc(msg); toastEl.style.display = 'block';
    requestAnimationFrame(function () { toastEl.classList.add('show'); });
    clearTimeout(toastEl._t); toastEl._t = setTimeout(function () { toastEl.classList.remove('show'); setTimeout(function () { toastEl.style.display = 'none'; }, 300); }, 1500);
  }

  // ---------- sections: TOC, folding ----------
  function slug(s, i) { return 's' + i + '-' + s.toLowerCase().replace(/[^\w一-鿿]+/g, '-').slice(0, 40); }
  function sections() {
    var hs = $$('main > h2, main > h3');
    hs.forEach(function (h, i) { if (!h.id) h.id = slug(h.textContent, i); });
    ['H2', 'H3'].forEach(function (lv) {
      $$(lv === 'H2' ? 'main > h2' : 'main > h3, .xr-sec > h3').forEach(function (h) {
        var box = document.createElement('div'); box.className = 'xr-sec'; var n = h.nextSibling;
        while (n && !(n.nodeType === 1 && (/^H[12]$/.test(n.tagName) || (lv === 'H3' && n.tagName === 'H3')))) { var nx = n.nextSibling; box.appendChild(n); n = nx; }
        h.parentNode.insertBefore(box, h.nextSibling);
        var b = document.createElement('button'); b.className = 'xr-fold'; b.textContent = '▾'; b.title = L.fold; h.insertBefore(b, h.firstChild);
        b.addEventListener('click', function () { fold(h, !h.classList.contains('folded')); changed(); });
      });
    });
    state.folds.forEach(function (id) { var h = document.getElementById(id); if (h) fold(h, true); });
    var toc = $('.toc'); toc.innerHTML = '';
    hs.forEach(function (h) { var a = document.createElement('a'); a.href = '#' + h.id; a.className = h.tagName.toLowerCase(); a.textContent = h.textContent.replace(/^[▾▸]\s*/, ''); toc.appendChild(a); });
  }
  function fold(h, on) {
    h.classList.toggle('folded', on); var box = h.nextElementSibling; if (box && box.classList.contains('xr-sec')) box.classList.toggle('closed', on);
    state.folds = state.folds.filter(function (x) { return x !== h.id; }); if (on) state.folds.push(h.id);
    if (margin) cards();
  }
  function tocTrack() {
    var links = $$('.toc a'), hs = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    var cur = 0; hs.forEach(function (h, i) { if (h && h.offsetParent && h.getBoundingClientRect().top < 120) cur = i; });
    links.forEach(function (a, i) { a.classList.toggle('cur', i === cur); });
  }

  // ---------- lint: called by ?lint and by the author before delivery ----------
  function lint() {
    var out = [], Q = EN ? /\?|^(what|why|how|which|when|where)\b/i : /[？?]|什么|为什么|怎么|怎样|如何|哪|吗|呢/;
    $$('main h1, main h2, main h3').forEach(function (h) { var t = h.textContent.replace(/^[▾▸]\s*/, ''); if (Q.test(t)) out.push('heading reads as a question: ' + t); });
    var txt = index().txt, dash = (txt.match(/——|—/g) || []).length, quotes = (txt.match(EN ? /[“”]/g : /[“”「」]/g) || []).length;
    if (dash > 3) out.push('dashes in prose: ' + dash + ' (bold instead)');
    if (quotes > 6) out.push('quotation marks in prose: ' + quotes + ' (bold instead)');
    var md = $$('main p, main li, main td, main th').map(function (e) { return e.textContent; }).join('\n').match(/\*\*[^*\n]+\*\*|(^|\n)#{1,4} /g);
    if (md) out.push('markdown left in HTML (use <b>): ' + md.slice(0, 3).join(' | '));
    $$('.fk-fig').forEach(function (h) { if (!h.children.length) out.push('empty figure host #' + h.id); });
    if (!$('#xray-notes')) out.push('missing #xray-notes block');
    try { var d = JSON.parse($('#xray-notes').textContent).doc || {}; if (!d.title || !d.made) out.push('#xray-notes doc.title / doc.made empty'); } catch (e) { out.push('#xray-notes is not JSON'); }
    if (/[?&]lint/.test(location.search)) { var pre = document.createElement('pre'); pre.id = 'xr-lint'; pre.textContent = out.length ? out.join('\n') : 'XRAY.lint ok'; document.body.appendChild(pre); }
    out.forEach(function (m) { console.warn('[XRAY.lint] ' + m); });
    return out;
  }

  // ---------- boot ----------
  function boot() {
    snapshot(); load(); main = $('main');
    queue.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
    if (window.renderMathInElement) renderMathInElement(main, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '\\[', right: '\\]', display: true }, { left: '$', right: '$', display: false }, { left: '\\(', right: '\\)', display: false }], trust: true, strict: false, macros: { '\\role': '\\htmlClass{r-#1}{#2}' }, ignoredTags: ['script', 'style', 'pre', 'svg', 'textarea'] });
    sections(); ui();
    state.marks.forEach(anchor);
    paintDirty();
    var top = $('.top'); $('#xrNav').title = L.toc; $('#xrTheme').title = L.theme; $('#xrPen').title = L.pen; $('#xrSave').title = L.save;
    $('#xrNav').onclick = function () { document.body.classList.toggle(innerWidth <= 1100 ? 'nav-open' : 'nav-hidden'); setTimeout(cards, 50); };
    $('#xrTheme').onclick = function () { var t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('theme', t); } catch (e) {} };
    var pen = $('#xrPen'), penOn = false; try { penOn = localStorage.getItem('xray:pen') === '1'; } catch (e) {}
    function setPen(on) { penOn = on; document.body.classList.toggle('xr-annot', on); pen.classList.toggle('on', on); try { localStorage.setItem('xray:pen', on ? '1' : '0'); } catch (e) {} if (!on) hideBar(); }
    setPen(penOn); pen.onclick = function () { setPen(!penOn); };
    $('#xrSave').onclick = save;
    $$('.toc a').forEach(function (a) { a.addEventListener('click', function () { document.body.classList.remove('nav-open'); var h = document.getElementById(a.getAttribute('href').slice(1)); var s = h && h.closest('.xr-sec.closed'); if (s) fold(s.previousElementSibling, false); }); });
    document.addEventListener('mouseup', function () { setTimeout(showBar, 0); });
    document.addEventListener('keyup', function (e) { if (e.shiftKey) showBar(); if (e.key === 'Escape') { hideBar(); menu.style.display = 'none'; } });
    document.addEventListener('mousedown', function (e) { if (!bar.contains(e.target)) hideBar(); if (!menu.contains(e.target)) menu.style.display = 'none'; });
    document.addEventListener('contextmenu', function (e) {
      var t = e.target.closest && e.target.closest('mark.xr-m, .xr-card'); if (!t) return;
      e.preventDefault(); var id = t.getAttribute('data-id');
      menu.style.display = 'block'; menu.style.left = Math.min(e.clientX, innerWidth - 90) + 'px'; menu.style.top = e.clientY + 'px';
      menu.querySelector('button').onclick = function () { menu.style.display = 'none'; remove(id); };
    });
    var prog = $('#progress'), pt = null;
    addEventListener('scroll', function () {
      var h = document.documentElement.scrollHeight - innerHeight; prog.style.width = (h > 0 ? scrollY / h * 100 : 0) + '%'; prog.style.opacity = '.38';
      clearTimeout(pt); pt = setTimeout(function () { prog.style.opacity = '0'; }, 1200); tocTrack(); hideBar();
    }, { passive: true });
    addEventListener('resize', function () { cards(); });
    tocTrack();
    getHandle().then(function (h) { handle = h; });
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () { cards(); if (/[?&]lint/.test(location.search)) { lint(); if (window.FK && FK.lint) FK.lint(); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot, 0);


  function restore(snapshot) {
    $$('mark.xr-m').forEach(function (el) {var p=el.parentNode;while(el.firstChild)p.insertBefore(el.firstChild,el);el.remove();p.normalize();});
    $$('.xr-card').forEach(function(el){el.remove();});
    state.marks=JSON.parse(JSON.stringify(snapshot.marks||[]));state.updated=snapshot.updatedAt||now();
    state.marks.forEach(anchor);cards();
    try{localStorage.setItem(KEY,JSON.stringify({updated:state.updated,marks:state.marks,folds:state.folds}));}catch(e){}
    dirty=true;paintDirty();
  }

  return { restore: restore, ready: function (fn) { queue.push(fn); }, serialize: serialize, save: save, lint: lint, state: function () { return state; }, add: add, remove: remove };
})();
/* ===== XRAY JS END ===== */
