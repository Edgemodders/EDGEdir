// A stand-in for EDGEdir's player, for the hand test of Play in game with no game running
// (docs/testing.md, "D5d Play in game, in VS Code"). It runs the player's own steps (player/play.mjs)
// and its folder (player/inbox.mjs) against a made-up world that prints every call instead of
// reaching the game.
//   node tools/player-standin.mjs                 plays whatever EDGEdir sends
//   node tools/player-standin.mjs --fail spawn    the named call fails (write, spawn, use, jump, load)
//   node tools/player-standin.mjs --write-ms 3000 the first workspot takes that long to write
// It uses %LOCALAPPDATA%\EDGEdir\play, as the real player does: set LOCALAPPDATA to try it apart.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { playDir, put, watchInbox } from "../player/inbox.mjs";
import { Player } from "../player/play.mjs";

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};
const fail = arg("--fail");
const writeMs = Number(arg("--write-ms") ?? 300);
const version = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "player", "rednode-app.json"), "utf8")).version;

let n = 0;
const said = (name, ...args) => console.log(`${new Date().toISOString().slice(11, 23)}  ${name} ${args.map((a) => JSON.stringify(a)).join(" ")}`);
const call = async (name, args, answer, ms = 20) => {
  said(name, ...args);
  await new Promise((r) => setTimeout(r, ms));
  if (fail === name) throw new Error(`the stand-in was told to fail ${name}`);
  return answer;
};
const world = {
  writeWorkspot: (name, o) => call("write", [name, { rig: o.rig, clips: o.clips.map((c) => c.name), swap: o.swap }], { path: `standin\\${name}.workspot` }, writeMs),
  spawn: (o) => call("spawn", [o], { id: { hash: `standin${++n}` } }),
  useWorkspot: (id, o) => call("use", [id.hash, o], { id, started: true }),
  jumpWorkspot: (id, to) => call("jump", [id.hash, to], true, 5),
  remove: (id) => call("remove", [id.hash], true, 5),
  load: (scene, o) => call("load", [scene.objects.map((x) => x.id), o], { skipped: [], notes: [] }),
  unload: (name) => call("unload", [name], 1, 5),
};

const player = new Player({
  world,
  // V stands at the world's middle, facing north.
  player: async () => ({ x: 0, y: 0, z: 0, fx: 0, fy: 1 }),
  report: (state) => {
    put(playDir(), "state.json", { ...state, version });
    said("state", state.state, state.text);
  },
});
watchInbox(player, version);
console.log(`EDGEdir Player stand-in ${version}; watching ${playDir()}. Ctrl+C stops it.`);
