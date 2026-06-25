import * as THREE from 'three';
import { mouse, keys, pressed } from './input.js';

export const WEAPONS = {
  fist:   { name: 'Faust',   ammo: Infinity, dmg: 12, range: 5,   rate: 0.4, auto: false },
  pistol: { name: 'Pistole', ammo: 60,       dmg: 26, range: 220, rate: 0.18, auto: false },
};

export class WeaponSystem {
  constructor(scene) {
    this.scene = scene;
    this.current = 'fist';
    this.ammo = { pistol: 60 };
    this.cooldown = 0;
    this.tracers = [];     // {line, life}
    this.flash = null;
    this.raycaster = new THREE.Raycaster();
  }

  switch(name) { if (WEAPONS[name]) this.current = name; }

  // origin: Vector3 (Mündung), dir: Vector3 (normalisiert), targets: NPC-Array
  update(dt, origin, dir, npcs, player, onHit) {
    this.cooldown -= dt;

    if (pressed('1')) this.current = 'fist';
    if (pressed('2')) this.current = 'pistol';

    const w = WEAPONS[this.current];
    const wantFire = mouse.down;

    if (wantFire && this.cooldown <= 0) {
      if (this.current === 'pistol') {
        if (this.ammo.pistol > 0) { this.ammo.pistol--; this.fireRay(origin, dir, w, npcs, onHit); this.cooldown = w.rate; }
      } else {
        this.melee(origin, dir, w, npcs, onHit); this.cooldown = w.rate;
      }
    }

    // Tracer-Lebensdauer
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= dt;
      tr.line.material.opacity = Math.max(0, tr.life / 0.06);
      if (tr.life <= 0) { this.scene.remove(tr.line); this.tracers.splice(i, 1); }
    }
  }

  fireRay(origin, dir, w, npcs, onHit) {
    // Treffer auf nächsten NPC im Strahl
    let hit = null, hitDist = w.range;
    const tmp = new THREE.Vector3();
    for (const npc of npcs) {
      if (npc.dead) continue;
      tmp.copy(npc.mesh.position).add(new THREE.Vector3(0, 4, 0)).sub(origin);
      const along = tmp.dot(dir);
      if (along < 0 || along > hitDist) continue;
      const perp = tmp.length() ** 2 - along * along;
      if (perp < 9) { hit = npc; hitDist = along; }
    }

    const end = origin.clone().add(dir.clone().multiplyScalar(hitDist));
    this.addTracer(origin, end);
    if (hit) { hit.hurt(w.dmg); if (onHit) onHit(hit); }
  }

  melee(origin, dir, w, npcs, onHit) {
    for (const npc of npcs) {
      if (npc.dead) continue;
      const d = npc.mesh.position.distanceTo(origin);
      if (d < w.range) { npc.hurt(w.dmg); if (onHit) onHit(npc); }
    }
  }

  addTracer(a, b) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const mat = new THREE.LineBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 1 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.06 });
  }

  hudAmmo() {
    if (this.current === 'pistol') return `${this.ammo.pistol}`;
    return '∞';
  }
  hudName() { return WEAPONS[this.current].name; }
}
