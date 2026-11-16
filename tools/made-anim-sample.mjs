// Writes one sample made animation into the EDGE Library, in the shape EDGEfab will store them in
// (EDGEfab #7), so EDGEdir's hand test can be run before EDGEfab makes a real one. It has the item's
// facts and no clip file: EDGEdir lists it and puts it on a lane, and says its file is missing.
//
//   node tools/made-anim-sample.mjs            writes <Library>\EDGEdir test\Sample wave.anim.asset
//   node tools/made-anim-sample.mjs --remove   takes the EDGEdir test folder away again
//
// The Library's root is read from %APPDATA%\EDGE\library.json. Nothing else in the Library is touched.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const config = path.join(process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"), "EDGE", "library.json");
let root;
try {
  root = JSON.parse(fs.readFileSync(config, "utf8")).root;
} catch {
  // handled below
}
if (!root || !fs.existsSync(root)) {
  console.error(`No EDGE Library was found (${config}). Set one up in EDGEfab or EDGEbuilder first.`);
  process.exit(1);
}
const folder = path.join(root, "EDGEdir test");
if (process.argv.includes("--remove")) {
  fs.rmSync(folder, { recursive: true, force: true });
  console.log(`Removed ${folder}`);
} else {
  const item = path.join(folder, "Sample wave.anim.asset");
  fs.mkdirSync(item, { recursive: true });
  const asset = {
    format: 1,
    id: "edgedirsample0001",
    name: "Sample wave",
    kind: "anim",
    main: "source/raw/sample/anims/Sample wave/Sample wave.glb",
    version: 1,
    anim: { rig: "base\\characters\\base_entities\\woman_base\\woman_base.rig", seconds: 2.4, fps: 30, rootMotion: false, loop: false, name: "sample_wave" },
  };
  fs.writeFileSync(path.join(item, "asset.json"), `${JSON.stringify(asset, null, 2)}\n`);
  console.log(`Wrote ${item}\nRemove it after the test with: node tools/made-anim-sample.mjs --remove`);
}
