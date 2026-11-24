// HELIOSTAT — boot and the game loop. Builds the renderer, the city and
// every system, wires input, runs the frame loop, and owns the camera.
// ?selftest=1 runs the in-browser self-test; ?shot=<name> stages a
// screenshot scene. window.__heliostatReady marks a booted frame,
// window.__shotReady marks a settled screenshot scene.

import * as THREE from 'three';
import { CFG, KEYS, clamp, angleLerp, wrapAngle } from './config.js';
import { buildCity } from './city.js';
import { createAudio } from './audio.js';
import { createPlayer } from './player.js';
import { createVehicles } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createCombat } from './combat.js';
import { createWanted } from './wanted.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { saveGame, loadGame } from './save.js';
import { runSelfTest } from './selftest.js';
import { stageShot, shotSettled } from './shots.js';

const params = new URLSearchParams(location.search);
const shotParam = params.get('shot');
const selftestParam = params.get('selftest') === '1';

// --- renderer / scene -------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1600);

// --- systems ----------------------------------------------------------
const city = buildCity(scene);
const audio = createAudio();
const player = createPlayer(scene, city);
const vehicles = createVehicles(scene, city, audio);
const peds = createPedestrians(scene, city);
vehicles.spawnParked(CFG.parkedCount);
vehicles.spawnTraffic(CFG.trafficCount);

const input = { up: false, down: false, left: false, right: false, sprint: false };
const stats = { bestStars: 0, kills: 0, playSeconds: 0 };
let time = 0;
let state = 'menu'; // menu | playing | paused | dead
let camYaw = player.heading;
let camYawOffset = 0;
let dragging = false;
let lastDragX = 0;
let shotMode = null;
let shotFrames = 0;
let camPreset = null;
let shotReadyRaised = false;
let lastShotAt = null;
let lastShotTime = -100;
let bustedTimer = null;

const game = {
  scene,
  renderer,
  camera,
  city,
  audio,
  player,
  vehicles,
  peds,
  input,
  stats,
  get time() { return time; },
  get state() { return state; },
  set state(v) { state = v; },
  get shotMode() { return shotMode; },
  set shotMode(v) { shotMode = v; },
  get shotFrames() { return shotFrames; },
  set shotFrames(v) { shotFrames = v; },
  get camPreset() { return camPreset; },
  set camPreset(v) { camPreset = v; },
  combat: null,
  wanted: null,
  missions: null,
  hud: null,
};

const combat = createCombat(scene, game);
const wanted = createWanted(game);
const missions = createMissions(game);
const hud = createHud(game);
game.combat = combat;
game.wanted = wanted;
game.missions = missions;
game.hud = hud;

// --- game actions -----------------------------------------------------
game.save = () => saveGame(game);
game.loadSaveData = () => loadGame();

game.enterCar = (car) => {
  if (player.inVehicle || !car) return false;
  if (car.isParked && !car.isTarget) wanted.addHeat(CFG.heatPerCrime.steal, time);
  player.teleport(car.pos.x, car.pos.z, car.heading);
  car.occupied = true;
  car.isParked = false;
  car.isTraffic = false;
  player.enterVehicle(car);
  audio.setEngine(0, true);
  hud.toast(`Driving the ${car.def.name} — W/S to drive, E to get out`);
  return true;
};

game.exitCar = () => {
  const car = player.vehicle;
  if (!car) return false;
  const rx = Math.cos(car.heading);
  const rz = -Math.sin(car.heading);
  player.exitVehicle({ x: car.pos.x + rx * 2.6, y: 0, z: car.pos.z + rz * 2.6 });
  car.occupied = false;
  audio.setEngine(0, false);
  return true;
};

game.shootOrigin = () => new THREE.Vector3(player.pos.x, player.pos.y + 1.5, player.pos.z);
game.shootDir = () => {
  let best = null;
  let bestD = 1e9;
  for (const e of combat.enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
    if (d < bestD) { bestD = d; best = e; }
  }
  if (best) {
    return new THREE.Vector3(best.pos.x - player.pos.x, 1.15 - 1.5, best.pos.z - player.pos.z).normalize();
  }
  return new THREE.Vector3(Math.sin(camYaw), -0.08, Math.cos(camYaw)).normalize();
};

game.onEnemyKilled = (enemy) => {
  stats.kills++;
  if (enemy.kind === 'cop') wanted.addHeat(CFG.heatPerCrime.kill, time);
  missions.onEnemyKilled(enemy);
};

game.onPedKilled = () => {
  wanted.addHeat(CFG.heatPerCrime.kill, time);
};

game.onTargetCarDestroyed = (car) => {
  missions.onTargetCarDestroyed(car);
};

game.onBusted = () => {
  audio.busted();
  const fine = Math.min(Math.round(player.money * 0.2), Math.max(0, player.money - 50));
  player.addMoney(-fine);
  wanted.clear();
  if (player.inVehicle) game.exitCar();
  player.teleport(city.spawn.player.x, city.spawn.player.z);
  hud.showBusted(true);
  hud.toast(`BUSTED — fined $${fine.toLocaleString('en-US')}`);
  if (bustedTimer) clearTimeout(bustedTimer);
  bustedTimer = setTimeout(() => hud.showBusted(false), 2600);
};

game.stageShot = (name) => stageShot(game, name);

const startGame = () => {
  audio.unlock();
  audio.startRadio();
  const saved = loadGame();
  if (saved) {
    player.addMoney(saved.money - player.money);
    missions.state.index = Math.min(saved.missionIndex || 0, 5);
    missions.state.completed = saved.completed || [];
    stats.bestStars = saved.bestStars || 0;
    stats.kills = saved.kills || 0;
    hud.toast(`Welcome back — ${missions.completedCount}/5 missions done, ${fmtMoney(saved.money)} in pocket`);
  }
  state = 'playing';
  hud.showMenu(false);
  hud.setObjective(
    missions.nextMissionTitle ? missions.nextMissionTitle : 'Free roam',
    missions.nextMissionTitle ? 'Find Ray at the solar tower (north-east) to start the job' : 'All missions done — Sun City is yours',
  );
  hud.toast('WASD move • E steal car • Click shoot • R reload • 1/2/3 radio • P pause');
  audio.uiClick();
};

const die = () => {
  state = 'dead';
  hud.showDead(true);
  if (missions.active) missions.failMission('you died');
  audio.setEngine(0, false);
};

const respawn = () => {
  player.respawn();
  wanted.clear();
  state = 'playing';
  hud.showDead(false);
  hud.toast('Back on your feet. Stay out of trouble — or don’t.');
};

// --- input ------------------------------------------------------------
const keyMatches = (e, list) => list.includes(e.code);
window.addEventListener('keydown', (e) => {
  if (keyMatches(e, KEYS.up)) input.up = true;
  if (keyMatches(e, KEYS.down)) input.down = true;
  if (keyMatches(e, KEYS.left)) input.left = true;
  if (keyMatches(e, KEYS.right)) input.right = true;
  if (keyMatches(e, KEYS.sprint)) input.sprint = true;
  if (e.repeat) return;
  if (keyMatches(e, KEYS.enter) && state === 'playing') {
    if (player.inVehicle) game.exitCar();
    else {
      const car = vehicles.nearestCar(player.pos, 4);
      if (car) game.enterCar(car);
    }
  }
  if (keyMatches(e, KEYS.reload) && state === 'playing') combat.startReload();
  if (keyMatches(e, KEYS.pause)) {
    if (state === 'playing') { state = 'paused'; hud.showPause(true); }
    else if (state === 'paused') { state = 'playing'; hud.showPause(false); }
  }
  if (keyMatches(e, KEYS.radio)) {
    const i = Number(e.code.replace('Digit', '')) - 1;
    audio.setRadio(i);
  }
  if (keyMatches(e, KEYS.mute)) {
    const m = audio.toggleMute();
    hud.toast(m ? 'Sound muted' : 'Sound on');
  }
  if (e.code === 'Enter' && (state === 'menu' || state === 'dead')) {
    if (state === 'menu') startGame();
    else respawn();
  }
  if (e.code === 'KeyG' && state === 'playing' && !missions.active && missions.nextIndex < 5) {
    missions.startMission(missions.nextIndex);
  }
});
window.addEventListener('keyup', (e) => {
  if (keyMatches(e, KEYS.up)) input.up = false;
  if (keyMatches(e, KEYS.down)) input.down = false;
  if (keyMatches(e, KEYS.left)) input.left = false;
  if (keyMatches(e, KEYS.right)) input.right = false;
  if (keyMatches(e, KEYS.sprint)) input.sprint = false;
});

renderer.domElement.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (state !== 'playing') return;
  dragging = true;
  lastDragX = e.clientX;
  if (e.button === 0) {
    // Shoot toward the screen centre.
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    const origin = camera.position.clone();
    const result = combat.shoot(origin, dir);
    lastShotAt = { x: player.pos.x, z: player.pos.z, radius: 26 };
    lastShotTime = time;
    if (result !== 'busy' && result !== 'empty') wanted.addHeat(CFG.heatPerCrime.shoot, time);
    if (result === 'empty') hud.toast('Out of ammo — press R to reload');
  }
});
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  camYawOffset += (e.clientX - lastDragX) * 0.005;
  lastDragX = e.clientX;
});
window.addEventListener('pointerup', () => { dragging = false; });
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('resume-btn').addEventListener('click', () => {
  state = 'playing';
  hud.showPause(false);
});
document.getElementById('respawn-btn').addEventListener('click', respawn);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- camera -----------------------------------------------------------
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  if (camPreset) {
    camera.position.set(camPreset.x, camPreset.y, camPreset.z);
    camera.lookAt(camPreset.lookX, camPreset.lookY, camPreset.lookZ);
    return;
  }
  const heading = player.inVehicle ? player.vehicle.heading : player.heading;
  camYaw = angleLerp(camYaw, heading + camYawOffset, 1 - Math.pow(0.001, dt));
  camYawOffset = angleLerp(camYawOffset, 0, dt * 0.4);
  const dist = player.inVehicle ? 11 : 7.5;
  const height = player.inVehicle ? 4.6 : 3.6;
  const fx = Math.sin(camYaw);
  const fz = Math.cos(camYaw);
  const px = player.pos.x;
  const pz = player.pos.z;
  const wantX = px - fx * dist;
  const wantZ = pz - fz * dist;
  camera.position.x = THREE.MathUtils.lerp(camera.position.x, wantX, 1 - Math.pow(0.0001, dt));
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, height, 1 - Math.pow(0.0001, dt));
  camera.position.z = THREE.MathUtils.lerp(camera.position.z, wantZ, 1 - Math.pow(0.0001, dt));
  camTarget.set(px + fx * 5, 1.4, pz + fz * 5);
  camera.lookAt(camTarget);
}

// --- loop -------------------------------------------------------------
const clock = new THREE.Clock();
let firstFrame = true;
let selftestStarted = false;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;

  if (state === 'playing') {
    stats.playSeconds += dt;
    if (wanted.stars > stats.bestStars) stats.bestStars = wanted.stars;
    player.update(dt, input, camYaw);
    vehicles.update(dt, player.vehicle, input, player.pos);
    if (player.inVehicle) player.pos.copy(player.vehicle.pos);
    const danger = lastShotAt && time - lastShotTime < 3 ? lastShotAt : null;
    const fastCar = player.inVehicle && Math.abs(player.vehicle.speed) > 14
      ? { x: player.pos.x, z: player.pos.z, radius: 12 }
      : null;
    peds.update(dt, time, danger || fastCar);
    combat.update(dt, player.pos, !player.dead);
    wanted.update(dt, time);
    missions.update(dt, time);
    if (player.dead) die();
    const speed01 = player.inVehicle ? Math.abs(player.vehicle.speed) / CFG.carMaxSpeed : 0;
    audio.setEngine(speed01, player.inVehicle);
  } else if (state === 'menu') {
    // Slow orbit over the city behind the title screen.
    const a = time * 0.05;
    camera.position.set(Math.sin(a) * 260, 110, Math.cos(a) * 260);
    camera.lookAt(0, 0, 0);
    vehicles.update(dt, null, input, null);
    peds.update(dt, time, null);
  }

  hud.update(dt, time);
  if (state !== 'menu') updateCamera(dt);

  if (shotMode && !shotReadyRaised && shotSettled(game)) {
    shotReadyRaised = true;
    window.__shotReady = true;
  }
  renderer.render(scene, camera);

  if (firstFrame) {
    firstFrame = false;
    window.__heliostatReady = true;
    window.__heliostatGame = game;
    if (shotParam) {
      stageShot(game, shotParam);
    } else if (selftestParam && !selftestStarted) {
      selftestStarted = true;
      state = 'playing';
      hud.showMenu(false);
      void runSelfTest(game);
    }
  }
}

function fmtMoney(n) {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

hud.setStars(0);
hud.setObjective('HELIOSTAT', 'Sun City — an open-world crime story. Press ENTER or click START.');
frame();
