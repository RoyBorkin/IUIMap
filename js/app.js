import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { SITE, POINTS, ROUTE, BRANCHES, DECKS, LIVE_CAMERA_YOUTUBE_ID } from './data.js';

THREE.ColorManagement.enabled = false;

const EX = SITE.verticalExaggeration;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const isPhone = () => window.matchMedia('(max-width: 760px)').matches;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtNum = (n) => (Math.round(n * 10) / 10).toString();
// keep numeric ranges like 7–10 in reading order inside right-to-left text
const num = (v) => `\u2066${v}\u2069`;

/* ═════════════ geo: local metric frame ═════════════ */
const ddm = ([d, m]) => d + m / 60;
const known = POINTS.filter((p) => p.lat);
const lat0 = avg(known.map((p) => ddm(p.lat)));
const lon0 = avg(known.map((p) => ddm(p.lon)));
const M_LAT = 110574;
const M_LON = 111320 * Math.cos(rad(lat0));
const toLocal = (lat, lon) => ({ e: (lon - lon0) * M_LON, n: (lat - lat0) * M_LAT });
const toGeo = (e, n) => ({ lat: lat0 + n / M_LAT, lon: lon0 + e / M_LON });

const byId = Object.fromEntries(POINTS.map((p) => [p.id, p]));
const MAIN = [ROUTE[0].from, ...ROUTE.map((l) => l.to)];

POINTS.forEach((p) => {
  p.depthMid = avg(p.depth);
  p.depthMax = Math.max(...p.depth);
  p.depthText = num(p.depth.length > 1 ? `${p.depth[0]}–${p.depth[1]}` : `${p.depth[0]}`);
  p.station = MAIN.indexOf(p.id) + 1;
  if (p.lat) {
    p.latDec = ddm(p.lat); p.lonDec = ddm(p.lon);
    Object.assign(p, toLocal(p.latDec, p.lonDec));
  }
});
for (let guard = 0; guard < 6; guard++) {
  POINTS.forEach((p) => {
    if (p.e !== undefined || !p.derive) return;
    const f = byId[p.derive.from];
    if (f.e === undefined) return;
    p.e = f.e + Math.sin(rad(p.derive.bearing)) * p.derive.dist;
    p.n = f.n + Math.cos(rad(p.derive.bearing)) * p.derive.dist;
    const g = toGeo(p.e, p.n);
    p.latDec = g.lat; p.lonDec = g.lon;
    p.estimated = true;
  });
}

function ddmText(v, isLat) {
  const a = Math.abs(v);
  let d = Math.floor(a);
  let m = (a - d) * 60;
  if (m >= 59.9995) { d += 1; m = 0; }
  const dd = isLat ? String(d) : String(d).padStart(3, '0');
  return `${isLat ? (v >= 0 ? 'N' : 'S') : (v >= 0 ? 'E' : 'W')} ${dd}°${m.toFixed(3).padStart(6, '0')}′`;
}
const bearingBetween = (a, b) => (deg(Math.atan2(b.e - a.e, b.n - a.n)) + 360) % 360;
const distBetween = (a, b) => Math.hypot(b.e - a.e, b.n - a.n);

/* ═════════════ seabed model ═════════════
   A plane fitted to the measured depths, plus a gaussian-weighted
   correction so the surface passes close to every measured point. */
const seabed = (() => {
  const pts = POINTS.map((p) => [p.e, p.n, p.depthMid]);
  // least squares d = a + b e + c n
  let S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], v = [0, 0, 0];
  pts.forEach(([e, n, d]) => {
    const r = [1, e, n];
    for (let i = 0; i < 3; i++) { v[i] += r[i] * d; for (let j = 0; j < 3; j++) S[i][j] += r[i] * r[j]; }
  });
  const det3 = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det3(S);
  const coef = [0, 1, 2].map((k) => det3(S.map((row, i) => row.map((x, j) => (j === k ? v[i] : x)))) / D);
  const plane = (e, n) => coef[0] + coef[1] * e + coef[2] * n;
  const res = pts.map(([e, n, d]) => [e, n, d - plane(e, n)]);
  const sig2 = 2 * 13 * 13;
  return (e, n) => {
    let ws = 0, wr = 0;
    for (const [pe, pn, r] of res) {
      const w = Math.exp(-((e - pe) ** 2 + (n - pn) ** 2) / sig2);
      ws += w; wr += w * r;
    }
    const noise = 0.22 * Math.sin(e * 0.19 + n * 0.11) + 0.15 * Math.sin(e * 0.07 - n * 0.23 + 1.3) + 0.09 * Math.sin(e * 0.41 + n * 0.37 + 2.1);
    return clamp(plane(e, n) + wr / (ws + 0.06) + noise * (1 - Math.min(1, ws)), 0.6, 13.5);
  };
})();

const yAt = (e, n) => -seabed(e, n) * EX;

/* ═════════════ block extent ═════════════ */
const MARGIN = 38;
const ext = (() => {
  const es = POINTS.map((p) => p.e), ns = POINTS.map((p) => p.n);
  const r10 = (v, f) => f(v / 10) * 10;
  return {
    e0: r10(Math.min(...es) - MARGIN, Math.floor), e1: r10(Math.max(...es) + MARGIN, Math.ceil),
    n0: r10(Math.min(...ns) - MARGIN, Math.floor), n1: r10(Math.max(...ns) + MARGIN, Math.ceil),
  };
})();
ext.w = ext.e1 - ext.e0; ext.h = ext.n1 - ext.n0;
ext.ce = (ext.e0 + ext.e1) / 2; ext.cn = (ext.n0 + ext.n1) / 2;
const BASE_Y = -15 * EX;
// world: x = east, z = -north
const W = (e, n, y) => new THREE.Vector3(e, y, -n);

/* ═════════════ theme colors ═════════════ */
function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const c = (n) => new THREE.Color(cs.getPropertyValue(n).trim());
  return {
    paper: c('--paper'), ink: c('--ink'), ink2: c('--ink-2'), magenta: c('--magenta'), slice: c('--slice'),
    t1: c('--t1'), t2: c('--t2'), t3: c('--t3'), t4: c('--t4'),
    dark: document.documentElement.dataset.theme === 'dark',
  };
}
let T = readTheme();

/* ═════════════ renderer / scene ═════════════ */
const canvas = $('#scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
} catch (err) {
  $('#stage').insertAdjacentHTML('beforeend', '<p class="noscript">הדפדפן לא תומך בתלת־ממד (WebGL). מפת הלוויין והשקופיות עדיין זמינות.</p>');
}
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 4000);
renderer?.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer?.setClearColor(T.paper);
renderer && (renderer.outputColorSpace = THREE.LinearSRGBColorSpace);

const controls = new MapControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.09;
controls.screenSpacePanning = false;
controls.minDistance = 10;
controls.maxDistance = 650;
controls.maxPolarAngle = rad(78);
controls.zoomToCursor = true;

/* ── chart shader ── */
const chartUniforms = () => ({
  uT1: { value: T.t1.clone() }, uT2: { value: T.t2.clone() }, uT3: { value: T.t3.clone() }, uT4: { value: T.t4.clone() },
  uInk: { value: T.ink.clone() }, uSlice: { value: T.slice.clone() },
  uSlices: { value: new THREE.Vector3(1, 1, 1) },
  uEx: { value: EX }, uWall: { value: 0 }, uDark: { value: T.dark ? 1 : 0 },
});
const chartVS = /* glsl */`
  varying float vD; varying vec3 vN;
  uniform float uEx;
  void main(){
    vec4 w = modelMatrix * vec4(position, 1.0);
    vD = -w.y / uEx;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const chartFS = /* glsl */`
  varying float vD; varying vec3 vN;
  uniform vec3 uT1, uT2, uT3, uT4, uInk, uSlice, uSlices;
  uniform float uWall, uDark;
  float iso(float v, float k, float px){
    float fw = max(fwidth(v), 1e-4);
    return 1.0 - smoothstep(px * 0.5, px * 0.5 + 1.0, abs(v - k) / fw);
  }
  void main(){
    float d = vD;
    vec3 col = d < 3.0 ? uT1 : d < 6.0 ? uT2 : d < 9.0 ? uT3 : uT4;
    vec3 L = normalize(vec3(-0.45, 0.82, 0.36));
    float sh = clamp(dot(normalize(vN), L), 0.0, 1.0);
    col *= mix(mix(0.80, 0.62, uDark), 1.03, sh);
    col *= 1.0 - 0.10 * uWall;
    float fw = max(fwidth(d), 1e-4);
    float fine = 1.0 - smoothstep(0.4, 1.4, abs(d - floor(d + 0.5)) / fw);
    col = mix(col, uInk, fine * mix(0.16, 0.22, uDark));
    float s = iso(d, 3.0, 2.2) * uSlices.x + iso(d, 6.0, 2.2) * uSlices.y + iso(d, 9.0, 2.2) * uSlices.z;
    col = mix(col, uSlice, clamp(s, 0.0, 1.0) * 0.95);
    gl_FragColor = vec4(col, 1.0);
  }`;
const bedMat = new THREE.ShaderMaterial({ uniforms: chartUniforms(), vertexShader: chartVS, fragmentShader: chartFS });
const wallMat = new THREE.ShaderMaterial({ uniforms: chartUniforms(), vertexShader: chartVS, fragmentShader: chartFS });
wallMat.uniforms.uWall.value = 1;

/* ── seabed mesh ── */
const SEG = isPhone() ? 130 : 190;
{
  const g = new THREE.PlaneGeometry(ext.w, ext.h, SEG, Math.round((SEG * ext.h) / ext.w));
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const e = pos.getX(i) + ext.ce, n = -pos.getZ(i) + ext.cn;
    pos.setXYZ(i, e, yAt(e, n), -n);
  }
  g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, bedMat));
}

/* ── block walls (the cut faces of the block diagram) ── */
{
  const STEP = 1.5;
  const sides = [
    { from: [ext.e0, ext.n0], to: [ext.e1, ext.n0] },
    { from: [ext.e1, ext.n0], to: [ext.e1, ext.n1] },
    { from: [ext.e1, ext.n1], to: [ext.e0, ext.n1] },
    { from: [ext.e0, ext.n1], to: [ext.e0, ext.n0] },
  ];
  const verts = [];
  sides.forEach(({ from, to }) => {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const k = Math.ceil(len / STEP);
    for (let i = 0; i < k; i++) {
      const a = i / k, b = (i + 1) / k;
      const ea = from[0] + (to[0] - from[0]) * a, na = from[1] + (to[1] - from[1]) * a;
      const eb = from[0] + (to[0] - from[0]) * b, nb = from[1] + (to[1] - from[1]) * b;
      const ta = W(ea, na, yAt(ea, na) - 0.02), tb = W(eb, nb, yAt(eb, nb) - 0.02);
      const ba = W(ea, na, BASE_Y), bb = W(eb, nb, BASE_Y);
      verts.push(...ta.toArray(), ...ba.toArray(), ...tb.toArray(), ...tb.toArray(), ...ba.toArray(), ...bb.toArray());
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.computeVertexNormals();
  wallMat.side = THREE.DoubleSide;
  scene.add(new THREE.Mesh(g, wallMat));
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(ext.w, 0.001, ext.h)),
    new THREE.LineBasicMaterial({ color: T.ink, transparent: true, opacity: 0.55 })
  );
  outline.position.set(ext.ce, BASE_Y, -ext.cn);
  outline.userData.themeColor = 'ink';
  scene.add(outline);
}

/* ── surface neatline with 10 m graduation, and a faint 20 m graticule ── */
const themed = [];
{
  const pts = [];
  const y = 0;
  const tick = (e, n, de, dn, len) => { pts.push(W(e, n, y), W(e + de * len, n + dn * len, y)); };
  pts.push(W(ext.e0, ext.n0, y), W(ext.e1, ext.n0, y), W(ext.e1, ext.n0, y), W(ext.e1, ext.n1, y),
           W(ext.e1, ext.n1, y), W(ext.e0, ext.n1, y), W(ext.e0, ext.n1, y), W(ext.e0, ext.n0, y));
  for (let e = ext.e0; e <= ext.e1; e += 10) {
    const L = (e - ext.e0) % 50 === 0 ? 3.2 : 1.6;
    tick(e, ext.n0, 0, -1, L); tick(e, ext.n1, 0, 1, L);
  }
  for (let n = ext.n0; n <= ext.n1; n += 10) {
    const L = (n - ext.n0) % 50 === 0 ? 3.2 : 1.6;
    tick(ext.e0, n, -1, 0, L); tick(ext.e1, n, 1, 0, L);
  }
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const m = new THREE.LineBasicMaterial({ color: T.ink, transparent: true, opacity: 0.75 });
  const neat = new THREE.LineSegments(g, m);
  neat.userData.themeColor = 'ink';
  scene.add(neat); themed.push(neat);

  const gp = [];
  for (let e = ext.e0 + 20; e < ext.e1; e += 20) gp.push(W(e, ext.n0, 0), W(e, ext.n1, 0));
  for (let n = ext.n0 + 20; n < ext.n1; n += 20) gp.push(W(ext.e0, n, 0), W(ext.e1, n, 0));
  const grid = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gp),
    new THREE.LineBasicMaterial({ color: T.ink, transparent: true, opacity: 0.09, depthWrite: false }));
  grid.userData.themeColor = 'ink';
  scene.add(grid); themed.push(grid);
}

/* ── depth slice planes ── */
const slices = {};
SITE.slices.forEach((d) => {
  const grp = new THREE.Group();
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(ext.w, ext.h).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: T.slice, transparent: true, opacity: T.dark ? 0.13 : 0.1, depthWrite: false, side: THREE.DoubleSide })
  );
  plane.position.set(ext.ce, -d * EX, -ext.cn);
  plane.renderOrder = 2;
  plane.userData.themeColor = 'slice';
  grp.add(plane);
  const rim = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
    W(ext.e0, ext.n0, -d * EX), W(ext.e1, ext.n0, -d * EX), W(ext.e1, ext.n1, -d * EX), W(ext.e0, ext.n1, -d * EX),
  ]), new THREE.LineBasicMaterial({ color: T.slice, transparent: true, opacity: 0.9 }));
  rim.userData.themeColor = 'slice';
  grp.add(rim);
  scene.add(grp);
  slices[d] = { on: true, grp, anchor: W(ext.e0, ext.n0, -d * EX) };
});

/* ── objects as wireframes at true size ── */
const objMat = new THREE.LineBasicMaterial({ color: T.ink, transparent: true, opacity: 0.85 });
POINTS.forEach((p) => {
  const y0 = yAt(p.e, p.n);
  let geo = null, yOff = 0;
  const [w, l, h] = p.dims;
  if (p.shape === 'box' && h) { geo = new THREE.BoxGeometry(w, h * EX, l); yOff = (h * EX) / 2; }
  if (p.shape === 'pyramid') { geo = new THREE.ConeGeometry(p.dims[0] / Math.sqrt(3), h * EX, 3); yOff = (h * EX) / 2; }
  if (p.shape === 'cylinder') { geo = new THREE.CylinderGeometry(w / 2, w / 2, l, 14).rotateZ(Math.PI / 2); yOff = (w / 2) * EX; geo.scale(1, EX, 1); }
  if (!geo) return;
  const wire = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), objMat);
  wire.position.copy(W(p.e, p.n, y0 + yOff));
  scene.add(wire);
});

/* ── X markers + plumb lines ── */
const xMat = new THREE.MeshBasicMaterial({ color: T.magenta, transparent: true, depthTest: false });
const xSelMat = new THREE.MeshBasicMaterial({ color: T.ink, transparent: true, depthTest: false });
const plumbMat = new THREE.LineDashedMaterial({ color: T.ink, dashSize: 0.9, gapSize: 0.9, transparent: true, opacity: 0.38 });
const markers = [];
POINTS.forEach((p) => {
  const ground = W(p.e, p.n, yAt(p.e, p.n));
  p.world = ground;
  const grp = new THREE.Group();
  const bar = new THREE.BoxGeometry(3.4, 0.3, 0.62);
  const a = new THREE.Mesh(bar, xMat); a.rotation.y = Math.PI / 4;
  const b = new THREE.Mesh(bar, xMat); b.rotation.y = -Math.PI / 4;
  grp.add(a, b);
  grp.position.copy(ground).add(new THREE.Vector3(0, 0.45, 0));
  grp.renderOrder = 10; a.renderOrder = 10; b.renderOrder = 10;
  scene.add(grp);
  const pl = new THREE.Line(new THREE.BufferGeometry().setFromPoints([ground.clone().add(new THREE.Vector3(0, 0.5, 0)), new THREE.Vector3(ground.x, 0, ground.z)]), plumbMat);
  pl.computeLineDistances();
  scene.add(pl);
  const buoy = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 24 }, (_, i) => new THREE.Vector3(Math.cos((i / 24) * Math.PI * 2) * 0.9, 0, Math.sin((i / 24) * Math.PI * 2) * 0.9))
  ), plumbMat);
  buoy.position.set(ground.x, 0, ground.z);
  scene.add(buoy);
  markers.push({ p, grp, bars: [a, b], intro: 0 });
});
const selRing = new THREE.LineLoop(
  new THREE.BufferGeometry().setFromPoints(Array.from({ length: 64 }, (_, i) => new THREE.Vector3(Math.cos((i / 64) * Math.PI * 2) * 4, 0, Math.sin((i / 64) * Math.PI * 2) * 4))),
  new THREE.LineDashedMaterial({ color: T.magenta, dashSize: 0.8, gapSize: 0.6, depthTest: false, transparent: true })
);
selRing.computeLineDistances();
selRing.renderOrder = 11;
selRing.visible = false;
scene.add(selRing);

/* ── route: dashed treasure-map trail following the seabed ── */
const lineMats = [];
function trail(a, b, opts) {
  const len = distBetween(a, b);
  const k = Math.max(2, Math.ceil(len / 1.2));
  const arr = [];
  for (let i = 0; i <= k; i++) {
    const t = i / k;
    const e = a.e + (b.e - a.e) * t, n = a.n + (b.n - a.n) * t;
    arr.push(e, yAt(e, n) + 0.55, -n);
  }
  const g = new LineGeometry(); g.setPositions(arr);
  const m = new LineMaterial({ color: opts.color, linewidth: opts.width, dashed: true, dashSize: opts.dash, gapSize: opts.gap, transparent: true, opacity: 0 });
  m.userData = { role: opts.role };
  lineMats.push(m);
  const line = new Line2(g, m); line.computeLineDistances();
  line.renderOrder = 5;
  scene.add(line);
}
ROUTE.forEach((l) => trail(byId[l.from], byId[l.to], { color: T.magenta, width: 2.6, dash: 2.2, gap: 1.3, role: 'main' }));
BRANCHES.forEach((l) => trail(byId[l.from], byId[l.to], { color: T.ink2, width: 1.6, dash: 0.5, gap: 0.9, role: 'branch' }));

/* ═════════════ HTML overlay labels ═════════════ */
const labelLayer = $('#labels');
const labels = POINTS.map((p) => {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'plabel';
  el.innerHTML = `<span class="pname">${esc(p.name)}</span><span class="snd">${p.depthText}${p.live ? ' מ׳, שידור חי' : ''}</span>`;
  el.setAttribute('aria-label', `${p.name}, עומק ${p.depthText} מטר`);
  el.addEventListener('click', () => select(p.id));
  labelLayer.appendChild(el);
  return { p, el, w: 0, h: 0 };
});
const legLabels = [...ROUTE.map((l) => ({ ...l, main: true })), ...BRANCHES.filter((l) => l.bearing !== null)].map((l) => {
  const a = byId[l.from], b = byId[l.to];
  const el = document.createElement('div');
  el.className = 'leg';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<b>${l.bearing}°</b>${l.dist ? `${num(l.dist)} מ׳` : ''}`;
  labelLayer.appendChild(el);
  const me = (a.e + b.e) / 2, mn = (a.n + b.n) / 2;
  return { el, pos: W(me, mn, yAt(me, mn) + 0.6), w: 0, h: 0 };
});
const sliceLabels = SITE.slices.map((d) => {
  const el = document.createElement('div');
  el.className = 'slabel';
  el.setAttribute('aria-hidden', 'true');
  el.textContent = `${d} מ׳`;
  labelLayer.appendChild(el);
  return { d, el };
});
function measureLabels() {
  [...labels, ...legLabels].forEach((l) => {
    const was = l.el.hidden;
    l.el.hidden = false;
    l.w = l.el.offsetWidth; l.h = l.el.offsetHeight;
    l.el.hidden = was;
  });
}

/* ═════════════ sizing / view offset ═════════════ */
let vw = 1, vh = 1;
const viewOff = { x: 0, y: 0, tx: 0, ty: 0 };
function resize() {
  const r = canvas.getBoundingClientRect();
  vw = Math.max(1, r.width); vh = Math.max(1, r.height);
  renderer?.setSize(vw, vh, false);
  camera.aspect = vw / vh;
  applyViewOffset();
  lineMats.forEach((m) => m.resolution.set(vw, vh));
}
function applyViewOffset() {
  if (Math.abs(viewOff.x) < 0.5 && Math.abs(viewOff.y) < 0.5) camera.clearViewOffset();
  else camera.setViewOffset(vw, vh, viewOff.x, viewOff.y, vw, vh);
  camera.updateProjectionMatrix();
}
function panelOffset(open) {
  if (!open) return { x: 0, y: 0 };
  const panel = $('#panel');
  if (isPhone()) return { x: 0, y: Math.min(panel.offsetHeight, vh * 0.74) / 2 };
  return { x: -(panel.offsetWidth + 16) / 2, y: 0 };
}

/* ═════════════ camera framing & flights ═════════════ */
function topView() {
  const fovV = rad(camera.fov);
  const halfW = (Math.max(...POINTS.map((p) => p.e)) - Math.min(...POINTS.map((p) => p.e))) / 2 + (isPhone() ? 44 : 26);
  const halfH = (Math.max(...POINTS.map((p) => p.n)) - Math.min(...POINTS.map((p) => p.n))) / 2 + 26;
  const cE = (Math.max(...POINTS.map((p) => p.e)) + Math.min(...POINTS.map((p) => p.e))) / 2;
  const cN = (Math.max(...POINTS.map((p) => p.n)) + Math.min(...POINTS.map((p) => p.n))) / 2;
  const phone = isPhone();
  const usableH = phone ? 0.62 : 0.86;
  const dist = Math.max(halfH / Math.tan(fovV / 2) / usableH, halfW / (Math.tan(fovV / 2) * camera.aspect) / 0.86);
  const target = new THREE.Vector3(cE, -6 * EX, -cN);
  return { target, pos: target.clone().add(new THREE.Vector3(0, dist, 0.001)) };
}

let flight = null;
function fly(target, pos, ms = 1100) {
  if (reduceMotion) ms = 0;
  flight = {
    t0: performance.now(), ms,
    fromT: controls.target.clone(), toT: target.clone(),
    fromP: camera.position.clone(), toP: pos.clone(),
    fromO: { x: viewOff.x, y: viewOff.y }, toO: { x: viewOff.tx, y: viewOff.ty },
  };
}
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function stepFlight(now) {
  if (!flight) return;
  const t = flight.ms ? clamp((now - flight.t0) / flight.ms, 0, 1) : 1;
  const k = ease(t);
  controls.target.lerpVectors(flight.fromT, flight.toT, k);
  camera.position.lerpVectors(flight.fromP, flight.toP, k);
  viewOff.x = flight.fromO.x + (flight.toO.x - flight.fromO.x) * k;
  viewOff.y = flight.fromO.y + (flight.toO.y - flight.fromO.y) * k;
  applyViewOffset();
  if (t >= 1) flight = null;
}
controls.addEventListener('start', () => {
  if (flight) { viewOff.x = viewOff.tx; viewOff.y = viewOff.ty; applyViewOffset(); flight = null; }
  canvas.classList.add('grabbing');
});
controls.addEventListener('end', () => canvas.classList.remove('grabbing'));

function focusPoint(p) {
  const target = p.world.clone();
  const cur = camera.position.clone().sub(controls.target);
  const sph = new THREE.Spherical().setFromVector3(cur);
  sph.radius = isPhone() ? 62 : 54;
  sph.phi = rad(48);
  if (cur.length() < 1) sph.theta = 0;
  return { target, pos: target.clone().add(new THREE.Vector3().setFromSpherical(sph)) };
}
function resetView() {
  viewOff.tx = panelOffset(!$('#panel').hidden).x;
  viewOff.ty = panelOffset(!$('#panel').hidden).y;
  const v = topView();
  fly(v.target, v.pos, 1200);
}

/* ═════════════ selection & panel ═════════════ */
let selected = null;
const panel = $('#panel');
const panelBody = $('#panelBody');

function edgesOf(p) {
  const out = [];
  const add = (l, main) => {
    if (l.from !== p.id && l.to !== p.id) return;
    const forward = l.from === p.id;
    const other = byId[forward ? l.to : l.from];
    let b = l.bearing;
    if (b === null || b === undefined || (!forward)) b = b === null || b === undefined ? Math.round(bearingBetween(p, other)) : (b + 180) % 360;
    const d = num(l.dist || `≈${Math.round(distBetween(p, other))}`);
    let kind = 'הסתעפות';
    if (main) kind = forward ? 'הבאה במסלול' : 'הקודמת במסלול';
    out.push({ other, bearing: b, dist: d, kind, order: main ? (forward ? 0 : 1) : 2 });
  };
  ROUTE.forEach((l) => add(l, true));
  BRANCHES.forEach((l) => add(l, false));
  const seen = new Set();
  return out.sort((a, b) => a.order - b.order).filter((x) => (seen.has(x.other.id) ? false : seen.add(x.other.id)));
}

function bearingIcon(b) {
  return `<svg class="bearing" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="15.5"/><g transform="rotate(${b} 17 17)"><path d="M17 26V8M12.5 12.5L17 8l4.5 4.5"/></g></svg>`;
}

function dimsText(p) {
  if (p.dimsText) return p.dimsText;
  if (!p.dims.length) return '<span class="muted">לא רלוונטי</span>';
  const [w, l, h] = p.dims;
  return `רוחב ${w}, אורך ${l}, גובה ${h} מ׳`;
}

function sketchSVG(p) {
  const Wd = 300, Hd = 180, pad = 30;
  if (p.shape === 'camera') {
    return `<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="שרטוט מצלמה"><g class="sk" transform="translate(110 40)"><rect x="0" y="20" width="62" height="40" rx="4"/><circle cx="31" cy="40" r="12"/><circle cx="31" cy="40" r="5"/><path d="M62 30l20-10v40l-20-10"/><path d="M31 60v40M31 100l-22 30M31 100l22 30"/></g></svg>`;
  }
  if (p.shape === 'pier') {
    return `<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="שרטוט מזח במבט על"><g transform="translate(40 40)"><path class="sk" d="M0 0H220M0 90H220"/><path class="sk-hid" d="M220 0V90"/><path class="sk-ground" d="M0 0V90" stroke-dasharray="1 4"/><path class="sk-dim" d="M190 6V84M184 12l6-6 6 6M184 78l6 6 6-6"/><text x="150" y="50" text-anchor="middle">9 מ׳</text></g></svg>`;
  }
  const c30 = Math.cos(rad(30)), s30 = Math.sin(rad(30));
  const iso = (x, y, z) => [(x - y) * c30, (x + y) * s30 - z];
  let corners, edges, hidden, dims;
  if (p.shape === 'pyramid') {
    const s = p.dims[0], h = p.dims[2];
    const A = [0, 0, 0], B = [s, 0, 0], C = [s / 2, s * Math.sin(rad(60)), 0], top = [s / 2, (s * Math.sin(rad(60))) / 3, h];
    corners = [A, B, C, top];
    edges = [[B, C], [C, A], [A, top], [B, top], [C, top]];
    hidden = [[A, B]];
    dims = [[A, C, `צלע ${s}`, [-26, 10]], [B, top, `גובה ${h}`, [30, 0]]];
  } else if (p.shape === 'cylinder') {
    const [d, l] = p.dims;
    return `<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="שרטוט גליל"><g transform="translate(60 50)"><ellipse class="sk" cx="170" cy="40" rx="18" ry="40"/><path class="sk" d="M10 0H170M10 80H170"/><path class="sk-hid" d="M10 0a18 40 0 0 0 0 80"/><path class="sk" d="M10 0a18 40 0 0 1 0 80"/><path class="sk-dim" d="M10 100H170"/><text x="90" y="118" text-anchor="middle">אורך ${l}</text><path class="sk-dim" d="M205 0V80"/><text x="212" y="44" text-anchor="start">קוטר ${d}</text></g></svg>`;
  } else {
    const [w, l, h] = p.dims;
    const P = (x, y, z) => [x, y, z];
    const o = P(0, 0, 0), x1 = P(w, 0, 0), y1 = P(0, l, 0), xy = P(w, l, 0);
    const oz = P(0, 0, h), xz = P(w, 0, h), yz = P(0, l, h), xyz = P(w, l, h);
    corners = [o, x1, y1, xy, oz, xz, yz, xyz];
    edges = [[x1, xy], [y1, xy], [x1, xz], [y1, yz], [xy, xyz], [oz, xz], [oz, yz], [xz, xyz], [yz, xyz]];
    hidden = [[o, x1], [o, y1], [o, oz]];
    dims = [[y1, xy, `רוחב ${w}`, [-26, 14]], [x1, xy, `אורך ${l}`, [26, 14]], [y1, yz, `גובה ${h}`, [-34, 4]]];
  }
  const pr = corners.map((c) => iso(...c));
  const xs = pr.map((q) => q[0]), ys = pr.map((q) => q[1]);
  const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
  const k = Math.min((Wd - pad * 2 - 40) / bw, (Hd - pad * 2) / bh);
  const ox = (Wd - bw * k) / 2 - Math.min(...xs) * k, oy = (Hd - bh * k) / 2 - Math.min(...ys) * k;
  const S = (c) => { const q = iso(...c); return [q[0] * k + ox, q[1] * k + oy]; };
  const seg = (a, b) => { const A = S(a), B = S(b); return `M${A[0].toFixed(1)} ${A[1].toFixed(1)}L${B[0].toFixed(1)} ${B[1].toFixed(1)}`; };
  const dimMarks = dims.map(([a, b, t, side]) => {
    const A = S(a), B = S(b);
    const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
    const off = side;
    return `<text x="${(mx + off[0]).toFixed(1)}" y="${(my + off[1]).toFixed(1)}" text-anchor="middle">${t}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="שרטוט לפי המידות"><path class="sk-hid" d="${hidden.map((e) => seg(...e)).join('')}"/><path class="sk" d="${edges.map((e) => seg(...e)).join('')}"/>${dimMarks}</svg>`;
}

function mediaHTML(p) {
  let html = '';
  if (p.live) {
    html += `<div class="p-media"><p class="live-tag">שידור חי</p><div class="live"><iframe src="https://www.youtube-nocookie.com/embed/${LIVE_CAMERA_YOUTUBE_ID}?autoplay=1&mute=1&playsinline=1&rel=0" title="מצלמה תת־ימית בשידור חי" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div><a class="live-link" href="https://www.youtube.com/watch?v=${LIVE_CAMERA_YOUTUBE_ID}" target="_blank" rel="noopener">פתיחה ביוטיוב</a></div>`;
  }
  if (p.photos && p.photos.length) {
    html += `<div class="p-media gallery">${p.photos.map((ph, i) => `<button type="button" data-photo="${i}" aria-label="הגדלת תמונה ${i + 1}"><img src="${esc(ph.src)}" alt="${esc(ph.caption || p.name)}" loading="lazy"></button>`).join('')}</div>`;
  } else if (!p.live) {
    html += `<figure class="p-media sketch">${sketchSVG(p)}<p>שרטוט לפי המידות שנמדדו. עדיין אין תמונות לנקודה הזו.</p></figure>`;
  }
  return html;
}

function renderPanel(p) {
  const kicker = p.live ? 'מצלמה תת־ימית' : p.station ? `תחנה ${p.station} מתוך ${MAIN.length} במסלול` : 'נקודת צד';
  const legs = edgesOf(p);
  const material = p.material ? esc(p.material) : '<span class="muted">לא תועד</span>';
  const est = p.estimated
    ? `<span class="est">מיקום משוער: חושב מאזימוט ${p.derive.bearing}° ומרחק ${p.derive.dist} מ׳ מ${esc(byId[p.derive.from].name)}${p.derive.rough ? ', לפי תיאור מילולי' : ''}.</span>`
    : '';
  panelBody.innerHTML = `
    <header class="p-head">
      <div>
        <p class="p-kicker">${kicker}</p>
        <h2 class="p-title" id="pTitle"><svg class="x" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 3l12 12M15 3L3 15"/></svg>${esc(p.name)}</h2>
      </div>
      <button type="button" class="icon-btn" id="pClose" aria-label="סגירת פרטי הנקודה"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </header>
    ${mediaHTML(p)}
    <dl class="facts">
      <dt>עומק</dt><dd><span class="big">${p.depthText} מ׳</span></dd>
      <dt>מידות</dt><dd>${dimsText(p)}</dd>
      <dt>קרקעית</dt><dd>${esc(p.terrain)}</dd>
      <dt>חומר</dt><dd>${material}</dd>
      <dt>נ.צ.</dt><dd><div class="coord"><span>${ddmText(p.latDec, true)}</span><span>${ddmText(p.lonDec, false)}</span></div><button type="button" class="copy" id="pCopy">העתקת נ.צ.</button>${est}</dd>
    </dl>
    ${p.note ? `<p class="p-note">${esc(p.note)}</p>` : ''}
    ${legs.length ? `<section class="legs"><h3>מכאן ממשיכים אל</h3>${legs.map((l) => `
      <button type="button" class="leg-btn" data-go="${l.other.id}">
        ${bearingIcon(l.bearing)}
        <span class="lt"><b>${esc(l.other.name)}</b><span>${l.kind}, אזימוט ${l.bearing}°${l.dist ? `, ${l.dist} מ׳` : ''}</span></span>
      </button>`).join('')}</section>` : ''}
  `;
  $('#pClose').addEventListener('click', closePanel);
  $('#pCopy').addEventListener('click', async (ev) => {
    const txt = `${p.latDec.toFixed(6)}, ${p.lonDec.toFixed(6)}`;
    try { await navigator.clipboard.writeText(txt); ev.target.textContent = 'הנ.צ. הועתק'; }
    catch { ev.target.textContent = txt; }
  });
  panelBody.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => select(b.dataset.go)));
  panelBody.querySelectorAll('[data-photo]').forEach((b) => b.addEventListener('click', () => openPhoto(p.photos[+b.dataset.photo])));
}

function select(id, { fromMap = false, instant = false } = {}) {
  const p = byId[id];
  if (!p) return;
  selected = p;
  renderPanel(p);
  panel.hidden = false;
  document.body.classList.add('panel-open');
  panelBody.scrollTop = 0;
  if (isPhone()) setInset(false);
  labels.forEach((l) => l.el.classList.toggle('is-active', l.p === p));
  markers.forEach((m) => m.bars.forEach((b) => (b.material = m.p === p ? xSelMat : xMat)));
  selRing.visible = true;
  selRing.position.copy(p.world).add(new THREE.Vector3(0, 0.5, 0));
  highlightMapMarker(id, fromMap);
  requestAnimationFrame(() => {
    const o = panelOffset(true);
    viewOff.tx = o.x; viewOff.ty = o.y;
    const v = focusPoint(p);
    fly(v.target, v.pos, instant ? 0 : 1100);
  });
  try { history.replaceState(null, '', `#${id}`); } catch {}
}

function closePanel() {
  if (panel.hidden) return;
  const last = selected;
  panel.hidden = true;
  document.body.classList.remove('panel-open');
  panelBody.innerHTML = '';
  selected = null;
  labels.forEach((l) => l.el.classList.remove('is-active'));
  markers.forEach((m) => m.bars.forEach((b) => (b.material = xMat)));
  selRing.visible = false;
  highlightMapMarker(null);
  viewOff.tx = 0; viewOff.ty = 0;
  fly(controls.target.clone(), camera.position.clone(), 500);
  try { history.replaceState(null, '', location.pathname + location.search); } catch {}
  if (last) labels.find((l) => l.p === last)?.el.focus({ preventScroll: true });
}

/* ═════════════ canvas picking (screen-space, touch friendly) ═════════════ */
const screenPos = new Map();
let downAt = null;
canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
  downAt = null;
  if (moved > 6) return;
  const hit = pick(e);
  if (hit) select(hit.id);
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || e.buttons) return;
  canvas.classList.toggle('hovering', !!pick(e));
});
function pick(e) {
  const r = canvas.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  let best = null, bd = e.pointerType === 'mouse' ? 18 : 28;
  for (const [p, s] of screenPos) {
    const d = Math.hypot(s.x - x, s.y - y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

/* ═════════════ satellite inset (Leaflet) ═════════════ */
const inset = $('#inset');
const mapToggle = $('#mapToggle');
let map = null;
const mapMarkers = {};
let viewPoly = null, viewDot = null;
function initMap() {
  if (!window.L) { $('#insetMap').innerHTML = '<p style="padding:12px;font-size:13px">מפת הלוויין לא נטענה.</p>'; return; }
  map = L.map('insetMap', { zoomControl: true, attributionControl: true, zoomSnap: 0.25, maxZoom: 21 });
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxNativeZoom: 19, maxZoom: 21,
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
  }).addTo(map);
  map.attributionControl.setPrefix(false);
  const ll = (p) => [p.latDec, p.lonDec];
  ROUTE.forEach((l) => L.polyline([ll(byId[l.from]), ll(byId[l.to])], { color: '#E2399B', weight: 2.2, dashArray: '6 5', interactive: false }).addTo(map));
  BRANCHES.forEach((l) => L.polyline([ll(byId[l.from]), ll(byId[l.to])], { color: '#ffffff', weight: 1.4, dashArray: '2 5', opacity: 0.85, interactive: false }).addTo(map));
  POINTS.forEach((p) => {
    const m = L.marker(ll(p), {
      icon: L.divIcon({ className: '', html: '<span class="ix"></span>', iconSize: [20, 20], iconAnchor: [10, 10] }),
      title: p.name, keyboard: true, riseOnHover: true,
    }).addTo(map);
    m.bindTooltip(p.name, { direction: 'top', offset: [0, -10], className: 'ix-tip' });
    m.on('click', () => select(p.id, { fromMap: true }));
    mapMarkers[p.id] = m;
  });
  viewPoly = L.polygon([], { color: '#ffffff', weight: 1.2, fillOpacity: 0.06, dashArray: '3 3', interactive: false }).addTo(map);
  viewDot = L.circleMarker(ll(POINTS[0]), { radius: 5, color: '#ffffff', weight: 1.6, fill: false, interactive: false }).addTo(map);
  map.fitBounds(L.latLngBounds(POINTS.map(ll)).pad(0.12));
  map.on('click', (ev) => {
    const loc = toLocal(ev.latlng.lat, ev.latlng.lng);
    if (loc.e < ext.e0 || loc.e > ext.e1 || loc.n < ext.n0 || loc.n > ext.n1) return;
    const t = W(loc.e, loc.n, yAt(loc.e, loc.n));
    const off = camera.position.clone().sub(controls.target);
    fly(t, t.clone().add(off), 800);
  });
}
function highlightMapMarker(id, fromMap) {
  Object.entries(mapMarkers).forEach(([k, m]) => m.getElement()?.querySelector('.ix')?.classList.toggle('is-active', k === id));
  if (id && map && !fromMap && inset.classList.contains('is-open')) map.panTo([byId[id].latDec, byId[id].lonDec], { animate: !reduceMotion });
}
function setInset(open) {
  inset.classList.toggle('is-open', open);
  mapToggle.setAttribute('aria-expanded', String(open));
  if (open) {
    if (!map) initMap();
    setTimeout(() => map?.invalidateSize(), 30);
  }
}
mapToggle.addEventListener('click', () => setInset(!inset.classList.contains('is-open')));
$('#insetClose').addEventListener('click', () => { setInset(false); mapToggle.focus(); });

const ray = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 6 * EX);
let lastMapSync = 0;
function syncMapView(now) {
  if (!map || !inset.classList.contains('is-open') || now - lastMapSync < 160) return;
  lastMapSync = now;
  const t = controls.target;
  const g = toGeo(t.x, -t.z);
  viewDot.setLatLng([g.lat, g.lon]);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const out = [];
  const hit = new THREE.Vector3();
  for (const [x, y] of corners) {
    ray.setFromCamera(new THREE.Vector2(x, y), camera);
    if (!ray.ray.intersectPlane(groundPlane, hit) || hit.distanceTo(camera.position) > 700) { viewPoly.setLatLngs([]); return; }
    const gg = toGeo(hit.x, -hit.z);
    out.push([gg.lat, gg.lon]);
  }
  viewPoly.setLatLngs(out);
}

/* ═════════════ depth slice chips ═════════════ */
const chipsEl = $('#depthChips');
SITE.slices.forEach((d, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip';
  b.setAttribute('aria-pressed', 'true');
  b.textContent = `${d} מ׳`;
  b.setAttribute('aria-label', `חתך בעומק ${d} מטר`);
  b.addEventListener('click', () => {
    const s = slices[d];
    s.on = !s.on;
    b.setAttribute('aria-pressed', String(s.on));
    s.grp.visible = s.on;
    const v = bedMat.uniforms.uSlices.value;
    v.setComponent(i, s.on ? 1 : 0);
    wallMat.uniforms.uSlices.value.setComponent(i, s.on ? 1 : 0);
  });
  chipsEl.appendChild(b);
});

/* ═════════════ meta line ═════════════ */
{
  const depths = POINTS.flatMap((p) => p.depth);
  $('#meta').textContent = `${POINTS.length} נקודות מסומנות, עומק ${Math.min(...depths)} עד ${Math.max(...depths)} מטר. הקרקעית מחושבת מהעומקים שנמדדו ומוגבהת פי ${EX} לאורך הציר האנכי.`;
}

/* ═════════════ theme ═════════════ */
const themeBtn = $('#themeToggle');
function syncThemeButton() {
  const dark = document.documentElement.dataset.theme === 'dark';
  themeBtn.setAttribute('aria-label', dark ? 'מעבר לתצוגה בהירה' : 'מעבר לתצוגה כהה');
  $('.tb-theme-label').textContent = dark ? 'תצוגה בהירה' : 'תצוגה כהה';
}
function applyTheme() {
  T = readTheme();
  renderer?.setClearColor(T.paper);
  [bedMat, wallMat].forEach((m) => {
    m.uniforms.uT1.value.copy(T.t1); m.uniforms.uT2.value.copy(T.t2); m.uniforms.uT3.value.copy(T.t3); m.uniforms.uT4.value.copy(T.t4);
    m.uniforms.uInk.value.copy(T.ink); m.uniforms.uSlice.value.copy(T.slice); m.uniforms.uDark.value = T.dark ? 1 : 0;
  });
  scene.traverse((o) => {
    if (o.userData.themeColor && o.material) o.material.color.copy(o.userData.themeColor === 'ink' ? T.ink : T.slice);
  });
  Object.values(slices).forEach((s) => (s.grp.children[0].material.opacity = T.dark ? 0.13 : 0.1));
  xMat.color.copy(T.magenta); xSelMat.color.copy(T.ink); plumbMat.color.copy(T.ink); objMat.color.copy(T.ink);
  selRing.material.color.copy(T.magenta);
  lineMats.forEach((m) => m.color.copy(m.userData.role === 'main' ? T.magenta : T.ink2));
  syncThemeButton();
}
themeBtn.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('iui-theme', next); } catch {}
  applyTheme();
});
syncThemeButton();

/* ═════════════ compass & scale ═════════════ */
const rose = $('#compassRose');
$('#compass').addEventListener('click', resetView);
const scaleBar = $('#scaleBar'), scaleText = $('#scaleText');
const NICE = [1, 2, 5, 10, 20, 25, 50, 100, 200];
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
let lastScale = '';
function updateWidgets() {
  tmpA.copy(controls.target).project(camera);
  tmpB.copy(controls.target).add(new THREE.Vector3(0, 0, -10)).project(camera);
  const ang = Math.atan2((tmpB.x - tmpA.x) * vw, (tmpB.y - tmpA.y) * vh);
  rose.style.transform = `rotate(${deg(ang).toFixed(1)}deg)`;
  const dist = camera.position.distanceTo(controls.target);
  const mpp = (2 * dist * Math.tan(rad(camera.fov) / 2)) / vh;
  let m = NICE[0];
  for (const n of NICE) if (n / mpp <= 110) m = n;
  const key = `${m}|${Math.round(m / mpp)}`;
  if (key !== lastScale) {
    lastScale = key;
    scaleBar.style.width = `${Math.round(m / mpp)}px`;
    scaleText.textContent = `${m} מ׳`;
  }
}

/* ═════════════ overlay layout ═════════════ */
const v3 = new THREE.Vector3();
function toScreen(pos) {
  v3.copy(pos).project(camera);
  if (v3.z > 1 || v3.z < -1) return null;
  return { x: (v3.x * 0.5 + 0.5) * vw, y: (-v3.y * 0.5 + 0.5) * vh };
}
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const order = [...labels].sort((a, b) => (a.p.station ? a.p.station : 50) - (b.p.station ? b.p.station : 50));
function layoutLabels() {
  screenPos.clear();
  const placed = [];
  const list = selected ? [labels.find((l) => l.p === selected), ...order.filter((l) => l.p !== selected)] : order;
  for (const l of list) {
    const s = toScreen(markers.find((m) => m.p === l.p).grp.position);
    if (!s || s.x < -40 || s.y < -40 || s.x > vw + 40 || s.y > vh + 40) { l.el.hidden = true; continue; }
    screenPos.set(l.p, s);
    const box = { x: s.x - 26 - l.w, y: s.y - l.h / 2, w: l.w, h: l.h };
    const clash = placed.some((b) => overlap(box, b));
    if (clash && l.p !== selected) { l.el.hidden = true; continue; }
    l.el.hidden = false;
    placed.push({ x: s.x - 10, y: s.y - 10, w: 20, h: 20 }, box);
    l.el.style.transform = `translate(${box.x.toFixed(1)}px, ${box.y.toFixed(1)}px)`;
  }
  const near = camera.position.distanceTo(controls.target) < 170;
  for (const g of legLabels) {
    const s = near ? toScreen(g.pos) : null;
    if (!s) { g.el.hidden = true; continue; }
    const box = { x: s.x - g.w / 2, y: s.y - g.h / 2, w: g.w, h: g.h };
    if (placed.some((b) => overlap(box, b))) { g.el.hidden = true; continue; }
    g.el.hidden = false;
    placed.push(box);
    g.el.style.transform = `translate(${box.x.toFixed(1)}px, ${box.y.toFixed(1)}px)`;
  }
  const tilted = controls.getPolarAngle() > rad(18);
  for (const sl of sliceLabels) {
    const s = tilted && slices[sl.d].on ? toScreen(slices[sl.d].anchor) : null;
    if (!s) { sl.el.hidden = true; continue; }
    sl.el.hidden = false;
    sl.el.style.transform = `translate(${(s.x + 6).toFixed(1)}px, ${(s.y - 9).toFixed(1)}px)`;
  }
}

/* ═════════════ loop ═════════════ */
const introStart = performance.now() + 250;
function frame(now) {
  stepFlight(now);
  controls.update();
  // constant on-screen size for X marks, plus a stamped-in intro
  const az = controls.getAzimuthalAngle();
  markers.forEach((m, i) => {
    const order = m.p.station ? m.p.station : MAIN.length + i;
    const t = reduceMotion ? 1 : clamp((now - introStart - order * 75) / 380, 0, 1);
    const pop = t === 0 ? 0 : 1 + 0.35 * Math.sin(Math.PI * t) * (1 - t);
    const d = camera.position.distanceTo(m.grp.position);
    m.grp.scale.setScalar(clamp(d / 105, 0.35, 2.4) * pop);
    m.grp.rotation.y = az;
    if (m.p === selected) selRing.scale.setScalar(clamp(d / 105, 0.35, 2.4));
  });
  const fade = reduceMotion ? 1 : clamp((now - introStart - 500) / 700, 0, 1);
  lineMats.forEach((m) => (m.opacity = m.userData.role === 'main' ? fade : fade * 0.85));
  layoutLabels();
  updateWidgets();
  syncMapView(now);
  renderer?.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ═════════════ slides ═════════════ */
const deck = $('#deck');
let deckState = null;
const dNum = (s) => { const m = String(s).split('–').map(Number); return m.length > 1 ? (m[0] + m[1]) / 2 : m[0]; };

function routeFigure() {
  const es = POINTS.map((p) => p.e), ns = POINTS.map((p) => p.n);
  const minE = Math.min(...es), maxE = Math.max(...es), minN = Math.min(...ns), maxN = Math.max(...ns);
  const Wd = 520, Hd = 420, pad = 46;
  const k = Math.min((Wd - pad * 2) / (maxE - minE), (Hd - pad * 2) / (maxN - minN));
  const ox = (Wd - (maxE - minE) * k) / 2, oy = (Hd - (maxN - minN) * k) / 2;
  const X = (p) => ox + (p.e - minE) * k, Y = (p) => oy + (maxN - p.n) * k;
  const grid = [];
  for (let e = Math.ceil(minE / 20) * 20; e <= maxE; e += 20) grid.push(`<path class="f-grid" d="M${(ox + (e - minE) * k).toFixed(1)} 10V${Hd - 10}"/>`);
  for (let n = Math.ceil(minN / 20) * 20; n <= maxN; n += 20) grid.push(`<path class="f-grid" d="M10 ${(oy + (maxN - n) * k).toFixed(1)}H${Wd - 10}"/>`);
  const lines = (arr, cls) => arr.map((l) => `<path class="${cls}" d="M${X(byId[l.from]).toFixed(1)} ${Y(byId[l.from]).toFixed(1)}L${X(byId[l.to]).toFixed(1)} ${Y(byId[l.to]).toFixed(1)}"/>`).join('');
  const xs = POINTS.map((p) => { const x = X(p), y = Y(p); return `<path class="f-x" d="M${x - 4} ${y - 4}l8 8m0-8l-8 8"/>`; }).join('');
  const names = POINTS.filter((p) => p.station || p.live).map((p) => `<text class="f-name" x="${(X(p) - 9).toFixed(1)}" y="${(Y(p) + 4).toFixed(1)}" text-anchor="start">${esc(p.name)}</text>`).join('');
  const scale = 20 * k;
  return `<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="תרשים המסלול במבט על">${grid.join('')}${lines(BRANCHES, 'f-branch')}${lines(ROUTE, 'f-route')}${xs}${names}
    <g transform="translate(${Wd - 34} 40)"><path class="f-line" d="M0 18V-14M-5 -8L0 -16 5 -8"/><text x="0" y="32" text-anchor="middle">צפון</text></g>
    <g transform="translate(30 ${Hd - 22})"><path class="f-line" d="M0 0H${scale.toFixed(1)}M0 -4V4M${scale.toFixed(1)} -4V4"/><text x="${(scale / 2).toFixed(1)}" y="-8" text-anchor="middle">20 מ׳</text></g></svg>`;
}
function routeTable() {
  let lo = 0, hi = 0;
  const rows = ROUTE.map((l) => {
    const [a, b] = String(l.dist).split('–').map(Number);
    lo += a; hi += b || a;
    return `<tr><td>${esc(byId[l.from].name)} אל ${esc(byId[l.to].name)}</td><td>${l.bearing}°</td><td>${num(l.dist)}</td></tr>`;
  }).join('');
  return `<table class="legtable"><thead><tr><th>קטע</th><th>אזימוט</th><th>מטרים</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td>אורך המסלול</td><td></td><td>${num(lo === hi ? lo : `${lo}–${hi}`)}</td></tr></tfoot></table>`;
}
function profileFigure() {
  const Wd = 860, Hd = 360, L = 130, R = 30, Tt = 56, B = 34;
  let x = 0;
  const st = [{ p: byId[MAIN[0]], x: 0 }];
  ROUTE.forEach((l) => { x += dNum(l.dist); st.push({ p: byId[l.to], x }); });
  const maxX = x, maxD = 12;
  const sx = (v) => Wd - R - (v / maxX) * (Wd - L - R); // RTL: start at right
  const sy = (d) => Tt + (d / maxD) * (Hd - Tt - B);
  const bed = st.map((s) => `${sx(s.x).toFixed(1)},${sy(s.p.depthMid).toFixed(1)}`).join(' ');
  const poly = `${sx(0)},${Hd - B} ${bed} ${sx(maxX)},${Hd - B}`;
  const slicesSvg = SITE.slices.map((d) => `<path class="f-slice" d="M${L} ${sy(d)}H${Wd - R}"/><text class="f-slice-t" x="${L - 6}" y="${sy(d) + 4}" text-anchor="start">${d} מ׳</text>`).join('');
  const ranges = st.filter((s) => s.p.depth.length > 1).map((s) => `<path class="f-line" d="M${sx(s.x)} ${sy(s.p.depth[0])}V${sy(s.p.depth[1])}" stroke-width="3" opacity=".35"/>`).join('');
  const xs = st.map((s, i) => {
    const X = sx(s.x), Y = sy(s.p.depthMid);
    const up = i % 2 === 0;
    return `<path class="f-x" d="M${X - 5} ${Y - 5}l10 10m0-10l-10 10"/><path class="f-grid" d="M${X} ${Tt - 6}V${Y - 8}"/><text class="f-name" x="${X}" y="${up ? Tt - 12 : Tt - 30}" text-anchor="middle">${esc(s.p.name)}</text>`;
  }).join('');
  const ticks = [0, 50, 100, 150, 200].filter((v) => v <= maxX).map((v) => `<text x="${sx(v)}" y="${Hd - 12}" text-anchor="middle">${v}</text>`).join('');
  return `<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="חתך עומק לאורך המסלול, ממשתלה עד פירמידה">
    <rect class="f-water" x="${L}" y="${Tt}" width="${Wd - L - R}" height="${Hd - Tt - B}"/>
    <polygon class="f-bed" points="${poly}"/>${slicesSvg}${ranges}${xs}${ticks}
    <text x="${L - 6}" y="${Hd - 12}" text-anchor="start">מטרים לאורך המסלול</text></svg>`;
}
function bandsHTML() {
  const bands = [[0, 3], [3, 6], [6, 9], [9, 99]];
  return `<div class="bands">${bands.map(([a, b]) => {
    const pts = POINTS.filter((p) => p.depthMid >= a && p.depthMid < b);
    return `<section><h3>${b === 99 ? `${a} מ׳ ומטה` : `${a}–${b} מ׳`}</h3><ul>${pts.length ? pts.map((p) => `<li>${esc(p.name)} <span class="muted">(${p.depthText})</span></li>`).join('') : '<li class="none">אין נקודות</li>'}</ul></section>`;
  }).join('')}</div>`;
}
function slideHTML(s) {
  let body = '';
  if (s.type === 'facts') {
    const depths = POINTS.flatMap((p) => p.depth);
    let lo = 0, hi = 0;
    ROUTE.forEach((l) => { const [a, b] = String(l.dist).split('–').map(Number); lo += a; hi += b || a; });
    body = `<p class="lead">${esc(s.body)}</p><div class="stats">
      <div><b>${POINTS.length}</b><span>נקודות מסומנות</span></div>
      <div><b>${num(`${lo}–${hi}`)}</b><span>מטר במסלול הראשי</span></div>
      <div><b>${Math.max(...depths)}</b><span>מטר, העומק המרבי</span></div>
      <div><b>${Math.min(...depths)}</b><span>מטר, העומק הרדוד</span></div></div>`;
  } else if (s.type === 'text') {
    body = (s.body ? `<p class="lead">${esc(s.body)}</p>` : '') + (s.list ? `<dl class="method">${s.list.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>` : '');
  } else if (s.type === 'people') {
    body = `<ul class="people">${s.people.map((m) => `<li><b>${esc(m.name)}</b><span>${esc(m.role)}</span></li>`).join('')}</ul>`;
  } else if (s.type === 'route') {
    body = `<div class="slide-cols"><div class="figure">${routeFigure()}</div>${routeTable()}</div>`;
  } else if (s.type === 'profile') {
    body = `<div class="figure">${profileFigure()}</div>`;
  } else if (s.type === 'bands') {
    body = bandsHTML();
  }
  return `<article class="slide"><h2 id="deckSlideTitle">${esc(s.title)}</h2>${body}</article>`;
}
function showSlide(i) {
  const d = DECKS[deckState.key];
  deckState.i = clamp(i, 0, d.slides.length - 1);
  $('#deckBody').innerHTML = slideHTML(d.slides[deckState.i]);
  $('#deckBody').scrollTop = 0;
  $('#deckCount').textContent = `${deckState.i + 1} / ${d.slides.length}`;
  $('#deckPrev').disabled = deckState.i === 0;
  $('#deckNext').disabled = deckState.i === d.slides.length - 1;
  const multi = d.slides.length > 1;
  $('.deck-foot').style.visibility = multi ? 'visible' : 'hidden';
}
let deckOpener = null;
function openDeck(key, opener) {
  deckOpener = opener;
  deckState = { key, i: 0 };
  $('#deckName').textContent = DECKS[key].title;
  showSlide(0);
  deck.showModal();
}
document.querySelectorAll('[data-deck]').forEach((b) => b.addEventListener('click', () => openDeck(b.dataset.deck, b)));
$('#deckClose').addEventListener('click', () => deck.close());
$('#deckPrev').addEventListener('click', () => showSlide(deckState.i - 1));
$('#deckNext').addEventListener('click', () => showSlide(deckState.i + 1));
deck.addEventListener('close', () => deckOpener?.focus());
deck.addEventListener('click', (e) => { if (e.target === deck) deck.close(); });
deck.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') { e.preventDefault(); showSlide(deckState.i + 1); }
  if (e.key === 'ArrowRight') { e.preventDefault(); showSlide(deckState.i - 1); }
});
{
  let sx0 = null, sy0 = null;
  deck.addEventListener('touchstart', (e) => { sx0 = e.touches[0].clientX; sy0 = e.touches[0].clientY; }, { passive: true });
  deck.addEventListener('touchend', (e) => {
    if (sx0 === null) return;
    const dx = e.changedTouches[0].clientX - sx0, dy = e.changedTouches[0].clientY - sy0;
    sx0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) showSlide(deckState.i + (dx > 0 ? 1 : -1));
  });
}

/* lightbox */
const lb = $('#lightbox');
function openPhoto(ph) {
  $('#lbImg').src = ph.src; $('#lbImg').alt = ph.caption || '';
  $('#lbCap').textContent = ph.caption || '';
  lb.showModal();
}
$('#lbClose').addEventListener('click', () => lb.close());
lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });

/* keyboard */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !deck.open && !lb.open) closePanel();
});

/* ═════════════ boot ═════════════ */
resize();
{
  const v = topView();
  controls.target.copy(v.target);
  camera.position.copy(v.pos);
  controls.update();
}
new ResizeObserver(() => resize()).observe(canvas);
window.addEventListener('resize', resize);
measureLabels();
document.fonts?.ready.then(measureLabels);
if (window.innerWidth > 1180) setInset(true);
requestAnimationFrame(frame);
const hashId = decodeURIComponent(location.hash.slice(1));
if (byId[hashId]) setTimeout(() => select(hashId), 400);

// small debugging handle
window.__iui = { POINTS, select, resetView, camera, controls };
