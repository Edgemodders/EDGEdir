---
title: D6 Audio, camera, weather
---

# <span class="y">D6</span> Audio, camera, weather

**Status: agreed by the owner on 2026-11-18, all seven questions as recommended. D6a Weather is built (EDGEdir 0.0.28, EDGE Director 0.5.0): not run in VS Code or in the game. D6b Audio and D6c Camera are not built. See [What is built](#what-is-built).**

D6 is the sixth phase of the [design](design.html). Audio, camera and weather tracks get real clips, show in the preview, and play in the game through the player D5 built. A mod a player installs is D7.

## What D6 ends with

A scene with two actors, a line of sound, three shots and a change to rain plays in the preview and in the game, and the weather comes back after.

## What D6 rests on

| Fact | From | Consequence |
|---|---|---|
| The player package plays a cue sheet on timers, and EDGEdir sends it one with **Play in Game** | [D5](d5-play-in-game.html), built; not run in the game yet | D6 adds kinds of cue to the same sheet and the same player |
| `world.setWeather(state, { blend, priority })` holds a weather state until it is given back; the game's own cycle leaves it alone meanwhile. A state is a name from the world's own list (19 in the tested world) or a `WeatherPresets` record | REDnode, **passed in the game on 2026-11-18** (0.67.0) | The weather clip is one cue to set and one to give back |
| The change came over a couple of seconds, though a blend of 10 s was asked for | The same test | The clip's blend may not be the time the game takes. A note says so, and the in-game test looks at it |
| `world.resetWeather()` blends back over 10 s to the weather from before REDnode's first hold, then lets the game's cycle go on. A package that stops, or is ended, has its weather given back the same way by REDnode itself | REDnode 0.67.2, passed in the game on 2026-11-18 | "The weather comes back after" is REDnode's own doing, also when the player is ended with no notice. The weather part needs REDnode 0.67.2 or later |
| `audio.play(file, { delay, start, end, volume, fadeIn, category })` plays a WAV, OGG, MP3 or FLAC from the package's folder or its data folder. `stop({ fadeOut })` stops it | REDnode | A sound file plays flat: not placed in the world |
| `audio.event(name, { on })` posts one of the game's sound events, on V or on nothing. A name the game does not know plays nothing, and nothing says so. Marked experimental | REDnode | A game sound is a name. It cannot be checked by the game |
| EDGEwave's API finds the game's sound events (`soundEvents`) and plays one recording of an event in VS Code (`playEvent`) | EDGEwave's docs/api.md | The picker for game sounds is EDGEwave's list, when EDGEwave is installed |
| There is no camera call. The known way: spawn an entity with a `gameCameraComponent`, `Activate` it, move it with `world.move`; to end, `Deactivate`, remove it, and `Activate` V's own camera | REDnode's World objects test, and EDGEbuilder's Edit, which takes the camera and gives it back | Cuts are possible today. **Unverified:** what V's view does when the package is ended while its camera is on |
| `SetFOV` eases over about 1 s | The design's research | A cut with a new field of view may drift for a second (to see in the game) |
| A package is ended with no notice | REDnode #48 | Whatever D6 holds in the game (the weather, the camera) must come back by REDnode's own clean-up, not by the player's |

## The parts

| Part | Builds | Needs the game |
|---|---|---|
| **D6a Weather** | The weather clip, its picker, a label and a tint in the preview, the cue in the game | For the test |
| **D6b Audio** | Sound files as clips with a waveform, heard in the preview and in the game; then game sounds by name | For the test |
| **D6c Camera** | Shots as clips, the preview seen through them, cuts in the game | For the test, and for a spike first |

Each part is a document rule, a piece of the editor, a kind of cue, and a step in the player. They are built in this order: the weather is the smallest and its call exists; the camera has the most unknowns.

## Weather (D6a)

| Thing | Plan |
|---|---|
| The clip | On a weather track: `"weather": { "state": "<name>", "blend": 5 }`. The clip's length is how long the state is held |
| One track | A scene has at most one weather track (the design). A second is refused |
| The picker | The game's weather states, read from the game's files through REDbridge (the `WeatherPresets` records), with their plain names. No list is kept in the repo |
| In the preview | The clip's name on the lane; while the playhead is in it, the viewport's line names the weather and the background takes a tint (grey for rain and fog, warm for sun). No rain or fog is drawn |
| In the game | A cue at the clip's start: `world.setWeather(state, { blend })`. Where a weather clip ends with no other after it, and at Stop: `world.resetWeather()`, which blends back over 10 s to the weather from before the scene |
| Notes | "The blend is the game's: it starts at the clip's start", and a note when two weather clips touch with a blend longer than the first clip |

## Audio (D6b)

| Thing | Plan |
|---|---|
| A file clip | `"sound": { "file": "audio/<name>.wav" }` with `in`, `volume`, `fadeIn`, `fadeOut` and `category` (effects, dialogue or music: the game's volume slider it follows). The file is copied into the scene's own folder on the Desk when it is added, so the scene still plays when the first file moves |
| On the lane | The file's waveform, read once in the page. The clip's length is the sound's; dragging an edge trims it, and stops at the file's ends |
| In the preview | The page plays the file with the playhead, in time with the actors, through the browser's audio. Scrubbing is silent |
| In the game | EDGEdir puts the scene's files beside the request, in `%LOCALAPPDATA%\EDGEdir\play\audio\`. The player copies each into its own data folder (REDnode plays only from there or the package's folder) and plays it at its cue with `audio.play`. Stop fades every sound out |
| A game sound | `"sound": { "event": "<name>" }`. Picked from EDGEwave's list when EDGEwave is installed, else typed. It has no length EDGEdir can know, so the clip's length is the modder's; at its end the event is stopped |
| A game sound in the preview | Not in time: the clip has a **Hear** button that plays one recording through EDGEwave. During preview play it is silent, and the lane says so |
| In the world | Flat: every sound is heard as if at V. Sound on an actor or at a place waits for REDnode (the design's requests) |
| EDGEwave's mixes | Left for later (question A3): a mix has to be rendered to a file first, and EDGEwave has no call for that yet |
| Notes | A game sound: "not heard in the preview's play", and "the game does not say when it does not know this name" |

## Camera (D6c)

| Thing | Plan |
|---|---|
| The clip | A shot: `"shot": { "at": { x, y, z }, "aim": { yaw, pitch } or { "track": "<id>", "height": 1.6 }, "fov": 50 }`. Places are metres from the scene's origin, as actors' marks are. The clip's length is how long the shot is held |
| Making a shot | **Shot from View** takes the preview's own camera as it stands: move the view, press the button. The inspector has the numbers |
| In the preview | **Through the Camera** in the viewport: while it is on, the view is the shot under the playhead, and cuts with it. Off, each shot is drawn as a small camera shape, and the view is free |
| A gap | With no shot under the playhead, the game shows V's own view, and the preview says so |
| In the game | One camera entity for the scene, spawned with the cast. At a shot's start it is moved and turned (`world.move`), its field of view set, and it is switched on; where a shot ends with none after it, V's camera comes back. Stop and the scene's end give V's camera back |
| Looking at an actor | The aim is worked out at the shot's start, from the actor's mark. Actors play in place (root motion is not applied), so it holds |
| Moves | Not in D6: a shot is still. A move between two shots needs a tick on the game's thread (the design's route 2) |
| The spike first | Before D6c is built, a short in-game spike with the player: does the camera cut cleanly, what does the field of view do at a cut, what does V see and do during a shot (V can still walk), and what is V's view when the package is ended with its camera on. If the last leaves V without a view, a REDnode request for the camera to be the host's to give back |

## The cue sheet and the player

| Thing | Plan |
|---|---|
| The sheet | Stays `cues: 1`, with new lists beside `cast` and `timeline`: `weather`, `sounds`, `shots`. A player that does not know a list leaves it out |
| The player | EDGEdir Player 0.2.0 with the weather, 0.3.0 with sounds, 0.4.0 with shots. EDGEdir asks to replace an older player in the game, as D5 built it |
| A scene with no actors | Plays in the game when it has any weather, sound or shot. D5 refused it |
| The stand-in | `tools/player-standin.mjs` prints the new calls, so each part's hand test in VS Code needs no game |
| In the game inspector | The **In the game** section says the notes above for a selected weather, audio or camera clip |

## What is built

**D6a Weather, EDGEdir 0.0.28 with EDGE Director 0.5.0 (2026-11-18). Not run in VS Code or in the game; its hand test ([Tests](testing.html), "D6a Weather") has not run, and the owner's is Test H.**

| Part | Where | What it does |
|---|---|---|
| The clip | `src/weather.ts` (`weatherOf`, `setWeather`, `MaxBlend`) | `"weather": { "state", "blend" }` on a clip of the weather track. The state is a `WeatherPresets` record's path (the list offers these) or a state's own name; the blend is 0 to 60 s, 5 when not said |
| One track | `addTrack` in `src/doc.ts` | A second weather track is refused |
| The cues | `weatherCues` in `src/weather.ts`; `sheet.weather` and `playable` in `src/cues.ts` | A state at each clip's start, and the weather given back where a clip ends with no other starting there (W1). Notes of kind `weather` on each clip: the blend is the game's, the weather goes back at the end, a blend longer than its clip, a clip with no weather. A scene with weather and no actors has something to play |
| The list | The `WeatherHost` in `src/editor.ts`, built in `src/extension.ts` | The game's presets, read once through REDbridge (`tweakdb.records`, type `WeatherPreset`: 15 in game 2.5) when a scene with a weather track opens. Nothing is kept in the repo. Without the game's files the inspector takes a typed name |
| The inspector and the lane | `webview/editor.ts` | Weather (a list, plain names such as Heavy clouds) and Blend (s) for a weather clip; the lane shows the weather's name on the clip |
| The preview | `webview/preview.ts`, `media/editor.css` | The viewport's line starts with "Weather:" and the name while the playhead is in a weather clip, and the view is tinted: grey for rain, fog and cloud, warm for sun, sand for dust and toxic rain. `edgedirPreview.state().weather` has the name |
| The player | `director/play.mjs` (`weatherAt`, in `begin` and `clear`) | The state of the starting moment is set at once, the later cues on timers with the actors' cues; Stop, a failure and a new play give a held weather back. A weather the game refuses is said in the play's notes and the play goes on. A scene with nobody needs no V |
| In the Director | `director/floor.ts` | The strip shows the weather's name on its clips, lit as played |

How it differs from the plan:

| Plan | Built |
|---|---|
| "Stays `cues: 1`, with new lists; a player that does not know a list leaves it out" | As planned for `weather`. A player before 0.5.0 refuses a scene with weather and no actors as having nobody to play |
| EDGE Director 0.2.0 with the weather | The Director's numbers moved on with DR1 to DR3: the weather is in 0.5.0, which also asks for REDnode 0.67.2 |
| A note when two weather clips touch with a blend longer than the first clip | The note is on any clip whose blend is longer than the clip itself |

Unverified until the game: everything in the game, as for all of the Director. That a `WeatherPresets` record's path is taken as REDnode's docs say; what the game does when a second state is set while the first is still blending.

## Tests

| Test | Kind | Covers |
|---|---|---|
| Unit | Automated | The document rules, the cues, the player's new steps against the stand-in world |
| D6a, D6b, D6c in VS Code | Hand, by script, with the stand-in | The pickers, the lanes, the preview, the calls the player would make |
| D6 in the game | In the game, on the owner's PC | Rain comes and goes back; a sound starts in time with a clip; three shots cut and V's view returns. Run with D5's in-game test if that has not run by then |
| Spot tests | The owner | One each for weather, sound and camera |

## Requests

| To | Need | State |
|---|---|---|
| REDnode #46 | The weather's calls | Done: passed in the game on 2026-11-18, with giving back in 0.67.2. Nothing more is needed for D6a |
| REDnode | The camera given back by the host when a package is ended, if the spike shows V is left without a view | To file after the spike, if needed |
| EDGEwave | A mix rendered to a file through its API, and a sound's length | To file if question A3 is yes |
| REDnode | Sound on an entity or at a place | Already in the design's list, after D6 |

## Left out of D6

| Left out | Goes to |
|---|---|
| Camera moves, and a camera that follows a moving actor | With REDnode's scene player (route 2) |
| Sound placed in the world | After REDnode's call for it |
| EDGEwave's mixes as clips | After question A3 |
| Rain and fog drawn in the preview | Not planned |
| Lip sync for a spoken line | EDGEfab's lip sync work, later |
| V as an actor | REDnode #47 |

## Questions and the owner's answers

All agreed as recommended on 2026-11-18.

| # | Question | Agreed |
|---|---|---|
| W1 | The weather is given back when its clip ends with no other after it, and at Stop. Or should it stay as the scene left it until Stop? | Given back at the clip's end: the lane then shows what the game does |
| A1 | A sound file is copied into the scene's own folder when added, so a scene carries its sounds? | Yes |
| A2 | Game sounds by name are in D6, though the preview cannot play them in time (a Hear button only)? | Yes: they are the game's own sounds, and cost little |
| A3 | EDGEwave's mixes as clips: leave for a later phase, with a request to EDGEwave for a render call? | Yes, later |
| C1 | A shot is made by moving the preview's view and pressing **Shot from View**, with the numbers in the inspector? | Yes |
| C2 | While a shot is on in the game, V can still walk and look (the view is the camera's). Leave V free in D6? | Yes, for D6; freezing V is a later choice |
| C3 | The order: weather, then audio, then the camera with its spike first? | Yes |
