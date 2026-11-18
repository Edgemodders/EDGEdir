// The scene editor: a custom text editor over a `.edgedir` file. The file stays JSON text, so save,
// undo, redo and the dirty mark are VS Code's own. The page (webview/editor.ts) draws the timeline
// and posts each change back as a whole new document, which is written into the text here.
// The pattern is EDGEwave's (src/editor.ts at f39a787), copied, without its audio.
import type { Stage } from "./set";
import * as fs from "node:fs";
import * as vscode from "vscode";
import type { PreviewFile } from "./core/preview";
import type { SceneDoc } from "./doc";
import { isSeqFile, readScene, writeScene } from "./seq";
import type { BodyWant, ClipWant } from "./pose";

/** Where the 3D preview's files come from: the game, through the extension. */
export interface PreviewSource {
  /** The one folder outside the extension the page may read. */
  root: string;
  body(want: BodyWant): Promise<PreviewFile>;
  clip(want: ClipWant): Promise<PreviewFile>;
}

export const ViewType = "edgedir.scene";

/** What the page sends. */
type FromPage =
  | { type: "ready" }
  | { type: "edit"; doc: SceneDoc }
  /** Unsaved edits a window reload lost were put back. */
  | { type: "restored" }
  | { type: "openText" }
  /** Choose who acts on an actor track (D2): the host shows the picker and writes the change. */
  | { type: "chooseActor"; track: string }
  /** The selected track and the playhead, when either changes: where Add to Track puts a clip. */
  | { type: "cursor"; track: string; playhead: number }
  /** The 3D preview asks for a body or an animation (D3); the answer is `got`, with the same key. */
  | { type: "want"; key: string; body?: BodyWant; clip?: ClipWant }
  /** Save the clips named as a sequence on the Desk; open a block's sequence (D4b). */
  | { type: "saveSeq"; clips: string[] }
  | { type: "openSeq"; id: string }
  /** The scene's set (D5a): choose one, take it off, or add tracks for its people. */
  | { type: "set"; do: "choose" | "remove" | "add" }
  /** Play in game, and Stop in game (D5d). */
  | { type: "game"; do: "play" | "stop" }
  /** The scene's pins (DR3): choose a pin file. */
  | { type: "pins"; do: "choose" };

/** A scene open in the editor, with where its page's cursor is. */
/** What the editor asks of the Desk's sequences (D4b). */
export interface SequenceHost {
  /** How each sequence a scene links stands: `linked`, `missing` from the Desk, or `newer` there than the scene's copy. */
  states(doc: SceneDoc): Record<string, string>;
  /** Brings a scene's linked blocks up to the sequences on the Desk. */
  sync(document: vscode.TextDocument): Promise<void>;
  /** Saves clips of a scene as a new sequence on the Desk. */
  saveAs(document: vscode.TextDocument, clipIds: string[]): Promise<void>;
  /** Opens a sequence by its id. */
  open(id: string): Promise<void>;
}

/** What the editor asks about a scene's set, an EDGEbuilder scene it plays on (D5a). */
export interface SetHost {
  /** How a scene stands to its set, read from disk now; undefined when it has none. */
  stage(doc: SceneDoc): Stage | undefined;
  /** Brings a scene up to its set: marks, the link's name and hash. */
  sync(document: vscode.TextDocument): Promise<void>;
  choose(document: vscode.TextDocument): Promise<void>;
  remove(document: vscode.TextDocument): Promise<void>;
  addPeople(document: vscode.TextDocument): Promise<void>;
}

/** The game's weathers, for a weather clip's list (D6a). */
export interface WeatherHost {
  /** The presets read so far: empty until `load` has answered. */
  list(): string[];
  /** Reads them from the game's files, once. True when the list changed. */
  load(): Promise<boolean>;
}

/** What the editor asks about a scene's pins, named places from a pin file (DR3). */
export interface PinsHost {
  /** Brings a scene up to its pin file, when the file's pins are not the ones it last read. */
  sync(document: vscode.TextDocument): Promise<void>;
  choose(document: vscode.TextDocument): Promise<void>;
  /** The scene's pin file on this PC, to watch; undefined when it has none. */
  file(document: vscode.TextDocument): string | undefined;
}

/** What the page is told of a play in the game: one line, whether a play is on, and when the scene started on this PC's clock. */
export interface PlayNews {
  text: string;
  bad: boolean;
  active: boolean;
  startedAt?: number;
  length?: number;
}

/** What the editor asks of the player in the game (D5d). */
export interface PlayHost {
  /** Plays the scene in the game from its start; `tell` hears how it goes. */
  play(document: vscode.TextDocument, tell: (news: PlayNews) => void): Promise<void>;
  stop(): Promise<void>;
}

/** The scene a text document holds: a scene's own text, or a sequence shown as one lane. Throws when it is neither. */
export const sceneIn = (document: vscode.TextDocument): SceneDoc => readScene(document.uri.path, document.getText());

export interface OpenScene {
  document: vscode.TextDocument;
  track: string;
  playhead: number;
}

/** Changes a scene document's text with one of src/doc.ts's edits. Undo takes it back as one step. */
export async function applyEdit(document: vscode.TextDocument, change: (doc: SceneDoc) => SceneDoc): Promise<void> {
  const text = writeScene(document.uri.path, change(sceneIn(document)), document.getText());
  if (text === document.getText()) return;
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), text);
  await vscode.workspace.applyEdit(edit);
}

export class SceneEditorProvider implements vscode.CustomTextEditorProvider {
  private readonly scenes = new Map<vscode.WebviewPanel, OpenScene>();
  private last: vscode.WebviewPanel | undefined;
  private readonly moved = new vscode.EventEmitter<void>();
  /** The scene in front, its selected track or its playhead changed. */
  readonly onDidChangeCurrent = this.moved.event;

  /** Selects a clip on a scene's pages, as a click on it would. */
  select(document: vscode.TextDocument, clipId: string): void {
    for (const [panel, scene] of this.scenes) if (scene.document === document) void panel.webview.postMessage({ type: "select", clip: clipId });
  }

  /** The scene in front, or the one that was last when another kind of editor or a view has the focus. */
  current(): OpenScene | undefined {
    const front = [...this.scenes.keys()].find((p) => p.active) ?? this.last;
    return front ? this.scenes.get(front) : undefined;
  }

  constructor(
    private readonly context: vscode.ExtensionContext,
    /** Called with each scene opened: the Desk's Recent. */
    private readonly opened: (uri: vscode.Uri) => void,
    /** Shows the actor picker for a track and writes the choice into the document. */
    private readonly chooseActor: (document: vscode.TextDocument, trackId: string) => Promise<void>,
    private readonly preview: PreviewSource,
    private readonly sequences: SequenceHost,
    private readonly sets: SetHost,
    private readonly plays: PlayHost,
    private readonly pins: PinsHost,
    private readonly weathers: WeatherHost,
  ) {}

  /** Every scene and sequence open in an editor. */
  documents(): vscode.TextDocument[] {
    return [...new Set([...this.scenes.values()].map((s) => s.document))];
  }

  /** Sends every open scene its document again: the Desk's sequences changed. */
  resend(): void {
    for (const send of this.senders.values()) send();
  }
  private readonly senders = new Map<vscode.WebviewPanel, () => void>();

  resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): void {
    this.opened(document.uri);
    const webview = panel.webview;
    const dist = vscode.Uri.joinPath(this.context.extensionUri, "dist");
    const media = vscode.Uri.joinPath(this.context.extensionUri, "media");
    // The page reads the extension's own dist and media, and the preview's folder on the PC. Nothing else.
    webview.options = { enableScripts: true, localResourceRoots: [dist, media, vscode.Uri.file(this.preview.root)] };
    webview.html = this.html(webview, dist, media);

    const post = (m: unknown) => void webview.postMessage(m);
    const scene: OpenScene = { document, track: "", playhead: 0 };
    this.scenes.set(panel, scene);
    this.last = panel;
    panel.onDidChangeViewState(() => {
      if (panel.active) this.last = panel;
      this.moved.fire();
    });

    /**
     * Sends the document, and whether it differs from the file on disk: the page keeps unsaved edits
     * across a window reload, and document.isDirty is not yet true when the change event comes.
     */
    const sendDoc = () => {
      const text = document.getText();
      try {
        let onDisk: string | undefined;
        try {
          onDisk = document.uri.scheme === "file" ? fs.readFileSync(document.uri.fsPath, "utf8") : undefined;
        } catch {
          // Not on disk (yet): unsaved.
        }
        const doc = readScene(document.uri.path, text);
        // D6a: a scene with a weather track gets the game's weathers for its list, read once.
        if (doc.tracks.some((t) => t.kind === "weather") && !this.weathers.list().length) void this.weathers.load().then((got) => got && sendDoc());
        post({ type: "doc", doc, weathers: this.weathers.list(), dirty: text !== onDisk, sequence: isSeqFile(document.uri.path), links: this.sequences.states(doc), stage: isSeqFile(document.uri.path) ? undefined : this.sets.stage(doc) });
      } catch (e) {
        post({ type: "invalid", text: (e as Error).message });
      }
    };

    const changed = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString() && e.contentChanges.length) sendDoc();
    });
    // DR3: the scene's pin file is looked at while the scene is open; a pin dropped again in the game moves what follows it.
    let watched: string | undefined;
    const onPins = () => void this.pins.sync(document);
    const watchPins = () => {
      const file = this.pins.file(document);
      if (file === watched) return;
      if (watched) fs.unwatchFile(watched, onPins);
      watched = file;
      if (file) fs.watchFile(file, { interval: 1500 }, onPins);
    };
    // Saved: the page's unsaved copy is the saved one now.
    const saved = vscode.workspace.onDidSaveTextDocument((d) => {
      if (d.uri.toString() === document.uri.toString()) sendDoc();
    });
    panel.onDidDispose(() => {
      this.scenes.delete(panel);
      this.senders.delete(panel);
      if (this.last === panel) this.last = undefined;
      this.moved.fire();
      changed.dispose();
      saved.dispose();
      if (watched) fs.unwatchFile(watched, onPins);
    });

    webview.onDidReceiveMessage(async (m: FromPage) => {
      switch (m.type) {
        case "ready":
          this.senders.set(panel, sendDoc);
          sendDoc();
          // Blocks that link a sequence take what the Desk has now, and people of the set stand where it has them now.
          await this.sequences.sync(document);
          await this.sets.sync(document);
          watchPins();
          return this.pins.sync(document);
        case "saveSeq":
          return this.sequences.saveAs(document, m.clips);
        case "openSeq":
          return this.sequences.open(m.id);
        case "set":
          return m.do === "choose" ? this.sets.choose(document) : m.do === "remove" ? this.sets.remove(document) : this.sets.addPeople(document);
        case "pins":
          await this.pins.choose(document);
          return watchPins();
        case "game":
          return m.do === "play" ? this.plays.play(document, (news) => post({ type: "game", ...news })) : this.plays.stop();
        case "edit": {
          const text = writeScene(document.uri.path, m.doc, document.getText());
          if (text === document.getText()) return;
          const edit = new vscode.WorkspaceEdit();
          edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), text);
          await vscode.workspace.applyEdit(edit);
          return;
        }
        case "restored":
          void vscode.window.showInformationMessage("EDGEdir put back this scene's unsaved changes from before the window reloaded.");
          return;
        case "openText":
          // Beside the scene, so a broken file can be fixed with the editor's message in view.
          await vscode.commands.executeCommand("vscode.openWith", document.uri, "default", vscode.ViewColumn.Beside);
          return;
        case "chooseActor":
          await this.chooseActor(document, m.track);
          return;
        case "want": {
          try {
            const found = m.body ? await this.preview.body(m.body) : m.clip ? await this.preview.clip(m.clip) : undefined;
            if (!found) return;
            post({ type: "got", key: m.key, url: webview.asWebviewUri(vscode.Uri.file(found.file)).toString(), notes: found.notes });
          } catch (e) {
            post({ type: "got", key: m.key, error: e instanceof Error ? e.message : String(e) });
          }
          return;
        }
        case "cursor": {
          const other = scene.track !== m.track;
          scene.track = m.track;
          scene.playhead = m.playhead;
          // The playhead alone changes nothing a listener shows.
          if (other) this.moved.fire();
          return;
        }
      }
    });
  }

  private html(webview: vscode.Webview, dist: vscode.Uri, media: vscode.Uri): string {
    const nonce = [...Array(32)].map(() => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 62)]).join("");
    const css = webview.asWebviewUri(vscode.Uri.joinPath(media, "editor.css"));
    const js = webview.asWebviewUri(vscode.Uri.joinPath(dist, "editor.js"));
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; connect-src ${webview.cspSource};">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${css}">
<title>EDGEdir scene</title>
</head>
<body>
${PageBody}
<script nonce="${nonce}" src="${js}"></script>
</body>
</html>`;
  }
}

const icon = (path: string) => `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">${path}</svg>`;

/** The page's markup, also used by the browser harness in tools/page-harness.html. */
export const PageBody = `<header>
  <span class="name" id="title">Scene</span>
  <span class="meta" id="meta"></span>
  <span class="spacer"></span>
  <span class="status" id="status" role="status"></span>
</header>
<section id="viewport" aria-label="Preview">
  <div id="stage"></div>
  <p id="previewNote" role="status"></p>
  <button id="frame" title="Fit the view to every actor, and ask again for anything that could not be loaded">Frame</button>
</section>
<div id="splitter" role="separator" aria-orientation="horizontal" tabindex="0" title="Drag to resize the preview"></div>
<div class="toolbar">
  <span class="transport">
    <button class="icon" id="prev" title="To the previous clip edge (Home: to the start)">${icon('<path d="M3 3h2v10H3zM13 3v10L6 8z"/>')}</button>
    <button class="icon" id="play" title="Play or stop (Space)">${icon('<path d="M4 2.5v11l9-5.5z"/>')}</button>
    <button class="icon" id="stop" title="Stop and go back to where play began">${icon('<path d="M3.5 3.5h9v9h-9z"/>')}</button>
    <button class="icon" id="next" title="To the next clip edge (End: to the end)">${icon('<path d="M11 3h2v10h-2zM3 3v10l7-5z"/>')}</button>
    <button class="icon" id="loop" title="Loop the scene">${icon('<path d="M4 4h7V2l3 3-3 3V6H5v3H4zM12 12H5v2l-3-3 3-3v2h6V7h1z"/>')}</button>
  </span>
  <button id="gamePlay" title="Play the scene in the running game, from its start, on people spawned for it. Needs REDnode and EDGEdir's player in the game">Play in Game</button>
  <span class="mono" id="time" title="The playhead: time, and frame">0:00.000</span>
  <span class="sep"></span>
  <button id="addTrack" title="Add a track to the scene">Add Track</button>
  <button id="addClip" title="Add a clip to the selected track at the playhead (or double-click a lane)">Add Clip</button>
  <button id="addTransition" title="Add a transition to the selected actor track, at the start of the clip nearest the playhead" hidden>Add Transition</button>
  <button id="split" title="Cut the selected clip in two at the playhead (S)">Split</button>
  <button id="saveSeq" title="Save the selected clips, with the transitions between them, as a sequence on the Desk" hidden>Save as Sequence</button>
  <button id="remove" title="Remove the selected clips (Delete)">Delete</button>
  <span class="sep"></span>
  <button class="icon" id="zoomOut" title="Zoom out (Ctrl+wheel)">−</button>
  <button class="icon" id="zoomIn" title="Zoom in (Ctrl+wheel)">+</button>
  <button id="fit" title="Show the whole scene">Fit</button>
  <button id="snap" class="on" title="Snap to clip edges and the playhead. Hold Alt while dragging to turn it off for one drag">Snap</button>
  <span class="status" id="gameLine" role="status"></span>
</div>
<div id="invalid" hidden>
  <h2>This file cannot be read as a scene</h2>
  <p id="invalidText"></p>
  <p class="dim">Fix the text and the scene comes back. Undo works here too.</p>
  <button id="openText">Open as Text</button>
</div>
<main id="work">
  <div id="lanes">
    <div id="heads"><div class="corner"></div><div id="headList"></div><div id="dropLine" hidden></div></div>
    <div id="canvasWrap"><canvas id="canvas" tabindex="0" aria-label="Timeline"></canvas></div>
  </div>
  <aside id="inspector" aria-label="Inspector"></aside>
</main>
<div class="menu" id="kindMenu" hidden></div>`;
