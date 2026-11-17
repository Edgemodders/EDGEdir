---
title: D5 Play in game
---

# <span class="y">D5</span> Play in game

**Status: agreed by the owner on 2026-11-17 (all seven questions as recommended, and the six on sets). All four parts are built: D5b The cue sheet (EDGEdir 0.0.16), D5a Sets (0.0.17), D5c The player and D5d Play in game (0.0.21). Every hand test in VS Code has passed by script; the player has not run in the game yet.** What is built is at the end. The part about sets rests on the design's [Sets](design.html#sets-the-stage-from-edgebuilder) section.

D5 is the fifth phase of the [design](design.html). A scene's actor tracks play on real people in the running game, started from VS Code. Audio, camera and weather tracks are D6. A mod a player installs is D7.

## What D5 ends with

The D4 scene (two actors, clips, a transition, a sequence block) plays on real people in front of V, started by **Play in game** in the editor. EDGEdir says before the play what the game will not match, and the tester notes how far the game is from the preview.

## What D5 rests on

| Fact | From | Consequence |
|---|---|---|
| `world.writeWorkspot(name, { rig, clips: [{ set, anim, name, loop }] })` writes one workspot from a list of the game's animations and swaps it in. The first write took 29 s, REDbridge's start included | REDnode 0.66.9, passed in the game | EDGEdir writes no game files. One workspot per actor track |
| `world.spawn({ record, workspot })` gives a person the workspot; `world.useWorkspot` starts it; `world.jumpWorkspot(id, name)` jumps at once, with the game's own blend | REDnode #46 | A clip is one timed jump |
| Timed jumps were 0 to 13 ms late, and two actors jumped in the same frame | REDnode #46's spike | Timers in a package are good enough for D5 (the design's route 1, agreed as Q3) |
| A person shows a brief T pose at their first play | REDnode #46 | Every actor is started once before the scene shows them |
| `world.jumpWorkspot` answers false until `world.useWorkspot` has run | REDnode #46 | The player always starts the workspot first |
| A workspot entry has no in point, speed or repeat count | REDnode #46 | A clip is cut short, or repeated, by the next timed jump. `in` and `speed` have no route in the game |
| Root motion is not applied: the person moved 0.00 m | REDnode #46 | Actors play in place, as in the preview |
| The game's blend at a jump is about 0.5 s and looks like inertialization. Not measured, and not settable for each jump | REDnode #46's answer from the files | A transition's method, length and ease stay in the preview. If REDnode's next round finds a field that sets the blend, `world.writeWorkspot` gets `blend` for each clip and D5 passes the transition's length |
| A made animation (EDGEfab's) cannot reach the game: REDbridge has no `.anims` import (#14) | The design | A made clip is left out of the play, and EDGEdir says so |
| V in the game needs a spike: the real V in a workspot, or a stand-in copy | REDnode #47, unverified | V's track does not play in D5 |
| A package's spawns are removed when it stops | REDnode | Stop, and a crash, leave nobody behind |
| A tool on the PC reaches the running game through REDnode's editor channel: this PC only (`127.0.0.1`), a bearer token made new each run and readable only by the player's own programs, and the player's Allow in the game the first time a tool asks | REDnode #17, #44 | The channel has sound and TweakDB calls today. It has no call that reaches a package |

## The parts

| Part | Builds | Needs the game |
|---|---|---|
| **D5a Sets** | The Sets view, New Scene on This Set, the link to the set, marks from the set, props as boxes in the preview. As the design's Sets section proposes | No |
| **D5b The cue sheet** | A pure function from a scene to what the game is told: the cast, each actor's workspot clips, the cues in time order, and the notes on what will not match. A **Game** section in the inspector shows the notes for the selected clip | No |
| **D5c The player** | One REDnode package, `edgedir-player`, that plays a cue sheet: writes the workspots, spawns and warms up the cast, runs the timers, stops and clears up | Yes |
| **D5d Play in game** | The transport's **Play in game** and **Stop**, the player's install, the status line, the playhead running with the play | Yes |

D5a and D5b can be built in either order. D5c and D5d need D5b.

## The cue sheet (D5b)

A plain JSON object, made new for each play. It names the game's files and holds none of their data.

```json
{
  "cues": 1,
  "scene": "Alley talk",
  "length": 12.4,
  "anchor": { "mode": "player", "distance": 3 },
  "cast": [
    {
      "track": "t1", "name": "Fixer",
      "record": "Character.<record>", "appearance": "<appearance>",
      "rig": "<path>.rig",
      "at": { "x": 0, "y": 0, "yaw": 180 },
      "clips": [
        { "name": "c1", "set": "<path>.anims", "anim": "<animation name>" },
        { "name": "c3", "set": "<path>.anims", "anim": "<animation name>" }
      ]
    }
  ],
  "timeline": [
    { "t": 0, "track": "t1", "jump": "c1" },
    { "t": 3.2, "track": "t1", "jump": "c3" }
  ]
}
```

| Rule | Why |
|---|---|
| One workspot entry for each animation clip on the track, named by the clip's id. Every entry loops | In a gap the preview loops the last clip; a looping entry does the same with no cue |
| A cue at each clip's start: jump to its entry | The game blends at the jump by itself |
| A clip with loops, or cut short by `out`, needs no cue of its own: the next clip's jump ends it. A clip that repeats is one looping entry | An entry has no repeat count, and needs none |
| A sequence block is opened out into its clips, as the preview does (`flat` in `src/pose.ts`) | A block is its clips in the game (the design) |
| Clips that are passed over in the preview are passed over here: a clip for another rig, a muted track | The game shows what the preview shows |
| A transition makes no cue | The game's blend is its own. If REDnode gives `blend` for each clip, the transition's length goes there |
| A track with no actor chosen, the base body stand-in, or V is left out of the cast | Nobody to spawn; V waits for #47 |

### The notes: what the game will not match

Made with the cue sheet, shown before the play and in the inspector. Each names its clip.

| Note | When |
|---|---|
| Starts from the animation's beginning in the game | A clip with `in` above 0 |
| Plays at normal speed in the game | A clip with `speed` other than 1 |
| Left out: a made animation cannot reach the game yet | A clip that names an EDGEfab animation by its id |
| The game joins these with its own blend of about half a second (not measured) | Every transition; and it says the method and ease are the preview's |
| The game blends here; the preview cuts | A join with no transition. Unverified until measured: whether a blend time of 0 can make a cut |
| V does not play in the game yet | A track whose actor is V |
| Left out: no actor chosen | An actor track with clips and no actor |

## The player (D5c)

One package for every scene: a REDnode Node mod, `edgedir-player`, kept in this repo under `player/` and shipped inside the extension. It is given a cue sheet and plays it. The same package later plays packed scenes on a player's PC (D7), so D5 and D7 share one player.

| Step | What the player does |
|---|---|
| 1. Write | `world.writeWorkspot` once for each cast member, named by scene and track. A workspot whose clips have not changed since the last play is not written again |
| 2. Place | The anchor: 3 m in front of V, facing V, on V's ground height (or the set's place, with D5a). Each mark is the anchor plus the actor's `at` |
| 3. Spawn and warm up | Each person is spawned with their workspot, started with `world.useWorkspot` on their first clip, and given a moment for the T pose to pass. Where they are during it is the in-game test's question: at their mark, or out of view and then moved (`world.move`; **unverified** that a moved person stays in the workspot) |
| 4. Play | One timer for each cue, all from one start time. At a cue: `world.jumpWorkspot` |
| 5. End | At the scene's length the cast holds its last clips, looping, until Stop. Stop removes the cast. A new play stops the old one first |
| 6. Report | Each step answers with what happened: written, spawned, started (with the start time), each cue's lateness, stopped, or the error in words |

It needs the `bridge` and `archives` permissions, which the player allows in REDnode's Mod Manager, and REDnode 0.66.9 or later with REDbridge beside it.

## Play in game (D5d)

| Part | What |
|---|---|
| The button | **Play in game** in the transport, beside play and stop. While a play runs it reads **Stop in game** |
| Before the play | The notes above, in one list, when there are any: **Play anyway** or **Cancel**. Not asked again for the same scene until its notes change |
| The status line | "Writing 2 workspots", "Spawning", "Playing", then the time. An error says what and what to do: the game is not running, REDnode is too old, the player is switched off, a permission is not allowed |
| The playhead | Runs in the editor from the start time the player answered, so the lanes show where the game is. It is VS Code's clock, not the game's: a pause menu in the game puts them apart |
| From where | From the scene's start |
| The install | The first Play in game finds no player in the game: EDGEdir asks, then copies `edgedir-player` into the game's REDnode apps folder (`red4ext\plugins\REDnode\apps\`). A newer EDGEdir replaces an older player the same way, after asking |

### How VS Code reaches the player

| Way | How | Locked by | State |
|---|---|---|---|
| **A. The editor channel** | A new REDnode call, `POST /editor/service.call` `{ editor, package, call, args }`, that calls a function the package offers as a service, and answers with its answer | As the channel is: this PC only, a bearer token made new each run that only the player's own programs can read, and the player's Allow in the game the first time EDGEdir asks | Agreed in principle by REDnode on 2026-11-17 (#48), in this shape, with an Allow for each editor and package. Not built; the owner sets when |
| **B. An inbox file** | EDGEdir writes the cue sheet into a folder under `%LOCALAPPDATA%\EDGEdir\play\`; the player watches the folder and writes its answers beside it | The folder is in the player's own Windows profile: only their own programs can write it. No port is opened | **Built, EDGEdir 0.0.21.** REDnode says a Node mod has Node's own `fs` and may watch the folder with no permission (#48); not run in the game yet |

A is the right one: it answers at once, it goes through the player's Allow, and EDGEhack's Try Live already works that way. B is the fallback if A is not in REDnode when D5d is built, and so D5d is built on B. The player's service file already offers `play`, `stop` and `state`, so the change to A is in EDGEdir's `src/play.ts` alone.

## Tests

| Test | Kind | Covers |
|---|---|---|
| Unit | Automated | The cue sheet and the notes from made-up scenes |
| D5a Sets | Hand, in VS Code, by script | The view, a scene from a set, the link's refresh |
| D5b The cue sheet | Hand, in VS Code, by script | The Game section's notes on real clips |
| D5 in the game | In the game, numbered steps, on the owner's PC | Below |
| Spot tests | The owner | One for sets, one for Play in game |

What the in-game test answers:

| # | Question |
|---|---|
| G1 | Do two actors spawn at their marks and play their clips in time with each other? |
| G2 | Where must an actor be during the first play's T pose so nobody sees it, and does a moved actor stay in the workspot? |
| G3 | Which way does Turn turn in the game against the preview? |
| G4 | How does the game's blend at a join look against the preview's Blend and Inertial? |
| G5 | Does a clip cut short, and a clip repeated, look as in the preview? |
| G6 | Does Stop remove everybody, and does a second play start clean? |
| G7 | How long is the wait from the button to the first frame, on the first play and on the next? |

## Requests

| To | Need | State |
|---|---|---|
| REDnode #48 | `/editor/service.call` on the editor channel (way A) | Agreed in principle 2026-11-17; not built |
| REDnode #48 | Directing a person who was not spawned with the workspot (the owner's question), or else `world.load` leaving out the people a scene directs | Answered 2026-11-17: directing needs a spike step on a plain person, with #47's. Sets need neither: `world.load` takes the scene as an object, so the player takes the directed people out itself. A `skip` option may come with the call above |
| REDnode #46 | The measured blend at a jump, and `blend` for each clip of `world.writeWorkspot` if a field sets it | Open; REDnode's next in-game round |
| REDnode #47 | V in the game: the spike | Open |

## Left out of D5

| Left out | Goes to |
|---|---|
| Audio, camera and weather in the game (REDnode 0.66.10 has `world.setWeather`, not yet tested in the game) | D6 |
| V as an actor in the game | After #47's spike |
| Play from the playhead, pause, the game's clock driving the playhead | With REDnode's scene player (the design's route 2) |
| Made animations in the game; baked transitions | D7, with REDbridge #14's import |
| Moving an actor along a path | Later |
| A packed mod | D7 |

## Questions and the owner's answers

All agreed as recommended on 2026-11-17.

| # | Question | Agreed |
|---|---|---|
| P1 | One player package that is given cue sheets, for D5 and for packed scenes in D7, and not a new package made for each scene? | Yes |
| P2 | File the REDnode request for a call on the editor channel that reaches a package's service, and use the inbox file only if it is not there in time? | Yes |
| P3 | May EDGEdir copy its player into the game's REDnode apps folder itself, after asking once? | Yes |
| P4 | V's track is left out of the play, with a note, until #47's spike? | Yes |
| P5 | Play in game always plays from the scene's start in D5? | Yes |
| P6 | A scene whose clips the game cannot match (`in`, `speed`, a made animation) still plays, after the list is shown? | Yes |
| P7 | The order: D5b the cue sheet first, since it needs nothing; D5a Sets once its six questions are answered; then D5c and D5d with the in-game test? | Yes |

## What is built

**D5b The cue sheet, EDGEdir 0.0.16 (2026-11-17). Its hand test passed by script, 10 of 10 ([Tests](testing.html)); 0.0.18 moves In the game near the top of the inspector and leaves it out of a sequence's own tab.**

| Part | Where |
|---|---|
| The cue sheet and its notes | `src/cues.ts`: `cuesOf(doc)` answers `{ sheet, notes }`, a pure function with no VS Code, page or game in it. `notesFor(notes, track, clip)` picks the notes of one clip; a sequence block gets those of the clips in it, and a clip on a track that is left out gets the track's reason |
| The inspector | `webview/editor.ts`: a selected clip on an actor track shows **In the game**, with one line for each note (`p.game`, its kind in `data-kind`). The cut at a join with no transition is not repeated there: the line D4 put above it already says it |
| Unit tests | `test/cues.test.ts`, 7 tests: entries and jumps, two actors in time order, `in`, `speed` and loops, transitions, who is left out, made animations, sequence blocks |

**D5a Sets, EDGEdir 0.0.17 (2026-11-17). Its hand test by script passed 11 of 14 steps on 0.0.18; the three misses were fixed in 0.0.19 and passed their rerun ([Tests](testing.html)).**

| Part | Where |
|---|---|
| Reading a set | `src/set.ts`, pure: `parseSet` reads EDGEbuilder's scene format 1 and 2 into people (`npc`), props (everything else; a size where the file gives `bounds`) and a count of vehicles. `yawOf` turns a rotation into degrees about the up axis |
| The link | `src/set.ts`: the scene keeps `"set": { where, path, name, hash, origin }` and `"anchor": { "mode": "set" }`; a track from the set keeps `"from": "<object id>"`. `chooseSet`, `removeSet`, `addSetPeople`, `syncSet` (marks follow the set; the same document comes back when nothing changed, so an unchanged scene is not unsaved), `stageOf` (what the page is told) |
| The origin | The middle of the set's people when the set is chosen, on the lowest one's ground; of all objects when it has no people. It stays there (0.0.19: at first it followed the set's people, so everyone's mark moved when one person did). Marks are metres from it, so they stay small numbers |
| A placed actor | `setMark` in `src/doc.ts` refuses a track that came from the set: the inspector shows its place as facts, and says to move the person in EDGEbuilder |
| Finding sets | `src/setFiles.ts`: `findSets` walks the Library and the project's `source/scenes` as EDGEbuilder does; `readSet` reads a link's file or says why it cannot; a link never leads out of its root |
| The view | `src/setsView.ts`: **Sets**, between Desk and Library. Groups Project and Library; each set with its people, vehicles and props counted, and under it the Desk's scenes that play on it. **New Scene on This Set** on each row; Refresh |
| In the editor | `src/extension.ts` (the `SetHost`): on open the scene is brought up to its set; the inspector's **Set** section (`#f-set`, its state in `data-state`) has Choose Set, Remove Set and Add People from the Set. The page's message is `set`, the `doc` message carries `stage` |
| The preview | `webview/preview.ts`: each prop with a size is a grey box at its place, turned about the up axis only; `edgedirPreview.state().props` counts them; Frame takes them in |
| An actor from the set | Read from the game as the picker does (the record's entity, its rig); the set's appearance when the entity has it, else the game picks. Without the game's files the track has the record alone |
| Unit tests | `test/set.test.ts`, 4 tests |

Looked at in a plain browser with the page harness: the Set section, a placed actor's facts and note, and two boxes counted by the preview. The boxes were not seen by eye (the browser tool's screenshot failed). The hand test's round then showed the Sets view, its commands and a set file working inside VS Code, and the boxes by sight (light grey outlines on the floor). **Still unverified:** a scene EDGEbuilder itself saved (the round's file was written by hand in its format).

Not built, against the design's Sets section:

| Left out | Why |
|---|---|
| Vehicle tracks | EDGEbuilder has no vehicle kind yet (its #6). A set's vehicles are counted and said to have no track |
| A box turned as the prop is, in all three axes | Only the turn about the up axis is used. A tilted prop's box stands upright |
| Lights and props with no `bounds` | Not drawn |
| The set in the game | D5c, and REDnode #48's answer on directing a person who is already there |

**D5c The player and D5d Play in game, EDGEdir 0.0.21 (2026-11-17). The hand test in VS Code passed by script, 13 of 13, against a stand-in for the player ([Tests](testing.html)). Not run in the game yet.** Built on way B, the folder, after REDnode's answer on #48.

| Part | Where |
|---|---|
| The player package | `player/`: `rednode-app.json` (`edgedir-player` 0.1.0; permissions `bridge` and `archives`; REDnode 0.66.9 or later), `play.mjs` (the six steps, with the world's calls handed in so it runs in a unit test), `inbox.mjs` (the folder), `mod.mjs` (REDnode's `world`, V's place, the folder), `service.mjs` (`play`, `stop`, `state` for way A and for other packages). It ships inside the extension |
| Write | One workspot for each cast member, named `<scene>_<track>`. The game takes them in one swap, with the last one written. A workspot whose rig and clips have not changed since the package started is not written again |
| Place | In front of V: the anchor is 3 m ahead, Right and Forward are as V sees them, and a Turn of 180 faces V. On a set: metres east and north of the scene's origin, at the height the set gives the person. **Unverified against the game** (G3) |
| The set | The set's file comes with the request. The player loads it with `world.load` under the name `edgedir-set`, without the people the cue sheet directs, and spawns those with their workspots. People of the set the scene does not direct stand as the set has them |
| Warm up | Everyone is spawned at their mark, started on their first clip, and given 1.5 s. Whether the T pose shows is G2's question |
| Play, end, stop | One timer for each cue from one start time; each cue's lateness is kept. At the scene's length the state is `ended` and the cast holds. Stop, a new play and a failure remove the cast and unload the set |
| The folder | `%LOCALAPPDATA%\EDGEdir\play`: EDGEdir writes `request.json` (`id`, `at`, `do`, `sheet`, `stage`); the player writes `state.json` and, every 2 s, `alive.json`. Each file is written whole. A request older than the player's start is not played |
| EDGEdir's side | `src/play.ts`, no VS Code: `request`, `readState`, `alive`, `stageFor`, `installState`, `install`, `lineOf` |
| The button | `webview/editor.ts`: **Play in Game** beside the transport (`#gamePlay`), **Stop in Game** while a play is on; the line at the right of the toolbar (`#gameLine`); the playhead runs from the start time the player answered and stays at the end. Not shown in a sequence's own tab |
| Before the play | `src/extension.ts` (the `PlayHost`): the notes in one list with **Play Anyway**, asked again only when they change; a scene with nobody to play says why; a set that is not found stops the play |
| The install | The first play that finds no player running asks, then copies `player/` into `red4ext\plugins\REDnode\apps\edgedir-player` and waits 12 s for it to say it is alive. An older one in the game is replaced the same way. Without REDnode in the game's folder it says so |
| The stand-in | `tools/player-standin.mjs`: the player's own steps and folder against a made-up world that prints each call, for the hand test in VS Code with no game |
| Unit tests | `test/play.test.ts`, 5 tests |

Looked at: the stand-in played a request written by hand (write, spawn, start, two jumps 13 and 0 ms late, ended); the page in a plain browser with the harness (the button's two readings, the line, the playhead running from the start time, Space refused during a play in the game).

REDnode's answers on #48 about the player (2026-11-17, from its code, not run in the game):

| Question | Answer | In EDGEdir |
|---|---|---|
| Does the last workspot's swap carry the ones written before it with `swap: false`? | Yes: each write packs the package's whole folder of workspots, earlier runs' files too | As built |
| Do `mod.mjs` and `service.mjs` share `globalThis`? | Yes: one worker, the same globals and module instances | As built |
| Does a package hear that it is being stopped? | No: the worker is ended, no handler runs, and REDnode then removes its spawns. A heartbeat older than about 5 s means stopped | 0.0.22: the player counts as running for 5 s after its last word; a play whose player falls silent says so in the line by itself, and the button goes back to Play in Game |
| How long are a written workspot's entry names known? | For the package's run only | The player's own list of what it has written lives as long, so a new run writes again |

Not built, against the plan:

| Left out | Why |
|---|---|
| The editor channel (way A) | Not in REDnode yet |
| Actors out of view during the warm-up | G2 decides it: `world.move` on a person in a workspot is unverified |
| The transition's length passed to the game | Waits for REDnode #46's measurement and a `blend` for each clip |
| Each cue's lateness shown in the editor | It is in `state.json` (`late`); the line only counts jumps that did not land |

### D5b, looked at

Looked at in a plain browser with the page harness and real clips: a clip given an In of 1 s and a Speed of 2 shows both lines under In the game.

As built, against the plan:

| Point | Built |
|---|---|
| An entry's name | The clip's id with every character but letters, digits and `_` made `_`, so a block's inner clip `c5/c2` is `c5_c2`. What names `world.writeWorkspot` takes is **unverified** |
| A made animation | Left out; the clip after it is not called a cut, since nothing played before it in the game |
| A track with only clips the game cannot play | Not in the cast, and nobody is spawned for it |
| The scene-wide list before a play | Not built: it comes with Play in game (D5d) |
