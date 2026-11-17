// Fills the page harness with real bodies and animations from the game on this PC, for looking at
// the 3D preview in a plain browser (D3). It exports two actors and a few clips through REDbridge
// into dist/preview-sample (dist is never committed) and writes a scene and a list of the files
// that tools/page-harness.mjs picks up. Run it, then the harness:
//   npx esbuild tools/preview-sample.ts --bundle --platform=node --outfile=dist/preview-sample.cjs
//   node dist/preview-sample.cjs "<REDbridge.exe>" ["<game folder>"]
//   node tools/page-harness.mjs
// It also times the exports, which is D3.1's check against the real game.
import * as fs from "node:fs";
import * as path from "node:path";
import { gameKey } from "../src/core/animSets";
import { BridgeClient } from "../src/core/bridgeClient";
import { Players } from "../src/core/cast";
import { resolveGame } from "../src/core/config";
import { readEntity, sameRig } from "../src/core/entity";
import { PreviewStore } from "../src/core/preview";
import { addAnimClip, addTrack, addTransition, newDoc, setActor, setMark, setTransition, type ClipAnim, type SceneDoc } from "../src/doc";
import { bodyKey, bodyWant, clipKey, clipWant } from "../src/pose";

const [exe, gameArg] = process.argv.slice(2);
if (!exe) throw new Error("Give the path of REDbridge.exe");
const out = path.resolve("dist", "preview-sample");
const secs = (t: number) => `${((Date.now() - t) / 1000).toFixed(1)} s`;

interface Info {
  items: { path: string; rig: string; clips: { name: string; duration: number; type: string }[] | null }[];
}

(async () => {
  const game = gameArg ? { path: gameArg } : await resolveGame(() => undefined);
  if (!game) throw new Error("No game folder was found: give it as the second argument");
  const b = new BridgeClient({ exe, gamePath: game.path });
  b.start();
  const info = await b.info();
  if (!info.gameLoaded) await b.load(game.path);
  const key = gameKey(await b.info());
  const store = new PreviewStore(out);
  const files: Record<string, { url?: string; notes?: string[]; error?: string }> = {};
  const url = (file: string) => path.relative(path.resolve("dist"), file).replace(/\\/g, "/");

  // One of the game's main characters, as an example, and V.
  const ent = "base\\quest\\secondary_characters\\judy.ent";
  const facts = readEntity((await b.toJson(ent)).json ?? "");
  let doc: SceneDoc = addTrack(addTrack(newDoc("Preview sample"), "actor"), "actor");
  const [t1, t2] = doc.tracks.map((t) => t.id);
  doc = setActor(doc, t1, { record: "Character.Judy", name: "Judy Álvarez", entity: ent, rig: facts.rig, appearance: facts.appearances[0] });
  doc = setActor(doc, t2, { player: "wa", name: "V", entity: Players.wa.entity, rig: facts.rig });
  doc = setMark(setMark(doc, t1, { x: -0.6, y: 0, yaw: 20 }), t2, { x: 0.6, y: 0, yaw: 340 });

  for (const track of doc.tracks) {
    const want = bodyWant(track.actor)!;
    const t = Date.now();
    try {
      const f = await store.body(b, key, want, async () => facts.appearances[0]);
      files[bodyKey(want)] = { url: url(f.file), notes: f.notes };
      console.log(`${track.name}: ${f.cached ? "found" : `exported in ${secs(t)}`}, ${(fs.statSync(f.file).size / 1048576).toFixed(1)} MB; ${f.notes.join("; ")}`);
    } catch (e) {
      files[bodyKey(want)] = { error: (e as Error).message };
      console.log(`${track.name}: FAILED ${(e as Error).message}`);
    }
  }

  // A few clips from the character's own files that are made for the body's rig.
  const picked: ClipAnim[] = [];
  for (const s of facts.sets) {
    const i = ((await b.request("anims.info", { files: [s.path] })) as Info).items[0];
    if (!i?.clips || !sameRig(i.rig, facts.rig)) continue;
    for (const c of i.clips.filter((c) => c.type === "Normal" && c.duration > 1.5 && c.duration < 8).slice(0, 2)) picked.push({ set: s.path, name: c.name, rig: i.rig, seconds: c.duration });
    if (picked.length >= 4) break;
  }
  let at1 = 0;
  let at2 = 0.5;
  for (const [n, anim] of picked.entries()) {
    const want = clipWant(anim)!;
    const t = Date.now();
    try {
      const f = await store.clip(b, key, want);
      files[clipKey(want)] = { url: url(f.file) };
      console.log(`clip ${anim.name}: ${f.cached ? "found" : `exported in ${secs(t)}`}, ${(fs.statSync(f.file).size / 1048576).toFixed(2)} MB`);
    } catch (e) {
      files[clipKey(want)] = { error: (e as Error).message };
      console.log(`clip ${anim.name}: FAILED ${(e as Error).message}`);
    }
    // The first two on the first actor, the rest on V, with a gap before V's second.
    if (n < 2) {
      doc = addAnimClip(doc, t1, anim, at1).doc;
      at1 += anim.seconds;
    } else {
      doc = addAnimClip(doc, t2, anim, at2).doc;
      at2 += anim.seconds + 1.5;
    }
  }
  // A Blend where the first actor's second clip starts, and an Inertial one at V's second clip (D4).
  if (picked.length >= 2) doc = addTransition(doc, t1, picked[0].seconds).doc;
  if (picked.length >= 4) {
    const made = addTransition(doc, t2, 0.5 + picked[2].seconds + 1.5);
    doc = setTransition(made.doc, made.id, { method: "inertial" });
  }
  fs.writeFileSync(path.join(out, "sample.json"), JSON.stringify({ doc, files }));
  console.log(`dist/preview-sample/sample.json written: ${Object.keys(files).length} files`);
  b.stop();
})().catch((e) => {
  console.error("FAILED", e);
  process.exit(1);
});
