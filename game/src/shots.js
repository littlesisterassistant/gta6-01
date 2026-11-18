'use strict';
/* ?shot=<scene>&seed=<n> staging for reproducible screenshots.
   Scenes: start, play, chase, results. */

function getShotParams() {
  const q = new URLSearchParams(window.location.search);
  return { shot: q.get('shot') || '', seed: parseInt(q.get('seed') || '1', 10) };
}

function stageShot(G, shot) {
  const p = G.player;
  if (shot === 'start') {
    G.state = 'menu';
    G.cam.x = 1000; G.cam.y = 600;
    return;
  }
  if (shot === 'play') {
    // Jax on foot at a busy intersection, mission 1 live, traffic + peds around.
    G.state = 'playing';
    p.x = CFG.vRoads[2]; p.y = CFG.hRoads[1];
    p.angle = Math.PI / 2;
    startMission(G, 1);
    G.bannerT = 0;
    spawnTrafficNear(G, p.x, p.y, 6);
    // A few pedestrians strolling past the player.
    for (let i = 0; i < 5; i++) {
      G.peds.push({
        x: p.x + (i - 2) * 70, y: p.y + (i % 2 === 0 ? 90 : -90),
        angle: G.rng() * Math.PI * 2, vx: 0, vy: 0,
        state: 'walk', speed: randRange(G.rng, 45, 75), hp: 30,
        color: pick(G.rng, PED_COLORS), downT: 0, turnT: 3,
        fleeX: 0, fleeY: 0,
      });
    }
    return;
  }
  if (shot === 'chase') {
    // Jax driving the Comet GT at speed, wanted 3, two police cars on his tail.
    G.state = 'playing';
    const comet = makeCar('sport', CFG.vRoads[2], CFG.hRoads[2] - 100, Math.PI / 2, 'player');
    comet.speed = 380;
    comet.hp = 300; // staged durability: the shot should show a chase, not a wreck
    G.cars.push(comet);
    p.inCar = comet;
    p.x = comet.x; p.y = comet.y; p.angle = comet.angle;
    p.wanted = 3;
    p.lastCrimeT = G.time;
    p.cash = 2400;
    p.weapon = 'pistol'; p.ammo = 24;
    startMission(G, 3);
    G.mission.stage = 2;
    G.mission.targets = [{ x: G.world.places.garage.x, y: G.world.places.garage.y, label: "Lupe's Garage", r: 70 }];
    G.bannerT = 0;
    for (let i = 0; i < 2; i++) {
      // Trail behind the southbound Comet (north of it), close enough to read in frame.
      const cop = makeCar('police', comet.x - 30 + i * 70, comet.y - 200 - i * 80, Math.PI / 2, 'police');
      cop.speed = 300; // trail, not ram, during the shot window
      G.cars.push(cop);
    }
    // Auto-drive the Comet straight down the avenue for the shot.
    G.autoDrive = true;
    // Clear the avenue ahead so the shot shows a chase, not a pile-up.
    G.cars = G.cars.filter(c => c.driver !== 'traffic' || Math.abs(c.x - CFG.vRoads[2]) > 120 || c.y < comet.y - 100 || c.y > comet.y + 900);
    return;
  }
  if (shot === 'results') {
    // Mission-complete overlay after Package Run.
    G.state = 'mission-complete';
    G.overlayMission = MISSIONS[1];
    p.cash = 1300;
    p.missionsDone = 2;
    p.x = G.world.places.pier.x - 200; p.y = G.world.places.pier.y;
    G.cam.x = clamp(p.x - CFG.viewW / 2, 0, CFG.worldW - CFG.viewW);
    G.cam.y = clamp(p.y - CFG.viewH / 2, 0, CFG.worldH - CFG.viewH);
    return;
  }
}

function spawnTrafficNear(G, x, y, n) {
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(G.rng);
    let tries = 0;
    while (Math.hypot(p.x - x, p.y - y) > 700 && tries++ < 8) {
      const q = randomRoadPoint(G.rng); p.x = q.x; p.y = q.y; p.axis = q.axis;
    }
    const car = makeCar(pick(G.rng, ['compact', 'sedan', 'taxi', 'sedan']), p.x, p.y, 0, 'traffic');
    car.dir = p.axis === 'v' ? (G.rng() < 0.5 ? 1 : 3) : (G.rng() < 0.5 ? 0 : 2);
    car.angle = [0, Math.PI / 2, Math.PI, -Math.PI / 2][car.dir];
    car.speed = car.cruise * 0.7;
    G.cars.push(car);
  }
}
