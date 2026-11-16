---
title: D2 Cast and clips
---

# <span class="y">D2</span> Cast and clips

**Status: plan agreed with the owner on 2026-11-16. Every step is built (EDGEdir 0.0.6) and waits for its hand test ([part 1](testing.html#d2-cast-part-1), [part 2](testing.html#d2-clips-part-2), [part 3](testing.html#d2-made-animations-part-3)). Part 2 needs REDbridge's next release, which is built on its main and not released.**

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

**The rig** is read from the actor's entity: its `entAnimatedComponent`'s `rig`. The body's is the component named `root` (found on the real game, below).

### V

The owner's ask (2026-11-16): the player character is one of the actors.

| Point | Plan |
|---|---|
| In the picker | Two entries at the top: **V (the player), feminine body** and **V (the player), masculine body**. A scene's V has one body in the editor, because the rig decides which animations fit |
| In the document | `"actor": { "player": "wa" }` or `"ma"`, with `entity` and `rig` as for anyone |
| Entity and rig | The game's third-person player entities (`player_wa_tpp.ent`, `player_ma_tpp.ent`) and the rig they name. Read on 2.5: they name the same rigs as the game's other women and men, so those animations fit V |
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

## What is built

EDGEdir 0.0.4, 2026-11-16: D2.1 to D2.4, and the actor's part of the document.

| Part | Where |
|---|---|
| REDbridge's client, its types and the game finder, copied unchanged from REDcode with a note of the commit | `src/core/bridgeClient.ts`, `types.ts`, `gameFinder.ts` |
| Where the game and the bridge are (adapted from EDGEquest's) | `src/core/config.ts`; the settings `edgedir.gamePath`, `edgedir.bridgePath`, `edgedir.dotnetRoot` |
| The cast: the character list, V's two entries, search, the file on the PC | `src/core/cast.ts` |
| An entity's body rig, appearances and animation sets | `src/core/entity.ts` |
| The set level of the index, by folder, with search | `src/core/animSets.ts` |
| The bridge for the extension, the state the view shows, reading with progress | `src/game.ts` |
| The actor picker | `src/actorPicker.ts` |
| The Animations view | `src/animationsView.ts` |
| The actor in the document (`setActor`, one V) and on the page (lane head, inspector, **Choose Actor**) | `src/doc.ts`, `webview/editor.ts`, `src/editor.ts` |
| Unit tests, with made-up records and files | `test/cast.test.ts` (5 tests) |

What is read from the game is kept in `%LOCALAPPDATA%\EDGEdir\cache` (`cast\<game>.json`, `anims\<game>.sets.json`), filed under the game's archive and file counts, so a patch reads it again. The first read is the modder's click on **Read the Game**; later sessions read it without asking.

### Found on the real game (2.5, REDbridge 0.13.0, 2026-11-16)

The core was run against the game from a script, outside VS Code.

| Asked | Found |
|---|---|
| The cast | 6,586 people, 2,672 with a name. Read in 13 s |
| Which component is the body's | The `entAnimatedComponent` named `root`. The others are deformations rigs. Of 108 entities sampled across the cast, 2 had no rig by this rule and 2 could not be read (not looked into yet) |
| V's rig | The feminine third-person body names the same rig as the game's other women (`woman_base`), the masculine one the same as other men (`man_base`). So their animations fit V with the strict rule, and nothing special is needed |
| Other rigs seen | A bigger man's (`man_big`), a massive one's (`man_massive`), and vehicles' (some `Character` records are flying cars) |
| The sets an entity carries | Read as planned from the body's component: about 33 for a person, 3 for V's third-person body. The appearance's own file may add more; not read yet |
| The animation files | 14,016: 5,577 under `base\animations`, 7,408 under `base\localization` (these are lip sync, one per voiced line set), 987 in Phantom Liberty, a few elsewhere |
| How long the file list takes | **116 s**, once per game version. REDbridge's file list has no filter by ending, so every game file's name is paged through (592,071 names). Asked for on REDbridge #17: a filter, or the list from `anims.info` |
| An entity's JSON | 1.5 to 2.2 MB, read in well under a second |

Not checked yet: anything in VS Code (the picker, the view, the progress note, the settings). The page's new lane head and inspector lines were type checked, not looked at. All of it is in the hand test.

### D2.5 and D2.6 (EDGEdir 0.0.5, 2026-11-16)

| Part | Where |
|---|---|
| The clip level of the index: read in pages, saved as it goes, picked up where it stopped; search by words, rig and set | `src/core/animIndex.ts` |
| The file list through REDbridge's new filter, with the slow way kept for 0.13.0 | `src/core/animSets.ts` |
| Reading the animations in the background, with a note in the status bar | `src/game.ts` |
| The view: the animations inside each file, search over them, **Fits** and **the actor's own files**, **Add to Track** | `src/animationsView.ts`, `src/extension.ts` |
| A clip's animation and how it plays (`anim`, `in`, `out`, `speed`, `loops`), trim and split inside the animation, the unfit rule | `src/doc.ts` (`addAnimClip`, `setPlay`, `playOf`, `unfit`) |
| The page: the unfit hatch, loop marks, the inspector's fields; the host knows the selected track and the playhead | `webview/editor.ts`, `src/editor.ts` |
| Unit tests | `test/anim.test.ts` (9 tests) |

Found on the real game with a build of REDbridge's main (`efa9e17`, not released), from a script outside VS Code:

| Asked | Found |
|---|---|
| The file list with the filter | 14,016 files in under a second (116 s without it) |
| The animations | 146,814 in 14,016 files, none failed, in 3.5 minutes; 8.2 MB on disk; loaded again in 0.1 s |
| A search | 3 to 23 ms over everything |
| Rigs | The game's ordinary women and men have about 16,000 animations each. V's first-person animations are made for other rigs (`player_woman_skeleton`, `player_man_skeleton`), so by the strict rule they do not fit V's third-person body; whether they would play on it is **unverified** and not needed yet |
| V's own files | 3 files, 31 animations: V's third-person entity lists little. Fits is the useful filter for V |

Checked in the browser harness (2026-11-16): the hatch, the loop marks and the inspector draw; a looping clip's start refuses with its reason; its end edge sets the loops; a clip's start edge trims into its animation.

What differs from the plan:

- **Dragging an animation onto a lane is not built.** Whether a drag from a view reaches the editor's page is still unverified, and it needs VS Code to try. **Add to Track** is the way, as a button on each animation and in its menu.
- Dragging the end of a clip past its animation's end does not add loops. Loops are set in the inspector; a clip that already loops changes its loops by its end edge.
- The view's filter for the actor's own files reads the entity's file only, not its appearance's.

Not checked yet: anything in VS Code. It is in the hand test.

### D2.7 and D2.8 (EDGEdir 0.0.6, 2026-11-16)

| Part | Where |
|---|---|
| Made animations read from the Library (`*.anim.asset`) and from the open project's records (`*.edgefab.json`, kind `anim`), in EDGEfab's agreed shape | `src/core/made.ts` |
| The view's **Project** and **Library** groups; made animations in search and the fits filter; Add to Track with the item's id | `src/animationsView.ts`, `src/game.ts`, `src/extension.ts` |
| The extension API | `src/api.ts`, [Extension API](api.html) |
| A sample made animation for the hand test | `tools/made-anim-sample.mjs` |
| Unit tests | `test/made.test.ts` (3 tests) |

What is not built, and why:

- **The mark on a Desk scene's clip that uses a project animation**, and copying Library animations into a project with the scene: they belong with moving a scene into a project (D7).
- **Finding a made clip again when the scene opens** (its id looked up in the project, then the Library, to say when it is gone): the clip keeps its facts, so the lane is right without it. D3's preview needs the lookup and builds it.
- The API was built before EDGEfab commented on its shape (EDGEfab #7). Members can be added within version 1.

EDGEfab stores no animations yet, so all of this was tried against items written by hand in the agreed shape. The first real one may show a difference.

## Steps

Each step is one or more small commits with its unit tests. The hand test comes after the last.

| Step | Builds | Needs |
|---|---|---|
| D2.1 Bridge (built) | REDcode's bridge client, copied unchanged with a note of where from; finding the game and the bridge; a status line in the Animations view | 0.13.0 |
| D2.2 Cast (built) | The character list and its file on the PC; the picker with search; V's two entries; **Choose Actor** on a track and in the inspector; the track head shows the actor | 0.13.0 |
| D2.3 Rigs (built) | An actor's entity, rig and appearances read from the game; the rule for which component is the body's; V's rig beside the base rigs; the sets an entity carries | 0.13.0 |
| D2.4 Sets (built) | The set level of the index; the Animations view's Game group down to sets | 0.13.0 |
| D2.5 Clips (built) | The clip level; search; the two filters | `anims.info` |
| D2.6 On the lane (built, without the drag) | The clip's `anim`, `in`, `out`, `speed`, `loops` in the document module and the page; Add to Track and the drag; the unfit mark; swapping an actor | D2.5 for real clips; unit tests need nothing |
| D2.7 Made animations (built) | The Library and Project groups, read from EDGEfab's agreed shape | A hand-made item; EDGEfab's first real one later |
| D2.8 API (built) | The extension API above, and `docs/api.md` | EDGEfab's comments on #7 |

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
