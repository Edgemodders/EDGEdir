// EDGE Director's stage manager: what the window asks, done with the Desk (floor.ts) and the
// player (play.mjs), and the state the window shows. DR1: open, play, go to a moment, stop, the
// cast. DR2: adjust, each one a change to the scene's file made with EDGEdir's own edits, and
// shown at once on the people in the game. The game's calls are handed in, so this runs in a unit
// test and in a stand-in with no game. No `rednode` in here.
import * as crypto from "node:crypto";
import { markOf, setMark, setPlace, type SceneDoc } from "../src/doc";
import { edit, isUnsaved, open, rootsOf, scenes, type Playable, type SceneView } from "./floor";
import { frameOf, markAt, placeOf, turnOf, type Frame } from "./play.mjs";
import { Active, type CastNow, type PageMessage, type PlayNow, type Snapshot } from "./protocol";

type Place = { x: number; y: number; z: number };
/** V's place and the way V faces. */
export type Where = Place & { fx: number; fy: number };

/** The player, as the stage manager uses it (director/play.mjs's Player). */
export interface PlayerLike {
  state(): PlayNow;
  play(request: unknown): Promise<PlayNow>;
  stop(quiet?: boolean): Promise<PlayNow>;
  seek(from: number, loop?: boolean): Promise<boolean>;
  setLoop(on: boolean): void;
  cast(): { track: string; name: string; id?: unknown; position: Place; yaw: number }[];
  frame(): Frame | undefined;
  reframe(frame: Frame): void;
  place(track: string, position: Place, yaw: number): Promise<boolean>;
}

export interface StageDeps {
  player: PlayerLike;
  version: string;
  /** The Desk's folder, and the folder EDGEdir and the Director share. */
  desk: string;
  playDir: string;
  /** Called with the whole state at every change. */
  publish(state: Snapshot): void;
  /** V's place and facing, or null when no save is loaded. */
  whereV(): Promise<Where | null>;
  /** Puts V at a place, facing `yaw`. */
  teleport(to: Place & { yaw: number }): Promise<void>;
  /** Marks an entity in the world with a pin, and takes a pin away. */
  pin(at: unknown, title: string): Promise<number>;
  unpin(id: number): Promise<unknown>;
}

const words = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Where V is put to look at an actor: `back` metres in front of them, facing them. A turn of 0 faces north. */
export function besideOf(position: Place, yaw: number, back = 1.8): Place & { yaw: number } {
  const r = (yaw * Math.PI) / 180;
  return { x: position.x - Math.sin(r) * back, y: position.y + Math.cos(r) * back, z: position.z, yaw: (yaw + 180) % 360 };
}

export class Stage {
  private view?: SceneView;
  private playing?: string;
  private from?: "director" | "editor";
  private error?: string;
  private chosen?: string;
  private pinId?: number;
  private distances: Record<string, number> = {};

  constructor(private deps: StageDeps) {}

  /** The scene in the window is the one in the game. */
  private mine(): boolean {
    return !!this.view && this.playing === this.view.file && Active.includes(this.deps.player.state().state);
  }

  /** The whole state, as the window shows it. */
  snapshot(): Snapshot {
    const play = this.deps.player.state();
    const active = Active.includes(play.state);
    const cast: CastNow[] = active ? this.deps.player.cast().map((a) => ({ track: a.track, name: a.name, ...(a.track in this.distances ? { distance: this.distances[a.track] } : {}) })) : [];
    const view = this.view ? { ...this.view, ...(isUnsaved(this.view.file, this.deps.playDir) ? { unsaved: true } : {}) } : undefined;
    return {
      version: this.deps.version,
      scenes: scenes(this.deps.desk),
      ...(view ? { view } : {}),
      ...(active && this.playing ? { playing: this.playing, from: this.from } : {}),
      play,
      cast,
      ...(this.chosen && view?.tracks.some((t) => t.id === this.chosen && t.mark) ? { chosen: this.chosen } : {}),
      ...(this.error ? { error: this.error } : {}),
    };
  }

  publish(): void {
    this.deps.publish(this.snapshot());
  }

  private read(file: string): Playable | undefined {
    const { view, play } = open(file, rootsOf(this.deps.playDir));
    this.view = view;
    return play;
  }

  /** Reads the open scene again when its file changed, unless it is the one in the game. */
  refresh(): void {
    if (!this.view || this.mine()) return;
    try {
      this.read(this.view.file);
    } catch {
      this.view = undefined;
    }
  }

  /** How far each actor is from V. */
  async measure(): Promise<void> {
    const cast = this.deps.player.cast();
    if (!cast.length) return void (this.distances = {});
    const v = await this.deps.whereV().catch(() => null);
    if (!v) return;
    this.distances = Object.fromEntries(cast.map((a) => [a.track, Math.round(Math.hypot(a.position.x - v.x, a.position.y - v.y, a.position.z - v.z) * 10) / 10]));
  }

  private async unpin(): Promise<void> {
    const id = this.pinId;
    this.pinId = undefined;
    if (id !== undefined) await this.deps.unpin(id).catch(() => undefined);
  }

  /** The chosen actor has a pin over them while they are in the game. */
  private async mark(): Promise<void> {
    await this.unpin();
    const a = this.chosen && this.mine() ? this.deps.player.cast().find((x) => x.track === this.chosen) : undefined;
    if (a?.id !== undefined) this.pinId = await this.deps.pin(a.id, a.name).catch(() => undefined);
  }

  /** A request from EDGEdir in VS Code (the play folder): the sheet is the editor's, which may be newer than the file. */
  async fromEditor(request: { do?: string; file?: string }): Promise<void> {
    await this.unpin();
    if (request.do === "stop") {
      await this.deps.player.stop();
      return this.publish();
    }
    this.error = undefined;
    this.from = "editor";
    this.playing = request.file;
    if (request.file) {
      try {
        this.read(request.file);
      } catch {
        // An unsaved scene has no file yet: it plays, and the window shows the play alone.
      }
    }
    void this.deps.player.play(request).then(() => this.measure().then(() => this.publish()));
  }

  // ---- DR2 Adjust -----------------------------------------------------------------------------

  private async v(): Promise<Where> {
    const v = await this.deps.whereV();
    if (!v) throw new Error("V was not found: load a save first");
    return v;
  }

  /**
   * The frame the open scene's marks are measured in. The scene in the game has one. Otherwise a
   * scene on a set or at a place has one by itself; a scene in front of V has none until it plays.
   */
  private frame(play: Playable | undefined): Frame {
    const now = this.mine() ? this.deps.player.frame() : undefined;
    if (now) return now;
    if (!play) throw new Error(this.view?.why ?? "This scene cannot be played");
    if (play.sheet.anchor.mode === "player") throw new Error("This scene plays in front of V, wherever V is. Press Play first, or The Scene Is Here: then a place in the world is a mark");
    return frameOf(play.sheet, play.stage, null);
  }

  /** One change to the open scene's file; then the people in the game are put where the scene now has them. */
  private async change(make: (doc: SceneDoc) => SceneDoc, frame?: Frame): Promise<void> {
    const { player, playDir } = this.deps;
    const was = this.mine();
    const file = this.view!.file;
    edit(file, make, playDir);
    const play = this.read(file);
    if (!was || !play) return;
    // The scene in the game keeps its frame, unless its place was changed (`frame`).
    const to = frame ?? player.frame();
    if (!to) return;
    if (frame) player.reframe(frame);
    for (const a of player.cast()) {
      const lane = this.view!.tracks.find((t) => t.id === a.track);
      if (!lane?.mark || lane.placed) continue;
      const next = placeOf(to, lane.mark);
      if (Math.hypot(next.position.x - a.position.x, next.position.y - a.position.y, next.position.z - a.position.z) > 0.0005 || Math.abs(next.yaw - a.yaw) > 0.05) await player.place(a.track, next.position, next.yaw);
    }
    await this.measure();
  }

  /** What the window asked. Answers when it is done; the state is published either way. */
  async handle(m: PageMessage): Promise<void> {
    const { player } = this.deps;
    try {
      this.error = undefined;
      const needView = () => {
        if (!this.view) throw new Error("Open a scene first");
        return this.view;
      };
      switch (m.type) {
        case "hello":
        case "scenes":
          this.refresh();
          break;
        case "open":
          await this.unpin();
          this.chosen = undefined;
          this.read(m.file);
          break;
        case "close":
          await this.unpin();
          this.chosen = undefined;
          this.view = undefined;
          break;
        case "play": {
          const play = this.read(needView().file);
          if (!play) throw new Error(this.view!.why ?? "This scene cannot be played");
          await this.unpin();
          this.from = "director";
          this.playing = play.file;
          this.publish();
          await player.play({ id: crypto.randomBytes(8).toString("hex"), sheet: play.sheet, stage: play.stage, from: m.from ?? 0, loop: !!m.loop });
          await this.mark();
          await this.measure();
          break;
        }
        case "seek":
          if (!(await player.seek(m.t))) throw new Error("No scene is in the game: press Play");
          break;
        case "loop":
          player.setLoop(m.on);
          break;
        case "stop":
          await this.unpin();
          await player.stop();
          break;
        case "choose":
          this.chosen = m.track && needView().tracks.some((t) => t.id === m.track && t.mark) ? m.track : undefined;
          await this.mark();
          break;
        case "goTo": {
          const a = player.cast().find((x) => x.track === m.track);
          if (!a) throw new Error("That actor is not in the game: press Play");
          await this.deps.teleport(besideOf(a.position, a.yaw));
          await this.measure();
          break;
        }
        case "moveToV": {
          const frame = this.frame(this.read(needView().file));
          const v = await this.v();
          const at = markAt(frame, v, turnOf(v.fx, v.fy));
          await this.change((doc) => setMark(doc, m.track, at));
          break;
        }
        case "nudge":
          needView();
          await this.change((doc) => {
            const at = markOf(doc, m.track);
            return setMark(doc, m.track, { x: at.x + (m.right ?? 0), y: at.y + (m.forward ?? 0), yaw: at.yaw + (m.turn ?? 0) });
          });
          break;
        case "mark":
          needView();
          await this.change((doc) => setMark(doc, m.track, { ...(m.x !== undefined ? { x: m.x } : {}), ...(m.y !== undefined ? { y: m.y } : {}), ...(m.yaw !== undefined ? { yaw: m.yaw } : {}) }));
          break;
        case "here": {
          // The scene stays where it is in the game now; with none in the game, where a play would put it now.
          needView();
          const now = this.mine() ? player.frame() : undefined;
          const frame: Frame = now ? { ...now, mode: "world" } : frameOf({ anchor: { mode: "player", distance: 3 } }, undefined, await this.v());
          const place = { at: [frame.o.x, frame.o.y, frame.o.z] as [number, number, number], yaw: frame.turn };
          await this.change((doc) => setPlace(doc, place), { ...frame, mode: "world" });
          break;
        }
        case "front": {
          needView();
          // In front of V again: a scene in the game goes there now.
          const frame = this.mine() ? frameOf({ anchor: { mode: "player", distance: 3 } }, undefined, await this.v()) : undefined;
          await this.change((doc) => setPlace(doc, undefined), frame);
          break;
        }
      }
    } catch (e) {
      this.error = words(e);
    }
    this.publish();
  }
}
