// EDGEdir's entry point, the scaffold: the activity bar container and its three views (Desk,
// Library, Animations), with their welcome text from package.json. They fill in once the design
// (docs/design.md, to be written) has its phases.
import * as vscode from "vscode";
import { VIEWS } from "./views";

/** An empty tree, so each view shows its welcome text until its phase fills it. */
class Empty implements vscode.TreeDataProvider<never> {
  getTreeItem(element: never): vscode.TreeItem {
    return element;
  }
  getChildren(): never[] {
    return [];
  }
}

export function activate(context: vscode.ExtensionContext): void {
  for (const id of VIEWS) {
    context.subscriptions.push(vscode.window.registerTreeDataProvider(id, new Empty()));
  }
}

export function deactivate(): void {}
