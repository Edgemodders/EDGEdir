// A sequence (`<name>.edgeseq`, D4b): a run of animation clips and transitions for one rig, stored
// by itself and put onto any actor with that rig as one block. This file is the sequence's own
// document: reading and writing it, and showing it to the scene editor as a scene with one actor
// lane and a stand-in body. The block on a lane is src/doc.ts's. No VS Code and no page in here.
// docs/d4-transitions.md, "Sequences".
import { clipEnd, formatDoc, parseDoc, type Clip, type SceneDoc } from "./doc";

export const SeqExtension = ".edgeseq";

export interface SeqDoc {
  edgeseq: 1;
  name: string;
  /** The rig the sequence is made for, a game path. Empty when not known yet. */
  rig: string;
  /** Frames a second, as a scene has. */
  fps: number;
  /** An actor track's clips, starting at 0. */
  clips: Clip[];
  [more: string]: unknown;
}

/** The id of the one lane a sequence shows in the editor. */
export const SeqTrack = "t1";

export function newSeq(name: string, rig: string, clips: Clip[] = [], fps = 30): SeqDoc {
  return { edgeseq: 1, name, rig, fps, clips };
}

/** How long a run of clips is: the end of the last. */
export function runLength(clips: Clip[]): number {
  let end = 0;
  for (const c of clips) end = Math.max(end, clipEnd(c));
  return end;
}

/**
 * A sequence as the scene editor shows it: one actor lane, whose actor is a stand-in body for the
 * rig. Fields the scene has and a sequence has not are filled with a scene's plain ones.
 */
export function seqAsScene(seq: SeqDoc): SceneDoc {
  return {
    edgedir: 1,
    name: seq.name,
    fps: seq.fps,
    anchor: { mode: "player" },
    set: null,
    tracks: [{ id: SeqTrack, kind: "actor", name: seq.name || "Sequence", actor: { standIn: true, name: "The base body", ...(seq.rig ? { rig: seq.rig } : {}) }, clips: seq.clips }],
  };
}

/** The sequence after an edit made to its scene view: the name, the frame rate and the lane's clips. */
export function sceneAsSeq(doc: SceneDoc, was: SeqDoc): SeqDoc {
  const lane = doc.tracks.find((t) => t.id === SeqTrack) ?? doc.tracks.find((t) => t.kind === "actor");
  return { ...was, name: doc.name, fps: doc.fps, clips: lane?.clips ?? [] };
}

/** A sequence from its text; throws with a readable message when it is not one. */
export function parseSeq(text: string): SeqDoc {
  let d: unknown;
  try {
    d = JSON.parse(text);
  } catch (e) {
    throw new Error(`Not valid JSON: ${(e as Error).message}`);
  }
  const seq = d as Partial<SeqDoc> | null;
  if (!seq || typeof seq !== "object" || Array.isArray(seq) || typeof seq.edgeseq !== "number") throw new Error('Not an EDGEdir sequence ("edgeseq": 1 is missing)');
  if (seq.edgeseq > 1) throw new Error(`This sequence was made by a newer EDGEdir (document version ${seq.edgeseq}; this one reads 1). Update EDGEdir to open it`);
  if (seq.edgeseq !== 1) throw new Error(`Not an EDGEdir sequence ("edgeseq": ${seq.edgeseq} is not a version)`);
  if (!Array.isArray(seq.clips)) throw new Error("The sequence's clips are missing");
  if (typeof seq.name !== "string") seq.name = "";
  if (typeof seq.rig !== "string") seq.rig = "";
  if (typeof seq.fps !== "number" || !(seq.fps > 0)) seq.fps = 30;
  if (seq.clips.some((c) => c && (c as Clip).kind === "sequence")) throw new Error("A sequence cannot hold another sequence");
  // The clips are an actor lane's: a scene's own checks read them.
  const lane = parseDoc(formatDoc(seqAsScene(seq as SeqDoc))).tracks[0];
  return { ...(seq as SeqDoc), clips: lane.clips };
}

export function formatSeq(seq: SeqDoc): string {
  return JSON.stringify(seq, null, 2) + "\n";
}

/** Whether a file is a sequence, by its name. */
export const isSeqFile = (file: string) => file.toLowerCase().endsWith(SeqExtension);

/** A scene or a sequence from its file's text, as the scene editor's document. */
export function readScene(file: string, text: string): SceneDoc {
  return isSeqFile(file) ? seqAsScene(parseSeq(text)) : parseDoc(text);
}

/** The text of a scene or a sequence after an edit; `was` is the text before, which a sequence keeps its other fields from. */
export function writeScene(file: string, doc: SceneDoc, was: string): string {
  if (!isSeqFile(file)) return formatDoc(doc);
  let before: SeqDoc;
  try {
    before = parseSeq(was);
  } catch {
    before = newSeq(doc.name, "");
  }
  return formatSeq(sceneAsSeq(doc, before));
}
