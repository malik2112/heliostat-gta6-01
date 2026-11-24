// HELIOSTAT — screenshot staging (?shot=drive|street|mission|start).
// Each preset puts the game into a photogenic state: the player driving
// down the main avenue, walking a busy sidewalk, mid-mission at the solar
// tower, or the title menu over the city. The main loop settles the scene
// for ~2 s, then raises window.__shotReady for the capture driver.

import { CFG } from './config.js';

export const SHOT_NAMES = ['drive', 'street', 'mission', 'start'];

export function stageShot(game, name) {
  if (!SHOT_NAMES.includes(name)) return false;
  game.shotMode = name;
  game.shotFrames = 0;
  const city = game.city;
  if (name === 'start') {
    // Title menu over a wide view of the city from the south-east.
    game.player.teleport(-45, 300, Math.PI * 0.9);
    game.hud.showMenu(true);
    game.state = 'menu';
    game.camPreset = { x: -45, y: 90, z: 430, lookX: 0, lookY: 0, lookZ: 0 };
    return true;
  }
  game.hud.showMenu(false);
  game.state = 'playing';
  if (name === 'drive') {
    // Player in a red Comet, mid-avenue, traffic ahead, sun ahead.
    const car = game.vehicles.spawnMissionCar('Comet', -45, 120, Math.PI);
    car.isParked = false;
    game.player.teleport(-45, 120, Math.PI);
    game.enterCar(car);
    game.input.up = true;
    game.player.vehicle.speed = 18;
    game.camPreset = null;
    game.hud.setObjective('Free roam', 'Cruise Sun City — steal cars, take jobs, dodge the law');
    game.hud.toast('HELIOSTAT — Sun City. Drive anywhere.');
  } else if (name === 'street') {
    // On foot on a sidewalk along the main avenue: peds around, traffic
    // passing, the diner across the road to the west.
    game.player.teleport(-126, 60, 0);
    for (let i = 0; i < 6; i++) {
      game.peds.spawnOne(-126 + (i % 2 === 0 ? -2 : 2), 72 + i * 7);
    }
    game.camPreset = null;
    game.hud.setObjective('Free roam', 'On foot in Sun City — press E near a car to steal it');
    game.hud.toast('Downtown — pedestrians, traffic, and trouble.');
  } else if (name === 'mission') {
    // Mission 1 active at the solar tower, beacon blazing, runners near.
    game.player.teleport(330, -330, Math.PI * 0.75);
    const ok = game.missions.startMission(0);
    if (ok) {
      // Jump straight to the tower step's neighbourhood for the shot.
      game.player.teleport(350, -350, Math.PI * 0.8);
      game.combat.spawnEnemy(362, -362, 'runner');
      game.combat.spawnEnemy(340, -368, 'runner');
    }
    game.camPreset = null;
    game.hud.toast('Mission: First Light — meet Ray at the solar tower');
  }
  return true;
}

// Called every frame while a shot is staged; returns true once settled.
export function shotSettled(game) {
  if (!game.shotMode) return false;
  game.shotFrames++;
  return game.shotFrames > 110;
}
