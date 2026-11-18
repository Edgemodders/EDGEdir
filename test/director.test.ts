// EDGE Director (DR1): a play from a moment, going to a moment, the loop (director/play.mjs), and
// the Desk as the game's side reads it (director/floor.ts). Made-up names; nothing from the game.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { open, rootsOf, scenes } from "../director/floor";
import { entryAt, Player } from "../director/play.mjs";
import type { CueSheet } from "../src/cues";
import { newScene, newSequence } from "../src/desk";
import { addAnimClip, addTrack, formatDoc, newDoc, setActor, type SceneDoc } from "../src/doc";
import { writeRoots } from "../src/play";
import { newSeq } from "../src/seq";
import { addSetPeople, chooseSet, linkTo, parseSet } from "../src/set";

const sheet: CueSheet = {
  cues: 1,
  scene: "Alley talk",
  length: 0.2,
  anchor: { mode: "player", distance: 3 } as CueSheet["anchor"],
  cast: [
    { track: "t1", name: "Ana", record: "Character.Ana", rig: "w.rig", at: { x: 0, y: 0, yaw: 0 }, clips: [{ name: "c1", set: "a.anims", anim: "stand" }, { name: "c2", set: "a.anims", anim: "wave" }, { name: "c3", set: "a.anims", anim: "sit" }] },
  ],
  timeline: [
    { t: 0, track: "t1", jump: "c1" },
    { t: 0.05, track: "t1", jump: "c2" },
    { t: 0.1, track: "t1", jump: "c3" },
  ],
};

function fakeWorld() {
  const calls: string[] = [];
  const note = async <T>(text: string, answer: T): Promise<T> => (calls.push(text), answer);
  let n = 0;
  return {
    calls,
    world: {
      writeWorkspot: (name: string) => note("write", { path: `ws\\${name}.workspot` }),
      spawn: () => note("spawn", { id: { hash: `e${++n}` } }),
      useWorkspot: (id: { hash: string }, o: { entry: string }) => note(`use ${o.entry}`, { id, started: true }),
      jumpWorkspot: (_id: unknown, to: string) => note(`jump ${to}`, true),
      remove: () => note("remove", true),
      load: () => note("load", {}),
      unload: () => note("unload", 1),
    },
  };
}
const V = { x: 0, y: 0, z: 0, fx: 0, fy: 1 };
const until = async (what: () => boolean, ms = 2000) => {
  const end = Date.now() + ms;
  while (!what() && Date.now() < end) await new Promise((r) => setTimeout(r, 5));
  assert.ok(what(), "waited too long");
};

test("a play from a moment starts each actor in that moment's clip, and the time counts from the scene's start", async () => {
  const member = sheet.cast[0];
  assert.deepEqual([entryAt(sheet, member, 0), entryAt(sheet, member, 0.049), entryAt(sheet, member, 0.05), entryAt(sheet, member, 9)], ["c1", "c1", "c2", "c3"]);
  const { world, calls } = fakeWorld();
  const player = new Player({ world, player: async () => V, warmMs: 2, leadMs: 2 });
  const before = Date.now();
  const s = await player.play({ id: "a", sheet, from: 0.06 });
  assert.equal(s.state, "playing");
  // The second clip is the one of 0.06 s; only the third's jump is still to come.
  assert.ok(calls.includes("use c2"));
  // Time 0 of the scene was 0.06 s before the start.
  assert.ok(s.startedAt! <= Date.now() - 50 && s.startedAt! >= before - 80, String(s.startedAt! - before));
  await until(() => player.state().state === "ended");
  assert.deepEqual(calls.filter((c) => c.startsWith("jump")), ["jump c3"]);
  assert.deepEqual(player.cast().map((a) => [a.track, a.name, a.position]), [["t1", "Ana", { x: 0, y: 3, z: 0 }]]);
  await player.stop();
  assert.deepEqual(player.cast(), []);
});

test("going to a moment keeps the cast: everybody jumps to that moment's clip and the cues run on", async () => {
  const { world, calls } = fakeWorld();
  const player = new Player({ world, player: async () => V, warmMs: 2, leadMs: 2 });
  assert.equal(await player.seek(0), false);
  await player.play({ id: "a", sheet });
  await until(() => player.state().state === "ended");
  calls.length = 0;
  // Start Again, from the scene's end: nobody is spawned again.
  assert.equal(await player.seek(0), true);
  assert.equal(player.state().state, "playing");
  await until(() => player.state().state === "ended");
  assert.deepEqual(calls, ["jump c1", "jump c2", "jump c3"]);
  // A looping play starts again by itself.
  calls.length = 0;
  assert.equal(await player.seek(0.11, true), true);
  await until(() => calls.filter((c) => c === "jump c3").length >= 2);
  assert.equal(player.state().loop, true);
  assert.deepEqual(calls.slice(0, 2), ["jump c3", "jump c1"]);
  player.setLoop(false);
  await until(() => player.state().state === "ended");
  assert.ok(!calls.includes("spawn"));
  await player.stop();
  assert.equal(await player.seek(0), false);
});

test("the Director lists the Desk's scenes and reads one as the editor would", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "edgedir-floor-"));
  try {
    const desk = path.join(root, "desk");
    const playDir = path.join(root, "play");
    const library = path.join(root, "library");
    fs.mkdirSync(library, { recursive: true });
    // A scene with one actor and two clips, and a second with nobody.
    let doc: SceneDoc = addTrack(newDoc("Talk"), "actor");
    const id = doc.tracks[0].id;
    doc = setActor(doc, id, { record: "Character.Ana", name: "Ana", rig: "w.rig" });
    doc = addAnimClip(doc, id, { set: "a.anims", name: "stand", rig: "w.rig", seconds: 2 }, 0).doc;
    doc = addAnimClip(doc, id, { set: "a.anims", name: "wave", rig: "w.rig", seconds: 1 }, 2).doc;
    const talk = newScene("Talk", desk, doc);
    fs.writeFileSync(talk.file, formatDoc(doc));
    const empty = newScene("Empty", desk);
    newSequence("Greeting", newSeq("Greeting", "w.rig"), desk);
    assert.deepEqual(scenes(desk).map((s) => s.name).sort(), ["Empty", "Talk"]);

    // With no word from EDGEdir, the roots are empty or the Library's own; with one, they are EDGEdir's.
    assert.equal(rootsOf(playDir).project, undefined);
    writeRoots({ library, project: path.join(root, "project") }, playDir);
    const roots = rootsOf(playDir);
    assert.deepEqual(roots, { library, project: path.join(root, "project") });

    const { view, play } = open(talk.file, roots);
    assert.deepEqual([view.name, view.length, view.why], ["Talk", 3, undefined]);
    const strip = view.tracks.find((t) => t.id === id)!;
    assert.deepEqual([strip.who, strip.cast, strip.clips.map((c) => [c.label, c.start, c.end, c.played])], ["Ana", true, [["stand", 0, 2, true], ["wave", 2, 3, true]]]);
    assert.deepEqual([play!.sheet.cast.length, play!.sheet.timeline.length, play!.stage], [1, 2, undefined]);
    assert.ok(view.notes.some((n) => /blends/.test(n)));

    // A scene with nobody says why it cannot play, and one whose set is gone says that.
    const none = open(empty.file, roots);
    assert.equal(none.play, undefined);
    assert.match(none.view.why ?? "", /play/i);
    const setText = JSON.stringify({ format: 2, name: "My Alley", objects: [{ id: "ana_spot", kind: "npc", record: "Character.Ana", transform: { position: [0, 0, 1], rotation: [0, 0, 0, 1] } }] });
    const info = parseSet(setText);
    const onSet = addSetPeople(chooseSet(doc, linkTo("library", "alley.scene.json", info, "sha256:1")), info).doc;
    fs.writeFileSync(talk.file, formatDoc(onSet));
    const lost = open(talk.file, roots);
    assert.deepEqual([lost.view.set, lost.play], [{ name: "My Alley", found: false }, undefined]);
    assert.match(lost.view.why ?? "", /set "My Alley" was not found/);
    fs.writeFileSync(path.join(library, "alley.scene.json"), setText);
    const found = open(talk.file, roots);
    assert.deepEqual([found.view.set, found.view.why, (found.play!.stage!.scene as { name: string }).name], [{ name: "My Alley", found: true }, undefined, "My Alley"]);
    assert.throws(() => open(path.join(desk, "gone.edgedir"), roots), /not on the Desk any more/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
