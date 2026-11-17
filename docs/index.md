# EDGE<span class="y">dir</span> docs

EDGEdir is a VS Code extension for directing Cyberpunk 2077's characters: design and stitch animations and acting sequences for NPCs, and play them on characters in the running game. It is at its start: the design is agreed, and the first phase, the timeline editor and the Desk, is built, and so is the second, the cast and real animations on the lanes. Both passed their hand tests by script and wait for the owner's spot tests.

| Document | What it covers |
|---|---|
| [Design](design.html) | Draft 1, agreed 2026-11-16: the scene document, the timeline editor, the preview, how a scene reaches the game, and the phases |
| [D1 Timeline](d1-timeline.html) | The first phase's plan, agreed 2026-11-16: the scene document, the timeline editor and the Desk |
| [D4 Transitions](d4-transitions.html) | The fourth phase's plan, agreed 2026-11-16, and what is built of it: transitions that blend two clips in the preview, and sequences |
| [D5 Play in game](d5-play-in-game.html) | The fifth phase's plan, agreed 2026-11-17, and what is built of it: a scene's actors play on real people in the running game |
| [D3 Preview](d3-preview.html) | The third phase's plan, agreed 2026-11-16, and what is built of it: the 3D view of the actors playing their clips |
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
| D3 Preview | Plan agreed 2026-11-16. Built (EDGEdir 0.0.11): each actor's body, grey, on its mark above the timeline, in the pose under the playhead; V as the game's base body; marks in the inspector. Its hand test passed a round by script on 2026-11-16 (17 steps, on 0.0.9); the four fixes from its notes passed a second round on 0.0.10 |
| D4 Transitions and sequences | Plan agreed 2026-11-16. **D4a Transitions** built (EDGEdir 0.0.12): a transition mixes two clips in the preview by Blend or Inertial, with an ease; a mark where the game will not match. Its hand test by script failed 3 of 15 steps on 0.0.13 (the body jumped at a join); fixed in 0.0.14, and those steps passed their rerun. **D4b Sequences** built (0.0.13): a run of clips and transitions saved by itself on the Desk, put on any actor with the same rig as one linked block; its hand test passed by script, 19 of 19, and the five fixes from its notes passed a rerun on 0.0.14 |
| D5 Play in game | [Plan](d5-play-in-game.html) agreed 2026-11-17, with sets (EDGEbuilder's scenes as the stage). **D5b The cue sheet** built (EDGEdir 0.0.16): what the game is told for a scene, and in the inspector what the game will not play as the preview shows; its hand test passed by script, 10 of 10, and 0.0.18 has two changes from its notes. **D5a Sets** built (0.0.17): EDGEbuilder's scenes listed in a Sets view, a scene made on one with a track for each of its people, props as boxes in the preview; its hand test is not run yet. Not built: D5c the player package, D5d Play in game |
| D6 to D9 | Later: audio camera and weather, pack and Library, script video and MCP, the AI track |

EDGEdir is not affiliated with CD Projekt RED. Source code and issues: [github.com/Edgemodders/EDGEdir](https://github.com/Edgemodders/EDGEdir)
