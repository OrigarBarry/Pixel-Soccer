'use strict';
// ====================================================================
//  PLAY: shot/pass timing, one-timers, tip-ins, wraparounds, handedness, puck control under pressure,
//  goalie fatigue and crease rules. All tuning values live in PLAY (debug-adjustable).
// ====================================================================
const PLAY = {
  humanReach: 9.25,
  screenBlock: 0.07,         // a shot through a screening opponent: chance he blocks it (x the Shell lever)
  screenWait: 0.45,          // an AI shooter with a defender in his lane close in front: chance he holds it / moves it instead          // your loose-puck pickup reach with the assist on (AI 8.5; any pass target 11.5)
  wristMs: 180,            // release SHOOT within this = quick wrist shot; longer holds charge
  wristPower: 0.42,        // power of a wrist shot (0..1 of the charge scale)
  passFullMs: 600,         // holding PASS this long = maximum pass power
  passTapMs: 110,          // presses shorter than this are normal passes
  passBoost: 0.6,          // extra speed at full pass charge (fraction)
  otAntiMs: 340,           // anticipated one-timer: SHOOT pressed up to this long BEFORE the pass arrives
  otAntiEasyMs: 460,       // ...more forgiving on Easy
  otReactMs: 300,          // reactive one-timer: SHOOT pressed up to this long AFTER receiving
  otReactHardMs: 150,      // ...a shorter window on Hard
  // ONE PRESS per pass: a second press while it travels, or a press before the window, uses up the chance
  otAntiAcc: 0.92,         // spray multiplier (lower = more accurate)
  otReactAcc: 1.25,
  otOffWingAcc: 0.88,      // one-timer from the off wing (right shot on the left side, etc.)
  backhandAcc: 1.22, backhandPow: 0.86,
  tipReach: 8.5,
  passPowCut: 0.28,
  otSetMul: 1.2,
  rcvReach: 26,
  stallT: 45, stallPoke: 3.0, stallSteal: 0.22,   // vs a carrier standing still: pokes come ~3x as often and succeed 22 points more often (a deke still beats them)
  windPoke: 11, windCheck: 10,   // frames of visible wind-up before the CPU pokes / checks YOUR carrier (deke during it = a perfect read)
  zoneDepthMax: 108,         // with the puck in the attacking zone, teammates stay at least this close to the goal line (the blue line is 135 out)
  ownSave: 0.999,            // a goalie stops pucks sent at his net by his own skaters this often
  gPuckMove: 0.32,           // how fast a goalie holding the puck can skate out (fraction of his normal speed)
  behindAccident: 0.03,      // a front/side check that slides behind the target still connects (and is a penalty) only this often
  bodyBlockD: 0.30, bodyBlockF: 0.19, bodyBlockNet: 0.08,   // a body in the shooting lane: defencemen / forwards, + in front of own net
  blockBase: 0.42, cutBase: 0.55,  // shot blocks / pass interceptions: base chance at low puck speed (falls with speed)
  tipBase: 0.40, tipWindowMs: 230, tipSavePen: 0.18,   // tip-ins: base chance, your timing window, how much harder it is to save
  wrapBase: 0.34,
  turnFumble: 0.055,       // fumble chance per radian of sharp turning with a defender close (average hands)
  gFatigueSave: 3.2,       // goalie stamina lost per hard save
  gFatigueQuick: 2.4,      // ...extra when chances come in quick succession
  gRestoreStop: 12, gRestoreInter: 45,
  creaseBeatDist: 13,      // a goalie further than this from the puck can be beaten by a puck carried in
};

// ---------- interactive faceoffs (timing in ms; frames are 60/s)
// hidden referee drop styles: hand height and how fast the puck falls change when it lands (by a few hundredths of a second)
const FO_DROPS = [{ h: 12, g: 3 }, { h: 14, g: 3.5 }, { h: 10, g: 2.5 }, { h: 15, g: 3 }, { h: 11, g: 3.7 }, { h: 13, g: 2.6 }];
// pivot: double-tap (within this many ms) the direction you are backing toward; the turn costs a few frames of speed
const PIVOT = { doubleMs: 300, slow: 6 };
const FO = {
  readyT: 112,              // the referee asks "READY?" (a speech bubble) about a second before he raises the puck
  cueT: 56,                 // the referee is set (puck up) for the last 56 frames of the countdown
  dropMinT: 2, dropMaxT: 10,  beat: 22,   // whistle countdown: pip at drop+44, pip at drop+22 frames, then the drop
  resolveT: 20,             // the draw is decided ~1/3 s after the drop (sooner once you press)
  lateMs: 340,
  winBase: 62, winPerPt: 12,// timing window: 74 ms (Faceoff 1) .. 182 ms (Faceoff 10)  (Nov 21: ~12% tighter)
  perfectMs: 25,
  attrW: 0.02, timeW: 0.42, noise: 0.04,   // Nov 21: feel (timing) counts for more, the centres' Faceoff rating for less
  // Nov 21 (grades): PERFECT / GREAT / GOOD / OFF up to these ms from the drop, then EARLY/LATE; JUMPED = way early
  gradeMs: [25, 50, 85, 140], jumpMs: 220,
  betterWin: 0.9, closerWin: 0.65, blownWin: 0.03,
  // the computer's grade mix [PERFECT, GREAT, GOOD, OFF, EARLY/LATE] by its centre's Faceoff rating (blended between rows)
  cpuMix: [[2, [3, 10, 32, 32, 23]], [5, [6, 16, 36, 27, 15]], [7.5, [10, 22, 36, 22, 10]], [9.5, [13, 25, 36, 19, 7]]],
  diffShift: { HARD: 0, NORMAL: 1.5, EASY: 3 },
  edge: 0.30,               // the better-timed draw (GOOD or better) is at least 50% + up to this much, by the margin
  nailP: 0.86,              // a PERFECT against anything less wins at least this often
  reasonableQ: 0.25, minWin: 0.10,
  aiSd: { EASY: 150, NORMAL: 105, HARD: 75 }, aiBias: 18,
};

// ---------- handedness: 'L' carries the puck on his left, 'R' on his right
const handOf = p => (p && p.rpHand && (p.ghost || S.screen === 'replay') ? p.rpHand : null) || (p && p.pl && p.pl.hand) || (p && p.hand) || 'L';   // (a replay knows who shoots which way)
const handSign = p => handOf(p) === 'R' ? 1 : -1;          // +1 = stick on the skater's right
// is this skater on his off wing (a right shot on the left side of the ice, as he attacks)?
function offWing(p) {
  const leftSide = ((p.x - CX) * (-attackDir(p.team))) < -12, rightSide = ((p.x - CX) * (-attackDir(p.team))) > 12;
  return (handOf(p) === 'R' && leftSide) || (handOf(p) === 'L' && rightSide);
}
// a shot toward the non-stick side of the body is a backhand
// (judged against the way he is skating when he is moving, since a quick release gives no time to turn; a clear
// cross-body angle is needed, not just a shot a little to the other side of the net)
// how much a backhand costs in accuracy: soft hands (stickhandling) and passing touch shrink it a lot
const backhandMul = p => 1 + Math.max(0.06, 0.52 - A(p, 'stk') * 0.032 - A(p, 'pas') * 0.012);
function isBackhand(p, ang) {
  const sp = hyp(p.vx || 0, p.vy || 0), bx = sp > 1.1 ? p.vx / sp : p.fx, by = sp > 1.1 ? p.vy / sp : p.fy;
  const lat = Math.cos(ang) * -by + Math.sin(ang) * bx;          // + = toward his right
  return lat * handSign(p) < -0.6;
}

// ---------- one-timer timing (human): returns the window in ms
const otAntiWindow = () => S.diff === 'EASY' ? PLAY.otAntiEasyMs : PLAY.otAntiMs;
const reactiveAllowed = () => true;
const otReactWindow = () => S.diff === 'HARD' ? PLAY.otReactHardMs : PLAY.otReactMs;

// ---------- pass reception: hard passes are harder to handle
// 0..1: how hard a pass on its way is to handle: full power over a long distance, worse when the passer is
// not a great passer and a good defender is in the lane; the receiver's hands help (used for catching and one-timers)
function passHardness(p) {
  const pw = clamp(((puck.passPow || 0) - 0.55) / 0.45, 0, 1), far = clamp(((puck.passD || 0) - 70) / 130, 0, 1);
  if (!pw || !far) return 0;
  const passer = puck.passFrom ? A(puck.passFrom, 'pas') : 5, recv = p ? A(p, 'stk') * 0.6 + A(p, 'pas') * 0.4 : 5;
  return clamp(pw * far * (1 - (passer - 5) * 0.06 - (recv - 5) * 0.06 + Math.max(0, (puck.laneDef || 0) - 4) * 0.06 + (puck.laneDef ? 0.1 : 0)), 0, 1);
}
function receiveChance(p, sp) {
  const hard = passHardness(p);
  if (sp < 6.2) return clamp(1 - hard * 0.22, 0.6, 1);
  // a receiver who is set for it (squared up, stick ready) handles hard passes much better
  const set = (p.rcvSet || 0) > 4 ? 0.26 : 0;
  return clamp(1 - (sp - 6.2) * 0.2 - hard * 0.25 + set + (A(p, 'stk') - 5) * 0.035 + (A(p, 'pas') - 5) * 0.015, 0.4, 1);
}
// where a pass on its way will pass closest to this skater (the spot to get to), and how soon
function passMeetPoint(p) {
  const vx = puck.vx, vy = puck.vy, v2 = vx * vx + vy * vy; if (v2 < 0.05) return { x: puck.x, y: puck.y, t: 0 };
  const t = clamp(((p.x - puck.x) * vx + (p.y - puck.y) * vy) / v2, 0, 60);
  return { x: puck.x + vx * t, y: puck.y + vy * t, t };
}

// ---------- TIP-INS: a teammate along the path of a shot can redirect it
function tipCheck() {
  const sh = puck.shot; if (!sh || sh.done || puck.owner || puck.inNet || puck.air) return false;
  if (!puck.shooter || S.phase !== 'live') return false;
  const team = puck.shooter.team, gy = oppGoalY(team);
  if (Math.abs(puck.y - gy) > 80) return false;
  puck.tipTried = puck.tipTried || new Set();
  const now = performance.now();
  for (const p of skaters) {
    if (p.team !== team || p === puck.shooter || p.stun > 0 || puck.tipTried.has(p.id)) continue;
    const st = stickPoint(p, 6), d = hyp(puck.x - st.x, puck.y - st.y);
    if (d > PLAY.tipReach) continue;
    puck.tipTried.add(p.id);
    const human = p === ctrl && !S.autoAI;
    let q = PLAY.tipBase + (A(p, 'stk') - 5) * 0.03 + (A(p, 'acc') - 5) * 0.02 - d * 0.02;
    if (human) { const dt = now - (p.tipAt || -1e9); if (dt > PLAY.tipWindowMs) continue; q += 0.12 - dt / PLAY.tipWindowMs * 0.12; }
    const defClose = teamSkaters(1 - team).filter(o => o.stun <= 0 && dist(o, p) < 11);
    if (defClose.length) q -= 0.18 + Math.max(0, ...defClose.map(o => (A(o, 'def') - 5) * 0.03));
    if ((p.tiedT || 0) > S.t) q -= 0.4;                                   // his stick is tied up
    if (typeof hasTrait === 'function' && p.pl && hasTrait(p.pl, 'rebound_hunter')) q += 0.08;
    if (Math.random() >= clamp(q, 0.05, 0.85)) continue;
    redirect(p, gy);
    return true;
  }
  return false;
}
function redirect(p, gy) {
  const sp = hyp(puck.vx, puck.vy) * 0.82, g = gk(1 - p.team);
  const zone = Math.random() < 0.65 ? 'low' : 'high';
  const off = g.x - CX, open = off > 1.5 ? -1 : off < -1.5 ? 1 : (Math.random() < 0.5 ? 1 : -1);
  let ax = CX + open * rand(3 * RINK_S, GOAL_HW - 2 * RINK_S) + gauss() * (2.8 - A(p, 'acc') * 0.15) * RINK_S;
  const ah = zone === 'high' ? rand(0.55, 1.05) : rand(0.05, 0.35);
  const offc = Math.abs(ax - CX);
  let cat = 'net';
  if (ah > 1.0) cat = 'bar'; else if (offc > GOAL_HW + 1.4 * RINK_S) cat = 'wide'; else if (offc > GOAL_HW - 1 * RINK_S) { cat = 'post'; ax = CX + Math.sign(ax - CX) * (GOAL_HW + 0.3); }
  const ang = Math.atan2(gy - puck.y, ax - puck.x);
  const from = puck.shooter;
  puck.vx = Math.cos(ang) * sp; puck.vy = Math.sin(ang) * sp;
  puck.shot = { zone, h: ah, cat, gy, d0: Math.max(10, Math.abs(gy - puck.y)), done: false };
  puck.tipFrom = from; puck.shooter = p; puck.shooterPl = p.pl; puck.lastTouch = p; puck.tipT = S.t;
  puck.passed.clear();
  if (MS && p.pl && from && from.pl && from.team === p.team) {   // the original shooter is credited with the assist via the chain
    const c = MS.chain; if (c.team !== p.team) { c.team = p.team; c.pids = []; }
    if (c.pids[c.pids.length - 1] !== from.pl.id) c.pids.push(from.pl.id);
    c.pids.push(p.pl.id);
  }
  floaters.push({ x: p.x, y: p.y - 30, text: 'TIP!', life: 40, color: '#9fd0ff' });
  S.lastShot = Object.assign({}, S.lastShot || {}, { t: S.t, team: p.team, tip: true });   // the goal call and the highlight say TIP-IN
  sfx.stick(); excite(0.5);
  say(['TIPPED!', 'A DEFLECTION IN FRONT!', 'HE GETS A BOOT ON IT!'], 1, 0.6);
}

// ---------- WRAPAROUNDS: from behind the net, around the post
function wrapPosition(p) {
  const t = p.team, gy = oppGoalY(t), up = attackDir(t);
  const behind = (p.y - gy) * up;               // > 0 behind the goal line
  const ax = Math.abs(p.x - CX);
  return behind > -2 && behind < 22 && ax > GOAL_HW - 6 && ax < GOAL_HW + 22;
}
function tryWrap(p) {
  if (!hasPuck(p) || !wrapPosition(p)) return false;
  const t = p.team, gy = oppGoalY(t), up = attackDir(t), s = Math.sign(p.x - CX) || 1;
  const g = goalies[1 - t];
  const postX = CX + s * (GOAL_HW - 2);
  // forehand: the post side matches the stick side as he comes around
  const r = rightOf(p), toPost = ((postX - p.x) * r.x + (gy - up * 3 - p.y) * r.y) * handSign(p) > 0;
  let q = PLAY.wrapBase + (A(p, 'stk') - 5) * 0.04 + (A(p, 'spd') - 5) * 0.015 + (toPost ? 0.06 : -0.05);
  if (!g) q = 0.92;
  else {
    const seal = Math.abs(g.x - postX);
    q += seal > 9 ? 0.3 : seal > 5 ? 0.12 : -0.05;
    if (g.down > 0 || g.gLunge > 0) q += 0.25;
    q -= (A(g, 'pos') - 5) * 0.03 + (A(g, 'rec') - 5) * 0.015;
  }
  q = clamp(q, 0.05, 0.9);
  const goal = Math.random() < q;
  // the shot is taken from the front of the post
  const dg = shotDanger(p, 0.3);
  if (MS && p.pl && !S.so) { const st = pst(p.pl, t); st.xg += dg.xg * XG_CAL; if (dg.xg >= XG_HD) st.hd++; }
  const fromX = CX + s * (GOAL_HW + 1), fromY = gy - up * 3;
  releasePuck(p, 0, 0, 20);
  puck.x = fromX; puck.y = fromY; puck.shooter = p; puck.shooterPl = p.pl; puck.shotT = S.t; puck.xg = dg.xg; puck.xgOn = dg.xgOn; puck.shotTeam = t;
  S.lastShot = { zone: 'low', t: S.t, team: t, oneT: false, reb: false, pen: S.phase === 'penalty', wrap: true };
  floaters.push({ x: p.x, y: p.y - 30, text: 'NEAR-POST POKE!', life: 45, color: '#9fd0ff' });
  if (goal) {
    puck.shot = null; if (g) puck.passed.add(g.id);
    puck.vx = -s * 1.4; puck.vy = up * 1.6;                     // slides in past the post
  } else if (g) {
    puck.shot = null; S.sog[t]++; statShotSaved(g);
    if (Math.random() < 0.55) { puck.owner = g; g.hold = 55; g.gpT = 0; g.gCharge = null; g.gAim = null; puck.vx = puck.vy = 0; puck.lastTouch = g; statPossess(g); }
    else { puck.vx = -s * 1.2 + rand(-0.6, 0.6); puck.vy = -up * rand(1, 2); puck.lastTouch = g; puck.reboundT = S.t; }
    floaters.push({ x: g.x, y: g.y - 32, text: 'SEALS THE POST!', life: 45, color: '#ffffff' });
    say(['THE KEEPER SEALS THE POST!', 'NOWHERE TO GO ON THE NEAR-POST POKE!'], 1, 0.6); sfx.save();
  }
  sfx.shot(0.3); excite(0.5);
  p.charge = -1;
  return true;
}

// ---------- puck control: sharp turns with a defender close can cost the carrier the puck
function turnFumble(p) {
  if (!hasPuck(p) || p.g || S.phase !== 'live') { p.turnRisk = 0; return; }
  const sp = hyp(p.vx, p.vy), lsp = hyp(p.lastVx || 0, p.lastVy || 0);
  if (sp < 1.1 || lsp < 1.1) { p.turnRisk = 0; return; }
  const turn = Math.abs(angDiff(Math.atan2(p.vy, p.vx), Math.atan2(p.lastVy, p.lastVx)));
  if (turn < 0.05) { p.turnRisk = Math.max(0, (p.turnRisk || 0) - 1); return; }
  let nd = 1e9; for (const o of teamSkaters(1 - p.team)) if (o.stun <= 0) nd = Math.min(nd, dist(o, p));
  if (nd > 20) return;
  p.turnRisk = 10;
  const hands = clamp(1 - (A(p, 'stk') - 1) / 12, 0.2, 1), press = 1 - nd / 22;
  if (Math.random() < turn * PLAY.turnFumble * hands * press * (sp / Math.max(1, baseSpeed(p)))) {
    releasePuck(p, p.vx * 0.5 + rand(-1, 1), p.vy * 0.5 + rand(-1, 1), 18);
    p.slow = 14;
    floaters.push({ x: p.x, y: p.y - 30, text: 'BOBBLED!', life: 35, color: '#ff7a6e' });
    if (MS && p.pl) pst(p.pl, p.team).gv++;
  }
}

// ---------- goalie fatigue: hard saves and sustained pressure wear him down; stoppages help
const gStam = g => g && g.pl && MS ? (MS.stam[g.pl.id] ?? 100) : 100;
const gFat = g => 1 - gStam(g) / 100;                    // 0 fresh .. 1 spent
function goalieWork(g, sp) {
  if (!g || !g.pl || !MS) return;
  const quick = S.t - (g.lastSaveT || -999) < 150;
  g.lastSaveT = S.t;
  const loss = (sp > 5.4 ? PLAY.gFatigueSave : PLAY.gFatigueSave * 0.55) + (quick ? PLAY.gFatigueQuick : 0);
  MS.stam[g.pl.id] = clamp(gStam(g) - loss * (1.45 - A(g, 'sta') * 0.09) * (typeof traitMul === 'function' ? traitMul(g.pl, 'drainMul') : 1), 10, 100);
}
function goalieRest(amount) {
  if (!MS) return;
  for (const t of [0, 1]) { const g = goalies[t]; if (g && g.pl) MS.stam[g.pl.id] = clamp(gStam(g) + amount, 0, 100); }
}

// ---------- crease: a carrier skating the puck in only scores if the goalie is beaten
function creaseStop(o, n) {
  const g = goalies[n.team];
  if (!g || g.ghost) return false;                                  // empty net: in it goes
  const beaten = Math.abs(g.x - puck.x) > PLAY.creaseBeatDist || (g.down > 0 && Math.abs(g.x - puck.x) > 7) || g.stun > 0;
  if (beaten) return false;
  // the goalie stops it at the line
  releasePuck(o, 0, 0, 24);
  puck.x = clamp(puck.x, CX - GOAL_HW + 2, CX + GOAL_HW - 2); puck.y = n.lineY + n.front * 4;
  if (Math.random() < 0.6) { puck.owner = g; g.hold = 55; g.gpT = 0; g.gCharge = null; g.gAim = null; puck.lastTouch = g; statPossess(g); }
  else { puck.vx = rand(-1.5, 1.5); puck.vy = n.front * 1.4; puck.lastTouch = g; }
  o.vx *= 0.3; o.vy *= 0.3; o.slow = 18;
  floaters.push({ x: g.x, y: g.y - 30, text: 'STOPPED AT THE LINE', life: 40, color: '#ffffff' });
  sfx.save();
  return true;
}

// ---------- shot set-up and goalie pressure (both kept small and capped)
// Moving the puck side to side (a cross pass, a lateral carry, a deke) right before the shot makes the goalie
// late across: he steers a little slower while the puck is moving sideways near him, and the shot gets a small bonus.
const SETUP = { hist: [], dekeT: [-999, -999], latV: 0, maxBonus: 0.08, pressMax: 0.06 };
function setupTick() {
  if (S.phase !== 'live') { SETUP.hist.length = 0; SETUP.latV *= 0.8; return; }
  SETUP.hist.push(puck.x); if (SETUP.hist.length > 36) SETUP.hist.shift();
  SETUP.latV += (Math.abs(puck.vx) - SETUP.latV) * 0.15;
  // pressure on each goalie: cleared from the zone, possession for his team, or a stoppage ends it
  for (const g of goalies) if (g && g.press) {
    const own = puck.owner && puck.owner.team === g.team;
    if (own || Math.abs(puck.y - ownGoalY(g.team)) > 165) g.press = 0;
  }
}
function setupScore(p) {
  const h = SETUP.hist; if (h.length < 6) return 0;
  let lo = 1e9, hi = -1e9; for (const x of h) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
  let s = clamp((hi - lo - 18) / 70, 0, 1);                               // 18+ units of sideways puck movement starts to count
  if (S.t - SETUP.dekeT[p.team] < 40) s += 0.35;
  return clamp(s, 0, 1);
}
// how much slower the goalie can track while the puck moves sideways near his net (0..0.35)
function goalieLag(g) { return Math.abs(puck.y - ownGoalY(g.team)) < 140 ? Math.min(0.35, SETUP.latV / 5 * 0.35) : 0; }
// a quality chance (a good shot or a rebound) leaves the goalie scrambling until the play is cleared
function addPressure(g, xg, reb) { if (!g || g.ghost) return; if (xg >= 0.12 || reb) g.press = Math.min(1, (g.press || 0) + (reb ? 0.35 : 0.25) * (g.crashNear || 1)); }
