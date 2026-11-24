'use strict';
// ====================================================================
//  ART: colours, team palettes, jersey patterns, emblems, numbers, trophies
// ====================================================================
function hexRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbHex(r, g, b) { return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
function shade(h, amt) { const [r, g, b] = hexRgb(h); return amt < 0 ? rgbHex(r * (1 + amt), g * (1 + amt), b * (1 + amt)) : rgbHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt); }
function lum(h) { const [r, g, b] = hexRgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
// how far apart two colours look to someone with red-green colour blindness (deuteranopia, the most common kind)
function cvdDist(a, b) {
  const sim = h => { const [r, g, bl] = hexRgb(h); return [0.625 * r + 0.375 * g, 0.7 * r + 0.3 * g, 0.3 * g + 0.7 * bl]; };
  const A = sim(a), B = sim(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}
function colorDist(a, b) { const A = hexRgb(a), B = hexRgb(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); }
// a colour of the team that reads well on the dark UI
// Team-coloured text sits on the game's dark navy panels. Use the first club colour that reads clearly there (4.5:1, the
// usual readability bar); if none does, lighten the club's own colour just enough, so the name keeps the club's hue
// instead of turning plain white. (Art audit, Nov 22: 59 of 164 clubs were under 4.5:1, the worst at 2.3:1.)
const TTC_BG = '#1a2040', TTC_MIN = 4.5, _ttcCache = {};
function _relLum(hx) { return hexRgb(hx).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0); }
function _contrast(a, b) { const x = _relLum(a), y = _relLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
function teamTextColor(t) {
  const cols = [t.colors.p, t.colors.a, t.colors.s], key = cols.join();
  if (_ttcCache[key]) return _ttcCache[key];
  let c = cols.find(c => lum(c) > 0.32 && lum(c) < 0.97 && _contrast(c, TTC_BG) >= TTC_MIN);
  if (!c) {
    // the most colourful of the club's colours (not near-white, not near-black), lightened toward white until it reads
    const base = cols.filter(x => lum(x) < 0.97 && lum(x) > 0.05).sort((a, b) => _contrast(b, TTC_BG) - _contrast(a, TTC_BG))[0];
    if (!base) c = '#ffffff';
    else {
      const [r, g, b] = hexRgb(base); c = '#ffffff';
      for (let k = 0.05; k <= 1; k += 0.05) {
        const m = v => Math.round(v + (255 - v) * k).toString(16).padStart(2, '0'), x = '#' + m(r) + m(g) + m(b);
        if (_contrast(x, TTC_BG) >= TTC_MIN) { c = x; break; }
      }
    }
  }
  return (_ttcCache[key] = c);
}
const fullName = t => t.city + ' ' + t.nick;

// ---------- UNIFORMS: every club has a HOME kit, an AWAY kit and at least one ALTERNATE. A kit is the jersey (colours,
// pattern, gold trim) plus the uniform pieces the whole team wears alike (helmet, gloves, socks, jersey fit). The
// user's club can design all of them and add as many alternates as it likes (identity.kits); every other club gets
// sensible defaults built from its colours. Players never mix: the team's uniform overrides individual helmet, glove,
// sock and jersey-fit choices (goalie masks, pads and personal equipment like sticks and skates stay personal).
const UNI_DEFAULT = { helmet: 'team', gloves: 'team', socks: 'team', fit: 'standard' };
const ALT_STYLES = ['shoulder', 'bands', 'yoke', 'hoops', 'chevron', 'diagonal', 'checker', 'split'];   // (no unlockable styles)
function hashTeam(t) { let h = 7; for (const c of String(t.id || t.nick || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
// the kit list for a team (defaults filled in, the user's own designs on top)
function teamKits(t) {
  const P = t.colors.p, Sx = t.colors.s, A = t.colors.a, k = t.kits || {};
  const altStyle = ALT_STYLES.filter(x => x !== t.style)[hashTeam(t) % (ALT_STYLES.length - 1)];
  const home = Object.assign({ name: 'Home', main: P, dark: Sx, trim: A, style: t.style }, UNI_DEFAULT, k.home || {});
  const away = Object.assign({ name: 'Away', main: '#eef1f6', dark: P, trim: lum(A) > 0.82 ? Sx : A, style: t.style }, UNI_DEFAULT, k.away || {});
  const altDef = { name: 'Alternate', main: lum(Sx) < 0.12 ? shade(P, -0.45) : Sx, dark: P, trim: A, style: altStyle };
  const alts = (k.alts && k.alts.length ? k.alts : [altDef]).map((a, i) => Object.assign({}, altDef, UNI_DEFAULT, { name: 'Alternate ' + (i + 1) }, a));
  return { home, away, alts };
}
const kitKeys = t => ['home', 'away'].concat(teamKits(t).alts.map((_, i) => 'alt' + i));
function kitByKey(t, key) { const K = teamKits(t); return key === 'away' ? K.away : /^alt\d+$/.test(key || '') ? (K.alts[+key.slice(3)] || K.alts[0]) : K.home; }
// sprite palette for a team: away = true/false (away / home kit) or a kit key ('home', 'away', 'alt0', 'alt1'...)
function teamPalette(t, away) {
  const key = typeof away === 'string' ? away : away ? 'away' : 'home', kit = kitByKey(t, key);
  const base = { id: t.id, city: t.city, nick: t.nick, abbr: t.abbr, emblem: t.emblem, style: kit.style || t.style, colors: t.colors, logo: t.logo || null, away: key !== 'home', kit: key, kitName: kit.name,
    uni: { helmet: kit.helmet || 'team', gloves: kit.gloves || 'team', socks: kit.socks || 'team', jersey: kit.fit || 'standard' } };
  const gold = (kit.gold != null ? kit.gold : t.trim === 'gold') ? '#f2c230' : null;                 // account unlock: gold jersey trim
  const M = kit.main, D = kit.dark;
  const trim = gold || (colorDist(kit.trim, M) < 40 ? (lum(M) > 0.5 ? (colorDist(D, M) > 60 ? D : '#141832') : '#ffffff') : kit.trim);
  return Object.assign(base, { main: M, dark: D, trim, pants: shade(kit.pants || t.colors.s, -0.35), helm: D });
}
// number colour that contrasts with the jersey
function numColor(C) {
  const lm = lum(C.main);
  if (Math.abs(lum(C.trim) - lm) > 0.35) return C.trim;
  if (Math.abs(lum(C.dark) - lm) > 0.35) return C.dark;
  return lm > 0.55 ? '#141832' : '#ffffff';
}

// ---------- jersey patterns (i,j inside a w x h jersey block)
function jerseyColor(C, i, j, w, h) {
  const u = i / (w - 1), v = j / (h - 1);
  switch (C.style) {
    case 'classic':   return j === h - 2 ? C.trim : j === h - 3 && h > 5 ? C.dark : (j === 0 ? C.dark : C.main);
    case 'shoulder':  return v < 0.3 ? C.trim : v < 0.45 ? C.dark : (j === h - 1 ? C.dark : C.main);
    case 'bands':     return (v > 0.3 && v < 0.62) ? C.trim : (Math.abs(v - 0.25) < 0.1 || Math.abs(v - 0.68) < 0.1) ? C.dark : C.main;
    case 'diagonal':  return Math.abs(u - (1 - v)) < 0.2 ? C.trim : (j === h - 1 ? C.dark : C.main);
    case 'minimal':   return (j === 0 && Math.abs(u - 0.5) < 0.2) ? C.trim : (j === h - 1 ? C.dark : C.main);
    case 'chevron': { const d = Math.abs(u - 0.5) * 2; return Math.abs(v - (0.12 + (1 - d) * 0.5)) < 0.14 ? C.trim : (j === h - 1 ? C.dark : C.main); }
    case 'plaid':     return (((i >> 1) + (j >> 1)) & 1) ? C.dark : (j === 0 ? C.trim : C.main);
    case 'pinstripe': return j === 0 ? C.dark : (i % 3 === 1 ? C.trim : C.main);
    case 'goldsash':  return Math.abs(u - (1 - v)) < 0.17 ? '#f2c230' : Math.abs(u - (1 - v)) < 0.24 ? C.trim : (j === h - 1 ? C.dark : C.main);
    case 'heritage':  return (j <= 1 && Math.abs(u - 0.5) < 0.12) ? (i % 2 ? C.trim : C.dark) : (v > 0.56 && v < 0.7) ? C.trim : (v >= 0.7 && v < 0.76) ? C.dark : C.main;
    case 'hoops':     return j === 0 ? C.dark : (j % 3 === 1 ? C.trim : C.main);
    case 'yoke':      return v < 0.34 ? C.trim : (j === Math.round(0.34 * (h - 1)) + 1 ? C.dark : (j === h - 1 ? C.dark : C.main));
    case 'split':     return j === 0 ? C.trim : (u < 0.5 ? C.main : C.dark);
    case 'dots':      return j === h - 1 ? C.dark : ((i + (j % 2) * 2) % 4 === 1 && j % 2 === 1 ? C.trim : C.main);
    case 'galaxy': {  const k = (i * 7 + j * 13 + ((typeof S !== 'undefined' ? S.t : 0) >> 5)) % 17; return k === 0 ? '#ffffff' : k === 9 ? C.trim : (v < 0.15 ? C.trim : '#141a3a'); }
    case 'sunset': {  return j === h - 1 ? C.dark : v < 0.2 ? '#ffd23f' : v < 0.38 ? '#ff9a2f' : v < 0.56 ? '#f0533a' : v < 0.74 ? '#b8306a' : '#4a2a7a'; }
    case 'laststand': { const d = Math.abs(u - 0.5) * 2; if (Math.abs(v - (0.2 + (1 - d) * 0.32)) < 0.09) return '#c8a03a'; if (Math.abs(v - (0.2 + (1 - d) * 0.32)) < 0.16) return '#b3202a'; return j === h - 1 ? '#c8a03a' : (i % 4 === 0 && j % 4 === 2 ? '#4a4e5a' : '#2a2d35'); }
    case 'checker':   return (v > 0.38 && v < 0.66) ? (((i >> 1) + (j >> 1)) & 1 ? C.trim : C.dark) : (j === h - 1 ? C.dark : C.main);
    case 'aurora': {  const wv = v + 0.12 * Math.sin(u * 6.3 + ((typeof S !== 'undefined' ? S.t : 0) >> 6) * 0.5); return wv < 0.22 ? '#2ee6a6' : wv < 0.34 ? '#1fb3b8' : wv < 0.44 ? '#7b4fd6' : (j === h - 1 ? C.dark : '#0e1a3a'); }
    case 'flames': {  const fh = 0.55 + 0.18 * Math.sin(i * 1.9) + 0.08 * Math.sin(i * 4.3); return v > fh + 0.22 ? '#ff6a1f' : v > fh ? '#ffd23f' : (j === 0 ? C.trim : C.main); }
  }
  return C.main;
}
function sleeveColor(C, j) {
  switch (C.style) {
    case 'shoulder': return j < 1 ? C.trim : j === 2 ? C.trim : C.main;
    case 'bands':    return j === 1 || j === 2 ? C.trim : C.main;
    case 'plaid':    return j % 2 ? C.dark : C.main;
    case 'pinstripe':return j === 2 ? C.trim : C.main;
    case 'minimal':  return j === 3 ? C.dark : C.main;
    case 'hoops':    return j % 2 ? C.trim : C.main;
    case 'yoke':     return j < 2 ? C.trim : C.main;
    case 'galaxy':   return j === 0 ? C.trim : '#141a3a';
    case 'laststand':return j === 1 ? '#b3202a' : j === 2 ? '#c8a03a' : '#2a2d35';
    case 'flames':   return j === 3 ? '#ff6a1f' : C.main;
    case 'checker':  return j === 2 ? C.trim : C.main;
    case 'sunset':   return j === 0 ? '#ff9a2f' : j === 1 ? '#f0533a' : '#4a2a7a';
    case 'aurora':   return j === 0 ? '#2ee6a6' : j === 1 ? '#7b4fd6' : '#0e1a3a';
    default:         return j === 2 ? C.trim : j === 3 ? C.dark : C.main;
  }
}

// ---------- emblems
const EMB_FIXED = { w:'#ffffff', k:'#141832', y:'#f2c230', o:'#ff8a1f', r:'#e0302a', g:'#9aa3b8', b:'#8a5a2b' };
// every emblem's own colours for its main (a) and shade (s) parts: logos keep these whatever the team wears
const EMBLEM_COLORS = {
  eagle: ['#7a5230', '#4a3018'], wolf: ['#8a93a6', '#5a6170'], bear: ['#8a5a2b', '#5a3a1e'], hawk: ['#9a6a3a', '#6a4422'],
  lion: ['#d9a23a', '#9a6a1e'], dragon: ['#3aa65a', '#1f6a36'], shield: ['#2f6fd0', '#1b3f84'], star: ['#f2c230', '#b8862a'],
  bolt: ['#ffd23f', '#d89a1a'], mountain: ['#6f8fb0', '#46607e'], laurel: ['#3aa65a', '#1f6a36'], crown: ['#d9342b', '#8a1d17'],
  puck: ['#2a2e3a', '#141832'], flake: ['#7fd1ff', '#3a8fd0'], flame: ['#e0302a', '#9a1d17'], tree: ['#2f8f46', '#1a5c2d'],
  anchor: ['#5a6f8a', '#36465a'], moose: ['#d8c49a', '#9a8460'], owl: ['#8a6a3a', '#5a4220'], wave: ['#2f8fe8', '#1b5fa8'],
  sun: ['#ffd23f', '#ff8a1f'], sword: ['#c9ced8', '#8a93a6'], rocket: ['#e0302a', '#9a1d17'], bison: ['#6b4423', '#3a2412'],
  sticks: ['#b07a3b', '#7a5230'], trident: ['#5a6f8a', '#36465a'], shark: ['#6f8aa6', '#46607e'], phoenix: ['#ff8a1f', '#e0302a'],
  clover: ['#3aa65a', '#1f6a36'], fox: ['#ff8a1f', '#c25a12'], castle: ['#9aa3b8', '#646c80'], penguin: ['#2a2e3a', '#141832'],
  lighthouse: ['#e0302a', '#9a1d17'], tiger: ['#ff8a1f', '#c25a12'], mask: ['#e0302a', '#9a1d17'], snake: ['#3aa65a', '#1f6a36'],
  hornet: ['#ffd23f', '#d89a1a'], orca: ['#262a36', '#141832'], paw: ['#c9a050', '#8a6a2a'], ram: ['#d8c7a0', '#9a8460'],
  sailboat: ['#e0302a', '#2f8fe8'], claws: ['#d9342b', '#8a1d17'], raven: ['#2a2e3a', '#46506a'], viking: ['#c9ced8', '#8a93a6'], kraken: ['#8a3ac0', '#5a1f8a'],
  stag: ['#a8714a', '#e8d7b0'], bull: ['#7a2a1a', '#c98a6a'], lynx: ['#c9a060', '#8a6a3a'], polarbear: ['#eef1f6', '#9aa3b8'], thunderbird: ['#d9342b', '#1b3f94'], knight: ['#c9ced8', '#8a93a6'], torch: ['#1f4f9a', '#0d2650'], wingpuck: ['#8c1d22', '#2a2e3a'], frostcrown: ['#9fd6ff', '#3d8fc9'], cup: ['#6b1530', '#e3b24a'], ring: ['#14275e', '#e8b923'],
};
function emblemColors(t) {
  const tint0 = t.logo && t.logo.tint, nat = EMBLEM_COLORS[t.emblem];
  let a, s;
  if (tint0 === 'teamcol' || tint0 === 'accent' || !nat) {                       // the team's own colours (an option in the customizer)
    a = t.colors.a; if (colorDist(a, t.colors.p) < 70) a = lum(t.colors.p) > 0.55 ? '#141832' : '#ffffff';
    s = t.colors.s;
  } else { a = nat[0]; s = nat[1]; }                                           // default: the emblem's natural colours
  const col = Object.assign({}, EMB_FIXED, { a, s });
  const tint = t.logo && t.logo.tint;
  if (tint && tint !== 'team' && tint !== 'teamcol' && tint !== 'natural') {   // ('team' is the old default: now the logo's own colours)
    const fills = ['a', 's', 'w', 'y', 'o', 'r', 'g', 'b'];
    if (tint === 'mono') for (const k of fills) col[k] = k === 's' || k === 'g' ? '#c9ced8' : '#ffffff';
    else if (tint === 'accent') for (const k of fills) col[k] = k === 'w' ? '#ffffff' : a;
    else if (tint === 'gold') for (const k of fills) col[k] = k === 'w' ? '#fff3c4' : k === 's' || k === 'g' || k === 'b' ? '#b8862a' : '#f2c230';
    else if (tint === 'invert') { const x = col.a; col.a = col.s; col.s = x; }
  }
  return col;
}
// ---------- LOGO OPTIONS (team identity .logo): badge shape, border, background, emblem tint, mirror, ribbon
const LOGO_OPTS = {
  shape:  { circle: 'Circle', shield: 'Shield', diamond: 'Diamond', square: 'Rounded square', hex: 'Hexagon', oct: 'Octagon', pennant: 'Pennant', star: 'Star burst', crest: 'Royal crest', none: 'Emblem only' },
  fill:   { p: 'Primary', s: 'Secondary', a: 'Accent', white: 'White', black: 'Black' },
  border: { double: 'Double ring', single: 'Single ring', thick: 'Thick ring', dashed: 'Stitched', studs: 'Studded', laurel: 'Laurel wreath', none: 'No border' },
  bg:     { solid: 'Solid', stripes: 'Stripes', halves: 'Halves', quarters: 'Quarters', sunburst: 'Sunburst' },
  tint:   { natural: 'Logo colours', teamcol: 'Team colours', mono: 'Monochrome', accent: 'Accent colour', invert: 'Swapped colours', gold: 'Solid gold' },
  orn:    { none: 'None', stars: 'Three stars', bars: 'Speed bars', crown: 'Crown', wings: 'Wings' },
};
const LOGO_LOCK = { 'shape:star': 'logo_star', 'border:studs': 'logo_studs', 'bg:sunburst': 'logo_sunburst', 'tint:gold': 'logo_gold', 'shape:crest': 'logo_crest', 'border:laurel': 'logo_laurel', 'orn:crown': 'logo_crown', 'orn:wings': 'logo_wings' };
const logoOf = t => Object.assign({ shape: 'circle', fill: 'p', border: 'double', bg: 'solid', tint: 'natural', orn: 'none', flip: false, ribbon: false }, t.logo || {});
const logoFill = (t, f) => f === 'white' ? '#f4f4f0' : f === 'black' ? '#15161c' : (t.colors[f] || t.colors.p);
function logoPath(c, shape, cx, cy, r) {
  c.beginPath();
  if (shape === 'shield') { c.moveTo(cx - r * 0.86, cy - r * 0.86); c.lineTo(cx + r * 0.86, cy - r * 0.86); c.lineTo(cx + r * 0.86, cy + r * 0.1); c.quadraticCurveTo(cx + r * 0.8, cy + r * 0.7, cx, cy + r); c.quadraticCurveTo(cx - r * 0.8, cy + r * 0.7, cx - r * 0.86, cy + r * 0.1); c.closePath(); }
  else if (shape === 'diamond') { c.moveTo(cx, cy - r); c.lineTo(cx + r, cy); c.lineTo(cx, cy + r); c.lineTo(cx - r, cy); c.closePath(); }
  else if (shape === 'square') { const k = r * 0.86, q = r * 0.22; c.moveTo(cx - k + q, cy - k); c.arcTo(cx + k, cy - k, cx + k, cy + k, q); c.arcTo(cx + k, cy + k, cx - k, cy + k, q); c.arcTo(cx - k, cy + k, cx - k, cy - k, q); c.arcTo(cx - k, cy - k, cx + k, cy - k, q); c.closePath(); }
  else if (shape === 'hex') { for (let i = 0; i < 6; i++) { const an = Math.PI / 6 + i * Math.PI / 3; c[i ? 'lineTo' : 'moveTo'](cx + Math.cos(an) * r, cy + Math.sin(an) * r); } c.closePath(); }
  else if (shape === 'oct') { for (let i = 0; i < 8; i++) { const an = Math.PI / 8 + i * Math.PI / 4; c[i ? 'lineTo' : 'moveTo'](cx + Math.cos(an) * r, cy + Math.sin(an) * r); } c.closePath(); }
  else if (shape === 'pennant') { c.moveTo(cx - r, cy - r * 0.78); c.lineTo(cx + r * 1.05, cy - r * 0.1); c.lineTo(cx + r * 1.05, cy + r * 0.1); c.lineTo(cx - r, cy + r * 0.78); c.closePath(); }   // a felt sports pennant pointing right
  else if (shape === 'crest') {   // heraldic shield with three crown points
    const k = r * 0.86; c.moveTo(cx - k, cy - k * 0.7); c.lineTo(cx - k * 0.6, cy - k); c.lineTo(cx - k * 0.3, cy - k * 0.72); c.lineTo(cx, cy - k * 1.1); c.lineTo(cx + k * 0.3, cy - k * 0.72); c.lineTo(cx + k * 0.6, cy - k); c.lineTo(cx + k, cy - k * 0.7);
    c.lineTo(cx + k, cy + r * 0.15); c.quadraticCurveTo(cx + k * 0.9, cy + r * 0.72, cx, cy + r); c.quadraticCurveTo(cx - k * 0.9, cy + r * 0.72, cx - k, cy + r * 0.15); c.closePath(); }
  else if (shape === 'star') { for (let i = 0; i < 24; i++) { const an = -Math.PI / 2 + i * Math.PI / 12, rr = i % 2 ? r * 0.82 : r; c[i ? 'lineTo' : 'moveTo'](cx + Math.cos(an) * rr, cy + Math.sin(an) * rr); } c.closePath(); }
  else c.arc(cx, cy, r, 0, Math.PI * 2);
}
// circular badge with the pixel emblem: (cx, cy) centre, r radius
function drawEmblemBadge(c, t, cx, cy, r, alpha = 1) {
  const em = EMBLEMS[t.emblem] || EMBLEMS.star, col = emblemColors(t), L = logoOf(t), bgFill = logoFill(t, L.fill);
  // an ornament on top (stars, crown) needs headroom: shrink the badge a little and drop it, so it all stays inside the logo's box
  if ((L.orn === 'stars' || L.orn === 'crown') && r >= 9) { cy += r * 0.13; r *= 0.86; }
  const ring = colorDist(t.colors.a, t.colors.p) < 70 ? t.colors.s : t.colors.a;
  c.save(); c.globalAlpha *= alpha;
  if (L.shape !== 'none') {
    // background, clipped to the badge shape
    const bgc = logoFill(t, L.fill), alt = L.fill === 's' ? t.colors.p : t.colors.s;
    c.save(); logoPath(c, L.shape, cx, cy, r); c.fillStyle = bgc; c.fill(); c.clip();
    c.fillStyle = alt;
    if (L.bg === 'stripes') for (let k = -4; k <= 4; k += 2) c.fillRect(cx + k * r * 0.2 - r * 0.1, cy - r, r * 0.2, r * 2);
    else if (L.bg === 'halves') c.fillRect(cx, cy - r, r, r * 2);
    else if (L.bg === 'quarters') { c.fillRect(cx, cy - r, r, r); c.fillRect(cx - r, cy, r, r); }
    else if (L.bg === 'sunburst') { c.globalAlpha *= 0.55; for (let i = 0; i < 16; i += 2) { const a0 = i * Math.PI / 8, a1 = (i + 1) * Math.PI / 8; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a0) * r * 1.5, cy + Math.sin(a0) * r * 1.5); c.lineTo(cx + Math.cos(a1) * r * 1.5, cy + Math.sin(a1) * r * 1.5); c.closePath(); c.fill(); } c.globalAlpha /= 0.55; }
    c.restore();
    // border
    if (L.border !== 'none') {
      logoPath(c, L.shape, cx, cy, r); c.lineWidth = r * (L.border === 'thick' ? 0.22 : 0.13); c.strokeStyle = ring; c.stroke();
      if (L.border === 'double') { logoPath(c, L.shape, cx, cy, r * 0.84); c.lineWidth = r * 0.05; c.strokeStyle = t.colors.s; c.stroke(); }
      if (L.border === 'dashed') { logoPath(c, L.shape, cx, cy, r * 0.82); c.setLineDash([r * 0.12, r * 0.09]); c.lineWidth = r * 0.05; c.strokeStyle = '#ffffff'; c.stroke(); c.setLineDash([]); }
      if (L.border === 'laurel') {   // two laurel branches around the badge
        c.fillStyle = '#c9a050';
        for (const sd of [-1, 1]) for (let i = 0; i < 7; i++) { const an = Math.PI / 2 + sd * (0.35 + i * 0.36), lx = cx + Math.cos(an) * r * 1.0, ly = cy + Math.sin(an) * r * 1.0;
          c.save(); c.translate(lx, ly); c.rotate(an + sd * 0.9); c.beginPath(); c.ellipse(0, 0, r * 0.15, r * 0.065, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
      }
      if (L.border === 'studs') { c.fillStyle = '#f2c230'; for (let i = 0; i < 12; i++) { const an = i * Math.PI / 6; c.beginPath(); c.arc(cx + Math.cos(an) * r * 0.9, cy + Math.sin(an) * r * 0.9, r * 0.065, 0, Math.PI * 2); c.fill(); } }
    }
  }
  const sh = emblemShift(em), pen = L.shape === 'pennant', sz = L.shape === 'none' ? 1.8 : pen ? 1.0 : 1.3, ps = (r * sz) / 16, x0 = cx - ps * 8 - (pen ? r * 0.42 : 0) + (L.flip ? -sh.dx : sh.dx) * ps, y0 = cy - ps * 8 - (L.ribbon && !pen ? r * 0.08 : 0) + sh.dy * ps;
  for (let y = 0; y < 16; y++) {
    const row = em.rows[y] || '';
    for (let x = 0; x < 16; x++) {
      const ch = row[L.flip ? 15 - x : x];
      if (!ch || ch === '.') continue;
      const pc = col[ch] || col.a;
      c.fillStyle = ch !== 'k' && L.shape !== 'none' && colorDist(pc, bgFill) < 60 ? shade(pc, lum(pc) > 0.5 ? -0.45 : 0.45) : pc;   // keep the emblem readable on a recoloured badge
      c.fillRect(x0 + x * ps, y0 + y * ps, ps + 0.05, ps + 0.05);
    }
  }
  if (L.orn !== 'none' && r >= 9) {
    const top = cy - r * (L.shape === 'none' ? 0.95 : 1.02), gold = '#f2c230';
    c.fillStyle = L.orn === 'bars' ? ring : gold;
    if (L.orn === 'stars') for (const k of [-1, 0, 1]) { const sx = cx + k * r * 0.34, sy = top - (k ? 0 : r * 0.08), rr = r * 0.12; c.beginPath(); for (let i = 0; i < 10; i++) { const an = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? rr * 0.45 : rr; c[i ? 'lineTo' : 'moveTo'](sx + Math.cos(an) * q, sy + Math.sin(an) * q); } c.closePath(); c.fill(); }
    else if (L.orn === 'bars') for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) c.fillRect(cx + sd * (r * 1.02 + i * r * 0.0) - (sd < 0 ? r * (0.45 - i * 0.1) : 0), cy - r * 0.3 + i * r * 0.22, r * (0.45 - i * 0.1), r * 0.1);
    else if (L.orn === 'crown') { const w0 = r * 0.7, h0 = r * 0.34, bx = cx - w0 / 2, by = top - h0 * 0.6; c.beginPath(); c.moveTo(bx, by + h0); c.lineTo(bx, by); c.lineTo(bx + w0 * 0.25, by + h0 * 0.45); c.lineTo(bx + w0 * 0.5, by - h0 * 0.2); c.lineTo(bx + w0 * 0.75, by + h0 * 0.45); c.lineTo(bx + w0, by); c.lineTo(bx + w0, by + h0); c.closePath(); c.fill(); c.fillStyle = '#e0302a'; c.fillRect(cx - r * 0.05, by + h0 * 0.5, r * 0.1, r * 0.1); }
    else if (L.orn === 'wings') for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? '#ffffff' : gold; c.beginPath(); const wx = cx + sd * r * 0.95, wy = cy - r * 0.35 + i * r * 0.16; c.moveTo(wx, wy); c.lineTo(wx + sd * r * (0.55 - i * 0.1), wy - r * 0.12); c.lineTo(wx + sd * r * (0.5 - i * 0.1), wy + r * 0.06); c.closePath(); c.fill(); }
  }
  if (pen && L.ribbon && r >= 12) {                                              // pennant: the abbreviation runs along the tail
    const sc = Math.max(1, Math.floor(r / 22)), txt = String(t.abbr || '').toUpperCase().slice(0, 3);
    pText(c, txt, Math.round(cx + r * 0.05), Math.round(cy - 2.5 * sc), lum(bgFill) > 0.6 ? '#141832' : '#ffffff', sc);
  } else if (L.ribbon && r >= 12) {                                                     // a ribbon across the bottom with the abbreviation
    const rw = r * 1.5, rh = r * 0.36, ry = cy + r * 0.5;
    c.fillStyle = shade(ring, -0.3); c.fillRect(cx - rw / 2 - rh * 0.5, ry + rh * 0.2, rh * 0.6, rh * 0.8); c.fillRect(cx + rw / 2 - rh * 0.1, ry + rh * 0.2, rh * 0.6, rh * 0.8);
    c.fillStyle = ring; c.fillRect(cx - rw / 2, ry, rw, rh);
    const sc = Math.max(1, Math.floor(rh / 6)), txt = String(t.abbr || '').toUpperCase().slice(0, 3);
    pText(c, txt, Math.round(cx - pTextW(txt, sc) / 2), Math.round(ry + (rh - 5 * sc) / 2), lum(ring) > 0.6 ? '#141832' : '#ffffff', sc);
  }
  c.restore();
}
// how far an emblem's pixels sit from the middle of its 16x16 grid (so badges and crests can centre it)
function emblemShift(em) {
  if (em._shift) return em._shift;
  // optical centre: halfway between the bounding box centre and the centre of mass (a beak or a tail shouldn't drag it off)
  let x0 = 16, x1 = -1, y0 = 16, y1 = -1, sx = 0, sy = 0, n = 0;
  em.rows.forEach((r, y) => { for (let x = 0; x < 16; x++) if (r[x] && r[x] !== '.') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); sx += x; sy += y; n++; } });
  if (!n) return (em._shift = { dx: 0, dy: 0 });
  const cx = ((x0 + x1) / 2 + sx / n) / 2, cy = ((y0 + y1) / 2 + sy / n) / 2, cl = v => Math.max(-2, Math.min(2, v));
  return (em._shift = { dx: cl(7.5 - cx), dy: cl(7.5 - cy) });
}
// plain emblem without badge (for jersey crest previews)
function drawEmblemPlain(c, t, x0, y0, ps) {
  const em = EMBLEMS[t.emblem] || EMBLEMS.star, col = emblemColors(t), sh = emblemShift(em), ox = Math.round(sh.dx), oy = Math.round(sh.dy);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const ch = (em.rows[y] || '')[x]; if (!ch || ch === '.') continue;
    c.fillStyle = col[ch] || col.a; c.fillRect(x0 + (x + ox) * ps, y0 + (y + oy) * ps, ps, ps);
  }
}

// ---------- 3x5 digits for jersey backs
const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
                '111100111001111', '111100111101111', '111001001010010', '111101111101111', '111101111001111'];
function drawDigits(c, num, cx, top, ps, color) {
  const s = String(num), w = s.length * 3 + (s.length - 1);
  let x = cx - Math.floor(w / 2);
  c.fillStyle = color;
  for (const d of s) {
    const bits = DIGITS[+d];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (bits[j * 3 + i] === '1') c.fillRect((x + i) * ps, (top + j) * ps, ps, ps);
    x += 4;
  }
}

// ---------- big uniform preview (customizer / roster): same layout as the in-game sprite, scaled up
function drawUniformPreview(cv, t, away, back, num, opts = {}) {
  const c = cv.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
  const g = !!opts.g, C = teamPalette(t, away), sc = Math.max(1, Math.floor(Math.min(cv.width / (g ? 30 : 24), cv.height / 34)));
  // a goalie is shown as a goalie (mask, pads, blocker and catcher, in his own gear), facing you
  if (typeof drawFigureOn === 'function') drawFigureOn(cv, C, [fakeSkater({ num, g, pl: opts.pl || null, fy: back && !g ? -1 : 1, px: Math.floor(cv.width / 2), py: Math.floor(cv.height / 2 + sc * 14) })], sc);
}

// ---------- trophies (pixel art, 16 x 22). G gold, g dark gold, L highlight, S silver, s dark silver,
// W white, B base dark, b base light, P brass plate, k outline, R red, U blue
const TROPHY_ART = {
  league: { name:'League Championship', rows:[
    '................',
    '..kkkkkkkkkkkk..',
    '.kGGGGGGGGGGGGk.',
    'kGkLGGGGGGGGGkGk',
    'kGkLGGGGGGGGGkGk',
    'kGkLGGGGGGGGgkGk',
    '.kGkGGGGGGGGgkk.',
    '..kkGGGGGGGgk...',
    '....kGGGGGgk....',
    '.....kGGGgk.....',
    '......kGgk......',
    '......kGgk......',
    '.....kGGGgk.....',
    '....kGGGGGgk....',
    '...kkkkkkkkkk...',
    '...kBBBBBBBBk...',
    '...kBPPPPPPBk...',
    '...kBBBBBBBBk...',
    '..kBBBBBBBBBBk..',
    '..kBbbbbbbbbBk..',
    '..kkkkkkkkkkkk..',
    '................'] },
  inv: { name:'Invitational Cup', rows:[
    '................',
    '................',
    '................',
    '...kkkkkkkkkk...',
    '..kSSSSSSSSSSk..',
    '.kSkLSSSSSSsSkS.',
    '.kSkLSSSSSSsk.k.',
    '..kkSSSSSSsk....',
    '....kSSSSsk.....',
    '.....kSSsk......',
    '......kSk.......',
    '......kSk.......',
    '.....kSSsk......',
    '....kkkkkkk.....',
    '....kBBBBBk.....',
    '....kBPPPBk.....',
    '...kBBBBBBBk....',
    '...kkkkkkkkk....',
    '................',
    '................',
    '................',
    '................'] },
  classic: { name:'Classic Trophy', rows:[
    '.......kk.......',
    '......kGGk......',
    '......kGGk......',
    '.....kGLGgk.....',
    '......kGgk......',
    '.....kGGGgk.....',
    '....kGLGGGgk....',
    '....kGLGGGgk....',
    '.....kGGGgk.....',
    '......kGgk......',
    '......kGgk......',
    '......kGgk......',
    '.....kGGGgk.....',
    '.....kkkkkk.....',
    '....kBBBBBBk....',
    '....kBBBBBBk....',
    '....kBPPPPBk....',
    '....kBBBBBBk....',
    '...kBBBBBBBBk...',
    '...kBbbbbbbBk...',
    '...kkkkkkkkkk...',
    '................'] },
  winter: { name:'Winter Cup', rows:[
    '.......kk.......',
    '......kWWk......',
    '.....k.WW.k.....',
    '......kWWk......',
    '..kkkkkkkkkkkk..',
    '.kSSSSSSSSSSSSk.',
    'kSLSSSSUUSSSSssk',
    'kSLSSSUSSUSSSssk',
    '.kSLSSSUUSSSssk.',
    '..kSSSSSSSSssk..',
    '...kkSSSSSSkk...',
    '.....kSSssk.....',
    '......kSsk......',
    '......kSsk......',
    '.....kSSssk.....',
    '....kkkkkkkk....',
    '....kBBBBBBk....',
    '....kBPPPPBk....',
    '...kBBBBBBBBk...',
    '...kBbbbbbbBk...',
    '...kkkkkkkkkk...',
    '................'] },
  stick: { name:'Golden Boot', rows:[
    '................',
    '................',
    '.....kkkk.......',
    '.....kGGk.......',
    '.....kGgk.......',
    '.....kGGk.......',
    '.....kGgk.......',
    '.....kGGkk......',
    '....kGGGGGkk....',
    '....kGgGGGGGkk..',
    '....kGGGGGGGGGk.',
    '....kgggggggggk.',
    '....kkkkkkkkkkk.',
    '.....k.k.k.k.k..',
    '................',
    '....kkkkkkkk....',
    '....kBBBBBBk....',
    '....kBPPPPBk....',
    '...kBBBBBBBBk...',
    '...kBbbbbbbBk...',
    '...kkkkkkkkkk...',
    '................'] },
  mvp: { name:'League MVP', rows:[
    '................',
    '.......kk.......',
    '......kGGk......',
    '......kGGk......',
    '.kkkkkkGGkkkkkk.',
    '.kGGGGGLGGGGGGk.',
    '..kGGGGLGGGGgk..',
    '...kGGGGGGGgk...',
    '....kGGGGGgk....',
    '...kGGGkkGGgk...',
    '..kGGgk..kGGgk..',
    '..kGk......kgk..',
    '..kk........kk..',
    '......kGgk......',
    '......kGgk......',
    '....kkkkkkkk....',
    '....kBBBBBBk....',
    '....kBPPPPBk....',
    '...kBBBBBBBBk...',
    '...kBbbbbbbBk...',
    '...kkkkkkkkkk...',
    '................'] },
  glove: { name:'Golden Glove', rows:[
    '................',
    '................',
    '....kk.kk.......',
    '...kGGkGGk.kk...',
    '...kGGkGGkkGGk..',
    '...kGLkGGkGGGk..',
    '...kGLGGGGGGgk..',
    '..kkGLGGGGGGgk..',
    '.kGGkGGGGGGGgk..',
    '.kGGGGGGGGGGgk..',
    '..kGGGGGGGGGgk..',
    '...kGGGGGGGgk...',
    '....kGGGGGgk....',
    '....kGGGGGgk....',
    '....kkkkkkkk....',
    '....kBBBBBBk....',
    '....kBBBBBBk....',
    '....kBPPPPBk....',
    '...kBBBBBBBBk...',
    '...kBbbbbbbBk...',
    '...kkkkkkkkkk...',
    '................'] },
  pmvp: { name:'Playoff MVP', rows:[
    '................',
    '....kkk..kkk....',
    '....kRk..kUk....',
    '.....kRkkUk.....',
    '......kRUk......',
    '......kkkk......',
    '.....kGGGGk.....',
    '....kGLGGGgk....',
    '...kGLGGGGGgk...',
    '...kGLGGkGGgk...',
    '...kGGGkkGGgk...',
    '...kGGGGkGGgk...',
    '....kGGGGGgk....',
    '.....kggggk.....',
    '......kkkk......',
    '....kkkkkkkk....',
    '....kBBBBBBk....',
    '....kBPPPPBk....',
    '...kBBBBBBBBk...',
    '...kBbbbbbbBk...',
    '...kkkkkkkkkk...',
    '................'] },
};
TROPHY_ART.finale = { name:'Season Finale Cup', rows:[
    '................',
    '..kkkkkkkkkkkk..',
    '.kGGGGGGGGGGGGk.',
    'kkGLGGGGGGGGgGkk',
    'kGkLMMMMMMMMgkGk',
    'kGkLMMMMMMMMgkGk',
    '.kkLGGGGGGGGgkk.',
    '...kGGGGGGGgk...',
    '....kGGGGGgk....',
    '.....kGGGgk.....',
    '......kGgk......',
    '......kGgk......',
    '.....kGGGgk.....',
    '....kkkkkkkk....',
    '....kMMMMMMk....',
    '...kBBBBBBBBk...',
    '...kBPPPPPPBk...',
    '..kBBBBBBBBBBk..',
    '..kBbbbbbbbbBk..',
    '..kkkkkkkkkkkk..',
    '................',
    '................'] };
TROPHY_ART.toc = { name:'Tournament of Champions', rows:[
    '..kGk.kGk.kGk...',
    '..kGGkGGGkGGk...',
    '..kGRGGUGGRGk...',
    '...kkkkkkkkk....',
    '.kGGGGGGGGGGGk..',
    'kGkLGGGGGGGgkGk.',
    'kGkLGGGGGGGgkGk.',
    '.kkLGGGGGGGgkk..',
    '...kGGGGGGgk....',
    '....kGGGGgk.....',
    '.....kGGgk......',
    '......kGk.......',
    '.....kGGgk......',
    '....kkkkkkk.....',
    '...kDDDDDDDk....',
    '...kDPPPPPDk....',
    '..kDDDDDDDDDk...',
    '..kDGGGGGGGDk...',
    '..kDDDDDDDDDk...',
    '..kkkkkkkkkkk...',
    '................',
    '................'] };
for (const [k, v] of [['rookie', 'inv'], ['def', 'classic'], ['tmvp', 'pmvp'], ['tgoal', 'glove'], ['tscore', 'stick']]) if (!TROPHY_ART[k]) TROPHY_ART[k] = TROPHY_ART[v] || TROPHY_ART.league;
const TROPHY_COL = { D:'#1d1d26', M:'#7a1630', G:'#f2c230', g:'#b8860b', L:'#fff3a8', S:'#d6dbe4', s:'#8a92a8', W:'#ffffff', B:'#5a3a1e', b:'#8a5a2b', P:'#e0b050', k:'#141832', R:'#e0302a', U:'#2f6fe8' };
function drawTrophy(c, type, x, y, ps, glow) {
  const t = TROPHY_ART[type] || TROPHY_ART.league;
  if (glow) {
    const g = c.createRadialGradient(x + 8 * ps, y + 9 * ps, ps, x + 8 * ps, y + 9 * ps, 13 * ps);
    g.addColorStop(0, 'rgba(255,240,170,.45)'); g.addColorStop(1, 'rgba(255,240,170,0)');
    c.fillStyle = g; c.fillRect(x - 6 * ps, y - 4 * ps, 28 * ps, 28 * ps);
  }
  for (let j = 0; j < t.rows.length; j++) for (let i = 0; i < 16; i++) {
    const ch = t.rows[j][i]; if (!ch || ch === '.') continue;
    c.fillStyle = TROPHY_COL[ch] || '#f0f'; c.fillRect(x + i * ps, y + j * ps, ps, ps);
  }
}

// ====================================================================
//  PLAYER LOOKS: a stable face for every player (deterministic from the player id)
// ====================================================================
const SKIN = [['#f6d2b3', '#d9ad8c'], ['#eec39a', '#cf9f78'], ['#d9a173', '#b67f55'], ['#b97a4f', '#965d38'], ['#8d5a3b', '#6d4229'], ['#5e3b27', '#47291a']];
const HAIR = ['#1e1a17', '#4a2e1c', '#7a4f2a', '#c9a24a', '#a8462a', '#8f8f97'];
const CELEBRATIONS = { fist: 'Fist pump', stick: 'Boot raise', arms: 'Arms raised', slide: 'Knee slide', spin: 'Roulette', huddle: 'Team huddle' };
function hashId(s) { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
function makeLook(id, age) {
  const r = mulberrySeed(hashId('look-' + id));
  const grey = (age || 25) >= 33 && r() < 0.5;
  return { skin: Math.floor(r() * 6), hair: grey ? 5 : Math.floor(r() * 5), style: Math.floor(r() * 5), beard: Math.floor(r() * 5), helmet: Math.floor(r() * 3), eyes: Math.floor(r() * 2),
    celeb: Object.keys(CELEBRATIONS)[Math.floor(r() * 6)] };
}
function mulberrySeed(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const lookOf = p => p.look || (p.look = makeLook(p.id || p.pid || (p.first + p.last), p.age));
// 16 x 16 portrait: helmet in team colours, face, hair, facial hair, jersey with number (+ C/A)
function drawPortrait16(c, p, team, x, y, ps, opts = {}) {   // (the old 16 x 16 portrait, kept for reference)
  const L = lookOf(p), sk = SKIN[L.skin], hc = HAIR[L.hair];
  const col = team && team.colors ? { m: team.colors.p, d: team.colors.s, t: team.colors.a } : team ? { m: team.main, d: team.dark, t: team.trim } : { m: '#4a5070', d: '#2a2e45', t: '#c9ced8' };
  const r = (i, j, w, h, k) => { c.fillStyle = k; c.fillRect(x + i * ps, y + j * ps, w * ps, h * ps); };
  r(0, 0, 16, 16, opts.bg || shade(col.d, -0.35));
  r(0, 15, 16, 1, 'rgba(0,0,0,.35)');
  // shoulders + jersey
  r(1, 12, 14, 4, col.m); r(1, 12, 14, 1, col.t); r(6, 12, 4, 1, sk[1]); r(7, 12, 2, 2, col.d);
  if (p.pos === 'G') { r(1, 13, 3, 3, '#f2f2f2'); r(12, 13, 3, 3, '#f2f2f2'); }
  // neck + face
  r(6, 10, 4, 2, sk[1]);
  r(4, 4, 8, 7, sk[0]); r(4, 10, 8, 1, sk[1]); r(11, 5, 1, 5, sk[1]);
  // hair poking out (styles: short, mullet, curly, long, buzz)
  if (L.style === 1) { r(3, 7, 1, 5, hc); r(12, 7, 1, 5, hc); r(2, 9, 1, 3, hc); r(13, 9, 1, 3, hc); }
  else if (L.style === 2) { r(3, 5, 1, 3, hc); r(12, 5, 1, 3, hc); r(3, 4, 1, 1, hc); r(12, 4, 1, 1, hc); }
  else if (L.style === 3) { r(3, 5, 1, 6, hc); r(12, 5, 1, 6, hc); }
  else if (L.style === 0) { r(3, 5, 1, 2, hc); r(12, 5, 1, 2, hc); }
  // eyes, brows, nose, mouth
  r(5, 6, 2, 1, hc); r(9, 6, 2, 1, hc);
  if (L.eyes) { r(5, 7, 2, 1, '#20222b'); r(9, 7, 2, 1, '#20222b'); } else { r(6, 7, 1, 1, '#20222b'); r(9, 7, 1, 1, '#20222b'); }
  r(7, 8, 2, 1, sk[1]);
  r(6, 9, 4, 1, '#7a3b2e');
  // facial hair: none, stubble, moustache, full beard, goatee
  if (L.beard === 1) { c.globalAlpha = 0.35; r(4, 9, 8, 2, hc); c.globalAlpha = 1; }
  else if (L.beard === 2) r(6, 9, 4, 1, hc);
  else if (L.beard === 3) { r(4, 8, 1, 3, hc); r(11, 8, 1, 3, hc); r(5, 9, 6, 2, hc); r(6, 9, 4, 1, '#7a3b2e'); }
  else if (L.beard === 4) r(7, 10, 2, 1, hc);
  // helmet (classic / visor / ear guards)
  r(3, 1, 10, 4, col.m); r(4, 0, 8, 1, col.m); r(3, 4, 10, 1, col.d); r(5, 1, 3, 1, 'rgba(255,255,255,.35)');
  if (L.helmet === 1) { c.globalAlpha = 0.45; r(4, 5, 8, 2, '#cfe6ff'); c.globalAlpha = 1; r(4, 5, 8, 1, 'rgba(255,255,255,.5)'); }
  if (L.helmet === 2) { r(3, 5, 1, 3, col.m); r(12, 5, 1, 3, col.m); }
  r(3, 5, 1, 1, col.d); r(12, 5, 1, 1, col.d);
  // number and captaincy on the jersey
  if (opts.num != null) drawDigits(c, opts.num, x + 12 * ps, y + 13 * ps - 1, Math.max(1, ps / 2.5), numColor({ main: col.m, trim: col.t, dark: col.d }));
  if (opts.cap) { c.fillStyle = col.t; const L2 = opts.cap === 'C' ? ['111', '100', '111'] : ['010', '111', '101']; L2.forEach((row, j) => [...row].forEach((b, i) => { if (b === '1') c.fillRect(x + (2 + i * 0.67) * ps, y + (13 + j * 0.67) * ps, ps * 0.67, ps * 0.67); })); }
  if (opts.fav) { c.fillStyle = '#ffd23f'; c.font = `${Math.round(ps * 4)}px sans-serif`; c.textBaseline = 'top'; c.fillText('★', x + 0.4 * ps, y + 0.2 * ps); }
}

// ---------- PLAYER PORTRAIT: head and shoulders on a 32 x 32 pixel grid (ps = the size of the old 16-grid pixel, so
// each portrait pixel is ps / 2). Shaded face, eyes, brows, nose; his hairstyle and facial hair; helmet with shine,
// vents, rim and chinstrap (visor / ear guards); goalies in their painted mask and cage; jersey with yoke and collar.
function drawPortrait(c, p, team, x, y, ps, opts = {}) {
  const L = lookOf(p), sk = SKIN[L.skin], hc = HAIR[L.hair], q = ps / 2;
  const col = team && team.colors ? { m: team.colors.p, d: team.colors.s, t: team.colors.a } : team ? { m: team.main, d: team.dark, t: team.trim } : { m: '#4a5070', d: '#2a2e45', t: '#c9ced8' };
  let helm = col.m;
  try { if (typeof gearOf === 'function' && typeof gearCol === 'function') { const uni = team && team.colors && typeof teamPalette === 'function' ? teamPalette(team, false).uni : null, gc = gearCol(p.pos !== 'G' && uni ? Object.assign({}, gearOf(p), uni) : gearOf(p), 'helmet', { main: col.m, dark: col.d, trim: col.t, helm: col.m }); if (gc) helm = gc; } } catch (e) {}
  const s0 = sk[0], s1 = sk[1], s2 = shade(sk[1], -0.2), sL = shade(sk[0], 0.07), hD = shade(hc, -0.3), hL = shade(hc, 0.22);
  const r = (i, j, w, h, k) => { c.fillStyle = k; c.fillRect(x + i * q, y + j * q, w * q, h * q); };
  const goalie = p.pos === 'G';
  // background: the team's dark colour, a darker frame
  const bg = opts.bg || shade(col.d, -0.35);
  r(0, 0, 32, 32, bg); r(0, 0, 32, 1, shade(bg, -0.3)); r(0, 31, 32, 1, shade(bg, -0.3)); r(0, 0, 1, 32, shade(bg, -0.3)); r(31, 0, 1, 32, shade(bg, -0.3));
  r(1, 1, 30, 14, shade(bg, 0.06));
  // shoulders and jersey: trim yoke over the shoulders, a V collar, shading toward his left
  const jm = col.m, jD = shade(col.m, -0.2), jL = shade(col.m, 0.1);
  r(3, 26, 26, 6, jm); r(2, 27, 28, 5, jm); r(1, 28, 1, 4, jm); r(30, 28, 1, 4, jD); r(5, 25, 22, 1, jm);
  r(23, 26, 7, 6, jD); r(2, 27, 5, 5, jL);
  r(5, 25, 22, 2, col.t); r(3, 26, 3, 2, col.t); r(26, 26, 3, 2, col.t);
  r(13, 25, 6, 1, col.d); r(14, 26, 4, 1, col.d); r(15, 27, 2, 1, col.d);
  if (goalie) { r(1, 27, 5, 5, '#eef1f6'); r(26, 27, 5, 5, '#dfe3ec'); r(1, 27, 5, 1, '#c9ced8'); r(26, 27, 5, 1, '#c9ced8'); }
  // neck
  r(12, 22, 8, 4, s1); r(12, 22, 3, 3, s0); r(12, 25, 8, 1, s2);
  let realMask = null;
  if (goalie && typeof drawGoalieMask === 'function' && typeof document !== 'undefined' && typeof gearOf === 'function') {
    // his real mask (the exact in-game design and paint), each mask pixel two portrait pixels
    try {
      const pal = team && typeof teamPalette === 'function' && team.colors ? teamPalette(team, false) : { main: col.m, dark: col.d, trim: col.t };
      const tmp = document.createElement('canvas'); tmp.width = 14; tmp.height = 14; const keep = ctx;
      try { ctx = tmp.getContext('2d'); drawGoalieMask(gearOf(p), pal, 2, 3); } finally { ctx = keep; }
      realMask = tmp;
    } catch (e) { realMask = null; }
  }
  if (goalie && realMask) {
    r(1, 25, 7, 3, shade(col.m, 0.12)); r(24, 25, 7, 3, shade(col.m, -0.1));
    c.save(); c.beginPath(); c.rect(x, y, 32 * q, 32 * q); c.clip(); c.imageSmoothingEnabled = false;
    c.globalAlpha = 0.35; c.drawImage(realMask, x + 3 * q, y - 3 * q, 28 * q, 28 * q); c.globalAlpha = 1;
    c.drawImage(realMask, x + 2 * q, y - 4 * q, 28 * q, 28 * q); c.restore();
  } else if (goalie) {
    // GOALIE MASK: the painted shell over the whole head, the cage over his face
    // painted in his own mask design: team split (left half in the team colour), classic white, bucket, or a team-colour shell
    let gm = 'team'; try { if (typeof gearOf === 'function') gm = gearOf(p).mask || 'team'; } catch (e) {}
    const mk = gm === 'white' || gm === 'team' ? '#eef1f6' : gm === 'retro' ? '#d8c79a' : gm === 'bucket' ? helm : gm === 'chrome' ? '#c9d2de' : gm === 'gold' ? '#e8c04a' : col.m, mD = shade(mk, -0.22);
    r(11, 1, 10, 1, mk); r(9, 2, 14, 1, mk); r(8, 3, 16, 17, mk); r(9, 20, 14, 2, mk); r(11, 22, 10, 1, mk);
    if (gm === 'team') { r(9, 2, 6, 1, col.m); r(8, 3, 7, 17, col.m); r(9, 20, 6, 2, col.m); r(11, 22, 4, 1, col.m); r(11, 1, 4, 1, col.m); }
    r(21, 3, 3, 17, mD); r(20, 20, 3, 2, mD); r(9, 21, 14, 1, mD);
    if (gm !== 'white' && gm !== 'bucket') { r(10, 2, 12, 2, gm === 'team' ? col.t : shade(mk, 0.15)); r(15, 1, 2, 21, col.t); }
    else r(15, 1, 2, 9, col.m);
    // chunky shoulder pads under the jersey (goalies are wide)
    r(1, 25, 7, 3, shade(col.m, 0.12)); r(24, 25, 7, 3, shade(col.m, -0.1));
    r(10, 4, 3, 1, 'rgba(255,255,255,.6)');
    r(10, 10, 12, 10, '#262a36');
    r(11, 12, 3, 1, '#e9ecf2'); r(18, 12, 3, 1, '#e9ecf2'); r(12, 12, 1, 1, '#20222b'); r(19, 12, 1, 1, '#20222b');
    c.fillStyle = '#d0d5df';
    for (const yy of [10, 13, 16, 19]) c.fillRect(x + 10 * q, y + yy * q, 12 * q, Math.max(1, q * 0.7));
    for (const xx of [11, 14, 17, 20]) c.fillRect(x + xx * q, y + 10 * q, Math.max(1, q * 0.7), 10 * q);
  } else {
    // ears, the face (rounded jaw), shading on his left side and under the chin
    r(8, 12, 1, 5, s1); r(23, 12, 1, 5, s2); r(8, 13, 1, 2, s0);
    r(9, 9, 14, 11, s0); r(10, 20, 12, 1, s0); r(11, 21, 10, 1, s0); r(13, 22, 6, 1, s1);
    r(21, 9, 2, 11, s1); r(20, 20, 2, 1, s1); r(19, 21, 2, 1, s1); r(10, 10, 2, 6, sL);
    // hair below the helmet
    if (L.style === 1) { r(8, 10, 1, 3, hc); r(23, 10, 1, 3, hD); r(7, 15, 2, 9, hc); r(23, 15, 2, 9, hD); r(9, 22, 3, 3, hc); r(20, 22, 3, 3, hD); }   // mullet
    else if (L.style === 2) { r(7, 9, 2, 4, hc); r(23, 9, 2, 4, hD); r(7, 9, 1, 1, hL); r(8, 13, 1, 1, hc); r(23, 13, 1, 1, hD); r(7, 11, 1, 1, hL); }   // curly
    else if (L.style === 3) { r(7, 9, 2, 13, hc); r(23, 9, 2, 13, hD); r(7, 9, 1, 5, hL); }                                                       // long
    else if (L.style === 0) { r(8, 9, 1, 3, hc); r(23, 9, 1, 3, hD); }                                                                           // short
    else { r(8, 9, 1, 2, shade(hc, 0.1)); r(23, 9, 1, 2, hD); }                                                                                 // buzz
    // brows, eyes, nose, mouth
    r(10, 11, 4, 1, hc); r(18, 11, 4, 1, hc); r(13, 11, 1, 1, hD); r(18, 11, 1, 1, hD);
    if (L.eyes) { r(10, 13, 4, 1, '#f1f1ee'); r(18, 13, 4, 1, '#f1f1ee'); r(12, 13, 1, 1, '#20222b'); r(19, 13, 1, 1, '#20222b'); r(11, 13, 1, 1, '#5a4a3a'); r(20, 13, 1, 1, '#5a4a3a'); }
    else { r(11, 13, 3, 1, '#f1f1ee'); r(18, 13, 3, 1, '#f1f1ee'); r(12, 13, 1, 1, '#20222b'); r(19, 13, 1, 1, '#20222b'); }
    r(10, 14, 4, 1, s1); r(18, 14, 4, 1, s1);
    r(15, 13, 2, 4, s0); r(16, 14, 1, 3, s1); r(14, 17, 4, 1, s2); r(15, 16, 1, 1, sL);
    r(13, 19, 6, 1, '#7a3b2e'); r(14, 20, 4, 1, shade(s1, -0.06)); r(13, 18, 1, 1, s1); r(18, 18, 1, 1, s1);
    // facial hair: stubble, moustache, full beard, goatee
    if (L.beard === 1) { c.globalAlpha = 0.3; r(10, 17, 12, 4, hc); r(11, 21, 10, 1, hc); r(13, 22, 6, 1, hc); c.globalAlpha = 1; }
    else if (L.beard === 2) { r(12, 18, 8, 1, hc); r(12, 19, 1, 1, hc); r(19, 19, 1, 1, hD); }
    else if (L.beard === 3) { r(9, 14, 1, 6, hc); r(22, 14, 1, 6, hD); r(10, 17, 12, 4, hc); r(11, 21, 10, 1, hc); r(13, 22, 6, 1, hD); r(12, 18, 8, 1, hc); r(13, 19, 6, 1, '#7a3b2e'); r(20, 17, 2, 4, hD); }
    else if (L.beard === 4) { r(13, 20, 6, 2, hc); r(14, 22, 4, 1, hD); r(12, 18, 8, 1, hc); }
    // HELMET: dome with a shine, two vents, the rim across his forehead, chinstrap (or ear guards / visor)
    const hD2 = shade(helm, -0.25), hL2 = shade(helm, 0.3), hDD = shade(helm, -0.4);
    r(11, 1, 10, 1, helm); r(9, 2, 14, 1, helm); r(8, 3, 16, 6, helm); r(8, 9, 16, 1, hD2);
    r(21, 2, 2, 7, hD2); r(23, 4, 1, 5, hDD);
    r(10, 2, 4, 1, hL2); r(9, 3, 2, 2, hL2); r(11, 3, 1, 1, 'rgba(255,255,255,.45)');
    r(14, 3, 1, 2, hDD); r(17, 3, 1, 2, hDD);
    r(8, 8, 16, 1, shade(helm, -0.12));
    if (L.helmet === 2) { r(7, 9, 2, 7, helm); r(23, 9, 2, 7, hD2); r(7, 9, 2, 1, hL2); }
    else { r(8, 10, 1, 7, '#2a2c34'); r(23, 10, 1, 7, '#2a2c34'); r(9, 17, 1, 3, '#2a2c34'); r(22, 17, 1, 3, '#2a2c34'); }
    let vz = null; try { if (typeof gearOf === 'function') vz = gearOf(p).visor; } catch (e) {}
    if (vz === 'cage') {                                                        // full cage: wire frame, a bar between the eyes, chin cup
      const m1 = '#e6ebf3', m2 = '#b8c0cc';
      r(8, 10, 16, 1, m1); r(8, 10, 1, 12, m1); r(23, 10, 1, 12, m1);
      r(15, 11, 2, 10, m2); r(9, 16, 14, 1, m2); r(9, 19, 14, 1, m2);
      r(10, 22, 12, 1, m1); r(12, 23, 8, 1, m2);
    } else if (L.helmet === 1) {
      c.globalAlpha = 0.4; r(8, 9, 16, 5, '#cfe6ff'); c.globalAlpha = 1;
      r(8, 9, 16, 1, 'rgba(255,255,255,.7)'); r(9, 10, 4, 1, 'rgba(255,255,255,.45)'); r(8, 13, 16, 1, 'rgba(110,140,180,.55)');
    }
  }
  // number and captaincy on the jersey, favourite star
  if (opts.num != null) drawDigits(c, opts.num, x + 24 * q, y + 28 * q - 1, Math.max(1, q / 1.25), numColor({ main: col.m, trim: col.t, dark: col.d }));
  if (opts.cap) { c.fillStyle = col.t; const L2 = opts.cap === 'C' ? ['111', '100', '111'] : ['010', '111', '101']; L2.forEach((row, j) => [...row].forEach((b, i) => { if (b === '1') c.fillRect(x + (5 + i) * q, y + (28 + j) * q, q, q); })); }
  if (opts.fav) { c.fillStyle = '#ffd23f'; c.font = `${Math.round(ps * 4)}px sans-serif`; c.textBaseline = 'top'; c.fillText('★', x + 0.4 * ps, y + 0.2 * ps); }
}

// ---------- EMPTY STATES (art audit, Nov 22): a small pixel scene instead of a bare line of text on empty tabs.
// Drawn with plain rectangles at 96x44 and shown at 3x, in the same flat, outlined style as the trophy rooms.
function emptyStateArt(kind) {
  const W0 = 96, H0 = 44, cv = document.createElement('canvas'); cv.width = W0; cv.height = H0;
  cv.className = 'px emptyart'; cv.style.width = (W0 * 3) + 'px'; cv.style.height = (H0 * 3) + 'px';
  const c = cv.getContext('2d'), R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  if (kind === 'cabinet') {
    // a glass-fronted wooden cabinet, shelves empty, a little dust and one cobweb
    R(28, 2, 40, 41, '#2a1608'); R(29, 3, 38, 39, '#7a4a22'); R(30, 4, 36, 2, '#9a6232');
    R(31, 7, 34, 33, '#1c2238');
    for (const y of [17, 28]) { R(31, y, 34, 2, '#5e3a1a'); R(31, y, 34, 1, '#8a5a2c'); }
    R(31, 38, 34, 2, '#5e3a1a');
    R(48, 7, 1, 33, '#4a2c12');                                           // the two doors
    c.globalAlpha = 0.18; R(33, 8, 2, 30, '#ffffff'); R(51, 8, 2, 30, '#ffffff'); c.globalAlpha = 1;   // glass glint
    R(46, 22, 1, 3, '#ffd23f'); R(50, 22, 1, 3, '#ffd23f');               // brass handles
    // faint outlines where the first pieces will stand
    c.globalAlpha = 0.28; c.strokeStyle = '#9aa3c7'; c.setLineDash([1, 1]); c.lineWidth = 1;
    c.strokeRect(36.5, 9.5, 7, 7); c.strokeRect(53.5, 10.5, 6, 6); c.strokeRect(41.5, 21.5, 6, 6); c.setLineDash([]); c.globalAlpha = 1;
    c.strokeStyle = 'rgba(220,225,240,.45)'; c.beginPath(); c.moveTo(31, 7); c.lineTo(36, 7); c.moveTo(31, 7); c.lineTo(31, 12); c.moveTo(31, 7); c.lineTo(34, 10); c.stroke();
    for (const [x, y] of [[38, 32], [56, 25], [44, 13], [60, 34]]) R(x, y, 1, 1, '#6a7090');
    R(26, 42, 44, 2, '#120a04');
  } else if (kind === 'history') {
    // the rafters, with an empty banner hanging, waiting for its first season
    R(0, 0, W0, 6, '#10131f'); for (let x = 2; x < W0; x += 12) R(x, 2, 8, 2, '#1c2238');
    R(47, 6, 1, 4, '#6a7090');
    R(36, 10, 24, 26, '#1c2440'); R(36, 10, 24, 2, '#ffd23f');
    c.beginPath(); c.moveTo(36, 36); c.lineTo(48, 42); c.lineTo(60, 36); c.closePath(); c.fillStyle = '#1c2440'; c.fill();
    c.globalAlpha = 0.5; c.strokeStyle = '#9aa3c7'; c.setLineDash([1, 1]); c.strokeRect(40.5, 16.5, 15, 13); c.setLineDash([]); c.globalAlpha = 1;
    for (const [x, y] of [[47, 19], [48, 19], [46, 20], [49, 20], [49, 21], [48, 22], [48, 23], [48, 25]]) R(x, y, 1, 1, '#9aa3c7');   // a small question mark
    R(14, 12, 12, 20, '#141a30'); R(70, 12, 12, 20, '#141a30');           // other clubs' banners, out of focus
    R(14, 12, 12, 1, '#5a6170'); R(70, 12, 12, 1, '#5a6170');
  } else {
    // a big screen with nothing on it: static and NO SIGNAL
    R(22, 2, 52, 34, '#05060d'); R(24, 4, 48, 30, '#1a1f33');
    for (let y = 5; y < 33; y += 2) for (let x = 25; x < 71; x += 3) if (((x * 7 + y * 13) % 5) < 2) R(x, y, 1, 1, '#3a4160');
    const tw = typeof pTextW === 'function' ? pTextW('NO SIGNAL') : 34;
    R(48 - Math.ceil(tw / 2) - 3, 15, tw + 6, 9, '#05060d'); if (typeof pText === 'function') pText(c, 'NO SIGNAL', 48 - Math.ceil(tw / 2), 17, '#9aa3c7');
    R(46, 36, 4, 4, '#2a3050'); R(38, 40, 20, 2, '#2a3050');
  }
  return cv;
}
// an empty tab: the scene, then the message underneath
function emptyState(kind, text, cls = 'panel') {
  return h('div', { class: cls + ' emptystate' }, emptyStateArt(kind), h('div', { class: 'sub' }, text));
}
