// D6b: the audio track. The document's rules and the cues (src/sound.ts, src/cues.ts), a scene's
// sound files on disk (src/soundFiles.ts, src/play.ts, director/sounds.ts), and the player's part
// (director/play.mjs) against a stand-in for REDnode's audio. Made-up names; nothing from the game.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { open } from "../director/floor";
import { Player } from "../director/play.mjs";
import { fetchSound } from "../director/sounds";
import { cuesOf, playable, type CueSheet } from "../src/cues";
import { newScene } from "../src/desk";
import { addClip, addTrack, EditError, formatDoc, newDoc, parseDoc, splitClip, trimClip, type SceneDoc } from "../src/doc";
import { soundsFor } from "../src/play";
import { addEventClip, addSoundClip, gainAt, setSound, soundCues, soundFiles, soundLabel, soundOf } from "../src/sound";
import { keepSound, soundPath } from "../src/soundFiles";

const scratch = () => fs.mkdtempSync(path.join(os.tmpdir(), "edgedir-sound-"));
const until = async (what: () => boolean, ms = 2000) => {
  const end = Date.now() + ms;
  while (!what() && Date.now() < end) await new Promise((r) => setTimeout(r, 5));
  assert.ok(what(), "waited too long");
};

/** A scene with one audio track. */
function scene() {
  const doc: SceneDoc = addTrack(newDoc("Alley"), "audio");
  return { doc, lane: doc.tracks[0].id };
}

test("a sound file is a clip as long as the file; a game sound's length is the list's, or 2 s", () => {
  const { doc, lane } = scene();
  const a = addSoundClip(doc, lane, { file: "audio\\door slam.wav", seconds: 3.2 }, 1);
  const clip = a.doc.tracks[0].clips[0];
  assert.deepEqual([clip.start, clip.length, clip.sound], [1, 3.2, { file: "audio/door slam.wav", seconds: 3.2 }]);
  assert.deepEqual(soundOf(clip), { file: "audio/door slam.wav", seconds: 3.2, in: 0, volume: 1, fadeIn: 0, fadeOut: 0, category: "sfx" });
  assert.equal(soundLabel(clip), "door slam");
  // The next one goes after it when it would overlap.
  const b = addSoundClip(a.doc, lane, { file: "audio/hum.ogg", seconds: 2 }, 2);
  assert.equal(b.doc.tracks[0].clips[1].start, 4.2);
  const e = addEventClip(b.doc, lane, "ui_menu_onpress", 10);
  const f = addEventClip(e.doc, lane, "amb_city_loop", 20, 4.5);
  const [, , first, second] = f.doc.tracks[0].clips;
  assert.deepEqual([first.length, first.sound, second.length], [2, { event: "ui_menu_onpress" }, 4.5]);
  assert.equal(soundLabel(first), "ui_menu_onpress");
  assert.deepEqual(soundFiles(f.doc), ["audio/door slam.wav", "audio/hum.ogg"]);
  // To text and back.
  assert.deepEqual(parseDoc(formatDoc(f.doc)), f.doc);
  assert.throws(() => addSoundClip(doc, lane, { file: "audio/x.wav", seconds: 0 }, 0), /length is not known/);
  assert.throws(() => addEventClip(doc, lane, "two words", 0), /no spaces/);
  assert.throws(() => addSoundClip(addTrack(doc, "weather"), addTrack(doc, "weather").tracks[1].id, { file: "audio/x.wav", seconds: 1 }, 0), /audio track/);
});

test("volume, fades and the slider a sound follows are set and checked", () => {
  const { doc, lane } = scene();
  const a = addSoundClip(doc, lane, { file: "audio/line.wav", seconds: 4 }, 0);
  let d = setSound(a.doc, a.id, { volume: 0.5, fadeIn: 1, category: "dialogue" });
  assert.deepEqual(d.tracks[0].clips[0].sound, { file: "audio/line.wav", seconds: 4, volume: 0.5, fadeIn: 1, category: "dialogue" });
  d = setSound(d, a.id, { volume: 1, fadeIn: 0, category: "sfx" });
  assert.deepEqual(d.tracks[0].clips[0].sound, { file: "audio/line.wav", seconds: 4 });
  assert.throws(() => setSound(d, a.id, { volume: 3 }), /0 to 2/);
  assert.throws(() => setSound(d, a.id, { fadeIn: 3, fadeOut: 2 }), /longer than the clip/);
  assert.throws(() => setSound(d, a.id, { category: "voices" }), /slider/);
  assert.throws(() => setSound(d, a.id, { event: "x" }), /plays a file/);
  assert.throws(() => setSound(d, "nope", { volume: 1 }), EditError);
  // An empty clip takes a game sound, and nothing else until it has one.
  const empty = addClip(doc, lane, { start: 0, length: 1 });
  assert.throws(() => setSound(empty.doc, empty.id, { volume: 0.5 }), /no sound yet/);
  assert.deepEqual(setSound(empty.doc, empty.id, { event: "ui_menu_onpress" }).tracks[0].clips[0].sound, { event: "ui_menu_onpress" });
  // How loud a clip is at a moment: the fades at its two ends.
  const cue = { t: 2, end: 6, volume: 0.8, fadeIn: 1, fadeOut: 2 };
  assert.deepEqual([gainAt(cue, 1), gainAt(cue, 2.5), gainAt(cue, 3.5), gainAt(cue, 5), gainAt(cue, 6)], [0, 0.4, 0.8, 0.4, 0]);
});

test("trimming a file's clip moves its start point and stops at the file's ends; a split cuts the file too", () => {
  const { doc, lane } = scene();
  const a = addSoundClip(doc, lane, { file: "audio/line.wav", seconds: 4 }, 2);
  // The start edge in by a second: the clip starts a second into the file.
  let d = trimClip(a.doc, a.id, "start", 3);
  let c = d.tracks[0].clips[0];
  assert.deepEqual([c.start, c.length, soundOf(c)!.in], [3, 3, 1]);
  // Out again past the file's start: it stops where the file starts.
  d = trimClip(d, a.id, "start", 0.5);
  c = d.tracks[0].clips[0];
  assert.deepEqual([c.start, c.length, soundOf(c)!.in], [2, 4, 0]);
  // In to a time off the millisecond and out again: the clip is back where it was, to the frame.
  d = trimClip(trimClip(d, a.id, "start", 2.866667), a.id, "start", 0);
  c = d.tracks[0].clips[0];
  assert.deepEqual([c.start, c.length, soundOf(c)!.in], [2, 4, 0]);
  // The end edge in, then out past the file's end.
  d = trimClip(d, a.id, "end", 4);
  assert.equal(d.tracks[0].clips[0].length, 2);
  d = trimClip(d, a.id, "end", 30);
  assert.equal(d.tracks[0].clips[0].length, 4);
  // A split: each part plays its own share, and keeps the fade at its own outer end.
  d = setSound(d, a.id, { fadeIn: 0.5, fadeOut: 0.5 });
  const s = splitClip(d, a.id, 3);
  const [first, second] = s.doc.tracks[0].clips;
  assert.deepEqual([first.start, first.length, soundOf(first)!.in, soundOf(first)!.fadeIn, soundOf(first)!.fadeOut], [2, 1, 0, 0.5, 0]);
  assert.deepEqual([second.start, second.length, soundOf(second)!.in, soundOf(second)!.fadeIn, soundOf(second)!.fadeOut], [3, 3, 1, 0, 0.5]);
  // A game sound's clip is as long as it is dragged.
  const e = addEventClip(doc, lane, "amb_city_loop", 0);
  assert.equal(trimClip(e.doc, e.id, "end", 30).tracks[0].clips[0].length, 30);
});

test("the cue sheet lists the sounds of tracks that are not muted, with notes on what the game does", () => {
  const { doc, lane } = scene();
  let d = addSoundClip(doc, lane, { file: "audio/line.wav", seconds: 4 }, 1).doc;
  d = setSound(d, d.tracks[0].clips[0].id, { volume: 0.5, fadeOut: 1, category: "dialogue" });
  d = addEventClip(d, lane, "ui_menu_onpress", 6).doc;
  d = addClip(d, lane, { start: 10, length: 1 }).doc;
  const { sheet, notes } = cuesOf(d);
  assert.deepEqual(sheet.sounds, [
    { t: 1, end: 5, file: "audio/line.wav", in: 0, volume: 0.5, fadeIn: 0, fadeOut: 1, category: "dialogue" },
    { t: 6, end: 8, event: "ui_menu_onpress" },
  ]);
  // A scene with sounds and nobody in it has something to play.
  assert.equal(playable(sheet), true);
  assert.deepEqual([sheet.cast.length, sheet.length], [0, 11]);
  const said = (clip: string) => notes.filter((n) => n.kind === "sound" && n.clip === clip).map((n) => n.text).join(" ");
  const [file, event, empty] = d.tracks[0].clips.map((c) => c.id);
  assert.match(said(file), /flat, as if at V/);
  assert.match(said(file), /Dialogue volume/);
  assert.match(said(event), /not heard in the preview/);
  assert.match(said(event), /does not say when it does not know the name "ui_menu_onpress"/);
  assert.match(said(empty), /no sound yet/);
  // Muted: nothing for the game.
  const muted = { ...d, tracks: d.tracks.map((t) => ({ ...t, mute: true })) };
  assert.equal(cuesOf(muted).sheet.sounds, undefined);
  assert.deepEqual(soundCues(muted), { cues: [], notes: [] });
});

test("a sound file is kept in the scene's audio folder, once, and found from the scene's file", () => {
  const dir = scratch();
  const sceneFile = path.join(dir, "scene", "Alley.edgedir");
  fs.mkdirSync(path.dirname(sceneFile), { recursive: true });
  const src = path.join(dir, "Door: slam.WAV".replace(":", ""));
  fs.writeFileSync(src, "one");
  const kept = keepSound(src, sceneFile);
  assert.equal(kept, "audio/Door slam.wav");
  assert.equal(fs.readFileSync(path.join(dir, "scene", "audio", "Door slam.wav"), "utf8"), "one");
  // The same file again is the same file; another file of that name gets a number.
  assert.equal(keepSound(src, sceneFile), kept);
  fs.writeFileSync(src, "two!");
  assert.equal(keepSound(src, sceneFile), "audio/Door slam-2.wav");
  // One picked from the audio folder itself stays where it is.
  assert.equal(keepSound(path.join(dir, "scene", "audio", "Door slam.wav"), sceneFile), "audio/Door slam.wav");
  assert.throws(() => keepSound(path.join(dir, "notes.txt"), sceneFile), /WAV, OGG, MP3, FLAC/);
  assert.equal(soundPath(sceneFile, kept), path.join(dir, "scene", "audio", "Door slam.wav"));
  assert.equal(soundPath(sceneFile, "audio/gone.wav"), undefined);
  // A name that climbs out of the scene's folder is not the scene's.
  assert.equal(soundPath(sceneFile, "../Door slam.WAV"), undefined);
  // The request's list: each file once, by where it is on this PC, and the ones that are not there.
  const sheet = { sounds: [{ t: 0, end: 1, file: kept }, { t: 2, end: 3, file: kept }, { t: 4, end: 5, file: "audio/gone.wav" }, { t: 6, end: 7, event: "x" }] } as unknown as CueSheet;
  assert.deepEqual(soundsFor(sceneFile, sheet), { sounds: { [kept]: path.join(dir, "scene", "audio", "Door slam.wav") }, missing: ["audio/gone.wav"] });
  // The Director's copy: into its data folder, made again only when the file changed.
  const data = path.join(dir, "data");
  const copy = fetchSound(path.join(dir, "scene", "audio", "Door slam.wav"), data);
  assert.equal(path.dirname(copy), path.join(data, "sounds"));
  assert.equal(fs.readFileSync(copy, "utf8"), "one");
  const made = fs.statSync(copy).mtimeMs;
  assert.equal(fetchSound(path.join(dir, "scene", "audio", "Door slam.wav"), data), copy);
  assert.equal(fs.statSync(copy).mtimeMs, made);
  assert.throws(() => fetchSound(path.join(dir, "nope.wav"), data), /not in the scene's folder/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the Director reads a Desk scene's sounds from its folder, and says which file is gone", () => {
  const dir = scratch();
  const item = newScene("Alley", dir);
  const src = path.join(dir, "hum.ogg");
  fs.writeFileSync(src, "hum");
  let d = addTrack(parseDoc(fs.readFileSync(item.file, "utf8")), "audio");
  d = addSoundClip(d, d.tracks[0].id, { file: keepSound(src, item.file), seconds: 2 }, 0).doc;
  d = addSoundClip(d, d.tracks[0].id, { file: "audio/gone.wav", seconds: 1 }, 5).doc;
  fs.writeFileSync(item.file, formatDoc(d));
  const { view, play } = open(item.file, {});
  assert.deepEqual(play?.sounds, { "audio/hum.ogg": path.join(path.dirname(item.file), "audio", "hum.ogg") });
  assert.ok(view.notes.some((n) => /"audio\/gone.wav" is not in the scene's folder/.test(n)));
  assert.deepEqual([view.tracks[0].cast, view.tracks[0].clips.map((c) => [c.label, c.played])], [true, [["hum", true], ["gone", true]]]);
  fs.rmSync(dir, { recursive: true, force: true });
});

/** A stand-in for REDnode's audio: what was played and stopped, in order. */
function fakeAudio() {
  const calls: string[] = [];
  return {
    calls,
    audio: {
      play: async (file: string, o: { start: number; end: number; volume: number; fadeIn: number; category: string }) => {
        calls.push(`play ${path.basename(file)} ${o.start}-${o.end} v${o.volume} in${o.fadeIn} ${o.category}`);
        return { stop: async (so?: { fadeOut?: number }) => void calls.push(`stop ${path.basename(file)} ${so?.fadeOut ?? 0}`) };
      },
      event: async (name: string) => {
        calls.push(`event ${name}`);
        return { stop: async () => void calls.push(`event-stop ${name}`) };
      },
    },
  };
}
const world = { resetWeather: async () => undefined, unload: async () => 0, remove: async () => true };
const sounds: CueSheet = {
  cues: 1,
  scene: "Alley",
  length: 0.3,
  anchor: { mode: "player", distance: 3 } as CueSheet["anchor"],
  cast: [],
  timeline: [],
  sounds: [
    { t: 0, end: 0.1, file: "audio/line.wav", in: 0.5, volume: 0.5, fadeIn: 0.02, fadeOut: 0.04, category: "dialogue" },
    { t: 0.05, end: 0.15, event: "ui_menu_onpress" },
    { t: 0.2, end: 0.3, file: "audio/gone.wav", in: 0, volume: 1, fadeIn: 0, fadeOut: 0, category: "sfx" },
  ],
};

test("the player plays each sound at its cue and stops it at the clip's end; a missing file is said", async () => {
  const { calls, audio } = fakeAudio();
  const fetched: string[] = [];
  const player = new Player({ world, audio, soundFile: async (from: string) => (fetched.push(from), `data\\${path.basename(from)}`), player: async () => null, leadMs: 5 });
  const st = await player.play({ id: "p1", sheet: sounds, sounds: { "audio/line.wav": "C:\\scene\\audio\\line.wav" } });
  // A scene with sounds alone needs no V and nobody: it plays.
  assert.equal(st.state, "playing");
  assert.deepEqual(fetched, ["C:\\scene\\audio\\line.wav"]);
  assert.ok(st.notes!.some((n) => /"audio\/gone.wav" is left out: it is not in the scene's folder/.test(n)));
  await until(() => player.state().state === "ended");
  await until(() => calls.includes("event-stop ui_menu_onpress"));
  // The file from 0.5 s in, to 0.6 s of itself; its fade out starts 40 ms before its end.
  assert.deepEqual(calls, ["play line.wav 0.5-0.6 v0.5 in20 dialogue", "event ui_menu_onpress", "stop line.wav 40", "event-stop ui_menu_onpress"]);
  await player.stop();
});

test("a play from a moment starts a sound part way in; Pause and Stop silence it, Resume starts it again", async () => {
  const { calls, audio } = fakeAudio();
  const long: CueSheet = { ...sounds, length: 30, sounds: [{ t: 0, end: 20, file: "audio/line.wav", in: 1, volume: 1, fadeIn: 2, fadeOut: 0, category: "sfx" }] };
  let clock = 1000;
  const player = new Player({ world, audio, soundFile: async (from: string) => from, player: async () => null, leadMs: 0, now: () => clock });
  await player.play({ id: "p2", sheet: long, sounds: { "audio/line.wav": "line.wav" }, from: 5 });
  await until(() => calls.length === 1);
  // 5 s into the clip is 6 s into the file, and the fade in is over.
  assert.deepEqual(calls, ["play line.wav 6-21 v1 in0 sfx"]);
  clock += 1000;
  assert.equal(await player.pause(), true);
  await until(() => calls.length === 2);
  assert.equal(calls[1], "stop line.wav 100");
  assert.equal(player.resume(), true);
  await until(() => calls.length === 3);
  assert.equal(calls[2], "play line.wav 7-21 v1 in0 sfx");
  // Going to another moment: the sound that plays is stopped, and started from there.
  assert.equal(await player.seek(1), true);
  await until(() => calls.length === 5);
  assert.deepEqual(calls.slice(3), ["stop line.wav 50", "play line.wav 2-21 v1 in1000 sfx"]);
  await player.stop();
  assert.equal(calls[5], "stop line.wav 300");
});

test("a sound that cannot be played is said in the play's notes, and the play goes on", async () => {
  const player = new Player({
    world,
    audio: { play: async () => Promise.reject(new Error("no such codec")), event: async () => Promise.reject(new Error("the game is paused")) },
    soundFile: async (from: string) => from,
    player: async () => null,
    leadMs: 0,
  });
  await player.play({ id: "p3", sheet: { ...sounds, sounds: sounds.sounds!.slice(0, 2) }, sounds: { "audio/line.wav": "line.wav" } });
  await until(() => player.state().state === "ended");
  const notes = player.state().notes!.join(" ");
  assert.match(notes, /"audio\/line.wav" was not played: no such codec/);
  assert.match(notes, /"ui_menu_onpress" was not played: the game is paused/);
  // An older Director's mod, with no sound at all, says so once for each file.
  const bare = new Player({ world, player: async () => null, leadMs: 0 });
  const st = await bare.play({ id: "p4", sheet: sounds, sounds: { "audio/line.wav": "line.wav" } });
  assert.ok(st.notes!.some((n) => /"audio\/line.wav" is left out: this EDGE Director has no sound/.test(n)));
  await bare.stop();
});
