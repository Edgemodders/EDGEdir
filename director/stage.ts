// EDGE Director's stage manager: what the window asks, done with the Desk (floor.ts) and the
// player (play.mjs), and the state the window shows. DR1: open, play, go to a moment, stop, the
// cast. DR2: adjust, each one a change to the scene's file made with EDGEdir's own edits, and
// shown at once on the people in the game. The game's calls are handed in, so this runs in a unit
// test and in a stand-in with no game. No `rednode` in here.
import * as crypto from "node:crypto";
import { markOf, setMark, setPlace, type SceneDoc } from "../src/doc";
import * as path from "node:path";
import { forgetPin, linkPins, markAtPin, pinsOf, placeAtPin, type Pin } from "../src/pins";
import { edit, isUnsaved, open, pinFileOf, readPinFile, rootsOf, same, scenes, syncPins, writePinFile, type Playable, type SceneView } from "./floor";
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
  pause(): Promise<boolean>;
  resume(): boolean;
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
  private pinDistances: Record<string, number> = {};
  /** The open scene's pins as they are drawn in the world: REDnode's pin id by the pin's title and place. */
  private drawn = new Map<string, number>();

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
      ...(view?.pins && Object.keys(this.pinDistances).length ? { pinDistances: this.pinDistances } : {}),
      ...(this.error ? { error: this.error } : {}),
    };
  }

  publish(): void {
    this.deps.publish(this.snapshot());
  }

  private read(file: string): Playable | undefined {
    // A pin dropped again or moved since the scene last read its pins moves what follows it.
    try {
      syncPins(file, this.deps.playDir);
    } catch {
      // The scene is read as it is.
    }
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

  /** Draws the open scene's pins in the world, and takes away the ones that are gone or moved. */
  private async showPins(): Promise<void> {
    const want = new Map((this.view?.pins?.pins ?? []).map((p) => [`${p.title} ${p.at.join(" ")}`, p]));
    for (const [key, id] of [...this.drawn]) {
      if (want.has(key)) continue;
      this.drawn.delete(key);
      await this.deps.unpin(id).catch(() => undefined);
    }
    for (const [key, p] of want) {
      if (this.drawn.has(key)) continue;
      const id = await this.deps.pin({ x: p.at[0], y: p.at[1], z: p.at[2] }, p.title).catch(() => undefined);
      if (id !== undefined) this.drawn.set(key, id);
    }
  }

  /** How far each actor and each pin is from V; and the open scene's pins are drawn in the world. */
  async measure(): Promise<void> {
    await this.showPins();
    const cast = this.deps.player.cast();
    const pins = this.view?.pins?.pins ?? [];
    if (!cast.length) this.distances = {};
    if (!pins.length) this.pinDistances = {};
    if (!cast.length && !pins.length) return;
    const v = await this.deps.whereV().catch(() => null);
    if (!v) return;
    const far = (x: number, y: number, z: number) => Math.round(Math.hypot(x - v.x, y - v.y, z - v.z) * 10) / 10;
    this.distances = Object.fromEntries(cast.map((a) => [a.track, far(a.position.x, a.position.y, a.position.z)]));
    this.pinDistances = Object.fromEntries(pins.map((p) => [p.title, far(p.at[0], p.at[1], p.at[2])]));
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
    // VS Code names a file with a small drive letter: the Desk's own spelling is used, so the window knows the row.
    const file = request.file && (scenes(this.deps.desk).find((s) => same(s.file, request.file!))?.file ?? request.file);
    this.playing = file;
    if (file) {
      try {
        this.read(file);
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
    // The scene in the game keeps its frame while it is in front of V; a scene at a place or on a
    // set has the frame its file gives it now; `frame` is one worked out by the caller.
    const to = frame ?? (play.sheet.anchor.mode === "player" ? player.frame() : frameOf(play.sheet, play.stage, null));
    if (!to) return;
    player.reframe(to);
    for (const a of player.cast()) {
      const lane = this.view!.tracks.find((t) => t.id === a.track);
      if (!lane?.mark || lane.placed) continue;
      const next = placeOf(to, lane.mark);
      if (Math.hypot(next.position.x - a.position.x, next.position.y - a.position.y, next.position.z - a.position.z) > 0.0005 || Math.abs(next.yaw - a.yaw) > 0.05) await player.place(a.track, next.position, next.yaw);
    }
    await this.measure();
  }

  /** The open scene's pin file, and the path its link names it by: the scene's own, beside its file, when it has none yet. */
  private pinFile(sceneFile: string): { file: string; link: string } {
    // Read through `edit` with no change: it refuses a scene that VS Code has unsaved, in words.
    const link = pinsOf(edit(sceneFile, (d) => d, this.deps.playDir));
    const file = pinFileOf(sceneFile, link);
    return { file, link: link?.path ?? path.basename(file) };
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
        case "pause":
          if (!(await player.pause())) throw new Error("Nothing is playing to pause");
          break;
        case "resume":
          if (!player.resume()) throw new Error("The scene is not paused");
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
        case "drop": {
          // A pin where V stands, in the scene's own pin file; one of the same name is moved there.
          const view = needView();
          const title = m.title.trim().slice(0, 80);
          if (!title) throw new Error("Give the pin a name first");
          const v = await this.v();
          const { file, link } = this.pinFile(view.file);
          const was = readPinFile(file) ?? { name: view.name, pins: [] as Pin[] };
          const at: [number, number, number] = [v.x, v.y, v.z];
          const pins = was.pins.some((p) => p.title === title) ? was.pins.map((p) => (p.title === title ? { ...p, at } : p)) : [...was.pins, { title, at }];
          writePinFile(file, was.name || view.name, pins);
          await this.change((doc) => linkPins(doc, link, { name: was.name || view.name, pins }));
          break;
        }
        case "removePin": {
          const view = needView();
          const { file, link } = this.pinFile(view.file);
          const was = readPinFile(file);
          if (!was) throw new Error("The scene's pin file was not found");
          const pins = was.pins.filter((p) => p.title !== m.title);
          writePinFile(file, was.name, pins);
          await this.change((doc) => linkPins(forgetPin(doc, m.title), link, { name: was.name, pins }));
          break;
        }
        case "markAtPin":
          needView();
          await this.change((doc) => markAtPin(doc, m.track, m.title));
          break;
        case "placeAtPin":
          needView();
          await this.change((doc) => placeAtPin(doc, m.title));
          break;
        case "goToPin": {
          const pin = needView().pins?.pins.find((p) => p.title === m.title);
          if (!pin) throw new Error(`The scene has no pin named "${m.title}"`);
          const v = await this.v();
          await this.deps.teleport({ x: pin.at[0], y: pin.at[1], z: pin.at[2], yaw: turnOf(v.fx, v.fy) });
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
    await this.measure().catch(() => undefined);
    this.publish();
  }
}
