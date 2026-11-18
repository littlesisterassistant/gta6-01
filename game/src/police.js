'use strict';
/* Wanted level + Solmar police: pursuit cars, foot cops, busted. */

function addWanted(G, n) {
  const p = G.player;
  if (G.mission && G.mission.def.id === 4 && G.mission.stage === 0) return; // dock fight is off the books
  p.wanted = clamp(p.wanted + n, 0, CFG.maxWanted);
  p.lastCrimeT = G.time;
}

// Where a pursuit car heads: along the road grid toward the player's road,
// straight at the player once close. Grid routing keeps cops out of buildings.
function policeTarget(G, car) {
  const p = G.player;
  const d = Math.hypot(p.x - car.x, p.y - car.y);
  if (d < 220) return { x: p.x, y: p.y };
  const rp = nearestRoadPoint(car.x, car.y);
  const pp = nearestRoadPoint(p.x, p.y);
  if (rp.axis === 'v' && pp.axis === 'h') return { x: rp.x, y: pp.y };
  if (rp.axis === 'h' && pp.axis === 'v') return { x: pp.x, y: rp.y };
  return { x: pp.x, y: pp.y };
}

function updateWanted(G, dt) {
  const p = G.player;
  // Wanted cools off when the player stays clean.
  if (p.wanted > 0 && G.time - p.lastCrimeT > 18) {
    G.wantedDecayT += dt;
    if (G.wantedDecayT > 10) { G.wantedDecayT = 0; p.wanted--; }
  } else {
    G.wantedDecayT = 0;
  }

  // Spawn police cars: wanted + 1, capped at 5.
  const want = Math.min(p.wanted + 1, 5);
  let cops = 0;
  for (const c of G.cars) if (c.driver === 'police') cops++;
  G.sirenT -= dt;
  if (p.wanted > 0 && cops < want) {
    G.spawnT -= dt;
    if (G.spawnT <= 0) {
      G.spawnT = 2.5;
      const rp = randomRoadPoint(G.rng);
      let tries = 0;
      // Prefer a spawn 420–900px away so the chase arrives quickly.
      while ((Math.hypot(rp.x - p.x, rp.y - p.y) < 420 || Math.hypot(rp.x - p.x, rp.y - p.y) > 900) && tries++ < 12) {
        const q = randomRoadPoint(G.rng); rp.x = q.x; rp.y = q.y;
      }
      const car = makeCar('police', rp.x, rp.y, 0, 'police');
      car.angle = angleTo(rp.x, rp.y, p.x, p.y);
      car.speed = 200;
      G.cars.push(car);
      if (G.sirenT <= 0) { AudioSys.siren(); G.sirenT = 3.5; }
    }
  }

  // Foot cops.
  for (const cop of G.cops) {
    if (cop.downT > 0) { cop.downT -= dt; continue; }
    const d = Math.hypot(p.x - cop.x, p.y - cop.y);
    const a = angleTo(cop.x, cop.y, p.x, p.y);
    cop.angle = a;
    const sp = 200;
    cop.x += Math.cos(a) * sp * dt;
    cop.y += Math.sin(a) * sp * dt;
    if (d < 30) {
      if (p.inCar) {
        // Cop yanks at the door: slow the car, damage the player a little.
        p.inCar.speed *= Math.pow(0.5, dt);
        hurtPlayer(G, 3 * dt, cop.x, cop.y);
      } else {
        // On foot: held still long enough = busted.
        p.bustedT += dt;
        if (p.bustedT > 1.5) { bustPlayer(G); return; }
      }
    } else {
      p.bustedT = Math.max(0, p.bustedT - dt * 2);
    }
    // Cop gives up if the player escapes far on foot.
    if (d > 900 && !p.inCar) { cop.downT = 999; }
  }
  G.cops = G.cops.filter(c => c.downT < 900);

  // Police cars chase and ram, routing along the road grid.
  for (const car of G.cars) {
    if (car.driver !== 'police' || car.hp <= 0) continue;
    const d = Math.hypot(p.x - car.x, p.y - car.y);
    const tgt = policeTarget(G, car);
    const want = angleTo(car.x, car.y, tgt.x, tgt.y);
    const steer = clamp(angleDiff(car.angle, want), -1, 1);
    const throttle = d > 90 ? 1 : 0.6;
    driveCar(G, car, dt, throttle, steer, false);
    // Ram the player on foot: knockdown.
    if (!p.inCar && d < 34 && Math.abs(car.speed) > 80) {
      hurtPlayer(G, CFG.copRamDamage, car.x, car.y);
      addWanted(G, 0);
    }
    // Ram the player's car: damage it.
    if (p.inCar && d < 52 && Math.abs(car.speed) > 60) {
      p.inCar.hp -= 4;
      spawnParticles(G, car.x, car.y, 6, '#ffcc44', 90);
      G.shake = Math.min(10, G.shake + 4);
      car.speed *= 0.5;
      if (p.inCar.hp <= 0) wreckCar(G, p.inCar);
    }
    // Close and slow on foot: the cop gets out and chases on foot.
    if (!p.inCar && d < 70 && Math.abs(car.speed) < 120 && G.cops.length < 3) {
      car.driver = null;
      car.speed = 0;
      G.cops.push({ x: car.x + 30, y: car.y, angle: want, hp: 50, downT: 0 });
      AudioSys.blip(500, 0.15, 'square', 0.15, 700);
    }
    // Despawn far-away empty cop cars.
    if (d > 1600) { car.hp = 0; car.driver = null; }
  }
  // Remove wrecked police cars.
  G.cars = G.cars.filter(c => !(c.hp <= 0 && c.driver === 'police'));
}

function bustPlayer(G) {
  const p = G.player;
  p.cash = Math.max(0, p.cash - 200);
  p.wanted = 0;
  p.bustedT = 0;
  G.state = 'busted';
  AudioSys.busted();
  if (p.inCar) { p.inCar.driver = null; p.inCar = null; }
  // Respawn at the hospital when the player restarts.
  p.x = G.world.places.hospital.x; p.y = G.world.places.hospital.y;
  p.hp = CFG.playerHp;
  G.cops = [];
  saveGame(G);
}
