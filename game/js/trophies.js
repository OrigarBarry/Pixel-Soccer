'use strict';
// ====================================================================
//  TROPHIES, redrawn. Every trophy is built on a 32 x 36 grid of half-pixels (the same 16 x 18 footprint the old
//  16-pixel art used, so every screen that shows one still lines up). Cups and bowls are "turned on a lathe": each row
//  has a half-width, and the metal is shaded across it (bright edge on the left, a hot specular stripe, the body
//  colour, then darker to the right), with rings, engraved plates and a dark outline round the whole thing.
//  All original designs. drawTrophy(c, type, x, y, ps, glow) replaces the one in art.js.
// ====================================================================
const TMAT = {
  gold:   ['#fff6c8', '#ffe27a', '#f2c230', '#c8960f', '#7a5408'],
  silver: ['#ffffff', '#eef2f8', '#c6cddb', '#8f98ae', '#596178'],
  copper: ['#ffe4c8', '#f6b27a', '#d07a3c', '#94501f', '#5a2a10'],
  ice:    ['#ffffff', '#e4f6ff', '#a8dcff', '#5ea8e0', '#2c6aa6'],
  onyx:   ['#9a9ab4', '#55556a', '#2a2a34', '#18181f', '#0a0a0e'],
  wood:   ['#c08a52', '#a06a36', '#7a4a22', '#5a3416', '#3a200c'],
  marble: ['#ffffff', '#f2f0ec', '#dcd8d0', '#b4aea4', '#86807a'],
};
const TROPHY_OUT = '#141832';
function trophyGrid() {
  const W = 32, H = 36, B = Array.from({ length: H }, () => Array(W).fill(null));
  const set = (i, j, col) => { i = Math.round(i); j = Math.round(j); if (i >= 0 && i < W && j >= 0 && j < H && col) B[j][i] = col; };
  const shadeOf = (t, m) => t < -0.72 ? m[1] : t < -0.42 ? m[0] : t < -0.18 ? m[1] : t < 0.35 ? m[2] : t < 0.72 ? m[3] : m[4];
  // a turned row: centre cx, half-width hw
  const row = (j, hw, m, cx = 16) => { for (let i = Math.floor(cx - hw); i < Math.ceil(cx + hw); i++) set(i, j, shadeOf((i + 0.5 - cx) / hw, m)); };
  const lathe = (j0, j1, f, m, cx) => { for (let j = j0; j <= j1; j++) row(j, f((j - j0) / Math.max(1, j1 - j0), j), m, cx); };
  const rect = (i, j, w, h, col) => { for (let y = j; y < j + h; y++) for (let x = i; x < i + w; x++) set(x, y, col); };
  const ring = (j, hw, col, cx = 16) => { for (let i = Math.floor(cx - hw); i < Math.ceil(cx + hw); i++) set(i, j, col); };
  // a plinth: a block with a bevelled top, side shading and an engraved plate
  const plinth = (j0, h, hw, m, plate) => {
    lathe(j0, j0 + h - 1, t => hw - (t < 0.15 ? 1 : 0), m);
    ring(j0, hw - 1, m[1]); ring(j0 + h - 1, hw, m[4]);
    if (plate) { const pw = Math.max(3, Math.round(hw * 0.55)), ph = Math.max(2, Math.min(4, h - 3)), py = j0 + Math.ceil((h - ph) / 2);
      rect(16 - pw, py, pw * 2, ph, plate[2]); rect(16 - pw, py, pw * 2, 1, plate[0]); rect(16 - pw, py + ph - 1, pw * 2, 1, plate[3]);
      if (ph >= 3) rect(16 - pw + 2, py + 1, pw * 2 - 4, 1, plate[4]); }       // the engraving
  };
  const handle = (cx, j0, h, side, m) => {              // a loop handle off the side of a bowl
    for (let k = 0; k < h; k++) { const t = k / (h - 1), dx = Math.round(Math.sin(t * Math.PI) * 3.2); set(cx + side * (1 + dx), j0 + k, k < h / 2 ? m[1] : m[3]); set(cx + side * (dx), j0 + k, null); }
    set(cx + side, j0, m[2]); set(cx + side, j0 + h - 1, m[3]);
  };
  const star = (cx, cy, col, col2) => { set(cx, cy - 2, col); rect(cx - 1, cy - 1, 3, 3, col); set(cx - 2, cy, col); set(cx + 2, cy, col); set(cx - 1, cy + 2, col); set(cx + 1, cy + 2, col); if (col2) set(cx, cy, col2); };
  const sparkle = (i, j) => { set(i, j, '#ffffff'); set(i - 1, j, 'rgba(255,255,255,.7)'); set(i + 1, j, 'rgba(255,255,255,.7)'); set(i, j - 1, 'rgba(255,255,255,.7)'); set(i, j + 1, 'rgba(255,255,255,.7)'); };
  return { B, W, H, set, row, lathe, rect, ring, plinth, handle, star, sparkle, shadeOf };
}
function trophyOutline(G) {
  const { B, W, H } = G, out = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (B[j][i]) continue;
    if ((i > 0 && B[j][i - 1]) || (i < W - 1 && B[j][i + 1]) || (j > 0 && B[j - 1][i]) || (j < H - 1 && B[j + 1][i])) out.push([i, j]);
  }
  for (const [i, j] of out) B[j][i] = TROPHY_OUT;
}
// ---------- the designs
const TROPHY_DRAW = {
  // LEAGUE CHAMPIONSHIP: the big one. A wide silver bowl on a tall banded barrel, on a dark wooden plinth with a gold plate
  league(G) {
    // a deep two-handled silver cup on a stepped silver pedestal (three tiers), on a wooden plinth with a gold plate
    const s = TMAT.silver;
    G.plinth(31, 5, 12, TMAT.wood, TMAT.gold);
    G.lathe(28, 30, () => 9.5, s); G.ring(28, 9.5, s[0]); G.ring(30, 9.5, s[4]);
    G.lathe(25, 27, () => 7.5, s); G.ring(25, 7.5, s[0]); G.ring(27, 7.5, s[4]);
    G.lathe(22, 24, () => 5.5, s); G.ring(22, 5.5, s[0]);
    for (let i = 9; i < 24; i += 3) G.set(i, 29, s[3]);                       // engraved names round the bottom tier
    G.lathe(18, 21, t => 2 + (t > 0.4 && t < 0.7 ? 1.2 : 0), s);
    G.lathe(4, 17, t => 9.5 - Math.pow(t, 2.2) * 7, s);                        // the deep bowl
    G.ring(4, 10.5, s[0]); G.ring(5, 9.5, s[4]); G.ring(6, 9, s[3]);
    G.ring(9, 9.3, s[3]); G.ring(10, 9.2, s[1]);
    G.star(16, 13, '#ffe27a', '#fff6c8');
    G.handle(6, 6, 11, -1, s); G.handle(25, 6, 11, 1, s);
    G.sparkle(10, 8);
  },
  // OPENING INVITATIONAL: a silver loving cup with two handles, a blue enamel band and a star
  inv(G) {
    const s = TMAT.silver;
    G.plinth(30, 6, 9, TMAT.onyx, TMAT.silver);
    G.lathe(27, 29, t => 4 + t * 2.5, s); G.ring(29, 6.5, s[3]);
    G.lathe(22, 26, () => 1.8, s);
    G.lathe(5, 21, t => t < 0.75 ? 8.5 - t * 1.5 : 7.4 - (t - 0.75) * 22, s);
    G.ring(5, 9.5, s[0]); G.ring(6, 8.5, s[4]);
    G.lathe(11, 14, () => 8.2, ['#7fb2ff', '#4a86e8', '#1f4f9a', '#163a74', '#0d2650']);  // the enamel band
    G.star(16, 12, '#ffe27a', '#fff6c8');
    G.handle(7, 7, 10, -1, s); G.handle(24, 7, 10, 1, s);
    G.sparkle(11, 8);
  },
  // MIDSEASON CLASSIC: a tall copper urn with a red sash, on a wooden plinth
  classic(G) {
    const c = TMAT.copper;
    G.plinth(30, 6, 10, TMAT.wood, TMAT.gold);
    G.lathe(26, 29, t => 4.5 + t * 2, c); G.ring(29, 6.5, c[3]);
    G.lathe(23, 25, () => 2, c);
    G.lathe(4, 22, t => 3.5 + Math.sin(Math.min(1, t * 1.15) * Math.PI) * 5.5 + (t < 0.12 ? (0.12 - t) * 20 : 0), c);
    G.ring(4, 6.5, c[0]); G.ring(5, 5.5, c[4]);
    G.lathe(13, 15, t => 3.5 + Math.sin(((13 + t * 2 - 4) / 18 / 1.15 + 0.0) * Math.PI) * 5.5, ['#ff8a80', '#e8483c', '#b8202a', '#8c1d22', '#5a0c10']);   // the sash
    G.set(16, 14, '#ffe27a'); G.set(15, 14, '#c8960f'); G.set(17, 14, '#c8960f');
    G.handle(6, 8, 9, -1, c); G.handle(25, 8, 9, 1, c);
    G.sparkle(12, 9);
  },
  // WINTER CUP: a cut-ice crystal spire with a snowflake frozen inside, on a silver base
  winter(G) {
    const s = TMAT.silver, ic = TMAT.ice;
    G.plinth(30, 6, 10, s, TMAT.ice);
    G.lathe(27, 29, t => 5 + t * 2, s);
    for (let j = 2; j <= 26; j++) {                         // the faceted crystal: a tall diamond, three facets wide
      const t = (j - 2) / 24, hw = t < 0.35 ? 1 + t / 0.35 * 7 : 8 - (t - 0.35) / 0.65 * 4.5;
      for (let i = Math.floor(16 - hw); i < Math.ceil(16 + hw); i++) {
        const u = (i + 0.5 - 16) / hw, col = u < -0.45 ? ic[1] : u < 0.05 ? ic[2] : u < 0.5 ? ic[3] : ic[4];
        G.set(i, j, col);
      }
    }
    for (let j = 3; j < 26; j++) G.set(16, j, ic[0]);                          // the facet edges
    for (let k = 0; k < 7; k++) { G.set(16 - 7 + k, 10 + (k > 3 ? k - 3 : 3 - k) * 0, ic[0]); }
    // the snowflake inside
    const fx = 16, fy = 12, w = '#ffffff';
    for (let k = -3; k <= 3; k++) { G.set(fx + k, fy, w); G.set(fx, fy + k, w); }
    for (let k = -2; k <= 2; k++) { G.set(fx + k, fy + k, w); G.set(fx + k, fy - k, w); }
    G.sparkle(12, 6); G.sparkle(20, 19);
  },
  // SEASON FINALE CUP: a tall gold chalice with a burgundy band and laurel at its foot
  finale(G) {
    const g = TMAT.gold;
    G.plinth(31, 5, 11, TMAT.onyx, TMAT.gold);
    G.lathe(26, 30, t => 3 + t * 5.5, g); G.ring(30, 8.5, g[3]);
    for (const [x, y] of [[9, 28], [10, 27], [11, 28], [22, 28], [21, 27], [20, 28], [8, 29], [23, 29]]) G.set(x, y, '#4f9a4a');   // laurel sprigs
    G.lathe(19, 25, t => 1.8 + (t > 0.45 && t < 0.6 ? 1.5 : 0), g);
    G.lathe(3, 18, t => 9 - Math.pow(t, 1.6) * 7, g);
    G.ring(3, 9.5, g[0]); G.ring(4, 8.5, g[4]);
    G.lathe(9, 11, t => 9 - Math.pow((6 + t * 2) / 15, 1.6) * 7, ['#e07a94', '#b8305a', '#8a1a3c', '#6b1530', '#2e0814']);
    G.star(16, 15, '#fff6c8', '#ffffff');
    G.sparkle(11, 7);
  },
  // TOURNAMENT OF CHAMPIONS: a black obelisk edged in gold, crowned
  toc(G) {
    const g = TMAT.gold, o = TMAT.onyx;
    G.plinth(31, 5, 11, o, TMAT.gold);
    G.lathe(28, 30, () => 8.5, g); G.ring(28, 8.5, g[0]);
    for (let j = 9; j <= 27; j++) { const hw = 4 + (j - 9) / 18 * 3; G.row(j, hw, o); G.set(Math.floor(16 - hw), j, g[2]); G.set(Math.ceil(16 + hw) - 1, j, g[3]); }
    G.rect(14, 15, 4, 8, g[3]); G.rect(14, 15, 4, 1, g[1]); G.rect(15, 16, 2, 6, g[2]);   // a gold inlay down the face
    // the crown
    G.lathe(6, 8, () => 6, g); G.ring(6, 6, g[1]);
    for (const x of [10, 13, 16, 19, 21]) { G.set(x, 5, g[2]); G.set(x, 4, g[1]); }
    G.set(10, 3, '#e0302a'); G.set(16, 3, '#2f6fe8'); G.set(21, 3, '#e0302a'); G.set(13, 4, g[0]); G.set(19, 4, g[0]);
    G.set(12, 7, '#e0302a'); G.set(16, 7, '#4fbf6a'); G.set(20, 7, '#2f6fe8');
    G.sparkle(11, 12);
  },
  // TOP SCORER: a gold stick and puck mounted at an angle over a wooden plinth
  stick(G, m = TMAT.gold) {
    G.plinth(29, 7, 11, TMAT.wood, m);
    G.lathe(26, 28, () => 2, m);
    for (let k = 0; k < 24; k++) { const x = 9 + k * 0.55, y = 3 + k; G.set(x, y, m[1]); G.set(x + 1, y, m[2]); G.set(x + 2, y, m[3]); }   // the shaft
    G.rect(20, 26, 7, 2, m[2]); G.rect(20, 26, 7, 1, m[1]); G.rect(21, 27, 6, 1, m[3]);                                               // the blade
    G.rect(10, 4, 3, 3, m[4]);                                                                                                           // the knob of tape
    G.lathe(22, 24, () => 3, TMAT.onyx); G.ring(22, 3, '#55556a');                                                                       // the puck
    G.sparkle(12, 9);
  },
  // MVP: a gold skater, stick raised, on a marble column
  mvp(G, m = TMAT.gold, base = TMAT.marble) {
    G.plinth(31, 5, 9, base, TMAT.gold);
    G.lathe(25, 30, t => 5 - Math.sin(t * Math.PI) * 1.2, base); G.ring(25, 5.5, base[1]); G.ring(30, 5.5, base[3]);
    trophyFigure(G, m, 'skater');
    G.sparkle(12, 8);
  },
  // PLAYOFF MVP: the gold figure, arms up, cup over his head, on a tiered black base
  pmvp(G) {
    G.plinth(31, 5, 10, TMAT.onyx, TMAT.gold);
    G.lathe(27, 30, t => 6 + t * 2, TMAT.gold); G.ring(27, 6, TMAT.gold[1]);
    trophyFigure(G, TMAT.gold, 'cheer');
    G.sparkle(20, 7);
  },
  // TOP GOALIE: a gold catching glove, palm out, on a plinth
  glove(G, m = TMAT.gold) {
    G.plinth(30, 6, 10, TMAT.wood, m);
    G.lathe(26, 29, () => 3, m);
    const rows = ['......xxxxxx....', '....xxxxxxxxxx..', '..xxwwxxxxxxxxx.', '.xwwwwxxxxxxxxxx', '.xwwwwooooooxxxx', 'xxxwwooooooooxxx', 'xxxxooooooooooxx', 'xxxxooooooooooxx',
      '.xxxooooooooooxx', '.xxxxoooooooooxx', '..xxxxoooooooxx.', '...xxxxxxxxxxx..', '....cccccccccc..', '....cccccccccc..', '....cccccccccc..', '.....cccccccc...'];
    rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '.') return; const u = (i - 7.5) / 8;
      const col = ch === 'o' ? (u < -0.1 ? m[2] : m[3]) : ch === 'w' ? ((i + j) % 2 ? m[4] : m[2]) : ch === 'c' ? (j === 12 ? m[4] : G.shadeOf(u, m) === m[0] ? m[1] : G.shadeOf(u, m)) : G.shadeOf(u, m);
      G.set(8 + i, 6 + j, col); }));
    for (const [x, y] of [[13, 11], [15, 10], [17, 10], [19, 11], [20, 13], [13, 15], [16, 16], [19, 15]]) G.set(x, y, m[4]);     // the lacing round the pocket
    G.sparkle(11, 8);
  },
  // ROOKIE OF THE YEAR: a silver star on a slim stem
  rookie(G) {
    const s = TMAT.silver;
    G.plinth(30, 6, 9, TMAT.onyx, TMAT.silver);
    G.lathe(20, 29, t => 1.5 + t * t * 4, s);
    const pts = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 4.2 : 10; pts.push([16 + Math.cos(a) * r, 11 + Math.sin(a) * r]); }
    for (let j = 0; j < 22; j++) for (let i = 4; i < 28; i++) {
      let inside = false; for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) { const [xa, ya] = pts[a], [xb, yb] = pts[b]; if ((ya > j + 0.5) !== (yb > j + 0.5) && i + 0.5 < (xb - xa) * (j + 0.5 - ya) / (yb - ya) + xa) inside = !inside; }
      if (inside) G.set(i, j, G.shadeOf((i + 0.5 - 16) / 9 + (j - 11) / 30, s));
    }
    G.star(16, 11, '#9ec4ff', '#ffffff');
    G.sparkle(10, 6);
  },
  // BEST DEFENCEMAN: a gold shield with crossed silver sticks
  def(G) {
    const g = TMAT.gold, s = TMAT.silver;
    G.plinth(30, 6, 10, TMAT.wood, TMAT.gold);
    G.lathe(26, 29, () => 2.5, g);
    for (let j = 4; j <= 25; j++) { const t = (j - 4) / 21, hw = t < 0.55 ? 8.5 : 8.5 * Math.sqrt(Math.max(0, 1 - ((t - 0.55) / 0.45) ** 2)); if (hw > 0.4) G.row(j, hw, g); }
    G.ring(4, 8.5, g[0]); G.ring(5, 7.5, g[3]);
    for (let k = 0; k < 15; k++) { G.set(10 + k * 0.8, 8 + k, s[1]); G.set(22 - k * 0.8, 8 + k, s[3]); }
    G.rect(12, 21, 3, 1, s[2]); G.rect(18, 21, 3, 1, s[2]);
    G.sparkle(12, 8);
  },
};
// ---- the Awards Night trophies
Object.assign(TROPHY_DRAW, {
  // POINT LEADER: a gold puck standing on edge, a star cut into it, on a slim stem
  points(G) { const g = TMAT.gold;
    G.plinth(30, 6, 10, TMAT.wood, g); G.lathe(21, 29, t => 1.6 + t * t * 4, g);
    for (let j = 4; j <= 20; j++) { const t = (j - 12) / 8.5, hw = 8.5 * Math.sqrt(Math.max(0, 1 - t * t)); if (hw > 0.5) G.row(j, hw, g); }
    for (let j = 6; j <= 18; j += 3) G.ring(j, 8.5 * Math.sqrt(Math.max(0, 1 - ((j - 12) / 8.5) ** 2)), g[3]);
    G.star(16, 12, '#fff6c8', '#ffffff'); G.sparkle(11, 7); },
  // BEST DEFENCEMAN: a tall silver kite shield with a blue band and a gold D
  bestd(G) { const s = TMAT.silver;
    G.plinth(30, 6, 10, TMAT.onyx, TMAT.gold); G.lathe(26, 29, () => 2.5, s);
    for (let j = 3; j <= 25; j++) { const t = (j - 3) / 22, hw = t < 0.45 ? 8 : 8 * (1 - (t - 0.45) / 0.55) + 0.6; G.row(j, hw, s); }
    G.ring(3, 8, s[0]); G.lathe(8, 10, () => 8, ['#7fb2ff', '#4a86e8', '#1f4f9a', '#163a74', '#0d2650']);
    G.rect(14, 13, 2, 7, '#c8960f'); G.rect(16, 13, 2, 1, '#f2c230'); G.rect(16, 19, 2, 1, '#f2c230'); G.rect(18, 14, 1, 5, '#f2c230'); G.sparkle(11, 6); },
  // MOST IMPROVED: a gold arrow climbing out of a silver cup
  improved(G) { const s = TMAT.silver, g = TMAT.gold;
    G.plinth(30, 6, 10, TMAT.wood, g); G.lathe(26, 29, () => 2, s);
    G.lathe(16, 25, t => 7 - t * t * 5.5, s); G.ring(16, 7.5, s[0]);
    for (let j = 2; j <= 16; j++) { const hw = j < 8 ? (j - 1) * 1.1 : 2.2; G.row(j, hw, g); }
    G.sparkle(12, 5); },
  // IRON MAN: an iron anvil on a block, a gold band, a riveted plate
  iron(G) { const ir = TMAT.onyx.map((c, i) => ['#c8ccd6', '#8a90a0', '#5a6070', '#3e4352', '#262a34'][i]);
    G.plinth(30, 6, 11, TMAT.wood, TMAT.gold); G.lathe(23, 29, () => 4.5, ir); G.ring(25, 4.5, TMAT.gold[2]);
    G.lathe(16, 22, t => 5 + (t > 0.7 ? 3 * (t - 0.7) / 0.3 : 0), ir);
    G.lathe(10, 15, () => 10, ir); G.ring(10, 10, ir[0]); G.rect(26, 11, 4, 2, ir[2]); G.rect(28, 12, 3, 1, ir[3]);   // the horn
    G.set(11, 12, ir[0]); G.set(21, 12, ir[0]); G.sparkle(10, 11); },
  // THE HAMMER: a gold mallet, head up, on a heavy plinth
  hammer(G) { const g = TMAT.gold;
    G.plinth(29, 7, 11, TMAT.onyx, g); G.lathe(12, 28, () => 1.5, TMAT.wood);
    G.lathe(4, 11, () => 9, g); G.ring(4, 9, g[0]); G.ring(11, 9, g[4]); G.rect(7, 5, 1, 6, g[1]); G.rect(24, 5, 1, 6, g[3]); G.sparkle(10, 6); },
  // SPORTSMANSHIP: a silver laurel wreath round a white star
  sport(G) { const s = TMAT.silver;
    G.plinth(30, 6, 10, TMAT.marble, TMAT.gold); G.lathe(24, 29, () => 2, s);
    for (let k = 0; k < 28; k++) { const a = Math.PI * 0.62 + k / 27 * Math.PI * 1.76, x = 16 + Math.cos(a) * 9, y = 13 + Math.sin(a) * 10; G.set(x, y, k % 2 ? '#7fc87a' : '#4f9a4a'); G.set(x + Math.cos(a) * 1.3, y + Math.sin(a) * 1.3, '#bfe8b4'); }
    G.star(16, 13, '#ffffff', '#dfe8ff'); G.sparkle(20, 6); },
  // CLUTCH PERFORMER: a gold stopwatch with a lightning bolt
  clutch(G) { const g = TMAT.gold;
    G.plinth(30, 6, 10, TMAT.onyx, g); G.lathe(24, 29, () => 2, g);
    G.rect(15, 2, 2, 3, g[2]); G.rect(13, 1, 6, 1, g[1]);
    for (let j = 5; j <= 23; j++) { const t = (j - 14) / 9.5, hw = 9 * Math.sqrt(Math.max(0, 1 - t * t)); if (hw > 0.5) G.row(j, hw, g); }
    for (let j = 7; j <= 21; j++) { const t = (j - 14) / 7.5, hw = 7 * Math.sqrt(Math.max(0, 1 - t * t)); if (hw > 0.5) G.row(j, hw, ['#ffffff', '#f4f6fa', '#e4e8f0', '#c8ceda', '#a8b0c0']); }
    for (const [x, y] of [[17, 8], [16, 9], [15, 10], [14, 11], [15, 12], [16, 12], [17, 13], [16, 14], [15, 15], [14, 16], [15, 17], [16, 17], [17, 18]]) G.set(x, y, '#e0302a');
    G.sparkle(11, 8); },
  // COMEBACK PLAYER: a phoenix-orange cup with rising flames
  comeback(G) { const c = TMAT.copper;
    G.plinth(30, 6, 10, TMAT.wood, TMAT.gold); G.lathe(25, 29, t => 2 + t * 3, c); G.lathe(20, 24, () => 1.8, c);
    G.lathe(8, 19, t => 7.5 - t * t * 5.5, c); G.ring(8, 8, c[0]);
    for (const [x, y, col] of [[12, 6, '#ffb84a'], [13, 4, '#ff7a2a'], [16, 3, '#ffd23f'], [16, 5, '#ff7a2a'], [19, 4, '#ff7a2a'], [20, 6, '#ffb84a'], [15, 6, '#ffd23f'], [17, 6, '#ffd23f'], [16, 1, '#fff6c8']]) G.set(x, y, col);
    G.sparkle(11, 11); },
  // GM OF THE YEAR: a crystal plaque on a gold stand
  gmyear(G) { const ic = TMAT.ice;
    G.plinth(30, 6, 11, TMAT.onyx, TMAT.gold); G.lathe(26, 29, () => 6, TMAT.gold);
    for (let j = 3; j <= 25; j++) { const hw = j < 6 ? 4 + (j - 3) * 1.3 : 8; for (let i = Math.floor(16 - hw); i < Math.ceil(16 + hw); i++) { const u = (i + 0.5 - 16) / hw; G.set(i, j, u < -0.5 ? ic[1] : u < 0.2 ? ic[2] : ic[3]); } }
    G.rect(11, 10, 10, 1, ic[0]); G.rect(11, 13, 10, 1, ic[0]); G.rect(12, 16, 8, 1, ic[0]); G.star(16, 21, '#ffe27a', '#fff6c8'); G.sparkle(11, 6); },
});
// tournament awards: the season trophies in silver
TROPHY_DRAW.tmvp = G => TROPHY_DRAW.mvp(G, TMAT.silver, TMAT.onyx);
TROPHY_DRAW.tgoal = G => TROPHY_DRAW.glove(G, TMAT.silver);
TROPHY_DRAW.tscore = G => TROPHY_DRAW.stick(G, TMAT.silver);
// a little figure (skater with his stick up, or arms up holding a tiny cup), shaded as metal
function trophyFigure(G, m, pose) {
  const S = pose === 'cheer'
    ? ['..o.........o...', '..oo..ooo..oo...', '...o.ooooo.o....', '...oo.ooo.oo....', '....ooooooo.....', '.....ooooo......', '.....ooooo......', '....ooooooo.....', '....ooooooo.....', '.....ooooo......',
       '.....oo.oo......', '.....oo.oo......', '....ooo.ooo.....', '....oo...oo.....', '...ooo...ooo....']
    : ['..........o.....', '......ooo.o.....', '.....ooooo......', '......ooo.o.....', '....oooooo......', '...ooooooo......', '...o.ooooo......', '..o..ooooo......', '.o...ooooo......', '.....oo.oo......',
       '.....oo.oo......', '.....oo..oo.....', '....ooo..oo.....', '....oo...ooo....', '...ooo....oo....'];
  const ox = 8, oy = pose === 'cheer' ? 10 : 9;
  S.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '.') return; G.set(ox + i, oy + j, G.shadeOf((i - 7) / 5.5, m)); }));
  if (pose === 'cheer') { G.lathe(4, 8, t => 3 - t * 1.5, m, 16); G.ring(4, 3.5, m[0]); G.handle(12, 5, 3, -1, m); G.handle(19, 5, 3, 1, m); }   // the little cup overhead
  else { for (let k = 0; k < 9; k++) G.set(18 + k * 0.35, 1 + k, m[3]); G.rect(20, 9, 3, 1, m[2]); }      // the raised stick
}
// cache: one rendered grid per type
const TROPHY_CACHE = {};
function trophyBuilt(type) {
  if (TROPHY_CACHE[type]) return TROPHY_CACHE[type];
  const G = trophyGrid(), f = TROPHY_DRAW[type] || TROPHY_DRAW.league;
  f(G); trophyOutline(G);
  return (TROPHY_CACHE[type] = G.B);
}
// same signature and footprint as before: 16 x 18 units of ps at (x, y)
function drawTrophy(c, type, x, y, ps, glow) {
  const q = ps / 2, B = trophyBuilt(type);
  if (glow) {
    const g = c.createRadialGradient(x + 8 * ps, y + 9 * ps, ps, x + 8 * ps, y + 9 * ps, 13 * ps);
    g.addColorStop(0, 'rgba(255,240,170,.45)'); g.addColorStop(1, 'rgba(255,240,170,0)');
    c.fillStyle = g; c.fillRect(x - 6 * ps, y - 4 * ps, 28 * ps, 28 * ps);
  }
  if (q >= 1 && q === Math.round(q)) {
    for (let j = 0; j < B.length; j++) for (let i = 0; i < B[j].length; i++) { const col = B[j][i]; if (col) { c.fillStyle = col; c.fillRect(x + i * q, y + j * q, q, q); } }
    return;
  }
  // small sizes (a trophy shelf at 1 px): render the grid once and scale it down smoothly, instead of smearing half-pixels
  let cv = TROPHY_CACHE['cv_' + type];
  if (!cv && typeof document !== 'undefined') {
    cv = document.createElement('canvas'); cv.width = 32; cv.height = 36; const g = cv.getContext('2d');
    for (let j = 0; j < B.length; j++) for (let i = 0; i < B[j].length; i++) { const col = B[j][i]; if (col) { g.fillStyle = col; g.fillRect(i, j, 1, 1); } }
    TROPHY_CACHE['cv_' + type] = cv;
  }
  if (!cv) return;
  const sm = c.imageSmoothingEnabled; c.imageSmoothingEnabled = true; c.drawImage(cv, x, y, 16 * ps, 18 * ps); c.imageSmoothingEnabled = sm;
}

// a trophy not won yet: its silhouette, faint, for empty case spots and pedestals
function drawTrophyGhost(c, type, x, y, ps) {
  let cv = TROPHY_CACHE['gh_' + type];
  if (!cv && typeof document !== 'undefined') {
    const B = trophyBuilt(type); cv = document.createElement('canvas'); cv.width = 32; cv.height = 36; const g = cv.getContext('2d');
    for (let j = 0; j < B.length; j++) for (let i = 0; i < B[j].length; i++) if (B[j][i]) { g.fillStyle = B[j][i] === TROPHY_OUT ? 'rgba(150,170,230,.35)' : 'rgba(150,170,230,.12)'; g.fillRect(i, j, 1, 1); }
    TROPHY_CACHE['gh_' + type] = cv;
  }
  if (!cv) return;
  const sm = c.imageSmoothingEnabled; c.imageSmoothingEnabled = !(ps / 2 >= 1 && ps / 2 === Math.round(ps / 2)); c.drawImage(cv, x, y, 16 * ps, 18 * ps); c.imageSmoothingEnabled = sm;
}
