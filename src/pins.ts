// Pins (EDGE Director, DR3): named places in the world that a scene's marks and its own place can
// follow. A pin is REDnode's world pin: a title and a place, kept in a `.pins.json` file
// (`"format": "rednode-pins"`, version 1). A scene links one such file and keeps a copy of its
// pins, so it still opens when the file is gone.
//
// A mark or the scene's place that follows a pin keeps its numbers too, with the pin's title
// beside them (`at.pin`, `anchor.pin`): everything that reads a mark reads the numbers, and
// `follow` brings them up to the pins. A change to the numbers by hand lets go of the pin.
// Pure: no files, no VS Code. docs/design.md, "Pins"; docs/edge-director.md, DR3.
import { EditError, markOf, type Mark, type SceneDoc, type Track } from "./doc";
import { fromOf, setOf } from "./set";

export const PinsEnding = ".pins.json";

export interface Pin {
  title: string;
  /** The place in the world: x, y, z. */
  at: [number, number, number];
  /** REDnode's second line, kept when the file is written again. */
  text?: string;
  /** REDnode's look for the pin, kept as it is. */
  style?: unknown;
}

/** A scene's link to a pin file, with the pins as they were last read. */
export interface PinsLink {
  /** The file: a name beside the scene's own file, or a full path. */
  path: string;
  name: string;
  pins: Pin[];
}

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const round = (n: number) => Math.round(n * 1000) / 1000;
const norm = (deg: number) => ((deg % 360) + 360) % 360;

/** Reads a pin file's text. Fields it does not know are left out; a pin with no title or place stops it, with words fit to show. */
export function parsePins(text: string): { name: string; pins: Pin[] } {
  let data: { format?: unknown; name?: unknown; pins?: unknown };
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`Not a pin file: it is not valid JSON (${(e as Error).message})`);
  }
  if (!data || data.format !== "rednode-pins" || !Array.isArray(data.pins)) throw new Error('Not a pin file ("format": "rednode-pins" is missing)');
  const pins: Pin[] = [];
  for (const [i, p] of (data.pins as { title?: unknown; text?: unknown; at?: { x?: unknown; y?: unknown; z?: unknown }; style?: unknown }[]).entries()) {
    const at = p?.at;
    const title = String(p?.title ?? "").trim();
    if (!title || !at || !isNumber(at.x) || !isNumber(at.y) || !isNumber(at.z)) throw new Error(`Pin ${i + 1} in the pin file needs a title and a place`);
    pins.push({ title, at: [at.x, at.y, at.z], ...(typeof p.text === "string" && p.text ? { text: p.text } : {}), ...(p.style && typeof p.style === "object" ? { style: p.style } : {}) });
  }
  return { name: String(data.name ?? "").trim(), pins };
}

/** A pin file's text, as REDnode writes one. */
export function formatPins(name: string, pins: Pin[]): string {
  return (
    JSON.stringify(
      {
        format: "rednode-pins",
        version: 1,
        name,
        pins: pins.map((p) => ({ title: p.title, ...(p.text ? { text: p.text } : {}), at: { x: round(p.at[0]), y: round(p.at[1]), z: round(p.at[2]) }, ...(p.style ? { style: p.style } : {}) })),
      },
      null,
      2,
    ) + "\n"
  );
}

/** The scene's link to its pins, when it has one. */
export function pinsOf(doc: SceneDoc): PinsLink | undefined {
  const link = doc.pins as PinsLink | null | undefined;
  return link && typeof link === "object" && typeof link.path === "string" && Array.isArray(link.pins) ? link : undefined;
}

/** A pin of the scene by its title: the first, when two have one title. */
export const pinOf = (doc: SceneDoc, title: string): Pin | undefined => pinsOf(doc)?.pins.find((p) => p.title === title);

/** The pin an actor's mark follows, and the pin the scene's place follows. */
export const markPin = (track: Track): string | undefined => {
  const pin = (track.actor?.at as { pin?: unknown } | undefined)?.pin;
  return typeof pin === "string" && pin ? pin : undefined;
};
export const placePin = (doc: SceneDoc): string | undefined => {
  const pin = (doc.anchor as { pin?: unknown }).pin;
  return typeof pin === "string" && pin ? pin : undefined;
};

/** The scene's frame in the world, when it has one by itself: its origin and the turn its Forward points along. In front of V it has none. */
export function frameOf(doc: SceneDoc): { o: [number, number, number]; turn: number } | undefined {
  const anchor = doc.anchor as { mode: string; at?: unknown; yaw?: unknown };
  if (anchor.mode === "world" && Array.isArray(anchor.at) && anchor.at.length === 3 && anchor.at.every(isNumber)) return { o: anchor.at as [number, number, number], turn: isNumber(anchor.yaw) ? norm(anchor.yaw) : 0 };
  const set = setOf(doc);
  if (anchor.mode === "set" && set) return { o: set.origin, turn: 0 };
  return undefined;
}

/** A place in the world as metres right and forward of a frame's origin. */
export function markFrom(frame: { o: [number, number, number]; turn: number }, at: [number, number, number]): { x: number; y: number } {
  const r = (frame.turn * Math.PI) / 180;
  const f = { x: -Math.sin(r), y: Math.cos(r) };
  const dx = at[0] - frame.o[0];
  const dy = at[1] - frame.o[1];
  return { x: round(dx * f.y - dy * f.x), y: round(dx * f.x + dy * f.y) };
}

/**
 * Brings what follows a pin up to the pins the scene has: first the scene's place, then each mark.
 * A pin that is gone leaves its numbers as they were. Answers the same document when nothing moved.
 */
export function follow(doc: SceneDoc): SceneDoc {
  let next = doc;
  const place = placePin(doc);
  const pin = place ? pinOf(doc, place) : undefined;
  const anchor = doc.anchor as { mode: string; at?: number[] };
  if (pin && anchor.mode === "world" && JSON.stringify(anchor.at) !== JSON.stringify(pin.at.map(round))) next = { ...next, anchor: { ...next.anchor, at: pin.at.map(round) } };
  const frame = frameOf(next);
  if (!frame) return next;
  let moved = false;
  const tracks = next.tracks.map((t) => {
    const title = markPin(t);
    const to = title ? pinOf(next, title) : undefined;
    if (!to || !t.actor) return t;
    const now = markOf(next, t.id);
    const at = markFrom(frame, to.at);
    if (at.x === now.x && at.y === now.y) return t;
    moved = true;
    return { ...t, actor: { ...t.actor, at: { x: at.x, y: at.y, yaw: now.yaw, pin: title } as Mark } };
  });
  return moved ? { ...next, tracks } : next;
}

/** Links a pin file to the scene, or takes its pins as they are now; then what follows a pin follows. */
export function linkPins(doc: SceneDoc, path: string, info: { name: string; pins: Pin[] }): SceneDoc {
  const was = pinsOf(doc);
  const link: PinsLink = { path, name: info.name, pins: info.pins.map((p) => ({ ...p, at: p.at.map(round) as [number, number, number] })) };
  if (was && JSON.stringify(was) === JSON.stringify(link)) return doc;
  return follow({ ...doc, pins: link });
}

/** Takes the pin file off the scene. Marks and the place keep their numbers and follow nothing. */
export function unlinkPins(doc: SceneDoc): SceneDoc {
  const { pin: _place, ...anchor } = doc.anchor as SceneDoc["anchor"] & { pin?: unknown };
  return {
    ...doc,
    pins: null,
    anchor: anchor as SceneDoc["anchor"],
    tracks: doc.tracks.map((t) => (markPin(t) ? { ...t, actor: { ...t.actor, at: markOf(doc, t.id) } } : t)),
  };
}

/** An actor's mark follows a pin: they stand at it. The turn is kept. */
export function markAtPin(doc: SceneDoc, trackId: string, title: string): SceneDoc {
  const track = doc.tracks.find((t) => t.id === trackId);
  if (!track) throw new EditError("That track is no longer in the scene");
  if (!track.actor) throw new EditError("Choose an actor first: a mark is where an actor stands");
  if (doc.set && fromOf(track)) throw new EditError("This actor is placed by the set. Move the person in EDGEbuilder; the scene follows when it is opened again");
  const pin = pinOf(doc, title);
  if (!pin) throw new EditError(`The scene has no pin named "${title}"`);
  const frame = frameOf(doc);
  if (!frame) throw new EditError("This scene plays in front of V, wherever V is, so a pin is no place in it. Give the scene a place first: The Scene Is Here, or a pin as the scene's place");
  const at = markFrom(frame, pin.at);
  return { ...doc, tracks: doc.tracks.map((t) => (t.id === trackId ? { ...t, actor: { ...t.actor, at: { x: at.x, y: at.y, yaw: markOf(doc, trackId).yaw, pin: title } as Mark } } : t)) };
}

/** The scene's place follows a pin: its origin is there. The marks that follow pins stay at theirs; the others move with the origin. */
export function placeAtPin(doc: SceneDoc, title: string): SceneDoc {
  if (doc.set) throw new EditError("This scene plays where its set is. Take the set off in VS Code to place the scene by itself");
  const pin = pinOf(doc, title);
  if (!pin) throw new EditError(`The scene has no pin named "${title}"`);
  const was = doc.anchor as { mode: string; yaw?: unknown };
  return follow({ ...doc, anchor: { mode: "world", at: pin.at.map(round), yaw: was.mode === "world" && isNumber(was.yaw) ? was.yaw : 0, pin: title } });
}

/** A pin's new title, wherever the scene names it. */
export function renamePin(doc: SceneDoc, title: string, to: string): SceneDoc {
  const link = pinsOf(doc);
  if (!link) return doc;
  return {
    ...doc,
    pins: { ...link, pins: link.pins.map((p) => (p.title === title ? { ...p, title: to } : p)) },
    anchor: placePin(doc) === title ? { ...doc.anchor, pin: to } : doc.anchor,
    tracks: doc.tracks.map((t) => (markPin(t) === title ? { ...t, actor: { ...t.actor, at: { ...(t.actor!.at as Mark), pin: to } as Mark } } : t)),
  };
}

/** Which of the scene's pins something follows. */
export function usedPins(doc: SceneDoc): Set<string> {
  const used = new Set<string>();
  const place = placePin(doc);
  if (place) used.add(place);
  for (const t of doc.tracks) {
    const title = markPin(t);
    if (title) used.add(title);
  }
  return used;
}

/** A pin is gone: what followed it keeps its numbers and follows nothing. */
export function forgetPin(doc: SceneDoc, title: string): SceneDoc {
  const { pin: _place, ...anchor } = doc.anchor as SceneDoc["anchor"] & { pin?: unknown };
  return {
    ...doc,
    anchor: placePin(doc) === title ? (anchor as SceneDoc["anchor"]) : doc.anchor,
    tracks: doc.tracks.map((t) => (markPin(t) === title ? { ...t, actor: { ...t.actor, at: markOf(doc, t.id) } } : t)),
  };
}
