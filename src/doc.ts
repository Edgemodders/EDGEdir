// The scene document (`<name>.edgedir`): its shape, reading and writing it, and every edit the
// timeline makes, as pure functions that give a new document. No VS Code and no page in here: the
// host, the page and the unit tests all use it. The shape is docs/design.md's "The scene document";
// what D1 edits and what it only keeps is docs/d1-timeline.md's "The document in D1".
//
// Times are seconds. Fields this version does not know are kept as they are, so a file written by a
// later EDGEdir is not damaged by an edit here.

export const Extension = ".edgedir";

/** The document version this build writes. */
export const Version = 1;

export const TrackKinds = ["actor", "audio", "camera", "weather", "script", "video", "ai"] as const;
export type TrackKind = (typeof TrackKinds)[number];

/** What a clip on an actor track is; on any other track a clip's kind is the track's. */
export type ClipKind = TrackKind | "anim" | "transition" | "sequence";

export interface Clip {
  id: string;
  kind: ClipKind;
  /** Where the clip starts on the timeline. */
  start: number;
  /** How long it lasts on the timeline. */
  length: number;
  name?: string;
  /** Fields of later phases (anim, in, out, method, ...), kept untouched. */
  [more: string]: unknown;
}

/** The animation an `anim` clip plays (D2). The rig and length are copied in, so a scene opens and checks its rigs without the game. */
export interface ClipAnim {
  /** A game animation: its `.anims` file's game path. */
  set?: string;
  /** A made animation: its item's id (EDGEfab's, in the open project or the Library). */
  id?: string;
  /** The animation's name in its set. */
  name: string;
  /** The rig it is made for, a game path. */
  rig?: string;
  /** How long the whole animation is. */
  seconds: number;
  [more: string]: unknown;
}

/** How an `anim` clip plays its animation, with what the document leaves out filled in. */
export interface Play {
  anim: ClipAnim;
  /** The part played, in the animation's own seconds. */
  in: number;
  out: number;
  /** 1 is as made. */
  speed: number;
  /** How many times the part is played. */
  loops: number;
}

/** Who acts on an actor track (D2): one of the game's characters, or V, the player. */
export interface Actor {
  /** The TweakDB record, such as `Character.Judy`. Absent on V. */
  record?: string;
  /** V's body: feminine (`wa`) or masculine (`ma`). Absent on everyone else. */
  player?: "wa" | "ma";
  /** The name shown, as it was when the actor was picked. */
  name?: string;
  /** One of the entity's appearances; absent when the game picks. */
  appearance?: string;
  /** The entity file and the body's rig, read from the game when the actor was picked. */
  entity?: string;
  rig?: string;
  /** Where the actor stands (D3). Absent: placed by the track's order. */
  at?: Mark;
  [more: string]: unknown;
}

/** Where an actor stands and which way it faces: metres from the scene's origin, and degrees. */
export interface Mark {
  x: number;
  y: number;
  yaw: number;
}

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  /** On an actor track: who acts. Absent until one is chosen. */
  actor?: Actor;
  mute?: boolean;
  lock?: boolean;
  clips: Clip[];
  [more: string]: unknown;
}

export interface SceneDoc {
  edgedir: 1;
  name: string;
  /** Frames a second: what clip edges snap to. */
  fps: number;
  /** The scene's origin in the world (D5). */
  /** `player`: in front of V. `set`: where the scene's set is (D5a). */
  anchor: { mode: "player" | "world" | "set"; [more: string]: unknown };
  /** An EDGEbuilder scene the scene plays on (D5), or none. */
  set: unknown;
  tracks: Track[];
  [more: string]: unknown;
}

/** An edit the document's rules refuse, with a message fit to show. */
export class EditError extends Error {}

/** Two times closer than this are the same time. */
const Eps = 1e-6;
const round = (t: number) => Math.round(t * 1e6) / 1e6;

export const TrackKindNames: Record<TrackKind, string> = {
  actor: "Actor",
  audio: "Audio",
  camera: "Camera",
  weather: "Weather",
  script: "Script",
  video: "Video",
  ai: "AI",
};

/** A new scene with no tracks. */
export function newDoc(name: string): SceneDoc {
  return { edgedir: 1, name, fps: 30, anchor: { mode: "player", distance: 3 }, set: null, tracks: [] };
}

const isNumber = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** A document from its text; throws with a readable message when it is not one. */
export function parseDoc(text: string): SceneDoc {
  let d: unknown;
  try {
    d = JSON.parse(text);
  } catch (e) {
    throw new Error(`Not valid JSON: ${(e as Error).message}`);
  }
  const doc = d as Partial<SceneDoc> | null;
  if (!doc || typeof doc !== "object" || Array.isArray(doc) || !isNumber(doc.edgedir)) throw new Error('Not an EDGEdir scene ("edgedir": 1 is missing)');
  if (doc.edgedir > Version) throw new Error(`This scene was made by a newer EDGEdir (document version ${doc.edgedir}; this one reads ${Version}). Update EDGEdir to open it`);
  if (doc.edgedir !== 1) throw new Error(`Not an EDGEdir scene ("edgedir": ${doc.edgedir} is not a version)`);
  if (!Array.isArray(doc.tracks)) throw new Error("The scene's tracks are missing");
  if (typeof doc.name !== "string") doc.name = "";
  if (!isNumber(doc.fps) || doc.fps <= 0) doc.fps = 30;
  if (!doc.anchor || typeof doc.anchor !== "object") doc.anchor = { mode: "player", distance: 3 };
  if (doc.set === undefined) doc.set = null;
  const ids = new Set<string>();
  const once = (id: string, what: string) => {
    if (ids.has(id)) throw new Error(`${what} uses the id "${id}", which is already taken`);
    ids.add(id);
  };
  doc.tracks.forEach((t, i) => {
    const what = `Track ${i + 1}`;
    if (!t || typeof t !== "object" || typeof t.id !== "string" || !t.id) throw new Error(`${what} has no id`);
    once(t.id, what);
    if (!TrackKinds.includes(t.kind)) throw new Error(`${what}'s kind is missing or not one of ${TrackKinds.join(", ")}`);
    if (typeof t.name !== "string") t.name = TrackKindNames[t.kind];
    if (!Array.isArray(t.clips)) throw new Error(`${what}'s clips are missing`);
    if (t.actor !== undefined && (t.kind !== "actor" || !t.actor || typeof t.actor !== "object" || Array.isArray(t.actor))) throw new Error(`${what}'s actor is not one this version reads`);
    t.clips.forEach((c, j) => {
      const which = `${what}'s clip ${j + 1}`;
      if (!c || typeof c !== "object" || typeof c.id !== "string" || !c.id) throw new Error(`${which} has no id`);
      once(c.id, which);
      if (!isNumber(c.start) || c.start < 0) throw new Error(`${which} has no start, or one before 0`);
      if (!isNumber(c.length) || c.length <= 0) throw new Error(`${which} has no length, or none above 0`);
      if (!clipKinds(t.kind).includes(c.kind)) throw new Error(`${which}'s kind is missing or not one of ${clipKinds(t.kind).join(", ")}`);
    });
    t.clips.sort((a, b) => a.start - b.start);
  });
  return doc as SceneDoc;
}

/** The text of a document, as the editor writes it. */
export function formatDoc(doc: SceneDoc): string {
  return JSON.stringify(doc, null, 2) + "\n";
}

/** The kinds of clip a track of a kind holds; the first is what Add Clip makes. */
export function clipKinds(kind: TrackKind): ClipKind[] {
  return kind === "actor" ? ["anim", "transition", "sequence"] : [kind];
}

// ---- Time ----

/** One frame, in seconds. */
export const frame = (doc: SceneDoc) => round(1 / doc.fps);

/** A time on the nearest frame. */
export function toFrame(doc: SceneDoc, t: number): number {
  return round(Math.round(t * doc.fps) / doc.fps);
}

/** Where a clip ends. */
export const clipEnd = (c: Clip) => round(c.start + c.length);

/** The scene's length: the end of its last clip. */
export function sceneLength(doc: SceneDoc): number {
  let end = 0;
  for (const t of doc.tracks) for (const c of t.clips) end = Math.max(end, clipEnd(c));
  return end;
}

/** Every clip edge in the scene, sorted, without the clips named: what a dragged edge snaps to. */
export function clipEdges(doc: SceneDoc, except: Iterable<string> = []): number[] {
  const skip = new Set(except);
  const edges = new Set<number>([0]);
  for (const t of doc.tracks)
    for (const c of t.clips)
      if (!skip.has(c.id)) {
        edges.add(c.start);
        edges.add(clipEnd(c));
      }
  return [...edges].sort((a, b) => a - b);
}

/** A time pulled to the nearest of `edges` when one is within `reach` seconds, else to the frame. */
export function snap(doc: SceneDoc, t: number, edges: number[], reach: number): number {
  let best: number | undefined;
  for (const e of edges) if (Math.abs(e - t) <= reach && (best === undefined || Math.abs(e - t) < Math.abs(best - t))) best = e;
  return best ?? toFrame(doc, Math.max(0, t));
}

// ---- Finding ----

export function findTrack(doc: SceneDoc, trackId: string): Track | undefined {
  return doc.tracks.find((t) => t.id === trackId);
}

/** A clip and the track it is on. */
export function findClip(doc: SceneDoc, clipId: string): { track: Track; clip: Clip } | undefined {
  for (const track of doc.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { track, clip };
  }
  return undefined;
}

function nextId(doc: SceneDoc, prefix: "t" | "c", taken: Set<string> = new Set()): string {
  for (const t of doc.tracks) {
    taken.add(t.id);
    for (const c of t.clips) taken.add(c.id);
  }
  let n = 1;
  while (taken.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

/** An id no track or clip in the document has yet. */
export const nextTrackId = (doc: SceneDoc) => nextId(doc, "t");
export const nextClipId = (doc: SceneDoc) => nextId(doc, "c");

// ---- The overlap rule ----

/** Two clips on one track may share time only when one of them is a transition. */
const mayOverlap = (a: ClipKind, b: ClipKind) => a === "transition" || b === "transition";

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd - Eps && bStart < aEnd - Eps;

/** Whether a clip of a kind fits on a track at a time, leaving the clips named out of the count. */
export function fits(track: Track, kind: ClipKind, start: number, length: number, except: Iterable<string> = []): boolean {
  if (start < -Eps || length <= 0) return false;
  const skip = new Set(except);
  return !track.clips.some((c) => !skip.has(c.id) && !mayOverlap(kind, c.kind) && overlaps(start, start + length, c.start, clipEnd(c)));
}

/** The first time at or after `start` where a clip of a kind and length fits on a track. */
export function freeStart(track: Track, kind: ClipKind, start: number, length: number, except: Iterable<string> = []): number {
  let at = Math.max(0, start);
  const skip = new Set(except);
  const sorted = track.clips.filter((c) => !skip.has(c.id) && !mayOverlap(kind, c.kind)).sort((a, b) => a.start - b.start);
  for (const c of sorted) if (overlaps(at, at + length, c.start, clipEnd(c))) at = clipEnd(c);
  return round(at);
}

// ---- Animations on clips (D2) ----

export const SpeedRange = [0.1, 10] as const;
export const MaxLoops = 999;

/** How a clip plays its animation; undefined for a clip that has none (a D1 block, a transition). */
export function playOf(clip: Clip): Play | undefined {
  const anim = clip.anim as ClipAnim | undefined;
  if (clip.kind !== "anim" || !anim || typeof anim !== "object" || typeof anim.name !== "string" || !isNumber(anim.seconds) || anim.seconds <= 0) return undefined;
  const from = isNumber(clip.in) ? Math.min(Math.max(clip.in, 0), anim.seconds) : 0;
  const to = isNumber(clip.out) ? Math.min(Math.max(clip.out, from), anim.seconds) : anim.seconds;
  const speed = isNumber(clip.speed) && clip.speed > 0 ? clip.speed : 1;
  const loops = isNumber(clip.loops) && clip.loops >= 1 ? Math.round(clip.loops) : 1;
  return { anim, in: from, out: to, speed, loops };
}

/** How long a clip is on the timeline for the way it plays. */
export const playLength = (p: Pick<Play, "in" | "out" | "speed" | "loops">) => round(((p.out - p.in) * p.loops) / p.speed);

/** A clip with the way it plays written in; what is as the animation was made is left out, so the text stays short. */
function withPlay(clip: Clip, p: Play): Clip {
  const next: Clip = { ...clip, anim: p.anim, length: playLength(p) };
  const put = (key: "in" | "out" | "speed" | "loops", value: number, plain: number) => {
    if (Math.abs(value - plain) < Eps) delete next[key];
    else next[key] = round(value);
  };
  put("in", p.in, 0);
  put("out", p.out, p.anim.seconds);
  put("speed", p.speed, 1);
  put("loops", p.loops, 1);
  return next;
}

/** The same path, whatever the case or the slash: game paths do not mind either. */
const samePath = (a: string, b: string) => a.replace(/\//g, "\\").toLowerCase() === b.replace(/\//g, "\\").toLowerCase();

/**
 * Why a clip does not fit its track's actor, or undefined when it does (or when either rig is not
 * known yet). The rule is strict: the same rig. EDGEdir does not retarget.
 */
export function unfit(track: Track, clip: Clip): string | undefined {
  const block = clip.kind === "sequence";
  const rig = block ? seqOf(clip)?.rig : (clip.anim as ClipAnim | undefined)?.rig;
  const actor = track.actor;
  if ((clip.kind !== "anim" && !block) || !rig || !actor?.rig || samePath(rig, actor.rig)) return undefined;
  const short = (r: string) => (r.replace(/\//g, "\\").split("\\").pop() ?? r).replace(/\.rig$/i, "");
  return `This ${block ? "sequence" : "animation"} is made for the rig ${short(rig)}; ${actor.name ?? "the actor"}'s rig is ${short(actor.rig)}`;
}

/** A game or made animation as a new clip on an actor track, at `start` or the first free time after it, at its full length. */
export function addAnimClip(doc: SceneDoc, trackId: string, anim: ClipAnim, start: number): { doc: SceneDoc; id: string } {
  if ((!anim.set && !anim.id) || !anim.name || !isNumber(anim.seconds) || anim.seconds <= 0) throw new EditError("That animation has no name or no length");
  const id = nextClipId(doc);
  const next = changeTrack(doc, trackId, (t) => {
    open(t);
    if (t.kind !== "actor") throw new EditError("An animation goes on an actor track");
    const made = withPlay({ id, kind: "anim", start: 0, length: 0 }, { anim, in: 0, out: anim.seconds, speed: 1, loops: 1 });
    made.start = freeStart(t, "anim", toFrame(doc, start), made.length);
    return { ...t, clips: sorted([...t.clips, made]) };
  });
  return { doc: next, id };
}

/** Which part of its animation a clip plays, how fast and how often. The clip keeps its start; its length follows. */
export function setPlay(doc: SceneDoc, clipId: string, change: { in?: number; out?: number; speed?: number; loops?: number }): SceneDoc {
  const f = findClip(doc, clipId);
  if (!f) throw new EditError("That clip is no longer in the scene");
  open(f.track);
  const now = playOf(f.clip);
  if (!now) throw new EditError("This clip has no animation yet");
  const p: Play = { ...now };
  for (const key of ["in", "out", "speed", "loops"] as const) {
    const v = change[key];
    if (v === undefined) continue;
    if (!isNumber(v)) throw new EditError("That is not a number");
    p[key] = v;
  }
  const least = frame(doc);
  if (p.in < 0 || p.out > p.anim.seconds + Eps) throw new EditError(`The animation runs from 0 to ${p.anim.seconds} s`);
  if (p.out - p.in < least - Eps) throw new EditError("The part played must be at least a frame long");
  if (p.speed < SpeedRange[0] || p.speed > SpeedRange[1]) throw new EditError(`Speed is between ${SpeedRange[0]} and ${SpeedRange[1]}`);
  if (!Number.isInteger(p.loops) || p.loops < 1 || p.loops > MaxLoops) throw new EditError(`Loops is a whole number from 1 to ${MaxLoops}`);
  p.out = Math.min(p.out, p.anim.seconds);
  const next = withPlay(f.clip, p);
  if (!fits(f.track, next.kind, next.start, next.length, [next.id])) throw new EditError("There is no room for that: the next clip is in the way");
  return changeTrack(doc, f.track.id, (t) => ({ ...t, clips: sorted(t.clips.map((c) => (c.id === next.id ? next : c))) }));
}

// ---- Edits: tracks ----

const withTracks = (doc: SceneDoc, tracks: Track[]): SceneDoc => ({ ...doc, tracks });

function changeTrack(doc: SceneDoc, trackId: string, change: (t: Track) => Track): SceneDoc {
  if (!findTrack(doc, trackId)) throw new EditError("That track is no longer in the scene");
  return withTracks(doc, doc.tracks.map((t) => (t.id === trackId ? change(t) : t)));
}

function open(track: Track): Track {
  if (track.lock) throw new EditError(`The track "${track.name}" is locked`);
  return track;
}

const sorted = (clips: Clip[]) => [...clips].sort((a, b) => a.start - b.start);

/** The track V acts on, if the scene has one. */
export function playerTrack(doc: SceneDoc): Track | undefined {
  return doc.tracks.find((t) => t.kind === "actor" && t.actor?.player);
}

/**
 * Who acts on an actor track, or nobody (`undefined`). The clips stay. A scene has at most one V.
 * A track still called by its kind, or by the actor it had, takes the new actor's name.
 */
export function setActor(doc: SceneDoc, trackId: string, actor: Actor | undefined): SceneDoc {
  const track = findTrack(doc, trackId);
  if (!track) throw new EditError("That track is no longer in the scene");
  if (track.kind !== "actor") throw new EditError("Only an actor track has an actor");
  if (actor) {
    if (!actor.record && !actor.player) throw new EditError("An actor is one of the game's characters, or V");
    if (actor.record && actor.player) throw new EditError("An actor is one of the game's characters or V, not both");
    const other = playerTrack(doc);
    if (actor.player && other && other.id !== trackId) throw new EditError(`V is already in this scene, on the track "${other.name}"`);
  }
  return changeTrack(doc, trackId, (t) => {
    const next = { ...t };
    const plain = t.name === TrackKindNames.actor || (t.name.startsWith(`${TrackKindNames.actor} `) && /^\d+$/.test(t.name.slice(TrackKindNames.actor.length + 1))) || (!!t.actor?.name && t.name === t.actor.name);
    if (actor) {
      // The mark is the track's place in the scene: a new actor stands where the last one stood.
      next.actor = t.actor?.at && !actor.at ? { ...actor, at: t.actor.at } : actor;
      if (plain && actor.name) next.name = actor.name;
    } else delete next.actor;
    return next;
  });
}

// ---- Transitions (D4) ----

export const Methods = ["blend", "inertial", "ai"] as const;
export type Method = (typeof Methods)[number];
export const Eases = ["smooth", "linear", "in", "out"] as const;
export type Ease = (typeof Eases)[number];

/** How a transition is made and how its mix runs. One from D1 has neither field and reads as Blend, Smooth. */
export function transitionOf(clip: Clip): { method: Method; ease: Ease } {
  const method = Methods.includes(clip.method as Method) ? (clip.method as Method) : "blend";
  const ease = Eases.includes(clip.ease as Ease) ? (clip.ease as Ease) : "smooth";
  return { method, ease };
}

/** A transition's method or ease. */
export function setTransition(doc: SceneDoc, clipId: string, change: { method?: string; ease?: string }): SceneDoc {
  const f = findClip(doc, clipId);
  if (!f) throw new EditError("That clip is no longer in the scene");
  open(f.track);
  if (f.clip.kind !== "transition") throw new EditError("Only a transition has a method");
  if (change.method !== undefined && !Methods.includes(change.method as Method)) throw new EditError(`A transition's method is one of ${Methods.join(", ")}`);
  if (change.ease !== undefined && !Eases.includes(change.ease as Ease)) throw new EditError(`A transition's ease is one of ${Eases.join(", ")}`);
  const now = transitionOf(f.clip);
  const next: Clip = { ...f.clip, method: change.method ?? now.method, ease: change.ease ?? now.ease };
  return changeTrack(doc, f.track.id, (t) => ({ ...t, clips: t.clips.map((c) => (c.id === next.id ? next : c)) }));
}

/** How long a new transition is. */
export const TransitionLength = 0.4;

/**
 * A new transition on an actor track, at the start of the clip whose join is nearest to `near`:
 * where the game makes its own join. With no join on the track it goes at `near`.
 */
export function addTransition(doc: SceneDoc, trackId: string, near: number): { doc: SceneDoc; id: string } {
  const track = findTrack(doc, trackId);
  if (!track) throw new EditError("That track is no longer in the scene");
  const clips = track.clips.filter((c) => c.kind !== "transition");
  // A join is the start of a clip that has a clip before it.
  const joins = clips.filter((c) => clips.some((o) => o.start < c.start - Eps));
  let at = Math.max(0, near);
  let length = TransitionLength;
  if (joins.length) {
    const b = joins.reduce((best, c) => (Math.abs(c.start - near) < Math.abs(best.start - near) ? c : best));
    at = b.start;
    length = Math.min(TransitionLength, b.length);
  }
  const made = addClip(doc, trackId, { start: at, length, kind: "transition" });
  // On the clip's own start, which may be a hair off the frame (an animation's length is not a whole frame).
  const placed = changeTrack(made.doc, trackId, (t) => ({ ...t, clips: sorted(t.clips.map((c) => (c.id === made.id ? { ...c, start: round(at) } : c))) }));
  return { doc: setTransition(placed, made.id, {}), id: made.id };
}

// ---- Sequence blocks (D4b) ----

/** The sequence a block on a lane plays: its id on the Desk, and a copy of it as it was when last read. */
export interface SeqRef {
  id: string;
  name: string;
  rig?: string;
  clips: Clip[];
}

/** A block's sequence, or undefined for any other clip. */
export function seqOf(clip: Clip): SeqRef | undefined {
  const s = clip.seq as Partial<SeqRef> | undefined;
  if (clip.kind !== "sequence" || !s || typeof s !== "object" || typeof s.id !== "string" || !Array.isArray(s.clips)) return undefined;
  return { id: s.id, name: typeof s.name === "string" ? s.name : "", ...(typeof s.rig === "string" && s.rig ? { rig: s.rig } : {}), clips: s.clips };
}

const runEnd = (clips: Clip[]) => clips.reduce((end, c) => Math.max(end, clipEnd(c)), 0);
const sameSeq = (a: SeqRef, b: SeqRef) => JSON.stringify([a.name, a.rig ?? "", a.clips]) === JSON.stringify([b.name, b.rig ?? "", b.clips]);

/** A sequence as one block on an actor track, at `start` or the first free time after it, as long as the sequence. */
export function addSeqClip(doc: SceneDoc, trackId: string, seq: SeqRef, start: number): { doc: SceneDoc; id: string } {
  const length = round(runEnd(seq.clips));
  if (length <= 0) throw new EditError("That sequence has no clips yet");
  const id = nextClipId(doc);
  const next = changeTrack(doc, trackId, (t) => {
    open(t);
    if (t.kind !== "actor") throw new EditError("A sequence goes on an actor track");
    if ((t.actor as Actor | undefined)?.standIn) throw new EditError("A sequence cannot hold another sequence");
    const made: Clip = { id, kind: "sequence", start: freeStart(t, "sequence", toFrame(doc, start), length), length, seq };
    return { ...t, clips: sorted([...t.clips, made]) };
  });
  return { doc: next, id };
}

/** A block turned into its clips and transitions on the lane, with no link. Gives the new ids. */
export function unpackSeq(doc: SceneDoc, clipId: string): { doc: SceneDoc; ids: string[] } {
  const f = findClip(doc, clipId);
  const seq = f && seqOf(f.clip);
  if (!f || !seq) throw new EditError("That is not a sequence block");
  open(f.track);
  const taken = new Set<string>();
  const ids: string[] = [];
  const out = seq.clips.map((c) => {
    const id = nextId(doc, "c", taken);
    taken.add(id);
    ids.push(id);
    return { ...c, id, start: round(c.start + f.clip.start) };
  });
  return { doc: changeTrack(doc, f.track.id, (t) => ({ ...t, clips: sorted([...t.clips.filter((c) => c.id !== clipId), ...out]) })), ids };
}

/**
 * Every block that links a sequence takes the sequence as it is now. A block whose new length
 * would run into the next clip keeps its copy. Locked tracks are left alone.
 */
export function refreshSeqs(doc: SceneDoc, seq: SeqRef): { doc: SceneDoc; updated: number; blocked: number; renamed: number } {
  let updated = 0;
  let blocked = 0;
  let renamed = 0;
  const length = round(runEnd(seq.clips));
  const tracks = doc.tracks.map((t) => {
    if (t.lock || !t.clips.some((c) => seqOf(c)?.id === seq.id)) return t;
    let clips = t.clips;
    for (const c of t.clips) {
      const now = seqOf(c);
      if (!now || now.id !== seq.id || sameSeq(now, seq)) continue;
      if (length <= 0 || !fits({ ...t, clips }, "sequence", c.start, length, [c.id])) {
        blocked++;
        // Held back for room: its clips stay, its name follows.
        if (now.name !== seq.name) {
          renamed++;
          clips = clips.map((x) => (x.id === c.id ? { ...x, seq: { ...now, name: seq.name } } : x));
        }
        continue;
      }
      updated++;
      clips = clips.map((x) => (x.id === c.id ? { ...x, length, seq } : x));
    }
    return clips === t.clips ? t : { ...t, clips: sorted(clips) };
  });
  return { doc: updated || renamed ? withTracks(doc, tracks) : doc, updated, blocked, renamed };
}

/**
 * How a block stands to the sequence it links: `linked` (the same), `newer` (the sequence has
 * changed, and its new length fits here), `blocked` (changed, and no room), `missing` (no sequence).
 */
export function linkState(track: Track, clip: Clip, seq: SeqRef | undefined): "linked" | "newer" | "blocked" | "missing" {
  if (!seq) return "missing";
  const now = seqOf(clip);
  if (!now || (JSON.stringify(now.clips) === JSON.stringify(seq.clips) && (now.rig ?? "") === (seq.rig ?? ""))) return "linked";
  const length = round(runEnd(seq.clips));
  return length > 0 && fits(track, "sequence", clip.start, length, [clip.id]) ? "newer" : "blocked";
}

/** Whether a block's copy differs from the sequence as it is now. */
export const seqDiffers = (clip: Clip, seq: SeqRef) => {
  const now = seqOf(clip);
  return !!now && now.id === seq.id && !sameSeq(now, seq);
};

/**
 * The clips picked on one actor track as a run for a new sequence: the animation clips, and every
 * transition that lies between the first one's start and the last one's end. The run starts at 0.
 */
export function runOf(doc: SceneDoc, clipIds: Iterable<string>): { trackId: string; start: number; rig: string; clips: Clip[]; ids: string[] } {
  const found = [...new Set(clipIds)].map((id) => findClip(doc, id)).filter((f) => !!f);
  const anims = found.filter((f) => f.clip.kind === "anim");
  if (!anims.length) throw new EditError("Select the animation clips the sequence is made of");
  const track = anims[0].track;
  if (found.some((f) => f.track.id !== track.id)) throw new EditError("A sequence is made from clips on one track");
  if (found.some((f) => f.clip.kind === "sequence")) throw new EditError("A sequence cannot hold another sequence. Unpack the block first");
  const start = Math.min(...anims.map((f) => f.clip.start));
  const end = Math.max(...anims.map((f) => clipEnd(f.clip)));
  const picked = new Set(anims.map((f) => f.clip.id));
  const run = track.clips.filter((c) => picked.has(c.id) || (c.kind === "transition" && c.start >= start - Eps && clipEnd(c) <= end + Eps));
  const rig = track.actor?.rig ?? (anims.map((f) => (f.clip.anim as ClipAnim | undefined)?.rig).find(Boolean) as string | undefined) ?? "";
  return { trackId: track.id, start, rig, clips: run.map((c) => ({ ...c, start: round(c.start - start) })), ids: run.map((c) => c.id) };
}

/** The clips a sequence was made from, replaced by the sequence's block. */
export function replaceWithSeq(doc: SceneDoc, ids: Iterable<string>, trackId: string, start: number, seq: SeqRef): { doc: SceneDoc; id: string } {
  return addSeqClip(removeClips(doc, ids), trackId, seq, start);
}

// ---- Marks (D3) ----

/** How far apart actors without a mark of their own stand. */
export const MarkGap = 0.8;
/** How far from the scene's origin a mark can be. */
export const MarkReach = 1000;

/** Where a track's actor stands: its own mark, or a place by the track's order among the actor tracks. */
export function markOf(doc: SceneDoc, trackId: string): Mark {
  const at = findTrack(doc, trackId)?.actor?.at as Partial<Mark> | undefined;
  if (at && typeof at === "object" && isNumber(at.x) && isNumber(at.y)) return { x: at.x, y: at.y, yaw: isNumber(at.yaw) ? at.yaw : 0 };
  const order = doc.tracks.filter((t) => t.kind === "actor").findIndex((t) => t.id === trackId);
  return { x: round(Math.max(0, order) * MarkGap), y: 0, yaw: 0 };
}

/** Moves or turns a track's actor. What is not named stays; the yaw is kept from 0 up to 360. */
export function setMark(doc: SceneDoc, trackId: string, change: Partial<Mark>): SceneDoc {
  const track = findTrack(doc, trackId);
  if (!track) throw new EditError("That track is no longer in the scene");
  if (!track.actor) throw new EditError("Choose an actor first: a mark is where an actor stands");
  // D5a: a person of the scene's set stands where the set has them.
  if (doc.set && typeof track.from === "string" && track.from) throw new EditError("This actor is placed by the set. Move the person in EDGEbuilder; the scene follows when it is opened again");
  const at = { ...markOf(doc, trackId) };
  for (const key of ["x", "y", "yaw"] as const) {
    const v = change[key];
    if (v === undefined) continue;
    if (!isNumber(v)) throw new EditError("That is not a number");
    at[key] = v;
  }
  if (Math.abs(at.x) > MarkReach || Math.abs(at.y) > MarkReach) throw new EditError(`A mark is within ${MarkReach} m of the scene's origin`);
  const mark: Mark = { x: round(at.x), y: round(at.y), yaw: round(((at.yaw % 360) + 360) % 360) };
  return changeTrack(doc, trackId, (t) => ({ ...t, actor: { ...t.actor, at: mark } }));
}

/**
 * Where the scene plays (EDGE Director, DR2). A place puts its origin at a spot in the world, with
 * the way its Forward points as a turn (0 is north): `anchor: { mode: "world", at: [x, y, z], yaw }`.
 * No place puts it back in front of V. A scene on a set plays where the set is.
 */
export function setPlace(doc: SceneDoc, place: { at: [number, number, number]; yaw: number } | undefined): SceneDoc {
  if (doc.set) throw new EditError("This scene plays where its set is. Take the set off in VS Code to place the scene by itself");
  if (!place) return { ...doc, anchor: { mode: "player", distance: 3 } };
  if (place.at.length !== 3 || !place.at.every(isNumber) || !isNumber(place.yaw)) throw new EditError("That is not a place");
  return { ...doc, anchor: { mode: "world", at: place.at.map((n) => round(n)) as [number, number, number], yaw: round(((place.yaw % 360) + 360) % 360) } };
}

/** A new track at the end, named after its kind and numbered when the name is taken. */
export function addTrack(doc: SceneDoc, kind: TrackKind, name?: string): SceneDoc {
  let label = name?.trim() || TrackKindNames[kind];
  if (!name) for (let n = 2; doc.tracks.some((t) => t.name === label); n++) label = `${TrackKindNames[kind]} ${n}`;
  return withTracks(doc, [...doc.tracks, { id: nextTrackId(doc), kind, name: label, clips: [] }]);
}

export function removeTrack(doc: SceneDoc, trackId: string): SceneDoc {
  if (!findTrack(doc, trackId)) throw new EditError("That track is no longer in the scene");
  return withTracks(doc, doc.tracks.filter((t) => t.id !== trackId));
}

/** A track's name, mute or lock. A locked track can still be unlocked, renamed and muted. */
export function setTrack(doc: SceneDoc, trackId: string, change: { name?: string; mute?: boolean; lock?: boolean }): SceneDoc {
  return changeTrack(doc, trackId, (t) => {
    const next = { ...t };
    if (change.name !== undefined) {
      const name = change.name.trim();
      if (!name) throw new EditError("A track needs a name");
      next.name = name;
    }
    // Absent means off, so a plain track's text stays short.
    for (const key of ["mute", "lock"] as const)
      if (change[key] !== undefined) {
        if (change[key]) next[key] = true;
        else delete next[key];
      }
    return next;
  });
}

/** A track moved to a place in the list of lanes (0 is the top). */
export function moveTrack(doc: SceneDoc, trackId: string, toIndex: number): SceneDoc {
  const from = doc.tracks.findIndex((t) => t.id === trackId);
  if (from < 0) throw new EditError("That track is no longer in the scene");
  const tracks = [...doc.tracks];
  const [track] = tracks.splice(from, 1);
  tracks.splice(Math.max(0, Math.min(tracks.length, toIndex)), 0, track);
  return withTracks(doc, tracks);
}

// ---- Edits: clips ----

export interface NewClip {
  start: number;
  length: number;
  name?: string;
  /** On an actor track, `transition` for a transition; else the track's first kind. */
  kind?: ClipKind;
}

/** A new clip on a track, at `start` or at the first free time after it. Gives the clip's id too. */
export function addClip(doc: SceneDoc, trackId: string, clip: NewClip): { doc: SceneDoc; id: string } {
  const id = nextClipId(doc);
  const next = changeTrack(doc, trackId, (t) => {
    open(t);
    const kind = clip.kind ?? clipKinds(t.kind)[0];
    if (!clipKinds(t.kind).includes(kind)) throw new EditError(`${TrackKindNames[t.kind]} tracks do not hold ${kind} clips`);
    const length = Math.max(frame(doc), toFrame(doc, clip.length));
    const start = freeStart(t, kind, toFrame(doc, clip.start), length);
    const made: Clip = { id, kind, start, length };
    if (clip.name?.trim()) made.name = clip.name.trim();
    return { ...t, clips: sorted([...t.clips, made]) };
  });
  return { doc: next, id };
}

/** Clips taken off their tracks. */
export function removeClips(doc: SceneDoc, clipIds: Iterable<string>): SceneDoc {
  const gone = new Set(clipIds);
  return withTracks(
    doc,
    doc.tracks.map((t) => {
      if (!t.clips.some((c) => gone.has(c.id))) return t;
      open(t);
      return { ...t, clips: t.clips.filter((c) => !gone.has(c.id)) };
    }),
  );
}

/**
 * Clips moved along the timeline by `delta` seconds, together, and the first of them to another
 * track when `toTrackId` names one of the same kind (only when all of them are on one track).
 * Throws when a moved clip would start before 0 or land on a clip that stays.
 */
export function moveClips(doc: SceneDoc, clipIds: Iterable<string>, delta: number, toTrackId?: string): SceneDoc {
  const moving = new Set(clipIds);
  const found = [...moving].map((id) => findClip(doc, id)).filter((f) => !!f);
  if (!found.length) return doc;
  const from = new Set(found.map((f) => f.track.id));
  const target = toTrackId !== undefined && !from.has(toTrackId) ? findTrack(doc, toTrackId) : undefined;
  if (toTrackId !== undefined && !from.has(toTrackId)) {
    if (!target) throw new EditError("That track is no longer in the scene");
    if (from.size > 1) throw new EditError("Clips from several tracks cannot move to one track together");
    if (target.kind !== found[0].track.kind) throw new EditError(`${TrackKindNames[found[0].track.kind]} clips do not go on ${TrackKindNames[target.kind].toLowerCase()} tracks`);
    open(target);
  }
  for (const f of found) open(f.track);
  const moved = (c: Clip): Clip => ({ ...c, start: round(c.start + delta) });
  if (found.some((f) => f.clip.start + delta < -Eps)) throw new EditError("A clip cannot start before 0");
  const land = (onto: Track, clips: Clip[]) => {
    for (const c of clips) if (!fits(onto, c.kind, c.start, c.length, moving)) throw new EditError("There is a clip in the way");
  };
  return withTracks(
    doc,
    doc.tracks.map((t) => {
      const mine = t.clips.filter((c) => moving.has(c.id)).map(moved);
      if (target) {
        if (t.id === target.id) {
          const arriving = found.map((f) => moved(f.clip));
          land(t, arriving);
          return { ...t, clips: sorted([...t.clips, ...arriving]) };
        }
        return mine.length ? { ...t, clips: t.clips.filter((c) => !moving.has(c.id)) } : t;
      }
      if (!mine.length) return t;
      land(t, mine);
      return { ...t, clips: sorted([...t.clips.filter((c) => !moving.has(c.id)), ...mine]) };
    }),
  );
}

/**
 * A clip's start or end edge dragged to a time. The other edge stays. The edge stops at 0, at one
 * frame from the other edge, and at the neighbour it may not overlap.
 */
export function trimClip(doc: SceneDoc, clipId: string, edge: "start" | "end", time: number): SceneDoc {
  const f = findClip(doc, clipId);
  if (!f) throw new EditError("That clip is no longer in the scene");
  open(f.track);
  const { clip } = f;
  if (clip.kind === "sequence") throw new EditError("A sequence block is as long as its sequence. Unpack it to change its clips");
  const end = clipEnd(clip);
  const others = f.track.clips.filter((c) => c.id !== clip.id && !mayOverlap(clip.kind, c.kind));
  let start = clip.start;
  let stop = end;
  if (edge === "start") {
    const floor = Math.max(0, ...others.filter((c) => clipEnd(c) <= clip.start + Eps).map(clipEnd));
    start = Math.min(Math.max(time, floor), end - frame(doc));
  } else {
    const ceiling = Math.min(Infinity, ...others.filter((c) => c.start >= end - Eps).map((c) => c.start));
    stop = Math.max(Math.min(time, ceiling), clip.start + frame(doc));
  }
  start = round(start);
  let next: Clip = { ...clip, start, length: round(stop - start) };
  // A clip with an animation trims the part it plays, and stops at the animation's own ends.
  const p = playOf(clip);
  if (p && p.loops > 1) {
    if (edge === "start") throw new EditError("Set Loops to 1 to trim this clip's start");
    // The end edge of a looping clip sets how many times it plays.
    const one = (p.out - p.in) / p.speed;
    // The nearest whole number of loops to where the edge was dragged, as far as the next clip lets it.
    const room = Math.min(Infinity, ...others.filter((c) => c.start >= end - Eps).map((c) => c.start)) - clip.start;
    const wanted = Math.round((Math.max(time, clip.start) - clip.start) / one);
    const loops = Math.max(1, Math.min(MaxLoops, wanted, Math.max(1, Math.floor((room + Eps) / one))));
    next = withPlay(clip, { ...p, loops });
  } else if (p) {
    if (edge === "start") {
      const from = Math.max(0, p.out - (end - start) * p.speed);
      next = { ...withPlay(clip, { ...p, in: from }), start: 0 };
      next.start = round(end - next.length);
    } else {
      const to = Math.min(p.anim.seconds, p.in + (stop - clip.start) * p.speed);
      next = withPlay(clip, { ...p, out: to });
    }
  }
  return changeTrack(doc, f.track.id, (t) => ({ ...t, clips: sorted(t.clips.map((c) => (c.id === clip.id ? next : c))) }));
}

/** A clip cut in two at a time inside it. Gives the id of the second part. */
export function splitClip(doc: SceneDoc, clipId: string, time: number): { doc: SceneDoc; id: string } {
  const f = findClip(doc, clipId);
  if (!f) throw new EditError("That clip is no longer in the scene");
  open(f.track);
  const { clip } = f;
  if (clip.kind === "transition") throw new EditError("A transition cannot be split");
  if (clip.kind === "sequence") throw new EditError("A sequence block cannot be split. Unpack it first");
  const at = toFrame(doc, time);
  if (at <= clip.start + Eps || at >= clipEnd(clip) - Eps) throw new EditError("The playhead is not inside the clip");
  const id = nextClipId(doc);
  let first: Clip = { ...clip, length: round(at - clip.start) };
  let second: Clip = { ...clip, id, start: at, length: round(clipEnd(clip) - at) };
  // A clip with an animation is cut in the animation too: each part plays its own share.
  const p = playOf(clip);
  if (p && p.loops > 1) throw new EditError("Set Loops to 1 to split this clip");
  if (p) {
    const mid = p.in + (at - clip.start) * p.speed;
    first = withPlay(clip, { ...p, out: mid });
    second = { ...withPlay(clip, { ...p, in: mid }), id, start: at };
  }
  const next = changeTrack(doc, f.track.id, (t) => ({ ...t, clips: sorted([...t.clips.filter((c) => c.id !== clip.id), first, second]) }));
  return { doc: next, id };
}

/** A clip's name; empty takes it away. */
export function renameClip(doc: SceneDoc, clipId: string, name: string): SceneDoc {
  const f = findClip(doc, clipId);
  if (!f) throw new EditError("That clip is no longer in the scene");
  open(f.track);
  const next: Clip = { ...f.clip };
  if (name.trim()) next.name = name.trim();
  else delete next.name;
  return changeTrack(doc, f.track.id, (t) => ({ ...t, clips: t.clips.map((c) => (c.id === clipId ? next : c)) }));
}

/**
 * Copies of clips put on a track, the earliest at `at` (or the first free time after it) and the
 * rest keeping their distance from it where there is room. Gives the new ids.
 */
export function pasteClips(doc: SceneDoc, trackId: string, clips: Clip[], at: number): { doc: SceneDoc; ids: string[] } {
  const track = findTrack(doc, trackId);
  if (!track) throw new EditError("That track is no longer in the scene");
  open(track);
  const wrong = clips.find((c) => !clipKinds(track.kind).includes(c.kind));
  if (wrong) throw new EditError(`${TrackKindNames[track.kind]} tracks do not hold ${wrong.kind} clips`);
  const first = Math.min(...clips.map((c) => c.start));
  const taken = new Set<string>();
  const ids: string[] = [];
  let work = { ...track, clips: [...track.clips] };
  for (const c of sorted(clips)) {
    const id = nextId(doc, "c", taken);
    taken.add(id);
    ids.push(id);
    const start = freeStart(work, c.kind, toFrame(doc, at + (c.start - first)), c.length);
    work = { ...work, clips: sorted([...work.clips, { ...c, id, start }]) };
  }
  return { doc: changeTrack(doc, trackId, () => work), ids };
}
