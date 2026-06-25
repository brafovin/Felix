import { TUNE_COLORS } from './vehicles.js';

const UPGRADE_COST = [0, 600, 1100, 1800, 2800]; // Kosten je Stufe (Stufe 0 = Start)
const STAT_KEYS = ['engine', 'accel', 'handling', 'nitro'];

// Verwaltet das Garage-Overlay (DOM)
export class Tuner {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('garage');
    this.open = false;
    this.vehicle = null;

    document.getElementById('closeGarage').addEventListener('click', () => this.close());
    this.buildColorSwatches();
  }

  buildColorSwatches() {
    const wrap = document.getElementById('colorSwatches');
    wrap.innerHTML = '';
    TUNE_COLORS.forEach(hex => {
      const s = document.createElement('div');
      s.className = 'swatch';
      s.style.background = '#' + hex.toString(16).padStart(6, '0');
      s.addEventListener('click', () => {
        if (!this.vehicle) return;
        this.vehicle.setColor(hex);
        this.render();
      });
      s.dataset.hex = hex;
      wrap.appendChild(s);
    });
  }

  show(vehicle) {
    this.vehicle = vehicle;
    this.open = true;
    this.el.classList.remove('hidden');
    document.exitPointerLock?.();
    this.render();
  }

  close() {
    this.open = false;
    this.el.classList.add('hidden');
  }

  toggle(vehicle) {
    if (this.open) this.close(); else this.show(vehicle);
  }

  render() {
    if (!this.vehicle) return;
    document.getElementById('garageMoney').textContent = this.game.player.money;

    // Farben markieren
    document.querySelectorAll('.swatch').forEach(s => {
      s.classList.toggle('active', Number(s.dataset.hex) === this.vehicle.color);
    });

    // Upgrades
    document.querySelectorAll('.upgrade').forEach(row => {
      const stat = row.dataset.stat;
      const level = this.vehicle.tune[stat];
      row.innerHTML = '';
      for (let i = 0; i < 4; i++) {
        const pip = document.createElement('div');
        pip.className = 'pip' + (i < level ? ' on' : '');
        row.appendChild(pip);
      }
      const btn = document.createElement('button');
      btn.className = 'buybtn';
      if (level >= 4) {
        btn.textContent = 'MAX'; btn.disabled = true;
      } else {
        const cost = UPGRADE_COST[level + 1];
        btn.textContent = `$${cost}`;
        btn.disabled = this.game.player.money < cost;
        btn.onclick = () => this.buy(stat);
      }
      row.appendChild(btn);
    });
  }

  buy(stat) {
    const v = this.vehicle;
    const level = v.tune[stat];
    if (level >= 4) return;
    const cost = UPGRADE_COST[level + 1];
    if (this.game.player.money < cost) return;
    this.game.player.money -= cost;
    v.tune[stat] = level + 1;
    this.game.hud.toast(`${labelFor(stat)} verbessert → Stufe ${level + 1}`);
    this.render();
  }
}

function labelFor(stat) {
  return { engine: 'Motor', accel: 'Getriebe', handling: 'Handling', nitro: 'Nitro' }[stat];
}
