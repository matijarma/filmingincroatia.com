/* Film Financing Calculator · 2026 — vanilla app.
 *
 * Plain-JS state container + render function. No framework.
 * Wire-up done once at DOMContentLoaded; subsequent state changes
 * mutate the same DOM nodes in place — CSS transitions ride that
 * for the constellation animations.
 *
 * Depends on calc.js (already vanilla) for the financing maths.
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

  // ─── DOM REFS (filled on DOMContentLoaded) ─────────────────────
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const refs = {};
  const ui = { activeSheet: 'none' };

  // Right-slot panels (memo + truth) share one slot; one is visible at a time.
  const RIGHT_PANELS = ['memo', 'truth'];
  // Mobile popover sheets (project + modeRegion + coverage).
  const CONFIG_PANELS = ['project', 'modeRegion', 'coverage'];

  const SHEET_TITLES = {
    project: 'project controls',
    modeRegion: 'mode and region',
    coverage: 'coverage snapshot',
  };

  function isDesktop() {
    return window.matchMedia('(min-width: 1280px)').matches;
  }
  function isMobile() {
    return window.matchMedia('(max-width: 880px)').matches;
  }
  function isConfigSheet(name) { return CONFIG_PANELS.includes(name); }
  function isRightPanel(name)  { return RIGHT_PANELS.includes(name);  }

  function setDisplaysText(name, value) {
    (refs.displays[name] || []).forEach((el) => { el.textContent = value; });
  }

  function syncRangeGroup(inputs, value) {
    inputs.forEach((input) => {
      if (document.activeElement !== input) input.value = value;
    });
  }

  function closeSheets(returnFocusEl) {
    if (ui.activeSheet === 'none') return;
    ui.activeSheet = 'none';
    syncUi();
    if (returnFocusEl) returnFocusEl.focus();
  }

  function openSheet(name, triggerEl) {
    // On desktop, the right-slot panels (memo, truth) toggle docked state and
    // share the slot. Config popovers don't exist on desktop (controls live in
    // the sidepanel).
    if (isDesktop() && isConfigSheet(name)) return;
    ui.activeSheet = name;
    if (isConfigSheet(name) && triggerEl) positionConfigPopover(triggerEl);
    syncUi();
  }

  function toggleSheet(name, trigger) {
    if (ui.activeSheet === name) closeSheets(trigger);
    else openSheet(name, trigger);
  }

  function positionConfigPopover(triggerEl) {
    if (isDesktop()) return;
    const rect = triggerEl.getBoundingClientRect();
    // Anchor below the trigger. Phone CSS overrides this with center-align.
    refs.configPanel.style.setProperty('--popover-x', rect.left + 'px');
    refs.configPanel.style.setProperty('--popover-y', (rect.bottom + 8) + 'px');
  }

  function syncUi() {
    const desktop = isDesktop();

    // On desktop, config popovers don't apply — clear them if somehow open.
    if (desktop && isConfigSheet(ui.activeSheet)) ui.activeSheet = 'none';

    const memoActive  = ui.activeSheet === 'memo';
    const truthActive = ui.activeSheet === 'truth';
    const memoOpen   = !desktop && memoActive;
    const truthOpen  = !desktop && truthActive;
    const configOpen = !desktop && isConfigSheet(ui.activeSheet);

    // Desktop docking: only one right-panel docked at a time, else memo
    // remains the default presence (so the layout doesn't jump when nothing
    // is explicitly chosen).
    const memoDocked  = desktop && (memoActive || (!memoActive && !truthActive));
    const truthDocked = desktop && truthActive;

    refs.app.classList.toggle('memo-docked',  memoDocked);
    refs.app.classList.toggle('truth-docked', truthDocked);
    refs.app.classList.toggle('memo-open',    memoOpen);
    refs.app.classList.toggle('truth-open',   truthOpen);
    refs.app.classList.toggle('config-open',  configOpen);

    // Only lock body for substantial sheets (memo/truth) on mobile; popovers
    // keep the page interactive.
    document.body.classList.toggle('panel-lock', (memoOpen || truthOpen));

    // Panel visibility is CSS-driven via .memo-docked / .truth-docked /
    // .memo-open / .truth-open on .app. Here we only sync aria state.
    refs.memoPanel.setAttribute('aria-hidden',
      ((desktop && memoDocked) || memoOpen) ? 'false' : 'true');
    refs.truthPanel.setAttribute('aria-hidden',
      (truthDocked || truthOpen) ? 'false' : 'true');

    refs.memoClose.hidden  = desktop;
    refs.truthClose.hidden = desktop;

    refs.configPanel.setAttribute('aria-hidden', configOpen ? 'false' : 'true');
    refs.sheetBackdrop.hidden = desktop || !(memoOpen || truthOpen);

    refs.pillBtns.forEach((btn) => {
      const active = !desktop && btn.dataset.pill === ui.activeSheet;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-expanded', active ? 'true' : 'false');
    });

    refs.truthTriggers.forEach((btn) => {
      btn.setAttribute('aria-expanded', truthDocked ? 'true' : 'false');
    });

    refs.sheetSections.forEach((section) => {
      const active = configOpen && section.dataset.sheetSection === ui.activeSheet;
      section.hidden = !active;
    });

    refs.configTitle.textContent = configOpen
      ? (SHEET_TITLES[ui.activeSheet] || 'configuration')
      : 'configuration';
  }

  // ─── CONSTELLATION GEOMETRY ────────────────────────────────────
  // Two configurations: a landscape one for desktop/tablet, and a portrait
  // one for mobile so node labels stay legible. We rebuild the SVG on
  // breakpoint crossings.
  const CONST_DESKTOP = {
    W: 800, H: 900,
    cx: 400, cy: 450,
    ringR: 220,
    centerR: 84,
    ringStroke: 6,
    sizes: { kicker: 10, valueBig: 26, valueSmall: 11, nodeLabel: 9, nodeVal: 20, nodeNote: 9 },
  };
  const CONST_MOBILE = {
    W: 560, H: 720,
    cx: 280, cy: 360,
    ringR: 170,
    centerR: 68,
    ringStroke: 5,
    sizes: { kicker: 12, valueBig: 26, valueSmall: 12, nodeLabel: 11, nodeVal: 22, nodeNote: 10 },
  };
  let CONST = CONST_DESKTOP;
  CONST.ringCircum = 2 * Math.PI * (CONST.centerR + CONST.ringStroke);

  function pickConstConfig() {
    const conf = isMobile() ? CONST_MOBILE : CONST_DESKTOP;
    conf.ringCircum = 2 * Math.PI * (conf.centerR + conf.ringStroke);
    return conf;
  }

  const NODES = [
    { id: 'secured', label: 'Secured financing' },
    { id: 'havc',    label: 'HAVC financing' },
    { id: 'local',   label: 'Local grants' },
    { id: 'rebate',  label: 'Incentive rebate' },
    { id: 'extra',   label: 'Low-dev uplift' },
  ];

  function layoutNodes() {
    NODES.forEach((n, i) => {
      n.ang = -Math.PI / 2 + i * (2 * Math.PI / NODES.length);
      n.px = CONST.cx + Math.cos(n.ang) * CONST.ringR;
      n.py = CONST.cy + Math.sin(n.ang) * CONST.ringR;
    });
  }

  // Live theme-aware colour reads. CSS vars resolve through brand/colors_and_type.css.
  function themeColors() {
    const cs = getComputedStyle(document.body);
    const v = (name, fallback) => (cs.getPropertyValue(name).trim() || fallback);
    return {
      ink:    v('--ink',       '#2e2522'),
      paper:  v('--paper',     '#f4ede2'),
      dim:    v('--paper-dim', '#d6cebe'),
      muted:  v('--muted',     '#8a7e72'),
      rule:   v('--rule',      '#4a3b35'),
      red:    v('--red',       '#c14843'),
      edge:   v('--edge',      '#3c2f2a'),
      edgeOn: v('--edge-on',   '#6b554d'),
      nebulaA: v('--nebula-a', '#5a3a32'),
      nebulaB: v('--nebula-b', '#3a2a25'),
    };
  }

  // ─── SVG SETUP — runs on boot and on breakpoint cross ─────────
  function buildConstellation() {
    CONST = pickConstConfig();
    layoutNodes();

    const svg = refs.constSvg;
    svg.setAttribute('viewBox', `0 0 ${CONST.W} ${CONST.H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const C = themeColors();

    // Deterministic pseudo-random for the star field.
    const seed = (n) => {
      const x = Math.sin(n * 9301 + 49297) * 233280;
      return x - Math.floor(x);
    };

    const parts = [];
    const sz = CONST.sizes;

    parts.push(`
      <defs>
        <radialGradient id="vc-nebula" cx="50%" cy="50%" r="55%">
          <stop offset="0%"  stop-color="${C.nebulaA}" stop-opacity="0.55"/>
          <stop offset="60%" stop-color="${C.nebulaB}" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="${C.ink}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill="url(#vc-nebula)" />
    `);

    // Twinkling stars
    const STAR_COUNT = isMobile() ? 70 : 120;
    for (let i = 0; i < STAR_COUNT; i++) {
      const x = seed(i) * 100;
      const y = seed(i + 1000) * 100;
      const r = 0.4 + seed(i + 2000) * 1.4;
      const o = 0.15 + seed(i + 3000) * 0.55;
      const td = 2 + seed(i + 4000) * 4;
      const delay = -seed(i + 5000) * 6;
      parts.push(
        `<circle class="star" cx="${x}%" cy="${y}%" r="${r}" fill="${C.paper}" opacity="${o}">
          <animate attributeName="opacity"
            values="${o};${o * 0.3};${o}" dur="${td}s" begin="${delay}s"
            repeatCount="indefinite" />
        </circle>`
      );
    }

    // Orbit guide
    parts.push(
      `<circle cx="${CONST.cx}" cy="${CONST.cy}" r="${CONST.ringR}"
        fill="none" stroke="${C.rule}" stroke-width="1"
        stroke-dasharray="2 6" opacity="0.5" />`
    );

    // Edges from center to each node
    for (const n of NODES) {
      parts.push(
        `<line class="edge" id="edge-${n.id}"
          x1="${CONST.cx}" y1="${CONST.cy}" x2="${n.px}" y2="${n.py}"
          stroke="${C.edge}" stroke-width="1"
          stroke-dasharray="3 4" opacity="0.45" />`
      );
    }

    // Center node — coverage ring + inner disc + labels
    const cR = CONST.centerR;
    const cS = CONST.ringStroke;
    parts.push(`
      <circle cx="${CONST.cx}" cy="${CONST.cy}" r="${cR + cS + 2}"
        fill="none" stroke="${C.rule}" stroke-width="1" />
      <circle cx="${CONST.cx}" cy="${CONST.cy}" r="${cR + cS}"
        fill="none" stroke="${C.rule}" stroke-width="${cS}" />
      <circle class="coverage-ring" id="coverageRing"
        cx="${CONST.cx}" cy="${CONST.cy}" r="${cR + cS}"
        fill="none" stroke="${C.red}" stroke-width="${cS}"
        stroke-dasharray="0 ${CONST.ringCircum}"
        transform="rotate(-90 ${CONST.cx} ${CONST.cy})" />
      <circle cx="${CONST.cx}" cy="${CONST.cy}" r="${cR}"
        fill="${C.ink}" stroke="${C.rule}" stroke-width="1" />
      <text x="${CONST.cx}" y="${CONST.cy - 26}" text-anchor="middle"
        font-family="JetBrains Mono, monospace" font-size="${sz.kicker}"
        letter-spacing="0.14em" fill="${C.muted}"
        style="text-transform: uppercase;">target budget</text>
      <text id="centerBudget" x="${CONST.cx}" y="${CONST.cy + 4}"
        text-anchor="middle" font-family="Bricolage Grotesque, sans-serif"
        font-weight="800" font-size="${sz.valueBig}" letter-spacing="-0.025em"
        fill="${C.paper}">€1,200,000</text>
      <text id="centerCoverage" x="${CONST.cx}" y="${CONST.cy + 30}"
        text-anchor="middle" font-family="JetBrains Mono, monospace"
        font-size="${sz.valueSmall}" letter-spacing="0.06em" fill="${C.red}">0% covered</text>
    `);

    // Outer nodes — each is a group with halo / circle / labels
    for (const n of NODES) {
      const labelOffsetX = n.px > CONST.cx ? 30 : -30;
      const anchor = n.px > CONST.cx ? 'start' : 'end';
      parts.push(`
        <g id="node-${n.id}">
          <circle class="halo" cx="${n.px}" cy="${n.py}" r="0"
            fill="${C.red}" opacity="0.12" />
          <circle class="node-circle" cx="${n.px}" cy="${n.py}" r="14"
            fill="${C.ink}" stroke="${C.rule}" stroke-width="1.5" />
          <text x="${n.px + labelOffsetX}" y="${n.py - 6}"
            text-anchor="${anchor}" font-family="JetBrains Mono, monospace"
            font-size="${sz.nodeLabel}" letter-spacing="0.12em" fill="${C.muted}"
            style="text-transform: uppercase;">${n.label}</text>
          <text class="node-val" x="${n.px + labelOffsetX}" y="${n.py + 13}"
            text-anchor="${anchor}" font-family="Bricolage Grotesque, sans-serif"
            font-weight="700" font-size="${sz.nodeVal}" letter-spacing="-0.02em"
            fill="${C.muted}">—</text>
          <text class="node-note" x="${n.px + labelOffsetX}" y="${n.py + 30}"
            text-anchor="${anchor}" font-family="JetBrains Mono, monospace"
            font-size="${sz.nodeNote}" letter-spacing="0.04em" fill="${C.muted}">—</text>
        </g>
      `);
    }

    svg.innerHTML = parts.join('');

    // Cache references for fast per-frame mutation.
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

  // ─── INLINE INPUT WIDTH HELPER ─────────────────────────────────
  function syncInlineWidth(input) {
    input.style.width = `${input.value.length + 0.8}ch`;
  }

  function updateInlineInput(input, value, isMoney) {
    if (input === document.activeElement) return;
    input.value = isMoney
      ? value.toLocaleString('en-GB')
      : String(value);
    syncInlineWidth(input);
  }

  function setupInlineInput(input, field, isMoney, min, max) {
    input.addEventListener('focus', () => {
      input.value = isMoney
        ? String(state[field])
        : String(Math.round(state[field] * 100));
      syncInlineWidth(input);
      input.select();
    });

    input.addEventListener('blur', () => {
      input.value = isMoney
        ? state[field].toLocaleString('en-GB')
        : String(Math.round(state[field] * 100));
      syncInlineWidth(input);
    });

    input.addEventListener('input', () => {
      const raw = input.value.replace(/[^\d.-]/g, '');
      const n = parseFloat(raw);
      if (!isNaN(n)) {
        const clamped = Math.max(min, Math.min(max, n));
        const patch = isMoney
          ? { [field]: clamped }
          : { [field]: clamped / 100 };
        setState(patch);
      }
      syncInlineWidth(input);
    });
  }

  // ─── RENDER ────────────────────────────────────────────────────
  function render() {
    const r = computeFinancing(state);
    const cov = Math.min(1, (r.total + r.securedAmount) / state.totalBudget);

    refs.pChips.forEach((chip) => {
      chip.classList.toggle('active', chip.dataset.project === state.projectType);
    });

    refs.modeBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === state.mode);
    });

    refs.regionBtns.forEach((btn) => {
      const isActive = (btn.dataset.region === 'lowdev') === state.lowDevRegion;
      btn.classList.toggle('active', isActive);
    });

    syncRangeGroup(refs.rangeInputs.totalBudget, state.totalBudget);
    syncRangeGroup(refs.rangeInputs.securedPct, state.securedPct);
    syncRangeGroup(refs.rangeInputs.croatiaPct, state.croatiaPct);

    setDisplaysText('valBudget', fmt(state.totalBudget));
    setDisplaysText('valSecured', Math.round(state.securedPct * 100) + '%');
    setDisplaysText('valCroatia', Math.round(state.croatiaPct * 100) + '%');
    setDisplaysText('subSecured', fmt(r.securedAmount));
    setDisplaysText('subCroatia', fmt(r.croatiaSpend));

    setDisplaysText('coveragePct', Math.round(cov * 100) + '%');
    (refs.displays.coveragePct || []).forEach((el) => {
      el.classList.toggle('short', cov < 1);
    });
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

    const projectLabel = ({
      feature: 'feature',
      short: 'short',
      featureDocumentary: 'feature documentary',
    })[state.projectType];
    refs.memoProject.textContent = projectLabel;
    refs.memoMode.textContent = state.mode === 'minority'
      ? 'minority co-production'
      : 'service production';

    updateInlineInput(refs.memoBudget,  state.totalBudget,                   true);
    updateInlineInput(refs.memoSecured, Math.round(state.securedPct * 100), false);
    updateInlineInput(refs.memoCroatia, Math.round(state.croatiaPct * 100), false);

    const minSpend = MIN_CROATIA_SPEND[state.projectType];
    const isShort = state.projectType === 'short';
    const rows = [
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
            ? '25% of qualifying spend · base ' + fmt(r.eligibleSpend)
              + ' (capped at 80% of budget)'
            : (r.croatiaSpend < minSpend
                ? 'Below minimum Croatia spend (' + fmt(minSpend) + ')'
                : 'Needs ≥ 70% of Croatia spend secured'),
        amount: r.rebate,
      },
      {
        icon: 'fa-arrow-trend-up', title: 'Low-development uplift',
        note: state.lowDevRegion
          ? (r.extraRebate > 0
              ? '+5% extra on qualifying spend · low-dev region'
              : 'Activates once the base rebate qualifies')
          : 'Toggle region to “Low-dev” to claim +5%',
        amount: r.extraRebate,
      },
    ];

    refs.ledger.innerHTML = rows.map((row) => {
      const off = row.amount === 0;
      return `<div class="ledger-row">
        <div class="row-title ${off ? 'off' : ''}">
          <i class="fa-solid ${row.icon}"></i>${row.title}
        </div>
        <div class="row-note">${row.note}</div>
        <div class="row-amt ${off ? 'off' : ''}">${off ? '—' : fmt(row.amount)}</div>
      </div>`;
    }).join('');

    refs.totalAmt.textContent = fmt(r.total);
    refs.totalNote.textContent =
      fmtPct((r.total + r.securedAmount) / state.totalBudget)
      + ' of budget when added to secured';

    const gapShort = r.gap > 0;
    refs.gapLabel.innerHTML = gapShort
      ? '<i class="fa-solid fa-triangle-exclamation"></i>Budget gap remaining'
      : '<i class="fa-solid fa-check"></i>Budget fully covered';
    refs.gapLabel.classList.toggle('short', gapShort);
    refs.gapAmt.textContent = gapShort ? '−' + fmt(r.gap) : '✓';
    refs.gapAmt.classList.toggle('short', gapShort);
    refs.gapNote.textContent =
      'secured '   + fmt(r.securedAmount)
      + ' · potential ' + fmt(r.total)
      + ' · target '    + fmt(state.totalBudget);

    updateConstellation(r, cov);

    const activeNodes =
      (r.securedAmount > 0 ? 1 : 0) +
      (r.havc > 0 ? 1 : 0) +
      (r.local > 0 ? 1 : 0) +
      (r.rebate > 0 ? 1 : 0) +
      (r.extraRebate > 0 ? 1 : 0);
    const C = themeColors();
    refs.constHud.innerHTML =
      '<span><i class="fa-solid fa-circle" style="color:'
      + C.red + ';font-size:8px;"></i>'
      + activeNodes + '/5 sources active · '
      + Math.round(cov * 100) + '% covered'
      + (r.gap > 0 ? ' · gap ' + fmt(r.gap) : '')
      + '</span>';
  }

  function updateConstellation(r, cov) {
    const C = themeColors();

    refs.svgCenterBudget.textContent = fmt(state.totalBudget);
    refs.svgCenterBudget.setAttribute('fill', C.paper);
    refs.svgCenterCoverage.textContent = Math.round(cov * 100) + '% covered';
    refs.svgCenterCoverage.setAttribute('fill', C.red);
    refs.svgCoverageRing.setAttribute(
      'stroke-dasharray',
      `${CONST.ringCircum * cov} ${CONST.ringCircum}`,
    );
    refs.svgCoverageRing.setAttribute('stroke', C.red);

    const nodeData = {
      secured: {
        val: r.securedAmount, on: r.securedAmount > 0,
        note: fmtPct(state.securedPct) + ' of budget · ' + fmt(r.securedAmount),
      },
      havc: {
        val: r.havc, on: r.havc > 0,
        note: r.havc > 0
          ? 'indicative · discretionary'
          : 'minority co-prod · 50–85% band',
      },
      local: {
        val: r.local, on: r.local > 0,
        note: r.local > 0 ? 'follows HAVC approval' : 'unlocks alongside HAVC nod',
      },
      rebate: {
        val: r.rebate, on: r.rebate > 0,
        note: r.rebate > 0
          ? '25% of qualifying spend'
          : state.projectType === 'short'
            ? 'shorts not rebate-eligible'
            : 'min Croatia spend ' + fmt(MIN_CROATIA_SPEND[state.projectType]),
      },
      extra: {
        val: r.extraRebate, on: r.extraRebate > 0,
        note: state.lowDevRegion
          ? '+5% extra · low-development region'
          : 'toggle low-dev region to claim',
      },
    };

    const vals = Object.values(nodeData).map((d) => d.val);
    const maxVal = Math.max(...vals, state.totalBudget * 0.4);
    const sizeOf = (v) => 14 + Math.sqrt(Math.max(0, v) / maxVal) * 40;

    for (const n of NODES) {
      const d = nodeData[n.id];
      const els = refs.svgNodes[n.id];
      const radius = sizeOf(d.val);

      els.halo.setAttribute('r', d.on ? radius + 9 : 0);
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
      else      els.edge.setAttribute('stroke-dasharray', '3 4');
    }
  }

  // ─── THEME CONTROLLER ──────────────────────────────────────────
  const THEME_STORAGE_KEY = 'ffcTheme';
  const VALID_THEMES = ['auto', 'light', 'dark'];

  function applyTheme(name) {
    if (!VALID_THEMES.includes(name)) name = 'auto';
    document.body.classList.remove('theme-auto', 'theme-light', 'theme-dark');
    document.body.classList.add('theme-' + name);
    try { localStorage.setItem(THEME_STORAGE_KEY, name); } catch (_) {}
    refs.themeButtons.forEach((btn) => {
      const active = btn.dataset.theme === name;
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    // Constellation colors are read per-frame from CSS vars, so rebuild +
    // re-render to pick up the new theme without a stale defs.
    if (refs.constSvg) {
      buildConstellation();
      render();
    }
  }

  function bootTheme() {
    let stored = 'auto';
    try { stored = localStorage.getItem(THEME_STORAGE_KEY) || 'auto'; } catch (_) {}
    applyTheme(stored);
  }

  // ─── EVENT WIRING ──────────────────────────────────────────────
  function wireEvents() {
    refs.pChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        setState({ projectType: chip.dataset.project });
      });
    });

    refs.modeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        setState({ mode: btn.dataset.mode });
      });
    });

    refs.regionBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        setState({ lowDevRegion: btn.dataset.region === 'lowdev' });
      });
    });

    refs.rangeInputs.totalBudget.forEach((input) => {
      input.addEventListener('input', (e) => {
        setState({ totalBudget: parseInt(e.target.value, 10) });
      });
    });
    refs.rangeInputs.securedPct.forEach((input) => {
      input.addEventListener('input', (e) => {
        setState({ securedPct: parseFloat(e.target.value) });
      });
    });
    refs.rangeInputs.croatiaPct.forEach((input) => {
      input.addEventListener('input', (e) => {
        setState({ croatiaPct: parseFloat(e.target.value) });
      });
    });

    setupInlineInput(refs.memoBudget,  'totalBudget', true,  80000, 6000000);
    setupInlineInput(refs.memoSecured, 'securedPct',  false,     5,     100);
    setupInlineInput(refs.memoCroatia, 'croatiaPct',  false,     0,     100);

    refs.pillBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        toggleSheet(btn.dataset.pill, btn);
      });
    });

    refs.truthTriggers.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (isDesktop()) {
          // Desktop: toggle docked truth vs memo
          if (ui.activeSheet === 'truth') {
            ui.activeSheet = 'memo';
          } else {
            ui.activeSheet = 'truth';
          }
          syncUi();
        } else {
          toggleSheet('truth', btn);
        }
      });
    });

    refs.sheetClose.addEventListener('click', () => {
      const activePill = refs.pillBtns.find((btn) => btn.dataset.pill === ui.activeSheet);
      closeSheets(activePill);
    });
    refs.memoClose.addEventListener('click', () => {
      const activePill = refs.pillBtns.find((btn) => btn.dataset.pill === ui.activeSheet);
      closeSheets(activePill);
    });
    refs.truthClose.addEventListener('click', () => {
      const activePill = refs.pillBtns.find((btn) => btn.dataset.pill === ui.activeSheet);
      closeSheets(activePill);
    });

    refs.sheetBackdrop.addEventListener('click', () => {
      const activePill = refs.pillBtns.find((btn) => btn.dataset.pill === ui.activeSheet);
      closeSheets(activePill);
    });

    // Tap-outside-popover closes the config popover on mobile/tablet.
    document.addEventListener('click', (e) => {
      if (!isConfigSheet(ui.activeSheet)) return;
      const insidePopover = refs.configPanel.contains(e.target);
      const onPill = e.target.closest('.pill-btn');
      if (insidePopover || onPill) return;
      closeSheets();
    });

    refs.themeButtons.forEach((btn) => {
      btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
    });

    // Breakpoint-aware constellation rebuild.
    let lastMobile = isMobile();
    window.addEventListener('resize', () => {
      syncUi();
      // If the mobile popover was open, reposition (e.g. pill width changed).
      if (isConfigSheet(ui.activeSheet)) {
        const activePill = refs.pillBtns.find((btn) => btn.dataset.pill === ui.activeSheet);
        if (activePill) positionConfigPopover(activePill);
      }
      const nowMobile = isMobile();
      if (nowMobile !== lastMobile) {
        lastMobile = nowMobile;
        buildConstellation();
        render();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (ui.activeSheet === 'none') return;
      e.preventDefault();
      const activePill = refs.pillBtns.find((btn) => btn.dataset.pill === ui.activeSheet);
      closeSheets(activePill);
    });
  }

  // ─── BOOT ──────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    refs.app              = $('#appRoot');
    refs.memoPanel        = $('#memoPanel');
    refs.memoClose        = $('#memoClose');
    refs.truthPanel       = $('#truthPanel');
    refs.truthClose       = $('#truthClose');
    refs.truthTriggers    = $$('[data-truth-trigger]');
    refs.configPanel      = $('#configPanel');
    refs.configTitle      = $('#configTitle');
    refs.sheetClose       = $('#sheetClose');
    refs.sheetBackdrop    = $('#sheetBackdrop');
    refs.pillBtns         = $$('.pill-btn');
    refs.sheetSections    = $$('.sheet-section');
    refs.pChips           = $$('.p-chip');
    refs.modeBtns         = $$('.mode-btn[data-mode]');
    refs.regionBtns       = $$('.region-btn');
    refs.themeButtons     = $$('.theme-toggle [data-theme]');
    refs.rangeInputs = {
      totalBudget: $$('input[type=\"range\"][data-field=\"totalBudget\"]'),
      securedPct: $$('input[type=\"range\"][data-field=\"securedPct\"]'),
      croatiaPct: $$('input[type=\"range\"][data-field=\"croatiaPct\"]'),
    };
    refs.displays = {
      valBudget: $$('[data-display=\"valBudget\"]'),
      valSecured: $$('[data-display=\"valSecured\"]'),
      valCroatia: $$('[data-display=\"valCroatia\"]'),
      subSecured: $$('[data-display=\"subSecured\"]'),
      subCroatia: $$('[data-display=\"subCroatia\"]'),
      coveragePct: $$('[data-display=\"coveragePct\"]'),
      coverageNote: $$('[data-display=\"coverageNote\"]'),
      coveragePotential: $$('[data-display=\"coveragePotential\"]'),
    };
    refs.memoProject      = $('#memoProject');
    refs.memoMode         = $('#memoMode');
    refs.memoBudget       = $('#memoBudget');
    refs.memoSecured      = $('#memoSecured');
    refs.memoCroatia      = $('#memoCroatia');
    refs.ledger           = $('#ledger');
    refs.totalAmt         = $('#totalAmt');
    refs.totalNote        = $('#totalNote');
    refs.gapLabel         = $('#gapLabel');
    refs.gapAmt           = $('#gapAmt');
    refs.gapNote          = $('#gapNote');
    refs.constSvg         = $('#constSvg');
    refs.constHud         = $('#constHud');

    // bootTheme triggers buildConstellation + render; no need to call them again.
    bootTheme();
    wireEvents();
    syncUi();
  });
})();
