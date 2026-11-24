'use strict';
// ====================================================================
//  THE CLUB JERSEY on the trophy-room wall: an exact replica of one of the club's real kits (the same pattern,
//  sleeve bands, colours, gold trim, crest and jersey fit the team wears on the ice), framed and customizable:
//  which kit, front (crest) or back (name bar and number), a letter, autographs, the frame, the mat, the brass plate
//  and a picture light. Settings live on the team (team.clubJersey). Click the jersey in THE ROOM to customize it.
// ====================================================================
const CJ_W = 56, CJ_H = 60;                         // the frame (the brass plate hangs below it)
const CJ_DEF = { kit: 'home', side: 'front', name: '', num: '', letter: 'none', sig: 'none', frame: 'gold', mat: 'cream', plate: 'nick', light: 'off' };
const CJ_FRAMES = { gold: ['#7a5a20', '#e0b850', '#fff0a8'], oak: ['#4a2c12', '#a8703a', '#d8a868'], black: ['#0b0c12', '#2a2c34', '#5a5e6a'], silver: ['#5a606e', '#c9ced8', '#ffffff'] };
const CJ_MATS = { cream: '#e4dccb', team: null, dark: null, black: '#15161c' };
const clubJerseyOf = team => Object.assign({}, CJ_DEF, (team && team.clubJersey) || {});
function cjPlateText(team, o, save) {
  if (o.plate === 'none') return '';
  if (o.plate === 'city') return (team.city || '').toUpperCase();
  if (o.plate === 'est') { const y = save && save.history && save.history[0] ? save.history[0].year : save && save.season ? save.season.year : null; return 'EST. ' + (y || ''); }
  if (o.plate === 'abbr') return (team.abbr || '').toUpperCase();
  return (team.nick || team.abbr || '').toUpperCase();
}
// draw the framed jersey with its top-left frame corner at (x, y), in canvas pixels
function drawClubJersey(c, x, y, team, o, save) {
  o = Object.assign({}, CJ_DEF, o || {});
  const kits = typeof kitKeys === 'function' ? kitKeys(team) : ['home'];
  const K = typeof teamPalette === 'function' ? teamPalette(team, kits.includes(o.kit) ? o.kit : 'home') : { main: team.colors.p, dark: team.colors.s, trim: team.colors.a, style: team.style, uni: {} };
  const fit = (K.uni && K.uni.jersey) || 'standard';
  const F = CJ_FRAMES[o.frame] || CJ_FRAMES.gold;
  const R = (a, b, w, hh, col) => { if (w <= 0 || hh <= 0) return; c.fillStyle = col; c.fillRect(Math.round(a), Math.round(b), w, hh); };
  // the picture light above the frame, then the frame: outer edge, the moulding, its lit top-left edges, the mat
  if (o.light === 'on') { c.fillStyle = 'rgba(255,240,190,.16)'; c.beginPath(); c.moveTo(x + 18, y - 3); c.lineTo(x + CJ_W - 18, y - 3); c.lineTo(x + CJ_W + 4, y + CJ_H); c.lineTo(x - 4, y + CJ_H); c.fill(); }
  R(x - 3, y - 3, CJ_W + 6, CJ_H + 6, 'rgba(0,0,0,.35)');
  R(x - 2, y - 2, CJ_W + 4, CJ_H + 4, F[0]); R(x - 1, y - 1, CJ_W + 2, CJ_H + 2, F[1]); R(x - 1, y - 1, CJ_W + 2, 1, F[2]); R(x - 1, y - 1, 1, CJ_H + 2, F[2]);
  R(x + CJ_W, y, 1, CJ_H, F[0]); R(x, y + CJ_H, CJ_W, 1, F[0]);
  const mat = CJ_MATS[o.mat] || (o.mat === 'team' ? K.main : shade(K.dark, -0.25));
  R(x + 1, y + 1, CJ_W - 2, CJ_H - 2, mat); R(x + 3, y + 3, CJ_W - 6, CJ_H - 6, '#0e1226'); R(x + 3, y + 3, CJ_W - 6, 1, '#05060c');
  if (o.light === 'on') { R(x + CJ_W / 2 - 9, y - 6, 18, 3, '#c9a050'); R(x + CJ_W / 2 - 9, y - 6, 18, 1, '#fff0a8'); R(x + CJ_W / 2 - 1, y - 3, 2, 2, '#8a6a20'); R(x + CJ_W / 2 - 8, y - 3, 16, 1, 'rgba(255,240,190,.7)'); }
  // the jersey: body block in the kit's real pattern; sleeves spread wide in its sleeve bands; the hem
  const loose = fit === 'loose', bw = loose ? 28 : 26, bh = fit === 'tuck' ? 38 : 41, bx = Math.round(x + CJ_W / 2 - bw / 2), by = y + 9;
  const jc = (i, j) => typeof jerseyColor === 'function' ? jerseyColor(K, i, j, bw, bh) : K.main;
  const sl = (j, n) => typeof sleeveColor === 'function' ? sleeveColor(K, Math.min(3, Math.floor(j * 4 / n))) : K.main;
  const SL = fit === 'rolled' ? 13 : 20, SW = 8;
  for (const sd of [-1, 1]) for (let j = 0; j < SL; j++) {
    const drift = Math.floor(j / 3), sx = sd < 0 ? bx - SW - drift + 1 : bx + bw + drift - 1;
    for (let i = 0; i < SW; i++) {
      let col = sl(j, SL);
      if (fit === 'elbow' && j >= 8 && j <= 11 && i >= 2 && i <= 5) col = K.dark;
      if (fit === 'rolled' && j >= SL - 3) col = j === SL - 3 ? shade(K.main, 0.18) : darker(K.main, 0.12);
      R(sx + i, by + 1 + j, 1, 1, col);
    }
    R(sd < 0 ? bx - SW - Math.floor((SL - 1) / 3) + 1 : bx + bw + Math.floor((SL - 1) / 3) - 1, by + SL, SW, 1, darker(sl(SL - 1, SL), 0.3));     // cuff edge
    if (sd < 0) for (let j = 2; j < SL - 1; j++) R(bx - SW - Math.floor(j / 3) + 1, by + 1 + j, 1, 1, shade(sl(j, SL), 0.15));             // lit outer edge
  }
  for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) R(bx + i, by + j, 1, 1, jc(i, j));
  // fabric: light from the left, a soft fold down the right, the armpit creases
  c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(bx, by + 2, 3, bh - 3);
  c.fillStyle = 'rgba(0,0,0,.13)'; c.fillRect(bx + bw - 4, by + 2, 4, bh - 2); c.fillRect(bx + 1, by + 20, 2, 1); c.fillRect(bx + bw - 3, by + 20, 2, 1);
  if (fit === 'tuck') { R(bx + 2, by + bh, bw - 4, 2, darker(jc(0, bh - 1), 0.25)); }
  else { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(bx, by + bh - 1, bw, 1); }
  // collar: the V (or the lace-up collar) in the dark colour, edged in trim; on the back, a plain dark band
  const cx0 = bx + Math.floor(bw / 2);
  if (o.side === 'back') { R(cx0 - 6, by, 12, 2, K.dark); R(cx0 - 6, by + 2, 12, 1, K.trim); }
  else if (fit === 'laces' || K.style === 'heritage') { R(cx0 - 3, by, 6, 6, '#141826'); R(cx0 - 4, by, 1, 6, K.trim); R(cx0 + 3, by, 1, 6, K.trim); for (let k = 0; k < 3; k++) { R(cx0 - 2, by + 1 + k * 2, 4, 1, '#e8e0c8'); } }
  else { for (let k = 0; k < 5; k++) R(cx0 - 5 + k, by + k, 10 - 2 * k, 1, K.dark); R(cx0 - 6, by, 1, 2, K.trim); R(cx0 + 5, by, 1, 2, K.trim); for (let k = 0; k < 5; k++) { R(cx0 - 5 + k, by + k + 1, 1, 1, K.trim); R(cx0 + 4 - k, by + k + 1, 1, 1, K.trim); } }
  const nc = typeof numColor === 'function' ? numColor(K) : K.trim, edge = Math.abs(lum(nc) - lum(K.dark)) > 0.25 ? K.dark : (lum(nc) > 0.5 ? '#141832' : '#ffffff');
  const outlined = (draw) => { c.save(); for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { c.translate(dx, dy); draw(edge); c.translate(-dx, -dy); } draw(nc); c.restore(); };
  if (o.side === 'back') {
    // the name bar across the shoulders and the big number
    let nm = (o.name || '').toUpperCase().slice(0, 12); if (typeof pTextW === 'function') while (nm && pTextW(nm) > bw - 2) nm = nm.slice(0, -1);
    if (nm && typeof pText === 'function') outlined(col => pText(c, nm, cx0 - Math.floor(pTextW(nm) / 2), by + 5, col));
    const num = String(o.num || '').slice(0, 2);
    if (num && typeof pText === 'function') outlined(col => pText(c, num, cx0 - Math.floor(pTextW(num, 2) / 2), by + (nm ? 12 : 9), col, 2));
  } else {
    // the crest, stitched on with a trim outline so it reads on any pattern
    if (typeof drawEmblemPlain === 'function') try {
      const e = document.createElement('canvas'); e.width = e.height = 18; const ec = e.getContext('2d'); drawEmblemPlain(ec, team, 1, 1, 1);
      const ol = document.createElement('canvas'); ol.width = ol.height = 18; const oc = ol.getContext('2d');
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) oc.drawImage(e, dx, dy);
      oc.globalCompositeOperation = 'source-in'; oc.fillStyle = K.trim; oc.fillRect(0, 0, 18, 18);
      const ex = cx0 - 9, ey = by + 9; c.drawImage(ol, ex, ey); c.drawImage(e, ex, ey);
    } catch (err) {}
    if (o.letter !== 'none' && typeof pText === 'function') outlined(col => pText(c, o.letter, bx + bw - 8, by + 4, col));
    const num = String(o.num || '').slice(0, 2);
    if (num && typeof pText === 'function') for (const sd of [-1, 1]) { const sx = sd < 0 ? bx - SW + 1 - 1 : bx + bw + 1; outlined(col => pText(c, num, sx + Math.floor((SW - pTextW(num)) / 2), by + 3, col)); }   // shoulder numbers
  }
  // autographs: the captain's big one across the chest, or the whole team's scattered over it
  if (o.sig !== 'none' && typeof memoSig === 'function') {
    const rng = typeof seedRng === 'function' ? seedRng((team.id || '') + o.sig + o.side) : Math.random, sc = lum(jc(4, 26)) > 0.55 ? '#1b1c22' : '#e8ecf2';
    const low = o.side === 'back' ? by + 26 : by + 30;
    if (o.sig === 'captain') memoSig(c, bx + 5, low + 2, 15, sc, rng, -0.1);
    else { for (const [sx, sy, w] of [[bx + 2, low, 8], [bx + 15, low + 1, 8], [bx + 7, low + 6, 9], [bx - SW + 1, by + 12, 5], [bx + bw + 2, by + 13, 5]]) memoSig(c, sx, sy, w, sc, rng, (rng() - 0.5) * 0.2); }
  }
  // the hanger hook and the brass plate under the frame
  R(x + CJ_W / 2 - 1, y + 5, 2, 4, '#8a8f99');
  const nm = cjPlateText(team, o, save);
  if (nm && typeof pTextW === 'function') { const tw = pTextW(nm); R(x + CJ_W / 2 - tw / 2 - 4, y + CJ_H + 3, tw + 8, 9, '#7a5a20'); R(x + CJ_W / 2 - tw / 2 - 3, y + CJ_H + 4, tw + 6, 7, '#e0b850'); R(x + CJ_W / 2 - tw / 2 - 3, y + CJ_H + 4, tw + 6, 1, '#fff0a8'); pText(c, nm, Math.round(x + CJ_W / 2 - tw / 2), y + CJ_H + 5, '#3a2410'); }
}

// ---------- the customizer
function clubJerseyDlg(team, save, onDone) {
  const o = clubJerseyOf(team), keys = typeof kitKeys === 'function' ? kitKeys(team) : ['home'];
  const kitName = k => { try { return kitByKey(team, k).name.toUpperCase(); } catch (e) { return k.toUpperCase(); } };
  const OPTS = [
    ['kit', 'KIT', keys], ['side', 'SHOW', ['front', 'back']], ['letter', 'LETTER', ['none', 'C', 'A']], ['sig', 'AUTOGRAPHS', ['none', 'captain', 'team']],
    ['frame', 'FRAME', Object.keys(CJ_FRAMES)], ['mat', 'MAT', Object.keys(CJ_MATS)], ['plate', 'BRASS PLATE', ['nick', 'city', 'abbr', 'est', 'none']], ['light', 'PICTURE LIGHT', ['off', 'on']],
  ];
  const label = (k, v) => k === 'kit' ? kitName(v) : k === 'plate' ? ({ nick: team.nick, city: team.city, abbr: team.abbr, est: 'EST.', none: 'NONE' }[v] || v).toUpperCase() : String(v).toUpperCase();
  modal(close => {
    const box = h('div', { class: 'cjdlg memodlg' });
    const draw = () => {
      box.innerHTML = '';
      const cv = h('canvas', { width: CJ_W + 16, height: CJ_H + 24, class: 'px', style: { width: (CJ_W + 16) * 3.4 + 'px', height: (CJ_H + 24) * 3.4 + 'px', display: 'block', margin: '0 auto' } });
      const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.fillStyle = '#5e3b1f'; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = '#4e301a'; for (let xx = 0; xx < cv.width; xx += 12) c.fillRect(xx, 0, 1, cv.height);
      drawClubJersey(c, 8, 9, team, o, save);
      const rows = OPTS.filter(([k]) => k !== 'letter' || o.side === 'front').map(([k, lab, vals]) => h('div', { class: 'memorow' }, h('span', { class: 'plab' }, lab),
        h('div', { class: 'memoch' }, vals.map(v => h('button', { class: 'small mchoice' + (o[k] === v ? ' sel' : ''), onclick: () => { o[k] = v; draw(); } }, label(k, v))))));
      const nameIn = h('input', { type: 'text', maxLength: 12, value: o.name, placeholder: (team.nick || '').toUpperCase(), style: { width: '120px' }, oninput: e => { o.name = e.target.value.replace(/[^A-Za-z0-9 .'-]/g, ''); redrawOnly(); } });
      const numIn = h('input', { type: 'text', maxLength: 2, value: o.num, placeholder: '00', style: { width: '58px' }, oninput: e => { o.num = e.target.value.replace(/\D/g, '').slice(0, 2); redrawOnly(); } });
      rows.splice(2, 0, h('div', { class: 'memorow' }, h('span', { class: 'plab' }, o.side === 'back' ? 'NAME & NUMBER' : 'SHOULDER NUMBER'),
        h('div', { class: 'memoch' }, o.side === 'back' ? [nameIn, h('span', { class: 'muted', style: { fontSize: '7px' } }, '#'), numIn] : [numIn],
          h('button', { class: 'small mchoice', onclick: () => { o.name = (team.nick || '').toUpperCase(); o.num = String(new Date().getFullYear() % 100); if (save && save.season) o.num = String(save.season.year % 100).padStart(2, '0'); draw(); } }, 'CLUB'),
          h('button', { class: 'small mchoice', onclick: () => { o.name = ''; o.num = ''; draw(); } }, 'CLEAR'))));
      const redrawOnly = () => { c.fillStyle = '#5e3b1f'; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = '#4e301a'; for (let xx = 0; xx < cv.width; xx += 12) c.fillRect(xx, 0, 1, cv.height); drawClubJersey(c, 8, 9, team, o, save); };
      box.appendChild(h('h2', null, '🎨 THE CLUB JERSEY'));
      box.appendChild(h('div', { class: 'row', style: { gap: '16px', alignItems: 'flex-start', flexWrap: 'nowrap', margin: 0 } },
        h('div', { style: { flex: 'none' } }, cv, h('div', { class: 'muted', style: { fontSize: 'calc(6.5px * var(--ts, 1.2))', marginTop: '6px', textAlign: 'center', maxWidth: '245px' } }, 'An exact replica of your ' + kitName(o.kit).toLowerCase() + ' kit. Change the kit itself in TEAM LOOK > UNIFORMS.')),
        h('div', { style: { flex: 1, minWidth: 0 } }, rows)));
      box.appendChild(h('div', { class: 'row', style: { marginTop: '8px' } },
        h('button', { class: 'primary', onclick: () => { team.clubJersey = Object.assign({}, o); Store.autosave(save); close(); toast('The club jersey is back on the wall.'); onDone && onDone(); } }, 'HANG IT'),
        h('button', { onclick: () => { Object.assign(o, CJ_DEF); draw(); } }, 'RESET'),
        h('button', { onclick: close }, 'CANCEL')));
    };
    draw();
    return box;
  }, true);
}
