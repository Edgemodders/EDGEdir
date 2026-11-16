// EDGEdir's entry point. D1: the scene editor for `.edgedir` files (src/editor.ts) and the Desk
// (src/desk.ts, src/deskView.ts). D2: the game's files (src/game.ts), the actor picker and the
// Animations view. The Library view shows its welcome text until its phase fills it
// (docs/design.md, "Phases").
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { defaultCacheDir } from "./core/config";
import { deskDir, fileName, newScene, renameScene, type DeskScene } from "./desk";
import { DeskView, type DeskItem } from "./deskView";
import { pickActor } from "./actorPicker";
import { AnimationsView, type AnimItem } from "./animationsView";
import { addAnimClip, EditError, findTrack, parseDoc, setActor, unfit, type SceneDoc } from "./doc";
import { applyEdit, SceneEditorProvider, ViewType } from "./editor";
import { Game } from "./game";

/** An empty tree, so a view shows its welcome text until its phase fills it. */
class Empty implements vscode.TreeDataProvider<never> {
  getTreeItem(element: never): vscode.TreeItem {
    return element;
  }
  getChildren(): never[] {
    return [];
  }
}

const openScene = (uri: vscode.Uri) => vscode.commands.executeCommand("vscode.openWith", uri, ViewType);

/** The editor tabs showing a file, in any group. */
function tabsOf(file: string): vscode.Tab[] {
  const target = file.toLowerCase();
  return vscode.window.tabGroups.all
    .flatMap((g) => g.tabs)
    .filter((t) => {
      const input = t.input as { uri?: vscode.Uri } | undefined;
      return input?.uri?.scheme === "file" && input.uri.fsPath.toLowerCase().startsWith(target);
    });
}

const sceneOf = (item: unknown): DeskScene | undefined => (item && (item as DeskItem).kind === "scene" ? (item as { scene: DeskScene }).scene : undefined);

export function activate(context: vscode.ExtensionContext): void {
  const desk = new DeskView(context);
  const fail = (what: string, e: unknown) => void vscode.window.showErrorMessage(`EDGEdir, ${what}: ${(e as Error).message}`);
  const game = new Game();
  const animations = new AnimationsView(game);
  context.subscriptions.push(game);
  // The Animations view's welcome text follows this until the game is read.
  void vscode.commands.executeCommand("setContext", "edgedir.state", "starting");
  // Once the game has been read on this PC, later sessions read it without asking: the lists are on
  // disk, so this only starts REDbridge. The first read is the modder's click (it takes a while).
  if (fs.existsSync(path.join(defaultCacheDir(), "cast"))) void game.refresh();

  /** The picker for one actor track; the choice is written into the scene as one undo step. */
  const chooseActor = async (document: vscode.TextDocument, trackId: string): Promise<void> => {
    try {
      const doc = parseDoc(document.getText());
      const track = findTrack(doc, trackId);
      if (!track || track.kind !== "actor") return;
      const actor = await pickActor(game, doc, track);
      if (actor === undefined) return;
      await applyEdit(document, (d) => setActor(d, trackId, actor ?? undefined));
    } catch (e) {
      if (e instanceof EditError) void vscode.window.showWarningMessage(`EDGEdir: ${e.message}`);
      else fail("Choose Actor", e);
    }
  };

  /** Closes a scene's tabs before its folder changes; false when the modder keeps unsaved changes open. */
  const closeTabs = async (scene: DeskScene, why: string): Promise<boolean> => {
    const tabs = tabsOf(scene.folder);
    if (tabs.some((t) => t.isDirty)) {
      void vscode.window.showWarningMessage(`"${scene.name}" has unsaved changes. Save or close it, then ${why} it.`);
      return false;
    }
    if (tabs.length) await vscode.window.tabGroups.close(tabs);
    return true;
  };

  const scenes = new SceneEditorProvider(context, (uri) => void desk.opened(uri), chooseActor);
  /** The scene in front as a document, or undefined when its text is not a scene just now. */
  const frontDoc = (): SceneDoc | undefined => {
    try {
      const front = scenes.current();
      return front && parseDoc(front.document.getText());
    } catch {
      return undefined;
    }
  };
  // The Animations view's filters follow the actor of the track selected in the scene in front.
  const followActor = () => {
    const track = frontDoc()?.tracks.find((t) => t.id === scenes.current()?.track);
    animations.setActor(track?.kind === "actor" ? track.actor : undefined);
  };
  context.subscriptions.push(
    scenes.onDidChangeCurrent(followActor),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document === scenes.current()?.document) followActor();
    }),
  );

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(ViewType, scenes, {
      // The page keeps its place, zoom and selection while its tab is in the background.
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.window.registerTreeDataProvider("edgedir.desk", desk),
    vscode.window.registerTreeDataProvider("edgedir.library", new Empty()),
    vscode.window.registerTreeDataProvider("edgedir.animations", animations),

    vscode.commands.registerCommand("edgedir.readGame", () => game.refresh()),
    vscode.commands.registerCommand("edgedir.readGameAgain", () => game.refresh(true)),
    vscode.commands.registerCommand("edgedir.showLog", () => game.showLog()),
    vscode.commands.registerCommand("edgedir.searchAnimations", async () => {
      const text = await vscode.window.showInputBox({
        title: "Search Animations",
        prompt: "Words from an animation file's name or folder. Every word must be there.",
        placeHolder: "judy sit",
        value: animations.search,
      });
      if (text !== undefined) animations.setSearch(text);
    }),
    vscode.commands.registerCommand("edgedir.clearAnimationSearch", () => animations.setSearch("")),
    vscode.commands.registerCommand("edgedir.copyAnimPath", (item: AnimItem | undefined) => {
      if (item?.kind === "set") return vscode.env.clipboard.writeText(item.path);
      if (item?.kind === "clip") return vscode.env.clipboard.writeText(item.set);
    }),
    vscode.commands.registerCommand("edgedir.copyAnimName", (item: AnimItem | undefined) => {
      if (item?.kind === "clip") return vscode.env.clipboard.writeText(item.clip.name);
    }),
    vscode.commands.registerCommand("edgedir.animFitsOn", () => animations.setFilter("fits", true)),
    vscode.commands.registerCommand("edgedir.animFitsOff", () => animations.setFilter("fits", false)),
    vscode.commands.registerCommand("edgedir.animCarriedOn", () => animations.setFilter("carried", true)),
    vscode.commands.registerCommand("edgedir.animCarriedOff", () => animations.setFilter("carried", false)),

    // An animation from the view becomes a clip on the selected actor track, at the playhead.
    vscode.commands.registerCommand("edgedir.addToTrack", async (item: AnimItem | undefined) => {
      if (item?.kind !== "clip") return;
      const front = scenes.current();
      const doc = frontDoc();
      if (!front || !doc) return void vscode.window.showWarningMessage("EDGEdir: open a scene first. The animation goes on its selected actor track, at the playhead.");
      const actors = doc.tracks.filter((t) => t.kind === "actor");
      const picked = actors.find((t) => t.id === front.track) ?? (actors.length === 1 ? actors[0] : undefined);
      if (!picked) return void vscode.window.showWarningMessage(actors.length ? "EDGEdir: select the actor track the animation should go on." : "EDGEdir: the scene has no actor track yet. Add one with Add Track.");
      try {
        let made = "";
        await applyEdit(front.document, (d) => {
          const result = addAnimClip(d, picked.id, { set: item.set, name: item.clip.name, rig: item.rig || undefined, seconds: item.clip.seconds }, front.playhead);
          made = result.id;
          return result.doc;
        });
        const now = frontDoc();
        const track = now && findTrack(now, picked.id);
        const clip = track?.clips.find((c) => c.id === made);
        const why = track && clip ? unfit(track, clip) : undefined;
        if (why) void vscode.window.showWarningMessage(`EDGEdir: ${why}. The clip is on the track, marked unfit.`);
      } catch (e) {
        if (e instanceof EditError) void vscode.window.showWarningMessage(`EDGEdir: ${e.message}`);
        else fail("Add to Track", e);
      }
    }),

    vscode.commands.registerCommand("edgedir.newScene", async () => {
      const name = await vscode.window.showInputBox({
        title: "New Scene",
        prompt: "A name for the scene. It is made on the Desk, and can go into a project or the Library later.",
        placeHolder: "Alley talk",
        validateInput: (v) => {
          try {
            fileName(v);
            return undefined;
          } catch (e) {
            return (e as Error).message;
          }
        },
      });
      if (name === undefined) return;
      try {
        const scene = newScene(name);
        desk.refresh();
        await openScene(vscode.Uri.file(scene.file));
      } catch (e) {
        fail("New Scene", e);
      }
    }),

    vscode.commands.registerCommand("edgedir.openScene", (uri: vscode.Uri) => openScene(uri)),
    vscode.commands.registerCommand("edgedir.refreshDesk", () => desk.refresh()),

    vscode.commands.registerCommand("edgedir.renameScene", async (item: unknown) => {
      const scene = sceneOf(item);
      if (!scene) return;
      const name = await vscode.window.showInputBox({
        title: "Rename Scene",
        value: scene.name,
        validateInput: (v) => {
          try {
            fileName(v);
            return undefined;
          } catch (e) {
            return (e as Error).message;
          }
        },
      });
      if (name === undefined || name.trim() === scene.name) return;
      const wasOpen = tabsOf(scene.folder).length > 0;
      if (!(await closeTabs(scene, "rename"))) return;
      try {
        const renamed = renameScene(scene, name);
        desk.refresh();
        if (wasOpen) await openScene(vscode.Uri.file(renamed.file));
      } catch (e) {
        fail("Rename Scene", e);
        desk.refresh();
      }
    }),

    vscode.commands.registerCommand("edgedir.deleteScene", async (item: unknown) => {
      const scene = sceneOf(item);
      if (!scene) return;
      const go = await vscode.window.showWarningMessage(`Delete the scene "${scene.name}" from the Desk?`, { modal: true, detail: "Its folder goes to the Recycle Bin, so it can be brought back from there." }, "Delete");
      if (go !== "Delete") return;
      if (!(await closeTabs(scene, "delete"))) return;
      const folder = vscode.Uri.file(scene.folder);
      try {
        await vscode.workspace.fs.delete(folder, { recursive: true, useTrash: true });
      } catch (e) {
        // A drive with no Recycle Bin (a network or subst drive): ask again before deleting for good.
        const gone = await vscode.window.showWarningMessage(
          `"${scene.name}" could not be moved to the Recycle Bin. Delete it for good?`,
          { modal: true, detail: `This cannot be undone. Some drives, such as network drives, have no Recycle Bin.

${(e as Error).message}` },
          "Delete for Good",
        );
        if (gone === "Delete for Good") {
          try {
            await vscode.workspace.fs.delete(folder, { recursive: true, useTrash: false });
          } catch (e2) {
            fail("Delete Scene", e2);
          }
        }
      }
      desk.refresh();
    }),

    vscode.commands.registerCommand("edgedir.revealScene", (item: unknown) => {
      const file = sceneOf(item)?.file ?? ((item as DeskItem | undefined)?.kind === "recent" ? (item as { file: string }).file : undefined);
      return vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(file ?? deskDir()));
    }),

    vscode.commands.registerCommand("edgedir.forgetRecent", (item: unknown) => {
      if ((item as DeskItem | undefined)?.kind === "recent") return desk.forget((item as { file: string }).file);
    }),
  );
}

export function deactivate(): void {}
