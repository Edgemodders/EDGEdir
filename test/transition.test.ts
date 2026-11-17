// D4a: transitions (src/doc.ts, src/pose.ts): the method and ease, which clips one joins, the pose
// under one, and what it says about the game. Made-up names; nothing here is read from the game.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import { addAnimClip, addTrack, addTransition, EditError, formatDoc, newDoc, parseDoc, setActor, setTrack, setTransition, transitionOf, type Clip, type Track } from "../src/doc";
import { clipsNear, easeAt, joinOf, poseAt, transitionNote } from "../src/pose";

const W = "base\\made_up\\woman.rig";
const M = "base\\made_up\\man.rig";
const anim = (name: string, seconds: number, rig = W) => ({ set: "base\\made_up\\a.anims", name, rig, seconds });
const track = (clips: Clip[]): Track => ({ id: "t1", kind: "actor", name: "Ana", actor: { record: "Character.Ana", name: "Ana", entity: "a.ent", rig: W }, clips });
const near = (a: number | undefined, b: number) => assert.ok(a !== undefined && Math.abs(a - b) < 1e-6, `${a} is not ${b}`);
const A: Clip = { id: "a", kind: "anim", start: 0, length: 2, anim: anim("walk", 2) };
const B: Clip = { id: "b", kind: "anim", start: 2, length: 3, in: 0.5, anim: anim("sit", 3.5) };

test("a transition has a method and an ease; one from D1 reads as Blend, Smooth", () => {
  let doc = addTrack(newDoc("S"), "actor");
  const t = doc.tracks[0].id;
  doc = addAnimClip(addAnimClip(doc, t, anim("walk", 2), 0).doc, t, anim("sit", 3), 2).doc;
  assert.deepEqual(transitionOf({ id: "x", kind: "transition", start: 1, length: 1 }), { method: "blend", ease: "smooth" });
  assert.deepEqual(transitionOf({ id: "x", kind: "transition", start: 1, length: 1, method: "warp", ease: 3 }), { method: "blend", ease: "smooth" });

  // Add Transition goes to the start of the clip whose join is nearest: where the game makes its own.
  const made = addTransition(doc, t, 1.2);
  const tr = made.doc.tracks[0].clips.find((c) => c.id === made.id)!;
  assert.deepEqual([tr.kind, tr.start, tr.length, tr.method, tr.ease], ["transition", 2, 0.4, "blend", "smooth"]);
  // The clip's own start, though it is off the frame.
  const offFrame = addAnimClip(addAnimClip(addTrack(newDoc("S"), "actor"), "t1", anim("leap", 2.8667), 0).doc, "t1", anim("sit", 3), 2.8667).doc;
  assert.equal(offFrame.tracks[0].clips[1].start, 2.8667);
  assert.equal(addTransition(offFrame, "t1", 2.9).doc.tracks[0].clips.find((c) => c.kind === "transition")?.start, 2.8667);
  // With one clip there is no join: it goes where it was asked.
  const lone = addAnimClip(addTrack(newDoc("S"), "actor"), "t1", anim("walk", 2), 0).doc;
  assert.equal(addTransition(lone, "t1", 1.5).doc.tracks[0].clips.find((c) => c.kind === "transition")?.start, 1.5);

  doc = setTransition(made.doc, made.id, { method: "inertial" });
  doc = setTransition(doc, made.id, { ease: "out" });
  assert.deepEqual(transitionOf(parseDoc(formatDoc(doc)).tracks[0].clips.find((c) => c.id === made.id)!), { method: "inertial", ease: "out" });
  const refused = (run: () => unknown, text: RegExp) => assert.throws(run, (e: Error) => e instanceof EditError && text.test(e.message));
  refused(() => setTransition(doc, made.id, { method: "warp" }), /method is one of/);
  refused(() => setTransition(doc, made.id, { ease: "bouncy" }), /ease is one of/);
  refused(() => setTransition(doc, doc.tracks[0].clips[0].id, { method: "blend" }), /Only a transition/);
  refused(() => setTransition(setTrack(doc, t, { lock: true }), made.id, { method: "blend" }), /locked/);
});

test("the eases run from 0 to 1", () => {
  for (const e of ["smooth", "linear", "in", "out"] as const) {
    near(easeAt(e, 0), 0);
    near(easeAt(e, 1), 1);
    near(easeAt(e, 2), 1);
    near(easeAt(e, -1), 0);
  }
  near(easeAt("linear", 0.25), 0.25);
  near(easeAt("smooth", 0.5), 0.5);
  assert.ok(easeAt("in", 0.5) < 0.5 && easeAt("out", 0.5) > 0.5);
});

test("a transition joins the clip that plays before it to the next one that starts inside it", () => {
  const over: Clip = { id: "x", kind: "transition", start: 1.8, length: 0.4 };
  const t = track([A, B, over]);
  assert.deepEqual([joinOf(t, over).a?.id, joinOf(t, over).b?.id], ["a", "b"]);
  // At B's start, and ending at B's start, both join.
  assert.equal(joinOf(t, { ...over, start: 2 }).b?.id, "b");
  assert.equal(joinOf(t, { ...over, start: 1.6 }).b?.id, "b");
  // Inside one clip, or after the last: nothing starts in it.
  assert.deepEqual(joinOf(t, { ...over, start: 0.5 }), {});
  assert.equal(transitionNote(t, { ...over, start: 0.5 }).joins, false);
  // Over the first clip's start: nothing plays before it.
  const first = { ...over, start: 0 };
  assert.deepEqual([joinOf(t, first).a, joinOf(t, first).b?.id], [undefined, "a"]);
  assert.match(transitionNote(t, first).text, /no clip plays before "walk"/);
  // A clip made for another rig is not joined to: the transition reaches past it or joins nothing.
  const unfitB = track([A, { ...B, anim: anim("sit", 3.5, M) }, over]);
  assert.deepEqual(joinOf(unfitB, over), {});

  // The mark: only where the game does not make its own join.
  assert.deepEqual([transitionNote(t, { ...over, start: 2 }).mark, transitionNote(t, over).mark], [false, true]);
  assert.match(transitionNote(t, over).text, /Preview only/);
  assert.match(transitionNote(t, { ...over, start: 2 }).text, /not yet measured/);
  assert.match(transitionNote(t, { ...over, start: 2, method: "ai" }).text, /No AI provider/);
});

test("Blend: both clips play, the first going on and the second held until it starts", () => {
  const tr: Clip = { id: "x", kind: "transition", start: 1.5, length: 1, method: "blend", ease: "linear" };
  const t = track([A, B, tr]);
  // Before the transition: A alone.
  assert.equal(poseAt(t, 1.4).mix, undefined);
  // Before B starts: B held at its first pose, A at its own moment.
  let p = poseAt(t, 1.75);
  assert.equal(p.clip?.id, "b");
  near(p.t, 0.5);
  assert.equal(p.mix?.clip.id, "a");
  near(p.mix?.t, 1.75);
  near(p.mix?.share, 0.75);
  // After B starts: B plays, and A, which ended where B starts, holds its last pose. It does not wrap round to its start.
  p = poseAt(t, 2.25);
  near(p.t, 0.75);
  near(p.mix?.t, 2);
  near(p.mix?.share, 0.25);
  near(poseAt(t, 2).mix?.t, 2);
  // With a gap between them, A goes on looping through the gap and the transition.
  const later: Clip = { ...B, start: 3 };
  const gap = track([A, later, { ...tr, start: 3 }]);
  near(poseAt(gap, 3.25).mix?.t, 1.25);
  // A clip that starts a hair off the frame its transition is on (an animation's length) is still the join.
  const off = track([{ ...A, length: 2.8667, anim: anim("walk", 2.8667) }, { ...B, start: 2.8667 }, { ...tr, start: 2.866667, length: 0.4 }]);
  assert.equal(transitionNote(off, off.clips[2]).mark, false);
  near(poseAt(off, 2.9).mix?.t, 2.8667);
  // At the transition's end: B alone.
  assert.equal(poseAt(t, 2.5).mix, undefined);
  assert.equal(poseAt(t, 2.5).clip?.id, "b");
  // Both clips are loaded while the transition plays, and B ahead of it.
  assert.deepEqual(clipsNear(t, 1.75, 0).map((c) => c.name).sort(), ["sit", "walk"]);
  // Smooth is slow at both ends.
  const smooth = track([A, B, { ...tr, ease: "smooth" }]);
  assert.ok((poseAt(smooth, 1.6).mix?.share ?? 0) > 0.9);
});

test("Inertial: the second clip plays whole, and the difference at its start fades", () => {
  const tr: Clip = { id: "x", kind: "transition", start: 1.5, length: 1, method: "inertial", ease: "linear" };
  const t = track([A, B, tr]);
  // Before B starts A plays alone, though the transition has begun.
  assert.equal(poseAt(t, 1.75).mix, undefined);
  assert.equal(poseAt(t, 1.75).clip?.id, "a");
  // From B's start: B's own moment; A's pose is taken at B's start, and its share runs out at the end.
  let p = poseAt(t, 2);
  assert.equal(p.clip?.id, "b");
  near(p.t, 0.5);
  near(p.mix?.share, 1);
  near(p.mix?.start, 0.5);
  p = poseAt(t, 2.25);
  near(p.t, 0.75);
  // A ended where B starts: the pose taken is A's last, not its first.
  near(p.mix?.t, 2);
  near(p.mix?.share, 0.5);
  // A transition that ends where B starts has nothing to fade over.
  assert.equal(poseAt(track([A, B, { ...tr, start: 1, length: 1 }]), 1.5).mix, undefined);
  // AI mixes nothing: the preview cuts.
  assert.equal(poseAt(track([A, B, { ...tr, method: "ai" }]), 2.1).mix, undefined);
});

test("a scene with an actor chosen later keeps its transitions", () => {
  let doc = addTrack(newDoc("S"), "actor");
  doc = addAnimClip(addAnimClip(doc, "t1", anim("walk", 2), 0).doc, "t1", anim("sit", 3), 2).doc;
  doc = addTransition(doc, "t1", 2).doc;
  doc = setActor(doc, "t1", { record: "Character.Ana", name: "Ana", rig: W });
  assert.equal(poseAt(doc.tracks[0], 2.1).mix?.clip.id, doc.tracks[0].clips[0].id);
});
