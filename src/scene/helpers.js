import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Bảng màu 4 nấc cho phong cách hoạt hình (toon)
const gradData = new Uint8Array([120, 185, 235, 255]);
export const gradientMap = new THREE.DataTexture(gradData, 4, 1, THREE.RedFormat);
gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
gradientMap.needsUpdate = true;

const matCache = new Map();
export function toon(color, opts) {
  if (opts) return new THREE.MeshToonMaterial({ color, gradientMap, ...opts });
  let m = matCache.get(color);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap });
    matCache.set(color, m);
  }
  return m;
}

const geoCache = new Map();
function cached(key, make) {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}
export const G = {
  sphere: (r = 1, w = 16, h = 12) => cached(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h)),
  box: (x = 1, y = 1, z = 1) => cached(`b${x},${y},${z}`, () => new THREE.BoxGeometry(x, y, z)),
  cyl: (rt = 1, rb = 1, h = 1, seg = 12) => cached(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)),
  cone: (r = 1, h = 1, seg = 10) => cached(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg)),
  ico: (r = 1, d = 0) => cached(`i${r},${d}`, () => { const g = new THREE.IcosahedronGeometry(r, d); g.computeVertexNormals(); return g; }),
  dode: (r = 1) => cached(`d${r}`, () => new THREE.DodecahedronGeometry(r, 0)),
  torus: (r = 1, t = 0.1, a = 8, b = 20, arc = Math.PI * 2) => cached(`t${r},${t},${a},${b},${arc}`, () => new THREE.TorusGeometry(r, t, a, b, arc)),
  capsule: (r = 1, l = 1) => cached(`cap${r},${l}`, () => new THREE.CapsuleGeometry(r, l, 4, 10)),
};

/** Tạo mesh nhanh: mesh(parent, geo, mat|color, {p, r, s, shadow}) */
export function mesh(parent, geo, mat, o = {}) {
  const m = new THREE.Mesh(geo, typeof mat === 'number' ? toon(mat) : mat);
  if (o.p) m.position.set(o.p[0], o.p[1], o.p[2]);
  if (o.r) m.rotation.set(o.r[0], o.r[1], o.r[2]);
  if (o.s !== undefined) {
    if (typeof o.s === 'number') m.scale.setScalar(o.s);
    else m.scale.set(o.s[0], o.s[1], o.s[2]);
  }
  m.castShadow = o.cast !== false;
  m.receiveShadow = o.receive !== false;
  if (parent) parent.add(m);
  return m;
}

export function group(parent, o = {}) {
  const g = new THREE.Group();
  if (o.p) g.position.set(o.p[0], o.p[1], o.p[2]);
  if (o.r) g.rotation.set(o.r[0], o.r[1], o.r[2]);
  if (o.s !== undefined) {
    if (typeof o.s === 'number') g.scale.setScalar(o.s);
    else g.scale.set(o.s[0], o.s[1], o.s[2]);
  }
  if (parent) parent.add(g);
  return g;
}

// Số ngẫu nhiên có seed để cảnh vật cố định giữa các lần tải
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Toạ độ bàn cờ -> thế giới. Người chơi 0 (hàng 0) ở phía +z gần camera.
export const TILE_Y = 0.07;
export const WATER_Y = -0.2;
export const cellX = (c) => c - 3;
export const cellZ = (r) => 4 - r;

/**
 * Gộp các mesh tĩnh theo vật liệu để giảm số draw call.
 * Node có userData.dyn = true là node chuyển động: mesh con được gộp bên trong nó.
 */
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const inv = new THREE.Matrix4(), rel = new THREE.Matrix4();
  root.traverse((o) => {
    if (!o.isMesh || o.userData.dyn) return;
    const mat = o.material;
    if (!(mat.isMeshToonMaterial || mat.isMeshBasicMaterial) || mat.visible === false) return;
    let a = o.parent;
    while (a !== root && !a.userData.dyn) a = a.parent;
    const key = a.uuid + mat.uuid + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0) + o.renderOrder;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { anchor: a, mat, cast: o.castShadow, receive: o.receiveShadow, order: o.renderOrder, items: [] }));
    b.items.push(o);
  });
  for (const b of buckets.values()) {
    if (b.items.length < 2) continue;
    inv.copy(b.anchor.matrixWorld).invert();
    const geos = b.items.map((o) => {
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal' && n !== 'uv') g.deleteAttribute(n);
      g.applyMatrix4(rel.multiplyMatrices(inv, o.matrixWorld));
      return g;
    });
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    for (const o of b.items) o.parent.remove(o);
    const m = new THREE.Mesh(merged, b.mat);
    m.castShadow = b.cast; m.receiveShadow = b.receive; m.renderOrder = b.order;
    m.userData.merged = true;
    b.anchor.add(m);
  }
}
