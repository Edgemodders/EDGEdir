// The game's files, for the extension: where the game and REDbridge are, the bridge itself, and what
// EDGEdir reads through it and keeps on the PC (the cast, the animation sets). REDcode is not
// required: its running bridge is used when it reads the same game, and otherwise EDGEdir starts
// REDbridge itself, as EDGEquest does (its extension.ts). docs/d2-cast-and-clips.md.
import * as vscode from "vscode";
import { AnimIndex } from "./core/animIndex";
import { AnimSets, gameKey } from "./core/animSets";
import { BridgeClient } from "./core/bridgeClient";
import { Cast } from "./core/cast";
import { defaultCacheDir, resolveBridge, resolveGame, type GameChoice } from "./core/config";
import { readEntity, type EntityFacts } from "./core/entity";
import { findMade, libraryAnims, libraryRoot, projectAnims, type MadeAnim } from "./core/made";
import { PreviewStore, type PreviewFile } from "./core/preview";
import type { BodyWant, ClipWant } from "./pose";

/** What the Animations view's welcome text is chosen by (package.json, `edgedir.state`). */
export type GameState = "starting" | "noGame" | "noBridge" | "loading" | "ready" | "failed";

interface OtherApi {
  apiVersion: number;
  gamePath(): string | undefined;
  bridge?(): BridgeClient | undefined;
  /** REDcode's open project. */
  project?(): { dir: string; name: string } | undefined;
  onDidChangeProject?: vscode.Event<unknown>;
}

function settings(key: string): string | undefined {
  const dot = key.indexOf(".");
  const v = vscode.workspace.getConfiguration(key.slice(0, dot)).get<string>(key.slice(dot + 1), "");
  return v && v.trim() ? v.trim() : undefined;
}

/** An extension's API, only when the extension is already active: activating another here could race a reload. */
function activeApi(id: string): OtherApi | undefined {
  const ext = vscode.extensions.getExtension<OtherApi>(id);
  const api = ext?.isActive ? ext.exports : undefined;
  return api?.apiVersion === 1 ? api : undefined;
}
const redcode = () => activeApi("edgemodders.redcode-cyberpunk");
const edgedeck = () => activeApi("edgemodders.edgedeck");

export class Game {
  readonly cast = new Cast(defaultCacheDir());
  readonly sets = new AnimSets(defaultCacheDir());
  /** The animations inside each set. Filled in the background; empty with a REDbridge that has no `anims.info`. */
  readonly index = new AnimIndex(defaultCacheDir());
  /** The 3D preview's bodies and animations, exported once each (D3). */
  readonly preview = new PreviewStore(defaultCacheDir());
  /** The game that is read, as `gameKey` names it; empty until it is known. */
  private key = "";
  /** Where reading the animations stands, in a sentence, for the view. */
  clipsNote = "The animations inside each file are not read yet.";
  private clipsRun: Promise<void> | undefined;
  /** Whether the animations inside the files are being read just now. */
  get readingClips(): boolean {
    return !!this.clipsRun;
  }
  private stopping = false;
  state: GameState = "starting";
  /** Where the game and the bridge were found, in plain words, for the view. */
  where = "";
  /** Why the last try failed, when `state` is "failed". */
  problem = "";

  private readonly output = vscode.window.createOutputChannel("EDGEdir");
  private readonly changed = new vscode.EventEmitter<void>();
  /** The state, the cast or the sets changed. */
  readonly onDidChange = this.changed.event;
  private own: BridgeClient | undefined;
  private ownGame = "";
  private loading: Promise<void> | undefined;
  private readonly entities = new Map<string, EntityFacts>();

  private log(line: string): void {
    this.output.appendLine(`${new Date().toISOString().slice(11, 19)} ${line}`);
  }

  private set(state: GameState, problem = ""): void {
    this.state = state;
    this.problem = problem;
    void vscode.commands.executeCommand("setContext", "edgedir.state", state);
    this.changed.fire();
  }

  private findGame(search: boolean): Promise<GameChoice | undefined> {
    return resolveGame(settings, { redcodeGamePath: () => redcode()?.gamePath(), edgedeckGamePath: () => edgedeck()?.gamePath() }, search);
  }

  /** REDcode's running bridge when it reads the same game; otherwise EDGEdir's own, started once. */
  private async bridgeFor(game: GameChoice): Promise<{ bridge: BridgeClient; from: string } | undefined> {
    const rc = redcode();
    const shared = rc?.bridge?.();
    if (shared?.running && rc?.gamePath()?.toLowerCase() === game.path.toLowerCase()) return { bridge: shared, from: "REDcode's REDbridge" };
    if (this.own?.running && this.ownGame === game.path) return { bridge: this.own, from: "EDGEdir's own REDbridge" };
    this.own?.stop();
    const choice = resolveBridge(settings);
    if (!choice) return undefined;
    this.log(`Starting REDbridge from ${choice.exe} (${choice.from}) for ${game.path}`);
    const b = new BridgeClient({ exe: choice.exe, gamePath: game.path, dotnetRoot: choice.dotnetRoot });
    b.on("log", (line: string) => this.output.appendLine(`  bridge | ${line}`));
    b.on("exit", (code: number | null) => this.log(`REDbridge exited (${code}); it starts again when needed`));
    b.on("error", (e: Error) => this.log(`REDbridge could not start: ${e.message}`));
    b.start();
    const info = await b.info();
    if (!info.gameLoaded) await b.load(game.path);
    this.log(`REDbridge ${info.version}, WolvenKit ${info.wolvenKit}`);
    this.own = b;
    this.ownGame = game.path;
    return { bridge: b, from: `REDbridge at ${choice.exe} (${choice.from})` };
  }

  /** The REDcode project that is open, if REDcode is running and has one. */
  project(): { dir: string; name: string } | undefined {
    return redcode()?.project?.();
  }

  private madeAt = 0;
  private madeList: { project: MadeAnim[]; library: MadeAnim[] } = { project: [], library: [] };
  /**
   * The animations made in EDGEfab: the open project's and the Library's. Read from disk, and kept
   * for a few seconds so that drawing the view does not walk the Library at every line.
   */
  made(fresh = false): { project: MadeAnim[]; library: MadeAnim[] } {
    if (fresh || Date.now() - this.madeAt > 5000) {
      this.madeList = { project: projectAnims(this.project()?.dir), library: libraryAnims(libraryRoot()) };
      this.madeAt = Date.now();
    }
    return this.madeList;
  }

  /** Reads the made animations again and draws the view again. */
  refreshMade(): void {
    this.made(true);
    this.changed.fire();
  }

  /** The game's folder, when one is set or was found; nothing is searched for. */
  async gameFolder(): Promise<string | undefined> {
    return (await this.findGame(false))?.path;
  }

  /** The bridge, started when needed. Throws with a message fit to show. */
  async bridge(): Promise<BridgeClient> {
    const game = await this.findGame(false);
    if (!game) throw new Error("No Cyberpunk 2077 folder is set (the setting edgedir.gamePath, or REDcode's).");
    const found = await this.bridgeFor(game);
    if (!found) throw new Error("REDbridge was not found (the setting edgedir.bridgePath, or REDcode's).");
    return found.bridge;
  }

  /**
   * Finds the game and the bridge, then loads what was read before, or reads it now: the cast and
   * the animation sets. `rebuild` reads both again.
   */
  refresh(rebuild = false): Promise<void> {
    this.loading ??= this.load(rebuild).finally(() => (this.loading = undefined));
    return this.loading;
  }

  private async load(rebuild: boolean): Promise<void> {
    try {
      const game = await this.findGame(true);
      if (!game) return this.set("noGame");
      const found = await this.bridgeFor(game);
      if (!found) return this.set("noBridge");
      this.where = `${game.path} (${game.from}), through ${found.from}`;
      this.set("loading");
      const key = gameKey(await found.bridge.info());
      this.key = key;
      const todo: [string, () => Promise<void>][] = [];
      if (rebuild || !this.cast.load(key)) todo.push(["the characters", () => this.cast.build(found.bridge, key, (t) => report?.report({ message: t }))]);
      if (rebuild || !this.sets.load(key)) todo.push(["the animation files", () => this.sets.build(found.bridge, key, (t) => report?.report({ message: t }))]);
      let report: vscode.Progress<{ message?: string }> | undefined;
      if (todo.length)
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "EDGEdir is reading the game" }, async (progress) => {
          report = progress;
          for (const [what, run] of todo) {
            this.log(`Reading ${what}`);
            await run();
          }
        });
      this.entities.clear();
      this.log(`${this.cast.entries.length.toLocaleString()} characters, ${this.sets.sets.length.toLocaleString()} animation files, for ${this.where}`);
      if (!this.index.load(key) || rebuild) this.index.game = "";
      this.set("ready");
      this.readClips(found.bridge, key, rebuild);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.log(`Reading the game failed: ${message}`);
      this.set("failed", message);
    }
  }

  /**
   * Reads the animations inside each set, in the background, from where the last session stopped.
   * The whole game takes some minutes; the view fills as it goes.
   */
  private readClips(bridge: BridgeClient, key: string, again: boolean): void {
    if (this.clipsRun) return;
    if (this.index.complete && this.index.game === key && !again) {
      this.clipsNote = `${this.index.clips.toLocaleString()} animations in ${this.index.setsRead.toLocaleString()} files${this.index.failed ? `; ${this.index.failed} files could not be read` : ""}.`;
      this.changed.fire();
      return;
    }
    this.clipsRun = (async () => {
      try {
        let last = 0;
        const ok = await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: "EDGEdir" }, (progress) =>
          this.index.build(bridge, key, {
            again,
            stop: () => this.stopping,
            progress: (text) => {
              progress.report({ message: text });
              this.clipsNote = `${text}. Still reading.`;
              // The view is drawn again every few seconds, not at every page.
              if (Date.now() - last > 4000) {
                last = Date.now();
                this.changed.fire();
              }
            },
          }),
        );
        if (!ok) {
          this.clipsNote = "This REDbridge cannot list the animations inside a file (it needs REDbridge 0.14.0 or newer; REDcode's Install REDbridge fetches it). The files are listed; their animations are not.";
          this.log(this.clipsNote);
        } else {
          this.clipsNote = `${this.index.clips.toLocaleString()} animations in ${this.index.setsRead.toLocaleString()} files${this.index.failed ? `; ${this.index.failed} files could not be read` : ""}.`;
          this.log(`Animations read: ${this.clipsNote}`);
        }
      } catch (e) {
        this.clipsNote = `Reading the animations stopped: ${e instanceof Error ? e.message : String(e)}. What was read is kept; Read the Game Again goes on.`;
        this.log(this.clipsNote);
      } finally {
        this.clipsRun = undefined;
        this.changed.fire();
      }
    })();
  }

  /** An entity's rig, appearances and animation sets, read once per game path. */
  async entity(path: string): Promise<EntityFacts> {
    const key = path.toLowerCase();
    const known = this.entities.get(key);
    if (known) return known;
    const bridge = await this.bridge();
    const result = await bridge.toJson(path);
    if (!result.json) throw new Error(`REDbridge gave no JSON for ${path}`);
    const facts = readEntity(result.json);
    this.entities.set(key, facts);
    return facts;
  }

  /** The bridge and the game's key, for the preview. Throws with a message fit to show in the viewport. */
  private async forPreview(): Promise<{ bridge: BridgeClient; key: string }> {
    if (this.loading) await this.loading;
    const bridge = await this.bridge();
    this.key ||= gameKey(await bridge.info());
    return { bridge, key: this.key };
  }

  /** An actor's body for the preview: found on the PC, or exported now (a few seconds). */
  async previewBody(want: BodyWant): Promise<PreviewFile> {
    const { bridge, key } = await this.forPreview();
    const made = await this.preview.body(bridge, key, want, async () => (want.entity ? (await this.entity(want.entity)).appearances[0] : undefined));
    if (!made.cached) this.log(`Preview: exported ${want.player ? `V's body (${want.player})` : `${want.entity} (${want.appearance ?? "first appearance"})`}`);
    return made;
  }

  /** An animation for the preview: a game one exported by itself, or a made one from its own file. */
  async previewClip(want: ClipWant): Promise<PreviewFile> {
    if (want.id) {
      const { project, library } = this.made();
      const item = findMade(want.id, project, library);
      if (!item) throw new Error(`The made animation ${want.name} is not in the open project or the Library any more`);
      if (!item.file) throw new Error(`The made animation ${want.name} has no clip file`);
      return this.preview.made(want.id, item.file);
    }
    const { bridge, key } = await this.forPreview();
    return this.preview.clip(bridge, key, want);
  }

  showLog(): void {
    this.output.show(true);
  }

  dispose(): void {
    this.stopping = true;
    this.own?.stop();
    this.output.dispose();
    this.changed.dispose();
  }
}
