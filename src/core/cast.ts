// The cast: who can be an actor. The game's `Character` records, read once from the modder's own
// TweakDB through REDbridge and kept as JSON on the PC (never committed), as EDGEbuilder's list is
// (its src/npcs.ts); and V, the player, in each body. No VS Code imports. docs/d2-cast-and-clips.md.
import * as fs from "node:fs";
import * as path from "node:path";
import type { TweakRecords, TweakRecordsQuery } from "./types";

/** What the cast needs of a bridge. */
export interface CastBridge {
  tweakRecords(query: TweakRecordsQuery): Promise<TweakRecords>;
}

export type PlayerBody = "wa" | "ma";

/** One person the picker offers. */
export interface CastEntry {
  /** The TweakDB record, such as `Character.Judy`. Absent on V. */
  record?: string;
  /** V's body. Absent on everyone else. */
  player?: PlayerBody;
  /** The name shown, when the game has one. */
  name?: string;
  /** The entity file the record names. */
  entity: string;
  /** The appearance the record asks for, when it names one. */
  appearance?: string;
}

/** V in each body. The entities are the game's third-person player bodies. */
export const Players: Record<PlayerBody, CastEntry> = {
  wa: { player: "wa", name: "V (the player), feminine body", entity: "base\\characters\\entities\\player\\player_wa_tpp.ent" },
  ma: { player: "ma", name: "V (the player), masculine body", entity: "base\\characters\\entities\\player\\player_ma_tpp.ent" },
};

const Flats = ["fullDisplayName", "displayName", "entityTemplatePath", "appearanceName"];
const PageSize = 2000;

/** A LocKey flat's text, or a plain string; empty when there is none. */
function textOf(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "text" in v) return String((v as { text?: unknown }).text ?? "");
  return "";
}

/**
 * The picker's row for one record, or none. A record without an entity cannot be spawned; the
 * `_inline` ones are parts of other records; and the player's own records are left out, because V
 * is offered by `Players`.
 */
export function castEntry(item: TweakRecords["items"][number]): CastEntry | undefined {
  const record = item.path;
  if (!record || !/^Character\./i.test(record) || record.includes("_inline")) return undefined;
  if (/^Character\.Player_Puppet/i.test(record)) return undefined;
  const f = item.flats ?? {};
  const entity = typeof f.entityTemplatePath === "string" ? f.entityTemplatePath : "";
  if (!entity) return undefined;
  let name = textOf(f.fullDisplayName) || textOf(f.displayName);
  // The game's stand-ins for a missing name, and "V" on photo mode's copies of other people: such a
  // row is listed by its record's own name, so nobody but the player reads as V.
  if (/^(!OBSOLETE|\[No Data\]|V)$/i.test(name.trim())) name = "";
  const look = typeof f.appearanceName === "string" && f.appearanceName !== "None" ? f.appearanceName : "";
  return { record, entity, ...(name && !/^LocKey#/i.test(name) ? { name } : {}), ...(look ? { appearance: look } : {}) };
}

/** What a person is called in a list: the game's name, or the record's own last part. */
export function castLabel(e: CastEntry): string {
  return e.name ?? e.record?.replace(/^Character\./i, "") ?? "";
}

/** The entries whose name or record holds every word, V first, then named people, then by record. */
export function searchCast(entries: CastEntry[], text: string, limit = 200): CastEntry[] {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const all = [Players.wa, Players.ma, ...entries];
  const hits = words.length ? all.filter((e) => words.every((w) => `${e.name ?? ""} ${e.record ?? "player v"}`.toLowerCase().includes(w))) : all;
  return hits.slice(0, limit);
}

interface CastFile {
  format: 1;
  game: string;
  built: string;
  entries: CastEntry[];
}

export class Cast {
  entries: CastEntry[] = [];
  /** The game the list was read from, as `gameKey` names it; empty when none is loaded. */
  game = "";

  /** `dir` is EDGEdir's cache folder on the PC. */
  constructor(readonly dir: string) {}

  private fileFor(game: string): string {
    return path.join(this.dir, "cast", `${game}.json`);
  }

  /** Loads the list for this game, if one was read before. */
  load(game: string): boolean {
    try {
      const data = JSON.parse(fs.readFileSync(this.fileFor(game), "utf8")) as CastFile;
      if (data.format !== 1 || !Array.isArray(data.entries)) return false;
      this.game = game;
      this.entries = data.entries;
      return true;
    } catch {
      return false;
    }
  }

  /** Reads every `Character` record, in pages. The first TweakDB call takes about 12 s. */
  async build(bridge: CastBridge, game: string, progress?: (text: string) => void): Promise<void> {
    const entries: CastEntry[] = [];
    let offset = 0;
    let total = 0;
    do {
      const page = await bridge.tweakRecords({ type: "Character", flats: Flats, offset, limit: PageSize, resolveLocKeys: true });
      total = page.total;
      for (const item of page.items) {
        const e = castEntry(item);
        if (e) entries.push(e);
      }
      offset += page.items.length;
      progress?.(`Characters: ${Math.min(offset, total).toLocaleString()} of ${total.toLocaleString()} records read`);
      if (!page.items.length) break;
    } while (offset < total);
    // Named people first, by name; then the rest by record.
    entries.sort((a, b) => Number(!a.name) - Number(!b.name) || castLabel(a).localeCompare(castLabel(b)) || (a.record ?? "").localeCompare(b.record ?? ""));
    this.game = game;
    this.entries = entries;
    fs.mkdirSync(path.dirname(this.fileFor(game)), { recursive: true });
    const data: CastFile = { format: 1, game, built: new Date().toISOString(), entries };
    fs.writeFileSync(this.fileFor(game), JSON.stringify(data));
  }

  /** The entry for a record, any case. */
  find(record: string | undefined): CastEntry | undefined {
    if (!record) return undefined;
    const want = record.toLowerCase();
    return this.entries.find((e) => e.record?.toLowerCase() === want);
  }
}
