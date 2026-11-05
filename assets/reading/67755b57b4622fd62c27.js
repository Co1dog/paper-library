
/* ===== FIGKIT JS START — copy whole block ===== */
var FK = (function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  // all sizes scale from box height 60
  var S = { h: 60, gap: 15, gapDot: 18, rx: 4.6, add: 8.2, dot: 2.4, aL: 6, aW: 5.2,
            fs: 13, lh: 15.6, fsSmall: 12, fsIO: 15, lift: 60.8, stackPadX: 9.2, stackPadY: 78, pe: 13.2 };
  var W = { s: 33, m: 60, ffn: 73, l: 91, xl: 85 };
  var GREEK = { alpha:'α',beta:'β',gamma:'γ',delta:'δ',epsilon:'ε',eta:'η',theta:'θ',lambda:'λ',mu:'μ',pi:'π',sigma:'σ',tau:'τ',phi:'φ',psi:'ψ',omega:'ω',
    Delta:'Δ',Sigma:'Σ',Omega:'Ω',Phi:'Φ',in:'∈',times:'×',cdot:'·',to:'→',mapsto:'↦',top:'⊤',sum:'Σ',le:'≤',ge:'≥',approx:'≈',infty:'∞',odot:'⊙',oplus:'⊕',ldots:'…',partial:'∂',nabla:'∇' };
  var BB = { R:'ℝ', N:'ℕ', Z:'ℤ', E:'𝔼', C:'ℂ', Q:'ℚ' };
  var WORDS = /^(softmax|Attn|LN|exp|log|max|min|sin|cos|tanh|ReLU|GELU|Linear|Sublayer|MLP|FFN|concat|diag|Var|argmax|sigmoid|Norm|RMSNorm|LayerNorm|Conv|Dropout|KL|CE|Loss|Attention)/;

  function el(tag, a, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in a) if (a[k] !== undefined && a[k] !== null) n.setAttribute(k, a[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  // TeX subset -> tspans: ^ _ {} \role{r}{..} \htmlClass{r-x}{..} \mathbf \mathrm \text \texttt \mathbb greek
  function rich(t, src, fs) {
    var i = 0, base = 0;
    function grp() { // one atom: {...}, a command, or a char
      if (src[i] === '{') { var d = 1, j = ++i; while (i < src.length && d) { if (src[i] === '{') d++; else if (src[i] === '}') d--; i++; } return src.slice(j, i - 1); }
      if (src[i] === '\\') { var m = /^\\[A-Za-z]+/.exec(src.slice(i)); if (m) { i += m[0].length; return m[0]; } }
      return src[i++];
    }
    function emit(txt, cls, shift, size) {
      if (!txt) return;
      var a = { 'class': cls || null };
      var dy = shift - base; if (dy) a.dy = dy.toFixed(2);
      base = shift; if (size) a['font-size'] = size;
      el('tspan', a, t).textContent = txt;
    }
    function run(s, ctx) {
      var k = 0;
      while (k < s.length) {
        var c = s[k];
        if (c === '\\') {
          var m = /^\\([A-Za-z]+|.)/.exec(s.slice(k)); k += m[0].length; var cmd = m[1];
          var take = function () { src = s; i = k; var g = grp(); k = i; return g; };
          if (cmd === 'role' || cmd === 'htmlClass') { var r = take().replace(/^r-/, ''); run(take(), Object.assign({}, ctx, { role: 'r-' + r })); }
          else if (cmd === 'mathbf' || cmd === 'bm') run(take(), Object.assign({}, ctx, { font: 'bf' }));
          else if (cmd === 'mathrm' || cmd === 'text' || cmd === 'operatorname') run(take(), Object.assign({}, ctx, { font: 'rm' }));
          else if (cmd === 'texttt' || cmd === 'mathtt') run(take(), Object.assign({}, ctx, { font: 'tt' }));
          else if (cmd === 'mathbb') { var b = take(); emit(BB[b] || b, cls(ctx, 'rm'), ctx.shift, ctx.size); }
          else if (cmd === 'sqrt') { emit('√', cls(ctx, 'rm'), ctx.shift, ctx.size); run(take(), ctx); }
          else if (cmd === ',' || cmd === ';' || cmd === ' ' || cmd === 'quad') emit(cmd === 'quad' ? ' ' : ' ', null, ctx.shift, ctx.size);
          else if (cmd === '{' || cmd === '}') emit(cmd, cls(ctx, 'rm'), ctx.shift, ctx.size);
          else if (GREEK[cmd]) emit(GREEK[cmd], cls(ctx, /^[a-z]/.test(cmd) && cmd.length > 2 && 'alphabetagammadeltaepsilonetathetalambdamupisigmatauphipsiomega'.indexOf(cmd) >= 0 ? 'mi' : 'rm'), ctx.shift, ctx.size);
          else emit(cmd, cls(ctx, 'rm'), ctx.shift, ctx.size);
        } else if (c === '^' || c === '_') {
          k++; src = s; i = k; var g = grp(); k = i;
          var sz = (ctx.size || fs) * 0.72;
          var sh = (ctx.shift || 0) + (c === '^' ? -0.38 : 0.24) * (ctx.size || fs);
          run(g, Object.assign({}, ctx, { shift: sh, size: sz.toFixed(2) }));
        } else if (c === '{') {
          src = s; i = k; var gg = grp(); k = i; run(gg, ctx);
        } else if (c === ' ') { emit(' ', null, ctx.shift, ctx.size); k++; }
        else if (/[A-Za-z]/.test(c)) {
          var w = WORDS.exec(s.slice(k));
          if (w && ctx.font === 'mi') { emit(w[0], cls(ctx, 'rm'), ctx.shift, ctx.size); k += w[0].length; }
          else { emit(c, cls(ctx, ctx.font), ctx.shift, ctx.size); k++; }
        } else { emit(c, cls(ctx, 'rm'), ctx.shift, ctx.size); k++; }
      }
    }
    function cls(ctx, font) { return [font === 'rm' ? '' : font, ctx.role || ''].join(' ').trim() || null; }
    run(src, { font: 'mi', shift: 0, size: null, role: null });
    if (base) el('tspan', { dy: (-base).toFixed(2) }, t).textContent = '​';
    return t;
  }

  function Fig(host, w, h, label) {
    host = typeof host === 'string' ? document.querySelector(host) : host;
    this.w = w; this.h = h; this.at = {};
    this.svg = el('svg', { 'class': 'fk', viewBox: '0 0 ' + w + ' ' + h, role: 'img', 'aria-label': label || '' }, host);
    this.svg.style.minWidth = Math.round(w * 0.82) + 'px';      // scroll rather than shrink text
    this.svg.style.maxWidth = Math.round(w * 1.1) + 'px';       // small figures never blow up
    this.gS = el('g', {}, this.svg); this.gW = el('g', {}, this.svg); this.gB = el('g', {}, this.svg); this.gT = el('g', {}, this.svg);
  }
  var P = Fig.prototype;

  P.p = function (ref) {
    if (Array.isArray(ref)) return ref;
    var s = ref.split('.'), a = this.at[s[0]]; if (!a) throw new Error('FK: unknown id ' + s[0]);
    var side = s[1] || 'c';
    return side === 'l' ? [a.x - a.w / 2, a.y] : side === 'r' ? [a.x + a.w / 2, a.y] : side === 't' ? [a.x, a.y - a.h / 2] : side === 'b' ? [a.x, a.y + a.h / 2] : [a.x, a.y];
  };

  P.label = function (txt, x, y, o) {
    o = o || {};
    var t = el('text', { x: x, y: y, 'text-anchor': o.anchor || 'middle', 'font-size': o.size || S.fs, 'class': o.cls || null }, o.parent || this.gT);
    rich(t, txt, o.size || S.fs);
    return t;
  };

  P.box = function (id, o) {
    var w = typeof o.w === 'number' ? o.w : (W[o.w] || W.m), h = o.h || S.h;
    var g = el('g', { 'class': 'blk r-' + (o.role || 'op'), 'data-id': id }, this.gB);
    el('rect', { x: o.x - w / 2, y: o.y - h / 2, width: w, height: h, rx: S.rx }, g);
    var lines = String(o.text).split('\n'), y0 = o.y - (lines.length - 1) * S.lh / 2;
    lines.forEach(function (ln, k) { el('text', { x: o.x, y: y0 + k * S.lh, 'text-anchor': 'middle', 'font-size': S.fs }, g).textContent = ln; });
    if (o.param) this.label(o.param, o.x, o.y + h / 2 + 12, { size: S.fsSmall, cls: 'param' });
    this.at[id] = { x: o.x, y: o.y, w: w, h: h, kind: 'box', g: g };
    return g;
  };
  P.add = function (id, o) {
    var g = el('g', { 'class': 'add', 'data-id': id }, this.gB), r = S.add, a = r * 0.5;
    el('circle', { cx: o.x, cy: o.y, r: r }, g);
    el('path', { d: 'M' + (o.x - a) + ' ' + o.y + 'H' + (o.x + a) + 'M' + o.x + ' ' + (o.y - a) + 'V' + (o.y + a) }, g);
    this.at[id] = { x: o.x, y: o.y, w: 2 * r, h: 2 * r, kind: 'add', g: g };
  };
  P.dot = function (id, o) {
    el('circle', { 'class': 'dot', cx: o.x, cy: o.y, r: S.dot }, this.gB);
    this.at[id] = { x: o.x, y: o.y, w: 0, h: 0, kind: 'dot' };
  };

  // orthogonal polyline; arrow tip lands exactly on the end point
  P.wire = function (pts, o) {
    o = o || {}; var self = this;
    pts = pts.map(function (q) { return self.p(q); });
    var n = pts.length, a = pts[n - 2], b = pts[n - 1], arrow = o.arrow !== false;
    var dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]);
    var end = arrow ? [b[0] - dx * S.aL * 0.8, b[1] - dy * S.aL * 0.8] : b;
    var d = 'M' + pts.slice(0, n - 1).map(function (q) { return q[0] + ' ' + q[1]; }).join('L') + 'L' + end[0] + ' ' + end[1];
    var role = o.role ? ' r-' + o.role : '';
    var path = el('path', { d: d, 'class': 'wire' + role + (o.cls ? ' ' + o.cls : ''), 'data-pts': JSON.stringify(pts) }, this.gW);
    if (arrow) {
      var px = -dy, py = dx, L = S.aL, Wd = S.aW / 2;
      el('path', { 'class': 'head' + role, d: 'M' + b[0] + ' ' + b[1] + 'L' + (b[0] - dx * L + px * Wd) + ' ' + (b[1] - dy * L + py * Wd) + 'L' + (b[0] - dx * L - px * Wd) + ' ' + (b[1] - dy * L - py * Wd) + 'Z' }, this.gW);
    }
    return path;
  };

  // one row: auto spacing, auto arrows (no arrowhead into a dot)
  P.row = function (y, x0, items) {
    var x = x0, prev = null, self = this;
    items.forEach(function (it, k) {
      var kind = it.add ? 'add' : it.dot ? 'dot' : 'box';
      var w = kind === 'add' ? 2 * S.add : kind === 'dot' ? 0 : (typeof it.w === 'number' ? it.w : (W[it.w] || W.m));
      if (k) x += it.gap !== undefined ? it.gap : (kind === 'dot' || (prev && prev.kind === 'dot')) ? S.gapDot : S.gap;
      var cx = x + w / 2;
      if (kind === 'box') self.box(it.id, { x: cx, y: y, w: w, role: it.role, text: it.box, param: it.param });
      else if (kind === 'add') self.add(it.id, { x: cx, y: y });
      else self.dot(it.id, { x: cx, y: y });
      if (prev && it.link !== false) self.wire([[prev.r, y], [x, y]], { arrow: kind !== 'dot' });
      x += w; prev = { kind: kind, r: x };
    });
    return x;
  };

  P.skip = function (from, to, side) {
    var a = this.p(from), b = this.p(to), up = side !== 'bottom', yy = a[1] + (up ? -S.lift : S.lift);
    this.wire([a, [a[0], yy], [b[0], yy], [b[0], b[1] + (up ? -S.add : S.add)]]);
  };
  P.stack = function (from, to, o) {
    o = o || {};
    var a = this.p(from + '.l'), b = this.p(to + '.r'), x0 = a[0] - S.stackPadX, x1 = b[0] + S.stackPadX;
    var y0 = a[1] - S.stackPadY, y1 = a[1] + S.stackPadY;
    el('rect', { 'class': 'stack', x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 11.5 }, this.gS);
    if (o.label) this.label(o.label, (x0 + x1) / 2, o.side === 'bottom' ? y1 + 14 : y0 - 13, { size: 13.5, cls: 'note' });
  };
  P.pe = function (addId, side) {
    var a = this.p(addId), up = side !== 'bottom', cy = a[1] + (up ? -65.4 : 65.4), r = S.pe, g = el('g', { 'class': 'pe' }, this.gB);
    el('circle', { cx: a[0], cy: cy, r: r }, g);
    el('path', { d: 'M' + (a[0] - r * .62) + ' ' + cy + 'C' + (a[0] - r * .35) + ' ' + (cy - r * 1.05) + ' ' + (a[0] - r * .1) + ' ' + (cy - r * .8) + ' ' + a[0] + ' ' + cy + 'S' + (a[0] + r * .35) + ' ' + (cy + r * 1.05) + ' ' + (a[0] + r * .62) + ' ' + cy }, g);
    this.wire([[a[0], cy + (up ? r : -r)], [a[0], a[1] + (up ? -S.add : S.add)]]);
    this.label('PE', a[0] - r - 6, cy, { anchor: 'end', size: 12, cls: 'note' });
  };
  P.io = function (txt, o) {
    var len = o.len || 26.8, lines = txt.split('\n'), x, y, anchor;
    if (o.to) { var b = this.p(o.to + '.l'); this.wire([[b[0] - len, b[1]], b], { role: o.role }); x = b[0] - len - 8; y = b[1]; anchor = 'end'; }
    else { var a = this.p(o.from + '.r'); this.wire([a, [a[0] + len, a[1]]], { role: o.role }); x = a[0] + len + 8; y = a[1]; anchor = 'start'; }
    var self = this, y0 = y - (lines.length - 1) * 17 / 2 - (o.sub ? 7 : 0);
    lines.forEach(function (ln, k) { self.label('\\text{' + ln + '}', x, y0 + k * 17, { anchor: anchor, size: S.fsIO, cls: 'r-' + o.role }); });
    if (o.sub) this.label('\\text{' + o.sub + '}', x, y0 + lines.length * 17 - 2, { anchor: anchor, size: 12, cls: 'r-' + o.role });
  };
  // zoom panel: box `id` opens into a framed panel at (x, y, w, h) with a gray header `title`.
  // o.build(z) draws inside the panel with the same API; z's (0,0) is the panel body's top-left.
  // o.closed: start folded; clicking the box toggles the panel either way.
  P.zoom = function (id, o) {
    var a = this.at[id], hd = 30;
    var g = el('g', { 'class': 'zoom' }, this.zl || this.svg);
    var b = { x0: a.x - a.w / 2, y0: a.y - a.h / 2, x1: a.x + a.w / 2, y1: a.y + a.h / 2 };
    var q = { x0: o.x, y0: o.y, x1: o.x + o.w, y1: o.y + o.h }, poly;
    if (q.x0 >= b.x1) poly = [[b.x1, b.y0], [q.x0, q.y0], [q.x0, q.y1], [b.x1, b.y1]];
    else if (q.x1 <= b.x0) poly = [[b.x0, b.y0], [q.x1, q.y0], [q.x1, q.y1], [b.x0, b.y1]];
    else if (q.y1 <= b.y0) poly = [[b.x0, b.y0], [q.x0, q.y1], [q.x1, q.y1], [b.x1, b.y0]];
    else poly = [[b.x0, b.y1], [q.x0, q.y0], [q.x1, q.y0], [b.x1, b.y1]];
    var wg = el('g', { 'class': 'zoom' }, this.gS);   // the wedge sits under the boxes it passes over
    el('path', { 'class': 'zwedge', d: 'M' + poly.map(function (p) { return p.join(' '); }).join('L') + 'Z' }, wg);
    el('path', { 'class': 'zedge', d: 'M' + poly[0].join(' ') + 'L' + poly[1].join(' ') + 'M' + poly[3].join(' ') + 'L' + poly[2].join(' ') }, wg);
    el('rect', { 'class': 'zframe', x: q.x0, y: q.y0, width: o.w, height: o.h, rx: 3 }, g);
    el('rect', { 'class': 'zhead', x: q.x0 + 1.1, y: q.y0 + 1.1, width: o.w - 2.2, height: hd }, g);
    var z = Object.create(P);
    var body = el('g', { transform: 'translate(' + q.x0 + ',' + (q.y0 + hd) + ')' }, g);
    z.svg = this.svg; z.w = o.w; z.h = o.h - hd; z.at = {};
    z.gS = el('g', {}, body); z.gW = el('g', {}, body); z.gB = el('g', {}, body); z.gT = el('g', {}, body); z.zl = body;
    this.label('\\text{' + o.title + '}', q.x0 + o.w / 2, q.y0 + hd / 2 + 1, { size: 15, cls: 'ztitle', parent: g });
    if (o.build) o.build(z);
    var cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    g.style.transformBox = 'view-box'; g.style.transformOrigin = cx + 'px ' + cy + 'px';
    function set(open) { g.classList.toggle('off', !open); wg.classList.toggle('off', !open); g.style.transform = open ? '' : 'scale(.2)'; a.g.classList.toggle('zopen', open); }
    a.g.classList.add('zsrc'); a.g.addEventListener('click', function (e) { e.stopPropagation(); set(g.classList.contains('off')); });
    set(!o.closed);
    return z;
  };
  P.note = function (txt, x, y, anchor) { return this.label(txt, x, y, { anchor: anchor || 'middle', size: S.fsSmall, cls: 'note' }); };
  P.math = function (src, x, y, anchor) { return this.label(src, x, y, { anchor: anchor || 'middle', size: 14 }); };
  P.light = function (ids) {
    var self = this;
    Object.keys(this.at).forEach(function (k) { var a = self.at[k]; if (a.g) a.g.classList.toggle('on', ids.indexOf(k) >= 0); });
  };

  // text heat. o.tokens: words. o.w: weights, o.w[i][j] = how much token i draws on token j (any scale, rescaled per row).
  // mode 'ladder' (default): one row per token i, token i in the query color, tokens before it glow by o.w[i][j].
  // mode 'pick': one row; hover or click a token to make it the query; arrow keys move it. o.say(i, j, v) fills the read-out.
  function heatGlow(v) { var a = Math.round(v * 78), b = Math.round(v * 34); return v < .02 ? 'none' : 'radial-gradient(closest-side, color-mix(in srgb, var(--k) ' + a + '%, transparent), color-mix(in srgb, var(--k) ' + b + '%, transparent) 62%, transparent)'; }
  function heat(host, o) {
    host = typeof host === 'string' ? document.querySelector(host) : host; host.innerHTML = '';
    var n = o.tokens.length, mode = o.mode || 'ladder', root = document.createElement('div');
    root.className = 'fk-heat ' + mode + (o.frame === false ? '' : mode === 'ladder' ? ' box' : '');
    root.style.setProperty('--k', 'var(--' + (o.role || 'in') + ')'); root.style.setProperty('--q', 'var(--' + (o.qrole || 'loss') + ')');
    root.setAttribute('role', 'img'); root.setAttribute('aria-label', o.label || 'attention over tokens');
    host.appendChild(root);
    function norm(row, i) { var m = 0; row.forEach(function (v, j) { if (j !== i) m = Math.max(m, v); }); return row.map(function (v) { return m ? v / m : 0; }); }
    function paint(row, i, spans) { var w = norm(row, i); spans.forEach(function (sp, j) { sp.className = 'tk' + (j === i ? ' q' : ''); sp.style.background = j === i ? 'none' : heatGlow(w[j]); }); }
    if (mode === 'ladder') {
      for (var i = 0; i < n; i++) {
        var r = document.createElement('div'); r.className = 'row'; root.appendChild(r);
        var spans = o.tokens.map(function (t) { var sp = document.createElement('span'); sp.textContent = t; r.appendChild(sp); return sp; });
        var row = o.w[i].map(function (v, j) { return j < i ? v : 0; }); paint(row, i, spans);
        spans.forEach(function (sp, j) { if (j > i) sp.className = 'tk later'; });
      }
      return { root: root };
    }
    var r2 = document.createElement('div'); r2.className = 'row'; root.appendChild(r2); root.tabIndex = 0;
    var sp2 = o.tokens.map(function (t) { var sp = document.createElement('span'); sp.textContent = t; r2.appendChild(sp); return sp; });
    var ctl = o.ctl ? (typeof o.ctl === 'string' ? document.querySelector(o.ctl) : o.ctl) : null, cur = o.start || 0;
    function pick(i) {
      cur = i; var row = o.causal ? o.w[i].map(function (v, j) { return j < i ? v : 0; }) : o.w[i]; paint(row, i, sp2);
      var bj = -1, bv = -1; row.forEach(function (v, j) { if (j !== i && v > bv) { bv = v; bj = j; } });
      if (ctl) ctl.innerHTML = o.say ? o.say(i, bj, bv) : '<span class="say">' + o.tokens[i] + ' → ' + (bj >= 0 && bv > 0 ? o.tokens[bj] + ' ' + bv.toFixed(2) : '·') + '</span>';
    }
    sp2.forEach(function (sp, j) { sp.addEventListener('mouseenter', function () { pick(j); }); sp.addEventListener('click', function () { pick(j); }); });
    root.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') pick(Math.min(n - 1, cur + 1)); if (e.key === 'ArrowLeft') pick(Math.max(0, cur - 1)); });
    pick(cur);
    return { root: root, pick: pick };
  }

  // isometric plates in the Hairline manner: line drawing, opaque plates, no words inside, names go to the read-out.
  // o.layers: [{name, role}] bottom to top. The pointer's height picks a layer (tested against the rest pose); the plates above it lift.
  function iso(host, o) {
    host = typeof host === 'string' ? document.querySelector(host) : host; host.innerHTML = '';
    var Lr = o.layers, n = Lr.length, W0 = o.w || 150, D0 = o.d || 100, T = o.t || 7, R = o.r || 9, open = o.open || 34;
    var gap = o.gap || 16, rest = Lr.map(function (_, i) { return i * gap + i * i * 1.6; });   // gaps widen upward: rest is a composition, not a pile
    var svg = el('svg', { 'class': 'fk-iso', viewBox: '0 0 400 320', role: 'img', 'aria-label': o.label || 'layers' }, host);
    var ctl = o.ctl ? (typeof o.ctl === 'string' ? document.querySelector(o.ctl) : o.ctl) : null;
    var c30 = Math.cos(Math.PI / 6), s30 = .5, ztop = rest[n - 1] + open, zbot = T + 10;   // fit the most open pose, not the rest pose
    var S = o.scale || Math.min(1.6, 290 / ((W0 + D0) * s30 + ztop + zbot), 370 / ((W0 + D0) * c30)), cyOff = 160 + (ztop - zbot) * S / 2;
    function P(x, y, z) { return [200 + (x - y) * c30 * S, cyOff + (x + y) * s30 * S - z * S]; }
    function ring(z) {
      var pts = [], cs = [[W0 / 2 - R, D0 / 2 - R, 0], [-W0 / 2 + R, D0 / 2 - R, 90], [-W0 / 2 + R, -D0 / 2 + R, 180], [W0 / 2 - R, -D0 / 2 + R, 270]];
      cs.forEach(function (c) { for (var k = 0; k <= 6; k++) { var t = (c[2] + k * 15) * Math.PI / 180; pts.push(P(c[0] + R * Math.cos(t), c[1] + R * Math.sin(t), z)); } });
      return pts;
    }
    function hull(p) {
      p = p.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
      function cr(o2, a, b) { return (a[0] - o2[0]) * (b[1] - o2[1]) - (a[1] - o2[1]) * (b[0] - o2[0]); }
      var lo = [], up = [];
      p.forEach(function (q) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
      p.slice().reverse().forEach(function (q) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); });
      return lo.slice(0, -1).concat(up.slice(0, -1));
    }
    function d(pts, close) { return 'M' + pts.map(function (q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('L') + (close ? 'Z' : ''); }
    el('path', { 'class': 'ground', d: d(ring(-T - 10), true) }, svg);
    var plates = Lr.map(function (ly) {
      var g = el('g', { 'class': 'r-' + (ly.role || 'op') }, svg);
      return { g: g, fill: el('path', { 'class': 'fill' }, g), crease: el('path', { 'class': 'crease' }, g), sil: el('path', { 'class': 'sil' }, g), z: 0, v: 0, t: 0, last: null };
    });
    function draw(p, z) {
      if (p.last !== null && Math.abs(p.last - z) < .01) return; p.last = z;
      var a = ring(z), b = ring(z - T), h = d(hull(a.concat(b)), true);
      p.fill.setAttribute('d', h); p.sil.setAttribute('d', h); p.crease.setAttribute('d', d(a, true));
    }
    var home = o.start === undefined ? n - 1 : o.start, sel = -2, raf = 0, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    function target(k) { plates.forEach(function (p, i) { p.t = rest[i] + (k >= 0 && i > k ? open : 0); }); }
    function light(k, say) { plates.forEach(function (p, i) { p.sil.classList.toggle('hi', i === k); }); if (ctl) ctl.innerHTML = '<span class="say">' + say + '</span>'; }
    function tick() {
      var moving = false;
      plates.forEach(function (p) {
        if (reduce) { p.z = p.t; p.v = 0; } else { for (var s = 0; s < 2; s++) { var f = -100 * (p.z - p.t) - 18 * p.v; p.v += f / 120; p.z += p.v / 120; } }
        if (Math.abs(p.z - p.t) > .02 || Math.abs(p.v) > .02) moving = true; else { p.z = p.t; p.v = 0; }
        draw(p, p.z);
      });
      raf = moving ? requestAnimationFrame(tick) : 0;
    }
    function wake() { if (!raf) raf = requestAnimationFrame(tick); }
    function choose(k) { if (k === sel) return; sel = k; target(k); light(k, (k + 1) + ' / ' + n + ' · ' + Lr[k].name); wake(); }
    function rest0() { sel = -2; target(-1); light(home, o.restSay || Lr[home].name); wake(); }
    var mids = plates.map(function (_, i) { return P(0, 0, rest[i] - T / 2)[1]; });
    svg.addEventListener('pointermove', function (e) {
      var r = svg.getBoundingClientRect(), y = (e.clientY - r.top) / r.height * 320, best = 0, bd = 1e9;
      mids.forEach(function (m, i) { var dd = Math.abs(m - y); if (dd < bd) { bd = dd; best = i; } });
      choose(best);
    });
    svg.addEventListener('pointerleave', rest0);
    svg.tabIndex = 0;
    svg.addEventListener('keydown', function (e) { if (e.key === 'ArrowUp') choose(Math.min(n - 1, Math.max(sel, 0) + 1)); if (e.key === 'ArrowDown') choose(Math.max(0, (sel < 0 ? n : sel) - 1)); if (e.key === 'Escape') rest0(); });
    target(-1); plates.forEach(function (p) { p.z = p.t; draw(p, p.z); }); light(home, o.restSay || Lr[home].name);
    if (/[?&]at=iso(\d+)/.test(location.search)) choose(+RegExp.$1);
    return { choose: choose, rest: rest0 };
  }

  // data plot in the same figure language. o.x / o.y: {min, max, log, ticks:[...], fmt(v)->TeX, label, hide}.
  // Every series has an id; calling the same method with the same id redraws it in place, so a slider handler
  // just recomputes and calls line()/dot()/text() again. o.pad: {l, r, t, b}. Returns {f, X, Y, line, dot, text, rect, vline, hline, remove}.
  function plot(host, o) {
    host = typeof host === 'string' ? document.querySelector(host) : host; host.innerHTML = '';
    var f = new Fig(host, o.w || 1000, o.h || 420, o.label);
    var m = Object.assign({ l: 76, r: 34, t: 30, b: 56 }, o.pad || {}), X0 = m.l, X1 = f.w - m.r, Y0 = f.h - m.b, Y1 = m.t;
    function axis(a, p0, p1) {
      var lg = !!a.log, lo = lg ? Math.log10(a.min) : a.min, hi = lg ? Math.log10(a.max) : a.max;
      return function (v) { var t = ((lg ? Math.log10(Math.max(v, 1e-300)) : v) - lo) / (hi - lo); return p0 + t * (p1 - p0); };
    }
    var X = axis(o.x, X0, X1), Y = axis(o.y, Y0, Y1), gA = el('g', {}, f.gS), items = {}, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    function ticks(a) {
      if (a.ticks) return a.ticks;
      var t = [];
      if (a.log) { for (var k = Math.ceil(Math.log10(a.min) - 1e-9); k <= Math.floor(Math.log10(a.max) + 1e-9); k++) t.push(Math.pow(10, k)); var s = Math.ceil(t.length / 8); return t.filter(function (_, i) { return i % s === 0; }); }
      var span = a.max - a.min, st = Math.pow(10, Math.floor(Math.log10(span / 5))); if (span / st > 10) st *= 2; if (span / st > 10) st *= 2.5;
      for (var v = Math.ceil(a.min / st - 1e-9) * st; v <= a.max + 1e-9; v += st) t.push(+v.toPrecision(12));
      return t;
    }
    function fmt(a, v) { return a.fmt ? a.fmt(v) : a.log ? '10^{' + Math.round(Math.log10(v)) + '}' : String(+v.toPrecision(6)); }
    if (!o.x.hide) {
      el('path', { 'class': 'axis', d: 'M' + X0 + ' ' + Y0 + 'H' + X1 }, gA);
      ticks(o.x).forEach(function (v) { var x = X(v); el('path', { 'class': 'tick', d: 'M' + x + ' ' + Y0 + 'v5' }, gA); f.label(fmt(o.x, v), x, Y0 + 17, { size: 12, cls: 'note' }); });
      if (o.x.label) f.label(o.x.label, X1, Y0 + 40, { anchor: 'end', size: 14 });
    }
    if (!o.y.hide) {
      el('path', { 'class': 'axis', d: 'M' + X0 + ' ' + Y0 + 'V' + Y1 }, gA);
      ticks(o.y).forEach(function (v) { var y = Y(v); el('path', { 'class': 'tick', d: 'M' + X0 + ' ' + y + 'h-5' }, gA); f.label(fmt(o.y, v), X0 - 9, y, { anchor: 'end', size: 12, cls: 'note' }); });
      if (o.y.label) f.label(o.y.label, X0 - 9, Y1 - 16, { anchor: 'start', size: 14 });
    }
    function cls(base, q) { return base + (q.role ? ' r-' + q.role : '') + (q.cls ? ' ' + q.cls : ''); }
    function inY(v) { var lo = Math.min(o.y.min, o.y.max), hi = Math.max(o.y.min, o.y.max), e = (hi - lo) * 1e-6; return isFinite(v) && v >= lo - e && v <= hi + e; }
    function path(pts) { var s = '', pen = false; pts.forEach(function (p) { if (!inY(p[1])) { pen = false; return; } s += (pen ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); pen = true; }); return s || 'M0 0'; }   // leaves the frame instead of clamping
    var raf = 0, tw = [];
    function step(now) {
      tw = tw.filter(function (t) {
        var k = Math.min(1, (now - t.t0) / 450), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        t.n.setAttribute('d', path(t.a.map(function (p, i) { return [p[0] + (t.b[i][0] - p[0]) * e, p[1] + (t.b[i][1] - p[1]) * e]; })));
        return k < 1;
      });
      raf = tw.length ? requestAnimationFrame(step) : 0;
    }
    var P = { f: f, X: X, Y: Y, box: { x0: X0, x1: X1, y0: Y1, y1: Y0 } };
    P.line = function (id, pts, q) {
      q = q || {}; var it = items[id];
      if (!it) { it = items[id] = { n: el('path', { 'class': cls('curve', q) }, q.under ? f.gS : f.gW), pts: null }; }
      else it.n.setAttribute('class', cls('curve', q));
      if (q.tween && it.pts && it.pts.length === pts.length && !reduce) { tw = tw.filter(function (t) { return t.n !== it.n; }); tw.push({ n: it.n, a: it.pts, b: pts, t0: performance.now() }); if (!raf) raf = requestAnimationFrame(step); }
      else it.n.setAttribute('d', path(pts));
      it.pts = pts; return it.n;
    };
    P.dot = function (id, p, q) {
      q = q || {}; var it = items[id] || (items[id] = { n: el('circle', {}, f.gB) });
      it.n.setAttribute('class', cls('pt', q)); it.n.setAttribute('cx', X(p[0])); it.n.setAttribute('cy', Y(p[1])); it.n.setAttribute('r', q.r || 4.6);
      return it.n;
    };
    P.text = function (id, txt, p, q) {
      q = q || {}; if (items[id]) items[id].n.remove();
      var n = f.label(txt, X(p[0]) + (q.dx || 0), Y(p[1]) + (q.dy || 0), { anchor: q.anchor || 'start', size: q.size || 13, cls: q.role ? 'r-' + q.role : q.cls || null });
      items[id] = { n: n }; return n;
    };
    P.rect = function (id, a, b, q) {
      q = q || {}; var it = items[id] || (items[id] = { n: el('rect', {}, f.gB) });
      var x0 = Math.min(X(a[0]), X(b[0])), x1 = Math.max(X(a[0]), X(b[0])), y0 = Math.min(Y(a[1]), Y(b[1])), y1 = Math.max(Y(a[1]), Y(b[1]));
      it.n.setAttribute('class', cls('bar', q)); it.n.setAttribute('x', x0); it.n.setAttribute('y', y0); it.n.setAttribute('width', Math.max(0, x1 - x0)); it.n.setAttribute('height', Math.max(0, y1 - y0)); it.n.setAttribute('rx', q.rx === undefined ? 2 : q.rx);
      return it.n;
    };
    P.vline = function (id, x, q) { q = q || {}; var it = items[id] || (items[id] = { n: el('path', {}, f.gW) }); it.n.setAttribute('class', cls('ref', q)); it.n.setAttribute('d', 'M' + X(x) + ' ' + Y(q.y0 === undefined ? o.y.min : q.y0) + 'V' + Y(q.y1 === undefined ? o.y.max : q.y1)); return it.n; };
    P.hline = function (id, y, q) { q = q || {}; var it = items[id] || (items[id] = { n: el('path', {}, f.gW) }); it.n.setAttribute('class', cls('ref', q)); it.n.setAttribute('d', 'M' + X(q.x0 === undefined ? o.x.min : q.x0) + ' ' + Y(y) + 'H' + X(q.x1 === undefined ? o.x.max : q.x1)); return it.n; };
    P.remove = function (id) { if (items[id]) { items[id].n.remove(); delete items[id]; } };
    P.has = function (id) { return !!items[id]; };
    return P;
  }

  // token chips. set(lines): lines = [{label, toks:[string | {raw:'E4'}]}]. Leading spaces show as a faint middle dot.
  function tokens(host, o) {
    host = typeof host === 'string' ? document.querySelector(host) : host; host.innerHTML = '';
    var root = document.createElement('div'); root.className = 'fk-toks'; root.setAttribute('role', 'img'); root.setAttribute('aria-label', (o && o.label) || 'tokens'); host.appendChild(root);
    function set(lines) {
      root.innerHTML = '';
      lines.forEach(function (ln) {
        if (ln.label) { var l = document.createElement('div'); l.className = 'lab'; l.textContent = ln.label; root.appendChild(l); }
        var r = document.createElement('div'); r.className = 'row'; root.appendChild(r);
        ln.toks.forEach(function (t, i) {
          var s = document.createElement('span'); s.className = 'tk' + (i % 2 ? ' b' : '');
          if (typeof t === 'object') { s.className += ' raw'; s.textContent = t.raw; }
          else { var m = /^( +)/.exec(t); if (m) { var sp = document.createElement('span'); sp.className = 'sp'; sp.textContent = m[1].replace(/ /g, '·'); s.appendChild(sp); t = t.slice(m[1].length); } s.appendChild(document.createTextNode(t)); }
          r.appendChild(s);
        });
      });
    }
    if (o && o.lines) set(o.lines);
    return { root: root, set: set };
  }

  // pre-delivery check; logs to console; ?lint writes results into <pre id=fk-lint>
  function lint() {
    var out = [];
    document.querySelectorAll('svg.fk').forEach(function (svg, si) {
      var vb = svg.viewBox.baseVal, texts = [].slice.call(svg.querySelectorAll('text')).filter(function (t) { return t.textContent.trim(); });
      if (vb.width > 1260) out.push('fig' + si + ': viewBox width ' + vb.width + ' > 1260');
      function off(n) { var x = 0, y = 0; for (; n && n !== svg; n = n.parentNode) { var m = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(n.getAttribute && n.getAttribute('transform') || ''); if (m) { x += +m[1]; y += +m[2]; } } return [x, y]; }
      var boxes = texts.map(function (t) { var b = t.getBBox(), o = off(t); return { t: t, x0: b.x + o[0], y0: b.y + o[1], x1: b.x + o[0] + b.width, y1: b.y + o[1] + b.height }; });
      boxes.forEach(function (b) {
        var fs = parseFloat(getComputedStyle(b.t).fontSize);
        if (fs < 11) out.push('fig' + si + ': text too small ' + fs.toFixed(1) + ' "' + b.t.textContent + '"');
        if (b.x0 < vb.x - 1 || b.y0 < vb.y - 1 || b.x1 > vb.x + vb.width + 1 || b.y1 > vb.y + vb.height + 1) out.push('fig' + si + ': out of bounds "' + b.t.textContent + '"');
      });
      for (var i = 0; i < boxes.length; i++) for (var j = i + 1; j < boxes.length; j++) {
        var a = boxes[i], c = boxes[j];
        if (a.x0 < c.x1 - 1 && c.x0 < a.x1 - 1 && a.y0 < c.y1 - 2 && c.y0 < a.y1 - 2) out.push('fig' + si + ': text overlap "' + a.t.textContent + '" × "' + c.t.textContent + '"');
      }
      svg.querySelectorAll('.blk').forEach(function (g) {
        var r = g.querySelector('rect').getBBox();
        g.querySelectorAll('text').forEach(function (t) { var b = t.getBBox(); if (b.x < r.x + 3 || b.x + b.width > r.x + r.width - 3) out.push('fig' + si + ': label overflows box "' + t.textContent + '"'); });
        if (g.querySelectorAll('text').length > 3) out.push('fig' + si + ': more than 3 lines in a box');
      });
      svg.querySelectorAll('.wire[data-pts]').forEach(function (p) {
        var po = off(p), pts = JSON.parse(p.getAttribute('data-pts')).map(function (q) { return [q[0] + po[0], q[1] + po[1]]; });
        boxes.forEach(function (b) {
          if (b.t.closest('.blk')) return;
          for (var k = 1; k < pts.length; k++) {
            var x0 = Math.min(pts[k - 1][0], pts[k][0]), x1 = Math.max(pts[k - 1][0], pts[k][0]), y0 = Math.min(pts[k - 1][1], pts[k][1]), y1 = Math.max(pts[k - 1][1], pts[k][1]);
            if (x0 < b.x1 - 1 && b.x0 + 1 < x1 + 0.01 && y0 < b.y1 - 1 && b.y0 + 1 < y1 + 0.01) { out.push('fig' + si + ': text on a wire "' + b.t.textContent + '"'); break; }
          }
        });
      });
      if (svg.querySelector('[filter],filter')) out.push('fig' + si + ': uses filter (glow/shadow): remove');
    });
    out.forEach(function (m) { console.warn('[FK.lint] ' + m); });
    if (!out.length) console.log('[FK.lint] ok');
    if (/[?&]lint/.test(location.search)) { var pre = document.createElement('pre'); pre.id = 'fk-lint'; pre.textContent = out.length ? out.join('\n') : 'FK.lint ok'; document.body.prepend(pre); }
    return out;
  }

  return { fig: function (h, w, hh, l) { var hs = typeof h === 'string' ? document.querySelector(h) : h; hs.innerHTML = ''; return new Fig(hs, w, hh, l); }, heat: heat, iso: iso, plot: plot, tokens: tokens, S: S, W: W, lint: lint, rich: rich };
})();
/* ===== FIGKIT JS END ===== */
