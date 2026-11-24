'use strict';
// ====================================================================
//  DREAM TEAM: unlocked by ten completed seasons with one franchise. A new franchise where you build your own team,
//  one player at a time: stats, traits, position, hand, age, name, number. Salaries price themselves (the game's
//  own contract formula); you set the cap. Its records stay in its own save and never count toward your account
//  (achievement unlocks, account cosmetics).
// ====================================================================
Object.assign(COSMETICS, { dream_team: { name: 'Dream Team Mode', kind: 'mode', desc: 'Build your own team from scratch, every player, every stat.' } });
{ const a = { id: 'dynasty10', name: 'Dynasty', cat: 'Customization', desc: 'Complete ten seasons with one franchise. Unlocks DREAM TEAM mode.', on: 'season', goal: 10,
    prog: s => s.dream ? 0 : (s.history || []).length, reward: { cosmetic: 'dream_team' } };
  if (!ACH_BY_ID[a.id]) { ACHIEVEMENTS.push(a); ACH_BY_ID[a.id] = a; } }
const dreamUnlocked = () => hasCosmetic('dream_team');
// in a Dream Team save the cap is the one you chose (no cap = effectively none)
{ const base = FIN.cap;
  Object.defineProperty(FIN, 'cap', { configurable: true, get() { try { const s = typeof UI !== 'undefined' && UI.save; if (s && s.dream && s.dream.built) return s.dream.cap || 999000; } catch (e) {} return base; }, set() {} }); }

const DT_POS = ['LW', 'LD', 'C', 'RW', 'RD'];
const DT_PRESETS_S = { sniper: 'SNIPER', playmaker: 'PLAYMAKER', speedster: 'SPEEDSTER', defensive: 'SHUTDOWN D', enforcer: 'HARD MAN', balanced: 'TWO-WAY' };
const DT_PRESETS_G = { butterfly: ['BUTTERFLY', { ref: 2, pos: 1, rec: 0, reb: -1, sta: 0 }], positional: ['POSITIONAL', { pos: 2, reb: 2, ref: -1, rec: -1, sta: 0 }], athletic: ['ATHLETIC', { ref: 1, rec: 2, sta: 1, pos: -1, reb: -1 }] };
const dtKeys = p => p.pos === 'G' ? G_ATTRS : SK_ATTRS;
const dtLevel = p => { const ks = dtKeys(p); return ks.reduce((a, [k]) => a + (p.attrs[k] || 5), 0) / ks.length; };
function dtTouch(p) { p.pot = Math.max(p.pot || 0, Math.round(overall(p))); }
function dtSalary(p) { return worth(p); }
function dtRoster(save) { const t = save.teams[save.userTeamId]; return [...t.roster.lines.flat(), ...t.roster.reserves, ...t.roster.goalies].filter(Boolean).map(id => save.players[id]); }
function dtPayroll(save) { return dtRoster(save).reduce((a, p) => a + dtSalary(p), 0); }

// ---- the entry card on the New Franchise screen
function dreamEntry() {
  const on = dreamUnlocked();
  return h('div', { class: 'panel dtentry' + (on ? '' : ' locked') },
    h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' } },
      h('div', null, h('div', { class: 'gold', style: { fontSize: '12px' } }, (on ? '★ ' : ' ') + 'DREAM TEAM'),
        h('div', { class: 'sub', style: { margin: '6px 0 0' } }, on ? 'Build your own team from scratch: every player, every stat, every trait. Set your own salary cap. Records stay in their own save.' : 'Complete ten seasons with one franchise to unlock (the Dynasty achievement).')),
      h('button', { class: on ? 'primary' : 'ghost', disabled: !on, onclick: () => on && go(scrDreamSetup) }, on ? 'BUILD A DREAM TEAM ▶' : 'LOCKED')));
}

// ---- setup: team, name, cap, the rest of the league, aging, starting roster
function scrDreamSetup() {
  const st = UI.dt || (UI.dt = { teamId: 'eagles', name: 'Dream Team', cap: 20000, noCap: false, league: 'balanced', aging: true, start: 'random' });
  const opt = (key, val, label, sub) => h('button', { class: 'dtopt' + (st[key] === val ? ' sel' : ''), onclick: () => { st[key] = val; go(scrDreamSetup); } }, h('div', null, label), sub ? h('div', { class: 'muted', style: { fontSize: 'calc(6.5px * var(--ts, 1.2))', marginTop: '4px' } }, sub) : null);
  const capLab = h('span', { class: 'gold' }, st.noCap ? 'NO CAP' : fmtM(st.cap));
  const slider = h('input', { type: 'range', min: 8000, max: 40000, step: 500, value: st.cap, disabled: st.noCap, style: { width: '100%' }, oninput: e => { st.cap = +e.target.value; capLab.textContent = fmtM(st.cap); } });
  const nameIn = h('input', { type: 'text', value: st.name, maxLength: 28, oninput: e => { st.name = e.target.value; } });
  const create = () => {
    const save = newFranchise({ name: (st.name || 'Dream Team').trim(), teamId: st.teamId });
    save.dream = { v: 1, cap: st.noCap ? 0 : st.cap, league: st.league, aging: st.aging, built: false };
    draft0AutoAll(save);
    const ps = dtRoster(save);
    if (st.start === 'blank' || st.start === 'stars') for (const p of ps) { for (const [k] of dtKeys(p)) p.attrs[k] = st.start === 'blank' ? 5 : 8; p.traits = []; dtTouch(p); }
    UI.save = save; UI.dt = null; UI.db = { i: 0, row: 0 };
    go(scrDreamBuilder);
  };
  // two steps (team, then rules) so the whole setup fits on one screen
  return h('div', { class: 'screen dtsetup' }, header('DREAM TEAM: SETUP', () => go(scrNewFranchise), 'BACK', h('button', { class: 'primary', onclick: create }, 'START BUILDING ▶')),
    tabbed('dreamsetup', [{ label: '1 · NAME & TEAM', el: () =>
    h('div', { class: 'panel' }, h('label', { class: 'f' }, 'SAVE NAME'), nameIn,
      h('label', { class: 'f' }, 'YOUR TEAM'),
      h('div', { class: 'teampick' }, LEAGUE_TEAM_IDS.map(id => { const t = DEFAULT_TEAMS[id]; return h('div', { class: 'teamcard' + (id === st.teamId ? ' on' : ''), onclick: () => { st.teamId = id; go(scrDreamSetup); } }, badge(t, 34), h('div', { style: { color: teamTextColor(t) } }, fullName(t))); }))) }, { label: '2 · RULES', el: () =>
    h('div', { class: 'grid two' },
      h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'SALARY CAP  ', capLab), slider,
        h('label', { class: 'f' }, h('input', { type: 'checkbox', checked: st.noCap, onchange: e => { st.noCap = e.target.checked; go(scrDreamSetup); } }), ' NO CAP (spend what you like)'),
        h('div', { class: 'muted', style: { fontSize: '7px', lineHeight: 1.7 } }, 'Every player\'s salary is worked out from his stats, traits and age, the same way the game prices contracts. The league\'s normal cap is ' + fmtM(16000) + '. You can\'t start a season over your cap.')),
      h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'THE REST OF THE LEAGUE'),
        h('div', { class: 'dtopts' }, opt('league', 'balanced', 'BALANCED TO MY TEAM', 'the other teams are built up (or down) to about your level'), opt('league', 'normal', 'NORMAL LEAGUE', 'everyone else as usual'), opt('league', 'allstar', 'ALL-STAR LEAGUE', 'every team stacked'))),
      h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'PLAYER DEVELOPMENT'),
        h('div', { class: 'dtopts' }, opt('aging', true, 'AGING ON', 'your players develop and age like everyone else'), opt('aging', false, 'FROZEN', 'your creations stay exactly as built'))),
      h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'START FROM'),
        h('div', { class: 'dtopts' }, opt('start', 'random', 'RANDOM PLAYERS', 'a normal drafted roster to reshape'), opt('start', 'blank', 'BLANK SLATE', 'every player rated 50'), opt('start', 'stars', 'ALL-STARS', 'every player rated 80')))) }]));
}

// ---- the builder: one player card at a time
function scrDreamBuilder() {
  const save = UI.save, team = save.teams[save.userTeamId], D = save.dream, st = UI.db || (UI.db = { i: 0, row: 0 });
  const ps = dtRoster(save); st.i = Math.max(0, Math.min(ps.length - 1, st.i)); const p = ps[st.i], keys = dtKeys(p);
  const cap = D.cap, pay = dtPayroll(save), over = cap && pay > cap;
  const redo = () => go(scrDreamBuilder);
  const setA = (k, v) => { p.attrs[k] = Math.max(1, Math.min(10, v)); dtTouch(p); redo(); };
  // cap bar
  const capBar = h('div', { class: 'dtcap' },
    h('div', { class: 'row', style: { justifyContent: 'space-between', margin: 0 } }, h('span', null, 'PAYROLL ', h('b', { class: over ? 'red' : 'gold' }, fmtM(pay))), h('span', { class: 'muted' }, cap ? 'CAP ' + fmtM(cap) + ' · ' + (over ? fmtM(pay - cap) + ' OVER' : fmtM(cap - pay) + ' LEFT') : 'NO CAP')),
    h('div', { class: 'dtbar' }, h('div', { style: { width: (cap ? Math.min(100, pay / cap * 100) : 0) + '%', background: over ? '#ff6a4a' : '#ffd23f' } })));
  // the card
  const numIn = h('input', { type: 'number', min: 1, max: 99, value: p.num || '', style: { width: '64px' }, onchange: e => { const n = Math.max(1, Math.min(99, +e.target.value | 0)); if (ps.some(x => x !== p && x.num === n)) { toast('#' + n + ' is taken on your team.'); e.target.value = p.num; return; } p.num = n; redo(); } });
  const fIn = h('input', { type: 'text', value: p.first, maxLength: 14, style: { width: '110px' }, onchange: e => { p.first = e.target.value.trim() || p.first; redo(); } });
  const lIn = h('input', { type: 'text', value: p.last, maxLength: 16, style: { width: '130px' }, onchange: e => { p.last = e.target.value.trim() || p.last; redo(); } });
  const traitsOk = Object.keys(TRAITS).filter(id => !TRAITS[id].earnedOnly && traitFits(p, id));
  const card = h('div', { class: 'panel dtcard' },
    h('div', { class: 'row', style: { gap: '14px', alignItems: 'flex-start', justifyContent: 'flex-start', margin: 0 } }, portrait(p, team, 120),
      h('div', { style: { flex: 1 } },
        h('div', { class: 'row', style: { gap: '6px', justifyContent: 'flex-start', margin: '0 0 6px' } }, fIn, lIn),
        h('div', { class: 'row', style: { gap: '6px', justifyContent: 'flex-start', margin: '0 0 6px', alignItems: 'center' } }, h('span', { class: 'muted' }, '#'), numIn,
          h('span', { class: 'muted', style: { marginLeft: '8px' } }, 'AGE'), h('button', { class: 'small', onclick: () => { p.age = Math.max(18, p.age - 1); dtTouch(p); redo(); } }, '−'), h('b', null, ' ' + p.age + ' '), h('button', { class: 'small', onclick: () => { p.age = Math.min(40, p.age + 1); redo(); } }, '+')),
        p.pos === 'G' ? h('div', { class: 'gold' }, 'KEEPER') : h('div', { class: 'row', style: { gap: '3px', justifyContent: 'flex-start', margin: '0 0 6px' } }, DT_POS.map(sp => h('button', { class: 'small' + (p.spos === sp ? ' sel' : ''), title: POS_NAMES[sp], onclick: () => { p.spos = sp; redo(); } }, posShort(sp))),
          h('span', { style: { width: '10px' } }), ['L', 'R'].map(hd => h('button', { class: 'small' + ((p.hand || 'L') === hd ? ' sel' : ''), onclick: () => { p.hand = hd; redo(); } }, 'SHOOTS ' + hd))),
        h('div', { class: 'row', style: { gap: '18px', justifyContent: 'flex-start', margin: '8px 0 0' } },
          h('div', null, h('div', { class: 'muted', style: { fontSize: '7px' } }, 'OVERALL'), h('div', { class: 'big gold' }, ovrInt(p))),
          h('div', null, h('div', { class: 'muted', style: { fontSize: '7px' } }, 'SALARY'), h('div', { class: 'big' }, fmtM(dtSalary(p))))))),
    // presets
    h('div', { class: 'row', style: { gap: '4px', justifyContent: 'flex-start', flexWrap: 'wrap', margin: '10px 0 0' } }, h('span', { class: 'muted', style: { fontSize: '7px' } }, 'PRESETS: '),
      p.pos === 'G'
        ? Object.entries(DT_PRESETS_G).map(([k, [lab, mods]]) => h('button', { class: 'small', onclick: () => { const lv = Math.round(dtLevel(p)); for (const [a] of keys) p.attrs[a] = Math.max(1, Math.min(10, lv + (mods[a] || 0))); dtTouch(p); redo(); } }, lab))
        : Object.entries(DT_PRESETS_S).map(([k, lab]) => h('button', { class: 'small', onclick: () => { const lv = Math.round(dtLevel(p)), m = ARCHETYPES[k].mods; for (const [a] of keys) p.attrs[a] = Math.max(1, Math.min(10, lv + (m[a] || 0))); p.arch = k; dtTouch(p); redo(); } }, lab)),
      h('button', { class: 'small', onclick: () => { const lv = dtLevel(p); for (const [a] of keys) p.attrs[a] = Math.max(1, Math.min(10, Math.round(lv + (Math.random() - 0.5) * 3))); dtTouch(p); redo(); } }, '🎲 RANDOM'),
      h('button', { class: 'small', onclick: () => dtCloneDialog(save, p, redo) }, '★ CLONE A LEGEND')),
    // traits: two dropdowns (Nov 23: 21 trait buttons ran off the screen at HUGE text)
    h('h3', { style: { margin: '10px 0 4px' } }, 'TRAITS ', h('span', { class: 'muted', style: { fontSize: '7px' } }, '(up to 2)')),
    h('div', { class: 'dttraits' }, [0, 1].map(k => { const cur = (p.traits || [])[k] || '';
      const sel = h('select', { onchange: e => { const v = e.target.value, t = (p.traits || []).slice(); if (v && t.includes(v) && t.indexOf(v) !== k) return toast('Already picked.');
          if (v) t[k] = v; else t.splice(k, 1); p.traits = t.filter(Boolean).slice(0, 2); dtTouch(p); redo(); } },
        h('option', { value: '' }, '— none —'), traitsOk.map(id => h('option', { value: id, selected: id === cur }, TRAITS[id].name || id)));
      return h('div', { class: 'dttrait' }, h('span', { class: 'muted' }, 'TRAIT ' + (k + 1)), sel, h('div', { class: 'modetxt' }, cur && TRAITS[cur] ? TRAITS[cur].desc : '')); })));
  // stats
  const statRow = ([k, lab], i) => h('div', { class: 'dtstat' + (st.row === i ? ' on' : ''), onclick: () => { st.row = i; } },
    h('div', { class: 'dtlab' }, lab.toUpperCase()), h('button', { class: 'small', onclick: () => setA(k, p.attrs[k] - 1) }, '−'),
    h('div', { class: 'dtsegs' }, Array.from({ length: 10 }, (_, j) => h('div', { class: 'dtseg' + (j < p.attrs[k] ? ' f' : ''), style: j < p.attrs[k] ? { background: p.attrs[k] >= 8 ? '#5ee07a' : p.attrs[k] >= 5 ? '#ffd23f' : '#ff8a5a' } : null, onclick: e => { e.stopPropagation(); setA(k, j + 1); } }))),
    h('button', { class: 'small', onclick: () => setA(k, p.attrs[k] + 1) }, '+'), h('div', { class: 'dtval' }, r100(p.attrs[k])));
  const stats = h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'STATS', h('span', { class: 'muted', style: { fontSize: 'calc(6.5px * var(--ts, 1.2))', marginLeft: '10px' } }, '↑↓ pick · ←→ change · Q / E player')),
    keys.map(statRow));
  // roster strip
  const strip = h('div', { class: 'dtstrip' }, ps.map((q, i) => h('div', { class: 'dtmini' + (i === st.i ? ' on' : ''), onclick: () => { st.i = i; st.row = 0; redo(); } },
    portrait(q, team, 40), h('div', null, '#' + q.num + ' ' + q.last.toUpperCase().slice(0, 9)), h('div', { class: 'muted' }, posLabel(q) + ' · ' + ovrInt(q)), h('div', { class: 'gold' }, fmtM(dtSalary(q))))));
  const finish = () => {
    if (D.cap && dtPayroll(save) > D.cap) return toast('You\'re ' + fmtM(dtPayroll(save) - D.cap) + ' over your cap. Trim some stats or salaries first.');
    for (const q of ps) { q.contract = null; setContract(save, q, team, dtSalary(q), 3, 'standard'); }
    dtBalanceLeague(save);
    if (typeof setLeagueAdj === 'function') setLeagueAdj(save);
    if (typeof autoArrange === 'function') autoArrange(save, team);
    D.built = true; Store.save(save).then(() => typeof refreshSaves === 'function' && refreshSaves());
    removeEventListener('keydown', dtKeys2, true); UI.db = null;
    go(scrHub); toast('Your Dream Team is ready. Good luck!');
  };
  // keyboard: ↑↓ stat, ←→ value, Q / E player
  removeEventListener('keydown', dtKeys2, true); addEventListener('keydown', dtKeys2, true);
  setTimeout(() => { const g = document.querySelector('.dtgrid'); if (g) fitZoomEl(g.parentNode); }, 0);   // never scroll
  return h('div', { class: 'screen wide' }, header('DREAM TEAM BUILDER', () => { removeEventListener('keydown', dtKeys2, true); Store.save(save).then(() => typeof refreshSaves === 'function' && refreshSaves()); go(scrSaves); }, 'SAVE & EXIT'),
    capBar,
    h('div', { class: 'grid two dtgrid' }, card, stats),
    h('div', { class: 'panel' }, h('div', { class: 'row', style: { justifyContent: 'space-between', margin: '0 0 6px' } }, h('h3', { style: { margin: 0 } }, 'YOUR ROSTER (' + ps.length + ')'),
      h('button', { class: 'primary', onclick: finish }, over ? 'OVER THE CAP' : 'DONE: START THE SEASON ▶')), strip));
}
function dtKeys2(e) {
  if (!UI.db || !UI.save || !UI.save.dream || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return;
  if (!document.querySelector('.dtgrid')) { removeEventListener('keydown', dtKeys2, true); return; }
  const st = UI.db, ps = dtRoster(UI.save), p = ps[st.i], keys = dtKeys(p);
  let hit = true;
  if (e.code === 'ArrowUp') st.row = (st.row + keys.length - 1) % keys.length;
  else if (e.code === 'ArrowDown') st.row = (st.row + 1) % keys.length;
  else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { const k = keys[st.row][0]; p.attrs[k] = Math.max(1, Math.min(10, p.attrs[k] + (e.code === 'ArrowRight' ? 1 : -1))); dtTouch(p); }
  else if (e.code === 'KeyQ' || e.code === 'KeyE') { st.i = (st.i + (e.code === 'KeyE' ? 1 : ps.length - 1)) % ps.length; st.row = 0; }
  else hit = false;
  if (hit) { e.preventDefault(); e.stopImmediatePropagation(); go(scrDreamBuilder); }
}
// clone any player in the league (stats, traits, position, hand, name)
function dtCloneDialog(save, p, done) {
  const pool = Object.values(save.players).filter(q => q.status === 'active' && q.teamId && q.teamId !== save.userTeamId && (q.pos === 'G') === (p.pos === 'G')).sort((a, b) => overall(b) - overall(a)).slice(0, 30);
  modal(close => h('div', null, h('h2', null, 'CLONE A LEGEND'), h('div', { class: 'sub' }, 'Copies his stats, traits, position, hand and name onto #' + p.num + '.'),
    h('div', { style: { maxHeight: '60vh', overflow: 'auto' } }, pool.map(q => h('div', { class: 'mrow2 click', onclick: () => {
      Object.assign(p.attrs, clone(q.attrs)); p.traits = (q.traits || []).slice(0, 2); p.first = q.first; p.last = q.last; p.hand = q.hand; if (p.pos !== 'G') p.spos = q.spos; p.arch = q.arch; p.age = q.age; dtTouch(p); close(); done(); } },
      portrait(q, save.teams[q.teamId], 30), h('span', null, '#' + q.num + ' ' + q.first + ' ' + q.last), h('span', { class: 'muted' }, posLabel(q) + ' · ' + save.teams[q.teamId].abbr + ' · OVR ' + ovrInt(q) + ' · ' + fmtM(worth(q)))))),
    h('div', { class: 'row' }, h('button', { onclick: close }, 'CLOSE'))), true);
}
// the rest of the league, set to the chosen strength
function dtBalanceLeague(save) {
  const D = save.dream; if (!D || D.league === 'normal') return;
  const target0 = D.league === 'allstar' ? 8.2 : teamStrength(save, save.userTeamId);
  for (const id of save.teamOrder) {
    if (id === save.userTeamId) continue;
    const t = save.teams[id], target = target0 * (D.league === 'allstar' ? 0.97 + Math.random() * 0.06 : 0.94 + Math.random() * 0.1);
    for (let pass = 0; pass < 3; pass++) {
      const d = target - teamStrength(save, id); if (Math.abs(d) < 0.15) break;
      for (const pid of rosterIds(t)) { const q = save.players[pid]; for (const [k] of dtKeys(q)) { const v = q.attrs[k] + Math.floor(d) + (Math.random() < d - Math.floor(d) ? 1 : 0); q.attrs[k] = Math.max(1, Math.min(10, v)); } q.pot = Math.max(q.pot || 0, Math.round(overall(q))); }
    }
  }
}
