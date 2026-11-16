// The set level of the animation index: every `.anims` file in the game, by path, read from the
// archives through REDbridge and kept as JSON on the PC (never committed). The clip level (each
// set's animations) needs REDbridge's `anims.info` and comes with D2.5. No VS Code imports.
// docs/d2-cast-and-clips.md, "The animations".
import * as fs from "node:fs";
import * as path from "node:path";
import type { BridgeInfo, FileList } from "./types";

/** What the index needs of a bridge. */
export interface SetsBridge {
  list(params: { prefix?: string; offset?: number; limit?: number }): Promise<FileList>;
}

/** The key a cache is filed under: it changes when the game's archives do (a patch). */
export function gameKey(info: Pick<BridgeInfo, "archives"> & { files?: number }): string {
  return `${info.archives}-${info.files ?? 0}`;
}

const PageSize = 5000;
const Ending = ".anims";

interface SetsFile {
  format: 1;
  game: string;
  built: string;
  sets: string[];
}

/** One level of the sets' folder tree. */
export interface SetFolder {
  folders: { name: string; path: string; sets: number }[];
  /** The sets in this folder itself, as full game paths. */
  sets: string[];
}

export class AnimSets {
  /** Every set's game path, sorted, lower case as the archives give them. */
  sets: string[] = [];
  game = "";

  constructor(readonly dir: string) {}

  private fileFor(game: string): string {
    return path.join(this.dir, "anims", `${game}.sets.json`);
  }

  load(game: string): boolean {
    try {
      const data = JSON.parse(fs.readFileSync(this.fileFor(game), "utf8")) as SetsFile;
      if (data.format !== 1 || !Array.isArray(data.sets)) return false;
      this.game = game;
      this.sets = data.sets;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reads the names of every game file in pages and keeps the `.anims` ones. A search by name
   * returns at most 5,000 files and the game has more sets than that, so the whole list is paged.
   */
  async build(bridge: SetsBridge, game: string, progress?: (text: string) => void): Promise<void> {
    const found = new Set<string>();
    let offset = 0;
    let total = 0;
    do {
      const page = await bridge.list({ offset, limit: PageSize });
      total = page.total;
      for (const f of page.items) if (f.name.toLowerCase().endsWith(Ending)) found.add(f.name);
      offset += page.items.length;
      progress?.(`Animation files: ${Math.min(offset, total).toLocaleString()} of ${total.toLocaleString()} game files looked at, ${found.size.toLocaleString()} found`);
      if (!page.items.length) break;
    } while (offset < total);
    this.game = game;
    this.sets = [...found].sort((a, b) => a.localeCompare(b));
    fs.mkdirSync(path.dirname(this.fileFor(game)), { recursive: true });
    const data: SetsFile = { format: 1, game, built: new Date().toISOString(), sets: this.sets };
    fs.writeFileSync(this.fileFor(game), JSON.stringify(data));
  }

  /** The folders and sets directly under a folder; an empty path is the top. */
  folder(at = ""): SetFolder {
    return folderOf(this.sets, at);
  }

  /** The sets whose path holds every word. */
  search(text: string, limit = 500): { total: number; sets: string[] } {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return { total: 0, sets: [] };
    const hits = this.sets.filter((s) => words.every((w) => s.toLowerCase().includes(w)));
    return { total: hits.length, sets: hits.slice(0, limit) };
  }
}

/** One level of a sorted path list's folder tree. */
export function folderOf(sets: string[], at: string): SetFolder {
  const prefix = at ? `${at.replace(/\\+$/, "")}\\` : "";
  const folders = new Map<string, number>();
  const here: string[] = [];
  for (const s of sets) {
    if (!s.toLowerCase().startsWith(prefix.toLowerCase())) continue;
    const rest = s.slice(prefix.length);
    const cut = rest.indexOf("\\");
    if (cut < 0) here.push(s);
    else folders.set(rest.slice(0, cut), (folders.get(rest.slice(0, cut)) ?? 0) + 1);
  }
  return { folders: [...folders].map(([name, count]) => ({ name, path: prefix + name, sets: count })), sets: here };
}

/** A set's file name without its folder and ending. */
export function setName(setPath: string): string {
  return (setPath.split("\\").pop() ?? setPath).replace(/\.anims$/i, "");
}
