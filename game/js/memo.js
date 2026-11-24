'use strict';
// ====================================================================
//  MEMORABILIA: the cabinet pieces drawn properly (48 x 48 pixel art, outlined and shaded), and customized by the
//  player they honour. When a piece is earned he makes his own picks (his personality: tough guys go dark and
//  battered, showmen go gold, old-schoolers go vintage); you can open the piece any time and change it together,
//  with him telling you what he thinks of each choice.
//  item.custom holds the choices; memoCanvas(it, size) draws it (ui2.js hands over to memoArt here).
// ====================================================================
const MEMO_W = 48;
// tiny 3 x 5 pixel font for numbers and letters on jerseys, cuffs and plates
const MINI_FONT = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111',
  7: '111001010010010', 8: '111101111101111', 9: '111101111001111', C: '111100100100111', A: '010101111101101', M: '101111111101101', V: '101101101101010', P: '110101110100100', '#': '010111010111010',
};
function miniText(c, str, x, y, col, s = 1) {
  c.fillStyle = col; let cx = x;
  for (const ch of String(str)) { const g = MINI_FONT[ch]; if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') c.fillRect(cx + (i % 3) * s, y + Math.floor(i / 3) * s, s, s); cx += 4 * s; }
}
const miniW = (str, s = 1) => String(str).length * 4 * s - s;
function seedRng(str) { let h0 = 2166136261; for (const ch of String(str)) h0 = Math.imul(h0 ^ ch.charCodeAt(0), 16777619) >>> 0; return () => { h0 = Math.imul(h0 ^ (h0 >>> 15), 2246822507) >>> 0; h0 = Math.imul(h0 ^ (h0 >>> 13), 3266489909) >>> 0; return ((h0 ^= h0 >>> 16) >>> 0) / 4294967296; }; }
// draw onto a fresh canvas, then give everything a 1-pixel dark outline (the polished pixel-art edge)
function memoLayer(draw, outline = '#0b0d18') {
  const cv = document.createElement('canvas'); cv.width = MEMO_W; cv.height = MEMO_W; const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  draw(c);
  if (outline) {
    const id = c.getImageData(0, 0, MEMO_W, MEMO_W), d = id.data, o = new Uint8ClampedArray(d), [or, og, ob] = hexRgb(outline);
    for (let y = 0; y < MEMO_W; y++) for (let x = 0; x < MEMO_W; x++) {
      const i = (y * MEMO_W + x) * 4; if (d[i + 3] > 20) continue;
      if ((x > 0 && d[i - 1] > 20) || (x < MEMO_W - 1 && d[i + 7] > 20) || (y > 0 && d[i - MEMO_W * 4 + 3] > 20) || (y < MEMO_W - 1 && d[i + MEMO_W * 4 + 3] > 20)) { o[i] = or; o[i + 1] = og; o[i + 2] = ob; o[i + 3] = 255; }
    }
    id.data.set(o); c.putImageData(id, 0, 0);
  }
  return cv;
}
// scuffs and wear on whatever is painted inside a box (only on painted pixels)
function memoWear(c, x0, y0, w, hh, n, rng) {
  const id = c.getImageData(x0, y0, w, hh), d = id.data;
  for (let k = 0; k < n; k++) {
    const x = Math.floor(rng() * w), y = Math.floor(rng() * hh), i = (y * w + x) * 4; if (d[i + 3] < 200) continue;
    const lift = rng() < 0.55 ? 0.35 : -0.35;
    const col = hexRgb(shade(rgbHex(d[i], d[i + 1], d[i + 2]), lift));
    for (const [dx, dy] of [[0, 0], [rng() < 0.5 ? 1 : 0, 0]]) { const j = ((y + dy) * w + Math.min(w - 1, x + dx)) * 4; if (d[j + 3] > 200) { d[j] = col[0]; d[j + 1] = col[1]; d[j + 2] = col[2]; } }
  }
  c.putImageData(id, x0, y0);
}
// a player's autograph: a quick, loopy line (silver marker on dark things, black marker on light ones)
function memoSig(c, x, y, w, col, rng, slope = 0) {
  c.fillStyle = col; let py = y;
  for (let i = 0; i < w; i++) {
    const yy = Math.round(y + Math.sin(i * 0.95 + rng() * 0.6) * 1.6 + i * slope);
    c.fillRect(x + i, yy, 1, 1); if (Math.abs(yy - py) > 1) c.fillRect(x + i, Math.min(yy, py) + 1, 1, Math.abs(yy - py) - 1); py = yy;
    if (i === 2 || i === Math.floor(w * 0.6)) c.fillRect(x + i, yy - 3, 1, 3);
  }
  c.fillRect(x + 1, y + 3 + Math.round(w * slope * 0.5), Math.max(3, Math.floor(w * 0.7)), 1);   // the underline
}
const sigCol = bg => lum(bg) > 0.55 ? '#1b1c22' : '#e8ecf2';
const METALS = { gold: ['#ffd23f', '#c99a10', '#fff3a0'], silver: ['#d4d9e2', '#8a93a3', '#ffffff'], bronze: ['#d08a4a', '#8a5222', '#f4c08a'], rose: ['#f0a890', '#b86a5a', '#ffd8c8'], black: ['#3a3d46', '#1b1c22', '#7d8696'] };
const WOODS = { oak: ['#b07a40', '#7a4a22'], walnut: ['#6e4424', '#46280f'], ebony: ['#2e2a2a', '#161414'], black: ['#26282f', '#121318'], gold: ['#e6b800', '#9a7400'], marble: ['#e8e8ee', '#a8acb8'] };

// ---------- what can be customized on each kind of piece
const MEMO_COLS = ['team', 'dark', 'trim', '#f4f4f4', '#1b1c22', '#3a3d46', '#e0302a', '#8a1820', '#ff8a1f', '#ffd23f', '#3ad15a', '#2f6fe8', '#1b2a5c', '#7a2ad0', '#7a4a22', '#c9955a'];
const MEMO_OPTS = {
  gloves: [['main', 'GLOVE', 'col'], ['cuff', 'CUFF', 'col'], ['acc', 'STRIPE', 'col'], ['tape', 'WRIST TAPE', ['none', 'white', 'black', 'red', 'gold']], ['wear', 'WEAR', ['clean', 'worn', 'battered']], ['num', 'NUMBER', ['on', 'off']], ['sig', 'AUTOGRAPH', ['on', 'off']], ['show', 'DISPLAY', ['shelf', 'case', 'title belt']]],
  jersey: [['style', 'STYLE', ['home', 'away', 'throwback']], ['main', 'BODY', 'col'], ['second', 'STRIPES', 'col'], ['trim', 'NUMBER', 'col'], ['letter', 'LETTER', ['none', 'C', 'A']], ['sig', 'AUTOGRAPH', ['on', 'off']], ['frame', 'FRAME', ['oak', 'black', 'gold']]],
  stick: [['shaft', 'BOOT', ['wood', 'carbon', 'white', 'team', 'gold']], ['art', 'GRAPHIC', ['solid', 'two-tone', 'stripes', 'flames']], ['acc', 'GRAPHIC COLOUR', 'col'], ['tape', 'LACES', ['white', 'black', 'candy', 'gold', 'team']], ['knob', 'STUDS', ['white', 'black', 'red', 'team']], ['sig', 'AUTOGRAPH', ['on', 'off']], ['mount', 'MOUNT', ['plaque', 'rack', 'none']]],
  capstick: [['shaft', 'BOOT', ['wood', 'carbon', 'white', 'team', 'gold']], ['art', 'GRAPHIC', ['solid', 'two-tone', 'stripes', 'flames']], ['acc', 'GRAPHIC COLOUR', 'col'], ['tape', 'LACES', ['white', 'black', 'candy', 'gold', 'team']], ['knob', 'STUDS', ['white', 'black', 'red', 'team']], ['sig', 'AUTOGRAPH', ['on', 'off']], ['mount', 'MOUNT', ['plaque', 'rack', 'none']]],
  mask: [['design', 'DESIGN', 'mask'], ['L', 'LEFT HALF', 'col'], ['R', 'RIGHT HALF', 'col'], ['ridge', 'STRIPE', 'col'], ['sig', 'AUTOGRAPH', ['on', 'off']], ['stand', 'STAND', ['oak', 'black', 'gold', 'case']]],
  puck: [['finish', 'FINISH', ['gold', 'silver', 'black']], ['case', 'CASE', ['glass', 'none']], ['base', 'BASE', ['oak', 'black', 'marble']], ['sig', 'AUTOGRAPH', ['on', 'off']]],
  banner: [['main', 'BANNER', 'col'], ['second', 'BAND', 'col'], ['trim', 'TRIM', 'col'], ['emblem', 'EMBLEM', ['star', 'cup', 'crown', 'puck']], ['metal', 'HARDWARE', ['gold', 'silver']]],
  ring: [['band', 'BAND', ['gold', 'silver', 'rose', 'black']], ['stone', 'STONE', 'col'], ['halo', 'DIAMOND HALO', ['on', 'off']], ['num', 'NUMBER', ['on', 'off']]],
  plaque: [['wood', 'WOOD', ['oak', 'walnut', 'ebony']], ['metal', 'METAL', ['gold', 'silver', 'bronze']], ['sig', 'AUTOGRAPH', ['on', 'off']]],
};
const memoKindOf = it => it.kind === 'capstick' ? 'capstick' : it.icon === 'stick' ? 'stick' : it.kind;
function memoDefaults(it) {
  switch (memoKindOf(it)) {
    case 'gloves': return { main: 'team', cuff: 'dark', acc: 'trim', tape: 'none', wear: 'worn', num: 'on', sig: 'on', show: 'shelf' };
    case 'jersey': return { style: 'home', main: 'team', second: 'dark', trim: 'trim', letter: 'none', sig: 'on', frame: 'oak' };
    case 'stick': return { shaft: 'carbon', art: 'two-tone', acc: 'team', tape: 'white', knob: 'white', sig: 'on', mount: 'plaque' };
    case 'capstick': return { shaft: 'wood', art: 'stripes', acc: 'team', tape: 'gold', knob: 'team', sig: 'on', mount: 'plaque' };
    case 'mask': return { design: null, L: null, R: null, ridge: null, sig: 'on', stand: 'oak' };
    case 'puck': return { finish: 'gold', case: 'glass', base: 'oak', sig: 'off' };
    case 'banner': return { main: 'team', second: 'dark', trim: 'trim', emblem: 'star', metal: 'gold' };
    case 'ring': return { band: 'gold', stone: 'team', halo: 'on', num: 'off' };
    case 'plaque': return { wood: 'walnut', metal: 'gold', sig: 'on' };
  }
  return {};
}
// a piece nobody has customized yet shows its player's own picks
function memoCustomOf(it) {
  if (it.custom) return Object.assign(memoDefaults(it), it.custom);
  try { const p = it.pid && typeof UI !== 'undefined' && UI.save ? UI.save.players[it.pid] : null; return memoAutoPick(it, p, 0); } catch (e) { return memoDefaults(it); }
}
function memoTeamCols(it) { const c = it.colors || { p: '#ffd23f', s: '#333344', a: '#ffffff' }; return { team: c.p, dark: c.s, trim: c.a || '#ffffff' }; }
const memoCol = (it, v, fb) => { if (!v) return fb; const T0 = memoTeamCols(it); return T0[v] || v; };

// ---------- the art
function memoArt(it, size = 48) {
  const cv = h('canvas', { width: MEMO_W, height: MEMO_W, class: 'px' }); cv.style.width = size + 'px'; cv.style.height = size + 'px';
  const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  try { memoDraw(c, it); } catch (e) { console.warn('memo art', e); }
  return cv;
}
function memoDraw(c, it) {
  const o = memoCustomOf(it), rng = seedRng(it.id || it.name || 'x'), TC = memoTeamCols(it);
  const R = (cc, x, y, w, hh, col) => { cc.fillStyle = col; cc.fillRect(x, y, w, hh); };
  const put = l => c.drawImage(l, 0, 0);
  switch (memoKindOf(it)) {
    case 'gloves': {
      const main = memoCol(it, o.main, TC.team), cuff = memoCol(it, o.cuff, TC.dark), acc = memoCol(it, o.acc, TC.trim);
      const tape = { white: '#eef1f6', black: '#1f2028', red: '#d0302a', gold: '#ffd23f' }[o.tape];
      if (o.show === 'case') { R(c, 2, 4, 44, 38, 'rgba(180,220,255,.13)'); }
      const glove = (flip) => memoLayer(g => {
        const mD = darker(main, 0.28), mL = shade(main, 0.22);
        // fingers: four padded rolls, rounded tops, the knuckle breaks
        for (let f = 0; f < 4; f++) { const fx = 3 + f * 3; R(g, fx, 6, 3, 12, main); R(g, fx, 5, 3, 1, f === 0 || f === 3 ? 'rgba(0,0,0,0)' : main); R(g, fx + 1, 5, 1, 1, main); R(g, fx + 2, 6, 1, 12, mD); R(g, fx, 6, 1, 3, mL); }
        R(g, 3, 4 + 1, 1, 1, main); R(g, 14, 6, 1, 12, mD);
        for (const ky of [10, 14]) { R(g, 3, ky, 12, 1, mD); R(g, 3, ky + 1, 12, 1, mL); }
        if (tape) { R(g, 3, 11, 12, 2, tape); R(g, 3, 11, 12, 1, shade(tape, 0.3)); for (let x = 4; x < 15; x += 3) R(g, x, 12, 1, 1, darker(tape, 0.25)); }
        // thumb on the inside edge
        R(g, 15, 14, 3, 9, main); R(g, 15, 14, 1, 9, mL); R(g, 17, 15, 1, 8, mD); R(g, 15, 18, 3, 1, mD);
        // backhand: two padded rolls
        R(g, 2, 18, 14, 9, main); R(g, 2, 18, 14, 1, mL); R(g, 2, 21, 14, 1, mD); R(g, 2, 22, 14, 1, mL); R(g, 2, 25, 14, 1, mD); R(g, 15, 18, 1, 9, mD);
        R(g, 2, 26, 14, 2, acc); R(g, 2, 26, 14, 1, shade(acc, 0.25));
        // cuff, flaring a little, its roll and the open end
        R(g, 1, 28, 16, 7, cuff); R(g, 0, 35, 18, 4, cuff); R(g, 1, 28, 16, 1, shade(cuff, 0.25)); R(g, 1, 33, 16, 1, darker(cuff, 0.2)); R(g, 16, 29, 1, 10, darker(cuff, 0.25));
        R(g, 0, 36, 18, 1, acc); R(g, 2, 39, 14, 1, '#141824'); R(g, 3, 40, 12, 1, '#141824');
        if (o.wear !== 'clean') { memoWear(g, 2, 5, 16, 23, o.wear === 'battered' ? 46 : 18, rng); if (o.wear === 'battered') { R(g, 6, 20, 1, 4, '#2a1a10'); R(g, 7, 21, 1, 1, '#eef1f6'); R(g, 7, 23, 1, 1, '#eef1f6'); R(g, 11, 8, 1, 2, darker(main, 0.5)); } }
        if (flip) { const t0 = document.createElement('canvas'); t0.width = MEMO_W; t0.height = MEMO_W; t0.getContext('2d').drawImage(g.canvas, 0, 0); g.clearRect(0, 0, MEMO_W, MEMO_W); g.save(); g.translate(MEMO_W, 0); g.scale(-1, 1); g.drawImage(t0, 0, 0); g.restore(); }
        if (o.num === 'on' && it.num != null) { const s0 = String(it.num), cx = flip ? MEMO_W - 9 : 9; miniText(g, s0, cx - Math.floor(miniW(s0) / 2), 29, acc); }
      }, darker(main, 0.6));
      const gy = o.show === 'title belt' ? -2 : 0;
      c.save(); c.translate(3, gy); put(glove(false)); c.restore();
      c.save(); c.translate(-3, gy); put(glove(true)); c.restore();
      if (o.sig === 'on') memoSig(c, 7, 22 + gy, 11, sigCol(main), rng, -0.15);
      if (o.show === 'shelf') { R(c, 1, 41, 46, 3, '#8a5a2b'); R(c, 1, 41, 46, 1, '#b07a40'); R(c, 1, 44, 46, 1, '#46280f'); R(c, 4, 45, 2, 2, '#46280f'); R(c, 42, 45, 2, 2, '#46280f'); }
      else if (o.show === 'case') { R(c, 1, 42, 46, 4, '#26282f'); R(c, 1, 42, 46, 1, '#4a4f5c'); c.fillStyle = 'rgba(200,235,255,.7)'; c.fillRect(2, 3, 44, 1); c.fillRect(2, 3, 1, 39); c.fillRect(45, 3, 1, 39); c.fillStyle = 'rgba(255,255,255,.5)'; for (let k = 0; k < 9; k++) c.fillRect(6 + k, 6 + k, 1, 1); }
      else { // the title belt under the gloves
        put(memoLayer(g => { R(g, 1, 39, 46, 5, '#1b1c22'); R(g, 1, 40, 46, 1, '#3a3d46'); for (let x = 3; x < 46; x += 4) R(g, x, 42, 1, 1, '#c99a10');
          R(g, 15, 35, 18, 12, '#ffd23f'); R(g, 15, 35, 18, 1, '#fff3a0'); R(g, 32, 36, 1, 11, '#c99a10'); R(g, 15, 46, 18, 1, '#c99a10'); R(g, 17, 37, 14, 8, '#c99a10'); R(g, 18, 38, 12, 6, '#ffd23f');
          R(g, 23, 39, 2, 2, '#e0302a'); R(g, 23, 39, 1, 1, '#ff8a8a'); R(g, 13, 37, 2, 8, '#e6b800'); R(g, 33, 37, 2, 8, '#e6b800'); }, '#0b0d18'));
      }
      break;
    }
    case 'jersey': {
      const away = o.style === 'away', thr = o.style === 'throwback';
      let main = memoCol(it, o.main, TC.team), second = memoCol(it, o.second, TC.dark), trim = memoCol(it, o.trim, TC.trim);
      if (away) { second = main; main = '#f4f4f4'; } if (thr) { second = main; main = '#efe6cc'; }
      const W0 = WOODS[o.frame] || WOODS.oak;
      R(c, 0, 0, 48, 48, W0[1]); R(c, 1, 1, 46, 46, W0[0]); R(c, 1, 1, 46, 1, shade(W0[0], 0.25)); R(c, 1, 1, 1, 46, shade(W0[0], 0.15)); R(c, 4, 4, 40, 40, '#12152a'); R(c, 4, 4, 40, 1, '#05060c');
      put(memoLayer(g => {
        const mD = darker(main, 0.14);
        // sleeves spread wide, the body, the shoulder yoke
        for (let y = 11; y < 26; y++) { const x0 = 6 + Math.floor((y - 11) / 3); R(g, x0, y, 13 - x0 + 1, 1, main); R(g, 47 - 13 - 1, y, 13 - x0 + 1, 1, main); }
        R(g, 13, 10, 22, 32, main); R(g, 30, 12, 5, 30, mD);
        for (let y = 11; y < 26; y++) { const x0 = 6 + Math.floor((y - 11) / 3); R(g, x0 + 2, y, 2, 1, second); R(g, 47 - x0 - 4, y, 2, 1, second); R(g, x0 + 4, y, 1, 1, trim); R(g, 47 - x0 - 5, y, 1, 1, trim); }
        R(g, 9, 24, 5, 2, second); R(g, 34, 24, 5, 2, second);                                                                  // cuffs
        R(g, 13, 34, 22, 4, second); R(g, 13, 34, 22, 1, trim); R(g, 13, 37, 22, 1, trim);                                         // hem stripes
        R(g, 13, 10, 22, 2, thr ? main : second); R(g, 19, 10, 10, 1, trim);                                                     // yoke
        if (thr) { R(g, 21, 10, 6, 5, '#12152a'); for (let k = 0; k < 4; k++) { R(g, 21 + (k % 2 ? 4 : 1), 11 + k, 1, 1, '#c9955a'); } R(g, 22, 12, 4, 1, '#c9955a'); }
        else { R(g, 21, 10, 6, 1, '#12152a'); R(g, 22, 11, 4, 1, '#12152a'); R(g, 23, 12, 2, 1, '#12152a'); R(g, 20, 10, 1, 1, trim); R(g, 27, 10, 1, 1, trim); R(g, 21, 11, 1, 1, trim); R(g, 26, 11, 1, 1, trim); R(g, 22, 12, 1, 1, trim); R(g, 25, 12, 1, 1, trim); R(g, 23, 13, 2, 1, trim); }
        // the number: big, trimmed
        if (it.num != null) { const s = String(it.num), w = miniW(s, 2), nx = 24 - Math.floor(w / 2), ny = 18;
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) miniText(g, s, nx + dx, ny + dy, second, 2); miniText(g, s, nx, ny, trim, 2); }
        if (o.letter !== 'none') { miniText(g, o.letter, 15, 13, second); miniText(g, o.letter, 14, 13, trim); }
      }, '#05060c'));
      if (o.sig === 'on') memoSig(c, 15, 31, 17, sigCol(main), rng, -0.08);
      R(c, 18, 44, 12, 2, '#ffd23f'); R(c, 18, 44, 12, 1, '#fff3a0');                                                           // brass plate
      break;
    }
    case 'stick': case 'capstick': {
      const cap = memoKindOf(it) === 'capstick';
      const shaft = { wood: '#c98a4a', carbon: '#3a3e4a', white: '#eef1f6', team: TC.team, gold: '#e6b800' }[o.shaft] || '#3a3e4a';
      const acc = memoCol(it, o.acc, TC.team), tapeC = { white: '#eef1f6', black: '#1f2028', candy: '#eef1f6', gold: '#ffd23f', team: TC.team }[o.tape];
      const knob = { white: '#eef1f6', black: '#1f2028', red: '#d0302a', team: TC.team }[o.knob];
      if (o.mount === 'plaque') { const W0 = WOODS.walnut; put(memoLayer(g => { R(g, 3, 5, 42, 40, W0[0]); R(g, 3, 5, 42, 1, shade(W0[0], 0.3)); R(g, 3, 5, 1, 40, shade(W0[0], 0.15)); R(g, 44, 6, 1, 39, W0[1]); R(g, 3, 44, 42, 1, W0[1]); R(g, 6, 8, 36, 34, darker(W0[0], 0.12)); }, '#1a0e05')); }
      if (o.mount === 'rack') { R(c, 8, 4, 32, 3, '#6e4424'); R(c, 8, 4, 32, 1, '#a8703a'); R(c, 34, 7, 3, 3, '#c8a03a'); R(c, 12, 7, 3, 3, '#c8a03a'); }
      put(memoLayer(g => {
        // SOCCER: a boot, side on (toe to the left): upper in the BOOT colour, the graphic as a side swoosh, laces, studs
        const up = shaft, dk = darker(shaft, 0.25), hi = shade(shaft, 0.28);
        R(g, 26, 10, 12, 6, up); R(g, 26, 10, 12, 1, hi); R(g, 37, 10, 1, 6, dk);        // the collar / ankle
        R(g, 12, 16, 26, 12, up); R(g, 8, 20, 6, 8, up); R(g, 6, 23, 4, 5, up);         // the upper, down to the toe
        R(g, 12, 16, 26, 1, hi); R(g, 8, 20, 4, 1, hi); R(g, 38, 11, 1, 17, dk);
        if (o.art === 'two-tone') R(g, 6, 24, 18, 4, acc);
        if (o.art === 'stripes') for (let k = 0; k < 3; k++) R(g, 24 + k * 4, 17, 2, 10, acc);
        if (o.art === 'flames') for (let x = 10; x < 30; x += 4) { R(g, x, 25, 2, 3, acc); R(g, x + 1, 23, 1, 2, '#ffd23f'); }
        if (o.art === 'solid') R(g, 16, 21, 14, 2, acc);
        R(g, 6, 28, 33, 3, darker(shaft, 0.45)); R(g, 6, 28, 33, 1, darker(shaft, 0.3)); // the sole
        if (knob) for (let x = 8; x < 38; x += 6) R(g, x, 31, 3, 2, knob);              // studs
        if (tapeC) { for (let k = 0; k < 5; k++) R(g, 16 + k * 3, 15 + (k % 2), 2, 1, tapeC); if (o.tape === 'candy') R(g, 19, 15, 1, 1, '#d0302a'); }   // laces
        if (cap) { R(g, 30, 11, 5, 5, TC.trim); miniText(g, 'C', 31, 11, TC.team); }
      }, '#0b0d18'));
      if (o.sig === 'on') { const sc = sigCol(shaft); c.fillStyle = sc; for (let x = 14; x < 30; x++) c.fillRect(x, 19 + Math.round(Math.sin(x * 1.3) * 1.2), 1, 1); }
      if (o.mount === 'plaque') { const tx = '#' + (it.num != null ? it.num : ''), pw = Math.max(9, miniW(tx) + 4); R(c, 40 - pw, 36, pw, 7, '#ffd23f'); R(c, 40 - pw, 36, pw, 1, '#fff3a0'); R(c, 40 - pw, 42, pw, 1, '#9a7400'); if (it.num != null) miniText(c, tx, 42 - pw, 37, '#6a4a00'); }
      break;
    }
    case 'mask': {
      const C = memoMaskPalette(it), G = memoMaskGear(it, o);
      const stand = o.stand;
      if (stand === 'case') { R(c, 4, 2, 40, 40, 'rgba(180,220,255,.12)'); }
      // the stand: a post and a base with the brass nameplate
      const W0 = stand === 'gold' ? WOODS.gold : stand === 'black' || stand === 'case' ? WOODS.black : WOODS.oak;
      put(memoLayer(g => { R(g, 21, 34, 6, 6, W0[1]); R(g, 22, 34, 2, 6, W0[0]); R(g, 9, 40, 30, 6, W0[0]); R(g, 9, 40, 30, 1, shade(W0[0], 0.3)); R(g, 9, 45, 30, 1, W0[1]); R(g, 15, 40, 18, 7, '#ffd23f'); R(g, 15, 40, 18, 1, '#fff3a0'); R(g, 15, 46, 18, 1, '#9a7400');
        if (it.num != null) miniText(g, '#' + it.num, 24 - Math.floor(miniW('#' + it.num) / 2), 41, '#6a4a00'); }, '#0b0d18'));
      drawMaskAt(c, G, C, 3, 3, -5);
      if (o.sig === 'on') { const sp = maskSpec(G.mask === 'team' ? 'split' : G.mask, C, G); memoSig(c, 11, 11, 9, sigCol(sp.L), rng, -0.15); }
      if (stand === 'case') { c.fillStyle = 'rgba(200,235,255,.7)'; c.fillRect(4, 2, 40, 1); c.fillRect(4, 2, 1, 38); c.fillRect(43, 2, 1, 38); c.fillStyle = 'rgba(255,255,255,.45)'; for (let k = 0; k < 8; k++) c.fillRect(8 + k, 5 + k, 1, 1); }
      break;
    }
    case 'puck': {
      const M0 = METALS[o.finish] || METALS.gold, B0 = WOODS[o.base] || WOODS.oak;
      if (o.case === 'glass') R(c, 9, 6, 30, 31, 'rgba(180,220,255,.12)');
      put(memoLayer(g => {
        R(g, 7, 37, 34, 8, B0[0]); R(g, 7, 37, 34, 2, shade(B0[0], 0.3)); R(g, 7, 44, 34, 1, B0[1]); R(g, 40, 38, 1, 7, B0[1]);
        if (o.base === 'marble') for (const [x, y] of [[10, 40], [14, 42], [27, 39], [33, 41], [36, 43]]) R(g, x, y, 2, 1, '#c4c8d4');
        R(g, 17, 40, 14, 3, '#ffd23f'); R(g, 17, 40, 14, 1, '#fff3a0');
        if (it.year) miniText(g, String(it.year), 24 - Math.floor(miniW(String(it.year)) / 2), 39, '#6a4a00');
        // the cradle and the puck on its edge-on tilt: side band, then the top face
        R(g, 19, 32, 10, 5, '#2a2c34'); R(g, 19, 32, 10, 1, '#4a4f5c');
        const cx = 24, cy = 21, rx = 12.5, ry = 5, th = 7;
        for (let x = -12; x <= 12; x++) {
          const hf = ry * Math.sqrt(Math.max(0, 1 - ((x + 0.5) / rx) ** 2)), yT = Math.round(cy - hf), yB = Math.round(cy + hf);
          const sideC = x < -6 ? shade(M0[1], 0.18) : x > 6 ? darker(M0[1], 0.2) : M0[1];
          R(g, cx + x, yB, 1, th, sideC); R(g, cx + x, yB + 2, 1, 1, darker(sideC, 0.25)); R(g, cx + x, yB + th - 2, 1, 1, darker(sideC, 0.25));   // the grip band
          R(g, cx + x, yT, 1, yB - yT + 1, M0[0]);
          if (x < -2 && x > -10) R(g, cx + x, yT + 1, 1, 1, M0[2]);
        }
        // a star stamped in the middle of the top face
        const sc = darker(M0[0], 0.22); R(g, 23, 18, 2, 6, sc); R(g, 20, 20, 8, 1, sc); R(g, 21, 21, 6, 1, sc); R(g, 21, 22, 2, 1, sc); R(g, 25, 22, 2, 1, sc);
      }, '#0b0d18'));
      if (o.sig === 'on') memoSig(c, 16, 28, 15, sigCol(M0[1]), rng, 0);
      if (o.case === 'glass') { c.fillStyle = 'rgba(200,235,255,.7)'; c.fillRect(9, 6, 30, 1); c.fillRect(9, 6, 1, 31); c.fillRect(38, 6, 1, 31); c.fillStyle = 'rgba(255,255,255,.45)'; for (let k = 0; k < 8; k++) c.fillRect(12 + k, 9 + k, 1, 1); }
      break;
    }
    case 'banner': {
      const main = memoCol(it, o.main, TC.team), second = memoCol(it, o.second, TC.dark), trim = memoCol(it, o.trim, TC.trim), M0 = METALS[o.metal] || METALS.gold;
      put(memoLayer(g => {
        R(g, 4, 3, 40, 3, M0[1]); R(g, 4, 3, 40, 1, M0[2]); R(g, 3, 2, 2, 5, M0[0]); R(g, 43, 2, 2, 5, M0[0]);
        R(g, 12, 6, 2, 2, M0[1]); R(g, 34, 6, 2, 2, M0[1]);
        // the banner: body, the swallow-tail point, the trim, the band at the top
        R(g, 9, 8, 30, 28, main);
        for (let k = 0; k < 8; k++) R(g, 9 + k * 2, 36 + k, 30 - k * 4, 1, main);
        R(g, 9, 8, 2, 28, trim); R(g, 37, 8, 2, 28, trim); for (let k = 0; k < 8; k++) { R(g, 9 + k * 2, 36 + k, 2, 1, trim); R(g, 37 - k * 2, 36 + k, 2, 1, trim); }
        R(g, 11, 8, 26, 5, second); R(g, 11, 12, 26, 1, trim); for (let x = 13; x < 35; x += 3) R(g, x, 10, 2, 1, trim);
        R(g, 34, 13, 3, 23, darker(main, 0.15));
        // the emblem
        const gC = M0[0], gD = M0[1], ex = 24, ey = 20;
        if (o.emblem === 'cup') { R(g, ex - 5, ey - 4, 10, 6, gC); R(g, ex - 7, ey - 3, 2, 3, gC); R(g, ex + 5, ey - 3, 2, 3, gC); R(g, ex - 1, ey + 2, 2, 3, gD); R(g, ex - 3, ey + 5, 6, 2, gC); R(g, ex - 4, ey - 4, 2, 4, M0[2]); }
        else if (o.emblem === 'crown') { R(g, ex - 6, ey - 1, 12, 5, gC); for (const dx of [-6, -1, 4]) R(g, ex + dx, ey - 5, 2, 4, gC); R(g, ex - 6, ey + 3, 12, 1, gD); R(g, ex - 1, ey + 1, 2, 2, '#e0302a'); R(g, ex - 5, ey + 1, 1, 1, '#7ad0ff'); R(g, ex + 4, ey + 1, 1, 1, '#7ad0ff'); }
        else if (o.emblem === 'puck') { R(g, ex - 6, ey - 2, 12, 5, '#1b1c22'); R(g, ex - 6, ey - 3, 12, 2, '#3a3d46'); R(g, ex - 2, ey - 3, 4, 1, gC); R(g, ex + 6, ey - 6, 2, 9, gC); R(g, ex + 5, ey + 2, 4, 2, gC); }
        else { R(g, ex - 1, ey - 6, 2, 3, gC); R(g, ex - 6, ey - 3, 12, 2, gC); R(g, ex - 4, ey - 1, 8, 2, gC); R(g, ex - 4, ey + 1, 3, 2, gC); R(g, ex + 1, ey + 1, 3, 2, gC); R(g, ex - 5, ey + 3, 2, 1, gC); R(g, ex + 3, ey + 3, 2, 1, gC); R(g, ex - 1, ey - 4, 1, 3, M0[2]); }
        const yr = it.year ? String(it.year) : ''; if (yr) miniText(g, yr, 24 - Math.floor(miniW(yr) / 2), 29, trim);
      }, '#0b0d18'));
      break;
    }
    case 'ring': {
      const M0 = METALS[o.band] || METALS.gold, stone = memoCol(it, o.stone, TC.team);
      put(memoLayer(g => {
        // the band behind, then the face
        for (let y = 20; y < 46; y++) for (let x = 8; x < 40; x++) { const d = Math.hypot((x - 23.5) / 1.05, y - 31); if (d < 14 && d >= 9.5) R(g, x, y, 1, 1, d > 12.5 ? M0[1] : x < 22 ? M0[2] : M0[0]); }
        R(g, 12, 6, 24, 20, M0[0]); R(g, 13, 5, 22, 22, M0[0]); R(g, 12, 6, 24, 1, M0[2]); R(g, 13, 5, 22, 1, M0[2]); R(g, 34, 6, 2, 20, M0[1]); R(g, 13, 25, 22, 2, M0[1]);
        R(g, 16, 9, 16, 13, darker(M0[1], 0.2)); R(g, 17, 10, 14, 11, stone); R(g, 17, 10, 14, 2, shade(stone, 0.3)); R(g, 18, 12, 3, 2, shade(stone, 0.55)); R(g, 28, 18, 3, 3, darker(stone, 0.3));
        R(g, 23, 13, 2, 5, M0[0]); R(g, 21, 15, 6, 1, M0[0]);                                                                     // a little star on the stone
        if (o.halo === 'on') for (let x = 15; x < 33; x += 2) { R(g, x, 7, 1, 1, '#ffffff'); R(g, x + 1, 23, 1, 1, '#ffffff'); } if (o.halo === 'on') for (let y = 9; y < 23; y += 2) { R(g, 14, y, 1, 1, '#ffffff'); R(g, 33, y + 1, 1, 1, '#ffffff'); }
        if (o.num === 'on' && it.num != null) miniText(g, String(it.num), 10, 31, M0[1]);
      }, '#0b0d18'));
      break;
    }
    case 'plaque': {
      const W0 = WOODS[o.wood] || WOODS.walnut, M0 = METALS[o.metal] || METALS.gold;
      put(memoLayer(g => {
        R(g, 7, 3, 34, 34, W0[0]); for (let k = 0; k < 8; k++) R(g, 7 + k * 2, 37 + k, 34 - k * 4, 1, W0[0]);
        R(g, 7, 3, 34, 1, shade(W0[0], 0.3)); R(g, 7, 3, 1, 34, shade(W0[0], 0.15)); R(g, 40, 4, 1, 33, W0[1]);
        R(g, 11, 7, 26, 18, M0[1]); R(g, 12, 8, 24, 16, M0[0]); R(g, 12, 8, 24, 1, M0[2]);
        // a star over the letters
        const sc = M0[1]; R(g, 23, 9, 2, 3, sc); R(g, 19, 11, 10, 2, sc); R(g, 21, 13, 6, 1, sc); R(g, 20, 14, 2, 1, sc); R(g, 26, 14, 2, 1, sc);
        miniText(g, 'MVP', 18, 17, M0[1]);
        R(g, 14, 29, 20, 6, M0[1]); R(g, 15, 30, 18, 4, M0[0]);
        if (it.num != null) miniText(g, '#' + it.num, 24 - Math.floor(miniW('#' + it.num) / 2), 30, M0[1]);
      }, '#0b0d18'));
      if (o.sig === 'on') memoSig(c, 15, 39, 16, sigCol(W0[0]), rng, -0.06);
      break;
    }
    default: {
      put(memoLayer(g => { R(g, 14, 8, 20, 18, '#ffd23f'); R(g, 10, 10, 4, 8, '#ffd23f'); R(g, 34, 10, 4, 8, '#ffd23f'); R(g, 22, 26, 4, 8, '#c9a020'); R(g, 16, 34, 16, 4, '#ffd23f'); R(g, 13, 38, 22, 6, TC.team); R(g, 15, 9, 4, 12, '#fff3a0'); }, '#0b0d18'));
    }
  }
}
// the mask piece: his own mask (design and paint) unless the custom picks change it
function memoMaskPalette(it) { const t = memoTeamCols(it); return { main: t.team, dark: t.dark, trim: t.trim, helm: t.team }; }
function memoMaskGear(it, o) {
  const p = it.pid && typeof UI !== 'undefined' && UI.save ? UI.save.players[it.pid] : null;
  const own = p && p.pos === 'G' && typeof gearOf === 'function' ? gearOf(p) : { mask: 'team' };
  const design = o.design || it.maskDesign || own.mask || 'team', m = design === 'team' ? 'split' : design;
  const paint = Object.assign({}, (own.maskP && own.maskP[m]) || it.maskPaint || {});
  for (const k of ['L', 'R', 'ridge']) if (o[k]) paint[k] = memoCol(it, o[k], null);
  return { mask: design, maskP: { [m]: paint } };
}

// ---------- the player's own picks: his personality decides
function memoPersona(p) {
  if (!p) return 'team';
  const tr = p.traits || [];
  if (tr.some(t => ['enforcer', 'hotheaded', 'intimidating', 'tough', 'iron_chin', 'counterpuncher'].includes(t)) || p.arch === 'enforcer' || (p.ufw || 0) >= 5) return 'tough';
  if (tr.some(t => ['sharpshooter', 'speedster', 'clutch', 'acrobat'].includes(t)) || p.arch === 'sniper' || p.arch === 'speedster') return 'flashy';
  if (tr.some(t => ['veteran', 'disciplined', 'natural_leader', 'brick_wall', 'big_game'].includes(t)) || (p.age || 0) >= 31) return 'classic';
  return 'team';
}
const PERSONA_LINE = { tough: 'Make it look like it\'s been through a war. Because it has.', flashy: 'If it\'s going in a cabinet, it should shine.', classic: 'Keep it simple. Old school.', team: 'It\'s not about me. Put the team on it.' };
function memoAutoPick(it, p, salt = 0) {
  const per = memoPersona(p), rng = seedRng((it.id || '') + ':' + salt), pick = a => a[Math.floor(rng() * a.length)], o = memoDefaults(it);
  const lead = p && typeof leaderOf === 'function' && typeof UI !== 'undefined' && UI.save ? leaderOf(UI.save.teams[UI.save.userTeamId], p.id) : null;
  switch (memoKindOf(it)) {
    case 'gloves':
      if (per === 'tough') Object.assign(o, { main: pick(['#1b1c22', 'dark', 'team']), cuff: pick(['#1b1c22', 'dark']), tape: pick(['red', 'black', 'white']), wear: 'battered', show: pick(['title belt', 'title belt', 'shelf']) });
      else if (per === 'flashy') Object.assign(o, { acc: '#ffd23f', tape: pick(['gold', 'none']), wear: 'clean', show: pick(['case', 'title belt']) });
      else if (per === 'classic') Object.assign(o, { main: pick(['#7a4a22', 'team']), cuff: pick(['#7a4a22', 'dark']), tape: pick(['white', 'none']), wear: 'worn', show: 'shelf' });
      else Object.assign(o, { tape: pick(['none', 'white']), wear: pick(['worn', 'clean']), show: pick(['shelf', 'case']) });
      break;
    case 'jersey':
      Object.assign(o, { letter: lead || 'none', style: per === 'classic' ? 'throwback' : per === 'flashy' ? pick(['home', 'away']) : pick(['home', 'home', 'away']), frame: per === 'flashy' ? 'gold' : per === 'tough' ? 'black' : 'oak' });
      if (per === 'flashy') o.trim = pick(['#ffd23f', 'trim']);
      break;
    case 'stick': case 'capstick':
      if (per === 'tough') Object.assign(o, { shaft: pick(['carbon', 'carbon', 'team']), art: 'solid', tape: 'black', knob: pick(['black', 'red']), mount: pick(['plaque', 'rack']) });
      else if (per === 'flashy') Object.assign(o, { shaft: pick(['white', 'gold', 'carbon']), art: pick(['flames', 'stripes']), acc: pick(['#ffd23f', 'team', '#e0302a']), tape: pick(['gold', 'candy', 'white']), mount: 'plaque' });
      else if (per === 'classic') Object.assign(o, { shaft: 'wood', art: 'solid', tape: 'white', knob: 'white', mount: pick(['plaque', 'rack']) });
      else Object.assign(o, { shaft: pick(['carbon', 'team']), art: pick(['two-tone', 'stripes']), acc: pick(['team', 'trim']), tape: pick(['team', 'white']) });
      if (memoKindOf(it) === 'capstick') o.tape = per === 'tough' ? 'black' : 'gold';
      break;
    case 'mask': Object.assign(o, { stand: per === 'flashy' ? pick(['gold', 'case']) : per === 'tough' ? 'black' : pick(['oak', 'case']) }); break;
    case 'puck': Object.assign(o, { finish: per === 'tough' ? pick(['black', 'gold']) : per === 'classic' ? pick(['silver', 'gold']) : 'gold', base: per === 'flashy' ? 'marble' : per === 'tough' ? 'black' : 'oak', sig: p ? 'on' : 'off' }); break;
    case 'banner': Object.assign(o, { emblem: pick(['star', 'cup', 'crown']), metal: pick(['gold', 'gold', 'silver']) }); break;
    case 'ring': Object.assign(o, { band: per === 'tough' ? pick(['black', 'gold']) : per === 'classic' ? pick(['gold', 'silver']) : pick(['gold', 'rose', 'gold']), stone: pick(['team', 'dark', '#e0302a', '#2f6fe8']), halo: per === 'classic' ? 'off' : 'on' }); break;
    case 'plaque': Object.assign(o, { wood: per === 'tough' ? 'ebony' : per === 'classic' ? 'oak' : 'walnut', metal: per === 'flashy' ? 'gold' : pick(['gold', 'silver']) }); break;
  }
  if (!p && 'sig' in o) o.sig = 'off';
  return o;
}
// what he says about a choice
function memoQuote(k, v, per) {
  const col = typeof v === 'string' && v[0] === '#';
  const byVal = {
    battered: 'Leave every scuff. Every one of them\'s a story.', worn: 'A little wear. They did their job.', clean: 'Clean them up. Make them look like new.',
    'title belt': 'Put the belt under them. Heavyweight champion.', case: 'Glass case. Nobody touches them.', shelf: 'Just a shelf. Simple.',
    red: 'Red tape. Like the card I never got.', black: 'Black. Nothing flashy.', white: 'White tape. Old school.', gold: 'Gold. I earned the shine.', candy: 'Candy cane! Don\'t tell anyone.', none: 'No tape. Bare wrists.',
    home: 'Home whites... I mean colours. Home colours.', away: 'The road whites. We won it on the road.', throwback: 'The throwback. The way the old-timers wore it.',
    C: 'Put the C on it. I wore it with pride.', A: 'The A. I led too.', wood: 'Brown leather. Like the boots I learned in.', carbon: 'Plain black. That\'s what I scored in.', flames: 'Flames! It was on fire that year.',
    'two-tone': 'Two-tone. Looks fast standing still.', stripes: 'Stripes. Classic.', solid: 'One colour. It\'s a boot, not a painting.', plaque: 'Mount it on a plaque.', rack: 'Hang it on the rack, like in the room.',
    glass: 'Under glass.', marble: 'Marble base. Fancy.', oak: 'Oak. Solid.', ebony: 'Ebony. Dark and heavy.', walnut: 'Walnut.', silver: 'Silver. Understated.', rose: 'Rose gold. Trust me.', bronze: 'Bronze. Humble.',
    star: 'A big star on it.', cup: 'The cup. That\'s what it was all for.', crown: 'A crown. We were kings that year.', puck: 'The ball. Always the ball.',
    team: 'Team colours. That\'s who I bled for.', dark: 'The dark team colour. Serious.', trim: 'The trim colour pops.',
  };
  if (k === 'sig') return v === 'on' ? 'Pass me a marker. I\'ll sign it.' : 'No autograph. Let it speak for itself.';
  if (k === 'num') return v === 'on' ? 'My number on it. Obviously.' : 'Leave the number off.';
  if (k === 'halo') return v === 'on' ? 'Diamonds all the way round.' : 'No diamonds. Just the stone.';
  if (k === 'design') return 'That\'s the one. That\'s my mask.';
  if (col) return per === 'tough' ? 'That colour. Yeah. Mean.' : per === 'flashy' ? 'Ooh. That one pops.' : 'That colour works.';
  return byVal[v] || 'Sure. I like that.';
}

// ---------- the customizer: you and him, at the workbench
function memoCustomizeDlg(it, onDone) {
  const save = UI.save, p = it.pid ? save.players[it.pid] : null, per = memoPersona(p);
  const voice = p || (() => { const t = save.teams[save.userTeamId], L = t && t.leaders; return L && L.c ? save.players[L.c] : null; })();
  const o = memoCustomOf(it), opts = MEMO_OPTS[memoKindOf(it)] || [];
  let line = it.custom ? (it.customLine || PERSONA_LINE[per]) : PERSONA_LINE[per], salt = 1;
  const TC = memoTeamCols(it);
  const what = { gloves: 'HIS GLOVES', jersey: 'HIS JERSEY', stick: 'HIS BOOT', capstick: 'HIS CAPTAIN\'S BOOT', mask: 'HIS MASK', puck: 'THE BALL', banner: 'THE BANNER', ring: 'THE RING', plaque: 'HIS MVP DISPLAY' }[memoKindOf(it)] || 'THE PIECE';
  modal(close => {
    const box = h('div', { class: 'memodlg' });
    const draw = () => {
      box.innerHTML = '';
      const tmp = Object.assign({}, it, { custom: o });
      const rows = opts.map(([k, lab, type]) => {
        let ch;
        if (type === 'col') ch = MEMO_COLS.map(v => { const col = memoCol(it, v, '#888'); return h('button', { class: 'swatch' + (o[k] === v ? ' sel' : ''), title: v === 'team' ? 'Team colour' : v === 'dark' ? 'Team dark' : v === 'trim' ? 'Team trim' : col, style: { background: col }, onclick: () => { o[k] = v; line = memoQuote(k, v, per); draw(); } }); });
        else if (type === 'mask') {
          const team = save.teams[save.userTeamId];
          const own = typeof MASK_ORDER !== 'undefined' ? MASK_ORDER.filter(m => maskState(team, m) === 'own') : ['split'];
          const curD = (memoMaskGear(it, o).mask === 'team' ? 'split' : memoMaskGear(it, o).mask);
          ch = [h('select', { onchange: e => { o.design = e.target.value; line = memoQuote('design', o.design, per); draw(); } }, own.concat(own.includes(curD) ? [] : [curD]).map(m => h('option', { value: m, selected: m === curD }, maskInfo(m).name))),
            h('span', { class: 'muted', style: { fontSize: 'calc(6px * var(--ts, 1.2))', marginLeft: '6px' } }, 'masks your team owns')];
        }
        else ch = type.map(v => h('button', { class: 'small mchoice' + (o[k] === v ? ' sel' : ''), onclick: () => { o[k] = v; line = memoQuote(k, v, per); draw(); } }, (k === 'shaft' ? ({ wood: 'leather', carbon: 'black', white: 'white', team: 'team', gold: 'gold' }[v] || v) : v).toUpperCase()));   // (the boot keeps the stick's saved values)
        return h('div', { class: 'memorow' }, h('span', { class: 'plab' }, lab), h('div', { class: 'memoch' }, ch));
      });
      const who = voice ? `#${voice.num} ${voice.first} ${voice.last}` : 'THE EQUIPMENT MANAGER';
      box.appendChild(h('h2', null, (p ? `#${p.num} ${p.last.toUpperCase()} CUSTOMIZES ${what}` : `CUSTOMIZE ${what}`)));
      box.appendChild(h('div', { class: 'row', style: { gap: '14px', alignItems: 'flex-start', flexWrap: 'nowrap', margin: 0 } },
        h('div', { class: 'memoleft' }, h('div', { class: 'memostage' }, memoArt(tmp, 192)),
          h('div', { class: 'gold', style: { fontSize: '8px', marginTop: '6px' } }, it.name),
          h('div', { class: 'row', style: { gap: '8px', alignItems: 'center', flexWrap: 'nowrap', margin: '6px 0 0' } }, voice ? portrait(voice, null, 40) : null,
            h('div', { class: 'speech' }, h('div', { class: 'muted', style: { fontSize: 'calc(6px * var(--ts, 1.2))' } }, who), '"' + line + '"'))),
        h('div', { style: { flex: 1, minWidth: 0 } }, rows)));
      box.appendChild(h('div', { class: 'row', style: { marginTop: '8px' } },
        h('button', { class: 'primary', onclick: () => { it.custom = Object.assign({}, o); it.customLine = line; Store.autosave(save); close(); toast('Saved to the cabinet.'); onDone && onDone(); } }, 'SAVE'),
        h('button', { onclick: () => { Object.assign(o, memoAutoPick(it, p, salt++)); line = p ? PERSONA_LINE[per] : 'Here\'s what I\'d do.'; draw(); } }, p ? '🎲 LET HIM PICK' : '🎲 SURPRISE ME'),
        h('button', { onclick: close }, 'CANCEL')));
    };
    draw();
    return box;
  }, true);
}
// a newly earned piece arrives already customized by its player (his first picks; you can change them later)
function memoFirstPicks(save, item) {
  try {
    const p = item.pid ? save.players[item.pid] : null;
    if (item.kind === 'mask' && p && p.pos === 'G' && typeof gearOf === 'function') { const g = gearOf(p), m = g.mask === 'team' ? 'split' : g.mask; item.maskDesign = g.mask; if (g.maskP && g.maskP[m]) item.maskPaint = Object.assign({}, g.maskP[m]); }
    item.custom = memoAutoPick(item, p, 0); item.customLine = PERSONA_LINE[memoPersona(p)];
  } catch (e) { /* a piece without picks draws with the defaults */ }
}
