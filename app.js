/* Film Financing Calculator · 2026 — vanilla app.
 *
 * "One stage, many instruments." A single full-bleed cosmos is the stage;
 * the console, the crawl and the dossier all live inside it. Plain-JS state
 * container + render(); subsequent state changes mutate SVG nodes in place so
 * CSS transitions ride the change.
 *
 * Depends on calc.js (untouched) for the financing maths.
 */

(function () {
  'use strict';

  // ─── STATE ─────────────────────────────────────────────────────
  const state = {
    projectType: 'feature',
    mode: 'minority',
    totalBudget: 1200000,
    securedPct: 0.62,
    croatiaPct: 0.65,
    lowDevRegion: false,
  };

  function setState(patch) {
    Object.assign(state, patch);
    render();
  }

  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const refs = {};

  let currentTheme = 'auto';
  let consoleExpanded = true;
  const ui = { overlay: null, returnFocus: null, reportView: 'memo' };

  const THEME_STORAGE_KEY = 'ffcTheme';
  const CONSOLE_STORAGE_KEY = 'ffcConsole';
  const VALID_THEMES = ['auto', 'light', 'dark'];

  function isWide() { return window.matchMedia('(min-width: 880px)').matches; }
  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function announce(msg) { if (refs.liveStatus) refs.liveStatus.textContent = msg; }

  function setDisplaysText(name, value) {
    (refs.displays[name] || []).forEach((el) => { el.textContent = value; });
  }
  function syncRangeGroup(inputs, value) {
    inputs.forEach((input) => {
      if (document.activeElement !== input) input.value = value;
    });
  }

  // ─── CONSTELLATION GEOMETRY (fluid, full-bleed, label-safe) ─────
  const NODES = [
    { id: 'secured', label: 'Secured financing' },
    { id: 'havc',    label: 'HAVC financing' },
    { id: 'local',   label: 'Local grants' },
    { id: 'rebate',  label: 'Incentive rebate' },
    { id: 'extra',   label: 'Low-dev uplift' },
  ];

  let CONST = {};

  // Chrome (console + kicker + HUD) reserves space; the constellation diagram
  // centres in the CLEAR area while the starfield still bleeds full-screen.
  function chromeInsets() {
    const vw = Math.max(1, window.innerWidth);
    const vh = Math.max(1, window.innerHeight);
    const r = refs.console ? refs.console.getBoundingClientRect() : null;
    if (isWide()) {
      return { left: r ? r.right + 28 : 360, right: 28, top: 62, bottom: 54 };
    }
    return { left: 12, right: 12, top: 46, bottom: r ? Math.max(72, (vh - r.top) + 12) : 200 };
  }

  function computeConstGeom() {
    const vw = Math.max(1, window.innerWidth);
    const vh = Math.max(1, window.innerHeight);
    const W = 1000;
    const H = Math.max(360, Math.round(W * vh / vw));
    const sx = W / vw, sy = H / vh;

    const ins = chromeInsets();
    const left = ins.left * sx, right = ins.right * sx;
    const top = ins.top * sy, bottom = ins.bottom * sy;

    const clearW = Math.max(160, W - left - right);
    const clearH = Math.max(160, H - top - bottom);
    const cx = left + clearW / 2;
    const cy = top + clearH / 2;
    const minSide = Math.min(clearW, clearH);

    const ringR = (minSide / 2) * 0.62;
    const centerR = Math.max(38, ringR * 0.38);
    const ringStroke = Math.max(3.5, minSide * 0.009);
    const nodeBase = ringR * 0.05;
    const nodeGrow = ringR * 0.155;

    const sizes = {
      kicker:     Math.max(7,  minSide * 0.017),
      valueBig:   Math.max(17, minSide * 0.038),
      valueSmall: Math.max(8,  minSide * 0.019),
      nodeLabel:  Math.max(7,  minSide * 0.016),
      nodeVal:    Math.max(12, minSide * 0.032),
      nodeNote:   Math.max(7,  minSide * 0.015),
    };

    return {
      W, H, sx, sy, cx, cy, minSide,
      ringR, centerR, ringStroke, nodeBase, nodeGrow, sizes,
      ringCircum: 2 * Math.PI * (centerR + ringStroke),
      bounds: {
        minX: left + 8 * sx, maxX: W - right - 8 * sx,
        minY: top + 8 * sy,  maxY: H - bottom - 8 * sy,
      },
    };
  }

  function layoutNodes() {
    NODES.forEach((n, i) => {
      n.ang = -Math.PI / 2 + i * (2 * Math.PI / NODES.length);
      n.px = CONST.cx + Math.cos(n.ang) * CONST.ringR;
      n.py = CONST.cy + Math.sin(n.ang) * CONST.ringR;
    });
  }

  // Live theme-aware reads. CSS vars resolve through brand/colors_and_type.css.
  function themeColors() {
    const cs = getComputedStyle(document.body);
    const v = (name, fb) => (cs.getPropertyValue(name).trim() || fb);
    const num = (name, fb) => {
      const n = parseFloat(cs.getPropertyValue(name));
      return isNaN(n) ? fb : n;
    };
    return {
      ink:     v('--ink', '#2e2522'),
      paper:   v('--paper', '#f4ede2'),
      dim:     v('--paper-dim', '#d6cebe'),
      muted:   v('--muted', '#8a7e72'),
      rule:    v('--rule', '#4a3b35'),
      red:     v('--red', '#c14843'),
      edge:    v('--edge', '#3c2f2a'),
      edgeOn:  v('--edge-on', '#6b554d'),
      nebulaA: v('--nebula-a', '#5a3a32'),
      nebulaB: v('--nebula-b', '#3a2a25'),
      star:    v('--star-fill', '#f4ede2'),
      starOpacity: num('--star-opacity', 0.55),
      nebulaStrength: num('--nebula-strength', 0.55),
    };
  }

  // ─── SVG BUILD — on boot, theme change, resize, console toggle ──
  function buildConstellation() {
    CONST = computeConstGeom();
    layoutNodes();

    const svg = refs.constSvg;
    svg.setAttribute('viewBox', `0 0 ${CONST.W} ${CONST.H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const C = themeColors();
    const sz = CONST.sizes;
    const b = CONST.bounds;
    const reduce = prefersReducedMotion();

    const seed = (n) => {
      const x = Math.sin(n * 9301 + 49297) * 233280;
      return x - Math.floor(x);
    };

    const parts = [];
    const nebStop0 = CONST_clamp(C.nebulaStrength);
    const nebStop1 = CONST_clamp(C.nebulaStrength * 0.33);
    const nebCx = (CONST.cx / CONST.W * 100).toFixed(1);
    const nebCy = (CONST.cy / CONST.H * 100).toFixed(1);

    parts.push(`
      <defs>
        <radialGradient id="vc-nebula" cx="${nebCx}%" cy="${nebCy}%" r="58%">
          <stop offset="0%"  stop-color="${C.nebulaA}" stop-opacity="${nebStop0}"/>
          <stop offset="60%" stop-color="${C.nebulaB}" stop-opacity="${nebStop1}"/>
          <stop offset="100%" stop-color="${C.ink}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill="url(#vc-nebula)" />
    `);

    // Starfield — full-bleed (percentage coords). Token-driven brightness so
    // it reads as glow on dark and as ink specks on cream.
    const STAR_COUNT = isWide() ? 120 : 70;
    for (let i = 0; i < STAR_COUNT; i++) {
      const x = (seed(i) * 100).toFixed(2);
      const y = (seed(i + 1000) * 100).toFixed(2);
      const r = (0.4 + seed(i + 2000) * 1.4).toFixed(2);
      const o = ((0.25 + seed(i + 3000) * 0.75) * C.starOpacity).toFixed(3);
      if (reduce) {
        parts.push(`<circle class="star" cx="${x}%" cy="${y}%" r="${r}" fill="${C.star}" opacity="${o}"/>`);
      } else {
        const td = (2 + seed(i + 4000) * 4).toFixed(2);
        const delay = (-seed(i + 5000) * 6).toFixed(2);
        parts.push(
          `<circle class="star" cx="${x}%" cy="${y}%" r="${r}" fill="${C.star}" opacity="${o}">
            <animate attributeName="opacity" values="${o};${(o * 0.3).toFixed(3)};${o}"
              dur="${td}s" begin="${delay}s" repeatCount="indefinite" />
          </circle>`
        );
      }
    }

    // Orbit guide
    parts.push(
      `<circle cx="${CONST.cx}" cy="${CONST.cy}" r="${CONST.ringR}"
        fill="none" stroke="${C.rule}" stroke-width="1"
        stroke-dasharray="2 6" opacity="0.5" />`
    );

    // Edges from centre to each node
    for (const n of NODES) {
      parts.push(
        `<line class="edge" id="edge-${n.id}"
          x1="${CONST.cx}" y1="${CONST.cy}" x2="${n.px}" y2="${n.py}"
          stroke="${C.edge}" stroke-width="1" stroke-dasharray="3 4" opacity="0.45" />`
      );
    }

    // Leader lines + node label groups (radial placement, clamped to clear area)
    const maxNodeR = CONST.nodeBase + CONST.nodeGrow;
    const lh = sz.nodeLabel * 1.55;
    for (const n of NODES) {
      const cosA = Math.cos(n.ang), sinA = Math.sin(n.ang);
      const outDist = maxNodeR + sz.nodeVal * 0.6 + 10;
      const idealX = n.px + cosA * outDist;
      const idealY = n.py + sinA * outDist;
      const anchor = cosA > 0.25 ? 'start' : cosA < -0.25 ? 'end' : 'middle';

      // Estimate the label block's width so the WHOLE block (which extends
      // away from the anchor) stays inside the clear area — anchor-aware, so
      // 'end' labels never bleed left into the console and 'start' labels
      // never run off the right edge.
      const approxW = Math.max(
        n.label.length * sz.nodeLabel,
        24 * sz.nodeNote,
        9 * sz.nodeVal
      ) * 0.62;
      let lx, ly;
      if (anchor === 'end')        lx = Math.min(Math.max(idealX, b.minX + approxW), b.maxX);
      else if (anchor === 'start') lx = Math.max(Math.min(idealX, b.maxX - approxW), b.minX);
      else                         lx = Math.min(Math.max(idealX, b.minX + approxW / 2), b.maxX - approxW / 2);
      ly = Math.min(b.maxY - lh, Math.max(b.minY + lh, idealY));
      const moved = Math.abs(lx - idealX) > 3 || Math.abs(ly - idealY) > 3;

      if (moved) {
        const ex = n.px + cosA * maxNodeR, ey = n.py + sinA * maxNodeR;
        parts.push(
          `<line class="leader" x1="${ex.toFixed(1)}" y1="${ey.toFixed(1)}"
            x2="${lx.toFixed(1)}" y2="${ly.toFixed(1)}"
            stroke="${C.edge}" stroke-width="1" opacity="0.45" />`
        );
      }

      parts.push(`
        <g id="node-${n.id}">
          <circle class="halo" cx="${n.px}" cy="${n.py}" r="0" fill="${C.red}" opacity="0.09" />
          <circle class="node-circle" cx="${n.px}" cy="${n.py}" r="${CONST.nodeBase}"
            fill="${C.ink}" stroke="${C.rule}" stroke-width="1.5" />
          <text class="node-label" x="${lx.toFixed(1)}" y="${(ly - lh * 0.95).toFixed(1)}"
            text-anchor="${anchor}" font-family="JetBrains Mono, monospace"
            font-size="${sz.nodeLabel.toFixed(1)}" letter-spacing="0.12em" fill="${C.dim}"
            style="text-transform: uppercase;">${n.label}</text>
          <text class="node-val" x="${lx.toFixed(1)}" y="${(ly + sz.nodeVal * 0.35).toFixed(1)}"
            text-anchor="${anchor}" font-family="Bricolage Grotesque, sans-serif"
            font-weight="700" font-size="${sz.nodeVal.toFixed(1)}" letter-spacing="-0.02em"
            fill="${C.muted}">—</text>
          <text class="node-note" x="${lx.toFixed(1)}" y="${(ly + lh + sz.nodeVal * 0.2).toFixed(1)}"
            text-anchor="${anchor}" font-family="JetBrains Mono, monospace"
            font-size="${sz.nodeNote.toFixed(1)}" letter-spacing="0.04em" fill="${C.muted}">—</text>
        </g>
      `);
    }

    // Centre — coverage ring + inner disc + labels
    const cR = CONST.centerR, cS = CONST.ringStroke;
    parts.push(`
      <circle cx="${CONST.cx}" cy="${CONST.cy}" r="${cR + cS + 2}" fill="none" stroke="${C.rule}" stroke-width="1" />
      <circle cx="${CONST.cx}" cy="${CONST.cy}" r="${cR + cS}" fill="none" stroke="${C.rule}" stroke-width="${cS}" />
      <circle class="coverage-ring" id="coverageRing"
        cx="${CONST.cx}" cy="${CONST.cy}" r="${cR + cS}"
        fill="none" stroke="${C.red}" stroke-width="${cS}"
        stroke-dasharray="0 ${CONST.ringCircum}"
        transform="rotate(-90 ${CONST.cx} ${CONST.cy})" />
      <circle cx="${CONST.cx}" cy="${CONST.cy}" r="${cR}" fill="${C.ink}" stroke="${C.rule}" stroke-width="1" />
      <text x="${CONST.cx}" y="${CONST.cy - cR * 0.32}" text-anchor="middle"
        font-family="JetBrains Mono, monospace" font-size="${sz.kicker.toFixed(1)}"
        letter-spacing="0.14em" fill="${C.dim}" style="text-transform: uppercase;">target budget</text>
      <text id="centerBudget" x="${CONST.cx}" y="${CONST.cy + sz.valueBig * 0.18}"
        text-anchor="middle" font-family="Bricolage Grotesque, sans-serif"
        font-weight="800" font-size="${sz.valueBig.toFixed(1)}" letter-spacing="-0.025em"
        fill="${C.paper}">€1,200,000</text>
      <text id="centerCoverage" x="${CONST.cx}" y="${CONST.cy + cR * 0.42}"
        text-anchor="middle" font-family="JetBrains Mono, monospace"
        font-size="${sz.valueSmall.toFixed(1)}" letter-spacing="0.06em" fill="${C.red}">0% covered</text>
    `);

    svg.innerHTML = parts.join('');

    refs.svgCenterBudget = svg.querySelector('#centerBudget');
    refs.svgCenterCoverage = svg.querySelector('#centerCoverage');
    refs.svgCoverageRing = svg.querySelector('#coverageRing');
    refs.svgNodes = {};
    for (const n of NODES) {
      const g = svg.querySelector(`#node-${n.id}`);
      refs.svgNodes[n.id] = {
        halo:   g.querySelector('.halo'),
        circle: g.querySelector('.node-circle'),
        val:    g.querySelector('.node-val'),
        note:   g.querySelector('.node-note'),
        edge:   svg.querySelector(`#edge-${n.id}`),
      };
    }
  }

  function CONST_clamp(n) { return Math.max(0, Math.min(1, n)).toFixed(3); }

  // ─── INLINE INPUTS (reused verbatim, relocated into the console) ──
  function syncInlineWidth(input) {
    input.style.width = `${input.value.length + 0.8}ch`;
  }
  function updateInlineInput(input, value, isMoney) {
    if (!input || input === document.activeElement) return;
    input.value = isMoney ? value.toLocaleString('en-GB') : String(value);
    syncInlineWidth(input);
  }
  function setupInlineInput(input, field, isMoney, min, max) {
    if (!input) return;
    input.addEventListener('focus', () => {
      input.value = isMoney ? String(state[field]) : String(Math.round(state[field] * 100));
      syncInlineWidth(input);
      input.select();
    });
    input.addEventListener('blur', () => {
      input.value = isMoney ? state[field].toLocaleString('en-GB') : String(Math.round(state[field] * 100));
      syncInlineWidth(input);
    });
    input.addEventListener('input', () => {
      const raw = input.value.replace(/[^\d.-]/g, '');
      const n = parseFloat(raw);
      if (!isNaN(n)) {
        const clamped = Math.max(min, Math.min(max, n));
        setState(isMoney ? { [field]: clamped } : { [field]: clamped / 100 });
      }
      syncInlineWidth(input);
    });
  }

  // ─── CYCLING INSTRUMENTS ────────────────────────────────────────
  const CYCLE_DEFS = {
    projectType: {
      kicker: 'project',
      get: () => state.projectType,
      set: (v) => setState({ projectType: v }),
      values: [
        { v: 'feature',            label: 'Feature',     icon: 'fa-film',         aria: 'Feature' },
        { v: 'short',              label: 'Short',       icon: 'fa-clapperboard', aria: 'Short film' },
        { v: 'featureDocumentary', label: 'Documentary', icon: 'fa-tv',           aria: 'Feature documentary' },
      ],
    },
    mode: {
      kicker: 'mode',
      get: () => state.mode,
      set: (v) => setState({ mode: v }),
      values: [
        { v: 'service',  label: 'Service',  icon: 'fa-briefcase', aria: 'Service production' },
        { v: 'minority', label: 'Minority', icon: 'fa-handshake', aria: 'Minority co-production' },
      ],
    },
    region: {
      kicker: 'region',
      get: () => state.lowDevRegion,
      set: (v) => setState({ lowDevRegion: v }),
      values: [
        { v: false, label: 'Standard', icon: 'fa-map',          aria: 'Standard region' },
        { v: true,  label: 'Low-dev',  icon: 'fa-mountain-sun', aria: 'Low-development region' },
      ],
    },
    theme: {
      kicker: 'theme',
      get: () => currentTheme,
      set: (v) => applyTheme(v),
      values: [
        { v: 'auto',  label: 'Auto',  icon: 'fa-circle-half-stroke', aria: 'Auto theme' },
        { v: 'light', label: 'Light', icon: 'fa-sun',                aria: 'Light theme' },
        { v: 'dark',  label: 'Dark',  icon: 'fa-moon',               aria: 'Dark theme' },
      ],
    },
  };

  function cycleIndex(def) {
    const cur = def.get();
    const i = def.values.findIndex((o) => o.v === cur);
    return i < 0 ? 0 : i;
  }

  function cycle(key, dir) {
    const def = CYCLE_DEFS[key];
    if (!def) return;
    const i = cycleIndex(def);
    const next = def.values[(i + dir + def.values.length) % def.values.length];
    def.set(next.v);                       // triggers render() (or applyTheme→render)
    announce(`${def.kicker} set to ${next.aria || next.label}`);
  }

  function renderCycleButtons() {
    (refs.cycBtns || []).forEach((btn) => {
      const key = btn.dataset.cycle;
      const def = CYCLE_DEFS[key];
      if (!def) return;
      const i = cycleIndex(def);
      const cur = def.values[i];
      const next = def.values[(i + 1) % def.values.length];

      const icon = btn.querySelector('.cyc-icon');
      const val  = btn.querySelector('.cyc-value');
      const ghost = btn.querySelector('.cyc-ghost');
      const dots = btn.querySelector('.cyc-dots');

      if (icon) icon.className = `cyc-icon fa-solid ${cur.icon}`;
      if (val) val.textContent = cur.label;
      if (ghost) ghost.textContent = '→ ' + next.label;
      if (dots) {
        dots.innerHTML = def.values
          .map((_, k) => `<span class="cyc-dot${k === i ? ' on' : ''}"></span>`)
          .join('');
      }
      btn.setAttribute('aria-label',
        `${def.kicker}: ${cur.aria || cur.label}. Activate to change to ${next.aria || next.label}.`);
    });
  }

  // ─── RENDER ────────────────────────────────────────────────────
  function render() {
    const r = computeFinancing(state);
    const cov = Math.min(1, (r.total + r.securedAmount) / state.totalBudget);

    renderCycleButtons();

    syncRangeGroup(refs.rangeInputs.totalBudget, state.totalBudget);
    syncRangeGroup(refs.rangeInputs.securedPct, state.securedPct);
    syncRangeGroup(refs.rangeInputs.croatiaPct, state.croatiaPct);

    setDisplaysText('subSecured', fmt(r.securedAmount));
    setDisplaysText('subCroatia', fmt(r.croatiaSpend));

    setDisplaysText('coveragePct', Math.round(cov * 100) + '%');
    (refs.displays.coveragePct || []).forEach((el) => el.classList.toggle('short', cov < 1));
    if (r.gap > 0) {
      (refs.displays.coverageNote || []).forEach((el) => {
        el.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>gap · ' + fmt(r.gap);
        el.classList.add('gap');
      });
    } else {
      (refs.displays.coverageNote || []).forEach((el) => {
        el.innerHTML = '<i class="fa-solid fa-check"></i>fully covered';
        el.classList.remove('gap');
      });
    }
    setDisplaysText('coveragePotential', 'potential ' + fmt(r.total));

    updateInlineInput(refs.memoBudget,  state.totalBudget,                  true);
    updateInlineInput(refs.memoSecured, Math.round(state.securedPct * 100), false);
    updateInlineInput(refs.memoCroatia, Math.round(state.croatiaPct * 100), false);

    renderMemo(r, cov);
    updateConstellation(r, cov);
    updateConsoleToggleRead(cov);

    const activeNodes =
      (r.securedAmount > 0 ? 1 : 0) + (r.havc > 0 ? 1 : 0) + (r.local > 0 ? 1 : 0) +
      (r.rebate > 0 ? 1 : 0) + (r.extraRebate > 0 ? 1 : 0);
    const C = themeColors();
    refs.constHud.innerHTML =
      '<span><i class="fa-solid fa-circle" style="color:' + C.red + ';font-size:8px;"></i>'
      + activeNodes + '/5 sources active · ' + Math.round(cov * 100) + '% covered'
      + (r.gap > 0 ? ' · gap ' + fmt(r.gap) : '') + '</span>';
  }

  function ledgerRows(r) {
    const minSpend = MIN_CROATIA_SPEND[state.projectType];
    const isShort = state.projectType === 'short';
    return [
      {
        icon: 'fa-landmark', title: 'HAVC financing',
        note: r.havc > 0
          ? 'Indicative · awarded discretionarily by HAVC Umjetničko vijeće · capped at 60% domestic cover'
          : (state.mode !== 'minority'  ? 'Service productions are not eligible'
             : state.securedPct < 0.5   ? 'Requires ≥ 50% secured financing (NN 95/2023 Art 31(2))'
             :                            'Above 85% secured leaves &lt; 15% for the foreign majority — theoretical only'),
        amount: r.havc,
      },
      {
        icon: 'fa-building-columns', title: 'Local grants',
        note: r.local > 0
          ? 'Municipal / county top-up · typically follows once HAVC minority is greenlit'
          : 'Unlocks once HAVC minority approval is in hand (proxied here at ≥ 75% secured)',
        amount: r.local,
      },
      {
        icon: 'fa-percent', title: 'Incentive rebate',
        note: isShort
          ? 'Short films are not rebate-eligible (Pravilnik NN 9/2024 Art 5(7)(1)). Shorts can still apply for HAVC minority funding.'
          : r.rebate > 0
            ? '25% of qualifying spend · base ' + fmt(r.eligibleSpend) + ' (capped at 80% of budget)'
            : (r.croatiaSpend < minSpend
                ? 'Below minimum Croatia spend (' + fmt(minSpend) + ')'
                : 'Needs ≥ 70% of Croatia spend secured'),
        amount: r.rebate,
      },
      {
        icon: 'fa-arrow-trend-up', title: 'Low-development uplift',
        note: state.lowDevRegion
          ? (r.extraRebate > 0 ? '+5% extra on qualifying spend · low-dev region' : 'Activates once the base rebate qualifies')
          : 'Toggle region to “Low-dev” to claim +5%',
        amount: r.extraRebate,
      },
    ];
  }

  // The memo is a ready-to-send email draft, rebuilt on every state change so
  // it is always current when opened. The on-screen doc IS what gets copied.
  function renderMemo(r, cov) {
    const covPct = Math.round(cov * 100);
    const proj = projectWord(), mode = modeWord();
    const sec = Math.round(state.securedPct * 100), cro = Math.round(state.croatiaPct * 100);
    const subject = `Film financing — ${proj}, ${mode}`;
    refs.memoSubject = subject;

    const figs = ledgerRows(r).map((row) => ({ title: row.title, amount: row.amount }));
    const gapClause = r.gap > 0 ? `, leaving a gap of ${fmt(r.gap)}` : ', fully closing the budget';
    const tok = (s) => `<span class="tok">${s}</span>`;

    const figRows = figs.map((f) => {
      const off = f.amount <= 0;
      return `<tr><td${off ? ' class="off"' : ''}>${f.title}</td>`
        + `<td${off ? ' class="off"' : ''}>${off ? '—' : fmt(f.amount)}</td></tr>`;
    }).join('');

    refs.memoDoc.innerHTML =
      `<div class="memo-doc-subject">Re: ${subject}</div>` +
      `<p>Hi —</p>` +
      `<p>We're producing a ${tok(proj)} as a ${tok(mode)}. The total budget is `
        + `${tok('€' + state.totalBudget.toLocaleString('en-GB'))}, with ${tok(sec + '%')} `
        + `(${fmt(r.securedAmount)}) already secured and ${tok(cro + '%')} of spend planned in Croatia.</p>` +
      `<p>On top of what's secured, we project ${tok(fmt(r.total))} in potential financing from the `
        + `sources below — together covering ${tok(covPct + '%')} of the budget${gapClause}.</p>` +
      `<table class="memo-doc-figs"><tbody>${figRows}` +
        `<tr class="memo-fig-total"><td>Total potential financing</td><td>${fmt(r.total)}</td></tr>` +
        (r.gap > 0
          ? `<tr class="memo-fig-gap"><td>Budget gap remaining</td><td>−${fmt(r.gap)}</td></tr>`
          : `<tr class="memo-fig-total"><td>Budget gap</td><td>fully covered</td></tr>`) +
      `</tbody></table>` +
      `<p class="memo-doc-note">First-pass estimate on the current Croatian rules (HAVC minority `
        + `co-production and the audiovisual incentive rebate). Strictly illustrative — actual `
        + `decisions sit with HAVC, the line producer, and the auditor.</p>` +
      `<p class="memo-doc-sign">— Aning Film</p>`;

    refs.memoText = buildMemoText(r, { proj, mode, sec, cro, covPct, subject, figs, gapClause });
  }

  function buildMemoText(r, m) {
    const pad = (label, val) => {
      const dots = Math.max(3, 28 - label.length);
      return '  ' + label + ' ' + '.'.repeat(dots) + ' ' + val;
    };
    const lines = [
      `Re: ${m.subject}`, '', 'Hi —', '',
      `We're producing a ${m.proj} as a ${m.mode}. The total budget is `
        + `€${state.totalBudget.toLocaleString('en-GB')}, with ${m.sec}% (${fmt(r.securedAmount)}) `
        + `already secured and ${m.cro}% of spend planned in Croatia.`, '',
      `On top of what's secured, we project ${fmt(r.total)} in potential financing from the `
        + `sources below — together covering ${m.covPct}% of the budget${m.gapClause}.`, '',
    ];
    m.figs.forEach((f) => lines.push(pad(f.title, f.amount > 0 ? fmt(f.amount) : '—')));
    lines.push('  ' + '-'.repeat(34));
    lines.push(pad('Total potential', fmt(r.total)));
    lines.push(pad('Budget gap', r.gap > 0 ? '−' + fmt(r.gap) : 'fully covered'));
    lines.push('',
      'First-pass estimate on the current Croatian rules (HAVC minority co-production and the '
        + 'audiovisual incentive rebate). Strictly illustrative — actual decisions sit with HAVC, '
        + 'the line producer, and the auditor.',
      '', '— Aning Film');
    return lines.join('\n');
  }

  function updateConstellation(r, cov) {
    const C = themeColors();

    refs.svgCenterBudget.textContent = fmt(state.totalBudget);
    refs.svgCenterBudget.setAttribute('fill', C.paper);
    refs.svgCenterCoverage.textContent = Math.round(cov * 100) + '% covered';
    refs.svgCenterCoverage.setAttribute('fill', C.red);
    refs.svgCoverageRing.setAttribute('stroke-dasharray', `${CONST.ringCircum * cov} ${CONST.ringCircum}`);
    refs.svgCoverageRing.setAttribute('stroke', C.red);

    const nodeData = {
      secured: {
        val: r.securedAmount, on: r.securedAmount > 0,
        note: fmtPct(state.securedPct) + ' of budget · ' + fmt(r.securedAmount),
      },
      havc: {
        val: r.havc, on: r.havc > 0,
        note: r.havc > 0 ? 'indicative · discretionary' : 'minority · 50–85% band',
      },
      local: {
        val: r.local, on: r.local > 0,
        note: r.local > 0 ? 'follows HAVC approval' : 'unlocks alongside HAVC nod',
      },
      rebate: {
        val: r.rebate, on: r.rebate > 0,
        note: r.rebate > 0 ? '25% of qualifying spend'
          : state.projectType === 'short' ? 'shorts not rebate-eligible'
          : 'min Croatia spend ' + fmt(MIN_CROATIA_SPEND[state.projectType]),
      },
      extra: {
        val: r.extraRebate, on: r.extraRebate > 0,
        note: state.lowDevRegion ? '+5% · low-dev region' : 'toggle low-dev to claim',
      },
    };

    const vals = Object.values(nodeData).map((d) => d.val);
    const maxVal = Math.max(...vals, state.totalBudget * 0.4);
    const sizeOf = (v) => CONST.nodeBase + Math.sqrt(Math.max(0, v) / maxVal) * CONST.nodeGrow;

    for (const n of NODES) {
      const d = nodeData[n.id];
      const els = refs.svgNodes[n.id];
      const radius = sizeOf(d.val);

      els.halo.setAttribute('r', d.on ? radius + CONST.nodeBase * 0.5 : 0);
      els.halo.setAttribute('fill', C.red);
      els.circle.setAttribute('r', radius);
      els.circle.setAttribute('fill', d.on ? C.red : C.ink);
      els.circle.setAttribute('stroke', d.on ? C.red : C.rule);
      els.circle.setAttribute('stroke-width', d.on ? 0 : 1.5);

      els.val.textContent = d.on ? fmt(d.val) : '—';
      els.val.setAttribute('fill', d.on ? C.paper : C.muted);
      els.note.textContent = d.note;
      els.note.setAttribute('fill', C.muted);

      els.edge.setAttribute('stroke', d.on ? C.red : C.edge);
      els.edge.setAttribute('stroke-width', d.on ? 1.4 : 1);
      els.edge.setAttribute('opacity', d.on ? 0.9 : 0.45);
      if (d.on) els.edge.removeAttribute('stroke-dasharray');
      else els.edge.setAttribute('stroke-dasharray', '3 4');
    }
  }

  // ─── THEME ─────────────────────────────────────────────────────
  function applyTheme(name) {
    if (!VALID_THEMES.includes(name)) name = 'auto';
    currentTheme = name;
    document.body.classList.remove('theme-auto', 'theme-light', 'theme-dark');
    document.body.classList.add('theme-' + name);
    try { localStorage.setItem(THEME_STORAGE_KEY, name); } catch (_) {}
    if (refs.constSvg) { buildConstellation(); render(); }
  }
  function bootTheme() {
    let stored = 'auto';
    try { stored = localStorage.getItem(THEME_STORAGE_KEY) || 'auto'; } catch (_) {}
    applyTheme(stored);
  }

  // ─── CONSOLE COLLAPSE ──────────────────────────────────────────
  function updateConsoleToggleRead(cov) {
    if (!refs.consoleToggleRead) return;
    refs.consoleToggleRead.textContent = consoleExpanded ? 'controls' : Math.round(cov * 100) + '% covered';
  }
  function setConsoleExpanded(v, rebuild) {
    consoleExpanded = v;
    refs.console.classList.toggle('console--collapsed', !v);
    refs.consoleToggle.setAttribute('aria-expanded', v ? 'true' : 'false');
    try { localStorage.setItem(CONSOLE_STORAGE_KEY, v ? '1' : '0'); } catch (_) {}
    if (rebuild && refs.constSvg) { buildConstellation(); render(); }
  }

  // ─── OVERLAYS (crawl + dossier) — focus-trapped, Esc/backdrop ──
  function focusables(el) {
    return Array.from(el.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((n) => n.offsetParent !== null || n === document.activeElement);
  }
  function openOverlay(name, el, focusEl, useBackdrop) {
    if (ui.overlay) closeOverlay();
    ui.overlay = name;
    ui.returnFocus = document.activeElement;
    el.hidden = false;
    el.setAttribute('aria-hidden', 'false');
    refs.backdrop.hidden = !useBackdrop;
    document.body.classList.add('overlay-lock');
    requestAnimationFrame(() => {
      el.classList.add('is-open');
      (focusEl || el).focus();
    });
  }
  function closeOverlay() {
    const name = ui.overlay;
    if (!name) return;
    const el = refs.report;
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    el.hidden = true;
    refs.backdrop.hidden = true;
    document.body.classList.remove('overlay-lock');
    ui.overlay = null;
    if (ui.returnFocus && typeof ui.returnFocus.focus === 'function') ui.returnFocus.focus();
    ui.returnFocus = null;
  }

  function projectWord() {
    return ({ feature: 'feature', short: 'short', featureDocumentary: 'feature documentary' })[state.projectType];
  }
  function modeWord() {
    return state.mode === 'minority' ? 'minority co-production' : 'service production';
  }

  // ── Memo export — copy (rich + plain) and mailto ───────────────
  function copyRich() {
    const el = refs.memoDoc;
    if (!el) return false;
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) {}
    sel.removeAllRanges();
    return ok;
  }
  function fallbackCopyText(str) {
    const ta = document.createElement('textarea');
    ta.value = str;
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
    return ok;
  }
  function copyText(str) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(str).catch(() => fallbackCopyText(str));
      return true;
    }
    return fallbackCopyText(str);
  }
  function openMail() {
    const subj = encodeURIComponent(refs.memoSubject || 'Film financing');
    const body = encodeURIComponent(refs.memoText || '');
    window.location.href = `mailto:?subject=${subj}&body=${body}`;
  }
  function flashAction(btn, msg) {
    const span = btn.querySelector('span');
    if (!span || btn.dataset.busy) return;
    const orig = span.textContent;
    btn.dataset.busy = '1';
    span.textContent = msg;
    btn.classList.add('done');
    setTimeout(() => {
      span.textContent = orig;
      btn.classList.remove('done');
      delete btn.dataset.busy;
    }, 1600);
  }

  function setReportView(view) {
    const views = refs.reportViews.map((v) => v.dataset.reportView);
    const target = views.includes(view) ? view : 'memo';
    ui.reportView = target;
    refs.reportViews.forEach((v) => { v.hidden = v.dataset.reportView !== target; });
    refs.reportTabs.forEach((t) => {
      const on = t.dataset.reportTab === target;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }
  function openReport(view) {
    setReportView(view || 'memo');
    openOverlay('report', refs.report, refs.reportClose, true);
  }

  // ─── EVENT WIRING ──────────────────────────────────────────────
  function wireEvents() {
    refs.cycBtns.forEach((btn) => {
      btn.addEventListener('click', () => cycle(btn.dataset.cycle, 1));
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); cycle(btn.dataset.cycle, 1); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); cycle(btn.dataset.cycle, -1); }
      });
    });

    refs.rangeInputs.totalBudget.forEach((i) => i.addEventListener('input', (e) => setState({ totalBudget: parseInt(e.target.value, 10) })));
    refs.rangeInputs.securedPct.forEach((i) => i.addEventListener('input', (e) => setState({ securedPct: parseFloat(e.target.value) })));
    refs.rangeInputs.croatiaPct.forEach((i) => i.addEventListener('input', (e) => setState({ croatiaPct: parseFloat(e.target.value) })));

    setupInlineInput(refs.memoBudget,  'totalBudget', true,  80000, 6000000);
    setupInlineInput(refs.memoSecured, 'securedPct',  false,     5,     100);
    setupInlineInput(refs.memoCroatia, 'croatiaPct',  false,     0,     100);

    refs.consoleToggle.addEventListener('click', () => setConsoleExpanded(!consoleExpanded, true));

    $$('[data-report-trigger]').forEach((b) => b.addEventListener('click', () => openReport(b.dataset.reportTrigger)));
    $$('[data-report-tab]').forEach((b) => b.addEventListener('click', () => setReportView(b.dataset.reportTab)));

    $$('[data-memo-copy]').forEach((b) => b.addEventListener('click', () => {
      flashAction(b, copyRich() ? 'Copied ✓' : 'Press Ctrl+C');
    }));
    $$('[data-memo-copytext]').forEach((b) => b.addEventListener('click', () => {
      copyText(refs.memoText);
      flashAction(b, 'Copied ✓');
    }));
    $$('[data-memo-mail]').forEach((b) => b.addEventListener('click', openMail));

    refs.reportClose.addEventListener('click', closeOverlay);
    refs.backdrop.addEventListener('click', closeOverlay);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && ui.overlay) { e.preventDefault(); closeOverlay(); return; }
      if (e.key === 'Tab' && ui.overlay) {
        const el = refs.report;
        const f = focusables(el);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    // Continuous geometry → debounced rebuild on resize.
    let rt = null;
    window.addEventListener('resize', () => {
      if (rt) clearTimeout(rt);
      rt = setTimeout(() => { buildConstellation(); render(); }, 150);
    });
  }

  // ─── BOOT ──────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    refs.app             = $('#appRoot');
    refs.console         = $('#console');
    refs.consoleToggle   = $('#consoleToggle');
    refs.consoleToggleRead = $('#consoleToggleRead');
    refs.cycBtns         = $$('.cyc');
    refs.rangeInputs = {
      totalBudget: $$('input[type="range"][data-field="totalBudget"]'),
      securedPct:  $$('input[type="range"][data-field="securedPct"]'),
      croatiaPct:  $$('input[type="range"][data-field="croatiaPct"]'),
    };
    refs.displays = {
      subSecured:        $$('[data-display="subSecured"]'),
      subCroatia:        $$('[data-display="subCroatia"]'),
      coveragePct:       $$('[data-display="coveragePct"]'),
      coverageNote:      $$('[data-display="coverageNote"]'),
      coveragePotential: $$('[data-display="coveragePotential"]'),
    };
    refs.memoBudget  = $('#memoBudget');
    refs.memoSecured = $('#memoSecured');
    refs.memoCroatia = $('#memoCroatia');

    refs.memoDoc  = $('#memoDoc');

    refs.constSvg = $('#constSvg');
    refs.constHud = $('#constHud');

    refs.report      = $('#report');
    refs.reportClose = $('#reportClose');
    refs.reportTabs  = $$('.report-tab');
    refs.reportViews = $$('.report-view');

    refs.backdrop   = $('#backdrop');
    refs.liveStatus = $('#liveStatus');

    let storedConsole = null;
    try { storedConsole = localStorage.getItem(CONSOLE_STORAGE_KEY); } catch (_) {}
    setConsoleExpanded(storedConsole === null ? true : storedConsole === '1', false);

    bootTheme();      // applies theme → buildConstellation() + render()
    wireEvents();
  });
})();
