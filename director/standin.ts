// A stand-in for EDGE Director with no game running, for hand tests and rounds by script
// (docs/testing.md). It runs the Director's own steps (play.mjs, stage.ts, floor.ts, inbox.mjs)
// against a made-up world that prints every call instead of making it, and serves the window's
// page to a browser on this PC only (127.0.0.1), with a small stand-in for REDnode's `channel`.
//   node dist/director-standin.mjs                 plays whatever EDGEdir or the page sends
//   node dist/director-standin.mjs --fail spawn    the named call fails (write, spawn, use, jump, load)
//   node dist/director-standin.mjs --write-ms 3000 the first workspot takes that long to write
//   node dist/director-standin.mjs --port 4173     the page's port (0 for no page)
//   node dist/director-standin.mjs --kit <file>    REDnode's UI kit (its packages/ui/src/rednode-ui.js), so the page looks as in the game
// It uses %LOCALAPPDATA%\EDGEdir\play and the Desk, as the real one does: set LOCALAPPDATA to try it apart.
import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { deskDir } from "../src/desk";
import { playDir, put, watchInbox } from "./inbox.mjs";
import { Player } from "./play.mjs";
import type { PageMessage, PlayNow, Snapshot } from "./protocol";
import { Stage, type PlayerLike } from "./stage";

declare const __VERSION__: string;
const version = __VERSION__;
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};
const fail = arg("--fail");
const writeMs = Number(arg("--write-ms") ?? 300);
const port = Number(arg("--port") ?? 4173);
const kit = arg("--kit");

let n = 0;
const said = (name: string, ...args: unknown[]) => console.log(`${new Date().toISOString().slice(11, 23)}  ${name} ${args.map((a) => JSON.stringify(a)).join(" ")}`);
const call = async <T>(name: string, args: unknown[], answer: T, ms = 20): Promise<T> => {
  said(name, ...args);
  await new Promise((r) => setTimeout(r, ms));
  if (fail === name) throw new Error(`the stand-in was told to fail ${name}`);
  return answer;
};
type Id = { hash: string };
const world = {
  writeWorkspot: (name: string, o: { rig: string; clips: { name: string }[]; swap: boolean }) => call("write", [name, { rig: o.rig, clips: o.clips.map((c) => c.name), swap: o.swap }], { path: `standin\\${name}.workspot` }, writeMs),
  spawn: (o: unknown) => call("spawn", [o], { id: { hash: `standin${++n}` } }),
  useWorkspot: (id: Id, o: unknown) => call("use", [id.hash, o], { id, started: true }),
  jumpWorkspot: (id: Id, to: string) => call("jump", [id.hash, to], true, 5),
  remove: (id: Id) => call("remove", [id.hash], true, 5),
  move: (id: Id, position: unknown, _orientation: unknown, yaw: number) => call("move", [id.hash, position, yaw], true, 5),
  setWeather: (state: string, o: unknown) => call("weather", [state, o], { applied: true, changed: true, state }, 5),
  resetWeather: () => call("weather-back", [], { held: false }, 5),
  load: (scene: { objects: { id: string }[] }, o: unknown) => call("load", [scene.objects.map((x) => x.id), o], { skipped: [], notes: [] }),
  unload: (name: string) => call("unload", [name], 1, 5),
};
// V stands at the world's middle, facing north, until Go There moves them.
let v = { x: 0, y: 0, z: 0, fx: 0, fy: 1 };

const listeners = new Set<http.ServerResponse>();
let lastState: Snapshot | undefined;
let stage: Stage | undefined;
const player = new Player({
  world,
  player: async () => v,
  freeze: (id: Id, on: boolean) => call(on ? "hold" : "release", [id.hash], undefined, 5),
  report: (state: PlayNow) => {
    put(playDir(), "state.json", { ...state, version });
    said("state", state.state, state.text);
    stage?.publish();
  },
}) as unknown as PlayerLike;
stage = new Stage({
  player,
  version,
  desk: deskDir(),
  playDir: playDir(),
  publish: (state) => {
    lastState = state;
    for (const res of listeners) res.write(`data: ${JSON.stringify({ type: "state", state })}\n\n`);
  },
  whereV: async () => v,
  teleport: async (to) => {
    said("teleport", to);
    const r = (to.yaw * Math.PI) / 180;
    v = { x: to.x, y: to.y, z: to.z, fx: -Math.sin(r), fy: Math.cos(r) };
  },
  pin: (at, title) => call("pin", [title, at], ++n, 5),
  unpin: (id) => call("unpin", [id], true, 5),
});
const floor = stage;
watchInbox({ play: (request: { do?: string; file?: string }) => floor.fromEditor(request), stop: () => floor.fromEditor({ do: "stop" }) }, version);
setInterval(() => {
  void (async () => {
    floor.refresh();
    await floor.measure();
    if (JSON.stringify(floor.snapshot()) !== JSON.stringify(lastState)) floor.publish();
  })();
}, 2000);

// ---- the window's page, for a browser on this PC ---------------------------------------------

/** REDnode's `channel` for the page: what it posts goes to this process, and the state comes back as server-sent events. */
const Stub = `export const channel = {
  post: (data) => void fetch("/post", { method: "POST", body: JSON.stringify(data) }),
  on: (handler) => { const s = new EventSource("/events"); s.onmessage = (e) => handler(JSON.parse(e.data)); return () => s.close(); },
};`;
const here = path.dirname(fileURLToPath(import.meta.url));
const pageDir = path.join(here, "director");
const types: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

if (port) {
  http
    .createServer((req, res) => {
      const url = (req.url ?? "/").split("?")[0];
      // Only pages this stand-in served may post to it: a page of another site is refused by its Origin.
      const origin = req.headers.origin;
      if (origin && origin !== `http://127.0.0.1:${port}`) return void res.writeHead(403).end();
      if (req.method === "POST" && url === "/post") {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          try {
            const m = JSON.parse(body) as PageMessage;
            said("page", m);
            void floor.handle(m);
            res.writeHead(204).end();
          } catch {
            res.writeHead(400).end();
          }
        });
        return;
      }
      if (url === "/events") {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
        listeners.add(res);
        // A page that connects after its hello was answered still gets the state.
        res.write(`data: ${JSON.stringify({ type: "state", state: floor.snapshot() })}

`);
        req.on("close", () => listeners.delete(res));
        return;
      }
      if (kit && url === "/rednode-ui.js") return void res.writeHead(200, { "Content-Type": types[".js"] }).end(fs.readFileSync(kit));
      if (url === "/rednode-stub.js") return void res.writeHead(200, { "Content-Type": types[".js"] }).end(Stub);
      const name = url === "/" ? "index.html" : path.basename(url);
      const file = path.join(pageDir, name);
      if (!types[path.extname(name)] || !fs.existsSync(file)) return void res.writeHead(404).end();
      let text = fs.readFileSync(file, "utf8");
      // The browser has no rednode:// addresses: the kit is left out, and `rednode` is the stub.
      if (name === "index.html") text = text.replace('<script src="rednode://ui/rednode-ui.js"></script>', kit ? '<script src="/rednode-ui.js"></script>' : "").replace("rednode://sdk/index.js", "/rednode-stub.js").replace("background: transparent;", "background: #08090d;");
      res.writeHead(200, { "Content-Type": types[path.extname(name)], "Cache-Control": "no-store" }).end(text);
    })
    .listen(port, "127.0.0.1", () => console.log(`The window's page: http://127.0.0.1:${port}/ (this PC only)`));
}
console.log(`EDGE Director stand-in ${version}; the Desk is ${deskDir()}; EDGEdir is heard in ${playDir()}. Ctrl+C stops it.`);
