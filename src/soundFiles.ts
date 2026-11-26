// A scene's sound files on disk (D6b): a file added to a scene is copied into `audio` beside the
// scene's file, so the scene still plays when the first file moves or goes (the owner's A1). On the
// Desk that is inside the scene's own item folder, which Rename and Delete take whole.
// No VS Code in here.
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { SoundEndings, SoundFolder } from "./sound";

const hashOf = (file: string) => crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex");

/** A file's name made safe to keep: Windows' forbidden characters out, the ending in small letters. */
function cleanName(source: string): { stem: string; ending: string } {
  const ending = path.extname(source).slice(1).toLowerCase();
  if (!(SoundEndings as readonly string[]).includes(ending)) throw new Error(`EDGEdir takes ${SoundEndings.map((e) => e.toUpperCase()).join(", ")} sound files: ${path.basename(source)} is none of them`);
  // eslint-disable-next-line no-control-regex
  const stem = path.basename(source, path.extname(source)).replace(/[<>:"/\\|?*\x00-\x1f]/g, " ").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "").slice(0, 80) || "sound";
  return { stem, ending };
}

/**
 * Copies a sound file into the scene's `audio` folder and answers the name the scene keeps it
 * under, from the scene's folder, with `/`. A file already there with the same content is used
 * as it is; a different file of the same name is kept under the name with a number.
 */
export function keepSound(source: string, sceneFile: string): string {
  const { stem, ending } = cleanName(source);
  const folder = path.join(path.dirname(sceneFile), SoundFolder);
  const inFolder = path.resolve(path.dirname(source)).toLowerCase() === path.resolve(folder).toLowerCase();
  // A file picked from the scene's own audio folder is used where it is.
  if (inFolder) return `${SoundFolder}/${path.basename(source)}`;
  let wanted: string | undefined;
  for (let n = 1; n < 1000; n++) {
    const name = `${stem}${n === 1 ? "" : `-${n}`}.${ending}`;
    const to = path.join(folder, name);
    if (!fs.existsSync(to)) {
      fs.mkdirSync(folder, { recursive: true });
      fs.copyFileSync(source, to);
      return `${SoundFolder}/${name}`;
    }
    wanted ??= hashOf(source);
    if (fs.statSync(to).size === fs.statSync(source).size && hashOf(to) === wanted) return `${SoundFolder}/${name}`;
  }
  throw new Error(`The scene's ${SoundFolder} folder has too many files named ${stem}`);
}

/** Where a sound a scene names is on this PC, when it is there and inside the scene's folder. */
export function soundPath(sceneFile: string, file: string): string | undefined {
  const dir = path.dirname(sceneFile);
  const full = path.resolve(dir, ...file.split("/"));
  const rel = path.relative(dir, full);
  return !rel.startsWith("..") && !path.isAbsolute(rel) && fs.existsSync(full) ? full : undefined;
}
