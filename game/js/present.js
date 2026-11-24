'use strict';
// ====================================================================
//  PRESENTATION: one visual identity per competition, reused by the hub,
//  the pregame screen, the arena, intros, celebrations, trophies and replays.
//  (loaded after engine.js / arena.js; shares their globals)
// ====================================================================
const TOURNEY = {
  reg:     { key: 'reg', name: 'Regular Season', short: 'REGULAR SEASON', main: '#1d2449', dark: '#10142a', accent: '#9aa3c7', metal: '#c9d4e6', text: '#ffffff', emblem: 'puck', trophy: null },
  inv:     { key: 'inv', name: 'Opening Invitational', short: 'OPENING INVITATIONAL', main: '#1f4f9a', dark: '#0d2650', accent: '#dfe6f1', metal: '#b9c3d3', text: '#ffffff', emblem: 'scroll', trophy: 'inv', sting: [523, 659, 784, 1047] },
  classic: { key: 'classic', name: 'Midseason Classic', short: 'MIDSEASON CLASSIC', main: '#8c1d22', dark: '#45090c', accent: '#d08a3c', metal: '#e7a862', text: '#fff4e6', emblem: 'crest', trophy: 'classic', sting: [392, 494, 587, 784] },
  winter:  { key: 'winter', name: 'Winter Cup', short: 'WINTER CUP', main: '#3d8fc9', dark: '#12395c', accent: '#ffffff', metal: '#d6ecff', text: '#ffffff', emblem: 'flake', trophy: 'winter', sting: [659, 784, 988, 1319] },
  finale:  { key: 'finale', name: 'Season Finale Cup', short: 'SEASON FINALE CUP', main: '#6b1530', dark: '#2e0814', accent: '#e3b24a', metal: '#f4d58a', text: '#fff1e0', emblem: 'star', trophy: 'finale', sting: [440, 554, 659, 880] },
  toc:     { key: 'toc', name: 'Tournament of Champions', short: 'TOURNAMENT OF CHAMPIONS', main: '#0d0d12', dark: '#000000', accent: '#e8b923', metal: '#ffdf73', text: '#fff7d6', emblem: 'crown', trophy: 'toc', sting: [392, 523, 659, 784, 1047, 1319] },
  po:      { key: 'po', name: 'League Championship', short: 'LEAGUE CHAMPIONSHIP', main: '#14275e', dark: '#081233', accent: '#e8b923', metal: '#f1f3f8', text: '#ffffff', emblem: 'league', trophy: 'league', sting: [392, 523, 659, 784, 1047] },
};
const tourneyTheme = key => TOURNEY[key] || TOURNEY.reg;
const TIER_LABEL = ['', 'SEMIFINAL', 'CHAMPIONSHIP FINAL'];
const FINALS_GRAND = { toc: true, po: true };   // the most prestigious intros run a little longer

// ---------- emblems (procedural pixel art on a 16x16 grid)
function drawTourneyEmblem(c, key, cx, cy, size) {
  const th = tourneyTheme(key), ps = size / 16, x0 = cx - size / 2, y0 = cy - size / 2;
  const col = { k: '#0a0b14', m: th.main, d: th.dark, a: th.accent, g: th.metal, w: '#f4f7fc', r: '#c0392b' };
  const r = (x, y, w, h, k) => { c.fillStyle = col[k] || k; c.fillRect(x0 + x * ps, y0 + y * ps, w * ps, h * ps); };
  const circle = (cx2, cy2, rad, k) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + 0.5 - cx2) ** 2 + (y + 0.5 - cy2) ** 2 <= rad * rad) r(x, y, 1, 1, k); };
  if (th.emblem === 'scroll') {                // invitation scroll with a wax seal
    r(3, 2, 10, 12, 'k'); r(4, 3, 8, 10, 'w');
    for (const yy of [5, 7, 9]) r(5, yy, yy === 9 ? 4 : 6, 1, 'm');
    r(1, 1, 14, 3, 'k'); r(2, 2, 12, 1, 'g'); r(1, 12, 14, 3, 'k'); r(2, 13, 12, 1, 'g');
    circle(11.5, 11, 2.3, 'm'); r(11, 10, 1, 2, 'a'); r(10, 13, 1, 3, 'm'); r(12, 13, 1, 3, 'm');
  } else if (th.emblem === 'crest') {          // shield with crossed sticks
    for (let y = 1; y < 15; y++) { const ins = Math.max(0, y - 9); r(2 + ins, y, 12 - ins * 2, 1, 'k'); if (y > 1 && y < 14) r(3 + ins, y, 10 - ins * 2, 1, y < 4 ? 'a' : 'm'); }
    for (let k = 0; k < 8; k++) { r(4 + k, 4 + k, 1, 1, 'w'); r(11 - k, 4 + k, 1, 1, 'w'); }
    r(3, 11, 3, 1, 'k'); r(10, 11, 3, 1, 'k'); r(7, 2, 2, 1, 'k');
  } else if (th.emblem === 'flake') {          // snowflake on an ice disc
    circle(8, 8, 7.6, 'k'); circle(8, 8, 6.8, 'm');
    r(7.5, 2, 1, 12, 'w'); r(2, 7.5, 12, 1, 'w');
    for (let k = -4; k <= 4; k++) { r(7.5 + k, 7.5 + k, 1, 1, 'w'); r(7.5 + k, 7.5 - k, 1, 1, 'w'); }
    for (const [x, y] of [[7, 2], [7, 13], [2, 7], [13, 7]]) r(x, y, 2, 1, 'a');
    r(6, 3, 1, 1, 'w'); r(9, 3, 1, 1, 'w'); r(6, 12, 1, 1, 'w'); r(9, 12, 1, 1, 'w');
  } else if (th.emblem === 'crown') {          // crown over a puck
    r(2, 10, 12, 5, 'k'); r(3, 11, 10, 2, '#2b2d3a'); r(3, 13, 10, 1, '#15161e');
    r(2, 5, 12, 5, 'k'); r(3, 6, 10, 3, 'a');
    for (const x of [2, 7, 12]) { r(x, 2, 2, 4, 'k'); r(x + 0.5, 3, 1, 3, 'a'); }
    r(4, 7, 1, 1, 'r'); r(7.5, 7, 1, 1, 'w'); r(11, 7, 1, 1, 'r');
  } else if (th.emblem === 'star') {           // finale: a gold star on a burgundy roundel
    circle(8, 8, 7.6, 'k'); circle(8, 8, 6.8, 'm');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const a = Math.atan2(y + 0.5 - 8, x + 0.5 - 8) + Math.PI / 2, rr = hyp(x + 0.5 - 8, y + 0.5 - 8);
      const k = (Math.cos(5 * a) + 1) / 2, lim = 2.4 + k * 3.4;
      if (rr <= lim) r(x, y, 1, 1, rr < 1.5 ? 'g' : 'a');
    }
  } else if (th.emblem === 'league') {         // league crest: shield, puck, three stars
    for (let y = 1; y < 15; y++) { const ins = Math.max(0, y - 9); r(2 + ins, y, 12 - ins * 2, 1, 'k'); if (y > 1 && y < 14) r(3 + ins, y, 10 - ins * 2, 1, y < 5 ? 'w' : 'm'); }
    r(4, 3, 1, 1, 'r'); r(7.5, 2.5, 1, 1, 'r'); r(11, 3, 1, 1, 'r');
    r(5, 7, 6, 3, 'k'); r(5, 7, 6, 1, '#3a3d4a'); r(6, 11, 4, 1, 'a');
  } else {                                     // league puck
    circle(8, 8, 7.4, 'k'); circle(8, 8, 6.6, '#20222e'); r(3, 7, 10, 2, 'a'); circle(8, 8, 2, 'm');
  }
}

// ---------- banners: plainer for early rounds, more ornate toward the final
function drawTourneyBanner(c, w, h, o) {
  // o: { key, tier, title, round, sub, teams:[identity,identity], t (anim ticks), trophy }
  const th = tourneyTheme(o.key), tier = o.tier || 0, t = o.t || 0;
  const ps = o.ps || Math.max(2, Math.round(Math.min(w, h * 3) / 160));
  c.save(); c.imageSmoothingEnabled = false;
  // field: vertical gradient + dithered stripes
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, th.main); g.addColorStop(1, th.dark);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,255,255,.04)'; for (let x = (t * 0.5) % (ps * 8) - ps * 8; x < w; x += ps * 8) c.fillRect(x, 0, ps * 3, h);
  // borders
  const frame = (inset, col, thick) => { c.fillStyle = col; c.fillRect(inset, inset, w - inset * 2, thick); c.fillRect(inset, h - inset - thick, w - inset * 2, thick); c.fillRect(inset, inset, thick, h - inset * 2); c.fillRect(w - inset - thick, inset, thick, h - inset * 2); };
  frame(0, '#05060d', ps);
  frame(ps, th.accent, ps);
  if (tier >= 1) {
    frame(ps * 3, th.metal, ps); frame(ps * 4, 'rgba(0,0,0,.35)', ps / 2);
    c.fillStyle = th.metal; for (const [x, y] of [[ps * 5, ps * 5], [w - ps * 7, ps * 5], [ps * 5, h - ps * 7], [w - ps * 7, h - ps * 7]]) c.fillRect(x, y, ps * 2, ps * 2);   // rivets
  }
  if (tier >= 2) {
    frame(ps * 6, th.accent, ps);
    // corner flourishes
    c.fillStyle = th.metal;
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const ox = sx > 0 ? ps * 8 : w - ps * 8, oy = sy > 0 ? ps * 8 : h - ps * 8;
      for (let k = 0; k < 5; k++) { c.fillRect(ox + sx * k * ps - (sx < 0 ? ps : 0), oy - (sy < 0 ? ps : 0), ps, ps); c.fillRect(ox - (sx < 0 ? ps : 0), oy + sy * k * ps - (sy < 0 ? ps : 0), ps, ps); }
    }
    // bunting along the top
    for (let x = ps * 10, k = 0; x < w - ps * 12; x += ps * 6, k++) { c.fillStyle = k % 2 ? th.accent : th.metal; c.beginPath(); c.moveTo(x, ps * 7); c.lineTo(x + ps * 5, ps * 7); c.lineTo(x + ps * 2.5, ps * 11); c.fill(); }
  }
  // side art: team badges (finals) or the competition emblem + trophy; text gets the middle
  const inner = ps * (tier >= 2 ? 9 : tier ? 6 : 3), mid = h / 2;
  const side = Math.min(h - inner * 2, w * 0.17);
  const showTeams = o.teams && o.teams[0] && tier >= 2 && w > h * 2.6;
  if (showTeams) {
    drawEmblemBadge(c, o.teams[0], inner + side / 2 + ps, mid, side * 0.46);
    drawEmblemBadge(c, o.teams[1], w - inner - side / 2 - ps, mid, side * 0.46);
  } else {
    drawTourneyEmblem(c, o.key, inner + side / 2 + ps, mid, side * 0.9);
    if (tier >= 1 && th.trophy) { const tp = Math.max(1, side / 19); drawTrophy(c, th.trophy, w - inner - side / 2 - 8 * tp, mid - 9 * tp, tp, tier >= 2); }   // (the trophy art scales smoothly now)
  }
  // text block, sized to fit between the side art
  const font = n => `${Math.max(5, Math.round(n))}px 'PH Pixel', monospace`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const tx = w / 2, avail = w - (inner + side + ps * 4) * 2, availH = h - inner * 2 - ps * 2;
  const lines = [[o.title || th.short, 1, th.text]];
  if (o.round || tier) lines.push([o.round || TIER_LABEL[tier], tier >= 2 ? 0.95 : 0.7, tier >= 2 ? th.metal : th.accent]);
  if (o.sub) lines.push([o.sub, 0.55, 'rgba(255,255,255,.8)']);
  const fitW = lines.reduce((m, [txt, k]) => Math.min(m, avail / (txt.length * k * 1.02)), 1e9);
  const units = lines.reduce((a, l) => a + l[1] * 1.7, 0);
  const base = Math.max(5, Math.min(fitW, availH / units, h * 0.2));
  let y = mid - base * units / 2;
  // a small emblem above the text on finals with team badges at the sides
  if (showTeams && availH > base * units + side * 0.5) { drawTourneyEmblem(c, o.key, tx, y - side * 0.12, side * 0.42); y += side * 0.17; }
  for (const [txt, k, colr] of lines) {
    const sz = base * k; c.font = font(sz); y += sz * 0.85;
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillText(txt, tx + Math.max(1, sz / 8), y + Math.max(1, sz / 8));
    c.fillStyle = colr; c.fillText(txt, tx, y);
    y += sz * 0.85;
  }
  // final: twinkles
  if (tier >= 2) for (let k = 0; k < 7; k++) {
    const ph = (t * 0.05 + k * 1.7) % 6; if (ph > 1) continue;
    const sx = (Math.sin(k * 12.9898) * 0.5 + 0.5) * (w - ps * 20) + ps * 10, sy = (Math.sin(k * 78.233) * 0.5 + 0.5) * (h - ps * 20) + ps * 10, s = ps * (1 + (ph < 0.5 ? ph : 1 - ph) * 4);
    c.fillStyle = '#ffffff'; c.fillRect(sx - s / 2, sy - ps / 2, s, ps); c.fillRect(sx - ps / 2, sy - s / 2, ps, s);
  }
  c.restore();
}
// DOM helper: a banner canvas that keeps animating while it is on screen (finals sparkle)
function tourneyBannerCanvas(o, cssW, cssH) {
  const cv = document.createElement('canvas'), dpr = 2;
  cv.width = cssW * dpr; cv.height = cssH * dpr; cv.style.width = '100%'; cv.style.maxWidth = cssW + 'px'; cv.style.display = 'block'; cv.style.margin = '0 auto'; cv.className = 'px';
  const c = cv.getContext('2d'); let t = 0;
  const draw = () => { c.setTransform(dpr, 0, 0, dpr, 0, 0); drawTourneyBanner(c, cssW, cssH, Object.assign({}, o, { t })); };
  draw();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  if ((o.tier || 0) >= 2) { const loop = () => { if (!cv.isConnected && t > 5) return; t++; draw(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  return cv;
}

// ---------- arena branding for tournament games (painted into the rink image)
function paintTourneyIce(c) {
  const T0 = S.match && S.match.tourney; if (!T0) return;
  const th = tourneyTheme(T0.key);
  c.save(); c.globalAlpha = T0.tier >= 2 ? 0.55 : 0.4;
  drawTourneyEmblem(c, T0.key, CX - 120, CY, 25); drawTourneyEmblem(c, T0.key, CX + 120, CY, 25);
  c.restore();
  if (T0.tier >= 2) {                      // championship final: trim the boards in the competition's metal
    c.save(); c.strokeStyle = th.metal; c.lineWidth = 1.2; roundRectPath(c, R.l - 1, R.t - 1, R.r - R.l + 2, R.b - R.t + 2, R.cr + 1); c.stroke(); c.restore();
  }
}
// every tournament is played in its own building, dressed for it: a neutral site with both teams' fans, the
// tournament's colours on the seats and boards, its emblem at centre ice and its own sponsors
const TOURNEY_ARENA = {
  inv:     { name: 'INVITATIONAL DOME',        venue: 'modern',   lighting: 'bright', deco: 'flags',     emblem: 'shield', ads: ['INVITE', 'NORTH AIR', 'PIXEL COLA', 'PITCH KING'] },
  classic: { name: 'THE WINTER CLASSIC',      venue: 'outdoor',  lighting: 'classic', deco: 'streamers', emblem: 'puck',   ads: ['CLASSIC', 'MAPLE BANK', 'HOT COCOA', 'STUDS CO'] },
  winter:  { name: 'WINTER CUP CENTRE',        venue: 'downtown', lighting: 'bright', deco: 'confetti',  emblem: 'flake',  ads: ['WINTER CUP', 'GLIDE WASH', 'SNOWLINE', 'NORTH AIR'] },
  finale:  { name: 'FINALE PALACE',            venue: 'palace',   lighting: 'dim',    deco: 'fireworks', emblem: 'star',   ads: ['FINALE CUP', 'SCREAMERTV', 'PIXEL COLA', 'MAPLE BANK'] },
  toc:     { name: 'HALL OF CHAMPIONS',        venue: 'palace',   lighting: 'disco',  deco: 'fireworks', emblem: 'crown',  ads: ['CHAMPIONS', 'GOLD STAR', 'SCREAMERTV', 'PITCH KING'] },
};
function tourneyArenaCfg(key) {
  const A = TOURNEY_ARENA[key], th = tourneyTheme(key); if (!A) return null;
  return { venue: A.venue, logo: 'tourney', ads: 'tourney', adWords: A.ads, seats: 'custom', seatHex: shade(th.main, -0.25), crowd: 'tourney', crowdHex: [th.main, th.accent, th.dark],
    lighting: A.lighting, banners: 'flags', signs: true, deco: A.deco, horn: 'classic', text: th.short, tourney: key,
    tEmblem: { colors: { p: th.main, s: th.dark, a: th.accent }, emblem: A.emblem, logo: { shape: 'shield', tint: 'teamcol', border: 'double' }, abbr: '', city: '', nick: th.short } };
}
function tourneyAds() {
  const T0 = S.match && S.match.tourney; if (!T0) return null;
  const th = tourneyTheme(T0.key);
  return { ads: [[th.main, th.accent], [th.dark, th.metal], [th.main, '#ffffff'], [th.dark, th.accent]], key: T0.key, name: th.short || '' };
}

// ====================================================================
//  CHAMPIONSHIP INTRO (before a tournament final) and CELEBRATION (after winning one)
// ====================================================================
function playSting(notes, base = 0) {
  if (!AC || !notes) return;
  notes.forEach((f, i) => { tone(f, 0.28, 'square', 0.045, 0, base + i * 0.13); tone(f / 2, 0.3, 'triangle', 0.05, 0, base + i * 0.13); });
  tone(notes[notes.length - 1], 0.9, 'sawtooth', 0.03, 0, base + notes.length * 0.13);
  noise(0.6, 0.05, 2400, 'highpass', 0.7, base + notes.length * 0.13);
}
function startIntro(info) {
  // info: { key, tier, full, title, round, year, teams }
  S.intro = Object.assign({ t0: performance.now(), t: 0, dur: info.full ? (FINALS_GRAND[info.key] ? 8000 : 7000) : 3200, stung: [] }, info);
  S.screen = 'intro';
  hideOverlays();
  if (S.match && S.match.onIntroShown) S.match.onIntroShown(info.key);
}
function introTick() {
  const I = S.intro; if (!I) return;
  I.t = performance.now() - I.t0;
  S.t++;
  if (S.t % 2 === 0 && I.t > (I.full ? 1300 : 300)) for (let k = 0; k < 2; k++) particles.push({ x: camX + rand(0, viewW()), y: camY + rand(0, viewH() * 0.4), vx: rand(-0.3, 0.3), vy: rand(0.4, 1), life: rand(40, 80), color: k ? tourneyTheme(I.key).metal : '#ffffff' });
  for (const p of particles) { p.x += p.vx; p.y += p.vy; p.life--; }
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
  const th = tourneyTheme(I.key);
  const hit = (ms, fn) => { if (I.t >= ms && !I.stung.includes(ms)) { I.stung.push(ms); fn(); } };
  if (I.full) { hit(0, () => playSting(th.sting)); hit(1300, () => { tone(1568, 0.5, 'triangle', 0.04); noise(0.4, 0.03, 5000, 'highpass'); }); hit(2700, () => { sfx.cheer(1.2); }); hit(4400, () => sfx.horn()); }
  else { hit(0, () => playSting(th.sting)); hit(1200, () => sfx.cheer(1)); }
  if (I.t >= I.dur) endIntro();
}
function skipIntro() { if (S.screen === 'intro' && S.intro && S.intro.t > 150) endIntro(); }
function endIntro() {
  S.intro = null; particles.length = 0;
  S.screen = 'play';
  S.tbanner = { life: 150 };         // championship banner across the ice before the opening faceoff
  cvs.focus();
}
const ease = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
function drawIntro() {
  const I = S.intro; if (!I) return;
  toScreen();
  const SW = viewW(), SH = HUDH + viewH(), th = tourneyTheme(I.key), t = I.t;
  const fadeOut = clamp((I.dur - t) / 600, 0, 1);
  ctx.globalAlpha = 0.86 * fadeOut; ctx.fillStyle = th.dark; ctx.fillRect(0, 0, SW, SH); ctx.globalAlpha = fadeOut;
  // spotlight beams
  ctx.fillStyle = 'rgba(255,255,255,.05)';
  for (let k = 0; k < 3; k++) { const a = Math.sin(t / 900 + k * 2) * 60; ctx.beginPath(); ctx.moveTo(SW / 2 + a, 0); ctx.lineTo(SW / 2 + a - 70, SH); ctx.lineTo(SW / 2 + a + 70, SH); ctx.fill(); }
  const ph = I.full ? [0, 1300, 2700, 4400] : [0, 0, 500, 1100];
  const VH = viewH(), U = VH / 252;                       // layout unit: scales with the camera view
  // 1) emblem
  const e1 = ease((t - ph[0]) / 700);
  const emY = HUDH + VH * (I.full ? 0.2 - ease((t - ph[1]) / 600) * 0.07 : 0.13), emS = (I.full ? 30 + e1 * 22 - ease((t - ph[1]) / 600) * 14 : 36) * U;
  if (t >= ph[0]) { ctx.save(); ctx.globalAlpha *= clamp(e1 * 1.5, 0, 1); drawTourneyEmblem(ctx, I.key, SW / 2, emY, emS); ctx.restore(); }
  // 2) trophy rising
  if (t >= ph[1] && th.trophy) {
    const e2 = ease((t - ph[1]) / 900), tp = Math.max(1, Math.round(2 * U));
    const ty = HUDH + VH * (0.47 - e2 * 0.1);
    ctx.save(); ctx.globalAlpha *= e2; drawTrophy(ctx, th.trophy, SW / 2 - 8 * tp, ty - 11 * tp, tp, true); ctx.restore();
  }
  // 3) teams slide in
  if (t >= ph[2] && I.teams) {
    const e3 = ease((t - ph[2]) / 700), y = HUDH + VH * 0.6, r = 16 * U, gap = SW * 0.3;
    const lx = -40 + e3 * (SW / 2 - gap + 40), rx = SW + 40 - e3 * (SW / 2 - gap + 40);
    drawEmblemBadge(ctx, I.teams[0], lx, y, r); drawEmblemBadge(ctx, I.teams[1], rx, y, r);
    ctx.globalAlpha = fadeOut * e3;
    text(I.teams[0].nick.toUpperCase().slice(0, 12), lx, y + r + 4, teamTextColor(I.teams[0]), 6, 'center', '#000');
    text(I.teams[1].nick.toUpperCase().slice(0, 12), rx, y + r + 4, teamTextColor(I.teams[1]), 6, 'center', '#000');
    text('VS', SW / 2, y - 6, th.metal, 12, 'center', '#000');
    ctx.globalAlpha = fadeOut;
  }
  // 4) announcement
  if (t >= ph[3]) {
    const e4 = ease((t - ph[3]) / 500), hh = 46, y = HUDH + VH - hh - 18;
    ctx.globalAlpha = fadeOut * e4;
    ctx.fillStyle = 'rgba(5,6,13,.78)'; ctx.fillRect(8, y, SW - 16, hh);
    ctx.fillStyle = th.accent; ctx.fillRect(8, y, SW - 16, 2); ctx.fillRect(8, y + hh - 2, SW - 16, 2);
    const big = (I.round || 'CHAMPIONSHIP FINAL').length * 12 > SW - 30 ? 8 : 12;
    text(th.short, SW / 2, y + 6, th.text, 6, 'center', null);
    text(I.round || 'CHAMPIONSHIP FINAL', SW / 2, y + 17, th.metal, big, 'center', '#000');
    text(I.year ? 'SEASON ' + I.year : '', SW / 2, y + 34, '#ffffff', 6, 'center', null);
    ctx.globalAlpha = fadeOut;
  }
  toWorld(); for (const pt of particles) { ctx.fillStyle = pt.color; ctx.fillRect(pt.x, pt.y, 1.2, 1.2); }
  toScreen(); ctx.globalAlpha = 1;
  text(t > 150 ? 'PRESS ANY KEY TO SKIP' : '', SW / 2, SH - 11, 'rgba(255,255,255,.6)', 6, 'center', null);
}
// in-arena banner over the ice before the first faceoff of a final
function drawTourneyStrip() {
  const B = S.tbanner, T0 = S.match && S.match.tourney; if (!B || B.life <= 0 || !T0) return;
  B.life--;
  toScreen();
  const SW = viewW(), w = Math.min(SW - 24, 300), hh = 44, x = (SW - w) / 2, y = HUDH + viewH() * 0.22;
  ctx.save(); ctx.globalAlpha = Math.min(1, B.life / 20);
  ctx.translate(x, y); drawTourneyBanner(ctx, w, hh, { key: T0.key, tier: T0.tier, title: tourneyTheme(T0.key).short, round: T0.round, t: S.t, ps: 1 });
  ctx.restore();
}
// ---------- celebration after the title-clinching win
function startCelebration(result, info) {
  S.screen = 'celebrate';
  S.celeb = { t: 0, result, info };
  hideOverlays();
  const win = result.winner;
  S.cheer = 400; S.cheerKind = 'all'; S.lamp[win] = 400;
  for (const r of refs) r.arm = 0;
  playSting(tourneyTheme(info.key).sting); setTimeout(() => sfx.cheer(2), 400);
}
function celebTick() {
  const C = S.celeb; if (!C) return;
  C.t++; S.t++;
  if (S.cheer < 60) S.cheer = 120;
  const th = tourneyTheme(C.info.key), win = C.result.winner;
  // confetti in the competition's colours
  for (let k = 0; k < 3; k++) particles.push({ x: camX + rand(0, viewW()), y: camY - 4, vx: rand(-0.4, 0.4), vy: rand(0.6, 1.4), life: rand(80, 160), color: [th.accent, th.metal, TEAM[win].main, '#ffffff'][(Math.random() * 4) | 0] });
  for (const p of particles) { p.x += p.vx + Math.sin((S.t + p.life) * 0.1) * 0.2; p.y += p.vy; p.life--; }
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
  // the winners mob each other at centre ice
  for (const p of players) {
    if (p.team === win) { const tx = CX + Math.cos(p.id) * 10, ty = CY + Math.sin(p.id) * 8; steerTo(p, tx, ty, 0.8, 10); }
    else { p.inx = p.iny = 0; }
    movePlayer(p);
  }
  collidePlayers(); updateCamera();
  if (C.t > 60 * 9) finishCelebration();
}
function finishCelebration() {
  const C = S.celeb; if (!C) return;
  S.celeb = null; particles.length = 0;
  S.screen = 'post';
  if (S.match && S.match.onEnd) S.match.onEnd(C.result);
}
function drawCelebration() {
  const C = S.celeb; if (!C) return;
  toScreen();
  const SW = viewW(), th = tourneyTheme(C.info.key), e = ease(C.t / 90);
  const w = Math.min(SW - 20, 320), hh = 50, x = (SW - w) / 2, y = HUDH + 8;
  ctx.save(); ctx.translate(x, y - (1 - e) * 80); drawTourneyBanner(ctx, w, hh, { key: C.info.key, tier: 2, title: th.short, round: 'CHAMPIONS', t: S.t, ps: 1 }); ctx.restore();
  if (th.trophy && C.t > 50) {
    const e2 = ease((C.t - 50) / 80), tp = Math.max(2, Math.round(2.5 * viewH() / 252)), ty = HUDH + viewH() * 0.52 - e2 * 30;
    ctx.save(); ctx.globalAlpha = e2; drawTrophy(ctx, th.trophy, SW / 2 - 8 * tp, ty - 13 * tp, tp, true); ctx.restore();
  }
  if (C.t > 110) {
    const winT = TEAM[C.result.winner];
    ctx.globalAlpha = ease((C.t - 110) / 40);
    ctx.fillStyle = 'rgba(5,6,13,.7)'; ctx.fillRect(SW / 2 - 110, HUDH + viewH() - 50, 220, 32);
    drawEmblemBadge(ctx, winT, SW / 2, HUDH + viewH() - 66, 16);
    text((winT.city + ' ' + winT.nick).toUpperCase(), SW / 2, HUDH + viewH() - 44, '#ffffff', 8, 'center', '#000');
    text(C.info.year ? C.info.year + ' CHAMPIONS' : 'CHAMPIONS', SW / 2, HUDH + viewH() - 31, th.metal, 8, 'center', '#000');
    ctx.globalAlpha = 1;
  }
  if (C.t > 40) text('PRESS ANY KEY TO CONTINUE', SW / 2, HUDH + viewH() - 12, 'rgba(255,255,255,.6)', 6, 'center', null);
}
// one hook called from render()
function drawPresentationOverlay() {
  if (S.screen === 'intro') drawIntro();
  else if (S.screen === 'celebrate') drawCelebration();
  else if (S.screen === 'outro') drawOutroOverlay();
  else if (S.screen === 'play' && S.tbanner) drawTourneyStrip();
  // small competition bug in the scoreboard bar during tournament games
  if (S.match && S.match.tourney && (S.screen === 'play' || S.screen === 'paused' || S.screen === 'celebrate')) {
    toScreen(); drawTourneyEmblem(ctx, S.match.tourney.key, viewW() / 2 - 44, 13, 14);
  }
}

// ====================================================================
//  END OF GAME: the Jumbotron shows the final score, highlights, the three stars (each one skates a lap)
//  and the team stats while the players head off and the fans file out; then the results screen.
// ====================================================================
const OUTRO = { cardLen: 200, starLen: 260, statLen: 320, announce: 135, starGap: 75, exitLen: 300 };   // announce: the lights find him at the bench door and he salutes the crowd before his lap
function outroWanted() { return typeof jbDrop === 'function' && S.match && !S.match.test && !S.match.noOutro && !S.spectateQuick && S.pres && S.pres.outro !== false && typeof document !== 'undefined'; }
function startOutro(result) {
  S.screen = 'outro'; hideOverlays(); S.banner = null; S.comm = null; S.goalCard = null; if (typeof crowdVoiceReset === 'function') crowdVoiceReset();
  const stars = typeof threeStars === 'function' && result.stats && result.stats.length ? threeStars(result.stats.map(l => Object.assign({}, l)), result.gameSec) : [];
  // the game's three best moments (goals count for a little more)
  const all = (result.clips || []).filter(c => typeof bigHighlight === 'function' ? bigHighlight(c) : true), w = c => (c.imp || 0) + (c.kind === 'goal' || c.kind === 'so' ? 6 : 0);
  const clips = all.slice().sort((a, b) => w(b) - w(a)).slice(0, 3);
  S.outro = { t: 0, result, stars, clips, queue: [], lapper: null, leave: 0, gap: 0, exit: 0 };
  const O = S.outro, win = result.winner, T = i => TEAM[i];
  // the order: the three stars, the game stats, the three best highlights, then the fans file out
  stars.map((l, i) => ({ star: l, rank: i })).reverse().forEach(it => O.queue.push(it));   // third star first, the first star last (broadcast style)
  O.queue.push({ card: (c, f, w, h) => outroStatsCard(c, f, w, h, result), len: OUTRO.statLen, head: 'GAME STATS', cap: T(0).abbr + ' ' + result.score[0] + ' - ' + result.score[1] + ' ' + T(1).abbr + (result.so ? ' (SO)' : result.ot ? ' (ET)' : '') });
  clips.forEach((c, i) => O.queue.push({ clip: c, n: i, of: clips.length }));
  O.queue.push({ exit: true });
  // the final horn: a home win brings the house down for a second, then it settles before the stars; an away win
  // gets a polite hand; at a tournament both sides' fans are the same
  { const neutral = neutralCrowd(), homeWin = win === (S.match.home ?? 0);
    const v = neutral ? 1.0 : homeWin ? 1.8 : 0.45;
    sfx.cheer(v); S.cheer = neutral ? 70 : homeWin ? 70 : 30; S.cheerKind = neutral ? 'all' : homeWin ? 'home' : 'away'; }
  for (const p of players) { p.charge = -1; p.lunge = 0; p.celebT = win === p.team ? 120 : 0; p.celebType = 'arms'; }
  puck.owner = null; puck.vx *= 0.3; puck.vy *= 0.3;
  // before the stars: both teams skate off to their benches, then everyone on the benches (players, spare goalies,
  // coaches) walks back up the corridor and down the tunnel, then a few seconds of the arena's light show on the
  // empty ice; only then is the first star called (outroTick runs the phases)
  O.pre = 'skate'; O.gone = new Set();
}
// the player for a star: whoever is in a slot already, or (he was on the bench at the horn) seat him in a free slot of his team
function outroStarSkater(l) {
  let p = POOL.find(q => q.pl && q.pl.id === l.pid);
  if (p) return p;
  const lu = S.match && S.match.lineups ? S.match.lineups[l.team] : null;
  let pl = null;
  if (lu) for (const x of (lu.lines || []).flat().concat([lu.goalie], lu.bench || [], lu.extra || [], lu.goalies || [])) if (x && x.id === l.pid) { pl = x; break; }
  if (!pl) return null;
  const isG = l.pos === 'G' || pl.pos === 'G';
  const free = POOL.filter(q => q.team === l.team && !!q.g === isG && !(S.outro.lapper && S.outro.lapper.p === q));
  p = free.find(q => !q.on) || free[free.length - 1];
  if (!p) return null;
  if (typeof seat === 'function') seat(p, pl); else { p.pl = pl; p.num = pl.num; p.eff = null; }
  p.on = false;
  return p;
}
// how loud the building gets for a team: in a tournament (a neutral site) everyone gets the same; otherwise it's the
// home crowd: loud for the home team, polite for the visitors
const neutralCrowd = () => !!(S.match && S.match.tourney && TOUR_KEYS.includes(S.match.tourney.key));
function crowdFor(team, loud) {
  const hm = S.match ? (S.match.home ?? 0) : 0;
  if (neutralCrowd()) return { v: 1.0, kind: 'all', len: 90 };
  return team === hm ? { v: loud, kind: 'home', len: 110 } : { v: 0.35, kind: 'away', len: 40 };
}
function outroNext() {
  const O = S.outro; if (!O) return;
  const it = O.queue.shift();
  O.cur = it || null; O.lapper = null; O.gap = 0;
  if (!it) return finishOutro();
  if (typeof jbEnsure === 'function') jbEnsure();            // (the board may not exist yet for the first star)
  if (JB.el) JB.el.classList.toggle('mini', !!it.star);       // the board rides up and shrinks so the ice under it shows
  if (it.exit) {                                               // the board goes up; the fans shuffle out for a few seconds
    if (typeof jbLift === 'function') jbLift();
    O.exit = 1; S.cheer = 0;
    return;
  }
  if (it.star) {
    // the Jumbotron announces him; he comes out from his bench, skates a lap under the board, and heads back off
    const l = it.star, i = it.rank;
    jbDrop('outro', { card: (c, f, w, h) => outroStarCard(c, f, w, h, l, i, O.lapper), len: 1e9, head: ['1ST', '2ND', '3RD'][i] + ' STAR', cap: '#' + l.num + ' ' + l.name.toUpperCase() + ' · ' + (TEAM[l.team] ? TEAM[l.team].abbr : '') });
    const p = outroStarSkater(l);
    const hm = S.match.home ?? 0, door = { x: R.l + 12, y: CY + (l.team === hm ? -26 : 26) };
    if (p) {
      if (!p.on) { resetPlayerState(p); p.x = door.x; p.y = door.y; p.on = true; rebuildActive(); }
      p.outroFree = true; p.celebT = 0;
      O.lapper = { p, phase: 'wait', t: 0, door };
    } else O.lapper = { p: null, phase: 'wait', t: 0, door };
    if (typeof voiceCue === 'function') voiceCue('star');
    const cr = crowdFor(l.team, [1.6, 1.4, 1.2][i]);              // the home crowd's own: louder the higher the star
    if (O.lapper) O.lapper.cheer = cr.v;
    sfx.cheer(cr.v); S.cheer = cr.len; S.cheerKind = cr.kind;
    return;
  }
  if (it.clip) { jbDrop('outro', it); if (JB.head) JB.head.textContent = 'TOP HIGHLIGHTS · ' + (it.n + 1) + ' OF ' + it.of; }
  else jbDrop('outro', it);
  if (it.clip && S.match.season && JB.cap) JB.cap.textContent += ' · K = KEEP';
}
// SPACE: on to the next part of the outro (one at a time), not straight out of it
function outroSkip() {
  const O = S.outro; if (!O || O.t < 20) return;
  if (O.skipT && O.t - O.skipT < 12) return; O.skipT = O.t;
  if (O.pre) {                                    // still before the stars: everyone is gone at once, straight to the first star
    for (const p of players.slice()) p.on = false; rebuildActive();
    if (typeof benchLayout === 'function') for (const t of [0, 1]) { const L0 = benchLayout(t); for (const s of L0.seats.concat(L0.coaches)) O.gone.add(s.key); }
    O.walkoff = null; O.pre = null; O.show = 0; if (!O.cur) outroNext(); return;
  }
  const L = O.lapper;
  if (L && L.p) { L.p.on = false; L.p.outroFree = false; rebuildActive(); }
  if (O.cur && O.cur.exit) return finishOutro();
  outroNext();
}
function outroItemDone() { outroNext(); }
// K during a highlight in a career game: keep it in your highlight archive for good
function outroKeep() {
  const it = typeof JB !== 'undefined' && JB.item; if (!it || !it.clip || !S.match || !S.match.season) return;
  it.clip.kept = true; if (JB.cap) JB.cap.textContent = '★ KEPT IN YOUR HIGHLIGHTS · ' + JB.cap.textContent.replace(/ · K = KEEP$/, '');
  if (typeof MenuFX !== 'undefined') MenuFX.play('confirm');
}
function outroTick() {
  const O = S.outro; if (!O) return;
  O.t++; S.t++;
  if (S.lamp[0] > 0) S.lamp[0]--; if (S.lamp[1] > 0) S.lamp[1]--;
  for (const p of particles) { p.x += p.vx; p.y += p.vy; p.life--; }
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
  for (const f of floaters) { f.y -= 0.3; f.life--; }
  // everyone skates off to his bench door; the star of the moment skates a lap at centre ice
  const hm = S.match.home ?? 0;
  for (const p of players.slice()) {
    if (O.lapper && O.lapper.p === p) { outroLap(O.lapper); continue; }
    if (O.t < 40) { p.inx = p.iny = 0; movePlayer(p); continue; }    // a moment of handshakes and stick taps at centre
    const door = { x: R.l + 10, y: CY + (p.team === hm ? -26 : 26) };
    if (p.g) { door.y = CY + (p.team === hm ? -40 : 40); }
    const d = steerTo(p, door.x, door.y, 0.75, 6); movePlayer(p);
    if (d < 9) { p.on = false; rebuildActive(); }
  }
  if (O.pre) outroPreTick(O);
  if (O.lapper && !O.lapper.p && ++O.lapper.t > OUTRO.announce + 120) { O.lapper = null; O.gap = OUTRO.starGap; }   // a star with no skater on the roster: just the board
  if (O.gap > 0 && --O.gap === 0) outroNext();                       // a breath between one star and the next
  collidePlayers(); updateRefs(); updateCamera();
  if (O.t === 100) { for (const g of goalies) if (g && !(O.lapper && O.lapper.p === g)) g.on = false; rebuildActive(); }   // the goalies are off behind the Jumbotron
  // the fans file out in waves
  if (O.exit > 0) {                          // the end: the fans shuffle out, the arena empties, then the menu
    O.exit++;
    if (O.exit % 50 === 2 && O.leave < 6) { O.leave++; outroEmptySeats(O.leave < 6 ? 0.22 : 0.6); }
    if (O.exit > OUTRO.exitLen) finishOutro();
  }
}
// ---- after the horn, before the stars: skate off, the benches empty down the tunnel, then a light show
const OUTRO_PRE = { skateMax: 420, walkMax: 720, show: 240, stagger: 5 };     // frames (60 a second); show = about 4 s
function outroPreTick(O) {
  if (O.pre === 'skate') {
    const out = players.filter(p => p.on && !(O.lapper && O.lapper.p === p)).length;
    if ((O.t > 60 && !out) || O.t > OUTRO_PRE.skateMax) {
      for (const p of players.slice()) if (p.on) { p.on = false; } rebuildActive();
      outroStartWalkOff(O); O.pre = 'walk';
    }
    return;
  }
  if (O.pre === 'walk') {
    O.wt = (O.wt || 0) + 1;
    let busy = 0;
    for (const m of O.walkoff) {
      if (m.done) continue; busy++;
      if (O.wt < m.at) continue;
      if (!m.pos) { m.pos = { x: m.path[0].x, y: m.path[0].y }; m.seg = 1; m.anim = 0; O.gone.add(m.key); }
      const tgt = m.path[m.seg], dx = tgt.x - m.pos.x, dy = tgt.y - m.pos.y, d = hyp(dx, dy), spd = m.kind === 'coach' ? 1.3 : 1.6;
      if (d <= spd) { m.pos.x = tgt.x; m.pos.y = tgt.y; m.seg++; if (m.seg >= m.path.length) m.done = true; }
      else { m.pos.x += dx / d * spd; m.pos.y += dy / d * spd; m.dir = { x: dx / d, y: dy / d }; m.anim += 0.32; }
      // into the dark: full colour along the corridor, fading out inside the tunnel mouth
      const last = m.seg >= m.path.length - 1, a = m.path[m.path.length - 2], z = m.path[m.path.length - 1];
      const k = last && !m.done ? clamp(hyp(m.pos.x - z.x, m.pos.y - z.y) / Math.max(1, hyp(a.x - z.x, a.y - z.y)), 0, 1) : m.done ? 0 : 1;
      m.alpha = 0.15 + 0.85 * k; m.dark = 0.35 + 0.65 * k;
    }
    if (!busy || O.wt > OUTRO_PRE.walkMax) {
      O.walkoff = null; O.pre = 'show'; O.show = OUTRO_PRE.show;
      // the show plays for the winners: the goal lights, the LED chase and (in an arena that has them) lasers, pyro, the mirror ball
      const hm = S.match.home ?? 0, w = O.result.winner ?? hm, neutral = neutralCrowd();
      S.cheerKind = neutral ? 'all' : w === hm ? 'home' : 'away'; S.cheer = 150;
      if (typeof ALS !== 'undefined') ALS.goalT0 = S.t;
      sfx.cheer(neutral ? 1 : w === hm ? 1.3 : 0.4);
    }
    return;
  }
  if (O.pre === 'show') {
    if (--O.show <= 0) { O.pre = null; O.show = 0; if (!O.cur) outroNext(); }
  }
}
function outroStartWalkOff(O) {
  const hm = S.match.home ?? 0, crew = [];
  if (typeof benchLayout !== 'function') { O.walkoff = []; return; }
  for (const t of [hm, 1 - hm]) {
    const L = benchLayout(t);
    // the skaters by the door go first, then the spare goalies, then the coaches turn the lights off behind them
    for (const s of L.seats.filter(x => !x.g).slice().reverse()) crew.push({ t, s, kind: 's', key: s.key });
    for (const s of L.seats.filter(x => x.g)) crew.push({ t, s, kind: 'g', key: s.key });
    for (const s of L.coaches) crew.push({ t, s, kind: 'c', key: s.key });
  }
  const order = [];                                                     // the two benches empty at the same time
  const byT = [hm, 1 - hm].map(t => crew.filter(c => c.t === t));
  for (let i = 0; i < Math.max(byT[0].length, byT[1].length); i++) for (const b of byT) if (b[i]) order.push(b[i]);
  O.walkoff = order.map((c, i) => {
    const home = c.t === hm, s0 = WALK_SPAWN[home ? 0 : 1], lx = WALK_LANE_X[home ? 0 : 1];
    const doorY = home ? BENCH_Y[0] + BENCH_LEN - 3 : BENCH_Y[1] + 3, back = c.kind !== 's';
    return { kind: c.kind === 'c' ? 'coach' : 'crew', t: c.t, s: c.s, key: c.key, at: 1 + Math.floor(i / 2) * OUTRO_PRE.stagger,
      path: [{ x: c.s.x, y: c.s.y }, { x: back ? c.s.x + 7 : c.s.x - 12, y: c.s.y }, { x: lx, y: doorY }, { x: lx, y: s0.y }, { x: s0.x, y: s0.y }] };
  });
}
function walkOffItems(items) {
  const O = S.outro; if (!O || !O.walkoff) return;
  for (const m of O.walkoff) {
    if (!m.pos || m.done) continue;
    const T = TEAM[m.t], x = m.pos.x, y = m.pos.y, a = m.alpha ?? 1, dk = m.dark ?? 1, fade = fn => () => drawShadowed(fn, a, dk);
    if (m.kind === 'coach') { items.push({ y, d: fade(() => drawCoach(x, y, T, m.t, m.s.asst)) }); continue; }
    const dir = m.dir || { x: -1, y: 0 };
    const f = fakeSkater({ x, y, team: m.t, pl: m.s.pl, num: m.s.pl ? m.s.pl.num : 0, g: !!m.s.g, fx: dir.x, fy: dir.y, vx: dir.x, vy: dir.y, anim: m.anim, hand: (m.s.pl && m.s.pl.hand) || 'L' });
    items.push({ y, d: fade(() => (f.g ? drawGoalie(f) : drawSkater(f))) });
  }
}
const outroShowOn = () => !!(S.outro && S.outro.pre === 'show');
// one star's turn: wait for the announcement, skate out, a lap of centre ice under the board, back off to the bench
function outroLap(L) {
  const p = L.p; L.t++;
  if (L.phase === 'wait') {
    // in the bench doorway while he's announced: the spotlights swing over and land on him, he faces the ice and
    // raises his stick to the crowd, then skates out into the light
    p.inx = p.iny = 0; p.fx = 1; p.fy = 0; movePlayer(p);
    if (L.t === 50) { p.celebT = 80; p.celebType = 'arms'; sfx.cheer((L.cheer ?? 1) * 0.8); }
    if (L.t > OUTRO.announce) { L.phase = 'out'; L.t = 0; sfx.cheer(L.cheer ?? 1); }
    return;
  }
  const rx = 96, ry = 145, ly = CY + 85;           // the lap stays in the open ice below the Jumbotron
  if (L.phase === 'out') {
    const d = steerTo(p, CX - rx, ly, 1, 4); movePlayer(p);
    if (d < 12 || L.t > 200) { L.phase = 'lap'; L.t = 0; L.a0 = Math.PI; p.celebT = OUTRO.starLen; p.celebType = 'fist'; }
    return;
  }
  if (L.phase === 'lap') {
    const a = L.a0 + L.t / OUTRO.starLen * Math.PI * 2;
    steerTo(p, CX + Math.cos(a) * rx, ly + Math.sin(a) * ry, 1, 4); movePlayer(p);
    if (L.t > OUTRO.starLen) { L.phase = 'off'; L.t = 0; }
    return;
  }
  const d = steerTo(p, L.door.x, L.door.y, 1, 6); movePlayer(p);    // waves his way off
  if (d < 9 || L.t > 260) { p.on = false; p.outroFree = false; rebuildActive(); S.outro.lapper = null; S.outro.gap = OUTRO.starGap; if (JB.el) JB.el.classList.remove('mini'); }
}
function outroEmptySeats(frac) {
  const empty = list => { for (const st of list || []) if (!st.empty && Math.random() < frac) st.empty = true; };
  if (typeof crowdSeats !== 'undefined') empty(crowdSeats);
  if (typeof crowdRedraw0 === 'function') crowdRedraw0();
  if (typeof STAD !== 'undefined' && STAD.sides) for (const sd of ['L', 'R']) { const side = STAD.sides[sd]; if (side) { empty(side.seats); empty(side.straddle); side.frames = []; } }
  if (typeof STAD !== 'undefined') STAD.dirty = true;
}
function finishOutro() {
  const O = S.outro; if (!O) return;
  S.outro = null;
  for (const p of POOL) p.outroFree = false;
  if (typeof JB !== 'undefined' && JB.el) JB.el.classList.remove('mini');
  if (typeof jbOff === 'function') jbOff();
  particles.length = 0; floaters.length = 0;
  S.screen = 'post';
  if (S.match && S.match.onEnd) S.match.onEnd(O.result);
}
// ---------- the Jumbotron cards (drawn in canvas pixels)
function jbCardBg(c, w, h, col) {
  c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false;
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#141a3a'); g.addColorStop(1, '#05060d'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = col || '#ffd23f'; c.fillRect(0, 0, w, Math.max(3, h / 40)); c.fillRect(0, h - Math.max(3, h / 40), w, Math.max(3, h / 40));
}
function jbScan(c, w, h) { c.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1); }
// text that always fits: shrinks to the width it is given (maxW in canvas pixels)
const jbTxt = (c, s, x, y, col, sz, center, maxW) => { s = String(s); const w0 = pTextW(s) || 1; sz = Math.max(1, Math.min(sz, Math.floor((maxW || c.canvas.width * 0.9) / w0))); if (center) x -= w0 * sz / 2; pText(c, s, Math.round(x), Math.round(y), col, sz); };
function outroFinalCard(c, f, w, h, res) {
  jbCardBg(c, w, h);
  const sz = Math.max(2, Math.floor(w / 110)), big = sz * 3, win = res.winner;
  jbTxt(c, 'FINAL' + (res.so ? ' / SHOOTOUT' : res.ot ? ' / EXTRA TIME' : ''), w / 2, h * 0.1, '#ffd23f', sz, true);
  for (const t of [0, 1]) {
    const T = TEAM[t], x = w * (t ? 0.72 : 0.28), on = (f >> 4) & 1;
    // the abbreviation on top, then the score underneath with a clear gap (sized so the two never overlap)
    const top = h * 0.24, bot = h * 0.74, aSz = sz + Math.floor(sz / 2), aY = top + sz * 2, sY = aY + aSz * 7 + sz * 2;
    const sSz = Math.max(sz, Math.min(big, Math.floor((bot - h * 0.06 - sY) / 7)));
    c.fillStyle = T.main; c.fillRect(x - w * 0.18, top, w * 0.36, bot - top);
    c.fillStyle = T.dark || '#000'; c.fillRect(x - w * 0.18, bot - h * 0.05, w * 0.36, h * 0.05);
    jbTxt(c, T.abbr, x, aY, lum(T.main) > 0.55 ? '#141832' : '#ffffff', aSz, true, w * 0.32);
    jbTxt(c, res.score[t], x, sY, t === win && on ? (lum(T.main) > 0.55 ? '#b8860b' : '#ffd23f') : (lum(T.main) > 0.55 ? '#141832' : '#ffffff'), sSz, true, w * 0.3);
  }
  if (f > 60) jbTxt(c, win < 0 ? 'A DRAW!' : TEAM[win].nick ? (TEAM[win].nick.toUpperCase() + ' WIN!') : 'WINNER!', w / 2, h * 0.81, '#ffffff', Math.round(sz * 1.5), true);
  jbScan(c, w, h);
}
function outroStarCard(c, f, w, h, l, i, L) {
  const col = ['#ffd23f', '#d6dbe6', '#d08a4a'][i];
  jbCardBg(c, w, h, col);
  const sz = Math.max(2, Math.floor(w / 100)), T = TEAM[l.team] || TEAM[0];
  // above the title: one BIG star for the first star, two medium for the second, three little for the third (twinkling)
  const big = Math.max(3, Math.floor(Math.min(w / 34, h * 0.27 / 9))), n = i + 1;
  const ss = Math.max(2, Math.round(big * [1, 0.6, 0.42][i])), gap = ss * 12, x0 = w / 2 - (n - 1) * gap / 2;
  for (let k = 0; k < n; k++) if ((f + k * 9) % 40 < 34) jbStar(c, x0 + k * gap, h * 0.17, ss, col);
  jbTxt(c, ['FIRST', 'SECOND', 'THIRD'][i] + ' STAR', w / 2, h * 0.34, col, sz * 2, true, w * 0.8);
  c.fillStyle = T.main; c.fillRect(w * 0.06, h * 0.47, w * 0.88, h * 0.2); c.fillStyle = T.trim || '#fff'; c.fillRect(w * 0.06, h * 0.65, w * 0.88, h * 0.02);
  jbTxt(c, '#' + l.num + ' ' + l.name.toUpperCase(), w / 2, h * 0.52, lum(T.main) > 0.55 ? '#141832' : '#ffffff', sz * 2, true, w * 0.84);
  const line = typeof starStat === 'function' ? String(starStat(l, l.pos) || '').toUpperCase() : '';
  if (line) jbTxt(c, line, w / 2, h * 0.73, '#ffffff', sz, true, w * 0.9);
  if (l._why) jbTxt(c, String(l._why).toUpperCase(), w / 2, h * 0.84, '#9aa3c7', sz, true, w * 0.9);
  jbScan(c, w, h);
}
function jbStar(c, x, y, s, col) {        // a 9x9 pixel star
  const rows = ['....#....', '....#....', '...###...', '#########', '.#######.', '..#####..', '..##.##..', '.##...##.', '##.....##'];
  c.fillStyle = col;
  rows.forEach((row, j) => { for (let k = 0; k < 9; k++) if (row[k] === '#') c.fillRect(Math.round(x + (k - 4.5) * s), Math.round(y + (j - 4.5) * s), s, s); });
}
function outroStatsCard(c, f, w, h, res) {
  jbCardBg(c, w, h);
  const sz = Math.max(2, Math.floor(w / 130)), tm = res.team || [{}, {}], ts = res.tstats || [{}, {}];
  jbTxt(c, 'GAME STATS', w / 2, h * 0.07, '#ffd23f', sz * 2, true);
  jbTxt(c, TEAM[0].abbr, w * 0.22, h * 0.21, textCol(TEAM[0]), sz * 2, true, w * 0.25); jbTxt(c, TEAM[1].abbr, w * 0.78, h * 0.21, textCol(TEAM[1]), sz * 2, true, w * 0.25);
  const fo = t => { const a = (res.stats || []).filter(l => l.team === t).reduce((s, l) => s + (l.fow || 0), 0), b = (res.stats || []).filter(l => l.team === t).reduce((s, l) => s + (l.fot || 0), 0); return b ? a + '/' + b : '-'; };
  const cds = t => Math.round((res.stats || []).filter(l => l.team === t).reduce((s, l) => s + (l.pim || 0), 0) / ((typeof BAL !== 'undefined' && BAL.pen && BAL.pen.len) || 1));
  const svs = t => tm[1 - t].sog != null ? Math.max(0, tm[1 - t].sog - res.score[1 - t]) : '-';
  const rows = [['GOALS', res.score[0], res.score[1]], ['SHOTS', tm[0].sog ?? '-', tm[1].sog ?? '-'], ['TACKLES', tm[0].hit ?? '-', tm[1].hit ?? '-'],
    ['CARDS', cds(0), cds(1)], ['SAVES', svs(0), svs(1)]];
  rows.forEach((r, k) => {
    const y = h * (0.36 + k * 0.12), show = f > 12 * k;
    if (!show) return;
    jbTxt(c, r[0], w / 2, y, '#9aa3c7', sz, true, w * 0.3); jbTxt(c, r[1], w * 0.22, y, '#ffffff', Math.round(sz * 1.3), true, w * 0.25); jbTxt(c, r[2], w * 0.78, y, '#ffffff', Math.round(sz * 1.3), true, w * 0.25);
  });
  jbScan(c, w, h);
}
function drawOutroOverlay() {
  const O = S.outro; if (!O) return;
  toScreen();
  if (O.t > 30) text('SPACE / ENTER TO SKIP', viewW() / 2, HUDH + viewH() - 12, 'rgba(255,255,255,.65)', 6, 'center', null);
}
function drawStarIcon(x, y, col) {
  ctx.fillStyle = col;
  ctx.fillRect(x - 1, y - 5, 2, 3); ctx.fillRect(x - 5, y - 2, 10, 2); ctx.fillRect(x - 3, y, 6, 2); ctx.fillRect(x - 4, y + 2, 3, 2); ctx.fillRect(x + 1, y + 2, 3, 2);
}

// ====================================================================
//  WALKOUT: before the opening faceoff (and after each intermission) the teams come out of the tunnel under the
//  stands. The home starters (goalie first) skate through the gate onto the ice one by one while the Jumbotron and
//  the announcer introduce them, then the visitors' starters; then the rest of the skaters, the spare goalies and
//  the coaches walk down the corridor to their benches. SPACE or ENTER skips it.
// ====================================================================
const WALK_SKIP_KEYS = ['Space', 'Enter', 'NumpadEnter'];
function startWalkout(first, deferred) {
  S.walk = null;
  if (!S.match || S.match.demo || S.match.test || S.match.noWalk || S.demo || S.so || (S.pres && S.pres.walkout === false) || typeof benchLayout !== 'function') return;
  const hm = S.match.home ?? 0, order = [hm, 1 - hm], W0 = { t: 0, first, movers: [], arrived: new Set(), focus: null, cur: null, deferred };
  const spawn = t => { const s0 = WALK_SPAWN[t === hm ? 0 : 1]; return { x: s0.x, y: s0.y }; };
  let at = first ? 40 : 20;
  // the starters: goalie first, then the skaters, home team then visitors; out of the tunnel, through the gate
  for (const t of order) {
    const g = goalies[t] && goalies[t].on ? [goalies[t]] : [], sk = teamSkaters(t).slice().sort((a, b) => a.role - b.role);
    for (const p of g.concat(sk)) {
      const s0 = spawn(t), gy = t === hm ? CY - 5 : CY + 5;
      const m = { kind: 'starter', p, t, tgt: { x: p.x, y: p.y, fx: p.fx, fy: p.fy }, at,
        path: [s0, { x: R.l - 3, y: gy }, { x: R.l + 14, y: gy }, { x: p.x, y: p.y }] };
      p.walkHide = true; p.walkAlpha = 0; p.x = s0.x; p.y = s0.y; p.vx = p.vy = 0;
      W0.movers.push(m); at += first ? 96 : 18;   // first walkout of the game: 1.6 s each, a moment in the spotlight; later periods: quick, house lights up
    }
    if (first) at += 30;
  }
  // the rest: skaters, then spare goalies, then coaches; along the corridor and in through each bench's doorway
  const crew = [], lays = order.map(t => ({ t, L: benchLayout(t) }));
  for (const kind of ['s', 'g', 'c']) for (const { t, L } of lays) {
    const list = kind === 'c' ? L.coaches : L.seats.filter(s => (kind === 'g') === !!s.g);
    for (const s of list) crew.push({ t, s, kind });
  }
  crew.forEach((c, i) => {
    const home = c.t === hm, s0 = spawn(c.t), lx = WALK_LANE_X[home ? 0 : 1];
    const doorY = home ? BENCH_Y[0] + BENCH_LEN - 3 : BENCH_Y[1] + 3, back = c.kind !== 's';
    W0.movers.push({ kind: c.kind === 'c' ? 'coach' : 'crew', t: c.t, s: c.s, at: at + i * (first ? 7 : 5),
      path: [s0, { x: lx, y: s0.y }, { x: lx, y: doorY }, { x: back ? c.s.x + 7 : c.s.x - 12, y: c.s.y }, { x: c.s.x, y: c.s.y }] });
  });
  S.walk = W0;
  if (!first && typeof ALS !== 'undefined') { ALS.spot = 0; ALS.fx = null; ALS.post = 0; }   // periods 2-3: no spotlight on the way back out
}
function walkerPos(m) { return m.pos || m.path[0]; }
function walkTick() {
  const W0 = S.walk; if (!W0) return;
  W0.t++;
  const hm = S.match.home ?? 0;
  let busy = 0;
  for (const m of W0.movers) {
    if (m.done) continue;
    busy++;
    if (W0.t < m.at) continue;
    if (!m.pos) {                                                            // he appears in the tunnel mouth
      m.pos = { x: m.path[0].x, y: m.path[0].y }; m.seg = 1; m.anim = 0;
      if (m.kind === 'starter') {
        m.p.walkHide = false; m.p.walkAlpha = 0;
        const T = TEAM[m.t], who = (m.p.pl ? '#' + m.p.pl.num + ' ' + (m.p.pl.first + ' ' + m.p.pl.last).toUpperCase() : 'NUMBER ' + m.p.num);
        if (W0.first) {
          const role = m.p.g ? 'IN GOAL' : ({ C: 'AT CENTRE', LW: 'ON THE LEFT', RW: 'ON THE RIGHT', LD: 'ON THE LEFT · D', RD: 'ON THE RIGHT · D' }[m.p.pl && m.p.pl.spos] || 'PLAYER');
          W0.cur = { t: m.t, pl: m.p.pl, num: m.p.pl ? m.p.pl.num : m.p.num, name: m.p.pl ? m.p.pl.last.toUpperCase() : '', role, life: 110 };
          say([`STARTING ${role} FOR THE ${(T.nick || T.abbr).toUpperCase()}... ${who}!`], 3);
          if (typeof sfx !== 'undefined') sfx.cheer(m.t === hm ? 0.9 : 0.35);
        }
      }
    }
    const tgt = m.path[m.seg], dx = tgt.x - m.pos.x, dy = tgt.y - m.pos.y, d = hyp(dx, dy);
    const onIce = m.kind === 'starter' && m.seg >= 3, spd = onIce ? 2.6 : m.kind === 'starter' ? 1.8 : m.kind === 'coach' ? 1.3 : 1.6;
    if (d <= spd) {
      m.pos.x = tgt.x; m.pos.y = tgt.y; m.seg++;
      if (m.seg >= m.path.length) { m.done = true; if (m.kind !== 'starter') W0.arrived.add(m.s.key); else { const p = m.p; p.x = m.tgt.x; p.y = m.tgt.y; p.vx = p.vy = 0; p.fx = m.tgt.fx; p.fy = m.tgt.fy; } }
    } else { m.pos.x += dx / d * spd; m.pos.y += dy / d * spd; m.dir = { x: dx / d, y: dy / d }; m.anim += 0.32; }
    if (m.kind === 'starter' && !m.done) { const p = m.p; p.x = m.pos.x; p.y = m.pos.y; p.vx = m.dir ? m.dir.x * spd : 0; p.vy = m.dir ? m.dir.y * spd : 0; if (m.dir) { p.fx = m.dir.x; p.fy = m.dir.y; } p.anim = (p.anim || 0) + 0.3; }
  }
  // out of the dark: each one shows up straight away, deep in the tunnel and in shadow, and gets brighter and
  // more solid as he walks forward (full colour by the tunnel mouth / the corridor lane)
  for (const m of W0.movers) if (m.pos) {
    const x0 = m.path[0].x, x1 = m.kind === 'starter' ? R.l - 6 : m.path[1].x, k = m.done ? 1 : clamp((m.pos.x - x0) / Math.max(1, x1 - x0), 0, 1);
    const appear = Math.min(1, (W0.t - m.at) / 8);
    m.alpha = appear * (0.4 + 0.6 * k); m.dark = 0.3 + 0.7 * k;
    if (m.kind === 'starter') { m.p.walkAlpha = m.done ? 1 : m.alpha; m.p.walkDark = m.done ? 1 : m.dark; }
  }
  if (W0.cur && --W0.cur.life <= 0) W0.cur = null;
  // the camera watches the latest starter coming out, then the rink
  const lead = W0.movers.filter(m => m.kind === 'starter' && m.pos && !m.done).pop();
  W0.focus = lead ? { x: lead.pos.x, y: lead.pos.y } : { x: CX, y: CY };
  if (!busy) endWalkout();
}
function endWalkout() {
  const W0 = S.walk; if (!W0) return;
  for (const m of W0.movers) {
    if (m.kind === 'starter') { const p = m.p; p.walkHide = false; p.walkAlpha = 1; p.walkDark = 1; p.x = m.tgt.x; p.y = m.tgt.y; p.vx = p.vy = 0; p.fx = m.tgt.fx; p.fy = m.tgt.fy; }
  }
  S.walk = null;
}
// the crew walking to the benches, drawn with the other figures (sorted by depth)
function walkItems(items, side) {
  const W0 = S.walk; if (!W0) return;
  for (const m of W0.movers) {
    if (m.kind === 'starter' || !m.pos || m.done) continue;
    const T = TEAM[m.t], x = m.pos.x, y = m.pos.y;
    const a = m.alpha ?? 1, dk = m.dark ?? 1, fade = fn => () => drawShadowed(fn, a, dk);
    if (m.kind === 'coach') { items.push({ y, d: fade(() => drawCoach(x, y, T, m.t, m.s.asst)) }); continue; }
    const dir = m.dir || { x: 1, y: 0 };
    const f = fakeSkater({ x, y, team: m.t, pl: m.s.pl, num: m.s.pl ? m.s.pl.num : 0, g: !!m.s.g, fx: dir.x, fy: dir.y, vx: dir.x, vy: dir.y, anim: m.anim, hand: (m.s.pl && m.s.pl.hand) || 'L' });
    items.push({ y, d: fade(() => (f.g ? drawGoalie(f) : drawSkater(f))) });
  }
}
function walkSkip(code) { if (S.walk && S.screen === 'play' && WALK_SKIP_KEYS.includes(code) && S.walk.t > 20) { endWalkout(); return true; } return false; }
