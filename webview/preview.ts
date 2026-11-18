// The 3D preview (D3): each actor track's body on its mark, in the pose under the playhead. The
// bodies and animations are .glb files the host exports from the game once and keeps on the PC; the
// page asks for each by a key and loads it from the address in the answer. Which clip plays and
// where an actor stands are src/pose.ts's and src/doc.ts's rules; this file only draws them.
// The way of loading and playing is REDcode's animation view's (its webview/animViewer.ts at 6d62625).
import type { Stage } from "../src/set";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { markOf, type SceneDoc, type Track } from "../src/doc";
import { bodies, bodyKey, bodyWant, clipKey, clipWant, clipsNear, poseAt, type BodyWant, type ClipWant } from "../src/pose";
import { weatherAt, weatherLabel, weatherTint } from "../src/weather";

/** The host's answer to a `want`. */
export interface Got {
  key: string;
  url?: string;
  notes?: string[];
  error?: string;
}

/** One of the scene's pins (DR3): its title, and metres right and forward of the scene's origin. */
export interface Post {
  title: string;
  x: number;
  y: number;
}

/** One of the set's props (D5a), from the scene's origin, in the game's axes. */
type Prop = Stage["props"][number];

export interface Preview {
  /** The scene as it is now (or as a drag would leave it), the playhead and the selected track. */
  sync(doc: SceneDoc | null, time: number, selected: string, props?: Prop[], pins?: Post[]): void;
  got(m: Got): void;
  frame(): void;
  /** What the preview has, for tests of the page: bodies standing, files waited for, and the note. */
  state(): { bodies: number; props: number; pins?: number; weather?: string; waiting: number; failed: number; note: string; poses: Record<string, Shown> };
}

interface Loaded {
  state: "asked" | "ready" | "failed";
  error?: string;
  /** What was asked for, to ask again. */
  what: { body?: BodyWant; clip?: ClipWant };
  /** Whether it was asked for a second time by itself. */
  retried?: boolean;
  notes: string[];
  scene?: THREE.Object3D;
  clip?: THREE.AnimationClip;
}

/** What a body shows: the clip and the moment, and under a transition the clip mixed in. */
interface Shown {
  clip: string;
  t: number;
  mix?: { method: string; from: string; t: number; share: number };
}

interface Standing {
  key: string;
  group: THREE.Group;
  ring: THREE.Mesh;
  root?: THREE.Object3D;
  mixer?: THREE.AnimationMixer;
  /** The clips playing now, each with its action. */
  actions: Map<THREE.AnimationClip, THREE.AnimationAction>;
  bones: THREE.Bone[];
  /** Inertial: the join the difference was measured for, and the difference, bone by bone. */
  deltaKey: string;
  delta: { q: THREE.Quaternion; p: THREE.Vector3 }[];
  /** What the last offset wrote on each bone, and what the player had set, to take it back. */
  written: { bone: THREE.Bone; q: THREE.Quaternion; p: THREE.Vector3; baseQ: THREE.Quaternion; baseP: THREE.Vector3 }[];
  /** What is shown, for `state`. */
  shows: Shown;
}

/** How far ahead of the playhead clips are loaded, in seconds. */
const Ahead = 3;
const Height = 1.9;

export function mountPreview(stage: HTMLElement, noteEl: HTMLElement, send: (m: { type: "want"; key: string; body?: BodyWant; clip?: ClipWant }) => void): Preview {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    noteEl.textContent = `The 3D preview could not start (${e instanceof Error ? e.message : String(e)}). The timeline works as before.`;
    return { sync: () => undefined, got: () => undefined, frame: () => undefined, state: () => ({ bodies: 0, props: 0, waiting: 0, failed: 0, note: noteEl.textContent ?? "", poses: {} }) };
  }
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000000, 0);
  stage.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 500);
  camera.position.set(2.4, 1.6, 3.6);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.9, 0);
  controls.update();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  // The ground, a metre a square, and the scene's origin.
  const grid = new THREE.GridHelper(40, 40, 0x3a4660, 0x1c2434);
  scene.add(grid);
  const origin = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.06, 24), new THREE.MeshBasicMaterial({ color: 0xfcee0a, side: THREE.DoubleSide }));
  origin.rotation.x = -Math.PI / 2;
  origin.position.y = 0.002;
  scene.add(origin);

  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x9aa3b5, roughness: 0.75, metalness: 0 });
  const ringGeometry = new THREE.RingGeometry(0.3, 0.33, 40);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x4a5670, side: THREE.DoubleSide });
  const ringSelected = new THREE.MeshBasicMaterial({ color: 0x19f3ff, side: THREE.DoubleSide });

  // Drawn only when something changed: an editor's page should not spin the fan while it is still.
  let queued = false;
  const draw = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      renderer.render(scene, camera);
    });
  };
  controls.addEventListener("change", draw);
  const resize = () => {
    const w = stage.clientWidth || 1;
    const h = stage.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    draw();
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  const loader = new GLTFLoader();
  const files = new Map<string, Loaded>();
  const standing = new Map<string, Standing>();
  let doc: SceneDoc | null = null;
  let time = 0;
  let selected = "";
  // D5a: the set's props, as plain boxes.
  const boxes = new THREE.Group();
  scene.add(boxes);
  const boxMaterial = new THREE.MeshStandardMaterial({ color: 0x566178, roughness: 0.9, metalness: 0, transparent: true, opacity: 0.55 });
  const boxLines = new THREE.LineBasicMaterial({ color: 0x8793ab });
  let boxesKey = "";
  const setProps = (props: Prop[]) => {
    const key = JSON.stringify(props);
    if (key === boxesKey) return;
    boxesKey = key;
    for (const o of [...boxes.children]) {
      boxes.remove(o);
      o.traverse((x) => (x as THREE.Mesh).geometry?.dispose());
    }
    for (const p of props) {
      // The game's x is right, y forward and z up; here y is up and the game's y is -z.
      const g = new THREE.BoxGeometry(Math.max(p.size[0], 0.02), Math.max(p.size[2], 0.02), Math.max(p.size[1], 0.02));
      const holder = new THREE.Group();
      holder.position.set(p.x, p.z, -p.y);
      holder.rotation.y = (p.yaw * Math.PI) / 180;
      const box = new THREE.Mesh(g, boxMaterial);
      box.position.set(p.centre[0], p.centre[2], -p.centre[1]);
      box.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), boxLines));
      holder.add(box);
      boxes.add(holder);
    }
  };
  let shownWeather = "";
  // DR3: the scene's pins, as thin posts with their titles.
  const posts = new THREE.Group();
  scene.add(posts);
  const postMaterial = new THREE.MeshBasicMaterial({ color: 0xf2e600 });
  let postsKey = "";
  const setPins = (pins: Post[]) => {
    const key = JSON.stringify(pins);
    if (key === postsKey) return;
    postsKey = key;
    for (const o of [...posts.children]) {
      posts.remove(o);
      o.traverse((x) => {
        (x as THREE.Mesh).geometry?.dispose();
        const m = (x as THREE.Sprite).material as THREE.SpriteMaterial | undefined;
        if (x instanceof THREE.Sprite && m) {
          m.map?.dispose();
          m.dispose();
        }
      });
    }
    for (const p of pins) {
      const holder = new THREE.Group();
      // The game's x is right and y forward; here y is up and the game's y is -z.
      holder.position.set(p.x, 0, -p.y);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.2, 6), postMaterial);
      post.position.y = 1.1;
      holder.add(post);
      const canvas = document.createElement("canvas");
      const c = canvas.getContext("2d");
      if (c) {
        canvas.width = 512;
        canvas.height = 64;
        c.font = "600 34px system-ui, sans-serif";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillStyle = "#f2e600";
        c.fillText(p.title.length > 26 ? `${p.title.slice(0, 25)}…` : p.title, 256, 32);
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false }));
        label.scale.set(2, 0.25, 1);
        label.position.y = 2.36;
        holder.add(label);
      }
      posts.add(holder);
    }
  };
  /** The modder moved the view: it is theirs now, and new bodies no longer fit it again. */
  let touched = false;
  controls.addEventListener("start", () => (touched = true));
  let retryTimer = 0;

  /** Asks again for every file that failed: the bridge may be there now. */
  function retry(auto = false) {
    for (const [key, f] of files) {
      if (f.state !== "failed" || (auto && f.retried)) continue;
      f.state = "asked";
      f.error = undefined;
      f.retried = true;
      send({ type: "want", key, ...f.what });
    }
    apply();
  }

  /** Asks the host for a file once; the answer comes to `got`. */
  function want(key: string, what: { body?: BodyWant; clip?: ClipWant }): Loaded {
    let f = files.get(key);
    if (!f) {
      f = { state: "asked", notes: [], what };
      files.set(key, f);
      send({ type: "want", key, ...what });
    }
    return f;
  }

  async function got(m: Got): Promise<void> {
    const f = files.get(m.key);
    if (!f || f.state === "ready") return;
    try {
      if (m.error || !m.url) throw new Error(m.error ?? "the host gave no file");
      const response = await fetch(m.url);
      if (!response.ok) throw new Error(`the file could not be loaded (${response.status})`);
      const gltf = await loader.parseAsync(await response.arrayBuffer(), "");
      f.notes = m.notes ?? [];
      if (m.key.startsWith("a|") || m.key.startsWith("m|")) {
        f.clip = gltf.animations[0];
        if (!f.clip) throw new Error("the file holds no animation");
      } else {
        // Exported without materials: one plain material, and no culling by the rest pose's bounds.
        gltf.scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.material = bodyMaterial;
          mesh.frustumCulled = false;
        });
        f.scene = gltf.scene;
      }
      f.state = "ready";
    } catch (e) {
      f.state = "failed";
      f.error = e instanceof Error ? e.message : String(e);
      // Once more by itself after a moment: a bridge that was starting is up by then. After that, Frame asks again.
      if (!f.retried) {
        clearTimeout(retryTimer);
        retryTimer = window.setTimeout(() => retry(true), 5000);
      }
    }
    apply();
    // Each new body fits the view again, until the modder moves it.
    if (f.scene && !touched) frame();
  }

  function remove(id: string) {
    const s = standing.get(id);
    if (!s) return;
    undo(s);
    s.mixer?.stopAllAction();
    scene.remove(s.group);
    standing.delete(id);
  }

  /** Puts a track's body in the scene when its file is there; each track gets its own copy. */
  function stand(track: Track, key: string, file: Loaded): Standing {
    let s = standing.get(track.id);
    if (s && s.key !== key) {
      remove(track.id);
      s = undefined;
    }
    if (!s) {
      const group = new THREE.Group();
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.003;
      group.add(ring);
      scene.add(group);
      s = { key, group, ring, actions: new Map(), bones: [], deltaKey: "", delta: [], written: [], shows: { clip: "", t: 0 } };
      standing.set(track.id, s);
    }
    if (!s.root && file.scene) {
      s.root = cloneSkinned(file.scene);
      s.group.add(s.root);
      s.mixer = new THREE.AnimationMixer(s.root);
      s.root.traverse((o) => {
        if ((o as THREE.Bone).isBone) s!.bones.push(o as THREE.Bone);
      });
    }
    return s;
  }

  /** One clip at a moment, with its weight in the mix. */
  interface Part {
    clip: THREE.AnimationClip;
    t: number;
    weight: number;
  }

  /**
   * A second copy of a clip, for when both sides of a transition are the same animation: the player
   * keeps one moment for each clip, so the two sides need a clip each.
   */
  const twins = new Map<THREE.AnimationClip, THREE.AnimationClip>();
  const twin = (clip: THREE.AnimationClip) => twins.get(clip) ?? (twins.set(clip, clip.clone()), twins.get(clip)!);

  /** Takes back what `offset` added, so the player finds the bones as it left them. */
  function undo(s: Standing) {
    for (const w of s.written) {
      if (w.bone.quaternion.equals(w.q)) w.bone.quaternion.copy(w.baseQ);
      if (w.bone.position.equals(w.p)) w.bone.position.copy(w.baseP);
    }
    s.written = [];
  }

  /** Plays the parts given and nothing else, each at its moment and weight. */
  function play(s: Standing, parts: Part[]) {
    if (!s.mixer) return;
    undo(s);
    for (const [clip, action] of s.actions)
      if (!parts.some((p) => p.clip === clip)) {
        // Stopping an action puts the bones back as the body was made.
        action.stop();
        s.actions.delete(clip);
      }
    for (const part of parts) {
      let action = s.actions.get(part.clip);
      if (!action) {
        action = s.mixer.clipAction(part.clip);
        action.play();
        action.paused = true;
        s.actions.set(part.clip, action);
      }
      action.time = Math.min(Math.max(part.t, 0), part.clip.duration);
      action.setEffectiveWeight(part.weight);
    }
    s.mixer.update(0);
  }

  /**
   * Inertial: the difference between A's pose and B's pose at the moment B started, bone by bone,
   * of which `share` is added on top of the pose the player just set. Kept for each join.
   */
  function offset(s: Standing, key: string, a: Part, b: Part, share: number, now: Part) {
    if (!s.bones.length) return;
    if (s.deltaKey !== key) {
      play(s, [{ ...a, weight: 1 }]);
      const poseA = s.bones.map((bone) => ({ q: bone.quaternion.clone(), p: bone.position.clone() }));
      play(s, [{ ...b, weight: 1 }]);
      s.delta = s.bones.map((bone, n) => ({ q: bone.quaternion.clone().invert().multiply(poseA[n].q), p: poseA[n].p.clone().sub(bone.position) }));
      s.deltaKey = key;
    }
    play(s, [now]);
    const none = new THREE.Quaternion();
    s.bones.forEach((bone, n) => {
      const d = s.delta[n];
      const baseQ = bone.quaternion.clone();
      const baseP = bone.position.clone();
      bone.quaternion.multiply(none.clone().slerp(d.q, share));
      bone.position.addScaledVector(d.p, share);
      s.written.push({ bone, q: bone.quaternion.clone(), p: bone.position.clone(), baseQ, baseP });
    });
  }

  /** Everything the scene asks for at this time: bodies on their marks, in their poses, and the note. */
  function apply() {
    const lines: string[] = [];
    /** What could not be loaded, by reason: one reason is said once, however many files it stopped. */
    const failed = new Map<string, string[]>();
    const fail = (reason: string | undefined, what: string) => failed.set(reason ?? "", [...(failed.get(reason ?? "") ?? []), what]);
    let loading = 0;
    const tracks = doc ? bodies(doc) : [];
    for (const id of [...standing.keys()]) if (!tracks.some((t) => t.id === id)) remove(id);
    for (const track of tracks) {
      const who = track.actor?.name ?? track.name;
      const w = bodyWant(track.actor);
      if (!w) {
        remove(track.id);
        lines.push(`${who}: the body is not known yet. Choose the actor again with the game's files there`);
        continue;
      }
      const key = bodyKey(w);
      const file = want(key, { body: w });
      const s = stand(track, key, file);
      const mark = markOf(doc!, track.id);
      // The game's x is to the right and its y is forward; the files have y up and the game's y as -z.
      s.group.position.set(mark.x, 0, -mark.y);
      s.group.rotation.y = (mark.yaw * Math.PI) / 180;
      s.ring.material = track.id === selected ? ringSelected : ringMaterial;
      if (file.state === "asked") loading++;
      if (file.state === "failed") fail(file.error, `${who}'s body`);
      if (track.actor?.player && file.state === "ready") lines.push("V: the game's base body, without a head, stands in for your V");

      const pose = poseAt(track, time);
      for (const c of clipsNear(track, time, Ahead)) want(clipKey(c), { clip: c });
      if (pose.passed) lines.push(`${who}: "${pose.passed.name ?? (pose.passed.anim as { name?: string }).name}" is passed over (made for another rig)`);
      const cw = pose.play && clipWant(pose.play.anim);
      if (!cw) {
        play(s, []);
        s.shows = { clip: "", t: 0 };
        continue;
      }
      const clip = files.get(clipKey(cw));
      if (clip?.state === "failed") fail(clip.error, `"${cw.name}"`);
      else if (clip?.state !== "ready") loading++;
      // Not here yet: the body keeps the pose it has.
      if (clip?.state !== "ready" || !clip.clip) continue;
      const b: Part = { clip: clip.clip, t: pose.t, weight: 1 };
      // Under a transition the first clip is mixed in, when it is here too.
      const mw = pose.mix && clipWant(pose.mix.play.anim);
      const other = mw && files.get(clipKey(mw));
      if (!pose.mix || !mw || other?.state !== "ready" || !other.clip) {
        if (other?.state === "failed") fail(other.error, `"${mw!.name}"`);
        play(s, [b]);
        s.shows = { clip: cw.name, t: pose.t };
        continue;
      }
      const first = other.clip === clip.clip ? twin(other.clip) : other.clip;
      if (pose.mix.method === "blend") play(s, [{ ...b, weight: 1 - pose.mix.share }, { clip: first, t: pose.mix.t, weight: pose.mix.share }]);
      else offset(s, `${pose.mix.transition.id}|${clipKey(mw)}|${pose.mix.t.toFixed(4)}|${clipKey(cw)}|${pose.mix.start.toFixed(4)}`, { clip: first, t: pose.mix.t, weight: 1 }, { clip: clip.clip, t: pose.mix.start, weight: 1 }, pose.mix.share, b);
      s.shows = { clip: cw.name, t: pose.t, mix: { method: pose.mix.method, from: mw.name, t: pose.mix.t, share: pose.mix.share } };
    }
    for (const [reason, what] of failed) lines.unshift(`Not loaded: ${what.length > 3 ? `${what.slice(0, 3).join(", ")} and ${what.length - 3} more` : what.join(", ")}. ${reason.replace(/[.\s]+$/, "")}. Frame tries again`);
    if (loading) lines.unshift(`Loading ${loading} file${loading === 1 ? "" : "s"} from the game…`);
    if (doc && !tracks.length) lines.push(doc.tracks.some((t) => t.kind === "actor") ? "Choose an actor on an actor track, and its body stands here." : "Add an actor track and choose an actor, and its body stands here.");
    // D6a: the weather the lane holds at this moment. No rain or fog is drawn: a name and a tint.
    const sky = doc ? weatherAt(doc, time) : undefined;
    stage.dataset.weather = sky ? (weatherTint(sky.state) ?? "plain") : "";
    shownWeather = sky ? weatherLabel(sky.state) : "";
    if (sky) lines.unshift(`Weather: ${shownWeather}`);
    noteEl.textContent = lines.join("  ·  ");
    noteEl.title = [...lines, ...new Set(tracks.flatMap((t) => { const w = bodyWant(t.actor); return w ? (files.get(bodyKey(w))?.notes ?? []).map((n) => `${t.actor?.name ?? t.name}: ${n}`) : []; }))].join("\n");
    draw();
  }

  function frame() {
    const box = new THREE.Box3();
    for (const s of standing.values()) {
      // Room for arms out and for a clip that lies down.
      box.expandByPoint(new THREE.Vector3(s.group.position.x - 0.9, -0.1, s.group.position.z - 0.9));
      box.expandByPoint(new THREE.Vector3(s.group.position.x + 0.9, Height, s.group.position.z + 0.9));
    }
    // The set's props are part of the picture.
    if (boxes.children.length) box.union(new THREE.Box3().setFromObject(boxes));
    if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, Height, 0.5));
    const centre = box.getCenter(new THREE.Vector3());
    const radius = box.getBoundingSphere(new THREE.Sphere()).radius;
    const fov = (Math.min(camera.fov, camera.fov * camera.aspect) * Math.PI) / 360;
    // A little inside the sphere: bodies are tall and thin, and the corners of their box are empty.
    const distance = (radius * 0.8) / Math.sin(Math.max(fov, 0.1));
    camera.position.copy(centre).add(new THREE.Vector3(0.45, 0.25, 1).normalize().multiplyScalar(distance));
    controls.target.copy(centre);
    controls.update();
    draw();
  }

  return {
    sync(next, t, sel, props, pins) {
      setProps(next ? (props ?? []) : []);
      setPins(next ? (pins ?? []) : []);
      doc = next;
      time = t;
      selected = sel;
      apply();
    },
    got: (m) => void got(m),
    frame() {
      retry();
      frame();
    },
    state: () => ({
      bodies: [...standing.values()].filter((s) => s.root).length,
      props: boxes.children.length,
      pins: posts.children.length,
      weather: shownWeather,
      waiting: [...files.values()].filter((f) => f.state === "asked").length,
      failed: [...files.values()].filter((f) => f.state === "failed").length,
      note: noteEl.textContent ?? "",
      poses: Object.fromEntries([...standing].map(([id, s]) => [id, s.shows])),
    }),
  };
}
