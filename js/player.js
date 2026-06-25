import * as THREE from 'three';
import { keys } from './input.js';
import { resolveCollision, inWater, WORLD } from './world.js';
import { clamp } from './utils.js';

// Einfacher Low-Poly-Charakter
export function createCharacter(color = 0x2e7dd6) {
  const g = new THREE.Group();
  const skin = 0xe0a878;

  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 3, 1.2),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
  torso.position.y = 4.2; torso.castShadow = true; g.add(torso);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 1.5, 1.5),
    new THREE.MeshStandardMaterial({ color: skin }));
  head.position.y = 6.5; head.castShadow = true; g.add(head);

  const legMat = new THREE.MeshStandardMaterial({ color: 0x303542 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3, 0.9), legMat);
  legL.position.set(-0.6, 1.5, 0); legL.castShadow = true; g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.6; g.add(legR);

  const armMat = new THREE.MeshStandardMaterial({ color });
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.6, 0.7), armMat);
  armL.position.set(-1.6, 4.4, 0); armL.castShadow = true; g.add(armL);
  const armR = armL.clone(); armR.position.x = 1.6; g.add(armR);

  g.userData = { legL, legR, armL, armR, head, walk: 0 };
  return g;
}

export class Player {
  constructor(scene) {
    this.mesh = createCharacter(0x2e7dd6);
    this.mesh.position.set(40, 0, 60);
    scene.add(this.mesh);

    this.pos = new THREE.Vector3(40, 0, 60);
    this.vel = new THREE.Vector3();
    this.yaw = 0;            // Blickrichtung (von Kamera gesteuert)
    this.facing = 0;         // Körperausrichtung
    this.onFoot = true;
    this.health = 100;
    this.armor = 0;
    this.money = 2500;
    this.wanted = 0;
    this.ySpeed = 0;
    this.grounded = true;
  }

  update(dt, camYaw) {
    if (!this.onFoot) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    this.yaw = camYaw;

    const sprint = keys['shift'] ? 1.8 : 1.0;
    const speed = 26 * sprint;

    // Bewegungsrichtung relativ zur Kamera
    let mx = 0, mz = 0;
    if (keys['w']) mz -= 1;
    if (keys['s']) mz += 1;
    if (keys['a']) mx -= 1;
    if (keys['d']) mx += 1;

    const moving = mx !== 0 || mz !== 0;
    if (moving) {
      const len = Math.hypot(mx, mz); mx /= len; mz /= len;
      const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
      const wx = mx * cos - mz * sin;
      const wz = mx * sin + mz * cos;
      this.vel.x = wx * speed;
      this.vel.z = wz * speed;
      this.facing = Math.atan2(wx, wz);
    } else {
      this.vel.x *= 0.7; this.vel.z *= 0.7;
    }

    // Springen
    if (keys[' '] && this.grounded) { this.ySpeed = 16; this.grounded = false; }
    this.ySpeed -= 45 * dt;

    let nx = this.pos.x + this.vel.x * dt;
    let nz = this.pos.z + this.vel.z * dt;
    let ny = this.pos.y + this.ySpeed * dt;
    if (ny <= 0) { ny = 0; this.ySpeed = 0; this.grounded = true; }

    // Kollision mit Gebäuden
    const resolved = resolveCollision(nx, nz, 1.6);
    nx = resolved.x; nz = resolved.z;

    // Weltgrenzen
    nx = clamp(nx, -WORLD + 5, WORLD - 5);
    nz = clamp(nz, -WORLD + 5, WORLD - 5);

    // Im Wasser langsamer & Schaden bei Tiefe
    if (inWater(nx)) {
      ny = Math.max(ny, -1.5);
    }

    this.pos.set(nx, ny, nz);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.facing;

    // Lauf-Animation
    const u = this.mesh.userData;
    if (moving && this.grounded) {
      u.walk += dt * 12 * sprint;
      const s = Math.sin(u.walk) * 0.7;
      u.legL.rotation.x = s; u.legR.rotation.x = -s;
      u.armL.rotation.x = -s; u.armR.rotation.x = s;
    } else {
      u.legL.rotation.x *= 0.8; u.legR.rotation.x *= 0.8;
      u.armL.rotation.x *= 0.8; u.armR.rotation.x *= 0.8;
    }
  }

  damage(amount) {
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, amount * 0.6);
      this.armor -= absorbed; amount -= absorbed;
    }
    this.health = clamp(this.health - amount, 0, 100);
  }

  heal(a) { this.health = clamp(this.health + a, 0, 100); }
}
