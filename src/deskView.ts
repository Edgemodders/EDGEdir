// The Desk view: the Desk's scenes, the last changed first, and under Recent the scenes opened from
// anywhere else (a project, a folder). Sequences (D4b) have their own heading. The folders are src/desk.ts's.
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { deskSceneOf, listDesk, type DeskScene } from "./desk";

const RecentKey = "edgedir.recentScenes";
const RecentMax = 20;

export type DeskItem = { kind: "scene"; scene: DeskScene } | { kind: "seqGroup" } | { kind: "recentGroup" } | { kind: "recent"; file: string };

export class DeskView implements vscode.TreeDataProvider<DeskItem> {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  refresh(): void {
    this.changed.fire();
  }

  /** The scenes opened from outside the Desk that still exist, the last opened first. */
  recent(): string[] {
    return this.context.globalState.get<string[]>(RecentKey, []).filter((f) => fs.existsSync(f));
  }

  /** Called with each scene opened in the editor. */
  async opened(uri: vscode.Uri): Promise<void> {
    if (uri.scheme !== "file") return;
    if (!deskSceneOf(uri.fsPath)) {
      const same = (f: string) => f.toLowerCase() === uri.fsPath.toLowerCase();
      const list = [uri.fsPath, ...this.context.globalState.get<string[]>(RecentKey, []).filter((f) => !same(f))].slice(0, RecentMax);
      await this.context.globalState.update(RecentKey, list);
    }
    this.refresh();
  }

  async forget(file: string): Promise<void> {
    await this.context.globalState.update(
      RecentKey,
      this.context.globalState.get<string[]>(RecentKey, []).filter((f) => f !== file),
    );
    this.refresh();
  }

  getChildren(item?: DeskItem): DeskItem[] {
    if (item?.kind === "recentGroup") return this.recent().map((file) => ({ kind: "recent", file }));
    const all = listDesk();
    if (item?.kind === "seqGroup") return all.filter((s) => s.kind === "sequence").map((scene) => ({ kind: "scene", scene }));
    if (item) return [];
    const scenes: DeskItem[] = all.filter((s) => s.kind !== "sequence").map((scene) => ({ kind: "scene", scene }));
    if (all.some((s) => s.kind === "sequence")) scenes.push({ kind: "seqGroup" });
    return this.recent().length ? [...scenes, { kind: "recentGroup" }] : scenes;
  }

  getTreeItem(item: DeskItem): vscode.TreeItem {
    if (item.kind === "recentGroup") {
      const t = new vscode.TreeItem("Recent", vscode.TreeItemCollapsibleState.Expanded);
      t.tooltip = "Scenes opened from a project or another folder. Scenes on the Desk are listed above";
      return t;
    }
    if (item.kind === "seqGroup") {
      const t = new vscode.TreeItem("Sequences", vscode.TreeItemCollapsibleState.Expanded);
      t.tooltip = "Runs of clips and transitions for one rig. Add to Track puts one on the selected actor track as a block";
      return t;
    }
    const file = item.kind === "scene" ? item.scene.file : item.file;
    const seq = item.kind === "scene" && item.scene.kind === "sequence";
    const t = new vscode.TreeItem(item.kind === "scene" ? item.scene.name : path.basename(file, path.extname(file)));
    t.iconPath = new vscode.ThemeIcon(seq ? "list-ordered" : item.kind === "scene" ? "device-camera-video" : "history");
    t.description = item.kind === "scene" ? when(item.scene.modified) : path.basename(path.dirname(file));
    t.tooltip = file;
    t.contextValue = seq ? "deskSequence" : item.kind === "scene" ? "deskScene" : "recentScene";
    t.resourceUri = vscode.Uri.file(file);
    t.command = { command: "edgedir.openScene", title: "Open", arguments: [vscode.Uri.file(file)] };
    return t;
  }
}

/** How long ago, in a word or two. */
function when(ms: number): string {
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
