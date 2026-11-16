// The Animations view (D2.4): the game's animation files (sets), by folder, with a search by name.
// The animations inside each set come with D2.5 (REDbridge's anims.info), and the Library's and the
// open project's made animations with D2.7. docs/d2-cast-and-clips.md, "The animations".
import * as vscode from "vscode";
import { setName } from "./core/animSets";
import type { Game } from "./game";

export type AnimItem =
  | { kind: "note"; text: string; detail?: string }
  | { kind: "group"; name: string }
  | { kind: "folder"; path: string; name: string; sets: number }
  | { kind: "set"; path: string };

const SearchLimit = 500;

export class AnimationsView implements vscode.TreeDataProvider<AnimItem> {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;
  /** The words searched for; empty shows the folders. */
  search = "";

  constructor(private readonly game: Game) {
    game.onDidChange(() => this.changed.fire());
  }

  setSearch(text: string): void {
    this.search = text.trim();
    void vscode.commands.executeCommand("setContext", "edgedir.animSearch", !!this.search);
    this.changed.fire();
  }

  getChildren(item?: AnimItem): AnimItem[] {
    // Until the game is read, the view's welcome text says why (package.json, viewsWelcome).
    if (this.game.state !== "ready") return [];
    const sets = this.game.sets;
    if (!item) {
      if (this.search) {
        const found = sets.search(this.search, SearchLimit);
        const head: AnimItem = {
          kind: "note",
          text: `${found.total.toLocaleString()} animation ${found.total === 1 ? "file" : "files"} for "${this.search}"`,
          detail: found.total > SearchLimit ? `The first ${SearchLimit} are shown. Add a word to narrow it` : undefined,
        };
        return [head, ...found.sets.map((path): AnimItem => ({ kind: "set", path }))];
      }
      return [{ kind: "group", name: "Game" }];
    }
    if (item.kind === "group" || item.kind === "folder") {
      const level = sets.folder(item.kind === "folder" ? item.path : "");
      return [...level.folders.map((f): AnimItem => ({ kind: "folder", ...f })), ...level.sets.map((path): AnimItem => ({ kind: "set", path }))];
    }
    return [];
  }

  getTreeItem(item: AnimItem): vscode.TreeItem {
    switch (item.kind) {
      case "note": {
        const t = new vscode.TreeItem(item.text);
        t.description = item.detail;
        t.iconPath = new vscode.ThemeIcon("search");
        return t;
      }
      case "group": {
        const t = new vscode.TreeItem(item.name, vscode.TreeItemCollapsibleState.Expanded);
        t.description = `${this.game.sets.sets.length.toLocaleString()} animation files`;
        t.tooltip = `Read from ${this.game.where}. The animations inside each file are listed in a later build`;
        t.iconPath = new vscode.ThemeIcon("game");
        return t;
      }
      case "folder": {
        const t = new vscode.TreeItem(item.name, vscode.TreeItemCollapsibleState.Collapsed);
        t.description = item.sets.toLocaleString();
        t.tooltip = item.path;
        t.iconPath = vscode.ThemeIcon.Folder;
        return t;
      }
      case "set": {
        const t = new vscode.TreeItem(setName(item.path));
        // In a search the folder tells two sets of one name apart.
        if (this.search) t.description = item.path.slice(0, item.path.lastIndexOf("\\"));
        t.tooltip = item.path;
        t.iconPath = new vscode.ThemeIcon("symbol-event");
        t.contextValue = "animSet";
        return t;
      }
    }
  }
}
