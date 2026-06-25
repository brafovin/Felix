import * as THREE from 'three';
import { createCharacter } from './player.js';
import { resolveCollision, WORLD } from './world.js';
import { rand, pick, clamp } from './utils.js';

const PED_COLORS = [0x9b59b6, 0xe67e22, 0x16a085, 0xc0392b, 0x34495e, 0xecf0f1, 0x8e44ad];

export class NPC {
  constructor(scene, x, z, hostile = false) {
    this.mesh = createCharacter(pick(PED_COLORS));
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.scene = scene;

    this.pos = new THREE.Vector3(x, 0, z);
    this.health = 100;
    this.dead = false;
    this.hostile = hostile;
    this.state = 'wander';
    this.target = new THREE.Vector3(x + rand(-60, 60), 0, z + rand(-60, 60));
    this.timer = rand(2, 6);
    this.walk = 0;
    this.speed = hostile ? 18 : 9;
    this.shootTimer = 0;
  }

  hurt(dmg) {
    if (this.dead) return;
    this.health -= dmg;
    // Treffer-Aufblitzen
    this.mesh.children.forEach(c => { if (c.material) c.material.emissive?.setHex(0xff0000); });
    setTimeout(() => this.mesh.children.forEach(c => c.material?.emissive?.setHex(0x000000)), 80);
    if (this.health <= 0) this.kill();
    else if (!this.hostile) { this.state = 'flee'; this.timer = 5; }
  }

  kill() {
    this.dead = true;
    this.mesh.rotation.x = Math.PI / 2;          // umfallen
    this.mesh.position.y = 1;
    this.mesh.children.forEach(c => { if (c.material) c.material.transparent = true; });
    setTimeout(() => { this.scene.remove(this.mesh); }, 8000);
  }

  update(dt, player) {
    if (this.dead) return;

    const toPlayer = new THREE.Vector3().subVectors(player.pos, this.pos);
    const distP = toPlayer.length();

    this.timer -= dt;

    if (this.hostile && distP < 120) {
      this.state = 'chase';
    }

    let dir = new THREE.Vector3();
    if (this.state === 'chase') {
      dir.copy(toPlayer).normalize();
      this.shootTimer -= dt;
      if (distP < 60 && this.shootTimer <= 0) {
        this.shootTimer = 1.4;
        // Trefferchance
        if (Math.random() < 0.5) player.damage(7);
      }
    } else if (this.state === 'flee') {
      dir.copy(this.pos).sub(player.pos).normalize();
      if (this.timer <= 0) this.state = 'wander';
    } else {
      // wandern
      dir.copy(this.target).sub(this.pos);
      if (dir.length() < 4 || this.timer <= 0) {
        this.target.set(
          clamp(this.pos.x + rand(-80, 80), -WORLD + 10, WORLD - 10),
          0,
          clamp(this.pos.z + rand(-80, 80), -WORLD + 10, WORLD - 10));
        this.timer = rand(3, 7);
      }
      dir.normalize();
    }

    const sp = this.state === 'wander' ? this.speed : this.speed * 1.6;
    let nx = this.pos.x + dir.x * sp * dt;
    let nz = this.pos.z + dir.z * sp * dt;
    const r = resolveCollision(nx, nz, 1.6);
    nx = clamp(r.x, -WORLD + 5, WORLD - 5);
    nz = clamp(r.z, -WORLD + 5, WORLD - 5);
    this.pos.set(nx, 0, nz);
    this.mesh.position.copy(this.pos);
    if (dir.lengthSq() > 0.01) this.mesh.rotation.y = Math.atan2(dir.x, dir.z);

    // Lauf-Animation
    this.walk += dt * 10;
    const s = Math.sin(this.walk) * 0.6;
    const u = this.mesh.userData;
    u.legL.rotation.x = s; u.legR.rotation.x = -s;
    u.armL.rotation.x = -s; u.armR.rotation.x = s;
  }
}

export function spawnPedestrians(scene, count = 24) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const x = rand(-380, 380), z = rand(-380, 380);
    peds.push(new NPC(scene, x, z, false));
  }
  return peds;
}
