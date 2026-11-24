'use strict';
// ====================================================================
//  ROSTER FLEXIBILITY: the farm team, injured reserve, call-ups and send-downs, releases with a buyout, and emergency
//  call-ups on game day. (The data lives on each team: team.farm, team.ir, team.calls, team.dead; FARM in league.js.)
//   - FARM TEAM: up to 6 players off the main roster. They don't dress, their contracts count, they develop at 60%.
//   - CALL-UPS: three a week (send-downs are free). A veteran who gets sent down sulks for a while.
//   - INJURED RESERVE: a player out 5+ games can go on IR (up to 3); his roster spot opens. When he's healthy he comes
//     straight back if there's room (otherwise he waits on IR, ready, until you make room).
//   - RELEASE: a player under contract can be bought out (1/3 of what's left under 26, 2/3 from 26), charged over the next
//     regular season's games (it counts against the cap for that season); no contract = free.
//   - EMERGENCY CALL-UP: short of healthy skaters or a goalie on game day, the best farm player at the spot dresses for
//     that game (it doesn't use a weekly call-up).
//   - COMPUTER CLUBS manage theirs the same way (IR for long injuries, call-ups into open spots, the weakest down).
// ====================================================================
const BUYOUT = 2 / 3;

// ---------- money: the whole club's contracts + this season's buyouts
const deadCapNow = t => (t.dead || []).filter(d => d.left > 0).reduce((a, d) => a + d.amt, 0);
payroll = function (save, team) { return orgIds(team).reduce((a, id) => a + salOf(P(save, id)), 0) + deadCapNow(team); };
function deadTick(t) { if (!t.dead) return; for (const d of t.dead) d.left--; t.dead = t.dead.filter(d => d.left > 0); }

// ---------- the week (for the call-up limit)
const farmWeek = save => Math.floor(((save.season && save.season.dayNo) || 0) / 7) + (save.off ? 1000 : 0);
function callsLeft(save, t) {
  const w = farmWeek(save), s = save.seasonNum;
  if (!t.calls || t.calls.w !== w || t.calls.s !== s) t.calls = { w, s, n: 0 };
  return Math.max(0, FARM.callsPerWeek - t.calls.n);
}
const onFarm = (t, pid) => farmIds(t).includes(pid);
const onIR = (t, pid) => irIds(t).includes(pid);
// keeps the dressed group legal after someone leaves the main roster
function tidyRoster(save, t) { fillLinesFromReserves(t.roster); compactGoalies(t.roster); }
function mainCount(t) { return { S: rosterSkaters(t).length, G: rosterGoalies(t).length }; }

// ---------- send a player down (main roster -> farm)
function sendDown(save, t, pid, o = {}) {
  const p = P(save, pid); if (!p || p.teamId !== t.id) return 'He is not with your club.';
  if (!rosterIds(t).includes(pid)) return 'He is not on the main roster.';
  if (farmRoom(t) <= 0) return `The farm team is full (${FARM.size}). Call someone up, release or trade someone first.`;
  const m = mainCount(t);
  if (!o.force && (p.pos === 'G' ? m.G <= 2 : m.S <= 9)) return p.pos === 'G' ? 'Keep at least 2 keepers on the main roster.' : 'Keep at least 9 players on the main roster.';
  removeFromRoster(t, pid); (t.farm = t.farm || []).push(pid); tidyRoster(save, t);
  // a veteran (or one of your better players) doesn't take it well
  const sorted = rosterIds(t).map(id => P(save, id)).filter(q => q.pos === p.pos).map(overall).sort((a, b) => b - a);
  const good = sorted.length && overall(p) >= sorted[Math.floor(sorted.length / 2)];
  if ((p.age >= FARM.vetAge || good) && typeof moraleOf === 'function') moraleOf(p).fx.push({ label: 'Sent down to the farm', v: p.age >= 30 ? -12 : -8, d: typeof mDay === 'function' ? mDay(save) : 0, len: 20 });
  if (!o.quiet && t.id === save.userTeamId) pushNews(save, `#${p.num} ${p.first} ${p.last} sent down to the farm team.`);
  if (!o.quiet) logTx(save, 'down', { pid, teamId: t.id });
  return null;
}
// ---------- call a player up (farm or IR -> main roster); swapPid = who goes down to make room
function callUp(save, t, pid, swapPid, o = {}) {
  const p = P(save, pid); if (!p || p.teamId !== t.id) return 'He is not with your club.';
  const fromIR = onIR(t, pid);
  if (!fromIR && !onFarm(t, pid)) return 'He is not on the farm team.';
  if (fromIR && p.inj && p.inj.g > 0) return `He is still injured (${p.inj.g} more game${p.inj.g === 1 ? '' : 's'}).`;
  if (!fromIR && !o.emergency && callsLeft(save, t) <= 0) return `You have used your ${FARM.callsPerWeek} call-ups this week (send-downs are free). Next week: ${FARM.callsPerWeek} more.`;
  if (rosterFull(t, p.pos)) {
    if (!swapPid) return `The main roster is full at ${p.pos === 'G' ? 'keeper' : 'outfield player'}: choose who goes down.`;
    const q = P(save, swapPid); if (!q || !rosterIds(t).includes(swapPid) || (q.pos === 'G') !== (p.pos === 'G')) return 'Choose a player in the same group (player or keeper) to send down.';
    // he leaves his spot first, so the farm always has room for the man going down
    removeFromRoster(t, pid);
    const err = sendDown(save, t, swapPid, { force: true, quiet: o.quiet });
    if (err) { (fromIR ? (t.ir = t.ir || []) : (t.farm = t.farm || [])).push(pid); return err; }
  } else removeFromRoster(t, pid);
  addToRoster(save, t, pid); tidyRoster(save, t);
  if (!fromIR && !o.emergency) { callsLeft(save, t); t.calls.n++; }
  if (!o.quiet && t.id === save.userTeamId) pushNews(save, fromIR ? `#${p.num} ${p.first} ${p.last} is back from injured reserve.` : `#${p.num} ${p.first} ${p.last} called up from the farm team.`);
  if (!o.quiet) logTx(save, fromIR ? 'offir' : 'up', { pid, teamId: t.id });
  return null;
}
// ---------- injured reserve
function toIR(save, t, pid, o = {}) {
  const p = P(save, pid); if (!p || p.teamId !== t.id) return 'He is not with your club.';
  if (!(p.inj && p.inj.g >= FARM.irMin)) return `Only a player out ${FARM.irMin}+ games can go on injured reserve.`;
  if (irIds(t).length >= FARM.irMax) return `Injured reserve is full (${FARM.irMax}).`;
  if (onIR(t, pid)) return 'He is already on injured reserve.';
  removeFromRoster(t, pid); (t.ir = t.ir || []).push(pid); tidyRoster(save, t);
  if (!o.quiet && t.id === save.userTeamId) pushNews(save, `#${p.num} ${p.first} ${p.last} placed on injured reserve (${p.inj.g} games). His roster spot is open.`);
  if (!o.quiet) logTx(save, 'ir', { pid, teamId: t.id });
  return null;
}
// ---------- release (with a buyout for a player under contract)
// like the real thing: a player under 26 is bought out for 1/3 of what's left, an older one for 2/3
const buyoutRate = p => p.age < 26 ? 1 / 3 : BUYOUT;
function buyoutCost(p) { const c = p && p.contract; if (!c || !(c.sal > 0)) return 0; return Math.round(c.sal * Math.max(1, c.yrs || 1) * buyoutRate(p)); }
function releaseWithBuyout(save, t, pid) {
  const p = P(save, pid); if (!p || p.teamId !== t.id) return 'He is not with your club.';
  if (p.pos === 'G' ? rosterGoalies(t).length + farmIds(t).filter(id => P(save, id).pos === 'G').length <= 2 && rosterIds(t).includes(pid) : false) return 'You need at least 2 keepers.';
  const cost = buyoutCost(p);
  if (cost) (t.dead = t.dead || []).push({ amt: cost, left: FIN.regGames, pid, name: p.first + ' ' + p.last });
  releasePlayer(save, pid); tidyRoster(save, t);
  if (t.id === save.userTeamId) pushNews(save, `Released #${p.num} ${p.first} ${p.last}` + (cost ? ` (buyout ${fmtM(cost)}, on the cap for the next ${FIN.regGames} games).` : '.'));
  return null;
}

// ---------- after every game: IR returns, computer clubs' moves
function farmAfterGame(save, t) {
  const user = t.id === save.userTeamId;
  // healthy players on IR come back if there's room (yours wait, ready, if there isn't)
  for (const pid of irIds(t)) { const p = P(save, pid); if (p.inj && p.inj.g > 0) continue;
    if (!rosterFull(t, p.pos)) callUp(save, t, pid, null, { quiet: !user });
    else if (!user) { const worst = (p.pos === 'G' ? rosterGoalies(t) : rosterSkaters(t)).map(id => P(save, id)).sort((a, b) => overall(a) - overall(b))[0];
      if (worst && overall(worst) < overall(p) && farmRoom(t) > 0) callUp(save, t, pid, worst.id, { quiet: true }); else { removeFromRoster(t, pid); if (farmRoom(t) > 0) t.farm.push(pid); else releasePlayer(save, pid); } }
    else if (!t.irReadyNote || t.irReadyNote !== pid + ':' + save.season.dayNo) { t.irReadyNote = pid + ':' + save.season.dayNo; pushNews(save, `#${p.num} ${p.last} is healthy and ready to come off injured reserve: make room on the main roster (ROSTER > FARM & IR).`); }
  }
  if (user) return;
  aiFarmManage(save, t);
}
function aiFarmManage(save, t) {
  // long injuries go on IR
  for (const pid of rosterIds(t)) { const p = P(save, pid); if (p.inj && p.inj.g >= FARM.irMin && irIds(t).length < FARM.irMax) toIR(save, t, pid, { quiet: true }); }
  // open spots: the best farm player at that spot comes up
  for (const pos of ['S', 'G']) {
    const isG = pos === 'G';
    while ((isG ? rosterGoalies(t).length < 3 : rosterSkaters(t).length < 12)) {
      const c = farmIds(t).map(id => P(save, id)).filter(q => (q.pos === 'G') === isG && !(q.inj && q.inj.g > 0)).sort((a, b) => overall(b) - overall(a))[0];
      if (!c || callUp(save, t, c.id, null, { quiet: true, emergency: true })) break;
    }
    // nobody on the farm to fill it: a depth signing
    for (let k = 0; k < 3 && (isG ? rosterGoalies(t).length < 2 : rosterSkaters(t).length < 12); k++) signDepth(save, t, isG ? 'G' : 'S');
  }
  // a much better player stuck on the farm swaps with the weakest at his spot
  const fb = farmIds(t).map(id => P(save, id)).filter(q => !(q.inj && q.inj.g > 0)).sort((a, b) => overall(b) - overall(a))[0];
  if (fb) { const worst = (fb.pos === 'G' ? rosterGoalies(t) : rosterSkaters(t)).map(id => P(save, id)).sort((a, b) => overall(a) - overall(b))[0];
    if (worst && overall(fb) > overall(worst) + 0.4 && callsLeft(save, t) > 0) callUp(save, t, fb.id, worst.id, { quiet: true }); }
  if (typeof autoArrange === 'function') autoArrange(save, t);
}
{ const _up = upkeepAfterGame;
  upkeepAfterGame = function (save, g, res) { const r = _up.apply(this, arguments); for (const tid of [g.home, g.away]) if (save.teams[tid]) farmAfterGame(save, save.teams[tid]); return r; }; }

// ---------- game day: emergency call-ups (this game only)
{ const _lu = lineupFor;
  lineupFor = function (save, teamId, goalieId) {
    const lu = _lu.apply(this, arguments), t = save.teams[teamId]; if (!t || !farmIds(t).length) return lu;
    const ok = q => q && isAvailable(q);
    const farmS = farmIds(t).map(id => P(save, id)).filter(q => ok(q) && q.pos !== 'G').sort((a, b) => overall(b) - overall(a));
    const used = new Set(), seen = new Set(), called = [];
    // a hole in a line, or a player double-shifting, gets a farm player instead
    lu.lines = lu.lines.map(l => l.map((q, j) => {
      if (q && !seen.has(q.id)) { seen.add(q.id); return q; }
      let bi = -1, bs = -1e9; farmS.forEach((c, i) => { if (used.has(c.id)) return; const sc = slotFit(c, j); if (sc > bs) { bs = sc; bi = i; } });
      if (bi < 0) return q; const c = farmS[bi]; used.add(c.id); called.push(c); return c;
    }));
    if (!lu.goalie || !ok(lu.goalie)) { const g = farmIds(t).map(id => P(save, id)).filter(q => ok(q) && q.pos === 'G').sort((a, b) => overall(b) - overall(a))[0]; if (g) { lu.goalie = g; called.push(g); } }
    if (called.length) {
      lu.dressed = new Set(lu.lines.flat().filter(Boolean).map(q => q.id)).size + lu.bench.length; lu.emergency = called.map(q => q.id);
      const se = save.season, key = teamId + ':' + (se ? se.dayNo : 0); se.emergN = se.emergN || {};
      if (!se.emergN[key] && teamId === save.userTeamId) { se.emergN[key] = 1; pushNews(save, `Emergency call-up: ${called.map(q => '#' + q.num + ' ' + q.last).join(', ')} dress${called.length === 1 ? 'es' : ''} from the farm team tonight.`); }
    }
    return lu;
  }; }

// ---------- farm players develop (more slowly) every game day
{ const _dd = devDay;
  devDay = function (save) {
    const r = _dd.apply(this, arguments), se = save.season; if (!se || se.done) return r;
    for (const id of save.teamOrder) { const t = save.teams[id];
      for (const pid of farmIds(t)) { const p = P(save, pid); if (!p || p.inj || typeof devOf !== 'function') continue;
        const D0 = devOf(p), pc = typeof pastCeiling === 'function' ? pastCeiling(p) : 0;
        D0.gen += DEV.general * DEV.age(p.age) * FARM.devMul * (id !== save.userTeamId ? DEV.ai : 1) * (pc >= DEV.overCap ? 0 : pc > 0 ? DEV.overMul : 1);
        if (typeof devSettle === 'function') devSettle(save, t, p); } }
    return r;
  }; }

// ====================================================================
//  UI: ROSTER > FARM & IR   (main roster | farm team | injured reserve), every move explained before it happens
// ====================================================================
function farmTab(save, team, rerender) {
  const Pq = id => P(save, id), fit = p => p.pos === 'G' ? 'G' : posShort(p.spos);
  const act = (fn, ok) => { const err = fn(); if (err) toast(err); else { if (ok) toast(ok); Store.autosave(save); rerender(); } };
  const injTag = p => p.inj && p.inj.g > 0 ? h('span', { class: 'red', 'data-help': `Injured: ${p.inj.kind || 'injury'}, out ${p.inj.g} game${p.inj.g === 1 ? '' : 's'}.` }, ` INJ ${p.inj.g}g`) : null;
  const row = (p, btns, extra) => h('div', { class: 'frow' }, portrait(p, team, 20),
    h('div', { class: 'fname' }, h('b', null, '#' + p.num + ' ' + p.last.toUpperCase()), h('span', { class: 'muted' }, ` ${fit(p)} · ${p.age}y · `), h('span', { class: 'gold' }, 'OVR ' + ovrInt(p)), injTag(p), extra || null),
    h('span', { class: 'fbtns' }, btns));
  // calling up into a full roster: pick who goes down (same group), with the reasons on the screen
  const callUpDlg = p => {
    if (!rosterFull(team, p.pos)) return act(() => callUp(save, team, p.id), `${p.last} called up.`);
    const pool = (p.pos === 'G' ? rosterGoalies(team) : rosterSkaters(team)).map(Pq).sort((a, b) => overall(a) - overall(b));
    modal(close => h('div', null, h('h2', { style: { marginTop: 0 } }, `CALL UP ${p.last.toUpperCase()}`),
      h('div', { class: 'sub' }, `The main roster is full at ${p.pos === 'G' ? 'keeper' : 'outfield player'}. Pick who goes down to the farm (weakest first). A veteran sent down will be unhappy for a while.`),
      h('div', { class: 'fpick' }, pool.slice(0, 8).map(q => h('button', { class: 'small', onclick: () => { close(); act(() => callUp(save, team, p.id, q.id), `${p.last} up, ${q.last} down.`); } },
        `#${q.num} ${q.last} · ${fit(q)} · OVR ${ovrInt(q)}` + (q.age >= FARM.vetAge ? ' · VET' : '')))),
      h('div', { class: 'row' }, h('button', { onclick: close }, 'CANCEL'))));
  };
  const relBtn = p => releaseBtn(save, team, p, rerender);
  const main = rosterIds(team).map(Pq).sort((a, b) => (a.pos === 'G') - (b.pos === 'G') || overall(b) - overall(a));
  const farm = farmIds(team).map(Pq).sort((a, b) => overall(b) - overall(a)), ir = irIds(team).map(Pq);
  const left = callsLeft(save, team);
  const colMain = h('div', { class: 'panel fcol' }, h('h3', null, `MAIN ROSTER ${rosterSkaters(team).length}/12 · ${rosterGoalies(team).length}/3`),
    pages('farmmain', main, UI.farmRows || 8, sl => h('div', null, sl.map(p => row(p, [
      h('button', { class: 'small', disabled: farmRoom(team) <= 0, 'data-help': 'SEND DOWN to the farm team (free, no limit). He keeps developing there, more slowly.', onclick: () => act(() => sendDown(save, team, p.id)) }, '↓ FARM'),
      p.inj && p.inj.g >= FARM.irMin ? h('button', { class: 'small', 'data-help': `INJURED RESERVE: he is out ${p.inj.g} games. On IR his roster spot opens; he comes back when healthy.`, onclick: () => act(() => toIR(save, team, p.id)) }, 'IR') : null])))));
  const colFarm = h('div', { class: 'panel fcol' }, h('h3', null, `FARM TEAM ${farm.length}/${FARM.size}`),
    h('div', { class: 'sub', style: { margin: '0 0 4px' } }, `${left} of ${FARM.callsPerWeek} call-ups left this week · send-downs are free · farm players develop at ${Math.round(FARM.devMul * 100)}% and dress in an emergency.`),
    farm.length ? pages('farmfarm', farm, UI.farmRows || 8, sl => h('div', null, sl.map(p => row(p, [
      h('button', { class: 'small primary', disabled: left <= 0 || (p.inj && p.inj.g > 0), 'data-help': 'CALL UP to the main roster (uses one of this week\'s call-ups).', onclick: () => callUpDlg(p) }, '↑ UP'), relBtn(p)]))))
      : h('div', { class: 'muted' }, 'Empty. Send players down from the main roster; draft picks and signings go here when the roster is full.'));
  const colIR = h('div', { class: 'panel fcol' }, h('h3', null, `INJURED RESERVE ${ir.length}/${FARM.irMax}`),
    h('div', { class: 'sub', style: { margin: '0 0 4px' } }, `For players out ${FARM.irMin}+ games: their spot opens for a call-up or a signing.`),
    ir.length ? h('div', null, ir.map(p => row(p, [(p.inj && p.inj.g > 0) ? h('span', { class: 'muted' }, 'healing') : h('button', { class: 'small primary', onclick: () => callUpDlg(p) }, '↑ BACK')]))) : h('div', { class: 'muted' }, 'Nobody on IR.'),
    (team.dead || []).length ? h('div', { style: { marginTop: '8px' } }, h('div', { class: 'gold sub' }, 'BUYOUTS ON THE CAP'), team.dead.map(d => h('div', { class: 'sub' }, `${d.name}: ${fmtM(d.amt)} · ${d.left} games left`))) : null);
  const node = h('div', { class: 'fgrid' }, colMain, colFarm, colIR);
  // big text: fewer rows per page until nothing scrolls
  setTimeout(() => { const a = document.getElementById('app'); if (!a || !node.isConnected) return;
    if (a.scrollHeight > a.clientHeight + 1 && (UI.farmRows || 8) > 3) { UI.farmRows = (UI.farmRows || 8) - 1; rerender(); } }, 0);
  return node;
}

// RELEASE with the buyout spelled out first (used on the farm list and the contracts table)
function releaseBtn(save, team, p, rerender) {
  const c = buyoutCost(p);
  return h('button', { class: 'small ghost', 'data-help': c ? `RELEASE: buy out his contract for ${fmtM(c)} (${p.age < 26 ? '1/3' : '2/3'} of what's left: ${p.age < 26 ? 'under 26' : '26 or older'}), charged over the next ${FIN.regGames} games and counted against the cap.` : 'RELEASE: no contract left, no cost.',
    onclick: () => confirmDlg(`Release #${p.num} ${p.first} ${p.last}?` + (c ? ` The buyout costs ${fmtM(c)}, paid over the next ${FIN.regGames} games and counted against your cap.` : ' He has no contract left, so it costs nothing.') + ' He becomes a free agent.',
      'RELEASE', () => { const err = releaseWithBuyout(save, team, p.id); if (err) toast(err); else { Store.autosave(save); rerender(); } }, true) }, 'RELEASE');
}

// ---------- computer clubs tidy their farm before each new season: no dead weight, at most 2 kept (prospects first)
function aiFarmPrune(save, t) {
  const main = id => P(save, id), worstAt = isG => Math.min(...(isG ? rosterGoalies(t) : rosterSkaters(t)).map(id => overall(main(id))), 99);
  for (const pid of farmIds(t).slice()) { const p = main(pid);
    const prospect = p.age <= 23 && (p.pot || 0) > overall(p) + 0.5;
    if (!prospect && overall(p) < worstAt(p.pos === 'G') - 0.3) releaseWithBuyout(save, t, pid); }
  const keep = farmIds(t).map(main).sort((a, b) => ((b.age <= 23) - (a.age <= 23)) || ((b.pot || 0) - (a.pot || 0)));
  for (const p of keep.slice(2)) releaseWithBuyout(save, t, p.id);
}
{ const _ns = startNextSeason;
  startNextSeason = function (save) {
    for (const id of save.teamOrder) if (id !== save.userTeamId) aiFarmPrune(save, save.teams[id]);
    return _ns.apply(this, arguments);
  }; }
