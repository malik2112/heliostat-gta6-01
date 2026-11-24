// HELIOSTAT — pedestrians. Townsfolk who stroll the sidewalks, cross at
// intersections, and run screaming when gunfire or a speeding car comes
// close. They keep the streets alive and give the wanted system witnesses.

import * as THREE from 'three';
import { CFG, PED_SHIRTS, PED_NAMES, rand, pick, clamp, dist2d, angleLerp } from './config.js';

function makePedMesh(shirtColor) {
  const g = new THREE.Group();
  const skin = pick([0xd8a080, 0xc89070, 0x8a5a3a, 0xe8b890]);
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.7, 0.3),
    new THREE.MeshLambertMaterial({ color: shirtColor }),
  );
  torso.position.y = 1.05;
  g.add(torso);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, 10, 8),
    new THREE.MeshLambertMaterial({ color: skin }),
  );
  head.position.y = 1.62;
  g.add(head);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshLambertMaterial({ color: pick([0x1a1a1a, 0x4a2a10, 0x808080, 0xd8b060]) }),
  );
  hair.position.y = 1.66;
  g.add(hair);
  const legL = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.68, 0.22),
    new THREE.MeshLambertMaterial({ color: pick([0x2a3a5a, 0x3a3a3a, 0x7a6a4a]) }),
  );
  legL.position.set(-0.14, 0.34, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.14;
  g.add(legR);
  const armL = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.6, 0.18),
    new THREE.MeshLambertMaterial({ color: shirtColor }),
  );
  armL.position.set(-0.38, 1.05, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.38;
  g.add(armR);
  return { group: g, legL, legR, armL, armR };
}

export function createPedestrians(scene, city) {
  const peds = [];

  const spawnOne = (x, z) => {
    const built = makePedMesh(pick(PED_SHIRTS));
    const start = x === undefined ? city.randomSidewalkPoint() : { x, z };
    built.group.position.set(start.x, 0, start.z);
    scene.add(built.group);
    const p = {
      name: pick(PED_NAMES),
      mesh: built.group,
      parts: built,
      pos: new THREE.Vector3(start.x, 0, start.z),
      heading: rand(0, Math.PI * 2),
      target: null,
      speed: rand(1.1, 2.1),
      phase: rand(0, Math.PI * 2),
      fleeing: false,
      fleeUntil: 0,
      alive: true,
    };
    peds.push(p);
    return p;
  };

  const pickTarget = (p) => {
    p.target = city.randomSidewalkPoint();
  };

  for (let i = 0; i < CFG.pedCount; i++) spawnOne();

  const update = (dt, time, danger) => {
    for (const p of peds) {
      if (!p.alive) continue;
      // Danger (gunfire / speeding car) makes nearby peds flee.
      if (danger) {
        const d = dist2d(p.pos.x, p.pos.z, danger.x, danger.z);
        if (d < danger.radius) {
          p.fleeing = true;
          p.fleeUntil = time + 4;
          const away = Math.atan2(p.pos.x - danger.x, p.pos.z - danger.z);
          p.target = {
            x: clamp(p.pos.x + Math.sin(away) * 40, -CFG.worldHalf + 5, CFG.worldHalf - 5),
            z: clamp(p.pos.z + Math.cos(away) * 40, -CFG.worldHalf + 5, CFG.worldHalf - 5),
          };
        }
      }
      if (p.fleeing && time > p.fleeUntil) p.fleeing = false;
      if (!p.target) pickTarget(p);
      const dx = p.target.x - p.pos.x;
      const dz = p.target.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 2) {
        if (p.fleeing) {
          p.fleeing = false;
          p.target = null;
        } else {
          pickTarget(p);
        }
        continue;
      }
      const want = Math.atan2(dx, dz);
      p.heading = angleLerp(p.heading, want, dt * 5);
      const speed = p.fleeing ? CFG.pedFleeSpeed : p.speed;
      p.pos.x += Math.sin(p.heading) * speed * dt;
      p.pos.z += Math.cos(p.heading) * speed * dt;
      p.pos.x = clamp(p.pos.x, -CFG.worldHalf + 4, CFG.worldHalf - 4);
      p.pos.z = clamp(p.pos.z, -CFG.worldHalf + 4, CFG.worldHalf - 4);
      city.resolveCollision(p.pos, 0.5);
      p.phase += dt * speed * 3.2;
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.y = p.heading;
      const swing = Math.sin(p.phase) * 0.5;
      p.parts.legL.rotation.x = swing;
      p.parts.legR.rotation.x = -swing;
      p.parts.armL.rotation.x = p.fleeing ? -2.4 : -swing * 0.7;
      p.parts.armR.rotation.x = p.fleeing ? -2.4 : swing * 0.7;
    }
  };

  return {
    peds,
    spawnOne,
    update,
    nearest(pos, maxDist) {
      let best = null;
      let bestD = maxDist;
      for (const p of peds) {
        if (!p.alive) continue;
        const d = dist2d(pos.x, pos.z, p.pos.x, p.pos.z);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      return best;
    },
    countAlive() {
      return peds.filter((p) => p.alive).length;
    },
  };
}
