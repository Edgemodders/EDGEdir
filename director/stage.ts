// EDGE Director's stage manager (DR1): what the window asks, done with the Desk (floor.ts) and
// the player (play.mjs), and the state the window shows. The game's calls are handed in, so this
// runs in a unit test and in a stand-in with no game. No `rednode` in here.
import * as crypto from "node:crypto";
import { open, rootsOf, scenes, type Playable, type SceneView } from "./floor";
import { Active, type CastNow, type PageMessage, type PlayNow, type Snapshot } from "./protocol";

type Place = { x: number; y: number; z: number };

/** The player, as the stage manager uses it (director/play.mjs's Player). */
export interface PlayerLike {
  state(): PlayNow;
  play(request: unknown): Promise<PlayNow>;
  stop(quiet?: boolean): Promise<PlayNow>;
  seek(from: number, loop?: boolean): Promise<boolean>;
  setLoop(on: boolean): void;
  cast(): { track: string; name: string; id?: unknown; position: Place; yaw: number }[];
}

export interface StageDeps {
  player: PlayerLike;
  version: string;
  /** The Desk's folder, and the folder EDGEdir and the Director share. */
  desk: string;
  playDir: string;
  /** Called with the whole state at every change. */
  publish(state: Snapshot): void;
  /** V's place, or null when no save is loaded. */
  whereV(): Promise<Place | null>;
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

  /** The whole state, as the window shows it. */
  snapshot(): Snapshot {
    const play = this.deps.player.state();
    const active = Active.includes(play.state);
    const cast: CastNow[] = active ? this.deps.player.cast().map((a) => ({ track: a.track, name: a.name, ...(a.track in this.distances ? { distance: this.distances[a.track] } : {}) })) : [];
    return {
      version: this.deps.version,
      scenes: scenes(this.deps.desk),
      ...(this.view ? { view: this.view } : {}),
      ...(active && this.playing ? { playing: this.playing, from: this.from } : {}),
      play,
      cast,
      ...(this.chosen && cast.some((c) => c.track === this.chosen) ? { chosen: this.chosen } : {}),
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
    if (!this.view || (this.playing === this.view.file && Active.includes(this.deps.player.state().state))) return;
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

  private async unmark(): Promise<void> {
    const id = this.pinId;
    this.pinId = undefined;
    this.chosen = undefined;
    if (id !== undefined) await this.deps.unpin(id).catch(() => undefined);
  }

  /** A request from EDGEdir in VS Code (the play folder): the sheet is the editor's, which may be newer than the file. */
  async fromEditor(request: { do?: string; file?: string }): Promise<void> {
    await this.unmark();
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

  /** What the window asked. Answers when it is done; the state is published either way. */
  async handle(m: PageMessage): Promise<void> {
    const { player } = this.deps;
    try {
      this.error = undefined;
      switch (m.type) {
        case "hello":
        case "scenes":
          this.refresh();
          break;
        case "open":
          this.read(m.file);
          break;
        case "close":
          this.view = undefined;
          break;
        case "play": {
          if (!this.view) throw new Error("Open a scene first");
          const play = this.read(this.view.file);
          if (!play) throw new Error(this.view!.why ?? "This scene cannot be played");
          await this.unmark();
          this.from = "director";
          this.playing = play.file;
          this.publish();
          await player.play({ id: crypto.randomBytes(8).toString("hex"), sheet: play.sheet, stage: play.stage, from: m.from ?? 0, loop: !!m.loop });
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
          await this.unmark();
          await player.stop();
          break;
        case "choose": {
          await this.unmark();
          const a = m.track ? player.cast().find((x) => x.track === m.track) : undefined;
          if (a?.id !== undefined) {
            this.chosen = a.track;
            this.pinId = await this.deps.pin(a.id, a.name);
          }
          break;
        }
        case "goTo": {
          const a = player.cast().find((x) => x.track === m.track);
          if (!a) throw new Error("That actor is not in the game: press Play");
          await this.deps.teleport(besideOf(a.position, a.yaw));
          await this.measure();
          break;
        }
      }
    } catch (e) {
      this.error = words(e);
    }
    this.publish();
  }
}
