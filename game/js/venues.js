'use strict';
// ====================================================================
//  VENUES: every club plays in its own kind of building (cosmetic only). The venue sets the architecture
//  beside the rink (roof, walls, lights, features like a night sky or a city skyline), the colours of the
//  stands around the ice, and the arena's name. Computer clubs each get a venue of their own, so road games
//  look different; your club starts in a Classic Arena and can buy two renovations for its home games.
// ====================================================================
const VENUES = {
  classic:  { name: 'Classic Arena',   suffix: 'Arena',          desc: 'Concrete concourses, steel pillars and a loud home crowd.',
    bg: '#0b0d1a', floor: '#1c2144', aisle: '#363f78', step: '#2a3266', back: '#2b3266', wall: ['#070914', '#10142a', '#191f3a'], seats: '#2a3150', roof: 'truss' },
  barn:     { name: 'Old Barn',        suffix: 'Memorial Barn',  desc: 'A creaky wooden barn: plank walkways and warm hanging bulbs.',
    bg: '#140d08', floor: '#3a2614', aisle: '#5a3c22', step: '#2c1c0e', back: '#6a4a2a', wall: ['#0d0805', '#22160c', '#2e1f12'], seats: '#5a3a1e', roof: 'beams' , fascia: { band: '#2a1a0c', rail: '#8a6a3a', led: '#5a3a1e', txt: ['#f4e4c0', '#e8c070'], still: true } },
  retro:    { name: 'Retro Coliseum',  suffix: 'Coliseum',       desc: 'Checkerboard concourses lit by neon tubes in arcade colours.',
    bg: '#12051c', floor: '#2a0f3a', aisle: '#4a1a66', step: '#3a1452', back: '#1fa8b8', wall: ['#0a0212', '#1e0830', '#2d0c44'], seats: '#6a1f5a', roof: 'neon' , fascia: { band: '#12051c', rail: '#ff3ea5', led: '#0a0212', txt: ['#ff3ea5', '#1fe0f0'] } },
  outdoor:  { name: 'Village Green',   suffix: 'Village Green',  desc: 'An outdoor pitch in winter: snowy paths, pine trees, string lights and falling snow.',
    bg: '#060a18', floor: '#c9d6e4', aisle: '#9fb0c6', step: '#b2c1d4', back: '#3a4a62', wall: ['#02040e', '#0a1430', '#1a2a50'], seats: '#4a5a72', roof: 'sky' , fascia: { band: '#e8eef6', rail: '#c9d6e4', led: '#7a5a3a', txt: ['#2a1a0c', '#3a2614'], still: true } },
  downtown: { name: 'Downtown Centre', suffix: 'Centre',         desc: 'A downtown pitch with glass outer walls and the city lights glowing outside.',
    bg: '#0a0c14', floor: '#22252e', aisle: '#3a3f4e', step: '#2b2f3a', back: '#40465a', wall: ['#05060c', '#141826', '#1d2232'], seats: '#3a3f52', roof: 'skyline' , fascia: { band: '#0e1220', rail: '#5a6680', led: '#05060a', txt: ['#ffffff', '#ffd890'] } },
  modern:   { name: 'Modern Dome',     suffix: 'Dome',           desc: 'Renovated: polished tile concourses, LED light strips and premium club seats.',
    bg: '#0c1018', floor: '#2a3040', aisle: '#5a6680', step: '#3a4256', back: '#9aa6bc', wall: ['#0a0e16', '#1a2232', '#2a3448'], seats: '#2c4a86', roof: 'halo' , fascia: { band: '#c8ced8', rail: '#e8ecf4', led: '#05060a', txt: ['#ffffff', '#7ec8ff'] } },
  palace:   { name: 'Grand Soccer Palace', suffix: 'Soccer Palace', desc: 'The ultimate pitch: red-carpet concourses with gold trim, marble pillars, chandeliers and red velvet seats.',
    bg: '#12060a', floor: '#3a0e16', aisle: '#8a6a1e', step: '#2a0a10', back: '#7a1424', wall: ['#0c0306', '#22080e', '#341018'], seats: '#7a1424', roof: 'arches' , fascia: { band: '#2a0a10', rail: '#c9a050', led: '#1a0408', txt: ['#ffe9a8', '#c9a050'] } },
};
// the enclosures beside the ice (team benches, the corridor between them, the penalty boxes, the officials' booth)
// in each building's own materials: walls, floor (and its pattern), the benches' frames, the booth, a trim line
const ENCL = {
  classic:  { wall: '#080a16', floor: '#2b3150', pat: 'mat',     frame: '#0b0e1e', hall: '#262b48', booth: '#3b3f58', trim: null },
  barn:     { wall: '#170d06', floor: '#5a3c22', pat: 'plank',   frame: '#2a1a0c', hall: '#4a3019', booth: '#6a4a2a', trim: '#8a6a3a' },
  retro:    { wall: '#0a0212', floor: '#2a0f3a', pat: 'checker', frame: '#12051c', hall: '#3a1452', booth: '#4a1a66', trim: '#ff3ea5' },
  outdoor:  { wall: '#3a2614', floor: '#6a4a2a', pat: 'plank',   frame: '#2a1a0c', hall: '#9fb0c6', booth: '#7a5a3a', trim: '#e8eef6' },
  downtown: { wall: '#05060c', floor: '#2b2f3a', pat: 'mat',     frame: '#0e1220', hall: '#22252e', booth: '#3a3f4e', trim: '#5a6680' },
  modern:   { wall: '#0a0e16', floor: '#3a4256', pat: 'tile',    frame: '#1a2232', hall: '#2a3040', booth: '#5a6680', trim: '#7ec8ff' },
  palace:   { wall: '#1a0408', floor: '#7a1424', pat: 'carpet',  frame: '#2a0a10', hall: '#3a0e16', booth: '#4a1018', trim: '#c9a050' },
};
const enclPal = () => ENCL[(typeof arenaCfg === 'function' && arenaCfg().venue) || 'classic'] || ENCL.classic;
// a floor in the building's style: rubber mat stripes, wooden planks, a checkerboard, tiles, or red carpet with gold edging
function drawEnclFloor(c, x, y, w, h, P = enclPal()) {
  c.fillStyle = P.floor; c.fillRect(x, y, w, h);
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  if (P.pat === 'mat') { c.fillStyle = 'rgba(255,255,255,.05)'; for (let yy = y + 3; yy < y + h; yy += 4) c.fillRect(x, yy, w, 1); }
  else if (P.pat === 'plank') {
    for (let yy = y, i = 0; yy < y + h; yy += 3, i++) {
      c.fillStyle = i % 2 ? 'rgba(0,0,0,.12)' : 'rgba(255,220,170,.05)'; c.fillRect(x, yy, w, 3);
      c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x, yy, w, 0.4);
      c.fillRect(x + ((i * 17) % Math.max(1, w)), yy, 0.4, 3);                          // board ends, staggered
    }
  } else if (P.pat === 'checker') { for (let yy = y, j = 0; yy < y + h; yy += 4, j++) for (let xx = x, i = 0; xx < x + w; xx += 4, i++) if ((i + j) % 2) { c.fillStyle = 'rgba(255,62,165,.16)'; c.fillRect(xx, yy, 4, 4); } }
  else if (P.pat === 'tile') { c.fillStyle = 'rgba(255,255,255,.08)'; for (let yy = y; yy < y + h; yy += 6) c.fillRect(x, yy, w, 0.4); for (let xx = x; xx < x + w; xx += 6) c.fillRect(xx, y, 0.4, h); }
  else if (P.pat === 'carpet') { c.fillStyle = 'rgba(0,0,0,.12)'; for (let yy = y + 1; yy < y + h; yy += 2) c.fillRect(x, yy, w, 0.5); c.strokeStyle = P.trim; c.lineWidth = 0.7; c.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3); }
  c.restore();
}
const AI_VENUES = ['classic', 'barn', 'retro', 'outdoor', 'downtown', 'modern'];
const venueOf = cfg => VENUES[(cfg && cfg.venue) || 'classic'] || VENUES.classic;
// computer clubs: a stable arena per club (venue, seats, lights, ads)
// each building's light show: the dome and the palace go big, the retro hall has its mirror ball, the barn keeps it simple
function venueShow(v, r = Math.random) { return v === 'palace' ? 'full' : v === 'modern' ? (r() < 0.5 ? 'projection' : 'lasers') : v === 'retro' ? 'mirror' : v === 'barn' || v === 'outdoor' ? 'standard' : r() < 0.6 ? 'standard' : r() < 0.5 ? 'lasers' : 'projection'; }
// each building's boards and glass: the barn and the outdoor rink are old-school, the dome and the palace have LED boards
function venueBoards(v, r = Math.random) { return v === 'barn' ? { boards: 'wood', glass: 'netting' } : v === 'outdoor' ? { boards: 'wood', glass: 'clear' } : v === 'retro' ? { boards: 'classic', glass: 'netting' } : v === 'palace' ? { boards: 'led', glass: 'tinted' } : v === 'modern' ? { boards: r() < 0.5 ? 'led' : 'black', glass: 'tinted' } : v === 'downtown' ? { boards: r() < 0.5 ? 'black' : 'classic', glass: 'clear' } : { boards: 'classic', glass: 'clear' }; }
function aiArena(t) {
  const hsh = hashId(String(t.id || t.nick || 'x')), r = mulberrySeed(hsh);
  r(); const venue = AI_VENUES[(r() * AI_VENUES.length) | 0];
  const pick = o => { const ks = Object.keys(o); return ks[(r() * ks.length) | 0]; };
  return Object.assign({}, ARENA_DEFAULT, {
    venue, seats: r() < 0.6 ? 'steel' : pick(ARENA_OPTS.seats), lighting: venue === 'retro' ? 'disco' : venue === 'barn' ? 'dim' : venue === 'modern' ? 'bright' : pick({ classic: 1, bright: 1, dim: 1 }),
    ads: pick(ARENA_OPTS.ads), deco: r() < 0.5 ? 'none' : pick({ streamers: 1, flags: 1, confetti: 1 }), horn: pick(ARENA_OPTS.horn), banners: 'champions',
    show: venueShow(venue, r), ...venueBoards(venue, r),
  });
}
const arenaTitle = (t, cfg) => ((t && t.city ? t.city + ' ' : '') + venueOf(cfg).suffix).toUpperCase();

// in front of the crowd: falling snow outdoors, neon glow on the fascia
function drawVenueFront(c, w, h, cfg) {
  const v = venueOf(cfg), t = SCN.t;
  // (outdoor snow is drawn by snowField in world space, on the rink view and the stands canvases alike, so it lines up)
}
// over the rink (world space): snowfall at the outdoor venue
function drawVenueWorld() {
  if (!S.match || !S.match.arena || venueOf(S.match.arena).roof !== 'sky') return;
  ctx.save(); toWorld(); ctx.fillStyle = 'rgba(255,255,255,.85)';
  snowField(ctx, camX, camY, camX + viewW(), camY + viewH());
  ctx.restore();
}
// one snowfall anchored to the world (tiles of flakes, same pattern everywhere), so the rink view and the stands
// canvases beside it show the very same flakes, at the same size, with no seam where they meet
const SNOW_TILE = 160, SNOW_N = 26;
const snowHash = (a, b, i, k) => { let h = (a * 374761393 + b * 668265263 + i * 2246822519 + k * 3266489917) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function snowField(c, x0, y0, x1, y1) {
  const t = S.t; c.fillStyle = 'rgba(255,255,255,.85)';
  for (let ty = Math.floor(y0 / SNOW_TILE) - 1; ty <= Math.floor(y1 / SNOW_TILE); ty++) for (let tx = Math.floor(x0 / SNOW_TILE); tx <= Math.floor(x1 / SNOW_TILE); tx++)
    for (let i = 0; i < SNOW_N; i++) {
      const sp = 0.5 + (i % 4) * 0.18, x = tx * SNOW_TILE + snowHash(tx, ty, i, 1) * SNOW_TILE + Math.sin(t * 0.015 + i + tx) * 7;
      const y = ty * SNOW_TILE + ((snowHash(tx, ty, i, 2) * SNOW_TILE * 2 + t * sp) % (SNOW_TILE * 2));      // falls through its tile and the one below
      if (x < x0 - 2 || x > x1 + 2 || y < y0 - 2 || y > y1 + 2) continue;
      const s = i % 5 ? 1.2 : 2; c.fillRect(x, y, s, s);
    }
}
