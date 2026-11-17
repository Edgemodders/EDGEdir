// D5a: sets (src/set.ts, src/setFiles.ts): reading an EDGEbuilder scene, a scene made on one, the
// link's refresh, and finding set files. Made-up names and places; nothing is read from the game.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { addTrack, EditError, formatDoc, markOf, newDoc, parseDoc, setActor, setMark } from "../src/doc";
import { cuesOf } from "../src/cues";
import { addSetPeople, chooseSet, freshPeople, fromOf, linkTo, markIn, originOf, parseSet, removeSet, setOf, stageOf, syncSet, yawOf } from "../src/set";
import { fileOf, findSets, hashOf, readSet } from "../src/setFiles";

const W = "base\\made_up\\woman.rig";
const half = Math.SQRT1_2;
const object = (id: string, kind: string, position: number[], more: object = {}) => ({ id, kind, transform: { position, rotation: [0, 0, 0, 1], scale: [1, 1, 1] }, ...more });
const alley = (people = [object("ana_spot", "npc", [-1200, 1500, 20], { record: "Character.Ana", appearance: "street" }), object("bo_spot", "npc", [-1198, 1502, 20.5], { record: "Character.Bo", transform: { position: [-1198, 1502, 20.5], rotation: [0, 0, half, half] } })]) =>
  JSON.stringify({
    format: 2,
    name: "My Alley",
    objects: [
      object("crate", "mesh", [-1199, 1503, 20], { resource: "base\\made_up\\crate.mesh", bounds: { min: [-0.5, -1, 0], max: [0.5, 1, 1.2] }, transform: { position: [-1199, 1503, 20], rotation: [0, 0, 0, 1], scale: [2, 1, 1] } }),
      object("lamp", "light", [-1199, 1500, 23]),
      ...people,
    ],
  });

test("an EDGEbuilder scene reads as people and props; the origin is the middle of its people", () => {
  const info = parseSet(alley());
  assert.equal(info.name, "My Alley");
  assert.deepEqual(info.people.map((p) => [p.id, p.record, p.appearance, p.yaw]), [["ana_spot", "Character.Ana", "street", 0], ["bo_spot", "Character.Bo", undefined, 90]]);
  assert.deepEqual(info.props.map((p) => [p.id, p.kind, p.size]), [["crate", "mesh", [2, 2, 1.2]], ["lamp", "light", undefined]]);
  assert.deepEqual(originOf(info), [-1199, 1501, 20]);
  assert.deepEqual(markIn(info, info.people[1]), { x: 1, y: 1, yaw: 90 });
  // A turn about the up axis, whichever way the rotation is written.
  assert.equal(yawOf([0, 0, 1, 0]), 180);
  assert.equal(yawOf([0, 0, -half, half]), 270);
  assert.equal(yawOf("no"), 0);
  assert.throws(() => parseSet("{}"), /Not an EDGEbuilder scene/);
  assert.throws(() => parseSet("{"), /Not valid JSON/);
  // A format 1 scene with no people: the origin is the middle of what there is.
  assert.deepEqual(originOf(parseSet(JSON.stringify({ format: 1, name: "Crates", objects: [object("a", "mesh", [10, 0, 1]), object("b", "mesh", [20, 4, 3])] }))), [15, 2, 1]);
});

test("a scene on a set has a track for each person, placed by the set", () => {
  const info = parseSet(alley());
  const link = linkTo("library", "Alleys/my_alley.scene.json", info, "sha256:1");
  const made = addSetPeople(chooseSet(newDoc("Talk"), link), info, { ana_spot: { record: "Character.Ana", name: "Ana Example", entity: "a.ent", rig: W, appearance: "street" } });
  const doc = parseDoc(formatDoc(made.doc));
  assert.equal(made.added, 2);
  assert.deepEqual(doc.anchor, { mode: "set" });
  assert.deepEqual(setOf(doc), { where: "library", path: "Alleys/my_alley.scene.json", name: "My Alley", hash: "sha256:1", origin: [-1199, 1501, 20] });
  // The game's facts where they were read; the record alone where they were not.
  assert.deepEqual(doc.tracks.map((t) => [t.id, t.name, fromOf(t), t.actor?.record, t.actor?.rig]), [["t1", "Ana Example", "ana_spot", "Character.Ana", W], ["t2", "Bo", "bo_spot", "Character.Bo", undefined]]);
  assert.deepEqual(markOf(doc, "t1"), { x: -1, y: -1, yaw: 0 });
  assert.deepEqual(markOf(doc, "t2"), { x: 1, y: 1, yaw: 90 });
  // A person of the set is moved in EDGEbuilder, not here.
  assert.throws(() => setMark(doc, "t1", { x: 3 }), (e: Error) => e instanceof EditError && /placed by the set/.test(e.message));
  // An actor of the scene's own stands where it is put, and nothing is added twice.
  const own = setActor(addTrack(doc, "actor"), "t3", { record: "Character.Cy", name: "Cy", rig: W });
  assert.deepEqual(markOf(setMark(own, "t3", { x: 3 }), "t3").x, 3);
  assert.equal(addSetPeople(own, info).added, 0);
  // The cue sheet plays where the set is.
  assert.equal(cuesOf(doc).sheet.anchor.mode, "set");
  assert.throws(() => addSetPeople(newDoc("S"), info), /no set/);
});

test("the scene follows its set: a moved person, one gone, one new", () => {
  const info = parseSet(alley());
  let doc = addSetPeople(chooseSet(newDoc("Talk"), linkTo("library", "a.scene.json", info, "sha256:1")), info).doc;
  // Nothing changed: the same document, so the scene is not unsaved.
  assert.equal(syncSet(doc, info, "sha256:1").doc, doc);
  // Bo moved and turned; Ana is gone; Cy is new.
  const now = parseSet(alley([object("bo_spot", "npc", [-1190, 1500, 20], { record: "Character.Bo" }), object("cy_spot", "npc", [-1192, 1500, 20], { record: "Character.Cy" })]));
  const r = syncSet(doc, now, "sha256:2");
  doc = r.doc;
  assert.equal(r.moved, 1);
  // The origin stays where it was when the set was chosen: only who moved has a new mark.
  assert.deepEqual([setOf(doc)?.hash, setOf(doc)?.origin], ["sha256:2", [-1199, 1501, 20]]);
  assert.deepEqual(markOf(doc, "t2"), { x: 9, y: -1, yaw: 0 });
  // A new person and nobody moved: nothing moves.
  const more = parseSet(alley([object("ana_spot", "npc", [-1200, 1500, 20], { record: "Character.Ana" }), object("bo_spot", "npc", [-1190, 1500, 20], { record: "Character.Bo" }), object("cy_spot", "npc", [-1192, 1500, 20], { record: "Character.Cy" })]));
  assert.equal(syncSet(doc, more, "sha256:3").moved, 0);
  // Ana's track keeps its place and says so; Cy is offered.
  assert.deepEqual(markOf(doc, "t1"), { x: -1, y: -1, yaw: 0 });
  const stage = stageOf(doc, now)!;
  assert.deepEqual([stage.state, stage.people, stage.gone, stage.fresh], ["linked", 2, ["t1"], 1]);
  assert.deepEqual(freshPeople(doc, now).map((p) => p.id), ["cy_spot"]);
  doc = addSetPeople(doc, now).doc;
  assert.deepEqual([doc.tracks[2].name, fromOf(doc.tracks[2]), stageOf(doc, now)!.fresh], ["Cy", "cy_spot", 0]);
  assert.deepEqual(markOf(doc, "t3"), { x: 7, y: -1, yaw: 0 });
  // The same set chosen again (its file renamed): the tracks of people it still has stay linked, and the origin stays.
  const again = chooseSet(doc, linkTo("library", "lane.scene.json", now, "sha256:2"), now);
  assert.deepEqual([setOf(again)?.path, setOf(again)?.origin, again.tracks.map(fromOf)], ["lane.scene.json", [-1199, 1501, 20], [undefined, "bo_spot", "cy_spot"]]);
  assert.equal(freshPeople(again, now).length, 0);
  // Another set: the tracks are the scene's own.
  const other = parseSet(JSON.stringify({ format: 2, name: "Yard", objects: [object("bo_spot", "npc", [0, 0, 0], { record: "Character.Bo" })] }));
  assert.deepEqual(chooseSet(doc, linkTo("library", "yard.scene.json", other, "sha256:9"), other).tracks.map(fromOf), [undefined, undefined, undefined]);
  // The props, from the scene's origin, for the preview's boxes: only those with a size.
  assert.deepEqual(stage.props, [{ id: "crate", x: 0, y: 2, z: 0, yaw: 0, size: [2, 2, 1.2], centre: [0, 0, 0.6] }]);
  // A set that is not there: the scene keeps what it has.
  assert.deepEqual(stageOf(doc, undefined, "Gone"), { name: "My Alley", state: "missing", why: "Gone", people: 0, vehicles: 0, gone: [], fresh: 0, props: [] });
  assert.equal(stageOf(newDoc("S"), now), undefined);
  // Without the set the scene plays in front of V, and its marks are its own.
  const free = removeSet(doc);
  assert.deepEqual([free.anchor.mode, free.set, fromOf(free.tracks[0])], ["player", null, undefined]);
  assert.equal(markOf(setMark(free, "t1", { x: 5 }), "t1").x, 5);
});

test("sets are found in the Library and the open project, as EDGEbuilder walks them", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "edgedir-sets-"));
  const put = (file: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  };
  try {
    put("lib/Alleys/my_alley.scene.json", alley());
    put("lib/broken.scene.json", "{");
    // Not looked into: a bake, an asset item, a dot folder, node_modules.
    put("lib/Old.bake/my_alley.scene.json", alley());
    put("lib/drum.prop.asset/x.scene.json", alley());
    put("lib/.trash/x.scene.json", alley());
    put("lib/node_modules/x.scene.json", alley());
    put("proj/source/scenes/yard.scene.json", JSON.stringify({ format: 1, name: "Yard", objects: [] }));
    put("proj/source/raw/other.scene.json", alley());
    const sets = findSets(path.join(root, "lib"), path.join(root, "proj"));
    assert.deepEqual(sets.map((s) => [s.where, s.path, s.name, s.people, !!s.error]), [
      ["library", "broken.scene.json", "broken", 0, true],
      ["library", "Alleys/my_alley.scene.json", "My Alley", 2, false],
      ["project", "source/scenes/yard.scene.json", "Yard", 0, false],
    ]);
    assert.deepEqual(findSets(undefined, undefined), []);
    // A link is read from its root, and says why when it cannot be.
    const read = readSet({ where: "library", path: "Alleys/my_alley.scene.json" }, path.join(root, "lib"), undefined);
    assert.ok("info" in read && read.info.people.length === 2 && read.hash === hashOf(alley()));
    const why = (r: ReturnType<typeof readSet>) => ("why" in r ? r.why : "");
    assert.match(why(readSet({ where: "library", path: "gone.scene.json" }, path.join(root, "lib"), undefined)), /not there any more/);
    assert.match(why(readSet({ where: "project", path: "source/scenes/yard.scene.json" }, path.join(root, "lib"), undefined)), /project that is not open/);
    assert.match(why(readSet({ where: "library", path: "broken.scene.json" }, path.join(root, "lib"), undefined)), /cannot be read/);
    // A link never leads out of its root.
    assert.equal(fileOf({ where: "library", path: "../proj/source/scenes/yard.scene.json" }, path.join(root, "lib"), undefined), undefined);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
