// EDGE Director's sound files (D6b). REDnode plays a file only from the package's own folder or its
// data folder, so a scene's sound is copied into the data folder before it is played. No `rednode`
// in here: the folder is handed in, so the copy runs in a unit test.
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Puts a sound file into `dir`\sounds and answers the copy's path. The copy is named for where the
 * file came from, so two scenes' files of one name do not meet, and it is made again only when
 * the file's size or time changed. Throws, in words, when the file is gone.
 */
export function fetchSound(from: string, dir: string): string {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(from);
  } catch {
    throw new Error("it is not in the scene's folder");
  }
  const folder = path.join(dir, "sounds");
  const key = crypto.createHash("sha1").update(path.resolve(from).toLowerCase()).digest("hex").slice(0, 12);
  const to = path.join(folder, `${key}-${path.basename(from).replace(/[^A-Za-z0-9._-]/g, "_")}`);
  let there: fs.Stats | undefined;
  try {
    there = fs.statSync(to);
  } catch {
    // Not copied yet.
  }
  if (!there || there.size !== stat.size || there.mtimeMs < stat.mtimeMs) {
    fs.mkdirSync(folder, { recursive: true });
    fs.copyFileSync(from, to);
  }
  return to;
}
