// The scene editor: a custom text editor over a `.edgedir` file. The file stays JSON text, so save,
// undo, redo and the dirty mark are VS Code's own. The page (webview/editor.ts) draws the timeline
// and posts each change back as a whole new document, which is written into the text here.
// The pattern is EDGEwave's (src/editor.ts at f39a787), copied, without its audio.
import * as fs from "node:fs";
import * as vscode from "vscode";
import { formatDoc, parseDoc, type SceneDoc } from "./doc";

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
  | { type: "cursor"; track: string; playhead: number };

/** A scene open in the editor, with where its page's cursor is. */
export interface OpenScene {
  document: vscode.TextDocument;
  track: string;
  playhead: number;
}

/** Changes a scene document's text with one of src/doc.ts's edits. Undo takes it back as one step. */
export async function applyEdit(document: vscode.TextDocument, change: (doc: SceneDoc) => SceneDoc): Promise<void> {
  const text = formatDoc(change(parseDoc(document.getText())));
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
  ) {}

  resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): void {
    this.opened(document.uri);
    const webview = panel.webview;
    const dist = vscode.Uri.joinPath(this.context.extensionUri, "dist");
    const media = vscode.Uri.joinPath(this.context.extensionUri, "media");
    webview.options = { enableScripts: true, localResourceRoots: [dist, media] };
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
        post({ type: "doc", doc: parseDoc(text), dirty: text !== onDisk });
      } catch (e) {
        post({ type: "invalid", text: (e as Error).message });
      }
    };

    const changed = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString() && e.contentChanges.length) sendDoc();
    });
    // Saved: the page's unsaved copy is the saved one now.
    const saved = vscode.workspace.onDidSaveTextDocument((d) => {
      if (d.uri.toString() === document.uri.toString()) sendDoc();
    });
    panel.onDidDispose(() => {
      this.scenes.delete(panel);
      if (this.last === panel) this.last = undefined;
      this.moved.fire();
      changed.dispose();
      saved.dispose();
    });

    webview.onDidReceiveMessage(async (m: FromPage) => {
      switch (m.type) {
        case "ready":
          return sendDoc();
        case "edit": {
          const text = formatDoc(m.doc);
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
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
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
  <p>The 3D preview of the cast comes in a later phase (D3). The timeline below is the scene.</p>
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
  <span class="mono" id="time" title="The playhead: time, and frame">0:00.000</span>
  <span class="sep"></span>
  <button id="addTrack" title="Add a track to the scene">Add Track</button>
  <button id="addClip" title="Add a clip to the selected track at the playhead (or double-click a lane)">Add Clip</button>
  <button id="addTransition" title="Add a transition to the selected actor track at the playhead" hidden>Add Transition</button>
  <button id="split" title="Cut the selected clip in two at the playhead (S)">Split</button>
  <button id="remove" title="Remove the selected clips (Delete)">Delete</button>
  <span class="sep"></span>
  <button class="icon" id="zoomOut" title="Zoom out (Ctrl+wheel)">−</button>
  <button class="icon" id="zoomIn" title="Zoom in (Ctrl+wheel)">+</button>
  <button id="fit" title="Show the whole scene">Fit</button>
  <button id="snap" class="on" title="Snap to clip edges and the playhead. Hold Alt while dragging to turn it off for one drag">Snap</button>
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
