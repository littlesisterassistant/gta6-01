'use strict';
/* All drawing: city, cars, people, HUD, minimap, menus, effects. */

function drawGame(ctx, G) {
  const cam = G.cam;
  ctx.save();
  ctx.clearRect(0, 0, CFG.viewW, CFG.viewH);
  // Warm sunset backdrop beyond the world edge.
  ctx.fillStyle = PAL.sky;
  ctx.fillRect(0, 0, CFG.viewW, CFG.viewH);
  const sx = (Math.random() - 0.5) * G.shake, sy = (Math.random() - 0.5) * G.shake;
  ctx.translate(-cam.x + sx, -cam.y + sy);
  drawGround(ctx, G);
  drawSkids(ctx, G);
  drawMarkers(ctx, G);
  drawBuildings(ctx, G);
  drawTrees(ctx, G);
  drawCars(ctx, G);
  drawPeds(ctx, G);
  drawThugs(ctx, G);
  drawCops(ctx, G);
  drawPlayer(ctx, G);
  drawParticles(ctx, G);
  ctx.restore();
  drawHUD(ctx, G);
  if (G.state === 'menu') drawMenu(ctx, G);
  else if (G.state === 'paused') drawPaused(ctx, G);
  else if (G.state === 'mission-complete') drawMissionComplete(ctx, G);
  else if (G.state === 'mission-failed') drawMissionFailed(ctx, G);
  else if (G.state === 'busted') drawBusted(ctx, G, 'BUSTED');
  else if (G.state === 'wasted') drawBusted(ctx, G, 'WASTED');
  else if (G.state === 'game-complete') drawGameComplete(ctx, G);
}

function drawGround(ctx, G) {
  const W = CFG.worldW, H = CFG.worldH;
  ctx.fillStyle = PAL.grass;
  ctx.fillRect(0, 0, W, H);
  // Park.
  const pb = G.world.parkBlock;
  ctx.fillStyle = PAL.park;
  ctx.fillRect(pb.x0, pb.y0, pb.x1 - pb.x0, pb.y1 - pb.y0);
  // Beach + sea.
  ctx.fillStyle = PAL.sand;
  ctx.fillRect(CFG.seaX - 90, 0, 90, H);
  ctx.fillRect(0, CFG.beachY - 40, W, 40);
  ctx.fillStyle = PAL.sea;
  ctx.fillRect(CFG.seaX, 0, W - CFG.seaX, H);
  ctx.fillStyle = PAL.seaDeep;
  for (let y = 60; y < H; y += 130) {
    ctx.fillRect(CFG.seaX + 18, y, 90, 8);
    ctx.fillRect(CFG.seaX + 40, y + 60, 60, 6);
  }
  // Roads: asphalt + centre dashes + sidewalks.
  ctx.fillStyle = PAL.sidewalk;
  for (const vx of CFG.vRoads) ctx.fillRect(vx - CFG.roadW / 2 - 14, 0, CFG.roadW + 28, H);
  for (const hy of CFG.hRoads) ctx.fillRect(0, hy - CFG.roadW / 2 - 14, W, CFG.roadW + 28);
  ctx.fillStyle = PAL.asphalt;
  for (const vx of CFG.vRoads) ctx.fillRect(vx - CFG.roadW / 2, 0, CFG.roadW, H);
  for (const hy of CFG.hRoads) ctx.fillRect(0, hy - CFG.roadW / 2, W, CFG.roadW);
  ctx.fillStyle = PAL.lane;
  for (const vx of CFG.vRoads) {
    for (let y = 0; y < H; y += 64) ctx.fillRect(vx - 2, y, 4, 32);
  }
  for (const hy of CFG.hRoads) {
    for (let x = 0; x < W; x += 64) ctx.fillRect(x, hy - 2, 32, 4);
  }
  // Place labels.
  ctx.fillStyle = 'rgba(20,20,30,0.55)';
  ctx.font = 'bold 15px Arial';
  ctx.textAlign = 'center';
  for (const key of Object.keys(G.world.places)) {
    const pl = G.world.places[key];
    ctx.fillText(pl.label.toUpperCase(), pl.x, pl.y - 24);
  }
  // Street lamps.
  ctx.fillStyle = '#2b2b33';
  for (const l of G.world.lamps) { ctx.beginPath(); ctx.arc(l.x, l.y, 4, 0, Math.PI * 2); ctx.fill(); }
}

function drawSkids(ctx, G) {
  ctx.strokeStyle = 'rgba(30,30,30,0.5)';
  ctx.lineWidth = 4;
  for (const s of G.skids) {
    ctx.globalAlpha = clamp(s.life / 6, 0, 0.5);
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawMarkers(ctx, G) {
  if (!G.mission) return;
  const t = G.time;
  for (const m of G.mission.targets) {
    if (m.done) continue;
    const pulse = 1 + 0.15 * Math.sin(t * 5);
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, m.r * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,217,77,0.18)';
    ctx.beginPath(); ctx.arc(0, 0, m.r * pulse, 0, Math.PI * 2); ctx.fill();
    // Bouncing arrow above the marker.
    ctx.fillStyle = '#ffd94d';
    const ay = -m.r - 18 + Math.sin(t * 4) * 6;
    ctx.beginPath();
    ctx.moveTo(0, ay + 14); ctx.lineTo(-10, ay); ctx.lineTo(10, ay); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(m.label, m.x, m.y + m.r + 20);
  }
}

function drawBuildings(ctx, G) {
  for (const b of G.world.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    ctx.fillStyle = PAL.window;
    const rng = mulberry32(b.winSeed);
    const cols = Math.max(1, Math.floor(b.w / 26)), rows = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (rng() < 0.6) ctx.fillRect(b.x + 9 + i * 26, b.y + 9 + j * 26, 12, 12);
      }
    }
  }
}

function drawTrees(ctx, G) {
  for (const t of G.world.trees) {
    ctx.fillStyle = PAL.tree;
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PAL.treeLight;
    ctx.beginPath(); ctx.arc(t.x - 4, t.y - 4, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
  }
}

function drawCarShape(ctx, car) {
  const t = CAR_TYPES[car.type];
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-t.len / 2 + 3, -t.wid / 2 + 4, t.len, t.wid);
  ctx.fillStyle = car.color;
  roundRect(ctx, -t.len / 2, -t.wid / 2, t.len, t.wid, 8);
  ctx.fill();
  // Windows + roof.
  ctx.fillStyle = '#22303f';
  ctx.fillRect(-t.len * 0.18, -t.wid / 2 + 4, t.len * 0.28, t.wid - 8);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-t.len / 2 + 4, -t.wid / 2 + 3, t.len * 0.16, t.wid - 6);
  // Headlights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(t.len / 2 - 3, -t.wid / 2 + 3, 3, 6);
  ctx.fillRect(t.len / 2 - 3, t.wid / 2 - 9, 3, 6);
  if (car.type === 'police') {
    ctx.fillStyle = '#22242a';
    ctx.fillRect(-t.len * 0.05, -t.wid / 2, t.len * 0.1, t.wid);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
    // Flashing light bar.
    const phase = Math.floor(G.time * 6) % 2 === 0;
    ctx.fillStyle = phase ? '#ff2222' : '#2244ff';
    ctx.fillRect(-8, -t.wid / 2 - 4, 7, 5);
    ctx.fillStyle = phase ? '#2244ff' : '#ff2222';
    ctx.fillRect(1, -t.wid / 2 - 4, 7, 5);
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#111';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-10, -t.wid / 2 - 3, 20, 5);
  }
  if (car.hp < CAR_TYPES[car.type].hp * 0.4) {
    // Smoke from a dying car.
    if (Math.random() < 0.4) spawnParticles(G, car.x, car.y, 1, '#888888', 30);
  }
  ctx.restore();
}

function drawCars(ctx, G) {
  for (const car of G.cars) {
    if (car.wrecked) {
      // A wreck stays on the street: dark shell, thin smoke.
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      ctx.fillStyle = '#3a3a40';
      roundRect(ctx, -CAR_TYPES[car.type].len / 2, -CAR_TYPES[car.type].wid / 2, CAR_TYPES[car.type].len, CAR_TYPES[car.type].wid, 8);
      ctx.fill();
      ctx.restore();
      if (Math.random() < 0.25) spawnParticles(G, car.x, car.y, 1, '#888888', 25);
      continue;
    }
    drawCarShape(ctx, car);
  }
}

function drawPerson(ctx, x, y, angle, color, opts) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath(); ctx.arc(6, 0, 6, 0, Math.PI * 2); ctx.fill();
  if (opts && opts.gun) {
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -2, 12, 4);
  }
  ctx.restore();
}

function drawPeds(ctx, G) {
  for (const p of G.peds) {
    if (p.state === 'down') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(1.2);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      continue;
    }
    drawPerson(ctx, p.x, p.y, p.angle, p.color, null);
  }
}

function drawThugs(ctx, G) {
  for (const t of G.thugs) {
    if (t.hp <= 0) continue;
    drawPerson(ctx, t.x, t.y, t.angle, t.color, { gun: true });
    // Health bar.
    ctx.fillStyle = '#222';
    ctx.fillRect(t.x - 16, t.y - 26, 32, 5);
    ctx.fillStyle = '#e63946';
    ctx.fillRect(t.x - 16, t.y - 26, 32 * (t.hp / 100), 5);
  }
}

function drawCops(ctx, G) {
  for (const c of G.cops) {
    if (c.downT > 0) continue;
    drawPerson(ctx, c.x, c.y, c.angle, '#1d3557', { gun: true });
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PD', c.x, c.y - 14);
  }
}

function drawPlayer(ctx, G) {
  const p = G.player;
  if (p.inCar) return; // drawn as the car
  const blink = p.hurtCd > 0 && Math.floor(G.time * 12) % 2 === 0;
  if (blink) return;
  // White ring so the player reads at a glance in a busy city.
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(p.x, p.y, 17, 0, Math.PI * 2); ctx.stroke();
  const col = p.weapon === 'pistol' ? '#f4a261' : '#2a9d8f';
  drawPerson(ctx, p.x, p.y, p.angle, col, { gun: p.weapon === 'pistol' });
  // Punch swing arc.
  if (p.punchCd > 0.2) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 26, p.angle - 0.7, p.angle + 0.7);
    ctx.stroke();
  }
}

function drawParticles(ctx, G) {
  for (const pt of G.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- HUD ----------
function drawHUD(ctx, G) {
  const p = G.player;
  ctx.textAlign = 'left';
  // Cash.
  ctx.fillStyle = 'rgba(10,10,16,0.6)';
  roundRect(ctx, 12, 12, 190, 44, 8); ctx.fill();
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 26px Arial';
  ctx.fillText(fmtCash(p.cash), 24, 44);
  // Wanted stars.
  ctx.fillStyle = 'rgba(10,10,16,0.6)';
  roundRect(ctx, 12, 64, 190, 40, 8); ctx.fill();
  for (let i = 0; i < CFG.maxWanted; i++) {
    ctx.fillStyle = i < p.wanted ? '#ffd94d' : 'rgba(255,255,255,0.25)';
    drawStar(ctx, 34 + i * 34, 84, i < p.wanted ? 13 : 11);
  }
  // Health + weapon.
  ctx.fillStyle = 'rgba(10,10,16,0.6)';
  roundRect(ctx, 12, CFG.viewH - 64, 230, 52, 8); ctx.fill();
  ctx.fillStyle = '#333';
  ctx.fillRect(24, CFG.viewH - 50, 150, 12);
  ctx.fillStyle = p.hp > 30 ? '#7ee787' : '#ff5555';
  ctx.fillRect(24, CFG.viewH - 50, 150 * (p.hp / 100), 12);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px Arial';
  ctx.fillText('HP ' + Math.ceil(p.hp), 182, CFG.viewH - 38);
  ctx.fillText(p.weapon === 'pistol' ? 'PISTOL  ' + p.ammo + ' rds' : 'FISTS', 24, CFG.viewH - 22);
  // Speed when driving.
  if (p.inCar) {
    const t = CAR_TYPES[p.inCar.type];
    ctx.fillStyle = 'rgba(10,10,16,0.6)';
    roundRect(ctx, CFG.viewW - 220, CFG.viewH - 64, 208, 52, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(Math.round(Math.abs(p.inCar.speed) * 0.36) + ' km/h', CFG.viewW - 206, CFG.viewH - 30);
    ctx.font = '13px Arial';
    ctx.fillText(t.name, CFG.viewW - 206, CFG.viewH - 52);
  }
  // Mission objective.
  if (G.mission) {
    ctx.fillStyle = 'rgba(10,10,16,0.65)';
    const txt = 'MISSION ' + G.mission.def.id + ' — ' + G.mission.def.name + ': ' + currentObjective(G);
    ctx.font = 'bold 16px Arial';
    const w = ctx.measureText(txt).width + 28;
    roundRect(ctx, (CFG.viewW - w) / 2, 12, w, 34, 8); ctx.fill();
    ctx.fillStyle = '#ffd94d';
    ctx.textAlign = 'center';
    ctx.fillText(txt, CFG.viewW / 2, 35);
    ctx.textAlign = 'left';
    if (G.mission.def.id === 5 && G.mission.stage === 1) {
      ctx.fillStyle = G.mission.timer < 20 ? '#ff5555' : '#fff';
      ctx.font = 'bold 30px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(fmtTime(G.mission.timer), CFG.viewW / 2, 84);
      ctx.textAlign = 'left';
    }
  }
  // Story banner.
  if (G.bannerT > 0 && G.mission) {
    ctx.fillStyle = 'rgba(20,16,40,0.78)';
    roundRect(ctx, 190, 110, CFG.viewW - 380, 74, 10); ctx.fill();
    ctx.fillStyle = '#ffb703';
    ctx.font = 'bold 15px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(G.mission.def.giver.toUpperCase() + ' CALLS:', CFG.viewW / 2, 136);
    ctx.fillStyle = '#fff';
    ctx.font = 'italic 16px Arial';
    wrapText(ctx, G.mission.banner, CFG.viewW / 2, 158, CFG.viewW - 430, 20);
    ctx.textAlign = 'left';
  }
  // Edge arrow to the active target.
  if (G.mission) {
    const t = activeTarget(G);
    if (t) {
      const px = t.x - G.cam.x, py = t.y - G.cam.y;
      if (px < 40 || py < 40 || px > CFG.viewW - 40 || py > CFG.viewH - 40) {
        const cx = clamp(px, 60, CFG.viewW - 60), cy = clamp(py, 60, CFG.viewH - 60);
        const a = angleTo(cx, cy, px, py);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a);
        ctx.fillStyle = '#ffd94d';
        ctx.beginPath();
        ctx.moveTo(18, 0); ctx.lineTo(-10, -11); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#ffd94d';
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(Math.hypot(t.x - p.x, t.y - p.y) / 10) * 10 + 'm', cx, cy + 30);
        ctx.textAlign = 'left';
      }
    }
  }
  if (G.showMinimap) drawMinimap(ctx, G);
}

function currentObjective(G) {
  const m = G.mission;
  if (!m) return '';
  if (m.def.id === 2 && m.stage === 0) {
    const left = m.targets.filter(t => !t.done).length;
    return 'Collect the packages (' + (3 - left) + '/3)';
  }
  if (m.def.id === 3 && m.stage === 1) return 'Lose the cops, then park at the garage';
  if (m.def.id === 4 && m.stage === 0) {
    const left = G.thugs.filter(t => t.hp > 0).length;
    return 'Deal with the Dock Rats (' + left + ' left)';
  }
  return m.def.objective;
}

function activeTarget(G) {
  if (!G.mission) return null;
  for (const t of G.mission.targets) if (!t.done) return t;
  return null;
}

function drawStar(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function wrapText(ctx, text, cx, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  ctx.fillText(line, cx, yy);
}

// ---------- Minimap ----------
function drawMinimap(ctx, G) {
  const mw = 200, mh = 150;
  const mx = CFG.viewW - mw - 14, my = 14;
  const s = mw / CFG.worldW;
  ctx.fillStyle = 'rgba(10,10,16,0.72)';
  roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 8); ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, mw, mh);
  ctx.clip();
  ctx.fillStyle = '#7a9e6a';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#2fb3c9';
  ctx.fillRect(mx + CFG.seaX * s, my, mw - CFG.seaX * s, mh);
  ctx.fillStyle = '#4a4a52';
  for (const vx of CFG.vRoads) ctx.fillRect(mx + vx * s - 2, my, 4, mh);
  for (const hy of CFG.hRoads) ctx.fillRect(mx, my + hy * s - 2, mw, 4);
  // Mission marker.
  const t = activeTarget(G);
  if (t) {
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath(); ctx.arc(mx + t.x * s, my + t.y * s, 5, 0, Math.PI * 2); ctx.fill();
  }
  // Police dots.
  ctx.fillStyle = '#4d7cff';
  for (const c of G.cars) {
    if (c.driver === 'police') { ctx.beginPath(); ctx.arc(mx + c.x * s, my + c.y * s, 3, 0, Math.PI * 2); ctx.fill(); }
  }
  // Player arrow.
  const p = G.player;
  ctx.save();
  ctx.translate(mx + p.x * s, my + p.y * s);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0); ctx.lineTo(-5, -4); ctx.lineTo(-5, 4); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  // Viewport rectangle.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + G.cam.x * s, my + G.cam.y * s, CFG.viewW * s, CFG.viewH * s);
}

// ---------- Menus ----------
function menuPanel(ctx, title, sub) {
  ctx.fillStyle = 'rgba(8,8,18,0.55)';
  ctx.fillRect(0, 0, CFG.viewW, CFG.viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffb703';
  ctx.font = 'bold 84px "Arial Black", Arial';
  ctx.fillText(title, CFG.viewW / 2, 200);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px Arial';
  ctx.fillText(sub, CFG.viewW / 2, 240);
}

function drawMenu(ctx, G) {
  menuPanel(ctx, CFG.title, 'An open-world crime story in ' + CFG.city);
  ctx.fillStyle = '#ffe8c2';
  ctx.font = '16px Arial';
  wrapText(ctx, STORY_INTRO, CFG.viewW / 2, 300, 760, 22);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 17px Arial';
  const lines = [
    'WASD / Arrows — walk & drive    E — enter / exit car',
    'SHIFT — run    SPACE — handbrake    F — punch    CLICK — shoot (pistol)',
    'M — minimap    P — pause    R — restart',
    'Missions: 5 jobs for Mama Lupe. Earn cash. Dodge the Solmar PD.',
  ];
  lines.forEach((l, i) => ctx.fillText(l, CFG.viewW / 2, 400 + i * 26));
  if (G.save && G.save.missionsDone > 0) {
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('Saved progress: ' + G.save.missionsDone + '/5 missions, ' + fmtCash(G.save.cash) + ' — press ENTER to continue', CFG.viewW / 2, 540);
  }
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 26px Arial';
  if (Math.floor(G.time * 1.5) % 2 === 0) ctx.fillText('▶  PRESS ENTER OR CLICK TO START', CFG.viewW / 2, 600);
  ctx.textAlign = 'left';
}

function drawPaused(ctx, G) {
  ctx.fillStyle = 'rgba(8,8,18,0.6)';
  ctx.fillRect(0, 0, CFG.viewW, CFG.viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 56px Arial';
  ctx.fillText('PAUSED', CFG.viewW / 2, 300);
  ctx.font = '18px Arial';
  ctx.fillText('P or click to resume — R to restart the run', CFG.viewW / 2, 350);
  ctx.textAlign = 'left';
}

function drawMissionComplete(ctx, G) {
  const m = G.overlayMission;
  ctx.fillStyle = 'rgba(8,20,12,0.62)';
  ctx.fillRect(0, 0, CFG.viewW, CFG.viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 54px Arial';
  ctx.fillText('MISSION COMPLETE', CFG.viewW / 2, 280);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px Arial';
  ctx.fillText(m.name + '  •  +' + fmtCash(m.reward), CFG.viewW / 2, 330);
  if (m.id === 2) {
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('PISTOL UNLOCKED — click to shoot, F to punch', CFG.viewW / 2, 362);
  }
  ctx.fillStyle = '#fff';
  ctx.font = '18px Arial';
  ctx.fillText('Total cash: ' + fmtCash(G.player.cash) + '   •   Missions: ' + m.id + '/5', CFG.viewW / 2, 394);
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 22px Arial';
  ctx.fillText('PRESS ENTER FOR MISSION ' + (m.id + 1), CFG.viewW / 2, 430);
  ctx.textAlign = 'left';
}

function drawMissionFailed(ctx, G) {
  ctx.fillStyle = 'rgba(20,8,8,0.62)';
  ctx.fillRect(0, 0, CFG.viewW, CFG.viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5555';
  ctx.font = 'bold 54px Arial';
  ctx.fillText('MISSION FAILED', CFG.viewW / 2, 280);
  ctx.fillStyle = '#fff';
  ctx.font = '18px Arial';
  ctx.fillText(G.failReason || 'Try again.', CFG.viewW / 2, 330);
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 22px Arial';
  ctx.fillText('PRESS ENTER TO RETRY', CFG.viewW / 2, 400);
  ctx.textAlign = 'left';
}

function drawBusted(ctx, G, word) {
  ctx.fillStyle = 'rgba(10,8,20,0.66)';
  ctx.fillRect(0, 0, CFG.viewW, CFG.viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = word === 'BUSTED' ? '#4d7cff' : '#ff5555';
  ctx.font = 'bold 72px Arial';
  ctx.fillText(word, CFG.viewW / 2, 300);
  ctx.fillStyle = '#fff';
  ctx.font = '18px Arial';
  ctx.fillText(word === 'BUSTED' ? 'The Solmar PD caught you. $200 bail.' : 'Jax is down. The city keeps moving.', CFG.viewW / 2, 350);
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 22px Arial';
  ctx.fillText('PRESS R OR CLICK TO GET BACK UP', CFG.viewW / 2, 410);
  ctx.textAlign = 'left';
}

function drawGameComplete(ctx, G) {
  const p = G.player;
  ctx.fillStyle = 'rgba(8,20,12,0.66)';
  ctx.fillRect(0, 0, CFG.viewW, CFG.viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 64px "Arial Black", Arial';
  ctx.fillText('SOLMAR LEGEND', CFG.viewW / 2, 250);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px Arial';
  ctx.fillText('All 5 jobs done. The debt is clear — Jax owns the city now.', CFG.viewW / 2, 300);
  ctx.font = '20px Arial';
  ctx.fillText('Total cash: ' + fmtCash(p.cash) + '   •   Time: ' + fmtTime(p.runT), CFG.viewW / 2, 350);
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 22px Arial';
  ctx.fillText('PRESS R TO PLAY FREE ROAM', CFG.viewW / 2, 420);
  ctx.textAlign = 'left';
}

