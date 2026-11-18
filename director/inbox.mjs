// The folder EDGEdir reaches the Director through: %LOCALAPPDATA%\EDGEdir\play. EDGEdir writes
// request.json; the player writes state.json (what the play is doing) and alive.json (that it
// runs, every two seconds). The folder is in the player's own Windows profile, so only their own
// programs can write it, and no port is opened. No `rednode` import in here.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const playDir = () => path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "EDGEdir", "play");

/** Writes a file whole: a reader never sees half of it. */
export function put(dir, name, value) {
  const tmp = path.join(dir, `${name}.${process.pid}.tmp`);
  try {
    fs.writeFileSync(tmp, JSON.stringify(value));
    fs.renameSync(tmp, path.join(dir, name));
  } catch (e) {
    console.log(`EDGE Director: could not write ${name}: ${e.message}`);
  }
}

/**
 * Takes requests from the folder for `player` (anything with `play(request)` and `stop()`: play.mjs's
 * Player, or the Director's stage manager in front of it) and says the Director is alive.
 * A request is taken once, by its id; one left from before this started is not played.
 * Answers a function that stops watching.
 */
export function watchInbox(player, version, dir = playDir()) {
  fs.mkdirSync(dir, { recursive: true });
  let last = "";
  const started = Date.now();
  const look = () => {
    let request;
    try {
      request = JSON.parse(fs.readFileSync(path.join(dir, "request.json"), "utf8"));
    } catch {
      return;
    }
    if (!request?.id || request.id === last) return;
    last = request.id;
    if (!(Number(request.at) >= started - 2000)) return;
    if (request.do === "stop") void player.stop();
    else if (request.do === "play") void player.play(request);
  };
  const beat = () => put(dir, "alive.json", { version, at: Date.now() });
  beat();
  const timers = [setInterval(look, 300), setInterval(beat, 2000)];
  return () => timers.forEach((t) => clearInterval(t));
}
