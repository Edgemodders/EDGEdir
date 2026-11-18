// EDGE Director's floor (DR1): the Desk's scenes as the game's side reads them, and a scene as the
// window shows it. It is built from EDGEdir's own code (the document, the cue sheet, the set's
// rules), so a scene opened in the game obeys the rules the editor has. No `rednode` in here and no
// VS Code: the steps run in a unit test against a scratch Desk. docs/edge-director.md.
import * as fs from "node:fs";
import * as path from "node:path";
import { libraryRoot } from "../src/core/made";
import { cuesOf, type CueSheet } from "../src/cues";
import { deskDir, Kind, listDesk } from "../src/desk";
import { clipEnd, sceneLength, type Clip, type SceneDoc } from "../src/doc";
import { stageFor, type PlayStage } from "../src/play";
import { readScene } from "../src/seq";
import { setOf } from "../src/set";
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
  /** In the cue sheet: the game plays it. */
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
    cast: cast.has(t.id),
    clips: t.clips.map((c) => ({ id: c.id, start: c.start, end: clipEnd(c), label: String(label(c)), played: jumps.has(`${t.id} ${c.start}`) || c.kind === "sequence" })),
  }));
  const view: SceneView = { file, name: doc.name, length: Math.max(sheet.length, sceneLength(doc)), tracks, notes: notes.map((n) => n.text) };
  const link = setOf(doc);
  let stage: PlayStage | undefined;
  if (link) {
    const setFile = fileOf(link, roots.library, roots.project);
    const found = !!setFile && fs.existsSync(setFile);
    view.set = { name: link.name, found };
    if (found) stage = stageFor(doc, fs.readFileSync(setFile!, "utf8"));
    else view.why = `The scene's set "${link.name}" was not found, so the scene cannot play on it. Open the scene in VS Code and choose the set again, or remove it.`;
  }
  if (!sheet.cast.length) view.why = notes.find((n) => !n.clip)?.text ?? "Nothing to play in the game: no actor track has a clip the game can play.";
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
