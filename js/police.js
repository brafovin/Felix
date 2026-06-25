import * as THREE from 'three';
import { resolveCollision, WORLD, inWater } from './world.js';
import { clamp, approachAngle, dist2D, rand, pick } from './utils.js';

// Polizeiauto-Mesh mit Lichtbalken
function makePoliceCar() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(6.0, 2.0, 14),
    new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: 0.4, metalness: 0.5 }));
  body.position.y = 1.6; body.castShadow = true; g.add(body);

  // weiße Türen
  for (const sx of [-1, 1]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.8, 4.5),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f2 }));
    door.position.set(sx * 3.05, 1.6, 0); g.add(door);
  }

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(5.0, 1.8, 7),
    new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.85 }));
  cabin.position.set(0, 3.0, -0.6); cabin.castShadow = true; g.add(cabin);

  // Lichtbalken
  const blue = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x0033ff, emissive: 0x0033ff, emissiveIntensity: 2 }));
  blue.position.set(-1.3, 4.3, -0.6); g.add(blue);
  const red = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 1.6),
    new THREE.MeshStandardMaterial({ color: 0xff0022, emissive: 0xff0022, emissiveIntensity: 2 }));
  red.position.set(1.3, 4.3, -0.6); g.add(red);

  const blueLight = new THREE.PointLight(0x2a5bff, 0, 50);
  blueLight.position.set(-1.3, 4.7, -0.6); g.add(blueLight);
  const redLight = new THREE.PointLight(0xff2233, 0, 50);
  redLight.position.set(1.3, 4.7, -0.6); g.add(redLight);

  // Räder
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e });
  const wheelGeo = new THREE.CylinderGeometry(1.5, 1.5, 1.1, 14);
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(sx * 3.0, 1.3, sz * 4.3); w.castShadow = true; g.add(w);
  }

  g.userData = { blue, red, blueLight, redLight };
  return g;
}

class PoliceUnit {
  constructor(scene, x, z) {
    this.scene = scene;
    this.mesh = makePoliceCar();
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = 0;
    this.speed = 0;
    this.health = 130;
    this.dead = false;
    this.hostile = true;
    this.isPolice = true;
    this.shootTimer = rand(1, 2.5);
    this.flash = 0;
  }

  hurt(dmg) {
    if (this.dead) return;
    this.health -= dmg;
    if (this.health <= 0) this.kill();
  }

  kill() {
    this.dead = true;
    // kleine "Explosion": Auto kippt und versinkt
    this.mesh.rotation.z = rand(-0.5, 0.5);
    const flash = new THREE.PointLight(0xffaa33, 6, 60);
    flash.position.copy(this.pos).add(new THREE.Vector3(0, 3, 0));
    this.scene.add(flash);
    setTimeout(() => this.scene.remove(flash), 250);
    setTimeout(() => this.scene.remove(this.mesh), 4000);
  }

  update(dt, player, weapons) {
    if (this.dead) { this.mesh.position.y -= dt * 1.5; return; }

    const dx = player.pos.x - this.pos.x;
    const dz = player.pos.z - this.pos.z;
    const distP = Math.hypot(dx, dz);
    const desired = Math.atan2(dx, dz);
    this.heading = approachAngle(this.heading, desired, 2.2 * dt);

    // Beschleunigen, aber vor dem Spieler abbremsen
    const targetSpeed = distP > 25 ? 64 : 8;
    this.speed += (targetSpeed - this.speed) * 1.5 * dt;

    let nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
    let nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
    const r = resolveCollision(nx, nz, 2.6);
    if (r.x !== nx || r.z !== nz) this.speed *= 0.5;
    nx = clamp(r.x, -WORLD + 5, WORLD - 5);
    nz = clamp(r.z, -WORLD + 5, WORLD - 5);
    let y = 0;
    if (inWater(nx)) { this.speed *= 0.8; y = -0.5; }
    this.pos.set(nx, y, nz);
    this.mesh.position.set(nx, y, nz);
    this.mesh.rotation.y = this.heading;

    // Blaulicht-Blinken
    this.flash += dt;
    const on = Math.floor(this.flash * 5) % 2 === 0;
    const u = this.mesh.userData;
    u.blue.material.emissiveIntensity = on ? 3 : 0.2;
    u.red.material.emissiveIntensity = on ? 0.2 : 3;
    u.blueLight.intensity = on ? 2.5 : 0;
    u.redLight.intensity = on ? 0 : 2.5;

    // Schießen
    this.shootTimer -= dt;
    if (distP < 55 && this.shootTimer <= 0) {
      this.shootTimer = rand(1.0, 1.8);
      const from = this.pos.clone().add(new THREE.Vector3(0, 2.5, 0));
      const to = player.pos.clone().add(new THREE.Vector3(0, 4, 0));
      weapons.addTracer(from, to);
      if (Math.random() < 0.55) player.damage(9);
    }
  }
}

export class PoliceManager {
  constructor(scene) {
    this.scene = scene;
    this.units = [];
    this.spawnTimer = 0;
    this.beingChased = false;
  }

  desiredCount(wanted) {
    return [0, 1, 2, 3, 5, 7][clamp(wanted, 0, 5)];
  }

  spawnNear(player) {
    // auf einer Straße in 120–180 Einheiten Entfernung spawnen
    const roads = [-300, -150, 0, 150, 300];
    const ang = rand(0, Math.PI * 2);
    const d = rand(120, 190);
    let x = clamp(player.pos.x + Math.cos(ang) * d, -WORLD + 20, 380);
    let z = clamp(player.pos.z + Math.sin(ang) * d, -WORLD + 20, WORLD - 20);
    // auf nächste Straßenlinie ausrichten
    x = pick(roads) + rand(-4, 4);
    this.units.push(new PoliceUnit(this.scene, x, z));
  }

  update(dt, player, weapons) {
    const want = player.wanted;
    const target = this.desiredCount(want);

    // tote/zu weit entfernte aufräumen
    this.units = this.units.filter(u => {
      if (u.dead && u.mesh.position.y < -8) { this.scene.remove(u.mesh); return false; }
      return true;
    });

    const alive = this.units.filter(u => !u.dead).length;

    if (want === 0) {
      // bei 0 Sternen: Polizei zieht ab
      for (const u of this.units) if (!u.dead) { this.scene.remove(u.mesh); u.dead = true; }
      this.units = this.units.filter(u => u.dead && u.mesh.parent);
      this.units = [];
    } else {
      this.spawnTimer -= dt;
      if (alive < target && this.spawnTimer <= 0) {
        this.spawnNear(player);
        this.spawnTimer = 1.6;
      }
    }

    let chased = false;
    for (const u of this.units) {
      u.update(dt, player, weapons);
      if (!u.dead && dist2D(u.pos.x, u.pos.z, player.pos.x, player.pos.z) < 100) chased = true;
    }
    this.beingChased = chased;
  }

  get count() { return this.units.filter(u => !u.dead).length; }
}
