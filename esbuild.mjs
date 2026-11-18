// Bundles the extension (CommonJS, VS Code's module loader), the scene editor's page (a browser
// script) and EDGE Director's package (dist/director). `node esbuild.mjs --watch` rebuilds on change; `--tests` bundles test/*.test.ts for `node --test "dist-test/*.test.cjs"`; `--production`
// (vsce's prepublish) minifies, with no source maps.
import * as esbuild from "esbuild";
import * as fs from "node:fs";

const watch = process.argv.includes("--watch");
const tests = process.argv.includes("--tests");
const production = process.argv.includes("--production");

const common = { bundle: true, sourcemap: !production, minify: production, logLevel: "info" };

const extension = {
  ...common,
  platform: "node",
  format: "cjs",
  target: "node20",
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.js",
  external: ["vscode"],
};

const testBuild = {
  ...common,
  platform: "node",
  format: "cjs",
  target: "node20",
  entryPoints: fs.readdirSync("test").filter((f) => f.endsWith(".test.ts")).map((f) => `test/${f}`),
  outdir: "dist-test",
  outExtension: { ".js": ".cjs" },
  logLevel: "warning",
};

const page = {
  ...common,
  platform: "browser",
  format: "iife",
  target: "es2022",
  entryPoints: ["webview/editor.ts"],
  outfile: "dist/editor.js",
};

// EDGE Director, EDGEdir's app in the game (director/): its Node mod and its window's page, with
// EDGEdir's own scene code bundled in. `rednode` stays outside: the REDnode host gives it to both.
// The package is dist/director, zipped as its own release file by tools/release/director-zip.mjs.
const directorVersion = JSON.parse(fs.readFileSync("director/rednode-app.json", "utf8")).version;
const directorMod = {
  ...common,
  sourcemap: false,
  platform: "node",
  format: "esm",
  target: "node20",
  entryPoints: ["director/mod.ts"],
  outfile: "dist/director/mod.mjs",
  external: ["rednode"],
  define: { __VERSION__: JSON.stringify(directorVersion) },
  legalComments: "none",
};
const directorPage = {
  ...common,
  sourcemap: false,
  platform: "browser",
  format: "esm",
  target: "chrome120",
  entryPoints: ["director/page/main.ts"],
  outfile: "dist/director/app.js",
  external: ["rednode"],
  legalComments: "none",
};
/** The package's files that are not built: copied as they are. service.mjs keeps its comments, which REDnode reads. */
const directorFiles = () => {
  fs.mkdirSync("dist/director", { recursive: true });
  for (const f of ["rednode-app.json", "index.html", "service.mjs"]) fs.copyFileSync(`director/${f}`, `dist/director/${f}`);
};
// The Director against a made-up world, with its page for a browser (director/standin.ts). Not in the package.
const directorStandin = { ...directorMod, entryPoints: ["director/standin.ts"], outfile: "dist/director-standin.mjs", external: [] };
const all = [extension, page, directorMod, directorPage, directorStandin];

if (tests) await esbuild.build(testBuild);
else if (watch) {
  directorFiles();
  await Promise.all(all.map(async (o) => (await esbuild.context(o)).watch()));
} else {
  await Promise.all(all.map((o) => esbuild.build(o)));
  directorFiles();
}
