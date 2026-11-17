// The Sets view (D5a): EDGEbuilder's scenes in the EDGE Library and the open REDcode project, each
// with the Desk's scenes that play on it. docs/design.md, "Sets: the stage from EDGEbuilder".
import * as fs from "node:fs";
import * as vscode from "vscode";
import { listDesk, type DeskScene } from "./desk";
import { parseDoc } from "./doc";
import { setOf } from "./set";
import { findSets, type SetFile } from "./setFiles";

export type SetItem = { kind: "group"; where: SetFile["where"]; label: string } | { kind: "set"; set: SetFile } | { kind: "scene"; scene: DeskScene };

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export class SetsView implements vscode.TreeDataProvider<SetItem> {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;
  private list: SetFile[] = [];

  constructor(private readonly roots: () => { library: string | undefined; project: { dir: string; name: string } | undefined }) {}

  refresh(): void {
    this.changed.fire();
  }

  /** Every set there is now. */
  sets(): SetFile[] {
    const { library, project } = this.roots();
    this.list = findSets(library, project?.dir);
    void vscode.commands.executeCommand("setContext", "edgedir.sets", !library && !project ? "noRoot" : this.list.length ? "some" : "none");
    return this.list;
  }

  /** The Desk's scenes that play on a set. */
  private scenesOn(set: SetFile): DeskScene[] {
    return listDesk().filter((s) => {
      if (s.kind === "sequence") return false;
      try {
        const link = setOf(parseDoc(fs.readFileSync(s.file, "utf8")));
        return !!link && link.where === set.where && link.path.toLowerCase() === set.path.toLowerCase();
      } catch {
        return false;
      }
    });
  }

  getChildren(item?: SetItem): SetItem[] {
    if (item?.kind === "set") return this.scenesOn(item.set).map((scene) => ({ kind: "scene", scene }));
    if (item?.kind === "group") return this.list.filter((s) => s.where === item.where).map((set) => ({ kind: "set", set }));
    if (item) return [];
    const all = this.sets();
    const project = this.roots().project;
    const groups: SetItem[] = [];
    if (all.some((s) => s.where === "project")) groups.push({ kind: "group", where: "project", label: `Project: ${project?.name ?? ""}`.trim() });
    if (all.some((s) => s.where === "library")) groups.push({ kind: "group", where: "library", label: "Library" });
    return groups;
  }

  getTreeItem(item: SetItem): vscode.TreeItem {
    if (item.kind === "group") {
      const t = new vscode.TreeItem(item.label, vscode.TreeItemCollapsibleState.Expanded);
      t.tooltip = item.where === "library" ? "EDGEbuilder's scenes in the EDGE Library" : "EDGEbuilder's scenes in the open REDcode project (source/scenes)";
      return t;
    }
    if (item.kind === "scene") {
      const t = new vscode.TreeItem(item.scene.name);
      t.iconPath = new vscode.ThemeIcon("device-camera-video");
      t.description = "scene";
      t.tooltip = item.scene.file;
      t.contextValue = "setScene";
      t.command = { command: "edgedir.openScene", title: "Open", arguments: [vscode.Uri.file(item.scene.file)] };
      return t;
    }
    const s = item.set;
    const t = new vscode.TreeItem(s.name, this.scenesOn(s).length ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None);
    t.iconPath = new vscode.ThemeIcon(s.error ? "warning" : "symbol-structure");
    t.description = s.error ? "cannot be read" : `${count(s.people, "person", "people")}${s.vehicles ? `, ${count(s.vehicles, "vehicle")}` : ""}, ${count(s.props, "prop")}`;
    t.tooltip = s.error ? `${s.file}\n${s.error}` : `${s.file}\nAn EDGEbuilder scene. New Scene on This Set makes a scene that plays on it, with a track for each person`;
    t.contextValue = s.error ? "setBroken" : "set";
    return t;
  }
}
