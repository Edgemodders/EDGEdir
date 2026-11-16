// D2.2 to D2.4: the cast, an entity's facts and the animation sets (src/core), with made-up
// records and files. Nothing here is read from the game.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { AnimSets, folderOf, gameKey, setName } from "../src/core/animSets";
import { Cast, castEntry, castLabel, Players, searchCast } from "../src/core/cast";
import { readEntity, rigName, sameRig } from "../src/core/entity";
import type { TweakRecords } from "../src/core/types";
import { addTrack, EditError, formatDoc, newDoc, parseDoc, playerTrack, setActor, setTrack } from "../src/doc";

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), "edgedir-cast-"));
const record = (p: string | null, flats: Record<string, unknown>) => ({ id: "0x1", path: p, type: "gamedataCharacter_Record", flats }) as TweakRecords["items"][number];

test("a record becomes a cast entry only when it is a person who can be spawned", () => {
  const ent = "base\\made_up\\ana.ent";
  assert.deepEqual(castEntry(record("Character.Ana", { fullDisplayName: { key: "LocKey#1", text: "Ana Example" }, displayName: { key: "LocKey#2", text: "Ana" }, entityTemplatePath: ent, appearanceName: "None" })), {
    record: "Character.Ana",
    entity: ent,
    name: "Ana Example",
  });
  // The short name when there is no full one; an appearance the record names is kept.
  assert.deepEqual(castEntry(record("Character.Bo", { displayName: "Bo", entityTemplatePath: ent, appearanceName: "bo_coat" })), { record: "Character.Bo", entity: ent, name: "Bo", appearance: "bo_coat" });
  // A name the game did not resolve is no name.
  assert.equal(castEntry(record("Character.Cy", { displayName: { key: "LocKey#9", text: "LocKey#9" }, entityTemplatePath: ent }))?.name, undefined);
  assert.equal(castEntry(record("Character.Ana_inline0", { entityTemplatePath: ent })), undefined);
  assert.equal(castEntry(record("Character.NoBody", { entityTemplatePath: "" })), undefined);
  assert.equal(castEntry(record("Items.Thing", { entityTemplatePath: ent })), undefined);
  assert.equal(castEntry(record(null, { entityTemplatePath: ent })), undefined);
  // V is offered by Players, not as a record.
  assert.equal(castEntry(record("Character.Player_Puppet_Base", { entityTemplatePath: ent })), undefined);
  assert.equal(castLabel({ record: "Character.some_guard", entity: ent }), "some_guard");
});

test("the cast is read in pages, kept per game, and searched with V on top", async () => {
  const dir = temp();
  const all = [
    record("Character.zed", { entityTemplatePath: "z.ent" }),
    record("Character.Ana", { displayName: "Ana Example", entityTemplatePath: "a.ent" }),
    record("Character.Ana_inline1", { entityTemplatePath: "a.ent" }),
    record("Character.Bo", { displayName: "Bo", entityTemplatePath: "b.ent" }),
  ];
  const calls: number[] = [];
  const bridge = {
    tweakRecords: async (q: { offset?: number }) => {
      calls.push(q.offset ?? 0);
      return { total: all.length, offset: q.offset ?? 0, items: all.slice(q.offset ?? 0, (q.offset ?? 0) + 2) };
    },
  };
  const cast = new Cast(dir);
  assert.equal(cast.load("1-2"), false);
  await cast.build(bridge, "1-2");
  assert.deepEqual(calls, [0, 2]);
  // Named people first, by name; then the rest.
  assert.deepEqual(cast.entries.map((e) => e.record), ["Character.Ana", "Character.Bo", "Character.zed"]);
  const again = new Cast(dir);
  assert.equal(again.load("1-2"), true);
  assert.equal(again.load("9-9"), false);
  assert.equal(again.find("character.bo")?.entity, "b.ent");

  assert.deepEqual(searchCast(again.entries, "").slice(0, 3), [Players.wa, Players.ma, again.entries[0]]);
  assert.deepEqual(searchCast(again.entries, "ana ex").map((e) => e.record), ["Character.Ana"]);
  assert.deepEqual(searchCast(again.entries, "player").map((e) => e.player), ["wa", "ma"]);
});

// A made-up entity in the shape REDbridge's cr2w.toJson gives.
const path_ = (p: string) => ({ DepotPath: { $type: "ResourcePath", $storage: "string", $value: p }, Flags: "Default" });
const cname = (v: string) => ({ $type: "CName", $storage: "string", $value: v });
const animated = (name: string, rig: string, gameplay: string[] = [], cinematics: string[] = []) => ({
  $type: "entAnimatedComponent",
  name: cname(name),
  rig: path_(rig),
  animations: {
    $type: "animAnimSetup",
    gameplay: gameplay.map((s, i) => ({ $type: "animAnimSetupEntry", priority: i, animSet: path_(s) })),
    cinematics: cinematics.map((s) => ({ $type: "animAnimSetupEntry", priority: 0, animSet: path_(s) })),
  },
});
const entity = (chunks: unknown[]) =>
  JSON.stringify({
    Header: {},
    Data: {
      RootChunk: {
        $type: "entEntityTemplate",
        appearances: [{ name: cname("ana_default") }, { name: cname("ana_coat") }],
        compiledData: { Data: { Chunks: chunks } },
      },
    },
  });

test("an entity gives the body's rig, its appearances and the sets it carries", () => {
  const body = "base\\made_up\\woman\\woman.rig";
  const facts = readEntity(
    entity([
      { $type: "entMeshComponent", name: cname("mesh") },
      animated("deformations", "base\\made_up\\woman\\deformations_rigs\\woman_deformations.rig"),
      animated("root", body, ["a\\one.anims", "a\\two.anims", "a\\one.anims"], ["a\\scene.anims"]),
    ]),
  );
  assert.equal(facts.rig, body);
  assert.deepEqual(facts.appearances, ["ana_default", "ana_coat"]);
  assert.deepEqual(facts.sets, [
    { path: "a\\one.anims", use: "gameplay", priority: 0 },
    { path: "a\\two.anims", use: "gameplay", priority: 1 },
    { path: "a\\scene.anims", use: "cinematics", priority: 0 },
  ]);
  // No component called root: the first that is not a deformations rig.
  assert.equal(readEntity(entity([animated("deformations", "x\\deformations_rigs\\d.rig"), animated("body", body)])).rig, body);
  // Nothing animated: no rig, and no error.
  assert.deepEqual(readEntity(entity([])), { rig: "", appearances: ["ana_default", "ana_coat"], sets: [] });
  assert.throws(() => readEntity("{"), /cannot be read/);
  assert.throws(() => readEntity('{"Data":{"RootChunk":{"$type":"CMesh"}}}'), /not an entity/);

  assert.equal(sameRig("Base\\A\\b.rig", "base/a/B.rig"), true);
  assert.equal(sameRig("a.rig", "b.rig"), false);
  assert.equal(sameRig(undefined, undefined), false);
  assert.equal(rigName(body), "woman");
});

test("the animation sets are every .anims file, paged, kept per game, and shown by folder", async () => {
  const dir = temp();
  const names = ["base\\animations\\npc\\sit.anims", "base\\characters\\a.mesh", "base\\animations\\npc\\walk\\slow.anims", "ep1\\animations\\dance.ANIMS", "base\\animations\\readme.txt", "base\\animations\\idle.anims"];
  const offsets: number[] = [];
  const bridge = {
    list: async (q: { offset?: number; limit?: number }) => {
      offsets.push(q.offset ?? 0);
      const items = names.slice(q.offset ?? 0, (q.offset ?? 0) + 4).map((name) => ({ hash: "0", name, size: 1, archive: "x" }));
      return { total: names.length, items };
    },
  };
  const sets = new AnimSets(dir);
  await sets.build(bridge, "3-6");
  assert.deepEqual(offsets, [0, 4]);
  assert.deepEqual(sets.sets, ["base\\animations\\idle.anims", "base\\animations\\npc\\sit.anims", "base\\animations\\npc\\walk\\slow.anims", "ep1\\animations\\dance.ANIMS"]);
  assert.equal(new AnimSets(dir).load("3-6"), true);
  assert.equal(new AnimSets(dir).load("0-0"), false);

  assert.deepEqual(sets.folder(), { folders: [{ name: "base", path: "base", sets: 3 }, { name: "ep1", path: "ep1", sets: 1 }], sets: [] });
  assert.deepEqual(sets.folder("base\\animations"), { folders: [{ name: "npc", path: "base\\animations\\npc", sets: 2 }], sets: ["base\\animations\\idle.anims"] });
  assert.deepEqual(folderOf(sets.sets, "base\\animations\\npc\\walk").sets, ["base\\animations\\npc\\walk\\slow.anims"]);
  assert.deepEqual(sets.search("npc slow"), { total: 1, sets: ["base\\animations\\npc\\walk\\slow.anims"] });
  assert.deepEqual(sets.search("  "), { total: 0, sets: [] });
  assert.equal(setName("base\\animations\\npc\\sit.anims"), "sit");
  assert.equal(gameKey({ archives: 3, files: 6 }), "3-6");
});

test("an actor track takes an actor, keeps its clips, and a scene has one V", () => {
  let doc = addTrack(addTrack(addTrack(newDoc("S"), "actor"), "actor"), "audio");
  const [t1, t2, t3] = doc.tracks.map((t) => t.id);
  const ana = { record: "Character.Ana", name: "Ana Example", entity: "a.ent", rig: "w.rig", appearance: "ana_coat" };
  doc = setActor(doc, t1, ana);
  // A track still called by its kind takes the actor's name.
  assert.equal(doc.tracks[0].name, "Ana Example");
  assert.deepEqual(doc.tracks[0].actor, ana);
  // Swapped: the name follows, since it was the actor's.
  doc = setActor(doc, t1, { record: "Character.Bo", name: "Bo" });
  assert.equal(doc.tracks[0].name, "Bo");
  // A name the modder gave stays.
  doc = setActor(setTrack(doc, t1, { name: "The fixer" }), t1, ana);
  assert.equal(doc.tracks[0].name, "The fixer");

  doc = setActor(doc, t2, { player: "wa", name: "V" });
  assert.equal(doc.tracks[1].name, "V");
  assert.equal(playerTrack(doc)?.id, t2);
  assert.throws(() => setActor(doc, t1, { player: "ma", name: "V" }), (e: Error) => e instanceof EditError && /V is already in this scene/.test(e.message));
  // The track that has V can change V's body.
  assert.equal(setActor(doc, t2, { player: "ma", name: "V" }).tracks[1].actor?.player, "ma");

  assert.throws(() => setActor(doc, t3, ana), /Only an actor track/);
  assert.throws(() => setActor(doc, t1, {}), /characters, or V/);
  assert.throws(() => setActor(doc, t1, { record: "Character.Ana", player: "wa" }), /not both/);
  assert.throws(() => setActor(doc, "nope", ana), /no longer in the scene/);

  // Saved and read again, the actors are there; taking one off leaves the track.
  const back = parseDoc(formatDoc(doc));
  assert.deepEqual(back.tracks[0].actor, ana);
  assert.equal(setActor(back, t1, undefined).tracks[0].actor, undefined);
  assert.throws(() => parseDoc(formatDoc(doc).replace('"player": "wa"', '"player": "wa"').replace('"kind": "audio"', '"kind": "audio", "actor": 3')), /actor is not one this version reads/);
});
