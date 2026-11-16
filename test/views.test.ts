// The scaffold's check: every view the extension registers is declared in package.json, under the
// activity bar container, in the same order, with welcome text.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import { VIEWS } from "../src/views";

const manifest = JSON.parse(fs.readFileSync("package.json", "utf8"));

test("the activity bar container has an icon", () => {
  const container = manifest.contributes.viewsContainers.activitybar.find((c: { id: string }) => c.id === "edgedir");
  assert.ok(container, "no edgedir container");
  assert.ok(fs.existsSync(container.icon), `missing ${container.icon}`);
});

test("the registered views are the declared ones", () => {
  const declared = manifest.contributes.views.edgedir.map((v: { id: string }) => v.id);
  assert.deepEqual(declared, [...VIEWS]);
});

test("every view has welcome text", () => {
  const welcomed = new Set(manifest.contributes.viewsWelcome.map((w: { view: string }) => w.view));
  for (const id of VIEWS) assert.ok(welcomed.has(id), `${id} has no welcome text`);
});
