---
title: Tests
---

# <span class="y">Tests</span>

Every test run on EDGEdir: how to run it again, what to expect, and what it showed. Each phase will end with a hand test by the owner; new tests are added here when they are first run, and their later runs' results too.

Last updated 2026-11-16.

## At a glance

| Test | Kind | Phase | Last run | Result |
|---|---|---|---|---|
| [Type check, build and unit tests](#type-check-build-and-unit-tests) | Automated, also on GitHub (Check) | Scaffold, D1 | 2026-11-16 | Pass, 23 tests |
| [D1 Timeline](#d1-timeline) | Hand, in VS Code | D1 | Not run yet | Waiting (EDGEdir 0.0.2) |

## Waiting for a hand test

- [D1 Timeline](#d1-timeline), EDGEdir 0.0.2.

## Type check, build and unit tests

```powershell
npm run typecheck
npm run build
npm test
```

The **Check** workflow runs the same on every push to `main`. The tests are pure: no VS Code and no game. The scaffold's 3 tests check that the activity bar container has its icon, and that the views the extension registers are the ones package.json declares, each with welcome text. D1.1's 16 tests (`test/doc.test.ts`) check the scene document: reading and writing it, the messages for a file that is not a scene, that fields of later phases survive an edit, and every edit's rules (tracks, add, move, trim, split, paste, the no-overlap rule and its exception for transitions, locked tracks, snap). D1.6's 4 tests (`test/desk.test.ts`) check the Desk's folders in a temporary folder: a new scene's item shape, names, the list, and rename.

## D1 Timeline

EDGEdir 0.0.2, built 2026-11-16. Not run yet.

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

| Round | Date | Steps | Result |
|---|---|---|---|
| 1 | | | Not run yet |
