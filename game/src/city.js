// HELIOSTAT — the city. A sun-baked desert town on a road grid, a solar
// (heliostat) mirror field in the north-east corner, a motel, a diner, a
// market square, and a marina garage. Everything here is built from boxes,
// cylinders and canvas textures — no external assets.

import * as THREE from 'three';
import { CFG, PALETTE, rand, randi, pick, clamp } from './config.js';

// A small canvas texture of lit windows, shared by every building so the
// town reads as inhabited without a texture file.
function makeWindowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#b8a888';
  g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 22) {
    for (let x = 8; x < 120; x += 20) {
      const lit = Math.random() < 0.45;
      g.fillStyle = lit ? '#ffd880' : '#2a3a4a';
      g.fillRect(x, y, 12, 14);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function box(w, h, d, color, x, y, z, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color, ...(opts.mat || {}) }),
  );
  m.position.set(x, y, z);
  if (opts.ry) m.rotation.y = opts.ry;
  return m;
}

export function buildCity(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const half = CFG.worldHalf;
  const spacing = CFG.roadSpacing;

  // Sky, sun, fog.
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 180, 900);
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0xd8b080, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe8b8, 1.6);
  sun.position.set(220, 320, 120);
  scene.add(sun);
  const sunBall = new THREE.Mesh(
    new THREE.SphereGeometry(26, 20, 14),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }),
  );
  sunBall.position.set(420, 300, -560);
  scene.add(sunBall);

  // Desert ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 600, half * 2 + 600),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  group.add(ground);
  // Dunes: low flattened spheres scattered outside the road grid.
  const duneMat = new THREE.MeshLambertMaterial({ color: PALETTE.sandDark });
  for (let i = 0; i < 46; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(half + 40, half + 320);
    const dune = new THREE.Mesh(new THREE.SphereGeometry(rand(18, 55), 12, 8), duneMat);
    dune.scale.y = 0.18;
    dune.position.set(Math.cos(a) * r, -1, Math.sin(a) * r);
    group.add(dune);
  }

  // Roads: one asphalt strip per grid line, both directions, plus dashes.
  const roadXs = [];
  const roadZs = [];
  for (let v = -half + spacing / 2; v <= half; v += spacing) {
    roadXs.push(v);
    roadZs.push(v);
  }
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  const dashMat = new THREE.MeshBasicMaterial({ color: PALETTE.asphaltLine });
  for (const x of roadXs) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(CFG.roadHalfWidth * 2, half * 2), roadMat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(x, 0, 0);
    group.add(strip);
    for (let z = -half; z < half; z += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 4), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.01, z);
      group.add(dash);
    }
  }
  for (const z of roadZs) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, CFG.roadHalfWidth * 2), roadMat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0, 0, z);
    group.add(strip);
    for (let x = -half; x < half; x += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.35), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.01, z);
      group.add(dash);
    }
  }

  // Sidewalk slabs along each road edge (thin, slightly raised).
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  for (const x of roadXs) {
    for (const s of [-1, 1]) {
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(2.4, half * 2), walkMat);
      slab.rotation.x = -Math.PI / 2;
      slab.position.set(x + s * (CFG.roadHalfWidth + 1.4), 0.02, 0);
      group.add(slab);
    }
  }
  for (const z of roadZs) {
    for (const s of [-1, 1]) {
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, 2.4), walkMat);
      slab.rotation.x = -Math.PI / 2;
      slab.position.set(0, 0.02, z + s * (CFG.roadHalfWidth + 1.4));
      group.add(slab);
    }
  }

  // Buildings: one or two per block, never on a road. Colliders recorded.
  const colliders = [];
  const winTex = makeWindowTexture();
  const blockCenters = [];
  for (let gx = 0; gx < roadXs.length - 1; gx++) {
    for (let gz = 0; gz < roadZs.length - 1; gz++) {
      blockCenters.push({
        x: (roadXs[gx] + roadXs[gx + 1]) / 2,
        z: (roadZs[gz] + roadZs[gz + 1]) / 2,
      });
    }
  }
  const isSpecial = (x, z) =>
    (Math.abs(x - 380) < 60 && Math.abs(z + 380) < 60) || // solar tower plot
    (Math.abs(x) < 60 && Math.abs(z) < 60); // market square
  for (const b of blockCenters) {
    if (isSpecial(b.x, b.z)) continue;
    const n = randi(1, 2);
    for (let i = 0; i < n; i++) {
      const w = rand(14, 26);
      const d = rand(14, 26);
      const h = rand(8, 42);
      const ox = i === 0 ? -14 : 14;
      const oz = i === 0 ? -12 : 14;
      const x = b.x + ox + rand(-4, 4);
      const z = b.z + oz + rand(-4, 4);
      const color = pick(PALETTE.building);
      const mat = new THREE.MeshLambertMaterial({ color, map: h > 18 ? winTex : null });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, h / 2, z);
      group.add(m);
      // Roof trim.
      const roof = box(w + 0.6, 0.7, d + 0.6, 0x8a7a60, x, h + 0.35, z);
      group.add(roof);
      colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
    }
  }

  // Market square: open plaza with stalls and a fountain at the centre.
  const plaza = new THREE.Mesh(
    new THREE.PlaneGeometry(96, 96),
    new THREE.MeshLambertMaterial({ color: 0xc8b898 }),
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, 0.03, 0);
  group.add(plaza);
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 8, 1.2, 18),
    new THREE.MeshLambertMaterial({ color: 0x7aa8c8 }),
  );
  fountain.position.set(0, 0.6, 0);
  group.add(fountain);
  colliders.push({ x0: -8, z0: -8, x1: 8, z1: 8 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const sx = Math.cos(a) * 30;
    const sz = Math.sin(a) * 30;
    const stall = box(6, 3.2, 5, pick([0xd84a4a, 0x4a7ad8, 0xe8d84a, 0x7aa03a]), sx, 1.6, sz, { ry: a });
    group.add(stall);
    colliders.push({ x0: sx - 3, z0: sz - 2.5, x1: sx + 3, z1: sz + 2.5 });
  }

  // Palms along roads, cacti in the blocks.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a40 });
  const frondMat = new THREE.MeshLambertMaterial({ color: PALETTE.palm });
  const cactusMat = new THREE.MeshLambertMaterial({ color: PALETTE.cactus });
  const palmSpots = [];
  for (const x of roadXs) for (const z of roadZs) palmSpots.push([x + 10, z + 10]);
  for (const [x, z] of palmSpots) {
    if (Math.random() < 0.35) continue;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.45, 5.5, 7), trunkMat);
    trunk.position.set(x, 2.75, z);
    trunk.rotation.z = rand(-0.08, 0.08);
    group.add(trunk);
    for (let f = 0; f < 5; f++) {
      const frond = new THREE.Mesh(new THREE.SphereGeometry(1.7, 8, 5), frondMat);
      frond.scale.set(1.6, 0.25, 0.7);
      const a = (f / 5) * Math.PI * 2;
      frond.position.set(x + Math.cos(a) * 1.6, 5.6, z + Math.sin(a) * 1.6);
      frond.rotation.y = a;
      group.add(frond);
    }
  }
  for (let i = 0; i < 60; i++) {
    const bx = pick(blockCenters).x + rand(-30, 30);
    const bz = pick(blockCenters).z + rand(-30, 30);
    if (isSpecial(bx, bz)) continue;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(rand(0.5, 0.9), rand(0.5, 0.9), rand(1.2, 3.2), 7), cactusMat);
    c.position.set(bx, 1, bz);
    group.add(c);
  }

  // Heliostat field (north-east): rows of tilted mirrors around a tower.
  const mirrorMat = new THREE.MeshLambertMaterial({ color: PALETTE.mirror, emissive: 0x8899aa });
  const postMat = new THREE.MeshLambertMaterial({ color: 0x606060 });
  for (let rx = 0; rx < 6; rx++) {
    for (let rz = 0; rz < 5; rz++) {
      const mx = 330 + rx * 16;
      const mz = -430 + rz * 16;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 3, 6), postMat);
      post.position.set(mx, 1.5, mz);
      group.add(post);
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(7, 0.25, 5), mirrorMat);
      mirror.position.set(mx, 3.2, mz);
      mirror.rotation.x = -0.5;
      mirror.rotation.y = Math.atan2(380 - mx, -380 - mz);
      group.add(mirror);
    }
  }
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 6, 60, 10),
    new THREE.MeshLambertMaterial({ color: PALETTE.tower }),
  );
  tower.position.set(380, 30, -380);
  group.add(tower);
  const towerTop = new THREE.Mesh(
    new THREE.SphereGeometry(6, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0 }),
  );
  towerTop.position.set(380, 62, -380);
  group.add(towerTop);
  colliders.push({ x0: 374, z0: -386, x1: 386, z1: -374 });
  // Control-room shed beside the tower.
  const shed = box(14, 5, 10, 0x9aa8b8, 396, 2.5, -396);
  group.add(shed);
  colliders.push({ x0: 389, z0: -401, x1: 403, z1: -391 });

  // Landmark props: diner (west), motel (south-east), marina garage (west).
  const diner = box(22, 7, 14, 0xd84a4a, -180, 3.5, 90);
  group.add(diner);
  colliders.push({ x0: -191, z0: 83, x1: -169, z1: 97 });
  const motel = box(30, 9, 12, 0x4a7ad8, 180, 4.5, 270);
  group.add(motel);
  colliders.push({ x0: 165, z0: 264, x1: 195, z1: 276 });
  const garage = box(24, 8, 16, 0x606060, -270, 4, -180);
  group.add(garage);
  colliders.push({ x0: -282, z0: -188, x1: -258, z1: -172 });
  // Safehouse (south-west corner).
  const safe = box(16, 6, 12, 0x7aa03a, -360, 3, 360);
  group.add(safe);
  colliders.push({ x0: -368, z0: 354, x1: -352, z1: 366 });

  // Billboards with the town's name, facing the main roads.
  const boardTex = (() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 96;
    const g = c.getContext('2d');
    g.fillStyle = '#202028';
    g.fillRect(0, 0, 256, 96);
    g.fillStyle = '#ffd880';
    g.font = 'bold 44px sans-serif';
    g.textAlign = 'center';
    g.fillText('HELIOSTAT', 128, 58);
    g.fillStyle = '#e8e0c8';
    g.font = '20px sans-serif';
    g.fillText('SUN CITY • EST. 1987', 128, 84);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  for (const [x, z, ry] of [[-90, -135, 0], [90, 135, Math.PI], [225, -45, Math.PI / 2]]) {
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(20, 7, 0.6),
      new THREE.MeshLambertMaterial({ map: boardTex }),
    );
    board.position.set(x, 9, z);
    board.rotation.y = ry;
    group.add(board);
    const leg1 = box(0.6, 6, 0.6, 0x404040, x - 7, 3, z);
    const leg2 = box(0.6, 6, 0.6, 0x404040, x + 7, 3, z);
    group.add(leg1, leg2);
  }

  const isRoad = (x, z) => {
    const near = (v) => Math.abs(v) <= CFG.roadHalfWidth + 0.5;
    return roadXs.some((rx) => near(x - rx)) || roadZs.some((rz) => near(z - rz));
  };
  const nearestRoadX = (x) => roadXs.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
  const nearestRoadZ = (z) => roadZs.reduce((a, b) => (Math.abs(b - z) < Math.abs(a - z) ? b : a));
  const randomRoadPoint = () => {
    if (Math.random() < 0.5) return { x: pick(roadXs), z: rand(-half + 20, half - 20) };
    return { x: rand(-half + 20, half - 20), z: pick(roadZs) };
  };
  const randomSidewalkPoint = () => {
    const p = randomRoadPoint();
    const onX = roadXs.some((rx) => Math.abs(p.x - rx) < 1);
    if (onX) return { x: p.x + pick([-1, 1]) * (CFG.roadHalfWidth + 1.4), z: p.z };
    return { x: p.x, z: p.z + pick([-1, 1]) * (CFG.roadHalfWidth + 1.4) };
  };
  const resolveCollision = (pos, radius) => {
    // Push a circle out of every building AABB it overlaps.
    for (const c of colliders) {
      const cx = clamp(pos.x, c.x0, c.x1);
      const cz = clamp(pos.z, c.z0, c.z1);
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * radius;
          pos.z = cz + (dz / d) * radius;
        } else {
          pos.x = c.x1 + radius;
        }
        return true;
      }
    }
    return false;
  };

  return {
    group,
    colliders,
    roadXs,
    roadZs,
    isRoad,
    nearestRoadX,
    nearestRoadZ,
    randomRoadPoint,
    randomSidewalkPoint,
    resolveCollision,
    spawn: {
      player: { x: -45, z: 45 },
      tower: { x: 380, z: -380 },
      safehouse: { x: -360, z: 360 },
    },
  };
}
