'use strict';
// ====================================================================
//  AWARDS NIGHT: after the last tournament, the season's honours one at a time. Each award shows its trophy and three
//  finalists; REVEAL names the winner (the hosts of PUCK TALK react). Then the two All-Star teams and the GM of the Year,
//  then the season report. Skippable at any point. Everything shown here was decided in finishSeason (league.js).
// ====================================================================
const AWARD_ORDER = ['rookie', 'improved', 'comeback', 'sport', 'iron', 'hammer', 'clutch', 'points', 'stick', 'bestd', 'def', 'glove', 'pmvp', 'mvp'];
const AWARD_DESC = {
  stick: 'The league\'s top goal scorer in the regular season.',
  points: 'The most points (goals + assists) in the regular season.',
  mvp: 'The most valuable player in the league: what he did, game after game.',
  glove: 'Keeper of the year: goals saved above expected, then save percentage.',
  rookie: 'The best first-year player.',
  def: 'The best defensive game in the league: stops, takeaways, breakaways broken up.',
  bestd: 'The best stay-at-home D in the league.',
  pmvp: 'The most valuable player of the playoffs.',
  improved: 'The biggest jump in overall rating since last season.',
  iron: 'Never missed a shift: the most games (and minutes) played.',
  hammer: 'The league\'s hardest tackler.',
  sport: 'Plays hard and clean: points with the fewest penalty minutes.',
  clutch: 'Biggest goals at the biggest moments.',
  comeback: 'Back from a lost season (injury or a lack of playing time) to play like this.',
};
const AWARD_QUIPS = [
  n => `${n}! Nobody deserved it more.`, n => `It's ${n}! What a season he put together.`, n => `${n} takes it home. Book the parade!`,
  n => `${n}! I called it in October, you can check the tapes.`, n => `Give it up for ${n}!`, n => `${n}! You love to see it.`,
];
function seasonLineOf(p, s, cat) { const e = (p.seasons || []).find(x => x.s === s); return e && e[cat || 'reg'] ? fullLine(e[cat || 'reg']) : null; }   // archived lines are kept per category (reg, po, tour)
function scrAwardsNight(hs, onDone) {
  const save = UI.save, steps = [];
  const aw = (hs.awards || []).map(id => save.awards.find(a => a.id === id)).filter(Boolean);
  for (const k of AWARD_ORDER) { const a = aw.find(x => x.key === k); if (a) steps.push({ kind: 'award', a, fin: ((hs.finalists || {})[k] || [a.pid]).filter(pid => P(save, pid)) }); }
  if (hs.allStars) steps.push({ kind: 'stars' });
  if (hs.gmYear) steps.push({ kind: 'gm' });
  let i = 0, shown = false;
  const body = h('div', { class: 'anight' });
  const host = typeof deskCohost === 'function' ? deskCohost(save) : null, hostName = host ? host.name : 'T';
  const finCard = (pid, win, revealed, cat) => {
    const p = P(save, pid), t = save.teams[p.teamId] || null, l = seasonLineOf(p, hs.season, cat), mine = p.teamId === save.userTeamId;
    return h('div', { class: 'ancard' + (revealed && win ? ' win' : '') + (revealed && !win ? ' lose' : '') + (mine ? ' mine' : ''), onclick: () => push(() => scrPlayer(pid)) },
      portrait(p, t, 64), h('div', { style: { minWidth: 0 } },
        h('div', { class: 'gold' }, '#' + p.num + ' ' + p.first + ' ' + p.last.toUpperCase()),
        h('div', { class: 'muted' }, (t ? t.abbr + ' · ' : '') + (p.pos === 'G' ? 'Keeper' : posShort(p.spos))),
        l ? h('div', { style: { fontSize: '.9em' } }, statString(p.pos, l)) : null,
        revealed && win ? h('div', { class: 'anwin' }, '★ WINNER') : null));
  };
  const render = () => {
    body.innerHTML = '';
    const st = steps[i], last = i === steps.length - 1;
    const nav = h('div', { class: 'row', style: { justifyContent: 'center', gap: '8px', marginTop: '10px' } },
      st.kind === 'award' && !shown ? h('button', { class: 'primary', onclick: () => { shown = true; render(); } }, 'REVEAL THE WINNER') :
        h('button', { class: 'primary', onclick: () => { if (last) return onDone(); i++; shown = false; render(); } }, last ? 'TO THE SEASON REPORT ▶' : 'NEXT ▶'),
      h('button', { onclick: onDone }, 'SKIP TO THE SEASON REPORT'));
    const prog = h('div', { class: 'muted', style: { textAlign: 'center', fontSize: '7px', marginBottom: '6px' } }, `${i + 1} of ${steps.length}`);
    if (st.kind === 'award') {
      const a = st.a, tc = drawTrophyCanvas(a.key, 8, shown); tc.style.width = '280px';
      body.appendChild(prog);
      body.appendChild(h('div', { class: 'anstage' },
        h('div', { class: 'antrophy' }, tc, h('h2', { class: 'gold', style: { margin: '4px 0' } }, a.name.toUpperCase()), h('div', { class: 'muted' }, AWARD_DESC[a.key] || '')),
        h('div', { class: 'anfinal' }, h('div', { class: 'gold', style: { marginBottom: '6px' } }, shown ? 'THE WINNER' : 'THE FINALISTS'),
          st.fin.map(pid => finCard(pid, pid === a.pid, shown, a.key === 'pmvp' ? 'po' : 'reg')),
          h('div', { class: 'anhost' }, h('b', null, hostName + ': '), shown ? AWARD_QUIPS[(a.pid.length + i) % AWARD_QUIPS.length](a.playerName) : 'And the winner is...'))));
    } else if (st.kind === 'stars') {
      const POS = hs.allStars.pos || ['C', 'LW', 'RW', 'LD', 'RD', 'G'];
      const row = (ids, lab) => h('div', { class: 'anstars' }, h('div', { class: 'gold', style: { marginBottom: '6px' } }, lab),
        h('div', { class: 'anstarrow' }, ids.map((pid, k) => { const p = pid && P(save, pid); if (!p) return h('div', { class: 'anstar empty' }, POS[k]);
          const t = save.teams[p.teamId]; return h('div', { class: 'anstar' + (p.teamId === save.userTeamId ? ' mine' : ''), onclick: () => push(() => scrPlayer(pid)) },
            h('div', { class: 'muted' }, POS[k]), portrait(p, t, 52), h('div', { class: 'gold' }, '#' + p.num + ' ' + p.last.toUpperCase()), h('div', { class: 'muted' }, t ? t.abbr : '')); })));
      body.appendChild(prog);
      body.appendChild(h('h2', { class: 'gold', style: { textAlign: 'center', margin: '0 0 8px' } }, 'ALL-STAR TEAMS ' + hs.label));
      body.appendChild(row(hs.allStars.first, 'FIRST TEAM')); body.appendChild(row(hs.allStars.second, 'SECOND TEAM'));
      const mine = hs.allStars.first.concat(hs.allStars.second).filter(pid => pid && P(save, pid) && P(save, pid).teamId === save.userTeamId).length;
      body.appendChild(h('div', { class: 'anhost', style: { textAlign: 'center' } }, h('b', null, hostName + ': '), mine ? (mine === 1 ? 'One of your guys made the All-Star teams. Not bad at all!' : `${mine} of your guys made the All-Star teams. Not bad at all!`) : 'The best of the best. Maybe one of yours next year?'));
    } else {
      const G0 = hs.gmYear, t = save.teams[G0.teamId], me = G0.teamId === save.userTeamId, tc = drawTrophyCanvas('gmyear', 8, true); tc.style.width = '280px';
      body.appendChild(prog);
      body.appendChild(h('div', { class: 'anstage' },
        h('div', { class: 'antrophy' }, tc, h('h2', { class: 'gold', style: { margin: '4px 0' } }, 'GM OF THE YEAR'), h('div', { class: 'muted' }, 'The club that did the most with what it had: its points, and how far it came since last season.')),
        h('div', { class: 'anfinal' }, h('div', { class: 'gold', style: { marginBottom: '6px' } }, 'THE WINNER'),
          G0.finalists.map(id => { const tt = save.teams[id], w = id === G0.teamId; return h('div', { class: 'ancard' + (w ? ' win' : ' lose') + (id === save.userTeamId ? ' mine' : '') }, badge(tt, 44),
            h('div', null, h('div', { class: 'gold' }, fullName(tt).toUpperCase()), w ? h('div', null, G0.why) : null, w ? h('div', { class: 'anwin' }, '★ WINNER') : null)); }),
          h('div', { class: 'anhost' }, h('b', null, hostName + ': '), me ? 'That\'s YOU! The front office of the year. Take a bow!' : `Hats off to the ${t.nick}'s front office.`))));
    }
    body.appendChild(nav);
  };
  if (!steps.length) { setTimeout(onDone, 0); return h('div'); }
  render();
  return h('div', { class: 'screen wide' }, header('AWARDS NIGHT ' + hs.label, null), body);
}
