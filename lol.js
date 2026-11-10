/* ==========================================================
   Team Aqua ASD — pagina League of Legends (stile locandina)
   - Hero: titolo a contorno che si disegna, foto di gruppo,
     pattern che si accende sotto il cursore, parallasse e
     scintille magenta (click = esplosione di scintille)
   - Timeline che si riempie scorrendo
   - Roster da dati Leaguepedia
   ========================================================== */

import { REDUCED, FINE_POINTER, clamp, lerp, initNav, initReveal, initCounters, initHolo, initCursor, initMagnetic } from './common.js';
import { initTide } from './transition.js';

const ARRIVING = initTide();

/* ---------------------------------------------------------- */
/* Hero: cursore, parallasse, scintille                        */
/* ---------------------------------------------------------- */
function initHero(hero) {
  const canvas = hero.querySelector('[data-sparks]');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, visible = true, rafId = 0;
  const target = { x: .5, y: .45 }, cur = { x: .5, y: .45 };
  const embers = [], bursts = [];

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    embers.length = 0;
    const n = W < 720 ? 34 : 70;
    for (let i = 0; i < n; i++) embers.push(newEmber(true));
  }
  function newEmber(anywhere) {
    return {
      x: Math.random() * W, y: anywhere ? Math.random() * H : H + 10,
      r: .6 + Math.random() * 1.8, v: .2 + Math.random() * .6,
      w: Math.random() * Math.PI * 2, hue: Math.random() < .7 ? 'pink' : 'violet',
    };
  }
  function burst(x, y) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 5;
      bursts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, life: 1, r: 1 + Math.random() * 2 });
    }
  }

  function frame(ms) {
    // cursore morbido → variabili CSS per spotlight e parallasse
    const nx = lerp(cur.x, target.x, .08), ny = lerp(cur.y, target.y, .08);
    // aggiorna le variabili CSS solo se il cursore si è mosso davvero
    if (Math.abs(nx - cur.x) > .0004 || Math.abs(ny - cur.y) > .0004) {
      cur.x = nx; cur.y = ny;
      hero.style.setProperty('--mx', `${(cur.x * 100).toFixed(1)}%`);
      hero.style.setProperty('--my', `${(cur.y * 100).toFixed(1)}%`);
      hero.style.setProperty('--px', ((cur.x - .5) * 2).toFixed(3));
      hero.style.setProperty('--py', ((cur.y - .5) * 2).toFixed(3));
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const e of embers) {
      if (!REDUCED) {
        e.y -= e.v; e.x += Math.sin(ms * .001 + e.w) * .35;
        if (e.y < -10) Object.assign(e, newEmber(false));
      }
      const a = .35 + Math.sin(ms * .003 + e.w) * .25;
      ctx.fillStyle = e.hue === 'pink' ? `rgba(255, 98, 170, ${a})` : `rgba(163, 91, 219, ${a})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const s = bursts[i];
      s.vy += .12; s.vx *= .97; s.x += s.vx; s.y += s.vy; s.life -= .022;
      if (s.life <= 0) { bursts.splice(i, 1); continue; }
      ctx.strokeStyle = `rgba(255, ${150 + Math.round(s.life * 80)}, 210, ${s.life})`;
      ctx.lineWidth = s.r;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 3, s.y - s.vy * 3); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  let lastDraw = 0;
  function loop(ms) {
    rafId = 0;
    if (!visible) return;
    if (ms - lastDraw >= 15.5) { lastDraw = ms; frame(ms); } // ~60 fps anche su schermi a 120 Hz
    if (!REDUCED) rafId = requestAnimationFrame(loop);
  }
  const start = () => { if (!rafId) rafId = requestAnimationFrame(loop); };

  if (FINE_POINTER) {
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      target.x = (e.clientX - r.left) / r.width; target.y = (e.clientY - r.top) / r.height;
      hero.classList.add('is-tracking');
    });
    hero.addEventListener('pointerleave', () => { target.x = .5; target.y = .45; });
  }
  hero.addEventListener('pointerdown', e => {
    if (e.target.closest('a, button')) return;
    const r = hero.getBoundingClientRect();
    burst(e.clientX - r.left, e.clientY - r.top);
    if (REDUCED) frame(performance.now());
  });

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(hero);
  let t;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(resize, 120); });
  resize();
  start();
}

/* ---------------------------------------------------------- */
/* Roster (dati Leaguepedia, novembre 2026)                    */
/* ---------------------------------------------------------- */
const ROSTER = [
  { role: 'top', lane: 'Top', ign: 'ImTheTitan', name: 'Vincenzo Puleo', tag: 'già LordFlipper' },
  { role: 'jungle', lane: 'Jungle', ign: 'Goliah', name: 'Ilias Amrani', tag: 'Ex Los Goccioles' },
  { role: 'mid', lane: 'Mid', ign: 'Dehaste', name: 'Sven Vidović', tag: 'Ex Los Goccioles' },
  { role: 'bot', lane: 'Bot', ign: 'Kyte', name: 'Luca Angelo Amorotti', tag: 'Ex Los Goccioles' },
  { role: 'support', lane: 'Support', ign: 'CloudStrikee', name: 'Michele Andonaia', tag: 'Ex Los Goccioles' },
];

function initRoster() {
  const root = document.querySelector('[data-lroster]');
  root.innerHTML = ROSTER.map((p, i) => `
    <article data-reveal style="--d:${i * .08}s">
      <div class="xp holo" data-holo>
        <span class="xp__num" aria-hidden="true">0${i + 1}</span>
        <svg class="xp__role" aria-hidden="true"><use href="#role-${p.role}"/></svg>
        <span class="xp__lane">${p.lane}</span>
        <h3 class="xp__ign">${p.ign}</h3>
        <p class="xp__name">${p.name}</p>
        <span class="xp__tag">${p.tag}</span>
        <div class="holo__shine"></div>
      </div>
    </article>`).join('');
}

/* ---------------------------------------------------------- */
/* Timeline che si riempie scorrendo                           */
/* ---------------------------------------------------------- */
function initTimeline() {
  const tl = document.querySelector('[data-timeline]');
  let ticking = false;
  const update = () => {
    ticking = false;
    const r = tl.getBoundingClientRect();
    tl.style.setProperty('--fill', clamp((innerHeight * .65 - r.top) / r.height).toFixed(3));
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

function initTicker() {
  const track = document.querySelector('[data-ticker]');
  const clone = track.firstElementChild.cloneNode(true);
  clone.setAttribute('aria-hidden', 'true');
  track.appendChild(clone);
}

/* ---------------------------------------------------------- */
initRoster();
initTicker();
initNav();
initHero(document.querySelector('[data-xhero]'));
initTimeline();
initReveal();
initCounters();
initHolo();
initCursor();
initMagnetic();

const fontsReady = document.fonts?.ready ?? Promise.resolve();
const revealed = ARRIVING ? new Promise(r => addEventListener('tide:reveal', () => setTimeout(r, 120), { once: true })) : Promise.resolve();
Promise.all([fontsReady, revealed]).then(() => document.body.classList.add('is-ready'));
