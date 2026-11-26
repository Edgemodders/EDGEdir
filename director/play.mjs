// EDGE Director's player (D5c): plays a cue sheet on people in the game. No `rednode` import in here:
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

const norm = (deg) => ((deg % 360) + 360) % 360;
/** The turn that faces along a direction: a turn of 0 faces north. */
export const turnOf = (fx, fy) => norm((Math.atan2(-fx, fy) * 180) / Math.PI);

/**
 * The scene's frame in the world: its origin `o`, the way its Forward points `f`, and that way as a turn.
 * On a set: the set's origin, Forward is north. At a place (`anchor.mode: "world"`): the place and its
 * yaw. In front of V (`v`: V's place and the way V faces): `distance` metres ahead of V, Forward as V
 * faces, so Right and Forward are as V sees them and a Turn of 180 faces V.
 */
export function frameOf(sheet, stage, v) {
  const mode = sheet.anchor?.mode;
  if (mode === "set" && Array.isArray(stage?.origin)) return { mode, o: { x: stage.origin[0], y: stage.origin[1], z: stage.origin[2] }, f: { x: 0, y: 1 }, turn: 0 };
  if (mode === "world" && Array.isArray(sheet.anchor.at)) {
    const turn = norm(Number(sheet.anchor.yaw ?? 0));
    const r = (turn * Math.PI) / 180;
    return { mode, o: { x: sheet.anchor.at[0], y: sheet.anchor.at[1], z: sheet.anchor.at[2] }, f: { x: -Math.sin(r), y: Math.cos(r) }, turn };
  }
  if (!v) throw new Error("V was not found: load a save first");
  const d = Number(sheet.anchor?.distance ?? 3);
  return { mode: "player", o: { x: v.x + v.fx * d, y: v.y + v.fy * d, z: v.z }, f: { x: v.fx, y: v.fy }, turn: turnOf(v.fx, v.fy) };
}

/** Where a mark is in the world, in a frame: `z` is the height when the set gives one. */
export function placeOf(frame, at, z) {
  const x = Number(at?.x ?? 0);
  const y = Number(at?.y ?? 0);
  const { o, f } = frame;
  return { position: { x: o.x + x * f.y + y * f.x, y: o.y - x * f.x + y * f.y, z: Number(z ?? o.z) }, yaw: norm(Number(at?.yaw ?? 0) + frame.turn) };
}

/** The mark of a place in the world, in a frame: the other way round from `placeOf`. Rounded to millimetres and tenths of a degree. */
export function markAt(frame, position, yaw) {
  const dx = position.x - frame.o.x;
  const dy = position.y - frame.o.y;
  const { f } = frame;
  const r = (n, k) => Math.round(n * k) / k;
  return { x: r(dx * f.y - dy * f.x, 1000), y: r(dx * f.x + dy * f.y, 1000), yaw: r(norm(yaw - frame.turn), 10) % 360 };
}

/** Where each cast member stands in the world, and which way they face. A person of the set stands at the height the set gives them. */
export function placements(sheet, stage, v) {
  const frame = frameOf(sheet, stage, v);
  const out = {};
  for (const m of sheet.cast) {
    const from = frame.mode === "set" ? stage.scene?.objects?.find((ob) => ob.id === stage.from?.[m.track]) : undefined;
    out[m.track] = placeOf(frame, m.at, from?.transform?.position?.[2]);
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
  if (!Array.isArray(sheet.cast) || (!sheet.cast.length && !sheet.weather?.length && !sheet.sounds?.length)) return "The scene has nobody to play: no actor track has a clip the game can play.";
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
 *   deps.freeze   optional: async (id, on) stops time for one person, or lets it run again
 *   deps.audio    optional: REDnode's `audio` (play, event), for the scene's sounds (D6b)
 *   deps.soundFile optional: async (path) puts a sound file where REDnode may play it, and answers that path
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
    // D6b: Stop fades every sound out.
    await this.hush(ctx, 300);
    for (const a of ctx.cast.splice(0)) await world.remove(a.id).catch(() => false);
    // D6a: a weather the scene holds is given back. REDnode does the same when the package is ended.
    if (ctx.held) {
      ctx.held = false;
      await world.resetWeather().catch(() => undefined);
    }
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

  /** The cast in the game now: who, and where each stands. */
  cast() {
    return (this.ctx?.cast ?? []).map((a) => ({ track: a.track, name: a.name, id: a.id, position: a.position, yaw: a.yaw }));
  }

  /** Sets the timers for the cues after `from` (seconds into the scene), all from one start time, and says Playing. */
  begin(ctx, run, from, jumped = false, lead = this.deps.leadMs) {
    const { world, now } = this.deps;
    const sheet = ctx.sheet;
    for (const t of ctx.timers.splice(0)) clearTimeout(t);
    const t0 = now() + lead;
    // Each actor's lane, in time: a clip starts (a jump), or a clip ends with none after it (a hold).
    // Held, time stops for that person alone, a moment before the clip's end, so the clip does not
    // start again: they keep its last pose through a gap and after their last clip. Before their
    // first clip they wait in its first pose.
    const Before = 0.05;
    for (const a of ctx.cast) {
      const jumps = sheet.timeline.filter((c) => c.track === a.track);
      const holds = (sheet.ends ?? []).filter((e) => e.track === a.track).map((e) => ({ t: Math.max(0, e.t - Before), hold: true }));
      const events = [...jumps, ...holds].sort((x, y) => x.t - y.t || (x.hold ? 1 : -1));
      // Where the actor stands at this moment: in a clip, held after one, or waiting for their first.
      const before = events.filter((e) => (e.hold ? e.t <= from : e.t < from || (jumped && e.t === from)));
      const now0 = before[before.length - 1];
      const waiting = !now0 && jumps.length > 0 && jumps[0].t > from;
      if (waiting) {
        // From the warm-up they are somewhere inside the first clip: back to its start, and held there.
        // After a seek or a pause they are at its start already: no second jump.
        void (async () => {
          if (!jumped) {
            await this.still(ctx, a, false);
            await world.jumpWorkspot(a.id, jumps[0].jump).catch(() => false);
          }
          if (run === this.run) await this.still(ctx, a, true);
        })();
      } else void this.still(ctx, a, !!now0?.hold);
      for (const e of holds) {
        if (e.t <= from) continue;
        ctx.timers.push(setTimeout(() => run === this.run && void this.still(ctx, a, true), Math.max(0, t0 + (e.t - from) * 1000 - now())));
      }
    }
    for (const cue of sheet.timeline) {
      // A cue at the moment itself restarts its clip after the warm-up; after a seek the actor has just jumped to it.
      if (cue.t < from || (jumped && cue.t === from)) continue;
      const due = t0 + (cue.t - from) * 1000;
      ctx.timers.push(
        setTimeout(async () => {
          const late = Math.round(now() - due);
          const a = ctx.cast.find((x) => x.track === cue.track);
          let ok = false;
          let error;
          try {
            // Time runs again for an actor who was held, then they take the jump.
            if (a) await this.still(ctx, a, false);
            ok = !!a && (await world.jumpWorkspot(a.id, cue.jump));
          } catch (e) {
            error = e.message;
          }
          if (run !== this.run) return;
          this.set({ late: [...this.st.late, { t: cue.t, track: cue.track, jump: cue.jump, ms: late, ok, ...(error ? { error } : {}) }] });
        }, Math.max(0, due - now())),
      );
    }
    // D6a: the weather. The state the scene holds at this moment is set now; the later cues run on timers.
    const weather = sheet.weather ?? [];
    const hold = async (cue) => {
      try {
        if (cue.reset) {
          if (ctx.held) await world.resetWeather();
          ctx.held = false;
        } else {
          ctx.held = true;
          const r = await world.setWeather(cue.state, { blend: cue.blend });
          if (r && r.applied === false) throw new Error("the game did not take it");
        }
      } catch (e) {
        if (run === this.run) this.set({ notes: [...(this.st.notes ?? []), `The weather ${cue.reset ? "was not given back" : `"${cue.state}" was not set`}: ${e.message}`] });
      }
    };
    const inForce = weatherAt(weather, from);
    if (inForce) void hold(inForce);
    else if (ctx.held) void hold({ reset: true });
    for (const cue of weather) {
      if (cue.t <= from) continue;
      ctx.timers.push(setTimeout(() => void hold(cue), Math.max(0, t0 + (cue.t - from) * 1000 - now())));
    }
    // D6b: the sounds. What was heard before this moment's start is stopped; a sound the moment is
    // inside starts part way in, with the scene; the later ones start on timers.
    void this.hush(ctx, 50);
    const token = ctx.soundRun;
    for (const cue of sheet.sounds ?? []) {
      if (cue.end <= from) continue;
      const offset = Math.max(0, from - cue.t);
      const due = t0 + Math.max(0, cue.t - from) * 1000;
      ctx.timers.push(setTimeout(() => void this.sound(ctx, run, token, cue, offset), Math.max(0, due - now())));
    }
    // The end: the cast holds its last clips, looping, until Stop. A looping play starts again.
    const nobody = !sheet.cast.length;
    ctx.timers.push(
      setTimeout(() => {
        if (run !== this.run) return;
        if (ctx.loop) void this.seek(0);
        else this.set({ state: "ended", text: nobody ? "The scene has ended" : this.deps.freeze ? "The scene has ended: the cast holds its last pose until Stop" : "The scene has ended: the cast holds its last clips until Stop" });
      }, Math.max(0, t0 + (sheet.length - from) * 1000 - now())),
    );
    // startedAt is when the scene's time 0 was, or would have been: the time now is always now - startedAt.
    this.set({ state: "playing", text: "Playing", startedAt: t0 - from * 1000, pausedAt: undefined, loop: ctx.loop, late: [] });
  }

  /** Stops every sound the scene has started, fading out over `fadeMs`. A sound still being started is stopped when it arrives. */
  async hush(ctx, fadeMs = 0) {
    ctx.soundRun = (ctx.soundRun ?? 0) + 1;
    const playing = (ctx.sounds ?? []).splice(0);
    await Promise.all(playing.map((s) => Promise.resolve().then(() => s.stop(fadeMs)).catch(() => undefined)));
  }

  /**
   * Plays one sound cue, `offset` seconds into its clip, and stops it at the clip's end. A file
   * plays through REDnode's own engine, flat; a game sound is posted on V. One that cannot be
   * played is said in the play's notes, and the play goes on.
   */
  async sound(ctx, run, token, cue, offset) {
    const { audio } = this.deps;
    const stale = () => run !== this.run || token !== ctx.soundRun;
    if (stale()) return;
    const lasts = cue.end - cue.t - offset;
    const what = cue.file ?? cue.event;
    try {
      if (!audio) throw new Error("this EDGE Director has no sound");
      let handle;
      let fade = 0;
      if (cue.file) {
        const file = ctx.files?.[cue.file];
        // A file that did not come with the scene was said when the play began.
        if (!file) return;
        fade = Math.min(cue.fadeOut ?? 0, lasts);
        const start = (cue.in ?? 0) + offset;
        const s = await audio.play(file, {
          start,
          end: (cue.in ?? 0) + (cue.end - cue.t),
          volume: cue.volume ?? 1,
          // A sound started part way in has had some or all of its fade in.
          fadeIn: Math.round(Math.max(0, (cue.fadeIn ?? 0) - offset) * 1000),
          category: cue.category ?? "sfx",
        });
        handle = { stop: (ms) => s.stop({ fadeOut: ms }) };
      } else {
        const e = await audio.event(cue.event);
        handle = { stop: () => e.stop() };
      }
      if (stale()) return void Promise.resolve().then(() => handle.stop(0)).catch(() => undefined);
      (ctx.sounds ??= []).push(handle);
      ctx.timers.push(
        setTimeout(() => {
          const i = ctx.sounds.indexOf(handle);
          if (i < 0) return;
          ctx.sounds.splice(i, 1);
          void Promise.resolve().then(() => handle.stop(Math.round(fade * 1000))).catch(() => undefined);
        }, Math.max(0, (lasts - fade) * 1000)),
      );
    } catch (e) {
      if (!stale()) this.set({ notes: [...(this.st.notes ?? []), `The sound "${what}" was not played: ${e.message}`] });
    }
  }

  /** Stops time for one actor, or lets it run again: they hold the pose they are in. Nothing happens without `deps.freeze`. */
  async still(ctx, a, on) {
    if (!this.deps.freeze || !!a.still === !!on) return;
    a.still = !!on;
    await this.deps.freeze(a.id, !!on).catch((e) => {
      if (ctx === this.ctx && !ctx.saidFreeze) {
        ctx.saidFreeze = true;
        this.set({ notes: [...(this.st.notes ?? []), `An actor could not be held still: ${e.message}`] });
      }
    });
  }

  /** Pauses the scene that plays: the cues wait and everybody holds their pose. False when nothing plays. */
  async pause() {
    const ctx = this.ctx;
    if (!ctx?.sheet || this.st.state !== "playing") return false;
    const at = Math.min(Math.max(0, (this.deps.now() - this.st.startedAt) / 1000), ctx.sheet.length);
    for (const t of ctx.timers.splice(0)) clearTimeout(t);
    // D6b: the sounds stop; Resume starts each again from where the scene stands.
    void this.hush(ctx, 100);
    // Everybody at the same moment, not one after another.
    await Promise.all(ctx.cast.map((a) => this.still(ctx, a, true)));
    if (ctx !== this.ctx) return false;
    this.set({ state: "paused", text: "Paused", pausedAt: at });
    return true;
  }

  /** Goes on from where the scene was paused. False when it is not paused. */
  resume() {
    const ctx = this.ctx;
    if (!ctx?.sheet || this.st.state !== "paused") return false;
    // No lead: the scene's time goes on from exactly where it stood, so the playhead does not step back.
    this.begin(ctx, this.run, this.st.pausedAt ?? 0, true, 0);
    return true;
  }

  /**
   * Goes to a moment of the scene that is in the game, with the cast it has: each actor jumps to the
   * clip of that moment, and the cues run on from there. False when no scene is in the game.
   */
  async seek(from, loop) {
    const ctx = this.ctx;
    const run = this.run;
    if (!ctx?.sheet || !["playing", "ended", "paused"].includes(this.st.state)) return false;
    const { world } = this.deps;
    const t = Math.min(Math.max(0, Number(from) || 0), ctx.sheet.length);
    if (loop !== undefined) ctx.loop = !!loop;
    for (const t of ctx.timers.splice(0)) clearTimeout(t);
    // Time runs again for everybody first: a person held still may not take a jump.
    for (const a of ctx.cast) await this.still(ctx, a, false);
    for (const m of ctx.sheet.cast) {
      const a = ctx.cast.find((x) => x.track === m.track);
      if (a) await world.jumpWorkspot(a.id, entryAt(ctx.sheet, m, t)).catch(() => false);
    }
    if (run !== this.run || ctx !== this.ctx) return false;
    this.begin(ctx, run, t, true);
    return true;
  }

  /** The frame of the scene that is in the game: where its origin is and the way its Forward points. Undefined with none. */
  frame() {
    return this.ctx?.frame;
  }

  /** The scene in the game was given another place: later marks are measured in this frame. */
  reframe(frame) {
    if (this.ctx) this.ctx.frame = frame;
  }

  /**
   * Puts an actor who is in the game somewhere else, as they play. False when they are not there.
   * (Unverified in the game: `world.move` on a person who is in a workspot.)
   */
  async place(track, position, yaw) {
    const a = this.ctx?.cast.find((x) => x.track === track);
    if (!a) return false;
    const ok = await this.deps.world.move(a.id, position, undefined, yaw);
    a.position = position;
    a.yaw = yaw;
    return !!ok;
  }

  /** Whether the play starts again at its end. */
  setLoop(on) {
    if (this.ctx) this.ctx.loop = !!on;
    if (this.st.state === "playing") this.set({ loop: !!on });
    else if (this.st.state === "ended" && on) void this.seek(0);
  }

  /** Plays `request.sheet` from its start, or from `request.from` seconds in. Answers when the scene has started, or failed. */
  async play(request) {
    await this.stop(true);
    const run = ++this.run;
    const ctx = { cast: [], timers: [], loaded: false };
    this.ctx = ctx;
    const from = Math.max(0, Number(request?.from) || 0);
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
      if (sheet.cast.length) this.set({ text: todo.length ? `Writing ${todo.length} workspot${todo.length === 1 ? "" : "s"}` : "The workspots are as they were" });
      for (const m of todo) {
        const name = nameOf(sheet, m);
        // The game takes the new files in one swap, with the last one written.
        const w = await step(world.writeWorkspot(name, { rig: m.rig, clips: m.clips.map((c) => ({ set: c.set, anim: c.anim, name: c.name, loop: true })), swap: m === todo[todo.length - 1] }));
        this.written.set(name, { from: fromOf(m), path: w.path });
      }

      // 2. Place.
      const onSet = sheet.anchor?.mode === "set";
      if (onSet && !Array.isArray(stage?.origin)) throw new Error("The scene plays on a set, and the set did not come with it.");
      // A scene with nobody in it (weather alone) needs no place.
      const v = onSet || sheet.anchor?.mode === "world" || !sheet.cast.length ? null : await step(this.deps.player());
      ctx.frame = sheet.cast.length ? frameOf(sheet, stage, v) : undefined;
      ctx.v = v;
      const places = sheet.cast.length ? placements(sheet, stage, v) : {};
      if (onSet && stage.scene) {
        this.set({ state: "loading", text: `Loading the set "${stage.scene.name ?? "set"}"` });
        ctx.loaded = true;
        const r = await step(world.load(sceneFor(stage, sheet), { name: SET }));
        this.set({ notes: [...(r?.skipped ?? []).map((s) => `The set's "${s.object}" is not in the game: ${s.why}`), ...(r?.notes ?? [])] });
      }

      // 3. Spawn, and start everyone once so the first play's T pose is over before the scene starts.
      if (sheet.cast.length) this.set({ state: "spawning", text: `Spawning ${sheet.cast.length} ${sheet.cast.length === 1 ? "person" : "people"}` });
      for (const m of sheet.cast) {
        const { id } = await world.spawn({ record: m.record, ...(m.appearance ? { appearance: m.appearance } : {}), ...places[m.track], workspot: this.written.get(nameOf(sheet, m)).path }).catch((e) => {
          throw new Error(`${m.name} could not be spawned: ${e.message}`);
        });
        // Kept before the check, so a Stop during the spawn still removes the person.
        ctx.cast.push({ track: m.track, name: m.name, id, ...places[m.track] });
        if (run !== this.run) throw Abandoned;
      }
      for (const m of sheet.cast) {
        const a = ctx.cast.find((x) => x.track === m.track);
        const r = await step(world.useWorkspot(a.id, { entry: entryAt(sheet, m, from) }));
        if (r?.id) a.id = r.id;
        if (!r?.started) throw new Error(`${m.name} did not start playing: ${r?.why ?? "no reason given"}`);
      }
      if (sheet.cast.length) {
        this.set({ state: "warming", text: "Starting the cast" });
        await step(new Promise((done) => setTimeout(done, this.deps.warmMs)));
      }

      // D6b: each sound file is put where REDnode may play it. One that is missing is said, and the rest play.
      ctx.files = {};
      const files = [...new Set((sheet.sounds ?? []).map((s) => s.file).filter(Boolean))];
      const lost = [];
      for (const f of files) {
        try {
          const from = request.sounds?.[f];
          if (!from) throw new Error("it is not in the scene's folder");
          if (!this.deps.soundFile) throw new Error("this EDGE Director has no sound");
          ctx.files[f] = await this.deps.soundFile(from);
        } catch (e) {
          lost.push(`The sound file "${f}" is left out: ${e.message}`);
        }
        if (run !== this.run) throw Abandoned;
      }
      if (lost.length) this.set({ notes: [...(this.st.notes ?? []), ...lost] });

      // 4. Play: one timer for each cue, all from one start time.
      ctx.sheet = sheet;
      ctx.loop = !!request.loop;
      this.begin(ctx, run, from);
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

/** The weather a scene holds at a moment: the last cue at or before it, when that one sets a state. */
export function weatherAt(cues, from) {
  let now;
  for (const cue of cues ?? []) if (cue.t <= from) now = cue;
  return now && !now.reset ? now : undefined;
}

/** The clip an actor plays at a moment: the last jump at or before it, or their first clip. */
export function entryAt(sheet, m, from) {
  let entry = m.clips[0].name;
  for (const cue of sheet.timeline) if (cue.track === m.track && cue.t <= from) entry = cue.jump;
  return entry;
}

const nameOf = (sheet, m) => `${slug(sheet.scene)}_${slug(m.track, 20)}`;
const fromOf = (m) => JSON.stringify([m.rig, m.clips]);
