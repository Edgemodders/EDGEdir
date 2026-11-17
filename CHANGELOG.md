# Changelog

What changed in each EDGEdir release, for players. Each release takes its notes from its section here: the GitHub release, the Marketplace's changelog tab and the version's changelog on the Nexus Mods page.

How to keep it (the Edgemodders convention):

- With each change a player would notice, add a line under **Unreleased**, in its group: **New**, **Changed**, **Fixed** or **Other**. One change per line. Leave out test-only changes.
- Before a release, rename **Unreleased** to `## <version> (<date>)` and start a new empty **Unreleased** above it.
- Links are full URLs, since the same text goes to GitHub and Nexus.

## Unreleased

**New**

- Sets: a scene can play on a set, an EDGEbuilder scene with its props and people. The new **Sets** view lists the EDGEbuilder scenes in your EDGE Library and in the open REDcode project. **New Scene on This Set** makes a scene with a track for each of the set's people, standing where the set has them; its props show as plain boxes in the 3D preview. When the set changes in EDGEbuilder, the scene follows the next time it is opened. EDGEdir never changes a set.
- In the game: a selected clip's inspector now says what the game will not play as the preview shows it, under **In the game**: a clip that starts inside its animation or plays at another speed, a made animation, a transition (the game blends by itself), and V's track. Playing a scene in the game comes next.
- The EDGEdir side bar with its own icon and three views, Desk, Library and Animations (Library and Animations are empty until their phases).
- The scene editor: a `.edgedir` file opens as a timeline with tracks (actor, audio, camera, weather, script, video, AI) and clips. Clips are named blocks for now: add, move, trim by the edge, split, copy and paste, with snap to frames and to other clips, zoom, a playhead with play and loop, and an inspector. Undo, redo and save are VS Code's own.
- Actors: an actor track gets its actor from a search over your game's characters (about 6,600), with V, the player, on top in either body. The track shows who acts on it; the inspector shows the record, the appearance and the rig. A scene has at most one V.
- The Animations view lists your game's animation files (about 14,000) by folder, and the animations inside each (about 147,000) with their lengths. Search by name; show only what fits the selected actor's rig, or only the actor's own files. The animations inside the files need REDbridge 0.14.0 or newer; they are read once in the background (about four minutes) and the view fills as it goes.
- Real animations on the lanes: **Add to Track** on an animation puts it on the selected actor track at the playhead, at its true length. Dragging a clip's edge trims the part played and stops at the animation's ends. The inspector has In, Out, Speed and Loops. A clip made for another rig than its actor's is hatched red and says why.
- The 3D preview above the timeline: each actor stands as a plain grey body and plays the clip under the playhead, when you drag it and when the scene plays. Orbit, pan and zoom with the mouse; **Frame** fits everyone. In a gap the last clip goes on looping, as the game does. V is shown as the game's base body without a head. Each body and animation is read from your game once (a few seconds) and kept on your PC. Needs REDbridge 0.14.0 or newer. If something cannot be loaded the view says why once, tries again by itself after a moment, and **Frame** tries again.
- Transitions: a transition between two animation clips now joins them in the 3D preview, so they view as one movement. Two methods: **Blend** (both clips play, mixed) and **Inertial** (the second clip plays whole and the difference from the first fades). Four eases. **Add Transition** puts it at the start of the next clip, where the game makes its own join; a transition placed elsewhere shows a yellow bar and says it is preview only for now. AI is listed as not available yet. When the second clip starts where the first ends, the first holds its last pose under the transition.
- Sequences: **Save as Sequence** stores the selected clips, with the transitions between them, by themselves on the Desk. **Add to Track** on a sequence puts it on any actor with the same rig as one block, which plays as its clips do. A block is linked: change the sequence and save it, and every scene that uses it follows; the scene also keeps a copy, so it opens without the sequence. **Open Sequence** edits it in its own tab, on the game's base body; **Unpack** turns a block back into plain clips. **New Sequence** starts an empty one.
- Marks: an actor track's inspector has Right, Forward and Turn, which place the actor in the scene. New actors stand 0.8 m apart.
- Animations made in EDGEfab show in the Animations view under **Library**, and under **Project** while a REDcode project is open, and go onto a lane with Add to Track like the game's. (EDGEfab does not store animations yet.)
- An extension API for the other EDGE tools: a search of the animation index (https://edgemodders.github.io/EDGEdir/api.html).
- EDGEdir reads the game through REDbridge: REDcode's when REDcode is running, or its own (the settings `edgedir.gamePath`, `edgedir.bridgePath` and `edgedir.dotnetRoot`). What it reads is kept on your PC, so later sessions start at once.
- New Scene and the Desk: scenes are made on the Desk and listed there, with Rename, Delete (to the Recycle Bin) and Reveal in File Explorer. Scenes opened from elsewhere are listed under Recent. On a drive with no Recycle Bin, Delete asks again before it deletes the scene for good.
