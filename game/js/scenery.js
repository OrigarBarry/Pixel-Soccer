'use strict';
// ====================================================================
//  ARENA SCENERY: the space beside the rink becomes the arena — upper decks with an animated crowd,
//  railings, LED ribbon ads, banners in the rafters, lighting, decorations, and a Jumbotron that plays
//  real replay footage (miniature pixel-art) of goals, saves, hits and fights.
//  Drawn on two low-resolution side canvases (1 canvas px = 1 sprite px), scaled with CSS, so the rink
//  is never distorted and fullscreen / any aspect ratio is filled.
//  Arena customization (logo, ads, seats, crowd, lighting, banners, signs, decorations) comes from S.match.arena.
// ====================================================================
const ARENA_DEFAULT = { venue: 'classic', logo: 'emblem', ads: 'classic', seats: 'steel', crowd: 'home', lighting: 'classic', banners: 'champions', signs: true, deco: 'none', horn: 'classic', text: '', show: 'standard', boards: 'classic', glass: 'clear' };
const ARENA_OPTS = {
  venue:    { classic: 'Classic Arena', modern: 'Modern Dome', palace: 'Grand Soccer Palace' },
  logo:     { emblem: 'Team emblem', wordmark: 'Team wordmark', classic: 'Classic centre circle', crest: 'Crest + stripes' },
  ads:      { classic: 'Classic sponsors', retro: 'Retro arcade', local: 'Local businesses', team: 'Team slogans', premium: 'Premium sponsors', charity: 'Charity night' },
  boards:   { classic: 'Steel frame', wood: 'Vintage wood', black: 'All black', led: 'Digital LED' },
  glass:    { clear: 'White nets', tinted: 'Black nets', netting: 'Gold nets' },
  seats:    { steel: 'Steel blue', red: 'Arena red', team: 'Team colours', black: 'Blackout', gold: 'Gold' },
  crowd:    { home: 'Home colours', mixed: 'Mixed', whiteout: 'Whiteout', blackout: 'Blackout', gold: 'Gold rush' },
  lighting: { classic: 'Classic floods', bright: 'Bright TV lights', dim: 'Dramatic dim', disco: 'Light show' },
  show:     { standard: 'Standard show', lasers: 'Laser show', projection: 'Pitch projection', mirror: 'Mirror ball', pyro: 'Pyro & CO2', aurora: 'Northern lights', storm: 'Lightning storm', search: 'Searchlights', full: 'The Works' },
  banners:  { champions: 'Championship banners', retired: 'Retired numbers', flags: 'League flags', none: 'None' },
  deco:     { none: 'None', streamers: 'Streamers', flags: 'Fan flags', fireworks: 'Goal fireworks', confetti: 'Confetti' },
  horn:     { classic: 'Drums & band', deep: 'Big bass drum', train: 'Drum roll', siren: 'Drums & whistles', triple: 'Da-da-da chant', rising: 'Rising fanfare' },
};
const AD_SETS = {
  classic: ['PIXEL COLA', 'PITCH KING', 'NORTH AIR', 'STUDS CO', 'MAPLE BANK', 'POWER SHOT TV'],
  retro: ['INSERT COIN', 'HI SCORE', '8 BIT FM', 'TURBO GUM', 'PRESS START', 'CARTRIDGE'],
  local: ['JOES DINER', 'RINKSIDE PIZZA', 'FRIDGE CITY', 'RUN SHACK', 'AL S GARAGE', 'CORNER CAFE'],
  team: ['GO {N}', '{N} SOCCER', 'WE ARE {A}', 'LOUD HOUSE', 'DEFEND THE PITCH', '{A} FOREVER'],
  premium: ['AURORA WATCH', 'GRAND MOTORS', 'NORTHSTAR AIR', 'SUMMIT BANK', 'PLATINUM', 'VELOCITY'],
  charity: ['KIDS ON THE PITCH', 'FOOD BANK', 'RUN FOR A CURE', 'GOOD SPORTS', 'GIVE BLOOD', 'COAT DRIVE'],
};
// ---------- RINK-BOARD SPONSORS (art audit, Nov 22): every sponsor has its own colours, a 7x7 pixel icon and a short
// mark for the narrow rails. Drawn with the blocky pText font one pixel per world unit, so it stays sharp on screen.
// [background, lettering, accent/icon, icon, short mark]
const AD_BRANDS = {
  'PIXEL COLA': ['#b8262b', '#ffffff', '#ffd23f', 'bottle', 'COLA'], 'PITCH KING': ['#1b3a8a', '#ffffff', '#7ec8ff', 'crown', 'KING'],
  'NORTH AIR': ['#0e5a6a', '#ffffff', '#ffd23f', 'plane', 'N AIR'], 'STUDS CO': ['#1c1c22', '#ffd23f', '#ffffff', 'skate', 'STUDS'],
  'MAPLE BANK': ['#2a6a3a', '#ffffff', '#ff6a4a', 'leaf', 'MAPLE'], 'POWER SHOT TV': ['#3a1a5a', '#ffffff', '#ff3ea5', 'tv', 'STV'],
  'INSERT COIN': ['#1a0a2e', '#ffd23f', '#ff4fd8', 'coin', 'COIN'], 'HI SCORE': ['#05060d', '#5ee07a', '#ffd23f', 'star', 'HI'],
  '8 BIT FM': ['#102a6b', '#7ec8ff', '#ff4fd8', 'note', '8 BIT'], 'TURBO GUM': ['#ff4fd8', '#1a0a2e', '#ffffff', 'bubble', 'GUM'],
  'PRESS START': ['#2b0a3d', '#ffffff', '#5ee07a', 'play', 'START'], 'CARTRIDGE': ['#3a3a44', '#ffffff', '#ff4a3d', 'cart', 'CART'],
  'JOES DINER': ['#c0392b', '#ffffff', '#f1e3b5', 'cup', 'JOES'], 'RINKSIDE PIZZA': ['#d9701f', '#ffffff', '#ffd23f', 'pizza', 'PIZZA'],
  'FRIDGE CITY': ['#e8eef7', '#1b3a8a', '#3a7ad7', 'fridge', 'FRIDGE'], 'RUN SHACK': ['#6b4423', '#f1e3b5', '#ffd23f', 'skate', 'SHACK'],
  'AL S GARAGE': ['#2f5d3a', '#ffffff', '#ffd23f', 'wrench', 'GARAGE'], 'CORNER CAFE': ['#4a2c1a', '#ffe2a8', '#ffffff', 'cup', 'CAFE'],
  'AURORA WATCH': ['#0b0b0f', '#d9b25a', '#ffffff', 'watch', 'AURORA'], 'GRAND MOTORS': ['#1a1a1a', '#ffffff', '#c0c6d6', 'car', 'GRAND'],
  'NORTHSTAR AIR': ['#14213d', '#ffffff', '#d9b25a', 'plane', 'NSTAR'], 'SUMMIT BANK': ['#0e3a2a', '#d9b25a', '#ffffff', 'bank', 'SUMMIT'],
  'PLATINUM': ['#2b2f40', '#e8ecf5', '#9fd8ff', 'diamond', 'PLAT'], 'VELOCITY': ['#7a0f1a', '#ffffff', '#ffd23f', 'bolt', 'VELO'],
  'KIDS ON THE PITCH': ['#2a7ad7', '#ffffff', '#ffd23f', 'heart', 'KIDS'], 'FOOD BANK': ['#e07a1f', '#ffffff', '#ffffff', 'apple', 'FOOD'],
  'RUN FOR A CURE': ['#e85a9a', '#ffffff', '#ffffff', 'ribbon', 'CURE'], 'GOOD SPORTS': ['#16a085', '#ffffff', '#ffd23f', 'star', 'GOOD'],
  'GIVE BLOOD': ['#c0262b', '#ffffff', '#ffffff', 'drop', 'BLOOD'], 'COAT DRIVE': ['#3a4a7a', '#ffffff', '#ffd23f', 'coat', 'COATS'],
  // franchise board deals (fame.js BRANDS, by their short name)
  'FROSTBITE': ['#38c6ff', '#0b1a2a', '#ffffff', 'bolt', 'FROST'], 'NORTHPEAK': ['#2f6b4a', '#ffffff', '#d6ecff', 'peak', 'PEAK'],
  'HALFWAY LINE': ['#2456c8', '#ffd23f', '#ffffff', 'burger', 'BLUE'], 'GLACIER': ['#a8e6ff', '#103a5c', '#ffffff', 'drop', 'GLACIER'],
  'KICKSTOP': ['#d9342b', '#ffffff', '#ffd23f', 'car', 'KICK'], 'MAPLEWOOD': ['#7a2a1a', '#ffd9a0', '#ffffff', 'leaf', 'MAPLE'],
  'IRONSKATE': ['#3a3f4a', '#e8edf5', '#ffd23f', 'skate', 'IRON'], 'TWIN PITCH': ['#e86a1e', '#fff4d6', '#ffffff', 'pizza', 'TWIN'],
  'AURORA': ['#7a4cff', '#ffffff', '#5ee07a', 'phone', 'AURORA'], 'BOREAL': ['#4a5d2a', '#f1e3b5', '#ffffff', 'peak', 'BOREAL'],
  'COLDSNAP': ['#b0122a', '#ffffff', '#d6ecff', 'flake', 'COLD'], 'SCREAMER': ['#ffd23f', '#6a1b9a', '#6a1b9a', 'stick', 'BANG'],
  'THUNDER': ['#141414', '#ffd23f', '#ffd23f', 'bolt', 'THUNDR'], 'POLAR': ['#0f4c81', '#d6ecff', '#ffffff', 'flake', 'POLAR'],
  'HAT TRICK': ['#c0281c', '#ffb000', '#ffffff', 'hat', 'HAT'],
};
const AD_ICONS = {
  bottle: ['0011100', '0001000', '0011100', '0111110', '0111110', '0111110', '0011100'],
  crown: ['0000000', '1010101', '1111111', '1111111', '1111111', '0000000', '1111111'],
  plane: ['0001000', '0001000', '1111111', '0011100', '0001000', '0011100', '0000000'],
  skate: ['0110000', '0110000', '0111100', '0111110', '0111111', '0000000', '1111111'],
  leaf: ['0001000', '1011101', '1111111', '0111110', '1111111', '0001000', '0001000'],
  tv: ['0100100', '0011000', '1111111', '1011101', '1011101', '1111111', '0100010'],
  coin: ['0011100', '0111110', '1101011', '1101011', '1101011', '0111110', '0011100'],
  star: ['0001000', '0001000', '1111111', '0111110', '0011100', '0110110', '1000001'],
  note: ['0001111', '0001001', '0001001', '0111001', '1111111', '0110110', '0000000'],
  bubble: ['0011100', '0111110', '1110111', '1101111', '1111111', '0111110', '0011100'],
  play: ['0110000', '0111000', '0111100', '0111110', '0111100', '0111000', '0110000'],
  cart: ['1111111', '1000001', '1011101', '1011101', '1000001', '1111111', '1010101'],
  cup: ['0010100', '0101000', '1111110', '1111101', '1111101', '1111110', '0111100'],
  pizza: ['1111111', '1101011', '0111110', '0110110', '0011100', '0011100', '0001000'],
  fridge: ['0111110', '0100010', '0110010', '0111110', '0100010', '0110010', '0111110'],
  wrench: ['0110000', '1100000', '1110000', '0111000', '0001110', '0000111', '0000011'],
  watch: ['0011100', '0011100', '0111110', '1101011', '1100111', '0111110', '0011100'],
  car: ['0000000', '0011100', '0111110', '1111111', '1111111', '0100010', '0000000'],
  bank: ['0001000', '0111110', '1111111', '1010101', '1010101', '1010101', '1111111'],
  diamond: ['0000000', '0111110', '1111111', '0111110', '0011100', '0001000', '0000000'],
  bolt: ['0001110', '0011100', '0111000', '1111110', '0001100', '0011000', '0110000'],
  heart: ['0110110', '1111111', '1111111', '1111111', '0111110', '0011100', '0001000'],
  apple: ['0001000', '0010000', '0111110', '1111111', '1111111', '1111111', '0110110'],
  drop: ['0001000', '0011100', '0011100', '0111110', '1111111', '1111111', '0111110'],
  coat: ['0110110', '1111111', '1111111', '0111110', '0111110', '0111110', '0111110'],
  ribbon: ['0011100', '0110110', '0110110', '0011100', '0111110', '0110110', '1100011'],
  puck: ['0011100', '0110110', '1101011', '1011101', '1101011', '0110110', '0011100'],   // (a ball)
  stick: ['0000000', '0011000', '0011000', '0011100', '1111110', '1111111', '0101010'],   // (a boot)
  megaphone: ['0000011', '0001111', '1111111', '1111111', '0001111', '0000011', '0000000'],
  shield: ['1111111', '1111111', '1111111', '1111111', '0111110', '0011100', '0001000'],
  peak: ['0000000', '0001000', '0011100', '0110110', '0111110', '1111111', '1111111'],
  burger: ['0111110', '1111111', '0000000', '1111111', '0101010', '1111111', '0111110'],
  phone: ['0111110', '0100010', '0100010', '0100010', '0100010', '0111110', '0011100'],
  flake: ['1001001', '0101010', '0011100', '1111111', '0011100', '0101010', '1001001'],
  hat: ['0011100', '0111110', '0111110', '0111110', '1111111', '1111111', '0000000'],
};
const TEAM_AD_ICONS = ['puck', 'stick', 'megaphone', 'megaphone', 'shield', 'star'];
// the look for one board word: its own brand, the team package in the home club's colours, or (any other word,
// e.g. a custom arena list) the old colour pair with a star
function adBrand(word, k, pal, H0, set) {
  const b = AD_BRANDS[word];
  if (b) return { bg: b[0], fg: b[1], ac: b[2], icon: b[3], word, short: b[4] };
  if (set === 'team' && H0) {
    const tp = [[H0.main, '#ffffff', H0.trim], [H0.dark || '#05060d', H0.trim, '#ffffff']][k % 2];
    return { bg: tp[0], fg: tp[1], ac: tp[2], icon: TEAM_AD_ICONS[k % TEAM_AD_ICONS.length], word, short: word.split(' ').sort((a, b) => b.length - a.length)[0].slice(0, 6) };
  }
  return { bg: pal ? pal[0] : '#1b2a5c', fg: pal ? pal[1] : '#ffffff', ac: pal ? pal[1] : '#ffd23f', icon: 'star', word, short: word.split(' ')[0].slice(0, 6) };
}
function adIcon(c, name, x, y, col, size = 7) {
  const ic = AD_ICONS[name]; if (!ic) return; c.fillStyle = col;
  const st = size >= 7 ? 1 : 7 / size;          // a 5x5 version for the narrow rails: sample every 1.4th dot
  for (let r = 0; r < size; r++) for (let q = 0; q < size; q++) { const rr = Math.min(6, Math.round(r * st)), qq = Math.min(6, Math.round(q * st)); if (ic[rr][qq] === '1') c.fillRect(x + q, y + r, 1, 1); }
}

const arenaCfg = () => Object.assign({}, ARENA_DEFAULT, (S.match && S.match.arena) || {});

// ---------- 3x5 pixel font (A-Z, 0-9, a few symbols)
const PF = (() => {
  const g = 'A:010101111101101|B:110101110101110|C:011100100100011|D:110101101101110|E:111100110100111|F:111100110100100|G:011100101101011|H:101101111101101|I:111010010010111|J:001001001101010|K:101101110101101|L:100100100100111|M:101111111101101|N:110101101101101|O:010101101101010|P:110101110100100|Q:010101101110011|R:110101110101101|S:011100010001110|T:111010010010010|U:101101101101111|V:101101101101010|W:101101111111101|X:101101010101101|Y:101101010010010|Z:111001010100111|0:111101101101111|1:010110010010111|2:110001010100111|3:110001010001110|4:101101111001001|5:111100110001110|6:011100111101111|7:111001010010010|8:111101111101111|9:111101111001110|-:000000111000000|.:000000000000010|!:010010010000010|\':010010000000000|:000010000010000|/:001001010100100';
  const o = {}; for (const e of g.split('|')) o[e[0]] = e.slice(2);
  o[':'] = '000010000010000'; o['#'] = '101111101111101'; o['?'] = '111001011000010'; o["'"] = '010010000000000'; o[','] = '000000000010100'; o['+'] = '000010111010000'; o['&'] = '010101010101011'; o['('] = '010100100100010'; o[')'] = '010001001001010'; return o;
})();
// wide glyphs: M, W and N are unreadable at 3 columns (they turn into H), so they get 5 and 4
const PFW = { M: ['10001', '11011', '10101', '10001', '10001'], W: ['10001', '10001', '10101', '11011', '10001'], N: ['1001', '1101', '1011', '1001', '1001'], '#': ['01010', '11111', '01010', '11111', '01010'], '>': ['100', '010', '001', '010', '100'], '<': ['001', '010', '100', '010', '001'] };
const pGlyphW = ch => PFW[ch] ? PFW[ch][0].length : 3;
function pText(c, str, x, y, col, scale = 1) {
  c.fillStyle = col; str = String(str).toUpperCase();
  let cx = x;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i], wide = PFW[ch];
    if (wide) { for (let r = 0; r < 5; r++) for (let k = 0; k < wide[r].length; k++) if (wide[r][k] === '1') c.fillRect(cx + k * scale, y + r * scale, scale, scale); }
    else { const m = PF[ch]; if (m) for (let k = 0; k < 15; k++) if (m[k] === '1') c.fillRect(cx + (k % 3) * scale, y + ((k / 3) | 0) * scale, scale, scale); }
    cx += (pGlyphW(ch) + 1) * scale;
  }
}
const pTextW = (str, scale = 1) => { str = String(str).toUpperCase(); let w = 0; for (const ch of str) w += pGlyphW(ch) + 1; return Math.max(0, w - 1) * scale; };

// ---------- canvases
const SCN = { L: null, R: null, sp: 3, t: 0, seed: 1, crowd: { L: null, R: null }, cacheKey: '', jb: { clip: null, frames: null, f: 0, shown: new Set(), lastPick: 0 }, flashes: [] };
function sceneCanvas(id) {
  let c = document.getElementById(id);
  if (!c) { c = document.createElement('canvas'); c.id = id; c.className = 'scene'; (document.getElementById('wrap') || document.body).appendChild(c); }
  return c;
}
function drawBanners(c, w, h, side, cfg) {
  if (cfg.banners === 'none') return;
  const list = (S.match && S.match.banners) || [];
  const hm = S.match ? S.match.home : 0, H0 = TEAM[hm];
  const items = cfg.banners === 'flags' ? [0, 1].map(t => ({ col: TEAM[t].main, trim: TEAM[t].trim, label: TEAM[t].abbr || '' }))
    : cfg.banners === 'retired' ? ((S.match && S.match.retired) || []).map(n => ({ col: H0.dark, trim: H0.trim, label: '#' + n }))
    : list.map(b => ({ col: H0.main, trim: H0.trim, label: String(b.year || ''), cup: true }));
  const mine = items.filter((_, i) => (i % 2 === 0) === (side === 'L'));
  if (!mine.length) return;
  const bw = 16, gap = 6, y0 = Math.round(h * 0.11) + 1;
  let x = side === 'L' ? w - bw - 4 : 4;
  for (const b of mine.slice(0, Math.floor((w - 8) / (bw + gap)))) {
    c.fillStyle = b.col; c.fillRect(x, y0, bw, 22); c.beginPath(); c.moveTo(x, y0 + 22); c.lineTo(x + bw / 2, y0 + 26); c.lineTo(x + bw, y0 + 22); c.fill();
    c.fillStyle = b.trim; c.fillRect(x, y0 + 2, bw, 1); c.fillRect(x, y0 + 19, bw, 1);
    c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(x, y0, 1 / 3 * 2, 22); c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x + bw - 2 / 3, y0, 2 / 3, 22);
    c.fillStyle = b.trim; for (let k = 0; k < bw; k += 2 / 3 * 2) c.fillRect(x + k, y0 + 3 / 3 * 0 + 0.34, 1 / 3, 1 / 3);
    c.fillStyle = '#9aa3c7'; c.fillRect(x - 1, y0 - 1, bw + 2, 2 / 3);
    if (b.cup) { c.fillStyle = '#ffd23f'; c.fillRect(x + 6, y0 + 5, 4, 3); c.fillRect(x + 7, y0 + 8, 2, 2); c.fillRect(x + 6, y0 + 10, 4, 1); }
    pText(c, b.label.slice(0, 4), x + bw / 2 - pTextW(b.label.slice(0, 4)) / 2, y0 + 13, '#ffffff');
    x += side === 'L' ? -(bw + gap) : bw + gap;
  }
}
// small scoreboard tower on the other side
function drawScoreTower(c, w, h) {
  const bw = Math.min(w - 10, 60), x = Math.round((w - bw) / 2), y = Math.round(h * 0.2);
  if (bw < 34) return;
  c.fillStyle = '#3a3f52'; c.fillRect(x + 6, 0, 1 / 3, y - 2); c.fillRect(x + bw - 7, 0, 1 / 3, y - 2);
  c.fillStyle = '#05060d'; c.fillRect(x - 2, y - 2, bw + 4, 22);
  c.fillStyle = '#1a1e2e'; c.fillRect(x - 1.67, y - 1.67, bw + 3.33, 1 / 3);
  c.fillStyle = '#0b1020'; c.fillRect(x, y, bw, 18);
  c.fillStyle = 'rgba(0,0,0,.2)'; for (let xx = x; xx < x + bw; xx += 1) c.fillRect(xx + 2 / 3, y, 1 / 3, 18);
  pText(c, (TEAM[0].abbr || '') + ' ' + S.score[0], x + 3, y + 3, '#ffd23f');
  pText(c, (TEAM[1].abbr || '') + ' ' + S.score[1], x + 3, y + 10, '#ffd23f');
  const cl = typeof clockText === 'function' ? clockText() : fmtClock(S.clock); pText(c, cl, x + bw - pTextW(cl) - 3, y + 3, '#ffffff');
  const per = S.so ? 'SO' : S.period >= 4 ? 'ET' : (S.period - 1) + 'H'; pText(c, per, x + bw - pTextW(per) - 3, y + 10, '#7ec8ff');
}
// ---------- the Jumbotron: live scoreboard, replays at stoppages and intermissions
function jbPickClip() {
  const J = SCN.jb, clips = (typeof REC !== 'undefined' && REC.clips) || [];
  if (S.screen === 'intermission' && S.inter && S.inter.clips && S.inter.clips.length) return S.inter.clips[S.inter.ci];
  // the newest unseen highlight, shown while play is stopped
  for (let i = clips.length - 1; i >= 0; i--) { const cl = clips[i]; if (!J.shown.has(cl)) return cl; }
  return null;
}
function drawBigBoard(c, w, h, cfg) {
  const bw = Math.min(w - 8, 128), bh = Math.round(bw * 0.62), x = Math.round((w - bw) / 2), y = Math.round(h * 0.15);
  if (bw < 40) return;
  const hm = S.match ? S.match.home : 0, H0 = TEAM[hm];
  // rigging cables up to the roof, speaker clusters on both sides, a bevelled housing and LED ribbons
  c.fillStyle = '#3a3f52'; for (const cx of [x + 8, x + bw - 9]) c.fillRect(cx, 0, 1 / 3, y - 3);
  for (const sx of [x - 13, x + bw + 4]) {
    c.fillStyle = '#0a0b12'; c.fillRect(sx, y + 4, 9, bh - 8); c.fillStyle = '#1c1f2c'; c.fillRect(sx + 1, y + 5, 7, bh - 10);
    c.fillStyle = '#2c3142'; for (let yy = y + 6; yy < y + bh - 6; yy += 1) for (let xx = sx + 1.67; xx < sx + 8; xx += 1) if ((yy + xx) % 2 < 1) c.fillRect(xx, yy, 1 / 3, 1 / 3);
  }
  c.fillStyle = '#05060d'; c.fillRect(x - 3, y - 6, bw + 6, bh + 19);
  c.fillStyle = H0.dark; c.fillRect(x - 2, y - 5, bw + 4, bh + 17);
  c.fillStyle = shade(H0.dark, 0.25); c.fillRect(x - 2, y - 5, bw + 4, 1 / 3); c.fillStyle = shade(H0.dark, -0.35); c.fillRect(x - 2, y + bh + 12 - 1 / 3, bw + 4, 1 / 3);
  const chase = (SCN.t >> 2) % 4;
  for (let i = 0; i < bw + 2; i += 4 / 3) { c.fillStyle = ((i * 0.75 | 0) + chase) % 4 === 0 ? '#ffffff' : ((i * 0.75 | 0) % 2 ? H0.main : H0.trim); c.fillRect(x - 1 + i, y - 4, 2 / 3, 2 / 3); c.fillRect(x - 1 + i, y + bh + 1.33, 2 / 3, 2 / 3); }
  c.fillStyle = '#0b1020'; c.fillRect(x, y, bw, bh);
  const J = SCN.jb, stopped = S.phase !== 'live' || S.screen === 'intermission';
  if (stopped && S.phase !== 'faceoff' || S.screen === 'intermission') {
    if (!J.clip) { const cl = jbPickClip(); if (cl) { J.clip = cl; J.f = 0; try { J.frames = clipFrames(cl); } catch (e) { J.frames = null; } } }
  }
  if (J.clip && J.frames && J.frames.length) {
    c.save(); c.beginPath(); c.rect(x, y, bw, bh); c.clip();
    drawClipMini(c, J.clip, J.frames, Math.min(J.frames.length - 1, J.f | 0), x, y, bw, bh);
    c.restore();
    pText(c, 'REPLAY', x + 2, y + 2, ((SCN.t >> 4) & 1) ? '#ff4a3d' : '#ffffff');
    const cap = (J.clip.meta && J.clip.meta.text ? J.clip.meta.text : J.clip.kind).toUpperCase().replace(/[^A-Z0-9 #.!'-]/g, '');
    pText(c, cap.slice(0, Math.floor(bw / 4)), x + 1, y + bh + 4, '#ffffff');
    J.f += 0.55;                                                       // ~ real time at 20 fps of 15 fps footage
    if (J.f >= J.frames.length + 12) { J.shown.add(J.clip); J.clip = null; J.frames = null; if (S.screen === 'intermission' && S.inter) { /* the intermission cycles its own list */ } }
    if (!stopped && S.phase === 'live' && J.f > 6) { J.shown.add(J.clip); J.clip = null; J.frames = null; }
  } else if (S.walk && S.walk.cur) {
    // the walkout: the starter being introduced, big
    const W1 = S.walk.cur, T = TEAM[W1.t], nm = String(W1.name).slice(0, Math.floor(bw / 4));
    c.fillStyle = T.dark; c.fillRect(x, y, bw, bh); c.fillStyle = T.main; c.fillRect(x, y, bw, 7); c.fillRect(x, y + bh - 3, bw, 3);
    pText(c, 'NOW STARTING', x + bw / 2 - pTextW('NOW STARTING') / 2, y + 1, lum(T.main) > 0.6 ? '#141832' : '#ffffff');
    drawEmblemPix(c, T, x + 6, y + bh / 2 - 6);
    const n = '#' + W1.num; pText(c, n, x + bw / 2 - pTextW(n, 3) / 2 + 6, y + 12, '#ffd23f', 3);
    pText(c, nm, x + bw / 2 - pTextW(nm) / 2 + 6, y + 31, '#ffffff');
    pText(c, W1.role, x + bw / 2 - pTextW(W1.role) / 2 + 6, y + 38, '#9fd0ff');
  } else if (S.walk) {
    const T = TEAM[S.match ? S.match.home ?? 0 : 0], l1 = S.walk.first ? 'WELCOME' : ['', '1ST', '1ST', '2ND'][Math.min(3, S.period)] + ' HALF', l2 = S.walk.first ? 'YOUR TEAMS!' : 'COMING UP';
    c.fillStyle = T.dark; c.fillRect(x, y, bw, bh);
    pText(c, l1, x + bw / 2 - pTextW(l1, 2) / 2, y + bh / 2 - 12, '#ffd23f', 2); pText(c, l2, x + bw / 2 - pTextW(l2) / 2, y + bh / 2 + 4, '#ffffff');
  } else {
    // live: the scoreboard
    drawEmblemPix(c, TEAM[0], x + 12, y + bh / 2 - 6); drawEmblemPix(c, TEAM[1], x + bw - 28, y + bh / 2 - 6);
    pText(c, String(S.score[0]), x + bw / 2 - 14, y + bh / 2 - 8, '#ffd23f', 2);
    pText(c, String(S.score[1]), x + bw / 2 + 8, y + bh / 2 - 8, '#ffd23f', 2);
    const cl = typeof clockText === 'function' ? clockText() : fmtClock(S.clock); pText(c, cl, x + bw / 2 - pTextW(cl) / 2, y + 4, '#ffffff');
    const per = S.so ? 'SHOOTOUT' : S.period >= 4 ? 'EXTRA TIME' : ['1ST', '1ST', '2ND'][S.period - 1] + ' HALF';
    pText(c, per, x + bw / 2 - pTextW(per) / 2, y + bh - 14, '#7ec8ff');
    const sh = 'SHOTS ' + S.sog[0] + '-' + S.sog[1]; pText(c, sh, x + bw / 2 - pTextW(sh) / 2, y + bh - 7, '#9aa3c7');
    pText(c, (cfg.text || (H0.abbr ? 'GO ' + (H0.nick || H0.abbr) + '!' : '')).toUpperCase().slice(0, Math.floor(bw / 4)), x + 1, y + bh + 4, '#ffffff');
  }
  // scanlines
  c.fillStyle = 'rgba(0,0,0,.18)'; for (let yy = y; yy < y + bh; yy += 1) c.fillRect(x, yy + 2 / 3, bw, 1 / 3);
  for (let xx = x; xx < x + bw; xx += 1) c.fillRect(xx + 2 / 3, y, 1 / 3, bh);                              // LED pixel grid
  c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(x, y, bw, Math.round(bh * 0.35));                      // glass sheen
}
function drawEmblemPix(c, T, x, y) {
  c.fillStyle = T.dark; c.fillRect(x - 1, y - 1, 18, 18); c.fillStyle = shade(T.main, -0.35); c.fillRect(x, y, 16, 16);
  if (typeof crestRuns === 'function' && T.colors) { for (const [col, rx, ry, rw] of crestRuns(T)) { c.fillStyle = col; c.fillRect(x + rx, y + ry, rw, 1); } }
  else { c.fillStyle = T.main; c.fillRect(x + 1, y + 1, 14, 14); pText(c, (T.abbr || '').slice(0, 3), x + 2, y + 5, '#ffffff'); }
}
// miniature pixel-art footage of a recorded clip (players as tiny jerseys, the puck, the rink markings)
function drawClipMini(c, clip, frames, fi, x, y, w, h) {
  const f = frames[fi]; if (!f) return;
  const px0 = f[3] / 4, py0 = f[4] / 4, sc = Math.max(0.28, w / 300);
  const ox = x + w / 2 - px0 * sc, oy = y + h / 2 - py0 * sc;
  const X = v => Math.round(ox + v * sc), Y = v => Math.round(oy + v * sc);
  c.fillStyle = '#dfe9f4'; c.fillRect(X(R.l), Y(R.t), Math.round((R.r - R.l) * sc), Math.round((R.b - R.t) * sc));
  c.fillStyle = '#c0392b'; c.fillRect(X(R.l), Y(CY), Math.round((R.r - R.l) * sc), 1); c.fillRect(X(R.l), Y(GL_TOP), Math.round((R.r - R.l) * sc), 1); c.fillRect(X(R.l), Y(GL_BOT), Math.round((R.r - R.l) * sc), 1);
  c.fillStyle = '#2f5fd0'; c.fillRect(X(R.l), Y(BLUE_TOP), Math.round((R.r - R.l) * sc), 1); c.fillRect(X(R.l), Y(BLUE_BOT), Math.round((R.r - R.l) * sc), 1);
  c.fillStyle = '#7fb4ff'; c.fillRect(X(CX - CREASE_R), Y(GL_TOP), Math.round(CREASE_R * 2 * sc), Math.max(1, Math.round(8 * sc))); c.fillRect(X(CX - CREASE_R), Y(GL_BOT) - Math.max(1, Math.round(8 * sc)), Math.round(CREASE_R * 2 * sc), Math.max(1, Math.round(8 * sc)));
  c.fillStyle = '#c0392b'; c.fillRect(X(CX - GOAL_HW), Y(GL_TOP) - 2, Math.round(GOAL_HW * 2 * sc), 2); c.fillRect(X(CX - GOAL_HW), Y(GL_BOT), Math.round(GOAL_HW * 2 * sc), 2);
  const tcol = [teamPalette(clip.look.teams[0] || DEFAULT_TEAMS.blizzard, clip.look.away ? clip.look.away[0] : false), teamPalette(clip.look.teams[1] || DEFAULT_TEAMS.inferno, clip.look.away ? clip.look.away[1] : true)];
  const np = (clip.v || 1) >= 2 ? clip.np || 10 : 8;
  for (let k = 0; k < np; k++) {
    const o = 8 + k * (typeof clipStride === 'function' ? clipStride(clip) : 6), team = k < 8 ? (k < 4 ? 0 : 1) : (k - 8), gk = k < 8 && k % 4 === 3;
    if ((clip.v || 1) >= 2 && !(f[o + 3] & 256)) continue;
    const px = X(f[o] / 4), py = Y(f[o + 1] / 4), down = f[o + 3] & (1 | 4);
    c.fillStyle = '#05060d'; c.fillRect(px - 2, py - (down ? 2 : 4), gk ? 5 : 4, down ? 3 : 5);
    c.fillStyle = tcol[team].main; c.fillRect(px - 1, py - (down ? 1 : 3), gk ? 3 : 2, down ? 1 : 2);
    c.fillStyle = tcol[team].helm || tcol[team].dark; if (!down) c.fillRect(px - 1, py - 4, gk ? 3 : 2, 1);
    if (f[o + 3] & 512) { c.fillStyle = '#ffffff'; c.fillRect(px + 1, py - 5, 1, 1); }       // fighting: fists up
  }
  c.fillStyle = '#05060d'; c.fillRect(X(px0), Y(py0) - Math.round(f[5] / 12), 1, 1);
}
