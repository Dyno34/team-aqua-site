/* ==========================================================
   Transizione "marea" tra le pagine
   Click su un link con [data-dive]: tre onde attraversano lo schermo
   e lo coprono, si naviga appena la copertura è completa, e nella
   nuova pagina l'acqua defluisce solo quando la pagina è pronta.

   Per mascherare il caricamento:
   - la pagina di destinazione (HTML, CSS, JS) viene precaricata
     appena il browser è libero, non al primo click;
   - all'arrivo la marea resta finché font e primo disegno sono pronti
     (con un tetto massimo, per non restare mai bloccati).
   ========================================================== */

import { REDUCED } from './common.js';

const KEY = 'aqua-dive';
const SWITCH_LEAD_MS = 90;    // il cursore dello switch parte un attimo prima dell'onda
const COVER_FALLBACK_MS = 1000; // se transitionend non arriva, si naviga comunque
const MIN_HOLD_MS = 140;      // pausa minima sott'acqua all'arrivo
const MAX_HOLD_MS = 1200;     // oltre questo tempo la pagina si rivela comunque
const LEAVE_MS = 1000;        // deflusso completo (CSS: .8s + ritardo massimo .2s)

/* risorse specifiche di ogni pagina, da scaldare in anticipo */
const PAGE_ASSETS = {
  'lol.html': ['lol.css', 'lol.js', 'assets/lol/lineup-group.webp'],
  'index.html': ['main.js', 'sections-fx.js', 'sections-fx.css', 'assets/vgc/players/pardo.webp', 'assets/vgc/players/fdp.webp', 'assets/vgc/players/ec.webp', 'assets/vgc/players/jk.webp'],
};

function buildTide() {
  let tide = document.querySelector('.tide');
  if (tide) return tide;
  tide = document.createElement('div');
  tide.className = 'tide';
  tide.dataset.dir = 'right';
  tide.setAttribute('aria-hidden', 'true');
  tide.innerHTML = `
    <div class="tide__layer tide__layer--1"></div>
    <div class="tide__layer tide__layer--2"></div>
    <div class="tide__layer tide__layer--3"></div>
    <div class="tide__center">
      <svg class="tide__logo"><use href="#trident"/></svg>
      <span class="tide__label" data-tide-label></span>
    </div>`;
  document.body.appendChild(tide);
  return tide;
}

const nextFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
const wait = ms => new Promise(r => setTimeout(r, ms));

async function reset(tide) {
  tide.className = 'tide is-instant';
  document.body.style.overflow = '';
  document.querySelectorAll('[data-switch]').forEach(s => s.classList.remove('is-flip'));
  await nextFrame();
  tide.classList.remove('is-instant');
}

// l'onda segue il cursore dello switch: verso destra andando su LoL, verso sinistra tornando al VGC
const dirFor = href => (/lol\.html/.test(href) ? 'right' : 'left');

/* ---------- precaricamento ---------- */
const warmed = new Set();
function warm(href) {
  const url = new URL(href, location.href);
  const page = url.pathname.split('/').pop() || 'index.html';
  const list = [url.href, ...(PAGE_ASSETS[page] || []).map(a => new URL(a, url).href)];
  for (const u of list) {
    if (warmed.has(u)) continue;
    warmed.add(u);
    const l = document.createElement('link');
    l.rel = 'prefetch'; l.href = u;
    document.head.appendChild(l);
  }
}

/* ---------- uscita: copre e naviga ---------- */
let diving = false;
async function dive(href, label) {
  if (REDUCED) { location.href = href; return; }
  if (diving) return;
  diving = true;
  warm(href);
  const tide = buildTide();
  const dir = dirFor(href);
  tide.querySelector('[data-tide-label]').textContent = label;
  // sceglie il lato di partenza senza animarlo
  tide.classList.add('is-instant');
  tide.dataset.dir = dir;
  tide.dataset.theme = dir === 'right' ? 'lol' : 'vgc';
  try { sessionStorage.setItem(KEY, JSON.stringify({ label, dir })); } catch { /* storage non disponibile: si naviga comunque */ }
  document.body.style.overflow = 'hidden';
  document.querySelectorAll('[data-switch]').forEach(s => s.classList.add('is-flip'));
  await nextFrame();
  tide.classList.remove('is-instant');
  await wait(SWITCH_LEAD_MS);

  // si naviga appena l'ultimo strato ha coperto lo schermo
  const top = tide.querySelector('.tide__layer--3');
  const covered = new Promise(r => {
    const done = e => { if (e.target === top && e.propertyName === 'transform') { top.removeEventListener('transitionend', done); r(); } };
    top.addEventListener('transitionend', done);
    setTimeout(r, COVER_FALLBACK_MS);
  });
  tide.classList.add('is-covered');
  await covered;
  location.href = href;
}

/* ---------- arrivo: aspetta che la pagina sia pronta ---------- */
function pageReady() {
  const fonts = document.fonts?.ready ?? Promise.resolve();
  const painted = new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const ready = Promise.all([fonts, painted, wait(MIN_HOLD_MS)]);
  return Promise.race([ready, wait(MAX_HOLD_MS)]);
}

/**
 * Restituisce true se la pagina è stata raggiunta con la transizione.
 * Quando l'acqua inizia a defluire viene emesso l'evento window "tide:reveal".
 */
export function initTide() {
  const tide = buildTide();
  let incoming = null;
  try { incoming = sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY); } catch { /* ignora */ }

  if (incoming && !REDUCED) {
    let info;
    try { info = JSON.parse(incoming); } catch { info = { label: incoming, dir: 'right' }; }
    tide.querySelector('[data-tide-label]').textContent = info.label;
    tide.dataset.dir = info.dir === 'left' ? 'left' : 'right';
    tide.dataset.theme = tide.dataset.dir === 'right' ? 'lol' : 'vgc';
    tide.classList.add('is-covered', 'is-instant');
    document.documentElement.classList.remove('is-arriving');
    // lo switch parte dalla divisione di provenienza e scivola in posizione mentre l'acqua esce
    const switches = document.querySelectorAll('[data-switch]');
    switches.forEach(s => s.classList.add('is-flip'));
    pageReady().then(async () => {
      tide.classList.remove('is-instant');
      await nextFrame();
      tide.classList.add('is-leaving');
      performance.mark?.('tide-reveal');
      dispatchEvent(new Event('tide:reveal'));
      setTimeout(() => switches.forEach(s => s.classList.remove('is-flip')), 300);
      setTimeout(() => reset(tide), LEAVE_MS);
    });
  } else {
    document.documentElement.classList.remove('is-arriving');
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-dive]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    dive(a.href, a.dataset.dive);
  });

  // tornando indietro con la cache del browser la pagina potrebbe essere ancora "sommersa"
  addEventListener('pageshow', e => { if (e.persisted) { diving = false; reset(tide); } });

  // precarica le destinazioni appena il browser è libero (e subito al passaggio del mouse)
  const links = [...document.querySelectorAll('a[data-dive]')];
  const idle = window.requestIdleCallback || (cb => setTimeout(cb, 1500));
  idle(() => links.forEach(a => warm(a.href)));
  links.forEach(a => {
    a.addEventListener('pointerenter', () => warm(a.href), { once: true });
    a.addEventListener('touchstart', () => warm(a.href), { once: true, passive: true });
  });

  return !!incoming;
}
