// The preview's rules (D3), as pure functions the page, the host and the unit tests share: which
// clip an actor plays at a time and where in its animation, where an actor stands, and the names
// the preview's files are asked for by. No VS Code, no page, no files. docs/d3-preview.md.
import { clipEnd, playOf, seqOf, transitionOf, unfit, type Actor, type Clip, type ClipAnim, type Ease, type Method, type Play, type SceneDoc, type Track } from "./doc";

/** What an actor shows at a time. */
export interface Pose {
  /** The clip that plays; absent before the first one, where the body stands in its rest pose. */
  clip?: Clip;
  play?: Play;
  /** The moment in the animation's own seconds. */
  t: number;
  /** The playhead is past the clip's end: it goes on looping, as the game does until the next jump. */
  gap: boolean;
  /** A clip under the playhead that was passed over, because it is made for another rig. */
  passed?: Clip;
  /** A transition under the playhead that mixes another clip in (D4). */
  mix?: Mix;
}

/** What a transition adds to the pose of its second clip, B (the pose's own `clip`). */
export interface Mix {
  transition: Clip;
  method: Method;
  /** The first clip, A. */
  clip: Clip;
  play: Play;
  /**
   * Blend: the moment in A now (A goes on playing), and `share` is how much of A is left in the mix.
   * Inertial: the moment in A when B started; `share` is how much of the difference between A's
   * pose and B's pose at that moment is still added on top of B. `start` is B's moment then.
   */
  t: number;
  share: number;
  start: number;
}

/**
 * The pose of an actor track at a time. The clip under the playhead plays at `in + (time - start) ×
 * speed`, wrapped over `in` to `out`. In a gap the last clip goes on looping. A clip with no
 * animation, a transition, and a clip made for another rig are passed over.
 */
export function poseAt(lane: Track, time: number): Pose {
  const track = flat(lane);
  let clip: Clip | undefined;
  let play: Play | undefined;
  let passed: Clip | undefined;
  for (const c of track.clips) {
    if (c.start > time + 1e-6) continue;
    const p = playOf(c);
    if (!p) continue;
    if (unfit(track, c)) {
      if (time < clipEnd(c) - 1e-6) passed = c;
      continue;
    }
    if (!clip || c.start >= clip.start) {
      clip = c;
      play = p;
    }
  }
  if (!clip || !play) return { t: 0, gap: false, ...(passed ? { passed } : {}) };
  const base: Pose = { clip, play, t: momentIn(clip, play, time), gap: time >= clipEnd(clip) - 1e-6, ...(passed ? { passed } : {}) };
  return mixed(track, time, base) ?? base;
}

/** The moment in a clip's animation at a time on the timeline: its part, wrapped; held at `in` before the clip starts. */
function momentIn(clip: Clip, play: Play, time: number): number {
  const span = play.out - play.in;
  const run = Math.max(0, time - clip.start) * play.speed;
  return span > 0 ? play.in + (run % span) : play.in;
}

/**
 * A lane with its sequence blocks opened out: each block's clips and transitions at the block's
 * place, so a block plays as its clips do. The ids are the block's and the clip's, joined.
 */
export function flat(track: Track): Track {
  if (!track.clips.some((c) => c.kind === "sequence")) return track;
  const clips: Clip[] = [];
  for (const c of track.clips) {
    const seq = seqOf(c);
    if (c.kind !== "sequence") clips.push(c);
    else if (seq) for (const inner of seq.clips) if (inner.kind !== "sequence") clips.push({ ...inner, id: `${c.id}/${inner.id}`, start: inner.start + c.start });
  }
  return { ...track, clips: clips.sort((a, b) => a.start - b.start) };
}

/** A clip that plays on its track's actor: it has an animation, made for the actor's rig. */
function playable(track: Track, c: Clip): Play | undefined {
  const p = playOf(c);
  return p && !unfit(track, c) ? p : undefined;
}

/** How far a mix has gone, from 0 to 1, along an ease. */
export function easeAt(ease: Ease, u: number): number {
  const x = Math.min(1, Math.max(0, u));
  if (ease === "linear") return x;
  if (ease === "in") return x * x;
  if (ease === "out") return 1 - (1 - x) * (1 - x);
  return x * x * (3 - 2 * x);
}

/** The clips a transition joins: B is the first that starts inside it or at its end, A the one that plays before B. */
export function joinOf(track: Track, transition: Clip): { a?: Clip; b?: Clip } {
  const end = clipEnd(transition);
  const clips = flat(track).clips.filter((c) => playable(track, c));
  const b = clips.find((c) => c.start >= transition.start - 1e-6 && c.start <= end + 1e-6);
  if (!b) return {};
  let a: Clip | undefined;
  for (const c of clips) if (c.start < b.start - 1e-6 && (!a || c.start >= a.start)) a = c;
  return { a, b };
}

/**
 * What there is to say about a transition: whether it joins two clips, and whether the game will
 * play what the preview shows. `mark` is set when it will not; `text` is the inspector's sentence.
 */
export function transitionNote(track: Track, transition: Clip): { joins: boolean; mark: boolean; text: string } {
  const { a, b } = joinOf(track, transition);
  const name = (c: Clip) => c.name ?? (c.anim as { name?: string } | undefined)?.name ?? "the clip";
  if (!b) return { joins: false, mark: false, text: "This transition joins nothing: no clip with an animation that fits the actor starts inside it." };
  if (!a) return { joins: false, mark: false, text: `This transition joins nothing: no clip plays before "${name(b)}".` };
  if (transitionOf(transition).method === "ai") return { joins: true, mark: true, text: "No AI provider makes transitions yet. The preview cuts here; choose Blend or Inertial." };
  if (Math.abs(transition.start - b.start) > 1e-6)
    return { joins: true, mark: true, text: `Preview only. The game makes its own join where "${name(b)}" starts; a transition placed anywhere else reaches the game only when it can be baked into new frames (a later phase).` };
  return { joins: true, mark: false, text: `It starts where the game makes its own join. How close the game's join is to this one is not yet measured in the game.` };
}

/** The pose under a transition, or undefined when none is under the time or it mixes nothing. */
function mixed(track: Track, time: number, base: Pose): Pose | undefined {
  for (const tr of track.clips) {
    if (tr.kind !== "transition" || time < tr.start - 1e-6 || time >= clipEnd(tr) - 1e-6) continue;
    const { method, ease } = transitionOf(tr);
    if (method === "ai") continue;
    const { a, b } = joinOf(track, tr);
    const pa = a && playable(track, a);
    const pb = b && playable(track, b);
    if (!a || !b || !pa || !pb) continue;
    if (method === "blend") {
      const share = 1 - easeAt(ease, (time - tr.start) / tr.length);
      return { ...base, clip: b, play: pb, t: momentIn(b, pb, time), gap: false, mix: { transition: tr, method, clip: a, play: pa, t: momentIn(a, pa, time), share, start: pb.in } };
    }
    // Inertial: nothing before B starts, where A still plays alone.
    const room = clipEnd(tr) - b.start;
    if (time < b.start - 1e-6 || room <= 1e-6) continue;
    const share = 1 - easeAt(ease, (time - b.start) / room);
    return { ...base, clip: b, play: pb, t: momentIn(b, pb, time), gap: false, mix: { transition: tr, method, clip: a, play: pa, t: momentIn(a, pa, b.start), share, start: pb.in } };
  }
  return undefined;
}

/** What the preview loads for an actor: the entity in an appearance, or V's base body by rig. */
export interface BodyWant {
  entity?: string;
  appearance?: string;
  player?: "wa" | "ma";
  rig?: string;
}

/** What the preview loads for a clip: one animation of a game file, or a made animation by its id. */
export interface ClipWant {
  set?: string;
  id?: string;
  name: string;
}

const low = (s: string | undefined) => (s ?? "").replace(/\//g, "\\").toLowerCase();

/** An actor's body, or undefined when there is nothing to load yet (no entity read, or V's rig not known). */
export function bodyWant(actor: Actor | undefined): BodyWant | undefined {
  if (!actor) return undefined;
  if (actor.player) return actor.rig ? { player: actor.player, rig: actor.rig } : undefined;
  // A sequence's stand-in: the game's base body for its rig, as V's is.
  if (actor.standIn) return actor.rig ? { player: "wa", rig: actor.rig as string } : undefined;
  if (!actor.entity) return undefined;
  return { entity: actor.entity, ...(actor.appearance ? { appearance: actor.appearance } : {}) };
}

export const bodyKey = (w: BodyWant) => (w.player ? `v|${low(w.rig)}` : `e|${low(w.entity)}|${low(w.appearance)}`);

export function clipWant(anim: ClipAnim): ClipWant | undefined {
  if (anim.id) return { id: anim.id, name: anim.name };
  if (anim.set) return { set: anim.set, name: anim.name };
  return undefined;
}

export const clipKey = (w: ClipWant) => (w.id ? `m|${w.id}` : `a|${low(w.set)}|${w.name}`);

/**
 * The clips an actor track will show soon: the one at the time, and those that start within `ahead`
 * seconds, so they are loaded before the playhead reaches them.
 */
export function clipsNear(lane: Track, time: number, ahead: number): ClipWant[] {
  const track = flat(lane);
  const out = new Map<string, ClipWant>();
  const now = poseAt(track, time).play;
  const add = (p: Play | undefined) => {
    const w = p && clipWant(p.anim);
    if (w) out.set(clipKey(w), w);
  };
  add(now);
  add(poseAt(track, time).mix?.play);
  for (const c of track.clips) if (c.start > time && c.start <= time + ahead && !unfit(track, c)) add(playOf(c));
  return [...out.values()];
}

/** The actor tracks that show a body: those with an actor, not muted. */
export function bodies(doc: SceneDoc): Track[] {
  return doc.tracks.filter((t) => t.kind === "actor" && !!t.actor && !t.mute);
}
