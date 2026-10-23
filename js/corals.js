// ─────────────────────────────────────────────────────────────
//  Coral colonies from the Smithsonian 3D Digitization program (CC0).
//  Each specimen (~100k triangles) is loaded once, simplified in the browser
//  by vertex clustering to a few thousand triangles, and reused as instances
//  across the reef areas.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

let loader = null;
function getLoader() {
  if (loader) return loader;
  const draco = new DRACOLoader();
  draco.setDecoderPath(new URL('../vendor/three/addons/libs/draco/gltf/', import.meta.url).href);
  loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  return loader;
}

/* vertex clustering: snap vertices to a grid, keep one vertex per cell, drop collapsed triangles */
function simplify(src, cells = 38) {
  const g = src.index ? src : src.toNonIndexed();
  const pos = g.attributes.position, uv = g.attributes.uv;
  g.computeBoundingBox();
  const bb = g.boundingBox, size = new THREE.Vector3();
  bb.getSize(size);
  const cell = Math.max(size.x, size.y, size.z) / cells;
  const keyOf = (i) => `${Math.floor((pos.getX(i) - bb.min.x) / cell)},${Math.floor((pos.getY(i) - bb.min.y) / cell)},${Math.floor((pos.getZ(i) - bb.min.z) / cell)}`;
  const map = new Map(), rep = [];
  const remap = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const k = keyOf(i);
    let id = map.get(k);
    if (id === undefined) { id = rep.length; map.set(k, id); rep.push(i); }
    remap[i] = id;
  }
  const idx = g.index ? g.index.array : null;
  const tris = [];
  const triCount = (idx ? idx.length : pos.count) / 3;
  const seen = new Set();
  for (let t = 0; t < triCount; t++) {
    const a = remap[idx ? idx[t * 3] : t * 3], b = remap[idx ? idx[t * 3 + 1] : t * 3 + 1], c = remap[idx ? idx[t * 3 + 2] : t * 3 + 2];
    if (a === b || b === c || a === c) continue;
    const key = [a, b, c].sort((x, y) => x - y).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    tris.push(a, b, c);
  }
  const out = new THREE.BufferGeometry();
  const p = new Float32Array(rep.length * 3), u = uv ? new Float32Array(rep.length * 2) : null;
  rep.forEach((i, k) => {
    p[k * 3] = pos.getX(i); p[k * 3 + 1] = pos.getY(i); p[k * 3 + 2] = pos.getZ(i);
    if (u) { u[k * 2] = uv.getX(i); u[k * 2 + 1] = uv.getY(i); }
  });
  out.setAttribute('position', new THREE.BufferAttribute(p, 3));
  if (u) out.setAttribute('uv', new THREE.BufferAttribute(u, 2));
  out.setIndex(tris);
  out.computeVertexNormals();
  return out;
}

/* load one specimen and return { geometry, material, base } normalised so it sits on y = 0 and is 1 m wide */
async function loadSpecimen(spec, cells) {
  const gltf = await getLoader().loadAsync(spec.url);
  let mesh = null;
  gltf.scene.traverse((o) => { if (!mesh && o.isMesh) mesh = o; });
  if (!mesh) throw new Error('no mesh');
  mesh.updateWorldMatrix(true, false);
  const geo = simplify(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld), cells);
  geo.computeBoundingBox();
  const bb = geo.boundingBox, size = new THREE.Vector3(), c = new THREE.Vector3();
  bb.getSize(size); bb.getCenter(c);
  const w = Math.max(size.x, size.z) || 1;
  geo.translate(-c.x, -bb.min.y, -c.z);
  geo.scale(1 / w, 1 / w, 1 / w);
  const map = mesh.material && mesh.material.map ? mesh.material.map : null;
  const material = new THREE.MeshLambertMaterial({ map, color: 0xffffff });
  return { geometry: geo, material, name: spec.name };
}

/**
 * Load the specimens and scatter them as instances.
 * places: [{ x, y, z, size, rot, tint }] in world units (y is the ground height).
 * Returns a THREE.Group, filled as each specimen arrives.
 */
export function coralReef(specs, places, { onStatus, cells = 20 } = {}) {
  const group = new THREE.Group();
  let done = 0, failed = 0;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
  specs.forEach((spec, si) => {
    const mine = places.filter((_, i) => i % specs.length === si);
    loadSpecimen(spec, cells).then((sp) => {
      const im = new THREE.InstancedMesh(sp.geometry, sp.material, mine.length);
      mine.forEach((pl, i) => {
        const s = pl.size * (spec.size / 0.8);
        q.setFromEuler(e.set(0, pl.rot, 0));
        m.compose(new THREE.Vector3(pl.x, pl.y - s * 0.05, pl.z), q, new THREE.Vector3(s, s * (0.8 + 0.4 * ((i * 37) % 10) / 10), s));
        im.setMatrixAt(i, m);
        im.setColorAt(i, col.set(pl.tint));
      });
      im.instanceMatrix.needsUpdate = true;
      group.add(im);
    }).catch(() => { failed++; }).finally(() => {
      done++;
      onStatus && onStatus({ done, failed, total: specs.length });
    });
  });
  return group;
}
