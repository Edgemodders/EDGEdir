# EDGE<span class="y">dir</span> docs

EDGEdir is a VS Code extension for directing Cyberpunk 2077's characters: design and stitch animations and acting sequences for NPCs, and play them on characters in the running game. It is at its start: the design is agreed, and the first phase, the timeline editor and the Desk, is built and waits for its hand test.

| Document | What it covers |
|---|---|
| [Design](design.html) | Draft 1, agreed 2026-11-16: the scene document, the timeline editor, the preview, how a scene reaches the game, and the phases |
| [D1 Timeline](d1-timeline.html) | The first phase's plan, agreed 2026-11-16: the scene document, the timeline editor and the Desk |
| [D2 Cast and clips](d2-cast-and-clips.html) | The second phase's plan, written 2026-11-16 for the owner's review: actors (V among them), the animation index, real clips |
| [Tests](testing.html) | Every test, with its steps for running again |
| [Dev setup](dev-setup.html) | Building, packaging and releasing EDGEdir |
| [Changelog](changelog.html) | What changed in each release |

## Roadmap status

As of 2026-11-16. Each phase will end with a hand test by the owner, and an in-game test where it changes the game.

| Phase | Status |
|---|---|
| Scaffold | Built 2026-11-16: the repo, the release workflow, the brand, the docs site, and an empty extension with its activity bar icon and three views |
| Design | Done 2026-11-16: draft 1 agreed by the owner |
| D0 Spikes | The written workspot ran in the game on 2026-11-16 (REDnode #46): it works as a track, jumps blend and are 0 to 13 ms late; quest clips and root motion are open. Not started: game clips in a webview, setting the weather |
| D1 Timeline | Built 2026-11-16: the scene document, the timeline editor and the Desk. Hand test round 1, by script, passed all 22 steps on 0.0.2; two small fixes are in 0.0.3 |
| D2 to D9 | Later: cast and clips, preview, transitions and sequences, play in game, audio camera and weather, pack and Library, script video and MCP, the AI track |

EDGEdir is not affiliated with CD Projekt RED. Source code and issues: [github.com/Edgemodders/EDGEdir](https://github.com/Edgemodders/EDGEdir)
