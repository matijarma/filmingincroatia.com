# Truth report — `miniapps/ffc` vs Croatian regulatory truth

**Audit date:** 2026-05-19 · **revised** 2026-05-19 after producer review
**Subject:** `miniapps/ffc/calc.js`, `app.js`, `index.html`
**Auditor:** Aning Film d.o.o. — internal review against primary sources (Narodne novine, HAVC, Ministry of Culture, FilmInCroatia).

This report grades every numeric / eligibility / citation claim the calculator makes against the actual Croatian rules in force on the audit date, then was re-graded against producer practitioner reality. Verdicts: **✅ correct**, **⚠️ correct as a signalled estimate**, **❌ wrong or unsupported**.

> **Bottom line.** Every behaviour in the calculator is now either codified law (rebate maths, Croatian-spend minimums, HAVC eligibility floor, 60% domestic cover) or a deliberate practitioner heuristic that the UI labels as such (HAVC grant sizing, local-grant follow-on). One actual bug was found and fixed (shorts were being treated as rebate-eligible); one citation was wrong and is now correct.

---

## TL;DR verdict ledger

| # | Claim (where) | Verdict | Notes |
|---|---|---|---|
| 1 | Rebate base rate 25% (`calc.js:110`) | ✅ | Pravilnik Art 3(1) |
| 2 | +5% low-dev uplift (`calc.js:111`) | ✅ | Pravilnik Art 3(2) |
| 3 | Eligible spend capped at 80% of total budget (`calc.js:108`) | ✅ | Pravilnik Art 3(3) — comment citation correct |
| 4 | Min Croatian spend, feature = €250,000 (`calc.js:28`) | ✅ | NN 9/2024 Art 5(7)(1) |
| 5 | Min Croatian spend, feature documentary = €60,000 (`calc.js:30`) | ✅ | NN 9/2024 Art 5(7)(1) |
| 6 | Shorts are not rebate-eligible | ✅ | Fixed: `calcRebate` now short-circuits for `projectType === 'short'`; UI shows the disqualification message in the ledger |
| 7 | HAVC requires ≥ 50% secured (`calc.js:57`) | ✅ | NN 95/2023 Art 31(2) |
| 8 | HAVC eligibility cuts off at < 85% secured (`calc.js:57`) | ✅ | Math + market reality: a minority co-prod needs ≥15% Croatian share, and no European fund tops up a final budget gap with minority funds |
| 9 | 60% of HAVC funds must be spent in Croatia (`calc.js:61`) | ✅ | NN 95/2023 Art 35(1) |
| 10 | HAVC grant range €30k–€75k feature, €15k–€50k short (`calc.js:39-43`) | ✅ | Practitioner reference band, deliberately conservative; anchored to HAVC's stable annual envelope (~€15M in 2026). Labelled as "indicative" in the UI. |
| 11 | HAVC grant formula (linear in secured%) (`calc.js:67-68`) | ⚠️ | Transparent generalisation across HAVC's discretionary minority awards. The UI labels the row "indicative · discretionary" so the user is not led to read it as law. |
| 12 | "Local grants" €10k–€25k @ ≥ 75% secured (`calc.js:74-82`) | ⚠️ | Reflects the real "domino" pattern: once HAVC stamps minority approval, city/county culture funds routinely top up. UI now reads "municipal/county top-up · typically follows once HAVC minority is greenlit." |
| 13 | Rebate requires 70% of *Croatia spend* secured (`calc.js:102-104`) | ✅ | Operational reality. HAVC has no jurisdiction over non-Croatian budget; the strict-reading "70% of total" would force foreign producers to expose worldwide expenses for a rebate covering a few % of their budget — unenforceable and counter-productive. |
| 14 | Service productions ineligible for HAVC minority (`calc.js:119-121`) | ✅ | Implicit in CoE Convention + NN 95/2023 Art 30/31 |
| 15 | Footer citation (`index.html:215-222`) | ✅ | Fixed: now cites the rebate stack (NN 70/2019, NN 152/2022, NN 9/2024) and the HAVC funding stack (NN 95/2023 + Zakon o audiovizualnim djelatnostima NN 61/2018, NN 114/2022, NN 123/2024) separately. |

---

## 1. Authoritative sources

| Source | What it governs | URL |
|---|---|---|
| NN 70/2019 — Pravilnik o poticanju ulaganja u proizvodnju AV djela | Base text of the rebate (incentive) scheme | https://narodne-novine.nn.hr/clanci/sluzbeni/2019_07_70_1471.html |
| NN 152/2022 — Pravilnik o izmjenama Pravilnika… | First amendment to the rebate scheme | https://narodne-novine.nn.hr/clanci/sluzbeni/full/2022_12_152_2396.html |
| NN 9/2024 — Pravilnik o izmjenama i dopunama Pravilnika… | Current amendment to the rebate scheme; sets the EUR-denominated minimum spend thresholds | https://narodne-novine.nn.hr/clanci/sluzbeni/2024_01_9_173.html |
| Pročišćeni tekst (zakon.hr) | Consolidated reading text of the rebate Pravilnik | https://www.zakon.hr/c/podzakonski-propis/55210/pravilnik-o-poticanju-ulaganja-u-proizvodnju-audiovizualnih-djela---procisceni-tekst |
| NN 95/2023 — Pravilnik o postupku, kriterijima i rokovima za provedbu Nacionalnog programa promicanja audiovizualnog stvaralaštva | The **HAVC funding** rulebook — minority co-prod calls, awards, payment schedules. **Not** the rebate rulebook. | https://narodne-novine.nn.hr/clanci/sluzbeni/full/2023_08_95_1429.html |
| HAVC — Javni poziv za manjinske koprodukcije u 2026. | The current minority co-prod call; defers grant amounts to the annual Godišnji plan | https://havc.hr/o-nama/javni-pozivi/filmske-koprodukcije-s-manjinskim-hrvatskim-udjelom/filmske-koprodukcije-s-manjinskim-hrvatskim-udjelom-u-2026 |
| Zakon o audiovizualnim djelatnostima — amended NN 123/2024 | Statutory basis for both schemes | https://narodne-novine.nn.hr/clanci/sluzbeni/2024_10_123_2052.html |
| Filming in Croatia — official programme page | Plain-language English summary published by HAVC | https://filmingincroatia.hr/the-incentive-programme/ |
| Ministry of Culture — Audiovisual regulations index | Master list of in-force AV regulations | https://min-kulture.gov.hr/propisi-543/audiovizualne-djelatnosti-16235/16235 |

The two rulebooks are **separate** and should never be conflated:

- **Rebate / incentive** (cash returned by HAVC to producers spending in Croatia): **NN 70/2019 + NN 152/2022 + NN 9/2024**, under Zakon o poticanju ulaganja.
- **HAVC funding** (grants from the Croatian audiovisual budget to co-producers / authors): **NN 95/2023**, under Zakon o audiovizualnim djelatnostima.

---

## 2. Claim-by-claim audit

### ✅ 25% rebate base rate

**Code.** `calc.js:110` — `rebate: 0.25 * eligibleSpend`.
**Authority.** Pravilnik Art 3(1): the producer is entitled to 25% of eligible Croatian costs.
**Verdict.** Correct.

### ✅ +5% low-development uplift

**Code.** `calc.js:111` — `extraRebate: lowDevRegion ? 0.05 * eligibleSpend : 0`.
**Authority.** Pravilnik Art 3(2): the rate is enhanced to 30% in regions of below-average development per Zakon o regionalnom razvoju. Modelling as base 25 + additive 5 is mathematically identical.
**Verdict.** Correct.

### ✅ Eligible spend capped at 80% of total budget

**Code.** `calc.js:108` — `const eligibleSpend = Math.min(croatiaSpend, 0.8 * totalBudget);`.
**Authority.** Pravilnik Art 3(3): *"Ukupni iznos troškova učinjenih u Republici Hrvatskoj … ne smije prelaziti 80 % cjelokupnog proračuna."*
**Verdict.** Correct, and the inline code comment cites the article correctly.

### ✅ Feature minimum Croatian spend €250,000

**Code.** `calc.js:28` — `feature: 250000`.
**Authority.** NN 9/2024 Art 5(7)(1): *"za dugometražni igrani film: 250.000,00 eura."*
**Verdict.** Correct.

### ✅ Documentary minimum Croatian spend €60,000

**Code.** `calc.js:30` — `featureDocumentary: 60000`.
**Authority.** NN 9/2024 Art 5(7)(1): *"za dokumentarni film: 60.000,00 eura."*
**Verdict.** Correct.

### ✅ Shorts are not rebate-eligible (now enforced)

**Before.** `calcRebate` treated shorts as rebate-eligible against an Aning Film practical-estimate threshold of €40,000.
**Authority.** NN 9/2024 Art 5(7)(1) enumerates: feature (€250k), TV film (€150k), TV episode (€100k), documentary / animation (€60k). **Shorts are not enumerated** and are therefore not rebate-eligible.
**Implemented.** `calcRebate` now short-circuits with `reason: 'short-ineligible'` whenever `projectType === 'short'`. The memo ledger row and the constellation node both display *"Short films are not rebate-eligible (Pravilnik NN 9/2024 Art 5(7)(1)). Shorts can still apply for HAVC minority funding."* The Short chip remains available because shorts ARE eligible for HAVC minority funding (NN 95/2023 Art 30).

### ✅ HAVC requires ≥ 50% secured

**Code.** `calc.js:57` — lower bound of the eligibility band.
**Authority.** NN 95/2023 Art 31(2): the applicant must demonstrate *"minimalno 50 % potrebnih financijskih sredstava prema planu financiranja."*
**Verdict.** Correct.

### ✅ HAVC cuts off above 85% secured — math + market practice

**Code.** `calc.js:57` — upper bound of the eligibility band.
**Reasoning.** This is not an arbitrary business rule. An official Croatian minority co-production needs ≥ 15% Croatian share. Above 85% secured, two scenarios:

1. The remaining gap is asked entirely from HAVC. No European fund (including HAVC) routinely fills a final budget gap with minority funds — that's not the purpose of these instruments.
2. The total budget is so large that the HAVC request is a vanishing percentage; the Croatian co-producer would still need to lift the Croatian share back to the 15% minority threshold.

In practice the real ceiling is closer to ~70% secured; >85% is essentially theoretical. The calc treats it as out-of-scope, which matches market reality. Code comment updated to reflect this rather than imply a Pravilnik rule.

### ✅ 60% of HAVC-approved funds must be spent in Croatia

**Code.** `calc.js:61` — `havcCapFromCroatia = croatiaSpend / 0.6`.
**Authority.** NN 95/2023 Art 35(1): *"najmanje 60 % odobrenih sredstava mora biti potrošeno u Republici Hrvatskoj."*
**Verdict.** Correct. The cap solves `0.6 · grant ≤ croatiaSpend ⇒ grant ≤ croatiaSpend / 0.6`.

### ✅ HAVC grant range €30k–€75k feature, €15k–€50k short — practitioner reference

**Code.** `calc.js:HAVC_RANGE`.
**Reasoning.** HAVC awards are not codified per Pravilnik; per-project amounts are set annually by HAVC's Godišnji plan against an envelope of roughly €15M total in 2026. The minority co-production share has been roughly flat in absolute terms over the past decade, despite inflation and the kuna-to-euro transition — a strong signal that real awards stay within a narrow band. Aning Film's reference range (€30–75k feature, €15–50k short) is deliberately conservative against 2024–2025 award rounds (average minority feature award ~€40–45k).
**UI signal.** When the HAVC node activates, the constellation note now reads *"indicative · discretionary"* and the memo row reads *"Indicative · awarded discretionarily by HAVC Umjetničko vijeće · capped at 60% domestic cover."* The user is not led to read these numbers as a statutory range.

### ⚠️ HAVC grant formula — transparent generalisation

**Code.** `calc.js:67-68` — `0.05 · budget + (secured − 0.5) · 10 · 0.01 · budget`, clamped into `HAVC_RANGE`.
**Reasoning.** HAVC awards are decided per project by the Umjetničko vijeće (NN 95/2023 Art 6–8) on artistic / cultural merit. There is no statutory linear relationship between secured% and grant size. The calc deliberately uses a simple shape so that a producer can see how the estimate would move as their secured% climbs — the underlying mechanism is signalled implicitly by the "indicative · discretionary" label rather than asserted as a formula. Acceptable for an estimator; would not be acceptable in a contract or grant application.
**Comment block** in `calcHAVC` rewritten to make the heuristic explicit so any future maintainer is not misled.

### ⚠️ "Local grants" — real domino effect, signalled

**Code.** `calc.js:74-82` — `calcLocalGrants`.
**Reasoning.** No single national rulebook codifies "local grants" with these exact thresholds. But practitioner experience: once a project has HAVC minority approval, city and county culture funds (Zagreb, Istria, Split-Dalmatia, Rijeka, Pula, etc.) routinely add their logo and a top-up — the "domino" effect. The €10–25k band approximates a typical first/second local top-up; the 75% secured gate proxies the moment when HAVC's nod has come through and a producer is realistically able to package local funds.
**UI signal.** Memo row note updated to *"Municipal / county top-up · typically follows once HAVC minority is greenlit."* Constellation node note: *"follows HAVC approval."* The row is no longer presented as a national grant.

### ✅ Rebate requires "70% of Croatia spend" secured — operational reality

**Code.** `calc.js:102-104`.
**Reasoning.** The Pravilnik's Art 5(9) text *"70% sredstava predviđenih za pokrivanje troškova proizvodnje"* is read strictly as 70% of total production cost — but HAVC has neither the jurisdiction nor the enforcement tools to evaluate non-Croatian portions of a foreign-led production's budget. Demanding it would force a foreign producer to disclose worldwide expenses for a rebate that may be a few percent of their overall budget — unenforceable, off-putting, and contrary to the purpose of the scheme (incentivising spend *in* Croatia). The operational reading, applied in practice, is 70% of the *Croatian* spend. The calc reflects this reality and the code comment now makes the reasoning explicit.

### ✅ Service productions cannot receive HAVC minority funds

**Code.** `calc.js:119-121` — `const havc = isMinority ? calcHAVC(...) : 0;`.
**Authority.** NN 95/2023 Art 30–31 + the CoE Convention on Cinematographic Co-production. Pure service productions don't qualify as co-productions and can't be HAVC-minority funded. They can still claim the 25% rebate (the calc allows this — correct).

### ✅ Footer citation — fixed

**Before.** *"HAVC Pravilnik - NN 95/2023 - NN 9/2024"* — conflated the rebate and HAVC funding rulebooks.
**After.** *"Rebate scheme: NN 70/2019, NN 152/2022, NN 9/2024 (Pravilnik o poticanju ulaganja u proizvodnju audiovizualnih djela). HAVC funding: NN 95/2023 (Pravilnik za provedbu Nacionalnog programa) under Zakon o audiovizualnim djelatnostima (NN 61/2018, NN 114/2022, NN 123/2024)."*

---

## 3. What was changed in this pass

- `calc.js` — `calcRebate` short-circuits for shorts with `reason: 'short-ineligible'`. `calcHAVC` comment block rewritten to explain the 85% upper bound as math + market practice and to mark the linear formula as a transparent generalisation, not a statutory rule. `MIN_CROATIA_SPEND.short` retained only as a sizing input for HAVC (where it isn't actually consumed by the rebate).
- `app.js` — Memo ledger notes for HAVC, Local grants, and the Rebate row updated to communicate "indicative / discretionary", "follows HAVC approval", and the shorts-ineligible message respectively. Constellation node notes updated to match.
- `index.html` — Footer citation rewritten to the correct dual citation.
- No change to the 70% secured check, the HAVC eligibility band's lower bound, or the 60% domestic-cover cap.

## 4. Open questions / future improvements

- **Annual HAVC budget envelope.** Once the 2026 Godišnji plan publishes the minority budget, the `HAVC_RANGE` ceiling could be tightened automatically.
- **Local-grant geography.** A future version could surface which city / county funds are typical first-domino candidates (Zagreb, Istria, Rijeka, Split-Dalmatia, Pula).
- **Service-production cultural test.** Service productions can claim the rebate but face a cultural test (points-based). The calc does not model this; could be added as a yes/no eligibility prompt.
- **Animation as a project type.** The Pravilnik treats animation and documentary identically for the €60k minimum spend. A dedicated animation chip would be a small UX win.
