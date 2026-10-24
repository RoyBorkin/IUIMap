// ─────────────────────────────────────────────────────────────
//  Coral colonies from the Smithsonian 3D Digitization program (CC0).
//  Each specimen (~100k triangles) is loaded once and simplified in the browser
//  with meshoptimizer (quadric simplification, keeps the shape and texture),
//  into two levels of detail:
//    near — a few thousand triangles, for colonies close to the camera
//    far  — about a thousand triangles, for everything else
//  The reef is split into tiles; each tile switches between the two levels by
//  its distance to the camera, and tiles outside the view are skipped.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptSimplifier } from '../vendor/meshopt/meshopt_simplifier.module.js';

let loader = null;
function getLoader() {
  if (loader) return loader;
  const draco = new DRACOLoader();
  draco.setDecoderPath(new URL('../vendor/three/addons/libs/draco/gltf/', import.meta.url).href);
  loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  return loader;
}

function lod(geo, triangles) {
  const idx = new Uint32Array(geo.index.array);
  const target = Math.min(idx.length, Math.floor(triangles) * 3);
  const pos = new Float32Array(geo.attributes.position.array);
  const [out] = MeshoptSimplifier.simplify(idx, pos, 3, target, 0.08, ['LockBorder']);
  const g = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) if (geo.attributes[name]) g.setAttribute(name, geo.attributes[name]);
  g.setIndex(new THREE.BufferAttribute(out, 1));
  if (!geo.attributes.normal) g.computeVertexNormals();
  return g;
}

/* load one specimen, normalised to sit on y = 0 and be 1 m wide, in two levels of detail */
async function loadSpecimen(spec, quality) {
  const gltf = await getLoader().loadAsync(spec.url);
  let mesh = null;
  gltf.scene.traverse((o) => { if (!mesh && o.isMesh) mesh = o; });
  if (!mesh) throw new Error('no mesh');
  mesh.updateWorldMatrix(true, false);
  let geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  if (!geo.index) geo.setIndex([...Array(geo.attributes.position.count).keys()]);
  geo.computeBoundingBox();
  const bb = geo.boundingBox, size = new THREE.Vector3(), c = new THREE.Vector3();
  bb.getSize(size); bb.getCenter(c);
  const w = Math.max(size.x, size.z) || 1;
  geo.translate(-c.x, -bb.min.y, -c.z);
  geo.scale(1 / w, 1 / w, 1 / w);
  await MeshoptSimplifier.ready;
  const near = lod(geo, spec.near * quality);
  const far = lod(geo, spec.far * quality);
  const map = mesh.material && mesh.material.map ? mesh.material.map : null;
  if (map) { map.anisotropy = 4; }
  const material = new THREE.MeshLambertMaterial({ map, color: 0xffffff });
  return { near, far, material };
}

/**
 * Load the specimens and scatter them as instances.
 * places: [{ x, y, z, size, rot, tint, kind }] in world units (y is the ground height);
 * kind is the index of the specimen to use.
 * Returns a THREE.Group with userData.update(camera) to switch levels of detail.
 */
export function coralReef(specs, places, { onStatus, quality = 1, tile = 14, nearDist = 40 } = {}) {
  const group = new THREE.Group();
  const tiles = new Map();
  let done = 0, failed = 0;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color(), v = new THREE.Vector3();

  specs.forEach((spec, si) => {
    const mine = places.filter((p) => p.kind === si);
    // group this specimen's colonies by tile
    const byTile = new Map();
    mine.forEach((p) => {
      const key = `${Math.floor(p.x / tile)},${Math.floor(p.z / tile)}`;
      if (!byTile.has(key)) byTile.set(key, []);
      byTile.get(key).push(p);
    });
    loadSpecimen(spec, quality).then((sp) => {
      byTile.forEach((list, key) => {
        const make = (geo) => {
          const im = new THREE.InstancedMesh(geo, sp.material, list.length);
          list.forEach((p, i) => {
            const s = p.size * spec.size;
            q.setFromEuler(e.set(0, p.rot, 0));
            m.compose(v.set(p.x, p.y - s * 0.04, p.z), q, new THREE.Vector3(s, s * p.squash, s));
            im.setMatrixAt(i, m);
            im.setColorAt(i, col.set(p.tint).multiplyScalar(spec.bright || 1));
          });
          im.instanceMatrix.needsUpdate = true;
          im.computeBoundingSphere();
          group.add(im);
          return im;
        };
        const near = make(sp.near), far = make(sp.far);
        near.visible = false;
        if (!tiles.has(key)) {
          const [tx, tz] = key.split(',').map(Number);
          tiles.set(key, { center: new THREE.Vector3((tx + 0.5) * tile, list[0].y, (tz + 0.5) * tile), meshes: [] });
        }
        tiles.get(key).meshes.push({ near, far });
      });
    }).catch(() => { failed++; }).finally(() => {
      done++;
      onStatus && onStatus({ done, failed, total: specs.length });
    });
  });

  group.userData.update = (camera) => {
    tiles.forEach((t) => {
      const close = camera.position.distanceTo(t.center) < nearDist;
      t.meshes.forEach((p) => { p.near.visible = close; p.far.visible = !close; });
    });
  };
  return group;
}
