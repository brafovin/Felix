import * as THREE from 'three';
import { rand, randInt, pick } from './utils.js';

// Welt-Konstanten
export const WORLD = 800;          // halbe Kartengröße (Welt ist 1600x1600)
export const BEACH_X = 470;        // ab hier beginnt der Strand (Osten)
export const WATER_X = 560;        // ab hier Wasser

// Sammelt feste Kollisionsboxen (Gebäude) als {min,max}
export const colliders = [];
// Begehbare Gebäude-Eingänge / Marker
export const buildings = [];

export function buildWorld(scene) {
  // ---------- Himmel ----------
  scene.background = new THREE.Color(0x9ecbe0);
  scene.fog = new THREE.Fog(0x9ecbe0, 350, 1100);

  // ---------- Licht ----------
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x4a5a40, 0.7);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2d6, 1.5);
  sun.position.set(300, 500, 200);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = 600;
  sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
  sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
  sun.shadow.camera.far = 1400;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  // ---------- Boden (Gras / Land) ----------
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x4f7a43, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD * 2, WORLD * 2), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------- Strand ----------
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xe8d6a0, roughness: 1 });
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(260, WORLD * 2), sandMat);
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(BEACH_X + 60, 0.02, 0);
  beach.receiveShadow = true;
  scene.add(beach);

  // ---------- Wasser ----------
  const water = createWater(scene);

  // ---------- Straßennetz ----------
  buildRoads(scene);

  // ---------- Stadt: Gebäude ----------
  buildCity(scene);

  // ---------- Strandpromenade & Palmen ----------
  decorateBeach(scene);

  // ---------- Park & Bäume ----------
  scatterTrees(scene);

  // ---------- Spezial-Gebäude (begehbar) ----------
  createGarageBuilding(scene);

  return { water, sun };
}

// ---------------------------------------------------------------- Wasser
function createWater(scene) {
  const geo = new THREE.PlaneGeometry(900, WORLD * 2, 80, 160);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x1f7fb0, transparent: true, opacity: 0.86,
    roughness: 0.15, metalness: 0.4,
  });
  const water = new THREE.Mesh(geo, mat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(WATER_X + 400, -0.4, 0);
  water.receiveShadow = false;
  scene.add(water);

  // Original-Z für Wellen merken
  water.userData.base = geo.attributes.position.array.slice();
  return water;
}

export function animateWater(water, t) {
  const pos = water.geometry.attributes.position;
  const base = water.userData.base;
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3], y = base[i * 3 + 1];
    pos.array[i * 3 + 2] = Math.sin(x * 0.02 + t * 1.4) * 1.1 + Math.cos(y * 0.03 + t) * 0.8;
  }
  pos.needsUpdate = true;
  water.geometry.computeVertexNormals();
}

// ---------------------------------------------------------------- Straßen
function buildRoads(scene) {
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.95 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xf2d23a, roughness: 1 });

  // Raster aus Straßen
  const lines = [-300, -150, 0, 150, 300];
  for (const x of lines) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(16, WORLD * 2), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(x, 0.03, 0); r.receiveShadow = true;
    scene.add(r);
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.6, WORLD * 2), lineMat);
    l.rotation.x = -Math.PI / 2; l.position.set(x, 0.05, 0);
    scene.add(l);
  }
  for (const z of lines) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(WORLD * 2, 16), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(0, 0.03, z); r.receiveShadow = true;
    scene.add(r);
    const l = new THREE.Mesh(new THREE.PlaneGeometry(WORLD * 2, 0.6), lineMat);
    l.rotation.x = -Math.PI / 2; l.position.set(0, 0.05, z);
    scene.add(l);
  }

  // Küstenstraße
  const coast = new THREE.Mesh(new THREE.PlaneGeometry(14, WORLD * 2), roadMat);
  coast.rotation.x = -Math.PI / 2; coast.position.set(BEACH_X - 40, 0.03, 0); coast.receiveShadow = true;
  scene.add(coast);
}

// ---------------------------------------------------------------- Stadt
const BUILDING_COLORS = [0x8a8f99, 0x6f7682, 0x9aa0ab, 0xb0683f, 0x556070, 0x7d8a73, 0xc4b48a];

function buildCity(scene) {
  // Häuserblöcke zwischen den Straßen
  const blocks = [];
  const grid = [-300, -150, 0, 150, 300];
  for (let i = 0; i < grid.length - 1; i++) {
    for (let j = 0; j < grid.length - 1; j++) {
      blocks.push({ cx: (grid[i] + grid[i + 1]) / 2, cz: (grid[j] + grid[j + 1]) / 2 });
    }
  }

  for (const b of blocks) {
    const count = randInt(2, 4);
    for (let k = 0; k < count; k++) {
      const w = rand(22, 46), d = rand(22, 46), h = rand(20, 90);
      const x = b.cx + rand(-30, 30), z = b.cz + rand(-30, 30);
      addBuilding(scene, x, z, w, d, h);
    }
  }
}

function addBuilding(scene, x, z, w, d, h, color) {
  const mat = new THREE.MeshStandardMaterial({
    color: color ?? pick(BUILDING_COLORS), roughness: 0.85, metalness: 0.05,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Fenster (gemustertes Emissions-Overlay vorne und hinten)
  addWindows(mesh, w, h, d);

  // Kollisionsbox
  colliders.push({
    min: new THREE.Vector2(x - w / 2, z - d / 2),
    max: new THREE.Vector2(x + w / 2, z + d / 2),
  });
  return mesh;
}

function addWindows(building, w, h, d) {
  const rows = Math.floor(h / 8);
  const cols = Math.floor(w / 8);
  const winGeo = new THREE.PlaneGeometry(3, 4);
  const lit = new THREE.MeshStandardMaterial({ color: 0x223, emissive: 0xffd98a, emissiveIntensity: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x10151c, emissive: 0x000, roughness: 1 });
  const inst = [];
  for (let r = 1; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const mat = Math.random() > 0.55 ? lit : dark;
      const win = new THREE.Mesh(winGeo, mat);
      win.position.set(-w / 2 + 5 + c * 8, -h / 2 + r * 8, d / 2 + 0.06);
      building.add(win);
      const back = win.clone(); back.position.z = -d / 2 - 0.06; back.rotation.y = Math.PI;
      building.add(back);
    }
  }
}

// ---------------------------------------------------------------- Begehbare Garage
function createGarageBuilding(scene) {
  const x = -150, z = 230;
  const w = 60, d = 50, h = 16;
  // Boden
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x33373d, roughness: 1 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(x, 0.06, z); floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2c333a, roughness: 0.9, side: THREE.DoubleSide });
  // Drei Wände (vorne offen Richtung Süden = +z)
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.5), wallMat);
  back.position.set(x, h / 2, z - d / 2); back.castShadow = true; scene.add(back);
  const left = new THREE.Mesh(new THREE.BoxGeometry(1.5, h, d), wallMat);
  left.position.set(x - w / 2, h / 2, z); left.castShadow = true; scene.add(left);
  const right = new THREE.Mesh(new THREE.BoxGeometry(1.5, h, d), wallMat);
  right.position.set(x + w / 2, h / 2, z); right.castShadow = true; scene.add(right);
  // Dach
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w, 1.5, d), wallMat);
  roof.position.set(x, h, z); roof.castShadow = true; scene.add(roof);

  // Leuchtschild
  const signMat = new THREE.MeshStandardMaterial({ color: 0x111, emissive: 0xffcf3f, emissiveIntensity: 1.2 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(30, 6, 2), signMat);
  sign.position.set(x, h + 5, z + d / 2); scene.add(sign);

  const glow = new THREE.PointLight(0xffcf3f, 2, 80);
  glow.position.set(x, h - 2, z); scene.add(glow);

  // Kollision nur für die Rückwand-Seiten (nicht den Innenraum)
  colliders.push({ min: new THREE.Vector2(x - w / 2 - 1, z - d / 2 - 1), max: new THREE.Vector2(x + w / 2 + 1, z - d / 2 + 1) });

  buildings.push({ type: 'garage', x, z: z + 6, radius: 10 });
}

// ---------------------------------------------------------------- Strand-Deko
function decorateBeach(scene) {
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f9e54, roughness: 1 });
  for (let i = 0; i < 40; i++) {
    const x = rand(BEACH_X - 10, BEACH_X + 110);
    const z = rand(-WORLD + 40, WORLD - 40);
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, rand(10, 16), 6), trunkMat);
    trunk.position.y = trunk.geometry.parameters.height / 2;
    trunk.castShadow = true; palm.add(trunk);
    for (let l = 0; l < 6; l++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(2.2, 9, 4), leafMat);
      leaf.position.y = trunk.geometry.parameters.height;
      leaf.rotation.z = Math.PI / 2.4;
      leaf.rotation.y = (l / 6) * Math.PI * 2;
      leaf.translateY(4);
      leaf.castShadow = true; palm.add(leaf);
    }
    palm.position.set(x, 0, z);
    scene.add(palm);
  }
  // Sonnenschirme
  for (let i = 0; i < 14; i++) {
    const umbrella = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 6), trunkMat);
    pole.position.y = 3; umbrella.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(4, 2, 10),
      new THREE.MeshStandardMaterial({ color: pick([0xff5f6d, 0x2ec4f1, 0xffd23f]) }));
    top.position.y = 6.5; top.castShadow = true; umbrella.add(top);
    umbrella.position.set(rand(BEACH_X + 30, BEACH_X + 130), 0, rand(-WORLD + 60, WORLD - 60));
    scene.add(umbrella);
  }
}

// ---------------------------------------------------------------- Bäume
function scatterTrees(scene) {
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b3d22, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x35803f, roughness: 1 });
  for (let i = 0; i < 120; i++) {
    const x = rand(-WORLD + 50, 380);
    const z = rand(-WORLD + 50, WORLD - 50);
    // Nicht auf Straßen
    if (isOnRoad(x, z)) continue;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 6), trunkMat);
    trunk.position.y = 3; trunk.castShadow = true; tree.add(trunk);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(4, 6), 0), leafMat);
    crown.position.y = 8; crown.castShadow = true; tree.add(crown);
    tree.position.set(x, 0, z);
    scene.add(tree);
  }
}

function isOnRoad(x, z) {
  const lines = [-300, -150, 0, 150, 300];
  for (const g of lines) {
    if (Math.abs(x - g) < 12 || Math.abs(z - g) < 12) return true;
  }
  return false;
}

// ---------------------------------------------------------------- Kollision
// Schiebt eine Position aus Gebäuden heraus (mit Radius r). Gibt korrigierte {x,z} zurück.
export function resolveCollision(x, z, r) {
  for (const c of colliders) {
    if (x > c.min.x - r && x < c.max.x + r && z > c.min.y - r && z < c.max.y + r) {
      // Wie weit muss in jede Richtung geschoben werden?
      const pushLeft = (x) - (c.min.x - r);
      const pushRight = (c.max.x + r) - x;
      const pushUp = (z) - (c.min.y - r);
      const pushDown = (c.max.y + r) - z;
      const m = Math.min(pushLeft, pushRight, pushUp, pushDown);
      if (m === pushLeft) x = c.min.x - r;
      else if (m === pushRight) x = c.max.x + r;
      else if (m === pushUp) z = c.min.y - r;
      else z = c.max.y + r;
    }
  }
  return { x, z };
}

export function inWater(x) {
  return x > WATER_X;
}
