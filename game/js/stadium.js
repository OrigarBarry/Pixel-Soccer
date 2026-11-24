'use strict';
// ====================================================================
//  STADIUM: the stands around the rink continue sideways, at the same pixel scale and on the same seat grid,
//  into the screen space beside the rink. Seat rows, vertical aisles and walkways carry on across the edge
//  of the rink view; further out come concourses with concession stands, restrooms and exits, then more
//  seating. Fans get up, shuffle along their row to an aisle, walk to a concourse, queue for food and come
//  back with it (some of them from seats inside the original stands, crossing the edge). Hawkers work the
//  aisles and people stroll the concourses. Everything is placed in "sprite pixels" (1 sprite px = SS world
//  units, the size the players and fans are drawn at), so the side canvases line up with the main view.
// ====================================================================
const STAD = { g: null, sides: { L: null, R: null }, walkers: [], view: { L: null, R: null }, cv: { L: null, R: null }, t: 0, needE: 0, preview: false, queue: [] };
const ST_T = 48, ST_B = 40, ST_M = 20, ST_CONC = 64;
const STAND_TYPES = [
  { n: 'HOT DOGS', c: '#c0392b', a: '#ffd23f', item: '#d98a3a', steam: 1 }, { n: 'POPCORN', c: '#d9342b', a: '#ffffff', item: '#fff3b0' },
  { n: 'DRINKS', c: '#2a6ad7', a: '#7ec8ff', item: '#7ec8ff' }, { n: 'PIZZA', c: '#e07a1f', a: '#ffd23f', item: '#e0b030', steam: 1 },
  { n: 'NACHOS', c: '#d9a020', a: '#3a8a5a', item: '#ffd23f' }, { n: 'PRETZELS', c: '#8a5a2b', a: '#f4e4c0', item: '#c08040' },
  { n: 'PITCH CREAM', c: '#e87ab0', a: '#ffffff', item: '#ffd0e8' }, { n: 'COFFEE', c: '#5a3a1e', a: '#f4e4c0', item: '#ffffff', steam: 1 },
  { n: 'FRIES', c: '#b8262b', a: '#ffd23f', item: '#ffd23f' }, { n: 'MERCH', team: 1 },
];
const HAWK_CALLS = ['HOT DOGS!', 'POPCORN!', 'COLD DRINKS!', 'PEANUTS!', 'GET YOUR SNACKS!'];
const stHome = () => TEAM[S.match ? S.match.home ?? 0 : 0] || TEAM[0];

// ---------- called by buildCrowd() with its geometry and fan generator
function stadOnCrowd(g) {
  STAD.g = g; STAD.sides = { L: null, R: null }; STAD.walkers = []; STAD.queue = [];
  for (const st of g.seats) if (st.dyn) STAD.walkers.push(stadFanWalker(st, st.side));
}
const stX = (sd, d) => sd === 'L' ? -d : STAD.g.SW + d;                 // outward distance -> sprite x
const stD = (sd, x) => sd === 'L' ? -x : x - STAD.g.SW;
// a fan on his feet in a row stands on the floor strip in front of the seats (crowd px below the seat's top)
const ROW_FEET = 14.6, STAND_FEET = 12.8, STAND_NEAR = 16, STAND_HOLD = 24;   // standers press back against their seats so the walker passes in front
function stadFanWalker(st, side) {
  return { kind: 'fan', side, st, d: stD(side, st.x + 6), y: st.y + ROW_FEET, state: 'seat', t: 60 + Math.random() * 900, c: st.c, s: st.s, h: st.hat ? st.hatC : st.h, ph: Math.random() * 4 | 0, path: [], item: null };
}

// ---------- one side of the extension: layout, seats, static art (frames are drawn on demand)
function stadSide(sd, E) {
  const cur = STAD.sides[sd];
  if (cur && cur.E >= E) return cur;
  const g = STAD.g, cfg = arenaCfg(), VN = g.VN, L = sd === 'L', H0 = stHome();
  const rng = mulberrySeed(hashId(sd + cfg.venue + (H0.abbr || '') + (g.seedSalt || 0)));
  E = Math.max(E, cur ? cur.E : 0);
  if (cur) {   // rebuilding wider: drop this side's people (fans from the stands by the rink just sit back down)
    STAD.walkers = STAD.walkers.filter(w => w.side !== sd || (w.kind === 'fan' && !w.st.z));
    for (const w of STAD.walkers) if (w.side === sd) { w.state = 'seat'; w.path = []; w.item = null; w.t = 200 + Math.random() * 600; }
  }
  // zones going outward: seats, concourse, seats, concourse...
  const zones = []; let d = 0, k = 0;
  while (d < E + 60) {
    const z = { type: 'seats', a: d, b: d + (k === 0 ? 150 + rng() * 46 : 104 + rng() * 96), aisles: [], k,
      tint: k === 0 ? 0 : (rng() < 0.5 ? -1 : 1) * (0.05 + rng() * 0.08), empty: k === 0 ? 0.06 : 0.03 + rng() * 0.1, club: k > 0 && rng() < 0.3 };
    z.b = Math.round(z.b);
    let p = d + (k === 0 ? 34 + rng() * 22 : 36 + rng() * 30);
    while (p < z.b - 24) { z.aisles.push(Math.round(p)); p += 60 + rng() * 38; }
    if (!z.aisles.length) z.aisles.push(Math.round((z.a + z.b) / 2));
    zones.push(z); d = z.b;
    zones.push({ type: 'conc', a: d, b: d + ST_CONC, k, stands: [], deco: [] }); d += ST_CONC; k++;
  }
  // image covers x in [-E, 8] (left) or [SW-8, SW+E] (right), y in [-ST_T, SH+ST_B]
  const iw = E + 8, ih = g.SH + ST_T + ST_B, ix0 = L ? -E : g.SW - 8, iy0 = -ST_T;
  const side = { sd, E, zones, iw, ih, ix0, iy0, seats: [], straddle: g.seats.filter(st => L ? st.x < 0 : st.x + g.CW > g.SW), frames: [], stat: null, walkways: [-10, ...g.aisleY] };
  const seatZone = (d0, d1) => zones.find(z => z.type === 'seats' && d0 >= z.a && d1 <= z.b - 1 && !z.aisles.some(a => d1 > a - 3 && d0 < a + 3));
  const add = (x, y, back) => {
    const d0 = stD(sd, L ? x + g.CW : x), d1 = d0 + g.CW; if (d0 < 0) return;
    const z = seatZone(d0, d1); if (!z) return;
    const st = g.mkFan(x, y, back); st.z = z; st.empty = st.empty || rng() < z.empty * (S.match && S.match.fill != null && S.match.fill < 0.97 ? 1 : 0.25);
    if (!st.empty && !st.prop && rng() < 0.05) { st.dyn = true; STAD.walkers.push(stadFanWalker(st, sd)); }
    side.seats.push(st);
  };
  const lim = L ? -E - g.CW : g.SW + E;
  const gridRow = (start, y, back) => { if (L) for (let x = start; x > lim; x -= g.CW) add(x, y, back); else for (let x = start; x < lim; x += g.CW) add(x, y, back); };
  const firstAt = (phase) => { let x = phase; if (L) { while (x > -g.CW) x -= g.CW; } else { while (x < g.SW) x += g.CW; } return x; };
  for (let y = g.topEnd - g.RH, i = 0; y > -g.RH + 3; y -= g.RH, i++) gridRow(firstAt((i % 2) * 6 - 3), y, false);
  for (let y = g.botStart, i = 0; y < g.SH - 2; y += g.RH, i++) gridRow(firstAt((i % 2) * 6 - 3), y, true);
  const inWalk = y => g.aisleY.some(a => y + g.RH > a - 3 && y < a + 3);
  for (let y = g.topEnd + 2; y < g.botStart - g.RH + 2; y += g.RH) if (!inWalk(y)) gridRow(firstAt(L ? g.leftEnd - g.CW : g.rightStart), y, false);
  side.seats.sort((a, b) => a.y - b.y);
  // concession stands, restrooms, exits along the outer wall of each concourse
  for (const z of zones) if (z.type === 'conc') {
    let y = -ST_T + 6 + rng() * 10;
    const types = STAND_TYPES.slice().sort(() => rng() - 0.5); let ti = 0;
    while (y < g.SH + ST_B - 30) {
      const r = rng();
      if (r < 0.72) { const T = types[ti++ % types.length]; z.stands.push({ y0: Math.round(y), h: 26, T, queue: [], serve: 0, z }); y += 26 + 10 + rng() * 22; }
      else if (r < 0.86) { z.deco.push({ kind: 'wc', y: Math.round(y) }); y += 24 + rng() * 10; }
      else { z.deco.push({ kind: 'exit', y: Math.round(y) }); y += 20 + rng() * 10; }
    }
    for (let yy = -ST_T + 30; yy < g.SH + ST_B; yy += 48 + rng() * 30) z.deco.push({ kind: 'bin', y: Math.round(yy), off: rng() < 0.5 });
  }
  // concourse strollers, aisle hawkers, walkers on the top walkway
  const life = typeof crowdLife === 'function' ? crowdLife() : 1;      // a thin crowd: fewer people about, fewer vendors
  for (const z of zones) {
    if (z.type === 'conc') for (let i = 0; i < Math.round((3 + (rng() * 3 | 0)) * (0.25 + 0.75 * life)); i++) STAD.walkers.push(stadStroller(sd, z, rng));
    else if (z.k < 3 && rng() < 0.2 + 0.8 * life) { const a = z.aisles[(rng() * z.aisles.length) | 0]; STAD.walkers.push({ kind: 'hawk', side: sd, d: a, y: 10 + rng() * (g.SH - 40), state: 'walk', path: [], t: 0, c: '#f4f4f0', s: '#d9a066', h: '#c0392b', ph: 0, tray: STAND_TYPES[(rng() * 4) | 0].c, call: HAWK_CALLS[(rng() * HAWK_CALLS.length) | 0] }); }
  }
  for (let i = 0; i < 2; i++) STAD.walkers.push({ kind: 'top', side: sd, d: 10 + rng() * Math.min(E, 300), y: -9 + (rng() * 4 - 2), state: 'walk', path: [], t: 0, c: ['#3a8a5a', '#c94a3a', '#555b7a', H0.main][i + (rng() * 2 | 0)], s: '#f0c49b', h: '#2b1d12', ph: rng() * 4 | 0 });
  STAD.sides[sd] = side;
  side.stat = stadStatic(side, cfg, VN, rng);
  return side;
}
function stadStroller(sd, z, rng) {
  const lane = z.a + 22 + rng() * 14, g = STAD.g;
  return { kind: 'stroll', side: sd, d: lane, y: -ST_T + rng() * (g.SH + ST_T + ST_B), state: 'walk', path: [], t: 0, lane, z,
    c: ['#d8d8d8', '#555b7a', '#c94a3a', '#e0b030', '#3a8a5a', '#8a5ad0', stHome().main][(rng() * 7) | 0], s: ['#f0c49b', '#d9a066', '#a8714a', '#7a4b2a'][(rng() * 4) | 0], h: ['#2b1d12', '#c9a050', '#1a1a1a'][(rng() * 3) | 0], ph: rng() * 4 | 0 };
}

// ---------- static art (floors, aisles, walkways, concourses, stands); seats are added per crowd frame
function stadStatic(side, cfg, VN, rng) {
  const g = STAD.g, sd = side.sd, cv = mkCanvas(side.iw, side.ih), c = cv.getContext('2d');
  c.translate(-side.ix0, -side.iy0);
  const rectD = (d0, d1, y0, y1, col) => { const xa = stX(sd, d0), xb = stX(sd, d1); c.fillStyle = col; c.fillRect(Math.min(xa, xb), y0, Math.abs(xb - xa), y1 - y0); };
  c.fillStyle = VN.bg; c.fillRect(side.ix0, side.iy0, side.iw, side.ih);
  const walkC = shade(VN.aisle, -0.18), H0 = stHome();
  for (const z of side.zones) {
    if (z.type === 'seats') {
      rectD(z.a, z.b, 0, g.SH, VN.floor);
      rectD(z.a, z.b, -ST_T, 0, walkC); rectD(z.a, z.b, -3, -1, VN.step);                 // top walkway + railing
      rectD(z.a, z.b, g.SH, g.SH + ST_B, walkC); rectD(z.a, z.b, g.SH + 1, g.SH + 3, VN.step);
      for (const a of g.aisleY) rectD(z.a, z.b, a - 3, a + 3, VN.aisle);                      // walkways carry on from the side stands
      for (const a of z.aisles) {                                                            // stairways
        rectD(a - 3, a + 3, 0, g.SH, VN.aisle);
        for (let y = 2; y < g.SH; y += 4) if (!g.aisleY.some(w => y > w - 4 && y < w + 4)) rectD(a - 3, a + 3, y, y + 1, VN.step);
      }
      if (z.club) { rectD(z.a, z.a + 1, 0, g.SH, '#9fd0ff'); rectD(z.b - 1, z.b, 0, g.SH, '#9fd0ff'); }
      if (cfg.deco === 'streamers' && typeof drawStreamers === 'function') {               // STREAMERS: garlands along the railings
        const xa = stX(sd, z.a), xb = stX(sd, z.b), x0 = Math.min(xa, xb), ln = Math.abs(xb - xa); drawStreamers(c, [[x0, -1, ln], [x0, g.SH + 3, ln], ...g.aisleY.map(a => [x0, a - 3, ln])], H0);
      }
      // exit signs over the top walkway
      if (rng() < 0.7) { const d0 = z.a + 20 + rng() * (z.b - z.a - 40), x = stX(sd, d0); c.fillStyle = '#0a3a1a'; c.fillRect(x - 9, -22, 18, 7); pText(c, 'EXIT', x - 7, -21, '#5ee07a'); }
    } else stadConcourse(c, side, z, cfg, VN, rng, rectD, H0);
  }
  return cv;
}
function stadConcourse(c, side, z, cfg, VN, rng, rectD, H0) {
  const g = STAD.g, sd = side.sd, y0 = -ST_T, y1 = g.SH + ST_B, v = venueOf(cfg).roof || 'truss';
  const TH = {
    truss: { floor: '#2e3346', line: '#272b3b', wall: '#14182a', rail: '#7a86b0', grid: 8 },
    beams: { floor: '#4a3220', line: '#3a2616', wall: '#22160c', rail: '#8a6a3a', planks: 4 },
    neon: { floor: '#1a0a26', line: '#26103a', wall: '#0a0212', rail: '#ff3ea5', checker: 4 },
    sky: { floor: '#e4ebf3', line: '#cdd8e6', wall: '#e8eef6', rail: '#c9d6e4', snow: 1 },
    skyline: { floor: '#1b2030', line: '#232a3e', wall: '#1a3050', rail: '#5a6680', glass: 1 },
    halo: { floor: '#7c889e', line: '#6e7a90', wall: '#2a3448', rail: '#7ef0ff', grid: 6 },
    arches: { floor: '#6a1220', line: '#5a0e1a', wall: '#2a0a10', rail: '#c9a050', carpet: 1 },
  }[v] || {};
  rectD(z.a, z.b, y0, y1, TH.floor);
  // floor pattern
  for (let y = y0; y < y1; y++) for (let dd = z.a + 2; dd < z.b - 2; dd++) {
    let on = false;
    if (TH.grid) on = (y % TH.grid === 0) || (Math.round(dd) % TH.grid === 0);
    else if (TH.planks) on = Math.round(dd) % TH.planks === 0 || ((y + Math.round(dd) * 7) % 23 === 0);
    else if (TH.checker) on = ((Math.floor(y / 4) + Math.floor(dd / 4)) & 1) === 1;
    else if (TH.snow) on = ((y * 31 + Math.round(dd) * 17) % 13) === 0;
    else if (TH.glass) on = ((y + Math.round(dd)) % 9) === 0;
    else if (TH.carpet) on = (Math.round(dd) - z.a === 6 || z.b - Math.round(dd) === 26);
    if (on) rectD(dd, dd + 1, y, y + 1, TH.carpet ? '#c9a050' : TH.line);
  }
  // inner railing (rink side) with openings at the walkways; outer wall
  const openings = [[-ST_T + 2, -2], ...g.aisleY.map(a => [a - 3, a + 3]), [g.SH, g.SH + ST_B]];
  for (let y = y0; y < y1; y++) if (!openings.some(([o0, o1]) => y >= o0 && y < o1)) rectD(z.a, z.a + 2, y, y + 1, TH.rail);
  rectD(z.b - 4, z.b, y0, y1, TH.wall);
  if (TH.glass) for (let y = y0; y < y1; y += 2) if (rng() < 0.35) rectD(z.b - 3, z.b - 2, y, y + 1, rng() < 0.8 ? '#ffd890' : '#7ec8ff');   // city lights through the glass
  if (TH.snow) for (let y = y0 + 4; y < y1; y += 9 + rng() * 6) {                                                                         // pine trees outside
    const r = 3 + (rng() * 2 | 0), dc = z.b - 2 + rng() * 2; for (let k = -r; k <= r; k++) rectD(dc - r + Math.abs(k), dc + r - Math.abs(k), y + k, y + k + 1, '#0b2418');
  }
  // theme lights along the lane
  for (let y = y0 + 10; y < y1; y += 26) {
    const dl = z.a + 30;
    if (v === 'beams' || v === 'arches' || v === 'sky') { c.save(); const x = stX(sd, dl); const gr = c.createRadialGradient(x, y, 0, x, y, 10); gr.addColorStop(0, v === 'sky' ? 'rgba(255,200,120,.25)' : 'rgba(255,220,150,.22)'); gr.addColorStop(1, 'rgba(255,220,150,0)'); c.fillStyle = gr; c.fillRect(x - 10, y - 10, 20, 20); c.restore(); rectD(dl, dl + 1, y, y + 1, v === 'arches' ? '#ffe9a8' : v === 'sky' ? ['#ff4a3d', '#ffd23f', '#5ee07a', '#7ec8ff'][(y >> 3) % 4] : '#ffd890'); }
    if (v === 'neon' || v === 'halo') { rectD(z.a + 3, z.a + 4, y - 6, y + 6, v === 'neon' ? '#1fe0f0' : '#7ef0ff'); }
    if (v === 'arches' && ((y / 26) | 0) % 2) { rectD(z.a + 3, z.a + 6, y, y + 3, '#e8e4d8'); }
    if (v === 'truss' && ((y / 26) | 0) % 3 === 0) rectD(z.a + 3, z.a + 6, y, y + 3, '#5a6280');
  }
  // restrooms, exits, bins
  for (const o of z.deco) {
    if (o.kind === 'wc') { rectD(z.b - 10, z.b - 4, o.y, o.y + 16, '#2a3a5a'); rectD(z.b - 9, z.b - 5, o.y + 1, o.y + 15, '#3a4a6a'); const x = Math.min(stX(sd, z.b - 4), stX(sd, z.b - 20)); c.fillStyle = '#1b3a8a'; c.fillRect(x, o.y - 7, 12, 7); pText(c, 'WC', x + 2, o.y - 6, '#ffffff'); }
    else if (o.kind === 'exit') { rectD(z.b - 6, z.b - 4, o.y, o.y + 14, '#0a0c16'); const x = Math.min(stX(sd, z.b - 4), stX(sd, z.b - 22)); c.fillStyle = '#0a3a1a'; c.fillRect(x, o.y - 7, 18, 7); pText(c, 'EXIT', x + 2, o.y - 6, '#5ee07a'); }
    else if (o.kind === 'bin') { const dd = o.off ? z.a + 4 : z.b - 9; rectD(dd, dd + 3, o.y, o.y + 4, '#3a3f4e'); rectD(dd, dd + 3, o.y, o.y + 1, '#5a6070'); }
  }
  // concession stands: booth against the wall, counter facing the lane, awning, sign
  for (const s of z.stands) {
    const T = s.T, col = T.team ? H0.main : T.c, acc = T.team ? H0.trim : T.a;
    rectD(z.b - 20, z.b - 4, s.y0, s.y0 + s.h, shade(col, -0.35));                       // booth
    rectD(z.b - 8, z.b - 4, s.y0, s.y0 + s.h, shade(col, -0.55));                        // back counter / kitchen
    for (let y = s.y0; y < s.y0 + s.h; y++) rectD(z.b - 21, z.b - 18, y, y + 1, ((y - s.y0) >> 1) & 1 ? acc : col);   // awning stripes
    rectD(z.b - 22, z.b - 21, s.y0, s.y0 + s.h, '#d8d8d8');                              // counter
    for (let i = 0; i < 4; i++) rectD(z.b - 22, z.b - 21, s.y0 + 4 + i * 5, s.y0 + 6 + i * 5, T.item || acc);
    const w = pTextW(T.n) + 4, xo = stX(sd, z.b - 3), x = sd === 'L' ? xo : xo - w;
    c.fillStyle = '#05060d'; c.fillRect(x - 1, s.y0 - 9, w + 2, 9); c.fillStyle = col; c.fillRect(x, s.y0 - 8, w, 7); pText(c, T.n, x + 2, s.y0 - 7, lum(col) > 0.6 ? '#141832' : '#ffffff');
    s.qd = [z.b - 26, z.b - 33, z.b - 40, z.b - 47]; s.qy = s.y0 + s.h / 2 + 4;
  }
}
// ---------- fine detail over the static art (drawn on the 1.5x crowd grid): stair nosings and handrails,
// railing posts, wall panels, light fixtures, booth menus, counters with cups and snacks, scalloped awnings
function stadFineDetail(c, side, cfg) {
  const g = STAD.g, sd = side.sd, v = venueOf(cfg).roof || 'truss', VN = g.VN, H0 = stHome();
  const FX = x => Math.round((x - side.ix0) * CROWD_FINE), FY = y => Math.round((y - side.iy0) * CROWD_FINE);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  const R = (x0, y0, w, h, col) => { c.fillStyle = col; c.fillRect(x0, y0, w, h); };
  const RD = (d0, d1, y0, y1, col) => { const xa = FX(stX(sd, d0)), xb = FX(stX(sd, d1)); R(Math.min(xa, xb), FY(y0), Math.max(1, Math.abs(xb - xa)), Math.max(1, FY(y1) - FY(y0)), col); };
  const rail = { truss: '#9aa6cc', beams: '#b08a50', neon: '#ff6ec0', sky: '#e8f0f8', skyline: '#7a86a0', halo: '#a8f6ff', arches: '#e0c070' }[v] || '#9aa6cc';
  for (const z of side.zones) {
    if (z.type === 'seats') {
      // stairways: lit nosing on every step and a centre handrail with posts
      for (const a of z.aisles) {
        for (let y = 2; y < g.SH; y += 4) if (!g.aisleY.some(w => y > w - 4 && y < w + 4)) RD(a - 3, a + 3, y - 0.67, y, shade(VN.step, 0.25));
        const xr = FX(stX(sd, a)); R(xr, FY(0), 1, FY(g.SH) - FY(0), rail);
        for (let y = 0; y < g.SH; y += 8) R(xr - 1, FY(y), 3, 1, shade(rail, -0.25));
      }
      // walkway railings: posts and a highlight along the top bar
      for (const [y0] of [[-3], [g.SH + 1]]) { RD(z.a, z.b, y0, y0 + 0.67, shade(rail, 0.15)); for (let dd = z.a + 2; dd < z.b; dd += 6) RD(dd, dd + 0.67, y0, y0 + 2, shade(rail, -0.3)); }
      continue;
    }
    // concourse: rail posts, wall panel seams + base trim, ceiling light pools on the floor
    const y0 = -ST_T, y1 = g.SH + ST_B;
    for (let y = y0; y < y1; y += 4) RD(z.a, z.a + 2, y, y + 0.67, shade(rail, -0.3));
    RD(z.a + 1, z.a + 1.67, y0, y1, shade(rail, 0.25));
    for (let y = y0; y < y1; y += 8) RD(z.b - 4, z.b - 3.33, y, y + 6, 'rgba(255,255,255,.06)');
    RD(z.b - 4.67, z.b - 4, y0, y1, 'rgba(0,0,0,.25)');
    for (let y = y0 + 14; y < y1; y += 26) { const x = FX(stX(sd, z.a + 16)), yy = FY(y); c.fillStyle = 'rgba(255,240,200,.07)'; c.fillRect(x - 6, yy - 4, 12, 8); c.fillRect(x - 4, yy - 6, 8, 12); }
    // the building's signature: steel I-beam pillars (classic), LED strips (dome), marble pillars + chandeliers (palace) ...
    for (let y = y0 + 6; y < y1; y += 40) {
      if (z.stands.some(st => y > st.y0 - 10 && y < st.y0 + st.h + 4)) continue;
      if (v === 'truss' || v === 'skyline') { RD(z.b - 8, z.b - 4, y, y + 4, '#3a4058'); RD(z.b - 8, z.b - 4, y, y + 0.67, '#6a7290'); RD(z.b - 6.33, z.b - 5.67, y, y + 4, '#2a2e40'); RD(z.b - 8, z.b - 4, y + 3.33, y + 4, '#22263a'); }
      if (v === 'arches') { RD(z.b - 9, z.b - 4, y, y + 5, '#e8e2d6'); RD(z.b - 9, z.b - 4, y, y + 0.67, '#c9a050'); RD(z.b - 9, z.b - 4, y + 4.33, y + 5, '#c9a050'); RD(z.b - 7, z.b - 6.33, y + 1, y + 4, '#cfc6b4'); }
      if (v === 'beams') { RD(z.b - 7, z.b - 4, y, y + 3, '#5a3a1e'); RD(z.b - 7, z.b - 4, y, y + 0.67, '#7a5230'); }
    }
    if (v === 'halo' || v === 'neon') for (let y = y0; y < y1; y += 2) RD(z.b - 4.67, z.b - 4, y, y + 1.33, ((y / 2 | 0) + (STAD.t >> 4)) % 5 ? (v === 'halo' ? '#5fe0f0' : '#ff3ea5') : '#ffffff');
    if (v === 'arches') {                                                          // chandeliers over the carpet
      for (let y = y0 + 20; y < y1; y += 52) {
        const cx = FX(stX(sd, z.a + 22)), cy = FY(y);
        c.fillStyle = 'rgba(255,230,160,.12)'; c.fillRect(cx - 10, cy - 10, 20, 20); c.fillRect(cx - 14, cy - 4, 28, 8);
        c.fillStyle = '#c9a050'; c.fillRect(cx - 5, cy, 11, 1); c.fillRect(cx, cy - 4, 1, 4);
        c.fillStyle = '#fff3c4'; for (const k of [-5, -2, 2, 5]) c.fillRect(cx + k, cy + 1, 1, 2);
        c.fillStyle = '#ffffff'; c.fillRect(cx, cy + 2, 1, 2);
      }
    }
    // concession stands
    for (const st of z.stands) {
      const T = st.T, col = T.team ? H0.main : T.c, acc = T.team ? H0.trim : T.a;
      // scalloped awning edge
      for (let y = st.y0; y < st.y0 + st.h; y += 1.34) RD(z.b - 21.67, z.b - 21, y, y + 0.67, ((y - st.y0) / 1.34 | 0) & 1 ? acc : shade(col, -0.2));
      // counter top highlight with cups and wrapped snacks
      RD(z.b - 22, z.b - 21.33, st.y0, st.y0 + st.h, '#f4f4f4');
      for (let i = 0; i < 6; i++) RD(z.b - 22, z.b - 21.33, st.y0 + 2 + i * 4, st.y0 + 3.3 + i * 4, i % 2 ? (T.item || acc) : '#ffffff');
      // menu board on the back wall: title strip and price lines
      RD(z.b - 7.33, z.b - 4.67, st.y0 + 3, st.y0 + st.h - 3, '#11131c');
      RD(z.b - 7.33, z.b - 4.67, st.y0 + 3, st.y0 + 4, col);
      for (let y = st.y0 + 5.3; y < st.y0 + st.h - 4; y += 2) RD(z.b - 6.67, z.b - 5.33, y, y + 0.67, y % 4 < 2 ? '#e8e8e8' : '#ffd23f');
      // a warm light inside the booth
      const bx = FX(stX(sd, z.b - 13)), by = FY(st.y0 + st.h / 2); c.fillStyle = 'rgba(255,220,150,.10)'; c.fillRect(bx - 8, by - 12, 16, 24);
    }
    for (const o of z.deco) {
      if (o.kind === 'wc') { RD(z.b - 9, z.b - 8.33, o.y + 7, o.y + 9, '#c9d4e8'); RD(z.b - 6, z.b - 5.33, o.y + 7, o.y + 9, '#c9d4e8'); }    // door handles
      else if (o.kind === 'bin') { const dd = o.off ? z.a + 4 : z.b - 9; RD(dd + 0.67, dd + 2.33, o.y + 1.33, o.y + 2, '#2a2e3a'); }
    }
  }
  c.restore();
}
// a crowd frame for one side: static art + seated fans (same sprites and frames as the stands around the rink)
function stadFrame(side, f) {
  if (side.frames[f]) return side.frames[f];
  const g = STAD.g, cv = mkCanvas(Math.round(side.iw * CROWD_FINE), Math.round(side.ih * CROWD_FINE)), c = cv.getContext('2d');
  c.imageSmoothingEnabled = false; c.drawImage(side.stat, 0, 0, cv.width, cv.height);
  stadFineDetail(c, side, arenaCfg());
  c.setTransform(CROWD_FINE, 0, 0, CROWD_FINE, -side.ix0 * CROWD_FINE, -side.iy0 * CROWD_FINE);
  const VN = g.VN, vz = new Map();
  const vnFor = z => { if (!z || !z.tint) return VN; if (!vz.has(z)) vz.set(z, Object.assign({}, VN, { back: shade(VN.back, z.tint) })); return vz.get(z); };
  fanSignsLater = true;
  try { for (const st of side.straddle) drawFanSprite(c, st, f, VN); for (const st of side.seats) drawFanSprite(c, st, f, vnFor(st.z)); } finally { fanSignsLater = false; }
  drawFanSigns(c, side.straddle, f); drawFanSigns(c, side.seats, f);
  stadTint(c, side.ix0, side.iy0, side.iw, side.ih);
  side.frames[f] = cv;
  return cv;
}
function stadTint(c, x, y, w, h) {
  const lt = arenaCfg().lighting;
  if (lt === 'dim' || lt === 'bright') { c.save(); c.globalCompositeOperation = 'source-atop'; c.fillStyle = lt === 'dim' ? 'rgba(0,0,0,.28)' : 'rgba(255,255,255,.06)'; c.fillRect(x, y, w, h); c.restore(); }
}
// build the remaining crowd frames in the background so a goal never stalls
function stadPrebuild() {
  if (STAD.pre) return;
  STAD.pre = setTimeout(function step() {
    STAD.pre = null;
    for (const sd of ['L', 'R']) { const s = STAD.sides[sd]; if (!s) continue; for (let f = 0; f < 8; f++) if (!s.frames[f]) { stadFrame(s, f); STAD.pre = setTimeout(step, 30); return; } }
  }, 60);
}

// ---------- people
function stadPlanTrip(w) {
  const sd = w.side, side = STAD.sides[sd]; if (!side) return false;
  const seatD = w.st ? stD(sd, w.st.x + 6) : w.d;
  let zi = side.zones.findIndex(z => z.type === 'seats' && seatD >= z.a - 1 && seatD <= z.b); if (zi < 0) zi = 0;
  const z = side.zones[zi], inner = zi > 0 ? side.zones[zi - 1] : null, outer = side.zones[zi + 1];
  const conc = !inner || Math.abs(seatD - outer.a) < Math.abs(seatD - inner.b) || Math.random() < 0.3 ? outer : inner;
  if (!conc || !conc.stands.length) return false;
  const aisle = z.aisles.slice().sort((a, b) => Math.abs(a - seatD) - Math.abs(b - seatD))[0];
  const y0 = w.st.y + ROW_FEET, wy = side.walkways.slice().sort((a, b) => Math.abs(a - y0) - Math.abs(b - y0))[0];
  const stand = conc.stands.slice().sort((a, b) => Math.abs(a.qy - wy) - Math.abs(b.qy - wy))[(Math.random() * Math.min(3, conc.stands.length)) | 0];
  const lane = conc.a + 12 + Math.random() * 8;
  w.path = [[aisle, y0], [aisle, wy], [lane, wy], [lane, stand.qy]]; w.stand = stand; w.back = [[lane, stand.qy], [lane, wy], [aisle, wy], [aisle, y0], [seatD, y0]];
  return true;
}
function stadTickPeople() {
  const g = STAD.g; if (!g) return;
  const cheer = S.cheer > 0;
  for (const w of STAD.walkers) {
    if (!STAD.sides[w.side]) continue;
    w.moving = false;
    if (w.kind === 'fan') {
      if (w.state === 'seat') { if (!cheer && --w.t <= 0) { if (stadPlanTrip(w)) { w.state = 'go'; w.d = stD(w.side, w.st.x + 6); w.y = w.st.y + ROW_FEET; } else w.t = 400; } continue; }
      if (w.state === 'queue') {
        const s = w.stand, i = s.queue.indexOf(w); if (i < 0) { w.state = 'back'; w.path = w.back; continue; }
        const tq = s.qd[Math.min(i, s.qd.length - 1)]; stadStep(w, tq, s.qy + (i >= s.qd.length ? 6 : 0), 0.6);
        if (i === 0 && Math.abs(w.d - tq) < 1) { if (++s.serve > 40 + (w.ph * 10)) { s.serve = 0; s.queue.shift(); w.item = s.T.team ? stHome().main : s.T.item; w.state = 'back'; w.path = w.back.slice(); } }
        continue;
      }
      if (cheer && w.state !== 'queue') { w.hop = (S.t >> 3) & 1; continue; }
      w.hop = 0;
      if (!w.path.length) {
        if (w.state === 'go') { w.stand.queue.push(w); w.state = 'queue'; }
        else { w.state = 'seat'; w.item = null; w.t = 600 + Math.random() * 1600; }
        continue;
      }
      const [td, ty] = w.path[0]; if (stadStep(w, td, ty, 0.9)) w.path.shift();
    } else if (w.kind === 'stroll') {
      if (!w.path.length) w.path = [[w.lane + (Math.random() * 10 - 5), w.y < g.SH / 2 ? g.SH + ST_B - 6 : -ST_T + 6]];
      if (stadStep(w, w.path[0][0], w.path[0][1], 0.7)) w.path.shift();
    } else if (w.kind === 'hawk') {
      if (w.wait > 0) { w.wait--; continue; }
      if (!w.path.length) w.path = [[w.d, w.y < g.SH / 2 ? g.SH - 14 - Math.random() * 60 : 10 + Math.random() * 60]];
      if (stadStep(w, w.path[0][0], w.path[0][1], 0.5)) { w.path.shift(); w.wait = 40 + Math.random() * 80; }
      if (Math.random() < 0.006) stadShout(w, w.call);
    } else if (w.kind === 'top') {
      const side = STAD.sides[w.side];
      if (!w.path.length) w.path = [[w.d < side.E / 2 ? Math.min(side.E - 10, 260 + Math.random() * 80) : 6 + Math.random() * 30, w.y]];
      if (stadStep(w, w.path[0][0], w.path[0][1], 0.75)) w.path.shift();
    }
  }
}
function stadStep(w, td, ty, sp) {
  const dd = td - w.d, dy = ty - w.y, dist = Math.hypot(dd, dy);
  if (dist <= sp) { w.d = td; w.y = ty; return true; }
  // walk along one axis at a time (rows, aisles and walkways are straight)
  if (Math.abs(dd) > 0.5) { w.d += Math.sign(dd) * Math.min(sp, Math.abs(dd)); w.dir = 0; }
  else { w.y += Math.sign(dy) * Math.min(sp, Math.abs(dy)); w.dir = dy < 0 ? -1 : 1; }
  w.moving = true; w.step = (w.step || 0) + 1;
  return false;
}
function stadShout(w, txt) {
  if (typeof CV === 'undefined' || CV.bubbles.length > 8 || !STAD.view[w.side]) return;
  const v = STAD.view[w.side], x = stX(w.side, w.d);
  if (x < v.x0 + 16 || x > v.x1 - 16 || w.y < v.y0 + 20 || w.y > v.y1 - 4) return;
  if (CV.bubbles.some(o => o.where === w.side && Math.abs(o.x - x) < 70 && Math.abs(o.y - w.y) < 30)) return;
  CV.bubbles.push({ txt, team: S.match ? S.match.home ?? 0 : 0, where: w.side, x, y: w.y - 11, life: 90, max: 90 });
}
// a person on their feet, drawn on the fine crowd grid (feet at x, y; about 9 x 17 fine px)
function stadDrawPerson(c, w) {
  const x = Math.round(stX(w.side, w.d)), y = Math.round(w.y) - (w.hop ? 1 : 0), back = w.dir === -1, st = ((w.step || 0) >> 3) & 1, mv = w.moving;
  fanBegin(c, x, y);
  try {
    // a standing person at the players' scale (about 26 fine pixels tall): shoes, legs, a shirt with shading,
    // swinging arms, a face (or the back of the head), hair; vendors wear a red cap and carry a snack tray
    const sh = shade(w.c, -0.24), shL = shade(w.c, 0.15), sk = w.s, skD = shade(w.s, -0.18), pants = w.kind === 'hawk' ? '#2a2f3e' : '#33384a', pantsD = shade(pants, -0.25);
    c.fillStyle = 'rgba(10,14,30,.3)'; c.fillRect(-7, -1, 14, 2); c.fillRect(-5, 1, 10, 1);
    const l1 = mv && st ? 2 : 0, l2 = mv && !st ? 2 : 0;
    c.fillStyle = pants; c.fillRect(-4, -9 + l1, 4, 8 - l1); c.fillRect(1, -9 + l2, 4, 8 - l2);
    c.fillStyle = pantsD; c.fillRect(-1, -9, 1, 7); c.fillRect(4, -9 + l2, 1, 8 - l2);
    c.fillStyle = '#16181f'; c.fillRect(-5 - (mv && st ? 1 : 0), -1, 5, 1); c.fillRect(1 + (mv && !st ? 1 : 0), -1, 5, 1);
    c.fillStyle = '#3a3d4a'; c.fillRect(-5 - (mv && st ? 1 : 0), -2, 2, 1); c.fillRect(4 + (mv && !st ? 1 : 0), -2, 2, 1);
    // torso
    c.fillStyle = w.c; c.fillRect(-5, -18, 10, 9); c.fillRect(-4, -19, 8, 1);
    c.fillStyle = sh; c.fillRect(4, -17, 1, 8); c.fillRect(-1, -19, 2, 1); c.fillRect(-5, -10, 10, 1);
    c.fillStyle = shL; c.fillRect(-4, -18, 2, 1);
    c.fillStyle = shade(pants, -0.4); c.fillRect(-5, -9, 10, 1);                                               // belt
    const a1 = mv ? (st ? -2 : 2) : 0;
    c.fillStyle = w.c; c.fillRect(-7, -17 + a1, 2, 6); c.fillRect(5, -17 - a1, 2, 6);
    c.fillStyle = sh; c.fillRect(-7, -12 + a1, 2, 1); c.fillRect(6, -17 - a1, 1, 6);
    c.fillStyle = sk; c.fillRect(-7, -11 + a1, 2, 2); c.fillRect(5, -11 - a1, 2, 2);
    // head
    c.fillStyle = skD; c.fillRect(-1, -20, 3, 1);
    c.fillStyle = sk; c.fillRect(-3, -27, 7, 7); c.fillStyle = skD; c.fillRect(3, -26, 1, 6); c.fillRect(-2, -21, 5, 1);
    c.fillStyle = w.h; c.fillRect(-3, -28, 7, 2); c.fillRect(-4, -27, 1, 3); c.fillRect(4, -27, 1, 2);
    if (back) c.fillRect(-3, -26, 7, 5);
    else {
      c.fillRect(-3, -26, 2, 1);
      c.fillStyle = '#1a1a24'; c.fillRect(-2, -24, 1, 1); c.fillRect(1, -24, 1, 1);
      c.fillStyle = '#ffffff'; c.fillRect(-3, -24, 1, 1); c.fillRect(2, -24, 1, 1);
      c.fillStyle = skD; c.fillRect(0, -23, 1, 1); c.fillStyle = shade(sk, -0.35); c.fillRect(-1, -22, 3, 1);
    }
    if (w.kind === 'hawk') {                                                       // vendor: red cap and a tray of snacks
      c.fillStyle = '#c0392b'; c.fillRect(-3, -29, 7, 3); c.fillRect(-4, -27, 9, 1); c.fillRect(back ? -4 : 0, -26, 5, 1);
      c.fillStyle = '#8a5a2b'; c.fillRect(-8, -17, 16, 3); c.fillStyle = '#b07a3b'; c.fillRect(-8, -17, 16, 1);
      c.fillStyle = w.tray; c.fillRect(-7, -20, 3, 3); c.fillRect(-1, -20, 3, 3); c.fillRect(5, -20, 3, 3);
      c.fillStyle = '#ffffff'; c.fillRect(-7, -20, 3, 1); c.fillRect(-1, -20, 3, 1); c.fillRect(5, -20, 3, 1);
    }
    if (w.item) { c.fillStyle = '#ffffff'; c.fillRect(5, -13 - a1, 3, 4); c.fillStyle = w.item; c.fillRect(5, -14 - a1, 3, 1); c.fillStyle = '#e0e4ec'; c.fillRect(7, -12 - a1, 1, 3); }   // a drink or snack in hand
  } finally { c.restore(); }
}
// a seated fan standing up to let someone past: his seat (now empty) over the crowd picture, and him on his feet in
// front of it, pressed back against the seat, feet on the floor strip
function stadDrawStander(c, w, VN) {
  const st = w.st;
  fanBegin(c, st.x, st.y);
  try { c.fillStyle = VN.floor; c.fillRect(0, 0, 18, 21); drawFanFine(c, Object.assign({}, st, { empty: true }), 0, VN, false); } finally { c.restore(); }
  stadDrawPerson(c, { kind: 'fan', side: w.side, d: stD(w.side, st.x + 9), y: w.y, c: st.c, s: st.s, h: st.hat ? st.hatC : st.h, dir: st.back ? -1 : 0, moving: false, item: null });
}
// fans whose seat is in view: seated ones are drawn with the crowd sprite, the rest on their feet
function stadDrawPeople(c, sd, x0, y0, x1, y1) {
  const list = STAD.walkers.filter(w => {
    if (w.kind === 'fan' && w.state === 'seat') return w.st.x + 14 > x0 && w.st.x - 2 < x1 && w.st.y + 16 > y0 && w.st.y - 14 < y1;
    if (!STAD.sides[w.side]) return false;
    const x = stX(w.side, w.d); return x > x0 - 8 && x < x1 + 8 && w.y > y0 - 2 && w.y < y1 + 14;
  });
  // fans walking along their row: everyone they pass gets up to let them by (and sits back down once they're past)
  const up = STAD.up || (STAD.up = new Map()), now = S.t || 0;
  for (const w of STAD.walkers) {
    if (w.kind !== 'fan' || (w.state !== 'go' && w.state !== 'back') || Math.abs(w.y - (w.st.y + ROW_FEET)) > 0.6 || !w.moving) continue;
    const wx = stX(w.side, w.d), pool = w.st.z ? (STAD.sides[w.side] || {}).seats || [] : STAD.g.seats;
    for (const s of pool) if (s !== w.st && s.y === w.st.y && !s.empty && !s.dyn && Math.abs(s.x + 9 - wx) < STAND_NEAR) up.set(s, { t: now, side: w.side });
  }
  for (const [s, u] of up) {
    if (now - u.t > STAND_HOLD || now < u.t) { up.delete(s); continue; }
    if (s.x + 14 > x0 && s.x - 2 < x1 && s.y + 16 > y0 && s.y - 14 < y1) list.push({ kind: 'stander', st: s, side: u.side, y: s.y + STAND_FEET });
  }
  list.sort((a, b) => (a.state === 'seat' ? a.st.y + 13 : a.y) - (b.state === 'seat' ? b.st.y + 13 : b.y));
  const VN = STAD.g.VN;
  for (const w of list) {
    const vn = w.st && w.st.z && w.st.z.tint ? Object.assign({}, VN, { back: shade(VN.back, w.st.z.tint) }) : VN;
    if (w.kind === 'fan' && w.state === 'seat') drawFanSprite(c, w.st, S.crowdF || 0, vn, true);
    else if (w.kind === 'stander') stadDrawStander(c, w, vn);
    else stadDrawPerson(c, w);
  }
}

// ---------- light show / confetti across the whole building (drawn identically on the rink view and the sides)
function stadFx(c, x0, y0, x1, y1, clipRink) {
  const cfg = arenaCfg(), goal = S.phase === 'goal', t = S.t, g = STAD.g; if (!g) return;
  const show = cfg.lighting === 'disco' || goal, conf = goal && (cfg.deco === 'confetti' || cfg.deco === 'fireworks');
  if (!show && !conf) return;
  c.save();
  if (clipRink) { c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.rect((R.r + 6) / SS, (R.t - 22) / SS, -(R.r - R.l + 12) / SS, (R.b - R.t + 38) / SS); c.clip('evenodd'); }
  if (show) {
    c.globalCompositeOperation = 'lighter';
    const cols = ['rgba(255,80,80,.16)', 'rgba(80,160,255,.16)', 'rgba(255,210,63,.14)', 'rgba(120,255,140,.12)'];
    for (let k = 0; k < 6; k++) {
      const cx = g.SW / 2 + Math.sin(t * 0.011 + k * 1.7) * (g.SW * 0.5 + 220), cy = g.SH / 2 + Math.cos(t * 0.009 + k * 2.3) * g.SH * 0.45;
      if (cx < x0 - 50 || cx > x1 + 50 || cy < y0 - 50 || cy > y1 + 50) continue;
      const gr = c.createRadialGradient(cx, cy, 0, cx, cy, 46); gr.addColorStop(0, cols[(k + (t >> 6)) % 4]); gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gr; c.fillRect(cx - 46, cy - 46, 92, 92);
    }
    c.globalCompositeOperation = 'source-over';
  }
  if (conf) {
    const span = g.SW + 1400;
    for (let k = 0; k < 700; k++) {
      const x = ((k * 97.13) % span) - 700 + Math.sin(t * 0.03 + k) * 4, y = ((k * 53.7 + t * (0.6 + (k % 5) * 0.12)) % (g.SH + 80)) - 40;
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      c.fillStyle = ['#ff4a3d', '#ffd23f', '#5ee07a', '#7ec8ff', '#ffffff'][k % 5]; c.fillRect(x | 0, y | 0, 1, 1);
    }
  }
  c.restore();
}

// ---------- on the rink view (world transform), right after the crowd image: the fans who get up from those stands
function stadDrawWorld(cf) {
  if (!STAD.g || !ctx) return;
  ctx.save(); toWorld(); ctx.scale(SS, SS);
  const x0 = camX / SS, y0 = camY / SS;
  stadDrawPeople(ctx, null, x0, y0, x0 + viewW() / SS, y0 + viewH() / SS);
  stadFx(ctx, x0, y0, x0 + viewW() / SS, y0 + viewH() / SS, true);
  ctx.restore();
}

// ---------- the two side canvases: placed so their pixels sit exactly on the rink view's sprite grid
function fitScene() {
  const on = (S.screen === 'play' || S.screen === 'paused' || S.screen === 'intermission' || S.screen === 'replay' || S.screen === 'outro') && !(S.pres && S.pres.arena === false);
  SCN.L = sceneCanvas('sceneL'); SCN.R = sceneCanvas('sceneR');
  if (!on) { SCN.L.style.display = SCN.R.style.display = 'none'; document.body.classList.remove('stad'); STAD.view.L = STAD.view.R = null; return; }
  document.body.classList.add('stad');
  stadPlace(true);
}
function stadPlace(force) {
  const r = cvs.getBoundingClientRect(); if (!r.width) return false;
  // the main canvas draws sprite pixel sx at canvas px sx * 3 + camOffX() (whole canvas pixels), then CSS scales it
  const cs = r.width / cvs.width, sp = 3 * cs, ox = camOffX(), oy = camOff();
  const fromSX = sx => r.left + (sx * 3 + ox) * cs, fromSY = sy => r.top + (sy * 3 + oy) * cs;
  const toSX = px => ((px - r.left) / cs - ox) / 3, toSY = py => ((py - r.top) / cs - oy) / 3;
  let redraw = false;
  for (const sd of ['L', 'R']) {
    const c = SCN[sd]; if (!c) continue;
    const vx0 = sd === 'L' ? toSX(0) : toSX(r.right), vx1 = sd === 'L' ? toSX(r.left) : toSX(innerWidth), vy0 = toSY(0), vy1 = toSY(innerHeight);
    if (vx1 - vx0 < 2) { c.style.display = 'none'; STAD.view[sd] = null; continue; }
    STAD.view[sd] = { x0: vx0, x1: vx1, y0: vy0, y1: vy1 };
    let p = STAD.cv[sd];
    if (!p || p.ox > vx0 || p.ox + p.w < vx1 || p.oy > vy0 || p.oy + p.h < vy1 || p.sp !== sp) {
      p = STAD.cv[sd] = { ox: Math.floor(vx0) - ST_M, oy: Math.floor(vy0) - ST_M, w: Math.ceil(vx1 - vx0) + ST_M * 2, h: Math.ceil(vy1 - vy0) + ST_M * 2, sp };
      if (c.width !== p.w * SIDE_RES || c.height !== p.h * SIDE_RES) { c.width = p.w * SIDE_RES; c.height = p.h * SIDE_RES; }
      STAD.dirty = true;                                    // resizing clears a canvas: it must be drawn again this same frame
      c.style.width = (p.w * sp) + 'px'; c.style.height = (p.h * sp) + 'px';
      redraw = true;
    }
    c.style.display = 'block';
    // exactly where the rink view would draw that sprite column: same grid, same whole-pixel steps, no judder
    const L0 = fromSX(p.ox) + 'px', T0 = fromSY(p.oy) + 'px';
    if (c.style.left !== L0) c.style.left = L0; if (c.style.top !== T0) c.style.top = T0;
  }
  return redraw;
}
function drawScene() {
  if (!SCN.L || !STAD.g) return;
  SCN.t++;
  const visible = SCN.L.style.display !== 'none' || SCN.R.style.display !== 'none';
  const moved = document.body.classList.contains('stad') && stadPlace(false);
  if (SCN.t % 2 && !moved && !STAD.dirty) return;     // 30 fps for the building and its people (at once if a panel was just cleared)
  STAD.dirty = false;
  STAD.t++;
  // make sure each side is built out far enough
  for (const sd of ['L', 'R']) {
    const p = STAD.cv[sd], need = p && STAD.view[sd] ? Math.ceil(sd === 'L' ? -p.ox : p.ox + p.w - STAD.g.SW) + 8 : 0;
    if (!STAD.sides[sd] || STAD.sides[sd].E < need) { stadSide(sd, Math.max(260, Math.ceil(need / 64) * 64)); stadPrebuild(); }
  }
  stadTickPeople();
  if (!visible) return;
  for (const sd of ['L', 'R']) if (SCN[sd].style.display !== 'none' && STAD.view[sd]) stadDrawSide(sd);
}
const SIDE_RES = 3;
function stadDrawSide(sd) {
  const cv = SCN[sd], c = cv.getContext('2d'), p = STAD.cv[sd], side = STAD.sides[sd], g = STAD.g, cfg = arenaCfg();
  c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false;
  c.fillStyle = g.VN.bg; c.fillRect(0, 0, cv.width, cv.height);
  c.setTransform(SIDE_RES, 0, 0, SIDE_RES, -p.ox * SIDE_RES, -p.oy * SIDE_RES);     // sprite units, 3 canvas px each so the fans' fine pixels stay sharp
  const x1 = p.ox + p.w, y1 = p.oy + p.h;
  // the world itself (only visible here with the closer cameras), then the extension
  c.drawImage(stadFrame(side, S.crowdF || 0), side.ix0, side.iy0, side.iw, side.ih);
  if (x1 > 0 && p.ox < W / SS) { if (rinkImg) c.drawImage(rinkImg, 0, 0, W / SS, H / SS); if (crowdImgs) { const ci = crowdImgs[S.crowdF || 0] || crowdImgs[0]; c.drawImage(ci, 0, 0, ci.width / CROWD_FINE, ci.height / CROWD_FINE); }
    // the live ice layers the rink view has too (skate marks, live boards, goal lamps), so nothing changes at the seam
    if (typeof drawWorldOn === 'function') { drawWorldOn(c, p.ox * SS, p.oy * SS, SIDE_RES / SS, () => { toWorld(); if (typeof marksCvs !== 'undefined' && marksCvs) ctx.drawImage(marksCvs, 0, 0, W, H); if (typeof drawBoardsLive === 'function') drawBoardsLive(); if (typeof drawLamps === 'function') drawLamps(); }); c.setTransform(SIDE_RES, 0, 0, SIDE_RES, -p.ox * SIDE_RES, -p.oy * SIDE_RES); } }
  // live: steam over the grills, cooks behind the counters
  for (const z of side.zones) if (z.type === 'conc') for (const s of z.stands) {
    if (s.y0 + 30 < p.oy || s.y0 - 10 > y1) continue;
    const bob = ((STAD.t >> 3) + s.y0) % 6 < 3 ? 0 : 1, cd = z.b - 14 + bob, x = Math.round(stX(sd, cd)), y = s.y0 + 8 + ((STAD.t >> 5) + s.y0) % 10;
    c.fillStyle = '#f4f4f4'; c.fillRect(x - 2, y - 6, 4, 4); c.fillStyle = s.T.team ? stHome().main : s.T.c; c.fillRect(x - 2, y - 2, 4, 3); c.fillStyle = '#f4f4f4'; c.fillRect(x - 2, y - 7, 4, 1);
    if (s.T.steam) for (let k = 0; k < 3; k++) { const sy = s.y0 + 4 - ((STAD.t + k * 7) % 12), sx = Math.round(stX(sd, z.b - 9 - k * 3)) + (((STAD.t >> 2) + k) & 1); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(sx, sy, 1, 1); }
  }
  stadDrawPeople(c, sd, p.ox, p.oy, x1, y1);
  if (typeof drawBenchesOn === 'function' && sd === 'L' && x1 > 0 && p.ox < R.l / SS + 4) drawBenchesOn(c, p.ox * SS, p.oy * SS, SIDE_RES / SS, 'L');
  if (typeof drawBenchesOn === 'function' && sd === 'R' && x1 * SS > R.r - 40 && p.ox * SS < W) drawBenchesOn(c, p.ox * SS, p.oy * SS, SIDE_RES / SS, 'R');
  c.setTransform(SIDE_RES, 0, 0, SIDE_RES, -p.ox * SIDE_RES, -p.oy * SIDE_RES);
  if (typeof crowdFxSide === 'function') crowdFxSide(c, sd, p.ox, p.oy, x1, y1);
  if (typeof arenaLightsSide === 'function') arenaLightsSide(c, p.ox, p.oy, x1, y1);
  if (typeof crowdPhonesGlow === 'function' && typeof ALS !== 'undefined' && ALS.lvl > 0) crowdPhonesGlow(c);
  if (typeof drawBlimp === 'function') { c.save(); drawBlimp(c, p.ox * SS, p.oy * SS, SIDE_RES / SS); c.restore(); c.setTransform(SIDE_RES, 0, 0, SIDE_RES, -p.ox * SIDE_RES, -p.oy * SIDE_RES); }
  stadFx(c, p.ox, p.oy, x1, y1, false);
  // hanging boards: the Jumbotron (left), the score tower (right), banners
  const bx = sd === 'L' ? -186 : g.SW + 40;
  c.save(); c.translate(bx, -14); if (sd === 'L') drawBigBoard(c, 144, 0, cfg); else drawScoreTower(c, 70, 0); c.restore();
  c.save(); c.translate(sd === 'L' ? -380 : g.SW + 130, -25); drawBanners(c, 160, 0, sd, cfg); c.restore();
  if (typeof drawSideBubbles === 'function') drawSideBubbles(c, sd);
  if (typeof drawOverlaysOn === 'function' && (sd === 'L' ? x1 > 0 && p.ox < R.l / SS + 4 : x1 * SS > R.r - 40 && p.ox * SS < W)) drawOverlaysOn(c, p.ox * SS, p.oy * SS, SIDE_RES / SS, sd);
  const vk = SIDE_RES / SS; c.setTransform(vk, 0, 0, vk, 0, 0);
  if (typeof drawVenueFront === 'function') drawVenueFront(c, cv.width / vk, cv.height / vk, cfg);
  // outdoor snow: the same world-anchored flakes as the rink view
  if (typeof snowField === 'function' && venueOf(cfg).roof === 'sky') { c.setTransform(vk, 0, 0, vk, -p.ox * SIDE_RES, -p.oy * SIDE_RES); snowField(c, p.ox * SS, p.oy * SS, x1 * SS, y1 * SS); }
  c.setTransform(1, 0, 0, 1, 0, 0);
}
// a fan the camera can see on one side (for the crowd voice)
function stadPickFan(sd, away) {
  const side = STAD.sides[sd], v = STAD.view[sd]; if (!side || !v) return null;
  const cand = side.seats.filter(st => !st.empty && !st.dyn && st.away === away && st.x > v.x0 + 24 && st.x < v.x1 - 30 && st.y > v.y0 + 28 && st.y < v.y1 - 12);
  if (!cand.length) return null;
  const st = cand[(Math.random() * cand.length) | 0]; return { x: st.x + 6, y: st.y };
}
// arena screen preview: a crop of the building around its first concourse
function stadPreview(cv) {
  const g = STAD.g; if (!g) return;
  const side = stadSide('L', 420), conc = side.zones[1], c = cv.getContext('2d');
  const ox = -Math.round(conc.b + 8), oy = 70;
  c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false; c.fillStyle = g.VN.bg; c.fillRect(0, 0, cv.width, cv.height);
  c.setTransform(CROWD_FINE, 0, 0, CROWD_FINE, -ox * CROWD_FINE, -oy * CROWD_FINE);      // the preview canvas is at the fans' fine resolution
  c.drawImage(stadFrame(side, 0), side.ix0, side.iy0, side.iw, side.ih);
  if (ox + cv.width / CROWD_FINE > 0) { if (rinkImg) c.drawImage(rinkImg, 0, 0, W / SS, H / SS); if (crowdImgs) c.drawImage(crowdImgs[0], 0, 0, crowdImgs[0].width / CROWD_FINE, crowdImgs[0].height / CROWD_FINE); }
  STAD.t = 40; for (const w of STAD.walkers) if (w.side === 'L' && w.kind === 'fan' && w.state === 'seat') drawFanSprite(c, w.st, 0, g.VN, true);
  for (const w of STAD.walkers) if (w.side === 'L' && w.kind === 'stroll') stadDrawPerson(c, w);
  // fans' signs (arena option): two fans holding theirs up
  if (arenaCfg().signs !== false && typeof cfxFan === 'function' && typeof fanSignPick === 'function') {
    const vw = cv.width / CROWD_FINE, vh = cv.height / CROWD_FINE;
    const cand = side.seats.filter(st => !st.empty && !st.dyn && st.x > ox + 14 && st.x < ox + vw - 30 && st.y > oy + 46 && st.y < oy + vh - 60);
    [0.25, 0.7].forEach((k, i) => { const st = cand[Math.floor(cand.length * k)]; if (st) { try { cfxFan(c, st, g.VN, 'sign', { sg: fanSignPick(TEAM[0], 0, FAN_SIGN_KINDS[i ? 4 : 0]), sty: i, ph: 0.8, signScale: CFX_SIGN_SCALE }); } catch (e) {} } });
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
}
