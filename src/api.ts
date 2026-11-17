// EDGEdir's extension API (D2.8): a search of its animation index for the other EDGE tools, so
// they do not build their own (EDGEfab #7). It reads only; nothing here changes a scene or a file.
// The shape follows the other tools': an integer `apiVersion`, the tool's `version`, members added
// within a version, a breaking change raises `apiVersion`. docs/api.md.
import type * as vscode from "vscode";
import { sameRig } from "./core/entity";
import type { Game } from "./game";

export interface AnimationInfo {
  source: "game" | "library" | "project";
  /** A game animation: its `.anims` file's game path. */
  set?: string;
  /** A made animation: its item's id. */
  id?: string;
  /** The animation's name in its file. */
  name: string;
  /** The rig it is made for, a game path; empty when not known. */
  rig: string;
  seconds: number;
  frames: number;
  fps: number;
  additive: boolean;
  rootMotion: boolean;
  /** A made animation's glTF on disk, when it is there. */
  file?: string;
  /** A made animation that is made to loop. Absent on the game's: their files do not say. */
  loop?: boolean;
}

export interface AnimationQuery {
  /** Every word must be in the animation's name or its file's path. */
  text?: string;
  /** A rig's game path: only animations made for it. */
  rig?: string;
  /** Only the game animations in the files this entity lists. */
  entity?: { path: string; appearance?: string };
  /** Where to look; all three when absent. */
  source?: ("game" | "library" | "project")[];
  /** 200 when absent, 5,000 at most. Made animations come first and count toward it. */
  limit?: number;
}

export interface EntitySet {
  path: string;
  use: "gameplay" | "cinematics";
  priority: number;
}

export interface EDGEdirApi {
  readonly apiVersion: 1;
  readonly version: string;
  /**
   * How far the index of the game's animations is. "none": the game is not read. "sets": the files
   * are listed, the animations inside them not (yet, or the REDbridge is too old). "clips": complete.
   */
  indexState(): { level: "none" | "sets" | "clips"; game?: string; sets: number; clips: number; building: boolean };
  /** Finds the game and reads what is not read yet, with EDGEdir's own progress notes. Resolves when the file list is there; the animations go on in the background (`onDidChangeIndex`). */
  buildIndex(): Promise<void>;
  /** The index, or the made animations, changed. */
  readonly onDidChangeIndex: vscode.Event<void>;
  searchAnimations(query: AnimationQuery): Promise<{ total: number; items: AnimationInfo[] }>;
  /** The body's rig and the animation files an entity lists, gameplay before cinematics; and the same for each animated component (the body first), for an object with more than one. `appearance` is taken but not read yet: the appearance's own file may add files. */
  entityAnimSets(path: string, appearance?: string): Promise<{ rig: string; sets: EntitySet[]; components: { name: string; rig: string; sets: EntitySet[] }[] }>;
}

export function makeApi(version: string, game: Game): EDGEdirApi {
  return {
    apiVersion: 1,
    version,
    indexState() {
      const ready = game.state === "ready";
      const level = !ready ? "none" : game.index.complete ? "clips" : "sets";
      return { level, game: ready ? game.sets.game : undefined, sets: ready ? game.sets.sets.length : 0, clips: ready ? game.index.clips : 0, building: game.state === "loading" || game.readingClips };
    },
    buildIndex: () => game.refresh(),
    onDidChangeIndex: game.onDidChange,
    async searchAnimations(query) {
      const limit = Math.max(1, Math.min(query.limit ?? 200, 5000));
      const from = new Set(query.source ?? ["game", "library", "project"]);
      const words = (query.text ?? "").toLowerCase().split(/\s+/).filter(Boolean);
      const items: AnimationInfo[] = [];
      let total = 0;
      // Made animations are not in any entity's files.
      if (!query.entity) {
        const made = game.made();
        const lists = [...(from.has("project") ? made.project : []), ...(from.has("library") ? made.library.filter((l) => !from.has("project") || !made.project.some((p) => p.id === l.id)) : [])];
        for (const a of lists) {
          if (!words.every((w) => `${a.title} ${a.name}`.toLowerCase().includes(w)) || (query.rig && !sameRig(a.rig, query.rig))) continue;
          total++;
          if (items.length < limit) items.push({ source: a.source, id: a.id, name: a.name, rig: a.rig, seconds: a.seconds, frames: Math.round(a.seconds * a.fps) + 1, fps: a.fps, additive: false, rootMotion: a.rootMotion, ...(a.file ? { file: a.file } : {}), ...(a.loop ? { loop: true } : {}) });
        }
      }
      if (from.has("game") && game.state === "ready") {
        const sets = query.entity ? (await game.entity(query.entity.path)).sets.map((s) => s.path) : undefined;
        const found = game.index.search({ text: query.text, rig: query.rig, sets, limit: Math.max(1, limit - items.length) });
        total += found.total;
        for (const f of found.items) if (items.length < limit) items.push({ source: "game", set: f.set, name: f.clip.name, rig: f.rig, seconds: f.clip.seconds, frames: f.clip.frames, fps: f.clip.fps, additive: f.clip.additive, rootMotion: f.clip.rootMotion });
      }
      return { total, items };
    },
    async entityAnimSets(path) {
      const facts = await game.entity(path);
      return { rig: facts.rig, sets: facts.sets, components: facts.components };
    },
  };
}
