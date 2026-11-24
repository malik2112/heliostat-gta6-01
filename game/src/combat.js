// HELIOSTAT — combat. Hitscan shooting with tracers and sparks, armed
// enemies who advance and shoot back, and a little particle system for
// impacts. Enemies are the mission "runners" and the foot cops the wanted
// system sends.

import * as THREE from 'three';
import { CFG, rand, clamp, dist2d, angleLerp } from './config.js';

function makeEnemyMesh(kind) {
  const g = new THREE.Group();
  const shirt = kind === 'cop' ? 0x1a2a4a : 0x8a2a2a;
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.76, 0.34),
    new THREE.MeshLambertMaterial({ color: shirt }),
  );
  torso.position.y = 1.12;
  g.add(torso);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.23, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xc89070 }),
  );
  head.position.y = 1.74;
  g.add(head);
  if (kind === 'cop') {
    const hat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.28, 0.12, 10),
      new THREE.MeshLambertMaterial({ color: 0x101020 }),
    );
    hat.position.y = 1.94;
    g.add(hat);
  } else {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.1, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xd82020 }),
    );
    band.position.y = 1.86;
    g.add(band);
  }
  const legL = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.72, 0.24),
    new THREE.MeshLambertMaterial({ color: 0x2a2a2a }),
  );
  legL.position.set(-0.16, 0.36, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  g.add(legR);
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.1, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x111111 }),
  );
  gun.position.set(0.3, 1.15, 0.3);
  g.add(gun);
  return { group: g, legL, legR };
}

export function createCombat(scene, game) {
  const enemies = [];
  const tracers = [];
  const sparks = [];
  let ammo = CFG.magSize;
  let reloading = false;
  let reloadT = 0;
  let shotCooldown = 0;

  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe080, transparent: true, opacity: 0.9 });

  const spawnTracer = (from, to) => {
    const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const line = new THREE.Line(geo, tracerMat.clone());
    scene.add(line);
    tracers.push({ line, life: 0.09 });
  };

  const spawnSparks = (at, color = 0xffc860) => {
    const n = 10;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const vel = [];
    for (let i = 0; i < n; i++) {
      pos[i * 3] = at.x;
      pos[i * 3 + 1] = at.y;
      pos[i * 3 + 2] = at.z;
      vel.push(new THREE.Vector3(rand(-1, 1), rand(0, 1.4), rand(-1, 1)).multiplyScalar(rand(2, 6)));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.22 }));
    scene.add(pts);
    sparks.push({ pts, vel, life: 0.45 });
  };

  // Ray vs a vertical capsule approximated as a sphere at chest height.
  const rayHitsTarget = (origin, dir, targetPos, radius) => {
    const ox = targetPos.x - origin.x;
    const oy = 1.15 - origin.y;
    const oz = targetPos.z - origin.z;
    const t = ox * dir.x + oy * dir.y + oz * dir.z;
    if (t < 0 || t > CFG.shotRange) return -1;
    const cx = origin.x + dir.x * t;
    const cy = origin.y + dir.y * t;
    const cz = origin.z + dir.z * t;
    const d = Math.hypot(cx - targetPos.x, cy - 1.15, cz - targetPos.z);
    return d < radius + 0.45 ? t : -1;
  };

  const spawnEnemy = (x, z, kind = 'runner') => {
    const built = makeEnemyMesh(kind);
    built.group.position.set(x, 0, z);
    scene.add(built.group);
    const e = {
      kind,
      mesh: built.group,
      parts: built,
      pos: new THREE.Vector3(x, 0, z),
      heading: rand(0, Math.PI * 2),
      health: CFG.enemyHealth,
      shootT: rand(0.6, 1.6),
      phase: rand(0, Math.PI * 2),
      alive: true,
    };
    enemies.push(e);
    return e;
  };

  const removeEnemy = (e) => {
    scene.remove(e.mesh);
    const i = enemies.indexOf(e);
    if (i >= 0) enemies.splice(i, 1);
  };

  const shoot = (origin, dir) => {
    if (shotCooldown > 0 || reloading) return 'busy';
    if (ammo <= 0) {
      startReload();
      return 'empty';
    }
    shotCooldown = 0.16;
    ammo--;
    game.audio.gunshot();
    // Find the closest thing the ray hits: enemies first, then peds, then cars.
    let bestT = CFG.shotRange;
    let bestKind = null;
    let bestRef = null;
    for (const e of enemies) {
      if (!e.alive) continue;
      const t = rayHitsTarget(origin, dir, e.pos, 0.6);
      if (t >= 0 && t < bestT) { bestT = t; bestKind = 'enemy'; bestRef = e; }
    }
    if (!bestRef) {
      for (const p of game.peds.peds) {
        if (!p.alive) continue;
        const t = rayHitsTarget(origin, dir, p.pos, 0.5);
        if (t >= 0 && t < bestT) { bestT = t; bestKind = 'ped'; bestRef = p; }
      }
    }
    if (!bestRef) {
      for (const v of game.vehicles.vehicles) {
        const t = rayHitsTarget(origin, dir, v.pos, 1.6);
        if (t >= 0 && t < bestT) { bestT = t; bestKind = 'car'; bestRef = v; }
      }
    }
    const end = new THREE.Vector3(
      origin.x + dir.x * bestT,
      origin.y + dir.y * bestT,
      origin.z + dir.z * bestT,
    );
    spawnTracer(origin, end);
    if (bestKind === 'enemy') {
      bestRef.health -= CFG.shotDamage;
      spawnSparks(end, 0xff5040);
      if (bestRef.health <= 0) {
        bestRef.alive = false;
        spawnSparks(new THREE.Vector3(bestRef.pos.x, 1.2, bestRef.pos.z), 0xff2020);
        removeEnemy(bestRef);
        game.onEnemyKilled(bestRef);
      }
      return 'hit-enemy';
    }
    if (bestKind === 'ped') {
      bestRef.alive = false;
      bestRef.mesh.visible = false;
      spawnSparks(end, 0xff2020);
      game.onPedKilled(bestRef);
      return 'hit-ped';
    }
    if (bestKind === 'car') {
      bestRef.health = Math.max(0, bestRef.health - CFG.shotDamage * 0.4);
      spawnSparks(end, 0xffc860);
      if (bestRef.health <= 0 && bestRef.isTarget) game.onTargetCarDestroyed(bestRef);
      return 'hit-car';
    }
    spawnSparks(end, 0xd8c8a0);
    return 'miss';
  };

  const startReload = () => {
    if (reloading || ammo === CFG.magSize) return;
    reloading = true;
    reloadT = CFG.reloadSeconds;
  };

  const update = (dt, playerPos, playerAlive) => {
    shotCooldown = Math.max(0, shotCooldown - dt);
    if (reloading) {
      reloadT -= dt;
      if (reloadT <= 0) {
        reloading = false;
        ammo = CFG.magSize;
      }
    }
    for (const t of tracers) t.life -= dt;
    for (let i = tracers.length - 1; i >= 0; i--) {
      if (tracers[i].life <= 0) {
        scene.remove(tracers[i].line);
        tracers.splice(i, 1);
      }
    }
    for (const s of sparks) {
      s.life -= dt;
      const arr = s.pts.geometry.attributes.position.array;
      for (let i = 0; i < s.vel.length; i++) {
        arr[i * 3] += s.vel[i].x * dt;
        arr[i * 3 + 1] += s.vel[i].y * dt;
        arr[i * 3 + 2] += s.vel[i].z * dt;
        s.vel[i].y -= 9 * dt;
      }
      s.pts.geometry.attributes.position.needsUpdate = true;
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      if (sparks[i].life <= 0) {
        scene.remove(sparks[i].pts);
        sparks.splice(i, 1);
      }
    }
    // Enemy AI: close in to 14 m, strafe a little, shoot with inaccuracy.
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = dist2d(e.pos.x, e.pos.z, playerPos.x, playerPos.z);
      const want = Math.atan2(playerPos.x - e.pos.x, playerPos.z - e.pos.z);
      e.heading = angleLerp(e.heading, want, dt * 6);
      if (d > 14) {
        e.pos.x += Math.sin(e.heading) * 4.2 * dt;
        e.pos.z += Math.cos(e.heading) * 4.2 * dt;
        e.phase += dt * 7;
      } else if (d < 6) {
        e.pos.x -= Math.sin(e.heading) * 2 * dt;
        e.pos.z -= Math.cos(e.heading) * 2 * dt;
      }
      e.pos.x = clamp(e.pos.x, -CFG.worldHalf + 4, CFG.worldHalf - 4);
      e.pos.z = clamp(e.pos.z, -CFG.worldHalf + 4, CFG.worldHalf - 4);
      game.city.resolveCollision(e.pos, 0.5);
      e.mesh.position.copy(e.pos);
      e.mesh.rotation.y = e.heading;
      const swing = Math.sin(e.phase) * 0.45;
      e.parts.legL.rotation.x = swing;
      e.parts.legR.rotation.x = -swing;
      if (playerAlive && d < 46) {
        e.shootT -= dt;
        if (e.shootT <= 0) {
          e.shootT = rand(0.9, 1.9);
          game.audio.enemyShot();
          const from = new THREE.Vector3(e.pos.x, 1.35, e.pos.z);
          const to = new THREE.Vector3(playerPos.x, 1.1, playerPos.z);
          // Inaccuracy grows with distance; point-blank shots usually land.
          const miss = clamp(d / 46, 0.15, 0.8);
          if (Math.random() > miss) {
            game.player.takeDamage(CFG.enemyShotDamage);
            game.audio.hurt();
            game.hud.flashDamage();
          } else {
            to.x += rand(-3, 3);
            to.z += rand(-3, 3);
          }
          spawnTracer(from, to);
        }
      }
    }
  };

  return {
    enemies,
    spawnEnemy,
    removeEnemy,
    shoot,
    startReload,
    update,
    get ammo() { return ammo; },
    get reloading() { return reloading; },
    get magSize() { return CFG.magSize; },
  };
}
