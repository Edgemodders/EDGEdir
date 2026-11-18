// EDGE Director (DR1): a play from a moment, going to a moment, the loop (director/play.mjs), and
// the Desk as the game's side reads it (director/floor.ts). Made-up names; nothing from the game.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { open, rootsOf, scenes, writePinFile } from "../director/floor";
import type { Snapshot } from "../director/protocol";
import { Stage, type PlayerLike } from "../director/stage";
import { entryAt, frameOf, markAt, placeOf, Player, turnOf } from "../director/play.mjs";
import type { CueSheet } from "../src/cues";
import { newScene, newSequence } from "../src/desk";
import { addAnimClip, addTrack, formatDoc, markOf, newDoc, parseDoc, setActor, setMark, type SceneDoc } from "../src/doc";
import { forgetPin, formatPins, linkPins, markAtPin, markPin, parsePins, pinOf, pinsOf, placeAtPin, placePin, renamePin, unlinkPins, usedPins } from "../src/pins";
import { writeRoots, writeUnsaved } from "../src/play";
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
      move: (_id: unknown, position: unknown, _o: unknown, yaw: number) => note(`move ${JSON.stringify(position)} ${yaw}`, true),
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

// ---- DR2 Adjust ---------------------------------------------------------------------------------

test("a mark and a place in the world turn into each other, in each kind of frame", () => {
  // In front of V, who faces east: the origin is 3 m east of V, Forward is east, Right is south.
  const front = frameOf({ anchor: { mode: "player", distance: 3 } }, undefined, { x: 10, y: 20, z: 1, fx: 1, fy: 0 });
  assert.deepEqual([front.o, front.turn], [{ x: 13, y: 20, z: 1 }, 270]);
  const p = placeOf(front, { x: 2, y: 1, yaw: 180 });
  assert.deepEqual([p.position, p.yaw], [{ x: 14, y: 18, z: 1 }, 90]);
  assert.deepEqual(markAt(front, p.position, p.yaw), { x: 2, y: 1, yaw: 180 });
  // At a place: the origin and the turn are the document's.
  const at = frameOf({ anchor: { mode: "world", at: [5, 5, 2], yaw: 90 } }, undefined, null);
  assert.deepEqual(markAt(at, placeOf(at, { x: -1.5, y: 0.25, yaw: 30 }).position, placeOf(at, { x: -1.5, y: 0.25, yaw: 30 }).yaw), { x: -1.5, y: 0.25, yaw: 30 });
  assert.equal(turnOf(0, 1), 0);
  assert.throws(() => frameOf({ anchor: { mode: "player" } }, undefined, null), /load a save/);
});

test("Adjust changes the scene's file with EDGEdir's own edits, and moves the people in the game", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "edgedir-adjust-"));
  try {
    const desk = path.join(root, "desk");
    const playDir = path.join(root, "play");
    let doc: SceneDoc = addTrack(newDoc("Talk"), "actor");
    const id = doc.tracks[0].id;
    doc = setActor(doc, id, { record: "Character.Ana", name: "Ana", rig: "w.rig" });
    doc = addAnimClip(doc, id, { set: "a.anims", name: "stand", rig: "w.rig", seconds: 5 }, 0).doc;
    const talk = newScene("Talk", desk, doc);
    fs.writeFileSync(talk.file, formatDoc(doc));
    const onDisk = () => parseDoc(fs.readFileSync(talk.file, "utf8"));

    const { world, calls } = fakeWorld();
    let v = { x: 100, y: 200, z: 5, fx: 0, fy: 1 };
    const player = new Player({ world, player: async () => v, warmMs: 2, leadMs: 2 });
    const states: Snapshot[] = [];
    const stage = new Stage({
      player: player as unknown as PlayerLike,
      version: "0.0.0",
      desk,
      playDir,
      publish: (s) => states.push(s),
      whereV: async () => v,
      teleport: async () => undefined,
      pin: async () => 1,
      unpin: async () => undefined,
    });
    const last = () => states[states.length - 1];
    await stage.handle({ type: "open", file: talk.file });
    assert.deepEqual(last().view!.tracks[0].mark, { x: 0, y: 0, yaw: 0 });

    // In front of V and not in the game: a place in the world is no mark yet.
    await stage.handle({ type: "choose", track: id });
    assert.equal(last().chosen, id);
    await stage.handle({ type: "moveToV", track: id });
    assert.match(last().error ?? "", /Press Play first, or The Scene Is Here/);
    // A nudge needs no frame: 10 cm to the right, in the file.
    await stage.handle({ type: "nudge", track: id, right: 0.1 });
    assert.deepEqual([last().error, markOf(onDisk(), id)], [undefined, { x: 0.1, y: 0, yaw: 0 }]);

    // In the game: Ana stands 3 m north of V, 10 cm to the right. V walks 2 m east and 1 m north, facing east.
    await stage.handle({ type: "play" });
    assert.equal(last().play.state, "playing");
    v = { x: 102, y: 201, z: 5, fx: 1, fy: 0 };
    calls.length = 0;
    await stage.handle({ type: "moveToV", track: id });
    assert.deepEqual(markOf(onDisk(), id), { x: 2, y: -2, yaw: 270 });
    assert.deepEqual(calls, ['move {"x":102,"y":201,"z":5} 270']);
    // A turn by 15 degrees moves nobody from their spot, and turns them.
    calls.length = 0;
    await stage.handle({ type: "nudge", track: id, turn: 15 });
    assert.deepEqual([markOf(onDisk(), id).yaw, calls], [285, ['move {"x":102,"y":201,"z":5} 285']]);

    // The Scene Is Here: the scene keeps the spot it plays at; nobody moves, and the file has the place.
    calls.length = 0;
    await stage.handle({ type: "here" });
    assert.deepEqual([(onDisk().anchor as { mode: string; at: number[]; yaw: number }), calls], [{ mode: "world", at: [100, 203, 5], yaw: 0 }, []]);
    assert.deepEqual(last().view!.place, { at: [100, 203, 5], yaw: 0 });
    // Stopped, the scene has its frame by itself now: Move to V works with nobody in the game.
    await stage.handle({ type: "stop" });
    v = { x: 100, y: 204, z: 5, fx: 0, fy: -1 };
    await stage.handle({ type: "moveToV", track: id });
    assert.deepEqual([last().error, markOf(onDisk(), id)], [undefined, { x: 0, y: 1, yaw: 180 }]);
    // In Front of V takes the place off again.
    await stage.handle({ type: "front" });
    assert.deepEqual([onDisk().anchor, last().view!.place], [{ mode: "player", distance: 3 }, undefined]);

    // What VS Code has unsaved is played and not changed.
    writeUnsaved([talk.file], playDir);
    const before = fs.readFileSync(talk.file, "utf8");
    await stage.handle({ type: "nudge", track: id, forward: 1 });
    assert.match(last().error ?? "", /unsaved changes in VS Code/);
    assert.equal(last().view!.unsaved, true);
    assert.equal(fs.readFileSync(talk.file, "utf8"), before);
    await stage.handle({ type: "play" });
    assert.equal(last().play.state, "playing");
    await stage.handle({ type: "stop" });
    // A list that is old is from a VS Code that is gone.
    writeUnsaved([talk.file], playDir, Date.now() - 60000);
    await stage.handle({ type: "nudge", track: id, forward: 1 });
    assert.deepEqual([last().error, markOf(onDisk(), id).y], [undefined, 2]);
    // An edit EDGEdir refuses is said in its words, and nothing is written.
    await stage.handle({ type: "mark", track: id, x: 5000 });
    assert.match(last().error ?? "", /within 1000 m/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ---- DR3 Pins -----------------------------------------------------------------------------------

test("a pin file reads as REDnode writes it; a mark and the scene's place follow a pin", () => {
  const text = formatPins("Alley", [{ title: "Stairs", at: [10, 20, 3], text: "the drums", style: { color: "#ffcf3f" } }, { title: "Door", at: [12, 24, 3] }]);
  const info = parsePins(text);
  assert.deepEqual([info.name, info.pins.map((p) => p.title), info.pins[0].text, JSON.parse(text).format, JSON.parse(text).pins[0].at], ["Alley", ["Stairs", "Door"], "the drums", "rednode-pins", { x: 10, y: 20, z: 3 }]);
  assert.throws(() => parsePins("{}"), /Not a pin file/);
  assert.throws(() => parsePins(JSON.stringify({ format: "rednode-pins", pins: [{ title: "", at: { x: 1, y: 2, z: 3 } }] })), /Pin 1/);

  let doc: SceneDoc = addTrack(addTrack(newDoc("Talk"), "actor"), "actor");
  const [a, b] = doc.tracks.map((t) => t.id);
  doc = setActor(setActor(doc, a, { record: "Character.Ana", name: "Ana", rig: "w.rig" }), b, { record: "Character.Bo", name: "Bo", rig: "m.rig" });
  doc = setMark(doc, b, { x: 1, y: 2, yaw: 90 });
  doc = linkPins(doc, "Talk.pins.json", info);
  // In front of V a pin is no place in the scene.
  assert.throws(() => markAtPin(doc, a, "Stairs"), /in front of V/);
  assert.throws(() => markAtPin(doc, a, "Roof"), /no pin named "Roof"/);
  // The scene's place at a pin: the origin is the pin, Forward north.
  doc = placeAtPin(doc, "Stairs");
  assert.deepEqual(doc.anchor, { mode: "world", at: [10, 20, 3], yaw: 0, pin: "Stairs" });
  // An actor at the other pin: 2 m east and 4 m north of the origin. The turn is kept.
  doc = markAtPin(doc, a, "Door");
  assert.deepEqual([markOf(doc, a), markPin(doc.tracks[0]), [...usedPins(doc)].sort()], [{ x: 2, y: 4, yaw: 0 }, "Door", ["Door", "Stairs"]]);
  // The Door pin is dropped again 1 m further north: the mark that follows it moves, Bo's does not.
  doc = linkPins(doc, "Talk.pins.json", { name: "Alley", pins: [info.pins[0], { title: "Door", at: [12, 25, 3] }] });
  assert.deepEqual([markOf(doc, a), markOf(doc, b)], [{ x: 2, y: 5, yaw: 0 }, { x: 1, y: 2, yaw: 90 }]);
  // The Stairs pin moves 1 m east: the scene's origin goes with it, and Ana stays at the Door.
  const moved = { name: "Alley", pins: [{ title: "Stairs", at: [11, 20, 3] as [number, number, number] }, { title: "Door", at: [12, 25, 3] as [number, number, number] }] };
  doc = linkPins(doc, "Talk.pins.json", moved);
  assert.deepEqual([doc.anchor.at, markOf(doc, a)], [[11, 20, 3], { x: 1, y: 5, yaw: 0 }]);
  // The same pins again change nothing.
  assert.equal(linkPins(doc, "Talk.pins.json", moved), doc);
  // A mark typed by hand lets go of its pin; a pin that is forgotten leaves the numbers.
  assert.equal(markPin(setMark(doc, a, { x: 0 }).tracks[0]), undefined);
  const forgot = forgetPin(doc, "Stairs");
  assert.deepEqual([placePin(forgot), forgot.anchor.at, markPin(forgot.tracks[0])], [undefined, [11, 20, 3], "Door"]);
  const renamed = renamePin(doc, "Door", "Back door");
  assert.deepEqual([markPin(renamed.tracks[0]), pinOf(renamed, "Back door")?.at, pinOf(renamed, "Door")], ["Back door", [12, 25, 3], undefined]);
  const bare = unlinkPins(doc);
  assert.deepEqual([pinsOf(bare), placePin(bare), markPin(bare.tracks[0]), markOf(bare, a)], [undefined, undefined, undefined, { x: 1, y: 5, yaw: 0 }]);
  // The document goes to text and back with its pins.
  assert.deepEqual(parseDoc(formatDoc(doc)), doc);
});

test("the Director drops a scene's pins where V stands, into the scene's own pin file, and draws them", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "edgedir-pins-"));
  try {
    const desk = path.join(root, "desk");
    const playDir = path.join(root, "play");
    let doc: SceneDoc = addTrack(newDoc("Talk"), "actor");
    const id = doc.tracks[0].id;
    doc = setActor(doc, id, { record: "Character.Ana", name: "Ana", rig: "w.rig" });
    doc = addAnimClip(doc, id, { set: "a.anims", name: "stand", rig: "w.rig", seconds: 5 }, 0).doc;
    const talk = newScene("Talk", desk, doc);
    fs.writeFileSync(talk.file, formatDoc(doc));
    const onDisk = () => parseDoc(fs.readFileSync(talk.file, "utf8"));
    const pinFile = path.join(path.dirname(talk.file), "Talk.pins.json");

    const { world, calls } = fakeWorld();
    let v = { x: 100, y: 200, z: 5, fx: 0, fy: 1 };
    const player = new Player({ world, player: async () => v, warmMs: 2, leadMs: 2 });
    const states: Snapshot[] = [];
    const pinned: string[] = [];
    let n = 0;
    const stage = new Stage({
      player: player as unknown as PlayerLike,
      version: "0.0.0",
      desk,
      playDir,
      publish: (s) => states.push(s),
      whereV: async () => v,
      teleport: async (to) => void (v = { ...v, x: to.x, y: to.y, z: to.z }),
      pin: async (at, title) => (pinned.push(`pin ${title} ${JSON.stringify(at)}`), ++n),
      unpin: async (pinId) => void pinned.push(`unpin ${pinId}`),
    });
    const last = () => states[states.length - 1];
    await stage.handle({ type: "open", file: talk.file });
    await stage.handle({ type: "drop", title: "  " });
    assert.match(last().error ?? "", /Give the pin a name/);

    // A first pin makes the scene's own pin file beside its file, and links it by its name there.
    await stage.handle({ type: "drop", title: "Stairs" });
    assert.equal(last().error, undefined);
    assert.deepEqual(parsePins(fs.readFileSync(pinFile, "utf8")), { name: "Talk", pins: [{ title: "Stairs", at: [100, 200, 5] }] });
    assert.deepEqual([pinsOf(onDisk())?.path, last().view!.pins, last().pinDistances], ["Talk.pins.json", { name: "Talk", pins: [{ title: "Stairs", at: [100, 200, 5], used: false }] }, { Stairs: 0 }]);
    assert.deepEqual(pinned, ['pin Stairs {"x":100,"y":200,"z":5}']);
    v = { ...v, x: 104, y: 203 };
    await stage.handle({ type: "drop", title: "Door" });
    assert.deepEqual(last().pinDistances, { Stairs: 5, Door: 0 });

    // The scene's place at a pin, and the actor at the other: in the file, with the pins' names.
    await stage.handle({ type: "markAtPin", track: id, title: "Door" });
    assert.match(last().error ?? "", /in front of V/);
    await stage.handle({ type: "placeAtPin", title: "Stairs" });
    await stage.handle({ type: "markAtPin", track: id, title: "Door" });
    assert.deepEqual([last().error, last().view!.placePin, last().view!.tracks[0].pin, markOf(onDisk(), id)], [undefined, "Stairs", "Door", { x: 4, y: 3, yaw: 0 }]);
    assert.deepEqual(last().view!.pins!.pins.map((p) => p.used), [true, true]);

    // In the game the actor stands at the Door. The Door pin dropped again somewhere else moves them there at once.
    await stage.handle({ type: "play" });
    assert.deepEqual(player.cast()[0].position, { x: 104, y: 203, z: 5 });
    v = { ...v, x: 106, y: 201 };
    calls.length = 0;
    pinned.length = 0;
    await stage.handle({ type: "drop", title: "Door" });
    assert.deepEqual([markOf(onDisk(), id), calls], [{ x: 6, y: 1, yaw: 0 }, ['move {"x":106,"y":201,"z":5} 0']]);
    // The pin drawn at the old place is taken away and one is drawn at the new.
    assert.deepEqual(pinned.filter((p) => p.includes("Door") || p.startsWith("unpin")).length, 2);
    await stage.handle({ type: "stop" });

    // A pin moved in the file by another hand (REDnode's Pins window) is followed when the scene is read again.
    writePinFile(pinFile, "Talk", [{ title: "Stairs", at: [100, 200, 5] }, { title: "Door", at: [100, 210, 5] }]);
    await stage.handle({ type: "scenes" });
    assert.deepEqual(markOf(onDisk(), id), { x: 0, y: 10, yaw: 0 });
    // Go There on a pin, and a pin removed: the mark keeps its numbers and follows nothing.
    await stage.handle({ type: "goToPin", title: "Door" });
    assert.deepEqual([v.x, v.y], [100, 210]);
    await stage.handle({ type: "removePin", title: "Door" });
    assert.deepEqual([last().view!.pins!.pins.map((p) => p.title), last().view!.tracks[0].pin, markOf(onDisk(), id)], [["Stairs"], undefined, { x: 0, y: 10, yaw: 0 }]);
    // The scene closed: its pins are no longer drawn.
    pinned.length = 0;
    await stage.handle({ type: "close" });
    assert.equal(pinned.filter((p) => p.startsWith("unpin")).length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
