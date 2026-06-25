import { WORLD, BEACH_X, WATER_X } from './world.js';

export class HUD {
  constructor() {
    this.money = document.getElementById('money');
    this.healthbar = document.getElementById('healthbar');
    this.armorbar = document.getElementById('armorbar');
    this.weaponName = document.getElementById('weaponName');
    this.ammo = document.getElementById('ammo');
    this.speedo = document.getElementById('speedo');
    this.kmh = document.getElementById('kmh');
    this.carName = document.getElementById('carName');
    this.missionTitle = document.getElementById('missionTitle');
    this.missionDesc = document.getElementById('missionDesc');
    this.wanted = document.getElementById('wanted');
    this.promptEl = document.getElementById('prompt');
    this.toastEl = document.getElementById('toast');
    this.minimap = document.getElementById('minimap');
    this.mctx = this.minimap.getContext('2d');
    this._toastTimer = 0;
  }

  toast(msg, dur = 2.6) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.remove('hidden');
    this._toastTimer = dur;
  }

  prompt(html) {
    if (html) { this.promptEl.innerHTML = html; this.promptEl.classList.remove('hidden'); }
    else this.promptEl.classList.add('hidden');
  }

  update(dt, game) {
    const p = game.player;
    this.money.textContent = p.money;
    this.healthbar.style.width = p.health + '%';
    this.armorbar.style.width = p.armor + '%';
    this.wanted.textContent = '★'.repeat(p.wanted) + '☆'.repeat(Math.max(0, 5 - p.wanted));
    this.wanted.style.color = p.wanted > 0 ? '#ffcf3f' : '#ffffff44';

    this.weaponName.textContent = game.weapons.hudName();
    this.ammo.textContent = game.weapons.hudAmmo();

    if (game.activeVehicle) {
      this.speedo.classList.remove('hidden');
      this.kmh.textContent = game.activeVehicle.kmh;
      this.carName.textContent = game.activeVehicle.t.name;
    } else {
      this.speedo.classList.add('hidden');
    }

    this.missionTitle.textContent = game.missions.hudTitle();
    this.missionDesc.textContent = game.missions.hudDesc(!!game.activeVehicle);

    if (this._toastTimer > 0) {
      this._toastTimer -= dt;
      if (this._toastTimer <= 0) this.toastEl.classList.add('hidden');
    }

    this.drawMinimap(game);
  }

  drawMinimap(game) {
    const ctx = this.mctx;
    const size = this.minimap.width;
    const scale = size / (WORLD * 2);
    const px = game.player.pos.x, pz = game.player.pos.z;
    const range = 280; // Weltradius im Sichtfeld
    const k = size / (range * 2);

    ctx.save();
    ctx.clearRect(0, 0, size, size);
    // Kreis-Clip
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#1b3a2b'; ctx.fillRect(0, 0, size, size);

    const toMap = (wx, wz) => [size / 2 + (wx - px) * k, size / 2 + (wz - pz) * k];

    // Wasser
    ctx.fillStyle = '#1f6f9b';
    const [wx0] = toMap(WATER_X, 0);
    ctx.fillRect(wx0, 0, size, size);
    // Strand
    ctx.fillStyle = '#d9c690';
    const [bx0] = toMap(BEACH_X, 0);
    ctx.fillRect(bx0, 0, wx0 - bx0, size);

    // Straßen
    ctx.strokeStyle = '#3a3f47'; ctx.lineWidth = 4;
    for (const g of [-300, -150, 0, 150, 300]) {
      const [ax, ay] = toMap(g, -WORLD); const [, by] = toMap(g, WORLD);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax, by); ctx.stroke();
      const [cx, cy] = toMap(-WORLD, g); const [dx] = toMap(WORLD, g);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(dx, cy); ctx.stroke();
    }

    // Missionsmarker
    ctx.fillStyle = '#ff8a2b';
    for (const m of game.missions.defs) {
      if (game.missions.completedIds.has(m.id) || game.missions.active) continue;
      const [mx, my] = toMap(m.x, m.z);
      dot(ctx, mx, my, 4);
    }
    if (game.missions.goalMarker) {
      ctx.fillStyle = '#28e0c8';
      const gm = game.missions.goalMarker.position;
      const [mx, my] = toMap(gm.x, gm.z); dot(ctx, mx, my, 4);
    }

    // Garage
    ctx.fillStyle = '#ffcf3f';
    const [gx, gy] = toMap(-150, 236); dot(ctx, gx, gy, 4);

    // NPCs
    ctx.fillStyle = '#ff5555';
    for (const e of game.missions.enemies) {
      if (e.dead) continue;
      const [ex, ey] = toMap(e.pos.x, e.pos.z); dot(ctx, ex, ey, 2.5);
    }

    // Fahrzeuge
    ctx.fillStyle = '#cfd6e0';
    for (const v of game.vehicles) {
      if (v === game.activeVehicle) continue;
      const [vx, vy] = toMap(v.pos.x, v.pos.z); dot(ctx, vx, vy, 2);
    }

    // Spieler (Pfeil)
    ctx.fillStyle = '#28e0c8';
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(game.camYaw);
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }
}

function dot(ctx, x, y, r) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
