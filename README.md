<p align="center">
  <img src="docs/assets/brand/banner.png" alt="EDGEdir: the EDGE platform's animation director for VS Code. Design and stitch animations and acting sequences for Cyberpunk 2077's characters, then play them in the running game." width="100%">
</p>

<p align="center">
  <a href="https://edgemodders.github.io/EDGEdir/"><img src="docs/assets/brand/badges/docs.svg" alt="docs: read the docs"></a>
  <img src="docs/assets/brand/badges/status.svg" alt="status: D1 timeline">
  <img src="docs/assets/brand/badges/game.svg" alt="game: Cyberpunk 2077">
  <img src="docs/assets/brand/badges/vscode.svg" alt="runs in: VS Code">
  <a href="LICENSE"><img src="docs/assets/brand/badges/license.svg" alt="license: MIT"></a>
</p>

A director's tool for Cyberpunk 2077, as a VS Code extension in the EDGE family: design and stitch animations and acting sequences for the game's characters (NPCs), and play them on characters in the running game.

**[Docs](https://edgemodders.github.io/EDGEdir/)** &middot; [Changelog](CHANGELOG.md) &middot; [Tests](docs/testing.md)

> [!NOTE]
> **Status: D1 Timeline, 2026-11-16.** The design is agreed ([docs/design.md](docs/design.md)). The first phase is built and waits for its hand test: the scene editor (a timeline of tracks and clips for `.edgedir` files) and the Desk. Clips are named blocks for now; real animations, the 3D preview and play in the game come in later phases. Nothing is released yet.

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
