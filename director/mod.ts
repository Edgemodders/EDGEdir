// EDGE Director: EDGEdir's app in the game. This is its Node mod: it plays scenes (play.mjs has the
// steps), reads the Desk (floor.ts), and does what the window asks (stage.ts). The window is
// index.html with page/main.ts; the two talk over REDnode's `channel` (protocol.ts).
// EDGEdir in VS Code reaches it through a folder in the player's own Windows profile (inbox.mjs):
// only the player's own programs can write it, and no port is opened. When REDnode has the editor
// channel's service call (REDnode #48), EDGEdir calls service.mjs instead.
import { api, channel, game, world } from "rednode";
import * as fs from "node:fs";
import { deskDir } from "../src/desk";
import { playDir, put, watchInbox } from "./inbox.mjs";
import { Player } from "./play.mjs";
import type { PageMessage, PlayNow } from "./protocol";
import { Stage, type PlayerLike } from "./stage";

declare const __VERSION__: string;
const version = __VERSION__;

async function whereV() {
  const v = await api.GetPlayer(game.instance);
  if (!v) return null;
  const p = await v.GetWorldPosition();
  const f = await v.GetWorldForward();
  return { x: p.X, y: p.Y, z: p.Z, fx: f.X, fy: f.Y };
}

let stage: Stage | undefined;
const player = new Player({
  world,
  player: whereV,
  report: (state: PlayNow) => {
    put(playDir(), "state.json", { ...state, version });
    console.log(`EDGE Director: ${state.state}${state.text ? `, ${state.text}` : ""}`);
    stage?.publish();
  },
}) as unknown as PlayerLike & { respawned(before: { hash: string }, after: { hash: string }): void };

stage = new Stage({
  player,
  version,
  desk: deskDir(),
  playDir: playDir(),
  publish: (state) => channel.post({ type: "state", state }),
  whereV,
  teleport: (to) => game.player.teleport(to),
  pin: (at, title) => world.pin({ at, title }),
  unpin: (id) => world.unpin(id),
});
const floor = stage;

// service.mjs runs in this mod and reaches the same player.
(globalThis as { edgedirPlayer?: unknown }).edgedirPlayer = player;
world.onRespawn((before, after) => player.respawned(before, after));
channel.on<PageMessage>((m) => void floor.handle(m));
// EDGEdir's Play in Game and Stop in Game come through the folder.
watchInbox({ play: (request: { do?: string; file?: string }) => floor.fromEditor(request), stop: () => floor.fromEditor({ do: "stop" }) }, version);

// The Desk and the open scene's file are looked at again every few seconds, and the cast's
// distances while a scene is in the game: the window then follows what VS Code saves.
let last = "";
setInterval(() => {
  void (async () => {
    floor.refresh();
    await floor.measure();
    const now = JSON.stringify(floor.snapshot());
    if (now !== last) {
      last = now;
      floor.publish();
    }
  })();
}, 2000);

fs.mkdirSync(playDir(), { recursive: true });
console.log(`EDGE Director ${version} ready; the Desk is ${deskDir()}, and EDGEdir is heard in ${playDir()}`);
