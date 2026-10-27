// RefineFrame — revela una imagen pasando de pixelada a nítida (versión sin React del componente de React Bits)
// Uso: <div data-refine-frame data-aspect-ratio="3 / 4"><img src="..." alt="..." /></div>
// Por defecto recorre solo los estados queued → generating → refining → complete
// cuando la imagen carga y entra en pantalla. Si la imagen falla, muestra "Reintentar".

(function () {
  const STAGES = {
    queued: { blur: 4, sat: 0.6, scale: 1.04, opacity: 0.55 },
    generating: { blur: 1.5, sat: 0.8, scale: 1.02, opacity: 0.85 },
    refining: { blur: 0.5, sat: 0.95, scale: 1.005, opacity: 1 },
    complete: { blur: 0, sat: 1, scale: 1, opacity: 1 },
    error: { blur: 2, sat: 0.5, scale: 1, opacity: 0.28 }
  };
  const TARGET = { queued: 0, generating: 0.5, refining: 0.875, complete: 1 };
  const NEXT = { generating: 'refining', refining: 'complete' };
  const LEVELS = [48, 32, 20, 12, 8, 5, 3, 2, 1];
  const EDGE = 28;
  const STRIPS = 14;
  const DEFAULT_LABELS = {
    queued: 'Cargando',
    generating: 'Revelando',
    refining: 'Refinando',
    complete: 'Lista',
    error: 'Error al cargar'
  };
  const ACTIVE = new Set(['queued', 'generating', 'refining']);

  const ICONS = {
    spin: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9"/></svg>',
    complete: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    error: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 2.8 19.5h18.4L12 4z"/><path d="M12 10v4.5M12 17.2v.1"/></svg>',
    retry: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>'
  };

  const num = (value, fallback) => {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const bool = (value, fallback) => (value === undefined ? fallback : value !== 'false');

  const build = (s, canvas, img, dpr) => {
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(1, Math.round(rect.width * dpr));
    const H = Math.max(1, Math.round(rect.height * dpr));
    const key = `${img.currentSrc}|${W}x${H}`;
    if (s.key === key) return;
    s.key = key;
    s.w = W;
    s.h = H;
    canvas.width = W;
    canvas.height = H;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const cover = Math.max(W / iw, H / ih);
    const sw = W / cover;
    const sh = H / cover;
    const sx = (iw - sw) / 2;
    const sy = (ih - sh) / 2;
    const glint = canvas.getContext('2d')?.createLinearGradient(0, 0, W, 0) ?? null;
    if (glint) {
      for (const [at, a] of [
        [0, 0], [0.08, 0.1], [0.2, 0.7], [0.32, 1], [0.68, 1], [0.8, 0.7], [0.92, 0.1], [1, 0]
      ]) {
        glint.addColorStop(at, `rgba(255, 255, 255, ${a})`);
      }
    }
    s.glint = glint;
    s.levels = LEVELS.map((block) => {
      const b = block === 1 ? 1 : Math.max(2, Math.round(block * dpr));
      const full = document.createElement('canvas');
      full.width = W;
      full.height = H;
      const fc = full.getContext('2d');
      if (!fc) return full;
      if (b === 1) {
        fc.imageSmoothingEnabled = true;
        fc.imageSmoothingQuality = 'high';
        fc.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
        return full;
      }
      const small = document.createElement('canvas');
      small.width = Math.max(1, Math.round(W / b));
      small.height = Math.max(1, Math.round(H / b));
      const sc = small.getContext('2d');
      if (sc) {
        sc.imageSmoothingEnabled = true;
        sc.imageSmoothingQuality = 'high';
        sc.drawImage(img, sx, sy, sw, sh, 0, 0, small.width, small.height);
      }
      fc.imageSmoothingEnabled = false;
      fc.drawImage(small, 0, 0, W, H);
      return full;
    });
  };

  function createRefineFrame(root) {
    const img = root.querySelector('img');
    if (!img) return;

    const d = root.dataset;
    const o = {
      aspectRatio: d.aspectRatio || '4 / 3',
      width: num(d.width, 320),
      radius: num(d.radius, 16),
      background: d.background || '#27272a',
      color: d.color || '#f5f5f5',
      stageDuration: num(d.stageDuration, 400),
      sweep: bool(d.sweep, true),
      showStatus: bool(d.showStatus, true),
      hideAfter: num(d.hideAfter, 1200),
      queuedFor: num(d.queuedFor, 600),
      retryLabel: d.retryLabel || 'Reintentar'
    };
    const alt = img.alt;

    // Estructura del DOM
    root.classList.add('refine-frame');
    root.setAttribute('role', 'img');
    if (alt) root.setAttribute('aria-label', alt);
    root.style.setProperty('--rf-w', `${o.width}px`);
    root.style.setProperty('--rf-aspect', o.aspectRatio);
    root.style.setProperty('--rf-radius', `${o.radius}px`);
    root.style.setProperty('--rf-bg', o.background);
    root.style.setProperty('--rf-ink', o.color);
    root.style.setProperty('--rf-stage', `${o.stageDuration}ms`);

    const media = document.createElement('div');
    media.className = 'refine-frame__media';
    media.setAttribute('aria-hidden', 'true');
    const print = document.createElement('div');
    print.className = 'refine-frame__print';
    const canvas = document.createElement('canvas');
    canvas.className = 'refine-frame__mosaic';
    img.replaceWith(media);
    print.appendChild(img);
    media.append(print, canvas);

    const sweepEl = document.createElement('div');
    sweepEl.className = 'refine-frame__sweep';
    sweepEl.setAttribute('aria-hidden', 'true');
    const sr = document.createElement('span');
    sr.className = 'refine-frame__sr';
    sr.setAttribute('role', 'status');
    root.append(sweepEl, sr);

    let chip = null;
    let retryBtn = null;
    let chipTimer = 0;
    let status = 'queued';
    let mosaic = false;
    let resolved = false;
    let started = false;
    let advancing = false;

    const sim = { p: 0, raf: 0, last: 0, key: '', w: 0, h: 0, levels: [], glint: null };
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduce = mq.matches;
    mq.addEventListener('change', () => {
      reduce = mq.matches;
    });

    const syncAttrs = () => {
      const stage = STAGES[status] ?? STAGES.generating;
      const active = ACTIVE.has(status);
      root.dataset.status = status;
      root.toggleAttribute('data-active', active);
      root.toggleAttribute('data-sweep', o.sweep && active);
      root.toggleAttribute('data-mosaic', mosaic);
      root.toggleAttribute('data-resolved', mosaic && resolved);
      root.setAttribute('aria-busy', String(active));
      root.style.setProperty('--rf-blur', `${mosaic ? 0 : stage.blur}px`);
      root.style.setProperty('--rf-sat', stage.sat);
      root.style.setProperty('--rf-scale', mosaic ? 1 : stage.scale);
      root.style.setProperty('--rf-opacity', stage.opacity);
    };

    const renderChip = () => {
      clearTimeout(chipTimer);
      if (!o.showStatus) return;
      if (!chip) {
        chip = document.createElement('div');
        chip.className = 'refine-frame__chip';
        chip.setAttribute('aria-hidden', 'true');
        root.appendChild(chip);
      }
      const active = ACTIVE.has(status);
      const kind = active ? 'spin' : status;
      chip.innerHTML =
        `<span class="refine-frame__mark" data-kind="${kind}">${ICONS[kind] || ICONS.spin}</span>` +
        `<span class="refine-frame__label">${DEFAULT_LABELS[status] ?? status}</span>`;
      if (status === 'complete' && o.hideAfter > 0) {
        chipTimer = setTimeout(() => {
          chip?.remove();
          chip = null;
        }, o.hideAfter);
      }
    };

    const renderRetry = () => {
      if (status === 'error' && !retryBtn) {
        retryBtn = document.createElement('button');
        retryBtn.type = 'button';
        retryBtn.className = 'refine-frame__retry';
        retryBtn.innerHTML = `${ICONS.retry}<span>${o.retryLabel}</span>`;
        retryBtn.addEventListener('click', retry);
        root.appendChild(retryBtn);
      } else if (status !== 'error' && retryBtn) {
        retryBtn.remove();
        retryBtn = null;
      }
    };

    const setStatus = (next) => {
      if (next === status && started) return;
      status = next;
      sr.textContent = DEFAULT_LABELS[status] ?? status;
      syncAttrs();
      renderChip();
      renderRetry();
      wake();
    };

    const tick = (now) => {
      const s = sim;
      if (!img.naturalWidth) {
        s.raf = 0;
        return;
      }
      const dt = Math.min(0.05, s.last ? (now - s.last) / 1000 : 0.016);
      s.last = now;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      build(s, canvas, img, dpr);
      const n = s.levels.length - 1;
      const target = TARGET[status] ?? s.p;
      const rate = reduce ? 1e9 : 1 / (n * (o.stageDuration / 1000));
      const step = rate * dt;
      if (target < s.p) s.p = target;
      else if (target - s.p <= step) s.p = target;
      else s.p += step;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const L = s.p * n;
        const i = Math.min(n, Math.floor(L + 1e-6));
        const frac = L - i;
        ctx.globalAlpha = 1;
        ctx.drawImage(s.levels[i], 0, 0);
        if (i < n && frac > 0) {
          const edge = EDGE * dpr;
          const front = frac * (s.h + edge) - edge / 2;
          const top = Math.max(0, Math.floor(front - edge / 2));
          if (top > 0) ctx.drawImage(s.levels[i + 1], 0, 0, s.w, top, 0, 0, s.w, top);
          const sh = edge / STRIPS;
          for (let k = 0; k < STRIPS; k += 1) {
            const y = front - edge / 2 + k * sh;
            if (y + sh <= 0 || y >= s.h) continue;
            const t = 1 - (k + 0.5) / STRIPS;
            ctx.globalAlpha = t * t * (3 - 2 * t);
            const y0 = Math.max(0, y);
            const h0 = Math.min(s.h, y + sh) - y0;
            if (h0 > 0) ctx.drawImage(s.levels[i + 1], 0, y0, s.w, h0, 0, y0, s.w, h0);
          }
          ctx.globalAlpha = 1;
          if (o.sweep && !reduce && s.glint && front > 0 && front < s.h) {
            ctx.fillStyle = s.glint;
            ctx.globalAlpha = 0.12;
            ctx.fillRect(0, front - 2 * dpr, s.w, 4 * dpr);
            ctx.globalAlpha = 0.3;
            ctx.fillRect(0, front - dpr, s.w, 2 * dpr);
            ctx.globalAlpha = 1;
          }
        }
      }
      const done = s.p >= 1;
      if (done !== resolved) {
        resolved = done;
        syncAttrs();
      }
      // Avanza solo al siguiente estado cuando termina el actual
      if (NEXT[status] && !advancing && Math.abs(target - s.p) <= 0.0005) {
        advancing = true;
        const next = NEXT[status];
        setTimeout(() => {
          advancing = false;
          setStatus(next);
        }, 150);
      }
      const keep = (!reduce && ACTIVE.has(status)) || Math.abs(target - s.p) > 0.0005;
      s.raf = keep ? requestAnimationFrame(tick) : 0;
      if (!keep) s.last = 0;
    };

    function wake() {
      if (!sim.raf) sim.raf = requestAnimationFrame(tick);
    }

    const begin = () => {
      mosaic = true;
      syncAttrs();
      wake();
      // Espera a que la foto esté en pantalla para hacer la revelación
      const io = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          io.disconnect();
          setTimeout(() => setStatus('generating'), reduce ? 0 : o.queuedFor);
        },
        { threshold: 0.25 }
      );
      io.observe(root);
    };

    const onLoad = () => {
      if (img.naturalWidth) begin();
    };

    const onError = () => {
      mosaic = false;
      sim.p = 0;
      setStatus('error');
    };

    function retry() {
      sim.p = 0;
      sim.key = '';
      resolved = false;
      setStatus('queued');
      const src = img.getAttribute('src').split('?')[0];
      img.src = `${src}?retry=${Date.now()}`;
    }

    img.addEventListener('load', onLoad);
    img.addEventListener('error', onError);

    setStatus('queued');
    started = true;
    if (img.complete) {
      if (img.naturalWidth) begin();
      else onError();
    }

    new ResizeObserver(() => wake()).observe(root);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-refine-frame]').forEach(createRefineFrame);
  });
})();
