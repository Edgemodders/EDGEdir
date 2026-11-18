// EDGE Director's service: what another package, or EDGEdir through REDnode's editor channel
// (REDnode #48, when it is built), may call. It runs in this package's Node mod, after mod.mjs.

const player = () => {
  const p = globalThis.edgedirPlayer;
  if (!p) throw new Error("EDGE Director has not started yet");
  return p;
};

/**
 * Plays a scene from its start: writes each actor's workspot, spawns the cast and runs the cues.
 * Answers when the scene has started or failed; ask `state` for how it goes on.
 * @param {object} request `{ id, sheet, stage? }`: EDGEdir's cue sheet (cues: 1), and the set it plays on.
 * @returns {object} The play's state: `state`, `text`, `startedAt`, `late`.
 */
export function play(request) {
  return player().play(request);
}

/**
 * Stops the play and removes the cast and the set.
 * @returns {object} The play's state.
 */
export function stop() {
  return player().stop();
}

/**
 * What the play is doing: idle, writing, loading, spawning, warming, playing, ended, stopped or failed.
 * @readonly
 * @returns {object} The play's state.
 */
export function state() {
  return player().state();
}
