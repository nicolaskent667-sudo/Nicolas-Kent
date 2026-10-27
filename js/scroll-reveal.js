// ScrollReveal — los párrafos se revelan palabra por palabra mientras haces scroll
// Requiere gsap, SplitText y ScrollTrigger (cargados desde CDN antes de este archivo).
// Se aplica automáticamente a los párrafos de las secciones (ver SELECTOR) y a cualquier elemento con data-scroll-reveal.
// Para excluir un texto: data-no-reveal.

(function () {
  const SELECTOR = [
    'section p:not(.eyebrow):not(.label):not(.value):not(.book-title):not(.book-year):not(.photo-caption)',
    '.bio-text p',
    '.book-full h3',
    '.book-full .book-year',
    '.book-full p',
    '[data-scroll-reveal]'
  ].join(', ');

  // Estado inicial de cada palabra antes de revelarse
  const FROM = { opacity: 0.12, filter: 'blur(6px)', yPercent: 35 };
  const TO = { opacity: 1, filter: 'blur(0px)', yPercent: 0 };

  // Lee la letra capital (::first-letter) antes de dividir, porque deja de funcionar al separar en palabras
  const readInitial = (el) => {
    const style = window.getComputedStyle(el, '::first-letter');
    if (style.float !== 'left' && style.float !== 'right') return null;
    const keys = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'float', 'lineHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'color'];
    return Object.fromEntries(keys.map((key) => [key, style[key]]));
  };

  // Recrea la letra capital como un elemento real, delante de la primera palabra
  const buildInitial = (el, firstWord, style) => {
    const walker = document.createTreeWalker(firstWord, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && !node.textContent.trim()) node = walker.nextNode();
    if (!node) return null;
    const text = node.textContent.replace(/^\s+/, '');
    const letter = Array.from(text)[0];
    node.textContent = text.slice(letter.length);
    const initial = document.createElement('span');
    initial.className = 'scroll-reveal__initial';
    initial.setAttribute('aria-hidden', 'true');
    initial.textContent = letter;
    Object.assign(initial.style, style);
    el.insertBefore(initial, firstWord);
    // Restituye la letra para lectores de pantalla
    const sr = document.createElement('span');
    sr.className = 'scroll-reveal__sr';
    sr.textContent = letter;
    firstWord.prepend(sr);
    el.classList.add('scroll-reveal--initial');
    return initial;
  };

  function reveal(el) {
    const initialStyle = readInitial(el);
    const split = SplitText.create(el, { type: 'words', aria: 'none', wordsClass: 'scroll-reveal__word' });
    const words = split.words;
    if (!words.length) return;
    el.classList.add('scroll-reveal');
    if (initialStyle) {
      const initial = buildInitial(el, words[0], initialStyle);
      if (initial) words.unshift(initial);
    }

    // Si el texto ya está a la vista al cargar (p. ej. arriba de todo), se revela solo, sin esperar al scroll
    const alreadyVisible = el.getBoundingClientRect().top < window.innerHeight * 0.85;
    if (alreadyVisible) {
      gsap.fromTo(words, FROM, { ...TO, duration: 0.9, ease: 'power2.out', stagger: 0.025, delay: 0.2 });
      return;
    }

    gsap.fromTo(words, FROM, {
      ...TO,
      ease: 'none',
      stagger: 0.08,
      scrollTrigger: {
        trigger: el,
        start: 'top 90%',
        // El recorrido crece con el largo del párrafo, para leerlo a medida que aparece
        end: () => `+=${Math.max(window.innerHeight * 0.35, el.offsetHeight * 1.2)}`,
        scrub: 0.6
      }
    });
  }

  const init = () => {
    if (typeof gsap === 'undefined' || typeof SplitText === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.registerPlugin(SplitText, ScrollTrigger);
    document.querySelectorAll(SELECTOR).forEach((el) => {
      if (!el.hasAttribute('data-no-reveal') && el.textContent.trim()) reveal(el);
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    // Espera a las fuentes para que el corte en palabras y las posiciones sean correctos
    if (document.fonts && document.fonts.status !== 'loaded') {
      document.fonts.ready.then(init, init);
    } else {
      init();
    }
  });
})();
