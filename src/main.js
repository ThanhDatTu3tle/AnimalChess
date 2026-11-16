import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  COLS, ROWS, WATER, ANIMALS, initialBoard, genMoves, applyMove, winner, boardKey,
  moveFrom, moveTo, idx, colOf, rowOf, ownerOf, rankOf, DEN_CELL,
} from './rules.js';
import { buildWorld } from './scene/world.js';
import { TEAM, BIOMES, BIOME_IDS, DEFAULT_BIOMES, setTeams, distinctFrom } from './scene/biomes.js';
import { buildAnimal } from './scene/animals.js';
import { G, mesh, TILE_Y, WATER_Y, cellX, cellZ } from './scene/helpers.js';
import { Net, makeCode, cleanCode } from './net.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

// ---------------- Renderer / scene ----------------
const app = $('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
// màn hình độ phân giải cao: giới hạn 1.5 (khử răng cưa đã có MSAA), tiết kiệm ~45% số pixel phải tô
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0.1);
controls.enablePan = false;
controls.enableDamping = true;
controls.minPolarAngle = 0.15;
controls.maxPolarAngle = 1.25;
controls.minAzimuthAngle = -1.1;
controls.maxAzimuthAngle = 1.1;
controls.minDistance = 8;
controls.maxDistance = 30;

scene.add(new THREE.HemisphereLight(0xffffff, 0xcfe8a0, 1.9));
const sun = new THREE.DirectionalLight(0xfff2d6, 2.5);
sun.position.set(-7, 13, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun);

// ---------------- Biome ----------------
// Lựa chọn trong menu (lưu lại cho lần sau); biome đang dựng trên map là TEAM[0].id / TEAM[1].id
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('cothu3d.' + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('cothu3d.' + k, JSON.stringify(v)); } catch { /* bỏ qua */ } },
};
const validBiome = (b) => BIOME_IDS.includes(b);
let biomePick = store.get('biomes', DEFAULT_BIOMES).filter(validBiome);
if (biomePick.length !== 2 || biomePick[0] === biomePick[1]) biomePick = [...DEFAULT_BIOMES];
let onlineBiome = validBiome(store.get('biomeOnline')) ? store.get('biomeOnline') : biomePick[0];
if (validBiome(params.get('b0'))) biomePick[0] = params.get('b0');
if (validBiome(params.get('b1'))) biomePick[1] = distinctFrom(params.get('b1'), biomePick[0]);

setTeams(biomePick[0], biomePick[1]);
let world = buildWorld(scene);

/** Đổi biome hai phe: dựng lại map (quân cờ do nơi gọi dựng lại) */
function applyBiomes(b0, b1) {
  if (TEAM[0].id === b0 && TEAM[1].id === b1) return false;
  setTeams(b0, b1);
  world.dispose();
  world = buildWorld(scene);
  world.setFlipped(viewSide === 1);
  updateTeamUI();
  return true;
}
function updateTeamUI() {
  const root = document.documentElement.style;
  root.setProperty('--a', TEAM[0].css);
  root.setProperty('--b', TEAM[1].css);
  for (const s of [0, 1]) $('name' + s).textContent = TEAM[s].name;
  $('tagline').textContent = `${TEAM[0].name} đối đầu ${TEAM[1].name}: chiếm hang địch để chiến thắng!`;
}
const piecesRoot = new THREE.Group();
const markersRoot = new THREE.Group();
scene.add(piecesRoot, markersRoot);

let viewSide = 0;
function fitCamera(reset) {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (reset) {
    const d = 19.5 * Math.max(1, 1.3 / camera.aspect);
    const flip = viewSide === 1;
    controls.target.set(0, 0, flip ? -0.1 : 0.1);
    controls.minAzimuthAngle = flip ? Math.PI - 1.1 : -1.1;
    controls.maxAzimuthAngle = flip ? -Math.PI + 1.1 : 1.1;
    camera.position.setFromSphericalCoords(d, 0.64, (flip ? Math.PI : 0) + 0.12).add(controls.target);
    controls.update();
  }
}
addEventListener('resize', () => fitCamera(false));
fitCamera(true);
function setView(side) {
  if (side === viewSide) return;
  viewSide = side;
  world.setFlipped(side === 1);
  fitCamera(true);
}

// ---------------- Tween ----------------
const tweens = [];
const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
function tween(dur, fn, delay = 0) {
  return new Promise((res) => tweens.push({ t: -delay, dur, fn, res }));
}
function lerpAngle(a, b, k) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

// ---------------- Âm thanh ----------------
let audioCtx = null, soundOn = true;
function beep(freq, dur = 0.12, type = 'triangle', vol = 0.12, slide = 0) {
  if (!soundOn) return;
  try {
    audioCtx ??= new AudioContext();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), audioCtx.currentTime + dur);
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch { /* bỏ qua */ }
}
const sfx = {
  select: () => beep(660, 0.07, 'sine', 0.08),
  move: () => beep(330, 0.1, 'triangle', 0.12, 120),
  splash: () => beep(500, 0.18, 'sine', 0.1, -300),
  jump: () => beep(260, 0.3, 'triangle', 0.12, 500),
  capture: () => { beep(180, 0.2, 'sawtooth', 0.12, -100); setTimeout(() => beep(520, 0.12, 'square', 0.06), 60); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.25, 'triangle', 0.14), i * 130)),
};

// ---------------- Trạng thái ván ----------------
const game = {
  board: initialBoard(), turn: 0, mode: 'menu', level: 2, human: 0,
  history: [], seen: {}, captured: [[], []], lastMove: null,
  selected: -1, legal: [], busy: false, winner: -1, aiId: 0,
};
const pieces = new Map(); // cell -> Object3D

const cellPos = (i, out = new THREE.Vector3()) => out.set(cellX(colOf(i)), WATER[i] ? WATER_Y - 0.17 : TILE_Y, cellZ(rowOf(i)));
const homeFacing = (team) => (team === 0 ? Math.PI : 0);

function rebuildPieces() {
  piecesRoot.traverse((o) => { if (o.userData.merged) o.geometry.dispose(); });
  piecesRoot.clear();
  pieces.clear();
  for (let i = 0; i < game.board.length; i++) {
    const v = game.board[i];
    if (!v) continue;
    const o = buildAnimal(rankOf(v), ownerOf(v));
    cellPos(i, o.position);
    o.userData.model.rotation.y = homeFacing(ownerOf(v));
    o.userData.cell = i;
    piecesRoot.add(o);
    pieces.set(i, o);
  }
}

// ---------------- Đánh dấu ----------------
const mk = {
  sel: new THREE.MeshBasicMaterial({ color: 0xffe14d }),
  move: new THREE.MeshBasicMaterial({ color: 0x4dff9a, transparent: true, opacity: 0.85, depthWrite: false }),
  cap: new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0.9, depthWrite: false }),
  last: new THREE.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0.38, depthWrite: false }),
};
const markerY = (i) => (WATER[i] ? WATER_Y + 0.03 : TILE_Y + 0.045);
function refreshMarkers() {
  markersRoot.clear();
  if (game.lastMove) for (const c of game.lastMove) {
    const m = mesh(markersRoot, G.box(0.86, 0.01, 0.86), mk.last, { p: [cellX(colOf(c)), markerY(c) - 0.025, cellZ(rowOf(c))], cast: false, receive: false });
    m.renderOrder = 1;
  }
  if (game.selected >= 0) {
    const s = game.selected;
    const ring = mesh(markersRoot, G.torus(0.43, 0.035, 6, 28), mk.sel, { p: [cellX(colOf(s)), markerY(s), cellZ(rowOf(s))], r: [Math.PI / 2, 0, 0], cast: false, receive: false });
    ring.userData.pulse = true;
    for (const m of game.legal) {
      const t = moveTo(m), x = cellX(colOf(t)), z = cellZ(rowOf(t));
      if (game.board[t]) {
        const r = mesh(markersRoot, G.torus(0.42, 0.05, 6, 28), mk.cap, { p: [x, markerY(t), z], r: [Math.PI / 2, 0, 0], cast: false, receive: false });
        r.userData.pulse = true;
      } else {
        const d = mesh(markersRoot, G.cyl(0.17, 0.17, 0.02, 20), mk.move, { p: [x, markerY(t), z], cast: false, receive: false });
        d.userData.pulse = true;
        mesh(markersRoot, G.torus(0.3, 0.02, 5, 24), mk.move, { p: [x, markerY(t), z], r: [Math.PI / 2, 0, 0], cast: false, receive: false });
      }
    }
  }
}

const TRAIT = { 1: 'bơi được dưới sông, hạ được Voi', 6: 'nhảy được qua sông', 7: 'nhảy được qua sông', 8: 'mạnh nhất, chỉ sợ Chuột' };
function select(cell) {
  game.selected = cell;
  game.legal = cell >= 0 ? genMoves(game.board, game.turn).filter((m) => moveFrom(m) === cell) : [];
  refreshMarkers();
  updateHud();
}

// ---------------- HUD ----------------
const isAI = (side) => game.mode === 'demo' || (game.mode === 'ai' && side !== game.human);
function updateHud() {
  $('p0').classList.toggle('active', game.turn === 0 && game.winner < 0);
  $('p1').classList.toggle('active', game.turn === 1 && game.winner < 0);
  const online = game.mode === 'online';
  $('who0').textContent = online ? (game.human === 0 ? 'Bạn' : 'Đối thủ') : isAI(0) ? 'Máy' : game.mode === 'pvp' ? 'Người chơi 1' : 'Bạn';
  $('who1').textContent = online ? (game.human === 1 ? 'Bạn' : 'Đối thủ') : isAI(1) ? 'Máy' : game.mode === 'pvp' ? 'Người chơi 2' : 'Bạn';
  for (const s of [0, 1]) $('cap' + s).textContent = game.captured[s].map((r) => ANIMALS[r].emoji).join('');
  const st = $('status');
  if (game.winner === 2) st.innerHTML = '🤝 Hoà cờ';
  else if (game.winner >= 0) st.innerHTML = `🏆 ${TEAM[game.winner].name} thắng!`;
  else if (game.mode === 'menu') st.textContent = 'Cờ Thú 3D';
  else st.innerHTML = `Lượt của <span style="color:${TEAM[game.turn].css}">${TEAM[game.turn].name}</span>` + (game.selected >= 0 ? selHint() : isAI(game.turn) ? '<small>Máy đang nghĩ…</small>' : online ? `<small>${!net.connected ? 'Đối thủ đã rời phòng' : game.turn === game.human ? 'Đến lượt bạn!' : 'Chờ đối thủ đi…'}</small>` : '');
  $('btnUndo').disabled = game.history.length === 0 || game.mode === 'demo' || online || game.busy;
}

function selHint() {
  const r = rankOf(game.board[game.selected]);
  const a = ANIMALS[r];
  return `<small>${a.emoji} ${a.name} · cấp ${r}${TRAIT[r] ? ' · ' + TRAIT[r] : ''}${game.legal.length ? '' : ' · hết đường đi'}</small>`;
}

// ---------------- Hiệu ứng ----------------
function poof(pos, color = 0xffffff) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
  const parts = [];
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const p = mesh(scene, G.sphere(0.1, 8, 6), mat, { p: [pos.x, pos.y + 0.35, pos.z], cast: false, receive: false });
    parts.push([p, Math.cos(a), 0.4 + (k % 3) * 0.3, Math.sin(a)]);
  }
  tween(0.55, (k) => {
    for (const [p, dx, dy, dz] of parts) {
      p.position.set(pos.x + dx * k * 0.6, pos.y + 0.35 + dy * k * 0.6, pos.z + dz * k * 0.6);
      p.scale.setScalar(1 + k * 0.8);
    }
    mat.opacity = 1 - k;
  }).then(() => { for (const [p] of parts) scene.remove(p); mat.dispose(); });
}

async function playMove(m, remote = false) {
  const from = moveFrom(m), to = moveTo(m);
  if (game.mode === 'online' && !remote) net.send({ t: 'move', m, n: game.history.length });
  const obj = pieces.get(from), victim = pieces.get(to);
  game.busy = true;
  select(-1);
  game.history.push({ board: game.board.slice(), turn: game.turn, captured: game.captured.map((a) => a.slice()), lastMove: game.lastMove, seen: { ...game.seen } });
  const cap = applyMove(game.board, m);
  if (cap) game.captured[game.turn].push(rankOf(cap));
  pieces.delete(from);
  pieces.set(to, obj);
  obj.userData.cell = to;

  const p0 = obj.position.clone(), p1 = cellPos(to);
  const dist = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  const jump = dist > 1.5;
  const model = obj.userData.model, arm = obj.userData.armR;
  const a0 = model.rotation.y, a1 = Math.atan2(p1.x - p0.x, p1.z - p0.z);
  const dur = jump ? 0.62 : 0.34, h = jump ? 1.5 : 0.38;
  if (jump) sfx.jump(); else if (WATER[to]) sfx.splash(); else sfx.move();
  obj.userData.acting = true;
  if (victim) {
    const vm = victim.userData.model;
    tween(0.4, (k) => {
      vm.rotation.y += 0.5;
      victim.scale.setScalar(Math.max(0.001, 1 - k));
      victim.position.y += 0.012;
    }, dur * 0.7).then(() => piecesRoot.remove(victim));
    setTimeout(() => { sfx.capture(); poof(p1, TEAM[victim.userData.team].light); }, dur * 700);
  }
  await tween(dur, (k) => {
    const e = easeInOut(k);
    obj.position.lerpVectors(p0, p1, e);
    obj.position.y += Math.sin(Math.PI * k) * h;
    model.rotation.y = lerpAngle(a0, a1, Math.min(1, k * 3));
    if (jump) model.rotation.x = -Math.sin(Math.PI * k) * 0.5;
    if (victim) arm.rotation.x = -Math.sin(Math.PI * Math.min(1, k * 1.2)) * 2.2;
  });
  model.rotation.x = 0;
  arm.rotation.x = 0;
  if (WATER[to]) poof(new THREE.Vector3(p1.x, WATER_Y - 0.3, p1.z), 0xd8f6ff);
  const hf = homeFacing(obj.userData.team);
  await tween(0.18, (k) => { model.rotation.y = lerpAngle(a1, hf, k); });
  obj.userData.acting = false;

  game.lastMove = [from, to];
  game.turn = 1 - game.turn;
  const key = boardKey(game.board, game.turn);
  game.seen[key] = (game.seen[key] | 0) + 1;
  game.winner = winner(game.board, game.turn);
  if (game.winner < 0 && game.seen[key] >= 3) game.winner = 2; // lặp thế cờ 3 lần: hoà
  game.busy = false;
  refreshMarkers();
  updateHud();
  if (game.winner >= 0) return finish();
  if (isAI(game.turn)) requestAI();
  drainRemote();
}

function finish() {
  sfx.win();
  const w = game.winner;
  if (w === 2) {
    $('resTitle').textContent = '🤝 Hoà cờ!';
    $('resText').textContent = 'Thế cờ đã lặp lại 3 lần.';
    setTimeout(() => { if (game.winner >= 0) $('result').classList.remove('hidden'); }, 900);
    return;
  }
  const byDen = game.board[DEN_CELL[1 - w]] !== 0 && ownerOf(game.board[DEN_CELL[1 - w]]) === w;
  $('resTitle').innerHTML = `🏆 <span style="color:${TEAM[w].css}">${TEAM[w].name}</span> thắng!`;
  $('resText').textContent = byDen ? 'Đã chiếm được hang của đối phương.' : 'Đối phương không còn nước đi.';
  setTimeout(() => { if (game.winner >= 0) $('result').classList.remove('hidden'); }, 1400);
}

// ---------------- AI ----------------
const worker = new Worker(new URL('./aiWorker.js', import.meta.url), { type: 'module' });
worker.onmessage = (e) => {
  const { id, move } = e.data;
  if (id !== game.aiId || move == null || game.winner >= 0) return;
  playMove(move);
};
function requestAI() {
  const id = ++game.aiId;
  const level = game.mode === 'demo' ? 2 : game.level;
  const payload = { id, board: Array.from(game.board), turn: game.turn, level, seen: game.seen };
  setTimeout(() => { if (id === game.aiId) worker.postMessage(payload); }, game.mode === 'demo' ? 250 : 420);
}

// ---------------- Online ----------------
const remoteQueue = [];
function drainRemote() {
  if (game.busy || game.mode !== 'online' || game.winner >= 0 || !remoteQueue.length) return;
  const { m, n } = remoteQueue.shift();
  // chỉ nhận nước hợp lệ, đúng lượt đối thủ và đúng thứ tự
  if (n !== game.history.length || game.turn === game.human || !genMoves(game.board, game.turn).includes(m)) return;
  playMove(m, true);
}
const onStatus = (text, cls = '') => { const e = $('onStatus'); e.textContent = text; e.className = 'status ' + cls; };
const net = new Net({
  onReady(code) {
    $('roomCode').textContent = code;
    $('roomLink').value = location.origin + location.pathname + '?room=' + code;
    $('roomBox').classList.remove('hidden');
    onStatus('Đang chờ bạn bè vào phòng…', 'wait');
  },
  onOpen(side) {
    // tạm dựng biome của mình + một biome khác cho đối thủ, chờ đối thủ báo biome của họ
    const other = distinctFrom(BIOME_IDS[(BIOME_IDS.indexOf(onlineBiome) + 1) % BIOME_IDS.length], onlineBiome);
    applyBiomes(side === 0 ? onlineBiome : other, side === 0 ? other : onlineBiome);
    newGame('online', side);
    net.send({ t: 'hello', b: onlineBiome });
  },
  onData(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'hello' && validBiome(msg.b)) {
      // chủ phòng (phe 0) giữ biome; khách trùng thì đổi sang biome kế tiếp (hai máy tính ra giống nhau)
      const host = game.human === 0 ? onlineBiome : msg.b;
      const guest = distinctFrom(game.human === 0 ? msg.b : onlineBiome, host);
      const apply = () => {
        if (game.busy) return setTimeout(apply, 200);
        if (applyBiomes(host, guest)) { rebuildPieces(); refreshMarkers(); updateHud(); }
      };
      return apply();
    }
    if (msg.t === 'move' && Number.isInteger(msg.m) && Number.isInteger(msg.n)) { remoteQueue.push(msg); drainRemote(); }
    else if (msg.t === 'restart') newGame('online', game.human);
  },
  onClose() { select(-1); updateHud(); },
  onError(text) { onStatus(text, 'err'); },
});
function openOnline() {
  $('menu').classList.add('hidden');
  $('online').classList.remove('hidden');
  $('roomBox').classList.add('hidden');
  onStatus('');
}
function createRoom(code = makeCode()) {
  openOnline();
  onStatus('Đang tạo phòng…', 'wait');
  net.host(code);
}
function joinRoom(raw) {
  const code = cleanCode(raw);
  openOnline();
  if (code.length < 4) return onStatus('Hãy nhập mã phòng (5 ký tự).', 'err');
  $('joinCode').value = code;
  onStatus('Đang vào phòng ' + code + '…', 'wait');
  net.join(code);
}

// ---------------- Điều khiển ván ----------------
function newGame(mode, human = 0) {
  if (mode !== 'online') { net.close(); applyBiomes(biomePick[0], biomePick[1]); }
  remoteQueue.length = 0;
  game.human = human;
  setView(mode === 'online' || mode === 'ai' ? human : 0);
  game.aiId++;
  tweens.length = 0;
  Object.assign(game, {
    board: initialBoard(), turn: 0, mode, history: [], seen: {}, captured: [[], []],
    lastMove: null, selected: -1, legal: [], busy: false, winner: -1,
  });
  rebuildPieces();
  refreshMarkers();
  updateHud();
  for (const id of ['menu', 'result', 'rules', 'online']) $(id).classList.add('hidden');
  if (isAI(game.turn)) requestAI();
}

function undo() {
  if (game.busy || !game.history.length || game.mode === 'demo' || game.mode === 'online') return;
  game.aiId++;
  let snap = game.history.pop();
  // chơi với máy: lùi về lượt của người
  while (game.mode === 'ai' && snap.turn !== game.human && game.history.length) snap = game.history.pop();
  Object.assign(game, { board: snap.board, turn: snap.turn, captured: snap.captured, lastMove: snap.lastMove, seen: snap.seen, selected: -1, legal: [], winner: -1 });
  $('result').classList.add('hidden');
  rebuildPieces();
  refreshMarkers();
  updateHud();
  if (isAI(game.turn)) requestAI();
}

// ---------------- Chuột / chạm ----------------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TILE_Y);
function cellAt(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects([...pieces.values()].map((o) => o.userData.hit), false);
  if (hits.length) return hits[0].object.parent.userData.cell;
  const p = new THREE.Vector3();
  if (!ray.ray.intersectPlane(plane, p)) return -1;
  const c = Math.round(p.x + 3), rw = Math.round(4 - p.z);
  return c < 0 || c >= COLS || rw < 0 || rw >= ROWS ? -1 : idx(c, rw);
}
const canAct = () => !game.busy && game.winner < 0 && game.mode !== 'menu' && !isAI(game.turn)
  && (game.mode !== 'online' || (game.turn === game.human && net.connected));

let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
  if (!canAct()) return;
  const cell = cellAt(e);
  if (cell < 0) return select(-1);
  const mv = game.legal.find((m) => moveTo(m) === cell);
  if (mv !== undefined) return playMove(mv);
  const v = game.board[cell];
  if (v && ownerOf(v) === game.turn && cell !== game.selected) { sfx.select(); select(cell); } else select(-1);
});
const hover = new THREE.Mesh(G.box(0.9, 0.012, 0.9), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false }));
hover.visible = false;
scene.add(hover);
renderer.domElement.addEventListener('pointerleave', () => { hover.visible = false; });
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.buttons || !canAct()) { renderer.domElement.style.cursor = ''; hover.visible = false; return; }
  const cell = cellAt(e);
  const v = cell >= 0 ? game.board[cell] : 0;
  const ok = cell >= 0 && ((v && ownerOf(v) === game.turn) || game.legal.some((m) => moveTo(m) === cell));
  renderer.domElement.style.cursor = ok ? 'pointer' : '';
  hover.visible = !!ok;
  if (ok) hover.position.set(cellX(colOf(cell)), markerY(cell) - 0.02, cellZ(rowOf(cell)));
});

// ---------------- Nút bấm ----------------
$('levelSeg').addEventListener('click', (e) => {
  const l = e.target.dataset.l;
  if (!l) return;
  game.level = +l;
  for (const b of $('levelSeg').children) b.classList.toggle('on', b === e.target);
});
let aiSide = 0;
$('sideSeg').addEventListener('click', (e) => {
  const s = e.target.dataset.s;
  if (s === undefined) return;
  aiSide = +s;
  for (const b of $('sideSeg').children) b.classList.toggle('on', b === e.target);
});
// chọn biome: mỗi phe một hàng, không cho hai phe trùng nhau
function renderBiomeUI() {
  for (const s of [0, 1]) {
    const box = $('bm' + s);
    box.innerHTML = '';
    for (const id of BIOME_IDS) {
      const B = BIOMES[id], b = document.createElement('button');
      b.textContent = B.emoji;
      b.title = B.name;
      b.dataset.b = id;
      b.classList.toggle('on', biomePick[s] === id);
      b.disabled = biomePick[1 - s] === id;
      box.appendChild(b);
    }
    $('bmName' + s).textContent = BIOMES[biomePick[s]].name;
  }
  const sb = $('sideSeg').children;
  sb[0].textContent = `${BIOMES[biomePick[0]].emoji} ${BIOMES[biomePick[0]].name} (đi trước)`;
  sb[1].textContent = `${BIOMES[biomePick[1]].emoji} ${BIOMES[biomePick[1]].name}`;
  const on = $('bmOn');
  on.innerHTML = '';
  for (const id of BIOME_IDS) {
    const b = document.createElement('button');
    b.textContent = BIOMES[id].emoji; b.title = BIOMES[id].name; b.dataset.b = id;
    b.classList.toggle('on', onlineBiome === id);
    on.appendChild(b);
  }
  $('bmOnName').textContent = BIOMES[onlineBiome].name;
}
for (const s of [0, 1]) $('bm' + s).addEventListener('click', (e) => {
  const id = e.target.dataset.b;
  if (!id || e.target.disabled) return;
  biomePick[s] = id;
  store.set('biomes', biomePick);
  renderBiomeUI();
  // xem trước ngay trên map khi chưa vào ván
  if (game.mode === 'menu') { applyBiomes(biomePick[0], biomePick[1]); rebuildPieces(); }
});
$('bmOn').addEventListener('click', (e) => {
  const id = e.target.dataset.b;
  if (!id || net.connected) return;
  onlineBiome = id;
  store.set('biomeOnline', id);
  renderBiomeUI();
});
renderBiomeUI();
$('playAI').onclick = () => newGame('ai', aiSide);
$('playPvP').onclick = () => newGame('pvp');
$('playDemo').onclick = () => newGame('demo');
$('playOnline').onclick = openOnline;
$('onCreate').onclick = () => createRoom();
$('onJoin').onclick = () => joinRoom($('joinCode').value);
$('joinCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom($('joinCode').value); });
$('onBack').onclick = () => {
  if (game.mode !== 'online') net.close();
  $('online').classList.add('hidden');
  $('menu').classList.remove('hidden');
};
$('onCopy').onclick = async () => {
  const el = $('roomLink');
  try { await navigator.clipboard.writeText(el.value); } catch { el.select(); document.execCommand('copy'); }
  $('onCopy').textContent = 'Đã chép ✓';
  setTimeout(() => { $('onCopy').textContent = 'Chép link'; }, 1500);
};
$('btnUndo').onclick = undo;
$('btnRules').onclick = () => $('rules').classList.remove('hidden');
$('rulesClose').onclick = () => $('rules').classList.add('hidden');
$('btnSound').onclick = () => { soundOn = !soundOn; $('btnSound').textContent = soundOn ? '🔊' : '🔇'; };
$('btnMenu').onclick = () => {
  $('menuClose').style.display = game.mode !== 'menu' && game.winner < 0 ? '' : 'none';
  $('menu').classList.remove('hidden');
};
$('menuClose').onclick = () => $('menu').classList.add('hidden');
$('resAgain').onclick = () => {
  if (game.mode === 'online') { net.send({ t: 'restart' }); newGame('online', game.human); } else newGame(game.mode, game.human);
};
$('resMenu').onclick = () => { $('result').classList.add('hidden'); $('btnMenu').onclick(); };

// ---------------- Vòng lặp ----------------
let lastT = performance.now(), elapsed = 0, rafId = 0;

// ?fps=1: hiện FPS và số draw call ở góc màn hình để đo hiệu năng
let fpsEl = null, fpsN = 0, fpsT0 = performance.now();
if (params.has('fps')) {
  fpsEl = document.createElement('div');
  fpsEl.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;padding:4px 8px;border-radius:6px;background:rgba(0,0,0,.6);color:#fff;font:12px/1.4 monospace;pointer-events:none;white-space:pre';
  document.body.appendChild(fpsEl);
}
function fpsTick(now) {
  fpsN++;
  if (now - fpsT0 < 500) return;
  const i = renderer.info.render;
  fpsEl.textContent = `${Math.round((fpsN * 1000) / (now - fpsT0))} FPS\n${i.calls} draw · ${(i.triangles / 1000).toFixed(0)}k tri`;
  fpsN = 0; fpsT0 = now;
}
function frame() {
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  elapsed += dt;
  const t = elapsed;
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    if (tw.t < 0) continue;
    const k = Math.min(1, tw.t / tw.dur);
    tw.fn(k);
    if (k >= 1) { tweens.splice(i, 1); tw.res(); }
  }
  for (const [cell, o] of pieces) {
    const u = o.userData;
    const s = Math.sin(t * 2.2 + u.phase);
    u.bob.scale.y = 1 + s * 0.02;
    if (!u.acting) {
      u.armR.rotation.x = s * 0.07;
      u.head.rotation.z = Math.sin(t * 1.1 + u.phase) * 0.04;
      let lift = 0;
      if (cell === game.selected) lift = 0.1 + Math.abs(Math.sin(t * 5)) * 0.14;
      else if (game.winner === u.team) lift = Math.abs(Math.sin(t * 6 + u.phase)) * 0.25;
      else if (WATER[cell]) lift = Math.sin(t * 2.5 + u.phase) * 0.025;
      const base = WATER[cell] ? WATER_Y - 0.17 : TILE_Y;
      o.position.y += (base + lift - o.position.y) * 0.35;
    }
  }
  for (const m of markersRoot.children) if (m.userData.pulse) m.scale.setScalar(1 + Math.sin(t * 6) * 0.07);
  world.update(t);
  controls.update();
  renderer.render(scene, camera);
  if (fpsEl) fpsTick(now);
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(frame);
}

// ---------------- Khởi động ----------------
updateTeamUI();
rebuildPieces();
updateHud();
if (import.meta.env.DEV) window.__dbg = { scene, camera, renderer, game, controls, pieces, frame, playMove, select, net, applyBiomes, rebuildPieces, get world() { return world; } };
const auto = params.get('mode');
if (['ai', 'pvp', 'demo'].includes(auto)) newGame(auto, params.get('side') === '1' ? 1 : 0);
else if (params.get('room')) joinRoom(params.get('room'));
else if (params.get('create')) createRoom(cleanCode(params.get('create')));
frame();
