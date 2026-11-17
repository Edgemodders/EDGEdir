// Sets on disk (D5a): EDGEbuilder's scene files, found by their `.scene.json` ending in the EDGE
// Library and in the open REDcode project's `source/scenes`. Read only: EDGEdir never writes one.
// EDGEbuilder's "This PC" scenes are its own Desk and are not read. No VS Code here.
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseSet, type SetInfo, type SetLink } from "./set";

export const SetEnding = ".scene.json";

/** One set file. */
export interface SetFile {
  where: SetLink["where"];
  /** Its path from the Library's root or the project's folder, with `/`. */
  path: string;
  file: string;
  /** The name in the file, or the file's name when it cannot be read. */
  name: string;
  people: number;
  vehicles: number;
  props: number;
  modified: number;
  /** Why the file cannot be read as a set, in words. */
  error?: string;
}

/** As EDGEbuilder walks the Library (its `scanShelf`): not into bakes, asset items, dot folders or `node_modules`, and 8 folders deep at most. */
function walk(dir: string, found: (file: string) => void, depth = 0): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (e.isFile() && e.name.toLowerCase().endsWith(SetEnding)) found(full);
    else if (e.isDirectory() && depth < 8 && e.name !== "node_modules" && !/\.(bake|asset)$/i.test(e.name)) walk(full, found, depth + 1);
  }
}

export const hashOf = (text: string) => `sha256:${crypto.createHash("sha256").update(text).digest("hex")}`;

function describe(where: SetFile["where"], root: string, file: string): SetFile {
  const base = { where, path: path.relative(root, file).split(path.sep).join("/"), file, modified: 0 };
  const fallback = path.basename(file).slice(0, -SetEnding.length);
  try {
    const info = parseSet(fs.readFileSync(file, "utf8"));
    return { ...base, modified: fs.statSync(file).mtimeMs, name: info.name || fallback, people: info.people.length, vehicles: info.vehicles, props: info.props.length };
  } catch (e) {
    return { ...base, name: fallback, people: 0, vehicles: 0, props: 0, error: (e as Error).message };
  }
}

/** Every set in the Library and in the open project, by name. */
export function findSets(libraryRoot: string | undefined, projectDir: string | undefined): SetFile[] {
  const out: SetFile[] = [];
  if (projectDir) walk(path.join(projectDir, "source", "scenes"), (f) => out.push(describe("project", projectDir, f)));
  if (libraryRoot) walk(libraryRoot, (f) => out.push(describe("library", libraryRoot, f)));
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** The file a link names, under the roots there are now; undefined when its root is not there. */
export function fileOf(link: Pick<SetLink, "where" | "path">, libraryRoot: string | undefined, projectDir: string | undefined): string | undefined {
  const root = link.where === "library" ? libraryRoot : projectDir;
  if (!root) return undefined;
  const file = path.resolve(root, ...link.path.split("/"));
  // A link never leads out of its root.
  return file.toLowerCase().startsWith(path.resolve(root).toLowerCase() + path.sep) ? file : undefined;
}

/** A linked set as it is now, or why it cannot be read. */
export function readSet(link: Pick<SetLink, "where" | "path">, libraryRoot: string | undefined, projectDir: string | undefined): { info: SetInfo; hash: string } | { why: string } {
  const file = fileOf(link, libraryRoot, projectDir);
  if (!file) return { why: link.where === "library" ? "The EDGE Library was not found on this PC" : "The set is in a REDcode project that is not open" };
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return { why: `The set's file is not there any more (${link.path}). It may have been renamed or moved` };
  }
  try {
    return { info: parseSet(text), hash: hashOf(text) };
  } catch (e) {
    return { why: `The set's file cannot be read: ${(e as Error).message}` };
  }
}
