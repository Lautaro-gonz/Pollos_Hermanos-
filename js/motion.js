// Animaciones: aparición al hacer scroll, navbar de cristal y parallax del hero.

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ---------------------------------------------------------------------------
   Reveal on scroll
   --------------------------------------------------------------------------- */

function finishReveal(el) {
  // Al terminar, se quita el atributo para que el elemento recupere sus propias
  // transiciones (p. ej. el hover de las tarjetas) sin el delay de entrada.
  el.removeAttribute('data-reveal');
  el.style.removeProperty('--reveal-delay');
}

const revealObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        observer.unobserve(el);
        el.classList.add('is-visible');
        if (reducedMotion.matches) {
          finishReveal(el);
        } else {
          const onEnd = (e) => {
            if (e.target !== el || e.propertyName !== 'opacity') return;
            el.removeEventListener('transitionend', onEnd);
            finishReveal(el);
          };
          el.addEventListener('transitionend', onEnd);
        }
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 })
  : null;

/**
 * Observa elementos con [data-reveal]. Se puede llamar con nodos creados
 * dinámicamente (p. ej. las tarjetas del catálogo).
 * @param {Iterable<Element>} elements
 * @param {{ stagger?: number }} [options] delay incremental entre elementos (ms)
 */
export function observeReveal(elements, { stagger = 0 } = {}) {
  let i = 0;
  for (const el of elements) {
    if (!el.hasAttribute('data-reveal')) el.setAttribute('data-reveal', '');
    if (stagger) el.style.setProperty('--reveal-delay', `${Math.min(i, 8) * stagger}ms`);
    i += 1;
    if (revealObserver) revealObserver.observe(el);
    else finishReveal(el);
  }
}

observeReveal(document.querySelectorAll('[data-reveal]'));

/* ---------------------------------------------------------------------------
   Navbar: estado "cristal" al hacer scroll
   --------------------------------------------------------------------------- */

const header = document.getElementById('site-header');

function updateHeader() {
  header.classList.toggle('is-scrolled', window.scrollY > 24);
}

/* ---------------------------------------------------------------------------
   Parallax del hero (se combina con el Ken Burns de CSS)
   --------------------------------------------------------------------------- */

const parallaxEls = [...document.querySelectorAll('[data-parallax]')];

function updateParallax() {
  if (reducedMotion.matches) return;
  const y = window.scrollY;
  for (const el of parallaxEls) {
    const limit = el.parentElement.offsetHeight;
    if (y > limit) continue; // fuera de vista: no gastar frames
    const speed = parseFloat(el.dataset.parallax) || 0.2;
    el.style.transform = `translate3d(0, ${(y * speed).toFixed(1)}px, 0)`;
  }
}

let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    updateHeader();
    updateParallax();
    ticking = false;
  });
}

window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll, { passive: true });
updateHeader();
updateParallax();
