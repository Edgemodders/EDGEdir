// The Animations view: the game's animation files (sets) by folder, the animations inside each
// (D2.5, read with REDbridge's anims.info), a search by name, and two filters for the actor of the
// track selected in the scene editor. The Library's and the open project's made animations come
// with D2.7. docs/d2-cast-and-clips.md, "The animations".
import * as vscode from "vscode";
import type { ClipFacts, FoundClip } from "./core/animIndex";
import { setName } from "./core/animSets";
import { rigName } from "./core/entity";
import type { Actor } from "./doc";
import type { Game } from "./game";

export type AnimItem =
  | { kind: "note"; text: string; detail?: string; icon?: string }
  | { kind: "group"; name: string }
  | { kind: "folder"; path: string; name: string; sets: number }
  | { kind: "set"; path: string }
  | { kind: "clip"; set: string; rig: string; clip: ClipFacts; flat?: boolean };

const Limit = 500;

export class AnimationsView implements vscode.TreeDataProvider<AnimItem> {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;
  /** The words searched for. */
  search = "";
  /** Only animations made for the selected actor's rig. */
  fits = false;
  /** Only animations in the sets the selected actor's entity lists. */
  carried = false;
  /** Who acts on the track selected in the scene editor in front, if anyone. */
  private actor: Actor | undefined;

  constructor(private readonly game: Game) {
    game.onDidChange(() => this.changed.fire());
  }

  setSearch(text: string): void {
    this.search = text.trim();
    void vscode.commands.executeCommand("setContext", "edgedir.animSearch", !!this.search);
    this.changed.fire();
  }

  setFilter(which: "fits" | "carried", on: boolean): void {
    this[which] = on;
    void vscode.commands.executeCommand("setContext", `edgedir.anim${which === "fits" ? "Fits" : "Carried"}`, on);
    this.changed.fire();
  }

  /** Called when the selected track's actor changes. */
  setActor(actor: Actor | undefined): void {
    const same = JSON.stringify(actor ?? null) === JSON.stringify(this.actor ?? null);
    this.actor = actor;
    if (!same && (this.fits || this.carried)) this.changed.fire();
  }

  /** The flat list a search or a filter gives. */
  private async found(): Promise<AnimItem[]> {
    const index = this.game.index;
    const notes: AnimItem[] = [];
    if (!index.setsRead) {
      // No animations read (yet): the files' names can still be searched.
      if (!this.search) return [{ kind: "note", text: "The filters need the animations inside each file, which are not read yet", icon: "info" }];
      const sets = this.game.sets.search(this.search, Limit);
      return [{ kind: "note", text: `${sets.total.toLocaleString()} animation ${sets.total === 1 ? "file" : "files"} for "${this.search}"`, icon: "search" }, ...sets.sets.map((path): AnimItem => ({ kind: "set", path }))];
    }
    let rig: string | undefined;
    let only: string[] | undefined;
    if (this.fits || this.carried) {
      if (!this.actor) return [{ kind: "note", text: "Select an actor track that has an actor, in the scene editor", detail: "The filters follow it", icon: "info" }];
      if (this.fits) {
        if (!this.actor.rig) return [{ kind: "note", text: `${this.actor.name ?? "The actor"}'s rig is not known yet`, detail: "Choose the actor again with the game's files there", icon: "warning" }];
        rig = this.actor.rig;
      }
      if (this.carried && this.actor.entity) {
        try {
          only = (await this.game.entity(this.actor.entity)).sets.map((s) => s.path);
        } catch (e) {
          notes.push({ kind: "note", text: "The actor's own animation files could not be read", detail: (e as Error).message, icon: "warning" });
        }
      }
    }
    const result = index.search({ text: this.search, rig, sets: only, limit: Limit });
    const what = [this.search ? `for "${this.search}"` : "", this.fits ? `that fit ${this.actor?.name ?? "the actor"} (${rigName(rig)})` : "", this.carried ? `in ${this.actor?.name ?? "the actor"}'s own files` : ""].filter(Boolean).join(", ");
    notes.unshift({
      kind: "note",
      text: `${result.total.toLocaleString()} ${result.total === 1 ? "animation" : "animations"} ${what}`,
      detail: [result.total > Limit ? `The first ${Limit} are shown; add a word to narrow it` : "", index.complete ? "" : "Still reading the game: more will come"].filter(Boolean).join(". ") || undefined,
      icon: "search",
    });
    return [...notes, ...result.items.map((f: FoundClip): AnimItem => ({ kind: "clip", ...f, flat: true }))];
  }

  getChildren(item?: AnimItem): AnimItem[] | Promise<AnimItem[]> {
    // Until the game is read, the view's welcome text says why (package.json, viewsWelcome).
    if (this.game.state !== "ready") return [];
    if (!item) return this.search || this.fits || this.carried ? this.found() : [{ kind: "group", name: "Game" }];
    if (item.kind === "group" || item.kind === "folder") {
      const level = this.game.sets.folder(item.kind === "folder" ? item.path : "");
      return [...level.folders.map((f): AnimItem => ({ kind: "folder", ...f })), ...level.sets.map((path): AnimItem => ({ kind: "set", path }))];
    }
    if (item.kind === "set") {
      const set = this.game.index.set(item.path);
      return set ? set.clips.map((clip): AnimItem => ({ kind: "clip", set: set.path, rig: set.rig, clip })) : [];
    }
    return [];
  }

  getTreeItem(item: AnimItem): vscode.TreeItem {
    switch (item.kind) {
      case "note": {
        const t = new vscode.TreeItem(item.text);
        t.description = item.detail;
        t.tooltip = item.detail ? `${item.text}. ${item.detail}` : item.text;
        t.iconPath = new vscode.ThemeIcon(item.icon ?? "info");
        return t;
      }
      case "group": {
        const t = new vscode.TreeItem(item.name, vscode.TreeItemCollapsibleState.Expanded);
        const index = this.game.index;
        t.description = `${this.game.sets.sets.length.toLocaleString()} files${index.setsRead ? `, ${index.clips.toLocaleString()} animations${index.complete ? "" : " so far"}` : ""}`;
        t.tooltip = `Read from ${this.game.where}.\n${this.game.clipsNote}`;
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
        const set = this.game.index.set(item.path);
        const t = new vscode.TreeItem(setName(item.path), set?.clips.length ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        // In a search the folder tells two sets of one name apart.
        t.description = [set ? `${set.clips.length}${set.rig ? ` · ${rigName(set.rig)}` : ""}` : "", this.search ? item.path.slice(0, item.path.lastIndexOf("\\")) : ""].filter(Boolean).join("  ");
        t.tooltip = set ? `${item.path}\nRig: ${set.rig || "none named"}` : `${item.path}\nIts animations are not read yet`;
        t.iconPath = new vscode.ThemeIcon("symbol-event");
        t.contextValue = "animSet";
        return t;
      }
      case "clip": {
        const c = item.clip;
        const t = new vscode.TreeItem(c.name);
        t.description = [`${c.seconds.toFixed(2)} s`, c.additive ? "additive" : "", c.rootMotion ? "moves" : "", item.flat ? setName(item.set) : ""].filter(Boolean).join(" · ");
        t.tooltip = new vscode.MarkdownString(
          [`**${c.name}**`, `${c.seconds.toFixed(3)} s, ${c.frames} frames at ${Math.round(c.fps)} a second`, `File: \`${item.set}\``, `Rig: ${item.rig ? rigName(item.rig) : "none named"}`, c.additive ? "Additive: laid over another animation, not a whole pose by itself" : "", c.rootMotion ? "Has root motion: it moves its character" : ""]
            .filter(Boolean)
            .join("\n\n"),
        );
        t.iconPath = new vscode.ThemeIcon(c.additive ? "layers" : "run");
        t.contextValue = "animClip";
        return t;
      }
    }
  }
}
