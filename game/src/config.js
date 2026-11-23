// HELIOSTAT — config.js
// One job: every tunable number, colour and story string in one place so the
// rest of the game reads like a design document, not a pile of magic numbers.
// All names, places and people here are original fiction.
export const GAME_TITLE = 'HELIOSTAT';
export const GAME_SUBTITLE = 'An open-world crime story in the solar desert of Sunforge';
export const SAVE_KEY = 'heliostat-save-v1';

// City layout: a 6 x 6 grid of blocks. Streets run on the grid lines.
export const CITY = {
  blocks: 6,          // blocks per side
  block: 70,          // block pitch (metres)
  streetWidth: 16,    // road width
  half: 210,          // city spans -half .. +half on both axes
  beachX: 226,        // edge feature starts here (east edge)
  waterX: 262,        // far edge feature starts here
  boundX: 288,        // hard world bound east (in the edge feature)
  boundZ: 228,
  fogNear: 200,
  fogFar: 600,
  sunIntensity: 2.6,
};

// Mission hub: the fixer's base. Missions start here, the story ends here.
export const HUB = { x: 186, z: 168 };
export const HUB_NAME = "Sunforge Plant";
export const PD_NAME = "Sunforge PD";
export const RADIO_NAME = "SOLAR FM 88.4";
export const COMPLETE_TITLE = "KING OF SUNFORGE";
export const BUSTED_TEXT = "The Sunforge PD caught you. They took $100 for the trouble and dropped you at the plant.";
export const WASTED_TEXT = "Sunforge Clinic patched you up. The bill was $100 \u2014 and the heat is off, for now.";
export const CLOCK_START = 1100; // in-game clock start, minutes

// The one mechanic that makes this city drive differently from any other:
// SOLAR BOOST: driving through the mirror field (east edge) feeds the motor, +30% top speed.
export const MECHANIC = { type: "solar", blurb: "SOLAR BOOST: driving through the mirror field (east edge) feeds the motor, +30% top speed." };

// Player / on-foot tuning
export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 11,
  radius: 0.6,
  height: 1.8,
  eyeHeight: 1.62,
  maxHp: 100,
  jumpSpeed: 0,
};

// Car tuning (arcade, not a sim: fun first)
export const CAR = {
  accel: 22,
  brake: 34,
  reverseMax: 12,
  maxSpeed: 38,
  turnRate: 1.9,
  grip: 6.5,
  handbrakeTurn: 3.1,
  radius: 1.5,
};

// Traffic + pedestrians
export const TRAFFIC = {
  carCount: 12,
  carSpeed: 10,
  pedCount: 16,
  pedSpeed: 1.6,
};

// Wanted system
export const WANTED = {
  max: 5,
  decaySeconds: 26,       // quiet seconds before one star drops
  bustDistance: 3.2,      // cop must be this close, on foot, to bust
  bustSeconds: 1.6,       // seconds of contact before the bust lands
  heatStealCar: 1,
  heatHitPed: 1,
  heatShoot: 1,
  heatKillCop: 2,
  heatRamCop: 1,
};

// Combat
export const COMBAT = {
  magSize: 12,
  reloadSeconds: 1.4,
  range: 90,
  damage: 34,
  fireInterval: 0.22,
  pedHp: 50,
  copHp: 80,
  rivalHp: 100,
};

// Palette
export const PALETTE = {
  sky: 0xf0c070,
  fog: 0xe0b878,
  sun: 0xffe8b0,
  asphalt: 0x33302a,
  sidewalk: 0xa89878,
  sand: 0xe0b878,
  sea: 0x1c3a5e,
  building: [0xd8b878, 0x7a9ab8, 0xc89858, 0x8a7a5a, 0xe8d8a8, 0x5a7a9a, 0xb87848, 0xd8c8a8],
  glass: 0x3a6a8a,
  palmTrunk: 0x8a6a48,
  palmLeaf: 0x3f9a4a,
  carPaint: [0xe8c23a, 0x2e6fc2, 0xc23b2e, 0x3aa88a, 0x8a5fc2, 0xe8e8e8, 0x222831, 0xd97a2b],
  ground: 0x9a7a4a,
  hemiSky: 0xf0c070,
  hemiGround: 0x8a6a3a,
  minimapSea: "#1c3a5e",
  minimapSand: "#e0b878",
};

// Story: Sol Reyes, a driver new to Sunforge, owes fixer Dr. Ilya Voss.
export const STORY = {
  hero: "Sol Reyes",
  fixer: "Dr. Ilya Voss",
  intro: "You are Sol Reyes, a courier who just rolled into Sunforge with a busted pickup and a debt to Dr. Ilya Voss, who runs the solar plant on Array Road. Pay him back job by job \u2014 drive, steal, run \u2014 and earn your place as the best driver in the desert. Watch the stars: the Sunforge PD does not forgive.",
  outro: "The mirrors fade behind you, $1,500 richer and finally square with Voss. Sunforge is yours now, Sol \u2014 every street, every car, every getaway. KING OF SUNFORGE.",
};

// Controls shown on the start screen and pause menu
export const CONTROLS = [
  ['W A S D', 'Move / drive'],
  ['Mouse', 'Look around (click to lock)'],
  ['Shift', 'Sprint / NITRO boost (in car)'],
  ['E', 'Enter / exit / steal a car'],
  ['Space', 'Handbrake (in car)'],
  ['Click', 'Fire pistol'],
  ['R', 'Reload'],
  ['M', 'Toggle mission details'],
  ['P / Esc', 'Pause'],
  ['H', 'Toggle radio'],
];
