import * as THREE from 'three';
import { keys } from './input.js';
import { resolveCollision, inWater, WORLD } from './world.js';
import { clamp, approachAngle } from './utils.js';

// Fahrzeug-Vorlagen
const CAR_TEMPLATES = [
  { name: 'Comet Sport',  w: 4.2, l: 9,  h: 2.2, color: 0xd83a3a, baseSpeed: 62 },
  { name: 'Urban SUV',    w: 4.6, l: 9.5, h: 3.2, color: 0x2b3a55, baseSpeed: 50 },
  { name: 'Speedster GT', w: 4.0, l: 8.5, h: 1.9, color: 0xf0c020, baseSpeed: 72 },
  { name: 'City Hatch',   w: 3.8, l: 7.5, h: 2.4, color: 0x3aa05a, baseSpeed: 48 },
];

export const TUNE_COLORS = [0xd83a3a, 0x2e7dd6, 0xf0c020, 0x2ec46b, 0xffffff, 0x111418, 0xff6fb0, 0xff8a2b];

export function createCarMesh(t) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: t.color, roughness: 0.35, metalness: 0.6 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(t.w, t.h * 0.55, t.l), bodyMat);
  body.position.y = t.h * 0.45; body.castShadow = true; g.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(t.w * 0.85, t.h * 0.5, t.l * 0.5),
    new THREE.MeshStandardMaterial({ color: 0x223, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.85 }));
  cabin.position.set(0, t.h * 0.8, -t.l * 0.05); cabin.castShadow = true; g.add(cabin);

  // Räder
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.9 });
  const wheelGeo = new THREE.CylinderGeometry(t.h * 0.4, t.h * 0.4, 0.8, 14);
  const wheels = [];
  const wx = t.w / 2, wz = t.l / 2 - 1.6;
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx * wx, t.h * 0.35, sz * wz);
    wheel.castShadow = true; g.add(wheel); wheels.push(wheel);
  }

  // Scheinwerfer
  const hlMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3c0, emissiveIntensity: 1 });
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.3), hlMat);
    hl.position.set(sx * t.w * 0.3, t.h * 0.45, t.l / 2); g.add(hl);
  }

  g.userData.body = body;
  g.userData.wheels = wheels;
  return g;
}

export class Vehicle {
  constructor(scene, template, x, z) {
    this.t = { ...template };
    this.mesh = createCarMesh(this.t);
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);

    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = 0;          // Fahrtrichtung (Yaw)
    this.speed = 0;            // aktuelle Vorwärtsgeschwindigkeit
    this.steer = 0;

    // Tuning-Stufen (0..4)
    this.tune = { engine: 0, accel: 0, handling: 0, nitro: 0 };
    this.color = this.t.color;
  }

  get maxSpeed() { return this.t.baseSpeed + this.tune.engine * 12; }
  get accelRate() { return 28 + this.tune.accel * 9; }
  get turnRate() { return 1.6 + this.tune.handling * 0.35; }

  setColor(hex) {
    this.color = hex;
    this.mesh.userData.body.material.color.setHex(hex);
  }

  // Wird gefahren, wenn driven=true
  update(dt, driven) {
    if (driven) {
      let throttle = 0;
      if (keys['w']) throttle += 1;
      if (keys['s']) throttle -= 1;

      const boost = (keys['shift'] && this.tune.nitro > 0) ? 1 + this.tune.nitro * 0.18 : 1;
      const max = this.maxSpeed * boost;

      if (throttle !== 0) {
        this.speed += throttle * this.accelRate * dt;
      } else {
        this.speed *= 0.96; // Rollwiderstand
      }
      // Handbremse
      if (keys[' ']) this.speed *= 0.90;
      this.speed = clamp(this.speed, -max * 0.45, max);

      // Lenkung nur bei Bewegung
      let steerInput = 0;
      if (keys['a']) steerInput += 1;
      if (keys['d']) steerInput -= 1;
      const speedFactor = clamp(Math.abs(this.speed) / 20, 0, 1);
      const dir = this.speed >= 0 ? 1 : -1;
      this.heading += steerInput * this.turnRate * dt * speedFactor * dir;
      this.steer = steerInput;
    } else {
      this.speed *= 0.98;
      this.steer = 0;
    }

    // Bewegung
    const vx = Math.sin(this.heading) * this.speed;
    const vz = Math.cos(this.heading) * this.speed;
    let nx = this.pos.x + vx * dt;
    let nz = this.pos.z + vz * dt;

    // Kollision (mit Aufprall-Abbremsung)
    const before = { x: nx, z: nz };
    const res = resolveCollision(nx, nz, this.t.w * 0.6);
    if (res.x !== before.x || res.z !== before.z) this.speed *= 0.3;
    nx = clamp(res.x, -WORLD + 5, WORLD - 5);
    nz = clamp(res.z, -WORLD + 5, WORLD - 5);

    // Wasser bremst stark
    let y = 0;
    if (inWater(nx)) { this.speed *= 0.85; y = -0.6; }

    this.pos.set(nx, y, nz);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;

    // leichtes Wanken
    this.mesh.rotation.z = -this.steer * clamp(this.speed / 60, 0, 1) * 0.05;

    // Radrotation
    const spin = this.speed * dt * 0.5;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
  }

  get kmh() { return Math.round(Math.abs(this.speed) * 3.6); }
}

export function spawnTraffic(scene) {
  const vehicles = [];
  const spots = [
    [40, 60], [-150, -80], [150, 120], [0, -200], [300, 40],
    [-300, 200], [150, -150], [-40, 300], [420, -100], [-150, 236],
  ];
  spots.forEach((s, i) => {
    const t = CAR_TEMPLATES[i % CAR_TEMPLATES.length];
    const v = new Vehicle(scene, t, s[0], s[1]);
    v.heading = (i % 2) * Math.PI / 2;
    vehicles.push(v);
  });
  return vehicles;
}
