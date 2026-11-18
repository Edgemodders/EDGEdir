// Builds EDGE Director's own release file from dist/director (npm run build makes it), as REDnode
// builds its app packs (its tools/release/pack-zip.mjs). The Director installs into an existing REDnode.
//
//   node tools/release/director-zip.mjs            for a release: the changelog must be released too
//   node tools/release/director-zip.mjs --draft    without the changelog checks, for a test build
//
// Output: dist/EDGE-Director-<version>.zip, laid out like the game folder, so Vortex, EDGEdeck or a
// player extracting it by hand puts it in the same place:
//   red4ext/plugins/REDnode/apps/edge-director/    the app, off until the player switches it on
//   red4ext/plugins/REDnode/apps/edge-director/LICENSE.txt
//
// The Director has its own version (director/rednode-app.json) and its own changelog
// (director/changelog.md): a release needs a section for that version and nothing left under
// Unreleased. A change under Unreleased means: raise "version" in the manifest and rename
// Unreleased to "## <version> (<date>)" first.
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const draft = process.argv.includes("--draft");
const built = path.join(root, "dist", "director");
const source = JSON.parse(fs.readFileSync(path.join(root, "director", "rednode-app.json"), "utf8"));
const Files = ["rednode-app.json", "index.html", "app.js", "mod.mjs", "service.mjs"];

for (const f of Files) if (!fs.existsSync(path.join(built, f))) throw new Error(`dist/director/${f} is missing: run npm run build first`);
const manifest = JSON.parse(fs.readFileSync(path.join(built, "rednode-app.json"), "utf8"));
if (manifest.version !== source.version) throw new Error(`dist/director is version ${manifest.version}, and director/rednode-app.json says ${source.version}: run npm run build again`);
if (!manifest.requires?.rednode) throw new Error('director/rednode-app.json has no "requires.rednode": the Mod Manager could not say when REDnode is too old');

if (!draft) {
  const log = fs.readFileSync(path.join(root, "director", "changelog.md"), "utf8");
  if (!log.includes(`## ${manifest.version} (`)) throw new Error(`director/changelog.md has no section "## ${manifest.version} (<date>)"`);
  const unreleased = log.split(/^## /m).find((s) => s.startsWith("Unreleased")) ?? "";
  if (/^- /m.test(unreleased)) throw new Error('director/changelog.md has changes under Unreleased: raise "version" in director/rednode-app.json and rename Unreleased to its section first');
}

const stage = path.join(root, "dist", "director-stage");
const to = path.join(stage, "red4ext", "plugins", "REDnode", "apps", manifest.id);
const zip = path.join(root, "dist", `EDGE-Director-${manifest.version}${draft ? "-draft" : ""}.zip`);
fs.rmSync(stage, { recursive: true, force: true });
fs.rmSync(zip, { force: true });
fs.mkdirSync(to, { recursive: true });
for (const f of Files) fs.copyFileSync(path.join(built, f), path.join(to, f));
// Off until the player switches it on in REDnode's Mod Manager, whatever the manifest in the repo says.
fs.writeFileSync(path.join(to, "rednode-app.json"), JSON.stringify({ ...manifest, open: false }, null, 2) + "\n");
fs.copyFileSync(path.join(root, "LICENSE"), path.join(to, "LICENSE.txt"));

// Windows' own tar writes zip files (-a picks the format from the name); Git's tar does not.
const tar = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
const packed = spawnSync(tar, ["-a", "-c", "-f", zip, "red4ext"], { cwd: stage, stdio: "inherit" });
if (packed.status !== 0) throw new Error("Zipping failed");
fs.rmSync(stage, { recursive: true, force: true });
console.log(`${zip}: ${(fs.statSync(zip).size / 1024).toFixed(0)} KB`);
