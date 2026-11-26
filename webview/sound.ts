// The page's sound (D6b): the scene's sound files read once each through the browser's audio, for
// the waveform on the lane and for play with the playhead. Scrubbing is silent. A game sound is
// not played here: the page has no way to the game's own recordings in time.
import type { SceneDoc } from "../src/doc";
import { soundCues } from "../src/sound";

/** A sound file as the page holds it: its samples, and its peaks for drawing. */
interface Loaded {
  buffer: AudioBuffer;
  /** The loudest sample of each slice, 0 to 1; `rate` slices a second. */
  peaks: Float32Array;
  rate: number;
}

export interface SoundState {
  /** Files read, files being read, and files that could not be read, by the name the scene has them under. */
  loaded: string[];
  loading: string[];
  failed: Record<string, string>;
  /** Whether play is on, and what it started: each file, when in the scene, and how far into the file. */
  playing: boolean;
  started: { file: string; at: number; offset: number; lasts: number }[];
}

export interface PageSound {
  /** The scene's files and where each is fetched from. `changed` is called when a file has been read. */
  sync(urls: Record<string, string>, changed: () => void): void;
  /** A file's peaks between two moments of the file, as `count` values from 0 to 1; undefined until it is read. */
  peaks(file: string, from: number, to: number, count: number): number[] | undefined;
  /** Why a file could not be read, when it could not. */
  failed(file: string): string | undefined;
  /** How long the file at an address is: read once, for a file being added. */
  measure(url: string): Promise<number>;
  /** Plays the scene's sound files from a moment, in time with the playhead. */
  play(doc: SceneDoc, from: number): void;
  stop(): void;
  state(): SoundState;
}

const PeakRate = 200;

export function mountSound(): PageSound {
  let ctx: AudioContext | undefined;
  const audio = () => (ctx ??= new AudioContext());
  /** By address: an address changes when the host names another file. */
  const byUrl = new Map<string, Promise<Loaded>>();
  const ready = new Map<string, Loaded>();
  const errors = new Map<string, string>();
  let urls: Record<string, string> = {};
  let playing: { source: AudioBufferSourceNode; gain: GainNode }[] = [];
  let started: SoundState["started"] = [];
  let on = false;

  const load = (url: string): Promise<Loaded> => {
    let p = byUrl.get(url);
    if (!p) {
      p = (async () => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`the file could not be fetched (${res.status})`);
        const buffer = await audio().decodeAudioData(await res.arrayBuffer());
        const slice = Math.max(1, Math.floor(buffer.sampleRate / PeakRate));
        const peaks = new Float32Array(Math.ceil(buffer.length / slice));
        for (let c = 0; c < buffer.numberOfChannels; c++) {
          const data = buffer.getChannelData(c);
          for (let i = 0; i < data.length; i++) {
            const v = Math.abs(data[i]);
            const k = (i / slice) | 0;
            if (v > peaks[k]) peaks[k] = v;
          }
        }
        const loaded = { buffer, peaks, rate: buffer.sampleRate / slice };
        ready.set(url, loaded);
        return loaded;
      })();
      byUrl.set(url, p);
      p.catch((e) => errors.set(url, e instanceof Error ? e.message : String(e)));
    }
    return p;
  };

  const stop = () => {
    on = false;
    for (const p of playing) {
      try {
        p.source.stop();
      } catch {
        // Not started yet, or over already.
      }
      p.source.disconnect();
      p.gain.disconnect();
    }
    playing = [];
  };

  return {
    sync(next, changed) {
      urls = next;
      for (const url of Object.values(next)) if (!byUrl.has(url)) void load(url).then(changed, changed);
    },
    peaks(file, from, to, count) {
      const l = ready.get(urls[file] ?? "");
      if (!l || count <= 0 || to <= from) return undefined;
      const out: number[] = [];
      const step = ((to - from) * l.rate) / count;
      for (let i = 0; i < count; i++) {
        const a = Math.max(0, Math.floor(from * l.rate + i * step));
        const b = Math.min(l.peaks.length, Math.max(a + 1, Math.ceil(from * l.rate + (i + 1) * step)));
        let v = 0;
        for (let k = a; k < b; k++) if (l.peaks[k] > v) v = l.peaks[k];
        out.push(v);
      }
      return out;
    },
    failed(file) {
      const url = urls[file];
      return url ? errors.get(url) : undefined;
    },
    async measure(url) {
      return (await load(url)).buffer.duration;
    },
    play(doc, from) {
      stop();
      on = true;
      started = [];
      const a = audio();
      // A page may not sound before a click or a key: play comes from one.
      void a.resume();
      const now = a.currentTime + 0.03;
      for (const cue of soundCues(doc).cues) {
        if (!cue.file || cue.end <= from) continue;
        const l = ready.get(urls[cue.file] ?? "");
        if (!l) continue;
        const offset = Math.max(0, from - cue.t);
        const lasts = cue.end - cue.t - offset;
        const at = now + Math.max(0, cue.t - from);
        const source = a.createBufferSource();
        source.buffer = l.buffer;
        const gain = a.createGain();
        const volume = cue.volume ?? 1;
        const fadeIn = Math.max(0, (cue.fadeIn ?? 0) - offset);
        const fadeOut = Math.min(cue.fadeOut ?? 0, lasts);
        // A sound started part way in has had some or all of its fade in.
        gain.gain.setValueAtTime(fadeIn > 0 ? volume * (1 - fadeIn / (cue.fadeIn ?? fadeIn)) : volume, at);
        if (fadeIn > 0) gain.gain.linearRampToValueAtTime(volume, at + fadeIn);
        if (fadeOut > 0) {
          gain.gain.setValueAtTime(volume, at + lasts - fadeOut);
          gain.gain.linearRampToValueAtTime(0, at + lasts);
        }
        source.connect(gain).connect(a.destination);
        source.start(at, (cue.in ?? 0) + offset, lasts);
        playing.push({ source, gain });
        started.push({ file: cue.file, at: Math.max(cue.t, from), offset: (cue.in ?? 0) + offset, lasts });
      }
    },
    stop,
    state() {
      const names = Object.keys(urls);
      const failed: Record<string, string> = {};
      for (const f of names) if (errors.has(urls[f])) failed[f] = errors.get(urls[f])!;
      return { loaded: names.filter((f) => ready.has(urls[f])), loading: names.filter((f) => !ready.has(urls[f]) && !errors.has(urls[f])), failed, playing: on, started };
    },
  };
}
