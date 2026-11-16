// Cảnh vật trang trí cho từng biome. Mọi hàm decorate/bank nhận s = +1 (nửa sân phe 0, phía +z)
// hoặc -1 (nửa sân phe 1, phía -z); toạ độ z trong bảng dưới đây luôn là độ lớn dương.
import * as THREE from 'three';
import { toon, G, mesh, group, gradientMap, WATER_Y } from './helpers.js';

const flat = (color) => toon(color);
const glowCache = new Map();
/** Vật liệu tự phát sáng (không chịu ánh sáng): dung nham, nấm phát quang */
export function glow(color) {
  let m = glowCache.get(color);
  if (!m) glowCache.set(color, (m = new THREE.MeshBasicMaterial({ color })));
  return m;
}

// Vị trí cây cao hai bên sườn bàn cờ (dùng chung cho mọi biome)
const TALL = [
  [-5.2, 2.6], [-6.6, 4.2], [-8.3, 2.8], [-5.4, 5.6], [-7.6, 6.3], [-8.8, 4.9], [-6.6, 7.7], [-9.0, 7.6],
  [5.3, 2.5], [6.9, 3.6], [8.5, 2.6], [5.2, 5.2], [7.5, 5.6], [8.9, 4.4], [6.2, 7.5], [8.6, 7.2],
];
// Rải vật nhỏ: tránh vùng sát bàn cờ
function scatter(n, s, rr, fn) {
  for (let k = 0; k < n; k++) {
    let x = rr(-9.5, 9.5), z = rr(1.95, 8.2);
    if (Math.abs(x) < 4.1 && z < 5.0) z = rr(5.1, 8.2);
    fn(x, s * z, Math.abs(x) < 4.3, k);
  }
}
// Viền hai mép bàn cờ
function border(n, s, rr, fn) {
  for (let k = 0; k < n; k++) fn((k % 2 ? 1 : -1) * rr(3.75, 4.1), s * rr(1.8, 4.6), k);
}
const R01 = (k) => ((Math.sin(k * 127.1 + 3.3) * 43758.5453) % 1 + 1) % 1;

// ======================= Vật thể cơ bản =======================
function palm(root, x, z, s, rr) {
  const g = group(root, { p: [x, 0, z], s, r: [0, rr(0, 6.28), 0] });
  let px = 0, py = 0;
  const n = 7, lean = rr(0.05, 0.14);
  for (let k = 0; k < n; k++) {
    const r0 = 0.11 - k * 0.008;
    mesh(g, G.cyl(r0 - 0.01, r0 + 0.012, 0.3, 8), k % 2 ? 0xb88755 : 0xa87747, { p: [px, py + 0.15, 0], r: [0, 0, -lean * k * 0.5] });
    py += 0.27; px += lean * k * 0.12;
  }
  const top = group(g, { p: [px, py, 0] });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const lf = group(top, { r: [0, a, 0] });
    const arm = group(lf, { r: [0, 0, k % 2 ? -0.55 : -0.3] });
    mesh(arm, G.sphere(1, 10, 6), k % 2 ? 0x3cba5a : 0x56d06a, { p: [0.5, 0, 0], s: [0.55, 0.035, 0.17] });
    mesh(arm, G.sphere(1, 8, 6), k % 2 ? 0x2fa850 : 0x3cba5a, { p: [0.98, -0.12, 0], s: [0.3, 0.03, 0.12], r: [0, 0, -0.5] });
  }
  for (let k = 0; k < 3; k++) mesh(top, G.sphere(0.075, 8, 6), 0x7a4b2a, { p: [Math.cos(k * 2.1) * 0.1, -0.08, Math.sin(k * 2.1) * 0.1] });
  return g;
}

function roundTree(root, x, z, s, rr, cols, trunk = 0x8b5e3c, big = 1) {
  const g = group(root, { p: [x, 0, z], s, r: [0, rr(0, 6.28), 0] });
  mesh(g, G.cyl(0.1 * big, 0.16 * big, 1.0, 8), trunk, { p: [0, 0.5, 0] });
  mesh(g, G.ico(1, 1), flat(cols[0]), { p: [0, 1.35, 0], s: [0.75 * big, 0.68, 0.75 * big] });
  mesh(g, G.ico(1, 1), flat(cols[1]), { p: [0.42 * big, 1.1, 0.2], s: 0.48 * big });
  mesh(g, G.ico(1, 1), flat(cols[2]), { p: [-0.4 * big, 1.15, -0.15], s: 0.5 * big });
  mesh(g, G.ico(1, 1), flat(cols[1]), { p: [0.05, 1.82, 0.05], s: 0.42 * big });
  return g;
}

function bush(root, x, z, s, cols) {
  const g = group(root, { p: [x, 0, z], s });
  mesh(g, G.ico(1, 1), flat(cols[0]), { p: [0, 0.2, 0], s: [0.34, 0.28, 0.34] });
  mesh(g, G.ico(1, 1), flat(cols[1]), { p: [0.26, 0.15, 0.08], s: 0.22 });
  mesh(g, G.ico(1, 1), flat(cols[2 % cols.length]), { p: [-0.24, 0.14, -0.05], s: 0.2 });
}

function flower(root, x, z, color) {
  const g = group(root, { p: [x, 0, z] });
  mesh(g, G.cyl(0.012, 0.012, 0.16, 5), 0x3cba5a, { p: [0, 0.08, 0], cast: false });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    mesh(g, G.sphere(0.035, 6, 5), color, { p: [Math.cos(a) * 0.04, 0.17, Math.sin(a) * 0.04], cast: false });
  }
  mesh(g, G.sphere(0.03, 6, 5), 0xffe066, { p: [0, 0.185, 0], cast: false });
}

function mushroom(root, x, z, s, cap = 0xff5a5f, capMat = null) {
  const g = group(root, { p: [x, 0, z], s });
  mesh(g, G.cyl(0.05, 0.065, 0.16, 8), 0xfff4e0, { p: [0, 0.08, 0] });
  mesh(g, G.sphere(0.15, 12, 8), capMat || cap, { p: [0, 0.16, 0], s: [1, 0.62, 1] });
  for (let k = 0; k < 5; k++) {
    const a = k * 1.3;
    mesh(g, G.sphere(0.028, 6, 5), 0xffffff, { p: [Math.cos(a) * 0.09, 0.225, Math.sin(a) * 0.09], cast: false });
  }
}

function rock(root, x, z, s, color, rr, y = 0) {
  return mesh(root, G.dode(1), flat(color), { p: [x, y + s * 0.3, z], s: [s, s * 0.7, s * 0.85], r: [rr(0, 3), rr(0, 3), 0] });
}

function grassTuft(root, x, z, color) {
  for (let k = 0; k < 3; k++) mesh(root, G.cone(0.03, 0.2, 4), color, { p: [x + (k - 1) * 0.05, 0.1, z + (k % 2) * 0.04], r: [0, 0, (k - 1) * 0.25], cast: false });
}

function mound(root, x, z, sx, sz, color, h = 0.12) {
  mesh(root, G.sphere(1, 12, 8), color, { p: [x, -0.02, z], s: [sx, h, sz], cast: false });
}

function cactus(root, x, z, s, rr) {
  const g = group(root, { p: [x, 0, z], s, r: [0, rr(0, 6.28), 0] });
  const c = 0x5dbb72, c2 = 0x4aa862;
  mesh(g, G.capsule(0.15, 0.7), c, { p: [0, 0.5, 0] });
  mesh(g, G.capsule(0.085, 0.16), c2, { p: [0.24, 0.5, 0], r: [0, 0, Math.PI / 2] });
  mesh(g, G.capsule(0.085, 0.28), c, { p: [0.36, 0.7, 0] });
  mesh(g, G.capsule(0.08, 0.14), c2, { p: [-0.22, 0.36, 0], r: [0, 0, Math.PI / 2] });
  mesh(g, G.capsule(0.08, 0.2), c, { p: [-0.33, 0.52, 0] });
  mesh(g, G.sphere(0.07, 8, 6), 0xff7eb6, { p: [0, 1.02, 0] });
  mesh(g, G.sphere(0.045, 8, 6), 0xffd23f, { p: [0.36, 0.95, 0] });
}

function mesa(root, x, z, s, rr, cols = [0xd9703c, 0xf0a060, 0xe08a4f, 0xf6b877, 0xd9703c]) {
  const g = group(root, { p: [x, 0, z], s, r: [0, rr(0, 6.28), 0] });
  let y = 0, r = 1.0;
  for (let k = 0; k < 5; k++) {
    const h = rr(0.28, 0.48);
    mesh(g, G.cyl(r * 0.9, r, h, 7), flat(cols[k]), { p: [rr(-0.05, 0.05), y + h / 2, rr(-0.05, 0.05)], r: [0, rr(0, 1), 0] });
    y += h; r *= rr(0.8, 0.92);
  }
  return { g, top: y, r };
}

function acacia(root, x, z, s, rr, cols) {
  const g = group(root, { p: [x, 0, z], s, r: [0, rr(0, 6.28), 0] });
  mesh(g, G.cyl(0.06, 0.1, 1.1, 7), 0x8a5a34, { p: [0.08, 0.55, 0], r: [0, 0, -0.15] });
  mesh(g, G.cyl(0.04, 0.05, 0.5, 6), 0x8a5a34, { p: [0.36, 1.15, 0], r: [0, 0, -0.9] });
  mesh(g, G.cyl(0.04, 0.05, 0.45, 6), 0x8a5a34, { p: [-0.05, 1.2, 0], r: [0, 0, 0.7] });
  mesh(g, G.ico(1, 1), flat(cols[0]), { p: [0.1, 1.5, 0], s: [0.95, 0.22, 0.8] });
  mesh(g, G.ico(1, 1), flat(cols[1]), { p: [0.55, 1.38, 0.1], s: [0.5, 0.16, 0.45] });
  mesh(g, G.ico(1, 1), flat(cols[1]), { p: [-0.4, 1.4, -0.1], s: [0.5, 0.16, 0.45] });
}

/** Thông: các tầng nón chồng nhau; snow = phủ tuyết trên mỗi tầng */
function pine(root, x, z, s, rr, cols, snow = false, trunk = 0x7a5232) {
  const g = group(root, { p: [x, 0, z], s, r: [0, rr(0, 6.28), 0] });
  mesh(g, G.cyl(0.08, 0.12, 0.6, 7), trunk, { p: [0, 0.3, 0] });
  const tiers = [[0.62, 0.8, 0.75], [0.5, 0.7, 1.2], [0.36, 0.6, 1.6]];
  tiers.forEach(([r, h, y], k) => {
    mesh(g, G.cone(r, h, 8), flat(cols[k % cols.length]), { p: [0, y, 0] });
    if (snow) mesh(g, G.cone(r * 0.62, h * 0.5, 8), 0xf7fbff, { p: [0, y + h * 0.27, 0] });
  });
  return g;
}

function snowman(root, x, z, s, rr) {
  const g = group(root, { p: [x, 0, z], s, r: [0, rr(-0.8, 0.8), 0] });
  mesh(g, G.sphere(0.26, 14, 10), 0xffffff, { p: [0, 0.22, 0] });
  mesh(g, G.sphere(0.19, 14, 10), 0xffffff, { p: [0, 0.58, 0] });
  mesh(g, G.sphere(0.14, 14, 10), 0xffffff, { p: [0, 0.86, 0] });
  mesh(g, G.cone(0.03, 0.16, 6), 0xff8a2a, { p: [0, 0.86, 0.2], r: [Math.PI / 2, 0, 0] });
  for (const sx of [-0.05, 0.05]) mesh(g, G.sphere(0.018, 6, 5), 0x2a2233, { p: [sx, 0.9, 0.12], cast: false });
  mesh(g, G.torus(0.15, 0.04, 6, 16), 0xe63946, { p: [0, 0.73, 0], r: [Math.PI / 2, 0, 0] });
  mesh(g, G.cyl(0.11, 0.11, 0.16, 12), 0x2a2233, { p: [0, 1.05, 0] });
  mesh(g, G.cyl(0.16, 0.16, 0.02, 14), 0x2a2233, { p: [0, 0.98, 0] });
  for (const sx of [-1, 1]) mesh(g, G.cyl(0.012, 0.012, 0.32, 4), 0x7a5232, { p: [sx * 0.28, 0.66, 0], r: [0, 0, sx * 1.0] });
}

function iceCrystal(root, x, z, s, rr) {
  const g = group(root, { p: [x, 0, z], s, r: [0, rr(0, 6.28), 0] });
  const cols = [0xbfe9ff, 0x9fd8ff, 0xdff4ff];
  for (let k = 0; k < 4; k++) {
    const h = rr(0.3, 0.6) * (k === 0 ? 1.5 : 1);
    mesh(g, G.cone(0.08, h, 5), cols[k % 3], { p: [k ? rr(-0.12, 0.12) : 0, h / 2 - 0.03, k ? rr(-0.12, 0.12) : 0], r: [k ? rr(-0.5, 0.5) : 0, 0, k ? rr(-0.5, 0.5) : 0] });
  }
}

function snowRock(root, x, z, s, rr) {
  rock(root, x, z, s, 0x9fb0c0, rr);
  mesh(root, G.sphere(1, 10, 6), 0xffffff, { p: [x, s * 0.62, z], s: [s * 0.75, s * 0.18, s * 0.65], cast: false });
}

function fern(root, x, z, s, rr, color = 0x4f9a48) {
  const g = group(root, { p: [x, 0, z], s, r: [0, rr(0, 6.28), 0] });
  for (let k = 0; k < 6; k++) {
    const lf = group(g, { r: [0, (k / 6) * Math.PI * 2, 0] });
    mesh(lf, G.sphere(1, 8, 5), k % 2 ? color : 0x3d8a3a, { p: [0.18, 0.12, 0], s: [0.22, 0.02, 0.06], r: [0, 0, 0.5], cast: false });
  }
}

function log(root, x, z, s, rr) {
  const g = group(root, { p: [x, 0.11 * s, z], r: [0, rr(0, 6.28), Math.PI / 2] });
  mesh(g, G.cyl(0.11 * s, 0.12 * s, 0.9 * s, 9), 0x6b4a30);
  for (const sy of [-1, 1]) mesh(g, G.cyl(0.09 * s, 0.09 * s, 0.01, 9), 0xc49a6c, { p: [0, sy * 0.455 * s, 0], cast: false });
  mesh(g, G.sphere(1, 8, 5), 0x4f9a48, { p: [0.08 * s, 0.1 * s, 0], s: [0.1 * s, 0.25 * s, 0.08 * s], cast: false });
}

function mossRock(root, x, z, s, rr) {
  rock(root, x, z, s, 0x6f7d6a, rr);
  mesh(root, G.sphere(1, 10, 6), 0x4f9a48, { p: [x, s * 0.6, z], s: [s * 0.7, s * 0.16, s * 0.6], cast: false });
}

function deadTree(root, x, z, s, rr) {
  const g = group(root, { p: [x, 0, z], s, r: [0, rr(0, 6.28), 0] });
  const c = 0x5a4a50;
  mesh(g, G.cyl(0.05, 0.1, 1.2, 6), c, { p: [0, 0.6, 0], r: [0, 0, 0.08] });
  mesh(g, G.cyl(0.025, 0.04, 0.5, 5), c, { p: [0.18, 1.0, 0], r: [0, 0, -0.9] });
  mesh(g, G.cyl(0.02, 0.035, 0.4, 5), c, { p: [-0.14, 0.85, 0.05], r: [0.2, 0, 0.8] });
  mesh(g, G.cyl(0.018, 0.03, 0.3, 5), c, { p: [0.02, 1.3, 0], r: [0, 0, 0.5] });
}

function obsidian(root, x, z, s, rr) {
  const g = group(root, { p: [x, 0, z], s, r: [0, rr(0, 6.28), 0] });
  const cols = [0x2a2233, 0x3d2f4a, 0x241c2a];
  for (let k = 0; k < 4; k++) {
    const h = rr(0.25, 0.6) * (k === 0 ? 1.6 : 1);
    mesh(g, G.cone(0.1, h, 4), cols[k % 3], { p: [k ? rr(-0.15, 0.15) : 0, h / 2 - 0.03, k ? rr(-0.15, 0.15) : 0], r: [k ? rr(-0.5, 0.5) : 0, 0, k ? rr(-0.5, 0.5) : 0] });
  }
}

function emberRock(root, x, z, s, rr) {
  rock(root, x, z, s, 0x3d3340, rr);
  for (let k = 0; k < 3; k++) mesh(root, G.sphere(0.035, 6, 5), glow(k % 2 ? 0xff8a2a : 0xffc23a), { p: [x + rr(-s, s) * 0.6, s * rr(0.2, 0.55), z + rr(-s, s) * 0.5], cast: false });
}

function lavaPool(root, x, z, s, rr, animated) {
  const g = group(root, { p: [x, 0, z], r: [0, rr(0, 6.28), 0] });
  mesh(g, G.cyl(1, 1, 0.04, 14), 0x2f2832, { s: [s * 1.18, 1, s * 0.95], p: [0, 0.0, 0], cast: false });
  const lava = mesh(g, G.cyl(1, 1, 0.04, 14), glow(0xff7a1a), { s: [s, 1, s * 0.8], p: [0, 0.012, 0], cast: false });
  mesh(g, G.cyl(1, 1, 0.04, 10), glow(0xffc23a), { s: [s * 0.45, 1, s * 0.3], p: [s * 0.2, 0.02, 0], cast: false });
  lava.userData.dyn = true;
  const ph = rr(0, 6);
  animated.push((t) => { lava.position.y = 0.012 + Math.sin(t * 2 + ph) * 0.004; });
}

function smokePuffs(root, x, y, z, n, rr, animated, color = 0x8f8696, size = 0.22) {
  const mat = toon(color);
  for (let k = 0; k < n; k++) {
    const p = mesh(root, G.sphere(1, 10, 8), mat, { p: [x, y, z], cast: false });
    p.userData.dyn = true;
    const ph = k / n, dx = rr(-0.3, 0.3);
    animated.push((t) => {
      const u = (t * 0.25 + ph) % 1;
      p.position.set(x + dx * u, y + u * 1.6, z + Math.sin(u * 6 + k) * 0.1);
      p.scale.setScalar(size * Math.sin(Math.PI * u) * (0.6 + u));
    });
  }
}

function volcano(root, x, z, s, rr, animated) {
  const g = group(root, { p: [x, 0, z], s });
  mesh(g, G.cyl(0.95, 1.5, 0.8, 9), flat(0x4a3f4e), { p: [0, 0.4, 0] });
  mesh(g, G.cyl(0.55, 0.95, 0.75, 9), flat(0x3d3340), { p: [0, 1.17, 0] });
  mesh(g, G.cyl(0.5, 0.5, 0.06, 9), glow(0xff6a1a), { p: [0, 1.53, 0], cast: false });
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1 + 0.4;
    const st = group(g, { r: [0, a, 0] });
    mesh(st, G.box(0.12, 0.9, 0.03), glow(k % 2 ? 0xff8a2a : 0xff6a1a), { p: [0, 1.05, 0.78], r: [0.52, 0, 0], cast: false });
  }
  root.updateMatrixWorld(true);
  smokePuffs(root, x, 1.65 * s, z, 4, rr, animated);
}

// ======================= Từng biome =======================
export function decoratePlains(root, s, rr, pick, animated) {
  const greens = [0x4cc45a, 0x38b04e, 0x6ad66a, 0x2e9e58];
  const g3 = () => [pick(greens), pick(greens), pick(greens)];
  TALL.forEach(([x, z], k) => {
    if (k % 2 === (k < 8 ? 0 : 1)) {
      const p = palm(root, x, s * z, rr(1.0, 1.35), rr);
      p.userData.dyn = true;
      const ph = rr(0, 6), base = p.rotation.z;
      animated.push((t) => { p.rotation.z = base + Math.sin(t * 0.9 + ph) * 0.025; });
    } else roundTree(root, x, s * z, rr(0.95, 1.3), rr, g3());
  });
  const fcol = [0xff7eb6, 0xffffff, 0xffd23f, 0xc084fc, 0xff8a5c];
  scatter(46, s, rr, (x, z, low, k) => {
    const t = R01(k);
    if (t < 0.3) bush(root, x, z, low ? rr(0.5, 0.8) : rr(0.8, 1.4), g3());
    else if (t < 0.62) flower(root, x, z, pick(fcol));
    else if (t < 0.74) mushroom(root, x, z, rr(0.7, 1.3));
    else if (t < 0.86) rock(root, x, z, rr(0.12, 0.3), pick([0x9aa3a8, 0x858f96, 0xb3bcc0]), rr);
    else grassTuft(root, x, z, pick(greens));
  });
  border(14, s, rr, (x, z) => { flower(root, x, z, pick(fcol)); grassTuft(root, x + 0.1, z + 0.3, pick(greens)); });
}

export function decorateDesert(root, s, rr, pick) {
  const warm = [[0xf2b33d, 0xe8912e], [0xe8c547, 0xf2b33d], [0xf28f3b, 0xe0662e]];
  const items = [
    [-5.3, 2.7, 'c'], [-6.9, 4.0, 'm'], [-8.6, 2.6, 'a'], [-5.2, 5.6, 'a'], [-7.7, 6.4, 'c'], [-9.0, 5.0, 'c'], [-6.0, 7.5, 'm'], [-4.4, 7.3, 'c'], [-8.8, 7.6, 'a'],
    [5.2, 2.6, 'a'], [7.0, 3.8, 'c'], [8.6, 2.7, 'm'], [5.4, 5.3, 'c'], [7.6, 5.8, 'a'], [9.0, 4.6, 'c'], [6.4, 7.5, 'm'], [8.7, 7.3, 'c'], [4.6, 7.4, 'a'],
    [-2.6, 7.4, 'm'], [2.7, 7.5, 'c'], [-1.6, 6.3, 'c'], [2.2, 6.6, 'c'],
  ];
  for (const [x, z, k] of items) {
    if (k === 'c') cactus(root, x, s * z, rr(0.8, 1.25), rr);
    else if (k === 'm') mesa(root, x, s * z, rr(0.75, 1.1), rr);
    else acacia(root, x, s * z, rr(0.95, 1.3), rr, pick(warm));
  }
  scatter(40, s, rr, (x, z) => {
    const t = rr(0, 1);
    if (t < 0.3) rock(root, x, z, rr(0.12, 0.32), pick([0xd9925c, 0xc98452, 0xe8b07a]), rr);
    else if (t < 0.55) bush(root, x, z, rr(0.5, 0.9), [0xd9b45a, 0xc9a04a, 0xe6c773]);
    else if (t < 0.8) grassTuft(root, x, z, pick([0xd9b45a, 0xb8a04a]));
    else mound(root, x, z, rr(0.5, 1.0), rr(0.4, 0.8), 0xf8dfa0);
  });
  border(10, s, rr, (x, z) => { rock(root, x, z, rr(0.07, 0.14), pick([0xd9925c, 0xe8b07a]), rr); grassTuft(root, x + 0.1, z + 0.3, 0xd9b45a); });
}

export function decorateSnow(root, s, rr, pick) {
  const pines = [[0x2f7a55, 0x3a8a62, 0x2a6e4c], [0x2a6e60, 0x357d6c, 0x24604f]];
  TALL.forEach(([x, z], k) => {
    if (k === 4 || k === 12) snowman(root, x, s * z, rr(1.0, 1.2), rr);
    else if (k % 5 === 3) iceCrystal(root, x, s * z, rr(1.2, 1.7), rr);
    else pine(root, x, s * z, rr(1.0, 1.4), rr, pick(pines), true);
  });
  [[-2.4, 7.3], [2.6, 7.4], [-1.2, 6.5]].forEach(([x, z]) => pine(root, x, s * z, rr(0.8, 1.1), rr, pick(pines), true));
  scatter(40, s, rr, (x, z, low) => {
    const t = rr(0, 1);
    if (t < 0.35) mound(root, x, z, rr(0.4, 0.9), rr(0.35, 0.7), 0xffffff, 0.14);
    else if (t < 0.55) snowRock(root, x, z, rr(0.12, 0.3), rr);
    else if (t < 0.72) iceCrystal(root, x, z, rr(0.4, 0.75), rr);
    else if (t < 0.88 && !low) pine(root, x, z, rr(0.4, 0.6), rr, pick(pines), true);
    else bush(root, x, z, rr(0.5, 0.8), [0xe8f4fb, 0xd4e8f4, 0xffffff]);
  });
  border(12, s, rr, (x, z, k) => {
    if (k % 3) mound(root, x, z, rr(0.15, 0.3), rr(0.12, 0.25), 0xffffff, 0.1);
    else iceCrystal(root, x, z, rr(0.25, 0.4), rr);
  });
}

export function decorateForest(root, s, rr, pick) {
  const pines = [[0x1f5a35, 0x2a6e40, 0x174d2c], [0x24603a, 0x1c5232, 0x2f7346]];
  const canopy = [0x2e6b3a, 0x245a30, 0x3a7d44, 0x1f5530];
  const c3 = () => [pick(canopy), pick(canopy), pick(canopy)];
  TALL.forEach(([x, z], k) => {
    if (k % 3 === 1) roundTree(root, x, s * z, rr(1.15, 1.45), rr, c3(), 0x5a3d2a, 1.35);
    else pine(root, x, s * z, rr(1.25, 1.7), rr, pick(pines), false, 0x5a3d2a);
  });
  [[-2.5, 7.3], [2.7, 7.4], [0.2, 7.9]].forEach(([x, z]) => pine(root, x, s * z, rr(1.0, 1.3), rr, pick(pines), false, 0x5a3d2a));
  const shroom = [0x6ff7ff, 0xd38bff, 0x9dff7a];
  scatter(48, s, rr, (x, z, low) => {
    const t = rr(0, 1);
    if (t < 0.25) fern(root, x, z, rr(0.8, 1.4), rr);
    else if (t < 0.42) mushroom(root, x, z, rr(0.6, 1.1), 0, glow(pick(shroom)));
    else if (t < 0.56) mossRock(root, x, z, rr(0.15, 0.32), rr);
    else if (t < 0.68 && !low) log(root, x, z, rr(0.8, 1.2), rr);
    else if (t < 0.85) bush(root, x, z, low ? rr(0.5, 0.8) : rr(0.8, 1.3), c3());
    else grassTuft(root, x, z, 0x3d8a3a);
  });
  border(14, s, rr, (x, z, k) => {
    if (k % 3 === 0) mushroom(root, x, z, rr(0.4, 0.6), 0, glow(pick(shroom)));
    else fern(root, x, z, rr(0.4, 0.6), rr);
  });
}

export function decorateVolcano(root, s, rr, pick, animated) {
  TALL.forEach(([x, z], k) => {
    if (k === 6 || k === 14) volcano(root, x, s * z, rr(1.0, 1.2), rr, animated);
    else if (k % 3 === 0) obsidian(root, x, s * z, rr(1.2, 1.7), rr);
    else if (k % 3 === 1) deadTree(root, x, s * z, rr(1.0, 1.4), rr);
    else emberRock(root, x, s * z, rr(0.4, 0.6), rr);
  });
  [[-2.4, 7.2], [2.6, 7.5]].forEach(([x, z]) => mesa(root, x, s * z, rr(0.6, 0.8), rr, [0x3d3340, 0x4a3f4e, 0x352c38, 0x55485a, 0x3d3340]));
  scatter(40, s, rr, (x, z, low) => {
    const t = rr(0, 1);
    if (t < 0.18) lavaPool(root, x, z, rr(0.25, 0.5), rr, animated);
    else if (t < 0.42) emberRock(root, x, z, rr(0.12, 0.3), rr);
    else if (t < 0.6) obsidian(root, x, z, rr(0.4, 0.8), rr);
    else if (t < 0.75 && !low) deadTree(root, x, z, rr(0.5, 0.8), rr);
    else mound(root, x, z, rr(0.4, 0.8), rr(0.3, 0.6), 0x7a6e78, 0.1);
  });
  border(10, s, rr, (x, z, k) => {
    if (k % 2) emberRock(root, x, z, rr(0.07, 0.13), rr);
    else obsidian(root, x, z, rr(0.25, 0.4), rr);
  });
}

// ======================= Bờ sông (nửa sông phía s) =======================
const bankX = (k, rr) => (k % 4 < 2 ? 1 : -1) * rr(3.8, 9.2);

function lilyPads(root, s, rr, animated, padCol = 0x49c46a, flowerCol = 0xff9ecb) {
  for (let k = 0; k < 6; k++) {
    const x = (k % 2 ? 1 : -1) * rr(3.9, 8.6), z = s * rr(0.1, 1.15);
    const g = group(root, { p: [x, WATER_Y + 0.02, z], r: [0, rr(0, 6.28), 0] });
    const sc = rr(0.16, 0.3);
    mesh(g, G.cyl(1, 1, 0.03, 14, 1), padCol, { s: [sc, 1, sc], cast: false });
    if (k % 3 === 0) {
      for (let j = 0; j < 5; j++) {
        const a = (j / 5) * 6.28;
        mesh(g, G.cone(0.04, 0.1, 5), flowerCol, { p: [Math.cos(a) * 0.04, 0.06, Math.sin(a) * 0.04], r: [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6], cast: false });
      }
      mesh(g, G.sphere(0.03, 6, 5), 0xffe066, { p: [0, 0.07, 0], cast: false });
    }
    g.userData.dyn = true;
    const ph = rr(0, 6), y0 = g.position.y;
    animated.push((t) => { g.position.y = y0 + Math.sin(t * 1.6 + ph) * 0.012; g.rotation.y += 0.0015; });
  }
}

function bankRocks(root, s, rr, rockCol, reedCol, headCol) {
  for (let k = 0; k < 7; k++) {
    const x = bankX(k, rr), z = s * rr(1.3, 1.5);
    mesh(root, G.dode(1), flat(rockCol), { p: [x, WATER_Y + 0.04, z], s: [rr(0.12, 0.25), rr(0.1, 0.2), rr(0.12, 0.22)], r: [rr(0, 3), rr(0, 3), 0] });
    if (reedCol && k % 2 === 0) for (let j = 0; j < 3; j++) {
      mesh(root, G.cyl(0.012, 0.012, 0.5, 5), reedCol, { p: [x + 0.25 + j * 0.07, WATER_Y + 0.25, z], cast: false });
      mesh(root, G.capsule(0.03, 0.1), headCol, { p: [x + 0.25 + j * 0.07, WATER_Y + 0.5, z], cast: false });
    }
  }
}

export function bankPlains(root, s, rr, animated) {
  lilyPads(root, s, rr, animated);
  bankRocks(root, s, rr, 0x9aa3a8, 0x4aa862, 0x8a5a34);
}
export function bankDesert(root, s, rr) {
  bankRocks(root, s, rr, 0xd9925c, 0xc9a04a, 0xa87a3a);
}
export function bankForest(root, s, rr, animated) {
  lilyPads(root, s, rr, animated, 0x2f8a4a, 0xd38bff);
  bankRocks(root, s, rr, 0x6f7d6a, 0x2f7a3a, 0x5a3d2a);
}
export function bankSnow(root, s, rr, animated) {
  for (let k = 0; k < 7; k++) {
    const x = (k % 2 ? 1 : -1) * rr(3.9, 8.8), z = s * rr(0.15, 1.15);
    const g = group(root, { p: [x, WATER_Y + 0.02, z], r: [0, rr(0, 6.28), 0] });
    const sc = rr(0.2, 0.42);
    mesh(g, G.cyl(1, 0.92, 0.07, 6), k % 2 ? 0xeaf7ff : 0xd6eefc, { s: [sc, 1, sc * rr(0.6, 1)], cast: false });
    g.userData.dyn = true;
    const ph = rr(0, 6), y0 = g.position.y, x0 = x;
    animated.push((t) => { g.position.y = y0 + Math.sin(t * 1.4 + ph) * 0.012; g.position.x = x0 + Math.sin(t * 0.3 + ph) * 0.15; });
  }
  for (let k = 0; k < 6; k++) snowRock(root, bankX(k, rr), s * rr(1.3, 1.5), rr(0.12, 0.22), rr);
}
export function bankVolcano(root, s, rr, animated) {
  for (let k = 0; k < 7; k++) emberRock(root, bankX(k, rr), s * rr(1.3, 1.5), rr(0.1, 0.22), rr);
  // hơi nước bốc lên nơi dung nham chạm sông
  for (let k = 0; k < 3; k++) smokePuffs(root, (k % 2 ? 1 : -1) * rr(4.5, 8.5), WATER_Y, s * 1.35, 2, rr, animated, 0xf2eef5, 0.16);
}
