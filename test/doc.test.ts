// D1.1: the scene document's reading, writing and edits (src/doc.ts).
import { test } from "node:test";
import * as assert from "node:assert/strict";
import {
  EditError,
  addClip,
  addTrack,
  clipEdges,
  findClip,
  fits,
  formatDoc,
  freeStart,
  moveClips,
  moveTrack,
  newDoc,
  parseDoc,
  pasteClips,
  removeClips,
  removeTrack,
  renameClip,
  sceneLength,
  setTrack,
  snap,
  splitClip,
  toFrame,
  trimClip,
  type SceneDoc,
} from "../src/doc";

/** A scene with an actor track (t1) holding clips at 0..2 (c1) and 3..5 (c2), and an audio track (t2). */
function scene(): SceneDoc {
  let doc = addTrack(addTrack(newDoc("Test"), "actor"), "audio");
  doc = addClip(doc, "t1", { start: 0, length: 2, name: "walk" }).doc;
  doc = addClip(doc, "t1", { start: 3, length: 2, name: "sit" }).doc;
  return doc;
}

const starts = (doc: SceneDoc, trackId: string) => doc.tracks.find((t) => t.id === trackId)!.clips.map((c) => [c.id, c.start, c.length]);

test("a new scene goes to text and back unchanged", () => {
  const doc = scene();
  assert.deepEqual(parseDoc(formatDoc(doc)), doc);
  assert.equal(doc.edgedir, 1);
  assert.equal(doc.fps, 30);
});

test("parse refuses what is not a scene, in words", () => {
  assert.throws(() => parseDoc("{"), /Not valid JSON/);
  assert.throws(() => parseDoc("[]"), /Not an EDGEdir scene/);
  assert.throws(() => parseDoc('{"edgewave":2}'), /Not an EDGEdir scene/);
  assert.throws(() => parseDoc('{"edgedir":2,"tracks":[]}'), /newer EDGEdir/);
  assert.throws(() => parseDoc('{"edgedir":1}'), /tracks are missing/);
  assert.throws(() => parseDoc('{"edgedir":1,"tracks":[{"id":"t1","kind":"prop","clips":[]}]}'), /Track 1's kind/);
  assert.throws(() => parseDoc('{"edgedir":1,"tracks":[{"id":"t1","kind":"audio","clips":[{"id":"t1","kind":"audio","start":0,"length":1}]}]}'), /already taken/);
  assert.throws(() => parseDoc('{"edgedir":1,"tracks":[{"id":"t1","kind":"audio","clips":[{"id":"c1","kind":"anim","start":0,"length":1}]}]}'), /clip 1's kind/);
  assert.throws(() => parseDoc('{"edgedir":1,"tracks":[{"id":"t1","kind":"audio","clips":[{"id":"c1","kind":"audio","start":0,"length":0}]}]}'), /no length/);
});

test("parse fills what a short file leaves out, and sorts clips by start", () => {
  const doc = parseDoc('{"edgedir":1,"tracks":[{"id":"t1","kind":"actor","clips":[{"id":"c2","kind":"anim","start":3,"length":1},{"id":"c1","kind":"anim","start":0,"length":1}]}]}');
  assert.equal(doc.fps, 30);
  assert.equal(doc.name, "");
  assert.equal(doc.set, null);
  assert.equal(doc.tracks[0].name, "Actor");
  assert.deepEqual(doc.tracks[0].clips.map((c) => c.id), ["c1", "c2"]);
});

test("fields of later phases survive an edit", () => {
  const text = '{"edgedir":1,"later":true,"tracks":[{"id":"t1","kind":"actor","name":"A","actor":{"record":"Character.x"},"clips":[{"id":"c1","kind":"anim","start":0,"length":2,"anim":{"set":"a.anims","name":"n"},"in":0.5}]}]}';
  let doc = parseDoc(text);
  doc = moveClips(doc, ["c1"], 1);
  doc = splitClip(doc, "c1", 2).doc;
  doc = setTrack(doc, "t1", { name: "B" });
  assert.equal(doc.later, true);
  assert.deepEqual(doc.tracks[0].actor, { record: "Character.x" });
  for (const c of doc.tracks[0].clips) {
    assert.deepEqual(c.anim, { set: "a.anims", name: "n" });
    assert.equal(c.in, 0.5);
  }
});

test("tracks: add names and numbers them, set, move and remove", () => {
  let doc = addTrack(addTrack(addTrack(newDoc("T"), "actor"), "actor"), "weather");
  assert.deepEqual(doc.tracks.map((t) => [t.id, t.name]), [["t1", "Actor"], ["t2", "Actor 2"], ["t3", "Weather"]]);
  doc = setTrack(doc, "t2", { name: " Judy ", mute: true, lock: true });
  assert.deepEqual([doc.tracks[1].name, doc.tracks[1].mute, doc.tracks[1].lock], ["Judy", true, true]);
  doc = setTrack(doc, "t2", { mute: false });
  assert.equal("mute" in doc.tracks[1], false);
  assert.throws(() => setTrack(doc, "t2", { name: " " }), EditError);
  doc = moveTrack(doc, "t3", 0);
  assert.deepEqual(doc.tracks.map((t) => t.id), ["t3", "t1", "t2"]);
  doc = removeTrack(doc, "t1");
  assert.deepEqual(doc.tracks.map((t) => t.id), ["t3", "t2"]);
  // A removed track's id is free again, and never one that is still in use.
  assert.equal(addTrack(doc, "ai").tracks[2].id, "t1");
});

test("an edit gives a new document and leaves the old one alone", () => {
  const doc = scene();
  const before = formatDoc(doc);
  moveClips(doc, ["c1"], 0.5);
  trimClip(doc, "c2", "end", 9);
  removeClips(doc, ["c1"]);
  assert.equal(formatDoc(doc), before);
});

test("add clip: on the frame, at least a frame long, and after a clip in the way", () => {
  let doc = scene();
  const a = addClip(doc, "t1", { start: 1.01, length: 0.5 });
  assert.equal(a.id, "c3");
  // 1.01 is inside c1 (0..2); the gap 2..3 takes a half second clip.
  assert.deepEqual(findClip(a.doc, "c3")!.clip.start, 2);
  doc = addClip(a.doc, "t1", { start: 2, length: 1 }).doc;
  // The gap is 0.5 now, so a second-long clip goes after c2.
  assert.equal(findClip(doc, "c4")!.clip.start, 5);
  assert.equal(findClip(addClip(doc, "t2", { start: 0.02, length: 0 }).doc, "c5")!.clip.length, toFrame(doc, 1 / 30));
  assert.throws(() => addClip(doc, "t2", { start: 0, length: 1, kind: "anim" }), /do not hold anim clips/);
  assert.throws(() => addClip(doc, "nope", { start: 0, length: 1 }), EditError);
});

test("a transition may lie over its neighbours, and nothing else may", () => {
  let doc = scene();
  doc = moveClips(doc, ["c2"], -1); // c2 at 2..4, touching c1
  const t = addClip(doc, "t1", { start: 1.8, length: 0.4, kind: "transition" });
  assert.equal(findClip(t.doc, t.id)!.clip.start, 1.8);
  const track = t.doc.tracks[0];
  assert.equal(fits(track, "anim", 1, 2), false);
  assert.equal(fits(track, "transition", 1, 2), true);
  assert.equal(fits(track, "anim", 4, 1), true);
  assert.equal(freeStart(track, "anim", 1, 1), 4);
});

test("move: along the lane, refused before 0 and onto a clip that stays", () => {
  const doc = scene();
  assert.deepEqual(starts(moveClips(doc, ["c1"], 0.5), "t1"), [["c1", 0.5, 2], ["c2", 3, 2]]);
  assert.throws(() => moveClips(doc, ["c1"], -0.1), /before 0/);
  assert.throws(() => moveClips(doc, ["c1"], 2), /in the way/);
  // Both together keep their gap, so neither is in the other's way.
  assert.deepEqual(starts(moveClips(doc, ["c1", "c2"], 2), "t1"), [["c1", 2, 2], ["c2", 5, 2]]);
  // A clip may jump over another to a free place, and the lane stays sorted.
  assert.deepEqual(starts(moveClips(doc, ["c1"], 6), "t1"), [["c2", 3, 2], ["c1", 6, 2]]);
});

test("move to another track: the same kind only", () => {
  let doc = addTrack(scene(), "actor"); // t3
  doc = addClip(doc, "t3", { start: 0, length: 1 }).doc; // c3 at 0..1
  assert.throws(() => moveClips(doc, ["c1"], 0, "t2"), /do not go on audio tracks/);
  assert.throws(() => moveClips(doc, ["c1"], 0, "t3"), /in the way/);
  const moved = moveClips(doc, ["c1"], 1, "t3");
  assert.deepEqual(starts(moved, "t1"), [["c2", 3, 2]]);
  assert.deepEqual(starts(moved, "t3"), [["c3", 0, 1], ["c1", 1, 2]]);
  assert.throws(() => moveClips(doc, ["c1", "c3"], 0, "t2"), /several tracks/);
});

test("trim: an edge stops at 0, at its neighbour and a frame from the other edge", () => {
  const doc = scene();
  const f = 1 / 30;
  assert.deepEqual(starts(trimClip(doc, "c1", "end", 2.5), "t1")[0], ["c1", 0, 2.5]);
  assert.deepEqual(starts(trimClip(doc, "c1", "end", 9), "t1")[0], ["c1", 0, 3]);
  assert.deepEqual(starts(trimClip(doc, "c2", "start", 1), "t1")[1], ["c2", 2, 3]);
  assert.deepEqual(starts(trimClip(doc, "c1", "start", -4), "t1")[0], ["c1", 0, 2]);
  const thin = findClip(trimClip(doc, "c1", "end", -1), "c1")!.clip;
  assert.ok(Math.abs(thin.length - f) < 1e-5);
  const late = findClip(trimClip(doc, "c2", "start", 99), "c2")!.clip;
  assert.ok(Math.abs(late.start - (5 - f)) < 1e-5 && Math.abs(late.length - f) < 1e-5);
});

test("split: two parts with the same fields, not at an edge, not a transition", () => {
  const doc = scene();
  const s = splitClip(doc, "c1", 0.5);
  assert.deepEqual(starts(s.doc, "t1"), [["c1", 0, 0.5], [s.id, 0.5, 1.5], ["c2", 3, 2]]);
  assert.equal(findClip(s.doc, s.id)!.clip.name, "walk");
  assert.throws(() => splitClip(doc, "c1", 0), /not inside/);
  assert.throws(() => splitClip(doc, "c1", 2), /not inside/);
  const t = addClip(doc, "t1", { start: 1.5, length: 1, kind: "transition" });
  assert.throws(() => splitClip(t.doc, t.id, 2), /transition/);
});

test("remove, rename and the scene's length", () => {
  let doc = scene();
  assert.equal(sceneLength(doc), 5);
  assert.equal(sceneLength(newDoc("empty")), 0);
  doc = renameClip(doc, "c1", " run ");
  assert.equal(findClip(doc, "c1")!.clip.name, "run");
  assert.equal("name" in findClip(renameClip(doc, "c1", ""), "c1")!.clip, false);
  doc = removeClips(doc, ["c2", "gone"]);
  assert.deepEqual(starts(doc, "t1"), [["c1", 0, 2]]);
  assert.equal(sceneLength(doc), 2);
});

test("paste: copies with new ids, keeping their spacing where there is room", () => {
  const doc = scene();
  const copied = doc.tracks[0].clips;
  const p = pasteClips(doc, "t1", copied, 6);
  assert.deepEqual(p.ids, ["c3", "c4"]);
  assert.deepEqual(starts(p.doc, "t1"), [["c1", 0, 2], ["c2", 3, 2], ["c3", 6, 2], ["c4", 9, 2]]);
  // Pasted where clips are: each copy goes to the first free time.
  assert.deepEqual(starts(pasteClips(doc, "t1", [copied[0]], 0).doc, "t1").map((c) => c[1]), [0, 3, 5]);
  assert.throws(() => pasteClips(doc, "t2", copied, 0), /do not hold anim clips/);
});

test("a locked track refuses changes to its clips", () => {
  const doc = setTrack(scene(), "t1", { lock: true });
  assert.throws(() => addClip(doc, "t1", { start: 9, length: 1 }), /locked/);
  assert.throws(() => moveClips(doc, ["c1"], 0.1), /locked/);
  assert.throws(() => trimClip(doc, "c1", "end", 1), /locked/);
  assert.throws(() => splitClip(doc, "c1", 1), /locked/);
  assert.throws(() => removeClips(doc, ["c1"]), /locked/);
  assert.throws(() => renameClip(doc, "c1", "x"), /locked/);
  assert.equal(setTrack(doc, "t1", { lock: false }).tracks[0].lock, undefined);
});

test("snap: to a near edge first, else to the frame", () => {
  const doc = scene();
  assert.deepEqual(clipEdges(doc), [0, 2, 3, 5]);
  assert.deepEqual(clipEdges(doc, ["c2"]), [0, 2]);
  assert.equal(snap(doc, 2.04, clipEdges(doc), 0.05), 2);
  assert.equal(snap(doc, 2.51, clipEdges(doc), 0.05), toFrame(doc, 2.51));
  assert.equal(toFrame(doc, 2.51), 2.5);
  assert.equal(snap(doc, -1, [], 0.05), 0);
});
