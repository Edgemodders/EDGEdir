// Types for play.mjs, for EDGEdir's own unit tests.
export const SET: string;
export function slug(text: unknown, max?: number): string;
export function placements(sheet: unknown, stage: unknown, v: { x: number; y: number; z: number; fx: number; fy: number } | null): Record<string, { position: { x: number; y: number; z: number }; yaw: number }>;
export function sceneFor(stage: unknown, sheet: unknown): { objects: { id: string }[]; [more: string]: unknown };
export function refusal(sheet: unknown): string | undefined;
export interface PlayerState {
  id?: string;
  state: string;
  text: string;
  startedAt?: number;
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
  respawned(before: { hash: string }, after: { hash: string }): void;
}
