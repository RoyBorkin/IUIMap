// ─────────────────────────────────────────────────────────────
//  מודלים תלת־ממדיים מייצגים לכל עצם, לפי התמונות מהצלילה.
//  יחידות: מטרים. מערכת צירים מקומית: x = מזרח, y = למעלה, z = דרום.
//  כל מודל נבנה כ"מקט" אחד; במצב מפה הוא נצבע בגוון חימר אחיד,
//  ובמצב הדמיה מקבל את הצבעים האמיתיים.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* shared material registry so the whole scene can switch between clay and real colors */
export class Kit {
  constructor() {
    this.mats = new Map();
    this.instanced = [];
    this.mode = 'chart';
    this.clay = new THREE.Color('#E6EBE8');
  }
  mat(hex) {
    if (!this.mats.has(hex)) {
      const m = new THREE.MeshLambertMaterial({ color: this.clay.clone() });
      m.userData.real = new THREE.Color(hex);
      this.mats.set(hex, m);
    }
    return this.mats.get(hex);
  }
  setMode(mode, clayColor) {
    this.mode = mode;
    if (clayColor) this.clay.copy(clayColor);
    // underwater the light loses its reds first, so real colors get a slight blue-green cast
    const tint = new THREE.Color(0.82, 0.93, 1.0);
    this.mats.forEach((m) => (mode === 'sim' ? m.color.copy(m.userData.real).multiply(tint) : m.color.copy(this.clay)));
    this.instanced.forEach((im) => { im.instanceColor = mode === 'sim' ? im.userData.ic : null; });
  }
}

/* collects many small parts and merges them into one mesh per color */
export class Builder {
  constructor(kit) { this.kit = kit; this.parts = new Map(); this.group = new THREE.Group(); }
  push(geo, hex, matrix) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.deleteAttribute('uv');
    if (matrix) g.applyMatrix4(matrix);
    if (!this.parts.has(hex)) this.parts.set(hex, []);
    this.parts.get(hex).push(g);
  }
  box(w, h, d, hex, pos, rot = [0, 0, 0]) {
    const m = new THREE.Matrix4().compose(V(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), V(1, 1, 1));
    this.push(new THREE.BoxGeometry(w, h, d), hex, m);
  }
  rod(a, b, r, hex, seg = 6) {
    const dir = b.clone().sub(a);
    const len = dir.length();
    if (len < 1e-4) return;
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());
    const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, V(1, 1, 1));
    this.push(new THREE.CylinderGeometry(r, r, len, seg, 1), hex, m);
  }
  geo(geo, hex, pos, rot = [0, 0, 0], scl = [1, 1, 1]) {
    const m = new THREE.Matrix4().compose(V(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), V(...scl));
    this.push(geo, hex, m);
  }
  instances(geo, list, baseHex = '#ffffff') {
    // list: [{p:[x,y,z], s:[sx,sy,sz], r:[rx,ry,rz], c:'#hex'}]
    const im = new THREE.InstancedMesh(geo, this.kit.mat(baseHex), list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    list.forEach((it, i) => {
      q.setFromEuler(e.set(...(it.r || [0, 0, 0])));
      m.compose(V(...it.p), q, V(...it.s));
      im.setMatrixAt(i, m);
      im.setColorAt(i, c.set(it.c || '#ffffff'));
    });
    im.userData.ic = im.instanceColor;
    im.instanceColor = this.kit.mode === 'sim' ? im.userData.ic : null;
    this.kit.instanced.push(im);
    this.group.add(im);
    return im;
  }
  build() {
    this.parts.forEach((geos, hex) => {
      const mesh = new THREE.Mesh(mergeGeometries(geos, false), this.kit.mat(hex));
      this.group.add(mesh);
    });
    this.parts.clear();
    return this.group;
  }
}

/* ── palettes taken from the photos ── */
const RUST = '#6E4A33';
const RUST_DARK = '#4B3426';
const CONCRETE = '#A9A79C';
const CONCRETE_ALGAE = '#8C907C';
const CORALS = ['#9C7A55', '#A8667E', '#7A5476', '#B58A4A', '#A99A55', '#6E7D53', '#8E5B47', '#BDAE8A', '#86709A', '#7D6A50'];
const TABLE_CORAL = '#BE9A6C';

const blob = new THREE.IcosahedronGeometry(1, 1);
const rock = new THREE.IcosahedronGeometry(1, 0);

function coralCarpet(b, r, { x0, x1, z0, z1, y, n, min = 0.07, max = 0.17, palette = CORALS }) {
  const list = [];
  for (let i = 0; i < n; i++) {
    const s = min + r() * (max - min);
    list.push({
      p: [x0 + r() * (x1 - x0), y + s * 0.35, z0 + r() * (z1 - z0)],
      s: [s, s * (0.55 + r() * 0.5), s * (0.8 + r() * 0.4)],
      r: [0, r() * 6, 0],
      c: palette[Math.floor(r() * palette.length)],
    });
  }
  b.instances(blob, list);
}

function tableCoral(b, x, y, z, rad, hex = TABLE_CORAL) {
  b.rod(V(x, y, z), V(x, y + rad * 0.35, z), rad * 0.12, hex);
  b.geo(new THREE.CylinderGeometry(rad, rad * 0.8, rad * 0.12, 18), hex, [x, y + rad * 0.4, z]);
}

/* rectangular steel table: legs + top frame + optional grid */
function steelTable(b, { w, l, h, grid = null, hex = RUST, legInset = 0.02, splay = 0, legDrop = 0.4 }) {
  const t = 0.035;
  const hx = w / 2, hz = l / 2;
  const corners = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
  corners.forEach(([x, z]) => {
    const sx = Math.sign(x) * splay, sz = Math.sign(z) * splay;
    b.rod(V(x * (1 - legInset), h, z * (1 - legInset)), V(x + sx, -legDrop, z + sz), t, hex);
  });
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
    b.rod(V(ax, h, az), V(bx, h, bz), t, hex);
  }
  if (grid) {
    const [gx, gz] = grid;
    for (let i = 1; i < gx; i++) { const x = -hx + (w * i) / gx; b.rod(V(x, h, -hz), V(x, h, hz), t * 0.6, hex); }
    for (let i = 1; i < gz; i++) { const z = -hz + (l * i) / gz; b.rod(V(-hx, h, z), V(hx, h, z), t * 0.6, hex); }
  }
}

/* ═════════════ the models ═════════════ */

// משתלה: שלוש־ארבע קומות שולחנות מדורגים מכוסים בייחורי אלמוגים, עם קשת מסגרת במרכז
function nursery(kit, r) {
  const b = new Builder(kit);
  const W = 7.3, L = 6, H = 1.4;
  const rows = [{ h: 0.55 }, { h: 0.8 }, { h: 1.1 }, { h: 1.4 }];
  const depth = L / rows.length - 0.35;
  rows.forEach((row, i) => {
    const z = -L / 2 + (i + 0.5) * (L / rows.length);
    // long table made of three sections
    for (let s = 0; s < 3; s++) {
      const x0 = -W / 2 + (s * W) / 3 + 0.08, x1 = -W / 2 + ((s + 1) * W) / 3 - 0.08;
      b.box(x1 - x0, 0.05, depth, RUST_DARK, [(x0 + x1) / 2, row.h, z]);
      [[x0, z - depth / 2], [x1, z - depth / 2], [x0, z + depth / 2], [x1, z + depth / 2]].forEach(([x, zz]) => b.rod(V(x, row.h, zz), V(x, -0.4, zz), 0.03, RUST));
    }
    coralCarpet(b, r, { x0: -W / 2 + 0.15, x1: W / 2 - 0.15, z0: z - depth / 2 + 0.1, z1: z + depth / 2 - 0.1, y: row.h + 0.03, n: 150 });
  });
  // central arch frame seen in the photos
  const ax = 0;
  [[-0.7, -L / 2 + 0.3], [0.7, -L / 2 + 0.3], [-0.7, L / 2 - 0.3], [0.7, L / 2 - 0.3]].forEach(([x, z]) => b.rod(V(ax + x, -0.3, z), V(ax + x, H + 0.35, z), 0.04, RUST));
  b.rod(V(-0.7, H + 0.35, -L / 2 + 0.3), V(-0.7, H + 0.35, L / 2 - 0.3), 0.04, RUST);
  b.rod(V(0.7, H + 0.35, -L / 2 + 0.3), V(0.7, H + 0.35, L / 2 - 0.3), 0.04, RUST);
  coralCarpet(b, r, { x0: -0.8, x1: 0.8, z0: -L / 2 + 0.3, z1: L / 2 - 0.3, y: H + 0.36, n: 40 });
  return b.build();
}

// 3 שולחנות רשת ממתכת, 5.5 מ' זה מזה
function tables3(kit, r, spacing = 5.5) {
  const b = new Builder(kit);
  [-spacing, 0, spacing].forEach((dz, i) => {
    const sub = new Builder(kit);
    steelTable(sub, { w: 0.8, l: 1.7, h: 1.2, grid: [4, 9] });
    const g = sub.build();
    g.position.set(0, 0, dz);
    g.rotation.set((r() - 0.5) * 0.08, (r() - 0.5) * 0.3, (r() - 0.5) * 0.08);
    b.group.add(g);
  });
  return b.build();
}

// שולחן ריק: מסגרת קובייה עם לוח רשת בצד ומצוף בפינה
function emptyTable(kit) {
  const b = new Builder(kit);
  const s = 1.5, h = s / 2;
  const c = [[-h, -h], [h, -h], [h, h], [-h, h]];
  c.forEach(([x, z]) => b.rod(V(x, -0.3, z), V(x, s, z), 0.035, RUST));
  [0.15, 0.75, s].forEach((y) => { for (let i = 0; i < 4; i++) b.rod(V(c[i][0], y, c[i][1]), V(c[(i + 1) % 4][0], y, c[(i + 1) % 4][1]), 0.03, RUST); });
  b.rod(V(0, s, -h), V(0, s, h), 0.03, RUST);
  for (let i = 1; i < 10; i++) { const z = -h + (s * i) / 10; b.rod(V(h, 0.15, z), V(h, s, z), 0.008, RUST_DARK); }
  for (let i = 1; i < 12; i++) { const y = 0.15 + ((s - 0.15) * i) / 12; b.rod(V(h, y, -h), V(h, y, h), 0.008, RUST_DARK); }
  b.geo(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 12), '#8F9496', [-h, s + 0.12, -h], [0, 0, Math.PI / 2]);
  return b.build();
}

// שולחן פורח: שולחן נמוך עם רגליים פשוקות, חצי מכוסה באלמוג שולחני גדול והשאר אלמוגים צבעוניים
function flowering(kit, r) {
  const b = new Builder(kit);
  steelTable(b, { w: 0.8, l: 2.4, h: 0.6, splay: 0.15 });
  b.box(0.8, 0.04, 2.4, RUST_DARK, [0, 0.6, 0]);
  tableCoral(b, 0.05, 0.62, -0.55, 0.62);
  tableCoral(b, -0.1, 0.62, -0.05, 0.38, '#B48F62');
  coralCarpet(b, r, { x0: -0.4, x1: 0.4, z0: 0.0, z1: 1.2, y: 0.63, n: 60, min: 0.07, max: 0.16, palette: ['#B0647F', '#8F5583', '#C08A45', '#B9A257', '#9C7552'] });
  return b.build();
}

// בטונדה מד־זרם: בסיס בטון, חצובה שמחזיקה מוט עם חיישן, וקו עגינה למצוף כתום
function currentMeter(kit, r) {
  const b = new Builder(kit);
  b.box(1.0, 0.35, 1.1, CONCRETE, [0, 0.12, 0]);
  const top = V(0.05, 1.3, 0.05);
  [[-0.45, -0.5], [0.45, -0.45], [0.0, 0.5]].forEach(([x, z]) => b.rod(V(x, 0.3, z), top, 0.03, RUST));
  b.rod(V(0.05, 0.3, 0.05), V(0.05, 2.55, 0.05), 0.04, '#7A5638');
  b.geo(new THREE.CylinderGeometry(0.08, 0.08, 0.4, 12), '#C9824A', [0.05, 2.6, 0.05]);
  tableCoral(b, -0.25, 0.3, 0.3, 0.32);
  b.rod(V(-0.4, 0.3, -0.45), V(-1.1, 4.2, -0.9), 0.012, '#D7D2C4');
  b.geo(new THREE.SphereGeometry(0.22, 14, 10), '#D9772E', [-1.1, 4.4, -0.9]);
  return b.build();
}

// זוג בטונדות: שני גושי בטון, אחד גבוה ומוטה, עם שרשראות
function pair(kit, r) {
  const b = new Builder(kit);
  b.box(1.0, 0.5, 0.6, CONCRETE_ALGAE, [-0.62, 0.22, 0], [0, 0.1, 0]);
  b.box(1.15, 1.0, 0.75, CONCRETE, [0.55, 0.45, 0.05], [0.06, -0.15, -0.1]);
  const links = [];
  const chain = (pts) => {
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], c = pts[k + 1];
      const n = Math.ceil(a.distanceTo(c) / 0.09);
      for (let i = 0; i < n; i++) {
        const p = a.clone().lerp(c, i / n);
        links.push({ p: [p.x, p.y, p.z], s: [0.05, 0.05, 0.05], r: [i % 2 ? Math.PI / 2 : 0, r() * 3, 0], c: '#5B4636' });
      }
    }
  };
  chain([V(-1.1, 0.48, 0.1), V(-0.6, 0.5, -0.05), V(-0.1, 0.52, 0.05), V(0.2, 0.98, -0.1), V(0.6, 1.0, 0.1), V(1.05, 0.9, 0.25), V(1.2, 0.2, 0.45), V(1.6, 0.02, 0.6)]);
  b.instances(new THREE.TorusGeometry(1, 0.35, 5, 8), links);
  return b.build();
}

// הביטט: שרידי מבנה מגורים תת־ימי שקרס: מסגרת, צינורות ולוחות נטויים, מכוסה בשונית
function habitat(kit, r) {
  const b = new Builder(kit);
  const W = 7.8, L = 5.2;
  const frame = [[-W / 2, -L / 2], [W / 2, -L / 2], [W / 2, L / 2], [-W / 2, L / 2]];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = frame[i], [bx, bz] = frame[(i + 1) % 4];
    b.rod(V(ax, 0.15, az), V(bx, 0.15, bz), 0.12, RUST_DARK);
  }
  // collapsed slatted panels
  const panels = [
    { x: -1.9, z: -0.3, w: 3.2, l: 3.6, tilt: 0.32, rot: 0.1 },
    { x: 1.6, z: 0.2, w: 3.4, l: 3.8, tilt: -0.22, rot: -0.05 },
  ];
  panels.forEach((p) => {
    const sub = new Builder(kit);
    for (let i = 0; i < 12; i++) {
      const z = -p.l / 2 + (p.l * (i + 0.5)) / 12;
      sub.rod(V(-p.w / 2, 0, z), V(p.w / 2, 0, z), 0.09, i % 3 ? RUST : RUST_DARK);
    }
    sub.rod(V(-p.w / 2, 0, -p.l / 2), V(-p.w / 2, 0, p.l / 2), 0.07, RUST_DARK);
    sub.rod(V(p.w / 2, 0, -p.l / 2), V(p.w / 2, 0, p.l / 2), 0.07, RUST_DARK);
    const g = sub.build();
    g.position.set(p.x, 0.75, p.z);
    g.rotation.set(0, p.rot, p.tilt);
    b.group.add(g);
  });
  [[-3.6, -2.4, 2.0], [3.7, -2.3, 1.4], [3.6, 2.4, 1.1], [-0.2, 2.5, 1.7]].forEach(([x, z, h]) => b.rod(V(x, -0.3, z), V(x + (r() - 0.5) * 0.4, h, z), 0.1, RUST_DARK));
  // reef rubble growing over it
  const list = [];
  for (let i = 0; i < 120; i++) {
    const a = r() * Math.PI * 2, rad = 2.5 + r() * 3.5;
    const s = 0.2 + r() * 0.55;
    list.push({ p: [Math.cos(a) * rad * 1.1, s * 0.2, Math.sin(a) * rad * 0.8], s: [s, s * 0.6, s], r: [0, r() * 6, 0], c: ['#7A7062', '#6C6A5D', '#8A7D69', '#5F6B5B'][i % 4] });
  }
  b.instances(rock, list);
  coralCarpet(b, r, { x0: -W / 2, x1: W / 2, z0: -L / 2, z1: L / 2, y: 0.35, n: 60, min: 0.12, max: 0.3, palette: ['#6F6B55', '#7D6A58', '#5E6A55', '#8A7A62'] });
  return b.build();
}

// פירמידה: פירמידת מוטות עם בסיס משולש, אלמוגים בקודקוד
function pyramid(kit, r) {
  const b = new Builder(kit);
  const s = 1.6, h = 1.0;
  const R = s / Math.sqrt(3);
  const base = [0, 1, 2].map((i) => V(Math.cos((i * 2 * Math.PI) / 3) * R, 0.02, Math.sin((i * 2 * Math.PI) / 3) * R));
  const apex = V(0, h, 0);
  for (let i = 0; i < 3; i++) { b.rod(base[i], base[(i + 1) % 3], 0.025, RUST); b.rod(base[i].clone().setY(-0.3), apex, 0.03, RUST); }
  b.rod(V(0, -0.3, 0), apex, 0.02, RUST_DARK);
  coralCarpet(b, r, { x0: -0.2, x1: 0.2, z0: -0.2, z1: 0.2, y: h - 0.1, n: 14, min: 0.08, max: 0.16, palette: ['#6F6450', '#857658', '#5D6650'] });
  const heads = [];
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, d = 1.4 + r() * 2.2, sz = 0.25 + r() * 0.35;
    heads.push({ p: [Math.cos(a) * d, sz * 0.4, Math.sin(a) * d], s: [sz, sz * 0.8, sz], r: [0, r() * 6, 0], c: ['#6C6857', '#7D725D', '#5E6656'][i % 3] });
  }
  b.instances(blob, heads);
  return b.build();
}

// מודל כללי לשולחן שאין לו תמונות (לפי המידות בלבד)
function genericTable(kit, [w, l, h]) {
  const b = new Builder(kit);
  steelTable(b, { w, l, h, grid: [Math.max(2, Math.round(w / 0.4)), Math.max(2, Math.round(l / 0.4))] });
  return b.build();
}
function concreteCube(kit, [w, l, h]) {
  const b = new Builder(kit);
  b.box(w, h, l, CONCRETE, [0, h / 2 - 0.05, 0]);
  return b.build();
}
function lyingCylinder(kit, [d, l]) {
  const b = new Builder(kit);
  b.geo(new THREE.CylinderGeometry(d / 2, d / 2, l, 16), CONCRETE, [0, d / 2 - 0.05, 0], [0, 0, Math.PI / 2]);
  return b.build();
}

export function buildObject(kit, p) {
  const r = rng(p.id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  switch (p.model) {
    case 'nursery': return nursery(kit, r);
    case 'tables3': return tables3(kit, r, p.spacing);
    case 'empty': return emptyTable(kit);
    case 'flowering': return flowering(kit, r);
    case 'current': return currentMeter(kit, r);
    case 'pair': return pair(kit, r);
    case 'habitat': return habitat(kit, r);
    case 'pyramid': return pyramid(kit, r);
    case 'table': return genericTable(kit, p.dims);
    case 'cube': return concreteCube(kit, p.dims);
    case 'cylinder': return lyingCylinder(kit, p.dims);
    default: return null;
  }
}

/* ═════════════ the pier ═════════════
   built directly in world space: it has to reach from the seabed
   (vertically exaggerated) up to the deck, which sits at true height. */
export function buildPier(kit, { head, bearing, headSize, walkWidth, seaDist, yAt, W }) {
  const b = new Builder(kit);
  const r = rng(99);
  const DECK = 1.3, DECK_T = 0.35;
  // pier-local frame: u runs from the head towards the beach, v runs across it
  const br = (bearing * Math.PI) / 180;
  const ue = Math.sin(br), un = Math.cos(br);
  const ve = un, vn = -ue;
  const at = (u, v) => ({ e: head.e + u * ue + v * ve, n: head.n + u * un + v * vn });
  const P = (u, v, y) => { const q = at(u, v); return W(q.e, q.n, y); };
  // rotation that turns a box's local z axis along the walkway
  const rotY = Math.PI - br;
  const STEEL = '#6A4A35', WHITE = '#E9E7DF', DECKC = '#CFC8B8', TIRE = '#202325';
  const H = headSize / 2, ww = walkWidth / 2;

  // walkway length: from the head edge until 6 m up the beach
  let len = H;
  while (len < 160 && seaDist(at(len, 0).e, at(len, 0).n) > -6) len += 0.5;

  // decks (boxes rotated to the walkway direction)
  const deckBox = (u0, u1, halfW) => {
    const c = at((u0 + u1) / 2, 0);
    b.box(halfW * 2, DECK_T, u1 - u0, DECKC, W(c.e, c.n, DECK - DECK_T / 2).toArray(), [0, rotY, 0]);
  };
  deckBox(-H, H, H);
  deckBox(H, len, ww);

  // lattice piles from the seabed to under the deck
  const pile = (u, v) => {
    const q = at(u, v);
    const yb = Math.min(yAt(q.e, q.n), -0.3);
    const top = DECK - DECK_T;
    if (seaDist(q.e, q.n) < 0.5 || top - yb < 0.6) return;
    const c = 0.28;
    const corners = [[-c, -c], [c, -c], [c, c], [-c, c]];
    corners.forEach(([du, dv]) => b.rod(P(u + du, v + dv, yb - 0.4), P(u + du, v + dv, top), 0.05, STEEL));
    const levels = Math.max(2, Math.round((top - yb) / 1.6));
    for (let k = 0; k < levels; k++) {
      const y0 = yb + ((top - yb) * k) / levels, y1 = yb + ((top - yb) * (k + 1)) / levels;
      for (let i = 0; i < 4; i++) {
        const [au, av] = corners[i], [bu, bv] = corners[(i + 1) % 4];
        b.rod(P(u + au, v + av, y0), P(u + bu, v + bv, y1), 0.025, STEEL);
      }
    }
    // triangular foot struts, as in the underwater photos
    b.rod(P(u, v + c, yb + (top - yb) * 0.45), P(u, v + c + 2.2, yb + 0.1), 0.045, STEEL);
    b.rod(P(u, v + c + 2.2, yb + 0.1), P(u, v + c, yb + 0.1), 0.045, STEEL);
  };
  [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]].forEach(([su, sv]) => pile(su * (H - 0.6), sv * (H - 0.6)));
  for (let u = H + 4; u < len - 2; u += 8) { pile(u, -ww + 0.3); pile(u, ww - 0.3); }

  // pipes lying on the seabed under the head
  for (let i = 0; i < 4; i++) {
    const v0 = -3 + i * 2 + (r() - 0.5);
    const a = at(-6 - r() * 3, v0), c = at(4 + r() * 2, v0 + (r() - 0.5) * 2);
    b.rod(W(a.e, a.n, yAt(a.e, a.n) + 0.12), W(c.e, c.n, yAt(c.e, c.n) + 0.12), 0.12, RUST_DARK);
  }

  // fender tyres on the three sea-facing sides
  const torus = new THREE.TorusGeometry(0.42, 0.16, 8, 16);
  for (let k = -H + 0.9; k <= H - 0.8; k += 1.6) {
    b.geo(torus, TIRE, P(-H - 0.2, k, DECK - 0.75).toArray(), [0, rotY, 0]);
    b.geo(torus, TIRE, P(k, H + 0.2, DECK - 0.75).toArray(), [0, rotY + Math.PI / 2, 0]);
    b.geo(torus, TIRE, P(k, -H - 0.2, DECK - 0.75).toArray(), [0, rotY + Math.PI / 2, 0]);
  }

  // white railing
  const rail = (a, c) => {
    const n = Math.max(1, Math.round(a.distanceTo(c) / 1.5));
    for (let i = 0; i <= n; i++) { const p = a.clone().lerp(c, i / n); b.rod(p, p.clone().add(V(0, 1.0, 0)), 0.03, WHITE); }
    b.rod(a.clone().add(V(0, 1.0, 0)), c.clone().add(V(0, 1.0, 0)), 0.035, WHITE);
    b.rod(a.clone().add(V(0, 0.5, 0)), c.clone().add(V(0, 0.5, 0)), 0.025, WHITE);
  };
  const e = H - 0.1;
  rail(P(-e, -e, DECK), P(-e, e, DECK));
  rail(P(-e, e, DECK), P(e, e, DECK));
  rail(P(-e, -e, DECK), P(e, -e, DECK));
  rail(P(H, ww - 0.1, DECK), P(len - 1, ww - 0.1, DECK));
  rail(P(H, -ww + 0.1, DECK), P(len - 1, -ww + 0.1, DECK));

  // instrument hut and the weather mast
  b.box(2.2, 1.6, 1.6, WHITE, P(1.2, 2.2, DECK + 0.8).toArray(), [0, rotY, 0]);
  const mb = P(-1.5, -1.6, DECK);
  const tri = [0, 1, 2].map((i) => V(Math.cos((i * 2 * Math.PI) / 3) * 0.28, 0, Math.sin((i * 2 * Math.PI) / 3) * 0.28));
  const MH = 10;
  tri.forEach((t) => b.rod(mb.clone().add(t), mb.clone().add(t).add(V(0, MH, 0)), 0.035, WHITE));
  for (let y = 0; y < MH; y += 0.7) for (let i = 0; i < 3; i++) b.rod(mb.clone().add(tri[i]).add(V(0, y, 0)), mb.clone().add(tri[(i + 1) % 3]).add(V(0, y + 0.7, 0)), 0.015, WHITE);
  b.geo(new THREE.CylinderGeometry(0.22, 0.22, 1.6, 12), WHITE, mb.clone().add(V(0.45, 4.2, 0)).toArray());
  b.geo(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 12), '#B8402F', mb.clone().add(V(0.45, 3.2, 0)).toArray());
  b.rod(mb.clone().add(V(-1.0, MH - 1, 0)), mb.clone().add(V(1.0, MH - 1, 0)), 0.03, WHITE);
  b.rod(mb.clone().add(V(0, MH - 2.4, -0.8)), mb.clone().add(V(0, MH - 2.4, 0.8)), 0.03, WHITE);
  b.box(0.3, 0.3, 0.3, '#9EA3A6', mb.clone().add(V(1.0, MH - 1.2, 0)).toArray());
  b.box(0.3, 0.3, 0.3, '#9EA3A6', mb.clone().add(V(-1.0, MH - 1.2, 0)).toArray());
  b.rod(mb.clone().add(V(0, MH, 0)), mb.clone().add(V(0, MH + 0.8, 0)), 0.02, WHITE);
  return b.build();
}

/* ═════════════ scattered seabed: rocks, gravel, rubble, coral heads (simulation only) ═════════════ */
export function buildScatter(kit, { ext, inSea, typeAt, yAt, W }) {
  const b = new Builder(kit);
  const r = rng(4242);
  const rocks = [], heads = [], pebbles = [];
  const tries = 26000;
  for (let i = 0; i < tries; i++) {
    const e = ext.e0 + r() * ext.w, n = ext.n0 + r() * ext.h;
    if (!inSea(e, n)) continue;
    const t = typeAt(e, n); // {gravel, rubble, rocks, reef}
    const y = yAt(e, n);
    const u = r();
    if (u < t.rocks * 0.18) {
      const s = 0.15 + r() * 0.45;
      rocks.push({ p: [e, y + s * 0.15, -n], s: [s, s * (0.45 + r() * 0.35), s * (0.7 + r() * 0.5)], r: [r(), r() * 6, r()], c: ['#6F6A61', '#7B7468', '#5F5C55'][i % 3] });
    } else if (u < t.rocks * 0.18 + t.reef * 0.16) {
      const s = 0.2 + r() * 0.5;
      heads.push({ p: [e, y + s * 0.15, -n], s: [s, s * (0.45 + r() * 0.4), s * (0.8 + r() * 0.4)], r: [0, r() * 6, 0], c: ['#6E6A52', '#75684F', '#7A6170', '#5E6B54', '#7E7152', '#80655A'][i % 6] });
    } else if (u < t.rocks * 0.18 + t.reef * 0.16 + (t.gravel + t.rubble) * 0.1) {
      const s = 0.08 + r() * 0.18;
      pebbles.push({ p: [e, y + s * 0.1, -n], s: [s, s * 0.5, s * 0.8], r: [r(), r() * 6, r()], c: t.rubble > t.gravel ? ['#8E8676', '#9C9280', '#7F7A6E'][i % 3] : ['#7C7A73', '#8D8A82', '#6E6C66'][i % 3] });
    }
  }
  if (rocks.length) b.instances(rock, rocks);
  if (heads.length) b.instances(blob, heads);
  if (pebbles.length) b.instances(rock, pebbles);
  return b.build();
}
