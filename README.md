[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/malik2112/heliostat-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/malik2112/heliostat-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# HELIOSTAT — Open-World Crime in Sun City

A complete open-world crime game that runs offline in a desktop browser.
Sun City bakes under a desert sun beside a field of solar mirrors. Steal
cars, outrun the law, and run five story jobs for Ray's crew — from a first
delivery to the solar farm's grid codes.

## Play

```sh
node serve.ts        # then open http://127.0.0.1:8080/game/index.html
```

No install, no network: the game is static files, Three.js vendored under
`game/vendor/`. `?selftest=1` runs the in-browser self-test;
`?shot=drive|street|mission|start` stages a screenshot scene.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive in a car |
| Shift | Sprint |
| E | Steal nearest car / get out |
| Click | Shoot (crosshair) |
| R | Reload |
| 1 / 2 / 3 | Radio station (SOL FM, MIRAGE, DUST) |
| G | Start next mission |
| M | Mute |
| P / Esc | Pause |
| Drag mouse | Look around |

## Systems

- **City** — a 900 m desert town on a road grid: buildings, palms, cacti,
  dunes, a market square with stalls and a fountain, a diner, a motel, a
  marina garage, billboards, and a heliostat mirror field around a solar
  tower in the north-east.
- **Vehicles** — 8 car models, arcade driving with steering and drift,
  parked cars to steal, traffic that cruises the grid and turns at
  intersections, police interceptors with flashing light bars.
- **Pedestrians** — 26 townsfolk strolling the sidewalks who flee gunfire
  and speeding cars.
- **Combat** — hitscan shooting with tracers and sparks, a 12-round
  magazine, armed runners and foot cops who advance and shoot back.
- **Wanted** — crimes add heat, heat maps to 1–5 stars, police cars and
  foot cops hunt the player; lay low and heat bleeds off, or get busted
  standing still next to a cop.
- **Missions** — five story jobs with a light-beacon objective marker:
  deliveries, a car theft, a street clear-out, a van chase, and the
  solar-farm finale. Each pays cash.
- **HUD** — health, cash, wanted stars, objective text, a live minimap
  (roads, traffic, police, peds, mission marker), speed, ammo, radio, and
  an in-game clock.
- **Audio** — fully synthesized WebAudio: engine hum, gunshots, sirens,
  and three procedural radio stations.
- **Save** — cash, mission progress, best wanted level and kills persist
  in localStorage.

## Layout

```
game/
  index.html            page + HUD + import map
  src/
    config.js           tuning, palette, missions, cars, radio
    city.js             desert town, roads, buildings, solar field
    audio.js            WebAudio synth + radio sequencer
    player.js           on-foot movement + car entry
    vehicles.js         driving, traffic, stealing, police cars
    pedestrians.js      sidewalk AI, fleeing
    combat.js           shooting, enemies, tracers, sparks
    wanted.js           heat, stars, pursuit, busted
    missions.js         5 story jobs, beacon, rewards
    hud.js              HUD, minimap, menus, toasts
    save.js             localStorage save / load
    selftest.js         ?selftest=1 checks
    shots.js            ?shot= staging for screenshots
    main.js             boot, loop, camera, input
  vendor/three/         vendored Three.js (MIT)
main.ts                 builds /output/dossier.json (makefun/dossier/v1)
serve.ts                local static server
screenshots/            4 renders of the game itself
```

## License

MIT — see `LICENSE`.
