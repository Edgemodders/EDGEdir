---
title: D4 Transitions
---

# <span class="y">D4</span> Transitions and sequences

**Status: agreed by the owner on 2026-11-16 (all five questions as recommended). Both parts are built: D4a Transitions (EDGEdir 0.0.12) and D4b Sequences (0.0.13). Their hand tests ran by script on 0.0.13: D4b passed 19 of 19; D4a failed three steps, of which the main fault (the body jumped at a join under a transition) is fixed in 0.0.14 and not run again yet ([Tests](testing.html)).** What is built is at the end.

D4 is the fourth phase of the [design](design.html). It makes the transition clip do something: two animation clips joined by one view as one movement in the 3D preview. And it makes a run of clips and transitions a thing that is stored by itself and used again: a sequence. Nothing in D4 plays in the game (D5), and nothing in D4 makes new game files (D7).

## What D4 ends with

Two clips with a transition view as one movement in the preview. Saved as a sequence, they go onto a second actor as one block, in two clicks.

## What D4 rests on

| Fact | From | Consequence |
|---|---|---|
| A transition clip already lies on an actor lane, over its neighbours, with a start and a length. It does nothing yet | D1 | D4 gives it a method and an ease, and the preview reads them |
| The preview shows one clip per actor at a time: the clip under the playhead, or the last one, looping, in a gap | D3 (`src/pose.ts`) | A transition is two clips shown at once, mixed. The page's player (three.js) mixes two animations by weight; EDGEdir has not done it yet (**unverified**) |
| In the game a jump from one clip to the next blends by itself: "a jump with `instant: true` goes at once with a smooth blend" | REDnode #46's spike | The game's own blend starts **at the jump**, which is the next clip's start. REDnode's answer from the files (below): it looks like inertialization, about 0.5 s, perhaps settable for each clip; nothing is measured yet |
| New animation frames cannot reach the game: REDbridge has no `.anims` import (#14) | The design | Whatever the preview shows beyond the game's own blend stays in the preview until baking (D7). The preview must say so |
| Clips play in place: no root motion in the preview or the game | D3, REDnode | The design's "root motion is matched first" is left out of D4 |
| No AI provider that makes the frames between two motions is known | The design (Q5) | The method `ai` is in the document and in the list, shown as not available yet |

## Transitions

### Which clips a transition joins

A transition joins the clip that plays before it, **A**, to the next clip that starts inside it or at its end, **B**. A transition with no such B joins nothing: it is drawn dimmed and says so.

### The methods

| Method | What the preview shows over the transition's length | In the game |
|---|---|---|
| **Blend** | A and B both play, mixed bone by bone. The mix goes from all A to all B along the ease. Before B's start, B holds its first pose. After A's end, A holds its last pose when B starts where A ends; with a gap between them A goes on looping, as it does in the gap (corrected in 0.0.14: at first A wrapped round to its start at the join, which made the join jump) | When the transition starts at B's start: the game's own join at the jump, if that is a blend. REDnode's first look says the game's join is nearer Inertial (below); not measured. Anywhere else: preview only, until baking |
| **Inertial** | B plays whole from its start. The difference between A's pose and B's pose at B's start is added on top and fades away along the transition. B's own movement is kept; good for short joins | When it starts at B's start it may be what the game's own join does (REDnode's first look, not measured). Anywhere else: preview only, until baking (D7) |
| **AI** | Nothing: listed, greyed, "no provider yet" | Not built |

### The ease

| Ease | The mix |
|---|---|
| Smooth (first) | Slow at both ends |
| Linear | Even |
| Ease in | Slow start |
| Ease out | Slow end |

### Honest about the game

A transition shows a small mark when the game will not play what the preview shows: one that does not start at B's start, and one whose method is not the game's own. Which method is the game's own is not measured yet (see "Asked of REDnode"), so until it is the mark goes by the place alone. The inspector says why in a sentence. **Add Transition** puts a new transition at the start of the next clip, 0.4 s long, where the game's own blend is; it can be moved and stretched from there.

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

All five answered on 2026-11-16: as recommended.

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

Asked on REDnode #46 and answered the same day, from the game's files and its 2.5 script declarations. **Nothing is measured yet**: REDnode times it in its next round in the game and posts the numbers on #46.

| Asked | REDnode's answer (unverified until measured) |
|---|---|
| How long is the blend at a jump, and can it be set? | Not for each jump: the game's jump calls take only the actor, the target and `instant`. Perhaps for each clip, in the written file: the clip's `blendOutTime` (`world.writeWorkspot` writes 0.5 s today), or the tree's own blend and inertialization times. Which one governs a jump is not known |
| Does the first clip go on playing during the blend? | Probably not. It looked like inertialization: the new clip starts at once and the old pose's offset fades |
| Is there a jump with no blend? | No call. A cut may come from blend times of 0 in the file |

REDnode also found the game's own authored transition in a workspot (`customTransitionAnims`: an animation that leads from one idle to another), which `world.writeWorkspot` leaves empty today. It may be how a made transition reaches the game one day.

**What this changes in the plan.** The game's own join looks like this plan's **Inertial**, not its Blend, and about half a second long. So the mark's rule above is a first guess: which method and which length match the game is settled when REDnode has measured, and until then the mark's sentence says "not yet measured in the game" where it would claim a match. Blend and Inertial are both built for the preview either way, as the owner asked for both. If the game's blend time can be set for each clip, a transition's length becomes that time in D5.

## What is built

**D4a Transitions, EDGEdir 0.0.12 (2026-11-16).**

| Part | Where | What it does |
|---|---|---|
| D4.1 Rules | `src/doc.ts`, `src/pose.ts` | `transitionOf`, `setTransition` (`method`, `ease`), `addTransition` (at the start of the clip whose join is nearest, 0.4 s). `joinOf` (A and B), `easeAt`, `transitionNote` (joins or not, the mark, the sentence). `poseAt` gives a `mix` under a transition: the first clip, its moment, and its share |
| D4.2 Blend | `webview/preview.ts` | Both clips play in the page's player, each at its moment, weighted by the share. When both sides are the same animation, the first side plays a copy |
| D4.3 Inertial | the same | The difference between A's pose and B's pose where B starts is measured once for a join, bone by bone (rotation and place), and the share of it is added on top of B's pose. What is added is taken back before the player sets the next pose |
| D4.4 Inspector and lane | `webview/editor.ts` | Method (AI greyed, "no provider yet"), Ease, Length, **Joins**, a sentence on the method and one on the game. A transition that joins nothing is dimmed; one the game will not match has a yellow bar at its start. A clip with no transition leading into it says the preview cuts and the game will blend. **Add Transition** goes to the nearest join |

Checked: 6 unit tests (`test/transition.test.ts`). In a plain browser with real clips from the game (`tools/preview-sample.ts` now adds a Blend and an Inertial transition): under the Blend, both clips show in `edgedirPreview.state()` with the share running from 1 to 0; under the Inertial, the body's pose where the second clip starts is the same as the frame before (no jump), halfway it is between, and at the end it is the second clip's own.

What differs from the plan, or was settled in building:

| Point | As built |
|---|---|
| Inertial and speed | Only the difference in pose fades. The first clip's speed at the join is not carried over, as the design's wording ("pose and speed") had it. To be judged in the spot test; it can be added |
| Inertial before B starts | Nothing: A plays alone until B's start, though the transition has begun. The fade runs from B's start to the transition's end |
| The mark | By the place alone, as the plan says: it shows on a transition that does not start at B's start, and on AI. It does not tell Blend from Inertial until REDnode has measured the game's join |
| A clip made for another rig | It is not joined to: a transition over it reaches the next clip that fits, or joins nothing |

**D4b Sequences, EDGEdir 0.0.13 (2026-11-16).**

| Part | Where | What it does |
|---|---|---|
| D4.5 The file | `src/seq.ts`, `src/doc.ts` | `SeqDoc`, `parseSeq`, `formatSeq`; `seqAsScene` and `sceneAsSeq` (a sequence shown to the editor as a scene with one lane, `t1`, whose actor is a stand-in: `{ standIn: true, rig }`); `readScene` and `writeScene` (either kind of file). The block: `seqOf`, `addSeqClip`, `unpackSeq`, `refreshSeqs`, `seqDiffers`, `runOf` (the picked clips and the transitions between them, from 0) and `replaceWithSeq`. A block is refused a trim and a split, and the rig rule covers it |
| D4.6 The Desk and the editor | `src/desk.ts`, `src/deskView.ts`, `src/editor.ts`, `webview/editor.ts` | `<name>.sequence.asset` items with a `.edgeseq` inside, under a **Sequences** heading; **New Sequence** (a name, then a rig: the selected actor's, the feminine base, the masculine base); Rename, Delete and Reveal as for a scene. The scene editor opens a `.edgeseq`: one lane, no Add Track, no mute or lock, the base body for the rig. Add to Track from the Animations view works there as in a scene |
| D4.7 On a lane | `src/extension.ts`, `src/pose.ts`, `webview/editor.ts` | **Add to Track** on a Desk sequence (its **+**) puts a block at the playhead of the selected actor track. **Save as Sequence** in the toolbar (clips selected on an actor track): a name, then keep the clips or replace them with the block. The block's inspector: the sequence's name, clips and rig, how the link stands, **Open Sequence** (or double-click the block) and **Unpack**. The preview opens a block out into its clips (`flat`), so it plays as they do and a transition joins it to its neighbours |

The link: a block keeps the sequence's id and a copy of its clips. When a scene opens, and when a sequence is saved, every block whose copy differs takes the sequence as it is on the Desk, as one edit that can be undone. A block whose new length would run into the next clip keeps its copy and says so; one whose sequence is not on the Desk says it plays its copy.

Checked: 6 unit tests (`test/seq.test.ts`). In a plain browser with real clips: a block on a second actor plays the same poses as the clips it was made from, with its own transition; the block's inspector; a sequence in the editor shows one lane with the base body and plays. **Not run anywhere yet: everything that needs VS Code** (the Desk's items and commands, Save as Sequence, Add to Track, opening a `.edgeseq`, the link's refresh on open and on save).

What differs from the plan, or was settled in building:

| Point | As built |
|---|---|
| Save as Sequence | The plan had a tick box "Replace with the Sequence". As built it is a second question after the name, with two choices |
| New Sequence's rig | The selected actor's rig is offered first when a scene with an actor track selected is in front |
| A sequence's name | The name of its item on the Desk: Rename there. The editor shows it and does not change it |
| The link's refresh | It is an edit to the scene (the scene shows as unsaved after it), so Undo takes it back and the scene's text always says what it plays |
| Where sequences are looked up | The Desk only. A project's and the Library's come with D7 (Move to Project, Add to Library) |
| Transitions taken by Save as Sequence | Those that lie wholly between the first picked clip's start and the last one's end, picked or not |

## Out of D4

An AI provider (research, D7). Baked transitions in the game (D7, after REDbridge #14's import). Root motion. Transitions between a sequence block and its neighbours work as between clips; transitions on other kinds of track do not exist.
