'use strict';
// ====================================================================
//  TACTICS: team strategies for three-skater hockey (plus power play / penalty kill shapes),
//  and the positional AI that carries them out. teamPlan(t) returns a target for every AI skater.
//  Each line has its own strategy; special-teams tactics take over during power plays and penalty kills.
//  Users may change tactics before a game and at intermissions only.
// ====================================================================
const STRATEGIES = {
  balanced:  { name: 'Balanced', short: 'BAL', strength: 'Reliable in most situations.', weakness: 'No specialised offensive or defensive edge.',
               desc: 'Support the ball, cover sensibly, moderate pressure. The closest player challenges; the others protect dangerous pitch.',
               press: 1.0, chaseR: 150, highSafety: true },
  forecheck: { name: 'Aggressive Press', short: 'FCK', strength: 'Forces turnovers: pokes in their end knock it loose far more often.', weakness: 'Quick passes and clean breakouts beat it.',
               desc: 'When they have it deep in their own half, two players pressure the carrier and his outlet while the third stays high to stop breakouts.',
               press: 1.35, chaseR: 220, highSafety: true },
  shell:     { name: 'Defensive Shell', short: 'SHL', strength: 'Screens the shooting lanes: more of their shots get blocked; hits by its own net jar the ball loose.', weakness: 'Gives up time and space on the perimeter.',
               desc: 'A triangle in its own end: a net guard in front of the keeper, a lane man in the top of the box, and a presser who steers the carrier wide, then squeezes him against the touchline once he sits on it or comes into the box.',
               press: 0.7, chaseR: 115, highSafety: true },
  counter:   { name: 'Counterattack', short: 'CTR', strength: 'Right after a takeaway: stretch passes are taken cleanly, shots are sharper, a forward leaks out.', weakness: 'Exposed if the transition fails.',
               desc: 'Read passing lanes for interceptions, then break out fast: quick outlets, one player leaking into open pitch.',
               press: 0.95, chaseR: 140, highSafety: false },
  crash:     { name: 'Crash the Box', short: 'CRS', strength: 'Two or more at the six-yard box rattle the keeper fast (watch him sweat).', weakness: 'Less perimeter support; counterattacks hurt.',
               desc: 'One player carries or distributes; the other two drive to the box and six-yard box to screen and hunt rebounds.',
               press: 1.1, chaseR: 160, highSafety: false },
  splitlanes:{ name: 'Split Lanes', short: 'SPL', strength: 'Cuts the passing game: their first-time shots lose their sting and passes get picked off, most of all once they settle in and cycle.', weakness: 'The carrier gets time to walk in and shoot himself; quick rushes get past it.',
               desc: 'Split the pitch in two and take away the passes between the halves: one player angles the carrier to the outside, one sits in the box on the passing line with his boot down, one locks the far post and the man drifting in at the back post.',
               press: 0.82, chaseR: 122, highSafety: true },
  trap:      { name: 'Midfield Trap', short: 'TRP', strength: 'Owns midfield: passes through it get picked off, stretch passes die, and carriers get stood up at the halfway line.', weakness: 'A team that gets the ball in deep and cycles it pulls the trap apart.',
               desc: 'A 1-2-2 from their halfway line to ours: one forward steers the carrier to the hoardings, two wait across our halfway line and step up on him as he arrives. Nobody chases into their end.',
               press: 0.9, chaseR: 130, highSafety: true },
};
// ONE MEASURABLE LEVER PER STRATEGY (even strength only). Each one changes a single, countable thing:
//   forecheck  pokes in the other team's end knock it loose more often (takeaways)
//   shell      a wider screen in the shooting lanes and more blocked shots; hits around its own net jar it loose
//   counter    right after a takeaway: long stretch passes are taken cleanly, shots are more accurate, a forward leaks out
//   crash      two or more at the net rattle the goalie faster (the pressure he plays under builds 50% quicker)
//   splitlanes their one-timers are worse and passes get picked off (more so against a settled, cycling team)
//   trap       midfield: passes there picked off, stretch passes die, carriers stood up at our blue line
//   weakside   passes against are picked off more often (interceptions)
// SYSTEM EDGE: a team playing a coherent system beats one playing none. Each strategy's skaters execute a touch
// better at even strength (attribute points, tuned so every strategy wins about 55% against Balanced)
const STRAT_EDGE = { balanced: 0, forecheck: 0.18, shell: 0.53, counter: 0.36, crash: 0.3, splitlanes: 0.3, trap: 0.3 };
// MATCHUPS: on top of that, each pairing gets a small push so the counters land where they were designed
// (good matchup ~56.5%, bad ~43.5%, the rest even; Balanced is the SAFE pick: every strategy beats it only ~52%, so a
// specialist is a bet on reading the other bench and Balanced is the insurance):
//   Forecheck beats Shell and Crash (hounds a cycling team before it settles); loses to Counter and Trap
//   Counter beats Forecheck (stretches the ice behind it) and Split Lanes; loses to Shell and Trap
//   Shell beats Counter (rushed shots die in its lanes) and Trap; loses to Forecheck and Crash
//   Crash beats Shell (two men on one net guard) and Trap; loses to Forecheck and Split Lanes
//   Split Lanes beats Crash (cuts the cycle's passes) and Trap; loses to Counter
//   Trap beats Counter (no room to stretch) and Forecheck; loses to Shell, Crash and Split Lanes
const MATCH_ADJ = {
  balanced: { forecheck: 0.471, shell: 0.107, counter: -0.530, crash: 0.926, splitlanes: -0.477, trap: 0.004 },
  forecheck: { balanced: -0.471, shell: -0.020, counter: -0.980, crash: 0.632, splitlanes: -0.738, trap: -0.592 },
  shell: { balanced: -0.107, forecheck: 0.020, counter: -1.552, crash: 0.412, splitlanes: -0.358, trap: -0.301 },
  counter: { balanced: 0.530, forecheck: 0.980, shell: 1.552, crash: 1.758, splitlanes: 0.799, trap: 0.013 },
  crash: { balanced: -0.926, forecheck: -0.632, shell: -0.412, counter: -1.758, splitlanes: -1.286, trap: -0.863 },
  splitlanes: { balanced: 0.477, forecheck: 0.738, shell: 0.358, counter: -0.799, crash: 1.286, trap: 0.621 },
  trap: { balanced: -0.004, forecheck: 0.592, shell: 0.301, counter: -0.013, crash: 0.863, splitlanes: -0.621 },
};
function stratEdge(t) {
  if (!S.match || !S.match.tac) return 0;
  const A_ = activeTactic(t); if (A_.sit !== 'even') return 0;
  const B_ = activeTactic(1 - t), m = MATCH_ADJ[A_.key];
  return (STRAT_EDGE[A_.key] || 0) + (m && B_.sit === 'even' ? (m[B_.key] || 0) : 0);
}
const LEVERS = {
  forecheck: { ozSteal: 1.6, ozPress: 1.5, vsCycle: 1.3 },
  shell:     { screenR: 1.0, blockP: 0.55, slotHit: 0.6, boxOut: 0.35, slotCut: 1.6, vsRushBlock: 1.8 },
  counter:   { stretch: 0.35, transAcc: 0.85, leak: 50, deepStretch: 0.5, deepAcc: 0.88 },
  crash:     { pressMul: 1.6, crashPress: 0.005, vsLone: 1.5 },
  splitlanes:{ oneTAgainst: 0.7, cutPass: 1.25, cutReach: 1.2, vsCycleCut: 1.35 },
  trap:      { nzCut: 1.6, standUp: 1.6, killStretch: 1 },
};
// the opponent screening this shooter: standing in the lane between him and the net (nearest to him), if any
function screenOf(p) {
  const R = RK(20) * lever(1 - p.team, 'screenR'), gy = oppGoalY(p.team), lx = CX - p.x, ly = gy - p.y, L = hyp(lx, ly) || 1;
  if (L < RK(40)) return null;
  let best = null;
  for (const o of skaters) {
    if (o.team === p.team || o.g || o.stun > 0) continue;
    const ax = o.x - p.x, ay = o.y - p.y, along = (ax * lx + ay * ly) / L, off = Math.abs(ax * ly - ay * lx) / L;
    if (along < 12 || along > L - 8 || off > R) continue;
    if (!best || along < best.along) best = { o, off, along, R };
  }
  return best;
}
function lever(t, k, dflt = 1) {
  if (!S.match || t == null || t < 0) return dflt;
  const A_ = activeTactic(t); if (A_.sit !== 'even') return dflt;
  const L = LEVERS[A_.key]; return L && L[k] != null ? L[k] : dflt;
}
const PP_TACTICS = {
  umbrella: { name: 'Umbrella', desc: 'One at the edge of the box, two out wide and one in front of goal: move it around the perimeter, find the first-time shot.' },
  overload: { name: 'Overload', desc: 'Stack one side and the net front; quick plays down low for tips and rebounds.' },
};
const PK_TACTICS = {
  box:        { name: 'Passive Box', desc: 'Protect the box and passing lanes; pressure only near the net; clear it whenever possible.' },
  aggressive: { name: 'Aggressive', desc: 'Pressure the ball carrier and his outlet; risky, but wins the ball high and creates counter-attacks even when a man down.' },
};
// tuning for defender decisions (debug-adjustable)
const TAC_BAL = { pokeCap: 0.022, checkCap: 0.02, checkBase: 0.3, checkReach: 16, circleHold: 420, tellCheck: 2.6 };
const DEFAULT_TAC = () => ({ lines: ['balanced', 'balanced', 'balanced'], tempo: ['mixed', 'mixed', 'mixed'], pp: 'umbrella', pk: 'box' });
// TEMPO (per line): how long a line holds the puck in the attacking zone
const TEMPOS = {
  rush:  { name: 'Rush', short: 'RSH', desc: 'Attack fast: shoot early, hunt counter-attacks. More shots, more chances against.',
           plain: 'Go straight at the net the moment you get the ball. Shoot early and look for 2-on-1s. More shots for you, but more chances against too.' },
  mixed: { name: 'Mixed', short: 'MIX', desc: 'Take the rush when it is there; otherwise settle in and work it.',
           plain: 'Attack fast when there is open pitch; if not, slow down and set up in their end. A safe middle ground.' },
  cycle: { name: 'Possession', short: 'POS', desc: 'Hold it, move it, wait for a good look: low cycles, give-and-gos, back doors, point shots through a screen.',
           plain: 'Get the ball deep and keep it: pass it around the corners and the hoardings until a good shot opens up. Fewer shots but better ones, and it tires their defenders.' },
};
const STRAT_KEYS = Object.keys(STRATEGIES);
function validTac(tac) {
  const d = DEFAULT_TAC(); if (!tac) return d;
  const mig = k => k === 'lanes' || k === 'weakside' ? 'splitlanes' : k;      // old saves: Lane Denial and Weak-Side Lock became Split Lanes
  const out = { lines: [0, 1, 2].map(i => STRATEGIES[mig((tac.lines || [])[i])] ? mig(tac.lines[i]) : 'balanced'), tempo: [0, 1, 2].map(i => TEMPOS[(tac.tempo || [])[i]] ? tac.tempo[i] : 'mixed'), pp: PP_TACTICS[tac.pp] ? tac.pp : d.pp, pk: PK_TACTICS[tac.pk] ? tac.pk : d.pk };
  const f = validForm(tac.form); if (f) out.form = f;
  return out;
}

// ====================================================================
//  FORMATIONS: where the skaters set up in the attacking zone (with the puck) and in their own zone (defending).
//  A formation is a list of dots in zone coordinates: x -1..1 across the ice, +1 = the PUCK's side (it mirrors when the
//  puck crosses the middle); y = depth from the goal line, 0 = goal line .. 1 = blue line (up to 1.4 = just outside).
//  The tactic still decides attitude (pressure, pinching, crashing); the formation is the shape they hold.
//  Each line has an attack and a defend formation; the power play has a 4-man attack shape, the penalty kill a
//  3-man defend shape. A team that hasn't drawn its own uses the preset of its tactic (the CPU always does).
// ====================================================================
const FORM_PRESETS = {
  balanced:  { att: [[0.68, 0.5], [-0.42, 0.86], [0, 0.24]],  def: [[0.62, 0.48], [0, 0.26], [-0.4, 0.72]] },
  forecheck: { att: [[0.68, 0.5], [-0.42, 0.86], [0.05, 0.22]], def: [[0.62, 0.5], [0.05, 0.28], [-0.42, 0.62]] },
  shell:     { att: [[0.62, 0.5], [-0.35, 0.7], [0.05, 0.16]],  def: [[0.55, 0.5], [0.05, 0.36], [0, 0.12]] },   // defend: presser side, lane man in the slot, net guard
  counter:   { att: [[0.68, 0.5], [-0.35, 0.9], [0, 1.3]],      def: [[0.62, 0.48], [0.05, 0.3], [-0.35, 1.2]] },
  crash:     { att: [[0.6, 0.5], [-0.08, 0.14], [-0.55, 0.32]], def: [[0.62, 0.48], [0, 0.26], [-0.4, 0.72]] },
  splitlanes:{ att: [[0.68, 0.5], [-0.42, 0.86], [0, 0.24]],  def: [[0.62, 0.44], [0.12, 0.34], [-0.28, 0.12]] },
  trap:      { att: [[0.68, 0.5], [-0.42, 0.86], [0, 0.24]],  def: [[0.62, 0.48], [0, 0.26], [-0.4, 0.72]] },
};
const PP_FORM_PRESETS = { umbrella: [[0, 0.92], [0.78, 0.5], [-0.78, 0.5], [0, 0.12]], overload: [[0.08, 0.12], [0.75, 0.28], [0.42, 0.78], [-0.55, 0.45]] };
const PK_FORM_PRESETS = { box: [[0.5, 0.58], [-0.42, 0.55], [0.08, 0.2]], aggressive: [[0.62, 0.62], [-0.25, 0.62], [0.12, 0.25]] };
const FORM_N = { att: 3, def: 3, pp: 4, pk: 3 };
function validDots(a, n) {
  if (!Array.isArray(a) || a.length !== n) return null;
  const out = a.map(d => Array.isArray(d) && isFinite(d[0]) && isFinite(d[1]) ? [clamp(+d[0], -1, 1), clamp(+d[1], 0, 1.4)] : null);
  return out.every(Boolean) ? out : null;
}
function validForm(f) {
  if (!f || typeof f !== 'object') return null;
  const lines = [0, 1, 2].map(i => { const L = (f.lines || [])[i] || {}; return { att: validDots(L.att, 3), def: validDots(L.def, 3) }; });
  const out = { lines, pp: validDots(f.pp, 4), pk: validDots(f.pk, 3) };
  return lines.some(L => L.att || L.def) || out.pp || out.pk ? out : null;
}
// the dots a team plays right now: kind 'att' or 'def' (power play / penalty kill pick their own)
function formFor(tc, kind, lineIdx, sit, key) {
  const f = null;                 // (Nov 22) custom formations were folded into the strategies: every team plays the strategy's own shape
  if (sit === 'pp') return kind === 'att' ? ((f && f.pp) || PP_FORM_PRESETS[key] || PP_FORM_PRESETS.umbrella) : null;
  if (sit === 'pk') return kind === 'def' ? ((f && f.pk) || PK_FORM_PRESETS[key] || PK_FORM_PRESETS.box) : null;
  const own = f && f.lines && f.lines[lineIdx] && f.lines[lineIdx][kind];
  return own || (FORM_PRESETS[key] || FORM_PRESETS.balanced)[kind];
}
// zone coordinates -> the ice: shifted toward the puck's side and mirrored to it
const FORM_ZONE = () => Math.abs(BLUE_TOP - GL_TOP);
function formWorld(t, kind, d) {
  const gy = kind === 'att' ? oppGoalY(t) : ownGoalY(t), up = kind === 'att' ? attackDir(t) : -attackDir(t);   // up: from that goal line toward the blue line is -up
  const side = puck.x >= CX ? 1 : -1, hw = (R.r - R.l) / 2 - RK(14);
  const shift = clamp((puck.x - CX) / hw, -1, 1) * 0.16;
  const x = CX + (d[0] * side * (1 - 0.16) + shift) * hw;
  const y = gy - up * d[1] * FORM_ZONE();
  return { x, y };
}

// THE GOALIE UNDER PRESSURE (a goalie's 'press' costs him up to 6% save chance): it drains once the puck leaves
// his zone. Crash the Net's lever: two or more of them at his crease rattle him faster. Shown as sweat, then RATTLED!
// THE SHELL READS THE CYCLE: once the other team settles in and works it, the slot man steps into the lane to the
// pass the play is looking for (the cutter, the slot, the back door) and the net guard shades to the far post
function shellReadPass(t, owner, plan, left) {
  const P = TAC.poss[owner.team]; if (!P || !P.settled || typeof patternTarget !== 'function') return;
  const tgt = patternTarget(owner, false); if (!tgt) return;
  const ogy = ownGoalY(t), slotMan = left.find(p => plan[p.id] && plan[p.id].slot && hyp(plan[p.id].x - CX, plan[p.id].y - ogy) > RK(30));
  if (slotMan) { const k = 0.55; plan[slotMan.id] = Object.assign(inRink(owner.x + (tgt.x - owner.x) * k, owner.y + (tgt.y - owner.y) * k), { u: 1, slot: true, form: true, passCut: true }); }
  const guard = left.find(p => p !== slotMan && plan[p.id] && hyp(plan[p.id].x - CX, plan[p.id].y - ogy) < RK(40));
  if (guard && Math.sign(tgt.x - CX) !== Math.sign(owner.x - CX)) plan[guard.id] = Object.assign(inRink(CX + Math.sign(tgt.x - CX) * RK(16), ogy + attackDir(t) * RK(14)), { u: 1, form: true, passCut: true });
}
// BOXING OUT: an attacker parked on top of the crease gets leaned on and moved out of the goalie's space, a little
// each frame (a strong checker moves him further; a strong attacker holds his ground). Every team's net-front man does
// it (basic defence); the Defensive Shell's net guard is better at it (its lever)
const BOX_BASE = 0.2;
function boxOutTick() {
  for (const t of [0, 1]) {
    const bx = Math.max(BOX_BASE, lever(t, 'boxOut', 0));
    const ogy = ownGoalY(t), lp = TAC.lastPlan && TAC.lastPlan[t]; if (!lp) continue;
    for (const g of teamSkaters(t)) {
      const gp = lp[g.id]; if (!gp || gp.chase || hyp(g.x - CX, g.y - ogy) > RK(50) || g.stun > 0) continue;
      for (const o of teamSkaters(1 - t)) {
        if (o === puck.owner || o.stun > 0) continue;
        const dx = o.x - g.x, dy = o.y - g.y, d = hyp(dx, dy);
        if (d > RK(16) || hyp(o.x - CX, o.y - ogy) > RK(48)) continue;
        const crashers = teamSkaters(1 - t).filter(m => hyp(m.x - CX, m.y - ogy) < RK(48)).length;
        const ax = o.x - CX, ay = o.y - ogy, ad = hyp(ax, ay) || 1, k = bx * clamp(1 + (A(g, 'chk') - A(o, 'chk')) * 0.12, 0.4, 1.8) * (crashers >= 2 ? 0.5 : 1);   // two at the crease: he can't move them both
        o.x += ax / ad * k; o.y += ay / ad * k; g.boxT = S.t;
      }
    }
  }
}
// GOALTENDER INTERFERENCE: an attacker standing in the crease on top of the goalie. Remembered for a moment (a goal
// scored right then can be waved off), and running into him at speed can draw a minor
function goalieInterference(g) {
  if (S.phase !== 'live' || S.so || g.ghost || g.on === false) return;
  const gy = ownGoalY(g.team);
  for (const o of teamSkaters(1 - g.team)) {
    if (o.stun > 0 || hyp(o.x - CX, o.y - gy) > CREASE_R + 1 || dist(o, g) > 11) continue;
    g.interfT = S.t; g.interfBy = o;
    const rel = hyp(o.vx - (g.vx || 0), o.vy - (g.vy || 0));
    if (rel > 0.9 && dist(o, g) < 10 && (o.interfCd || 0) < S.t && o !== puck.owner) {
      o.interfCd = S.t + 90;
      if (Math.random() < 0.25 * (typeof traitMul === 'function' ? traitMul(o.pl, 'penMul') : 1) && typeof callFoul === 'function' && callFoul('interf', o, g)) return;
    }
  }
}
function pressureTick() {
  boxOutTick();
  for (const g of goalies) {
    if (!g) continue;
    goalieInterference(g);
    const att = 1 - g.team, inZone = zoneFor(g.team, puck.y) === 'def';
    g.crashNear = 1;
    if (!inZone) g.press = Math.max(0, (g.press || 0) - 0.003);
    else if (lever(att, 'crashPress', 0) > 0) {
      const near = teamSkaters(att).filter(p => hyp(p.x - CX, p.y - ownGoalY(g.team)) < RK(70)).length;
      if (near >= 2) {
        const guards = teamSkaters(g.team).filter(p => hyp(p.x - CX, p.y - ownGoalY(g.team)) < RK(50)).length, lone = guards <= 1 ? lever(att, 'vsLone') : 1;   // one net guard against two crashers
        g.crashNear = lever(att, 'pressMul') * lone; g.press = Math.min(lever(att, 'pressCap', 1), (g.press || 0) + lever(att, 'crashPress', 0) * lone);
      }
    }
    const pr = g.press || 0;
    if (pr > 0.3 && S.t % Math.max(6, Math.round(30 - pr * 24)) === 0) particles.push({ x: g.x + rand(-5, 5), y: g.y - 18, vx: rand(-0.5, 0.5), vy: rand(-0.7, -0.25), life: 26, color: '#bfe4ff' });
    if (pr >= 0.95 && !g.rattledSaid) { g.rattledSaid = true; floaters.push({ x: g.x, y: g.y - 36, text: 'RATTLED!', life: 60, color: '#ff9a7a' }); }
    if (pr < 0.5) g.rattledSaid = false;
  }
}

// FACEOFF ALIGNMENT from the formation: in either end zone, the non-takers line up on the edge of the circle on the
// side of their formation spot (crease dots set up net-side, point dots high), always on their own side of the dot
function foFormSetup(t, dx, dy, taker) {
  const z = zoneFor(t, dy), kind = z === 'att' ? 'att' : z === 'def' ? 'def' : null; if (!kind) return;
  const A_ = activeTactic(t), lineIdx = MS && MS.lines ? MS.lines[t].idx : 0;
  const dots = formFor(tacOf(t), kind, lineIdx, A_.sit, A_.key); if (!dots) return;
  const px = puck.x; puck.x = dx; const pts = dots.map(d => formWorld(t, kind, d)); puck.x = px;
  { let ci = 0, cd = 1e9; pts.forEach((q, i) => { const dd = hyp(q.x - dx, q.y - dy); if (dd < cd) { cd = dd; ci = i; } }); pts.splice(ci, 1); }
  const a = attackDir(t), back = 0.3;
  const places = pts.map(q => {
    let ux = q.x - dx, uy = q.y - dy; const d = hyp(ux, uy) || 1; ux /= d; uy /= d;
    if (uy * a > -back) { uy = -back * a; ux = (Math.sign(ux) || 1) * Math.sqrt(1 - back * back); }
    const r = clamp(d, RK(36), RK(58));
    return { x: dx + ux * r, y: dy + uy * r, ux, uy, r };
  });
  const others = teamSkaters(t).filter(p => p !== taker && !p.g);
  const placed = new Set(teamSkaters(1 - t).concat(taker ? [taker] : []));   // the other team is already set (and our taker)
  for (const p of others) {
    if (!places.length) break;
    let bi = 0, bd = 1e9; places.forEach((q, i) => { const dd = hyp(q.x - p.x, q.y - p.y); if (dd < bd) { bd = dd; bi = i; } });
    const q = places.splice(bi, 1)[0], f = foFreeSpot(q, dx, dy, a, placed);
    p.x = f.x; p.y = f.y;
    if (typeof pushOutOfNets === 'function') pushOutOfNets(p, SKATER_R);
    p.mx = p.x; p.my = p.y; placed.add(p);
  }
}
// a faceoff spot nobody is standing on: the formation's spot if it's free, otherwise the nearest free one around the
// circle (further out or round to either side), always on his own side of the dot and outside the circle
function foFreeSpot(q, dx, dy, a, placed) {
  const gap = 2 * SKATER_R + 5, base = Math.atan2(q.uy, q.ux);
  for (const dr of [0, 12, -8, 22]) for (const da of [0, 0.32, -0.32, 0.64, -0.64, 0.96, -0.96]) {
    const r = Math.max(FO_R + 6, q.r + dr), ang = base + da, ux = Math.cos(ang), uy = Math.sin(ang);
    if (uy * a > -0.12) continue;                                        // not level with or past the dot
    const c = inRink(dx + ux * r, dy + uy * r, 16);
    if ((c.y - dy) * a > -2 || hyp(c.x - dx, c.y - dy) < FO_R + 3) continue;
    // (Nov 22) sprites are tall: two skaters stacked one above the other overlap even when their centres are a 'gap' apart,
    // and the goalie and his crease count too (zone draws used to line the wingers up in a column on top of the goalie)
    const clear = o => { const ddx = Math.abs(o.x - c.x), ddy = Math.abs(o.y - c.y); return o.g ? ddx >= 18 || ddy >= 26 : hyp(ddx, ddy) >= gap && (ddx >= 12 || ddy >= 21); };
    const inCrease = (typeof GL_TOP === 'number') && [GL_TOP, GL_BOT].some(gy => hyp(c.x - CX, c.y - gy) < CREASE_R + 6);
    if (!inCrease && [...placed].every(clear) && players.filter(o => o.g).every(clear)) return c;
  }
  return inRink(dx + q.ux * q.r, dy + q.uy * q.r, 16);
}

// ---------- AI choice: from the roster's strengths (and, at intermissions, the score)
// skaters: array of players with attrs; ctx: { diff: own goals - opp goals, period, late }
function aiStratScores(skaters, ctx = {}) {
  const avg = k => skaters.reduce((a, p) => a + ((p.attrs || {})[k] || 5), 0) / Math.max(1, skaters.length);
  const spd = avg('spd'), def = avg('def'), chk = avg('chk'), pas = avg('pas'), pow = avg('pow'), stk = avg('stk');
  return {
    balanced: 5.3,
    forecheck: (spd + chk) / 2 + (ctx.diff < 0 ? 0.7 : 0) - (ctx.diff > 0 ? 0.6 : 0),
    shell: def + (ctx.diff > 0 ? 0.9 + (ctx.late ? 0.8 : 0) : 0) - (ctx.diff < 0 ? 1.2 : 0) - 0.4,
    counter: (spd + pas) / 2 - 0.2 + (ctx.diff > 0 ? 0.3 : 0),
    crash: (chk + pow) / 2 - 0.3 + (ctx.diff < 0 ? 0.5 + (ctx.late ? 0.5 : 0) : 0),
    splitlanes: (def + pas) / 2 - 0.5 + (ctx.oppOT ? 1.2 : 0) + (ctx.diff > 0 ? 0.3 : 0),
    trap: (def + spd) / 2 - 0.6 + (ctx.diff > 0 ? 0.6 + (ctx.late ? 0.4 : 0) : 0) - (ctx.diff < 0 ? 0.8 : 0),
  };
}
function aiChooseTactics(skaters, ctx = {}) {
  const avg = k => skaters.reduce((a, p) => a + ((p.attrs || {})[k] || 5), 0) / Math.max(1, skaters.length);
  const spd = avg('spd'), def = avg('def'), chk = avg('chk'), pas = avg('pas'), pow = avg('pow'), stk = avg('stk');
  const score = aiStratScores(skaters, ctx);
  const ranked = STRAT_KEYS.slice().sort((a, b) => score[b] - score[a]);
  // the top line plays the team's identity; depth lines lean balanced or defensive
  const lines = [ranked[0], score[ranked[1]] > score.balanced ? ranked[1] : 'balanced', score.shell > 5.6 ? 'shell' : 'balanced'];
  // tempo: playmakers cycle, burners rush; some strategies have a natural tempo; the score pulls it late
  const lean = (pas + stk) / 2 - spd;
  const tempo = lines.map(k => {
    let tp = ({ counter: 'rush', crash: 'cycle', shell: 'cycle' })[k] || (lean > 0.4 ? 'cycle' : lean < -0.4 ? 'rush' : 'mixed');
    if (ctx.late && ctx.diff > 0) tp = 'cycle'; else if (ctx.late && ctx.diff < 0) tp = 'rush';
    return tp;
  });
  return { lines, tempo, pp: pas + stk > pow + chk ? 'umbrella' : 'overload', pk: (spd + chk) / 2 > def + 0.6 ? 'aggressive' : 'box' };
}
// line positions on a team's three lines (natural positions), used for the AI choice in franchise mode
function teamTacFor(save, team) {
  if (!team) return DEFAULT_TAC();
  if (team.tac && team.id === save.userTeamId) return validTac(team.tac);
  const sk = rosterSkaters(team).map(id => save.players[id]).filter(Boolean);
  return team.tac && team.tacSeason === (save.season && save.season.num) ? validTac(team.tac) : aiChooseTactics(sk);
}

// ---------- in-match state
const TAC = { hold: [null, null] };       // per defending team: tracking of the opposing carrier (anti-circling)
const tacOf = t => (S.match && S.match.tac && S.match.tac[t]) || DEFAULT_TAC();
function lineStrategy(t) {
  const tc = tacOf(t), idx = MS && MS.lines ? MS.lines[t].idx : 0;
  return tc.lines[idx] || 'balanced';
}
// the situation that decides which shape a team plays right now
function tacSituation(t) {
  const n = [teamSkaters(t).length, teamSkaters(1 - t).length];
  if (n[0] > n[1]) return 'pp';
  if (n[0] < n[1]) return 'pk';
  return 'even';
}
function activeTactic(t) {
  const sit = tacSituation(t), tc = tacOf(t);
  if (sit === 'pp') return { sit, key: tc.pp, strat: STRATEGIES.balanced };
  if (sit === 'pk') return { sit, key: tc.pk, strat: STRATEGIES.shell };
  const key = lineStrategy(t);
  return { sit, key, strat: STRATEGIES[key] };
}
// AI coaching at intermissions (and before the game): adapt to the score
function aiIntermissionTactics(t, opts = {}) {
  if (!S.match || !S.match.tac) return;
  if (S.match.lockTac || S.match.easyTac || (S.match.userTeams && S.match.userTeams.includes(t))) return;   // (lockTac: tests keep their tactics all game)
  // plan from the players it actually has now: each line as it will take the ice (injured, ejected or boxed men
  // replaced by whoever fills in), not the lineup it started with
  const live = MS && typeof lineFor === 'function';
  const lines = [0, 1, 2].map(i => (live ? lineFor(t, i) : (S.match.lineups[t].lines[i] || [])).filter(Boolean));
  const skPl = [...new Set(lines.flat())];
  const lost = live ? (S.match.lineups[t].lines || []).flat().filter(pl => pl && typeof outInfo === 'function' && outInfo(pl.id)).length : 0;
  const diff = (S.score ? S.score[t] - S.score[1 - t] : 0), late = S.period >= 3;
  const oppOT = MS && MS.otN ? MS.otN[1 - t] >= 4 + S.period : false;   // they keep beating us with one-timers: take the middle away
  const old = validTac(S.match.tac[t]);
  const next = aiChooseTactics(skPl, { diff, period: S.period, late, oppOT });
  // Hard: counter what it has SEEN you play (the read fades between periods). In your timeout it may also hedge
  // against what it expects you to do, from the score and the clock only
  let scout = null;
  if (scoutOn(t)) {
    let p = scoutBest(t); p = p && p.p;
    const g = opts.yourTimeout ? timeoutGuess(t) : null;
    if (g) { const q = {}; for (const k of STRAT_KEYS) q[k] = (p ? p[k] || 0 : 1 / STRAT_KEYS.length) * (1 - SCOUT.hedge) + (g[k] || 0) * SCOUT.hedge; p = q; }
    scout = scoutCounter(t, next, skPl, { diff, period: S.period, late, oppOT }, p);
  }
  next.tempo = lines.map((pls, i) => aiLineTempo(pls, next.lines[i], { diff, late, lost, stam: live && typeof lineRatings === 'function' && lineRatings(t, i) ? lineRatings(t, i).stam : 100 }));
  if (old.form) next.form = old.form;
  S.match.tac[t] = validTac(next);
  // say what changed (so you can read the other bench)
  const ch = [0, 1, 2].filter(i => old.tempo[i] !== next.tempo[i] || old.lines[i] !== next.lines[i]);
  if (scout && typeof rsLog === 'function') rsLog(`${TEAM[t].abbr} reads ${STRATEGIES[scout.read].short}, answers with ${STRATEGIES[scout.pick].short}`);
  if (ch.length && typeof rsLog === 'function') rsLog(`${TEAM[t].abbr} adjusts: ` + ch.map(i => `L${i + 1} ${STRATEGIES[next.lines[i]].short}/${TEMPOS[next.tempo[i]].name}`).join(', '));
  if (ch.length) (S.match.adjust = S.match.adjust || [null, null])[t] = { at: S.period, text: ch.map(i => `LINE ${i + 1}: ${STRATEGIES[next.lines[i]].name.toUpperCase()}, ${TEMPOS[next.tempo[i]].name.toUpperCase()}`).join(' · ') };
}
// ---------- SCOUTING (Hard): the computer reads your strategy from what it SEES on the ice, never from your settings.
// Every quarter second at even strength it looks at the other team's skaters (not the one a human is steering) and
// keeps running totals per line: how deep they defend, how far up they forecheck, who stays home, who goes to the net,
// how wide they spread, how long they keep the puck. The read fades between periods, so a change takes time to notice.
const SCOUT = { every: 15, fade: 0.35, nCap: 40, minN: 6, act: 3.5, hedge: 0.4 };
// what it looks at depends on where the puck is: 0-2 they defend (puck deep in our end / midfield / their end),
// 3-4 they attack (in our zone / elsewhere)
const SCOUT_NF = [6, 6, 6, 5, 5];
TAC.scout = null;
function scoutReset() { TAC.scout = [0, 1].map(() => ({ lines: [0, 1, 2].map(() => SCOUT_NF.map(nf => ({ n: 0, s: new Array(nf).fill(0) }))), per: [] })); }
function scoutOn(t) {      // team t is the one watching
  const m = S.match; if (!m || !m.tac) return false;
  if (m.scoutAll) return true;
  const u = m.userTeams || [];
  return S.diff === 'HARD' && !u.includes(t) && u.includes(1 - t) && !m.easyTac && !m.lockTac;
}
function scoutTick() {
  if (!TAC.scout || S.phase !== 'live' || S.t % SCOUT.every || !MS || !MS.lines) return;
  for (const t of [0, 1]) {
    if (!scoutOn(t)) continue;
    const O = 1 - t; if (tacSituation(O) !== 'even') continue;
    const own = puck.owner ? puck.owner.team : -1; if (own < 0) continue;
    // leave out the man a human is steering (or, for a computer side, the one nearest the puck: the same man, near enough)
    const all = teamSkaters(O).filter(p => !p.g), hc = typeof ctrl !== 'undefined' && ctrl && ctrl.team === O && !ctrl.g ? ctrl : null;
    const skip = hc || all.reduce((m, p) => !m || hyp(p.x - puck.x, p.y - puck.y) < hyp(m.x - puck.x, m.y - puck.y) ? p : m, null);
    const sk = all.filter(p => p !== skip); if (sk.length < 2) continue;
    const g0 = ownGoalY(O), L = Math.abs(oppGoalY(O) - g0), dir = attackDir(O), dep = y => (y - g0) * dir / L;
    const ds = sk.map(p => dep(p.y)), n = sk.length, mean = ds.reduce((a, b) => a + b, 0) / n, pd = dep(puck.y);
    const pz = pd > 0.64 ? 0 : pd > 0.36 ? 1 : 2;
    let b, f;
    if (own === t) {        // they are defending
      b = pz;
      f = [mean, Math.max(...ds), ds.filter(d => d > 0.64).length / n, ds.filter(d => d > 0.36 && d <= 0.64).length / n,
        sk.filter(p => hyp(p.x - CX, p.y - g0) < RK(90)).length / n, sk.filter(p => hyp(p.x - puck.x, p.y - puck.y) < RK(45)).length / n];
    } else {                // they have the puck
      b = pz === 0 ? 3 : 4;
      const g1 = oppGoalY(O), mx = sk.reduce((a, p) => a + p.x, 0) / n;
      f = [sk.filter(p => hyp(p.x - CX, p.y - g1) < RK(70)).length / n, Math.sqrt(sk.reduce((a, p) => a + (p.x - mx) ** 2, 0) / n) / RK(150), mean,
        TAC.poss[O] && TAC.poss[O].settled ? 1 : 0, ds.filter(d => d < 0.4).length / n];
    }
    const acc = (TAC.scout[t].lines[MS.lines[O].idx] || TAC.scout[t].lines[0])[b];
    acc.n++; for (let i = 0; i < f.length; i++) acc.s[i] += f[i];
  }
}
// between periods: log the period (for testing) and let the old evidence fade
function scoutFade() {
  if (!TAC.scout) return;
  for (const sc of TAC.scout) {
    if (S.match && S.match.scoutAll) sc.per.push(sc.lines.map(l => l.map(bk => ({ n: bk.n, s: bk.s.slice() }))));
    for (const l of sc.lines) for (const bk of l) { bk.n *= SCOUT.fade; for (let i = 0; i < bk.s.length; i++) bk.s[i] *= SCOUT.fade; }
  }
}
// the read of one of their lines: a probability for each strategy (null if it hasn't seen enough yet)
function scoutRead(t, i) {
  if (!TAC.scout || typeof SCOUT_MODEL === 'undefined' || !SCOUT_MODEL) return null;
  const l = TAC.scout[t].lines[i]; if (l.reduce((a, bk) => a + bk.n, 0) < 30) return null;
  const M = SCOUT_MODEL, ll = {};
  for (const k of STRAT_KEYS) {
    const c = M.mu[k]; if (!c) continue; let s = 0, f = 0;
    for (let b = 0; b < l.length; b++) {
      const bk = l[b], nn = Math.min(bk.n, SCOUT.nCap);
      for (let j = 0; j < bk.s.length; j++, f++) { if (bk.n < SCOUT.minN) continue; const x = bk.s[j] / bk.n, v = M.sw[f] ** 2 / nn + M.tau[f] ** 2; s -= (x - c[f]) ** 2 / (2 * v); }
    }
    ll[k] = s;
  }
  const mx = Math.max(...Object.values(ll)); let z = 0; for (const k in ll) { ll[k] = Math.exp(ll[k] - mx); z += ll[k]; }
  for (const k in ll) ll[k] /= z;
  return ll;
}
// their likely strategy overall (weighted by how much each line has been seen) and how sure the read is
function scoutBest(t) {
  const tot = {}; let w = 0;
  for (let i = 0; i < 3; i++) { const r = scoutRead(t, i); if (!r) continue; const wi = TAC.scout[t].lines[i].reduce((a, bk) => a + bk.n, 0); w += wi; for (const k in r) tot[k] = (tot[k] || 0) + r[k] * wi; }
  if (!w) return null;
  let best = null; for (const k in tot) { tot[k] /= w; if (!best || tot[k] > tot[best]) best = k; }
  return { key: best, conf: tot[best], p: tot };
}
// what each strategy looks like from the other bench (refitted Nov 18 from 420 computer games, all tempos): average of each
// feature per strategy (mu), how much one look varies (sw), and how much a whole team varies from the average (tau)
const SCOUT_MODEL = {"mu":{"balanced":[0.7076,0.7615,0.7956,0.1701,0.0067,0.3156,0.4667,0.5166,0.076,0.7506,0.0562,0.5176,0.1971,0.2428,0.0011,0.0652,0.369,0.3458,0.192,0.2382,0.7724,0.6514,0.012,0.0,0.1945,0.3561,0.0107,0.5725],"forecheck":[0.7515,0.808,0.8851,0.0992,0.0039,0.3332,0.493,0.5356,0.1361,0.7282,0.0373,0.4535,0.2072,0.2437,0.0016,0.0978,0.4269,0.3289,0.2153,0.2481,0.7868,0.6767,0.011,0.0,0.2048,0.3418,0.013,0.6075],"shell":[0.7169,0.7701,0.8144,0.1496,0.0065,0.3188,0.4511,0.4951,0.0701,0.7105,0.0619,0.4776,0.1566,0.1904,0.0008,0.0447,0.561,0.3648,0.2374,0.2375,0.7963,0.7903,0.0117,0.0001,0.1767,0.3302,0.0199,0.6289],"counter":[0.6969,0.7486,0.7826,0.1964,0.0018,0.3074,0.5035,0.5612,0.0793,0.8058,0.0391,0.4172,0.2795,0.3675,0.0013,0.3357,0.2689,0.2811,0.0653,0.1847,0.7198,0.3713,0.0158,0.0002,0.1875,0.3815,0.007,0.5295],"crash":[0.7405,0.7921,0.8393,0.1279,0.0079,0.3471,0.4811,0.5283,0.1119,0.7337,0.0462,0.4702,0.2049,0.2476,0.0013,0.0874,0.3538,0.3428,0.3796,0.2479,0.8086,0.7981,0.013,0.0004,0.1989,0.3456,0.0209,0.6111],"splitlanes":[0.7069,0.762,0.7945,0.1707,0.0072,0.2988,0.4522,0.4973,0.0677,0.7118,0.0539,0.4758,0.1415,0.1738,0.0008,0.0383,0.608,0.3712,0.1959,0.2438,0.7735,0.6516,0.0133,0.0001,0.1965,0.3309,0.0101,0.6255],"trap":[0.7072,0.7615,0.7945,0.1768,0.0038,0.2916,0.4863,0.5234,0.0836,0.7796,0.0087,0.485,0.2152,0.2508,0.001,0.1049,0.3226,0.3438,0.171,0.2326,0.7587,0.5704,0.0156,0.0,0.205,0.3454,0.0092,0.6007]},"sw":[0.2085,0.175,0.5275,0.4141,0.0858,0.6214,0.1979,0.1663,0.2821,0.5031,0.2634,0.6574,0.2679,0.2807,0.0447,0.4617,0.8991,0.9463,0.5951,0.3197,0.2928,1.5918,0.1739,0.03,0.2225,0.2772,0.2576,0.712],"tau":[0.033,0.0277,0.0834,0.0655,0.0136,0.0983,0.0313,0.0263,0.0446,0.0795,0.0417,0.1039,0.0424,0.0444,0.0071,0.073,0.1422,0.1496,0.0941,0.0506,0.0463,0.2517,0.0275,0.0047,0.0352,0.0438,0.0407,0.1126]};
// the designed counters: which strategies beat which (the 56.5% matchups); any strategy edges Balanced a little
const COUNTER_OF = { forecheck: ['counter', 'trap'], shell: ['forecheck', 'crash'], counter: ['shell', 'trap'], crash: ['forecheck', 'splitlanes'], splitlanes: ['counter'], trap: ['shell', 'crash', 'splitlanes'] };
function matchupEdge(a, b) {      // roughly the win-% points a gets over 50 against b
  if (a === b) return 0;
  if ((COUNTER_OF[b] || []).includes(a)) return 6.5;
  if ((COUNTER_OF[a] || []).includes(b)) return -6.5;
  return b === 'balanced' ? 2 : a === 'balanced' ? -2 : 0;
}
// Hard: play the strategy with the best expected matchup against what it believes you play, when that is worth it.
// p: its belief (strategy -> probability). Returns { pick, read } or null.
function scoutCounter(t, next, skPl, ctx, p) {
  if (!p) return null;
  const sc = aiStratScores(skPl, ctx), E = {};
  for (const a of STRAT_KEYS) { E[a] = 0; for (const b in p) E[a] += p[b] * matchupEdge(a, b); E[a] += (sc[a] - 5.3) * 0.4; }   // (a small lean toward what suits its own players)
  const pick = STRAT_KEYS.slice().sort((a, b) => E[b] - E[a])[0];
  if (E[pick] < SCOUT.act) return null;
  next.lines = [pick, pick, pick];
  let read = null; for (const b in p) if (!read || p[b] > p[read]) read = b;
  return { pick, read };
}
// what it expects you to do in YOUR timeout, from the game state only (it never sees what you pick there):
// chasing late you'll likely push, protecting a lead you'll likely sit back
function timeoutGuess(t) {
  const humanDiff = S.score[1 - t] - S.score[t], late = S.period >= 3;
  if (humanDiff < 0 && (late || humanDiff <= -2)) return { forecheck: 0.5, crash: 0.5 };
  if (humanDiff > 0 && late) return { shell: 0.5, trap: 0.5 };
  return null;
}
// the tempo a computer coach picks for one line, from the players actually on it and the state of the game
function aiLineTempo(pls, strat, c) {
  const at = (pl, k) => (pl.attrs || {})[k] ?? 5;
  const n = Math.max(1, pls.length), lean = pls.reduce((a, pl) => a + (at(pl, 'pas') + at(pl, 'stk')) / 2 - at(pl, 'spd'), 0) / n;
  if (c.late && c.diff < 0) return 'rush';                                  // chasing the game: push the pace
  if (c.late && c.diff > 0) return 'cycle';                                 // protecting a lead: keep the puck
  if (c.lost >= 2 || c.stam < 45) return lean < -0.6 ? 'mixed' : 'cycle';   // short on bodies or legs: slow it down, keep it away from them
  if (c.diff <= -2) return lean > 0.8 ? 'mixed' : 'rush';
  return ({ counter: 'rush', crash: 'cycle', shell: 'cycle' })[strat] || (lean > 0.4 ? 'cycle' : lean < -0.4 ? 'rush' : 'mixed');
}

// ---------- helpers
const NAT = p => (p && p.pl && p.pl.spos) || ['LW', 'C', 'RW', 'C'][p ? p.role : 1] || 'C';
const isDef = p => { const s = NAT(p); return s === 'LD' || s === 'RD'; };
const natLane = p => { const s = NAT(p); return s === 'LW' || s === 'LD' ? -1 : s === 'RW' || s === 'RD' ? 1 : 0; };
// x for a lane (-1 left, 0 middle, +1 right) as seen by team t skating toward the net it attacks
const RK = v => v * (typeof RINK_S === 'number' ? RINK_S : 1);          // rink distances (the rink grew 15%)
const laneX = (t, lane, w = 72) => CX + lane * (-attackDir(t)) * RK(w);
const inRink = (x, y, m = 10) => ({ x: clamp(x, R.l + m, R.r - m), y: clamp(y, R.t + m, R.b - m) });
function speedOf(p) { return baseSpeed(p) * fatigueMul(p); }
// closest to a point by skating time
function quickest(list, x, y) { let b = null, bt = 1e9; for (const p of list) { const tt = hyp(p.x - x, p.y - y) / Math.max(0.6, speedOf(p)); if (tt < bt) { bt = tt; b = p; } } return b; }
function zoneFor(t, y) { return typeof zoneOf === 'function' ? ({ off: 'att' }[zoneOf(t, y)] || zoneOf(t, y)) : (Math.abs(y - ownGoalY(t)) < RK(150) ? 'def' : Math.abs(y - oppGoalY(t)) < RK(150) ? 'att' : 'neu'); }

// carrier tracking: how long he has held it and whether he is getting anywhere (anti-circling)
function trackCarrier(defT, owner) {
  let h = TAC.hold[defT];
  if (!owner || owner.team === defT || owner.g) { TAC.hold[defT] = null; return null; }
  if (!h || h.owner !== owner) h = TAC.hold[defT] = { owner, t0: S.t, bestD: 1e9, progT: S.t, turn: 0, lastA: Math.atan2(owner.vy, owner.vx) };
  const dNet = hyp(owner.x - CX, owner.y - ownGoalY(defT));
  if (dNet < h.bestD - 12) { h.bestD = dNet; h.progT = S.t; }
  const a = Math.atan2(owner.vy, owner.vx);
  if (hyp(owner.vx, owner.vy) > 0.6) { h.turn += Math.abs(angDiff(a, h.lastA)); h.lastA = a; }
  h.held = S.t - h.t0; h.stall = S.t - h.progT;
  // circling: plenty of turning without getting any closer, or simply holding it for too long
  h.circling = (h.stall > 140 && h.turn > Math.PI * 1.5) || h.stall > 260 || h.held > TAC_BAL.circleHold;
  return h;
}

// ---------- THE ANCHOR (3-on-3 has no defencemen, but every line has a stay-at-home player)
// The line's most defensive skater (a D badge first, then the Defensive archetype, then the best DEF) is its anchor.
// He OBEYS THE TACTIC: the tactic still decides every spot on the ice. The anchor only chooses which of those spots is
// his: always the most defensive one the tactic offers (the highest spot in their zone, the trailing spot on the rush,
// the deepest job without the puck, holding back on a loose puck in their half). He is never sent anywhere the tactic
// has no spot. When he carries the puck himself, nobody is moved. Your own skater is never moved.
function anchorScore(p) {
  const pl = p.pl || {}, a = pl.attrs || {};
  return (isDef(p) ? 100 : 0) + (pl.arch === 'defensive' ? 60 : pl.arch === 'enforcer' ? 20 : 0) + (a.def || 5) * 5 + (a.chk || 5) - (a.pow || 5);
}
function anchorOf(t, mine, owner) {
  const pool = mine.filter(p => !p.g).concat(owner && owner.team === t && !owner.g && !mine.includes(owner) ? [owner] : []);
  if (!pool.length) return null;
  return pool.reduce((b, p) => anchorScore(p) > anchorScore(b) ? p : b);
}
function anchorPass(t, mine, owner, plan) {
  if (S.phase !== 'live' || mine.length < 2) return;
  const a = anchorOf(t, mine, owner); if (!a || a === owner || !plan[a.id]) return;   // he has the puck himself: nobody is moved
  TAC.anchor = TAC.anchor || [null, null]; TAC.anchor[t] = a;
  const up = attackDir(t), ogy = ownGoalY(t), dOwn = g => (g.y - ogy) * up;   // distance up the ice from our goal line
  const others = mine.filter(p => p !== a && plan[p.id]);
  // without the puck: he trades jobs with whoever has the tactic's most defensive job (so he covers, someone else chases)
  const takeDeepest = (ok = () => true) => {
    const c = others.filter(p => ok(plan[p.id]) && !plan[p.id].cut); if (!c.length) return;
    const deep = c.reduce((b, p) => dOwn(plan[p.id]) < dOwn(plan[b.id]) ? p : b);
    if (dOwn(plan[deep.id]) >= dOwn(plan[a.id]) - 6) return;
    const tmp = plan[a.id]; plan[a.id] = plan[deep.id]; plan[deep.id] = tmp;
  };
  if (owner && owner.team === t) { /* ours: handled inside offensePlan's own assignment (the anchor picks first) */ }
  else if (owner) {                                                         // theirs: the deepest job, not the chase
    const g = plan[a.id], carrierNear = hyp(owner.x - CX, owner.y - ogy) < RK(64);
    const ourHalf = (owner.y - CY) * up < 0;                                 // deep in their end the tactic's own forecheck roles decide
    if (ourHalf && !(carrierNear && g.chase)) takeDeepest();                // on our doorstep, whoever is on him stays on him
  }                                                                         // loose puck: the tactic's own rules (nearest goes)
  if (plan[a.id]) plan[a.id].anchor = true;
}

// ====================================================================
//  THE PLAN
// ====================================================================
function teamPlan(t) {
  const plan = {};
  const humanOn = t === 0 && ctrl && !ctrl.g && !S.autoAI;
  const mine = teamSkaters(t).filter(p => !(humanOn && p === ctrl));
  const owner = puck.owner;
  const A_ = activeTactic(t);
  if (owner && owner.team === t) { TAC.hold[t] = null; offensePlan(t, mine, owner, A_, plan); tipLanes(t, owner, plan, mine); }
  else if (owner && owner.team !== t) defensePlan(t, mine, owner, A_, plan, humanOn);
  else { TAC.hold[t] = null; loosePlan(t, mine, A_, plan, humanOn); }
  for (const p of mine) if (!plan[p.id]) plan[p.id] = { x: CX + natLane(p) * RK(30), y: ownGoalY(t) + attackDir(t) * RK(120), u: 0.75 };
  // recovery after a failed challenge: get back goal-side before trying again
  for (const p of mine) if (p.recoverT > 0) {
    p.recoverT--;
    if (owner && owner.team !== t) {
      const ogy = ownGoalY(t), dx = CX - owner.x, dy = ogy - owner.y, d = hyp(dx, dy) || 1;
      plan[p.id] = Object.assign(inRink(owner.x + dx / d * 28, owner.y + dy / d * 28), { u: 1, recover: true });
    }
  }
  anchorPass(t, mine, owner, plan);
  // spread out: no two teammates aim for the same patch of ice, and nobody parks on top of your skater or the carrier
  // (two targets that land together, e.g. a slot cover and a lane block, used to leave two players stacked)
  {
    const minD = RK(24), list = mine.filter(p => plan[p.id]);
    const fixed = []; if (humanOn) fixed.push(ctrl); if (owner && owner.team === t && !owner.g) fixed.push(owner);
    const movable = g => !(g.chase || g.stall || g.recover);
    for (let it = 0; it < 3; it++) {
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = plan[list[i].id], b = plan[list[j].id];
        let dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy);
        if (d >= minD) continue;
        if (!movable(a) && !movable(b)) continue;
        if (d < 0.5) { const s0 = list[i].x < list[j].x ? 1 : -1; dx = s0; dy = 0.3; d = hyp(dx, dy); }
        const push = minD - d, nx = dx / d, ny = dy / d;
        // the lower-priority target gives way (both share it if they are equal)
        const wa = !movable(a) ? 0 : !movable(b) ? 1 : (a.u || 0.8) > (b.u || 0.8) ? 0.25 : (a.u || 0.8) < (b.u || 0.8) ? 0.75 : 0.5;
        const qa = inRink(a.x - nx * push * wa, a.y - ny * push * wa, 8), qb = inRink(b.x + nx * push * (1 - wa), b.y + ny * push * (1 - wa), 8);
        a.x = qa.x; a.y = qa.y; b.x = qb.x; b.y = qb.y;
      }
      for (const f of fixed) for (const p of list) {
        const g = plan[p.id]; if (!movable(g) || p === f) continue;
        const dx = g.x - f.x, dy = g.y - f.y, d = hyp(dx, dy) || 0.01, need = RK(20);
        if (d < need) { const q = inRink(f.x + dx / d * need, f.y + dy / d * need, 8); g.x = q.x; g.y = q.y; }
      }
    }
  }
  // nobody parks: every target that isn't a chase drifts on its own little route (an oval loop at its own pace),
  // so skaters keep gliding, turning and re-setting instead of standing on a spot
  if (S.phase === 'live') for (const p of mine) {
    const g = plan[p.id]; if (!g || g.chase || g.loose || g.recover || g.stall) continue;
    const r = g.screen || g.slot || g.rebound ? 4 : g.mark ? 6 : 10, ph = ((p.id * 2.399) % 6.283), w = 0.035 + ((p.id * 7) % 5) * 0.004;
    const q = inRink(g.x + Math.sin(S.t * w + ph) * r * RK(1), g.y + Math.cos(S.t * w * 0.73 + ph) * r * 0.7 * RK(1), 8);
    g.x = q.x; g.y = q.y;
  }
  // last: while it's ours and still outside their zone, no target (drift included) is over their blue line
  const oursNow = owner ? owner.team === t : (puck.passTarget ? puck.passTarget.team === t : !!(puck.lastTouch && puck.lastTouch.team === t));
  if (oursNow && S.rules) for (const p of mine) { const g = plan[p.id]; if (g && !g.safety) g.y = onsideY(t, g.y); }
  (TAC.lastPlan = TAC.lastPlan || [null, null])[t] = plan;
  return plan;
}

// a teammate near the net steps onto the line of an incoming shot to try a tip
function tipLanes(t, owner, plan, mine) {
  if (!owner || owner.charge < 0) return;
  const gy = oppGoalY(t), up = attackDir(t);
  if (Math.abs(owner.y - gy) > RK(170)) return;
  for (const p of mine) {
    if (p === owner) continue;
    const g = plan[p.id]; if (!g) continue;
    if (Math.abs(p.y - gy) > RK(70) || Math.abs(p.x - CX) > RK(60)) continue;
    const dx = CX - owner.x, dy = gy - owner.y, d = hyp(dx, dy) || 1;
    const k = clamp((d - 20) / d, 0.4, 0.95);                       // ~20 units out from the goal line
    g.x = owner.x + dx * k + (-dy / d) * 2; g.y = owner.y + dy * k; g.u = 1; g.tip = true;
  }
}
function onsideY(t, y) {
  if (!S.rules) return y;
  const puckInZone = isUp(t) ? puck.y < BLUE_TOP : puck.y > BLUE_BOT;
  if (puckInZone) return y;
  return isUp(t) ? Math.max(y, BLUE_TOP + 14) : Math.min(y, BLUE_BOT - 14);
}

// Counterattack respect (see offensePlan): on = 1, depth = how far out from their goal the safety waits (175 = the shell's
// safety, near the blue line), shade = how far he leans toward their leaking forward, u = his urgency getting there
const CRESPECT = { on: 0, depth: 175, shade: 0.5, u: 0.9 };   // OFF: tested Nov 23, didn't help (Counter still won 97% vs Crash); kept for the next pass

// ---------- WITH THE PUCK
function offensePlan(t, mine, owner, A_, plan) {
  const up = attackDir(t), gy = oppGoalY(t), ogy = ownGoalY(t);
  const free = mine.filter(p => p !== owner);
  if (!free.length) return;
  // in the zone means the PUCK is over their blue line (until then, teammates stay onside)
  const carrierInZone = (gy - owner.y) * up > -30 && (typeof zoneDepth === 'function' ? zoneDepth(t, puck.y) > 1 : (gy - owner.y) * up < RK(140));
  const spot = (x, y, u = 0.9, extra) => Object.assign(inRink(x, onsideY(t, y)), { u }, extra || {});
  const assign = spots => {           // spots: [{x,y,...}] -> nearest free player, each player once (the anchor first)
    // with the puck in their zone, everybody is inside the blue line (a safe margin in), except a 4th man
    // a formation deliberately leaves back as a safety
    if (carrierInZone) for (const s of spots) if (!s.safety) {
      const depth = (gy - s.y) * up; if (depth > PLAY.zoneDepthMax) s.y = gy - up * PLAY.zoneDepthMax;
    }
    const left = free.slice();
    // THE ANCHOR picks first: the most defensive spot this tactic has (highest in their zone, the trailer on the rush)
    const anc = anchorOf(t, free.concat([owner]), owner);
    // ...except on the rush for a RUSH-tempo line or a Counterattack break: that tactic sends everyone, so he joins it
    // (he still takes the high spot once they are set up in the zone)
    const allIn = !carrierInZone && (lineTempo(t) === 'rush' || fast);
    if (anc && !allIn && anc !== owner && left.includes(anc) && spots.length) {
      let si = -1, sd = -1e9; spots.forEach((s, i) => { if (s.cut || s.safety && !s.high) return; const d = (gy - s.y) * up; if (d > sd) { sd = d; si = i; } });
      if (si >= 0) { const s = spots[si]; s.anchor = true; plan[anc.id] = s; left.splice(left.indexOf(anc), 1); spots = spots.slice(0, si).concat(spots.slice(si + 1)); }
    }
    for (const s of spots) {
      if (!left.length) break;
      let bi = 0, bd = 1e9;
      left.forEach((p, i) => { const d = hyp(p.x - s.x, p.y - s.y) + (s.pref && s.pref(p) ? -40 : 0); if (d < bd) { bd = d; bi = i; } });
      const pl = left[bi];
      // still outside the blue line while we have it in the zone: get in there, flat out
      if (carrierInZone && !s.safety && (gy - pl.y) * up > PLAY.zoneDepthMax) { s.u = 1; s.hurry = true; }
      plan[pl.id] = s; left.splice(bi, 1);
    }
  };
  const ownerLane = Math.sign((owner.x - CX) * (-attackDir(t))) || 0;
  // IN THE ZONE: the formation (the team's own, or its tactic's preset). The carrier plays free: the dot nearest him is
  // his, the others fill the rest. Dots near the crease are screens / rebounds, high dots are the point.
  const key = A_.sit === 'pk' ? 'shell' : A_.key;
  if (carrierInZone) {
    const lineIdx = MS && MS.lines ? MS.lines[t].idx : 0;
    const dots = formFor(tacOf(t), 'att', lineIdx, A_.sit === 'pp' ? 'pp' : A_.sit === 'pk' ? 'pk-off' : 'even', A_.key) || FORM_PRESETS.shell.att;
    const pts = dots.map(d => Object.assign(formWorld(t, 'att', d), { d }));
    let ci = 0, cd = 1e9; pts.forEach((q, i) => { const dd = hyp(owner.x - q.x, owner.y - q.y); if (dd < cd) { cd = dd; ci = i; } });
    pts.splice(ci, 1);
    const spots = pts.map(q => {
      const [dx, dy] = q.d, crease = dy < 0.24 && Math.abs(dx) < 0.32, slot = dy < 0.55 && Math.abs(dx) < 0.55, high = dy > 0.8;
      const fl = crease ? { screen: true, rebound: true } : slot ? { shooter: true } : high ? { pref: isDef, high: true } : {};
      return spot(q.x + (crease ? rand(-2, 2) : 0), q.y, crease || key === 'crash' ? 1 : high ? 0.85 : 0.9, fl);
    });
    patternSpots(t, owner, spots);
    if (TAC.poss[t] && TAC.poss[t].settled) for (const sp of spots) { sp.u = Math.max(sp.u || 0.9, 1); sp.hurry = true; }   // a settled possession: everybody gets up into the play
    const cut = TAC.cut[t];
    if (cut && cut.until > S.t) { const cp = free.find(m => m.id === cut.id); if (cp) {                // give-and-go: the passer cuts to the slot
      let bi = 0, bd = 1e9; spots.forEach((sp, i) => { const d = hyp(sp.x - cp.x, sp.y - cp.y); if (d < bd) { bd = d; bi = i; } });
      spots[bi] = Object.assign(inRink(CX + (cp.x < CX ? -1 : 1) * RK(14), gy - up * RK(48)), { u: 1, cut: true, pref: m => m === cp });
    } }
    for (let i = spots.length; i < free.length; i++) {
      // an extra skater beyond the formation (a 4th man): in the shell he waits back as a safety, otherwise joins in
      if (key === 'shell' && A_.sit !== 'pp') spots.push(Object.assign(inRink(CX, gy - up * RK(175)), { u: 0.8, safety: true, high: true }));
      else spots.push(spot(laneX(t, ownerLane || 1, 60), gy - up * RK(70)));
    }
    // RESPECT THE COUNTERATTACK (Nov 23, Barry's choice): against a Counter line the most defensive spot becomes a safety
    // back at the blue line, shaded toward their leaking forward. Measured before: Counter beat Crash 100%, Forecheck 94%,
    // Shell 82%, Trap 78% (targets 43-57), 93% of its goals within 5 s of winning the puck. The anchor still takes the spot.
    if (CRESPECT.on && A_.sit === 'even' && key !== 'counter' && activeTactic(1 - t).key === 'counter' && spots.length) {
      let si = -1, sd = -1e9; spots.forEach((s, i) => { if (s.cut) return; const d = (gy - s.y) * up; if (d > sd) { sd = d; si = i; } });
      if (si >= 0) {
        const opp = players.filter(p => p.team !== t && !p.g && p.onIce !== false);
        const leak = opp.reduce((b, p) => !b || Math.abs(p.y - ogy) < Math.abs(b.y - ogy) ? p : b, null);   // their man nearest our goal
        const x = leak ? clamp(CX + (leak.x - CX) * CRESPECT.shade, CX - RK(70), CX + RK(70)) : CX;
        spots[si] = Object.assign(inRink(x, gy - up * RK(CRESPECT.depth)), { u: CRESPECT.u, safety: true, high: true, pref: isDef });
      }
    }
    assign(spots); return;
  }
  // through the midfield / breakout / regroup: the FORMATION's shape carried up the ice. Each attack dot keeps its lane
  // (across the ice, mirrored to the carrier's side) and its depth turns into how far ahead of / behind the carrier that
  // skater travels: crease dots lead the rush, point dots trail. The carrier takes the dot whose lane is nearest his.
  const fast = key === 'counter' || (S.t - (TAC.regainT && TAC.regainT[t] || -999) < 120);
  const lineIdx = MS && MS.lines ? MS.lines[t].idx : 0;
  const dots = (formFor(tacOf(t), 'att', lineIdx, A_.sit === 'pp' ? 'pp' : A_.sit === 'pk' ? 'pk-off' : 'even', A_.key) || FORM_PRESETS.balanced.att).slice();
  const side = (owner.x >= CX ? 1 : -1), hw = (R.r - R.l) / 2 - RK(20);
  const laneOfDot = d => CX + d[0] * side * hw * 0.82;
  { let ci = 0, cd = 1e9; dots.forEach((d, i) => { const dd = Math.abs(laneOfDot(d) - owner.x) + Math.min(d[1], 1.3) * 20; if (dd < cd) { cd = dd; ci = i; } }); dots.splice(ci, 1); }
  const spots = dots.map(d => {
    const leak = key === 'counter' && S.t - (TAC.regainT[t] || -999) < 150 && d[1] < 0.6 ? lever(t, 'leak', 0) : 0;   // Counterattack: a forward leaks out
    const lead = clamp((0.95 - Math.min(d[1], 1.4)) * 110 + (fast ? 45 : 0) + leak, -55, 170);
    const trail = lead < 12;
    return spot(laneOfDot(d), owner.y + up * RK(lead), lead > 60 ? (fast ? 1 : 0.92) : trail ? 0.8 : 0.86, trail ? { pref: isDef, high: true } : { lane: true });
  });
  while (spots.length < free.length) spots.push(spot(CX, owner.y - up * RK(50), 0.8, { high: true }));
  // ownGoal guard for very deep breakouts
  if (Math.abs(owner.y - ogy) < RK(60)) spots[spots.length - 1] = spot(laneX(t, -ownerLane || 1, 70), ogy + up * RK(90), 0.85);
  assign(spots);
}

// ---------- WITHOUT THE PUCK (they have it)
// FUNDAMENTALS (every strategy, in our end): an opponent standing alone in our slot gets picked up. Whoever is least
// needed (not on the puck, furthest from our net) leaves his spot and takes him, goal-side
function coverSlot(t, owner, plan, avail, humanOn) {
  const ogy = ownGoalY(t);
  const ours = avail.map(p => plan[p.id] ? { p, x: plan[p.id].x, y: plan[p.id].y } : { p, x: p.x, y: p.y });
  if (humanOn && ctrl && ctrl.team === t) ours.push({ p: ctrl, x: ctrl.x, y: ctrl.y });
  for (const m of teamSkaters(1 - t)) {
    if (m === owner || m.stun > 0 || hyp(m.x - CX, m.y - ogy) > RK(55)) continue;
    if (ours.some(q => hyp(q.x - m.x, q.y - m.y) < RK(26))) continue;            // someone is on him (or is going there)
    const free = avail.filter(p => plan[p.id] && !plan[p.id].chase && !plan[p.id].slotCover && p !== ctrl)
      .sort((a, b) => hyp(plan[b.id].x - CX, plan[b.id].y - ogy) - hyp(plan[a.id].x - CX, plan[a.id].y - ogy));
    const p = free[0]; if (!p) return;
    const tx = m.x + (CX - m.x) * 0.3, ty = m.y + (ogy - m.y) * 0.3;
    plan[p.id] = Object.assign(inRink(tx, ty), { u: 1, mark: m, slot: true, slotCover: true });
    const q = ours.find(o => o.p === p); if (q) { q.x = tx; q.y = ty; }
  }
}
function defensePlan(t, mine, owner, A_, plan, humanOn) {
  const ogy = ownGoalY(t), out = attackDir(t);           // out: from our goal toward centre ice
  const h = trackCarrier(t, owner);
  const key = A_.sit === 'pk' ? 'pk-' + A_.key : A_.sit === 'pp' ? 'balanced' : A_.key;
  const strat = STRATEGIES[key] || STRATEGIES.balanced;
  const avail = mine.filter(p => p.stun <= 0);
  if (!avail.length) return;
  // their goalie has it in his crease: hang back respectfully
  if (owner.g) {
    const nearest = quickest(avail, owner.x, owner.y);
    for (const p of avail) plan[p.id] = p === nearest && !goalieSafe(owner) ? { x: owner.x, y: owner.y, u: 0.9, chase: owner }
      : { x: laneX(t, natLane(p) || (p.x < CX ? -1 : 1), 55), y: ogy + out * RK(150), u: 0.8 };
    if (nearest && goalieSafe(owner)) plan[nearest.id] = { x: CX + (owner.x - CX) * 0.5, y: owner.y + attackDir(owner.team) * RK(50), u: 0.8 };
    return;
  }
  // POWER PLAY, the killers have it outside our zone: one man forechecks flat out, the rest hold the midfield
  // (spread across it, ready to take the clear and go again) instead of racing back to our end
  if (A_.sit === 'pp' && zoneFor(owner.team, owner.y) !== 'att' && !cpuWait(t)) { ppForecheck(t, avail, owner, plan, humanOn); return; }
  // predict where the carrier is going, and get goal-side of THAT point (cut off the route, don't chase the skater)
  const dCar = Math.min(...avail.map(p => dist(p, owner)));
  const lead = clamp(dCar / 2.4, 4, 32) * (h && h.circling ? 1.25 : 1);
  const P = inRink(owner.x + owner.vx * lead, owner.y + owner.vy * lead, 12);
  const gx = CX - P.x, gyv = ogy - P.y, gd = hyp(gx, gyv) || 1;
  const goalSide = d => inRink(P.x + gx / gd * d, P.y + gyv / gd * d, 8);
  const carZone = zoneFor(owner.team, owner.y);              // relative to the carrier: 'def' = deep in his own end
  const dNet = hyp(owner.x - CX, owner.y - ogy);
  const opps = teamSkaters(1 - t).filter(o => o !== owner && !o.g);
  // a carrier who just stands there gets pressured (more and more the longer he waits)
  if (TAC.stillId !== owner.id) { TAC.stillId = owner.id; TAC.stillT = 0; }
  TAC.stillT = hyp(owner.vx, owner.vy) < 0.6 ? TAC.stillT + 1 : Math.max(0, TAC.stillT - 4);
  const stalled = TAC.stillT > PLAY.stallT, longStall = TAC.stillT > PLAY.stallT * 2.4;
  // THE NEUTRAL ZONE TRAP (1-2-2): while he brings it through the midfield, one forward angles him to the boards
  // from in front, the other two wait across our blue line; whoever he skates at steps up and stands him up there
  if (key === 'trap' && carZone === 'neu' && !stalled && !(h && h.circling) && !cpuWait(t)) {
    const dBL = isUp(t) ? BLUE_BOT : BLUE_TOP, hw = (R.r - R.l) / 2, left2 = avail.slice();
    const takeQ = (x, y) => { const q = quickest(left2, x, y); left2.splice(left2.indexOf(q), 1); return q; };
    const atLine = Math.abs(owner.y - dBL) < RK(34);
    const side = owner.x < CX ? -1 : 1;
    const fx = owner.x - side * RK(14), fy = owner.y - out * RK(18);
    if (!atLine) { const f1 = takeQ(fx, fy); plan[f1.id] = Object.assign(inRink(fx, fy, 10), { u: 0.95, press: strat.press }); }
    for (const sx of [-0.32, 0.32]) {
      if (!left2.length) break;
      // the strong-side man waits on the line to step up; the weak-side man sags into our zone toward the middle,
      // so there is always someone back if the carrier gets past the stand-up
      const weak = Math.sign(sx) !== side;
      const x = CX + sx * hw * (weak ? 0.55 : 1), y = weak ? dBL - out * RK(40) : dBL + out * RK(10), d = takeQ(x, y);
      const mine = atLine && Math.sign(sx) === side;
      plan[d.id] = mine ? Object.assign(inRink(owner.x, owner.y + out * RK(4), 8), { u: 1, chase: owner, stall: true, press: strat.press * 1.5 })
                        : Object.assign(inRink(x, y, 10), { u: 0.9 });
    }
    for (const p of left2) plan[p.id] = Object.assign(inRink(CX, ogy + out * RK(70), 10), { u: 0.85 });
    return;
  }
  // the careful forecheck (every strategy but the aggressive forecheck): while they have it deep in their own end, one
  // forward shadows the carrier in the midfield just outside their blue line, steering him to the boards, and the
  // other two wait at our own blue line, spread across the ice. The aggressive forecheck goes in after it instead.
  if (carZone === 'def' && key !== 'forecheck' && key !== 'pk-aggressive' && !stalled && !(h && h.circling) && !cpuWait(t)) {
    const oBL = isUp(t) ? BLUE_TOP : BLUE_BOT, dBL = isUp(t) ? BLUE_BOT : BLUE_TOP, up = attackDir(t);
    const left2 = avail.slice(), takeQ = (x, y) => { const q = quickest(left2, x, y); left2.splice(left2.indexOf(q), 1); return q; };
    const humanNear = humanOn && ctrl && dist(ctrl, owner) < Math.min(...avail.map(p => dist(p, owner)));
    if (!humanNear) {
      const fx = CX + (owner.x - CX) * 0.6 + (owner.x < CX ? -RK(10) : RK(10)), fy = oBL - up * RK(14);
      const f1 = takeQ(fx, fy);
      plan[f1.id] = Object.assign(inRink(fx, fy), { u: 0.9, shadow: owner });
    }
    const strong = owner.x < CX ? -1 : 1;
    for (const [i, xs] of [[0, strong * RK(34)], [1, -strong * RK(48)]]) {
      if (!left2.length) break;
      let tx = CX + xs, ty = dBL - up * RK(i ? 10 : 2);
      // GAP CONTROL: a carrier coming with speed never gets level with the men waiting: they back off to stay goal-side
      // of where he'll be in a moment (a flat line at the blue line was giving up breakaways)
      const toGoal = -up, proj = owner.y + owner.vy * 24, gap = RK(i ? 40 : 28);
      if ((ty - proj) * toGoal < gap) ty = proj + toGoal * gap;
      const og = ownGoalY(t); if ((og - ty) * toGoal < RK(40)) ty = og - toGoal * RK(40);
      const d = takeQ(tx, ty); plan[d.id] = Object.assign(inRink(tx, ty), { u: 0.9 });
    }
    return;
  }
  // how many go after the puck
  let nPress = 1;
  if (key === 'forecheck' && carZone === 'def') nPress = 2;
  if (key === 'pk-box') nPress = dNet < RK(150) || (h && h.circling) ? 1 : 0;
  // the shell always keeps one man on the carrier in its own end (it contains; the squeeze below decides when he closes)
  TAC.shZ = TAC.shZ || [0, 0];
  if (key === 'shell') { nPress = carZone === 'att' || dNet < RK(150) || (h && h.circling) ? 1 : 0; TAC.shZ[t] = carZone === 'att' ? TAC.shZ[t] + 1 : 0; }
  if (key === 'splitlanes') nPress = dNet < RK(190) || (h && h.circling) ? 1 : 0;
  if (key === 'pk-aggressive') nPress = dNet < RK(260) ? 1 : 0;
  if (h && h.circling) nPress = Math.min(2, avail.length - (avail.length > 2 ? 1 : 0)) || 1;   // double-team a puck hog
  if (stalled) nPress = Math.max(nPress, 1);
  if (longStall && avail.length >= 2) nPress = Math.max(nPress, 2);
  // the human may already be the one pressing
  const humanPress = humanOn && ctrl && dist(ctrl, owner) < Math.min(...avail.map(p => dist(p, owner))) + 35;
  if (humanPress) nPress = Math.max(0, nPress - 1);
  if (cpuWait(t)) nPress = 0;
  const left = avail.slice(), take = p => { const i = left.indexOf(p); if (i >= 0) left.splice(i, 1); };
  // presser 1: goal-side of the predicted point (containment distance depends on the strategy)
  if (nPress >= 1 && left.length) {
    // gap control: contain in the midfield, close the gap at our blue line (a forecheck engages deep)
    const engage = (key === 'forecheck' && carZone === 'def') || dNet < RK(175) || (h && h.circling) || stalled;
    const gs0 = goalSide(key === 'shell' ? (dNet < RK(110) ? 7 : 12) : key === 'pk-box' ? (dNet < RK(110) ? 7 : 20) : key === 'splitlanes' ? (dNet < RK(115) ? 8 : 18) : engage ? 7 : 20);
    // lane denial: shade to the inside so he is steered to the boards, away from the middle
    const gs = key === 'splitlanes' ? inRink(gs0.x + (CX - gs0.x) * 0.18, gs0.y, 8) : gs0;
    const p1 = quickest(left, gs.x, gs.y); take(p1);
    if (stalled) {        // a carrier standing still: skate straight up to him from wherever you are (around the net if it's in the way)
      const ax = p1.x - owner.x, ay = p1.y - owner.y, ad = hyp(ax, ay) || 1;
      plan[p1.id] = Object.assign(inRink(owner.x + ax / ad * 8, owner.y + ay / ad * 8), { u: 1, chase: owner, stall: true, press: strat.press * 1.8 });
      TAC.stallFrom = { x: ax / ad, y: ay / ad };
    } else plan[p1.id] = { x: gs.x, y: gs.y, u: 1, chase: owner, stall: !!(h && h.circling), press: strat.press * (h && h.circling ? 1.6 : 1) };   // a puck hog skating in circles gets the same treatment as one standing still
    // THE SQUEEZE (Defensive Shell): once he has sat on it in our end for a couple of seconds, or comes down into
    // the slot, the presser closes from the inside and pins him to the wall
    if (key === 'shell' && !stalled && (TAC.shZ[t] > PAT.squeezeT || dNet < RK(105))) {
      const ix = CX - owner.x, iy = ogy - owner.y, idd = hyp(ix, iy) || 1;
      plan[p1.id] = Object.assign(inRink(owner.x + ix / idd * 7, owner.y + iy / idd * 7), { u: 1, chase: owner, stall: true, squeeze: true, press: strat.press * PAT.squeezePress });
      // pinned on the wall: a second man comes from the other side to trap him (the net guard stays home)
      const onWall = Math.abs(owner.x - CX) > (R.r - R.l) / 2 - RK(40);
      if (PAT.trap && onWall && left.length >= 2) {
        const p2 = left.slice().sort((a, b) => hyp(b.x - CX, b.y - ogy) - hyp(a.x - CX, a.y - ogy))[0];   // the one furthest from our net
        take(p2);
        const vx = owner.x - ix / idd * 7, ox = owner.y - iy / idd * 7;
        plan[p2.id] = Object.assign(inRink(owner.x + (owner.x > CX ? -1 : 1) * 4, owner.y - (iy / idd) * 9), { u: 1, chase: owner, stall: true, squeeze: true, press: strat.press * PAT.squeezePress });
      }
    }
  }
  // presser 2: in a forecheck, cut off his best outlet; on a puck hog, come from the other side
  if (nPress >= 2 && left.length) {
    let tx, ty;
    const outlet = opps.slice().sort((a, b) => dist(a, owner) - dist(b, owner))[0];
    if (key === 'forecheck' && outlet && !(h && h.circling)) { tx = owner.x + (outlet.x - owner.x) * 0.45; ty = owner.y + (outlet.y - owner.y) * 0.45; }
    else {   // pinch from the side he keeps turning toward
      const vx = owner.vx, vy = owner.vy, vs = hyp(vx, vy) || 1, side = (h && h.turn > 0) ? 1 : -1;
      tx = P.x + (-vy / vs) * 12 * side + vx / vs * 10; ty = P.y + (vx / vs) * 12 * side + vy / vs * 10;
    }
    if (longStall && TAC.stallFrom) {   // still standing there: the second man closes in from the other side and goes for it too
      const sf = TAC.stallFrom, r = { x: -sf.y, y: sf.x };
      const c1 = inRink(owner.x + r.x * 8, owner.y + r.y * 8), c2 = inRink(owner.x - r.x * 8, owner.y - r.y * 8);
      const pick2 = quickest(left, owner.x, owner.y), pc = dist(pick2, c1) < dist(pick2, c2) ? c1 : c2;
      tx = pc.x; ty = pc.y;
    }
    const p2 = quickest(left, tx, ty); take(p2);
    plan[p2.id] = Object.assign(inRink(tx, ty), { u: 1, chase: (h && h.circling) || longStall ? owner : null, stall: longStall || !!(h && h.circling), lane: !longStall, press: strat.press * (longStall ? 1.6 : 1) });
  }
  // IN OUR END: whoever isn't pressing holds the defend formation (the team's own, or its tactic's preset). Each
  // presser (and your own skater) takes the dot nearest him off the list; if dots are still left over, the one
  // nearest the carrier is dropped (the pressure covers it)
  if (zoneFor(owner.team, owner.y) === 'att' && left.length) {
    const lineIdx = MS && MS.lines ? MS.lines[t].idx : 0;
    const dots = formFor(tacOf(t), 'def', lineIdx, A_.sit, A_.key);
    if (dots) {
      const pts = dots.map(d => Object.assign(formWorld(t, 'def', d), { d }));
      const nearestIdx = (q) => { let bi = 0, bd = 1e9; pts.forEach((p, i) => { const dd = hyp(p.x - q.x, p.y - q.y); if (dd < bd) { bd = dd; bi = i; } }); return bi; };
      const taken = avail.filter(p => !left.includes(p)); if (humanOn && ctrl) taken.push(ctrl);
      for (const q of taken) { if (pts.length <= left.length) break; pts.splice(nearestIdx(q), 1); }
      while (pts.length > left.length) pts.splice(nearestIdx(owner), 1);
      // pair players and dots: closest pairs first
      const pairs = [];
      for (const p of left) for (const q of pts) pairs.push([hyp(p.x - q.x, p.y - q.y), p, q]);
      pairs.sort((a, b) => a[0] - b[0]);
      const usedP = new Set(), usedQ = new Set();
      for (const [, p, q] of pairs) {
        if (usedP.has(p) || usedQ.has(q)) continue; usedP.add(p); usedQ.add(q);
        const slot = q.d[1] < 0.45 && Math.abs(q.d[0]) < 0.4;
        plan[p.id] = Object.assign(inRink(q.x, q.y), { u: 0.95, slot, form: true });
      }
      if (key === 'shell') shellReadPass(t, owner, plan, left);
      coverSlot(t, owner, plan, avail, humanOn);
      return;
    }
  }
  // remaining: slot, the most dangerous lane, and (forecheck/counter) a high man
  const dangerous = opps.slice().sort((a, b) => hyp(a.x - CX, a.y - ogy) - hyp(b.x - CX, b.y - ogy));
  const tasks = [];
  if (key === 'forecheck' && carZone === 'def') tasks.push('high');
  if (key === 'counter' && carZone !== 'att' && left.length >= 2) tasks.push('stretch');
  // the anti-one-timer shapes: someone in the passing lane to the middle, someone locking the weak-side post
  const strongX = owner.x < CX ? -1 : 1;
  const weakOpp = opps.filter(o => (o.x - CX) * strongX < RK(10)).sort((a, b) => hyp(a.x - CX, a.y - ogy) - hyp(b.x - CX, b.y - ogy))[0];
  const midOpp = dangerous[0];
  if (key === 'splitlanes') { tasks.push('passlane', 'backdoor'); for (const o of dangerous) tasks.push({ o }); }
  else {
  tasks.push('slot');
  for (const o of dangerous) tasks.push({ o });
  }
  tasks.push('slot2');
  for (const task of tasks) {
    if (!left.length) break;
    let tx, ty, extra = {};
    if (task === 'slot') { tx = CX + (owner.x - CX) * 0.18; ty = ogy + out * RK(34); extra.slot = true; }
    else if (task === 'slot2') { tx = CX - (owner.x - CX) * 0.25 + (owner.x < CX ? RK(14) : -RK(14)); ty = ogy + out * RK(46); }
    else if (task === 'passlane') {     // stick in the lane from the carrier to the man in the middle (or to the slot if nobody's there)
      const tgx = midOpp ? midOpp.x : CX, tgy = midOpp ? midOpp.y : ogy + out * RK(40);
      tx = owner.x + (tgx - owner.x) * 0.42; ty = owner.y + (tgy - owner.y) * 0.42;
      ty += (ogy + out * RK(36) - ty) * 0.25; if (midOpp) extra.mark = midOpp; extra.lane = true;
    }
    else if (task === 'slotlane') {     // the middle of the slot, on the line the cross-ice pass has to use
      const sx = CX - strongX * RK(6), sy = ogy + out * RK(38);
      tx = sx + (owner.x - sx) * 0.22; ty = sy + (owner.y - sy) * 0.22; extra.slot = true;
    }
    else if (task === 'backdoor') {     // the far post, goal-side of anyone sneaking in back door
      const px0 = CX - strongX * RK(16), py0 = ogy + out * RK(16);
      if (weakOpp && hyp(weakOpp.x - CX, weakOpp.y - ogy) < RK(150)) { tx = weakOpp.x + (px0 - weakOpp.x) * 0.55; ty = weakOpp.y + (py0 - weakOpp.y) * 0.55; extra.mark = weakOpp; }
      else { tx = px0; ty = py0 + out * RK(10); }
    }
    else if (task === 'high') { const by = isUp(t) ? BLUE_TOP : BLUE_BOT; tx = CX + (owner.x < CX ? RK(25) : -RK(25)); ty = by + attackDir(t) * -8; }
    else if (task === 'stretch') { tx = laneX(t, owner.x < CX ? -attackDir(t) : attackDir(t), 60); ty = CY + attackDir(t) * RK(30); extra.stretch = true; }
    else {   // block the pass to this opponent, leaning toward the slot (shell leans further)
      const o = task.o, k = key === 'shell' || key === 'pk-box' ? 0.62 : 0.55;
      tx = owner.x + (o.x - owner.x) * k; ty = owner.y + (o.y - owner.y) * k;
      const lean = key === 'shell' || key === 'pk-box' ? 0.35 : 0.2;
      tx += (CX - tx) * lean; ty += (ogy + out * RK(40) - ty) * lean;
      extra.mark = o;
    }
    const pos = inRink(tx, ty);
    const p = quickest(left, pos.x, pos.y); take(p);
    plan[p.id] = Object.assign(pos, { u: task === 'high' || task === 'stretch' ? 0.85 : 0.95 }, extra);
  }
  // shell & penalty-kill box: stay compact around the slot
  if (key === 'shell' || key === 'pk-box' || key === 'splitlanes') for (const id in plan) {
    const g = plan[id]; if (g.chase) continue;
    const dy = (g.y - ogy) * out; if (dy > RK(110)) g.y = ogy + out * RK(110);
    g.x = CX + (g.x - CX) * 0.8;
  }
  if (zoneFor(owner.team, owner.y) === 'att') coverSlot(t, owner, plan, avail, humanOn);
}

// ---------- LOOSE PUCK
// power play: the hardest forechecker on the carrier, everyone else holding the midfield, spread across it
function ppForecheck(t, avail, owner, plan, humanOn) {
  const up = attackDir(t), left = avail.slice();
  const humanFirst = humanOn && ctrl && dist(ctrl, owner) < Math.min(...left.map(p => dist(p, owner)));
  if (!humanFirst) {
    const f = quickest(left, owner.x, owner.y); left.splice(left.indexOf(f), 1);
    plan[f.id] = { x: owner.x + owner.vx * 6, y: owner.y + owner.vy * 6, u: 1, chase: owner, press: 2.0, hurry: true, ppFore: true };
  }
  // the neutral-zone wall: between the centre line and their blue line, across the width, shading to the puck side
  const nzY = CY + up * RK(18), shade = clamp((owner.x - CX) * 0.25, -RK(20), RK(20));
  const spots = [[0, 0], [-RK(52), RK(8)], [RK(52), RK(8)]].slice(0, left.length);
  if (left.length === 2) spots.splice(0, 1);
  for (const [dx, dy] of spots) {
    const pos = inRink(CX + dx + shade, nzY - up * dy), p = quickest(left, pos.x, pos.y); if (!p) break;
    left.splice(left.indexOf(p), 1); plan[p.id] = Object.assign(pos, { u: 0.95 });
  }
}
// ---------- LOOSE PUCK
// where the puck is going: its path frame by frame (boards, rims and friction included), worked out once a frame
function puckPath() {
  if (TAC.path && TAC.path.t === S.t) return TAC.path.pts;
  const q = { x: puck.x, y: puck.y, vx: puck.vx, vy: puck.vy }, pts = [{ x: q.x, y: q.y, k: 0 }], rim = !!puck.rim;
  for (let k = 1; k <= 150; k++) {
    q.x += q.vx; q.y += q.vy;
    constrain(q, PUCK_R, rim ? 0 : 0.62); if (rim && typeof rimHug === 'function') rimHug(q);
    q.vx *= 0.986; q.vy *= 0.986;
    if (k % 2 === 0) pts.push({ x: q.x, y: q.y, k });
    if (hyp(q.vx, q.vy) < 0.08) break;
  }
  TAC.path = { t: S.t, pts };
  return pts;
}
// the earliest point on that path a skater can get to before the puck does (else where it comes to rest)
function intercept(p, pts) {
  const sp = Math.max(0.6, speedOf(p)), head = hyp(p.vx, p.vy) > 0.5 ? 0 : 6;
  for (const q of pts) {
    const tt = hyp(q.x - p.x, q.y - p.y) / sp + head;
    if (tt <= q.k) return { x: q.x, y: q.y, k: q.k, tt };
  }
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y, k: last.k, tt: hyp(last.x - p.x, last.y - p.y) / sp + head };
}
function loosePlan(t, mine, A_, plan, humanOn) {
  const ogy = ownGoalY(t), out = attackDir(t), gy = oppGoalY(t);
  const avail = mine.filter(p => p.stun <= 0);
  if (!avail.length) return;
  // OUR PASS on its way: play on as if he already has it (the receiver goes to meet it on his own)
  if (puck.passTarget && puck.passTarget.team === t && !puck.passTarget.g) {      // nobody else goes after it: carry on along your line
    for (const p of avail) if (p !== puck.passTarget) plan[p.id] = Object.assign(inRink(p.x + p.vx * 10, onsideY(t, p.y + p.vy * 10)), { u: 0.7 });
    return;
  }
  // A SHOT on its way: the shooting side crashes for the rebound, the defending side takes the front of its net
  if (puck.shot && !puck.shot.done && puck.shotTeam != null) {
    const ours = puck.shotTeam === t, ny = ours ? gy : ogy, nOut = ours ? -attackDir(t) : out;
    const near = avail.slice().sort((a, b) => hyp(a.x - CX, a.y - ny) - hyp(b.x - CX, b.y - ny));
    near.forEach((p, i) => {
      if (i === 0 && ours && hyp(p.x - CX, p.y - ny) > RK(110)) plan[p.id] = Object.assign(inRink(p.x, p.y), { u: 0.6 });   // too far away to get there in time: hold
      else if (i === 0) plan[p.id] = Object.assign(inRink(CX + (ours ? (puck.x < CX ? 1 : -1) * RK(16) : 0), ny + nOut * RK(ours ? 26 : 16)), { u: ours ? 0.85 : 1, rebound: ours, slot: !ours });
      else if (i === 1 && !ours) plan[p.id] = Object.assign(inRink(CX + (puck.x < CX ? -1 : 1) * RK(18), ny + nOut * RK(30)), { u: 0.95, slot: true });
      else plan[p.id] = Object.assign(inRink(p.x, p.y), { u: 0.6 });                    // hold your ground
    });
    return;
  }
  if (A_.sit === 'pp' && zoneFor(t, puck.y) !== 'def') {      // power play, loose puck outside our end: first man to it, the rest hold the midfield
    const pts = puckPath();
    const r = avail.map(p => ({ p, ic: intercept(p, pts) })).sort((a, b) => a.ic.tt - b.ic.tt);
    const humanNearest = humanOn && ctrl && intercept(ctrl, pts).tt < r[0].ic.tt;
    if (!humanNearest) plan[r[0].p.id] = Object.assign(inRink(r[0].ic.x, r[0].ic.y, 8), { u: 1, loose: true, hurry: true });
    const rest = (humanNearest ? r : r.slice(1)).map(x => x.p), nzY = CY + out * RK(18);
    rest.forEach((p, i) => { plan[p.id] = Object.assign(inRink(CX + [-RK(48), RK(48), 0][i % 3], nzY), { u: 0.95 }); });
    return;
  }
  // EVERYTHING ELSE (a fumble, a clear, a dump-in, a rim, a deflection, their pass): whoever gets there first goes
  // to the point where he meets it; the next man supports or covers depending on who's likely to win the race
  const pts = puckPath();
  const ranked = avail.map(p => ({ p, ic: intercept(p, pts) })).sort((a, b) => a.ic.tt - b.ic.tt);
  const human = humanOn && ctrl && !ctrl.g ? intercept(ctrl, pts) : null;
  const humanFirst = human && human.tt <= ranked[0].ic.tt;
  const opp = teamSkaters(1 - t).filter(o => o.stun <= 0);
  const oppBest = opp.length ? Math.min(...opp.map(o => intercept(o, pts).tt)) : 1e9;
  const ourBest = humanFirst ? human.tt : ranked[0].ic.tt;
  const end = pts[pts.length - 1], inOurEnd = zoneFor(t, end.y) === 'def' || zoneFor(t, puck.y) === 'def';
  const winning = ourBest < oppBest - 6 && !inOurEnd;          // in our own end nobody leaves early: win it first
  const theirPass = puck.passTarget && puck.passTarget.team !== t ? puck.passTarget : null;
  const key = A_.sit === 'pk' ? 'shell' : A_.key;
  let k = 0;
  for (const { p, ic } of ranked) {
    if (k === 0 && !humanFirst) {
      const ours = puck.lastTouch && puck.lastTouch.team === t;          // our own dump: wait at the line until it's in, or it's offside
      plan[p.id] = Object.assign(inRink(ic.x, ours ? onsideY(t, ic.y) : ic.y, 8), { u: 1, loose: true }); k++; continue;
    }
    if (k <= 1) {
      if (theirPass && hyp(p.x - theirPass.x, p.y - theirPass.y) < RK(160)) {        // their pass: get goal-side of the man it's going to
        const dx = CX - theirPass.x, dy = ogy - theirPass.y, d = hyp(dx, dy) || 1;
        plan[p.id] = Object.assign(inRink(theirPass.x + dx / d * RK(14), theirPass.y + dy / d * RK(14)), { u: 1, mark: theirPass });
      } else if (winning) {                                                           // we'll get it: be the outlet, a lane ahead of where it's picked up
        const lane = end.x < CX ? 1 : -1;
        plan[p.id] = Object.assign(inRink(laneX(t, lane * (-attackDir(t)), 55), onsideY(t, ic.y + out * RK(55))), { u: 0.9 });
      } else if (key === 'forecheck' || key === 'crash') plan[p.id] = Object.assign(inRink((end.x + p.x) / 2, end.y + (p.y < end.y ? -18 : 18)), { u: 0.95 });   // help win it
      else if (zoneFor(t, end.y) === 'att') { const by = isUp(t) ? BLUE_TOP : BLUE_BOT;      // deep in THEIR end: hold the top of the zone, not the red line
        plan[p.id] = Object.assign(inRink((end.x + CX) / 2 + (p.x < CX ? -RK(30) : RK(30)), by + out * RK(16)), { u: 0.9 }); }
      else plan[p.id] = Object.assign(inRink((end.x + CX) / 2 + (p.x < CX ? -RK(30) : RK(30)), (end.y + ogy) / 2), { u: 0.9 });            // they might win it: get between it and our net
      k++; continue;
    }
    if (key === 'counter' && winning) plan[p.id] = Object.assign(inRink(laneX(t, natLane(p) || 1, 60), onsideY(t, CY + out * RK(30))), { u: 0.9 });
    else if (zoneFor(t, end.y) === 'att' && key !== 'shell') plan[p.id] = Object.assign(inRink(CX + (p.x < CX ? -RK(40) : RK(40)), CY - out * RK(10)), { u: 0.8 });   // the safety, with the puck deep in their end: around centre ice
    else plan[p.id] = Object.assign(inRink(CX + (p.x < CX ? -RK(40) : RK(40)), ogy + out * (key === 'shell' || !winning ? 45 : 70)), { u: 0.8 });   // the safety
    k++;
  }
}

// ====================================================================
//  DEFENDER DECISIONS (called from thinkAI for a skater whose target chases the carrier)
// ====================================================================
// puck exposed: held out away from the body (a deke, a wide carry) or the carrier is fumbling a turn
function puckExposed(c) { return Math.abs(c.dkOff || 0) > 3 || (c.turnRisk || 0) > 0 || hyp(puck.x - c.x, puck.y - c.y) > STICK + 1.5; }
// vulnerable to a hit: winding up a shot, recovering from a deke, slow, or looking away from the hitter
function carrierVulnerable(c, p) {
  const sp = hyp(c.vx, c.vy), away = ((p.x - c.x) * c.fx + (p.y - c.y) * c.fy) < 0;
  return c.charge >= 0 || c.dkVuln > 0 || sp < 0.8 || (away && !S.rules);
}
function defenderAct(p, g) {
  const c = g.chase; if (!c || p.cd > 0 || p.windUp) return;
  // against YOUR carrier the CPU telegraphs: a short wind-up (a "!" over him) you can read and deke away from
  const tell = (c === ctrl && !S.autoAI || (globalThis.TELL_TEST && c.team === 0)) && p.team !== c.team && DIFF[S.diff].tell;   // (TELL_TEST: the sim treats team 0's carriers as yours)
  const go = kind => { if (tell) { p.windUp = { kind, t: kind === 'poke' ? PLAY.windPoke : PLAY.windCheck, target: c }; return true; } return false; };
  const d = dist(p, c), D = aiD(p.team);
  const human = !cpuT(p.team);
  const base = Math.max(D.check, DIFF.NORMAL.check);        // your AI teammates defend at the HARD level; the CPU hits at least as often as Normal on any level
  const oz = zoneFor(p.team, c.y) === 'att' ? lever(p.team, 'ozPress') : 1;     // the forecheck lever: harder pressure in their end
  const press = (g.press || 1) * oz;
  const sp = stickPoint(p, 14), dPk = hyp(puck.x - sp.x, puck.y - sp.y);
  // poke at the puck's anticipated position when it is exposed (or he is turning sharply)
  const tryPoke = () => {
    if (!(d < 24 && dPk < 16)) return false;
    if (typeof pokeShield === 'function' && pokeShield(p, c) > 0.5 && Math.random() < 0.9) return false;   // he's beaten: no stick through the legs
    let pk = base * 0.4 * press * (0.6 + A(p, 'def') * 0.08);
    if (puckExposed(c)) pk *= 2.6;
    if (g.stall) pk *= PLAY.stallPoke;                       // he's just standing there: go get it
    if (Math.random() < Math.min((g.stall ? TAC_BAL.pokeCap * 3 : TAC_BAL.pokeCap) * oz, pk)) { if (go('poke')) return true; const ax = puck.x + (puck.vx || 0) * 4 - p.x, ay = puck.y + (puck.vy || 0) * 4 - p.y, ad = hyp(ax, ay) || 1; p.fx = ax / ad; p.fy = ay / ad; pokeCheck(p); return true; }
    return false;
  };
  // body check when the carrier is in reach: physical players (checking above defense, enforcers) look for the hit
  // first and from further out; everyone hits a vulnerable carrier more (CPU mostly avoids hitting from behind)
  const phys = A(p, 'chk') - A(p, 'def'), brute = p.pl && p.pl.arch === 'enforcer' ? 1.5 : 1;
  const tryCheck = () => {
    if (!(d < (phys > 0.5 ? TAC_BAL.checkReach + 3 : TAC_BAL.checkReach))) return false;
    let ck = base * TAC_BAL.checkBase * press * (0.6 + A(p, 'chk') * 0.08) * brute * (1 + clamp(phys, 0, 4) * 0.12);
    if (carrierVulnerable(c, p)) ck *= 2.4;
    if (tell) ck *= TAC_BAL.tellCheck;                     // the '!' costs the CPU time (and you can read it): it looks for the hit more often so it still hits about as much
    if (Math.random() < Math.min(TAC_BAL.checkCap * oz * brute * (tell ? TAC_BAL.tellCheck : 1), ck)) {
      const fromBehind = ((c.x - p.x) * c.fx + (c.y - p.y) * c.fy) / (d || 1) > (typeof HIT !== "undefined" ? HIT.behindCos : 0.77);   // only straight into his back (±40°) counts
      if (!fromBehind || !S.rules || Math.random() < D.behind) { if (go('check')) return true; bodyCheck(p); p.recoverT = 0; return true; }
    }
    return false;
  };
  if (phys > 0.5 || brute > 1) { if (!tryCheck()) tryPoke(); } else { if (!tryPoke()) tryCheck(); }
}
// regain clock (counterattack: sprint into space right after winning the puck)
TAC.regainT = [-999, -999];
// ====================================================================
//  TEMPO AND PATTERNS: a possession in the attacking zone is either a RUSH (shoot early) or SETTLED (work it).
//  A settled carrier protects the puck along the wall, cycles low-to-high, curls back to the blue line to wait for
//  support, and passes into the patterns his teammates run: the low cycle, the give-and-go cut, the back door, the
//  feed from behind the net, the point shot through a screen. Better players read them sooner and execute them better.
// ====================================================================
TAC.poss = [null, null]; TAC.cut = [null, null];
const PAT = { trap: true, squeezeT: 110, squeezePress: 1.9, holdMixed: 200, holdMax: 600, protectMul: 0.25, protectDrain: 0.03, cutFrames: 70 };
function lineTempo(t) {
  const A_ = activeTactic(t); if (A_.sit === 'pp') return 'rush'; if (A_.sit === 'pk') return 'rush';   // the power play moves it and shoots: 30 seconds is no time to sit on it
  const tc = tacOf(t), idx = MS && MS.lines ? MS.lines[t].idx : 0;
  return (tc.tempo || [])[idx] || 'mixed';
}
// every change of puck owner: the same team keeps its possession going (a completed pass), the other starts a new one
// a team that wins the puck while two or more of the other side are deep in its end has caught them deep (Counterattack feeds on it)
TAC.deep = [-999, -999];
function tacOwner(owner, prevTeam) {
  if (owner && !owner.g && prevTeam !== owner.team && teamSkaters(1 - owner.team).filter(o => zoneFor(owner.team, o.y) === 'def').length >= 2) TAC.deep[owner.team] = S.t;
  if (!owner || owner.g) return;
  const t = owner.team;
  if (TAC.shZ) TAC.shZ[t] = 0;
  if (prevTeam !== t || !TAC.poss[t]) {
    TAC.poss[t] = { t0: S.t, passes: 0, decided: false, settled: false, seed: Math.random() }; TAC.poss[1 - t] = null; TAC.cut[1 - t] = null;
    // CRASH THE NET's price: its crashers are on top of the other net when the puck turns over, facing the wrong way,
    // and are a step slow getting back (the counterattack it is weak against)
    const L = 1 - t, AL = activeTactic(L);
    if (prevTeam === L && AL.key === 'crash' && AL.sit === 'even') for (const m of teamSkaters(L)) if (hyp(m.x - CX, m.y - oppGoalY(L)) < RK(70) && m !== ctrl) m.slow = Math.max(m.slow || 0, 28);
  }
  else TAC.poss[t].passes++;
}
const lineIQ = t => { const sk = teamSkaters(t); return sk.length ? sk.reduce((a, p) => a + (A(p, 'pas') + A(p, 'stk')) / 2, 0) / sk.length : 5; };
// depth in the attacking zone: 0 = their goal line .. 1 = their blue line (negative = behind the net)
const zoneFrac = (t, y) => (oppGoalY(t) - y) / (attackDir(t) * FORM_ZONE());
// odd-man: more of us than them between the carrier and the net (or right on his shoulder)
function oddMan(t, p) {
  const gy = oppGoalY(t), dd = Math.abs(gy - p.y);
  const us = teamSkaters(t).filter(m => Math.abs(gy - m.y) < dd + RK(40)).length;
  const them = teamSkaters(1 - t).filter(o => Math.abs(gy - o.y) < dd + RK(10)).length;
  return us > them;
}
// the open teammate the play is looking for, and how good a look it is (better passers read it more reliably)
function patternTarget(p, noisy = true) {
  const t = p.team, gy = oppGoalY(t), mates = teamSkaters(t).filter(m => m !== p && m.stun <= 0), opps = teamSkaters(1 - t), iq = (A(p, 'pas') + A(p, 'stk')) / 2;
  let best = null, bs = 0.6;
  for (const m of mates) {
    if (opps.some(o => dist(o, m) < RK(22))) continue;
    if (zoneFor(t, m.y) !== 'att') continue;                                           // the patterns stay inside the zone
    const dx = m.x - p.x, dy = m.y - p.y, d2 = dx * dx + dy * dy || 1;
    if (opps.some(o => { const k = clamp(((o.x - p.x) * dx + (o.y - p.y) * dy) / d2, 0, 1); return hyp(o.x - (p.x + dx * k), o.y - (p.y + dy * k)) < RK(11); })) continue;
    const dn = hyp(m.x - CX, m.y - gy), fr = zoneFrac(t, m.y), sideP = Math.sign(p.x - CX) || 1, sideM = Math.sign(m.x - CX) || 1;
    let sc = 0;
    if (TAC.cut[t] && TAC.cut[t].id === m.id && TAC.cut[t].until > S.t) sc += 2.5;      // give-and-go: hit the cutter
    if (dn < RK(75)) sc += 2 * (1 - dn / RK(75));                                       // the slot
    if (sideM !== sideP && fr < 0.35 && fr > 0) sc += 1.4;                               // the back door
    if (fr > 0.75) sc += 0.6;                                                            // the point (reset)
    sc -= Math.sqrt(d2) / RK(260);
    if (noisy) sc += (Math.random() - 0.5) * (10 - iq) * 0.18;
    if (sc > bs) { bs = sc; best = m; }
  }
  return best;
}
function aimPass(p, m) {
  const dx = m.x + (m.vx || 0) * 6 - p.x, dy = m.y + (m.vy || 0) * 6 - p.y, d = hyp(dx, dy) || 1;
  p.fx = dx / d; p.fy = dy / d;
  pass(p, clamp(d / RK(180), 0.2, 0.8), { x: dx / d, y: dy / d });
}
// the AI carrier in a settled possession (true = he did something this frame)
function carrierCycle(p) {
  const t = p.team; if (p.g || S.phase !== 'live' || S.so) return false;
  if (activeTactic(t).sit === 'pk' || zoneFor(t, puck.y) !== 'att') return false;
  const P = TAC.poss[t]; if (!P) return false;
  if (!P.decided) { P.decided = true; const tp = lineTempo(t); P.settled = tp === 'cycle' || (tp === 'mixed' && !oddMan(t, p)); P.zoneT = S.t; P.holdMax = tp === 'cycle' ? PAT.holdMax : PAT.holdMixed; }
  if (!P.settled) return false;
  const up = attackDir(t), gy = oppGoalY(t), dg = hyp(CX - p.x, gy - p.y), held = S.t - P.zoneT, iq = (A(p, 'pas') + A(p, 'stk')) / 2, fr = zoneFrac(t, p.y);
  if (held > (P.holdMax || PAT.holdMax)) { P.settled = false; return false; }                                   // patient long enough: back to normal
  if (dg < RK(58) && fr > 0.02 && laneOpen(p, gy)) return false;                                   // a real chance: take it
  const mates = teamSkaters(t).filter(m => m !== p), opps = teamSkaters(1 - t);
  const support = mates.filter(m => zoneFor(t, m.y) === 'att' && dist(m, p) < RK(150)).length;
  let nd = 1e9; for (const o of opps) nd = Math.min(nd, dist(o, p));
  // move it into the pattern: under pressure, or when the read comes (sooner for better players)
  if (p.passCd <= 0 && support >= 1 && (nd < RK(26) || (S.t + p.id * 7) % Math.max(18, Math.round(64 - iq * 4)) === 0)) {
    const m = patternTarget(p);
    if (m && Math.random() < 0.4 + iq * 0.05) {
      aimPass(p, m);
      if (!hasPuck(p)) { if (Math.random() < 0.3 + iq * 0.06) TAC.cut[t] = { id: p.id, until: S.t + PAT.cutFrames }; return true; }
    }
  }
  // the point shot through a screen: high in the zone with a teammate parked at the net
  if (fr > 0.72 && p.charge < 0 && mates.some(m => hyp(m.x - CX, m.y - gy) < RK(42)) && Math.random() < 0.02 * (A(p, 'pow') / 6)) { p.charge = 0; p.chargeTarget = A(p, 'pow') >= 6 ? rand(0.72, 0.95) : rand(0.4, 0.65); return true; }
  // skate it: protect along the wall, low-to-high cycle, or curl back high to wait for support
  const side = p.x >= CX ? 1 : -1, hw = (R.r - R.l) / 2, blueY = isUp(t) ? BLUE_TOP : BLUE_BOT;
  // a real cycle COMMITS: down the wall to the corner, then back up the half-wall, then down again (switching only at
  // the ends; deciding afresh every frame made him stall and spin right at the switch point)
  if (!P.cdir) P.cdir = fr > 0.3 ? 'down' : 'up';
  if (P.cdir === 'down' && fr < 0.1) P.cdir = 'up'; else if (P.cdir === 'up' && fr > 0.55) P.cdir = 'down';
  let tx, ty;
  if (support < 1 || (support < 2 && nd < RK(34) && fr > 0.45)) { tx = CX + side * hw * 0.55; ty = blueY + up * RK(16); }   // delay: curl back up top and wait for help
  else if (P.cdir === 'up') { tx = CX + side * (hw - RK(18)); ty = gy - up * RK(125); }                       // up the half-wall
  else { tx = CX + side * (hw - RK(16)); ty = gy - up * RK(6); }                                              // down low along the boards
  // safety valve: if he still isn't getting anywhere, stop the pattern and just play (shoot, pass, or take it to the net)
  if (!P.mv || S.t - P.mv.t >= 45) {
    if (P.mv && hyp(p.x - P.mv.x, p.y - P.mv.y) < RK(14)) { P.settled = false; return false; }
    P.mv = { t: S.t, x: p.x, y: p.y };
  }
  p.protect = S.t + 3;
  if (MS && p.pl) MS.stam[p.pl.id] = Math.max(0, (MS.stam[p.pl.id] ?? 100) - PAT.protectDrain);
  steerTo(p, tx, ty, 0.82, 4);
  return true;
}
// PATTERNS for the skaters without the puck: the formation's spot nearest each pattern role takes that role
function patternSpots(t, owner, spots) {
  const P = TAC.poss[t]; if (!P || !P.settled) return spots;
  const fr = zoneFrac(t, owner.y), s = owner.x >= CX ? 1 : -1, iq = lineIQ(t);
  if (P.seed > 0.35 + iq * 0.06) return spots;                        // this line doesn't read the pattern this time
  const gy = oppGoalY(t), up = attackDir(t), W = (x, d) => ({ x: CX + x * ((R.r - R.l) / 2 - RK(14)), y: gy - up * d * FORM_ZONE() });
  const roles = [];
  if (fr < 0.02) roles.push(['feed', W(0, 0.34)], ['post', W(-s * 0.32, 0.12)]);                 // behind the net: feed to the slot, far post
  else if (fr < 0.32) roles.push(['wall', W(s * 0.78, 0.5)], ['door', W(-s * 0.42, 0.2)]);       // low: half-wall support, the back door
  else if (fr > 0.78) roles.push(['screen', W(0, 0.12)]);                                         // point: a body in front
  const used = new Set();
  for (const [role, q] of roles) {
    let bi = -1, bd = 1e9; spots.forEach((sp, i) => { if (used.has(i) || sp.safety) return; const d = hyp(sp.x - q.x, sp.y - q.y); if (d < bd) { bd = d; bi = i; } });
    if (bi < 0) continue; used.add(bi);
    spots[bi] = Object.assign(inRink(q.x, q.y), { u: 0.95, pattern: role, screen: role === 'screen', rebound: role === 'screen' });
  }
  return spots;
}
function tacOnPossession(owner) { if (owner && !owner.g) TAC.regainT[owner.team] = S.t; }

// ====================================================================
//  CARRIER DECISIONS: strategy-flavoured tweaks layered onto thinkCarrierAI
// ====================================================================
// returns true if it took an action this frame
function carrierTactics(p) {
  const t = p.team, A_ = activeTactic(t), up = attackDir(t), gy = oppGoalY(t), ogy = ownGoalY(t);
  const inOwnHalf = (p.y - CY) * up > 0;
  if (carrierCycle(p)) return true;
  const nearOpp = teamSkaters(1 - t).some(o => o.stun <= 0 && dist(o, p) < 26);
  // shorthanded (or shell under pressure) in our own end: get it out
  if ((A_.sit === 'pk' || (A_.key === 'shell' && nearOpp && hyp(p.x - CX, p.y - ogy) < RK(80))) && Math.abs(p.y - ogy) < RK(150) && p.passCd <= 0 && Math.random() < (A_.sit === 'pk' ? 0.035 : 0.015)) { clearPuck(p); return true; }   // the shell only bangs it out from right in front of its own net
  // counterattack: the first touch after a regain looks for a long outlet
  if ((A_.key === 'counter' || A_.sit === 'pp') && p.passCd <= 0 && S.t - TAC.regainT[t] < (A_.key === 'counter' ? 40 : 999) && inOwnHalf && openTeammateAhead(p) && Math.random() < 0.18) { pass(p); return !hasPuck(p); }
  // power play: keep it moving, look for the open shooter
  if (A_.sit === 'pp' && p.passCd <= 0 && Math.random() < 0.01 * (A(p, 'pas') / 5) && openTeammateAhead(p)) { pass(p); return !hasPuck(p); }
  // crash the net: get pucks to the net from further out
  if (A_.key === 'crash' && p.plan && !p.plan.crashSet) { p.plan.crashSet = true; p.plan.shootDist = Math.max(p.plan.shootDist, RK(rand(110, 150))); }
  return false;
}
// a clearing attempt: high off the glass toward the far end
function clearPuck(p) {
  const t = p.team, up = attackDir(t);
  const pk = typeof shortHanded === 'function' && shortHanded(t), fromOwnHalf = ownHalf(p);
  // near the boards, a clear is often rimmed: hard along the wall, around the far end. From our own half that's
  // icing, so only a penalty killer (allowed to ice it) rims it from there
  if (typeof rimPuck === 'function' && (pk || !fromOwnHalf) && Math.abs(p.x - CX) > RK(45) && Math.random() < 0.35) { p.fx = 0; p.fy = up; if (rimPuck(p, 0.9)) return; }
  let tx, ty, sp = 7 + A(p, 'pow') * 0.15;
  if (pk || !fromOwnHalf) { tx = CX + (p.x < CX ? 1 : -1) * RK(rand(40, 110)); ty = oppGoalY(t) - up * RK(rand(-10, 60)); }   // down the ice: on the PK icing is free
  else {
    // at even strength from our half: a controlled clear off the boards that dies in the midfield or just
    // inside their blue line, never past their goal line (puck speed decays 1.4% a frame: it travels about 70x its speed)
    tx = CX + (p.x < CX ? -1 : 1) * RK(rand(70, 120)); ty = (isUp(t) ? BLUE_TOP : BLUE_BOT) - up * RK(rand(-20, 30));
    const d0 = hyp(tx - puck.x, ty - puck.y);
    sp = Math.min(sp, d0 / 70 * 1.05);
  }
  // a hurried clear doesn't always get out: rushed off the stick it can die near the blue line (the better the hands, the rarer)
  if (Math.random() < 0.34 - A(p, 'stk') * 0.02) sp *= rand(0.45, 0.62);
  const dx = tx - puck.x, dy = ty - puck.y, d = hyp(dx, dy) || 1;
  releasePuck(p, dx / d * sp, dy / d * sp, 20); puck.deliberate = p;
  puck.passTarget = null; puck.shotTeam = null; puck.iceTeam = fromOwnHalf ? p.team : null; puck.clearT = S.t;
  p.passCd = 30; sfx.pass();
  if (Math.random() < 0.4) say(['CLEARED OUT OF DANGER.', 'HE FIRES IT DOWN THE PITCH.'], 1, 0.4);
}
