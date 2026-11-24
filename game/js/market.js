'use strict';
// ====================================================================
//  ON THE BLOCK AROUND THE LEAGUE: other GMs shop their players too, and say what they want back (picks, or a player
//  at a position they're short at). How busy the market is depends on the time of year:
//    early season: the odd listing · mid season: a few · the run to the trade deadline (start of the playoffs):
//    sellers out of the race dump veterans for picks, contenders shop depth for the missing piece; several a day
//    · offseason free agency: cap-strapped clubs clear salary, rebuilders sell, everyone reshuffles.
//  You can make an offer on any listing (TRADES > ON THE BLOCK): three ready-made packages built around what they want,
//  or build your own in the trade screen. They accept, counter once, or say no. Listings you leave alone may be sold to
//  another club (it shows up in the news), or come off the block when they expire.
// ====================================================================
const MK_PO = CALENDAR.indexOf('po');
const mkSeasonFrac = save => save.off ? -1 : Math.min(1, (save.season.calIdx || 0) / Math.max(1, MK_PO));
const mkNow = save => save.off ? 'f' + (save.off.day || 0) : 'c' + (save.season.calIdx || 0);
const mkLive = (save, L) => save.off ? (L.fa != null && (save.off.day || 0) <= L.fa) : (L.cal != null && (save.season.calIdx || 0) <= L.cal && L.s === save.seasonNum);
const mkPosName = k => k === 'picks' ? 'draft picks' : k === 'G' ? 'a G' : k === 'LD' ? 'an L·D' : k === 'RD' ? 'an R·D' : k === 'L' ? 'an L (or L·D)' : k === 'R' ? 'an R (or R·D)' : k === 'C' ? 'a C' : 'the best offer';
const mkWantMatch = (save, want, item) => want === 'picks' ? !!item.k : !!item.id && (want === 'LD' || want === 'RD' ? P(save, item.id).spos === want : posMatch(P(save, item.id), want));
// the side a club is thinnest at (what it would ask for)
function mkNeed(save, t) {
  const ps = rosterIds(t).map(id => P(save, id));
  if (ps.filter(p => p.pos === 'G').length < 2) return 'G';
  const c = { L: 0, C: 0, R: 0, D: 0 }; for (const p of ps) if (p.pos !== 'G') { c[sideOf(p.spos)]++; if (isDefPos(p.spos)) c.D++; }
  const low = Object.entries(c).sort((a, b) => a[1] - b[1])[0];
  return low[0] === 'D' ? (Math.random() < 0.5 ? 'LD' : 'RD') : low[0];
}
function mkCleanup(save) {
  save.listings = (save.listings || []).filter(L => save.teams[L.teamId] && save.players[L.pid] && save.players[L.pid].teamId === L.teamId && mkLive(save, L));
}
// one day of the league market: maybe new listings (how many depends on the time of year), maybe a sale between clubs
function marketTick(save) {
  if (!tradeOpen(save) || save.autoRun) return;
  const before = (save.listings || []).slice();
  mkCleanup(save);
  // listings that came off: some of them were sold to another club
  for (const L of before) if (!save.listings.includes(L) && save.players[L.pid] && save.players[L.pid].teamId === L.teamId && Math.random() < 0.4) mkAiSale(save, L);
  const fr = mkSeasonFrac(save), off = !!save.off;
  const [chance, cap, burst] = off ? [0.55, 5, 2] : fr < 0.3 ? [0.12, 2, 1] : fr < 0.7 ? [0.22, 3, 1] : fr < 0.9 ? [0.5, 6, 2] : [0.75, 8, 3];
  for (let k = 0; k < burst && save.listings.length < cap; k++) if (Math.random() < chance) mkList(save, fr, off);
}
function mkList(save, fr, off) {
  const user = save.userTeamId, taken = new Set(save.listings.map(L => L.teamId));
  const order = sortedStandings(save).filter(id => id !== user), n = order.length;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  let kind;
  if (off) kind = pick(['cap', 'rebuild', 'need', 'need']);
  else if (fr >= 0.7) kind = pick(['seller', 'seller', 'buyer', 'buyer', 'need']);
  else kind = pick(['need', 'need', 'unhappy']);
  // which club
  let pool = order.filter(id => !taken.has(id));
  if (kind === 'seller') pool = pool.filter(id => order.indexOf(id) >= Math.floor(n * 0.6));
  if (kind === 'buyer') pool = pool.filter(id => order.indexOf(id) < Math.ceil(n * 0.4));
  if (kind === 'cap') pool = pool.filter(id => payroll(save, save.teams[id]) > FIN.cap * 0.93);
  if (kind === 'rebuild') pool = pool.filter(id => (save.teams[id].ai || {}).strat === 'youth' || gmOf(save, save.teams[id]) === 'youth' || order.indexOf(id) >= Math.floor(n * 0.6));
  if (!pool.length) return null;
  const tid = pick(pool), t = save.teams[tid], ps = rosterIds(t).map(id => P(save, id)).filter(p => p && !(p.inj && p.inj.g > 6) && leaderOf(t, p.id) !== 'C');
  if (ps.length < 4) return null;
  const byOvr = ps.slice().sort((a, b) => overall(b) - overall(a)), top = byOvr[0];
  let cand, want, why;
  if (kind === 'seller' || kind === 'rebuild') {
    cand = byOvr.filter(p => p !== top && p.age >= 28).slice(0, 4); want = Math.random() < 0.75 ? 'picks' : pick(['L', 'C', 'R']);
    why = kind === 'seller' ? 'Out of the race: selling veterans before the deadline.' : 'Rebuilding: veterans out, picks and young legs in.';
  } else if (kind === 'buyer') {
    cand = byOvr.slice(4).filter(p => p.age <= 27 || overall(p) < overall(top) - 1.5); want = mkNeed(save, t);
    why = `Making a playoff push: they want ${mkPosName(want)} and will move depth to get one.`;
  } else if (kind === 'cap') {
    cand = ps.filter(p => p !== top && p.contract && p.contract.sal >= 900).sort((a, b) => b.contract.sal - a.contract.sal).slice(0, 3); want = 'picks';
    why = `Squeezed by the cap (${fmtM(payroll(save, t))}): clearing salary.`;
  } else if (kind === 'unhappy') {
    cand = byOvr.slice(3); want = Math.random() < 0.5 ? 'picks' : mkNeed(save, t);
    why = 'He wants more playing time than they can give him.';
  } else {
    cand = byOvr.slice(2).filter(p => mkNeed(save, t) !== (p.pos === 'G' ? 'G' : sideOf(p.spos))); want = mkNeed(save, t);
    why = `Too deep in one spot, short of ${mkPosName(want)}.`;
  }
  cand = (cand || []).filter(p => !save.listings.some(L => L.pid === p.id));
  if (!cand.length) return null;
  const p = pick(cand), days = off ? 3 : fr >= 0.7 ? Math.max(1, MK_PO - (save.season.calIdx || 0) - 1) : 4;
  const L = { id: 'mk' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), teamId: tid, pid: p.id, want, why, kind, s: save.seasonNum,
    cal: off ? null : (save.season.calIdx || 0) + days, fa: off ? (save.off.day || 0) + days : null, ask: tradeValue(save, p, t) * (0.95 + Math.random() * 0.2), tries: 0 };
  save.listings.push(L);
  pushNews(save, `ON THE BLOCK: the ${t.nick} are shopping ${posLabel(p)} ${p.first} ${p.last} (${p.age}, OVR ${ovrInt(p)}). They want ${mkPosName(want)}.`);
  return L;
}
// a listing nobody (you) bought: another club takes him, usually for a pick
function mkAiSale(save, L) {
  const seller = save.teams[L.teamId], p = P(save, L.pid);
  const buyers = save.teamOrder.filter(id => id !== save.userTeamId && id !== L.teamId).sort(() => Math.random() - 0.5);
  for (const bid of buyers) {
    const b = save.teams[bid], ra = rosterAfter(save, b, [], [p.id]);
    if (!ra.farmOK || ra.pay > FIN.cap + 600) continue;
    const pk = teamPicks(save, bid).map(x => ({ k: x.key, v: pickTradeValue(save, seller, x.key), lab: x.label })).filter(x => x.v >= L.ask * 0.45).sort((a, b2) => a.v - b2.v)[0];
    if (!pk) continue;
    movePick(save, pk.k, L.teamId);
    removeFromRoster(seller, p.id); p.teamId = null;
    if (!(joinOrg(save, b, p.id) || placeAnywhere(save, b, p.id))) { joinOrg(save, seller, p.id) || placeAnywhere(save, seller, p.id); movePick(save, pk.k, bid); return false; }
    if (!p.num || numberTaken(save, b, p.num, p.id)) p.num = freeNumber(save, b, p.num);
    if (p.contract) p.contract.team = bid;
    logTx(save, 'trade', { pid: p.id, teamId: bid, from: L.teamId });
    for (const t of [seller, b]) { fillLinesFromReserves(t.roster); compactGoalies(t.roster); autoLeaders(save, t, true); if (typeof aiFarmManage === 'function') aiFarmManage(save, t); }
    pushNews(save, `TRADE: the ${seller.nick} send ${p.first} ${p.last} to the ${b.nick} for ${pk.lab}.`);
    return true;
  }
  return false;
}

// ---------- your offer on a listing
// what you could send, valued the way THEY value it
function mkBuild(save, L, want, must, maxV) {
  const t = save.teams[L.teamId], user = save.teams[save.userTeamId];
  const assets = rosterIds(user).concat(farmIds(user)).filter(id => leaderOf(user, id) !== 'C').map(id => ({ id, v: tradeValue(save, P(save, id), t) }))
    .concat(teamPicks(save, user.id).map(x => ({ k: x.key, v: pickTradeValue(save, t, x.key) }))).filter(x => x.v > 40).sort((a, b) => a.v - b.v);
  const base = must ? { give: must.give.slice(), pk: must.pk.slice() } : { give: [], pk: [] };
  const baseV = base.give.reduce((a, id) => a + tradeValue(save, P(save, id), t), 0) + base.pk.reduce((a, k) => a + pickTradeValue(save, t, k), 0);
  const fresh = assets.filter(x => !(x.id && base.give.includes(x.id)) && !(x.k && base.pk.includes(x.k)));
  let best = null;
  const consider = items => {
    const o = { give: base.give.concat(items.filter(x => x.id).map(x => x.id)), pk: base.pk.concat(items.filter(x => x.k).map(x => x.k)) };
    if (!o.give.length && !o.pk.length) return;
    const ra = rosterAfter(save, t, [L.pid], o.give), ru = rosterAfter(save, user, o.give, [L.pid]);
    if (!ra.farmOK || !ru.farmOK || ra.S < 9 || ra.G < 2 || ru.S < 9 || ru.G < 2) return;
    const v = baseV + items.reduce((a, x) => a + x.v, 0); if (maxV && v > maxV) return;
    const fit = items.filter(x => mkWantMatch(save, L.want, x)).reduce((a, x) => a + x.v, 0) / Math.max(1, items.reduce((a, x) => a + x.v, 0));
    const miss = Math.abs(v - want) - fit * want * 0.4 + (o.give.length + o.pk.length > 3 ? want : 0);
    if (!best || miss < best.miss) best = Object.assign(o, { v, miss });
  };
  for (let i = 0; i < fresh.length; i++) { consider([fresh[i]]); if (!must) for (let j = i + 1; j < fresh.length; j++) consider([fresh[i], fresh[j]]); }
  return best;
}
function mkSend(save, L, pkg) {
  const t = save.teams[L.teamId];
  executeTrade(save, t, [L.pid], pkg.give.slice(), { give: [], get: pkg.pk.slice() });
  save.listings = (save.listings || []).filter(x => x !== L);
}
function mkOfferDlg(L, done) {
  const save = UI.save, t = save.teams[L.teamId], p = P(save, L.pid), user = save.teams[save.userTeamId];
  if (!tradeOpen(save)) return toast('Trading is closed right now.');
  const pk = [['LOW', 0.82], ['FAIR', 1.0], ['STRONG', 1.15]].map(([lab, f]) => [lab, mkBuild(save, L, L.ask * f)]).filter(x => x[1]);
  const seen = new Set(), opts = pk.filter(([, o]) => { const k = o.give.concat(o.pk).sort().join(); if (seen.has(k)) return false; seen.add(k); return true; });
  const chip = (o) => [o.give.map(id => { const q = P(save, id); return h('span', { class: 'adchip' + (mkWantMatch(save, L.want, { id }) ? ' want' : '') }, h('b', null, q.last), ` ${posLabel(q)} · ${q.age} · `, h('span', { class: 'gold' }, ovrInt(q)), ` · ${q.contract ? fmtM(q.contract.sal) : ''}`); }),
    o.pk.map(k => h('span', { class: 'adchip pick' + (L.want === 'picks' ? ' want' : '') }, '🎟 ' + pickLabelK(save, k)))];
  modal(close => {
    const box = h('div', { class: 'addlg' });
    let msg = null, counter = null;
    const draw = () => {
      box.innerHTML = '';
      box.appendChild(h('h2', null, `OFFER FOR ${posLabel(p)} ${p.first.toUpperCase()} ${p.last.toUpperCase()}`));
      box.appendChild(h('div', { class: 'sub', style: { margin: '0 0 6px' } }, `${t.city} ${t.nick} · ${p.age} · OVR ${ovrInt(p)} · ${p.contract ? fmtM(p.contract.sal) + ' × ' + p.contract.yrs + ' yr' : ''}. ${L.why} `, h('span', null, 'THEY WANT: '), h('b', { class: 'gold' }, mkPosName(L.want).toUpperCase())));
      if (msg) box.appendChild(h('div', { class: 'adrow final' }, h('div', { class: 'adline', style: { fontSize: 'calc(7px * var(--ts, 1.2))' } }, msg),
        counter ? h('div', { class: 'adpkg ask' }, h('span', { class: 'gold' }, 'THEY WANT: '), chip(counter)) : null,
        counter ? h('div', { class: 'row', style: { gap: '5px', justifyContent: 'flex-end', margin: '4px 0 0' } },
          h('button', { class: 'small primary', onclick: () => { mkSend(save, L, counter); Store.autosave(save); close(); toast(`Deal! ${p.last} is yours.`, 4500); done && done(); } }, 'ACCEPT THEIR COUNTER'),
          h('button', { class: 'small danger', onclick: () => { close(); done && done(); } }, 'WALK AWAY')) : null));
      if (!counter && L.tries < 2) for (const [lab, o] of opts) {
        const pct = Math.round(o.v / L.ask * 100);
        box.appendChild(h('div', { class: 'adrow' }, h('div', { class: 'adhead' }, h('b', { style: { flex: 1 } }, lab + ' OFFER'), h('span', { class: 'muted', style: { fontSize: '7px' } }, '~' + pct + '% of their asking price')),
          h('div', { class: 'adpkg' }, h('span', { class: 'muted' }, 'YOU SEND: '), chip(o)),
          h('div', { class: 'row', style: { gap: '5px', justifyContent: 'flex-end', margin: '4px 0 0' } }, h('button', { class: 'small primary', onclick: () => {
            L.tries++;
            if (o.v >= L.ask) { mkSend(save, L, o); Store.autosave(save); close(); toast(`The ${t.nick} accept! ${p.last} is yours.`, 4500); done && done(); return; }
            if (o.v >= L.ask * 0.72) { counter = mkBuild(save, L, L.ask * 1.02, o) || mkBuild(save, L, L.ask * 1.02); msg = counter ? `"Close. Add a little more and we have a deal."` : `"Not enough, and there's nothing else of yours we'd want."`; }
            else msg = `"Not even close."` + (L.tries >= 2 ? ' They stop taking your calls about him.' : '');
            Store.autosave(save); draw(); } }, 'SEND OFFER'))));
      }
      box.appendChild(h('div', { class: 'row', style: { marginTop: '8px' } },
        h('button', { onclick: () => { close(); UI.tr = { partner: L.teamId, give: [L.pid], get: [], pg: [], pu: [] }; go(scrTrade); } }, 'BUILD MY OWN OFFER'),
        h('button', { onclick: () => { close(); done && done(); } }, 'CLOSE')));
    };
    draw();
    return box;
  }, true);
}
// the ON THE BLOCK tab of the trade screen
function mkPanel(save, rerender) {
  mkCleanup(save);
  const ls = save.listings || [], fr = mkSeasonFrac(save);
  const when = save.off ? 'Offseason: clubs are clearing cap room and reshuffling.' : fr >= 0.9 ? 'DEADLINE RUSH: the trade deadline is the start of the playoffs. Sellers are dumping veterans.' : fr >= 0.7 ? 'The deadline is getting close: sellers and buyers are out in force.' : 'A quiet market: the busy time is the run to the deadline (and the offseason).';
  return h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'ON THE BLOCK AROUND THE LEAGUE'), h('div', { class: 'sub', style: { margin: '0 0 6px' } }, when),
    ls.length ? pages('mkls', ls, 5, sl => h('div', null, sl.map(L => { const t = save.teams[L.teamId], p = P(save, L.pid);
      const left = save.off ? L.fa - (save.off.day || 0) : L.cal - (save.season.calIdx || 0);
      return h('div', { class: 'hotrow' }, badge(t, 28), portrait(p, t, 28), h('div', { style: { flex: 1, minWidth: 0 } },
        h('div', null, h('b', null, `${posLabel(p)} ${p.first} ${p.last}`), h('span', { class: 'muted' }, ` · ${t.nick} · ${p.age} · `), h('span', { class: 'gold' }, 'OVR ' + ovrInt(p)), h('span', { class: 'muted' }, ` · ${p.contract ? fmtM(p.contract.sal) + ' × ' + p.contract.yrs + ' yr' : ''}`)),
        h('div', { class: 'muted', style: { fontSize: '.8em' } }, L.why + ' ', h('span', { class: 'gold' }, 'WANTS ' + mkPosName(L.want).toUpperCase()), ` · ${left <= 0 ? 'last day' : left + ' day' + (left > 1 ? 's' : '') + ' left'}`)),
        h('button', { class: 'small', onclick: () => profile(p.id) }, 'i'),
        L.tries >= 2 ? h('span', { class: 'muted', style: { fontSize: '7px' } }, 'NOT TAKING CALLS') : h('button', { class: 'small primary', disabled: !tradeOpen(save), title: tradeOpen(save) ? '' : 'Trading pauses during tournaments: back on the next league day.', onclick: () => mkOfferDlg(L, rerender) }, 'MAKE AN OFFER')); })))
      : h('div', { class: 'sub' }, 'Nobody is on the block right now. Check back as the deadline gets closer.'));
}
