'use strict';
/* The player: Jax Moreno. On foot and behind the wheel. */

function newPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, vx: 0, vy: 0,
    hp: CFG.playerHp, cash: 0, wanted: 0,
    inCar: null, weapon: 'fists', ammo: 0,
    punchCd: 0, shootCd: 0, hurtCd: 0, bustedT: 0,
    lastCrimeT: -999, crimeCooldown: 0,
    missionsDone: 0, score: 0, runT: 0,
  };
}

function hurtPlayer(G, dmg, srcX, srcY) {
  const p = G.player;
  if (p.hurtCd > 0 || p.hp <= 0) return;
  p.hp -= dmg;
  p.hurtCd = 0.5;
  G.shake = Math.min(14, G.shake + 6);
  spawnParticles(G, p.x, p.y, 8, '#ff5555', 90);
  if (srcX !== undefined) {
    const a = angleTo(srcX, srcY, p.x, p.y);
    p.vx += Math.cos(a) * 160; p.vy += Math.sin(a) * 160;
  }
  if (p.hp <= 0) { p.hp = 0; G.state = 'wasted'; AudioSys.busted(); saveGame(G); }
}

function updatePlayerOnFoot(G, dt) {
  const p = G.player;
  p.punchCd -= dt; p.shootCd -= dt; p.hurtCd -= dt;
  let mx = 0, my = 0;
  if (Input.down('KeyW', 'ArrowUp')) my -= 1;
  if (Input.down('KeyS', 'ArrowDown')) my += 1;
  if (Input.down('KeyA', 'ArrowLeft')) mx -= 1;
  if (Input.down('KeyD', 'ArrowRight')) mx += 1;
  const run = Input.down('ShiftLeft', 'ShiftRight');
  const sp = run ? 265 : 175;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    p.vx = (mx / len) * sp; p.vy = (my / len) * sp;
    p.angle = Math.atan2(p.vy, p.vx);
  } else {
    p.vx *= 0.8; p.vy *= 0.8;
  }
  let nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
  const b = collideBuildings(G.world, nx, p.y, 13);
  if (!b) p.x = nx;
  const b2 = collideBuildings(G.world, p.x, ny, 13);
  if (!b2) p.y = ny;
  p.x = clamp(p.x, 16, CFG.worldW - 16);
  p.y = clamp(p.y, 16, CFG.worldH - 16);
  if (p.x > CFG.seaX - 40) p.x = CFG.seaX - 40;
  if (p.y > CFG.beachY - 20) p.y = CFG.beachY - 20;

  // Punch: F hits the nearest ped/thug in front.
  if (Input.hit('KeyF') && p.punchCd <= 0) {
    p.punchCd = 0.35;
    AudioSys.punch();
    const target = nearestHostile(G, p.x, p.y, 46);
    if (target) {
      target.hp -= 25;
      target.vx = Math.cos(p.angle) * 220; target.vy = Math.sin(p.angle) * 220;
      spawnParticles(G, target.x, target.y, 6, '#ffe066', 80);
      if (target.hp <= 0) killThug(G, target);
    } else {
      const ped = nearestPed(G, p.x, p.y, 46);
      if (ped && ped.state !== 'down') {
        ped.state = 'down'; ped.downT = 3; ped.vx = Math.cos(p.angle) * 200; ped.vy = Math.sin(p.angle) * 200;
        addWanted(G, 1);
        spawnParticles(G, ped.x, ped.y, 6, '#ffe066', 80);
      }
    }
  }
  // Shoot: mouse click (aim at cursor) or F with pistol.
  if ((Input.mouseClicked || (Input.hit('KeyF') && p.weapon === 'pistol')) && p.weapon === 'pistol' && p.ammo > 0 && p.shootCd <= 0) {
    p.shootCd = 0.28; p.ammo--;
    const aim = Input.mouseClicked
      ? Math.atan2(Input.mouseY + G.cam.y - p.y, Input.mouseX + G.cam.x - p.x)
      : p.angle;
    p.angle = aim;
    AudioSys.gunshot();
    G.shake = Math.min(10, G.shake + 3);
    spawnParticles(G, p.x + Math.cos(aim) * 20, p.y + Math.sin(aim) * 20, 4, '#ffdd55', 140);
    const hit = shootRay(G, p.x, p.y, aim, 420, 'player');
    if (hit) addWanted(G, 1);
    else if (Math.random() < 0.5) addWanted(G, 1); // shots are heard
    scarePeds(G, p.x, p.y, 260);
  }
  // Enter a car: E near one.
  if (Input.hit('KeyE')) {
    const car = nearestCar(G, p.x, p.y, 62);
    if (car && car.driver !== 'player') enterCar(G, car);
  }
}

function enterCar(G, car) {
  const p = G.player;
  if (car.driver === 'traffic') {
    // Pull the driver out; they flee. Stealing in front of witnesses is a crime.
    const driver = { x: car.x + 34, y: car.y, state: 'flee', vx: 0, vy: 0, hp: 30, color: pick(G.rng, PED_COLORS), speed: 150, downT: 0 };
    G.peds.push(driver);
    addWanted(G, 1);
    car.driver = null;
  } else if (car.driver === 'police') {
    return; // cannot steal a cop car while the cop is in it
  }
  car.driver = 'player';
  p.inCar = car;
  p.x = car.x; p.y = car.y;
  G.enteredThisFrame = true; // so updateTraffic does not exit again on the same press
  AudioSys.blip(220, 0.12, 'square', 0.15, 330);
}

function exitCar(G) {
  const p = G.player;
  const car = p.inCar;
  if (!car) return;
  const side = car.angle + Math.PI / 2;
  const nx = car.x + Math.cos(side) * 40, ny = car.y + Math.sin(side) * 40;
  if (freeSpot(G.world, nx, ny, 14)) { p.x = nx; p.y = ny; }
  else { p.x = car.x - Math.cos(side) * 40; p.y = car.y - Math.sin(side) * 40; }
  car.driver = null;
  car.speed *= 0.3;
  p.inCar = null;
  p.vx = 0; p.vy = 0;
}

// Ray shot: first ped/thug/car/building hit along the ray. Returns the hit or null.
function shootRay(G, x, y, angle, range, from) {
  const step = 10;
  for (let d = 14; d < range; d += step) {
    const px = x + Math.cos(angle) * d, py = y + Math.sin(angle) * d;
    if (collideBuildings(G.world, px, py, 2)) { spawnParticles(G, px, py, 4, '#cccccc', 60); return 'wall'; }
    for (const t of G.thugs) {
      if (t.hp > 0 && dist2(px, py, t.x, t.y) < 16 * 16) {
        t.hp -= 34; spawnParticles(G, t.x, t.y, 8, '#ff5555', 90);
        if (t.hp <= 0) killThug(G, t);
        return t;
      }
    }
    for (const ped of G.peds) {
      if (ped.state !== 'down' && dist2(px, py, ped.x, ped.y) < 14 * 14) {
        ped.state = 'down'; ped.downT = 4;
        return ped;
      }
    }
    for (const c of G.cars) {
      if (c.driver === 'player') continue;
      const dx = px - c.x, dy = py - c.y;
      const ca = Math.cos(-c.angle), sa = Math.sin(-c.angle);
      const lx = dx * ca - dy * sa, ly = dx * sa + dy * ca;
      const type = CAR_TYPES[c.type];
      if (Math.abs(lx) < type.len / 2 && Math.abs(ly) < type.wid / 2) {
        c.hp -= 20;
        spawnParticles(G, px, py, 6, '#ffaa00', 80);
        if (c.hp <= 0) wreckCar(G, c);
        return c;
      }
    }
  }
  return null;
}
