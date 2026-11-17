<p align="center">
  <img src="docs/assets/brand/banner.png" alt="EDGEdir: the EDGE platform's animation director for VS Code. Design and stitch animations and acting sequences for Cyberpunk 2077's characters, then play them in the running game." width="100%">
</p>

<p align="center">
  <a href="https://edgemodders.github.io/EDGEdir/"><img src="docs/assets/brand/badges/docs.svg" alt="docs: read the docs"></a>
  <img src="docs/assets/brand/badges/status.svg" alt="status: D5 play in game">
  <img src="docs/assets/brand/badges/game.svg" alt="game: Cyberpunk 2077">
  <img src="docs/assets/brand/badges/vscode.svg" alt="runs in: VS Code">
  <a href="LICENSE"><img src="docs/assets/brand/badges/license.svg" alt="license: MIT"></a>
</p>

A director's tool for Cyberpunk 2077, as a VS Code extension in the EDGE family: design and stitch animations and acting sequences for the game's characters (NPCs), and play them on characters in the running game.

**[Docs](https://edgemodders.github.io/EDGEdir/)** &middot; [Changelog](CHANGELOG.md) &middot; [Tests](docs/testing.md)

> [!NOTE]
> **Status: D5 Play in game, 2026-11-17.** The design is agreed ([docs/design.md](docs/design.md)). Built and waiting for hand tests: the scene editor (a timeline of tracks and clips for `.edgedir` files), the Desk, the actor picker (the game's characters, and V), the Animations view (the game's animations, with search), real animations as clips on the lanes, the 3D preview (each actor's body playing the clip under the playhead), transitions that blend two clips in it, and sequences (a run of clips stored by itself and used on any actor with the same rig). Play in the game is built and has not run in the game yet: the editor says what the game will not play as the preview shows it, a scene can be made on a set (an EDGEbuilder scene) with a track for each of its people, and **Play in Game** sends the scene to EDGEdir's player, a REDnode package that plays it on people spawned in front of V. Nothing is released yet.

## Repo layout

| Folder | What |
|---|---|
| `src/` | The extension: `extension.ts` (the views), `views.ts` (their ids) |
| `test/` | Unit tests, `npm test` |
| `docs/` | The docs site, published at https://edgemodders.github.io/EDGEdir/ |
| `nexus/` | The Nexus Mods page's source and upload settings |
| `tools/` | `brand/` renders the banner, icon and badges; `release-notes.mjs` and `nexus-zip.mjs` serve the Release workflow; `release/readme-check.mjs` is shared with the other EDGE repos |

## Build

```powershell
npm install
npm run typecheck
npm run build
npm test
```

Press F5 in VS Code to run it. More in [Dev setup](docs/dev-setup.md).

| You need | Why |
|---|---|
| Windows 10 or 11, Cyberpunk 2077 on PC | The game whose characters EDGEdir directs |
| VS Code 1.90 or later | EDGEdir is a VS Code extension |

Not affiliated with CD Projekt RED.
