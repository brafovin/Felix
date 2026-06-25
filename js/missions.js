import * as THREE from 'three';
import { NPC } from './npc.js';
import { dist2D } from './utils.js';

// Marker-Säule (Lichtsäule) in der Welt
function makeMarker(scene, x, z, color) {
  const g = new THREE.Group();
  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 4, 30, 16, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  cyl.position.y = 15; g.add(cyl);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.4, 4.4, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.2; g.add(ring);
  g.position.set(x, 0, z);
  scene.add(g);
  return g;
}

const MISSION_DEFS = [
  {
    id: 'patrol', x: 430, z: -120,
    title: 'Strand-Treffpunkt',
    brief: 'Erreiche den Treffpunkt an der Strandpromenade.',
    reward: 800,
    type: 'reach', goalX: 430, goalZ: 220,
  },
  {
    id: 'gang', x: 300, z: 300,
    title: 'Revierkampf',
    brief: 'Schalte die 4 feindlichen Gangmitglieder aus.',
    reward: 1500,
    type: 'eliminate', count: 4, around: [300, 300],
  },
  {
    id: 'delivery', x: -300, z: -300,
    title: 'Heiße Lieferung',
    brief: 'Steig in ein Auto und liefere es zur Werft im Norden ab.',
    reward: 1200,
    type: 'deliver', goalX: -300, goalZ: 360, needCar: true,
  },
];

export class MissionManager {
  constructor(scene) {
    this.scene = scene;
    this.defs = MISSION_DEFS;
    this.markers = {};
    this.goalMarker = null;
    this.active = null;
    this.completedIds = new Set();
    this.spawned = [];      // mission-spezifische NPCs

    for (const m of this.defs) {
      this.markers[m.id] = makeMarker(scene, m.x, m.z, 0xff8a2b);
    }
  }

  // Welche Mission ist in Reichweite (für E-Prompt)?
  nearbyMission(px, pz) {
    if (this.active) return null;
    for (const m of this.defs) {
      if (this.completedIds.has(m.id)) continue;
      if (dist2D(px, pz, m.x, m.z) < 10) return m;
    }
    return null;
  }

  start(m, hud) {
    this.active = { ...m, progress: 0 };
    this.markers[m.id].visible = false;
    hud.toast(`Mission gestartet: ${m.title}`);

    if (m.type === 'reach' || m.type === 'deliver') {
      this.goalMarker = makeMarker(this.scene, m.goalX, m.goalZ, 0x28e0c8);
    }
    if (m.type === 'eliminate') {
      for (let i = 0; i < m.count; i++) {
        const ang = (i / m.count) * Math.PI * 2;
        const npc = new NPC(this.scene, m.around[0] + Math.cos(ang) * 18, m.around[1] + Math.sin(ang) * 18, true);
        this.spawned.push(npc);
      }
    }
  }

  // Liefert lebende Missions-NPCs (für Update/Schuss-Logik)
  get enemies() { return this.spawned; }

  update(player, inVehicle, hud, onComplete) {
    const a = this.active;
    if (!a) return;

    if (a.type === 'reach') {
      if (dist2D(player.pos.x, player.pos.z, a.goalX, a.goalZ) < 8) this.complete(hud, onComplete);
    } else if (a.type === 'deliver') {
      if (!inVehicle) { a.desc = 'Du brauchst ein Auto!'; }
      else if (dist2D(player.pos.x, player.pos.z, a.goalX, a.goalZ) < 12) this.complete(hud, onComplete);
    } else if (a.type === 'eliminate') {
      const left = this.spawned.filter(n => !n.dead).length;
      a.progress = a.count - left;
      if (left === 0) this.complete(hud, onComplete);
    }
  }

  complete(hud, onComplete) {
    const a = this.active;
    this.completedIds.add(a.id);
    hud.toast(`✅ Mission abgeschlossen!  +$${a.reward}`);
    if (this.goalMarker) { this.scene.remove(this.goalMarker); this.goalMarker = null; }
    onComplete(a.reward);
    this.active = null;
  }

  // Text für HUD
  hudTitle() { return this.active ? this.active.title : 'Freies Spiel'; }
  hudDesc(inVehicle) {
    const a = this.active;
    if (!a) return 'Erkunde Liberty Shores. Orange = Mission, Gelb = Tuning-Garage.';
    if (a.type === 'eliminate') return `${a.brief}  (${a.progress}/${a.count})`;
    if (a.type === 'deliver' && !inVehicle) return 'Steig in ein Auto und fahr zum türkisen Marker.';
    return a.brief;
  }

  animate(t) {
    for (const id in this.markers) {
      if (this.markers[id].visible) this.markers[id].rotation.y = t;
    }
    if (this.goalMarker) this.goalMarker.rotation.y = -t;
  }
}
