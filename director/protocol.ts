// What EDGE Director's window and its Node mod say to each other over REDnode's `channel`. The
// page asks; the mod answers with the whole state each time, so a page that opens late, or again,
// shows the same as one that was there from the start.
import type { SceneRow, SceneView } from "./floor";

/** The player's word on the play (director/play.mjs). */
export interface PlayNow {
  id?: string;
  state: "idle" | "writing" | "loading" | "spawning" | "warming" | "playing" | "ended" | "stopped" | "failed";
  text: string;
  /** When the scene's time 0 was, on this PC's clock, in milliseconds. */
  startedAt?: number;
  length?: number;
  loop?: boolean;
  late?: { t: number; track: string; jump: string; ms: number; ok: boolean; error?: string }[];
  notes?: string[];
}

/** An actor in the game now. */
export interface CastNow {
  track: string;
  name: string;
  /** Metres from V, when V was found. */
  distance?: number;
}

export interface Snapshot {
  /** The Director's version. */
  version: string;
  scenes: SceneRow[];
  /** The open scene. */
  view?: SceneView;
  /** The file of the scene that is in the game, when one is. */
  playing?: string;
  /** Who sent the scene that is in the game: this window, or EDGEdir in VS Code. */
  from?: "director" | "editor";
  play: PlayNow;
  cast: CastNow[];
  /** The actor marked in the world with a pin. */
  chosen?: string;
  /** The last thing that went wrong, in words. Gone with the next thing that goes right. */
  error?: string;
}

export type PageMessage =
  | { type: "hello" }
  | { type: "scenes" }
  | { type: "open"; file: string }
  | { type: "close" }
  | { type: "play"; from?: number; loop?: boolean }
  | { type: "seek"; t: number }
  | { type: "loop"; on: boolean }
  | { type: "stop" }
  | { type: "choose"; track?: string }
  | { type: "goTo"; track: string };

export type ModMessage = { type: "state"; state: Snapshot };

/** The states in which a scene is in the game: its cast is there, or is on its way. */
export const Active = ["writing", "loading", "spawning", "warming", "playing", "ended"];
