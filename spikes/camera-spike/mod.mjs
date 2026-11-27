// EDGEdir camera spike (D6c): docs/d6-audio-camera-weather.md, "The spike first". Through api and
// world only. Each button is one step; every call, its answer and its time go to the log, and
// what the view does is for the player to say.
//
// The route is the one EDGEbuilder's Edit and REDnode's World objects test use: a bare entity
// with a gameCameraComponent, Activate(blendTime, false) to take the view, world.move to place
// it, and V's own first person camera activated again to give the view back.
//
//   1 Cut       does the view cut cleanly to the camera, and back to V
//   2 Shots     a second shot by moving the one camera while it is on, and by a second camera
//   3 Lens      what the field of view does at a cut (SetFOV is said to ease over about 1 s)
//   4 V         what V does during a shot: Watch logs V's place each second while the player
//               tries to walk; and V's scene tier raised, for a scene the player must not leave
//   5 Blend     Activate with a blend time: a move between V's view and the shot, or nothing
//   6 Ended     the package ended (REDnode's Mod Manager) with its camera on: what is V's view

import { api, game, ui, world } from 'rednode';

const NAME = 'edgedir_spike_camera';
// A bare entity from the game's own files: the one EDGEbuilder's camera uses.
const EMPTY = 'base\\gameplay\\loot\\containers\\common_suitcases\\appearances\\suitcase_small_placeholder.ent';
const EYE = 1.6; // metres above V's feet

let cams = {}; // { a: { id, component }, b: ... }
let fovFirst = true; // set the field of view before the camera is switched on
let tierBefore;
let busy = '';

const status = ui.text('Load a save on open ground, then go down the buttons. Say what the view does at each.', { tone: 'dim' });
const log = ui.list({ keep: 500 });
function say(text) {
  log.push(`${new Date().toLocaleTimeString()}  ${text}`);
  console.log(text);
}
async function step(label, fn) {
  if (busy) return say(`${label}: not run, ${busy} is still running`);
  busy = label;
  const started = performance.now();
  try {
    const note = await fn();
    say(`${label}: ${note ?? 'done'} (${(performance.now() - started).toFixed(0)} ms)`);
  } catch (err) {
    say(`${label} failed: ${err.message}`);
  } finally {
    busy = '';
  }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (p) => `${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`;

async function player() {
  const v = await api.GetPlayer(game.instance);
  if (!v) throw new Error('No player: load a save first');
  return v;
}

// The yaw world.spawn takes: 0 faces +Y.
const yawOf = (f) => (Math.atan2(f.Y, f.X) * 180) / Math.PI - 90;

// A turn about the vertical axis, then a tilt down (positive) or up about the camera's own side axis.
function turn(yaw, down = 0) {
  const y = (yaw * Math.PI) / 360;
  const p = (-down * Math.PI) / 360;
  return { i: Math.cos(y) * Math.sin(p), j: Math.sin(y) * Math.sin(p), k: Math.sin(y) * Math.cos(p), r: Math.cos(y) * Math.cos(p) };
}

// A place `ahead` metres in front of V and `side` to V's right, at eye height, looking at V.
async function shot(ahead, side) {
  const v = await player();
  const p = await v.GetWorldPosition();
  const f = await v.GetWorldForward();
  const at = { x: p.X + f.X * ahead + f.Y * side, y: p.Y + f.Y * ahead - f.X * side, z: p.Z + EYE };
  const yaw = (Math.atan2(p.Y - at.y, p.X - at.x) * 180) / Math.PI - 90;
  return { position: at, yaw, vYaw: yawOf(f) };
}

async function activeFov() {
  const sys = await api.GameInstance.GetCameraSystem(game.instance);
  return sys ? Number(await sys.GetActiveCameraFOV()) : NaN;
}

async function make(key, ahead, side) {
  if (cams[key]) return `camera ${key} is there already`;
  const s = await shot(ahead, side);
  const component = await api.$new('gameCameraComponent', { name: `${NAME}_${key}` });
  const { id, entity } = await world.spawn({ template: EMPTY, position: s.position, yaw: s.yaw, components: [component], alwaysSpawned: true, tags: ['edgedir-camera-spike'] });
  const found = entity ? await entity.FindComponentByName(`${NAME}_${key}`) : null;
  cams[key] = { id, component: found ?? component };
  return `camera ${key} at ${fmt(s.position)}, yaw ${s.yaw.toFixed(0)}; the component was ${found ? 'found on the entity' : 'not found by name, the made one is used'}`;
}

function cam(key) {
  const c = cams[key];
  if (!c) throw new Error(`no camera ${key}: press Make the cameras first`);
  return c;
}

async function cutTo(key, blend = 0) {
  const c = cam(key);
  const before = await activeFov();
  const t = performance.now();
  await c.component.Activate(blend, false);
  const took = performance.now() - t;
  await wait(100);
  return `Activate(${blend}, false) answered in ${took.toFixed(0)} ms; the active field of view read ${before.toFixed(1)} before and ${(await activeFov()).toFixed(1)} 100 ms after. Did the view cut to the camera at once? Is V in the picture, with a head?`;
}

async function backToV(blend = 0) {
  for (const c of Object.values(cams)) await c.component.Deactivate(blend, false).catch((err) => say(`Deactivate: ${err.message}`));
  const v = await player();
  const fpp = await v.GetFPPCameraComponent();
  if (!fpp) throw new Error("V's camera is not available");
  await fpp.Activate(blend, false);
  return `Deactivate and V's own Activate(${blend}, false). Is the view V's again, at once, and the right way up?`;
}

async function moveTo(key, ahead, side, down = 0) {
  const c = cam(key);
  const s = await shot(ahead, side);
  const t = performance.now();
  const ok = await world.move(c.id, s.position, down ? turn(s.yaw, down) : undefined, down ? undefined : s.yaw);
  return `world.move answered ${ok} in ${(performance.now() - t).toFixed(0)} ms: ${fmt(s.position)}, yaw ${s.yaw.toFixed(0)}${down ? `, tilted ${down} down` : ''}. Did the view jump there in one frame, or slide?`;
}

async function lens(key, fov) {
  const c = cam(key);
  const before = await activeFov();
  await c.component.SetFOV(fov);
  return `SetFOV(${fov}) from ${before.toFixed(1)}: ${await lensReads([0, 250, 500, 1000, 1500])}. Did the lens jump or ease?`;
}

// The active field of view read at each of these moments, in ms from now.
async function lensReads(moments) {
  const reads = [];
  let last = 0;
  for (const ms of moments) {
    await wait(ms - last);
    last = ms;
    reads.push(`${ms} ms ${(await activeFov()).toFixed(1)}`);
  }
  return reads.join(', ');
}

// A cut with a new lens, in the order the player would do it: lens, place, on (or on first).
async function cutWithLens(key, fov, ahead, side) {
  const c = cam(key);
  const s = await shot(ahead, side);
  if (fovFirst) await c.component.SetFOV(fov);
  await world.move(c.id, s.position, undefined, s.yaw);
  await c.component.Activate(0, false);
  if (!fovFirst) await c.component.SetFOV(fov);
  return `lens ${fov} set ${fovFirst ? 'before' : 'after'} the camera went on: ${await lensReads([50, 250, 500, 1000])}. Was the lens right from the first frame, or did it drift?`;
}

async function watch() {
  const v = await player();
  const first = await v.GetWorldPosition();
  for (let s = 1; s <= 10; s += 1) {
    await wait(1000);
    const p = await v.GetWorldPosition();
    say(`  ${s} s: V moved ${Math.hypot(p.X - first.X, p.Y - first.Y).toFixed(2)} m, tier ${await readTier().catch((err) => `(${err.message})`)}, lens ${(await activeFov()).toFixed(1)}`);
  }
  return 'watched 10 s. Could you walk V, turn, shoot, open the menu? What did the view do when V moved?';
}

// V's scene tier, on V's player state blackboard, as EDGEbuilder sets it to hide the HUD.
async function tierBoard() {
  const v = await player();
  const defs = await api.GetAllBlackboardDefs();
  const psm = await defs.$get('PlayerStateMachine');
  const system = await api.GameInstance.GetBlackboardSystem(game.instance);
  const board = await system.GetLocalInstanced(await v.GetEntityID(), psm);
  if (!board) throw new Error("V's player state blackboard is not there");
  return { board, id: await psm.$get('SceneTier') };
}
async function readTier() {
  const { board, id } = await tierBoard();
  return Number(await board.GetInt(id));
}
async function setTier(value) {
  const { board, id } = await tierBoard();
  const before = Number(await board.GetInt(id));
  if (tierBefore === undefined) tierBefore = before;
  await board.SetInt(id, value, true);
  await wait(200);
  return `scene tier ${before} -> ${value}, reads ${Number(await board.GetInt(id))} after 200 ms. Can V walk? Look around? Is the HUD there? Press Watch 10 s and try`;
}
async function tierBack() {
  if (tierBefore === undefined) return 'the tier was not changed';
  const to = tierBefore === 0 ? 1 : tierBefore;
  const note = await setTier(to);
  tierBefore = undefined;
  return note;
}

async function removeAll() {
  await backToV().catch((err) => say(`back to V: ${err.message}`));
  let n = 0;
  for (const c of Object.values(cams)) if (await world.remove(c.id).catch(() => false)) n += 1;
  cams = {};
  const tier = await tierBack().catch((err) => err.message);
  return `${n} cameras removed; ${tier}`;
}

ui.window({
  title: 'EDGEdir camera spike (D6c)',
  anchor: 'left',
  x: 40,
  y: 60,
  width: 700,
  height: 860,
  closable: true,
  children: [
    status,
    ui.heading('1. Cut'),
    ui.row(
      ui.button('Make the cameras', () => step('Make the cameras', async () => `${await make('a', 4, 0)}; ${await make('b', 3, 3)}`)),
      ui.button('Cut to camera A', () => step('Cut to A', () => cutTo('a'))),
      ui.button('Back to V', () => step('Back to V', () => backToV())),
    ),
    ui.heading('2. Shots'),
    ui.row(
      ui.button('Move A to V\'s right', () => step('Move A', () => moveTo('a', 2, 3))),
      ui.button('Move A in front, tilted down', () => step('Move A, tilted', () => moveTo('a', 4, 0, 20))),
      ui.button('Cut to camera B', () => step('Cut to B', () => cutTo('b'))),
    ),
    ui.heading('3. Lens'),
    ui.row(
      ui.button('A: lens 25', () => step('Lens 25', () => lens('a', 25))),
      ui.button('A: lens 50', () => step('Lens 50', () => lens('a', 50))),
      ui.button('A: lens 80', () => step('Lens 80', () => lens('a', 80))),
    ),
    ui.toggle('Set the lens before the camera goes on (off: after)', (on) => (fovFirst = on), { checked: true }),
    ui.row(
      ui.button('Back to V, then cut to A with lens 25', () => step('Cut with lens 25', async () => {
        await backToV();
        await wait(1500);
        return cutWithLens('a', 25, 4, 0);
      })),
      ui.button('From B, cut to A with lens 80', () => step('Cut with lens 80', async () => {
        await cutTo('b');
        await wait(1500);
        return cutWithLens('a', 80, 2, -3);
      })),
    ),
    ui.heading('4. V during a shot'),
    ui.row(
      ui.button('Watch 10 s', () => step('Watch', watch)),
      ui.button('Scene tier 3', () => step('Scene tier 3', () => setTier(3)), { variant: 'ghost' }),
      ui.button('Scene tier 4', () => step('Scene tier 4', () => setTier(4)), { variant: 'ghost' }),
      ui.button('Scene tier 5', () => step('Scene tier 5', () => setTier(5)), { variant: 'ghost' }),
      ui.button('Tier back', () => step('Tier back', tierBack)),
    ),
    ui.heading('5. Blend'),
    ui.row(
      ui.button('To A over 2 s', () => step('To A over 2 s', () => cutTo('a', 2))),
      ui.button('To B over 2 s', () => step('To B over 2 s', () => cutTo('b', 2))),
      ui.button('Back to V over 2 s', () => step('Back to V over 2 s', () => backToV(2))),
    ),
    ui.heading('6. Ended with the camera on'),
    ui.text("Cut to camera A, then end this package in REDnode's Mod Manager (turn it off). Say what the view is. If V has no view, turn the package on again and press Back to V; if that does not help, load the save.", { tone: 'dim' }),
    ui.row(ui.button('Remove everything', () => step('Remove everything', removeAll), { variant: 'ghost' })),
    log,
  ],
});
say('EDGEdir camera spike 0.1.0 ready');
