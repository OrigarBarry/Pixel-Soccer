// ====================================================================
//  PLAYER MORALE: ways to keep your players happy, on top of the mood his motive gives him (moodBase in finance.js).
//  Raise his pay mid-contract, pay a one-time bonus, or make him a promise (top-line minutes / the starter's net,
//  a letter, a tournament win, the league title). Promises are announced in the news, and so is keeping or breaking one.
//  It never punishes a team that ignores it: with no raises, bonuses or promises, mood is exactly what it was before.
//  Effects: a happy player asks for less and plays a touch better (+1.5%); a long-unhappy one says so in the news
//  and asks for more at contract time. Nobody plays worse because of it.
// ====================================================================
const MORALE = {
  fade: 15,                               // days a bonus boost takes to fade
  raiseMin: 0.05, raiseMax: 0.5,          // a raise: +5% to +50% of his current salary
  bonusPct: [0.05, 0.10, 0.20],           // bonus sizes, as a share of his salary
  happy: 75, happyLift: 0.015,            // 75+ mood: +1.5% to his ratings in games
  unhappy: 25, unhappyDays: 8,            // under 25 for 8 game days: he says so (once a season)
  keptBoost: 10, keptLen: 25, brokeHit: 16, brokeLen: 25, cooldown: 10,
};
const PROMISES = {
  ice:    { name: p => p.pos === 'G' ? 'the No. 1 shirt' : 'first-team minutes', due: 4, boost: 14, motive: 'scorer',
            news: (n, p) => `${n} has been promised ${p.pos === 'G' ? 'the starting job in net' : 'a spot on the top line'}.` },
  letter: { name: () => 'a letter (C or A)', due: 4, boost: 12, motive: 'leader', news: n => `${n} has been promised a letter on his jersey.` },
  tour:   { name: (p, pr) => 'a ' + (pr && pr.compName || 'tournament') + ' win', boost: 10, motive: 'winner', news: (n, p, pr) => `The club has promised ${n} it will win the ${pr.compName}.` },
  title:  { name: () => 'a League Championship', boost: 14, motive: 'winner', news: n => `The club has promised ${n} a run at the League Championship this season.` },
};
const mDay = save => (save.season ? save.season.num : save.seasonNum || 1) * 1000 + (save.season ? save.season.dayNo || 0 : 999);
const moraleOf = p => p.morale || (p.morale = { fx: [], prom: [], hist: [], low: 0 });
const mName = p => '#' + p.num + ' ' + p.first + ' ' + p.last;
function moraleFx(save, p) {                                        // the boosts and hits still in effect, faded to today
  const d = mDay(save), M = p.morale; if (!M) return [];
  return M.fx.map(f => ({ label: f.label, v: Math.round(f.v * Math.max(0, 1 - (d - f.d) / f.len)) })).filter(f => f.v);
}
function moodOf(save, p) {
  const b = moodBase(save, p); if (!p.teamId || !save.teams[p.teamId]) return b;
  const parts = moraleFx(save, p);
  for (const pr of (p.morale ? p.morale.prom : [])) if (!pr.res) parts.push({ label: 'Promised ' + pr.label, v: pr.boost });
  if (typeof sponsorMood === 'function') { const sm = sponsorMood(p); if (sm) parts.push(sm); }
  { const t = save.teams[p.teamId], L = t && t.leaders;                // wanted a letter, and has more standing than someone wearing one
    if (L && p.teamId === save.userTeamId && motiveOf(p) === 'leader' && !leaderOf(t, p.id) && typeof standingOf === 'function') {
      const me = standingOf(p, t), low = [L.c, ...L.a].filter(Boolean).map(id => standingOf(save.players[id], t));
      if (low.length && Math.min(...low) < me - 10) parts.push({ label: 'Passed over for a letter', v: -6 });
    } }
  if (!parts.length) return Object.assign({ base: b.v, parts }, b);
  const add = clampF(parts.reduce((s, x) => s + x.v, 0), -35, 35);
  return { v: Math.round(clampF(b.v + add, 0, 100)), why: b.why, base: b.v, parts };
}
const motiveMul = (p, kind) => PROMISES[kind] && PROMISES[kind].motive === motiveOf(p) ? 1.4 : 1;
// ---------- actions
function moraleRaiseInfo(save, p) {
  const M = moraleOf(p), c = p.contract, sn = save.season ? save.season.num : save.seasonNum;
  if (!c || c.yrs <= 0) return { ok: false, why: 'He has no contract to raise.' };
  if (M.raiseS === sn) return { ok: false, why: 'He already got a raise this season.' };
  return { ok: true, min: Math.round(c.sal * (1 + MORALE.raiseMin) / 10) * 10, max: Math.round(c.sal * (1 + MORALE.raiseMax) / 10) * 10 };
}
function moraleRaise(save, p, newSal) {
  const ri = moraleRaiseInfo(save, p); if (!ri.ok) return ri.why;
  newSal = Math.round(clampF(newSal, ri.min, ri.max) / 10) * 10;
  const pct = newSal / p.contract.sal - 1, M = moraleOf(p);
  p.contract.sal = newSal; M.raiseS = save.season ? save.season.num : save.seasonNum;
  // a money-first player's mood follows his pay already (moodBase); everyone else feels valued for a while
  if (motiveOf(p) !== 'money') M.fx.push({ label: 'Got a raise', v: Math.round(Math.min(15, pct * 60)), d: mDay(save), len: 30 });
  pushNews(save, `${mName(p)} gets a raise to ${fmtM(newSal)} a season.`);
  return null;
}
function moraleBonusInfo(save, p) {
  const M = moraleOf(p), sn = save.season ? save.season.num : save.seasonNum, n = M.bonusS === sn ? M.bonusN || 0 : 0;
  const sal = p.contract ? p.contract.sal : worth(p), cash = finOf(save.teams[p.teamId]).cash;
  return MORALE.bonusPct.map(pc => { const amt = Math.max(10, Math.round(sal * pc / 10) * 10);
    const v = Math.round(pc * 100 * (motiveOf(p) === 'money' ? 1.5 : 1) / (1 + 0.5 * n));
    return { pc, amt, v, ok: cash >= amt }; });
}
function moraleBonus(save, p, pc) {
  const o = moraleBonusInfo(save, p).find(x => x.pc === pc); if (!o) return 'No such bonus.';
  if (!o.ok) return 'Not enough cash on hand.';
  const M = moraleOf(p), sn = save.season ? save.season.num : save.seasonNum, t = save.teams[p.teamId];
  if (M.bonusS !== sn) { M.bonusS = sn; M.bonusN = 0; }
  M.bonusN++; ledger(t, 'bonus', o.amt);
  M.fx.push({ label: 'Bonus ' + fmtM(o.amt), v: o.v, d: mDay(save), len: MORALE.fade });
  return null;
}
// which promises can be made right now (and why not)
function promiseOptions(save, p) {
  const M = moraleOf(p), d = mDay(save), t = save.teams[p.teamId], out = [];
  const open = k => M.prom.some(x => x.k === k && !x.res), cool = k => M.prom.some(x => x.k === k && x.res === 'broken' && d - x.resD < MORALE.cooldown);
  const why = k => open(k) ? 'Already promised.' : cool(k) ? 'He doesn\'t believe you yet (you broke this one recently).' : null;
  out.push({ k: 'ice', label: PROMISES.ice.name(p), no: why('ice') || (promiseKept(save, p, { k: 'ice' }) ? 'He already has it.' : null), hint: `Within ${PROMISES.ice.due} game days` });
  out.push({ k: 'letter', label: PROMISES.letter.name(p), no: why('letter') || (leaderOf(t, p.id) ? 'He already wears one.' : null), hint: `Within ${PROMISES.letter.due} game days` });
  const se = save.season, next = se && !se.done ? upcomingComps(save).find(c => TOUR_KEYS.includes(c.key) && (se.comps[c.key] ? (se.comps[c.key].field || se.comps[c.key].seeds).includes(t.id) : (typeof qualifiesFor !== 'function' || c.key === 'inv' || qualifiesFor(save, c.key, t.id)))) : null;
  out.push({ k: 'tour', label: next ? (/^[AEIOU]/.test(next.name) ? 'an ' : 'a ') + next.name + ' win' : 'a tournament win', comp: next && next.key, compName: next && next.name, no: why('tour') || (next ? null : 'No tournament ahead that you can enter.'), hint: next ? 'Decided when it ends' : '' });
  const po = se && se.comps.po;
  out.push({ k: 'title', label: PROMISES.title.name(), no: why('title') || (!se || se.done || (po && (po.done || !po.seeds.includes(t.id))) ? 'Too late this season.' : null), hint: 'Decided at the end of the playoffs' });
  return out;
}
function makePromise(save, p, k) {
  const o = promiseOptions(save, p).find(x => x.k === k); if (!o || o.no) return o ? o.no : 'Not possible.';
  const M = moraleOf(p), d = mDay(save), P0 = PROMISES[k];
  const pr = { k, label: o.label, d, due: P0.due ? d + P0.due : null, comp: o.comp || (k === 'title' ? 'po' : null), compName: o.compName, s: save.season.num, boost: Math.round(P0.boost * motiveMul(p, k)) };
  M.prom.push(pr); if (M.prom.length > 12) M.prom.splice(0, M.prom.length - 12);
  pushNews(save, P0.news(mName(p), p, pr));
  return null;
}
// TEAM PROMISES (Nov 21): the team-wide ones (the next tournament, the League Championship) made to the whole roster at
// once. Everyone who can take it gets it (one news line, not twenty); anyone who already has it, or doesn't believe you
// after a broken one, is skipped. Kept or broken, each player settles as usual.
const TEAM_PROMISE_KEYS = ['tour', 'title'];
function teamPromisePreview(save, team, k) {
  const ids = (typeof rosterIds === 'function' ? rosterIds(team) : []).filter(id => save.players[id]);
  const rows = ids.map(id => { const p = save.players[id], o = promiseOptions(save, p).find(x => x.k === k); return { p, o, ok: !!(o && !o.no), boost: Math.round(PROMISES[k].boost * motiveMul(p, k)) }; });
  const any = rows.find(r => r.o) || {};
  const has = rows.filter(r => (moraleOf(r.p).prom || []).some(x => x.k === k && !x.res)).length;
  return { k, label: any.o ? any.o.label : PROMISES[k].name(), hint: any.o ? any.o.hint : '', rows, n: rows.filter(r => r.ok).length, skip: rows.filter(r => !r.ok && !(moraleOf(r.p).prom || []).some(x => x.k === k && !x.res)), has };
}
function makeTeamPromise(save, team, k) {
  const pv = teamPromisePreview(save, team, k); if (!pv.n) return 'Nobody on the roster can take this promise right now.';
  const before = (save.news || []).slice();
  for (const r of pv.rows) if (r.ok) makePromise(save, r.p, k);
  save.news = before;                                                                      // one line for the team instead of one each
  pushNews(save, k === 'title' ? `You've promised the whole room (${pv.n} players) a run at the League Championship this season.` : `You've promised the whole room (${pv.n} players) ${pv.label}.`);
  return null;
}
function teamPromiseDlg(save, team, onDone) {
  modal(close => {
    const box = h('div');
    const draw = () => {
      box.innerHTML = '';
      box.appendChild(h('h2', { style: { marginTop: 0 } }, 'TEAM PROMISE'));
      box.appendChild(h('div', { class: 'sub' }, 'Promise the whole roster at once. Keep it and everyone\'s mood (and your reputation) goes up; break it and everyone remembers.'));
      for (const k of TEAM_PROMISE_KEYS) {
        const pv = teamPromisePreview(save, team, k), why = pv.skip.length ? pv.skip.map(r => `#${r.p.num} ${r.p.last}: ${r.o ? r.o.no : 'not possible'}`).join(' · ') : '';
        box.appendChild(h('div', { class: 'panel', style: { margin: '6px 0' } },
          h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            h('div', { style: { flex: 1 } }, h('div', { class: 'gold' }, pv.label.charAt(0).toUpperCase() + pv.label.slice(1)), h('div', { class: 'muted', style: { fontSize: '.8em' } }, (pv.hint ? pv.hint + ' · ' : '') + (pv.has ? `✓ promised to ${pv.has} · ` : '') + `${pv.n} of ${pv.rows.length} players can take it` + (pv.n ? ` · about +${Math.round(pv.rows.filter(r => r.ok).reduce((a, r) => a + r.boost, 0) / pv.n)} mood each` : ''))),
            pv.n ? h('button', { class: 'primary small', onclick: () => { const err = makeTeamPromise(save, team, k); if (err) toast(err); else toast('Promised to ' + pv.n + ' players.'); Store.autosave(save); draw(); if (onDone) onDone(); } }, 'PROMISE ALL') : null),
          why ? h('div', { class: 'muted', style: { fontSize: '.75em', marginTop: '3px' }, 'data-help': why }, `Skipped: ${pv.skip.length} (hover to see why)`) : null));
      }
      box.appendChild(h('div', { class: 'row' }, h('button', { onclick: close }, 'DONE')));
    };
    draw(); return box;
  });
}
function promiseKept(save, p, pr) {
  const t = save.teams[p.teamId]; if (!t) return false;
  if (pr.k === 'ice') return p.pos === 'G' ? t.roster.goalies[0] === p.id : (t.roster.lines[0] || []).includes(p.id);
  if (pr.k === 'letter') return !!leaderOf(t, p.id);
  const c = save.season && save.season.num === pr.s ? save.season.comps[pr.comp] : null;
  return !!(c && c.done && c.champion === t.id);
}
// settle promises that are due (kept or broken); called on every new game day and when the hub opens
function promiseSettle(save, p) {
  const M = p.morale; if (!M) return;
  const d = mDay(save), se = save.season;
  for (const pr of M.prom) {
    if (pr.res) continue;
    let res = null;
    if (p.teamId !== save.userTeamId) res = 'void';                                  // traded or gone: it no longer applies
    else if (promiseKept(save, p, pr)) res = (pr.k === 'ice' || pr.k === 'letter') ? (d >= pr.due ? 'kept' : null) : 'kept';
    else if (pr.k === 'ice' || pr.k === 'letter') res = d >= pr.due ? 'broken' : null;
    else { const c = se && se.num === pr.s ? se.comps[pr.comp] : null; res = !se || se.num !== pr.s || se.done || (c && c.done) || (pr.k === 'tour' && !c && !upcomingComps(save).some(x => x.key === pr.comp)) ? 'broken' : null; }
    if (!res) continue;
    pr.res = res; pr.resD = d;
    if (res === 'void') continue;
    const mul = motiveMul(p, pr.k);
    if (res === 'kept') { M.fx.push({ label: 'Kept your word', v: Math.round(MORALE.keptBoost * mul), d, len: MORALE.keptLen }); pushNews(save, `Promise kept: ${mName(p)} got ${pr.label}.`); if (typeof gmRep === 'function') gmRep(save, 2); }
    else { M.fx.push({ label: 'Broken promise', v: -Math.round(MORALE.brokeHit * mul), d, len: MORALE.brokeLen }); pushNews(save, `Promise broken: ${mName(p)} was promised ${pr.label} and didn't get it.`); if (typeof gmRep === 'function') gmRep(save, -2); }
  }
}
// ---------- each new game day: settle promises, record the mood line, the happy lift, the unhappy notice
function moraleDay(save) {
  const t = save.teams[save.userTeamId]; if (!t) return;
  const d = mDay(save), sn = save.season ? save.season.num : 0;
  const ids = new Set([...rosterSkaters(t), ...rosterGoalies(t)]);
  for (const id in save.players) { const p = save.players[id]; if (p.morale && p.morale.prom.some(x => !x.res) && !ids.has(id)) promiseSettle(save, p); }
  for (const id of ids) {
    const p = P(save, id); if (!p) continue;
    const M = moraleOf(p); promiseSettle(save, p);
    M.fx = M.fx.filter(f => d - f.d < f.len);
    const v = moodOf(save, p).v;
    if (!M.hist.length || M.hist[M.hist.length - 1].d !== d) { M.hist.push({ d, v }); if (M.hist.length > 30) M.hist.shift(); }
    p.happyLift = v >= MORALE.happy ? MORALE.happyLift : 0;
    M.low = v < MORALE.unhappy ? (M.low || 0) + 1 : 0;
    if (M.low >= MORALE.unhappyDays && M.saidS !== sn) { M.saidS = sn; pushNews(save, `${mName(p)} is unhappy (${moodBase(save, p).why}). A raise, a bonus or a promise could turn it around.`); }
  }
  for (const id in save.players) { const p = save.players[id]; if (p.happyLift && !ids.has(id)) p.happyLift = 0; }
  if (typeof fameDay === 'function') fameDay(save);
}
function moraleCheck(save) { const t = save.teams[save.userTeamId]; if (!t) return; for (const id of [...rosterSkaters(t), ...rosterGoalies(t)]) { const p = P(save, id); if (p && p.morale) promiseSettle(save, p); } }

// ---------- the profile panel: KEEP HIM HAPPY
function moralePanel(save, p, rerender) {
  const t = save.teams[p.teamId]; if (!t || p.teamId !== save.userTeamId || p.status !== 'active') return null;
  const md = moodOf(save, p), M = moraleOf(p), col = v => v >= 60 ? 'green' : v >= 35 ? 'gold' : 'red';
  const msg = h('div', { class: 'sub', style: { minHeight: '1em', margin: '6px 0 0' } });
  const line = (...kids) => h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '3px 0', fontSize: '8px', lineHeight: 1.6 } }, ...kids);
  const act = fn => { const err = fn(); if (err) { msg.className = 'sub red'; msg.textContent = err; return; } Store.autosave(save); rerender(); };
  // mood breakdown + trend
  const spark = h('canvas', { width: 150, height: 34, class: 'px', style: { width: '150px', height: '34px', background: '#0b1424', borderRadius: '3px' } });
  { const c = spark.getContext('2d'), H = M.hist.slice(-30); c.fillStyle = '#ffffff22'; c.fillRect(0, 17, 150, 1);
    if (H.length > 1) { c.strokeStyle = '#7ec8ff'; c.lineWidth = 2; c.beginPath(); H.forEach((x, i) => { const X = 3 + i * 144 / (H.length - 1), Y = 31 - x.v * 0.28; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.stroke(); }
    else { c.fillStyle = '#ffffff66'; c.font = '7px monospace'; c.fillText('trend builds game by game', 6, 13); } }
  const parts = [line(h('span', { class: 'muted' }, motiveInfo(p).name + ': ' + md.why), h('span', { class: col(md.base ?? md.v) }, String(md.base ?? md.v)))]
    .concat((md.parts || []).map(x => line(h('span', { class: 'muted' }, x.label), h('span', { class: x.v >= 0 ? 'green' : 'red' }, (x.v >= 0 ? '+' : '') + x.v))));
  // raise
  const ri = moraleRaiseInfo(save, p);
  const raiseBox = ri.ok ? (() => {
    const inp = h('input', { type: 'range', min: ri.min, max: ri.max, step: 10, value: ri.min, style: { width: '140px' } });
    const lab = h('span', { class: 'gold' }, fmtM(ri.min));
    inp.oninput = () => { lab.textContent = fmtM(+inp.value) + ' (+' + Math.round((+inp.value / p.contract.sal - 1) * 100) + '%)'; };
    inp.oninput();
    return h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' } }, h('span', { class: 'sub' }, `Now ${fmtM(p.contract.sal)} · ${p.contract.yrs} yr left →`), inp, lab,
      h('button', { class: 'small', onclick: () => confirmDlg(`Raise ${p.last} to ${fmtM(+inp.value)} a season for the rest of his deal? This can't be undone.`, 'GIVE RAISE', () => act(() => moraleRaise(save, p, +inp.value))) }, 'GIVE RAISE'));
  })() : h('div', { class: 'sub muted' }, ri.why);
  // bonus
  const bonusRow = h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-start', marginTop: '4px' } }, moraleBonusInfo(save, p).map(o => h('button', { class: 'small', disabled: !o.ok, title: o.ok ? '' : 'Not enough cash on hand',
    onclick: () => act(() => moraleBonus(save, p, o.pc)) }, `${fmtM(o.amt)}  +${o.v}`)));
  // promises
  const open = M.prom.filter(x => !x.res), d = mDay(save);
  const promRows = promiseOptions(save, p).map(o => line(
    h('div', { style: { flex: 1 } }, o.label.charAt(0).toUpperCase() + o.label.slice(1), o.hint ? h('div', { class: 'muted', style: { fontSize: '.8em' } }, o.hint) : null),
    o.no ? h('span', { class: 'muted', style: { fontSize: '.8em', textAlign: 'right', maxWidth: '45%' } }, o.no) : h('button', { class: 'small', onclick: () => act(() => makePromise(save, p, o.k)) }, 'PROMISE +' + Math.round(PROMISES[o.k].boost * motiveMul(p, o.k)))));
  const recent = M.prom.filter(x => x.res && x.res !== 'void').slice(-3).reverse();
  return h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'KEEP HIM HAPPY ', h('span', { class: col(md.v) }, `· MOOD ${md.v}/100`), md.v >= MORALE.happy ? h('span', { class: 'chip good', style: { marginLeft: '6px' } }, 'HAPPY: +1.5% IN GAMES') : null),
    // three columns: why he feels this way · money (raise, bonus) · promises; the PUCK TALK spotlight lives on the SPOTLIGHT tab
    h('div', { class: 'mgrid' },
      h('div', null, h('div', { class: 'sub gold' }, 'WHY'), parts, h('div', { style: { marginTop: '6px' } }, spark),
        h('div', { class: 'hint' }, 'Happy players ask for less and play a little better.')),
      h('div', null,
        h('div', { class: 'sub gold', 'data-help': 'A raise lasts for the rest of his contract.' }, 'RAISE'), raiseBox,
        h('div', { class: 'sub gold', style: { marginTop: '8px' }, 'data-help': 'Paid from team funds. The mood boost fades over about ' + MORALE.fade + ' game days.' }, 'ONE-TIME BONUS · funds ' + fmtM(finOf(t).cash)), bonusRow),
      h('div', null,
        h('div', { class: 'sub gold', 'data-help': 'Promises are reported in the news: keep them and he trusts you more, break them and it hurts.' }, 'PROMISES'), promRows,
        open.length ? h('div', { class: 'sub', style: { marginTop: '4px' } }, 'Open: ' + open.map(x => x.label + (x.due ? ` (${Math.max(0, x.due - d)} game day${x.due - d === 1 ? '' : 's'} left)` : '')).join(' · ')) : null,
        recent.length ? h('div', { class: 'sub muted' }, recent.map(x => (x.res === 'kept' ? '✓ ' : '✗ ') + x.label).join(' · ')) : null,
        msg)));
}

// the PUCK TALK spotlight for one of your players (shown on his profile's SPOTLIGHT tab)
function spotlightPanel(save, p, rerender) {
  if (typeof spotlightBlock !== 'function' || p.teamId !== save.userTeamId || p.status !== 'active') return null;
  const msg = h('div', { class: 'sub', style: { minHeight: '1em', margin: '6px 0 0' } });
  const line = (...kids) => h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '3px 0', fontSize: '8px', lineHeight: 1.6 } }, ...kids);
  const act = fn => { const err = fn(); if (err) { msg.className = 'sub red'; msg.textContent = err; return; } Store.autosave(save); rerender(); };
  return h('div', { class: 'panel spotp' }, spotlightBlock(save, p, act, line), msg);
}
