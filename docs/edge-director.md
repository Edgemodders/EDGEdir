---
title: EDGE Director
---

# <span class="y">EDGE</span> Director

**Status: agreed by the owner on 2026-11-18, all twelve questions as recommended. DR1 The window, DR2 Adjust and DR3 Pins are built (EDGEdir 0.0.27, EDGE Director 0.4.0): not run in the game, and their hand tests have not run. See [What is built](#what-is-built).**

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

## What is built

**DR1 The window, EDGEdir 0.0.24 with EDGE Director 0.2.0 (2026-11-18). Not run in the game. Its hand test with a stand-in ([Tests](testing.html), "DR1 The Director's window") has not run.**

| Part | Where | What it does |
|---|---|---|
| The package | `director/` (was `player/`): `rednode-app.json` (id `edge-director`, a resizable window 620 by 760 at the right, off until switched on), `changelog.md` | One REDnode package with a window, a Node mod and a service |
| The steps of a play | `director/play.mjs` | As D5c built them. New: a play from a moment (`from`), `seek` (the cast kept, each actor jumps to that moment's clip and the cues run on), the loop, `cast()` |
| The Desk in the game | `director/floor.ts` | The Desk's scenes; a scene read with EDGEdir's own code (`src/doc.ts`, `src/seq.ts`, `src/cues.ts`, `src/set.ts`) as a strip, its notes, and what a play is given. Where sets are comes from `roots.json`, which EDGEdir writes into the play folder; with none, the Library alone |
| The stage manager | `director/stage.ts` | What the window asks: open, play, seek, loop, stop, choose (a pin on the actor), Go There (V 1.8 m in front of the actor, facing them). The whole state after each. A request from VS Code plays the editor's sheet and opens the scene's file beside it |
| The mod | `director/mod.ts` | Wires REDnode's `world`, `game`, `api` and `channel` to the above; the play folder as before; looks at the Desk and the open scene's file every 2 s |
| The window | `director/index.html`, `director/page/main.ts`, `director/protocol.ts` | REDnode's kit window with Scenes, the transport, the strip with a ruler to drag the playhead on, Cast, In the game, and the line. It asks over `channel` and draws the state the mod answers with |
| The build | `esbuild.mjs` | `dist/director` (`mod.mjs`, `app.js`, with `rednode` left outside) and `dist/director-standin.mjs` |
| The release file | `tools/release/director-zip.mjs`, the Release workflow | `dist/EDGE-Director-<version>.zip`, laid out like the game folder, on each EDGEdir release beside the `.vsix`. A release stops when `director/changelog.md` has no section for the version or has lines under Unreleased; other runs make a draft zip |
| In the extension | `src/play.ts`, `src/extension.ts` | `DirectorVersion` (the manifest's, built in). EDGEdir copies nothing into the game's folder: when the Director is missing or older it says so and offers **Open the Download**. The developer's command **Copy the Development Director into the Game** copies `dist/director`. The `.vsix` no longer carries the package |
| The stand-in | `director/standin.ts` (`node dist/director-standin.mjs`) | The Director's own code against a made-up world that prints each call, the play folder, and the window's page for a browser on 127.0.0.1 only (requests from another site's page are refused by their Origin). It replaces `tools/player-standin.mjs` |

Left out of DR1, against the plan:

| Left out | Why |
|---|---|
| "The scene that VS Code last played is on top" of Scenes | The scene in the game is marked **In the game** in the list instead; the list is by last change |
| A loop over a stretch of the scene | The whole scene loops. A stretch needs two marks on the ruler: with DR4 |
| VS Code following a play started in the Director | VS Code's line and playhead follow only plays it sent. With DR2, when the editor learns of the Director's changes |
| The kit's look, checked | The page was only seen in a plain browser, without REDnode's kit. How it looks in the game is for the in-game test |

**DR2 Adjust, EDGEdir 0.0.25 with EDGE Director 0.3.0 (2026-11-18). Not run in the game or with VS Code. Its hand test with a stand-in ([Tests](testing.html), "DR2 Adjust") has not run; the owner's is Test F.**

| Part | Where | What it does |
|---|---|---|
| The scene's place | `setPlace` in `src/doc.ts`; `frameOf` in `director/play.mjs` | `"anchor": { "mode": "world", "at": [x, y, z], "yaw": turn }`: the scene's origin at a spot in the world, its Forward pointing along the turn. The mode was in the document's type since D1 and unused |
| A frame | `frameOf`, `placeOf`, `markAt`, `turnOf` in `director/play.mjs` | The scene's origin and the way its Forward points, for a scene on a set, at a place, or in front of V. A mark to a place in the world and back. The player keeps the frame of the scene in the game (`frame()`, `reframe()`), and `place()` moves an actor as they play (`world.move`) |
| One change to the file | `edit` in `director/floor.ts` | Reads the file, applies one of EDGEdir's own edits (`setMark`, `setPlace`), writes it whole through a temp file. An edit's refusal is shown in its own words |
| The unsaved rule | `writeUnsaved` in `src/play.ts`, `tellUnsaved` in `src/extension.ts`; `unsavedIn`, `isUnsaved` in `director/floor.ts` | EDGEdir writes the scenes it has unsaved into the play folder (`editor.json`), at each change and every 3 s while there are any; a list older than 10 s counts as empty. The Director plays such a scene and refuses to change it |
| Adjust | `director/stage.ts` (`moveToV`, `nudge`, `mark`, `here`, `front`), the window's **Adjust** section | Move to V; Left, Right, Forward, Back by 10 cm; Turn by 15 degrees; **The Scene Is Here** and **In Front of V**. After each change the people in the game are put where the scene now has them |
| In VS Code | Nothing new | The scene editor is a text editor underneath, and VS Code reads a file again when it changes on disk and the tab has nothing unsaved. **Unverified:** that the editor shows it at once, and that Undo takes it back |

How DR2 differs from the plan:

| Plan | Built |
|---|---|
| The Scene Is Here: the scene's place is V's place | A scene in the game keeps the spot it plays at, so nobody moves; with none in the game, the spot a play would use now (3 m in front of V). V's own place would put an actor with no mark on top of V |
| "Unsaved in VS Code", with the adjust buttons off | As planned, as a yellow box. The list is EDGEdir's, in the play folder |
| The numbers, typed | Shown, not typed: the window has no number boxes yet. The stage manager takes typed numbers (`mark`); VS Code's inspector is where they are typed |
| A change to clips takes effect at Start Again | Not in DR2: the Director changes no clips yet (DR4) |

**DR3 Pins, part 1: the document and the Director. EDGEdir 0.0.26 with EDGE Director 0.4.0 (2026-11-18). Not run in the game. Its hand test with a stand-in ([Tests](testing.html), "DR3 Pins") has not run; the owner's is Test G.**

| Part | Where | What it does |
|---|---|---|
| A pin file | `parsePins`, `formatPins` in `src/pins.ts` | REDnode's `rednode-pins` version 1, read and written as REDnode does; fields not known are left out on reading, and a pin's text and look are kept |
| The link | `linkPins`, `unlinkPins`, `pinsOf` | `"pins": { "path", "name", "pins": [{ "title", "at": [x, y, z] }] }`: the file (a name beside the scene's file, or a full path) and the pins as last read, so the scene opens without the file |
| Following a pin | `markAtPin`, `placeAtPin`, `follow`, `forgetPin`, `renamePin`, `usedPins` | A mark or the scene's place keeps its numbers and the pin's title beside them (`at.pin`, `anchor.pin`). `follow` brings the numbers up to the pins: first the place, then each mark. So everything that reads a mark (the preview, the cue sheet, the player) is unchanged. A mark typed or nudged by hand lets go of its pin |
| A scene needs a place | `markAtPin` | A scene in front of V has no places in the world, so a mark there cannot follow a pin: the scene is first given a place (The Scene Is Here, or Scene Here on a pin) or is on a set |
| The scene's own pin file | `pinFileOf`, `readPinFile`, `writePinFile`, `syncPins` in `director/floor.ts` | `<scene>.pins.json` beside the scene's file on the Desk, written by the Director. Read again whenever the scene is: a pin moved there by any hand moves what follows it, as one change to the scene's file |
| In the window | `director/stage.ts` (`drop`, `removePin`, `markAtPin`, `placeAtPin`, `goToPin`), the **Pins** section | Drop a Pin Here with a typed name; for each pin its distance, what follows it, Go There, the chosen actor Here, Scene Here, Drop Again, Remove. The open scene's pins are drawn in the world with `world.pin` and taken away when it is closed |

How it differs from the design's pins section, and what is left for part 2:

| Point | Built, or left |
|---|---|
| N1: pin files are read and never written by EDGEdir | The Director writes one kind: the scene's own pin file, which it made (R5). It never writes a set in REDnode's folder or any other file |
| The Director draws and drops through REDnode's calls | It draws with `world.pin`. It writes the scene's file itself, in REDnode's format, rather than through `world.pinSet.save`: the stage manager then runs with no game, and the file is the same. **Unverified:** whether REDnode's Pins window lists these pins (Test G8) |
| Rename a pin | `renamePin` is in the document's code; the window has no button yet. Drop Again and Remove cover moving and deleting |
| In VS Code | Part 2, below |
| A pin's id and facing | Waits for REDnode #50, part 3. Pins are named by title |

**DR3 Pins, part 2: the editor. EDGEdir 0.0.27 (2026-11-18). Not run in VS Code. Its hand test ([Tests](testing.html), "DR3 Pins in the editor") has not run.**

| Part | Where | What it does |
|---|---|---|
| The Pins section | `webview/editor.ts`, the scene's inspector | The pin file's name and its pins, each with its place and what follows it; **The scene's place** (In front of V, or a pin); **Choose Pins...**; **Remove Pins**. The edits are the document's own (`placeAtPin`, `setPlace`, `unlinkPins`), made in the page as every edit is |
| At pin | The track's inspector | A list of the scene's pins for an actor's mark; None lets go. A typed Right, Forward or Turn lets go too |
| Posts | `setPins` in `webview/preview.ts`; `postsOf` in the page | Each pin within 150 m of the scene's origin as a thin yellow post with its title. `edgedirPreview.state().pins` counts them. None while the scene plays in front of V |
| Choose Pins | `findPinFiles`, `pinPathFor`, `rednodePinsDir` in `director/floor.ts`; the `PinsHost` in `src/editor.ts`, built in `src/extension.ts` | Offers the pin files beside the scene, the player's sets in REDnode's folder (`%APPDATA%\@rednode\overlay\pins`, read only, as REDnode agreed on its #50), those in the open project, and Browse. A file beside the scene is linked by its name alone, any other by its full path |
| Following the file | `PinsHost.sync`, and `fs.watchFile` in `src/editor.ts` | When the scene opens, and within about 1.5 s of the pin file changing while it is open, the scene takes the file's pins as one edit. Nothing is written when the pins are the same, so the tab stays saved |

Left out: a rename button for a pin, in either tool; a pin's own second line of text shown anywhere; pins further than 150 m from the origin in the preview (they are listed in the inspector).

**First run in the game, 2026-11-20 (the owner's Test E, round 1, on 0.5.0; [Tests](testing.html)):** EDGE Director started, its window listed the Desk, and a scene of two people played through: workspots written in 2 s, people spawned in 2 s, every jump on time (3 to 9 ms late), the actors on the sides their marks give. So these are no longer unverified: that the window and its mod hear each other over `channel`, the play's steps, and left and right of the marks. From that round, **EDGE Director 0.6.0** (EDGEdir 0.0.29): **Pause** and **Resume** (`pause`, `resume` in `director/play.mjs`; state `paused`, `pausedAt`); an actor holds the last pose of their last clip (`sheet.ends` from `src/cues.ts`; `still` in the player; `deps.freeze`, which in `director/mod.ts` is the game's `SetIndividualTimeDilation` on that one person, **unverified in the game**); the strip's taller lanes, the bar that sizes it, and the playhead kept in sight at the end.

Unverified until the game, beside the list below: that a page and its mod of one package hear each other over `channel` as EDGEbuilder's do (read from EDGEbuilder's source, not run here); `world.pin` on a spawned person and `game.player.teleport` from this mod; a jump to a clip the actor already plays (Start Again with one clip).

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

## Questions and the owner's answers

All agreed as recommended on 2026-11-18.

| # | Question | Agreed |
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
