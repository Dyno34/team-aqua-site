/* Utility e micro-interazioni condivise tra le pagine */

export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const FINE_POINTER = matchMedia('(pointer: fine)').matches;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/* Nav: vetro allo scroll + menu mobile */
export function initNav() {
  const nav = document.querySelector('[data-nav]');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const burger = nav.querySelector('[data-burger]');
  const close = () => { nav.classList.remove('is-open'); burger?.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; };
  burger?.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });
  nav.querySelectorAll('.nav__links a').forEach(a => a.addEventListener('click', close));
}

/* Comparsa degli elementi allo scroll */
export function initReveal() {
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    io.unobserve(e.target);
  }), { threshold: .15, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('[data-reveal]').forEach(el => {
    // già superato (es. scroll veloce prima dell'avvio): si mostra subito
    if (el.getBoundingClientRect().bottom < 0) { el.classList.add('is-in'); return; }
    if (!el.style.getPropertyValue('--d')) {
      const sib = [...el.parentElement.children].filter(c => c.hasAttribute('data-reveal'));
      el.style.setProperty('--d', `${sib.indexOf(el) * .08}s`);
    }
    io.observe(el);
  });
}

/* Contatori animati */
export function initCounters() {
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    const el = e.target, to = +el.dataset.count, from = +(el.dataset.from || 0), suf = el.dataset.suffix || '', pre = el.dataset.prefix || '';
    if (REDUCED) { el.textContent = pre + to + suf; return; }
    const t0 = performance.now(), dur = 1800;
    const tick = t => {
      const k = clamp((t - t0) / dur), ease = 1 - (1 - k) ** 4;
      el.textContent = pre + Math.round(lerp(from, to, ease)) + suf;
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), { threshold: .6 });
  document.querySelectorAll('[data-count]').forEach(el => io.observe(el));
}

/* Card olografiche che seguono il mouse */
export function initHolo() {
  if (!FINE_POINTER || REDUCED) return;
  const reset = h => { h.classList.remove('is-tilting'); h.style.setProperty('--rx', '0deg'); h.style.setProperty('--ry', '0deg'); };
  document.addEventListener('pointermove', e => {
    const el = e.target.closest?.('[data-holo]');
    document.querySelectorAll('[data-holo].is-tilting').forEach(h => { if (h !== el) reset(h); });
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    el.classList.add('is-tilting');
    el.style.setProperty('--rx', `${(.5 - py) * 14}deg`);
    el.style.setProperty('--ry', `${(px - .5) * 18}deg`);
    el.style.setProperty('--mx', `${px * 100}%`);
    el.style.setProperty('--my', `${py * 100}%`);
  });
}

/* Cursore ad anello */
export function initCursor() {
  if (!FINE_POINTER || REDUCED) return;
  const c = document.querySelector('.cursor');
  if (!c) return;
  let x = -100, y = -100, cx = -100, cy = -100;
  addEventListener('pointermove', e => {
    x = e.clientX; y = e.clientY;
    c.classList.toggle('is-hover', !!e.target.closest?.('a, button, [data-holo]'));
  });
  const tick = () => {
    cx = lerp(cx, x, .2); cy = lerp(cy, y, .2);
    c.style.setProperty('--x', `${cx}px`); c.style.setProperty('--y', `${cy}px`);
    requestAnimationFrame(tick);
  };
  tick();
}

/* Bottoni magnetici */
export function initMagnetic() {
  if (!FINE_POINTER || REDUCED) return;
  document.querySelectorAll('[data-magnetic]').forEach(b => {
    b.addEventListener('pointermove', e => {
      const r = b.getBoundingClientRect();
      b.style.setProperty('--mx', `${(e.clientX - r.left - r.width / 2) * .25}px`);
      b.style.setProperty('--my', `${(e.clientY - r.top - r.height / 2) * .35}px`);
    });
    b.addEventListener('pointerleave', () => { b.style.setProperty('--mx', '0px'); b.style.setProperty('--my', '0px'); });
  });
}
