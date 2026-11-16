// D1.6: the Desk's folders (src/desk.ts), in a temporary folder.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { deskSceneOf, fileName, listDesk, newScene, renameScene } from "../src/desk";
import { parseDoc } from "../src/doc";

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), "edgedir-desk-"));

test("a new scene is a Library-shaped item with an empty document", () => {
  const base = temp();
  const s = newScene("Alley talk", base);
  assert.equal(s.folder, path.join(base, "Alley talk.act.asset"));
  assert.equal(s.file, path.join(s.folder, "source", "raw", "edgedir", "Alley talk.edgedir"));
  const asset = JSON.parse(fs.readFileSync(path.join(s.folder, "asset.json"), "utf8"));
  assert.deepEqual({ ...asset, id: "" }, { format: 1, id: "", name: "Alley talk", kind: "act", main: "source/raw/edgedir/Alley talk.edgedir", version: 1 });
  assert.match(asset.id, /^[0-9a-f]{16}$/);
  const doc = parseDoc(fs.readFileSync(s.file, "utf8"));
  assert.equal(doc.name, "Alley talk");
  assert.deepEqual(doc.tracks, []);
  assert.throws(() => newScene("Alley talk", base), /already has a scene/);
});

test("names: forbidden characters go, empty and reserved names are refused", () => {
  assert.equal(fileName('  Bar: "fight" / take 2?  '), "Bar fight take 2");
  assert.equal(fileName("ends with dots..."), "ends with dots");
  assert.throws(() => fileName(" ?? "), /needs a name/);
  assert.throws(() => fileName("NUL"), /Windows keeps/);
  assert.throws(() => fileName("x".repeat(81)), /too long/);
});

test("the Desk lists its scenes, the last changed first, and nothing else", () => {
  const base = temp();
  assert.deepEqual(listDesk(path.join(base, "missing")), []);
  const a = newScene("A", base);
  const b = newScene("B", base);
  fs.mkdirSync(path.join(base, "notes"));
  fs.mkdirSync(path.join(base, "broken.act.asset"));
  fs.mkdirSync(path.join(base, "other.prop.asset"));
  fs.utimesSync(a.file, new Date(), new Date(Date.now() + 5000));
  assert.deepEqual(listDesk(base).map((s) => s.name), ["A", "B"]);
  assert.equal(deskSceneOf(b.file, base)?.id, b.id);
  assert.equal(deskSceneOf(path.join(base, "elsewhere.edgedir"), base), undefined);
  // A scene whose document is gone is no longer listed.
  fs.rmSync(b.file);
  assert.deepEqual(listDesk(base).map((s) => s.name), ["A"]);
});

test("rename moves the folder and the document, and keeps the id", () => {
  const base = temp();
  const s = newScene("First", base);
  newScene("Taken", base);
  assert.throws(() => renameScene(s, "Taken", base), /already has a scene/);
  const r = renameScene(s, "Second", base);
  assert.equal(r.id, s.id);
  assert.equal(fs.existsSync(s.folder), false);
  assert.equal(r.file, path.join(base, "Second.act.asset", "source", "raw", "edgedir", "Second.edgedir"));
  assert.equal(parseDoc(fs.readFileSync(r.file, "utf8")).name, "Second");
  const asset = JSON.parse(fs.readFileSync(path.join(r.folder, "asset.json"), "utf8"));
  assert.deepEqual([asset.name, asset.main, asset.id], ["Second", "source/raw/edgedir/Second.edgedir", s.id]);
  assert.deepEqual(listDesk(base).map((x) => x.name).sort(), ["Second", "Taken"]);
});
