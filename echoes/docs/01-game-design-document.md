# ECHOES — Game Design Document

Systems-facing spec. World fiction lives in [02-worldbuilding](02-worldbuilding.md); this doc references it only where a mechanic needs its fiction.

---

## 1. Overview

- **Camera/control:** Third-person, over-shoulder-ish action camera, lock-on melee combat. Deliberate, stamina-driven, animation-committed (soulslike weight, not character-action speed).
- **Structure:** One contiguous vertical city, six districts, gated by boss "Custodians" and by slip-ability tiers (metroidvania-style). Interconnected shortcuts (elevators, bell-ropes, dropped ladders) — the map folds back on itself vertically.
- **Time-states:** Three superimposed versions of the city — **the Eve** (preserved golden past), **the Now** (surviving present), **the Hush** (arriving unmade future). The player slips between them. Most content ships in the Eve/Now pair; the Hush is deliberately sparse (see §3.6 and scope doc).
- **Session length target:** 25–40 hr full game; 20–30 min vertical slice.

## 2. Core loop

**Minute to minute:**
Explore → **Glimpse** (peek the other hour as an overlay) → route/puzzle decision → fight or avoid → **Slip** to reposition, solve, or gain combat advantage → harvest **Resonance** from the fallen → press on or bank.

**Per session (the soulslike ward loop):**
Push into hostile ward → find the fissures and learn the ward's two dressings → open a shortcut back (vertical: drop a ladder, free a counterweight elevator, cut a bell-rope) → attune a **Vesper Bell** (checkpoint) → spend Resonance → NPC beat → Custodian attempt.

**Per arc:**
Climb a district → Custodian falls → slip tier or key traversal tool unlocks → earlier districts partially re-open through new fissures (revisit value) → faction commitments narrow the ending space → **the Hush floodline rises** behind you at scripted plot beats (pressure without a real timer).

The loop must restate pillar 2 constantly: going *up* costs (tolls, permits, clean-hour checks at Escapement gates); going *down* is free and dangerous.

## 3. The Slip — mechanical specification

The slip is a **verb with grammar**, not a menu toggle. Four rules define it; every puzzle, encounter, and level-design trick is a sentence built from them.

### 3.1 The four rules

1. **Occupancy rule.** You cannot slip into solid matter. Holding the slip button raises the **Glimpse** — a ghost-overlay of the target state (geometry silhouettes, enemy positions, interactables) with a clear valid/invalid indicator on your own body. This is the puzzle grammar's backbone: a corridor open in the Eve is rubble in the Now; a vault sealed in the Now hasn't been built yet in the Eve.
2. **Carry rule.** Equipped gear and the **Anchored Satchel** (3 slots, upgradeable to 6) cross with you. Everything else stays. Carrying a world-object across states is a currency-like decision: take the warden's key from the Eve where it hangs unguarded, spend a satchel slot until you use it in the Now.
3. **Resonance rule (parallel shards).** States do **not** causally propagate. Moving a crate in the Eve does not move it in the Now — *except* for **resonant objects** (bell-metal, visibly rune-struck): move one anywhere, it moves everywhere. Resonant objects are the designer-placed "co-op between your own timelines" pieces: weight a pressure plate in the Eve to hold a gate in the Now; ferry a resonant brazier's fire between hours.
4. **Echo rule.** Slipping leaves a fading echo of you (~4 s) in the state you left. Enemies target it (decoy). Attacks in progress when you slip complete as echo-attacks in the old state (see Echo Strike, §4.4).

### 3.2 Resource: Tether

- Single slip resource. One bar, 3 pips base (Clarity stat adds pips).
- Free slip costs 1 pip. Slip-step (combat dodge) costs ½.
- Regenerates slowly out of combat; fast near bells and resonant objects; on-kill refund ("harvested hours").
- **Silence** (status, §4.6) locks the bar entirely — the anti-slip lever that keeps encounters honest.

### 3.3 Acquisition tiers (the metroidvania spine)

| Tier | Name | Grants | Acquired |
|---|---|---|---|
| I | Fissure-Walker | Slip only at fissures (designer-placed cracks in the hour); Glimpse near fissures | Prologue, the Fathom |
| II | Free Slip | Slip anywhere (occupancy rule permitting) at Tether cost; Glimpse anywhere | The Weld — Mara's questline |
| III | Heavy Slip | Carry momentum through (slip mid-fall/mid-sprint); resonant objects can be carried while moving | Clockrow Custodian |
| IV | The Seam's Regard | Drag a grappled enemy through with you; brief slow-world on slip entry | The Lantern approach — late |

Tier I existing at all is a level-design gift: the entire tutorial and first district work with *zero* free-slip edge cases.

### 3.4 Fissures and bells

- **Fissures:** visible cracks where the hours touch. Pre-Tier-II they are the only slip points; post-Tier-II they remain as free (no Tether) slips and as Glimpse amplifiers. Level designers control early-game state topology completely through fissure placement.
- **Vesper Bells:** checkpoint/bonfire analog. Ringing a bell **attunes** it: refills the healing cordial, banks Resonance, sets respawn, allows safe travel between attuned bells, and — diegetically — *re-tunes the local hour, resetting the ward's day*. Enemy respawn is thus in-fiction: the day loops back. Bells exist in all three states at once (they're resonant); a bell rung in any hour is rung in all.

### 3.5 Glimpse

Core non-combat verb and the environmental-storytelling machine. Hold to overlay the adjacent state: silhouette geometry, ghost NPCs mid-loop, item shimmer, enemy positions. The same nursery read three ways — cradle in the Eve, shrine in the Now, waterline in the Hush — is the game's storytelling unit. Budgeted tightly in tech (see [05](05-ue5-technical-design.md) §6); the fallback presentation is audio-first (you *hear* the other hour) with rune-outline VFX on interactables only.

### 3.6 The Hush (third state) — deliberately asymmetric

The Hush is not a third full world. It is:
- **Sparse:** near-empty, fog-eaten, geometry dissolving into negative space. Cheap to dress by design.
- **Dangerous:** Tether drains over time there; only Hush-wisps and Wardens live in it.
- **A solvent:** some barriers simply don't exist in the Hush (they've been unmade) — it's the game's "hard mode shortcut" state and the source of its best oh-no moments.
- **Gated:** unavailable until mid-game (post-Clockrow); most of the game is a two-state game, which is a scope decision wearing a fiction costume.

## 4. Combat

### 4.1 Feel targets

Deliberate and readable. Commit to swings; stamina governs offense and defense; poise/stagger matter; encounters are 1–4 enemies, lethal, hand-placed. Reference points: Dark Souls 1 pacing (not Elden Ring roster breadth, not Sekiro reflex ceiling).

### 4.2 Player kit

- **Weapons:** 10–12 total, each deep rather than broad (2 moveset branches + reforge tree). Classes: bell-hammer, verger's halberd, stitcher's knives, cast-blade, chime-staff (catalyst), ropewright's hook (traversal-flavored). Small-count philosophy is both soulslike-authentic and scope-honest.
- **Stamina** for attacks/dodges/blocks; **Tether** strictly for slips — two bars, two decisions.
- **Litanies:** 2–4 equipped passives (ring analog), many earned from side threads.
- **Cordial of Kept Hours:** estus analog; charges refill at bells; upgraded via bottled-hour caches. Drinking it is literally drinking time — flavor is free.

### 4.3 Slip-step

The signature dodge: a short phase through the adjacent hour. I-frames are diegetic — you are briefly *not in this hour*. Costs ½ Tether pip (not stamina), so spamming it starves your puzzle/traversal resource: one pool, real tradeoffs. Leaves a micro-echo (aggro flicker).

### 4.4 Echo Strike

Wind up a heavy attack, slip mid-swing: the echo completes the strike in the state you left while your real body arrives in the other. Skill expression, crowd-splitting, and the fantasy of fighting alongside your own ghost. Tuning lever: echo damage at 60–75%.

### 4.5 Enemy design levers

| Lever | Example |
|---|---|
| **Phase-bound** | Escapement Watchmen exist only in the Now; Hush-wisps only in the Hush. Slipping is a legal "flee" — but you arrive somewhere with its own problems. |
| **Witnessed loops** | Eve inhabitants replay their last golden day, docile until they *witness* you interact with their hour — then the loop breaks and they turn. Stealth-adjacent play without building a stealth system. |
| **Bleed-through (Wardens)** | Mini-bosses that exist in multiple states simultaneously and share a body: the Eve-heart heals the Now-body. Kill order across states is the fight. |
| **Silencers** | Choir Cantors chant **Silence** (locks Tether). Kill the Cantor or fight without your escape hatch. This lever is what stops slip-step from trivializing everything — use it firmly but not constantly. |
| **State-shifting arenas** | Custodians (bosses) steal the player's verb: the *arena* slips on the boss's phase change, not yours. |

### 4.6 Status effects

- **Fray** — temporal corrosion. On full bar: a *stutter* — your position rewinds ~2 s (to where you stood; disorienting, occasionally lethal near ledges). Resisted by Resolve.
- **Silence** — Tether locked. Short duration, loud telegraph.
- **Toll** — Resonance drains while afflicted (leeches, some Choir prayers).

### 4.7 Custodian bosses (one per district, roster in [02](02-worldbuilding.md))

Each Custodian must teach or subvert one slip rule. Flagship concepts:
- **Cast-Mother Sefa, the Unstruck Bell** (the Weld, vertical-slice boss): fought inside a foundry around a colossal bell mold. In the Now she is iron and grief; her Eve-echo works the same floor, oblivious — phase 2, she *witnesses* you, and both hours fight you with one health bar shared through the mold (a resonant object).
- **The Gilded Twins** (Terraces): duo boss split across the Eve and the Now. Each is trivial alone; damage taken by one enrages the other; you fight both by slipping mid-combo. The purest expression of the mechanic.
- **The Census Engine** (Clockrow): clockwork bulk that *imposes* state-shifts on the arena on a fixed audible schedule — the whole fight is fought to a metronome the player learns.

## 5. Death: Desynchronization

- On death you are not unmade — the clock misfiles you *again*. You reconstitute at your last attuned bell **in the other state**, and your dropped Resonance remains at the death site as a **Shade**: an echo of you that *fights back* (player rig + basic AI; cheap to build, memorable to fight).
- Defeat your Shade to reclaim everything. Die first and the older Shade dissipates (standard one-corpse rule).
- **Friction valve:** reconstituting in the *same* state costs a small Struck-Hours toll at the bell. The displacement rule is flavorful but will frustrate some players; the toll keeps it a choice, and the whole displacement mechanic is flagged as a playtest-kill candidate (see [06](06-scope-and-milestones.md), risk R9).

## 6. Progression

### 6.1 Attunement (leveling)

Spend **Resonance** at bells. Five stats, no dump stats:

| Stat | Governs |
|---|---|
| **Vigor** | HP, Fray bar length |
| **Burden** | Equip load, poise, stamina |
| **Craft** | Weapon scaling (physical arts) |
| **Clarity** | Tether pips, Glimpse range, chime-staff scaling |
| **Resolve** | Fray/Silence resistance, Shade strength when you die (your Shade scales with Resolve — dying with high Resolve makes reclaiming harder; a deliberate, slightly cruel, very on-theme twist) |

### 6.2 Gear progression

- **Reforging** at the Weld's Long Forge (unlocked by clearing it — diegetic feature unlock): bell-metal shards → ingots → heartmetal, +1..+7.
- **Chime-marks** (rare, from Wardens): respec, or strike a weapon *resonant* (its buffs persist across slips — late-game QoL as an upgrade).
- No armor tiers treadmill: armor is few, distinct, mostly fashion + poise/burden tradeoffs.

### 6.3 The real progression is the map

Slip tiers, shortcuts, faction gates, and district keys are the spine. Numbers go up modestly; *possibility* goes up sharply. Revisit hooks: each new tier converts known spaces into new spaces (a Tier-III fall-slip turns every learned drop into a route).

## 7. Economy

- **Resonance** — XP-currency, dropped by enemies (they bleed hours), lost on death, Shade-recoverable.
- **Struck Hours** — the Order's minted coin. Merchants, tolls, bribes, bell re-sync fees. *Not* lost on death; the fiscal system is stable even when you aren't.
- **Bell-metal / heartmetal** — upgrade materials, world-placed and Warden-dropped (exploration-rewarding, not farmable).
- In-fiction the poor are paid *in hours* and taxed in them too; vendors in the Tolls quote prices in "minutes" for flavor while transacting in Struck Hours. One currency system, two dialects.

## 8. Interaction & dialogue systems

- **No cinematic camera locks.** Conversations happen in-world, over-shoulder, interruptible; the city keeps moving. (Also removes an entire cutscene pipeline — pillar 3 and the scope doc agree.)
- **Dialogue:** line pools per NPC per state, gated by GameplayTag conditions (progress facts, faction standing, items held, current time-state). No branching trees deeper than 2; soulslike NPCs *volunteer sequences*, they don't negotiate. Full style guide with samples in [03](03-narrative.md).
- **Item lore:** every item description is a lore vector (samples in [03](03-narrative.md)). This is the cheapest worldbuilding channel per word in the genre — budget writing time accordingly.
- **No quest log prose.** A minimal "Rumors" list (place-names only, e.g. *"The Cast-Mother has not left the Long Forge in sixty-one years."*) plus NPC repetition and environmental signposting. Glimpse doubles as the hint system: the other hour often shows the way.

## 9. UX notes specific to the slip

- Slip must resolve in **< 0.5 s perceived** (hard requirement; drives the entire tech design in [05](05-ue5-technical-design.md)).
- Persistent minimal HUD state-indicator (color grade + a small glyph: gold / ash / white). Colorblind-safe: each state also has a distinct audio bed and vignette shape.
- Occupancy-invalid feedback must be instant and kind (ghost turns red, soft chime-buzz), never a fail state.
- Teach rule 3 (parallel shards) *explicitly and early* — players will assume butterfly-effect causality because other time games trained them to. Ambrose states it in the tutorial: *"Nothing you mend in the Eve will mend the Now. They are not before and after, child. They are brothers."* If players leave the Fathom still expecting causality, the tutorial has failed — playtest gate.
