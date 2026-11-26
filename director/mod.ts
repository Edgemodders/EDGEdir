// EDGE Director: EDGEdir's app in the game. This is its Node mod: it plays scenes (play.mjs has the
// steps), reads the Desk (floor.ts), and does what the window asks (stage.ts). The window is
// index.html with page/main.ts; the two talk over REDnode's `channel` (protocol.ts).
// EDGEdir in VS Code reaches it through a folder in the player's own Windows profile (inbox.mjs):
// only the player's own programs can write it, and no port is opened. When REDnode has the editor
// channel's service call (REDnode #48), EDGEdir calls service.mjs instead.
import { api, audio, channel, game, pkg, world } from "rednode";
import * as fs from "node:fs";
import { deskDir } from "../src/desk";
import { playDir, put, watchInbox } from "./inbox.mjs";
import { Player } from "./play.mjs";
import type { PageMessage, PlayNow } from "./protocol";
import { fetchSound } from "./sounds";
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
const trial = new Map<string, number>();
const player = new Player({
  world,
  player: whereV,
  // D6b: a scene's sounds. A file is copied into the package's data folder, the one place outside
  // the package REDnode plays from; a game sound is posted on V.
  audio,
  soundFile: async (from: string) => fetchSound(from, pkg.dataDir),
  // Time stops for one person, or runs again: the game's own slow motion for a single character.
  // (Unverified in the game on a person in a workspot.)
  freeze: async (id: unknown, on: boolean) => {
    const person = await world.entity(id);
    if (!person) throw new Error("the person is not in the world");
    // A trial (2026-11-20): the first person held in a play gets a dilation of exactly 0 and the next
    // 0.0001, turn about, and what the game then reads back is logged. In the owner's first try one
    // person froze and one did not, and the frozen one's hair stretched.
    const key = JSON.stringify(id);
    if (on) {
      if (!trial.has(key)) trial.set(key, trial.size % 2 === 0 ? 0 : 0.01);
      const value = trial.get(key)!;
      // As the game's own scripts call it: no ease in or out ("None"), and no end (-1). Without the
      // curve names the hold came on slowly: a short hold was never seen, and Pause lagged.
      await person.SetIndividualTimeDilation("EDGEDirector", value, -1, "None", "None");
      const reads = await person.GetTimeDilationValue().catch(() => "?");
      const has = await person.HasIndividualTimeDilation("EDGEDirector").catch(() => "?");
      console.log(`EDGE Director: held ${key} at ${value}; the game reads ${reads}, has its own dilation: ${has}`);
    } else {
      await person.UnsetIndividualTimeDilation("None");
      const reads = await person.GetTimeDilationValue().catch(() => "?");
      console.log(`EDGE Director: released ${key}; the game reads ${reads}`);
    }
  },
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
