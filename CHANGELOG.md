# Changelog

What changed in each EDGEdir release, for players. Each release takes its notes from its section here: the GitHub release, the Marketplace's changelog tab and the version's changelog on the Nexus Mods page.

How to keep it (the Edgemodders convention):

- With each change a player would notice, add a line under **Unreleased**, in its group: **New**, **Changed**, **Fixed** or **Other**. One change per line. Leave out test-only changes.
- Before a release, rename **Unreleased** to `## <version> (<date>)` and start a new empty **Unreleased** above it.
- Links are full URLs, since the same text goes to GitHub and Nexus.

## Unreleased

**New**

- The EDGEdir side bar with its own icon and three views, Desk, Library and Animations (Library and Animations are empty until their phases).
- The scene editor: a `.edgedir` file opens as a timeline with tracks (actor, audio, camera, weather, script, video, AI) and clips. Clips are named blocks for now: add, move, trim by the edge, split, copy and paste, with snap to frames and to other clips, zoom, a playhead with play and loop, and an inspector. Undo, redo and save are VS Code's own.
- New Scene and the Desk: scenes are made on the Desk and listed there, with Rename, Delete (to the Recycle Bin) and Reveal in File Explorer. Scenes opened from elsewhere are listed under Recent.
