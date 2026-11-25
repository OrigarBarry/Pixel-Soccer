'use strict';
// ====================================================================
//  BROADCAST: who has the puck, name tags, goal-scorer cards, celebrations,
//  hat tricks, the Last Goal bug, pregame spotlights and the coach's line chooser.
//  Purely presentational: nothing here changes statistics.  (shares engine globals)
// ====================================================================
S.pres = S.pres || { carrier: true, labels: true, goal: 'FULL', spot: true, hats: true, stars: 'FULL', linePick: true };
const POS_OF = p => p.g ? 'G' : p.pl && p.pl.spos ? posShort(p.pl.spos) : ['L', 'C', 'R'][p.role] || 'F';
const ORD = n => n + (['TH', 'ST', 'ND', 'RD'][(n % 100 - 20) % 10] || ['TH', 'ST', 'ND', 'RD'][n % 100] || 'TH');
const lastName = p => p && p.pl ? p.pl.last.toUpperCase() : '';
const shortName = p => p && p.pl ? (p.pl.first ? p.pl.first[0] + '. ' : '') + p.pl.last.toUpperCase() : '';
// contrast helper: a ring colour that stands out on white ice and dark jerseys
const ringCol = T0 => lum(T0.main) > 0.8 ? T0.dark : T0.main;

// ---------- puck carrier: filled team-colour disc under the skates (the yellow outline + arrow is YOU)
function drawCarrierRing(p) {
  if (!S.pres.carrier || !p) return;
  toWorld();
  const C = TEAM[p.team], pulse = 0.5 + 0.2 * Math.sin(S.t * 0.25);
  ctx.globalAlpha = pulse; ctx.fillStyle = ringCol(C);
  ctx.beginPath(); ctx.ellipse(p.x, p.y + 1.2, p.g ? 9 : 7.2, p.g ? 3.8 : 3.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1; ctx.strokeStyle = '#0b0e1e'; ctx.lineWidth = 0.6; ctx.stroke();
  // small team-coloured puck pip beside the feet
  ctx.fillStyle = '#0b0e1e'; ctx.fillRect(p.x + 7, p.y - 0.5, 3, 2.4); ctx.fillStyle = C.trim; ctx.fillRect(p.x + 7.6, p.y, 1.8, 1.2);
}
// ---------- live strip under the scoreboard: who has it
function drawCarrierHud() {
  if (!S.pres.carrier || S.screen !== 'play' || !(S.phase === 'live' || S.phase === 'penalty')) return;
  toScreen();
  const o = puck.owner, SW = viewW(), rh = typeof rulesHudH === 'function' ? rulesHudH() : 0, y = HUDH + 2 + (rh ? rh + 2 : 0);
  let txt, C = null;
  if (o && o.pl) { C = TEAM[o.team]; txt = `#${o.num} ${shortName(o)} — ${POS_OF(o)} · ${C.abbr}${o.pl && o.cap ? ' (' + o.cap + ')' : ''}`; }
  else txt = 'LOOSE BALL';
  const w = txt.length * 6 + 18, x = (SW - w) / 2;
  // (Nov 23 visuals) with the play right under it (a shot on the far net with the closer cameras), it fades right down
  const under = [puck].concat(goalies.filter(Boolean)).some(q => q && q.y - camY < y - HUDH + 34 && Math.abs(q.x - (camX + SW / 2)) < w / 2 + 12);
  ctx.globalAlpha = (o ? 0.92 : 0.55) * (under ? 0.3 : 1);
  ctx.fillStyle = 'rgba(11,14,30,.88)'; ctx.fillRect(x, y, w, 11);
  if (C) { ctx.fillStyle = ringCol(C); ctx.fillRect(x, y, 5, 11); }
  text(txt, x + 11, y + 3, o ? '#ffffff' : '#9aa3c7', 6, 'left', null);
  ctx.globalAlpha = 1;
}
// ---------- floating name tags (possession changes, switching skaters)
const TAGS = [];
function addTag(p, txt, color, life = 60) {
  if (!S.pres.labels || !p) return;
  for (let i = TAGS.length - 1; i >= 0; i--) if (TAGS[i].p === p) TAGS.splice(i, 1);
  // (Nov 23 visuals) at most two name tags at once: a faceoff scramble used to stack four or five over the pile; older
  // ones fade out quickly when a new one comes
  const keep = 1; let n = 0;
  for (let i = TAGS.length - 1; i >= 0; i--) if (TAGS[i].life > 10 && ++n > keep) TAGS[i].life = 10;
  TAGS.push({ p, txt, color, life, max: life });
  while (TAGS.length > 2) TAGS.shift();   // (Nov 24, from Pixel Hockey) never more than two on screen: in a goalmouth scramble the fading ones piled up
}
function onPossessionChange(o) {
  if (o && o.pl) addTag(o, (o.team === 0 && o === ctrl ? '' : '') + '#' + o.num + ' ' + lastName(o), ringCol(TEAM[o.team]) === TEAM[o.team].main && lum(TEAM[o.team].main) < 0.25 ? '#9fd0ff' : '#ffffff', 60);
}
function onControlSwitch(p) { if (p && p.pl && !p.g && S.phase !== 'faceoff') addTag(p, '▶ #' + p.num + ' ' + lastName(p), '#ffd23f', 55); }
// HEAT icons (Nov 21): a flame that grows through stages 1-4 as he heats up; at 5 (HOT) the whole box lights up.
// Cold: a small dim snowflake while he's cooling, a full one in an icy box once he's cold.
const HEAT_FL = [
  ['.r.', 'ror', 'ror', '.r.'],
  ['..r..', '.rr..', '.ror.', 'royor', 'royor', '.rrr.'],
  ['...r...', '..rr...', '..ror..', '.royr..', '.royor.', 'royyor.', 'royyyor', 'royyyor', '.rooor.'],
  ['....r....', '...rr....', '...ror...', '..royr...', '..royor.r', '.royyor.r', '.royyyorr', 'royywyyor', 'royywyyor', '.royyyor.', '..rooor..'],
  ['....r......', '...rr...r..', '...ror..rr.', '..royr..ror', '..royorroyr', '.royyorroyr', '.royyyoyyor', 'royywyyyyor', 'royywwyyyor', 'royywwwyyor', '.royywwyor.', '..royyyyor.', '...rooooo..'],
];
const HEAT_COOL = ['..b..', '.bib.', 'bbibb', '.bib.', '..b..'], HEAT_COLD = ['b.b.b', '.bib.', 'biiib', '.bib.', 'b.b.b'];
function drawStreakIcons() {
  if (typeof streakIconOf !== 'function' || !S.match) return;
  toWorld();
  for (const p of players) {
    const st = streakIconOf(p); if (!st) continue;
    const k = typeof st === 'string' ? { k: st, s: st === 'hot' ? 5 : 2 } : st;
    const u = 1.4, fl = (S.t >> 3) & 1;
    const art = k.k === 'hot' ? HEAT_FL[k.s - 1] : k.s === 2 ? HEAT_COLD : HEAT_COOL;
    const rows = art.length, cols = art[0].length, bw = (cols + 2) * u, bh = (rows + 2) * u;
    const x = Math.round(p.x + 7), y = Math.round(p.y - (p.g ? 22 : 23) - bh);   // the box's foot just above his head (the old icon's spot)
    const pal = k.k === 'hot' ? { r: fl && k.s >= 3 ? '#ff5a24' : '#e8401a', o: '#ffa01f', y: '#ffe36a', w: '#fffbe6' }
      : k.s === 2 ? { b: '#bfe4ff', i: '#ffffff' } : { b: '#7aa0d2', i: '#c8e1ff' };
    if (k.k === 'hot' && k.s === 5) {                 // HOT: the whole box lights up
      ctx.fillStyle = fl ? 'rgba(255,150,40,.55)' : 'rgba(255,110,30,.4)'; ctx.fillRect(x - 2.2, y - 2.2, bw + 4.4, bh + 4.4);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 1, y - 1, bw + 2, bh + 2);
      ctx.fillStyle = '#5a1a0a'; ctx.fillRect(x, y, bw, bh);
      ctx.fillStyle = '#ffe36a'; const sp = [[-2.6, 1 + fl * 3], [bw + 1.4, 4 - fl * 2], [bw * 0.4, -2.8 + fl], [-1.8, bh - 2], [bw + 1, bh - 4 + fl * 2]];
      for (const [sx, sy] of sp) ctx.fillRect(x + sx, y + sy, 1.2, 1.2);
    } else if (k.k === 'cold' && k.s === 2) {
      ctx.fillStyle = '#8cc8ff'; ctx.fillRect(x - 0.8, y - 0.8, bw + 1.6, bh + 1.6);
      ctx.fillStyle = '#102850'; ctx.fillRect(x, y, bw, bh);
    } else { ctx.fillStyle = 'rgba(11,14,30,.62)'; ctx.fillRect(x, y, bw, bh); }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const c = pal[art[j][i]]; if (c) { ctx.fillStyle = c; ctx.fillRect(x + (i + 1) * u, y + (j + 1) * u, u, u); } }
  }
}
// the open option: with the puck in their zone, a soft ring under the teammate the play is looking for
// (a cutter, the man in the slot, the back door). A hint only: the pass is still yours to make
function drawOpenCut() {
  if (S.autoAI || S.screen !== 'play' || S.phase !== 'live' || !ctrl || puck.owner !== ctrl || ctrl.g || typeof patternTarget !== 'function') { S.openCut = null; return; }
  if (zoneFor(0, puck.y) !== 'att') { S.openCut = null; return; }
  if (S.t % 12 === 0) S.openCut = patternTarget(ctrl, false);
  const m = S.openCut; if (!m || !m.on) return;
  toWorld();
  ctx.save(); ctx.globalAlpha = 0.45 + 0.2 * Math.sin(S.t * 0.15);
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(m.x, m.y + 7, 10, 4.5, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
function tickTags() { for (let i = TAGS.length - 1; i >= 0; i--) { const t = TAGS[i]; t.life--; if (t.life <= 0) TAGS.splice(i, 1); } }
function drawTagBoxes() {
  const placed = [];                                                   // (Nov 22) boxes already drawn this frame: a tag that would cover one moves up
  for (const t of TAGS) {
    if (S.phase === 'faceoff' && S.fo && S.fo.takers && S.fo.takers.includes(t.p) && S.timer <= FO.readyT + 6) continue;
    if (S.banner || S.phase === 'fight' || S.phase === 'ask') continue;                       // (Nov 22) under a whistle banner or a fight they printed over its text   // (Nov 22) out of the way of the referee's READY? and the drop
    toWorld();
    ctx.globalAlpha = Math.min(1, t.life / 15);
    ctx.font = (6 * CTS).toFixed(1) + "px 'PH Pixel', monospace";
    const w = Math.ceil(ctx.measureText(t.txt).width) + 6, x = t.p.x - w / 2;   // (Nov 24, from Pixel Hockey) measured at the real text size: the first letter used to stick out
    let y = t.p.y - 38;
    for (let k = 0; k < 4; k++) { const hit = placed.find(b => x < b.x + b.w && b.x < x + w && y < b.y + 10 && b.y < y + 10); if (!hit) break; y = hit.y - 10; }
    placed.push({ x, y, w });
    ctx.fillStyle = 'rgba(11,14,30,.8)'; ctx.fillRect(x, y, w, 9);
    text(t.txt, t.p.x, y + 1.5, t.color, 6, 'center', null);
    ctx.globalAlpha = 1;
  }
}
// (drawn on the stands canvases too: see worldTags / drawOverlaysOn in engine.js)

// ====================================================================
//  GOAL PRESENTATION: card, signature celebrations, hats, Last Goal bug
// ====================================================================
function plOfPid(pid, team) {
  for (const p of players) if (p.pl && p.pl.id === pid) return p.pl;
  const lu = S.match && S.match.lineups ? S.match.lineups[team] : null;
  return lu ? lu.lines.flat().concat([lu.goalie]).find(x => x && x.id === pid) : null;
}
function onGoalPresentation(team) {
  if (!MS || S.so) return;
  const lg = MS.lastGoal; if (!lg) return;
  const pid = lg.scorer, ln = pid ? MS.p[pid] : null, pl = pid ? plOfPid(pid, team) : null;
  const base = S.match && S.match.base ? S.match.base[pid] : null;
  const gameGoals = ln ? ln.g : 0, special = [];
  // only facts: recorded goals tonight, recorded season/career totals passed in by the franchise
  if (lg.ot) special.push(S.match && S.match.clinch && team === 0 ? 'EXTRA TIME WINNER! ' + (S.match.clinch.name || 'CHAMPIONS').toUpperCase() + '!' : 'EXTRA TIME WINNER!');
  if (gameGoals === 3) { special.push('HAT TRICK!'); setTimeout(() => { typeof voiceCue === 'function' && voiceCue('hattrick'); }, 2300); } else if (gameGoals >= 4) special.push(gameGoals + '-GOAL GAME!');
  if (lg.tie && !lg.ot) special.push('TIES IT LATE!');
  if (lg.pen) special.push('PENALTY KICK GOAL!');
  if (base) {
    const career = base.cg + gameGoals;
    if (career === 1) special.push('FIRST CAREER GOAL!');
    else for (const m of [25, 50, 100, 200, 300]) if (base.cg < m && career >= m) special.push(`CAREER GOAL #${m}!`);
  }
  const ast = (lg.assists || []).map(id => MS.p[id]).filter(Boolean).map(a => '#' + a.num + ' ' + a.name.toUpperCase());
  S.goalCard = { team, pid, pl, num: ln ? ln.num : '', name: ln ? ln.name.toUpperCase() : (TEAM[team].abbr + ' GOAL'), gameGoals,
    seasonGoals: base ? base.sg + gameGoals : null, ast, special, t: 0, cap: pl && S.match && S.match.lineups ? S.match.lineups[team].leaders && S.match.lineups[team].leaders[pid] : null };
  if (S.pres.goal === 'FULL') S.timer = Math.max(S.timer, 240);
  S.lastGoalHud = { team, text: `LAST GOAL: #${S.goalCard.num} ${ln ? ln.name.toUpperCase() : ''}` + (ast.length ? ' (' + ast.map(a => a.split(' ')[0]).join(', ') + ')' : '') + ` · ${TEAM[team].abbr} · ${S.period >= 4 ? 'ET' : ['1ST', '1ST', '2ND'][S.period - 1]} ${fmtClock(S.clock)}`, life: 0 };
  // the scorer celebrates his way (bigger for the special ones); nearby teammates join in
  const sk = players.find(p => p.pl && p.pl.id === pid);
  if (sk) { sk.celebT = 200; sk.celebType = special.length ? 'big' : lookOf(sk.pl).celeb; sk.celebBase = lookOf(sk.pl).celeb; }
  // home hat trick: hats rain down (once per player per game); away hat tricks get the card only
  MS.hatDone = MS.hatDone || {};
  if (gameGoals === 3 && !MS.hatDone[pid]) {
    MS.hatDone[pid] = true;
    const home = S.match ? S.match.home : 0;
    if (team === home && S.pres.hats) { spawnHats(); S.timer = Math.max(S.timer, 300); }
    S.hatCard = { team, num: S.goalCard.num, name: S.goalCard.name, abbr: TEAM[team].abbr, home: team === home, life: 300 };
    sfx.cheer(2);
  }
}
function skipGoalPresentation() {
  if (S.phase !== 'goal') return false;
  S.timer = Math.min(S.timer, 10); S.goalCard = null; S.hatCard = null; HATS.length = 0;
  for (const p of players) p.celebT = 0;
  return true;
}
// celebration movement during the goal stoppage
function celebrateTick() {
  const sc = players.find(p => p.celebT > 0); if (!sc) return;
  for (const p of players) {
    if (p.celebT > 0) {
      p.celebT--;
      const ty = sc.celebType === 'big' ? sc.celebBase : sc.celebType;
      if (ty === 'slide') { p.vx *= 0.985; p.vy *= 0.985; p.inx = p.iny = 0; }
      else if (ty === 'spin') { if (p.celebT % 5 === 0) { const a = Math.atan2(p.fy, p.fx) + Math.PI / 2; p.fx = Math.cos(a); p.fy = Math.sin(a); } p.inx = p.iny = 0; }
      else { p.inx = p.iny = 0; }
    } else if (p.team === sc.team && !p.g && (sc.celebType === 'huddle' || sc.celebType === 'big' || sc.celebBase === 'huddle' || dist(p, sc) < 90)) {
      if (dist(p, sc) > 11) steerTo(p, sc.x, sc.y, 0.75, 10); else { p.inx = p.iny = 0; }
    }
  }
}
// pose tweaks drawn on top of the normal skater sprite (sprite pixels, origin at the feet)
// raised arms hold the stick up in one hand (the normal stick on the ice is not drawn then)
// ---------- hats: thrown from every section of the stands, cosmetic only, cleared before the faceoff
const HATS = [];
function spawnHats() {
  const cols = ['#d9342b', '#1b2a5c', '#f2c230', '#2f8f4a', '#ffffff', '#6a3fa0', '#222222', '#e07b28', TEAM[S.match ? S.match.home : 0].main];
  for (let i = 0; i < 46; i++) {
    const side = i % 4, sx = side === 0 ? R.l - 30 : side === 1 ? R.r + 30 : rand(R.l, R.r), sy = side === 2 ? R.t - 34 : side === 3 ? R.b + 30 : rand(R.t, R.b);
    HATS.push({ sx, sy, tx: rand(R.l + 18, R.r - 18), ty: rand(R.t + 22, R.b - 22), t: -Math.floor(rand(0, 70)), dur: Math.floor(rand(35, 60)), c: cols[i % cols.length], c2: cols[(i * 5 + 3) % cols.length], flip: Math.random() < 0.5 });
  }
}
function tickHats() { for (const h0 of HATS) if (h0.t < h0.dur) h0.t++; }
function drawHats() {
  for (const h0 of HATS) {
    if (h0.t < 0) continue;
    const k = Math.min(1, h0.t / h0.dur), x = h0.sx + (h0.tx - h0.sx) * k, y = h0.sy + (h0.ty - h0.sy) * k, z = Math.sin(k * Math.PI) * 30;
    toSprite(x, y);
    if (k < 1) { ctx.fillStyle = 'rgba(20,30,60,.2)'; px(-2, 0, 4, 1); }
    ctx.translate(0, -Math.round(z / SS));
    // SOCCER: a SCARF twirled and thrown (team colours in bars, a little fringe at each end)
    for (let i = 0; i < 8; i++) { ctx.fillStyle = (i >> 1) & 1 ? h0.c2 : h0.c; px(-4 + i, h0.flip ? -1 + (i > 3 ? 1 : 0) : -1, 1, 2); }
    ctx.fillStyle = '#eef1f6'; px(-5, -1, 1, 1); px(4, h0.flip ? 0 : -1, 1, 1);
  }
}
// ---------- the broadcast goal card (screen space), Jumbotron-style HAT TRICK! screen, Last Goal bug
function drawGoalCard() {
  const G = S.goalCard; if (!G || S.phase !== 'goal' || S.pres.goal === 'OFF') return;
  G.t++;
  toScreen();
  const SW = viewW(), C = TEAM[G.team], short = S.pres.goal === 'SHORT';
  const w = Math.min(SW - 16, short ? 230 : 300), hh = short ? 30 : 62, x = (SW - w) / 2;
  const slide = S.screen === 'paused' ? 1 : Math.min(1, G.t / 12), y = HUDH + viewH() - hh - 10 + (1 - slide) * (hh + 20);
  ctx.fillStyle = '#05060d'; ctx.fillRect(x - 2, y - 2, w + 4, hh + 4);
  ctx.fillStyle = C.main; ctx.fillRect(x, y, w, hh);
  ctx.fillStyle = C.dark; ctx.fillRect(x, y + hh - 6, w, 6); ctx.fillStyle = C.trim; ctx.fillRect(x, y + hh - 7, w, 1);
  const tc = lum(C.main) > 0.6 ? '#141832' : '#ffffff';
  let tx = x + 8;
  if (!short && G.pl) { drawPortrait(ctx, G.pl, C, x + 5, y + 5, 3.2, { num: G.num, cap: G.cap }); tx = x + 62; }
  text('GOAL!', tx, y + 5, '#ffd23f', short ? 8 : 12, 'left', '#000');
  text(`#${G.num} ${G.name}`, tx + (short ? 52 : 0), y + (short ? 5 : 21), tc, 8, 'left', null);
  if (!short) {
    const line2 = (G.seasonGoals != null ? `${ORD(G.gameGoals)} GOAL TONIGHT — ${ORD(G.seasonGoals)} THIS SEASON` : `${ORD(G.gameGoals)} GOAL TONIGHT`).toUpperCase();
    text(line2, tx, y + 33, tc, 6, 'left', null);
    text(G.ast.length ? 'ASSISTS: ' + G.ast.join(', ') : 'UNASSISTED', tx, y + 43, tc, 6, 'left', null);
  } else if (G.ast.length) text('A: ' + G.ast.map(a => a.split(' ')[0]).join(', '), tx, y + 18, tc, 6, 'left', null);
  if (G.special.length) {
    const sp = G.special[Math.floor(G.t / 70) % G.special.length];
    const sw = sp.length * 8 + 16, sx = (SW - sw) / 2, sy = y - 18;
    ctx.fillStyle = ((G.t >> 3) & 1) ? '#ffd23f' : '#ffe98a'; ctx.fillRect(sx, sy, sw, 14);
    text(sp, SW / 2, sy + 3, '#2a1a00', 8, 'center', null);
  }
  if (G.t > 30) text('ANY KEY: SKIP', SW - 8, y - 9, 'rgba(255,255,255,.5)', 6, 'right', null);
}
function drawHatCard() {
  const H0 = S.hatCard; if (!H0 || H0.life <= 0) return;
  H0.life--;
  if (S.phase !== 'goal' && H0.life > 60) H0.life = 60;
  toScreen();
  const SW = viewW(), w = Math.min(SW - 30, 220), hh = 52, x = (SW - w) / 2, y = HUDH + 14;
  ctx.globalAlpha = Math.min(1, H0.life / 20);
  ctx.fillStyle = '#05060d'; ctx.fillRect(x - 4, y - 4, w + 8, hh + 8);
  ctx.fillStyle = '#10142a'; ctx.fillRect(x, y, w, hh);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; for (let yy = y; yy < y + hh; yy += 2) ctx.fillRect(x, yy, w, 1);   // big-screen scanlines
  text(H0.home ? 'HAT TRICK!' : 'HAT TRICK', SW / 2, y + 6, (S.t >> 3) & 1 ? '#ffd23f' : '#ffffff', H0.home ? 16 : 12, 'center', '#5a2a00');
  text(`#${H0.num} ${H0.name} · ${H0.abbr}`, SW / 2, y + 30, '#ffffff', 6, 'center', null);
  text(H0.home ? 'SCARVES IN THE AIR!' : 'THREE GOALS TONIGHT', SW / 2, y + 41, '#9fd0ff', 6, 'center', null);
  ctx.globalAlpha = 1;
}
function drawLastGoalHud() {
  const L = S.lastGoalHud; if (!L || S.phase === 'goal' || S.screen !== 'play') return;
  L.life++; if (L.life > 60 * 7) { S.lastGoalHud = null; return; }
  toScreen();
  const txt = L.text, w = Math.min(viewW() - 16, txt.length * 6 + 16), y = HUDH + viewH() - 14;
  ctx.globalAlpha = Math.min(1, (60 * 7 - L.life) / 30);
  ctx.fillStyle = 'rgba(11,14,30,.85)'; ctx.fillRect(8, y, w, 11);
  ctx.fillStyle = ringCol(TEAM[L.team]); ctx.fillRect(8, y, 3, 11);
  text(txt.slice(0, Math.floor((w - 16) / 6)), 14, y + 3, '#ffffff', 6, 'left', null);
  ctx.globalAlpha = 1;
}

// ====================================================================
//  PREGAME SPOTLIGHTS (in the arena, before the opening faceoff; skippable)
// ====================================================================
function startSpotlights(list) { if (!S.pres.spot || !list || !list.length) return; S.spot = { list, i: 0, t: 0, active: true }; }
function tickSpotlight() { const sp = S.spot; if (!sp || !sp.active) return; if (++sp.t > 150) { sp.i++; sp.t = 0; if (sp.i >= sp.list.length) sp.active = false; } }
function skipSpotlight() { if (S.spot && S.spot.active) { S.spot.active = false; return true; } return false; }
function drawSpotlight() {
  const sp = S.spot; if (!sp || !sp.active || S.walk) return;          // waits for the walkout to finish (it only ticks at the faceoff)
  const it = sp.list[sp.i]; if (!it) return;
  toScreen();
  const SW = viewW(), C = TEAM[it.team] || TEAM[0], w = Math.min(SW - 20, 290), hh = 62, x = (SW - w) / 2, y = HUDH + 30;
  const e = S.screen === 'paused' ? 1 : Math.min(1, sp.t / 12), xx = x - (1 - e) * (SW / 2);   // paused mid-slide (e.g. the window lost focus): show it fully, never half off screen
  ctx.fillStyle = '#05060d'; ctx.fillRect(xx - 2, y - 2, w + 4, hh + 4);
  ctx.fillStyle = '#10142a'; ctx.fillRect(xx, y, w, hh); ctx.fillStyle = C.main; ctx.fillRect(xx, y, 5, hh);
  if (it.pl) drawPortrait(ctx, it.pl, C, xx + 10, y + 7, 3, { num: it.num, cap: it.cap, fav: it.fav });
  text(it.title, xx + 66, y + 7, '#ffd23f', 8, 'left', null);
  text(`#${it.num} ${it.name}`.slice(0, 26), xx + 66, y + 22, '#ffffff', 8, 'left', null);
  text(it.stat.slice(0, 34), xx + 66, y + 37, '#9fd0ff', 6, 'left', null);
  text(C.abbr + (sp.list.length > 1 ? `  ${sp.i + 1}/${sp.list.length}` : ''), xx + 66, y + 48, '#9aa3c7', 6, 'left', null);
  text('ANY KEY: SKIP', xx + w - 6, y + hh + 4, 'rgba(255,255,255,.5)', 6, 'right', null);
}

// ====================================================================
//  COACH: choose the line for the next faceoff (stoppages and intermissions)
// ====================================================================
function lineRatings(t, i) {
  const lu = S.match.lineups[t], L = lu.lines[i].filter(Boolean);
  if (!L.length) return null;
  const av = k => L.reduce((a, p) => a + (p.attrs[k] ?? 5), 0) / L.length;
  const stam = L.reduce((a, p) => a + (MS.stam[p.id] ?? 100), 0) / L.length;
  const off = (av('pow') + av('acc') + av('pas') + av('stk')) / 4, def = (av('def') + av('chk')) / 2;
  const dupes = L.filter(p => lu.lines.some((l2, j) => j !== i && l2.includes(p))).length;
  return { stam, off, def, dupes, role: off - def > 0.6 ? 'SCORING LINE' : def - off > 0.6 ? 'PRESSING LINE' : 'TWO-WAY LINE' };
}
function recommendLine(t) {
  const diff = S.score[t] - S.score[1 - t], late = S.period >= 3 && S.clock < S.periodLen * 0.35, ot = S.period >= 4;
  const pref = ot || (late && diff < 0) ? 'off' : late && diff > 0 ? 'def' : null;
  let best = 0, bs = -1e9, why = '';
  for (let i = 0; i < 3; i++) {
    const r = lineRatings(t, i); if (!r) continue;
    // stamina they'll have by the faceoff (bench recovery), the situation, and a penalty for a tired line
    const ceil = Math.min(100, r.stam + (MS.lines[t].idx === i ? 0 : 6));
    const sc = ceil + (pref === 'off' ? r.off * 7 : pref === 'def' ? r.def * 7 : 0) - (ceil < 40 ? 30 : 0) - r.dupes * 6;
    if (sc > bs) { bs = sc; best = i; why = pref === 'off' ? (ot ? 'best scorers for extra time' : 'chasing a goal') : pref === 'def' ? 'protecting the lead' : 'freshest legs'; }
  }
  return { idx: best, why };
}
function setLine(t, idx) {
  const L = MS.lines[t], lu = S.match.lineups[t];
  if (!lu.lines[idx] || !lu.lines[idx].some(Boolean)) return false;
  L.idx = idx; L.t = 0;
  const avgSta = lu.lines[idx].reduce((a, pl) => a + (pl ? pl.attrs.sta : 5), 0) / 3;
  L.target = rand(45, 60) * (0.85 + avgSta * 0.03);
  const ln = typeof lineFor === 'function' && RS() ? lineFor(t, idx) : lu.lines[idx];
  for (const p of teamSkaters(t)) { const np = ln[p.role]; if (np) { p.pl = np; p.num = np.num; p.cap = lu.leaders ? lu.leaders[np.id] || null : null; p.eff = null; p.charge = -1; } }
  if (typeof fixExtra === 'function' && RS()) { fixExtra(t); refreshEff(); }
  MS.note = { t, text: TEAM[t].abbr + ' LINE ' + (idx + 1), life: 120 };
  return true;
}
function linePickVisible() {
  if (!S.pres.linePick || !MS || S.so || !S.match || !S.match.lineups) return false;
  if (typeof extraPickVisible === 'function' && extraPickVisible()) return false;
  if (S.screen === 'intermission') return true;
  return S.screen === 'play' && !S.minorStop && (S.phase === 'whistle' || S.phase === 'goal' || S.phase === 'faceoff');
}
function pickLine(i) {
  if (!linePickVisible()) return false;
  const r = lineRatings(0, i); if (!r) return false;
  MS.nextLine = i; S.lineHold = false; S.lpExpanded = false;          // picked: collapse again
  if (S.screen === 'play' && S.phase === 'faceoff') { setLine(0, i); MS.nextLine = null; }    // already lining up: change now
  else MS.note = { t: 0, text: 'LINE ' + (i + 1) + ' STARTS NEXT', life: 120 };
  sfx.pick(); updateLinePick(true);
  return true;
}
let lpSig = '';
function updateLinePick(force) {
  const el = $('linePick'); if (!el) return;
  const vis = linePickVisible() && $('wrap').classList.contains('show');
  if (!vis) { if (el.classList.contains('show')) el.classList.remove('show'); lpSig = ''; return; }
  const rec = recommendLine(0), cur = MS.lines[0].idx, next = MS.nextLine;
  const rows = [0, 1, 2].map(i => lineRatings(0, i));
  const exp = !!(S.lpExpanded || S.lineHold);
  const sig = JSON.stringify([rec.idx, cur, next, rows.map(r => r && Math.round(r.stam / 5)), S.lineHold, S.screen, exp]);
  el.classList.add('show'); el.classList.toggle('mini', !exp);
  if (sig === lpSig && !force) return;
  lpSig = sig;
  const lu = S.match.lineups[0], pos = ['LW', 'C', 'RW'];
  if (!exp) {          // minimized: the line on the ice (and the one queued), quick keys, click to expand
    const sel = next != null ? next : cur, r = rows[sel];
    el.innerHTML = `<button class="lprow on" data-x="1"><b>LINE ${sel + 1}</b> ${next != null && next !== cur ? 'NEXT' : 'ON THE PITCH'} · ${r ? Math.round(r.stam) + '%' : ''}${rec.idx !== sel ? ' · <span class="gold">★ L' + (rec.idx + 1) + '</span>' : ''} <span class="muted">· ${['line1', 'line2', 'line3'].map(k => Input.first(k)).join('/')} pick · click to expand</span></button>`;
    el.querySelector('button').onclick = e => { e.stopPropagation(); S.lpExpanded = true; updateLinePick(true); cvs.focus(); };
    return;
  }
  el.innerHTML = '<div class="lphead">NEXT KICKOFF: PICK A LINE' + (S.lineHold ? ' <span class="gold">(HELD)</span>' : '') + '</div>' + rows.map((r, i) => {
    if (!r) return `<div class="lprow off">LINE ${i + 1}: no players</div>`;
    const names = lu.lines[i].map((p, j) => p ? `#${p.num} ${p.last.toUpperCase()} ${pos[j]}` : '-').join(' · ');
    const chosen = next === i || (next == null && cur === i);
    return `<button class="lprow${chosen ? ' on' : ''}" data-i="${i}"><b>${Input.first('line' + (i + 1))}</b> LINE ${i + 1} · ${r.role} · ${Math.round(r.stam)}%` +
      `${rec.idx === i ? ' <span class="gold">★ ' + rec.why.toUpperCase() + '</span>' : ''}${cur === i ? ' <span class="muted">ON THE PITCH</span>' : ''}<br><span class="muted">${names}</span>` +
      `<span class="lpbar"><i style="width:${Math.round(r.stam)}%;background:${r.stam < 40 ? '#ff6a4a' : r.stam < 70 ? '#ffd23f' : '#5ee07a'}"></i></span>${r.dupes ? `<span class="red"> ${r.dupes} double-shifting (short line)</span>` : ''}</button>`;
  }).join('') + `<div class="lphint">${S.screen === 'intermission' ? 'Starts the next half.' : Input.first('line') + ' = hold the kickoff while you choose'} · applies to one kickoff, then lines rotate automatically</div>`;
  el.querySelectorAll('button[data-i]').forEach(b => b.onclick = e => { e.stopPropagation(); pickLine(+b.dataset.i); cvs.focus(); });
}
