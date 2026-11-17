// D2.7 and D2.8: made animations in the Library and a project (src/core/made.ts), in temporary
// folders in EDGEfab's agreed shape, and the extension API's search (src/api.ts) over a made-up index.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { makeApi } from "../src/api";
import { AnimIndex } from "../src/core/animIndex";
import { findMade, libraryAnims, libraryRoot, projectAnims } from "../src/core/made";

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), "edgedir-made-"));
const write = (file: string, data: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof data === "string" ? data : JSON.stringify(data));
};
const W = "base\\made_up\\woman.rig";
const facts = (name: string, seconds: number, more: object = {}) => ({ rig: W, seconds, fps: 30, rootMotion: false, loop: false, name, ...more });

/** A Library with two animations, a prop, and a broken item. */
function library(): string {
  const root = temp();
  const item = (folder: string, name: string, asset: object, glb = true) => {
    const dir = path.join(root, folder, `${name}.anim.asset`);
    write(path.join(dir, "asset.json"), { format: 1, name, kind: "anim", main: `source/raw/me/anims/${name}/${name}.glb`, version: 1, ...asset });
    if (glb) write(path.join(dir, "source", "raw", "me", "anims", name, `${name}.glb`), "glb");
    return dir;
  };
  item("Dances", "Spin", { id: "aaaa", anim: facts("spin_01", 2.5, { loop: true }) });
  item("Dances/Slow", "Bow", { id: "bbbb", anim: facts("bow", 1.2, { rootMotion: true }) }, false);
  item("Dances", "No length", { id: "cccc", anim: { rig: W, name: "x" } });
  item("Dances", "No id", { anim: facts("y", 1) });
  write(path.join(root, "Props", "Chair.prop.asset", "asset.json"), { format: 1, id: "dddd", name: "Chair", kind: "prop", main: "x.mesh", version: 1 });
  // An animation folder inside another item is that item's own business.
  write(path.join(root, "Props", "Chair.prop.asset", "Inner.anim.asset", "asset.json"), { id: "eeee", name: "Inner", kind: "anim", anim: facts("inner", 1) });
  return root;
}

test("the Library's animations are found wherever the modder keeps them", () => {
  const root = library();
  const found = libraryAnims(root);
  assert.deepEqual(found.map((a) => [a.title, a.id, a.name, a.seconds, a.loop, a.rootMotion, a.source]), [
    ["Bow", "bbbb", "bow", 1.2, false, true, "library"],
    ["Spin", "aaaa", "spin_01", 2.5, true, false, "library"],
  ]);
  assert.equal(found[1].file, path.join(root, "Dances", "Spin.anim.asset", "source", "raw", "me", "anims", "Spin", "Spin.glb"));
  // The item is listed even when its clip's file is gone; the view says so.
  assert.equal(found[0].file, "");
  assert.deepEqual(libraryAnims(undefined), []);
  assert.deepEqual(libraryAnims(path.join(root, "nowhere")), []);

  const config = path.join(temp(), "library.json");
  assert.equal(libraryRoot(config), undefined);
  write(config, { root });
  assert.equal(libraryRoot(config), root);
  write(config, { root: path.join(root, "gone") });
  assert.equal(libraryRoot(config), undefined);
});

test("a project's animations are found by their records, and win over the Library's by id", () => {
  const dir = temp();
  const at = (name: string) => path.join(dir, "source", "raw", "mymod", "anims", name, name);
  write(`${at("Spin")}.edgefab.json`, { kind: "anim", id: "aaaa", anim: facts("spin_01", 3) });
  write(`${at("Spin")}.glb`, "glb");
  write(`${at("Wave")}.edgefab.json`, { kind: "anim", id: "ffff", name: "Big wave", anim: facts("wave", 1) });
  // A prop's record, and a file that is not JSON, are passed over.
  write(path.join(dir, "source", "raw", "mymod", "props", "chair", "chair.edgefab.json"), { kind: "prop", id: "dddd" });
  write(path.join(dir, "source", "raw", "mymod", "anims", "bad", "bad.edgefab.json"), "{");
  const project = projectAnims(dir);
  assert.deepEqual(project.map((a) => [a.title, a.id, a.seconds, !!a.file, a.source]), [
    ["Big wave", "ffff", 1, false, "project"],
    ["Spin", "aaaa", 3, true, "project"],
  ]);
  assert.deepEqual(projectAnims(undefined), []);
  assert.deepEqual(projectAnims(temp()), []);

  const lib = libraryAnims(library());
  // The project's copy is the one that will be packed, and may have been changed.
  assert.equal(findMade("aaaa", project, lib)?.seconds, 3);
  assert.equal(findMade("bbbb", project, lib)?.source, "library");
  assert.equal(findMade("zzzz", project, lib), undefined);
});

test("the API's search covers the game, the project and the Library, and says how far the index is", async () => {
  const index = new AnimIndex(temp());
  const M = "base\\made_up\\man.rig";
  const clip = (name: string, duration: number) => ({ name, duration, frames: 31, fps: 30, type: "Normal", rootMotion: null });
  const sets = [
    { path: "a\\sit.anims", rig: W, clips: [clip("sit_loop", 4), clip("sit_spin", 2)] },
    { path: "a\\walk.anims", rig: M, clips: [clip("walk", 1)] },
  ];
  await index.build({ request: async <T>() => ({ total: sets.length, offset: 0, items: sets }) as T }, "1-1");
  const lib = libraryAnims(library());
  const game = {
    state: "ready",
    index,
    sets: { game: "1-1", sets: sets.map((s) => s.path) },
    readingClips: false,
    refresh: async () => {},
    onDidChange: () => ({ dispose() {} }),
    made: () => ({ project: [{ ...lib[1], source: "project" as const, seconds: 3 }], library: lib }),
    entity: async (p: string) => {
      const own =
        p === "ana.ent"
          ? [{ path: "A\\SIT.anims", use: "gameplay" as const, priority: 0 }]
          : p === "both.ent"
            ? [{ path: "a\\walk.anims", use: "gameplay" as const, priority: 0 }, { path: "a\\sit.anims", use: "cinematics" as const, priority: 0 }]
            : [];
      return { rig: W, appearances: [], sets: own, components: [{ name: "root", rig: W, sets: own }] };
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api = makeApi("9.9.9", game as any);
  assert.deepEqual([api.apiVersion, api.version], [1, "9.9.9"]);
  assert.deepEqual(api.indexState(), { level: "clips", game: "1-1", sets: 2, clips: 3, building: false });

  const names = async (q: Parameters<typeof api.searchAnimations>[0]) => (await api.searchAnimations(q)).items.map((i) => `${i.source}:${i.name}`);
  // Made animations first, the project's copy in place of the Library's; then the game's.
  assert.deepEqual(await names({ text: "spin" }), ["project:spin_01", "game:sit_spin"]);
  assert.deepEqual(await names({ text: "spin", source: ["library"] }), ["library:spin_01"]);
  assert.deepEqual(await names({ rig: M }), ["game:walk"]);
  assert.deepEqual(await names({ source: ["game"], rig: W }), ["game:sit_loop", "game:sit_spin"]);
  // An entity's own files hold game animations only.
  assert.deepEqual(await names({ entity: { path: "ana.ent" } }), ["game:sit_loop", "game:sit_spin"]);
  const cut = await api.searchAnimations({ limit: 2 });
  assert.deepEqual([cut.total, cut.items.length], [5, 2]);
  const made = (await api.searchAnimations({ text: "spin", source: ["project"] })).items[0];
  assert.deepEqual([made.id, made.seconds, made.frames, !!made.file], ["aaaa", 3, 91, true]);
  const own = [{ path: "A\\SIT.anims", use: "gameplay", priority: 0 }];
  assert.deepEqual(await api.entityAnimSets("ana.ent"), { rig: W, sets: own, components: [{ name: "root", rig: W, sets: own }] });
  // An entity's animations come in the entity's order of files, not by path.
  assert.deepEqual(await names({ entity: { path: "both.ent" } }), ["game:walk", "game:sit_loop", "game:sit_spin"]);
  // The game's animations do not say whether they loop.
  assert.equal("loop" in (await api.searchAnimations({ source: ["game"] })).items[0], false);

  // Before the game is read: nothing of the game, the made animations still.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cold = makeApi("9.9.9", { ...game, state: "noBridge" } as any);
  assert.deepEqual(cold.indexState(), { level: "none", game: undefined, sets: 0, clips: 0, building: false });
  assert.deepEqual((await cold.searchAnimations({ text: "spin" })).items.map((i) => i.source), ["project"]);
});
