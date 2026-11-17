// EDGEdir Player: a REDnode Node mod that plays EDGEdir's scenes in the game (play.mjs has the
// steps). EDGEdir reaches it through a folder in the player's own Windows profile (inbox.mjs):
// only the player's own programs can write it, and no port is opened. When REDnode has the editor
// channel's service call (REDnode #48), EDGEdir calls service.mjs instead and the folder goes.
import { api, game, world } from "rednode";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { playDir, put, watchInbox } from "./inbox.mjs";
import { Player } from "./play.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const version = JSON.parse(fs.readFileSync(path.join(here, "rednode-app.json"), "utf8")).version;

async function whereV() {
  const v = await api.GetPlayer(game.instance);
  if (!v) return null;
  const p = await v.GetWorldPosition();
  const f = await v.GetWorldForward();
  return { x: p.X, y: p.Y, z: p.Z, fx: f.X, fy: f.Y };
}

const player = new Player({
  world,
  player: whereV,
  report: (state) => {
    put(playDir(), "state.json", { ...state, version });
    console.log(`EDGEdir Player: ${state.state}${state.text ? `, ${state.text}` : ""}`);
  },
});
// service.mjs runs in this mod and reaches the same player.
globalThis.edgedirPlayer = player;
world.onRespawn((before, after) => player.respawned(before, after));
watchInbox(player, version);
console.log(`EDGEdir Player ${version} ready; watching ${playDir()}`);
