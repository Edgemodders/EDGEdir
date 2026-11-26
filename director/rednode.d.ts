// The parts of REDnode's `rednode` module EDGE Director uses. The REDnode host gives the module
// to the page and to the Node mod, so it is never bundled (esbuild.mjs marks it external).
declare module "rednode" {
  type Id = { hash: string } | string;
  type Point = { x: number; y: number; z: number };
  export const api: { GetPlayer(game: unknown): Promise<{ GetWorldPosition(): Promise<{ X: number; Y: number; Z: number }>; GetWorldForward(): Promise<{ X: number; Y: number; Z: number }> } | null> };
  export const game: {
    instance: unknown;
    player: { position(): Promise<Point>; teleport(to: Point & { yaw?: number }): Promise<void> };
  };
  export const world: {
    writeWorkspot(name: string, options: unknown): Promise<{ path: string }>;
    spawn(options: unknown): Promise<{ id: Id }>;
    useWorkspot(id: Id, options: unknown): Promise<{ id?: Id; started?: boolean; why?: string }>;
    jumpWorkspot(id: Id, entry: string): Promise<boolean>;
    remove(id: Id): Promise<boolean>;
    move(id: Id, position: Point, orientation?: unknown, yaw?: number): Promise<boolean>;
    setWeather(state: string, options?: { blend?: number; priority?: number }): Promise<{ applied: boolean; changed: boolean; state: string }>;
    resetWeather(): Promise<unknown>;
    load(scene: unknown, options: unknown): Promise<{ skipped?: { object: string; why: string }[]; notes?: string[] }>;
    unload(name: string): Promise<number>;
    entity(id: unknown): Promise<{ SetIndividualTimeDilation(reason: string, dilation: number, duration?: number, easeInCurve?: string, easeOutCurve?: string): Promise<void>; UnsetIndividualTimeDilation(easeOutCurve?: string): Promise<void>; GetTimeDilationValue(): Promise<number>; HasIndividualTimeDilation(reason?: string): Promise<boolean> } | null>;
    onRespawn(handler: (before: { hash: string }, after: { hash: string }) => void): void;
    pin(options: { at: unknown; title: string; text?: string }): Promise<number>;
    unpin(id: number): Promise<unknown>;
  };
  export const audio: {
    /** Plays a WAV, OGG, MP3 or FLAC from the package's folder or its data folder. `start` and `end` are seconds into the file; `fadeIn` is milliseconds. */
    play(sound: string, options?: { start?: number; end?: number; volume?: number; fadeIn?: number; category?: "sfx" | "dialogue" | "music" }): Promise<{ stop(options?: { fadeOut?: number }): Promise<void> }>;
    /** Posts one of the game's sound events, on V. Experimental in REDnode. */
    event(name: string, options?: { on?: "player" | "none" }): Promise<{ stop(): Promise<void> }>;
  };
  /** The package: `dataDir` is its own folder for files it makes while it runs. */
  export const pkg: { readonly dataDir: string };
  export const channel: { post(data: unknown): void; on<T = unknown>(handler: (data: T) => void): () => void };
}
