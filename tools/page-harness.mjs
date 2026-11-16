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
    { id: "t1", kind: "actor", name: "Fixer", clips: [
      { id: "c1", kind: "anim", start: 0, length: 3.2, name: "walk in" },
      { id: "c2", kind: "transition", start: 3, length: 0.4 },
      { id: "c3", kind: "anim", start: 3.2, length: 2.8, name: "lean on wall" },
    ] },
    { id: "t2", kind: "actor", name: "Courier", clips: [{ id: "c4", kind: "anim", start: 1, length: 4, name: "wait" }] },
    { id: "t3", kind: "audio", name: "Street", clips: [{ id: "c5", kind: "audio", start: 0.5, length: 2, name: "rain loop" }] },
    { id: "t4", kind: "camera", name: "Camera", clips: [
      { id: "c6", kind: "camera", start: 0, length: 3.2, name: "wide" },
      { id: "c7", kind: "camera", start: 3.2, length: 2.8, name: "close" },
    ] },
    { id: "t5", kind: "weather", name: "Weather", clips: [{ id: "c8", kind: "weather", start: 0, length: 6, name: "rain" }] },
  ],
};

fs.writeFileSync(
  "dist/harness.html",
  `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>EDGEdir page harness</title>
<link rel="stylesheet" href="../media/editor.css"></head>
<body class="vscode-dark">
${body}
<script>
  // The stand-in host: keeps the document, echoes each edit back, and counts them.
  let state; window.harness = { doc: ${JSON.stringify(sample)}, edits: 0, messages: [] };
  const toPage = (m) => window.postMessage(m, "*");
  window.acquireVsCodeApi = () => ({
    getState: () => state, setState: (s) => { state = s; },
    postMessage: (m) => {
      window.harness.messages.push(m.type);
      if (m.type === "ready") toPage({ type: "doc", doc: window.harness.doc, dirty: false });
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
