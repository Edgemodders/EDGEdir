// Play in game (D5d): how EDGEdir reaches its app in the game, EDGE Director, and which one it needs.
// The Director is the REDnode package under director/ (edge-director), its own release file: a
// player installs its zip with their mod manager, and EDGEdir copies nothing into the game's folder
// (a developer's command aside). EDGEdir writes request.json
// into %LOCALAPPDATA%\EDGEdir\play; the player writes state.json and alive.json beside it. The
// folder is in the player's own Windows profile, so only their own programs can write it, and no
// port is opened. No VS Code in here. docs/d5-play-in-game.md, "How VS Code reaches the player".
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import manifest from "../director/rednode-app.json";
import type { CueSheet } from "./cues";
import type { SceneDoc } from "./doc";
import { fromOf, setOf } from "./set";
import { soundPath } from "./soundFiles";

export const PlayerId = "edge-director";

/** The Director this EDGEdir was built with: an older one in the game is asked to be updated. */
export const DirectorVersion: string = manifest.version;

/** Where the Director's zip is: each EDGEdir release on GitHub has it beside the extension. */
export const DirectorDownload = "https://github.com/Edgemodders/EDGEdir/releases/latest";

/** The folder EDGEdir and its player share: `%LOCALAPPDATA%\EDGEdir\play`. */
export function playDir(): string {
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  return path.join(local, "EDGEdir", "play");
}

/** What the player says of a play (player/play.mjs). */
export interface PlayState {
  id?: string;
  state: "idle" | "writing" | "loading" | "spawning" | "warming" | "playing" | "paused" | "ended" | "stopped" | "failed";
  text: string;
  scene?: string;
  length?: number;
  /** When the scene started, on this PC's clock, in milliseconds. */
  startedAt?: number;
  late?: { t: number; track: string; jump: string; ms: number; ok: boolean; error?: string }[];
  notes?: string[];
  error?: string;
  version?: string;
}

/** The set a scene plays on, as the player is given it: the set's file, where the scene's origin is, and which object each track directs. */
export interface PlayStage {
  origin: [number, number, number];
  scene: unknown;
  from: Record<string, string>;
}

export interface PlayRequest {
  id: string;
  /** When it was written: the player does not play one left from before it started. */
  at: number;
  do: "play" | "stop";
  /** The scene's file, so the Director shows the scene that plays. The sheet is what plays: it may be newer than the file. */
  file?: string;
  sheet?: CueSheet;
  stage?: PlayStage;
  /** D6b: where each of the sheet's sound files is on this PC, by the name the sheet has it under. */
  sounds?: Record<string, string>;
}

/**
 * Where a scene's sound files are on this PC: each of the sheet's files, looked for from the
 * scene's own folder. `missing` are the ones that are not there.
 */
export function soundsFor(sceneFile: string, sheet: CueSheet): { sounds: Record<string, string>; missing: string[] } {
  const sounds: Record<string, string> = {};
  const missing: string[] = [];
  for (const s of sheet.sounds ?? []) {
    if (!s.file || s.file in sounds || missing.includes(s.file)) continue;
    // A file is the scene's own: a name that climbs out of the scene's folder is not played.
    const full = soundPath(sceneFile, s.file);
    if (full) sounds[s.file] = full;
    else missing.push(s.file);
  }
  return { sounds, missing };
}

const readJson = (file: string): unknown => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
};

/**
 * The running player's version, when it said it was alive in the last `within` milliseconds. It says
 * so every 2 s. REDnode ends a package without telling it (#48), so silence is the only sign it stopped.
 */
export function alive(dir = playDir(), now = Date.now(), within = 5000): string | undefined {
  const a = readJson(path.join(dir, "alive.json")) as { version?: string; at?: number } | undefined;
  return a && typeof a.at === "number" && now - a.at < within && now - a.at > -within ? String(a.version ?? "0") : undefined;
}

/** What the player last said. */
export function readState(dir = playDir()): PlayState | undefined {
  const s = readJson(path.join(dir, "state.json")) as PlayState | undefined;
  return s && typeof s.state === "string" ? s : undefined;
}

/** Writes a request for the player, whole, and answers its id. */
export function request(what: Omit<PlayRequest, "id" | "at">, dir = playDir(), now = Date.now()): string {
  const id = crypto.randomBytes(8).toString("hex");
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `request.${process.pid}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify({ id, at: now, ...what } satisfies PlayRequest));
  fs.renameSync(tmp, path.join(dir, "request.json"));
  return id;
}

/**
 * Tells the Director where sets are looked for: the Library's root and the open project's folder.
 * It reads them when it opens a scene by itself, with VS Code closed or open.
 */
export function writeRoots(roots: { library?: string; project?: string }, dir = playDir()): void {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, `roots.${process.pid}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(roots));
    fs.renameSync(tmp, path.join(dir, "roots.json"));
  } catch {
    // The Director then looks in the Library alone.
  }
}

/**
 * Tells the Director which scenes VS Code has open with changes that are not saved (`editor.json`):
 * it plays those and does not change them, so neither tool overwrites the other. Written at each
 * change, and every few seconds while there are any, since a list that is old counts as empty.
 */
export function writeUnsaved(files: string[], dir = playDir(), now = Date.now()): void {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, `editor.${process.pid}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify({ at: now, dirty: files }));
    fs.renameSync(tmp, path.join(dir, "editor.json"));
  } catch {
    // The Director then takes the scenes as saved.
  }
}

/** The stage for a scene on a set: `setText` is the set's file as EDGEbuilder saved it. Undefined for a scene with no set. */
export function stageFor(doc: SceneDoc, setText: string): PlayStage | undefined {
  const link = setOf(doc);
  if (!link) return undefined;
  const from: Record<string, string> = {};
  for (const t of doc.tracks) {
    const id = fromOf(t);
    if (id) from[t.id] = id;
  }
  return { origin: link.origin, scene: JSON.parse(setText), from };
}

// ---- the player in the game's folder ---------------------------------------------------------

/** REDnode's apps folder in a game folder. */
export const appsDir = (gamePath: string) => path.join(gamePath, "red4ext", "plugins", "REDnode", "apps");

/** The version of the player in a folder (its manifest's), or undefined when there is none. */
export function playerVersion(folder: string): string | undefined {
  const m = readJson(path.join(folder, "rednode-app.json")) as { id?: string; version?: string } | undefined;
  return m?.id === PlayerId && typeof m.version === "string" ? m.version : undefined;
}

/** Whether version `a` is older than `b`: numbers compared part by part. */
export function older(a: string, b: string): boolean {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0);
  }
  return false;
}

/**
 * How the Director in the game's folder stands to the version EDGEdir needs (`need`):
 * `noRednode` (REDnode is not in the game), `none`, `older`, or `ready` (the same or newer).
 */
export function installState(need: string, gamePath: string): "noRednode" | "none" | "older" | "ready" {
  if (!fs.existsSync(path.join(gamePath, "red4ext", "plugins", "REDnode"))) return "noRednode";
  const there = playerVersion(path.join(appsDir(gamePath), PlayerId));
  if (!there) return "none";
  return older(there, need) ? "older" : "ready";
}

/**
 * A developer's way in: copies a built Director (`source`, this repo's dist/director) into the game's
 * REDnode apps folder, over the one there. A player installs the release's zip instead. Answers the folder.
 */
export function install(source: string, gamePath: string): string {
  if (!playerVersion(source)) throw new Error(`No built EDGE Director is in ${source}: run npm run build in EDGEdir's repo first`);
  const to = path.join(appsDir(gamePath), PlayerId);
  fs.mkdirSync(to, { recursive: true });
  // The Director is a handful of files in one folder: its own are replaced, nothing else is touched.
  for (const name of fs.readdirSync(source)) {
    if (fs.statSync(path.join(source, name)).isFile()) fs.copyFileSync(path.join(source, name), path.join(to, name));
  }
  return to;
}

/** A play's state as one line for the editor, and whether it is bad news. */
export function lineOf(s: PlayState): { text: string; bad: boolean } {
  if (s.state === "failed") return { text: `Not played: ${s.text}`, bad: true };
  if (s.state === "playing") {
    const missed = (s.late ?? []).filter((c) => !c.ok).length;
    return { text: missed ? `Playing in the game; ${missed} jump${missed === 1 ? "" : "s"} did not land` : "Playing in the game", bad: missed > 0 };
  }
  return { text: s.text, bad: false };
}
