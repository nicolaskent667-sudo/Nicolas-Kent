// TextType — efecto de máquina de escribir (versión sin React del componente de React Bits)
// Uso: <blockquote data-text-type data-typing-speed="75">Texto a escribir</blockquote>
// Varias frases: data-text='["Frase uno", "Frase dos"]'. Si no, usa el texto del elemento.
// Requiere gsap (cargado desde CDN antes de este archivo) para el parpadeo y el deslizamiento del cursor.

(function () {
  const NEIGHBORS = {
    a: 'qwsz', b: 'vghn', c: 'xdfv', d: 'serfcx', e: 'wsdr', f: 'drtgvc', g: 'ftyhbv', h: 'gyujnb',
    i: 'ujko', j: 'huikmn', k: 'jiolm', l: 'kop', m: 'njk', n: 'bhjm', o: 'iklp', p: 'ol', q: 'wa',
    r: 'edft', s: 'awedxz', t: 'rfgy', u: 'yhji', v: 'cfgb', w: 'qase', x: 'zsdc', y: 'tghu', z: 'asx',
    0: '9p', 1: '2q', 2: '13w', 3: '24e', 4: '35r', 5: '46t', 6: '57y', 7: '68u', 8: '79i', 9: '80o'
  };

  const EFFECTS = {
    fade: {
      keyframes: [{ opacity: 0 }, { opacity: 1 }],
      options: { duration: 360, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' }
    },
    blur: {
      keyframes: [
        { opacity: 0, filter: 'blur(0.3em)' },
        { opacity: 1, filter: 'blur(0em)' }
      ],
      options: { duration: 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    },
    rise: {
      keyframes: [
        { opacity: 0, top: '0.6em' },
        { opacity: 1, top: '0em' }
      ],
      options: { duration: 480, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)' }
    }
  };

  const graphemes = (value) => {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value), (part) => part.segment);
    }
    return Array.from(value);
  };

  const typoFor = (char) => {
    const keys = NEIGHBORS[char.toLowerCase()];
    if (!keys) return null;
    const pick = keys[Math.floor(Math.random() * keys.length)];
    return char === char.toLowerCase() ? pick : pick.toUpperCase();
  };

  const num = (value, fallback) => {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const bool = (value, fallback) => (value === undefined ? fallback : value !== 'false');

  const readTexts = (host) => {
    if (host.dataset.text) {
      try {
        const parsed = JSON.parse(host.dataset.text);
        if (Array.isArray(parsed) && parsed.length) return parsed.map(String);
      } catch {
        return [host.dataset.text];
      }
    }
    return [host.textContent.replace(/\s+/g, ' ').trim()];
  };

  function createTextType(host) {
    const d = host.dataset;
    const texts = readTexts(host);
    const o = {
      typingSpeed: num(d.typingSpeed, 50),
      initialDelay: num(d.initialDelay, 0),
      pauseDuration: num(d.pauseDuration, 2000),
      deletingSpeed: num(d.deletingSpeed, 30),
      deleteMode: d.deleteMode || 'backspace', // backspace | select
      loop: bool(d.loop, true),
      showCursor: bool(d.showCursor, true),
      hideCursorWhileTyping: bool(d.hideCursorWhileTyping, false),
      cursorStyle: d.cursorStyle || 'character', // character | bar | block | underscore
      cursorCharacter: d.cursorCharacter || '|',
      cursorColor: d.cursorColor || 'currentColor',
      cursorBlinkDuration: num(d.cursorBlinkDuration, 0.5),
      cursorGlide: bool(d.cursorGlide, true),
      typeEffect: d.typeEffect || 'none', // none | fade | blur | rise
      mistakes: num(d.mistakes, 0),
      prefix: d.prefix || '',
      prefixColor: d.prefixColor || 'currentColor',
      textColors: d.textColors ? d.textColors.split(',').map((c) => c.trim()) : [],
      minSpeed: num(d.minSpeed, NaN),
      maxSpeed: num(d.maxSpeed, NaN),
      startOnVisible: bool(d.startOnVisible, false),
      reverseMode: bool(d.reverseMode, false),
      // Reserva el espacio de la frase completa para que la página no "salte" mientras escribe
      reserveSpace: bool(d.reserveSpace, true)
    };
    const minSpeed = Number.isFinite(o.minSpeed) ? o.minSpeed : o.typingSpeed;
    const maxSpeed = Number.isFinite(o.maxSpeed) ? o.maxSpeed : o.typingSpeed;
    const glideTime = Math.min(0.18, Math.max(0.06, ((minSpeed + maxSpeed) / 2) * 0.0016));
    const hasGsap = typeof gsap !== 'undefined';
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduceMotion = mq.matches;

    // Estructura del DOM
    const root = document.createElement('span');
    root.className = 'text-type';
    const sr = document.createElement('span');
    sr.className = 'text-type__sr';
    sr.textContent = o.prefix + texts.join(' ');
    const content = document.createElement('span');
    content.className = 'text-type__content';
    content.setAttribute('aria-hidden', 'true');
    root.append(sr, content);

    let cursor = null;
    let blink = null;
    if (o.showCursor) {
      cursor = document.createElement('span');
      cursor.setAttribute('aria-hidden', 'true');
      cursor.className = `text-type__cursor text-type__cursor--${o.cursorStyle}`;
      if (o.cursorColor !== 'currentColor') cursor.style.color = o.cursorColor;
      blink = document.createElement('span');
      blink.className = 'text-type__blink';
      if (o.cursorStyle === 'character') blink.textContent = o.cursorCharacter;
      else blink.innerHTML = '<span class="text-type__shape"></span>';
      cursor.appendChild(blink);
      root.appendChild(cursor);
    }
    host.replaceChildren(root);

    // Estado
    const state = { index: 0, count: 0, selected: 0, typo: null, deleting: false };
    let lastTypo = -1;
    let prevShown = 0;
    let caretEl = null;
    let caretPosition = null;
    let blinkTimeline = null;
    let blinkResume = null;
    let timer = 0;

    const charsOf = () => graphemes(texts[state.index % texts.length]);

    const startBlink = () => {
      if (!blink || !hasGsap) return;
      blinkTimeline?.kill();
      gsap.set(blink, { opacity: 1 });
      if (reduceMotion || o.cursorBlinkDuration <= 0) return;
      const hold = o.cursorBlinkDuration * 0.7;
      const fade = o.cursorBlinkDuration * 0.45;
      blinkTimeline = gsap.timeline({ repeat: -1 });
      blinkTimeline
        .to(blink, { opacity: 0, duration: fade, ease: 'sine.inOut' }, hold)
        .to(blink, { opacity: 1, duration: fade, ease: 'sine.inOut' }, hold + fade + o.cursorBlinkDuration * 0.4);
    };

    const placeCursor = (instant) => {
      if (!caretEl || !cursor) return;
      const x = caretEl.offsetLeft;
      const y = caretEl.offsetTop;
      const last = caretPosition;
      if (last && Math.abs(last.x - x) < 0.5 && Math.abs(last.y - y) < 0.5) return;
      caretPosition = { x, y };

      if (!hasGsap) {
        cursor.style.transform = `translate(${x}px, ${y}px)`;
        return;
      }
      if (instant || !last || !o.cursorGlide || reduceMotion || Math.abs(last.y - y) > 1) {
        gsap.killTweensOf(cursor);
        gsap.set(cursor, { x, y });
      } else {
        gsap.to(cursor, { x, y, duration: glideTime, ease: 'power3.out', overwrite: true });
      }

      if (instant || !blinkTimeline || !blink) return;
      blinkTimeline.pause();
      blinkResume?.kill();
      gsap.to(blink, { opacity: 1, duration: 0.12, ease: 'power1.out' });
      blinkResume = gsap.delayedCall(0.12, () => blinkTimeline.restart());
    };

    const charSpan = (char, className) => {
      const span = document.createElement('span');
      span.className = className;
      span.textContent = char;
      return span;
    };

    const render = () => {
      const chars = charsOf();
      const total = chars.length;
      const shown = Math.min(state.count, total);
      const start = o.reverseMode ? total - shown : 0;
      const marked = Math.min(state.selected, shown);
      const effect = EFFECTS[o.typeEffect];

      const correct = chars.slice(start, start + shown).map((char, i) => {
        const isMarked = o.reverseMode ? i < marked : i >= shown - marked;
        return charSpan(char, isMarked ? 'text-type__char text-type__char--selected' : 'text-type__char');
      });
      const mistyped = (state.typo?.tail ?? []).map((char) => charSpan(char, 'text-type__char'));
      if (o.reverseMode) mistyped.reverse();

      caretEl = document.createElement('span');
      caretEl.className = 'text-type__caret';
      caretEl.textContent = '​';

      const textSpan = document.createElement('span');
      if (o.textColors.length) textSpan.style.color = o.textColors[state.index % o.textColors.length];

      const nodes = [];
      if (o.prefix) {
        const prefix = document.createElement('span');
        prefix.className = 'text-type__prefix';
        prefix.style.color = o.prefixColor;
        prefix.textContent = o.prefix;
        nodes.push(prefix);
      }
      if (o.reverseMode) {
        nodes.push(caretEl);
        textSpan.append(...mistyped, ...correct);
        nodes.push(textSpan);
      } else {
        textSpan.append(...correct, ...mistyped, caretEl);
        // Letras que faltan: invisibles, solo ocupan su lugar
        if (o.reserveSpace) {
          chars.slice(shown).forEach((char) => textSpan.appendChild(charSpan(char, 'text-type__char text-type__char--pending')));
        }
        nodes.push(textSpan);
      }
      content.replaceChildren(...nodes);

      // Anima solo las letras recién escritas
      if (effect && !reduceMotion) {
        const fresh = state.deleting ? [] : [...correct.slice(o.reverseMode ? 0 : prevShown, o.reverseMode ? shown - prevShown : undefined), ...mistyped];
        fresh.forEach((node) => node.animate?.(effect.keyframes, effect.options));
      }
      prevShown = shown;

      if (cursor) {
        const typing = shown < total || state.deleting || state.typo !== null;
        cursor.classList.toggle('text-type__cursor--hidden', o.hideCursorWhileTyping && typing);
      }
      placeCursor(false);
    };

    const wait = (ms, next) => {
      timer = setTimeout(() => {
        next();
        render();
        step();
      }, ms);
    };

    const speed = () => minSpeed + Math.random() * (maxSpeed - minSpeed);

    const step = () => {
      const chars = charsOf();
      const total = chars.length;
      const shown = Math.min(state.count, total);
      const index = state.index % texts.length;
      const typo = state.typo;

      if (!state.deleting) {
        if (typo) {
          if (reduceMotion) {
            wait(0, () => (state.typo = null));
          } else if (!typo.fixing) {
            if (typo.tail.length < typo.plan.length) {
              wait(speed(), () => (state.typo = { ...typo, tail: typo.plan.slice(0, typo.tail.length + 1) }));
            } else {
              wait(260 + Math.random() * 320, () => (state.typo = { ...typo, fixing: true }));
            }
          } else if (typo.tail.length) {
            wait(Math.max(45, o.deletingSpeed), () => (state.typo = { ...typo, tail: typo.tail.slice(0, -1) }));
          } else {
            wait(90 + Math.random() * 140, () => (state.typo = null));
          }
        } else if (shown < total) {
          const lead = shown === 0 ? o.initialDelay : 0;
          const next = o.reverseMode ? total - shown - 1 : shown;
          const wrong = o.mistakes > 0 && shown > 0 && lastTypo !== next ? typoFor(chars[next]) : null;

          if (reduceMotion) {
            wait(lead, () => (state.count = total));
          } else if (wrong && Math.random() < Math.min(1, o.mistakes) * 0.16) {
            lastTypo = next;
            const plan = [wrong];
            const follow = chars[o.reverseMode ? next - 1 : next + 1];
            if (follow && follow.trim() && Math.random() < 0.4) plan.push(follow);
            wait(lead + speed(), () => (state.typo = { plan, tail: [wrong], fixing: false }));
          } else {
            wait(lead + speed(), () => (state.count = shown + 1));
          }
        } else if (o.loop || index < texts.length - 1) {
          wait(o.pauseDuration, () => (state.deleting = true));
        }
      } else if (shown > 0) {
        if (reduceMotion) {
          wait(0, () => (state.count = 0));
        } else if (o.deleteMode === 'select') {
          if (state.selected < shown) {
            wait(o.deletingSpeed, () => (state.selected += 1));
          } else {
            wait(Math.max(160, o.deletingSpeed * 8), () => {
              state.selected = 0;
              state.count = 0;
            });
          }
        } else {
          wait(o.deletingSpeed, () => (state.count = shown - 1));
        }
      } else {
        wait(0, () => {
          lastTypo = -1;
          state.selected = 0;
          state.deleting = false;
          state.index = (index + 1) % texts.length;
        });
      }
    };

    mq.addEventListener('change', () => {
      reduceMotion = mq.matches;
      startBlink();
    });

    new ResizeObserver(() => placeCursor(true)).observe(root);

    startBlink();
    render();

    const begin = () => step();
    if (o.startOnVisible) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          observer.disconnect();
          begin();
        },
        { threshold: 0.1 }
      );
      observer.observe(root);
    } else {
      begin();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-text-type]').forEach(createTextType);
  });
})();
