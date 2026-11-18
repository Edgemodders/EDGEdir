// Types for play.mjs, for EDGEdir's own unit tests.
export const SET: string;
export function slug(text: unknown, max?: number): string;
export function placements(sheet: unknown, stage: unknown, v: { x: number; y: number; z: number; fx: number; fy: number } | null): Record<string, { position: { x: number; y: number; z: number }; yaw: number }>;
export function sceneFor(stage: unknown, sheet: unknown): { objects: { id: string }[]; [more: string]: unknown };
export function refusal(sheet: unknown): string | undefined;
export interface Frame { mode: string; o: { x: number; y: number; z: number }; f: { x: number; y: number }; turn: number }
export function turnOf(fx: number, fy: number): number;
export function frameOf(sheet: unknown, stage: unknown, v: { x: number; y: number; z: number; fx: number; fy: number } | null): Frame;
export function placeOf(frame: Frame, at: { x?: number; y?: number; yaw?: number } | undefined, z?: number): { position: { x: number; y: number; z: number }; yaw: number };
export function markAt(frame: Frame, position: { x: number; y: number }, yaw: number): { x: number; y: number; yaw: number };
export function weatherAt(cues: { t: number; state?: string; reset?: true }[] | undefined, from: number): { t: number; state?: string; blend?: number } | undefined;
export function entryAt(sheet: unknown, member: unknown, from: number): string;
export interface PlayerState {
  id?: string;
  state: string;
  text: string;
  startedAt?: number;
  loop?: boolean;
  length?: number;
  late?: { t: number; track: string; jump: string; ms: number; ok: boolean }[];
  notes?: string[];
  error?: string;
}
export class Player {
  constructor(deps: Record<string, unknown>);
  state(): PlayerState;
  play(request: unknown): Promise<PlayerState>;
  stop(quiet?: boolean): Promise<PlayerState>;
  seek(from: number, loop?: boolean): Promise<boolean>;
  setLoop(on: boolean): void;
  cast(): { track: string; name: string; id?: unknown; position: { x: number; y: number; z: number }; yaw: number }[];
  frame(): Frame | undefined;
  reframe(frame: Frame): void;
  place(track: string, position: { x: number; y: number; z: number }, yaw: number): Promise<boolean>;
  respawned(before: { hash: string }, after: { hash: string }): void;
}
