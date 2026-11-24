'use strict';
// ====================================================================
//  QUICK PLAY: ten fictional teams generated from a seed (same seed = same teams and rosters).
//  A deliberate mix of weak, average, strong and elite teams, each with a playing identity,
//  tactics, 3-5 star players and full rosters. Independent of any franchise.
// ====================================================================
const QP_CITIES = ['Frostvale', 'Copper Ridge', 'Lakemont', 'Stormhaven', 'Pine Hollow', 'Red Rock', 'Silverlake', 'Thunder Bay', 'Ironwood', 'Maple Falls', 'Glacier Point',
  'Cedar Grove', 'Ashford', 'Blackwater', 'Highcrest', 'Wolf Creek', 'Sapphire City', 'Harborview', 'Northgate', 'Emberton', 'Westmarch', 'Duskfield', 'Snowpeak', 'Riverbend'];
const QP_NICKS = [['Wildcats', 'paw'], ['Bolts', 'bolt'], ['Huskies', 'wolf'], ['Ravens', 'raven'], ['Avalanche', 'mountain'], ['Mariners', 'anchor'], ['Lumberjacks', 'tree'], ['Comets', 'star'],
  ['Hornets', 'hornet'], ['Sharks', 'shark'], ['Blaze', 'flame'], ['Polar Bears', 'polarbear'], ['Dragons', 'dragon'], ['Foxes', 'fox'], ['Spartans', 'shield'], ['Phantoms', 'owl'],
  ['Cyclones', 'flake'], ['Titans', 'sword'], ['Orcas', 'orca'], ['Vipers', 'snake'], ['Kings', 'lion'], ['Gulls', 'wave'], ['Clippers', 'sailboat'], ['Rams', 'ram'], ['Rockets', 'rocket'],
  ['Stags', 'stag'], ['Bulls', 'bull'], ['Lynx', 'lynx'], ['Thunderbirds', 'thunderbird'], ['Vikings', 'viking'], ['Kraken', 'kraken'], ['Moose', 'moose'], ['Timberwolves', 'claws']];
const QP_PALETTES = [['#0f3d91', '#071d48', '#ffd23f'], ['#c0392b', '#5e1610', '#f4f4f4'], ['#1e7a46', '#0d3d22', '#f1e3b5'], ['#5b2a86', '#2b1240', '#ff8a1f'], ['#111318', '#000000', '#e8b923'],
  ['#e8701a', '#7a3608', '#1b2a5c'], ['#2bb3c0', '#106068', '#ffffff'], ['#8a1538', '#40091a', '#c9a050'], ['#3a6ea5', '#1c3757', '#d8dce6'], ['#c9a050', '#6a5418', '#1a1a1a'],
  ['#7ac74f', '#2d6b1e', '#14213d'], ['#d6336c', '#6e1238', '#ffe066'], ['#495057', '#212529', '#20c997'], ['#ff6b35', '#a33a12', '#004e89'], ['#00a6a6', '#005f5f', '#f4d35e']];
const QP_IDENTITIES = [
  { key: 'speed', name: 'Speed & Skill', arch: ['speedster', 'speedster', 'playmaker', 'sniper'], tac: { lines: ['counter', 'counter', 'balanced'], pp: 'umbrella', pk: 'aggressive' }, blurb: 'Fast, slick, and dangerous on the rush.' },
  { key: 'bruise', name: 'Big Bad Bruisers', arch: ['enforcer', 'enforcer', 'defensive', 'balanced'], tac: { lines: ['crash', 'forecheck', 'crash'], pp: 'overload', pk: 'aggressive' }, blurb: 'They hit everything and live at the six-yard box.' },
  { key: 'snipe', name: 'Sniper Corps', arch: ['sniper', 'sniper', 'playmaker', 'balanced'], tac: { lines: ['balanced', 'crash', 'balanced'], pp: 'umbrella', pk: 'box' }, blurb: 'Give them a lane and the ball is in the net.' },
  { key: 'trap', name: 'Trap Masters', arch: ['defensive', 'defensive', 'balanced', 'playmaker'], tac: { lines: ['shell', 'shell', 'counter'], pp: 'umbrella', pk: 'box' }, blurb: 'Patient, structured, and miserable to play against.' },
  { key: 'fore', name: 'Press Frenzy', arch: ['speedster', 'enforcer', 'balanced', 'defensive'], tac: { lines: ['forecheck', 'forecheck', 'balanced'], pp: 'overload', pk: 'aggressive' }, blurb: 'Relentless pressure in your end.' },
  { key: 'pass', name: 'Ball Possession', arch: ['playmaker', 'playmaker', 'balanced', 'sniper'], tac: { lines: ['balanced', 'balanced', 'shell'], pp: 'umbrella', pk: 'box' }, blurb: 'Tic-tac-toe passing; they make you chase.' },
  { key: 'goalie', name: 'Hot Keeper, Tight D', arch: ['defensive', 'balanced', 'balanced', 'defensive'], tac: { lines: ['shell', 'balanced', 'shell'], pp: 'umbrella', pk: 'box' }, blurb: 'Built from the six-yard box out.', gBoost: 1.6 },
];
// team strength bands (overall rating, 0-100): four top teams, three in the middle, three underdogs
const QP_TIERS = [{ lo: 80, hi: 90 }, { lo: 80, hi: 90 }, { lo: 80, hi: 90 }, { lo: 80, hi: 90 }, { lo: 65, hi: 85 }, { lo: 65, hi: 85 }, { lo: 65, hi: 85 }, { lo: 50, hi: 75 }, { lo: 50, hi: 75 }, { lo: 50, hi: 75 }];
const qpTierName = r => r >= 80 ? 'ELITE' : r >= 70 ? 'STRONG' : r >= 60 ? 'AVERAGE' : 'WEAK';
const qpRating = all => all.reduce((a, p) => a + overall(p), 0) / all.length * 10;
// nudge attributes one point at a time until the team's overall sits on its target
function qpCalibrate(all, target, rng) {
  for (let guard = 0; guard < 2000; guard++) {
    const r = qpRating(all), d = target - r;
    if (Math.abs(d) < 0.25) break;
    const up = d > 0, p = all[Math.floor(rng() * all.length)], ks = Object.keys(p.attrs).filter(k => up ? p.attrs[k] < 10 : p.attrs[k] > 1);
    if (!ks.length) continue;
    const k = ks[Math.floor(rng() * ks.length)]; p.attrs[k] += up ? 1 : -1;
  }
}
const newQpSeed = () => Math.random().toString(36).slice(2, 8).toUpperCase();
function qpSpecialty(p) {
  if (p.pos === 'G') return ['Lightning reflexes', 'Positional master', 'Rebound control', 'Quick recovery'][['ref', 'pos', 'reb', 'rec'].reduce((bi, k, i, a) => p.attrs[k] > p.attrs[a[bi]] ? i : bi, 0)];
  const names = { spd: 'Blazing speed', pow: 'Cannon shot', acc: 'Pinpoint shooter', pas: 'Elite playmaker', stk: 'Silky feet', def: 'Shutdown defender', chk: 'Crunching tackler', fo: 'Set-piece specialist', sta: 'Tireless motor' };
  const k = Object.keys(names).reduce((a, b) => (p.attrs[b] || 0) > (p.attrs[a] || 0) ? b : a);
  return names[k];
}
// the whole generation: deterministic in the seed
function generateQuickTeams(seed, prefix = 'qp') {
  const rng = mulberry32(hashStr('qp-' + seed));
  const sh = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const cities = sh(QP_CITIES), nicks = sh(QP_NICKS), pals = sh(QP_PALETTES), tiers = sh(QP_TIERS), styles = JERSEY_STYLES.filter(s => !s.cos).map(s => s.id);
  const abbrs = new Set(), teams = [];
  for (let i = 0; i < 10; i++) {
    const city = cities[i], [nick, emb] = nicks[i], pal = pals[i % pals.length], band = tiers[i], idn = pickR(QP_IDENTITIES, rng);
    const target = band.lo + rng() * (band.hi - band.lo), tier = { q: target / 10 - 0.35 };
    let abbr = (city.replace(/[^A-Z]/gi, '').slice(0, 3)).toUpperCase(); if (abbrs.has(abbr)) abbr = (city[0] + nick.slice(0, 2)).toUpperCase(); abbrs.add(abbr);
    const id = prefix + i;
    const ident = { id, city, nick, abbr, colors: { p: pal[0], s: pal[1], a: pal[2] }, style: pickR(styles, rng), emblem: EMBLEMS[emb] ? emb : 'puck' };
    const fake = { nextId: { p: 1 }, players: {}, teams: {} };
    const t = Object.assign(teamIdentity(ident), { roster: emptyRoster() });
    fake.teams[id] = t;
    const nStars = 3 + Math.floor(rng() * 3), spos = ['C', 'LW', 'RW', 'C', 'LD', 'RD', 'LW', 'RW', 'C', 'LD', 'RD', 'RW'];
    for (let k = 0; k < 12; k++) {
      const star = k < nStars, q = tier.q + (star ? 1.4 + rng() * 0.9 : (k < 6 ? 0.2 : -0.5)) + (rng() - 0.5) * 0.6;
      const p = genPlayer(rng, 'S', { q, spos: spos[k], arch: pickR(idn.arch, rng), age: star ? 23 + Math.floor(rng() * 9) : 19 + Math.floor(rng() * 15) });
      p.id = 'qp-' + seed + '-' + i + '-' + k; p.look = makeLook(p.id, p.age); fake.players[p.id] = p; addToRoster(fake, t, p.id);
    }
    for (let k = 0; k < 3; k++) {
      const p = genPlayer(rng, 'G', { q: tier.q + (k === 0 ? 0.8 + (idn.gBoost || 0) : -0.6 - k * 0.4) });
      p.id = 'qp-' + seed + '-' + i + '-g' + k; p.look = makeLook(p.id, p.age); fake.players[p.id] = p; addToRoster(fake, t, p.id);
    }
    autoArrange(fake, t); autoLeaders(fake, t);
    const all = rosterIds(t).map(id2 => fake.players[id2]);
    const stars = all.filter(p => p.pos !== 'G').sort((a, b) => overall(b) - overall(a)).slice(0, nStars - 1).concat(all.filter(p => p.pos === 'G').sort((a, b) => overall(b) - overall(a)).slice(0, 1));
    qpCalibrate(all, target, rng); autoArrange(fake, t);
    const rating = Math.round(qpRating(all));
    const ed = prefix === 'qp' && UI.qpEdits && UI.qpEdits[seed] && UI.qpEdits[seed][id];      // lines/tactics you set on the team sheet
    if (ed && ed.roster) t.roster = JSON.parse(JSON.stringify(ed.roster));
    teams.push({ ident, tier: qpTierName(rating), identity: idn, tac: validTac(ed && ed.tac ? ed.tac : idn.tac), fake, t, rating, stars: stars.map(p => ({ p, spec: qpSpecialty(p) })) });
  }
  return teams.sort((a, b) => b.rating - a.rating);
}
const qpLineup = q => lineupFor(q.fake, q.ident.id);
// your side: a seed team, or MY CLUB when you chose it (hook.js)
const qpSide = (teams, side) => side === 0 && UI.qpAsClub && typeof clubData === 'function' && clubData() ? clubTeam() : teams[UI.qpSel[side]];

// team strengths on a 0-100 scale for the matchup preview
function qpStrengths(q) {
  const pl = rosterIds(q.t).map(id => q.fake.players[id]), sk = pl.filter(p => p.pos !== 'G'), gs = pl.filter(p => p.pos === 'G');
  const avg = (arr, f) => arr.length ? arr.reduce((a, p) => a + f(p), 0) / arr.length : 0, a = (p, k) => p.attrs[k] ?? 5;
  const top = sk.slice().sort((x, y) => overall(y) - overall(x)).slice(0, 9);
  return { off: Math.round(avg(top, p => (a(p, 'pow') + a(p, 'acc') + a(p, 'pas') + a(p, 'stk')) / 4) * 10), def: Math.round(avg(top, p => (a(p, 'def') + a(p, 'chk')) / 2) * 10),
    spd: Math.round(avg(top, p => a(p, 'spd')) * 10), fo: Math.round(avg(top.slice().sort((x, y) => a(y, 'fo') - a(x, 'fo')).slice(0, 3), p => a(p, 'fo')) * 10), g: Math.round(Math.max(0, ...gs.map(p => (a(p, 'ref') + a(p, 'pos')) / 2)) * 10) };
}
// spectator mode: the computer plays both sides; your settings come back afterwards
function specBegin() {
  S.spectate = { autoAI: S.autoAI, pres: Object.assign({}, S.pres), hint: S.firstMatch };
  S.autoAI = true; S.firstMatch = false; S.pres = Object.assign({}, S.pres, { linePick: false, extraPick: false });
  document.body.classList.add('spectate');
  if (!document.getElementById('specBadge')) { const b = document.createElement('div'); b.id = 'specBadge'; b.textContent = '\uE004 CPU VS CPU · ESC: PAUSE'; (document.getElementById('wrap') || document.body).appendChild(b); }
}
function specEnd() {
  const sv = S.spectate; if (!sv) return;
  S.autoAI = sv.autoAI; S.pres = sv.pres; S.firstMatch = sv.hint; S.spectate = null;
  document.body.classList.remove('spectate');
}
// QUICK PLAY: just what you need to drop the puck. The full team browser is one click away (SHOW ALL TEAMS).
function scrQuickPlay() {
  UI.qpSeed = UI.qpSeed || newQpSeed();
  const teams = generateQuickTeams(UI.qpSeed);
  if (!UI.qpSel || UI.qpSel[0] >= teams.length || UI.qpSel[1] >= teams.length || UI.qpSel[0] === UI.qpSel[1]) UI.qpSel = [0, Math.min(5, teams.length - 1)];
  UI.qpDiff = UI.qpDiff || 'NORMAL'; UI.qpSpeed = UI.qpSpeed || 'NORMAL';
  const tierCol = { ELITE: '#ffd23f', STRONG: '#5ee07a', AVERAGE: '#7ec8ff', WEAK: '#ff9a7a' };
  const box = h('div', { class: 'qp2' });
  const cycle = (side, d) => { const s = UI.qpSel; let n = s[side]; do { n = (n + d + teams.length) % teams.length; } while (n === s[1 - side]); s[side] = n; render(); };
  const render = () => {
    box.innerHTML = '';
    const plate = side => {
      const q = qpSide(teams, side), st = qpStrengths(q);
      return h('div', { class: 'qp2side ' + (side ? 'away' : 'home'), title: 'Open this team: lines and tactics', onclick: e => { if (e.target.closest('button')) return; if (q.club) return go(scrClub); qpTeamSheet(q, !!side, render); } },
        h('div', { class: 'qp2tag' }, (side ? (UI.qpAway ? 'HOME' : 'AWAY') + ' · COMPUTER' : (UI.qpAway ? 'AWAY' : 'HOME') + ' · YOU')),
        h('div', { class: 'qp2pick' },
          h('button', { class: 'qp2arrow', title: 'Previous team', disabled: !!q.club, onclick: () => cycle(side, -1) }, '◀'),
          h('div', { class: 'qp2badge' }, badge(q.ident, 96)),
          h('button', { class: 'qp2arrow', title: 'Next team', disabled: !!q.club, onclick: () => cycle(side, 1) }, '▶')),
        h('div', { class: 'qp2name', style: { color: teamTextColor(q.ident) } }, fullName(q.ident).toUpperCase()),
        h('div', { class: 'qp2meta' }, h('span', { style: { color: tierCol[q.tier] } }, q.tier), ' · RATING ', h('b', null, q.rating)),
        h('div', { class: 'qp2meta muted' }, q.identity.name), h('div', { class: 'qp2meta muted' }, 'OFF ' + st.off + ' · DEF ' + st.def + ' · KEEPER ' + st.g),
        h('div', { class: 'qp2edit' }, UI.qpEdits && UI.qpEdits[UI.qpSeed] && UI.qpEdits[UI.qpSeed][q.ident.id] ? '✎ EDITED · TAP TO OPEN' : '✎ TAP FOR LINES & TACTICS'));
    };
    const H0 = qpSide(teams, 0), A0 = teams[UI.qpSel[1]], diff = H0.rating - A0.rating;
    const fav = Math.abs(diff) < 3 ? 'AN EVEN MATCHUP' : (diff > 0 ? 'YOU ARE FAVOURED' : 'THE COMPUTER IS FAVOURED');
    const dd = (lab, val, opts, set) => h('label', { class: 'qp2dd' }, h('span', null, lab),
      h('select', { onchange: e => set(e.target.value) }, opts.map(([v, t]) => h('option', { value: v, selected: v === val }, t))));
    UI.qpMode = UI.qpMode || 'game';
    const tab = (k, label, fn) => h('button', { class: 'small qptab' + (UI.qpMode === k ? ' sel' : ''), onclick: fn || (() => { UI.qpMode = k; render(); }) }, label);
    const startLabel = { game: 'START GAME \u25B6', so: 'START SHOOTOUT SERIES \u25B6', fg: 'FIRST GOAL WINS \u25B6' }[UI.qpMode];
    const startFn = () => UI.qpMode === 'so' ? qpSeriesStart(teams) : qpStart(teams, false);
    box.append(
      h('div', { class: 'qptabs' }, typeof scrClub === 'function' ? tab('club', '★ MY CLUB', () => go(scrClub)) : null, typeof scrDaily === 'function' ? tab('daily', '★ DAILY', () => go(scrDaily)) : null, tab('game', 'EXHIBITION'), tab('so', 'SHOOTOUTS'), tab('fg', 'FIRST GOAL'),
        tab('tour', 'TOURNEY', () => go(scrTourneySetup)), tab('ch', 'CHALLENGES', () => go(scrChallenges)), tab('pr', 'PRACTICE', () => go(scrPractice))),
      h('div', { class: 'qp2match' }, plate(0),
        h('div', { class: 'qp2mid' }, h('div', { class: 'qp2vs' }, 'VS'), h('div', { class: 'qp2fav' }, fav),
          h('button', { class: 'qp2all', onclick: () => go(scrQuickPlayAll) }, '☰ SHOW ALL TEAMS'),
          h('button', { class: 'small ghost', onclick: () => { UI.qpSel = [UI.qpSel[1], UI.qpSel[0]]; render(); } }, '⇄ SWAP TEAMS'),
          h('div', { class: 'row', style: { gap: '4px', justifyContent: 'center', marginTop: '6px' } },
            h('button', { class: 'small' + (!UI.qpAway ? ' sel' : ''), onclick: () => { UI.qpAway = false; render(); } }, 'PLAY HOME'),
            h('button', { class: 'small' + (UI.qpAway ? ' sel' : ''), onclick: () => { UI.qpAway = true; render(); } }, 'PLAY AWAY'))),
        plate(1)),
      h('div', { class: 'qp2opts' },
        dd('DIFFICULTY', UI.qpDiff, [['EASY', 'EASY'], ['NORMAL', 'NORMAL'], ['HARD', 'HARD']], v => { UI.qpDiff = v; render(); }),
        UI.qpDiff === 'HARD' ? dd('GAME SPEED', 'NORMAL', [['NORMAL', 'NORMAL (HARD)']], () => {})
          : dd('GAME SPEED', SPEEDS[UI.qpSpeed] ? UI.qpSpeed : 'NORMAL', [['RELAXED', 'RELAXED'], ['NORMAL', 'NORMAL']], v => { UI.qpSpeed = v; }),
        typeof clubData === 'function' && clubData() ? dd('YOUR TEAM', UI.qpAsClub ? 'club' : 'seed', [['seed', 'A SEED TEAM'], ['club', '★ MY CLUB']], v => { UI.qpAsClub = v === 'club'; render(); }) : null,
        UI.qpMode === 'so' ? dd('SERIES', String(UI.qpSoBest || 3), [['3', 'BEST OF 3'], ['5', 'BEST OF 5'], ['7', 'BEST OF 7']], v => { UI.qpSoBest = +v; }) : qpArenaPick(UI.qpAway ? A0 : H0, render)),
      h('div', { class: 'qp2go' }, h('button', { class: 'primary qp2start', onclick: startFn }, startLabel),
        h('button', { class: 'ghost', title: 'Both teams are played by the computer; you watch.', onclick: () => qpStart(teams, true) }, ' WATCH CPU VS CPU')),
      h('div', { class: 'qp2foot' }, typeof scrDuel === 'function' ? h('button', { class: 'small', onclick: () => go(scrDuel) }, '⚔ 2 PLAYERS: BREAKAWAY DUEL') : null, h('button', { class: 'small ghost', onclick: () => UI.save ? go(scrExhibition) : go(() => scrChooseSave(scrExhibition)) }, 'PLAY WITH A FRANCHISE ROSTER...'),
        h('button', { class: 'small ghost', onclick: () => go(() => scrSettings(scrQuickPlay)) }, '\u2699 SETTINGS')));
  };
  render();
  return h('div', { class: 'screen' }, header('QUICK PLAY', () => go(scrMain), 'BACK'), box);
}
// the team sheet: a compact look at one Quick Play team, to tweak lines and tactics before puck drop.
// Tap a player, then another, to swap them (lines, extras and goalies). Changes stay with this team for this seed.
function qpTeamSheet(q, cpu, onDone) {
  const t = q.t, Pl = id => id && q.fake.players[id];
  const hideTac = UI.qpDiff === 'EASY' || (cpu && UI.qpDiff === 'HARD');
  let sel = null, tab = UI.qpSheetTab === 'tac' && !hideTac ? 'tac' : 'lines';
  const save = () => { const E = (UI.qpEdits = UI.qpEdits || {}); (E[UI.qpSeed] = E[UI.qpSeed] || {})[q.ident.id] = { roster: JSON.parse(JSON.stringify(t.roster)), tac: q.tac }; };
  const body = h('div');
  const card = slot => {
    const id = slot.kind === 'g' ? t.roster.goalies[slot.i] : slot.kind === 'res' ? t.roster.reserves[slot.i] : t.roster.lines[slot.i][slot.j];
    const p = Pl(id), isSel = sel && sel.kind === slot.kind && sel.i === slot.i && sel.j === slot.j;
    const click = () => {
      if (!sel) { sel = slot; return draw(); }
      if (isSel) { sel = null; return draw(); }
      if ((sel.kind === 'g') !== (slot.kind === 'g')) { toast('Players swap with players, keepers with keepers.'); sel = slot; return draw(); }
      swapSlots(t, sel, slot); sel = null; save(); draw();
    };
    if (!p) return h('div', { class: 'qpsc empty' + (isSel ? ' sel' : ''), onclick: click }, '—');
    const role = slot.kind === 'line' ? slot.j : null, pen = role != null ? offPosPenalty(p.spos, role, p) : 0;
    return h('div', { class: 'qpsc' + (isSel ? ' sel' : ''), onclick: click },
      h('div', { class: 'qpscn' }, h('span', { class: 'num' }, '#' + p.num), ' ', p.last.toUpperCase()),
      h('div', { class: 'muted' }, posLabel(p) + ' · OVR ', h('b', { class: 'gold' }, ovrInt(p)), pen > 0 ? h('span', { style: { color: pen > 0.2 ? '#ff9a7a' : '#ffd23f' } }, ' · off-pos') : null),
      h('div', { class: 'qpscs' }, qpSpecialty(p)));
  };
  const draw = () => {
    body.innerHTML = ''; const r = t.roster, tc = validTac(q.tac);
    const tabs = h('div', { class: 'row', style: { gap: '4px', justifyContent: 'flex-start', margin: '8px 0' } },
      h('button', { class: 'small' + (tab === 'lines' ? ' sel' : ''), onclick: () => { tab = UI.qpSheetTab = 'lines'; draw(); } }, 'LINES'),
      hideTac ? null : h('button', { class: 'small' + (tab === 'tac' ? ' sel' : ''), onclick: () => { tab = UI.qpSheetTab = 'tac'; draw(); } }, 'TACTICS'),
      h('button', { class: 'small ghost', title: 'Rebuild the lines for this team\'s tactics: natural sides, a stay-at-home D on every line, the best players up top', onclick: () => { autoArrange(q.fake, t); sel = null; save(); draw(); toast('Lines set automatically.'); } }, '↺ AUTO LINES'));
    body.appendChild(tabs);
    if (tab === 'lines') {
      body.appendChild(h('div', { class: 'gold', style: { fontSize: 'calc(7px * var(--ts, 1.2))', minHeight: '12px', marginBottom: '4px' } }, sel ? 'SWAPPING: tap another player, or the same one to cancel.' : 'Tap a player, then another, to swap them.'));
      const row = (lab, sub, cells) => h('div', { class: 'qpsrow' }, h('div', { class: 'qpslab' }, lab, sub ? h('div', { class: 'muted' }, sub) : null), cells);
      for (let i = 0; i < 3; i++) body.appendChild(row('LINE ' + (i + 1), hideTac ? null : STRATEGIES[tc.lines[i]].short + ' · ' + TEMPOS[tc.tempo[i]].name, [0, 1, 2].map(j => card({ kind: 'line', i, j }))));
      body.appendChild(row('EXTRAS', 'not dressed', r.reserves.map((_, i) => card({ kind: 'res', i }))));
      body.appendChild(row('KEEPERS', 'first one starts', r.goalies.map((_, i) => card({ kind: 'g', i }))));
    } else body.appendChild(tacticsPanel(tc, n => { q.tac = n; save(); draw(); }, { showDesc: false, ignoreEasy: true }));
    if (UI.qpDiff === 'EASY') body.appendChild(h('div', { class: 'muted', style: { marginTop: '6px' } }, 'EASY: both teams play Balanced, so only the lines matter.'));
    else if (cpu && UI.qpDiff === 'HARD') body.appendChild(h('div', { class: 'muted', style: { marginTop: '6px' } }, 'HARD: the computer picks its own tactics and keeps them hidden. You can still set its lines.'));
  };
  draw();
  modal(close => h('div', null,
    h('div', { class: 'row', style: { justifyContent: 'flex-start', gap: '12px' } }, badge(q.ident, 44),
      h('div', { style: { flex: 1 } }, h('h2', { style: { margin: 0, color: teamTextColor(q.ident) } }, fullName(q.ident).toUpperCase()),
        h('div', { class: 'sub', style: { margin: 0 } }, (cpu ? 'COMPUTER' : 'YOU') + ' · ' + q.tier + ' · rating ' + q.rating + ' · ' + q.identity.name)),
      h('button', { class: 'small', onclick: () => qpRoster(q) }, 'FULL ROSTER')),
    body,
    h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'primary', onclick: () => { close(); onDone && onDone(); } }, 'DONE'))), true);
}
// start a quick game with the chosen matchup; difficulty and speed apply to this game only
function qpStart(teams, spectate) {
  const a = qpSide(teams, 0), b = teams[UI.qpSel[1]], seedAt = UI.qpSeed;
  const keep = { diff: S.diff, speed: S.speed }, restore = () => { S.diff = keep.diff; S.speed = keep.speed; };
  S.diff = UI.qpDiff || 'NORMAL'; S.speed = UI.qpDiff === 'HARD' || !SPEEDS[UI.qpSpeed] ? 'NORMAL' : UI.qpSpeed;
  if (spectate) specBegin();
  const away = !!UI.qpAway, hostT = away ? b : a, arena = qpArenaCfg(hostT.ident);     // you are always team 0; 'home' says whose building it is
  const fg = UI.qpMode === 'fg' && !spectate;
  launchMatch({ teams: [a.ident, b.ident], home: away ? 1 : 0, lineups: [qpLineup(a), qpLineup(b)], tac: [a.tac, b.tac], decider: fg ? 'sudden' : 'shootout', firstGoal: fg, kind: 'quick', canRestart: true, arena, arenaName: arena ? arenaTitle(hostT.ident, arena) : null,
    spectate,
    onEnd: res => { specEnd(); restore(); leaveMatch(); if (!spectate && res.winner === 0 && typeof qpCount === 'function') qpCount('wins'); const o = { title: spectate ? 'QUICK PLAY · CPU VS CPU' : fg ? 'FIRST GOAL WINS' : 'QUICK PLAY', teams: [a.ident, b.ident], res, mode: 'quick', spectate, again: () => qpStart(teams, spectate) }; go(() => scrPostgame(o)); },
    onQuit: () => { specEnd(); restore(); UI.qpSeed = seedAt; go(scrQuickPlay); } });
}
// ARENA: play in the home club's own building, or pick any venue (the Grand Hockey Palace unlocks for Quick Play once
// one of your franchises has built it). A live preview shows the stands, concourse and lighting.
const qpVenueLocked = v => v === 'palace' && !(typeof hasCosmetic === 'function' && hasCosmetic('palace_qp'));
function qpArenaCfg(ident) {
  if (typeof aiArena !== 'function') return null;
  const base = aiArena(ident), v = UI.qpVenue;
  if (!v || v === 'auto' || !VENUES[v] || qpVenueLocked(v)) return base;
  return Object.assign({}, base, { venue: v, show: typeof venueShow === 'function' ? venueShow(v) : base.show, ...(typeof venueBoards === 'function' ? venueBoards(v) : {}), lighting: v === 'retro' ? 'disco' : v === 'barn' ? 'dim' : v === 'modern' || v === 'palace' ? 'bright' : base.lighting === 'disco' ? 'classic' : base.lighting });
}
// the arena: a dropdown next to difficulty and speed, with a PREVIEW button that opens the picture in a window
// (so the Quick Play screen never needs scrolling)
function qpArenaPick(home, rerender) {
  UI.qpVenue = UI.qpVenue || 'auto';
  const own = typeof aiArena === 'function' ? aiArena(home.ident).venue : 'classic';
  const opts = [['auto', 'HOME ARENA (' + VENUES[own].name.toUpperCase() + ')']].concat(Object.keys(VENUES).map(v => [v, (qpVenueLocked(v) ? ' ' : '') + VENUES[v].name.toUpperCase()]));
  const sel = h('select', { onchange: e => { const v = e.target.value; if (qpVenueLocked(v)) { toast('LOCKED · Build the Grand Soccer Palace in one of your franchises to play in it in Quick Play.'); e.target.value = UI.qpVenue; return; } UI.qpVenue = v; rerender(); } },
    opts.map(([v, t]) => h('option', { value: v, selected: v === UI.qpVenue }, t)));
  return h('label', { class: 'qp2dd' }, h('span', null, 'ARENA'), h('div', { class: 'row', style: { gap: '6px', flexWrap: 'nowrap' } }, sel,
    h('button', { class: 'small', title: 'See what this arena looks like', onclick: e => { e.preventDefault(); qpArenaPreview(home); } }, '👁 PREVIEW')));
}
function qpArenaPreview(home) {
  const cfg = qpArenaCfg(home.ident), V = VENUES[cfg ? cfg.venue : 'classic'];
  const cv = h('canvas', { width: 300, height: 170, class: 'px', style: { width: 'min(600px, 70vw)', height: 'auto', display: 'block', margin: '8px auto', border: '2px solid #2a3060' } });
  setTimeout(() => { if (cfg && typeof previewArena === 'function') previewArena(cv, cfg, home.ident, true); }, 0);
  modal(close => h('div', { style: { textAlign: 'center' } },
    h('div', { class: 'gold', style: { fontSize: '10px' } }, cfg ? arenaTitle(home.ident, cfg) : ''), cv,
    h('div', { class: 'muted', style: { fontSize: '7px', lineHeight: 1.8 } }, V ? V.desc : ''),
    h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '8px' } }, h('button', { class: 'primary', onclick: close }, 'OK'))));
}
function scrQuickPlayAll() {
  UI.qpSeed = UI.qpSeed || newQpSeed();
  let teams = generateQuickTeams(UI.qpSeed);
  let sel = UI.qpSel && UI.qpSel[0] < teams.length && UI.qpSel[1] < teams.length ? UI.qpSel.slice() : [0, Math.min(5, teams.length - 1)], pickSide = 0;
  const box = h('div'), seedBox = h('div');
  const tierCol = { ELITE: '#ffd23f', STRONG: '#5ee07a', AVERAGE: '#7ec8ff', WEAK: '#ff9a7a' };
  const render = () => {
    UI.qpSel = sel.slice();
    box.innerHTML = ''; seedBox.innerHTML = '';
    seedBox.appendChild(h('div', { class: 'panel row', style: { justifyContent: 'space-between', alignItems: 'center' } },
      h('div', null, h('div', { class: 'sub', style: { margin: '0 0 4px' } }, 'TEAM SEED: the same seed always builds the same ten teams.'), h('span', { class: 'sub', style: { margin: 0 } }, 'SEED '), h('b', { class: 'gold', style: { fontSize: '12px' } }, UI.qpSeed)),
      h('div', { class: 'row' },
        h('button', { onclick: () => { UI.qpSeed = newQpSeed(); teams = generateQuickTeams(UI.qpSeed); render(); } }, '↻ REGENERATE TEAMS'),
        h('button', { onclick: () => { try { navigator.clipboard.writeText(UI.qpSeed); toast('Seed ' + UI.qpSeed + ' copied.'); } catch (e) { toast('Seed: ' + UI.qpSeed); } } }, '⧉ COPY SEED'),
        h('button', { onclick: () => modal(close => { const inp = h('input', { type: 'text', value: '', maxLength: 16, placeholder: 'e.g. K3X9QA', style: { width: '180px' } }); return h('div', null, h('h2', null, 'ENTER A SEED'), h('div', { class: 'sub' }, 'The same seed always builds the same ten teams and rosters.'), inp,
          h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'primary', onclick: () => { const v = inp.value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, ''); if (!v) return toast('Type a seed first.'); UI.qpSeed = v; teams = generateQuickTeams(v); sel = [0, 5]; close(); render(); } }, 'GENERATE'), h('button', { onclick: close }, 'CANCEL'))); }) }, '⌨ ENTER SEED'))));
    // matchup preview: HOME (you) vs AWAY (computer)
    const H0 = teams[sel[0]], A0 = teams[sel[1]], sa = qpStrengths(H0), sb = qpStrengths(A0);
    const side = (q, i) => h('div', { class: 'qpside' + (pickSide === i ? ' picking' : ''), onclick: () => { pickSide = i; UI.tabMem = UI.tabMem || {}; UI.tabMem.qpall = 1; render(); } },
      h('div', { class: 'qptag ' + ((i === 1) !== !!UI.qpAway ? 'away' : 'home') }, ((i === 1) !== !!UI.qpAway ? 'AWAY' : 'HOME') + (i ? ' · COMPUTER' : ' · YOU')), badge(q.ident, 72),
      h('div', { style: { color: teamTextColor(q.ident), fontSize: '12px', margin: '8px 0 4px' } }, fullName(q.ident)),
      h('div', { style: { fontSize: '8px' } }, h('span', { style: { color: tierCol[q.tier] } }, q.tier), ' · RATING ' + q.rating),
      h('div', { class: 'muted', style: { fontSize: '8px', marginTop: '4px' } }, q.identity.name),
      h('div', { style: { fontSize: '8px', marginTop: '6px', lineHeight: 1.9 } }, q.stars.slice(0, 2).map(st => h('div', null, '★ ' + st.p.first[0] + '. ' + st.p.last + ' · ' + st.spec))),
      h('div', { class: 'hint', style: { marginTop: '6px' } }, 'click to pick this team in PICK TEAMS'));
    const bar = (lab, a, b) => h('div', { class: 'qpbar' }, h('span', { class: 'v' + (a > b ? ' gold' : '') }, a), h('div', { class: 'track l' }, h('i', { style: { width: a + '%' } })), h('span', { class: 'lab' }, lab), h('div', { class: 'track r' }, h('i', { style: { width: b + '%' } })), h('span', { class: 'v' + (b > a ? ' gold' : '') }, b));
    const diff = H0.rating - A0.rating, fav = Math.abs(diff) < 3 ? 'An even matchup.' : (diff > 0 ? 'You are favoured' : fullName(A0.ident) + ' are favoured') + (Math.abs(diff) >= 10 ? ' by a lot.' : '.');
    const matchEl = (h('div', { class: 'panel qpmatch' },
      side(H0, 0),
      h('div', { class: 'qpmid' }, h('div', { class: 'qpvs' }, 'VS'),
        bar('OVERALL', H0.rating, A0.rating), bar('OFFENSE', sa.off, sb.off), bar('DEFENSE', sa.def, sb.def), bar('SPEED', sa.spd, sb.spd), bar('KICKOFFS', sa.fo, sb.fo), bar('KEEPER', sa.g, sb.g),
        h('div', { class: 'sub', style: { textAlign: 'center', margin: '8px 0 4px' } }, fav),
        UI.qpDiff === 'EASY' ? h('div', { class: 'muted', style: { fontSize: '7px', textAlign: 'center', lineHeight: 1.9 } }, 'EASY: no tactics, just soccer')
          : h('div', { class: 'muted', style: { fontSize: '7px', textAlign: 'center', lineHeight: 1.9 } }, h('span', { class: 'gold' }, 'HOME TACTICS '), UI.qpDiff === 'HARD' && UI.qpAway ? 'hidden on Hard' : tacLong(H0.tac), h('br'), h('span', { style: { color: '#ff6a4a' } }, 'AWAY TACTICS '), UI.qpDiff === 'HARD' && !UI.qpAway ? 'hidden on Hard' : tacLong(A0.tac)),
        h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '4px', gap: '6px' } }, UI.qpDiff === 'EASY' ? null : tacInfoBtn(), h('button', { class: 'small', onclick: () => { sel = [sel[1], sel[0]]; render(); } }, '⇄ SWAP HOME / AWAY'))),
      side(A0, 1)));
    const card = (q, i) => {
      const role = sel[0] === i ? 0 : sel[1] === i ? 1 : -1;               // 0 = your team, 1 = the computer's
      const hs = UI.qpAway ? 1 : 0, isH = role === hs, isA = role === 1 - hs;  // which slot is the home side
      const put = sd => { const other = 1 - sd; if (sel[other] === i) sel = [sel[1], sel[0]]; else sel[sd] = i; pickSide = 1 - sd; render(); };
      return h('div', { class: 'teamcard' + (role === 0 ? ' on' : role === 1 ? ' opp' : ''), style: { alignItems: 'flex-start', position: 'relative' }, onclick: () => put(pickSide) },
        role >= 0 ? h('div', { class: 'qptag mini ' + (isA ? 'away' : 'home') }, (isH ? 'HOME' : 'AWAY') + (role === 0 ? ' · YOU' : ' · CPU')) : null,
        badge(q.ident, 40),
        h('div', { style: { flex: 1 } },
          h('div', { style: { color: teamTextColor(q.ident) } }, fullName(q.ident), ' ', h('span', { style: { color: tierCol[q.tier], fontSize: '7px' } }, q.tier + ' ' + q.rating)),
          h('div', { class: 'muted', style: { fontSize: '7px', margin: '3px 0' }, 'data-help': q.identity.blurb }, q.identity.name),
          h('div', { class: 'qpstars', style: { fontSize: '7px', lineHeight: 1.9 } }, q.stars.map(s => h('div', { 'data-help': '#' + s.p.num + ' ' + s.p.first + ' ' + s.p.last + ' (' + posLabel(s.p) + ', OVR ' + ovrInt(s.p) + '): ' + s.spec }, '★ ' + s.p.last + ' ' + ovrInt(s.p)))),
          h('div', { class: 'row', style: { marginTop: '4px', justifyContent: 'flex-start' } },
            h('button', { class: 'small' + (isH ? ' primary' : ''), onclick: e => { e.stopPropagation(); put(hs); } }, isH ? '✓ HOME' : 'SET AS HOME'),
            h('button', { class: 'small' + (isA ? ' danger' : ''), onclick: e => { e.stopPropagation(); put(1 - hs); } }, isA ? '✓ AWAY' : 'SET AS AWAY'),
            h('button', { class: 'small', onclick: e => { e.stopPropagation(); qpRoster(q); } }, 'INFO'))));
    };
    // one thing at a time: the matchup, the teams (four to a page), the seed
    box.appendChild(tabbed('qpall', [
      { label: 'MATCHUP', el: matchEl },
      { label: 'PICK TEAMS', el: () => h('div', null, h('div', { class: 'sub', style: { margin: '0 0 6px' } }, 'Click a team card to put it on the side being chosen (' + (pickSide ? 'COMPUTER' : 'YOU') + '), or use its HOME / AWAY buttons. INFO opens the full roster.'),
        pages('qpteams', teams.map((q, i) => [q, i]), 4, list => h('div', { class: 'grid g2' }, list.map(([q, i]) => card(q, i))))) },
      { label: 'TEAM SEED', el: seedBox },
    ]));
  };
  render();
  return h('div', { class: 'screen qpallS' }, header('ALL TEAMS', () => go(scrQuickPlay), 'BACK', h('button', { class: 'primary', onclick: () => go(scrQuickPlay) }, 'USE THIS MATCHUP ▶')), box);
}
function qpRoster(q) {
  modal(close => {
    const pls = rosterIds(q.t).map(id => q.fake.players[id]);
    const keys = SK_ATTRS.map(a => a[0]);
    return h('div', null, h('div', { class: 'row', style: { justifyContent: 'flex-start', gap: '12px' } }, badge(q.ident, 44), h('div', null, h('h2', { style: { margin: 0 } }, fullName(q.ident).toUpperCase()), h('div', { class: 'sub', style: { margin: 0 } }, q.tier + ' · rating ' + q.rating + ' · ' + q.identity.name))),
      h('div', { class: 'sub' }, 'Tactics: ' + tacLong(q.tac), ' ', tacInfoBtn()),
      h('div', { style: { overflowX: 'auto' } }, h('table', null, h('tr', null, ['#', 'PLAYER', 'POS', 'SH', 'AGE', 'OVR'].concat(keys.map(k => k.toUpperCase())).concat(['SPECIALTY']).map(x => h('th', null, x))),
        pls.map(p => h('tr', null, h('td', null, p.num), h('td', { class: 'l' }, p.first + ' ' + p.last), h('td', null, posLabel(p)), h('td', null, p.pos === 'G' ? 'C' + goalieCatch(p) : p.hand), h('td', null, p.age), h('td', { class: 'gold' }, ovrInt(p)),
          keys.map(k => h('td', null, p.pos === 'G' ? '' : r100(p.attrs[k]))), h('td', { class: 'l', style: { fontSize: '7px' } }, qpSpecialty(p) + (p.pos === 'G' ? ' · REF ' + r100(p.attrs.ref) + ' POS ' + r100(p.attrs.pos) : '')))))),
      h('div', { class: 'row' }, h('button', { onclick: close }, 'CLOSE')));
  }, true);
}
