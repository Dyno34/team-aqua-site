/* ==========================================================
   Team Aqua ASD — effetti delle sezioni sotto la hero
   - atmosfera sottomarina (neve marina, raggi di luce)
   - titoli che emergono parola per parola
   - immagini rivelate da un'onda che sale
   - TARL: edizioni in orizzontale fissate allo scroll
   - Streaming: la TV si accende, reazioni live
   - Sponsor: nastri che reagiscono alla velocità di scroll
   - Dal vivo: tipografia cinetica
   - Battle Cruise: zoom e rotta che si disegna
   - VCL: coriandoli dorati
   - Shop: maglia in 3D
   ========================================================== */

import { REDUCED, FINE_POINTER, clamp, lerp } from './common.js';


/* Un solo ascoltatore di scroll per tutti gli effetti legati alla posizione */
const onScrollFns = [];
let scrollQueued = false;
const runScroll = () => { scrollQueued = false; onScrollFns.forEach(f => f()); };
addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(runScroll); } }, { passive: true });
addEventListener('resize', () => requestAnimationFrame(runScroll));

/* 0 quando l'elemento entra dal basso, 1 quando esce in alto */
const progress = el => {
  const r = el.getBoundingClientRect();
  return clamp((innerHeight - r.top) / (innerHeight + r.height));
};
const inView = el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };

/* ---------------------------------------------------------- */
/* Atmosfera: neve marina e raggi di luce                      */
/* ---------------------------------------------------------- */
function initAmbient() {
  const c = document.querySelector('[data-ambient]');
  if (!c) return;
  const ctx = c.getContext('2d');
  const hero = document.querySelector('[data-hero]');
  let W = 0, H = 0, lastY = scrollY, lastDraw = 0, heroCovers = true;
  const ps = [];
  const make = anywhere => ({
    x: Math.random() * W,
    y: anywhere ? Math.random() * H : (Math.random() < .5 ? -10 : H + 10),
    r: .5 + Math.random() * 1.9,
    z: .25 + Math.random() * .9,          // profondità: quanto si muove con lo scroll
    v: .05 + Math.random() * .22,
    a: .1 + Math.random() * .38,
    w: Math.random() * Math.PI * 2,
    bubble: Math.random() < .1,
  });
  const resize = () => {
    W = c.width = innerWidth; H = c.height = innerHeight;
    ps.length = 0;
    const n = innerWidth < 720 ? 28 : 60;
    for (let i = 0; i < n; i++) ps.push(make(true));
  };
  if (hero) new IntersectionObserver(([e]) => { heroCovers = e.intersectionRatio > .75; }, { threshold: [0, .75, 1] }).observe(hero);

  const frame = ms => {
    requestAnimationFrame(frame);
    if (ms - lastDraw < 32) return; // ~30 fps bastano per particelle lente
    lastDraw = ms;
    const dy = scrollY - lastY; lastY = scrollY;
    ctx.clearRect(0, 0, W, H);
    if (heroCovers) return;
    for (const p of ps) {
      if (!REDUCED) {
        p.y += p.bubble ? -p.v * 4 : p.v;
        p.y -= dy * p.z * .4;
        p.x += Math.sin(ms * .0005 + p.w) * .18;
        if (p.y > H + 12) Object.assign(p, make(false), { y: -10 });
        if (p.y < -12) Object.assign(p, make(false), { y: H + 10 });
      }
      if (p.bubble) {
        ctx.strokeStyle = `rgba(200, 240, 255, ${p.a})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.2, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(190, 235, 255, ${p.a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
    }
  };
  resize();
  addEventListener('resize', resize);
  // parte dopo l'intro della hero, per non sovrapporsi al suo momento più pesante
  setTimeout(() => requestAnimationFrame(frame), 2500);

  // i raggi di luce si affievoliscono scendendo
  const root = document.documentElement, rays = document.querySelector('.fx-rays');
  let lastRays = -1;
  onScrollFns.push(() => {
    if (!rays) return;
    const p = scrollY / Math.max(1, root.scrollHeight - innerHeight);
    const o = Math.round(clamp(.75 - p * 1.3, 0, .75) * 100) / 100;
    if (o !== lastRays) { lastRays = o; rays.style.opacity = o; }
  });
}

/* ---------------------------------------------------------- */
/* Titoli che emergono parola per parola                       */
/* ---------------------------------------------------------- */
function splitWords(el) {
  let i = 0;
  const walk = node => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'w';
          const inner = document.createElement('span'); inner.className = 'w__i';
          inner.style.setProperty('--i', i++);
          inner.textContent = part;
          w.appendChild(inner); frag.appendChild(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === Node.ELEMENT_NODE && n.tagName !== 'BR') {
        walk(n);
      }
    });
  };
  walk(el);
  el.classList.add('split');
}

function initSplitHeadings() {
  const sel = ['.tarl__title', '.tarl__sub', '.tarl__quote p', '#streaming .display', '.blab__title',
    '.cruise__title', '.talk__title', '.shop__title', '#magazine .display', '#campioni .display', '#roster .display'];
  const els = document.querySelectorAll(sel.join(','));
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    io.unobserve(e.target);
  }), { threshold: .35 });
  els.forEach(el => {
    el.removeAttribute('data-reveal');
    splitWords(el);
    if (REDUCED || el.getBoundingClientRect().bottom < 0) el.classList.add('is-in'); else io.observe(el);
  });
}

/* ---------------------------------------------------------- */
/* Immagini rivelate da un'onda che sale                       */
/* ---------------------------------------------------------- */
function initWaveReveal() {
  const els = document.querySelectorAll('.tarl__ph, .stream__screen, .blab__media, .talk__media, .post__img, .vcl2__banner, .edition__img, .cruise');
  // Un elemento con clip-path completamente chiuso non risulta mai "visibile" all'IntersectionObserver:
  // si osserva un segnaposto invisibile sovrapposto, che non viene ritagliato.
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target._waveOf;
    io.unobserve(e.target);
    e.target.remove();
    el.classList.add('is-wet');
    // a rivelazione finita si toglie il ritaglio: l'immagine torna un elemento normale, leggero da scorrere
    setTimeout(() => el.classList.remove('fx-wave', 'is-wet'), 1700);
  }), { threshold: .25 });
  els.forEach(el => {
    if (el.classList.contains('stream__screen')) return; // la TV ha la sua accensione
    el.removeAttribute('data-reveal');
    el.classList.add('fx-wave');
    if (REDUCED || el.getBoundingClientRect().bottom < 0) { el.classList.remove('fx-wave'); return; }
    const probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:absolute;pointer-events:none;visibility:hidden;';
    probe._waveOf = el;
    const place = () => {
      const r = el.getBoundingClientRect(), pr = el.offsetParent?.getBoundingClientRect();
      if (!pr) return;
      probe.style.left = `${r.left - pr.left}px`; probe.style.top = `${r.top - pr.top}px`;
      probe.style.width = `${r.width}px`; probe.style.height = `${r.height}px`;
    };
    el.offsetParent?.appendChild(probe);
    place();
    io.observe(probe);
  });
}

/* ---------------------------------------------------------- */
/* Streaming: accensione della TV e reazioni live              */
/* ---------------------------------------------------------- */
function initStream() {
  const player = document.querySelector('[data-stream]');
  if (!player) return;
  const screen = player.querySelector('.stream__screen');
  const box = player.querySelector('[data-reactions]');
  const emojis = ['💧', '🔥', '👏', '⚡', '💙', '🏆', '😮', '🌊'];
  let timer = 0;

  if (!REDUCED) screen.classList.add('tv-off');
  const spawn = () => {
    if (box.childElementCount > 14) return;
    const r = document.createElement('span');
    r.className = 'reaction';
    r.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    r.style.setProperty('--x', `${10 + Math.random() * 50}px`);
    r.style.setProperty('--dx1', `${(Math.random() - .5) * 30}px`);
    r.style.setProperty('--dx2', `${(Math.random() - .5) * 70}px`);
    r.style.setProperty('--s', `${20 + Math.random() * 14}px`);
    r.style.setProperty('--t', `${2.4 + Math.random() * 1.4}s`);
    r.addEventListener('animationend', () => r.remove());
    box.appendChild(r);
  };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && e.intersectionRatio > .35) {
      if (screen.classList.contains('tv-off')) screen.classList.replace('tv-off', 'tv-on');
      if (!REDUCED && !timer) timer = setInterval(spawn, 620);
    } else if (!e.isIntersecting && timer) { clearInterval(timer); timer = 0; }
  }, { threshold: [0, .35] }).observe(player);

  if (FINE_POINTER && !REDUCED) {
    player.addEventListener('pointermove', e => {
      const r = player.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      player.style.setProperty('--ry', `${x * 10}deg`);
      player.style.setProperty('--rx', `${-y * 8}deg`);
    });
    player.addEventListener('pointerleave', () => { player.style.removeProperty('--ry'); player.style.removeProperty('--rx'); });
  }
}

/* ---------------------------------------------------------- */
/* Sponsor: velocità e inclinazione dei nastri seguono lo scroll */
/* ---------------------------------------------------------- */
function initVelocity() {
  if (REDUCED) return;
  document.querySelectorAll('[data-velocity]').forEach(s => {
    let lastY = scrollY, v = 0, raf = 0, visible = false, lastSkew = 0, lastRate = 1;
    const lists = [...s.querySelectorAll('.smarquee__list')];
    const animList = [...s.querySelectorAll('.smarquee__track')].flatMap(t => t.getAnimations());
    const loop = () => {
      raf = 0;
      const dy = scrollY - lastY; lastY = scrollY;
      v = lerp(v, dy, .12);
      const skew = Math.round(clamp(-v * .3, -10, 10) * 10) / 10;
      if (skew !== lastSkew) { lastSkew = skew; lists.forEach(l => { l.style.transform = `skewX(${skew}deg)`; }); }
      const rate = Math.round((1 + Math.min(Math.abs(v) * .15, 5)) * 10) / 10;
      if (rate !== lastRate) { lastRate = rate; animList.forEach(a => { a.playbackRate = rate; }); }
      if (visible || Math.abs(v) > .05) raf = requestAnimationFrame(loop);
    };
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting; lastY = scrollY;
      if (visible && !raf) raf = requestAnimationFrame(loop);
    }).observe(s);
  });
}

/* ---------------------------------------------------------- */
/* Dal vivo: righe giganti che scorrono in direzioni opposte   */
/* ---------------------------------------------------------- */
function initKinetic() {
  const k = document.querySelector('[data-kinetic-lines]');
  if (!k || REDUCED) return;
  const lines = [...k.querySelectorAll('.kinetic__line')];
  const update = () => {
    if (!inView(k)) return;
    const p = progress(k);
    lines.forEach(l => {
      const t = +l.dataset.dir > 0 ? p : 1 - p;
      l.style.transform = `translate3d(${((-.45 + t * .4) * innerWidth).toFixed(1)}px, 0, 0)`;
    });
  };
  onScrollFns.push(update);
  update();
}

/* ---------------------------------------------------------- */
/* Battle Cruise: la rotta si disegna e la nave naviga da sola */
/* ---------------------------------------------------------- */
function initCruise() {
  const cruise = document.querySelector('[data-cruise]');
  if (!cruise) return;
  const route = cruise.querySelector('[data-route]');
  const path = route.querySelector('[data-route-path]');
  const ship = route.querySelector('[data-route-ship]');
  const ports = [...route.querySelectorAll('[data-port]')];
  const len = path.getTotalLength();
  ports.forEach(p => {
    const pt = path.getPointAtLength(len * +p.dataset.port);
    p.style.setProperty('--px', `${(pt.x / 440) * 100}%`);
    p.style.setProperty('--py', `${(pt.y / 130) * 100}%`);
  });

  // la nave: posizione, inclinazione lungo la rotta e un leggero dondolio
  const place = (q, bob = 0) => {
    const d = len * q;
    const a = path.getPointAtLength(d);
    // la direzione si misura su un tratto che resta dentro la rotta anche agli estremi
    const p0 = path.getPointAtLength(Math.max(0, Math.min(d, len - 2)));
    const p1 = path.getPointAtLength(Math.max(2, Math.min(d + 2, len)));
    const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI;
    ship.setAttribute('transform', `translate(${a.x.toFixed(1)} ${(a.y + bob).toFixed(1)}) rotate(${(ang + 180 + bob * 2).toFixed(1)}) scale(-1 1)`);
    ports.forEach(p => p.classList.toggle('is-reached', q >= +p.dataset.port - .01));
  };
  if (REDUCED) { place(1); route.classList.add('is-drawn'); return; }

  // viaggio: 9 s da Genova a Barcellona, sosta, si riparte
  const TRAVEL = 9000, STOP = 1400;
  let t0 = 0, raf = 0, visible = false, lastDraw = 0;
  const ease = x => x < .5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
  const loop = ms => {
    raf = 0;
    if (!visible) return;
    if (ms - lastDraw >= 32) { // 30 fps bastano per una nave lenta
      lastDraw = ms;
      if (!t0) t0 = ms;
      const cycle = (ms - t0) % (TRAVEL + STOP);
      const q = ease(Math.min(1, cycle / TRAVEL));
      place(q, Math.sin(ms / 420) * 1.6);
      ship.style.opacity = cycle > TRAVEL + STOP - 300 ? 0 : 1;
    }
    raf = requestAnimationFrame(loop);
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) { route.classList.add('is-drawn'); if (!raf) raf = requestAnimationFrame(loop); }
  }, { threshold: .3 }).observe(route);
  place(0);
}

/* ---------------------------------------------------------- */
/* VCL: coriandoli quando appaiono i trofei                    */
/* ---------------------------------------------------------- */
function initConfetti() {
  const canvas = document.querySelector('[data-confetti]');
  const trophy = document.querySelector('.trophy--main');
  if (!canvas || !trophy || REDUCED) return;
  const ctx = canvas.getContext('2d');
  const colors = ['#FFD666', '#FFF3C4', '#E0A526', '#5FE3FF', '#0D78F2', '#FFFFFF'];
  const burst = () => {
    const sec = canvas.parentElement.getBoundingClientRect();
    const t = trophy.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = sec.width * dpr; canvas.height = sec.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ox = t.left - sec.left + t.width / 2, oy = t.top - sec.top + t.height * .3;
    const parts = Array.from({ length: 160 }, () => {
      const a = -Math.PI / 2 + (Math.random() - .5) * 2.4, v = 6 + Math.random() * 10;
      return { x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: 4 + Math.random() * 6, h: 6 + Math.random() * 10,
        r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: colors[Math.floor(Math.random() * colors.length)], life: 1 };
    });
    const t0 = performance.now();
    const step = now => {
      ctx.clearRect(0, 0, sec.width, sec.height);
      let alive = 0;
      for (const p of parts) {
        p.vy += .28; p.vx *= .985; p.vy *= .985;
        p.x += p.vx; p.y += p.vy; p.r += p.vr;
        p.life = 1 - (now - t0) / 3200;
        if (p.life <= 0) continue;
        alive++;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.globalAlpha = Math.min(1, p.life * 1.5);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2 * Math.abs(Math.cos(p.r * 2)), p.w, p.h * Math.abs(Math.cos(p.r * 2)));
        ctx.restore();
      }
      if (alive) requestAnimationFrame(step); else ctx.clearRect(0, 0, sec.width, sec.height);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    setTimeout(burst, 500);
  }, { threshold: .6 });
  io.observe(trophy);
}

/* ---------------------------------------------------------- */
/* Shop: la maglia si inclina seguendo il mouse                */
/* ---------------------------------------------------------- */
function initTilt() {
  if (!FINE_POINTER || REDUCED) return;
  document.querySelectorAll('[data-tilt]').forEach(stage => {
    stage.addEventListener('pointermove', e => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      stage.classList.add('is-tilting');
      stage.style.setProperty('--ry', `${(x - .5) * 22}deg`);
      stage.style.setProperty('--rx', `${(.5 - y) * 16}deg`);
      stage.style.setProperty('--mx', `${x * 100}%`);
      stage.style.setProperty('--my', `${y * 100}%`);
    });
    stage.addEventListener('pointerleave', () => {
      stage.classList.remove('is-tilting');
      stage.style.setProperty('--ry', '0deg'); stage.style.setProperty('--rx', '0deg');
    });
  });
}

/* ---------------------------------------------------------- */
/* Le animazioni CSS infinite girano solo nelle sezioni visibili */
function initOffscreenPause() {
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    e.target.classList.toggle('is-offscreen', !e.isIntersecting);
  }), { rootMargin: '200px 0px' });
  document.querySelectorAll('main > section, main > .smarquee, .footer').forEach(s => {
    if (!s.matches('.hero')) io.observe(s);
  });
}

/* ---------------------------------------------------------- */
export function initSectionsFx() {
  initOffscreenPause();
  initAmbient();
  initSplitHeadings();
  initWaveReveal();
  initStream();
  initVelocity();
  initKinetic();
  initCruise();
  initConfetti();
  initTilt();
  runScroll();
}
