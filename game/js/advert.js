'use strict';
// ====================================================================
//  ADVERTISE A PLAYER: put one of your players on the market (CONTRACTS > ADVERTISE) and three to five GMs around the
//  league call with offers built from their own players and picks: some generous, some fair, some lowballs.
//  Every offer can be countered once. Each GM has a private limit (how far he'll really go): a counter inside it is
//  accepted on the spot and the trade goes through; one beyond it brings back his final offer (or he walks away).
//  The market stays open a few game days (save.adverts), or until he's traded.
// ====================================================================
const AD_TIERS = {
  steal:  { lab: 'GREAT OFFER', col: '#3ad15a', f: [1.25, 1.4], room: [1.0, 1.05] },
  good:   { lab: 'GOOD OFFER', col: '#7fd07a', f: [1.08, 1.2], room: [1.02, 1.12] },
  fair:   { lab: 'FAIR', col: '#ffd23f', f: [0.95, 1.05], room: [1.06, 1.2] },
  low:    { lab: 'LOWBALL', col: '#ff9a3c', f: [0.74, 0.88], room: [1.15, 1.35] },
  insult: { lab: 'INSULTING', col: '#ff5a4a', f: [0.48, 0.64], room: [1.25, 1.6] },
};
const AD_LINES = {
  steal: ['We\'ve wanted him for years. Best offer we\'ll make, so take it before I come to my senses.', 'He\'s exactly what we\'re missing. We\'re paying up.'],
  good: ['Strong offer. He fits what we\'re building.', 'We like him a lot. This should get it done.'],
  fair: ['Fair value, straight up.', 'Seems fair for both sides.'],
  low: ['That\'s what he\'s worth to us.', 'We\'re interested, but not at any price.'],
  insult: ['Take it or leave it.', 'Honestly? That\'s all we\'d give. He\'s not that good.'],
};
const adRand = (a, b) => a + Math.random() * (b - a);
const adPick = a => a[Math.floor(Math.random() * a.length)];
// what something is worth to YOU (the same scale the trade screen uses)
const adValP = (save, id) => tradeValue(save, P(save, id), save.teams[save.userTeamId]);
const adValK = (save, k) => pickTradeValue(save, save.teams[save.userTeamId], k);
const adPkgVal = (save, o) => o.give.reduce((a, id) => a + adValP(save, id), 0) + (o.pk || []).reduce((a, k) => a + adValK(save, k), 0);
const adOf = (save, pid) => (save.adverts || []).find(a => a.pid === pid && a.s === save.seasonNum);
function adCleanup(save) {
  const ci = save.season ? save.season.calIdx || 0 : 0;
  save.adverts = (save.adverts || []).filter(a => a.s === save.seasonNum && a.until > ci && save.players[a.pid] && save.players[a.pid].teamId === save.userTeamId);
  for (const a of save.adverts) a.offers = a.offers.filter(o => o.status !== 'gone' && o.give.every(id => save.players[id] && save.players[id].teamId === o.teamId) && (o.pk || []).every(k => { const pi = pickInfo(save, k); return pi && pi.owner === o.teamId; }));
}
// can both rosters take this deal? (their package for your player)
function adFits(save, t, give, pid) {
  const user = save.teams[save.userTeamId], ra = rosterAfter(save, t, give, [pid]), ru = rosterAfter(save, user, [pid], give);
  return ra.farmOK && ru.farmOK && ra.S >= 9 && ra.G >= 2 && ru.S >= 9 && ru.G >= 2 && ra.pay <= FIN.cap + 1500;
}
// the club's tradeable assets: its players (not the captain, not its best player) and its picks
function adAssets(save, t, pid) {
  const ids = rosterIds(t).concat(farmIds(t)), best = ids.slice().sort((a, b) => overall(P(save, b)) - overall(P(save, a)))[0];
  const target = P(save, pid);
  const pl = ids.filter(id => id !== best && leaderOf(t, id) !== 'C' && !(P(save, id).inj && P(save, id).inj.g > 10))
    .map(id => ({ id, v: adValP(save, id), same: P(save, id).pos === target.pos }));
  const pk = teamPicks(save, t.id).map(x => ({ k: x.key, v: adValK(save, x.key) }));
  return { pl, pk };
}
// the package (one to three pieces) whose value to you is closest to `want`
function adBuild(save, t, pid, want, must, maxV, pref) {
  const A = adAssets(save, t, pid), all = A.pl.map(x => ({ id: x.id, v: x.v, same: x.same, fit: pref && pref !== 'picks' && adPosMatch(P(save, x.id), pref) })).concat(A.pk.map(x => ({ k: x.k, v: x.v, fit: pref === 'picks' })))
    .filter(x => x.v > 40).sort((a, b) => b.v - a.v).slice(0, 14);
  const base = must ? { give: must.give.slice(), pk: (must.pk || []).slice() } : { give: [], pk: [] };
  const baseV = adPkgVal(save, base);
  let best = null;
  const consider = items => {
    const o = { give: base.give.concat(items.filter(x => x.id).map(x => x.id)), pk: base.pk.concat(items.filter(x => x.k).map(x => x.k)) };
    if (!o.give.length && !o.pk.length) return;
    if (new Set(o.give).size !== o.give.length || new Set(o.pk).size !== o.pk.length) return;
    if (!adFits(save, t, o.give, pid)) return;
    const v = baseV + items.reduce((a, x) => a + x.v, 0); if (maxV && v > maxV) return;
    // what you asked for: packages led by it score much better (the bonus counts its share of the package)
    const fitShare = pref ? items.filter(x => x.fit).reduce((a, x) => a + x.v, 0) / Math.max(1, items.reduce((a, x) => a + x.v, 0)) : 0;
    const miss = Math.abs(v - want) + (!pref && items.some(x => x.same) ? -want * 0.04 : 0) - fitShare * want * 0.45 + (o.give.length + o.pk.length > 3 ? want * 0.25 : 0);
    if (!best || miss < best.miss) best = { give: o.give, pk: o.pk, v, miss };
  };
  const fresh = all.filter(x => !(x.id && base.give.includes(x.id)) && !(x.k && base.pk.includes(x.k)));
  for (let i = 0; i < fresh.length; i++) {
    if (must) consider([fresh[i]]);
    else { consider([fresh[i]]); for (let j = i + 1; j < fresh.length; j++) { consider([fresh[i], fresh[j]]); for (let k = j + 1; k < Math.min(fresh.length, j + 6); k++) consider([fresh[i], fresh[j], fresh[k]]); } }
  }
  return best;
}
// put him on the market: 3-5 clubs call (at least one good offer and one lowball)
function advertisePlayer(save, pid, pref) {
  adCleanup(save);
  const user = save.teams[save.userTeamId], p = P(save, pid), base = tradeValue(save, p, user);
  const n = 3 + Math.floor(Math.random() * 3);
  let tiers = ['good', 'low', adPick(['steal', 'good', 'fair']), adPick(['fair', 'low', 'insult']), adPick(['fair', 'insult', 'good'])].slice(0, n);
  tiers = tiers.sort(() => Math.random() - 0.5);
  // the clubs most interested (their need for him), with some luck in who picks up the phone
  const clubs = save.teamOrder.filter(id => id !== user.id).map(id => ({ id, w: tradeValue(save, p, save.teams[id]) * adRand(0.8, 1.25) })).sort((a, b) => b.w - a.w);
  const offers = [];
  for (const c of clubs) {
    if (offers.length >= tiers.length) break;
    const t = save.teams[c.id], tier = tiers[offers.length], TI = AD_TIERS[tier];
    const follows = pref && Math.random() < 0.75;                    // most clubs build around what you asked for; some don't
    const want = base * adRand(TI.f[0], TI.f[1]);
    let pkg = adBuild(save, t, pid, want, null, null, follows ? pref : null);
    if (follows && pkg && !pkg.give.concat([]).some(id => adFitsPref(save, pref, { id })) && !pkg.pk.some(k => adFitsPref(save, pref, { k }))) {
      // a club that's listening builds the deal around what you asked for: start from one such piece, add to it
      const A = adAssets(save, t, pid), seeds = (pref === 'picks' ? A.pk.map(x => ({ give: [], pk: [x.k], v: x.v })) : A.pl.filter(x => adPosMatch(P(save, x.id), pref)).map(x => ({ give: [x.id], pk: [], v: x.v })))
        .filter(x => x.v <= want * 1.15 && adFits(save, t, x.give, pid));
      let best = null;
      for (const sd of seeds) for (const c0 of [Object.assign({ miss: Math.abs(sd.v - want) }, sd), adBuild(save, t, pid, want, sd, null, pref)]) if (c0 && (!best || c0.miss < best.miss)) best = c0;
      if (best && Math.abs(best.v - want) < want * 0.3) pkg = best;
    }
    if (!pkg || pkg.v < base * 0.35) continue;
    const pct = pkg.v / base, real = pct >= 1.22 ? 'steal' : pct >= 1.06 ? 'good' : pct >= 0.93 ? 'fair' : pct >= 0.7 ? 'low' : 'insult';
    const R = AD_TIERS[real];
    offers.push({ id: 'ad' + Date.now().toString(36) + offers.length, teamId: c.id, tier: real, give: pkg.give, pk: pkg.pk, cap: Math.max(pkg.v, pkg.v * adRand(R.room[0], R.room[1])), status: 'open', line: adPick(AD_LINES[real]) });
  }
  const ad = { pid, s: save.seasonNum, until: (save.season.calIdx || 0) + 3, offers, pref: pref || null };
  save.adverts = (save.adverts || []).filter(a => a.pid !== pid).concat([ad]);
  p.block = true;
  pushNews(save, `ON THE MARKET: you shopped ${p.first} ${p.last} around the league${pref ? ', looking for ' + adPrefName(pref) : ''}. ${offers.length} club${offers.length === 1 ? '' : 's'} called with offers.`);
  return ad;
}
// what you'd ask for: their offer plus the piece that gets you to a better deal
function adCounterAsk(save, o, pid) {
  const t = save.teams[o.teamId], base = tradeValue(save, P(save, pid), save.teams[save.userTeamId]), now = adPkgVal(save, o);
  const goal = Math.max(base * 1.02, now * 1.15, now + base * 0.12);
  const ad = adOf(save, pid);
  return adBuild(save, t, pid, goal, o, null, ad && ad.pref) || null;
}
function adAccept(save, ad, o) {
  const t = save.teams[o.teamId], ev = adFits(save, t, o.give, ad.pid);
  if (!tradeOpen(save) || !ev) return 'That deal no longer works (rosters or the trade window changed).';
  executeTrade(save, t, o.give, [ad.pid], { give: (o.pk || []).slice(), get: [] });
  save.adverts = (save.adverts || []).filter(a => a !== ad);
  return null;
}

const AD_PREFS = [[null, 'BEST OFFER', 'Anything: players or picks'], ['picks', 'DRAFT PICKS', 'This draft or next'], ['L', 'L', 'Left side (L or L·D)'], ['C', 'C', 'Centre'], ['R', 'R', 'Right side (R or R·D)'],
  ['LD', 'L·D', 'Stay-at-home, left'], ['RD', 'R·D', 'Stay-at-home, right'], ['G', 'G', 'Keeper']];
const adPrefName = k => { const x = AD_PREFS.find(a => a[0] === k); return !x ? 'anything' : k === 'picks' || !k ? x[1].toLowerCase() : x[1] + ' · ' + x[2].toLowerCase(); };
// does this piece match what you asked for?
const adPosMatch = (p, k) => k === 'LD' || k === 'RD' ? p.spos === k : posMatch(p, k);
const adFitsPref = (save, pref, item) => !pref ? false : pref === 'picks' ? !!item.k : !!item.id && adPosMatch(P(save, item.id), pref);
// before he goes on the market: tell the league what you want back (offers still come in all shapes)
function adChoosePref(pid, done) {
  const save = UI.save, p = P(save, pid);
  if (!tradeOpen(save)) return toast('Trading is closed right now (it closes at the start of the playoffs and reopens in free agency).', 4500);
  modal(close => h('div', { class: 'adpref' }, h('h2', null, `📣 ADVERTISE #${p.num} ${p.last.toUpperCase()}`),
    h('div', { class: 'sub', style: { margin: '0 0 8px' } }, 'What do you want back? GMs will build most of their offers around it, but you\'ll still hear every kind of offer.'),
    h('div', { class: 'adprefs' }, AD_PREFS.map(([k, lab, sub]) => h('button', { class: k === null ? 'primary' : '', onclick: () => { close(); advertisePlayer(save, pid, k); Store.autosave(save); adDialog(pid, done); } },
      h('div', null, lab), h('div', { class: 'muted', style: { fontSize: '.75em', marginTop: '3px' } }, sub)))),
    h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { onclick: close }, 'CANCEL'))), true);
}

// ---------- the market screen (a dialog over CONTRACTS)
function adDialog(pid, done) {
  const save = UI.save, user = save.teams[save.userTeamId];
  if (!tradeOpen(save)) return toast('Trading is closed right now (it closes at the start of the playoffs and reopens in free agency).', 4500);
  adCleanup(save);
  let ad = adOf(save, pid);
  if (!ad || !ad.offers.length) return adChoosePref(pid, done);
  const p = P(save, pid), base = tradeValue(save, p, user);
  const emb = t => { const cv = h('canvas', { width: 18, height: 18, class: 'px', style: { width: '30px', height: '30px', flex: 'none' } }); try { drawEmblemPlain(cv.getContext('2d'), t, 1, 1, 1); } catch (e) {} return cv; };
  const chipP = id => { const q = P(save, id); return h('span', { class: 'adchip' + (adFitsPref(save, ad && ad.pref, { id }) ? ' want' : ''), 'data-help': `${q.first} ${q.last}: ${posLabel(q)}, ${q.age}, OVR ${ovrInt(q)}, ${q.contract ? fmtM(q.contract.sal) + ' × ' + q.contract.yrs + ' yr' : 'no contract'}` },
    h('b', null, q.last), ` ${posLabel(q)} · ${q.age} · `, h('span', { class: 'gold' }, ovrInt(q)), ` · ${q.contract ? fmtM(q.contract.sal) : ''}`); };
  const chipK = k => h('span', { class: 'adchip pick' + (adFitsPref(save, ad && ad.pref, { k }) ? ' want' : '') }, '🎟 ' + pickLabelK(save, k));
  const pkg = o => [o.give.map(chipP), (o.pk || []).map(chipK)];
  modal(close => {
    const box = h('div', { class: 'addlg' });
    const draw = () => {
      box.innerHTML = '';
      adCleanup(save); ad = adOf(save, pid) || ad;
      box.appendChild(h('h2', null, `📣 ON THE MARKET: #${p.num} ${p.first.toUpperCase()} ${p.last.toUpperCase()}`));
      box.appendChild(h('div', { class: 'sub', style: { margin: '0 0 8px' } }, `${posLabel(p)} · ${p.age} · OVR ${ovrInt(p)} · ${p.contract ? fmtM(p.contract.sal) + ' × ' + p.contract.yrs + ' yr' : ''} · worth about `, h('b', { class: 'gold' }, (Math.round(base / 100) / 10).toFixed(1)), ' in trade value to you. Offers stay open for 3 game days. One counter per club.', h('div', { style: { marginTop: '3px' } }, 'LOOKING FOR: ', h('b', { class: 'gold' }, ad.pref ? adPrefName(ad.pref).toUpperCase() : 'BEST OFFER'))));
      if (!ad.offers.length) box.appendChild(h('div', { class: 'sub' }, 'No offers left on the table.'));
      const focus = ad.offers.find(o => o.status === 'open' && o.counterOpen);          // building a counter: just that club
      for (const o of focus ? [focus] : ad.offers) {
        const t = save.teams[o.teamId], v = adPkgVal(save, o), pct = Math.round(v / base * 100), TI = AD_TIERS[pct >= 122 ? 'steal' : pct >= 106 ? 'good' : pct >= 93 ? 'fair' : pct >= 70 ? 'low' : 'insult'];
        const row = h('div', { class: 'adrow' + (o.status === 'final' ? ' final' : '') });
        let ask = null, okFit = true;
        if (o.status === 'open' && o.counterOpen) {
          if (!o.cpick) { const sug = adCounterAsk(save, o, pid); o.cpick = { give: (sug || o).give.slice(), pk: ((sug || o).pk || []).slice() }; }
          ask = { give: o.cpick.give, pk: o.cpick.pk }; ask.v = adPkgVal(save, ask); okFit = adFits(save, t, ask.give, pid);
        }
        row.appendChild(h('div', { class: 'adhead' }, emb(t), h('div', { style: { flex: 1, minWidth: 0 } }, h('b', null, `${t.city} ${t.nick}`.toUpperCase()), h('span', { class: 'muted' }, ' · GM: ' + GM_TYPES[gmOf(save, t)].toLowerCase()),
            h('div', { class: 'adline' }, '"' + o.line + '"')),
          h('div', { class: 'admeter' }, h('div', { class: 'adtier', style: { color: TI.col } }, o.status === 'final' ? 'FINAL OFFER' : TI.lab), h('div', { class: 'adbar' }, h('i', { style: { width: Math.min(100, pct / 1.5) + '%', background: TI.col } }), h('em', { style: { left: (100 / 1.5) + '%' } })), h('div', { class: 'muted', style: { fontSize: 'calc(6px * var(--ts, 1.2))' } }, pct + '% of his value'))));
        row.appendChild(h('div', { class: 'adpkg' }, h('span', { class: 'muted' }, 'THEY GIVE: '), pkg(o)));
        if (ask) {
          // YOUR counter: click anything of theirs to ask for it (or click again to drop it); up to four pieces
          const tog = (bag, x) => { const i = bag.indexOf(x); if (i >= 0) bag.splice(i, 1); else if (o.cpick.give.length + o.cpick.pk.length >= 4) return toast('Up to four pieces in one deal.'); else bag.push(x); draw(); };
          const ids = rosterIds(t).concat(farmIds(t)).map(id => P(save, id)).filter(q => q && !(q.inj && q.inj.g > 10)).sort((a, b) => overall(b) - overall(a));
          const picks = teamPicks(save, t.id);
          const apct = Math.round(ask.v / base * 100), acol = apct >= 122 ? AD_TIERS.steal.col : apct >= 106 ? AD_TIERS.good.col : apct >= 93 ? AD_TIERS.fair.col : AD_TIERS.low.col;
          row.appendChild(h('div', { class: 'adpkg ask' }, h('span', { class: 'gold' }, 'YOUR COUNTER: '), ask.give.length || ask.pk.length ? pkg(ask) : h('span', { class: 'muted' }, 'nothing yet: pick from their roster below'),
            h('b', { style: { color: acol, marginLeft: 'auto' } }, apct + '% of his value')));
          if (!okFit && (ask.give.length || ask.pk.length)) row.appendChild(h('div', { class: 'sub red', style: { margin: '3px 0 0', fontSize: '7px' } }, 'Their roster (or yours) can\'t take that deal: too many players moving one way, or over the cap.'));
          row.appendChild(h('div', { class: 'grouplab', style: { margin: '6px 0 2px' } }, `${t.nick.toUpperCase()}: CLICK TO ASK FOR`));
          row.appendChild(h('div', { class: 'adpick' },
            ids.map(q => { const on = ask.give.includes(q.id); return h('button', { class: 'adchip tog' + (on ? ' on' : '') + (adFitsPref(save, ad.pref, { id: q.id }) ? ' want' : ''), 'data-help': `${q.first} ${q.last} · ${q.contract ? fmtM(q.contract.sal) + ' × ' + q.contract.yrs + ' yr' : ''} · about ${Math.round(adValP(save, q.id) / base * 100)}% of ${p.last}'s value`, onclick: () => tog(o.cpick.give, q.id) },
              (on ? '✔ ' : '') , h('b', null, q.last), ` ${posLabel(q)} · ${q.age} · `, h('span', { class: 'gold' }, ovrInt(q))); }),
            picks.map(x => { const on = ask.pk.includes(x.key); return h('button', { class: 'adchip pick tog' + (on ? ' on' : '') + (ad.pref === 'picks' ? ' want' : ''), 'data-help': `About ${Math.round(adValK(save, x.key) / base * 100)}% of ${p.last}'s value`, onclick: () => tog(o.cpick.pk, x.key) }, (on ? '✔ ' : '') + '🎟 ' + x.label); })));
          row.appendChild(h('div', { class: 'sub', style: { margin: '4px 0 0', fontSize: 'calc(6.5px * var(--ts, 1.2))' } }, 'If it\'s inside what he\'ll really pay, he says yes on the spot and the trade goes through. Ask for too much and he comes back with his final offer.'));
        }
        row.appendChild(h('div', { class: 'row', style: { gap: '5px', margin: '4px 0 0', justifyContent: 'flex-end' } },
          ask ? null : h('button', { class: 'small primary', onclick: () => confirmDlg(`Trade ${p.first} ${p.last} to the ${t.nick} for ${o.give.map(id => P(save, id).last).concat((o.pk || []).map(k => pickLabelK(save, k))).join(', ')}?`, 'MAKE THE TRADE', () => {
            const err = adAccept(save, ad, o); if (err) { toast(err); o.status = 'gone'; return draw(); }
            Store.autosave(save); close(); toast(`Done: ${p.last} is a ${t.nick}.`, 4500); done && done(); }) }, 'ACCEPT'),
          o.status === 'open' ? (o.counterOpen
            ? [ask ? h('button', { class: 'small primary', disabled: !okFit || (!ask.give.length && !ask.pk.length), onclick: () => {
                if (ask.v <= o.cap) {                                                              // inside his limit: deal
                  Object.assign(o, { give: ask.give, pk: ask.pk });
                  const err = adAccept(save, ad, o); if (err) { toast(err); o.status = 'gone'; return draw(); }
                  Store.autosave(save); close(); toast(`The ${t.nick} accept your counter! ${p.last} is traded.`, 5000); done && done(); return;
                }
                if (ask.v > o.cap * 1.45 && o.tier === 'insult') { o.status = 'gone'; toast(`The ${t.nick} hang up. "Not a chance."`, 4000); Store.autosave(save); return draw(); }
                const fin = adBuild(save, t, pid, o.cap, o, o.cap);                                       // his final offer: as far as he'll go
                if (fin && fin.v > adPkgVal(save, o) + 1) Object.assign(o, { give: fin.give, pk: fin.pk });
                o.status = 'final'; o.counterOpen = false; o.cpick = null; o.line = fin && fin.v > v + 1 ? 'That\'s too rich. Here\'s as far as we go.' : 'We\'re not moving. That\'s our final offer.';
                Store.autosave(save); draw(); } }, 'SEND COUNTER') : h('span', { class: 'muted', style: { fontSize: '7px', alignSelf: 'center' } }, 'Nothing more they could add.'),
              h('button', { class: 'small', onclick: () => { o.cpick = null; draw(); } }, 'SUGGEST ONE'),
              h('button', { class: 'small', onclick: () => { o.cpick = { give: [], pk: [] }; draw(); } }, 'CLEAR'),
              h('button', { class: 'small', onclick: () => { o.counterOpen = false; o.cpick = null; draw(); } }, 'BACK')]
            : h('button', { class: 'small', onclick: () => { o.counterOpen = true; draw(); } }, 'COUNTER')) : null,
          h('button', { class: 'small danger', onclick: () => { o.status = 'gone'; Store.autosave(save); draw(); } }, 'DECLINE')));
        box.appendChild(row);
      }
      box.appendChild(h('div', { class: 'row', style: { marginTop: '8px' } },
        h('button', { onclick: () => { close(); done && done(); } }, 'CLOSE (KEEP LISTENING)'),
        h('button', { onclick: () => { save.adverts = (save.adverts || []).filter(a => a !== ad); p.block = false; Store.autosave(save); close(); toast(`${p.last} is off the market.`); done && done(); } }, 'TAKE HIM OFF THE MARKET')));
      box.style.zoom = ''; setTimeout(() => { if (!box.isConnected) return; const r = box.getBoundingClientRect(), lim = innerHeight - 120; if (r.height > lim) box.style.zoom = Math.max(0.6, lim / r.height); }, 0);
    };
    draw();
    return box;
  }, true);
}
