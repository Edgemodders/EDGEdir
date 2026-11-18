// EDGE Director's window (DR1): the Desk's scenes, and one scene with its transport, its strip,
// its cast and what the game will not match. The page asks the Node mod over REDnode's `channel`
// and draws the state it answers with (protocol.ts). It keeps nothing the mod does not have,
// except where the playhead was put while nothing plays.
import { channel } from "rednode";
import { Active, type ModMessage, type PageMessage, type Snapshot } from "../protocol";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const post = (m: PageMessage) => channel.post(m);
const el = (tag: string, cls = "", text = "") => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const clock = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
const ago = (ms: number) => {
  const min = Math.max(0, Math.round((Date.now() - ms) / 60000));
  return min < 1 ? "just now" : min < 60 ? `${min} min ago` : min < 1440 ? `${Math.round(min / 60)} h ago` : `${Math.round(min / 1440)} d ago`;
};
const setOff = (e: HTMLElement, off: boolean) => (off ? e.setAttribute("disabled", "") : e.removeAttribute("disabled"));
const off = (e: HTMLElement) => e.hasAttribute("disabled");

let state: Snapshot | undefined;
/** Where the playhead was put while nothing plays: the next Play starts there. */
let from = 0;
let dragging = false;

/** The scene in the window is the one in the game. */
const mine = () => !!state?.view && state.playing === state.view.file && Active.includes(state.play.state);
/** The scene's time now, in seconds. */
function now(): number {
  const s = state;
  if (!s?.view) return 0;
  if (!mine() || s.play.startedAt === undefined) return from;
  if (s.play.state === "ended") return s.view.length;
  if (s.play.state !== "playing") return from;
  return Math.min(Math.max(0, (Date.now() - s.play.startedAt) / 1000), s.view.length);
}

function drawScenes(s: Snapshot) {
  const list = $("scenes");
  list.replaceChildren(
    ...s.scenes.map((sc) => {
      const row = el("div", "row");
      row.dataset.file = sc.file;
      row.append(el("span", "name", sc.name));
      if (s.playing === sc.file) row.append(el("span", "tag", "In the game"));
      row.append(el("span", "dim", ago(sc.modified)));
      row.addEventListener("click", () => post({ type: "open", file: sc.file }));
      return row;
    }),
  );
  $("none").hidden = s.scenes.length > 0;
}

function drawScene(s: Snapshot) {
  const v = s.view!;
  $("name").textContent = v.name;
  $("set").textContent = v.set ? `on ${v.set.name}${v.set.found ? "" : " (not found)"}` : "in front of V";
  $("why").hidden = !v.why;
  $("why").textContent = v.why ?? "";
  // The ruler: a mark every second, or fewer for a long scene.
  const step = v.length > 60 ? 10 : v.length > 20 ? 5 : v.length > 8 ? 2 : 1;
  const ticks: HTMLElement[] = [];
  for (let t = 0; t <= v.length + 1e-6 && v.length > 0; t += step) {
    const tick = el("span", "tick", String(t));
    tick.style.left = `${(t / v.length) * 100}%`;
    ticks.push(tick);
  }
  $("ruler").replaceChildren(...ticks);
  $("lanes").replaceChildren(
    ...v.tracks.map((t) => {
      const lane = el("div", `lane${t.cast ? " cast" : ""}${s.chosen === t.id ? " on" : ""}`);
      lane.dataset.track = t.id;
      const name = el("div", "lane-name", t.who ?? t.name);
      name.title = t.cast ? "Mark this actor in the world" : t.kind === "actor" ? "Not in the game: see In the game below" : `${t.kind} tracks do not play in the game yet`;
      if (t.cast) name.addEventListener("click", () => post({ type: "choose", track: s.chosen === t.id ? undefined : t.id }));
      const clips = el("div", "lane-clips");
      for (const c of t.clips) {
        const clip = el("div", `clip${c.played && t.cast ? " played" : ""}`, c.label);
        clip.style.left = `${(c.start / (v.length || 1)) * 100}%`;
        clip.style.width = `${((c.end - c.start) / (v.length || 1)) * 100}%`;
        clip.title = `${c.label}, ${clock(c.start)} to ${clock(c.end)}`;
        clips.append(clip);
      }
      lane.append(name, clips);
      return lane;
    }),
  );
  $("notesTitle").textContent = v.notes.length ? `In the game (${v.notes.length})` : "In the game";
  $("notes").replaceChildren(...(v.notes.length ? v.notes.map((n) => el("div", "note", n)) : [el("div", "note", "The game plays this scene as the preview shows it.")]));
}

let castWas = "";
function drawCast(s: Snapshot) {
  const here = mine();
  const t = now();
  // Drawn again only when something in it changed, so a click is never lost to a redraw.
  const lanes = s.view!.tracks;
  const key = JSON.stringify([here, s.cast, s.chosen, s.cast.map((a) => lanes.find((x) => x.id === a.track)?.clips.filter((c) => c.played && c.start <= t + 1e-6).pop()?.id)]);
  if (key === castWas) return;
  castWas = key;
  $("nocast").hidden = here && s.cast.length > 0;
  $("cast").replaceChildren(
    ...(here ? s.cast : []).map((a) => {
      const row = el("div", `row${s.chosen === a.track ? " on" : ""}`);
      row.dataset.track = a.track;
      const lane = s.view!.tracks.find((x) => x.id === a.track);
      const clip = lane?.clips.filter((c) => c.played && c.start <= t + 1e-6).pop();
      row.append(el("span", "name", a.name), el("span", "dim", clip?.label ?? ""), el("span", "dim", a.distance === undefined ? "" : `${a.distance} m`));
      const go = el("rn-button", "", "Go There");
      go.setAttribute("variant", "ghost");
      go.addEventListener("click", (e) => {
        e.stopPropagation();
        post({ type: "goTo", track: a.track });
      });
      row.append(go);
      row.addEventListener("click", () => post({ type: "choose", track: s.chosen === a.track ? undefined : a.track }));
      return row;
    }),
  );
}

function drawTransport(s: Snapshot) {
  const here = mine();
  const busy = here && !["playing", "ended"].includes(s.play.state);
  setOff($("play"), !s.view || !!s.view.why || here);
  setOff($("stop"), !Active.includes(s.play.state));
  setOff($("restart"), !s.view || !!s.view.why || busy);
  const loop = $("loop");
  if (here && s.play.loop) loop.setAttribute("checked", "");
  else if (here) loop.removeAttribute("checked");
}

function drawStatus(s: Snapshot) {
  const other = Active.includes(s.play.state) && s.view && s.playing !== s.view.file;
  const late = (s.play.late ?? []).filter((c) => !c.ok).length;
  const text = s.error
    ? s.error
    : s.play.state === "failed"
      ? `Not played: ${s.play.text}`
      : other
        ? "Another scene is in the game"
        : s.play.state === "playing" && late
          ? `Playing; ${late} jump${late === 1 ? "" : "s"} did not land`
          : s.play.text + (Active.includes(s.play.state) && s.from === "editor" ? " (from VS Code)" : "");
  $("statusText").textContent = text || "Ready";
  $("status").classList.toggle("bad", !!s.error || s.play.state === "failed" || (s.play.state === "playing" && late > 0));
  $("version").textContent = `EDGE Director ${s.version}`;
}

function tick() {
  const s = state;
  if (s?.view) {
    const t = now();
    $("time").textContent = `${clock(t)} / ${clock(s.view.length)}`;
    const wide = $("ruler").clientWidth;
    $("head").style.left = `${(t / (s.view.length || 1)) * wide}px`;
  }
}

function render(s: Snapshot) {
  const was = state?.view?.file;
  state = s;
  if (s.view?.file !== was) from = 0;
  $("list").hidden = !!s.view;
  $("scene").hidden = !s.view;
  drawScenes(s);
  if (s.view) {
    drawScene(s);
    drawCast(s);
  }
  drawTransport(s);
  drawStatus(s);
  tick();
}

// ---- what the modder does ---------------------------------------------------------------------

const looping = () => $("loop").hasAttribute("checked");
$("again").addEventListener("click", () => post({ type: "scenes" }));
$("back").addEventListener("click", () => post({ type: "close" }));
$("play").addEventListener("click", () => {
  if (!off($("play"))) post({ type: "play", from, loop: looping() });
});
$("stop").addEventListener("click", () => {
  if (!off($("stop"))) post({ type: "stop" });
});
$("restart").addEventListener("click", () => {
  if (off($("restart"))) return;
  from = 0;
  post(mine() ? { type: "seek", t: 0 } : { type: "play", from: 0, loop: looping() });
});
$("loop").addEventListener("change", (e) => {
  const on = !!(e as CustomEvent<{ checked?: boolean }>).detail?.checked;
  if (on) $("loop").setAttribute("checked", "");
  else $("loop").removeAttribute("checked");
  if (mine()) post({ type: "loop", on });
});

/** The moment under the pointer on the ruler. */
function momentAt(e: PointerEvent): number {
  const box = $("ruler").getBoundingClientRect();
  const share = Math.min(1, Math.max(0, (e.clientX - box.left) / (box.width || 1)));
  return Math.round(share * (state?.view?.length ?? 0) * 100) / 100;
}
$("ruler").addEventListener("pointerdown", (e) => {
  if (!state?.view) return;
  dragging = true;
  $("ruler").setPointerCapture(e.pointerId);
  from = momentAt(e);
  tick();
});
$("ruler").addEventListener("pointermove", (e) => {
  if (!dragging) return;
  from = momentAt(e);
  if (!mine()) tick();
});
$("ruler").addEventListener("pointerup", (e) => {
  if (!dragging) return;
  dragging = false;
  from = momentAt(e);
  // With the scene in the game, the cast goes to that moment; with none, the next Play starts there.
  if (mine() && ["playing", "ended"].includes(state!.play.state)) post({ type: "seek", t: from });
  tick();
});

channel.on<ModMessage>((m) => {
  if (m?.type === "state" && m.state) render(m.state);
});
setInterval(tick, 50);
setInterval(() => state?.view && drawCast(state), 250);
post({ type: "hello" });

// For rounds by script: what the page shows, as data.
(window as unknown as { edgeDirector: unknown }).edgeDirector = { state: () => state, now, from: () => from };
