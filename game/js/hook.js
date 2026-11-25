'use strict';
// ====================================================================
//  HOOK (Nov 22): the things that keep a player coming back, on the Quick Play side.
//  1. Early unlocks: FIRST GOAL (Lucky Orange tape) and FIRST WIN (Victory stick), earned in any game you play.
//  2. Unlock progress: how far you are toward every account unlock you can earn in Quick Play, and what to play next.
//  3. THE LOCKER: every account unlock, owned or not, and how to earn it (no franchise save needed). It is also a tab
//     of LEGACY, so there is one door to your honours.
//  4. MY CLUB: one Quick Play team that is yours for good. Rename it, dress it in your unlocks, and climb THE LADDER
//     (ten clubs, weakest to strongest). Every ladder win makes one or two of your players a little better.
//  5. PLATINUM: a gold medal on HARD is a platinum medal.
//  6. YOUR GAME: what the skater you were steering did (shots, goals, hits, takeaways, passes, dekes).
//  Loaded after modes.js, masks.js and gear.js.
// ====================================================================

// ---------- 1. early unlocks
Object.assign(COSMETICS, {
  first_goal: { name: 'Lucky Orange Tape', kind: 'gear', hint: 'Score your first goal in any game you play.', desc: 'Bright orange sock tape for the goal that started it all.' },
  first_win:  { name: 'Victory Stripes', kind: 'gear', hint: 'Win your first game (any mode).', desc: 'Royal-purple boot stripes for your first win.' },
});
GEAR_OPTS.tape.lucky = 'Lucky orange ★';
GEAR_OPTS.stick.victory = 'Victory purple stripes ★';
GEAR_LOCK['tape:lucky'] = 'first_goal';
GEAR_LOCK['stick:victory'] = 'first_win';
{ const _gc = gearCol;
  gearCol = function (gear, part, C) {
    const v = gear && gear[part];
    if (part === 'tape' && v === 'lucky') return '#ff8c1a';
    if (part === 'stick' && v === 'victory') return '#7a3ff0';
    return _gc(gear, part, C);
  }; }
QP_UNLOCKS.unshift(
  { cos: 'first_goal', text: 'Score your first goal', ok: () => qpHas('firstgoal') },
  { cos: 'first_win', text: 'Win your first game', ok: () => qpHas('firstwin') });

// ---------- 2. unlock progress: [have, need] and the thing to play for each Quick Play unlock
const hkChain = keys => keys.filter(k => qpHas('ch_' + k)).length;
const hkGolds = ids => ids.filter(k => qpMedal(k) >= 3).length;
const hkBest = id => Math.min(QP_DRILLS[id].medals[2], qpProg().best['dr_' + id] || 0);
const HK_PROG = {
  first_goal:      () => ({ have: qpHas('firstgoal') ? 1 : 0, need: 1, play: 'game' }),
  first_win:       () => ({ have: qpHas('firstwin') ? 1 : 0, need: 1, play: 'game' }),
  gold_stick:      () => ({ have: hkBest('gallery'), need: QP_DRILLS.gallery.medals[2], play: 'dr:gallery', unit: 'goals (best)' }),
  flame_helmet:    () => ({ have: hkBest('breakaway'), need: QP_DRILLS.breakaway.medals[2], play: 'dr:breakaway', unit: 'goals (best)' }),
  mask_fibre:      () => ({ have: hkBest('breakaway'), need: QP_DRILLS.breakaway.medals[2], play: 'dr:breakaway', unit: 'goals (best)' }),
  gold_visor:      () => ({ have: hkChain(['pp3', 'pp5', 'pp10']), need: 3, play: 'ch:' + (['pp3', 'pp5', 'pp10'].find(k => !qpHas('ch_' + k)) || 'pp10'), unit: 'power-play challenges' }),
  jersey_flames:   () => ({ have: hkChain(['pp3', 'pp5', 'pp10', 'ppgame']), need: 4, play: 'ch:' + (['pp3', 'pp5', 'pp10', 'ppgame'].find(k => !qpHas('ch_' + k)) || 'ppgame'), unit: 'power-play challenges' }),
  galaxy_mask:     () => ({ have: hkChain(['pk1', 'pk2', 'pkp']), need: 3, play: 'ch:' + (['pk1', 'pk2', 'pkp'].find(k => !qpHas('ch_' + k)) || 'pkp'), unit: 'penalty-kill challenges' }),
  star_mask:       () => ({ have: hkChain(['pk1', 'pk2', 'pkp', 'pk2p']), need: 4, play: 'ch:' + (['pk1', 'pk2', 'pkp', 'pk2p'].find(k => !qpHas('ch_' + k)) || 'pk2p'), unit: 'penalty-kill challenges' }),
  laststand_mask:  () => ({ have: hkChain(['pk1', 'pk2', 'pkp', 'pk2p', 'pkgame']), need: 5, play: 'ch:' + (['pk1', 'pk2', 'pkp', 'pk2p', 'pkgame'].find(k => !qpHas('ch_' + k)) || 'pkgame'), unit: 'penalty-kill challenges' }),
  jersey_laststand:() => ({ have: hkChain(['pk1', 'pk2', 'pkp', 'pk2p', 'pkgame']), need: 5, play: 'ch:' + (['pk1', 'pk2', 'pkp', 'pk2p', 'pkgame'].find(k => !qpHas('ch_' + k)) || 'pkgame'), unit: 'penalty-kill challenges' }),
  chrome_gear:     () => ({ have: hkGolds(['poke', 'hit', 'deke']), need: 3, play: 'dr:' + (['poke', 'hit', 'deke'].find(k => qpMedal(k) < 3) || 'deke'), unit: 'skill-drill golds' }),
  golden_horn:     () => ({ have: qpHas('so7') ? 1 : 0, need: 1, play: 'so7' }),
  emblem_phoenix:  () => ({ have: qpHas('tour8') || qpHas('tour16') ? 1 : 0, need: 1, play: 'tour' }),
  jersey_galaxy:   () => ({ have: qpHas('tour16b7') ? 1 : 0, need: 1, play: 'tour' }),
  emblem_laurel:   () => ({ have: Math.min(25, qpProg().n.wins || 0), need: 25, play: 'game', unit: 'wins' }),
  mask_target:     () => ({ have: Math.min(10, qpProg().n.wins || 0), need: 10, play: 'game', unit: 'wins' }),
};
function hkPlayLabel(play) {
  if (!play) return '';
  if (play.startsWith('dr:')) return QP_DRILLS[play.slice(3)].name;
  if (play.startsWith('ch:')) return QP_CHALLENGES[play.slice(3)].name;
  return { game: 'Any Quick Play game', so7: 'A best-of-7 shootout series', tour: 'A Quick Play tournament', ladder: 'The Ladder' }[play] || '';
}
function hkPlayGo(play) {
  if (!play) return;
  if (play.startsWith('dr:')) return startDrill(play.slice(3));
  if (play.startsWith('ch:')) { const id = play.slice(3); return chUnlocked(id) ? startChallenge(id) : go(scrChallenges); }
  if (play === 'so7') { UI.qpMode = 'so'; UI.qpSoBest = 7; return go(scrQuickPlay); }
  if (play === 'tour') return go(scrTourneySetup);
  if (play === 'ladder') return go(scrClub);
  UI.qpMode = 'game'; go(scrQuickPlay);
}
// every Quick Play unlock not yet owned, closest first
function hkNearest(n = 3) {
  const seen = new Set();
  return QP_UNLOCKS.filter(u => COSMETICS[u.cos] && !hasCosmetic(u.cos) && !seen.has(u.cos) && seen.add(u.cos)).map(u => {
    const p = (HK_PROG[u.cos] || (() => ({ have: u.ok() ? 1 : 0, need: 1 })))();
    return Object.assign({ cos: u.cos, text: u.text, name: COSMETICS[u.cos].name, frac: p.need ? p.have / p.need : 0 }, p);
  }).sort((a, b) => b.frac - a.frac || a.need - b.need).slice(0, n);
}
const hkBar = (frac, w = 120) => h('span', { class: 'salbar hkbar', style: { width: w + 'px', display: 'inline-block', verticalAlign: 'middle' } }, h('i', { style: { width: Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%' } }));

// ---------- 5. PLATINUM: a gold on HARD
MEDALS[4] = 'PLATINUM'; MEDAL_COL[4] = '#9ff3ff';
const qpPlat = id => !!qpProg().done['plat_' + id];
{ const _mr = modeResult;
  modeResult = function (mode, res) {
    const r = _mr(mode, res);
    if (mode.kind === 'drill' && QP_DRILLS[mode.id].medals && r.medal >= 3 && (UI.qpDiff || 'NORMAL') === 'HARD') {
      const first = qpFeat('plat_' + mode.id);
      r.medal = 4; r.line = 'PLATINUM MEDAL (GOLD ON HARD)'; if (first) r.newMedal = true;
    } else if (mode.kind === 'drill' && QP_DRILLS[mode.id].medals && r.medal >= 3 && !qpPlat(mode.id)) r.line += ' · GOLD ON HARD = PLATINUM';
    if (!mode.game && mode.kind !== 'drill' && r.won && (UI.qpDiff || 'NORMAL') === 'HARD') { qpFeat('plat_ch_' + mode.id); r.extra = (r.extra ? r.extra + ' · ' : '') + 'DONE ON HARD'; }
    return r;
  }; }

// ---------- 6. YOUR GAME: the skater you were steering (team 0, never in CPU vs CPU)
const YOU = { on: false, s: null };
const youOn = p => YOU.on && p && p === ctrl && p.team === 0 && !S.autoAI;
function youReset() { YOU.s = { shots: 0, g: 0, hit: 0, tk: 0, pas: 0, deke: 0, steals: 0 }; YOU.on = !S.autoAI; }
{ const _sh = shoot; shoot = function (p, power) { if (youOn(p)) YOU.s.shots++; return _sh.apply(this, arguments); }; }
{ const _hit = statHit; statHit = function (p) { if (youOn(p)) YOU.s.hit++; return _hit.apply(this, arguments); }; }
{ const _de = defEvent; defEvent = function (p, kind) { if (youOn(p) && MS && !S.so && S.phase !== 'penalty') YOU.s.tk++; return _de.apply(this, arguments); }; }
{ const _sp = statPossess; statPossess = function (p, passer) { if (youOn(passer) && passer.team === p.team && MS && !S.so) YOU.s.pas++; return _sp.apply(this, arguments); }; }
{ const _ce = clipEvent; clipEvent = function (kind, o) { if (kind === 'deke' && YOU.on && ctrl && ctrl.pl && o && o.team === 0 && (o.players || []).includes(ctrl.pl.id)) YOU.s.deke++; return _ce.apply(this, arguments); }; }

// ---------- match hooks: the first goal / first win unlocks, the club ladder, YOUR GAME
function hkGrant(id, why) {
  const save = S.match && S.match.season ? UI.save : null;
  if (!grantCosmetic(save, id, why)) return false;
  toast('UNLOCKED · ' + COSMETICS[id].name.toUpperCase());
  if (S.screen === 'play' || S.screen === 'paused') floaters.push({ x: CX, y: CY + 40, text: 'UNLOCKED: ' + COSMETICS[id].name.toUpperCase(), life: 180, color: '#ffd23f' });
  return true;
}
const hkHuman = () => S.match && !S.autoAI && !S.match.demo && !S.match.test && !S.spectate;
{ const _sg = scoreGoal;
  scoreGoal = function (team) {
    const before = S.score[team], lt = puck.lastTouch;
    const r = _sg.apply(this, arguments);
    if (S.score[team] > before && team === 0 && hkHuman()) {
      if (YOU.on && lt && lt === ctrl) YOU.s.g++;
      if (qpFeat('firstgoal')) hkGrant('first_goal', 'Your first goal');
    }
    return r;
  }; }
{ const _st = startMatch;
  startMatch = function (cfg) {
    const human = !S.autoAI && !cfg.demo && !cfg.test;
    if (cfg && cfg.onEnd && !cfg.hkWrapped) {
      const end = cfg.onEnd; cfg.hkWrapped = true;
      cfg.onEnd = res => {
        if (human && !S.autoAI) {
          res.you = YOU.s ? Object.assign({}, YOU.s) : null;
          if (res.winner === 0 && !(cfg.mode && !cfg.mode.game) && !cfg.soOnly) { if (qpFeat('firstwin')) hkGrant('first_win', 'Your first win'); }
          const q = qpProg(); q.n.games = (q.n.games || 0) + 1; PROFILE.dirty = true;
          if (res.you) hkYouBest(res.you);
        }
        YOU.on = false;
        end(res);
      };
    }
    const r = _st.apply(this, arguments);
    youReset(); if (!human) YOU.on = false;
    return r;
  }; }
// personal bests across every game you play
function hkYouBest(y) {
  const q = qpProg(); q.youBest = q.youBest || {};
  const nb = [];
  for (const k of ['g', 'shots', 'hit', 'tk', 'deke']) if (y[k] > 0 && y[k] > (q.youBest[k] || 0)) { if (q.youBest[k] != null) nb.push(k); q.youBest[k] = y[k]; }
  y.newBest = nb; PROFILE.dirty = true;
}
const YOU_LAB = { shots: 'SHOTS', g: 'GOALS', hit: 'TACKLES', tk: 'INTERCEPTIONS', pas: 'PASSES', deke: 'FEINTS' };
function youGameCard(y) {
  if (!y) return null;
  return h('div', { class: 'panel hkyou' }, h('div', { class: 'grouplab', style: { marginTop: 0 } }, 'YOUR GAME (THE PLAYER YOU STEERED)'),
    h('div', { class: 'hkyougrid' },
      Object.keys(YOU_LAB).map(k => h('div', { style: { textAlign: 'center' } },
        h('div', { class: (y.newBest || []).includes(k) ? 'gold' : '', style: { fontSize: 'calc(12px * var(--ts, 1.2))' } }, y[k] || 0),
        h('div', { class: 'muted', style: { fontSize: '7px' } }, YOU_LAB[k] + ((y.newBest || []).includes(k) ? ' · BEST!' : ''))))));
}

// ---------- the QUICK PLAY post-game strip: the nearest unlock and one thing to try next
function hkSuggest(res, o) {
  const won = res && res.winner === 0, margin = res ? Math.abs(res.score[0] - res.score[1]) : 0, out = [];
  if (o && o.club) {
    const L = clubData().ladder;
    out.push(won ? { label: 'NEXT RUNG ▶', go: () => go(scrClub), why: 'Keep climbing the Ladder.' } : { label: 'RETRY THE RUNG', go: () => clubLadderPlay(), why: 'Same opponent, another try.' });
    return out;
  }
  if (!won && res && o && o.again) out.push({ label: 'REMATCH', go: o.again, why: 'Run it back.' });
  if (won && margin >= 3 && (UI.qpDiff || 'NORMAL') !== 'HARD') out.push({ label: 'TRY HARD', go: () => { UI.qpDiff = 'HARD'; go(scrQuickPlay); }, why: 'You won by ' + margin + '. Hard plays sharper.' });
  if (won && UI.qpSel && o && o.mode === 'quick') out.push({ label: 'PLAY THE UNDERDOG', go: () => { UI.qpSel = [UI.qpSel[1], UI.qpSel[0]]; go(scrQuickPlay); }, why: 'Swap teams: win with the weaker side.' });
  const n = hkNearest(1)[0];
  if (n && n.play && n.play !== 'game') out.push({ label: hkPlayLabel(n.play).toUpperCase(), go: () => hkPlayGo(n.play), why: 'Closest unlock: ' + n.name + '.' });
  if (!clubData()) out.push({ label: 'START MY CLUB', go: () => go(scrClub), why: 'A team that is yours for good.' });
  if (typeof dailyToday === 'function' && !dailyPlayedToday()) out.push({ label: "TODAY'S CHALLENGE", go: () => go(scrDaily), why: 'One counted try a day.' });
  return out.slice(0, 3);
}
function hkProgressPanel(res, o) {
  const near = hkNearest(o && o.club ? 1 : 2), sug = hkSuggest(res, o), club = o && o.club;
  const left = h('div', null,
    club ? clubMovedPanel(o.club) : null,
    near.length ? h('div', { class: 'panel' }, h('div', { class: 'grouplab', style: { marginTop: 0 } }, 'NEXT UNLOCKS'),
      near.map(n => h('div', { class: 'hotrow', style: { gap: '8px' } }, h('b', { style: { flex: 1 } }, n.name, h('div', { class: 'modetxt' }, n.text)),
        hkBar(n.frac, 70), h('span', { class: 'gold', style: { minWidth: '36px', textAlign: 'right' } }, n.have + '/' + n.need)))) : h('div', { class: 'panel gold' }, 'Every Quick Play unlock is yours.'));
  const right = h('div', null,
    res && res.you ? youGameCard(res.you) : null,
    sug.length ? h('div', { class: 'panel' }, h('div', { class: 'grouplab', style: { marginTop: 0 } }, 'TRY NEXT'),
      h('div', { class: 'hktry' }, sug.map(s => h('button', { class: 'small', title: s.why, onclick: s.go }, s.label, h('div', { class: 'tsub' }, s.why))))) : null);
  return h('div', { class: 'hkprog' }, left, right);
}
// one line for the score strip: the single most useful thing that moved
function hkTeaser(res, o) {
  if (o && o.club && o.club.rungUp) return '▲ LADDER RUNG ' + o.club.rung + ' OF 10';
  const n = hkNearest(1)[0];
  return n ? n.name.toUpperCase() + ' ' + n.have + '/' + n.need : null;
}

// ---------- 3. THE LOCKER: account unlocks without a franchise save
function cosRoutes(id) {
  const out = [];
  for (const u of QP_UNLOCKS) if (u.cos === id) out.push('QUICK PLAY: ' + u.text);
  for (const a of ACHIEVEMENTS) if (a.reward && a.reward.cosmetic === id) out.push('SEASON MODE: ' + a.name + ' (' + a.desc.replace(/\.$/, '') + ')');
  if (!out.length && COSMETICS[id] && COSMETICS[id].hint) out.push(COSMETICS[id].hint);
  return [...new Set(out)];
}
function scrLocker(back) {
  back = back || UI.lockBack || scrMain;
  const kinds = { gear: 'GEAR', jersey: 'JERSEYS', emblem: 'EMBLEMS', trim: 'TRIM', arena: 'ARENA', presentation: 'PRESENTATION', cabinet: 'TROPHY ROOM', logo: 'LOGO' };
  const all = Object.entries(COSMETICS), got = all.filter(([id]) => hasCosmetic(id)).length;
  const card = ([id, c]) => { const on = hasCosmetic(id), r = cosRoutes(id), p = !on && HK_PROG[id] ? HK_PROG[id]() : null;
    return h('div', { class: 'coscard hklock' + (on ? ' on' : ''), title: (c.desc || '') + (r.length > 1 ? '\n' + r.join('\n') : '') }, h('span', { class: 'achmark' }, on ? '★' : ''),
      h('div', { style: { flex: 1, minWidth: 0 } }, h('div', null, c.name, p ? h('span', { class: 'gold', style: { fontSize: 'calc(6px * var(--ts, 1.2))' } }, '  ' + p.have + '/' + p.need) : null),
        on ? h('div', { class: 'gold', style: { fontSize: 'calc(6px * var(--ts, 1.2))' } }, 'YOURS' + (PROFILE.cos[id] && PROFILE.cos[id].from ? ' · ' + PROFILE.cos[id].from : ''))
          : h('div', { class: 'modetxt hkroute' }, r[0] || '', r.length > 1 ? ' (+' + (r.length - 1) + ' more way' + (r.length > 2 ? 's' : '') + ')' : ''))); };
  const medals = () => h('div', { class: 'panel hkmedals' }, h('div', null, h('div', { class: 'grouplab', style: { marginTop: 0 } }, 'MEDALS'),
    Object.entries(QP_DRILLS).filter(([, d]) => d.medals).map(([id, d]) => { const m = qpPlat(id) ? 4 : qpMedal(id);
      return h('div', { class: 'hotrow' }, h('span', { style: { color: MEDAL_COL[m], width: '16px' } }, m ? '●' : '○'), h('b', { style: { flex: 1 } }, d.name), h('span', { class: 'muted' }, m ? MEDALS[m] : 'NO MEDAL'), h('button', { class: 'small', onclick: () => startDrill(id) }, 'PLAY')); })), h('div', null,
    h('div', { class: 'grouplab', style: { marginTop: 0 } }, 'CHALLENGES'),
    h('div', { class: 'modetxt' }, Object.keys(QP_CHALLENGES).filter(k => qpHas('ch_' + k)).length + ' of ' + Object.keys(QP_CHALLENGES).length + ' complete · ' + Object.keys(qpProg().done).filter(k => k.startsWith('plat_ch_')).length + ' on HARD'),
    h('div', { class: 'grouplab' }, 'RECORD'),
    h('div', { class: 'modetxt' }, (qpProg().n.wins || 0) + ' Quick Play wins · ' + (qpProg().n.games || 0) + ' games played'),
    qpProg().youBest ? h('div', { class: 'modetxt' }, 'YOUR BESTS IN ONE GAME: ' + Object.entries(qpProg().youBest).map(([k, v]) => v + ' ' + YOU_LAB[k].toLowerCase()).join(' · ')) : null,
    typeof dailyData === 'function' ? [h('div', { class: 'grouplab' }, 'DAILY'), h('div', { class: 'modetxt' }, 'Streak ' + (dailyData().streak || 0) + ' · best ' + (dailyData().best || 0) + ' · ' + (dailyData().wins || 0) + ' daily wins')] : null));
  const tabs = Object.keys(kinds).filter(k => all.some(([, c]) => c.kind === k)).map(k => { const list = all.filter(([, c]) => c.kind === k).sort((a, b) => hasCosmetic(b[0]) - hasCosmetic(a[0]));
    return { label: kinds[k] + ' ' + list.filter(([id]) => hasCosmetic(id)).length + '/' + list.length, el: () => h('div', { class: 'panel' }, pages('lock' + k, list, 8, sl => h('div', { class: 'cosgrid2 hklockgrid' }, sl.map(card)))) }; });
  return h('div', { class: 'screen wide lockerS' }, header('THE LOCKER', () => go(back), 'BACK', h('b', { class: 'gold' }, 'UNLOCKED ' + got + ' / ' + all.length)),
    h('div', { class: 'sub', style: { margin: '0 0 6px' } }, 'Unlocks belong to your account: MY CLUB in Quick Play and every franchise can use them.'),
    tabbed('locker', [{ label: 'MEDALS & RECORD', el: medals }].concat(tabs)));
}

// ---------- 4. MY CLUB and THE LADDER
const CLUB_RUNGS = 10, CLUB_RATING_CAP = 96;
const clubData = () => qpProg().club || null;
function clubNew(seed, idx) {
  const base = generateQuickTeams(seed, 'club')[idx];
  const q = qpProg();
  q.club = { seed, idx, city: base.ident.city, nick: base.ident.nick, abbr: base.ident.abbr, colors: Object.assign({}, base.ident.colors), emblem: base.ident.emblem, style: base.ident.style,
    uni: {}, gear: {}, ggear: {}, boost: {}, ladder: { seed: newQpSeed(), rung: 0, level: 0, w: 0, l: 0, titles: 0 }, made: Date.now(), log: [] };
  PROFILE.dirty = true; return q.club;
}
// the club as a Quick Play team: the generated base, your name, colours and kit, your growth, your gear
function clubTeam() {
  const c = clubData(); if (!c) return null;
  const base = generateQuickTeams(c.seed, 'club')[c.idx];
  const id = base.ident.id;
  base.ident = Object.assign(base.ident, { city: c.city, nick: c.nick, abbr: c.abbr, colors: Object.assign({}, c.colors), emblem: c.emblem, style: c.style, trim: c.trim || null,
    kits: { home: { helmet: c.uni.helmet || 'team', gloves: c.uni.gloves || 'team', socks: c.uni.socks || 'team', fit: c.uni.fit || 'standard' } } });
  Object.assign(base.t, { city: c.city, nick: c.nick, abbr: c.abbr, colors: Object.assign({}, c.colors), emblem: c.emblem, style: c.style });
  for (const pid of rosterIds(base.t)) {
    const p = base.fake.players[pid], b = c.boost[pid];
    if (b) for (const k in b) if (p.attrs[k] != null) p.attrs[k] = Math.min(10, p.attrs[k] + b[k]);
    p.gear = Object.assign({}, p.pos === 'G' ? c.ggear : c.gear);
    for (const k of Object.keys(p.gear)) if (gearLocked(p.gear[k], k)) delete p.gear[k];        // an unlock you no longer have (import) falls back
  }
  autoArrange(base.fake, base.t); autoLeaders(base.fake, base.t);
  const all = rosterIds(base.t).map(i => base.fake.players[i]);
  base.rating = Math.round(qpRating(all)); base.tier = qpTierName(base.rating); base.club = true; base.ident.id = id;
  return base;
}
// the ladder's ten clubs, weakest first; every finished ladder makes the next one tougher
function clubLadderTeams() {
  const c = clubData(), L = c.ladder, teams = generateQuickTeams(L.seed, 'lad').slice().reverse();
  if (L.level > 0) {
    const rng = mulberry32(hashStr('lad-' + L.seed + '-' + L.level));
    for (const q of teams) { const all = rosterIds(q.t).map(i => q.fake.players[i]); qpCalibrate(all, Math.min(95, q.rating + L.level * 3), rng); autoArrange(q.fake, q.t); q.rating = Math.round(qpRating(all)); q.tier = qpTierName(q.rating); }
  }
  return teams;
}
function clubGrow(c, team) {
  const sk = rosterIds(team.t).map(i => team.fake.players[i]);
  if (team.rating >= CLUB_RATING_CAP) return [];
  const rng = Math.random, out = [], n = 1 + (rng() < 0.5 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const p = sk[Math.floor(rng() * sk.length)], ks = Object.keys(p.attrs).filter(k => p.attrs[k] < 10);
    if (!ks.length) continue;
    const k = ks.sort((a, b) => p.attrs[a] - p.attrs[b])[Math.floor(rng() * Math.min(3, ks.length))];
    (c.boost[p.id] = c.boost[p.id] || {})[k] = (c.boost[p.id][k] || 0) + 1;
    out.push({ num: p.num, last: p.last, k });
  }
  return out;
}
function clubLadderPlay() {
  const c = clubData(); if (!c) return go(scrClub);
  const opp = clubLadderTeams()[Math.min(CLUB_RUNGS - 1, c.ladder.rung)], me = clubTeam();
  const keep = { diff: S.diff, speed: S.speed }, restore = () => { S.diff = keep.diff; S.speed = keep.speed; };
  S.diff = UI.qpDiff || 'NORMAL'; S.speed = UI.qpDiff === 'HARD' || !SPEEDS[UI.qpSpeed] ? 'NORMAL' : UI.qpSpeed;
  const rung = c.ladder.rung + 1;
  launchMatch({ teams: [me.ident, opp.ident], home: 0, lineups: [qpLineup(me), qpLineup(opp)], tac: [me.tac, opp.tac], decider: 'shootout', kind: 'quick', canRestart: true,
    onEnd: res => {
      restore(); leaveMatch();
      const L = c.ladder, mv = { rung: L.rung, grew: [], rungUp: false, title: false };
      if (res.winner === 0) {
        L.w++; mv.grew = clubGrow(c, me); L.rung++; mv.rungUp = true;
        if (L.rung >= CLUB_RUNGS) { L.titles++; L.level++; L.rung = 0; L.seed = newQpSeed(); mv.title = true; qpFeat('ladder1'); }
        (c.log = c.log || []).unshift({ t: Date.now(), txt: 'Beat ' + fullName(opp.ident) + ' ' + res.score[0] + '-' + res.score[1] + ' (rung ' + rung + ')' });
      } else { L.l++; (c.log = c.log || []).unshift({ t: Date.now(), txt: 'Lost to ' + fullName(opp.ident) + ' ' + res.score[0] + '-' + res.score[1] + ' (rung ' + rung + ')' }); }
      c.log = c.log.slice(0, 12); mv.rung = L.rung + (mv.title ? CLUB_RUNGS : 0); mv.won = res.winner === 0; mv.oppName = fullName(opp.ident); PROFILE.dirty = true;
      if (res.winner === 0) qpCount('wins');
      go(() => scrPostgame({ title: 'MY CLUB · LADDER RUNG ' + rung, teams: [me.ident, opp.ident], res, mode: 'quick', club: mv, again: clubLadderPlay, done: () => go(scrClub), doneLabel: 'MY CLUB ▶' }));
    },
    onQuit: () => { restore(); go(scrClub); } });
}
function clubMovedPanel(mv) {
  if (!mv) return null;
  return h('div', { class: 'panel' }, h('div', { class: 'grouplab', style: { marginTop: 0 } }, 'MY CLUB · THE LADDER'),
    mv.title ? h('div', { class: 'gold', style: { fontSize: 'calc(10px * var(--ts, 1.2))', margin: '4px 0' } }, 'LADDER CHAMPIONS! A tougher ladder is waiting.') : null,
    h('div', { class: 'row', style: { gap: '3px', justifyContent: 'flex-start', margin: '4px 0' } }, Array.from({ length: CLUB_RUNGS }, (_, i) => h('span', { class: 'hkrung' + (i < (mv.title ? CLUB_RUNGS : mv.rung) ? ' on' : '') }))),
    h('div', { class: 'modetxt' }, mv.won ? (mv.title ? 'All ten clubs beaten.' : 'Beat ' + mv.oppName + '. Up to rung ' + (mv.rung + 1) + ' of ' + CLUB_RUNGS + '.') : 'Lost to ' + mv.oppName + '. The rung is still there.'),
    mv.grew && mv.grew.length ? h('div', { class: 'green', style: { fontSize: '7px', marginTop: '4px' } }, 'GROWTH: ' + mv.grew.map(g => '#' + g.num + ' ' + g.last + ' +1 ' + attrName(g.k).toUpperCase()).join(' · ')) : null);
}
// the MY CLUB screen
function scrClub() {
  const c = clubData();
  if (!c) return scrClubPick();
  const me = clubTeam(), L = c.ladder, opps = clubLadderTeams(), next = opps[Math.min(CLUB_RUNGS - 1, L.rung)];
  const ladder = () => h('div', { class: 'panel' },
    h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center', margin: 0 } }, h('div', { class: 'grouplab', style: { margin: 0 } }, 'THE LADDER' + (L.level ? ' · LEVEL ' + (L.level + 1) : '')),
      h('span', { class: 'muted' }, L.w + 'W ' + L.l + 'L' + (L.titles ? ' · ' + L.titles + ' TITLE' + (L.titles > 1 ? 'S' : '') : ''))),
    h('div', { class: 'hkladder' }, opps.map((q, i) => h('div', { class: 'hkstep' + (i < L.rung ? ' done' : i === L.rung ? ' next' : '') },
      h('span', { class: 'muted' }, String(i + 1)), badge(q.ident, 22), h('span', { style: { flex: 1, color: teamTextColor(q.ident) } }, q.ident.abbr), h('span', { class: 'muted' }, q.rating)))),
    h('div', { class: 'row', style: { gap: '10px', marginTop: '8px', alignItems: 'center' } },
      h('div', { style: { flex: 1 } }, h('div', { class: 'sub', style: { margin: 0 } }, 'NEXT: ', h('b', { style: { color: teamTextColor(next.ident) } }, fullName(next.ident).toUpperCase()), ' · ' + next.tier + ' ' + next.rating + ' · ' + next.identity.name),
        h('div', { class: 'modetxt' }, 'Each win: one or two of your players get +1 in a rating. Finish the ladder and a tougher one starts.')),
      h('label', { class: 'qp2dd' }, h('span', null, 'DIFFICULTY'), h('select', { onchange: e => { UI.qpDiff = e.target.value; } }, ['EASY', 'NORMAL', 'HARD'].map(v => h('option', { value: v, selected: v === (UI.qpDiff || 'NORMAL') }, v)))),
      h('button', { class: 'primary', onclick: clubLadderPlay }, 'PLAY RUNG ' + (L.rung + 1) + ' ▶')));
  const look = () => clubLookPanel(c);
  const roster = () => h('div', { class: 'panel' }, h('div', { class: 'grouplab', style: { marginTop: 0 } }, 'ROSTER · RATING ' + me.rating + ' · ' + me.tier),
    pages('clubros', rosterIds(me.t).map(i => me.fake.players[i]), 8, sl => h('table', null, h('tr', null, ...['#', 'PLAYER', 'POS', 'OVR', 'GROWTH'].map((x, i) => h('th', { class: i === 1 ? 'l' : '' }, x))),
      sl.map(p => { const b = c.boost[p.id] || {}, n = Object.values(b).reduce((a, v) => a + v, 0);
        return h('tr', null, h('td', null, p.num), h('td', { class: 'l' }, p.first + ' ' + p.last), h('td', null, posLabel(p)), h('td', { class: 'gold' }, ovrInt(p)), h('td', { class: n ? 'green' : 'muted' }, n ? '+' + n + ' (' + Object.entries(b).map(([k, v]) => attrName(k).slice(0, 3).toUpperCase() + (v > 1 ? '×' + v : '')).join(' ') + ')' : '-')); }))),
    (c.log || []).length ? h('div', { class: 'modetxt', style: { marginTop: '6px' } }, 'RECENT: ' + c.log.slice(0, 3).map(x => x.txt).join(' · ')) : null);
  return h('div', { class: 'screen wide clubS' }, header('MY CLUB', () => go(scrQuickPlay), 'BACK',
      h('div', { class: 'row', style: { gap: '8px', margin: 0, alignItems: 'center' } }, badge(me.ident, 28), h('b', { style: { color: teamTextColor(me.ident) } }, fullName(me.ident).toUpperCase()))),
    tabbed('club', [{ label: 'THE LADDER', el: ladder }, { label: 'LOOK & GEAR', el: look }, { label: 'ROSTER', el: roster },
      { label: 'SETTINGS', el: () => h('div', { class: 'panel' }, h('div', { class: 'sub' }, 'Starting over keeps your unlocks, medals and record. Your club, its growth and its ladder go.'),
        h('button', { class: 'danger', onclick: () => confirmDlg('Release ' + fullName(me.ident) + ' and pick a new club? Its growth and ladder are lost.', 'START OVER', () => { delete qpProg().club; PROFILE.dirty = true; go(scrClub); }, true) }, 'START A NEW CLUB')) }]));
}
function scrClubPick() {
  UI.clubSeed = UI.clubSeed || newQpSeed();
  const teams = generateQuickTeams(UI.clubSeed, 'club');
  const cards = teams.map((q, i) => h('div', { class: 'teamcard', onclick: () => { clubNew(UI.clubSeed, i); UI.clubSeed = null; toast('Welcome to ' + fullName(q.ident) + '!'); go(scrClub); } },
    badge(q.ident, 40), h('div', { style: { flex: 1 } }, h('div', { style: { color: teamTextColor(q.ident) } }, fullName(q.ident)),
      h('div', { class: 'muted', style: { fontSize: '7px', margin: '3px 0' } }, q.tier + ' ' + q.rating + ' · ' + q.identity.name), h('div', { class: 'modetxt' }, q.identity.blurb))));
  return h('div', { class: 'screen wide clubS' }, header('START YOUR CLUB', () => go(scrQuickPlay), 'BACK', h('button', { class: 'small', onclick: () => { UI.clubSeed = newQpSeed(); go(scrClubPick); } }, '↻ NEW CHOICES')),
    h('div', { class: 'sub', style: { margin: '0 0 6px' } }, 'Pick the club that is yours for good. A weak club has further to climb, and every ladder win makes your players better. You can rename it and dress it in your unlocks.'),
    pages('clubpick', cards, 6, sl => h('div', { class: 'grid g2' }, sl)));
}
// LOOK & GEAR: name, colours, crest, jersey, uniform, the skaters' and the goalies' gear (locked items say how to earn them)
function clubLookPanel(c) {
  const box = h('div', { class: 'panel hklook' });
  const draw = () => {
    box.innerHTML = '';
    const me = clubTeam(), save = () => { PROFILE.dirty = true; draw(); };
    const sel = (lab, val, opts, set) => h('label', { class: 'qp2dd hksel' }, h('span', null, lab),
      h('select', { onchange: e => { const o = opts.find(x => x[0] === e.target.value); if (o && o[2]) { toast(o[2]); e.target.value = val; return; } set(e.target.value); save(); } },
        opts.map(([v, t, lock]) => h('option', { value: v, selected: v === val }, lock ? '\u{1F512} ' + t : t))));
    const lockMsg = id => id && !hasCosmetic(id) ? 'LOCKED · ' + COSMETICS[id].name + '. ' + (cosRoutes(id)[0] || '') : null;
    const gearOpts = part => Object.entries(GEAR_OPTS[part]).filter(([v]) => !(part === 'mask' && typeof maskInfo === 'function' && maskInfo(v).price && !maskInfo(v).cos))
      .map(([v, t]) => [v, t.replace(' ★', ''), lockMsg(gearLockId(part, v) || (part === 'mask' && typeof maskLockId === 'function' ? maskLockId(v) : null))]);
    const name = h('input', { type: 'text', value: c.city, maxLength: 16, style: { width: '120px' } }), nick = h('input', { type: 'text', value: c.nick, maxLength: 16, style: { width: '120px' } }), abbr = h('input', { type: 'text', value: c.abbr, maxLength: 3, style: { width: '58px' } });
    const cvS = h('canvas', { width: 200, height: 150, class: 'hkprev' });
    const pal = h('div', { class: 'row', style: { gap: '3px', justifyContent: 'flex-start', margin: '2px 0', flexWrap: 'wrap' } },
      QP_PALETTES.map(p => h('button', { class: 'hkswatch' + (p[0] === c.colors.p && p[1] === c.colors.s ? ' sel' : ''), title: 'Use these colours', style: { background: `linear-gradient(90deg, ${p[0]} 50%, ${p[1]} 50%)`, borderColor: p[2] }, onclick: () => { c.colors = { p: p[0], s: p[1], a: p[2] }; save(); } })),
      h('button', { class: 'small ghost', onclick: () => { c.colors = { p: c.colors.s, s: c.colors.p, a: c.colors.a }; save(); } }, '⇄'));
    box.append(h('div', { class: 'hklookwrap' },
      h('div', null,
        h('div', { class: 'row', style: { gap: '6px', justifyContent: 'flex-start', margin: '0 0 4px' } }, name, nick, abbr,
          h('button', { class: 'small', onclick: () => { const C0 = name.value.trim(), N0 = nick.value.trim(), A0 = abbr.value.trim().toUpperCase().replace(/[^A-Z]/g, ''); if (!C0 || !N0 || A0.length < 2) return toast('City, nickname and a 2-3 letter abbreviation, please.'); c.city = C0; c.nick = N0; c.abbr = A0; save(); toast('Renamed.'); } }, 'RENAME')),
        pal,
        h('div', { class: 'hkgrid' },
          sel('CREST', c.emblem, Object.entries(EMBLEMS).map(([k, e]) => [k, e.name, lockMsg(e.cos)]), v => { c.emblem = v; }),
          sel('JERSEY', c.style, JERSEY_STYLES.map(s => [s.id, s.name, lockMsg(s.cos)]), v => { c.style = v; }),
          sel('TRIM', c.trim === 'gold' ? 'gold' : 'team', [['team', 'Team colours'], ['gold', 'Gold trim', lockMsg('gold_trim')]], v => { c.trim = v === 'gold' ? 'gold' : null; }),
          sel('FIT', c.uni.fit || 'standard', gearOpts('jersey'), v => { c.uni.fit = v; }),
          sel('HEADBAND', c.uni.helmet || 'team', gearOpts('helmet'), v => { c.uni.helmet = v; }),
          sel('GLOVES', c.uni.gloves || 'team', gearOpts('gloves'), v => { c.uni.gloves = v; }),
          sel('SOCKS', c.uni.socks || 'team', gearOpts('socks'), v => { c.uni.socks = v; }),
          ...['skates', 'stick', 'tape', 'visor'].map(k => sel(((typeof GEAR_NAMES !== 'undefined' && GEAR_NAMES[k]) || k).toUpperCase(), c.gear[k] || gearOf(null)[k], gearOpts(k), v => { c.gear[k] = v; })),
          ...['mask', 'gloves', 'pads'].map(k => sel('KEEPER ' + (k === 'mask' ? 'SHIRT' : ((typeof GEAR_NAMES !== 'undefined' && GEAR_NAMES[k]) || k).toUpperCase()), c.ggear[k] || gearOf(null)[k], gearOpts(k), v => { c.ggear[k] = v; })))),
      h('div', { style: { textAlign: 'center' } }, cvS, h('div', { class: 'modetxt' }, '\u{1F512} = locked: pick it to see how to earn it.'),
        h('button', { class: 'small ghost', onclick: () => go(() => scrLocker(scrClub)) }, 'THE LOCKER'))));
    setTimeout(() => {
      const sk = rosterIds(me.t).map(i => me.fake.players[i]), skater = sk.find(p => p.pos !== 'G'), gl = sk.find(p => p.pos === 'G');
      try { const C = teamPalette(me.ident, false), c2 = cvS.getContext('2d'); c2.setTransform(1, 0, 0, 1, 0, 0); c2.fillStyle = '#e9f1f8'; c2.fillRect(0, 0, cvS.width, cvS.height);
        drawFigureOn(cvS, C, [fakeSkater({ pl: skater, num: skater.num, g: false, fy: 1, px: 52, py: 118, hand: skater.hand || 'L' }), fakeSkater({ pl: gl, num: gl.num, g: true, fy: 1, px: 142, py: 118, hand: 'L' })], 2.6); } catch (e) {}
    }, 0);
  };
  draw();
  return box;
}

// ---------- 7. QUICK presentation for Quick Play: once you have played five games, the ceremony is trimmed by default
// (no walkout or outro, short goal celebrations, intermissions cut to a few seconds). PRESENTATION: FULL / QUICK.
const qpPresMode = () => (qpProg().pres || ((qpProg().n.games || 0) >= 5 ? 'QUICK' : 'FULL'));
const QP_QUICK = { walkout: false, outro: false, goal: 'SHORT', spot: false };
{ const _qs = qpStart;
  qpStart = function (teams, spectate) {
    if (qpPresMode() !== 'QUICK') return _qs.apply(this, arguments);
    const keep = Object.assign({}, S.pres); Object.assign(S.pres, QP_QUICK); S.qpQuick = true;
    const r = _qs.apply(this, arguments);
    const back = () => { S.pres = Object.assign(S.pres, keep); S.qpQuick = false; };
    if (S.match) { const end = S.match.onEnd, quit = S.match.onQuit; S.match.onEnd = res => { back(); end(res); }; S.match.onQuit = () => { back(); quit(); }; } else back();
    return r;
  }; }
{ const _it = interTick; interTick = function () { const r = _it.apply(this, arguments); if (S.qpQuick && S.inter && S.inter.t > 150) skipIntermission(); return r; }; }
{ const _qp = scrQuickPlay;
  scrQuickPlay = function () {
    const node = _qp.apply(this, arguments);
    const add = () => { const foot = node.querySelector('.qp2foot'); if (!foot || foot.querySelector('.hkpres')) return;
      const btn = h('button', { class: 'small ghost hkpres', title: 'QUICK: no walkout or outro, short goal celebrations, short half-time breaks',
        onclick: () => { qpProg().pres = qpPresMode() === 'QUICK' ? 'FULL' : 'QUICK'; PROFILE.dirty = true; btn.textContent = 'SHOW: ' + qpPresMode(); } }, 'SHOW: ' + qpPresMode());
      foot.insertBefore(btn, foot.lastChild); };
    try { add(); new MutationObserver(add).observe(node.querySelector('.qp2') || node, { childList: true, subtree: true }); } catch (e) {}
    return node;
  }; }
