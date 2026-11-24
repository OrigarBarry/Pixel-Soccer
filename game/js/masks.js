'use strict';
// ====================================================================
//  GOALIE MASK LIBRARY: the extra painted designs, their tiers (shop / unlock), custom paint jobs, AI goalie variety
//  and the close-up renderer used by the Mask Studio, the cabinet and portraits.
//  A design paints on the 10 x 10 mask (sprites.js drawGoalieMask draws the shell, then the design, then the cage):
//    D(col, x, y, w, h)  paint a block        M(col, x, y, w, h)  paint it on both halves (mirrored)
//    E((x, y) => col)    paint any mask cell the function gives a colour (rows follow the mask's rounded outline)
//  Rows 4-8, columns 2-7 sit under the cage; anything above row 0 or outside the outline sticks out (horns, ears, crests).
//  Paint slots: L (left half), R (right half), ridge (centre stripe), a / a2 (the design's accents), cage, eye (eye glint)
// ====================================================================
const MASK_TIERS = {
  free:   { name: 'STANDARD', col: '#9aa3b8' },
  common: { name: 'COMMON', col: '#7fd07a' },
  rare:   { name: 'RARE', col: '#5fa8ff' },
  epic:   { name: 'EPIC', col: '#c27aff' },
  legend: { name: 'LEGENDARY', col: '#ffb52e' },
};
const mixHex = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return rgbHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
// the built-in designs keep their place in sprites.js; this table only describes them for the shop (tier, unlock)
const MASK_BASE_INFO = {
  split: { tier: 'free' }, bucket: { tier: 'free' }, white: { tier: 'free' }, retro: { tier: 'free' }, checkers: { tier: 'free' }, wolf: { tier: 'free' },
  skull: { tier: 'free' }, tiger: { tier: 'free' }, flame: { tier: 'free' }, shark: { tier: 'free' }, lightning: { tier: 'free' },
  star: { tier: 'legend', cos: 'star_mask' }, galaxy: { tier: 'legend', cos: 'galaxy_mask' }, laststand: { tier: 'legend', cos: 'laststand_mask' },
  chrome: { tier: 'legend', cos: 'chrome_gear' }, gold: { tier: 'legend', cos: 'gold_gear' },
};
const MASKS_X = {
  // ---------------- COMMON
  stripes: { name: 'Racing Stripes', tier: 'common', price: 150, team: true, spec: C => ({ b: 'split', L: C.main, R: C.main, ridge: C.trim || '#ffffff', a: C.trim || '#ffffff', a2: C.dark }),
    paint(D, M, E, s) { M(s.a2, 3, 0, 1, 4); M(s.a, 2, 1, 1, 3); M(s.a2, 1, 2, 1, 2); D(s.a, 3, 9, 4, 1); M(s.a, 0, 6, 1, 2); } },
  hornet: { name: 'Hornet', tier: 'common', price: 250, spec: () => ({ b: 'split', L: '#f5c518', R: '#d9a90c', ridge: '#1b1c22', a: '#1b1c22', eye: '#ffd23f' }),
    paint(D, M, E, s) { M(s.a, 1, 2, 3, 1); M(s.a, 0, 4, 2, 1); M(s.a, 0, 6, 2, 1); M(s.a, 2, 8, 1, 1); D(s.a, 3, 9, 4, 1); M(s.a, 2, -1, 1, 1); } },
  camo: { name: 'Camo', tier: 'common', price: 200, spec: () => ({ b: 'split', L: '#5b6b3a', R: '#4a5730', ridge: '#3a2f1e', a: '#2f3a1e', a2: '#8a7a4a' }),
    paint(D, M, E, s) { D(s.a, 1, 2, 2, 1); D(s.a, 2, 3, 1, 1); D(s.a2, 7, 1, 2, 1); D(s.a2, 0, 4, 1, 2); D(s.a, 8, 5, 2, 1); D(s.a, 1, 7, 1, 1); D(s.a2, 8, 7, 1, 1); D(s.a, 3, 9, 2, 1); D(s.a, 6, 2, 1, 1); D(s.a2, 1, 1, 1, 1); D(s.a2, 7, 3, 2, 1); } },
  carbon: { name: 'Carbon Fibre', tier: 'common', price: 300, spec: () => ({ b: 'split', L: '#2c2f38', R: '#22252c', ridge: '#c0392b', a: '#3e4350', eye: '#ff5a4a' }),
    paint(D, M, E, s) { E((x, y) => (x + y) % 2 === 0 && !(x >= 4 && x <= 5 && y <= 3) ? s.a : null); } },
  sunset: { name: 'Sunset Fade', tier: 'common', price: 250, spec: () => ({ b: 'split', L: '#ffd23f', R: '#8a4fd8', ridge: '#fff3c8', a: '#ff5e6c' }),
    paint(D, M, E, s) { E((x, y) => (x >= 4 && x <= 5 && y <= 3) ? null : y <= 1 ? s.L : y <= 3 ? mixHex(s.L, s.a, 0.5) : y <= 5 ? s.a : y <= 6 ? mixHex(s.a, s.R, 0.5) : s.R); } },
  wave: { name: 'Big Wave', tier: 'common', price: 200, spec: () => ({ b: 'split', L: '#1f5fb8', R: '#164a92', ridge: '#eaf6ff', a: '#eaf6ff', a2: '#5fb8ff' }),
    paint(D, M, E, s) { M(s.a2, 0, 6, 2, 1); M(s.a, 1, 7, 1, 1); M(s.a, 0, 5, 1, 1); M(s.a2, 1, 4, 1, 1); M(s.a, 1, 3, 1, 1); M(s.a, 2, 2, 1, 1); M(s.a2, 3, 2, 1, 1); M(s.a2, 2, 8, 1, 1); D(s.a2, 3, 9, 4, 1); } },
  tribal: { name: 'Tribal Swirl', tier: 'common', price: 250, spec: () => ({ b: 'split', L: '#f1f2f5', R: '#d9dce4', ridge: '#1b1c22', a: '#1b1c22' }),
    paint(D, M, E, s) { M(s.a, 2, 1, 1, 1); M(s.a, 1, 2, 1, 2); M(s.a, 2, 3, 1, 1); M(s.a, 0, 4, 1, 1); M(s.a, 1, 5, 1, 2); M(s.a, 0, 7, 1, 0); M(s.a, 2, 8, 1, 1); D(s.a, 4, 9, 2, 1); } },
  hex: { name: 'Honeycomb', tier: 'common', price: 300, spec: () => ({ b: 'split', L: '#f2b705', R: '#c98f00', ridge: '#fff1a8', a: '#8a5a00' }),
    paint(D, M, E, s) { E((x, y) => (x + (y % 2 ? 1 : 0)) % 3 === 0 && !(x >= 4 && x <= 5 && y <= 3) ? s.a : null); } },
  racing: { name: 'Checkered Flag', tier: 'common', price: 350, team: true, spec: C => ({ b: 'split', L: '#f4f4f4', R: C.main, ridge: '#e0302a', a: '#1b1c22' }),
    paint(D, M, E, s) { E((x, y) => x < 4 && (x + y) % 2 ? s.a : null); D(s.ridge, 4, 0, 1, 10); } },
  blackout: { name: 'Blackout Cage', tier: 'common', price: 200, spec: () => ({ b: 'bucket', L: '#1b1c22', R: '#1b1c22', ridge: '#3a3d46', shell: '#2a2c34', cage: '#5a606e', eye: '#e8ecf2' }),
    paint() {} },
  probucket: { name: 'Pro Headband & Cage', tier: 'common', price: 150, team: true, spec: C => ({ b: 'bucket', L: C.main, R: C.main, ridge: C.trim || '#ffffff', shell: '#f4f6fa', cage: '#d4d9e2' }),
    paint(D, M, E, s) { M(s.ridge, 1, 2, 1, 1); } },
  // ---------------- RARE
  panther: { name: 'Panther', tier: 'rare', price: 700, spec: () => ({ b: 'split', L: '#1b1c22', R: '#121318', ridge: '#2a2c36', a: '#ffd23f', a2: '#eef1f6', eye: '#ffd23f' }),
    paint(D, M, E, s) { M(s.a, 1, 3, 2, 1); M(s.a, 2, 2, 1, 1); M('#3a3d46', 2, -1, 1, 1); M('#3a3d46', 2, 0, 1, 1); M(s.a2, 2, 7, 1, 2); D(s.a2, 3, 9, 1, 1); D(s.a2, 6, 9, 1, 1); M('#3a3d46', 0, 5, 1, 1); } },
  bear: { name: 'Grizzly', tier: 'rare', price: 650, spec: () => ({ b: 'split', L: '#7a4a22', R: '#5e3818', ridge: '#a8703a', a: '#c9955a', a2: '#3a2210', eye: '#ffb02e' }),
    paint(D, M, E, s) { M(s.a2, 1, -1, 2, 2); M(s.a, 2, 0, 1, 1); D(s.a, 3, 9, 4, 1); M(s.a2, 1, 3, 1, 1); M(s.a2, 0, 5, 1, 2); M(s.a, 1, 6, 1, 1); } },
  eagle: { name: 'Bald Eagle', tier: 'rare', price: 800, spec: () => ({ b: 'split', L: '#2f5fd0', R: '#244aa6', ridge: '#f4f4f4', a: '#f4f4f4', a2: '#ffb52e', eye: '#ffd23f' }),
    paint(D, M, E, s) { E((x, y) => y <= 2 ? s.a : null); M(s.a, 1, 3, 1, 1); M(s.a, 3, 3, 1, 1); M('#1b1c22', 1, 2, 1, 1); D(s.a2, 4, 9, 2, 1); D(s.a2, 4, 3, 2, 1); M(s.a, 0, 6, 1, 1); } },
  viper: { name: 'Viper', tier: 'rare', price: 700, spec: () => ({ b: 'split', L: '#3aa65a', R: '#2a7a40', ridge: '#c8f060', a: '#1f4a28', a2: '#c8f060', eye: '#c8f060' }),
    paint(D, M, E, s) { E((x, y) => ((x + y) % 4 === 0 || (x - y + 20) % 4 === 0) ? s.a : null); M(s.a2, 1, 3, 1, 1); D(s.ridge, 4, 0, 2, 2); } },
  pumpkin: { name: 'Jack-o\'-Lantern', tier: 'rare', price: 600, spec: () => ({ b: 'split', L: '#ff8a1f', R: '#e0700c', ridge: '#3a8a2a', a: '#1b1c22', a2: '#ffd23f', eye: '#ffd23f' }),
    paint(D, M, E, s) { E((x, y) => (x === 2 || x === 7) && y < 4 ? darker(s.L, 0.22) : null); D(s.L, 4, 2, 2, 2); D(s.ridge, 4, -1, 2, 3); D('#5ad13a', 6, -1, 1, 1);
      M(s.a, 2, 2, 1, 1); M(s.a, 1, 3, 3, 1); M(s.a2, 2, 3, 1, 1); D(s.a, 3, 9, 4, 1); D(s.a2, 4, 9, 1, 1); M(s.a, 0, 6, 1, 1); } },
  ice: { name: 'Glacier', tier: 'rare', price: 750, spec: () => ({ b: 'split', L: '#bfe8ff', R: '#8ccaf0', ridge: '#ffffff', a: '#ffffff', a2: '#4a8ac8', eye: '#9fe0ff' }),
    paint(D, M, E, s) { for (const [x, y] of [[1, 3], [2, 2], [0, 5], [1, 6], [8, 2], [7, 3], [9, 5], [8, 7]]) D(s.a2, x, y); for (const [x, y] of [[2, 1], [7, 1], [1, 4], [8, 4], [3, 9], [6, 9]]) D(s.a, x, y); } },
  owl: { name: 'Night Owl', tier: 'rare', price: 650, spec: () => ({ b: 'split', L: '#8a6a4a', R: '#6e5236', ridge: '#ffb52e', a: '#ffb52e', a2: '#e8d8b8', eye: '#ffb52e' }),
    paint(D, M, E, s) { M(s.a2, 1, 2, 2, 2); M(s.a, 2, 3, 1, 1); M('#1b1c22', 2, 2, 1, 1); M(darker(s.R, 0.3), 2, -1, 1, 1); M(s.a2, 0, 5, 1, 1); M(s.a2, 1, 6, 1, 1); M(s.a2, 2, 8, 1, 1); } },
  jester: { name: 'Jester', tier: 'rare', price: 900, spec: () => ({ b: 'split', L: '#7a2ad0', R: '#2ab05a', ridge: '#ffd23f', a: '#ffd23f', a2: '#ff3b6a', eye: '#ffd23f' }),
    paint(D, M, E, s) { D(s.a, 2, 2); D(s.a, 1, 3); D(s.a, 1, 6); D(s.a, 0, 5); D(s.a2, 7, 2); D(s.a2, 8, 3); D(s.a2, 8, 6); D(s.a2, 9, 5); D(s.a, 1, -1); D(s.a2, 8, -1); D(s.L, 2, 0, 1, 1); D(s.R, 7, 0, 1, 1); } },
  ghost: { name: 'Phantom', tier: 'rare', price: 600, spec: () => ({ b: 'split', L: '#f4f6fb', R: '#dfe4ee', ridge: '#ffffff', a: '#3a3f52', a2: '#b8c0d8', eye: '#9ff0ff' }),
    paint(D, M, E, s) { M(s.a, 1, 2, 2, 2); M(s.a2, 0, 6, 1, 2); M(s.a2, 2, 8, 1, 1); D(s.a2, 4, 9, 2, 1); } },
  crystal: { name: 'Crystal', tier: 'rare', price: 1000, spec: () => ({ b: 'split', L: '#7ff0ff', R: '#3ab8e0', ridge: '#ffffff', a: '#ffffff', a2: '#1f7aa8', eye: '#ffffff' }),
    paint(D, M, E, s) { E((x, y) => (x * 3 + y * 2) % 5 === 0 ? s.a : (x + y * 3) % 7 === 0 ? s.a2 : null); } },
  // ---------------- EPIC
  lava: { name: 'Molten Lava', tier: 'epic', price: 1800, spec: () => ({ b: 'split', L: '#26201e', R: '#1a1514', ridge: '#ff6a1f', a: '#ff6a1f', a2: '#ffd23f', eye: '#ff6a1f', cage: '#5a4a44' }),
    paint(D, M, E, s) { for (const [x, y] of [[1, 2], [2, 3], [1, 4], [0, 6], [7, 1], [8, 2], [9, 5], [8, 6], [3, 9], [2, 8]]) D(s.a, x, y); for (const [x, y] of [[2, 1], [1, 3], [7, 3], [8, 7], [6, 9], [0, 5]]) D(s.a2, x, y); } },
  zombie: { name: 'Zombie', tier: 'epic', price: 1600, spec: () => ({ b: 'split', L: '#7aa860', R: '#5e8a48', ridge: '#4a3a2a', a: '#2a2a22', a2: '#c0392b', eye: '#d8ff4a' }),
    paint(D, M, E, s) { D(s.a, 1, 3, 3, 1); D(s.a, 1, 2); D(s.a, 3, 2); D(s.a, 2, 4); D(s.a2, 8, 2, 1, 2); D(s.a2, 7, 3); D('#e8e0c8', 8, 6); D(s.a, 0, 5, 1, 1); D(s.a, 1, 6); D(darker(s.L, 0.3), 6, 1, 1, 1); D(s.a2, 3, 9, 1, 1); } },
  samurai: { name: 'Samurai', tier: 'epic', price: 2400, spec: () => ({ b: 'split', L: '#b3202a', R: '#8a1820', ridge: '#e8c860', a: '#e8c860', a2: '#1b1c22', eye: '#ffffff', cage: '#e8c860' }),
    paint(D, M, E, s) { M(s.a, 2, -2, 1, 2); M(s.a, 3, -1, 1, 1); M(s.a2, 0, 4, 2, 1); M(s.a2, 0, 6, 2, 1); M(s.a, 1, 3, 1, 1); D(s.a2, 3, 9, 4, 1); M(s.a, 1, 1 + 1, 1, 0); } },
  synth: { name: 'Synthwave', tier: 'epic', price: 2000, spec: () => ({ b: 'split', L: '#3a1a6a', R: '#2a1050', ridge: '#ff4ab0', a: '#ff4ab0', a2: '#3ae0ff', eye: '#3ae0ff' }),
    paint(D, M, E, s) { D(mixHex(s.a, '#ffd23f', 0.6), 4, 1, 2, 1); D(mixHex(s.a, '#ffd23f', 0.3), 3, 2, 4, 1); D(s.L, 4, 0, 1, 1); D(s.R, 5, 0, 1, 1); D(s.a2, 0, 3, 10, 1); D(s.a, 3, 3, 4, 1);
      M(s.a2, 0, 4, 2, 1); M(s.a2, 0, 6, 2, 1); M(s.a2, 1, 5, 1, 1); M(s.a2, 1, 7, 1, 1); D(s.a2, 3, 9, 4, 1); } },
  aurora: { name: 'Aurora', tier: 'epic', price: 2200, spec: () => ({ b: 'split', L: '#0e1a3a', R: '#0a1230', ridge: '#9fffd0', a: '#3aff9a', a2: '#b07aff', eye: '#9fffd0' }),
    paint(D, M, E, s) { D(s.a, 1, 2, 2, 1); D(s.a, 3, 1, 1, 1); D(s.a2, 0, 3, 2, 1); D(s.a2, 6, 1, 1, 1); D(s.a2, 7, 2, 2, 1); D(s.a, 8, 3, 2, 1); D(mixHex(s.a, s.a2, 0.5), 2, 3, 1, 1); D(mixHex(s.a, s.a2, 0.5), 7, 3, 1, 1);
      for (const [x, y] of [[2, 1], [8, 5], [0, 6], [1, 4], [7, 8]]) D('#ffffff', x, y); } },
  // ---------------- LEGENDARY (account unlocks)
  fibre: { name: 'Old-Time Fibreglass', tier: 'legend', cos: 'mask_fibre', spec: () => ({ b: 'split', L: '#efe6cc', R: '#d8ceb0', ridge: '#efe6cc', a: '#3a3428', noCage: true }),
    paint(D, M, E, s) { D(s.L, 4, 0, 2, 4); D(darker(s.R, 0.1), 5, 1, 1, 3); M(darker(s.L, 0.12), 1, 3, 3, 1); M('#141824', 2, 4, 2, 1); M('#ffffff', 3, 4, 1, 1); D(darker(s.L, 0.08), 4, 4, 2, 2);
      for (const [x, y] of [[3, 6], [6, 6], [4, 7], [5, 7], [3, 8], [6, 8], [2, 6], [7, 6], [4, 9], [5, 9]]) D(s.a, x, y); M(darker(s.R, 0.2), 1, 7, 1, 1); } },
  monster: { name: 'Monster Jaws', tier: 'legend', cos: 'mask_monster', spec: () => ({ b: 'split', L: '#c0392b', R: '#962a20', ridge: '#1b1c22', a: '#f4f4f4', a2: '#1b1c22', eye: '#ffd23f', cage: '#e8e0c8' }),
    paint(D, M, E, s) { M(s.a, 2, 3, 1, 1); M(s.a, 4, 3, 1, 1); M(s.a2, 1, 2, 2, 1); M(s.a2, 3, 1, 1, 1); M(s.a, 2, 8, 1, 1); D(s.a, 3, 9, 1, 1); D(s.a, 6, 9, 1, 1); D(s.a2, 4, 9, 2, 1); M(s.a, 1, 7, 1, 1); M(s.a2, 0, 5, 1, 1); } },
  robot: { name: 'Mech', tier: 'legend', cos: 'mask_robot', spec: () => ({ b: 'split', L: '#9aa3b2', R: '#6e7787', ridge: '#c8d0dc', a: '#ff3b2e', a2: '#4a5262', eye: '#ff3b2e', cage: '#c8d0dc' }),
    paint(D, M, E, s) { D(s.a, 1, 3, 8, 1); D(shade(s.a, 0.45), 2, 3, 1, 1); M(s.a2, 1, 2, 1, 1); M(s.a2, 0, 4, 1, 2); M(s.a2, 1, 7, 1, 1); M(s.a2, 2, -1, 1, 1); M(s.a, 2, -2, 1, 1); D(s.a2, 3, 9, 4, 1); D(s.ridge, 4, 9, 2, 1); } },
  royal: { name: 'Royal Crown', tier: 'legend', cos: 'mask_royal', spec: () => ({ b: 'split', L: '#4a1a8a', R: '#36126a', ridge: '#ffd23f', a: '#ffd23f', a2: '#e0303a', eye: '#ffd23f', cage: '#e8c860' }),
    paint(D, M, E, s) { D(s.a, 2, 1, 6, 1); D(s.a, 3, 0, 1, 1); D(s.a, 6, 0, 1, 1); D(s.a, 4, -1, 2, 2); D(s.a2, 4, 1, 2, 1); M('#7ad0ff', 2, 1, 1, 1); D(s.L, 4, 2, 1, 2); D(s.R, 5, 2, 1, 2);
      M(s.a, 1, 5, 1, 1); M(s.a, 0, 4, 1, 1); M(s.a, 0, 6, 1, 1); D(s.a, 3, 9, 4, 1); } },
  phoenix: { name: 'Phoenix', tier: 'legend', cos: 'mask_phoenix', spec: () => ({ b: 'split', L: '#d0301a', R: '#a82414', ridge: '#ffd23f', a: '#ff8a1f', a2: '#ffd23f', eye: '#ffd23f' }),
    paint(D, M, E, s) { M(s.a, 0, 6, 1, 1); M(s.a2, 0, 5, 1, 1); M(s.a, 1, 4, 1, 1); M(s.a2, 1, 3, 1, 1); M(s.a, 2, 2, 1, 1); M(s.a2, 2, 1, 1, 1); M(s.a2, 1, 7, 1, 1); M(s.a, 3, 1, 1, 1); D(s.a2, 4, -1, 2, 1); D(s.a, 5, -2, 1, 1); D(s.a, 3, 9, 4, 1); } },
  target: { name: 'Bullseye', tier: 'legend', cos: 'mask_target', spec: () => ({ b: 'split', L: '#f4f4f4', R: '#e4e4e4', ridge: '#e0302a', a: '#e0302a', eye: '#ffffff' }),
    paint(D, M, E, s) { E((x, y) => Math.floor(Math.hypot(x - 4.5, y - 5.2)) % 2 === 0 ? s.a : null); } },
  kraken: { name: 'Kraken', tier: 'legend', cos: 'mask_kraken', spec: () => ({ b: 'split', L: '#4a2a7a', R: '#36205c', ridge: '#7a4ab0', a: '#d070c0', a2: '#ffd0f0', eye: '#ffd23f' }),
    paint(D, M, E, s) { for (const [x, y] of [[1, 7], [0, 6], [0, 5], [1, 4], [1, 3], [2, 2], [3, 2], [3, 3]]) M(s.a, x, y); M(s.a2, 1, 5, 1, 1); M(s.a2, 0, 4, 1, 1); M(s.a, 2, 8, 1, 1); D('#ffd23f', 4, 1, 2, 1); D('#1b1c22', 5, 1, 1, 1); } },
  viking: { name: 'Viking', tier: 'legend', cos: 'mask_viking', spec: () => ({ b: 'split', L: '#9aa3b2', R: '#7a8496', ridge: '#c8a03a', a: '#efe6cc', a2: '#c8a03a', eye: '#9fe0ff' }),
    paint(D, M, E, s) { M(s.a, 1, 1, 1, 1); M(s.a, 0, 0, 1, 1); M(s.a, 0, -1, 1, 1); M(darker(s.a, 0.2), 1, 0, 1, 1); D(s.a2, 0, 3, 10, 1); M(s.a2, 2, 2, 1, 1); M('#5a6070', 0, 5, 1, 2); D(s.a2, 3, 9, 4, 1); } },
  dragon: { name: 'Dragon', tier: 'legend', cos: 'mask_dragon', spec: () => ({ b: 'split', L: '#1f8a4a', R: '#146a36', ridge: '#ffb52e', a: '#0e4a24', a2: '#ff3b2e', eye: '#ffb52e' }),
    paint(D, M, E, s) { E((x, y) => y <= 3 && (y % 2 === 0 ? x % 2 === 0 : x % 2 === 1) && !(x >= 4 && x <= 5) ? s.a : null); M('#efe6cc', 2, -1, 1, 1); M('#efe6cc', 1, -2, 1, 1); M(s.a2, 1, 3, 2, 1); M(s.a2, 2, 2, 1, 1); M('#f4f4f4', 2, 8, 1, 1); M(s.a, 0, 5, 1, 2); M(s.ridge, 1, 6, 1, 1); } },
  cyber: { name: 'Cyber Circuit', tier: 'legend', cos: 'mask_cyber', spec: () => ({ b: 'split', L: '#141820', R: '#0c0f16', ridge: '#3ae0ff', a: '#3ae0ff', a2: '#ff3bd0', eye: '#3ae0ff', cage: '#3a4458' }),
    paint(D, M, E, s) { D(s.a, 1, 2, 2, 1); D(s.a, 1, 3, 1, 1); D(s.a, 0, 4, 1, 2); D(s.a, 1, 6, 1, 1); D(s.a2, 7, 1, 1, 1); D(s.a2, 7, 2, 2, 1); D(s.a2, 8, 3, 1, 1); D(s.a2, 9, 5, 1, 1); D(s.a2, 8, 6, 1, 1); D('#ffffff', 1, 2); D('#ffffff', 8, 2); D(s.a, 3, 9, 2, 1); D(s.a2, 5, 9, 2, 1); } },
};
for (const k of Object.keys(MASKS_X)) MASK_KEEP.add(k);
const MASK_BASE_NAMES = { split: 'Team Split', bucket: 'Headband & Cage', white: 'Classic White', retro: 'Retro Headband', checkers: 'Checkered', wolf: 'Wolf Headband', skull: 'Skull', tiger: 'Tiger', flame: 'Flames',
  shark: 'Shark', lightning: 'Lightning', star: 'All-Star', galaxy: 'Galaxy', laststand: 'Last Stand', chrome: 'Chrome', gold: 'Gold' };
// every design in shop order (standard, then common ... legendary)
const MASK_ORDER = (() => { const all = Object.keys(MASK_BASE_INFO).concat(Object.keys(MASKS_X)), rank = { free: 0, common: 1, rare: 2, epic: 3, legend: 4 };
  return all.map((k, i) => [k, i]).sort((a, b) => rank[maskInfo(a[0]).tier] - rank[maskInfo(b[0]).tier] || (maskInfo(a[0]).price || 0) - (maskInfo(b[0]).price || 0) || a[1] - b[1]).map(x => x[0]); })();
function maskInfo(m) {
  if (MASKS_X[m]) return MASKS_X[m];
  const k = m === 'team' ? 'split' : m, b = MASK_BASE_INFO[k]; return Object.assign({ name: MASK_BASE_NAMES[k] || k }, b || { tier: 'free' });
}
// the paint job on a design: its colours, with the player's custom paint (gear.maskP[design]) on top
const MASK_SLOTS = [['L', 'LEFT HALF'], ['R', 'RIGHT HALF'], ['ridge', 'CENTRE STRIPE'], ['a', 'ACCENT'], ['a2', 'ACCENT 2'], ['cage', 'CAGE'], ['eye', 'EYE GLINT']];
function maskCustom(G, m) { const p = G && G.maskP && G.maskP[m === 'team' ? 'split' : m]; return p && typeof p === 'object' ? p : null; }
// which paint slots a design actually uses (so the paint shop only offers ones that change something)
function maskSlots(m, C) {
  const sp = maskSpec(m === 'team' ? 'split' : m, C), out = ['L', 'R', 'ridge'];
  if (sp.a) out.push('a'); if (sp.a2) out.push('a2'); if (!sp.noCage) out.push('cage', 'eye');
  return out;
}

// ---------- AI goalies wear all sorts of masks (seeded by the player, so a goalie keeps his look season to season)
const AI_MASK_POOL = MASK_ORDER.filter(k => { const t = maskInfo(k).tier; return t !== 'legend'; });
function aiMaskFor(pl) {
  let hsh = 2166136261; for (const ch of String(pl.id || '') + '|' + (pl.first || '') + (pl.last || '')) hsh = Math.imul(hsh ^ ch.charCodeAt(0), 16777619) >>> 0;
  hsh ^= hsh >>> 13; hsh = Math.imul(hsh, 3266489909) >>> 0; hsh ^= hsh >>> 16;
  if (hsh % 10 < 3) return 'team';
  return AI_MASK_POOL[Math.floor(hsh / 10) % AI_MASK_POOL.length];
}

// ---------- close-up: the real in-game mask, drawn big (each mask pixel is s screen pixels), with a soft drop shadow.
// The canvas is 14 x 14 mask pixels: the mask sits at (2, 3) so horns, ears and crests have room above it.
function drawMaskAt(c, G, C, s, ox, oy) {
  const keep = ctx;
  try {
    ctx = c; c.imageSmoothingEnabled = false;
    const tmp = document.createElement('canvas'); tmp.width = 14; tmp.height = 14;
    ctx = tmp.getContext('2d'); drawGoalieMask(G, C, 2, 3);
    ctx = c; c.save(); c.imageSmoothingEnabled = false;
    // shadow: the silhouette, one mask pixel down and right
    const sh = document.createElement('canvas'); sh.width = 14; sh.height = 14; const sc = sh.getContext('2d');
    sc.drawImage(tmp, 0, 0); sc.globalCompositeOperation = 'source-in'; sc.fillStyle = 'rgba(0,0,0,.38)'; sc.fillRect(0, 0, 14, 14);
    c.drawImage(sh, ox + s * 0.5, oy + s * 0.6, 14 * s, 14 * s);
    c.drawImage(tmp, ox, oy, 14 * s, 14 * s);
    c.restore();
  } finally { ctx = keep; }
}
function maskCanvas(G, C, size = 56, bg) {
  const cv = h('canvas', { width: 14 * 4, height: 14 * 4, class: 'px' }); cv.style.width = size + 'px'; cv.style.height = size + 'px';
  const c = cv.getContext('2d'); if (bg) { c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height); }
  drawMaskAt(c, G, C, 4, 0, -2);
  return cv;
}

// ---------- ownership: standard designs are free; shop designs are bought once per franchise; legendary ones are account unlocks
const maskOwnedList = team => (team.maskOwned = team.maskOwned || []);
function maskLockId(m) { const i = maskInfo(m); return i.cos || (typeof gearLockId === 'function' ? gearLockId('mask', m) : null); }
function maskState(team, m) {
  const i = maskInfo(m);
  if (i.cos || maskLockId(m)) return typeof hasCosmetic === 'function' && hasCosmetic(maskLockId(m)) ? 'own' : 'locked';
  if (!i.price) return 'own';
  if ((typeof dbgFree === 'function' && dbgFree()) || (team && maskOwnedList(team).includes(m))) return 'own';
  return 'shop';
}

// ---------- account unlocks for the legendary masks, and the achievements that earn them
if (typeof COSMETICS !== 'undefined') Object.assign(COSMETICS, {
  mask_fibre:   { name: 'Old-Time Fibreglass Mask', kind: 'gear', desc: 'A moulded fibreglass mask from the days before cages. Eye holes and courage.' },
  mask_monster: { name: 'Monster Jaws Mask', kind: 'gear', desc: 'A red mask with a mouthful of teeth around the cage.' },
  mask_robot:   { name: 'Mech Mask', kind: 'gear', desc: 'Riveted steel and a glowing red visor.' },
  mask_royal:   { name: 'Royal Crown Mask', kind: 'gear', desc: 'Royal purple with a jewelled gold crown.' },
  mask_phoenix: { name: 'Phoenix Mask', kind: 'gear', desc: 'Fire wings sweep up both sides; a flame crest rises off the top.' },
  mask_target:  { name: 'Bullseye Mask', kind: 'gear', desc: 'Go on. Try to hit it.' },
  mask_kraken:  { name: 'Kraken Mask', kind: 'gear', desc: 'Tentacles curl up out of the deep around the cage.' },
  mask_viking:  { name: 'Viking Mask', kind: 'gear', desc: 'Steel, a gold band and a pair of horns.' },
  mask_dragon:  { name: 'Dragon Mask', kind: 'gear', desc: 'Green scales, fire eyes, ivory horns.' },
  mask_cyber:   { name: 'Cyber Circuit Mask', kind: 'gear', desc: 'Neon circuitry on a jet-black shell.' },
});
if (typeof ACHIEVEMENTS !== 'undefined') {
  const give = (id, cos) => { const a = ACH_BY_ID[id]; if (a) { a.reward = Object.assign({}, a.reward || {}); if (!a.reward.cosmetic) a.reward.cosmetic = cos; } };
  give('sho1', 'mask_fibre'); give('fight1', 'mask_monster'); give('iron', 'mask_robot'); give('p500', 'mask_royal'); give('gold_goal', 'mask_phoenix');
  give('eng', 'mask_target'); give('xatk', 'mask_kraken'); give('div1', 'mask_viking'); give('rookie', 'mask_cyber');
  const gw = { id: 'gw100', name: 'Hundred-Win Keeper', cat: 'Keepers', desc: 'One of your keepers reaches 100 career wins.', on: 'game', test: s => rosterGoalies(s.teams[s.userTeamId]).some(id => lifetime(P(s, id).career).w >= 100), reward: { cosmetic: 'mask_dragon' } };
  if (!ACH_BY_ID[gw.id]) { ACHIEVEMENTS.push(gw); ACH_BY_ID[gw.id] = gw; }
}
// Quick Play routes to a few of them too
if (typeof QP_UNLOCKS !== 'undefined') QP_UNLOCKS.push(
  { cos: 'mask_target', text: 'Win 10 Quick Play games', ok: () => (qpProg().n.wins || 0) >= 10 },
  { cos: 'mask_fibre', text: 'Gold in the Breakaway Challenge', ok: () => qpMedal('breakaway') >= 3 });
// the gear menus and tooltips know every design by name
if (typeof GEAR_OPTS !== 'undefined') for (const [k, d] of Object.entries(MASKS_X)) if (!GEAR_OPTS.mask[k]) GEAR_OPTS.mask[k] = d.name + (d.tier === 'legend' ? ' ★' : '');
if (typeof GEAR_LOCK !== 'undefined') for (const [k, d] of Object.entries(MASKS_X)) if (d.cos) GEAR_LOCK['mask:' + k] = d.cos;

// ====================================================================
//  MASK STUDIO (PLAYER GEAR & LOOK > MASK): every design as a close-up, owned / shop / locked, in pages; buy with
//  franchise funds; equip; and the PAINT SHOP to repaint the equipped design (each design keeps its own paint job)
// ====================================================================
const PAINT_COLS = ['#f4f4f4', '#c9ced8', '#7d8696', '#3a3d46', '#1b1c22', '#e0302a', '#8a1820', '#ff8a1f', '#ffd23f', '#c8a03a', '#7a4a22',
  '#3ad15a', '#1f6a36', '#3ae0ff', '#2f6fe8', '#1b2a5c', '#7a2ad0', '#ff4ab0', '#b8f0ff', '#efe6cc'];
const maskFilterOf = () => (typeof UI !== 'undefined' && UI.maskFilter) || 'all';
function maskStudio(p, team, rerender) {
  const save = UI.save, C = teamPalette(teamIdentity(team), false), G = gearOf(p), cur = G.mask === 'team' ? 'split' : G.mask;
  const f = maskFilterOf(), fin = typeof finOf === 'function' ? finOf(team) : { cash: 0 };
  const list = MASK_ORDER.filter(k => { const st = maskState(team, k), t = maskInfo(k).tier;
    return f === 'all' || (f === 'own' && st === 'own') || (f === 'shop' && st === 'shop') || (f === 'legend' && t === 'legend'); });
  const chip = (k, lab) => h('button', { class: 'small' + (f === k ? ' sel' : ''), style: { whiteSpace: 'nowrap' }, onclick: () => { UI.maskFilter = k; rerender(); } }, lab);
  const nOwn = MASK_ORDER.filter(k => maskState(team, k) === 'own').length;
  const equip = k => { p.gear = Object.assign(gearOf(p), { mask: k === 'split' ? 'team' : k }); Store.autosave(save); rerender(); };
  const tile = k => {
    const i = maskInfo(k), st = maskState(team, k), on = k === cur, tier = MASK_TIERS[i.tier] || MASK_TIERS.free;
    const g2 = Object.assign({}, G, { mask: k });
    const cv = maskCanvas(g2, C, 52); if (st === 'locked') cv.style.opacity = '.45';
    const status = on ? 'WEARING' : st === 'own' ? 'OWNED' : st === 'shop' ? fmtM(i.price) : '🔒 EARN IT';
    return h('button', { class: 'masktile' + (on ? ' sel' : '') + (st === 'locked' ? ' locked' : '') + (st === 'shop' ? ' shop' : ''), style: { borderTopColor: tier.col },
      title: st === 'locked' ? unlockHint(maskLockId(k)) : i.name + ' · ' + tier.name + (st === 'shop' ? ' · ' + fmtM(i.price) : ''),
      onclick: () => {
        if (st === 'locked') return toast(unlockHint(maskLockId(k)), 4200);
        if (st === 'own') return equip(k);
        confirmDlg(`Buy the ${i.name} mask (${tier.name.toLowerCase()}) for ${fmtM(i.price)}? Any keeper on your team can wear it once it's yours. Funds: ${fmtM(fin.cash)}.`, 'BUY ' + fmtM(i.price), () => {
          const err = spend(save, team, i.price, 'Keeper mask: ' + i.name); if (err) return toast(err);
          maskOwnedList(team).push(k); equip(k); toast(`${i.name} is yours. ${pname(p)} is wearing it.`);
        });
      } }, cv, h('div', { class: 'mtname' }, i.name), h('div', { class: 'mtstat', style: { color: on ? 'var(--gold)' : st === 'shop' ? '#7fd07a' : st === 'locked' ? '#9aa3c7' : tier.col } }, status));
  };
  const ci = maskInfo(cur), hasPaint = !!maskCustom(G, cur);
  return h('div', { class: 'maskstudio' },
    h('div', { class: 'row', style: { gap: '5px', margin: '0 0 6px', alignItems: 'center', flexWrap: 'nowrap' } },
      chip('all', 'ALL ' + MASK_ORDER.length), chip('own', 'OWNED ' + nOwn), chip('shop', 'SHOP'), chip('legend', 'LEGENDS'),
      h('div', { class: 'grow' }), h('span', { class: 'muted', style: { fontSize: '7px' } }, 'FUNDS ', h('b', { class: 'gold' }, fmtM(fin.cash)))),
    list.length ? pages('maskp' + f, list, 18, sl => h('div', { class: 'maskgrid' }, sl.map(tile))) : h('div', { class: 'muted', style: { fontSize: '8px', padding: '20px 0' } }, 'Nothing here yet.'),
    h('div', { class: 'row maskbar', style: { alignItems: 'center', gap: '8px', flexWrap: 'nowrap', margin: '6px 0 0' } },
      maskCanvas(G, C, 30), h('div', { style: { flex: 1, fontSize: '7px', lineHeight: 1.5 } }, h('b', { class: 'gold' }, ci.name.toUpperCase()), hasPaint ? h('span', { class: 'muted' }, ' · custom paint') : null,
        h('div', { class: 'muted', style: { fontSize: 'calc(6px * var(--ts, 1.2))' } }, 'Buy once, any keeper can wear it.')),
      h('button', { class: 'small primary', onclick: () => maskPaintDlg(p, team, rerender) }, '🎨 PAINT SHOP')));
}
// the paint shop: one row of swatches per paint slot the design uses; the preview updates as you click
function maskPaintDlg(p, team, done) {
  const save = UI.save, C = teamPalette(teamIdentity(team), false), G0 = gearOf(p), m = G0.mask === 'team' ? 'split' : G0.mask;
  const base = maskSpec0(m, C), paint = Object.assign({}, maskCustom(G0, m) || {});
  const teamCols = [['TEAM', C.main], ['TEAM DARK', C.dark], ['TEAM TRIM', C.trim || '#ffffff']];
  const slots = maskSlots(m, C), names = Object.fromEntries(MASK_SLOTS);
  modal(close => {
    const box = h('div', { class: 'paintdlg' });
    const draw = () => {
      box.innerHTML = '';
      const G = Object.assign({}, G0, { mask: m, maskP: Object.assign({}, G0.maskP || {}, { [m]: paint }) });
      const fig = h('canvas', { width: 54, height: 96, class: 'px', style: { width: '81px', height: '144px', background: '#dfe9f4' } });
      drawFigureOn(fig, C, [fakeSkater({ pl: Object.assign({}, p, { gear: G }), num: p.num, g: true, fy: 1, px: 27, py: 88, hand: p.hand || 'L' })], 3);
      const rows = slots.map(k => {
        const now = paint[k] || null, def = base[k] || (k === 'cage' ? '#d4d9e2' : k === 'eye' ? '#ffffff' : '#888888');
        const sw = (col, lab, sel) => h('button', { class: 'swatch' + (sel ? ' sel' : ''), title: lab || col, style: { background: col }, onclick: () => { if (lab === 'DEFAULT') delete paint[k]; else paint[k] = col; draw(); } });
        return h('div', { class: 'paintrow' }, h('span', { class: 'plab' }, names[k]),
          sw(def, 'DEFAULT', !now), teamCols.map(([lab, col]) => sw(col, lab, now === col)), h('i', { class: 'psep' }), PAINT_COLS.map(col => sw(col, null, now === col && !teamCols.some(t => t[1] === col))));
      });
      box.appendChild(h('h2', null, '🎨 PAINT SHOP · ' + maskInfo(m).name.toUpperCase()));
      box.appendChild(h('div', { class: 'sub', style: { margin: '0 0 6px' } }, `#${p.num} ${pname(p)}'s ${maskInfo(m).name} mask. Paint jobs are free, and every design keeps its own.`));
      box.appendChild(h('div', { class: 'row', style: { gap: '14px', alignItems: 'flex-start', flexWrap: 'nowrap' } },
        h('div', { style: { textAlign: 'center' } }, maskCanvas(G, C, 150, '#dfe9f4'), h('div', { style: { marginTop: '6px' } }, fig)),
        h('div', { style: { flex: 1 } }, rows)));
      box.appendChild(h('div', { class: 'row', style: { marginTop: '8px' } },
        h('button', { class: 'primary', onclick: () => { p.gear = gearOf(p); p.gear.maskP = Object.assign({}, p.gear.maskP || {}); if (Object.keys(paint).length) p.gear.maskP[m] = paint; else delete p.gear.maskP[m]; Store.autosave(save); close(); toast('Paint job saved.'); done && done(); } }, 'SAVE PAINT JOB'),
        h('button', { onclick: () => { for (const k of Object.keys(paint)) delete paint[k]; draw(); } }, 'FACTORY PAINT'),
        h('button', { onclick: close }, 'CANCEL')));
    };
    draw();
    return box;
  }, true);
}
