'use strict';
// ====================================================================
//  BREAKAWAY DUEL (Nov 22): two players, one keyboard (or one controller), taking turns.
//  Each player picks a team; you alternate breakaways (a defender chasing you, a goalie in their colours), five each.
//  Tied after five: sudden death, a pair at a time (up to five more pairs). The engine still has one human skater,
//  so this is a turn-taking (hot seat) game: hand over the keyboard when your name comes up.
// ====================================================================
const DUEL = { reps: 5, extra: 5 };
function duelStart() {
  UI.qpSeed = UI.qpSeed || newQpSeed();
  const teams = generateQuickTeams(UI.qpSeed), sel = UI.duelSel || [0, 1];
  const A = teams[sel[0]] || teams[0], B = teams[sel[1]] || teams[1];
  const ev = qpEvenTeams(7);                                   // even ratings: the duel is about the players, not the rosters
  const mode = { kind: 'drill', id: 'breakaway', reps: DUEL.reps * 2, rules: false, duel: { idents: [A.ident, B.ident], score: [0, 0], shots: [0, 0], names: UI.duelNames || ['PLAYER 1', 'PLAYER 2'] } };
  qpLaunchMode(mode, { teams: ev,
    onEnd: () => { const D = mode.duel; go(() => scrDuelResult(D)); }, onQuit: () => go(scrDuel) });
}
// whose turn: even reps = player 1, odd reps = player 2; the shooter wears his team's colours, the goalie the other's
{ const _ds = drillSetup;
  drillSetup = function () {
    const r = _ds.apply(this, arguments);
    const m = S.mode; if (!m || !m.duel) return r;
    const who = m.rep % 2, D = m.duel;
    TEAM[0] = teamPalette(D.idents[who], false); TEAM[1] = teamPalette(D.idents[1 - who], true);
    const n = Math.floor(m.rep / 2) + 1, sd = n > DUEL.reps;
    S.banner = { text: D.names[who] + (sd ? ' · SUDDEN DEATH' : ''), sub: (sd ? 'PAIR ' + (n - DUEL.reps) : 'BREAKAWAY ' + n + ' OF ' + DUEL.reps) + ' · ' + D.names[0] + ' ' + D.score[0] + ' - ' + D.score[1] + ' ' + D.names[1], life: 120 };
    return r;
  }; }
{ const _dr = drillRep;
  drillRep = function (ok) {
    const m = S.mode, D = m && m.duel;
    if (D && !(m.pause > 0)) {
      const who = m.rep % 2; D.shots[who]++; if (ok) D.score[who]++;
      const done = D.shots[0] === D.shots[1];
      const left = done ? Math.max(0, DUEL.reps - D.shots[0]) : 0;
      // after each pair: can the trailing player still catch up? tied after five = sudden death
      if (done && D.shots[0] >= DUEL.reps) { if (D.score[0] !== D.score[1] || D.shots[0] >= DUEL.reps + DUEL.extra) m.reps = m.rep + 1; else m.reps = m.rep + 3; }
      else if (done && Math.abs(D.score[0] - D.score[1]) > left) m.reps = m.rep + 1;            // out of reach
    }
    return _dr.apply(this, arguments);
  }; }
{ const _dm = drawModeHud;
  drawModeHud = function () {
    const m = S.mode; if (!m || !m.duel || S.so) return _dm.apply(this, arguments);
    const D = m.duel, who = m.rep % 2, SW = viewW();
    const msg = D.names[0] + ' ' + D.score[0] + '/' + D.shots[0] + '   ·   ' + D.names[1] + ' ' + D.score[1] + '/' + D.shots[1] + '   ·   UP: ' + D.names[who];
    const w = msg.length * 5 + 16, x = SW / 2 - w / 2, y = HUDH + 4;
    ctx.fillStyle = 'rgba(11,14,30,.9)'; ctx.fillRect(x, y, w, 11); ctx.fillStyle = TEAM[0].main; ctx.fillRect(x, y, w, 1.5);
    text(msg, SW / 2, y + 3, '#ffffff', 5, 'center', null);
  }; }
function scrDuel() {
  UI.qpSeed = UI.qpSeed || newQpSeed();
  const teams = generateQuickTeams(UI.qpSeed); UI.duelSel = UI.duelSel || [0, 1]; UI.duelNames = UI.duelNames || ['PLAYER 1', 'PLAYER 2'];
  const side = i => { const q = teams[UI.duelSel[i]], inp = h('input', { type: 'text', value: UI.duelNames[i], maxLength: 12, style: { width: '130px', textAlign: 'center' }, oninput: e => { UI.duelNames[i] = e.target.value.toUpperCase() || 'PLAYER ' + (i + 1); } });
    const cyc = d => { let n = UI.duelSel[i]; do { n = (n + d + teams.length) % teams.length; } while (n === UI.duelSel[1 - i]); UI.duelSel[i] = n; go(scrDuel); };
    return h('div', { class: 'panel', style: { textAlign: 'center', flex: 1 } }, inp,
      h('div', { class: 'row', style: { justifyContent: 'center', alignItems: 'center', gap: '8px', margin: '8px 0' } }, h('button', { class: 'small', onclick: () => cyc(-1) }, '◀'), badge(q.ident, 64), h('button', { class: 'small', onclick: () => cyc(1) }, '▶')),
      h('div', { style: { color: teamTextColor(q.ident) } }, fullName(q.ident).toUpperCase())); };
  return h('div', { class: 'screen duelS' }, header('BREAKAWAY DUEL · 2 PLAYERS', () => go(scrQuickPlay), 'BACK'),
    h('div', { class: 'sub', style: { margin: '0 0 6px' } }, 'Two players take turns on one keyboard or controller: five breakaways each, a defender chasing, the other player\'s colours in goal. Tied? Sudden death.'),
    h('div', { class: 'row', style: { gap: '12px', alignItems: 'stretch', margin: 0 } }, side(0), h('div', { class: 'gold', style: { alignSelf: 'center', fontSize: '22px' } }, 'VS'), side(1)),
    h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '10px' } }, h('button', { class: 'primary', onclick: duelStart }, 'KICKOFF ▶')));
}
function scrDuelResult(D) {
  const w = D.score[0] === D.score[1] ? -1 : D.score[0] > D.score[1] ? 0 : 1;
  const q = qpProg(); q.duels = (q.duels || 0) + 1; PROFILE.dirty = true;
  return h('div', { class: 'screen' }, header('BREAKAWAY DUEL', () => go(scrQuickPlay), 'BACK'),
    h('div', { class: 'panel', style: { textAlign: 'center', padding: '22px' } },
      h('div', { class: 'gold', style: { fontSize: 'calc(16px * var(--ts, 1.2))' } }, w < 0 ? 'A DRAW' : D.names[w] + ' WINS!'),
      h('div', { class: 'row', style: { justifyContent: 'center', gap: '24px', margin: '12px 0' } }, [0, 1].map(i => h('div', null, badge(D.idents[i], 56), h('div', null, D.names[i]), h('div', { class: i === w ? 'gold' : '', style: { fontSize: '18px' } }, D.score[i] + ' / ' + D.shots[i])))),
      h('div', { class: 'row', style: { justifyContent: 'center', gap: '8px' } }, h('button', { class: 'primary', onclick: duelStart }, 'REMATCH'), h('button', { onclick: () => go(scrDuel) }, 'CHANGE TEAMS'), h('button', { onclick: () => go(scrQuickPlay) }, 'DONE'))));
}
