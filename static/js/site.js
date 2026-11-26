(() => {
  'use strict';

  const MEDIA = './static/media';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };

  function onVisible(target, cb, options = { threshold: 0.2 }) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { cb(entry.target); io.unobserve(entry.target); }
      });
    }, options);
    io.observe(target);
  }

  function watchVisibility(target, cb) {
    new IntersectionObserver(([entry]) => cb(entry.isIntersecting)).observe(target);
  }

  /* ---------------- Nav ---------------- */
  const nav = $('#nav');
  const updateNav = () => nav.classList.toggle('is-scrolled', window.scrollY > 40);
  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav();

  /* ---------------- Reveal on scroll ---------------- */
  document.querySelectorAll('.section-head, .frame-grid, .facts, .explorer, #privacy > *').forEach((node) => {
    node.classList.add('in-view');
    onVisible(node, (n) => n.classList.add('is-visible'), { threshold: 0.12 });
  });

  /* ---------------- Landing wall ---------------- */
  const WALL_IDS = ['0000065', '0000086', '0000108', '0000276', '0000170', '0000055', '0000078', '0000115',
    '0000183', '0000270', '0000284', '0000285', '0000088', '0000058', '0000173', '0000196',
    '0000172', '0000206', '0000227', '0000303', '0000490', '0000066', '0000158', '0000169'];
  const WALL_LAYERS = ['rgb', 'matte', 'growth', 'depth'];

  function buildWall() {
    const wall = $('#wall');
    const vw = window.innerWidth, vh = window.innerHeight;
    const tile = Math.round(clamp(vw / 7.5, 130, 230));
    const gap = 10;
    wall.style.setProperty('--tile', `${tile}px`);
    const cols = Math.ceil((vw * 1.4) / (tile + gap)) + 1;
    const rows = Math.ceil((vh * 1.6) / (tile + gap)) + 1;

    let k = Math.floor(Math.random() * WALL_IDS.length);
    const tiles = [];
    for (let c = 0; c < cols; c++) {
      const col = el('div', 'wall-col');
      const inner = el('div', 'wall-col-inner');
      inner.style.setProperty('--dur', `${70 + ((c * 37) % 50)}s`);
      inner.style.setProperty('--dir', c % 2 ? 'reverse' : 'normal');
      if (c % 2) col.style.marginTop = `${-tile / 2}px`;
      const ids = [];
      for (let r = 0; r < rows; r++) { ids.push(WALL_IDS[k % WALL_IDS.length]); k += 5; }
      // Duplicate the column so translateY(-50%) loops seamlessly.
      [...ids, ...ids].forEach((id, i) => {
        const t = el('div', 'tile');
        const start = (c + i) % 7 === 0 ? 1 + ((c + i) % 3) : 0;
        WALL_LAYERS.forEach((layer, li) => {
          const img = new Image();
          img.alt = '';
          img.decoding = 'async';
          img.src = `${MEDIA}/wall/${id}_${layer}.webp`;
          if (li === start) img.classList.add('is-cur');
          t.appendChild(img);
        });
        t.dataset.layer = String(start);
        inner.appendChild(t);
        tiles.push(t);
      });
      col.appendChild(inner);
      wall.appendChild(col);
    }
    requestAnimationFrame(() => wall.classList.add('is-ready'));
    return { wall, tiles };
  }

  function wipeTile(t) {
    if (t.classList.contains('is-wiping')) return;
    const imgs = t.querySelectorAll('img');
    const cur = Number(t.dataset.layer);
    const nextIdx = (cur + 1) % imgs.length;
    const next = imgs[nextIdx];
    next.classList.add('is-next');
    void next.offsetWidth;
    next.classList.add('is-wiping');
    t.classList.add('is-wiping');
    setTimeout(() => {
      imgs[cur].classList.remove('is-cur');
      next.classList.add('is-cur');
      next.classList.remove('is-next', 'is-wiping');
      t.classList.remove('is-wiping');
      t.dataset.layer = String(nextIdx);
    }, 1150);
  }

  (function initWall() {
    const { wall, tiles } = buildWall();
    if (reducedMotion) return;
    let active = true;
    watchVisibility($('#top'), (v) => { active = v; });
    const inViewport = (t) => {
      const r = t.getBoundingClientRect();
      return r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight;
    };
    setInterval(() => {
      if (!active || document.hidden) return;
      for (let tries = 0; tries < 8; tries++) {
        const t = tiles[Math.floor(Math.random() * tiles.length)];
        if (inViewport(t)) { wipeTile(t); break; }
      }
    }, 380);

    let resizeTimer;
    let lastW = window.innerWidth;
    window.addEventListener('resize', () => {
      if (Math.abs(window.innerWidth - lastW) < 80) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        lastW = window.innerWidth;
        wall.innerHTML = '';
        tiles.length = 0;
        tiles.push(...buildWall().tiles);
      }, 300);
    });
  })();

  /* ---------------- Hero slicer ---------------- */
  (function initSlicer() {
    const slicer = $('#slicer');
    const slices = [...slicer.querySelectorAll('.slice')];
    const lines = $('#slice-lines');
    const tagsRoot = $('#slice-tags');
    const legendItems = [...document.querySelectorAll('#legend li')];
    const names = ['Image', 'Matte', 'Category', 'Growth', 'Depth'];
    const n = slices.length;
    const TILT = 0.2;
    const L0 = 0.16, R0 = 0.97;

    const tags = names.map((name) => { const t = el('span', 'slice-tag', name); tagsRoot.appendChild(t); return t; });
    const svgNS = 'http://www.w3.org/2000/svg';
    const lineEls = [];
    for (let i = 1; i < n; i++) {
      const ln = document.createElementNS(svgNS, 'line');
      lines.appendChild(ln);
      lineEls.push(ln);
    }

    // Boundary i (1..n-1) is the left edge of layer i at mid-height.
    const cur = new Array(n).fill(1.15);
    let target = cur.slice();
    let pointerX = null;
    let focus = null;
    let auto = 0;
    let started = false;
    const released = new Array(n).fill(false);

    const defaultCenters = (() => {
      const w = 1 / n;
      return [...Array(n).keys()].map((j) => L0 + (R0 - L0) * (j + 0.5) * w);
    })();

    function computeTarget() {
      let weights;
      if (focus !== null) {
        weights = [...Array(n).keys()].map((j) => (j === focus ? 3.4 : 0.85));
      } else if (pointerX !== null) {
        weights = defaultCenters.map((c) => 1 + 2.4 * Math.exp(-(((c - pointerX) / 0.13) ** 2)));
      } else {
        weights = new Array(n).fill(1);
      }
      const total = weights.reduce((a, b) => a + b, 0);
      const out = [0];
      let acc = 0;
      for (let j = 0; j < n - 1; j++) { acc += weights[j]; out.push(L0 + (R0 - L0) * (acc / total)); }
      return out;
    }

    function activeLayer() {
      if (focus !== null) return focus;
      let best = 0, bestW = -1;
      for (let j = 0; j < n; j++) {
        const lo = j === 0 ? L0 : cur[j];
        const hi = j === n - 1 ? R0 : cur[j + 1];
        if (hi - lo > bestW) { bestW = hi - lo; best = j; }
      }
      return best;
    }

    function render() {
      for (let i = 1; i < n; i++) {
        const top = (cur[i] + TILT / 2) * 100;
        const bot = (cur[i] - TILT / 2) * 100;
        slices[i].style.clipPath = `polygon(${top}% 0, 100% 0, 100% 100%, ${bot}% 100%)`;
        const ln = lineEls[i - 1];
        ln.setAttribute('x1', top); ln.setAttribute('y1', 0);
        ln.setAttribute('x2', bot); ln.setAttribute('y2', 100);
      }
      for (let j = 0; j < n; j++) {
        const left = j === 0 ? 0.03 : cur[j] - TILT / 2 + TILT * 0.06;
        const width = (j === n - 1 ? 1 : cur[j + 1]) - (j === 0 ? 0 : cur[j]);
        tags[j].style.left = `${left * 100}%`;
        tags[j].style.opacity = width * slicer.clientWidth > tags[j].offsetWidth + 14 && left < 0.92 ? 1 : 0;
      }
      const a = activeLayer();
      legendItems.forEach((li, j) => li.classList.toggle('is-active', j === a));
    }

    function tick() {
      target = computeTarget().map((v, i) => (released[i] ? v : 1.15));
      let moving = false;
      for (let i = 1; i < n; i++) {
        const d = target[i] - cur[i];
        if (Math.abs(d) > 0.0005) moving = true;
        cur[i] += d * (reducedMotion ? 1 : 0.085);
      }
      render();
      if (moving || pointerX !== null) requestAnimationFrame(tick);
      else ticking = false;
    }
    let ticking = false;
    const kick = () => { if (!ticking) { ticking = true; requestAnimationFrame(tick); } };

    slicer.addEventListener('pointermove', (e) => {
      const r = slicer.getBoundingClientRect();
      pointerX = (e.clientX - r.left) / r.width;
      focus = null;
      kick();
    });
    slicer.addEventListener('pointerleave', () => { pointerX = null; kick(); });
    legendItems.forEach((li, j) => {
      li.addEventListener('mouseenter', () => { focus = j; kick(); });
      li.addEventListener('mouseleave', () => { focus = null; kick(); });
      li.addEventListener('click', () => { focus = focus === j ? null : j; kick(); });
    });

    render();
    onVisible(slicer, () => {
      started = true;
      // Staggered sweep in from the right, then idle cycling through the labels.
      for (let i = n - 1; i >= 1; i--) setTimeout(() => { released[i] = true; kick(); }, reducedMotion ? 0 : (n - i) * 160);
      if (reducedMotion) return;
      let inView = true;
      watchVisibility(slicer, (v) => { inView = v; });
      setInterval(() => {
        if (!started || !inView || pointerX !== null || document.hidden) return;
        if (legendItems.some((li) => li.matches(':hover'))) return;
        auto = (auto + 1) % (n + 1);
        focus = auto === n ? null : auto;
        kick();
      }, 2600);
    }, { threshold: 0.35 });
  })();

  /* ---------------- Fact counters ---------------- */
  document.querySelectorAll('.facts dt[data-count]').forEach((dt) => {
    const end = Number(dt.dataset.count);
    if (reducedMotion) return;
    dt.textContent = '0';
    onVisible(dt, () => {
      const t0 = performance.now();
      const dur = 1400;
      const step = (t) => {
        const p = clamp((t - t0) / dur, 0, 1);
        const eased = 1 - Math.pow(1 - p, 4);
        dt.textContent = Math.round(end * eased).toLocaleString('en-US');
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.6 });
  });

  /* ---------------- Explorer ---------------- */
  (function initExplorer() {
    const data = window.EXPLORER;
    if (!data) return;
    const LABELS = [
      { key: 'alpha', name: 'Scalp hair matte', all: true },
      { key: 'categories', name: 'Hair category' },
      { key: 'orientation', name: '2D orientation' },
      { key: 'depth', name: 'Depth' },
    ];
    const CATS = [['Scalp', '--c-scalp'], ['Eyebrows', '--c-brows'], ['Eyelashes', '--c-lashes'], ['Mustache', '--c-mustache'], ['Beard', '--c-beard']];
    const NOTES = {
      alpha: 'Scalp-hair matte. For SynthHair the predicted scalp category is applied, so every model is compared on the same region.',
      categories: '',
      orientation: 'Red and green encode the in-plane direction of each strand.',
      depth: 'Relative depth inside the predicted hair region.',
      baseline: 'These datasets only provide hair masks, so their models predict a hair matte only.',
      grid: 'Hair mattes of all four models side by side. Hover to zoom all of them at the same spot.',
    };

    const state = { ex: 0, model: 'ours', label: 'alpha', view: 'single', split: 0.5 };
    const stage = $('#stage');
    const imgBase = $('#img-base');
    const imgPred = $('#img-pred');
    const predClip = $('#pred-clip');
    const divider = $('#divider');
    const tagRight = $('#tag-right');
    const loading = $('#stage-loading');
    const grid = $('#stage-grid');
    const labelNote = $('#label-note');
    const modelControl = $('#model-control');

    const src = (ex, file) => `${MEDIA}/explorer/${ex.slug}/${file}.webp`;
    const predFile = (model, label) => `${model}_${label}`;
    const modelByKey = Object.fromEntries(data.models.map((m) => [m.key, m]));
    const modelHtml = (m) => m.name;

    const cache = new Map();
    function load(url) {
      if (!cache.has(url)) {
        cache.set(url, new Promise((resolve) => {
          const im = new Image();
          im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => resolve(url));
          im.onerror = () => resolve(url);
          im.src = url;
        }));
      }
      return cache.get(url);
    }

    /* Controls */
    const thumbs = $('#thumbs');
    const thumbTitle = el('div', 'thumb-title');
    data.examples.forEach((ex, i) => {
      const b = el('button', 'thumb');
      b.type = 'button';
      b.title = ex.title;
      b.setAttribute('aria-label', ex.title);
      const im = new Image();
      im.src = src(ex, 'thumb');
      im.alt = '';
      b.appendChild(im);
      b.addEventListener('click', () => set({ ex: i }));
      thumbs.appendChild(b);
    });
    thumbs.after(thumbTitle);

    const modelsRoot = $('#models');
    data.models.forEach((m, i) => {
      const b = el('button', `model${m.key === 'ours' ? ' is-ours' : ''}`);
      b.type = 'button';
      b.dataset.key = m.key;
      b.innerHTML = `<span class="key">${i + 1}</span><span><span class="name">${modelHtml(m)}</span><span class="bar"></span></span><span class="score"></span>`;
      b.addEventListener('click', () => set({ model: m.key }));
      modelsRoot.appendChild(b);
    });

    const labelsRoot = $('#labels');
    LABELS.forEach((l) => {
      const b = el('button', 'chip', l.name);
      b.type = 'button';
      b.dataset.key = l.key;
      b.addEventListener('click', () => {
        if (!l.all && state.model !== 'ours') set({ label: l.key, model: 'ours' });
        else set({ label: l.key });
      });
      labelsRoot.appendChild(b);
    });

    document.querySelectorAll('#view-toggle button').forEach((b) => {
      b.addEventListener('click', () => set({ view: b.dataset.view }));
    });

    /* Grid */
    const gridCells = data.models.map((m) => {
      const cell = el('div', `grid-cell${m.key === 'ours' ? ' is-ours' : ''}`);
      const im = new Image();
      im.alt = '';
      const tag = el('span', 'stage-tag', m.key === 'ours' ? 'SynthHair (ours)' : m.name);
      const sipq = el('span', 'sipq');
      const lp = el('div', 'grid-loupe');
      cell.append(im, tag, sipq, lp);
      grid.appendChild(cell);
      return { m, cell, im, sipq, lp };
    });

    /* Render */
    let renderToken = 0;
    async function render() {
      const ex = data.examples[state.ex];
      const token = ++renderToken;
      const baseUrl = src(ex, 'image');
      const predUrl = src(ex, predFile(state.model, state.label));

      document.querySelectorAll('.thumb').forEach((t, i) => t.classList.toggle('is-active', i === state.ex));
      thumbTitle.textContent = ex.title;
      const maxS = Math.max(...Object.values(ex.sipq));
      document.querySelectorAll('.model').forEach((b) => {
        const k = b.dataset.key;
        b.classList.toggle('is-active', k === state.model);
        b.querySelector('.score').textContent = `SIPQ ${ex.sipq[k].toFixed(1)}`;
        b.querySelector('.bar').style.setProperty('--v', ex.sipq[k] / maxS);
      });
      document.querySelectorAll('.chip').forEach((c) => {
        const l = LABELS.find((x) => x.key === c.dataset.key);
        c.classList.toggle('is-active', c.dataset.key === state.label && state.view === 'single');
        c.classList.toggle('is-unavailable', !l.all && (state.model !== 'ours' || state.view === 'grid'));
      });
      document.querySelectorAll('#view-toggle button').forEach((b) => b.classList.toggle('is-active', b.dataset.view === state.view));
      stage.classList.toggle('is-grid', state.view === 'grid');
      modelControl.style.display = state.view === 'grid' ? 'none' : '';
      $('#labels').style.display = state.view === 'grid' ? 'none' : '';
      $('#label-control .control-label').style.display = state.view === 'grid' ? 'none' : '';

      if (state.view === 'grid') {
        labelNote.textContent = NOTES.grid;
      } else if (state.label === 'categories') {
        labelNote.innerHTML = `<span class="cat-legend">${CATS.map(([n, c]) => `<span><i style="background:var(${c})"></i>${n}</span>`).join('')}</span>`;
      } else if (state.model !== 'ours') {
        labelNote.textContent = NOTES.baseline;
      } else {
        labelNote.textContent = NOTES[state.label];
      }

      $('#caption-meta').textContent = `AI-generated image · ${ex.size[0]} × ${ex.size[1]}`;
      tagRight.textContent = `${modelByKey[state.model].key === 'ours' ? 'SynthHair' : modelByKey[state.model].name} · ${LABELS.find((l) => l.key === state.label).name}`;

      const urls = state.view === 'grid'
        ? [baseUrl, ...data.models.map((m) => src(ex, predFile(m.key, 'alpha')))]
        : [baseUrl, predUrl];
      const slow = setTimeout(() => loading.classList.add('is-on'), 120);
      await Promise.all(urls.map(load));
      clearTimeout(slow);
      if (token !== renderToken) return;
      loading.classList.remove('is-on');

      imgBase.src = baseUrl;
      imgPred.src = predUrl;
      gridCells.forEach(({ m, im, sipq }) => {
        im.src = src(ex, predFile(m.key, 'alpha'));
        sipq.textContent = `SIPQ ${ex.sipq[m.key].toFixed(1)}`;
      });
      prefetchNeighbours();
    }

    function prefetchNeighbours() {
      const ex = data.examples[state.ex];
      const idle = window.requestIdleCallback || ((f) => setTimeout(f, 200));
      idle(() => {
        LABELS.forEach((l) => { if (state.model === 'ours') load(src(ex, predFile('ours', l.key))); });
        data.models.forEach((m) => load(src(ex, predFile(m.key, 'alpha'))));
        load(src(data.examples[(state.ex + 1) % data.examples.length], 'image'));
      });
    }

    function set(patch) {
      Object.assign(state, patch);
      const l = LABELS.find((x) => x.key === state.label);
      if (!l.all && state.model !== 'ours') state.label = 'alpha';
      render();
    }

    /* Divider (single view) and synced loupes (grid view) */
    function setSplit(v) {
      state.split = clamp(v, 0, 1);
      stage.style.setProperty('--split', `${state.split * 100}%`);
    }
    setSplit(0.5);

    let dragging = false;

    function updateGridLoupe(e) {
      const cellRect = gridCells[0].cell.getBoundingClientRect();
      const hovered = gridCells.find(({ cell }) => {
        const r = cell.getBoundingClientRect();
        return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      });
      if (!hovered || e.pointerType === 'touch') { gridCells.forEach(({ cell }) => cell.classList.remove('is-loupe')); return; }
      const hr = hovered.cell.getBoundingClientRect();
      const u = (e.clientX - hr.left) / hr.width, v = (e.clientY - hr.top) / hr.height;
      const ex = data.examples[state.ex];
      const zoom = Math.max(2, ex.size[0] / cellRect.width / 2);
      const R = 75;
      gridCells.forEach(({ cell, im, lp }) => {
        const w = cell.clientWidth, h = cell.clientHeight;
        // object-fit: cover crops slightly when the cell is not exactly 4:3.
        const scale = Math.max(w / ex.size[0], h / ex.size[1]);
        const iw = ex.size[0] * scale * zoom, ih = ex.size[1] * scale * zoom;
        const ox = (w - ex.size[0] * scale) / 2, oy = (h - ex.size[1] * scale) / 2;
        const px = u * w, py = v * h;
        lp.style.backgroundImage = `url("${im.src}")`;
        lp.style.backgroundSize = `${iw}px ${ih}px`;
        lp.style.backgroundPosition = `${-((px - ox) * zoom - R) + 0}px ${-((py - oy) * zoom - R)}px`;
        lp.style.left = `${px}px`;
        lp.style.top = `${py}px`;
        cell.classList.add('is-loupe');
      });
    }

    function splitFromEvent(e) {
      const r = stage.getBoundingClientRect();
      setSplit((e.clientX - r.left) / r.width);
    }
    stage.addEventListener('pointerdown', (e) => {
      if (state.view !== 'single') return;
      dragging = true;
      stage.classList.add('is-dragging');
      stage.setPointerCapture(e.pointerId);
      splitFromEvent(e);
    });
    stage.addEventListener('pointermove', (e) => {
      if (dragging) splitFromEvent(e);
      else if (state.view === 'grid') updateGridLoupe(e);
    });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove('is-dragging');
    };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener('pointerleave', () => {
      gridCells.forEach(({ cell }) => cell.classList.remove('is-loupe'));
    });

    /* Keyboard */
    let explorerInView = false;
    watchVisibility($('#explorer'), (v) => { explorerInView = v; });
    document.addEventListener('keydown', (e) => {
      if (!explorerInView || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = data.examples.length;
      if (e.key === 'ArrowRight') { set({ ex: (state.ex + 1) % n }); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { set({ ex: (state.ex - 1 + n) % n }); e.preventDefault(); }
      else if (/^[1-4]$/.test(e.key) && state.view === 'single') set({ model: data.models[Number(e.key) - 1].key });
    });

    /* Intro: sweep the divider once when the explorer first appears. */
    onVisible(stage, () => {
      if (reducedMotion) return;
      const t0 = performance.now();
      const step = (t) => {
        const p = clamp((t - t0) / 1800, 0, 1);
        if (dragging) return;
        setSplit(0.5 + 0.32 * Math.sin(p * Math.PI * 2) * (1 - p));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.5 });

    render();
  })();
})();
