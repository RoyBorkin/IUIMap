import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { SITE, POINTS, ROUTE, BRANCHES, DECKS, LIVE_CAMERA_YOUTUBE_ID, SHORELINE, PIER, BUILDINGS } from './data.js';
import { UI } from './i18n.js';
import { qrSVG } from './qr.js';
import { Kit, buildObject, buildPier, buildScatter, buildBuildings } from './models.js';

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
/* ── language ── */
let LANG = (() => {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'en' || q === 'he') return q;
    return localStorage.getItem('iui-lang') === 'en' ? 'en' : 'he';
  } catch { return 'he'; }
})();
const t = (k, ...a) => { const v = UI[LANG][k]; return typeof v === 'function' ? v(...a) : v; };
const tx = (p, f) => (LANG === 'en' && p.en && p.en[f] != null ? p.en[f] : p[f]);
const nm = (p) => tx(p, 'name');
const isRTL = () => LANG === 'he';
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
  p.hasDepth = p.depth.length > 0;
  p.depthMid = p.hasDepth ? avg(p.depth) : null;
  p.depthMax = p.hasDepth ? Math.max(...p.depth) : null;
  p.depthText = p.hasDepth ? num(p.depth.length > 1 ? `${p.depth[0]}–${p.depth[1]}` : `${p.depth[0]}`) : '';
  p.station = MAIN.indexOf(p.id) + 1;
  if (p.lat) {
    p.latDec = ddm(p.lat); p.lonDec = ddm(p.lon);
    Object.assign(p, toLocal(p.latDec, p.lonDec));
    if (p.snap) {
      // keep the measured position for the panel, but draw the point where the satellite image shows the object
      p.measured = { lat: p.latDec, lon: p.lonDec };
      p.e += p.snap[0]; p.n += p.snap[1];
      const g = toGeo(p.e, p.n);
      p.latDec = g.lat; p.lonDec = g.lon;
    }
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
/* ═════════════ coastline (traced from the satellite image) ═════════════ */
const SHORE = SHORELINE.map(([lat, lon]) => toLocal(lat, lon));
{
  // extend both ends of the traced waterline so distances are defined across the whole block
  const stretch = (p, q) => { const d = Math.hypot(p.e - q.e, p.n - q.n) || 1; return { e: p.e + ((p.e - q.e) / d) * 400, n: p.n + ((p.n - q.n) / d) * 400 }; };
  SHORE.unshift(stretch(SHORE[0], SHORE[3]));
  SHORE.push(stretch(SHORE[SHORE.length - 1], SHORE[SHORE.length - 4]));
}
// signed distance to the waterline in metres: positive at sea (east of the line), negative on the beach
function seaDist(e, n) {
  let best = Infinity, sign = 1;
  for (let k = 0; k < SHORE.length - 1; k++) {
    const a = SHORE[k], b = SHORE[k + 1];
    const de = b.e - a.e, dn = b.n - a.n, L2 = de * de + dn * dn;
    const t = clamp(((e - a.e) * de + (n - a.n) * dn) / L2, 0, 1);
    const pe = a.e + de * t, pn = a.n + dn * t;
    const d = Math.hypot(e - pe, n - pn);
    if (d < best) { best = d; sign = (e - pe) * -dn + (n - pn) * de >= 0 ? 1 : -1; }
  }
  return best * sign;
}
POINTS.forEach((p) => (p.s = seaDist(p.e, p.n)));

/* ═════════════ seabed model ═════════════
   A shallow shelf that reaches about 5–6 m, then a slope down to the deep water,
   both measured from the waterline. The drop-off distance and the slope are fitted
   to the measured depths, and a local correction makes the surface pass through
   every measured point. */
const SHELF = 5.5;
const profile = (s, sA, m) => SHELF * Math.tanh((1.7 * s) / sA) + m * 3 * Math.log1p(Math.exp((s - sA) / 3));
const fit = (() => {
  const pts = POINTS.filter((p) => p.hasDepth);
  let best = { err: Infinity };
  for (let sA = 8; sA <= 90; sA += 1) for (let m = 0.05; m <= 0.8; m += 0.01) {
    const err = pts.reduce((a, p) => a + (profile(p.s, sA, m) - p.depthMid) ** 2, 0);
    if (err < best.err) best = { err, sA, m };
  }
  return best;
})();
const seabedModel = (() => {
  const res = POINTS.filter((p) => p.hasDepth).map((p) => [p.e, p.n, p.depthMid - profile(p.s, fit.sA, fit.m)]);
  // inverse-distance weights: exact at each point, fading to the fitted profile ~15 m away
  return (e, n, s) => {
    let ws = 0, wr = 0;
    for (const [pe, pn, r] of res) {
      const d2 = (e - pe) ** 2 + (n - pn) ** 2;
      const w = Math.exp(-d2 / (2 * 11 * 11)) / (d2 + 0.6) ** 1.5;
      ws += w; wr += w * r;
    }
    const noise = 0.12 * Math.sin(e * 0.19 + n * 0.11) + 0.08 * Math.sin(e * 0.07 - n * 0.23 + 1.3) + 0.05 * Math.sin(e * 0.41 + n * 0.37 + 2.1);
    return profile(s, fit.sA, fit.m) + wr / (ws + 0.0015) + noise * Math.min(1, s / 10);
  };
})();

// depth in metres (negative on the beach)
function seabed(e, n) {
  const s = seaDist(e, n);
  if (s <= 0) return -1.6 * (1 - Math.exp(s / 18));
  return clamp(seabedModel(e, n, s), 0, 14);
}
const yAt = (e, n) => -seabed(e, n) * EX;
const inSea = (e, n) => seaDist(e, n) > 1.5;

/* bottom types from the survey table, spread around each point */
const TYPE_WORDS = { gravel: ['חצץ', 'אבנים'], rubble: ['דרדרת'], rocks: ['סלע'], reef: ['שונית'], sand: ['חול'] };
POINTS.forEach((p) => {
  p.types = Object.keys(TYPE_WORDS).filter((k) => TYPE_WORDS[k].some((w) => (p.terrain || '').includes(w)));
});
function mixAt(e, n) {
  const acc = { gravel: 0, rubble: 0, rocks: 0, reef: 0, sand: 0.35 };
  for (const p of POINTS) {
    if (!p.types.length) continue;
    const g = Math.exp(-((e - p.e) ** 2 + (n - p.n) ** 2) / (2 * 15 * 15));
    p.types.forEach((t) => (acc[t] += g / p.types.length));
  }
  const s = seaDist(e, n);
  if (s < 14) acc.sand += (14 - Math.max(0, s)) / 6;
  const tot = acc.gravel + acc.rubble + acc.rocks + acc.reef + acc.sand;
  return { gravel: acc.gravel / tot, rubble: acc.rubble / tot, rocks: acc.rocks / tot, reef: acc.reef / tot };
}

/* ═════════════ block extent ═════════════ */
const MARGIN = 38;
// beach buildings within 150 m of the pier are part of the model
const NEAR_BUILDINGS = BUILDINGS.map((b) => ({ ...b, pts: b.ll.map(([lat, lon]) => toLocal(lat, lon)) }))
  .filter((b) => b.pts.every((q) => Math.hypot(q.e - byId.pier.e, q.n - byId.pier.n) < 150));
const ext = (() => {
  const bs = NEAR_BUILDINGS.flatMap((b) => b.pts);
  const es = [...POINTS.map((p) => p.e), ...bs.map((q) => q.e + 20)];
  const ns = [...POINTS.map((p) => p.n), ...bs.map((q) => q.n - 26)];
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
    t1: c('--t1'), t2: c('--t2'), t3: c('--t3'), t4: c('--t4'), buff: c('--buff'),
    clay: c('--clay'), simBg: c('--sim-bg'),
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
  $('#stage').insertAdjacentHTML('beforeend', `<p class="noscript">${t('noWebgl')}</p>`);
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

/* ── chart shader (also renders the realistic simulation when uSim = 1) ── */
const chartUniforms = () => ({
  uT1: { value: T.t1.clone() }, uT2: { value: T.t2.clone() }, uT3: { value: T.t3.clone() }, uT4: { value: T.t4.clone() },
  uInk: { value: T.ink.clone() }, uSlice: { value: T.slice.clone() }, uLand: { value: T.buff.clone() },
  uSlices: { value: new THREE.Vector3(1, 1, 1) },
  uEx: { value: EX }, uWall: { value: 0 }, uDark: { value: T.dark ? 1 : 0 },
  uSim: { value: 0 }, uTime: { value: 0 },
});
const chartVS = /* glsl */`
  attribute vec4 aMix;
  varying float vD; varying vec3 vN; varying vec3 vW; varying vec4 vMix;
  uniform float uEx;
  void main(){
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vD = -w.y / uEx;
    vMix = aMix;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const chartFS = /* glsl */`
  varying float vD; varying vec3 vN; varying vec3 vW; varying vec4 vMix;
  uniform vec3 uT1, uT2, uT3, uT4, uInk, uSlice, uSlices, uLand;
  uniform float uWall, uDark, uSim, uTime;
  float iso(float v, float k, float px){
    float fw = max(fwidth(v), 1e-4);
    return 1.0 - smoothstep(px * 0.5, px * 0.5 + 1.0, abs(v - k) / fw);
  }
  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
  float caustic(vec2 p, float t){
    vec2 q = p;
    for (int i = 0; i < 3; i++) q += vec2(sin(q.y * 1.3 + t), cos(q.x * 1.1 - t * 1.2)) * 0.45;
    float c = abs(sin(q.x * 1.6) + sin(q.y * 1.6)) * 0.5;
    return pow(1.0 - clamp(c, 0.0, 1.0), 7.0);
  }
  vec3 chartColor(float d, float sh){
    vec3 col = d < 0.0 ? uLand : d < 3.0 ? uT1 : d < 6.0 ? uT2 : d < 9.0 ? uT3 : uT4;
    col *= mix(mix(0.80, 0.62, uDark), 1.03, sh);
    col *= 1.0 - 0.10 * uWall;
    float fw = max(fwidth(d), 1e-4);
    float fine = 1.0 - smoothstep(0.4, 1.4, abs(d - floor(d + 0.5)) / fw);
    col = mix(col, uInk, fine * mix(0.16, 0.22, uDark) * step(0.0, d));
    col = mix(col, uInk, iso(d, 0.0, 2.0) * 0.9 * (1.0 - uWall));
    return col;
  }
  vec3 simColor(float d, float sh){
    vec2 p = vW.xz;
    float n1 = fbm(p * 0.35), n2 = fbm(p * 2.3);
    if (uWall > 0.5) {
      float band = step(0.5, fract(d * 1.2 + n1 * 0.7));
      return mix(vec3(0.60, 0.53, 0.41), vec3(0.71, 0.63, 0.49), band) * mix(0.72, 1.0, sh) * mix(1.0, 0.7, uDark);
    }
    if (d < 0.0) {
      vec3 dry = vec3(0.86, 0.78, 0.62) * (0.9 + 0.14 * n2);
      dry = mix(dry * 0.78, dry, smoothstep(0.0, 0.25, -d));
      return dry * mix(0.75, 1.03, sh) * mix(1.0, 0.72, uDark);
    }
    vec3 sand = vec3(0.80, 0.72, 0.56) * (0.86 + 0.18 * n1 + 0.06 * n2);
    sand *= 0.96 + 0.05 * sin(p.x * 3.1 + n1 * 6.0 + p.y * 0.8);
    vec3 gravel = mix(vec3(0.50, 0.48, 0.44), vec3(0.70, 0.66, 0.60), hash(floor(p * 7.0)));
    vec3 rubble = mix(vec3(0.58, 0.54, 0.46), vec3(0.78, 0.74, 0.66), step(0.5, fbm(p * 1.6))) * (0.85 + 0.2 * hash(floor(p * 4.0)));
    vec3 rock = vec3(0.42, 0.40, 0.36) * (0.7 + 0.55 * fbm(p * 0.9));
    vec3 reef = mix(vec3(0.44, 0.39, 0.30), vec3(0.58, 0.38, 0.50), smoothstep(0.45, 0.7, fbm(p * 0.7 + 3.0)));
    reef = mix(reef, vec3(0.40, 0.48, 0.35), smoothstep(0.55, 0.8, fbm(p * 1.1 + 9.0)));
    vec4 w = clamp(vMix * 1.7 * (0.55 + 0.9 * vec4(fbm(p * 0.6 + 1.0), fbm(p * 0.6 + 5.0), fbm(p * 0.6 + 9.0), fbm(p * 0.6 + 13.0))), 0.0, 1.0);
    float ws = w.x + w.y + w.z + w.w;
    if (ws > 1.0) { w /= ws; ws = 1.0; }
    vec3 col = sand * (1.0 - ws) + gravel * w.x + rubble * w.y + rock * w.z + reef * w.w;
    col *= mix(0.72, 1.05, sh);
    col += vec3(0.85, 1.0, 1.0) * caustic(p * 0.42, uTime * 0.6) * 0.30 * exp(-0.13 * d);
    vec3 water = mix(vec3(0.20, 0.62, 0.70), vec3(0.04, 0.27, 0.40), clamp(d / 12.0, 0.0, 1.0));
    col = mix(col * vec3(0.78, 0.95, 1.02), water, (1.0 - exp(-0.15 * d)) * 0.82);
    return col * mix(1.0, 0.68, uDark);
  }
  void main(){
    float d = vD;
    vec3 L = normalize(vec3(-0.45, 0.82, 0.36));
    float sh = clamp(dot(normalize(vN), L), 0.0, 1.0);
    vec3 col = uSim > 0.5 ? simColor(d, sh) : chartColor(d, sh);
    float s = iso(d, 3.0, 2.2) * uSlices.x + iso(d, 6.0, 2.2) * uSlices.y + iso(d, 9.0, 2.2) * uSlices.z;
    col = mix(col, uSlice, clamp(s, 0.0, 1.0) * mix(0.95, 0.75, uSim));
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
  const mix = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const e = pos.getX(i) + ext.ce, n = -pos.getZ(i) + ext.cn;
    pos.setXYZ(i, e, yAt(e, n), -n);
    const m = mixAt(e, n);
    mix.set([m.gravel, m.rubble, m.rocks, m.reef], i * 4);
  }
  g.setAttribute('aMix', new THREE.BufferAttribute(mix, 4));
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
  g.setAttribute('aMix', new THREE.Float32BufferAttribute(new Float32Array((verts.length / 3) * 4), 4));
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

/* ── 3D models of the objects (true size), plus the pier ── */
scene.add(new THREE.HemisphereLight(0xe8f4ff, 0x8a7a5a, 2.1));
const sun = new THREE.DirectionalLight(0xffffff, 2.3);
sun.position.set(-45, 82, -36);
scene.add(sun);
const kit = new Kit();
kit.setMode('chart', T.clay);
POINTS.forEach((p) => {
  if (!p.model) return;
  const obj = buildObject(kit, p);
  if (!obj) return;
  obj.position.copy(W(p.e, p.n, yAt(p.e, p.n)));
  if (p.heading) obj.rotation.y = -rad(p.heading);
  scene.add(obj);
});
{
  const head = { e: byId.pier.e + PIER.headOffset[0], n: byId.pier.n + PIER.headOffset[1] };
  scene.add(buildPier(kit, { head, bearing: PIER.bearing, headSize: PIER.headSize, walkWidth: PIER.walkWidth, seaDist, yAt, W }));
}
scene.add(buildBuildings(kit, NEAR_BUILDINGS, { ext, seaDist, yAt }));

/* ── simulation extras: scattered rocks and coral heads, and the water surface ── */
let scatter = null;
const waterMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide,
  uniforms: { uTime: { value: 0 }, uDark: { value: 0 } },
  vertexShader: `attribute float aSea; varying float vSea; varying vec3 vW;
    void main(){ vSea = aSea; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `varying float vSea; varying vec3 vW; uniform float uTime, uDark;
    void main(){
      if (vSea < 0.0) discard;
      float r = sin(vW.x * 0.9 + uTime * 1.3) * sin(vW.z * 0.7 - uTime) * 0.5 + 0.5;
      vec3 c = mix(vec3(0.16, 0.55, 0.68), vec3(0.55, 0.85, 0.92), r * 0.35);
      float edge = smoothstep(0.0, 3.0, vSea);
      gl_FragColor = vec4(c * mix(1.0, 0.6, uDark), mix(0.55, 0.16, edge));
    }`,
});
const water = (() => {
  const g = new THREE.PlaneGeometry(ext.w, ext.h, 100, Math.round((100 * ext.h) / ext.w)).rotateX(-Math.PI / 2);
  const pos = g.attributes.position, sea = new Float32Array(pos.count);
  for (let k = 0; k < pos.count; k++) sea[k] = seaDist(pos.getX(k) + ext.ce, -pos.getZ(k) + ext.cn);
  g.setAttribute('aSea', new THREE.BufferAttribute(sea, 1));
  return new THREE.Mesh(g, waterMat);
})();
water.position.set(ext.ce, 0.02, -ext.cn);
water.renderOrder = 4;
water.visible = false;
scene.add(water);

/* ── X markers + plumb lines ── */
const xMat = new THREE.MeshBasicMaterial({ color: T.magenta, transparent: true, depthTest: false, fog: false });
// the selected X goes see-through so the 3D model under it stays visible
const xSelMat = new THREE.MeshBasicMaterial({ color: T.ink, transparent: true, opacity: 0.35, depthTest: false, fog: false });
const plumbMat = new THREE.LineDashedMaterial({ color: T.ink, dashSize: 0.9, gapSize: 0.9, transparent: true, opacity: 0.38, fog: false });
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
  new THREE.LineDashedMaterial({ color: T.magenta, dashSize: 0.8, gapSize: 0.6, depthTest: false, transparent: true, fog: false })
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
  m.fog = false;
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
  el.addEventListener('click', () => select(p.id));
  labelLayer.appendChild(el);
  return { p, el, w: 0, h: 0 };
});
const legLabels = [...ROUTE.map((l) => ({ ...l, main: true })), ...BRANCHES.filter((l) => l.bearing !== null)].map((l) => {
  const a = byId[l.from], b = byId[l.to];
  const el = document.createElement('div');
  el.className = 'leg';
  el.setAttribute('aria-hidden', 'true');
  el.dataset.b = l.bearing; el.dataset.d = l.dist || '';
  labelLayer.appendChild(el);
  const me = (a.e + b.e) / 2, mn = (a.n + b.n) / 2;
  return { el, pos: W(me, mn, yAt(me, mn) + 0.6), w: 0, h: 0 };
});
const sliceLabels = SITE.slices.map((d) => {
  const el = document.createElement('div');
  el.className = 'slabel';
  el.setAttribute('aria-hidden', 'true');
  labelLayer.appendChild(el);
  return { d, el };
});
function fillLabels() {
  labels.forEach(({ p, el }) => {
    el.innerHTML = `<span class="pname">${esc(nm(p))}</span><span class="snd">${p.hasDepth ? p.depthText : ''}${p.live ? t('liveSnd') : ''}</span>`;
    el.setAttribute('aria-label', p.hasDepth ? t('depthAria', nm(p), p.depthText) : nm(p));
  });
  legLabels.forEach(({ el }) => { el.innerHTML = `<b>${el.dataset.b}°</b>${el.dataset.d ? `${num(el.dataset.d)} ${t('m')}` : ''}`; });
  sliceLabels.forEach(({ d, el }) => { el.textContent = `${d} ${t('m')}`; });
}
fillLabels();
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
  return { x: ((isRTL() ? -1 : 1) * (panel.offsetWidth + 16)) / 2, y: 0 };
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
  const size = p.id === 'pier' ? 13 : p.id === 'tables3' ? 8 : Math.max(1, ...(p.dims.length ? p.dims : [3]));
  sph.radius = clamp(size * 4.2, 14, 54) * (isPhone() ? 1.15 : 1);
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
    let kind = t('kBranch');
    if (main) kind = forward ? t('kNext') : t('kPrev');
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
  if (p.dimsText) return esc(tx(p, 'dimsText'));
  if (!p.dims.length) return `<span class="muted">${p.live ? t('notRelevant') : t('notMeasuredPl')}</span>`;
  const [w, l, h] = p.dims;
  return t('dims', w, l, h);
}

function sketchSVG(p) {
  const Wd = 300, Hd = 180, pad = 30;
  if (p.shape === 'camera') {
    return `<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="${t('skCam')}"><g class="sk" transform="translate(110 40)"><rect x="0" y="20" width="62" height="40" rx="4"/><circle cx="31" cy="40" r="12"/><circle cx="31" cy="40" r="5"/><path d="M62 30l20-10v40l-20-10"/><path d="M31 60v40M31 100l-22 30M31 100l22 30"/></g></svg>`;
  }
  if (p.shape === 'pier') {
    return `<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="${t('skPier')}"><g transform="translate(40 40)"><path class="sk" d="M0 0H220M0 90H220"/><path class="sk-hid" d="M220 0V90"/><path class="sk-ground" d="M0 0V90" stroke-dasharray="1 4"/><path class="sk-dim" d="M190 6V84M184 12l6-6 6 6M184 78l6 6 6-6"/><text x="150" y="50" text-anchor="middle">9 ${t('m')}</text></g></svg>`;
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
    dims = [[A, C, `${t('skSide')} ${s}`, [-26, 10]], [B, top, `${t('skH')} ${h}`, [30, 0]]];
  } else if (p.shape === 'cylinder') {
    const [d, l] = p.dims;
    return `<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="${t('skCyl')}"><g transform="translate(60 50)"><ellipse class="sk" cx="170" cy="40" rx="18" ry="40"/><path class="sk" d="M10 0H170M10 80H170"/><path class="sk-hid" d="M10 0a18 40 0 0 0 0 80"/><path class="sk" d="M10 0a18 40 0 0 1 0 80"/><path class="sk-dim" d="M10 100H170"/><text x="90" y="118" text-anchor="middle">${t('skL')} ${l}</text><path class="sk-dim" d="M205 0V80"/><text x="212" y="44" text-anchor="start">${t('skDiam')} ${d}</text></g></svg>`;
  } else {
    const [w, l, h] = p.dims;
    const P = (x, y, z) => [x, y, z];
    const o = P(0, 0, 0), x1 = P(w, 0, 0), y1 = P(0, l, 0), xy = P(w, l, 0);
    const oz = P(0, 0, h), xz = P(w, 0, h), yz = P(0, l, h), xyz = P(w, l, h);
    corners = [o, x1, y1, xy, oz, xz, yz, xyz];
    edges = [[x1, xy], [y1, xy], [x1, xz], [y1, yz], [xy, xyz], [oz, xz], [oz, yz], [xz, xyz], [yz, xyz]];
    hidden = [[o, x1], [o, y1], [o, oz]];
    dims = [[y1, xy, `${t('skW')} ${w}`, [-26, 14]], [x1, xy, `${t('skL')} ${l}`, [26, 14]], [y1, yz, `${t('skH')} ${h}`, [-34, 4]]];
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
  return `<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="${t('skAria')}"><path class="sk-hid" d="${hidden.map((e) => seg(...e)).join('')}"/><path class="sk" d="${edges.map((e) => seg(...e)).join('')}"/>${dimMarks}</svg>`;
}

const thumb = (src) => src.replace(/\.jpg$/i, '-s.jpg');
function mediaHTML(p) {
  let html = '';
  if (p.live) {
    html += `<div class="p-media"><p class="live-tag">${t('live')}</p><div class="live"><iframe src="https://www.youtube-nocookie.com/embed/${LIVE_CAMERA_YOUTUBE_ID}?autoplay=1&mute=1&playsinline=1&rel=0" title="${t('liveTitle')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div><a class="live-link" href="https://www.youtube.com/watch?v=${LIVE_CAMERA_YOUTUBE_ID}" target="_blank" rel="noopener">${t('openYT')}</a></div>`;
  }
  if (p.photos && p.photos.length) {
    html += `<div class="p-media"><div class="gallery">${p.photos.map((ph, i) => `<button type="button" data-photo="${i}" aria-label="${t('photoAria', i + 1, p.photos.length)}"><img src="${esc(thumb(ph.src))}" alt="${esc(ph.caption || t('photoAlt', nm(p), i + 1))}" loading="lazy" decoding="async"></button>`).join('')}</div><p class="gallery-count">${t('photosCount', p.photos.length)}</p></div>`;
  } else if (!p.live && p.dims.length) {
    html += `<figure class="p-media sketch">${sketchSVG(p)}<p>${t('sketchNote')}</p></figure>`;
  }
  return html;
}

function renderPanel(p) {
  const kicker = p.live ? t('camKicker') : p.station ? t('station', p.station, MAIN.length) : t('side');
  const legs = edgesOf(p);
  const material = p.material ? esc(tx(p, 'material')) : `<span class="muted">${t('notRecorded')}</span>`;
  const est = p.estimated
    ? `<span class="est">${esc(t('est', p.derive.bearing, p.derive.dist, nm(byId[p.derive.from]), p.derive.rough))}</span>`
    : '';
  panelBody.innerHTML = `
    <header class="p-head">
      <div>
        <p class="p-kicker">${kicker}</p>
        <h2 class="p-title" id="pTitle"><svg class="x" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 3l12 12M15 3L3 15"/></svg>${esc(nm(p))}</h2>
      </div>
      <button type="button" class="icon-btn" id="pClose" aria-label="${t('close')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </header>
    ${mediaHTML(p)}
    <dl class="facts">
      <dt>${t('fDepth')}</dt><dd>${p.hasDepth ? `<span class="big">${p.depthText} ${t('m')}</span>` : `<span class="muted">${t('notMeasured')}</span>`}</dd>
      <dt>${t('fDims')}</dt><dd>${dimsText(p)}</dd>
      <dt>${t('fTerrain')}</dt><dd>${p.terrain ? esc(tx(p, 'terrain')) : `<span class="muted">${t('notRecorded')}</span>`}</dd>
      <dt>${t('fMaterial')}</dt><dd>${material}</dd>
      <dt>${t('fCoords')}</dt><dd><div class="coord"><span>${ddmText(p.latDec, true)}</span><span>${ddmText(p.lonDec, false)}</span></div><button type="button" class="copy" id="pCopy">${t('copy')}</button>${est}${p.measured ? `<span class="est">${esc(t('snapped', `${ddmText(p.measured.lat, true)} ${ddmText(p.measured.lon, false)}`))}</span>` : ''}</dd>
    </dl>
    ${p.note ? `<p class="p-note">${esc(tx(p, 'note'))}</p>` : ''}
    ${p.model && p.photos.length ? `<p class="p-note">${t('modelPhotos')}</p>` : ''}
    ${p.model && !p.photos.length ? `<p class="p-note">${t('modelGeneric')}</p>` : ''}
    ${legs.length ? `<section class="legs"><h3>${t('legsTitle')}</h3>${legs.map((l) => `
      <button type="button" class="leg-btn" data-go="${l.other.id}">
        ${bearingIcon(l.bearing)}
        <span class="lt"><b>${esc(nm(l.other))}</b><span>${t('legLine', l.kind, l.bearing, l.dist)}</span></span>
      </button>`).join('')}</section>` : ''}
  `;
  $('#pClose').addEventListener('click', closePanel);
  $('#pCopy').addEventListener('click', async (ev) => {
    const txt = `${p.latDec.toFixed(6)}, ${p.lonDec.toFixed(6)}`;
    try { await navigator.clipboard.writeText(txt); ev.target.textContent = t('copied'); }
    catch { ev.target.textContent = txt; }
  });
  panelBody.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => select(b.dataset.go)));
  panelBody.querySelectorAll('[data-photo]').forEach((b) => b.addEventListener('click', () => openPhoto(p.photos, +b.dataset.photo, nm(p))));
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
  if (!window.L) { $('#insetMap').innerHTML = `<p style="padding:12px;font-size:13px">${t('insetFail')}</p>`; return; }
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
    m.bindTooltip(nm(p), { direction: 'top', offset: [0, -10], className: 'ix-tip' });
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
  b.dataset.d = d;
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
  $('#meta').dataset.a = Math.min(...depths); $('#meta').dataset.b = Math.max(...depths);
}

/* ═════════════ theme ═════════════ */
const themeBtn = $('#themeToggle');
function syncThemeButton() {
  const dark = document.documentElement.dataset.theme === 'dark';
  themeBtn.setAttribute('aria-label', dark ? t('toLight') : t('toDark'));
  $('.tb-theme-label').textContent = dark ? t('themeLight') : t('themeDark');
}
function applyTheme() {
  T = readTheme();
  renderer?.setClearColor(T.paper);
  [bedMat, wallMat].forEach((m) => {
    m.uniforms.uT1.value.copy(T.t1); m.uniforms.uT2.value.copy(T.t2); m.uniforms.uT3.value.copy(T.t3); m.uniforms.uT4.value.copy(T.t4);
    m.uniforms.uInk.value.copy(T.ink); m.uniforms.uSlice.value.copy(T.slice); m.uniforms.uDark.value = T.dark ? 1 : 0;
    m.uniforms.uLand.value.copy(T.buff);
  });
  kit.setMode(kit.mode, T.clay);
  waterMat.uniforms.uDark.value = T.dark ? 1 : 0;
  if (scene.fog) scene.fog.color.copy(T.dark ? new THREE.Color('#0b2a3a') : new THREE.Color('#2a7090'));
  scene.traverse((o) => {
    if (o.userData.themeColor && o.material) o.material.color.copy(o.userData.themeColor === 'ink' ? T.ink : T.slice);
  });
  Object.values(slices).forEach((s) => (s.grp.children[0].material.opacity = T.dark ? 0.13 : 0.1));
  xMat.color.copy(T.magenta); xSelMat.color.copy(T.ink); plumbMat.color.copy(T.ink);
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

/* ═════════════ seabed simulation switch ═════════════ */
const simBtn = $('#simToggle');
let sim = false;
function setSim(on) {
  sim = on;
  [bedMat, wallMat].forEach((m) => (m.uniforms.uSim.value = on ? 1 : 0));
  kit.setMode(on ? 'sim' : 'chart', T.clay);
  if (on && !scatter) {
    scatter = buildScatter(kit, { ext, inSea, typeAt: mixAt, yAt, W });
    scene.add(scatter);
  }
  if (scatter) scatter.visible = on;
  water.visible = on;
  scene.fog = on ? new THREE.FogExp2(T.dark ? '#0b2a3a' : '#2a7090', 0.0016) : null;
  simBtn.setAttribute('aria-checked', String(on));
  try { localStorage.setItem('iui-sim', on ? '1' : '0'); } catch {}
}
simBtn.addEventListener('click', () => setSim(!sim));
try { if (localStorage.getItem('iui-sim') === '1') setSim(true); } catch {}

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
    scaleText.textContent = `${m} ${t('m')}`;
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
    const box = { x: isRTL() ? s.x - 26 - l.w : s.x + 26, y: s.y - l.h / 2, w: l.w, h: l.h };
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
  // a dialog covers the map: skip drawing until it closes
  if (deck.open || lb.open || qrDlg.open) { requestAnimationFrame(frame); return; }
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
  if (sim) {
    const t = reduceMotion ? 0 : now / 1000;
    bedMat.uniforms.uTime.value = t;
    waterMat.uniforms.uTime.value = t;
  }
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
// text-anchor that makes a label grow away from its point, in either reading direction
const growLeft = () => (isRTL() ? 'start' : 'end');

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
  const names = POINTS.filter((p) => p.station || p.live).map((p) => `<text class="f-name" x="${(X(p) - 9).toFixed(1)}" y="${(Y(p) + 4).toFixed(1)}" text-anchor="${growLeft()}">${esc(nm(p))}</text>`).join('');
  const scale = 20 * k;
  return `<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="${t('routeAria')}">${grid.join('')}${lines(BRANCHES, 'f-branch')}${lines(ROUTE, 'f-route')}${xs}${names}
    <g transform="translate(${Wd - 34} 40)"><path class="f-line" d="M0 18V-14M-5 -8L0 -16 5 -8"/><text x="0" y="32" text-anchor="middle">${t('north')}</text></g>
    <g transform="translate(30 ${Hd - 22})"><path class="f-line" d="M0 0H${scale.toFixed(1)}M0 -4V4M${scale.toFixed(1)} -4V4"/><text x="${(scale / 2).toFixed(1)}" y="-8" text-anchor="middle">20 ${t('m')}</text></g></svg>`;
}
function routeTable() {
  let lo = 0, hi = 0;
  const rows = ROUTE.map((l) => {
    const [a, b] = String(l.dist).split('–').map(Number);
    lo += a; hi += b || a;
    return `<tr><td>${esc(t('legTo', nm(byId[l.from]), nm(byId[l.to])))}</td><td>${l.bearing}°</td><td>${num(l.dist)}</td></tr>`;
  }).join('');
  const [h1, h2, h3] = t('legHead');
  return `<table class="legtable"><thead><tr><th>${h1}</th><th>${h2}</th><th>${h3}</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td>${t('routeLen')}</td><td></td><td>${num(lo === hi ? lo : `${lo}–${hi}`)}</td></tr></tfoot></table>`;
}
function profileFigure() {
  const Wd = 860, Hd = 360, L = 130, R = 30, Tt = 56, B = 34;
  let x = 0;
  const st = [{ p: byId[MAIN[0]], x: 0 }];
  ROUTE.forEach((l) => { x += dNum(l.dist); st.push({ p: byId[l.to], x }); });
  const maxX = x, maxD = 12;
  // the route starts on the reading-start side: right in Hebrew, left in English
  const left = isRTL() ? L : 64, right = isRTL() ? R : 112;
  const sx = (v) => (isRTL() ? Wd - right - (v / maxX) * (Wd - left - right) : left + (v / maxX) * (Wd - left - right));
  const sy = (d) => Tt + (d / maxD) * (Hd - Tt - B);
  const bed = st.map((s) => `${sx(s.x).toFixed(1)},${sy(s.p.depthMid).toFixed(1)}`).join(' ');
  const poly = `${sx(0)},${Hd - B} ${bed} ${sx(maxX)},${Hd - B}`;
  const labX = isRTL() ? left - 6 : Wd - right + 6;
  const labA = isRTL() ? 'start' : 'start';
  const slicesSvg = SITE.slices.map((d) => `<path class="f-slice" d="M${left} ${sy(d)}H${Wd - right}"/><text class="f-slice-t" x="${labX}" y="${sy(d) + 4}" text-anchor="${labA}">${d} ${t('m')}</text>`).join('');
  const ranges = st.filter((s) => s.p.depth.length > 1).map((s) => `<path class="f-line" d="M${sx(s.x)} ${sy(s.p.depth[0])}V${sy(s.p.depth[1])}" stroke-width="3" opacity=".35"/>`).join('');
  const xs = st.map((s, i) => {
    const X = sx(s.x), Y = sy(s.p.depthMid);
    const up = i % 2 === 0;
    return `<path class="f-x" d="M${X - 5} ${Y - 5}l10 10m0-10l-10 10"/><path class="f-grid" d="M${X} ${Tt - 6}V${Y - 8}"/><text class="f-name" x="${X}" y="${up ? Tt - 12 : Tt - 30}" text-anchor="middle">${esc(nm(s.p))}</text>`;
  }).join('');
  const ticks = [0, 50, 100, 150, 200].filter((v) => v <= maxX).map((v) => `<text x="${sx(v)}" y="${Hd - 12}" text-anchor="middle">${v}</text>`).join('');
  return `<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="${t('profileAria')}">
    <rect class="f-water" x="${left}" y="${Tt}" width="${Wd - left - right}" height="${Hd - Tt - B}"/>
    <polygon class="f-bed" points="${poly}"/>${slicesSvg}${ranges}${xs}${ticks}
    <text x="${labX}" y="${Hd - 12}" text-anchor="${labA}">${t('profileAxis')}</text></svg>`;
}
function bandsHTML() {
  const bands = [[0, 3], [3, 6], [6, 9], [9, 99]];
  return `<div class="bands">${bands.map(([a, b]) => {
    const pts = POINTS.filter((p) => p.hasDepth && p.depthMid >= a && p.depthMid < b);
    return `<section><h3>${b === 99 ? t('bandDeep', a) : `${num(`${a}–${b}`)} ${t('m')}`}</h3><ul>${pts.length ? pts.map((p) => `<li>${esc(nm(p))} <span class="muted">(${p.depthText})</span></li>`).join('') : `<li class="none">${t('noPoints')}</li>`}</ul></section>`;
  }).join('')}</div>`;
}
function fig(s, wide) {
  return `<figure class="slide-fig${wide ? ' slide-fig-wide' : ''}"><img src="${esc(s.image)}" alt="${esc(s.caption || s.title)}" loading="lazy">${s.caption ? `<figcaption>${esc(s.caption)}</figcaption>` : ''}</figure>`;
}
function slideHTML(s) {
  let body = '';
  if (s.type === 'text') {
    const text =
      (s.lead ? `<p class="lead">${esc(s.lead)}</p>` : '') +
      (s.bullets ? `<ul class="bullets">${s.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : '') +
      (s.list ? `<dl class="method">${s.list.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>` : '') +
      (s.stats ? `<div class="stats">${s.stats.map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>` : '');
    body = s.image ? `<div class="slide-cols slide-photo"><div>${text}</div>${fig(s)}</div>` : text;
  } else if (s.type === 'groups') {
    body = (s.lead ? `<p class="lead">${esc(s.lead)}</p>` : '') +
      `<div class="groups">${s.groups.map((g) => `<section class="group"><h3>${esc(g.title)}</h3><p>${esc(g.sub)}</p><ul class="people">${g.members.map((m) => `<li><b>${esc(m)}</b></li>`).join('')}</ul></section>`).join('')}</div>`;
  } else if (s.type === 'image') {
    body = fig(s, true);
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
  const d = DECKS[LANG][deckState.key];
  deckState.i = clamp(i, 0, d.slides.length - 1);
  $('#deckName').textContent = d.title;
  $('#deckBody').innerHTML = slideHTML(d.slides[deckState.i]);
  $('#deckBody').scrollTop = 0;
  $('#deckCount').textContent = `${deckState.i + 1} / ${d.slides.length}`;
  $('#deckPrev').disabled = deckState.i === 0;
  $('#deckNext').disabled = deckState.i === d.slides.length - 1;
  $('.deck-foot').style.visibility = d.slides.length > 1 ? 'visible' : 'hidden';
}
let deckOpener = null;
function openDeck(key, opener) {
  deckOpener = opener;
  deckState = { key, i: 0 };
  showSlide(0);
  deck.showModal();
}
document.querySelectorAll('[data-deck]').forEach((b) => b.addEventListener('click', () => openDeck(b.dataset.deck, b)));
$('#deckClose').addEventListener('click', () => deck.close());
$('#deckPrev').addEventListener('click', () => showSlide(deckState.i - 1));
$('#deckNext').addEventListener('click', () => showSlide(deckState.i + 1));
deck.addEventListener('close', () => deckOpener?.focus());
deck.addEventListener('click', (e) => { if (e.target === deck) deck.close(); });
// "next" lies in the reading direction: left in Hebrew, right in English
const nextKey = () => (isRTL() ? 'ArrowLeft' : 'ArrowRight');
const prevKey = () => (isRTL() ? 'ArrowRight' : 'ArrowLeft');
deck.addEventListener('keydown', (e) => {
  if (e.key === nextKey()) { e.preventDefault(); showSlide(deckState.i + 1); }
  if (e.key === prevKey()) { e.preventDefault(); showSlide(deckState.i - 1); }
});
{
  let sx0 = null, sy0 = null;
  deck.addEventListener('touchstart', (e) => { sx0 = e.touches[0].clientX; sy0 = e.touches[0].clientY; }, { passive: true });
  deck.addEventListener('touchend', (e) => {
    if (sx0 === null) return;
    const dx = e.changedTouches[0].clientX - sx0, dy = e.changedTouches[0].clientY - sy0;
    sx0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) showSlide(deckState.i + ((dx > 0) === isRTL() ? 1 : -1));
  });
}

/* ═════════════ QR code ═════════════ */
const SITE_URL = 'https://royborkin.github.io/IUIMap/';
const qrDlg = $('#qrDialog');
let qrOpener = null;
$('#qrBtn').addEventListener('click', (e) => {
  qrOpener = e.currentTarget;
  if (!$('#qrCode').firstChild) $('#qrCode').innerHTML = qrSVG(SITE_URL);
  $('#qrCode svg').setAttribute('aria-label', SITE_URL);
  $('#qrCopy').textContent = t('qrCopy');
  qrDlg.showModal();
});
$('#qrClose').addEventListener('click', () => qrDlg.close());
qrDlg.addEventListener('click', (e) => { if (e.target === qrDlg) qrDlg.close(); });
qrDlg.addEventListener('close', () => qrOpener?.focus());
$('#qrCopy').addEventListener('click', async (e) => {
  try { await navigator.clipboard.writeText(SITE_URL); e.target.textContent = t('qrCopied'); } catch {}
});

/* lightbox with previous / next */
const lb = $('#lightbox');
let lbSet = null;
function showPhoto(k) {
  const { list, name } = lbSet;
  lbSet.i = (k + list.length) % list.length;
  const ph = list[lbSet.i];
  $('#lbImg').src = ph.src;
  $('#lbImg').alt = ph.caption || t('photoAlt', name, lbSet.i + 1);
  $('#lbCap').textContent = `${ph.caption ? ph.caption + '. ' : ''}${t('photoOf', name, lbSet.i + 1, list.length)}`;
  $('#lbPrev').hidden = $('#lbNext').hidden = list.length < 2;
}
function openPhoto(list, i = 0, name = '') {
  if (!Array.isArray(list)) list = [list];
  lbSet = { list, name, i };
  showPhoto(i);
  lb.showModal();
}
$('#lbClose').addEventListener('click', () => lb.close());
$('#lbPrev').addEventListener('click', () => showPhoto(lbSet.i - 1));
$('#lbNext').addEventListener('click', () => showPhoto(lbSet.i + 1));
lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
lb.addEventListener('keydown', (e) => {
  if (e.key === nextKey()) { e.preventDefault(); showPhoto(lbSet.i + 1); }
  if (e.key === prevKey()) { e.preventDefault(); showPhoto(lbSet.i - 1); }
});
{
  let x0 = null;
  lb.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) showPhoto(lbSet.i + ((dx > 0) === isRTL() ? 1 : -1));
  });
}

/* keyboard */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !deck.open && !lb.open) closePanel();
});

/* ═════════════ language ═════════════ */
function applyLang() {
  const html = document.documentElement;
  html.lang = LANG;
  html.dir = isRTL() ? 'rtl' : 'ltr';
  document.title = t('docTitle');
  document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  document.querySelectorAll('[data-i18n-title]').forEach((el) => (el.title = t(el.dataset.i18nTitle)));
  $('#langToggle').lang = isRTL() ? 'en' : 'he';
  const meta = $('#meta');
  meta.textContent = t('meta', POINTS.length, meta.dataset.a, meta.dataset.b, EX);
  chipsEl.querySelectorAll('.chip').forEach((b) => {
    b.textContent = `${b.dataset.d} ${t('m')}`;
    b.setAttribute('aria-label', t('sliceAria', b.dataset.d));
  });
  syncThemeButton();
  fillLabels();
  measureLabels();
  Object.entries(mapMarkers).forEach(([id, m]) => m.setTooltipContent(nm(byId[id])));
  lastScale = '';
  $('#qrCopy').textContent = t('qrCopy');
  if (deck.open && deckState) showSlide(deckState.i);
  if (selected) {
    renderPanel(selected);
    const o = panelOffset(true);
    viewOff.tx = o.x; viewOff.ty = o.y;
    fly(controls.target.clone(), camera.position.clone(), 500);
  }
}
$('#langToggle').addEventListener('click', () => {
  LANG = isRTL() ? 'en' : 'he';
  try { localStorage.setItem('iui-lang', LANG); } catch {}
  applyLang();
});
applyLang();

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
window.__iui = { POINTS, select, resetView, camera, controls, fit, seabed };
