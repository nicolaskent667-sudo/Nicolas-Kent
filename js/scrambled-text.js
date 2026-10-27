// ScrambledText — los títulos se "desordenan" al pasar el mouse (versión sin React del componente de React Bits)
// Inspirado en Tom Miller (comunidad GSAP): https://codepen.io/creativeocean/pen/NPWLwJM
// Requiere gsap, SplitText y ScrambleTextPlugin (cargados desde CDN antes de este archivo).
// Se aplica a todos los h1 y h2, y a cualquier elemento con data-scramble.
// Para excluir un título: data-no-scramble. Las opciones se pueden cambiar por título con data-*.

(function () {
  const SELECTOR = 'h1, h2, [data-scramble]';

  const DEFAULTS = {
    effect: 'scramble', // scramble | lift | blur | magnify
    radius: 100,
    strength: 1,
    trail: 0.6,
    duration: 1.2,
    speed: 0.5,
    scrambleChars: '.:',
    scrambleColor: '',
    clickBurst: true,
    intro: true
  };

  const PHYSICAL = { lift: true, blur: true, magnify: true };

  const falloff = (distance, radius) => {
    if (distance >= radius) return 0;
    const f = 1 - (distance / radius) ** 2;
    return f * f;
  };

  const num = (value, fallback) => {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const bool = (value, fallback) => (value === undefined ? fallback : value !== 'false');

  function readSettings(el) {
    const d = el.dataset;
    return {
      effect: d.effect || DEFAULTS.effect,
      radius: num(d.radius, DEFAULTS.radius),
      strength: num(d.strength, DEFAULTS.strength),
      trail: num(d.trail, DEFAULTS.trail),
      duration: num(d.duration, DEFAULTS.duration),
      speed: num(d.speed, DEFAULTS.speed),
      scrambleChars: d.scrambleChars || DEFAULTS.scrambleChars,
      scrambleColor: d.scrambleColor || DEFAULTS.scrambleColor,
      clickBurst: bool(d.clickBurst, DEFAULTS.clickBurst),
      intro: bool(d.intro, DEFAULTS.intro)
    };
  }

  function createScrambledText(root) {
    const s = readSettings(root);
    root.classList.add('scrambled-text');

    // aria: 'auto' deja el texto original como aria-label para lectores de pantalla
    const split = SplitText.create(root, { type: 'chars', smartWrap: true, aria: 'auto', charsClass: 'scrambled-text__char' });
    const chars = split.chars;
    const originals = chars.map((char) => char.textContent ?? '');
    const glyphs = chars.map((char, i) => {
      const sizer = document.createElement('span');
      const glyph = document.createElement('span');
      sizer.textContent = originals[i];
      sizer.style.visibility = 'hidden';
      glyph.textContent = originals[i];
      glyph.className = 'scrambled-text__glyph';
      char.replaceChildren(sizer, glyph);
      return glyph;
    });
    const points = chars.map(() => ({ x: 0, y: 0, energy: 0, dx: 0, dy: 0, shown: false }));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pointer = { x: 0, y: 0, sx: 0, sy: 0, inside: false };
    const waves = [];
    let measured = false;
    let fontPx = 16;
    let raf = 0;
    let last = 0;
    let moveFrame = 0;

    const scramble = (index, length, revealDelay = 0) => {
      const glyph = glyphs[index];
      return {
        overwrite: true,
        duration: length,
        ease: 'none',
        scrambleText: { text: originals[index], chars: s.scrambleChars, speed: s.speed, revealDelay },
        onUpdate: () => {
          glyph.style.color = s.scrambleColor && glyph.textContent !== originals[index] ? s.scrambleColor : '';
        }
      };
    };

    // Animación de entrada cuando el título aparece en pantalla
    if (s.intro && !reduce) {
      const timeline = gsap.timeline({ paused: true });
      glyphs.forEach((glyph, index) => {
        const reveal = 0.15 + s.duration * (0.75 * (index / glyphs.length) + 0.25 * Math.random());
        timeline.to(glyph, scramble(index, reveal + 0.1, reveal), 0);
      });
      timeline.time(0.001);
      const io = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          io.disconnect();
          timeline.play();
        },
        { rootMargin: '0px 0px -10% 0px' }
      );
      io.observe(root);
    }

    const offsetOf = (el) => {
      let x = 0;
      let y = 0;
      for (let node = el; node; node = node.offsetParent) {
        x += node.offsetLeft;
        y += node.offsetTop;
      }
      return [x, y];
    };

    const measure = () => {
      fontPx = parseFloat(window.getComputedStyle(root).fontSize) || 16;
      const [rootX, rootY] = offsetOf(root);
      chars.forEach((char, i) => {
        const [x, y] = offsetOf(char);
        points[i].x = x - rootX + char.offsetWidth / 2;
        points[i].y = y - rootY + char.offsetHeight / 2;
      });
      measured = true;
    };

    const toLocal = (e) => {
      const rect = root.getBoundingClientRect();
      const scaleX = root.offsetWidth ? rect.width / root.offsetWidth : 1;
      const scaleY = root.offsetHeight ? rect.height / root.offsetHeight : 1;
      return [(e.clientX - rect.left) / (scaleX || 1), (e.clientY - rect.top) / (scaleY || 1)];
    };

    const clear = (i) => {
      const char = chars[i];
      char.style.transform = '';
      char.style.filter = '';
      char.style.opacity = '';
      char.style.zIndex = '';
      points[i].shown = false;
    };

    const paint = (i, mode, amount) => {
      const p = points[i];
      const e = p.energy;
      if (e < 0.001) {
        if (p.shown) clear(i);
        return;
      }
      const char = chars[i];
      p.shown = true;
      if (mode === 'lift') {
        char.style.transform = `translate3d(0, ${(-e * fontPx * 0.75 * amount).toFixed(2)}px, 0)`;
      } else if (mode === 'blur') {
        char.style.filter = `blur(${(e * fontPx * 0.24 * amount).toFixed(2)}px)`;
        char.style.opacity = (1 - e * Math.min(0.7, 0.45 * amount)).toFixed(3);
        char.style.transform = `scale(${(1 + e * 0.15 * amount).toFixed(4)})`;
      } else {
        char.style.transform = `translate3d(${p.dx.toFixed(2)}px, ${p.dy.toFixed(2)}px, 0) scale(${(1 + e * 0.85 * amount).toFixed(4)})`;
        char.style.zIndex = `${Math.round(e * 10)}`;
      }
    };

    const tick = (now) => {
      raf = 0;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      if (!measured) measure();
      const mode = PHYSICAL[s.effect] && !reduce ? s.effect : '';
      const amount = Math.max(0, s.strength);
      const reach = Math.max(1, s.radius);
      const width = Math.max(fontPx * 1.3, 16);
      const swell = mode === 'magnify' ? 0.55 : 1;
      const follow = 1 - Math.exp(-dt / 0.06);
      const attack = 1 - Math.exp(-dt / 0.08);
      const release = 1 - Math.exp(-dt / Math.max(0.04, s.trail / 3));
      pointer.sx += (pointer.x - pointer.sx) * follow;
      pointer.sy += (pointer.y - pointer.sy) * follow;

      for (const wave of waves) {
        wave.age += dt;
        const t = Math.min(1, wave.age / wave.life);
        wave.r = wave.reach * (1 - (1 - t) * (1 - t));
        wave.fade = t < 0.75 ? 1 : 1 - ((t - 0.75) / 0.25) ** 2;
      }

      let busy = waves.length > 0 || Math.abs(pointer.x - pointer.sx) + Math.abs(pointer.y - pointer.sy) > 0.2;
      for (let i = 0; i < chars.length; i += 1) {
        const p = points[i];
        let target = 0;
        let tx = 0;
        let ty = 0;
        if (mode && pointer.inside) {
          const ax = p.x - pointer.sx;
          const ay = p.y - pointer.sy;
          target = falloff(Math.hypot(ax, ay), reach);
          tx = ax * 0.5 * amount * target;
          ty = ay * 0.5 * amount * target;
        }
        for (const wave of waves) {
          const ax = p.x - wave.x;
          const ay = p.y - wave.y;
          const d = Math.hypot(ax, ay);
          const strengthAt = 1 - (0.6 * d) / wave.reach;
          if (!wave.hit[i] && d <= wave.r) {
            wave.hit[i] = 1;
            gsap.to(glyphs[i], scramble(i, Math.max(0.2, s.duration * (0.2 + 0.5 * strengthAt))));
          }
          if (mode) {
            const band = swell * strengthAt * wave.fade * Math.exp(-(((d - wave.r) / width) ** 2));
            if (band > target) {
              const push = (fontPx * 0.6 * amount * band) / (d || 1);
              target = band;
              tx = ax * push;
              ty = ay * push;
            }
          }
        }
        const k = target > p.energy ? attack : release;
        p.energy += (target - p.energy) * k;
        if (Math.abs(target - p.energy) > 0.0005) busy = true;
        if (mode === 'magnify') {
          p.dx += (tx - p.dx) * k;
          p.dy += (ty - p.dy) * k;
        }
        if (!mode) {
          if (p.shown) clear(i);
          continue;
        }
        paint(i, mode, amount);
      }

      for (let j = waves.length - 1; j >= 0; j -= 1) {
        if (waves[j].age >= waves[j].life) waves.splice(j, 1);
      }

      if (busy) raf = requestAnimationFrame(tick);
      else last = 0;
    };

    const wake = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const scrambleNearPointer = () => {
      moveFrame = 0;
      if (!measured) measure();
      glyphs.forEach((glyph, index) => {
        const p = points[index];
        const dist = Math.hypot(pointer.x - p.x, pointer.y - p.y);
        if (dist < s.radius) gsap.to(glyph, scramble(index, s.duration * (1 - dist / s.radius)));
      });
    };

    root.addEventListener('pointerenter', () => {
      measured = false;
    });

    root.addEventListener('pointermove', (e) => {
      const [x, y] = toLocal(e);
      pointer.x = x;
      pointer.y = y;
      if (!pointer.inside) {
        pointer.sx = x;
        pointer.sy = y;
        pointer.inside = true;
      }
      if (PHYSICAL[s.effect]) {
        if (!reduce) wake();
      } else if (!moveFrame) moveFrame = requestAnimationFrame(scrambleNearPointer);
    });

    root.addEventListener('pointerleave', () => {
      pointer.inside = false;
      wake();
    });

    root.addEventListener('pointerdown', (e) => {
      if (!s.clickBurst || (e.pointerType === 'mouse' && e.button !== 0)) return;
      if (!measured) measure();
      const [x, y] = toLocal(e);
      let reach = 0;
      for (const p of points) reach = Math.max(reach, Math.hypot(p.x - x, p.y - y));
      reach += fontPx;
      if (waves.length > 3) waves.shift();
      waves.push({ x, y, age: 0, r: 0, fade: 1, reach, life: 0.45 + reach / 1100, hit: new Uint8Array(chars.length) });
      wake();
    });

    new ResizeObserver(() => {
      measured = false;
    }).observe(root);
  }

  const init = () => {
    if (typeof gsap === 'undefined' || typeof SplitText === 'undefined' || typeof ScrambleTextPlugin === 'undefined') return;
    gsap.registerPlugin(SplitText, ScrambleTextPlugin);
    document.querySelectorAll(SELECTOR).forEach((el) => {
      if (!el.hasAttribute('data-no-scramble')) createScrambledText(el);
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    // Espera a que carguen las fuentes (Syne) para medir bien cada letra
    if (document.fonts && document.fonts.status !== 'loaded') {
      document.fonts.ready.then(init, init);
    } else {
      init();
    }
  });
})();
