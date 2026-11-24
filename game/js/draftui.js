'use strict';
// ====================================================================
//  DRAFT ROOMS: the shared big board, the Inaugural League Draft and the yearly Rookie Draft
// ====================================================================
const STAT_SHORT = { spd: 'SPD', sta: 'STA', pow: 'PWR', acc: 'ACC', pas: 'PAS', stk: 'DRB', def: 'DEF', chk: 'TKL', fo: 'SP', ref: 'REF', pos: 'POS', reb: 'REB', rec: 'REC' };
const TYPE_SHORT = { speedster: 'Speedster', sniper: 'Sniper', defensive: 'Defensive', enforcer: 'Hard man', playmaker: 'Playmaker', balanced: 'Two-way', goalie: 'Keeper' };
const topStats = p => Object.entries(p.attrs).filter(([k]) => p.pos === 'G' || k !== 'fo').sort((a, b) => b[1] - a[1]).slice(0, 2).flatMap(([k, v], i) => [i ? ' · ' : null, h('span', { 'data-help': HELP.stat[STAT_SHORT[k]] || '' }, STAT_SHORT[k] + ' ' + r100(v))]).filter(Boolean);
const typeLbl = p => h('span', { 'data-help': HELP.type[p.arch] || '' }, TYPE_SHORT[p.arch] || '');
const tagChip = (k, big) => { const t = PTAGS[k]; return t ? h('span', { class: 'dtag' + (big ? ' big' : ''), style: { color: t.col, borderColor: t.col }, 'data-help': t.name + ': ' + t.desc }, t.name) : null; };
const tierChip = p => { const k = p.tierV || p.tier; return k ? h('span', { class: 'dtier' + (k === 'gen' ? ' dgen' : ''), style: { color: TIER_COL[k] || '#9aa3c7' }, 'data-help': helpTier(p) }, (p.pos === 'G' && k === 'franchise' ? 'ELITE' : TIER_NAMES[k] || k).toUpperCase()) : null; };
const traitIcons = p => traitsHidden(p) ? h('span', { class: 'muted', 'data-help': 'Unknown: scout him to see his traits.' }, '?') : h('span', null, (p.traits || []).filter(id => TRAITS[id]).flatMap((id, i) => [i ? ' ' : null, h('span', { 'data-help': TRAITS[id].name.toUpperCase() + ': ' + TRAITS[id].desc }, TRAITS[id].icon)]).filter(Boolean));

// the big board: filters (position, type, tier, your list), sorting, star toggles, pick buttons
function draftBoard(o) {
  const f = o.f, watch = o.watch;
  const box = h('div', { class: 'panel dboard' });
  const posTabs = POS_FILTERS.concat(['★ LIST']);
  box.appendChild(h('div', { class: 'tabs' }, posTabs.map(k => h('button', { class: f.pos === k ? 'sel' : '', onclick: () => { f.pos = k; f.more = 0; o.rerender(); } }, k))));
  const archs = ['ALL'].concat(Object.keys(TYPE_SHORT)), tiers = ['ALL'].concat(o.tiers);
  const sel = (val, opts, set, lab) => h('label', { class: 'dsel' }, lab + ' ', h('select', { onchange: e => { set(e.target.value); f.more = 0; o.rerender(); } }, opts.map(v => h('option', { value: v, selected: v === val }, v === 'ALL' ? 'ALL' : lab === 'TYPE' ? TYPE_SHORT[v].toUpperCase() : (TIER_NAMES[v] || v)))));
  box.appendChild(h('div', { class: 'row dfilters' },
    sel(f.arch, archs, v => f.arch = v, 'TYPE'), sel(f.tier, tiers, v => f.tier = v, 'TIER'),
    h('span', { class: 'grow' }), h('span', { class: 'muted' }, 'SORT'),
    ['board', 'ovr', 'pot', 'age'].map(k => h('button', { class: 'small' + (f.sort === k ? ' sel' : ''), onclick: () => { f.sort = k; o.rerender(); } }, k === 'board' ? 'BEST' : k.toUpperCase()))));
  let list = o.list.filter(p => (f.pos === 'ALL' || (f.pos === '★ LIST' ? watch.includes(o.idOf(p)) : posMatch(p, f.pos)))
    && (f.arch === 'ALL' || p.arch === f.arch) && (f.tier === 'ALL' || (p.tierV || p.tier) === f.tier));
  const pv = p => p.potR ? (p.potR[0] + p.potR[1]) / 2 : pot100(p);
  list.sort((a, b) => f.sort === 'ovr' ? overall(b) - overall(a) : f.sort === 'pot' ? pv(b) - pv(a) : f.sort === 'age' ? a.age - b.age || o.value(b) - o.value(a) : o.value(b) - o.value(a));
  const lim = 70 + (f.more || 0) * 70, shown = list.slice(0, lim);
  const star = p => { const id = o.idOf(p), on = watch.includes(id); return h('button', { class: 'dstar' + (on ? ' on' : ''), title: on ? 'Remove from your list' : 'Add to your list', onclick: e => { e.stopPropagation(); if (on) watch.splice(watch.indexOf(id), 1); else watch.push(id); o.rerender(); } }, on ? '★' : '☆'); };
  const rows = shown.map(p => {
    const id = o.idOf(p), err = o.canPick(p);
    return h('tr', { class: 'click' + (f.sel === id ? ' me' : ''), onclick: () => { f.sel = id; o.rerender(); } },
      h('td', null, star(p)), h('td', { class: 'l' }, portrait(p, null, 22)),
      h('td', { class: 'l' }, h('div', null, p.first + ' ' + p.last), h('div', { class: 'dsubl' }, tierChip(p), ' ', typeLbl(p), o.fit ? [' ', o.fit(p)] : null)),
      h('td', null, posKey(p)), h('td', null, p.age), h('td', { class: 'gold' }, ovrInt(p)), h('td', { class: p.potR ? 'dpot' : '' }, potTxt(p)),
      h('td', { class: 'l dtop' }, topStats(p)),
      h('td', { class: 'l' }, tagsShown(p).map(k => tagChip(k))), h('td', { class: 'l' }, traitIcons(p)),
      h('td', { class: 'dact' }, err ? h('span', { class: 'muted', title: err }, '—') : h('button', { class: 'small primary', onclick: e => { e.stopPropagation(); o.onPick(p); } }, o.pickLabel || 'DRAFT')));
  });
  box.appendChild(h('div', { class: 'dtable' }, h('table', null, h('tr', null, ['', '', 'PLAYER', 'POS', 'AGE', 'OVR', 'POT', 'BEST AT', 'TAGS', 'TRAITS', ''].map((x, i) => h('th', { class: [1, 2, 7, 8, 9].includes(i) ? 'l' : '', 'data-help': HELP.col[x] || null }, x))), rows)));
  box.appendChild(h('div', { class: 'hint' }, `${list.length} player${list.length === 1 ? '' : 's'} match.`, list.length > lim ? h('button', { class: 'small', onclick: () => { f.more = (f.more || 0) + 1; o.rerender(); } }, 'SHOW MORE') : null,
    ' POT is the scouts\' range: the real ceiling is somewhere inside it.'));
  return box;
}
// the selected player, in detail
function draftDetail(p, o) {
  if (!p) return h('div', { class: 'panel' }, h('div', { class: 'muted', style: { fontSize: '8px' } }, 'Click a player on the board for his full report.'));
  const id = o.idOf(p), on = o.watch.includes(id), err = o.canPick(p);
  return h('div', { class: 'panel ddetail' },
    h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } }, portrait(p, null, 56),
      h('div', { style: { flex: 1 } }, h('div', { style: { fontSize: '10px' } }, p.first + ' ' + p.last),
        h('div', { class: 'muted', style: { fontSize: '7px', marginTop: '4px' } }, `${p.pos === 'G' ? 'Keeper' : POS_NAMES[p.spos]} · age ${p.age}${p.pos === 'G' ? '' : ' · shoots ' + (p.hand === 'L' ? 'left' : 'right')}`),
        h('div', { style: { marginTop: '4px' } }, tierChip(p), ' ', h('span', { class: 'muted', style: { fontSize: '7px' } }, typeLbl(p)), o.fit ? [' ', o.fit(p)] : null))),
    h('div', { class: 'row', style: { gap: '16px', margin: '8px 0' } },
      h('div', null, h('div', { class: 'muted', style: { fontSize: '7px' }, 'data-help': HELP.col.OVR }, 'OVERALL'), h('div', { class: 'gold', style: { fontSize: '14px' } }, ovrInt(p))),
      h('div', null, h('div', { class: 'muted', style: { fontSize: '7px' }, 'data-help': HELP.col.POT }, p.potR ? 'POTENTIAL (SCOUTED RANGE)' : 'POTENTIAL'), h('div', { style: { fontSize: '14px', color: '#9ad0ff' } }, potTxt(p)))),
    tagsShown(p).length ? h('div', null, tagsShown(p).map(k => h('div', { style: { margin: '3px 0', fontSize: '7px', lineHeight: 1.6 } }, tagChip(k, true), ' ', h('span', { class: 'muted' }, PTAGS[k].desc)))) : null,
    traitsHidden(p) ? h('div', { class: 'muted', style: { fontSize: '7px', margin: '6px 0' } }, 'Traits: unknown until scouted.') : traitChips(p, true),
    attrBars(p),
    h('div', { class: 'row', style: { marginTop: '8px' } },
      err ? null : h('button', { class: 'primary', onclick: () => o.onPick(p) }, (o.pickLabel || 'DRAFT') + ' ' + p.last.toUpperCase()),
      h('button', { class: 'small', onclick: () => { if (on) o.watch.splice(o.watch.indexOf(id), 1); else o.watch.push(id); o.rerender(); } }, on ? '★ ON YOUR LIST' : '☆ ADD TO LIST'),
      o.extra ? o.extra(p) : null),
    err && o.showErr ? h('div', { class: 'muted', style: { fontSize: '7px', marginTop: '6px' } }, err) : null);
}
// best player left at each position
function bestByPos(list, value, onSel) {
  return h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'BEST AVAILABLE'),
    h('table', { class: 'dbest' }, ['L', 'C', 'R', 'D', 'G'].map(k => {
      const p = list.filter(x => posMatch(x, k)).sort((a, b) => value(b) - value(a))[0];
      return h('tr', { class: p ? 'click' : '', onclick: p ? () => onSel(p) : null }, h('td', { class: 'gold' }, k), h('td', { class: 'l' }, p ? p.first[0] + '. ' + p.last : '—'), h('td', null, p ? ovrInt(p) : ''), h('td', { class: 'muted' }, p ? potTxt(p) : ''));
    })));
}
function tickerPanel(lines, title = 'DRAFT TICKER') {
  return h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, title),
    h('div', { class: 'dticker' }, lines.length ? lines.slice(-14).reverse().map(x => h('div', { class: x.cls || '' }, x.t)) : h('div', { class: 'muted', style: { fontSize: '8px' } }, 'No picks yet.')));
}
const gmLine = (save, id) => { const t = T(id); return id === save.userTeamId ? 'YOU' : t.nick + ' · ' + GM_TYPES[gmOf(save, t)]; };

// ====================================================================
//  INAUGURAL LEAGUE DRAFT
// ====================================================================
function scrDraft0() {
  const save = UI.save, d = save.draft0, user = save.userTeamId;
  if (!d || d.done) { setTimeout(() => go(scrHub), 0); return h('div'); }
  d.watch = d.watch || [];
  const f = UI.d0 || (UI.d0 = { pos: 'ALL', arch: 'ALL', tier: 'ALL', sort: 'board', sel: null, more: 0 });
  const body = h('div');
  const T0 = d.order.length;
  const alerts = lost => { if (lost.length) toast('Taken from your list: ' + lost.map(id => Pl(id).last).join(', '), 4200); };
  const sim = n => {
    const before = d.watch.filter(id => d.pool.includes(id));
    draft0SimToUser(save, n);
    const lost = before.filter(id => !d.pool.includes(id)); alerts(lost);
    d.watch = d.watch.filter(id => d.pool.includes(id));
  };
  const pick = p => {
    const err = draft0Pick(save, p.id, d.phase === 'final' ? user : d0Team(d));
    if (err) return toast(err);
    f.sel = null; d.watch = d.watch.filter(id => id !== p.id);
    if (d.phase === 'main') sim();
    Store.autosave(save);
    if (d.done) { toast('Draft complete! Your roster is set.', 4000); UI.d0 = null; return go(scrHub); }
    render();
  };
  // your slot: a lottery or a choice (later slots start richer)
  const slotScreen = () => {
    body.appendChild(h('div', { class: 'panel', style: { textAlign: 'center' } },
      h('div', { class: 'big gold' }, 'YOUR DRAFT SLOT'),
      h('div', { class: 'sub', style: { maxWidth: '640px', margin: '8px auto', lineHeight: 1.8 } },
        `${T0} franchises draft in snake order: the order reverses every round. Slot 1 gets the best player in the pool, then waits ${2 * T0 - 2} picks. `
        + `A later slot picks twice in a row at the turn, and starts richer: +${fmtM(D0_SLOT_CASH)} per slot after the first. Leave it to the lottery for a 25% bigger bonus.`),
      h('button', { class: 'primary huge', onclick: () => { const s = ri(1, T0); d0SetSlot(save, s, 'lottery'); Store.autosave(save);
        modal(close => h('div', { style: { textAlign: 'center' } }, h('div', { class: 'muted' }, 'THE LOTTERY SAYS'), h('div', { class: 'big gold', style: { fontSize: '28px', margin: '10px 0' } }, '#' + s),
          h('div', { class: 'sub' }, d.slotBonus ? `Bonus funds: +${fmtM(d.slotBonus)}` : 'First pick in the draft!'), h('button', { class: 'primary', onclick: () => { close(); render(); } }, 'TO THE DRAFT ▶'))); } }, '🎲 RUN THE LOTTERY'),
      h('div', { class: 'muted', style: { margin: '14px 0 6px', fontSize: '7px' } }, 'OR CHOOSE YOUR SLOT'),
      h('div', { class: 'dslots' }, Array.from({ length: T0 }, (_, i) => h('button', { class: 'small', onclick: () => { d0SetSlot(save, i + 1, 'choose'); Store.autosave(save); render(); } },
        h('div', null, '#' + (i + 1)), h('div', { class: 'muted', style: { fontSize: 'calc(6px * var(--ts, 1.2))' } }, i ? '+' + fmtM(d0SlotBonus(i + 1, 'choose')) : 'top pick'))))));
  };
  const render = () => {
    body.innerHTML = '';
    if (d.needSlot) return slotScreen();
    const yourTurn = d.phase === 'final' || d0Team(d) === user;
    const sel = d.phase === 'main' ? d0Team(d) : user, pickNo = d.picks.length + 1;
    const n = d0Needs(save, user), c = n.counts;
    // when do you pick next?
    let next = null;
    if (d.phase === 'main' && !yourTurn) { const dd = { round: d.round, idx: d.idx, order: d.order }; for (let k = 1; k < T0 * 2 + 2; k++) { d0Advance(dd, T0); if (dd.round >= D0_ROUNDS) break; if (d0Team(dd) === user) { next = { k, no: pickNo + k }; break; } } }
    const upNext = []; if (d.phase === 'main') { const dd = { round: d.round, idx: d.idx, order: d.order }; for (let k = 0; k < 4; k++) { if (dd.round >= D0_ROUNDS) break; upNext.push(d0Team(dd)); d0Advance(dd, T0); } }
    body.appendChild(h('div', { class: 'panel dhead' }, badge(T(sel), 40),
      h('div', { style: { flex: 1 } },
        h('div', { class: 'gold', style: { fontSize: '11px' } }, d.phase === 'final' ? 'FINAL PICKS: YOU CHOOSE 4 MORE' : `ROUND ${d.round + 1} OF ${D0_ROUNDS} · PICK ${pickNo}`),
        h('div', { style: { fontSize: '8px', marginTop: '6px' } }, d.phase === 'final' ? `Still to pick: ${d.finalLeft.S} player${d.finalLeft.S === 1 ? '' : 's'}, ${d.finalLeft.G} keeper${d.finalLeft.G === 1 ? '' : 's'} (any order).`
          : yourTurn ? h('span', { class: 'gold dclock' }, '★ YOU ARE ON THE CLOCK') : `On the clock: ${gmLine(save, sel)}`),
        next ? h('div', { class: next.k <= 3 ? 'dwarn' : 'muted', style: { fontSize: '8px', marginTop: '6px' } }, next.k <= 3 ? `⚠ YOUR PICK IS IN ${next.k}!` : `Your next pick: #${next.no}, in ${next.k} picks.`) : null,
        d.phase === 'main' ? h('div', { class: 'muted', style: { fontSize: '7px', marginTop: '4px' } }, 'Up next: ' + upNext.map(id => id === user ? 'YOU' : T(id).abbr).join(' → ') + ` · your slot #${d.slot || '?'}${d.slotBonus ? ' (+' + fmtM(d.slotBonus) + ')' : ''}`) : null),
      !yourTurn ? h('button', { onclick: () => { sim(1); Store.autosave(save); render(); } }, 'NEXT PICK ▶') : null,
      !yourTurn ? h('button', { class: 'primary', onclick: () => { sim(); Store.autosave(save); render(); } }, 'SIM TO MY PICK ▶▶') : null,
      h('button', { class: 'small ghost', onclick: () => confirmDlg('Let the scouts finish your whole draft automatically?', 'AUTO-DRAFT', () => { draft0AutoAll(save); Store.autosave(save); UI.d0 = null; toast('Draft complete!'); go(scrHub); }) }, 'AUTO-DRAFT')));
    const pool = d.pool.map(Pl);
    const val = p => d0Value(save, T(user), p, () => 0.5);
    const O = { f, watch: d.watch, list: pool, tiers: ['franchise', 'star', 'specialist', 'veteran', 'prospect', 'depth', 'backup'], idOf: p => p.id, value: val,
      canPick: p => yourTurn ? d0Legal(save, user, p.id) : 'Not your pick.', onPick: pick, rerender: render, showErr: true };
    const left = h('div', { style: { flex: '1 1 640px', minWidth: 0 } }, draftBoard(O));
    const sp = f.sel && Pl(f.sel), mine = rosterIds(T(user)).map(Pl);
    const needTxt = d.phase === 'main' ? `Players ${c.S}/${D0_NEED.S} · Keepers ${c.G}/${D0_NEED.G} · ${n.left} pick${n.left === 1 ? '' : 's'} left` : `${rosterSkaters(T(user)).length}/12 players · ${rosterGoalies(T(user)).length}/3 keepers`;
    const right = h('div', { style: { flex: '1 1 300px', minWidth: 0 } },
      draftDetail(sp && sp.status === 'pool' ? sp : null, O),
      bestByPos(pool, val, p => { f.sel = p.id; render(); }),
      tickerPanel(d.picks.slice(-14).map(x => ({ t: `#${x.no} ${x.user ? 'YOU' : T(x.teamId).nick}: ${x.name} (${SIDE_OF[x.pos] ? posShort(x.pos) : x.pos}, ${x.ovr})`, cls: x.user ? 'gold' : '' }))),
      h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'MY ROSTER'), h('div', { class: 'sub' }, needTxt),
        h('div', { class: 'muted', style: { fontSize: '7px' } }, [['L', (c.LW || 0) + (c.LD || 0)], ['C', c.C || 0], ['R', (c.RW || 0) + (c.RD || 0)], ['D', (c.LD || 0) + (c.RD || 0)]].map(([k, n]) => k + ' ' + n).join(' · ')),
        mine.length ? mine.map(p => h('div', { style: { fontSize: '7px', lineHeight: 2 } }, `${posTag(p)} · ${p.first[0]}. ${p.last} · OVR ${ovrInt(p)} · ${p.age}y`)) : h('div', { class: 'muted', style: { fontSize: '8px' } }, 'Nobody yet.')));
    body.appendChild(h('div', { class: 'dgrid' }, left, right));
  };
  render();
  return h('div', { class: 'screen wide' }, header('INAUGURAL LEAGUE DRAFT', async () => { await Store.flush(); await refreshSaves(); go(scrSaves); }, 'SAVE & EXIT'), body);
}

// ====================================================================
//  YEARLY ROOKIE DRAFT
// ====================================================================
// saves from before the new draft: build this summer's class now
function rdMigrate(save) {
  if (save.draft && save.draft.v !== 2 && !save.draft.done && save.season && save.season.done) { save.nextClass = save.nextClass || 'normal'; createDraftClass(save); }
}
function scrDraft() {
  const save = UI.save; rdMigrate(save);
  const d = save.draft, user = T(save.userTeamId);
  if (!d || d.v !== 2) return h('div', { class: 'screen' }, header('ROOKIE DRAFT', () => go(scrHub)), h('div', { class: 'panel sub' }, 'The rookie draft happens after the season ends. Its class is announced at the start of each season.'));
  const f = UI.rd || (UI.rd = { pos: 'ALL', arch: 'ALL', tier: 'ALL', sort: 'board', sel: null, more: 0 });
  const body = h('div');
  const draftDay = !!(save.off && save.off.phase === 'draft') || d.done;
  if (draftDay && !d.done) { rdExposeVets(save); rdVetCheck(save); }
  const alerts = lost => { if (lost.length) toast('Taken from your list: ' + lost.map(k => { const p = d.cls.find(x => x.kid === k); return p ? p.last : k; }).join(', '), 4200); };
  const sim = n => {
    const before = d.watch.filter(k => !d.cls.find(x => x.kid === k).taken);
    rdSimToUser(save, n);
    alerts(before.filter(k => { const p = d.cls.find(x => x.kid === k); return p.taken && !(p.taken.team === save.userTeamId); }));
    d.watch = d.watch.filter(k => !d.cls.find(x => x.kid === k).taken);
  };
  const onClock = () => draftDay && !d.done && rdCur(d) && rdCur(d).team === save.userTeamId;
  const pick = p => {
    const err = rdMakePick(save, p.kid); if (err) return toast(err);
    f.sel = null; d.watch = d.watch.filter(k => k !== p.kid);
    toast(`You select ${p.first} ${p.last}!`);
    Store.autosave(save); render();
  };
  const scoutBtn = p => !p.taken && !p.scouted ? h('button', { class: 'small', title: 'Narrow his range, reveal his traits and anything the scouts missed', onclick: () => { const e = rdScout(save, p.kid); if (e) toast(e); else toast(`Scouted ${p.last}: range ${potTxt(p)}.`); Store.autosave(save); render(); } }, `🔍 SCOUT (${rdScoutLeft(d)} left)`) : p.scouted ? h('span', { class: 'green', style: { fontSize: '7px' } }, '✓ SCOUTED') : null;
  // signing one of your picks
  const signDlg = kid => {
    const p = d.cls.find(x => x.kid === kid); if (!p) return;
    if (p.vetPid) return vetDlg(kid);
    modal(close => {
      const firstIn = h('input', { type: 'text', value: p.first, maxLength: 14 }), lastIn = h('input', { type: 'text', value: p.last, maxLength: 16 });
      const sugg = freeNumber(save, user, 0), numIn = h('input', { type: 'number', min: 1, max: 99, value: sugg, style: { width: '70px' } });
      const keys = p.pos === 'G' ? G_ATTRS : SK_ATTRS;
      const focusSel = h('select', null, [h('option', { value: '' }, 'No training-camp focus')].concat(rdScoutLeft(d) >= 1 ? keys.filter(([k]) => p.attrs[k] < 10).map(([k, nm]) => h('option', { value: k }, `${nm} ${r100(p.attrs[k])} → ${r100(p.attrs[k] + 1)} (1 scouting point)`)) : []));
      const posSel = p.pos === 'G' ? null : h('select', null, NAT_POS.map(k => h('option', { value: k, selected: k === p.spos }, POS_NAMES[k])));
      const handSel = p.pos === 'G' ? null : h('select', null, ['L', 'R'].map(k => h('option', { value: k, selected: k === p.hand }, 'Shoots ' + HAND_NAMES[k].toLowerCase())));
      const full = orgFull(user, p.pos); let release = null;
      const relBox = h('div'), msg = h('div', { class: 'sub red' });
      const renderRel = () => { relBox.innerHTML = ''; if (!full) return;
        const ids = (p.pos === 'G' ? rosterGoalies(user) : rosterSkaters(user)).concat(farmIds(user).filter(id => (Pl(id).pos === 'G') === (p.pos === 'G')));
        relBox.appendChild(h('div', { class: 'panel', style: { margin: '10px 0 0', borderColor: '#a3394a' } }, h('h3', { style: { marginTop: 0 } }, `ROSTER FULL: CHOOSE WHO TO RELEASE`),
          h('div', { class: 'grid g3' }, ids.map(id => { const q = Pl(id); return h('div', { class: 'pcard' + (release === id ? ' sel' : ''), onclick: () => { release = id; renderRel(); } }, h('div', null, '#' + q.num + ' ' + pname(q)), h('div', { class: 'muted' }, `Age ${q.age} · OVR ${ovrInt(q)} · POT ${potTxt(q)}`)); })))); };
      renderRel();
      return h('div', null, h('h2', null, 'SIGN ' + (p.first + ' ' + p.last).toUpperCase()),
        h('div', { class: 'sub' }, `${posLabel(p)} · age ${p.age} · OVR ${ovrInt(p)} · POT ${potTxt(p)} · rookie contract`),
        h('div', { class: 'row' }, h('label', null, 'FIRST ', firstIn), h('label', null, 'LAST ', lastIn), h('label', null, '# ', numIn)),
        h('div', { class: 'row' }, posSel, handSel, focusSel), relBox, msg,
        h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => {
          const n = +numIn.value; if (!(n >= 1 && n <= 99)) { msg.textContent = 'Jersey numbers go from 1 to 99.'; return; }
          if (numberTaken(save, user, n, release)) { msg.textContent = `#${n} is already taken.`; return; }
          const err = rdSignMine(save, kid, { first: firstIn.value, last: lastIn.value, num: n, spos: posSel ? posSel.value : null, hand: handSel ? handSel.value : null, focus: focusSel.value || null }, release);
          if (err) { msg.textContent = err; return; }
          close(); Store.autosave(save); toast('Signed!'); render(); } }, 'SIGN HIM'), h('button', { onclick: close }, 'CANCEL')));
    });
  };
  // a claimed veteran: he keeps his contract; make room if you have to
  const vetDlg = kid => {
    const p = d.cls.find(x => x.kid === kid), r = Pl(p.vetPid); if (!r) return;
    modal(close => {
      const full = orgFull(user, r.pos); let release = null;
      const relBox = h('div'), msg = h('div', { class: 'sub red' });
      const renderRel = () => { relBox.innerHTML = ''; if (!full) return;
        const ids = rosterSkaters(user).concat(farmIds(user).filter(id => Pl(id).pos !== 'G'));
        relBox.appendChild(h('div', { class: 'panel', style: { margin: '10px 0 0', borderColor: '#a3394a' } }, h('h3', { style: { marginTop: 0 } }, 'ROSTER FULL: CHOOSE WHO TO RELEASE'),
          h('div', { class: 'grid g3' }, ids.map(id => { const q = Pl(id); return h('div', { class: 'pcard' + (release === id ? ' sel' : ''), onclick: () => { release = id; renderRel(); } }, h('div', null, '#' + q.num + ' ' + pname(q)), h('div', { class: 'muted' }, `Age ${q.age} · OVR ${ovrInt(q)}`)); })))); };
      renderRel();
      return h('div', null, h('h2', null, 'ADD ' + (r.first + ' ' + r.last).toUpperCase()),
        h('div', { class: 'sub' }, `${posLabel(r)} · age ${r.age} · OVR ${ovrInt(r)} · from the ${T(p.vetFrom).nick} · his contract comes with him (${fmtM(salOf(r))} a season${r.contract ? `, ${r.contract.yrs} season${r.contract.yrs === 1 ? '' : 's'} left` : ''})`),
        relBox, msg,
        h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => { const err = rdSignMine(save, kid, {}, release); if (err) { msg.textContent = err; return; } close(); Store.autosave(save); toast('He\'s yours!'); render(); } }, 'ADD HIM'), h('button', { onclick: close }, 'CANCEL')));
    });
  };
  // the protection list: 8 skaters are safe, the best of the rest is exposed on draft night
  const protectDlg = () => {
    const sk = () => rosterSkaters(user).map(Pl).sort((a, b) => ovrInt(b) - ovrInt(a));
    user.protect = protectedOf(save, user);
    modal(close => {
      const box = h('div');
      const draw = () => { box.innerHTML = '';
        const ex = exposedOf(save, user);
        box.appendChild(h('div', null, h('h2', null, `PROTECTION LIST (${user.protect.length}/${PROTECT_N})`),
          h('div', { class: 'sub' }, `Protect ${PROTECT_N} players. Your best unprotected player is exposed: on draft night another club may claim him. Keepers and farm players are always safe.`),
          h('div', { class: 'grid g3' }, sk().map(q => { const on = user.protect.includes(q.id); return h('div', { class: 'pcard' + (on ? ' sel' : ''), onclick: () => { if (on) user.protect.splice(user.protect.indexOf(q.id), 1); else if (user.protect.length < PROTECT_N) user.protect.push(q.id); else return toast(`You can protect ${PROTECT_N}. Unprotect someone first.`); draw(); } },
            h('div', null, (on ? '🛡 ' : '') + '#' + q.num + ' ' + pname(q)), h('div', { class: 'muted' }, `${posShort(q.spos)} · age ${q.age} · OVR ${ovrInt(q)}`)); })),
          h('div', { class: 'sub gold', style: { marginTop: '8px' } }, ex ? `EXPOSED: ${ex.first} ${ex.last} (${posShort(ex.spos)}, ${ovrInt(ex)})` : 'Nobody exposed.'),
          h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => { Store.autosave(save); close(); render(); } }, 'DONE'))));
      };
      draw(); return box;
    }, true);
  };
  // trading picks with one club
  const tradeDlg = (aiId0) => {
    const tr = { ai: aiId0 || null, give: [], get: [] };
    modal(close => {
      const box = h('div');
      const draw = () => {
        box.innerHTML = '';
        const owners = save.teamOrder.filter(id => id !== save.userTeamId && teamPicks(save, id).length);
        if (!tr.ai || !owners.includes(tr.ai)) tr.ai = owners[0];
        const mine = teamPicks(save, save.userTeamId), theirs = teamPicks(save, tr.ai);
        const col = (title, arr, bag) => h('div', { class: 'panel', style: { flex: 1 } }, h('h3', { style: { marginTop: 0 } }, title),
          arr.length ? arr.map(o => h('label', { class: 'dpick' }, h('input', { type: 'checkbox', checked: bag.includes(o.key), onchange: e => { if (e.target.checked) bag.push(o.key); else bag.splice(bag.indexOf(o.key), 1); draw(); } }), ` ${o.label} · value ${Math.round(o.value)}`)) : h('div', { class: 'muted', style: { fontSize: '8px' } }, 'No picks.'));
        const ev = tr.give.length && tr.get.length ? rdTradeEval(save, tr.ai, tr.give, tr.get) : null;
        box.appendChild(h('div', null, h('h2', null, 'TRADE PICKS'),
          h('div', { class: 'sub' }, 'Move up for the player you want, or move down and collect more picks. Next year\'s picks are valued by where that club is projected to finish. Rebuilding clubs value picks a little more; contenders a little less.'),
          h('label', null, 'CLUB ', h('select', { onchange: e => { tr.ai = e.target.value; tr.get = []; draw(); } }, owners.map(id => h('option', { value: id, selected: id === tr.ai }, `${T(id).nick} (${GM_TYPES[gmOf(save, T(id))]})`)))),
          h('div', { class: 'row', style: { alignItems: 'stretch' } }, col('YOU GIVE', mine, tr.give), col('YOU GET', theirs, tr.get)),
          ev ? h('div', { class: ev.ok ? 'green' : 'gold', style: { fontSize: '8px', margin: '6px 0' } }, ev.msg) : h('div', { class: 'muted', style: { fontSize: '7px' } }, 'Choose picks on both sides.'),
          h('div', { class: 'row' }, h('button', { class: 'primary', disabled: !(ev && ev.ok), onclick: () => { rdTradeDo(save, tr.ai, tr.give, tr.get); Store.autosave(save); close(); toast('Trade done!'); render(); } }, 'MAKE THE TRADE'), h('button', { onclick: close }, 'CLOSE'))));
      };
      draw(); return box;
    }, true);
  };
  const render = () => {
    body.innerHTML = '';
    if (onClock()) rdMaybeOffer(save);
    const S = CLASS_STR[d.str], cur = rdCur(d), mineLeft = rdPicksOf(d, save.userTeamId);
    // header
    const nextMine = mineLeft[0], k = nextMine ? d.order.indexOf(nextMine) - d.at : null;
    const upNext = d.order.slice(d.at, d.at + 5);
    body.appendChild(h('div', { class: 'panel dhead' }, cur && draftDay ? badge(T(cur.team), 40) : badge(user, 40),
      h('div', { style: { flex: 1 } },
        h('div', { class: 'gold', style: { fontSize: '11px' } }, `${save.season.year + 1} DRAFT · CLASS RATED `, h('span', { class: 'dclass c-' + d.str }, S.name)),
        d.done ? h('div', { style: { fontSize: '8px', marginTop: '6px' } }, 'The draft is complete.')
          : !draftDay ? h('div', { style: { fontSize: '8px', marginTop: '6px', lineHeight: 1.7 } }, 'SCOUTING HALF: the draft is held after free agency. Scout prospects, build your list and trade picks now.')
          : h('div', { style: { fontSize: '8px', marginTop: '6px' } }, `ROUND ${cur.r} · PICK #${cur.no} · `, onClock() ? h('span', { class: 'gold dclock' }, '★ YOU ARE ON THE CLOCK') : 'On the clock: ' + gmLine(save, cur.team)),
        !d.done && nextMine ? h('div', { class: draftDay && k > 0 && k <= 3 ? 'dwarn' : 'muted', style: { fontSize: '8px', marginTop: '6px' } }, draftDay && k > 0 && k <= 3 ? `⚠ YOUR PICK IS IN ${k}!` : k === 0 ? `Your pick: #${nextMine.no}` : `Your next pick: #${nextMine.no}${draftDay ? `, in ${k} picks` : ''}.`) : null,
        !d.done ? h('div', { class: 'muted', style: { fontSize: '7px', marginTop: '4px' } }, 'Order: ' + upNext.map(o => (o.team === save.userTeamId ? 'YOU' : T(o.team).abbr) + (o.team !== o.orig ? '*' : '')).join(' → ') + (d.order.length > d.at + 5 ? ' …' : '')) : null),
      draftDay && !d.done && !onClock() ? h('button', { onclick: () => { sim(1); Store.autosave(save); render(); } }, 'NEXT PICK ▶') : null,
      draftDay && !d.done && !onClock() ? h('button', { class: 'primary', onclick: () => { sim(); Store.autosave(save); render(); } }, 'SIM TO MY PICK ▶▶') : null,
      draftDay && !d.done ? h('button', { class: 'small ghost', onclick: () => confirmDlg('Let your scouts make the rest of your picks?', 'AUTO-DRAFT', () => { rdAutoAll(save); Store.autosave(save); render(); }) }, 'AUTO-DRAFT') : null));
    // a club calls
    for (const of of d.offers.filter(x => cur && x.no === cur.no)) body.appendChild(h('div', { class: 'panel doffer' }, h('span', { class: 'gold' }, '☎ TRADE OFFER: '), of.msg,
      h('button', { class: 'small primary', onclick: () => { rdTradeDo(save, of.teamId, ['c' + of.no], of.get); Store.autosave(save); toast('Traded down!'); render(); } }, 'ACCEPT'),
      h('button', { class: 'small', onclick: () => { d.offers = []; render(); } }, 'NO THANKS')));
    // your unsigned picks
    if (d.mine.length) body.appendChild(h('div', { class: 'panel', style: { borderColor: '#ffd23f' } }, h('h3', { style: { marginTop: 0 } }, 'YOUR PICKS TO SIGN'),
      h('div', { class: 'sub' }, 'Sign them to rookie contracts, or let them go: an unsigned pick is offered to the other clubs, or becomes a free agent. Unsigned picks leave when the season starts.'),
      d.mine.map(kid => { const p = d.cls.find(x => x.kid === kid), pk = d.picks.find(x => x.kid === kid);
        return h('div', { class: 'row', style: { alignItems: 'center', margin: '4px 0' } }, portrait(p, user, 28), h('div', { style: { flex: 1, fontSize: '8px' } }, `#${pk.no} · ${p.first} ${p.last} · ${posLabel(p)} · OVR ${ovrInt(p)} · POT ${potTxt(p)}`),
          h('button', { class: 'small primary', onclick: () => signDlg(kid) }, p.vetPid ? 'ADD' : 'SIGN'), h('button', { class: 'small danger', onclick: () => confirmDlg(`Let ${p.last} go? Another club may sign him.`, 'LET HIM GO', () => { rdLetGo(save, kid); Store.autosave(save); render(); }, true) }, 'LET GO')); })));
    // camp invite: first claim on one undrafted prospect
    if (d.campPool && !d.campDone) body.appendChild(h('div', { class: 'panel', style: { borderColor: '#ff8af0' } }, h('h3', { style: { marginTop: 0 } }, 'CAMP INVITE (SEASON FINALE CUP)'),
      h('div', { class: 'sub' }, 'Invite one of the best undrafted prospects to camp before the rest of the league can sign them.'),
      h('div', { class: 'row', style: { flexWrap: 'wrap' } }, d.campPool.map(k => { const p = d.cls.find(x => x.kid === k); return h('button', { class: 'small', onclick: () => { rdCampPick(save, k); Store.autosave(save); render(); } }, `${p.first[0]}. ${p.last} · ${posKey(p)} · ${ovrInt(p)} / ${potTxt(p)}`); }),
        h('button', { class: 'small ghost', onclick: () => { rdCampPick(save, null); Store.autosave(save); render(); } }, 'NO THANKS'))));
    const left = rdLeft(d);
    const O = { f, watch: d.watch, list: d.done ? [] : left, tiers: ['gen', 'franchise', 'top', 'mid', 'imp', 'veteran'], idOf: p => p.kid, value: p => rdBoardValue(save, p), fit: p => fitChip(save, p),
      canPick: p => p && p.vetFrom === save.userTeamId ? 'He is your own player.' : onClock() ? null : draftDay ? 'Not your pick.' : 'The draft has not started.', onPick: pick, rerender: render, extra: scoutBtn };
    const sp = f.sel && d.cls.find(x => x.kid === f.sel);
    const board = d.done ? h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'ALL PICKS'), h('table', null, d.picks.map(x => h('tr', { class: x.user ? 'me' : '' }, h('td', null, '#' + x.no), h('td', { class: 'l' }, T(x.teamId).nick), h('td', { class: 'l' }, x.name), h('td', null, x.pos), h('td', { class: 'gold' }, x.ovr), h('td', { class: 'muted' }, x.pot)))))
      : draftBoard(O);
    const scoutPanel = h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'SCOUTING'),
      h('div', { style: { fontSize: '9px' } }, h('span', { class: 'gold' }, rdScoutLeft(d)), ' point' + (rdScoutLeft(d) === 1 ? '' : 's') + ' left'),
      h('div', { class: 'muted', style: { fontSize: '7px', lineHeight: 1.7, margin: '4px 0' } }, 'One point scouts a prospect: his range narrows, his traits show, and anything the scouts missed (a late bloomer, a false bust alarm) comes out. A point can also buy a training-camp focus (+1 to one stat) when you sign a pick.'),
      h('div', { class: 'row' },
        h('button', { class: 'small', disabled: d.scout.bought >= SCOUT_BUY_MAX || d.done, onclick: () => { const e = rdBuyScout(save); toast(e || 'Extra scouting trip booked: +1 point.'); Store.autosave(save); render(); } }, `+1 POINT (${fmtM(SCOUT_BUY)}) ${SCOUT_BUY_MAX - d.scout.bought}/${SCOUT_BUY_MAX}`),
        scoutLvl(user) < SCOUT_STAFF.length ? h('button', { class: 'small', onclick: () => confirmDlg(`Upgrade your scouting department to level ${scoutLvl(user) + 1} for ${fmtM(SCOUT_STAFF[scoutLvl(user)])}? Every future draft gives you one more point.`, 'UPGRADE', () => { const e = rdBuyStaff(save); toast(e || 'Scouting department upgraded!'); Store.autosave(save); render(); }) }, `DEPARTMENT LV ${scoutLvl(user)} → ${scoutLvl(user) + 1} (${fmtM(SCOUT_STAFF[scoutLvl(user)])})`) : h('span', { class: 'green', style: { fontSize: '7px' } }, 'DEPARTMENT: MAX LEVEL')),
      h('div', { class: 'muted', style: { fontSize: '7px', marginTop: '4px' } }, `Funds: ${fmtM(finOf(user).cash)}`));
    const allMine = teamPicks(save, save.userTeamId);
    const picksPanel = h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'YOUR PICKS'),
      allMine.length ? h('div', { style: { fontSize: '8px', lineHeight: 2 } }, allMine.map(o => h('div', { class: o.now ? '' : 'muted' }, o.label))) : h('div', { class: 'muted', style: { fontSize: '8px' } }, 'You have no picks.'),
      h('button', { class: 'small', onclick: () => tradeDlg() }, '⇄ TRADE PICKS'));
    // the side column in tabs: the selected prospect first, then scouting, picks, best available and the ticker
    const right = h('div', { class: 'dright', style: { flex: '1 1 300px', minWidth: 0 } }, tabbed('draftside', [
      d.done ? null : { label: 'PLAYER', el: () => draftDetail(sp && !sp.taken ? sp : null, O) },
      draftDay && !d.done ? { label: 'BALL TALK', el: () => talkPanel() } : null,
      { label: 'SCOUTING', el: () => h('div', null, scoutPanel, picksPanel) },
      !draftDay ? { label: 'PROTECT', el: () => { const ex = exposedOf(save, user); return h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'PROTECTION LIST'),
        h('div', { class: 'sub' }, `Every club protects ${PROTECT_N} players before draft night. The best unprotected ones are exposed: any club may draft them, contract and all.`),
        h('div', { class: 'sub gold' }, ex ? `You would expose: ${ex.first} ${ex.last} (${posShort(ex.spos)}, ${ovrInt(ex)})` : 'Nobody exposed.'),
        h('button', { class: 'small primary', onclick: () => protectDlg() }, '🛡 SET YOUR LIST')); } } : null,
      d.done ? null : { label: 'BEST', el: () => bestByPos(left, O.value, p => { f.sel = p.kid; UI.tabMem.draftside = 0; render(); }) },
      { label: 'NEWS', el: () => tickerPanel(d.log.map(t => ({ t, cls: /YOU|you send/.test(t) ? 'gold' : /TRADE|LOTTERY/.test(t) ? 'dtrade' : '' }))) }], { onShow: () => setTimeout(fitDraft, 0) }));
    body.appendChild(h('div', { class: 'dgrid' }, h('div', { style: { flex: '1 1 640px', minWidth: 0 } }, board), right));
    setTimeout(fitDraft, 0);
  };
  // no scrolling: drop the oldest PUCK TALK lines, then shorten the board, until the screen fits
  const fitDraft = () => {
    const app = document.getElementById('app'); if (!app || !body.isConnected) return;
    const tb = body.querySelector('.dtable'), tk = body.querySelector('.dtalk');
    for (let g = 0; g < 40 && app.scrollHeight > app.clientHeight + 1; g++) {
      const tl = tk ? tk.querySelectorAll('.dtalkl') : []; if (tl.length > 3) { tl[tl.length - 1].remove(); continue; }
      const lb = body.querySelector('.dboard'), rb = body.querySelector('.dright');
      if (tb && tb.clientHeight > 90 && lb && rb && lb.getBoundingClientRect().bottom >= rb.getBoundingClientRect().bottom - 2) { tb.style.maxHeight = (tb.clientHeight - 20) + 'px'; continue; }
      break;
    }
    // art audit (Nov 22): the board's starting height is a fixed guess, which left ~200px empty under it at 1280x720
    // (about 4 prospects visible). Grow it into whatever room is left on the screen, never past its own rows.
    if (tb && app.scrollHeight <= app.clientHeight + 1 && tb.scrollHeight > tb.clientHeight + 2) {
      const z = parseFloat(getComputedStyle(app).zoom) || 1, scr = body.closest('.screen') || body;
      const bottom = Math.max(...[...scr.children].map(e => e.getBoundingClientRect().bottom));
      const free = Math.floor((app.getBoundingClientRect().bottom - bottom) / z) - 10;
      if (free > 16) tb.style.maxHeight = Math.min(tb.scrollHeight, tb.clientHeight + free) + 'px';
      if (app.scrollHeight > app.clientHeight + 1) tb.style.maxHeight = Math.max(90, tb.clientHeight - (app.scrollHeight - app.clientHeight) - 2) + 'px';
    }
  };
  const talkPanel = () => h('div', { class: 'panel dtalk' }, h('h3', { style: { marginTop: 0 } }, '📺 BALL TALK · DRAFT NIGHT'),
    (d.talk || []).slice(-9).reverse().map(x => h('div', { class: 'dtalkl' }, h('b', null, x.who + ': '), x.txt)));
  if (draftDay && !d.done && !d.talkOpen) {
    rdNightOpen(save); Store.autosave(save);
    setTimeout(() => modal(close => h('div', { class: 'dnight' }, h('div', { class: 'big gold' }, '📺 BALL TALK: DRAFT NIGHT'),
      (d.talk || []).map(x => h('div', { class: 'dtalkl' }, h('b', null, x.who + ': '), x.txt)),
      h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '10px' } }, h('button', { class: 'primary', onclick: close }, 'TO THE DRAFT FLOOR ▶')))), 0);
  }
  render();
  return h('div', { class: 'screen wide draftS' }, header('ROOKIE DRAFT', () => go(scrHub)), body);
}
