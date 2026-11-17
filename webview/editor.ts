// The scene editor's page: the lanes, the transport and the inspector. Every change is made with
// src/doc.ts's pure edits and posted back as a whole new document, which the host writes into the
// .edgedir text, so VS Code's undo and redo cover it. The canvas setup, the ruler and the way of
// working are EDGEwave's (webview/editor.ts at f39a787), copied; the lanes are EDGEdir's own:
// many clips a track, edge trim, snap, zoom.
import {
  EditError,
  TrackKindNames,
  TrackKinds,
  addClip,
  addTrack,
  clipEdges,
  clipEnd,
  findClip,
  findTrack,
  frame,
  moveClips,
  moveTrack,
  pasteClips,
  removeClips,
  removeTrack,
  renameClip,
  sceneLength,
  setTrack,
  snap,
  splitClip,
  toFrame,
  trimClip,
  playOf,
  setPlay,
  seqOf,
  unpackSeq,
  addTransition,
  setTransition,
  transitionOf,
  markOf,
  setMark,
  unfit,
  type Actor,
  type Clip,
  type SceneDoc,
  type Track,
  type TrackKind,
} from "../src/doc";
import { cuesOf, notesFor } from "../src/cues";
import { joinOf, transitionNote } from "../src/pose";
import { mountPreview } from "./preview";

interface ViewState {
  scratch?: { base: string; doc: string };
  view?: { start: number; spp: number; preview: number; snap: boolean; loop: boolean };
  clipboard?: { kind: TrackKind; clips: Clip[] };
}
declare function acquireVsCodeApi(): { postMessage(m: unknown): void; getState(): ViewState | undefined; setState(s: ViewState): void };

const vscode = acquireVsCodeApi();
const send = (m: unknown) => vscode.postMessage(m);
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---- state ---------------------------------------------------------------------------------------

let doc: SceneDoc | null = null;
/** The selected clips, and the selected track (the lane new clips go to). */
let sel = new Set<string>();
let selTrack = "";
let playhead = 0;
/** The file is a sequence (D4b): one actor lane, a stand-in body, and no tracks to add. */
let seqMode = false;
/** How each linked sequence stands, by its id: linked, missing from the Desk, or newer there than the block's copy. */
let links: Record<string, string> = {};
let playing = false;
let playFrom = 0;
let lastTick = 0;

const saved = vscode.getState()?.view;
/** The time at the canvas's left edge, and seconds a pixel. */
let viewStart = saved?.start ?? 0;
let spp = saved?.spp ?? 1 / 80;
let snapOn = saved?.snap ?? true;
let looping = saved?.loop ?? false;
let fitted = !!saved;

const Ruler = 22;
const Lane = 40;
const Grip = 6;

const canvas = $<HTMLCanvasElement>("canvas");
const wrap = $("canvasWrap");
const width = () => wrap.clientWidth || 600;
const x = (t: number) => (t - viewStart) / spp;
const timeAt = (px: number) => viewStart + px * spp;

function keepView() {
  vscode.setState({ ...(vscode.getState() ?? {}), view: { start: viewStart, spp, preview: $("viewport").offsetHeight, snap: snapOn, loop: looping } });
}

// The 3D preview above the timeline (D3). It follows the document, the playhead and the selection.
const preview = mountPreview($("stage"), $("previewNote"), send);
$("frame").addEventListener("click", () => preview.frame());
(window as unknown as { edgedirPreview: unknown }).edgedirPreview = preview;

// ---- messages from the host ----------------------------------------------------------------------

/** The first document since the page loaded: where unsaved edits lost to a window reload are put back. */
let firstDoc = true;

/** Keeps the unsaved document in the tab's state; the saved one becomes the base. */
function keepScratch(text: string, dirty: boolean) {
  const s = vscode.getState() ?? {};
  vscode.setState({ ...s, scratch: dirty ? { base: s.scratch?.base ?? text, doc: text } : { base: text, doc: text } });
}

let pendingSelect = "";
function applyPendingSelect() {
  if (!pendingSelect || !doc) return;
  const found = findClip(doc, pendingSelect);
  if (!found) return;
  sel = new Set([pendingSelect]);
  selTrack = found.track.id;
  pendingSelect = "";
  render();
}

window.addEventListener("message", (e) => {
  const m = e.data;
  if (m.type === "invalid") {
    doc = null;
    stopPlay();
    preview.sync(null, 0, "");
    $("invalidText").textContent = m.text;
    $("invalid").hidden = false;
    $("work").hidden = true;
    $("title").textContent = "Not a scene";
    $("meta").textContent = "";
    return;
  }
  if (m.type === "select") {
    // The host put a clip on a track (Add to Track): show it as picked. The document with the clip
    // may come a moment after this message, so the choice is kept until it does.
    pendingSelect = String(m.clip);
    applyPendingSelect();
    return;
  }
  if (m.type === "got") return preview.got(m);
  if (m.type !== "doc") return;
  const text = JSON.stringify(m.doc);
  if (firstDoc) {
    firstDoc = false;
    const scratch = vscode.getState()?.scratch;
    // The file as saved, while this tab had unsaved edits on top of it: a reload lost them. Back as unsaved edits.
    if (!m.dirty && scratch && scratch.base === text && scratch.doc !== text) {
      try {
        send({ type: "edit", doc: JSON.parse(scratch.doc) });
        send({ type: "restored" });
        return;
      } catch {
        // Not a document any more: drop it.
      }
    }
  }
  keepScratch(text, !!m.dirty);
  $("invalid").hidden = true;
  $("work").hidden = false;
  const before = doc;
  const mode = `${seqMode}|${JSON.stringify(links)}`;
  seqMode = !!m.sequence;
  links = (m.links as Record<string, string> | undefined) ?? {};
  document.body.classList.toggle("sequence", seqMode);
  doc = m.doc as SceneDoc;
  // What undo or a text edit took away is no longer selected; a clip that is new (redo, paste in the text) is not either.
  sel = new Set([...sel].filter((id) => findClip(doc!, id)));
  if (!findTrack(doc, selTrack)) selTrack = doc.tracks[0]?.id ?? "";
  if (!fitted && sceneLength(doc) > 0) fit();
  if (!before || JSON.stringify(before) !== text || mode !== `${seqMode}|${JSON.stringify(links)}`) render();
  applyPendingSelect();
});

// ---- changes -------------------------------------------------------------------------------------

let statusTimer = 0;
function say(text: string, bad = false) {
  const s = $("status");
  s.textContent = text;
  s.classList.toggle("bad", bad);
  clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => (s.textContent = ""), 4000);
}

/** The document after an edit: kept, drawn and sent to the host. */
function commit(next: SceneDoc) {
  if (next === doc) return;
  doc = next;
  send({ type: "edit", doc });
  render();
}

/** Runs an edit; what the document's rules refuse is said in the status line. */
function attempt<T>(edit: (d: SceneDoc) => T): T | undefined {
  if (!doc) return undefined;
  try {
    return edit(doc);
  } catch (e) {
    if (!(e instanceof EditError)) throw e;
    say(e.message, true);
    return undefined;
  }
}

function change(edit: (d: SceneDoc) => SceneDoc) {
  const next = attempt(edit);
  if (next) commit(next);
  // Refused: the inspector's box goes back to what the scene has, not what was typed.
  else drawInspector();
}

// ---- drawing -------------------------------------------------------------------------------------

function colours() {
  const s = getComputedStyle(document.body);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    accent: v("--accent", "#fcee0a"),
    cyan: v("--cyan", "#19f3ff"),
    line: v("--line", "#262c3d"),
    dim: v("--dim", "#8a93a8"),
    fg: v("--vscode-foreground", "#d0d4e0"),
    bg: v("--vscode-editor-background", "#08090d"),
    font: v("--mono", "monospace"),
    kinds: Object.fromEntries(TrackKinds.map((k) => [k, v(`--kind-${k}`, "#fcee0a")])) as Record<TrackKind, string>,
  };
}

/** A canvas sized for sharp drawing at the screen's pixel ratio. */
function setup(c: HTMLCanvasElement, h: number): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  const w = width();
  c.style.height = `${h}px`;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
  }
  const g = c.getContext("2d")!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  return g;
}

function niceStep(s: number) {
  for (const n of [1 / 30, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]) if (n >= s) return n;
  return 600;
}

function fmt(t: number, digits = 3) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(digits).padStart(digits ? 3 + digits : 2, "0")}`;
}

function drawRuler(g: CanvasRenderingContext2D, w: number, k: ReturnType<typeof colours>) {
  g.fillStyle = k.dim;
  g.strokeStyle = k.line;
  g.font = `10px ${k.font}`;
  const step = niceStep(spp * 90);
  const framesShown = step < 0.1;
  for (let t = Math.max(0, Math.floor(viewStart / step) * step); x(t) < w; t += step) {
    const px = Math.round(x(t)) + 0.5;
    g.beginPath();
    g.moveTo(px, Ruler - 7);
    g.lineTo(px, Ruler);
    g.stroke();
    g.fillText(framesShown ? `${Math.round(t * (doc?.fps ?? 30))}f` : fmt(t, step >= 1 ? 0 : 1), px + 3, 11);
  }
  g.beginPath();
  g.moveTo(0, Ruler + 0.5);
  g.lineTo(w, Ruler + 0.5);
  g.stroke();
}

const laneTop = (i: number) => Ruler + i * Lane;
/** The colour of a clip that does not fit its actor's rig. */
const Unfit = "#ff5a5a";

const clipLabel = (c: Clip) => c.name ?? (c.anim as { name?: string } | undefined)?.name ?? (c.kind === "sequence" ? `▸ ${seqOf(c)?.name || "sequence"}` : c.kind === "transition" ? "transition" : c.kind);

/** A clip's box in the lane: a transition is a thin band along the top, over the join, clear of the clips' names. */
function box(c: Clip, lane: number) {
  const top = laneTop(lane);
  return c.kind === "transition" ? { x: x(c.start), y: top + 3, w: c.length / spp, h: 9 } : { x: x(c.start), y: top + 10, w: c.length / spp, h: Lane - 14 };
}

function draw() {
  // The preview shows the scene as a drag would leave it, at the playhead.
  preview.sync(drag?.preview ?? doc, playhead, selTrack);
  const k = colours();
  const w = width();
  const tracks = shown();
  const h = Math.max(Ruler + tracks.length * Lane + 8, wrap.parentElement!.clientHeight - 2);
  const g = setup(canvas, h);
  drawRuler(g, w, k);
  // Before 0 there is no scene.
  if (x(0) > 0) {
    g.fillStyle = k.line;
    g.globalAlpha = 0.35;
    g.fillRect(0, Ruler + 1, x(0), h);
    g.globalAlpha = 1;
  }
  tracks.forEach((t, i) => {
    const top = laneTop(i);
    if (t.id === selTrack) {
      g.fillStyle = k.fg;
      g.globalAlpha = 0.05;
      g.fillRect(0, top + 1, w, Lane - 1);
      g.globalAlpha = 1;
    }
    g.strokeStyle = k.line;
    g.beginPath();
    g.moveTo(0, top + Lane + 0.5);
    g.lineTo(w, top + Lane + 0.5);
    g.stroke();
    const colour = k.kinds[t.kind];
    // Transitions last, so they lie over the clips they join.
    const ordered = [...t.clips].sort((a, b) => Number(a.kind === "transition") - Number(b.kind === "transition"));
    for (const c of ordered) {
      const b = box(c, i);
      if (b.x + b.w < 0 || b.x > w) continue;
      const picked = sel.has(c.id);
      g.globalAlpha = t.mute ? 0.35 : 1;
      if (c.kind === "transition") {
        g.fillStyle = k.bg;
        g.fillRect(b.x, b.y, b.w, b.h);
        const tn = t.actor ? transitionNote(t, c) : undefined;
        // One that joins nothing is dimmed; one the game will not match carries a yellow mark at its start.
        const faint = tn && !tn.joins ? 0.4 : 1;
        g.fillStyle = k.cyan;
        g.globalAlpha *= 0.3 * faint;
        g.fillRect(b.x, b.y, b.w, b.h);
        g.globalAlpha = (t.mute ? 0.35 : 1) * faint;
        if (tn?.mark) {
          g.fillStyle = k.accent;
          g.fillRect(b.x, b.y, 3, b.h);
        }
        g.strokeStyle = k.cyan;
        g.setLineDash([3, 2]);
      } else {
        const bad = !!unfit(t, c);
        const paint = bad ? Unfit : colour;
        g.fillStyle = paint;
        g.globalAlpha *= picked ? 0.45 : 0.22;
        g.fillRect(b.x, b.y, b.w, b.h);
        g.globalAlpha = t.mute ? 0.35 : 1;
        g.strokeStyle = paint;
        g.save();
        g.beginPath();
        g.rect(b.x, b.y, b.w, b.h);
        g.clip();
        if (bad) {
          // Hatched: the animation is made for another rig than the actor's.
          g.globalAlpha *= 0.55;
          g.beginPath();
          for (let hx = b.x - b.h; hx < b.x + b.w; hx += 7) {
            g.moveTo(hx, b.y + b.h);
            g.lineTo(hx + b.h, b.y);
          }
          g.stroke();
        }
        const p = playOf(c);
        if (p && p.loops > 1) {
          // A tick where each loop starts again.
          g.globalAlpha = (t.mute ? 0.35 : 1) * 0.7;
          g.beginPath();
          for (let n = 1; n < p.loops; n++) {
            const lx = Math.round(b.x + (b.w * n) / p.loops) + 0.5;
            g.moveTo(lx, b.y + b.h - 7);
            g.lineTo(lx, b.y + b.h);
          }
          g.stroke();
        }
        g.restore();
        g.globalAlpha = t.mute ? 0.35 : 1;
      }
      g.lineWidth = picked ? 2 : 1;
      g.strokeRect(Math.round(b.x) + 0.5, b.y + 0.5, Math.max(1, Math.round(b.w) - 1), b.h - 1);
      g.setLineDash([]);
      g.lineWidth = 1;
      if (b.w > 24 && c.kind !== "transition") {
        g.save();
        g.beginPath();
        g.rect(b.x + 2, b.y, b.w - 4, b.h);
        g.clip();
        g.fillStyle = k.fg;
        g.font = `11px ${k.font}`;
        g.fillText(clipLabel(c), Math.max(b.x, 0) + 6, b.y + 11);
        g.fillStyle = k.dim;
        g.font = `10px ${k.font}`;
        g.fillText(`${c.length.toFixed(2)} s`, Math.max(b.x, 0) + 6, b.y + 22);
        g.restore();
      }
      g.globalAlpha = 1;
    }
  });
  // The scene's end.
  const end = doc ? sceneLength(doc) : 0;
  if (end > 0 && x(end) < w) {
    g.strokeStyle = k.dim;
    g.setLineDash([2, 3]);
    g.beginPath();
    g.moveTo(Math.round(x(end)) + 0.5, Ruler);
    g.lineTo(Math.round(x(end)) + 0.5, h);
    g.stroke();
    g.setLineDash([]);
  }
  // A snap line while dragging.
  if (drag?.snapLine !== undefined) {
    g.strokeStyle = k.cyan;
    g.beginPath();
    g.moveTo(Math.round(x(drag.snapLine)) + 0.5, Ruler);
    g.lineTo(Math.round(x(drag.snapLine)) + 0.5, h);
    g.stroke();
  }
  const px = Math.round(x(playhead)) + 0.5;
  if (px >= 0 && px <= w) {
    g.strokeStyle = k.accent;
    g.fillStyle = k.accent;
    g.beginPath();
    g.moveTo(px, 0);
    g.lineTo(px, h);
    g.stroke();
    g.beginPath();
    g.moveTo(px - 5, 0);
    g.lineTo(px + 5, 0);
    g.lineTo(px, 7);
    g.fill();
  }
  $("time").textContent = `${fmt(playhead)}  ·  ${Math.round(playhead * (doc?.fps ?? 30))}f`;
}

/** The tracks as drawn: the document's, or the drag's preview of them. */
const shown = (): Track[] => (drag?.preview ?? doc)?.tracks ?? [];

// ---- lane heads ----------------------------------------------------------------------------------

/** Who an actor is, in a few words. */
function actorLabel(a: Actor): string {
  if (a.player) return a.player === "wa" ? "V, feminine body" : "V, masculine body";
  return a.name ?? a.record ?? "";
}

/** A rig's short name: `woman_base` for `...\woman_base.rig`. */
function rigName(rig: string): string {
  return (rig.replace(/\//g, "\\").split("\\").pop() ?? "").replace(/\.rig$/i, "");
}

let told = "";
/** Tells the host the selected track and the playhead, when either changed. */
function tellCursor() {
  const now = `${selTrack}@${playhead.toFixed(4)}`;
  if (!doc || now === told) return;
  told = now;
  vscode.postMessage({ type: "cursor", track: selTrack, playhead });
}
setInterval(tellCursor, 250);

function drawHeads() {
  const list = $("headList");
  list.textContent = "";
  for (const t of doc?.tracks ?? []) {
    const row = document.createElement("div");
    row.className = `head kind-${t.kind}${t.id === selTrack ? " sel" : ""}${t.mute ? " muted" : ""}`;
    row.dataset.id = t.id;
    row.title = `${TrackKindNames[t.kind]} track. Drag up or down to reorder`;
    const tag = document.createElement("span");
    tag.className = "tag";
    // An actor track says who acts on it.
    tag.textContent = t.kind === "actor" ? `${TrackKindNames[t.kind]} · ${t.actor ? actorLabel(t.actor) : "nobody yet"}` : TrackKindNames[t.kind];
    const name = document.createElement("span");
    name.className = "tname";
    name.textContent = t.name;
    const mute = flag("M", !!t.mute, t.mute ? "Muted: left out of play. Click to put it back" : "Mute: leave this track out of play", () => change((d) => setTrack(d, t.id, { mute: !t.mute })));
    const lock = flag("L", !!t.lock, t.lock ? "Locked: its clips cannot change. Click to unlock" : "Lock: keep this track's clips from changing", () => change((d) => setTrack(d, t.id, { lock: !t.lock })));
    const text = document.createElement("span");
    text.className = "text";
    text.append(name, tag);
    // A sequence's one lane has no mute or lock: the file keeps only its clips.
    if (seqMode) row.append(text);
    else row.append(text, mute, lock);
    list.append(row);
  }
}

function flag(label: string, on: boolean, title: string, click: () => void) {
  const b = document.createElement("button");
  b.className = `flag${on ? " on" : ""}`;
  b.textContent = label;
  b.title = title;
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    click();
  });
  return b;
}

// Reorder lanes by dragging a head up or down; a click selects the track.
$("headList").addEventListener("mousedown", (ev) => {
  const row = (ev.target as HTMLElement).closest<HTMLElement>(".head");
  if (!row || (ev.target as HTMLElement).closest("button") || !doc) return;
  const id = row.dataset.id!;
  selectTrack(id);
  const list = $("headList");
  const line = $("dropLine");
  const startY = ev.clientY;
  let to = -1;
  const move = (e: MouseEvent) => {
    if (Math.abs(e.clientY - startY) < 4 && to < 0) return;
    const top = list.getBoundingClientRect().top;
    to = Math.max(0, Math.min(doc!.tracks.length, Math.round((e.clientY - top) / Lane)));
    line.hidden = false;
    line.style.top = `${Ruler + to * Lane}px`;
  };
  const up = () => {
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
    line.hidden = true;
    if (to < 0 || !doc) return;
    const from = doc.tracks.findIndex((t) => t.id === id);
    // Dropped below itself: its own leaving moves the rest up one.
    const index = to > from ? to - 1 : to;
    if (index !== from) change((d) => moveTrack(d, id, index));
  };
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
});

$("headList").addEventListener("dblclick", (ev) => {
  if ((ev.target as HTMLElement).closest(".head")) $<HTMLInputElement>("f-name")?.select();
});

// ---- inspector -----------------------------------------------------------------------------------

function field(label: string, input: HTMLElement) {
  const l = document.createElement("label");
  l.className = "field";
  const s = document.createElement("span");
  s.textContent = label;
  l.append(s, input);
  return l;
}

function textInput(id: string, value: string, done: (v: string) => void) {
  const i = document.createElement("input");
  i.type = "text";
  i.id = id;
  i.value = value;
  i.spellcheck = false;
  i.addEventListener("change", () => done(i.value));
  i.addEventListener("keydown", (e) => {
    if (e.key === "Enter") i.blur();
    if (e.key === "Escape") {
      i.value = value;
      i.blur();
    }
    e.stopPropagation();
  });
  return i;
}

function numberInput(id: string, value: number, step: number, done: (v: number) => void) {
  const i = document.createElement("input");
  i.type = "number";
  i.id = id;
  i.value = String(Number(value.toFixed(3)));
  i.step = String(step);
  i.min = "0";
  i.addEventListener("change", () => {
    const v = Number(i.value);
    if (Number.isFinite(v)) done(v);
    else i.value = String(value);
  });
  i.addEventListener("keydown", (e) => {
    if (e.key === "Enter") i.blur();
    e.stopPropagation();
  });
  return i;
}

function fact(label: string, value: string, title?: string) {
  const p = document.createElement("p");
  p.className = "fact";
  if (title) p.title = title;
  const s = document.createElement("span");
  s.textContent = label;
  p.append(s, value);
  return p;
}

function heading(text: string) {
  const h = document.createElement("h2");
  h.textContent = text;
  return h;
}

function action(label: string, title: string, click: () => void) {
  const b = document.createElement("button");
  b.textContent = label;
  b.title = title;
  b.addEventListener("click", click);
  return b;
}

function drawInspector() {
  const box = $("inspector");
  // Typing in a field is not thrown away by a redraw the field's own change caused.
  const focus = document.activeElement?.id;
  box.textContent = "";
  if (!doc) return;
  // During a drag the fields follow the clip as it would land.
  const d = drag?.preview ?? doc;
  const fps = d.fps;
  if (sel.size === 1) {
    const found = findClip(d, [...sel][0]);
    if (!found) return;
    const { clip, track } = found;
    const play = playOf(clip);
    box.append(
      heading(clip.kind === "transition" ? "Transition" : clip.kind === "sequence" ? "Sequence block" : "Clip"),
      field("Name", textInput("f-name", clip.name ?? "", (v) => change((x) => renameClip(x, clip.id, v)))),
      field("Start (s)", numberInput("f-start", clip.start, frame(d), (v) => change((x) => moveClips(x, [clip.id], toFrame(x, v) - clip.start)))),
      ...(play
        ? [
            fact("Length", `${Number(clip.length.toFixed(3))} s`),
            field("In (s)", numberInput("f-in", play.in, frame(d), (v) => change((x) => setPlay(x, clip.id, { in: v })))),
            field("Out (s)", numberInput("f-out", play.out, frame(d), (v) => change((x) => setPlay(x, clip.id, { out: v })))),
            field("Speed", numberInput("f-speed", play.speed, 0.05, (v) => change((x) => setPlay(x, clip.id, { speed: v })))),
            field("Loops", numberInput("f-loops", play.loops, 1, (v) => change((x) => setPlay(x, clip.id, { loops: Math.round(v) })))),
          ]
        : clip.kind === "sequence"
          ? [fact("Length", `${Number(clip.length.toFixed(3))} s`)]
          : [field("Length (s)", numberInput("f-length", clip.length, frame(d), (v) => change((x) => trimClip(x, clip.id, "end", toFrame(x, clip.start + v)))))]),
      fact("Frames", `${Math.round(clip.start * fps)} to ${Math.round(clipEnd(clip) * fps)} (${Math.round(clip.length * fps)})`),
      fact("Track", `${track.name}${track.lock ? " (locked)" : ""}`),
    );
    if (play) {
      box.append(
        fact("Animation", play.anim.name),
        fact("From", play.anim.set ? (play.anim.set.split("\\").pop() ?? play.anim.set) : "A made animation", play.anim.set),
        fact("Its length", `${Number(play.anim.seconds.toFixed(3))} s`),
        fact("Its rig", play.anim.rig ? rigName(play.anim.rig) : "Not known"),
      );
      const why = unfit(track, clip);
      if (why) box.append(note(`Unfit: ${why}. It stays on the track, and will not play on this actor.`));
    } else if (clip.kind === "anim") box.append(note("A named block with no animation yet. Add one from the Animations view with Add to Track."));
    const seq = seqOf(clip);
    if (clip.kind === "sequence" && seq) {
      const state = links[clip.id] ?? "linked";
      box.append(
        fact("Sequence", seq.name || "No name"),
        fact("Clips", String(seq.clips.filter((c) => c.kind !== "transition").length)),
        fact("Its rig", seq.rig ? rigName(seq.rig) : "Not known"),
        note(
          state === "missing"
            ? "The sequence is not on this PC's Desk. The block plays the copy the scene keeps."
            : state === "blocked"
              ? "The sequence on the Desk has changed, and its new length does not fit here. The block plays its older copy. Make room, then open the scene again."
              : state === "newer"
                ? "The sequence on the Desk has changed since this copy was taken. The block plays its older copy until the scene is opened again or the sequence is saved."
              : "Linked to the sequence on the Desk: a change saved there shows here. The scene keeps a copy, so it opens without it.",
        ),
      );
      const why = unfit(track, clip);
      if (why) box.append(note(`Unfit: ${why}. It stays on the track, and will not play on this actor.`));
      box.append(
        action("Open Sequence", "Open the sequence in its own tab (or double-click the block)", () => vscode.postMessage({ type: "openSeq", id: seq.id })),
        action("Unpack", "Turn the block into its clips and transitions on this lane, with no link to the sequence", () => {
          const made = attempt((x) => unpackSeq(x, clip.id));
          if (!made) return;
          sel = new Set(made.ids);
          commit(made.doc);
        }),
      );
    }
    if (clip.kind === "transition") {
      const now = transitionOf(clip);
      const { a, b } = joinOf(track, clip);
      const said = transitionNote(track, clip);
      box.append(
        field(
          "Method",
          choice("f-method", now.method, [["blend", "Blend"], ["inertial", "Inertial"], ["ai", "AI (no provider yet)", true]], (v) => change((x) => setTransition(x, clip.id, { method: v }))),
        ),
        field(
          "Ease",
          choice("f-ease", now.ease, [["smooth", "Smooth"], ["linear", "Linear"], ["in", "Ease in"], ["out", "Ease out"]], (v) => change((x) => setTransition(x, clip.id, { ease: v }))),
        ),
      );
      if (a && b) box.append(fact("Joins", `${clipLabel(a)} to ${clipLabel(b)}`));
      box.append(
        note(now.method === "inertial" ? "Inertial: the second clip plays whole from its start, and the difference from the first clip's pose fades away." : now.method === "blend" ? "Blend: both clips play, mixed from the first to the second." : ""),
        note(said.text),
      );
    } else if (track.kind === "actor" && play && bareJoin(track, clip)) box.append(note("No transition leads into this clip: the preview cuts here. The game will blend it briefly by itself."));
    // D5b: what the game will not play as the preview shows it. The cut at a bare join is said above.
    if (track.kind === "actor") {
      const said = notesFor(cuesOf(d).notes, track, clip).filter((n) => n.kind !== "cut");
      if (said.length) {
        box.append(heading("In the game"));
        for (const n of said) {
          const p = note(n.text);
          p.classList.add("game");
          p.dataset.kind = n.kind;
          box.append(p);
        }
      }
    }
  } else if (sel.size > 1) {
    box.append(heading(`${sel.size} clips`), note("Drag them together, or copy, cut and delete them."));
  } else {
    const track = findTrack(d, selTrack);
    if (track) {
      if (seqMode) {
        const rig = track.actor?.rig;
        box.append(
          heading("Sequence"),
          fact("Clips", String(track.clips.filter((c) => c.kind !== "transition").length)),
          fact("Rig", rig ? rigName(rig) : "Not known"),
          note("A run of clips and transitions for one rig. The body is the game's base body for the rig. Add to Track on the Desk puts the sequence on an actor's track in a scene, as one block."),
        );
      } else
        box.append(
          heading(`${TrackKindNames[track.kind]} track`),
          field("Name", textInput("f-name", track.name, (v) => change((x) => setTrack(x, track.id, { name: v })))),
          fact("Clips", String(track.clips.length)),
        );
      if (track.kind === "actor" && !seqMode) {
        const a = track.actor;
        if (a) {
          box.append(fact("Actor", actorLabel(a)));
          if (a.record) box.append(fact("Record", a.record));
          if (a.record) box.append(fact("Appearance", a.appearance ?? "Any: the game picks"));
          box.append(fact("Rig", a.rig ? rigName(a.rig) : "Not read yet"));
          if (a.player) box.append(note("In the game this is your own V. The preview shows the game's base body, without a head."));
          // The mark: where the actor stands in the scene, and which way it faces.
          const mark = markOf(d, track.id);
          const markInput = (id: string, key: "x" | "y" | "yaw", step: number) => {
            const i = numberInput(id, mark[key], step, (v) => change((x) => setMark(x, track.id, { [key]: v })));
            i.removeAttribute("min");
            return i;
          };
          box.append(
            field("Right (m)", markInput("f-markx", "x", 0.1)),
            field("Forward (m)", markInput("f-marky", "y", 0.1)),
            field("Turn (°)", markInput("f-markyaw", "yaw", 15)),
          );
        } else box.append(note("Nobody acts on this track yet."));
        box.append(action(a ? "Change Actor..." : "Choose Actor...", "Pick one of the game's characters, or V, for this track. Its clips stay", () => vscode.postMessage({ type: "chooseActor", track: track.id })));
      }
      if (!seqMode) box.append(
        action("Remove Track", "Take this track and its clips out of the scene. Undo brings it back", () => {
          sel = new Set();
          change((x) => removeTrack(x, track.id));
        }),
      );
      if (track.kind === "ai") box.append(note("What an AI track does is not decided yet. It holds named blocks for now."));
    }
    box.append(
      heading(seqMode ? "The file" : "Scene"),
      // A sequence is named by its item on the Desk: Rename there.
      seqMode ? fact("Name", d.name) : field("Name", textInput("f-scene", d.name, (v) => commit({ ...d, name: v.trim() }))),
      fact("Length", `${fmt(sceneLength(d))}  ·  ${Math.round(sceneLength(d) * fps)} frames`),
      fact("Frame rate", `${fps} a second`),
    );
  }
  if (focus) document.getElementById(focus)?.focus();
}

/** Whether a clip follows another with no transition over its start. */
function bareJoin(track: Track, clip: Clip): boolean {
  if (!track.clips.some((c) => c.kind === "anim" && c.start < clip.start - 1e-6)) return false;
  return !track.clips.some((c) => c.kind === "transition" && joinOf(track, c).b?.id === clip.id);
}

/** A drop-down list; an entry marked off cannot be chosen. */
function choice(id: string, value: string, options: [value: string, label: string, off?: boolean][], done: (v: string) => void) {
  const s = document.createElement("select");
  s.id = id;
  for (const [v, label, off] of options) {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = label;
    o.disabled = !!off;
    o.selected = v === value;
    s.append(o);
  }
  s.addEventListener("change", () => done(s.value));
  s.addEventListener("keydown", (e) => e.stopPropagation());
  return s;
}

function note(text: string) {
  const p = document.createElement("p");
  p.className = "dim note";
  p.textContent = text;
  return p;
}

function render() {
  if (!doc) return;
  $("title").textContent = doc.name || "Scene";
  const clips = doc.tracks.reduce((n, t) => n + t.clips.length, 0);
  $("meta").textContent = `${doc.tracks.length} track${doc.tracks.length === 1 ? "" : "s"}  ·  ${clips} clip${clips === 1 ? "" : "s"}  ·  ${fmt(sceneLength(doc), 2)}`;
  const track = findTrack(doc, selTrack);
  const one = sel.size === 1 ? findClip(doc, [...sel][0]) : undefined;
  $<HTMLButtonElement>("addClip").disabled = !track;
  $("addTransition").hidden = track?.kind !== "actor";
  $<HTMLButtonElement>("split").disabled = !one || one.clip.kind === "transition" || one.clip.kind === "sequence";
  $("addTrack").hidden = seqMode;
  $("saveSeq").hidden = seqMode || track?.kind !== "actor";
  $<HTMLButtonElement>("saveSeq").disabled = ![...sel].some((id) => findClip(doc!, id)?.clip.kind === "anim");
  $<HTMLButtonElement>("remove").disabled = !sel.size;
  $("snap").classList.toggle("on", snapOn);
  $("loop").classList.toggle("on", looping);
  $("play").classList.toggle("on", playing);
  drawHeads();
  drawInspector();
  draw();
}

function selectTrack(id: string) {
  if (selTrack === id && !sel.size) return;
  selTrack = id;
  sel = new Set();
  render();
}

// ---- the view ------------------------------------------------------------------------------------

const MinSpp = 1 / 30 / 40; // a frame is 40 px wide at most
const MaxSpp = 2;

function clampView() {
  spp = Math.min(Math.max(spp, MinSpp), MaxSpp);
  viewStart = Math.max(-20 * spp, viewStart);
}

function fit() {
  const length = Math.max(doc ? sceneLength(doc) : 0, 5);
  spp = (length * 1.1) / width();
  viewStart = -20 * spp;
  fitted = true;
  clampView();
  keepView();
  draw();
}

function zoom(factor: number, atPx = width() / 2) {
  const t = timeAt(atPx);
  spp *= factor;
  clampView();
  viewStart = t - atPx * spp;
  clampView();
  keepView();
  draw();
}

wrap.addEventListener(
  "wheel",
  (ev) => {
    if (ev.ctrlKey || ev.metaKey) {
      ev.preventDefault();
      zoom(ev.deltaY > 0 ? 1.2 : 1 / 1.2, ev.offsetX);
    } else if (ev.shiftKey || Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) {
      ev.preventDefault();
      viewStart += (ev.shiftKey ? ev.deltaY : ev.deltaX) * spp;
      clampView();
      keepView();
      draw();
    }
    // A plain wheel scrolls the lanes up and down, as the browser does.
  },
  { passive: false },
);

$("zoomIn").addEventListener("click", () => zoom(1 / 1.4));
$("zoomOut").addEventListener("click", () => zoom(1.4));
$("fit").addEventListener("click", fit);
$("snap").addEventListener("click", () => {
  snapOn = !snapOn;
  keepView();
  render();
});
new ResizeObserver(() => draw()).observe(wrap);

// The preview's height: the splitter between it and the timeline.
const viewport = $("viewport");
if (saved?.preview) viewport.style.height = `${saved.preview}px`;
$("splitter").addEventListener("mousedown", (ev) => {
  ev.preventDefault();
  const startY = ev.clientY;
  const startH = viewport.offsetHeight;
  const move = (e: MouseEvent) => {
    viewport.style.height = `${Math.max(28, Math.min(window.innerHeight - 130, startH + e.clientY - startY))}px`;
    draw();
  };
  const up = () => {
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
    keepView();
  };
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
});

// ---- the mouse in the lanes ----------------------------------------------------------------------

interface Hit {
  track: Track;
  lane: number;
  clip?: Clip;
  edge?: "start" | "end";
}

function hit(px: number, py: number): Hit | undefined {
  if (!doc || py < Ruler) return undefined;
  const lane = Math.floor((py - Ruler) / Lane);
  const track = doc.tracks[lane];
  if (!track) return undefined;
  // Transitions are on top, so they are found first.
  const ordered = [...track.clips].sort((a, b) => Number(b.kind === "transition") - Number(a.kind === "transition"));
  for (const clip of ordered) {
    const b = box(clip, lane);
    if (px < b.x - 2 || px > b.x + b.w + 2 || py < b.y || py > b.y + b.h) continue;
    const grip = Math.min(Grip, b.w / 3);
    const edge = px <= b.x + grip ? "start" : px >= b.x + b.w - grip ? "end" : undefined;
    return { track, lane, clip, edge };
  }
  return { track, lane };
}

interface Drag {
  kind: "scrub" | "move" | "trim";
  base: SceneDoc;
  /** The document as it would be if the mouse were let go now. */
  preview?: SceneDoc;
  snapLine?: number;
}
let drag: Drag | null = null;

/** The pointer's position in the canvas. */
function at(ev: MouseEvent) {
  const r = canvas.getBoundingClientRect();
  return { px: ev.clientX - r.left, py: ev.clientY - r.top };
}

canvas.addEventListener("mousemove", (ev) => {
  if (drag) return;
  const { px, py } = at(ev);
  const h = hit(px, py);
  canvas.style.cursor = py < Ruler ? "col-resize" : h?.clip ? (h.track.lock ? "not-allowed" : h.edge ? "ew-resize" : "grab") : "default";
});

canvas.addEventListener("mousedown", (ev) => {
  if (!doc || ev.button !== 0) return;
  canvas.focus();
  const { px, py } = at(ev);
  if (py < Ruler) return scrub(ev);
  const h = hit(px, py);
  if (!h) {
    sel = new Set();
    return render();
  }
  if (!h.clip) {
    selTrack = h.track.id;
    sel = new Set();
    render();
    return scrub(ev);
  }
  const id = h.clip.id;
  if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {
    if (sel.has(id)) sel.delete(id);
    else sel.add(id);
    selTrack = h.track.id;
    return render();
  }
  if (!sel.has(id)) sel = new Set([id]);
  selTrack = h.track.id;
  render();
  if (h.track.lock) return say(`The track "${h.track.name}" is locked`, true);
  if (h.edge && sel.size === 1) trimDrag(ev, h.clip, h.edge);
  else moveDrag(ev, h.clip);
});

canvas.addEventListener("dblclick", (ev) => {
  if (!doc) return;
  const { px, py } = at(ev);
  const h = hit(px, py);
  if (!h) return;
  const block = h.clip && seqOf(h.clip);
  if (block) return vscode.postMessage({ type: "openSeq", id: block.id });
  if (h.clip) return $<HTMLInputElement>("f-name")?.select();
  // An empty place in a lane: a new clip there, a second long.
  newClip(h.track.id, timeAt(px));
});

function setPlayhead(t: number) {
  playhead = Math.max(0, doc ? toFrame(doc, t) : t);
  draw();
}

function scrub(ev: MouseEvent) {
  drag = { kind: "scrub", base: doc! };
  const move = (e: MouseEvent) => {
    const t = timeAt(at(e).px);
    setPlayhead(snapOn && !e.altKey ? snap(doc!, t, clipEdges(doc!), 6 * spp) : t);
  };
  move(ev);
  during(move, () => {});
}

/** Follows the mouse until it is let go, then commits the drag's preview. */
function during(move: (e: MouseEvent) => void, done: () => void) {
  const up = () => {
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
    const result = drag?.preview;
    drag = null;
    done();
    if (result) commit(result);
    else render();
  };
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
}

/** The edges a dragged clip snaps to: the other clips' and the playhead. */
function snapEdges(base: SceneDoc, moving: Iterable<string>) {
  return [...clipEdges(base, moving), playhead];
}

function moveDrag(ev: MouseEvent, grabbed: Clip) {
  const base = doc!;
  const ids = [...sel];
  const start = at(ev);
  const edges = snapEdges(base, ids);
  const from = findClip(base, grabbed.id)!.track;
  const oneTrack = ids.every((id) => findClip(base, id)?.track.id === from.id);
  let moved = false;
  drag = { kind: "move", base };
  canvas.style.cursor = "grabbing";
  const move = (e: MouseEvent) => {
    const p = at(e);
    if (!moved && Math.abs(p.px - start.px) < 3 && Math.abs(p.py - start.py) < 3) return;
    moved = true;
    let to = grabbed.start + (p.px - start.px) * spp;
    let line: number | undefined;
    if (snapOn && !e.altKey) {
      // The start edge first, then the end edge: whichever is nearer an edge wins.
      const reach = 8 * spp;
      const s = snap(base, to, edges, reach);
      const en = snap(base, to + grabbed.length, edges, reach);
      const sNear = edges.includes(s) ? Math.abs(s - to) : Infinity;
      const eNear = edges.includes(en) ? Math.abs(en - (to + grabbed.length)) : Infinity;
      if (sNear <= eNear && sNear < Infinity) [to, line] = [s, s];
      else if (eNear < Infinity) [to, line] = [en - grabbed.length, en];
      else to = toFrame(base, to);
    } else to = toFrame(base, to);
    const first = Math.min(...ids.map((id) => findClip(base, id)!.clip.start));
    const delta = Math.max(to - grabbed.start, -first);
    const lane = Math.floor((p.py - Ruler) / Lane);
    const over = base.tracks[lane];
    const target = oneTrack && over && over.id !== from.id && over.kind === from.kind && !over.lock ? over.id : undefined;
    try {
      drag!.preview = moveClips(base, ids, delta, target);
      drag!.snapLine = line;
    } catch (err) {
      if (!(err instanceof EditError)) throw err;
      // In the way: the clips stay where they last fitted.
      drag!.snapLine = undefined;
    }
    draw();
    drawInspector();
  };
  during(move, () => (canvas.style.cursor = "default"));
}

function trimDrag(ev: MouseEvent, clip: Clip, edge: "start" | "end") {
  const base = doc!;
  const edges = snapEdges(base, [clip.id]);
  drag = { kind: "trim", base };
  const move = (e: MouseEvent) => {
    const raw = timeAt(at(e).px);
    const t = snapOn && !e.altKey ? snap(base, raw, edges, 8 * spp) : toFrame(base, raw);
    try {
      drag!.preview = trimClip(base, clip.id, edge, t);
      drag!.snapLine = edges.includes(t) ? t : undefined;
    } catch (err) {
      if (!(err instanceof EditError)) throw err;
      // Refused (a looping clip's start, say): the clip stays, and the reason shows.
      drag!.snapLine = undefined;
      say(err.message, true);
    }
    draw();
    drawInspector();
  };
  during(move, () => {});
}

// ---- commands ------------------------------------------------------------------------------------

function newClip(trackId: string, at: number, kind?: "transition") {
  const made = attempt((d) => addClip(d, trackId, { start: Math.max(0, at), length: kind ? 0.4 : 1, kind }));
  if (!made) return;
  sel = new Set([made.id]);
  selTrack = trackId;
  commit(made.doc);
}

$("addClip").addEventListener("click", () => selTrack && newClip(selTrack, playhead));
$("saveSeq").addEventListener("click", () => sel.size && vscode.postMessage({ type: "saveSeq", clips: [...sel] }));
$("addTransition").addEventListener("click", () => {
  if (!selTrack) return;
  const made = attempt((d) => addTransition(d, selTrack, playhead));
  if (!made) return;
  sel = new Set([made.id]);
  commit(made.doc);
});

function splitSelected() {
  if (sel.size !== 1) return;
  const made = attempt((d) => splitClip(d, [...sel][0], playhead));
  if (made) commit(made.doc);
}
$("split").addEventListener("click", splitSelected);

function removeSelected() {
  if (!sel.size) return;
  const ids = [...sel];
  const next = attempt((d) => removeClips(d, ids));
  if (!next) return;
  sel = new Set();
  commit(next);
}
$("remove").addEventListener("click", removeSelected);

function copySelected(): boolean {
  if (!doc || !sel.size) return false;
  const found = [...sel].map((id) => findClip(doc!, id)!).filter(Boolean);
  const kinds = new Set(found.map((f) => f.track.kind));
  if (kinds.size > 1) {
    say("Clips from tracks of different kinds cannot be copied together", true);
    return false;
  }
  vscode.setState({ ...(vscode.getState() ?? {}), clipboard: { kind: found[0].track.kind, clips: found.map((f) => f.clip) } });
  say(`${found.length} clip${found.length === 1 ? "" : "s"} copied`);
  return true;
}

function paste() {
  const held = vscode.getState()?.clipboard;
  if (!doc || !held) return;
  // Onto the selected track when it is of the clips' kind, else the first track that is.
  const target = findTrack(doc, selTrack)?.kind === held.kind ? findTrack(doc, selTrack) : doc.tracks.find((t) => t.kind === held.kind && !t.lock);
  if (!target) return say(`There is no ${TrackKindNames[held.kind].toLowerCase()} track to paste onto`, true);
  const made = attempt((d) => pasteClips(d, target.id, held.clips, playhead));
  if (!made) return;
  sel = new Set(made.ids);
  selTrack = target.id;
  commit(made.doc);
}

// Add Track: a menu of the kinds.
const menu = $("kindMenu");
for (const kind of TrackKinds) {
  const b = document.createElement("button");
  b.textContent = TrackKindNames[kind];
  b.className = `kind-${kind}`;
  b.addEventListener("click", () => {
    menu.hidden = true;
    const next = attempt((d) => addTrack(d, kind));
    if (!next) return;
    selTrack = next.tracks[next.tracks.length - 1].id;
    sel = new Set();
    commit(next);
  });
  menu.append(b);
}
$("addTrack").addEventListener("click", (ev) => {
  ev.stopPropagation();
  const r = $("addTrack").getBoundingClientRect();
  menu.style.left = `${r.left}px`;
  menu.style.top = `${r.bottom + 2}px`;
  menu.hidden = !menu.hidden;
});
document.addEventListener("click", () => (menu.hidden = true));
$("openText").addEventListener("click", () => send({ type: "openText" }));

// ---- transport -----------------------------------------------------------------------------------

function tick(now: number) {
  if (!playing || !doc) return;
  const end = sceneLength(doc);
  playhead += (now - lastTick) / 1000;
  lastTick = now;
  if (playhead >= end) {
    if (looping && end > 0) playhead = 0;
    else {
      playhead = end;
      playing = false;
      render();
      return;
    }
  }
  // Keep the playhead in view.
  if (x(playhead) > width() - 30 || x(playhead) < 0) {
    viewStart = playhead - 40 * spp;
    clampView();
  }
  draw();
  requestAnimationFrame(tick);
}

function play() {
  if (!doc || playing) return;
  const end = sceneLength(doc);
  if (end <= 0) return say("The scene has no clips to play yet", true);
  if (playhead >= end - 1e-6) playhead = 0;
  playFrom = playhead;
  playing = true;
  lastTick = performance.now();
  render();
  requestAnimationFrame(tick);
}

function stopPlay(back = false) {
  const was = playing;
  playing = false;
  if (back) playhead = was ? playFrom : 0;
  if (doc) {
    playhead = toFrame(doc, playhead);
    render();
  }
}

/** The playhead to the clip edge before or after it. */
function toEdge(dir: -1 | 1) {
  if (!doc) return;
  const edges = clipEdges(doc);
  const next = dir > 0 ? edges.find((e) => e > playhead + 1e-6) : [...edges].reverse().find((e) => e < playhead - 1e-6);
  if (next === undefined) return;
  playhead = next;
  if (x(playhead) > width() - 10 || x(playhead) < 0) {
    viewStart = playhead - (width() / 2) * spp;
    clampView();
  }
  draw();
}

$("play").addEventListener("click", () => (playing ? stopPlay() : play()));
$("stop").addEventListener("click", () => stopPlay(true));
$("prev").addEventListener("click", () => toEdge(-1));
$("next").addEventListener("click", () => toEdge(1));
$("loop").addEventListener("click", () => {
  looping = !looping;
  keepView();
  render();
});

// ---- keys ----------------------------------------------------------------------------------------

document.addEventListener("keydown", (ev) => {
  if (!doc || (ev.target instanceof Element && ev.target.closest("input, textarea, select"))) return;
  const mod = ev.ctrlKey || ev.metaKey;
  const key = ev.key.toLowerCase();
  const done = () => ev.preventDefault();
  if (key === " ") return done(), playing ? stopPlay() : play();
  if (key === "delete" || key === "backspace") return done(), removeSelected();
  if (key === "s" && !mod) return done(), splitSelected();
  if (key === "home") return done(), setPlayhead(0);
  if (key === "end") return done(), setPlayhead(sceneLength(doc));
  if (key === "arrowleft" || key === "arrowright") {
    done();
    const step = (ev.shiftKey ? 10 : 1) * frame(doc) * (key === "arrowleft" ? -1 : 1);
    return mod ? toEdge(key === "arrowleft" ? -1 : 1) : setPlayhead(playhead + step);
  }
  if (key === "escape") {
    sel = new Set();
    return render();
  }
  if (mod && key === "a") {
    done();
    sel = new Set(doc.tracks.flatMap((t) => t.clips.map((c) => c.id)));
    return render();
  }
  if (mod && key === "c") return done(), void copySelected();
  if (mod && key === "x") return done(), void (copySelected() && removeSelected());
  if (mod && key === "v") return done(), paste();
  if (mod && key === "d") {
    done();
    if (copySelected()) paste();
    return;
  }
  if (key === "+" || key === "=") return zoom(1 / 1.4);
  if (key === "-") return zoom(1.4);
});

send({ type: "ready" });
