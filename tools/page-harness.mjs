// Writes dist/harness.html: the scene editor's page in a plain browser, with a stand-in for VS Code
// that keeps the document and answers as the host does. For looking at the page without F5:
//   npm run build && node tools/page-harness.mjs && npx http-server . -a 127.0.0.1   (or any static server)
// then open /dist/harness.html. The body is cut from src/editor.ts, so the two cannot drift.
import * as fs from "node:fs";

const source = fs.readFileSync("src/editor.ts", "utf8");
const icon = (path) => `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">${path}</svg>`;
const template = /export const PageBody = `([\s\S]*?)`;\n/.exec(source)?.[1];
if (!template) throw new Error("PageBody not found in src/editor.ts");
const body = template.replace(/\$\{icon\('([^']*)'\)\}/g, (_, path) => icon(path));

const sample = {
  edgedir: 1,
  name: "Alley talk",
  fps: 30,
  anchor: { mode: "player", distance: 3 },
  set: null,
  tracks: [
    // Made-up names: an actor with a rig, a clip that fits, a looping one, and one made for another rig.
    { id: "t1", kind: "actor", name: "Fixer", actor: { record: "Character.Fixer", name: "Ana Example", appearance: "ana_coat", entity: "base\\made_up\\ana.ent", rig: "base\\made_up\\woman.rig" }, clips: [
      { id: "c1", kind: "anim", start: 0, length: 3.2, anim: { set: "base\\animations\\made_up\\walk.anims", name: "walk_in", rig: "base\\made_up\\woman.rig", seconds: 3.2 } },
      { id: "c2", kind: "transition", start: 3, length: 0.4 },
      { id: "c3", kind: "anim", start: 3.2, length: 3, in: 0.5, out: 1.5, loops: 3, anim: { set: "base\\animations\\made_up\\lean.anims", name: "lean_on_wall", rig: "base\\made_up\\woman.rig", seconds: 2 } },
      { id: "c8", kind: "anim", start: 6.5, length: 1.5, anim: { set: "base\\animations\\made_up\\man.anims", name: "shrug", rig: "base\\made_up\\man.rig", seconds: 1.5 } },
    ] },
    { id: "t2", kind: "actor", name: "V", actor: { player: "wa", name: "V", rig: "base\\made_up\\woman.rig" }, clips: [{ id: "c4", kind: "anim", start: 1, length: 4, name: "wait" }] },
    { id: "t3", kind: "audio", name: "Street", clips: [{ id: "c5", kind: "audio", start: 0.5, length: 2, name: "rain loop" }] },
    { id: "t4", kind: "camera", name: "Camera", clips: [
      { id: "c6", kind: "camera", start: 0, length: 3.2, name: "wide" },
      { id: "c7", kind: "camera", start: 3.2, length: 2.8, name: "close" },
    ] },
    { id: "t5", kind: "weather", name: "Weather", clips: [{ id: "c8", kind: "weather", start: 0, length: 6, name: "rain" }] },
  ],
};

// The 3D preview's files: real ones from this PC's game when tools/preview-sample.ts was run (its
// scene is shown instead of the made-up one), else none, and the viewport says so.
const preview = fs.existsSync("dist/preview-sample/sample.json") ? JSON.parse(fs.readFileSync("dist/preview-sample/sample.json", "utf8")) : { files: {} };
const scene = preview.doc ?? sample;

fs.writeFileSync(
  "dist/harness.html",
  `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>EDGEdir page harness</title>
<link rel="stylesheet" href="../media/editor.css"></head>
<body class="vscode-dark">
${body}
<script>
  // The stand-in host: keeps the document, echoes each edit back, and counts them.
  let state; window.harness = { doc: ${JSON.stringify(scene)}, edits: 0, messages: [] };
  const files = ${JSON.stringify(preview.files)};
  const toPage = (m) => window.postMessage(m, "*");
  window.acquireVsCodeApi = () => ({
    getState: () => state, setState: (s) => { state = s; },
    postMessage: (m) => {
      window.harness.messages.push(m.type);
      if (m.type === "ready") toPage({ type: "doc", doc: window.harness.doc, dirty: false });
      if (m.type === "want") toPage({ type: "got", key: m.key, ...(files[m.key] ?? { error: "the harness has no file for it (run tools/preview-sample.ts)" }) });
      if (m.type === "edit") { window.harness.doc = m.doc; window.harness.edits++; toPage({ type: "doc", doc: m.doc, dirty: true }); }
    },
  });
  window.harness.invalid = (text) => toPage({ type: "invalid", text });
</script>
<script src="editor.js"></script>
</body></html>
`,
);
console.log("dist/harness.html written");
