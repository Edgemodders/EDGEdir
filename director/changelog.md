# EDGE Director changelog

What changed in each release of EDGE Director, EDGEdir's app in the game. It has its own version, and its zip is on each EDGEdir release beside the extension.

Kept as EDGEdir's own changelog is: a line under **Unreleased** with each change a player would notice; before a release, raise `version` in `director/rednode-app.json` and rename **Unreleased** to `## <version> (<date>)`. The release's zip is not built while anything is left under Unreleased.

## Unreleased

**New**

- EDGE Director: a window in the game for EDGEdir's scenes. It lists the scenes on EDGEdir's Desk; open one to see its tracks and clips on a strip, with what the game will not play as the preview shows.
- Play, Stop and Start Again in the game, with VS Code open or closed. Drag the playhead on the strip to start from any moment, or to send the cast there while the scene plays. Loop plays the scene again at its end.
- Cast: each actor in the game with the clip they play and how far they are from V. **Go There** puts V in front of an actor; choosing an actor marks them in the world with a pin.
- EDGEdir's **Play in Game** in VS Code plays through EDGE Director, and its window shows that play too.
- Adjust: click an actor's name on the strip, then **Move to V** puts their mark where V stands, facing as V faces; Left, Right, Forward and Back move it 10 cm, and Turn turns it 15 degrees. An actor in the game moves at once. Each change is saved to the scene's file, and the scene open in VS Code follows.
- **The Scene Is Here** keeps the scene at the spot it plays at, instead of in front of V wherever V is; **In Front of V** undoes it.
- A scene with unsaved changes in VS Code plays in the game and cannot be changed there, so neither tool overwrites the other.
