'use strict';
/* Missions + story: five jobs for Mama Lupe. Targets, thugs, rewards. */

function startMission(G, idx) {
  const def = MISSIONS[idx - 1];
  const P = G.world.places;
  const m = { def, stage: 0, targets: [], timer: 0, banner: def.brief };
  G.mission = m;
  G.bannerT = 5;
  if (idx === 1) {
    m.targets = [{ x: P.store.x, y: P.store.y, label: 'Corner Store', r: 70, needsCar: true }];
  } else if (idx === 2) {
    m.targets = [
      { x: G.world.parkBlock.x0 + 40, y: G.world.parkBlock.y0 + 40, label: 'Package 1/3', r: 42, pickup: true },
      { x: P.marina.x, y: P.marina.y, label: 'Package 2/3', r: 42, pickup: true },
      { x: P.hospital.x, y: P.hospital.y, label: 'Package 3/3', r: 42, pickup: true },
    ];
  } else if (idx === 3) {
    const comet = makeCar('sport', P.marina.x, P.marina.y + 30, Math.PI / 2, null);
    comet.hp = 70;
    G.cars.push(comet);
    m.comet = comet;
    m.targets = [{ x: P.marina.x, y: P.marina.y + 30, label: 'Comet GT', r: 60 }];
  } else if (idx === 4) {
    G.thugs = [];
    for (let i = 0; i < 4; i++) {
      G.thugs.push({
        x: P.docks.x + (i % 2) * 70 - 35, y: P.docks.y + Math.floor(i / 2) * 70 - 35,
        angle: 0, hp: 100, shootCd: 1 + i * 0.4, vx: 0, vy: 0, color: '#3d405b',
      });
    }
    m.targets = [{ x: P.docks.x, y: P.docks.y, label: 'The Docks', r: 90 }];
  } else if (idx === 5) {
    const van = makeCar('van', P.garage.x, P.garage.y + 40, 0, null);
    G.cars.push(van);
    m.van = van;
    m.targets = [{ x: P.garage.x, y: P.garage.y + 40, label: 'Cash Van', r: 60 }];
  }
}

function updateMissions(G, dt) {
  const m = G.mission;
  if (!m) return;
  const p = G.player;
  const id = m.def.id;

  if (id === 1) {
    const t = m.targets[0];
    if (p.inCar && dist2(p.x, p.y, t.x, t.y) < t.r * t.r) completeMission(G);
  } else if (id === 2) {
    if (m.stage === 0) {
      let left = 0;
      for (const t of m.targets) {
        if (t.done) continue;
        left++;
        if (dist2(p.x, p.y, t.x, t.y) < t.r * t.r) {
          t.done = true;
          p.cash += 50;
          AudioSys.pickup();
          spawnParticles(G, t.x, t.y, 10, '#ffd166', 100);
        }
      }
      if (left === 0 || m.targets.every(t => t.done)) {
        m.stage = 1;
        m.targets = [{ x: G.world.places.pier.x, y: G.world.places.pier.y, label: 'Solmar Pier', r: 70 }];
      }
    } else if (dist2(p.x, p.y, m.targets[0].x, m.targets[0].y) < 70 * 70) {
      completeMission(G);
    }
  } else if (id === 3) {
    if (m.stage === 0) {
      if (p.inCar === m.comet) {
        m.stage = 1;
        addWanted(G, 2);
        m.targets = [];
        G.bannerT = 4;
        m.banner = 'The Comet is hot! Lose the cops, then bring it to the garage.';
      }
    } else if (m.stage === 1) {
      if (p.wanted === 0 && p.inCar === m.comet) {
        m.stage = 2;
        m.targets = [{ x: G.world.places.garage.x, y: G.world.places.garage.y, label: "Lupe's Garage", r: 70 }];
      }
    } else if (p.inCar === m.comet && dist2(p.x, p.y, m.targets[0].x, m.targets[0].y) < 70 * 70) {
      completeMission(G);
    }
  } else if (id === 4) {
    updateThugs(G, dt);
    if (m.stage === 0 && G.thugs.every(t => t.hp <= 0)) {
      m.stage = 1;
      m.targets = [{ x: G.world.places.docks.x + 20, y: G.world.places.docks.y + 60, label: 'Briefcase', r: 42, pickup: true }];
      G.bannerT = 4;
      m.banner = 'Docks clear. Grab the briefcase.';
    } else if (m.stage === 1) {
      const t = m.targets[0];
      if (dist2(p.x, p.y, t.x, t.y) < t.r * t.r) completeMission(G);
    }
  } else if (id === 5) {
    if (m.stage === 0) {
      if (p.inCar === m.van) {
        m.stage = 1;
        m.timer = m.def.timeLimit;
        p.wanted = 3;
        p.lastCrimeT = G.time;
        m.targets = [{ x: G.world.places.safehouse.x, y: G.world.places.safehouse.y, label: 'Safehouse', r: 70 }];
        G.bannerT = 4;
        m.banner = '90 seconds! The whole city is on you — DRIVE!';
      }
    } else {
      m.timer -= dt;
      if (m.timer <= 0) { failMission(G, 'Out of time — the van never made it.'); return; }
      if (p.inCar === m.van && dist2(p.x, p.y, m.targets[0].x, m.targets[0].y) < 70 * 70) {
        completeMission(G);
      }
    }
  }
}

function updateThugs(G, dt) {
  const p = G.player;
  for (const t of G.thugs) {
    if (t.hp <= 0) continue;
    const d = Math.hypot(p.x - t.x, p.y - t.y);
    t.angle = angleTo(t.x, t.y, p.x, p.y);
    if (d < 280 && d > 90) {
      t.x += Math.cos(t.angle) * 70 * dt;
      t.y += Math.sin(t.angle) * 70 * dt;
    }
    t.shootCd -= dt;
    if (d < 340 && t.shootCd <= 0) {
      t.shootCd = 1.3;
      AudioSys.gunshot();
      spawnParticles(G, t.x + Math.cos(t.angle) * 20, t.y + Math.sin(t.angle) * 20, 3, '#ffdd55', 120);
      // Hit chance falls with distance.
      if (Math.random() < clamp(0.75 - d / 600, 0.15, 0.7)) {
        if (p.inCar) { p.inCar.hp -= 8; if (p.inCar.hp <= 0) wreckCar(G, p.inCar); }
        else hurtPlayer(G, 7, t.x, t.y);
      }
    }
  }
}

function killThug(G, t) {
  t.hp = 0;
  G.player.cash += 50;
  spawnParticles(G, t.x, t.y, 14, '#ff5555', 120);
  AudioSys.crash();
  scarePeds(G, t.x, t.y, 200);
}

function completeMission(G) {
  const m = G.mission;
  const p = G.player;
  p.cash += m.def.reward;
  p.missionsDone = m.def.id;
  p.score += m.def.reward + (m.def.id === 5 ? 1000 : 0);
  AudioSys.missionDone();
  G.mission = null;
  if (m.def.id >= MISSIONS.length) {
    G.state = 'game-complete';
  } else {
    G.state = 'mission-complete';
    G.overlayMission = m.def;
  }
  saveGame(G);
}

function failMission(G, why) {
  G.state = 'mission-failed';
  G.failReason = why;
  AudioSys.busted();
}
