---
title: Design
---

# <span class="y">Design</span>

**Draft 1, agreed by the owner on 2026-11-16**, with the answers in "Questions and the owner's answers". Each phase still gets its own plan, agreed before it is built. Nothing here is built. Facts about the other tools were read from their repos on 2026-11-16; each table says where. Anything marked **unverified** has not been checked in the game or in code.

## What the owner asked for

From the owner, 2026-11-16:

| # | Ask |
|---|---|
| O1 | A director's tool for animated sequences and scenes in the game |
| O2 | Choose an NPC model, put an animation clip on a timeline for it, then a second clip |
| O3 | A transition clip between two animation clips, made by an AI provider or by EDGEdir's own logic, so the two view as one |
| O4 | The timeline looks and behaves like EDGEwave's |
| O5 | Many tracks: an NPC with its animation clips, audio, camera positions at set times, a REDnode script or mod tool, a 2D video |
| O5a | Added the same day: a **weather** track, and an **AI** track. What the AI track does is not decided; it might call REDagent in the game for a response |
| O6 | The Desk and Library of the other tools: scenes are made and edited on the Desk, then go into a project or the Library |
| O7 | Scenes are packed for the game. This probably needs new REDnode features |
| O8 | A preview of the scene inside EDGEdir |

## What exists today

### The game and REDnode

Source: REDnode 0.66.8, `docs/world.md` and `packages/rednode/src`.

| Fact | Consequence for EDGEdir |
|---|---|
| Only a workspot plays an animation on a spawned person. No base-game call plays an animation by name (unverified for Codeware) | Every actor's clips must sit in a workspot the actor carries |
| `world.spawn({ record, workspot })`, `world.useWorkspot(id, { entry })`, `stopWorkspot`, `workspotState` exist. `entry` jumps to a named animation in the workspot | The calls a player needs are mostly there. Their in-game test (A2) has not run yet |
| The game's own workspots do not fit: gameplay ones loop and walk in, quest ones play once after a T pose | EDGEdir must write its own `.workspot` per actor. Writing one with REDbridge's `cr2w` calls is **unverified**. REDnode's notes propose the same route and call it a second spike |
| A REDnode package has no per-frame tick and no game-time timer. It has `setTimeout` on the real clock. Each game call answers a frame or two later | A scheduler in a package is good to about 1 to 3 frames, and drifts when the game pauses or slows time. A frame-true player needs a new REDnode feature |
| `world.move` teleports a spawned thing and is cheap enough to call each frame. No walking to a point, no look-at, no facial animation, no lipsync | Actors move by their clips' root motion or by a teleport. Faces are out of scope at first |
| No camera API. The known pattern: spawn an entity with a `gameCameraComponent`, activate it, move it with `world.move`, hand back to the first-person camera after. `SetFOV` eases over about 1 s | Camera cuts are possible today. Smooth camera moves need the tick |
| `audio.play(file, { delay, volume, ... })` and `audio.event(name)` exist. Sound at a place or on an entity is not scheduled | Audio clips play flat (not placed in the world) at first |
| No video API. An overlay page could play `<video>` (**unverified**) | The video track waits for a spike |
| The editor channel (`%LOCALAPPDATA%\REDnode\editor.json`, 127.0.0.1 only, a new bearer token each run, any `Origin` refused) has sound, TweakDB and give routes. No world or scene routes | Playing a scene from VS Code needs new routes, or goes through a package |
| The game's weather system is reachable through `api` while V is in the world; reading the rain state passed a REDnode test. **Found by REDnode's session on 2026-11-16 (REDnode #46):** nothing in game 2.5's script API sets the weather; the weather interface only reads. The owner (same day): it can be controlled, because the game's photo mode changes the weather; it may need internal wiring and a new REDnode call. REDnode checked further: 2.5 has no set-weather function in its script types or as a name in the game's program, so the old Cyber Engine Tweaks call does not work. The game's own route is a quest node that sets a weather by its TweakDB id (`Weather.*`), with a blend time and a priority, and can reset it. REDnode plans a plugin call from the function that node uses (`world.setWeather`, `world.resetWeather`), as a small spike after the workspot run | The weather track stays in the plan. Its in-game half waits on a REDnode call (set a named state with a blend time, read the state, give it back, list the states), asked for on REDnode #46 |
| REDagent 0.4.4 has an agent API for mods: a mod asks a question and gets a plain-text answer (`agent.ask`). An answer takes seconds, costs the player money, and needs the player's own key | An AI cue cannot be frame-timed, and its result differs each run |
| `world.load` reads EDGEbuilder's `<name>.scene.json` (meshes, entities, NPCs standing idle) | An EDGEbuilder scene can be the set an EDGEdir scene plays on |

### Game files: REDbridge and REDcode

Source: REDbridge 0.13.0 `BridgeApi.Modkit.cs`, its issue #14, REDcode `docs/api.md` and `docs/design/animation.md`.

| Fact | Consequence |
|---|---|
| `project.export` writes an entity in one appearance to one GLB on one joined skeleton, and an `.anims` file to glTF with one animation per clip, 30 fps, root motion on the `Root` node | The preview can show the real character playing the real clips |
| The entity export leaves out the entity's anim sets. An `.anims` GLB can be large (233 MB for the largest) | The preview loads clips apart from the body and joins them by bone name. Exporting one clip from a set would need a REDbridge request (**unverified** whether the export can filter) |
| Animation names and frame counts can be read from an `.anims` today with `cr2w` calls. `anims.info` does not exist yet | The Animations view can be built now, slowly; `anims.info` makes it fast |
| `.anims` import does not exist (#14). WolvenKit has the code; REDbridge does not call it | **New animation frames cannot reach the game yet.** A transition made of new frames waits for #14 |
| `cr2w.fromJson`, `createInstance`, `patch`, `save` write new files. EDGEquest writes `.scene` files this way and they play in the game | Writing a `.workspot` the same way is likely. A `.scene` export is possible later |
| REDbridge speaks over stdio to the process that started it: no port. Other extensions reach it through `REDcodeApi.bridge()` | EDGEdir depends on the REDcode extension, as EDGEwave does |
| REDcode has a three.js viewer that plays one character's clips (A1, A2 built). Its mount point is not a contract | EDGEdir builds its own viewport for many actors, with the same library |

### The other EDGE tools

| Tool | Fact | Consequence |
|---|---|---|
| EDGEwave | The timeline is a custom text editor over a JSON file (`.edgewave`), drawn on canvas, no framework. Each change posts the whole document back, so VS Code's undo, redo and save cover it. One clip per track, no snap, no zoom in the lanes | EDGEdir copies the pattern and the look, and adds what a scene needs: many clips per track, edge trim, snap, zoom. Code is copied, never imported (the platform's rule) |
| EDGEwave | Its API gives a sound event's length and plays a sound now. It gives no waveform and no mix length | An audio clip shows as a plain block until EDGEwave gives peaks (a request) |
| EDGEbuilder | The shared Library's rules: one root named in `%APPDATA%\EDGE\library.json`; an item is `<name>.<kind>.asset/` with `asset.json`; a Desk is one tool's own | EDGEdir follows them as they are |
| EDGEbuilder | Lists NPCs from TweakDB `Character` records, with appearances from the record's `.ent` | EDGEdir's actor picker does the same |
| EDGEquest | Writes `.scene` files. The game's `.scene` is its own many-track timeline, but nothing starts a quest phase from outside a quest | A native `.scene` export is a later route, built with EDGEquest |
| EDGEfab | Its plan (not built) holds an animation index and clip tools: trim, loop, mirror, **blend two clips**, keyframes, text to motion | **Overlap.** See the questions for the owner |
| EDGEfab, EDGEwave | AI keys live in VS Code's secret store, one per service, set by a command | The same for EDGEdir |

## The idea

A **scene** is one JSON file with a timeline. Tracks hold clips. EDGEdir shows it three ways:

| Way | What it is | Needs |
|---|---|---|
| **Preview** | A 3D viewport in the editor: the cast's real bodies playing the real clips, with transitions, camera and sound | REDcode and REDbridge. No game running |
| **Play** | The scene plays in the running game, where V stands or at a fixed place | REDnode, and the scene's packed files swapped in |
| **Pack** | The scene goes into a project as files a player installs | REDcode, REDnode on the player's PC |

Words, to keep them apart from the neighbours' words:

| Word | Meaning |
|---|---|
| Scene | EDGEdir's timeline document. Not the game's `.scene` file, and not EDGEbuilder's `.scene.json` |
| Set | An EDGEbuilder scene (props and extras) that an EDGEdir scene plays on. Optional |
| Actor | A character on an actor track |
| Mark | Where an actor stands at the start, relative to the scene's anchor |
| Anchor | The scene's origin in the world: in front of V, or fixed coordinates |
| Cue | One timed order to the game, made from a clip when the scene is packed |

## The scene document

One file, `<name>.edgedir`, JSON, opened by EDGEdir's custom editor and readable as text. Times are seconds, as in EDGEwave. Clip edges snap to frames of 1/30 s. No game data is stored in it: clips name the game's files.

```json
{
  "edgedir": 1,
  "name": "Alley talk",
  "fps": 30,
  "anchor": { "mode": "player", "distance": 3 },
  "set": null,
  "tracks": [
    {
      "id": "t1", "kind": "actor", "name": "Fixer",
      "actor": { "record": "Character.<record>", "appearance": "<appearance>" },
      "mark": { "position": [0, 0, 0], "yaw": 180 },
      "clips": [
        { "id": "c1", "kind": "anim", "start": 0, "in": 0, "out": 3.2,
          "anim": { "set": "<path>.anims", "name": "<animation name>" } },
        { "id": "c2", "kind": "transition", "start": 3.0, "length": 0.4,
          "method": "blend", "ease": "smooth" },
        { "id": "c3", "kind": "anim", "start": 3.2, "in": 0.5, "out": 6.0,
          "anim": { "set": "<path>.anims", "name": "<animation name>" } }
      ]
    },
    { "id": "t2", "kind": "audio",  "clips": [ { "id": "c4", "start": 1.0, "sound": { "kind": "event", "name": "<event>" } } ] },
    { "id": "t3", "kind": "camera", "clips": [ { "id": "c5", "start": 0, "length": 3.2, "position": [2, -1, 1.6], "lookAt": "t1", "fov": 35 } ] }
  ]
}
```

### Track kinds

| Kind | A clip is | Plays in the preview | Plays in the game | Phase |
|---|---|---|---|---|
| Actor | An animation from a game `.anims`, with trim (`in`, `out`), speed and loop count; or a transition | Yes | A cue that jumps the actor's workspot to the clip | D2 on |
| Audio | A game sound event, a WAV or OGG file, or an EDGEwave mix's render | Files yes; game events through EDGEwave (**unverified**) | `audio.event` or `audio.play` | D6 |
| Camera | A shot: position, aim (angles or look at an actor), FOV, for a length of time. A cut at first; a move between two shots later | Yes, as the viewport's camera | A spawned camera entity | D6 |
| Script | A call into a REDnode package at a time: a function name and JSON arguments | Shown as a marker only | Run by the player | D8 |
| Video | A 2D video file shown over the game for a time | In a corner of the viewport | **Unverified**: an overlay page | D8 |

| Weather | A weather state from the game's list (a `Weather.*` TweakDB record), with a blend time, held for the clip's length. One weather track per scene | A tint and a label only; no rain or fog in the viewport | A cue that sets the weather, and one that gives it back at the end. It needs a new REDnode call (REDnode #46) | D6, or when the call lands |
| AI | **Not designed yet.** A placeholder kind, so documents and the editor allow for it | A marker | Not decided | After Q7 |

The AI track's purpose is open (Q7). What is known limits it: a call to REDagent answers after seconds, not frames, and never the same way twice. So an AI clip is best seen as a window of time the answer may land in, with a rule for what the scene does meanwhile (hold, loop the actors' clips, or go on). Some things it could do, for the owner to choose from:

| Idea | What the clip holds | Needs |
|---|---|---|
| A line made in the moment | A prompt; the answer is shown as a subtitle, or spoken through EDGEwave's voices | REDagent's `agent.ask`; a voice route for speech |
| A choice of what plays next | A prompt and named branches; the answer picks one | Branches in the scene document, which the timeline does not have |
| A reaction to the player | A prompt that reads the game's state (where V is, what V did) and sets a script cue's arguments | The script track (D8) |

The first is the smallest and fits a straight timeline.

One actor per actor track. Two actors that must move together (a handshake) are two tracks with clips at the same time. The game's synced animation sets are not handled at first.

### Animations and actors

The owner's rule (2026-11-16): animations and actors are separate things while a scene is made. An animation is stored by itself. An actor is a character. Putting an animation on an actor's track assigns it: that character acts it out at that time. The two are bound into game files only when the scene is packed.

| Thing | What it is | Owned by | Where it lives |
|---|---|---|---|
| Animation | One clip of movement on a named rig. It knows no character | The game, or EDGEfab for made ones (imported from a file, or made from video by an AI service) | The game's `.anims` files; EDGEfab's items in the EDGE Library and in the open REDcode project |
| Actor | A character: a TweakDB record and an appearance, and through its body a rig | The game, picked in EDGEdir | Named in the scene document |
| Assignment | A clip on an actor track: this animation, on this actor, from this time | EDGEdir | The scene document |
| Binding | The actor's `.workspot` and anim sets, holding every animation the track uses | EDGEdir at pack time | The packed scene |

The flow between the tools (the owner's, with this section's additions agreed on 2026-11-16):

| Step | Tool | What happens |
|---|---|---|
| 1 | EDGEfab | An animation is imported from a file or made from a video, tried on a character model, and stored by itself with **Add to Library**, or put into the open REDcode project with **Add to Project** |
| 2 | EDGEdir | The animation shows in the Animations view, beside the game's own: under Library, or under Project while that project is open |
| 3 | EDGEdir | It is dragged onto an actor's lane. It becomes a clip at that time, and the actor acts it out in the preview |
| 4 | EDGEdir | Pack or Play in game binds each actor to its animations and writes the game files |

What makes this work is the **rig**. An animation is made for one skeleton (the game has a few: the man's, the woman's, the big man's and others), and an actor has one. So:

- The Animations view can filter by the selected actor's rig.
- An animation dropped on an actor with the same rig just plays.
- On another rig, EDGEdir warns and shows the clip as unfit. It does not retarget: changing a clip to fit another skeleton is low-level work, so it is EDGEfab's (a request).
- The same animation can be on many actors and in many scenes. Swapping a track's actor for another with the same rig keeps every clip.

A clip names its animation one of two ways:

| Source | In the document | Found by |
|---|---|---|
| The game | `"anim": { "set": "<path>.anims", "name": "<animation name>" }` | The index of the game's files |
| A made animation, in the Library or the open project | `"anim": { "id": "<the item's id>", "name": "<its name>" }` | The item's id, which never changes, so moving or renaming the item breaks nothing. EDGEdir looks in the open project first, then in the Library |

The owner's addition (2026-11-16): EDGEdir also sees the animations in the open REDcode project. A modder may use EDGEfab's Add to Project and never touch the Library; with the scene editor open, the animation is dragged from the project onto a lane.

| Point | Agreed 2026-11-16 |
|---|---|
| One way to name both | The id. A Library item has one in `asset.json`; its copy in a project keeps it in the came-from note. An animation made straight into a project needs an id too (part of the request to EDGEfab) |
| Project before Library | When both hold the same id, the project's copy is used: it is the one that will be packed, and it may have been changed |
| Where in the project | EDGEfab's choice (`source/raw` is likely). EDGEdir finds animations by their note, not by a fixed folder |
| A Desk scene using a project animation | Allowed, with a mark on the clip: the scene works only while that project is open. Move to Project clears the mark; Add to Library asks to add the animation too |
| Dragging | From EDGEdir's Animations view onto a lane. Dragging from REDcode's project tree or the Explorer into the editor is **unverified** in VS Code (D2 checks it); an **Add to Track** command on the file is the fallback |

A scene never holds a copy of an animation while it is on the Desk. When a scene goes into a project, the Library animations it uses that the project lacks are copied in with a came-from note, by the Library's rules, so the project packs without the Library.

Two limits to say plainly:

- A Desk is one tool's own, by the Library's rules. EDGEdir sees an EDGEfab animation only once it is in the Library or in the open project, not while it is on EDGEfab's Desk.
- A made animation plays in EDGEdir's preview as soon as it is in the Library. It plays in the game only once REDbridge can import animation frames (#14). Until then a scene that uses one says so at Play and Pack. The game's own animations are not held back by this.

What EDGEdir needs from an EDGEfab animation item, as a request to EDGEfab:

| Need | Why |
|---|---|
| A Library kind for a single animation, with `asset.json`; Add to Library and Add to Project; an id that stays with the animation in both places | So the index can find it, and a clip can name it wherever it lives |
| The clip as glTF on the game rig's bone names, with the rig's game path, the length, the frame rate, whether it has root motion and whether it loops | To preview it, fit it to actors and lay it out on the lane |
| Once #14's import exists: the same clip as a game `.anims` in the item's `source/archive`. Agreed 2026-11-16: the conversion to the game's format is EDGEfab's | So EDGEdir packs it without doing the low-level conversion itself, and EDGEquest can use it too |
| Retargeting to the game's other rigs, as EDGEfab's own feature | So one made clip can serve actors of several builds |

### Clips on an actor track

- Clips do not overlap, except under a transition.
- **Where a clip starts.** By default a clip starts from where the last one left the actor (root motion carries on), so a walk followed by a sit ends up where the walk went. A clip can instead be pinned to a mark. The preview shows the path on the floor.
- A gap between clips holds the last pose in the preview. What the game does in a gap is for spike D0.

### Transitions

A transition is a clip that sits over the join of two animation clips. Three methods:

| Method | How | New frames? | Reaches the game by |
|---|---|---|---|
| **Blend** (first) | Crossfade the end of clip A into the start of clip B over the transition's length: each bone's rotation by slerp, positions by lerp, on an ease curve. Root motion is matched first, so feet do not slide apart | In the preview only | The workspot's own blend time on the jump (**unverified**: whether a jump blends, and for how long). Or baked |
| **Inertial** | Clip B plays from its start, and the difference from A's last pose and speed decays away. Keeps B's motion whole; good for short joins | Yes | Baked |
| **AI** | A provider makes the frames between A's last poses and B's first | Yes | Baked |

"Baked" means EDGEdir samples the actor's track into new animation frames, writes them as glTF, and REDbridge imports them into a new `.anims`. **This needs REDbridge #14's import**, which does not exist yet. So the first transitions that play in the game are the game's own blends, and EDGEdir's preview must be honest about the difference: a transition shows a mark when the game will not play what the preview shows.

The owner's rule (2026-11-16): tweening and an AI provider are both options on every transition. The method is a field of the clip, so a transition can be made one way, judged in the preview, and made again the other way. A made transition keeps its frames beside the scene (under the scene's folder, as EDGEwave keeps generated audio in `<name>.gen/`), with a note of the method, provider and settings that made it.

About the AI method: no provider with an API for in-betweening on a custom skeleton is verified. General text and image models do not make joint rotations well. Uthana, which EDGEfab will use for single clips, lists video to motion, text to motion, locomotion, retargeting and a GraphQL API with GLB output on its page (read 2026-11-16), but nothing for blending or in-betweening two motions. This is research (D7), and Blend and Inertial are the dependable methods. The key would be kept in VS Code's secret store, set by a command, as EDGEwave and EDGEfab do.

### Sequences

Agreed with the owner on 2026-11-16: animations sequenced together with their transitions are a thing that is stored and edited. The shape below was agreed the same day (Q8).

A **sequence** is a run of animation clips and transitions for one actor, saved under its own name: for example "walk in, sit, lean back". It is not tied to a scene or a character, only to a rig, so it can go on any actor with that skeleton.

| Point | Proposal |
|---|---|
| File | `<name>.edgeseq`, JSON: the rig, and the same `clips` list an actor track holds, starting at time 0 |
| Making one | Select clips on an actor track, **Save as Sequence**. Or New Sequence, which opens the same editor with one actor track and a stand-in body |
| Using one | Drag it from the Desk or Library onto an actor lane. It shows as one block. Opening the block edits the sequence |
| Linked or copied | Linked by default: a change to the sequence shows in every scene that uses it. **Unpack** turns the block into plain clips on the lane |
| Storing | On the Desk and in the Library like a scene, as kind `sequence` |
| In the game | Nothing new: when a scene is packed, a sequence is its clips. Once baking exists (D7), a sequence can also be baked once into a single animation and reused |

## The editor

One custom text editor for `*.edgedir`, built the EDGEwave way: plain TypeScript, canvas, the whole document posted back on each change so undo, redo, save and the dirty mark are VS Code's own.

| Part | What |
|---|---|
| Viewport (top) | The 3D preview: the cast, the floor grid, marks and paths, the camera's view or a free orbit view |
| Transport | Previous edge, play, stop, next edge, loop, the time, **Play in game** |
| Lanes (bottom) | A ruler in seconds and frames; one lane per track with its name, kind, mute and lock; clips as blocks with their names; the playhead |
| Inspector (side) | The selected clip's or track's fields |

Like EDGEwave: the colours and outlined buttons, the ruler, the transport, drag sideways to move a clip, drag up or down to reorder lanes, a splitter between the two halves.

Beyond EDGEwave, because a scene needs it: many clips per track, drag a clip's edge to trim, snap to frames and to other clips' edges, zoom and scroll in the lanes, select several clips, copy and paste, drop an animation from the Animations view onto a lane.

## Views

| View | Shows | Phase |
|---|---|---|
| **Desk** | The scenes being worked on, and Recent | D1 |
| **Library** | Scenes kept in the EDGE Library | D7 |
| **Animations** | The game's animations, searched by name, grouped by anim set and rig; a clip can be previewed and dragged to a lane. Later: the game's workspots | D2 |

A fourth view, **Project**, lists the open project's scenes when a REDcode project is open (D7).

The Animations index is built from the game's files through REDcode's bridge and kept in the extension's storage on the PC. It is never committed. EDGEdir owns it (Q1, agreed). It lists three sources: the game's animations, the animations EDGEfab stored in the Library, and those in the open REDcode project (see "Animations and actors"). With an actor selected, it can show only the animations that fit that actor's rig.

EDGEdir gives the index to other tools through its extension API (search by name, a clip's set, rig and length), so EDGEfab and EDGEquest do not build their own.

## Desk and Library

| Place | Where | Holds |
|---|---|---|
| Desk | `%LOCALAPPDATA%\EDGEdir\desk\<name>.act.asset\` | One folder per scene, shaped like a Library item: `asset.json`, the `.edgedir` under `source/raw/edgedir/`, files the scene brought in (sounds, videos) beside it, made files under `source/archive` |
| Library | The shared root, `<modder's folder>\<name>.act.asset\` | The same folder, moved by **Add to Library** |
| Project | `source/raw/edgedir/<name>.edgedir` in a REDcode project, with a came-from note in `source/library.json` (`by: "edgedir"`) | The scene, by **Move to Project** or **Use in Project** |

New Scene makes a scene on the Desk and opens it. The Library's rules are EDGEbuilder's (`docs/library.md`), unchanged. EDGEbuilder's Library already uses the kind `scene`, so EDGEdir's kind word for a scene is `act` (agreed 2026-11-16): the folders above are `<name>.act.asset`. Only folder names and `asset.json` carry it; the UI says scene.

## Into the game

### What a packed scene is

| File | Made by | What |
|---|---|---|
| `<scene>.cues.json` | EDGEdir | The cue sheet: the cast (record, appearance, mark, workspot), the anchor, the set, and every cue in time order |
| One `.workspot` per actor | EDGEdir, through REDbridge `cr2w` calls | The actor's clips as named entries, with the anim sets they come from |
| One `.anims` per actor, when the track has baked frames | REDbridge import (#14) | The baked transitions or the whole baked track |
| Sounds and videos | Copied | The files the audio and video tracks use |
| A REDnode package | EDGEdir, from a template | Plays the cue sheet. Its `rednode-app.json` names the permissions it needs |

The game files go into the project's archive; REDcode packs it. The package ships beside it. A player needs REDnode and its frameworks.

### Three routes for the timing

| Route | How | Good | Bad | When |
|---|---|---|---|---|
| **1. Cues from a package** | The package spawns the cast, then sets a timer per cue | Works with REDnode nearly as it is | 1 to 3 frames of jitter per cue; drifts in menus and slow motion; two actors can slip apart | D5, the first that plays |
| **2. REDnode's scene player** | REDnode takes the whole cue sheet and runs it on the game thread, on game time | Frame-true; pauses with the game; smooth camera moves | A new REDnode feature | Requested in D5, used when it lands |
| **3. Baked tracks** | Each actor's track is one long animation; one cue starts each actor | The join between clips is exact, whatever the scheduler does | Needs #14 import; a change means a new bake | D7 |

Routes 2 and 3 work together: one start per actor, on the same frame. A fourth route, writing the game's own `.scene` file so a quest can play the scene, is kept for later with EDGEquest (L1).

### Play from VS Code

**Play in game** packs the scene to a scratch project, swaps its files into the running game, and tells REDnode to play it at V. The swap and the play order need REDnode's editor channel to grow (a request). Access stays as that channel has it: this PC only, a bearer token made new each run, and an Allow in the game the first time a tool asks.

### Requests this design leads to

Filed on 2026-11-16: REDnode #46 (the written-workspot spike and the weather), REDbridge #17 (export of chosen clips; `anims.info` is in its #14), EDGEfab #7 (the split and the animation item). REDnode took #46 the same day: the spike is built and runs in the game after the A2 test. REDbridge #17 was taken too, to ship with `anims.info` before D2. The rest are filed when their phase is planned.

| To | Need | For phase |
|---|---|---|
| REDnode | The A2 test's result, and a spike on a written `.workspot` (shared with its own "second spike") | D0 |
| REDnode | Editor routes: swap a scene's files in, play a cue sheet, stop, report the time | D5 |
| REDnode | A scene player on the game thread and game time (route 2), with a camera in it | D5, D6 |
| REDnode | Sound on an entity or at a place (its S2 Space) | After D6 |
| REDbridge | `anims.info` (#14), and export of chosen clips from an `.anims` | D2, D3 |
| REDbridge | `.anims` import from glTF (#14). Needed for made animations in the game, and for baked transitions. EDGEfab needs it too, so the request may be EDGEfab's to make | D5 for made animations, D7 for baking |
| EDGEwave | A sound's peaks and a mix's length through its API | D6 |
| EDGEfab | The split agreed in Q1: its plan drops the animation index and "blend two clips". It imports animations and makes them from video, and stores each by itself in the Library, in the shape "Animations and actors" lists. Retargeting to the game's other rigs | D2 |
| EDGEkit | Include EDGEdir, once it is published | After the first release |

## Phases

Each phase ends with a hand test by the owner, and an in-game test where it changes the game. Each gets its own plan, agreed before it is built.

| Phase | Builds | Test proves |
|---|---|---|
| **D0 Spikes** | No features. (d) Setting and giving back the weather through REDnode. (a) A `.workspot` written through REDbridge with clips from two anim sets, on a spawned NPC: does it play, does a jump blend, what happens in a gap, how late are timed jumps. (b) A character GLB and two clips from another GLB playing in a three.js webview. (c) What EDGEfab and EDGEdir each own | The route for D3 and D5 is known, or changed |
| **D1 Timeline** | The `.edgedir` document and its editor: tracks, clips as blocks with typed-in lengths, move, trim, snap, zoom, undo. New Scene, the Desk view and folder | A scene with three tracks is made, edited, closed and opened again from the Desk |
| **D2 Cast and clips** | The Animations view and its index, with the game's animations, the Library's and the open project's; the actor picker; drag an animation to a lane with its true length; the rig check; swap a track's actor; trim, speed and loop | A named NPC has two real game clips in a row on its track; the track's actor is swapped for another of the same rig and keeps them; a clip for another rig is marked unfit |
| **D3 Preview** | The viewport: actors' bodies playing their tracks, scrub and play, marks and root motion paths | Two actors play their clips in the viewport, in time with the playhead |
| **D4 Transitions and sequences** | Transition clips with Blend and Inertial, in the preview; the method field with AI listed as not available yet. Save as Sequence, sequences on the Desk, a sequence as a block on a lane | Two clips with a transition view as one movement; saved as a sequence, they go onto a second actor in another scene |
| **D5 Play in game** | The cue sheet, the written workspots, the player package (route 1), **Play in game** | The D4 scene plays on real NPCs in front of V, and the tester notes how far it is from the preview |
| **D6 Audio, camera, weather** | Audio tracks (events, files, EDGEwave mixes), camera tracks (cuts) and the weather track, in the preview and the game | A scene with two actors, a line of sound, three shots and a change to rain plays in both, and the weather comes back after |
| **D7 Pack, Library, baked** | Move to Project, Add to Library, the Library and Project views, a packed mod a player installs. Baked tracks (route 3) when #14's import exists. Research into an AI provider for transitions | A packed scene plays on a clean install; a baked transition matches the preview |
| **D8 Script, video, MCP** | Script and video tracks; MCP tools (`dir_*`) so an assistant can read and edit a scene | A script cue fires on time; an assistant adds a clip |
| **D9 AI track** | Whatever Q7 decides, with its own plan | To be set with the plan |

Later, not planned: **L1** export to the game's `.scene` with EDGEquest; camera moves and curves; faces and lipsync; synced sets for two actors; walking an actor to a point; keyframes of EDGEdir's own.

D1 needs nothing from another repo and can start as soon as this design is agreed. D0 runs beside it, because its in-game parts wait on REDnode's A2 test.

## Questions and the owner's answers

All answered on 2026-11-16.

| # | Question | Answer |
|---|---|---|
| Q1 | EDGEfab's plan has an animation index and clip tools, with "blend two clips" among them. Who owns what? | **Agreed 2026-11-16.** EDGEdir owns the animation index, and the sequencing of animations with transitions as a thing that is stored and edited. EDGEfab owns the low-level work: making single clips, with AI providers too (the owner's example: Uthana's video to motion), and testing them on character models. EDGEdir assembles NPCs and their animations into sequences and scenes. EDGEfab's clips show up in EDGEdir's Animations view. EDGEfab's plan still lists the index and "blend two clips": it needs a `request` issue there |
| Q2 | Is the document called a scene, though the game and EDGEbuilder use the word? | **Agreed:** yes in the UI. The file is `.edgedir`. Checked after the answer: EDGEbuilder's Library already uses the kind `scene` (`docs/library.md`), so EDGEdir's scene needs another kind word. The kind is `act`, giving `<name>.act.asset` (agreed the same day). A sequence's kind is `sequence` |
| Q3 | Is a first in-game play with visible limits (route 1: slight jitter, the game's own blends) acceptable in D5, with frame-true play to follow? | **Agreed 2026-11-16:** yes |
| Q4 | Are the REDnode and REDbridge requests in the table above agreed in principle? | **Agreed:** D0's and D2's now (REDnode: the A2 result and the written-workspot spike; REDbridge: `anims.info` and export of chosen clips). The rest when their phase is planned |
| Q5 | Which AI provider did the owner have in mind for transitions? | **Answered 2026-11-16:** none yet, and it is not known whether plain tweening is enough. Both must be options on a transition. Tweening (Blend, Inertial) is built in D4; the provider is research, and the method is in the document format from the start |
| Q7 | What does the AI track do? | **Agreed as the direction:** the smallest useful form, a prompt to REDagent whose answer is shown or spoken as a line, inside a window of time. To be settled before D8, so the script track is built to carry it |
| Q8 | Is a sequence, as the "Sequences" section draws it, what the owner meant by a storable and editable thing: its own file, reusable on any actor with the same rig, linked into scenes? | **Agreed:** yes |
| Q6 | The views: Desk, Library, Animations, and Project when a project is open? | **Agreed:** yes |

## Out of scope

Making and changing single animation clips, by hand or by an AI provider such as video to motion, and testing them on a character (EDGEfab). Quest logic, dialogue choices and lines (EDGEquest). Mixing sound (EDGEwave). Placing props (EDGEbuilder). Faces and lipsync, until a way is found.
