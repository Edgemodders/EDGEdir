// EDGEdir's entry point. D1: the scene editor for `.edgedir` files (src/editor.ts) and the Desk
// (src/desk.ts, src/deskView.ts). The Library and Animations views show their welcome text until
// their phases fill them (docs/design.md, "Phases").
import * as vscode from "vscode";
import { deskDir, fileName, newScene, renameScene, type DeskScene } from "./desk";
import { DeskView, type DeskItem } from "./deskView";
import { SceneEditorProvider, ViewType } from "./editor";

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

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(ViewType, new SceneEditorProvider(context, (uri) => void desk.opened(uri)), {
      // The page keeps its place, zoom and selection while its tab is in the background.
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.window.registerTreeDataProvider("edgedir.desk", desk),
    vscode.window.registerTreeDataProvider("edgedir.library", new Empty()),
    vscode.window.registerTreeDataProvider("edgedir.animations", new Empty()),

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
