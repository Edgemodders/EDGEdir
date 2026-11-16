---
title: D1 Timeline
---

# <span class="y">D1</span> Timeline

**Status: plan, agreed with the owner on 2026-11-16. Nothing is built yet.**

D1 is the first phase of the [design](design.html): the scene document, its editor, New Scene and the Desk. It needs no other tool: no REDcode, no REDnode, no game. Clips are plain blocks with a name and a typed-in length. Real animations come in D2, the 3D preview in D3.

## What D1 decides

- A scene opens in a custom text editor for `*.edgedir`. The file stays JSON text, so it can be read, compared and fixed by hand.
- Every change posts the whole document back to VS Code as one edit. Undo, redo, save and the dirty mark are VS Code's own, as in EDGEwave.
- The document's rules live in one pure module with unit tests. The page and the host both use it.
- D1's editor has the lanes, the transport and the inspector. The viewport's place is kept, empty, with a line saying the preview comes later.
- All seven track kinds can be added from D1 on, so the document's shape is tried early. Outside the actor track, a clip is a named block with a start and a length until its phase gives it fields.

## Steps

Each step is one or more small commits, with its unit tests. The hand test comes after the last.

| Step | Builds | Checked by |
|---|---|---|
| **D1.1 Document** | `src/doc.ts`: the types, `parseDoc` (with clear errors and a version check), `formatDoc`, and the edits as pure functions: add, remove, rename and reorder tracks; add, move, trim, split and remove clips; the no-overlap rule on a track; snap to frames and to clip edges | Unit tests |
| **D1.2 Editor shell** | The custom editor (`edgedir.scene`), the page built by esbuild, the whole-document edit loop, unsaved work kept over a window reload, a plain message when the file is not a scene | F5: a scene opens, a text edit beside it shows in the page |
| **D1.3 Lanes** | Canvas: the ruler in seconds and frames, lanes with name, kind, mute and lock, clips as blocks, the playhead; zoom (Ctrl+wheel) and scroll; Add Track with a kind | F5 |
| **D1.4 Clip editing** | Add a clip; drag to move, along a lane and to another lane of the same kind; drag an edge to trim; snap, held off with Alt; select one or several; delete, copy, paste, split at the playhead; reorder lanes by dragging | F5, and the pure edits' unit tests |
| **D1.5 Transport and inspector** | Play, stop, loop, previous and next edge, the time shown as seconds and frames; the playhead runs on the real clock. The inspector edits the selected clip's or track's fields | F5 |
| **D1.6 Desk** | New Scene (asks a name, makes the folder on the Desk, opens the scene); the Desk view with the Desk's scenes and Recent; Rename, Delete (to the recycle bin, after asking), Reveal in Explorer; `asset.json` by the shared Library's rules | Unit tests for the folder code; F5 |
| **D1.7 Close** | Welcome texts, the changelog line, the status badge, docs, the version raised for the hand test | The hand test below |

## The document in D1

The shape in the design, with these D1 limits:

| Field | In D1 |
|---|---|
| `edgedir`, `name`, `fps` | Written and read. `fps` is 30 and not shown yet |
| `anchor`, `set` | Written with their defaults, not shown |
| Track: `id`, `kind`, `name`, `mute`, `lock`, `clips` | All edited in the editor |
| Actor track: `actor`, `mark` | Kept if present, not shown (D2) |
| Clip: `id`, `kind`, `start`, `length`, `name` | Edited. `kind` is `anim` or `transition` on an actor track, and the track's kind elsewhere |
| Clip: `anim`, `in`, `out`, `method`, `ease` and later fields | Kept untouched when present, so a later version's file is not damaged |

A scene's length is the end of its last clip. Ids are short and made once (`t1`, `c1`). A transition in D1 is a block that may overlap its two neighbours; its rules come in D4.

## What is copied from EDGEwave

Copied, not imported, with a note of the source version in each file: the editor and host pattern, the canvas setup for sharp drawing, the ruler and its step sizes, the lane drag logic, the splitter, and the look (colours, outlined buttons, mono labels). EDGEwave's audio code is not used.

## Where things are

| Thing | Place |
|---|---|
| Desk | `%LOCALAPPDATA%\EDGEdir\desk\<name>.act.asset\`, with the scene at `source/raw/edgedir/<name>.edgedir` |
| Recent | The extension's global state, 20 at most |
| A scene anywhere else | Any `.edgedir` file opens in the editor, wherever it is |

The kind word is `act`, because EDGEbuilder's Library already uses `scene` (the design's Q2).

## Not in D1

Real animations and their lengths, the actor picker, the Animations view (D2). The 3D preview (D3). Transition methods and sequences (D4). The game (D5). The Library and Project views, Move to Project and Add to Library (D7). MCP tools (D8).

## Hand test (to be written out in Tests when D1 is built)

| Step | Do | Expect |
|---|---|---|
| 1 | F5, open EDGEdir, **New Scene**, name it | The scene opens with empty lanes; the Desk lists it |
| 2 | Add an actor track, an audio track and a camera track | Three lanes, each with its kind |
| 3 | Add two clips to the actor track; drag one; trim the other by its edge | Clips move and trim, snap to frames and to each other, and never overlap |
| 4 | Zoom and scroll the lanes; press play | The ruler follows; the playhead runs and stops at the end, or loops |
| 5 | Undo five times, redo five times | Each change goes back and comes again |
| 6 | Save, close the window, open it, open the scene from the Desk | The scene is as it was left |
| 7 | Open the `.edgedir` as text beside the editor and change a clip's `start` | The clip moves in the editor |
| 8 | Break the JSON in the text editor | The scene editor says the file cannot be read, and recovers when it is fixed |
