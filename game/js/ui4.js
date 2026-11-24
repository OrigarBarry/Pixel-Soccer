'use strict';
// ====================================================================
//  UI 4: FRONT OFFICE — finances, contracts & negotiation (GM advisor), free agency, trades, offseason steps
// ====================================================================
const salLine = p => p.contract ? p.contract.yrs <= 0 ? `${fmtM(p.contract.sal)} (expiring)` : `${fmtM(p.contract.sal)} × ${p.contract.yrs} yr${p.contract.yrs > 1 ? 's' : ''}${p.contract.ext ? ' (+ext ' + fmtM(p.contract.ext.sal) + '×' + p.contract.ext.yrs + ')' : ''}` : 'no contract';
function capBar(save, team, extra = 0) {
  const pay = payroll(save, team) + extra, pct = Math.min(130, pay / FIN.cap * 100);
  return h('div', { style: { margin: '6px 0' } },
    h('div', { style: { position: 'relative', height: '12px', background: '#20263f', border: '1px solid #3b4583' } },
      h('div', { style: { position: 'absolute', left: 0, top: 0, bottom: 0, width: Math.min(100, pct / 1.3) + '%', background: pay > FIN.cap ? '#ff6a4a' : pay > FIN.cap * 0.92 ? '#ffd23f' : '#5ee07a' } }),
      h('div', { style: { position: 'absolute', left: (100 / 1.3) + '%', top: '-3px', bottom: '-3px', width: '2px', background: '#ffffff' } })),
    h('div', { class: 'muted', style: { fontSize: '7px', marginTop: '3px' } }, `Payroll ${fmtM(pay)} · soft cap ${fmtM(FIN.cap)} · ${pay > FIN.cap ? 'OVER by ' + fmtM(pay - FIN.cap) + ' → penalty ' + fmtM(capTax(pay)) : 'room ' + fmtM(FIN.cap - pay)}`));
}

// ---------- FINANCES dashboard
function scrFinances() {
  const save = UI.save, team = T(save.userTeamId), f = finOf(team), last = f.hist[f.hist.length - 1];
  const rev = Object.keys(REV_KEYS).reduce((a, k) => a + (f.cur[k] || 0), 0), exp = Object.keys(EXP_KEYS).reduce((a, k) => a + (f.cur[k] || 0), 0);
  const pay = payroll(save, team), se = save.season;
  const played = Object.values(se.games).filter(g => g.type === 'reg' && g.played && (g.home === team.id || g.away === team.id)).length;
  const proj = played ? Math.round(f.cash + (rev - exp) / played * Math.max(0, FIN.regGames - played) - capTax(pay)) : f.cash + Math.round(FIN.tv + FIN.sponsBase * popMul(team) + FIN.merchBase * popMul(team) + 12 * attendance(save, team) * FIN.ticket - pay - FIN.ops - capTax(pay));
  const row = (lab, v, cls) => h('tr', null, h('td', { class: 'l' }, lab), h('td', { class: cls || '' }, fmtM(v)));
  return h('div', { class: 'screen financeS' }, header('FINANCES: ' + fullName(team).toUpperCase(), () => go(scrHub)),
    h('div', { class: 'grid g3' },
      h('div', { class: 'panel' }, h('div', { class: 'sub', style: { margin: 0 } }, 'FUNDS AVAILABLE'), h('div', { class: 'big ' + (f.cash < 0 ? 'red' : 'gold') }, fmtM(f.cash)), h('div', { class: 'muted', style: { fontSize: '7px' } }, 'Unspent funds carry over between seasons.')),
      h('div', { class: 'panel' }, h('div', { class: 'sub', style: { margin: 0 } }, 'PAYROLL & SALARY CAP'), h('div', { class: 'big' }, fmtM(pay)), capBar(save, team)),
      h('div', { class: 'panel' }, h('div', { class: 'sub', style: { margin: 0 } }, 'FANS'), h('div', { class: 'big' }, Math.round(f.pop) + ' / 100'), h('div', { class: 'muted', style: { fontSize: '7px' } }, `Popularity · last home crowd ${(f.att || attendance(save, team)).toLocaleString()} of ${FIN.capacity.toLocaleString()}`))),
    tabbed('fin', [
      { label: 'THIS SEASON', el: () => h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'THIS SEASON SO FAR'),
        h('div', { class: 'grid g2' },
          h('table', { class: 'tight' }, h('tr', null, h('th', { class: 'l' }, 'REVENUE'), h('th', null, '')), Object.entries(REV_KEYS).map(([k, n]) => row(n, f.cur[k] || 0, 'green')), row('Total revenue', rev, 'gold')),
          h('table', { class: 'tight' }, h('tr', null, h('th', { class: 'l' }, 'EXPENSES'), h('th', null, '')), Object.entries(EXP_KEYS).map(([k, n]) => row(n, f.cur[k] || 0, 'red')), row('Total expenses', exp, 'gold'), row('Net', rev - exp, rev >= exp ? 'green' : 'red')))) },
      { label: 'HOW MONEY WORKS', el: () => moneyHowPanel() },
      { label: 'OUTLOOK', el: () => h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'OUTLOOK'),
        h('div', { class: 'sub' }, `Projected funds at season end: `, h('b', { class: proj < 0 ? 'red' : 'gold' }, fmtM(proj)), ` (includes a cap penalty of ${fmtM(capTax(pay))}; tournament and playoff money comes on top).`),
        h('h3', null, 'GM RECOMMENDATIONS'), finRecommendations(save, team).map(t => h('div', { class: 'sub', style: { margin: '4px 0' } }, '• ' + t)),
        last ? h('div', null, h('h3', null, 'LAST SEASON'), h('div', { class: 'sub' }, `Start ${fmtM(last.start)} · revenue ${fmtM(last.rev)} · expenses ${fmtM(last.exp)} · end ${fmtM(last.end)}`), h('div', { class: 'sub' }, finAssessment(last))) : null) },
      { label: 'SPENDING GUIDE', el: () => moneyGuidePanel(save, team) },
      f.hist.length ? { label: 'HISTORY', el: () => h('div', { class: 'panel' }, h('table', null, h('tr', null, ['SEASON', 'REVENUE', 'EXPENSES', 'PAYROLL', 'CAP PENALTY', 'FUNDS', 'FANS'].map(x => h('th', null, x))),
      f.hist.slice().reverse().slice(0, 12).map(r => h('tr', null, h('td', null, r.s), h('td', null, fmtM(r.rev)), h('td', null, fmtM(r.exp)), h('td', null, fmtM(r.pay)), h('td', { class: r.tax ? 'red' : '' }, fmtM(r.tax)), h('td', { class: r.end < 0 ? 'red' : '' }, fmtM(r.end)), h('td', null, r.pop))))) } : null]),
    null);   // (the links to Contracts, Trades, Free agents, Arena and Trophy rooms were second doors: each lives in the hub)
}


// ---------- money clarity: what the club earns per season and what the funds can buy
function renewAdvice(save, t, p) {
  const sk = rosterSkaters(t).map(id => P(save, id)), med = sk.map(overall).sort((a, b) => a - b)[Math.floor(sk.length / 2)] || 5;
  const ask = askFor(save, p, t, prefYears(p)), valued = (p.pos === 'G' ? overall(p) >= 4.5 : overall(p) >= med - 0.3) && p.age <= 34;
  const fits = payroll(save, t) - salOf(p) + ask <= FIN.cap + 300;
  if (!valued) return h('span', { class: 'muted' }, 'GM: replaceable, let him go unless he is cheap.');
  if (!fits) return h('span', { class: 'red' }, 'GM: worth keeping, but his ask takes you over the cap.');
  if (ask > worth(p) * 1.25) return h('span', { class: 'gold' }, 'GM: keep him, but bargain: his ask is above his value.');
  return h('span', { class: 'green' }, 'GM: re-sign him.');
}
function avgProfit(team) {
  const hs = finOf(team).hist.slice(-3);
  return hs.length ? Math.round(hs.reduce((a, r) => a + (r.end - r.start), 0) / hs.length) : 0;
}
function shoppingList(save, team) {
  const out = [];
  for (const k of Object.keys(ARENA_PRICES)) for (const [v, price] of Object.entries(ARENA_PRICES[k])) {
    if (!price || arenaHas(team, k, v)) continue;
    const lock = (typeof ARENA_LOCK !== 'undefined' && ARENA_LOCK[v] && !hasCosmetic(ARENA_LOCK[v])) || (k === 'venue' && v === 'palace' && !arenaHas(team, 'venue', 'modern'));
    out.push({ where: 'ARENA', name: (ARENA_OPTS[k] || {})[v] || v, price, lock, go: scrArena });
  }
  for (const r of unlockedRooms(save)) {
    const own = roomState(team, r).owned;
    for (const k of ['finish', 'light', 'furn', 'arr']) for (const [v, price] of Object.entries(k === 'finish' ? ROOM_DECOR.finish[r] : ROOM_DECOR[k])) {
      if (!price || dbgFree() || own.includes(k + ':' + v)) continue;
      out.push({ where: 'TROPHY ROOM', name: DECOR_NAMES[v] + ' (' + ROOMS[r].name + ')', price, go: scrRooms });
    }
  }
  return out.sort((a, b) => a.price - b.price);
}
function moneyGuidePanel(save, team) {
  const f = finOf(team), avg = avgProfit(team), list = shoppingList(save, team);
  const est = Math.max(avg, 1000), when = it => it.lock ? h('span', { class: 'muted' }, '\uE001 locked') : it.price <= f.cash ? h('span', { class: 'green' }, 'IN REACH') : h('span', { class: 'muted' }, '~' + Math.max(1, Math.ceil((it.price - f.cash) / est)) + ' season' + (Math.ceil((it.price - f.cash) / est) > 1 ? 's' : '') + ' away');
  const pick = [...list.filter(i => !i.lock && i.price <= f.cash).slice(0, 3), ...list.filter(i => !i.lock && i.price > f.cash).slice(0, 2), ...list.filter(i => i.lock).slice(0, 1)];
  return h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'WHAT YOUR FUNDS CAN BUY'),
    h('div', { class: 'sub' }, avg ? `Your club has averaged ${avg >= 0 ? 'a profit of ' + fmtM(avg) : 'a loss of ' + fmtM(-avg)} per season recently.` : 'Most clubs clear about $1M a season; playoff runs earn far more.',
      ` Funds pay for arena upgrades and trophy-room decor. These are cosmetic and never change results on the pitch.`),
    list.length ? h('table', { class: 'tight' }, h('tr', null, h('th', { class: 'l' }, 'ITEM'), h('th', { class: 'l' }, 'WHERE'), h('th', null, 'PRICE'), h('th', null, '')),
      pick.map(it => h('tr', { class: 'click', onclick: () => go(it.go) }, h('td', { class: 'l', style: { whiteSpace: 'normal' } }, it.name), h('td', { class: 'l muted' }, it.where), h('td', { class: 'gold' }, fmtM(it.price)), h('td', { style: { whiteSpace: 'normal' } }, when(it))))) : h('div', { class: 'sub green' }, 'You own every upgrade on sale. Impressive.'),
    list.length ? h('div', { class: 'muted', style: { fontSize: '7px', marginTop: '6px' } }, `${list.length} items still on sale, worth ${fmtM(list.reduce((a, i) => a + i.price, 0))} in all.`) : null);
}
function moneyHowPanel() {
  const L = (b, t) => h('div', { class: 'sub', style: { margin: '5px 0' } }, h('b', { class: 'gold' }, b), ' ', t);
  return h('div', null, h('h3', null, 'HOW THE MONEY WORKS'),
    L('INCOME', 'TV share is fixed. Tickets, merchandise and sponsors grow with your fans, and fans grow with wins. Tournaments and playoff runs pay the most.'),
    L('SPENDING', `Salaries are the big cost. Payroll over the ${fmtM(FIN.cap)} soft cap is taxed at season end, at a rising rate.`),
    L('WHY IT MATTERS', 'Staying under the cap keeps profits flowing for arena and trophy-room upgrades. Your GM handles day-to-day costs: you only decide contracts.'));
}

// ---------- NEGOTIATION (modal) with the GM advisor
function negotiate(pid, mode, after) {
  const save = UI.save, p = Pl(pid), team = T(save.userTeamId);
  const yrs0 = prefYears(p), ask0 = askFor(save, p, team, yrs0);
  let offer = { sal: Math.round(Math.min(worth(p), ask0) / 10) * 10, yrs: yrs0 };
  const log = [];
  modal(close => {
    const box = h('div');
    const render = () => {
      box.innerHTML = '';
      const st = negState(save, p, team), adv = gmAdvice(save, p, team, offer);
      const salIn = h('input', { type: 'range', min: FIN.minSal, max: Math.max(FIN.minSal + 100, Math.min(FIN.maxSal, Math.round(ask0 * 1.8))), step: 10, value: offer.sal, style: { width: '100%' }, oninput: e => { offer.sal = +e.target.value; render(); } });
      box.append(...[
        h('div', { class: 'row', style: { justifyContent: 'flex-start', gap: '12px' } }, portrait(p, team, 48), h('div', null, h('h2', { style: { margin: 0 } }, (mode === 'fa' ? 'SIGN ' : mode === 'extend' ? 'EXTEND ' : 'RE-SIGN ') + p.first.toUpperCase() + ' ' + p.last.toUpperCase()),
          h('div', { class: 'sub', style: { margin: 0 } }, `${posLabel(p)} · age ${p.age} · OVR ${ovrInt(p)} · POT ${potTxt(p)} · ${p.contract ? 'current ' + salLine(p) : 'free agent'}`))),
        h('div', { class: 'negcols' }, h('div', null,
        h('div', { class: 'panel', style: { margin: '10px 0' } },
          h('div', { class: 'sub', style: { margin: '0 0 4px' } }, 'SALARY PER SEASON: ', h('b', { class: 'gold', style: { fontSize: '11px' } }, fmtM(offer.sal))), salIn,
          h('div', { class: 'row', style: { justifyContent: 'flex-start', marginTop: '8px' } }, h('span', { class: 'sub', style: { margin: 0 } }, 'YEARS: '), [1, 2, 3, 4].map(y => h('button', { class: 'small' + (offer.yrs === y ? ' sel' : ''), onclick: () => { offer.yrs = y; render(); } }, String(y)))),
          h('div', { class: 'sub', style: { marginTop: '8px' } }, 'PATIENCE ', '■'.repeat(Math.max(0, st.pat)) + '□'.repeat(Math.max(0, 5 - st.pat)), st.walked ? h('span', { class: 'red' }, '  — talks are over') : null)),
        log.length ? h('div', { class: 'panel' }, log.slice(-3).map(l => h('div', { class: 'sub ' + (l.cls || ''), style: { margin: '3px 0' } }, l.t))) : null,
        h('div', { class: 'row' },
          h('button', { class: 'primary', disabled: st.walked, onclick: () => {
            const r = mode === 'fa' ? offerFreeAgent(save, p, offer) : offerRenewal(save, p, offer);
            log.push({ t: (r.result === 'accept' ? '✔ ' : r.result === 'pending' ? '… ' : r.result === 'counter' ? '↺ ' : '✕ ') + r.msg, cls: r.result === 'accept' ? 'green' : r.result === 'walk' || r.result === 'reject' ? 'red' : 'gold' });
            if (r.result === 'counter') offer = Object.assign({}, r.counter);
            Store.autosave(save);
            if (r.result === 'accept') { toast(`${p.last} signed: ${fmtM(r.offer.sal)} × ${r.offer.yrs}.`); setTimeout(() => { close(); if (after) after(); }, 700); }
            if (r.result === 'pending') { setTimeout(() => { close(); if (after) after(); }, 1400); }
            render();
          } }, 'MAKE OFFER'),
          h('button', { onclick: () => { offer = { sal: adv.ask, yrs: offer.yrs }; render(); } }, 'MATCH HIS ASK (' + fmtM(adv.ask) + ')'),
          h('button', { onclick: () => { close(); if (after) after(); } }, 'CLOSE'))
        ), h('div', null, h('div', { class: 'panel', style: { borderColor: '#2f6fe8' } }, h('h3', { style: { marginTop: 0 } }, 'GM ADVISOR'),
          adv.lines.map(t => h('div', { class: 'sub', style: { margin: '3px 0' } }, '• ' + t)),
          h('div', { class: 'sub', style: { margin: '6px 0 0' } }, 'What drives him: ', Object.keys(PREF_KEYS).map(k => PREF_KEYS[k] + ' ' + '●'.repeat(prefOf(p)[k]) + '○'.repeat(5 - prefOf(p)[k])).join('  ·  '))))),
].filter(Boolean));
    };
    render();
    return box;
  }, true);
}

// ---------- CONTRACTS (your roster; renewals in the offseason, extensions in a final year)
// a player's motive and (for your own players) how happy he is
function motiveTag(save, p) {
  const M = motiveInfo(p), own = p.teamId === save.userTeamId, md = own ? moodOf(save, p) : null;
  return h('div', { class: 'mottag', title: M.desc + (md ? ` Mood ${md.v}/100: ${md.why}.` : '') }, h('span', { class: 'chip mot' }, M.name),
    md ? h('span', { class: 'moodbar' }, h('i', { style: { width: md.v + '%', background: md.v >= 60 ? '#5ee07a' : md.v >= 35 ? '#ffd23f' : '#ff6a4a' } })) : null);
}
// Wide layout: the contract table with salary bars and value verdicts on the left, the cap picture on the right.
function contractVerdict(p) {
  if (!p.contract) return h('span', { class: 'chip muted' }, '—');
  const r = p.contract.sal / Math.max(1, worth(p));
  return r > 1.3 ? h('span', { class: 'chip bad' }, 'OVERPAID') : r < 0.8 ? h('span', { class: 'chip good' }, 'BARGAIN') : h('span', { class: 'chip' }, 'FAIR');
}
const yearPips = (n, ext) => h('span', { class: 'pips' }, '■'.repeat(Math.max(0, n)), ext ? h('span', { class: 'gold' }, '■'.repeat(ext)) : null);
function scrContracts() {
  const save = UI.save, team = T(save.userTeamId), off = save.off;
  const expiring = off && off.phase === 'renew' ? (off.expiring[team.id] || []) : [];
  const body = h('div');
  const render = () => {
    body.innerHTML = '';
    const ids = orgIds(team).map(Pl).sort((a, b) => salOf(b) - salOf(a)), maxSal = Math.max(1, ...ids.map(salOf));
    const pay = payroll(save, team), nextYr = ids.filter(p => p.contract && (p.contract.yrs > 1 || p.contract.ext)).reduce((a, p) => a + (p.contract.yrs > 1 ? p.contract.sal : p.contract.ext.sal), 0);
    // left: the table
    const table = h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, `CLUB CONTRACTS (${ids.length})`),
      pages('contracts', ids, UI.conRows || 6, sl => h('div', { class: 'tblwrap' }, h('table', { class: 'ctable tight' }, h('tr', null, ['', 'PLAYER', 'POS', 'AGE', 'OVR', 'SALARY', 'YEARS', 'VALUE', ''].map((x, i) => h('th', { class: i <= 1 ? 'l' : '' }, x))),
        sl.map(p => h('tr', null,
          h('td', { class: 'l' }, portrait(p, team, 22)),
          h('td', { class: 'l click', onclick: () => profile(p.id) }, h('b', null, '#' + p.num + ' ' + pname(p)), p.block ? h('span', { class: 'muted' }, ' ⇄') : null, p.contract && p.contract.kind === 'rookie' ? h('span', { class: 'chip' }, 'ROOKIE') : null, farmIds(team).includes(p.id) ? h('span', { class: 'chip', 'data-help': 'On the farm team.' }, 'FARM') : null, irIds(team).includes(p.id) ? h('span', { class: 'chip', 'data-help': 'On injured reserve.' }, 'IR') : null, motiveTag(save, p)),
          h('td', null, posLabel(p)), h('td', null, p.age), h('td', { class: 'gold' }, ovrInt(p)),
          h('td', { style: { minWidth: '90px' } }, h('div', { class: 'salbar' }, h('i', { style: { width: (salOf(p) / maxSal * 100) + '%' } }), h('span', null, p.contract ? fmtM(p.contract.sal) : '—'))),
          h('td', null, p.contract ? yearPips(p.contract.yrs, p.contract.ext ? p.contract.ext.yrs : 0) : '—'),
          h('td', { 'data-help': 'Fair value for his ratings: ' + fmtM(worth(p)) + ' a season.' }, contractVerdict(p), (() => { const li = loyaltyInfo(save, p, team); return li.pct ? h('div', { class: 'chip loyal', title: loyaltyLine(li) }, (li.icon ? 'ICON ' : 'LOYAL ') + '-' + Math.round(li.pct * 100) + '%') : null; })()),
          h('td', null, h('span', { style: { display: 'inline-flex', gap: '3px' } }, canExtend(save, p) ? h('button', { class: 'small', onclick: () => negotiate(p.id, 'extend', render) }, 'EXTEND') : expiring.includes(p.id) ? h('span', { class: 'gold' }, 'EXPIRING') : null,
            typeof adDialog === 'function' && tradeOpen(save) ? (() => { const a = adOf(save, p.id), n = a ? a.offers.filter(o => o.status !== 'gone').length : 0;
              return h('button', { class: 'small' + (n ? ' primary' : ''), 'data-help': n ? `${n} offer${n > 1 ? 's' : ''} on the table for him.` : 'Shop him around the league: other GMs call with offers (and you can counter).', onclick: () => adDialog(p.id, render) }, n ? `📣 OFFERS (${n})` : 'ADVERTISE'); })() : null))))))),
      h('div', { class: 'hint' }, '■ = seasons left (gold = extension) · ⇄ = trade block · EXTEND in a final year · ADVERTISE to hear offers for him · RELEASE from his profile or ROSTER > FARM & IR'));
    // right: cap picture, by position, renewals
    const byPos = [['LEFT', p => posMatch(p, 'L')], ['CENTRE', p => posMatch(p, 'C')], ['RIGHT', p => posMatch(p, 'R')], ['KEEPERS', p => p.pos === 'G']]
      .map(([n, f]) => [n, ids.filter(f).reduce((a, p) => a + salOf(p), 0)]);
    const side = tabbed('contractside', [
      { label: 'SALARY CAP', el: () => h('div', { class: 'panel' },
        h('div', { class: 'big ' + (pay > FIN.cap ? 'red' : 'gold') }, fmtM(pay)), capBar(save, team),
        h('div', { class: 'kvr' }, h('span', null, 'Next season'), h('b', null, fmtM(nextYr))),
        h('div', { class: 'kvr' }, h('span', null, 'Expiring'), h('b', null, ids.filter(p => p.contract && p.contract.yrs <= 1 && !p.contract.ext).length + ' players')),
        h('h3', null, 'LOOKING AHEAD'),
        [1, 2, 3].map(k => { const v = ids.reduce((a, p) => { const c = p.contract; if (!c) return a; if (c.yrs > k) return a + c.sal; if (c.ext && c.yrs + c.ext.yrs > k) return a + c.ext.sal; return a; }, 0), n = ids.filter(p => p.contract && (p.contract.yrs > k || (p.contract.ext && p.contract.yrs + p.contract.ext.yrs > k))).length;
          return h('div', { class: 'kvr' }, h('span', null, `+${k} yr`), h('div', { class: 'salbar', style: { flex: 1, margin: '0 8px' } }, h('i', { style: { width: Math.min(100, v / FIN.cap * 100) + '%' } })), h('b', { 'data-help': n + ' players signed' }, fmtM(v))); }),
        h('div', { class: 'hint', 'data-help': 'Salary already committed (and players signed) for future seasons, against the soft cap. The rest is room for new deals.' }, 'Already committed, against the soft cap.'),
        h('h3', null, 'BY POSITION'), h('div', { class: 'bypos' }, byPos.map(([n, v]) => h('div', { 'data-help': `${n}: ${fmtM(v)} of your ${fmtM(pay)} payroll.` }, h('span', { class: 'muted' }, n[0] === 'G' ? 'G' : n[0]), ' ', h('b', null, fmtM(v))))), deadCapNow(team) ? h('div', { class: 'kvr' }, h('span', { class: 'red' }, 'Buyouts'), h('b', null, fmtM(deadCapNow(team)))) : null) },
      off && off.phase === 'renew' ? { label: 'EXPIRING (' + expiring.length + ')', el: () => h('div', { class: 'panel', style: { borderColor: '#ffd23f' } },
        h('div', { class: 'sub' }, 'Negotiate yourself, or let your GM re-sign the players worth keeping at fair prices. Anyone unsigned when free agency opens becomes a free agent.'),
        expiring.length ? h('button', { class: 'primary', onclick: () => { const n0 = expiring.length; aiRenewals(save, team); const n = n0 - expiring.length; Store.autosave(save); toast(n ? `Your GM re-signed ${n} player${n > 1 ? 's' : ''}. ${expiring.length ? expiring.length + ' left for you to decide.' : ''}` : 'Your GM recommends letting these contracts go.'); render(); } }, 'LET MY GM HANDLE RENEWALS') : null,
        expiring.length ? pages('expiring', expiring.slice(), 3, sl => h('div', null, sl.map(pid => { const p = Pl(pid); return h('div', { class: 'hotrow' }, portrait(p, team, 26), h('div', { style: { flex: 1 } }, h('b', null, `#${p.num} ${pname(p)}`), ` · ${posLabel(p)} · ${p.age} · OVR ${ovrInt(p)}`,
          h('div', { class: 'muted', style: { fontSize: '.8em' } }, `Worth ${fmtM(worth(p))} · asks ~${fmtM(askFor(save, p, team, prefYears(p)))} · ${motiveInfo(p).name.toLowerCase()}: ${moodOf(save, p).why}`), loyaltyInfo(save, p, team).pct ? h('div', { class: 'gold', style: { fontSize: '.8em' } }, loyaltyLine(loyaltyInfo(save, p, team))) : null, h('div', { style: { fontSize: '.8em' } }, renewAdvice(save, team, p))),
          h('button', { class: 'small primary', onclick: () => negotiate(pid, 'renew', render) }, 'NEGOTIATE')); }))) : h('div', { class: 'sub green' }, 'All done: no unsigned expiring contracts.')) } : null,
      { label: 'GM NOTES', el: () => h('div', { class: 'panel' }, finRecommendations(save, team).map(t => h('div', { class: 'sub', style: { margin: '4px 0' } }, '• ' + t))) }]);
    const split = h('div', { class: 'split2 fillv' }, table, side); body.appendChild(split);
    // no wasted space: as many rows per page as the screen holds (desktop); both columns run to the bottom
    if (!fitStaged) { fitStaged = true; setTimeout(() => stageFitRows(body, '.ctable tr:nth-child(2)', () => UI.conRows || 6, v => { UI.conRows = v; }, render, 2, ids.length), 0); }
    requestAnimationFrame(() => {
      if (!body.isConnected) return;
      // nothing cut off: a table wider than its panel shrinks to fit (big text sizes), and a side panel taller than the
      // screen shrinks too, instead of either one hiding text or scrolling
      const tw = body.querySelector('.tblwrap'), tb = tw && tw.querySelector('table');
      if (tb) { tb.style.zoom = ''; const over = tb.scrollWidth / Math.max(1, tw.clientWidth); if (over > 1.002) tb.style.zoom = String(Math.max(0.55, 1 / over)); }
      const sp = side; if (sp) { sp.style.zoom = ''; const top = sp.getBoundingClientRect().top, avail = innerHeight - 14 - top, hgt = sp.getBoundingClientRect().height; if (hgt > avail && avail > 100) sp.style.zoom = String(Math.max(0.55, avail / hgt)); }
      if (innerWidth <= 1000 || fitN > 6 || app.classList.contains('staged')) return;
      const tr = body.querySelector('.ctable tr:nth-child(2)'), last = table.lastElementChild;
      if (!tr || !last) return;
      const zr = split.getBoundingClientRect().height / Math.max(1, split.offsetHeight) || 1;   // the text-size setting zooms the screen
      split.style.minHeight = Math.max(0, (innerHeight - 12 - split.getBoundingClientRect().top) / zr) + 'px';
      const rowH = tr.getBoundingClientRect().height, pg = table.querySelector('.paged'), spare = innerHeight - 14 - 16 - pg.getBoundingClientRect().bottom - last.getBoundingClientRect().height - 12, cur = UI.conRows || 6;
      const over = split.getBoundingClientRect().bottom - (innerHeight - 6);   // still running off the screen: take rows off
      const want = Math.max(4, Math.min(ids.length, over > 1 ? cur - Math.ceil(over / rowH) : cur + Math.floor(spare / rowH)));
      if (want !== cur && !(want > cur && cur >= ids.length)) { fitN++; UI.conRows = want; render(); }
    });
  };
  let fitN = 0, fitStaged = false;
  render();
  const onRs = () => { if (!body.isConnected) return removeEventListener('resize', onRs); fitN = 0; fitStaged = false; render(); };
  addEventListener('resize', onRs);
  return h('div', { class: 'screen wide contractsS' }, header('CONTRACTS', () => go(scrHub)), body);
}

// ---------- FREE AGENTS
function scrFreeAgents() {
  const save = UI.save, team = T(save.userTeamId), off = save.off;
  const f = UI.fa || (UI.fa = { pos: 'ALL', sort: 'value' });
  const body = h('div');
  const render = () => {
    body.innerHTML = '';
    const faPhase = off && off.phase === 'fa';
    body.appendChild(h('div', { class: 'panel row', style: { justifyContent: 'space-between', alignItems: 'center' } },
      h('div', null, faPhase ? h('b', { class: 'gold' }, `FREE AGENCY · DAY ${off.day + 1} OF ${FIN.faDays + 1}`) : h('b', null, 'FREE-AGENT MARKET'), h('div', { class: 'muted fanote', style: { fontSize: '7px', marginTop: '4px' } },
        faPhase ? 'Ordinary free agents answer at once. ★ Sought-after players compare offers and decide after the last day: you may improve your offer until then.' : 'Players without a club. During the season every signing is decided on the spot.')),
      h('div', { style: { flex: '1 1 300px', maxWidth: '520px' } }, capBar(save, team), h('div', { class: 'muted', style: { fontSize: '7px' } }, `Roster: ${rosterSkaters(team).length}/12 players · ${rosterGoalies(team).length}/3 keepers · funds ${fmtM(finOf(team).cash)}`)),
      faPhase ? h('button', { class: 'primary', onclick: () => { if (off.day < FIN.faDays) { faNextDay(save); Store.autosave(save); render(); } else { go(scrHub); } } }, off.day < FIN.faDays ? 'NEXT DAY ▶' : 'BACK TO THE OFFSEASON ▶') : null));
    const faCnt = h('span', { class: 'muted', style: { fontSize: '7px', alignSelf: 'center' } });
    const tabs = h('div', { class: 'tabs' }, POS_FILTERS.map(k => h('button', { class: 'small' + (f.pos === k ? ' sel' : ''), title: SIDE_NAMES[k] || 'Everyone', onclick: () => { f.pos = k; render(); } }, k)), h('span', { class: 'grow' }),
      faCnt, h('select', { class: 'fasort', onchange: e => { f.sort = e.target.value; render(); } }, ['value', 'ovr', 'age', 'ask'].map(k => h('option', { value: k, selected: f.sort === k }, 'SORT BY ' + k.toUpperCase()))));
    let list = freeAgents(save).filter(p => posMatch(p, f.pos || 'ALL'));
    faCnt.textContent = list.length + ' FREE AGENTS';
    const ask = p => askFor(save, p, team, prefYears(p));
    list.sort((a, b) => f.sort === 'ovr' ? overall(b) - overall(a) : f.sort === 'age' ? a.age - b.age : f.sort === 'ask' ? ask(a) - ask(b) : worth(b) - worth(a));
    const myOffer = p => off && off.offers && (off.offers[p.id] || []).find(o => o.user);
    // the market on the left; your depth chart and cap room on the right
    const room = FIN.cap - payroll(save, team), mine = rosterIds(team).map(Pl);
    const depth = ['L', 'C', 'R', 'D', 'G'].map(k => { const ps = mine.filter(p => posMatch(p, k)); return { k, n: ps.length, best: ps.length ? Math.max(...ps.map(ovrInt)) : 0 }; });
    const avgBest = depth.filter(d => d.k !== 'G').reduce((a, d) => a + d.best, 0) / 4;
    const side = h('div', null, h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'YOUR DEPTH'),
      depth.map(d => { const weak = d.n === 0 || (d.k !== 'G' && d.best < avgBest - 6); return h('div', { class: 'kvr', style: { cursor: 'pointer' }, onclick: () => { f.pos = d.k; render(); } },
        h('span', null, d.k), h('div', { class: 'salbar', style: { flex: 1, margin: '0 8px' } }, h('i', { style: { width: Math.min(100, d.best) + '%' } }), h('span', null, d.n + ' · best ' + (d.best || '—'))),
        weak ? h('span', { class: 'chip bad' }, 'NEED') : h('span', { class: 'chip good' }, 'OK')); }),
      h('div', { class: 'hint' }, 'Click a position to filter the market.'),
      h('h3', null, 'BUDGET'),
      h('div', { class: 'kvr' }, h('span', null, 'Cap room'), h('b', { class: room >= 0 ? 'green' : 'red' }, fmtM(room))),
      h('div', { class: 'kvr' }, h('span', null, 'Open spots'), h('b', null, Math.max(0, 12 - rosterSkaters(team).length) + ' sk · ' + Math.max(0, 3 - rosterGoalies(team).length) + ' g')),
      h('div', { class: 'hint' }, 'Asks in green fit under the cap.')));
    const head = h('tr', null, ['', 'PLAYER', 'POS', 'SH', 'AGE', 'OVR', 'POT', 'ASK', 'WANTS', 'STATUS', ''].map((x, i) => h('th', { class: i === 1 || i === 8 ? 'l' : '' }, x)));
    const row = p => { const sought = isSought(save, p), mo = myOffer(p), n = off && off.offers ? (off.offers[p.id] || []).length : 0;
        return h('tr', null, h('td', null, portrait(p, null, 20)), h('td', { class: 'l click', onclick: () => profile(p.id) }, (sought ? '★ ' : '') + pname(p)), h('td', null, posLabel(p)), h('td', null, p.pos === 'G' ? 'C' + goalieCatch(p) : p.hand), h('td', null, p.age), h('td', { class: 'gold' }, ovrInt(p)), h('td', null, potTxt(p)),
          h('td', { class: ask(p) <= room ? 'green' : '' }, fmtM(ask(p))), h('td', { class: 'l', style: { fontSize: '7px' } }, h('span', { class: 'chip mot', title: motiveInfo(p).desc }, motiveInfo(p).name)),
          h('td', { style: { fontSize: '7px' } }, mo ? h('span', { class: 'gold' }, 'YOUR OFFER ' + fmtM(mo.sal) + '×' + mo.yrs) : sought && n ? n + ' offer' + (n > 1 ? 's' : '') : ''),
          h('td', null, h('button', { class: 'small primary', onclick: () => negotiate(p.id, 'fa', render) }, mo ? 'IMPROVE' : 'OFFER')));
      };
    // the market a page at a time (no scrolling)
    body.appendChild(h('div', { class: 'split2' }, h('div', { class: 'panel' }, tabs,
      pages('fa' + f.pos + f.sort, list, UI.faRows || 6, sl => h('div', { style: { overflowX: 'auto' } }, h('table', { class: 'tight' }, head, sl.map(row))))), side));
  };
  render();
  setTimeout(() => stageFitRows(body, 'table.tight tr:nth-child(2)', () => UI.faRows || 6, v => { UI.faRows = v; }, render, 4, 20), 0);
  return h('div', { class: 'screen wide faS' }, header('FREE AGENTS', () => go(scrHub)), body);
}

// ---------- TRADES
function scrTrade() {
  const save = UI.save, user = T(save.userTeamId);
  const tr = UI.tr || (UI.tr = { partner: save.teamOrder.find(id => id !== user.id), give: [], get: [] });
  tr.pg = tr.pg || []; tr.pu = tr.pu || [];   // picks: theirs to you, yours to them   // give = theirs to you, get = yours to them
  const body = h('div');
  const render = () => {
    body.innerHTML = '';
    const partner = T(tr.partner);
    tr.give = tr.give.filter(id => Pl(id) && Pl(id).teamId === partner.id); tr.get = tr.get.filter(id => Pl(id) && Pl(id).teamId === user.id);
    const pkU = teamPicks(save, user.id), pkP = teamPicks(save, partner.id);
    tr.pg = tr.pg.filter(k => pkP.some(x => x.key === k)); tr.pu = tr.pu.filter(k => pkU.some(x => x.key === k));
    const PK = () => ({ give: tr.pg.slice(), get: tr.pu.slice() });
    const open = tradeOpen(save);
    if (!open) body.appendChild(h('div', { class: 'panel red' }, 'Trading is closed: the deadline is the start of the playoffs. It reopens during offseason free agency.'));
    // incoming offers
    const offers = (save.tradeOffers || []).filter(o => save.teams[o.teamId]);
    const offersEl = !offers.length ? null : (h('div', { class: 'panel', style: { borderColor: '#ffd23f' } }, h('h3', { style: { marginTop: 0 } }, 'OFFERS FROM OTHER CLUBS'),
      offers.map(o => h('div', { class: 'hotrow' }, badge(T(o.teamId), 26), h('div', { style: { flex: 1, fontSize: '8px' } }, o.msg),
        h('button', { class: 'small primary', onclick: () => { const ev = evalTrade(save, T(o.teamId), o.give, o.get); if (!ev.ok) { toast('That offer is no longer valid.'); save.tradeOffers = save.tradeOffers.filter(x => x !== o); return render(); } executeTrade(save, T(o.teamId), o.give, o.get); Store.autosave(save); toast('Trade completed.'); render(); } }, 'ACCEPT'),
        h('button', { class: 'small', onclick: () => { tr.partner = o.teamId; tr.give = o.give.slice(); tr.get = o.get.slice(); UI.tabMem = UI.tabMem || {}; UI.tabMem.tradetab = 0; render(); } }, 'REVIEW'),
        h('button', { class: 'small danger', onclick: () => { save.tradeOffers = save.tradeOffers.filter(x => x !== o); Store.autosave(save); render(); } }, 'DECLINE')))));
    // three columns: your roster · the deal · their roster
    const pick = (sel, id) => { const i = sel.indexOf(id); if (i >= 0) sel.splice(i, 1); else if (sel.length < 3) sel.push(id); else toast('Up to 3 players per side.'); render(); };
    const pickBox = (list, bag) => h('div', { class: 'trdpicks' }, h('div', { class: 'grouplab' }, 'DRAFT PICKS'),
      list.length ? list.map(o => h('button', { class: 'small' + (bag.includes(o.key) ? ' sel' : ''), title: 'Value ' + Math.round(o.value), onclick: () => { const i = bag.indexOf(o.key); if (i >= 0) bag.splice(i, 1); else if (bag.length < 2) bag.push(o.key); else toast('Up to 2 picks per side.'); render(); } }, (bag.includes(o.key) ? '✔ ' : '') + o.label)) : h('div', { class: 'muted', style: { fontSize: '7px' } }, 'No picks.'));
    const side = (team, sel, mine) => {
      const rows = rosterIds(team).concat(farmIds(team)).map(Pl).sort((a, b) => overall(b) - overall(a));
      return h('div', { class: 'panel trdside' + (mine ? '' : ' theirs') },
        h('div', { class: 'trdhead' }, badge(team, 34), h('div', null, h('div', { class: 'nm', style: { color: teamTextColor(team) } }, fullName(team).toUpperCase()),
          h('div', { class: 'tag' }, (mine ? 'CLICK TO OFFER' : 'CLICK TO REQUEST') + ' · PAYROLL ' + fmtM(payroll(save, team))))),
        mine ? null : (() => { const ps = rosterIds(team).map(Pl).filter(Boolean), sh = ['L', 'C', 'R'].filter(k => ps.filter(p => posMatch(p, k)).length < 3).map(k => SIDE_NAMES[k]).concat(ps.filter(p => p.pos === 'G').length < 2 ? ['G'] : []);
          return h('div', { class: 'sub trdneed', style: { margin: '0 0 4px' }, 'data-help': 'Sides where they have fewer than three players (a player for every line), or fewer than two keepers. Clubs value players who fill a gap more.' }, sh.length ? 'They\'re short at: ' + sh.join(', ') : 'No gaps in their lineup'); })(),
        mine ? null : h('select', { style: { width: '100%', marginBottom: '8px' }, onchange: e => { tr.partner = e.target.value; tr.give = []; tr.pg = []; render(); } },
          save.teamOrder.filter(id => id !== user.id).map(id => h('option', { value: id, selected: id === tr.partner }, fullName(T(id)) + ' · payroll ' + fmtM(payroll(save, T(id)))))),
        h('div', { class: 'scrollbox' }, h('table', { class: 'tight' },
          h('tr', null, h('th', { class: 'l' }, 'PLAYER'), h('th', null, 'POS'), h('th', null, 'AGE'), h('th', null, 'OVR'), h('th', { 'data-help': 'POTENTIAL (scouted): how good he could become.' }, 'POT'), h('th', { 'data-help': 'Salary per season, in millions.' }, '$M'), h('th', { 'data-help': 'Years left on his contract.' }, 'YR'), h('th', null, ''), mine ? h('th', { 'data-help': 'Trade block: players you are open to moving. Other clubs make offers for them.' }, '⇄') : null),
          rows.map(p => h('tr', { class: 'click' + (sel.includes(p.id) ? ' me' : ''), onclick: () => pick(sel, p.id), title: sel.includes(p.id) ? 'Click to remove from the deal' : 'Click to add to the deal' },
            h('td', { class: 'l' }, sel.includes(p.id) ? h('span', { style: { color: 'var(--accent)' } }, '✔ ') : null, (p.first ? p.first[0] + '. ' : '') + p.last, p.block ? h('span', { style: { color: 'var(--accent)' } }, ' ⇄') : null),
            h('td', null, posLabel(p)), h('td', null, p.age), h('td', { class: 'gold' }, ovrInt(p)), h('td', { class: 'muted' }, typeof potTxt === 'function' ? potTxt(p) : '—'),
            h('td', null, p.contract ? (p.contract.sal / 1000).toFixed(2) : '—'), h('td', null, p.contract ? p.contract.yrs : '—'),
            h('td', null, h('button', { class: 'small', title: 'Profile', style: { padding: '1px 5px' }, onclick: e => { e.stopPropagation(); profile(p.id); } }, 'i')),
            mine ? h('td', null, h('button', { class: 'small' + (p.block ? ' sel' : ''), title: p.block ? 'On the trade block: click to take him off' : 'Put him on the trade block', style: { padding: '1px 4px' }, onclick: e => { e.stopPropagation(); p.block = !p.block; Store.autosave(save); render(); } }, p.block ? '⇄' : '·')) : null)))),
        pickBox(mine ? pkU : pkP, mine ? tr.pu : tr.pg));
    };
    const ev = evalTrade(save, partner, tr.give, tr.get, PK());
    const payU = rosterAfter(save, user, tr.get, tr.give).pay, payNow = payroll(save, user);
    const card = (id, sel) => { const p = Pl(id); return h('div', { class: 'trdcard' }, h('div', { class: 'ov' }, ovrInt(p)), h('div', null, h('div', null, '#' + p.num + ' ' + pname(p)), h('div', { class: 'muted' }, posLabel(p) + ' · AGE ' + p.age + ' · ' + (p.contract ? fmtM(p.contract.sal) + ' × ' + p.contract.yrs + ' YR' : 'NO CONTRACT'))),
      h('button', { class: 'small x', title: 'Remove', onclick: () => pick(sel, id) }, '✕')); };
    const slots = (sel, txt) => sel.length ? sel.map(id => card(id, sel)) : [h('div', { class: 'trdslot' }, txt)];
    const ratio = ev.vin != null && ev.vout ? ev.vin / ev.vout : null, pct = ratio == null ? 0 : clamp(ratio / (FIN.tradeMargin * 1.5), 0, 1) * 100, need = 100 / 1.5;
    const vcol = ev.ok ? '#5ee07a' : ev.verdict === 'counter' ? '#ffd23f' : '#ff7a6e';
    const verdict = ev.ok ? 'THEY WOULD ACCEPT' : ev.verdict === 'counter' ? 'CLOSE: THEY WANT MORE' : ev.verdict === 'invalid' || ev.verdict === 'empty' || ev.verdict === 'closed' ? 'NOT POSSIBLE YET' : 'THEY WOULD SAY NO';
    const deal = h('div', { class: 'panel trddeal', style: { borderColor: vcol } },
      h('h3', null, 'THE DEAL'),
      h('div', { class: 'grouplab', style: { marginTop: 0 } }, 'YOU SEND (' + tr.get.length + '/3)'), ...slots(tr.get, 'Click players on YOUR roster (left) to offer them.'),
      ...tr.pu.map(k => h('div', { class: 'trdcard' }, h('div', { class: 'ov' }, '★'), h('div', null, pickLabelK(save, k)), h('button', { class: 'small x', onclick: () => { tr.pu.splice(tr.pu.indexOf(k), 1); render(); } }, '✕'))),
      h('div', { class: 'trdarrow' }, '⇅'),
      h('div', { class: 'grouplab', style: { marginTop: 0 } }, 'YOU RECEIVE (' + tr.give.length + '/3)'), ...slots(tr.give, 'Click players on THEIR roster (right) to ask for them.'),
      ...tr.pg.map(k => h('div', { class: 'trdcard' }, h('div', { class: 'ov' }, '★'), h('div', null, pickLabelK(save, k)), h('button', { class: 'small x', onclick: () => { tr.pg.splice(tr.pg.indexOf(k), 1); render(); } }, '✕'))),
      h('div', { class: 'grouplab' }, partner.abbr + "'S VIEW"),
      h('div', { style: { color: vcol, fontSize: 'calc(9px * var(--ts, 1.2))', marginBottom: '4px' } }, verdict),
      ratio != null ? h('div', { class: 'meter', title: 'How the value they get compares with what they give up. They accept past the white line.' }, h('i', { style: { width: pct + '%', background: vcol } }), h('b', { style: { left: need + '%' } })) : null,
      ev.reasons.map(r => h('div', { class: 'sub', style: { margin: '3px 0', fontSize: 'calc(7px * var(--ts, 1.2))' } }, '• ' + r)),
      ev.counter ? h('div', { class: 'sub gold', style: { fontSize: 'calc(7px * var(--ts, 1.2))' } }, 'COUNTEROFFER: ' + ev.counter.msg) : null,
      tr.give.length || tr.get.length ? h('div', { style: { marginTop: '6px' } }, h('div', { class: 'sub', style: { margin: 0, fontSize: 'calc(7px * var(--ts, 1.2))' } }, 'YOUR PAYROLL: ' + fmtM(payNow) + ' → ' + fmtM(payU)), capBar(save, user, payU - payNow)) : null,
      h('div', { class: 'row', style: { marginTop: '10px' } },
        h('button', { class: 'primary', disabled: !open || (!tr.give.length && !tr.get.length && !tr.pg.length && !tr.pu.length), onclick: () => {
          const e2 = evalTrade(save, partner, tr.give, tr.get, PK());
          if (e2.ok) { executeTrade(save, partner, tr.give, tr.get, PK()); tr.give = []; tr.get = []; tr.pg = []; tr.pu = []; Store.autosave(save); toast('Trade accepted!'); }
          else if (e2.counter) confirmDlg(`${partner.nick}: "${e2.counter.msg}" Accept their counteroffer?`, 'ACCEPT COUNTER', () => { executeTrade(save, partner, e2.counter.give, e2.counter.get, e2.counter.pk); tr.give = []; tr.get = []; tr.pg = []; tr.pu = []; Store.autosave(save); toast('Trade completed.'); render(); });
          else toast(`${partner.nick} turn it down.`);
          render();
        } }, 'PROPOSE TRADE'),
        h('button', { onclick: () => { tr.give = []; tr.get = []; render(); } }, 'CLEAR')),
      h('div', { class: 'muted trdrules', 'data-help': 'Contracts move with the players. Next year\'s picks are valued by where that club is projected to finish. ⇄ = on the trade block.' }, 'Up to 3 players and 2 picks a side · ⓘ'));
    const grid = h('div', { class: 'trdgrid' }, side(user, tr.get, true), deal, side(partner, tr.give, false));
    // offers from other clubs get their own tab, so the deal builder always fits on one screen
    const nL = typeof mkPanel === 'function' ? (mkCleanup(save), (save.listings || []).length) : 0;
    const tabs = [{ label: 'BUILD A DEAL', el: () => grid }];
    if (offersEl) tabs.push({ label: 'OFFERS (' + offers.length + ')', el: () => offersEl });
    if (typeof mkPanel === 'function') tabs.push({ label: 'ON THE BLOCK (' + nL + ')', el: () => mkPanel(save, render) });
    body.appendChild(tabs.length > 1 ? tabbed('tradetab', tabs) : grid);
  };
  render();
  return h('div', { class: 'screen wide tradeS' }, header('TRADES', () => go(scrHub)), body);
}

// ---------- the offseason step (hub hero)
function offseasonHero(save) {
  const off = save.off, user = T(save.userTeamId), idx = OFF_PHASES.indexOf(off.phase);
  const steps = h('div', { class: 'row', style: { justifyContent: 'center', gap: '6px', flexWrap: 'wrap', margin: '6px 0 12px' } }, OFF_PHASES.map((k, i) => h('span', { class: 'chip', style: { padding: '4px 7px', fontSize: '7px', border: '1px solid ' + (i === idx ? '#ffd23f' : '#3b4583'), color: i < idx ? '#5ee07a' : i === idx ? '#ffd23f' : '#9aa3c7' } }, (i + 1) + '. ' + OFF_NAMES[k] + (i < idx ? ' ✔' : ''))));
  const adv = (msg, fn) => { const go2 = () => { const r = advanceOffseason(save); Store.autosave(save); if (r === 'start') toast('A new season begins!'); go(scrHub); }; return msg ? confirmDlg(msg, 'CONTINUE', go2) : go2(); };
  let body;
  if (off.phase === 'review') body = [h('div', { class: 'big gold' }, 'SEASON REVIEW'), h('div', { class: 'sub' }, 'Results, awards and the financial report for the season just finished.'),
    h('div', { class: 'row' }, h('button', { onclick: () => go(() => scrSeasonEnd([])) }, 'VIEW SEASON REPORT'), h('button', { class: 'primary huge', onclick: () => adv() }, 'CONTRACT RENEWALS ▶'))];
  else if (off.phase === 'renew') { const n = (off.expiring[user.id] || []).length; body = [h('div', { class: 'big gold' }, 'CONTRACT RENEWALS'), h('div', { class: 'sub' }, n ? `${n} of your players have expiring contracts. Re-sign the ones you want; the rest become free agents.` : 'No expiring contracts left to deal with.'),
    h('div', { class: 'row' }, h('button', { onclick: () => go(scrContracts) }, 'NEGOTIATE RENEWALS'), h('button', { class: 'primary huge', onclick: () => adv(n ? `${n} unsigned player${n > 1 ? 's' : ''} will leave as free agents. Open free agency?` : null) }, 'OPEN FREE AGENCY ▶'))]; }
  else if (off.phase === 'fa') body = [h('div', { class: 'big gold' }, `FREE AGENCY · DAY ${off.day + 1}/${FIN.faDays + 1}`), h('div', { class: 'sub' }, 'Sign free agents, make trades, and watch the market. Sought-after players decide after the last day.'),
    h('div', { class: 'row' }, h('button', { onclick: () => go(scrFreeAgents) }, 'FREE AGENTS'), h('button', { onclick: () => go(scrTrade) }, 'TRADES'),
      off.day < FIN.faDays ? h('button', { class: 'primary', onclick: () => { faNextDay(save); Store.autosave(save); go(scrHub); } }, 'NEXT DAY ▶') : h('button', { class: 'primary huge', onclick: () => adv() }, 'TO THE ROOKIE DRAFT ▶'))];
  else if (off.phase === 'draft') { const d = save.draft, mine = d && d.v === 2 ? rdPicksOf(d, user.id) : [];
    body = [h('div', { class: 'big gold' }, 'ROOKIE DRAFT · DRAFT DAY'), h('div', { class: 'sub' }, d && d.v === 2 ? `Two rounds, one shared class (rated ${CLASS_STR[d.str].name}). ${mine.length ? 'Your picks: ' + mine.map(o => '#' + o.no).join(', ') + '.' : 'You have no picks: trade for one, or watch.'}` : 'The rookie draft.'),
      h('button', { class: 'primary huge', onclick: () => go(scrDraft) }, 'GO TO THE DRAFT ROOM ★')]; }
  else {
    const s = rosterSkaters(user).length, gl = rosterGoalies(user).length, pay = payroll(save, user);
    body = [h('div', { class: 'big gold' }, 'ROSTER FINALIZATION'), h('div', { class: 'sub' }, `${s}/12 players · ${gl}/3 keepers · payroll ${fmtM(pay)}${pay > FIN.cap ? ' (over the cap: penalty ' + fmtM(capTax(pay)) + ')' : ''}. Missing spots are filled with depth signings when the season starts.`),
      h('div', { class: 'row' }, h('button', { onclick: () => go(scrRoster) }, 'ROSTER & LINES'), h('button', { onclick: () => go(scrContracts) }, 'CONTRACTS'), h('button', { class: 'primary huge', onclick: () => adv() }, 'START THE NEW SEASON ▶'))];
  }
  const dd = save.draft && save.draft.v === 2 ? save.draft : null;
  if (dd && ['review', 'renew', 'fa'].includes(off.phase)) body.push(h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '6px' } }, h('button', { class: 'small', onclick: () => go(scrDraft) }, `🔍 DRAFT BOARD & SCOUTING (${CLASS_STR[dd.str].name} CLASS)`)));
  if (dd && off.phase === 'final' && dd.mine.length) body.splice(2, 0, h('div', { class: 'sub gold' }, `You have ${dd.mine.length} unsigned draft pick${dd.mine.length > 1 ? 's' : ''}. `, h('button', { class: 'small primary', onclick: () => go(scrDraft) }, 'SIGN THEM')));
  return h('div', { class: 'hero' }, h('div', { class: 'kicker' }, 'OFFSEASON'), steps, ...body);
}
// player profile additions: contract, motivations, transactions
function profileBusiness(p) {
  const save = UI.save; if (!save || !p) return null;
  const tx = playerTx(save, p);
  return h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'CONTRACT & TRANSACTIONS'),
    p.status === 'active' || p.status === 'free' ? h('div', { class: 'sub' }, (p.contract ? 'Contract: ' + salLine(p) + ' · ' : p.status === 'free' ? 'Free agent · ' : '') + 'market value ' + fmtM(worth(p)) + ' · motivated by ' + topPrefs(p).map(k => PREF_KEYS[k].toLowerCase()).join(' & ')) : null,
    p.teamId === save.userTeamId && canExtend(save, p) ? h('button', { class: 'small', onclick: () => negotiate(p.id, 'extend', () => go(() => scrPlayer(p.id))) }, 'NEGOTIATE EXTENSION') : null,
    p.status === 'free' ? h('button', { class: 'small primary', onclick: () => negotiate(p.id, 'fa', () => go(() => scrPlayer(p.id))) }, 'MAKE AN OFFER') : null,
    tx.length ? h('table', { style: { marginTop: '6px' } }, tx.slice().reverse().map(x => h('tr', null, h('td', null, 'S' + x.s), h('td', { class: 'l' }, TX_NAMES[x.kind] || x.kind), h('td', { class: 'l' }, x.teamId && save.teams[x.teamId] ? (x.kind === 'trade' && x.from && save.teams[x.from] ? save.teams[x.from].abbr + ' → ' : '') + save.teams[x.teamId].abbr : ''), h('td', { style: { fontSize: '7px' } }, x.extra && /x/.test(x.extra) ? fmtM(+x.extra.split('x')[0]) + ' × ' + x.extra.split('x')[1] : '')))) : h('div', { class: 'muted' }, 'No transactions recorded.'));
}
