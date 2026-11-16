// The preview's rules (D3), as pure functions the page, the host and the unit tests share: which
// clip an actor plays at a time and where in its animation, where an actor stands, and the names
// the preview's files are asked for by. No VS Code, no page, no files. docs/d3-preview.md.
import { clipEnd, playOf, unfit, type Actor, type Clip, type ClipAnim, type Play, type SceneDoc, type Track } from "./doc";

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
}

/**
 * The pose of an actor track at a time. The clip under the playhead plays at `in + (time - start) ×
 * speed`, wrapped over `in` to `out`. In a gap the last clip goes on looping. A clip with no
 * animation, a transition, and a clip made for another rig are passed over.
 */
export function poseAt(track: Track, time: number): Pose {
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
  const span = play.out - play.in;
  const run = Math.max(0, time - clip.start) * play.speed;
  const t = span > 0 ? play.in + (run % span) : play.in;
  return { clip, play, t, gap: time >= clipEnd(clip) - 1e-6, ...(passed ? { passed } : {}) };
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
export function clipsNear(track: Track, time: number, ahead: number): ClipWant[] {
  const out = new Map<string, ClipWant>();
  const now = poseAt(track, time).play;
  const add = (p: Play | undefined) => {
    const w = p && clipWant(p.anim);
    if (w) out.set(clipKey(w), w);
  };
  add(now);
  for (const c of track.clips) if (c.start > time && c.start <= time + ahead && !unfit(track, c)) add(playOf(c));
  return [...out.values()];
}

/** The actor tracks that show a body: those with an actor, not muted. */
export function bodies(doc: SceneDoc): Track[] {
  return doc.tracks.filter((t) => t.kind === "actor" && !!t.actor && !t.mute);
}
