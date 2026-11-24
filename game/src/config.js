// HELIOSTAT — shared tuning, world constants, mission data, radio stations.
// One place for every number the rest of the game reads, so balance tweaks
// never mean hunting through the modules.

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (lo = 1, hi) => (hi === undefined ? Math.random() * lo : lo + Math.random() * (hi - lo));
export const randi = (lo, hi) => Math.floor(rand(lo, hi + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
export const angleLerp = (a, b, t) => a + wrapAngle(b - a) * clamp(t, 0, 1);
export const fmtMoney = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

export const CFG = {
  // World: a square desert city, roads on a 90 m grid.
  worldHalf: 450,
  roadSpacing: 90,
  roadHalfWidth: 7,
  laneWidth: 3.5,
  blockSize: 76,
  // Player on foot.
  walkSpeed: 6.5,
  sprintSpeed: 11,
  playerRadius: 0.55,
  playerHealth: 100,
  // Cars.
  carAccel: 14,
  carBrake: 30,
  carMaxSpeed: 38,
  carMaxReverse: 9,
  carSteer: 0.55,
  carTurnGrip: 1.9,
  trafficSpeed: 11,
  trafficCount: 14,
  parkedCount: 18,
  // Pedestrians.
  pedCount: 26,
  pedSpeed: 1.6,
  pedFleeSpeed: 4.2,
  // Combat.
  magSize: 12,
  reloadSeconds: 1.4,
  shotDamage: 34,
  shotRange: 90,
  enemyHealth: 70,
  enemyShotDamage: 7,
  // Wanted.
  heatDecay: 1.6,
  heatPerCrime: { steal: 22, shoot: 14, kill: 30, speeding: 0 },
  starsAtHeat: [0, 18, 38, 58, 78, 92],
  bustSeconds: 3,
  // Missions.
  missionReward: [400, 900, 1600, 2600, 5000],
  startCash: 250,
  saveKey: 'heliostat-save-v1',
};

export const PALETTE = {
  sky: 0x8ec8e8,
  fog: 0xd8c49a,
  sand: 0xd9b380,
  sandDark: 0xc9a06a,
  asphalt: 0x3a3a40,
  asphaltLine: 0xe8e0c8,
  sidewalk: 0xb8a888,
  building: [0xd8c8a8, 0xc8b090, 0xb8a080, 0xe0d0b0, 0x9aa8b8, 0xc09070],
  glass: 0x2a4a5a,
  palm: 0x3a7a3a,
  cactus: 0x4a8a4a,
  mirror: 0xdfe8f0,
  tower: 0xf0e8d0,
  sun: 0xffe8a0,
};

// The five story missions. A step's `type` drives the mission manager:
// goto (reach a point), steal (take the marked car), deliver (bring a car
// or yourself to a point), clear (defeat N enemies), chase (ram the target
// car until its health hits zero).
export const MISSIONS = [
  {
    id: 'm1',
    title: 'First Light',
    brief: 'Meet Ray at the solar tower. The crew is hiring — show up on time.',
    steps: [
      { type: 'goto', label: 'Drive or run to the solar tower', x: 380, z: -380, radius: 14 },
      { type: 'goto', label: 'Pick up the package at the diner', x: -180, z: 90, radius: 10 },
      { type: 'deliver', label: 'Deliver the package to the motel', x: 180, z: 270, radius: 10 },
    ],
  },
  {
    id: 'm2',
    title: 'Hot Wheels',
    brief: 'A collector wants the red Comet parked by the marina garage. Take it — quietly.',
    steps: [
      { type: 'steal', label: 'Steal the red Comet', car: 'comet', x: -270, z: -180, radius: 6 },
      { type: 'deliver', label: 'Deliver the Comet to the lockup', x: 270, z: 180, radius: 12, inCar: true },
    ],
  },
  {
    id: 'm3',
    title: 'Dust Devils',
    brief: 'Rival runners are shaking down Ray’s couriers. Clear them out of the market square.',
    steps: [
      { type: 'clear', label: 'Defeat the runners in the market square', x: 0, z: 0, radius: 26, count: 4 },
      { type: 'goto', label: 'Check on Ray at the tower', x: 380, z: -380, radius: 14 },
    ],
  },
  {
    id: 'm4',
    title: 'High Noon Chase',
    brief: 'A courier took the crew’s ledger and is running north in a white van. Run him down.',
    steps: [
      { type: 'chase', label: 'Ram the white van until it stops', x: -90, z: -270, radius: 30 },
      { type: 'goto', label: 'Collect the ledger from the wreck', x: -90, z: -270, radius: 8 },
    ],
  },
  {
    id: 'm5',
    title: 'Heliostat',
    brief: 'The solar farm’s control room holds the city’s grid codes. Take them, then lose the heat.',
    steps: [
      { type: 'clear', label: 'Fight through the guards at the control room', x: 380, z: -380, radius: 30, count: 5 },
      { type: 'goto', label: 'Grab the grid codes inside the tower', x: 396, z: -396, radius: 8 },
      { type: 'deliver', label: 'Lose the cops, then reach the safehouse', x: -360, z: 360, radius: 12, needStars: 0 },
    ],
  },
];

export const CAR_DEFS = [
  { name: 'Comet', color: 0xc03028, body: 'sport', top: 0.95 },
  { name: 'Dune', color: 0xd8a030, body: 'sedan', top: 1.0 },
  { name: 'Mirage', color: 0x2a6a9a, body: 'sedan', top: 1.0 },
  { name: 'Coyote', color: 0x5a5a5a, body: 'truck', top: 1.05 },
  { name: 'Sol', color: 0xe8e0d0, body: 'van', top: 1.1 },
  { name: 'Viper', color: 0x3a3a3a, body: 'sport', top: 0.9 },
  { name: 'Palma', color: 0x7aa03a, body: 'sedan', top: 1.0 },
  { name: 'Interceptor', color: 0x1a1a20, body: 'police', top: 1.0 },
];

export const PED_SHIRTS = [0xd84a4a, 0x4a7ad8, 0x4ad87a, 0xe8d84a, 0xd84ad8, 0xffffff, 0x303030, 0xe08030];
export const PED_NAMES = ['Mara', 'Dez', 'Lu', 'Paz', 'Ivo', 'Nia', 'Sol', 'Rex', 'Ana', 'Kit'];

// Three procedural radio stations: each is a bass pattern plus a lead
// pattern the audio engine schedules from note numbers (MIDI).
export const RADIOS = [
  {
    name: 'SOL FM — desert rock',
    bpm: 112,
    bass: [40, 40, 43, 45, 40, 40, 47, 45],
    lead: [64, 67, 69, 67, 72, 69, 67, 64],
    wave: 'sawtooth',
  },
  {
    name: 'MIRAGE — synthwave',
    bpm: 96,
    bass: [36, 36, 39, 41, 36, 36, 34, 41],
    lead: [60, 63, 67, 72, 67, 63, 60, 55],
    wave: 'square',
  },
  {
    name: 'DUST — country twang',
    bpm: 128,
    bass: [41, 45, 48, 45, 41, 45, 43, 47],
    lead: [69, 72, 76, 74, 72, 69, 67, 64],
    wave: 'triangle',
  },
];

export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  enter: ['KeyE'],
  reload: ['KeyR'],
  pause: ['KeyP', 'Escape'],
  radio: ['Digit1', 'Digit2', 'Digit3'],
  mute: ['KeyM'],
};
