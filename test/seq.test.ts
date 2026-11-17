// D4b: sequences (src/seq.ts, the block in src/doc.ts, src/pose.ts's opening out, the Desk's
// items), with made-up names in temporary folders. Nothing here is read from the game.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { deskSequence, listDesk, newScene, newSequence, renameScene } from "../src/desk";
import {
  addAnimClip,
  addSeqClip,
  addTrack,
  addTransition,
  EditError,
  formatDoc,
  linkState,
  newDoc,
  parseDoc,
  refreshSeqs,
  replaceWithSeq,
  runOf,
  seqDiffers,
  seqOf,
  setActor,
  setTrack,
  splitClip,
  trimClip,
  unfit,
  unpackSeq,
  type Clip,
  type SeqRef,
} from "../src/doc";
import { bodyWant, flat, joinOf, poseAt } from "../src/pose";
import { formatSeq, isSeqFile, newSeq, parseSeq, readScene, runLength, sceneAsSeq, seqAsScene, SeqTrack, writeScene } from "../src/seq";

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), "edgedir-seq-"));
const W = "base\\made_up\\woman.rig";
const M = "base\\made_up\\man.rig";
const anim = (name: string, seconds: number, rig = W) => ({ set: "base\\made_up\\a.anims", name, rig, seconds });
const near = (a: number | undefined, b: number) => assert.ok(a !== undefined && Math.abs(a - b) < 1e-6, `${a} is not ${b}`);
const refused = (run: () => unknown, text: RegExp) => assert.throws(run, (e: Error) => e instanceof EditError && text.test(e.message));

/** A run of two clips with a transition at the join: 2 s then 3 s. */
const run: Clip[] = [
  { id: "c1", kind: "anim", start: 0, length: 2, anim: anim("walk", 2) },
  { id: "c2", kind: "anim", start: 2, length: 3, anim: anim("sit", 3) },
  { id: "c3", kind: "transition", start: 2, length: 0.4, method: "blend", ease: "linear" },
];
const ref = (clips = run, name = "walk and sit"): SeqRef => ({ id: "seq-1", name, rig: W, clips });

test("a sequence goes to text and back, and reads as a scene with one lane and a stand-in body", () => {
  const seq = newSeq("walk and sit", W, run);
  assert.deepEqual(parseSeq(formatSeq(seq)), seq);
  near(runLength(run), 5);
  const scene = seqAsScene(seq);
  assert.deepEqual([scene.name, scene.tracks.length, scene.tracks[0].id, scene.tracks[0].kind], ["walk and sit", 1, SeqTrack, "actor"]);
  // The stand-in is the base body for the rig, asked for as V's is.
  assert.deepEqual(bodyWant(scene.tracks[0].actor), { player: "wa", rig: W });
  assert.equal(poseAt(scene.tracks[0], 2.1).mix?.clip.id, "c1");
  // An edit to the scene view comes back as the sequence, with fields this version does not know kept.
  const edited = addAnimClip(scene, SeqTrack, anim("lean", 1), 5).doc;
  const back = sceneAsSeq(edited, { ...seq, later: 7 });
  assert.deepEqual([back.clips.length, back.rig, back.later, back.edgeseq], [4, W, 7, 1]);

  assert.equal(isSeqFile("a\\B.EDGESEQ"), true);
  assert.equal(readScene("x.edgeseq", formatSeq(seq)).tracks[0].clips.length, 3);
  assert.equal(readScene("x.edgedir", formatDoc(newDoc("S"))).tracks.length, 0);
  assert.equal(parseSeq(writeScene("x.edgeseq", edited, formatSeq(seq))).clips.length, 4);
  assert.equal(parseDoc(writeScene("x.edgedir", edited, "")).tracks.length, 1);

  assert.throws(() => parseSeq("{"), /Not valid JSON/);
  assert.throws(() => parseSeq('{"edgedir":1,"tracks":[]}'), /Not an EDGEdir sequence/);
  assert.throws(() => parseSeq('{"edgeseq":2,"clips":[]}'), /newer EDGEdir/);
  assert.throws(() => parseSeq('{"edgeseq":1}'), /clips are missing/);
  assert.throws(() => parseSeq(JSON.stringify({ edgeseq: 1, clips: [{ id: "c1", kind: "sequence", start: 0, length: 1 }] })), /cannot hold another sequence/);
  assert.throws(() => parseSeq(JSON.stringify({ edgeseq: 1, clips: [{ id: "c1", kind: "anim", start: -1, length: 1 }] })), /no start/);
});

test("a sequence is one block on a lane: as long as its clips, not trimmed or split, and unpacked into them", () => {
  let doc = setActor(addTrack(addTrack(newDoc("S"), "actor"), "audio"), "t1", { record: "Character.Ana", name: "Ana", rig: W });
  doc = addAnimClip(doc, "t1", anim("wave", 1), 0).doc;
  const made = addSeqClip(doc, "t1", ref(), 0.5);
  doc = made.doc;
  const block = doc.tracks[0].clips.find((c) => c.id === made.id)!;
  // It starts after the clip in its way, and is the run's length.
  assert.deepEqual([block.kind, block.start, block.length, seqOf(block)?.name], ["sequence", 1, 5, "walk and sit"]);
  assert.equal(seqOf(doc.tracks[0].clips[0]), undefined);
  assert.equal(parseDoc(formatDoc(doc)).tracks[0].clips[1].kind, "sequence");
  refused(() => trimClip(doc, made.id, "end", 3), /as long as its sequence/);
  refused(() => splitClip(doc, made.id, 2), /cannot be split/);
  refused(() => addSeqClip(doc, "t2", ref(), 0), /actor track/);
  refused(() => addSeqClip(doc, "t1", ref([]), 0), /no clips yet/);
  // The rig rule holds for a block.
  assert.equal(unfit(doc.tracks[0], block), undefined);
  assert.match(unfit({ ...doc.tracks[0], actor: { record: "Character.Bo", name: "Bo", rig: M } }, block) ?? "", /This sequence is made for the rig woman; Bo's rig is man/);

  const out = unpackSeq(doc, made.id);
  const lane = out.doc.tracks[0].clips;
  assert.deepEqual(lane.map((c) => `${c.kind}@${c.start}`), ["anim@0", "anim@1", "anim@3", "transition@3"]);
  assert.equal(new Set(lane.map((c) => c.id)).size, 4);
  assert.equal(out.ids.length, 3);
  refused(() => unpackSeq(doc, doc.tracks[0].clips[0].id), /not a sequence block/);
  refused(() => unpackSeq(setTrack(doc, "t1", { lock: true }), made.id), /locked/);
});

test("the preview plays a block as its clips, and a transition joins a block to its neighbours", () => {
  let doc = setActor(addTrack(newDoc("S"), "actor"), "t1", { record: "Character.Ana", name: "Ana", rig: W });
  doc = addSeqClip(doc, "t1", ref(), 1).doc;
  doc = addAnimClip(doc, "t1", anim("lean", 2), 6).doc;
  const lane = doc.tracks[0];
  assert.deepEqual(flat(lane).clips.map((c) => `${c.kind}@${c.start}`), ["anim@1", "anim@3", "transition@3", "anim@6"]);
  // Before the block: the rest pose. Inside: its clips at their own moments, and its own transition.
  assert.equal(poseAt(lane, 0.5).clip, undefined);
  near(poseAt(lane, 2).t, 1);
  const p = poseAt(lane, 3.2);
  assert.equal((p.clip?.anim as { name: string }).name, "sit");
  assert.equal((p.mix?.clip.anim as { name: string }).name, "walk");
  near(p.mix?.share, 0.5);
  // A transition at the next clip's start joins the block's last clip to it.
  doc = addTransition(doc, "t1", 6).doc;
  const tr = doc.tracks[0].clips.find((c) => c.kind === "transition")!;
  const join = joinOf(doc.tracks[0], tr);
  assert.deepEqual([(join.a?.anim as { name: string }).name, (join.b?.anim as { name: string }).name], ["sit", "lean"]);
  // A lane with no block is itself.
  assert.equal(flat(seqAsScene(newSeq("x", W, run)).tracks[0]).clips.length, 3);
});

test("a linked block takes the sequence as it is now, unless its new length has no room", () => {
  let doc = setActor(addTrack(addTrack(newDoc("S"), "actor"), "actor"), "t1", { record: "Character.Ana", name: "Ana", rig: W });
  doc = addSeqClip(doc, "t1", ref(), 0).doc;
  doc = addAnimClip(doc, "t1", anim("lean", 2), 5).doc;
  doc = addSeqClip(doc, "t2", ref(), 0).doc;
  // The same sequence: nothing to do, and the document is the same one.
  assert.deepEqual([refreshSeqs(doc, ref()).updated, refreshSeqs(doc, ref()).doc === doc], [0, true]);
  // Shorter: both blocks follow.
  const shorter = ref(run.slice(0, 1), "walk only");
  assert.equal(seqDiffers(doc.tracks[0].clips[0], shorter), true);
  const a = refreshSeqs(doc, shorter);
  assert.deepEqual([a.updated, a.blocked], [2, 0]);
  assert.deepEqual(a.doc.tracks.map((t) => [t.clips[0].length, seqOf(t.clips[0])?.name]), [[2, "walk only"], [2, "walk only"]]);
  // Longer: the first lane's block has a clip in its way and keeps its copy; the second follows.
  const longer = ref([...run, { id: "c4", kind: "anim", start: 5, length: 2, anim: anim("stand", 2) }]);
  const b = refreshSeqs(doc, longer);
  assert.deepEqual([b.updated, b.blocked], [1, 1]);
  // How each block stands: by the block, not by the sequence.
  assert.deepEqual(doc.tracks.map((t) => linkState(t, t.clips[0], longer)), ["blocked", "newer"]);
  assert.deepEqual(b.doc.tracks.map((t) => linkState(t, t.clips[0], longer)), ["blocked", "linked"]);
  assert.equal(linkState(doc.tracks[0], doc.tracks[0].clips[0], undefined), "missing");
  assert.equal(linkState(doc.tracks[0], doc.tracks[0].clips[0], ref()), "linked");
  // A block held back for room still takes the sequence's new name.
  const named = refreshSeqs(doc, { ...longer, name: "renamed" });
  assert.deepEqual(named.doc.tracks.map((t) => [seqOf(t.clips[0])?.name, t.clips[0].length]), [["renamed", 5], ["renamed", 7]]);
  assert.deepEqual(b.doc.tracks.map((t) => t.clips[0].length), [5, 7]);
  assert.equal(seqDiffers(b.doc.tracks[0].clips[0], longer), true);
  // Another sequence's blocks, and locked tracks, are left alone.
  assert.equal(refreshSeqs(doc, { ...shorter, id: "other" }).updated, 0);
  assert.equal(refreshSeqs(setTrack(doc, "t2", { lock: true }), shorter).updated, 1);
});

test("Save as Sequence takes the picked clips and the transitions between them, starting at 0", () => {
  let doc = setActor(addTrack(addTrack(newDoc("S"), "actor"), "actor"), "t1", { record: "Character.Ana", name: "Ana", rig: W });
  const ids: string[] = [];
  for (const [name, at] of [["wave", 0], ["walk", 2], ["sit", 4.5], ["lean", 8]] as const) {
    const made = addAnimClip(doc, "t1", anim(name, 2), at);
    doc = made.doc;
    ids.push(made.id);
  }
  doc = addTransition(doc, "t1", 2).doc; // into walk: before the run
  doc = addTransition(doc, "t1", 4.5).doc; // into sit: inside it
  doc = addTransition(doc, "t1", 8).doc; // into lean: after it
  const picked = runOf(doc, [ids[1], ids[2]]);
  // walk at 2 becomes 0; the gap before sit is kept; the transition at walk's own start comes too, the one after does not.
  assert.deepEqual(picked.clips.map((c) => `${c.kind}@${c.start}`), ["anim@0", "transition@0", "anim@2.5", "transition@2.5"]);
  assert.deepEqual([picked.trackId, picked.start, picked.rig, picked.ids.length], ["t1", 2, W, 4]);
  refused(() => runOf(doc, []), /Select the animation clips/);
  refused(() => runOf(doc, [doc.tracks[0].clips.find((c) => c.kind === "transition")!.id]), /Select the animation clips/);
  const other = addAnimClip(doc, "t2", anim("far", 1), 0);
  refused(() => runOf(other.doc, [ids[0], other.id]), /on one track/);

  // Replaced: the block stands where the run was, and plays the same.
  const seq: SeqRef = { id: "seq-9", name: "walk, sit", rig: picked.rig, clips: picked.clips };
  const swapped = replaceWithSeq(doc, picked.ids, picked.trackId, picked.start, seq);
  const lane = swapped.doc.tracks[0];
  assert.deepEqual(lane.clips.filter((c) => c.kind !== "transition").map((c) => `${c.kind}@${c.start}+${c.length}`), ["anim@0+2", "sequence@2+4.5", "anim@8+2"]);
  for (const t of [2.2, 3.5, 4.2, 4.7, 6]) {
    const [before, after] = [poseAt(doc.tracks[0], t), poseAt(lane, t)];
    assert.equal((after.clip?.anim as { name: string }).name, (before.clip?.anim as { name: string }).name, `at ${t}`);
    near(after.t, before.t);
    near(after.mix?.share ?? -1, before.mix?.share ?? -1);
  }
  refused(() => runOf(swapped.doc, [swapped.id, ids[0]]), /cannot hold another sequence/);
});

test("the Desk keeps sequences beside its scenes", () => {
  const base = temp();
  newScene("A scene", base);
  const item = newSequence("Walk and sit", newSeq("x", W, run), base);
  assert.deepEqual([item.kind, path.basename(item.folder), path.basename(item.file)], ["sequence", "Walk and sit.sequence.asset", "Walk and sit.edgeseq"]);
  const asset = JSON.parse(fs.readFileSync(path.join(item.folder, "asset.json"), "utf8"));
  assert.deepEqual([asset.kind, asset.main, asset.name], ["sequence", "source/raw/edgedir/Walk and sit.edgeseq", "Walk and sit"]);
  // The file is named as the item is.
  assert.equal(parseSeq(fs.readFileSync(item.file, "utf8")).name, "Walk and sit");
  assert.deepEqual(listDesk(base).map((s) => `${s.kind}:${s.name}`).sort(), ["act:A scene", "sequence:Walk and sit"]);
  assert.throws(() => newSequence("Walk and sit", newSeq("x", W), base), /already has a sequence/);
  // A scene and a sequence may share a name.
  newSequence("A scene", newSeq("x", W), base);

  assert.equal(deskSequence(item.id, base)?.seq.clips.length, 3);
  assert.equal(deskSequence("nope", base), undefined);
  const renamed = renameScene(item, "Sit down", base);
  assert.deepEqual([renamed.kind, renamed.id, path.basename(renamed.file)], ["sequence", item.id, "Sit down.edgeseq"]);
  assert.equal(deskSequence(item.id, base)?.seq.name, "Sit down");
  assert.equal(deskSequence(item.id, base)?.item.name, "Sit down");
});
