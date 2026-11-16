// The clip level of the animation index (D2.5): each game `.anims` file's rig and animations, read
// with REDbridge's `anims.info` (its release after 0.13.0) and kept as JSON on the PC, never
// committed. Reading the whole game takes minutes, so it is read in pages, saved as it goes, and
// picked up where it stopped. No VS Code imports. docs/d2-cast-and-clips.md, "The animations".
import * as fs from "node:fs";
import * as path from "node:path";
import { sameRig } from "./entity";

export interface ClipFacts {
  name: string;
  seconds: number;
  frames: number;
  fps: number;
  /** An additive clip is laid over another; it is not a whole pose by itself. */
  additive: boolean;
  rootMotion: boolean;
}

export interface SetFacts {
  /** The `.anims` file's game path. */
  path: string;
  /** The rig the set is made for; empty when the file names none. */
  rig: string;
  clips: ClipFacts[];
}

/** One animation, found. */
export interface FoundClip {
  set: string;
  rig: string;
  clip: ClipFacts;
}

/** What `anims.info` answers for one file. */
interface InfoItem {
  path: string;
  rig?: string | null;
  clips?: { name: string; duration: number; frames: number; fps: number; type?: string; rootMotion?: string | null }[] | null;
  error?: string | null;
}
interface InfoPage {
  total: number;
  offset: number;
  items: InfoItem[];
}

/** What the index needs of a bridge: any method by name. */
export interface InfoBridge {
  request<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
}

/** Whether a bridge's error says it has no such method: a REDbridge from before `anims.info`. */
export function isNoSuchMethod(e: unknown): boolean {
  return (e as { code?: number } | undefined)?.code === -32601 || /No method by the name/i.test((e as Error | undefined)?.message ?? "");
}

const PageSize = 500;
const SaveEvery = 4;

// On disk a clip is [name, seconds, frames, fps, flags] and a set [path, rig's index, clips]: the
// whole game is some 150,000 clips, and names repeat less than the field names would.
type DiskClip = [string, number, number, number, number];
interface IndexFile {
  format: 1;
  game: string;
  total: number;
  done: number;
  failed: number;
  rigs: string[];
  sets: [string, number, DiskClip[]][];
}

export interface ClipQuery {
  /** Every word must be in the clip's name or its set's path. */
  text?: string;
  /** Only clips made for this rig. */
  rig?: string;
  /** Only clips in these sets (game paths, any case). */
  sets?: Iterable<string>;
  /** Leave additive clips out: they are not whole poses. */
  whole?: boolean;
  limit?: number;
}

export class AnimIndex {
  game = "";
  /** How many of the game's sets `anims.info` counts, and how many have been read. */
  total = 0;
  done = 0;
  /** Sets the bridge could not read. */
  failed = 0;
  private readonly bySet = new Map<string, SetFacts>();
  private clipCount = 0;

  constructor(readonly dir: string) {}

  private fileFor(game: string): string {
    return path.join(this.dir, "anims", `${game}.clips.json`);
  }

  get complete(): boolean {
    return this.total > 0 && this.done >= this.total;
  }
  get clips(): number {
    return this.clipCount;
  }
  get setsRead(): number {
    return this.bySet.size;
  }

  private clear(game: string): void {
    this.game = game;
    this.total = this.done = this.failed = this.clipCount = 0;
    this.bySet.clear();
  }

  private add(set: SetFacts): void {
    const key = set.path.toLowerCase();
    this.clipCount += set.clips.length - (this.bySet.get(key)?.clips.length ?? 0);
    this.bySet.set(key, set);
  }

  /** Loads what was read before for this game, whole or part. */
  load(game: string): boolean {
    try {
      const data = JSON.parse(fs.readFileSync(this.fileFor(game), "utf8")) as IndexFile;
      if (data.format !== 1 || !Array.isArray(data.sets)) return false;
      this.clear(game);
      this.total = data.total;
      this.done = data.done;
      this.failed = data.failed ?? 0;
      for (const [setPath, rig, clips] of data.sets)
        this.add({ path: setPath, rig: data.rigs[rig] ?? "", clips: clips.map(([name, seconds, frames, fps, flags]) => ({ name, seconds, frames, fps, additive: !!(flags & 1), rootMotion: !!(flags & 2) })) });
      return true;
    } catch {
      return false;
    }
  }

  save(): void {
    const rigs: string[] = [];
    const rigIndex = new Map<string, number>();
    const sets: IndexFile["sets"] = [];
    for (const s of this.bySet.values()) {
      let r = rigIndex.get(s.rig);
      if (r === undefined) {
        r = rigs.push(s.rig) - 1;
        rigIndex.set(s.rig, r);
      }
      sets.push([s.path, r, s.clips.map((c) => [c.name, c.seconds, c.frames, c.fps, (c.additive ? 1 : 0) | (c.rootMotion ? 2 : 0)])]);
    }
    const data: IndexFile = { format: 1, game: this.game, total: this.total, done: this.done, failed: this.failed, rigs, sets };
    fs.mkdirSync(path.dirname(this.fileFor(this.game)), { recursive: true });
    // Written beside and renamed, so a window closed mid-write leaves the last good file.
    const temp = `${this.fileFor(this.game)}.part`;
    fs.writeFileSync(temp, JSON.stringify(data));
    fs.renameSync(temp, this.fileFor(this.game));
  }

  /**
   * Reads the sets not read yet, from where the last run stopped. Returns false, having read
   * nothing, when the bridge has no `anims.info`. `again` starts from the first set.
   */
  async build(bridge: InfoBridge, game: string, opts: { again?: boolean; progress?: (text: string) => void; stop?: () => boolean } = {}): Promise<boolean> {
    if (opts.again || this.game !== game) this.clear(game);
    let pages = 0;
    while (!this.complete) {
      if (opts.stop?.()) break;
      let page: InfoPage;
      try {
        page = await bridge.request<InfoPage>("anims.info", { offset: this.done, limit: PageSize });
      } catch (e) {
        if (isNoSuchMethod(e)) return false;
        throw e;
      }
      this.total = page.total;
      for (const item of page.items) {
        if (item.error || !item.clips) {
          this.failed++;
          continue;
        }
        this.add({
          path: item.path,
          rig: item.rig ?? "",
          clips: item.clips.map((c) => ({ name: c.name, seconds: c.duration, frames: c.frames, fps: c.fps, additive: !!c.type && c.type !== "Normal", rootMotion: !!c.rootMotion })),
        });
      }
      this.done += page.items.length;
      opts.progress?.(`Animations: ${Math.min(this.done, this.total).toLocaleString()} of ${this.total.toLocaleString()} files read, ${this.clipCount.toLocaleString()} animations`);
      if (!page.items.length) {
        // The bridge gave fewer than it counted: what there is, is all.
        this.total = this.done;
        break;
      }
      if (++pages % SaveEvery === 0) this.save();
    }
    this.save();
    return true;
  }

  /** A set's facts; undefined when it has not been read (yet). */
  set(setPath: string): SetFacts | undefined {
    return this.bySet.get(setPath.toLowerCase());
  }

  /** One animation by its set and name. */
  find(setPath: string, name: string): FoundClip | undefined {
    const s = this.set(setPath);
    const clip = s?.clips.find((c) => c.name === name);
    return s && clip ? { set: s.path, rig: s.rig, clip } : undefined;
  }

  /** The animations a query finds, in the sets' order. `total` counts them all; `items` stops at the limit. */
  search(q: ClipQuery): { total: number; items: FoundClip[] } {
    const words = (q.text ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const only = q.sets ? new Set([...q.sets].map((s) => s.toLowerCase())) : undefined;
    const limit = Math.max(1, Math.min(q.limit ?? 200, 5000));
    const items: FoundClip[] = [];
    let total = 0;
    for (const [key, s] of this.bySet) {
      if (only && !only.has(key)) continue;
      if (q.rig && !sameRig(s.rig, q.rig)) continue;
      // Words the set's path already has need not be in the clip's name.
      const left = words.filter((w) => !key.includes(w));
      for (const clip of s.clips) {
        if (q.whole && clip.additive) continue;
        if (left.length) {
          const name = clip.name.toLowerCase();
          if (!left.every((w) => name.includes(w))) continue;
        }
        if (++total <= limit) items.push({ set: s.path, rig: s.rig, clip });
      }
    }
    return { total, items };
  }
}
