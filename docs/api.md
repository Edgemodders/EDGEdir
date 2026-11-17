---
title: Extension API
---

# <span class="y">Extension</span> API

EDGEdir owns the platform's index of animations: the game's, and the ones made in EDGEfab. Other EDGE tools search it through EDGEdir's extension API, so they do not build their own.

**Status: built in EDGEdir 0.0.6 (2026-11-16), not released, not yet used by another tool.** Its unit tests pass. The shape was posted on EDGEfab #7 for comments; members may still be added.

The API reads only. Nothing in it changes a scene or a file, and it opens no port: it is a JavaScript object passed between extensions inside VS Code.

## Getting it

```ts
const ext = vscode.extensions.getExtension("edgemodders.edgedir");
const api = ext?.isActive ? ext.exports : undefined;
if (api?.apiVersion === 1) {
  const found = await api.searchAnimations({ text: "sit chair", limit: 50 });
}
```

Use it only when EDGEdir is already active, as the tools do with REDcode's. Copy the types below for the members you use. Members may be added within version 1; a change that breaks callers raises `apiVersion`. Check a newer member with `typeof api.member === "function"`.

## Members

| Member | What |
|---|---|
| `apiVersion` | `1` |
| `version` | EDGEdir's version |
| `indexState()` | How far the index of the game's animations is: `level` (`"none"`: the game is not read; `"sets"`: the files are listed, the animations inside not yet, or the REDbridge is 0.13.0 or older; `"clips"`: complete), `game`, `sets`, `clips`, `building` |
| `buildIndex()` | Finds the game and reads what is not read yet, with EDGEdir's own progress notes. Resolves when the file list is there. The animations inside the files go on in the background, about four minutes once per game version; listen to `onDidChangeIndex` |
| `onDidChangeIndex` | The index or the made animations changed |
| `searchAnimations(query)` | The animations a query finds: `{ total, items }`. The order is stable: made animations first (the open project's copy in place of the Library's); then the game's, file by file, each file's animations in the file's own order. With `entity`, the files come in the entity's order (gameplay first, then cinematics, as the entity lists them); without it, by path. `text` matches words in the animation's name or anywhere in its file's game path, folders too. A made animation that loops has `loop: true`; the game's have no `loop` |
| `entityAnimSets(path, appearance?)` | The body's rig of an entity, and the animation files it lists, gameplay before cinematics. `components` has the same for every animated component that names a rig (`{ name, rig, sets }`, the body first, deformations rigs left out), for an object with more than one: `rig` and `sets` are the first one's. `appearance` is taken but not read yet: the appearance's own file may add files |

```ts
interface AnimationQuery {
  text?: string;                                  // every word must be in the animation's name or its file's path
  rig?: string;                                   // a rig's game path: only animations made for it
  entity?: { path: string; appearance?: string }; // only the game animations in the files this entity lists
  source?: ("game" | "library" | "project")[];    // all three when absent
  limit?: number;                                 // 200 when absent, 5,000 at most
}
interface AnimationInfo {
  source: "game" | "library" | "project";
  set?: string;        // a game animation: its .anims file's game path
  id?: string;         // a made animation: its item's id
  name: string;        // the animation's name in its file
  rig: string;         // a game path; empty when not known
  seconds: number; frames: number; fps: number;
  additive: boolean;   // laid over another animation, not a whole pose by itself
  rootMotion: boolean;
  file?: string;       // a made animation's glTF on disk, when it is there
}
```

## Notes

- A character's own animations: `searchAnimations({ entity: { path } })`, or `entityAnimSets(path)` for the file list alone. A person's entity lists about 33 files on game 2.5.
- Animations that fit a character: `searchAnimations({ rig })` with the rig `entityAnimSets` gives. The rule is the same rig path, any case.
- Before the game is read, `searchAnimations` still finds made animations.
- What EDGEdir reads from the game is kept on the PC (`%LOCALAPPDATA%\EDGEdir\cache`), never in a repo.
