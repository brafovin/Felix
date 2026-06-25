import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { initInput, keys, mouse, pressed, consumeInput } from './input.js';
import { buildWorld, animateWater, WORLD, BEACH_X, WATER_X } from './world.js';
import { Player } from './player.js';
import { spawnTraffic } from './vehicles.js';
import { spawnPedestrians } from './npc.js';
import { WeaponSystem } from './weapons.js';
import { MissionManager } from './missions.js';
import { PoliceManager } from './police.js';
import { Tuner } from './tuner.js';
import { HUD } from './hud.js';
import { GameAudio } from './audio.js';
import { clamp, dist2D } from './utils.js';

class Game {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.id = 'scene';
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.5, 2000);

    // Postprocessing: Bloom für leuchtende Fenster, Lichter, Sonne
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.6, 0.85);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.camYaw = 0;
    this.camPitch = 0.25;
    this.camDist = 18;

    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
      this.composer.setSize(innerWidth, innerHeight);
    });

    this.clock = new THREE.Clock();
    this.time = 0;
  }

  init() {
    const { water } = buildWorld(this.scene, this.renderer);
    this.water = water;

    this.audio = new GameAudio();
    this.player = new Player(this.scene);
    this.vehicles = spawnTraffic(this.scene);
    this.pedestrians = spawnPedestrians(this.scene, 26);
    this.weapons = new WeaponSystem(this.scene, this.audio);
    this.missions = new MissionManager(this.scene);
    this.police = new PoliceManager(this.scene);
    this.hud = new HUD();
    this.tuner = new Tuner(this);

    this.activeVehicle = null;
    this.bigmapOpen = false;

    initInput(this.renderer.domElement);
    this.bindUI();
  }

  bindUI() {
    this.bigmapCanvas = document.getElementById('bigmapCanvas');
    this.bmctx = this.bigmapCanvas.getContext('2d');
  }

  start() {
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    this.audio.start();
    this.renderer.domElement.requestPointerLock();
    this.loop();
  }

  // ----------------------------------------------------- Kamera
  updateCamera(dt) {
    const sens = 0.0022;
    this.camYaw -= mouse.dx * sens;
    this.camPitch = clamp(this.camPitch - mouse.dy * sens, -0.6, 1.2);

    // Zielpunkt: Spieler oder Fahrzeug
    let target;
    if (this.activeVehicle) {
      target = this.activeVehicle.pos.clone().add(new THREE.Vector3(0, 4, 0));
      this.camDist = 26;
    } else {
      target = this.player.pos.clone().add(new THREE.Vector3(0, 6, 0));
      this.camDist = 18;
    }

    const offset = new THREE.Vector3(
      Math.sin(this.camYaw) * Math.cos(this.camPitch),
      Math.sin(this.camPitch),
      Math.cos(this.camYaw) * Math.cos(this.camPitch)
    ).multiplyScalar(this.camDist);

    const desired = target.clone().add(offset);
    if (desired.y < 2) desired.y = 2;
    this.camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
    this.camera.lookAt(target);
  }

  // ----------------------------------------------------- Fahrzeug betreten/verlassen
  handleVehicleToggle() {
    if (!pressed('f')) return;
    if (this.activeVehicle) {
      // aussteigen
      const v = this.activeVehicle;
      this.player.onFoot = true;
      this.player.pos.set(v.pos.x + Math.cos(v.heading) * (v.t.w + 2), 0, v.pos.z - Math.sin(v.heading) * (v.t.w + 2));
      this.activeVehicle = null;
    } else {
      // nächstes Fahrzeug suchen
      let best = null, bestD = 12;
      for (const v of this.vehicles) {
        const d = dist2D(this.player.pos.x, this.player.pos.z, v.pos.x, v.pos.z);
        if (d < bestD) { bestD = d; best = v; }
      }
      if (best) { this.activeVehicle = best; this.player.onFoot = false; }
    }
  }

  // ----------------------------------------------------- Interaktion (E)
  handleInteract() {
    // Garage: im Fahrzeug nahe der Garage
    const gx = -150, gz = 236;
    const nearGarage = dist2D(this.player.pos.x, this.player.pos.z, gx, gz) < 14;
    if (this.activeVehicle && nearGarage) {
      this.hud.prompt('<b>E</b> — Tuner-Garage öffnen');
      if (pressed('e')) this.tuner.toggle(this.activeVehicle);
      return;
    }

    // Mission starten
    const m = this.missions.nearbyMission(this.player.pos.x, this.player.pos.z);
    if (m) {
      this.hud.prompt(`<b>E</b> — Mission starten: ${m.title}`);
      if (pressed('e')) this.missions.start(m, this.hud);
      return;
    }

    this.hud.prompt(null);
  }

  // ----------------------------------------------------- Schießen
  handleShooting(dt) {
    if (this.activeVehicle || this.tuner.open) return;
    const head = this.player.pos.clone().add(new THREE.Vector3(0, 6, 0));
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const targets = this.pedestrians.concat(this.missions.enemies, this.police.units);
    this.weapons.update(dt, head, dir, targets, this.player, (hit) => {
      this.audio.hit();
      if (hit.dead) {
        if (hit.isPolice) {
          this.player.money += 100;
          if (this.player.wanted < 5) this.player.wanted++;
        } else {
          this.player.money += 50;
          if (!hit.hostile && this.player.wanted < 5) this.player.wanted++;
        }
      }
    });
  }

  // ----------------------------------------------------- Fahndungslevel
  updateWanted(dt) {
    // Nur abkühlen, wenn die Polizei dich gerade NICHT verfolgt
    if (this.police.beingChased) { this._wantedDecay = 0; return; }
    this._wantedDecay = (this._wantedDecay || 0) + dt;
    if (this._wantedDecay > 8 && this.player.wanted > 0) {
      this.player.wanted--; this._wantedDecay = 0;
      if (this.player.wanted === 0) this.hud.toast('Du bist die Polizei losgeworden.');
    }
  }

  // ----------------------------------------------------- Große Karte
  toggleBigmap() {
    if (pressed('m')) {
      this.bigmapOpen = !this.bigmapOpen;
      document.getElementById('bigmap').classList.toggle('hidden', !this.bigmapOpen);
      if (this.bigmapOpen) document.exitPointerLock?.();
      else this.renderer.domElement.requestPointerLock();
    }
    if (this.bigmapOpen && pressed('escape')) {
      this.bigmapOpen = false;
      document.getElementById('bigmap').classList.add('hidden');
    }
    if (this.bigmapOpen) this.drawBigmap();
  }

  drawBigmap() {
    const ctx = this.bmctx, S = this.bigmapCanvas.width;
    const k = S / (WORLD * 2);
    const toMap = (wx, wz) => [(wx + WORLD) * k, (wz + WORLD) * k];
    ctx.fillStyle = '#244a36'; ctx.fillRect(0, 0, S, S);
    // Strand / Wasser
    ctx.fillStyle = '#d9c690'; const [bx] = toMap(BEACH_X, 0); ctx.fillRect(bx, 0, S - bx, S);
    ctx.fillStyle = '#1f6f9b'; const [wx] = toMap(WATER_X, 0); ctx.fillRect(wx, 0, S - wx, S);
    // Straßen
    ctx.strokeStyle = '#3a3f47'; ctx.lineWidth = 6;
    for (const g of [-300, -150, 0, 150, 300]) {
      const [ax] = toMap(g, 0);
      ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, S); ctx.stroke();
      const [, ay] = toMap(0, g);
      ctx.beginPath(); ctx.moveTo(0, ay); ctx.lineTo(S, ay); ctx.stroke();
    }
    // Marker
    const blob = (wx, wz, c, r = 7) => { ctx.fillStyle = c; const [x, y] = toMap(wx, wz); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
    for (const m of this.missions.defs)
      if (!this.missions.completedIds.has(m.id) && !this.missions.active) blob(m.x, m.z, '#ff8a2b');
    blob(-150, 236, '#ffcf3f');
    if (this.missions.goalMarker) blob(this.missions.goalMarker.position.x, this.missions.goalMarker.position.z, '#28e0c8');
    blob(this.player.pos.x, this.player.pos.z, '#28e0c8', 9);

    ctx.fillStyle = '#fff'; ctx.font = '16px Segoe UI'; ctx.fillText('LIBERTY SHORES', 16, 28);
  }

  // ----------------------------------------------------- Hauptschleife
  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;

    if (!this.tuner.open && !this.bigmapOpen) {
      this.updateCamera(dt);
      this.handleVehicleToggle();
      this.handleInteract();

      if (this.activeVehicle) {
        this.activeVehicle.update(dt, true);
        // Spieler folgt Fahrzeug (Charakter unsichtbar im Auto)
        this.player.pos.copy(this.activeVehicle.pos);
        this.player.mesh.visible = false;
        this.hud.prompt(this._garagePromptOverride || (dist2D(this.player.pos.x, this.player.pos.z, -150, 236) < 14 ? '<b>E</b> — Tuner-Garage' : '<b>F</b> — Aussteigen'));
      } else {
        this.player.update(dt, this.camYaw);
      }

      this.handleShooting(dt);
      this.updateWanted(dt);
    }

    // Welt-Animation immer
    animateWater(this.water, this.time);
    this.missions.animate(this.time);

    // Andere Fahrzeuge (rollen aus)
    for (const v of this.vehicles) if (v !== this.activeVehicle) v.update(dt, false);

    // NPCs
    for (const p of this.pedestrians) p.update(dt, this.player);
    for (const e of this.missions.enemies) e.update(dt, this.player);

    // Polizei
    this.police.update(dt, this.player, this.weapons);

    // Missions-Fortschritt
    this.missions.update(this.player, !!this.activeVehicle, this.hud, (reward) => {
      this.player.money += reward;
      this.audio.success();
    });

    // Audio: Motor & Sirene
    if (this.activeVehicle) {
      this.audio.setEngine(true, clamp(this.activeVehicle.kmh / 200, 0, 1));
    } else {
      this.audio.setEngine(false);
    }
    this.audio.setSiren(this.police.count > 0 && this.player.wanted > 0);

    // Stummschalten
    if (pressed('p')) {
      const m = this.audio.toggleMute();
      this.hud.toast(m ? '🔇 Ton aus' : '🔊 Ton an');
    }

    this.toggleBigmap();
    this.hud.update(dt, this);

    this.composer.render();
    consumeInput();
  }
}

// ---------------------------------------------------------------- Bootstrap
const game = new Game();
const bar = document.getElementById('loadbar');
let prog = 0;
const fakeLoad = setInterval(() => {
  prog = Math.min(100, prog + 14);
  bar.style.width = prog + '%';
  if (prog >= 100) {
    clearInterval(fakeLoad);
    game.init();
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('menu').classList.remove('hidden');
  }
}, 120);

document.getElementById('playBtn').addEventListener('click', () => game.start());

// Respawn bei Tod
setInterval(() => {
  if (game.player && game.player.health <= 0) {
    game.player.health = 100; game.player.armor = 0;
    game.player.money = Math.max(0, game.player.money - 500);
    game.player.pos.set(40, 0, 60);
    game.player.wanted = 0;
    if (game.activeVehicle) { game.activeVehicle = null; game.player.onFoot = true; }
    game.hud.toast('Du wurdest ausgeschaltet … $500 Krankenhauskosten.');
  }
}, 500);

window.game = game;
