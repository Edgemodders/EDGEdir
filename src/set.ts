// Sets (D5a): an EDGEbuilder scene is the stage an EDGEdir scene plays on. This file reads one
// (EDGEbuilder's scene format 1 and 2) and keeps the link between a scene and its set, as pure
// functions: no VS Code, no page, no files. docs/design.md, "Sets: the stage from EDGEbuilder".
import { EditError, nextTrackId, type Actor, type Mark, type SceneDoc, type Track } from "./doc";

/** A person the set places: EDGEbuilder's `npc` kind. */
export interface SetPerson {
  id: string;
  /** The TweakDB record, `Character.*`. One of `record` and `entity`. */
  record?: string;
  /** An entity template instead of a record. */
  entity?: string;
  appearance?: string;
  /** The world position in metres (x east, y north, z up) and the facing in degrees about z. */
  x: number;
  y: number;
  z: number;
  yaw: number;
}

/** Anything else the set places that has a size: a mesh or an entity. */
export interface SetProp {
  id: string;
  kind: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** The box's size (x, y, z) and its middle from the object's place, both scaled. Absent when the file gives no bounds. */
  size?: [number, number, number];
  centre?: [number, number, number];
}

export interface SetInfo {
  name: string;
  people: SetPerson[];
  props: SetProp[];
  /** Vehicles the set places (EDGEbuilder has no such kind yet; counted for when it does). */
  vehicles: number;
}

/** What a scene keeps of its set. */
export interface SetLink {
  /** Where the set's file is: the EDGE Library or the open REDcode project. */
  where: "library" | "project";
  /** Its path from that root, with `/`. */
  path: string;
  name: string;
  /** The file's content hash when the scene last read it. */
  hash: string;
  /** The scene's origin in the world: the middle of the set's people when the set was chosen. It stays there, so a mark changes only when its person moves. */
  origin: [number, number, number];
}

const isNumber = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const triple = (v: unknown, or: [number, number, number]): [number, number, number] => (Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every(isNumber) ? [v[0], v[1], v[2]] : or);

/** The turn about the up axis of a rotation `[x, y, z, w]`, in degrees from 0 up to 360. */
export function yawOf(q: unknown): number {
  if (!Array.isArray(q) || q.length < 4 || !q.slice(0, 4).every(isNumber)) return 0;
  const [x, y, z, w] = q as number[];
  const deg = (Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)) * 180) / Math.PI;
  return r3(((deg % 360) + 360) % 360);
}

/** An EDGEbuilder scene from its text; throws with a readable message when it is not one. */
export function parseSet(text: string): SetInfo {
  let d: unknown;
  try {
    d = JSON.parse(text);
  } catch (e) {
    throw new Error(`Not valid JSON: ${(e as Error).message}`);
  }
  const file = d as { format?: unknown; name?: unknown; objects?: unknown } | null;
  if (!file || typeof file !== "object" || !isNumber(file.format) || !Array.isArray(file.objects)) throw new Error("Not an EDGEbuilder scene (its format or its objects are missing)");
  const info: SetInfo = { name: typeof file.name === "string" ? file.name : "", people: [], props: [], vehicles: 0 };
  for (const o of file.objects as Record<string, unknown>[]) {
    if (!o || typeof o !== "object" || typeof o.id !== "string" || !o.id) continue;
    const t = (o.transform ?? {}) as Record<string, unknown>;
    const [x, y, z] = triple(t.position, [0, 0, 0]);
    const place = { id: o.id, x, y, z, yaw: yawOf(t.rotation) };
    const appearance = typeof o.appearance === "string" && o.appearance ? o.appearance : undefined;
    if (o.kind === "npc") {
      info.people.push({ ...place, ...(typeof o.record === "string" && o.record ? { record: o.record } : {}), ...(typeof o.resource === "string" && o.resource ? { entity: o.resource } : {}), ...(appearance ? { appearance } : {}) });
      continue;
    }
    if (o.kind === "vehicle") info.vehicles++;
    const prop: SetProp = { ...place, kind: typeof o.kind === "string" ? o.kind : "" };
    const b = o.bounds as { min?: unknown; max?: unknown } | undefined;
    const min = b && triple(b.min, [NaN, NaN, NaN]);
    const max = b && triple(b.max, [NaN, NaN, NaN]);
    if (min && max && [...min, ...max].every(isNumber)) {
      const s = triple(t.scale, [1, 1, 1]);
      prop.size = [0, 1, 2].map((i) => r3(Math.abs((max[i] - min[i]) * s[i]))) as [number, number, number];
      prop.centre = [0, 1, 2].map((i) => r3(((max[i] + min[i]) / 2) * s[i])) as [number, number, number];
    }
    info.props.push(prop);
  }
  return info;
}

/** The scene's origin on a set: the middle of its people, on the lowest one's ground; of everything when it has no people. */
export function originOf(info: SetInfo): [number, number, number] {
  const at = info.people.length ? info.people : info.props;
  if (!at.length) return [0, 0, 0];
  return [r3(at.reduce((s, p) => s + p.x, 0) / at.length), r3(at.reduce((s, p) => s + p.y, 0) / at.length), r3(Math.min(...at.map((p) => p.z)))];
}

/** Where a person of the set stands, from a scene's origin (the set's own middle when none is given). */
export function markIn(info: SetInfo, person: SetPerson, origin = originOf(info)): Mark {
  const [ox, oy] = origin;
  return { x: r3(person.x - ox), y: r3(person.y - oy), yaw: person.yaw };
}

/** The set's props from the scene's origin, for the preview's boxes: those the file gives a size for. */
export function stageProps(info: SetInfo, origin = originOf(info)): { id: string; x: number; y: number; z: number; yaw: number; size: [number, number, number]; centre: [number, number, number] }[] {
  const [ox, oy, oz] = origin;
  return info.props.filter((p) => p.size && p.centre).map((p) => ({ id: p.id, x: r3(p.x - ox), y: r3(p.y - oy), z: r3(p.z - oz), yaw: p.yaw, size: p.size!, centre: p.centre! }));
}

/** The set a scene names, or undefined when it has none (or one this version cannot read). */
export function setOf(doc: SceneDoc): SetLink | undefined {
  const s = doc.set as Partial<SetLink> | null;
  if (!s || typeof s !== "object" || (s.where !== "library" && s.where !== "project") || typeof s.path !== "string" || !s.path) return undefined;
  return { where: s.where, path: s.path, name: typeof s.name === "string" ? s.name : "", hash: typeof s.hash === "string" ? s.hash : "", origin: triple(s.origin, [0, 0, 0]) };
}

/** The id of the set's person a track came from. */
export const fromOf = (track: Track): string | undefined => (typeof track.from === "string" && track.from ? track.from : undefined);

/** An actor track for a person of the set, empty, standing where the set has them. */
function trackFor(doc: SceneDoc, info: SetInfo, p: SetPerson, actor: Actor | undefined): Track {
  const who: Actor = { ...(actor ?? { ...(p.record ? { record: p.record } : {}), ...(p.entity ? { entity: p.entity } : {}), name: p.record?.replace(/^Character\./, "") ?? p.id }), at: markIn(info, p, setOf(doc)?.origin) };
  let name = who.name ?? p.id;
  for (let n = 2; doc.tracks.some((t) => t.name === name); n++) name = `${who.name ?? p.id} ${n}`;
  return { id: nextTrackId(doc), kind: "actor", name, from: p.id, actor: who, clips: [] };
}

/** The link as the scene keeps it for a set read just now. */
export const linkTo = (where: SetLink["where"], path: string, info: SetInfo, hash: string): SetLink => ({ where, path, name: info.name, hash, origin: originOf(info) });

/** The people of the set that no track of the scene came from. */
export function freshPeople(doc: SceneDoc, info: SetInfo): SetPerson[] {
  const have = new Set(doc.tracks.map(fromOf));
  return info.people.filter((p) => !have.has(p.id));
}

/** Adds an actor track for each person of the set that has none. `actors` holds what was read of each from the game, by the person's id. */
export function addSetPeople(doc: SceneDoc, info: SetInfo, actors: Record<string, Actor | undefined> = {}): { doc: SceneDoc; added: number } {
  if (!setOf(doc)) throw new EditError("This scene has no set");
  let next = doc;
  let added = 0;
  for (const p of freshPeople(doc, info)) {
    next = { ...next, tracks: [...next.tracks, trackFor(next, info, p, actors[p.id])] };
    added++;
  }
  return { doc: next, added };
}

/**
 * Gives a scene a set: it plays where the set is. Its tracks stay; the set's people come with
 * `addSetPeople`. When the scene had a set of the same name (the same set under a new file name,
 * or chosen again), the link picks up where it was: the origin stays, and tracks keep the person
 * they came from when `info` still has them.
 */
export function chooseSet(doc: SceneDoc, link: SetLink, info?: SetInfo): SceneDoc {
  const was = setOf(doc);
  const again = !!was && !!info && was.name === link.name;
  const ids = new Set(info?.people.map((p) => p.id));
  return { ...doc, anchor: { mode: "set" }, set: again ? { ...link, origin: was!.origin } : link, tracks: doc.tracks.map((t) => (again && ids.has(fromOf(t) ?? "") ? t : withoutFrom(t))) };
}

/** Takes the set off: the scene plays in front of V again. Tracks and marks stay, and are the scene's own. */
export function removeSet(doc: SceneDoc): SceneDoc {
  if (!doc.set) return doc;
  return { ...doc, anchor: { mode: "player", distance: 3 }, set: null, tracks: doc.tracks.map((t) => withoutFrom(t)) };
}

function withoutFrom(t: Track): Track {
  if (fromOf(t) === undefined) return t;
  const { from: _from, ...rest } = t;
  return rest as Track;
}

/**
 * Brings a scene up to its set as it is now: the link's name and hash, and the mark of every
 * track that came from a person of the set. A track whose person is gone keeps its mark and clips.
 * The same document comes back when nothing changed.
 */
export function syncSet(doc: SceneDoc, info: SetInfo, hash: string): { doc: SceneDoc; moved: number } {
  const link = setOf(doc);
  if (!link) return { doc, moved: 0 };
  let moved = 0;
  const tracks = doc.tracks.map((t) => {
    const person = info.people.find((p) => p.id === fromOf(t));
    if (!person || !t.actor) return t;
    const mark = markIn(info, person, link.origin);
    const at = t.actor.at as Partial<Mark> | undefined;
    if (at && at.x === mark.x && at.y === mark.y && at.yaw === mark.yaw) return t;
    moved++;
    return { ...t, actor: { ...t.actor, at: mark } };
  });
  // The origin stays where it was when the set was chosen: people who did not move keep their marks, and so does one who is gone.
  const now: SetLink = { ...link, name: info.name, hash };
  const same = !moved && JSON.stringify(now) === JSON.stringify(link);
  return { doc: same ? doc : { ...doc, anchor: { mode: "set" }, set: now, tracks }, moved };
}

/** How a scene stands to its set, for the page. */
export interface Stage {
  name: string;
  /** `linked`: the set was read. `missing`: its file is not there (or cannot be read); the scene keeps the marks it last read. */
  state: "linked" | "missing";
  /** Why it is missing, in words. */
  why?: string;
  people: number;
  vehicles: number;
  /** Tracks whose person is no longer in the set, by track id. */
  gone: string[];
  /** How many of the set's people have no track. */
  fresh: number;
  /** The props with a size, from the scene's origin. */
  props: ReturnType<typeof stageProps>;
}

export function stageOf(doc: SceneDoc, info: SetInfo | undefined, why?: string): Stage | undefined {
  const link = setOf(doc);
  if (!link) return undefined;
  if (!info) return { name: link.name, state: "missing", ...(why ? { why } : {}), people: 0, vehicles: 0, gone: [], fresh: 0, props: [] };
  const ids = new Set(info.people.map((p) => p.id));
  return {
    name: info.name || link.name,
    state: "linked",
    people: info.people.length,
    vehicles: info.vehicles,
    gone: doc.tracks.filter((t) => fromOf(t) !== undefined && !ids.has(fromOf(t)!)).map((t) => t.id),
    fresh: freshPeople(doc, info).length,
    props: stageProps(info, link.origin),
  };
}
