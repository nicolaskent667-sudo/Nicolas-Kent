// DriftWall — muro 3D de fotos en movimiento (versión sin React del componente de React Bits)
// Uso: <div class="news-gallery" data-drift-wall data-columns="5" ...> <img ...> <img ...> </div>
// Toma las <img> del contenedor como fotos; al hacer clic abre el visor (lightbox) de main.js.

(function () {
  const columnFactor = (index, variance) => {
    const pseudo = ((index * 0.6180339887 + 0.35) % 1) * 2 - 1;
    return 1 + variance * pseudo;
  };

  const num = (value, fallback) => {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const bool = (value, fallback) => (value === undefined ? fallback : value !== 'false');

  function createDriftWall(root) {
    const items = Array.from(root.querySelectorAll('img')).map((img, index) => ({
      image: img.getAttribute('src'),
      title: img.alt,
      index
    }));
    if (!items.length) return;

    const d = root.dataset;
    const o = {
      columns: Math.max(1, Math.round(num(d.columns, 5))),
      tileWidth: num(d.tileWidth, 200),
      tileHeight: num(d.tileHeight, 132),
      gap: num(d.gap, 18),
      radius: num(d.radius, 14),
      tilt: num(d.tilt, 16),
      turn: num(d.turn, -14),
      roll: num(d.roll, 0),
      perspective: num(d.perspective, 1200),
      depth: num(d.depth, 120),
      speed: num(d.speed, 42),
      direction: d.direction || 'up',
      variance: num(d.variance, 0.45),
      parallax: num(d.parallax, 0.6),
      pauseOnHover: bool(d.pauseOnHover, false),
      lift: num(d.lift, 64),
      fade: num(d.fade, 0.6),
      dim: num(d.dim, 0.55),
      grayscale: bool(d.grayscale, false),
      overlayColor: d.overlayColor || '#060010'
    };

    const lightboxImages = items.map((item) => ({ src: item.image, alt: item.title }));

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = mq.matches;

    root.classList.add('drift-wall');
    root.classList.toggle('drift-wall--reduced', reduced);
    root.setAttribute('role', 'group');
    if (!root.hasAttribute('aria-label')) root.setAttribute('aria-label', 'Galería de fotos');
    const vars = {
      '--dw-tile-w': `${o.tileWidth}px`,
      '--dw-tile-h': `${o.tileHeight}px`,
      '--dw-gap': `${o.gap}px`,
      '--dw-radius': `${o.radius}px`,
      '--dw-perspective': `${o.perspective}px`,
      '--dw-lift': `${o.lift}px`,
      '--dw-dim': o.dim,
      '--dw-gray': o.grayscale ? 1 : 0,
      '--dw-overlay': o.overlayColor,
      '--dw-edge': `${Math.max(0, (1 - o.fade) * 100)}%`
    };
    Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));

    root.innerHTML = '';
    const plane = document.createElement('div');
    plane.className = 'drift-wall__plane';
    root.appendChild(plane);

    // Reparte las fotos por columnas
    const columnItems = Array.from({ length: o.columns }, () => []);
    items.forEach((item, i) => columnItems[i % o.columns].push(item));
    for (let c = 0; c < columnItems.length; c++) {
      if (!columnItems[c].length) columnItems[c] = items.slice(0, 1);
    }

    const unit = o.tileHeight + o.gap;
    const dirSign = o.direction === 'up' ? 1 : -1;
    const baseVelocities = columnItems.map((_, c) => {
      const altSign = c % 2 === 0 ? 1 : -1;
      return o.speed * columnFactor(c, o.variance) * dirSign * altSign;
    });

    let meta = [];
    let tracks = [];
    let activeTile = null;
    let hoveredCol = -1;
    let wallHovered = false;
    const pointer = { x: 0, y: 0 };
    const pointerDamped = { x: 0, y: 0 };

    const computeMeta = (height) =>
      columnItems.map((col) => {
        const copyHeight = Math.max(unit, col.length * unit);
        const copies = Math.max(2, Math.ceil((height * 1.6) / copyHeight) + 1);
        return { copyHeight, copies };
      });

    const setActive = (tile) => {
      if (activeTile === tile) return;
      if (activeTile) activeTile.classList.remove('is-active');
      activeTile = tile;
      if (tile) tile.classList.add('is-active');
      hoveredCol = tile ? Number(tile.dataset.col) : -1;
    };

    const renderTile = (item, id, colIndex, primary) => {
      const tile = document.createElement('div');
      tile.className = 'drift-wall__tile';
      tile.dataset.tileId = id;
      tile.dataset.col = colIndex;
      tile.dataset.index = item.index;
      if (primary) {
        // Solo la primera copia de cada foto es navegable con teclado
        tile.tabIndex = 0;
        tile.setAttribute('role', 'button');
        tile.setAttribute('aria-label', `Ver foto ${item.index + 1}: ${item.title || ''}`.trim());
      } else {
        tile.setAttribute('aria-hidden', 'true');
      }
      const inner = document.createElement('span');
      inner.className = 'drift-wall__inner';
      const img = document.createElement('img');
      img.src = item.image;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.draggable = false;
      const overlay = document.createElement('span');
      overlay.className = 'drift-wall__overlay';
      overlay.setAttribute('aria-hidden', 'true');
      inner.append(img, overlay);
      tile.appendChild(inner);
      return tile;
    };

    const build = () => {
      setActive(null);
      plane.innerHTML = '';
      tracks = columnItems.map((col, c) => {
        const colEl = document.createElement('div');
        colEl.className = 'drift-wall__col';
        const track = document.createElement('div');
        track.className = 'drift-wall__track';
        for (let copy = 0; copy < meta[c].copies; copy++) {
          col.forEach((item, i) => track.appendChild(renderTile(item, `${c}-${copy}-${i}`, c, copy === 0)));
        }
        colEl.appendChild(track);
        plane.appendChild(colEl);
        return track;
      });
    };

    meta = computeMeta(root.clientHeight || 600);
    const offsets = meta.map((m, c) => m.copyHeight * ((c * 0.37) % 1));
    const velocities = columnItems.map(() => 0);
    build();

    const applyPlaneTransform = (px, py) => {
      plane.style.transform =
        `translate(-50%, -50%) scale(1.18) ` +
        `rotateX(${o.tilt + py}deg) rotateY(${o.turn + px}deg) rotateZ(${o.roll}deg) ` +
        `translateZ(${-o.depth}px)`;
    };

    // Animación
    let raf = 0;
    let lastTs = null;

    const animate = (ts) => {
      if (lastTs === null) lastTs = ts;
      const dt = Math.min(0.05, Math.max(0, ts - lastTs) / 1000);
      lastTs = ts;

      const maxTilt = o.parallax * 8;
      const damp = 1 - Math.exp(-dt / 0.12);
      pointerDamped.x += (pointer.x * maxTilt - pointerDamped.x) * damp;
      pointerDamped.y += (-pointer.y * maxTilt - pointerDamped.y) * damp;
      applyPlaneTransform(pointerDamped.x, pointerDamped.y);

      for (let c = 0; c < tracks.length; c++) {
        const m = meta[c];
        if (!reduced) {
          const paused = wallHovered && o.pauseOnHover;
          const target = paused || hoveredCol === c ? 0 : baseVelocities[c];
          const ease = 1 - Math.exp(-dt / (target === 0 ? 0.16 : 0.28));
          velocities[c] += (target - velocities[c]) * ease;
          const next = offsets[c] + velocities[c] * dt;
          offsets[c] = ((next % m.copyHeight) + m.copyHeight) % m.copyHeight;
        }
        tracks[c].style.transform = `translate3d(0, ${-offsets[c]}px, 0)`;
      }

      raf = requestAnimationFrame(animate);
    };

    const start = () => {
      if (raf) return;
      lastTs = null;
      raf = requestAnimationFrame(animate);
    };

    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    // Solo anima cuando el muro está visible en pantalla
    new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) start();
      else stop();
    }).observe(root);

    new ResizeObserver(([entry]) => {
      const next = computeMeta(entry.contentRect.height || 600);
      if (next.some((m, c) => m.copies !== meta[c].copies)) {
        meta = next;
        build();
      }
    }).observe(root);

    mq.addEventListener('change', (e) => {
      reduced = e.matches;
      root.classList.toggle('drift-wall--reduced', reduced);
    });

    // Interacción
    root.addEventListener('pointermove', (e) => {
      const rect = root.getBoundingClientRect();
      if (o.parallax > 0 && !reduced) {
        pointer.x = (e.clientX - rect.left) / rect.width - 0.5;
        pointer.y = (e.clientY - rect.top) / rect.height - 0.5;
      }
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const tile = hit && hit.closest ? hit.closest('[data-tile-id]') : null;
      if (tile && root.contains(tile)) setActive(tile);
    });

    root.addEventListener('pointerenter', () => {
      wallHovered = true;
    });

    root.addEventListener('pointerleave', () => {
      wallHovered = false;
      pointer.x = 0;
      pointer.y = 0;
      setActive(null);
    });

    root.addEventListener('focusin', (e) => {
      const tile = e.target.closest('[data-tile-id]');
      if (tile) setActive(tile);
    });

    root.addEventListener('focusout', () => setActive(null));

    const openTile = (tile) => {
      if (typeof window.openLightbox === 'function') {
        window.openLightbox(lightboxImages, Number(tile.dataset.index), tile);
      }
    };

    root.addEventListener('click', (e) => {
      const tile = e.target.closest('[data-tile-id]');
      if (tile) openTile(tile);
    });

    root.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const tile = e.target.closest('[data-tile-id]');
      if (!tile) return;
      e.preventDefault();
      openTile(tile);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-drift-wall]').forEach(createDriftWall);
  });
})();
