# EDGE<span class="y">dir</span> docs

EDGEdir is a VS Code extension for directing Cyberpunk 2077's characters: design and stitch animations and acting sequences for NPCs, and play them on characters in the running game. It is at its start: the design is agreed, and the first phase, the timeline editor and the Desk, is built, and so is the second, the cast and real animations on the lanes. Both passed their hand tests by script and wait for the owner's spot tests.

| Document | What it covers |
|---|---|
| [Design](design.html) | Draft 1, agreed 2026-11-16: the scene document, the timeline editor, the preview, how a scene reaches the game, and the phases |
| [D1 Timeline](d1-timeline.html) | The first phase's plan, agreed 2026-11-16: the scene document, the timeline editor and the Desk |
| [D3 Preview](d3-preview.html) | The third phase's plan, written 2026-11-16 for the owner's review: the 3D view of the actors playing their clips |
| [Extension API](api.html) | What other EDGE tools can ask EDGEdir: a search of the animation index |
| [D2 Cast and clips](d2-cast-and-clips.html) | The second phase's plan, agreed 2026-11-16, and what is built of it: actors (V among them), the animation index, real clips |
| [Tests](testing.html) | Every test, with its steps for running again |
| [Dev setup](dev-setup.html) | Building, packaging and releasing EDGEdir |
| [Changelog](changelog.html) | What changed in each release |

## Roadmap status

As of 2026-11-16. Each phase ends with a hand test, run in full by script or by the owner, and the owner's spot tests of its main features ([Tests](testing.html#the-release-gate)), and an in-game test where it changes the game.

| Phase | Status |
|---|---|
| Scaffold | Built 2026-11-16: the repo, the release workflow, the brand, the docs site, and an empty extension with its activity bar icon and three views |
| Design | Done 2026-11-16: draft 1 agreed by the owner |
| D0 Spikes | The written workspot ran in the game on 2026-11-16 (REDnode #46): it works as a track, jumps blend and are 0 to 13 ms late; quest clips and root motion are open. Not started: game clips in a webview, setting the weather |
| D1 Timeline | Built 2026-11-16: the scene document, the timeline editor and the Desk. Hand test round 1, by script, passed all 22 steps on 0.0.2; two small fixes are in 0.0.3 |
| D2 Cast and clips | Plan agreed 2026-11-16. Built (EDGEdir 0.0.8). Its three hand tests passed a round by script on 2026-11-16 (15, 17 and 6 steps); the fixes from their notes passed a second round on 0.0.7: reading the game, the actor picker with V, the Animations view with the game's and made animations, real clips on the lanes (trim, speed, loops, the rig check), and the extension API. The clips' test needs REDbridge 0.14.0 |
| D3 Preview | Plan written 2026-11-16, with a spike's findings, for the owner's review. Not built |
| D4 to D9 | Later: transitions and sequences, play in game, audio camera and weather, pack and Library, script video and MCP, the AI track |

EDGEdir is not affiliated with CD Projekt RED. Source code and issues: [github.com/Edgemodders/EDGEdir](https://github.com/Edgemodders/EDGEdir)
