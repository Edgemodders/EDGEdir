// EDGEdir's player (D5c): plays a cue sheet on people in the game. No `rednode` import in here:
// the world's calls are handed in, so the steps run in a unit test against a stand-in world.
// The cue sheet is src/cues.ts's; the steps are docs/d5-play-in-game.md, "The player (D5c)".

/** A name `world.writeWorkspot` takes: 1 to 64 of a to z, 0 to 9 and _. */
export const slug = (text, max = 40) =>
  String(text)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, max) || "x";

/** The name the set is loaded under, so Stop can unload it. */
export const SET = "edgedir-set";

/**
 * Where each cast member stands in the world, and which way they face.
 * On a set: the mark is metres east and north of the set's origin, and the turn is the world's.
 * In front of V (`v`: V's place and the way V faces): the anchor is `distance` metres ahead; Right
 * and Forward are as V sees them, and a Turn of 180 faces V.
 */
export function placements(sheet, stage, v) {
  const onSet = sheet.anchor?.mode === "set" && Array.isArray(stage?.origin);
  if (!onSet && !v) throw new Error("V was not found: load a save first");
  const f = onSet ? { x: 0, y: 1 } : { x: v.fx, y: v.fy };
  const d = onSet ? 0 : Number(sheet.anchor?.distance ?? 3);
  const o = onSet ? { x: stage.origin[0], y: stage.origin[1], z: stage.origin[2] } : { x: v.x + f.x * d, y: v.y + f.y * d, z: v.z };
  // The turn that faces along `f`: a turn of 0 faces north.
  const turn = (Math.atan2(-f.x, f.y) * 180) / Math.PI;
  const out = {};
  for (const m of sheet.cast) {
    const at = m.at ?? {};
    const x = Number(at.x ?? 0);
    const y = Number(at.y ?? 0);
    // A person of the set stands at the height the set gives them.
    const from = onSet ? stage.scene?.objects?.find((ob) => ob.id === stage.from?.[m.track]) : undefined;
    const z = Number(from?.transform?.position?.[2] ?? o.z);
    out[m.track] = { position: { x: o.x + x * f.y + y * f.x, y: o.y - x * f.x + y * f.y, z }, yaw: (((Number(at.yaw ?? 0) + turn) % 360) + 360) % 360 };
  }
  return out;
}

/** The set as the game is given it: without the people the cue sheet directs, who are spawned with their workspots. */
export function sceneFor(stage, sheet) {
  const directed = new Set(sheet.cast.map((m) => stage.from?.[m.track]).filter(Boolean));
  return { ...stage.scene, objects: (stage.scene?.objects ?? []).filter((ob) => !directed.has(ob.id)) };
}

/** What is wrong with a request, in words; undefined when it can be played. */
export function refusal(sheet) {
  if (!sheet || sheet.cues !== 1) return "This is not a cue sheet this player knows (cues: 1). Update EDGEdir or its player.";
  if (!Array.isArray(sheet.cast) || !sheet.cast.length) return "The scene has nobody to play: no actor track has a clip the game can play.";
  for (const m of sheet.cast) {
    if (!m.record || !m.rig || !m.clips?.length) return `"${m.name ?? m.track}" has no character, rig or clips.`;
  }
  return undefined;
}

const Abandoned = Symbol("abandoned");

/**
 * Plays cue sheets, one at a time.
 *   deps.world    REDnode's `world` (writeWorkspot, spawn, useWorkspot, jumpWorkspot, remove, load, unload)
 *   deps.player   async () => ({ x, y, z, fx, fy }): V's place and the way V faces, or null
 *   deps.report   (state) => void, called with every change
 *   deps.warmMs   how long the cast is given after its first play, for the T pose to pass (1500)
 *   deps.leadMs   from the last step to the scene's start (300)
 */
export class Player {
  constructor(deps) {
    this.deps = { warmMs: 1500, leadMs: 300, now: Date.now, report: () => {}, ...deps };
    /** Workspots written in this run of the package, by name: what they were written from, and their path. */
    this.written = new Map();
    this.run = 0;
    this.ctx = null;
    this.st = { state: "idle", text: "Ready" };
  }

  state() {
    return this.st;
  }

  set(patch) {
    this.st = { ...this.st, ...patch };
    this.deps.report(this.st);
  }

  /** A swap spawned a person again under a new id. */
  respawned(before, after) {
    for (const a of this.ctx?.cast ?? []) if (a.id?.hash === before?.hash) a.id = after;
  }

  async clear(ctx) {
    if (!ctx) return;
    for (const t of ctx.timers.splice(0)) clearTimeout(t);
    const { world } = this.deps;
    for (const a of ctx.cast.splice(0)) await world.remove(a.id).catch(() => false);
    if (ctx.loaded) {
      ctx.loaded = false;
      await world.unload(SET).catch(() => 0);
    }
  }

  /** Stops the play and removes the cast and the set. */
  async stop(quiet = false) {
    this.run += 1;
    const ctx = this.ctx;
    this.ctx = null;
    const was = this.st.state;
    await this.clear(ctx);
    if (!quiet && was !== "idle") this.set({ state: "stopped", text: "Stopped: the cast is removed" });
    return this.st;
  }

  /** Plays `request.sheet` from its start. Answers when the scene has started, or failed. */
  async play(request) {
    await this.stop(true);
    const run = ++this.run;
    const ctx = { cast: [], timers: [], loaded: false };
    this.ctx = ctx;
    const { world, now } = this.deps;
    const { sheet, stage } = request ?? {};
    /** Waits for a step, and gives up when a Stop or a new play came meanwhile. */
    const step = async (p) => {
      const r = await p;
      if (run !== this.run) throw Abandoned;
      return r;
    };
    this.st = { id: request?.id, state: "writing", text: "", scene: sheet?.scene, length: sheet?.length, late: [], notes: [] };
    try {
      const why = refusal(sheet);
      if (why) throw new Error(why);

      // 1. Write: one workspot for each actor. One whose clips have not changed is not written again.
      const todo = sheet.cast.filter((m) => this.written.get(nameOf(sheet, m))?.from !== fromOf(m));
      this.set({ text: todo.length ? `Writing ${todo.length} workspot${todo.length === 1 ? "" : "s"}` : "The workspots are as they were" });
      for (const m of todo) {
        const name = nameOf(sheet, m);
        // The game takes the new files in one swap, with the last one written.
        const w = await step(world.writeWorkspot(name, { rig: m.rig, clips: m.clips.map((c) => ({ set: c.set, anim: c.anim, name: c.name, loop: true })), swap: m === todo[todo.length - 1] }));
        this.written.set(name, { from: fromOf(m), path: w.path });
      }

      // 2. Place.
      const onSet = sheet.anchor?.mode === "set";
      if (onSet && !Array.isArray(stage?.origin)) throw new Error("The scene plays on a set, and the set did not come with it.");
      const places = placements(sheet, stage, onSet ? null : await step(this.deps.player()));
      if (onSet && stage.scene) {
        this.set({ state: "loading", text: `Loading the set "${stage.scene.name ?? "set"}"` });
        ctx.loaded = true;
        const r = await step(world.load(sceneFor(stage, sheet), { name: SET }));
        this.set({ notes: [...(r?.skipped ?? []).map((s) => `The set's "${s.object}" is not in the game: ${s.why}`), ...(r?.notes ?? [])] });
      }

      // 3. Spawn, and start everyone once so the first play's T pose is over before the scene starts.
      this.set({ state: "spawning", text: `Spawning ${sheet.cast.length} ${sheet.cast.length === 1 ? "person" : "people"}` });
      for (const m of sheet.cast) {
        const { id } = await world.spawn({ record: m.record, ...(m.appearance ? { appearance: m.appearance } : {}), ...places[m.track], workspot: this.written.get(nameOf(sheet, m)).path }).catch((e) => {
          throw new Error(`${m.name} could not be spawned: ${e.message}`);
        });
        // Kept before the check, so a Stop during the spawn still removes the person.
        ctx.cast.push({ track: m.track, name: m.name, id });
        if (run !== this.run) throw Abandoned;
      }
      for (const m of sheet.cast) {
        const a = ctx.cast.find((x) => x.track === m.track);
        const r = await step(world.useWorkspot(a.id, { entry: m.clips[0].name }));
        if (r?.id) a.id = r.id;
        if (!r?.started) throw new Error(`${m.name} did not start playing: ${r?.why ?? "no reason given"}`);
      }
      this.set({ state: "warming", text: "Starting the cast" });
      await step(new Promise((done) => setTimeout(done, this.deps.warmMs)));

      // 4. Play: one timer for each cue, all from one start time.
      const t0 = now() + this.deps.leadMs;
      for (const cue of sheet.timeline) {
        const due = t0 + cue.t * 1000;
        ctx.timers.push(
          setTimeout(async () => {
            const late = Math.round(now() - due);
            const a = ctx.cast.find((x) => x.track === cue.track);
            let ok = false;
            let error;
            try {
              ok = !!a && (await world.jumpWorkspot(a.id, cue.jump));
            } catch (e) {
              error = e.message;
            }
            if (run !== this.run) return;
            this.set({ late: [...this.st.late, { t: cue.t, track: cue.track, jump: cue.jump, ms: late, ok, ...(error ? { error } : {}) }] });
          }, Math.max(0, due - now())),
        );
      }
      // 5. End: the cast holds its last clips, looping, until Stop.
      ctx.timers.push(
        setTimeout(() => {
          if (run === this.run) this.set({ state: "ended", text: "The scene has ended: the cast holds its last clips until Stop" });
        }, Math.max(0, t0 + sheet.length * 1000 - now())),
      );
      this.set({ state: "playing", text: "Playing", startedAt: t0 });
    } catch (e) {
      // A Stop or a new play took over: remove what this play still spawned after it.
      await this.clear(ctx);
      if (e !== Abandoned && run === this.run) {
        this.ctx = null;
        this.set({ state: "failed", text: e.message, error: e.message });
      }
    }
    return this.st;
  }
}

const nameOf = (sheet, m) => `${slug(sheet.scene)}_${slug(m.track, 20)}`;
const fromOf = (m) => JSON.stringify([m.rig, m.clips]);
