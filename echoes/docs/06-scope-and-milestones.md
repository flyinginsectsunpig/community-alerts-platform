# ECHOES — Scope & Milestones

The honesty document. Estimates assume an experienced developer, full-time, comfortable in UE5 (add 30–50 % if UE5 is new; multiply by your real part-time fraction, then add 20 % because part-time context-switching is not free).

---

## 1. The headline

**The full game described in docs 01–05 — six districts, three states, seven bosses, three side threads — is a 4–6 year solo project. Do not build it solo. Build the vertical slice (§4), which is a 9–12 month solo project, then decide with evidence.**

The design docs are written *fully* so the slice cuts from something, not toward nothing. That's their function. The slice is the product until proven otherwise.

## 2. Milestones

### M0 — Mechanic proof (weeks 1–8)

Greybox only. One test ward, two states, ugly on purpose.

- Data Layer slip architecture running; slip < 0.5 s perceived; occupancy rule + Glimpse prototype (both variants: overlay and audio-first).
- Slip-step combat feel vs 3 dummy enemy types; Tether economy first pass.
- **Decision gates (write the answers down, never relitigate):** GAS vs custom abilities; Glimpse overlay vs audio-first; WP verticality strategy (grids / level instances / district maps — [05](05-ue5-technical-design.md) §1.2).
- **Kill criteria — respected, not renegotiated:** if by week 8 slipping mid-combat isn't *fun in greybox*, the mechanic doesn't earn a game. Pivot or stop. Greybox fun is the only signal that survives production; art will not save a verb that isn't fun naked.

### M1 — Vertical slice: **"The Unstruck Bell"** (months 3–8)

20–30 minutes, ship-quality in one beautiful corner. Contents:

| Included | Spec |
|---|---|
| Space | The Weld (one full ward + the Long Forge) + a sliver of the Tolls as approach |
| States | **Eve + Now only.** The Hush appears once, through a window, unenterable. Cheapest dread per dollar in the project. |
| Slip | Tiers I → II (the Mara unlock happens *in* the slice — the demo contains its own best moment) |
| Combat | 4 enemy archetypes (fray-hollow, Watchman, Cantor with Silence, Eve witnessed-loop) + 1 Warden mini-boss |
| Boss | Cast-Mother Sefa, full two-state fight |
| NPCs | Ambrose (hub), Mara (full slice arc + thread-1 opening beat), Vesper (one non-combat encounter — presence, not fight) |
| Systems | Bells/checkpoints, death/Shade, attunement, reforge (Long Forge), satchel, 3 weapons, fact-ledger saves |
| Excluded | Everything else. Enumerated exclusion is the deliverable's frame. |

### M2 — Demo hardening (months 9–12)

Menus/options/accessibility, save robustness, perf gates hit, difficulty passes with *external* playtesters (≥ 15 strangers), trailer + Steam page. **Exit: a public Steam demo.** This is the portfolio artifact, the pitch artifact, and the go/no-go evidence, in one.

### M3+ — Only after M2 evidence, choose a fork:

| Path | Shape | Estimate |
|---|---|---|
| **A — Portfolio complete** | Ship the demo as a self-contained short game; move on with an exceptional flagship piece. | Done at ~12 mo |
| **B — Funded team** | Demo → funding → 4–6 people. Full six-district game. | +2.5–3.5 yr, ~$1.5–3 M |
| **C — Solo full game, cut** | 3 districts (Tolls, Weld, Clockrow condensed; Lantern as finale ward), 2 states + Hush-as-finale, 4 bosses, thread 1 + reduced thread 2. | +2–2.5 yr solo — the *maximum* honest solo shape |

## 3. Risk register

| # | Risk | Severity | Mitigation / pre-committed cut |
|---|---|---|---|
| R1 | **3 states ≈ 3× environment art** — the project-killer | ☠︎ | Parallel-shards rule → delta-dressing (≥ 60 % shared geometry, enforced by audit commandlet); Hush is sparse *by fiction*; slice ships 2 states. The design already contains this mitigation — hold the line in content review. |
| R2 | **Soulslike combat quality bar** — the genre's audience punishes floaty melee mercilessly; this is the single most likely quality failure | ☠︎ | M0 kill criteria; motion matching + bought anims + polish budget concentrated on *player character first*; enemy count small and hand-tuned; if combat feel isn't reaching bar by M1-mid, tilt the game toward slip-puzzle/exploration weighting — the design survives that rebalance (combat leans on 4 slip levers, not on roster depth). |
| R3 | **WP verticality streaming** | High | Three-tier fallback pre-planned ([05](05-ue5-technical-design.md) §1.2); decision gated at M0; worst case (district maps + elevators) is fully acceptable. |
| R4 | **Glimpse rendering cost** | High | Audio-first fallback pre-committed and prototyped in M0; overlay is an upgrade, not a dependency. |
| R5 | **Cross-state save/persistence bugs** | Med | Everything is the fact ledger; no bespoke persistence paths; save-system tests from M1 day one, not M2. |
| R6 | **Boss count** (7 designed) | Med | Slice needs exactly 1 + a Warden. Path C ships 4. Bosses are the most expensive content type per minute — never build one speculatively. |
| R7 | **Per-state NPC writing multiplies** | Med | Sparse soulslike dialogue is the mitigation (short pools); casting rule caps it: only Ambrose + Vesper have full multi-state presence; no VO. |
| R8 | **Scope creep via the fiction being generative** (this doc set will keep suggesting features) | Med | The three pillars are a *rejection* tool; the enumerated slice exclusion list is contractual; new ideas go to a `POST-SLICE.md` graveyard file, unread until M2. |
| R9 | **Death-displacement frustration** (dying swaps your state) | Low | Toll-to-stay valve already designed; flagged as playtest-kill candidate — if testers hate it at M1, death becomes same-state and the fiction shrugs. |
| R10 | **Solo burnout** | ☠︎, chronically underrated | Milestones ≤ 4 months with shippable exits; M2 produces a public artifact whatever happens next; kill criteria are self-kindness, not self-doubt. The fork at M3 exists so that "stop after the demo" is a *success outcome*, in writing, from day one. |

## 4. What the slice proves (so the docs above earn their keep)

- R1/R3/R4 answered with running software, not arguments.
- The slip is fun in combat *and* traversal, or it isn't — publicly testable.
- The tone lands: Ambrose, one ward of environmental storytelling, and the Hush through a window either produce the feeling or they don't.
- One boss demonstrates the whole boss language (two-state fight, witnessed-loop pathos, resonant-object mechanics — Sefa carries all three).

Everything in documents 01–04 that isn't in the slice is **deliberately deferred, not deleted** — the full design exists precisely so that every cut is a cut *from* something coherent, and so that a funded Path B can re-expand without redesign.
