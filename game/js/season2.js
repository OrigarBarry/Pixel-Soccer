'use strict';
// ====================================================================
//  SEASON 2 (Nov 22): the franchise loop, joined up.
//  A. THIS GAME MOVED: after every game you play or simulate, what changed (standings, the owner's goals, development,
//     achievement progress, promises, your rival).
//  B. THE OWNER: his goals now pay (or cost). A halfway report at game 12; two poor seasons put you on the HOT SEAT,
//     and a third brings the owner in (money, reputation and fans).
//  C. SIM TO NEXT EVENT: simulate up to the next tournament, the playoffs or the end of the season; it stops early
//     for anything that needs you (a trade offer, an injury, a promise coming due, a tournament invitation).
//  D. RIVALS: heat builds from close games, overtime, fights, trash talk and the playoffs. RIVAL NIGHT is a big game
//     (bigger crowd, big-game atmosphere). Plus DEADLINE DAY (two game days before the playoffs) and a WEEK IN REVIEW
//     every four games, which PUCK TALK picks up from the news.
//  E. A FIRST SEASON THAT OPENS UP: in a new franchise, DEVELOPMENT opens after game 3, SPONSORS & GM after game 6, and
//     FARM & IR at the first injury (or game 10). Each comes with one short card. SHOW EVERYTHING NOW skips it.
//  F. THE ARENA PAYS: money spent on the arena lifts attendance (up to +8%) and gives a small home edge in simulated
//     games (+2% shot rate for every home side, up to +4.5% in a fully built arena).
//  G. CHALLENGE RUNS (new franchise): EXPANSION (your first two inaugural picks are league leftovers), NO FREE AGENTS,
//     HARD CAP $14M (your signings and renewals can't take your payroll past it).
//  Loaded last.
// ====================================================================

const us = save => save.userTeamId;
// notices are saved with the franchise, so they hold plain data: { s2: { head, tone, lines } } (drawn by showNotices below)
const s2Note = (save, head, lines, tone) => notify(save, { s2: { head, tone: tone || 'gold', lines: (lines || []).filter(Boolean) } });
{ const _sn = showNotices;
  showNotices = function () {
    const save = UI.save, made = [];
    if (save && save.notices) for (const n of save.notices) if (n.s2 && !n.text) { n.text = h('div', null, h('div', { class: n.s2.tone }, n.s2.head), n.s2.lines.map(x => h('div', { class: 'muted', style: { fontSize: '7px', lineHeight: 1.8 } }, x))); made.push(n); }
    try { return _sn.apply(this, arguments); } finally { for (const n of made) delete n.text; }
  }; }
const myStand = save => save.season.standings[us(save)];

// ---------- A. snapshots and THIS GAME MOVED
function s2Snap(save) {
  const se = save.season, uid = us(save), order = sortedStandings(save), t = save.teams[uid];
  const d = se.divOf ? se.divOf[uid] : null, div = d != null ? divStandings(save, d) : null;
  const og = typeof ownerGoals === 'function' ? ownerGoals(save) : null;
  const ids = rosterIds(t), attrs = {}, dev = {};
  for (const id of ids) { const p = P(save, id); if (!p) continue; attrs[id] = Object.assign({}, p.attrs); if (p.dev) dev[id] = { prog: p.dev.prog || 0, gen: p.dev.gen || 0, focus: p.dev.focus || null }; }
  const ach = {}; for (const a of ACHIEVEMENTS) if (a.goal && !(save.ach[a.id] && save.ach[a.id].done)) ach[a.id] = (save.achProg || {})[a.id] || 0;
  return { pos: order.indexOf(uid) + 1, st: Object.assign({}, myStand(save)), divPos: div ? div.indexOf(uid) + 1 : null, divLine: div ? s2LineGap(save, div, uid) : null,
    og: og ? og.map(g => ({ label: g.label, ok: g.ok, now: g.now })) : null, attrs, dev, ach, rival: s2TopRival(save), heat: Object.assign({}, save.rivals || {}) };
}
// points above (+) or below (-) the playoff line in the division (top 4 make it)
function s2LineGap(save, div, uid) {
  const st = save.season.standings, i = div.indexOf(uid);
  return i < 4 ? st[uid].pts - st[div[4]].pts : st[uid].pts - st[div[3]].pts;
}
{ const _ar = applyResult;
  applyResult = function (save, gid, res) {
    const g = save.season && save.season.games[gid];
    const mine = g && !g.played && (g.home === us(save) || g.away === us(save));
    const before = mine ? s2Snap(save) : null;
    const r = _ar.apply(this, arguments);
    if (mine) {
      try { s2AfterUserGame(save, g, res); } catch (e) { console.error(e); }
      const after = s2Snap(save);
      if (save.s2DevBase) before.dev = save.s2DevBase;                  // development moves between games (each new game day), not inside one
      save.s2DevBase = after.dev;
      UI.lastMove = { gid, before, after, opp: g.home === us(save) ? g.away : g.home, won: (g.home === us(save) ? g.hs > g.as : g.as > g.hs), type: g.type };
    }
    return r;
  }; }
function movedTeaser(m) {
  const b = m.before, a = m.after, out = [];
  const bt = s2Breakthroughs(m); if (bt.length) out.push('BREAKTHROUGH: ' + bt[0].who + ' +1 ' + bt[0].k);
  if (a.pos !== b.pos && m.type === 'reg' && b.st.gp > 0) out.push((a.pos < b.pos ? '▲ UP TO ' : '▼ DOWN TO ') + ordinal(a.pos).toUpperCase());
  if (b.og && a.og && b.st.gp > 0) { const n = a.og.filter(x => x.ok).length - b.og.filter(x => x.ok).length; if (n) out.push((n > 0 ? '✓ ' : '✕ ') + 'OWNER GOALS ' + a.og.filter(x => x.ok).length + '/3'); }
  return out.slice(0, 2).join(' · ') || null;
}
function s2Breakthroughs(m) {
  const out = [];
  for (const id in m.after.attrs) { const b = m.before.attrs[id]; if (!b) continue; for (const k in m.after.attrs[id]) if (m.after.attrs[id][k] > (b[k] || 0)) { const p = Pl(id); out.push({ who: '#' + p.num + ' ' + p.last, k: attrName(k).toUpperCase() }); } }
  return out;
}
function movedPanel(m) {
  const save = UI.save, b = m.before, a = m.after, rows = [];
  const fresh = !b.st.gp, arrow = (x, y) => x === y || fresh ? h('span', { class: 'muted' }, fresh ? '·' : '=') : x > y ? h('span', { class: 'green' }, '▲') : h('span', { class: 'red' }, '▼');
  // standings
  const st = a.st, line = a.divLine;
  const stand = h('div', { class: 'panel' }, h('div', { class: 'grouplab', style: { marginTop: 0 } }, 'STANDINGS'),
    h('div', { class: 'hotrow' }, arrow(b.pos, a.pos), h('b', { style: { flex: 1 } }, ordinal(a.pos) + ' overall' + (a.pos !== b.pos && b.st.gp > 0 ? ' (was ' + ordinal(b.pos) + ')' : '')), h('span', { class: 'gold' }, st.w + '-' + st.otl + '-' + st.l + ' · ' + st.pts + ' PTS')),
    a.divPos ? h('div', { class: 'hotrow' }, arrow(b.divPos, a.divPos), h('b', { style: { flex: 1 } }, ordinal(a.divPos) + ' in the division'),
      h('span', { class: line >= 0 ? 'green' : 'red' }, line > 0 ? line + ' pts clear of the playoff line' : line === 0 ? 'level with the playoff line' : Math.abs(line) + ' pts below the playoff line')) : null);
  // the owner
  const owner = a.og ? h('div', { class: 'panel' }, h('div', { class: 'grouplab', style: { marginTop: 0 } }, "OWNER'S GOALS · " + a.og.filter(x => x.ok).length + '/3 ON TRACK' + (save.s2hot ? ' · HOT SEAT' : '')),
    a.og.map((g, i) => { const was = b.og && b.og[i] && b.og[i].now !== '-' ? b.og[i].ok : g.ok;
      return h('div', { class: 'hotrow' }, h('span', { class: g.ok ? 'green' : 'red' }, g.ok ? '✓' : '✕'), h('span', { style: { flex: 1 } }, g.label), h('span', { class: 'gold' }, g.now), was !== g.ok ? h('span', { class: g.ok ? 'green' : 'red', style: { fontSize: 'calc(6px * var(--ts, 1.2))' } }, g.ok ? ' NOW MET' : ' SLIPPED') : null); })) : null;
  // development
  const devRows = [];
  for (const id in a.dev) { const d1 = a.dev[id], d0 = b.dev[id] || { prog: 0, gen: 0 }, p = Pl(id); if (!p || !d1.focus) continue;
    const gain = (d1.prog - d0.prog + (a.attrs[id][d1.focus] > (b.attrs[id] || {})[d1.focus] ? 100 : 0)); if (gain > 0) devRows.push({ p, d1, gain }); }
  devRows.sort((x, y) => y.d1.prog - x.d1.prog);
  const bt = s2Breakthroughs(m);
  const dev = devRows.length || bt.length ? h('div', { class: 'panel' }, h('div', { class: 'grouplab', style: { marginTop: 0 } }, 'DEVELOPMENT'),
    bt.map(x => h('div', { class: 'gold', style: { fontSize: '8px' } }, '★ BREAKTHROUGH: ' + x.who + ' +1 ' + x.k)),
    devRows.slice(0, 3).map(r => h('div', { class: 'hotrow' }, h('span', { style: { flex: 1 } }, '#' + r.p.num + ' ' + r.p.last + ' · ' + attrName(r.d1.focus)), hkBar(r.d1.prog / 100, 70), h('span', { class: 'muted', style: { minWidth: '34px', textAlign: 'right' } }, Math.round(r.d1.prog) + '%')))) : null;
  // achievements, promises, rival
  const achRows = Object.keys(a.ach).filter(id => (a.ach[id] || 0) > (b.ach[id] || 0)).map(id => ACH_BY_ID[id]).filter(Boolean);
  const promRows = [];
  for (const id of rosterIds(save.teams[us(save)])) { const p = Pl(id); for (const pr of ((p && p.morale && p.morale.prom) || [])) if (!pr.res) promRows.push({ p, pr }); }
  const opp = save.teams[m.opp], heat0 = (b.heat || {})[m.opp] || 0, heat1 = (save.rivals || {})[m.opp] || 0;
  const misc = achRows.length || promRows.length || heat1 >= RIVAL_MIN ? h('div', { class: 'panel' },
    achRows.length ? [h('div', { class: 'grouplab', style: { marginTop: 0 } }, 'ACHIEVEMENTS'), achRows.slice(0, 2).map(x => h('div', { class: 'hotrow' }, h('span', { style: { flex: 1 } }, x.name), hkBar(Math.min(1, (a.ach[x.id] || 0) / x.goal), 70), h('span', { class: 'gold' }, Math.min(x.goal, a.ach[x.id] || 0) + '/' + x.goal)))] : null,
    promRows.length ? [h('div', { class: 'grouplab' }, 'PROMISES'), promRows.slice(0, 2).map(r => h('div', { class: 'modetxt' }, r.p.last + ': ' + r.pr.label + (r.pr.due != null ? ' · due in ' + Math.max(0, r.pr.due - mDay(save)) + ' game day' + (r.pr.due - mDay(save) === 1 ? '' : 's') : '')))] : null,
    heat1 >= RIVAL_MIN && opp ? [h('div', { class: 'grouplab' }, 'RIVALRY'), h('div', { class: 'modetxt' }, fullName(opp) + ' · heat ' + Math.round(heat1) + (heat1 > heat0 ? ' (+' + Math.round(heat1 - heat0) + ')' : '') + (s2TopRival(save) === m.opp ? ' · YOUR TOP RIVAL' : ''))] : null) : null;
  return h('div', { class: 'hkprog' }, h('div', null, stand, owner), h('div', null, dev || h('div', { class: 'panel muted', style: { fontSize: '7px' } }, 'No development focus set yet: ROSTER > DEVELOPMENT.'), misc));
}

// ---------- B. the owner's goals with stakes
REV_KEYS.owner = "Owner's bonus";
EXP_KEYS.owner = "Owner's fine";
const OWNER_PAY = { 3: { cash: 1500, rep: 4 }, 2: { cash: 500, rep: 1 }, 1: { cash: 0, rep: -2 }, 0: { cash: 0, rep: -4 } };
{ const _fs = finishSeason;
  finishSeason = function (save) {
    const se = save.season, first = se && !se.done;
    let met = null;
    if (first && typeof ownerGoals === 'function' && !save.dream) { try { const G = ownerGoals(save); met = G ? G.filter(g => g.ok).length : null; } catch (e) {} }
    const r = _fs.apply(this, arguments);
    if (first && met != null) try { s2OwnerVerdict(save, met); } catch (e) { console.error(e); }
    if (first) { for (const k in (save.rivals || {})) save.rivals[k] = Math.round(save.rivals[k] * 0.6 * 10) / 10; if (save.phase && save.phase.on) save.phase.on = false; }
    return r;
  }; }
function s2OwnerVerdict(save, met) {
  const t = save.teams[us(save)], pay = OWNER_PAY[met], lines = [];
  if (pay.cash) { ledger(t, 'owner', pay.cash); lines.push('Bonus: ' + fmtM(pay.cash) + ' added to your funds.'); }
  if (typeof gmRep === 'function') { gmRep(save, pay.rep); lines.push('GM reputation ' + (pay.rep > 0 ? '+' : '') + pay.rep + '.'); }
  (save.ownerLog = save.ownerLog || []).push({ s: save.season.num, met });
  const wasHot = !!save.s2hot;
  save.s2strikes = met <= 1 ? (save.s2strikes || 0) + 1 : 0;
  let head = met === 3 ? 'THE OWNER IS THRILLED' : met === 2 ? 'THE OWNER IS PLEASED' : met === 1 ? 'THE OWNER IS UNHAPPY' : 'THE OWNER IS FURIOUS';
  if (wasHot && met <= 1) {
    ledger(t, 'owner', 1500); finOf(t).pop = Math.max(0, finOf(t).pop - 6); if (typeof gmRep === 'function') gmRep(save, -10);
    head = 'THE OWNER STEPS IN'; lines.push('Missed again on the hot seat: a ' + fmtM(1500) + ' fine, GM reputation -10, and the fans lose faith (popularity -6). The slate is wiped clean.');
    save.s2hot = false; save.s2strikes = 0;
  } else if (wasHot) { save.s2hot = false; save.s2strikes = 0; lines.push('You are off the hot seat.'); }
  else if (save.s2strikes >= 2) { save.s2hot = true; lines.push('HOT SEAT: two poor seasons in a row. Meet at least two of the owner\'s goals next season, or he steps in.'); }
  else if (met <= 1) lines.push('Another season like this and you are on the hot seat.');
  pushNews(save, `${head}: the ${t.nick} met ${met} of the owner's 3 goals.`);
  s2Note(save, head, [`You met ${met} of the owner's 3 goals this season.`].concat(lines), met >= 2 ? 'gold' : 'red');
}
// the panel says what's at stake
{ const _ogp = ownerGoalsPanel;
  ownerGoalsPanel = function (save) {
    const el = _ogp.apply(this, arguments); if (!el) return el;
    el.appendChild(h('div', { class: 'muted', style: { fontSize: 'calc(6px * var(--ts, 1.2))', marginTop: '6px', lineHeight: 1.8 } },
      'AT SEASON\'S END: 3 met = ' + fmtM(OWNER_PAY[3].cash) + ' and rep +4 · 2 = ' + fmtM(OWNER_PAY[2].cash) + ' and rep +1 · 1 or 0 = rep down; two poor seasons in a row = HOT SEAT.'));
    if (save.s2hot) el.insertBefore(h('div', { class: 'red', style: { fontSize: '8px', margin: '2px 0 6px' } }, '\u{1F525} HOT SEAT: meet at least 2 goals this season or the owner steps in.'), el.children[1] || null);
    return el;
  }; }

// ---------- D. rivals
const RIVAL_MIN = 12;
const s2TopRival = save => { const r = save.rivals || {}; let best = null, v = RIVAL_MIN - 0.01; for (const k in r) if (r[k] > v && save.teams[k]) { v = r[k]; best = k; } return best; };
const isRivalGame = (save, g) => !!(save && g && save.rivals && (g.home === us(save) || g.away === us(save)) && s2TopRival(save) === (g.home === us(save) ? g.away : g.home));
function s2SeedRival(save) {
  if (save.rivals) return;
  save.rivals = {};
  const se = save.season, uid = us(save); if (!se || !se.divOf) return;
  const mates = se.divs[se.divOf[uid]].filter(id => id !== uid);
  const mine = teamStrength(save, uid);
  const r = mates.sort((a, b) => Math.abs(teamStrength(save, a) - mine) - Math.abs(teamStrength(save, b) - mine))[0];
  if (r) save.rivals[r] = RIVAL_MIN;
}
function s2Heat(save, opp, v, why) {
  const r = save.rivals = save.rivals || {}, was = s2TopRival(save);
  r[opp] = Math.round(Math.min(99, (r[opp] || 0) + v) * 10) / 10;
  const now = s2TopRival(save);
  if (now && now !== was && now === opp) pushNews(save, `A RIVALRY IS BORN: the ${save.teams[us(save)].nick} and the ${save.teams[opp].nick} have bad blood after ${why}.`);
}
function s2AfterUserGame(save, g, res) {
  s2SeedRival(save);
  const uid = us(save), opp = g.home === uid ? g.away : g.home, margin = Math.abs((g.hs || 0) - (g.as || 0));
  let heat = 1, why = 'another meeting';
  if (margin <= 1) { heat += 3; why = 'a one-goal game'; }
  if (g.ot || g.so) { heat += 2; why = 'an extra time battle'; }
  const fights = res && res.tstats ? Math.max(0, ...Object.values(res.tstats).map(x => (x && x.fights) || 0)) : 0;
  if (fights) { heat += 4 * fights; why = 'a scuffle'; }
  if (g.type === 'po') { heat += 5; why = 'a playoff war'; }
  if (save.hype && save.hype.team === opp) { heat += 4; why = 'the trash talk'; }
  s2Heat(save, opp, heat, why);
  // the halfway report
  const se = save.season, st = myStand(save);
  if (g.type === 'reg' && st.gp >= N_ROUNDS / 2 && !se.s2half && !save.dream) {
    se.s2half = true;
    const G = ownerGoals(save), n = G ? G.filter(x => x.ok).length : 0;
    if (typeof gmRep === 'function') gmRep(save, n >= 2 ? 1 : -1);
    s2Note(save, 'HALFWAY REPORT: ' + n + ' OF 3 OWNER\'S GOALS ON TRACK', (G || []).map(x => (x.ok ? '✓ ' : '✕ ') + x.label + ' · now ' + x.now)
      .concat([n >= 2 ? 'The owner likes what he sees (GM reputation +1).' : 'The owner wants more in the second half (GM reputation -1).' + (save.s2hot ? ' You are on the hot seat.' : '')]), n >= 2 ? 'gold' : 'red');
    pushNews(save, `Halfway report: the ${save.teams[uid].nick} are ${ordinal(sortedStandings(save).indexOf(uid) + 1)} with ${n} of the owner's 3 goals on track.`);
  }
  // the week in review: every four games
  if (g.type === 'reg' && st.gp % 4 === 0) s2Week(save);
  // phase-in checks
  s2PhaseCheck(save);
}
// WEEK IN REVIEW: one or two storylines into the news (PUCK TALK reads the latest news)
function s2Week(save) {
  const se = save.season, uid = us(save), stories = [];
  if (se.divOf) {
    const div = divStandings(save, se.divOf[uid]), st = se.standings;
    const gap = st[div[3]].pts - st[div[4]].pts;
    stories.push(`WEEK IN REVIEW: the race for 4th in the ${save.teams[uid].nick}' division is ${gap <= 2 ? 'razor close' : 'opening up'}: the ${save.teams[div[3]].nick} hold it, ${gap} point${gap === 1 ? '' : 's'} ahead of the ${save.teams[div[4]].nick}.`);
  }
  try {
    const sk = Object.keys(se.stats).map(id => [id, se.stats[id] && se.stats[id].reg]).filter(([id, l]) => l && P(save, id) && P(save, id).pos !== 'G');
    const top = sk.sort((a, b) => (b[1].g + b[1].a) - (a[1].g + a[1].a))[0];
    if (top) { const p = P(save, top[0]), pts = top[1].g + top[1].a, gp = Math.max(1, top[1].gp || myStand(save).gp), pace = Math.round(pts / gp * N_ROUNDS);
      stories.push(`WEEK IN REVIEW: ${p.first} ${p.last} leads the league with ${pts} points and is on pace for ${pace}.`); }
  } catch (e) {}
  const worst = sortedStandings(save).slice().reverse().find(id => id !== uid);
  if (worst && se.standings[worst].gp >= 8) stories.push(`WEEK IN REVIEW: the coach of the ${save.teams[worst].nick} is on the hot seat after a ${se.standings[worst].w}-${se.standings[worst].l + se.standings[worst].otl} start.`);
  const pick = stories.sort(() => Math.random() - 0.5).slice(0, 2);
  for (const s of pick) pushNews(save, s);
}
// RIVAL NIGHT: a bigger crowd (and the news says so); DEADLINE DAY two game days before the playoffs
{ const _att = attendance;
  attendance = function (save, team, mult = 1) {
    let m = mult;
    try { const g = save.season && save.season.s2curGame; if (g && g.home === team.id && isRivalGame(save, g)) m += 0.25; } catch (e) {}
    const base = _att.call(this, save, team, m);
    return Math.min(FIN.capacity, Math.round(base * (1 + arenaAttBonus(team))));
  }; }
{ const _cd = currentDay;
  currentDay = function (save) {
    const day = _cd.apply(this, arguments);
    try {
      const se = save.season;
      if (se && !se.done && !save.dream && /^r2[23]$/.test(day.key) && !se.s2deadline) {
        se.s2deadline = true;
        pushNews(save, 'DEADLINE DAY: trading closes when the playoffs start. Clubs are working the phones.');
        if (typeof aiTradeProposal === 'function') { aiTradeProposal(save, true); aiTradeProposal(save, true); }
        s2Note(save, 'DEADLINE DAY', ['Two game days until the playoffs, and trading closes when they start. Offers are coming in: FRONT OFFICE > TRADES.']);
      }
      if (day.userGid) { const g = se.games[day.userGid]; se.s2curGame = g;
        if (isRivalGame(save, g) && se.s2rivalNews !== g.id) { se.s2rivalNews = g.id; const opp = save.teams[g.home === us(save) ? g.away : g.home];
          pushNews(save, `RIVAL NIGHT: the ${save.teams[us(save)].nick} and the ${opp.nick} renew the rivalry${g.home === us(save) ? ' at home' : ' on the road'}. Expect a big crowd.`); } }
    } catch (e) {}
    return day;
  }; }

// ---------- C. SIM TO NEXT EVENT
function s2Targets(save) {
  const se = save.season, out = [];
  const cur = currentDay(save).key;
  for (let i = se.calIdx; i < CALENDAR.length; i++) {
    const k = CALENDAR[i]; if (k[0] === 'r' || k === cur) continue;
    if (k === 'end') { out.push({ key: 'end', name: 'The end of the season' }); break; }
    if (k === 'po') { out.push({ key: 'po', name: 'The playoffs' }); continue; }
    if (se.comps[k] && se.comps[k].done) continue;
    if (OPTIONAL_COMPS.includes(k) && (choiceOf(se, k) === false || (!se.comps[k] && !qualifiesFor(save, k, us(save)) && choiceOf(se, k) == null))) continue;
    out.push({ key: k, name: COMP_INFO[k] ? COMP_INFO[k].name : k });
  }
  return out.filter((x, i, a) => a.findIndex(y => y.key === x.key) === i).slice(0, 4);
}
function s2SimTo(target) {
  const save = UI.save, se = save.season, uid = us(save), t = save.teams[uid];
  const injN = () => rosterIds(t).map(Pl).filter(p => p && p.inj && p.inj.g > 0).length;
  const promN = () => rosterIds(t).map(Pl).reduce((a, p) => a + ((p && p.morale && p.morale.prom) || []).filter(x => !x.res && x.due != null && x.due - mDay(save) <= 1).length, 0);
  const start = { pos: sortedStandings(save).indexOf(uid) + 1, w: myStand(save).w, l: myStand(save).l, offers: (save.tradeOffers || []).length, inj: injN(), prom: promN() };
  let games = 0, stop = null;
  for (let guard = 0; guard < 400; guard++) {
    const day = currentDay(save);
    if (day.key === 'end') { stop = 'The regular season and playoffs are done: on to the season review.'; break; }
    if (day.invite) { stop = 'A tournament invitation is waiting for your answer.'; break; }
    if (day.key === target && !(target[0] === 'r')) { stop = null; break; }
    if ((save.tradeOffers || []).length > start.offers) { stop = 'A trade offer came in.'; break; }
    if (injN() > start.inj) { stop = 'One of your players was injured.'; break; }
    if (promN() > start.prom) { stop = 'A promise you made is about to come due.'; break; }
    if (day.userGid) {
      UI.dayGids = day.gids.slice();
      preGameAutoLines(save, day.userGid);
      const g = se.games[day.userGid];
      applyResult(save, g.id, simGame(save, g, { homeGoalie: null, awayGoalie: null }));
      simRestOfDay(g.id); games++;
    } else for (const id of day.gids) applyResult(save, id, simGame(save, se.games[id]));
  }
  Store.autosave(save);
  const now = { pos: sortedStandings(save).indexOf(uid) + 1, w: myStand(save).w - start.w, l: myStand(save).l - start.l };
  go(scrHub);
  setTimeout(() => modal(close => h('div', null, h('h2', null, 'SIMULATED ' + games + ' GAME' + (games === 1 ? '' : 'S')),
    h('div', { class: 'sub' }, 'Your record over them: ' + now.w + '-' + now.l + '. Now ' + ordinal(now.pos) + (now.pos !== start.pos ? ' (was ' + ordinal(start.pos) + ')' : '') + '.'),
    stop ? h('div', { class: 'gold', style: { fontSize: '8px', margin: '6px 0' } }, 'STOPPED: ' + stop) : null,
    h('div', { class: 'row' }, h('button', { class: 'primary', onclick: close }, 'OK')))), 80);
}
function s2SimDialog(save) {
  const ts = s2Targets(save);
  modal(close => h('div', null, h('h2', null, 'SIM TO...'),
    h('div', { class: 'sub' }, 'Every game up to it is simulated, yours too. It stops early for a trade offer, an injury, a promise coming due or a tournament invitation.'),
    h('div', { class: 'menu', style: { margin: '8px 0' } }, ts.map(x => h('button', { onclick: () => { close(); s2SimTo(x.key); } }, x.name.toUpperCase()))),
    h('div', { class: 'row' }, h('button', { onclick: close }, 'CANCEL'))));
}
{ const _hub = scrHub;
  scrHub = function () {
    const node = _hub.apply(this, arguments);
    try {
      const save = UI.save, se = save && save.season;
      if (!save || !se || se.done || (save.draft0 && !save.draft0.done)) return node;
      s2SeedRival(save);
      const play = node.querySelector && node.querySelector('.hubplay');
      if (play && play.querySelector('.hubgo')) {
        play.appendChild(h('button', { class: 'link', title: 'Simulate up to the next tournament, the playoffs or the end of the season', onclick: () => s2SimDialog(save) }, 'sim ahead ▸▸'));
        const g = nextUserGame(save);
        if (g && isRivalGame(save, g)) play.insertBefore(h('div', { class: 'hkrival' }, '\u{1F525} RIVAL NIGHT'), play.firstChild);
        if (save.s2hot) play.appendChild(h('div', { class: 'red', style: { fontSize: 'calc(6px * var(--ts, 1.2))' } }, '\u{1F525} HOT SEAT'));
      }
    } catch (e) { console.error(e); }
    return node;
  }; }

// ---------- E. the first season opens up
const PHASE = {
  dev: { at: 3, name: 'DEVELOPMENT', card: 'DEVELOPMENT is open (ROSTER > DEVELOPMENT). Give up to five players a focus rating: a full bar is a permanent +1. Pair a young player with a veteran mentor, and set the practice plan.' },
  spons: { at: 6, name: 'SPONSORS & GM', card: 'SPONSORS & GM is open (FRONT OFFICE). Sponsors pay per game, some with win targets. Interviews build your players\' fame and your reputation. Better reputation, better deals.' },
  farm: { at: 10, name: 'FARM & IR', card: 'FARM & IR is open (ROSTER > FARM & IR). Six farm spots, three call-ups a week, injured reserve for long injuries, and buyouts.' },
};
const phaseLocked = (save, k) => !!(save && save.phase && save.phase.on && !save.phase.open[k]);
function s2PhaseCheck(save) {
  const P0 = save.phase; if (!P0 || !P0.on) return;
  const gp = myStand(save).gp, t = save.teams[us(save)];
  const hurt = rosterIds(t).some(id => { const p = Pl(id); return p && p.inj && p.inj.g > 0; });
  for (const k in PHASE) if (!P0.open[k] && (gp >= PHASE[k].at || (k === 'farm' && hurt))) {
    P0.open[k] = true;
    s2Note(save, 'NEW: ' + PHASE[k].name, [PHASE[k].card]);
  }
  if (Object.keys(PHASE).every(k => P0.open[k])) P0.on = false;
}
function phaseLockPanel(save, k) {
  return h('div', { class: 'panel', style: { textAlign: 'center', padding: '20px' } }, h('div', { class: 'gold' }, PHASE[k].name + ' OPENS ' + (k === 'farm' ? 'AT YOUR FIRST INJURY (OR AFTER GAME ' + PHASE[k].at + ')' : 'AFTER GAME ' + PHASE[k].at)),
    h('div', { class: 'sub' }, 'Your first season opens up a piece at a time so there is less to learn at once. Nothing here is needed yet: the club runs it for you.'),
    h('button', { class: 'small', onclick: () => { save.phase.on = false; Store.autosave(save); toast('Everything is open.'); go(UI.cur || scrHub); } }, 'SHOW EVERYTHING NOW'));
}
{ const _dt = devTab; devTab = function (save) { return phaseLocked(save, 'dev') ? phaseLockPanel(save, 'dev') : _dt.apply(this, arguments); }; }
{ const _ft = farmTab; farmTab = function (save) { return phaseLocked(save, 'farm') ? phaseLockPanel(save, 'farm') : _ft.apply(this, arguments); }; }
{ const _ss = scrSponsors; scrSponsors = function () { const save = UI.save; return phaseLocked(save, 'spons') ? h('div', { class: 'screen' }, header('SPONSORS & GM', () => go(scrHub), 'BACK'), phaseLockPanel(save, 'spons')) : _ss.apply(this, arguments); }; }

// ---------- F. the arena pays
function arenaInvest(team) { let k = 0; for (const it of (team.arenaOwned || [])) { const [g, v] = it.split(':'); k += (ARENA_PRICES[g] || {})[v] || 0; } return k; }
const arenaAttBonus = team => Math.min(0.08, arenaInvest(team) / 60000 * 0.08);
const arenaEdge = team => 0.02 + Math.min(0.025, arenaInvest(team) / 70000 * 0.025);
{ const _sg = simGame;
  simGame = function (save, g) {
    const keep = SIM.homeAdv;
    try { const ht = save.teams[g.home]; SIM.homeAdv = 1 + (ht ? arenaEdge(ht) : 0.02); } catch (e) {}
    try { return _sg.apply(this, arguments); } finally { SIM.homeAdv = keep; }
  }; }
{ const _sa = scrArena;
  scrArena = function () {
    const node = _sa.apply(this, arguments);
    try { const t = UI.save.teams[us(UI.save)], inv = arenaInvest(t);
      const bar = node.querySelector('.bar');
      const line = h('div', { class: 'hkarena', title: 'Every dollar spent on the building helps: up to +8% attendance, and a home edge in simulated games.' },
        'CROWD BOOST +' + (arenaAttBonus(t) * 100).toFixed(1) + '% · HOME EDGE +' + (arenaEdge(t) * 100).toFixed(1) + '% · INVESTED ' + fmtM(inv));
      if (bar) bar.appendChild(line); else node.insertBefore(line, node.firstChild);
    } catch (e) {}
    return node;
  }; }

// ---------- G. challenge runs
const RUNS = {
  none: { name: 'STANDARD', desc: 'The normal game.' },
  expansion: { name: 'EXPANSION', desc: 'Your first two Inaugural Draft picks are league leftovers: you start with the thinnest roster.' },
  nofa: { name: 'NO FREE AGENTS', desc: 'Build through the draft and trades only. Free agents won\'t sign with you.' },
  cap: { name: 'HARD CAP $14M', desc: 'Your signings and renewals can\'t take your payroll past $14M (everyone else keeps the $16M soft cap). Over it? Trade or release first.' },
};
const RUN_CAP = 14000;
const runOf = save => (save && save.run) || 'none';
{ const _nf = newFranchise;
  newFranchise = function (opts) {
    const run = UI.nf && UI.nf.run && UI.nf.run !== 'none' ? UI.nf.run : null;
    const save = _nf.apply(this, arguments);
    save.phase = { on: true, open: {} };
    if (run) { save.run = run; pushNews(save, `CHALLENGE RUN: ${RUNS[run].name}. ${RUNS[run].desc}`); }
    return save;
  }; }
{ const _ns = scrNewFranchise;
  scrNewFranchise = function () {
    const node = _ns.apply(this, arguments);
    try {
      const nf = UI.nf; nf.run = nf.run || 'none';
      const row = h('div', { class: 'row nfrun', style: { justifyContent: 'flex-start', alignItems: 'center', gap: '6px', margin: '6px 0 0', flexWrap: 'wrap' } },
        h('span', { class: 'sub', style: { margin: 0 } }, 'CHALLENGE RUN'),
        Object.entries(RUNS).map(([k, r]) => h('button', { class: 'small' + (nf.run === k ? ' sel' : ''), title: r.desc, 'data-help': r.desc, onclick: () => { nf.run = k; go(scrNewFranchise); } }, r.name)),
        h('span', { class: 'muted', style: { fontSize: '7px' } }, RUNS[nf.run].desc));
      const panel = node.querySelector('.panel'); if (panel) panel.insertBefore(row, panel.children[1] || null);
    } catch (e) { console.error(e); }
    return node;
  }; }
{ const _d0 = draft0SimToUser;
  draft0SimToUser = function (save) {
    let n = _d0.apply(this, arguments);
    const d = save.draft0;
    for (let guard = 0; guard < 4 && runOf(save) === 'expansion' && d && !d.done && d.phase === 'main' && d.round < 2 && d0Team(d) === us(save); guard++) {
      const pid = d.pool.map(id => P(save, id)).filter(p => p && !d0Legal(save, us(save), p.id)).sort((a, b) => overall(a) - overall(b))[0];
      if (!pid) break;
      const rnd = d.round + 1;
      draft0Pick(save, pid.id, us(save)); pushNews(save, `EXPANSION: the league hands the ${save.teams[us(save)].nick} ${pid.first} ${pid.last} with their round ${rnd} pick.`);
      n += 1 + _d0.apply(this, arguments);
    }
    return n;
  }; }
{ const _ofa = offerFreeAgent;
  offerFreeAgent = function (save, p, offer) {
    if (runOf(save) === 'nofa') return { result: 'reject', msg: 'NO FREE AGENTS run: build through the draft and trades.' };
    if (runOf(save) === 'cap' && payroll(save, save.teams[us(save)]) + (offer && offer.sal || 0) > RUN_CAP) return { result: 'reject', msg: `HARD CAP run: that would take your payroll past ${fmtM(RUN_CAP)}.` };
    return _ofa.apply(this, arguments);
  }; }
{ const _ore = offerRenewal;
  offerRenewal = function (save, p, offer) {
    if (runOf(save) === 'cap' && payroll(save, save.teams[us(save)]) - salOf(p) + (offer && offer.sal || 0) > RUN_CAP) return { result: 'reject', msg: `HARD CAP run: that would take your payroll past ${fmtM(RUN_CAP)}.` };
    return _ore.apply(this, arguments);
  }; }
// three achievements for finishing a run with a title (no cosmetics: the banner is the reward)
for (const [id, run, name] of [['run_exp', 'expansion', 'From Nothing'], ['run_nofa', 'nofa', 'Home Grown'], ['run_cap', 'cap', 'Moneyball']]) {
  const a = { id, name, cat: 'Challenge Runs', desc: `Win the League Championship in a ${RUNS[run].name} run.`, on: 'comp', test: s => runOf(s) === run && userTitles(s, 'league').length >= 1 };
  if (!ACH_BY_ID[id]) { ACHIEVEMENTS.push(a); ACH_BY_ID[id] = a; }
}
