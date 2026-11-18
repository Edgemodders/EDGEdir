// The cue sheet (D5b): what the game is told for a scene, as a pure function of the document. The
// cast, each actor's workspot clips, the jumps in time order, and the notes on what the game will
// not match. No VS Code, no page, no files, nothing read from the game. docs/d5-play-in-game.md.
import { markOf, playOf, sceneLength, transitionOf, unfit, type Clip, type Mark, type SceneDoc, type Track } from "./doc";
import { flat, joinOf } from "./pose";
import { weatherCues, weatherTrack } from "./weather";

/** One entry of an actor's workspot: a game animation, looping, named for its clip. */
export interface CueClip {
  /** The entry's name: the clip's id, with only letters, digits and `_`. */
  name: string;
  /** The `.anims` file's game path. */
  set: string;
  /** The animation's name in it. */
  anim: string;
}

/** One person the scene spawns and directs. */
export interface CastMember {
  track: string;
  name: string;
  record: string;
  appearance?: string;
  rig: string;
  /** Where the person stands, from the scene's anchor. */
  at: Mark;
  clips: CueClip[];
}

/** One timed order: at `t`, the track's person jumps to the entry `jump`. */
export interface Cue {
  t: number;
  track: string;
  jump: string;
}

export interface CueSheet {
  cues: 1;
  scene: string;
  /** The scene's length in seconds; after it the cast holds its last clips. */
  length: number;
  anchor: SceneDoc["anchor"];
  cast: CastMember[];
  timeline: Cue[];
  /** D6a: the weather to hold from a moment, or to give back (`reset`). Absent when the scene has none. */
  weather?: { t: number; state?: string; blend?: number; reset?: true }[];
}

/** Whether a cue sheet has anything for the game: somebody to play, or a weather to hold. */
export const playable = (sheet: CueSheet): boolean => sheet.cast.length > 0 || (sheet.weather?.length ?? 0) > 0;

export type GameNoteKind = "in" | "speed" | "made" | "transition" | "cut" | "player" | "noActor" | "noRig" | "standIn" | "weather";

/** One thing the game will not play as the preview shows it. */
export interface GameNote {
  kind: GameNoteKind;
  track: string;
  /** The clip it is about, by the id the lane knows it by (a block's inner clip is `block/clip`). Absent for a note about the whole track. */
  clip?: string;
  text: string;
}

const entryName = (id: string) => id.replace(/[^A-Za-z0-9_]/g, "_");
const label = (c: Clip) => c.name ?? (c.anim as { name?: string } | undefined)?.name ?? "the clip";
const num = (n: number) => String(Number(n.toFixed(3)));

/**
 * The cue sheet of a scene and its notes. A track is in the cast when it has one of the game's
 * characters as its actor, is not muted, and has a clip the game can play. Each such clip is one
 * looping workspot entry and one jump at its start; what ends a clip is the next clip's jump.
 */
export function cuesOf(doc: SceneDoc): { sheet: CueSheet; notes: GameNote[] } {
  const cast: CastMember[] = [];
  const timeline: Cue[] = [];
  const notes: GameNote[] = [];
  for (const lane of doc.tracks) {
    if (lane.kind !== "actor" || lane.mute) continue;
    const track = flat(lane);
    const anims = track.clips.filter((c) => playOf(c) && !unfit(track, c));
    if (!anims.length) continue;
    const who = whyLeftOut(lane);
    if (who) {
      notes.push({ ...who, track: lane.id });
      continue;
    }
    const actor = lane.actor!;
    const member: CastMember = {
      track: lane.id,
      name: actor.name ?? lane.name,
      record: actor.record!,
      ...(actor.appearance ? { appearance: actor.appearance } : {}),
      rig: actor.rig!,
      at: markOf(doc, lane.id),
      clips: [],
    };
    let played = false;
    for (const c of anims) {
      const p = playOf(c)!;
      if (!p.anim.set) {
        notes.push({ kind: "made", track: lane.id, clip: c.id, text: `Left out of the game: "${label(c)}" is a made animation, and a made animation cannot reach the game yet. The clip before it goes on looping.` });
        continue;
      }
      const name = entryName(c.id);
      member.clips.push({ name, set: p.anim.set, anim: p.anim.name });
      timeline.push({ t: c.start, track: lane.id, jump: name });
      if (p.in > 1e-6) notes.push({ kind: "in", track: lane.id, clip: c.id, text: `In the game "${label(c)}" starts from the animation's beginning, not from ${num(p.in)} s: a clip in the game has no start point.` });
      if (Math.abs(p.speed - 1) > 1e-6) notes.push({ kind: "speed", track: lane.id, clip: c.id, text: `In the game "${label(c)}" plays at normal speed, not at ${num(p.speed)}: a clip in the game has no speed.` });
      if (played && !joined(track, c)) notes.push({ kind: "cut", track: lane.id, clip: c.id, text: `The preview cuts to "${label(c)}"; the game blends into it by itself, for about half a second (not measured).` });
      played = true;
    }
    for (const tr of track.clips) {
      if (tr.kind !== "transition") continue;
      const { a, b } = joinOf(track, tr);
      if (!a || !b || !playOf(b)?.anim.set) continue;
      const { method } = transitionOf(tr);
      notes.push({
        kind: "transition",
        track: lane.id,
        clip: tr.id,
        text:
          method === "ai"
            ? `No AI provider makes transitions yet. The game joins "${label(a)}" to "${label(b)}" with its own blend.`
            : `The game joins "${label(a)}" to "${label(b)}" with its own blend, about half a second from where "${label(b)}" starts (not measured). This transition's method, length and ease are the preview's.`,
      });
    }
    if (member.clips.length) cast.push(member);
  }
  timeline.sort((x, y) => x.t - y.t);
  // D6a: the weather track.
  const weather = weatherCues(doc);
  const lane = weatherTrack(doc);
  if (lane) for (const n of weather.notes) notes.push({ kind: "weather", track: lane.id, clip: n.clip, text: n.text });
  const sheet: CueSheet = { cues: 1, scene: doc.name, length: sceneLength(doc), anchor: doc.anchor, cast, timeline };
  if (weather.cues.length) sheet.weather = weather.cues.map(({ clip: _clip, ...cue }) => cue);
  return { sheet, notes };
}

/** Whether a transition leads into a clip. */
function joined(track: Track, clip: Clip): boolean {
  return track.clips.some((c) => c.kind === "transition" && joinOf(track, c).b?.id === clip.id);
}

/** Why a track with clips is not in the cast, or undefined when it is. */
function whyLeftOut(track: Track): Omit<GameNote, "track"> | undefined {
  const actor = track.actor;
  if (!actor) return { kind: "noActor", text: `"${track.name}" is left out of the game: it has clips and no actor. Choose an actor for the track.` };
  if (actor.standIn) return { kind: "standIn", text: "A sequence plays in the game on an actor, in a scene: put it on an actor's track." };
  if (actor.player) return { kind: "player", text: "V does not play in the game yet: V's track is left out." };
  if (!actor.record) return { kind: "noActor", text: `"${track.name}" is left out of the game: its actor names no character. Choose the actor again.` };
  if (!actor.rig) return { kind: "noRig", text: `"${track.name}" is left out of the game: ${actor.name ?? "the actor"}'s rig is not known. Choose the actor again, with the game's files at hand.` };
  return undefined;
}

/** The notes about one clip on a lane: its own, and for a sequence block those of the clips in it. */
export function notesFor(notes: GameNote[], track: Track, clip: Clip): GameNote[] {
  const mine = notes.filter((n) => n.track === track.id);
  const own = mine.filter((n) => n.clip === clip.id || (clip.kind === "sequence" && n.clip?.startsWith(`${clip.id}/`)));
  // A track that is left out says so on each of its clips.
  return [...mine.filter((n) => !n.clip), ...own];
}
