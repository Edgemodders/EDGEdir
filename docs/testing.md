---
title: Tests
---

# <span class="y">Tests</span>

Every test run on EDGEdir: how to run it again, what to expect, and what it showed. Each phase ends with a hand test, run in full by script or by the owner, and spot tests of its main features by the owner ([the release gate](#the-release-gate)); new tests are added here when they are first run, and their later runs' results too.

Last updated 2026-11-16.

## At a glance

| Test | Kind | Phase | Last run | Result |
|---|---|---|---|---|
| [Type check, build and unit tests](#type-check-build-and-unit-tests) | Automated, also on GitHub (Check) | Scaffold, D1, D2 | 2026-11-16 | Pass, 47 tests |
| [D1 Timeline](#d1-timeline) | Hand, in VS Code | D1 | 2026-11-16 | By script: round 1, 22 of 22 (0.0.2); round 2, the three steps new in 0.0.3 pass (0.0.6). Step 23 is a known limit of VS Code's, not a fault |
| [D2 Cast, part 1](#d2-cast-part-1) | Hand, in VS Code, with the game's files | D2.1 to D2.4 | 2026-11-16 | By script: 15 of 15 pass (0.0.6, REDbridge 0.13.0) |
| [D2 Clips, part 2](#d2-clips-part-2) | Hand, in VS Code, with the game's files and REDbridge 0.14.0 | D2.5, D2.6 | 2026-11-16 | By script: 17 of 17 pass (0.0.6, REDbridge 0.14.0) |
| [D2 Made animations, part 3](#d2-made-animations-part-3) | Hand, in VS Code, with an EDGE Library | D2.7 | 2026-11-16 | By script: 6 of 6 pass (0.0.6) |
| [D3 Preview](#d3-preview) | Hand, in VS Code, with the game's files and REDbridge 0.14.0 | D3 | 2026-11-16 | By script: 17 of 17 pass (0.0.9, REDbridge 0.14.0) |

## The release gate

The owner's rule, set on 2026-11-16. A release needs both:

| What | Who | Counts when |
|---|---|---|
| Every hand test of the changes since the last release, in full | A Claude session by script (real mouse and key events in a VS Code window), or the owner | Every step passed in its latest round |
| The [spot tests](#spot-tests-for-the-owner) of the major features changed since the last release | The owner, by hand | Each one passed |

The rounds by script are there so that work does not wait for the owner's testing. They do not replace the owner's look at the main features.

## Waiting for a test

Every hand test (D1, D2, D3) has passed a round run by script in another session (2026-11-16). Still open before a release:

- **Four fixes in EDGEdir 0.0.10** from D3's round, not run in VS Code yet: listed under that test's round.
- **The owner's spot tests** S1 to S8 below: none run yet.
- The fix of 0.0.8 (a change the inspector refuses puts its box back) passed in D3's round.

## Spot tests for the owner

One short test per major feature, about 20 minutes in all. Each one names the full test it is drawn from, which has the detail. A new phase adds its own rows.

**Before you start:** the game installed (not running) and REDbridge 0.14.0 (REDcode's **Install REDbridge** fetches it). Open the EDGEdir folder in VS Code, run `npm run build`, press F5 (**Run EDGEdir**). The first **Read the Game** takes a few minutes, once.

| Spot | Feature | Do | Expect | From |
|---|---|---|---|---|
| S1 | The timeline | In the Desk, **New Scene** `Spot`. **Add Track**: Actor, then Audio. Add two clips to the Actor lane. Drag one, drag an edge, put the playhead in one and press **S**. Press Ctrl+Z three times | Clips move, snap and never overlap; the edge trims by frames; S cuts in two; each Ctrl+Z takes one change back | D1, 1 to 7, 14 |
| S2 | Play, save, the Desk | Press Space, then Space again. Ctrl+S, close the tab, click `Spot` in the Desk | The playhead runs in real time and stops. The scene opens as it was left | D1, 11, 15 |
| S3 | The game's animations | Open the **Animations** view, **Read the Game**. When the status bar's count is done, open **Game** down to an animation file and open it. Search `sit chair` | About 14,000 files in folders; a file opens to its animations with their lengths; the search lists animations with both words | Part 1, 1 to 4; part 2, 1 to 3 |
| S4 | The actor picker | Click the Actor lane's head, **Choose Actor...**, type `judy`, pick Judy Álvarez and an appearance. On a second Actor track choose **V (the player), feminine body** | The track takes the actor's name and the inspector shows Record, Appearance and Rig (`woman_base`). V needs no appearance; V is not offered on the other track | Part 1, 6, 7, 10, 11 |
| S5 | Animations on a track | Select Judy's track, turn on **Only What Fits the Selected Actor**, click the **+** on an animation. On the clip set Speed to 2, then Loops to 3. Add a second clip right after it, then set the first one's Loops to 9 | The clip lands at the playhead, as long as the animation, and is selected. It gets half as long, then three times that, with marks where it starts again. Loops 9 is refused with a message and the box goes back to 3 | Part 2, 4, 5, 9; the fix of 0.0.8 |
| S6 | The rig rule | **Change Actor...** on Judy's track to a man. Then save, close and reopen the scene | Every clip is hatched red and the inspector says Unfit and why; nothing is removed. Reopened, it is the same | Part 2, 13, 16 |
| S7 | A made animation | Run `node tools/made-anim-sample.mjs`, click **Refresh** in the Animations view, click the **+** on `Sample wave`. Then run it with `--remove` | A **Library** group with `Sample wave`, 2.40 s; the clip `sample_wave` lands on the track as a made animation. After the remove and a Refresh the group is gone and the clip stays | Part 3, 1 to 3, 6 |
| S8 | The 3D preview | Open the scene of S4 to S6 with Judy's track set back to Judy. Drag the playhead through her clips, then press Space. Select V's track and set **Turn (°)** to 180. Drag in the view, then click **Frame** | Two grey bodies stand side by side above the timeline; V's has no head and the line says it stands in for your V. Judy takes the pose under the playhead and plays in time. V turns round. The view orbits, and Frame fits both | D3, 2 to 8, 12 |

| Round | Date | Spots | Result |
|---|---|---|---|
| 1 | | | Not run yet |

## Type check, build and unit tests

```powershell
npm run typecheck
npm run build
npm test
```

The **Check** workflow runs the same on every push to `main`. The tests are pure: no VS Code and no game. The scaffold's 3 tests check that the activity bar container has its icon, and that the views the extension registers are the ones package.json declares, each with welcome text. D1.1's 16 tests (`test/doc.test.ts`) check the scene document: reading and writing it, the messages for a file that is not a scene, that fields of later phases survive an edit, and every edit's rules (tracks, add, move, trim, split, paste, the no-overlap rule and its exception for transitions, locked tracks, snap). D1.6's 4 tests (`test/desk.test.ts`) check the Desk's folders in a temporary folder: a new scene's item shape, names, the list, and rename. D3's 7 tests (`test/preview.test.ts`) check the pose under the playhead (a clip's own time, loops, a gap, a clip passed over), the marks, and the preview's files with a stand-in bridge: exported once, found again, V's base body, a failure not kept.

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

EDGEdir 0.0.10 (first built as 0.0.9, 2026-11-16). It covers D3: the 3D view above the timeline.

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

What round 1 found, and what was done:

| Found | Done |
|---|---|
| Step 9: in a short editor (480 px, with the bottom panel open) the splitter could not be dragged down at all: the cap equalled the view's first height | Fixed in 0.0.10: the view starts at 260 px or 45% of the editor, whichever is less, and can be dragged to 130 px from the bottom. Not run yet |
| A file that failed was never asked for again while the tab stayed open. Seen once, after the bridge's setting changed just before a reload: the view kept "no body" for minutes though the bridge was up. Closing and opening the scene brought the bodies | Fixed in 0.0.10: a failed file is asked for once more by itself after 5 s, and **Frame** asks again for everything that failed. Not run yet |
| With no REDbridge the line gave the same reason five times, cut off after the first | Fixed in 0.0.10: one reason is said once, with what it stopped ("Not loaded: Judy Álvarez's body, ... REDbridge was not found ... Frame tries again"), and the tooltip has the whole line. Not run yet |
| The view fitted the first body only: a second actor's ring was cut off until Frame, and a clip that lies down dropped under the edge | Fixed in 0.0.10: each new body fits the view again until the view is moved by hand, and the fit leaves room for arms out and for lying down. Not run yet |
| Step 16: a reopened scene has the playhead at 0 and the view at its first height, not as left | Left: neither is kept with the scene yet. The step now says so |
| Bodies 0.8 m apart pass through each other in the arms-out rest pose | Left as it is: a mark moves them apart |
| Step 15: the tooltip was read from the page, not seen drawn | Nothing: a script cannot see a native tooltip |
