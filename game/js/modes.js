'use strict';
// ====================================================================
//  QUICK PLAY MODES: shootout series, first goal wins, tournaments (4/8/16 teams), challenges
//  (power play, penalty kill and their hidden full-game versions), shooting challenges, skill drills
//  (poke check, hitting, deking) and the practice rink. Progress and medals live in the account profile
//  (PROFILE.qp) and some of them unlock cosmetics, the same ones a franchise can earn.
// ====================================================================

// ---------- profile progress
function qpProg() { if (!PROFILE.qp) PROFILE.qp = { best: {}, done: {}, n: {} }; const q = PROFILE.qp; q.best = q.best || {}; q.done = q.done || {}; q.n = q.n || {}; return q; }
function qpCount(key, by = 1) { const q = qpProg(); q.n[key] = (q.n[key] || 0) + by; PROFILE.dirty = true; qpCheckUnlocks(); return q.n[key]; }
function qpFeat(key) { const q = qpProg(); if (q.done[key]) return false; q.done[key] = Date.now(); PROFILE.dirty = true; qpCheckUnlocks(); return true; }
function qpBest(key, val) { const q = qpProg(); if (q.best[key] == null || val > q.best[key]) { q.best[key] = val; PROFILE.dirty = true; return true; } return false; }
const qpHas = key => !!qpProg().done[key];

// Quick Play feats that unlock cosmetics (another way to earn them besides a franchise)
const QP_UNLOCKS = [
  { cos: 'gold_stick',     text: 'Gold in the Shooting Gallery',              ok: () => qpMedal('gallery') >= 3 },
  { cos: 'flame_helmet',   text: 'Gold in the Breakaway Challenge',           ok: () => qpMedal('breakaway') >= 3 },
  { cos: 'gold_visor',     text: 'Score 10 goals in one Overload half',   ok: () => qpHas('ch_pp10') },
  { cos: 'galaxy_mask',    text: 'Hold Out for a whole half',         ok: () => qpHas('ch_pkp') },
  { cos: 'star_mask',      text: 'Hold Out for two straight halves',   ok: () => qpHas('ch_pk2p') },
  { cos: 'jersey_flames',  text: 'Win the hidden Overload Game',            ok: () => qpHas('ch_ppgame') },
  { cos: 'laststand_mask', text: 'Win The Last Stand',                        ok: () => qpHas('ch_pkgame') },
  { cos: 'jersey_laststand', text: 'Win The Last Stand',                      ok: () => qpHas('ch_pkgame') },
  { cos: 'chrome_gear',    text: 'Gold in all three skill drills',            ok: () => ['poke', 'hit', 'deke'].every(k => qpMedal(k) >= 3) },
  { cos: 'golden_horn',    text: 'Win a best-of-7 shootout series',           ok: () => qpHas('so7') },
  { cos: 'emblem_phoenix', text: 'Win an 8- or 16-team Quick Play tournament', ok: () => qpHas('tour8') || qpHas('tour16') },
  { cos: 'jersey_galaxy',  text: 'Win a 16-team tournament of best-of-7 series', ok: () => qpHas('tour16b7') },
  { cos: 'emblem_laurel',  text: 'Win 25 Quick Play games',                   ok: () => (qpProg().n.wins || 0) >= 25 },
];
function qpCheckUnlocks() {
  for (const u of QP_UNLOCKS) if (COSMETICS[u.cos] && !hasCosmetic(u.cos) && u.ok()) {
    if (grantCosmetic(null, u.cos, 'Quick Play: ' + u.text)) toast('UNLOCKED · ' + COSMETICS[u.cos].name.toUpperCase() + ' (' + u.text + ')');
  }
}

// ---------- the catalogue
const QP_CHALLENGES = {
  pp3:    { group: 'pp', name: 'Overload: 3 goals',  desc: 'One half with an extra attacker on the pitch (4 on 3). Score 3 goals.', goals: 3 },
  pp5:    { group: 'pp', name: 'Overload: 5 goals',  desc: 'One half, 4 on 3. Score 5 goals.', goals: 5, needs: 'ch_pp3' },
  pp10:   { group: 'pp', name: 'Overload: 10 goals', desc: 'One half, 4 on 3. Score 10 goals.', goals: 10, needs: 'ch_pp5' },
  pk1:    { group: 'pk', name: 'Hold Out: 30 seconds', desc: 'Defend 3 against 4 for thirty seconds. Don\'t concede.', pens: 1 },
  pk2:    { group: 'pk', name: 'Hold Out: a minute', desc: 'Defend 3 against 4 for a full minute. Don\'t concede.', pens: 2, needs: 'ch_pk1' },
  pkp:    { group: 'pk', name: 'Hold Out: a full half', desc: 'Defend 3 against 4 for a whole half. Don\'t concede.', periods: 1, needs: 'ch_pk2' },
  pk2p:   { group: 'pk', name: 'Hold Out: two halves', desc: 'Defend 3 against 4 for two straight halves. Don\'t concede.', periods: 2, needs: 'ch_pkp' },
  pkgame: { group: 'pk', name: 'The Last Stand', desc: 'A full game, 3 against 4 from the first whistle to the last. Win it. Something special waits for whoever does.', game: 'pk', needs: 'ch_pk2p' },
  ppgame: { group: 'hidden', name: 'The Overload Game', desc: 'A full game, and you have an extra attacker the whole way. Anything but a win is a loss.', game: 'pp', needs: 'ch_pp10', secret: true },
};
// medals: [bronze, silver, gold] successes out of the reps
const QP_DRILLS = {
  gallery:   { group: 'shoot', name: 'Shooting Gallery', desc: 'Ten shots on a keeper from five spots around the box. Six seconds to let each one go.', reps: 10, medals: [4, 6, 8], unit: 'GOALS' },
  breakaway: { group: 'shoot', name: 'Breakaway Challenge', desc: 'Six breakaways from centre pitch with a defender chasing you down.', reps: 6, medals: [2, 4, 5], unit: 'GOALS' },
  onetimer:  { group: 'shoot', name: 'First-time shot Challenge', desc: 'A teammate feeds you from out wide. Press SHOOT once, just as the pass gets to you. Ten passes.', reps: 10, medals: [3, 5, 7], unit: 'GOALS' },
  poke:      { group: 'skill', name: 'Poke Tackle Drill', desc: 'Carriers come at you one at a time from the halfway line. Take the ball before they get a shot away.', reps: 10, medals: [4, 6, 8], unit: 'TAKEAWAYS' },
  hit:       { group: 'skill', name: 'Tackling Drill', desc: 'Carriers run up the wing. Win the ball before they reach your halfway line: a slide tackle (get the ball first!) or a shoulder charge.', reps: 10, medals: [4, 6, 8], unit: 'TACKLES' },
  deke:      { group: 'skill', name: 'Feinting Drill', desc: 'A defender stands you up at the halfway line. Beat him with a feint and keep the ball.', reps: 10, medals: [4, 6, 8], unit: 'BEATEN' },
};
const FIGHT_IDS = ['spar', 'fightnight'], isFightDrill = m => !!(m && m.kind === 'drill' && FIGHT_IDS.includes(m.id));
const MEDALS = ['', 'BRONZE', 'SILVER', 'GOLD'], MEDAL_COL = ['#7a83a8', '#cd7f32', '#d8dce6', '#ffd23f'];
function qpMedal(id) { const d = QP_DRILLS[id], b = qpProg().best['dr_' + id]; if (!d || b == null || !d.medals) return 0; return d.medals.filter(m => b >= m).length; }
const chUnlocked = id => { const c = QP_CHALLENGES[id]; return !c.needs || qpHas(c.needs); };

// ---------- shared launcher: two even teams for challenges and drills (everyone rated the same, so medals are fair)
function qpEvenTeams(level = 7) {
  UI.qpSeed = UI.qpSeed || newQpSeed();
  const teams = generateQuickTeams(UI.qpSeed), sel = UI.qpSel || [0, 5];
  const a = teams[sel[0]] || teams[0], b = teams[sel[1]] || teams[1];
  for (const q of [a, b]) for (const id of rosterIds(q.t)) { const p = q.fake.players[id]; for (const k in p.attrs) p.attrs[k] = level; }
  return [a, b];
}
function qpLaunchMode(mode, opts = {}) {
  const [a, b] = opts.teams || qpEvenTeams(opts.level || 7);
  const keep = { diff: S.diff, speed: S.speed, rules: S.rules }, restore = () => { S.diff = keep.diff; S.speed = keep.speed; S.rules = keep.rules; };
  S.diff = UI.qpDiff || 'NORMAL'; S.speed = UI.qpDiff === 'HARD' || !SPEEDS[UI.qpSpeed] ? 'NORMAL' : UI.qpSpeed;
  S.rules = mode.rules != null ? mode.rules : true;
  S.autoAI = false;                                          // challenges and drills are always yours to play
  launchMatch({ teams: [a.ident, b.ident], home: 0, lineups: [qpLineup(a), qpLineup(b)], tac: [a.tac, b.tac], decider: mode.decider || 'shootout', kind: 'quick', canRestart: true, noWalk: true, noOutro: !mode.game, mode,
    firstGoal: !!mode.firstGoal, soOnly: !!mode.soOnly,
    onEnd: res => { restore(); leaveMatch(); (opts.onEnd || (() => go(scrQuickPlay)))(res); },
    onQuit: () => { restore(); (opts.onQuit || (() => go(opts.back || scrChallenges)))(); } });
}

// ---------- engine hooks (called from engine.js)
// at the end of startMatch
function modeStart(cfg) {
  S.mode = null;
  if (cfg.soOnly) { S.mode = { kind: 'so', hud: 'SHOOTOUT' }; startShootout(); return; }
  const m = cfg.mode; if (!m) return;
  S.mode = Object.assign(m, { rep: 0, ok: 0, t: 0, log: [], pause: 0, won: undefined });
  if (m.kind === 'pp' || m.kind === 'pk') {
    const t = m.kind === 'pp' ? 1 : 0;                       // the team that sits a man short all the way
    permPenalty(t);
    if (m.pens) S.clock = Math.min(S.periodLen, BAL.pen.len * m.pens);
    setupFaceoff(CX, CY);
    return;
  }
  if (m.kind === 'drill' || m.kind === 'practice') { MS.rs && (MS.rs.pens = [[], []]); drillSetup(); }
}
function permPenalty(t) {
  const r = RS(); if (!r) return;
  const p = teamSkaters(t).find(x => x.pl && x.role !== 1) || teamSkaters(t).find(x => x.pl); if (!p) return;
  r.pens[t].push({ pid: p.pl.id, num: p.pl.num, name: plName(p.pl), kind: 'challenge', left: 1e9, perm: true });
  r.box[p.pl.id] = true; penStarted(t);
  if (typeof refillIce === 'function') refillIce(t);
  applyManpower(false);
}
// a goal's celebration has run out: true = handled here
function modeAfterGoal() {
  if (S.match && S.match.firstGoal) { endMatch(); return true; }
  const m = S.mode; if (!m) return false;
  if (m.kind === 'pp' && !m.game && S.score[0] >= m.goals) { m.won = true; endMatch(); return true; }
  if (m.kind === 'pk' && !m.game && S.score[1] > 0) { m.won = false; endMatch(); return true; }
  return false;
}
// a period's clock ran out: true = handled here
function modeEndPeriod() {
  const m = S.mode;
  if (S.match && S.match.firstGoal) {                 // nobody scored: fresh legs for everyone, and on we go
    if (MS) { MS.stam = {}; for (const t of [0, 1]) MS.lines[t].t = 0; }
    goalieRest(PLAY.gRestoreInter);
    showMsg('freshlegs'); return true;
  }
  if (!m) return false;
  if (m.kind === 'pk' && !m.game && m.periods && S.period < m.periods) return false;      // on to the next period, still a man short
  if ((m.kind === 'pp' || m.kind === 'pk') && !m.game) { m.won = m.kind === 'pk' ? S.score[1] === 0 : S.score[0] >= m.goals; endMatch(); return true; }
  return false;
}

// ---------- drills, shooting challenges and the practice rink: rep by rep, nobody else on the ice
function drillUse(t, n) {           // keep the first n skaters of team t on the ice, take the rest off
  const sk = POOL.filter(p => !p.g && p.team === t && p.role <= 2).sort((a, b) => a.role - b.role);
  sk.forEach((p, i) => { p.on = i < n; resetPlayerState(p); });
  for (const p of POOL) if (!p.g && p.team === t && p.role > 2) p.on = false;
}
function drillSetup() {
  const m = S.mode; if (!m) return;
  m.t = 0; m.shot = false; m.shot1 = false; m.res = null; m.dead = 0; m.held = 0; m.shotAt = 0; m.hits0 = MS ? MS.team[0].hit : 0;
  setEnds(0);                                                // you attack up the ice
  S.score = [0, 0];
  const id = m.id, P = m.kind === 'practice' ? m.opts : null;
  const n0 = P ? 1 + P.mates : id === 'onetimer' ? 2 : 1, n1 = P ? P.opp : (id === 'gallery' || id === 'onetimer' ? 0 : 1);
  drillUse(0, n0); drillUse(1, n1);
  const gs = [goalieObj(0), goalieObj(1)], fd = isFightDrill(m);
  gs[0].on = P ? P.myG : !fd && (id === 'poke' || id === 'hit');
  gs[1].on = P ? P.oppG : !fd && !(id === 'poke' || id === 'hit');
  rebuildActive();
  for (const p of players) { p.celebT = 0; p.celebType = null; }      // a goal celebration never carries over into the next rep
  for (const g of goalies) if (g) { resetPlayerState(g); goalieHome(g); g.mx = g.x; g.my = g.y; }
  const me = teamSkaters(0)[0], them = teamSkaters(1);
  ctrl = me; resetPuck(CX, CY);
  const zone = BLUE_TOP;                                     // their blue line (we attack up)
  let carrier = me;
  if (m.kind === 'practice') {
    me.x = CX; me.y = CY + 20;
    teamSkaters(0).slice(1).forEach((p, i) => { p.x = CX + (i ? 70 : -70); p.y = CY + 30; });
    them.forEach((p, i) => { p.x = CX + (i - (them.length - 1) / 2) * 60; p.y = zone - 30; });
  } else if (id === 'gallery') {
    const spots = [[-0.62, 0.42], [0.62, 0.42], [0, 0.55], [-0.45, 0.95], [0.45, 0.95]], s = spots[m.rep % 5];
    me.x = CX + s[0] * 120 * RK(1); me.y = GL_TOP + s[1] * (zone - GL_TOP);
  } else if (id === 'breakaway') {
    me.x = CX + rand(-40, 40); me.y = CY + 10; const d = them[0]; d.x = me.x + rand(-26, 26); d.y = CY + 62;
  } else if (id === 'onetimer') {
    const side = m.rep % 2 ? 1 : -1, f = teamSkaters(0)[1];
    me.x = CX - side * 40 * RK(1); me.y = GL_TOP + 0.45 * (zone - GL_TOP);
    f.x = CX + side * 95 * RK(1); f.y = GL_TOP + 0.35 * (zone - GL_TOP); carrier = f; m.feeder = f; m.passed = false;
  } else if (id === 'poke') {
    const c = them[0]; c.x = CX + rand(-50, 50); c.y = BLUE_BOT - 40; me.x = CX + rand(-15, 15); me.y = BLUE_BOT + 55; carrier = c;
  } else if (id === 'hit') {
    const side = Math.random() < 0.5 ? -1 : 1, c = them[0];
    c.x = side < 0 ? R.l + 30 : R.r - 30; c.y = CY - 70; me.x = CX + side * 30; me.y = CY + 50; carrier = c;
  } else if (id === 'deke') {
    me.x = CX + rand(-20, 20); me.y = CY + 30; const d = them[0]; d.x = CX; d.y = zone + 8;
  }
  for (const p of skaters) { p.mx = p.x; p.my = p.y; p.vx = p.vy = 0; p.fx = 0; p.fy = p.team === 0 ? -1 : 1; }
  if (fd) return fightDrillBout(m, me, them[0]);
  puck.owner = carrier; puck.lastTouch = carrier; puck.x = carrier.x; puck.y = carrier.y;
  S.phase = 'live'; S.screen = 'play'; S.cpuDelay = m.kind === 'practice' ? 20 : 26; S.foWinner = 0;
}
// each live frame (true = skip the rest of this frame)
function modeTick() {
  const m = S.mode; if (!m || S.screen !== 'play') return false;
  if (m.kind !== 'drill' && m.kind !== 'practice') return false;
  S.clock = Math.max(S.clock, S.periodLen - 1);                 // no clock
  if (MS) { for (const t of [0, 1]) MS.lines[t].t = 0; MS.stam = {}; }
  if (m.kind === 'practice') {
    if (m.opts.passive) for (const p of teamSkaters(1)) if (puck.owner !== p) { p.vx = p.vy = 0; p.inx = p.iny = 0; p.stun = Math.max(p.stun, 2); }
    if (S.phase === 'goal') { m.goals = (m.goals || 0) + (S.lastGoalTeam === 0 ? 1 : 0); drillSetup(); return true; }
    if (S.phase === 'faceoff' || (S.phase === 'whistle' && S.timer < 20)) { drillSetup(); return true; }
    if (puck.owner && puck.owner.g) { if (++m.t > 50) drillSetup(); }
    else m.t = 0;
    return false;
  }
  if (m.pause > 0) { m.pause--; if (m.pause === 0) { if (m.rep >= m.reps) { drillFinish(); return true; } drillSetup(); } return true; }
  if (isFightDrill(m)) return false;                         // the bout runs itself (fightTick); its end comes through fightDrillDone
  if (S.phase === 'goal') { drillRep(m.id === 'poke' || m.id === 'hit' ? false : S.lastGoalTeam === 0, S.lastGoalTeam === 0 ? 'GOAL!' : 'SCORED ON'); return true; }
  if (S.phase !== 'live') { if (S.phase === 'whistle' || S.phase === 'faceoff') drillRep(false, 'WHISTLE'); return false; }
  m.t++;
  const me = ctrl, id = m.id, them = teamSkaters(1);
  if (puck.shot && puck.shotTeam === 0) m.shot = true;
  if (id === 'gallery' || id === 'breakaway' || id === 'onetimer') {
    if (id === 'onetimer' && !m.passed && m.t > 40 && m.feeder && puck.owner === m.feeder) {
      const tgt = teamSkaters(0).find(p => p !== m.feeder); if (tgt) { m.passed = true; passTo(m.feeder, tgt); }
    }
    if (id === 'onetimer' && puck.owner && puck.owner.team === 0 && puck.owner !== m.feeder && m.t > 50 && !m.shot && ++m.held > 24) return drillRep(false, 'FIRST-TIME SHOT ONLY'), true;
    if (puck.owner && puck.owner.g) return drillRep(false, 'SAVED'), true;
    if (puck.owner && puck.owner.team === 1) return drillRep(false, 'LOST IT'), true;
    if (m.shot && !puck.shot && !puck.owner && hyp(puck.vx, puck.vy) < 0.6 && ++m.dead > 20) return drillRep(false, 'NO GOAL'), true;
    if (m.shot && m.t > (m.shotAt = m.shotAt || m.t) + 160) return drillRep(false, 'NO GOAL'), true;
    if (!m.shot && m.t > (id === 'gallery' ? 360 : 480)) return drillRep(false, 'TOO SLOW'), true;
  } else if (id === 'poke') {
    if (puck.shot && puck.shotTeam === 1 || m.shot1) { m.shot1 = true; if (!puck.shot) return drillRep(false, 'SHOT GOT AWAY'), true; return false; }
    if (puck.owner === me || (!puck.owner && puck.lastTouch === me)) return drillRep(true, 'TAKEAWAY!'), true;
    if (m.t > 420) return drillRep(false, 'TIME'), true;
  } else if (id === 'hit') {
    if (MS.team[0].hit > m.hits0) return drillRep(true, 'TACKLE!'), true;
    const c = them[0]; if (c && c.y > BLUE_BOT + 50) return drillRep(false, 'GOT PAST YOU'), true;
    if (m.t > 420) return drillRep(false, 'TIME'), true;
  } else if (id === 'deke') {
    const d = them[0];
    if (puck.owner === me && d && d.y - me.y > 24 && Math.abs(d.x - me.x) < 120) return drillRep(true, 'BEAT HIM!'), true;
    if (puck.owner && puck.owner.team === 1 || (!puck.owner && puck.lastTouch && puck.lastTouch.team === 1)) return drillRep(false, 'POKED AWAY'), true;
    if (m.t > 360) return drillRep(false, 'TIME'), true;
  }
  return false;
}
// ---------- fight drills: each rep is one bout at centre ice
const FIGHT_NIGHT_LVL = [5, 6, 7, 8, 9];          // the opponent's fighting attributes, bout by bout (you are a 7)
function fightDrillBout(m, me, op) {
  const lu = S.match.lineups[1], pool = lu.lines.flat().filter(Boolean);
  if (m.id === 'fightnight' && pool.length) swapSkater(op, pool[m.rep % pool.length], lu);     // a different man every bout
  const lvl = m.id === 'spar' ? 6 : FIGHT_NIGHT_LVL[Math.min(m.rep, 4)];
  if (op.pl) for (const k of ['chk', 'pow', 'def', 'spd', 'stk', 'sta']) op.pl.attrs[k] = lvl;
  me.x = CX - 14; me.y = CY + 75; op.x = CX + 14; op.y = CY + 75;          // between the red line and the blue line, clear of the logo
  for (const p of [me, op]) { p.mx = p.x; p.my = p.y; p.down = 0; p.stun = 0; }
  puck.owner = null; puck.x = CX; puck.y = CY + 80;
  ctrl = me; S.autoAI = false;
  startFight(me, op);
  S.banner = { text: m.id === 'spar' ? 'SPARRING' : 'BOUT ' + (m.rep + 1) + ' OF ' + m.reps, sub: plTagPl(op.pl) + (m.id === 'fightnight' ? ' · ' + ['ROOKIE', 'SCRAPPER', 'TOUGH GUY', 'ENFORCER', 'HEAVYWEIGHT'][Math.min(m.rep, 4)] : ''), life: 80 };
}
// a bout in a fight drill is over (instead of ejections and a faceoff): the next one
function fightDrillDone(Fi) {
  const m = S.mode, won = Fi.winner.o.team === 0;
  S.fight = null; S.fightGear = null;
  for (const F of Fi.f) { F.o.fight = false; F.o.fightPose = null; F.o.dkOff = 0; F.o.lunge = 0; }
  S.phase = 'live';
  if (m.id === 'spar') { m.lost = (m.lost || 0) + (won ? 0 : 1); }
  drillRep(won, won ? (Fi.decision ? 'WIN ON POINTS' : 'YOU WIN!') : (Fi.decision ? 'LOST ON POINTS' : 'KNOCKED DOWN'));
}
function drillRep(ok, label) {
  const m = S.mode; if (!m || m.pause > 0) return;
  m.rep++; if (ok) m.ok++; m.log.push(ok ? 1 : 0); m.dead = 0; m.held = 0; m.shotAt = 0;
  floaters.push({ x: ctrl ? ctrl.x : CX, y: (ctrl ? ctrl.y : CY) - 36, text: label, life: 50, big: ok, color: ok ? '#5ee07a' : '#ff8a7a' });
  ok ? sfx.pick && sfx.pick() : null;
  S.phase = 'live'; puck.shot = null; m.pause = 55;
  for (const p of skaters) { p.inx = p.iny = 0; }
}
function drillFinish() { const m = S.mode; m.done = true; endMatch(); }
function passTo(from, to) {
  if (typeof pass !== 'function') return;
  const fx = to.x - from.x, fy = to.y - from.y, d = hyp(fx, fy) || 1; from.fx = fx / d; from.fy = fy / d; from.passCd = 0;
  pass(from, 0.45, { x: from.fx, y: from.fy });
}

// ---------- HUD
function modeHudPeriod() {
  const m = S.mode; if (!m) return S.match && S.match.firstGoal && S.period > 3 ? 'P' + S.period : null;
  if (m.kind === 'drill' && m.id === 'spar') return 'SPARRING';
  if (m.kind === 'drill') return (isFightDrill(m) ? 'BOUT ' : 'REP ') + Math.min(m.reps, m.rep + 1) + '/' + m.reps;
  if (m.kind === 'practice') return 'PRACTICE';
  if (m.kind === 'pp' && !m.game) return 'PP CHALLENGE';
  if (m.kind === 'pk' && !m.game) return 'PK CHALLENGE';
  return null;
}
function drawModeHud() {
  const m = S.mode; if (!m || S.so) return;
  const SW = viewW(); let msg = null;
  if (m.kind === 'drill' && m.id === 'spar') msg = 'SPARRING · WON ' + m.ok + ' · LOST ' + (m.lost || 0) + ' · ESC: MENU';
  else if (m.kind === 'drill') { const d = QP_DRILLS[m.id]; msg = d.name.toUpperCase() + ' · ' + m.ok + ' ' + d.unit + ' · GOLD ' + d.medals[2]; }
  else if (m.kind === 'practice') msg = 'PRACTICE · GOALS ' + (m.goals || 0) + ' · ESC: MENU';
  else if (m.kind === 'pp' && !m.game) msg = 'SCORE ' + m.goals + ' · ' + S.score[0] + ' SO FAR';
  else if (m.kind === 'pk' && !m.game) msg = S.score[1] ? 'SCORED ON' : 'HOLD THEM OFF';
  if (!msg) return;
  const w = msg.length * 5 + 16, x = SW / 2 - w / 2, y = HUDH + (m.kind === 'pp' || m.kind === 'pk' ? 32 : isFightDrill(m) ? 40 : 4);
  ctx.fillStyle = 'rgba(11,14,30,.86)'; ctx.fillRect(x, y, w, 11);
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(x, y, w, 1.5);
  text(msg, SW / 2, y + 3, '#ffffff', 5, 'center', null);
}

// ---------- results of a challenge or drill
function modeResult(mode, res) {
  if (mode.kind === 'drill') {
    const d = QP_DRILLS[mode.id], ok = res.drillOk || 0, before = qpMedal(mode.id);
    qpBest('dr_' + mode.id, ok);
    const med = d.medals.filter(x => ok >= x).length;
    qpCheckUnlocks();
    return { title: d.name, big: ok + ' / ' + d.reps + ' ' + d.unit, medal: med, newMedal: med > before, line: med ? MEDALS[med] + ' MEDAL' : 'NO MEDAL · BRONZE NEEDS ' + d.medals[0] };
  }
  const c = QP_CHALLENGES[mode.id], won = mode.game ? res.winner === 0 : !!res.modeWon;
  if (won) { qpFeat('ch_' + mode.id); }
  if (won && mode.id === 'pkgame') toast('THE LAST STAND! You unlocked the Last Stand mask and jersey.');
  const unlockedHidden = won && Object.entries(QP_CHALLENGES).filter(([k, x]) => x.secret && x.needs === 'ch_' + mode.id).map(([k, x]) => x.name);
  return { title: c.name, big: won ? 'CHALLENGE COMPLETE' : 'CHALLENGE FAILED', won, line: mode.kind === 'pp' ? 'You scored ' + res.score[0] + (mode.game ? ', they scored ' + res.score[1] : ' of ' + mode.goals) : (mode.game ? 'Final ' + res.score[0] + ' - ' + res.score[1] : res.score[1] ? 'They scored.' : 'Not a single goal against.'),
    extra: unlockedHidden && unlockedHidden.length ? 'SECRET UNLOCKED: ' + unlockedHidden.join(', ').toUpperCase() : null };
}
function scrModeResult(r, again, back) {
  return h('div', { class: 'screen' }, header(r.title.toUpperCase(), back, 'BACK'),
    h('div', { class: 'panel', style: { textAlign: 'center', padding: '22px' } },
      r.medal != null ? h('div', { style: { fontSize: '40px', color: MEDAL_COL[r.medal] } }, r.medal ? '●' : '○') : null,
      h('div', { class: r.won === false ? '' : 'gold', style: { fontSize: 'calc(16px * var(--ts, 1.2))', margin: '8px 0', color: r.won === false ? '#ff8a7a' : null } }, r.big),
      h('div', { class: 'sub' }, r.line),
      r.newMedal ? h('div', { class: 'gold', style: { marginTop: '8px' } }, 'NEW BEST!') : null,
      r.extra ? h('div', { class: 'gold', style: { marginTop: '10px' } }, r.extra) : null,
      h('div', { class: 'row', style: { justifyContent: 'center', gap: '8px', marginTop: '16px' } },
        h('button', { class: 'primary', onclick: again }, 'TRY AGAIN'), h('button', { onclick: back }, 'DONE'))),
    typeof hkProgressPanel === 'function' ? hkProgressPanel(null, { mode: 'modes' }) : null);
}
function startChallenge(id) {
  const c = QP_CHALLENGES[id];
  const mode = { kind: c.game || c.group, id, goals: c.goals, pens: c.pens, periods: c.periods, game: !!c.game, rules: true };
  if (c.game) mode.kind = c.game;
  qpLaunchMode(mode, { onEnd: res => { res.modeWon = mode.won; const r = modeResult(mode, res); go(() => scrModeResult(r, () => startChallenge(id), () => go(scrChallenges))); } });
}
function startDrill(id) {
  const d = QP_DRILLS[id], mode = { kind: 'drill', id, reps: d.reps, rules: false };
  qpLaunchMode(mode, { onEnd: res => { res.drillOk = mode.ok; const r = modeResult(mode, res); go(() => scrModeResult(r, () => startDrill(id), () => go(scrChallenges))); } });
}

// ---------- CHALLENGES & DRILLS screen
function scrChallenges() {
  UI.qpDiff = UI.qpDiff || 'NORMAL';
  // what each challenge or drill wins you (from the unlock list), so you know before you play
  const KEY_OF = { gallery: () => qpMedal('gallery') >= 3, breakaway: () => qpMedal('breakaway') >= 3, pp10: () => qpHas('ch_pp10'), pkp: () => qpHas('ch_pkp'), pk2p: () => qpHas('ch_pk2p'), ppgame: () => qpHas('ch_ppgame'), pkgame: () => qpHas('ch_pkgame') };
  const rewardFor = id => QP_UNLOCKS.filter(u => COSMETICS[u.cos] && (u.ok === KEY_OF[id] || String(u.ok).includes(`'${id}'`) || String(u.ok).includes(`'ch_${id}'`)));
  const card = (name, desc, status, col, btn, id) => { const rw = id ? rewardFor(id) : [];
    return h('div', { class: 'chcard' },
    h('div', { class: 'chname' }, name), h('div', { class: 'chdesc' }, desc),
    rw.length ? h('div', { class: 'chrew', 'data-help': rw.map(u => u.text).join(' · ') }, '🎁 ' + rw.map(u => COSMETICS[u.cos].name + (hasCosmetic(u.cos) ? ' ✓' : '')).join(', ')) : null,
    h('div', { class: 'chfoot' }, h('span', { style: { color: col || '#9aa3c7' } }, status), btn)); };
  const chCard = id => {
    const c = QP_CHALLENGES[id], open = chUnlocked(id), done = qpHas('ch_' + id);
    if (c.secret && !open) return card('? ? ?', 'A hidden challenge. Finish the ' + (c.game === 'pp' ? 'Overload' : 'Hold Out') + ' ladder to reveal it.', 'LOCKED', '#7a83a8', null);
    return card(c.name, c.desc, done ? '✓ COMPLETE' : open ? 'OPEN' : 'LOCKED · finish the one before', done ? '#5ee07a' : open ? '#ffd23f' : '#7a83a8',
      open ? h('button', { class: 'small primary', onclick: () => startChallenge(id) }, 'PLAY') : null, id);
  };
  const drCard = id => {
    const d = QP_DRILLS[id], med = qpMedal(id), best = qpProg().best['dr_' + id];
    if (d.practice) return card(d.name, d.desc, 'PRACTICE · NO MEDALS', '#9ad0ff', h('button', { class: 'small primary', onclick: () => startDrill(id) }, 'PLAY'));
    return card(d.name, d.desc, (best != null ? 'BEST ' + best + '/' + d.reps + ' · ' : '') + (med ? MEDALS[med] : 'NO MEDAL') + ' · gold ' + d.medals[2], MEDAL_COL[med], h('button', { class: 'small primary', onclick: () => startDrill(id) }, 'PLAY'), id);
  };
  UI.chTab = UI.chTab || 'pp';
  const groups = [['pp', 'OVERLOAD'], ['pk', 'HOLD OUT'], typeof GAME_SCEN !== 'undefined' ? ['scen', 'SCENARIOS'] : null, ['shoot', 'SHOOTING'], ['skill', 'SKILL DRILLS']].filter(Boolean);   // SOCCER: no scuffling drills
  const unl = QP_UNLOCKS.filter(u => COSMETICS[u.cos]);
  const got = unl.filter(u => hasCosmetic(u.cos)).length;
  return h('div', { class: 'screen chS' }, header('CHALLENGES & DRILLS', () => go(scrQuickPlay), 'BACK'),
    h('div', { class: 'row', style: { gap: '10px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' } },
      h('label', { class: 'qp2dd' }, h('span', null, 'DIFFICULTY'), h('select', { onchange: e => { UI.qpDiff = e.target.value; } }, ['EASY', 'NORMAL', 'HARD'].map(v => h('option', { value: v, selected: v === UI.qpDiff }, v)))),
      h('div', { class: 'modetxt', style: { flex: 1 } }, 'Everyone on the pitch is rated the same here, so a medal means the same for every team.'),
      h('button', { class: 'small ghost', onclick: () => modal(close => h('div', null, h('h3', null, 'QUICK PLAY UNLOCKS · ' + got + '/' + unl.length),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', columnGap: '10px' } },   // four compact columns: 18 unlocks in one column scrolled (Nov 23)
          unl.map(u => h('div', { class: 'hotrow', style: { padding: '2px 0', alignItems: 'flex-start' } }, h('span', { style: { color: hasCosmetic(u.cos) ? '#5ee07a' : '#9aa3c7', width: '10px' } }, hasCosmetic(u.cos) ? '✓' : '·'), h('div', { style: { flex: 1, lineHeight: 1.25 } }, h('b', { style: { fontSize: 'calc(6.5px * var(--ts, 1.2))' } }, COSMETICS[u.cos].name), h('div', { class: 'modetxt', style: { fontSize: 'calc(5.5px * var(--ts, 1.2))', lineHeight: 1.3 } }, u.text))))),
        h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '8px' } }, h('button', { class: 'primary', onclick: close }, 'OK'))), true) }, 'UNLOCKS ' + got + '/' + unl.length)),
    h('div', { class: 'chtabs' }, groups.map(([k, label]) => h('button', { class: 'small' + (UI.chTab === k ? ' sel' : ''), onclick: () => { UI.chTab = k; go(scrChallenges); } }, label))),
    h('div', { class: 'chgrid' }, ({ pp: ['pp3', 'pp5', 'pp10', 'ppgame'].map(chCard), pk: ['pk1', 'pk2', 'pkp', 'pk2p', 'pkgame'].map(chCard), shoot: ['gallery', 'breakaway', 'onetimer'].map(drCard), skill: ['poke', 'hit', 'deke'].map(drCard), scen: typeof SCEN_ORDER !== 'undefined' ? SCEN_ORDER.map(scenCard) : [] })[UI.chTab]));
}

// ---------- PRACTICE RINK
function scrPractice() {
  const P = UI.practice = UI.practice || { opp: 1, mates: 0, oppG: true, myG: false, passive: false, rules: false };
  const box = h('div');
  const opt = (label, val, list, set) => h('div', { class: 'hotrow' }, h('b', { style: { flex: 1 } }, label),
    list.map(([v, t]) => h('button', { class: 'small' + (val === v ? ' sel' : ''), onclick: () => { set(v); render(); } }, t)));
  const render = () => {
    box.innerHTML = '';
    box.append(h('div', { class: 'panel' },
      opt('OPPONENTS', P.opp, [[0, 'NONE'], [1, '1'], [2, '2'], [3, '3']], v => P.opp = v),
      opt('THEY', P.passive, [[false, 'PLAY FOR REAL'], [true, 'STAND STILL']], v => P.passive = v),
      opt('TEAMMATES', P.mates, [[0, 'NONE'], [1, '1'], [2, '2']], v => P.mates = v),
      opt('THEIR KEEPER', P.oppG, [[true, 'IN NET'], [false, 'EMPTY NET']], v => P.oppG = v),
      opt('YOUR KEEPER', P.myG, [[true, 'IN NET'], [false, 'EMPTY NET']], v => P.myG = v),
      opt('RULES (FOULS & CARDS)', P.rules, [[false, 'OFF'], [true, 'ON']], v => P.rules = v),
      opt('DIFFICULTY', UI.qpDiff || 'NORMAL', [['EASY', 'EASY'], ['NORMAL', 'NORMAL'], ['HARD', 'HARD']], v => UI.qpDiff = v),
      h('div', { class: 'modetxt', style: { margin: '8px 0' } }, 'No clock, no score that counts. After every goal, save or whistle the ball comes back to you at centre pitch. Press ESC for the menu.'),
      h('div', { class: 'row', style: { justifyContent: 'center' } }, h('button', { class: 'primary', onclick: () => startPractice() }, 'HIT THE PITCH ▶'))));
  };
  render();
  return h('div', { class: 'screen' }, header('PRACTICE PITCH', () => go(scrQuickPlay), 'BACK'), box);
}
function startPractice() {
  const P = UI.practice, mode = { kind: 'practice', opts: Object.assign({}, P), rules: P.rules };
  UI.qpSeed = UI.qpSeed || newQpSeed();
  const teams = generateQuickTeams(UI.qpSeed), sel = UI.qpSel || [0, 5];
  qpLaunchMode(mode, { teams: [teams[sel[0]], teams[sel[1]]], back: scrPractice, onEnd: () => go(scrPractice) });
}

// ---------- SHOOTOUT SERIES (best of 3, 5 or 7) and FIRST GOAL WINS
function qpSeriesStart(teams) {
  const best = UI.qpSoBest || 3;
  UI.soSeries = { best, need: Math.ceil(best / 2), wins: [0, 0], games: [], sel: UI.qpSel.slice(), seed: UI.qpSeed };
  qpSeriesNext(teams);
}
function qpSeriesNext(teams) {
  const s = UI.soSeries, a = teams[s.sel[0]], b = teams[s.sel[1]];
  const keep = { diff: S.diff, speed: S.speed }, restore = () => { S.diff = keep.diff; S.speed = keep.speed; };
  S.diff = UI.qpDiff || 'NORMAL'; S.speed = UI.qpDiff === 'HARD' || !SPEEDS[UI.qpSpeed] ? 'NORMAL' : UI.qpSpeed;
  launchMatch({ teams: [a.ident, b.ident], home: s.games.length % 2 ? 1 : 0, lineups: [qpLineup(a), qpLineup(b)], tac: [a.tac, b.tac], decider: 'shootout', kind: 'quick', soOnly: true, noWalk: true, noOutro: true,
    onEnd: res => {
      restore(); leaveMatch();
      s.wins[res.winner]++; s.games.push(res.soLine || '');
      if (s.wins[res.winner] >= s.need) { if (res.winner === 0) { qpCount('wins'); if (s.best === 7) qpFeat('so7'); } }
      go(() => scrSeries(teams));
    },
    onQuit: () => { restore(); go(scrQuickPlay); } });
}
function scrSeries(teams) {
  const s = UI.soSeries, a = teams[s.sel[0]], b = teams[s.sel[1]], over = Math.max(...s.wins) >= s.need, won = s.wins[0] >= s.need;
  return h('div', { class: 'screen' }, header('SHOOTOUT SERIES · BEST OF ' + s.best, () => go(scrQuickPlay), 'BACK'),
    h('div', { class: 'panel', style: { textAlign: 'center', padding: '18px' } },
      h('div', { class: 'row', style: { justifyContent: 'center', alignItems: 'center', gap: '18px' } },
        h('div', null, badge(a.ident, 64), h('div', null, a.ident.abbr)), h('div', { class: 'gold', style: { fontSize: '28px' } }, s.wins[0] + ' - ' + s.wins[1]), h('div', null, badge(b.ident, 64), h('div', null, b.ident.abbr))),
      h('div', { class: 'sub', style: { marginTop: '8px' } }, over ? (won ? 'YOU WIN THE SERIES!' : 'THE COMPUTER WINS THE SERIES') : 'FIRST TO ' + s.need + ' WINS'),
      s.games.map((g, i) => h('div', { class: 'modetxt' }, 'GAME ' + (i + 1) + ':  ' + g)),
      h('div', { class: 'row', style: { justifyContent: 'center', gap: '8px', marginTop: '14px' } },
        over ? h('button', { class: 'primary', onclick: () => qpSeriesStart(teams) }, 'NEW SERIES') : h('button', { class: 'primary', onclick: () => qpSeriesNext(teams) }, 'NEXT SHOOTOUT ▶'),
        h('button', { onclick: () => go(scrQuickPlay) }, over ? 'DONE' : 'QUIT SERIES'))));
}

// ---------- TOURNAMENT: 4, 8 or 16 teams, single elimination, series of 1, 3 or 7 games
function qpTourneyTeams(seed, n) {
  const out = [], cities = new Set(), nicks = new Set();
  for (let k = 0; out.length < n && k < 6; k++) {
    const batch = generateQuickTeams(k ? seed + '~' + k : seed, k ? 'qx' + k + '_' : 'qp');
    for (const q of batch) { if (out.length >= n) break; if (cities.has(q.ident.city) || nicks.has(q.ident.nick)) continue; cities.add(q.ident.city); nicks.add(q.ident.nick); out.push(q); }
  }
  return out;
}
function tourWinP(ra, rb) { return 1 / (1 + Math.exp(-(ra - rb) / 9)); }
function tourSimGame(A, B) {
  const aWins = Math.random() < tourWinP(A.rating, B.rating), w = 1 + Math.floor(Math.random() * 4), l = Math.floor(Math.random() * w);
  return aWins ? [w, l] : [l, w];
}
function newTourney() {
  UI.qpSeed = UI.qpSeed || newQpSeed();
  const n = UI.tourN || 8, best = UI.tourBest || 1;
  const pool = qpTourneyTeams(UI.qpSeed, Math.max(n, 10)), mine = pool[(UI.qpSel || [0])[0]] || pool[0];
  let field = [mine].concat(pool.filter(q => q !== mine).sort(() => Math.random() - 0.5).slice(0, n - 1));
  field.sort((x, y) => y.rating - x.rating);
  const seedOrder = { 4: [0, 3, 1, 2], 8: [0, 7, 3, 4, 1, 6, 2, 5], 16: [0, 15, 7, 8, 3, 12, 4, 11, 1, 14, 6, 9, 2, 13, 5, 10] }[n];
  const T = { n, best, need: Math.ceil(best / 2), seedNum: {}, teams: field, mine: field.indexOf(mine), rounds: [] };
  field.forEach((q, i) => T.seedNum[i] = i + 1);
  const r0 = []; for (let i = 0; i < n; i += 2) r0.push({ a: seedOrder[i], b: seedOrder[i + 1], w: [0, 0], winner: null, games: [] });
  T.rounds.push(r0);
  UI.tour = T;
  go(scrTourney);
}
function tourAdvance() {     // sim every AI-only series of the current round; build the next round when it is done
  const T = UI.tour; let r = T.rounds[T.rounds.length - 1];
  for (const s of r) if (s.winner == null && s.a !== T.mine && s.b !== T.mine) {
    while (Math.max(...s.w) < T.need) { const sc = tourSimGame(T.teams[s.a], T.teams[s.b]); s.w[sc[0] > sc[1] ? 0 : 1]++; s.games.push(sc); }
    s.winner = s.w[0] > s.w[1] ? s.a : s.b;
  }
  if (r.every(s => s.winner != null) && r.length > 1) {
    const nx = []; for (let i = 0; i < r.length; i += 2) { const a = r[i].winner, b = r[i + 1].winner; nx.push({ a: Math.min(a, b), b: Math.max(a, b), w: [0, 0], winner: null, games: [] }); }
    T.rounds.push(nx);
  }
}
function tourMySeries() { const T = UI.tour, r = T.rounds[T.rounds.length - 1]; return r.find(s => s.winner == null && (s.a === T.mine || s.b === T.mine)) || null; }
function tourChampion() { const T = UI.tour, r = T.rounds[T.rounds.length - 1]; return r.length === 1 && r[0].winner != null ? r[0].winner : null; }
function tourPlay() {
  const T = UI.tour, s = tourMySeries(); if (!s) return;
  const meA = s.a === T.mine, opp = meA ? s.b : s.a, me = T.teams[T.mine], them = T.teams[opp];
  const homeIsMe = T.mine < opp ? (s.games.length % 2 === 0 || T.best === 1) : (s.games.length % 2 === 1);
  const keep = { diff: S.diff, speed: S.speed }, restore = () => { S.diff = keep.diff; S.speed = keep.speed; };
  S.diff = UI.qpDiff || 'NORMAL'; S.speed = UI.qpDiff === 'HARD' || !SPEEDS[UI.qpSpeed] ? 'NORMAL' : UI.qpSpeed;
  const roundName = tourRoundName(T.rounds.length - 1);
  launchMatch({ teams: [me.ident, them.ident], home: homeIsMe ? 0 : 1, lineups: [qpLineup(me), qpLineup(them)], tac: [me.tac, them.tac], decider: 'sudden', kind: 'quick',
    tourney: { tier: T.rounds.length >= Math.log2(T.n) ? 2 : 1 },
    onEnd: res => {
      restore(); leaveMatch();
      const mine = res.winner === 0, sc = meA ? [res.score[0], res.score[1]] : [res.score[1], res.score[0]];
      s.games.push(sc); s.w[(mine ? meA : !meA) ? 0 : 1]++;
      if (Math.max(...s.w) >= T.need) s.winner = s.w[0] > s.w[1] ? s.a : s.b;
      if (mine) qpCount('wins');
      tourAdvance();
      if (tourChampion() === T.mine) { qpFeat('tour' + T.n); if (T.n === 16 && T.best === 7) qpFeat('tour16b7'); }
      const o = { title: 'TOURNAMENT · ' + roundName, teams: [me.ident, them.ident], res, mode: 'quick', done: () => go(scrTourney), doneLabel: 'BACK TO THE BRACKET ▶' };
      go(() => scrPostgame(o));
    },
    onQuit: () => { restore(); go(scrTourney); } });
}
function tourRoundName(i) { const T = UI.tour, left = T.n >> i; return left === 2 ? 'FINAL' : left === 4 ? 'SEMIFINAL' : left === 8 ? 'QUARTERFINAL' : 'ROUND OF ' + left; }
function scrTourneySetup() {
  UI.tourN = UI.tourN || 8; UI.tourBest = UI.tourBest || 1;
  UI.qpSeed = UI.qpSeed || newQpSeed();
  const teams = generateQuickTeams(UI.qpSeed), mine = teams[(UI.qpSel || [0])[0]];
  const box = h('div');
  const opt = (label, val, list, set) => h('div', { class: 'hotrow' }, h('b', { style: { flex: 1 } }, label),
    list.map(([v, t]) => h('button', { class: 'small' + (val === v ? ' sel' : ''), onclick: () => { set(v); render(); } }, t)));
  const render = () => {
    box.innerHTML = '';
    box.append(h('div', { class: 'panel' },
      h('div', { class: 'row', style: { alignItems: 'center', gap: '10px', marginBottom: '8px' } }, badge(mine.ident, 48), h('div', null, h('b', null, fullName(mine.ident).toUpperCase()), h('div', { class: 'modetxt' }, 'Rating ' + mine.rating + ' · change your team on the Quick Play screen'))),
      opt('TEAMS', UI.tourN, [[4, '4'], [8, '8'], [16, '16']], v => UI.tourN = v),
      opt('EACH ROUND', UI.tourBest, [[1, 'ONE GAME'], [3, 'BEST OF 3'], [7, 'BEST OF 7']], v => UI.tourBest = v),
      opt('DIFFICULTY', UI.qpDiff || 'NORMAL', [['EASY', 'EASY'], ['NORMAL', 'NORMAL'], ['HARD', 'HARD']], v => UI.qpDiff = v),
      h('div', { class: 'modetxt', style: { margin: '8px 0' } }, 'Single elimination, seeded by rating; the higher seed is at home. Tied games go to sudden-death extra time.'),
      h('div', { class: 'row', style: { justifyContent: 'center', gap: '8px' } },
        UI.tour && !tourOver() ? h('button', { onclick: () => go(scrTourney) }, 'RESUME CURRENT TOURNAMENT') : null,
        h('button', { class: 'primary', onclick: newTourney }, 'START TOURNAMENT ▶'))));
  };
  render();
  return h('div', { class: 'screen' }, header('TOURNAMENT', () => go(scrQuickPlay), 'BACK'), box);
}
function tourOver() { const T = UI.tour; return !T || tourChampion() != null; }
function scrTourney() {
  const T = UI.tour; if (!T) return scrTourneySetup();
  tourAdvance();
  const champ = tourChampion(), my = tourMySeries(), out = !my && champ !== T.mine && !T.rounds.some(r => r.some(s => s.winner == null && (s.a === T.mine || s.b === T.mine)));
  const nm = i => T.teams[i].ident.nick.toUpperCase(), small = T.n === 16;
  const cell = (s) => {
    const row = (i, k) => h('div', { class: 'tbrow' + (s.winner === i ? ' win' : '') + (i === T.mine ? ' me' : '') }, h('span', { class: 'tbseed' }, T.seedNum[i]), badge(T.teams[i].ident, small ? 12 : 16), h('span', { class: 'tbname' }, nm(i)), h('span', { class: 'tbw' }, T.best > 1 ? s.w[k] : s.games.length ? s.games[0][k] : ''));
    return h('div', { class: 'tbcell' }, row(s.a, 0), row(s.b, 1));
  };
  const totalRounds = Math.log2(T.n), cols = [];
  for (let i = 0; i < totalRounds; i++) {
    const r = T.rounds[i];
    cols.push(h('div', { class: 'tbcol' }, h('div', { class: 'sub tbhead' }, tourRoundName(i)), h('div', { class: 'tbbody' }, r ? r.map(cell) : Array.from({ length: T.n >> (i + 1) }, () => h('div', { class: 'tbcell tbempty' }, h('div', { class: 'tbrow' }, '—'), h('div', { class: 'tbrow' }, '—'))))));
  }
  const status = champ != null ? (champ === T.mine ? 'CHAMPIONS! YOU WIN THE TOURNAMENT!' : fullName(T.teams[champ].ident).toUpperCase() + ' WIN THE TOURNAMENT') : out ? 'YOU ARE OUT. SIM THE REST TO SEE WHO WINS.' : my ? tourRoundName(T.rounds.length - 1) + ' · ' + (T.best > 1 ? 'SERIES ' + (my.a === T.mine ? my.w[0] + '-' + my.w[1] : my.w[1] + '-' + my.w[0]) + ' · FIRST TO ' + T.need : 'ONE GAME') : '';
  return h('div', { class: 'screen' }, header('TOURNAMENT · ' + T.n + ' TEAMS' + (T.best > 1 ? ' · BEST OF ' + T.best : ''), () => go(scrQuickPlay), 'BACK'),
    h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' } },
      h('div', { class: champ === T.mine ? 'gold' : 'sub', style: { margin: 0 } }, status),
      h('div', { class: 'row', style: { gap: '6px' } },
        my ? h('button', { class: 'primary', onclick: tourPlay }, 'PLAY ' + (my.a === T.mine ? nm(my.b) : nm(my.a)) + ' ▶') : null,
        out && champ == null ? h('button', { class: 'primary', onclick: () => { tourSimAll(); go(scrTourney); } }, 'SIM TO THE END') : null,
        champ != null ? h('button', { class: 'primary', onclick: () => go(scrTourneySetup) }, 'NEW TOURNAMENT') : null)),
    (() => { const br = h('div', { class: 'tbracket' + (small ? ' small' : '') }, cols); setTimeout(() => fitZoomEl(br), 0); return br; })());   // 16 teams ran ~70px off a 720 screen (Nov 23)
}
function tourSimAll() {
  const T = UI.tour;
  for (let k = 0; k < 8 && tourChampion() == null; k++) {
    const r = T.rounds[T.rounds.length - 1];
    for (const s of r) if (s.winner == null) { while (Math.max(...s.w) < T.need) { const sc = tourSimGame(T.teams[s.a], T.teams[s.b]); s.w[sc[0] > sc[1] ? 0 : 1]++; s.games.push(sc); } s.winner = s.w[0] > s.w[1] ? s.a : s.b; }
    tourAdvance();
  }
}
