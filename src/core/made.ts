// Made animations (D2.7): the ones EDGEfab stores, each by itself, in the EDGE Library and in the
// open REDcode project. The shape is EDGEfab's, agreed on its issue #7 (docs/design.md, "Animations
// and actors"); EDGEdir only reads it. No VS Code imports.
//
//   Library:  <any folder>\<name>.anim.asset\asset.json   { kind: "anim", id, name, main, anim: {...} }
//             the clip is the item's `main` when that is a .glb, else the first .glb under its source\raw
//   Project:  source\raw\<mod>\anims\<name>\<name>.edgefab.json   { kind: "anim", id, anim: {...} }
//             beside its <name>.glb. The record is what EDGEdir finds it by, not the folder.
//   The facts, in both: anim: { rig, seconds, fps, rootMotion, loop, name }
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface MadeAnim {
  source: "library" | "project";
  /** The item's id: what a clip names it by. It never changes. */
  id: string;
  /** The item's name, as the modder gave it. */
  title: string;
  /** The animation's name inside its file. */
  name: string;
  /** The rig it is made for, a game path; empty when the item does not say. */
  rig: string;
  seconds: number;
  fps: number;
  rootMotion: boolean;
  loop: boolean;
  /** The clip's glTF on disk; empty when it is missing. */
  file: string;
  /** The item's folder (Library) or the record's file (project). */
  where: string;
}

/** Where the EDGE tools keep the Library's root: `%APPDATA%\EDGE\library.json`, `{ "root": ... }`. */
export function libraryConfigFile(): string {
  return process.env.EDGE_LIBRARY_CONFIG ?? path.join(process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"), "EDGE", "library.json");
}

/** The Library's root folder, or undefined when no tool has set one up or it is gone. */
export function libraryRoot(file = libraryConfigFile()): string | undefined {
  try {
    const root = (JSON.parse(fs.readFileSync(file, "utf8")) as { root?: unknown }).root;
    return typeof root === "string" && root && fs.existsSync(root) ? root : undefined;
  } catch {
    return undefined;
  }
}

type Json = Record<string, unknown>;
const readJson = (file: string): Json | undefined => {
  try {
    const v = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : undefined;
  } catch {
    return undefined;
  }
};
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** The item from its facts, or none when it has no id or no length: EDGEdir could not place it on a lane. */
function made(source: MadeAnim["source"], data: Json, title: string, file: string, where: string): MadeAnim | undefined {
  const anim = data.anim && typeof data.anim === "object" ? (data.anim as Json) : undefined;
  const id = str(data.id);
  if (data.kind !== "anim" || !id || !anim || num(anim.seconds) <= 0) return undefined;
  return {
    source,
    id,
    title,
    name: str(anim.name) || title,
    rig: str(anim.rig),
    seconds: num(anim.seconds),
    fps: num(anim.fps) || 30,
    rootMotion: anim.rootMotion === true,
    loop: anim.loop === true,
    file: fs.existsSync(file) ? file : "",
    where,
  };
}

/** Every folder or file under a folder that `take` accepts; it does not look inside what it takes. */
function walk(dir: string, take: (full: string, entry: fs.Dirent) => boolean, depth = 0): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (take(full, e)) continue;
    if (e.isDirectory() && depth < 16) walk(full, take, depth + 1);
  }
}

const firstGlb = (dir: string): string => {
  let found = "";
  walk(dir, (full, e) => {
    if (!found && e.isFile() && /\.glb$/i.test(e.name)) found = full;
    return !!found;
  });
  return found;
};

/** The animations kept in the Library, by title. */
export function libraryAnims(root: string | undefined): MadeAnim[] {
  if (!root) return [];
  const out: MadeAnim[] = [];
  walk(root, (full, e) => {
    if (!e.isDirectory() || !/\.[a-z0-9_-]+\.asset$/i.test(e.name)) return false;
    // An item of any kind is not looked into further; only `anim` items are taken.
    if (!/\.anim\.asset$/i.test(e.name)) return true;
    const asset = readJson(path.join(full, "asset.json"));
    if (!asset) return true;
    const main = str(asset.main);
    const glb = /\.glb$/i.test(main) ? path.join(full, ...main.split("/")) : firstGlb(path.join(full, "source", "raw"));
    const item = made("library", asset, str(asset.name) || e.name.replace(/\.anim\.asset$/i, ""), glb, full);
    if (item) out.push(item);
    return true;
  });
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

/** The animations in a REDcode project, found by their records under `source\raw`. */
export function projectAnims(projectDir: string | undefined): MadeAnim[] {
  if (!projectDir) return [];
  const out: MadeAnim[] = [];
  walk(path.join(projectDir, "source", "raw"), (full, e) => {
    if (!e.isFile() || !/\.edgefab\.json$/i.test(e.name)) return false;
    const record = readJson(full);
    const title = e.name.replace(/\.edgefab\.json$/i, "");
    const item = record && made("project", record, str(record.name) || title, path.join(path.dirname(full), `${title}.glb`), full);
    if (item) out.push(item);
    return true;
  });
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

/** One made animation by its id: the open project's copy before the Library's, since it is the one that is packed. */
export function findMade(id: string, project: MadeAnim[], library: MadeAnim[]): MadeAnim | undefined {
  return project.find((a) => a.id === id) ?? library.find((a) => a.id === id);
}
