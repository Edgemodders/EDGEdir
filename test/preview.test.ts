// D3: the pose under the playhead, marks, and the preview's files (src/pose.ts, src/doc.ts,
// src/core/preview.ts), with made-up names and a stand-in bridge. Nothing here is read from the game.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { baseBodyFor, entityNotes, PreviewStore, type PreviewBridge } from "../src/core/preview";
import { addTrack, EditError, formatDoc, markOf, moveTrack, newDoc, parseDoc, setActor, setMark, setTrack, type Clip, type Track } from "../src/doc";
import { bodies, bodyKey, bodyWant, clipKey, clipsNear, clipWant, poseAt } from "../src/pose";

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), "edgedir-preview-"));
const W = "base\\made_up\\woman.rig";
const M = "base\\made_up\\man.rig";
const anim = (name: string, seconds: number, rig = W) => ({ set: "base\\made_up\\a.anims", name, rig, seconds });
const track = (clips: Clip[]): Track => ({ id: "t1", kind: "actor", name: "Ana", actor: { record: "Character.Ana", name: "Ana", entity: "a.ent", rig: W }, clips });
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} is not ${b}`);

test("the pose under the playhead: the clip's own time, wrapped over its part, and on through a gap", () => {
  const t = track([
    { id: "c1", kind: "anim", start: 1, length: 2, anim: anim("wave", 2) },
    // The part 0.5 to 1.5 at double speed, three times: 1.5 s on the timeline.
    { id: "c2", kind: "anim", start: 4, length: 1.5, in: 0.5, out: 1.5, speed: 2, loops: 3, anim: anim("lean", 2) },
  ]);
  // Before the first clip: the rest pose.
  assert.equal(poseAt(t, 0.5).clip, undefined);
  let p = poseAt(t, 1);
  assert.equal(p.clip?.id, "c1");
  near(p.t, 0);
  near(poseAt(t, 2.25).t, 1.25);
  assert.equal(poseAt(t, 2.25).gap, false);
  // In the gap the first clip goes on looping.
  p = poseAt(t, 3.5);
  assert.equal(p.clip?.id, "c1");
  assert.equal(p.gap, true);
  near(p.t, 0.5);
  // The second clip: in + run × speed, wrapped over the part.
  near(poseAt(t, 4).t, 0.5);
  near(poseAt(t, 4.25).t, 1);
  near(poseAt(t, 4.6).t, 0.5 + ((0.6 * 2) % 1));
  // After the scene's last clip it loops on too.
  p = poseAt(t, 6);
  assert.equal(p.clip?.id, "c2");
  assert.equal(p.gap, true);
  near(p.t, 0.5);
});

test("a clip for another rig, a block with no animation and a transition are passed over", () => {
  const t = track([
    { id: "c1", kind: "anim", start: 0, length: 2, anim: anim("wave", 2) },
    { id: "c2", kind: "transition", start: 1.8, length: 0.4 },
    { id: "c3", kind: "anim", start: 2, length: 1, anim: anim("shrug", 1, M) },
    { id: "c4", kind: "anim", start: 3, length: 1, name: "a block" },
  ]);
  // Under the unfit clip the last clip that fits goes on, and the pose says what was passed over.
  const p = poseAt(t, 2.5);
  assert.equal(p.clip?.id, "c1");
  assert.equal(p.passed?.id, "c3");
  near(p.t, 0.5);
  assert.equal(poseAt(t, 3.5).clip?.id, "c1");
  assert.equal(poseAt(t, 3.5).passed, undefined);
  // Only an unfit clip: the rest pose, and the note.
  const only = track([{ id: "c3", kind: "anim", start: 0, length: 1, anim: anim("shrug", 1, M) }]);
  assert.equal(poseAt(only, 0.5).clip, undefined);
  assert.equal(poseAt(only, 0.5).passed?.id, "c3");
});

test("what the preview asks for: a body by entity and appearance or V's rig, clips by set and name or id", () => {
  assert.equal(bodyWant(undefined), undefined);
  assert.equal(bodyWant({ record: "Character.Ana" }), undefined);
  assert.deepEqual(bodyWant({ record: "Character.Ana", entity: "a.ent", appearance: "coat", rig: W }), { entity: "a.ent", appearance: "coat" });
  assert.deepEqual(bodyWant({ player: "wa", rig: W, entity: "v.ent" }), { player: "wa", rig: W });
  assert.equal(bodyWant({ player: "wa" }), undefined);
  // Game paths do not mind case or slash.
  assert.equal(bodyKey({ entity: "Base/A.ent", appearance: "Coat" }), bodyKey({ entity: "base\\a.ent", appearance: "coat" }));
  assert.notEqual(bodyKey({ entity: "a.ent" }), bodyKey({ entity: "a.ent", appearance: "coat" }));
  assert.deepEqual(clipWant({ id: "anim-1", name: "wave", seconds: 1 }), { id: "anim-1", name: "wave" });
  assert.equal(clipKey({ set: "A.anims", name: "wave" }), clipKey({ set: "a.anims", name: "wave" }));
  assert.notEqual(clipKey({ set: "a.anims", name: "wave" }), clipKey({ set: "a.anims", name: "Wave" }));

  const t = track([
    { id: "c1", kind: "anim", start: 0, length: 2, anim: anim("wave", 2) },
    { id: "c2", kind: "anim", start: 2, length: 1, anim: anim("lean", 1) },
    { id: "c3", kind: "anim", start: 9, length: 1, anim: anim("far", 1) },
    { id: "c4", kind: "anim", start: 3, length: 1, anim: anim("shrug", 1, M) },
  ]);
  // The clip now and those starting soon; not the far one, not the unfit one.
  assert.deepEqual(clipsNear(t, 0.5, 3).map((c) => c.name), ["wave", "lean"]);

  const doc = setTrack(setActor(addTrack(addTrack(addTrack(newDoc("S"), "actor"), "actor"), "audio"), "t1", { record: "Character.Ana", entity: "a.ent" }), "t1", { mute: true });
  // A muted track and a track with nobody show no body.
  assert.deepEqual(bodies(doc).map((x) => x.id), []);
  assert.deepEqual(bodies(setTrack(doc, "t1", { mute: false })).map((x) => x.id), ["t1"]);
});

test("a mark is where an actor stands: by the track's order until it is set, and it stays with the track", () => {
  let doc = addTrack(addTrack(addTrack(newDoc("S"), "audio"), "actor"), "actor");
  const [, a, b] = doc.tracks.map((t) => t.id);
  doc = setActor(setActor(doc, a, { record: "Character.Ana", name: "Ana" }), b, { record: "Character.Bo", name: "Bo" });
  // The audio track does not count: the first actor is at the origin, the second 0.8 m to its right.
  assert.deepEqual(markOf(doc, a), { x: 0, y: 0, yaw: 0 });
  assert.deepEqual(markOf(doc, b), { x: 0.8, y: 0, yaw: 0 });
  // Unset marks follow the order.
  assert.deepEqual(markOf(moveTrack(doc, b, 0), b), { x: 0, y: 0, yaw: 0 });

  doc = setMark(doc, b, { yaw: 180 });
  assert.deepEqual(doc.tracks[2].actor?.at, { x: 0.8, y: 0, yaw: 180 });
  doc = setMark(doc, b, { x: -1.25, yaw: -90 });
  assert.deepEqual(markOf(doc, b), { x: -1.25, y: 0, yaw: 270 });
  // A set mark does not move with the order, and a new actor on the track stands where the last one stood.
  assert.deepEqual(markOf(moveTrack(doc, b, 0), b), { x: -1.25, y: 0, yaw: 270 });
  doc = setActor(doc, b, { record: "Character.Cy", name: "Cy" });
  assert.deepEqual(markOf(doc, b), { x: -1.25, y: 0, yaw: 270 });
  assert.deepEqual(markOf(parseDoc(formatDoc(doc)), b), { x: -1.25, y: 0, yaw: 270 });

  const refused = (run: () => unknown, text: RegExp) => assert.throws(run, (e: Error) => e instanceof EditError && text.test(e.message));
  refused(() => setMark(doc, b, { x: 5000 }), /within 1000 m/);
  refused(() => setMark(doc, b, { y: Number.NaN }), /not a number/);
  refused(() => setMark(doc, doc.tracks[0].id, { x: 1 }), /Choose an actor first/);
  refused(() => setMark(doc, "nope", { x: 1 }), /no longer in the scene/);
});

/** A bridge that writes a small file where REDbridge would write the .glb, and keeps what it was asked. */
function standIn() {
  const calls: { path?: string; options?: Record<string, unknown> }[] = [];
  let fail = "";
  const bridge: PreviewBridge = {
    extract: async (p, outFile) => {
      calls.push({ path: p });
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.writeFileSync(outFile, "game");
    },
    exportFile: async (file, _archiveDir, rawDir, options) => {
      calls.push({ options: options as Record<string, unknown> });
      if (fail) throw new Error(fail);
      fs.mkdirSync(rawDir, { recursive: true });
      const name = `${path.basename(file)}.glb`;
      fs.writeFileSync(path.join(rawDir, name), `glb of ${path.basename(file)}`);
      const entity = options?.appearance ? { appearance: options.appearance, rigs: [], joints: 547, meshes: [{ component: "body", mesh: "b.mesh", on: "root" }], leftOut: [{ component: "hair", why: "its rig is not the body's" }] } : null;
      return { ok: true, written: [name], entity };
    },
  };
  return { bridge, calls, failWith: (m: string) => (fail = m) };
}

test("a body is exported once, without materials, and found again; what was left out is kept with it", async () => {
  const dir = temp();
  const { bridge, calls } = standIn();
  const store = new PreviewStore(dir);
  const want = { entity: "base\\made_up\\ana.ent" };
  const first = await store.body(bridge, "1-2", want, async () => "ana_default");
  assert.equal(first.cached, false);
  assert.ok(first.file.startsWith(store.root));
  assert.equal(fs.readFileSync(first.file, "utf8"), "glb of ana.ent");
  assert.deepEqual(calls[0], { path: "base\\made_up\\ana.ent" });
  // "Any: the game picks" shows the entity's first appearance.
  assert.deepEqual(calls[1].options, { meshBinary: true, appearance: "ana_default", meshMaterials: false });
  assert.deepEqual(first.notes, ["Appearance ana_default: 1 meshes on 547 joints", "Left out hair: its rig is not the body's"]);
  // The work folder is gone; only the body and its notes are kept.
  assert.equal(fs.existsSync(path.join(store.root, "work")), false);

  const again = await new PreviewStore(dir).body(bridge, "1-2", want);
  assert.equal(again.cached, true);
  assert.equal(again.file, first.file);
  assert.deepEqual(again.notes, first.notes);
  assert.equal(calls.length, 2);
  // Another appearance, and another game version, are other files.
  assert.notEqual((await store.body(bridge, "1-2", { ...want, appearance: "ana_coat" })).file, first.file);
  assert.notEqual((await store.body(bridge, "9-9", want, async () => "ana_default")).file, first.file);
});

test("V is the base body of V's rig; an animation is exported by itself, in place; a failure is not kept", async () => {
  const dir = temp();
  const { bridge, calls, failWith } = standIn();
  const store = new PreviewStore(dir);
  const rig = "base\\characters\\base_entities\\woman_base\\woman_base.rig";
  const v = await store.body(bridge, "1-2", { player: "wa", rig });
  assert.match(calls[0].path ?? "", /woman_average\\t0_000_wa_base__full\.mesh$/);
  assert.deepEqual(calls[1].options, { meshBinary: true, rigs: [rig, "base\\characters\\base_entities\\woman_base\\deformations_rigs\\woman_base_deformations.rig"], meshMaterials: false });
  assert.match(v.notes[0], /standing in for your V/);
  assert.equal(baseBodyFor("Base/Characters/base_entities/man_base/man_base.rig")?.mesh.includes("man_average"), true);
  assert.equal(baseBodyFor("base\\made_up\\car.rig"), undefined);
  await assert.rejects(() => store.body(bridge, "1-2", { player: "wa", rig: "base\\made_up\\car.rig" }), /no base body/);

  calls.length = 0;
  const want = { set: "base\\made_up\\a.anims", name: "wave" };
  // Asked twice at once: one export.
  const [one, two] = await Promise.all([store.clip(bridge, "1-2", want), store.clip(bridge, "1-2", want)]);
  assert.equal(one.file, two.file);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].options, { meshBinary: true, animations: ["wave"], rootMotion: false });
  assert.notEqual((await store.clip(bridge, "1-2", { ...want, name: "lean" })).file, one.file);

  failWith("the file is not in the game");
  const gone = { set: "base\\made_up\\gone.anims", name: "x" };
  await assert.rejects(() => store.clip(bridge, "1-2", gone), /not in the game/);
  failWith("");
  // Tried again, it is exported: nothing of the failure was kept.
  assert.equal((await store.clip(bridge, "1-2", gone)).cached, false);
  assert.deepEqual(entityNotes(undefined, "coat"), ["Appearance coat"]);
});

test("a made animation's file is copied where the page may read it, and again when it changed", () => {
  const dir = temp();
  const source = path.join(dir, "wave.glb");
  fs.writeFileSync(source, "one");
  const store = new PreviewStore(dir);
  const first = store.made("anim-1", source);
  assert.equal(first.cached, false);
  assert.ok(first.file.startsWith(store.root));
  assert.equal(store.made("anim-1", source).cached, true);
  fs.writeFileSync(source, "two, longer");
  const next = store.made("anim-1", source);
  assert.notEqual(next.file, first.file);
  assert.equal(fs.readFileSync(next.file, "utf8"), "two, longer");
  assert.throws(() => store.made("anim-2", path.join(dir, "none.glb")));
});
