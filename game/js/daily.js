'use strict';
// ====================================================================
//  GAME_SCEN & THE DAILY CHALLENGE (Nov 22)
//  GAME_SCEN: real game situations with one job each (tie it with the goalie pulled, protect a lead, win sudden-death
//  overtime, come back from two down, win with the underdog). In CHALLENGES > GAME_SCEN; on HARD they count as
//  "done on Hard" too.
//  DAILY CHALLENGE: one scenario a day, the same for everyone on that date (teams and situation come from the date),
//  always on NORMAL. Your first try of the day is the one that counts; after that you can practise it. A daily win
//  streak and a best streak; 7 daily wins unlock the Sunset Jersey.
// ====================================================================
const GAME_SCEN = {
  pulled:  { name: 'Last Gasp', desc: 'Down a goal with 1:00 left. Throw everything forward and tie it.', score: [2, 3], clock: 60, goal: 'tie', hud: 'TIE IT' },   // SOCCER: no pulled keeper (id kept for saves)
  down1:   { name: 'Late Push', desc: 'Down a goal with 3:00 left in the second half. Win it (extra time counts).', score: [1, 2], clock: 180, goal: 'win', hud: 'WIN IT' },
  down2:   { name: 'Comeback Kids', desc: 'Down two with 6:00 left in the second half. Win it (extra time counts).', score: [1, 3], clock: 360, goal: 'win', hud: 'WIN IT' },
  protect: { name: 'Hold the Fort', desc: 'Up a goal with 2:00 left. They will throw everyone forward. Don\'t let them tie it.', score: [3, 2], clock: 120, goal: 'hold', hud: 'HOLD THE LEAD' },
  ot:      { name: 'Sudden Death', desc: 'Level after 90 minutes. Extra time, next goal wins.', score: [2, 2], ot: true, goal: 'win', hud: 'NEXT GOAL WINS' },
  underdog:{ name: 'Giant Killer', desc: 'The weakest team against the strongest: one two-minute half, extra time if it\'s tied. Win it.', underdog: true, period: true, ot2: true, goal: 'win', hud: 'BEAT THE FAVOURITE' },
};
const SCEN_ORDER = ['pulled', 'down1', 'protect', 'ot', 'down2', 'underdog'];
function scenMode(id) { const sc = GAME_SCEN[id]; return { kind: 'scen', id, game: false, rules: true, decider: sc.ot || sc.ot2 ? 'sudden' : 'shootout', sc }; }
// set the situation once the match has started
{ const _ms = modeStart;
  modeStart = function (cfg) {
    const r = _ms.apply(this, arguments);
    const m = cfg && cfg.mode; if (!m || m.kind !== 'scen') return r;
    const sc = m.sc;
    S.mode = Object.assign(m, { rep: 0, ok: 0, t: 0, won: undefined });
    if (sc.period) { S.period = 3; setEnds(); S.clock = Math.min(S.periodLen, 120); }
    else if (sc.ot) { S.period = 4; setEnds(); S.clock = S.periodLen; S.score = sc.score.slice(); }
    else { S.period = 3; setEnds(); S.clock = sc.clock; S.score = sc.score.slice(); }
    S.sog = S.score.slice();
    setupFaceoff(CX, CY); updateCamera(true);
    if (sc.pull === 0) { m.pullT = 1; }
    return r;
  }; }
{ const _up = update;
  update = function () {
    const r = _up.apply(this, arguments);
    const m = S.mode;
    if (m && m.kind === 'scen' && S.screen === 'play') {
      if (m.pullT && S.phase === 'live') { m.pullT = 0; try { pullGoalie(0, true); } catch (e) {} }
      if (m.sc.goal === 'tie' && S.score[0] >= S.score[1] && m.won === undefined) m.won = true;
      if (m.sc.goal === 'hold' && S.score[0] <= S.score[1] && m.won === undefined) m.won = false;
      if (m.won !== undefined && !m.ended && (S.phase === 'faceoff' || S.phase === 'live' && m.sc.goal !== 'tie')) { m.ended = true; endMatch(); }
    }
    return r;
  }; }
{ const _dm = drawModeHud;
  drawModeHud = function () {
    const r = _dm.apply(this, arguments);
    const m = S.mode; if (!m || m.kind !== 'scen' || S.so) return r;
    const msg = (m.daily ? 'DAILY · ' : '') + m.sc.name.toUpperCase() + ' · ' + m.sc.hud, SW = viewW(), w = msg.length * 5 + 16, x = SW / 2 - w / 2, y = HUDH + 4;
    ctx.fillStyle = 'rgba(11,14,30,.86)'; ctx.fillRect(x, y, w, 11); ctx.fillStyle = '#ffd23f'; ctx.fillRect(x, y, w, 1.5);
    text(msg, SW / 2, y + 3, '#ffffff', 5, 'center', null);
    return r;
  }; }
function scenWon(m, res) {
  if (m.sc.goal === 'tie') return !!m.won;
  if (m.sc.goal === 'hold') return m.won !== false && res.winner === 0;
  return res.winner === 0;
}
function scenTeams(id, seed) {
  if (!GAME_SCEN[id].underdog && !seed) return qpEvenTeams(7);
  const teams = generateQuickTeams(seed || (UI.qpSeed = UI.qpSeed || newQpSeed()));
  if (GAME_SCEN[id].underdog) return [teams[teams.length - 1], teams[0]];
  const rng = mulberry32(hashStr('daily-teams-' + seed));
  return [teams[5 + Math.floor(rng() * 4)], teams[1 + Math.floor(rng() * 3)]];
}
function startGameScen(id, opts = {}) {
  const mode = scenMode(id); if (opts.daily) mode.daily = true;
  const keepDiff = UI.qpDiff; if (opts.daily) UI.qpDiff = 'NORMAL';
  qpLaunchMode(mode, { teams: scenTeams(id, opts.seed), onEnd: res => {
    UI.qpDiff = keepDiff;
    const won = scenWon(mode, res), sc = GAME_SCEN[id];
    let extra = null;
    if (opts.daily) extra = dailyRecord(won);
    else if (won) { qpFeat('sc_' + id); if ((UI.qpDiff || 'NORMAL') === 'HARD') qpFeat('plat_sc_' + id); }
    const r = { title: (opts.daily ? 'DAILY · ' : '') + sc.name, big: won ? 'SCENARIO COMPLETE' : 'NOT THIS TIME', won, line: 'Final ' + res.score[0] + ' - ' + res.score[1] + ' · ' + sc.desc, extra };
    go(() => scrModeResult(r, () => startGameScen(id, opts), () => go(opts.daily ? scrDaily : scrChallenges)));
  }, onQuit: () => { UI.qpDiff = keepDiff; if (opts.daily && !opts.practice) dailyRecord(false, true); go(opts.daily ? scrDaily : scrChallenges); } });
}
function scenCard(id) {
  const sc = GAME_SCEN[id], done = qpHas('sc_' + id), hard = qpHas('plat_sc_' + id);
  return h('div', { class: 'chcard' }, h('div', { class: 'chname' }, sc.name), h('div', { class: 'chdesc' }, sc.desc),
    h('div', { class: 'chfoot' }, h('span', { style: { color: hard ? '#9ff3ff' : done ? '#5ee07a' : '#ffd23f' } }, hard ? '✓ DONE ON HARD' : done ? '✓ COMPLETE' : 'OPEN'),
      h('button', { class: 'small primary', onclick: () => startGameScen(id) }, 'PLAY')));
}
// ---------- the DAILY CHALLENGE
const dayKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function dailyToday() {
  const key = dayKey(), rng = mulberry32(hashStr('daily-' + key));
  const id = SCEN_ORDER[Math.floor(rng() * SCEN_ORDER.length)];
  return { key, id, seed: 'D' + key.replace(/-/g, '') };
}
const dailyData = () => { const q = qpProg(); q.daily = q.daily || { hist: {}, streak: 0, best: 0, wins: 0 }; return q.daily; };
const dailyPlayedToday = () => !!dailyData().hist[dayKey()];
function dailyRecord(won, quit) {
  const D = dailyData(), key = dayKey();
  if (D.hist[key]) return 'PRACTICE RUN: today\'s counted try is already in (' + (D.hist[key] === 'W' ? 'a win' : 'a loss') + ').';
  D.hist[key] = won ? 'W' : 'L';
  const y = new Date(); y.setDate(y.getDate() - 1); const yk = dayKey(y);
  if (won) { D.streak = D.hist[yk] === 'W' ? (D.streak || 0) + 1 : 1; D.wins = (D.wins || 0) + 1; D.best = Math.max(D.best || 0, D.streak); }
  else D.streak = 0;
  const keys = Object.keys(D.hist).sort(); if (keys.length > 60) for (const k of keys.slice(0, keys.length - 60)) delete D.hist[k];
  PROFILE.dirty = true; qpCheckUnlocks();
  return won ? 'DAILY WIN · STREAK ' + D.streak + ' (BEST ' + D.best + ') · ' + D.wins + ' DAILY WIN' + (D.wins === 1 ? '' : 'S') : (quit ? 'Today\'s try is spent.' : 'Today\'s try is spent. Come back tomorrow: the streak starts again.');
}
QP_UNLOCKS.push({ cos: 'jersey_sunset', text: 'Win 7 Daily Challenges', ok: () => (dailyData().wins || 0) >= 7 });
if (typeof HK_PROG !== 'undefined') HK_PROG.jersey_sunset = () => ({ have: Math.min(7, dailyData().wins || 0), need: 7, play: 'daily', unit: 'daily wins' });
{ const _pl = hkPlayLabel; hkPlayLabel = function (play) { return play === 'daily' ? "Today's Daily Challenge" : _pl.apply(this, arguments); }; }
{ const _pg = hkPlayGo; hkPlayGo = function (play) { return play === 'daily' ? go(scrDaily) : _pg.apply(this, arguments); }; }
function scrDaily() {
  const T0 = dailyToday(), sc = GAME_SCEN[T0.id], D = dailyData(), done = D.hist[T0.key];
  const [a, b] = scenTeams(T0.id, T0.seed);
  const last7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return [dayKey(d), D.hist[dayKey(d)]]; });
  return h('div', { class: 'screen dailyS' }, header("TODAY'S CHALLENGE", () => go(scrQuickPlay), 'BACK', h('b', { class: 'gold' }, T0.key)),
    h('div', { class: 'panel', style: { textAlign: 'center', padding: '14px' } },
      h('div', { class: 'gold', style: { fontSize: 'calc(14px * var(--ts, 1.2))' } }, sc.name.toUpperCase()),
      h('div', { class: 'sub' }, sc.desc),
      h('div', { class: 'row', style: { justifyContent: 'center', gap: '16px', margin: '10px 0' } },
        h('div', null, badge(a.ident, 56), h('div', { style: { color: teamTextColor(a.ident) } }, fullName(a.ident)), h('div', { class: 'muted' }, 'YOU · ' + a.tier + ' ' + a.rating)),
        h('div', { class: 'gold', style: { fontSize: '20px' } }, 'VS'),
        h('div', null, badge(b.ident, 56), h('div', { style: { color: teamTextColor(b.ident) } }, fullName(b.ident)), h('div', { class: 'muted' }, b.tier + ' ' + b.rating))),
      h('div', { class: 'modetxt' }, 'Same challenge for everyone today, always on NORMAL. Your first try is the one that counts.'),
      h('div', { class: 'row', style: { justifyContent: 'center', gap: '8px', marginTop: '10px' } },
        done ? h('button', { onclick: () => startGameScen(T0.id, { daily: true, seed: T0.seed, practice: true }) }, 'PRACTISE IT') : h('button', { class: 'primary', onclick: () => startGameScen(T0.id, { daily: true, seed: T0.seed }) }, 'PLAY (COUNTS) ▶'),
        done ? h('div', { class: done === 'W' ? 'green' : 'red', style: { alignSelf: 'center' } }, done === 'W' ? '✓ WON TODAY' : '✕ LOST TODAY · BACK TOMORROW') : null)),
    h('div', { class: 'panel' }, h('div', { class: 'row', style: { justifyContent: 'space-between', margin: 0, alignItems: 'center' } },
      h('div', null, h('b', null, 'STREAK ' + (D.streak || 0)), h('span', { class: 'muted' }, ' · BEST ' + (D.best || 0) + ' · ' + (D.wins || 0) + ' DAILY WINS')),
      h('div', { class: 'row', style: { gap: '3px', margin: 0 } }, last7.map(([k, v]) => h('span', { class: 'hkday ' + (v === 'W' ? 'w' : v === 'L' ? 'l' : ''), title: k }, k.slice(8))))),
      h('div', { class: 'modetxt', style: { marginTop: '6px' } }, hasCosmetic('jersey_sunset') ? 'The Sunset Jersey is yours.' : 'Win 7 daily challenges for the Sunset Jersey (' + Math.min(7, D.wins || 0) + '/7).')));
}
