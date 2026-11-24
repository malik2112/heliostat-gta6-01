// HELIOSTAT — the player on foot. A low-poly figure (shirt, jeans, cap)
// that walks, sprints, and gets in and out of cars. The camera looks over
// his shoulder; movement is relative to the camera yaw.

import * as THREE from 'three';
import { CFG, clamp, angleLerp } from './config.js';

function limb(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.position.set(x, y, z);
  return m;
}

export function createPlayer(scene, city) {
  const group = new THREE.Group();
  const shirt = 0x2a7a4a;
  const jeans = 0x2a3a5a;
  const skin = 0xd8a080;

  const torso = limb(0.62, 0.78, 0.34, shirt, 0, 1.15, 0);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 12, 10),
    new THREE.MeshLambertMaterial({ color: skin }),
  );
  head.position.set(0, 1.78, 0);
  const cap = limb(0.5, 0.12, 0.5, 0xc03028, 0, 1.98, 0);
  const brim = limb(0.5, 0.05, 0.28, 0xc03028, 0, 1.94, 0.3);
  const legL = limb(0.24, 0.78, 0.26, jeans, -0.17, 0.39, 0);
  const legR = limb(0.24, 0.78, 0.26, jeans, 0.17, 0.39, 0);
  const armL = limb(0.2, 0.66, 0.22, shirt, -0.44, 1.18, 0);
  const armR = limb(0.2, 0.66, 0.22, shirt, 0.44, 1.18, 0);
  // A pistol in the right hand, visible when armed.
  const gun = limb(0.08, 0.1, 0.42, 0x1a1a1a, 0.44, 0.82, 0.18);
  gun.visible = false;
  group.add(torso, head, cap, brim, legL, legR, armL, armR, gun);
  scene.add(group);

  const state = {
    pos: new THREE.Vector3(city.spawn.player.x, 0, city.spawn.player.z),
    heading: Math.PI * 0.75,
    speed: 0,
    health: CFG.playerHealth,
    money: CFG.startCash,
    vehicle: null,
    armed: true,
    walkPhase: 0,
    dead: false,
    moving: false,
  };

  const update = (dt, input, camYaw) => {
    if (state.dead || state.vehicle) {
      state.moving = false;
      return;
    }
    let fx = 0;
    let fz = 0;
    if (input.up) fz -= 1;
    if (input.down) fz += 1;
    if (input.left) fx -= 1;
    if (input.right) fx += 1;
    const len = Math.hypot(fx, fz);
    state.moving = len > 0;
    if (len > 0) {
      fx /= len;
      fz /= len;
      // Rotate the input vector by the camera yaw so W always runs away
      // from the camera.
      const sin = Math.sin(camYaw);
      const cos = Math.cos(camYaw);
      const wx = fx * cos - fz * sin;
      const wz = fx * sin + fz * cos;
      const targetSpeed = input.sprint ? CFG.sprintSpeed : CFG.walkSpeed;
      state.speed = targetSpeed;
      state.pos.x += wx * targetSpeed * dt;
      state.pos.z += wz * targetSpeed * dt;
      state.heading = angleLerp(state.heading, Math.atan2(wx, wz), dt * 12);
      state.walkPhase += dt * targetSpeed * 1.6;
    } else {
      state.speed = 0;
      state.walkPhase = angleLerp(state.walkPhase, Math.round(state.walkPhase / Math.PI) * Math.PI, dt * 10);
    }
    // Stay inside the world and out of buildings.
    state.pos.x = clamp(state.pos.x, -CFG.worldHalf + 4, CFG.worldHalf - 4);
    state.pos.z = clamp(state.pos.z, -CFG.worldHalf + 4, CFG.worldHalf - 4);
    city.resolveCollision(state.pos, CFG.playerRadius);
    group.position.copy(state.pos);
    group.rotation.y = state.heading;
    // Walk cycle: legs and arms swing opposite, body bobs a touch.
    const swing = state.moving ? Math.sin(state.walkPhase) * 0.55 : 0;
    legL.rotation.x = swing;
    legR.rotation.x = -swing;
    armL.rotation.x = -swing * 0.8;
    armR.rotation.x = swing * 0.8;
    group.position.y = state.moving ? Math.abs(Math.sin(state.walkPhase)) * 0.06 : 0;
    gun.visible = state.armed;
  };

  return {
    group,
    state,
    get pos() {
      return state.pos;
    },
    get heading() {
      return state.heading;
    },
    get health() {
      return state.health;
    },
    get money() {
      return state.money;
    },
    get inVehicle() {
      return state.vehicle !== null;
    },
    get vehicle() {
      return state.vehicle;
    },
    get dead() {
      return state.dead;
    },
    get moving() {
      return state.moving;
    },
    addMoney(n) {
      state.money = Math.max(0, state.money + n);
    },
    takeDamage(n) {
      if (state.dead) return;
      state.health = Math.max(0, state.health - n);
      if (state.health <= 0) state.dead = true;
    },
    heal(n) {
      state.health = Math.min(CFG.playerHealth, state.health + n);
    },
    respawn() {
      state.health = CFG.playerHealth;
      state.dead = false;
      state.pos.set(city.spawn.player.x, 0, city.spawn.player.z);
      state.vehicle = null;
      group.visible = true;
    },
    enterVehicle(vehicle) {
      state.vehicle = vehicle;
      group.visible = false;
    },
    exitVehicle(at) {
      state.vehicle = null;
      state.pos.copy(at);
      state.pos.y = 0;
      group.visible = true;
      group.position.copy(state.pos);
    },
    teleport(x, z, heading) {
      state.pos.set(x, 0, z);
      if (heading !== undefined) state.heading = heading;
      group.position.copy(state.pos);
      group.rotation.y = state.heading;
    },
    update,
  };
}
