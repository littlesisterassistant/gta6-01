'use strict';
/* City generation: roads, blocks, buildings, park, beach and sea.
   Deterministic from a seed. Buildings are collision rects. */

function buildWorld(seed) {
  const rng = mulberry32(seed);
  const W = CFG.worldW, H = CFG.worldH;
  const buildings = [];
  const trees = [];
  const lamps = [];

  // Blocks between roads. A block is (x0,y0,x1,y1) in world coords.
  const xs = [0].concat(CFG.vRoads.map(x => x - CFG.roadW / 2), [W]);
  const ys = [0].concat(CFG.hRoads.map(y => y - CFG.roadW / 2), [H]);
  // Build block spans between consecutive road edges.
  const xEdges = [];
  let prev = 0;
  for (const vx of CFG.vRoads) { xEdges.push([prev, vx - CFG.roadW / 2]); prev = vx + CFG.roadW / 2; }
  xEdges.push([prev, CFG.seaX - 60]);
  const yEdges = [];
  prev = 0;
  for (const hy of CFG.hRoads) { yEdges.push([prev, hy - CFG.roadW / 2]); prev = hy + CFG.roadW / 2; }
  yEdges.push([prev, CFG.beachY - 40]);

  // The park block: between vRoads[1] and vRoads[2], hRoads[1] and hRoads[2].
  const parkBlock = { x0: xEdges[2][0], y0: yEdges[2][0], x1: xEdges[2][1], y1: yEdges[2][1] };

  for (let bi = 0; bi < xEdges.length; bi++) {
    for (let bj = 0; bj < yEdges.length; bj++) {
      const bx0 = xEdges[bi][0] + 14, by0 = yEdges[bj][0] + 14;
      const bx1 = xEdges[bi][1] - 14, by1 = yEdges[bj][1] - 14;
      if (bx1 - bx0 < 90 || by1 - by0 < 90) continue;
      const isPark = (bi === 2 && bj === 2);
      if (isPark) {
        for (let t = 0; t < 14; t++) {
          trees.push({ x: randRange(rng, bx0 + 20, bx1 - 20), y: randRange(rng, by0 + 20, by1 - 20), r: randRange(rng, 12, 20) });
        }
        continue;
      }
      // 2-4 buildings per block, laid out in a small grid.
      const cols = (bx1 - bx0) > 260 ? 2 : 1;
      const rows = (by1 - by0) > 260 ? 2 : 1;
      const cw = (bx1 - bx0) / cols, ch = (by1 - by0) / rows;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rng() < 0.18) { // empty lot: a few trees instead
            trees.push({ x: bx0 + c * cw + cw / 2, y: by0 + r * ch + ch / 2, r: 16 });
            continue;
          }
          const w = randRange(rng, cw * 0.55, cw * 0.85);
          const h = randRange(rng, ch * 0.55, ch * 0.85);
          const x = bx0 + c * cw + (cw - w) / 2;
          const y = by0 + r * ch + (ch - h) / 2;
          buildings.push({
            x, y, w, h,
            roof: pick(rng, PAL.buildingRoof),
            wall: pick(rng, PAL.buildingWall),
            floors: randInt(rng, 1, 3),
            winSeed: randInt(rng, 1, 9999),
          });
        }
      }
    }
  }

  // Street lamps along roads.
  for (const vx of CFG.vRoads) {
    for (const hy of CFG.hRoads) {
      lamps.push({ x: vx + CFG.roadW / 2 + 8, y: hy - CFG.roadW / 2 - 8 });
      lamps.push({ x: vx - CFG.roadW / 2 - 8, y: hy + CFG.roadW / 2 + 8 });
    }
  }

  // Named places.
  const places = {
    store: { x: CFG.vRoads[1] + 90, y: CFG.hRoads[0] + 90, label: 'Corner Store' },
    pier: { x: CFG.seaX - 130, y: CFG.hRoads[3] + 40, label: 'Solmar Pier' },
    garage: { x: CFG.vRoads[0] - 90, y: CFG.hRoads[2] - 90, label: "Lupe's Garage" },
    docks: { x: CFG.seaX - 160, y: CFG.hRoads[1] - 40, label: 'The Docks' },
    safehouse: { x: CFG.vRoads[3] + 90, y: CFG.hRoads[3] + 90, label: 'Safehouse' },
    marina: { x: CFG.seaX - 170, y: CFG.hRoads[0] + 60, label: 'Marina' },
    hospital: { x: CFG.vRoads[2] - 90, y: CFG.hRoads[3] - 90, label: 'St. Solmar Hospital' },
  };

  return { buildings, trees, lamps, parkBlock, places, rng };
}

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

// Circle vs building rects. Returns the building hit, or null.
function collideBuildings(world, x, y, r) {
  for (const b of world.buildings) {
    const cx = clamp(x, b.x, b.x + b.w);
    const cy = clamp(y, b.y, b.y + b.h);
    if (dist2(x, y, cx, cy) < r * r) return b;
  }
  return null;
}

function isOnRoad(x, y) {
  const hw = CFG.roadW / 2;
  for (const vx of CFG.vRoads) if (Math.abs(x - vx) <= hw) return true;
  for (const hy of CFG.hRoads) if (Math.abs(y - hy) <= hw) return true;
  return false;
}

// Nearest point on any road centreline (for spawning traffic / snapping).
function nearestRoadPoint(x, y) {
  let best = null, bestD = Infinity;
  for (const vx of CFG.vRoads) {
    const d = Math.abs(x - vx);
    if (d < bestD) { bestD = d; best = { x: vx, y: clamp(y, 0, CFG.worldH), axis: 'v' }; }
  }
  for (const hy of CFG.hRoads) {
    const d = Math.abs(y - hy);
    if (d < bestD) { bestD = d; best = { x: clamp(x, 0, CFG.worldW), y: hy, axis: 'h' }; }
  }
  return best;
}

function randomRoadPoint(rng) {
  if (rng() < 0.5) {
    const vx = pick(rng, CFG.vRoads);
    return { x: vx + randRange(rng, -28, 28), y: randRange(rng, 60, CFG.worldH - 60), axis: 'v' };
  }
  const hy = pick(rng, CFG.hRoads);
  return { x: randRange(rng, 60, CFG.worldW - 60), y: hy + randRange(rng, -28, 28), axis: 'h' };
}

// A sidewalk point near a road (for pedestrians).
function randomSidewalkPoint(rng) {
  const p = randomRoadPoint(rng);
  const off = CFG.roadW / 2 + randRange(rng, 8, 26);
  if (p.axis === 'v') return { x: p.x + (rng() < 0.5 ? off : -off), y: p.y };
  return { x: p.x, y: p.y + (rng() < 0.5 ? off : -off) };
}

function freeSpot(world, x, y, r) {
  if (x < 30 || y < 30 || x > CFG.worldW - 30 || y > CFG.worldH - 30) return false;
  if (x > CFG.seaX - 80 || y > CFG.beachY - 30) return false;
  return !collideBuildings(world, x, y, r);
}
