import * as THREE from 'three';
import { RAT, CAT, DOG, WOLF, LEOPARD, TIGER, LION, ELEPHANT, ANIMALS } from '../rules.js';
import { toon, G, mesh, group, gradientMap, mergeStatic } from './helpers.js';
import { TEAM } from './biomes.js';

const STEEL = 0xe6edf5, STEEL_D = 0xaab6c6, GOLD = 0xffcc4d, WOOD = 0x9a6a3c, DARK = 0x2a2233, PINK = 0xff9eb5, WHITE = 0xfffaf0;

// ---------- Hoạ tiết lông (vằn hổ, đốm báo) ----------
const texCache = {};
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
/** Màu sẫm hơn (k < 1) của một màu */
const shade = (c, k) => new THREE.Color(c).multiplyScalar(k).getHex();
function furTex(kind, base, spot, spot2) {
  const key = [kind, base, spot, spot2].join();
  if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  if (kind === 'tiger') {
    x.fillStyle = hex(base); x.fillRect(0, 0, 256, 128);
    x.fillStyle = hex(spot);
    // vằn toả từ đỉnh đầu
    for (let i = 0; i < 12; i++) {
      const u = (i / 12) * 256 + 6;
      const len = i % 2 ? 44 : 30;
      x.beginPath(); x.moveTo(u - 7, 0); x.lineTo(u + 7, 0); x.lineTo(u + (i % 3 - 1) * 3, len); x.fill();
    }
    // vằn ngang hai bên má và sau gáy (mặt ở u = 0.25)
    for (const cx of [0, 128, 256, 176, 208]) for (let j = 0; j < 3; j++) {
      const y = 56 + j * 20;
      x.beginPath(); x.moveTo(cx - 20, y - 5); x.lineTo(cx + 20, y); x.lineTo(cx - 20, y + 5); x.fill();
      x.beginPath(); x.moveTo(cx + 22, y + 5); x.lineTo(cx - 16, y + 10); x.lineTo(cx + 22, y + 15); x.fill();
    }
  } else if (kind === 'leopard') {
    x.fillStyle = hex(base); x.fillRect(0, 0, 256, 128);
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
      const px = rnd() * 256, py = rnd() * 110 + 4;
      if (px > 34 && px < 94 && py > 44 && py < 104) continue; // chừa khuôn mặt
      const r = 4 + rnd() * 3.5;
      x.fillStyle = hex(spot); x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
      x.fillStyle = hex(spot2); x.beginPath(); x.arc(px + 0.6, py + 0.4, r * 0.48, 0, 7); x.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  texCache[key] = t;
  return t;
}
const furMatCache = {};
function furMat(kind, base, spot, spot2) {
  return (furMatCache[[kind, base, spot, spot2].join()] ??= new THREE.MeshToonMaterial({ map: furTex(kind, base, spot, spot2), gradientMap }));
}

function tube(parent, pts, radius, color) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, radius, 7), toon(color));
  m.castShadow = true;
  parent.add(m);
  // bo tròn đầu mút
  const e = pts[pts.length - 1];
  mesh(parent, G.sphere(radius, 8, 6), color, { p: e });
  return m;
}

// ---------- Vũ khí (gốc toạ độ = chỗ cầm, trục Y hướng lên) ----------
const halfDisc = new THREE.CylinderGeometry(0.15, 0.15, 0.024, 14, 1, false, 0, Math.PI);

function weaponFor(rank, team) {
  const w = new THREE.Group();
  const T = TEAM[team];
  switch (rank) {
    case RAT: // dao găm
      mesh(w, G.cyl(0.018, 0.018, 0.09, 6), WOOD, { p: [0, 0, 0] });
      mesh(w, G.box(0.1, 0.02, 0.035), GOLD, { p: [0, 0.05, 0] });
      mesh(w, G.cone(0.035, 0.26, 4), STEEL, { p: [0, 0.19, 0], s: [1, 1, 0.35] });
      break;
    case DOG: // kiếm ngắn
      mesh(w, G.cyl(0.02, 0.02, 0.1, 6), WOOD);
      mesh(w, G.sphere(0.028, 6, 5), GOLD, { p: [0, -0.06, 0] });
      mesh(w, G.box(0.14, 0.025, 0.04), GOLD, { p: [0, 0.06, 0] });
      mesh(w, G.box(0.055, 0.34, 0.016), STEEL, { p: [0, 0.24, 0] });
      mesh(w, G.cone(0.039, 0.08, 4), STEEL, { p: [0, 0.45, 0], s: [1, 1, 0.3], r: [0, Math.PI / 4, 0] });
      break;
    case WOLF: { // rìu chiến hai lưỡi
      mesh(w, G.cyl(0.02, 0.022, 0.7, 6), WOOD, { p: [0, 0.2, 0] });
      mesh(w, halfDisc, STEEL, { p: [0.02, 0.44, 0], r: [Math.PI / 2, 0, 0] });
      mesh(w, halfDisc, STEEL_D, { p: [-0.02, 0.44, 0], r: [Math.PI / 2, 0, Math.PI] });
      mesh(w, G.box(0.07, 0.1, 0.05), T.dark, { p: [0, 0.44, 0] });
      mesh(w, G.cone(0.025, 0.08, 6), GOLD, { p: [0, 0.59, 0] });
      break;
    }
    case LEOPARD: // giáo dài
      mesh(w, G.cyl(0.016, 0.016, 1.0, 6), WOOD, { p: [0, 0.25, 0] });
      mesh(w, G.cone(0.05, 0.18, 4), STEEL, { p: [0, 0.84, 0], s: [1, 1, 0.4] });
      mesh(w, G.sphere(0.035, 8, 6), T.main, { p: [0, 0.73, 0] });
      mesh(w, G.cone(0.03, 0.1, 6), T.light, { p: [0, 0.67, 0], r: [Math.PI, 0, 0] });
      break;
    case TIGER: // đại kiếm
      mesh(w, G.cyl(0.024, 0.024, 0.16, 6), DARK);
      mesh(w, G.sphere(0.035, 6, 5), GOLD, { p: [0, -0.09, 0] });
      mesh(w, G.box(0.24, 0.035, 0.05), GOLD, { p: [0, 0.09, 0] });
      mesh(w, G.box(0.11, 0.58, 0.02), STEEL, { p: [0, 0.4, 0] });
      mesh(w, G.box(0.03, 0.5, 0.026), STEEL_D, { p: [0, 0.38, 0] });
      mesh(w, G.cone(0.078, 0.14, 4), STEEL, { p: [0, 0.76, 0], s: [1, 1, 0.26], r: [0, Math.PI / 4, 0] });
      break;
    case LION: // đinh ba hoàng gia
      mesh(w, G.cyl(0.02, 0.02, 0.95, 6), GOLD, { p: [0, 0.22, 0] });
      mesh(w, G.box(0.26, 0.03, 0.035), GOLD, { p: [0, 0.7, 0] });
      mesh(w, G.cone(0.03, 0.26, 6), STEEL, { p: [0, 0.84, 0] });
      for (const sx of [-0.12, 0.12]) mesh(w, G.cone(0.025, 0.18, 6), STEEL, { p: [sx, 0.8, 0] });
      mesh(w, G.sphere(0.04, 8, 6), T.main, { p: [0, 0.66, 0] });
      break;
    case ELEPHANT: // búa tạ
      mesh(w, G.cyl(0.03, 0.034, 0.75, 8), WOOD, { p: [0, 0.2, 0] });
      mesh(w, G.box(0.38, 0.22, 0.22), 0x8f96a8, { p: [0, 0.6, 0] });
      for (const sx of [-0.2, 0.2]) mesh(w, G.box(0.03, 0.25, 0.25), GOLD, { p: [sx, 0.6, 0] });
      mesh(w, G.box(0.1, 0.24, 0.24), T.main, { p: [0, 0.6, 0] });
      break;
  }
  return w;
}

function claws(parent, x) {
  for (const dx of [-0.035, 0, 0.035]) mesh(parent, G.cone(0.014, 0.2, 5), STEEL, { p: [x + dx, 0, 0.12], r: [Math.PI / 2, 0, 0] });
  mesh(parent, G.box(0.11, 0.05, 0.06), DARK, { p: [x, 0, 0.02] });
}

// Màu lông lấy theo biome của phe (TEAM[team].fur), ở đây chỉ có tỉ lệ và loại hoạ tiết
const SPEC = {
  [RAT]: { scale: 0.74 }, [CAT]: { scale: 0.8 }, [DOG]: { scale: 0.86 }, [WOLF]: { scale: 0.92 },
  [LEOPARD]: { scale: 0.95, tex: 'leopard' }, [TIGER]: { scale: 1.02, tex: 'tiger' },
  [LION]: { scale: 1.08 }, [ELEPHANT]: { scale: 1.16 },
};

function badgeSprite(rank, team) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.beginPath(); x.arc(64, 64, 56, 0, 7);
  x.fillStyle = TEAM[team].badge; x.fill();
  x.lineWidth = 8; x.strokeStyle = '#ffffff'; x.stroke();
  x.fillStyle = '#ffffff';
  x.font = '900 78px "Baloo 2", "Segoe UI", Arial, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 6; x.shadowOffsetY = 3;
  x.fillText(String(rank), 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.setScalar(0.3);
  s.renderOrder = 10;
  return s;
}

/** Dựng một quân thú. Mặt quay về +z (cục bộ). */
export function buildAnimal(rank, team) {
  const T = TEAM[team];
  const [furC, bellyC, ex1, ex2] = T.fur[rank];
  const sp = { ...SPEC[rank], fur: furC, belly: bellyC };
  const outer = new THREE.Group();
  const model = group(outer, { s: sp.scale });
  const fur = sp.tex ? furMat(sp.tex, furC, ex1, ex2 ?? ex1) : toon(sp.fur);
  const F = sp.fur;
  const big = rank === ELEPHANT;

  // bệ đứng
  mesh(outer, G.cyl(0.37, 0.4, 0.05, 24), T.dark, { p: [0, 0.025, 0] });
  mesh(outer, G.cyl(0.33, 0.37, 0.04, 24), T.main, { p: [0, 0.065, 0] });
  model.position.y = 0.075;

  const bob = group(model); // phần nhún nhảy
  // chân
  for (const sx of [-0.1, 0.1]) {
    mesh(bob, G.cyl(0.06, 0.065, 0.14, 8), F, { p: [sx, 0.1, 0] });
    mesh(bob, G.sphere(1, 10, 8), big ? F : sp.belly, { p: [sx, 0.04, 0.03], s: [0.085, 0.05, 0.11] });
  }
  // thân = giáp màu đội
  const bw = big ? 1.2 : 1;
  mesh(bob, G.sphere(0.21, 16, 12), T.main, { p: [0, 0.36, 0], s: [bw, 1.08, 0.92 * bw] });
  mesh(bob, G.sphere(0.17, 14, 10), T.light, { p: [0, 0.38, 0.105 * bw], s: [0.72 * bw, 0.78, 0.72] });
  mesh(bob, G.torus(0.19 * bw, 0.028, 6, 20), GOLD, { p: [0, 0.24, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.92, 1] });
  mesh(bob, G.cyl(0.045, 0.045, 0.02, 6), T.dark, { p: [0, 0.245, 0.2 * bw], r: [Math.PI / 2, 0, 0] });
  // áo choàng sau lưng
  mesh(bob, G.box(0.3 * bw, 0.34, 0.02), T.dark, { p: [0, 0.33, -0.2 * bw], r: [-0.22, 0, 0] });
  mesh(bob, G.box(0.2 * bw, 0.26, 0.022), T.main, { p: [0, 0.34, -0.205 * bw], r: [-0.22, 0, 0] });
  // giáp vai
  for (const sx of [-1, 1]) {
    mesh(bob, G.sphere(0.085, 10, 8), T.dark, { p: [sx * 0.21 * bw, 0.5, 0], s: [1.1, 0.75, 1.1] });
    if (T.orn.kind === 'spike') mesh(bob, G.cone(0.03, 0.1, 6), T.orn.color, { p: [sx * 0.235 * bw, 0.57, 0], r: [0, 0, -sx * 0.5] });
    else mesh(bob, G.sphere(1, 8, 6), T.orn.color, { p: [sx * 0.25 * bw, 0.56, 0], s: [0.07, 0.025, 0.045], r: [0, 0, sx * 0.7] });
  }
  // tay trái
  const armL = group(bob, { p: [-0.23 * bw, 0.47, 0] });
  mesh(armL, G.capsule(0.05, 0.1), F, { p: [-0.03, -0.09, 0.03], r: [0.3, 0, -0.3] });
  mesh(armL, G.sphere(0.058, 8, 6), big ? F : sp.belly, { p: [-0.06, -0.18, 0.06] });
  // tay phải cầm vũ khí
  const armR = group(bob, { p: [0.23 * bw, 0.47, 0] });
  mesh(armR, G.capsule(0.05, 0.1), F, { p: [0.03, -0.08, 0.05], r: [0.7, 0, 0.3] });
  mesh(armR, G.sphere(0.058, 8, 6), big ? F : sp.belly, { p: [0.06, -0.15, 0.12] });
  const hand = group(armR, { p: [0.06, -0.15, 0.12] });
  if (rank === CAT) {
    claws(hand, 0);
    claws(group(armL, { p: [-0.06, -0.18, 0.06] }), 0);
  } else {
    const wp = weaponFor(rank, team);
    wp.rotation.set(0.12, 0, -0.14);
    hand.add(wp);
  }
  if (rank === DOG) {
    // khiên tròn tay trái
    const sh = group(armL, { p: [-0.1, -0.14, 0.1], r: [Math.PI / 2, 0, 0.35] });
    mesh(sh, G.cyl(0.17, 0.17, 0.03, 18), T.main);
    mesh(sh, G.torus(0.165, 0.022, 6, 20), GOLD, { r: [Math.PI / 2, 0, 0] });
    mesh(sh, G.sphere(0.05, 8, 6), GOLD, { p: [0, 0.02, 0] });
  }

  // ----- đầu -----
  const head = group(bob, { p: [0, 0.7, 0.01] });
  const hs = big ? 1.12 : 1;
  mesh(head, G.sphere(0.215, 20, 14), fur, { s: [hs * 1.04, hs * 0.96, hs] });
  // mắt + mày dữ dằn
  for (const sx of [-1, 1]) {
    const ex = sx * 0.088 * hs, ey = 0.035, ez = 0.18 * hs;
    mesh(head, G.sphere(0.04, 10, 8), WHITE, { p: [ex, ey, ez], s: [1, 1.2, 0.6], cast: false });
    mesh(head, G.sphere(0.028, 10, 8), DARK, { p: [ex, ey - 0.003, ez + 0.014], s: [1, 1.25, 0.6], cast: false });
    mesh(head, G.sphere(0.01, 6, 5), 0xffffff, { p: [ex + 0.01, ey + 0.016, ez + 0.03], cast: false });
    mesh(head, G.box(0.085, 0.022, 0.03), DARK, { p: [ex, ey + 0.062, ez + 0.012], r: [0, 0, -sx * 0.42], cast: false });
  }
  // băng đầu màu đội
  if (rank !== LION) {
    mesh(head, G.torus(0.205 * hs, 0.022, 6, 24), T.main, { p: [0, 0.105, 0], r: [Math.PI / 2 - 0.12, 0, 0], s: [1.04, 1, 1] });
    for (const dz of [-0.03, 0.03]) mesh(head, G.box(0.04, 0.14, 0.012), T.main, { p: [dz, 0.03, -0.215 * hs], r: [0.35, 0, dz * 8] });
  }

  switch (rank) {
    case RAT: {
      for (const sx of [-1, 1]) {
        mesh(head, G.sphere(1, 12, 8), F, { p: [sx * 0.17, 0.19, -0.03], s: [0.115, 0.115, 0.03] });
        mesh(head, G.sphere(1, 12, 8), PINK, { p: [sx * 0.17, 0.19, -0.012], s: [0.08, 0.08, 0.02], cast: false });
      }
      mesh(head, G.cone(0.1, 0.2, 10), sp.belly, { p: [0, -0.04, 0.23], r: [Math.PI / 2, 0, 0] });
      mesh(head, G.sphere(0.03, 8, 6), PINK, { p: [0, -0.04, 0.33] });
      mesh(head, G.box(0.045, 0.045, 0.012), WHITE, { p: [0, -0.1, 0.25], cast: false });
      for (const sx of [-1, 1]) for (const a of [-0.2, 0.2]) mesh(head, G.cyl(0.004, 0.004, 0.16, 4), DARK, { p: [sx * 0.11, -0.05 + a * 0.1, 0.26], r: [0, 0, Math.PI / 2 + sx * a], cast: false });
      tube(bob, [[0, 0.22, -0.18], [0.05, 0.12, -0.34], [0.18, 0.1, -0.42], [0.26, 0.2, -0.36], [0.24, 0.3, -0.3]], 0.018, PINK);
      break;
    }
    case CAT: {
      for (const sx of [-1, 1]) {
        mesh(head, G.cone(0.075, 0.15, 4), F, { p: [sx * 0.125, 0.22, 0], r: [0, Math.PI / 4, -sx * 0.25] });
        mesh(head, G.cone(0.042, 0.09, 4), PINK, { p: [sx * 0.125, 0.21, 0.022], r: [0, Math.PI / 4, -sx * 0.25], cast: false });
      }
      mesh(head, G.sphere(0.085, 12, 8), sp.belly, { p: [0, -0.05, 0.17], s: [1.25, 0.72, 0.8] });
      mesh(head, G.sphere(0.022, 8, 6), PINK, { p: [0, -0.025, 0.245] });
      for (const sx of [-1, 1]) for (const a of [-0.18, 0.18]) mesh(head, G.cyl(0.004, 0.004, 0.2, 4), WHITE, { p: [sx * 0.17, -0.05 + a * 0.12, 0.17], r: [0, 0, Math.PI / 2 + sx * a], cast: false });
      // vằn trán
      for (const dx of [-0.05, 0, 0.05]) mesh(head, G.box(0.02, 0.07, 0.02), shade(F, 0.78), { p: [dx, 0.17, 0.12 - Math.abs(dx) * 0.4], r: [-0.6, 0, 0], cast: false });
      tube(bob, [[0, 0.22, -0.18], [0, 0.2, -0.34], [0.04, 0.36, -0.42], [0.1, 0.52, -0.36], [0.08, 0.6, -0.28]], 0.035, F);
      break;
    }
    case DOG: {
      const earC = shade(F, 0.62);
      for (const sx of [-1, 1]) mesh(head, G.sphere(1, 10, 8), earC, { p: [sx * 0.21, 0.06, -0.01], s: [0.06, 0.15, 0.085], r: [0, 0, sx * 0.25] });
      mesh(head, G.sphere(1, 10, 8), earC, { p: [0.09, 0.05, 0.155], s: [0.085, 0.09, 0.05], cast: false });
      mesh(head, G.sphere(0.1, 12, 8), sp.belly, { p: [0, -0.06, 0.17], s: [1.15, 0.8, 1.0] });
      mesh(head, G.sphere(0.035, 8, 6), DARK, { p: [0, -0.025, 0.27], s: [1.2, 0.85, 1] });
      mesh(head, G.box(0.05, 0.06, 0.015), 0xff7a90, { p: [0, -0.125, 0.235], r: [0.3, 0, 0], cast: false });
      mesh(bob, G.cone(0.045, 0.2, 6), F, { p: [0, 0.33, -0.25], r: [-0.9, 0, 0] });
      break;
    }
    case WOLF: {
      for (const sx of [-1, 1]) {
        mesh(head, G.cone(0.07, 0.2, 4), F, { p: [sx * 0.12, 0.25, -0.01], r: [0, Math.PI / 4, -sx * 0.15] });
        mesh(head, G.cone(0.038, 0.12, 4), DARK, { p: [sx * 0.12, 0.235, 0.015], r: [0, Math.PI / 4, -sx * 0.15], cast: false });
        mesh(head, G.cone(0.07, 0.16, 5), sp.belly, { p: [sx * 0.2, -0.06, 0.04], r: [0, 0, -sx * 2.0] });
      }
      mesh(head, G.sphere(0.09, 12, 8), sp.belly, { p: [0, -0.055, 0.2], s: [1.0, 0.78, 1.5] });
      mesh(head, G.sphere(0.032, 8, 6), DARK, { p: [0, -0.02, 0.335] });
      for (const sx of [-1, 1]) mesh(head, G.cone(0.012, 0.045, 4), WHITE, { p: [sx * 0.045, -0.115, 0.27], r: [Math.PI, 0, 0], cast: false });
      mesh(bob, G.sphere(1, 10, 8), F, { p: [0, 0.3, -0.33], s: [0.09, 0.09, 0.2], r: [0.5, 0, 0] });
      mesh(bob, G.sphere(1, 10, 8), sp.belly, { p: [0, 0.37, -0.46], s: [0.06, 0.06, 0.09], r: [0.5, 0, 0] });
      break;
    }
    case LEOPARD:
    case TIGER: {
      const tig = rank === TIGER;
      for (const sx of [-1, 1]) {
        mesh(head, G.sphere(0.07, 10, 8), F, { p: [sx * 0.15, 0.17, -0.01], s: [1, 1, 0.5] });
        mesh(head, G.sphere(0.04, 8, 6), tig ? WHITE : ex1, { p: [sx * 0.15, 0.17, 0.012], s: [1, 1, 0.5], cast: false });
        if (tig) mesh(head, G.sphere(0.075, 10, 8), WHITE, { p: [sx * 0.15, -0.07, 0.1], s: [1.1, 0.8, 0.8] });
      }
      mesh(head, G.sphere(0.09, 12, 8), sp.belly, { p: [0, -0.055, 0.17], s: [1.2, 0.75, 0.9] });
      mesh(head, G.sphere(0.028, 8, 6), tig ? PINK : DARK, { p: [0, -0.025, 0.255], s: [1.3, 0.8, 1] });
      if (tig) for (const sx of [-1, 1]) mesh(head, G.cone(0.014, 0.05, 4), WHITE, { p: [sx * 0.04, -0.115, 0.22], r: [Math.PI, 0, 0], cast: false });
      const tail = tube(bob, [[0, 0.22, -0.18], [0, 0.16, -0.36], [-0.06, 0.28, -0.48], [-0.12, 0.46, -0.44], [-0.1, 0.56, -0.36]], 0.032, F);
      tail.material = fur;
      mesh(bob, G.sphere(0.04, 8, 6), ex1, { p: [-0.1, 0.56, -0.36] });
      break;
    }
    case LION: {
      const MANE = ex1, MANE2 = ex2;
      mesh(head, G.sphere(0.27, 14, 10), MANE, { p: [0, 0, -0.07], s: [1.1, 1.08, 0.7] });
      for (let k = 0; k < 11; k++) {
        const a = (k / 11) * Math.PI * 2;
        mesh(head, G.cone(0.085, 0.2, 6), k % 2 ? MANE : MANE2, { p: [Math.cos(a) * 0.25, Math.sin(a) * 0.24, -0.02], r: [0, 0, a - Math.PI / 2] });
      }
      for (const sx of [-1, 1]) mesh(head, G.sphere(0.06, 10, 8), F, { p: [sx * 0.15, 0.17, 0.03], s: [1, 1, 0.5] });
      mesh(head, G.sphere(0.095, 12, 8), sp.belly, { p: [0, -0.055, 0.17], s: [1.2, 0.78, 0.9] });
      mesh(head, G.sphere(0.032, 8, 6), 0x7a4b2a, { p: [0, -0.02, 0.255], s: [1.3, 0.8, 1] });
      mesh(head, G.cone(0.05, 0.1, 6), MANE, { p: [0, -0.17, 0.17], r: [Math.PI, 0, 0] });
      // vương miện
      mesh(head, G.cyl(0.105, 0.09, 0.07, 10), GOLD, { p: [0, 0.225, 0.02] });
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + Math.PI / 2;
        mesh(head, G.cone(0.03, 0.08, 4), GOLD, { p: [Math.cos(a) * 0.09, 0.29, 0.02 + Math.sin(a) * 0.09] });
      }
      mesh(head, G.sphere(0.025, 8, 6), T.main, { p: [0, 0.225, 0.115] });
      tube(bob, [[0, 0.22, -0.18], [0, 0.14, -0.36], [0.08, 0.22, -0.5], [0.14, 0.4, -0.5]], 0.025, F);
      mesh(bob, G.sphere(0.06, 8, 6), MANE, { p: [0.14, 0.42, -0.5], s: [1, 1.3, 1] });
      break;
    }
    case ELEPHANT: {
      for (const sx of [-1, 1]) {
        mesh(head, G.sphere(1, 14, 10), F, { p: [sx * 0.31, 0.03, -0.04], s: [0.2, 0.25, 0.04], r: [0, -sx * 0.45, sx * 0.1] });
        mesh(head, G.sphere(1, 14, 10), 0xf5b8c8, { p: [sx * 0.31, 0.02, -0.018], s: [0.14, 0.18, 0.03], r: [0, -sx * 0.45, sx * 0.1], cast: false });
        mesh(head, G.cone(0.032, 0.2, 8), WHITE, { p: [sx * 0.1, -0.13, 0.24], r: [2.1, 0, sx * 0.25] });
      }
      tube(bob, [[0, 0.68, 0.2], [0, 0.58, 0.33], [0, 0.45, 0.37], [0, 0.36, 0.47], [0, 0.44, 0.56]], 0.056, F);
      mesh(bob, G.sphere(0.04, 8, 6), 0xf5b8c8, { p: [0, 0.455, 0.575], cast: false });
      // mũ giáp trán
      mesh(head, G.sphere(0.12, 10, 8), T.dark, { p: [0, 0.16, 0.12], s: [1.1, 0.5, 0.8] });
      mesh(head, G.sphere(0.035, 8, 6), GOLD, { p: [0, 0.19, 0.2] });
      mesh(bob, G.cyl(0.012, 0.012, 0.16, 5), F, { p: [0, 0.26, -0.28], r: [0.6, 0, 0] });
      break;
    }
  }

  // huy hiệu cấp bậc
  const badge = badgeSprite(rank, team);
  badge.position.y = 0.075 + (rank === LION ? 1.14 : rank === LEOPARD ? 1.0 : 1.02) * sp.scale + 0.2;
  outer.add(badge);

  // vùng bắt chuột (ẩn)
  const hit = new THREE.Mesh(G.cyl(0.38, 0.4, 1.0 * sp.scale + 0.1, 10), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = (1.0 * sp.scale + 0.1) / 2;
  outer.add(hit);

  hit.userData.dyn = true;
  for (const o of [model, bob, head, armR]) o.userData.dyn = true;
  mergeStatic(outer, { looseShadow: true });
  outer.userData = { rank, team, model, bob, head, armR, hit, badge, phase: Math.random() * 6.28, name: ANIMALS[rank].name };
  return outer;
}
