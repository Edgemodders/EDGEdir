// D5b: the cue sheet (src/cues.ts): who is spawned, each actor's workspot clips, the jumps, and the
// notes on what the game will not match. Made-up names; nothing here is read from the game.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import { addAnimClip, addSeqClip, addTrack, addTransition, newDoc, setActor, setMark, setPlay, setTrack, setTransition, type SceneDoc } from "../src/doc";
import { cuesOf, notesFor } from "../src/cues";

const W = "base\\made_up\\woman.rig";
const M = "base\\made_up\\man.rig";
const SET = "base\\made_up\\a.anims";
const anim = (name: string, seconds: number, rig = W) => ({ set: SET, name, rig, seconds });
const ana = { record: "Character.Ana", name: "Ana", appearance: "street", entity: "a.ent", rig: W };

/** Ana on t1 with walk (0 to 2) and sit (2 to 5). */
function scene(): SceneDoc {
  let doc = setActor(addTrack(newDoc("Alley"), "actor"), "t1", ana);
  doc = addAnimClip(doc, "t1", anim("walk", 2), 0).doc;
  return addAnimClip(doc, "t1", anim("sit", 3), 2).doc;
}
const kinds = (doc: SceneDoc) => cuesOf(doc).notes.map((n) => n.kind);

test("each clip is a looping entry and a jump at its start", () => {
  const { sheet, notes } = cuesOf(setMark(scene(), "t1", { x: 1, y: 2, yaw: 90 }));
  assert.deepEqual([sheet.cues, sheet.scene, sheet.length, sheet.anchor.mode], [1, "Alley", 5, "player"]);
  assert.deepEqual(sheet.cast, [
    {
      track: "t1",
      name: "Ana",
      record: "Character.Ana",
      appearance: "street",
      rig: W,
      at: { x: 1, y: 2, yaw: 90 },
      clips: [
        { name: "c1", set: SET, anim: "walk" },
        { name: "c2", set: SET, anim: "sit" },
      ],
    },
  ]);
  assert.deepEqual(sheet.timeline, [
    { t: 0, track: "t1", jump: "c1" },
    { t: 2, track: "t1", jump: "c2" },
  ]);
  // With no transition the preview cuts and the game blends: said on the second clip only.
  assert.deepEqual(notes.map((n) => [n.kind, n.clip]), [["cut", "c2"]]);
});

test("two actors' jumps come in time order", () => {
  let doc = setActor(addTrack(scene(), "actor"), "t2", { record: "Character.Bo", name: "Bo", rig: M });
  doc = addAnimClip(doc, "t2", anim("wave", 1, M), 1).doc;
  const { sheet } = cuesOf(doc);
  assert.deepEqual(sheet.cast.map((m) => [m.track, m.appearance, m.at.x]), [["t1", "street", 0], ["t2", undefined, 0.8]]);
  assert.deepEqual(sheet.timeline.map((c) => [c.t, c.track]), [[0, "t1"], [1, "t2"], [2, "t1"]]);
});

test("a start point, a speed and loops: what the game cannot do is said", () => {
  let doc = setPlay(scene(), "c2", { in: 0.5, speed: 2, loops: 3 });
  const { sheet, notes } = cuesOf(doc);
  // Loops and a cut end need no cue: the entry loops until the next jump.
  assert.equal(sheet.timeline.length, 2);
  assert.deepEqual(notes.map((n) => n.kind).sort(), ["cut", "in", "speed"]);
  assert.match(notes.find((n) => n.kind === "in")!.text, /not from 0\.5 s/);
  assert.match(notes.find((n) => n.kind === "speed")!.text, /not at 2/);
  doc = setPlay(scene(), "c1", { out: 1 });
  assert.deepEqual(kinds(doc), ["cut"]);
});

test("a transition makes no cue, and says the game's blend is its own", () => {
  const made = addTransition(scene(), "t1", 2);
  let { sheet, notes } = cuesOf(made.doc);
  assert.equal(sheet.timeline.length, 2);
  assert.deepEqual(notes.map((n) => [n.kind, n.clip]), [["transition", made.id]]);
  assert.match(notes[0].text, /"walk" to "sit".*not measured/);
  ({ notes } = cuesOf(setTransition(made.doc, made.id, { method: "ai" })));
  assert.match(notes[0].text, /No AI provider/);
});

test("who is left out, and why", () => {
  // No actor: left out, said once.
  let doc = addAnimClip(addTrack(newDoc("S"), "actor"), "t1", anim("walk", 2), 0).doc;
  assert.deepEqual([cuesOf(doc).sheet.cast.length, kinds(doc)], [0, ["noActor"]]);
  // V.
  doc = setActor(doc, "t1", { player: "wa", name: "V", rig: W });
  assert.deepEqual([cuesOf(doc).sheet.cast.length, kinds(doc)], [0, ["player"]]);
  // A character whose rig is not known.
  doc = setActor(doc, "t1", { record: "Character.Ana", name: "Ana" });
  assert.deepEqual(kinds(doc), ["noRig"]);
  // A muted track and an empty one: nothing to say.
  assert.deepEqual(kinds(setTrack(scene(), "t1", { mute: true })), []);
  assert.equal(cuesOf(setTrack(scene(), "t1", { mute: true })).sheet.cast.length, 0);
  assert.deepEqual(cuesOf(setActor(addTrack(newDoc("S"), "actor"), "t1", ana)).sheet.cast, []);
  // A clip for another rig is passed over, as in the preview.
  doc = addAnimClip(scene(), "t1", anim("lean", 1, M), 5).doc;
  assert.deepEqual(cuesOf(doc).sheet.cast[0].clips.map((c) => c.anim), ["walk", "sit"]);
});

test("a made animation is left out, and the clip after it is no cut", () => {
  let doc = setActor(addTrack(newDoc("S"), "actor"), "t1", ana);
  doc = addAnimClip(doc, "t1", { id: "made-1", name: "dance", rig: W, seconds: 2 }, 0).doc;
  doc = addAnimClip(doc, "t1", anim("sit", 3), 2).doc;
  const { sheet, notes } = cuesOf(doc);
  assert.deepEqual(sheet.cast[0].clips.map((c) => c.anim), ["sit"]);
  assert.deepEqual(notes.map((n) => [n.kind, n.clip]), [["made", "c1"]]);
  // Only made animations: nobody to spawn.
  const only = addAnimClip(setActor(addTrack(newDoc("S"), "actor"), "t1", ana), "t1", { id: "made-1", name: "dance", rig: W, seconds: 2 }, 0).doc;
  assert.equal(cuesOf(only).sheet.cast.length, 0);
  // "The clip before it goes on looping" only where a clip before it plays.
  assert.ok(!notes[0].text.includes("goes on looping"));
  const after = addAnimClip(addAnimClip(setActor(addTrack(newDoc("S"), "actor"), "t1", ana), "t1", anim("sit", 3), 0).doc, "t1", { id: "made-1", name: "dance", rig: W, seconds: 2 }, 3).doc;
  assert.ok(cuesOf(after).notes.find((n) => n.kind === "made")!.text.includes("goes on looping"));
});

test("a sequence block is its clips, and its notes are found by the block", () => {
  const seq = {
    id: "s1",
    name: "Sit down",
    rig: W,
    clips: [
      { id: "c1", kind: "anim" as const, start: 0, length: 2, anim: anim("walk", 2) },
      { id: "c2", kind: "anim" as const, start: 2, length: 1.5, in: 0.5, anim: anim("sit", 2) },
    ],
  };
  let doc = setActor(addTrack(newDoc("S"), "actor"), "t1", ana);
  const made = addSeqClip(doc, "t1", seq, 1);
  doc = made.doc;
  const { sheet, notes } = cuesOf(doc);
  assert.deepEqual(sheet.cast[0].clips.map((c) => c.name), [`${made.id}_c1`, `${made.id}_c2`]);
  assert.deepEqual(sheet.timeline.map((c) => c.t), [1, 3]);
  const block = doc.tracks[0].clips[0];
  assert.deepEqual(notesFor(notes, doc.tracks[0], block).map((n) => n.kind).sort(), ["cut", "in"]);
  // A left-out track says so on each of its clips.
  const v = setActor(scene(), "t1", { player: "wa", name: "V", rig: W });
  assert.deepEqual(notesFor(cuesOf(v).notes, v.tracks[0], v.tracks[0].clips[0]).map((n) => n.kind), ["player"]);
});
