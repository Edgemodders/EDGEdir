// The audio track (D6b): a clip is a sound file kept with the scene, or one of the game's own
// sounds by its event name.
//   "sound": { "file": "audio/line.wav", "seconds": 3.2, "in": 0.5, "volume": 1, "fadeIn": 0, "fadeOut": 0.3, "category": "dialogue" }
//   "sound": { "event": "ui_menu_onpress" }
// A file is named from the scene's own folder, with `/`. `seconds` is the whole file's length,
// copied in so the lane and the trim know the file's ends without reading it. A clip's length is
// the part that plays; a game sound's length is the modder's, since the game does not say it.
// Pure: no files, no VS Code. docs/d6-audio-camera-weather.md, "Audio (D6b)".
import { clipEnd, EditError, findClip, findTrack, freeStart, nextClipId, toFrame, type Clip, type SceneDoc, type Track } from "./doc";

/** The game's volume slider a sound file follows (REDnode's names). */
export const Categories = ["sfx", "dialogue", "music"] as const;
export type Category = (typeof Categories)[number];
export const CategoryNames: Record<Category, string> = { sfx: "Sound effects", dialogue: "Dialogue", music: "Music" };

/** The folder a scene's sound files are kept in, beside the scene's file. */
export const SoundFolder = "audio";
/** The kinds of file REDnode plays. */
export const SoundEndings = ["wav", "ogg", "mp3", "flac"] as const;

/** The loudest a clip may be: twice as recorded. */
export const MaxVolume = 2;
/** The length a game sound's clip gets when the game's list gives none, in seconds. */
export const EventLength = 2;

/** A sound clip's sound, with what the document leaves out filled in. */
export interface Sound {
  /** A sound file, from the scene's folder, with `/`. */
  file?: string;
  /** One of the game's sound events, by name. */
  event?: string;
  /** A file's whole length, when it is known. */
  seconds?: number;
  /** Seconds into the file where the clip starts. */
  in: number;
  /** 1 is as recorded. */
  volume: number;
  /** Seconds. */
  fadeIn: number;
  fadeOut: number;
  category: Category;
}

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const round = (n: number) => Math.round(n * 1000) / 1000;
const Eps = 1e-6;

/** An audio clip's sound, when it names a file or a game sound. */
export function soundOf(clip: Clip): Sound | undefined {
  const s = clip.sound as Partial<Sound> | undefined;
  if (clip.kind !== "audio" || !s || typeof s !== "object") return undefined;
  const file = typeof s.file === "string" && s.file.trim() ? s.file.trim().replace(/\\/g, "/") : undefined;
  const event = !file && typeof s.event === "string" && s.event.trim() ? s.event.trim() : undefined;
  if (!file && !event) return undefined;
  const seconds = file && isNumber(s.seconds) && s.seconds > 0 ? s.seconds : undefined;
  return {
    ...(file ? { file } : { event }),
    ...(seconds ? { seconds } : {}),
    in: file && isNumber(s.in) ? Math.min(Math.max(0, s.in), seconds ?? Infinity) : 0,
    volume: isNumber(s.volume) ? Math.min(MaxVolume, Math.max(0, s.volume)) : 1,
    fadeIn: isNumber(s.fadeIn) ? Math.max(0, s.fadeIn) : 0,
    fadeOut: isNumber(s.fadeOut) ? Math.max(0, s.fadeOut) : 0,
    category: Categories.includes(s.category as Category) ? (s.category as Category) : "sfx",
  };
}

/** A file's name without its folder and ending: `audio/door slam.wav` reads "door slam". */
export const fileLabel = (file: string) => (file.split("/").pop() ?? file).replace(/\.[^.]+$/, "");

/** What a sound clip is called on the lane when it has no name of its own. */
export function soundLabel(clip: Clip): string | undefined {
  const s = soundOf(clip);
  return s ? (s.file ? fileLabel(s.file) : s.event) : undefined;
}

/** A sound as the document keeps it: what is as recorded is left out, so the text stays short. */
function written(s: Sound): Record<string, unknown> {
  const out: Record<string, unknown> = s.file ? { file: s.file } : { event: s.event };
  if (s.file && s.seconds) out.seconds = round(s.seconds);
  // As fine as the lane's own times, so an edge dragged in and out again comes back to where it was.
  if (s.file && s.in > Eps) out.in = Math.round(s.in * 1e6) / 1e6;
  if (Math.abs(s.volume - 1) > Eps) out.volume = round(s.volume);
  if (s.fadeIn > Eps) out.fadeIn = round(s.fadeIn);
  if (s.fadeOut > Eps) out.fadeOut = round(s.fadeOut);
  if (s.category !== "sfx") out.category = s.category;
  return out;
}

const withTrack = (doc: SceneDoc, trackId: string, change: (t: Track) => Track): SceneDoc => ({ ...doc, tracks: doc.tracks.map((t) => (t.id === trackId ? change(t) : t)) });
const sorted = (clips: Clip[]) => [...clips].sort((a, b) => a.start - b.start);

function audioTrack(doc: SceneDoc, trackId: string): Track {
  const t = findTrack(doc, trackId);
  if (!t) throw new EditError("That track is no longer in the scene");
  if (t.kind !== "audio") throw new EditError("A sound goes on an audio track");
  if (t.lock) throw new EditError("That track is locked");
  return t;
}

/** A sound file as a new clip on an audio track, at `start` or the first free time after it, at its full length. */
export function addSoundClip(doc: SceneDoc, trackId: string, sound: { file: string; seconds: number }, start: number): { doc: SceneDoc; id: string } {
  const t = audioTrack(doc, trackId);
  const file = sound.file.trim().replace(/\\/g, "/");
  if (!file) throw new EditError("That sound has no file");
  if (!isNumber(sound.seconds) || sound.seconds <= 0) throw new EditError("That sound's length is not known");
  const id = nextClipId(doc);
  const length = Math.max(1 / doc.fps, round(sound.seconds));
  const made: Clip = { id, kind: "audio", start: freeStart(t, "audio", toFrame(doc, Math.max(0, start)), length), length, sound: { file, seconds: round(sound.seconds) } };
  return { doc: withTrack(doc, trackId, (x) => ({ ...x, clips: sorted([...x.clips, made]) })), id };
}

/** One of the game's sounds as a new clip on an audio track. `seconds` is its length when the game's list gives one. */
export function addEventClip(doc: SceneDoc, trackId: string, event: string, start: number, seconds?: number): { doc: SceneDoc; id: string } {
  const t = audioTrack(doc, trackId);
  const name = event.trim();
  if (!name) throw new EditError("A game sound needs its name");
  if (/\s/.test(name)) throw new EditError("A game sound's name has no spaces");
  const id = nextClipId(doc);
  const length = Math.max(1 / doc.fps, toFrame(doc, isNumber(seconds) && seconds > 0 ? Math.min(seconds, 600) : EventLength));
  const made: Clip = { id, kind: "audio", start: freeStart(t, "audio", toFrame(doc, Math.max(0, start)), length), length, sound: { event: name } };
  return { doc: withTrack(doc, trackId, (x) => ({ ...x, clips: sorted([...x.clips, made]) })), id };
}

/** Sets a sound clip's volume, fades, category or game sound. What is not named stays. */
export function setSound(doc: SceneDoc, clipId: string, change: { volume?: number; fadeIn?: number; fadeOut?: number; category?: string; event?: string }): SceneDoc {
  const f = findClip(doc, clipId);
  if (!f) throw new EditError("That clip is no longer in the scene");
  if (f.track.kind !== "audio" || f.clip.kind !== "audio") throw new EditError("Only a clip on an audio track holds a sound");
  if (f.track.lock) throw new EditError("That track is locked");
  const was = soundOf(f.clip);
  const next: Sound = was ? { ...was } : { in: 0, volume: 1, fadeIn: 0, fadeOut: 0, category: "sfx" };
  if (change.event !== undefined) {
    if (was?.file) throw new EditError("This clip plays a file. Add a game sound as its own clip");
    const name = change.event.trim();
    if (!name) throw new EditError("A game sound needs its name");
    if (/\s/.test(name)) throw new EditError("A game sound's name has no spaces");
    next.event = name;
  }
  if (!next.file && !next.event) throw new EditError("The clip has no sound yet: add a sound file or a game sound");
  if (change.volume !== undefined) {
    if (!isNumber(change.volume) || change.volume < 0 || change.volume > MaxVolume) throw new EditError(`A volume is from 0 to ${MaxVolume}: 1 is as recorded`);
    next.volume = change.volume;
  }
  for (const key of ["fadeIn", "fadeOut"] as const) {
    const v = change[key];
    if (v === undefined) continue;
    if (!isNumber(v) || v < 0) throw new EditError("A fade is 0 seconds or more");
    next[key] = v;
  }
  if (next.fadeIn + next.fadeOut > f.clip.length + Eps) throw new EditError(`The fades are longer than the clip (${round(f.clip.length)} s)`);
  if (change.category !== undefined) {
    if (!Categories.includes(change.category as Category)) throw new EditError("A sound follows the sound effects, dialogue or music slider");
    next.category = change.category as Category;
  }
  return withTrack(doc, f.track.id, (t) => ({ ...t, clips: t.clips.map((c) => (c.id === clipId ? { ...c, sound: written(next) } : c)) }));
}

/**
 * A sound clip after one of the lane's edits (src/doc.ts's trim and split), which hand in the clip
 * as it would be for any kind: a file's clip keeps to the file's ends, and its start point follows
 * a start edge that moved. `moved` is how far the clip's start went, in seconds (a trim's start
 * edge, or the second part of a split). A split's first part drops its fade out, its second the fade in.
 */
export function fitSound(clip: Clip, was: Clip, moved: number, drop?: "fadeIn" | "fadeOut"): Clip {
  const s = soundOf(was);
  if (!s?.file) return clip;
  let start = clip.start;
  let from = s.in + moved;
  // Before the file's start there is nothing to play: the edge stops there.
  if (from < 0) {
    start = clip.start - from;
    from = 0;
  }
  const end = clipEnd(clip);
  let length = Math.round((end - start) * 1e6) / 1e6;
  if (s.seconds) length = Math.min(length, Math.round((s.seconds - from) * 1e6) / 1e6);
  const fadeIn = drop === "fadeIn" ? 0 : s.fadeIn;
  const fadeOut = drop === "fadeOut" ? 0 : s.fadeOut;
  const fades = fadeIn + fadeOut;
  const scale = fades > length && fades > 0 ? length / fades : 1;
  return { ...clip, start: Math.round(start * 1e6) / 1e6, length, sound: written({ ...s, in: from, fadeIn: fadeIn * scale, fadeOut: fadeOut * scale }) };
}

/** One sound the game is told to play: from `t` to `end` of the scene's time. */
export interface SoundCue {
  t: number;
  end: number;
  file?: string;
  event?: string;
  /** Seconds into the file where it starts. */
  in?: number;
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
  category?: Category;
  /** The clip and track the cue is from. */
  clip: string;
  track: string;
}

/**
 * The sound cues of a scene, in time: every clip with a sound on an audio track that is not muted.
 * And the notes: what the game will not do as the lane and the preview show it.
 */
export function soundCues(doc: SceneDoc): { cues: SoundCue[]; notes: { track: string; clip: string; text: string }[] } {
  const cues: SoundCue[] = [];
  const notes: { track: string; clip: string; text: string }[] = [];
  for (const track of doc.tracks) {
    if (track.kind !== "audio" || track.mute) continue;
    for (const c of track.clips) {
      const s = soundOf(c);
      if (!s) {
        if (c.kind === "audio") notes.push({ track: track.id, clip: c.id, text: "Left out of the game: this clip has no sound yet." });
        continue;
      }
      if (s.file) {
        cues.push({ t: c.start, end: clipEnd(c), file: s.file, in: s.in, volume: s.volume, fadeIn: s.fadeIn, fadeOut: s.fadeOut, category: s.category, clip: c.id, track: track.id });
        notes.push({ track: track.id, clip: c.id, text: `In the game the file is heard flat, as if at V, and follows the player's ${CategoryNames[s.category]} volume. A sound has no place in the world yet.` });
        notes.push({ track: track.id, clip: c.id, text: "It pauses while a game menu is open; the scene's clock does not, so after a menu the sound runs behind." });
      } else {
        cues.push({ t: c.start, end: clipEnd(c), event: s.event, clip: c.id, track: track.id });
        notes.push({ track: track.id, clip: c.id, text: "A game sound is not heard in the preview's play: Hear plays one recording of it, when EDGEwave is installed." });
        notes.push({ track: track.id, clip: c.id, text: `The game does not say when it does not know the name "${s.event}": it then plays nothing. The sound is posted on V, and stopped at the clip's end.` });
        if (Math.abs(s.volume - 1) > Eps || s.fadeIn > Eps || s.fadeOut > Eps) notes.push({ track: track.id, clip: c.id, text: "A game sound plays at the game's own volume: the clip's volume and fades are not used." });
      }
    }
  }
  cues.sort((a, b) => a.t - b.t);
  return { cues, notes };
}

/** The sound files a scene's clips name, each once, as the document spells them. */
export function soundFiles(doc: SceneDoc): string[] {
  const files = new Set<string>();
  for (const t of doc.tracks) if (t.kind === "audio") for (const c of t.clips) if (soundOf(c)?.file) files.add(soundOf(c)!.file!);
  return [...files];
}

/**
 * How loud a file's clip is at a moment of the scene, from 0 to its volume: the fades at its two
 * ends. 0 outside the clip.
 */
export function gainAt(cue: Pick<SoundCue, "t" | "end" | "volume" | "fadeIn" | "fadeOut">, time: number): number {
  if (time < cue.t || time >= cue.end) return 0;
  const volume = cue.volume ?? 1;
  const up = cue.fadeIn && cue.fadeIn > 0 ? Math.min(1, (time - cue.t) / cue.fadeIn) : 1;
  const down = cue.fadeOut && cue.fadeOut > 0 ? Math.min(1, (cue.end - time) / cue.fadeOut) : 1;
  return volume * Math.min(up, down);
}
