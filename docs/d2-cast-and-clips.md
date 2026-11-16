---
title: D2 Cast and clips
---

# <span class="y">D2</span> Cast and clips

**Status: plan, written 2026-11-16, for the owner's review. Nothing of D2 is built.**

D2 is the second phase of the [design](design.html). It brings real things onto the timeline: an actor on each actor track, picked from the game's characters with V among them, and the game's animations as clips with their true lengths. It still shows no 3D picture (D3) and plays nothing in the game (D5).

## What D2 ends with

A named NPC has two real game clips in a row on its track. The track's actor is swapped for another of the same rig and keeps them. A clip for another rig is marked unfit. V can be picked as an actor, in either body.

## What it needs from other tools

| From | What | State on 2026-11-16 |
|---|---|---|
| REDbridge 0.13.0, through REDcode or by itself | `tweakdb.records` for the characters, `archive.list` for the game's `.anims` files, `cr2w.toJson` to read an entity | Released. D2.1 to D2.4 need nothing more |
| REDbridge's next release | `anims.info` (#14): a set's clip names, frame counts, rates, type, root motion and rig, for many files in one call | Taken, not released. D2.5 on waits for it. The owner starts that release |
| EDGEfab | A made animation as an `anim` item (EDGEfab #7) | Agreed, not built. D2.7 is built against its agreed shape with a hand-made item, and tried for real when EDGEfab stores one |
| REDnode | Nothing in D2. V in the game is a request for D5 (below) | |

REDcode is not required. As EDGEquest does, EDGEdir uses REDcode's bridge and game folder when REDcode is active, and otherwise starts REDbridge itself (the settings `edgedir.bridgePath` and `edgedir.gamePath`, then REDcode's settings, then a search). With no bridge at all the timeline still works, and the Animations view and the actor picker say what is missing.

## The actor

An actor track gets an `actor` field. D1 keeps unknown fields, so D1 scenes open unchanged.

```json
{ "id": "t1", "kind": "actor", "name": "Judy",
  "actor": { "record": "Character.Judy", "appearance": "judy_default",
             "entity": "base\\characters\\entities\\main_npc\\judy.ent",
             "rig": "base\\characters\\base_entities\\woman_base\\woman_base.rig" } }
```

| Field | What |
|---|---|
| `record` | The TweakDB `Character.*` record. It is what REDnode's `world.spawn` takes |
| `appearance` | One of the entity's appearances, or absent for "the game picks" |
| `entity`, `rig` | Read from the game when the actor is picked, and kept so the scene opens without the game. Checked again when the bridge is there |
| `player` | `"wa"` or `"ma"`, on V only (below). `record` is then absent |

The names in the example are examples; the picker reads the real ones.

**The list** is made as EDGEbuilder's is: every `Character` record with an entity and a readable name (6,591 on game 2.5, by EDGEbuilder's test), kept in EDGEdir's storage on the PC per game version, never committed. The picker is a search box over it, with V at the top.

**The rig** is read from the actor's entity: its `entAnimatedComponent`'s `rig`. Which component is the body's when an entity has several (body, face, deformations) is **unverified**; D2.3 settles it on a handful of characters and writes down the rule.

### V

The owner's ask (2026-11-16): the player character is one of the actors.

| Point | Plan |
|---|---|
| In the picker | Two entries at the top: **V (the player), feminine body** and **V (the player), masculine body**. A scene's V has one body in the editor, because the rig decides which animations fit |
| In the document | `"actor": { "player": "wa" }` or `"ma"`, with `entity` and `rig` as for anyone |
| Entity and rig | The game's third-person player entities (`player_wa_tpp.ent`, `player_ma_tpp.ent`) and the rig they name. Whether V's rig takes the same animations as the woman's and man's base rigs is **unverified**; D2.3 reads both and says |
| Looks | V's own face and clothes are in the save, not in the game's files. D3's preview shows the default body. In the game it is the modder's V |
| The wrong body | A scene made for one body, played by a V of the other: D5 says so at Play. Making a scene fit both bodies is not in D2 |
| At most one | A scene has at most one V. A second track cannot pick V |
| In the game (D5) | **Not possible today.** REDnode's workspot calls work only on a person its package spawned, not on the player. So V needs a REDnode request, written now so it is not a surprise at D5 |

The question V raises for the game side, for the owner:

| Choice | What it means |
|---|---|
| **A: the real player acts** (recommended) | The scene takes V over while it plays, as a quest's scene does: controls held, V moved to the mark, a workspot on the player, the camera track or third person to see it. It is what "V is in the scene" means to a player |
| B: a stand-in copy | A spawned copy of V acts, and the player watches. Simpler to reason about, but the copy needs V's looks and clothes (REDnode's docs list copies of V as later work), and there are then two Vs |

The request to REDnode (REDnode #47) asks what each would take. D2 does not depend on the answer.

REDnode's answer the same day, read from the 2.5 type list and game files, all **unverified** until a spike:

| Point | REDnode found |
|---|---|
| V's body | Readable today: `GetResolvedGenderName()` on the player answers Female or Male. A `game.player.body()` giving `wa` or `ma` can join REDnode's next build |
| A: the real player | The workspot system takes the player by its signature, with a spawned device object beside V. The hard parts are holding the controls (likely a plugin call, found by static reading) and third person (untested on 2.5). The quest scene route is closed: no call starts a quest node |
| B: a stand-in | The game's own copies are the photo mode puppets (`player_wa_photomode.ent`, `player_ma_photomode.ent`). Clothes copy as the inventory preview does. The face and body from character creation are native and unknown |
| REDnode's view | One spike later, after A2's run and #46's: read the body, V in a workspot in first and third person, a photo mode puppet dressed and played. Its guess: B ships sooner and is the safer default |

So the choice may come down to what the spike shows. The scene document does not change with it: `actor.player` names V either way.

## The animations

A clip on an actor track gets its animation and how it is played. Its `length` is worked out from them, no longer typed.

```json
{ "id": "c3", "kind": "anim", "start": 2, "length": 3.2,
  "anim": { "set": "base\\animations\\...\\some_set.anims", "name": "stand__2h_on_hips__01", "rig": "...woman_base.rig", "seconds": 4.2 },
  "in": 0.5, "out": 3.7, "speed": 1, "loops": 1 }
```

| Field | What |
|---|---|
| `anim.set`, `anim.name` | A game animation. A made one has `anim.id` instead of `set` (the design's "Animations and actors") |
| `anim.rig`, `anim.seconds` | Copied from the index when the clip is made, so the scene opens and checks its rigs without the game |
| `in`, `out` | The part of the animation that is played, in its own seconds |
| `speed` | 1 is as made. The lane length is `(out - in) × loops ÷ speed` |
| `loops` | How many times the part is played |

Dragging a clip's edge on an `anim` clip trims `in` or `out` and stops at the animation's own ends. Dragging past the end with Shift adds loops. A D1 clip with no `anim` stays a named block and can be given an animation.

**Unfit.** A clip whose `anim.rig` is not its track's actor's rig is drawn hatched in red with the reason in the inspector. It stays on the lane; nothing is deleted. Whether some different rigs still take each other's animations is **unverified**, so the rule starts strict (the same rig path) and D2.3's findings may loosen it.

**The index** has two levels, because the second needs REDbridge's next release.

| Level | Holds | From | When |
|---|---|---|---|
| Sets | Every `.anims` file in the game (14,016 on 2.5), by path | `archive.list`, paged (a search returns at most 5,000) | D2.4, with 0.13.0 |
| Clips | Each set's animations: name, frames, rate, seconds, type, root motion, and the set's rig | `anims.info` | D2.5, with REDbridge's next release |

It is built once per game version with a progress note, kept in EDGEdir's storage on the PC, and never committed. How long the clip level takes for 14,016 files is **unverified**; if it is long, it is built in the background, sets opened by the modder first.

**The Animations view** shows three groups: **Game** (by folder, then set, then clip), **Library** and **Project** (EDGEfab's `anim` items, D2.7). A search box finds clips by name. A **Fits the selected actor** switch keeps only the selected track's rig. A clip shows its length. Double-click or **Add to Track** puts it on the selected actor track at the playhead; dragging it onto a lane does the same at the drop point. Whether a drag from a tree view reaches the editor's page is **unverified** in VS Code; D2.6 checks it first, and Add to Track is the way that always works.

**What an actor carries.** The index can also answer "which animation sets does this character's entity list" (`entAnimatedComponent.animations.gameplay` and `cinematics`, read from the `.ent` and its `.app`; the fields are from the game's type list, the reading is **unverified**). The view offers it as a third filter, **Carried by the actor**, and EDGEfab needs it (below).

## The extension API

EDGEdir owes EDGEfab a search of the index (EDGEfab #7). `activate()` returns it, in the shape the other tools use: an integer `apiVersion`, the tool's `version`, new members added within a version.

```ts
interface EDGEdirApi {
  readonly apiVersion: 1;
  readonly version: string;
  /** "none": never built. "sets": file names only. "clips": complete. */
  indexState(): { level: "none" | "sets" | "clips"; game?: string; clips: number; building: boolean };
  /** Builds or finishes the index, with EDGEdir's own progress note. */
  buildIndex(): Promise<void>;
  readonly onDidChangeIndex: vscode.Event<void>;
  searchAnimations(q: {
    text?: string;                              // every word must be in the clip's or the set's name
    rig?: string;                               // a game path; only clips for this rig
    entity?: { path: string; appearance?: string }; // only what this entity's sets hold
    source?: ("game" | "library" | "project")[];
    limit?: number;                             // 200 if absent, 5,000 at most
  }): Promise<{ total: number; items: AnimationInfo[] }>;
  /** The sets an entity lists, in the game's order, gameplay before cinematics. */
  entityAnimSets(path: string, appearance?: string): Promise<{ rig: string; sets: { path: string; use: "gameplay" | "cinematics"; priority: number }[] }>;
}
interface AnimationInfo {
  source: "game" | "library" | "project";
  set?: string;        // the game's .anims path
  id?: string;         // a made animation's id
  name: string;
  rig: string;
  seconds: number; frames: number; fps: number;
  additive: boolean; rootMotion: boolean;
  file?: string;       // a made animation's .glb on disk
}
```

It reads only; nothing in it changes a scene. This shape goes to EDGEfab #7 for its comments before D2.8 is built.

## Steps

Each step is one or more small commits with its unit tests. The hand test comes after the last.

| Step | Builds | Needs |
|---|---|---|
| D2.1 Bridge | REDcode's bridge client, copied unchanged with a note of where from; finding the game and the bridge; a status line in the Animations view | 0.13.0 |
| D2.2 Cast | The character list and its file on the PC; the picker with search; V's two entries; **Choose Actor** on a track and in the inspector; the track head shows the actor | 0.13.0 |
| D2.3 Rigs | An actor's entity, rig and appearances read from the game; the rule for which component is the body's; V's rig beside the base rigs; the sets an entity carries | 0.13.0 |
| D2.4 Sets | The set level of the index; the Animations view's Game group down to sets | 0.13.0 |
| D2.5 Clips | The clip level; search; the two filters | `anims.info` |
| D2.6 On the lane | The clip's `anim`, `in`, `out`, `speed`, `loops` in the document module and the page; Add to Track and the drag; the unfit mark; swapping an actor | D2.5 for real clips; unit tests need nothing |
| D2.7 Made animations | The Library and Project groups, read from EDGEfab's agreed shape | A hand-made item; EDGEfab's first real one later |
| D2.8 API | The extension API above, and `docs/api.md` | EDGEfab's comments on #7 |

D2.1 to D2.4, and D2.6's document rules, can be built now. D2.5 waits for REDbridge's release.

## Hand test (outline)

Written out in [Tests](testing.html) when D2 is built. It needs the game installed and REDbridge, not the game running.

1. The Animations view says where the game and the bridge were found, and builds the index with progress.
2. Choose Actor on a track: search a name, pick an NPC and an appearance. The track head shows it.
3. Search an animation, turn on Fits the selected actor, add two clips to the track. Each has its true length.
4. Trim a clip by its edge: it stops at the animation's ends. Change speed and loops in the inspector: the length follows.
5. Swap the actor for another of the same rig: the clips stay. Swap for one of another rig: the clips are marked unfit, with the reason.
6. Pick V on a track, in each body. A second track cannot pick V.
7. Save, close, reopen with the bridge switched off: the scene opens with its actors, lengths and marks.
8. A made animation (a hand-made item in the Library) shows under Library and goes onto a lane.

## Out of D2

The 3D preview and the pose under the playhead (D3). Transitions' methods and sequences (D4). Anything in the game (D5). Retargeting (EDGEfab's). The game's workspots as things to pick (later in the Animations view).
