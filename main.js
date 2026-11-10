/* ==========================================================
   Team Aqua ASD — Home prototype
   - Shader WebGL d'acqua (caustiche, raggi di luce, onde al click)
   - Tridente del logo composto da particelle che emergono dall'acqua
   - Profondimetro e colore di sfondo legati allo scroll
   - Roster Gini con squadre in GIF animate
   ========================================================== */

import { REDUCED, clamp, lerp, initNav, initReveal, initCounters, initHolo, initCursor, initMagnetic } from './common.js';
import { initTide } from './transition.js';
import { initSectionsFx } from './sections-fx.js';

const ARRIVING = initTide();

/* Tridente vettoriale (stesse coordinate del simbolo SVG in index.html) */
const TRIDENT = {
  vb: { x: 70, y: 250, w: 660, h: 535 },
  paths: [
    'M280 255 L75 438 L160 410 L160 520 Q160 545 180 570 L392 775 Q400 782 408 775 L620 570 Q640 545 640 520 L640 410 L725 438 L520 255 Q575 360 575 480 L575 520 Q575 540 560 555 L432 680 L453 500 Q455 490 448 484 L405 457 Q400 454 395 457 L352 484 Q345 490 347 500 L368 680 L240 555 Q225 540 225 520 L225 480 Q225 360 280 255 Z',
    'M400 295 Q440 340 447 418 L408 395 Q400 390 392 395 L353 418 Q360 340 400 295 Z',
  ],
};

/* Stato condiviso tra shader e particelle */
const hero = document.querySelector('[data-hero]');
const pointer = { x: -9999, y: -9999, nx: .5, ny: .5, sx: .5, sy: .5, inside: false };
const ripple = { x: .5, y: .5, t: -100 };
let heroVisible = true;
let heroScroll = 0; // 0 → 1 mentre l'hero esce dallo schermo
const clockStart = performance.now();
// qualità adattiva: se il dispositivo fatica, si dimezzano particelle e risoluzione dell'acqua
const quality = { water: 1, low: false };
let lastInteraction = performance.now();
const now = () => (performance.now() - clockStart) / 1000;

/* ---------------------------------------------------------- */
/* 1. Shader acqua                                             */
/* ---------------------------------------------------------- */
function initWater(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return null;

  const vs = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
  const fs = `
    precision highp float;
    uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform vec3 uRipple; uniform float uScroll;
    #define TAU 6.28318530718

    float caustic(vec2 uv, float time) {
      vec2 p = uv * TAU - 250.0;
      vec2 i = p; float c = 1.0; float inten = 0.005;
      for (int n = 0; n < 5; n++) {
        float t = time * (1.0 - (3.5 / float(n + 1)));
        i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
        c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
      }
      c /= 5.0;
      c = 1.17 - pow(c, 1.4);
      return pow(abs(c), 8.0);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uRes;
      float aspect = uRes.x / uRes.y;
      vec2 st = uv * vec2(aspect, 1.0);

      // onda circolare al click
      vec2 rp = uRipple.xy * vec2(aspect, 1.0);
      float rt = uTime - uRipple.z;
      float d = distance(st, rp);
      float front = rt * 0.55;
      float ring = 0.0;
      if (rt > 0.0 && rt < 3.5) ring = sin((d - front) * 38.0) * exp(-abs(d - front) * 10.0) * (1.0 - rt / 3.5);
      st += normalize(st - rp + 1e-4) * ring * 0.014;

      // lente sotto il cursore
      vec2 mm = uMouse * vec2(aspect, 1.0);
      float md = distance(st, mm);
      st += (st - mm) * 0.12 * exp(-md * 5.0);

      float t = uTime;
      float c1 = caustic(st * 1.15 + vec2(0.0, t * 0.02), t * 0.38 + 23.0);
      float c2 = caustic(st * 0.62 + vec2(3.1, 1.7), t * 0.22 + 11.0);

      vec3 abyss = vec3(0.008, 0.016, 0.08);
      vec3 navy  = vec3(0.027, 0.055, 0.42);
      vec3 royal = vec3(0.004, 0.396, 0.835);
      float h = uv.y - uScroll * 0.6;
      vec3 col = mix(abyss, navy, smoothstep(-0.1, 0.55, h));
      col = mix(col, royal, smoothstep(0.5, 1.2, h) * 0.9);

      float light = smoothstep(0.0, 1.0, h);
      col += vec3(0.45, 0.9, 1.0) * c1 * 0.5 * light;
      col += vec3(0.25, 0.6, 1.0) * c2 * 0.28 * light;

      // raggi di luce dalla superficie
      float rays = sin(uv.x * 9.0 + sin(uv.x * 2.3 + t * 0.21) * 2.4 + t * 0.12) * 0.5 + 0.5;
      rays *= sin(uv.x * 23.0 - t * 0.3) * 0.25 + 0.75;
      col += vec3(0.35, 0.7, 1.0) * pow(rays, 3.0) * smoothstep(0.25, 1.0, h) * 0.22;

      col += vec3(0.2, 0.6, 1.0) * 0.22 * exp(-md * 4.5);
      col += vec3(0.6, 0.95, 1.0) * max(ring, 0.0) * 0.3;

      vec2 q = uv - 0.5;
      col *= 1.0 - dot(q, q) * 0.85;
      gl_FragColor = vec4(col, 1.0);
    }`;

  // Compilazione in background quando il browser lo permette (KHR_parallel_shader_compile):
  // finché lo shader non è pronto si vede il gradiente CSS e la pagina non si blocca.
  const parallel = gl.getExtension('KHR_parallel_shader_compile');
  const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  const v = mk(gl.VERTEX_SHADER, vs), f = mk(gl.FRAGMENT_SHADER, fs);
  gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);

  let ready = false, failed = false, uRes, uTime, uMouse, uRipple, uScroll;
  const finish = () => {
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn(gl.getShaderInfoLog(v) || gl.getShaderInfoLog(f) || gl.getProgramInfoLog(prog));
      failed = true; return;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = name => gl.getUniformLocation(prog, name);
    uRes = u('uRes'); uTime = u('uTime'); uMouse = u('uMouse'); uRipple = u('uRipple'); uScroll = u('uScroll');
    ready = true;
  };
  const isReady = () => {
    if (ready || failed) return ready;
    if (parallel && !gl.getProgramParameter(prog, parallel.COMPLETION_STATUS_KHR)) return false;
    finish();
    return ready;
  };

  // risoluzione ridotta: lo shader è morbido, il risparmio di GPU è enorme
  const resize = () => {
    // l'acqua è morbida: mezzo pixel CSS basta, indipendentemente dalla densità dello schermo,
    // con un tetto di ~600k pixel anche su monitor molto grandi
    let scale = (innerWidth < 720 ? .36 : .42) * quality.water;
    const px = canvas.clientWidth * canvas.clientHeight * scale * scale;
    if (px > 400000) scale *= Math.sqrt(400000 / px);
    canvas.width = Math.round(canvas.clientWidth * scale);
    canvas.height = Math.round(canvas.clientHeight * scale);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  resize();

  return {
    resize,
    render(t) {
      if (!isReady()) return;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, t);
      gl.uniform2f(uMouse, pointer.sx, 1 - pointer.sy);
      gl.uniform3f(uRipple, ripple.x, 1 - ripple.y, ripple.t);
      gl.uniform1f(uScroll, heroScroll);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}

/* ---------------------------------------------------------- */
/* 2. Tridente di particelle                                   */
/* ---------------------------------------------------------- */
function initTrident(canvas, titleEl) {
  const ctx = canvas.getContext('2d');
  const paths = TRIDENT.paths.map(d => new Path2D(d));
  let W = 0, H = 0, dpr = 1;
  let parts = [];
  let bubbles = [];
  let glow = null;
  let box = { x: 0, y: 0, s: 1, w: 0, h: 0 };
  const shocks = [];
  let introStart = performance.now();
  let assembled = REDUCED;

  function buildGlow() {
    // l'alone è sfocato: basta calcolarlo a un terzo della risoluzione e ingrandirlo
    glow = document.createElement('canvas');
    const pad = 80, gs = .33;
    glow.width = Math.ceil((box.w + pad * 2) * gs);
    glow.height = Math.ceil((box.h + pad * 2) * gs);
    glow.cssW = box.w + pad * 2; glow.cssH = box.h + pad * 2;
    const g = glow.getContext('2d');
    g.setTransform(gs * box.s, 0, 0, gs * box.s, gs * (pad - TRIDENT.vb.x * box.s), gs * (pad - TRIDENT.vb.y * box.s));
    g.shadowColor = 'rgba(56, 189, 255, 0.9)';
    g.shadowBlur = 50 * gs;
    g.fillStyle = 'rgba(30, 130, 255, 0.35)';
    paths.forEach(p => g.fill(p));
    glow.pad = pad;
  }

  function sample() {
    const mobile = W < 720;
    // il tridente si centra sul titolo "TEAM AQUA"
    // centro del tridente: indipendente dal titolo, che ora sta più in alto
    const cy = H * (mobile ? .3 : .4);
    const th = Math.min(H * (mobile ? .32 : .46), W * (mobile ? .62 : .42) * TRIDENT.vb.h / TRIDENT.vb.w);
    const s = th / TRIDENT.vb.h;
    const tw = TRIDENT.vb.w * s;
    box = { s, w: tw, h: th, x: (W - tw) / 2, y: cy - th / 2 - th * .04 };

    // rasterizza il tridente e campiona i pixel pieni
    const off = document.createElement('canvas');
    off.width = Math.ceil(tw); off.height = Math.ceil(th);
    const o = off.getContext('2d', { willReadFrequently: true });
    o.setTransform(s, 0, 0, s, -TRIDENT.vb.x * s, -TRIDENT.vb.y * s);
    o.fillStyle = '#fff';
    paths.forEach(p => o.fill(p));
    const data = o.getImageData(0, 0, off.width, off.height).data;
    const filled = (x, y) => x >= 0 && y >= 0 && x < off.width && y < off.height && data[(y * off.width + x) * 4 + 3] > 128;

    let count = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 128) count++;
    const target = mobile ? 1300 : 2400;
    const step = Math.max(2, Math.sqrt(count / target));

    const prev = parts;
    parts = [];
    for (let y = 0; y < off.height; y += step) {
      for (let x = 0; x < off.width; x += step) {
        const jx = x + (Math.random() - .5) * step * .6;
        const jy = y + (Math.random() - .5) * step * .6;
        const ix = Math.round(jx), iy = Math.round(jy);
        if (!filled(ix, iy)) continue;
        const e = step * 1.4;
        const edge = !filled(Math.round(ix + e), iy) || !filled(Math.round(ix - e), iy) || !filled(ix, Math.round(iy + e)) || !filled(ix, Math.round(iy - e));
        const tx = box.x + jx, ty = box.y + jy;
        const ang = Math.random() * Math.PI * 2;
        parts.push({
          tx, ty,
          x: tx + (Math.random() - .5) * W * .7,
          y: H + Math.random() * H * .6,
          vx: 0, vy: 0,
          delay: ((box.y + box.h - ty) / box.h) * 900 + Math.random() * 700,
          edge,
          shade: jy / off.height,
          dx: Math.cos(ang), dy: Math.sin(ang), up: .4 + Math.random(),
          tw: Math.random() * Math.PI * 2,
        });
      }
    }
    // dopo un resize: niente nuova intro, le particelle partono da dove erano
    if (assembled) parts.forEach((p, i) => {
      const q = prev[i];
      p.x = q ? q.x : p.tx; p.y = q ? q.y : p.ty; p.delay = 0;
      if (REDUCED) { p.x = p.tx; p.y = p.ty; }
    });

    bubbles = Array.from({ length: mobile ? 26 : 50 }, () => newBubble(true));
    buildGlow();
  }

  function newBubble(anywhere) {
    return {
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : H + 10,
      r: .8 + Math.random() * 3.2,
      v: .25 + Math.random() * .9,
      w: Math.random() * Math.PI * 2,
    };
  }

  function layout() {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = canvas.clientWidth; H = canvas.clientHeight;
    // finestra nascosta o a dimensione zero (es. scheda in background): si riprova al prossimo resize
    if (W < 2 || H < 2) return;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    sample();
  }

  function shock(x, y) { shocks.push({ x, y, t: performance.now() }); }

  const buckets = [
    { color: 'rgba(240, 250, 255, 0.95)', size: 2.4, list: [] }, // bordi
    { color: 'rgba(160, 232, 255, 0.85)', size: 2.2, list: [] }, // interno alto
    { color: 'rgba(80, 170, 255, 0.8)', size: 2.2, list: [] },   // interno medio
    { color: 'rgba(40, 110, 255, 0.75)', size: 2.2, list: [] },  // interno basso
  ];

  function frame(ms) {
    const t = ms - introStart;
    const sc = REDUCED ? 0 : heroScroll * heroScroll;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // bolle sullo sfondo
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(180, 230, 255, 0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const b of bubbles) {
      if (!REDUCED) {
        b.y -= b.v * (1 + sc * 6);
        b.x += Math.sin(ms * .001 + b.w) * .3;
        if (b.y < -10) Object.assign(b, newBubble(false));
      }
      ctx.moveTo(b.x + b.r, b.y);
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    }
    ctx.stroke();

    // alone del tridente, appare a composizione finita
    const glowA = REDUCED ? 1 : clamp((t - 1500) / 1400) * (1 - clamp(heroScroll * 1.6));
    if (glow && glowA > 0) {
      ctx.globalAlpha = glowA * (.75 + Math.sin(ms * .0015) * .12);
      ctx.drawImage(glow, box.x - glow.pad, box.y - glow.pad, glow.cssW, glow.cssH);
      ctx.globalAlpha = 1;
    }

    ctx.globalCompositeOperation = 'lighter';
    buckets.forEach(b => (b.list.length = 0));

    const mx = pointer.x, my = pointer.y, R = W < 720 ? 70 : 110, R2 = R * R;
    const activeShocks = shocks.filter(s => ms - s.t < 1400);
    shocks.length = 0; shocks.push(...activeShocks);

    for (const p of parts) {
      if (!REDUCED) {
        const live = t > p.delay;
        if (!live) {
          p.y -= 1.2; // sale come una bolla in attesa del suo turno
          p.x += Math.sin(ms * .002 + p.tw) * .4;
        } else {
          const wave = assembled ? 1 : clamp((t - p.delay) / 1600);
          const gx = p.tx + Math.sin(ms * .0016 + p.ty * .025) * 1.3 * wave + p.dx * sc * 320;
          const gy = p.ty + Math.cos(ms * .0013 + p.tx * .02) * 1.3 * wave + p.dy * sc * 220 - sc * H * .55 * p.up;
          p.vx = (p.vx + (gx - p.x) * .045) * .84;
          p.vy = (p.vy + (gy - p.y) * .045) * .84;

          const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
          if (d2 < R2) {
            const d = Math.sqrt(d2) || 1, f = (1 - d / R) ** 2 * 9;
            p.vx += dx / d * f; p.vy += dy / d * f;
          }
          for (const s of activeShocks) {
            const age = ms - s.t, rad = age * .75;
            const sx = p.x - s.x, sy = p.y - s.y, sd = Math.sqrt(sx * sx + sy * sy) || 1;
            const k = Math.abs(sd - rad);
            if (k < 36) {
              const f = (1 - k / 36) * 5 * (1 - age / 1400);
              p.vx += sx / sd * f; p.vy += sy / sd * f;
            }
          }
          p.x += p.vx; p.y += p.vy;
        }
      }
      const b = p.edge ? 0 : p.shade < .33 ? 1 : p.shade < .66 ? 2 : 3;
      buckets[b].list.push(p);
    }

    for (const b of buckets) {
      ctx.fillStyle = b.color;
      const s = b.size;
      for (const p of b.list) ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }

    // scintillii
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    for (let i = 0; i < parts.length; i += 97) {
      const p = parts[i];
      const k = Math.sin(ms * .004 + p.tw * 7);
      if (k > .9) { const s = 2 + (k - .9) * 30; ctx.fillRect(p.x - s / 2, p.y - .5, s, 1); ctx.fillRect(p.x - .5, p.y - s / 2, 1, s); }
    }
    ctx.globalCompositeOperation = 'source-over';

    if (!assembled && t > 4200) assembled = true;
  }

  // modalità leggera: tiene una particella su due
  const lighten = () => { parts = parts.filter((_, i) => i % 2 === 0); };
  return { layout, frame, shock, lighten, restart: () => { introStart = performance.now(); } };
}

/* ---------------------------------------------------------- */
/* 3. Hero: assemblaggio e loop                                */
/* ---------------------------------------------------------- */
function initHero() {
  const title = document.querySelector('[data-hero-title]');
  // lettere separate per l'animazione d'ingresso
  const text = title.textContent;
  title.setAttribute('aria-label', text);
  title.innerHTML = [...text].map((c, i) => c === ' ' ? '<span class="sp" aria-hidden="true"></span>' : `<span class="ch" aria-hidden="true" style="--i:${i}">${c}</span>`).join('');

  // l'acqua (compilazione dello shader) parte un attimo dopo, quando la pagina è già disegnata
  let water = null;
  const trident = initTrident(document.querySelector('[data-trident]'), title);

  hero.addEventListener('pointermove', e => {
    lastInteraction = performance.now();
    const r = hero.getBoundingClientRect();
    pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
    pointer.nx = pointer.x / r.width; pointer.ny = pointer.y / r.height;
    pointer.inside = true;
  });
  hero.addEventListener('pointerleave', () => { pointer.x = pointer.y = -9999; pointer.inside = false; });
  hero.addEventListener('pointerdown', e => {
    lastInteraction = performance.now();
    if (e.target.closest('a, button')) return;
    const r = hero.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    ripple.x = x / r.width; ripple.y = y / r.height; ripple.t = now();
    trident.shock(x, y);
  });

  let ready = false, rafId = 0;
  const start = () => { if (ready && !rafId) rafId = requestAnimationFrame(loop); };
  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; if (heroVisible) start(); }, { threshold: 0 }).observe(hero);

  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { water?.resize(); trident.layout(); if (REDUCED) draw(performance.now()); }, 150);
  });

  const players = document.querySelector('[data-players]');
  let lastTx = 0, lastTy = 0;
  function draw(ms) {
    const target = pointer.inside ? pointer : { nx: .5, ny: .35 };
    pointer.sx = lerp(pointer.sx, target.nx, .06);
    pointer.sy = lerp(pointer.sy, target.ny, .06);
    water?.render(now());
    trident.frame(ms);
    // parallasse dei giocatori e affondamento allo scroll
    // un solo transform sul contenitore (livello composito): niente ricalcolo di stili né ridisegno delle ombre
    const tx = -(pointer.sx - .5) * 32, ty = -(pointer.sy - .5) * 16 + heroScroll * 144;
    if (Math.abs(tx - lastTx) > .1 || Math.abs(ty - lastTy) > .1) {
      lastTx = tx; lastTy = ty;
      players.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
    }
  }

  let lastDraw = 0, samples = 0, sum = 0;
  const readyAt = performance.now() + 5000; // dopo l'intro
  function loop(ms) {
    rafId = 0;
    if (!heroVisible) return;
    // 60 fps durante intro e interazione, 30 fps quando la hero è ferma
    const idle = ms > readyAt && ms - lastInteraction > 1500 && heroScroll === 0;
    const minGap = idle ? 32 : 15.5;
    if (ms - lastDraw >= minGap) {
      const dt = ms - lastDraw;
      lastDraw = ms;
      draw(ms);
      // misura le prestazioni reali dopo l'intro e, se serve, scende di qualità una volta sola
      if (!quality.low && ms > readyAt && !idle && dt < 200) {
        sum += dt; samples++;
        if (samples >= 90) {
          if (sum / samples > 24) { quality.low = true; quality.water = .7; water?.resize(); trident.lighten(); }
          samples = 0; sum = 0;
        }
      }
    }
    if (!REDUCED) rafId = requestAnimationFrame(loop);
  }

  // avvia dopo il caricamento del font (il titolo determina la posizione del tridente)
  const fontsReady = document.fonts?.ready ?? Promise.resolve();
  // arrivando con la transizione, l'intro parte mentre l'acqua defluisce
  const delay = ARRIVING ? new Promise(r => addEventListener('tide:reveal', () => setTimeout(r, 150), { once: true })) : Promise.resolve();
  Promise.all([fontsReady, delay]).then(() => {
    // l'acqua (contesto WebGL) si prepara prima che parta l'animazione: l'eventuale attesa
    // cade quando non si muove ancora nulla, non a metà dell'intro
    water = initWater(document.querySelector('[data-water]'));
    trident.layout();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      trident.restart();
      ready = true;
      document.body.classList.add('is-ready');
      start();
    }));
  });
}

/* ---------------------------------------------------------- */
/* 4. Scroll: profondimetro, sfondo, nav                       */
/* ---------------------------------------------------------- */
function initScroll() {
  const dark = document.querySelector('.depth-dark');
  const zones = [[0, 'Superficie'], [1, 'Zona eufotica'], [200, 'Zona mesopelagica'], [1000, 'Zona batipelagica'], [4000, 'Zona abissale']];
  let lastDark = -1;
  const val = document.querySelector('[data-depth-value]');
  const fill = document.querySelector('[data-depth-fill]');
  const label = document.querySelector('[data-depth-label]');


  let ticking = false;
  const update = () => {
    ticking = false;
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = clamp(y / max);
    heroScroll = clamp(y / (hero.offsetHeight * .9));
    const o = Math.round(Math.min(1, p * 1.15) * 100) / 100;
    if (o !== lastDark) { lastDark = o; dark.style.opacity = o; }
    const depth = Math.round(5800 * p ** 1.7);
    val.textContent = depth.toLocaleString('it-IT');
    fill.style.setProperty('--p', p);
    label.textContent = zones.filter(([d]) => depth >= d).pop()[1];
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

/* ---------------------------------------------------------- */
/* 5. Roster Gini                                              */
/* ---------------------------------------------------------- */
const sprite = id => `https://play.pokemonshowdown.com/sprites/ani/${id}.gif`;
const mon = (id, name) => ({ id, name });

const GINI = [
  {
    first: 'Matteo', photo: 'assets/vgc/gini/matteo.webp',
    results: [
      { place: '2° posto', event: 'Mondiali 2011', team: [mon('landorus', 'Landorus'), mon('thundurus', 'Thundurus'), mon('scrafty', 'Scrafty'), mon('haxorus', 'Haxorus'), mon('krookodile', 'Krookodile'), mon('eelektross', 'Eelektross')] },
      { place: 'Campione', event: 'Nazionale Italiano 2013', team: [mon('hydreigon', 'Hydreigon'), mon('charizard-megay', 'Mega Charizard Y'), mon('breloom', 'Breloom'), mon('politoed', 'Politoed'), mon('kingdra', 'Kingdra'), mon('thundurus', 'Thundurus')] },
      { place: 'Top 8', event: 'Nazionale Inglese 2015', team: [mon('kangaskhan-mega', 'Mega Kangaskhan'), mon('scizor', 'Scizor'), mon('sylveon', 'Sylveon'), mon('aegislash', 'Aegislash'), mon('landorus-therian', 'Landorus-T'), mon('heatran', 'Heatran')] },
    ],
  },
  {
    first: 'Nicola', photo: 'assets/vgc/gini/nicola.webp',
    results: [
      { place: 'Campione Senior', event: 'Nazionale Inglese 2014', team: [mon('garchomp', 'Garchomp'), mon('rotom-heat', 'Rotom-Heat'), mon('venusaur', 'Venusaur'), mon('kangaskhan-mega', 'Mega Kangaskhan'), mon('aegislash', 'Aegislash'), mon('salamence-mega', 'Mega Salamence')] },
      { place: 'Campione Senior', event: 'Nazionale Tedesco 2014', team: [mon('tyranitar', 'Tyranitar'), mon('rotom-heat', 'Rotom-Heat'), mon('salamence-mega', 'Mega Salamence'), mon('aegislash', 'Aegislash'), mon('kangaskhan-mega', 'Mega Kangaskhan'), mon('venusaur', 'Venusaur')] },
      { place: 'Top 4 Senior', event: 'Nazionale Italiano 2014', team: [mon('garchomp', 'Garchomp'), mon('escavalier', 'Escavalier'), mon('landorus-therian', 'Landorus-T'), mon('latios', 'Latios'), mon('hitmontop', 'Hitmontop'), mon('cresselia', 'Cresselia')] },
    ],
  },
  {
    first: 'Alberto', photo: 'assets/vgc/gini/alberto.webp',
    results: [
      { place: 'Campione', event: 'Nazionale Tedesco 2013', team: [mon('hydreigon', 'Hydreigon'), mon('breloom', 'Breloom'), mon('scizor', 'Scizor'), mon('politoed', 'Politoed'), mon('kingdra', 'Kingdra'), mon('thundurus', 'Thundurus')] },
      { place: 'Top 8', event: 'Regionale Roma 2015', team: [mon('gardevoir-mega', 'Mega Gardevoir'), mon('zapdos', 'Zapdos'), mon('scrafty', 'Scrafty'), mon('amoonguss', 'Amoonguss'), mon('heatran', 'Heatran'), mon('scizor', 'Scizor')] },
      { place: 'Top 8', event: 'Nazionale Italiano 2016', team: [mon('kangaskhan-mega', 'Mega Kangaskhan'), mon('xerneas', 'Xerneas'), mon('salamence-mega', 'Mega Salamence'), mon('groudon-primal', 'Primal Groudon'), mon('crobat', 'Crobat'), mon('smeargle', 'Smeargle')] },
    ],
  },
];

function initGini() {
  const root = document.querySelector('[data-gini]');
  const arrow = '<svg class="tab__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>';

  root.innerHTML = GINI.map((p, pi) => `
    <article class="player" data-reveal style="--d:${pi * .12}s">
      <div class="holo player__photo" data-holo>
        <img src="${p.photo}" alt="${p.first} Gini con la maglia Team Aqua" loading="lazy">
        <div class="holo__shine"></div>
        <span class="player__num">0${pi + 1}</span>
        <h3 class="player__name">${p.first}<span>Gini</span></h3>
      </div>
      <div class="player__body">
        <div class="player__tabs" role="tablist" aria-label="Risultati di ${p.first} Gini">
          ${p.results.map((r, ri) => `
            <button class="tab" type="button" role="tab" id="t-${pi}-${ri}" aria-controls="team-${pi}" aria-selected="${ri === 0}" tabindex="${ri === 0 ? 0 : -1}" data-p="${pi}" data-r="${ri}">
              <span><b>${r.place}</b><small>${r.event}</small></span>${arrow}
            </button>`).join('')}
        </div>
        <div class="team" id="team-${pi}" role="tabpanel" aria-labelledby="t-${pi}-0" aria-live="polite"></div>
      </div>
    </article>`).join('');

  const renderTeam = (el, team) => {
    el.innerHTML = team.map((m, i) => `
      <figure class="mon" style="--i:${i}">
        <img src="${sprite(m.id)}" alt="${m.name}" loading="lazy" decoding="async">
        <figcaption>${m.name}</figcaption>
      </figure>`).join('');
  };

  GINI.forEach((p, pi) => renderTeam(root.querySelector(`#team-${pi}`), p.results[0].team));

  const select = tab => {
    const pi = +tab.dataset.p, ri = +tab.dataset.r;
    const list = tab.parentElement;
    if (tab.getAttribute('aria-selected') === 'true') return;
    list.querySelectorAll('.tab').forEach(t => { const on = t === tab; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; });
    const panel = root.querySelector(`#team-${pi}`);
    panel.setAttribute('aria-labelledby', tab.id);
    // precarica le GIF prima dello scambio
    GINI[pi].results[ri].team.forEach(m => { const i = new Image(); i.src = sprite(m.id); });
    panel.classList.remove('is-entering');
    panel.classList.add('is-swapping');
    setTimeout(() => {
      renderTeam(panel, GINI[pi].results[ri].team);
      panel.classList.remove('is-swapping');
      void panel.offsetWidth;
      panel.classList.add('is-entering');
    }, REDUCED ? 0 : 380);
  };

  root.addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) select(t); });
  root.addEventListener('keydown', e => {
    const t = e.target.closest('.tab');
    if (!t || !['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const tabs = [...t.parentElement.children];
    const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
    const next = tabs[(tabs.indexOf(t) + dir + tabs.length) % tabs.length];
    next.focus(); select(next);
  });
}

/* ---------------------------------------------------------- */
/* 6. Ticker                                                   */
/* ---------------------------------------------------------- */
function initTicker() {
  const track = document.querySelector('[data-ticker]');
  const list = track.firstElementChild;
  const clone = list.cloneNode(true);
  clone.setAttribute('aria-hidden', 'true');
  track.appendChild(clone);
}

/* ---------------------------------------------------------- */
/* 7. Sezioni "cosa fa il Team Aqua"                           */
/* ---------------------------------------------------------- */
// nastro degli sponsor: si duplica la lista per lo scorrimento continuo
function initMarquees() {
  document.querySelectorAll('[data-marquee]').forEach(track => {
    const clone = track.firstElementChild.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.querySelectorAll('img').forEach(i => (i.alt = ''));
    track.appendChild(clone);
  });
}

// Battle Lab: le tappe cambiano foto e testo
function initStops() {
  const root = document.querySelector('[data-stops]');
  if (!root) return;
  const img = root.querySelector('[data-stop-img]');
  const text = root.querySelector('[data-stop-text]');
  const texts = [...root.querySelector('[data-stop-texts]').content.querySelectorAll('p')].map(p => p.textContent);
  const tabs = [...root.querySelectorAll('.blab__tab')];
  // precarica le foto delle tappe
  tabs.forEach(t => { const i = new Image(); i.src = t.dataset.img; });
  const media = img.parentElement;
  let busy = false;
  // la nuova foto entra con un'onda circolare che parte dalla tappa cliccata
  const select = t => {
    if (busy || t.getAttribute('aria-selected') === 'true') return;
    tabs.forEach(x => x.setAttribute('aria-selected', x === t));
    text.textContent = texts[tabs.indexOf(t)];
    if (REDUCED) { img.src = t.dataset.img; img.alt = t.dataset.alt; return; }
    busy = true;
    const mr = media.getBoundingClientRect(), tr = t.getBoundingClientRect();
    const cx = clamp((tr.left + tr.width / 2 - mr.left) / mr.width, 0, 1) * 100;
    media.style.setProperty('--cx', `${cx}%`);
    media.style.setProperty('--cy', '100%');
    const next = document.createElement('img');
    next.className = 'blab__next'; next.src = t.dataset.img; next.alt = '';
    const ring = document.createElement('span'); ring.className = 'blab__ring';
    media.append(next, ring);
    const open = () => requestAnimationFrame(() => requestAnimationFrame(() => next.classList.add('is-open')));
    next.complete ? open() : next.addEventListener('load', open, { once: true });
    setTimeout(() => {
      img.src = t.dataset.img; img.alt = t.dataset.alt;
      next.remove(); ring.remove(); busy = false;
    }, 1050);
  };
  tabs.forEach(t => t.addEventListener('click', () => select(t)));
}

// Jersey: scelta del giocatore → targhetta e link alla variante dello store (taglia M)
const JERSEY_VARIANTS = {
  'APPA': 58171507671427, 'BANFOX': 58171507704195, 'BOBBY': 58171507736963, 'BONA': 58171507769731,
  'CARMINE': 58171507802499, 'CUNHA': 58171507868035, 'DEDE': 58171507900803, 'DEIV': 58171507933571,
  'DIDDY': 58171507966339, 'JOY BOY': 58171507999107, 'MILKO': 58171508031875, 'NIK': 58171508064643,
  'OLYMAK': 58171508097411, 'PADO': 58171508130179, 'PARDINI': 58171508162947, 'SUICA': 58171508195715,
  'XELLA': 58171508228483, 'CHARLIE': 58243261464963, 'LORD FLIPPER': 62705945215363, 'GOLIAH': 62705945248131,
  'DEHASTE': 62705945280899, 'KYTE': 62705945313667, 'CLOUDSTRIKEE': 62705945346435,
};
function initJersey() {
  const root = document.querySelector('[data-jersey]');
  if (!root) return;
  const picker = root.querySelector('[data-players-picker]');
  const plate = root.querySelector('[data-plate]');
  const link = root.querySelector('[data-jersey-link]');
  const nameEl = root.querySelector('[data-jersey-name]');
  const base = link.href.split('?')[0];
  picker.innerHTML = Object.keys(JERSEY_VARIANTS).map(n =>
    `<button type="button" role="radio" aria-checked="${n === 'CUNHA'}">${n}</button>`).join('');
  const choose = btn => {
    const n = btn.textContent;
    picker.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', b === btn));
    nameEl.textContent = n;
    link.href = `${base}?variant=${JERSEY_VARIANTS[n]}`;
    // la targhetta ruota su sé stessa e mostra il nuovo nome a metà giro
    plate.classList.remove('is-flip'); void plate.offsetWidth; plate.classList.add('is-flip');
    setTimeout(() => { plate.textContent = n; }, REDUCED ? 0 : 240);
  };
  picker.addEventListener('click', e => { const b = e.target.closest('button'); if (b) choose(b); });
  link.href = `${base}?variant=${JERSEY_VARIANTS.CUNHA}`;
}

/* ---------------------------------------------------------- */
// Avvio a tappe: la hero parte subito; le sezioni sotto vengono preparate quando il
// browser è libero, così il caricamento non si blocca tutto in un unico momento.
initTicker();
initHero();
initNav();
initScroll();
initCursor();
const idle = window.requestIdleCallback || (cb => setTimeout(cb, 200));
// le sezioni sotto si preparano a intro finita (o subito, se si inizia a scorrere prima)
let sectionsStarted = false;
const startSections = () => {
  if (sectionsStarted) return;
  sectionsStarted = true;
  removeEventListener('scroll', startSections);
  idle(prepareSections, { timeout: 600 });
};
addEventListener('scroll', startSections, { passive: true });
setTimeout(startSections, 3200);
function prepareSections() {
  initGini();
  initMarquees();
  initStops();
  initJersey();
  idle(() => {
    initSectionsFx();
    initReveal();
    initCounters();
    initHolo();
    initMagnetic();
  }, { timeout: 1500 });
}
