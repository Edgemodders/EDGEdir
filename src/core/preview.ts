// The preview's files (D3.1): each body and each animation the 3D view shows is exported once
// through REDbridge's project.export into EDGEdir's folder on the PC, as a .glb, and found there
// the next time. Bodies are exported without materials (docs/d3-preview.md, "What the spike found").
// The files are the modder's own game's and are never committed. No VS Code imports.
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { bodyKey, clipKey, type BodyWant, type ClipWant } from "../pose";
import type { EntityExport, ExportOptions, ModkitResult } from "./types";

/** What the store needs of a bridge. */
export interface PreviewBridge {
  extract(path: string, outFile: string): Promise<unknown>;
  exportFile(file: string, archiveDir: string, rawDir: string, options?: ExportOptions): Promise<ModkitResult>;
}

/** A file for the preview, and what there is to say about it. */
export interface PreviewFile {
  file: string;
  /** Found on the PC, not exported just now. */
  cached: boolean;
  /** What the body is and what was left out of it; empty for an animation. */
  notes: string[];
}

const BS = "\\";
const join = (...parts: string[]) => parts.join(BS);
const BaseEntities = join("base", "characters", "base_entities");
const BaseBodies = join("base", "characters", "common", "base_bodies");

/** A base body for a rig: its mesh, and the rigs its skin is joined from. */
export interface BaseBody {
  mesh: string;
  rigs: string[];
  label: string;
}

/**
 * The game's base body for a man's or a woman's base rig, which stands in for V: no V with a head
 * can be exported (the player's entities list no usable appearance). The body needs its
 * deformations rig too. The files' names are REDcode's (its src/animsGlb.ts, baseBodyFor).
 */
export function baseBodyFor(rig: string): BaseBody | undefined {
  const r = rig.replace(/\//g, BS).toLowerCase();
  for (const [who, short, label] of [
    ["man", "ma", "The game's base masculine body"],
    ["woman", "wa", "The game's base feminine body"],
  ] as const) {
    const base = join(BaseEntities, `${who}_base`);
    if (r === join(base, `${who}_base.rig`))
      return { mesh: join(BaseBodies, `${who}_average`, `t0_000_${short}_base__full.mesh`), rigs: [r, join(base, "deformations_rigs", `${who}_base_deformations.rig`)], label };
  }
  return undefined;
}

const hash = (text: string) => crypto.createHash("sha1").update(text).digest("hex").slice(0, 16);

interface Side {
  key: string;
  notes: string[];
}

export class PreviewStore {
  /** One export at a time: they share the work folder. */
  private queue: Promise<unknown> = Promise.resolve();
  private readonly running = new Map<string, Promise<PreviewFile>>();

  /** `dir` is EDGEdir's cache folder on the PC. */
  constructor(readonly dir: string) {}

  /** The folder the page may read: every file the preview loads is in it. */
  get root(): string {
    return path.join(this.dir, "preview");
  }

  private fileFor(game: string, key: string): string {
    return path.join(this.root, game, `${hash(key)}.glb`);
  }

  /** The file for a key, if it was exported before. */
  private known(game: string, key: string): PreviewFile | undefined {
    const file = this.fileFor(game, key);
    if (!fs.existsSync(file)) return undefined;
    let notes: string[] = [];
    try {
      notes = (JSON.parse(fs.readFileSync(`${file}.json`, "utf8")) as Side).notes ?? [];
    } catch {
      // No notes were kept.
    }
    return { file, cached: true, notes };
  }

  /** Runs `make` once per key even when asked twice at once, and after every export before it. */
  private once(game: string, key: string, make: (file: string) => Promise<string[]>): Promise<PreviewFile> {
    const have = this.known(game, key);
    if (have) return Promise.resolve(have);
    const id = `${game}|${key}`;
    let run = this.running.get(id);
    if (!run) {
      const next = this.queue.then(async () => {
        const file = this.fileFor(game, key);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const notes = await make(file);
        const side: Side = { key, notes };
        fs.writeFileSync(`${file}.json`, JSON.stringify(side));
        return { file, cached: false, notes };
      });
      this.queue = next.catch(() => undefined);
      run = next.finally(() => this.running.delete(id));
      this.running.set(id, run);
    }
    return run;
  }

  /** Exports one game file to a .glb at `file`, through a work folder that is emptied after. */
  private async export(bridge: PreviewBridge, gamePath: string, options: ExportOptions, file: string): Promise<ModkitResult> {
    const work = path.join(this.root, "work");
    const archiveDir = path.join(work, "archive");
    const rawDir = path.join(work, "raw");
    fs.rmSync(work, { recursive: true, force: true });
    try {
      const source = path.join(archiveDir, ...gamePath.replace(/\//g, BS).split(BS));
      fs.mkdirSync(path.dirname(source), { recursive: true });
      await bridge.extract(gamePath, source);
      const result = await bridge.exportFile(source, archiveDir, rawDir, { meshBinary: true, ...options });
      const glb = result.written.map((w) => (path.isAbsolute(w) ? w : path.join(rawDir, w))).find((w) => w.toLowerCase().endsWith(".glb") && fs.existsSync(w));
      if (!glb) throw new Error(`REDbridge wrote no .glb for ${gamePath}`);
      fs.copyFileSync(glb, file);
      return result;
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  }

  /**
   * An actor's body. `appearance` is the one to show when the actor names none: the entity's first.
   * V is the base body of V's rig.
   */
  body(bridge: PreviewBridge, game: string, want: BodyWant, firstAppearance?: () => Promise<string | undefined>): Promise<PreviewFile> {
    return this.once(game, bodyKey(want), async (file) => {
      if (want.player) {
        const base = baseBodyFor(want.rig ?? "");
        if (!base) throw new Error("EDGEdir knows no base body for this rig (only the feminine and masculine base rigs have one)");
        await this.export(bridge, base.mesh, { rigs: base.rigs, meshMaterials: false }, file);
        return [`${base.label}, standing in for your V`];
      }
      if (!want.entity) throw new Error("The actor's entity is not known yet. Choose the actor again with the game's files there");
      const appearance = want.appearance ?? (await firstAppearance?.()) ?? "default";
      const result = await this.export(bridge, want.entity, { appearance, meshMaterials: false }, file);
      return entityNotes(result.entity ?? undefined, appearance);
    });
  }

  /** One animation of a game file, in place (no root motion: the game does not apply it either). */
  clip(bridge: PreviewBridge, game: string, want: ClipWant): Promise<PreviewFile> {
    return this.once(game, clipKey(want), async (file) => {
      if (!want.set) throw new Error("That is a made animation: it is loaded from its own file");
      await this.export(bridge, want.set, { animations: [want.name], rootMotion: false } as ExportOptions, file);
      return [];
    });
  }

  /**
   * A made animation's own .glb, copied in so the page may read it. Copied again when the file
   * changed. Needs no game and no bridge.
   */
  made(id: string, source: string): PreviewFile {
    const stat = fs.statSync(source);
    const file = path.join(this.root, "made", `${hash(`${id}|${stat.size}|${stat.mtimeMs}`)}.glb`);
    if (fs.existsSync(file)) return { file, cached: true, notes: [] };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.copyFileSync(source, file);
    return { file, cached: false, notes: [] };
  }
}

/** What an entity export put on the skeleton and what it left out, in sentences. */
export function entityNotes(entity: EntityExport | undefined, appearance: string): string[] {
  if (!entity) return [`Appearance ${appearance}`];
  const notes = [`Appearance ${entity.appearance || appearance}: ${entity.meshes.length.toLocaleString()} meshes on ${entity.joints.toLocaleString()} joints`];
  for (const x of entity.leftOut ?? []) notes.push(`Left out ${x.component ?? x.mesh ?? "a component"}${x.why ? `: ${x.why}` : ""}`);
  return notes;
}
