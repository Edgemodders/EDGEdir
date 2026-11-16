// D2.5 and D2.6: the clip level of the animation index (src/core/animIndex.ts) and animations on
// clips (src/doc.ts), with made-up sets. Nothing here is read from the game.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { AnimIndex, isNoSuchMethod } from "../src/core/animIndex";
import { AnimSets } from "../src/core/animSets";
import { addAnimClip, addClip, addTrack, EditError, findClip, formatDoc, newDoc, parseDoc, playLength, playOf, setActor, setPlay, splitClip, trimClip, unfit, type SceneDoc } from "../src/doc";

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), "edgedir-anim-"));
const W = "base\\made_up\\woman.rig";
const M = "base\\made_up\\man.rig";

const clip = (name: string, duration: number, type = "Normal", rootMotion: string | null = null) => ({ name, duration, frames: Math.round(duration * 30) + 1, fps: 30, type, rootMotion, buffer: "simd", joints: 10 });
const game = [
  { path: "base\\animations\\npc\\sit.anims", rig: W, clips: [clip("sit_start", 1.5), clip("sit_loop", 4, "Normal", "spline"), clip("sit_breath", 2, "Additive")], error: null },
  { path: "base\\animations\\npc\\walk.anims", rig: M, clips: [clip("walk_slow", 1.2, "Normal", "spline")], error: null },
  { path: "base\\animations\\broken.anims", rig: null, clips: null, error: "could not be read" },
  { path: "ep1\\animations\\dance.anims", rig: W, clips: [clip("dance_sit_down", 6)], error: null },
];

/** A bridge with anims.info over the made-up game, two sets a page. */
function bridge(pageSize = 2, failAt = -1) {
  const offsets: number[] = [];
  return {
    offsets,
    request: async <T>(method: string, params?: Record<string, unknown>): Promise<T> => {
      assert.equal(method, "anims.info");
      const offset = Number(params?.offset ?? 0);
      if (offset === failAt) throw new Error("the bridge went away");
      offsets.push(offset);
      return { total: game.length, offset, items: game.slice(offset, offset + pageSize) } as T;
    },
  };
}

test("the index reads every set in pages, keeps it per game, and counts what failed", async () => {
  const dir = temp();
  const index = new AnimIndex(dir);
  const b = bridge();
  assert.equal(await index.build(b, "1-1"), true);
  assert.deepEqual(b.offsets, [0, 2]);
  assert.deepEqual([index.complete, index.total, index.done, index.setsRead, index.clips, index.failed], [true, 4, 4, 3, 5, 1]);
  assert.deepEqual(index.set("BASE\\animations\\npc\\sit.anims")?.clips[1], { name: "sit_loop", seconds: 4, frames: 121, fps: 30, additive: false, rootMotion: true });
  assert.equal(index.set("base\\animations\\npc\\sit.anims")?.clips[2].additive, true);
  assert.equal(index.find("base\\animations\\npc\\walk.anims", "walk_slow")?.rig, M);
  assert.equal(index.find("base\\animations\\npc\\walk.anims", "nope"), undefined);

  const again = new AnimIndex(dir);
  assert.equal(again.load("1-1"), true);
  assert.deepEqual([again.complete, again.setsRead, again.clips, again.failed], [true, 3, 5, 1]);
  assert.deepEqual(again.set("ep1\\animations\\dance.anims"), index.set("ep1\\animations\\dance.anims"));
  assert.equal(again.load("2-2"), false);
});

test("a read that stops is picked up where it stopped; a bridge without anims.info reads nothing", async () => {
  const dir = temp();
  const index = new AnimIndex(dir);
  await assert.rejects(index.build(bridge(2, 2), "1-1"), /went away/);
  // Each page is saved as it comes, so the page read before the bridge went away is on disk.
  const fresh = new AnimIndex(dir);
  assert.equal(fresh.load("1-1"), true);
  assert.deepEqual([fresh.done, fresh.complete, fresh.clips], [2, false, 4]);
  // A run that is told to stop reads nothing more.
  const b = bridge();
  await fresh.build(b, "1-1", { stop: () => true });
  assert.deepEqual([b.offsets, fresh.done], [[], 2]);
  // The next session loads the part and goes on from set 2.
  const next = new AnimIndex(dir);
  assert.equal(next.load("1-1"), true);
  const b2 = bridge();
  await next.build(b2, "1-1");
  assert.deepEqual(b2.offsets, [2]);
  assert.deepEqual([next.complete, next.clips], [true, 5]);
  // Reading again starts from the first set.
  const b3 = bridge();
  await next.build(b3, "1-1", { again: true });
  assert.deepEqual(b3.offsets, [0, 2]);

  const old = { request: async () => Promise.reject(Object.assign(new Error("No method by the name 'anims.info' is found."), { code: -32601 })) };
  assert.equal(await new AnimIndex(temp()).build(old, "1-1"), false);
  assert.equal(isNoSuchMethod(new Error("something else")), false);
});

test("a search finds animations by words, rig and set, and counts past its limit", async () => {
  const index = new AnimIndex(temp());
  await index.build(bridge(), "1-1");
  const names = (q: Parameters<AnimIndex["search"]>[0]) => index.search(q).items.map((f) => f.clip.name);
  assert.deepEqual(names({ text: "sit" }), ["sit_start", "sit_loop", "sit_breath", "dance_sit_down"]);
  // A word the set's path has need not be in the clip's name.
  assert.deepEqual(names({ text: "npc loop" }), ["sit_loop"]);
  assert.deepEqual(names({ text: "sit", whole: true }), ["sit_start", "sit_loop", "dance_sit_down"]);
  assert.deepEqual(names({ rig: M.toUpperCase() }), ["walk_slow"]);
  assert.deepEqual(names({ rig: W, sets: ["EP1\\animations\\dance.anims"] }), ["dance_sit_down"]);
  assert.deepEqual(names({ text: "nothing here" }), []);
  const cut = index.search({ limit: 2 });
  assert.deepEqual([cut.total, cut.items.length], [5, 2]);
});

test("the file list uses the bridge's filter when it has one", async () => {
  const names = ["a\\one.anims", "a\\two.anims", "b\\three.anims"];
  const asked: unknown[] = [];
  const b = {
    list: async (q: { extension?: string; offset?: number }) => {
      asked.push(q.extension);
      return { total: names.length, items: names.slice(q.offset ?? 0, (q.offset ?? 0) + 2).map((name) => ({ hash: "0", name, size: 1, archive: "x" })) };
    },
  };
  const notes: string[] = [];
  const sets = new AnimSets(temp());
  await sets.build(b, "1-1", (t) => notes.push(t));
  assert.deepEqual(sets.sets, names);
  assert.deepEqual(asked, [".anims", ".anims"]);
  assert.match(notes[0], /^Animation files: 2 of 3$/);
});

const sit = { set: "base\\animations\\npc\\sit.anims", name: "sit_loop", rig: W, seconds: 4 };
function scene(): { doc: SceneDoc; track: string } {
  const doc = setActor(addTrack(newDoc("S"), "actor"), "t1", { record: "Character.Ana", name: "Ana", rig: W });
  return { doc, track: doc.tracks[0].id };
}

test("an animation becomes a clip of its true length, after what is there", () => {
  const { doc, track } = scene();
  const a = addAnimClip(doc, track, sit, 0);
  const b = addAnimClip(a.doc, track, { ...sit, name: "sit_start", seconds: 1.5 }, 1);
  const clips = b.doc.tracks[0].clips;
  assert.deepEqual(clips.map((c) => [c.start, c.length]), [[0, 4], [4, 1.5]]);
  // What is as the animation was made is not written.
  assert.deepEqual(Object.keys(clips[0]).sort(), ["anim", "id", "kind", "length", "start"]);
  assert.deepEqual(playOf(clips[0]), { anim: sit, in: 0, out: 4, speed: 1, loops: 1 });
  assert.equal(playOf(addClip(doc, track, { start: 0, length: 1 }).doc.tracks[0].clips[0]), undefined);
  assert.equal(playLength({ in: 1, out: 3, speed: 2, loops: 3 }), 3);

  const audio = addTrack(doc, "audio");
  assert.throws(() => addAnimClip(audio, audio.tracks[1].id, sit, 0), /goes on an actor track/);
  assert.throws(() => addAnimClip(doc, track, { name: "x", seconds: 1 }, 0), /no name or no length/);
  // Saved and read again, it is the same.
  assert.deepEqual(parseDoc(formatDoc(b.doc)), b.doc);
});

test("in, out, speed and loops set the clip's length, within the animation and the room there is", () => {
  const { doc, track } = scene();
  const a = addAnimClip(doc, track, sit, 0);
  let d = setPlay(a.doc, a.id, { in: 1, out: 3 });
  assert.deepEqual([d.tracks[0].clips[0].in, d.tracks[0].clips[0].out, d.tracks[0].clips[0].length], [1, 3, 2]);
  d = setPlay(d, a.id, { speed: 2 });
  assert.equal(d.tracks[0].clips[0].length, 1);
  d = setPlay(d, a.id, { loops: 3 });
  assert.deepEqual([d.tracks[0].clips[0].loops, d.tracks[0].clips[0].length], [3, 3]);
  // Back to as made: the fields go.
  d = setPlay(d, a.id, { in: 0, out: 4, speed: 1, loops: 1 });
  assert.deepEqual(d.tracks[0].clips[0], a.doc.tracks[0].clips[0]);

  for (const [change, why] of [
    [{ out: 5 }, /runs from 0 to 4/],
    [{ in: -1 }, /runs from 0 to 4/],
    [{ in: 3.99 }, /at least a frame/],
    [{ speed: 0 }, /Speed is between/],
    [{ speed: 11 }, /Speed is between/],
    [{ loops: 1.5 }, /whole number/],
    [{ loops: 0 }, /whole number/],
  ] as const)
    assert.throws(() => setPlay(a.doc, a.id, change), (e: Error) => e instanceof EditError && why.test(e.message), JSON.stringify(change));

  // Another clip right after: the first cannot grow into it.
  const two = addAnimClip(a.doc, track, sit, 4);
  assert.throws(() => setPlay(two.doc, a.id, { loops: 2 }), /no room/);
  assert.equal(setPlay(two.doc, a.id, { speed: 2 }).tracks[0].clips[0].length, 2);
  assert.throws(() => setPlay(doc, "nope", { speed: 2 }), /no longer in the scene/);
  const block = addClip(doc, track, { start: 0, length: 1 });
  assert.throws(() => setPlay(block.doc, block.id, { speed: 2 }), /no animation yet/);
});

test("an edge trims the part played and stops at the animation's ends; a looping clip's end sets its loops", () => {
  const { doc, track } = scene();
  const a = addAnimClip(doc, track, sit, 2);
  const at = (d: SceneDoc) => {
    const c = findClip(d, a.id)!.clip;
    const p = playOf(c)!;
    return [c.start, c.length, p.in, p.out, p.loops];
  };
  // The end: shorter, then back out no further than the animation's end.
  assert.deepEqual(at(trimClip(a.doc, a.id, "end", 5)), [2, 3, 0, 3, 1]);
  assert.deepEqual(at(trimClip(a.doc, a.id, "end", 60)), [2, 4, 0, 4, 1]);
  // The start: later cuts into the animation; earlier stops where the animation starts.
  const late = trimClip(a.doc, a.id, "start", 3);
  assert.deepEqual(at(late), [3, 3, 1, 4, 1]);
  assert.deepEqual(at(trimClip(late, a.id, "start", 0)), [2, 4, 0, 4, 1]);
  // At double speed the same drag cuts twice as much of the animation.
  const fast = setPlay(a.doc, a.id, { speed: 2 });
  assert.deepEqual(at(trimClip(fast, a.id, "end", 3)), [2, 1, 0, 2, 1]);

  const looped = setPlay(a.doc, a.id, { out: 1, loops: 3 });
  assert.deepEqual(at(looped), [2, 3, 0, 1, 3]);
  assert.deepEqual(at(trimClip(looped, a.id, "end", 7.2)), [2, 5, 0, 1, 5]);
  assert.deepEqual(at(trimClip(looped, a.id, "end", 2.1)), [2, 1, 0, 1, 1]);
  // The nearest whole loop: just under two loops' length is two, not one.
  assert.deepEqual(at(trimClip(looped, a.id, "end", 3.93)), [2, 2, 0, 1, 2]);
  assert.deepEqual(at(trimClip(looped, a.id, "end", 4.4)), [2, 2, 0, 1, 2]);
  // But never into the next clip: with one starting at 6.5 there is room for four loops, not five.
  const tight = addAnimClip(looped, track, sit, 6.5).doc;
  assert.deepEqual(at(trimClip(tight, a.id, "end", 6.9)), [2, 4, 0, 1, 4]);
  assert.throws(() => trimClip(looped, a.id, "start", 3), /Set Loops to 1/);
  // A clip with no animation trims as in D1.
  const block = addClip(doc, track, { start: 0, length: 1 });
  assert.equal(trimClip(block.doc, block.id, "end", 9).tracks[0].clips[0].length, 9);
});

test("a split cuts the animation too", () => {
  const { doc, track } = scene();
  const a = addAnimClip(doc, track, sit, 1);
  const fast = setPlay(a.doc, a.id, { speed: 2 });
  const cut = splitClip(fast, a.id, 2);
  const [first, second] = cut.doc.tracks[0].clips;
  assert.deepEqual([first.start, first.length, playOf(first)!.in, playOf(first)!.out], [1, 1, 0, 2]);
  assert.deepEqual([second.start, second.length, playOf(second)!.in, playOf(second)!.out, second.id], [2, 1, 2, 4, cut.id]);
  assert.throws(() => splitClip(setPlay(a.doc, a.id, { out: 1, loops: 2 }), a.id, 1.5), /Set Loops to 1/);
});

test("a clip made for another rig is unfit; a swap to the same rig keeps every clip fit", () => {
  const { doc, track } = scene();
  const a = addAnimClip(doc, track, sit, 0);
  const b = addAnimClip(a.doc, track, { set: "base\\animations\\npc\\walk.anims", name: "walk_slow", rig: M, seconds: 1.2 }, 4);
  const t = () => b.doc.tracks[0];
  assert.equal(unfit(t(), t().clips[0]), undefined);
  assert.match(unfit(t(), t().clips[1]) ?? "", /made for the rig man; Ana's rig is woman/);
  // Another actor of the same rig, written with other slashes and case: the same clips fit.
  const swapped = setActor(b.doc, track, { record: "Character.Bo", name: "Bo", rig: "BASE/made_up/woman.rig" });
  assert.deepEqual(swapped.tracks[0].clips, t().clips);
  assert.equal(unfit(swapped.tracks[0], swapped.tracks[0].clips[0]), undefined);
  // A man: the fit turns round, and nothing is taken off the track.
  const man = setActor(b.doc, track, { record: "Character.Cy", name: "Cy", rig: M });
  assert.equal(man.tracks[0].clips.length, 2);
  assert.ok(unfit(man.tracks[0], man.tracks[0].clips[0]));
  assert.equal(unfit(man.tracks[0], man.tracks[0].clips[1]), undefined);
  // A rig not known yet is not called unfit.
  const unknown = setActor(b.doc, track, { record: "Character.Di", name: "Di" });
  assert.equal(unfit(unknown.tracks[0], unknown.tracks[0].clips[1]), undefined);
});
