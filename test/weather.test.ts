// D6a: the weather track. The document's rules and the cues (src/weather.ts, src/cues.ts), and the
// player's part (director/play.mjs) against a stand-in world. Preset names here are the game's
// record paths, quoted as examples; nothing is read from the game.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import { Player, weatherAt as cueAt } from "../director/play.mjs";
import { cuesOf, playable, type CueSheet } from "../src/cues";
import { addClip, addTrack, EditError, formatDoc, newDoc, parseDoc, type SceneDoc } from "../src/doc";
import { setWeather, weatherAt, weatherCues, weatherLabel, weatherOf, weatherTint } from "../src/weather";

/** A scene with a weather track and two clips: 0 to 4 s and 4 to 6 s, and a third from 8 to 10 s. */
function scene() {
  let doc: SceneDoc = addTrack(newDoc("Storm"), "weather");
  const lane = doc.tracks[0].id;
  const ids: string[] = [];
  for (const [start, length] of [[0, 4], [4, 2], [8, 2]]) {
    const r = addClip(doc, lane, { start, length });
    doc = r.doc;
    ids.push(r.id);
  }
  return { doc, lane, ids };
}

test("a weather clip holds a state and a blend; a scene has one weather track", () => {
  let { doc, lane, ids } = scene();
  assert.throws(() => addTrack(doc, "weather"), /one weather track/);
  assert.equal(weatherOf(doc.tracks[0].clips[0]), undefined);
  doc = setWeather(doc, ids[0], { state: "WeatherPresets.Rain" });
  assert.deepEqual(weatherOf(doc.tracks[0].clips[0]), { state: "WeatherPresets.Rain", blend: 5 });
  doc = setWeather(doc, ids[0], { blend: 2.5 });
  assert.deepEqual(weatherOf(doc.tracks[0].clips[0]), { state: "WeatherPresets.Rain", blend: 2.5 });
  assert.throws(() => setWeather(doc, ids[1], { blend: 3 }), /Choose a weather/);
  assert.throws(() => setWeather(doc, ids[0], { blend: 61 }), /0 to 60/);
  assert.throws(() => setWeather(doc, "nope", { state: "x" }), EditError);
  // Only a clip on the weather track.
  const other = addClip(addTrack(doc, "audio"), addTrack(doc, "audio").tracks[1].id, { start: 0, length: 1 });
  assert.throws(() => setWeather(other.doc, other.id, { state: "WeatherPresets.Rain" }), /Only a clip on the weather track/);
  assert.deepEqual([weatherLabel("WeatherPresets.Heavy_Clouds"), weatherLabel("24h_weather_toxic_rain"), weatherLabel("WeatherPresets.ToxicRain"), weatherLabel("q302_deep_blue")], ["Heavy clouds", "Toxic rain", "Toxic rain", "Q302 deep blue"]);
  assert.deepEqual([weatherTint("WeatherPresets.Rain"), weatherTint("WeatherPresets.Sunny"), weatherTint("WeatherPresets.Sandstorm"), weatherTint("something")], ["grey", "warm", "sand", undefined]);
  assert.deepEqual([weatherAt(doc, 1)?.state, weatherAt(doc, 4.5), weatherAt(doc, 7)], ["WeatherPresets.Rain", undefined, undefined]);
  assert.equal(lane, doc.tracks[0].id);
  assert.deepEqual(parseDoc(formatDoc(doc)), doc);
});

test("the weather cues: a state at each clip's start, and the weather given back where no clip follows", () => {
  let { doc, ids } = scene();
  doc = setWeather(doc, ids[0], { state: "WeatherPresets.Rain", blend: 5 });
  doc = setWeather(doc, ids[1], { state: "WeatherPresets.Fog", blend: 3 });
  doc = setWeather(doc, ids[2], { state: "WeatherPresets.Sunny", blend: 1 });
  const { cues, notes } = weatherCues(doc);
  // Rain runs into Fog with no gap: no giving back between them. After Fog and after Sunny, yes.
  assert.deepEqual(
    cues.map((c) => [c.t, c.state ?? "back", c.blend]),
    [[0, "WeatherPresets.Rain", 5], [4, "WeatherPresets.Fog", 3], [6, "back", undefined], [8, "WeatherPresets.Sunny", 1], [10, "back", undefined]],
  );
  // Rain's blend of 5 s is longer than its 4 s: said. Fog's blend is longer than its 2 s too.
  assert.equal(notes.filter((n) => /longer than the clip/.test(n.text)).length, 2);
  assert.equal(notes.filter((n) => /goes back to what it was/.test(n.text)).length, 2);

  // In the cue sheet, without the clips' ids; a scene with weather alone has something for the game.
  const { sheet, notes: all } = cuesOf(doc);
  assert.deepEqual(sheet.weather?.[0], { t: 0, state: "WeatherPresets.Rain", blend: 5 });
  assert.deepEqual([sheet.cast.length, playable(sheet), all.every((n) => n.kind === "weather")], [0, true, true]);
  assert.equal(playable(cuesOf(newDoc("Empty")).sheet), false);
  assert.equal(cuesOf(newDoc("Empty")).sheet.weather, undefined);
  // A clip with no weather is left out, and says so; a muted track plays no weather.
  const bare = scene().doc;
  assert.deepEqual([weatherCues(bare).cues, weatherCues(bare).notes.length], [[], 3]);
  const muted = { ...doc, tracks: doc.tracks.map((t) => ({ ...t, mute: true })) };
  assert.deepEqual(weatherCues(muted).cues, []);
});

test("the player sets the weather on time, gives it back at a clip's end and at Stop", async () => {
  const calls: string[] = [];
  const note = async <T>(text: string, answer: T): Promise<T> => (calls.push(text), answer);
  const world = {
    setWeather: (state: string, o: { blend: number }) => note(`set ${state} ${o.blend}`, { applied: true }),
    resetWeather: () => note("back", {}),
    remove: () => note("remove", true),
    unload: () => note("unload", 1),
  };
  const sheet: CueSheet = {
    cues: 1,
    scene: "Storm",
    length: 0.12,
    anchor: { mode: "player", distance: 3 } as CueSheet["anchor"],
    cast: [],
    timeline: [],
    weather: [
      { t: 0, state: "WeatherPresets.Rain", blend: 5 },
      { t: 0.04, state: "WeatherPresets.Fog", blend: 3 },
      { t: 0.08, reset: true },
    ],
  };
  assert.deepEqual([cueAt(sheet.weather, 0)?.state, cueAt(sheet.weather, 0.05)?.state, cueAt(sheet.weather, 0.09), cueAt(undefined, 1)], ["WeatherPresets.Rain", "WeatherPresets.Fog", undefined, undefined]);
  const until = async (what: () => boolean) => {
    const end = Date.now() + 2000;
    while (!what() && Date.now() < end) await new Promise((r) => setTimeout(r, 5));
    assert.ok(what(), "waited too long");
  };
  // V is not needed for a scene with nobody in it.
  const player = new Player({ world, player: async () => null, warmMs: 2, leadMs: 2 });
  const s = await player.play({ id: "a", sheet });
  assert.equal(s.state, "playing");
  await until(() => player.state().state === "ended");
  assert.deepEqual(calls, ["set WeatherPresets.Rain 5", "set WeatherPresets.Fog 3", "back"]);
  assert.equal(player.state().text, "The scene has ended");
  // Stop with nothing held gives nothing back.
  calls.length = 0;
  await player.stop();
  assert.deepEqual(calls, []);
  // From the middle: the state of that moment is set at once. Stop while it is held gives it back.
  await player.play({ id: "b", sheet: { ...sheet, length: 5, weather: [{ t: 0, state: "WeatherPresets.Rain", blend: 5 }, { t: 4, reset: true }] }, from: 1 });
  await until(() => calls.length > 0);
  assert.deepEqual(calls, ["set WeatherPresets.Rain 5"]);
  await player.stop();
  assert.deepEqual(calls, ["set WeatherPresets.Rain 5", "back"]);
  // A weather the game refuses is said in the play's notes, and the play goes on.
  const refusing = new Player({ world: { ...world, setWeather: async () => { throw new Error("no weather preset WeatherPresets.Nope"); } }, player: async () => null, warmMs: 2, leadMs: 2 });
  await refusing.play({ id: "c", sheet: { ...sheet, weather: [{ t: 0, state: "WeatherPresets.Nope", blend: 1 }] } });
  await until(() => (refusing.state().notes ?? []).length > 0);
  assert.match(refusing.state().notes![0], /"WeatherPresets.Nope" was not set: no weather preset/);
  await refusing.stop();
});
