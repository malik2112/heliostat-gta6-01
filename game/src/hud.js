// HELIOSTAT — the HUD. Health, cash, wanted stars, the mission objective,
// a live 2D minimap, speed and ammo, toasts, and the start / pause /
// busted / dead screens. All DOM + one canvas, drawn every frame.

import { CFG, fmtMoney } from './config.js';

export function createHud(game) {
  const $ = (id) => document.getElementById(id);
  const els = {
    healthFill: $('health-fill'),
    healthText: $('health-text'),
    money: $('money'),
    stars: $('stars'),
    objectiveTitle: $('objective-title'),
    objectiveText: $('objective-text'),
    speed: $('speed'),
    ammo: $('ammo'),
    radio: $('radio'),
    toast: $('toast'),
    minimap: $('minimap'),
    menu: $('menu'),
    pause: $('pause'),
    dead: $('dead'),
    busted: $('busted'),
    damage: $('damage'),
    clock: $('clock'),
    selftest: $('selftest'),
  };
  const mm = els.minimap.getContext('2d');
  let toastTimer = null;
  let damageTimer = null;

  const setStars = (n) => {
    els.stars.textContent = '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
    els.stars.classList.toggle('hot', n >= 3);
  };

  const setObjective = (title, text) => {
    els.objectiveTitle.textContent = title;
    els.objectiveText.textContent = text;
  };

  const toast = (msg, ms = 4200) => {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), ms);
  };

  const flashDamage = () => {
    els.damage.classList.add('show');
    if (damageTimer) clearTimeout(damageTimer);
    damageTimer = setTimeout(() => els.damage.classList.remove('show'), 220);
  };

  const showMenu = (show) => els.menu.classList.toggle('hidden', !show);
  const showPause = (show) => els.pause.classList.toggle('hidden', !show);
  const showDead = (show) => els.dead.classList.toggle('hidden', !show);
  const showBusted = (show) => els.busted.classList.toggle('hidden', !show);

  const drawMinimap = () => {
    const W = els.minimap.width;
    const H = els.minimap.height;
    const half = CFG.worldHalf;
    const toX = (x) => ((x + half) / (half * 2)) * W;
    const toY = (z) => ((z + half) / (half * 2)) * H;
    mm.clearRect(0, 0, W, H);
    mm.fillStyle = 'rgba(20, 24, 20, 0.82)';
    mm.fillRect(0, 0, W, H);
    // Sand blocks.
    mm.fillStyle = '#c8a878';
    mm.fillRect(0, 0, W, H);
    // Roads.
    mm.strokeStyle = '#3a3a40';
    mm.lineWidth = 5;
    for (const x of game.city.roadXs) {
      mm.beginPath();
      mm.moveTo(toX(x), 0);
      mm.lineTo(toX(x), H);
      mm.stroke();
    }
    for (const z of game.city.roadZs) {
      mm.beginPath();
      mm.moveTo(0, toY(z));
      mm.lineTo(W, toY(z));
      mm.stroke();
    }
    // Solar field.
    mm.fillStyle = '#dfe8f0';
    mm.fillRect(toX(320), toY(-440), toX(430) - toX(320), toY(-330) - toY(-440));
    // Mission marker: pulsing yellow diamond.
    const marker = game.missions.markerPos;
    if (marker) {
      const t = performance.now() / 300;
      const r = 5 + Math.sin(t) * 2;
      mm.fillStyle = '#ffd840';
      mm.beginPath();
      mm.moveTo(toX(marker.x), toY(marker.z) - r - 3);
      mm.lineTo(toX(marker.x) + r, toY(marker.z));
      mm.lineTo(toX(marker.x), toY(marker.z) + r + 3);
      mm.lineTo(toX(marker.x) - r, toY(marker.z));
      mm.closePath();
      mm.fill();
    }
    // Traffic (amber), police (blue/red), peds (white dots).
    for (const v of game.vehicles.vehicles) {
      mm.fillStyle = v.isPolice ? '#3050ff' : '#ffb020';
      mm.fillRect(toX(v.pos.x) - 2, toY(v.pos.z) - 2, 4, 4);
    }
    for (const p of game.peds.peds) {
      if (!p.alive) continue;
      mm.fillStyle = 'rgba(255,255,255,0.85)';
      mm.fillRect(toX(p.pos.x) - 1, toY(p.pos.z) - 1, 2, 2);
    }
    // Player arrow, rotated by heading.
    const p = game.player.pos;
    const h = game.player.inVehicle ? game.player.vehicle.heading : game.player.heading;
    mm.save();
    mm.translate(toX(p.x), toY(p.z));
    mm.rotate(Math.atan2(Math.sin(h), Math.cos(h)));
    mm.fillStyle = '#ffffff';
    mm.strokeStyle = '#202020';
    mm.lineWidth = 1;
    mm.beginPath();
    mm.moveTo(0, -8);
    mm.lineTo(5, 6);
    mm.lineTo(0, 3);
    mm.lineTo(-5, 6);
    mm.closePath();
    mm.fill();
    mm.stroke();
    mm.restore();
    // North tick.
    mm.fillStyle = '#ffffff';
    mm.font = 'bold 11px sans-serif';
    mm.fillText('N', 4, 12);
  };

  const update = (dt, time) => {
    const p = game.player;
    const hp = Math.max(0, Math.round(p.health));
    els.healthFill.style.width = `${hp}%`;
    els.healthFill.classList.toggle('low', hp <= 30);
    els.healthText.textContent = `${hp}`;
    els.money.textContent = fmtMoney(p.money);
    const speedKmh = p.inVehicle ? Math.round(Math.abs(p.vehicle.speed) * 3.6) : Math.round(p.speed * 3.6);
    els.speed.textContent = p.inVehicle ? `${speedKmh} km/h` : '';
    els.ammo.textContent = game.combat.reloading ? 'RELOADING…' : `AMMO ${game.combat.ammo}/${game.combat.magSize}`;
    els.radio.textContent = `♪ ${game.audio.radioName}${game.audio.isMuted ? ' (muted)' : ''}`;
    // In-game clock: one game hour per two real minutes, starting 09:00.
    const totalMin = 9 * 60 + Math.floor(time * 0.5);
    const hh = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
    const mi = String(totalMin % 60).padStart(2, '0');
    els.clock.textContent = `${hh}:${mi}  •  Missions ${game.missions.completedCount}/5`;
    drawMinimap();
  };

  const selftestLine = (text, ok) => {
    const div = document.createElement('div');
    div.textContent = `${ok === true ? 'PASS' : ok === false ? 'FAIL' : '··'} ${text}`;
    div.className = ok === true ? 'st-pass' : ok === false ? 'st-fail' : 'st-info';
    els.selftest.appendChild(div);
  };

  return {
    els,
    setStars,
    setObjective,
    toast,
    flashDamage,
    showMenu,
    showPause,
    showDead,
    showBusted,
    update,
    selftestLine,
  };
}
