// HELIOSTAT — vehicles. Arcade driving: one speed, one steering angle, a
// little drift. Parked cars wait to be stolen, traffic cruises the road
// grid and turns at intersections, police cars chase with flashing lights.

import * as THREE from 'three';
import { CFG, CAR_DEFS, rand, randi, pick, clamp, dist2d, angleLerp, wrapAngle } from './config.js';

function makeCarMesh(def, isPolice = false) {
  const g = new THREE.Group();
  const bodyColor = isPolice ? 0x1a1a20 : def.color;
  const bodyH = def.body === 'sport' ? 0.55 : def.body === 'truck' ? 0.95 : 0.75;
  const bodyLen = def.body === 'van' ? 4.9 : def.body === 'truck' ? 4.6 : 4.2;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, bodyH, bodyLen),
    new THREE.MeshLambertMaterial({ color: bodyColor }),
  );
  body.position.y = 0.55 + bodyH / 2 - 0.35;
  g.add(body);
  if (def.body !== 'truck') {
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.62, bodyLen * 0.45),
      new THREE.MeshLambertMaterial({ color: 0x1a2a3a }),
    );
    cabin.position.set(0, body.position.y + bodyH / 2 + 0.28, -bodyLen * 0.08);
    g.add(cabin);
  } else {
    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.5, 1.6),
      new THREE.MeshLambertMaterial({ color: 0x3a3a3a }),
    );
    bed.position.set(0, body.position.y + bodyH / 2 + 0.2, -1.2);
    g.add(bed);
  }
  // Wheels.
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  for (const [x, z] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.36, z);
    g.add(w);
    wheels.push(w);
  }
  // Headlights and taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xd82020 });
  for (const x of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.06), headMat);
    h.position.set(x, 0.62, bodyLen / 2 + 0.01);
    g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.06), tailMat);
    t.position.set(x, 0.62, -bodyLen / 2 - 0.01);
    g.add(t);
  }
  let lightBar = null;
  let lightL = null;
  let lightR = null;
  if (isPolice) {
    lightBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.18, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x222222 }),
    );
    lightBar.position.set(0, body.position.y + bodyH / 2 + 0.62, 0);
    g.add(lightBar);
    lightL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.52), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    lightL.position.set(-0.32, body.position.y + bodyH / 2 + 0.62, 0);
    g.add(lightL);
    lightR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.52), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    lightR.position.set(0.32, body.position.y + bodyH / 2 + 0.62, 0);
    g.add(lightR);
  }
  return { group: g, wheels, lightL, lightR, bodyLen };
}

export function createVehicles(scene, city, audio) {
  const vehicles = [];
  let idCounter = 0;

  const addVehicle = (def, x, z, heading, opts = {}) => {
    const built = makeCarMesh(def, opts.isPolice === true);
    built.group.position.set(x, 0, z);
    built.group.rotation.y = heading;
    scene.add(built.group);
    const v = {
      id: ++idCounter,
      def,
      mesh: built.group,
      wheels: built.wheels,
      lightL: built.lightL,
      lightR: built.lightR,
      pos: new THREE.Vector3(x, 0, z),
      heading,
      speed: 0,
      steer: 0,
      health: 100,
      isPolice: opts.isPolice === true,
      isTraffic: opts.isTraffic === true,
      isParked: opts.isParked === true,
      isTarget: opts.isTarget === true,
      occupied: false,
      trafficAxis: opts.trafficAxis || 'z',
      trafficDir: opts.trafficDir || 1,
      trafficLane: opts.trafficLane || 0,
      flashT: 0,
      stuckT: 0,
    };
    vehicles.push(v);
    return v;
  };

  const spawnParked = (n) => {
    for (let i = 0; i < n; i++) {
      const p = city.randomRoadPoint();
      const onX = city.roadXs.some((rx) => Math.abs(p.x - rx) < 1);
      const heading = onX ? (Math.random() < 0.5 ? 0 : Math.PI) : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      const off = pick([-1, 1]) * (CFG.roadHalfWidth - 1.6);
      const x = onX ? p.x + off : p.x;
      const z = onX ? p.z : p.z + off;
      addVehicle(pick(CAR_DEFS.filter((d) => d.body !== 'police')), x, z, heading, { isParked: true });
    }
  };

  const spawnTraffic = (n) => {
    for (let i = 0; i < n; i++) {
      const p = city.randomRoadPoint();
      const onX = city.roadXs.some((rx) => Math.abs(p.x - rx) < 1);
      const dir = pick([-1, 1]);
      const lane = pick([-1, 1]) * CFG.laneWidth * 0.5;
      const heading = onX ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      const v = addVehicle(pick(CAR_DEFS.filter((d) => d.body !== 'police')), p.x, p.z, heading, {
        isTraffic: true,
        trafficAxis: onX ? 'z' : 'x',
        trafficDir: dir,
        trafficLane: lane,
      });
      v.speed = rand(0.7, 1) * CFG.trafficSpeed;
    }
  };

  const spawnPoliceCar = (x, z) => {
    const def = CAR_DEFS.find((d) => d.body === 'police');
    return addVehicle(def, x, z, rand(0, Math.PI * 2), { isPolice: true });
  };

  const spawnMissionCar = (defName, x, z, heading) => {
    const def = CAR_DEFS.find((d) => d.name === defName) || CAR_DEFS[0];
    return addVehicle(def, x, z, heading, { isTarget: true, isParked: true });
  };

  const nearestCar = (pos, maxDist) => {
    let best = null;
    let bestD = maxDist;
    for (const v of vehicles) {
      const d = dist2d(pos.x, pos.z, v.pos.x, v.pos.z);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  };

  const drivePlayerCar = (v, input, dt) => {
    if (input.up) v.speed += CFG.carAccel * dt;
    else if (input.down) v.speed -= CFG.carBrake * dt * 0.7;
    else v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 6 * dt);
    // Handbrake-ish: S while moving forward brakes hard.
    if (input.down && v.speed > 0.5) v.speed -= CFG.carBrake * dt;
    v.speed = clamp(v.speed, -CFG.carMaxReverse, CFG.carMaxSpeed);
    const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const steerSign = v.speed >= 0 ? 1 : -1;
    v.steer = angleLerp(v.steer, steerTarget * CFG.carSteer, dt * 6);
    v.heading += v.steer * (Math.abs(v.speed) / CFG.carMaxSpeed) * CFG.carTurnGrip * steerSign * dt;
    const fx = Math.sin(v.heading);
    const fz = Math.cos(v.heading);
    v.pos.x += fx * v.speed * dt;
    v.pos.z += fz * v.speed * dt;
    v.pos.x = clamp(v.pos.x, -CFG.worldHalf + 3, CFG.worldHalf - 3);
    v.pos.z = clamp(v.pos.z, -CFG.worldHalf + 3, CFG.worldHalf - 3);
    if (city.resolveCollision(v.pos, 2.1)) {
      if (Math.abs(v.speed) > 8) audio.crash(Math.abs(v.speed) / CFG.carMaxSpeed);
      v.speed *= 0.35;
      v.health = Math.max(0, v.health - Math.abs(v.speed) * 0.2);
    }
  };

  const updateTraffic = (v, dt, playerPos) => {
    // Cruise along its road; at an intersection, sometimes turn.
    const fx = Math.sin(v.heading);
    const fz = Math.cos(v.heading);
    v.pos.x += fx * v.speed * dt;
    v.pos.z += fz * v.speed * dt;
    // Keep on its lane: nudge back toward the road line.
    const target = v.trafficAxis === 'z'
      ? city.nearestRoadX(v.pos.x) + v.trafficLane
      : city.nearestRoadZ(v.pos.z) + v.trafficLane;
    const along = v.trafficAxis === 'z' ? v.pos.x : v.pos.z;
    const wantHeading = v.trafficAxis === 'z'
      ? (v.trafficDir > 0 ? 0 : Math.PI)
      : (v.trafficDir > 0 ? Math.PI / 2 : -Math.PI / 2);
    v.heading = angleLerp(v.heading, wantHeading + clamp((target - along) * 0.06, -0.4, 0.4), dt * 2);
    // Intersection: chance to turn onto the crossing road.
    const nearX = city.roadXs.some((rx) => Math.abs(v.pos.x - rx) < 1.2);
    const nearZ = city.roadZs.some((rz) => Math.abs(v.pos.z - rz) < 1.2);
    if (nearX && nearZ && Math.random() < dt * 0.25) {
      v.trafficAxis = v.trafficAxis === 'z' ? 'x' : 'z';
      v.trafficDir = pick([-1, 1]);
      v.trafficLane = pick([-1, 1]) * CFG.laneWidth * 0.5;
    }
    // Slow down if something is right ahead.
    for (const o of vehicles) {
      if (o === v) continue;
      const dx = o.pos.x - v.pos.x;
      const dz = o.pos.z - v.pos.z;
      const ahead = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 9 && side < 2.4) {
        v.speed = Math.max(0, v.speed - 12 * dt);
        return;
      }
    }
    if (playerPos) {
      const d = dist2d(v.pos.x, v.pos.z, playerPos.x, playerPos.z);
      if (d < 7) v.speed = Math.max(0, v.speed - 14 * dt);
    }
    v.speed = Math.min(v.speed + 3 * dt, CFG.trafficSpeed);
    // Wrap around the far edge so traffic never runs out.
    if (v.pos.x > CFG.worldHalf - 5 || v.pos.x < -CFG.worldHalf + 5 || v.pos.z > CFG.worldHalf - 5 || v.pos.z < -CFG.worldHalf + 5) {
      const p = city.randomRoadPoint();
      v.pos.set(p.x, 0, p.z);
    }
  };

  const update = (dt, playerVehicle, playerInput, playerPos) => {
    for (const v of vehicles) {
      if (v === playerVehicle) {
        drivePlayerCar(v, playerInput, dt);
      } else if (v.isTraffic) {
        updateTraffic(v, dt, playerPos);
      } else if (v.isPolice && v.chaseTarget) {
        // Police chase: steer toward the target, faster than traffic.
        const dx = v.chaseTarget.x - v.pos.x;
        const dz = v.chaseTarget.z - v.pos.z;
        const want = Math.atan2(dx, dz);
        v.heading = angleLerp(v.heading, want, dt * 2.4);
        v.speed = Math.min(v.speed + 16 * dt, CFG.carMaxSpeed * 0.92);
        v.pos.x += Math.sin(v.heading) * v.speed * dt;
        v.pos.z += Math.cos(v.heading) * v.speed * dt;
        if (city.resolveCollision(v.pos, 2.1)) v.speed *= 0.5;
      }
      // Visuals.
      v.mesh.position.copy(v.pos);
      v.mesh.rotation.y = v.heading;
      const spin = v.speed * dt * 1.4;
      for (const w of v.wheels) w.rotation.x += spin;
      if (v.isPolice) {
        v.flashT += dt;
        const on = Math.floor(v.flashT * 6) % 2 === 0;
        if (v.lightL) v.lightL.visible = on;
        if (v.lightR) v.lightR.visible = !on;
      }
      // Gentle body roll with steering.
      v.mesh.rotation.z = -v.steer * 0.06 * clamp(Math.abs(v.speed) / 10, 0, 1);
    }
    // Car-to-car separation so parked rows and traffic don't overlap.
    for (let i = 0; i < vehicles.length; i++) {
      for (let j = i + 1; j < vehicles.length; j++) {
        const a = vehicles[i];
        const b = vehicles[j];
        const d = dist2d(a.pos.x, a.pos.z, b.pos.x, b.pos.z);
        if (d < 3.6 && d > 0.01) {
          const push = (3.6 - d) / 2;
          const nx = (b.pos.x - a.pos.x) / d;
          const nz = (b.pos.z - a.pos.z) / d;
          if (!a.occupied) { a.pos.x -= nx * push; a.pos.z -= nz * push; }
          if (!b.occupied) { b.pos.x += nx * push; b.pos.z += nz * push; }
        }
      }
    }
  };

  return {
    vehicles,
    spawnParked,
    spawnTraffic,
    spawnPoliceCar,
    spawnMissionCar,
    nearestCar,
    update,
    removeVehicle(v) {
      scene.remove(v.mesh);
      const i = vehicles.indexOf(v);
      if (i >= 0) vehicles.splice(i, 1);
    },
    count() {
      return vehicles.length;
    },
  };
}
