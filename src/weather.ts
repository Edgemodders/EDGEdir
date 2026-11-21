// The weather track (D6a): a clip holds a weather state in the game for as long as it lasts.
// `"weather": { "state": "WeatherPresets.Rain", "blend": 5 }` on a clip of a weather track. The
// state is one of the game's `WeatherPresets` records, or a state's own name; REDnode's
// `world.setWeather` takes either. A scene has one weather track at most.
// Pure: no files, no VS Code. docs/d6-audio-camera-weather.md, "Weather (D6a)".
import { clipEnd, EditError, type Clip, type SceneDoc, type Track } from "./doc";

export interface Weather {
  /** A `WeatherPresets` record's path, or a weather state's own name. */
  state: string;
  /** Seconds the change is asked to take. The game may take less. */
  blend: number;
}

/** The longest blend a clip may ask for, in seconds. */
export const MaxBlend = 60;
export const DefaultBlend = 5;

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** A weather clip's weather, when it has a state. */
export function weatherOf(clip: Clip): Weather | undefined {
  const w = clip.weather as Partial<Weather> | undefined;
  if (clip.kind !== "weather" || !w || typeof w !== "object" || typeof w.state !== "string" || !w.state.trim()) return undefined;
  return { state: w.state.trim(), blend: isNumber(w.blend) ? Math.min(MaxBlend, Math.max(0, w.blend)) : DefaultBlend };
}

/** A state's plain name: `WeatherPresets.Heavy_Clouds` and `24h_weather_heavy_clouds` both read "Heavy clouds". */
export function weatherLabel(state: string): string {
  const bare = state
    .replace(/^WeatherPresets\./i, "")
    .replace(/^24h_weather_/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_+/g, " ")
    .trim()
    .toLowerCase();
  return bare ? bare[0].toUpperCase() + bare.slice(1) : state;
}

/** How the preview's background is tinted for a state: grey for rain, fog and cloud, warm for sun, sand for dust. */
export function weatherTint(state: string): "grey" | "warm" | "sand" | undefined {
  const s = state.toLowerCase();
  if (/sand|pollution|toxic/.test(s)) return "sand";
  if (/rain|fog|cloud|storm|blue/.test(s)) return "grey";
  if (/sun|clear|morning/.test(s)) return "warm";
  return undefined;
}

/** Sets a weather clip's state or blend. What is not named stays. */
export function setWeather(doc: SceneDoc, clipId: string, change: Partial<Weather>): SceneDoc {
  let found = false;
  const tracks = doc.tracks.map((t) => {
    const clip = t.clips.find((c) => c.id === clipId);
    if (!clip) return t;
    found = true;
    if (t.kind !== "weather" || clip.kind !== "weather") throw new EditError("Only a clip on the weather track holds a weather");
    if (t.lock) throw new EditError("That track is locked");
    const was = weatherOf(clip);
    const state = change.state !== undefined ? String(change.state).trim() : (was?.state ?? "");
    if (!state) throw new EditError("Choose a weather for the clip");
    const blend = change.blend !== undefined ? change.blend : (was?.blend ?? DefaultBlend);
    if (!isNumber(blend) || blend < 0 || blend > MaxBlend) throw new EditError(`A blend is from 0 to ${MaxBlend} seconds`);
    return { ...t, clips: t.clips.map((c) => (c.id === clipId ? { ...c, weather: { state, blend: Math.round(blend * 100) / 100 } } : c)) };
  });
  if (!found) throw new EditError("That clip is no longer in the scene");
  return { ...doc, tracks };
}

/** What the game is told about the weather: a state to hold from a moment, or to give the weather back. */
export interface WeatherCue {
  t: number;
  /** The state to hold; absent on a cue that gives the weather back. */
  state?: string;
  blend?: number;
  reset?: true;
  /** The clip the cue is from. */
  clip: string;
}

const Near = 0.001;

/** The scene's weather track that plays: the first that is not muted. */
export const weatherTrack = (doc: SceneDoc): Track | undefined => doc.tracks.find((t) => t.kind === "weather" && !t.mute);

/**
 * The weather cues of a scene, in time: each clip with a state sets it at its start, and where a
 * clip ends with no other starting there, the weather is given back (the owner's W1). And the
 * notes: what the game will not do as the lane shows it.
 */
export function weatherCues(doc: SceneDoc): { cues: WeatherCue[]; notes: { clip: string; text: string }[] } {
  const track = weatherTrack(doc);
  const cues: WeatherCue[] = [];
  const notes: { clip: string; text: string }[] = [];
  if (!track) return { cues, notes };
  const clips = track.clips.filter((c) => weatherOf(c)).sort((a, b) => a.start - b.start);
  clips.forEach((c, i) => {
    const w = weatherOf(c)!;
    const next = clips[i + 1];
    cues.push({ t: c.start, state: w.state, blend: w.blend, clip: c.id });
    const touches = !!next && Math.abs(next.start - clipEnd(c)) < Near;
    if (!touches) cues.push({ t: clipEnd(c), reset: true, clip: c.id });
    notes.push({ clip: c.id, text: `The change to ${weatherLabel(w.state)} starts at the clip's start and is asked to take ${w.blend} s; in REDnode's test the game took a couple of seconds whatever was asked.` });
    if (!touches) notes.push({ clip: c.id, text: "At this clip's end the weather goes back to what it was before the scene, over about 10 s." });
    if (w.blend > c.length + Near) notes.push({ clip: c.id, text: `The blend (${w.blend} s) is longer than the clip (${Math.round(c.length * 100) / 100} s): ${touches ? "the next change starts" : "the weather starts to go back"} before this one is done.` });
  });
  for (const c of track.clips) if (c.kind === "weather" && !weatherOf(c)) notes.push({ clip: c.id, text: "Left out of the game: this clip has no weather yet." });
  return { cues, notes };
}

/** The weather the lane holds at a moment: the clip under it that has a state. */
export function weatherAt(doc: SceneDoc, time: number): Weather | undefined {
  const clip = weatherTrack(doc)?.clips.find((c) => time >= c.start - 1e-6 && time < clipEnd(c) - 1e-6 && weatherOf(c));
  return clip ? weatherOf(clip) : undefined;
}
