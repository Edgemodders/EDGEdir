---
title: D3 Preview
---

# <span class="y">D3</span> Preview

**Status: plan, written 2026-11-16, for the owner's review. Nothing of D3 is built.** A spike measured what it rests on (below).

D3 is the third phase of the [design](design.html). It fills the empty area above the timeline with a 3D view: each actor's body, playing the clip under the playhead. It needs the game's files and REDbridge 0.14.0, not the game running. Nothing in D3 plays in the game (D5).

## What D3 ends with

Two actors stand in the viewport and play their clips in time with the playhead, when it is dragged and when the scene plays.

## What the spike found

Run on 2026-11-16 against game 2.5 with a build of REDbridge's main (the code of 0.14.0), from a script. Nothing was drawn: the spike measured the files the preview will load. That three.js plays such files on such bodies is REDcode's finding (its animation view, A2), not tried again here.

| Asked | Found |
|---|---|
| An actor as one model | A main character's entity in one appearance: 2.0 s, 11.7 MB, 32 meshes on one skeleton of 547 joints. Nine more characters: 0.3 to 3.1 s, 8 to 15 MB |
| One animation by itself | `project.export` with `options.animations`: 0.1 to 0.2 s and 0.4 to 0.5 MB a clip, from a file of many |
| Do the bones match? | A clip drives 71 bones; all 71 are on the character's skeleton, by name |
| Root motion | With the option on, the clip moves `Root`; off, it plays in place |
| A body with its materials | 17 s, 416 files, 115 MB for one character, and the model itself carries no pictures: the game's layered materials are not plain glTF. A textured body is a job of its own |
| V | **No V with a head can be exported.** The game's player entities list no usable appearance: V is put together from the save when the game runs. The feminine third-person entity's one appearance points to a file that is not in the game; the masculine one has body-only appearances (2 meshes, 187 joints, 0.1 s) |

## What D3 decides

| Point | Plan |
|---|---|
| Where | The viewport above the timeline in the scene editor, with the splitter D1 built. three.js is bundled into the page (it grows from about 90 KB to about 700 KB) |
| Bodies | The actor's entity in its appearance, in one plain grey material, as REDcode's animation view shows them. "Any: the game picks" shows the entity's first appearance |
| V | The game's base body for V's rig, without a head, with a line saying it stands in for your V |
| What is loaded | Each body and each animation is exported once through REDbridge into EDGEdir's folder on the PC (`%LOCALAPPDATA%\EDGEdir\cache\preview`), and loaded from there. The page can read that folder, the extension's own `dist` and `media`, and nothing else |
| The pose under the playhead | For each actor track: the clip under the playhead, at `in + (time - start) × speed`, wrapped over `in` to `out` for its loops |
| In a gap | The last clip goes on looping, as the game does: there a clip loops until the next jump (REDnode's finding). Before the first clip the body stands in its rest pose |
| Root motion | Off: clips play in place, as the game will play them (REDnode found root motion is not applied there). So the design's "root motion paths" are left out of D3 |
| Where an actor stands | A **mark**: `actor.at` with `x`, `y` in metres from the scene's origin and `yaw` in degrees, set in the inspector. New actors are placed 0.8 m apart so they do not stand inside each other. Dragging a mark in the viewport comes with the scene's anchor (D5) |
| Transitions | A cut. Blending is D4's |
| An unfit clip | Not played: the body holds its pose, and the viewport says which clip was passed over |
| An additive clip | Played as it is, which can look wrong; the Animations view already marks them |
| A made animation | Loaded from its own file, found by its id in the open project, then the Library. A clip whose animation is gone says so (left open in D2) |
| No game or no REDbridge | The viewport says what is missing. The timeline works as before |
| The view | Orbit, pan and zoom with the mouse; **Frame** fits every actor; a ground grid in metres. The scene's own camera track is D6 |
| Sound | None |

## What the document gains

```json
{ "id": "t1", "kind": "actor", "name": "Judy",
  "actor": { "record": "Character.Judy", "appearance": "judy_default", "entity": "...", "rig": "...",
             "at": { "x": 0.8, "y": 0, "yaw": 180 } } }
```

`at` is the only new field. A scene from D2 opens unchanged: an actor without `at` is placed by its order.

## Questions for the owner

| # | Question | Recommendation |
|---|---|---|
| 1 | Grey bodies first, textured later? | **Yes.** Shape and movement are what a director needs first, and it is what REDcode shows. Textured bodies need the game's layered materials drawn, which EDGEmat knows about: a request to plan, not a D3 step |
| 2 | V as a headless base body in the preview? | **Yes, for D3.** A default head and hair for V could be put together later from the game's parts; it would still not be your V |
| 3 | Marks typed in the inspector for now, dragged in the viewport later? | **Yes.** Typed marks are enough to keep two actors apart and facing each other |
| 4 | A gap loops the last clip, as the game does? | **Yes**, so the preview does not promise a stillness the game will not give. The alternative is to hold the last frame |

## Steps

| Step | Builds | Checked by |
|---|---|---|
| D3.1 Exports | The preview's folder on the PC; a body and a single animation exported once and found again; V's base body; what the bridge left out | Unit tests with a stand-in bridge; a script against the real game |
| D3.2 Viewport | three.js in the page; the grid, the light, orbit and Frame; the splitter resizes it; the page asks the host for files | The browser harness |
| D3.3 Bodies | Each actor track's body loads and stands on its mark; the note for V; what is shown while a body loads or fails | The browser harness, with bodies exported from the game on this PC (not committed) |
| D3.4 Poses | The pose under the playhead as a pure function with unit tests; clips loaded as the playhead nears them; play and scrub | Unit tests; the browser harness |
| D3.5 Marks | `actor.at` in the document module, the inspector's fields, the default places | Unit tests |
| D3.6 The rest | Made animations by id; the notes for unfit, missing and additive clips; no game, no bridge | Unit tests; the hand test |

## Hand test (outline)

Written out in [Tests](testing.html) when D3 is built. It needs the game installed and REDbridge 0.14.0.

1. Open a scene with one actor and two clips: the body appears, grey, in a second or two.
2. Drag the playhead: the body takes the pose under it. Press Space: it plays in time.
3. Add a second actor: it stands beside the first. Change its mark in the inspector: it moves and turns.
4. Orbit, zoom and Frame. Drag the splitter: the viewport resizes.
5. Stop the playhead in a gap: the last clip goes on looping.
6. Trim a clip, change its speed and loops: the preview follows.
7. Choose V on a track: a headless body, with its line.
8. A clip made for another rig: the body holds its pose and the viewport says so.
9. Close and reopen the scene: the bodies come back at once, from the PC's folder.

## Unverified until built

- That four or five bodies of 500 joints each play smoothly in the editor's page. REDcode plays one.
- That the page may load files from a folder outside the extension through VS Code's own file addresses. It is how VS Code documents it; EDGEdir has not done it yet.
- The base body's files for each of V's rigs: taken from REDcode's code, to be tried in D3.1.

## Out of D3

Textured bodies. Faces and lip sync. The camera track's view, lights and weather (D6). Blended transitions (D4). Root motion and walking (D5 plans how the scene moves a person). Anything in the game.
