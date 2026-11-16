import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { COLS, ROWS, WATER, TRAP, DEN, idx } from '../rules.js';
import { toon, G, mesh, group, rng, gradientMap, mergeStatic, TILE_Y, WATER_Y, cellX, cellZ } from './helpers.js';
import { TEAM, BIOMES } from './biomes.js';

export { TEAM };

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
// Mỗi nửa sông (z > 0: phe 0, z < 0: phe 1) mang màu của biome bên đó; lava = 1 thì mép bờ là dung nham
const waterFrag = /* glsl */ `
  uniform float t;
  uniform float fall; // 1 = thác nước (chảy dọc)
  uniform vec3 deep0, lite0, foam0, deep1, lite1, foam1;
  uniform float lava0, lava1;
  varying vec3 vW;
  varying vec2 vUv;
  void main() {
    float side = smoothstep(-0.5, 0.5, vW.z);
    vec3 deep = mix(deep1, deep0, side), lite = mix(lite1, lite0, side), foamC = mix(foam1, foam0, side);
    float lava = mix(lava1, lava0, side);
    vec2 p = mix(vW.xz, vec2(vW.y * 1.4, vW.z), fall);
    p.x -= t * mix(0.7, -2.2, fall);
    float w = sin(p.x * 2.2 + sin(p.y * 3.1 + t * 0.8) * 1.3)
            * sin(p.y * 4.3 + sin(p.x * 1.7 - t * 0.6) * 1.6);
    float w2 = sin(p.x * 5.0 + p.y * 2.0 + t) * 0.5 + 0.5;
    vec3 col = mix(deep, lite, smoothstep(-0.5, 0.7, w) * 0.75 + w2 * 0.15);
    col = mix(col, foamC, smoothstep(0.80, 0.86, w) * 0.85);
    // mép bờ: bọt trắng, hoặc dải dung nham chảy ven bờ
    float edge = smoothstep(1.32, 1.5, abs(vW.z) + sin(vW.x * 6.0 + t * 2.0) * 0.04) * (1.0 - fall);
    vec3 lavaC = vec3(1.0, 0.42, 0.08) + vec3(0.0, 0.3, 0.12) * (0.5 + 0.5 * sin(t * 2.5 + vW.x * 3.0));
    col = mix(col, mix(vec3(1.0), lavaC, lava), edge * mix(0.85, 1.0, lava));
    col = mix(col, vec3(1.0), fall * smoothstep(0.55, 1.0, w2) * 0.5);
    gl_FragColor = vec4(col, mix(0.9, 0.95, fall));
    #include <colorspace_fragment>
  }`;

/** Dựng map theo biome hiện tại của TEAM[0] (phía +z) và TEAM[1] (phía -z). */
export function buildWorld(scene) {
  const root = group(scene);
  const refs = {};
  const animated = [];
  const R = rng(20261116);
  const rr = (a, b) => a + (b - a) * R();
  const pick = (arr) => arr[(R() * arr.length) | 0];
  const B = [BIOMES[TEAM[0].id], BIOMES[TEAM[1].id]];
  const sideOf = (team) => (team === 0 ? 1 : -1);
  const own = [];

  // ---------- Nền đất (diorama) ----------
  const HALF_W = 10;
  const slab = new RoundedBoxGeometry(HALF_W * 2, 0.4, 7, 3, 0.12);
  own.push(slab);
  for (const team of [0, 1]) {
    const s = sideOf(team), g = B[team].ground;
    mesh(root, slab, g.top, { p: [0, -0.2, 5 * s], cast: false });
    mesh(root, G.box(HALF_W * 2 - 0.2, 2.2, 6.8), g.soil, { p: [0, -1.45, 5 * s], cast: false });
  }
  // Lòng sông
  mesh(root, G.box(HALF_W * 2 - 0.2, 2.0, 3.4), 0x3f86a6, { p: [0, -1.55, 0], cast: false });

  // ---------- Nước ----------
  const v3 = (a) => new THREE.Vector3(...a);
  const [w0, w1] = [B[0].water, B[1].water];
  const waterMat = new THREE.ShaderMaterial({
    uniforms: {
      t: { value: 0 }, fall: { value: 0 },
      deep0: { value: v3(w0.deep) }, lite0: { value: v3(w0.lite) }, foam0: { value: v3(w0.foam) }, lava0: { value: w0.lava },
      deep1: { value: v3(w1.deep) }, lite1: { value: v3(w1.lite) }, foam1: { value: v3(w1.foam) }, lava1: { value: w1.lava },
    },
    vertexShader: waterVert, fragmentShader: waterFrag, transparent: true,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2 - 0.1, 3.3), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_Y;
  root.add(water);
  const fallMat = waterMat.clone();
  fallMat.uniforms = { ...waterMat.uniforms, fall: { value: 1 } };
  own.push(water.geometry, waterMat, fallMat);
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
  ]) mesh(src, G.dode(1), flat(c), { p: [x, y, z], s: [s, s * 0.9, s], r: [rr(0, 3), rr(0, 3), 0] });
  mesh(src, G.ico(1, 1), flat(0x5fc85a), { p: [-0.6, 2.75, 0.2], s: [1.0, 0.35, 1.1] });
  const fallIn = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.3), fallMat);
  fallIn.rotation.y = Math.PI / 2;
  fallIn.position.set(0.72, WATER_Y + 1.1, 0);
  src.add(fallIn);
  own.push(fallOut.geometry, fallIn.geometry);
  for (let i = 0; i < 7; i++) {
    const f = mesh(src, G.sphere(1, 10, 8), toon(0xffffff), { p: [0.95 + rr(-0.1, 0.25), WATER_Y, rr(-0.8, 0.8)], s: rr(0.14, 0.26), cast: false });
    f.userData.dyn = true;
    const ph = rr(0, 6), base = f.scale.x;
    animated.push((t) => f.scale.setScalar(base * (0.8 + 0.3 * Math.sin(t * 3 + ph))));
  }

  // ---------- Ô bàn cờ ----------
  const tileGeo = new RoundedBoxGeometry(0.94, 0.14, 0.94, 2, 0.045);
  own.push(tileGeo);
  const waterTileMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.13, depthWrite: false });
  own.push(waterTileMat);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const i = idx(c, r), x = cellX(c), z = cellZ(r);
    if (WATER[i]) {
      const f = new THREE.Mesh(G.box(0.9, 0.01, 0.9), waterTileMat);
      f.position.set(x, WATER_Y + 0.012, z);
      root.add(f);
      continue;
    }
    if (r >= 3 && r <= 5) continue; // cầu
    const bm = B[r < 3 ? 0 : 1];
    let col = bm.tiles[(c + r) % 2];
    if (TRAP[i] >= 0) col = bm.trap;
    if (DEN[i] >= 0) col = 0x6d6880;
    mesh(root, tileGeo, col, { p: [x, TILE_Y - 0.07, z], cast: false });
    if (TRAP[i] >= 0) buildTrap(root, x, z, TRAP[i]);
    if (DEN[i] >= 0) buildDen(root, x, z, DEN[i], bm, animated, rr, refs);
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
    for (const z of [-0.5, 0.5]) for (const sx of [-0.36, 0.36]) mesh(b, G.cyl(0.05, 0.05, 0.6, 6), 0x754a2a, { p: [sx, -0.35, z], cast: false });
  }

  // ---------- Trang trí theo biome ----------
  for (const team of [0, 1]) {
    const s = sideOf(team);
    B[team].decorate(root, s, rr, pick, animated);
    B[team].bank(root, s, rr, animated);
  }
  buildClouds(root, rr, animated, own);
  mergeStatic(root);

  return {
    // khi nhìn từ phía phe 1 thì ẩn cửa hang lớn để không che bàn cờ
    setFlipped(f) { if (refs.cave) refs.cave.visible = !f; },
    update(t) {
      waterMat.uniforms.t.value = t;
      for (const f of animated) f(t);
    },
    dispose() {
      scene.remove(root);
      root.traverse((o) => { if (o.userData.merged) o.geometry.dispose(); });
      for (const x of own) x.dispose();
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
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    mesh(g, G.cone(0.03, 0.09, 5), 0xd8d2c4, { p: [Math.cos(a) * 0.18, 0.05, Math.sin(a) * 0.18], cast: false });
  }
}

// ---------------- Hang ----------------
function buildDen(root, x, z, owner, bm, animated, rr, refs) {
  const d = owner === 0 ? 1 : -1; // hướng ra ngoài bàn
  const g = group(root, { p: [x, TILE_Y, z] });
  mesh(g, G.cyl(0.37, 0.37, 0.02, 24), 0x241d33, { p: [0, 0.008, 0], cast: false });
  const ring = mesh(g, G.torus(0.38, 0.035, 6, 28), new THREE.MeshBasicMaterial({ color: TEAM[owner].light }), { p: [0, 0.03, 0], r: [Math.PI / 2, 0, 0], cast: false });
  const swirl = mesh(g, G.torus(0.2, 0.025, 5, 16, Math.PI * 1.4), new THREE.MeshBasicMaterial({ color: TEAM[owner].main }), { p: [0, 0.025, 0], r: [Math.PI / 2, 0, 0], cast: false });
  ring.userData.dyn = swirl.userData.dyn = true;
  animated.push((t) => {
    swirl.rotation.z = t * 1.5 * d;
    ring.scale.setScalar(1 + 0.03 * Math.sin(t * 3));
  });
  // vòng đá sau hang (thấp ở phía gần camera để không che bàn)
  const rockC = bm.rocks;
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
    for (const [cx, cy, s, k] of [[-0.75, 0.45, 0.75, 0], [0.75, 0.45, 0.78, 1], [0, 1.05, 0.95, 2], [-0.45, 0.95, 0.6, 1], [0.5, 0.98, 0.62, 0]])
      mesh(cave, G.dode(1), flat(rockC[k]), { p: [cx, cy, -0.1], s: [s, s * 0.85, s * 0.8], r: [cx, cy * 2, 0] });
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

// ---------------- Mây ----------------
function buildClouds(root, rr, animated, own) {
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap, transparent: true, opacity: 0.95 });
  own.push(mat);
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
