'use strict';
// ====================================================================
//  FIGHTS: challenges (manual at stoppages / after a brutal hit, contextual AI challenges),
//  accept / refuse, and a short playable bout (jab, haymaker, dodge; balance and stamina).
//  Both fighters are ejected; no timed penalty is added (an original illegal-hit penalty still stands).
//  The winner's team gets a brief momentum lift; a refusal costs the refusing team a little morale.
// ====================================================================
function fightStats(pl) {
  const a = pl.attrs || {}, tf = k => typeof traitFight === 'function' ? traitFight(pl, k) : 0;
  return {
    pow: (a.chk * 0.5 + a.pow * 0.35 + a.def * 0.15) / 10 + tf('pow'),         // ~0.1 - 1.2
    bal: (a.def * 0.4 + a.chk * 0.35 + a.spd * 0.25) / 10 + tf('bal'),
    dodge: (a.spd * 0.55 + a.stk * 0.45) / 10 + tf('dodge'),
    end: (a.sta || 5) / 10, chin: Math.min(0.6, tf('chin')), counter: tf('counter'), scare: tf('scare'),
  };
}
const fightPower = pl => typeof fightRating === 'function' ? fightRating(pl) : (pl.attrs.chk + pl.attrs.pow) / 2;
// why a fight can't happen right now (or null)
function fightBlocked(ta) {
  if (!(S.mode && /fight|spar/.test(S.mode.id || ''))) return 'NO SCUFFLES: IT\'S SOCCER';   // SOCCER: no fights in matches
  const r = RS();
  if (!r || S.so || !S.match || !S.match.lineups) return 'NO SCUFFLES HERE';
  if (S.phase === 'penalty' || S.phase === 'fight' || S.phase === 'goal') return 'NOT NOW';
  if (S.period >= 4) return 'NO SCUFFLES IN EXTRA TIME';
  for (const t of [0, 1]) if (availSkaters(t).length <= BAL.minSkaters) return 'TOO FEW PLAYERS LEFT';
  if (r.fights.n[ta] >= BAL.fight.maxPerTeam) return 'NO CHALLENGES LEFT';
  if (r.el - r.fights.last < BAL.fight.cooldown) return 'TOO SOON AFTER THE LAST ONE';
  return null;
}
// AI: does this team want to answer a hit on one of its players?
function aiWantsChallenge(t, target, mul = 1, victim) {
  if (victim) mul *= 1 + 2 * grudgeOf(victim, target);         // bad blood between these two
  if (fightBlocked(t)) return false;
  const diff = S.score[t] - S.score[1 - t];
  let p = BAL.fight.aiChallenge * (diff >= 2 ? 0.4 : diff <= -2 ? 1.3 : 1) * (S.period === 3 && S.clock < 40 ? 0.4 : 1);
  if (target && target.pl && hasTrait(target.pl, 'intimidating')) p *= 0.5;
  return Math.random() < p * mul;
}
// AI: who drops the gloves (a willing, able fighter; stars are protected unless they're built for it)
function aiChallenger(t, target) {
  const on = teamSkaters(t).filter(p => p.pl && !isOutPid(p.pl.id));
  const dressed = dressedSkaters(t), ovr = pl => typeof overall === 'function' ? overall(pl) : 5;
  const top = dressed.slice().sort((a, b) => ovr(b) - ovr(a)).slice(0, 3).map(p => p.id);
  let c = on.filter(p => !top.includes(p.pl.id) || hasTrait(p.pl, 'enforcer') || hasTrait(p.pl, 'protector') || hasTrait(p.pl, 'hotheaded'));
  if (!c.length && Math.random() < 0.5) c = on.filter(p => p.pl.id !== top[0]);   // the top line is out: a linemate sticks up for him (never the best player)
  c = c.sort((a, b) => fightPower(b.pl) + (hasTrait(b.pl, 'protector') ? 1 : 0) - fightPower(a.pl) - (hasTrait(a.pl, 'protector') ? 1 : 0));
  const best = c[0]; if (!best) return null;
  if (target && target.pl && fightPower(best.pl) < fightPower(target.pl) - 2.5 && !hasTrait(best.pl, 'hotheaded')) return null;   // not a suicide mission
  return best;
}
// AI: accept a challenge?
function aiAccepts(obj, challenger) {
  const pl = obj.pl, t = obj.team, diff = S.score[t] - S.score[1 - t];
  let p = 0.55 + (fightPower(pl) - fightPower(challenger.pl)) * 0.08;
  if (hasTrait(pl, 'enforcer') || hasTrait(pl, 'hotheaded')) p += 0.25;
  if (hasTrait(pl, 'protector')) p += 0.1;
  if (hasTrait(pl, 'disciplined')) p -= 0.3;
  if (hasTrait(challenger.pl, 'intimidating')) p -= 0.2;
  const ovr = typeof overall === 'function' ? overall(pl) : 5, top = dressedSkaters(t).map(x => overall(x)).sort((a, b) => b - a)[2] || 0;
  if (ovr >= top && !hasTrait(pl, 'enforcer')) p -= 0.25;                       // the team protects its stars
  if (diff > 0 && S.period === 3) p -= 0.15;
  return Math.random() < Math.max(0.05, Math.min(0.95, p));
}
// the human presses the fight key
function humanChallenge() {
  const r = RS(); if (!r) return false;
  const blocked = fightBlocked(0);
  if (blocked) { floaters.push({ x: CX, y: CY - 30, text: blocked, life: 70, color: '#ff9e94' }); return false; }
  const live = S.phase === 'live', br = r.fights.brutal;
  const recent = br && S.t - br.t < BAL.fight.window && br.team === 1 && br.hitter.on && br.hitter.pl && !isOutPid(br.hitter.pl.id);
  if (live && !recent) { floaters.push({ x: CX, y: CY - 30, text: 'ONLY AT A STOPPAGE OR AFTER A BIG TACKLE', life: 80, color: '#ff9e94' }); return false; }
  let me = ctrl && !ctrl.g && ctrl.on ? ctrl : teamSkaters(0)[0];
  let target = recent ? br.hitter : teamSkaters(1).filter(p => p.pl).sort((a, b) => dist(a, me) - dist(b, me))[0];
  if (!me || !target) return false;
  resolveChallenge(me, target, live); return true;      // answered on the spot: no whistle unless they actually go
}
function resolveChallenge(ch, target, live) {
  const r = RS(); r.fights.n[ch.team]++; r.fights.last = r.el; r.fights.brutal = null;
  if (aiAccepts(target, ch)) return startFight(ch, target);
  refuse(target.team, target, ch, live);
}
// an AI player challenges one of yours: you decide
function offerFight(ch, target) {
  const r = RS(); if (!r || fightBlocked(ch.team) || !target.on || !ch.on) { const d = nearestDot(puck.x, puck.y); return setupFaceoff(d.x, d.y); }
  r.fights.n[ch.team]++; r.fights.last = r.el; r.fights.brutal = null;
  if (target.team === 1 || S.autoAI) return aiAccepts(target, ch) ? startFight(ch, target) : refuse(target.team, target, ch);
  S.phase = 'ask'; S.ask = { ch, target, t: 0, limit: 180 };
}
// after a clean hit the play goes on: the challenge is put while the puck is still live, and an accepted one is
// fought at the next whistle (an ignored one lapses)
function liveChallenge(ch, target) {
  const r = RS(); if (!r || S.ask || S.pendingFight || fightBlocked(ch.team) || !ch.on || !target.on) return;
  r.fights.n[ch.team]++; r.fights.last = r.el; r.fights.brutal = null;
  if (target.team === 1 || S.autoAI) {
    if (aiAccepts(target, ch)) { S.pendingFight = { ch, target, go: true }; floaters.push({ x: target.x, y: target.y - 34, text: 'GLOVES OFF AT THE WHISTLE', life: 70, color: '#ff9e94' }); }
    else refuse(target.team, target, ch, true);
    return;
  }
  S.ask = { ch, target, t: 0, limit: 300, live: true };
  floaters.push({ x: ch.x, y: ch.y - 34, text: 'WANTS TO GO!', life: 60, color: '#ff6a4a' });
}
function answerFight(yes) {
  const a = S.ask; if (!a) return;
  S.ask = null;
  if (a.live) {
    if (yes) { S.pendingFight = { ch: a.ch, target: a.target, go: true }; floaters.push({ x: a.target.x, y: a.target.y - 34, text: 'AT THE NEXT WHISTLE', life: 60, color: '#ffd23f' }); }
    else refuse(0, a.target, a.ch, true);
    return;
  }
  if (yes) startFight(a.ch, a.target); else refuse(0, a.target, a.ch);
}
function refuse(t, obj, ch, live) {
  const r = RS();
  r.morale[t].push({ v: -BAL.fight.refuseMul, until: r.el + BAL.fight.refuseSec });
  rsLog(`${plTagPl(obj.pl)} (${TEAM[t].abbr}) refuses ${plTagPl(ch.pl)}'s challenge`);
  say([`${plTagPl(obj.pl)} WANTS NO PART OF IT.`, 'HE TURNS DOWN THE INVITATION. THE CROWD LETS HIM HEAR IT.'], 2);
  if (typeof refreshEff === 'function') refreshEff();
  if (live) { floaters.push({ x: obj.x, y: obj.y - 34, text: 'NO THANKS', life: 50, color: '#9aa3c7' }); return; }   // play never stopped
  const d = nearestDot(puck.x, puck.y);
  whistle('NO SCUFFLE', plTagPl(obj.pl) + ' REFUSES', () => setupFaceoff(d.x, d.y), 70, true);   // (play was already stopped: no second whistle)
}
// ---------- the bout
function startFight(a, b) {
  const r = RS();
  setGrudge(a, b, 0.15);
  typeof voiceCue === 'function' && voiceCue('fight');                                        // settled (for now)
  const fx = clamp((a.x + b.x) / 2, R.l + 60, R.r - 60), fy = clamp((a.y + b.y) / 2, GL_TOP + 70, GL_BOT - 70);
  for (const p of players) {
    resetPlayerState(p);
    if (p === a || p === b) continue;
    if (p.g) { goalieHome(p); continue; }
    const ang = Math.atan2(p.y - fy, p.x - fx) || Math.random() * 6.28;   // everyone else backs off into a ring
    p.x = clamp(fx + Math.cos(ang) * 70, R.l + 12, R.r - 12); p.y = clamp(fy + Math.sin(ang) * 60, R.t + 14, R.b - 14); p.mx = p.x; p.my = p.y;
  }
  const L = a.x <= b.x ? a : b, Rr = L === a ? b : a;
  L.x = fx - 13; L.y = fy; Rr.x = fx + 13; Rr.y = fy; L.fx = 1; L.fy = 0; Rr.fx = -1; Rr.fy = 0;
  for (const p of [a, b]) { p.mx = p.x; p.my = p.y; p.fight = true; }
  // the gloves and sticks hit the ice and slide away from them (they're picked up as the fighters leave)
  S.fightGear = [];
  for (const [o, side] of [[L, -1], [Rr, 1]]) {
    const a0 = (side < 0 ? Math.PI : 0) + rand(-0.9, 0.9), sp = rand(2.2, 3.2);
    S.fightGear.push({ kind: 'stick', team: o.team, pl: o.pl, x: o.x, y: o.y + 2, vx: Math.cos(a0) * sp, vy: Math.sin(a0) * sp * 0.8, ang: rand(0, 6.28), spin: rand(-0.12, 0.12) });
    for (let k = 0; k < 2; k++) { const ag = a0 + rand(-0.8, 0.8); S.fightGear.push({ kind: 'glove', team: o.team, pl: o.pl, x: o.x, y: o.y, vx: Math.cos(ag) * rand(0.8, 1.6), vy: Math.sin(ag) * rand(0.8, 1.6), ang: 0, spin: 0 }); }
  }
  puck.owner = null; puck.x = fx; puck.y = fy + 40; puck.vx = puck.vy = 0;
  const human = a.team === 0 && !S.autoAI ? a : b.team === 0 && !S.autoAI ? b : null;
  S.fight = { f: [L, Rr].map(o => ({ o, s: fightStats(o.pl), bal: 100, st: 100, act: null, cd: 20, hits: 0, dmg: 0, ai: { next: 30 + Math.random() * 30 } })),
    t: 0, max: Math.round(BAL.fight.maxSec * 60 * (SPEEDS[S.speed] || 1)), human, fx, fy, end: 0, winner: null, msg: null };
  for (const F of S.fight.f) { F.ai.habit = fightHabit(F.o.pl); F.ai.hi = 0; F.ai.next = 24 + Math.random() * 12; }
  // you against the computer: a fighter tougher than yours keeps only part of his edge (cpuEdge), while
  // a fighter of yours who is better than his gets a slight one on top of his numbers
  if (human) {
    const H = S.fight.f.find(F => F.o === human), C = S.fight.f.find(F => F !== H);
    if (!(S.mode && S.mode.id === 'fightnight')) for (const k of ['pow', 'bal', 'dodge', 'end']) if (C.s[k] > H.s[k]) C.s[k] = H.s[k] + (C.s[k] - H.s[k]) * FIGHT.cpuEdge;   // (Fight Night's ladder keeps its tougher men)
    const adv = Math.max(0, (H.s.pow - C.s.pow) + (H.s.bal - C.s.bal) + (H.s.dodge - C.s.dodge));
    H.edge = Math.min(FIGHT.edgeMax, adv * FIGHT.edgePer);
  }
  S.phase = 'fight';
  S.banner = { text: 'SCUFFLE!', sub: plTagPl(L.pl) + ' VS ' + plTagPl(Rr.pl), life: 80 };
  rsLog(`SCUFFLE: ${plTagPl(a.pl)} (${TEAM[a.team].abbr}) vs ${plTagPl(b.pl)} (${TEAM[b.team].abbr})`);
  say(['THE GLOVES ARE OFF!', 'HERE WE GO! THEY\'RE GOING AT IT!', 'AND THEY DROP THE MITTS!'], 3);
  if (S.cheer < 200) { S.cheer = 200; S.cheerKind = 'all'; }
  excite(0.9); sfx.whistle(true);
  clipEvent('fight', { text: 'SCUFFLE! ' + plTagPl(a.pl) + ' VS ' + plTagPl(b.pl), team: a.team, players: [a.pl.id, b.pl.id] }, 30);
}
const MOVES = { jab: { wind: 8, act: 4, rec: 12, dmg: 8, cost: 6 }, hay: { wind: 18, act: 5, rec: 22, dmg: 19, cost: 13 },   // (dmg was 7 / 16: more fights end in a knockdown)
  dodge: { wind: 1, act: 16, rec: 10, dmg: 0, cost: 6 } };
// fights reward reading the other man, not mashing. Every fighter has a rhythm and a habit (the same man always
// fights the same way), and shows each move a moment before he throws it. Get into the right answer early (before
// his move shows, or as it starts) and it lands harder: READ HIM! Pressing while you're still recovering winds
// you a little (stamina); a press just before you're ready is held and thrown on time.
const FIGHT = {
  tell: { jab: 13, hay: 17, dodge: 10 },   // frames a computer fighter shows his next move before throwing it (Normal; was 11/14/9)
  tellDiff: { EASY: 1.4, NORMAL: 1, HARD: 0.95 },
  beat: 30,          // his rhythm: frames from the end of one move to the tell of the next
  habit: 0.8,        // how often he sticks to his habit (otherwise he mixes it up)
  react: 0.3,        // how often he reacts on reflex to a haymaker wind-up (rarely: he fights his own fight)
  readGrace: 12,     // a counter started up to this long after his move showed still counts as a read
  readMul: 1.6,      // a read counter lands this much harder
  buffer: 9,         // a press this close to being ready is held and thrown on time
  // HARD against you: he mixes up his habit, reacts more, sometimes fakes his tell (FEINT!), punishes a move you keep
  // repeating, lands 5% harder, and mashing costs 60% more stamina (eased Nov 19: it was too hard)
  hard: { habit: 0.7, react: 0.38, feint: 0.06, adapt: 0.45, mash: 1.6, dmg: 1.05 },
  cpuEdge: 0.6,                     // a tougher computer fighter keeps this share of his advantage over you
  edgePer: 0.12, edgeMax: 0.15,    // your better fighter: + this much punch per point of stat edge (pow+bal+dodge, 0-1 scale), capped
  mashCd: 0, mashSt: 2.5, mashBal: 0,        // a press while still busy costs a little stamina (tuned so mashing wins about as often as a beginner: ~55% at most)
};
const HABITS = [['jab', 'jab', 'hay'], ['jab', 'dodge', 'hay'], ['hay', 'jab', 'jab', 'dodge'], ['jab', 'jab', 'dodge', 'hay'], ['dodge', 'jab', 'hay'], ['jab', 'hay', 'dodge']];
function fightHabit(pl) { let h = 0; for (const c of String(pl && pl.id || 'x')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return HABITS[h % HABITS.length]; }
// did W get into his answer before L's move gave itself away (or just as it did)?
const readHim = (W, L) => W.act && W.act.start != null && L.reveal != null && W.act.start <= L.reveal + FIGHT.readGrace;
function readBonus(W, L) {
  if (!readHim(W, L)) return 1;
  floaters.push({ x: W.o.x, y: W.o.y - 40, text: 'READ HIM!', life: 40, color: '#ffd23f' });
  W.reads = (W.reads || 0) + 1; return FIGHT.readMul;
}
// rock-paper-scissors: JAB beats DODGE (too quick to slip), DODGE beats HAYMAKER (slip it, make him pay),
// HAYMAKER beats JAB (eats the jab and lands through it). The stats always tilt each matchup a little.
function rpsWin(F, O, kind) {                 // chance that F's move wins the exchange against what O is doing
  const s = F.s, o = O.s;
  if (kind === 'jab') return clamp(0.82 + (s.dodge - o.dodge) * 0.12 + (s.pow - o.bal) * 0.04, 0.55, 0.95);        // catches the dodger
  if (kind === 'hay') return clamp(0.8 + (s.pow - o.pow) * 0.1 + (o.chin ? -0.05 : 0) + (s.bal - o.bal) * 0.05, 0.55, 0.95);   // through the jab
  return clamp(0.8 + (s.dodge - o.pow) * 0.12 + (s.bal - o.bal) * 0.04, 0.55, 0.95);                               // dodge slips the haymaker
}
function fighterAct(F, kind) {
  if (F.act || F.cd > 0) return false;
  const m = MOVES[kind]; if (F.st < m.cost * 0.5) kind = 'jab';
  F.act = { kind, t: 0, landed: false, start: S.fight ? S.fight.t : 0 }; F.st = Math.max(0, F.st - MOVES[kind].cost * (1.15 - F.s.end * 0.3));
  if (F.ai && !F.ai.tell && S.fight) F.reveal = S.fight.t;               // no tell (a human, or a reflex): it shows as he throws it
  return true;
}
function fightTick() {
  const Fi = S.fight; if (!Fi) { S.phase = 'live'; return; }
  Fi.t++; fightGearTick(); tickFx(); updateRefs();
  for (const p of players) { p.inx = p.iny = 0; if (!p.fight) movePlayer(p); }
  if (Fi.end) {
    Fi.end--;
    if (Fi.end <= 0) finishFight();
    updateCamera(); return;
  }
  const [A0, B0] = Fi.f;
  for (const [F, O] of [[A0, B0], [B0, A0]]) {
    // input: one press, one punch. Pressing while still busy costs you; a press just before you're ready is held
    if (Fi.human === F.o) {
      const want = input.spacePressed ? 'jab' : (input.shiftPressed || input.pokePressed) ? 'hay' : (input.passPressed || input.dekePressed) ? 'dodge' : null;
      if (want) {
        if (!F.act && F.cd <= 0) { if (fighterAct(F, want)) F.hist = (F.hist || []).concat(want).slice(-4); }
        else if (!F.act && F.cd <= FIGHT.buffer && !F.buf) F.buf = want;
        else {
          F.cd = Math.min(30, F.cd + FIGHT.mashCd); F.st = Math.max(0, F.st - FIGHT.mashSt * (S.diff === 'HARD' ? FIGHT.hard.mash : 1)); F.mash = (F.mash || 0) + 1;
          if (Fi.t - (F.mashT || -99) > 30) { F.mashT = Fi.t; F.bal -= FIGHT.mashBal; floaters.push({ x: F.o.x, y: F.o.y - 34, text: 'WINDED', life: 30, color: '#ff9e94' }); }
        }
      }
      if (F.buf && !F.act && F.cd <= 0) { fighterAct(F, F.buf); F.buf = null; }
    } else {
      const ai = F.ai;
      if (ai.tell) {                                                        // showing his move: then he throws it
        if (--ai.tell.t <= 0) { const k = ai.tell.fake || ai.tell.kind; if (ai.tell.fake) floaters.push({ x: F.o.x, y: F.o.y - 40, text: 'FEINT!', life: 34, color: '#ff9ad8' }); fighterAct(F, k); ai.tell = null; }   // (thrown while the tell still stands, so it keeps its reveal time)
      } else if (!F.act && F.cd <= 0) {
        // a reflex now and then: the other man's haymaker coming, slip it (no tell, so it can't be read)
        const hayComing = (O.act && O.act.kind === 'hay' && O.act.t < MOVES.hay.wind - 4) || (O.ai && O.ai.tell && O.ai.tell.kind === 'hay');
        let reflex = false;
        const HD = Fi.human && Fi.human === O.o && S.diff === 'HARD' ? FIGHT.hard : null, react = HD ? HD.react : FIGHT.react;
        if (hayComing && ai.saw !== (O.act || O.ai.tell)) { ai.saw = O.act || O.ai.tell; if (Math.random() < react * (0.6 + F.s.dodge * 0.4) && F.st > 12) reflex = fighterAct(F, 'dodge'); }
        // ...or a jab coming at him: now and then he swings right through it
        const jabComing = O.act && O.act.kind === 'jab' && O.act.t < 3;
        if (!reflex && jabComing && ai.saw !== O.act) { ai.saw = O.act; if (Math.random() < react * 0.7 * (0.6 + F.s.pow * 0.4) && F.st > 25) reflex = fighterAct(F, 'hay'); }
        // two computer fighters read each other's tells (how well depends on the man); against you they fight their own fight
        if (!reflex && !Fi.human && O.ai && O.ai.tell && ai.read !== O.ai.tell) {
          ai.read = O.ai.tell;
          if (Math.random() < 0.15 + F.s.pow * 0.25 + F.s.bal * 0.15 + F.s.dodge * 0.1) reflex = fighterAct(F, { jab: 'hay', hay: 'dodge', dodge: 'jab' }[O.ai.tell.kind]);
        }
        if (!reflex && --ai.next <= 0) {                                               // on his beat: the next move of his habit
          let kind = Math.random() < (HD ? HD.habit : FIGHT.habit) ? ai.habit[ai.hi++ % ai.habit.length] : ['jab', 'jab', 'hay', 'dodge'][(Math.random() * 4) | 0];
          // HARD: he notices a move you keep using (two of your last three) and goes for its answer
          const hh = (O.hist || []).slice(-3), rep = HD && ['jab', 'hay', 'dodge'].find(x => hh.filter(y => y === x).length >= 2);
          if (rep && Math.random() < HD.adapt) kind = { jab: 'hay', hay: 'dodge', dodge: 'jab' }[rep];
          if (kind === 'hay' && F.st < 25) kind = 'jab';
          const spar = S.mode && S.mode.id === 'spar';
          const tt = Math.max(4, Math.round(FIGHT.tell[kind] * (Fi.human ? (FIGHT.tellDiff[S.diff] || 1) : 1) * (spar ? 1.3 : 1)));
          ai.tell = { kind, t: tt, T: tt }; F.reveal = Fi.t;
          if (HD && Math.random() < HD.feint) ai.tell.fake = pickR(['jab', 'hay', 'dodge'].filter(x => x !== kind));   // shows one move, throws another
          ai.next = Math.round(FIGHT.beat * (1.15 - F.s.end * 0.25)) + ((Math.random() * 5) | 0) - 2;
        }
      }
    }
    if (F.cd > 0) F.cd--;
    F.st = Math.min(100, F.st + 0.16 * (0.6 + F.s.end * 0.6));
    F.bal = Math.min(100, F.bal + 0.035 * (0.5 + F.s.bal));
    // the move plays out
    const a = F.act; if (!a) continue;
    a.t++;
    const m = MOVES[a.kind];
    if (a.kind !== 'dodge' && a.t === m.wind && !a.landed) {
      a.landed = true;
      const oa = O.act, dodging = oa && oa.kind === 'dodge', oSwing = oa && oa.kind !== 'dodge' ? oa.kind : null;
      if (dodging && a.kind === 'hay') {                                    // DODGE beats HAYMAKER
        if (Math.random() < rpsWin(O, F, 'dodge')) {
          F.bal -= 10; F.act = null; F.cd = MOVES.hay.rec + 6;
          floaters.push({ x: O.o.x, y: O.o.y - 30, text: 'SLIPS IT!', life: 30, color: '#9fd0ff' });
          landPunch(O, F, 'jab', (1.2 + (O.s.counter || 0)) * readBonus(O, F));   // and makes him pay
          continue;
        }
        landPunch(F, O, 'hay', 0.7);                                         // read it, but not quick enough
      } else if (dodging && a.kind === 'jab') {                             // JAB beats DODGE
        if (Math.random() < rpsWin(F, O, 'jab')) {
          O.act = null; O.cd = 8;
          floaters.push({ x: O.o.x, y: O.o.y - 30, text: 'CAUGHT HIM!', life: 30, color: '#ffffff' });
          landPunch(F, O, 'jab', 1.35 * readBonus(F, O));
        } else { F.bal -= 3; floaters.push({ x: O.o.x, y: O.o.y - 30, text: 'DUCKS IT!', life: 30, color: '#9fd0ff' }); }
      } else if (a.kind === 'jab' && oSwing === 'hay' && oa.t < MOVES.hay.wind) {   // HAYMAKER beats JAB: he eats it and keeps swinging
        if (Math.random() < rpsWin(O, F, 'hay')) { landPunch(F, O, 'jab', 0.45, true); floaters.push({ x: O.o.x, y: O.o.y - 36, text: 'EATS IT!', life: 26, color: '#ffd23f' }); oa.power = 1.25 * (readHim(O, F) ? FIGHT.readMul : 1); }
        else landPunch(F, O, 'jab', 1);                                       // the jab stops him
      } else if (a.kind === 'hay' && oSwing === 'jab') {                     // haymaker lands through the jab
        if (Math.random() < rpsWin(F, O, 'hay')) { O.act = null; O.cd = 14; landPunch(F, O, 'hay', 1.15 * readBonus(F, O)); }
        else landPunch(F, O, 'hay', 0.85);
      } else { if (a.power > 1.3) floaters.push({ x: F.o.x, y: F.o.y - 40, text: 'READ HIM!', life: 40, color: '#ffd23f' }); landPunch(F, O, a.kind, a.power || 1); }
    }
    // a dodge stays down until the punch he saw coming has arrived (so slipping early is a read, not a mistimed press)
    const incoming = (O.ai && O.ai.tell && O.ai.tell.kind !== 'dodge') || (O.act && O.act.kind !== 'dodge' && !O.act.landed);
    const hold = a.kind === 'dodge' && incoming && a.t < 48;
    if (a.t >= m.wind + m.act && !hold) { F.act = null; F.cd = m.rec; }
  }
  for (const F of Fi.f) if (F.bal <= 0) return knockDown(F === A0 ? B0 : A0, F);
  if (Fi.t >= Fi.max) {                                                   // linesmen step in: decision on the cards
    const w = A0.dmg === B0.dmg ? (A0.bal >= B0.bal ? A0 : B0) : (A0.dmg > B0.dmg ? A0 : B0);
    return knockDown(w, w === A0 ? B0 : A0, true);
  }
  // fighters sway in place
  // the tussle: they hold each other's jerseys and drag one another around in a little circle, with yanks
  const tug = Math.sin(Fi.t * 0.045) * 6 + Math.sin(Fi.t * 0.13) * 2, drift = Math.cos(Fi.t * 0.03) * 5;
  for (const F of Fi.f) {
    const side = F === A0 ? -1 : 1, lean = F.act && F.act.kind !== 'dodge' ? -side * 4 : F.act && F.act.kind === 'dodge' ? side * 5 : 0;
    const yank = (F.o.fightHurt || 0) > 0 ? side * 2 : 0; if (F.o.fightHurt > 0) F.o.fightHurt--;
    F.o.x = Fi.fx + tug + side * 11 + lean + yank; F.o.y = Fi.fy + drift * side * 0.4 + Math.cos(Fi.t * 0.05 + side) * 2;
    const a = F.act, m = a ? MOVES[a.kind] : null;
    const tl = F.ai && F.ai.tell;
    F.o.fightPose = !a ? (tl && tl.kind === 'hay' && tl.t < tl.T * 0.6 ? 'cock' : 'grab') : a.kind === 'dodge' ? 'duck' : a.t < m.wind ? (a.kind === 'hay' ? 'cockBig' : 'cock') : (a.kind === 'hay' ? 'swingBig' : 'swing');
    F.o.vx = F.o.vy = 0; F.o.anim += 0.15;
    const punching = F.act && F.act.kind !== 'dodge';
    F.o.lunge = punching ? 4 : 0; F.o.lungeDx = -side; F.o.lungeDy = 0; F.o.fx = -side; F.o.fy = 0;
    F.o.dkOff = F.act && F.act.kind === 'dodge' ? side * 4 : 0;
  }
  input.spacePressed = input.shiftPressed = input.passPressed = input.pokePressed = input.dekePressed = false;
  updateCamera();
}
function landPunch(F, O, kind, mul, noInterrupt) {
  const m = MOVES[kind];
  const pulled = S.mode && S.mode.id === 'spar' && S.fight && O.o === S.fight.human ? 0.6 : 1;   // a sparring partner pulls his punches
  const edge = (1 + (F.edge || 0)) * (S.diff === 'HARD' && S.fight && S.fight.human && O.o === S.fight.human ? FIGHT.hard.dmg : 1);
  const dmg = edge * pulled * m.dmg * mul * (0.75 + F.s.pow * 0.45) * (0.55 + 0.45 * F.st / 100) * (1 - O.s.chin * 0.6) / (0.75 + O.s.bal * 0.35);
  O.bal -= dmg; F.dmg += dmg; F.hits++;
  if (!noInterrupt && O.act && O.act.kind !== 'dodge' && kind === 'hay') { O.act = null; O.cd = 14; }   // interrupted
  O.o.fightHurt = kind === 'hay' ? 14 : 7;
  Fi_shake(O.o, kind === 'hay');
  if (kind === 'hay') { sfx.punch(true); S.hitFlash = 6; floaters.push({ x: O.o.x, y: O.o.y - 30, text: ['WHAM!', 'BOOM!', 'POW!'][(Math.random() * 3) | 0], life: 34, color: '#ffd23f' }); }
  else { sfx.punch(false); if (Math.random() < 0.4) floaters.push({ x: O.o.x, y: O.o.y - 26, text: ['JAB!', 'SMACK!', 'THWACK!'][(Math.random() * 3) | 0], life: 24, color: '#ffffff' }); }
  if (S.cheer < 120) S.cheer = 120;
}
function Fi_shake(o, big) { for (let i = 0; i < (big ? 10 : 4); i++) particles.push({ x: o.x, y: o.y - 8, vx: rand(-1.6, 1.6), vy: rand(-1.6, 0.6), life: rand(8, 18), color: i % 2 ? '#ffffff' : '#ffe08a' }); }
function knockDown(W, L, decision) {
  const Fi = S.fight; Fi.winner = W; Fi.loser = L; Fi.end = 110; Fi.decision = !!decision;
  if (!decision) { L.o.down = 120; L.o.stun = 120; L.o.stunType = 'big'; sfx.oof(); }
  S.banner = { text: decision ? 'LINESMEN STEP IN' : 'DOWN HE GOES!', sub: plTagPl(W.o.pl) + ' WINS THE SCUFFLE', life: 110 };
  say(decision ? [`THE LINESMEN BREAK IT UP. ${plTagPl(W.o.pl)} GOT THE BETTER OF THAT ONE.`] : [`${plTagPl(W.o.pl)} DROPS HIM!`, 'AND THAT ONE IS OVER!'], 3);
  excite(1);
}
function finishFight() {
  if (typeof isFightDrill === 'function' && isFightDrill(S.mode)) return fightDrillDone(S.fight);
  const Fi = S.fight, r = RS(), W = Fi.winner.o, L = Fi.loser.o;
  S.fight = null;
  for (const o of [W, L]) {
    o.fight = false;
    if (o.pl) { r.out[o.pl.id] = Object.assign(r.out[o.pl.id] || {}, { game: true, ej: true }); }
  }
  pst(W.pl, W.team).fw = (pst(W.pl, W.team).fw || 0) + 1; pst(L.pl, L.team).fl = (pst(L.pl, L.team).fl || 0) + 1;
  r.ts[W.team].fights++; r.ts[L.team].fights++;
  r.fights.log.push({ w: W.pl.id, l: L.pl.id, wt: W.team, lt: L.team, p: S.period, el: Math.round(r.el) });
  r.morale[W.team].push({ v: BAL.fight.momentumMul, until: r.el + BAL.fight.momentumSec });
  maybeInjure(L, 'fight');
  rsLog(`${plTagPl(W.pl)} wins the scuffle; both players ejected`);
  if (MS.fightEvents) MS.fightEvents.push({ w: W.pl.id, l: L.pl.id }); else MS.fightEvents = [{ w: W.pl.id, l: L.pl.id }];
  S.injNote = { text: 'BOTH PLAYERS EJECTED', sub: plTagPl(W.pl) + ' & ' + plTagPl(L.pl), life: 160, team: -1 };
  const d = nearestDot(Fi.fx, Fi.fy);
  S.phase = 'live';
  whistle('EJECTED', 'BOTH BRAWLERS ARE DONE FOR THE NIGHT', () => setupFaceoff(d.x, d.y), 80);
}
// ---------- drawing: fight overlay (bars, names, keys) and the challenge question
// the controls as little key buttons floating beside the fight
function drawFightKeys(Fi) {
  const me = Fi.f.find(F => F.o.team === 0) || Fi.f[0], him = Fi.f.find(F => F !== me), o = me.o;
  const keys = [[Input.first('shoot'), 'JAB', 'BEATS DODGE', '#7ec8ff'], [Input.first('check'), 'HAYMAKER', 'BEATS JAB', '#ff6a4a'], [Input.first('deke'), 'DODGE', 'BEATS HAYMAKER', '#5ee07a']];   // (Nov 22) first key only: 'LEFT SHIFT / RIGHT SHIFT' ran out of its box
  toWorld();
  const rows = keys.map(([key, act, note, col]) => { ctx.font = (5 * CTS).toFixed(1) + "px 'PH Pixel', monospace"; const kw = Math.max(16, Math.ceil(ctx.measureText(key).width) + 6); return { key, act, note, col, kw, w: kw + 4 + Math.max(act.length * 5.4, note.length * 4.4) + 4 }; });
  const W = Math.max(...rows.map(r => r.w)), away = him && him.o.x > o.x ? -1 : 1;           // on the side away from him
  const bx = clamp(away < 0 ? o.x - 16 - W : o.x + 16, camX + 2, camX + viewW() - W - 2);
  let by = o.y - 34;
  for (const r of rows) {
    ctx.fillStyle = 'rgba(6,8,20,.85)'; ctx.fillRect(bx - 1, by - 1, W + 2, 15);
    ctx.fillStyle = r.col; ctx.fillRect(bx, by, r.kw, 13);
    ctx.fillStyle = '#0b0d1a'; ctx.fillRect(bx + 1, by + 11, r.kw - 2, 2);
    text(r.key, bx + r.kw / 2, by + 3.5, '#0b0d1a', 5, 'center', null);
    text(r.act, bx + r.kw + 4, by + 1, r.col, 5, 'left', null);
    text(r.note, bx + r.kw + 4, by + 7.5, '#9aa3c7', 4, 'left', null);
    by += 17;
  }
}
function drawFightOverlay() {
  toScreen();
  const SW = viewW(), vh = viewH();
  if (S.ask && S.ask.live) {                                     // a challenge during live play: a small banner, the game goes on
    const a = S.ask, w = Math.min(SW - 20, 230), x = (SW - w) / 2, y = HUDH + 30, k = Math.max(0, a.limit - a.t) / a.limit;
    ctx.fillStyle = 'rgba(8,10,24,.86)'; ctx.fillRect(x, y, w, 34); ctx.fillStyle = '#ff6a4a'; ctx.fillRect(x, y, w, 1);
    text(plTagPl(a.ch.pl) + ' WANTS TO GO', SW / 2, y + 4, '#ff6a4a', 6, 'center', null);
    text(Input.label('fightYes') + ' SCUFFLE AT THE WHISTLE  ·  ' + Input.label('fightNo') + ' NO', SW / 2, y + 15, '#ffd23f', 5, 'center', null);
    ctx.fillStyle = '#2a3150'; ctx.fillRect(x + 8, y + 27, w - 16, 3); ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + 8, y + 27, (w - 16) * k, 3);
  }
  if (S.phase === 'ask' && S.ask) {
    const a = S.ask, w = Math.min(SW - 20, 300), x = (SW - w) / 2, y = HUDH + vh * 0.3;
    const left = Math.max(0, (a.limit || 180) - a.t), secs = Math.ceil(left / 60), k = left / (a.limit || 180);
    ctx.fillStyle = 'rgba(8,10,24,.92)'; ctx.fillRect(x, y, w, 78); ctx.fillStyle = '#ff6a4a'; ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y + 76, w, 2);
    text('CHALLENGE!', SW / 2, y + 7, '#ff6a4a', 10, 'center');
    text(plTagPl(a.ch.pl) + ' WANTS TO GO WITH ' + plTagPl(a.target.pl), SW / 2, y + 24, '#ffffff', 6, 'center', null);
    { const msg = 'BOTH BRAWLERS ARE EJECTED. REFUSING COSTS A LITTLE MORALE.'; ctx.font = (5 * CTS).toFixed(1) + "px 'PH Pixel', monospace";
      const fits = ctx.measureText(msg).width <= w - 12;                          // (Nov 22) it ran past the box on narrow views: two lines then
      if (fits) text(msg, SW / 2, y + 36, '#9aa3c7', 5, 'center', null);
      else { text('BOTH BRAWLERS ARE EJECTED.', SW / 2, y + 33, '#9aa3c7', 5, 'center', null); text('REFUSING COSTS A LITTLE MORALE.', SW / 2, y + 40, '#9aa3c7', 5, 'center', null); } }
    text(Input.label('fightYes') + ' ACCEPT   ·   ' + Input.label('fightNo') + ' REFUSE', SW / 2, y + 50, '#ffd23f', 7, 'center', null);
    ctx.fillStyle = '#2a3150'; ctx.fillRect(x + 10, y + 64, w - 20, 5);
    ctx.fillStyle = secs <= 1 ? '#ff4a3d' : '#ffd23f'; ctx.fillRect(x + 10, y + 64, (w - 20) * k, 5);
    text(secs + 's', SW / 2, y + 63, '#ffffff', 5, 'center', null);
    return;
  }
  const Fi = S.fight; if (!Fi) return;
  const bar = (x, y, w, v, col) => { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - 1, y - 1, w + 2, 6); ctx.fillStyle = col; ctx.fillRect(x, y, Math.max(0, w * v / 100), 4); };
  // each fighter's balance and stamina float above HIM (Nov 22), so the right bars are always over the right man,
  // whichever side he ends up on; they sit above the tell bubble (which is 44 over his skates)
  toWorld();
  const wbar = (x, y, w, v, col) => { ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(x - 1, y - 1, w + 2, 4); ctx.fillStyle = col; ctx.fillRect(x, y, Math.max(0, w * v / 100), 2); };
  // (Nov 22 text pass) the two fighters stand close together: their boxes are pushed apart round the middle so they never overlap
  const xs = Fi.f.map(F => clamp(F.o.x - 22, R.l + 24, R.r - 44 - 24));
  if (xs.length === 2 && Math.abs(xs[0] - xs[1]) < 52) { const mid = (xs[0] + xs[1]) / 2 + 22, l = Fi.f[0].o.x <= Fi.f[1].o.x ? 0 : 1; xs[l] = mid - 48; xs[1 - l] = mid + 4; }
  Fi.f.forEach((F, i) => {
    const T = TEAM[F.o.team], w = 44, x = Math.round(xs[i]), y = Math.round(F.o.y) - 72;
    ctx.fillStyle = 'rgba(8,10,24,.85)'; ctx.fillRect(x - 3, y - 3, w + 6, 22); ctx.fillStyle = T.main; ctx.fillRect(x - 3, y - 3, w + 6, 1.5);
    text(plTagPl(F.o.pl), x + w / 2, y, '#ffffff', 4, 'center', null);
    wbar(x, y + 8, w, F.bal, F.bal > 35 ? '#5be37a' : '#ff6a4a');
    wbar(x, y + 13, w, F.st, '#ffd23f');
  });
  toScreen();
  { const y = HUDH + 4; text('BALANCE', 8, y, '#5be37a', 4, 'left', null); text('STAMINA', 8, y + 7, '#ffd23f', 4, 'left', null); }   // a key for the two bars
  if (Fi.human && !Fi.end) drawFightKeys(Fi);
  // his tell: a bubble over his head in the colour of the move that's coming (the same colours as your keys), with
  // its name; on Easy and in sparring a coach also calls out the answer
  if (!Fi.end) for (const F of Fi.f) {
    const tl = F.ai && F.ai.tell; if (!tl || F.o === Fi.human) continue;
    const col = tl.kind === 'jab' ? '#7ec8ff' : tl.kind === 'hay' ? '#ff6a4a' : '#5ee07a', k = 1 - tl.t / tl.T;
    toWorld();
    const bx = Math.round(F.o.x) - 5, by = Math.round(F.o.y) - 44 - (k < 0.2 ? 2 : 0);
    ctx.fillStyle = 'rgba(6,8,20,.9)'; ctx.fillRect(bx - 1, by - 1, 12, 11); ctx.fillRect(bx + 4, by + 10, 2, 2);
    ctx.fillStyle = col; ctx.fillRect(bx, by, 10, 9);
    ctx.fillStyle = '#0b0d1a';
    if (tl.kind === 'jab') { ctx.fillRect(bx + 4, by + 1, 2, 5); ctx.fillRect(bx + 4, by + 7, 2, 1); }                       // !
    else if (tl.kind === 'hay') { ctx.fillRect(bx + 2, by + 1, 2, 5); ctx.fillRect(bx + 2, by + 7, 2, 1); ctx.fillRect(bx + 6, by + 1, 2, 5); ctx.fillRect(bx + 6, by + 7, 2, 1); }   // !!
    else { ctx.fillRect(bx + 2, by + 3, 2, 1); ctx.fillRect(bx + 4, by + 4, 2, 1); ctx.fillRect(bx + 6, by + 3, 2, 1); ctx.fillRect(bx + 2, by + 5, 6, 1); }   // a duck
    const word = tl.kind === 'jab' ? 'JAB' : tl.kind === 'hay' ? 'HAYMAKER' : 'DODGE';
    const ww = word.length * 4.6 + 4; ctx.fillStyle = 'rgba(6,8,20,.85)'; ctx.fillRect(bx + 5 - ww / 2, by - 8, ww, 6.5);
    text(word, bx + 5, by - 7, col, 4, 'center', null);
    if (S.diff === 'EASY' || (S.mode && S.mode.id === 'spar')) {
      const ans = { jab: ['check', 'HAYMAKER', '#ff6a4a'], hay: ['deke', 'DODGE', '#5ee07a'], dodge: ['shoot', 'JAB', '#7ec8ff'] }[tl.kind];
      const msg = Input.label(ans[0]) + ' ' + ans[1] + '!', w = msg.length * 4.6 + 6;
      ctx.fillStyle = 'rgba(6,8,20,.9)'; ctx.fillRect(bx + 5 - w / 2, by - 19, w, 9);
      text(msg, bx + 5, by - 17.5, ans[2], 4, 'center', null);
    }
    toScreen();
  }
}

// ====================================================================
//  GRUDGES: bad blood builds between two players who keep running into each other
//  (hits, bumps, slashes, trips). It fades slowly; high enough and someone drops the gloves.
// ====================================================================
const GRUDGE = { decay: 0.00008, hot: 0.6, boil: 0.85 };   // per frame: a big hit's worth fades in about a minute
const gKey = (a, b) => a.pl.id < b.pl.id ? a.pl.id + '|' + b.pl.id : b.pl.id + '|' + a.pl.id;
function grudgeOf(a, b) { if (!MS || !MS.grudge || !a || !b || !a.pl || !b.pl) return 0; const g = MS.grudge[gKey(a, b)]; return g ? g.v : 0; }
function setGrudge(a, b, v) { if (MS && a && b && a.pl && b.pl && MS.grudge) { const g = MS.grudge[gKey(a, b)]; if (g) g.v = v; } }
function addGrudge(a, b, amt) {
  if (!MS || S.so || !a || !b || !a.pl || !b.pl || a.team === b.team || a.g || b.g) return;
  MS.grudge = MS.grudge || {};
  const k = gKey(a, b), g = MS.grudge[k] || (MS.grudge[k] = { v: 0, said: 0 });
  const hot = typeof traitMul === 'function' && (hasTrait(a.pl, 'hotheaded') || hasTrait(b.pl, 'hotheaded')) ? 1.4 : 1;
  const calm = hasTrait(a.pl, 'disciplined') && hasTrait(b.pl, 'disciplined') ? 0.6 : 1;
  g.v = Math.min(1, g.v + amt * hot * calm);
  if (g.v >= GRUDGE.hot && g.said < 1) {
    g.said = 1;
    floaters.push({ x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 40, text: 'BAD BLOOD', life: 70, color: '#ff8a5c' });
    say([`THERE'S NO LOVE LOST BETWEEN #${a.num} AND #${b.num}.`, `#${a.num} AND #${b.num} HAVE BEEN AT IT ALL NIGHT.`, 'THESE TWO KEEP FINDING EACH OTHER OUT THERE.'], 1, 0.7);
  }
}
function grudgeTick() {
  if (!MS || !MS.grudge || S.t % 60) return;
  for (const g of Object.values(MS.grudge)) g.v = Math.max(0, g.v - GRUDGE.decay * 60);
}
// at a stoppage: two players with boiling bad blood on the ice at once can go
function grudgeFaceoffFight() {
  if (!MS || !MS.grudge || S.pendingFight || S.so || S.period >= 4) return;
  let best = null, bv = GRUDGE.boil;
  for (const a of teamSkaters(0)) for (const b of teamSkaters(1)) { const v = grudgeOf(a, b); if (v > bv) { bv = v; best = [a, b]; } }
  if (!best || Math.random() > 0.4) return;
  const [a, b] = best, ct = S.autoAI ? (Math.random() < 0.5 ? 0 : 1) : 1, ch = ct === 0 ? a : b, tg = ct === 0 ? b : a;
  if (fightBlocked(ct)) return;
  S.pendingFight = { ch, target: tg };
}

// ---------- the dropped gloves and sticks on the ice
function fightGearTick() {
  for (const g of S.fightGear || []) {
    g.x += g.vx; g.y += g.vy; g.vx *= 0.965; g.vy *= 0.965; g.ang += g.spin; g.spin *= 0.97;
    if (g.x < R.l + 6 || g.x > R.r - 6) { g.vx *= -0.4; g.x = clamp(g.x, R.l + 6, R.r - 6); }
    if (g.y < R.t + 6 || g.y > R.b - 6) { g.vy *= -0.4; g.y = clamp(g.y, R.t + 6, R.b - 6); }
  }
}
function drawFightGear() {
  for (const g of S.fightGear || []) {
    const T = TEAM[g.team], G = typeof gearOf === 'function' ? gearOf(g.pl) : null;
    toWorld();
    if (g.kind === 'stick') {
      const sc = G ? gearCol(G, 'stick', T) : '#9a6a35', tc = G ? gearCol(G, 'tape', T) : '#18191f';
      const c = Math.cos(g.ang), sn = Math.sin(g.ang), L = 13;
      ctx.fillStyle = 'rgba(30,50,90,.22)'; for (let i = -L; i <= L; i += 0.8) ctx.fillRect(g.x + c * i - 0.4, g.y + sn * i + 0.9, 1.2, 0.8);
      ctx.fillStyle = sc; for (let i = -L; i <= L; i += 0.6) ctx.fillRect(g.x + c * i - 0.55, g.y + sn * i - 0.55, 1.1, 1.1);
      const bx = g.x + c * L, by = g.y + sn * L, nx = -sn, ny = c;
      ctx.fillStyle = tc; for (let i = 0; i <= 4; i += 0.6) ctx.fillRect(bx + nx * i - 0.7, by + ny * i - 0.7, 1.5, 1.5);
    } else {
      const gc = G ? gearCol(G, 'gloves', T) : T.dark;
      ctx.fillStyle = 'rgba(30,50,90,.22)'; ctx.fillRect(g.x - 2.3, g.y - 0.4, 4.6, 1.6);
      ctx.fillStyle = gc; ctx.fillRect(g.x - 2.2, g.y - 2.6, 4.4, 3); ctx.fillStyle = darker(gc, 0.25); ctx.fillRect(g.x - 2.2, g.y - 0.2, 4.4, 0.8);
    }
  }
}
