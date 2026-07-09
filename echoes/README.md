# ECHOES

*An action RPG about a city that rations time.*

**Genre:** Third-person action RPG (soulslike combat/structure, metroidvania gating)
**Engine:** Unreal Engine 5 (5.5+)
**Team:** Solo / small team — see scope plan before believing anything else in these docs
**Status:** Pre-production design

---

## One paragraph

Carillon is a city built upward out of a drowned chasm, because in Carillon clean time rises like heat and the rich live on top of it. Sixty-one years ago, to erase a revolution, the ruling Winding Order rang a bell meant to unmake a single day — and cracked the city into three superimposed time-states instead. You are the Unhoured: a corpse the great clock failed to file, able to slip between the city's three hours. You climb. The silence climbs behind you.

## The three pillars

Every design decision in these documents must serve at least one of these. If a feature serves none, cut it.

1. **The city is a clock.** Verticality, architecture, sound, and economy all express one machine. Traversal is legible: up is power, down is decay. Every district is a gear.
2. **Time is class.** The timeline slip is not a gimmick bolted onto a setting — the setting *is* the mechanic. Height = temporal purity = social rank. Every system (combat, economy, quests) restates this.
3. **Say less.** Sparse, weighty dialogue. The world answers questions before NPCs do. No quest markers, no exposition dumps, no cinematic lockboxes. If the player can learn it by slipping between hours and looking, no one says it aloud.

## Document map

| Doc | Contents |
|---|---|
| [01 — Game Design Document](docs/01-game-design-document.md) | Core loop, slip mechanic spec, combat, progression, death, economy |
| [02 — Worldbuilding](docs/02-worldbuilding.md) | Carillon: districts, factions, history, the metaphysics rulebook |
| [03 — Narrative](docs/03-narrative.md) | Main arc, three endings, three side threads, dialogue style guide with samples |
| [04 — Characters](docs/04-characters.md) | Protagonist + 6 key NPCs, including their presentation across time-states |
| [05 — UE5 Technical Design](docs/05-ue5-technical-design.md) | Slip implementation (World Partition data layers), BP/C++ split, plugins, architecture |
| [06 — Scope & Milestones](docs/06-scope-and-milestones.md) | Milestone plan, honest solo/team estimates, risk register, vertical slice cut list |

## The one rule that makes this buildable

The three time-states are **parallel shards, not a causal chain**. Moving a chair in the past-state does not ripple into the present. Only scripted *resonant* objects echo across states. This single metaphysical decision is what keeps the game inside solo/small-team scope — it converts "simulate causality" into "author three dressings of one level." It is load-bearing. Defend it. (Rationale in [02](docs/02-worldbuilding.md), consequences in [05](docs/05-ue5-technical-design.md) and [06](docs/06-scope-and-milestones.md).)
