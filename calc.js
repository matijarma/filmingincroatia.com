/* Aning Film · Financing Calculator — shared calc engine.
 * Faithful port of the rules from the legacy filmincroatia.com calc.
 *
 * Inputs:
 *   projectType: "feature" | "short" | "featureDocumentary"
 *   totalBudget: € number
 *   securedPct:  0..1 (share of budget already locked in)
 *   croatiaPct:  0..1 (share of budget spent in Croatia)
 *   mode:        "service" | "minority"
 *
 * Output: { havc, local, rebate, extraRebate, total, gap, eligibility:{…} }
 */

const PROJECT_LABELS = {
  feature: 'Feature',
  short: 'Short',
  featureDocumentary: 'Feature Documentary',
};

const MIN_CROATIA_SPEND = {
  // Rebate-side Croatia-spend minimums per Pravilnik o izmjenama i dopunama
  // Pravilnika o poticanju ulaganja u proizvodnju audiovizualnih djela
  // (NN 9/2024), Art 5(7)(1).
  // NOTE: shorts are NOT rebate-eligible under the Pravilnik. The `short`
  // entry here is retained only as a sizing input for the HAVC minority
  // path (which does fund shorts via NN 95/2023 Art 30) — calcRebate
  // short-circuits for projectType === 'short' regardless of this value.
  feature: 250000,
  short: 40000,
  featureDocumentary: 60000,
};

// Practitioner reference bands for HAVC minority co-prod awards.
// NOT codified in the Pravilnik — HAVC awards are discretionary per the
// Umjetničko vijeće (NN 95/2023 Art 6–8). These bands are calibrated against
// Aning Film's review of 2024–2025 award rounds, anchored to HAVC's stable
// annual envelope (~€15M in 2026, minority share roughly flat in absolute
// terms over the past decade). Conservative on purpose.
const HAVC_RANGE = {
  feature:           { min: 30000, max: 75000 },
  featureDocumentary:{ min: 30000, max: 75000 },
  short:             { min: 15000, max: 50000 },
};

function calcHAVC(projectType, totalBudget, securedPct, croatiaPct) {
  // Lower bound: NN 95/2023 Art 31(2) requires min. 50% secured to apply.
  //
  // Upper bound at 85%: this is not a Pravilnik rule, it's the math + market
  // reality of a minority co-production. An "official minority Croatian
  // co-production" needs ≥15% Croatian share. Once a project is >85% secured,
  // either (a) the remaining gap is asked entirely from HAVC — out of
  // character for any European film fund, which doesn't come in to close a
  // final budget gap — or (b) the budget is enormous and the Croatian piece
  // is a tiny fraction, in which case the Croatian co-producer would still
  // need to lift it back to the 15% minority threshold. In practice the real
  // ceiling is closer to 70% secured; >85% is essentially theoretical.
  if (securedPct >= 0.85 || securedPct < 0.5) return 0;
  const croatiaSpend = totalBudget * croatiaPct;
  // NN 95/2023 Art 35(1): ≥60% of any HAVC grant must be spent in Croatia →
  // caps the grant at croatiaSpend / 0.6.
  const havcCapFromCroatia = croatiaSpend / 0.6;
  // Transparent generalisation of HAVC's discretionary award process. NOT a
  // statutory formula — HAVC's Umjetničko vijeće decides per project on
  // artistic / cultural merit. The shape (5% of budget base, +1% per point
  // of secured above 50%) is calibrated against 2024–2025 average minority
  // awards (~€40–45k per feature) and clamped into the practitioner range.
  const extraPts = Math.max(0, securedPct - 0.5) * 10;
  const baseFinancing = 0.05 * totalBudget + extraPts * 0.01 * totalBudget;
  const range = HAVC_RANGE[projectType] || { min: 0, max: 0 };
  const provisional = Math.min(baseFinancing, havcCapFromCroatia, range.max);
  return Math.max(provisional, range.min);
}

function calcLocalGrants(havc, securedPct, isMinority) {
  // Only available to minority co-productions with ≥75% secured.
  if (!isMinority || securedPct < 0.75) return 0;
  const min = 10000, max = 25000;
  const havcMin = 30000, havcMax = 75000;
  const pct = (havc - havcMin) / (havcMax - havcMin);
  const grant = min + pct * (max - min);
  return Math.max(min, Math.min(grant, max));
}

function calcRebate(projectType, totalBudget, croatiaPct, securedPct, lowDevRegion) {
  // Short films are not rebate-eligible. NN 9/2024 Art 5(7)(1) enumerates
  // feature, TV film, TV episode, documentary/animation — shorts are not
  // listed. Shorts can still apply for HAVC minority funding separately.
  if (projectType === 'short') {
    return { rebate: 0, extraRebate: 0, eligible: false, reason: 'short-ineligible' };
  }
  const croatiaSpend = totalBudget * croatiaPct;
  if (croatiaSpend < MIN_CROATIA_SPEND[projectType]) {
    return { rebate: 0, extraRebate: 0, eligible: false, reason: 'min-spend' };
  }
  // 70% of Croatian spend must be secured. The Pravilnik text reads
  // "70% sredstava predviđenih za pokrivanje troškova proizvodnje" — a
  // strict reading is 70% of total budget, but HAVC has no jurisdiction
  // over non-Croatian budget components and the operational practice is to
  // check 70% against the Croatian-spend portion. Otherwise foreign-led
  // productions (where the Croatian piece is a few % of a huge budget)
  // would face a meaningless test.
  if (securedPct * totalBudget < 0.7 * croatiaSpend) {
    return { rebate: 0, extraRebate: 0, eligible: false, reason: 'secured-vs-spend' };
  }
  // 2026 fix: rebate base = Croatian spend, CAPPED at 80% of total budget
  // (per Pravilnik Article 3 §3). Earlier model multiplied spend by 0.4 — that
  // significantly under-counted rebates in most scenarios.
  const eligibleSpend = Math.min(croatiaSpend, 0.8 * totalBudget);
  return {
    rebate: 0.25 * eligibleSpend,                                 // 25% standard
    extraRebate: lowDevRegion ? 0.05 * eligibleSpend : 0,         // +5% low-dev uplift
    eligible: true,
    eligibleSpend,
  };
}

function computeFinancing({ projectType, totalBudget, securedPct, croatiaPct, mode, lowDevRegion }) {
  const isMinority = mode === 'minority';
  const havc = isMinority
    ? calcHAVC(projectType, totalBudget, securedPct, croatiaPct)
    : 0;
  const local = calcLocalGrants(havc, securedPct, isMinority);
  const reb = calcRebate(projectType, totalBudget, croatiaPct, securedPct, lowDevRegion);
  const total = havc + local + reb.rebate + reb.extraRebate;
  const securedAmount = securedPct * totalBudget;
  const gap = Math.max(0, totalBudget - total - securedAmount);

  const elig = {
    havc: havc > 0,
    local: local > 0,
    rebate: reb.eligible,
    minSpendOk: totalBudget * croatiaPct >= MIN_CROATIA_SPEND[projectType],
    securedRange: securedPct >= 0.5 && securedPct < 0.85,
    croatiaCover: securedPct * totalBudget >= 0.7 * totalBudget * croatiaPct,
  };

  return {
    havc, local,
    rebate: reb.rebate,
    extraRebate: reb.extraRebate,
    eligibleSpend: reb.eligibleSpend || 0,
    total, gap,
    securedAmount,
    croatiaSpend: totalBudget * croatiaPct,
    eligibility: elig,
    isMinority,
  };
}

const eur = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'EUR',
  minimumFractionDigits: 0, maximumFractionDigits: 0,
});
const fmt = (n) => eur.format(Math.round(n));
const fmtPct = (n) => `${Math.round(n * 100)}%`;

Object.assign(window, {
  computeFinancing, fmt, fmtPct,
  PROJECT_LABELS, MIN_CROATIA_SPEND, HAVC_RANGE,
});
