# ECHOES — UE5 Technical Design

Target: **UE 5.5+** (Nanite, Lumen, World Partition, StateTree, MetaSounds all production-grade there). Single-player only — no replication anywhere in this design, which quietly saves months.

---

## 1. The central technical problem

"Three versions of one city, swappable in **< 0.5 s perceived**, on solo-dev budgets." Everything below serves that sentence.

**Chosen architecture: one World Partition world + runtime Data Layers per time-state, with a component layer for small per-actor deltas.** Rejected alternatives first, because the reasoning is the documentation:

| Approach | Why not |
|---|---|
| **Separate maps per state + seamless travel** | Travel latency (seconds, not sub-second) kills slip-as-combat-verb; triple-maintains every level; cross-state Glimpse becomes near-impossible. |
| **Level streaming sublevels per state (UE4 pattern)** | Works, but fights World Partition instead of using it; manual streaming volumes in a vertical city is self-inflicted pain; Data Layers are the modern version of exactly this. |
| **Everything as per-actor swaps (one level, components toggle three dressings)** | Scales terribly past a few hundred actors; every placed mesh needs logic; editor workflow (viewing "the Eve" alone) becomes miserable. |
| **Chosen: Data Layers (macro) + phase components (micro)** | Data Layers give per-state authoring *in-editor* (toggle a layer, see that hour), runtime activation states with a preload tier, and World Partition handles streaming. Components handle the last mile. |

### 1.1 Data layer scheme

- `DL_Shared` — ~60–70 % of all geometry: structural city, terrain, the Spine. **The delta-dressing rule from the design docs is what makes memory work** — states are dressings of shared bones, not three cities.
- `DL_Eve`, `DL_Now`, `DL_Hush` — per-state dressing, lighting rigs, encounters, NPCs.
- Runtime states used as a preload tier: **active state = `Activated`; adjacent slippable state = `Loaded`** (resident in memory, hidden, no tick); Hush = `Unloaded` until mid-game. A slip between Activated⇄Loaded layers is effectively a visibility/collision flip — same frame for streamed-in cells. The 0.5 s budget is spent on *transition presentation*, not on streaming.
- Memory target: **≤ 1.6× single-state cost** for two resident states (achievable iff delta-dressing discipline holds; this is a content rule enforced by review, not a tech feature).

### 1.2 The verticality problem (flagged risk)

World Partition's runtime grid is **XY-planar** — a vertical city stacks many districts into the same grid cells, so "stream by distance" degenerates. Mitigations, in order of preference:
1. **Multiple runtime grids / HLOD layers** with district actors assigned appropriately (WP supports multiple grids; tune cell size per grid).
2. **Level Instances per district** (authored as separate levels, placed in the WP world) so districts stream as coherent chunks; transitions between districts are elevators/gates — natural streaming chokepoints.
3. If 1+2 still fight: fall back to *one persistent level per district* connected by seamless-travel elevators, keeping Data Layers for states within each. Costs open-verticality vistas; saves the project.
Decision point: end of M0 (see [06](06-scope-and-milestones.md)).

## 2. Core systems map

| System | Layer | Notes |
|---|---|---|
| `UTimelineSubsystem` (UWorldSubsystem) | **C++** | Owns `ETimeState`, slip request validation (occupancy, Tether, Silence), Data Layer runtime-state orchestration, `OnStateShiftBegin/End` delegates. The heart. ~everything binds to it. |
| `UTimePhaseComponent` | **C++, BP-exposed** | For micro-delta actors: per-state mesh/material/collision/audio config, applied on shift. Registers with subsystem; no tick. |
| `UResonantComponent` | **C++, BP-exposed** | Cross-state synced objects: GUID-linked; transform/state mirrored on shift (event-driven, not continuous). Bells, plates, braziers, satchel drops. |
| Occupancy check | **C++** | On slip request: shape-sweep player capsule against target state's collision (Loaded-layer actors keep queryable collision on a dedicated trace channel, `ECC_OtherHour`). Cheap, robust, powers the Glimpse validity indicator too. |
| `UFactLedgerSubsystem` | **C++** | GameplayTag → value map; every quest/door/shortcut/NPC-stage fact. Single source of truth; trivially serializable. |
| Save system | **C++** | Custom `USaveGame`: fact ledger + per-state actor records keyed `(FGuid, ETimeState)` + player build. Doors opened in one state are just facts; nothing clever. |
| Quests/dialogue | **BP + DataTables** | Rows: id, speaker, state-mask, condition (FGameplayTagQuery), lines[], coda, effects(tags). Sparse soulslike dialogue needs no plugin — building/buying a branching-dialogue system would be scope theft. |
| Enemy AI | **StateTree** (+ BT where legacy examples help) | Phase-membership via tags (`Phase.Eve` etc.); perception filtered by current state; witnessed-loop logic is one StateTree per Eve-archetype. |
| Player/combat abilities | **GAS** — see §3 | Slip, slip-step, echo strike, statuses, cordial. |

## 3. Blueprint vs C++ (and the GAS question)

**Split rule: C++ owns invariants, Blueprint owns content.**

- **C++:** the five systems above, GAS attribute sets & ability base classes, animation-critical notifies (melee traces), save. Anything ticking, anything load-bearing, anything a BP cascade would make undebuggable.
- **Blueprint:** concrete abilities/weapons (subclassing C++ bases), encounters, level scripting, UI (UMG/CommonUI), NPC schedules, bosses (on C++ scaffolding).

**GAS: recommended yes, with eyes open.** Slip costs/cooldowns (Tether as an attribute), statuses (Fray/Silence/Toll as GameplayEffects), echo-strike (ability + GameplayCue), boss phases (tag-driven) map onto GAS almost embarrassingly well, and single-player GAS skips its hardest part (prediction/replication). Cost: 2–4 weeks of learning curve if new to it. **Fallback:** if M0 week-2 GAS friction is high, a hand-rolled `UAbilityComponent` + `UStatusComponent` covers this game's needs — the design needs ~8 abilities, not 800. Decide in M0, never revisit.

## 4. The slip, frame by frame

1. Input → `UTimelineSubsystem::RequestSlip(TargetState)`.
2. Validate: Tether pips, Silence tags, occupancy sweep on `ECC_OtherHour`. Fail → red-ghost feedback, soft buzz, done.
3. `OnStateShiftBegin` → input lock (~0.15 s), Niagara burst + **post-process world-dissolve material** (radial from player, 0.4–0.7 s) — the dissolve *is* the latency mask.
4. Mid-dissolve: Data Layers flip (`Activated`⇄`Loaded`); `UTimePhaseComponent`s apply; `UResonantComponent`s reconcile; lighting rig swap (§7); audio bus crossfade (§8).
5. Spawn player-echo actor in departed state (4 s lifetime, decoy AI-target, completes queued echo-strike).
6. `OnStateShiftEnd` → HUD state-glyph, control returns.

**Glimpse:** Loaded-layer actors within radius get stenciled into a custom-depth pass rendered as a ghost overlay via one post-process material; interactables/enemies additionally get rune-outline VFX. Budget: overlay actor cap (~150) + LOD floor. **Fallback (pre-committed, see risks):** audio-first Glimpse — spatialized other-hour soundscape + outlines on interactables only. Prototype both in M0; the fallback is genuinely evocative, not a consolation prize.

## 5. Combat implementation notes

- **Locomotion/animation:** Epic's **Game Animation Sample** (motion matching) for traversal locomotion; Fab melee packs + hand-polish for combat. Melee hits via `AnimNotifyState` sweep windows (own ~200-line component; skip heavyweight trace plugins). Motion Warping for attack tracking; standard soulslike root-motion discipline.
- **Enemies:** archetype budget in scope doc. Witnessed-loops: ambient Sequencer/spline loops + a `Witnessed` StateTree transition — cheap, huge atmosphere yield.
- **Wardens (bleed-through):** two pawns, one shared `UHealthPool` (via `UResonantComponent`-style GUID link). No cross-state tick sync — the *other* body idles as a Loaded-layer prop until visited. Smoke and mirrors; entirely sufficient.
- **Custodian arena-shifts:** the boss calls the same `RequestSlip` path with a `bBossAuthority` flag (skips occupancy for the *player* — arenas guarantee validity by construction). The Census Engine's metronome is a MetaSounds clock broadcasting beats the fight scripts against.

## 6. Rendering & performance

- **Lumen everywhere** — per-state lighting without baking three lighting scenarios is the entire reason this is feasible; do not mix in baked lighting. **Nanite** for the kitbashed vertical architecture; **VSM** shadows.
- Per-state lighting rig = DirectionalLight + SkyLight + ExponentialHeightFog + PP volume living in each state's Data Layer; slip swaps rigs, dissolve hides the pop. Eve: warm low sun, gold. Now: overcast ash, hard practicals. Hush: shadowless white, fog as geometry-eater.
- Targets: 60 fps @ 1440p on mid-range (4060-class); Steam Deck "runs honorably" (30) as a stretch. Perf gates at every milestone, not at the end.

## 7. Content pipeline

- **Kitbash-first environment art**: Fab/Megascans modular kits + trim sheets + heavy decal/vertex-paint deltas between states (Eve = clean pass, Now = grime pass, Hush = dissolve-material pass on the *same meshes* wherever possible). The delta-dressing rule again — it's an art-direction position, and it happens to be the memory budget.
- Characters: MetaHuman-adjacent for key NPCs is a trap (uncanny + heavy); stylized-realistic custom/Fab bases with strong silhouettes instead. Armor must accommodate the sternum-shard (design constraint from [04](04-characters.md)).
- **No VO.** Text + per-character vocalization palettes (breaths, hums, helm-sounds). Genre-authentic, localization-friendly, and removes an entire pipeline. (The Anchorite's triple-tense voice: one recorded whisper-pass allowed as the single exception, or fully synthesized in MetaSounds.)

## 8. Audio

MetaSounds is load-bearing, not garnish: **bells are additive sine stacks with inharmonic partials — procedural synthesis territory.** One MetaSound graph = every bell in Carillon, parameterized (size, damage, distance, state). Per-state ambient beds on control buses (Eve: consonant drones; Now: industrial hum; Hush: near-silence, heartbeat, the player's own sounds returned late). The slip crossfade is an audio *statement* — spend real time here; audio is carrying more of this game's identity per dollar than any other discipline.

## 9. Tooling & source control

- **Perforce Helix Core (free ≤ 5 users) preferred**; Git LFS acceptable solo with strict `.gitattributes` + locking. UE + plain Git will end in tears; decide day one.
- Editor QoL worth building early (each < a day): state-toggle viewport button (cycles Data Layer editor visibility), "audit shared-vs-state actor ratio" commandlet (enforces delta-dressing), fact-ledger debug panel, slip-anywhere cheat, per-state screenshot batcher for review.

## 10. Plugin manifest

| Plugin | Use | Verdict |
|---|---|---|
| Enhanced Input | All input | Yes (default) |
| Gameplay Ability System | Abilities/statuses | Yes, per §3 decision gate |
| Niagara | Slip VFX, echoes, Hush fog | Yes |
| MetaSounds | Bells, states, slip audio | Yes, core identity |
| Motion Warping | Melee tracking | Yes |
| Game Animation Sample | Locomotion (motion matching) | Yes, import & prune |
| CommonUI | Menus/HUD | Yes |
| StateTree | Enemy AI | Yes |
| Water | The Fathom | Yes, contained use |
| Significance Manager | Crowd/ambient LOD | Later (M2+) |
| PCG | Spur scaffolding/clutter | Optional, timebox it |
| MassEntity/MassAI | Crowds | **No** — this game has no crowds; vignettes instead |
| Marketplace dialogue/quest systems | — | **No** — DataTable system per §2 |
