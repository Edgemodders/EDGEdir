// The Desk: EDGEdir's own scratch space, where scenes wait until they go into a project or the
// Library. One folder a scene, in the shared Library's item shape (EDGEbuilder's docs/library.md,
// "Shared rules"), so Add to Library (D7) is a copy:
//   <desk>\<name>.act.asset\asset.json
//   <desk>\<name>.act.asset\source\raw\edgedir\<name>.edgedir
// The kind is `act`: EDGEbuilder's Library already uses `scene`. No VS Code in here.
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Extension, formatDoc, newDoc, parseDoc } from "./doc";

export const Kind = "act";
const Ending = `.${Kind}.asset`;

/** The Desk's folder: `%LOCALAPPDATA%\EDGEdir\desk`. */
export function deskDir(): string {
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  return path.join(local, "EDGEdir", "desk");
}

/** A scene's `asset.json`: the fields every EDGE tool relies on. */
export interface Asset {
  format: 1;
  /** Made once and never changed. */
  id: string;
  name: string;
  kind: typeof Kind;
  /** The scene document's path in the item, with `/`. */
  main: string;
  /** Raised by each change that Add to Library carries (D7). */
  version: number;
  [more: string]: unknown;
}

export interface DeskScene {
  /** The modder's name for it. */
  name: string;
  /** The item's folder. */
  folder: string;
  /** The scene document. */
  file: string;
  id: string;
  /** When the document last changed. */
  modified: number;
}

/** The name as a file name: Windows' forbidden characters and trailing dots and spaces taken out. */
export function fileName(name: string): string {
  // eslint-disable-next-line no-control-regex
  const clean = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, " ").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "");
  if (!clean) throw new Error("A scene needs a name");
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(clean)) throw new Error(`"${clean}" is a name Windows keeps for itself`);
  if (clean.length > 80) throw new Error("That name is too long (80 characters at most)");
  return clean;
}

const mainOf = (file: string) => `source/raw/edgedir/${file}${Extension}`;

/** A new scene on the Desk, with an empty document. Throws when the name is taken. */
export function newScene(name: string, base = deskDir()): DeskScene {
  const file = fileName(name);
  const folder = path.join(base, file + Ending);
  if (fs.existsSync(folder)) throw new Error(`The Desk already has a scene named "${file}"`);
  const main = mainOf(file);
  const asset: Asset = { format: 1, id: crypto.randomBytes(8).toString("hex"), name: name.trim(), kind: Kind, main, version: 1 };
  const doc = path.join(folder, ...main.split("/"));
  fs.mkdirSync(path.dirname(doc), { recursive: true });
  fs.writeFileSync(path.join(folder, "asset.json"), JSON.stringify(asset, null, 2) + "\n");
  fs.writeFileSync(doc, formatDoc(newDoc(name.trim())));
  return { name: asset.name, folder, file: doc, id: asset.id, modified: Date.now() };
}

function readAsset(folder: string): Asset | undefined {
  try {
    const a = JSON.parse(fs.readFileSync(path.join(folder, "asset.json"), "utf8")) as Asset;
    return a && typeof a.id === "string" && typeof a.main === "string" ? a : undefined;
  } catch {
    return undefined;
  }
}

/** The Desk's scenes, the last changed first. Folders that are not scenes are left out. */
export function listDesk(base = deskDir()): DeskScene[] {
  let names: string[];
  try {
    names = fs.readdirSync(base);
  } catch {
    return [];
  }
  const scenes: DeskScene[] = [];
  for (const entry of names) {
    if (!entry.toLowerCase().endsWith(Ending)) continue;
    const folder = path.join(base, entry);
    const asset = readAsset(folder);
    if (!asset) continue;
    const file = path.join(folder, ...asset.main.split("/"));
    try {
      // The folder's name wins over asset.json, as the Library's rules say.
      scenes.push({ name: entry.slice(0, -Ending.length), folder, file, id: asset.id, modified: fs.statSync(file).mtimeMs });
    } catch {
      // The document is gone: not a scene any more.
    }
  }
  return scenes.sort((a, b) => b.modified - a.modified);
}

/** The Desk scene a document belongs to, if it is on the Desk. */
export function deskSceneOf(file: string, base = deskDir()): DeskScene | undefined {
  const target = path.resolve(file).toLowerCase();
  return listDesk(base).find((s) => path.resolve(s.file).toLowerCase() === target);
}

/**
 * A Desk scene under a new name: its folder, its document, `asset.json` and the document's own
 * name. The id stays. Throws when the name is taken. The scene must not be open with unsaved changes.
 */
export function renameScene(scene: DeskScene, name: string, base = deskDir()): DeskScene {
  const file = fileName(name);
  const folder = path.join(base, file + Ending);
  const sameFolder = path.resolve(folder).toLowerCase() === path.resolve(scene.folder).toLowerCase();
  if (!sameFolder && fs.existsSync(folder)) throw new Error(`The Desk already has a scene named "${file}"`);
  const asset = readAsset(scene.folder);
  if (!asset) throw new Error("That scene is no longer on the Desk");
  // Inside the folder first, so a failure half way leaves a folder that still lists.
  const main = mainOf(file);
  const oldDoc = path.join(scene.folder, ...asset.main.split("/"));
  const newDocPath = path.join(scene.folder, ...main.split("/"));
  if (oldDoc !== newDocPath) fs.renameSync(oldDoc, newDocPath);
  try {
    const doc = parseDoc(fs.readFileSync(newDocPath, "utf8"));
    fs.writeFileSync(newDocPath, formatDoc({ ...doc, name: name.trim() }));
  } catch {
    // A document that cannot be read keeps its text; the scene is renamed around it.
  }
  fs.writeFileSync(path.join(scene.folder, "asset.json"), JSON.stringify({ ...asset, name: name.trim(), main }, null, 2) + "\n");
  if (scene.folder !== folder) fs.renameSync(scene.folder, folder);
  return { name: file, folder, file: path.join(folder, ...main.split("/")), id: asset.id, modified: Date.now() };
}
