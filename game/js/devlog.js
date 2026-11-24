'use strict';
// ====================================================================
//  DEVELOPER GAME LOG (off by default; switched on from Settings > Controls > Debug).
//  Records your own quick-play games so gameplay can be audited later: the setup, team totals per period, an event
//  list (shots with position and danger, goals, penalties, hits, offsides, icings, faceoffs, fights, goalie covers)
//  and FLAGS: press J mid-game when something looks wrong; the last 8 seconds of every player's position and state are
//  saved with a one-line note. Stored in this artifact's database (devlog/...), readable only by the owner; the last few
//  games are also kept in this browser for EXPORT. Menu demo games, CPU-vs-CPU games and franchise games are never logged.
// ====================================================================
const DEVLOG = { on: false, cur: null, ring: [], ready: null, flagKey: 'KeyJ', keep: 4 };
try { DEVLOG.on = localStorage.getItem('psph-devlog') === '1'; } catch (e) {}
function devlogSet(on) { DEVLOG.on = !!on; try { localStorage.setItem('psph-devlog', on ? '1' : '0'); } catch (e) {} }
function devlogDb() {
  if (!DEVLOG.ready) DEVLOG.ready = (async () => {
    try {
      if (!window.claude || !window.claude.use) return null;
      return await Promise.race([window.claude.use('db'), new Promise(r => setTimeout(() => r(null), 10000))]);
    } catch (e) { return null; }
  })();
  return DEVLOG.ready;
}
const dl1 = v => Math.round(v * 10) / 10;
const dlWho = p => p && p.pl ? { id: p.pl.id, team: p.team, num: p.num, name: p.pl.last, pos: p.g ? 'G' : p.pl.pos, you: p === ctrl && !S.autoAI } : null;
const dlClock = () => ({ per: S.period, clk: dl1(S.clock), t: S.t });
function dlEvent(kind, data) {
  const L = DEVLOG.cur; if (!L || S.demo) return;
  L.events.push(Object.assign({ k: kind }, dlClock(), data || {}));
}
function dlTotals() {
  if (!MS) return null;
  return [0, 1].map(t => Object.assign({}, MS.team[t], { goals: S.score[t], ppo: MS.team[t].ppo, ppg: MS.team[t].ppg }));
}
// ---------- start / finish
function devlogStart(cfg) {
  if (DEVLOG.cur) devlogFinish('restarted');
  if (!DEVLOG.on || S.autoAI || S.demo || !cfg || cfg.demo || cfg.kind !== 'quick') return;
  const id = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + ((Math.random() * 1e4) | 0);
  const roster = {};
  for (const p of players) if (p.pl) roster[p.pl.id] = { team: p.team, num: p.num, name: p.pl.first + ' ' + p.pl.last, pos: p.g ? 'G' : p.pl.pos,
    ovr: typeof overall === 'function' ? Math.round(overall(p.pl)) : null, attrs: p.pl.a || p.pl.attrs || null };
  const team = t => { const T = TEAM[t]; const lu = cfg.lineups && cfg.lineups[t]; const sk = lu && lu.lines ? lu.lines.flat().filter(Boolean) : [];
    const ov = sk.map(x => typeof overall === 'function' ? overall(x) : 0).filter(Boolean);
    return { name: T.name, abbr: T.abbr, avgOvr: ov.length ? Math.round(ov.reduce((a, b) => a + b, 0) / ov.length) : null, tac: cfg.tac ? cfg.tac[t] : null }; };
  DEVLOG.cur = { id, cfg, flags: 0, events: [], periods: [], poss: [0, 0, 0], zone: [0, 0, 0], lastFo: [0, 0], nShots: 0, saved: false,
    meta: { id, started: new Date().toISOString(), youAre: 0, home: cfg.home, teams: [team(0), team(1)], diff: S.diff, speed: S.speed, periodLen: S.periodLen,
      rules: S.rules, assist: S.assist, cam: S.cam, arena: cfg.arenaName || null, version: typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : null }, roster };
  DEVLOG.ring = [];
  const oe = cfg.onEnd, oq = cfg.onQuit;
  if (!cfg.__dl) {
    cfg.__dl = true;
    cfg.onEnd = function (res) { devlogFinish('final'); return oe && oe.apply(this, arguments); };
    cfg.onQuit = function () { devlogFinish('quit'); return oq && oq.apply(this, arguments); };
  }
}
function devlogFinish(how) {
  const L = DEVLOG.cur; if (!L) return;
  DEVLOG.cur = null;
  devlogWrite(L, how);
}
function devlogBuild(L, how) {
  // shots: outcome from the match stats (goal / on net), position and shooter captured when it was taken
  const shots = (MS && MS.shots ? MS.shots : []).map((s, i) => Object.assign({ i, team: s.team, pid: s.pid, xg: s.xg != null ? Math.round(s.xg * 1000) / 1000 : null, on: s.on, goal: s.goal, f: s.f }, L.shotPos[i] || {}));
  return { meta: Object.assign({}, L.meta, { ended: new Date().toISOString(), how, score: S.score.slice(), period: S.period, so: !!S.so }),
    roster: L.roster, totals: dlTotals(), periods: L.periods, possessionFrames: { team0: L.poss[0], team1: L.poss[1], loose: L.poss[2] },
    puckZoneFrames: { team0Attack: L.zone[0], team1Attack: L.zone[1], neutral: L.zone[2] }, shots, events: L.events, flags: L.flags };
}
async function devlogWrite(L, how) {
  if (!L.shotPos) L.shotPos = {};
  const rec = devlogBuild(L, how);
  const json = JSON.stringify(rec);
  // this browser: the last few games, for EXPORT
  try { const keep = JSON.parse(localStorage.getItem('psph-devlog-last') || '[]').filter(x => x.meta && x.meta.id !== L.id); keep.unshift(rec); while (keep.length > DEVLOG.keep) keep.pop();
    let s = JSON.stringify(keep); while (s.length > 3.5e6 && keep.length > 1) { keep.pop(); s = JSON.stringify(keep); } localStorage.setItem('psph-devlog-last', s); } catch (e) {}
  const db = await devlogDb(); if (!db) return;
  try {
    const CH = 200000, parts = Math.ceil(json.length / CH);
    for (let i = 0; i < parts; i++) await db.doc(`devlog/${L.id}/parts/${i}`).set({ i, data: json.slice(i * CH, (i + 1) * CH) });
    const m = rec.meta;
    await db.doc(`devlog/${L.id}`).set({ id: L.id, started: m.started, ended: m.ended, how, score: m.score.join('-'), you: m.teams[0].abbr, opp: m.teams[1].abbr,
      youOvr: m.teams[0].avgOvr, oppOvr: m.teams[1].avgOvr, diff: m.diff, flags: L.flags, parts });
  } catch (e) { console.warn('devlog write failed', e); }
}
// ---------- per-frame sampling (after each engine update)
function devlogTick() {
  if (S.match && !S.demo && MS && players.length) devlogRingTick();      // the 8-second recorder runs in every game, logged or not
  const L = DEVLOG.cur; if (!L || S.demo || !MS) return;
  if (S.phase === 'live') {
    const o = puck.owner; L.poss[o ? o.team : 2]++;
    const z = typeof zoneFor === 'function' ? zoneFor(0, puck.y) : 'neu';
    L.zone[z === 'att' ? 0 : z === 'def' ? 1 : 2]++;
  }
  // new shots: where from, who, how
  if (!L.shotPos) L.shotPos = {};
  const sh = MS.shots || [];
  while (L.nShots < sh.length) {
    const s = sh[L.nShots], p = players.find(q => q.pl && q.pl.id === s.pid), g = gk(1 - s.team);
    L.shotPos[L.nShots] = { per: S.period, clk: dl1(S.clock), x: p ? Math.round(p.x) : null, y: p ? Math.round(p.y) : null, by: dlWho(p),
      oneT: !!puck.oneTimer, speed: dl1(hyp(puck.vx, puck.vy)), gx: g ? Math.round(g.x) : null, gy: g ? Math.round(g.y) : null, pp: typeof shortHanded === 'function' ? (shortHanded(1 - s.team) ? 'PP' : shortHanded(s.team) ? 'SH' : 'EV') : null };
    L.nShots++;
  }
  // faceoffs won
  for (const t of [0, 1]) if ((MS.team[t].fo || 0) > L.lastFo[t]) { L.lastFo[t] = MS.team[t].fo; dlEvent('faceoffWon', { team: t }); }
}
// goalie decisions (every shot he judged with its save chance, every poke-check gamble), the last 12, kept with the report
function dlGk(e) {
  if (DEVLOG.gkMatch !== S.match) { DEVLOG.gkMatch = S.match; DEVLOG.gk = []; }
  DEVLOG.gk.push(Object.assign({ t: S.t, per: S.period, clk: dl1(S.clock) }, e));
  if (DEVLOG.gk.length > 12) DEVLOG.gk.shift();
}
// faceoffs this game: your timing (ms from the puck reaching the ice; + late, - early), the CPU's, the win chance
function dlFo(e) {
  if (DEVLOG.foMatch !== S.match) { DEVLOG.foMatch = S.match; DEVLOG.fo = []; }
  DEVLOG.fo.push(Object.assign({ t: S.t, per: S.period, clk: dl1(S.clock) }, e));
}
function devlogRingTick() {
  if (DEVLOG.ringMatch !== S.match) { DEVLOG.ringMatch = S.match; DEVLOG.ring = []; DEVLOG.lastGoal = null; DEVLOG.ringPh = null; }
  // a goal: keep the 8 seconds that led to it, so a report made after the celebration and faceoff still has the play
  if (S.phase === 'goal' && DEVLOG.ringPh !== 'goal') DEVLOG.lastGoal = { t: S.t, per: S.period, clk: dl1(S.clock), score: S.score.slice(), frames: DEVLOG.ring.slice(), gk: (DEVLOG.gk || []).slice() };
  DEVLOG.ringPh = S.phase;
  // the flight recorder: 10 samples a second of live play (1 a second while play is stopped), the last 80 samples
  if (/^(goal|faceoff|whistle)$/.test(S.phase) ? S.t % 60 === 0 : S.t % 6 === 0) {
    DEVLOG.ring.push({ t: S.t, per: S.period, clk: dl1(S.clock), ph: S.phase, score: S.score.slice(), owner: puck.owner && puck.owner.pl ? puck.owner.pl.id : null,
      puck: [Math.round(puck.x), Math.round(puck.y), dl1(puck.vx), dl1(puck.vy)],
      pl: players.filter(p => p.on !== false && p.pl).map(p => ({ id: p.pl.id, tm: p.team, n: p.num, g: p.g ? 1 : 0, you: p === ctrl && !S.autoAI ? 1 : 0,
        x: Math.round(p.x), y: Math.round(p.y), vx: dl1(p.vx), vy: dl1(p.vy), fx: dl1(p.fx), fy: dl1(p.fy),
        st: [p.stun > 0 ? 'stun' : '', p.lunge > 0 ? 'lunge' : '', p.bigHit ? 'big' : '', p.sprint ? 'sprint' : '', p.bwd ? 'back' : '', p.aiPivot ? 'pivot' : '',
          p.charge >= 0 ? 'charge' : '', p.dkTarget ? 'deke' : '', p.windUp ? 'windup:' + p.windUp.kind : '', p.fetch ? 'fetch' : '', p.down > 0 ? 'down' : ''].filter(Boolean).join(' ') })) });
    if (DEVLOG.ring.length > 80) DEVLOG.ring.shift();
  }
}
// ---------- flags (B): freeze, ask for a one-line note, save the last 8 seconds
function devlogFlag() {
  if (S.screen !== 'play' || !S.match) return;
  // not a logged game (logging off, another mode, CPU vs CPU): the report still saves, under its own id
  const L = DEVLOG.cur || (DEVLOG.adhoc && DEVLOG.adhoc.match === S.match ? DEVLOG.adhoc : (DEVLOG.adhoc = { match: S.match, id: 'report-' + new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14), flags: 0,
    roster: Object.fromEntries(players.filter(p => p.pl).map(p => [p.pl.id, { team: p.team, num: p.num, name: p.pl.first + ' ' + p.pl.last, pos: p.g ? 'G' : p.pl.pos }])) }));
  const n = ++L.flags;
  // (Nov 21) what the rules saw: the last events (penalties, offsides, icings, line changes...) and who is in the box,
  // plus every player's state, so a report can be answered exactly
  const RSx = typeof RS === 'function' ? RS() : null;
  const rules = RSx ? { events: (RSx.events || []).slice(-14), box: Object.keys(RSx.box || {}), pens: [0, 1].map(t => (RSx.pens[t] || []).map(q => ({ num: q.num, name: q.name, kind: q.kind, left: Math.round(q.left) }))), pulled: (RSx.pulled || []).slice() } : null;
  const flag = { n, per: S.period, clk: dl1(S.clock), t: S.t, score: S.score.slice(), totals: dlTotals(), roster: L.roster, frames: DEVLOG.ring.slice(), rules, gk: DEVLOG.gkMatch === S.match ? (DEVLOG.gk || []).slice() : [], lastGoal: DEVLOG.lastGoal || null, faceoffs: DEVLOG.foMatch === S.match ? (DEVLOG.fo || []).slice() : [], note: '' };
  S.screen = 'paused';
  const box = h('div', { class: 'modal', style: { zIndex: 60 } }, h('div', { class: 'panel', style: { maxWidth: '520px' } },
    h('h3', { style: { marginTop: 0 } }, `FLAG #${n} SAVED`),
    h('div', { class: 'sub' }, 'The last 8 seconds are recorded. Add a note (optional), then ENTER to save and resume, ESC to resume without one.'),
    h('input', { type: 'text', maxlength: 300, placeholder: 'e.g. that goal should have been saved', style: { width: '100%', marginTop: '8px' } })));
  const inp = box.querySelector('input');
  const done = save => {
    if (save) flag.note = inp.value.trim();
    box.remove(); S.screen = 'play'; if (typeof cvs !== 'undefined') cvs.focus();
    if (L === DEVLOG.cur) dlEvent('flag', { n, note: flag.note });
    flag.mode = S.match ? (S.match.kind || (S.match.season ? 'season' : '')) + (S.autoAI ? ' (cpu vs cpu)' : '') : '';
    devlogSaveFlag(L, flag);
  };
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') done(true); else if (e.key === 'Escape') done(false); });
  document.body.appendChild(box); setTimeout(() => inp.focus(), 0);
}
async function devlogSaveFlag(L, flag) {
  try { const all = JSON.parse(localStorage.getItem('psph-devlog-flags') || '[]'); all.unshift(Object.assign({ game: L.id }, flag)); while (all.length > 12) all.pop(); localStorage.setItem('psph-devlog-flags', JSON.stringify(all)); } catch (e) {}
  const db = await devlogDb(); if (!db) return;
  try { await db.doc(`devlog/${L.id}/flags/${flag.n}`).set({ n: flag.n, note: flag.note, per: flag.per, clk: flag.clk, data: JSON.stringify(flag) }); }
  catch (e) { console.warn('devlog flag write failed', e); }
}
addEventListener('keydown', e => {
  if (e.code !== DEVLOG.flagKey || e.repeat || !S.match || S.screen !== 'play') return;
  if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  e.preventDefault(); devlogFlag();
});
// ---------- the REPORT button: always on screen during a logged game, right beside the period clock (same as the key)
const DL_BTN = { el: null };
function devlogBtnTick() {
  let el = DL_BTN.el;
  const inGame = !!(S.match && !S.demo && !S.match.demo && ['play', 'paused', 'timeout', 'intermission', 'replay', 'celebrate', 'intro'].includes(S.screen));   // every game mode (until asked otherwise)
  if (!inGame) { if (el) el.style.display = 'none'; return; }
  if (!el) {
    el = DL_BTN.el = document.createElement('button');
    el.id = 'dlReport'; el.textContent = '\u2691'; el.title = 'Report something odd (or press J): saves the last 8 seconds';
    el.addEventListener('click', e => { e.preventDefault(); e.stopPropagation();
      if (S.screen === 'play') devlogFlag(); else if (typeof toast === 'function') toast('Report during play: it saves the last 8 seconds of action'); });
    el.addEventListener('mousedown', e => e.preventDefault());               // don't steal keyboard focus from the game
    (document.getElementById('wrap') || document.body).appendChild(el);
  }
  const c = document.getElementById('c'); if (!c) return;
  const r = c.getBoundingClientRect(), k = r.width / 640;
  el.style.display = 'block';
  const cw = c.width || 640; el.style.left = Math.round(r.left + (cw / 2 + 46) * (r.width / cw)) + 'px';   // just right of the period clock (drawn centred on the canvas)
  el.style.top = Math.round(r.top + 7 * k) + 'px';
  el.style.width = el.style.height = Math.max(18, Math.round(24 * k)) + 'px';
  el.style.fontSize = Math.max(11, Math.round(15 * k)) + 'px';
}
setInterval(devlogBtnTick, 200);
// ---------- export (fallback when the database isn't reachable)
async function devlogExport() {
  let games = [], flags = [];
  try { games = JSON.parse(localStorage.getItem('psph-devlog-last') || '[]'); flags = JSON.parse(localStorage.getItem('psph-devlog-flags') || '[]'); } catch (e) {}
  if (!games.length && !flags.length) { toast('No logged games yet'); return; }
  const data = JSON.stringify({ exported: new Date().toISOString(), games, flags });
  const filename = 'pixelsoccer-gamelog-' + new Date().toISOString().slice(0, 10) + '.json';
  try {
    if (window.claude && window.claude.use) {
      const d = await Promise.race([window.claude.use('downloads'), new Promise(r => setTimeout(() => r(null), 4000))]);
      if (d) { await d.save({ filename, data }); return; }
    }
  } catch (e) { if (e && e.code === 'declined') return; }
  try { await navigator.clipboard.writeText(data); toast('Game log copied to the clipboard'); } catch (e) { toast('Export unavailable here'); }
}
// ---------- hooks into the engine (wrapping, so the game code itself stays untouched)
(function devlogHooks() {
  const wrap = (name, after) => {
    const f = window[name]; if (typeof f !== 'function') return;
    window[name] = function () { const before = DEVLOG.cur ? after.pre && after.pre.apply(this, arguments) : null; const r = f.apply(this, arguments);
      if (DEVLOG.cur || after.always) try { after.post.call(this, arguments, before, r); } catch (e) { console.warn('devlog', e); } return r; };
  };
  wrap('startMatch', { always: true, post: a => devlogStart(a[0]) });
  wrap('update', { always: true, post: () => devlogTick() });   // always: the report recorder runs in every game
  wrap('scoreGoal', { pre: () => ({ shot: MS && MS.shots ? MS.shots.length - 1 : -1 }), post: (a, b) => {
    const lg = MS && MS.lastGoal;
    dlEvent('goal', { team: a[0], scorer: lg ? lg.scorer : null, assists: lg ? lg.assists : [], shotIndex: b.shot, score: S.score.slice(), state: typeof shortHanded === 'function' ? (shortHanded(1 - a[0]) ? 'PP' : shortHanded(a[0]) ? 'SH' : 'EV') : null }); } });
  wrap('callFoul', { post: a => dlEvent('foul', { kind: a[0], by: dlWho(a[1]), on: dlWho(a[2]), x: a[1] ? Math.round(a[1].x) : null, y: a[1] ? Math.round(a[1].y) : null }) });
  wrap('callOffside', { post: a => dlEvent('offside', { team: a[0], puck: [Math.round(puck.x), Math.round(puck.y)] }) });
  wrap('callIcing', { post: a => dlEvent('icing', { team: a[0] }) });
  wrap('statHit', { post: a => { const p = a[0]; dlEvent('hit', { by: dlWho(p), on: dlWho(p.checkTarget), big: !!p.bigHit, x: Math.round(p.x), y: Math.round(p.y) }); } });
  wrap('onBigHit', { post: a => dlEvent('bigHit', { by: dlWho(a[0]), on: dlWho(a[1]), behind: !!a[2], foul: !!a[3] }) });
  wrap('startFight', { post: a => dlEvent('fight', { a: dlWho(a[0]), b: dlWho(a[1]) }) });
  wrap('coverPuck', { post: a => dlEvent('cover', { goalie: dlWho(a[0]) }) });
  wrap('endPeriod', { pre: () => ({ per: S.period }), post: (a, b) => {
    const L = DEVLOG.cur; if (!L) return; L.periods.push({ period: b.per, score: S.score.slice(), totals: dlTotals() });
    devlogWrite(Object.assign({}, L, { events: L.events.slice() }), 'partial');      // so nothing is lost if the tab closes mid-game
  } });
})();
