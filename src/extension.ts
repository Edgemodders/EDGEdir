// EDGEdir's entry point. D1: the scene editor for `.edgedir` files (src/editor.ts) and the Desk
// (src/desk.ts, src/deskView.ts). D2: the game's files (src/game.ts), the actor picker and the
// Animations view. The Library view shows its welcome text until its phase fills it
// (docs/design.md, "Phases").
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { defaultCacheDir } from "./core/config";
import { deskDir, deskSequence, fileName, listDesk, newScene, newSequence, renameScene, type DeskScene } from "./desk";
import { DeskView, type DeskItem } from "./deskView";
import { pickActor } from "./actorPicker";
import { AnimationsView, type AnimItem } from "./animationsView";
import { addAnimClip, addSeqClip, EditError, findTrack, newDoc, refreshSeqs, linkState, replaceWithSeq, runOf, seqOf, setActor, unfit, type Actor, type SceneDoc, type SeqRef } from "./doc";
import { rigName } from "./core/entity";
import { isSeqFile, newSeq } from "./seq";
import { makeApi, type EDGEdirApi } from "./api";
import { applyEdit, sceneIn, SceneEditorProvider, ViewType, type PlayHost, type PlayNews, type SequenceHost, type SetHost } from "./editor";
import { cuesOf } from "./cues";
import { alive, appsDir, install, installState, lineOf, older, PlayerId, playerVersion, readState, request, stageFor } from "./play";
import { Game } from "./game";
import { castLabel } from "./core/cast";
import { libraryRoot } from "./core/made";
import { addSetPeople, chooseSet, freshPeople, linkTo, parseSet, removeSet, setOf, stageOf, syncSet, type SetPerson } from "./set";
import { fileOf, hashOf, readSet, type SetFile } from "./setFiles";
import { SetsView, type SetItem } from "./setsView";

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

export function activate(context: vscode.ExtensionContext): EDGEdirApi {
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
      const doc = sceneIn(document);
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

  /** A sequence on the Desk as a block keeps it. */
  const refOf = (id: string): SeqRef | undefined => {
    const found = deskSequence(id);
    return found && { id, name: found.item.name, ...(found.seq.rig ? { rig: found.seq.rig } : {}), clips: found.seq.clips };
  };
  const nameBox = (title: string, prompt: string, value = "") =>
    vscode.window.showInputBox({
      title,
      prompt,
      value,
      validateInput: (v) => {
        try {
          const name = fileName(v).toLowerCase();
          // Said at the box, not after the questions that follow it.
          if (listDesk().some((s) => s.kind === "sequence" && s.name.toLowerCase() === name)) return `The Desk already has a sequence named "${fileName(v)}"`;
          return undefined;
        } catch (e) {
          return (e as Error).message;
        }
      },
    });

  // The Desk's sequences, for the scene editor (D4b).
  const sequences: SequenceHost = {
    states(doc) {
      const out: Record<string, string> = {};
      for (const t of doc.tracks)
        for (const c of t.clips) {
          // By the block, not the sequence: one block can be held back for room while another follows.
          const seq = seqOf(c);
          if (seq) out[c.id] = linkState(t, c, refOf(seq.id));
        }
      return out;
    },
    async sync(document) {
      if (isSeqFile(document.uri.path)) return;
      try {
        const ids = new Set(sceneIn(document).tracks.flatMap((t) => t.clips.map((c) => seqOf(c)?.id).filter((id): id is string => !!id)));
        let updated = 0;
        for (const id of ids) {
          const now = refOf(id);
          if (!now) continue;
          await applyEdit(document, (d) => {
            const r = refreshSeqs(d, now);
            // A block held back for room that took a new name was changed too.
            updated += r.updated + r.renamed;
            return r.doc;
          });
        }
        if (updated) vscode.window.setStatusBarMessage(`EDGEdir: ${updated} sequence block${updated === 1 ? "" : "s"} updated from the Desk`, 6000);
      } catch {
        // The text is not a scene just now: nothing to bring up to date.
      }
    },
    async saveAs(document, clipIds) {
      try {
        const doc = sceneIn(document);
        const run = runOf(doc, clipIds);
        const name = await nameBox("Save as Sequence", "A name for the sequence. It is kept on the Desk and can go onto any actor with the same rig.");
        if (name === undefined) return;
        const keep = "Keep the clips on the lane";
        const swap = "Replace them with the sequence's block";
        const what = await vscode.window.showQuickPick([keep, swap], { title: `Save as Sequence: "${name.trim()}"`, placeHolder: "What should happen to the clips on the lane?" });
        if (!what) return;
        const item = newSequence(name, newSeq(name.trim(), run.rig, run.clips, doc.fps));
        desk.refresh();
        if (what === swap) {
          let made = "";
          await applyEdit(document, (d) => {
            const r = replaceWithSeq(d, run.ids, run.trackId, run.start, { id: item.id, name: item.name, ...(run.rig ? { rig: run.rig } : {}), clips: run.clips });
            made = r.id;
            return r.doc;
          });
          scenes.select(document, made);
        }
        void vscode.window.showInformationMessage(`EDGEdir: the sequence "${item.name}" is on the Desk.`);
      } catch (e) {
        if (e instanceof EditError) void vscode.window.showWarningMessage(`EDGEdir: ${e.message}`);
        else fail("Save as Sequence", e);
      }
    },
    async open(id) {
      const found = deskSequence(id);
      if (!found) return void vscode.window.showWarningMessage("EDGEdir: that sequence is not on this PC's Desk. The block plays the copy the scene keeps; Unpack turns it into clips.");
      await openScene(vscode.Uri.file(found.item.file));
    },
  };

  // Sets (D5a): EDGEbuilder's scenes, read only, from the Library and the open project.
  const roots = () => ({ library: libraryRoot(), project: game.project() });
  const setsView = new SetsView(roots);
  const readLinked = (doc: SceneDoc) => {
    const link = setOf(doc);
    const { library, project } = roots();
    return link ? readSet(link, library, project?.dir) : undefined;
  };
  /** What the game says of each of a set's people, by the person's id: the actor as a track keeps it. Without the game, the record alone. */
  const actorsOf = async (people: SetPerson[]): Promise<Record<string, Actor | undefined>> => {
    const out: Record<string, Actor | undefined> = {};
    if (people.some((p) => p.record) && game.state !== "ready") await game.refresh();
    for (const p of people) {
      const entry = game.cast.find(p.record);
      const entity = entry?.entity ?? p.entity;
      if (!entity) continue;
      const actor: Actor = { ...(p.record ? { record: p.record } : {}), name: entry ? castLabel(entry) : p.id, entity };
      try {
        const facts = await game.entity(entity);
        if (facts.rig) actor.rig = facts.rig;
        // The set's appearance when the entity has it; else the game picks.
        if (p.appearance && facts.appearances.includes(p.appearance)) actor.appearance = p.appearance;
      } catch {
        // Without the game's files the person is still named; the rig is read when the actor is chosen again.
      }
      out[p.id] = actor;
    }
    return out;
  };
  const pickSet = async (title: string): Promise<SetFile | undefined> => {
    const all = setsView.sets().filter((s) => !s.error);
    if (!all.length) {
      void vscode.window.showInformationMessage("EDGEdir: no sets were found. A set is an EDGEbuilder scene (a .scene.json file) in the EDGE Library or in the open REDcode project's source/scenes.");
      return undefined;
    }
    const row = await vscode.window.showQuickPick(
      all.map((set) => ({ label: set.name, description: `${set.where === "library" ? "Library" : "Project"}  ·  ${set.people} ${set.people === 1 ? "person" : "people"}`, detail: set.path, set })),
      { title, placeHolder: "An EDGEbuilder scene: the stage the scene plays on", matchOnDescription: true, matchOnDetail: true },
    );
    return row?.set;
  };
  const sets: SetHost = {
    stage(doc) {
      const read = readLinked(doc);
      return read ? stageOf(doc, "info" in read ? read.info : undefined, "why" in read ? read.why : undefined) : undefined;
    },
    async sync(document) {
      if (isSeqFile(document.uri.path)) return;
      try {
        const read = readLinked(sceneIn(document));
        if (!read || !("info" in read)) return;
        let moved = 0;
        await applyEdit(document, (d) => {
          const r = syncSet(d, read.info, read.hash);
          moved = r.moved;
          return r.doc;
        });
        if (moved) vscode.window.setStatusBarMessage(`EDGEdir: ${moved} actor${moved === 1 ? "" : "s"} moved with the set`, 6000);
      } catch {
        // The text is not a scene just now.
      }
    },
    async choose(document) {
      try {
        const set = await pickSet("Choose Set");
        if (!set) return;
        const info = parseSet(fs.readFileSync(set.file, "utf8"));
        const link = linkTo(set.where, set.path, info, hashOf(fs.readFileSync(set.file, "utf8")));
        await applyEdit(document, (d) => chooseSet(d, link, info));
        // A set chosen again keeps its people's tracks: they stand where it has them now.
        await sets.sync(document);
        setsView.refresh();
        const fresh = freshPeople(sceneIn(document), info).length;
        if (fresh) void vscode.window.showInformationMessage(`EDGEdir: the scene plays on "${set.name}" now. Add ${fresh === 1 ? "its person" : `its ${fresh} people`} as tracks with the button under Set.`);
      } catch (e) {
        if (e instanceof EditError) void vscode.window.showWarningMessage(`EDGEdir: ${e.message}`);
        else fail("Choose Set", e);
      }
    },
    async remove(document) {
      try {
        await applyEdit(document, removeSet);
        setsView.refresh();
      } catch (e) {
        fail("Remove Set", e);
      }
    },
    async addPeople(document) {
      try {
        const read = readLinked(sceneIn(document));
        if (!read || !("info" in read)) return void vscode.window.showWarningMessage(`EDGEdir: ${read && "why" in read ? read.why : "this scene has no set"}.`);
        const actors = await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: "EDGEdir: reading the set's people" }, () => actorsOf(freshPeople(sceneIn(document), read.info)));
        await applyEdit(document, (d) => addSetPeople(d, read.info, actors).doc);
      } catch (e) {
        if (e instanceof EditError) void vscode.window.showWarningMessage(`EDGEdir: ${e.message}`);
        else fail("Add People from the Set", e);
      }
    },
  };

  // ---- Play in game (D5d): the player is the REDnode package under player/, reached through a folder (src/play.ts) ----
  const playerSource = path.join(context.extensionPath, "player");
  const warn = (text: string) => void vscode.window.showWarningMessage(`EDGEdir: ${text}`);
  const SwitchOn = "Start the game with a save loaded. In REDnode's Mod Manager (F10), switch EDGEdir Player on and allow its two permissions, bridge and archives.";
  /** The notes each scene's play was agreed with: not asked again until they change. */
  const agreed = new Map<string, string>();
  let watching: ReturnType<typeof setInterval> | undefined;
  let telling: ((news: PlayNews) => void) | undefined;
  /** The play is over, or its player is gone: nobody is told more. */
  const over = () => {
    clearInterval(watching);
    telling = undefined;
  };
  /** Passes on what the player says of the play `id`, until it is over. */
  const follow = (id: string, tell: (news: PlayNews) => void) => {
    clearInterval(watching);
    telling = tell;
    const began = Date.now();
    let last = "";
    watching = setInterval(() => {
      const s = readState();
      if (!s || s.id !== id) {
        if (Date.now() - began < 8000) return;
        over();
        return tell({ text: `The player did not answer. ${SwitchOn}`, bad: true, active: false });
      }
      // A player that stopped says nothing more (REDnode ends it without notice, and removes its people).
      if (!alive()) {
        over();
        return tell({ text: "The player stopped: its people are gone from the game", bad: true, active: false });
      }
      const text = JSON.stringify(s);
      if (text === last) return;
      last = text;
      const active = !["failed", "stopped", "idle"].includes(s.state);
      tell({ ...lineOf(s), active, startedAt: s.state === "playing" || s.state === "ended" ? s.startedAt : undefined, length: s.length });
      if (!active) over();
    }, 250);
  };
  context.subscriptions.push({ dispose: () => clearInterval(watching) });
  /** True when the player runs in the game. Offers to copy it there, once asked, when it is missing or older. */
  const playerReady = async (): Promise<boolean> => {
    const shipped = playerVersion(playerSource) ?? "0";
    const running = alive();
    if (running && !older(running, shipped)) return true;
    const gamePath = await game.gameFolder();
    if (!gamePath) return warn("no Cyberpunk 2077 folder is set (the setting edgedir.gamePath, or REDcode's)."), false;
    const state = installState(playerSource, gamePath);
    if (state === "noRednode") return warn("REDnode is not in the game's folder (red4ext\\plugins\\REDnode). Play in game needs REDnode 0.66.9 or later, with REDbridge beside it."), false;
    if (state === "none" || state === "older") {
      const go = await vscode.window.showInformationMessage(
        state === "none" ? `Play in game needs EDGEdir's player in the game. Copy EDGEdir Player ${shipped} into REDnode's apps folder?` : `The EDGEdir Player in the game is older than this EDGEdir's (${shipped}). Replace it?`,
        { modal: true, detail: `${path.join(appsDir(gamePath), PlayerId)}\nIt is a REDnode package, and nothing of the game's own is changed. Remove it in that folder at any time.` },
        "Copy",
      );
      if (go !== "Copy") return false;
      install(playerSource, gamePath);
      // A running REDnode picks a new package up by itself.
      const up = await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: "EDGEdir: waiting for the player in the game" }, async () => {
        for (let i = 0; i < 24; i++) {
          const now = alive();
          if (now && !older(now, shipped)) return true;
          await new Promise((r) => setTimeout(r, 500));
        }
        return false;
      });
      if (!up) void vscode.window.showInformationMessage(`EDGEdir: the player is in the game's folder now. ${SwitchOn} Then press Play in Game again.`);
      return up;
    }
    // An older one that runs from another folder (a development folder) is used as it is.
    if (running) return true;
    return warn(`the player is in the game's folder and is not running. ${SwitchOn}`), false;
  };
  const plays: PlayHost = {
    async play(document, tell) {
      try {
        if (isSeqFile(document.uri.path)) return warn("a sequence plays in the game on an actor, in a scene.");
        const doc = sceneIn(document);
        const { sheet, notes } = cuesOf(doc);
        if (!sheet.cast.length) return warn(`nothing to play in the game. ${notes.find((n) => !n.clip)?.text ?? "No actor track has a clip the game can play."}`);
        const list = notes.map((n) => n.text).join("\n");
        if (notes.length && agreed.get(document.uri.toString()) !== list) {
          const go = await vscode.window.showWarningMessage(
            `The game will not match the preview in ${notes.length} place${notes.length === 1 ? "" : "s"}.`,
            { modal: true, detail: notes.map((n) => `- ${n.text}`).join("\n") },
            "Play Anyway",
          );
          if (go !== "Play Anyway") return;
          agreed.set(document.uri.toString(), list);
        }
        const link = setOf(doc);
        let stage: ReturnType<typeof stageFor>;
        if (link) {
          const { library, project } = roots();
          const file = fileOf(link, library, project?.dir);
          if (!file || !fs.existsSync(file)) return warn(`the scene's set "${link.name}" was not found, so the scene cannot play on it. Choose the set again, or remove it.`);
          stage = stageFor(doc, fs.readFileSync(file, "utf8"));
        }
        if (!(await playerReady())) return;
        // The player plays one scene at a time: the tab whose scene was playing hears that it was taken over.
        telling?.({ text: "Another scene plays in the game now", bad: false, active: false });
        over();
        tell({ text: "Sent to the game", bad: false, active: true });
        follow(request({ do: "play", sheet, stage }), tell);
      } catch (e) {
        fail("Play in Game", e);
      }
    },
    async stop() {
      try {
        request({ do: "stop" });
        // The player says when it has stopped. One that is gone says nothing: its people went with it.
        for (let i = 0; i < 20; i++) {
          const s = readState();
          if (s && ["stopped", "failed", "idle"].includes(s.state)) return;
          if (!alive()) break;
          await new Promise((r) => setTimeout(r, 500));
        }
        const tell = telling;
        over();
        tell?.({ text: "The player is not running: nothing is left to stop", bad: false, active: false });
      } catch (e) {
        fail("Stop in Game", e);
      }
    },
  };

  const scenes: SceneEditorProvider = new SceneEditorProvider(
    context,
    (uri) => void desk.opened(uri),
    chooseActor,
    {
      root: game.preview.root,
      body: (want) => game.previewBody(want),
      clip: (want) => game.previewClip(want),
    },
    sequences,
    sets,
    plays,
  );
  /** The scene in front as a document, or undefined when its text is not a scene just now. */
  const frontDoc = (): SceneDoc | undefined => {
    try {
      const front = scenes.current();
      return front && sceneIn(front.document);
    } catch {
      return undefined;
    }
  };
  // A sequence was saved: every open scene that links it takes it, and the Desk shows its new time.
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (saved) => {
      // A saved scene may have a new set: the Sets view lists it under that set.
      if (saved.uri.path.toLowerCase().endsWith(".edgedir")) setsView.refresh();
      if (!isSeqFile(saved.uri.path)) return;
      desk.refresh();
      for (const d of scenes.documents()) await sequences.sync(d);
      scenes.resend();
    }),
  );
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
    vscode.window.registerTreeDataProvider("edgedir.sets", setsView),
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
      if (item?.kind === "made") return vscode.env.clipboard.writeText(item.anim.file || item.anim.where);
    }),
    vscode.commands.registerCommand("edgedir.refreshAnimations", () => game.refreshMade()),
    vscode.commands.registerCommand("edgedir.copyAnimName", (item: AnimItem | undefined) => {
      if (item?.kind === "clip") return vscode.env.clipboard.writeText(item.clip.name);
      if (item?.kind === "made") return vscode.env.clipboard.writeText(item.anim.name);
    }),
    vscode.commands.registerCommand("edgedir.animFitsOn", () => animations.setFilter("fits", true)),
    vscode.commands.registerCommand("edgedir.animFitsOff", () => animations.setFilter("fits", false)),
    vscode.commands.registerCommand("edgedir.animCarriedOn", () => animations.setFilter("carried", true)),
    vscode.commands.registerCommand("edgedir.animCarriedOff", () => animations.setFilter("carried", false)),

    // An animation from the view becomes a clip on the selected actor track, at the playhead.
    vscode.commands.registerCommand("edgedir.addToTrack", async (item: AnimItem | undefined) => {
      if (item?.kind !== "clip" && item?.kind !== "made") return;
      // A game animation is named by its set; a made one by its item's id, which never changes.
      const anim =
        item.kind === "clip"
          ? { set: item.set, name: item.clip.name, rig: item.rig || undefined, seconds: item.clip.seconds }
          : { id: item.anim.id, name: item.anim.name, rig: item.anim.rig || undefined, seconds: item.anim.seconds, title: item.anim.title };
      const front = scenes.current();
      const doc = frontDoc();
      if (!front || !doc) return void vscode.window.showWarningMessage("EDGEdir: open a scene first. The animation goes on its selected actor track, at the playhead.");
      const actors = doc.tracks.filter((t) => t.kind === "actor");
      const picked = actors.find((t) => t.id === front.track) ?? (actors.length === 1 ? actors[0] : undefined);
      if (!picked) return void vscode.window.showWarningMessage(actors.length ? "EDGEdir: select the actor track the animation should go on." : "EDGEdir: the scene has no actor track yet. Add one with Add Track.");
      try {
        let made = "";
        await applyEdit(front.document, (d) => {
          const result = addAnimClip(d, picked.id, anim, front.playhead);
          made = result.id;
          return result.doc;
        });
        scenes.select(front.document, made);
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

    vscode.commands.registerCommand("edgedir.refreshSets", () => setsView.refresh()),
    vscode.commands.registerCommand("edgedir.revealSet", (item: SetItem | undefined) => {
      if (item?.kind === "set") return vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(item.set.file));
    }),
    // A new scene on the Desk that plays on a set, with a track for each of its people.
    vscode.commands.registerCommand("edgedir.newSceneOnSet", async (item: SetItem | undefined) => {
      const set = item?.kind === "set" ? item.set : await pickSet("New Scene on a Set");
      if (!set || set.error) return;
      const name = await vscode.window.showInputBox({
        title: `New Scene on "${set.name}"`,
        prompt: "A name for the scene. It is made on the Desk and plays where the set is, with a track for each of the set's people.",
        value: listDesk().some((s) => s.name.toLowerCase() === set.name.toLowerCase()) ? "" : set.name,
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
        const text = fs.readFileSync(set.file, "utf8");
        const info = parseSet(text);
        const actors = await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: "EDGEdir: reading the set's people" }, () => actorsOf(info.people));
        const first = addSetPeople(chooseSet(newDoc(name.trim()), linkTo(set.where, set.path, info, hashOf(text))), info, actors).doc;
        const scene = newScene(name, undefined, first);
        desk.refresh();
        setsView.refresh();
        await openScene(vscode.Uri.file(scene.file));
        if (info.vehicles) void vscode.window.showInformationMessage(`EDGEdir: "${set.name}" has ${info.vehicles} vehicle${info.vehicles === 1 ? "" : "s"}. Vehicles have no track yet.`);
      } catch (e) {
        fail("New Scene on This Set", e);
      }
    }),

    vscode.commands.registerCommand("edgedir.newSequence", async () => {
      const name = await nameBox("New Sequence", "A name for the sequence: a run of clips and transitions for one rig, kept on the Desk.");
      if (name === undefined) return;
      const base = (who: string) => `base\\characters\\base_entities\\${who}_base\\${who}_base.rig`;
      const track = frontDoc()?.tracks.find((t) => t.id === scenes.current()?.track);
      const own = track?.actor?.rig && !track.actor.standIn ? track.actor : undefined;
      const rigs = [
        ...(own ? [{ label: `${own.name ?? "The selected actor"}'s rig`, description: rigName(own.rig), rig: own.rig! }] : []),
        { label: "The feminine base rig", description: "woman_base", rig: base("woman") },
        { label: "The masculine base rig", description: "man_base", rig: base("man") },
      ];
      const rig = await vscode.window.showQuickPick(rigs, { title: `New Sequence: "${name.trim()}"`, placeHolder: "Which rig is the sequence for? It goes onto any actor with that rig" });
      if (!rig) return;
      try {
        const item = newSequence(name, newSeq(name.trim(), rig.rig));
        desk.refresh();
        await openScene(vscode.Uri.file(item.file));
      } catch (e) {
        fail("New Sequence", e);
      }
    }),

    // A sequence from the Desk becomes one block on the selected actor track, at the playhead.
    vscode.commands.registerCommand("edgedir.addSequenceToTrack", async (item: unknown) => {
      const picked = sceneOf(item);
      const seq = picked?.kind === "sequence" ? refOf(picked.id) : undefined;
      if (!picked || !seq) return;
      const front = scenes.current();
      const doc = frontDoc();
      if (!front || !doc) return void vscode.window.showWarningMessage("EDGEdir: open a scene first. The sequence goes on its selected actor track, at the playhead.");
      const actors = doc.tracks.filter((t) => t.kind === "actor");
      const lane = actors.find((t) => t.id === front.track) ?? (actors.length === 1 ? actors[0] : undefined);
      if (!lane) return void vscode.window.showWarningMessage(actors.length ? "EDGEdir: select the actor track the sequence should go on." : "EDGEdir: the scene has no actor track yet. Add one with Add Track.");
      try {
        let made = "";
        await applyEdit(front.document, (d) => {
          const result = addSeqClip(d, lane.id, seq, front.playhead);
          made = result.id;
          return result.doc;
        });
        scenes.select(front.document, made);
        const now = frontDoc();
        const track = now && findTrack(now, lane.id);
        const clip = track?.clips.find((c) => c.id === made);
        const why = track && clip ? unfit(track, clip) : undefined;
        if (why) void vscode.window.showWarningMessage(`EDGEdir: ${why}. The block is on the track, marked unfit.`);
      } catch (e) {
        if (e instanceof EditError) void vscode.window.showWarningMessage(`EDGEdir: ${e.message}`);
        else fail("Add to Track", e);
      }
    }),

    vscode.commands.registerCommand("edgedir.openScene", (uri: vscode.Uri) => openScene(uri)),
    vscode.commands.registerCommand("edgedir.refreshDesk", () => desk.refresh()),

    vscode.commands.registerCommand("edgedir.renameScene", async (item: unknown) => {
      const scene = sceneOf(item);
      if (!scene) return;
      const name = await vscode.window.showInputBox({
        title: scene.kind === "sequence" ? "Rename Sequence" : "Rename Scene",
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
        // A renamed sequence: the open scenes' blocks take its name, and say how they stand now.
        if (scene.kind === "sequence") {
          for (const d of scenes.documents()) await sequences.sync(d);
          scenes.resend();
        }
        if (wasOpen) await openScene(vscode.Uri.file(renamed.file));
      } catch (e) {
        fail("Rename Scene", e);
        desk.refresh();
      }
    }),

    vscode.commands.registerCommand("edgedir.deleteScene", async (item: unknown) => {
      const scene = sceneOf(item);
      if (!scene) return;
      const go = await vscode.window.showWarningMessage(`Delete the ${scene.kind === "sequence" ? "sequence" : "scene"} "${scene.name}" from the Desk?`, { modal: true, detail: scene.kind === "sequence" ? "Its folder goes to the Recycle Bin, so it can be brought back from there. Scenes that use it keep their own copy of its clips." : "Its folder goes to the Recycle Bin, so it can be brought back from there." }, "Delete");
      if (go !== "Delete") return;
      const wasOpen = tabsOf(scene.folder).length > 0;
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
        } else if (wasOpen) await openScene(vscode.Uri.file(scene.file)); // Kept after all: its tab comes back.
      }
      desk.refresh();
      setsView.refresh();
      // Once more after a moment: seen once, the list kept an empty Sequences heading after the last one went.
      setTimeout(() => desk.refresh(), 700);
      // Open scenes that link a deleted sequence say so at once.
      scenes.resend();
    }),

    vscode.commands.registerCommand("edgedir.revealScene", (item: unknown) => {
      const file = sceneOf(item)?.file ?? ((item as DeskItem | undefined)?.kind === "recent" ? (item as { file: string }).file : undefined);
      return vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(file ?? deskDir()));
    }),

    vscode.commands.registerCommand("edgedir.forgetRecent", (item: unknown) => {
      if ((item as DeskItem | undefined)?.kind === "recent") return desk.forget((item as { file: string }).file);
    }),
  );

  // What the other EDGE tools may call (docs/api.md).
  return makeApi(String(context.extension.packageJSON.version), game);
}

export function deactivate(): void {}
