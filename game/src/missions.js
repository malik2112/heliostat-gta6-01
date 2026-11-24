// HELIOSTAT — story missions. Five jobs for Ray's crew, each a short chain
// of steps: go somewhere, steal a marked car, clear out enemies, chase a
// runner down. A light beacon marks the current objective in the world and
// the HUD narrates it; finishing a job pays cash and unlocks the next.

import * as THREE from 'three';
import { CFG, MISSIONS, dist2d, fmtMoney } from './config.js';

export function createMissions(game) {
  const state = {
    index: 0, // next mission to start
    active: null, // { def, step, kills, targetCar, chaseCar, spawned }
    completed: [],
  };

  // The beacon: a tall glowing cylinder plus a pulsing ring on the ground.
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffd840, transparent: true, opacity: 0.35, depthWrite: false,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 90, 14, 1, true), beaconMat);
  beacon.visible = false;
  game.scene.add(beacon);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(8, 10, 28),
    new THREE.MeshBasicMaterial({ color: 0xffd840, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  game.scene.add(ring);

  const currentStep = () => (state.active ? state.active.def.steps[state.active.step] : null);
  const stepLabel = () => {
    const s = currentStep();
    return s ? s.label : '';
  };

  const placeBeacon = (x, z) => {
    beacon.position.set(x, 45, z);
    beacon.visible = true;
    ring.position.set(x, 0.12, z);
    ring.visible = true;
  };
  const hideBeacon = () => {
    beacon.visible = false;
    ring.visible = false;
  };

  const spawnStepActors = () => {
    const s = currentStep();
    if (!s || state.active.spawned) return;
    state.active.spawned = true;
    if (s.type === 'clear') {
      state.active.kills = 0;
      state.active.needKills = s.count;
      for (let i = 0; i < s.count + 1; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 6 + Math.random() * (s.radius - 6);
        game.combat.spawnEnemy(s.x + Math.sin(a) * r, s.z + Math.cos(a) * r, 'runner');
      }
    }
    if (s.type === 'steal') {
      state.active.targetCar = game.vehicles.spawnMissionCar(s.car === 'comet' ? 'Comet' : 'Dune', s.x, s.z, 0);
    }
    if (s.type === 'chase') {
      const car = game.vehicles.spawnMissionCar('Sol', s.x, s.z, Math.PI);
      car.isTraffic = true;
      car.trafficAxis = 'z';
      car.trafficDir = -1;
      car.trafficLane = 0;
      car.speed = CFG.trafficSpeed * 1.7;
      state.active.chaseCar = car;
      state.active.chaseCarMaxHealth = 100;
    }
  };

  const startMission = (i) => {
    const def = MISSIONS[i];
    if (!def || state.active) return false;
    state.active = { def, step: 0, kills: 0, needKills: 0, targetCar: null, chaseCar: null, spawned: false };
    game.hud.toast(`Mission: ${def.title} — ${def.brief}`);
    game.hud.setObjective(def.title, stepLabel());
    game.audio.pickup();
    spawnStepActors();
    const s = currentStep();
    if (s) placeBeacon(s.x, s.z);
    return true;
  };

  const advanceStep = () => {
    const a = state.active;
    a.step++;
    a.spawned = false;
    if (a.step >= a.def.steps.length) {
      completeMission();
      return;
    }
    spawnStepActors();
    const s = currentStep();
    if (s) placeBeacon(s.x, s.z);
    game.hud.setObjective(a.def.title, stepLabel());
    game.audio.pickup();
  };

  const completeMission = () => {
    const a = state.active;
    const reward = CFG.missionReward[state.index] || 500;
    game.player.addMoney(reward);
    game.audio.missionDone();
    game.hud.toast(`Mission complete: ${a.def.title} — ${fmtMoney(reward)} earned`);
    state.completed.push(a.def.id);
    state.index = Math.min(state.index + 1, MISSIONS.length);
    state.active = null;
    hideBeacon();
    game.save();
    if (state.index >= MISSIONS.length) {
      game.hud.toast('All missions complete — Heliostat is yours. Free roam!');
    } else {
      game.hud.setObjective('Next job', `${MISSIONS[state.index].title} — press M1 area or find Ray`);
    }
  };

  const failMission = (why) => {
    const a = state.active;
    if (!a) return;
    game.audio.missionFail();
    game.hud.toast(`Mission failed: ${a.def.title} — ${why}`);
    cleanupActors();
    state.active = null;
    hideBeacon();
    game.hud.setObjective('Free roam', 'Find Ray at the solar tower to retry');
  };

  const cleanupActors = () => {
    const a = state.active;
    if (!a) return;
    if (a.targetCar) {
      game.vehicles.removeVehicle(a.targetCar);
      a.targetCar = null;
    }
    if (a.chaseCar) {
      game.vehicles.removeVehicle(a.chaseCar);
      a.chaseCar = null;
    }
  };

  const onEnemyKilled = (enemy) => {
    const a = state.active;
    if (!a) return;
    const s = currentStep();
    if (s && s.type === 'clear') {
      a.kills++;
      game.hud.setObjective(a.def.title, `${s.label} (${a.kills}/${a.needKills})`);
      if (a.kills >= a.needKills) advanceStep();
    }
  };

  const onTargetCarDestroyed = (car) => {
    const a = state.active;
    if (!a) return;
    const s = currentStep();
    if (s && s.type === 'chase' && car === a.chaseCar) failMission('the van was destroyed');
  };

  const update = (dt, time) => {
    const a = state.active;
    if (!a) return;
    const s = currentStep();
    if (!s) return;
    const p = game.player.pos;
    // Beacon pulse.
    const pulse = 1 + Math.sin(time * 3) * 0.12;
    ring.scale.set(pulse, pulse, 1);
    beaconMat.opacity = 0.28 + Math.sin(time * 3) * 0.1;
    if (s.type === 'goto' || s.type === 'deliver') {
      const radius = s.radius || 10;
      const d = dist2d(p.x, p.z, s.x, s.z);
      if (s.type === 'deliver' && s.inCar && !game.player.inVehicle) {
        // Waiting for the player to be in a car; beacon stays put.
      } else if (s.type === 'deliver' && s.needStars !== undefined) {
        if (d < radius && game.wanted.stars <= s.needStars) advanceStep();
      } else if (d < radius) {
        advanceStep();
      }
    } else if (s.type === 'steal') {
      if (a.targetCar && game.player.inVehicle && game.player.vehicle === a.targetCar) {
        game.hud.toast('Got the Comet — now lose it at the lockup');
        advanceStep();
      }
    } else if (s.type === 'chase') {
      const car = a.chaseCar;
      if (!car) return;
      placeBeacon(car.pos.x, car.pos.z);
      // Ramming drains the van; shooting it does too (via combat health).
      const d = dist2d(p.x, p.z, car.pos.x, car.pos.z);
      if (game.player.inVehicle && d < 3.4 && Math.abs(game.player.vehicle.speed) > 4) {
        car.health = Math.max(0, car.health - 26 * dt);
        if (Math.random() < dt * 6) game.audio.crash(0.4);
      }
      if (car.health <= 0) {
        game.hud.toast('Van stopped — grab the ledger');
        advanceStep();
      } else if (dist2d(car.pos.x, car.pos.z, s.x, s.z) > 320) {
        failMission('the van got away');
      }
    }
  };

  return {
    state,
    startMission,
    failMission,
    onEnemyKilled,
    onTargetCarDestroyed,
    update,
    stepLabel,
    get active() { return state.active; },
    get nextIndex() { return state.index; },
    get completedCount() { return state.completed.length; },
    get markerPos() {
      const s = currentStep();
      if (!s) return null;
      const a = state.active;
      if (s.type === 'chase' && a.chaseCar) return { x: a.chaseCar.pos.x, z: a.chaseCar.pos.z };
      return { x: s.x, z: s.z };
    },
    get nextMissionTitle() {
      return state.index < MISSIONS.length ? MISSIONS[state.index].title : null;
    },
  };
}
