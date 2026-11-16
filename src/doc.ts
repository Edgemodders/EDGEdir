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
export type ClipKind = TrackKind | "anim" | "transition";

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

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
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
  anchor: { mode: "player" | "world"; [more: string]: unknown };
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
  return kind === "actor" ? ["anim", "transition"] : [kind];
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
  const next: Clip = { ...clip, start, length: round(stop - start) };
  return changeTrack(doc, f.track.id, (t) => ({ ...t, clips: sorted(t.clips.map((c) => (c.id === clip.id ? next : c))) }));
}

/** A clip cut in two at a time inside it. Gives the id of the second part. */
export function splitClip(doc: SceneDoc, clipId: string, time: number): { doc: SceneDoc; id: string } {
  const f = findClip(doc, clipId);
  if (!f) throw new EditError("That clip is no longer in the scene");
  open(f.track);
  const { clip } = f;
  if (clip.kind === "transition") throw new EditError("A transition cannot be split");
  const at = toFrame(doc, time);
  if (at <= clip.start + Eps || at >= clipEnd(clip) - Eps) throw new EditError("The playhead is not inside the clip");
  const id = nextClipId(doc);
  const first: Clip = { ...clip, length: round(at - clip.start) };
  const second: Clip = { ...clip, id, start: at, length: round(clipEnd(clip) - at) };
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
