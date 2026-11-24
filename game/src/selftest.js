// HELIOSTAT — in-browser self-test (?selftest=1). Boots the game, then
// exercises every system headlessly: city, player, a car, a shot, a
// mission, the wanted level, and a save round-trip. Results go to the
// #selftest panel and the console; window.__selftestDone /
// window.__selftestPassed report the outcome to automation.

import { CFG } from './config.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runSelfTest(game) {
  const log = (text, ok) => {
    game.hud.selftestLine(text, ok);
    console.log(`[SELFTEST] ${ok === true ? 'PASS' : ok === false ? 'FAIL' : '..'} ${text}`);
  };
  const results = [];
  const check = (name, cond) => {
    results.push(!!cond);
    log(name, !!cond);
  };
  const panel = game.hud.els.selftest;
  panel.classList.remove('hidden');
  log('HELIOSTAT self-test — booting checks', null);
  try {
    await sleep(300);
    check('renderer created', !!game.renderer && !!game.renderer.domElement);
    check('scene has objects', game.scene.children.length > 40);
    check('city colliders present', game.city.colliders.length > 50);
    check('roads on grid', game.city.roadXs.length >= 8 && game.city.roadZs.length >= 8);
    check('player spawned on foot', !game.player.inVehicle && game.player.health === CFG.playerHealth);
    check('traffic spawned', game.vehicles.count() >= CFG.trafficCount + CFG.parkedCount);
    check('pedestrians spawned', game.peds.countAlive() >= CFG.pedCount);
    check('HUD minimap draws', (() => { game.hud.update(0.016, 1); return true; })());
    check('audio engine constructs', !!game.audio);

    // Drive: put the player in the nearest car and hold W for two seconds.
    const car = game.vehicles.nearestCar(game.player.pos, 400);
    check('a car exists to steal', !!car);
    if (car) {
      game.enterCar(car);
      await sleep(100);
      check('player entered car', game.player.inVehicle);
      game.input.up = true;
      const startSpeed = game.player.vehicle.speed;
      await sleep(2000);
      game.input.up = false;
      check('car accelerates', game.player.vehicle.speed > startSpeed + 3);
      check('car moved', game.player.vehicle.pos.length() > 0);
      game.exitCar();
      await sleep(100);
      check('player exited car', !game.player.inVehicle);
    }

    // Combat: fire at a spawned enemy, expect a hit or a miss (never a crash).
    const enemy = game.combat.spawnEnemy(game.player.pos.x + 8, game.player.pos.z + 4, 'runner');
    const before = game.combat.ammo;
    const origin = game.shootOrigin();
    const dir = game.shootDir();
    const result = game.combat.shoot(origin, dir);
    check('shoot returns a result', ['hit-enemy', 'hit-ped', 'hit-car', 'miss'].includes(result));
    check('ammo decreases', game.combat.ammo === before - 1);
    game.combat.removeEnemy(enemy);

    // Mission: start job 1, teleport onto its first objective, expect advance.
    const started = game.missions.startMission(0);
    check('mission 1 starts', started);
    if (started) {
      const step = game.missions.state.active.def.steps[0];
      game.player.teleport(step.x, step.z);
      await sleep(400);
      check('mission step advances on arrival', game.missions.state.active.step >= 1 || game.missions.nextIndex >= 1);
      game.missions.failMission('self-test cleanup');
    }

    // Wanted: a crime raises heat and stars; clearing resets them.
    game.wanted.addHeat(40, game.time);
    check('heat raises stars', game.wanted.stars >= 2);
    check('police dispatched', game.wanted.policeCount > 0);
    game.wanted.clear();
    check('wanted clears', game.wanted.stars === 0 && game.wanted.policeCount === 0);

    // Save round-trip.
    const saved = game.save();
    check('save writes', saved === true);
    const loaded = game.loadSaveData();
    check('save reads back', !!loaded && loaded.money === Math.round(game.player.money));

    // Radio + screenshot staging hooks exist.
    check('radio station named', game.audio.radioName.length > 3);
    check('shot staging hook exists', typeof game.stageShot === 'function');
  } catch (err) {
    log(`exception: ${err && err.message ? err.message : String(err)}`, false);
    results.push(false);
  }
  const passed = results.every(Boolean);
  log(`SELF-TEST ${passed ? 'PASSED' : 'FAILED'} (${results.filter(Boolean).length}/${results.length})`, passed);
  window.__selftestDone = true;
  window.__selftestPassed = passed;
  return passed;
}
