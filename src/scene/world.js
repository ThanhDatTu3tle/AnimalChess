import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { COLS, ROWS, WATER, TRAP, DEN, idx } from '../rules.js';
import { toon, G, mesh, group, rng, gradientMap, mergeStatic, TILE_Y, WATER_Y, cellX, cellZ } from './helpers.js';

export const TEAM = [
  { name: 'Rừng Xanh', main: 0x18b884, dark: 0x0c7a57, light: 0x8af5cf, css: '#18b884' },
  { name: 'Sa Mạc Đỏ', main: 0xf2503c, dark: 0xa52b20, light: 0xffb59a, css: '#f2503c' },
];

const flat = (color) => toon(color);

const waterVert = /* glsl */ `
  varying vec3 vW;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const waterFrag = /* glsl */ `
  uniform float t;
  uniform float fall; // 1 = thác nước (chảy dọc)
  varying vec3 vW;
  varying vec2 vUv;
  void main() {
    vec2 p = mix(vW.xz, vec2(vW.y * 1.4, vW.z), fall);
    p.x -= t * mix(0.7, -2.2, fall);
    float w = sin(p.x * 2.2 + sin(p.y * 3.1 + t * 0.8) * 1.3)
            * sin(p.y * 4.3 + sin(p.x * 1.7 - t * 0.6) * 1.6);
    float w2 = sin(p.x * 5.0 + p.y * 2.0 + t) * 0.5 + 0.5;
    vec3 deep = vec3(0.16, 0.66, 0.90);
    vec3 lite = vec3(0.42, 0.87, 0.98);
    vec3 col = mix(deep, lite, smoothstep(-0.5, 0.7, w) * 0.75 + w2 * 0.15);
    float foam = smoothstep(0.80, 0.86, w);
    // bọt sát bờ
    float edge = smoothstep(1.32, 1.5, abs(vW.z) + sin(vW.x * 6.0 + t * 2.0) * 0.04);
    foam = max(foam, edge * (1.0 - fall));
    col = mix(col, vec3(1.0), foam * 0.85);
    col = mix(col, vec3(1.0), fall * smoothstep(0.55, 1.0, w2) * 0.5);
    gl_FragColor = vec4(col, mix(0.9, 0.95, fall));
    #include <colorspace_fragment>
  }`;

export function buildWorld(scene) {
  const root = group(scene);
  const refs = {};
  const animated = [];
  const R = rng(20261116);
  const rr = (a, b) => a + (b - a) * R();
  const pick = (arr) => arr[(R() * arr.length) | 0];

  // ---------- Nền đất (diorama) ----------
  const HALF_W = 10;
  // Rừng (z > 1.5)
  mesh(root, new RoundedBoxGeometry(HALF_W * 2, 0.4, 7, 3, 0.12), 0x6fc74e, { p: [0, -0.2, 5], cast: false });
  mesh(root, G.box(HALF_W * 2 - 0.2, 2.2, 6.8), 0x9a6a44, { p: [0, -1.45, 5], cast: false });
  // Sa mạc (z < -1.5)
  mesh(root, new RoundedBoxGeometry(HALF_W * 2, 0.4, 7, 3, 0.12), 0xf1cf85, { p: [0, -0.2, -5], cast: false });
  mesh(root, G.box(HALF_W * 2 - 0.2, 2.2, 6.8), 0xc98452, { p: [0, -1.45, -5], cast: false });
  // Lòng sông
  mesh(root, G.box(HALF_W * 2 - 0.2, 2.0, 3.4), 0x3f86a6, { p: [0, -1.55, 0], cast: false });

  // ---------- Nước ----------
  const waterMat = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, fall: { value: 0 } },
    vertexShader: waterVert, fragmentShader: waterFrag, transparent: true,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2 - 0.1, 3.3), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_Y;
  root.add(water);
  const fallMat = waterMat.clone();
  fallMat.uniforms = { t: waterMat.uniforms.t, fall: { value: 1 } };
  // thác đổ ra mép +x
  const fallOut = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 2.4), fallMat);
  fallOut.rotation.y = Math.PI / 2;
  fallOut.position.set(HALF_W - 0.04, WATER_Y - 1.2, 0);
  root.add(fallOut);
  // núi đá đầu nguồn ở mép -x
  const src = group(root, { p: [-HALF_W + 0.9, 0, 0] });
  for (const [x, y, z, s, c] of [
    [-0.3, 0.5, -1.5, 1.2, 0x9a97a8], [-0.4, 0.6, 1.5, 1.25, 0x8d8a9c], [-0.7, 1.2, 0, 1.5, 0xa5a2b3],
    [-0.5, 1.9, -0.8, 0.9, 0x9a97a8], [-0.6, 2.0, 0.7, 1.0, 0x8d8a9c], [0.3, 0.2, -1.75, 0.6, 0xb0adbd], [0.3, 0.2, 1.8, 0.55, 0xb0adbd],
  ]) mesh(src, G.dode(1), flat(c), { p: [x, y, z], s: [s, s * 0.9, s], r: [rr(0, 3), rr(0, 3), rr(0, 3)] });
  mesh(src, G.ico(1, 1), flat(0x5fc85a), { p: [-0.6, 2.75, 0.2], s: [1.0, 0.35, 1.1] });
  const fallIn = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.3), fallMat);
  fallIn.rotation.y = Math.PI / 2;
  fallIn.position.set(0.72, WATER_Y + 1.1, 0);
  src.add(fallIn);
  for (let i = 0; i < 7; i++) {
    const f = mesh(src, G.sphere(1, 10, 8), toon(0xffffff), { p: [0.95 + rr(-0.1, 0.25), WATER_Y, rr(-0.8, 0.8)], s: rr(0.14, 0.26), cast: false });
    f.userData.dyn = true;
    const ph = rr(0, 6), base = f.scale.x;
    animated.push((t) => f.scale.setScalar(base * (0.8 + 0.3 * Math.sin(t * 3 + ph))));
  }

  // ---------- Ô bàn cờ ----------
  const tileGeo = new RoundedBoxGeometry(0.94, 0.14, 0.94, 2, 0.045);
  const tileCols = {
    jungle: [0xb4ea74, 0x9fde62],
    desert: [0xffe9ab, 0xf8da8e],
  };
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const i = idx(c, r), x = cellX(c), z = cellZ(r);
    if (WATER[i]) {
      const f = new THREE.Mesh(G.box(0.9, 0.01, 0.9), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.13, depthWrite: false }));
      f.position.set(x, WATER_Y + 0.012, z);
      root.add(f);
      continue;
    }
    if (r >= 3 && r <= 5) continue; // cầu
    const biome = r < 3 ? 'jungle' : 'desert';
    let col = tileCols[biome][(c + r) % 2];
    if (TRAP[i] >= 0) col = biome === 'jungle' ? 0xb08a5c : 0xd09a62;
    if (DEN[i] >= 0) col = 0x6d6880;
    mesh(root, tileGeo, col, { p: [x, TILE_Y - 0.07, z], cast: false });
    if (TRAP[i] >= 0) buildTrap(root, x, z, TRAP[i]);
    if (DEN[i] >= 0) buildDen(root, x, z, DEN[i], animated, rr, refs);
  }

  // ---------- Cầu gỗ ----------
  const plankCols = [0xd9a066, 0xc98f55, 0xe3b077];
  for (const bx of [-3, 0, 3]) {
    const b = group(root, { p: [bx, 0, 0] });
    for (const sx of [-0.36, 0.36]) mesh(b, G.box(0.1, 0.12, 3.3), 0x8a5a34, { p: [sx, TILE_Y - 0.13, 0] });
    for (let k = 0; k < 12; k++) {
      const z = -1.5 + 0.125 + k * 0.25;
      const cellTone = ((k / 4) | 0) % 2;
      mesh(b, G.box(0.96, 0.07, 0.215), plankCols[(k + cellTone) % 3], { p: [rr(-0.012, 0.012), TILE_Y - 0.035, z], r: [0, rr(-0.03, 0.03), 0] });
    }
    for (const sx of [-0.5, 0.5]) {
      for (const z of [-1.5, -0.5, 0.5, 1.5]) {
        const end = Math.abs(z) > 1;
        mesh(b, G.cyl(0.045, 0.055, end ? 0.62 : 0.4, 8), 0x8a5a34, { p: [sx, TILE_Y + (end ? 0.1 : 0.0), z] });
        if (end) mesh(b, G.sphere(0.065, 8, 6), 0xf6c453, { p: [sx, TILE_Y + 0.44, z] });
      }
      mesh(b, G.cyl(0.014, 0.014, 3, 5), 0xf3e3bd, { p: [sx, TILE_Y + 0.17, 0], r: [Math.PI / 2, 0, 0], cast: false });
    }
    // trụ chống
    for (const z of [-0.5, 0.5]) for (const sx of [-0.36, 0.36]) mesh(b, G.cyl(0.05, 0.05, 0.6, 6), 0x754a2a, { p: [sx, -0.35, z], cast: false });
  }

  // ---------- Trang trí ----------
  decorateJungle(root, rr, pick, animated);
  decorateDesert(root, rr, pick);
  decorateRiver(root, rr, animated);
  buildClouds(root, rr, animated);
  mergeStatic(root);

  return {
    // khi nhìn từ phía Sa Mạc thì ẩn cửa hang lớn để không che bàn cờ
    setFlipped(f) { if (refs.cave) refs.cave.visible = !f; },
    update(t) {
      waterMat.uniforms.t.value = t;
      for (const f of animated) f(t);
    },
  };
}

// ---------------- Bẫy ----------------
function buildTrap(root, x, z, owner) {
  const g = group(root, { p: [x, TILE_Y, z] });
  mesh(g, G.cyl(0.4, 0.4, 0.02, 20), 0x6b4a2e, { p: [0, 0.008, 0], cast: false });
  mesh(g, G.torus(0.4, 0.028, 6, 24), TEAM[owner].dark, { p: [0, 0.03, 0], r: [Math.PI / 2, 0, 0], cast: false });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const pv = group(g, { r: [0, -a, 0] });
    mesh(pv, G.cone(0.05, 0.24, 6), 0xf4ead2, { p: [0.4, 0.1, 0], r: [0, 0, -0.45] });
  }
  // răng cưa nhỏ ở giữa
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    mesh(g, G.cone(0.03, 0.09, 5), 0xd8d2c4, { p: [Math.cos(a) * 0.18, 0.05, Math.sin(a) * 0.18], cast: false });
  }
}

// ---------------- Hang ----------------
function buildDen(root, x, z, owner, animated, rr, refs) {
  const d = owner === 0 ? 1 : -1; // hướng ra ngoài bàn
  const g = group(root, { p: [x, TILE_Y, z] });
  mesh(g, G.cyl(0.37, 0.37, 0.02, 24), 0x241d33, { p: [0, 0.008, 0], cast: false });
  const ringMat = new THREE.MeshBasicMaterial({ color: TEAM[owner].light });
  const ring = mesh(g, G.torus(0.38, 0.035, 6, 28), ringMat, { p: [0, 0.03, 0], r: [Math.PI / 2, 0, 0], cast: false });
  const swirl = mesh(g, G.torus(0.2, 0.025, 5, 16, Math.PI * 1.4), new THREE.MeshBasicMaterial({ color: TEAM[owner].main }), { p: [0, 0.025, 0], r: [Math.PI / 2, 0, 0], cast: false });
  ring.userData.dyn = swirl.userData.dyn = true;
  animated.push((t) => {
    swirl.rotation.z = t * 1.5 * d;
    ring.scale.setScalar(1 + 0.03 * Math.sin(t * 3));
  });
  // vòng đá sau hang (thấp ở phía gần camera để không che bàn)
  const rockC = [0x9794a6, 0x86839a, 0xa9a6b8];
  const hMul = owner === 0 ? 0.75 : 1.5;
  for (let k = 0; k < 7; k++) {
    const u = k / 6 - 0.5;
    const s = (0.2 + 0.1 * Math.sin(k * 2.1 + 1) + (1 - Math.abs(u) * 2) * 0.08) * hMul;
    mesh(g, G.dode(1), flat(rockC[k % 3]), { p: [u * 1.25, s * 0.5, d * (0.66 + (1 - Math.abs(u) * 2) * 0.12)], s: [0.24, s, 0.22], r: [0, k * 1.3, 0] });
  }
  if (owner === 1) {
    // cửa hang lớn phía xa
    const cave = group(g, { p: [0, 0, -1.25] });
    cave.userData.dyn = true;
    refs.cave = cave;
    for (const [cx, cy, s, c] of [[-0.75, 0.45, 0.75, 0xc98452], [0.75, 0.45, 0.78, 0xd9925c], [0, 1.05, 0.95, 0xe0a068], [-0.45, 0.95, 0.6, 0xd9925c], [0.5, 0.98, 0.62, 0xc98452]])
      mesh(cave, G.dode(1), flat(c), { p: [cx, cy, -0.1], s: [s, s * 0.85, s * 0.8], r: [cx, cy * 2, 0] });
    mesh(cave, G.sphere(0.5, 14, 10), new THREE.MeshBasicMaterial({ color: 0x241d33 }), { p: [0, 0.3, 0.38], s: [1, 1.15, 0.5], cast: false });
  }
  // cờ hiệu
  for (const sx of [-0.66, 0.66]) {
    const pole = group(g, { p: [sx, 0, d * 0.5] });
    mesh(pole, G.cyl(0.022, 0.028, 1.15, 6), 0x8a5a34, { p: [0, 0.57, 0] });
    mesh(pole, G.sphere(0.045, 8, 6), 0xf6c453, { p: [0, 1.17, 0] });
    const flag = group(pole, { p: [0, 0.95, 0] });
    flag.userData.dyn = true;
    mesh(flag, G.box(0.3, 0.2, 0.015), TEAM[owner].main, { p: [Math.sign(sx) * 0.16, 0, 0] });
    mesh(flag, G.box(0.3, 0.05, 0.017), TEAM[owner].light, { p: [Math.sign(sx) * 0.16, 0.03, 0] });
    const ph = rr(0, 6);
    animated.push((t) => { flag.rotation.y = Math.sin(t * 2.2 + ph) * 0.3; });
  }
}

// ---------------- Rừng nhiệt đới ----------------
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
    const droop = k % 2 ? -0.55 : -0.3;
    const arm = group(lf, { r: [0, 0, droop] });
    mesh(arm, G.sphere(1, 10, 6), k % 2 ? 0x3cba5a : 0x56d06a, { p: [0.5, 0, 0], s: [0.55, 0.035, 0.17] });
    mesh(arm, G.sphere(1, 8, 6), k % 2 ? 0x2fa850 : 0x3cba5a, { p: [0.98, -0.12, 0], s: [0.3, 0.03, 0.12], r: [0, 0, -0.5] });
  }
  for (let k = 0; k < 3; k++) mesh(top, G.sphere(0.075, 8, 6), 0x7a4b2a, { p: [Math.cos(k * 2.1) * 0.1, -0.08, Math.sin(k * 2.1) * 0.1] });
  return g;
}

function roundTree(root, x, z, s, rr, cols) {
  const g = group(root, { p: [x, 0, z], s, r: [0, rr(0, 6.28), 0] });
  mesh(g, G.cyl(0.1, 0.16, 1.0, 8), 0x8b5e3c, { p: [0, 0.5, 0] });
  mesh(g, G.ico(1, 1), flat(cols[0]), { p: [0, 1.35, 0], s: [0.75, 0.68, 0.75] });
  mesh(g, G.ico(1, 1), flat(cols[1]), { p: [0.42, 1.1, 0.2], s: 0.48 });
  mesh(g, G.ico(1, 1), flat(cols[2]), { p: [-0.4, 1.15, -0.15], s: 0.5 });
  mesh(g, G.ico(1, 1), flat(cols[1]), { p: [0.05, 1.82, 0.05], s: 0.42 });
  return g;
}

function bush(root, x, z, s, cols) {
  const g = group(root, { p: [x, 0, z], s });
  mesh(g, G.ico(1, 1), flat(cols[0]), { p: [0, 0.2, 0], s: [0.34, 0.28, 0.34] });
  mesh(g, G.ico(1, 1), flat(cols[1]), { p: [0.26, 0.15, 0.08], s: 0.22 });
  mesh(g, G.ico(1, 1), flat(cols[2 % cols.length]), { p: [-0.24, 0.14, -0.05], s: 0.2 });
  return g;
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

function mushroom(root, x, z, s) {
  const g = group(root, { p: [x, 0, z], s });
  mesh(g, G.cyl(0.05, 0.065, 0.16, 8), 0xfff4e0, { p: [0, 0.08, 0] });
  mesh(g, G.sphere(0.15, 12, 8), 0xff5a5f, { p: [0, 0.16, 0], s: [1, 0.62, 1] });
  for (let k = 0; k < 5; k++) {
    const a = k * 1.3;
    mesh(g, G.sphere(0.028, 6, 5), 0xffffff, { p: [Math.cos(a) * 0.09, 0.225, Math.sin(a) * 0.09], cast: false });
  }
}

function rock(root, x, z, s, color, rr) {
  mesh(root, G.dode(1), flat(color), { p: [x, s * 0.3, z], s: [s, s * 0.7, s * 0.85], r: [rr(0, 3), rr(0, 3), 0] });
}

function grassTuft(root, x, z, color) {
  for (let k = 0; k < 3; k++) mesh(root, G.cone(0.03, 0.2, 4), color, { p: [x + (k - 1) * 0.05, 0.1, z + (k % 2) * 0.04], r: [0, 0, (k - 1) * 0.25], cast: false });
}

function decorateJungle(root, rr, pick, animated) {
  const greens = [0x4cc45a, 0x38b04e, 0x6ad66a, 0x2e9e58];
  const g3 = () => [pick(greens), pick(greens), pick(greens)];
  // cây cao: hai bên sườn
  const tall = [
    [-5.2, 2.6, 'p'], [-6.6, 4.2, 'r'], [-8.3, 2.8, 'p'], [-5.4, 5.6, 'r'], [-7.6, 6.3, 'p'], [-8.8, 4.9, 'r'], [-6.6, 7.7, 'r'], [-9.0, 7.6, 'p'],
    [5.3, 2.5, 'r'], [6.9, 3.6, 'p'], [8.5, 2.6, 'r'], [5.2, 5.2, 'p'], [7.5, 5.6, 'r'], [8.9, 4.4, 'p'], [6.2, 7.5, 'p'], [8.6, 7.2, 'r'],
  ];
  for (const [x, z, k] of tall) {
    if (k === 'p') {
      const p = palm(root, x, z, rr(1.0, 1.35), rr);
      p.userData.dyn = true;
      const ph = rr(0, 6), base = p.rotation.z;
      animated.push((t) => { p.rotation.z = base + Math.sin(t * 0.9 + ph) * 0.025; });
    } else roundTree(root, x, z, rr(0.95, 1.3), rr, g3());
  }
  // bụi, hoa, nấm, đá
  const fcol = [0xff7eb6, 0xffffff, 0xffd23f, 0xc084fc, 0xff8a5c];
  for (let k = 0; k < 46; k++) {
    let x = rr(-9.5, 9.5), z = rr(1.95, 8.2);
    if (Math.abs(x) < 4.1 && z < 5.0) { z = rr(5.1, 8.2); }
    const lowZone = Math.abs(x) < 4.3;
    const t = R01(k);
    if (t < 0.3) bush(root, x, z, lowZone ? rr(0.5, 0.8) : rr(0.8, 1.4), g3());
    else if (t < 0.62) flower(root, x, z, pick(fcol));
    else if (t < 0.74) mushroom(root, x, z, rr(0.7, 1.3));
    else if (t < 0.86) rock(root, x, z, rr(0.12, 0.3), pick([0x9aa3a8, 0x858f96, 0xb3bcc0]), rr);
    else grassTuft(root, x, z, pick(greens));
  }
  // hoa/cỏ viền bàn cờ
  for (let k = 0; k < 14; k++) {
    const side = k % 2 ? 1 : -1;
    flower(root, side * rr(3.75, 4.1), rr(1.8, 4.6), pick(fcol));
    grassTuft(root, side * rr(3.7, 4.2), rr(1.8, 4.6), pick(greens));
  }
  function R01(k) { return ((Math.sin(k * 127.1 + 3.3) * 43758.5453) % 1 + 1) % 1; }
}

// ---------------- Sa mạc / hẻm núi ----------------
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

function mesa(root, x, z, s, rr) {
  const g = group(root, { p: [x, 0, z], s, r: [0, rr(0, 6.28), 0] });
  const cols = [0xd9703c, 0xf0a060, 0xe08a4f, 0xf6b877, 0xd9703c];
  let y = 0, r = 1.0;
  for (let k = 0; k < 5; k++) {
    const h = rr(0.28, 0.48);
    mesh(g, G.cyl(r * 0.9, r, h, 7), flat(cols[k]), { p: [rr(-0.05, 0.05), y + h / 2, rr(-0.05, 0.05)], r: [0, rr(0, 1), 0] });
    y += h; r *= rr(0.8, 0.92);
  }
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

function decorateDesert(root, rr, pick) {
  const warm = [[0xf2b33d, 0xe8912e], [0xe8c547, 0xf2b33d], [0xf28f3b, 0xe0662e]];
  const items = [
    [-5.3, -2.7, 'c'], [-6.9, -4.0, 'm'], [-8.6, -2.6, 'a'], [-5.2, -5.6, 'a'], [-7.7, -6.4, 'c'], [-9.0, -5.0, 'c'], [-6.0, -7.5, 'm'], [-4.4, -7.3, 'c'], [-8.8, -7.6, 'a'],
    [5.2, -2.6, 'a'], [7.0, -3.8, 'c'], [8.6, -2.7, 'm'], [5.4, -5.3, 'c'], [7.6, -5.8, 'a'], [9.0, -4.6, 'c'], [6.4, -7.5, 'm'], [8.7, -7.3, 'c'], [4.6, -7.4, 'a'],
    [-2.6, -7.4, 'm'], [2.7, -7.5, 'c'], [-1.6, -6.3, 'c'], [2.2, -6.6, 'c'],
  ];
  for (const [x, z, k] of items) {
    if (k === 'c') cactus(root, x, z, rr(0.8, 1.25), rr);
    else if (k === 'm') mesa(root, x, z, rr(0.75, 1.1), rr);
    else acacia(root, x, z, rr(0.95, 1.3), rr, pick(warm));
  }
  for (let k = 0; k < 40; k++) {
    let x = rr(-9.5, 9.5), z = rr(-8.2, -1.95);
    if (Math.abs(x) < 4.1 && z > -5.0) z = rr(-8.2, -5.1);
    const t = rr(0, 1);
    if (t < 0.3) rock(root, x, z, rr(0.12, 0.32), pick([0xd9925c, 0xc98452, 0xe8b07a]), rr);
    else if (t < 0.55) bush(root, x, z, rr(0.5, 0.9), [0xd9b45a, 0xc9a04a, 0xe6c773]);
    else if (t < 0.8) grassTuft(root, x, z, pick([0xd9b45a, 0xb8a04a]));
    else mesh(root, G.sphere(1, 12, 8), 0xf8dfa0, { p: [x, -0.02, z], s: [rr(0.5, 1.0), 0.12, rr(0.4, 0.8)], cast: false });
  }
  for (let k = 0; k < 10; k++) {
    const side = k % 2 ? 1 : -1;
    rock(root, side * rr(3.75, 4.15), rr(-4.6, -1.8), rr(0.07, 0.14), pick([0xd9925c, 0xe8b07a]), rr);
    grassTuft(root, side * rr(3.7, 4.2), rr(-4.6, -1.8), 0xd9b45a);
  }
}

// ---------------- Sông ----------------
function decorateRiver(root, rr, animated) {
  // lá súng + hoa (ngoài vùng bàn cờ)
  for (let k = 0; k < 12; k++) {
    const side = k % 2 ? 1 : -1;
    const x = side * rr(3.9, 8.6), z = rr(-1.15, 1.15);
    const g = group(root, { p: [x, WATER_Y + 0.02, z], r: [0, rr(0, 6.28), 0] });
    const sc = rr(0.16, 0.3);
    mesh(g, G.cyl(1, 1, 0.03, 14, 1), 0x49c46a, { s: [sc, 1, sc], cast: false });
    if (k % 3 === 0) {
      for (let j = 0; j < 5; j++) {
        const a = (j / 5) * 6.28;
        mesh(g, G.cone(0.04, 0.1, 5), 0xff9ecb, { p: [Math.cos(a) * 0.04, 0.06, Math.sin(a) * 0.04], r: [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6], cast: false });
      }
      mesh(g, G.sphere(0.03, 6, 5), 0xffe066, { p: [0, 0.07, 0], cast: false });
    }
    g.userData.dyn = true;
    const ph = rr(0, 6), y0 = g.position.y;
    animated.push((t) => { g.position.y = y0 + Math.sin(t * 1.6 + ph) * 0.012; g.rotation.y += 0.0015; });
  }
  // đá và lau sậy sát bờ
  for (let k = 0; k < 14; k++) {
    const side = k % 2 ? 1 : -1;
    const x = (k % 4 < 2 ? 1 : -1) * rr(3.8, 9.2), z = side * rr(1.3, 1.5);
    mesh(root, G.dode(1), flat(0x9aa3a8), { p: [x, WATER_Y + 0.04, z], s: [rr(0.12, 0.25), rr(0.1, 0.2), rr(0.12, 0.22)], r: [rr(0, 3), rr(0, 3), 0] });
    if (k % 2 === 0) for (let j = 0; j < 3; j++) {
      mesh(root, G.cyl(0.012, 0.012, 0.5, 5), 0x4aa862, { p: [x + 0.25 + j * 0.07, WATER_Y + 0.25, z], cast: false });
      mesh(root, G.capsule(0.03, 0.1), 0x8a5a34, { p: [x + 0.25 + j * 0.07, WATER_Y + 0.5, z], cast: false });
    }
  }
}

// ---------------- Mây ----------------
function buildClouds(root, rr, animated) {
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap, transparent: true, opacity: 0.95 });
  const spots = [
    [-13, 1.5, -12, 1.6], [-5, 3.2, -14, 2.0], [4, 2.2, -13.5, 1.7], [12, 3.5, -12, 2.1],
    [-15, 0.5, -3, 1.5], [15.5, 1.0, -5, 1.6], [-15, -1, 6, 1.4], [15, -0.8, 5, 1.5],
    [-9, -2.6, 11, 1.3], [8, -2.8, 11.5, 1.4],
  ];
  for (const [x, y, z, s] of spots) {
    const g = group(root, { p: [x, y, z], s });
    mesh(g, G.sphere(1, 12, 8), mat, { s: [1, 0.6, 0.7], cast: false, receive: false });
    mesh(g, G.sphere(1, 12, 8), mat, { p: [0.8, -0.1, 0.1], s: [0.7, 0.45, 0.55], cast: false, receive: false });
    mesh(g, G.sphere(1, 12, 8), mat, { p: [-0.85, -0.12, 0], s: [0.65, 0.42, 0.5], cast: false, receive: false });
    mesh(g, G.sphere(1, 12, 8), mat, { p: [0.2, 0.3, -0.1], s: [0.6, 0.45, 0.5], cast: false, receive: false });
    g.userData.dyn = true;
    const ph = rr(0, 6), x0 = x;
    animated.push((t) => { g.position.x = x0 + Math.sin(t * 0.12 + ph) * 0.8; });
  }
}
