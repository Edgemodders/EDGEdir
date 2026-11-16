// The actor picker (D2.2): a search box over the cast, with V on top, then the entity's appearances.
// It returns the actor as the scene document keeps it. docs/d2-cast-and-clips.md, "The actor".
import * as vscode from "vscode";
import { castLabel, Players, type CastEntry } from "./core/cast";
import { rigName } from "./core/entity";
import type { Actor, SceneDoc, Track } from "./doc";
import { playerTrack } from "./doc";
import type { Game } from "./game";

interface Row extends vscode.QuickPickItem {
  entry?: CastEntry;
  /** Take the actor off the track. */
  nobody?: true;
}

/** `undefined`: nothing chosen. `null`: the track has nobody now. */
export async function pickActor(game: Game, doc: SceneDoc, track: Track): Promise<Actor | null | undefined> {
  if (game.state !== "ready") await game.refresh();
  const rows: Row[] = [];
  if (track.actor) rows.push({ label: "$(close) Nobody", description: "Take the actor off this track. Its clips stay", nobody: true });
  // A scene has at most one V.
  const taken = playerTrack(doc);
  if (!taken || taken.id === track.id)
    for (const body of ["wa", "ma"] as const) rows.push({ label: `$(account) ${Players[body].name}`, description: "The player character", entry: Players[body] });
  for (const e of game.cast.entries) rows.push({ label: castLabel(e), description: e.record, entry: e });

  const vOffered = !taken || taken.id === track.id;
  if (!rows.length) {
    void vscode.window.showWarningMessage(`EDGEdir: the game's characters could not be read (see the Animations view), and V is already on the track "${taken?.name}". There is nobody to choose just now.`);
    return undefined;
  }
  const note =
    game.state === "ready"
      ? `${game.cast.entries.length.toLocaleString()} characters from your game. Type a name`
      : `The game's characters could not be read (see the Animations view).${vOffered ? " V can still be chosen" : ""}`;
  const row = await vscode.window.showQuickPick(rows, { title: `Who acts on "${track.name}"?`, placeHolder: note, matchOnDescription: true });
  if (!row) return undefined;
  if (row.nobody) return null;
  const entry = row.entry!;

  const actor: Actor = entry.player ? { player: entry.player, name: "V" } : { record: entry.record, name: castLabel(entry) };
  actor.entity = entry.entity;
  let appearances: string[] = [];
  try {
    const facts = await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: `EDGEdir: reading ${castLabel(entry)}` }, () => game.entity(entry.entity));
    if (facts.rig) actor.rig = facts.rig;
    appearances = facts.appearances;
  } catch (e) {
    // Without the game the actor is still named; its rig is read the next time the bridge is there.
    void vscode.window.showWarningMessage(`EDGEdir could not read ${castLabel(entry)}'s entity, so its rig is not known yet: ${(e as Error).message}`);
  }

  // V's looks are the modder's own, from the save, so there is nothing to choose.
  if (!entry.player && appearances.length > 1) {
    const any = "Any: the game picks";
    const looks = [
      { label: any, description: entry.appearance ? `The record asks for ${entry.appearance}` : undefined },
      ...appearances.map((a) => ({ label: a, description: a === entry.appearance ? "The record's own" : undefined })),
    ];
    const look = await vscode.window.showQuickPick(looks, { title: `${castLabel(entry)}: which appearance?`, placeHolder: actor.rig ? `Rig: ${rigName(actor.rig)}` : undefined });
    if (!look) return undefined;
    if (look.label !== any) actor.appearance = look.label;
  } else if (!entry.player && appearances.length === 1) actor.appearance = appearances[0];
  return actor;
}
