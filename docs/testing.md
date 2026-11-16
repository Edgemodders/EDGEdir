---
title: Tests
---

# <span class="y">Tests</span>

Every test run on EDGEdir: how to run it again, what to expect, and what it showed. Each phase will end with a hand test by the owner; new tests are added here when they are first run, and their later runs' results too.

Last updated 2026-11-16.

## At a glance

| Test | Kind | Phase | Last run | Result |
|---|---|---|---|---|
| [Type check, build and unit tests](#type-check-build-and-unit-tests) | Automated, also on GitHub (Check) | Scaffold, D1, D2 | 2026-11-16 | Pass, 28 tests |
| [D1 Timeline](#d1-timeline) | Hand, in VS Code | D1 | 2026-11-16 | Round 1 by script: 22 of 22 pass (EDGEdir 0.0.2). The fixes in 0.0.3 and the owner's own run are open |
| [D2 Cast, part 1](#d2-cast-part-1) | Hand, in VS Code, with the game's files | D2.1 to D2.4 | Not run yet | Waiting (EDGEdir 0.0.4). The core passed a scripted run against the real game |

## Waiting for a hand test

- [D1 Timeline](#d1-timeline), EDGEdir 0.0.3: the owner's own run, or the owner's word that round 1 by script is enough; steps 4, 5 and 22a are new in 0.0.3.
- [D2 Cast, part 1](#d2-cast-part-1), EDGEdir 0.0.4.

## Type check, build and unit tests

```powershell
npm run typecheck
npm run build
npm test
```

The **Check** workflow runs the same on every push to `main`. The tests are pure: no VS Code and no game. The scaffold's 3 tests check that the activity bar container has its icon, and that the views the extension registers are the ones package.json declares, each with welcome text. D1.1's 16 tests (`test/doc.test.ts`) check the scene document: reading and writing it, the messages for a file that is not a scene, that fields of later phases survive an edit, and every edit's rules (tracks, add, move, trim, split, paste, the no-overlap rule and its exception for transitions, locked tracks, snap). D1.6's 4 tests (`test/desk.test.ts`) check the Desk's folders in a temporary folder: a new scene's item shape, names, the list, and rename.

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
| 23 | With an installed build (not F5): double-click a `.edgedir` file in File Explorer, or pass it to VS Code on the command line | It opens in the scene editor, not as text, and the Desk lists it under **Recent** |

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

## D2 Cast, part 1

EDGEdir 0.0.4, built 2026-11-16. Not run yet. It covers D2.1 to D2.4: the game's files, the actor picker with V, and the Animations view's file list.

**Before you start:** the game installed (not running), and REDbridge 0.13.0, which comes with REDcode. Open the EDGEdir folder in VS Code, run `npm run build`, press F5 (**Run EDGEdir**). To see the first read, delete `%LOCALAPPDATA%\EDGEdir\cache` if it is there.

| Step | Do | Expect |
|---|---|---|
| 1 | Click the EDGEdir icon and open the **Animations** view | It says the game's animations are listed here, with **Read the Game** |
| 2 | Click **Read the Game** | A note at the bottom right, "EDGEdir is reading the game": first the characters (about 15 s), then the animation files (about 2 minutes, counting game files). Then the view shows **Game** with about 14,000 animation files |
| 3 | Open **Game**, then `base`, then `animations`, and a folder below | Folders with their counts, then animation files by name |
| 4 | Click the search button in the view's title, type two words from a name you saw | A line with the count, then the matching files, each with its folder. The clear button brings the folders back |
| 5 | Right-click an animation file: **Copy Game Path**. Paste somewhere | The file's game path, ending `.anims` |
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
| 1 | | | Not run yet |

