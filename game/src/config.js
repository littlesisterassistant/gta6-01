'use strict';
/* SOLMAR HEAT — config: world constants, palette, car types, mission chain.
   Original city, names and story. Nothing from any commercial game. */

const CFG = {
  title: 'SOLMAR HEAT',
  city: 'Solmar Bay',
  worldW: 3200,
  worldH: 2400,
  viewW: 1280,
  viewH: 720,
  roadW: 110,
  // Vertical roads (x centres) and horizontal roads (y centres)
  vRoads: [400, 1000, 1600, 2200, 2800],
  hRoads: [350, 900, 1450, 2000],
  // Sea strip on the east edge, beach on the south edge
  seaX: 3050,
  beachY: 2250,
  maxWanted: 5,
  copRamDamage: 8,
  playerHp: 100,
  saveKey: 'solmar-heat-save-v1',
};

// Sun-soaked coastal palette: warm sky, teal sea, pastel buildings.
const PAL = {
  sky: '#ffd9a0',
  grass: '#8fce7a',
  sand: '#f2d8a0',
  sea: '#2fb3c9',
  seaDeep: '#1d8fb0',
  sidewalk: '#cfc4ae',
  asphalt: '#4a4a52',
  asphaltEdge: '#33333a',
  lane: '#ffd94d',
  buildingRoof: ['#ff9e7d', '#7dd8c3', '#ffd166', '#f78fb3', '#a78bfa', '#8ecae6', '#ffb703', '#e07a5f'],
  buildingWall: ['#f7ede2', '#fff1e6', '#ffe8d6', '#fde2e4', '#e2ece9', '#fff3b0'],
  park: '#6fbf5a',
  tree: '#2e8b57',
  treeLight: '#57a773',
  window: '#2b3a55',
  policeWhite: '#f5f5f5',
  policeBlack: '#22242a',
  taxiYellow: '#ffc300',
};

const CAR_TYPES = {
  compact: { name: 'Pinto', len: 52, wid: 26, top: 250, accel: 150, grip: 3.4, color: '#e07a5f', hp: 60 },
  sedan:   { name: 'Marlin', len: 58, wid: 27, top: 310, accel: 170, grip: 3.2, color: '#457b9d', hp: 80 },
  sport:   { name: 'Comet GT', len: 56, wid: 26, top: 430, accel: 260, grip: 2.6, color: '#e63946', hp: 70 },
  taxi:    { name: 'Cab', len: 56, wid: 27, top: 290, accel: 160, grip: 3.2, color: '#ffc300', hp: 80 },
  truck:   { name: 'Hauler', len: 84, wid: 32, top: 220, accel: 110, grip: 3.8, color: '#6d6875', hp: 160 },
  police:  { name: 'Interceptor', len: 58, wid: 27, top: 390, accel: 240, grip: 3.0, color: '#f5f5f5', hp: 120 },
  van:     { name: 'Cash Van', len: 72, wid: 30, top: 260, accel: 130, grip: 3.6, color: '#8ecae6', hp: 140 },
};

const PED_COLORS = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#9b5de5', '#f15bb5', '#00bbf9', '#f4845f'];

const MISSIONS = [
  {
    id: 1, name: 'First Errand', giver: 'Mama Lupe',
    brief: 'Jax, my boy. You owe me, so you drive for me now. Get a car and come to the corner store on Coral Ave.',
    objective: 'Steal or borrow a car, then drive to the yellow marker',
    reward: 300,
  },
  {
    id: 2, name: 'Package Run', giver: 'Mama Lupe',
    brief: 'Three parcels, three corners of Solmar. Pick them all up, then drop them at the pier. Quick feet, quick wheels.',
    objective: 'Collect 3 packages, then deliver them to the pier',
    reward: 500,
  },
  {
    id: 3, name: 'Hot Wheels', giver: 'Mama Lupe',
    brief: 'A red Comet GT is parked by the marina. Bring it to my garage. The cops will notice — lose them first.',
    objective: 'Steal the Comet GT, lose the cops, park it in the garage',
    reward: 800,
  },
  {
    id: 4, name: 'Dockside Trouble', giver: 'Mama Lupe',
    brief: 'The Dock Rats are leaning on my boys at the docks. Go sort it out — all four of them — and grab the briefcase.',
    objective: 'Defeat 4 Dock Rats at the docks, then take the briefcase',
    reward: 1200,
  },
  {
    id: 5, name: 'The Big Score', giver: 'Mama Lupe',
    brief: 'One last job and your debt is clear. Drive the cash van to the safehouse in 90 seconds — and the whole city will be on you.',
    objective: 'Drive the cash van to the safehouse within 90 seconds',
    reward: 2000,
    timeLimit: 90,
  },
];

const STORY_INTRO = 'Solmar Bay, 6pm. Jax Moreno owes Mama Lupe $5,800 and she collects in favours, not cash. Five jobs and the debt is clear — if the Solmar police let him finish them.';
