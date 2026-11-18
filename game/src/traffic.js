'use strict';
/* Traffic cars, pedestrians and the shared arcade driving physics. */

function makeCar(type, x, y, angle, driver) {
  const t = CAR_TYPES[type];
  return {
    type, x, y, angle, speed: 0, hp: t.hp, driver: driver === undefined ? 'traffic' : driver,
    dir: 0, // traffic heading: 0 E, 1 S, 2 W, 3 N
    cruise: randRange(G.rng, 0.55, 0.85) * t.top,
    skidT: 0, flashT: 0, honkT: 0,
  };
}

function spawnTraffic(G, n) {
  const types = ['compact', 'sedan', 'sedan', 'taxi', 'compact', 'truck', 'sedan'];
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(G.rng);
    const type = pick(G.rng, types);
    const car = makeCar(type, p.x, p.y, 0, 'traffic');
    car.dir = p.axis === 'v' ? (G.rng() < 0.5 ? 1 : 3) : (G.rng() < 0.5 ? 0 : 2);
    car.angle = [0, Math.PI / 2, Math.PI, -Math.PI / 2][car.dir];
    // Right-hand lane offset.
    const off = 26;
    if (car.dir === 0) car.y += off; if (car.dir === 2) car.y -= off;
    if (car.dir === 1) car.x -= off; if (car.dir === 3) car.x += off;
    car.speed = car.cruise * 0.7;
    G.cars.push(car);
  }
}

function spawnPeds(G, n) {
  for (let i = 0; i < n; i++) {
    const p = randomSidewalkPoint(G.rng);
    G.peds.push({
      x: p.x, y: p.y, angle: G.rng() * Math.PI * 2, vx: 0, vy: 0,
      state: 'walk', speed: randRange(G.rng, 45, 75), hp: 30,
      color: pick(G.rng, PED_COLORS), downT: 0, turnT: randRange(G.rng, 2, 6),
      fleeX: 0, fleeY: 0,
    });
  }
}

function nearestCar(G, x, y, maxD) {
  let best = null, bd = maxD * maxD;
  for (const c of G.cars) {
    const d = dist2(x, y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function nearestPed(G, x, y, maxD) {
  let best = null, bd = maxD * maxD;
  for (const p of G.peds) {
    if (p.state === 'down') continue;
    const d = dist2(x, y, p.x, p.y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function nearestHostile(G, x, y, maxD) {
  let best = null, bd = maxD * maxD;
  for (const t of G.thugs) {
    if (t.hp <= 0) continue;
    const d = dist2(x, y, t.x, t.y);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

function scarePeds(G, x, y, radius) {
  for (const p of G.peds) {
    if (p.state === 'down') continue;
    if (dist2(x, y, p.x, p.y) < radius * radius) {
      p.state = 'flee'; p.fleeX = x; p.fleeY = y;
    }
  }
}

// --- driving physics shared by every car ---
function driveCar(G, car, dt, throttle, steer, handbrake) {
  const t = CAR_TYPES[car.type];
  const accel = throttle * t.accel;
  car.speed += accel * dt;
  if (throttle === 0) car.speed *= Math.pow(0.4, dt); // coast
  if (handbrake) { car.speed *= Math.pow(0.05, dt); }
  car.speed = clamp(car.speed, -t.top * 0.4, t.top);
  const steerRate = t.grip * (car.speed >= 0 ? 1 : -1) * clamp(Math.abs(car.speed) / 120, 0, 1);
  car.angle += steer * steerRate * dt * (handbrake ? 1.6 : 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const frontX = nx + Math.cos(car.angle) * (t.len / 2 - 6);
  const frontY = ny + Math.sin(car.angle) * (t.len / 2 - 6);
  const rearX = nx - Math.cos(car.angle) * (t.len / 2 - 6);
  const rearY = ny - Math.sin(car.angle) * (t.len / 2 - 6);
  const hitF = collideBuildings(G.world, frontX, frontY, 10) || frontX > CFG.seaX - 30 || frontY > CFG.beachY - 20;
  const hitR = collideBuildings(G.world, rearX, rearY, 10);
  if (hitF || hitR) {
    if (Math.abs(car.speed) > 120) {
      // Only the player's (or a police) car takes damage; traffic just bounces
      // so the city does not fill with wrecks on its own.
      if (car.driver === 'player' || car.driver === 'police') {
        car.hp -= 12;
        spawnParticles(G, hitF ? frontX : rearX, hitF ? frontY : rearY, 10, '#ffcc44', 120);
        AudioSys.crash();
        if (car.driver === 'player') { G.shake = Math.min(14, G.shake + 8); hurtPlayer(G, 4); }
        if (car.hp <= 0) { wreckCar(G, car); return; }
      } else {
        spawnParticles(G, hitF ? frontX : rearX, hitF ? frontY : rearY, 4, '#ffcc44', 80);
      }
    }
    car.speed *= -0.25;
  } else {
    car.x = nx; car.y = ny;
  }
  car.x = clamp(car.x, 20, CFG.worldW - 20);
  car.y = clamp(car.y, 20, CFG.worldH - 20);
  // Skid marks while handbraking at speed.
  if (handbrake && Math.abs(car.speed) > 140) {
    addSkid(G, car.x - Math.cos(car.angle) * t.len / 2, car.y - Math.sin(car.angle) * t.len / 2, car.angle);
    if (Math.random() < 0.3) spawnParticles(G, car.x, car.y, 1, '#bbbbbb', 30);
  }
}

function updateTrafficCar(G, car, dt) {
  const t = CAR_TYPES[car.type];
  // At an intersection, maybe turn.
  const nearX = CFG.vRoads.some(vx => Math.abs(car.x - vx) < 24);
  const nearY = CFG.hRoads.some(hy => Math.abs(car.y - hy) < 24);
  if (nearX && nearY && G.rng() < dt * 0.35) {
    const turns = [0, 1, 2, 3].filter(d => d !== (car.dir + 2) % 4);
    car.dir = pick(G.rng, turns);
    car.angle = [0, Math.PI / 2, Math.PI, -Math.PI / 2][car.dir];
  }
  // Slow down for a car ahead.
  let ahead = null;
  for (const o of G.cars) {
    if (o === car) continue;
    const d = dist2(car.x, car.y, o.x, o.y);
    if (d < 70 * 70) {
      const a = angleTo(car.x, car.y, o.x, o.y);
      if (Math.abs(angleDiff(car.angle, a)) < 0.6) { ahead = o; break; }
    }
  }
  const target = ahead ? Math.max(0, ahead.speed * 0.6) : car.cruise;
  const throttle = car.speed < target ? 1 : 0;
  driveCar(G, car, dt, throttle, 0, false);
  // Keep on the road: if it drifted off, steer back toward the centreline.
  const rp = nearestRoadPoint(car.x, car.y);
  if (rp && dist2(car.x, car.y, rp.x, rp.y) > 55 * 55) {
    const want = angleTo(car.x, car.y, rp.x, rp.y);
    car.angle += clamp(angleDiff(car.angle, want), -1, 1) * dt * 2;
  }
}

function updateTraffic(G, dt) {
  // Player-driven car.
  const p = G.player;
  if (p.inCar) {
    const car = p.inCar;
    let throttle = 0, steer = 0;
    if (Input.down('KeyW', 'ArrowUp')) throttle = 1;
    if (Input.down('KeyS', 'ArrowDown')) throttle = -0.7;
    if (Input.down('KeyA', 'ArrowLeft')) steer = -1;
    if (Input.down('KeyD', 'ArrowRight')) steer = 1;
    if (G.autoDrive) { throttle = 1; steer = 0; } // ?shot=chase staging only
    const hb = Input.down('Space');
    driveCar(G, car, dt, throttle, steer, hb);
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    AudioSys.setEngine(Math.abs(car.speed) / CAR_TYPES[car.type].top, true);
    if (Input.hit('KeyE') && !G.enteredThisFrame) exitCar(G);
    if (Math.abs(car.speed) > 40 && Math.random() < dt * 0.5) {
      spawnParticles(G, car.x - Math.cos(car.angle) * 26, car.y - Math.sin(car.angle) * 26, 1, '#999999', 20);
    }
  } else {
    AudioSys.setEngine(0, false);
  }

  for (const car of G.cars) {
    if (car.driver !== 'traffic') continue; // parked / player / police handled elsewhere
    if (car.hp <= 0) continue;
    updateTrafficCar(G, car, dt);
  }

  // Car-car collisions: push apart, spark on hard hits.
  for (let i = 0; i < G.cars.length; i++) {
    const a = G.cars[i];
    if (a.hp <= 0) continue;
    for (let j = i + 1; j < G.cars.length; j++) {
      const b = G.cars[j];
      if (b.hp <= 0) continue;
      const ra = CAR_TYPES[a.type].len / 2.4, rb = CAR_TYPES[b.type].len / 2.4;
      const d2 = dist2(a.x, a.y, b.x, b.y);
      const rr = ra + rb;
      if (d2 < rr * rr && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
        const push = (rr - d) / 2;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const rel = Math.abs(a.speed - b.speed);
        if (rel > 130 && (a.driver === 'player' || b.driver === 'player' || a.driver === 'police' || b.driver === 'police')) {
          a.hp -= 6; b.hp -= 6;
          spawnParticles(G, (a.x + b.x) / 2, (a.y + b.y) / 2, 8, '#ffcc44', 110);
          AudioSys.crash();
          if (a.driver === 'player' || b.driver === 'player') G.shake = Math.min(12, G.shake + 5);
          if (a.hp <= 0) wreckCar(G, a);
          if (b.hp <= 0) wreckCar(G, b);
        } else {
          a.speed *= 0.7; b.speed *= 0.7;
        }
      }
    }
  }

  // Player car hitting pedestrians.
  if (p.inCar) {
    const car = p.inCar;
    for (const ped of G.peds) {
      if (ped.state === 'down') continue;
      if (dist2(car.x, car.y, ped.x, ped.y) < 30 * 30 && Math.abs(car.speed) > 60) {
        ped.state = 'down'; ped.downT = 4;
        ped.vx = Math.cos(car.angle) * 240; ped.vy = Math.sin(car.angle) * 240;
        addWanted(G, 1);
        spawnParticles(G, ped.x, ped.y, 6, '#ffe066', 90);
        AudioSys.crash();
        G.shake = Math.min(10, G.shake + 4);
      }
    }
  }

  // Despawn far traffic, respawn near the player to keep the city alive.
  for (let i = G.cars.length - 1; i >= 0; i--) {
    const car = G.cars[i];
    if (car.driver !== 'traffic' || car.hp <= 0) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d > 1500) {
      const rp = randomRoadPoint(G.rng);
      // Respawn on a road within ~700px of the player.
      let tries = 0;
      while (Math.hypot(rp.x - p.x, rp.y - p.y) > 800 && tries++ < 8) {
        const q = randomRoadPoint(G.rng); rp.x = q.x; rp.y = q.y; rp.axis = q.axis;
      }
      car.x = rp.x; car.y = rp.y;
      car.dir = rp.axis === 'v' ? (G.rng() < 0.5 ? 1 : 3) : (G.rng() < 0.5 ? 0 : 2);
      car.angle = [0, Math.PI / 2, Math.PI, -Math.PI / 2][car.dir];
      car.speed = car.cruise * 0.7;
    }
  }
}

function updatePeds(G, dt) {
  const p = G.player;
  for (const ped of G.peds) {
    if (ped.state === 'down') {
      ped.downT -= dt;
      ped.x += ped.vx * dt; ped.y += ped.vy * dt;
      ped.vx *= 0.9; ped.vy *= 0.9;
      if (ped.downT <= 0) { ped.state = 'flee'; ped.fleeX = p.x; ped.fleeY = p.y; }
      continue;
    }
    if (ped.state === 'flee') {
      const a = angleTo(ped.fleeX, ped.fleeY, ped.x, ped.y);
      ped.angle = a;
      ped.x += Math.cos(a) * ped.speed * 1.9 * dt;
      ped.y += Math.sin(a) * ped.speed * 1.9 * dt;
      if (dist2(ped.x, ped.y, ped.fleeX, ped.fleeY) > 500 * 500) ped.state = 'walk';
    } else {
      ped.turnT -= dt;
      if (ped.turnT <= 0) {
        ped.turnT = randRange(G.rng, 3, 8);
        ped.angle += pick(G.rng, [-Math.PI / 2, Math.PI / 2, Math.PI, 0]);
      }
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
    // Keep peds out of buildings and the sea.
    const b = collideBuildings(G.world, ped.x, ped.y, 10);
    if (b || ped.x > CFG.seaX - 30 || ped.y > CFG.beachY - 14) {
      ped.angle += Math.PI / 2;
      ped.x = clamp(ped.x, 20, CFG.seaX - 40);
      ped.y = clamp(ped.y, 20, CFG.beachY - 24);
    }
    ped.x = clamp(ped.x, 16, CFG.worldW - 16);
    ped.y = clamp(ped.y, 16, CFG.worldH - 16);
  }
}
