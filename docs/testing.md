---
title: Tests
---

# <span class="y">Tests</span>

Every test run on EDGEdir: how to run it again, what to expect, and what it showed. Each phase ends with a hand test, run in full by script or by the owner, and spot tests of its main features by the owner ([the release gate](#the-release-gate)); new tests are added here when they are first run, and their later runs' results too.

Last updated 2026-11-17.

## At a glance

| Test | Kind | Phase | Last run | Result |
|---|---|---|---|---|
| [Type check, build and unit tests](#type-check-build-and-unit-tests) | Automated, also on GitHub (Check) | Scaffold, D1, D2 | 2026-11-20 | Pass, 88 tests |
| [The owner's tests, A to H](#the-owners-tests) | By hand, the owner: A to D in VS Code, E to H in the game | D1 to D5, DR1 to DR3, D6a | 2026-11-20 | Test E partly run: E1, E2, E3 and E5 pass, in the game for the first time. The rest not run |
| [D6a Weather](#d6a-weather) | Hand, in VS Code with the game's files, and a stand-in for the game | D6a | 2026-11-21 | By script: round 1, 8 of 11 (0.0.29): steps 3, 4 and 6 found no In the game lines on a weather clip. Fixed in 0.0.30, not run |
| [DR3 Pins](#dr3-pins) | Hand, in a browser, with a stand-in for the game; no game | DR3, part 1 | 2026-11-21 | By script: round 1, 10 of 10 (0.0.29, EDGE Director 0.6.0) |
| [DR3 Pins in the editor](#dr3-pins-in-the-editor) | Hand, in VS Code; no game | DR3, part 2 | 2026-11-21 | By script: round 1, 10 of 10 (0.0.29). One change from its notes in 0.0.30, not run |
| [DR2 Adjust](#dr2-adjust) | Hand, in a browser and in VS Code, with a stand-in for the game; no game | DR2 | 2026-11-21 | By script: round 1, 12 of 12 (0.0.29, EDGE Director 0.6.0). Step 10's words changed in EDGE Director 0.6.1 |
| [DR1 The Director's window](#dr1-the-directors-window) | Hand, in a browser and in VS Code, with a stand-in for the game; no game | DR1 | 2026-11-21 | By script: round 1, 12 of 13 (0.0.29, EDGE Director 0.6.0): step 12 missed the In the game tag. Fixed in EDGE Director 0.6.1, not run |
| [D5d Play in game, in VS Code](#d5d-play-in-game-in-vs-code) | Hand, in VS Code, with a stand-in for the player; no game | D5d, D5c | 2026-11-17 | By script: round 1, 13 of 13 (0.0.22); round 2, the fix of 0.0.23 passes. Step 3 as changed in 0.0.24: on 2026-11-21 the "in the game's folder, not running" case passed; the "no Director" case (Open the Download) was not met |
| [D5a Sets](#d5a-sets) | Hand, in VS Code, with the game's files, REDbridge 0.14.0 and an EDGE Library | D5a | 2026-11-17 | By script: round 1, 11 of 14 (0.0.18: steps 2, 7 and 9 each missed one expectation); round 2, those and step 11 pass on 0.0.19. Every step has passed |
| [D5b The cue sheet](#d5b-the-cue-sheet) | Hand, in VS Code, with the game's files and REDbridge 0.14.0 | D5b | 2026-11-17 | By script: 10 of 10 pass (0.0.16); the two changes of 0.0.18 from its notes pass too |
| [D1 Timeline](#d1-timeline) | Hand, in VS Code | D1 | 2026-11-16 | By script: round 1, 22 of 22 (0.0.2); round 2, the three steps new in 0.0.3 pass (0.0.6). Step 23 is a known limit of VS Code's, not a fault |
| [D2 Cast, part 1](#d2-cast-part-1) | Hand, in VS Code, with the game's files | D2.1 to D2.4 | 2026-11-16 | By script: 15 of 15 pass (0.0.6, REDbridge 0.13.0) |
| [D2 Clips, part 2](#d2-clips-part-2) | Hand, in VS Code, with the game's files and REDbridge 0.14.0 | D2.5, D2.6 | 2026-11-16 | By script: 17 of 17 pass (0.0.6, REDbridge 0.14.0) |
| [D2 Made animations, part 3](#d2-made-animations-part-3) | Hand, in VS Code, with an EDGE Library | D2.7 | 2026-11-16 | By script: 6 of 6 pass (0.0.6) |
| [D4b Sequences](#d4b-sequences) | Hand, in VS Code, with the game's files and REDbridge 0.14.0 | D4b | 2026-11-16 | By script: round 1, 19 of 19 (0.0.13); round 2, the five fixes of 0.0.14 pass |
| [D4a Transitions](#d4a-transitions) | Hand, in VS Code, with the game's files and REDbridge 0.14.0 | D4a | 2026-11-16 | By script: round 1, 12 of 15 (0.0.13: steps 3, 4 and 6 failed); round 2, those and four more pass on 0.0.14. Every step has passed |
| [D3 Preview](#d3-preview) | Hand, in VS Code, with the game's files and REDbridge 0.14.0 | D3 | 2026-11-16 | By script: round 1, 17 of 17 (0.0.9); round 2, the four fixes of 0.0.10 pass |

## The release gate

The owner's rule, set on 2026-11-16. A release needs both:

| What | Who | Counts when |
|---|---|---|
| Every hand test of the changes since the last release, in full | A Claude session by script (real mouse and key events in a VS Code window), or the owner | Every step passed in its latest round |
| [The owner's tests](#the-owners-tests), Test A onward, for the major features changed since the last release | The owner, by hand | Each one passed |

The rounds by script are there so that work does not wait for the owner's testing. They do not replace the owner's look at the main features.

## Waiting for a test

Every hand test (D1, D2, D3) has passed a round run by script in another session (2026-11-16). Still open before a release:

- Nothing of the hand tests: every step of D1 to D4 has passed a round by script. (0.0.15's two small changes passed with D5b's round on 2026-11-17.)
- **D5b The cue sheet** passed its round by script (10 of 10), and the two changes of 0.0.18 from its notes passed with D5a's round.
- **D5a Sets** passed: its three misses of round 1 were fixed in 0.0.19 and passed their rerun. 0.0.20's small change from the rerun's notes (the Sets view is read again when a scene is saved) passed with D5d's round. One thing seen once is open: a message about unsaved changes put back with no window reload (D5a's round 2).
- **D5d Play in game, in VS Code** passed its round by script (13 of 13, with a stand-in for the player). The fix of 0.0.23 from its notes (a tab whose scene's play was taken over by another scene says so) passed its rerun. The copy of the player into the game's folder has not run: the round chose Cancel there.
- **The owner's Tests E to H**, in the game with EDGE Director's window (E: 14 steps, play; F: 10 steps, adjust; G: 8 steps, pins; H: 8 steps, weather): not run yet. Nothing of EDGEdir has run in the game at all.
- **DR2 Adjust** passed its round by script (12 of 12, 2026-11-21). The box's words changed in EDGE Director 0.6.1 (the scene plays as it was last saved).
- **DR3 Pins** passed its round by script (10 of 10, 2026-11-21). The owner's is Test G.
- **D6a Weather**: round 1 by script, 8 of 11 (2026-11-21). **Open: a rerun of steps 3, 4, 6 and 11 on 0.0.30**, which shows In the game on a weather clip.
- **DR3 Pins in the editor** passed its round by script (10 of 10, 2026-11-21). Open: step 10 again on 0.0.30 (the scene's place names its gone pin). The owner's is step D3 of Test D.
- **DR1 The Director's window**: round 1 by script, 12 of 13 (2026-11-21). **Open: a rerun of steps 6 and 12 on EDGE Director 0.6.1**, and D5d's step 3 in its "no Director" case (the message with Open the Download), which the round could not meet: the game's folder has EDGE Director now, and `edgedir.gamePath` set to an empty scratch folder was not the folder looked in.
- **The owner's Tests A to D** (the spot tests S1 to S12): none run yet.
- The fix of 0.0.8 (a change the inspector refuses puts its box back) passed in D3's round.

## The owner's tests

What the owner tests by hand, in lettered sections: **Test A**, **Test B** and so on (the owner, 2026-11-18). Each section is one sitting, with what it needs, its steps and its own result line. Do them in order: a later test uses what an earlier one made. A new phase adds to a section or adds the next letter; a letter keeps its meaning.

| Test | What | Needs | About | Result |
|---|---|---|---|---|
| [A](#test-a-the-editor) | The editor: the timeline, play, save, the Desk | VS Code | 10 minutes | Not run yet |
| [B](#test-b-cast-and-animations) | Actors and animations | VS Code, the game's files | 15 minutes, after the first read of the game | Not run yet |
| [C](#test-c-preview-transitions-and-sequences) | The 3D preview, transitions, sequences | As B | 10 minutes | Not run yet |
| [D](#test-d-sets-and-what-the-game-will-not-match) | Sets, what the game will not match, and pins in the editor (its last spot, S15, is best done after Test G) | As B, and an EDGEbuilder scene in the Library | 10 minutes | Not run yet |
| [E](#test-e-edge-director-in-the-game-play) | EDGE Director in the game: open and play a scene | The game running, REDnode, EDGE Director | 30 minutes | Partly run 2026-11-20: E1, E2, E3, E5 pass |
| [F](#test-f-edge-director-in-the-game-adjust) | EDGE Director in the game: adjust a scene | As E | 15 minutes | Not run yet |
| [G](#test-g-edge-director-in-the-game-pins) | EDGE Director in the game: pins | As E | 10 minutes | Not run yet |
| [H](#test-h-weather) | Weather: in the editor, then in the game | As E, with REDnode 0.67.2 or later | 10 minutes | Not run yet |

Tests A to D are the spot tests S1 to S12 and S15, one short test for each major feature; each names the full test it is drawn from, which has the detail. S13 and S14 (play in game, EDGE Director) are Test E now.

**Before Tests A to D:** the game installed (not running) and REDbridge 0.14.0 or later (REDcode's **Install REDbridge** fetches the latest, 0.15.0 on 2026-11-18). Open the EDGEdir folder in VS Code, run `npm run build`, press F5 (**Run EDGEdir**). The first **Read the Game** takes a few minutes, once.

### Test A: The editor

| Spot | Feature | Do | Expect | From |
|---|---|---|---|---|
| S1 | The timeline | In the Desk, **New Scene** `Spot`. **Add Track**: Actor, then Audio. Add two clips to the Actor lane. Drag one, drag an edge, put the playhead in one and press **S**. Press Ctrl+Z three times | Clips move, snap and never overlap; the edge trims by frames; S cuts in two; each Ctrl+Z takes one change back | D1, 1 to 7, 14 |
| S2 | Play, save, the Desk | Press Space, then Space again. Ctrl+S, close the tab, click `Spot` in the Desk | The playhead runs in real time and stops. The scene opens as it was left | D1, 11, 15 |

| Round | Date | Result |
|---|---|---|
| 1 | | Not run yet |

### Test B: Cast and animations

| Spot | Feature | Do | Expect | From |
|---|---|---|---|---|
| S3 | The game's animations | Open the **Animations** view, **Read the Game**. When the status bar's count is done, open **Game** down to an animation file and open it. Search `sit chair` | About 14,000 files in folders; a file opens to its animations with their lengths; the search lists animations with both words | Part 1, 1 to 4; part 2, 1 to 3 |
| S4 | The actor picker | Click the Actor lane's head, **Choose Actor...**, type `judy`, pick Judy Álvarez and an appearance. On a second Actor track choose **V (the player), feminine body** | The track takes the actor's name and the inspector shows Record, Appearance and Rig (`woman_base`). V needs no appearance; V is not offered on the other track | Part 1, 6, 7, 10, 11 |
| S5 | Animations on a track | Select Judy's track, turn on **Only What Fits the Selected Actor**, click the **+** on an animation. On the clip set Speed to 2, then Loops to 3. Add a second clip right after it, then set the first one's Loops to 9 | The clip lands at the playhead, as long as the animation, and is selected. It gets half as long, then three times that, with marks where it starts again. Loops 9 is refused with a message and the box goes back to 3 | Part 2, 4, 5, 9; the fix of 0.0.8 |
| S6 | The rig rule | **Change Actor...** on Judy's track to a man. Then save, close and reopen the scene | Every clip is hatched red and the inspector says Unfit and why; nothing is removed. Reopened, it is the same | Part 2, 13, 16 |
| S7 | A made animation | Run `node tools/made-anim-sample.mjs`, click **Refresh** in the Animations view, click the **+** on `Sample wave`. Then run it with `--remove` | A **Library** group with `Sample wave`, 2.40 s; the clip `sample_wave` lands on the track as a made animation. After the remove and a Refresh the group is gone and the clip stays | Part 3, 1 to 3, 6 |

| Round | Date | Result |
|---|---|---|
| 1 | | Not run yet |

### Test C: Preview, transitions and sequences

| Spot | Feature | Do | Expect | From |
|---|---|---|---|---|
| S8 | The 3D preview | Open the scene of S4 to S6 with Judy's track set back to Judy. Drag the playhead through her clips, then press Space. Select V's track and set **Turn (°)** to 180. Drag in the view, then click **Frame** | Two grey bodies stand side by side above the timeline; V's has no head and the line says it stands in for your V. Judy takes the pose under the playhead and plays in time. V turns round. The view orbits, and Frame fits both | D3, 2 to 8, 12 |
| S9 | Transitions | In the scene of S8, give Judy two clips end to end. Put the playhead near the join, **Add Transition**. Drag the playhead through it, then play. Set **Method** to Inertial and play again. Drag the transition off the second clip's start | The body moves from one clip into the other with no jump, with both methods; say which looks better. Off the second clip's start the transition gets a yellow bar and the inspector says Preview only | D4a, 3 to 8 |
| S10 | Sequences | In the scene of S9, select Judy's two clips and click **Save as Sequence**; name it and keep the clips. Give a second actor track another woman, select it, and click the **+** on the sequence in the Desk. Play. Double-click the block | The Desk lists the sequence under **Sequences**. One block lands on the second track and that actor plays the same movement. The sequence opens in its own tab with one lane and a grey base body | D4b, 2 to 4, 7 |

| Round | Date | Result |
|---|---|---|
| 1 | | Not run yet |

### Test D: Sets and what the game will not match

| Spot | Feature | Do | Expect | From |
|---|---|---|---|---|
| S11 | What the game will not match | Select one of Judy's clips and type 1 in **In (s)** | **In the game** appears in the inspector and says the game starts the clip from its beginning. | [D5b](#d5b-the-cue-sheet) |
| S12 | Sets | With an EDGEbuilder scene that has people saved in your EDGE Library: open the **Sets** view and click the **+** on it | A scene opens with a track for each person, their bodies standing in the preview as the set has them, and grey boxes for its props. | [D5a](#d5a-sets) |
| S15 | Pins in the editor | After Test G (the scene then has pins), or with a pin set of yours from the game: open the scene in VS Code, click an empty part of the timeline, and under **Pins** click **Choose Pins...** and pick a file. Set **The scene's place** to a pin. Select an actor's track and set **At pin** to another | The Pins section lists the pins. The pins stand in the 3D preview as yellow posts with their names, and the actor's body stands at its pin. The inspector's Right and Forward are the pin's place from the scene's origin | [DR3 Pins in the editor](#dr3-pins-in-the-editor) |

| Round | Date | Result |
|---|---|---|
| 1 | | Not run yet |

### Test E: EDGE Director in the game: play

EDGEdir 0.0.29 with EDGE Director 0.6.0. The in-game test of D5c, D5d and DR1, run with EDGE Director's window. It answers D5's questions G1 to G7. Say what you see at each step; the Director's own record of the play is `%LOCALAPPDATA%\EDGEdir\play\state.json` (each jump's lateness in ms is under `late`).

**Before Tests E to H:** REDnode 0.67.2 or later with REDbridge and Codeware. EDGE Director in the game: in the EDGEdir folder run `npm run build`, then `npm run director-zip -- --draft`, and install `dist/EDGE-Director-0.6.0-draft.zip` with EDGEdeck or Vortex. The game running with a save loaded, V standing somewhere open, outside combat. On the Desk, the scene of Test C, saved: two actors (two different people of the game, not V), each with two animation clips joined by a transition, and one of them with a sequence block; the first actor at Right -1 and the second at Right 1, both Turn 180.

| Step | Do | Expect, and say |
|---|---|---|
| E1 | In the game press F10, open the Mod Manager, switch **EDGE Director** on, allow **bridge** and **archives**, and pin it to the launcher | Its window opens at the right. **Scenes** lists the Desk's scenes, the last changed first. The line at the bottom reads Ready and EDGE Director 0.6.0 |
| E2 | Click the scene of Test C | Its name, "in front of V", a strip with a lane for each track and the clips' names, and under **In the game** what the game will not match. Say how the window sits over the game, and whether its size suits watching a scene |
| E3 | Press **Play** | The line reads Writing 2 workspots (the first time about half a minute), Spawning, Starting the cast, Playing. Two people stand about 3 m in front of V and play. **G1:** are they at their marks, and in time with each other and with the playhead on the strip? **G7:** how long from the click to the first movement? |
| E4 | The same play, at its start | **G2:** does either person show a T pose before the scene starts? |
| E5 | Look at where they stand and face | **G3:** is the first actor on V's left and the second on V's right, and do both face V? If not, say how they stand |
| E6 | Watch each join, and the same join in VS Code's preview | **G4:** how does the game's blend look against the preview's Blend and Inertial? |
| E7 | While it plays, drag the playhead on the strip's ruler to the middle. Then press **Start Again** | Both people go to the clips of that moment at once and play on from there; the time follows. Start Again: they go to their first clips; nobody is removed or spawned |
| E8 | Switch **Loop** on and let the scene end | The scene starts again by itself, with the same people. Switch Loop off: at the next end the line says the scene has ended and the cast holds its last pose; each person stands still in the last pose of their last clip, and the playhead stays at the strip's right edge |
| E8b | (0.6.0) While it plays press **Pause**; then **Resume** | Pause: everybody holds still mid-movement, the playhead stops, the button reads Resume and the line reads Paused. Resume: they move on from where they were, in time with the playhead. Say whether anyone jumps or starts their clip again |
| E8c | (0.6.0) Drag the bar under the strip down and up; with more lanes than fit, scroll the lanes | The strip gets taller and shorter, and the lanes scroll inside it. The size is kept when the window is opened again |
| E9 | Under **Cast**, look at the rows; click one; press **Go There** on the other | Each actor with the clip they play now and their distance from V. The clicked actor has a pin with their name over them in the world, and their lane's name is lit. Go There puts V in front of that actor, facing them (say where V lands) |
| E10 | In VS Code, trim one clip short and give another Loops 2; save. In the game press **Stop**, look at the strip, press **Play** | After Stop the strip shows the changed clips within a few seconds. **G5:** does the short clip end where the next begins, and does the repeated one repeat, as in the preview? **G7:** how long is the wait this time? |
| E11 | Press **Stop**, then **Play** | **G6:** is everybody gone after Stop, and does the second play start clean, with two people only? |
| E12 | In VS Code click **Play in Game**, then **Play Anyway** | The scene plays as from the window. VS Code's playhead runs; the Director's line reads Playing (from VS Code), and its list marks the scene In the game. **Stop in Game** in VS Code removes the people |
| E13 | Open a scene made on a set near V (D5a), with clips on its people, and press **Play** | The header reads "on" and the set's name. The set's props and its other people appear where the set has them, and the directed people play at their places. **Stop** removes all of it |
| E14 | While a scene plays from VS Code, switch **EDGE Director** off in the Mod Manager | Its people are gone. In VS Code, within about 7 s, the line says the player stopped and the button reads Play in Game |

| Round | Date | Result |
|---|---|---|
| 1 | 2026-11-20 | **Partly run, by the owner, on EDGE Director 0.5.0 with REDnode 0.68.1** (the first time anything of EDGEdir ran in the game; Claude read the Director's log, its window's text and `state.json` through REDnode's tools beside it). The scene was "Test E", made by Claude on the Desk: Judy and Panam, each with two clips and a transition, at Right -1 and Right 1, Turn 180. **E1 pass:** the Director started cleanly and its window listed the Desk's two scenes. **E2 pass** by the window's text (the strip, "in front of V", two notes). **E3 pass:** the first Play failed at once with "Allow EDGE Director to use REDbridge in the Mod Manager first" (the permission was not allowed yet); the second wrote 2 workspots in 2 s, spawned 2 people in 2 s, and played; from click to playing 5 s (**G7**), not the half minute expected. All four jumps landed, 3 to 9 ms late. The playhead moved through the scene (**G1**, in part: timing against the playhead was not judged closely). **E5 pass (G3):** Judy stood on V's left and Panam on V's right. Facing was not judged: Panam's clip gets up off the ground, so she did not look at V. **Not answered yet:** E4 (a T pose at the start, G2), E6 (the blend at the joins, G4). E7 to E14 not run. REDnode refreshed what V wears when the workspots were swapped in (its log says so): to be asked whether it was seen |

What round 1 found, and what was done:

| Found | Done |
|---|---|
| The strip is squashed: the lanes are too low, and the strip should be resizable with the lanes scrolling inside it | 0.6.0: lanes 30 px high; a bar under the strip changes its height (kept between visits), and the lanes scroll inside. Step E8c. Seen only in a plain browser |
| The playhead disappeared at the scene's end | 0.6.0: it stays one pixel inside the strip's right edge. It was drawn just outside the strip, which cuts off what is outside |
| At the end the people went into a loop: they did not stop | As built until then: each clip in the game loops, and the last one looped until Stop. 0.6.0: an actor is held still a moment (0.05 s) before their last clip's end, by the game's own time dilation on that one person (`SetIndividualTimeDilation`), so they keep that pose. **Unverified in the game**: step E8 |
| A Pause button that reads Resume when pressed would be useful | 0.6.0: **Pause** holds everybody still the same way and stops the cues; **Resume** goes on from there. Step E8b. Unverified in the game |
| The first Play fails when the bridge permission is not allowed | As meant, and the line says what to do. The wiki's install page says to allow both permissions first |

### Test F: EDGE Director in the game: adjust

EDGEdir 0.0.26 with EDGE Director 0.4.0. The in-game test of DR2. Go on from Test E, with its scene open in EDGE Director's window, and the same scene open and saved in VS Code beside the game.

| Step | Do | Expect, and say |
|---|---|---|
| F1 | Press **Play**. Click the first actor's name at the left of the strip | Their lane's name is lit, a pin with their name is over them in the world, and **Adjust** shows their name with Right, Forward and Turn |
| F2 | Walk V a few steps to one side and turn. Press **Move to V** | The actor stands where V stands, facing as V faces, and plays on. Say whether they move at once, whether the clip goes on or starts again, and whether they stand on the ground |
| F3 | Press **Left**, **Right**, **Forward**, **Back**, then **Turn +15** and **Turn -15** | Each press moves the actor 10 cm, or turns them 15 degrees, at once. The numbers in Adjust follow. Say which way Left and Forward go, as V first saw the scene |
| F4 | Look at VS Code | The scene there has the new mark: select the actor's track, and the inspector's Right, Forward and Turn are the Director's numbers; the body in the preview stands there. Ctrl+Z in VS Code takes the last change back (say whether it does) |
| F5 | In the game press **The Scene Is Here** | Nobody moves. The header reads "at" with three numbers, and **In Front of V** appears beside it |
| F6 | Press **Stop**, walk V 20 m away, press **Play** | The scene plays at the spot it had, not in front of V. **Go There** on an actor brings V to it |
| F7 | Stopped, walk V to a new spot, choose an actor and press **Move to V**; then **Play** | The mark changes with nobody in the game, and the actor then plays at that spot |
| F8 | In VS Code move a clip and do not save. Look at the Director | Within a few seconds a yellow box says the scene has unsaved changes in VS Code; the Adjust buttons and The Scene Is Here are off; **Play** still plays, with the unsaved change |
| F9 | Save in VS Code | The yellow box goes within a few seconds and the buttons are on again |
| F10 | While it plays press **In Front of V** | The cast moves to stand in front of V, and the header reads "in front of V" |


| Round | Date | Result |
|---|---|---|
| 1 | | Not run yet |

### Test G: EDGE Director in the game: pins

EDGEdir 0.0.26 with EDGE Director 0.4.0. The in-game test of DR3's first part. Go on from Test F, with the scene open in EDGE Director's window and nothing playing.

| Step | Do | Expect, and say |
|---|---|---|
| G1 | Walk V to a spot. Under **Pins** type a name and press **Drop a Pin Here** (or Enter) | The pin is listed with 0 m, and stands in the world with its name over it, as REDnode's pins do. Say whether typing in the box also moves V or opens anything in the game |
| G2 | Walk away and drop a second pin under another name | Two pins, each with its distance from V, which follows V as V walks |
| G3 | Press **Scene Here** on the first pin | The header reads "at the pin" and its name; the pin's row names "the scene" |
| G4 | Click an actor's name on the strip, then press that actor's **Here** on the second pin | Adjust shows the mark with "at the pin" and its name; the pin's row names the actor |
| G5 | Press **Play** | The scene plays at the first pin, with that actor standing on the second pin |
| G6 | While it plays, walk V somewhere else and press **Drop Again** on the second pin | The pin in the world moves to V, and the actor moves there at once and plays on |
| G7 | Press **Go There** on the first pin | V stands at that pin |
| G8 | Open REDnode's own **Pins** window. Then press **Stop**, go back to **Scenes** in EDGE Director | Say whether the scene's pins are listed in REDnode's Pins window, and under what name. Back at Scenes, the scene's pins are gone from the world |

| Round | Date | Result |
|---|---|---|
| 1 | | Not run yet |

### Test H: Weather

EDGEdir 0.0.28 with EDGE Director 0.5.0. D6a, in the editor and then in the game. The game needs REDnode 0.67.2 or later. Use the scene of Test C.

| Step | Do | Expect, and say |
|---|---|---|
| H1 | In VS Code open the scene, **Add Track**, Weather. Try to add a second Weather track | One Weather lane. The second is refused with a message |
| H2 | Add a clip to the Weather lane from 2 s, about 6 s long. Select it and choose **Rain** under **Weather**; set **Blend (s)** to 3 | The list has the game's weathers by plain name. The clip reads Rain on the lane. Under **In the game** it says the change starts at the clip's start and that the weather goes back at its end |
| H3 | Drag the playhead through the clip | Inside the clip the view is tinted grey and the line over it starts with "Weather: Rain"; outside, neither |
| H4 | Save. In the game, in EDGE Director, open the scene | The strip has the Weather lane with the Rain clip, lit |
| H5 | Press **Play** and watch the sky | At 2 s the weather starts to change to rain. Say how long the change takes, and whether it looks like the game's own rain |
| H6 | Let it play past the clip's end | At 8 s the weather starts back to what it was before the scene, over about 10 s |
| H7 | Press **Start Again**; when it rains press **Stop** | The weather goes back after Stop too |
| H8 | In VS Code add a second weather clip right after the first, with **Sunny**; save; play in the game | Rain turns to sun at the join, with no going back between them, and the weather goes back after the second clip |

| Round | Date | Result |
|---|---|---|
| 1 | | Not run yet |

## Type check, build and unit tests

```powershell
npm run typecheck
npm run build
npm test
```

The **Check** workflow runs the same on every push to `main`. The tests are pure: no VS Code and no game. The scaffold's 3 tests check that the activity bar container has its icon, and that the views the extension registers are the ones package.json declares, each with welcome text. D1.1's 16 tests (`test/doc.test.ts`) check the scene document: reading and writing it, the messages for a file that is not a scene, that fields of later phases survive an edit, and every edit's rules (tracks, add, move, trim, split, paste, the no-overlap rule and its exception for transitions, locked tracks, snap). D1.6's 4 tests (`test/desk.test.ts`) check the Desk's folders in a temporary folder: a new scene's item shape, names, the list, and rename. D4b's 6 tests (`test/seq.test.ts`) check a sequence's file, the block on a lane (as long as its clips, not trimmed or split, unpacked), the pose through a block, a linked block taking the sequence as it is now, what Save as Sequence takes, and the Desk's sequence items. D4a's 6 tests (`test/transition.test.ts`) check a transition's method and ease, where Add Transition puts one, which clips it joins, the pose under a Blend and an Inertial one, and what it says about the game. D3's 7 tests (`test/preview.test.ts`) check the pose under the playhead (a clip's own time, loops, a gap, a clip passed over), the marks, and the preview's files with a stand-in bridge: exported once, found again, V's base body, a failure not kept.

D5c and D5d's 5 tests (`test/play.test.ts`) check the player's steps against a stand-in world (where the cast stands in front of V and on a set; write, spawn, start and jumps on time; one swap; nothing written twice; Stop; a failure that leaves nobody), and the folder EDGEdir reaches it through, with a developer's copy of the Director into a made-up game folder.

D6a's 3 tests (`test/weather.test.ts`) check a weather clip's state and blend and the one weather track, the cues (a state at each clip's start, the weather given back where no clip follows, the notes, a scene with weather alone), and the player (states set on time, given back at a clip's end and at Stop, the state of the moment a play starts from, a weather the game refuses).

DR1's, DR2's and DR3's 8 tests (`test/director.test.ts`) check a play that starts from a moment (each actor in that moment's clip, the time counted from the scene's start), going to a moment and Start Again with the cast kept, the loop, a mark and a place in the world turned into each other in each kind of frame, Adjust (a change to the file made with EDGEdir's own edits and the person moved in the game, the scene's place, what VS Code has unsaved played and not changed, an edit refused in EDGEdir's words), pins (a pin file read and written as REDnode's, a mark and the scene's place that follow a pin when it moves, a pin dropped where V stands into the scene's own file, drawn, dropped again with the actor in the game moved, moved by another hand, removed; the pin files a scene can choose), and the Desk as the Director reads it: the scenes listed without sequences, a scene as a strip with its notes and its cue sheet, a scene with nobody, and a scene whose set is gone and found again.

## D1 Timeline

EDGEdir 0.0.3, built 2026-11-16. Round 1 ran on 0.0.2.

**Before you start:** open the EDGEdir folder in VS Code, run `npm run build`, then press F5 (**Run EDGEdir**). The steps are done in the window that opens. No game and no other EDGE tool is needed.

| Step | Do | Expect |
|---|---|---|
| 1 | Click the EDGEdir icon in the activity bar. In the Desk view click **New Scene** and name it `Test one` | The scene opens in the scene editor with no lanes yet. The Desk lists `Test one` |
| 2 | **Add Track** three times: Actor, Audio, Camera | Three lanes, each with its name, its kind in its own colour, and M and L buttons |
| 3 | Click the Actor lane's head, then **Add Clip** twice. Double-click an empty place in the Audio lane | Two clips on the Actor lane, one after the other, each a second long. One clip on the Audio lane where you clicked |
| 4 | Drag the second Actor clip to the right, then back until it meets the first | It moves with the mouse, snaps to the first clip's end (a cyan line shows), and cannot be pushed onto it |
| 5 | Drag the right edge of the first clip, then its left edge | The clip gets longer and shorter by frames. The edge stops at 0 and at the next clip |
| 6 | Click a clip. In the inspector change its Name, then its Length | The name shows on the clip. The clip takes the new length |
| 7 | Click the ruler inside a clip, select that clip, press **S** | The playhead goes where you clicked. The clip is cut in two there |
| 8 | Select a clip, press Ctrl+C, press End, press Ctrl+V. Then press Delete | A copy lands at the scene's end and is selected. Delete removes it |
| 9 | With the Actor lane selected, **Add Transition** near the join of two clips | A thin dashed band lies over the join, along the top of the lane, and may overlap both clips |
| 10 | Hold Ctrl and turn the wheel over the lanes. Hold Shift and turn it. Click **Fit** | The timeline zooms at the pointer, scrolls sideways, then shows the whole scene |
| 11 | Press Space. Press it again. Turn **Loop** on and play to the end | The playhead runs in real time and stops. With Loop it starts again from 0 |
| 12 | Click **L** on the Actor lane, then try to drag one of its clips | The clip does not move, and the top right says the track is locked. Click **L** again to unlock |
| 13 | Drag the Camera lane's head above the Actor lane | A cyan line shows where it will land. The lanes change order |
| 14 | Press Ctrl+Z five times, then Ctrl+Y five times | Each change goes back, and comes again |
| 15 | Press Ctrl+S. Close the editor tab. Click `Test one` in the Desk | The tab's unsaved dot goes on save. The scene opens as it was left |
| 16 | Open the same file as text beside the scene editor (right-click the tab, **Reopen Editor With...**, **Text Editor**, in a split). Change a clip's `start` in the text | The clip moves in the scene editor |
| 17 | In the text, delete a `{` so the JSON breaks. Then undo | The scene editor says the file cannot be read, with the reason. After undo the timeline is back |
| 18 | Make a change in the scene editor and do not save. Run **Developer: Reload Window** | After the reload the scene is open with the change still there, unsaved, and a note says it was put back |
| 19 | In the Desk, right-click `Test one`: **Rename...** to `Test two` (save it first if it has unsaved changes) | The Desk shows `Test two`. If it was open it opens again, and the editor's title says `Test two` |
| 20 | Right-click `Test two`: **Reveal in File Explorer** | Explorer shows `Test two.edgedir` in `%LOCALAPPDATA%\EDGEdir\desk\Test two.act.asset\source\raw\edgedir` |
| 21 | Copy that `.edgedir` file to your Desktop and open the copy in VS Code (File, Open File) | It opens in the scene editor. The Desk lists it under **Recent** |
| 22 | Right-click `Test two` in the Desk: **Delete**, and confirm | The scene leaves the Desk, its tab closes, and its folder is in the Recycle Bin |
| 22a | Only if the Desk is on a drive with no Recycle Bin (a network or `subst` drive): **Delete**, and confirm | A second question says the scene could not go to the Recycle Bin and asks to delete it for good. **Delete for Good** removes it; Cancel keeps it on the Desk |
| 23 | With an installed build (not F5), and the editor already running: pass a `.edgedir` file to it on the command line, or use File, Open File | It opens in the scene editor, not as text, and the Desk lists it under **Recent**. (Named on the command line of a cold start it opens as text: VS Code's limit, see round 2) |

| Round | Date | Steps | Result |
|---|---|---|---|
| 1 | 2026-11-16 | 1 to 22, on 0.0.2 at `0ab6667` | **Pass, 22 of 22**, run by the EDGEweb session by script at the owner's request: real mouse and key events in a trial EDGEkit 1.140.6 window with only EDGEdir loaded and a scratch Desk; read from the page, the saved file and screenshots. Nobody watched it live. Step 21's copy went to a scratch folder, not the Desktop |

What round 1 found, and what was done:

| Found | Done |
|---|---|
| Step 22: with the Desk on a `subst` drive, Delete failed ("Failed to move ... to the recycle bin") and the scene stayed. On its real `C:` path the step passed | Fixed in 0.0.3: Delete asks again, then deletes for good. Step 22a. Not run yet |
| Step 21: opened with File, Open File the copy opens in the scene editor. Passed on the command line at launch it opened as JSON text and was not under Recent. Unverified whether that is only because an extension loaded by a development path loads late | Open. Step 23 checks it with an installed build |
| Step 4: the inspector's Start kept its old value during a drag | Fixed in 0.0.3: Start, Length and Frames follow the drag. Not run yet |
| With the editor at half width the toolbar wraps to two rows | Left as it is |

| Round | Date | Steps | Result |
|---|---|---|---|
| 2 | 2026-11-16 | 4, 5, 22a and 23, on 0.0.6 at `17ee24d` | **4, 5 and 22a pass; 23 fails as VS Code's own limit.** By script, as round 1. 4 and 5: the inspector's Start, Length and Frames follow while the mouse is down. 22a: on a drive with no Recycle Bin the second question comes; Cancel keeps the scene, Delete for Good removes it |
| 3 | 2026-11-16 | 22a, on 0.0.7 at `683ce55` | **Pass**, by script in the EDGEweb session, as before; nobody watched it live: after Cancel at the second question the scene's tab is open again; Delete for Good removes the scene, its tab and its folder |

What round 2 found, and what was done:

| Found | Done |
|---|---|
| Step 23, with an installed build: a `.edgedir` file given on the command line when the editor starts cold opens as JSON text and is not under Recent. With File, Open File, and with the editor already running, it opens in the scene editor | **A known limit, left.** VS Code opens a file named at start before it has read the extensions' editors. EDGEwave found the same with `.edgewave` files (its docs/release.md). Opened from the Desk, the Explorer, Quick Open or File, Open File, a scene gets its editor. A double-click in File Explorer with the editor closed was not tried |
| Step 22a: the scene's tab is closed before the second question, so after Cancel the scene was on the Desk with its tab gone | Fixed in 0.0.7: a scene kept after all opens again. Not run yet |

## D2 Cast, part 1

EDGEdir 0.0.8 (first built as 0.0.4). It covers D2.1 to D2.4: the game's files, the actor picker with V, and the Animations view's file list.

**Before you start:** the game installed (not running), and REDbridge 0.13.0, which comes with REDcode. Open the EDGEdir folder in VS Code, run `npm run build`, press F5 (**Run EDGEdir**). To see the first read, delete `%LOCALAPPDATA%\EDGEdir\cache` if it is there.

| Step | Do | Expect |
|---|---|---|
| 1 | Click the EDGEdir icon and open the **Animations** view | It says the game's animations are listed here, with **Read the Game** |
| 2 | Click **Read the Game** | A note at the bottom right, "EDGEdir is reading the game": first the characters (about 15 s), then the animation files (about 2 minutes with REDbridge 0.13.0, counting game files; a second or two with 0.14.0). Then the view shows **Game** with about 14,000 animation files |
| 3 | Open **Game**, then `base`, then `animations`, and a folder below | Folders with their counts, then animation files by name |
| 4 | Click the search button in the view's title, type two words from a name you saw | A line with the count, then the matching files, each with its folder. The clear button brings the folders back |
| 5 | Right-click an animation file: **Copy Path**. Paste somewhere | The file's game path, ending `.anims` |
| 6 | New Scene `Cast test`. **Add Track**, Actor. Click its head | The lane head says `ACTOR · nobody yet`. The inspector says nobody acts on the track, with **Choose Actor...** |
| 7 | **Choose Actor...**, type `judy`, pick Judy Álvarez, then an appearance | A search box over the characters with V's two entries on top. Then the appearances, with "Any: the game picks" first. The track is renamed to the actor, the head says who, and the inspector shows Record, Appearance and Rig (`woman_base`) |
| 8 | Add two clips to the track. **Change Actor...** and pick another woman | The clips stay. The name and the inspector follow |
| 9 | Press Ctrl+Z, then Ctrl+Y | The actor goes back to the one before, and forward again, in one step each |
| 10 | Add a second actor track. Choose **V (the player), feminine body** | The head says `V, feminine body`, the rig is `woman_base`, and a line says it is your own V in the game. No appearance is asked for |
| 11 | On the first track, **Change Actor...** | V's two entries are not offered |
| 12 | On V's track, **Change Actor...**, pick the masculine body | It changes; the rig is `man_base` |
| 13 | **Change Actor...**, pick **Nobody** | The track has nobody; its clips and its name stay as they are |
| 14 | Save, close the window opened by F5, press F5 again, open `Cast test` from the Desk | The actors are as saved. The Animations view fills by itself, without **Read the Game** and without the two-minute wait |
| 15 | In settings set `edgedir.bridgePath` to a file that is not there and clear REDcode's bridge path if set (or run with REDcode disabled), then **Developer: Reload Window** | The Animations view says REDbridge was not found, with its two links. The scene still opens and edits. Choosing an actor offers V only, and says the characters could not be read. Put the setting back after |

| Round | Date | Steps | Result |
|---|---|---|---|
| 1 | 2026-11-16 | 1 to 15, on 0.0.6 at `17ee24d`, REDbridge 0.13.0 | **Pass, 15 of 15**, run by the EDGEweb session by script at the owner's request (real mouse and key events in a trial EDGEkit 1.140.6 window, scratch Desk, cache and Library, the real game folder read only; nobody watched it live). Reading the game took 85 s; 6,586 characters; 14,016 animation files. A second start filled the view by itself in about 5 s |
| 2 | 2026-11-16 | The two fixes of 0.0.7 (the picker's names, the empty picker), at `683ce55` | **Pass**, by script in the EDGEweb session, as before; nobody watched it live: after Read the Game Again no row is named just "V", `!OBSOLETE` or `[No Data]`; with no bridge and V taken, a track with nobody gets the message and no picker, and a track with an actor gets the picker with Nobody alone |

What round 1 found, and what was done:

| Found | Done |
|---|---|
| A broken copy of REDbridge on the test rig: the view said the game could not be read, with Show Log and Try Again, and worked after the path was put right | Nothing: the failed state works |
| Typing `judy` in the picker also listed a row named just "V" (photo mode's copy of Judy), and the list began with rows named `!OBSOLETE` and `[No Data]` | Fixed in 0.0.7: such rows are listed by their record's own name. It takes effect when the game is read again (**Read the Game Again**). Passed round 2 |
| Step 15, on a track other than V's in a scene that has V: the picker was empty while its line said V can still be chosen | Fixed in 0.0.7: a message says there is nobody to choose just now, and the line no longer offers V when V is taken. Not run yet |
| After the editor was stopped by force, a reopened scene showed the unsaved dot though its text matched the file | Seen once, after a forced stop. Not looked into |
| Clear the Search shows the Game group closed again, not as it was opened | Left as it is |

## D2 Clips, part 2

EDGEdir 0.0.8 (first built as 0.0.5). It covers D2.5 and D2.6: the animations inside each file, search and filters, and real clips on the lanes.

**Before you start:** as for part 1, and **REDbridge 0.14.0** (released 2026-11-16; it has `anims.info`; REDcode's **Install REDbridge** fetches it). With 0.13.0 the view lists files only, and steps 2 on cannot be done. Run part 1 first, or at least its steps 1 and 2.

| Step | Do | Expect |
|---|---|---|
| 1 | Open the Animations view after **Read the Game** | The status bar says "EDGEdir: Animations: ... of 14,016 files read", counting up for about four minutes. The **Game** line's count of animations grows. The view can be used meanwhile |
| 2 | When it is done, open `base`, `animations`, a folder, and an animation file | The file shows its count and rig, and opens to its animations, each with its length. Hover one: its frames, file and rig |
| 3 | Search `sit chair` | A count, then animations whose name or file has both words, each with its file's name |
| 4 | New Scene `Clip test`, add an Actor track, choose Judy Álvarez. In the Animations view click the person button in the title (**Only What Fits the Selected Actor**) | The count drops to the animations made for `woman_base`, and the line says they fit Judy |
| 5 | Click the **+** on an animation in the list | A clip with the animation's name lands on Judy's track at the playhead, as long as the animation. The inspector shows In, Out, Speed, Loops, and the animation's file, length and rig |
| 6 | Press End, add a second animation | It lands after the first, at its own length |
| 7 | Drag the first clip's right edge left, then right as far as it goes | It gets shorter; back out it stops at the animation's full length, or at the next clip |
| 8 | Drag the first clip's left edge right | The clip starts later and In is above 0: the animation's start is cut, its end stays in place |
| 9 | On the last clip set Speed to 2, then Loops to 3 | The clip is half as long, then three times that, with two small marks where it starts again |
| 10 | Drag that clip's right edge left by about a third. Then try its left edge | Loops becomes 2. The left edge does not move, and the top right says to set Loops to 1 |
| 11 | Put the playhead inside the first clip, select it, press S | Two clips; the second's In is the first's Out |
| 12 | Turn the fits filter off, search `walk`, and add an animation whose rig is `man_base` (hover to see) | A warning says which rig it is made for. The clip is on the track, hatched red, and the inspector says Unfit and why |
| 13 | **Change Actor...** to another woman, then to a man | With the woman every clip is as before. With the man the red hatch moves to the other clips; nothing is removed |
| 14 | Choose V, feminine body, on a new actor track, select it, turn the fits filter on | The same `woman_base` animations are offered for V |
| 15 | In the view's `...` menu turn on **Only the Selected Actor's Own Files** with Judy's track selected | Only animations from the files Judy's entity lists |
| 16 | Press Ctrl+Z a few times, then save, close and reopen the scene | Each change goes back. Reopened, the clips, their lengths and the red hatch are as saved |
| 17 | Close the window opened by F5 during step 1's reading on a fresh cache, and open it again | Reading goes on from where it stopped, not from the start |

| Round | Date | Steps | Result |
|---|---|---|---|
| 1 | 2026-11-16 | 1 to 17, on 0.0.6 at `17ee24d`, REDbridge 0.14.0 | **Pass, 17 of 17**, run by the EDGEweb session by script at the owner's request (real mouse and key events in a trial EDGEkit 1.140.6 window, scratch Desk, cache and Library, the real game folder read only; nobody watched it live). The animations were read in about 2.5 minutes: 146,814 in 14,016 files |
| 2 | 2026-11-16 | The three fixes of 0.0.7 (the save at every 500 files, the new clip selected, the nearest loop), at `683ce55`, REDbridge 0.14.0 | **Pass**, by script in the EDGEweb session, as before; nobody watched it live: closed 21 s in at 1,000 files, the next start went on from there; the + shows the new clip in the inspector at once; an edge at 1.93 loops gives 2, at 1.4 gives 1, and it does not grow into the next clip. Found: Loops typed as 4 with no room was refused, but the box showed 4 until the clip was selected again. Fixed in 0.0.8 (a refused change puts the inspector back); not run yet |

What round 1 found, and what was done:

| Found | Done |
|---|---|
| Step 17: closed 40 s into the first read, nothing was on disk and the next start began from 0 (the first save came at 2,000 files) | Fixed in 0.0.7: what is read is saved at every 500 files. Not run yet |
| The status bar counts "of 14,028 files" while the view says 14,016 | Left: REDbridge counts 12 files that are in two archives twice; the view counts each path once |
| Step 5: the new clip was not selected, so the inspector still showed the track | Fixed in 0.0.7: Add to Track selects the new clip. Not run yet |
| Step 10: a looping clip's end edge rounded down, so a drag to just under two loops gave one | Fixed in 0.0.7: it goes to the nearest whole loop there is room for. Unit tested; not run yet |
| An actor's own files can hold a set made for another rig (the game's data) | Nothing: it is why the two filters together give fewer than the second alone |

## D2 Made animations, part 3

EDGEdir 0.0.8 (first built as 0.0.6). It covers D2.7. EDGEfab stores no animations yet, so the test uses a sample item written by a small tool. It needs an EDGE Library (set up in EDGEfab or EDGEbuilder), and neither the game nor REDbridge.

| Step | Do | Expect |
|---|---|---|
| 1 | In the EDGEdir folder run `node tools/made-anim-sample.mjs` | It says where it wrote `Sample wave.anim.asset`, in a folder `EDGEdir test` in your Library |
| 2 | Press F5, open the Animations view, click **Refresh** in its title | A **Library** group with `Sample wave`: 2.40 s, `woman_base`, and a note that its file is missing (the sample has no clip file) |
| 3 | Open a scene with an actor track, select the track, click the **+** on `Sample wave` | A clip `sample_wave`, 2.4 s long, on the track. The inspector says it is a made animation |
| 4 | With a woman as the track's actor, turn on **Only What Fits the Selected Actor** | `Sample wave` is still listed, above the game's animations. With a man as the actor it is not |
| 5 | With a REDcode project open in the same window (REDcode running) | A **Project** group with the project's name, saying it has no made animations |
| 6 | Run `node tools/made-anim-sample.mjs --remove`, then **Refresh** | The Library group is gone. The clip stays on its track |

| Round | Date | Steps | Result |
|---|---|---|---|
| 1 | 2026-11-16 | 1 to 6, on 0.0.6 at `17ee24d` | **Pass, 6 of 6**, run by the EDGEweb session by script at the owner's request (real mouse and key events in a trial EDGEkit 1.140.6 window, scratch Desk, cache and Library, the real game folder read only; nobody watched it live) |

## D3 Preview

EDGEdir 0.0.11 (first built as 0.0.9, 2026-11-16). It covers D3: the 3D view above the timeline.

**Before you start:** the game installed (not running) and REDbridge 0.14.0. Open the EDGEdir folder in VS Code, run `npm run build`, press F5 (**Run EDGEdir**). Let **Read the Game** finish first (parts 1 and 2), so the Animations view has animations to add. To see the first export, delete `%LOCALAPPDATA%\EDGEdir\cache\preview` if it is there.

| Step | Do | Expect |
|---|---|---|
| 1 | New Scene `Preview test`. Look at the area above the timeline | A dark view with a grid and a small yellow ring at its middle, a **Frame** button at the top right, and a line saying to add an actor track and choose an actor |
| 2 | **Add Track**, Actor. **Choose Actor...**, pick Judy Álvarez and an appearance | The line says a file is loading from the game. In a few seconds a grey body stands on the grid, arms out, with a cyan ring at its feet, and the view fits it |
| 3 | With her track selected, turn on **Only What Fits the Selected Actor** in the Animations view and add two animations with the **+**, one after the other | Clips on the lane. With the playhead in the first, the body is in that animation's pose |
| 4 | Drag the playhead along the ruler, through both clips | The body takes the pose under the playhead, and changes animation where the second clip starts |
| 5 | Press Home, then Space. Press Space again | The body plays in time with the playhead and stops with it |
| 6 | Add a second Actor track and choose another character | A second body stands 0.8 m to the right of the first. The ring of the selected track is cyan, the other grey |
| 7 | Select the second track. In the inspector set **Right (m)** to 2, **Forward (m)** to 1 and **Turn (°)** to 180 | The body moves right and away, and turns to face the other way. Ctrl+Z takes each back |
| 8 | Drag in the view with the left button, with the right button, and turn the wheel. Click **Frame** | The view orbits, pans and zooms. Frame fits both bodies again |
| 9 | Drag the splitter under the view down and up | The view gets taller and shorter, and the bodies keep their shape (not stretched) |
| 10 | Move the second clip of the first track a few seconds to the right, and put the playhead in the gap. Press Space | In the gap the body goes on with the first clip, looping, until the second clip starts |
| 11 | Select a clip and set **Speed** to 2, then **Loops** to 2; drag the playhead through it. Drag its right edge shorter | The body moves twice as fast, and runs the part twice. The preview follows the trim |
| 12 | Add a third Actor track and choose **V (the player), feminine body** | A grey body without a head, and the line says the game's base body stands in for your V. Add an animation to it: it plays |
| 13 | On the first track, turn the fits filter off and add an animation whose rig is `man_base`. Put the playhead in that clip | The clip is hatched red. The body does not play it, and the line says it is passed over, made for another rig |
| 14 | Click **M** on the second track | Its body is gone from the view. Click **M** again: it is back |
| 15 | Hover the line of notes at the bottom of the view | A tooltip says what each body is: its appearance, how many meshes and joints, and what was left out |
| 16 | Save. Close the scene's tab and open it from the Desk | The bodies are back within a second or two, without the wait of step 2. The playhead is at the start again, and the bodies are in the pose there |
| 17 | In settings set `edgedir.bridgePath` to a file that is not there and clear REDcode's bridge path if set, **Developer: Reload Window**, and open a scene with an actor whose body was never shown (or delete the `preview` folder first) | The view says there is no body, and why (REDbridge was not found). The timeline works as before. Put the setting back after |

| Round | Date | Steps | Result |
|---|---|---|---|
| 1 | 2026-11-16 | 1 to 17, on 0.0.9 at `16b9c2f`, REDbridge 0.14.0 | **Pass, 17 of 17**, run by the EDGEweb session by script at the owner's request (real mouse and key events in a trial EDGEkit 1.140.6 window, scratch Desk and cache, the real game folder read only; judged from `edgedirPreview.state()`, the inspector, the saved file and screenshots; nobody watched it live, so how smooth play and orbit are is not judged). The page loads the bodies inside VS Code with no content-rule or fetch errors. The first body stood about 7 s after its appearance was picked (12.2 MB); a reopened scene had three bodies standing in 480 ms. V's masculine base body also passed (an extra try). The fix of 0.0.8 passed: Loops typed with no room is refused and the box goes back |
| 2 | 2026-11-16 | The four fixes of 0.0.10, at `dd6dc95`, REDbridge 0.14.0 | **Pass, 4 of 4**, by script in the EDGEweb session, as before; nobody watched it live. The splitter: in a 480 px editor the view opens at 216 px, drags, and stops at 350. Failed files: with no bridge 5 failed and stayed failed after their own retry; with the bridge back, Frame loaded all 5 in 4.7 s. The line: one reason once, not cut at 1,082 px, and the tooltip has it. The fit: a second body fitted the view; after an orbit by hand a third did not, and Frame fitted all three. Found: two full stops after a reason that ends with its own. Fixed in 0.0.11; not run |

What round 1 found, and what was done:

| Found | Done |
|---|---|
| Step 9: in a short editor (480 px, with the bottom panel open) the splitter could not be dragged down at all: the cap equalled the view's first height | Fixed in 0.0.10: the view starts at 260 px or 45% of the editor, whichever is less, and can be dragged to 130 px from the bottom. Passed round 2 |
| A file that failed was never asked for again while the tab stayed open. Seen once, after the bridge's setting changed just before a reload: the view kept "no body" for minutes though the bridge was up. Closing and opening the scene brought the bodies | Fixed in 0.0.10: a failed file is asked for once more by itself after 5 s, and **Frame** asks again for everything that failed. Passed round 2 |
| With no REDbridge the line gave the same reason five times, cut off after the first | Fixed in 0.0.10: one reason is said once, with what it stopped ("Not loaded: Judy Álvarez's body, ... REDbridge was not found ... Frame tries again"), and the tooltip has the whole line. Passed round 2 |
| The view fitted the first body only: a second actor's ring was cut off until Frame, and a clip that lies down dropped under the edge | Fixed in 0.0.10: each new body fits the view again until the view is moved by hand, and the fit leaves room for arms out and for lying down. Passed round 2 |
| Step 16: a reopened scene has the playhead at 0 and the view at its first height, not as left | Left: neither is kept with the scene yet. The step now says so |
| Bodies 0.8 m apart pass through each other in the arms-out rest pose | Left as it is: a mark moves them apart |
| Step 15: the tooltip was read from the page, not seen drawn | Nothing: a script cannot see a native tooltip |

## D4a Transitions

EDGEdir 0.0.15 (first built as 0.0.12, 2026-11-16). It covers D4a: transitions in the 3D preview.

**Before you start:** as for D3 Preview: the game installed (not running), REDbridge 0.14.0, F5 (**Run EDGEdir**), **Read the Game** done.

| Step | Do | Expect |
|---|---|---|
| 1 | New Scene `Join test`. Add an Actor track, choose Judy Álvarez. With the fits filter on, add two animations one after the other, so the second starts where the first ends | Two clips end to end, and her body in the view. Select the second clip: the inspector says no transition leads into it, the preview cuts here and the game will blend it |
| 2 | Drag the playhead across the join | The body jumps from the first clip's pose to the second's |
| 3 | Put the playhead near the join and click **Add Transition** | A dashed band 0.4 s long lies at the start of the second clip, selected. The inspector shows Method Blend, Ease Smooth, **Joins** with the two clips' names, and says it starts where the game makes its own join |
| 4 | Drag the playhead slowly through the transition, then press Home and Space | No jump: at the transition's start the body is still in the first clip's last pose, and it moves from there into the second clip's. Played, the two clips view as one movement. (Use two clips whose end and start poses clearly differ, such as one that ends lying down and one that starts standing) |
| 5 | Set **Length (s)** to 1.2 and play again. Set **Ease** to Linear, then Ease in | The change takes longer. The preview follows each ease |
| 6 | Set **Method** to Inertial and drag the playhead through | At the second clip's start the pose is the same as just before it, then the second clip's own movement takes over. The inspector says what Inertial does |
| 7 | Open the Method list | **AI (no provider yet)** is there, greyed, and cannot be chosen |
| 8 | Set Method back to Blend. Drag the transition 0.3 s to the left, so it lies over the join | A yellow bar shows at the transition's start. The inspector says **Preview only** and why. The preview still blends: before the second clip starts, it is mixed in at its first pose |
| 9 | Drag the transition to the middle of the first clip | It is dimmed. The inspector says it joins nothing. The preview plays the first clip as if it were not there |
| 10 | Drag it back to the start of the second clip. Press Ctrl+Z several times, then Ctrl+Y | Each change goes back and comes again, the method and ease too |
| 11 | Move the second clip 1 s to the right, leaving a gap, and put the transition at its new start. Play | Over the transition the first clip, still looping in the gap, blends into the second |
| 12 | Add the same animation twice, end to end, with a transition between | It blends from the animation's end into its own start, without an error |
| 13 | **Change Actor...** to a man | The clips are hatched red, and the transition is dimmed: it joins nothing on this actor. Change back: as before |
| 14 | Save, close the tab, open the scene from the Desk | The transition is there with its method, ease and length, and the preview blends |
| 15 | Open a scene from before this version that has a transition (or delete `"method"` and `"ease"` from one in the text) | It reads as Blend, Smooth |

| Round | Date | Steps | Result |
|---|---|---|---|
| 1 | 2026-11-16 | 1 to 15, on 0.0.13 at `a73af0e` (and on 0.0.12 before, the same) | **12 of 15: steps 3, 4 and 6 fail.** run by the EDGEweb session by script at the owner's request (real mouse and key events in a trial EDGEkit 1.140.6 window, scratch Desk and cache, REDbridge 0.14.0, the real game folder read only; judged from `edgedirPreview.state()`, the inspector, the saved file and screenshots; nobody watched it live). Steps 4 and 6: the mix was worked out right (the shares ran as they should) but the body on screen jumped at the join all the same, with both methods. Step 3: a transition put by Add Transition was called Preview only and marked. The other twelve pass, 5, 8 and 11 by the numbers only |
| 2 | 2026-11-16 | 3, 4, 5, 6, 8, 11 and 12, on 0.0.14 at `69281ac` | **Pass, 7 of 7**, by script in the EDGEweb session, as before; nobody watched it live. By sight too: across a Blend from a clip that ends lying down into one that starts standing, the body is lying at share 0.98, rising at 0.84, half up at 0.62 and standing at 0.16. With Inertial the frame after the join is the same pose as the frame before it. Add Transition lands on the join and is not called Preview only. With a gap the first clip still loops through it |

What round 1 found, and what was done:

| Found | Done |
|---|---|
| Steps 4 and 6, the main fault: with the second clip starting where the first ends, the first clip was mixed in at its **first** pose, not its last. It was treated as looping on past its end, so at the join it wrapped round to its start. A clip that ends lying down, joined to one that starts standing, mixed standing into standing: a jump. The browser check before the round had used a join with a gap, and a join whose two poses look alike, so it did not show | **Fixed in 0.0.14:** when the second clip starts where the first ends, the first holds its last pose under the transition. With a gap between them it goes on looping, as in the gap. Unit tested, and seen in a browser with a join from standing to lying down: the pose at the start of the transition is the first clip's last, with Blend and with Inertial. Passed round 2 |
| Step 3 (and 12): Add Transition put the transition on the frame (2.866667 s) while the clip starts at its animation's length (2.8667 s), so it was taken as off the join: "Preview only", and the yellow mark. A typed Start snapped to the frame too | **Fixed in 0.0.14:** Add Transition puts it on the clip's own start, and a transition within a thousandth of a second of the clip's start is on the join. Passed round 2 |

## D4b Sequences

EDGEdir 0.0.15 (first built as 0.0.13, 2026-11-16). It covers D4b: sequences on the Desk and as blocks on a lane.

**Before you start:** as for D3 Preview. A scene with two actor tracks whose actors share a rig (two women), the first with three animation clips end to end and a transition at one join.

| Step | Do | Expect |
|---|---|---|
| 1 | Select the first track. Look at the toolbar with no clip selected, then click the second clip | **Save as Sequence** is there, greyed; with a clip selected it can be clicked |
| 2 | Select the second and third clips (Ctrl+click) and click **Save as Sequence**. Name it `Sit down`, choose **Keep the clips on the lane** | A note says the sequence is on the Desk. The Desk has a **Sequences** heading with `Sit down`. The lane is unchanged |
| 3 | Select the second track. In the Desk click the **+** on `Sit down` | One block named `▸ Sit down` lands on the second track at the playhead, selected, as long as the two clips. The inspector says Sequence block, its sequence, 2 clips, its rig, and that it is linked |
| 4 | Drag the playhead through the block, then play | The second actor plays the same movement the first does over those two clips, with the transition if it lay between them |
| 5 | Try to drag the block's right edge. Select it and press **S** with the playhead inside | It does not trim, and the top right says why. Split is greyed |
| 6 | Drag the block along the lane; Ctrl+C, End, Ctrl+V | It moves like a clip. A second block lands at the end |
| 7 | Double-click the block (or **Open Sequence**) | `Sit down` opens in its own tab: one lane with the two clips starting at 0, a grey base body in the view, no **Add Track**, no M and L on the lane. The inspector says Sequence, its rig, and what a sequence is |
| 8 | In the sequence's tab, with the fits filter on in the Animations view, add a third animation at the end. Save (Ctrl+S) | The Desk's `Sit down` says just now. Back in the scene's tab, every block that has room is longer and plays the third clip (move the pasted block away first, so both have room); the status bar said how many blocks were updated; the scene shows as unsaved |
| 9 | In the scene press Ctrl+Z | The blocks go back to their older copy. The inspector of a block now says the sequence on the Desk has changed |
| 10 | Close the scene without saving and open it again from the Desk | The blocks are up to date again, by themselves |
| 11 | Put a clip right after the first block, so there is no room. In the sequence's tab add another animation and save | The second block follows. The first keeps its copy, and its inspector says the new length does not fit |
| 12 | Select a block and click **Unpack** | The block becomes plain clips (and transitions) on the lane, selected. They play the same. The other block is unchanged |
| 13 | Select the first track's clips again, **Save as Sequence**, name it `Whole`, choose **Replace them with the sequence's block** | The clips are gone and one block stands in their place. It plays as they did. Ctrl+Z brings the clips back |
| 14 | **Change Actor...** on the second track to a man | Its block is hatched red, the inspector says Unfit and why, and the body does not play it |
| 15 | In the Desk click the **New Sequence** button in the view's title, name it `Empty one`, choose the feminine base rig | It opens in its own tab with an empty lane and the base body. Its **+** on the Desk, with a scene's track selected, says the sequence has no clips yet |
| 16 | In the Desk right-click `Sit down`: **Rename...** to `Sit slowly`. Then reopen the scene | The Desk shows the new name. The scene's block is named `▸ Sit slowly` |
| 17 | Right-click `Sit slowly`: **Delete**, confirm. Select the scene's block | The sequence leaves the Desk. The block still plays; its inspector says the sequence is not on this PC's Desk and it plays its copy. **Open Sequence** says the same |
| 18 | Save the scene, close it, open it again | The block is there and plays |
| 19 | With a sequence's tab in front and its lane selected, click the **+** on a sequence in the Desk | A message says a sequence cannot hold another sequence |

| Round | Date | Steps | Result |
|---|---|---|---|
| 1 | 2026-11-16 | 1 to 19, on 0.0.13 at `a73af0e` | **Pass, 19 of 19**, run by the EDGEweb session by script at the owner's request (real mouse and key events in a trial EDGEkit 1.140.6 window, scratch Desk and cache, REDbridge 0.14.0, the real game folder read only; judged from `edgedirPreview.state()`, the inspector, the saved file and screenshots; nobody watched it live). The Desk's sequences, the commands, a `.edgeseq` in the editor and the link's refresh all work inside VS Code. A scene opened with nothing changed on the Desk is not unsaved |
| 2 | 2026-11-16 | The five fixes of 0.0.14, at `69281ac` | **Pass, 5 of 5**, by script in the EDGEweb session, as before. Found: after a Rename the status bar said 1 block was updated when two took the name; with the last sequence deleted the Desk kept an empty Sequences heading. Both looked at in 0.0.15 (the count now includes a block that only took a name; the Desk is read once more a moment after a Delete); not run |

What round 1 found, and what was done:

| Found | Done |
|---|---|
| A block that was up to date said it was out of date when another block of the same sequence was held back for room | Fixed in 0.0.14: how a link stands is kept for each block, not each sequence. Passed round 2 |
| After Ctrl+Z took an update back, the block said its new length does not fit, though it had room | Fixed in 0.0.14: a block whose sequence has changed and would fit says so in its own sentence; "does not fit" is only for one with no room. Passed round 2 |
| Rename did not reach a block held back for room | Fixed in 0.0.14: a block held back keeps its clips and takes the sequence's new name. Passed round 2 |
| Right after Delete, with the scene open, a block still said the sequence on the Desk had changed | Fixed in 0.0.14: open scenes are told again after a Delete or a Rename on the Desk. Passed round 2 |
| Save as Sequence with a name the Desk already has said so only after the second question | Fixed in 0.0.14: the name box refuses it. New Sequence too. Passed round 2 |
| Step 8's text: with the pasted block of step 6 at the end, the first block has little room, so "both blocks are longer" is not always true | The step now says to move the pasted block away first |

## D5b The cue sheet

EDGEdir 0.0.18 (first built as 0.0.16, 2026-11-17). It covers D5b: what a scene will not play in the game as the preview shows it, said in the inspector. Nothing plays in the game yet.

**Before you start:** as for D3 Preview. A scene with an actor track (Judy Álvarez) with two animation clips end to end, and a second actor track with V and one clip.

| Step | Do | Expect |
|---|---|---|
| 1 | Select Judy's first clip | The inspector has no **In the game** heading |
| 2 | Type 1 in **In (s)** | **In the game** appears, with one line: in the game the clip starts from the animation's beginning, not from 1 s |
| 3 | Type 2 in **Speed** | A second line: in the game it plays at normal speed, not at 2 |
| 4 | Ctrl+Z twice | Both lines and the heading are gone |
| 5 | Select Judy's second clip | The line from D4 says the preview cuts here and the game blends by itself. No **In the game** heading |
| 6 | **Add Transition** at the join, and select the transition | Under **In the game**: the game joins the first clip to the second with its own blend, about half a second, not measured; the method, length and ease are the preview's |
| 7 | Select V's clip | Under **In the game**: V does not play in the game yet, V's track is left out |
| 8 | Add an Actor track with no actor, put a clip on it with a typed name (no animation), and select it | No **In the game** heading: a block with no animation plays nowhere |
| 9 | Select Judy's two clips and the transition, **Save as Sequence**, replace them with the block. Select the block | Under **In the game**: the transition's line. Open the sequence in its own tab and select a clip: no **In the game** heading there (changed in 0.0.18; before, every clip said a sequence plays in the game on an actor, in a scene) |
| 10 | Mute Judy's track and select the block | No **In the game** heading: a muted track is not played |

| Round | Date | Steps | Result |
|---|---|---|---|
| 1 | 2026-11-17 | 1 to 10, on 0.0.16 at `18404f8` | **Pass, 10 of 10**, run by the EDGEweb session by script at the owner's request (real mouse and key events in a trial EDGEkit 1.140.6 window, scratch Desk and cache, REDbridge 0.14.0, the real game folder read only; judged from the inspector's headings and its `p.game` lines, the saved file and screenshots; nobody watched it live). The two unrun changes of 0.0.15 passed with it: after a Rename the status bar counted both blocks, and the Sequences heading went with the last sequence |

What round 1 found, and what was done:

| Found | Done |
|---|---|
| With a clip's full list of fields, **In the game** was below the fold of the inspector in a 1440 by 900 window: a tester may not see it appear | Changed in 0.0.18: the section sits near the top, under Name and Start. Passed with D5a's round |
| In a sequence's own tab every clip said the same line (a sequence plays in the game on an actor, in a scene), which reads as a warning about that clip | Changed in 0.0.18: that line is not shown in a sequence's own tab. Step 9's last part now expects no **In the game** there. Passed with D5a's round |
| On V's track only the line about V shows; In and Speed add none | As meant: the track is left out first |

## D5a Sets

EDGEdir 0.0.20 (first built as 0.0.17, 2026-11-17). It covers D5a: EDGEbuilder's scenes as sets, a scene made on one, and the link.

**Before you start:** as for D3 Preview, and an EDGE Library on this PC (`%APPDATA%\EDGE\library.json` names its root; a scratch one for a scripted round). In a folder of the Library, an EDGEbuilder scene `alley.scene.json` named `My Alley` with two people from `Character.*` records a few metres apart, one of them turned, and two meshes with `bounds`. EDGEbuilder's [scene format](https://edgemodders.github.io/EDGEbuilder/scene.html) has the shape; a file written by hand is fine. Put a copy in a folder ending `.bake` too.

| Step | Do | Expect |
|---|---|---|
| 1 | Open the EDGEdir side bar | A **Sets** view between Desk and Library. Under **Library**: `My Alley`, with "2 people, 2 props". One row only: the copy in the `.bake` folder is not listed |
| 2 | Click the **+** on `My Alley`. Accept the name it offers | A scene `My Alley` opens, with two actor tracks named after the two people, empty. The Desk lists it; in the Sets view it shows under `My Alley` |
| 3 | Look at the 3D preview and click **Frame** | Both bodies stand apart as the set has them, one turned. Two grey boxes stand where the meshes are. `edgedirPreview.state()` says 2 bodies and 2 props |
| 4 | Click an empty part of a lane so no clip is selected, and look at the inspector | Under **Set**: `My Alley`, "2 people, 2 props", and the buttons **Choose Set...** and **Remove Set**. No Add button |
| 5 | Select the first actor track | Right, Forward and Turn are shown as plain facts, not boxes, with the line "Placed by the set". Actor, Record and Rig are filled |
| 6 | Add an animation to the first track from the Animations view | It plays on the body in the preview, at the set's place |
| 7 | Save and close the scene. In `alley.scene.json`, move the second person 2 m and add a third person. Open the scene again | The second body stands in its new place; the status bar says 1 actor moved with the set; the scene shows as unsaved. Under **Set**: "3 people", and a button **Add 1 Person from the Set** |
| 8 | Click **Add 1 Person from the Set** | A third actor track, with its body in the preview. The button is gone. Ctrl+Z takes the track away again; redo it |
| 9 | Close the scene (save). Remove the first person from `alley.scene.json`. Open the scene | The first track is still there with its clip. Selected, it says the person is no longer in the set and keeps its place |
| 10 | Close the scene. Rename `alley.scene.json` to `lane.scene.json`. Open the scene | It opens. Under **Set**: the set's file is not there any more, and the scene keeps the places it last read. The bodies stand where they stood. No boxes |
| 11 | Click **Choose Set...** and pick `My Alley` | The set is linked again: boxes are back. The tracks of the people the set still has stay placed by it (facts, not boxes), and no Add button is offered for them |
| 12 | Click **Remove Set** | Under **Set**: no set, the scene plays in front of V. The tracks stay; a track that was placed by the set has boxes for Right, Forward and Turn again, and they can be typed in |
| 13 | **New Scene** on the Desk (no set). Add an Actor track, choose an actor. Under **Set**, **Choose Set...**, `My Alley` | A message says the set's people can be added. The actor chosen by hand keeps boxes for its place. **Add 2 People from the Set** adds two tracks |
| 14 | Put a file `bad.scene.json` holding `{` in the Library and click **Refresh** on the Sets view | `bad` is listed as "cannot be read", with a warning icon and no **+** |

| Round | Date | Steps | Result |
|---|---|---|---|
| 1 | 2026-11-17 | 1 to 14, on 0.0.18 at `49c92a2` | **11 of 14: steps 2, 7 and 9 each missed one expectation.** Run by the EDGEweb session by script at the owner's request (real mouse and key events in a trial EDGEkit 1.140.6 window, scratch Desk, cache and EDGE Library, REDbridge 0.14.0, the real game folder read only; judged from the Sets view's rows, the inspector, `edgedirPreview.state()`, the saved file, the status bar and screenshots; nobody watched it live). By sight in step 3: two bodies about four metres apart, one turned a quarter turn, and two boxes on the floor as light grey outlines, one of them turned 45 degrees. The Sets view, its commands and a real set file all work inside VS Code. With it, 0.0.18's two changes passed: In the game is in view under Name and Start, and a sequence's own tab shows none |
| 2 | 2026-11-17 | 2, 7, 9 and 11, on 0.0.19 at `0d62e8f`, with a fresh scene | **Pass, 4 of 4**, by script in the EDGEweb session, as before; by the numbers, not by sight. The new scene shows under its set at once. With one person moved and one added, the status bar says 1 actor moved, and nobody else's mark changes. A track whose person is gone keeps its mark. The same set chosen again under its new file name keeps the tracks of the people it still has, and offers nothing to add. Every step has now passed |

What round 1 found, and what was done:

| Found | Done |
|---|---|
| Step 2: the new scene was not shown under its set. The set's row had a twistie but stayed shut, also after Refresh | Fixed in 0.0.19: a set's row that gets its first scene is a new row to VS Code, so it shows open. Passed round 2 |
| Steps 7 and 9, one cause: the scene's origin was the middle of the set's people as they are now, so a person added, moved or removed moved the origin and with it every mark. Step 7 said 2 actors moved when one had. In step 9 the person who was gone kept an old mark against a new origin, and so stood 1.4 m from where the set had her | **Fixed in 0.0.19:** the origin is set when the set is chosen and stays there. A mark changes only when its person moves in the world, and a track whose person is gone keeps its place. Passed round 2 |
| Step 11: the same set chosen again under its new file name unlinked every track and offered to add its people a second time | Fixed in 0.0.19: a set of the same name picks the link up where it was. Tracks keep the person they came from when the set still has them, and the origin stays. Step 11 now expects that. Passed round 2 |
| With a track selected, the Set section is the last thing in the inspector and below the fold at 1440 by 900 | Left: the section is in view with no track's fields above it only in a short scene. To look at with D5d, which adds to the inspector |
| The scene made on a set is offered the set's name, so both are "My Alley" in two views | Left as it is |

What round 2 found, and what was done:

| Found | Done |
|---|---|
| After a scene's set was chosen and the scene saved, the Sets view did not list the scene under the set until Refresh | Changed in 0.0.20: the view is read again when a scene is saved. Not run yet |
| Once, after step 11's pick, a message said the scene's unsaved changes were put back from before the window reloaded, though the window had not reloaded. Before it the scene had been opened unsaved (a new hash), saved, closed, and opened again with the set's file renamed | **Open.** Not reproduced and not explained from the code: the page puts unsaved edits back when its kept copy differs from the saved file it was based on, and here a kept copy seems to have outlived a save and close. Nothing was lost. To watch for in later rounds |

## D5d Play in game, in VS Code

EDGEdir 0.0.23 (first built as 0.0.21, 2026-11-17). It covers D5d's part in VS Code, and D5c's steps against a stand-in: the button, the list before the play, the ask before the player is copied, the line, the playhead, Stop. Nothing plays in the game: a stand-in for EDGE Director (`node dist/director-standin.mjs`, after `npm run build`) runs the Director's own steps and prints each call it would make. Since 0.0.24 the player is EDGE Director, its own download: EDGEdir copies nothing into the game's folder, so step 3 changed; steps 3 and 4 as they are now have not run.

**Before you start:** as for D5b The cue sheet, with its scene (Judy with two animation clips end to end, V with one clip), and D5a's scene on a set. The game is not running. A terminal in the repo's folder for the stand-in, with the same `LOCALAPPDATA` as the VS Code window.

| Step | Do | Expect |
|---|---|---|
| 1 | Open the scene. Then open a sequence from the Desk | The scene's toolbar has **Play in Game** after the transport's buttons. The sequence's tab has none |
| 2 | With no stand-in running, click **Play in Game** | A question: the game will not match the preview in 2 places, listing that the game blends where the preview cuts and that V does not play in the game yet. **Cancel**: nothing happens |
| 3 | Click it again and choose **Play Anyway** | When the game's folder has no EDGE Director: a message that Play in game needs EDGE Director, EDGEdir's app in the game, naming its zip and how to install it, with **Open the Download**. **Cancel**: nothing is opened and nothing is copied, the button still reads Play in Game. (When the Director is in the game's folder: a warning that it is not running, with what to do. When it is older than EDGEdir needs: the message says so. Without REDnode in the game's folder: a warning that says so) |
| 4 | Start the stand-in: `node dist/director-standin.mjs`. Click **Play in Game** | No question this time. The line at the right of the toolbar reads Writing 1 workspot, Spawning 1 person, Starting the cast, then **Playing in the game**. The button reads **Stop in Game**. The playhead runs from the scene's start. The stand-in prints one `write` with Judy's two clips, one `spawn` of Judy's record 3 m north of 0, 0, one `use`, and a `jump` at each clip's start |
| 5 | Press Space while it plays | The status says the game is playing this scene; the preview's own play does not start |
| 6 | Wait for the scene's end | The playhead stays at the end. The line says the scene has ended and the cast holds its last clips until Stop. The button still reads Stop in Game |
| 7 | Click **Stop in Game** | The line says Stopped: the cast is removed. The button reads Play in Game. The stand-in prints one `remove` |
| 8 | Select Judy's first clip, type 1 in **In (s)**, click **Play in Game** | The question comes again, now with 3 places. **Play Anyway**: it plays, and the stand-in prints no `write` (the line says the workspots are as they were) |
| 9 | While it plays, click **Play in Game** in a second scene's tab that has an actor with a clip | The stand-in prints a `remove` for Judy before the new scene's `spawn`. The second tab's button reads Stop in Game. The first tab's button reads Play in Game again, and its line says another scene plays in the game now |
| 10 | Stop it. Make a new scene with one empty actor track and click **Play in Game** | A warning: nothing to play in the game. Nothing is sent |
| 11 | Open D5a's scene on its set, give one of the set's people a clip, and click **Play in Game** | The stand-in prints a `write`, then a `load` that lists the set's objects without that person, named `edgedir-set`, then that person's `spawn` at the place the set has them. **Stop in Game**: a `remove` and an `unload` |
| 12 | Stop the stand-in (Ctrl+C) and start it again with `--fail spawn`. Click **Play in Game** in the first scene | The line turns red: Not played, Judy could not be spawned, with the stand-in's reason. The button reads Play in Game |
| 13 | Start the stand-in again without `--fail`, play the scene, and stop the stand-in with Ctrl+C while it plays | Within about 7 s, with no click, the line turns red and says the player stopped and its people are gone from the game. The button reads Play in Game |

| Round | Date | Steps | Result |
|---|---|---|---|
| 1 | 2026-11-17 | 1 to 13, on 0.0.22 at `62ce1c3` | **Pass, 13 of 13.** Run by the EDGEweb session by script at the owner's request (real mouse and key events in a trial EDGEkit 1.140.6 window, scratch Desk, cache and Library, REDbridge 0.14.0, the real game folder read only, the stand-in at player 0.1.0; judged from the button, the line and its colour, the time, the status, the questions' text and the stand-in's output, the page sampled about every 120 ms; nobody watched it live). Step 3 met the no-player case: the question named the game's REDnode apps folder, Cancel was chosen, and nothing was written into the game's folder. In step 11 the set was loaded without the directed person, who was spawned at the set's place for her. In step 13 the line turned red 2.8 s after the stand-in was killed. With it, 0.0.20's change passed: a scene is listed under its set right after it is saved |
| 2 | 2026-11-17 | 9, on 0.0.23 at `ee1f349` | **Pass.** By script in the EDGEweb session, as before. The first tab's button reads Play in Game and its line says another scene plays in the game now, not in red; the second tab plays and stops as it should. Nothing was written to the game's folder |

What round 1 found, and what was done:

| Found | Done |
|---|---|
| Step 9: after a second scene took the play over, the first scene's tab still read Stop in Game and Playing in the game | Fixed in 0.0.23: the tab whose scene was playing is told that another scene plays in the game now, and its button reads Play in Game. Step 9 now expects that. Passed round 2 |
| Round 2: after the second scene was stopped, the first tab's line still said another scene plays in the game. Its playhead stood where it was when the tab was left | Left: the line is replaced at the tab's next play, and a hidden tab's page does not run |
| Spawning 1 person and The workspots are as they were went by too fast for the sampling; both are in the stand-in's output | Left: the stand-in answers in 30 ms, the game does not |
| A scene on a set: the workspots are written before the set is loaded | As meant. Step 11's text says so now |
| Step 2's list has the cut before V's line | The step's text follows the list now |

## D5 in the game

The in-game test of D5c, D5d and DR1 is the owner's [Test E](#test-e-edge-director-in-the-game-play), and DR2's is [Test F](#test-f-edge-director-in-the-game-adjust), under [The owner's tests](#the-owners-tests). Not run yet: nothing of EDGEdir has run in the game.

## DR1 The Director's window

EDGEdir 0.0.24 with EDGE Director 0.2.0 (2026-11-18). The window and its steps with no game: `node dist/director-standin.mjs` (after `npm run build`) runs the Director's own code against a made-up world that prints every call, and serves the window's page at `http://127.0.0.1:4173/` to a browser on this PC only. The page there has no REDnode kit, so it is plain: this test is about what it shows and does, not how it looks. `window.edgeDirector.state()` in the page gives what it shows, for rounds by script.

**Before you start:** a scratch `LOCALAPPDATA` shared by the stand-in and a VS Code window (F5, **Run EDGEdir**). On the Desk: a scene "Talk" with two actors of the game, the first with three animation clips end to end, the second with two and a gap between them; an empty scene; a sequence. The stand-in running, and its page open in a browser.

| Step | Do | Expect |
|---|---|---|
| 1 | Look at the page | **Scenes** lists Talk and the empty scene, the last changed first, with how long ago; the sequence is not listed. The line reads Ready, and EDGE Director 0.2.0 at its right |
| 2 | Click Talk | The scene's name, "in front of V", **Play** and **Start Again** on and **Stop** off, the time 0:00.0 of the scene's length. The strip has a lane for each track with its clips' names at their places; the actors' clips are lit. **In the game** lists a cut for each join |
| 3 | Click **Play** | The line reads Writing 2 workspots, Spawning 2 people, Starting the cast, Playing. Play is off and Stop on. The playhead and the time run. The stand-in prints two `write`, two `spawn`, two `use` and a `jump` at each clip's start |
| 4 | Look at **Cast** while it plays | Each actor with the clip they play now, which changes at each clip's start, and a distance in metres |
| 5 | Press down on the ruler at about two thirds and let go | The time goes there and runs on. The stand-in prints one `jump` for each actor to that moment's clip, and no `spawn` |
| 6 | Click **Start Again** | The time starts from 0. A `jump` for each actor to their first clip; no `spawn` |
| 7 | Switch **Loop** on and wait for the end; then switch it off and wait again | At the end the scene starts again by itself. With Loop off, the line says the scene has ended and the cast holds its last pose until Stop, and the playhead stays at the end |
| 8 | Click an actor's row; click it again; click **Go There** on the other | The row and the actor's lane are lit, and the stand-in prints a `pin` with the actor's name; again, an `unpin`. Go There prints a `teleport` 1.8 m in front of that actor, and the distances change |
| 9 | Click **Stop** | The line reads Stopped: the cast is removed. A `remove` for each actor. Cast says nobody is in the game |
| 10 | Press down on the ruler at a third, then click **Play** | The play starts there: the `use` of each actor names that moment's clip, and the time starts from that moment |
| 11 | Click **Scenes**, then the empty scene | A red box says why it cannot play. Play and Start Again are off |
| 12 | In VS Code, open Talk, move a clip and save. Then click **Play in Game** | Within about 3 s the strip in the browser shows the moved clip. Play in Game: no question about a player; VS Code's line reads Playing in the game and its playhead runs; the browser's line reads Playing (from VS Code), its playhead runs too, and the scene's row in Scenes says In the game. **Stop in Game** stops both |
| 13 | Stop the stand-in and start it with `--fail spawn`; reload the page, open Talk, click **Play** | The line turns red: Not played, the actor could not be spawned, with the stand-in's reason. Play is on again |

| Round | Date | Steps | Result |
|---|---|---|---|
| 1 | 2026-11-21 | 1 to 13 | **12 of 13; step 12 missed one expectation.** Run by the EDGEweb session by script at the owner's request, on 0.0.29 at `355bd66` with the stand-in at EDGE Director 0.6.0 (a trial EDGEkit 1.143.1 window, scratch Desk, cache, Library and `%APPDATA%`, REDbridge 0.14.0, the real game folder read only; the Director's page in a headless Edge with the stand-in's `--kit`, real pointer events, judged from the page, `edgeDirector.state()` and the stand-in's output; nobody watched it live). The scene: Judy with three clips end to end, Panam with two and a gap before each; the stand-in printed a hold in each gap and at Panam's wait before her first clip. In step 12 the strip showed VS Code's saved change after 1.3 s, and the play from VS Code ran in both; the scene's row had no In the game tag |

What round 1 found, and what was done:

| Found | Done |
|---|---|
| Step 12: the scene's row in Scenes had no In the game tag for a play from VS Code. VS Code names the file with a small drive letter and the Desk's list with a capital, and the two were compared as text | Fixed in EDGE Director 0.6.1: a play from VS Code takes the Desk's own spelling of the file. Not run |
| Start Again and the loop's start printed a waiting actor's first jump twice | Fixed in EDGE Director 0.6.1: after a seek the actor is at the clip's start already and is only held. Not run |
| Step 10: for a moment the clock showed about 0.3 s before the chosen moment | Left: the play starts a short lead after the cast is ready, and the clock counts up to it |
| Step 7: the line says the cast holds its last pose; the step said last clips | The step's text follows the line now |
| Step 1: without the stand-in's `--kit`, Loop's switch fires no change in a plain browser | Left: run the stand-in with `--kit` for this test |

## DR2 Adjust

EDGEdir 0.0.25 with EDGE Director 0.3.0 (2026-11-18). Adjust with no game, as [DR1's test](#dr1-the-directors-window) is run: the stand-in (`node dist/director-standin.mjs`), its page in a browser, and a VS Code window (F5) on the same scratch `LOCALAPPDATA`. In the stand-in V stands at 0, 0 facing north, and **Go There** moves V.

**Before you start:** DR1's Desk. Talk is saved and open in VS Code. A scene on a set with one of the set's people directed (D5a's), saved.

| Step | Do | Expect |
|---|---|---|
| 1 | In the page open Talk and click the second actor's name at the left of the strip | The lane's name is lit. **Adjust** shows the actor's name and Right, Forward and Turn as VS Code's inspector has them, with Move to V, Left, Right, Forward, Back, Turn -15, Turn +15 |
| 2 | Click **Right** | Right is 0.1 more. In VS Code, within a moment and with no click, the track's inspector shows the same number, the body in the preview moved, and the tab is not marked unsaved |
| 3 | In VS Code press Ctrl+Z | The mark goes back to what it was, and the tab is now unsaved. (Unverified until this round: that VS Code takes the file's change as an edit Undo reaches.) Then save, or revert the file |
| 4 | With nothing playing, click **Move to V** | The line turns red: the scene plays in front of V, so press Play first, or The Scene Is Here. Nothing changes |
| 5 | Click **Play**; when it plays, click **Go There** on the first actor, then **Move to V** with the second chosen | The stand-in prints one `move` of the second actor to V's place, with V's turn. Adjust's numbers change; VS Code follows |
| 6 | Click **Turn +15** | One `move` to the same place with the turn 15 more |
| 7 | Click **The Scene Is Here** | No `move`. The header reads "at" and three numbers, and **In Front of V** shows. In VS Code the file has `"anchor": { "mode": "world", ... }` |
| 8 | Click **Stop**, then **Move to V** | It works with nobody in the game: the numbers change, no `move` is printed |
| 9 | Click **In Front of V** | The header reads "in front of V" again and the button goes |
| 10 | In VS Code move a clip and do not save | Within about 4 s the page shows a yellow box about unsaved changes in VS Code; Adjust's buttons and The Scene Is Here are off. **Play** plays the scene as it was last saved (the box says so; the moved clip is not in it). Clicking an Adjust button does nothing |
| 11 | Save in VS Code | Within about 4 s the box goes and the buttons are on |
| 12 | Open the scene on a set and click the directed person's name on the strip | Adjust says the actor is placed by the set, with no buttons. The header has no The Scene Is Here |

| Round | Date | Steps | Result |
|---|---|---|---|
| 1 | 2026-11-21 | 1 to 12 | **Pass, 12 of 12.** Run by the EDGEweb session by script at the owner's request, on 0.0.29 at `355bd66` with the stand-in at EDGE Director 0.6.0 (a trial EDGEkit 1.143.1 window, scratch Desk, cache, Library and `%APPDATA%`, REDbridge 0.14.0, the real game folder read only; the Director's page in a headless Edge with the stand-in's `--kit`, real pointer events, judged from the page, `edgeDirector.state()` and the stand-in's output; nobody watched it live). VS Code showed an Adjust change in the open scene with no click (under 100 ms at the first look), the tab not unsaved, and Ctrl+Z took it back: this supersedes "unverified" for both. The yellow box came 0.87 s after an unsaved change and went 0.76 s after the save |

What round 1 found, and what was done:

| Found | Done |
|---|---|
| Step 10: with unsaved changes in VS Code, Play in the window plays the saved file, not VS Code's version; the step read as if the unsaved version played | As meant: the window reads the file. The box now says "It plays here as it was last saved" (EDGE Director 0.6.1), and the step's text follows. Not run |

## DR3 Pins

EDGEdir 0.0.26 with EDGE Director 0.4.0 (2026-11-18). The Director's pins with no game, as [DR1's test](#dr1-the-directors-window) is run: the stand-in and its page in a browser. V stands at 0, 0 until **Go There** moves V. The stand-in prints a `pin` for each pin it would draw and an `unpin` for each it takes away.

**Before you start:** DR1's Desk, with Talk saved, in front of V, with no pins. Nothing playing.

| Step | Do | Expect |
|---|---|---|
| 1 | Open Talk. Under **Pins** click **Drop a Pin Here** with the box empty; then type `Stairs` and press Enter | Empty: nothing happens, and the box takes the cursor. With the name: a row Stairs, 0 m, with Go There, Actor Here (off), Scene Here, Drop Again, Remove. The stand-in prints a `pin` Stairs. Beside the scene's file on the Desk there is `Talk.pins.json` with `"format": "rednode-pins"` and the pin; the scene's file has `"pins"` with the path `Talk.pins.json` |
| 2 | Click the second actor's name on the strip, then that actor's **Here** on Stairs | The line turns red: the scene plays in front of V, so a pin is no place in it. Nothing changes |
| 3 | Click **Scene Here** on Stairs | The header reads "at the pin Stairs". The row has a tag "the scene". The scene's file has `"anchor"` with `"mode": "world"`, the pin's place and `"pin": "Stairs"` |
| 4 | Click **Play**, then **Go There** on the first actor in Cast, then type `Door` and drop it | A second row Door. Its distance is 0 m and Stairs's is more |
| 5 | Click the second actor's **Here** on Door | Adjust reads the mark with "at the pin Door"; Door's row has the actor's name as a tag. The stand-in prints one `move` of that actor to the pin's place |
| 6 | Click **Go There** on Stairs, then **Drop Again** on Door | V goes to Stairs (a `teleport`). Door is at V's place now: an `unpin` and a `pin` Door, and one `move` of the actor there. The mark in the file changed |
| 7 | Click **Stop**. In a text editor change Door's `x` in `Talk.pins.json` by 2 and save | Within about 3 s the actor's mark in Adjust is 2 m different, with no click, and the scene's file has it |
| 8 | Click **Left** in Adjust | The mark moves 10 cm and no longer says "at the pin"; Door's row loses the actor's tag |
| 9 | Click **Remove** on Stairs | The row goes and an `unpin` is printed. The header reads "at" with the three numbers the pin had: the scene stays there and follows nothing |
| 10 | Click **Scenes** | An `unpin` for each pin still drawn |

| Round | Date | Steps | Result |
|---|---|---|---|
| 1 | 2026-11-21 | 1 to 10 | **Pass, 10 of 10.** Run by the EDGEweb session by script at the owner's request, on 0.0.29 at `355bd66` with the stand-in at EDGE Director 0.6.0 (a trial EDGEkit 1.143.1 window, scratch Desk, cache, Library and `%APPDATA%`, REDbridge 0.14.0, the real game folder read only; the Director's page in a headless Edge with the stand-in's `--kit`, real pointer events, judged from the page, `edgeDirector.state()` and the stand-in's output; nobody watched it live). Run twice from a reset scene (the first run clicked a wrong button). In step 7 the mark followed the pin file 1.3 s after it changed, with no click |

## DR3 Pins in the editor

EDGEdir 0.0.27 (2026-11-18). Pins in VS Code: the inspector's Pins section, a pin for the scene's place and for a mark, the posts in the preview, and the scene following its pin file. No game and no stand-in.

**Before you start:** F5 (**Run EDGEdir**) with a scratch `LOCALAPPDATA` and `APPDATA`. On the Desk a saved scene Talk with two actors of the game, in front of V. Beside Talk's file, a pin file `Talk.pins.json` with two pins 4 m apart (write it by hand in REDnode's format, or drop them with the stand-in, [DR3 Pins](#dr3-pins), steps 1 and 4). In `%APPDATA%\@rednode\overlay\pins`, a second pin file with one pin.

| Step | Do | Expect |
|---|---|---|
| 1 | Open Talk and click an empty part of the timeline | The inspector has a **Pins** section: a note that the scene has no pins, and **Choose Pins...** |
| 2 | Click **Choose Pins...** | A list with Talk's own file ("Beside this scene") and the second file ("Your pins in the game (REDnode)"), each with its number of pins, and Browse for a pin file |
| 3 | Pick Talk's own | Pins shows the name and "2 pins", a row for each pin with its place in the world, **The scene's place** set to In front of V, and a note that the pins are not in the preview while the scene plays in front of V. No posts in the preview |
| 4 | Set **The scene's place** to the first pin | Two yellow posts with the pins' names stand in the preview, the first at the origin. The pins' rows read Right and Forward from the origin, and the first names "the scene" |
| 5 | Select the second actor's track and set **At pin** to the second pin | The body stands at the second post. Right and Forward are that pin's. The pin's row in the scene's Pins names the actor |
| 6 | Type another number in **Right (m)** | The body moves, and At pin reads None |
| 7 | Set At pin to the second pin again and save. In a text editor move that pin 2 m in `Talk.pins.json` and save | Within about 3 s the post and the body move 2 m with no click; the status bar says the scene follows its pins; the tab is unsaved |
| 8 | Ctrl+Z | The body and the post go back |
| 9 | Click **Remove Pins** | The Pins section says no pins. The bodies stay where they are, the posts go, and At pin is gone from the track |
| 10 | Ctrl+Z, then **Choose Pins...** and pick the file from the game | The scene has that file's one pin; the actor's At pin shows the old pin as gone and keeps its place. A scene whose place was at a pin that is gone reads "The pin <name> (gone)" in The scene's place |

| Round | Date | Steps | Result |
|---|---|---|---|
| 1 | 2026-11-21 | 1 to 10 | **Pass, 10 of 10.** Run by the EDGEweb session by script at the owner's request, on 0.0.29 at `355bd66` with the stand-in at EDGE Director 0.6.0 (a trial EDGEkit 1.143.1 window, scratch Desk, cache, Library and `%APPDATA%`, REDbridge 0.14.0, the real game folder read only; the Director's page in a headless Edge with the stand-in's `--kit`, real pointer events, judged from the page, `edgeDirector.state()` and the stand-in's output; nobody watched it live), steps 4, 5 and 7 by sight too. The pins folder was a scratch `%APPDATA%\@rednode\overlay\pins`, not the owner's. In step 7 the inspector followed the pin file 0.44 s after it changed |

What round 1 found, and what was done:

| Found | Done |
|---|---|
| Step 10: after another pin file was chosen, The scene's place read "In front of V" though the scene kept its place in the world: the gone pin had no entry in the list | Fixed in 0.0.30: it reads "The pin <name> (gone)". The step's text has it. Not run |

## D6a Weather

EDGEdir 0.0.28 with EDGE Director 0.5.0 (2026-11-18). The weather track in VS Code, and the calls the Director would make, with the stand-in (`node dist/director-standin.mjs`). The stand-in prints `weather` with the state and the blend for a weather set, and `weather-back` when it is given back.

**Before you start:** F5 (**Run EDGEdir**) with the game's files and REDbridge 0.14.0, as for D5b. A saved scene with one actor of the game with a clip 10 s long. The stand-in running on the same `LOCALAPPDATA`.

| Step | Do | Expect |
|---|---|---|
| 1 | **Add Track**, Weather; then again | A Weather lane. The second time: a message that a scene has one weather track, and no new lane |
| 2 | Add a clip on the Weather lane at 2 s, 4 s long, and select it | The inspector has **Weather** and **Blend (s)** (5). Within about 15 s the first time, Weather is a list of the game's weathers by plain name (Cloudy, Fog, Heavy clouds, Rain, Sunny, and more); before that, or without the game's files, a text box with a note. A note says the clip has no weather yet |
| 3 | Choose Rain | The clip reads Rain on the lane. **In the game** says the change starts at the clip's start and is asked to take 5 s, and that the weather goes back at the clip's end |
| 4 | Set Blend (s) to 6, then to 61 | 6: a note that the blend is longer than the clip. 61: refused with a message, and the box goes back to 6 |
| 5 | Drag the playhead to 3 s, then to 7 s | At 3 s the viewport's line starts with "Weather: Rain" and the view has a grey tint (`edgedirPreview.state().weather` is "Rain"); at 7 s neither |
| 6 | Add a second weather clip from 6 s to 8 s (touching the first) and choose Sunny | The first clip's note about going back at its end is gone; the second has it |
| 7 | Click **Play in Game**, **Play Anyway** | The stand-in prints, with the actor's calls: `weather` "WeatherPresets.Rain" with blend 6 about 2 s after the start, `weather` "WeatherPresets.Sunny" at 6 s, and `weather-back` at 8 s |
| 8 | Play again and click **Stop in Game** at about 4 s | A `weather-back` with the `remove` |
| 9 | Mute the Weather track and play | No `weather` is printed |
| 10 | Unmute it. Make a new scene with only a Weather track and one Rain clip, and click **Play in Game** | It plays: no `write` and no `spawn`, a `weather`, and at the clip's end `weather-back` and "The scene has ended" |
| 11 | In the stand-in's page (http://127.0.0.1:4173/) open the first scene | The strip has the Weather lane with Rain and Sunny on its clips, lit. The lane's name says in its tooltip that each clip holds its weather in the game |

| Round | Date | Steps | Result |
|---|---|---|---|
| 1 | 2026-11-21 | 1 to 11 | **8 of 11; steps 3, 4 and 6 each missed the inspector's In the game lines.** Run by the EDGEweb session by script at the owner's request, on 0.0.29 at `355bd66` with the stand-in at EDGE Director 0.6.0 (a trial EDGEkit 1.143.1 window, scratch Desk, cache, Library and `%APPDATA%`, REDbridge 0.14.0, the real game folder read only; the Director's page in a headless Edge with the stand-in's `--kit`, real pointer events, judged from the page, `edgeDirector.state()` and the stand-in's output; nobody watched it live), step 5 by sight too. The list had the game's 15 weathers at once. In the stand-in the weather was set at each clip's start and given back at the last clip's end, at Stop, and not at all with the track muted; a scene with only weather played with no write and no spawn |

What round 1 found, and what was done:

| Found | Done |
|---|---|
| Steps 3, 4 and 6: a weather clip's inspector had no In the game heading and none of its lines (the change and its blend, going back at the end, a blend longer than the clip). The lines were in Play in Game's question and in the Director's window | Fixed in 0.0.30: the inspector shows In the game for a weather clip as for an actor's. Not run |
| Step 11: the weather lane's name in the Director's window had the tooltip "weather tracks do not play in the game yet" | Fixed in EDGE Director 0.6.1: it says each clip holds its weather in the game. Not run |
| Step 2: the text box of before the list was not seen | Left: the game had been read earlier in that window, so the list was there at once |
