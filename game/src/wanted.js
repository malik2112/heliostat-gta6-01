// HELIOSTAT — the wanted system. Crimes add heat; heat maps to stars; stars
// decide how many police cars and foot cops hunt the player. Lay low and
// heat bleeds off — get caught standing still next to a cop car and you are
// busted.

import { CFG, clamp, dist2d } from './config.js';

export function createWanted(game) {
  let heat = 0;
  let stars = 0;
  let bustT = 0;
  let lastCrimeT = -100;
  let policeCars = [];
  let footCops = [];
  let evadeT = 0;

  const starsFor = (h) => {
    let s = 0;
    for (let i = 0; i < CFG.starsAtHeat.length; i++) if (h >= CFG.starsAtHeat[i]) s = i;
    return s;
  };

  const syncPolice = () => {
    const wantCars = stars >= 2 ? Math.min(stars - 1, 3) : 0;
    const wantCops = stars >= 1 ? Math.min(stars, 3) : 0;
    while (policeCars.length < wantCars) {
      const a = Math.random() * Math.PI * 2;
      const p = game.player.pos;
      const car = game.vehicles.spawnPoliceCar(
        clamp(p.x + Math.sin(a) * 55, -CFG.worldHalf + 5, CFG.worldHalf - 5),
        clamp(p.z + Math.cos(a) * 55, -CFG.worldHalf + 5, CFG.worldHalf - 5),
      );
      car.chaseTarget = p;
      policeCars.push(car);
    }
    while (policeCars.length > wantCars) {
      const car = policeCars.pop();
      car.chaseTarget = null;
      game.vehicles.removeVehicle(car);
    }
    while (footCops.length < wantCops) {
      const a = Math.random() * Math.PI * 2;
      const p = game.player.pos;
      const cop = game.combat.spawnEnemy(
        clamp(p.x + Math.sin(a) * 26, -CFG.worldHalf + 5, CFG.worldHalf - 5),
        clamp(p.z + Math.cos(a) * 26, -CFG.worldHalf + 5, CFG.worldHalf - 5),
        'cop',
      );
      footCops.push(cop);
    }
    while (footCops.length > wantCops) {
      const cop = footCops.pop();
      game.combat.removeEnemy(cop);
    }
    for (const car of policeCars) car.chaseTarget = game.player.pos;
  };

  const addHeat = (n, time) => {
    heat = clamp(heat + n, 0, 100);
    lastCrimeT = time;
    const s = starsFor(heat);
    if (s !== stars) {
      stars = s;
      syncPolice();
      game.hud.setStars(stars);
    }
  };

  const clear = () => {
    heat = 0;
    stars = 0;
    bustT = 0;
    for (const car of policeCars) {
      car.chaseTarget = null;
      game.vehicles.removeVehicle(car);
    }
    policeCars = [];
    for (const cop of footCops) game.combat.removeEnemy(cop);
    footCops = [];
    game.hud.setStars(0);
  };

  const update = (dt, time) => {
    // Heat decays only when the player has been quiet for a while.
    if (time - lastCrimeT > 6 && stars > 0) {
      heat = Math.max(0, heat - CFG.heatDecay * dt);
      const s = starsFor(heat);
      if (s !== stars) {
        stars = s;
        syncPolice();
        game.hud.setStars(stars);
      }
    }
    // Siren volume follows the nearest police car.
    let nearest = 1e9;
    for (const car of policeCars) nearest = Math.min(nearest, dist2d(car.pos.x, car.pos.z, game.player.pos.x, game.player.pos.z));
    game.audio.setSiren(policeCars.length > 0, nearest === 1e9 ? 0 : clamp(1 - nearest / 90, 0, 1));
    // Busted: a police car sits on the player while the player is slow.
    if (stars > 0) {
      const p = game.player;
      const slow = p.inVehicle ? Math.abs(p.vehicle.speed) < 2 : !p.moving;
      let close = false;
      for (const car of policeCars) {
        if (dist2d(car.pos.x, car.pos.z, p.pos.x, p.pos.z) < 4.5) close = true;
      }
      for (const cop of footCops) {
        if (cop.alive && dist2d(cop.pos.x, cop.pos.z, p.pos.x, p.pos.z) < 3) close = true;
      }
      if (close && slow && !p.dead) {
        bustT += dt;
        if (bustT >= CFG.bustSeconds) {
          bustT = 0;
          game.onBusted();
        }
      } else {
        bustT = Math.max(0, bustT - dt * 2);
      }
    } else {
      bustT = 0;
    }
    // Evade bonus: survive 20 s at 1 star without new crimes and heat drops fast.
    if (stars === 1 && time - lastCrimeT > 20) {
      evadeT += dt;
      heat = Math.max(0, heat - CFG.heatDecay * 2 * dt);
      if (starsFor(heat) !== stars) {
        stars = starsFor(heat);
        syncPolice();
        game.hud.setStars(stars);
      }
    } else {
      evadeT = 0;
    }
  };

  return {
    addHeat,
    clear,
    update,
    get heat() { return heat; },
    get stars() { return stars; },
    get bustProgress() { return clamp(bustT / CFG.bustSeconds, 0, 1); },
    get policeCount() { return policeCars.length + footCops.length; },
  };
}
