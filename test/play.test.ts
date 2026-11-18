// D5c and D5d: the player's steps against a stand-in world (director/play.mjs), and the folder EDGEdir
// reaches it through (src/play.ts). Made-up names and places; nothing is read from the game.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Player, placements, refusal, sceneFor, SET, slug } from "../director/play.mjs";
import type { CueSheet } from "../src/cues";
import { alive, DirectorVersion, install, installState, lineOf, older, playerVersion, readState, request, stageFor } from "../src/play";
import { addSetPeople, chooseSet, linkTo, parseSet } from "../src/set";
import { newDoc } from "../src/doc";

const sheet = (more: Partial<CueSheet> = {}): CueSheet => ({
  cues: 1,
  scene: "Alley talk",
  length: 0.08,
  anchor: { mode: "player", distance: 3 } as CueSheet["anchor"],
  cast: [
    { track: "t1", name: "Ana", record: "Character.Ana", appearance: "street", rig: "w.rig", at: { x: -1, y: 0, yaw: 180 }, clips: [{ name: "c1", set: "a.anims", anim: "stand" }, { name: "c2", set: "a.anims", anim: "wave" }] },
    { track: "t2", name: "Bo", record: "Character.Bo", rig: "m.rig", at: { x: 1, y: 2, yaw: 90 }, clips: [{ name: "c3", set: "b.anims", anim: "sit" }] },
  ],
  timeline: [
    { t: 0, track: "t1", jump: "c1" },
    { t: 0, track: "t2", jump: "c3" },
    { t: 0.04, track: "t1", jump: "c2" },
  ],
  ...more,
});

/** A stand-in for REDnode's world that notes every call. */
function fakeWorld(fail: Record<string, string> = {}) {
  const calls: [string, ...unknown[]][] = [];
  let n = 0;
  const note = async <T>(name: string, args: unknown[], answer: T): Promise<T> => {
    calls.push([name, ...args]);
    if (fail[name]) throw new Error(fail[name]);
    return answer;
  };
  const world = {
    writeWorkspot: (name: string, o: unknown) => note("write", [name, o], { path: `ws\\${name}.workspot` }),
    spawn: (o: unknown) => note("spawn", [o], { id: { hash: `e${++n}` } }),
    useWorkspot: (id: { hash: string }, o: unknown) => note("use", [id.hash, o], { id, started: true }),
    jumpWorkspot: (id: { hash: string }, to: string) => note("jump", [id.hash, to], true),
    remove: (id: { hash: string }) => note("remove", [id.hash], true),
    load: (scene: { objects: { id: string }[] }, o: unknown) => note("load", [scene.objects.map((x) => x.id), o], { skipped: [{ object: "lamp", why: "lights are not spawned yet" }], notes: [] }),
    unload: (name: string) => note("unload", [name], 1),
  };
  return { world, calls, names: () => calls.map((c) => c[0]) };
}
const V = { x: 100, y: 200, z: 5, fx: 0, fy: 1 };
const soon = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("the cast stands in front of V, or where the set has it", () => {
  // V faces north: Right is east, Forward is north, and a Turn of 180 faces V (south).
  assert.deepEqual(placements(sheet(), undefined, V), { t1: { position: { x: 99, y: 203, z: 5 }, yaw: 180 }, t2: { position: { x: 101, y: 205, z: 5 }, yaw: 90 } });
  // V faces east: Right is south.
  const east = placements(sheet(), undefined, { ...V, fx: 1, fy: 0 });
  assert.deepEqual([east.t1.position, east.t1.yaw], [{ x: 103, y: 201, z: 5 }, 90]);
  assert.throws(() => placements(sheet(), undefined, null), /load a save/);
  // On a set: metres east and north of the origin, at the height the set gives the person.
  const stage = { origin: [10, 20, 3], from: { t1: "ana_spot" }, scene: { name: "Alley", objects: [{ id: "ana_spot", transform: { position: [9, 20, 3.5] } }, { id: "crate" }] } };
  const on = placements(sheet({ anchor: { mode: "set" } as CueSheet["anchor"] }), stage, null);
  assert.deepEqual(on, { t1: { position: { x: 9, y: 20, z: 3.5 }, yaw: 180 }, t2: { position: { x: 11, y: 22, z: 3 }, yaw: 90 } });
  // The game is given the set without the people the scene directs.
  assert.deepEqual(sceneFor(stage, sheet()).objects.map((o) => o.id), ["crate"]);
  assert.equal(slug("Alley talk!"), "alley_talk");
  assert.match(refusal({ cues: 2 }) ?? "", /not a cue sheet/);
  assert.match(refusal(sheet({ cast: [] })) ?? "", /nobody to play/);
});

test("the player writes, spawns, starts and jumps on time; Stop removes everybody", async () => {
  const { world, calls, names } = fakeWorld();
  const said: string[] = [];
  const player = new Player({ world, player: async () => V, warmMs: 5, leadMs: 5, report: (s: { state: string }) => said.push(s.state) });
  const s = await player.play({ id: "p1", sheet: sheet() });
  assert.equal(s.state, "playing");
  assert.equal(s.id, "p1");
  // One swap, with the last workspot written; everyone started on their first clip before the scene.
  assert.deepEqual(calls.filter((c) => c[0] === "write").map((c) => [c[1], (c[2] as { swap: boolean; rig: string }).swap, (c[2] as { rig: string }).rig]), [["alley_talk_t1", false, "w.rig"], ["alley_talk_t2", true, "m.rig"]]);
  assert.deepEqual(calls.filter((c) => c[0] === "spawn").map((c) => { const o = c[1] as { record: string; appearance?: string; workspot: string; yaw: number }; return [o.record, o.appearance, o.workspot, o.yaw]; }), [["Character.Ana", "street", "ws\\alley_talk_t1.workspot", 180], ["Character.Bo", undefined, "ws\\alley_talk_t2.workspot", 90]]);
  assert.deepEqual(calls.filter((c) => c[0] === "use"), [["use", "e1", { entry: "c1" }], ["use", "e2", { entry: "c3" }]]);
  // Real timers: wait for the play's end, however busy the PC is.
  for (let i = 0; i < 100 && player.state().state !== "ended"; i++) await soon(20);
  await soon(20);
  assert.deepEqual(calls.filter((c) => c[0] === "jump"), [["jump", "e1", "c1"], ["jump", "e2", "c3"], ["jump", "e1", "c2"]]);
  const end = player.state();
  assert.equal(end.state, "ended");
  assert.deepEqual(end.late!.map((c) => [c.t, c.jump, c.ok]), [[0, "c1", true], [0, "c3", true], [0.04, "c2", true]]);
  assert.ok(end.late!.every((c) => c.ms > -5 && c.ms < 2000));
  assert.deepEqual([...new Set(said)], ["writing", "spawning", "warming", "playing", "ended"]);
  // The same scene again: nothing is written, and the old cast goes first.
  calls.length = 0;
  await player.play({ id: "p2", sheet: sheet() });
  assert.deepEqual(names().slice(0, 4), ["remove", "remove", "spawn", "spawn"]);
  assert.ok(!names().includes("write"));
  // A changed clip: that actor's workspot alone is written again.
  const changed = sheet();
  changed.cast[1].clips[0].anim = "lean";
  calls.length = 0;
  await player.play({ id: "p3", sheet: changed });
  assert.deepEqual(calls.filter((c) => c[0] === "write").map((c) => [c[1], (c[2] as { swap: boolean }).swap]), [["alley_talk_t2", true]]);
  calls.length = 0;
  assert.equal((await player.stop()).state, "stopped");
  assert.deepEqual(names(), ["remove", "remove"]);
  await soon(80);
  assert.ok(!names().includes("jump"));
});

test("a scene on a set loads the set without its directed people; a failure says why and leaves nobody", async () => {
  const { world, calls, names } = fakeWorld();
  const player = new Player({ world, player: async () => null, warmMs: 1, leadMs: 1 });
  const stage = { origin: [10, 20, 3], from: { t1: "ana_spot", t2: "bo_spot" }, scene: { format: 2, name: "Alley", objects: [{ id: "ana_spot" }, { id: "bo_spot" }, { id: "crate" }, { id: "lamp" }] } };
  const on = sheet({ anchor: { mode: "set" } as CueSheet["anchor"] });
  const s = await player.play({ id: "s1", sheet: on, stage });
  assert.equal(s.state, "playing");
  assert.deepEqual(calls.find((c) => c[0] === "load"), ["load", ["crate", "lamp"], { name: SET }]);
  assert.match(s.notes![0], /"lamp" is not in the game/);
  calls.length = 0;
  await player.stop();
  assert.deepEqual(names(), ["remove", "remove", "unload"]);
  // The set did not come with the scene.
  assert.match((await player.play({ id: "s2", sheet: on })).error ?? "", /the set did not come with it/);
  // The second person cannot be spawned: the first is removed, and the state says who.
  const bad = fakeWorld();
  let n = 0;
  const spawn = bad.world.spawn;
  bad.world.spawn = (o: unknown) => (++n === 2 ? Promise.reject(new Error("no such record")) : spawn(o));
  const failed = await new Player({ world: bad.world, player: async () => V, warmMs: 1, leadMs: 1 }).play({ id: "f1", sheet: sheet() });
  assert.deepEqual([failed.state, failed.error], ["failed", "Bo could not be spawned: no such record"]);
  assert.deepEqual(bad.names().filter((x) => x === "remove").length, 1);
  assert.match((await new Player({ world, player: async () => V }).play({ id: "x", sheet: { cues: 1, cast: [] } })).error ?? "", /nobody to play/);
});

test("EDGEdir reaches the player through a folder, and copies the player into the game", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "edgedir-play-"));
  try {
    const dir = path.join(root, "play");
    // A request is written whole, with an id and its time.
    const id = request({ do: "play", sheet: sheet() }, dir, 5000);
    const sent = JSON.parse(fs.readFileSync(path.join(dir, "request.json"), "utf8"));
    assert.deepEqual([sent.id, sent.at, sent.do, sent.sheet.scene], [id, 5000, "play", "Alley talk"]);
    assert.deepEqual(fs.readdirSync(dir), ["request.json"]);
    // The player is alive while its last word is fresh.
    assert.equal(alive(dir, 5000), undefined);
    fs.writeFileSync(path.join(dir, "alive.json"), JSON.stringify({ version: "0.1.0", at: 4000 }));
    assert.equal(alive(dir, 5000), "0.1.0");
    assert.equal(alive(dir, 8900), "0.1.0");
    assert.equal(alive(dir, 9100), undefined);
    assert.equal(readState(dir), undefined);
    fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify({ id, state: "playing", text: "Playing", startedAt: 6000, late: [{ ok: true }, { ok: false }] }));
    assert.equal(readState(dir)?.startedAt, 6000);
    assert.deepEqual(lineOf(readState(dir)!), { text: "Playing in the game; 1 jump did not land", bad: true });
    assert.deepEqual(lineOf({ state: "failed", text: "Bo could not be spawned" }), { text: "Not played: Bo could not be spawned", bad: true });
    assert.deepEqual(lineOf({ state: "spawning", text: "Spawning 2 people" }), { text: "Spawning 2 people", bad: false });

    // The Director EDGEdir needs is the one in this repo's director folder.
    const source = path.resolve("director");
    const shipped = playerVersion(source)!;
    assert.equal(shipped, DirectorVersion);
    assert.match(shipped, /^\d+\.\d+\.\d+$/);
    assert.deepEqual([older("0.1.0", "0.1.1"), older("0.2.0", "0.10.0"), older("1.0.0", "1.0.0"), older("1.1", "1.0.9")], [true, true, false, false]);
    const gamePath = path.join(root, "game");
    assert.equal(installState(shipped, gamePath), "noRednode");
    fs.mkdirSync(path.join(gamePath, "red4ext", "plugins", "REDnode"), { recursive: true });
    assert.equal(installState(shipped, gamePath), "none");
    const to = install(source, gamePath);
    assert.equal(to, path.join(gamePath, "red4ext", "plugins", "REDnode", "apps", "edge-director"));
    assert.deepEqual(fs.readdirSync(to).sort(), fs.readdirSync(source).filter((f) => fs.statSync(path.join(source, f)).isFile()).sort());
    assert.equal(installState(shipped, gamePath), "ready");
    // An older one in the game is offered a replacement.
    const manifest = path.join(to, "rednode-app.json");
    fs.writeFileSync(manifest, JSON.stringify({ ...JSON.parse(fs.readFileSync(manifest, "utf8")), version: "0.0.1" }));
    assert.equal(installState(shipped, gamePath), "older");
    assert.throws(() => install(path.join(root, "nothing"), gamePath), /No built EDGE Director/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a scene on a set sends the set's file, its origin, and who each track directs", () => {
  const text = JSON.stringify({ format: 2, name: "My Alley", objects: [{ id: "ana_spot", kind: "npc", record: "Character.Ana", transform: { position: [0, 0, 1], rotation: [0, 0, 0, 1] } }, { id: "crate", kind: "mesh", transform: { position: [2, 0, 1] } }] });
  const info = parseSet(text);
  const doc = addSetPeople(chooseSet(newDoc("Talk"), linkTo("library", "a.scene.json", info, "sha256:1")), info).doc;
  const stage = stageFor(doc, text)!;
  assert.deepEqual([stage.origin, stage.from, (stage.scene as { name: string }).name], [[0, 0, 1], { t1: "ana_spot" }, "My Alley"]);
  assert.equal(stageFor(newDoc("Free"), text), undefined);
});
