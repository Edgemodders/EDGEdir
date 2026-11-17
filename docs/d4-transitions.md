---
title: D4 Transitions
---

# <span class="y">D4</span> Transitions and sequences

**Status: plan, written 2026-11-16, for the owner's review. Nothing of D4 is built.** Five questions for the owner are below.

D4 is the fourth phase of the [design](design.html). It makes the transition clip do something: two animation clips joined by one view as one movement in the 3D preview. And it makes a run of clips and transitions a thing that is stored by itself and used again: a sequence. Nothing in D4 plays in the game (D5), and nothing in D4 makes new game files (D7).

## What D4 ends with

Two clips with a transition view as one movement in the preview. Saved as a sequence, they go onto a second actor as one block, in two clicks.

## What D4 rests on

| Fact | From | Consequence |
|---|---|---|
| A transition clip already lies on an actor lane, over its neighbours, with a start and a length. It does nothing yet | D1 | D4 gives it a method and an ease, and the preview reads them |
| The preview shows one clip per actor at a time: the clip under the playhead, or the last one, looping, in a gap | D3 (`src/pose.ts`) | A transition is two clips shown at once, mixed. The page's player (three.js) mixes two animations by weight; EDGEdir has not done it yet (**unverified**) |
| In the game a jump from one clip to the next blends by itself: "a jump with `instant: true` goes at once with a smooth blend" | REDnode #46's spike | The game's own blend starts **at the jump**, which is the next clip's start. How long it is, whether it can be set per jump, and whether the first clip goes on moving during it are **not known**: asked on REDnode #46 with this plan |
| New animation frames cannot reach the game: REDbridge has no `.anims` import (#14) | The design | Whatever the preview shows beyond the game's own blend stays in the preview until baking (D7). The preview must say so |
| Clips play in place: no root motion in the preview or the game | D3, REDnode | The design's "root motion is matched first" is left out of D4 |
| No AI provider that makes the frames between two motions is known | The design (Q5) | The method `ai` is in the document and in the list, shown as not available yet |

## Transitions

### Which clips a transition joins

A transition joins the clip that plays before it, **A**, to the next clip that starts inside it or at its end, **B**. A transition with no such B joins nothing: it is drawn dimmed and says so.

### The methods

| Method | What the preview shows over the transition's length | In the game |
|---|---|---|
| **Blend** | A and B both play, mixed bone by bone. The mix goes from all A to all B along the ease. Before B's start, B holds its first pose; after A's end, A goes on as it does in a gap | When the transition starts at B's start: the game's own blend at the jump, which is close to it. How close is for D5 to measure. Anywhere else: preview only, until baking |
| **Inertial** | B plays whole from its start. The difference between A's pose and B's pose at B's start is added on top and fades away along the transition. B's own movement is kept; good for short joins | Preview only, until baking (D7) |
| **AI** | Nothing: listed, greyed, "no provider yet" | Not built |

### The ease

| Ease | The mix |
|---|---|
| Smooth (first) | Slow at both ends |
| Linear | Even |
| Ease in | Slow start |
| Ease out | Slow end |

### Honest about the game

A transition shows a small mark when the game will not play what the preview shows: an Inertial one, and a Blend one that does not start at B's start. The inspector says why in a sentence. **Add Transition** puts a new transition at the start of the next clip, 0.4 s long, where the game's own blend is; it can be moved and stretched from there.

One more place the preview and the game differ: a join with **no** transition. The preview cuts. The game blends for a moment by itself (question 2).

### What the document gains

```json
{ "id": "c2", "kind": "transition", "start": 3.2, "length": 0.4, "method": "blend", "ease": "smooth" }
```

`method` is `blend`, `inertial` or `ai`; `ease` is `smooth`, `linear`, `in` or `out`. A transition from D1 has neither and reads as Blend, Smooth. The design already drew these two fields.

## Sequences

The design's "Sequences" section, agreed on 2026-11-16 (Q8), is what D4 builds. What this plan adds is how.

| Point | Plan |
|---|---|
| The file | `<name>.edgeseq`: `{ "edgeseq": 1, "name", "rig", "fps", "clips": [...] }`. The clips are an actor track's clips, starting at 0 |
| On the Desk | Listed with the scenes, under its own heading, as kind `sequence` (`<name>.sequence.asset`). **New Sequence** asks for a rig: feminine base, masculine base, or the selected actor's |
| Save as Sequence | With clips selected on one actor track: they are saved, with the transitions between them, as a new sequence on the Desk. The first clip's start becomes 0 and gaps are kept. Nothing changes on the lane unless **Replace with the Sequence** is ticked |
| Editing one | It opens in the scene editor with one actor lane and nothing else to add. The body is the game's base body for the rig, as V's is; another rig shows no body and says so |
| On a lane | A new kind of clip, `sequence`: one block as long as the sequence, with its name. Put there from the Desk with **Add to Track** on the sequence, as animations are (dragging onto a lane is still not built) |
| The block | It moves, copies and deletes like a clip. It cannot be trimmed, sped up, looped or split (question 3). The rig rule holds: a block on an actor with another rig is hatched red |
| Linked | The block names the sequence by its id. The scene also keeps a copy of the clips as they were (question 4). A change to the sequence shows in every scene that links it, the next time the scene is opened or the sequence is saved |
| Open | Double-click the block, or **Open Sequence** in the inspector: the sequence opens in its own tab |
| Unpack | **Unpack** in the inspector turns the block into plain clips and transitions on the lane, with no link |
| In the preview | The block plays as its clips, transitions and all |
| A sequence in a sequence | No |

```json
{ "id": "c7", "kind": "sequence", "start": 6, "length": 9.4,
  "seq": { "id": "…", "name": "walk in, sit, lean back", "rig": "…", "clips": [ … ] } }
```

## Questions for the owner

| # | Question | Recommendation |
|---|---|---|
| 1 | May a transition sit anywhere over a join, with a mark when the game will not match it? Or only where the game can match it (at the next clip's start)? | **Anywhere, with the mark.** The preview is for judging movement, and baking (D7) will bring the rest to the game. Add Transition starts it where the game matches |
| 2 | A join with no transition: the preview cuts, the game blends briefly by itself. Leave it a cut for now? | **Yes, for D4**, with a line in the inspector saying the game will blend it. When REDnode has measured the game's own blend, D5 can show bare joins as the game plays them |
| 3 | A sequence block on a lane is the whole sequence at its own speed, once: no trim, speed, loops or split on the block. Enough for a first version? | **Yes.** Unpack gives the clips back when one needs changing in place. Loops on a block is the likeliest thing to add later |
| 4 | Should a scene keep a copy of each linked sequence's clips, so it opens and plays when the sequence is not on this PC, and say when the copy is older than the sequence? | **Yes.** A scene that is shared or moved to a project must not break on a missing link |
| 5 | Build D4 in two parts, each with its own hand test: D4a transitions, then D4b sequences? | **Yes.** They share little code, and transitions are what the preview needs most |

## Steps

| Step | Builds | Checked by |
|---|---|---|
| **D4a** | | |
| D4.1 Rules | `method` and `ease` on a transition and their edit; which clips a transition joins; the pose with a transition (`src/pose.ts`): two clips, two moments, a weight, or B with A's offset | Unit tests |
| D4.2 Blend | The preview mixes two clips by weight | The browser harness, with real clips |
| D4.3 Inertial | The offset at B's start, fading | The browser harness |
| D4.4 Inspector and lane | Method, Ease and Length in the inspector; AI greyed; the mark and its sentence; a transition that joins nothing; Add Transition's new place | Unit tests; the hand test |
| **D4b** | | |
| D4.5 The file | `.edgeseq` read and written; Save as Sequence, the block, Unpack and the rig rule as pure edits | Unit tests |
| D4.6 The Desk and the editor | Sequences on the Desk, New Sequence, the editor on a `.edgeseq` with one lane and a base body | The hand test |
| D4.7 On a lane | Add to Track from the Desk; the link by id with the kept copy; Open Sequence; the preview plays through a block | Unit tests; the hand test |

## Hand tests (outline)

Written out in [Tests](testing.html) when each part is built, with a spot test for each. Both need the game's files and REDbridge 0.14.0.

**D4a:** two clips end to end; Add Transition; drag the playhead through it: one movement, not a jump. Change Ease and Length: it follows. Change to Inertial: B's movement stays whole. Move the transition off B's start: the mark shows, and the inspector says why. A transition with no next clip is dimmed.

**D4b:** select three clips and a transition, Save as Sequence: it is on the Desk. Add it to a second actor's track: one block, playing the same movement. Open it, change a clip, save: the scene's block follows. Unpack: plain clips. A block on an actor with another rig is hatched red.

## Asked of REDnode with this plan

On REDnode #46, for D5 and for how true D4's mark is:

| Asked | Why |
|---|---|
| How long is the blend at a jump, and can it be set for each jump or each entry of `world.writeWorkspot`? | If it can, a Blend transition's length becomes the game's blend time, and the two match |
| During the blend, does the first clip go on playing, or hold its pose? | The preview's Blend keeps it playing |
| Is there a way to jump with no blend at all? | A bare join in the preview is a cut |

## Out of D4

An AI provider (research, D7). Baked transitions in the game (D7, after REDbridge #14's import). Root motion. Transitions between a sequence block and its neighbours work as between clips; transitions on other kinds of track do not exist.
