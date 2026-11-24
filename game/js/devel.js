'use strict';
// ====================================================================
//  PLAYER DEVELOPMENT DURING THE SEASON
//  1. Development focus: pick one rating for up to 5 players. It fills a bar every game day (faster for young
//     players); a full bar is a permanent +1 ("breakthrough").
//  2. Practice plan: the team's practice focus (a group of ratings) and intensity (light / normal / hard).
//     Everyone builds a little general progress; hard practice is faster but tiring, with a small injury risk.
//  3. Mentors: pair a young player with a respected veteran (standing 50+): faster progress, a chance at the end of
//     the season to pick up one of the veteran's traits, and a veteran who wants to lead enjoys it.
//  5. Big moments: a hat trick, a shutout or a playoff overtime winner gives a jump in progress and a small chance
//     at a new trait.
//  6. Coaching staff: skills, defense, conditioning and goalie coaches (levels 0-3, paid per game).
//  9. The DEVELOPMENT tab on the roster: bars, mentors, staff, practice, each player's trend and his projected
//     change next summer; PUCK TALK names a breakout player of the week.
//  The off-season growth was slowed (OFF_DEV) so a prospect takes 3-5 seasons to reach his ceiling, about a third of
//  it from in-season work. Good management can push a player up to about +5 OVR past his scouted ceiling.
//  AI clubs get average automatic development so the league keeps pace.
// ====================================================================
const DEV = {
  focusMax: 5, base: 2.1,                                          // focus progress per game day (before multipliers)
  age: a => a <= 21 ? 1.25 : a <= 24 ? 1 : a <= 28 ? 0.6 : a <= 31 ? 0.35 : 0.2,
  plan: 1.5, light: 0.7, hard: 1.3, rest: 0.4, hardCond: 3, lightCond: 2, hardInj: 0.003,
  mentor: 1.4, mentorTrait: 0.25, mentorStanding: 50, mentorMax: 3,
  coach: 0.15, coachCost: [0, 150, 350, 700],                     // +15% per level; $K per season
  general: 0.4,                                                     // everyone's general practice progress per game day
  overCap: 0.5,                                                     // overall points he can go past his ceiling (≈ +5 OVR)
  overMul: 0.35,                                                    // progress rate once he's past it
  moment: { hat: 45, sho: 45, otw: 60 }, momentTrait: 0.06,
  ai: 0.6,                                                         // AI clubs: automatic, average
};
const PLANS = {
  balanced:   { name: 'BALANCED', keys: null, desc: 'A bit of everything. No bonus, no weak spot.' },
  skating:    { name: 'RUNNING', keys: ['spd', 'sta'], desc: 'Speed and stamina.' },
  shooting:   { name: 'SHOOTING', keys: ['pow', 'acc'], desc: 'Shot power and accuracy.' },
  playmaking: { name: 'PLAYMAKING', keys: ['pas', 'stk', 'fo'], desc: 'Passing, dribbling and kickoffs.' },
  defense:    { name: 'DEFENSE', keys: ['def', 'chk'], desc: 'Positioning, poke tackles and shoulder charges.' },
  goalies:    { name: 'KEEPERS', keys: ['ref', 'pos', 'reb', 'rec'], desc: 'Extra time for the keepers.' },
};
const INTENSITY = { light: { name: 'LIGHT', desc: 'Slower progress, players recover energy.' }, normal: { name: 'NORMAL', desc: 'Steady.' }, hard: { name: 'HARD', desc: 'Faster progress, but tiring and a small injury risk.' }, rest: { name: 'REST', desc: 'No practice: everyone recovers. Almost no progress.' } };
const COACHES = {
  skills:  { name: 'Skills coach', keys: ['pow', 'acc', 'pas', 'stk', 'fo'], desc: 'Shooting, passing, hands and kickoffs.' },
  defense: { name: 'Defense coach', keys: ['def', 'chk'], desc: 'Defense and tackling.' },
  cond:    { name: 'Conditioning coach', keys: ['spd', 'sta'], desc: 'Speed and stamina, and veterans slow down later.' },
  goalie:  { name: 'Keeper coach', keys: ['ref', 'pos', 'reb', 'rec'], desc: 'Every keeper rating.' },
};
const OFF_DEV = 0.5;                                               // off-season growth (league.js develop / draft.js developDv)
const devOf = p => p.dev || (p.dev = { focus: null, prog: 0, gen: 0, mentor: null, over: 0, hist: [] });
const teamDev = t => t.dev || (t.dev = { plan: 'balanced', int: 'normal', coaches: { skills: 0, defense: 0, cond: 0, goalie: 0 } });
const attrName = k => { const a = SK_ATTRS.concat(G_ATTRS).find(x => x[0] === k); return a ? a[1] : k; };
const attrKeys = p => (p.pos === 'G' ? G_ATTRS : SK_ATTRS).map(a => a[0]);
const coachFor = (t, k) => { const c = teamDev(t).coaches; let lv = 0; for (const id in COACHES) if (COACHES[id].keys.includes(k)) lv = Math.max(lv, c[id] || 0); return lv; };
const focusCount = (save, t) => rosterIds(t).filter(id => { const p = P(save, id); return p && p.dev && p.dev.focus; }).length;
const sameGroup = (a, b) => (a.pos === 'G') === (b.pos === 'G') && (a.pos === 'G' || (a.pos === 'D') === (b.pos === 'D'));
function mentorOK(save, t, kid, vet) {
  if (!kid || !vet || kid === vet) return 'Pick two different players.';
  if (kid.age > 23) return 'Mentoring is for players 23 and under.';
  if (vet.age < 27) return 'A mentor should be 27 or older.';
  if (standingOf(vet, t) < DEV.mentorStanding) return `A mentor needs a standing of ${DEV.mentorStanding}+ in the room.`;
  if (!sameGroup(kid, vet)) return 'Mentors work with their own position group (forwards, defense, keepers).';
  const used = rosterIds(t).filter(id => { const p = P(save, id); return p && p.dev && p.dev.mentor; });
  if (used.length >= DEV.mentorMax && !(kid.dev && kid.dev.mentor)) return `Up to ${DEV.mentorMax} mentorships at a time.`;
  if (used.some(id => P(save, id).dev.mentor === vet.id && id !== kid.id)) return 'He already mentors someone.';
  return null;
}
// how far past his scouted ceiling he already is (overall points)
const pastCeiling = p => Math.max(0, overall(p) - (p.pot || 10));
// progress multiplier for one rating of one player on one team today
function devRate(save, t, p, k, ai) {
  const T = teamDev(t), plan = PLANS[T.plan] || PLANS.balanced;
  let r = DEV.age(p.age);
  r *= T.int === 'light' ? DEV.light : T.int === 'hard' ? DEV.hard : T.int === 'rest' ? DEV.rest : 1;
  if (plan.keys && plan.keys.includes(k)) r *= DEV.plan;
  r *= 1 + DEV.coach * (ai ? 1 : coachFor(t, k));
  const D0 = devOf(p);
  if (D0.mentor && P(save, D0.mentor) && P(save, D0.mentor).teamId === t.id) r *= DEV.mentor;
  if (pastCeiling(p) > 0) r *= pastCeiling(p) >= DEV.overCap ? 0 : DEV.overMul;
  if ((p.attrs[k] || 0) >= 10) r = 0;
  return r;
}
function devGain(save, p, k, why) {
  if ((p.attrs[k] || 0) >= 10) return false;
  const before = overall(p); p.attrs[k]++; const D0 = devOf(p);
  if (overall(p) > (p.pot || 10)) D0.over = Math.round((overall(p) - (p.pot || 10)) * 10) / 10;
  if (p.teamId === save.userTeamId) pushNews(save, `${why}: #${p.num} ${p.first} ${p.last} improves his ${attrName(k).toLowerCase()} (${ovrInt(p) > Math.round(before * 10) ? 'OVR ' + ovrInt(p) : 'now ' + p.attrs[k] * 10}).`);
  return true;
}
// a jump in progress after a big game (and a small chance at a trait)
function devMoment(save, p, kind) {
  if (!p || !save.teams[p.teamId]) return;
  const D0 = devOf(p), add = DEV.moment[kind] || 30, t = save.teams[p.teamId];
  if (D0.focus) D0.prog += add; else D0.gen += add;
  const what = kind === 'hat' ? 'a hat trick' : kind === 'sho' ? 'a clean sheet' : 'a playoff extra time winner';
  if (p.teamId === save.userTeamId) pushNews(save, `Confidence boost: #${p.num} ${p.last} is flying after ${what}.`);
  if (typeof tryGainTrait === 'function' && typeof TRAITS !== 'undefined') {
    const pool = Object.keys(TRAITS).filter(id => TRAITS[id].pos ? TRAITS[id].pos === (p.pos === 'G' ? 'G' : 'S') : true);
    tryGainTrait(save, p, pool, DEV.momentTrait, 'big moment: ' + what);
  }
  devSettle(save, t, p);
}
function devSettle(save, t, p) {
  const D0 = devOf(p);
  while (D0.focus && D0.prog >= 100) { D0.prog -= 100; if (!devGain(save, p, D0.focus, 'Breakthrough')) { D0.prog = 0; break; } }
  if (D0.focus && p.attrs[D0.focus] >= 10) { if (p.teamId === save.userTeamId) pushNews(save, `#${p.num} ${p.last} has maxed out his ${attrName(D0.focus).toLowerCase()}: pick a new development focus for him.`); D0.focus = null; D0.prog = 0; }
  while (D0.gen >= 100) {
    D0.gen -= 100;
    const plan = PLANS[teamDev(t).plan], ks = attrKeys(p).filter(k => p.attrs[k] < 10 && (!plan.keys || plan.keys.includes(k)));
    const pool = ks.length ? ks : attrKeys(p).filter(k => p.attrs[k] < 10); if (!pool.length) break;
    const k = pool.sort((a, b) => p.attrs[a] - p.attrs[b])[0];           // practice helps his weakest first
    devGain(save, p, k, 'Practice pays off');
  }
}
// AI clubs: average automatic development (their 3 youngest with room to grow, on their weakest key rating)
function aiDevPick(save, t) {
  const kids = rosterIds(t).map(id => P(save, id)).filter(p => p && p.age <= 24 && overall(p) < (p.pot || 10)).sort((a, b) => a.age - b.age).slice(0, 3);
  for (const id of rosterIds(t)) { const p = P(save, id); if (p && p.dev && p.dev.focus && !kids.includes(p)) p.dev.focus = null; }
  for (const p of kids) { const D0 = devOf(p); if (!D0.focus || p.attrs[D0.focus] >= 10) D0.focus = attrKeys(p).filter(k => p.attrs[k] < 10).sort((a, b) => p.attrs[a] - p.attrs[b])[0] || null; }
}
// every new game day (league.js currentDay)
function devDay(save) {
  const se = save.season; if (!se || se.done) return;
  const d = typeof mDay === 'function' ? mDay(save) : se.dayNo;
  for (const id of save.teamOrder) {
    const t = save.teams[id], ai = id !== save.userTeamId, T = teamDev(t);
    if (ai) { if ((se.dayNo || 0) % 10 === 1 || !t.devPicked) { aiDevPick(save, t); t.devPicked = 1; } T.plan = 'balanced'; T.int = 'normal'; }
    for (const pid of rosterIds(t)) {
      const p = P(save, pid); if (!p || p.inj) continue;
      const D0 = devOf(p), mul = (ai ? DEV.ai : 1) * (typeof devBoostOf === 'function' ? devBoostOf(save, t) : 1);   // a development camp / Winter Cup boost
      if (D0.focus) D0.prog += DEV.base * devRate(save, t, p, D0.focus, ai) * mul;
      D0.gen += DEV.general * DEV.age(p.age) * (T.int === 'light' ? DEV.light : T.int === 'hard' ? DEV.hard : T.int === 'rest' ? DEV.rest : 1) * (pastCeiling(p) >= DEV.overCap ? 0 : pastCeiling(p) > 0 ? DEV.overMul : 1) * mul;
      if (!ai) {
        if (T.int === 'hard') { p.cond = Math.max(0, (p.cond ?? 100) - DEV.hardCond); if (Math.random() < DEV.hardInj && p.pos !== 'G' && healthySkaters(save, t, p.id) >= BAL.minSkaters) { const se2 = save.season, n = 1 + ((Math.random() * 3) | 0); p.inj = { g: n, kind: 'practice injury', s: se2.num }; (p.injHist = p.injHist || []).push({ s: se2.num, gid: null, g: n, kind: 'practice injury' }); pushNews(save, `${p.first} ${p.last} got hurt in a hard practice and is out ${n} game${n === 1 ? '' : 's'}.`); } }
        else if (T.int === 'light' || T.int === 'rest') p.cond = Math.min(100, (p.cond ?? 100) + (T.int === 'rest' ? DEV.lightCond * 2 : DEV.lightCond));
        D0.hist.push({ d, o: ovrInt(p) }); if (D0.hist.length > 40) D0.hist.shift();
        if (D0.mentor) { const v = P(save, D0.mentor); if (!v || v.teamId !== t.id) D0.mentor = null; }
      }
      devSettle(save, t, p);
    }
  }
}
// the off-season: mentor trait rolls; mentorships end when the kid turns 24
function devOffseason(save) {
  const t = save.teams[save.userTeamId]; if (!t) return;
  for (const id of rosterIds(t)) {
    const p = P(save, id), D0 = p && p.dev; if (!D0 || !D0.mentor) continue;
    const v = P(save, D0.mentor);
    if (v && v.teamId === t.id && typeof tryGainTrait === 'function') {
      const got = tryGainTrait(save, p, (v.traits || []).slice(), DEV.mentorTrait, `learned from ${v.first} ${v.last}`);
      if (got) pushNews(save, `Mentorship pays off: #${p.num} ${p.last} picked up ${TRAITS[got] ? TRAITS[got].name : 'a trait'} from ${v.last}.`);
    }
    if (p.age >= 24) D0.mentor = null;
  }
}
// what's likely to happen to him next summer (overall points, ×10 for OVR): expected change from the off-season rules
function devProjection(p) {
  const peak = p.peak || 27, keys = attrKeys(p), gap = (p.pot || 10) - overall(p), dm = typeof traitMul === 'function' ? traitMul(p, 'devMul') : 1;
  let e = 0;
  for (const k of keys) {
    if (p.age + 1 <= peak && gap > 0) e += Math.min(0.85, (0.06 + gap * 0.14 + 0.08) * dm * OFF_DEV);
    else if (p.age + 1 <= peak + 3) e += 0.04 * dm - 0.06;
    else e -= (p.age + 1 - peak - 3) * 0.06 * (k === 'spd' || k === 'sta' || k === 'rec' ? 1.4 : 1);
  }
  return Math.round(e / keys.length * 100) / 10;                       // in OVR points
}
// coaching staff wages: per regular-season game (finance.js financeGame)
function devPay(save, g) {
  if (g.type !== 'reg') return; const uid = save.userTeamId; if (g.home !== uid && g.away !== uid) return;
  const t = save.teams[uid], c = teamDev(t).coaches; let k = 0; for (const id in c) k += DEV.coachCost[c[id] || 0];
  if (k) ledger(t, 'coaches', Math.round(k / FIN.regGames));
}
// PUCK TALK: the breakout player of the week (biggest OVR jump over the last 7 game days, your club first)
function devBreakout(save) {
  const t = save.teams[save.userTeamId]; if (!t) return null;
  let best = null, bg = 0;
  for (const id of rosterIds(t)) { const p = P(save, id), h = p && p.dev && p.dev.hist; if (!h || h.length < 2) continue; const old = h[Math.max(0, h.length - 8)].o, g = ovrInt(p) - old; if (g > bg) { bg = g; best = p; } }
  return best && bg >= 1 ? { p: best, g: bg } : null;
}

// ---------- the DEVELOPMENT tab (roster screen)
function devTab(save, team, rerender) {
  const T = teamDev(team), Pl = id => P(save, id), wrap = h('div', { class: 'panel devtab' });
  const msg = h('span', { class: 'sub', style: { marginLeft: '8px' } });
  const act = fn => { const e = fn(); if (e) { msg.className = 'sub red'; msg.textContent = e; return; } Store.autosave(save); rerender(); };
  const sel = (opts, cur, on, title) => h('select', { onchange: e => on(e.target.value), 'data-help': title || null }, opts.map(([v, l]) => h('option', { value: v, selected: v === cur }, l)));
  // practice + staff
  const staff = h('div', { class: 'devstaff' }, Object.entries(COACHES).map(([id, C]) => {
    const lv = T.coaches[id] || 0, next = lv < 3 ? DEV.coachCost[lv + 1] : null;
    return h('div', { class: 'devcoach', 'data-help': `${C.name.toUpperCase()}: ${C.desc} Each level adds 15% to development of those ratings. Paid per regular-season game.` },
      h('div', { class: 'gold' }, C.name.toUpperCase()), h('div', { class: 'muted devcdesc' }, { skills: 'Shot, pass, close control, set pieces', defense: 'Defense, tackling', cond: 'Speed, stamina', goalie: 'All keeper ratings' }[id] || C.desc), h('div', null, lv ? `LEVEL ${lv}/3` : 'NOT HIRED', h('span', { class: 'muted' }, lv ? ` · ${fmtM(DEV.coachCost[lv])}/season` : '')),
      h('div', { style: { display: 'flex', gap: '4px', marginTop: '3px' } },
        next != null ? h('button', { class: 'small', title: `${lv ? 'Level ' + (lv + 1) : 'Hire'}: ${fmtM(next)} a season (paid per regular-season game), +15% development for those ratings per level.`, onclick: () => act(() => { T.coaches[id] = lv + 1; pushNews(save, `The ${team.nick} ${lv ? 'upgrade their' : 'hire a'} ${C.name.toLowerCase()} (${fmtM(DEV.coachCost[lv + 1])} a season).`); return null; }) }, (lv ? 'UPGRADE ' : 'HIRE ') + fmtM(next)) : null,
        lv ? h('button', { class: 'small', onclick: () => act(() => { T.coaches[id] = lv - 1; return null; }) }, lv > 1 ? 'DOWN' : 'RELEASE') : null));
  }));
  wrap.appendChild(h('div', { class: 'devtop' },
    h('div', null, h('div', { class: 'sub gold' }, 'PRACTICE'),
      h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' } },
        sel(Object.entries(PLANS).map(([k, v]) => [k, v.name + (v.keys ? ' · ' + v.desc.replace(/\.$/, '').replace(/^Extra time for the goalies$/, 'keeper ratings') : '')]), T.plan, v => act(() => { T.plan = v; return null; }), 'PRACTICE FOCUS: those ratings develop 50% faster for everyone (and general practice gains go to them).'),
        sel(Object.entries(INTENSITY).map(([k, v]) => [k, v.name]), T.int, v => act(() => { T.int = v; return null; }), 'INTENSITY: light (slower, players recover), normal, hard (30% faster, tiring, small injury risk) or rest.'),
        h('span', { class: 'muted', style: { fontSize: '7px' } }, INTENSITY[T.int].name + ': ' + INTENSITY[T.int].desc))),
    h('div', null, h('div', { class: 'sub gold' }, 'COACHING STAFF ', h('span', { class: 'muted' }, `· funds ${fmtM(finOf(team).cash)}`)), staff)));
  // players
  const ids = rosterIds(team).map(Pl).filter(Boolean).sort((a, b) => (a.pos === 'G') - (b.pos === 'G') || a.age - b.age);
  const nF = focusCount(save, team);
  const vets = ids.filter(v => v.age >= 27 && standingOf(v, team) >= DEV.mentorStanding);
  const rows = ids.map(p => {
    const D0 = devOf(p), pot = p.potR ? `${p.potR[0]}–${p.potR[1]}` : String(Math.round((p.pot || 0) * 10)), proj = devProjection(p);
    const h0 = D0.hist.length > 1 ? D0.hist[Math.max(0, D0.hist.length - 15)].o : ovrInt(p), tr = ovrInt(p) - h0;
    const rate = D0.focus ? DEV.base * devRate(save, team, p, D0.focus) : 0;
    const focusSel = h('select', { onchange: e => act(() => { const v = e.target.value || null; if (v && !D0.focus && nF >= DEV.focusMax) return `Up to ${DEV.focusMax} players can have a development focus.`; D0.focus = v; D0.prog = v === D0.focus ? D0.prog : 0; return null; }), 'data-help': 'DEVELOPMENT FOCUS: the rating he works on. The bar fills every game day (fastest for young players); a full bar is a permanent +1.' },
      h('option', { value: '' }, '— none —'), attrKeys(p).map(k => h('option', { value: k, selected: k === D0.focus, disabled: p.attrs[k] >= 10 }, `${attrName(k)} (${p.attrs[k] * 10})`)));
    const mentorSel = p.age <= 23 ? h('select', { onchange: e => act(() => { const v = e.target.value || null; if (!v) { D0.mentor = null; return null; } const err = mentorOK(save, team, p, Pl(v)); if (err) return err; D0.mentor = v; const m = Pl(v); if (m && typeof moraleOf === 'function' && motiveOf(m) === 'leader') moraleOf(m).fx.push({ label: 'Mentoring a young player', v: 5, d: mDay(save), len: 40 }); pushNews(save, `${m.first} ${m.last} takes #${p.num} ${p.last} under his wing.`); return null; }), 'data-help': `MENTOR: a veteran (27+, standing ${DEV.mentorStanding}+, same position group). 40% faster progress, and a ${Math.round(DEV.mentorTrait * 100)}% chance each summer to learn one of his traits.` },
      h('option', { value: '' }, vets.some(v => sameGroup(p, v)) ? '— none —' : '— none eligible —'), vets.filter(v => sameGroup(p, v)).map(v => h('option', { value: v.id, selected: v.id === D0.mentor }, `${v.last} (${standingOf(v, team)})`))) : h('span', { class: 'muted' }, '—');
    return h('tr', null,
      h('td', { class: 'l' }, `#${p.num} ${p.last}`, h('span', { class: 'muted' }, ` ${posLabel(p)}`)),
      h('td', null, p.age), h('td', null, ovrInt(p)), h('td', { 'data-help': 'POTENTIAL (scouted). Good management can push him a little past it (up to about +5).' }, pot + (D0.over > 0 ? ` +${Math.round(D0.over * 10)}` : '')),
      h('td', { class: tr > 0 ? 'green' : tr < 0 ? 'red' : 'muted', 'data-help': 'TREND: OVR change over the last 15 game days.' }, tr > 0 ? `▲${tr}` : tr < 0 ? `▼${-tr}` : '—'),
      h('td', { class: proj > 0.4 ? 'green' : proj < -0.4 ? 'red' : 'muted', 'data-help': 'NEXT SUMMER: the expected OVR change from aging and growth (before in-season work).' }, proj > 0.4 ? `▲ ~${Math.round(proj)}` : proj < -0.4 ? `▼ ~${Math.round(-proj)}` : '≈'),
      h('td', { class: 'l' }, focusSel),
      h('td', { class: 'l' }, D0.focus ? h('div', { class: 'devbar', 'data-help': D0.focus ? `${Math.round(D0.prog)}% · about ${rate > 0 ? Math.ceil((100 - D0.prog) / rate) : '∞'} game days to the next +1 at this pace` : null }, h('i', { style: { width: Math.min(100, D0.prog) + '%' } })) : h('span', { class: 'muted' }, '')),
      h('td', { class: 'l' }, mentorSel));
  });
  const staffCost = Object.keys(COACHES).reduce((a, id) => a + DEV.coachCost[T.coaches[id] || 0], 0);
  wrap.appendChild(h('div', { class: 'devhead' }, staffCost ? h('div', { class: 'sub', style: { margin: 0 } }, `Staff costs ${fmtM(staffCost)} a season.`) : null, msg));
  wrap.appendChild(h('div', { class: 'tblwrap' }, h('table', { class: 'tbl devtbl' }, h('tr', null, ['PLAYER', 'AGE', 'OVR', 'POT', 'TREND', 'NEXT', 'FOCUS', 'PROG.', 'MENTOR'].map((x, i) => h('th', { class: [0, 6, 7, 8].includes(i) ? 'l' : '', 'data-help': i === 5 ? 'NEXT SUMMER: the expected OVR change from aging and growth.' : i === 7 ? 'PROGRESS toward the next +1 in his focus rating.' : null }, x))), rows)));
  wrap.appendChild(h('div', { class: 'hint devrules' }, h('div', null, h('span', { class: 'gold' }, `FOCUS ${nF}/${DEV.focusMax}: `), 'a full bar is a permanent +1 (fastest when young).'),
    h('div', { 'data-help': `MENTOR: a veteran (27+, standing ${DEV.mentorStanding}+, same group: forward, defence or keeper) speeds up a player 23 or under by ${Math.round((DEV.mentor - 1) * 100)}%, and each summer has a ${Math.round(DEV.mentorTrait * 100)}% chance to pass on one of his traits. Up to ${DEV.mentorMax} at a time.` }, h('span', { class: 'gold' }, `MENTORS ${ids.filter(p => p.dev && p.dev.mentor).length}/${DEV.mentorMax}: `), `23 and under, with a vet 27+ (standing ${DEV.mentorStanding}+).`)));
  wrap.appendChild(h('div', { class: 'hint devgrow', 'data-help': 'Players grow most in their late teens and early 20s, peak around 25-29 and slow down after 30. Focus, practice, mentors, coaches and big games add to the growth they get each summer, and can push a player a little past his scouted ceiling.' }, 'Players grow most in their late teens and early 20s, peak around 25-29 and slow down after 30. Focus, practice, mentors, coaches and big games add to the growth they get each summer, and can push a player a little past his scouted ceiling.'));
  return wrap;
}

// ---------- the same focus & mentor controls, for one player (his profile's DEVELOPMENT tab)
function devFocusPanel(p, rerender) {
  const save = UI.save; if (!p || p.status !== 'active' || p.teamId !== save.userTeamId) return null;
  const team = save.teams[p.teamId], D0 = devOf(p), Pl = id => P(save, id), nF = focusCount(save, team);
  const msg = h('div', { class: 'sub red', style: { margin: '4px 0 0' } });
  const act = fn => { const e = fn(); if (e) { msg.textContent = e; return; } Store.autosave(save); rerender(); };
  const rate = D0.focus ? DEV.base * devRate(save, team, p, D0.focus) : 0, proj = devProjection(p);
  const vets = rosterIds(team).map(Pl).filter(v => v && v.age >= 27 && standingOf(v, team) >= DEV.mentorStanding && sameGroup(p, v));
  return h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'DEVELOPMENT FOCUS'),
    h('div', { class: 'kvr' }, h('span', null, 'Potential'), h('b', null, potTxt(p))),
    h('div', { class: 'kvr' }, h('span', null, 'Next summer (aging and growth)'), h('b', { class: proj > 0.4 ? 'green' : proj < -0.4 ? 'red' : '' }, proj > 0.4 ? `▲ about ${Math.round(proj)}` : proj < -0.4 ? `▼ about ${Math.round(-proj)}` : 'about the same')),
    h('div', { class: 'kvr' }, h('span', null, `Focus (${nF}/${DEV.focusMax} players)`),
      h('select', { onchange: e => act(() => { const v = e.target.value || null; if (v && !D0.focus && nF >= DEV.focusMax) return `Up to ${DEV.focusMax} players can have a development focus.`; D0.focus = v; D0.prog = 0; return null; }) },
        h('option', { value: '' }, '— none —'), attrKeys(p).map(k => h('option', { value: k, selected: k === D0.focus, disabled: p.attrs[k] >= 10 }, `${attrName(k)} (${p.attrs[k] * 10})`)))),
    D0.focus ? h('div', { class: 'kvr' }, h('span', null, 'Progress to the next +1'), h('div', { class: 'devbar', style: { flex: 1, margin: '0 8px' } }, h('i', { style: { width: Math.min(100, D0.prog) + '%' } })),
      h('b', null, rate > 0 ? `~${Math.ceil((100 - D0.prog) / rate)} game days` : '—')) : null,
    p.age <= 23 ? h('div', { class: 'kvr' }, h('span', null, 'Mentor'),
      h('select', { onchange: e => act(() => { const v = e.target.value || null; if (!v) { D0.mentor = null; return null; } const err = mentorOK(save, team, p, Pl(v)); if (err) return err; D0.mentor = v; return null; }) },
        h('option', { value: '' }, vets.length ? '— none —' : '— none eligible —'), vets.map(v => h('option', { value: v.id, selected: v.id === D0.mentor }, `${v.last} (standing ${standingOf(v, team)})`)))) : null,
    h('div', { class: 'hint' }, `A full bar is a permanent +1. Mentors: 27+, standing ${DEV.mentorStanding}+, same group; +${Math.round((DEV.mentor - 1) * 100)}% speed. Practice and coaches are in Roster › Development.`), msg);
}
