---
title: EDGE Director
---

# <span class="y">EDGE</span> Director

**Status: a plan for the owner's review, written 2026-11-18 from the owner's note of the same day. Not agreed, nothing built.** Twelve questions are at the end.

The owner's words: an "EDGE Director" REDnode app that is part of the EDGEdir tool set. It can place and manage pins if it needs to, but its main purpose is to carry the workflow of directing, playing and adjusting a scene over to inside the game.

## What it is

| | EDGEdir in VS Code | EDGE Director in the game |
|---|---|---|
| Is | The editor: the timeline, the clips, the preview on grey bodies | The floor: the same scene, on real people, in its real place |
| Best at | Building a scene: choosing animations, timing, transitions, sequences | Seeing it, and putting things right where they stand: places, facings, the scene's spot on the map, shots |
| Works on | `<name>.edgedir` files on the Desk | The same files. There is one scene, not a copy for each side |
| Runs without the other | Yes | Yes: a modder can open, play and adjust a scene with VS Code closed |

It ends the split of today, where the scene can be played in the game only by a button in VS Code, and nothing comes back.

## What it rests on

| Fact | From | Consequence |
|---|---|---|
| EDGEdir Player (`edgedir-player`, under `player/`) spawns a cue sheet's cast, plays it on timers, stops, and loads a set. Built; never run in the game | [D5](d5-play-in-game.html) | The Director is that package with a window. The steps that play a scene stay as they are |
| One REDnode package can have a window (`entry`), a Node mod (`main`) and a service (`service`) together. The page is a bundled script that imports from `rednode` and talks to its own mod | EDGEbuilder's package | One package, not two |
| The scene document, every edit, the cue sheet and the set's rules are code with no VS Code in it (`src/doc.ts`, `src/seq.ts`, `src/cues.ts`, `src/set.ts`) | EDGEdir's source | The Director is built with the same code, bundled into it. A scene opened in the game obeys the same rules as in the editor, and no second copy of them is written |
| A Node mod can read and watch a folder | REDnode's answer on its #48 | The Director reads the Desk (`%LOCALAPPDATA%\EDGEdir\desk`) itself. It is EDGEdir's own Desk, so no rule on other tools' folders is touched |
| World pins: `world.pin`, pin sets in `.pins.json` files, the Pins window | REDnode #43, passed in the game | The Director draws and drops pins through REDnode's calls. It does not make a second kind of pin |
| REDnode ends a package with no notice and removes its spawns | REDnode #48 | Every change is saved to the scene's file as it is made. Nothing is kept only in the window |
| The window takes the mouse only in the overlay's interactive mode (F10) | REDnode | Directing is done with the window open and the game behind it, as EDGEbuilder is used |

## What the window has

| Part | Shows and does |
|---|---|
| **Scenes** | The Desk's scenes, newest first, with the set each is on. Open one. The scene that VS Code last played is on top |
| **Transport** | Play, Stop, Start Again, the time, and a bar with the playhead that can be dragged to start from any moment. Loop, for a scene or a stretch of it |
| **Timeline strip** | Each track as one lane with its clips' names, small, with the playhead. At first to read and to choose from; clips are edited from it in a later part |
| **Cast** | Each actor: who, the clip playing now, the distance. **Go There** puts V beside them. Choosing an actor here or on the strip selects them, and a pin with their name marks them in the world |
| **Adjust** | For the chosen actor: **Move to V** (their mark is where V stands, facing as V faces), nudge by 10 cm steps, turn by 15 degree steps, the numbers. For the scene: **The Scene Is Here** (its place on the map is V's place) |
| **Pins** | The scene's pins, with **Drop a Pin Here** into the scene's own pin file, rename, remove, and **Mark at This Pin** for the chosen actor |
| **In the game** | The notes the cue sheet gives: what the game will not play as the preview shows. Late jumps while it plays |
| **Status** | What the player is doing (writing, spawning, warming up, playing), and any failure in words |

## One scene, two tools

| Point | Rule |
|---|---|
| Who writes the file | Either tool. Each writes the whole file through a temp file and a rename, after applying one edit to what is on disk |
| VS Code has the scene open, with nothing unsaved | The editor takes the Director's change as an ordinary edit: it shows at once, and Undo takes it back |
| VS Code has unsaved changes to the scene | The Director is told, shows "Unsaved in VS Code", and its adjust buttons are off for that scene until it is saved. Playing still works, and plays what VS Code has, as Play in Game does today |
| The Director changes a scene while it plays | The change is saved, and the actor is moved at once where that is possible (a mark, a facing). A change to clips takes effect at Start Again |
| How the two know of each other | The play folder (`%LOCALAPPDATA%\EDGEdir\play`), as today: who is alive, what is playing, which scenes have unsaved changes. No port. The folder is in the player's own Windows profile |
| Play in Game in VS Code | Stays. With the Director running it does what the Director's Play does, and both show the same play |

## Parts

| Part | Builds | Needs |
|---|---|---|
| **DR1 The window** | The package becomes EDGE Director: Scenes, Transport, the strip to read, Cast with Go There, In the game, Status. Play, Stop, Start Again and start from a moment, with VS Code closed or open | Nothing new from REDnode |
| **DR2 Adjust** | Move to V, nudge, turn, The Scene Is Here; saved to the file; the editor in VS Code follows; the unsaved rule | Nothing new. "The Scene Is Here" on a scene with no set needs the scene's place as a world position, which the [design's pins section](design.html#pins-named-places-from-rednode) also needs |
| **DR3 Pins** | The Pins part, and the document side of pins (a mark at a pin, the link to a pin file) in the editor too | REDnode's answer on #50 part 1, given. An id on a pin would help (#50 part 3) |
| **DR4 Clips in the game** | Move and trim a clip on the strip, change a transition, add an animation from a search of EDGEdir's index | The index is on disk already (EDGEdir's cache). To plan when DR1 to DR3 are used |
| **With D6** | **Shot from V's View** (a camera shot taken from where V looks), the weather picked from the game's own list, heard sound | [D6](d6-audio-camera-weather.html) |
| **Later** | Walk to a pin; start when V is near; a gizmo to drag an actor, as EDGEbuilder has for props | REDnode #50's spike; its own plans |

## How it is released

The owner's rule (2026-11-18): the Director is a REDnode app that is built and given as its own release file for EDGEdir, as REDnode gives its Admin Tools, UI Tools and Sound Tools from its repo.

How REDnode does it (its `packs/`, `tools/release/pack-zip.mjs` and Release workflow), and the same for EDGEdir:

| Thing | REDnode's packs | EDGE Director |
|---|---|---|
| Source | `packs/<pack>/` in REDnode's repo | `director/` in this repo (today's `player/`, renamed) |
| Version | The pack's own, in `pack.json` | Its own, in `director/rednode-app.json`. Not EDGEdir's |
| Changelog | The pack's own `changelog.md`; a release stops when something is left under Unreleased | `director/changelog.md`, with the same check |
| The file | `<Pack-Name>-<version>.zip`, laid out like the game folder | `EDGE-Director-<version>.zip`: `red4ext/plugins/REDnode/apps/edge-director/`, with the licence. Installed with Vortex or EDGEdeck, or extracted into the game folder |
| Where | Attached to each REDnode release on GitHub, and its own Nexus page | Attached to each EDGEdir release on GitHub beside the `.vsix`. On Nexus: question R11 |
| Needs | The REDnode named in `pack.json` and in the app's `requires` | The same: the app's `requires` names REDnode, Codeware and REDbridge, so the Mod Manager says when one is too old |

| Point | Plan |
|---|---|
| The extension and the Director | The extension knows which Director version it needs. When the one in the game is missing or older, EDGEdir says so and opens the release's page. It no longer copies anything into the game folder by itself (question R10) |
| Why not copy | A file EDGEdir copies into the game folder is not known to the player's mod manager: EDGEdeck and Vortex would not list it, update it or remove it. The copy has also never run |
| For development | A command **Copy the Development Director into the Game** stays for F5 runs, off the release path |
| The release gate | The Director's in-game tests and spot tests gate its zip, as the hand tests gate the `.vsix`. One release run makes both |
| The build | `npm run build` makes the Director's bundle; `tools/release/director-zip.mjs` makes the zip; the Check workflow builds it on every push |

## What changes in what is built

| Thing | Change |
|---|---|
| The package | `player/` becomes `director/`: id `edge-director`, name **EDGE Director**, with `entry`, `main` and `service`, its own version and changelog. EDGEdir Player 0.1.0 was never released or run in the game, so nothing is left behind (question R2) |
| The build | A second bundle: the page and the mod, with EDGEdir's pure code in them, zipped as its own release file. The `.vsix` no longer carries the package, and the question that offers to copy it goes (D5d's steps 3 and 4 change) |
| `player/play.mjs` | Stays the steps of a play. New: start from a moment, loop, move a person while playing |
| A mod a player installs (D7) | Needs a player with no window. D7's plan decides whether that is the Director's own mod part or a small package of its own, built from the same `play.mjs` |
| "D5 in the game" | Its 10 steps are run with the Director's window once DR1 is built: its buttons are in the game, so the test needs fewer trips to VS Code (question R6) |

## Tests

| Test | Kind | Covers |
|---|---|---|
| Unit | Automated | The new steps of a play; the two-writers rule against files on disk |
| The window, in a browser | By script | The page against a stand-in for the game, as `tools/player-standin.mjs` is for the player today |
| With VS Code | Hand, by script | A change made by the stand-in Director shows in the editor and can be undone; the unsaved rule |
| In the game | The owner's PC | Open, play, start again, go to an actor, move one to V, set the scene's place, and see each in VS Code after |
| Spot tests | The owner | One for DR1, one for DR2, one for DR3 |

## Unverified

| Thing | When it is known |
|---|---|
| The player itself in the game: marks and turns, the T pose at the warm-up, the blend at joins | "D5 in the game" |
| Moving a person who is in a workspot with `world.move` while they play | DR2's in-game test |
| How a window of this size sits with the game behind it while a scene is watched (it may want a small "watching" form) | DR1's in-game test |
| That VS Code takes a file's change into an open custom editor as an edit without asking | DR2, in VS Code |

## Questions for the owner

| # | Question | Recommended |
|---|---|---|
| R1 | Is this the shape: one scene file, opened by either tool, with the Director able to work with VS Code closed? | Yes |
| R2 | The player package becomes EDGE Director (id `edge-director`), one package with a window, rather than a second package beside the player? | Yes: the player was never released, and one package is one thing to install and keep current |
| R3 | The window's parts as listed (Scenes, Transport, strip, Cast, Adjust, Pins, In the game, Status)? | Yes |
| R4 | While VS Code has unsaved changes to a scene, the Director may play it but not change it? | Yes: it keeps two tools from overwriting each other |
| R5 | The Director keeps pins in REDnode's pin files and through REDnode's calls, and drops a scene's pins into a pin file of the scene's own? | Yes. This settles N1 to N3 of the design's pins section |
| R6 | "D5 in the game" is run with the Director's window, after DR1, instead of with the button in VS Code first? | Yes: fewer steps for you, and the test then covers what will be used |
| R7 | The order: DR1, DR2, DR3, then D6, with DR4 planned after the first three are used? | Yes |
| R8 | Clip editing in the game (DR4) is wanted, though later? Or is the game side for playing and placing only, with clips always edited in VS Code? | Wanted, later, and small: move, trim, swap an animation |
| R9 | The name in the game's Mod Manager and launcher is **EDGE Director**, and the docs call the whole tool EDGEdir? | Yes |
| R10 | The zip is the only way a player installs the Director: the extension says when it is missing or too old and opens the download, and copies nothing into the game folder (a developer command aside)? | Yes: the mod manager then knows the files |
| R11 | On Nexus, is the Director a second file on EDGEdir's page, or a page of its own as REDnode's packs have? | A second file on EDGEdir's page: it is no use without EDGEdir's scenes. EDGEdir has no Nexus page yet |
| R12 | The Director has its own version and changelog, released in the same run as the extension? | Yes |
