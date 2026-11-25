'use strict';
// ====================================================================
//  RULES: one authoritative state for manpower, penalties, availability and fights (MS.rs)
//  - Timed penalties (BAL.pen.len game seconds). Each team's penalties are served one after another:
//    only the head of a team's queue runs, so a second penalty extends the advantage.
//  - A team on the power play dresses a 4th skater (3 + 1). Both teams penalised: 4-on-4.
//  - A power-play goal cancels exactly one penalty (the running one). Penalty shots never touch the queue.
//  - Pulled goalie: 4th skater, empty net. Never while holding a man advantage; the goalie returns
//    automatically when his team goes on the power play. No team ever has more than four skaters.
//  - Availability: penalty box, temporary injuries (game seconds), injuries for the rest of the game, fight ejections.
//    Six available skaters are always kept: an injury that would break that becomes a stun instead.
// ====================================================================
const RS = () => MS && MS.rs;
const MAX_SKATERS = 4, BASE_SKATERS = 3;
function rulesInit() {
  if (!MS) return;
  MS.rs = { pens: [[], []], pulled: [false, false], extra: [null, null], out: {}, box: {}, el: 0,
    fights: { n: [0, 0], last: -999, brutal: null, log: [] }, morale: [[], []],
    ts: [0, 1].map(() => ({ ppo: 0, ppg: 0, pk: 0, pkga: 0, pim: 0, fights: 0, eng: 0 })), injuries: [], pick: null, effT: 0, aiT: 0, events: [] };
}
const fmtPen = s => Math.floor(Math.max(0, s) / 60) + ':' + String(Math.ceil(Math.max(0, s)) % 60).padStart(2, '0');
const plName = pl => pl ? (pl.first ? pl.first[0] + '. ' : '') + pl.last : '';
const plTagPl = pl => pl ? '#' + pl.num + ' ' + (pl.last || '').toUpperCase() : '';
function rsLog(text) { const r = RS(); if (r) { r.events.push({ t: Math.round(S.periodLen - S.clock), p: S.period, text }); if (r.events.length > 60) r.events.shift(); } }

// ---------- availability
function outInfo(id) { const r = RS(); if (!r || !id) return null; const o = r.out[id]; return o && (o.game || o.until > r.el) ? o : null; }
const isOutPid = id => !!outInfo(id) || !!(RS() && RS().box[id]);
let _dsT = [-1, -1], _dsLu = [null, null], _dsRes = [null, null];
function dressedSkaters(t) {
  const lu = S.match && S.match.lineups && S.match.lineups[t]; if (!lu) return [];
  if (S.phase !== 'live') { _dsLu = [null, null]; return dressedSkatersNow(lu); }   // (lines can be edited between whistles)
  if (_dsLu[t] === lu) return _dsRes[t];                                       // live play: the dressed list can't change
  _dsLu[t] = lu; _dsRes[t] = dressedSkatersNow(lu);
  return _dsRes[t];
}
function dressedSkatersNow(lu) {
  const seen = new Set(), out = [];
  for (const pl of lu.lines.flat().concat(lu.bench || [])) if (pl && !seen.has(pl.id)) { seen.add(pl.id); out.push(pl); }
  return out;
}
// healthy & not ejected (a player in the penalty box still counts: he is coming back)
const availSkaters = t => dressedSkaters(t).filter(pl => !outInfo(pl.id));
const onIceIds = (t, exceptObj) => new Set(teamSkaters(t).filter(p => p !== exceptObj && p.pl).map(p => p.pl.id));
function subFor(t, role, used) {
  const sp = SPOS[role] || 'C';
  const cand = dressedSkaters(t).filter(pl => !isOutPid(pl.id) && !used.has(pl.id) && !(typeof dazedPid === 'function' && dazedPid(pl.id)));
  const lu = S.match.lineups[t], benchIds = new Set((lu.bench || []).map(p => p.id));
  cand.sort((a, b) => ((benchIds.has(b.id) ? 30 : 0) + (sideOf(b.spos) === sideOf(sp) ? 12 : 0) + (MS.stam[b.id] ?? 100) * 0.5) - ((benchIds.has(a.id) ? 30 : 0) + (sideOf(a.spos) === sideOf(sp) ? 12 : 0) + (MS.stam[a.id] ?? 100) * 0.5));
  return cand[0] || null;
}
// the three players a line sends out, with substitutes for anyone boxed, injured or ejected
function lineFor(t, idx) {
  const lu = S.match.lineups[t], base = lu.lines[idx] || [], used = new Set(), out = [null, null, null];
  base.forEach((pl, j) => { if (pl && !isOutPid(pl.id) && !(typeof dazedPid === 'function' && dazedPid(pl.id))) { out[j] = pl; used.add(pl.id); } });   // (a WOBBLED man sits until he's recovered)
  const x = extraObj(t); if (x && x.on && x.pl) used.add(x.pl.id);
  for (let j = 0; j < 3; j++) if (!out[j]) { const s = subFor(t, j, used); if (s) { out[j] = s; used.add(s.id); } }
  return out;
}
// put a player into an on-ice slot (number, letter, effective ratings follow)
function seat(p, pl) {
  const lu = S.match && S.match.lineups ? S.match.lineups[p.team] : null;
  if (typeof dazeSwap === 'function') dazeSwap(p, pl);
  p.pl = pl; p.num = pl ? pl.num : p.num; p.cap = pl && lu && lu.leaders ? lu.leaders[pl.id] || null : null; p.eff = null;
}
// anybody on the ice who may not be there (boxed, injured, ejected) is replaced; nobody appears twice
function refillIce(t) {
  if (!MS || !S.match || !S.match.lineups) return;
  const used = new Set();
  for (const p of teamSkaters(t)) {
    if (p.pl && !isOutPid(p.pl.id) && !used.has(p.pl.id)) { used.add(p.pl.id); continue; }
    const s = subFor(t, p.role, used);
    if (s) { seat(p, s); used.add(s.id); }
  }
  const g = goalieObj(t), lu = S.match.lineups[t];
  if (g && (!g.pl || outInfo(g.pl.id))) { const b = [lu.goalie].concat(lu.backups || []).find(x => x && !outInfo(x.id)); if (b) seat(g, b); }
}

// ---------- manpower
const runningPen = t => RS() ? RS().pens[t][0] || null : null;
// everything the man in the box still has to serve (the running penalty plus any time added to it)
const penTimeLeft = t => { const q = RS() ? RS().pens[t] : []; return q.reduce((a, h) => a + (h.perm ? 0 : Math.max(0, h.left)), 0); };
const hasAdvantage = t => !!runningPen(1 - t) && !runningPen(t);
const shortHanded = t => !!runningPen(t) && !runningPen(1 - t);
function extraReason(t) {
  const r = RS(); if (!r) return null;
  if (hasAdvantage(t)) return 'pp';
  if (runningPen(0) && runningPen(1)) return 'even4';
  if (r.pulled[t]) return 'pull';
  return null;
}
const strengthLabel = () => { const n = [0, 1].map(t => teamSkaters(t).length); return n[0] + '-ON-' + n[1]; };
function extraCandidates(t) {
  const on = onIceIds(t, extraObj(t));
  const score = pl => (pl.attrs.acc + pl.attrs.pow + pl.attrs.pas + pl.attrs.stk) / 4 + (pl.spos === 'C' ? 0.3 : 0) + ((MS.stam[pl.id] ?? 100) - 60) * 0.03;
  return dressedSkaters(t).filter(pl => !isOutPid(pl.id) && !on.has(pl.id)).map(pl => ({ pl, score: score(pl) })).sort((a, b) => b.score - a.score);
}
function benchSpot(t) { const hm = S.match ? S.match.home ?? 0 : 0; return { x: R.l + 14, y: CY + (t === hm ? -30 : 30) }; }   // both benches are on the left boards; the doors face centre ice
function applyManpower(live) {
  const r = RS(); if (!r || S.so || !S.match || !S.match.lineups) return;
  for (const t of [0, 1]) {
    if (r.pulled[t] && hasAdvantage(t)) { r.pulled[t] = false; floatMsg(t, 'KEEPER BACK IN'); rsLog(TEAM[t].abbr + ' keeper returns for the man advantage'); }
    const g = goalieObj(t), gOn = !r.pulled[t];
    if (g.on !== gOn) {
      g.on = gOn;
      if (gOn) { resetPlayerState(g); goalieHome(g); g.mx = g.x; g.my = g.y; if (!g.pl) seat(g, S.match.lineups[t].goalie); }
      else { if (ctrl === g) ctrl = null; if (puck.owner === g) { puck.owner = null; } }
    }
    const x = extraObj(t), want = !!extraReason(t);
    if (want && !x.on) {
      const on = onIceIds(t, x);
      let pl = r.extra[t] && !isOutPid(r.extra[t].id) && !on.has(r.extra[t].id) ? r.extra[t] : null;
      if (!pl) { const c = extraCandidates(t)[0]; pl = c ? c.pl : null; }
      if (!pl) { if (r.pulled[t]) { r.pulled[t] = false; g.on = true; resetPlayerState(g); goalieHome(g); } continue; }   // nobody left to send
      r.extra[t] = pl; seat(x, pl); x.on = true; resetPlayerState(x);
      const b = benchSpot(t); x.x = b.x; x.y = b.y; x.mx = x.x; x.my = x.y;
    } else if (!want && x.on) removeExtra(t, live);
  }
  rebuildActive();
  if (!ctrl || !ctrl.on) ctrl = skaters.find(p => p.team === 0 && p.role === 1) || skaters.find(p => p.team === 0) || null;
  refreshEff();
}
// a skater leaves the ice: live, it's whoever is furthest from the play (never the puck carrier or your skater)
function removeExtra(t, live) {
  const x = extraObj(t); let leave = x;
  if (live) { const c = teamSkaters(t).filter(p => p !== puck.owner && (p !== ctrl || S.autoAI)).sort((a, b) => dist(b, puck) - dist(a, puck)); if (c.length) leave = c[0]; }
  if (leave !== x) { const role = leave.role; leave.role = 3; x.role = role; }
  if (puck.owner === leave) puck.owner = null;
  // during play he SKATES to the bench (drawn), instead of vanishing where he stood
  if (live && leave.pl && !S.fastSim && typeof PBS === 'function' && PBS()) { const P = PBS(); (P.leaving = P.leaving || []).push({ t, pl: leave.pl, fx: leave.x, fy: leave.y, t0: S.t, dur: Math.round(clamp(hyp(R.l + 10 - leave.x, CY - leave.y) / 1.7, 30, 200)) }); }
  leave.on = false; leave.eff = null;
}
// a stoppage: lines, manpower and the 4th-skater choice
function rulesFaceoff() {
  if (!MS || !RS() || S.so || !S.match || !S.match.lineups) return;
  applyManpower(false);
  for (const t of [0, 1]) refillIce(t);
  const r = RS(), x0 = extraObj(0);
  r.pick = null;
  if (x0.on && extraReason(0) && !S.autoAI && S.pres && S.pres.extraPick !== false) {
    const c = extraCandidates(0).slice(0, 4);
    if (c.length > 1) r.pick = { why: extraReason(0), cands: [{ pl: x0.pl, score: 99 }].concat(c.filter(o => o.pl !== x0.pl)).slice(0, 4), until: S.t + 60 * 12 };
  }
  rebuildActive(); refreshEff();
  if (typeof updateExtraPick === 'function') updateExtraPick();
  if (typeof grudgeFaceoffFight === 'function') grudgeFaceoffFight();
  aiTimeoutCheck();
  // now and then an enforcer stirs things up at a faceoff
  if (!S.pendingFight && S.period < 4 && Math.random() < BAL.fight.aiFaceoff) {
    const t = S.autoAI && Math.random() < 0.5 ? 0 : 1;
    const ch = teamSkaters(t).find(p => p.pl && (hasTrait(p.pl, 'enforcer') || hasTrait(p.pl, 'hotheaded')));
    if (ch && !fightBlocked(t)) { const target = teamSkaters(1 - t).filter(p => p.pl).sort((a, b) => fightPower(b.pl) - fightPower(a.pl))[0]; if (target) S.pendingFight = { ch, target }; }
  }
}
// a small hit can still hurt (rarely)
function onSmallHit(hitter, victim) {
  if (!RS() || S.so || S.phase !== 'live') return;
  addGrudge(victim, hitter, 0.12);
  // simmering: a small hit on someone already boiling can start it right here
  const gv = grudgeOf(victim, hitter), vt = victim.team;
  if (gv > GRUDGE.hot && hitter.team !== vt && cpuT(vt) && Math.random() < 0.18 * gv && !fightBlocked(vt)) { liveChallenge(victim, hitter); return; }
  if (maybeInjure(victim, 'hit', 0.12)) injuryStop(victim);
}
function chooseExtra(t, pl) {
  const r = RS(), x = extraObj(t); if (!r || !x.on || !pl || isOutPid(pl.id)) return false;
  for (const p of teamSkaters(t)) if (p !== x && p.pl === pl) seat(p, x.pl);     // he was on the line: swap places
  r.extra[t] = pl; seat(x, pl); refreshEff();
  return true;
}
// on a line change the extra skater stays unless his line just came on (then he swaps with the best spare man)
function fixExtra(t) {
  const r = RS(), x = extraObj(t); if (!r || !x.on) return;
  const on = onIceIds(t, x);
  if (!x.pl || on.has(x.pl.id) || isOutPid(x.pl.id) || (MS.stam[x.pl.id] ?? 100) < 25) {
    const c = extraCandidates(t)[0]; if (c) { r.extra[t] = c.pl; seat(x, c.pl); }
  }
}

// ---------- penalties
function zoneOf(team, y) {          // relative to that team: its own (defensive) zone, neutral, or attacking
  const own = isUp(team) ? y > BLUE_BOT : y < BLUE_TOP, att = isUp(team) ? y < BLUE_TOP : y > BLUE_BOT;
  return own ? 'def' : att ? 'off' : 'neu';
}
const FOUL_NAME = { trip: 'TRIPPING', behind: 'TACKLE FROM BEHIND', interf: 'FOUL ON THE KEEPER', offpuck: 'OBSTRUCTION' };
const FOUL_POP = { trip: 'TRIPPED!', behind: 'FROM BEHIND!', interf: 'FOUL ON THE KEEPER!', offpuck: 'OBSTRUCTION!' };
function callFoul(kind, off, vic) {
  if (!S.rules || S.phase !== 'live' || S.so || !off || !vic || off.team === vic.team) return false;
  const zone = zoneOf(off.team, (off.y + vic.y) / 2);
  if (MS && off.pl) pst(off.pl, off.team).pen++;
  if (typeof addGrudge === 'function') addGrudge(vic, off, 0.3);
  floaters.push({ x: vic.x, y: vic.y - 44, text: FOUL_POP[kind] || 'PENALTY!', life: 60, color: '#ff7a6e' });
  rsLog(`${FOUL_NAME[kind]} - ${plTagPl(off.pl)} (${TEAM[off.team].abbr}, ${zone === 'def' ? 'defensive' : zone === 'neu' ? 'neutral' : 'offensive'} zone)`);
  if (typeof clipEvent === 'function') clipEvent('pen', { text: 'PENALTY: ' + FOUL_NAME[kind] + ' - ' + plTagPl(off.pl), team: off.team, players: [off.pl && off.pl.id, vic.pl && vic.pl.id].filter(Boolean), pen: true, focus: POOL.indexOf(vic) }, 12);
  // a PENALTY SHOT only for taking away a clear scoring chance: the victim had the puck in our end, heading for the net
  // with nobody but the offender (and the goalie) between him and it, and was fouled from behind. Anything else is a minor
  const gyD = ownGoalY(off.team), vd = hyp(vic.x - CX, vic.y - gyD);
  const fromBehind = ((off.x - vic.x) * (CX - vic.x) + (off.y - vic.y) * (gyD - vic.y)) < 0;
  const nobodyBack = teamSkaters(off.team).every(o => o === off || hyp(o.x - CX, o.y - gyD) > vd - 4);
  const clearChance = kind !== 'offpuck' && zone === 'def' && vd < RK(170) && fromBehind && nobodyBack;
  const inBox = Math.abs(vic.x - CX) < PEN_HW && (vic.y - gyD) * attackDir(off.team) >= -2 && Math.abs(vic.y - gyD) < PEN_D;   // SOCCER: a foul in the box
  if (inBox || (clearChance && Math.abs(vic.y - gyD) < PEN_D + 30)) {              // denied a clear scoring chance: penalty shot (the queue is untouched)
    addedStop(1);
    const card = giveCard(off, kind, kind === 'behind' && clearChance && Math.random() < BAL.card.straightRed);   // (a penalty is usually punishment enough: a yellow)
    say([`${FOUL_NAME[kind]}! THAT'S A PENALTY KICK!`, `THE REF POINTS TO THE SPOT. PENALTY KICK FOR THE ${TEAM[vic.team].nick.toUpperCase()}!`], 3);
    whistle('PENALTY KICK', FOUL_NAME[kind] + ' - ' + plTagPl(off.pl) + (card ? ' · ' + CARD_NAME[card] : ''), () => { if (card === 'red' || card === 'second') sendOff(off.team); setupPenaltyShot(vic.team, vic); }, 140);
    return true;
  }
  const t = off.team, pl = off.pl, fx = clamp(vic.x, TL_L + 10, TL_R - 10), fy = clamp(vic.y, GL_TOP + 12, GL_BOT - 12);   // SOCCER: a free kick where the foul was
  // SOCCER CARDS (no sin bin): a yellow is a warning; a second yellow, or a straight red for a reckless tackle from
  // behind, sends him off for the rest of the match. A substitute comes straight on, so it stays 3-on-3, but the bench
  // is one man shorter (and a red-carded star is gone for the night)
  const straight = kind === 'behind' && Math.random() < BAL.card.straightRed;
  if (advantageCheck(kind, off, vic, fx, fy, straight)) return true;   // PLAY ON (see ADVANTAGE below)
  addedStop(ADDED.stopW);
  const card = giveCard(off, kind, straight);
  if (card === 'red') say([`${FOUL_NAME[kind]}! STRAIGHT RED! ${plTagPl(pl)} IS SENT OFF!`, `OH, THAT'S RECKLESS. RED CARD, AND ${plTagPl(pl)} IS OFF.`], 3);
  else if (card === 'second') say([`THAT'S HIS SECOND YELLOW! ${plTagPl(pl)} IS SENT OFF!`, `SECOND BOOKING, SO IT'S RED. ${plTagPl(pl)} TAKES THE LONG WALK.`], 3);
  else say([`${FOUL_NAME[kind]}. YELLOW CARD FOR ${plTagPl(pl)}.`, `INTO THE BOOK GOES ${plTagPl(pl)}. ONE MORE AND HE'S OFF.`, `FREE KICK, AND A YELLOW FOR ${plTagPl(pl)}.`], 3);
  whistle(CARD_NAME[card], FOUL_NAME[kind] + ' - ' + plTagPl(pl), () => { if (card !== 'yellow') sendOff(t); S.kickNext = 1 - t; setupFaceoff(fx, fy); }, card === 'yellow' ? 110 : 150);
  return true;
}
const CARD_NAME = { yellow: 'YELLOW CARD', second: 'SECOND YELLOW: RED CARD', red: 'RED CARD' };
// book him: returns 'yellow', 'second' (his second yellow) or 'red'
function giveCard(off, kind, straight) {
  const r = RS(), pl = off && off.pl, t = off ? off.team : 0; if (!r || !pl) return null;
  r.cards = r.cards || {};
  const c = r.cards[pl.id] = r.cards[pl.id] || { y: 0, r: false };
  let res = straight ? 'red' : (++c.y >= 2 ? 'second' : 'yellow');
  const st = pst(pl, t); st.pim += BAL.pen.len; r.ts[t].pim += BAL.pen.len;   // (PIM is kept in the old units: one card = one old minor, so cards = pim / BAL.pen.len)
  if (res === 'yellow') st.yel = (st.yel || 0) + 1; else { c.r = true; st.reds = (st.reds || 0) + 1; r.out[pl.id] = { game: true, why: 'red' }; }
  S.lastPenT = S.t; S.lastPenTeam = t;
  S.cardShow = { team: t, kind: res, num: pl.num, name: plTagPl(pl), x: off.x, y: off.y, t0: S.t };
  floaters.push({ x: off.x, y: off.y - 50, text: res === 'yellow' ? 'YELLOW CARD' : 'RED CARD', life: 90, color: res === 'yellow' ? '#ffd23f' : '#ff4b3e' });
  rsLog(`${TEAM[t].abbr} #${pl.num} ${plName(pl)} - ${res === 'yellow' ? 'yellow card' : res === 'second' ? 'second yellow, sent off' : 'straight red, sent off'} (${kind})`);
  return res;
}
// after a red: his slot on the pitch goes to the next man off the bench (nobody left: they play a man short)
function sendOff(t) {
  if (!MS || !S.match || !S.match.lineups) return;
  refillIce(t);
  for (const p of teamSkaters(t)) if (p.pl && isOutPid(p.pl.id)) { p.on = false; if (ctrl === p) ctrl = null; if (puck.owner === p) puck.owner = null; }
  rebuildActive();
  if (!ctrl || !ctrl.on) ctrl = skaters.find(p => p.team === 0 && p.on !== false) || null;
  refreshEff();
  floatMsg(t, 'SUBSTITUTE ON');
}
function startTimed(t, pl, kind) {
  S.lastPenT = S.t; S.lastPenTeam = t;                                     // (the coaches react)
  const r = RS(); if (!r || !pl) return;
  const wasHead = !r.pens[t].length, head = r.pens[t][0];
  // ONE MAN IN THE BOX per team: a further penalty adds its time to the man already serving (the offender stays
  // available; his penalty minutes still go on his own record)
  if (head && !head.perm) {
    r.pens[t].push({ pid: head.pid, num: head.num, name: head.name, kind, left: BAL.pen.len, by: pl.id, byNum: pl.num });
    rsLog(`${TEAM[t].abbr} #${pl.num} ${plName(pl)} - ${kind} - time added to #${head.num} ${head.name} in the box`);
  } else {
    r.pens[t].push({ pid: pl.id, num: pl.num, name: plName(pl), kind, left: BAL.pen.len });
    r.box[pl.id] = true;
    if (typeof pbEnter === 'function') pbEnter(t, pl);
  }
  pst(pl, t).pim += BAL.pen.len; r.ts[t].pim += BAL.pen.len;
  if (wasHead) penStarted(t);
  if (pl.trait_hot) {}   // (traits act through the trip chance)
}
// a team's penalty started running: an opportunity for the other side if it's a real advantage
function penStarted(t) {
  const r = RS();
  if (!runningPen(1 - t)) { r.ts[1 - t].ppo++; r.ts[t].pk++; S.ppBanner = { team: 1 - t, life: 150 }; }
}
function penEnd(t, why) {
  const r = RS(); if (r.pens[t][0] && r.pens[t][0].perm) return;     // a challenge's penalty never ends
  const h = r.pens[t].shift(); if (!h) return;
  const stays = r.pens[t].length && r.pens[t][0].pid === h.pid;          // more time to serve: he stays in the box
  rsLog(`${TEAM[t].abbr} penalty to #${h.num} ${h.name} ${why === 'goal' ? 'wiped out by a power-play goal' : 'expired'}${stays ? ' (more time to serve)' : ''}`);
  if (!stays) {
    delete r.box[h.pid];
    if (why !== 'goal') floatMsg(t, 'PENALTY OVER');
    if (typeof pbRelease === 'function') pbRelease(t, h.pid, why);
  } else if (why === 'goal' && typeof pbSlump === 'function') pbSlump(t);
  if (r.pens[t].length) penStarted(t);
}
function rulesTick(dtc) {
  const r = RS(); if (!r) return;
  r.el += dtc;
  let changed = false;
  for (const t of [0, 1]) { const h = r.pens[t][0]; if (h) { h.left -= dtc; if (h.left <= 0) { penEnd(t, 'time'); changed = true; } } }
  r.morale = r.morale.map(a => a.filter(m => m.until > r.el));
  // temporary injuries end: the player is back for his next shift
  if (changed) applyManpower(true);
  if (++r.effT >= 45) { r.effT = 0; refreshEff(); }
  streakLive(dtc);
  advTick();
  if (++r.aiT >= 30) { r.aiT = 0; for (const t of [0, 1]) if (t === 1 || S.autoAI) aiPullDecision(t); }
}
// the scoring side of a goal: power-play / shorthanded / empty-net bookkeeping
function rulesGoal(team, penShot) {
  const r = RS(); if (!r || S.so) return;
  const lg = MS.lastGoal || {}, sc = lg.scorer ? MS.p[lg.scorer] : null, opp = 1 - team;
  if (!goalies[opp] && !penShot) {
    r.ts[team].eng++; if (sc) sc.eng = (sc.eng || 0) + 1;
    const g = goalieObj(opp); if (g && g.pl) pst(g.pl, opp).ena = (pst(g.pl, opp).ena || 0) + 1;
    lg.en = true;
  }
  if (penShot) return;
  if (hasAdvantage(team)) {
    r.ts[team].ppg++; r.ts[opp].pkga++;
    if (sc) sc.ppg = (sc.ppg || 0) + 1;
    for (const a of lg.assists || []) if (MS.p[a]) MS.p[a].ppa = (MS.p[a].ppa || 0) + 1;
    lg.pp = true; penEnd(opp, 'goal');
  } else if (shortHanded(team)) { if (sc) sc.shg = (sc.shg || 0) + 1; lg.sh = true; }
}
// tripping: a missed poke that takes the legs out of a fast puck carrier
function tripCheck(p, mul = 1) {
  const o = puck.owner;
  if (!S.rules || S.phase !== 'live' || S.so || !o || o.g || o.team === p.team || !MS) return false;
  if (dist(p, o) > 17) return false;                          // the stick has to actually reach his skates
  const spd = hyp(o.vx, o.vy) / Math.max(0.5, baseSpeed(o));
  if (spd < 0.7) return false;                                 // a carrier going slowly just stops or steps over it
  const behind = (p.x - o.x) * o.vx + (p.y - o.y) * o.vy < 0;
  const chance = BAL.pen.trip * (1.45 - A(p, 'def') * 0.09) * (behind ? 1.6 : 0.8) * traitMul(p.pl, 'penMul') * (cpuT(p.team) ? DIFF[S.diff].tripMul || 1 : 1) * mul;
  if (Math.random() >= chance) return false;
  o.down = 46; o.stun = Math.max(o.stun, 48); o.stunType = 'trip'; o.fall = 0; o.fallSide = Math.random() < 0.5 ? -1 : 1;
  releasePuck(o, o.vx * 0.6, o.vy * 0.6, 30);
  return callFoul('trip', p, o);
}

// ---------- goalie pulling
function canPull(t) {
  return false;   // SOCCER: the keeper is never pulled for an extra attacker
  const r = RS();
  if (!r || S.so || !S.match || !S.match.lineups || r.pulled[t]) return false;
  if (S.phase === 'penalty' || S.phase === 'fight' || S.phase === 'goal') return false;
  if (hasAdvantage(t)) return false;                                   // holding a man advantage: no
  if (teamSkaters(t).length >= MAX_SKATERS) return false;              // already four skaters
  const g = goalieObj(t); if (puck.owner === g) return false;
  return extraCandidates(t).length > 0;
}
function pullGoalie(t, on) {
  const r = RS(); if (!r) return false;
  if (on && !canPull(t)) return false;
  if (!on && !r.pulled[t]) return false;
  r.pulled[t] = on;
  applyManpower(S.phase === 'live');
  floatMsg(t, on ? 'KEEPER PULLED' : 'KEEPER BACK IN');
  if (on) say([`THE ${TEAM[t].nick.toUpperCase()} PULL THEIR KEEPER FOR AN EXTRA ATTACKER!`, 'EMPTY NET! THEY\'RE GOING FOR IT!'], 2);
  rsLog(`${TEAM[t].abbr} keeper ${on ? 'pulled' : 'returns'} (${strengthLabel()})`);
  return true;
}
function aiPullDecision(t) {
  return;   // SOCCER: no empty-net extra attacker
  const r = RS(); if (!r || S.so || S.phase !== 'live') return;
  const diff = S.score[t] - S.score[1 - t];
  if (r.pulled[t]) { if (diff >= 0 || S.period !== 3) pullGoalie(t, false); return; }
  if (S.period !== BAL.pull.minPeriod) return;
  const late = (diff === -1 && S.clock < BAL.pull.downOne) || (diff === -2 && S.clock < BAL.pull.downTwo);
  if (!late) return;
  const ownGoalZone = isUp(t) ? puck.y > BLUE_BOT : puck.y < BLUE_TOP;
  if (ownGoalZone && !(puck.owner && puck.owner.team === t)) return;     // not with the puck in his own end
  pullGoalie(t, true);
}
function floatMsg(t, text) { floaters.push({ x: CX, y: isUp(t) ? GL_BOT - 70 : GL_TOP + 70, text, life: 80, color: '#ffd23f' }); }

// ---------- effective ratings for everyone on the ice (traits, leadership aura, condition, morale, linemates, opponents)
function refreshEff() {
  if (!S.match || !S.match.lineups) { for (const p of POOL) p.eff = null; return; }
  const r = RS();
  for (const t of [0, 1]) {
    const lu = S.match.lineups[t], on = teamSkaters(t).filter(p => p.pl), opp = teamSkaters(1 - t).filter(p => p.pl);
    const onIds = new Set(on.map(p => p.pl.id)), diff = S.score[t] - S.score[1 - t];
    const gA = POOL.find(p => p.g && p.team === t && p.pl);                 // the goalie in net (a letter on him counts too)
    const aura = typeof activeAura === 'function' ? activeAura(lu.lead, onIds, gA ? gA.pl.id : null) : null;
    const auraPl = aura ? on.map(p => p.pl).find(pl => pl.id === aura.pid) || (gA && gA.pl.id === aura.pid ? gA.pl : null) : null;
    const state = { clutch: S.period >= 3 && Math.abs(diff) <= 1, trailing: diff < 0, bigGame: !!(S.match.tourney || S.match.bigGame), late: S.period >= 3 };
    const onM = typeof iceMods === 'function' ? iceMods(on.map(p => p.pl), 'onIce') : {}, oppM = typeof iceMods === 'function' ? iceMods(opp.map(p => p.pl), 'oppIce') : {};
    const morale = r ? r.morale[t].reduce((a, m) => a + m.v, 0) : 0;
    const st = aura && LEAD_STYLES[aura.style] ? LEAD_STYLES[aura.style].aura : {};
    for (const p of players.filter(q => q.team === t && q.pl)) {
      if (typeof effAttrs !== 'function' || !p.pl.attrs) { p.eff = null; continue; }
      p.eff = effAttrs(p.pl, { role: p.g || p.role > 2 ? null : p.role, lead: lu.lead, aura, auraPl, state, onIce: p.g ? null : onM, opp: p.g ? null : oppM, morale, form: (S.match.form ? (p.g ? S.match.form[t].g : S.match.form[t].sk) : 0) + (!p.g && typeof stratEdge === 'function' ? stratEdge(t) : 0) });
      p.effPl = p.pl;
      p.recover = aura && aura.pid !== p.pl.id && st.recover ? st.recover * aura.mul : 0;
    }
  }
}

// ---------- hot and cold streaks starting during a game (visible: an icon over the player and a call from the booth)
const STREAK_CALLS = {
  hot: { shoot: ['#N NAME IS HEATING UP!', '#N NAME CAN\'T MISS RIGHT NOW!'], pass: ['#N NAME IS SEEING EVERYTHING OUT THERE!', 'EVERY PASS FROM #N NAME IS ON A PLATE!'],
    speed: ['#N NAME HAS AN EXTRA GEAR TONIGHT!'], def: ['#N NAME IS SHUTTING EVERYTHING DOWN!', 'NOTHING GETS PAST #N NAME TONIGHT!'], phys: ['#N NAME IS RUNNING OVER EVERYBODY!'],
    goalie: ['NAME IS SEEING THE BALL LIKE A BEACH BALL!', 'NAME IS IN THE ZONE TONIGHT!'] },
  cold: { shoot: ['#N NAME CAN\'T BUY A GOAL RIGHT NOW.', '#N NAME IS GRIPPING HIS BOOT TOO TIGHT.'], pass: ['#N NAME\'S PASSES AREN\'T CONNECTING TONIGHT.'],
    speed: ['#N NAME LOOKS A STEP SLOW TONIGHT.'], def: ['#N NAME IS A STEP BEHIND TONIGHT.'], phys: ['#N NAME ISN\'T WINNING THE BATTLES TONIGHT.'],
    goalie: ['NAME IS SCUFFLING THE BALL TONIGHT.', 'NAME LOOKS SHAKY OUT THERE.'] },
};
function streakAllowed() { return !!(S.match && MS && !S.so && !S.mode && !S.match.demo); }
function streakCall(p, kind, type) {
  const pl = p.pl, lines = (STREAK_CALLS[kind] || {})[type] || ['#N NAME'];
  say(lines.map(l => l.replace('#N', '#' + p.num).replace('NAME', (pl.last || '').toUpperCase())), 2, 0.8);
  floaters.push({ x: p.x, y: p.y - 40, text: kind === 'hot' ? 'ON FIRE!' : 'PITCH COLD', life: 70, color: kind === 'hot' ? '#ffb03a' : '#9fd0ff' });
}
function streakOn(p, kind) {
  if (!streakAllowed() || !p || !p.pl || !startStreak(p.pl, kind)) return false;
  if (p.g && kind === 'cold') (MS.gColdAt = MS.gColdAt || [null, null])[p.team] = MS.gaTot ? MS.gaTot[p.team] : 0;   // (for pulling him: the next one in counts)
  refreshEff(); streakCall(p, kind, p.pl.streak.type); rsLog(`#${p.num} ${plName(p.pl)} ${kind === 'hot' ? 'got hot' : 'went cold'} (${STREAK_TYPES[p.pl.streak.type].name.toLowerCase()})`);
  return true;
}
// ---------- HEAT (Nov 21): a player BUILDS toward a hot streak in 5 visible stages (the same flame, growing; stage 5 is
// the hot streak itself, the only one that changes his ratings). Heat comes from what his type of player does well
// (a scorer's goals and shots, a playmaker's passes and assists, a defender's stops, a banger's hits, a goalie's saves)
// and drains away when he goes quiet. COLD has two stages: COOLING (a warning) and COLD (the streak); giveaways and
// goals against build it. A cold or cooling player who SCORES thaws on the spot.
const HEAT = { decay: 0.6, chillDecay: 0.35, stage: [20, 40, 60, 80], hot: 100, cool: 55, cold: 100, thawShare: 0.6,
  w: { shoot: { goal: 50, assist: 16, sog: 10, pass: 1, hit: 3, def: 5 }, pass: { goal: 40, assist: 30, sog: 6, pass: 3, hit: 3, def: 6 },
       speed: { goal: 44, assist: 22, sog: 8, pass: 2, hit: 3, def: 8 }, def: { goal: 40, assist: 20, sog: 5, pass: 2, hit: 7, def: 17 },
       phys: { goal: 40, assist: 18, sog: 5, pass: 1, hit: 15, def: 10 }, goalie: { save: 12 } },
  chill: { gv: 30, onGA: 15, gGA: 42 }, gaHeat: 45 };
const heatOf = id => (MS && MS.heat && MS.heat[id]) || 0, chillOf = id => (MS && MS.chill && MS.chill[id]) || 0;
function heatEv(p, kind) {
  if (!streakAllowed() || !p || !p.pl) return;
  MS.heat = MS.heat || {}; MS.chill = MS.chill || {};
  const pl = p.pl, id = pl.id, ty = streakType(pl), w = (HEAT.w[ty] || HEAT.w.shoot)[kind] || 0;
  if (w > 0) {
    MS.heat[id] = Math.min(HEAT.hot, heatOf(id) + w);
    MS.chill[id] = Math.max(0, chillOf(id) - w * HEAT.thawShare);
    if (MS.heat[id] >= HEAT.hot && !(pl.streak && pl.streak.k === 'hot')) {
      if (pl.streak && pl.streak.k === 'cold') { delete pl.streak; refreshEff(); }
      streakOn(p, 'hot');
    }
  }
}
function chillEv(p, kind) {
  if (!streakAllowed() || !p || !p.pl) return;
  MS.heat = MS.heat || {}; MS.chill = MS.chill || {};
  const pl = p.pl, id = pl.id, c = HEAT.chill[kind] || 0;
  if (kind === 'gGA') MS.heat[id] = Math.max(0, heatOf(id) - HEAT.gaHeat);
  if (pl.streak && pl.streak.k === 'hot') return;                     // a hot man doesn't cool off inside one night
  MS.chill[id] = Math.min(HEAT.cold, chillOf(id) + c);
  if (MS.chill[id] >= HEAT.cold && !pl.streak) streakOn(p, 'cold');
}
// a goal by a cold (or cooling) player: thawed out
function thaw(p) {
  if (!p || !p.pl || !MS) return;
  const pl = p.pl, was = (pl.streak && pl.streak.k === 'cold') || chillOf(pl.id) >= HEAT.cool;
  if (MS.chill) MS.chill[pl.id] = 0;
  if (pl.streak && pl.streak.k === 'cold') { delete pl.streak; refreshEff(); }
  if (was) { floaters.push({ x: p.x, y: p.y - 46, text: 'THAWED OUT!', life: 70, color: '#7fd3ff' }); rsLog(`#${p.num} ${plName(pl)} scored his way out of the cold`); }
}
function streakLive(dtc) {
  if (!streakAllowed() || !MS.heat) return;
  for (const id in MS.heat) MS.heat[id] = Math.max(0, MS.heat[id] - HEAT.decay * dtc);
  for (const id in (MS.chill || {})) MS.chill[id] = Math.max(0, MS.chill[id] - HEAT.chillDecay * dtc);
}
// the stage shown over a player: { k: 'hot', s: 1..5 } or { k: 'cold', s: 1 (cooling) | 2 (cold) }
function heatStage(p) {
  const pl = p.pl; if (!pl) return null;
  if (pl.streak) return pl.streak.k === 'hot' ? { k: 'hot', s: 5 } : { k: 'cold', s: 2 };
  if (p.g && S.match && S.match.formShown && S.match.formShown[p.team]) return S.match.formShown[p.team] === 'hot' ? { k: 'hot', s: 5 } : { k: 'cold', s: 2 };
  const ht = heatOf(pl.id), ch = chillOf(pl.id);
  if (ch >= HEAT.cool && ch >= ht) return { k: 'cold', s: 1 };
  let st = 0; for (const t of HEAT.stage) if (ht >= t) st++;
  return st ? { k: 'hot', s: st } : null;
}
// a goal: maybe the scorer gets hot; the beaten goalie's run is over (three against him: maybe he goes cold)
function streakGoal(team, scorerPl) {
  if (!streakAllowed()) return;
  const sc = scorerPl ? players.find(p => p.pl === scorerPl) : null;
  if (sc) { thaw(sc); heatEv(sc, 'goal'); }
  const g = goalies[1 - team]; MS.gRun = MS.gRun || [0, 0]; MS.gConc = MS.gConc || [0, 0];
  MS.gRun[1 - team] = 0; MS.gConc[1 - team]++;
  if (!MS.gaP || MS.gaP.per !== S.period) MS.gaP = { per: S.period, n: [0, 0] }; MS.gaP.n[1 - team]++;
  (MS.gaTot = MS.gaTot || [0, 0])[1 - team]++;
  if (g && g.pl) chillEv(g, 'gGA');
  for (const p of skaters) if (p.team !== team && p.pl) chillEv(p, 'onGA');
  formReveal(1 - team);
}
function streakSave(g) {
  if (!streakAllowed() || !g || !g.pl) return;
  MS.gRun = MS.gRun || [0, 0]; MS.gConc = MS.gConc || [0, 0]; MS.gRun[g.team]++;
  heatEv(g, 'save');
  // a cold goalie who stops the next few in a row shakes it off before the night is over
  if (MS.gRun[g.team] >= STREAK.shakeOff) {
    const coldStreak = g.pl.streak && g.pl.streak.k === 'cold', coldForm = S.match.formShown && S.match.formShown[g.team] === 'cold';
    if (coldStreak || coldForm) {
      if (coldStreak) delete g.pl.streak;
      if (MS.chill) MS.chill[g.pl.id] = 0;
      if (coldForm) { S.match.formShown[g.team] = null; S.match.form[g.team].g = Math.max(0, S.match.form[g.team].g); }
      refreshEff();
      say([`${(g.pl.last || '').toUpperCase()} HAS SETTLED IN NOW.`, `${(g.pl.last || '').toUpperCase()} SHAKES OFF THE SHAKY START!`], 2, 0.8);
      floaters.push({ x: g.x, y: g.y - 36, text: 'SETTLED IN', life: 60, color: '#5ee07a' });
      MS.gConc[g.team] = 0;
    }
  }
  formReveal(g.team);
}
// the goalie's game-day form shows once the game has seen enough of him (5 saves in a row on a hot night, 2 goals on a bad one)
function formReveal(t) {
  const f = S.match.form && S.match.form[t]; if (!f) return;
  MS.gRun = MS.gRun || [0, 0]; MS.gConc = MS.gConc || [0, 0];
  S.match.formShown = S.match.formShown || [null, null]; if (S.match.formShown[t]) return;
  const g = goalies[t]; if (!g || !g.pl || g.pl.streak) return;
  if (f.g >= FORM.gShow && MS.gRun[t] >= 5) { S.match.formShown[t] = 'hot'; streakCall(g, 'hot', 'goalie'); }
  else if (f.g <= -FORM.gShow && MS.gConc[t] >= 2) { S.match.formShown[t] = 'cold'; streakCall(g, 'cold', 'goalie'); (MS.gColdAt = MS.gColdAt || [null, null])[t] = MS.gaTot ? MS.gaTot[t] : 0; }
}
function streakIconOf(p) {
  if (!p || !p.pl || p.walkHide || S.walk || p.on === false) return null;   // only once he's out on the ice (not in the tunnel or during the walkout)
  return heatStage(p);
}

// ---------- injuries during the game
const INJ_KINDS = ['upper body', 'lower body', 'shoulder', 'knee', 'wrist', 'ankle'];
function maybeInjure(obj, cause, scale = 1) {
  const r = RS(); if (!r || !obj || !obj.pl || obj.g || S.so) return false;
  const pl = obj.pl, t = obj.team;
  const base = cause === 'fight' ? BAL.inj.fight : BAL.inj.bigHit;
  const mul = condBand(pl.cond)[3] * traitMul(pl, 'injMul');
  if (Math.random() >= base * mul * scale) return false;
  if (availSkaters(t).length - 1 < BAL.minSkaters) {                     // six-skater floor: shaken up instead
    obj.stun = Math.max(obj.stun, 150); obj.stunType = 'big'; MS.stam[pl.id] = Math.max(0, (MS.stam[pl.id] ?? 100) - 30);
    floaters.push({ x: obj.x, y: obj.y - 40, text: 'SHAKEN UP', life: 70, color: '#ffb3a8' });
    return false;
  }
  const u = Math.random(), kind = INJ_KINDS[(Math.random() * INJ_KINDS.length) | 0];
  let o;
  if (u < BAL.inj.pMinor) o = { until: r.el + rand(BAL.inj.minor[0], BAL.inj.minor[1]), sev: 'minor', kind };
  else if (u < BAL.inj.pMinor + BAL.inj.pModerate) o = { until: r.el + rand(BAL.inj.moderate[0], BAL.inj.moderate[1]), sev: 'moderate', kind };
  else {
    o = { game: true, sev: 'serious', kind };
    if (Math.random() < BAL.inj.carry) r.injuries.push({ pid: pl.id, games: ri(BAL.inj.carryGames[0], BAL.inj.carryGames[1]), kind });
  }
  const prev = r.out[pl.id];
  r.out[pl.id] = prev && prev.game ? Object.assign(prev, { sev: o.sev, kind }) : o;
  pst(pl, t).inj = (pst(pl, t).inj || 0) + 1;
  rsLog(`${plTagPl(pl)} (${TEAM[t].abbr}) injured - ${kind}, ${o.sev}`);
  S.injNote = { text: `${plTagPl(pl)} INJURED (${kind.toUpperCase()})`, sub: o.sev === 'serious' ? 'OUT FOR THE GAME' : o.sev === 'moderate' ? 'OUT ' + Math.round(o.until - r.el) + 's' : 'BACK SHORTLY', life: 200, team: t };
  return true;
}
// a big hit just landed: injuries, brutal-hit bookkeeping (fight prompts)
function onBigHit(hitter, victim, behind, foul) {
  const r = RS(); if (!r || S.so || S.phase !== 'live') return;
  const injured = maybeInjure(victim, 'hit');
  r.fights.brutal = { hitter, victim, t: S.t, team: hitter.team };   // any big hit can be answered
  // the AI answers a big hit on one of its own (more likely after a dirty or injuring one)
  const vt = victim.team, aiSide = hitter.team !== vt && (vt === 1 || S.autoAI);
  addGrudge(victim, hitter, behind || injured ? 0.5 : 0.35);
  const answer = aiSide && aiWantsChallenge(vt, hitter, behind || injured ? 1.6 : 1, victim);
  const ch = answer ? aiChallenger(vt, hitter) : null;
  if (foul) { if (ch) S.pendingFight = { ch, target: hitter }; return; }   // the penalty call stops play; settle it before the faceoff
  // a clean hit never stops play by itself: the man who was laid out gets up, a challenge is put while the puck
  // stays live, and an injury waits for his own team to get the puck (or for a serious one)
  if (injured) injuryStop(victim);
  if (ch) liveChallenge(ch, hitter);
}
// an injury on a clean play: the referee lets it go until the hurt player's team has the puck (a serious one
// gets an immediate whistle), then stops it for the trainer
function injuryStop(victim) {
  const r = RS(), o = r && victim.pl ? r.out[victim.pl.id] : null;
  S.injWait = { team: victim.team, t: S.t, text: plTagPl(victim.pl) + ' IS HURT ON THE PLAY' };
  addedStop(1);
  if (o && o.sev === 'serious') injuryWhistle();
}
function injuryWhistle() {
  const w = S.injWait; if (!w) return; S.injWait = null;
  const at = { x: puck.x, y: puck.y };
  whistle('INJURY', w.text, () => { const d = nearestDot(at.x, at.y); setupFaceoff(d.x, d.y); }, 110);
}
function injuryTick() {
  const w = S.injWait; if (!w || S.phase !== 'live') return;
  const o = puck.owner;
  if ((o && o.team === w.team) || S.t - w.t > 60 * 8) injuryWhistle();   // his team has it (or it has gone on far too long)
}
function nearestDot(x, y) {
  const ys = [END_DOT_Y[0], NEU_DOT_Y[0], CY, NEU_DOT_Y[1], END_DOT_Y[1]];
  const fy = ys.reduce((b, v) => Math.abs(v - y) < Math.abs(b - y) ? v : b, CY);
  return { x: fy === CY ? CX : CX + (x < CX ? -DOT_DX : DOT_DX), y: fy };   // (Nov 22: was ±70, from before the rink grew: draws were 10 units off the painted dot)
}

// ---------- 4th-skater chooser (your power plays, 4-on-4s and pulled goalies). The game picks the best man and play goes on;
// the chooser stays up during the faceoff so you can switch, and the 4th-skater key HOLDS the drop while you decide
function extraPickVisible() { const r = RS(); return !!(r && r.pick && S.screen === 'play' && S.phase === 'faceoff'); }
let xpSig = '';
function updateExtraPick() {
  let el = $('extraPick');
  if (!el) { el = document.createElement('div'); el.id = 'extraPick'; document.body.appendChild(el); }
  const r = RS();
  if (!extraPickVisible()) { el.classList.remove('show'); xpSig = ''; return; }
  if (!r.pick.held && S.t > r.pick.until) { r.pick = null; el.classList.remove('show'); return; }
  const x = extraObj(0), cur = x.pl;
  const sig = JSON.stringify([cur && cur.id, r.pick.cands.map(c => c.pl.id), !!r.pick.held]);
  el.classList.add('show');
  if (sig === xpSig) return; xpSig = sig;
  const why = { pp: 'MAN ADVANTAGE', even4: '4-ON-4', pull: 'EXTRA ATTACKER' }[r.pick.why] || '';
  const keys = ['line1', 'line2', 'line3', 'pick4'];
  el.innerHTML = `<div class="lphead">${why}: CHOOSE YOUR 4TH PLAYER</div>` + r.pick.cands.map((c, i) => {
    const pl = c.pl, st = Math.round(MS.stam[pl.id] ?? 100), tr = (pl.traits || []).map(id => TRAITS[id] ? TRAITS[id].icon : '').join('');
    return `<button class="lprow${cur === pl ? ' on' : ''}" data-i="${i}"><b>${Input.first(keys[i])}</b> #${pl.num} ${pl.last.toUpperCase()} ${pl.spos ? posShort(pl.spos) : ''} · OVR ${typeof ovrInt === 'function' ? ovrInt(pl) : ''} · ${st}% ${tr}${i === 0 ? ' <span class="gold">★ RECOMMENDED</span>' : ''}</button>`;
  }).join('') + `<div class="lphint">${r.pick.held ? '<span class="gold">PLAY HELD</span> · pick a player or ' + Input.first('extra') + ' to drop the ball' : 'Auto-picked (highlighted) · ' + Input.first('extra') + ' = hold play to choose'}</div>`;
  el.querySelectorAll('button[data-i]').forEach(b => b.onclick = e => { e.stopPropagation(); pickExtraIdx(+b.dataset.i); cvs.focus(); });
}
function pickExtraIdx(i) {
  const r = RS(); if (!r || !r.pick) return false;
  const c = r.pick.cands[i]; if (!c) return false;
  chooseExtra(0, c.pl); r.pick = null; updateExtraPick();
  floaters.push({ x: CX, y: CY + 40, text: plTagPl(c.pl) + ' JOINS', life: 50, color: '#ffd23f' });
  return true;
}
function extraPickKey(acts, c) {
  if (!extraPickVisible()) return false;
  const keys = ['line1', 'line2', 'line3', 'pick4'];
  for (let i = 0; i < 4; i++) if (acts.includes(keys[i])) { pickExtraIdx(i); return true; }
  if (acts.includes('extra')) { const r = RS(); if (r.pick.held) { r.pick = null; } else { r.pick.held = true; } updateExtraPick(); return true; }   // hold / let it go
  return false;
}

// ---------- HUD: penalty clocks, strength, empty nets, injuries
// (Nov 22 text pass) how tall the manpower box under the scoreboard is this frame (0 = not shown), so the carrier strip
// can sit under it instead of on top of it
function rulesHudH() {
  const r = RS(); if (!r || S.so || (S.mode && (S.mode.kind === 'drill' || S.mode.kind === 'practice'))) return 0;
  if ((S.screen !== 'play' && S.screen !== 'paused') || (!teamSkaters(0).length && !teamSkaters(1).length)) return 0;
  let n = 0; for (const t of [0, 1]) { if (r.pens[t].length) n++; if (r.pulled[t]) n++; }
  if (!n && teamSkaters(0).length === BASE_SKATERS && teamSkaters(1).length === BASE_SKATERS) return 0;
  return 14 + n * 10;
}
function drawRulesHud() {
  const r = RS(); if (!r || S.so) return;
  if ((S.screen !== 'play' && S.screen !== 'paused') || (!teamSkaters(0).length && !teamSkaters(1).length)) return;   // (Nov 23) it said '0 ON 0' over the three stars
  const SW = viewW();
  const items = [];
  for (const t of [0, 1]) {
    const q = r.pens[t];
    if (q.length) items.push({ t, text: `${TEAM[t].abbr} #${q[0].num} ${q[0].perm ? 'ALL GAME' : fmtPen(penTimeLeft(t))}` });
    if (r.pulled[t]) items.push({ t, text: `${TEAM[t].abbr} EMPTY NET` });
  }
  const n0 = teamSkaters(0).length, n1 = teamSkaters(1).length;
  if (!items.length && n0 === BASE_SKATERS && n1 === BASE_SKATERS) return;
  const adv = hasAdvantage(0) ? 0 : hasAdvantage(1) ? 1 : -1;
  // bigger and plainer than before: YOU are on the power play / killing a penalty, with the count and the time
  const label = adv === 0 ? `MAN ADVANTAGE · ${n0} ON ${n1}` : adv === 1 ? `MAN DOWN · ${n0} ON ${n1}` : n0 + ' ON ' + n1;
  let x = SW / 2, y = HUDH + 2;
  const w = Math.max(label.length * 8, ...items.map(i => i.text.length * 6.5)) + 16, h = 14 + items.length * 10;
  ctx.fillStyle = 'rgba(11,14,30,.86)'; ctx.fillRect(x - w / 2, y, w, h);
  ctx.fillStyle = adv >= 0 ? TEAM[adv].main : '#ffd23f'; ctx.fillRect(x - w / 2, y, w, 1.5);
  text(label, x, y + 3, adv === 0 ? '#ffd23f' : adv === 1 ? '#ff8a7a' : '#ffffff', 8, 'center', null);
  items.forEach((it, i) => { ctx.fillStyle = TEAM[it.t].main; ctx.fillRect(x - w / 2 + 5, y + 14 + i * 10, 3, 8); text(it.text, x - w / 2 + 12, y + 14 + i * 10, it.text.includes('EMPTY') ? '#ff9e94' : '#e9ecff', 6.5, 'left', null); });
}
function drawRulesOverlay() {
  if (S.screen !== 'play' && S.screen !== 'paused') return;
  const SW = viewW(), vh = viewH();
  toScreen();
  if (S.ppBanner && S.ppBanner.life > 0 && S.phase !== 'fight') {
    S.ppBanner.life--;
    const t = S.ppBanner.team, y = Math.min(HUDH + vh - 30, (S.botY || 1e9) - 16), w = 150; S.botY = y - 4;
    ctx.globalAlpha = Math.min(1, S.ppBanner.life / 20);
    ctx.fillStyle = TEAM[t].main; ctx.fillRect((SW - w) / 2, y, w, 16); ctx.fillStyle = TEAM[t].trim; ctx.fillRect((SW - w) / 2, y + 14, w, 2);
    text(TEAM[t].abbr + ' MAN ADVANTAGE', SW / 2, y + 4, '#ffffff', 7, 'center', null);
    ctx.globalAlpha = 1;
  }
  if (S.injNote && S.injNote.life > 0) {
    const n = S.injNote; n.life--;
    const y = Math.min(HUDH + vh - 56, (S.botY || 1e9) - 22), w = Math.max(n.text.length, n.sub.length) * 6 + 18; S.botY = y - 4;
    ctx.globalAlpha = Math.min(1, n.life / 20);
    ctx.fillStyle = 'rgba(30,8,10,.9)'; ctx.fillRect((SW - w) / 2, y, w, 22); ctx.fillStyle = '#ff6a4a'; ctx.fillRect((SW - w) / 2, y, 3, 22);
    text(n.text, SW / 2, y + 3, '#ffb3a8', 6, 'center', null); text(n.sub, SW / 2, y + 12, '#e9ecff', 5, 'center', null);
    ctx.globalAlpha = 1;
  }
  if (S.phase === 'live' && RS() && RS().fights.brutal) {          // contextual fight prompt after a dirty hit on your player
    const b = RS().fights.brutal;
    if (b.team === 1 && S.t - b.t < BAL.fight.window && !fightBlocked(0) && b.hitter.on) text(`${Input.first('fight')} = CHALLENGE ${plTagPl(b.hitter.pl)}`, SW / 2, HUDH + vh - 44, '#ff9e94', 6, 'center');
  }
  if (S.phase === 'fight' || S.phase === 'ask' || (S.ask && S.ask.live)) drawFightOverlay();
  updateExtraPick();
}

// ====================================================================
//  TIMEOUTS: three per team per game, called at a stoppage (before the puck drops). Your timeout freezes the game:
//  pick the line for the faceoff, change tactics and formations; everyone gets a breather. The CPU calls its own late
//  in a close game it is losing, or when a gassed line is stuck on the ice after an icing.
// ====================================================================
const TIMEOUTS = { perGame: 3, rest: 18 };
const toLeft = t => (MS && MS.timeouts ? MS.timeouts[t] : TIMEOUTS.perGame);
function timeoutAllowed(t) {
  return !!(MS && S.match && !S.so && !S.demo && S.screen === 'play' && toLeft(t) > 0 && (S.phase === 'whistle' || S.phase === 'goal' || (S.phase === 'faceoff' && !(S.fo && S.fo.dropped))));
}
function timeoutRest(t) {      // a breather for the whole bench
  for (const pl of (S.match.lineups[t].lines || []).flat().concat(S.match.lineups[t].bench || [])) if (pl) MS.stam[pl.id] = Math.min(100, (MS.stam[pl.id] ?? 100) + TIMEOUTS.rest);
}
function callTimeout(t) {
  if (!timeoutAllowed(t)) return false;
  MS.timeouts = MS.timeouts || [TIMEOUTS.perGame, TIMEOUTS.perGame];
  MS.timeouts[t]--;
  (MS.toAt = MS.toAt || [-1e9, -1e9])[t] = S.t;
  timeoutRest(t);
  sfx.whistle(true);
  if (typeof say === 'function') say([`${TEAM[t].abbr} CALLS A TIMEOUT.`, `TIMEOUT, ${TEAM[t].nick.toUpperCase()}. A CHANCE TO REGROUP.`], 2);
  if (t === 0 && !S.autoAI) { S.timeoutFrom = S.screen; S.screen = 'timeout'; if (typeof aiIntermissionTactics === 'function') aiIntermissionTactics(1, { yourTimeout: true }); showTimeout(); }   // the other bench may re-plan too, from what it has seen and the score (it never sees what you pick here)
  else { S.banner = { text: 'TIMEOUT', sub: TEAM[t].abbr, life: 150 }; if (S.phase === 'faceoff') S.timer += 150; if (typeof aiIntermissionTactics === 'function') aiIntermissionTactics(t); }
  return true;
}
// ---------- PULLING A STRUGGLING GOALIE (Nov 21): at the faceoff after a goal, a coach may call a timeout (or just make
// the change, if he has none left) and send in the backup: a COLD goalie who lets in another one, three against him in
// one period, or a blowout (four or more and down by three). Once a game per team. Your bench: a CHANGE GOALIE button in
// your timeout, and a nudge when it might be time.
function goalieChangeCand(t) {
  const lu = S.match.lineups[t], g = goalies[t]; if (!lu || !g || !g.pl || !g.on) return null;
  return (lu.backups || []).filter(b => b && b.id !== g.pl.id && !(typeof outInfo === 'function' && outInfo(b.id))).sort((a, b) => overall(b) - overall(a))[0] || null;
}
function goalieStruggling(t) {
  const g = goalies[t]; if (!g || !g.pl || !MS || S.period > 3) return null;
  const gaP = MS.gaP && MS.gaP.per === S.period ? MS.gaP.n[t] : 0, ga = MS.gConc ? MS.gConc[t] : 0, down = S.score[1 - t] - S.score[t];
  const cold = (g.pl.streak && g.pl.streak.k === 'cold') || (S.match.formShown && S.match.formShown[t] === 'cold');
  const since = MS.gColdAt && MS.gColdAt[t] != null ? MS.gColdAt[t] : 0, gaTot = MS.gaTot ? MS.gaTot[t] : 0;   // goals against since he went cold
  if (gaP >= 3) return { why: `${gaP} goals against this half`, p: 0.65 };
  if (ga >= 4 && down >= 3) return { why: `${ga} goals against, down by ${down}`, p: 0.8 };
  if (cold && gaTot > since) return { why: 'pitch cold tonight', p: 0.6 };
  return null;
}
function changeGoalie(t, why) {
  const lu = S.match.lineups[t], g = goalies[t], nb = goalieChangeCand(t); if (!nb || !g || !g.pl) return false;
  const old = g.pl;
  (MS.gUsed = MS.gUsed || [[], []])[t].push(old.id);
  seat(g, nb); lu.goalie = nb; lu.backups = [old].concat((lu.backups || []).filter(x => x && x.id !== nb.id));
  if (typeof goalieHome === 'function') goalieHome(g);
  (MS.gChanged = MS.gChanged || [false, false])[t] = true;
  if (MS.gConc) MS.gConc[t] = 0; if (MS.gRun) MS.gRun[t] = 0;
  if (S.match.formShown) S.match.formShown[t] = null;
  refreshEff();
  S.banner = { text: 'KEEPER CHANGE', sub: `${TEAM[t].abbr}: #${nb.num} ${(nb.last || '').toUpperCase()} IN FOR #${old.num} ${(old.last || '').toUpperCase()}`, life: 200 };
  if (S.phase === 'faceoff') S.timer += 120;
  say([`${TEAM[t].abbr} IS CHANGING HIS KEEPER.`, `THAT'S THE NIGHT FOR ${(old.last || '').toUpperCase()}. ${(nb.last || '').toUpperCase()} COMES IN.`], 2, 0.9);
  rsLog(`${TEAM[t].abbr} pulled #${old.num} ${plName(old)} for #${nb.num} ${plName(nb)}${why ? ' (' + why + ')' : ''}`);
  return true;
}
function aiGoalieCheck() {
  if (!MS || S.so || S.demo || S.period > 3) return;
  MS.gEval = MS.gEval || [-1, -1];
  for (const t of [0, 1]) {
    const ga = MS.gConc ? MS.gConc[t] : 0, gaTot = MS.gaTot ? MS.gaTot[t] : 0;
    if ((MS.gChanged && MS.gChanged[t]) || MS.gEval[t] === gaTot || !goalieChangeCand(t)) continue;
    const st = goalieStruggling(t); if (!st) continue;
    MS.gEval[t] = gaTot;                                     // decided once per goal against
    if ((S.match.userTeams || []).includes(t)) {             // your goalie: a nudge, the call is yours
      floaters.push({ x: CX, y: CY - 30, text: 'YOUR KEEPER IS STRUGGLING: TIMEOUT TO CHANGE HIM', life: 160, color: '#ffb03a' });
      continue;
    }
    if (Math.random() > st.p) continue;
    if (toLeft(t) > 0 && timeoutAllowed(t)) callTimeout(t);
    changeGoalie(t, st.why);
  }
}
// the CPU: a timeout at a faceoff when it really matters
function aiTimeoutCheck() {
  if (!MS || S.so || S.demo) return;
  aiGoalieCheck();
  for (const t of [0, 1]) {
    if ((S.match.userTeams || []).includes(t) || toLeft(t) <= 0 || !timeoutAllowed(t)) continue;
    if (MS.toAt && S.t - MS.toAt[1 - t] < 1200) continue;     // never right after the other bench's timeout (it would look like an answer to it)
    const down = S.score[1 - t] - S.score[t];
    const late = S.period >= 3 && S.clock < S.periodLen * 0.25 && (down === 1 || down === 2) && !(MS.toUsedLate && MS.toUsedLate[t]);
    const gassed = typeof lineAvgStam === 'function' && lineAvgStam(t) < 22 && S.phase === 'faceoff' && Math.random() < 0.5;
    // lost two or more men (injury, ejection): regroup once, and re-plan the lines around who is left
    const lost = (S.match.lineups[t].lines || []).flat().filter(pl => pl && outInfo(pl.id)).length;
    const hurt = lost >= 2 && S.phase === 'faceoff' && !(MS.toHurt && MS.toHurt[t]);
    if (hurt) (MS.toHurt = MS.toHurt || [false, false])[t] = true;
    if (late || gassed || hurt) { if (late) (MS.toUsedLate = MS.toUsedLate || [false, false])[t] = true; callTimeout(t); }
  }
}
function endTimeout() {
  const el = document.getElementById('timeoutBox'); if (el) el.classList.remove('show');
  if (S.screen === 'timeout') S.screen = 'play';
  if (typeof cvs !== 'undefined') cvs.focus();
}
function showTimeout() {
  let el = document.getElementById('timeoutBox');
  if (!el) {
    el = document.createElement('div'); el.id = 'timeoutBox';
    el.addEventListener('keydown', e => { if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) e.stopPropagation(); });
    (document.getElementById('wrap') || document.body).appendChild(el);
  }
  const draw = () => {
    el.innerHTML = '';
    const lines = [0, 1, 2].map(i => { const r = typeof lineRatings === 'function' ? lineRatings(0, i) : null; return r ? { i, r } : null; }).filter(Boolean);
    const cur = MS.nextLine != null ? MS.nextLine : MS.lines[0].idx;
    const lineBtns = h('div', { class: 'to-lines' }, lines.map(({ i, r }) => h('button', { class: 'small' + (i === cur ? ' sel' : ''), onclick: () => {
        MS.nextLine = i; if (S.phase === 'faceoff' && typeof setLine === 'function') { setLine(0, i); MS.nextLine = null; } draw(); } },
      `LINE ${i + 1} · ${Math.round(r.stam)}%` + (i === MS.lines[0].idx ? ' (ON THE PITCH)' : ''))));
    el.appendChild(h('div', { class: 'to-head' }, h('span', { class: 'gold' }, 'TIMEOUT · ' + TEAM[0].abbr), h('span', { class: 'muted' }, `  ${toLeft(0)} left this game · everyone gets a breather`),
      h('button', { class: 'primary', style: { marginLeft: 'auto' }, onclick: endTimeout }, 'RESUME ▶')));
    { const nb = goalieChangeCand(0), g = goalies[0], st = goalieStruggling(0);
      if (nb && g && g.pl && !(MS.gChanged && MS.gChanged[0])) el.appendChild(h('div', { class: 'to-sub' }, h('button', { class: 'small' + (st ? ' primary' : ''), onclick: () => { changeGoalie(0, 'your call'); draw(); } }, `CHANGE KEEPER: #${nb.num} ${nb.last.toUpperCase()} IN FOR #${g.pl.num} ${g.pl.last.toUpperCase()}`), st ? h('span', { class: 'gold' }, '  ' + st.why) : null));
      else if (MS.gChanged && MS.gChanged[0]) el.appendChild(h('div', { class: 'to-sub muted' }, 'Keeper changed (once a game).')); }
    el.appendChild(h('div', { class: 'to-sub' }, 'LINE FOR THE NEXT KICKOFF'));
    el.appendChild(lineBtns);
    if (typeof tacticsPanel === 'function' && !S.match.easyTac) el.appendChild(tacticsPanel(S.match.tac[0], tc => { S.match.tac[0] = tc; draw(); }, { showDesc: false }));
    if (typeof tacSummary === 'function' && !S.match.easyTac && S.diff !== 'HARD') el.appendChild(h('div', { class: 'muted', style: { marginTop: '4px' } }, TEAM[1].abbr + ': ' + tacSummary(S.match.tac[1])));
    if (S.diff === 'HARD' && !S.match.easyTac) el.appendChild(h('div', { class: 'muted', style: { marginTop: '4px' } }, TEAM[1].abbr + ': their tactics are hidden on Hard'));
    { const a = !S.match.easyTac && S.diff !== 'HARD' && S.match.adjust && S.match.adjust[1]; if (a) el.appendChild(h('div', { class: 'gold', style: { marginTop: '3px' } }, 'THEY ADJUSTED · ' + a.text)); }
  };
  draw(); el.classList.add('show');
}

// ====================================================================
//  SOCCER MATCH FLOW (Nov 24): ADDED TIME and ADVANTAGE
// ====================================================================
//  ADDED TIME: when a half's clock runs out the fourth official holds up the board: +1 to +5 "minutes", more for a
//  half with goals, fouls and injuries in it (and a little luck). One added minute = max(3, half length / 30) game
//  seconds, so +3 in a 100-second half is ten seconds of drama. The clock shows "+0:07" (green) counting down. When it
//  hits zero the referee still lets a promising attack near either box finish, for up to one more added minute.
//  Only in real matches (no challenge modes, no shootouts). Everything keys on S.match, so a new match starts clean.
const ADDED = { base: 1, max: 5, goalW: 0.5, stopW: 0.5, luck: 0.5 };
function addedStop(w = 1) {                    // a stoppage worth adding time for (a foul, a card, an injury)
  if (!S.match || S.mode) return;
  if (!S.stopsP || S.stopsP.period !== S.period || S.stopsP.match !== S.match) S.stopsP = { period: S.period, match: S.match, n: 0 };
  S.stopsP.n += w;
}
const addedPerMin = () => Math.max(3, (S.periodLen || 100) / 30);
function addedLive() { const A = S.added; return !!(A && A.on && A.match === S.match && A.period === S.period && S.clock <= 0); }
function addedAttackOn() {
  const near = RK(150), o = puck.owner;
  for (const gy of [GL_TOP, GL_BOT]) {
    if (Math.abs(puck.y - gy) > near) continue;
    if (o) { if (!o.g && (attackDir(o.team) > 0 ? GL_BOT : GL_TOP) === gy) return true; }
    else if (hyp(puck.vx, puck.vy) > 1.5 || (puck.h || 0) > 2) return true;        // a loose ball or a cross flying around the box
  }
  return false;
}
// called by the engine each live frame once the clock is at zero; true = keep playing
function addedTimeTick(dtc) {
  if (!S.match || S.mode || S.so || S.phase !== 'live') return false;
  let A = S.added;
  if (!A || A.match !== S.match || A.period !== S.period) {
    const goals = MS && MS.goals ? MS.goals.filter(g => g.period === S.period).length : 0;
    const stops = S.stopsP && S.stopsP.match === S.match && S.stopsP.period === S.period ? S.stopsP.n : 0;
    const mins = clamp(ADDED.base + Math.floor(goals * ADDED.goalW + stops * ADDED.stopW + (Math.random() < ADDED.luck ? 1 : 0)), 1, ADDED.max);
    A = S.added = { match: S.match, period: S.period, mins, left: mins * addedPerMin(), grace: 0, on: true };
    floaters.push({ x: CX, y: CY - 30, text: '+' + mins + ' ADDED TIME', life: 130, big: true, color: '#5ee07a' });
    say([`THE FOURTH OFFICIAL HOLDS UP THE BOARD: ${mins} ADDED MINUTE${mins > 1 ? 'S' : ''}!`, `${mins} MINUTE${mins > 1 ? 'S' : ''} OF STOPPAGE TIME TO PLAY.`, `PLUS ${mins}! THERE'S STILL TIME!`], 3);
    if (typeof rsLog === 'function') rsLog(`Added time: +${mins}`);
    return true;
  }
  if (!A.on) return false;
  if (A.left > 0) { A.left -= dtc; return true; }
  if (A.grace < addedPerMin() && addedAttackOn()) {            // the ref lets the attack finish
    if (!A.grace) say(['THE REF LETS THIS ONE PLAY OUT...', 'TIME IS UP, BUT THE REF WAITS FOR THIS ATTACK!'], 2);
    A.grace += dtc; return true;
  }
  A.on = false;
  return false;
}
function clockText() { return addedLive() ? '+' + fmtClock(Math.max(0, S.added.left)) : fmtClock(S.clock); }

//  ADVANTAGE: a foul anywhere but the fouled team's own defensive third, with a teammate at least as close to the loose ball as any opponent, isn't
//  whistled: the referee waves PLAY ON (the yellow is still given). If the fouling team wins the ball back within
//  ADV.callback frames, the advantage didn't come and play goes back for the free kick. Never for a penalty-box foul,
//  a foul on the keeper, a straight red, or a man already on a yellow (a sending-off always stops play).
const ADV = { callback: 90, window: 150, near: 70, margin: 0 };   // (near is scaled with RK() when used: tactics.js loads after this file)
function advantageCheck(kind, off, vic, fx, fy, straight) {
  const r = RS(); if (!r || S.adv || S.phase !== 'live' || S.so || straight || kind === 'interf') return false;
  if ((vic.y - CY) * attackDir(vic.team) < -(GL_BOT - GL_TOP) / 6) return false;   // anywhere but their own defensive third
  const prior = off.pl && r.cards && r.cards[off.pl.id] ? r.cards[off.pl.id].y : 0; if (prior >= 1) return false;
  const d = p => hyp(p.x - puck.x, p.y - puck.y);
  const o = puck.owner;
  let mate = o && o.team === vic.team && !o.g ? o : null;
  if (!mate) {
    if (o) return false;                                                         // the other side already has it
    let dT = 1e9, dO = 1e9;
    for (const p of teamSkaters(vic.team)) if (p !== vic && p.on !== false && !(p.down > 0)) { const v = d(p); if (v < dT) { dT = v; mate = p; } }
    for (const p of teamSkaters(off.team)) if (p !== off && p.on !== false) dO = Math.min(dO, d(p));
    if (!mate || dT > RK(ADV.near) || dT + ADV.margin > dO) return false;
  }
  const card = giveCard(off, kind, false);
  S.adv = { team: vic.team, offTeam: off.team, kind, fx, fy, t: S.t, card, offPl: off.pl };
  for (const rf of refs) rf.arm = 60;
  floaters.push({ x: vic.x, y: vic.y - 60, text: 'ADVANTAGE! PLAY ON', life: 70, color: '#5ee07a' });
  say([`${FOUL_NAME[kind]}, BUT THE REF PLAYS ADVANTAGE!`, 'PLAY ON! GOOD ADVANTAGE FROM THE REFEREE.', `THE REF WAVES PLAY ON. ${plTagPl(off.pl)} WILL STILL GO IN THE BOOK.`], 3);
  rsLog(`Advantage played: ${FOUL_NAME[kind]} - ${plTagPl(off.pl)}`);
  addedStop(ADDED.stopW);
  return true;
}
function advTick() {
  const a = S.adv; if (!a) return;
  const age = S.t - a.t;
  if (age < 0 || age > ADV.window) { S.adv = null; return; }
  const o = puck.owner;
  if (age <= ADV.callback && o && !o.g && o.team === a.offTeam) {              // the advantage didn't come: back for the free kick
    S.adv = null;
    say(['NO ADVANTAGE THERE, SO THE REF BRINGS IT BACK FOR THE FREE KICK.', 'THE ADVANTAGE DIDN\'T COME. FREE KICK.'], 2);
    whistle('FREE KICK', 'NO ADVANTAGE · ' + FOUL_NAME[a.kind] + ' - ' + plTagPl(a.offPl), () => { S.kickNext = a.team; setupFaceoff(a.fx, a.fy); }, 90);
  }
}

//  KEEPER UP FOR A LAST-MINUTE CORNER (Barry said yes, 24 Nov): the losing side wins a corner late in the second half
//  (the last 15% of it), in added time, or late in extra time, and its keeper sprints up into the other box. A computer
//  taker waits for him (up to KUP.waitMax frames) and often aims the cross at him. He attacks it like a striker
//  (aerialContact lets him head it). The moment the other side wins the ball, it goes back past halfway, or KUP.maxUp
//  frames pass, he races back, and until he's home his goal is open. Movement bounds are lifted while p.kUp is set
//  (engine.js); setupFaceoff() and endPeriod() clear it. Off in challenge modes and shootouts.
const KUP = { lateFrac: 0.15, waitMax: 420, arrive: 22, maxUp: 600, homeDist: 24, aimAtHim: 0.45 };
function kupLate() { return (typeof addedLive === 'function' && addedLive()) || S.clock <= Math.max(10, (S.periodLen || 100) * KUP.lateFrac); }
function keeperUpCheck(team) {
  if (!S.match || S.mode || S.so || S.period < 3 || S.score[team] >= S.score[1 - team] || !kupLate()) return false;
  const g = goalies[team];
  if (!g || g.on === false || g.ghost || g.kUp || (g === ctrl && !S.autoAI)) return false;
  const gy = oppGoalY(team), dir = attackDir(team);
  g.kUp = { st: 'up', t: S.t, x: CX + rand(-14, 14), y: gy - dir * (PEN_D * 0.5) };
  g.fetch = null; g.roam = true;
  floaters.push({ x: CX, y: CY - 30, text: "THE KEEPER'S GOING UP!", life: 130, big: true, color: '#ffd23f' });
  say(["THE KEEPER IS COMING UP FOR THIS ONE!", "EVERYONE FORWARD, EVEN THE KEEPER!", "HERE COMES THE KEEPER! IT'S ALL OR NOTHING!"], 3);
  excite(0.7);
  if (typeof rsLog === 'function') rsLog(`Keeper up for a late corner: ${TEAM[team].abbr}`);
  return true;
}
const keeperUpArrived = g => !!(g && g.kUp && g.kUp.st === 'up' && hyp(g.x - g.kUp.x, g.y - g.kUp.y) < KUP.arrive);
// the computer corner-taker waits for his keeper to get into the box
function keeperUpWait(team, wait) { const g = goalies[team]; return !!(g && g.kUp && g.kUp.st === 'up' && !keeperUpArrived(g) && wait < KUP.waitMax); }
// ... and then often picks him out
function keeperUpTarget(team) { const g = goalies[team]; return keeperUpArrived(g) && Math.random() < KUP.aimAtHim ? g : null; }
// keepers who are up: they go for headers like outfield players (aerialContact)
function keeperUpList() { return goalies.filter(g => g && g.kUp && g.kUp.st === 'up' && g.on !== false); }
// called at the top of thinkGoalie (when he hasn't got the ball); true = this keeper is handled here
function keeperUpThink(p) {
  const k = p.kUp; if (!k) return false;
  const t = p.team, sgn = attackDir(t);
  if (k.st === 'up') {
    const o = puck.owner;
    if (S.phase === 'live' && ((o && o.team !== t) || (puck.y - CY) * sgn < 0 || S.t - k.t > KUP.maxUp)) {
      k.st = 'back';
      say(["HE'S GOT TO GET BACK! THE NET IS EMPTY!", 'THE KEEPER IS STRANDED UPFIELD!', 'NOBODY IN GOAL! BACK HE RUNS!'], 3);
    } else { steerTo(p, k.x, k.y, 1, 4); p.fx = 0; p.fy = sgn; return true; }
  }
  const gl = ownGoalY(t), hx = CX, hy = gl + sgn * 8;
  if (hyp(p.x - hx, p.y - hy) < KUP.homeDist) { p.kUp = null; p.roam = true; return false; }   // home: the normal keeper takes over
  steerTo(p, hx, hy, 1, 6); p.fx = 0; p.fy = sgn; return true;
}
function keeperUpClear() { for (const g of goalies) if (g) g.kUp = null; }
