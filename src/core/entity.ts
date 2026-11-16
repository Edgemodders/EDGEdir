// What EDGEdir reads from a character's entity file (`.ent`), given as WolvenKit JSON (REDbridge's
// `cr2w.toJson`): the body's rig, the appearances, and the animation sets the entity carries.
// No VS Code imports. docs/d2-cast-and-clips.md, "The actor".
//
// The rule for the body's rig, read on game 2.5 from a main character and from V's third-person
// bodies (2026-11-16): an entity has several `entAnimatedComponent`s (the body, the deformations,
// sometimes more); the body's is the one named `root`. When none has that name, the first whose rig
// is not a deformations rig is taken. V's feminine third-person body names the same rig as other
// women's, so their animations fit V.

export interface EntityAnimSet {
  /** The `.anims` file's game path. */
  path: string;
  use: "gameplay" | "cinematics";
  priority: number;
}

export interface EntityFacts {
  /** The body's rig, a game path; empty when the entity has no animated body. */
  rig: string;
  /** The appearances' names, in the file's order. */
  appearances: string[];
  /** The sets the body's component lists, gameplay before cinematics. The appearance's own file may add more. */
  sets: EntityAnimSet[];
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json | undefined => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : undefined);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** A CName's or a path's text: `{ $value }`, or the string itself. */
function text(v: unknown): string {
  if (typeof v === "string") return v;
  const value = obj(v)?.$value;
  return typeof value === "string" ? value : "";
}

/** A resource reference's game path; empty when it is unset or only a hash. */
function depot(v: unknown): string {
  const p = obj(obj(v)?.DepotPath);
  return p && p.$storage === "string" ? text(p) : "";
}

const isDeformations = (rig: string) => /deformations_rigs|_deformations\.rig$/i.test(rig);

function setsOf(component: Json): EntityAnimSet[] {
  const setup = obj(component.animations);
  const out: EntityAnimSet[] = [];
  for (const use of ["gameplay", "cinematics"] as const)
    for (const entry of arr(setup?.[use])) {
      const e = obj(entry);
      const path = depot(e?.animSet);
      if (path && !out.some((s) => s.path.toLowerCase() === path.toLowerCase() && s.use === use)) out.push({ path, use, priority: typeof e?.priority === "number" ? e.priority : 0 });
    }
  return out;
}

/** Reads an entity's JSON text. Throws with a message fit to show when it is not an entity. */
export function readEntity(json: string): EntityFacts {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    throw new Error(`The entity's JSON cannot be read: ${(e as Error).message}`);
  }
  const root = obj(obj(obj(raw)?.Data)?.RootChunk) ?? obj(raw);
  if (!root || !("appearances" in root || "compiledData" in root)) throw new Error("This file is not an entity");
  const appearances = arr(root.appearances)
    .map((a) => text(obj(a)?.name))
    .filter(Boolean);
  // The compiled components are what the game loads; `components` is the editor's copy of them.
  const compiled = arr(obj(obj(root.compiledData)?.Data)?.Chunks);
  const components = (compiled.length ? compiled : arr(root.components)).map(obj).filter((c): c is Json => !!c && c.$type === "entAnimatedComponent");
  const withRig = components.filter((c) => depot(c.rig));
  const body = withRig.find((c) => text(c.name) === "root") ?? withRig.find((c) => !isDeformations(depot(c.rig)));
  return { rig: body ? depot(body.rig) : "", appearances, sets: body ? setsOf(body) : [] };
}

/** Whether two rig paths name the same rig. Game paths do not mind case or the slash's direction. */
export function sameRig(a: string | undefined, b: string | undefined): boolean {
  const norm = (p: string) => p.replace(/\//g, "\\").toLowerCase();
  return !!a && !!b && norm(a) === norm(b);
}

/** A rig's short name for a list: `woman_base` for `...\woman_base\woman_base.rig`. */
export function rigName(rig: string | undefined): string {
  if (!rig) return "";
  const file = rig.replace(/\//g, "\\").split("\\").pop() ?? "";
  return file.replace(/\.rig$/i, "");
}
