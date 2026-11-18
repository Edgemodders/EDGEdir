// EDGE Director's floor (DR1): the Desk's scenes as the game's side reads them, and a scene as the
// window shows it. It is built from EDGEdir's own code (the document, the cue sheet, the set's
// rules), so a scene opened in the game obeys the rules the editor has. No `rednode` in here and no
// VS Code: the steps run in a unit test against a scratch Desk. docs/edge-director.md.
import * as fs from "node:fs";
import * as path from "node:path";
import { libraryRoot } from "../src/core/made";
import { cuesOf, playable, type CueSheet } from "../src/cues";
import { weatherLabel, weatherOf } from "../src/weather";
import { deskDir, Kind, listDesk } from "../src/desk";
import { clipEnd, markOf, sceneLength, type Clip, type Mark, type SceneDoc } from "../src/doc";
import { follow, formatPins, linkPins, markPin, parsePins, PinsEnding, pinsOf, placePin, usedPins, type Pin, type PinsLink } from "../src/pins";
import { stageFor, type PlayStage } from "../src/play";
import { readScene, writeScene } from "../src/seq";
import { fromOf, setOf } from "../src/set";
import { fileOf } from "../src/setFiles";

/** A scene on the Desk, as the window lists it. */
export interface SceneRow {
  id: string;
  name: string;
  file: string;
  /** When the document last changed, in milliseconds. */
  modified: number;
}

export interface StripClip {
  id: string;
  start: number;
  end: number;
  label: string;
  /** What the clip is: an animation (`anim`), a `transition`, a `sequence` block, or the track's own kind. */
  kind: string;
  /** In the cue sheet: the game plays it. A transition is the preview's, never the game's. */
  played: boolean;
}

export interface StripTrack {
  id: string;
  name: string;
  kind: string;
  /** Who acts on an actor's track. */
  who?: string;
  /** In the cast: the game spawns this actor. */
  cast: boolean;
  /** An actor's mark: metres right and forward of the scene's origin, and the turn. */
  mark?: Mark;
  /** The set places this actor: the mark is not the Director's to change. */
  placed?: boolean;
  /** The pin the mark follows. */
  pin?: string;
  clips: StripClip[];
}

/** A scene as the window shows it. */
export interface SceneView {
  file: string;
  name: string;
  /** Seconds. */
  length: number;
  tracks: StripTrack[];
  /** What the game will not play as the preview shows. */
  notes: string[];
  /** The set the scene is on, and whether its file was found. */
  set?: { name: string; found: boolean };
  /** The scene's own place in the world, when it has one: neither on a set nor in front of V. */
  place?: { at: [number, number, number]; yaw: number };
  /** The pin the scene's place follows. */
  placePin?: string;
  /** The scene's pins, as it last read them, and which of them something follows. */
  pins?: { name: string; pins: { title: string; at: [number, number, number]; used: boolean }[] };
  /** VS Code has changes to this scene that are not saved: the Director plays it and does not change it. */
  unsaved?: boolean;
  /** Why the scene cannot be played, in words; absent when it can. */
  why?: string;
}

/** What a play of a scene is given: the player's request, less its id. */
export interface Playable {
  file: string;
  sheet: CueSheet;
  stage?: PlayStage;
}

/** Where sets are looked for: the Library's root, and the folder of the project VS Code has open. */
export interface Roots {
  library?: string;
  project?: string;
}

/** The roots EDGEdir last wrote into the play folder (`roots.json`), with the Library's own setting when it wrote none. */
export function rootsOf(playDir: string): Roots {
  let said: Roots = {};
  try {
    said = JSON.parse(fs.readFileSync(path.join(playDir, "roots.json"), "utf8")) as Roots;
  } catch {
    // EDGEdir has not run on this PC since the Director came: the Library is still found.
  }
  return { library: typeof said.library === "string" ? said.library : libraryRoot(), project: typeof said.project === "string" ? said.project : undefined };
}

/** The Desk's scenes, the last changed first. Sequences are not listed: a sequence plays inside a scene. */
export function scenes(base = deskDir()): SceneRow[] {
  return listDesk(base)
    .filter((s) => s.kind === Kind)
    .map((s) => ({ id: s.id, name: s.name, file: s.file, modified: s.modified }));
}

const label = (c: Clip) => c.name ?? (c.anim as { name?: string } | undefined)?.name ?? (c.seq as { name?: string } | undefined)?.name ?? c.kind;

/** A scene's document as the window shows it, and what a play of it is given. `doc` is the file's, or what VS Code sent. */
export function viewOf(file: string, doc: SceneDoc, roots: Roots): { view: SceneView; play?: Playable } {
  const { sheet, notes } = cuesOf(doc);
  const cast = new Map(sheet.cast.map((m) => [m.track, new Set(m.clips.map((c) => c.name))]));
  const jumps = new Map(sheet.timeline.map((c) => [`${c.track} ${c.t}`, c.jump]));
  const tracks: StripTrack[] = doc.tracks.map((t) => ({
    id: t.id,
    name: t.name,
    kind: t.kind,
    ...(t.actor?.name ? { who: t.actor.name } : {}),
    cast: cast.has(t.id) || (t.kind === "weather" && !t.mute && t.clips.some((c) => weatherOf(c))),
    ...(t.kind === "actor" && t.actor ? { mark: markOf(doc, t.id), ...(doc.set && fromOf(t) ? { placed: true } : {}), ...(markPin(t) ? { pin: markPin(t) } : {}) } : {}),
    clips: t.clips.map((c) => ({ id: c.id, kind: c.kind, start: c.start, end: clipEnd(c), label: String(weatherOf(c) ? (c.name ?? weatherLabel(weatherOf(c)!.state)) : label(c)), played: (c.kind !== "transition" && jumps.has(`${t.id} ${c.start}`)) || c.kind === "sequence" || (!!weatherOf(c) && !t.mute) })),
  }));
  const view: SceneView = { file, name: doc.name, length: Math.max(sheet.length, sceneLength(doc)), tracks, notes: notes.map((n) => n.text) };
  const anchor = doc.anchor as { mode: string; at?: [number, number, number]; yaw?: number };
  if (anchor.mode === "world" && Array.isArray(anchor.at)) view.place = { at: anchor.at, yaw: Number(anchor.yaw ?? 0) };
  const pinned = pinsOf(doc);
  if (pinned) {
    const used = usedPins(doc);
    view.pins = { name: pinned.name, pins: pinned.pins.map((p) => ({ title: p.title, at: p.at, used: used.has(p.title) })) };
  }
  if (placePin(doc)) view.placePin = placePin(doc);
  const link = setOf(doc);
  let stage: PlayStage | undefined;
  if (link) {
    const setFile = fileOf(link, roots.library, roots.project);
    const found = !!setFile && fs.existsSync(setFile);
    view.set = { name: link.name, found };
    if (found) stage = stageFor(doc, fs.readFileSync(setFile!, "utf8"));
    else view.why = `The scene's set "${link.name}" was not found, so the scene cannot play on it. Open the scene in VS Code and choose the set again, or remove it.`;
  }
  if (!playable(sheet)) view.why = notes.find((n) => !n.clip)?.text ?? "Nothing to play in the game: no actor track has a clip the game can play.";
  return view.why ? { view } : { view, play: { file, sheet, ...(stage ? { stage } : {}) } };
}

/** Reads a scene's file. Throws with words fit to show when it is gone or is not a scene. */
export function open(file: string, roots: Roots): { view: SceneView; play?: Playable } {
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    throw new Error(`${path.basename(file)} is not on the Desk any more`);
  }
  return viewOf(file, readScene(file, text), roots);
}

/**
 * The scenes VS Code has open with changes that are not saved. EDGEdir writes the list into the play
 * folder (`editor.json`) at each change and every few seconds while there are any: a list older
 * than `within` milliseconds is from a VS Code that is gone, and counts as empty.
 */
export function unsavedIn(playDir: string, now = Date.now(), within = 10000): string[] {
  try {
    const said = JSON.parse(fs.readFileSync(path.join(playDir, "editor.json"), "utf8")) as { at?: number; dirty?: unknown };
    if (typeof said.at !== "number" || now - said.at > within || !Array.isArray(said.dirty)) return [];
    return said.dirty.filter((f): f is string => typeof f === "string");
  } catch {
    return [];
  }
}

const same = (a: string, b: string) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

/** Whether VS Code has unsaved changes to this scene's file. */
export const isUnsaved = (file: string, playDir: string, now = Date.now()) => unsavedIn(playDir, now).some((f) => same(f, file));

/**
 * One change to a scene's file, as the editor would make it: the file is read, changed with one of
 * EDGEdir's own edits (which throws with words fit to show), and written whole through a temp
 * file. Refused while VS Code has unsaved changes to it, so neither tool overwrites the other.
 */
export function edit(file: string, change: (doc: SceneDoc) => SceneDoc, playDir: string): SceneDoc {
  if (isUnsaved(file, playDir)) throw new Error("This scene has unsaved changes in VS Code. Save it there first");
  let was: string;
  try {
    was = fs.readFileSync(file, "utf8");
  } catch {
    throw new Error(`${path.basename(file)} is not on the Desk any more`);
  }
  // What follows a pin follows it after every change: a moved origin moves the marks that do not.
  const doc = follow(change(readScene(file, was)));
  const text = writeScene(file, doc, was);
  if (text !== was) {
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, file);
  }
  return doc;
}

// ---- pins (DR3) -------------------------------------------------------------------------------

/** A scene's pin file: the one its link names (a name beside the scene's file, or a full path), or for a scene with none, `<scene>.pins.json` beside it. */
export function pinFileOf(sceneFile: string, link: PinsLink | undefined): string {
  const dir = path.dirname(sceneFile);
  if (link) return path.isAbsolute(link.path) ? link.path : path.join(dir, link.path);
  return path.join(dir, path.basename(sceneFile, path.extname(sceneFile)) + PinsEnding);
}

/** A pin file's pins, or undefined when there is no such file. A file that is not a pin file throws, in words. */
export function readPinFile(file: string): { name: string; pins: Pin[] } | undefined {
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
  return parsePins(text);
}

/** Writes a pin file whole, as REDnode writes one: through a temp file, then a rename. */
export function writePinFile(file: string, name: string, pins: Pin[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, formatPins(name, pins));
  fs.renameSync(tmp, file);
}

/**
 * Brings a scene up to its pin file when the file's pins are not the ones the scene last read:
 * one change to the scene's file. False when nothing changed, the scene has no pins, the file is
 * gone, or VS Code has the scene unsaved (it is then read again later).
 */
export function syncPins(sceneFile: string, playDir: string): boolean {
  let doc: SceneDoc;
  try {
    doc = readScene(sceneFile, fs.readFileSync(sceneFile, "utf8"));
  } catch {
    return false;
  }
  const link = pinsOf(doc);
  if (!link) return false;
  let info: { name: string; pins: Pin[] } | undefined;
  try {
    info = readPinFile(pinFileOf(sceneFile, link));
  } catch {
    return false;
  }
  if (!info) return false;
  const next = linkPins(doc, link.path, { name: info.name || link.name, pins: info.pins });
  if (next === doc || isUnsaved(sceneFile, playDir)) return false;
  edit(sceneFile, (d) => linkPins(d, link.path, { name: info!.name || link.name, pins: info!.pins }), playDir);
  return true;
}

/** REDnode's folder of the player's own pin sets: what **Drop a pin here** in its Pins window writes. Read only (REDnode #50). */
export function rednodePinsDir(): string {
  return path.join(process.env.APPDATA || path.join(process.env.USERPROFILE ?? "", "AppData", "Roaming"), "@rednode", "overlay", "pins");
}

/** A pin file found for a scene to choose, with where it is from. */
export interface PinFileRow {
  file: string;
  from: "scene" | "game" | "project";
  name: string;
  pins: number;
}

/**
 * The pin files a scene can choose: its own beside it, the player's sets in REDnode's folder, and
 * those in the open project (8 folders deep at most, without dot folders and node_modules).
 * A file that is not a pin file is left out.
 */
export function findPinFiles(sceneFile: string, projectDir: string | undefined, gameDir = rednodePinsDir()): PinFileRow[] {
  const rows: PinFileRow[] = [];
  const add = (file: string, from: PinFileRow["from"]) => {
    if (rows.some((r) => path.resolve(r.file).toLowerCase() === path.resolve(file).toLowerCase())) return;
    try {
      const info = readPinFile(file);
      if (info) rows.push({ file, from, name: info.name || path.basename(file, PinsEnding), pins: info.pins.length });
    } catch {
      // Not a pin file.
    }
  };
  const list = (dir: string) => {
    try {
      return fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }
  };
  for (const e of list(path.dirname(sceneFile))) if (e.isFile() && e.name.toLowerCase().endsWith(PinsEnding)) add(path.join(path.dirname(sceneFile), e.name), "scene");
  for (const e of list(gameDir)) if (e.isFile() && e.name.toLowerCase().endsWith(PinsEnding)) add(path.join(gameDir, e.name), "game");
  const walk = (dir: string, deep: number) => {
    for (const e of list(dir)) {
      if (e.isFile() && e.name.toLowerCase().endsWith(PinsEnding)) add(path.join(dir, e.name), "project");
      else if (e.isDirectory() && deep < 8 && !e.name.startsWith(".") && e.name !== "node_modules") walk(path.join(dir, e.name), deep + 1);
    }
  };
  if (projectDir) walk(projectDir, 0);
  return rows;
}

/** The path a scene's link names a pin file by: its name alone when it is beside the scene's file, else the full path. */
export function pinPathFor(sceneFile: string, pinFile: string): string {
  return path.resolve(path.dirname(pinFile)).toLowerCase() === path.resolve(path.dirname(sceneFile)).toLowerCase() ? path.basename(pinFile) : path.resolve(pinFile);
}
