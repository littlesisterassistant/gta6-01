'use strict';
/* SOLMAR HEAT — game loop, state machine, camera, particles, save.
   Entry point: index.html loads this last. */

const G = {
  state: 'menu', time: 0, shake: 0,
  world: null, player: null, cars: [], peds: [], thugs: [], cops: [],
  particles: [], skids: [], mission: null, overlayMission: null,
  cam: { x: 0, y: 0 }, rng: mulberry32(1), save: null,
  bannerT: 0, spawnT: 0, sirenT: 0, wantedDecayT: 0,
  failReason: '', showMinimap: true, seed: 1, enteredThisFrame: false, autoDrive: false,
};

function spawnParticles(G, x, y, n, color, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = speed * (0.3 + Math.random() * 0.7);
    G.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.4 + Math.random() * 0.5, maxLife: 0.9,
      color, size: 2 + Math.random() * 4,
    });
  }
}

function addSkid(G, x, y, angle) {
  const dx = Math.cos(angle) * 10, dy = Math.sin(angle) * 10;
  G.skids.push({ x1: x - dy, y1: y + dx, x2: x + dy, y2: y - dx, life: 6 });
  if (G.skids.length > 400) G.skids.splice(0, G.skids.length - 400);
}

function wreckCar(G, car) {
  if (car.wrecked) return;
  car.wrecked = true;
  car.hp = 0;
  car.speed = 0;
  spawnParticles(G, car.x, car.y, 22, '#ff8800', 180);
  spawnParticles(G, car.x, car.y, 12, '#666666', 60);
  AudioSys.crash();
  G.shake = Math.min(16, G.shake + 10);
  if (car.driver === 'player') {
    const p = G.player;
    p.inCar = null;
    p.x = car.x + 46; p.y = car.y;
    p.vx = 0; p.vy = 0;
    hurtPlayer(G, 12);
  }
  car.driver = null;
}

function saveGame(G) {
  try {
    localStorage.setItem(CFG.saveKey, JSON.stringify({
      cash: G.player.cash, missionsDone: G.player.missionsDone, score: G.player.score,
    }));
  } catch (e) { /* storage unavailable */ }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(CFG.saveKey);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function initGame(seed) {
  G.seed = seed;
  G.rng = mulberry32(seed);
  G.world = buildWorld(seed);
  G.cars = []; G.peds = []; G.thugs = []; G.cops = [];
  G.particles = []; G.skids = [];
  G.mission = null; G.overlayMission = null;
  G.time = 0; G.shake = 0; G.bannerT = 0; G.spawnT = 0; G.sirenT = 0; G.wantedDecayT = 0;
  G.player = newPlayer(CFG.vRoads[2], CFG.hRoads[1] + 130);
  G.autoDrive = false;
  G.save = loadSave();
  if (G.save) {
    G.player.cash = G.save.cash || 0;
    G.player.missionsDone = G.save.missionsDone || 0;
    G.player.score = G.save.score || 0;
  }
  spawnTraffic(G, 10);
  spawnPeds(G, 24);
  // A few parked cars on the streets to steal — in-lane, angled along the
  // road, and kept clear of every mission marker so no mission completes
  // by accident when the player climbs in.
  const parked = [
    { type: 'compact', x: CFG.vRoads[1] + 26, y: 700, a: Math.PI / 2 },
    { type: 'sedan', x: CFG.vRoads[3] - 26, y: 1300, a: -Math.PI / 2 },
    { type: 'taxi', x: CFG.vRoads[0] + 26, y: 1900, a: Math.PI / 2 },
    { type: 'truck', x: CFG.vRoads[4] - 26, y: 1100, a: -Math.PI / 2 },
  ];
  for (const pk of parked) {
    const car = makeCar(pk.type, pk.x, pk.y, pk.a, null);
    G.cars.push(car);
  }
  G.cam.x = clamp(G.player.x - CFG.viewW / 2, 0, CFG.worldW - CFG.viewW);
  G.cam.y = clamp(G.player.y - CFG.viewH / 2, 0, CFG.worldH - CFG.viewH);
}

function startRun(G) {
  AudioSys.init();
  AudioSys.resume();
  const next = (G.player.missionsDone || 0) + 1;
  startMission(G, Math.min(next, MISSIONS.length));
  G.state = 'playing';
}

function restartRun(G) {
  initGame(G.seed);
  startRun(G);
}

function updateCamera(G, dt) {
  const p = G.player;
  const tx = clamp(p.x - CFG.viewW / 2, 0, CFG.worldW - CFG.viewW);
  const ty = clamp(p.y - CFG.viewH / 2, 0, CFG.worldH - CFG.viewH);
  const k = 1 - Math.pow(0.001, dt);
  G.cam.x = lerp(G.cam.x, tx, k);
  G.cam.y = lerp(G.cam.y, ty, k);
}

function update(G, dt) {
  G.time += dt;
  G.shake = Math.max(0, G.shake - dt * 26);
  G.bannerT = Math.max(0, G.bannerT - dt);
  const p = G.player;

  if (G.state === 'menu') {
    // Slow cinematic pan behind the title.
    G.cam.x = (Math.sin(G.time * 0.05) * 0.5 + 0.5) * (CFG.worldW - CFG.viewW);
    G.cam.y = (Math.cos(G.time * 0.04) * 0.5 + 0.5) * (CFG.worldH - CFG.viewH);
    if (Input.hit('Enter') || Input.mouseClicked) startRun(G);
    return;
  }
  if (G.state === 'paused') {
    if (Input.hit('KeyP', 'Escape') || Input.mouseClicked) G.state = 'playing';
    return;
  }
  if (G.state === 'mission-complete') {
    if (Input.hit('Enter') || Input.mouseClicked) {
      const next = G.overlayMission.id + 1;
      G.overlayMission = null;
      startMission(G, next);
      G.state = 'playing';
    }
    return;
  }
  if (G.state === 'mission-failed') {
    if (Input.hit('Enter') || Input.mouseClicked) {
      const idx = G.mission ? G.mission.def.id : 1;
      G.mission = null;
      startMission(G, idx);
      G.state = 'playing';
    }
    return;
  }
  if (G.state === 'busted' || G.state === 'wasted') {
    if (Input.hit('KeyR') || Input.mouseClicked) {
      initGame(G.seed);
      startRun(G);
    }
    return;
  }
  if (G.state === 'game-complete') {
    if (Input.hit('KeyR') || Input.mouseClicked) {
      initGame(G.seed);
      G.state = 'playing'; // free roam
    }
    return;
  }

  // --- playing ---
  p.runT += dt;
  G.enteredThisFrame = false;
  if (Input.hit('KeyP', 'Escape')) { G.state = 'paused'; return; }
  if (Input.hit('KeyR')) { restartRun(G); return; }
  if (Input.hit('KeyM', 'Tab')) G.showMinimap = !G.showMinimap;

  if (p.inCar) updatePlayerInCar(G, dt);
  else updatePlayerOnFoot(G, dt);
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updateWanted(G, dt);
  updateMissions(G, dt);

  // Particles + skids decay.
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const pt = G.particles[i];
    pt.life -= dt;
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vx *= 0.92; pt.vy *= 0.92;
    if (pt.life <= 0) G.particles.splice(i, 1);
  }
  for (let i = G.skids.length - 1; i >= 0; i--) {
    G.skids[i].life -= dt;
    if (G.skids[i].life <= 0) G.skids.splice(i, 1);
  }
  updateCamera(G, dt);
}

function updatePlayerInCar(G, dt) {
  // Driving itself is handled in updateTraffic; here: shooting from the car is off,
  // but the player can still be hurt by rams (handled in police.js).
  const p = G.player;
  p.punchCd -= dt; p.shootCd -= dt; p.hurtCd -= dt;
}

function boot() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  Input.init(canvas);
  const params = getShotParams();
  initGame(params.seed);
  if (params.shot) stageShot(G, params.shot);
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(G, dt);
    drawGame(ctx, G);
    Input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

window.addEventListener('load', boot);
