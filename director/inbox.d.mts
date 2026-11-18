// Types for inbox.mjs.
export function playDir(): string;
export function put(dir: string, name: string, value: unknown): void;
export function watchInbox(player: { play(request: never): unknown; stop(): unknown }, version: string, dir?: string): () => void;
