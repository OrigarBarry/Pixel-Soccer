'use strict';

// ====================================================================
//  CONSTANTS & GEOMETRY  (world units; canvas renders at K device px per unit)
// ====================================================================
const SS = 1.15;             // sprite pixel size in world units
const K = 3 / SS;            // device px per world unit (sprite pixels land on 3 device px)
const HUDH = 26;             // HUD strip height (world units)
// the rink was enlarged 15% (v2 geometry): the ice, its lines, circles, creases and nets all grew; the people, the
// benches, the tunnels and the stands around it did not. RINK_S converts old rink distances to the new rink.
const RINK_S = 1.15, RINK_GEO = 2;
const W = 532, H = 821;
const R = { l: 100, r: 432, t: 116, b: 707, cr: 16 };   // deep stands all around (SOCCER: the hoardings round the pitch, nearly square at the corners)
const CX = (R.l + R.r) / 2, CY = (R.t + R.b) / 2;
const GL_TOP = R.t + 46, GL_BOT = R.b - 46;
const TL_L = R.l + 7, TL_R = R.r - 7;     // SOCCER: the touchlines (the goal lines are GL_TOP / GL_BOT); beyond them, the run-off grass to the hoardings
const PEN_HW = 98, PEN_D = 80, SIX_HW = 44, SIX_D = 27, PEN_SPOT = 54, CIRCLE_R = 44;   // penalty area, goal area, spot, centre circle
const GOAL_HW = 28, NET_D = 15, NET_H = 16;          // half-width of the mouth, depth, crossbar height (SOCCER: a full-size goal, about four players wide)
const GOAL_SC = GOAL_HW / 17.25;
var GK_REACH = 1.9;   // tuned in simulated matches: about 2.5 goals a game, as before the goals grew                         // how much bigger than the hockey net it was tuned on: the keeper's reach scales with it
const BLUE_TOP = CY - 94.3, BLUE_BOT = CY + 94.3;
const END_DOT_Y = [GL_TOP + 60, GL_BOT - 60], NEU_DOT_Y = [BLUE_TOP + 18.4, BLUE_BOT - 18.4];
const DOT_DX = 80.5, FO_R = 25.3, CC_R = 30, CREASE_R = 17.25;   // faceoff dots off centre, faceoff circle, centre circle, crease
const SHOT_FULL_FRAMES = 72;
const BALL_FRIC = 0.983;
// SOCCER: THE BALL IN THE AIR. puck.h = height (world units; a player's head is about 21), puck.vh = climb per frame
const AIR = { grav: 0.16, fric: 0.996, bar: 16, foot: 5, headLo: 11, headHi: 27, keeperReach: 20, bounce: 0.38, aiCross: 0.05, aiCrossPressed: 0.14 };      // SOCCER: rolling friction per frame (the puck glided at 0.986)
const halfName = n => n >= 4 ? 'EXTRA TIME' : n >= 3 ? '2ND' : '1ST';   // SOCCER: periods 2 and 3 are the two halves
const PUCK_R = 1.5, SKATER_R = 5, GOALIE_R = 6.2;
const STICK = 7.7;            // stick reach (world)

const TEAM = [teamPalette(DEFAULT_TEAMS.blizzard, false), teamPalette(DEFAULT_TEAMS.inferno, true)];
// DIFFICULTY. Normal and Hard give nobody a stat edge: every skater, goalie, poke, big hit and shot uses the same
// numbers whoever controls him. What still changes is how WELL the CPU plays (decision-making): how fast it reacts,
// how often it shoots / checks / one-times, how clean its faceoff timing is. Only Easy tilts the numbers, slightly,
// toward you. Fields:
//   cpuSpd  CPU skater top speed (x the shared 2.05 base)      poke   CPU stick-check success (yours is 0.8)
//   save    CPU goalie save shift   gHelp  your goalie's shift  gPoke  CPU goalie poke-check (yours is 0.6)
//   bigThr  extra approach speed the CPU needs for a big hit   aim    extra spray on CPU shots
//   tell    the CPU shows a "!" wind-up before it pokes / checks your carrier
//   react / shoot / check / oneT / behind: CPU decision-making (frames to react after a faceoff, shot, check
//   and one-timer eagerness, chance it will run a man from behind)
// the AI's dangle / spin (per difficulty; spin = chance per hit it sees coming, dangle = chance per frame with a man in front)
const AI_DEKE = { EASY: 0, NORMAL: 0, HARD: 1, spin: 0.35, dangle: 0.03, dangleZone: 130 };   // NORMAL: 0.6 once the Hard version is approved
const DIFF = {
  EASY:   { shotMix:0.25, cpuSpd:0.91, poke:0.62, save:-0.05, gHelp:0.04, gPoke:0.45, bigThr:0.06, aim:0.06, tell:true,  react:24, shoot:0.014, check:0.012, oneT:0.15, behind:0.0 },
  NORMAL: { shotMix:0.7, cpuSpd:1.0,  poke:0.8,  save:0,     gHelp:0,    gPoke:0.6,  bigThr:0,    aim:0.02, tell:true,  react:16, shoot:0.018, check:0.021, oneT:0.25, behind:0.02 },
  HARD:   { shotMix:1, cpuSpd:1.0,  poke:0.8,  save:0.025,     gHelp:0,    gPoke:0.6,  bigThr:0,    aim:0,    tell:false, react:9,  shoot:0.023, check:0.032, oneT:0.36, behind:0.02 },
};
// the man advantage: a penalty killer is covering more ice than he can, so his stick-checks land less often, and the
// goalie behind him faces an open man / cross-ice looks (applies to everyone the same way, whatever the ratings)
const PP_EDGE = {
  pkSpd: 0.92,    // penalty killers' top speed: they can't cover all the ice
  pkDrain: 1.6,   // and they tire faster chasing
  shoot: 1.5,     // the open man shoots more readily
  save: -0.045,  // a short-handed goalie faces more traffic and more open looks (tuned: PP conversion 25-35% whatever the tactics)
  tac: { umbrella: -0.025, overload: 0, box: 0, aggressive: 0 },   // per PP / PK tactic, so every pairing lands in that band
};
let GOALIE_BASE = 0.021;
let GK_HUMAN = 0.045;     // games you play: both goalies keep the strength they had before the cross-crease saves were added (the CPU-only sims were re-tuned to 0.021 with the AI sprinting)   // everybody's goalie (also feeds the reach model below through GKR.mod)
// the save model's numbers (pixels of reach): ratings, shot speed (only counts close in), distance, tips, set-ups, fatigue, a goalie still moving, rebounds
// GKR.base 0.035 -> 0.026 (Nov 23): user's goals target 3.2-3.5 a game. CPU-game means: 0.035 3.19 (400 games), 0.030 3.29 (600), 0.027 3.26 (600), 0.026 3.41 (600), 0.025 3.43 (1000), 0.015 3.52
const GKR = { lat: { on: 1, w: 9, d: 7 }, lone: 0.7, rLow: 12.5, rMid: 12.5, rHigh: 12, rLowDown: 14, rMidDown: 9, rHighDown: 6, band: 3, ref: 0.3, speed: 0.55, far: 0.2, farMax: 8, tip: 4, setup: 35, fat: 3, moving: 3, mod: 30, base: 0.026, rebSpeed: 5.6, rebMin: 5.4, rebCtl: 0.45, rebCtlPer: 0.08 };
// SHOT TYPES (Nov 22): what makes a shot dangerous is deception and release, not just power. Units are goalie reach
//  (how far from his centre he gets something on it). unset: a goalie who hasn't settled since he last moved;
//  lat: the shooter moving across the goalie's eyes at release; deke: a quick release straight out of a deke;
//  kind: each type's own edge (snap = quick release; backhand = surprise in tight; slap = a readable wind-up, but a
//  screen or tip makes up for it; wrist from distance = he sees it all the way); otLat: a one-timer's bite scales with
//  how far the pass moved across him
const SHOTX = { setFrames: 18, unset: 2.6, refK: 0.06, lat: 1.9, deke: 2.4, snap: 1.3, backTight: 0.3, backFar: -0.6, slap: -0.9, slapScreen: 1.6, wristFar: -0.8, otBase: 0.55,
  dekeWin: 40, info: { set: 0.45, lat: 0.4 }, norm: 1.2 };   // norm: the average edge, taken back off (the league's scoring stays where it was; it's redistributed by shot quality)
const SPEEDS = { RELAXED:0.72, NORMAL:0.86 };   // (FAST removed: Normal is the game's speed; Hard is always played at Normal)
const BENCH_LEN = 140, BENCH_Y = [CY - 33 - BENCH_LEN, CY + 33];   // [home, away] bench tops on the left boards
// the bench enclosures (set back into the stands), the corridor between them and the players' tunnel under the stands
const BENCH_X0 = 56, TUN = { x0: 24, x1: BENCH_X0, y0: CY - 27, y1: CY + 27 }, GATE = { y0: CY - 12, y1: CY + 12 };
const WALK_SPAWN = [{ x: 36, y: CY - 15 }, { x: 36, y: CY + 14 }];       // [home, away]: where each team fades in at the tunnel mouth
// the Zamboni's own tunnel under the stands behind the bottom end boards
// the Zamboni doors and tunnel (Nov 22: the doors are 1.75x wider, 64 instead of 36, for the bigger machine)
const ZGATE_HW = 32;
const ZTUN = { x0: CX - 50, x1: CX + 50, y0: R.b + 6, y1: H };
// each bench has two gates in the boards: the one nearer the team's own goalie is the OFF gate (players coming off),
// the other is the ON gate (players going on); which is which follows the goalie when the teams switch ends
function benchGateSpots(home) {
  const y0 = BENCH_Y[home ? 0 : 1], y1 = y0 + BENCH_LEN;
  return home ? { upper: { y0: y0 + 8, y1: y0 + 32 }, lower: { y0: y1 - 42, y1: y1 - 18 } } : { upper: { y0: y0 + 18, y1: y0 + 42 }, lower: { y0: y1 - 32, y1: y1 - 8 } };
}
function benchGates(t) {
  const hm = S.match ? (S.match.home ?? 0) : 0, home = t === hm, G = benchGateSpots(home);
  const g = typeof goalies !== 'undefined' && goalies[t], gUp = g && g.y ? g.y < CY : home;
  // a fresh player always steps on through the door that opens into the NEUTRAL zone: each bench has one door past a
  // blue line, and a man hopping on there was already offside (two reported offsides came from exactly that)
  const mid = d => (d.y0 + d.y1) / 2, neutral = d => mid(d) > BLUE_TOP + 6 && mid(d) < BLUE_BOT - 6;
  let on = gUp ? G.lower : G.upper, off = gUp ? G.upper : G.lower;
  if (!neutral(on) && neutral(off)) { const x = on; on = off; off = x; }
  return { off, on };
}
const WALK_LANE_X = [74, 72], BENCH_DOOR_X = 73, BACK_BENCH_X = BENCH_X0 + 7;   // corridor lanes, bench doorways, the back bench
const CAMS = { CLOSE:{ w:340, h:252 }, WIDE:{ w:430, h:370 }, FULL:{ w:392, h:690 } };   // FULL: tall enough that the bottom end clears the commentary bar   // FULL: the whole rink with its boards, nets and goal lamps   // visible world height
const NETS = [
  { team:1, x0:CX-GOAL_HW-2, x1:CX+GOAL_HW+2, y0:GL_TOP-NET_D, y1:GL_TOP, lineY:GL_TOP, front:+1 },
  { team:0, x0:CX-GOAL_HW-2, x1:CX+GOAL_HW+2, y0:GL_BOT, y1:GL_BOT+NET_D, lineY:GL_BOT, front:-1 },
];
// ends switch every period: S.upTeam attacks up (shoots on the top goalie). The home goalie guards the bottom net in the 1st and 3rd (home shoots up), the top one in the 2nd and overtime.
const isUp = t => t === S.upTeam;
// a team the computer plays: always team 1, and both teams when you are only watching (WATCH CPU VS CPU, menu demo)
const cpuT = t => t === 1 || !!S.autoAI;
// AI decision level for a team: the opponent plays at the chosen difficulty, your AI teammates always play at HARD
const aiD = t => cpuT(t) ? DIFF[S.diff] : DIFF.HARD;
const HARD_SLOT_LOOK = 0.6;   // (Nov 22) Hard: chance to pass to an open man in the slot instead of a planned shot from outside it
// the computer's reaction pause after a faceoff (the side that won it may go at once when the computer plays both sides)
const cpuWait = t => cpuT(t) && S.cpuDelay > 0 && !(S.autoAI && S.foWinner === t);
const attackDir = t => isUp(t) ? -1 : 1;
const oppGoalY  = t => isUp(t) ? GL_TOP : GL_BOT;
const ownGoalY  = t => isUp(t) ? GL_BOT : GL_TOP;
function setEnds(force) {
  const home = S.match ? S.match.home : 0;
  S.upTeam = force != null ? force : (S.period % 2 === 1 && S.period <= 3 ? home : 1 - home);   // home goalie guards the BOTTOM net in the 1st and 3rd
  NETS[0].team = 1 - S.upTeam; NETS[1].team = S.upTeam;   // NETS[0] is the top net
  for (const t of [0, 1]) EMPTY_NET[t].y = isUp(t) ? GL_BOT - 8 : GL_TOP + 8;
}
const textCol = T => teamTextColor(T);

// ====================================================================
//  STATE
// ====================================================================
const S = {
  screen:'menu', phase:'faceoff', timer:0, period:1, upTeam:0, clock:100, periodLen:100,
  score:[0,0], sog:[0,0], assist:true, rules:true, diff:'EASY', speed:'NORMAL', cam:'FULL', camPref:'AUTO', camChk:0, match:null, sceneFitT:0,
  teamSel:[0,1], manualHold:0, t:0, hintT:0, cpuDelay:0, goalFlash:0, lastGoalTeam:-1, firstMatch:true,
  fo:{ x:CX, y:CY }, banner:null, sound:true, textSize:'LARGE', excite:0, next:null, pen:null, cheer:0, lamp:[0,0], prevPY:CY,
};
// text size (accessibility): DOM text scales by TS, canvas text by CTS (capped so on-ice banners still fit)
const TEXT_SIZES = { NORMAL:1, LARGE:1.2, 'X-LARGE':1.35, HUGE:1.5 };
let TS = 1.2, CTS = 1.2;
function applyTextSize() { TS = TEXT_SIZES[S.textSize] || 1.2; CTS = Math.min(TS, 1.3); if (typeof document !== 'undefined' && document.documentElement) document.documentElement.style.setProperty('--ts', TS); if (typeof applyStage === 'function') applyStage(); }
const shotFrames = () => Math.round(SHOT_FULL_FRAMES * SPEEDS[S.speed]);
const viewH = () => CAMS[S.cam].h, viewW = () => CAMS[S.cam].w;
// (Nov 23) CAMERA: AUTO (the default) picks by the window's shape: WIDE on a landscape screen (FULL left the rink a narrow
// strip and the players tiny), FULL on a tall one. FULL / WIDE / CLOSE are still there to pick by hand (S.camPref).
const CAM_PREFS = ['AUTO', 'FULL', 'WIDE', 'CLOSE'];
function camAuto() { return innerWidth >= innerHeight * 1.15 ? 'WIDE' : 'FULL'; }
function camWanted() { return S.camPref && S.camPref !== 'AUTO' && CAMS[S.camPref] ? S.camPref : camAuto(); }
function camLabel() { return (S.camPref || 'AUTO') === 'AUTO' ? 'AUTO · ' + camWanted() : S.camPref; }
function nextCamPref() { return CAM_PREFS[(CAM_PREFS.indexOf(S.camPref || 'AUTO') + 1) % CAM_PREFS.length]; }
function applyCamPref(force) {
  if (S.demo) return;
  const want = camWanted(); if (want === S.cam && !force) return;
  S.cam = want;
  if (typeof sizeCanvas === 'function' && typeof cvs !== 'undefined') { sizeCanvas(); updateCamera(true); if (typeof fitScene === 'function') fitScene(); }
}
let camY = 26, camX = 0;
let players = [], skaters = [], goalies = [], refs = [];
// POOL holds every on-ice slot that can exist: per team skater slots 0-2 (LW, C, RW), an extra skater slot 3, and the goalie.
// players / skaters / goalies are rebuilt from it whenever the manpower changes (power plays, pulled goalies, 4-on-4).
// Order is fixed (replays index into it): t0 r0..2, t0 G, t1 r0..2, t1 G, t0 r3, t1 r3.
let POOL = [];
function rebuildActive() {
  players = POOL.filter(p => p.on);
  skaters = players.filter(p => !p.g);
  goalies = [0, 1].map(t => players.find(p => p.g && p.team === t) || null);
}
const goalieObj = t => POOL.find(p => p.g && p.team === t);
// when a net is empty, aim/shot maths use a stand-in at the goal mouth (never moves, never saves)
const EMPTY_NET = [0, 1].map(t => ({ ghost: true, g: true, team: t, x: CX, y: t === 0 ? GL_BOT - 8 : GL_TOP + 8, down: 0, gLunge: 0, pl: null, vx: 0, vy: 0 }));
const gk = t => goalies[t] || EMPTY_NET[t];
const extraObj = t => POOL.find(p => !p.g && p.team === t && p.role === 3);
let ctrl = null, switchCd = 0;
const puck = { x:CX, y:CY, vx:0, vy:0, owner:null, passTarget:null, shotTeam:null, lastTouch:null, iceTeam:null,
  passed:new Set(), inNet:false, trail:[] };
const particles = [], floaters = [];
// (Nov 22 text pass) a new floating call that would land on top of one still showing is lifted above it
floaters.push = function (...items) {
  for (const f of items) {
    if (!f || f.bubble) continue;
    const w = (f.text || '').length * (f.big ? 9 : 5);
    for (let k = 0; k < 4; k++) {
      const hit = this.find(o => o !== f && o.life > 6 && !o.bubble && Math.abs(o.x - f.x) < (w + (o.text || '').length * (o.big ? 9 : 5)) / 2 && Math.abs(o.y - f.y) < (f.big || o.big ? 15 : 9));
      if (!hit) break;
      f.y = hit.y - (f.big || hit.big ? 16 : 10);
    }
  }
  return Array.prototype.push.apply(this, items);
};
const input = { spacePressed:false, shiftPressed:false, shiftPending:false, shiftAt:0, passPressed:false, pokePressed:false, linePressed:false, coverPressed:false };

// movement keys: WASD or the arrow keys
// movement and every other control go through the rebindable action table (input.js)
const KU = () => Input.down('up'), KD = () => Input.down('down'), KL = () => Input.down('left'), KR = () => Input.down('right');

function mkPlayer(team, role, g) {
  return { team, role, g, num: g ? 30 + team : 10 + role, id: team * 10 + (g ? 9 : role), pl: null,
    x:0, y:0, vx:0, vy:0, fx:0, fy:attackDir(team), inx:0, iny:0, mx:0, my:0,
    stun:0, slow:0, cd:0, lunge:0, lungeDx:0, lungeDy:0, checkTarget:null, poke:0, block:0,
    hold:0, charge:-1, chargeTarget:0, passCd:0, anim:Math.random()*10, lastVx:0, lastVy:0, recvT:-99, aim:null };
}
function makeTeams() {
  POOL = [];
  for (const t of [0, 1]) {
    for (const r of [0, 1, 2]) POOL.push(mkPlayer(t, r, false));
    POOL.push(mkPlayer(t, 1, true));
  }
  for (const t of [0, 1]) { const x = mkPlayer(t, 3, false); x.on = false; POOL.push(x); }
  for (const p of POOL) if (p.on !== false) p.on = true;
  rebuildActive();
  // attach roster players from the match lineups (line 1 starts)
  const M = S.match;
  if (M && M.lineups) for (const p of players) {
    const lu = M.lineups[p.team];
    p.pl = p.g ? lu.goalie : (typeof RS === 'function' && RS() ? lineFor(p.team, 0)[p.role] : lu.lines[0][p.role]);
    p.cap = p.pl && lu.leaders ? lu.leaders[p.pl.id] || null : null;
    p.num = p.pl ? p.pl.num : p.num;
  }
  refs = [0, 1].map(i => ({ x: i ? CX - DOT_DX : CX + DOT_DX, y: CY + (i ? 69 : -69), vx:0, vy:0, fx:0, fy:1, anim:0, arm:0, mx:0, my:0 }));
}

// ====================================================================
//  HELPERS
// ====================================================================
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
// attribute lookup (1-10, 5 = average) for whoever is in this on-ice slot
// effective rating: base + traits + leadership + condition + morale (refreshed by refreshEff in rules.js); base rating otherwise
const A0 = (p, k) => p && p.eff && p.eff[k] != null && p.effPl === p.pl ? p.eff[k] : (p && p.pl && p.pl.attrs && p.pl.attrs[k] != null) ? p.pl.attrs[k] : 5;
const GK_ADJ_K = { ref: 1, pos: 1, reb: 1 };
// franchise games: goalies rated against the league's average starter (S.gkAdj, set in startMatch; see gkLeagueAdj in league.js)
const A = (p, k) => { const v = A0(p, k); return S.gkAdj && p && p.g && GK_ADJ_K[k] ? v + S.gkAdj : v; };
const hyp = (x, y) => Math.sqrt(x * x + y * y);        // (Math.hypot is several times slower and the game never needs its overflow guard)
const rand = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => hyp(a.x - b.x, a.y - b.y);
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2*Math.PI; while (d < -Math.PI) d += 2*Math.PI; return d; }
function hasPuck(p) { return puck.owner === p; }
// each team's skaters on the ice: rebuilt only when the on-ice list itself changes (it is asked for many times a frame).
// Callers must not sort or splice the result in place (copy it first: .slice())
let _tsArr = null, _tsRes = [null, null];
function teamSkaters(t) {
  if (_tsArr !== skaters) { _tsArr = skaters; _tsRes = [skaters.filter(p => p.team === 0), skaters.filter(p => p.team === 1)]; }
  return _tsRes[t];
}
// the blade: ahead of him and a little to his shooting side (left-handed shots carry it on the left)
function stickPoint(p, reach = STICK) {
  const l = (p.g || typeof handSign !== 'function' ? 0 : handSign(p) * 3) * Math.min(1, reach / STICK);
  return { x: p.x + p.fx * reach - p.fy * l, y: p.y + (p.fy * reach + p.fx * l) * 0.85 };   // (no fixed screen-down offset: the same reach up or down the ice)
}
// the tape of his blade exactly where the sprite draws it (world units): a carried puck sits there, and a loose puck
// that reaches it can be picked up there, so the puck plays where you see it
function bladeWorld(p) {
  if (p.g || typeof stickGeo !== 'function') return stickPoint(p);
  const g = stickGeo(p, 0);
  return { x: p.x + (g.rest.x + g.dir * 2) * PSS, y: p.y + g.rest.y * PSS };
}
const live = () => S.phase === 'live' || S.phase === 'penalty';

// skating to a spot on the other side of a net: go around the post instead of into the cage
function netDetour(p, tx, ty) {
  for (const gl of [GL_TOP, GL_BOT]) {
    const back = gl === GL_TOP ? -1 : 1;                                   // +back = behind this net
    const pB = (p.y - gl) * back > 0, tB = (ty - gl) * back > 0;
    if (pB === tB) continue;
    const yc = gl + back * NET_D * 0.5, k = (yc - p.y) / ((ty - p.y) || 1e-6);
    if (k < 0 || k > 1) continue;
    const xc = p.x + (tx - p.x) * k;
    if (Math.abs(xc - CX) > GOAL_HW + 7) continue;
    const side = ((tx + p.x) / 2 - CX) >= 0 ? 1 : -1, sx = CX + side * (GOAL_HW + 17);
    if (Math.abs(p.x - CX) > GOAL_HW + 12 && Math.sign(p.x - CX) === side) return { x: tx, y: ty };   // already beside the post
    return { x: sx, y: tB ? gl + back * (NET_D + 8) : gl - back * 8 };
  }
  return { x: tx, y: ty };
}
function steerTo(p, tx, ty, urgency = 1, slowR = 18) {
  const dx = tx - p.x, dy = ty - p.y, d = hyp(dx, dy);
  if (d < 1.5) { p.inx = 0; p.iny = 0; return d; }
  const m = Math.min(1, d / slowR) * urgency;
  p.inx = dx / d * m; p.iny = dy / d * m;
  return d;
}
function constrain(e, r, bounce) {
  const c = R.cr - r; let hit = 0, cx = null, cy = null;
  if (e.x < R.l + R.cr && e.y < R.t + R.cr) { cx = R.l + R.cr; cy = R.t + R.cr; }
  else if (e.x > R.r - R.cr && e.y < R.t + R.cr) { cx = R.r - R.cr; cy = R.t + R.cr; }
  else if (e.x < R.l + R.cr && e.y > R.b - R.cr) { cx = R.l + R.cr; cy = R.b - R.cr; }
  else if (e.x > R.r - R.cr && e.y > R.b - R.cr) { cx = R.r - R.cr; cy = R.b - R.cr; }
  if (cx !== null) {
    const dx = e.x - cx, dy = e.y - cy, d = hyp(dx, dy);
    if (d > c) {
      const nx = dx / d, ny = dy / d; e.x = cx + nx * c; e.y = cy + ny * c;
      const vn = e.vx * nx + e.vy * ny;
      if (vn > 0) { e.vx -= (1 + bounce) * vn * nx; e.vy -= (1 + bounce) * vn * ny; hit = vn; }
    }
  }
  if (e.x < R.l + r) { e.x = R.l + r; if (e.vx < 0) { hit = Math.max(hit, -e.vx); e.vx = -e.vx * bounce; } }
  if (e.x > R.r - r) { e.x = R.r - r; if (e.vx > 0) { hit = Math.max(hit, e.vx); e.vx = -e.vx * bounce; } }
  if (e.y < R.t + r) { e.y = R.t + r; if (e.vy < 0) { hit = Math.max(hit, -e.vy); e.vy = -e.vy * bounce; } }
  if (e.y > R.b - r) { e.y = R.b - r; if (e.vy > 0) { hit = Math.max(hit, e.vy); e.vy = -e.vy * bounce; } }
  return hit;
}
// ---------- RIMMING: a puck fired hard into the boards hugs them: around the corner, behind the net, up the other side
const RIM = { speed: 10.1, minSp: 1.7, life: 200, hug: 9 };
function rimHug(e) {
  const r = PUCK_R, c = R.cr - r;
  let cx = null, cy = null;
  if (e.x < R.l + R.cr && e.y < R.t + R.cr) { cx = R.l + R.cr; cy = R.t + R.cr; }
  else if (e.x > R.r - R.cr && e.y < R.t + R.cr) { cx = R.r - R.cr; cy = R.t + R.cr; }
  else if (e.x < R.l + R.cr && e.y > R.b - R.cr) { cx = R.l + R.cr; cy = R.b - R.cr; }
  else if (e.x > R.r - R.cr && e.y > R.b - R.cr) { cx = R.r - R.cr; cy = R.b - R.cr; }
  let nx, ny, gap;
  if (cx !== null) { const dx = e.x - cx, dy = e.y - cy, d = hyp(dx, dy) || 1; nx = dx / d; ny = dy / d; gap = c - d; if (gap < RIM.hug) { e.x = cx + nx * c; e.y = cy + ny * c; } }
  else {
    const g = [[e.x - (R.l + r), -1, 0], [(R.r - r) - e.x, 1, 0], [e.y - (R.t + r), 0, -1], [(R.b - r) - e.y, 0, 1]].sort((a, b) => a[0] - b[0])[0];
    [gap, nx, ny] = g;
    if (gap < RIM.hug) { if (nx) e.x = nx < 0 ? R.l + r : R.r - r; else e.y = ny < 0 ? R.t + r : R.b - r; }
  }
  if (gap < RIM.hug) { const vn = e.vx * nx + e.vy * ny; if (vn < 0) { e.vx -= vn * nx; e.vy -= vn * ny; } }   // never comes off the wall
}
// fire it hard into the side boards, toward the corner he's facing: it rides the boards round the end
function rimPuck(p, power = 1, dir = null, soft = false) {
  if (!hasPuck(p)) return false;
  let dx, dy, d;
  if (dir) { dx = dir.x; dy = dir.y; d = hyp(dx, dy) || 1; }                 // the way you aimed it
  else {
    const toward = Math.sign(p.fy) || attackDir(p.team);                     // the end he's facing
    const side = Math.abs(p.x - CX) > 18 ? Math.sign(p.x - CX) : (Math.sign(p.fx) || 1);   // the boards on his side
    const tx = side < 0 ? TL_L + 16 : TL_R - 16, ty = toward < 0 ? GL_TOP + 36 : GL_BOT - 36;   // SOCCER: down the line, into the channel by the corner flag
    dx = tx - puck.x; dy = ty - puck.y; d = hyp(dx, dy) || 1;
  }
  const sp = Math.min(RIM.speed * (0.85 + A(p, 'pow') * 0.03) * (0.75 + 0.25 * power) * (soft ? 0.72 : 1), Math.sqrt(d) * 0.42 + 2.2);   // SOCCER: weighted to stop in the channel, not run out
  const fromOwnHalf = (puck.y - CY) * attackDir(p.team) < 0;
  releasePuck(p, dx / d * sp, dy / d * sp, 16);
  puck.lastTouch = p; puck.shotTeam = null; puck.passTarget = null; puck.iceTeam = fromOwnHalf ? p.team : null;
  puck.rim = null;
  p.charge = -1; sfx.pass();
  floaters.push({ x: p.x, y: p.y - 30, text: soft ? 'DOWN THE LINE' : 'INTO THE CHANNEL!', life: 30, color: '#dbe9ff' });
  return true;
}
// does this aim mean "around the boards"? A direction (held keys) that runs into the side boards at a glancing angle,
// clearly away from either net. Straight at the end boards is a normal dump; at the net is a shot.
function rimIntent(p, dx, dy) {
  const m = hyp(dx, dy); if (m < 0.5) return false; dx /= m; dy /= m;
  if (Math.abs(dy) < 0.45 || Math.abs(dx) < 0.25) return false;                  // across the ice, or straight down it
  const ox = puck.x, oy = puck.y;
  const tSide = dx > 0 ? (R.r - PUCK_R - ox) / dx : (ox - R.l - PUCK_R) / -dx;
  const tEnd = dy > 0 ? (R.b - PUCK_R - oy) / dy : (oy - R.t - PUCK_R) / -dy;
  if (tSide > tEnd || tSide < 12) return false;                                  // must meet the side boards first, not point blank
  for (const gy of [GL_TOP, GL_BOT]) {                                           // not toward either net
    const a = Math.atan2(gy - oy, CX - ox), b = Math.atan2(dy, dx);
    if (Math.abs(angDiff(a, b)) < 0.5) return false;
  }
  return true;
}
function pushOutOfNets(e, r) {
  for (const n of NETS) {
    const x0 = n.x0 - r, x1 = n.x1 + r, y0 = n.y0 - r, y1 = n.y1 + r;
    if (e.x > x0 && e.x < x1 && e.y > y0 && e.y < y1) {
      const pen = [e.x - x0, x1 - e.x, e.y - y0, y1 - e.y];
      const m = Math.min(...pen), i = pen.indexOf(m);
      if (i === 0) { e.x = x0; e.vx = Math.min(e.vx, 0); }
      else if (i === 1) { e.x = x1; e.vx = Math.max(e.vx, 0); }
      else if (i === 2) { e.y = y0; e.vy = Math.min(e.vy, 0); }
      else { e.y = y1; e.vy = Math.max(e.vy, 0); }
    }
  }
}

// ====================================================================
//  AUDIO
// ====================================================================
let AC = null, noiseBuf = null, master = null, crowdGain = null, crowdFilter = null, skateGain = null;
function initAudio() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // (Nov 22 sound pass) a limiter after the effects bus: the horn, a roar, the organ and the crowd can all land at once
    // without clipping. It only bites on those stacks (threshold -8 dB); everything else passes untouched
    master = AC.createGain(); master.gain.value = S.sound ? 0.9 : 0;
    const lim = AC.createDynamicsCompressor(); lim.threshold.value = -8; lim.knee.value = 4; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.22;
    master.connect(lim).connect(AC.destination);
    // crowd bed: band-limited noise whose level follows the excitement on the ice
    const cs = AC.createBufferSource(); cs.buffer = noiseBuf; cs.loop = true;
    crowdFilter = AC.createBiquadFilter(); crowdFilter.type = 'bandpass'; crowdFilter.frequency.value = 650; crowdFilter.Q.value = 0.5;
    const cl = AC.createBiquadFilter(); cl.type = 'lowpass'; cl.frequency.value = 2200;
    crowdGain = AC.createGain(); crowdGain.gain.value = 0;
    cs.connect(crowdFilter).connect(cl).connect(crowdGain).connect(master); cs.start(0, 0.3);
    // skates bed: hissy high noise that follows how fast everyone is skating
    const ss = AC.createBufferSource(); ss.buffer = noiseBuf; ss.loop = true; ss.playbackRate.value = 0.85;
    const sh = AC.createBiquadFilter(); sh.type = 'bandpass'; sh.frequency.value = 3400; sh.Q.value = 0.9;   // (was 5.2 kHz: a hiss that masked the stick and puck sounds)
    skateGain = AC.createGain(); skateGain.gain.value = 0;
    ss.connect(sh).connect(skateGain).connect(master); ss.start(0, 1.1);
  } catch (e) { AC = null; }
  if (typeof applySfxVolume === 'function') applySfxVolume();
}
function tone(f, dur, type = 'square', vol = 0.06, slide = 0, delay = 0) {
  if (!AC) return;
  try {
    const t0 = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
  } catch (e) {}
}
function noise(dur, vol = 0.1, freq = 800, type = 'highpass', q = 0.7, delay = 0, attack = 0) {
  if (!AC || !noiseBuf) return;
  try {
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(), t0 = AC.currentTime + delay;
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (attack) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack); }
    else g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + dur);
    s.connect(f).connect(g).connect(master); s.start(t0, Math.random() * 1.5); s.stop(t0 + attack + dur + 0.05);
  } catch (e) {}
}
function whistleTone(dur, freq = 2750) {
  if (!AC) return;
  try {   // pea whistle (Nov 22 sound pass): two close partials that beat, the pea fluttering the level (not a 140 Hz pitch
          // swing, which made it shrill), a little breath and a chiff at the start. About 5 dB quieter than before:
          // it blows 20+ times a game
    const t0 = AC.currentTime, out = AC.createGain(), flut = AC.createGain(), lfo = AC.createOscillator(), lg = AC.createGain(), v = 0.07 * SND.whistle;
    lfo.type = 'triangle'; lfo.frequency.value = 27 + Math.random() * 6; lg.gain.value = 0.45; flut.gain.value = 0.55; lfo.connect(lg).connect(flut.gain);
    out.gain.setValueAtTime(0.0001, t0); out.gain.exponentialRampToValueAtTime(v, t0 + 0.018);
    out.gain.setValueAtTime(v, t0 + dur - 0.07); out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const f = freq * (0.98 + Math.random() * 0.04);
    for (const [mul, a, ty] of [[1, 1, 'sine'], [1.006, 0.6, 'sine'], [2, 0.12, 'triangle']]) {
      const o = AC.createOscillator(), g = AC.createGain(); o.type = ty; o.frequency.setValueAtTime(f * mul * 1.03, t0); o.frequency.exponentialRampToValueAtTime(f * mul, t0 + 0.05);
      g.gain.value = a; o.connect(g).connect(flut); o.start(t0); o.stop(t0 + dur + 0.02);
    }
    flut.connect(out).connect(master); lfo.start(t0); lfo.stop(t0 + dur + 0.02);
    noise(0.05, 0.05 * SND.whistle, 3500, 'bandpass', 1.5);                 // the chiff
    noise(dur * 0.85, 0.012 * SND.whistle, 4200, 'highpass');                // breath
  } catch (e) {}
}
// one horn blast: every note is three slightly detuned buzzing voices (the fat, beating sound of a real air horn)
// through a warm filter, with a quick swell in and a fade out. o: bright (filter), attack, from (start pitch x), slide (end pitch x)
function hornBlast(notes, dur, delay = 0, vol = 0.07, o = {}) {
  if (!AC) return;
  try {
    const t0 = AC.currentTime + delay, out = AC.createGain(), lp = AC.createBiquadFilter(), n = notes.length * 3, peak = vol * 2.4 / n * SND.horn;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(o.bright || 1500, t0); lp.Q.value = 1.4;
    out.gain.setValueAtTime(0.0001, t0); out.gain.exponentialRampToValueAtTime(peak, t0 + (o.attack || 0.06));
    out.gain.setValueAtTime(peak, t0 + Math.max(0.1, dur - 0.22)); out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    lp.connect(out).connect(master);
    for (const f of notes) for (const d of [-7, 0, 6]) {
      const v = AC.createOscillator(); v.type = o.type || 'sawtooth'; v.detune.value = d;
      v.frequency.setValueAtTime(f * (o.from || 1), t0);
      if (o.from) v.frequency.exponentialRampToValueAtTime(f, t0 + 0.3);
      if (o.slide) v.frequency.exponentialRampToValueAtTime(f * o.slide, t0 + dur);
      v.connect(lp); v.start(t0); v.stop(t0 + dur + 0.05);
    }
  } catch (e) {}
}
// SOCCER: GOAL CELEBRATIONS in place of goal horns (the arena shop's "horn" choice picks which): the drums, the
// terrace band's trumpets, a cymbal crash. Same keys as the old horns so saved arena choices still work
function drumHit(delay, vol = 0.09, deep = false) { tone(deep ? 52 : 78, deep ? 0.5 : 0.3, 'sine', vol * SND.horn, deep ? 34 : 50, delay); noise(0.09, vol * 0.5 * SND.horn, deep ? 160 : 320, 'lowpass', 1, delay); }
function crash(delay, vol = 0.05) { noise(1.4, vol * SND.horn, 5200, 'highpass', 0.7, delay); }
function fanfare(notes, step, delay = 0, vol = 0.05) { notes.forEach((f, i) => { if (f) hornBlast([f, f * 1.5], step * 0.9, delay + i * step, vol, { bright: 2600, attack: 0.02, from: 0.97 }); }); }
const HORNS = {
  classic: { notes: [130.8, 196], bright: 2600, play() { [0, 0.32, 0.64].forEach(d => drumHit(d)); drumHit(0.96, 0.12, true); crash(0.96); fanfare([392, 523.3, 659.3, 784, 0, 784], 0.16, 1.1); } },   // BOOM BOOM BOOM, CRASH, and the band
  deep:    { notes: [55, 82.4], bright: 700, play() { [0, 0.55, 1.1, 1.65, 1.9, 2.2].forEach((d, i) => drumHit(d, 0.12, i % 2 === 0)); crash(2.2, 0.06); } },   // the big bass drum
  train:   { notes: [277.2, 329.6], bright: 2600, play() { for (let i = 0; i < 14; i++) drumHit(i * 0.07, 0.04 + i * 0.005); drumHit(1.0, 0.13, true); crash(1.0); } },   // a drum roll into the crash
  siren:   { notes: [98, 146.8], bright: 1200, play() { [0, 0.4, 0.8].forEach(d => drumHit(d)); for (let i = 0; i < 3; i++) tone(880, 0.25, 'sine', 0.04, 1320, 1.1 + i * 0.3); crash(1.0, 0.04); } },   // drums and the whistles
  triple:  { notes: [146.8, 185], bright: 1800, play() { [0, 0.25, 0.5, 1.0, 1.25, 1.5].forEach(d => drumHit(d, 0.09)); fanfare([523.3, 523.3, 523.3, 0, 659.3, 784], 0.14, 0.1); } },   // da-da-da, da-da-DA
  rising:  { notes: [130.8, 164.8], bright: 1700, play() { for (let i = 0; i < 10; i++) drumHit(i * 0.12, 0.04 + i * 0.008); crash(1.2); fanfare([392, 440, 493.9, 523.3, 587.3, 659.3, 784], 0.11, 1.2); } },   // climbing to the top
};
// ---- THE MIX (Nov 22 sound pass). Measured with every effect rendered offline (loudness in LUFS):
// the goal horn sat at -32 while a save sting hit -19 and the whistle -26; the stick, pass, poke and save sounds were
// -50 to -60 (inaudible under the skate hiss at -32). Targets now: horn ~-23 (the loudest moment), crowd reactions
// -25 to -28, organ stings -28 to -30, whistle ~-31, puck and stick sounds peaking around -20 to -24.
const SND = { foley: 3.2, body: 2, horn: 2.8, whistle: 0.7, sting: 0.38, stingBig: 0.7, skates: 0.5 };
const jit = (v, k = 0.06) => v * (1 - k + Math.random() * 2 * k);      // a little variation: no two stick taps identical
const sfx = {
  stick() { const F = SND.foley; noise(0.035, 0.07 * F, jit(1900), 'bandpass', 3); tone(jit(950), 0.025, 'triangle', 0.03 * F, -300); },          // wood on rubber
  dribble() { noise(0.025, 0.03 * SND.foley * 2, jit(2300, 0.1), 'bandpass', 4); },
  shot(p) { noise(0.05, 0.12 + p * 0.1, jit(1600), 'bandpass', 2); noise(0.14, 0.06 + p * 0.08, 900, 'highpass'); tone(jit(160 + p * 90), 0.07, 'triangle', 0.06 * 1.6, -70);
    noise(0.03, 0.05 + p * 0.06, 400, 'lowpass', 1); },                                                        // + the blade slapping the ice
  pass() { const F = SND.foley; noise(0.04, 0.08 * F, jit(1800), 'bandpass', 2.5); noise(0.08, 0.025 * F, 3000, 'highpass'); },
  pick() { sfx.stick(); },
  board(v) { const B = SND.body; noise(0.1, Math.min(0.16, v * 0.025) * B, jit(220), 'lowpass', 1); tone(jit(110), 0.08, 'triangle', Math.min(0.06, v * 0.01) * B); },
  post() { const f = jit(1400, 0.03); tone(f, 0.45, 'triangle', 0.09, -150); tone(f * 1.535, 0.3, 'sine', 0.045); tone(f * 2.76, 0.12, 'sine', 0.02); },   // DING (three inharmonic partials: steel pipe)
  bump(v) { const B = SND.body; noise(0.08, (0.05 + v * 0.07) * B, 300, 'lowpass', 1); tone(jit(130), 0.06, 'triangle', (0.03 + v * 0.03) * B, -30); },
  check() { const B = SND.body; noise(0.14, 0.13 * B, jit(260), 'lowpass', 1); tone(jit(95), 0.14, 'triangle', 0.08 * B, -40); noise(0.05, 0.04 * B, 1500, 'bandpass', 1.5, 0.01); },
  glass(v) { const B = SND.body * 0.8; noise(0.32, Math.min(0.2, 0.08 + v * 0.03) * B, 160, 'lowpass', 0.8); tone(62, 0.22, 'triangle', 0.08 * B, -20); noise(0.12, 0.05 * B, jit(2600), 'bandpass', 2, 0.02);
    noise(0.45, 0.02 * B, 900, 'bandpass', 3, 0.05); },                                                                 // + the pane rattling in its frame
  bigHit() { const B = SND.body * 0.85; noise(0.28, 0.24 * B, 180, 'lowpass', 1); tone(70, 0.3, 'sawtooth', 0.09 * B, -35); noise(0.2, 0.06 * B, 1200, 'bandpass', 1, 0.03); },
  oof() { tone(jit(230, 0.1), 0.16, 'sawtooth', 0.035 * SND.body, -90, 0.05); },
  poke() { noise(0.035, 0.07 * SND.foley * 1.3, jit(2600), 'bandpass', 3); tone(jit(700), 0.02, 'triangle', 0.02 * SND.foley, -200); },
  stop() { noise(0.22, 0.05, jit(4200, 0.1), 'highpass', 0.7, 0, 0.02); noise(0.16, 0.035, 1800, 'bandpass', 1, 0.02, 0.02); },   // snow spray, with a little body
  // saves (Nov 22): three kinds. pad = a dull thud, glove = a leather pop, blocker = a hard crack. Default: pad or blocker
  save(kind) {
    const F = SND.foley, k = kind || (Math.random() < 0.7 ? 'pad' : 'blocker');
    if (k === 'glove') { noise(0.05, 0.1 * F, jit(1100), 'bandpass', 2.2); tone(jit(320), 0.05, 'triangle', 0.05 * F, -120); noise(0.09, 0.03 * F, 400, 'lowpass', 1, 0.015); }
    else if (k === 'blocker') { noise(0.03, 0.1 * F, jit(2300), 'bandpass', 2.5); tone(jit(540), 0.04, 'triangle', 0.045 * F, -180); }
    else { noise(0.09, 0.11 * F, jit(380), 'lowpass', 1); tone(jit(140), 0.08, 'triangle', 0.07 * F, -40); noise(0.04, 0.03 * F, 1500, 'bandpass', 1.5); }
  },
  // NEW (Nov 22): the twine (puck into the net), the drop (puck on the ice at a faceoff), punches, the puck off the glass
  twine() { noise(0.22, 0.09 * SND.foley, 3600, 'bandpass', 1.1); noise(0.3, 0.05 * SND.foley, 700, 'lowpass', 1, 0.02); tone(170, 0.09, 'triangle', 0.05 * SND.foley, -60, 0.02); },
  drop() { tone(jit(430), 0.035, 'triangle', 0.06 * SND.foley, -220); noise(0.03, 0.05 * SND.foley, 2600, 'bandpass', 3); },
  punch(big) { const B = SND.body * (big ? 1.25 : 0.9); noise(big ? 0.12 : 0.07, 0.17 * B, jit(330), 'lowpass', 1); noise(0.035, 0.08 * B, jit(1700), 'bandpass', 2);   // a gloved fist: thud + jersey slap
    tone(jit(big ? 75 : 95), big ? 0.14 : 0.08, 'sine', 0.1 * B, -25); },
  glassPuck(v) { const B = SND.body * Math.min(1.2, 0.5 + v * 0.12); tone(jit(760), 0.12, 'triangle', 0.05 * B, -140); noise(0.12, 0.09 * B, jit(1400), 'bandpass', 1.6); noise(0.35, 0.025 * B, 850, 'bandpass', 3, 0.04); },
  boo() { noise(1.2, 0.05, 300, 'lowpass', 1, 0, 0.2); tone(150, 0.9, 'triangle', 0.025, -40); },
  cheer(v = 1) { noise(1.6 * v, 0.07 * v, 1100, 'bandpass', 0.6, 0, 0.12); },
  ooh() { if (typeof crowdOoh === 'function' && AC && master && S.sound) { try { crowdOoh(0.9 * SND.stingBig); } catch (e) {} } else noise(0.8, 0.05, 500, 'bandpass', 1.2, 0, 0.1); },
  whistle(long) { whistleTone(long ? 0.55 : 0.32); },
  // the end-of-period / game buzzer: a real two-note arena buzzer (was one thin square tone, ~9 dB under the horn)
  buzzer() { whistleTone(0.28); setTimeout(() => whistleTone(0.28), 380); setTimeout(() => whistleTone(0.7), 760); },   // SOCCER: the referee's three blasts
  // the goal horn: big, sustained, brassy. Each building has its own (see HORNS). Visiting goals get one short blast.
  // season games: the home arena's own horn style (the arena shop); a visiting goal gets one short blast of it.
  // Everything else (Quick Play, its modes and tournaments): see goalSound
  horn(away) {
    const hv = (S.match && S.match.arena && S.match.arena.horn) || 'classic', H = HORNS[hv] || HORNS.classic;
    if (away) { drumHit(0, 0.06); drumHit(0.3, 0.06); return; }   // the away end's drums
    H.play();
    if (typeof hasCosmetic === 'function' && hasCosmetic('golden_horn') && S.match && S.match.season && S.match.home === 0) fanfare([523.3, 659.3, 784, 1046.5], 0.2, 1.6, 0.05); },
  // a goal by the visitors: the arena's goal buzzer (no horn for the away team)
  goalBuzzer() { drumHit(0, 0.07); drumHit(0.3, 0.07); drumHit(0.6, 0.09, true); },   // SOCCER: the away fans' drums   // (a touch under the home horn)
  // the right sound for a goal by this team. Season games: the arena's horn (above). Quick Play: the home team gets
  // the foghorn, the visitors the buzzer; at tournaments, the foghorn for both
  goalSound(team) {
    const m = S.match, away = team !== (m ? m.home : 0);
    if (m && m.season) return sfx.horn(away);
    if (away && !m.tourney) return sfx.goalBuzzer();
    HORNS.deep.play();
  },
};
// per-frame mix: crowd swells with the action, skates hiss with speed
function updateAudio() {
  if (!AC || !crowdGain) return;
  const t = AC.currentTime;
  const playing = S.screen === 'play';
  if (S.excite > 0) S.excite = Math.max(0, S.excite - 0.004);
  let near = 0;
  if (playing && live()) { const d = Math.min(Math.abs(puck.y - GL_TOP), Math.abs(puck.y - GL_BOT)); if (d < 90) near = 0.18 * (1 - d / 90); }
  const level = S.screen === 'menu' ? 0.02 : playing ? 0.03 + (Math.max(S.excite, near)) * 0.13 : S.screen === 'celebrate' ? 0.12 : S.screen === 'replay' ? 0.025 + S.excite * 0.08 : S.screen === 'intermission' ? 0.018 : 0.008;
  const big = S.match && S.match.tourney && S.match.tourney.tier >= 2 ? 1.3 : S.match && S.match.tourney ? 1.12 : 1;   // finals are louder
  crowdGain.gain.setTargetAtTime(level * big, t, 0.15);
  crowdFilter.frequency.setTargetAtTime(600 + Math.max(S.excite, near) * 700, t, 0.2);
  let sp = 0;
  if (playing) for (const p of skaters) { if (p.y > camY - 20 && p.y < camY + viewH() + 20) sp += hyp(p.vx, p.vy); }
  skateGain.gain.setTargetAtTime(playing ? Math.min(0.06, sp * 0.0065) * SND.skates : 0, t, 0.08);
}
const excite = v => { S.excite = Math.max(S.excite, v); };

// ---------- play-by-play commentary pop-ups
function say(lines, prio = 1, chance = 1) {
  if (S.screen !== 'play' || Math.random() > chance) return;
  if (S.comm && S.comm.life > 40 && (S.comm.prio || 0) > prio) return;
  if (prio < 2 && S.t - (S.commT || -999) < 300) return;        // don't chatter
  const t = Array.isArray(lines) ? lines[(Math.random() * lines.length) | 0] : lines;
  S.comm = { text: t.toUpperCase(), life: 210, prio }; S.commT = S.t;
}
function drawComm() {
  const cm = S.comm; if (!cm || cm.life <= 0 || S.screen !== 'play') return;
  toScreen();
  const SW = viewW(), bw = Math.min(SW - 24, 330), x = 12, maxC = Math.floor((bw - 34) / (8 * CTS));
  const lines = []; let cur = '';
  for (const w of cm.text.split(' ')) { const nx = cur ? cur + ' ' + w : w; if (nx.length > maxC && cur) { lines.push(cur); cur = w; } else cur = nx; }
  if (cur) lines.push(cur);
  const bh = 10 + lines.length * 12, y = (S.botY || HUDH + viewH() - 10) - bh;   // (Nov 22) on the bottom stack (above the coach's tip bar / last-goal strip)
  S.commTop = y; S.commTopT = S.t; S.botY = y - 4;
  ctx.globalAlpha = Math.min(1, cm.life / 15, (210 - cm.life) / 6 + 0.05);
  ctx.fillStyle = 'rgba(11,14,30,.9)'; ctx.fillRect(x, y, bw, bh);
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(x, y, 3, bh);
  // microphone icon
  ctx.fillStyle = '#c9ced8'; ctx.fillRect(x + 9, y + 4, 6, 8); ctx.fillStyle = '#6e7690'; ctx.fillRect(x + 10, y + 6, 4, 1); ctx.fillRect(x + 10, y + 8, 4, 1);
  ctx.fillStyle = '#c9ced8'; ctx.fillRect(x + 11.5, y + 12, 1, 3); ctx.fillRect(x + 9, y + 15, 6, 1);
  lines.forEach((l, i) => text(l, x + 22, y + 6 + i * 12, '#ffffff', 8, 'left', null));
  ctx.globalAlpha = 1;
}

// ====================================================================
//  GAME FLOW
// ====================================================================
function resetPlayerState(p) {
  Object.assign(p, { windUp:null, dkOff:0, dkTarget:0, side:1, dkMove:null, dkHead:null, dkCd:0, dkSpam:0, dkAi:0, dkVuln:0, dkFake:0, sprint:false, gCharge:null, gpT:0, covering:0, roam:false, fetch:null, fetched:false, bite:null, gAim:null,
    recvT:-99, gLunge:0, down:0, stunType:null, rebT:-99, vx:0, vy:0, inx:0, iny:0, stun:0, slow:0, cd:0, lunge:0, poke:0, block:0, hold:0, charge:-1,
    fx:0, fy:attackDir(p.team), checkTarget:null, aim:null, foSwipe:0 });
}
function goalieHome(p) { p.x = CX; p.y = isUp(p.team) ? GL_BOT - 8 : GL_TOP + 8; }
function resetPuck(x, y) {
  Object.assign(puck, { rim:null, shot:null, air:false, h:0, vh:0, x, y, vx:0, vy:0, owner:null, passTarget:null, shotTeam:null, lastTouch:null, iceTeam:null, inNet:false, trail:[] });
  puck.passed.clear(); S.prevPY = y;
}
function setupFaceoff(dx = CX, dy = CY) {
  S.adv = null; if (typeof keeperUpClear === 'function') keeperUpClear();
  S.scrumHold = false; S.injWait = null; S.icing = null;   // (a waiting injury whistle or icing race is moot: play has stopped)
  S.fightGear = null;                          // the fighters skated off and took their gear with them
  S.fo = { x: dx, y: dy };
  if (MS && !S.so && players.length) for (const t of [0, 1]) finishChanges(t);
  if (MS && !S.so && players.length) for (const t of [0, 1]) {
    if (t === 0 && MS.nextLine != null) { setLine(0, MS.nextLine); MS.nextLine = null; continue; }   // the coach's pick always takes the ice
    if (MS.lines[t].t > MS.lines[t].target * 0.7) changeLine(t);
  }
  if (typeof rulesFaceoff === 'function') rulesFaceoff();                // penalties, pulled goalies, 4th skaters, substitutes
  goalieRest(PLAY.gRestoreStop);
  if (typeof HATS !== 'undefined') HATS.length = 0;
  S.goalCard = null; S.lineHold = false;
  for (const p of players) p.celebT = 0;
  const offs = [[-42, 32], [0, 15], [42, 32], [0, 58]];
  // who takes the draw: the centre on the ice, otherwise the best faceoff man
  S.fo.takers = [0, 1].map(t => foTaker(t));
  const slotOf = {};
  for (const t of [0, 1]) {
    const sk = teamSkaters(t).slice().sort((a, b) => a.role - b.role), tk = S.fo.takers[t];
    const rest = [0, 2, 3]; let k = 0;
    for (const p of sk) slotOf[p.id] = p === tk ? 1 : rest[k++];
  }
  for (const p of players) {
    resetPlayerState(p);
    if (p.g) { goalieHome(p); continue; }
    const a = attackDir(p.team), o = offs[slotOf[p.id] ?? p.role];
    p.x = clamp(dx - a * o[0], R.l + 14, R.r - 14); p.y = clamp(dy - a * o[1], R.t + 16, R.b - 16);
    pushOutOfNets(p, SKATER_R);
    p.mx = p.x; p.my = p.y;
  }
  if (MS && !S.so && typeof foFormSetup === 'function') for (const t of [0, 1]) foFormSetup(t, dx, dy, S.fo.takers[t]);
  resetPuck(dx, dy);
  S.phase = 'faceoff'; S.timer = 140; S.manualHold = 0; S.fo.readySaid = false; S.pen = null;
  // SOCCER: a KICKOFF at the centre spot (the side that conceded, or by halves) or a FREE KICK (S.kickNext, set by
  // whoever stopped play) belongs to one side: no contest. Anything else is a DROP BALL: the old timing contest.
  { const centre = dx === CX && dy === CY, kt = S.kickNext != null ? S.kickNext : centre && !S.so ? (S.period % 2 === 0 ? (S.kickFirst ?? 0) : 1 - (S.kickFirst ?? 0)) : null;
    S.kickNext = null; S.fo.kick = kt; S.fo.free = kt != null && !centre;
    if (kt != null) setupKick(kt, dx, dy, centre); }
  S.fo.dropT = Math.round(rand(FO.dropMinT, FO.dropMaxT)); S.fo.beat = 0; S.fo.kind = FO_DROPS[(Math.random() * FO_DROPS.length) | 0]; S.fo.iceAt = null; S.fo.dir = null; S.fo.taps = 0; S.fo.dropped = false; S.fo.humanAt = null; S.fo.wait = 0; S.fo.fb = null;
  input.shiftPending = false;
  ctrl = S.fo.takers[0] || skaters.find(p => p.team === 0 && p.role === 1);
}
function setupKick(kt, dx, dy, centre) {
  const up = attackDir(kt), tk = S.fo.takers[kt] || teamSkaters(kt)[0];
  if (tk) { tk.x = dx; tk.y = dy - up * 8; tk.fx = 0; tk.fy = up; tk.mx = tk.x; tk.my = tk.y; }
  const keep = centre ? CIRCLE_R + 4 : 26;
  for (const p of teamSkaters(1 - kt)) {
    if (centre) p.y = (p.y - CY) * up > 6 ? p.y : CY + up * 10;                     // on their own half (the half the kickers attack)
    const d = hyp(p.x - dx, p.y - dy);
    if (d < keep) { const k = keep / (d || 1); p.x = clamp(dx + (p.x - dx) * k, TL_L + 6, TL_R - 6); p.y = clamp(dy + (d < 1 ? -up * keep : (p.y - dy) * k), GL_TOP + 6, GL_BOT - 6); }
    p.mx = p.x; p.my = p.y;
  }
  S.timer = centre ? 110 : 80;
  if (kt === 0 && tk && !S.autoAI) ctrl = tk;
}
// the whistle: the kicker has it
function kickOff() {
  const kt = S.fo.kick, tk = S.fo.takers[kt] || teamSkaters(kt)[0];
  if (S.fo.x === CX && S.fo.y === CY && !S.fo.free)
    say(S.period === 2 && !S.kickSaid ? [`WELCOME TO ${S.match && S.match.arenaName ? 'THE ' + S.match.arenaName : TEAM[S.match ? S.match.home : 0].city.toUpperCase()}! THE ${TEAM[S.match ? S.match.home : 0].nick.toUpperCase()} HOST THE ${TEAM[S.match ? 1 - S.match.home : 1].nick.toUpperCase()}.`, "AND WE'RE UNDERWAY!"]
      : S.period >= 4 && S.kickSaid !== S.period ? ['SUDDEN DEATH EXTRA TIME! NEXT GOAL WINS!'] : S.period === 3 && S.kickSaid !== 3 ? ['HERE WE GO, THE SECOND HALF IS UNDERWAY.'] : ['WE GO AGAIN FROM THE CENTRE SPOT.', 'THE KICKOFF. BACK TO WORK.'], 2);
  if (S.fo.x === CX && S.fo.y === CY && !S.fo.free) S.kickSaid = S.period;
  S.fo.dropped = true; S.fo.kick = null; S.phase = 'live'; S.cpuDelay = DIFF[S.diff].react; S.foWinner = kt;
  if (tk) {
    puck.owner = tk; puck.lastTouch = tk; tk.vx = tk.vy = 0;
    tk.restart = S.fo.free ? { kind: 'free', t: S.t, x: tk.x, y: tk.y } : null;   // a free kick is taken from the spot
    if (kt === 0 && !S.autoAI) setCtrl(tk, true);
  }
  if (!S.demo) whistleTone(0.22, 3150); else sfx.whistle(false);
}
function dropPuck() {
  if (S.clock >= S.periodLen - 0.01 && S.fo.x === CX && S.fo.y === CY)
    say(S.period === 2 ? [`WELCOME TO ${S.match && S.match.arenaName ? 'THE ' + S.match.arenaName : TEAM[S.match ? S.match.home : 0].city.toUpperCase()}! THE ${TEAM[S.match ? S.match.home : 0].nick.toUpperCase()} HOST THE ${TEAM[S.match ? 1 - S.match.home : 1].nick.toUpperCase()}.`, "AND WE'RE UNDERWAY!"]
                       : S.period >= 4 ? ['SUDDEN DEATH EXTRA TIME! NEXT GOAL WINS!'] : ["HERE WE GO, THE SECOND HALF IS UNDERWAY.", "WE'RE UNDERWAY IN THE " + halfName(S.period) + ' HALF!'], 3);
  // the referee lets it go: the takers' timing is judged a moment later (resolveFaceoff)
  S.fo.dropped = true; S.fo.dropAt = performance.now(); S.fo.wait = 0;
  // (Nov 22) the computer's timing is rolled now, so its centre can be seen swiping at that moment (resolveFaceoff uses it);
  // the drop sound plays on the frame the puck reaches the ice (it used to come ~70 ms late and taught the wrong beat)
  const human0 = !S.autoAI && S.fo.takers[0] && S.fo.takers[0] === ctrl;
  S.fo.cpuE = [0, 1].map(t => S.fo.takers[t] && !(t === 0 && human0) ? foCpuTiming(S.fo.takers[t]) : null);
  if (!S.demo) whistleTone(0.16, 3150); else sfx.whistle(false);
}
const FO_FB_LIFE = 95;   // frames the faceoff result panel stays up
const FO_GRADES = ['PERFECT', 'GREAT', 'GOOD', 'OFF', 'EARLY'];
const foGrade = e => { const x = Math.abs(e); return x <= FO.gradeMs[0] ? 0 : x <= FO.gradeMs[1] ? 1 : x <= FO.gradeMs[2] ? 2 : x <= FO.gradeMs[3] ? 3 : 4; };
// the computer's timing: a grade rolled from its centre's Faceoff rating (Hard: his real rating; Normal 1.5 lower; Easy 3
// lower), blended between the anchor rows, then a press time inside that grade's band
function foCpuTiming(p) {
  const r = clamp(A(p, 'fo') - (FO.diffShift[S.diff] || 0), 1, 10), R = FO.cpuMix;
  let i = 0; while (i < R.length - 2 && r > R[i + 1][0]) i++;
  const [ra, ma] = R[i], [rb, mb] = R[i + 1], k = clamp((r - ra) / (rb - ra), 0, 1);
  const mix = ma.map((v, j) => v + (mb[j] - v) * k), tot = mix.reduce((x, y) => x + y, 0);
  let u = Math.random() * tot, g = 0; while (g < 4 && u > mix[g]) { u -= mix[g]; g++; }
  const lo = g === 0 ? 0 : FO.gradeMs[g - 1], hi = g < 4 ? FO.gradeMs[g] : FO.gradeMs[3] + 120;
  return (Math.random() < 0.5 ? -1 : 1) * rand(lo + 1, hi);
}
function resolveFaceoff() {
  const tk = S.fo.takers, human = !S.autoAI && tk[0] && tk[0] === ctrl;
  // FACEOFF GRADES (Nov 21). Your timing is graded from how far off the drop you pressed; the computer's grade is rolled
  // from its centre's Faceoff rating (difficulty only shifts that rating). The draw then goes mostly to the better grade.
  const tim = [0, 1].map(t => {
    const p = tk[t]; if (!p) return { g: 4, e: 9999, label: 'EARLY', fo: 0 };
    const fo = A(p, 'fo');
    let e;
    if (t === 0 && human) e = S.fo.humanAt == null ? FO.lateMs * 2 : S.fo.humanAt - (S.fo.iceAt || (S.fo.dropAt + (S.fo.kind ? S.fo.kind.h / S.fo.kind.g : 4) * 16.7));
    else e = S.fo.cpuE && S.fo.cpuE[t] != null ? S.fo.cpuE[t] : foCpuTiming(p);
    const g = foGrade(e), noPress = t === 0 && human && S.fo.humanAt == null, jumped = e < -FO.jumpMs;
    const label = noPress ? 'NO PRESS' : jumped ? 'JUMPED' : FO_GRADES[g] || (e < 0 ? 'EARLY' : 'LATE');
    return { g: noPress || jumped ? 4 : g, e, label: g === 4 && !noPress && !jumped ? (e < 0 ? 'EARLY' : 'LATE') : label, fo, jumped };
  });
  const [a0, a1] = tim;
  let p0;
  if (a0.g === 4 && (human || a1.g !== 4)) p0 = FO.blownWin;                              // you blew it: lost, whatever he did (97%)
  else if (a0.g === 4 && a1.g === 4) p0 = 0.5 + (a0.fo - a1.fo) * FO.attrW;               // two computer centres both blew it: a scramble                                                   // you blew it: almost always lost
  else if (a1.g === 4) p0 = 1 - FO.blownWin;
  else if (a0.g < a1.g) p0 = FO.betterWin;                                                 // the better grade
  else if (a0.g > a1.g) p0 = 1 - FO.betterWin;
  else {                                                                                   // the same grade: the closer press, then the centres
    p0 = Math.abs(a0.e) < Math.abs(a1.e) ? FO.closerWin : Math.abs(a0.e) > Math.abs(a1.e) ? 1 - FO.closerWin : 0.5;
    p0 += clamp((a0.fo - a1.fo) * FO.attrW, -0.1, 0.1);
  }
  if (a0.jumped && S.diff === 'HARD' && human) p0 = 0;                                     // Hard: jumping the drop is a violation
  p0 = clamp(p0, 0.01, 0.99);
  const win = Math.random() < p0 ? 0 : 1, wc = tk[win];
  if (typeof dlFo === 'function') dlFo({ human, label: tim[0].label, ms: Math.round(tim[0].e), cpu: tim[1].label, cpuMs: Math.round(tim[1].e), fo: [tim[0].fo, tim[1].fo], chance: +p0.toFixed(2), won: win === 0 });
  // the winner draws it to a teammate behind him (or open ice behind)
  const mates = teamSkaters(win).filter(m => m !== wc && (m.y - wc.y) * attackDir(win) > 4);
  const tgt = mates.sort((a, b) => dist(a, wc) - dist(b, wc))[0];
  const tx = tgt ? tgt.x : wc.x + rand(-10, 10), ty = tgt ? tgt.y : wc.y - attackDir(win) * 14;
  const d = hyp(tx - puck.x, ty - puck.y) || 1, sp = tgt ? clamp(1.4 + d * 0.012, 1.6, 2.6) : 1.6;
  puck.vx = (tx - puck.x) / d * sp + rand(-0.2, 0.2); puck.vy = (ty - puck.y) / d * sp;
  S.phase = 'live'; S.cpuDelay = DIFF[S.diff].react; S.foWinner = win;
  if (win === 0 && human) {
    // you won it: a backward direction on your tap snaps it to the teammate on that side; otherwise you keep it
    const dir = S.fo.dir || { x: 0, y: 0 }, up = attackDir(0), back = dir.y * up < 0;
    puck.owner = wc; puck.lastTouch = wc; puck.vx = puck.vy = 0; wc.vx = wc.vy = 0;
    if (back) {
      const behind = teamSkaters(0).filter(m => m !== wc && (m.y - wc.y) * up < 6);
      const side = Math.sign(dir.x);
      const pick = (side ? behind.filter(m => Math.sign(m.x - wc.x) === side) : behind).sort((a, b) => dist(a, wc) - dist(b, wc))[0] || behind.sort((a, b) => dist(a, wc) - dist(b, wc))[0];
      if (pick) {
        const d0 = dist(wc, pick) || 1, sp0 = clamp(2.2 + d0 * 0.02, 2.6, 4.2);
        releasePuck(wc, (pick.x - puck.x) / d0 * sp0, (pick.y - puck.y) / d0 * sp0, 16); puck.deliberate = wc;
        puck.passFrom = wc; puck.passT = S.t; puck.passPow = 0.2; puck.passTarget = pick; puck.recvTried = false; puck.passD = d0; puck.laneDef = 0;
        S.fo.how = 'DRAWN BACK';
      }
    } else S.fo.how = 'KEEPS IT';
  }
  if (MS) {
    MS.foPending = true;
    for (const t of [0, 1]) if (tk[t] && tk[t].pl && !S.so) { const st = pst(tk[t].pl, t); st.fot++; if (t === win) st.fow++; }
  }
  if (human) {
    if (foTipsLeft() > 0) foTipUsed();
    S.fo.fb = { label: tim[0].label + ' vs their ' + tim[1].label, won: win === 0, life: FO_FB_LIFE, you: tim[0].label + (tim[0].jumped && S.diff === 'HARD' ? ': VIOLATION' : ''), them: tim[1].label,
      e: S.fo.humanAt == null ? null : tim[0].e, ce: tim[1].e, how: win === 0 ? S.fo.how || null : null };
    // one short call over the dot (the grade and the timing are in the panel at the bottom), above the name tags
    floaters.push({ x: S.fo.x, y: S.fo.y - 50, text: win === 0 ? 'WON IT!' : 'LOST IT', life: 50, color: win === 0 ? '#5ee07a' : '#ff7a6e' });
  }
  if (wc && !wc.foSwipe) wc.foSwipe = 10;
  sfx.stick();
}
// the faceoff taker: the centre on the ice (best one if two), otherwise the best faceoff man
function foTaker(t) {
  const sk = teamSkaters(t); if (!sk.length) return null;
  const cs = sk.filter(p => p.pl && p.pl.spos === 'C');
  const pool = cs.length ? cs : sk;
  return pool.slice().sort((a, b) => A(b, 'fo') - A(a, 'fo') || a.role - b.role)[0];
}
function scoreGoal(team) {
  if (!live()) return;
  if (S.so) return shootoutGoal(team);
  const penShotGoal = S.phase === 'penalty';
  // NO GOAL: an attacker was in the crease on top of the goalie as it went in (the ref's call: usually waved off)
  { const g = typeof goalieObj === 'function' ? goalieObj(1 - team) : null;
    if (!penShotGoal && g && g.interfT != null && S.t - g.interfT < 30 && g.interfBy && g.interfBy.team === team && Math.random() < 0.3) {
      g.interfT = null; puck.inNet = false;
      floaters.push({ x: CX, y: isUp(team) ? GL_TOP + 40 : GL_BOT - 60, text: 'NO GOAL!', life: 120, big: true, color: '#ff7a6e' });
      rsLog(`NO GOAL - FOUL ON THE KEEPER (${TEAM[team].abbr}${g.interfBy.pl ? ', ' + plTagPl(g.interfBy.pl) : ''})`);
      say(['NO GOAL! HE WAS IN THE BLUE PAINT!', 'THE REF WAVES IT OFF. FOUL ON THE KEEPER.'], 3);
      if (team === (S.match ? S.match.home : 0)) sfx.boo(); else sfx.cheer(0.6);   // the home crowd's view of it
      whistle('NO GOAL', 'FOUL ON THE KEEPER', () => setupFaceoff(CX + (puck.x < CX ? -DOT_DX : DOT_DX), isUp(team) ? NEU_DOT_Y[0] : NEU_DOT_Y[1]));
      return;
    } }
  statGoal(team, penShotGoal);
  if (typeof rulesGoal === 'function') rulesGoal(team, penShotGoal);
  S.score[team]++; S.sog[team]++;
  S.phase = 'goal'; S.timer = 170; S.goalFlash = 40; S.lastGoalTeam = team; S.lamp[team] = 170;
  const homeT = S.match ? S.match.home : 0;
  S.cheer = S.match && S.match.tourney && S.match.tourney.tier >= 2 ? 260 : 170; S.cheerKind = team === homeT ? 'home' : 'away';
  const who = puck.lastTouch && puck.lastTouch.team === team ? '#' + puck.lastTouch.num : '';
  if ((puck.setup || 0) >= 0.4 && !S.so) floaters.push({ x: puck.x, y: puck.y - 46, text: 'SET UP!', life: 90, color: '#7ec8ff' });
  if (S.so || !S.pres || S.pres.goal === 'OFF') floaters.push({ x: CX, y: isUp(team) ? GL_TOP + 40 : GL_BOT - 60, text: 'GOAL! ' + who, life: 150, big: true, color: '#ffd23f' });
  for (let i = 0; i < 40; i++) particles.push({ x: puck.x, y: puck.y, vx: rand(-2.5, 2.5), vy: rand(-2.5, 2.5), life: rand(30, 70),
    color: ['#ffd23f', '#ffffff', TEAM[team].main][i % 3] });
  for (const r of refs) r.arm = 90;
  sfx.goalSound(team); if (team === homeT) { sfx.cheer(1.4); excite(1); } else { sfx.boo(); excite(0.3); }
  setTimeout(() => { typeof voiceCue === 'function' && voiceCue(S.period >= 4 ? 'bigGoal' : 'goal', team === homeT ? 1 : 0.8); }, 450);
  { // goal call
    const ls = S.lastShot && S.t - S.lastShot.t < 240 ? S.lastShot : null, T = TEAM[team], n = puck.lastTouch && puck.lastTouch.team === team ? puck.lastTouch.num : '';
    let lines;
    if (ls && ls.pen) lines = [`#${n} BURIES THE PENALTY KICK!`, 'HE SHOOTS... HE SCORES ON THE PENALTY KICK!'];
    else if (ls && ls.tip) lines = ['DEFLECTED IN! WHAT A TOUCH IN FRONT!', `#${n} GETS A PIECE OF IT... AND IT'S IN!`, 'A DEFLECTION AND THE KEEPER IS HANDCUFFED!'];
    else if (ls && ls.oneT) lines = puck.otLat > 0.5 ? ['ACROSS THE SIX-YARD BOX AND HIT FIRST TIME HOME!', 'THE KEEPER COULDN\'T GET ACROSS IN TIME!', `#${n} HAMMERS THE FIRST-TIME SHOT HOME!`] : ['FIRST-TIME SHOT! THE KEEPER NEVER SAW IT!', `#${n} HAMMERS THE FIRST-TIME SHOT HOME!`];
    else if (ls && ls.reb) lines = ['HE BANGS HOME THE REBOUND!', 'SECOND CHANCE... AND IT GOES IN!'];
    else if (ls && ls.dk) lines = ['HE DANGLES... AND SHOOTS IT IN BEFORE THE KEEPER RECOVERS!', `#${n} FAKES HIM OUT OF HIS JOCK AND SCORES!`, 'OFF THE FEINT, QUICK RELEASE, GOAL!'];
    else if (ls && ls.kind === 'slap') lines = ls.scr ? ['A BOMB FROM THE EDGE OF THE BOX THROUGH TRAFFIC!', 'HE NEVER SAW THE POWER SHOT!'] : ['A CANNON FROM THE EDGE OF THE BOX!', `#${n} WINDS UP AND BLASTS IT HOME!`];
    else if (ls && ls.kind === 'snap') lines = ls.unset ? ['SNAPPED IT IN BEFORE THE KEEPER WAS SET!', 'QUICK SNAP SHOT CATCHES HIM MOVING!'] : ['WHAT A SNAP SHOT!', `#${n} SNAPS IT HOME!`];
    else if (ls && ls.kind === 'back') lines = ['ON THE WEAK FOOT! WHAT A FINISH!', `#${n} ROOFS THE WEAK FOOT!`, 'WEAK FOOT, IN TIGHT, AND IT\'S IN!'];
    else if (ls && ls.unset) lines = ['HE CAUGHT THE KEEPER MOVING!', 'THE KEEPER WASN\'T SET AND HE MAKES HIM PAY!'];
    else if (ls && ls.zone === 'high') lines = ['TOP CORNER, WHERE MOM KEEPS THE COOKIES!', 'PICKED THE CORNER! TOP CORNER!', 'UNDER THE BAR! WHAT A SNIPE!'];
    else if (ls && ls.zone === 'five') lines = ['RIGHT THROUGH THE NUTMEG!', 'NUTMEG! RIGHT BETWEEN THE LEGS!'];
    else if (ls && ls.zone === 'mid') lines = ['OFF THE HIP AND IN!', 'HALFWAY UP, PAST THE GLOVE!', 'HE FINDS THE GAP UNDER THE ARM!'];
    else if (ls && ls.zone === 'low') lines = ['LOW AND HARD, JUST INSIDE THE POST!', 'BOTTOM CORNER! PERFECT PLACEMENT!'];
    else lines = ['HE SHOOTS... HE SCORES!', `#${n} FINDS THE NET!`];
    if (team !== homeT) lines = lines.concat([`THE ${T.nick.toUpperCase()} SCORE. YOU COULD HEAR A PIN DROP.`]);
    else lines = lines.concat([`THE ${T.city.toUpperCase()} FAITHFUL ARE ON THEIR FEET!`]);
    say(lines, 3);
  }
  setTimeout(() => sfx.whistle(true), 350);
  onGoalPresentation(team);
  { // highlight
    const lg = MS && MS.lastGoal, nm = id => id && MS.p[id] ? '#' + MS.p[id].num + ' ' + MS.p[id].name.toUpperCase() : '';
    const late = S.period >= 3 && S.clock < 60 && Math.abs(S.score[0] - S.score[1]) <= 1;
    const imp = S.period >= 4 ? 85 : S.phase === 'penalty' ? 70 : late ? 65 : 50;
    const ast = lg && lg.assists.length ? ' (' + lg.assists.map(nm).join(', ') + ')' : '';
    const ls2 = S.lastShot && S.t - S.lastShot.t < 240 && S.lastShot.team === team && S.phase !== 'penalty' ? S.lastShot : null;   // how it went in, for the highlight reel
    const how = !ls2 ? '' : ls2.tip ? ' · DEFLECTION' : ls2.oneT ? ' · FIRST-TIME SHOT' : ls2.reb ? ' · REBOUND' : ls2.wrap ? ' · NEAR-POST POKE' : ls2.dk ? ' · OFF THE FEINT' : ({ slap: ' · POWER SHOT', snap: ' · SNAP SHOT', back: ' · WEAK FOOT', wrist: ' · PLACED SHOT' })[ls2.kind] || '';
    clipEvent('goal', { text: (S.period >= 4 ? 'ET GOAL! ' : S.phase === 'penalty' ? 'PENALTY KICK GOAL! ' : 'GOAL! ') + (lg ? nm(lg.scorer) : '') + ast + how, team, how: how.replace(' · ', ''),
      scorer: lg ? lg.scorer : null, assists: lg ? lg.assists : [], goalie: gk(1 - team).pl ? gk(1 - team).pl.id : null,
      players: [lg && lg.scorer, ...(lg ? lg.assists : []), gk(1 - team).pl && gk(1 - team).pl.id].filter(Boolean), ot: S.period >= 4, pen: S.phase === 'penalty', goalIdx: (MS && MS.goals ? MS.goals.length - 1 : -1) }, imp);
  }
}
// stoppage with a banner; `next` runs when it ends
function foHurryOK() {
  if (S.screen !== 'play' || S.so || (S.spot && S.spot.active) || S.walk || S.pendingFight) return false;
  if (S.phase === 'whistle') return S.banner && S.banner.life != null && S.timer > 4 && S.whT0 - S.timer >= 30;
  if (S.phase === 'faceoff') return S.fo && !S.fo.dropped && S.timer > FO.readyT + 1;
  return false;
}
function foHurry() {
  if (S.phase === 'whistle') { S.timer = 1; if (S.banner) S.banner.life = Math.min(S.banner.life, 8); }
  else if (S.phase === 'faceoff') S.timer = FO.readyT + 1;
}
function whistle(text, sub, next, frames = 100, quiet) {
  S.minorStop = false; S.adv = null;
  S.phase = 'whistle'; S.timer = frames; S.whT0 = frames; S.banner = { text, sub, life: frames }; S.next = next;
  for (const p of players) { p.charge = -1; p.lunge = 0; }
  puck.passTarget = null; input.shiftPending = false;
  for (const r of refs) r.arm = frames;
  if (!quiet) sfx.whistle(true);
}
// HYBRID ICING (as in the NHL): when the puck is iced the linesman doesn't blow the whistle straight away. It's a race to
// the end-zone faceoff dots: if a skater from the team that iced it gets there first, icing is waved off and play goes
// on; if a defender gets there first (or touches the puck), it's icing. A goalie who plays the puck waves it off too.
function startIcingRace(team) {
  S.icing = { team, t: S.t, dotY: isUp(team) ? END_DOT_Y[0] : END_DOT_Y[1], up: isUp(team) };
  puck.iceTeam = null;
  const lj = refs && refs[1]; if (lj) lj.arm = Math.max(lj.arm || 0, 30);           // the linesman's arm goes up
  floaters.push({ x: puck.x, y: puck.y + (isUp(team) ? 26 : -26), text: 'LONG BALL?', life: 50, color: '#ffd23f' });
}
function icingTick() {
  const I = S.icing; if (!I) return;
  if (S.phase !== 'live') { S.icing = null; return; }
  const decide = (iced, who) => {
    S.icing = null;
    if (iced) return callIcing(I.team);
    floaters.push({ x: who ? who.x : puck.x, y: (who ? who.y : puck.y) - 34, text: 'NO LONG BALL!', life: 55, color: '#5ee07a' });
    say(['HE BEATS IT OUT! NO LONG BALL.', 'THE LINESMAN WAVES IT OFF. HE WON THE RACE.'], 1, 0.7);
  };
  const o = puck.owner;
  if (o) return decide(!o.g && o.team !== I.team, o);                        // a defender touched it: icing. Their own man or a goalie: play on
  // first skater past the dots (between them and the end boards) decides it
  const past = skaters.filter(p => !p.g && p.on !== false && p.stun <= 0 && (I.up ? p.y < I.dotY : p.y > I.dotY));
  if (past.length) { const lead = past.reduce((a, b) => (hyp(a.x - puck.x, a.y - puck.y) <= hyp(b.x - puck.x, b.y - puck.y) ? a : b)); return decide(lead.team !== I.team, lead); }
  if (S.t - I.t > 60 * 4) decide(true);                                        // nobody raced for it
}
function callIcing(team) {
  say(['LONG BALL. THEY NEEDED A BREATHER.', 'THE BALL GOES ALL THE WAY DOWN. LONG BALL.'], 2);
  whistle('LONG BALL', TEAM[team].abbr, () => setupFaceoff(CX + (puck.x < CX ? -DOT_DX : DOT_DX), isUp(team) ? END_DOT_Y[1] : END_DOT_Y[0]));
}
function callOffside(team) {
  say(['OFFSIDE. THEY WERE A STEP AHEAD OF THE PLAY.', 'THE LINESMAN WAVES IT OFF... OFFSIDE.'], 2);
  const x = CX + (puck.x < CX ? -DOT_DX : DOT_DX);
  whistle('OFFSIDE', TEAM[team].abbr, () => setupFaceoff(x, isUp(team) ? NEU_DOT_Y[0] : NEU_DOT_Y[1]));
}
// ---------- SOCCER: OUT OF PLAY
// Over a touchline: a THROW-IN to the side that didn't touch it last. Over a goal line outside the posts: a CORNER if the
// defending side put it there, otherwise a GOAL KICK (the keeper restarts with it in his hands). The taker stands over
// the ball and must play it: he can't run with it, and if he dawdles it's played for him.
function keepOnPitch(e, m, ball) {
  const inMouth = ball && Math.abs(e.x - CX) < GOAL_HW + 1;                     // carrying it into the goal still scores
  if (e.x < TL_L + m) e.x = TL_L + m; else if (e.x > TL_R - m) e.x = TL_R - m;
  if (!inMouth) { if (e.y < GL_TOP + m) e.y = GL_TOP + m; else if (e.y > GL_BOT - m) e.y = GL_BOT - m; }
}
function checkOutOfPlay() {
  if (S.phase !== 'live' || puck.inNet || S.so || S.scen || (S.mode && !S.mode.game)) return;
  const o = puck.owner; if (o) return;
  const m = PUCK_R, x = puck.x, y = puck.y;
  const side = x < TL_L - m ? -1 : x > TL_R + m ? 1 : 0, end = y < GL_TOP - m ? -1 : y > GL_BOT + m ? 1 : 0;
  if (!side && !end) return;
  const lt = puck.lastTouch, last = lt ? lt.team : (puck.shotTeam != null ? puck.shotTeam : -1);
  if (end) {
    { const sp = Math.hypot(puck.vx, puck.vy); if (end < 0 && sp > 3) BOARDFX.net = { x, t: S.t, big: sp > 6 }; }   // SOCCER: over the bar into the ball-stop net
    const gy = end < 0 ? GL_TOP : GL_BOT, def = ownGoalY(0) === gy ? 0 : 1;      // whose goal is at this end
    if (last === def) return callOut('corner', 1 - def, x < CX ? TL_L : TL_R, gy);
    return callOut('goalkick', def, x, gy);
  }
  const team = last < 0 ? (Math.random() < 0.5 ? 0 : 1) : 1 - last;
  callOut('throw', team, side < 0 ? TL_L : TL_R, clamp(y, GL_TOP + 8, GL_BOT - 8));
}
const OUT_NAMES = { throw: 'THROW-IN', corner: 'CORNER', goalkick: 'GOAL KICK' };
function callOut(kind, team, x, y) {
  S.icing = null; puck.passTarget = null; puck.shot = null; puck.rim = null;
  if (MS) { MS.outs = MS.outs || { throw: 0, corner: 0, goalkick: 0 }; MS.outs[kind]++; }
  const nick = (TEAM[team].nick || TEAM[team].abbr || '').toUpperCase();
  if (kind === 'corner') { say([`CORNER TO THE ${nick}.`, 'HE PUTS IT BEHIND FOR A CORNER.', 'CORNER KICK. BODIES IN THE BOX!'], 1, 0.7); excite(0.25); }
  else if (kind === 'goalkick') say(['WIDE. GOAL KICK.', 'THAT ONE DRIFTS BEHIND FOR A GOAL KICK.', 'OUT FOR A GOAL KICK.'], 1, 0.45);
  else say([`THROW-IN, ${nick}.`, 'OUT OF PLAY. THROW-IN.', 'IT RUNS OUT OVER THE LINE.'], 1, 0.3);
  whistle(OUT_NAMES[kind], TEAM[team].abbr, () => setupRestart(kind, team, x, y), kind === 'throw' ? 50 : 70, kind === 'throw');
  S.minorStop = true;
  if (refs[1]) refs[1].arm = 50;
}
function setupRestart(kind, team, x, y) {
  S.minorStop = false; S.banner = null; S.phase = 'live'; S.cpuDelay = Math.max(S.cpuDelay || 0, 10);
  for (const p of players) { p.charge = -1; p.lunge = 0; p.restart = null; }
  const up = attackDir(team);
  if (kind === 'goalkick') {
    const g = goalies[team];
    if (g && g.on !== false && !g.ghost) {
      resetPuck(g.x, g.y);
      g.x = clamp(g.x, CX - SIX_HW, CX + SIX_HW); g.y = ownGoalY(team) + up * 14; g.vx = g.vy = 0;
      puck.owner = g; puck.lastTouch = g; g.hold = 55; g.gpT = 0; g.gCharge = null; g.gAim = null; g.fetched = true;
      for (const o of teamSkaters(1 - team)) if (Math.abs(o.y - ownGoalY(team)) < PEN_D + 4 && Math.abs(o.x - CX) < PEN_HW + 4) o.y = ownGoalY(team) + up * (PEN_D + 6);   // out of the box
      if (team === 0 && !S.autoAI) setCtrl(g, true);
      return;
    }
    x = CX + (x < CX ? -SIX_HW : SIX_HW); y = ownGoalY(team) + up * SIX_D; kind = 'free';          // no keeper: a defender takes it from the six-yard box
  }
  const mates = teamSkaters(team).filter(p => p.on !== false && !(p.stun > 0));
  const taker = (mates.length ? mates : teamSkaters(team)).slice().sort((a, b) => hyp(a.x - x, a.y - y) - hyp(b.x - x, b.y - y))[0];
  if (!taker) { resetPuck(clamp(x, TL_L + 4, TL_R - 4), clamp(y, GL_TOP + 4, GL_BOT - 4)); return; }
  // he stands just outside the line, facing in (at a corner: facing the far post)
  const sx = x <= TL_L ? -1 : x >= TL_R ? 1 : 0;
  let fx, fy;
  if (kind === 'corner') { const tx = CX, ty = y - up * 0 + (y === GL_TOP ? 30 : -30), d = hyp(tx - x, ty - y) || 1; fx = (tx - x) / d; fy = (ty - y) / d; }
  else if (sx) { fx = -sx; fy = 0.35 * up; const d = hyp(fx, fy); fx /= d; fy /= d; }
  else { fx = 0; fy = up; }
  resetPlayerState(taker);
  taker.x = x - fx * 7; taker.y = y - fy * 7; taker.fx = fx; taker.fy = fy; taker.vx = taker.vy = 0; taker.mx = taker.x; taker.my = taker.y;
  resetPuck(x, y); puck.owner = taker; puck.lastTouch = taker;
  taker.restart = { kind, t: S.t, x: taker.x, y: taker.y };
  if (kind === 'corner' && typeof keeperUpCheck === 'function' && keeperUpCheck(team) && team === 0 && !S.autoAI) floaters.push({ x: taker.x, y: taker.y - 60, text: 'YOUR KEEPER IS COMING UP: WAIT FOR HIM!', life: 150, color: '#ffd23f' });
  // the other side backs off
  for (const o of teamSkaters(1 - team)) { const d = hyp(o.x - x, o.y - y); if (d < 30) { const k = 30 / (d || 1); o.x = clamp(x + (o.x - x) * k, TL_L + 4, TL_R - 4); o.y = clamp(y + (o.y - y) * k + (d < 1 ? up * 30 : 0), GL_TOP + 4, GL_BOT - 4); } }
  if (team === 0 && !S.autoAI) { setCtrl(taker, true); if (kind !== 'throw') floaters.push({ x: taker.x, y: taker.y - 44, text: 'LOFT = CROSS · HOLD ACROSS = BEND', life: 110, color: '#ffd23f' }); }
  sfx.pass && (S.restartT = S.t);
}
// the taker is rooted to the spot until he plays it; the computer plays it quickly, you get a few seconds
function restartTick() {
  for (const p of players) {
    if (!p.restart) continue;
    if (puck.owner !== p || S.phase !== 'live') { p.restart = null; continue; }
    p.x = p.restart.x; p.y = p.restart.y; p.vx = p.vy = 0;
    const human = p === ctrl && !S.autoAI, wait = S.t - p.restart.t;
    if (p.restart.kind === 'corner' && typeof keeperUpWait === 'function' && keeperUpWait(p.team, wait)) {   // SOCCER: waiting for the keeper to come up
      for (const o of teamSkaters(1 - p.team)) { const d = hyp(o.x - p.x, o.y - p.y); if (d < 30) { const k = 30 / (d || 1); o.x = clamp(p.x + (o.x - p.x) * k, TL_L + 4, TL_R - 4); o.y = clamp(p.y + (o.y - p.y) * k, GL_TOP + 4, GL_BOT - 4); } }   // (they keep their distance)
      if (!human) continue;
    }
    if (!human && wait > 30 && (p.restart.kind === 'corner' || p.restart.kind === 'free')) {
      const r = p.restart, gy = oppGoalY(p.team), dG = hyp(CX - p.x, gy - p.y);
      const box = teamSkaters(p.team).filter(m => m !== p && m.stun <= 0 && Math.abs(m.x - CX) < PEN_HW && Math.abs(m.y - gy) < PEN_D + 10);
      if (r.kind === 'free' && dG < 150 && Math.abs(p.x - CX) < PEN_HW && Math.random() < 0.6) { p.restart = null; p.fx = (CX - p.x) / dG; p.fy = (gy - p.y) / dG; shoot(p, 0.85); puck.curve = (Math.random() < 0.5 ? -1 : 1) * rand(0.006, 0.012); floaters.push({ x: p.x, y: p.y - 30, text: 'FREE KICK!', life: 34, color: '#ffd23f' }); continue; }
      const kup = r.kind === 'corner' && typeof keeperUpTarget === 'function' ? keeperUpTarget(p.team) : null;
      if (kup) { p.restart = null; crossTo(p, kup); puck.curve = (p.x < CX ? 1 : -1) * attackDir(p.team) * -0.004; continue; }
      if (box.length && (r.kind === 'corner' || dG < 220)) { p.restart = null; crossTo(p, box[(Math.random() * box.length) | 0]); puck.curve = (p.x < CX ? 1 : -1) * attackDir(p.team) * -0.004; continue; }
    }
    if (wait > (human ? 60 * 5 : 40 + (Math.random() * 30 | 0))) {
      const r = p.restart; p.restart = null;
      if (pass(p) === false || puck.owner === p) {                         // nobody to find: hoof it into the box / up the line
        const tx = r.kind === 'corner' ? CX + rand(-20, 20) : p.x + p.fx * 80, ty = r.kind === 'corner' ? oppGoalY(p.team) - attackDir(p.team) * 30 : p.y + attackDir(p.team) * 60;
        const d = hyp(tx - puck.x, ty - puck.y) || 1, sp = Math.min(6, Math.sqrt(d) * 0.42 + 1.8);
        releasePuck(p, (tx - puck.x) / d * sp, (ty - puck.y) / d * sp, 16); puck.lastTouch = p;
      }
    }
  }
}
function callPenalty(victim) {
  const team = victim.team;
  say(["TACKLE FROM BEHIND! THAT'S A PENALTY KICK!", `THE REF HAS SEEN ENOUGH. PENALTY KICK FOR THE ${TEAM[team].nick.toUpperCase()}!`], 3);
  whistle('PENALTY', 'TACKLE FROM BEHIND - ' + TEAM[team].abbr + ' PENALTY KICK', () => setupPenaltyShot(team, victim), 140);
}
function setupPenaltyShot(team, shooter) {
  { const g = goalieObj(1 - team); if (!g.on) { g.on = true; resetPlayerState(g); goalieHome(g); if (!g.pl && S.match && S.match.lineups) g.pl = S.match.lineups[1 - team].goalie; rebuildActive(); } }
  if (!shooter || shooter.g || !shooter.on) shooter = skaters.find(p => p.team === team && p.role === 1);
  if (S.so) { /* keep the shootout banner */ }
  const benchIdx = [0, 0];
  for (const p of players) {
    resetPlayerState(p);
    if (p.g) { goalieHome(p); continue; }
    if (p === shooter) { p.x = CX; p.y = oppGoalY(team) - attackDir(team) * (PEN_SPOT + 9); p.fx = 0; p.fy = attackDir(team); continue; }   // SOCCER: from the penalty spot
    p.x = p.team === 0 ? R.l + 12 : R.r - 12;
    p.y = (p.team === 0 ? CY - 90 : CY + 40) + benchIdx[p.team]++ * 30;
    p.fx = p.team === 0 ? 1 : -1; p.fy = 0;
  }
  for (const p of players) { p.mx = p.x; p.my = p.y; }
  resetPuck(CX, oppGoalY(team) - attackDir(team) * PEN_SPOT);
  puck.owner = shooter; puck.lastTouch = shooter;
  S.phase = 'penalty'; S.pen = { team, shooter, goalie: goalies[1 - team] || goalieObj(1 - team), taken:false, t:0, endT:0 };
  S.banner = null;
  if (team === 0) ctrl = shooter;
  if (!S.so) {
    floaters.push({ x: CX, y: CY - 40, text: 'PENALTY KICK', life: 110, big: true, color: '#ffd23f' });
    say([`#${shooter.num} PLACES THE BALL ON THE SPOT...`, 'HE STEPS UP TO TAKE THE PENALTY...', 'JUST HIM, THE BALL AND THE KEEPER...'], 3);
  } else say([`#${shooter.num} ${shooter.pl ? shooter.pl.last.toUpperCase() : ''} STEPS UP FOR THE ${TEAM[team].nick.toUpperCase()}...`], 3);
  excite(0.55);
  updateCamera(true);
}
function endPenalty() {
  if (S.so) { S.so.att[S.pen.team].push(0); floaters.push({ x: CX, y: isUp(S.pen.team) ? GL_TOP + 50 : GL_BOT - 50, text: 'NO GOAL', life: 60, color: '#ffffff' }); return whistle('SAVED', soLine(), () => nextShootout(), 70); }
  floaters.push({ x: CX, y: isUp(S.pen.team) ? GL_TOP + 50 : GL_BOT - 50, text: 'NO GOAL', life: 70, color: '#ffffff' });
  const pt = S.pen.team; whistle('NO GOAL', '', () => { S.kickNext = 1 - pt; setupFaceoff(CX, CY); }, 70);
}
function endPeriod() {
  S.adv = null; if (typeof keeperUpClear === 'function') keeperUpClear();
  sfx.buzzer();
  goalieRest(PLAY.gRestoreInter);
  if (typeof modeEndPeriod === 'function' && modeEndPeriod()) return;
  if (S.period < 3) return startIntermission();
  if (S.score[0] !== S.score[1]) return endMatch();
  if (S.period === 3 && S.match && S.match.decider === 'draw') return endMatch();   // SOCCER: a league game can end level
  if (S.period === 3) return showMsg('overtime');
  // overtime ended tied
  if (S.match && S.match.decider === 'sudden') return showMsg('overtime');
  return startShootout();
}
function continueAfterMsg() {
  const lastInter = S.inter;
  hideOverlays(); S.inter = null; zamboniHum(false);
  if (typeof alienTeamRoll === 'function') try { alienTeamRoll(lastInter); } catch (e) {}   // after the saucers: 1 in 10, your team comes back out as aliens
  if (typeof showTacPick === 'function') showTacPick(false);
  const fromInter = S.period < 3;
  S.period++; setEnds(); S.clock = S.periodLen; S.saidMin = false; clearMarks();
  periodRest();
  setupFaceoff(CX, CY); updateCamera(true); S.screen = 'play';
  if (fromInter && typeof startWalkout === 'function') startWalkout(false);
}
// ---------- shootout: three rounds, then sudden death
function startShootout() {
  S.so = { att: [[], []], first: S.match ? S.match.home ?? 0 : 0, done: false };   // the home team shoots first (in tournaments the higher seed is the home team)
  say(['WE NEED A SHOOTOUT TO DECIDE THIS ONE!', 'TO THE SHOOTOUT WE GO!'], 3);
  nextShootout();
}
function soLine() { const f = a => a.map(x => x ? 'O' : 'X').join(' ') || '-'; return TEAM[0].abbr + ' ' + f(S.so.att[0]) + '   ' + TEAM[1].abbr + ' ' + f(S.so.att[1]); }
function soShooter(t) {
  const lu = S.match.lineups[t];
  const all = lu.lines.flat().filter(Boolean).sort((a, b) => (b.attrs.acc + b.attrs.pow) - (a.attrs.acc + a.attrs.pow));
  return all[S.so.att[t].length % Math.max(1, all.length)];
}
function nextShootout() {
  const so = S.so, [a, b] = so.att;
  const ga = a.filter(Boolean).length, gb = b.filter(Boolean).length;
  if (a.length === b.length && a.length >= 3 && ga !== gb) return finishShootout(ga > gb ? 0 : 1);
  if (a.length <= 3 && b.length <= 3 && (ga + 3 - a.length < gb || gb + 3 - b.length < ga)) return finishShootout(ga > gb ? 0 : 1);
  const t = a.length === b.length ? so.first : (a.length < b.length ? 0 : 1);
  const slot = skaters.find(p => p.team === t && p.role === 1);
  const pl = soShooter(t); if (pl) { slot.pl = pl; slot.num = pl.num; slot.cap = S.match.lineups[t].leaders ? S.match.lineups[t].leaders[pl.id] || null : null; }
  setupPenaltyShot(t, slot);
  S.banner = { text: 'SHOOTOUT', sub: soLine(), life: 110 };
}
function shootoutGoal(team) {
  S.so.att[team].push(1);
  { const sh = S.pen && S.pen.shooter; clipEvent('so', { text: 'SHOOTOUT GOAL! ' + plTag(sh), team, scorer: sh && sh.pl ? sh.pl.id : null, players: sh && sh.pl ? [sh.pl.id] : [], so: true, round: S.so.att[team].length }, 45); }
  S.phase = 'goal'; S.timer = 90; S.goalFlash = 30; S.lamp[team] = 90;
  floaters.push({ x: CX, y: isUp(team) ? GL_TOP + 40 : GL_BOT - 60, text: 'SCORES!', life: 80, big: true, color: '#ffd23f' });
  typeof voiceCue === 'function' && voiceCue('scores');
  sfx.goalSound(team); excite(0.9);
}
function finishShootout(w) {
  S.so.done = true; S.score[w]++;
  say(['AND THAT WINS IT IN THE SHOOTOUT!', `THE ${TEAM[w].nick.toUpperCase()} WIN THE SHOOTOUT!`], 3);
  endMatch();
}
function endMatch() {
  if (S.screen === 'post') return;
  S.screen = 'post';
  if (typeof alienTeamClear === 'function') alienTeamClear();
  if (typeof alienCheckLightsOut === 'function') try { alienCheckLightsOut(); } catch (e) {}
  const draw = S.score[0] === S.score[1] && !(S.so && S.so.done);           // SOCCER: a draw (a league game that ended level)
  const winner = draw ? -1 : S.score[0] > S.score[1] ? 0 : 1;
  // goalie decisions and games played (everyone dressed on the three lines plays)
  if (MS) {
    for (const t of [0, 1]) {
      for (const pl of S.match.lineups[t].lines.flat()) if (pl) pst(pl, t).gp = 1;
      for (const pl of S.match.lineups[t].bench || []) if (pl && MS.p[pl.id] && MS.p[pl.id].toi > 0) MS.p[pl.id].gp = 1;
      const g = S.match.lineups[t].goalie; if (g) { const s = pst(g, t); s.gp = 1; if (t === winner) s.w = 1; }
      for (const id of (MS.gUsed ? MS.gUsed[t] : [])) if (MS.p[id]) MS.p[id].gp = 1;   // a goalie pulled during the game played in it too
    }
  }
  flushClips();
  if (S.match && S.match.lineups && !S.mode && !S.match.demo && typeof endOfGameStreaks === 'function') for (const lu of S.match.lineups) endOfGameStreaks(lu.lines.flat().concat(lu.bench || [], [lu.goalie]));
  // finalise per-player numbers (expected goals x100, defensive/clutch value x10), hat tricks, the game-winning goal
  if (MS) {
    for (const l of Object.values(MS.p)) {
      l.xg = Math.round(l.xg * 100); l.xga = Math.round(l.xga * 100); l.dv = Math.round(l.dv * 10); l.cv = Math.round(l.cv * 10);
      if (l.pos !== 'G' && l.g >= 3) l.hat = 1;
    }
    const goals = MS.goals || [], sc = S.score.slice(); if (S.so && S.so.done) sc[winner]--;
    const gw = draw ? null : goals.filter(x => x.team === winner)[sc[1 - winner]];
    if (gw && gw.pid && MS.p[gw.pid] && !(S.so && S.so.done)) { MS.p[gw.pid].gwg = 1; if (gw.ot) MS.p[gw.pid].otw = 1; }
    if (!(S.so && S.so.done)) for (const l of Object.values(MS.p)) if (l.pos === 'G' && (l.team === winner || draw) && !l.ga && l.sa) l.sho = 1;   // a clean sheet (a 0-0 draw: both keepers)
  }
  const result = { gameSec: S.periodLen * 2, shots: MS && MS.shots ? MS.shots : [], score: S.score.slice(), ot: S.period >= 4 && !S.so, so: !!(S.so && S.so.done), winner, draw, clips: REC.clips.slice(), goals: MS && MS.goals ? MS.goals.slice() : [],
    stats: MS ? Object.values(MS.p) : [], team: MS ? MS.team : null, periodLen: S.periodLen,
    soLine: S.so ? soLine() : null,
    tstats: MS && MS.rs ? MS.rs.ts : null, injuries: MS && MS.rs ? MS.rs.injuries : [], events: MS && MS.rs ? MS.rs.events : [], fights: MS && MS.rs ? MS.rs.fights.log : [] };
  S.so = null;
  // you just won a championship: celebrate on the ice before the summary
  if (S.match && S.match.clinch && winner === 0 && typeof startCelebration === 'function') return startCelebration(result, S.match.clinch);
  if (typeof outroWanted === 'function' && outroWanted()) return startOutro(result);
  if (S.match && S.match.onEnd) S.match.onEnd(result);
}

// ====================================================================
//  CONTROL SELECTION
// ====================================================================
// you are steering: a direction key held, or any key pressed in the last moment. The game never hands you a
// different skater on its own while you are (a teammate getting the puck, your pass, or being flattened still do)
const STEER_MS = 350;
const playerSteering = () => KU() || KD() || KL() || KR() || performance.now() - (input.lastKeyAt || 0) < STEER_MS;
function updateControl() {
  if (switchCd > 0) switchCd--;
  if (S.manualHold > 0) S.manualHold--;
  if (puck.owner && puck.owner.team === 0 && !puck.owner.g) return setCtrl(puck.owner, true);
  // your goalie has it: you play it (pass, skate a few strides, or cover)
  if (goalies[0] && puck.owner === goalies[0] && S.phase === 'live' && !goalies[0].covering && !S.autoAI) return setCtrl(goalies[0], true);
  if (ctrl && ctrl.g) { ctrl.gCharge = null; ctrl = null; }
  if (puck.passTarget && puck.passTarget.team === 0) return setCtrl(puck.passTarget, true);
  const score = p => p.stun > 25 ? 1e9 : switchScore(p);
  let best = null, bs = 1e9;
  for (const p of teamSkaters(0)) { const s = score(p); if (s < bs) { bs = s; best = p; } }
  if (!ctrl || ctrl.stun > 25) return setCtrl(best, true);
  if (best !== ctrl && bs < score(ctrl) - 10 && switchCd <= 0 && S.manualHold <= 0 && !playerSteering()) setCtrl(best, false);   // only when clearly better (10 frames sooner), and never while you're steering
}
// who should you be: the skater nearest the puck, with a small edge to one on your own goal's side of it (he can
// defend it); the same for both ends of the rink
// who should you be: the skater who can GET TO the puck first (frames). A loose or moving puck: where he'd actually
// meet it on its path (the AI's own prediction); a carrier: straight-line skating time to him. A small edge to the man
// on his own goal's side of it (he can defend it); the same at both ends of the rink
function switchScore(p) {
  const sp = Math.max(0.6, typeof speedOf === 'function' ? speedOf(p) : 2);
  let tt;
  if (!puck.owner && hyp(puck.vx, puck.vy) > 0.4 && typeof puckPath === 'function') tt = intercept(p, puckPath()).tt;
  else { const o = puck.owner || puck; tt = dist(p, o) / sp; }
  return tt - ((p.y - puck.y) * attackDir(p.team) < 0 ? 6 : 0);
}
const SPRINT_KEEP = 0.75;                                                   // share of top speed he needs to keep the sprint through a switch
function setCtrl(p, force) {
  if (!p || ctrl === p) return;
  if (ctrl) ctrl.charge = -1;
  const was = ctrl; ctrl = p; switchCd = force ? 12 : 26;
  // SPRINT on a switch: the new man keeps it only if he is already flying (a rush, a pass he's racing onto, a hard backcheck);
  // anyone standing or gliding starts with it off, so it doesn't burn his legs the moment you move him
  // (Hard only: on Easy and Normal the sprint stays on for whoever you switch to, until you turn it off)
  if (was && S.sprintOn && !S.autoAI && S.diff === 'HARD' && hyp(p.vx, p.vy) < baseSpeed(p) * SPRINT_KEEP) {
    S.sprintOn = false; floaters.push({ x: p.x, y: p.y - 34, text: 'SPRINT OFF', life: 30, color: '#9aa2d0' });
  }
  if (was && p && p !== puck.owner && typeof onControlSwitch === 'function') onControlSwitch(p);
}
// SHOOT without the puck: cycle through your skaters (nearest the puck first; quick presses keep going down the list)
function manualSwitch() {
  const all = teamSkaters(0).filter(p => p.stun <= 25);
  if (all.length < 2) return;
  const now = performance.now();
  // a fresh press goes to the teammate nearest the puck (the next nearest if that's already you); quick presses
  // after it keep walking down the same list
  const fresh = !S.swOrder || now - (S.swAt || 0) > 1600 || S.swOrder.some(p => !all.includes(p)) || S.swOrder.length !== all.length;
  if (fresh) S.swOrder = all.slice().sort((a, b) => switchScore(a) - switchScore(b));
  S.swAt = now;
  let next;
  if (fresh) next = S.swOrder[0] !== ctrl ? S.swOrder[0] : S.swOrder[1];
  else { const i = S.swOrder.indexOf(ctrl); next = S.swOrder[(i + 1) % S.swOrder.length]; }
  setCtrl(next, true);
  S.manualHold = 150;                       // you chose him: no automatic switching for 2.5 s (a pass to you or the puck still moves you)
  sfx.pick();
}

// ====================================================================
//  ACTIONS
// ====================================================================
function oneTimer(p, power, mode = 'anti') {
  p.oneT = true; p.otMode = mode; if (MS) { MS.otN = MS.otN || [0, 0]; MS.otN[p.team]++; }   // (the other coach notices a team living on one-timers)
  if (cpuT(p.team)) { const gx = CX - p.x, gy = oppGoalY(p.team) - p.y, d = hyp(gx, gy) || 1; p.fx = gx / d; p.fy = gy / d; }
  const pf = puck.passFrom && puck.passFrom !== p ? puck.passFrom : null;
  shoot(p, Math.min(1, power + 0.08));
  p.oneT = false; p.otMode = null; puck.oneTimer = mode === 'anti' ? true : 'weak';
  // ACROSS THE CREASE: a pass that moved sideways in front of him makes him push across; one from straight behind barely moves him
  if (pf) { const gx = CX, gy0 = oppGoalY(p.team), a1 = Math.atan2(pf.x - gx, Math.abs(pf.y - gy0) + 1), a2 = Math.atan2(p.x - gx, Math.abs(p.y - gy0) + 1); puck.otLat = clamp(Math.abs(a1 - a2) / 1.1, 0, 1); if (puck.otLat > 0.55) floaters.push({ x: p.x, y: p.y - 21, text: 'ACROSS THE SIX-YARD BOX', life: 34, color: '#ffe9a8' }); }
  if (MS && p.pl) MS.ots = (MS.ots || 0) + 1;
  floaters.push({ x: p.x, y: p.y - 34, text: mode === 'react' ? 'QUICK FIRST-TIME SHOT' : mode === 'early' ? 'FIRST-TIME SHOT' : 'FIRST-TIME SHOT!', life: 50, color: '#9fd0ff' });
  excite(0.6);
}
// ---------- match statistics (all from on-ice events)
let MS = null;
function newMatchStats() {
  MS = { p: {}, team: [0, 1].map(() => ({ g: 0, sog: 0, hit: 0, pas: 0, fo: 0 })), chain: { team: -1, pids: [] }, foPending: false, stam: {}, lastPid: [null, null],
    lines: [0, 1].map(() => ({ idx: 0, t: 0, target: rand(45, 60) })), note: null, gmem: [{}, {}] };
  if (typeof rulesInit === 'function') rulesInit();
}
function pst(pl, team) {
  if (!pl || !MS) return null;
  return MS.p[pl.id] || (MS.p[pl.id] = { pid: pl.id, team, pos: pl.pos, name: pl.first[0] + '. ' + pl.last, num: pl.num,
    gp: 0, g: 0, a: 0, sog: 0, hit: 0, pas: 0, pm: 0, toi: 0, sa: 0, sv: 0, ga: 0, w: 0, so: 0,
    xg: 0, hd: 0, hds: 0, xga: 0, ds: 0, tk: 0, gv: 0, dv: 0, cv: 0, ch: 0, bws: 0, pen: 0, int: 0, hat: 0, sho: 0, fow: 0, fot: 0, tip: 0 });
}
function statPossess(p, passer) {
  if (!MS || S.so) return;
  if (MS.foPending) { MS.foPending = false; MS.team[p.team].fo++; }
  if (passer && passer.pl) { const s = pst(passer.pl, passer.team); s.pas++; MS.team[passer.team].pas++; if (typeof heatEv === 'function' && passer.team === p.team) heatEv(passer, 'pass'); }
  const c = MS.chain;
  if (c.team !== p.team) { c.team = p.team; c.pids = []; }
  if (!p.g && p.pl && c.pids[c.pids.length - 1] !== p.pl.id) c.pids.push(p.pl.id);
  if (!p.g && p.pl) MS.lastPid[p.team] = p.pl.id;
}
function statHit(p) { if (!MS || !p.pl) return; pst(p.pl, p.team).hit++; MS.team[p.team].hit++; if (typeof heatEv === 'function') heatEv(p, 'hit'); }
function statShotSaved(g) {
  if (!MS || S.so) return;
  if (typeof streakSave === 'function') streakSave(g);
  const sh = puck.shooterPl;
  if (sh) { pst(sh, 1 - g.team).sog++; if (typeof heatEv === 'function') heatEv(players.find(q => q.pl === sh), 'sog'); }
  MS.team[1 - g.team].sog++;
  if (g.pl) {
    const s = pst(g.pl, g.team); s.sa++; s.sv++;
    const fresh = S.t - (puck.shotT || -999) < 90;
    s.xga += (fresh ? (puck.xgOn || 0.08) : 0.08) * XGA_SCALE;
    if (fresh && (puck.xg || 0) >= XG_HD) { s.hds++; s.cv += 0.2 * (clutchMult(g.team) - 1); }
    const last = MS.shots && MS.shots[MS.shots.length - 1]; if (last && fresh && last.team !== g.team) last.on = 1;
  }
}
function statGoal(team, penaltyShot) {
  if (!MS || S.so) return;
  const lt = puck.lastTouch;
  let scorerId = lt && lt.team === team && !lt.g && lt.pl ? lt.pl.id : null;
  const c = MS.chain.team === team ? MS.chain.pids.slice() : [];
  if (!scorerId) scorerId = c[c.length - 1] || (puck.shooterPl && puck.shooter && puck.shooter.team === team ? puck.shooterPl.id : null) || MS.lastPid[team] ||
    (skaters.find(p => p.team === team && p.pl) || {}).pl?.id || null;
  const plById = id => { for (const p of players) if (p.pl && p.pl.id === id) return p.pl; const lu = S.match.lineups[team]; return lu.lines.flat().find(x => x && x.id === id); };
  const scorerPl = scorerId ? plById(scorerId) : null;
  MS.lastGoal = { team, scorer: scorerPl ? scorerId : null, assists: [], pen: !!penaltyShot };
  if (scorerPl) {
    const sp = pst(scorerPl, team); sp.g++; sp.sog++;
    if (typeof addedLive === 'function' && addedLive()) { sp.addg = (sp.addg || 0) + 1; MS.lastGoal.added = true; floaters.push({ x: CX, y: CY + 40, text: 'IN ADDED TIME!', life: 110, color: '#5ee07a' }); }
    if (goalies.some(g => g && g.kUp && g.pl === scorerPl)) { sp.kupg = (sp.kupg || 0) + 1; floaters.push({ x: CX, y: CY + 76, text: 'THE KEEPER SCORES!!!', life: 150, big: true, color: '#ffd23f' }); say(['THE KEEPER HAS SCORED! UNBELIEVABLE!', 'IT\'S THE GOALKEEPER! HE\'S HEADED IT IN!'], 4); excite(1); }
    if (S.adv && S.adv.team === team && !penaltyShot) { sp.advg = (sp.advg || 0) + 1; MS.lastGoal.adv = true; floaters.push({ x: CX, y: CY + 58, text: 'ADVANTAGE PAYS OFF!', life: 110, color: '#5ee07a' }); }
    if (puck.tipT != null && S.t - puck.tipT < 40 && puck.shooterPl && puck.shooterPl.id === scorerId) { sp.tip++; MS.lastGoal.tip = true; }
    if (!penaltyShot) {
      const assists = [];
      for (let i = c.length - 1; i >= 0 && assists.length < 2; i--) if (c[i] !== scorerId && !assists.includes(c[i])) assists.push(c[i]);
      for (const id of assists) { const pl = plById(id); if (pl) { pst(pl, team).a++; if (typeof heatEv === 'function') heatEv(players.find(q => q.pl === pl), 'assist'); } }
      MS.lastGoal.assists = assists;
    }
  }
  (MS.goals = MS.goals || []).push({ team, pid: MS.lastGoal.scorer, a: MS.lastGoal.assists.slice(), period: S.period, clock: Math.round(S.clock), pen: !!penaltyShot, ot: S.period >= 4, tie: MS.lastGoal.tie });
  MS.team[team].g++; MS.team[team].sog++;
  if (typeof streakGoal === 'function' && !penaltyShot) streakGoal(team, scorerPl);
  const fresh = S.t - (puck.shotT || -999) < 120;
  const g = goalies[1 - team]; if (g && g.pl) { const s = pst(g.pl, g.team); s.sa++; s.ga++; s.xga += (fresh ? (puck.xgOn || 0.3) : 0.3) * XGA_SCALE; }
  const diffAfter = S.score[team] + 1 - S.score[1 - team], cm = clutchMult(team, true, diffAfter);
  if (scorerPl && !penaltyShot) pst(scorerPl, team).cv += cm - 1;
  MS.lastGoal.ot = S.period >= 4; MS.lastGoal.tie = cm === 1.5; MS.lastGoal.mult = cm;
  const ls = MS.shots && MS.shots[MS.shots.length - 1]; if (ls && fresh && ls.team === team) { ls.goal = 1; ls.on = 1; }
  if (!penaltyShot) for (const p of skaters) if (p.pl) pst(p.pl, p.team).pm += p.team === team ? 1 : -1;
}
// time on ice + stamina, every live frame
function statTick(dtc) {
  if (!MS) return;
  const onIds = new Set(), lead = [leaderMul(0), leaderMul(1)];
  for (const p of players) {
    if (!p.pl) continue;
    onIds.add(p.pl.id);
    pst(p.pl, p.team).toi += dtc;
    if (p.g) continue;
    const v = hyp(p.vx, p.vy) / Math.max(0.5, baseSpeed(p));
    const drain = (0.5 + 0.9 * v + (p.charge >= 0 ? 0.3 : 0) + (p.sprint ? 1.7 : 0)) * (1.5 - A(p, 'sta') * 0.1) * lead[p.team] * (typeof traitMul === 'function' ? traitMul(p.pl, 'drainMul') : 1) * (1 - (p.recover || 0));
    MS.stam[p.pl.id] = clamp((MS.stam[p.pl.id] ?? 100) - drain * dtc * (typeof shortHanded === 'function' && shortHanded(p.team) ? PP_EDGE.pkDrain : 1), 0, 100);
  }
  for (const t of [0, 1]) for (const pl of (typeof dressedSkaters === 'function' ? dressedSkaters(t) : S.match.lineups[t].lines.flat())) {
    if (!pl || onIds.has(pl.id)) continue;
    MS.stam[pl.id] = clamp((MS.stam[pl.id] ?? 100) + 2.2 * (0.6 + (pl.attrs.sta || 5) * 0.08) * dtc, 0, stamCapOf(pl.id));
  }
}
// ---------- automatic line changes
function lineAvgStam(t) { const sk = teamSkaters(t); return sk.reduce((a, p) => a + stamOf(p), 0) / sk.length; }
function changeLine(t, why) {
  const L = MS.lines[t], lu = S.match.lineups[t];
  let next = (L.idx + 1) % 3;
  if (!lu.lines[next].some(Boolean)) next = (next + 1) % 3;
  if (next === L.idx) return;
  L.idx = next; L.t = 0;
  MS.gateT = MS.gateT || [-999, -999]; MS.gateT[t] = S.t;
  const avgSta = lu.lines[next].reduce((a, pl) => a + (pl ? pl.attrs.sta : 5), 0) / 3;
  L.target = rand(45, 60) * (0.85 + avgSta * 0.03);       // fitter lines stay out a bit longer
  const ln = typeof lineFor === 'function' ? lineFor(t, next) : lu.lines[next];
  MS.note = { t, text: TEAM[t].abbr + ' LINE ' + (next + 1), life: 150 };
  // ON THE FLY: each skater goes off through his bench's off-gate and his replacement comes on through the on-gate,
  // one at a time as each one gets there (the man with the puck, and the skater you control, go last)
  if (S.phase === 'live' && !S.so) {
    for (const p of teamSkaters(t)) { p.wobOut = wobFill(lu, next, ln, p.role); const np = ln[p.role]; if (np && np.id !== (p.pl && p.pl.id)) { p.chgOut = np; p.chgT = 0; p.chgGo = false; } }
    return;
  }
  for (const p of teamSkaters(t)) { p.wobOut = wobFill(lu, next, ln, p.role); swapSkater(p, ln[p.role], lu, p !== ctrl || !hasPuck(p)); }
  if (typeof fixExtra === 'function') { fixExtra(t); refreshEff(); }
}
// the man in this spot is covering for a WOBBLED teammate: remember whose spot it is
const wobFill = (lu, idx, ln, role) => { const own = (lu.lines[idx] || [])[role]; return own && ln[role] && ln[role].id !== own.id && dazedPid(own.id) ? own.id : null; };
function swapSkater(p, np, lu, resetCharge = true) {
  if (!np) return;
  lu = lu || S.match.lineups[p.team];
  dazeSwap(p, np);
  p.pl = np; p.num = np.num; p.cap = lu.leaders ? lu.leaders[np.id] || null : null; p.eff = null; if (resetCharge) p.charge = -1;
  p.fillFor = p.wobOut || null; p.wobOut = null;   // came on for a WOBBLED teammate: he steps back in once he's recovered
  p.chgOut = null; p.chgGo = false; p.chgRush = false;
}
// ---------- WOBBLED players and the line (Nov 21)
// a man left WOBBLED by a big hit heads for the bench at the first safe moment (never with the puck in our end); the
// same-position man from the next line down covers for him, and once he's recovered he steps back into his own line
// at the next stoppage or safe moment. A new period: everyone comes out rested, except the stamina a big hit took
// away, which only comes back after the game.
const dazedPid = id => { if (!MS || !MS.daze) return false; const d = MS.daze[id]; if (d && d.left - (S.t - d.at) > 0) return true; return skaters.some(q => q.pl && q.pl.id === id && q.daze > 0); };
function periodRest() {
  if (!MS) return;
  MS.daze = {};
  for (const p of skaters) { p.daze = 0; p.wobOut = null; p.fillFor = null; }
  for (const t of [0, 1]) for (const pl of (typeof dressedSkaters === 'function' ? dressedSkaters(t) : S.match.lineups[t].lines.flat())) if (pl) MS.stam[pl.id] = stamCapOf(pl.id);
}
function wobbleSub(t, p) {
  const lu = S.match.lineups[t], L = MS.lines[t], on = new Set(teamSkaters(t).map(q => q.pl && q.pl.id));
  for (const q of teamSkaters(t)) if (q.chgOut) on.add(q.chgOut.id);
  const ok = pl => pl && !on.has(pl.id) && !(typeof isOutPid === 'function' && isOutPid(pl.id)) && !dazedPid(pl.id);
  for (let k = 1; k <= 3; k++) { const pl = (lu.lines[(L.idx + k) % 3] || [])[p.role]; if (ok(pl)) return pl; }   // the next line down, same spot
  return typeof subFor === 'function' ? subFor(t, p.role, on) : null;
}
// even strength: anyone on the ice in another man's spot (a fill-in, a sub for a man who was out) goes back when the
// man whose spot it is can play again
function restoreLines(t) {
  if (!MS || S.so || !S.match.lineups || (typeof shortHanded === 'function' && (shortHanded(0) || shortHanded(1)))) return;
  const L = MS.lines[t], base = S.match.lineups[t].lines[L.idx] || [], on = new Set(teamSkaters(t).map(q => q.pl && q.pl.id));
  for (const p of teamSkaters(t)) {
    if (p.g || p.chgOut || !p.pl || !p.fillFor) continue;
    const own = base[p.role];
    if (!own || own.id !== p.fillFor) { p.fillFor = null; continue; }          // his line changed meanwhile: nothing to restore
    if (on.has(own.id) || dazedPid(own.id) || (typeof isOutPid === 'function' && isOutPid(own.id))) continue;
    p.chgOut = own; p.chgT = 0; p.chgGo = false;
  }
}
// finish every change still under way at once (a whistle: the faceoff puts everybody on his spot anyway)
function finishChanges(t) {
  let any = false;
  restoreLines(t);
  for (const p of teamSkaters(t)) p.hopIn = 0;
  // a man already on his way off doesn't vanish at the whistle: he finishes his skate to the bench (drawn only) while
  // his replacement takes his place for the faceoff
  const G = benchGates(t);
  for (const p of teamSkaters(t)) if (p.chgOut) {
    if (p.chgGo && p.pl && MS && S.phase !== 'intermission') {
      const D = p.exitDoor || G.off, tx = R.l - 11, ty = clamp(p.y, D.y0 + 3, D.y1 - 3), d = hyp(tx - p.x, ty - p.y);
      (MS.hops = MS.hops || []).push({ team: t, pl: p.pl, x: p.x, y: p.y, tx, ty, t: 0, dur: clamp(Math.round(d / 1.9), 18, 160), hand: p.pl.hand || 'L', walk: true });
    }
    p.exitDoor = null; swapSkater(p, p.chgOut); any = true;
  }
  if (any && typeof fixExtra === 'function') { fixExtra(t); refreshEff(); }
}
const gateMid = g => (g.y0 + g.y1) / 2;
// SAFE CHANGES. A skater due off only heads for the bench when leaving won't hurt the play:
//  - never while the other team has the puck outside its own end (they're coming at us), or with a loose puck in our end
//  - never the man nearest the puck for his team (he's in the play), never the carrier
//  - one at a time while they have it (deep in their own end), up to two while we have it
// If danger comes while he's on his way and he is still far from the bench, he turns back into the play and goes
// again at the next safe moment; close to the gate, he finishes the change.
function changeDanger(t) {
  const o = puck.owner;
  if (o && o.team !== t) return zoneFor(t, puck.y) !== 'att';          // they have it anywhere but deep in their own end
  if (!o) return zoneFor(t, puck.y) === 'def' || (puck.lastTouch && puck.lastTouch.team !== t && zoneFor(t, puck.y) !== 'att');
  return false;
}
function changeTick() {
  if (!MS || S.so) return;
  if (MS.hops && MS.hops.length) MS.hops = MS.hops.filter(hp => ++hp.t < hp.dur);
  for (const p of skaters) if (p.hopIn > 0) p.hopIn--;
  for (const t of [0, 1]) {
    if (S.phase === 'live') {
      for (const p of teamSkaters(t)) if (p.daze > 0 && !p.g && p.pl && !p.chgOut && !(p.stun > 0)) {   // WOBBLED: off he goes (see wobbleSub)
        const sub = wobbleSub(t, p); if (sub) { p.chgOut = sub; p.wobOut = p.pl.id; p.chgT = 0; p.chgGo = false; p.chgRush = true; }
      }
      if ((S.t & 15) === 0 && !teamSkaters(t).some(p => p.chgOut && !p.fillFor)) restoreLines(t);
    }
    const out = teamSkaters(t).filter(p => p.chgOut);
    if (!out.length) continue;
    const G = benchGates(t), gx = R.l + 4;
    // he leaves through whichever of his bench's two doors is nearer (the fresh man still steps on through the one
    // that opens into the midfield)
    const doorOf = p => Math.abs(p.y - gateMid(G.on)) < Math.abs(p.y - gateMid(G.off)) ? G.on : G.off;
    const gy = gateMid(G.off);
    const danger = changeDanger(t), ours = puck.owner && puck.owner.team === t;
    const mine = teamSkaters(t), nearest = mine.slice().sort((a, b) => dist(a, puck) - dist(b, puck))[0];
    const maxGo = ours ? 2 : 1;
    let going = out.filter(p => p.chgGo).length;
    for (const p of out.slice().sort((a, b) => hyp(a.x - gx, a.y - gy) - hyp(b.x - gx, b.y - gy))) {   // closest to the bench first
      p.chgT = (p.chgT || 0) + 1;
      const door = p.exitDoor && p.chgGo ? p.exitDoor : (p.exitDoor = doorOf(p));
      const dGate = hyp(p.x - gx, p.y - gateMid(door));
      const atGate = p.x < R.l + 18 && p.y > door.y0 - 8 && p.y < door.y1 + 8;
      const passIn = puck.passTarget === p && !puck.owner;          // a pass is on its way to him: the change waits
      if (passIn && p.chgGo) { p.chgGo = false; going--; p.chgRush = true; }
      if (atGate && !hasPuck(p) && p.chgGo && !passIn) {           // through the off-gate; the fresh man hops on at the on-gate
        // the tired man carries on over the boards to the bench (drawn only), the fresh one steps over onto the ice
        MS.hops = MS.hops || [];
        if (p.pl) MS.hops.push({ team: t, pl: p.pl, x: p.x, y: p.y, tx: R.l - 11, ty: clamp(p.y, door.y0 + 3, door.y1 - 3), t: 0, dur: 18, hand: p.pl.hand || 'L' });
        p.exitDoor = null;
        swapSkater(p, p.chgOut); p.chgGo = false; going--;
        p.hopIn = 14;
        p.x = R.l + 9; p.y = gateMid(G.on); p.vx = 0.6; p.vy = 0; p.mx = p.x; p.my = p.y; p.stun = 0; p.lunge = 0;
        MS.gateT = MS.gateT || [-999, -999]; MS.gateT[t] = S.t;
        if (typeof fixExtra === 'function') { fixExtra(t); refreshEff(); }
        continue;
      }
      // after playing a pass in the middle of his change he's no longer "the nearest man": he goes again at once
      const busy = hasPuck(p) || passIn || (p === nearest && !p.chgRush) || (p === ctrl && !S.autoAI) || p.stun > 0 || (p.wobOut && zoneFor(t, puck.y) === 'def');   // a wobbled man never leaves with the puck in our end
      if (p.chgGo) {                                     // on his way: turn back only if it's dangerous and he's still far off
        if (hasPuck(p) || (danger && dGate > RK(70))) { p.chgGo = false; going--; }
      } else if (!danger && !busy && (going < maxGo || p.chgRush)) { p.chgGo = true; going++; }
      if (p.chgT > 60 * 45) { p.chgOut = null; p.chgGo = false; }    // never found a safe moment: he stays on
    }
    // the skater you control: once the others have gone, control passes to a fresh teammate (when it's safe) and he goes too
    if (t === 0 && !S.autoAI && ctrl && ctrl.chgOut && !hasPuck(ctrl) && puck.passTarget !== ctrl && !danger && !playerSteering() && out.every(p => p === ctrl || !p.chgOut)) {
      const fresh = mine.filter(p => !p.chgOut && p !== ctrl).sort((a, b) => dist(a, puck) - dist(b, puck))[0];
      if (fresh) { ctrl = fresh; input.shiftPending = false; }
    }
  }
}
function lineTick(dtc) {
  if (!MS || S.so || S.phase !== 'live') return;
  changeTick();
  for (const t of [0, 1]) {
    const L = MS.lines[t]; L.t += dtc;
    if (t === 0 && MS.lineReq) {             // you called for a change: go as soon as it's safe (not mid-attack)
      const attacking = (isUp(0) ? puck.y < BLUE_TOP : puck.y > BLUE_BOT) && (!puck.owner || puck.owner.team === 0);
      const winding = ctrl && ctrl.charge >= 0;
      if (L.t > 6 && !attacking && !winding) { MS.lineReq = false; changeLine(0, 'manual'); continue; }
    }
    if (teamSkaters(t).some(p => p.chgOut)) continue;           // a change is already under way
    if (changeDanger(t) && lineAvgStam(t) > 12) continue;       // don't even call it while they're coming at us
    const tired = lineAvgStam(t) < 28;
    if (L.t < L.target && !(tired && L.t > 20)) continue;
    const inZone = puck.y < BLUE_TOP || puck.y > BLUE_BOT;     // don't change in the middle of a scoring chance
    const carrier = puck.owner;
    if (inZone && L.t < L.target + 15 && lineAvgStam(t) > 15) continue;
    if (carrier && teamSkaters(t).includes(carrier) && carrier.charge >= 0) continue;
    changeLine(t);
  }
}
// ====================================================================
//  PERFORMANCE MODEL: shot danger (expected goals), defensive events, clutch context
// ====================================================================
// logistic shot-danger model, fitted to this game's own shots (see calibration notes); same model for goals and saves
// Refit Nov 22 (shot types) by logistic regression (IRLS) on 18,161 shots from 400 AI-vs-AI games, with the release features
// (goalie unset, moving across, off a deke, snap/backhand/slap, screened). Calibration by quintile, predicted vs actual:
// .005/.004, .014/.015, .028/.023, .058/.051, .239/.251. No shots from behind the net in the sample: 'behind' kept from the old fit.
const XG_COEF = { b0: -2.722, dist: -1.677, close: -0.264, ang: -0.065, acc: -0.075, power: -0.269, oneT: 2.443, bw: 0.231, gOff: 2.796, press: -0.409, reb: 0.731, gDown: 1.012, behind: -0.462, unset: 1.041, lat: -0.351, dk: 0.61, snap: 0.902, back: -0.153, slap: 1.319, scr: -0.234 };
// the same features for shots that reach the net (goalie expected goals against)
const XGON_COEF = { b0: -2.693, dist: -1.675, close: -0.259, ang: -0.076, acc: -0.086, power: -0.226, oneT: 2.445, bw: 0.23, gOff: 2.811, press: -0.406, reb: 0.729, gDown: 1.023, behind: 0.135, unset: 1.036, lat: -0.333, dk: 0.612, snap: 0.904, back: -0.165, slap: 1.349, scr: -0.222 };
const XG_HD = 0.16, XG_MD = 0.037;
// goalies also concede on non-shot plays (stuffed rebounds, pucks carried in); across 300 AI games the shot model alone
// under-counted goals against by 18%, so expected goals against is scaled to make league-wide GSAx average zero
// refit on today's game (Nov 22), so recorded stats need no correction: over 40 check games goals / xG = 1.03.
// Goalies' expected goals against get +3% for goals that come from no shot (stuffed rebounds, pucks carried in).
const XG_CAL = 1.0;
const XGA_SCALE = 1.03;        // high danger = top ~12% of shots, medium = 60th-88th percentile
function shotFeatures(p, power) {
  const gy = oppGoalY(p.team), ox = puck.x, oy = puck.y, up = attackDir(p.team);
  const d = hyp(CX - ox, gy - oy), behind = (gy - oy) * up <= 2 ? 1 : 0;
  const ang = Math.abs(Math.atan2(ox - CX, Math.abs(gy - oy) + 0.01));
  const g = gk(1 - p.team);
  // goalie position: how far he is off the line from the puck to the middle of the net
  const lx = CX - ox, ly = gy - oy, ll = hyp(lx, ly) || 1;
  const gOff = Math.min(20, Math.abs(((g.x - ox) * ly - (g.y - oy) * lx) / ll));
  let np = 99; for (const o of teamSkaters(1 - p.team)) np = Math.min(np, dist(o, p));
  const bw = teamSkaters(1 - p.team).every(o => hyp(CX - o.x, gy - o.y) > d + 6) ? 1 : 0;
  const rl = p._rel;                                     // the release (shotRelease): goalie set, moving across, off a deke, the type
  return { dist: d / 100, close: Math.max(0, 1 - d / 60), ang, acc: A(p, 'acc') - 5, power: clamp(power, 0, 1), oneT: p.oneT ? 1 : 0, bw, gOff: gOff / 10, press: np < 15 ? 1 : 0,
    reb: S.t - (p.rebT || -99) < 60 ? 1 : 0, gDown: g.down > 0 || g.gLunge > 0 ? 1 : 0, behind,
    unset: rl ? 1 - rl.set : 0, lat: rl ? rl.lat : 0, dk: rl && rl.dk ? 1 : 0, snap: rl && rl.kind === 'snap' ? 1 : 0, back: rl && rl.kind === 'back' ? 1 : 0, slap: rl && rl.kind === 'slap' ? 1 : 0, scr: p._scr ? 1 : 0 };
}
function logit(C, f) { let z = C.b0; for (const k in f) z += (C[k] || 0) * f[k]; return 1 / (1 + Math.exp(-z)); }
function shotDanger(p, power) { const f = shotFeatures(p, power); return { f, xg: logit(XG_COEF, f), xgOn: logit(XGON_COEF, f) }; }
// how much the moment matters (capped at 1.8x): close & late 1.2, late equaliser 1.5, overtime 1.7
function clutchMult(team, isGoal, diffAfter) {
  if (S.so) return 1;
  if (S.period >= 4) return 1.7;
  const late = S.period >= 3 && S.clock < S.periodLen * 0.3;
  const diff = diffAfter != null ? diffAfter : S.score[team] - S.score[1 - team];
  if (isGoal && late && diff === 0) return 1.5;
  if (late && Math.abs(diff) <= 1) return 1.2;
  return 1;
}
// one defensive event = one credit (classified: takeaway / interception / block / breakaway stop; a Defensive Stop if it killed a real chance)
function defEvent(p, kind, victim) {
  if (!MS || !p || !p.pl || S.so || S.phase === 'penalty') return;
  const ogy = ownGoalY(p.team), ref = victim || puck;
  const dNet = hyp(ref.x - CX, ref.y - ogy);
  const mates = teamSkaters(p.team).filter(m => m !== p);
  // a breakaway: the carrier was skating at the net with no other defender between him and the goal
  const vSpd = victim ? ((CX - victim.x) * (victim.vx || 0) + (ogy - victim.y) * (victim.vy || 0)) / (dNet || 1) : 0;
  const bw = (kind === 'poke' || kind === 'hit') && victim && !victim.g && dNet < 200 && vSpd > 0.9 && mates.every(m => hyp(m.x - CX, m.y - ogy) > dNet + 10);
  const base = { poke: 0.25, hit: 0.2, intercept: 0.25, block: 0.3 }[kind] || 0.2;
  const slot = dNet < 95;
  const ctxM = Math.min(2.5, bw ? 2.5 : slot ? 1.8 : 1);
  const value = base * ctxM, m = clutchMult(p.team);
  const s = pst(p.pl, p.team);
  if (kind === 'intercept') s.int++; else if (kind === 'block') s.blk = (s.blk || 0) + 1; else s.tk++;
  if (typeof heatEv === 'function') heatEv(p, 'def');
  if (MS.team && MS.team[p.team]) { const T = MS.team[p.team]; if (kind === 'block') T.blk = (T.blk || 0) + 1; else if (kind === 'intercept') T.int = (T.int || 0) + 1; else T.tk = (T.tk || 0) + 1; }
  if (bw) s.bws++;
  const stop = value >= 0.42;                 // killed a real chance: slot poke/interception/block, or any breakaway stop
  if (stop) s.ds++;
  s.dv += value; s.cv += value * (m - 1);
  if (stop && (bw || dNet < 95)) { floaters.push({ x: p.x, y: p.y - 34, text: bw ? 'BREAKAWAY STOPPED!' : 'DEFENSIVE STOP', life: 40, color: '#9fd0ff' }); }
}
// a poke or hit knocked the puck loose: credit only if the defender's team actually comes up with it
function pendingDef(p, kind, victim) { if (MS) MS.pendDef = { p, kind, t: S.t, victim: { x: victim.x, y: victim.y, g: victim.g, team: victim.team }, vref: victim }; }
function resolvePending(team) {
  const pd = MS && MS.pendDef; if (!pd) return;
  MS.pendDef = null;
  if (S.t - pd.t < 120 && pd.p.team === team) defEvent(pd.p, pd.kind, Object.assign({}, pd.vref, pd.victim));
}
// captain on the ice: -4% fatigue and steadier passing for his line; each alternate -2% (never more than -8%)
function leaderMul(t) { let m = 1; for (const q of teamSkaters(t)) m -= q.cap === 'C' ? 0.04 : q.cap === 'A' ? 0.02 : 0; return Math.max(0.92, m); }
// nobody plays the puck into his own net on purpose: a pass, clear or shot whose line would cross his own goal mouth
// is turned to go wide of the post instead
let PASS_BACK = false;                         // a deliberate pass back to your own goalie (not steered off the net)
function steerOffOwnNet(p, vx, vy) {
  const sp = hyp(vx, vy); if (!p || sp < 0.3 || PASS_BACK) return [vx, vy];
  const gy = ownGoalY(p.team), back = gy === GL_TOP ? -1 : 1;              // +back = toward / behind that goal line
  const dy = gy - puck.y;
  if (vy * back <= 0 || (puck.y - gy) * back > 2 || Math.abs(dy) > 170) return [vx, vy];   // not heading at it, already behind it, or far away
  const xAt = puck.x + vx / vy * dy;
  if (Math.abs(xAt - CX) > GOAL_HW + 3) return [vx, vy];
  // aim outside the nearer post (or straight back up the ice if he is right in front of it)
  const side = Math.sign(puck.x - CX) || (Math.random() < 0.5 ? -1 : 1);
  let tx = CX + side * (GOAL_HW + 14), ty = gy;
  if (Math.abs(dy) < 16 && Math.abs(puck.x - CX) < GOAL_HW + 4) { tx = puck.x + side * 20; ty = puck.y - back * 14; }
  const a = Math.atan2(ty - puck.y, tx - puck.x);
  return [Math.cos(a) * sp, Math.sin(a) * sp];
}
function releasePuck(p, vx, vy, blockFrames) {
  [vx, vy] = steerOffOwnNet(p, vx, vy);
  puck.cutTried = null; puck.deliberate = null;          // set again by a shot / pass / clear right after this
  puck.owner = null; puck.vx = vx; puck.vy = vy; puck.oneTimer = false; puck.shot = null; puck.air = false; puck.passFrom = null; puck.h = 0; puck.vh = 0;
  puck.lastTouch = p; p.block = blockFrames; puck.passed.clear(); puck.iceTeam = null;
}
const ownHalf = p => isUp(p.team) ? p.y > CY + 2 : p.y < CY - 2;

// seven targets: top corners, the two sides halfway up, bottom corners, five-hole
const ZONES = { high: 0.78, mid: 0.48, low: 0.2, five: 0.08 };            // height as a fraction of the crossbar
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;
function zonePoint(zone, side, g, human) { return { x: zone === 'five' ? g.x : CX + side * (GOAL_HW - (human ? SKILLSHOT.cornerIn : 4.5) * RINK_S), h: ZONES[zone] }; }   // you pick your corners tighter than the computer does
function pickZone(p) {
  const g = gk(1 - p.team);
  let ix = (KR() ? 1 : 0) - (KL() ? 1 : 0), iy = ((KD() ? 1 : 0) - (KU() ? 1 : 0)) * -attackDir(p.team);   // toward the net = high, away = five-hole
  const off = g.x - CX, open = off > 1.5 ? -1 : off < -1.5 ? 1 : (puck.x < CX ? 1 : -1);
  const ch = p.charge >= 0;
  // remember the last target picked during the wind-up (players let go of the arrows and SPACE together)
  if (ch) { if (ix || iy) p.zoneKeys = { ix, iy }; else if (p.zoneKeys) { ix = p.zoneKeys.ix; iy = p.zoneKeys.iy; } }
  if (ch && !ix && iy > 0) return { zone: 'five', side: 0 };
  const side = ch && ix ? ix : open;
  // diagonals = the corners (toward the net: top, away: bottom); straight left / right = halfway up that side
  const zone = ch && iy ? (iy < 0 ? 'high' : 'low') : ch && ix ? 'mid' : (g.down > 0 ? 'high' : 'low');
  return { zone, side };
}
// where the human's shot will go when roughly facing the net
function humanAim(p, wide = false, fromBody = false) {
  const g = gk(1 - p.team), gy = oppGoalY(p.team);
  const fa = Math.atan2(p.fy, p.fx);
  const ox = fromBody ? p.x : puck.x, oy = fromBody ? p.y : puck.y;
  const ta = Math.atan2(gy - oy, CX - ox);
  const inRange = (oy - gy) * attackDir(p.team) < -6 && hyp(CX - ox, gy - oy) < 240;
  const facingOk = p.charge >= 0 || wide || Math.abs(angDiff(ta, fa)) < 1.6;
  if (inRange && facingOk) {
    const z = pickZone(p), pt = zonePoint(z.zone, z.side, g, true);
    return { x: pt.x, y: gy - 1 - pt.h * 10, gx: pt.x, h: pt.h, zone: z.zone, side: z.side, on: true };
  }
  return { x: ox + p.fx * 90, y: oy + p.fy * 90, on: false };
}
const SKILLSHOT = { humanSpray: 0.3, cornerIn: 3.2 };   // cornerIn: how far inside the post your corner shots aim (the computer aims 4.5 in)
function shotRelease(p, g, ang, kind, scr) {
  if (!g || p.g) return null;
  const set = clamp((g.setT || 0) / Math.max(6, SHOTX.setFrames - (A(g, 'pos') - 5) * 1.5), 0, 1);
  const bs = Math.max(0.5, baseSpeed(p)), ux = Math.cos(ang), uy = Math.sin(ang);
  const lat = clamp(Math.abs(p.vx * -uy + p.vy * ux) / bs, 0, 1), along = (p.vx * ux + p.vy * uy) / bs;
  const recent = S.t - (p.lastDkT || -999) < SHOTX.dekeWin;
  const dk = recent && kind !== 'slap' ? (p.lastDkKind === 'spin' && kind === 'back' ? 1.2 : 1) : 0;
  const why = [];
  if (kind === 'oneT') { /* the one-timer callout is its own */ }
  else if (dk) why.push(p.lastDkKind === 'drag' ? 'OFF THE DRAG-BACK' : p.lastDkKind === 'spin' ? 'OFF THE SPIN' : 'OFF THE DANGLE');
  if (set < SHOTX.info.set && kind !== 'slap') why.push('KEEPER NOT SET');
  if (lat > SHOTX.info.lat || (along > 0.6 && kind !== 'slap')) why.push(lat > SHOTX.info.lat ? 'ACROSS THE BOX' : 'IN STRIDE');
  if (scr && kind === 'slap') why.push('THROUGH TRAFFIC');
  return { set, lat, dk, kind, why: why.slice(0, 2), d0: hyp(CX - p.x, oppGoalY(p.team) - p.y) };
}
// how much the release costs the goalie (goalie-reach units, positive = harder to stop)
function releaseEdge(g, rel, d0, screened) {
  if (!rel) return 0;
  let e = (rel.kind === 'oneT' ? 0 : (1 - rel.set) * SHOTX.unset * clamp(1 - (A(g, 'ref') - 5) * SHOTX.refK, 0.6, 1.4)) + rel.lat * SHOTX.lat + rel.dk * SHOTX.deke;   // (a one-timer's slide is its own term: otLat)
  if (rel.kind === 'snap') e += SHOTX.snap;
  else if (rel.kind === 'back') e += d0 < RK(60) ? SHOTX.backTight : SHOTX.backFar;
  else if (rel.kind === 'slap') e += screened ? SHOTX.slapScreen : SHOTX.slap;
  else if (rel.kind === 'wrist' && d0 > RK(110)) e += SHOTX.wristFar;
  return e - SHOTX.norm;
}
function shoot(p, power) {
  if (typeof REC !== 'undefined' && REC.on) REC.lastShot = REC.total;
  if (!hasPuck(p)) { p.charge = -1; return; }
  power = clamp(power, 0, 1);
  const speed = (4.0 + power * (5.4 + A(p, 'pow') * 0.24)) * (stamOf(p) < 30 ? 0.92 : 1);
  let accM = 1.45 - A(p, 'acc') * 0.09;                    // 5 = normal spray, 10 = laser, 1 = wild
  if (p.otMode) { accM *= p.otMode === 'react' ? PLAY.otReactAcc : p.otMode === 'early' ? 1 : PLAY.otAntiAcc; if (offWing(p)) accM *= PLAY.otOffWingAcc; }
  if (p.wrist) accM *= 0.92;
  // SCREENED: an opponent standing in the shooting lane takes away part of the net (closer to the line = more)
  const scr = typeof screenOf === 'function' && !S.so && S.phase !== 'penalty' ? screenOf(p) : null;
  if (scr) accM *= 1 + 0.18 * (1 - scr.off / scr.R);
  if (typeof lever === 'function' && TAC.regainT && S.t - TAC.regainT[p.team] < 180 && lever(1 - p.team, 'killStretch', 0) <= 0) accM *= lever(p.team, 'transAcc') * (TAC.deep && S.t - TAC.deep[p.team] < 200 ? lever(p.team, 'deepAcc') : 1);   // Counterattack: the defence isn't set yet (worse yet if it was caught deep)
  const nOpp = teamSkaters(1 - p.team).reduce((m, o) => Math.min(m, dist(o, p)), 1e9);
  if (p.otMode && nOpp < 12) accM *= 1.15;                  // rushed under pressure
  const gy = oppGoalY(p.team), g = gk(1 - p.team);
  let zone = null, tx = 0, th = 0.15, ang;
  if (!cpuT(p.team)) {
    const a = humanAim(p, p.oneT);
    if (a.on) { zone = a.zone; tx = a.gx; th = a.h; }
    else ang = Math.atan2(a.y - puck.y, a.x - puck.x);
  } else {
    const r = Math.random(), lowTraffic = power >= 0.6 && teamSkaters(p.team).some(m => m !== p && hyp(m.x - CX, m.y - gy) < RK(40));
    zone = lowTraffic && Math.random() < 0.7 ? 'low' : r < 0.3 ? 'high' : r < 0.47 ? 'mid' : r < 0.84 ? 'low' : 'five';   // through traffic: low, for the tip
    if (zone === 'five' && g.down > 0) zone = 'high';
    const off = g.x - CX, open = off > 1.5 ? -1 : off < -1.5 ? 1 : (p.x < CX ? 1 : -1);
    const pt = zonePoint(zone, Math.random() < 0.7 ? open : -open, g); tx = pt.x; th = pt.h;
  }
  let shotInfo = null;
  if (zone) {
    // accuracy: harder shots spray more; corners can ring the post, high shots can hit the bar or sail over
    const cpu = cpuT(p.team) ? DIFF[S.diff].aim : 0;
    const sprayK = cpuT(p.team) ? 1 : SKILLSHOT.humanSpray;           // yours: it goes (nearly) where you aim it
    let ax = tx + gauss() * (0.8 + power * 2.2 + cpu * 20) * accM * RINK_S * 1.06 * sprayK;
    const ah = Math.max(0.03, th + gauss() * (0.05 + power * 0.1 + cpu * 0.6) * (zone === 'high' ? 1 : zone === 'mid' ? 0.8 : 0.6) * accM * sprayK);
    const off = Math.abs(ax - CX);
    let cat = 'net';
    if (ah > 1.14) cat = 'over';
    else if (ah > 0.98 && off <= GOAL_HW + 1) cat = 'bar';
    else if (off > GOAL_HW + 1.4 * RINK_S) cat = 'wide';
    else if (off > GOAL_HW - 1 * RINK_S) { cat = 'post'; ax = CX + Math.sign(ax - CX) * (GOAL_HW + 0.3); }
    ang = Math.atan2(gy - puck.y, ax - puck.x);
    gkNoteShot(p, ax);
    // one on one: a shootout or penalty shot, or nobody but the goalie between him and the net
    const lone = !!(S.so || S.phase === 'penalty' || teamSkaters(1 - p.team).every(o => o.stun > 0 || (o.y - gy) * attackDir(p.team) < (p.y - gy) * attackDir(p.team) - 30));   // a real breakaway: everyone else well behind him
    shotInfo = { zone, h: Math.min(ah, 1.3), cat, gy, d0: Math.max(20, Math.abs(gy - puck.y)), done: false, lone };
  }
  let spd2 = speed;
  // the kind of shot: a quick tap is a WRIST SHOT, a short wind-up a SNAP SHOT, a full wind-up a SLAPSHOT (hardest,
  // least accurate). Only a quick release while skating across his body, toward his non-stick side, is a BACKHAND:
  // anyone who winds up turns his shoulders to the target first.
  const back = p.shotBack != null ? p.shotBack : isBackhand(p, ang);      // carried on the backhand: it comes off the backhand
  const kind = p.otMode ? 'oneT' : p.wrist ? (back ? 'back' : 'wrist') : cpuT(p.team) && power < 0.3 ? (back ? 'back' : 'wrist') : power >= 0.7 ? 'slap' : 'snap';   // the computer's quick shots come off the backhand too
  if (kind === 'back') { accM *= backhandMul(p); spd2 *= PLAY.backhandPow + (A(p, 'pow') - 5) * 0.01; if (zone) { const sgn = Math.sign(Math.cos(ang)) || 1; ang += gauss() * 0.02 * accM * sgn; } }
  else if (kind === 'slap') { spd2 *= 1.06; if (zone) ang += gauss() * 0.012 * accM; }
  if (kind !== 'oneT') floaters.push({ x: p.x, y: p.y - 34, text: { back: 'WEAK FOOT', wrist: 'PLACED SHOT', snap: 'SNAP SHOT', slap: 'POWER SHOT!' }[kind], life: 30, color: kind === 'slap' ? '#ffd23f' : '#dbe9ff' });
  S.lastShotKind = kind;
  // RELEASE CONTEXT (what the goalie is up against): is he set, is the shooter moving across him, is it off a deke
  const rel = shotRelease(p, g, ang, kind, scr); p._rel = rel; p._scr = !!scr;
  const fromOwnHalf = ownHalf(p);
  const dg = shotDanger(p, power);                                  // shot-time snapshot: never revised by the outcome
  if (MS && p.pl && !S.so) {
    const s = pst(p.pl, p.team); s.xg += dg.xg * XG_CAL; if (dg.xg >= XG_HD) s.hd++;
    const lp = MS.lastPass;                                         // the pass that set it up = a chance created
    if (lp && lp.to === p.pl.id && lp.team === p.team && S.t - lp.t < 150 && !lp.used) { lp.used = true; const ps = MS.p[lp.from]; if (ps) ps.ch++; }
    (MS.shots = MS.shots || []).push({ f: dg.f, xg: dg.xg * XG_CAL, team: p.team, pid: p.pl.id, t: S.t, x: Math.round(p.x), y: Math.round(p.y), gy, on: zone && shotInfo && shotInfo.cat === 'net' ? 1 : 0, goal: 0 });
  }
  releasePuck(p, Math.cos(ang) * spd2, Math.sin(ang) * spd2, 18); puck.deliberate = p;
  puck.tipTried = null; puck.tipT = null;
  puck.blockTried = null;
  puck.bkAI = !!(p.plan && p.plan.bk > 0 && (p !== ctrl || S.autoAI));   // a computer skater's breakaway shot (see BK_REACH)
  puck.shot = shotInfo; puck.setup = setupScore(p); puck.shooter = p; puck.shooterPl = p.pl; puck.xg = dg.xg; puck.xgOn = dg.xgOn; puck.shotT = S.t;
  puck.laneBlock = null; puck.rel = rel; puck.otLat = 0; puck.laneScr = !!scr;
  if (rel && rel.why.length && !S.so && Math.hypot(gy - p.y, CX - p.x) < 200) floaters.push({ x: p.x, y: p.y - 22, text: rel.why.join(' · '), life: 34, color: '#ffe9a8' });
  if (S.pres && S.pres.shotInfo && rel) floaters.push({ x: p.x, y: p.y - 10, text: `KEEPER SET ${Math.round(rel.set * 100)}% · MOVING ${Math.round(rel.lat * 100)}%${rel.dk ? ' · FEINT' : ''}${scr ? ' · SCREEN' : ''}`, life: 60, color: '#9fd0ff' });
  // ...and the screening skater may get a stick or a shin pad on it (the Defensive Shell does this far more often)
  if (scr && Math.random() < PLAY.screenBlock * (kind === 'slap' ? 1.5 : 1) * lever(1 - p.team, 'blockP') * (TAC.poss[p.team] && !TAC.poss[p.team].settled ? lever(1 - p.team, 'vsRushBlock') : 1)) { puck.laneBlock = scr.o.id; puck.laneR = scr.off + 6; }   // (the Shell is set for a rushed shot)
  S.lastShot = { zone, t: S.t, team: p.team, oneT: !!p.oneT, reb: S.t - (p.rebT || -99) < 60, pen: S.phase === 'penalty', kind, dk: !!(rel && rel.dk), unset: !!(rel && rel.set < 0.4), scr: !!scr };
  if (Math.hypot(gy - p.y, CX - p.x) < 170) excite(0.3 + power * 0.25);
  puck.shotTeam = p.team; puck.passTarget = null; puck.iceTeam = fromOwnHalf ? p.team : null;
  p.charge = -1;
  sfx.shot(power);
  for (let i = 0; i < 5 + power * 8; i++) particles.push({ x: puck.x, y: puck.y, vx: rand(-1, 1) - Math.cos(ang), vy: rand(-1, 1) - Math.sin(ang), life: rand(10, 22), color: '#ffffff' });
}
// ONSIDE helpers: how far past the blue line he attacks (negative = still outside the zone)
const zoneDepth = (t, y) => (y - (isUp(t) ? BLUE_TOP : BLUE_BOT)) * attackDir(t);
const offsideMates = (t, carrier) => teamSkaters(t).filter(m => m !== carrier && !m.chgGo && zoneDepth(t, m.y) > 0);   // a man skating off for a change doesn't count (he's out of the play)
function bestPassTarget(p, dx, dy, aimed) {
  const mates = teamSkaters(p.team).filter(m => m !== p && m.stun <= 0);
  const opps = teamSkaters(1 - p.team);
  const up = attackDir(p.team);
  // your own goalie is an option too, from your own end: in his crease, not down, play live (not a shootout / penalty shot)
  const g0 = !p.g && goalies[p.team];
  const gOk = g0 && g0.on && !g0.covering && g0.stun <= 0 && !(g0.down > 0) && S.phase === 'live' && !S.so && hyp(g0.x - CX, g0.y - ownGoalY(p.team)) < 26 * RINK_S
    && (p.y - ownGoalY(p.team)) * up < ((p !== ctrl || S.autoAI) ? 115 : 210) * RINK_S && hyp(p.x - g0.x, p.y - g0.y) > 24;   // the AI resets to its goalie only from deep in its own end, never from out by the blue line
  if (gOk) mates.push(g0);
  let best = null, bs = -1e9;
  for (const m of mates) {
    const mx = m.x - p.x, my = m.y - p.y, d = hyp(mx, my) || 1;
    const dot = (mx * dx + my * dy) / d;
    let s = (dot > 0 ? dot * dot : -1) * (aimed ? 150 : 70) - d * (aimed ? 0.07 : 0.10) + (my * up) * (aimed ? 0.03 : 0.12);   // while you aim, the direction decides; otherwise the forward option is favoured
    for (const o of opps) {
      const t = clamp(((o.x - p.x) * mx + (o.y - p.y) * my) / (d * d), 0, 1);
      const ld = hyp(o.x - (p.x + mx * t), o.y - (p.y + my * t));
      if (ld < 11) s -= (11 - ld) * 3.5;
    }
    if (m.g) s -= aimed ? 10 : 55;                                     // the back pass: chosen when you aim at him, the AI only as a last resort
    // the AI never passes the puck into the zone while it isn't in yet: that's offside (you can, if you choose)
    if (S.rules && (p !== ctrl || S.autoAI) && !m.g && zoneDepth(p.team, puck.y) < 0 && zoneDepth(p.team, m.y) > -2) s -= 400;
    // the AI in the offensive zone doesn't throw it back out over the blue line to a man in the midfield
    if ((p !== ctrl || S.autoAI) && !m.g && !p.g && zoneDepth(p.team, p.y) > 0 && zoneDepth(p.team, m.y) < 0) { s -= 300; m.outZ = true; } else m.outZ = false;
    if (s > bs) { bs = s; best = m; }
  }
  // ...and if that's the only option, he keeps it and plays it himself (unless he's swarmed)
  if (best && best.outZ && (p !== ctrl || S.autoAI) && nearestOpp(p)[1] > RK(12)) return null;
  return best;
}
// SHOOT, DON'T PASS IT BACK (Nov 21): a computer carrier with an open look (in the slot or the high slot, in front of
// the net, a clear lane and nobody on him) doesn't pass it to a teammate who is no better placed. The exceptions: the
// pass goes to a man clearly closer and open (a 2-on-1, a back-door tap-in), a shootout / penalty shot, or a delayed
// penalty with the goalie pulled... in which case he passes as before. Instead of the pass he winds up and shoots.
function aiTakesTheShot(p, m) {
  if (p.g || m.g || (p === ctrl && !S.autoAI) || S.phase !== 'live' || S.so) return false;
  const t = p.team, up = attackDir(t), gy = oppGoalY(t), dg = hyp(CX - p.x, gy - p.y);
  if ((p.y - gy) * up >= -14 || dg > RK(105) || zoneDepth(t, p.y) < 34 * RINK_S || !laneOpen(p, gy)) return false;
  const opps = teamSkaters(1 - t).filter(o => o.stun <= 0);
  if (opps.some(o => dist(o, p) < RK(24))) return false;                                             // he's being challenged: moving it is fine
  const md = hyp(CX - m.x, gy - m.y), mOpen = opps.every(o => dist(o, m) > RK(26)), mFront = (m.y - gy) * up < -14;
  if (mOpen && mFront && md < dg - RK(18) && laneOpen(m, gy)) return false;                         // a teammate with a clearly better look
  if (p.charge < 0) { p.charge = 0; p.chargeTarget = dg < RK(55) ? rand(0.1, 0.35) : rand(0.3, 0.6); }
  return true;
}
function pass(p, power = 0, aim = null) {
  if (!hasPuck(p)) return;
  let dx = p.fx, dy = p.fy;
  if (aim) { dx = aim.x; dy = aim.y; }                                  // aimed while skating another way
  else if (p === ctrl && !S.autoAI && (p.inx || p.iny)) { const m = hyp(p.inx, p.iny); dx = p.inx / m; dy = p.iny / m; }
  if (p.g) { dx = 0; dy = attackDir(p.team); }
  const m = bestPassTarget(p, dx, dy, !!aim);
  if (!m) return false;
  if (aiTakesTheShot(p, m)) return false;                              // an open look: he shoots instead of passing it back
  const d0 = dist(p, m);
  const speed = clamp(4.2 + d0 * 0.018, 4.6, 7.2) * (0.9 + A(p, 'pas') * 0.02) * (1 + power * PLAY.passBoost) * (m.g ? 0.72 : 1);   // a softer pass back to the goalie
  const lead = (d0 / speed) * 0.85;
  const tx = m.x + m.vx * lead + m.fx * 4, ty = m.y + m.vy * lead + m.fy * 4;
  let ang = Math.atan2(ty - puck.y, tx - puck.x) + rand(-1, 1) * (0.15 - A(p, 'pas') * 0.013) * leaderMul(p.team);   // sloppier passes from weak passers
  // a backhand pass (across his body to the non-stick side) is less accurate and a little softer; good hands make up most of it
  let pSpd = speed;
  if (!p.g && isBackhand(p, ang)) { ang += gauss() * 0.07 * (backhandMul(p) - 0.9) * 2; pSpd *= 0.92 + (A(p, 'pas') - 5) * 0.008; if (p === ctrl) floaters.push({ x: p.x, y: p.y - 30, text: 'WEAK FOOT PASS', life: 26, color: '#dbe9ff' }); }
  const fromOwnHalf = ownHalf(p);
  if (m.g) { ang = Math.atan2(m.y - puck.y, m.x - puck.x) + rand(-1, 1) * 0.03; PASS_BACK = true; }   // right onto his stick, firmly short of the net
  try { releasePuck(p, Math.cos(ang) * pSpd, Math.sin(ang) * pSpd, 20); } finally { PASS_BACK = false; }
  puck.deliberate = p;
  puck.passFrom = p; puck.passT = S.t; puck.passPow = power; puck.recvTried = false; puck.passD = d0;
  { let ld = 0; for (const o of teamSkaters(1 - p.team)) { const mx = m.x - p.x, my = m.y - p.y, t = clamp(((o.x - p.x) * mx + (o.y - p.y) * my) / (d0 * d0 || 1), 0, 1); if (hyp(o.x - (p.x + mx * t), o.y - (p.y + my * t)) < 12) ld = Math.max(ld, A(o, 'def')); } puck.laneDef = ld; }
  puck.passTarget = m; puck.shotTeam = null; puck.iceTeam = fromOwnHalf ? p.team : null;
  if (MS && p.pl && m.pl) MS.lastPass = { from: p.pl.id, to: m.pl.id, team: p.team, t: S.t };
  // a pass that will reach the goal mouth before it reaches anyone is a shot as far as the goalie is concerned: he plays
  // it like one (and it counts as a shot on goal if he stops it)
  if (!m.g) {
    const gy = oppGoalY(p.team), vy = puck.vy;
    if (vy * (gy - puck.y) > 0) {
      const t = (gy - puck.y) / vy, xAt = puck.x + puck.vx * t, dGoal = hyp(xAt - puck.x, gy - puck.y);
      if (Math.abs(xAt - CX) < GOAL_HW - 0.5 && dGoal < hyp(m.x - puck.x, m.y - puck.y) + 6 && dGoal < 260) {
        puck.shot = { zone: 'low', h: 0.2, cat: 'net', gy, d0: Math.max(20, Math.abs(gy - puck.y)), done: false, lone: false };
        puck.shotTeam = p.team; puck.shooter = p; puck.shooterPl = p.pl; puck.shotT = S.t; puck.setup = 0; puck.xg = 0.02; puck.passTarget = null;
        puck.tipTried = null; puck.tipT = null; puck.blockTried = null; puck.laneBlock = null;
      }
    }
  }
  p.charge = -1; p.passCd = 40;
  sfx.pass();
}
function nearestOpp(p) {
  let tgt = null, td = 1e9;
  for (const o of teamSkaters(1 - p.team)) { if (o.stun > 0) continue; const d = dist(p, o); if (d < td) { td = d; tgt = o; } }
  return [tgt, td];
}
// BODY CHECKS: who can be hit, and how the hitter stays on him through the lunge
// HIT: behindCos - a hit only counts as 'from behind' within 40 degrees of straight into his back (cos 40 = 0.77; was 57).
//  tele: a check started from far away is seen coming (easier to sidestep or ride out); one from close range is not.
//  tough: big hits come from closing speed, but tough players (Checking, plus the Tough / Enforcer traits) need less of it
const HIT = { refInterf: 0.9, behindCos: 0.77, teleNear: 14, teleFar: 40, dodgeFar: 0.4, rideNear: 1.0, rideFar: 1.9, toughThr: 0.03, toughKb: 0.05 };
function hitToughness(p) { return A(p, 'chk') + (p.pl && typeof hasTrait === 'function' ? (hasTrait(p.pl, 'tough') ? 1.2 : 0) + (hasTrait(p.pl, 'enforcer') ? 1.5 : 0) : 0); }
// 0 = point blank, 1 = charged in from a long way off
// INTERFERENCE: a man is 'in the play' (fair to hit) if he has the puck, had it in the last second, is the target
// of a pass on its way to him, or is the closest skater to a loose puck that's coming his way or sitting near him
function hitLegal(t) {
  if (hasPuck(t) || S.t - (t.hadPuckT ?? -999) < 60) return true;
  if (puck.owner) return false;
  if (puck.passTarget === t) return true;
  const d = hyp(puck.x - t.x, puck.y - t.y); if (d > 70) return false;
  const nearest = players.filter(o => !o.g && o.stun <= 0 && o !== t).every(o => hyp(puck.x - o.x, puck.y - o.y) >= d);
  const sp = hyp(puck.vx, puck.vy), toward = sp < 0.6 || ((t.x - puck.x) * puck.vx + (t.y - puck.y) * puck.vy) / (d || 1) / sp > 0.3;
  return nearest && toward;
}
function hitTele(p) { return clamp(((p.lungeD0 ?? 40) - HIT.teleNear) / (HIT.teleFar - HIT.teleNear), 0, 1); }
const BEATEN = { frames: 100, behind: 4 };
const CHECK = { lungeD: 40, maxD: 110, maxT: 15, burst: 2.2, lead: 0.8, leadMax: 12, maxLunge: 19, home: 0.35 };
function bodyCheck(p) {
  if (p.cd > 0 || p.stun > 0 || hasPuck(p)) return;
  // TIE UP: the check button on a man parked in front of your net (not the carrier) ties up his stick instead of a hit
  if (p === ctrl && !S.autoAI && puck.owner && puck.owner.team !== p.team) {
    const ogy = ownGoalY(p.team), nf = teamSkaters(1 - p.team).find(o => o !== puck.owner && o.stun <= 0 && dist(o, p) < 14 && hyp(o.x - CX, o.y - ogy) < RK(50));
    if (nf) { nf.tiedT = S.t + 80; p.cd = 28; p.fx = (nf.x - p.x) / (dist(nf, p) || 1); p.fy = (nf.y - p.y) / (dist(nf, p) || 1); floaters.push({ x: nf.x, y: nf.y - 30, text: 'BOOT TIED UP', life: 40, color: '#9fd0ff' }); return true; }
  }
  // the man he can actually reach: judged by time to contact, not distance, so a player closing head-on at speed is a
  // target from further out; anyone beyond arm's length has to be in front of him
  let tgt = null, td = 1e9, tc0 = 0, bs = 1e9;
  const human = p === ctrl && !S.autoAI && !cpuT(p.team);
  for (const o of teamSkaters(1 - p.team)) {
    if (o.stun > 0 || o.g) continue;
    const rx = o.x - p.x, ry = o.y - p.y, d = hyp(rx, ry) || 1; if (d > CHECK.lungeD) continue;   // nobody lunges at a man more than ~3 body lengths away
    const ux = rx / d, uy = ry / d, close = (p.vx - o.vx) * ux + (p.vy - o.vy) * uy + CHECK.burst;
    const tc = d > 12 ? (d - 10) / Math.max(0.6, close) : 0; if (tc > CHECK.maxT) continue;
    const facing = ux * p.fx + uy * p.fy; if (d > 32 && facing < 0.5) continue;
    const sc = tc - facing * 3 + (human && !hitLegal(o) ? 100 : 0); if (sc < bs) { bs = sc; tgt = o; td = d; tc0 = tc; }   // your check: a legal target (in the play) in reach always wins
  }
  if (!tgt) { if (p !== ctrl || S.autoAI) p.cd = Math.max(p.cd, 6); return false; }   // nobody in range: no lunge at thin air
  p.cd = 42;
  let dx = p.fx, dy = p.fy;
  p.lungeBehind = false;
  if (tgt) {
    // aim where he will be when the hit arrives
    const k = Math.min(tc0, CHECK.leadMax) * CHECK.lead, ax = tgt.x + tgt.vx * k - p.x, ay = tgt.y + tgt.vy * k - p.y, ad = hyp(ax, ay) || 1;
    dx = ax / ad; dy = ay / ad; p.checkTarget = tgt;
    // from behind only if he is turned away AND skating away from you (a man coming at you is never 'from behind')
    const tsp = hyp(tgt.vx, tgt.vy), away = tsp > 0.5 ? (dx * tgt.vx + dy * tgt.vy) / tsp : 0;
    p.lungeBehind = (dx * tgt.fx + dy * tgt.fy) > HIT.behindCos && away > 0.35;
    if (p.lungeBehind && (p !== ctrl || S.autoAI) && Math.random() > aiD(p.team).behind) { p.cd = 12; p.checkTarget = null; p.lungeBehind = false; return true; }   // the AI won't run a man from behind
    // you just went past him and turned back: a second check into his back right away is held up (no accidental boarding)
    // BEATEN: the man who just got past you (you missed him) can't be run down and hit again until you've actually got
    // back alongside or in front of him: no turning round, two strides and a hit
    if (p.missTgt === tgt && S.t - (p.missT || -999) < BEATEN.frames) {
      const tsp2 = hyp(tgt.vx, tgt.vy), hx = tsp2 > 0.4 ? tgt.vx / tsp2 : tgt.fx, hy = tsp2 > 0.4 ? tgt.vy / tsp2 : tgt.fy;
      if ((p.x - tgt.x) * hx + (p.y - tgt.y) * hy < -BEATEN.behind) { p.cd = 10; p.checkTarget = null; p.lungeBehind = false; return true; }
    }
    if (p.lungeBehind && p.missTgt === tgt && S.t - (p.missT || -999) < 75) { p.cd = 14; p.checkTarget = null; p.lungeBehind = false; floaters.push({ x: p.x, y: p.y - 30, text: 'PULLS UP', life: 30, color: '#9fd0ff' }); return true; }
  } else p.checkTarget = null;
  // skating hard into someone = BIG HIT; from a slow start = little hit
  // speed INTO the target: chasing a man skating away closes slowly (a weak hit); side-on gets your full speed
  const own = Math.max(0, p.vx * dx + p.vy * dy), maxS = baseSpeed(p), tg = p.checkTarget;
  const spd = tg ? clamp((p.vx - tg.vx) * dx + (p.vy - tg.vy) * dy, 0, own + 0.4) : own;
  let thr = 0.85 + (cpuT(p.team) && !S.autoAI ? DIFF[S.diff].bigThr : 0) - hitToughness(p) * HIT.toughThr;   // same for everyone; tough players need less speed (Checking 5: 0.70 as before; 9 + Tough: 0.54; 2: 0.79)
  if (p.checkTarget) { const ang = dx * p.checkTarget.fx + dy * p.checkTarget.fy;      // > 0: at his back, ~0: side-on, < 0: head-on
    thr *= Math.abs(ang) < 0.4 ? 0.9 : ang > HIT.behindCos ? 1.15 : 1; }                         // side-on is the sweet spot; chasing a man down from behind rarely lands a big one
  p.bigHit = spd >= thr * maxS;
  p.dodgeRolled = false; p.lunge = p.checkTarget ? clamp(Math.round(tc0) + 4, 12, CHECK.maxLunge) : 12; p.lungeDx = dx; p.lungeDy = dy;
  p.lungeD0 = p.checkTarget ? td : 0;
  p.lungeStartFront = !!(p.checkTarget && (dx * p.checkTarget.fx + dy * p.checkTarget.fy) < -0.2);   // started face to face
  p.vx += dx * 2.2; p.vy += dy * 2.2; p.fx = dx; p.fy = dy;
  if (globalThis.HITDBG) { HITDBG['l' + p.team] = (HITDBG['l' + p.team] || 0) + 1; if (p.bigHit) HITDBG['b' + p.team] = (HITDBG['b' + p.team] || 0) + 1; if (p.checkTarget && p.checkTarget.team === 0 && hasPuck(p.checkTarget)) HITDBG['onCarrier' + p.team] = (HITDBG['onCarrier' + p.team] || 0) + 1; }
  return true;
}
// the carrier's body between the poker's stick and the puck: chasing him from behind, the stick can only get there
// THROUGH his legs (a trip, not a steal). From alongside it can reach around. Returns 0 (clear) .. 1 (fully shielded)
function pokeShield(p, o) {
  if (!o || o.g) return 0;
  const sp = hyp(o.vx, o.vy), hx = sp > 0.4 ? o.vx / sp : o.fx, hy = sp > 0.4 ? o.vy / sp : o.fy;
  const back = (p.x - o.x) * hx + (p.y - o.y) * hy; if (back > -3) return 0;           // beside or in front of him: no shield
  const mx = puck.x - p.x, my = puck.y - p.y, d2 = mx * mx + my * my || 1, k = clamp(((o.x - p.x) * mx + (o.y - p.y) * my) / d2, 0, 1);
  const off = hyp(o.x - (p.x + mx * k), o.y - (p.y + my * k));                         // how far the stick's path passes from his body
  return off < POKE_BODY.full ? 1 : off < POKE_BODY.edge ? (POKE_BODY.edge - off) / (POKE_BODY.edge - POKE_BODY.full) : 0;
}
const POKE_BODY = { full: 6, edge: 10, leak: 0.1, tripMul: 2.2, behindReach: 17 };
function pokeCheck(p) {
  if (p.cd > 0 || p.stun > 0 || hasPuck(p)) return;
  p.cd = 30; p.poke = 14;
  const sp = stickPoint(p, 14);
  const ow0 = puck.owner, ax = puck.x + (ow0 ? ow0.vx * 4 : puck.vx * 3), ay = puck.y + (ow0 ? ow0.vy * 4 : puck.vy * 3);   // where the puck is going
  const dpk = Math.min(hyp(puck.x - p.x, puck.y - p.y), hyp(ax - p.x, ay - p.y) + 2);
  const pa = Math.atan2(ay - p.y, ax - p.x), fa = Math.atan2(p.fy, p.fx);
  const inCone = Math.abs(angDiff(pa, fa)) < 1.25 || hyp(puck.x - sp.x, puck.y - sp.y) < 9 || hyp(ax - sp.x, ay - sp.y) < 8;
  sfx.poke();
  // mid-spin the carrier's whole side is open: a stick anywhere near him gets to the puck
  const spinOpen = puck.owner && !puck.owner.g && puck.owner.team !== p.team && puck.owner.dkMove && puck.owner.dkMove.kind === 'spin' && puck.owner.dkMove.t <= puck.owner.dkMove.dur && dist(p, puck.owner) < 32;
  // from behind a carrier skating away, the stick only reaches what's right there: the puck out in front of him (where
  // a carrier at speed carries it) is out of reach, however close his back is
  let reach = 28;
  { const o = puck.owner; if (o && !o.g && o.team !== p.team) { const s0 = hyp(o.vx, o.vy), hx = s0 > 0.4 ? o.vx / s0 : o.fx, hy = s0 > 0.4 ? o.vy / s0 : o.fy;
      if ((p.x - o.x) * hx + (p.y - o.y) * hy < -3) reach = POKE_BODY.behindReach; } }
  if ((spinOpen || (dpk < reach && inCone)) && puck.owner !== p && !(puck.owner && puck.owner.team === p.team)) {
    const owner = puck.owner;
    // goalies are off limits near their crease; one carrying it far out can be poked
    let chance = owner ? (owner.g ? (goalieSafe(owner) ? 0 : 0.5 + (A(p, 'def') - 5) * 0.04) : (cpuT(p.team) && !S.autoAI ? DIFF[S.diff].poke : 0.8) + (A(p, 'def') - 5) * 0.045 - (A(owner, 'def') - 5) * 0.02 - (A(owner, 'stk') - 5) * 0.015) : 1;
    if (owner && !owner.g && typeof lever === 'function' && zoneFor(p.team, puck.y) === 'att') chance *= lever(p.team, 'ozSteal') * (lineTempo(owner.team) === 'cycle' ? lever(p.team, 'vsCycle') : 1);   // Forecheck: hounds a patient team before it settles
    if (owner && !owner.g && typeof lever === 'function' && zoneFor(p.team, owner.y) !== 'def' && Math.abs(owner.y - (isUp(p.team) ? BLUE_BOT : BLUE_TOP)) < RK(30)) chance *= lever(p.team, 'standUp');   // Trap: stood up at the blue line
    // PUCK PROTECTION: a carrier working the wall with his body between the puck and the checker is hard to poke
    // (the AI does it on purpose in a settled possession); better stickhandlers protect it better
    if (owner && !owner.g) {
      const behind = ((p.x - owner.x) * owner.fx + (p.y - owner.y) * owner.fy) < 0, wall = Math.abs(owner.x - CX) > (R.r - R.l) / 2 - RK(34);
      if ((owner.protect || 0) > S.t || (wall && behind)) chance *= (typeof PAT !== 'undefined' ? PAT.protectMul : 0.55) * (1.15 - A(owner, 'stk') * 0.03);
    }
    if (owner && !owner.g && hyp(owner.vx, owner.vy) < 0.6 && !(owner.dkMove && owner.dkMove.t <= owner.dkMove.dur)) chance = Math.min(0.95, chance + PLAY.stallSteal);   // a standing carrier isn't protecting it
    // BEATEN: reaching from behind through the man who got past you hardly ever works, and it's how sticks end up in skates
    const shield = owner && !spinOpen ? pokeShield(p, owner) : 0;
    if (shield > 0) {
      chance *= 1 - shield * (1 - POKE_BODY.leak);
      if (shield > 0.5 && Math.random() >= chance) { if (typeof tripCheck === 'function' && tripCheck(p, POKE_BODY.tripMul * shield)) return; p.slow = 26; p.recoverT = 40; return; }
    }
    let beaten = false;
    if (owner && !owner.g && owner.dkMove && owner.dkMove.t <= owner.dkMove.dur) {
      const r = rightOf(owner), side = Math.sign((p.x - owner.x) * r.x + (p.y - owner.y) * r.y) || 1;
      const fit = dekeBeats(owner.dkMove, side, 'poke');
      if (fit > 0) {                                   // pulled the puck away from the stick: good timing beats the poke
        const perfect = owner.dkMove.read;                // started the move while the defender was winding up
        const evade = fit * clamp((perfect ? 0.78 : 0.55) + (A(owner, 'stk') - 5) * 0.06 - (A(p, 'def') - 5) * 0.045 - (stamOf(owner) < 35 ? 0.15 : 0) - Math.max(0, owner.dkSpam - 1.5) * 0.12, 0.2, 0.93);
        chance = Math.max(chance * (1 - evade), 0.1 + Math.max(0, owner.dkSpam - 1) * 0.08); beaten = true;
      } else if (dekeExposed(owner.dkMove, side, 'poke')) {                 // the wrong tool for a stick: the puck is easy to take
        const k = owner.dkMove.kind;
        chance = k === 'spin' ? Math.min(0.97, chance * 1.5 + 0.25) : k === 'dangle' ? Math.min(0.95, chance * 1.2 + DEKES.dangle.poke) : Math.min(1, chance * 1.3 + 0.1);
      }
    }
    if (beaten && Math.random() >= chance) {
      p.slow = owner.dkMove.read ? 60 : 40; p.cd = 40;
      if (owner.dkMove.read) { owner.vx += owner.fx * 0.9; owner.vy += owner.fy * 0.9; owner.dkSpam = Math.max(0, owner.dkSpam - 1); }   // perfect read: a burst past him
      floaters.push({ x: owner.x, y: owner.y - 32, text: owner.dkMove.read ? 'PERFECT FEINT!' : 'FEINTED!', life: 45, color: owner.dkMove.read ? '#ffd23f' : '#9fd0ff' });
      clipEvent('deke', { text: 'WHAT A FEINT! ' + plTag(owner), team: owner.team, players: owner.pl ? [owner.pl.id] : [] }, 18);
      say(['WHAT A FEINT! HE WALKS RIGHT AROUND HIM!', 'SHAKE AND BAKE! THE DEFENDER BITES!', 'SILKY FEET!'], 2, 0.8);
      excite(0.5); sfx.poke(); return;
    }
    if (beaten || Math.random() < chance) {
      if (owner && !beaten && typeof tripCheck === 'function' && tripCheck(p, 0.12)) return;   // won the puck but went through the legs to get it (rare)
      if (owner) { owner.block = 28; owner.charge = -1; pendingDef(p, 'poke', owner); }
      const ox = puck.x - p.x, oy = puck.y - p.y, od = hyp(ox, oy) || 1;
      const nx = ox / od + rand(-0.6, 0.6), ny = oy / od + rand(-0.6, 0.6);
      releasePuck(owner || p, nx * 1.8 + (owner ? owner.vx * 0.5 : 0), ny * 1.8 + (owner ? owner.vy * 0.5 : 0), owner ? 28 : 0);
      if (!owner) p.block = 0;
      puck.lastTouch = p; puck.passTarget = null; puck.shotTeam = null;
      floaters.push({ x: p.x, y: p.y - 30, text: 'TACKLE!', life: 40, color: '#ffffff' });
      return;
    }
  }
  if (typeof tripCheck === 'function' && tripCheck(p)) return;
  p.slow = 22; p.recoverT = 36;                 // whiffed: get back into position
}
function resolveLunge(p) {
  const t = p.checkTarget;
  if (t && t.g) { p.lunge = 0; p.checkTarget = null; return; }       // never a goalie
  if (!t) { if (p.lunge === 1) p.slow = 36; return; }
  // hits favour the front and sides: a check that started face-to-face or side-on and slid past
  // the target never turns into a hit from behind (only a rare accident); a deliberate one still can
  const dd = dist(p, t) || 1, cx = (t.x - p.x) / dd, cy = (t.y - p.y) / dd;
  const backC = cx * t.fx + cy * t.fy;                                    // > 0: arriving at his back
  if (p.lungeDx * (t.x - p.x) + p.lungeDy * (t.y - p.y) < -2) {          // went past him: missed
    p.lunge = 0; p.checkTarget = null; p.slow = 30; p.missT = S.t; p.missTgt = t; p.cd = Math.max(p.cd, 30);
    if (t.dkMove && t.dkMove.kind === 'spin' && hasPuck(t)) { p.slow = 60; spinSurge(t); floaters.push({ x: t.x, y: t.y - 32, text: 'SPUN OFF IT!', life: 45, color: '#ffd27a' }); excite(0.3); }
    return; }
  const reach = backC > HIT.behindCos ? 8 : backC < -0.2 ? 13.5 : Math.abs(backC) < 0.4 ? 13.5 : 12.5;   // from behind you have to be right on him; side-on is the easiest to land
  if (t.dkMove && t.dkMove.t <= t.dkMove.dur && dd < reach + 2 && hasPuck(t)) {
    const r = rightOf(t), side = Math.sign((p.x - t.x) * r.x + (p.y - t.y) * r.y) || 1;
    const fit = dekeBeats(t.dkMove, side, 'check');
    const spin = t.dkMove.kind === 'spin';
    if (fit > 0 && Math.random() < fit * ((t.dkMove.read ? 0.9 : spin ? DEKES.spin.dodge : 0.6) + (A(t, 'stk') - 5) * (spin ? 0.02 : 0.04))) {
      p.lunge = 0; p.checkTarget = null; p.slow = spin ? 60 : 46; p.vx *= spin ? 0.7 : 0.5; p.vy *= spin ? 0.7 : 0.5;   // spun round: he sails on past and has to recover
      floaters.push({ x: t.x, y: t.y - 32, text: t.dkMove.read ? 'PERFECT FEINT!' : t.dkMove.kind === 'spin' ? 'SPUN OFF IT!' : 'SIDESTEPPED!', life: 45, color: t.dkMove.read ? '#ffd23f' : '#9fd0ff' });
      if (t.dkMove.read) { t.vx += t.fx * 0.8; t.vy += t.fy * 0.8; }
      if (spin) spinSurge(t);
      clipEvent('deke', { text: 'WHAT A FEINT! ' + plTag(t), team: t.team, players: t.pl ? [t.pl.id] : [] }, 18);
      excite(0.4); return;
    }
  }
  if (t.stun <= 0 && dd < reach && hasPuck(t) && !t.dkMove && backC < HIT.behindCos) {
    // he saw it coming from a long way off: a heads-up carrier steps out of it (hands and speed help)
    const tele = hitTele(p), dodge = tele * HIT.dodgeFar * clamp(0.55 + (A(t, 'stk') - 5) * 0.06 + (A(t, 'spd') - 5) * 0.05, 0.3, 1.2) * (p.lungeStartFront ? 1.2 : 1);
    if (!p.dodgeRolled && Math.random() < dodge) {
      p.lunge = 0; p.checkTarget = null; p.slow = 40; p.vx *= 0.55; p.vy *= 0.55; p.missT = S.t; p.missTgt = t;
      const r = rightOf(t), sd = Math.sign((p.x - t.x) * r.x + (p.y - t.y) * r.y) || 1; t.vx -= r.x * sd * 0.9; t.vy -= r.y * sd * 0.9;
      floaters.push({ x: t.x, y: t.y - 32, text: 'SAW IT COMING', life: 40, color: '#9fd0ff' });
      return;
    }
    p.dodgeRolled = true;
  }
  if (t.stun <= 0 && dd < reach) {
    const legalAtHit = hitLegal(t);
    if (backC > HIT.behindCos && !p.lungeBehind && !p.lungeStartFront && Math.random() > PLAY.behindAccident) {   // ended up behind him by accident: pull up, no contact
      p.lunge = 0; p.checkTarget = null; p.slow = 24; p.vx *= 0.4; p.vy *= 0.4;
      floaters.push({ x: p.x, y: p.y - 30, text: 'PULLS UP', life: 30, color: '#9fd0ff' });
      return;
    }
    // a hit from behind needs him turned away from the hitter and moving away from him: a player coming toward
    // the hitter, or a hit that started head-on, is never one (whatever way he turned at the last moment)
    const tsp2 = hyp(t.vx, t.vy), tAway = tsp2 > 0.5 ? (cx * t.vx + cy * t.vy) / tsp2 : 0;
    const behind = backC > HIT.behindCos && tAway > 0.3 && (p.lungeBehind ? (p.lungeDx * t.fx + p.lungeDy * t.fy) > 0.6 : true) && !(p.lungeStartFront);
    // caught mid-move by a hit: a spin he guessed wrong (or a toe drag into the hitter) gets him laid out; a dangle can't ride it
    let exposed = null;
    if (hasPuck(t) && t.dkMove) { const rr = rightOf(t), hs2 = Math.sign((p.x - t.x) * rr.x + (p.y - t.y) * rr.y) || 1; exposed = dekeExposed(t.dkMove, hs2, 'check'); }
    if (exposed === 'laid') p.bigHit = true;
    // a small hit into a man's back does little: he's nudged off his line and keeps the puck (no stumble)
    if (backC > HIT.behindCos && !p.bigHit && exposed !== 'laid') {
      t.vx += p.lungeDx * 0.7; t.vy += p.lungeDy * 0.7; t.wobble = 10;
      p.lunge = 0; p.checkTarget = null; p.slow = 26; p.vx *= 0.35; p.vy *= 0.35; sfx.check();
      floaters.push({ x: t.x, y: t.y - 30, text: 'JUST A BUMP', life: 36, color: '#9fd0ff' });
      return;
    }
    // a carrier who sees it coming can ride it out: good hands, balance and speed against the hitter's checking.
    // He may keep the puck and just be knocked off his line, or lose it only a little way; the rest get flattened
    if (p.bigHit && hasPuck(t) && !behind && exposed !== 'laid') {
      const sideStep = tsp2 > 0.5 ? Math.abs(cx * -t.vy / tsp2 + cy * t.vx / tsp2) : 0;       // moving across the hit, not into it
      const ride = (HIT.rideNear + (HIT.rideFar - HIT.rideNear) * hitTele(p)) * clamp(0.05 + ((A(t, 'stk') - 5) * 0.03 + (A(t, 'spd') - 5) * 0.02 + (A(t, 'def') - 5) * 0.01) * (0.35 + sideStep) + sideStep * 0.2 - (hitToughness(p) - 5) * 0.04 + (t.pl && t.pl.pos === 'D' ? 0.04 : 0), 0.02, 0.33);
      // Defensive Shell: around its own net its hitters jar it loose more often (at a stamina cost)
      const slotHit = typeof lever === 'function' && hyp(t.x - CX, t.y - ownGoalY(p.team)) < RK(95) ? lever(p.team, 'slotHit') : 1;
      if (slotHit < 1 && MS && p.pl) MS.stam[p.pl.id] = Math.max(0, (MS.stam[p.pl.id] ?? 100) - 4);
      const r = Math.random() / slotHit * ((t.protect || 0) > S.t ? 0.5 : 1) / (exposed === 'bump' ? DEKES.dangle.ride : 1);   // protecting it along the wall: braced for the hit; mid-dangle: the puck is out on show
      if (r < ride) {                     // rides it out: keeps the puck, knocked off his line a little
        t.vx += p.lungeDx * 0.9; t.vy += p.lungeDy * 0.9; t.wobble = 14;
        p.lunge = 0; p.checkTarget = null; p.vx *= 0.4; p.vy *= 0.4; statHit(p); sfx.check();
        floaters.push({ x: t.x, y: t.y - 30, text: 'RIDES IT OUT', life: 40, color: '#9fd0ff' });
        return;
      }
      if (r < ride * 1.9) {               // bumped: stays up, but the puck squirts a short way off his stick
        t.vx += p.lungeDx * 1.3; t.vy += p.lungeDy * 1.3; t.stun = 8; t.stunType = 'small';
        const lost = 1.2 + (6 - A(t, 'stk') * 0.4) * 0.3 + (A(p, 'chk') - 5) * 0.12;
        releasePuck(t, t.vx * 0.5 + p.lungeDx * lost, t.vy * 0.5 + p.lungeDy * lost, 24); puck.passTarget = null; puck.shotTeam = null;
        pendingDef(p, 'hit', t);
        p.lunge = 0; p.checkTarget = null; p.vx *= 0.45; p.vy *= 0.45; statHit(p); sfx.check();
        floaters.push({ x: t.x, y: t.y - 30, text: 'KNOCKED LOOSE', life: 40, color: '#ffd23f' });
        return;
      }
    }
    const big = p.bigHit;
    const kb = (0.8 + hitToughness(p) * HIT.toughKb) * (t.dkVuln > 0 ? 1.15 : 1);   // caught mid-deke
    const stm = typeof traitMul === 'function' ? traitMul(t.pl, 'stunMul') : 1;
    // not every big hit flattens him: strong, balanced players (and anyone hit square while braced) can stay up, rocked
    const flat = !big || behind || exposed === 'laid' || Math.random() < clamp(0.3 + (A(p, 'chk') - 5) * 0.05 - (A(t, 'def') - 5) * 0.03 - (A(t, 'sta') - 5) * 0.02 - (p.lungeStartFront ? 0.08 : 0), 0.3, 0.92);
    if (big && !flat) { t.stun = Math.round(46 * stm); t.stunType = 'small'; t.vx += p.lungeDx * 2.6 * kb; t.vy += p.lungeDy * 2.6 * kb; }   // rocked, still on his skates
    else if (big) { t.stun = Math.round(75 * stm); t.stunType = 'big'; t.vx += p.lungeDx * 3.3 * kb; t.vy += p.lungeDy * 3.3 * kb; }   // leveled: ~1s longer down
    else { t.stun = Math.round(22 * stm); t.stunType = 'small'; t.vx += p.lungeDx * 1.6 * kb; t.vy += p.lungeDy * 1.6 * kb; }  // stumble
    statHit(p);
    if (big) bigHitToll(p, t, flat, behind);
    t.charge = -1; t.boardT = 40; t.boardBig = big;
    if (!S.demo) { S.hitStop = big ? 5 : 2; S.shake = Math.max(S.shake || 0, big ? 2.2 : 0.7); }
    if (hasPuck(t)) {
      pendingDef(p, 'hit', t);
      const loose = clamp(1.25 - (A(t, 'stk') - 5) * 0.06 + (A(p, 'chk') - 5) * 0.04, 0.7, 1.6);   // weak hands, strong checker: the puck goes further
      releasePuck(t, t.vx * 0.8 * loose + rand(-1, 1), t.vy * 0.8 * loose + rand(-1, 1), 40);
      puck.passTarget = null; puck.shotTeam = null;
    }
    p.lunge = 0; p.checkTarget = null; p.vx *= big ? 0.3 : 0.5; p.vy *= big ? 0.3 : 0.5;
    for (let i = 0; i < (big ? 26 : 10); i++) particles.push({ x: t.x, y: t.y, vx: rand(-2.2, 2.2), vy: rand(-2.2, 2.2), life: rand(12, 28), color: i % 2 ? '#ffffff' : '#cfe6ff' });
    if (big) {
      sfx.bigHit(); sfx.oof(); if (S.pres && S.pres.voice === false) sfx.ooh(); excite(0.7); S.hitFlash = 8; typeof voiceCue === 'function' && voiceCue('hit');
      clipEvent('hit', { text: 'BIG TACKLE! ' + plTag(p) + ' LEVELS ' + (t.pl ? t.pl.last.toUpperCase() : ''), team: p.team, players: [p.pl && p.pl.id, t.pl && t.pl.id].filter(Boolean) }, 16);
      if (S.cheer < 70) { S.cheer = 70; S.cheerKind = 'all'; }
      say(['OH! HE GOT LEVELED!', "HE'LL FEEL THAT ONE IN THE MORNING!", 'LIGHTS OUT ON THAT HIT!', 'WHAT A HIT! THE CROWD LOVES IT!', `#${p.num} JUST FLATTENED HIM!`], 2);
      const words = ['OOF!', 'UGH!', 'OUCH!', 'OW!', 'OOMPH!'];
      floaters.push({ x: t.x, y: t.y - 30, text: flat ? words[(Math.random() * words.length) | 0] : 'ROCKED!', life: 70, bubble: true });
    } else sfx.check();
    // from behind is only a penalty when it's a big hit or it puts the man on the ice; a bump from behind is play on
    const foul = behind && (big || t.stunType === 'big') && S.rules && S.phase === 'live' && !S.so;
    // INTERFERENCE: flattened a man who wasn't in the play (no puck, didn't just have it, not about to get it); the ref sees most
    const interf = !foul && big && t.stunType === 'big' && !legalAtHit && S.rules && S.phase === 'live' && !S.so && Math.random() < HIT.refInterf;
    if (big && typeof onBigHit === 'function') onBigHit(p, t, behind, foul);
    else if (!big && !foul && typeof onSmallHit === 'function') onSmallHit(p, t);
    if (foul && S.phase === 'live') callFoul('behind', p, t);
    else if (interf) callFoul('offpuck', p, t);
    else if (!foul) floaters.push({ x: t.x, y: t.y - (big ? 54 : 30), text: big ? 'BIG TACKLE!' : 'HIT!', life: 45, color: big ? '#ff6a4a' : '#ffd23f' });
    return;
  }
  if (p.lunge === 1) { p.slow = 36; p.checkTarget = null; }
}

// ====================================================================
//  THINKING
// ====================================================================
function thinkHuman(p) {
  let ix = (KR() ? 1 : 0) - (KL() ? 1 : 0);
  let iy = (KD() ? 1 : 0) - (KU() ? 1 : 0);
  if (ix && iy) { ix *= Math.SQRT1_2; iy *= Math.SQRT1_2; }
  p.inx = ix; p.iny = iy;
  p.speedMul = 1; p.bwd = false;
  const shootHeld = Input.down('shoot'), checkHeld = Input.down('check');
  // DEKE MOVES: one key per move (toe drag, dangle, spin-o-rama). The player picks the tool; the game does it the
  // smart way (the drag goes away from the man in front, the spin turns his back into the pressure), so the arrows
  // stay free for steering and aiming the shot after. A move pressed in the last few frames of one chains onto it.
  // HOLD the toe-drag key (after any move) and the arrows move the puck by hand.
  if (input.dekePressed) {
    const kind = input.dekeKind || 'drag'; input.dekePressed = false; input.dekeKind = null;
    if (hasPuck(p) && p.charge < 0) { if (kind === 'drag') p.dkQAt = performance.now(); humanDekeMove(p, kind); }
  }
  if (p.dkQueued) { const mv = p.dkMove, q = p.dkQueued; if (!hasPuck(p) || !mv) p.dkQueued = null; else if (mv.t >= mv.dur - DEKES.chain) humanDekeMove(p, q); }
  const deking = hasPuck(p) && Input.down('deke') && p.charge < 0 && !(p.tapDkT > 0) && performance.now() - (p.dkQAt || 0) > DEKES.holdMs;
  if (deking) humanDeke(p, ix, iy);
  else { if (p.dkHead) p.side = puckOnBackhand(p) ? -1 : 1; p.dkHead = null; p.dkLast = 0; if (!p.dkAi && !(p.dkMove && p.dkMove.kind === 'dangle')) p.dkTarget = sideOff(p); }   // (let go of hand control: it stays on the side he left it)
  // AIMING A PASS: hold PASS and the arrows swing the pass around while you keep skating your line
  const aiming = hasPuck(p) && !deking && p.passAt != null && performance.now() - p.passAt > PLAY.passTapMs;
  if (aiming) {
    if (!p.passHead) { const sp0 = hyp(p.vx, p.vy); p.passHead = sp0 > 0.4 ? { x: p.vx / sp0, y: p.vy / sp0, m: Math.min(1, sp0 / baseSpeed(p) + 0.1) } : { x: p.fx, y: p.fy, m: 0 }; }
    if (ix || iy) { const m = hyp(ix, iy); p.passAim = { x: ix / m, y: iy / m }; }
    p.inx = p.passHead.x * p.passHead.m; p.iny = p.passHead.y * p.passHead.m;
    if (p.passHead.m > 0) { p.fx = p.passHead.x; p.fy = p.passHead.y; }
  } else if (p.passAt == null) { p.passHead = null; p.passAim = null; }
  const keysNow = { l: KL(), r: KR(), u: KU(), d: KD() }, kp = p.keysPrev || {}; p.keysPrev = keysNow;
  if (p.tapDkT > 0) {                                              // during the move he keeps his line; the puck does the moving
    p.tapDkT--; if (!hasPuck(p)) p.tapDkT = 0;
    else if (p.tapHead && p.dkMove && p.dkMove.kind === 'spin') {
      const mv = p.dkMove, m = dekeDrive(p, p.tapHead, ix, iy) * DEKES.spin.speed;
      p.inx = p.tapHead.x * m; p.iny = p.tapHead.y * m;
      const a = Math.atan2(p.tapHead.y, p.tapHead.x) + mv.dir * 2 * Math.PI * Math.min(1, mv.t / mv.dur); p.fx = Math.cos(a); p.fy = Math.sin(a);   // all the way round, puck and all
    }
  }
  const carrier = puck.owner && puck.owner.team !== p.team && !puck.owner.g ? puck.owner : null;
  const cd = carrier ? dist(p, carrier) : 1e9;
  // PIVOT: skating backwards facing the carrier, double-tap the direction you're backing toward to turn and skate forward
  if (p.pvKey && kp[p.pvKey] && !keysNow[p.pvKey]) p.pvUp = performance.now();   // a quick release + press again counts as the double tap too
  if (carrier && !hasPuck(p)) {
    const fx0 = (carrier.x - p.x) / (cd || 1), fy0 = (carrier.y - p.y) / (cd || 1), t3 = performance.now();
    for (const [k, dx, dy] of [['l', -1, 0], ['r', 1, 0], ['u', 0, -1], ['d', 0, 1]]) if (keysNow[k] && !kp[k] && dx * fx0 + dy * fy0 < -0.35) {
      if (p.pvKey === k && (t3 - (p.pvAt || 0) < PIVOT.doubleMs || t3 - (p.pvUp || 0) < PIVOT.doubleMs)) { p.pivot = { k, dx, dy }; p.pvAt = 0; p.slow = Math.max(p.slow || 0, PIVOT.slow); floaters.push({ x: p.x, y: p.y - 30, text: 'PIVOT', life: 22, color: '#9fd0ff' }); }
      else { p.pvKey = k; p.pvAt = t3; }
    }
  }
  if (p.pivot && (!(ix || iy) || (ix * p.pivot.dx + iy * p.pivot.dy) <= 0 || hasPuck(p))) p.pivot = null;   // let go or changed direction: back to normal
  if (deking || (p.tapDkT > 0 && p.dkMove && p.dkMove.kind === 'spin')) { /* facing handled by the deke */ }
  else if (p.pivot) { const m = hyp(ix, iy); p.fx = ix / m; p.fy = iy / m; }   // turned around: full forward speed, back to the play
  else if (carrier && cd < 120 && S.phase === 'live' && p.lunge <= 0 && p.stun <= 0) {
    // defending: keep your eyes on the puck carrier. Skating away from him is BACKWARDS (slower);
    // only skating at him builds speed for a big hit
    p.fx = (carrier.x - p.x) / (cd || 1); p.fy = (carrier.y - p.y) / (cd || 1);
    if (ix || iy) {
      const m = hyp(ix, iy), dot = (ix * p.fx + iy * p.fy) / m;
      if (dot < -0.35) { p.speedMul = 0.7; p.bwd = true; } else if (dot < 0.35) p.speedMul = 0.86;
    }
  } else if (ix || iy) { const m = hyp(ix, iy); p.fx = ix / m; p.fy = iy / m; }
  // SPRINT: a burst of speed that burns stamina (not while winding up or deking)
  p.sprint = S.sprintOn && !deking && p.charge < 0 && (ix || iy) && stamOf(p) > 8 && !p.bwd;
  const spacePressed = input.spacePressed, shiftPressed = input.shiftPressed, passPressed = input.passPressed, pokePressed = input.pokePressed, loftPressed = input.loftPressed;
  input.spacePressed = input.shiftPressed = input.passPressed = input.pokePressed = input.coverPressed = input.loftPressed = false;
  const pen = S.phase === 'penalty';
  if (input.linePressed) { input.linePressed = false; if (!pen && MS && !S.so) { MS.lineReq = true; MS.note = { t: 0, text: 'ROLLING SUB CALLED', life: 90 }; } }
  const now = performance.now();
  // PASS: tap = normal pass; hold to put more on it (full power ~600 ms)
  if (passPressed && hasPuck(p) && !pen) { p.passAt = now; p.passKey = 'pass'; }
  if (shiftPressed && hasPuck(p) && !pen) { p.passAt = now; p.passKey = 'check'; }      // either pass button: the pass goes on RELEASE, held longer = harder
  if (p.passAt != null) {
    if (!hasPuck(p) || pen) p.passAt = null;
    else if (!Input.down(p.passKey || 'pass')) {
      const held = now - p.passAt; const aim = p.passAim; p.passAt = null; p.passHead = null; p.passAim = null;
      const pw = clamp((held - PLAY.passTapMs) / (PLAY.passFullMs - PLAY.passTapMs), 0, 1), ax = aim ? aim.x : ix, ay = aim ? aim.y : iy;
      // aimed into the boards with no teammate that way: send it around the boards (softer than a rim shot)
      let rimmed = false;
      if ((ax || ay) && rimIntent(p, ax, ay)) {
        const m = bestPassTarget(p, ax, ay, true), am = hyp(ax, ay) || 1;
        const mateThatWay = m && ((m.x - p.x) * ax + (m.y - p.y) * ay) / ((dist(p, m) || 1) * am) > 0.88;
        if (!mateThatWay) rimmed = rimPuck(p, 0.4 + pw * 0.6, { x: ax, y: ay }, true);
      }
      if (!rimmed) pass(p, pw, aim);
    }
  }
  if (pokePressed && !hasPuck(p) && !pen) slideTackle(p);   // SOCCER: the instant-poke key is the SLIDE TACKLE
  if (loftPressed && hasPuck(p) && !pen && !(p.charge > 0)) { if (p.restart) p.restart = null; loftAction(p); humanBend(p); return; }   // SOCCER: the lofted ball (cross / chip / long ball)
  const passToMe = !puck.owner && puck.passTarget === p;                    // a pass on its way to you: Shift does nothing (no stray check before a one-timer)
  if (shiftPressed && !pen) {
    if (hasPuck(p) || passToMe) input.shiftPending = false;                  // (with the puck, the pass itself happens on release, above)
    else if (stealable(p)) { input.shiftPending = false; p.stealT = S.t + STEAL.window; }   // a loose puck / their pass is coming past your stick: reach out and take it
    else { input.shiftPending = true; input.shiftAt = performance.now(); }
  }
  if (input.shiftPending) {
    if (hasPuck(p) || pen || passToMe) { input.shiftPending = false; input.checkArmed = false; }
    else if (checkHeld && performance.now() - input.shiftAt >= 190) { input.checkArmed = true; if (p.cd <= 0 && bodyCheck(p)) { input.shiftPending = false; input.checkArmed = false; } }   // held: lines up the hit, and lunges once a man is in range
    else if (!checkHeld) { input.shiftPending = false; if (!input.checkArmed) pokeCheck(p); input.checkArmed = false; }   // a tap pokes; letting go of a lined-up hit does nothing
  }
  if (hasPuck(p)) {
    // REACTIVE ONE-TIMER: SHOOT right after the pass arrives (not on Hard)
    if (spacePressed && p.charge < 0 && !pen && p.recvAt && now - p.recvAt <= otReactWindow() && reactiveAllowed() && !p.otUsed) { p.recvAt = 0; oneTimer(p, 0.75, 'react'); }
    // WRAPAROUND: SHOOT from behind the net, next to a post
    else if (spacePressed && p.charge < 0 && !pen && wrapPosition(p)) tryWrap(p);
    else {
      // DANGLE + SHOOT: snaps it off right away, off whichever side the puck is on at that moment
      if (spacePressed && p.charge < 0 && !pen && p.dkMove && p.dkMove.kind === 'dangle') {
        p.shotBack = puckOnBackhand(p); p.dkMove = null; p.tapDkT = 0; p.wrist = true; shoot(p, PLAY.wristPower); p.wrist = false; p.shotBack = null; humanBend(p);
      }
      if (p.charge < 0 && spacePressed && hasPuck(p)) { p.charge = 0; p.zoneKeys = null; p.shotAt = now; p.shotBack = puckOnBackhand(p); }
      if (p.charge >= 0 && (p.side || 1) < 0 && now - (p.shotAt || 0) >= PLAY.wristMs) { p.side = 1; p.dkTarget = sideOff(p); p.shotBack = false; }   // winding up: onto the forehand
      if (p.charge >= 0) {
        if (shootHeld) p.charge = Math.min(1, p.charge + 1 / shotFrames());
        else if ((ix || iy) && rimIntent(p, ix, iy)) { const pw = now - (p.shotAt || 0) < PLAY.wristMs ? 0.55 : p.charge; p.charge = -1; rimPuck(p, pw, { x: ix, y: iy }); }   // aimed into the boards: rim it hard
        else if (now - (p.shotAt || 0) < PLAY.wristMs) { p.wrist = true; shoot(p, PLAY.wristPower); p.wrist = false; p.shotBack = null; humanBend(p); }   // quick WRIST SHOT (or a backhand off the backhand side)
        else { shoot(p, p.charge); humanBend(p); }
      }
    }
  } else if (puck.passTarget === p && !pen) {
    // the pass is on its way to him: he skates onto it and squares up himself; your keys take over once he has it
    if (!puck.owner) {
      const m = passMeetPoint(p); p.inx = p.iny = 0; steerTo(p, m.x, m.y, 1, 4);
      const gx = CX - p.x, gy = oppGoalY(p.team) - p.y, gd = hyp(gx, gy) || 1;
      if (hyp(m.x - p.x, m.y - p.y) < 8) { p.rcvSet = (p.rcvSet || 0) + 1; p.fx = gx / gd; p.fy = gy / gd; }   // set: blade facing the net
    }
    // pass on its way: press SHOOT just before it arrives for an ANTICIPATED ONE-TIMER
    // ONE press per pass counts: pressing again while it travels (mashing) gives up the one-timer for this pass
    if (spacePressed) { if (p.otPass === puck.passT) p.otSpam = puck.passT; else { p.otAt = now; p.otPass = puck.passT; } p.zoneKeys = null; }
    p.charge = p.otPass === puck.passT && p.otSpam !== puck.passT && now - p.otAt < otAntiWindow() + 60 ? 0.35 : -1;      // shoulders squared while it comes
  } else {
    p.charge = -1;
    // a shot from a teammate on its way: SHOOT = try to tip it
    if (spacePressed && puck.shot && !puck.shot.done && puck.shooter && puck.shooter.team === p.team && puck.shooter !== p) p.tipAt = now;
    else if (spacePressed && !pen && puck.passTarget && puck.passTarget.team === 0 && !puck.owner) { const r = puck.passTarget; if (r.otPass === puck.passT) r.otSpam = puck.passT; else { r.otAt = now; r.otPass = puck.passT; } }   // pressed before control moved to the receiver: it still counts for him
    else if (spacePressed && !pen && !(puck.passTarget && puck.passTarget.team === 0)) manualSwitch();
  }
  p.aim = hasPuck(p) ? humanAim(p) : (p.charge >= 0 ? humanAim(p, true, true) : null);
  // winding up: the skater squares his shoulders to the target while you keep skating freely
  if (p.charge >= 0 && p.aim && p.aim.on) { const dx = p.aim.x - p.x, dy = p.aim.y - p.y, d = hyp(dx, dy) || 1; p.fx = dx / d; p.fy = dy / d; }
}

// ====================================================================
//  DEKES: the puck really moves to the skater's left or right (dkOff, world units)
// ====================================================================
const DEKE_REACH = 7.5;
// which side he carries it on: +1 forehand (his stick side, the default), -1 backhand (reached across his body to the
// other side, mirroring the forehand). The toe drag switches it and it STAYS there until he moves it back.
const BACKHAND_OFF = 15;                                                    // world units from the forehand spot to the backhand spot (its mirror image)
const sideOff = p => (p.side || 1) < 0 ? -((typeof handSign === 'function' ? handSign(p) : 1) || 1) * BACKHAND_OFF : 0;
const puckOnBackhand = p => !p.g && (p.dkOff || 0) * ((typeof handSign === 'function' ? handSign(p) : 1) || 1) < -BACKHAND_OFF * 0.5;
// the deke moves: each has a fixed length and a fixed puck path, so the same input gives the same move every time
const DEKES = {
  buffer: 90,      // ms after the deke key to catch the direction pressed with it
  holdMs: 260,     // held this long (and no move running): hand control of the puck
  chain: 7,        // frames at the end of a move in which the next one links straight on
  early: 8,        // pressed up to this many frames before that: held over and fired as soon as it can
  drag:   { name: 'DRAG-BACK',    dur: 1,    label: '#9fd0ff', cut: 1.0 },              // cut: sideways burst the way the puck goes (a sudden new angle)
  dangle: { name: 'DANGLE',      dur: 0.75, label: '#b8f0a0', burst: 0.35, juke: 40, bite: 0.6, freeze: 50, poke: 0.15, ride: 0.3 },   // the JUKE: the man in front bites and freezes; but the puck is out on show
  spin:   { name: 'ROULETTE', dur: 1.6, label: '#ffd27a', speed: 0.85, entry: 0.92,   // a DODGE: read the hit, spin, roll off to one side
            side: 18, window: 0.85, dodge: 0.92, surge: 0.55, poke: 0.25 },   // the gamble: read the hit and spin round it (surge forward); guess wrong and you're exposed   // side: units rolled sideways; window: share of the move that beats a hit
};
// how well a move beats a defender's stick or body: 1 = this is what it's for, 0 = no help
// caught mid-move by the wrong challenge: how exposed it leaves him ('poke': the strip gets easier; 'check': 'laid' = always a flattening, 'bump' = can't ride it)
function dekeExposed(m, side, vs) {
  if (!m || m.t > m.dur) return null;
  if (m.kind === 'spin') return vs === 'poke' ? 'strip' : 'laid';
  if (m.kind === 'dangle') return vs === 'poke' ? 'strip' : 'bump';
  return m.dir === side ? (vs === 'poke' ? 'strip' : 'laid') : null;      // toe drag the wrong way: right into the stick or the hit
}
function dekeBeats(m, side, vs) {
  if (m.kind === 'spin') return vs === 'check' && m.t <= m.dur * DEKES.spin.window ? 1 : 0;   // rolls round a hit he read; nothing against a stick
  if (m.kind === 'dangle') return 0;                                       // the dangle wins BEFORE the challenge (the juke); caught mid-move, it's exposed
  return m.dir === -side ? 1 : 0;                                         // toe drag: away from the stick or the hitter
}
// the nearest opponent in front of the carrier (a defender's stick or the goalie): his side, as the carrier sees it
function dekeThreat(p) {
  const r = rightOf(p); let best = null, bd = 1e9;
  for (const o of players) {
    if (o.team === p.team || o.fight || o.stun > 30) continue;
    const dx = o.x - p.x, dy = o.y - p.y, fwd = dx * p.fx + dy * p.fy, lat = dx * r.x + dy * r.y, d = hyp(dx, dy);
    if (fwd < -6 || d > (o.g ? 90 : 60) || d >= bd) continue;
    bd = d; best = { o, lat };
  }
  return best;
}
// a spin that came off: he rolls round the hit and comes out of it moving forward along his old line
function spinSurge(t) {
  const mv = t.dkMove; if (!mv || mv.won) return; mv.won = true;
  const h = mv.head || { x: t.fx, y: t.fy }, k = DEKES.spin.surge;
  t.vx += h.x * k; t.vy += h.y * k;
}
// the dangle's juke: the closest man in front reads the fake and bites, and for a moment he's frozen
function dangleJuke(p) {
  let d = null, bd = DEKES.dangle.juke;
  for (const o of teamSkaters(1 - p.team)) {
    if (o.stun > 0 || o.fight || o.lunge > 0) continue;
    const dx = o.x - p.x, dy = o.y - p.y, dd = hyp(dx, dy); if (dd > bd || dx * p.fx + dy * p.fy < 0) continue;
    bd = dd; d = o;
  }
  if (!d) return;
  const read = p.dkMove && p.dkMove.read, bite = clamp(DEKES.dangle.bite + (A(p, 'stk') - 5) * 0.06 - (A(d, 'def') - 5) * 0.05 + (read ? 0.2 : 0) - Math.max(0, (p.dkSpam || 0) - 1.5) * 0.12, 0.15, 0.92);
  if (Math.random() >= bite) return;
  const r = rightOf(p), fake = -(p.side || 1) * ((typeof handSign === 'function' ? handSign(p) : 1) || 1);   // which way the puck went first
  d.slow = Math.max(d.slow || 0, DEKES.dangle.freeze); d.cd = Math.max(d.cd || 0, 30); d.windUp = null; d.poke = 0;
  d.vx = d.vx * 0.4 + r.x * fake * 0.9; d.vy = d.vy * 0.4 + r.y * fake * 0.9;                                  // he goes with the fake
  floaters.push({ x: d.x, y: d.y - 30, text: 'JUKED!', life: 40, color: '#b8f0a0' });
  if (dist(p, d) < 30) { clipEvent('deke', { text: 'WHAT A FEINT! ' + plTag(p), team: p.team, players: p.pl ? [p.pl.id] : [] }, 18); excite(0.4); }
}
// the man most likely to hit him next: already lunging at him, winding up a check on him, or closing fastest (any side)
function spinThreat(p) {
  let best = null, bs = -1e9;
  for (const o of players) {
    if (o.team === p.team || o.g || o.fight || o.stun > 0) continue;
    const dx = p.x - o.x, dy = p.y - o.y, d = hyp(dx, dy) || 1; if (d > 80) continue;
    const close = ((o.vx - p.vx) * dx + (o.vy - p.vy) * dy) / d;      // how fast he is coming at him
    const sc = (o.lunge > 0 && o.checkTarget === p ? 100 : 0) + (o.windUp && o.windUp.target === p && o.windUp.kind === 'check' ? 60 : 0) + close * 12 - d * 0.4;
    if (sc > bs) { bs = sc; best = o; }
  }
  return best;
}
function humanDekeMove(p, kind) {
  const mv = p.dkMove;
  if (mv && mv.t < mv.dur - DEKES.chain) {                                // mid-move: only the end of one chains
    if (mv.t >= mv.dur - DEKES.chain - DEKES.early) p.dkQueued = kind;    // a touch early: it goes the moment it can
    return;
  }
  p.dkQueued = null;
  const chained = !!mv;
  if (mv) p.dkCd = 0;
  const sp = hyp(p.vx, p.vy), head = sp > 0.4 ? { x: p.vx / sp, y: p.vy / sp, m: Math.min(1, sp / baseSpeed(p) + 0.1) } : { x: p.fx, y: p.fy, m: 0 };
  const th = dekeThreat(p), thSide = th && Math.abs(th.lat) > 3 ? Math.sign(th.lat) : 0, hs = (typeof handSign === 'function' ? handSign(p) : 1) || 1;
  let dir = 0, newSide = p.side || 1;
  if (kind === 'drag') { newSide = -(p.side || 1); dir = newSide > 0 ? hs : -hs; }   // over to the other side (dir: which way the puck moves)
  let lat = null;
  if (kind === 'spin') {                                                  // roll off to the side away from the hitter (open ice if he's dead on)
    const hit = spinThreat(p), r = { x: -head.y, y: head.x };
    let side = 0;
    if (hit) { const l = (hit.x - p.x) * r.x + (hit.y - p.y) * r.y; if (Math.abs(l) > 1.5) side = -Math.sign(l); }
    if (!side) side = Math.sign((CX - p.x) * r.x) || -(thSide || hs);
    dir = side; lat = { x: r.x * side, y: r.y * side };
  }
  if (!startDeke(p, dir, kind)) return;
  if (lat) { p.dkMove.lat = lat; p.dkMove.rolled = 0; p.dkMove.head = { x: head.x, y: head.y }; }
  if (kind === 'drag' && hasPuck(p)) {                                    // the toe drag cuts: a sudden new angle, the way the puck went
    const r = rightOf(p), c = DEKES.drag.cut * (0.8 + A(p, 'stk') * 0.04);
    p.vx += r.x * dir * c; p.vy += r.y * dir * c;
  }
  p.tapHead = head; p.tapDkT = p.dkMove.dur;
  p.side = newSide; p.dkAi = 0;
  p.dkTarget = sideOff(p);                                                  // (the dangle steers its own path in tickDeke)
  if (kind === 'spin') { p.vx *= DEKES.spin.entry; p.vy *= DEKES.spin.entry; }
  floaters.push({ x: p.x, y: p.y - 36, text: DEKES[kind].name, life: 26, color: DEKES[kind].label });
}
// lateral unit vector to the skater's RIGHT, from his facing
const rightOf = p => ({ x: -p.fy, y: p.fx });
// how hard he keeps skating along his line during a deke: full drive while any key still points forward along it
// (so a deke never costs momentum), otherwise he carries the speed he already had
function dekeDrive(p, head, ix, iy) {
  const fwd = ix * head.x + iy * head.y;
  if (fwd > 0.3 || (p.vx * head.x + p.vy * head.y) > baseSpeed(p) * 0.7) return 1;
  return Math.max(head.m, Math.min(1, hyp(p.vx, p.vy) / baseSpeed(p) + 0.15));
}
function humanDeke(p, ix, iy) {
  if (!p.dkHead) {
    const sp = hyp(p.vx, p.vy);
    p.dkHead = sp > 0.4 ? { x: p.vx / sp, y: p.vy / sp, m: Math.min(1, sp / baseSpeed(p) + 0.1) } : { x: p.fx, y: p.fy, m: 0 };
    p.dkLast = 0;
  }
  // keep skating roughly along the line you were on
  const dm = dekeDrive(p, p.dkHead, ix, iy);
  p.inx = p.dkHead.x * dm; p.iny = p.dkHead.y * dm;
  if (dm > 0) { p.fx = p.dkHead.x; p.fy = p.dkHead.y; }
  const r = rightOf(p), lat = ix * r.x + iy * r.y;       // input measured against the skater, not the screen
  const dir = lat > 0.3 ? 1 : lat < -0.3 ? -1 : 0;
  if (dir && dir !== p.dkLast) startDeke(p, dir);
  p.dkLast = dir;
  // the move holds the puck out wide briefly, then it comes back to the middle (press again for another move)
  if (hasPuck(p)) p.dkTarget = dir && p.dkMove ? dir * DEKE_REACH : 0;
}
function startDeke(p, dir, kind = 'drag') {
  if (p.dkCd > 0) return false;                               // too soon after the last move
  const stk = A(p, 'stk'), stam = stamOf(p), spdFrac = hyp(p.vx, p.vy) / Math.max(0.5, baseSpeed(p));
  // risk grows with rapid repeats, fatigue and flat-out speed; good hands keep it under control
  let risk = 0.006 + Math.max(0, (p.dkSpam || 0) - 0.6) * 0.06 + Math.max(0, 0.45 - stam / 100) * 0.3 + Math.max(0, spdFrac - 0.85) * 0.35 - (stk - 5) * 0.008;
  risk = clamp(risk, 0.004, 0.65);
  p.dkSpam = (p.dkSpam || 0) + 1;
  p.dkCd = Math.max(8, Math.round(19 - stk * 0.9 + p.dkSpam * 4));
  // a "read": the move started while a defender was visibly winding up a poke or check at you
  const read = teamSkaters(1 - p.team).some(o => o.windUp && o.windUp.target === p);
  p.dkMove = { dir, kind, t: 0, dur: Math.round((24 - stk * 0.6) * DEKES[kind].dur) + (read ? 6 : 0), read };   // the window in which a poke or check can be beaten
  p.dkVuln = 26; p.dkFake = 6; p.lastDkT = S.t; p.lastDkKind = kind; if (typeof SETUP !== "undefined") SETUP.dekeT[p.team] = S.t;
  if (MS && p.pl) MS.stam[p.pl.id] = clamp((MS.stam[p.pl.id] ?? 100) - 1.3 * (1.4 - A(p, 'sta') * 0.08), 0, 100);
  sfx.dribble(); setTimeout(() => sfx.dribble(), 60);
  if (MS && p.pl) MS.dekes = (MS.dekes || 0) + (p.team === 0 ? 1 : 0);
  // the goalie reads the move (or bites on it)
  const g = goalies[1 - p.team];
  if (g && S.phase !== 'faceoff') gkNoteDeke(p, dir, kind);              // the goalie doesn't roll a die: he watches (and remembers) the move
  if (Math.random() < risk) {                                 // lost the handle
    const r = rightOf(p);
    const fd = dir || 0, fw = dir ? 0 : 1.2;
    releasePuck(p, p.vx * 0.6 + r.x * fd * 1.4 + p.fx * fw, p.vy * 0.6 + r.y * fd * 1.4 + p.fy * fw, 22);
    p.slow = 22; p.dkTarget = 0; p.dkOff = 0; p.dkHead = null; p.side = 1;
    floaters.push({ x: p.x, y: p.y - 30, text: 'FUMBLE!', life: 40, color: '#ff7a6e' });
    if (MS && p.pl) { pst(p.pl, p.team).gv++; if (typeof chillEv === 'function') chillEv(p, 'gv'); }
    say(['HE LOSES THE HANDLE!', 'TOO CUTE! HE COUGHS IT UP!'], 1, 0.6);
    return false;
  }
  return true;
}
function tickDeke(p) {
  if (p.dkCd > 0) p.dkCd--;
  if (p.dkVuln > 0) p.dkVuln--;
  if (p.dkFake > 0) p.dkFake--;
  if (p.dkSpam) p.dkSpam = Math.max(0, p.dkSpam - 0.011);
  if (p.dkMove) {
    const mv = p.dkMove; mv.t++;
    if (mv.kind === 'dangle' && hasPuck(p)) {                              // quick hands: over to the other side and back
      const q = mv.t / mv.dur, here = sideOff(p), other = (p.side || 1) < 0 ? 0 : -((typeof handSign === 'function' ? handSign(p) : 1) || 1) * BACKHAND_OFF;
      p.dkTarget = q < 0.45 ? other : here;
      if (mv.t === Math.round(mv.dur * 0.35)) dangleJuke(p);               // the fake sells: the man in front bites
      if (mv.t === mv.dur) { p.vx += p.fx * DEKES.dangle.burst; p.vy += p.fy * DEKES.dangle.burst; }
    }
    if (mv.kind === 'spin' && mv.lat && mv.t <= mv.dur) {                   // the roll: most of the sideways move early, while the hit is coming
      const q = Math.min(1, mv.t / (mv.dur * DEKES.spin.window)), e = 1 - (1 - q) * (1 - q), want = DEKES.spin.side * e, step = want - mv.rolled;
      p.x += mv.lat.x * step; p.y += mv.lat.y * step; mv.rolled = want;
    }
    if (mv.t > mv.dur + 6) p.dkMove = null;
  }
  if (p.dkAi > 0) { p.dkAi--; if (!p.dkAi) p.dkTarget = sideOff(p); }
  if (!hasPuck(p)) { p.dkTarget = 0; p.dkOff = 0; p.side = 1; return; }
  const tgt = p.dkTarget || 0, cur = p.dkOff || 0;
  const rate = 0.2 + A(p, 'stk') * 0.02 - (stamOf(p) < 30 ? 0.06 : 0);
  p.dkOff = Math.abs(tgt - cur) < 0.05 ? tgt : cur + (tgt - cur) * rate;
}
// a deke near the net: weaker or more aggressive goalies may commit to the first move
function goalieTendency(g) { const id = g && g.pl ? g.pl.id : 'x'; let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 3; }  // 0 calm, 1 balanced, 2 aggressive
function goalieReadsDeke(g, p, dir) {
  if (g.down > 0 || g.gLunge > 0 || hasPuck(g)) return;
  const read = A(g, 'pos') * 0.6 + A(g, 'ref') * 0.4, aggr = goalieTendency(g);
  const bite = clamp(0.5 - (read - 5) * 0.08 + (aggr === 2 ? 0.12 : aggr === 0 ? -0.08 : 0) + (A(p, 'stk') - 5) * 0.04, 0.08, 0.85);
  const r = rightOf(p);
  if (Math.random() < bite) {
    g.bite = { x: clamp(p.x + r.x * dir * 26, CX - 20.7, CX + 20.7), t: Math.round(30 - A(g, 'rec') * 1.6) };
    if (dist(p, g) < 60) floaters.push({ x: g.x, y: g.y - 34, text: 'BIT ON IT!', life: 35, color: '#9fd0ff' });
  } else g.bite = { x: clamp(puck.x + r.x * dir * 6, CX - 15, CX + 15), t: 8 };   // reads it and just slides across
}

// ====================================================================
//  GOALIE WITH THE PUCK (yours): skate a little, aim, tap or charge a pass, or cover it
// ====================================================================
const GOALIE_HOLD_FRAMES = 60 * 5, GOALIE_WARN_FRAMES = 60 * 3;
const goalieSafe = g => hyp(g.x - CX, g.y - ownGoalY(g.team)) <= 50;      // inside this, nobody may touch him
function thinkGoalieHuman(p) {
  let ix = (KR() ? 1 : 0) - (KL() ? 1 : 0), iy = (KD() ? 1 : 0) - (KU() ? 1 : 0);
  if (ix && iy) { ix *= Math.SQRT1_2; iy *= Math.SQRT1_2; }
  const pressed = input.passPressed || input.spacePressed || input.shiftPressed;
  const cover = input.coverPressed;
  input.spacePressed = input.shiftPressed = input.passPressed = input.pokePressed = input.coverPressed = input.linePressed = false;
  const held = Input.down('pass') || Input.down('shoot') || Input.down('check');
  p.gpT = (p.gpT || 0) + 1;
  if (!p.gAim) p.gAim = { x: 0, y: attackDir(p.team) };
  if (cover) return coverPuck(p);
  if (p.gCharge == null && pressed) p.gCharge = 0;
  if (p.gCharge != null) {
    // aiming: the arrows turn the pass instead of moving the goalie
    p.inx = p.iny = 0;
    if (ix || iy) { const m = hyp(ix, iy); p.gAim = { x: ix / m, y: iy / m }; }
    if (held) { p.gCharge = Math.min(1, p.gCharge + 1 / (54 * SPEEDS[S.speed])); }
    else { goaliePass(p, p.gCharge, p.gAim); return; }
  } else {
    // holding the puck: the arrows aim the pass, and he only edges out of the crease
    if (ix || iy) { const m = hyp(ix, iy); p.gAim = { x: ix / m, y: iy / m }; }
    const creep = hasPuck(p) ? PLAY.gPuckMove : 1;
    p.inx = ix * creep; p.iny = iy * creep;
  }
  p.fx = p.gAim.x; p.fy = p.gAim.y;
  if (p.gpT === GOALIE_WARN_FRAMES) floaters.push({ x: p.x, y: p.y - 36, text: 'PLAY THE BALL!', life: 70, color: '#ffd23f' });
  if (p.gpT >= GOALIE_HOLD_FRAMES) coverPuck(p, true);
}
function goaliePass(g, power, aim) {
  if (!hasPuck(g)) return;
  power = clamp(power || 0, 0, 1);
  // the aim never points back into the net: at worst it runs along the goal line, out toward the boards
  const up = attackDir(g.team); let ax = aim.x, ay = aim.y;
  if (ay * up < 0.12) { ay = 0.12 * up; if (Math.abs(ax) < 0.3) ax = (Math.sign(ax) || (g.x < CX ? -1 : 1)) * 0.6; const m0 = hyp(ax, ay); ax /= m0; ay /= m0; }
  let ang = Math.atan2(ay, ax), target = null;
  {                            // sticky aim: a teammate close to the line you chose gets the pass (wider with the pass assist on)
    let bs = 1e9; const cone = S.assist ? 0.62 : 0.45;
    for (const m of teamSkaters(g.team)) {
      if (m.stun > 0) continue;
      const a = Math.atan2(m.y - g.y, m.x - g.x), d = Math.abs(angDiff(a, ang));
      if (d < cone && d + dist(g, m) * 0.0015 < bs) { bs = d + dist(g, m) * 0.0015; target = m; }
    }
    if (target) { const lead = dist(g, target) / 6 * 0.8; ang = Math.atan2(target.y + target.vy * lead - puck.y, target.x + target.vx * lead - puck.x); }
  }
  const speed = (2.2 + power * 6.2) * (0.92 + A(g, 'reb') * 0.016);
  const spray = (0.03 + power * 0.15) * (1.35 - A(g, 'pos') * 0.07);       // hard passes are less accurate
  ang += gauss() * spray;
  releasePuck(g, Math.cos(ang) * speed, Math.sin(ang) * speed, 24); puck.deliberate = g;
  puck.passFrom = g; puck.passTarget = target; puck.shotTeam = null; puck.iceTeam = ownHalf(g) ? g.team : null;
  g.gCharge = null; g.gpT = 0; g.hold = 0; g.passCd = 30;
  sfx.pass();
}
function coverPuck(g, forced) {
  if (!hasPuck(g) || S.phase !== 'live') return;
  // SOCCER: no stoppage for a keeper holding the ball: he punts it upfield (toward a teammate if there's one to find)
  { const mate = bestPassTarget(g, 0, attackDir(g.team)), d = mate ? dist(mate, g) || 1 : 1;
    if (forced) floaters.push({ x: g.x, y: g.y - 34, text: 'HELD TOO LONG', life: 60, color: '#ffd23f' });
    say(['THE KEEPER LAUNCHES IT UPFIELD.', 'A BIG KICK DOWNFIELD FROM THE KEEPER.', 'HE GETS RID OF IT, LONG.'], 1, 0.4);
    goaliePass(g, mate ? clamp(d / 420, 0.25, 0.7) : 0.55, mate ? { x: (mate.x - g.x) / d, y: (mate.y - g.y) / d } : { x: rand(-0.35, 0.35), y: attackDir(g.team) });
    if (!puck.owner) { puck.h = 0.5; puck.vh = 2.4; puck.loftT = S.t; }   // a punt: up in the air
    return; }
  g.covering = 70; g.gCharge = null; g.gpT = 0; g.inx = g.iny = 0; g.vx = g.vy = 0;
  if (forced) floaters.push({ x: g.x, y: g.y - 34, text: 'HELD TOO LONG', life: 60, color: '#ffd23f' });
  say(forced ? ['THE KEEPER HANGS ON TOO LONG... WHISTLE.'] : ['HE COVERS IT UP. WHISTLE.', 'THE KEEPER FREEZES THE BALL.', 'SMOTHERED. WE\'LL HAVE A KICKOFF.'], 1, 0.7);
  const end = isUp(g.team) ? END_DOT_Y[1] : END_DOT_Y[0];
  whistle('COVERED', TEAM[g.team].abbr + ' KEEPER FREEZES IT', () => setupFaceoff(CX + (g.x < CX ? -DOT_DX : DOT_DX), end), 90);
}
// AI goalie with the puck: pass now, wait for a lane, slide a step, or freeze it
function thinkGoalieAIPuck(p) {
  const t = p.team;
  p.gpT = (p.gpT || 0) + 1;
  p.fx = 0; p.fy = attackDir(t);
  let nd = 1e9; for (const o of teamSkaters(1 - t)) nd = Math.min(nd, dist(o, p));
  const pressure = nd < 34 ? 1 : nd < 64 ? 0.5 : 0;
  const tend = goalieTendency(p);
  const mate = bestPassTarget(p, 0, attackDir(t));
  const open = mate && teamSkaters(1 - t).every(o => dist(o, mate) > 24);
  const lead = (S.score[t] - S.score[1 - t]);
  const late = S.period >= 3 && S.clock < 40;
  // a little slide toward the side where the outlet is
  p.inx = mate ? clamp((mate.x - p.x) * 0.02, -0.4, 0.4) : 0; p.iny = 0;
  if (S.phase !== 'live' || p.gpT % 6) return;
  if (p.fetched) {                         // stopped their clear: get it up ice to a teammate right away
    if (mate && (open || p.gpT > 12)) return pass(p);
    if (p.gpT > 40) return mate ? pass(p) : coverPuck(p);
    return;
  }
  const quick = tend === 2 ? 14 : tend === 0 ? 30 : 22;
  if (pressure >= 1 && p.gpT > 10) {
    if (Math.random() < 0.55 + (tend === 0 ? 0.2 : tend === 2 ? -0.25 : 0) + (lead > 0 && late ? 0.25 : 0)) return coverPuck(p);
    if (mate) return pass(p);
  }
  if (lead > 0 && late && p.gpT > 30 && Math.random() < 0.4) return coverPuck(p);     // protecting a late lead
  if (open && p.gpT > quick) return pass(p);
  if (p.gpT > 120) return mate && Math.random() < 0.6 ? pass(p) : coverPuck(p);
}
// teamPlan(t) lives in tactics.js (strategies, power play / penalty kill shapes, predictive coverage)

// Each possession the carrier picks an approach from his ratings: a power shooter often lets it go from distance,
// a quick accurate skater drives the net, a playmaker cuts across the slot. He never parks: if progress stalls he
// shoots, passes or changes lanes. Charging slows him down (100% charge = standing still), so wind-ups are timed.
function newAttackPlan(p) {
  const cd = typeof lever === 'function' ? lever(p.team, 'drive', 0) : 0;      // Crash the Net: take it to the net, not the long shot
  // more ways to attack: the long shot, driving the net, cutting across, a wrister off the faceoff circle, carrying it
  // down the half wall to set up a one-timer, or taking it low (behind the net: wraparound or a pass out front).
  // Picked from his ratings with a good dose of chance, so the same player doesn't always do the same thing.
  const w = { long: A(p, 'pow') - cd, drive: (A(p, 'spd') + A(p, 'acc')) / 2 + cd - 0.5, lateral: (A(p, 'acc') + A(p, 'pas')) / 2,
    circle: (A(p, 'acc') + A(p, 'stk')) / 2 - 0.5, setup: A(p, 'pas') - 0.3 + (teamSkaters(p.team).length > 2 ? 0.3 : -3), low: (A(p, 'stk') + A(p, 'spd')) / 2 - 1.8 + cd * 0.5 };
  const ks = Object.keys(w), ew = ks.map(k => Math.exp(w[k] / 1.6)), sum = ew.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum, style = ks[0]; for (let i = 0; i < ks.length; i++) { r -= ew[i]; if (r <= 0) { style = ks[i]; break; } }
  const side = Math.random() < 0.5 ? -1 : 1;
  return { style, side, crossed: false, shootDist: style === 'long' ? rand(115, 160) : style === 'drive' ? rand(45, 80) : style === 'circle' ? rand(80, 112) : style === 'setup' ? rand(60, 90) : style === 'low' ? rand(40, 60) : rand(70, 105),
    t: 0, stallT: 0, lastD: 1e9, passEval: (Math.random() * 20) | 0 };
}
function thinkCarrierAI(p) {
  const t = p.team, up = attackDir(t), gy = oppGoalY(t), D = DIFF[S.diff];
  const pen = S.phase === 'penalty';
  if (!p.plan || p.plan.owner !== puck.owner) { p.plan = newAttackPlan(p); p.plan.owner = p; }
  const P = p.plan; P.t++;
  const brk0 = (p.y - gy) * up < -14 && teamSkaters(1 - t).every(o => o.stun > 0 || hyp(o.x - CX, o.y - gy) > hyp(CX - p.x, gy - p.y) + RK(8));   // a breakaway: the change can wait
  if (p.chgOut && !p.g && S.phase === 'live' && P.t > 10 && !brk0) {              // caught a pass mid-change: move it on, then off he goes
    const fresh = teamSkaters(t).filter(m => m !== p && !m.chgOut && m.stun <= 0);
    if (fresh.length) { const m = fresh.sort((a, b) => ((b.y - p.y) * up - dist(b, p) * 0.3) - ((a.y - p.y) * up - dist(a, p) * 0.3))[0];
      const dx = m.x - p.x, dy = m.y - p.y, dd = hyp(dx, dy) || 1; p.chgRush = true;
      if (pass(p, 0, { x: dx / dd, y: dy / dd }) !== false) return; }
  }
  { const ahead = teamSkaters(1 - t).filter(o => (o.y - p.y) * up > -6 && dist(o, p) < 46).length;   // the carrier: open ice ahead, he turns on the jets
    p.sprint = !ahead && stamOf(p) > aiSprintMin(p) + 8 && p.charge < 0; }
  // ONSIDE: carrying it toward the blue line with a teammate still in the zone, hold up outside the line (cut
  // across it) until he has tagged up, instead of carrying it in for an offside
  if (false && S.rules && !pen && !p.g) {   // SOCCER: no offside, so no holding up at the line
    const dl = zoneDepth(t, p.y);
    if (dl < 0 && dl > -80 && offsideMates(t, p).length) {
      const blueY = isUp(t) ? BLUE_TOP : BLUE_BOT;
      let tx, ty;
      ty = blueY - up * 34; tx = Math.abs(p.x - CX) < 40 ? p.x + (p.x < CX ? -50 : 50) : p.x + (p.x < CX ? 25 : -25);
      steerTo(p, tx, ty, 0.75, 6); return;
    }
  }

  const opps = teamSkaters(1 - t).filter(o => o.stun <= 0);
  let nd = 1e9, near = null;
  if (!pen) for (const o of opps) { const d = dist(p, o); if (d < nd) { nd = d; near = o; } }
  // SOCCER: CROSSES. Out wide in the last third with a teammate in the box: float it in for him to head
  if (!pen && !p.g && S.phase === 'live' && P.t > 6 && !(p.charge > 0) && Math.abs(p.x - CX) > PEN_HW - 30 && Math.abs(gy - p.y) < PEN_D + 70) {
    const tgt = teamSkaters(t).filter(m => m !== p && m.stun <= 0 && Math.abs(m.x - CX) < PEN_HW - 8 && Math.abs(m.y - gy) < PEN_D + 12)
      .sort((a, b) => Math.abs(a.y - gy) - Math.abs(b.y - gy))[0];
    if (tgt && Math.random() < (nd < 16 ? AIR.aiCrossPressed : AIR.aiCross) * (S.diff === 'EASY' ? 0.6 : 1)) { crossTo(p, tgt); return; }
  }
  const dgx = CX - p.x, dgy = gy - p.y, dg = hyp(dgx, dgy) || 1;
  const inFront = (p.y - gy) * up < -14;
  // winding up: keep gliding toward the net while the charge (and the slowdown) builds
  if (p.charge >= 0) {
    p.charge = Math.min(1, p.charge + 1 / shotFrames());
    p.fx = dgx / dg; p.fy = dgy / dg;
    p.inx = p.fx; p.iny = p.fy;
    if (p.charge >= p.chargeTarget || nd < 9 || dg < RK(24) || !inFront) shoot(p, p.charge);   // out of room (on top of the goalie, or past the net): let it go now
    return;
  }
  // no shots from outside the offensive zone; from the edge of the box (just inside the blue line) only the best shooters,
  // rarely, and then with everything they have
  const ozDepth = (p.y - (isUp(p.team) ? BLUE_TOP : BLUE_BOT)) * attackDir(p.team);
  const startShot = (target, point) => {
    const pick = aiShotPick(p, target, dg, ozDepth); if (pick == null) return; target = pick.t; if (pick.point) point = true;
    // Crash the Net: from out there, wait (keep working it) until a teammate has got to the net
    if (!pen && !p.g && typeof lever === 'function' && lever(t, 'wait', 0) && dg > RK(70) && P.t < 180 &&
        !teamSkaters(t).some(m => m !== p && hyp(m.x - CX, m.y - gy) < RK(60))) return;
    // screened: a defender is standing in his lane close in front of him, so he often looks to move it instead
    if (!pen && !p.g && !point && typeof screenOf === 'function' && (p.screenHold || 0) <= S.t) {
      const sc = screenOf(p);
      if (sc && sc.along < RK(70) && Math.random() < PLAY.screenWait) { p.screenHold = S.t + 40; if (p.passCd <= 0 && openTeammateAhead(p) && Math.random() < 0.5) pass(p); return; }
    }
    if (!pen && !p.g) {
      if (ozDepth < 0) return;
      if (ozDepth < 34 * RINK_S && !point) {
        if (A(p, 'pow') < 9 || A(p, 'acc') < 8 || Math.random() > 0.12) return;
        target = Math.max(target, 0.88);
      }
    }
    p.charge = 0; p.chargeTarget = clamp(target, 0.05, 0.95);
  };
  // FUNDAMENTALS FIRST (above any system or tempo): a prime look, in close and in front with nobody on him and a lane
  // to the net, gets shot right away with a quick release
  if (!pen && !p.g && inFront && dg < RK(58) && nd > RK(18) && ozDepth > 34 * RINK_S && laneOpen(p, gy) && Math.random() < 0.3) { p.charge = 0; p.chargeTarget = rand(0.05, 0.3); return; }
  // BREAKAWAY (above any pattern or pass): in their zone with every one of their skaters behind him (further from the
  // net than he is), he takes it to the goalie and shoots; no drop pass to a trailer, no cycle
  if (globalThis.BK_ON !== false && !pen && !p.g && ozDepth > 0 && inFront && opps.every(o => o.g || hyp(o.x - CX, o.y - gy) > dg + RK(8))) {
    P.bk = (P.bk || 0) + 1;
    if (dg < RK(52) || (dg < RK(80) && P.bk > 50)) return startShot(dg < RK(35) ? rand(0.05, 0.25) : rand(0.25, 0.55));
    const lane = (P.side || 1) * RK(10);
    steerTo(p, CX + lane, gy - up * RK(28), 1, 6); return;
  }
  // THE POINT SHOT: up top with traffic in front (or on the power play), a big shot through it for the tip or the rebound
  const shotOpen = () => { const dx = CX - p.x, dy = gy - p.y, dd = hyp(dx, dy) || 1; return opps.every(o => { const k = ((o.x - p.x) * dx + (o.y - p.y) * dy) / dd; return k < 0 || k > RK(34) || hyp(o.x - (p.x + dx / dd * k), o.y - (p.y + dy / dd * k)) > 9; }); };   // nobody right in his face to block it
  if (!pen && !p.g && inFront && ozDepth > 0 && zoneFrac(t, p.y) > 0.62 && nd > RK(16) && shotOpen()) {
    const traffic = teamSkaters(t).some(m => m !== p && hyp(m.x - CX, m.y - gy) < RK(55)), pp = activeTactic(t).sit === 'pp';
    const big = A(p, 'pow') >= 5 || (p.pl && isDefPos(p.pl.spos)), mix = (DIFF[S.diff] || DIFF.NORMAL).shotMix ?? 0.7;
    if (big && Math.random() < 0.17 * mix * (traffic ? 1.2 : pp ? 0.8 : 0.35) * (activeTactic(t).key === 'crash' ? 1.8 : activeTactic(t).key === 'shell' ? 0.3 : 1)) return startShot(rand(0.75, 0.95), true);   // with nobody in front it's mostly for the rebound: less often
  }
  if (typeof carrierTactics === 'function' && carrierTactics(p)) return;
  // quick rebound chance
  if (!pen && S.t - (p.rebT || -99) < 30 && inFront && dg < 95 && Math.random() < 0.25) return startShot(rand(0.05, 0.3));
  // progress tracking: if he isn't getting closer, do something
  if (dg < P.lastD - 0.4) { P.lastD = dg; P.stallT = 0; } else P.stallT++;
  // CLEAR ICE: no defender between him and their net (a breakaway, wherever it starts): he takes it himself, no pass back
  const clearIce = !pen && !p.g && inFront && opps.every(o => o.g || hyp(o.x - CX, o.y - gy) > dg + RK(8));
  if (P.stallT > 45) {
    P.stallT = 0; P.lastD = dg;
    if (inFront && dg < 170) return startShot(rand(0.15, 0.55));
    if (!pen && !clearIce && p.passCd <= 0 && pass(p) !== false && !hasPuck(p)) return;
    P.side = -P.side; P.crossed = false;
  }
  // early long-range attempts from big shooters
  if (inFront && dg < 170 && dg > P.shootDist && A(p, 'pow') >= 7 && Math.random() < 0.004 * (A(p, 'pow') - 5)) return startShot(rand(0.55, 0.9));
  // in range for this plan: let it go (harder wind-up from further out, quick release in tight)
  // a shot from way out only makes sense with traffic in front (a screen, a man for the rebound) or a real cannon;
  // otherwise keep carrying it in
  if (!pen && P.style === 'long' && !P.kept && inFront && dg <= P.shootDist && dg > RK(100) && A(p, 'pow') < 8 && !teamSkaters(t).some(m => m !== p && hyp(m.x - CX, m.y - gy) < RK(60))) { P.kept = true; if (Math.random() < 0.5) { P.style = Math.random() < 0.5 ? 'drive' : 'circle'; P.shootDist = P.style === 'drive' ? rand(45, 80) : rand(80, 112); } }
  // set-up plays: at the half wall (or low behind the net) look for a teammate in the slot for a one-timer first
  if (!pen && (P.style === 'setup' || P.style === 'low') && p.passCd <= 0 && (P.style === 'setup' ? Math.abs(p.x - CX) > 60 && dg < 120 : !inFront || dg < 60)) {
    const slot = teamSkaters(t).filter(m => m !== p && !m.chgOut && m.stun <= 0 && hyp(m.x - CX, m.y - (gy - up * 70)) < RK(55)).sort((a, b) => nearestOpp(b)[1] - nearestOpp(a)[1])[0];
    if (slot && nearestOpp(slot)[1] > 16 && Math.random() < 0.12) { const dx = slot.x - p.x, dy = slot.y - p.y, dd = hyp(dx, dy) || 1; if (pass(p, 0, { x: dx / dd, y: dy / dd }) !== false && !hasPuck(p)) return; }
    if (P.t > 150 && Math.random() < 0.02) { P.style = 'drive'; P.shootDist = rand(45, 80); }
  }
  if (inFront && dg <= P.shootDist) {
    // (Nov 22 AI pass) HARD reads the ice before a low-percentage shot: from outside the slot, a teammate open in the slot
    // gets the puck instead (a one-timer or a quick shot from the good ice). Normal and Easy shoot what they planned.
    if (!pen && !p.g && cpuT(t) && S.diff === 'HARD' && dg > RK(85) && p.passCd <= 0 && !P.slotLook) {
      P.slotLook = true;
      const slot = teamSkaters(t).filter(m => m !== p && !m.chgOut && !(m.stun > 0) && hyp(m.x - CX, m.y - (gy - up * RK(50))) < RK(38)).sort((a, b) => nearestOpp(b)[1] - nearestOpp(a)[1])[0];
      if (slot && nearestOpp(slot)[1] > RK(17) && Math.random() < HARD_SLOT_LOOK) { const dx = slot.x - p.x, dy = slot.y - p.y, dd = hyp(dx, dy) || 1; if (pass(p, 0, { x: dx / dd, y: dy / dd }) !== false && !hasPuck(p)) return; }
    }
    if (P.style === 'lateral' && !P.crossed) { /* finish the cut first */ }
    else if (pen) { if (dg < 70 || Math.random() < 0.03) return startShot(dg > 70 ? rand(0.5, 0.8) : rand(0.15, 0.4)); }
    else return startShot(nd < 22 ? rand(0.05, 0.3) : P.style === 'long' ? rand(0.55, 0.9) : P.style === 'drive' ? rand(0.15, 0.45) : rand(0.3, 0.6));
  }
  // a clear shooting lane is worth a try even before the planned spot
  if (!pen && inFront && dg < 150 && laneOpen(p, gy) && Math.random() < (dg < 95 ? 0.022 : 0.009) * (0.7 + aiD(p.team).shoot * 25) * (typeof lever === 'function' ? lever(1 - p.team, 'shotsAgainst') : 1) * (typeof shortHanded === 'function' && shortHanded(1 - p.team) ? PP_EDGE.shoot : 1)) return startShot(dg > 110 ? rand(0.45, 0.85) : rand(0.2, 0.55));
  // under pressure: get a quick shot away, or move it to an open teammate
  if (!pen && !clearIce && p.passCd <= 0) {
    P.passEval = (P.passEval + 1) % 20;
    const pressure = nd < 22;
    if (pressure && inFront && dg < 140 && Math.random() < 0.04) return startShot(rand(0.05, 0.3));
    if ((pressure && Math.random() < 0.018 * (A(p, 'pas') / 5) && openTeammateAhead(p, true)) || (P.passEval === 0 && openTeammateAhead(p) && Math.random() < 0.25 * (A(p, 'pas') / 6))) { pass(p); if (!hasPuck(p)) return; }
  }
  // the AI's dangle and spin-o-rama (Nov 22): none on EASY, some on NORMAL, the most on HARD (AI_DEKE)
  if (p.aiDShot && p.dkMove && p.dkMove.kind === 'dangle' && p.dkMove.t >= p.dkMove.dur * 0.4) { p.aiDShot = false; return startShot(rand(0.05, 0.3)); }   // the fake sold: snap it
  if (!pen && p.dkCd <= 0 && !p.dkAi && !p.dkMove && typeof humanDekeMove === 'function') {
    const lv = AI_DEKE[S.autoAI ? 'NORMAL' : S.diff] || 0;
    if (lv) {
      const hit = spinThreat(p), coming = hit && ((hit.lunge > 0 && hit.checkTarget === p) || (hit.windUp && hit.windUp.target === p && hit.windUp.kind === 'check'));
      if (coming && S.t - (p.aiSpinT || -999) > 45) {
        p.aiSpinT = S.t;
        if (Math.random() < AI_DEKE.spin * lv * A(p, 'stk') / 5) { humanDekeMove(p, 'spin'); if (!hasPuck(p)) return; }
      } else if (near && inFront && dg < AI_DEKE.dangleZone && nd > 18 && nd < 40 && (near.x - p.x) * dgx + (near.y - p.y) * dgy > 0 && !near.windUp && Math.random() < AI_DEKE.dangle * lv * A(p, 'stk') / 5) {   // in close, a man in front: fake him, then shoot
        humanDekeMove(p, 'dangle'); p.aiDShot = true; if (!hasPuck(p)) return;
      }
    }
  }
  // stickhandling: pull the puck away from a defender reaching in, or fake the goalie in tight
  if (p.dkCd <= 0 && !p.dkAi) {
    const g = gk(1 - t), dgk = dist(p, g);
    if (near && nd < 26 && (near.x - p.x) * dgx + (near.y - p.y) * dgy > 0 && Math.random() < 0.05 * A(p, 'stk') / 5) {
      const r = rightOf(p), side = Math.sign((near.x - p.x) * r.x + (near.y - p.y) * r.y) || 1;
      if (startDeke(p, -side)) { p.dkTarget = -side * DEKE_REACH; p.dkAi = 20; }
      if (!hasPuck(p)) return;
    } else if (inFront && dgk < 55 && Math.random() < 0.03 * A(p, 'stk') / 5) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      if (startDeke(p, dir)) { p.dkTarget = dir * DEKE_REACH; p.dkAi = 16; }
      if (!hasPuck(p)) return;
    }
  }
  // where to skate this frame
  let tx, ty;
  if (!inFront && !pen && wrapPosition(p) && Math.random() < 0.035 * A(p, 'stk') / 5) { tryWrap(p); return; }
  if (!inFront) { tx = CX + P.side * 60; ty = gy - up * 45; }                           // behind the net: come out front
  else if (P.style === 'lateral') {
    const laneX = CX + (P.crossed ? -P.side : P.side) * 34;
    if (!P.crossed && dg < P.shootDist + 30) { P.crossed = true; }
    tx = laneX; ty = gy - up * Math.max(P.shootDist * 0.75, 40);
    if (P.crossed && Math.abs(p.x - laneX) < 10) P.style = 'drive', P.shootDist = Math.max(P.shootDist, dg - 5);
  } else if (P.style === 'drive') { tx = CX + P.side * 14; ty = gy - up * 26; }
  else if (P.style === 'circle') { tx = CX + P.side * 52; ty = gy - up * (P.shootDist - 8); }               // to the top of the faceoff circle
  else if (P.style === 'setup') { tx = CX + P.side * 92; ty = gy - up * 62; }                               // down the half wall
  else if (P.style === 'low') { tx = CX + P.side * 70; ty = gy + up * 6; }                                  // below the goal line, toward the corner
  else { tx = CX + P.side * 30; ty = gy - up * (P.shootDist - 10); }
  // react to the nearest defender: swerve around him when he is in the lane
  if (near && nd < 40) {
    const ax = near.x - p.x, ay = near.y - p.y;
    if ((ax * dgx + ay * dgy) > 0) { const sd = (ax * dgy - ay * dgx) > 0 ? -1 : 1; tx += -dgy / dg * sd * 40; ty += dgx / dg * sd * 40; }
  }
  // always keep skating at full urgency (no slow arrival = no stopping in front of the goalie)
  const dx = tx - p.x, dy = ty - p.y, d = hyp(dx, dy);
  if (d < 6) { P.side = -P.side; tx = CX + P.side * 30; }
  steerTo(p, tx, ty, 1, 2);
}
// AI SHOT SELECTION: the type of shot fits the moment (and the team's tactic), not one shot for everything.
//  off a deke: a quick release · in tight: quick (forehand or backhand) · up top with traffic or on the power play:
//  the slapshot · off the rush, in stride: the snap · Crash the Net: shots from distance for rebounds · the Shell:
//  doesn't waste one from out there with nobody in front. Easy teams mostly keep it simple (DIFF.shotMix)
function aiShotPick(p, target, dg, ozDepth) {
  if ((p === ctrl && !S.autoAI) || p.g || S.so || S.phase === 'penalty') return { t: target };
  const mix = (DIFF[S.diff] || DIFF.NORMAL).shotMix ?? 0.7; if (Math.random() > mix) return { t: target };
  const t = p.team, tac = activeTactic(t), tempo = typeof lineTempo === 'function' ? lineTempo(t) : 'mixed', gy = oppGoalY(t);
  const traffic = teamSkaters(t).some(m => m !== p && hyp(m.x - CX, m.y - gy) < RK(42)), sp = hyp(p.vx, p.vy) / Math.max(0.5, baseSpeed(p)), fr = zoneFrac(t, p.y), pp = tac.sit === 'pp';
  if (S.t - (p.lastDkT || -999) < SHOTX.dekeWin && dg < RK(120)) return { t: rand(0.05, 0.25) };                       // off the deke: get it away now
  if (dg < RK(55)) return { t: Math.random() < 0.35 ? rand(0.32, 0.5) : rand(0.05, 0.28) };                              // in tight: quick, or a snap
  if (fr > 0.62 && (traffic || pp || target >= 0.75) && (A(p, 'pow') >= 5 || (p.pl && isDefPos(p.pl.spos)))) return { t: rand(0.75, 0.95), point: true };   // the point, through traffic
  if (tac.key === 'shell' && dg > RK(110) && !traffic) return null;                                                     // the Shell picks its spots
  if (tac.key === 'crash' && dg > RK(85)) return { t: rand(0.55, 0.9), point: fr > 0.62 };                                // Crash: get it on net from out there
  if ((tempo === 'rush' || tac.key === 'counter') && sp > 0.55) return { t: rand(0.35, 0.62) };                         // off the rush: the snap, in stride
  if (tempo === 'cycle' && dg < RK(95)) return { t: Math.random() < 0.6 ? rand(0.05, 0.28) : rand(0.35, 0.55) };       // the cycle: quick looks from in close
  return { t: dg > RK(100) ? (Math.random() < 0.55 ? rand(0.35, 0.6) : rand(0.6, 0.85)) : (Math.random() < 0.5 ? rand(0.05, 0.28) : rand(0.35, 0.6)) };
}
function openTeammateAhead(p, anyOpen) {
  const t = p.team, up = attackDir(t), gy = oppGoalY(t);
  const opps = teamSkaters(1 - t);
  return teamSkaters(t).some(m => m !== p && m.stun <= 0 && (anyOpen || (Math.abs(gy - m.y) < Math.abs(gy - p.y) - 25 && (m.y - gy) * up < -14)) &&
    opps.every(o => dist(o, m) > 26));
}
// no defender standing in the line between the carrier and the net
function laneOpen(p, gy) {
  const dx = CX - p.x, dy = gy - p.y, d2 = dx * dx + dy * dy || 1;
  return teamSkaters(1 - p.team).every(o => { const t = clamp(((o.x - p.x) * dx + (o.y - p.y) * dy) / d2, 0, 1); return hyp(o.x - (p.x + dx * t), o.y - (p.y + dy * t)) > 10; });
}
// THE COMPUTER SPRINTS TOO (it used to only sprint to get back onside): racing for a loose puck, backchecking behind
// a rush, or carrying into open ice; never when it's gassed (Hard keeps going a little longer than Normal; Easy
// opponents don't sprint at you)
function aiSprintMin(p) { const human = !S.autoAI && cpuT(p.team); return human ? (S.diff === 'EASY' ? 999 : S.diff === 'HARD' ? 32 : 42) : 38; }
function aiWantsSprint(p) {
  const st = stamOf(p), min = aiSprintMin(p); if (st < min) return false;
  const own = oppGoalY(1 - p.team), o = puck.owner;
  if (!o && !puck.passTarget) {                                         // a loose puck: the nearest man on each team races for it
    const near = teamSkaters(p.team).filter(m => m.stun <= 0).sort((a, b) => dist(a, puck) - dist(b, puck))[0];
    return near === p && dist(p, puck) > 28;
  }
  if (o && o.team !== p.team && !o.g) {                                 // backcheck: he's behind the carrier, who is heading for our net
    const carrierToGoal = Math.abs(o.y - own), meToGoal = Math.abs(p.y - own), heading = (o.vy * Math.sign(own - o.y)) > 0.6;
    return heading && meToGoal > carrierToGoal - 8 && dist(p, o) > 20;
  }
  if (o && o.team === p.team && o !== p) return Math.abs(p.y - oppGoalY(p.team)) > Math.abs(o.y - oppGoalY(p.team)) + 45;   // catching up to join the rush
  return false;
}
function thinkAI(p, plan) {
  if (p.stun > 0) { p.inx = p.iny = 0; return; }
  // a teammate's pass on its way to him comes first, even in the middle of a line change: turn round and take it
  // (then he moves it on and gets off as fast as he can: see changeTick / thinkCarrierAI)
  if (p.chgOut && puck.passTarget === p && !puck.owner && puck.passFrom && puck.passFrom.team === p.team && S.phase === 'live') { p.chgRush = true; receiverMove(p); return; }
  if (p.chgOut && p.chgGo && !hasPuck(p)) {          // line change: head for the bench's off-gate (only once it's safe)
    const G = benchGates(p.team), D = p.exitDoor || G.off, gy = clamp(p.y, D.y0 + 4, D.y1 - 4);   // the nearer door (changeTick)
    p.sprint = !!p.chgRush && stamOf(p) > 8; steerTo(p, R.l + 4, gy, 1, 4); return;   // (after playing a pass: flat out)
  }
  if (cpuT(p.team) && S.cpuDelay > 0 && !(S.autoAI && S.foWinner === p.team)) { p.inx = p.iny = 0; return; }
  if (hasPuck(p)) return thinkCarrierAI(p);
  if (p.charge >= 0) p.charge = -1;                     // lost it mid wind-up: the shot is gone
  if (puck.passTarget === p && !puck.owner && puck.passFrom && puck.passFrom.team === p.team && S.phase === 'live') { receiverMove(p); return; }
  const g = plan[p.id];
  if (!g) { p.inx = p.iny = 0; return; }
  p.sprint = (!!g.hurry && stamOf(p) > 25) || aiWantsSprint(p);   // racing to get onside with the attack, or the situations above
  // standing in the zone with the puck still outside it (his own team carrying it up): tag up, at full speed
  const oursNow = puck.owner ? puck.owner.team === p.team : (puck.passTarget ? puck.passTarget.team === p.team : !!(puck.lastTouch && puck.lastTouch.team === p.team));
  if (S.rules && oursNow && zoneDepth(p.team, puck.y) < 0 && zoneDepth(p.team, p.y) > -6) {
    const blueY = isUp(p.team) ? BLUE_TOP : BLUE_BOT;
    p.sprint = stamOf(p) > 15; steerTo(p, p.x, blueY - attackDir(p.team) * 16, 1, 4); return;
  }
  { const wp = netDetour(p, g.x, g.y); steerTo(p, wp.x, wp.y, g.u, wp.x !== g.x || wp.y !== g.y ? 4 : g.loose ? 4 : 18); }
  if (g.chase && g.chase.g) {          // never hit a goalie; poke only if he wandered out with it
    const c = g.chase, d = dist(p, c);
    if (!goalieSafe(c) && d < 22 && p.cd <= 0 && Math.random() < 0.06) { p.fx = (c.x - p.x) / (d || 1); p.fy = (c.y - p.y) / (d || 1); pokeCheck(p); }
    return;
  }
  if (p.windUp) {                                  // telegraphed challenge: lean in, then go
    const w = p.windUp, c = w.target;
    if (!c || !hasPuck(c) || p.stun > 0) { p.windUp = null; return; }
    const d = dist(p, c) || 1; p.fx = (c.x - p.x) / d; p.fy = (c.y - p.y) / d;
    if (w.kind === 'check') steerTo(p, c.x + c.vx * 6, c.y + c.vy * 6, 1, 4); else { p.inx *= 0.5; p.iny *= 0.5; }   // a hit wind-up keeps closing (the '!' is the tell); a poke settles
    if (--w.t <= 0) {
      // a telegraphed HIT keeps coming until he's really in reach (up to 15 frames more, the '!' still showing): the tell
      // is your chance to read it and get out of the way, not a reason for the check to fall short
      if (w.kind === 'check' && d > TAC_BAL.checkReach + 2 && (w.ext = (w.ext || 0) + 1) <= 15) { w.t = 1; return; }
      p.windUp = null;
      if (w.kind === 'poke' && d < 30) { const ax = puck.x + (puck.vx || 0) * 3 - p.x, ay = puck.y + (puck.vy || 0) * 3 - p.y, ad = hyp(ax, ay) || 1; p.fx = ax / ad; p.fy = ay / ad; pokeCheck(p); }
      else if (w.kind === 'check' && d < 26) { const ok = bodyCheck(p); p.recoverT = 0; if (globalThis.HITDBG) HITDBG[ok ? 'lunge' : 'noTgt']++; }
      else if (w.kind === 'check' && globalThis.HITDBG) HITDBG.outOfReach++;
    }
    return;
  }
  if (g.chase) defenderAct(p, g);
}

// a pass is coming: get onto its line, slow down, and turn the stick side toward the net for a one-timer
function receiverMove(p) {
  const m = passMeetPoint(p), d = hyp(m.x - p.x, m.y - p.y);
  steerTo(p, m.x, m.y, d > 2 ? 1 : 0.6, 4);                       // full effort to be where the puck will arrive
  const gy = oppGoalY(p.team), nx = CX - p.x, ny = gy - p.y, nd = hyp(nx, ny) || 1;
  const ix = puck.x - p.x, iy = puck.y - p.y, id = hyp(ix, iy) || 1;
  const fx = nx / nd * 0.6 + ix / id * 0.4, fy = ny / nd * 0.6 + iy / id * 0.4, fd = hyp(fx, fy) || 1;
  p.fx = fx / fd; p.fy = fy / fd;
  p.rcvSet = d < 8 ? (p.rcvSet || 0) + 1 : Math.max(0, (p.rcvSet || 0) - 1);
}
// POWER PLAY: the killers fire it down the ice to clear it. The goalie leaves his net to stop it (behind the net or out
// front, wherever it is heading) as long as he gets there clearly first, then moves it straight up to a teammate
const BK_REACH = 1.5;   // (Nov 21) balances the computer's breakaway rule so scoring stays where it was
const FETCH = { box: 46, behind: 28, front: 26, margin: 12 };   // only behind the net and the trapezoid: a goalie stops rims, he does not chase pucks out wide
function goalieFetch(p) {
  const t = p.team, gl = ownGoalY(t), sgn = attackDir(t);
  const ok = S.phase === 'live' && !puck.owner && !puck.inNet && !S.so && p.stun <= 0 && p.down <= 0 && p.gLunge <= 0
    && puck.lastTouch && puck.lastTouch.team !== t && !puck.shot;
  // on the power play he goes for any clear he can reach first; at even strength (or killing a penalty) for icings and
  // dump-ins that are on their way behind his net / to the goal line (he plays it before their forward gets there)
  const pp = typeof shortHanded === 'function' && shortHanded(1 - t);
  if (!ok) { if (p.fetch) { p.fetch = null; p.roam = true; } return false; }
  const vy = puck.vy * sgn;                                    // < 0: heading toward our goal line
  if (!p.fetch && (vy > -0.6 || (puck.y - gl) * sgn > 330)) return false;
  // where it will be in k frames (it slows by 1.4% a frame); first point he reaches in time, inside his area
  const spd = Math.max(0.5, speedOf(p)), opps = teamSkaters(1 - t).filter(o => o.stun <= 0);
  let tgt = null;
  for (let k = 4, x = puck.x, y = puck.y, vx = puck.vx, vyy = puck.vy; k <= 150; k += 4) {
    for (let j = 0; j < 4; j++) { x += vx; y += vyy; vx *= BALL_FRIC; vyy *= BALL_FRIC; }
    const dep = (y - gl) * sgn;
    if (Math.abs(x - CX) > FETCH.box || dep < -FETCH.behind || dep > (pp ? FETCH.front : 6)) continue;
    const tg = dist(p, { x, y }) / spd;
    if (tg <= k) { const to = Math.min(...opps.map(o => hyp(o.x - x, o.y - y) / Math.max(0.6, speedOf(o)))); if (to > tg + FETCH.margin) tgt = { x, y }; break; }
  }
  if (!tgt) { if (p.fetch) { p.fetch = null; p.roam = true; } return false; }
  p.fetch = tgt; p.roam = true;
  steerTo(p, tgt.x, tgt.y, 1, 3);
  const d = hyp(puck.x - p.x, puck.y - p.y) || 1; p.fx = (puck.x - p.x) / d; p.fy = (puck.y - p.y) / d;
  return true;
}
// ====================================================================
//  THE GOALIE MODEL: readable and repeatable. He sees the puck a fixed moment late (his reaction time, from his
//  ratings), aggressive goalies read ahead of it (and over-commit on a fake), and he REMEMBERS: every close-in move a
//  shooter makes (his dekes, in order, and where he shot) is stored for the rest of the game. When the same move
//  starts again he is on it sooner and slides early to where that shot went. Saves come from reach (see goalieSave).
// ====================================================================
const GK = { chal: 26, react: 9, reactPer: 0.8, reactMin: 4, antic: [0, 4, 8], memReact: 0.45, memShift: 5, memNear: 120 };
function gkReact(g) { return Math.max(GK.reactMin, Math.round(GK.react - ((A(g, 'pos') + A(g, 'ref')) / 2 - 5) * GK.reactPer)); }
// the move so far: the shooter's dekes since he came in close, as screen left/right (seen from behind the net)
function gkSeq(p) { return (p.gkSig && p.gkSig.dirs) ? p.gkSig.dirs.join('') : ''; }
// where a shooter takes it from with no deke: a coarse spot (side and distance band), so the same shot from the same
// place counts as the same move
function gkSpot(p) { const gy = oppGoalY(p.team), dx = puck.x - CX, d = hyp(dx, puck.y - gy); return 'S' + (dx < -18 ? 'L' : dx > 18 ? 'R' : 'C') + (d < 45 ? 1 : d < 85 ? 2 : 3); }
function gkMemFor(g, p) { return MS && MS.gmem && p && p.pl ? (MS.gmem[g.team][p.pl.id] = MS.gmem[g.team][p.pl.id] || {}) : null; }
// what the goalie expects from this carrier right now: { n: times seen, x: where that shot went } or null
function gkExpect(g, p) {
  const M = gkMemFor(g, p); if (!M) return null;
  const seq = gkSeq(p), keyNow = seq || gkSpot(p);
  let best = null;
  for (const k in M) { const [kseq] = k.split('|'); if ((seq && kseq.startsWith(seq)) || kseq === keyNow) { const m = M[k]; if (!best || m.n > best.n) best = { n: m.n, x: m.x, full: kseq === keyNow }; } }
  return best;
}
// track the carrier's move as he comes in close (called every frame for a carrier near the net)
function gkTrackCarrier(c) {
  const gy = oppGoalY(c.team), near = hyp(c.x - CX, c.y - gy) < GK.memNear && (gy - c.y) * attackDir(c.team) > 0;
  if (!near) { c.gkSig = null; return; }
  if (!c.gkSig) c.gkSig = { dirs: [], t0: S.t };
}
function gkNoteDeke(p, dir, kind = 'drag') {
  if (!p.gkSig) return;
  const r = rightOf(p), side = Math.sign(r.x * dir * attackDir(p.team)) || 1;     // left or right as the goalie sees it
  const tok = kind === 'dangle' ? 'D' : kind === 'spin' ? 'S' + (side > 0 ? 'R' : 'L') : (side > 0 ? 'R' : 'L');
  const last = p.gkSig.dirs[p.gkSig.dirs.length - 1];
  if (last !== tok || kind !== 'drag') p.gkSig.dirs.push(tok);
}
function gkNoteShot(p, tx) {
  const g = goalies[1 - p.team]; if (!g || !p.gkSig) return;
  const M = gkMemFor(g, p); if (!M) return;
  const k = (gkSeq(p) || gkSpot(p)) + '|' + Math.sign(Math.round(tx - CX));
  M[k] = { n: (M[k] ? M[k].n : 0) + 1, x: tx };
  p.gkSig = null;
}
function thinkGoalie(p) {
  const t = p.team, gl = ownGoalY(t), sgn = attackDir(t);
  if (hasPuck(p)) {
    if (p.covering) { p.inx = p.iny = 0; return; }
    return thinkGoalieAIPuck(p);
  }
  if (typeof keeperUpThink === 'function' && keeperUpThink(p)) return;               // SOCCER: up for a late corner, or racing back
  if (goalieFetch(p)) return;                                                         // power play: out to stop their clear
  if (!puck.owner && puck.h > 6 && puck.vh < 1.5 && !(p.lobbed > S.t) && p.down <= 0 && p.stun <= 0 && S.phase === 'live') {   // SOCCER: a cross dropping into his six-yard box: he comes for it
    const tl = (puck.vh + Math.sqrt(puck.vh * puck.vh + 2 * AIR.grav * puck.h)) / AIR.grav;
    const lx = puck.x + puck.vx * tl * 0.95, ly = puck.y + puck.vy * tl * 0.95;
    const fwd = (ly - gl) * sgn;
    if (fwd > 0 && fwd < SIX_D + 14 + A(p, 'pos') * 1.2 && Math.abs(lx - CX) < SIX_HW + 10 && (!puck.lastTouch || puck.lastTouch.team !== t)) {
      steerTo(p, lx, ly, 1, 2); p.fx = 0; p.fy = sgn; return;
    }
  }
  if (p.lobbed > S.t && !puck.owner && puck.h > 0) {                                  // SOCCER: chipped: back-pedalling, slower than a sprint
    steerTo(p, CX + (p.lobX - CX) * 0.6, p.lobY, 0.5 + A(p, 'pos') * 0.02, 2); p.fx = 0; p.fy = attackDir(t); return;
  }
  if (p.roam) { const wp = typeof netDetour === 'function' ? netDetour(p, CX, gl + sgn * 8) : { x: CX, y: gl + sgn * 8 }; steerTo(p, wp.x, wp.y, 1, 6); p.fx = 0; p.fy = sgn; return; }   // skate back to the crease (around the net if he's behind it)
  const c = puck.owner;
  // POKE CHECK: a carrier right on top of the crease gets the goalie diving out with his stick
  if (p.gLunge > 0) {
    p.gLunge--;
    if (c && c.team !== t) { const d = dist(p, c) || 1; p.inx = (c.x - p.x) / d; p.iny = (c.y - p.y) / d; p.fx = p.inx; p.fy = p.iny; }
    if (p.gLunge === 7) resolveGoaliePoke(p);
    return;
  }
  if (c && c.team !== t && !c.g && S.phase === 'live' && p.cd <= 0 && p.down <= 0 && p.stun <= 0) {
    const d = dist(p, c), front = (c.y - gl) * sgn;
    // (never with a second attacker near the crease: a pass across would find an empty net)
    const helper = teamSkaters(c.team).some(o => o !== c && o.stun <= 0 && hyp(o.x - CX, o.y - gl) < RK(70));
    if (!helper && front > 4 && front < 30 && Math.abs(c.x - CX) < 30 && d < 26 && S.t - (p.upT || -999) > 30 && Math.random() < GK_POKE.try) {
      p.gLunge = 14; p.cd = 90; p.poke = 16;
      sfx.poke();
      return;
    }
  }
  // SQUARE TO THE PUCK: on the line from the middle of the net to the puck (or, on a pass in our end, to where it's
  // going: a good positional goalie reads it and pushes across early), a little further out the further away it is
  // what he sees: the puck a reaction-time ago (the trail below), read ahead by his style; on a move he has seen
  // before from this shooter he reacts much sooner and leans to where that shot went
  const hist = p.gkHist = p.gkHist || [];
  hist.unshift({ x: puck.x, y: puck.y, vx: puck.owner ? puck.owner.vx : puck.vx, vy: puck.owner ? puck.owner.vy : puck.vy }); if (hist.length > 20) hist.length = 20;
  const exp = c && c.team !== t && !c.g ? gkExpect(p, c) : null;
  let R = gkReact(p); if (exp) R = Math.max(1, Math.round(R * Math.pow(GK.memReact, exp.n)));
  const seen = hist[Math.min(R, hist.length - 1)], ant = GK.antic[goalieTendency(p)];
  let src = { x: seen.x + seen.vx * ant, y: seen.y + seen.vy * ant };
  const pt = puck.passTarget;
  if (pt && pt.team !== t && !puck.owner && hyp(pt.x - CX, pt.y - gl) < 190) {
    const read = clamp(0.45 + (A(p, 'pos') - 5) * 0.08, 0.2, 0.9);
    src = { x: puck.x + (pt.x - puck.x) * read, y: puck.y + (pt.y - puck.y) * read };
  }
  const far = Math.abs(src.y - gl);
  // ONE ON ONE (a breakaway, a penalty shot, the shootout): he comes out to challenge, then backs in as the shooter
  // closes. Out there every move the shooter makes takes a bigger slide to stay square, which is what a good deke beats
  const lone = c && c.team !== t && !c.g && (S.so || S.phase === 'penalty' || teamSkaters(t).every(m => m.stun > 0 || (m.y - gl) * sgn > (c.y - gl) * sgn + 8));
  let depth = lone ? (far > 110 ? GK.chal : far > 45 ? GK.chal * 0.7 : 9)   // SOCCER: off his line to narrow the angle (which is what the chip punishes)
    : far > 160 ? 12 : far > 70 ? 10 : 7;
  const fy0 = Math.max(6, (src.y - gl) * sgn);
  let tx = clamp(CX + (src.x - CX) * depth / fy0, CX - (GOAL_HW - 3), CX + (GOAL_HW - 3));
  // A SHARP ANGLE (the puck low, out wide of the post): back onto the goal line and tight to the near post, so nothing
  // slides between him and the line; he turns a little to face it (gTurn, drawn as a slight pivot)
  const lat = Math.abs(src.x - CX), fwd = (src.y - gl) * sgn;
  let turn = 0;
  if (lat > GOAL_HW && fwd < lat * 0.75 && fwd > -6) {
    const k = clamp(1 - fwd / (lat * 0.75), 0, 1);
    depth = depth - (depth - 2.5) * k;
    tx += (CX + Math.sign(src.x - CX) * (GOAL_HW - 5) - tx) * k;
    turn = Math.sign(src.x - CX) * 0.42 * k;
  } else if (lat > 6) turn = clamp((src.x - p.x) / Math.max(30, fwd), -0.25, 0.25);
  p.gTurn = (p.gTurn || 0) + (turn * (sgn < 0 ? 1 : -1) - (p.gTurn || 0)) * 0.15;
  if (exp && exp.full) tx = clamp(tx + clamp(exp.x - tx, -GK.memShift * exp.n, GK.memShift * exp.n), CX - (GOAL_HW - 3), CX + (GOAL_HW - 3));   // he has seen this one: slide to where it went
  if (c && c.team !== t && !c.g && (c.y - gl) * sgn < 4 && Math.abs(c.y - gl) < 40) {     // carrier behind the net: hug the post on his side
    const lag = A(p, 'pos') >= 7 ? 0 : (7 - A(p, 'pos')) * 0.8;
    tx = CX + Math.sign(c.x - CX) * (GOAL_HW - 5 - lag);
    steerTo(p, tx, gl + sgn * 3, 1, 4); p.fx = 0; p.fy = sgn; p.gTurn = (p.gTurn || 0) + (Math.sign(c.x - CX) * 0.5 * (sgn < 0 ? 1 : -1) - (p.gTurn || 0)) * 0.15; return;   // square to the post, pivoted toward him (no sideways profile)
  }
  if (p.down > 0) depth = Math.min(depth, 8);                 // down (after a save or a dive): he stays in his crease, never challenges out
  let ty = gl + sgn * depth;
  if (p.down > 0 && p.pokeMiss) { tx = CX + (tx - CX) * 0.5; ty = gl + sgn * 7; }
  steerTo(p, tx, ty, (p.down > 0 ? (p.pokeMiss ? 0.85 : 0.6) : 1) * (1 - goalieLag(p)), 8);   // a missed dive: scramble back
  p.fx = 0; p.fy = sgn;
}
// goalie poke-check gamble: chance per frame a carrier sits on his doorstep, how far he dives, how long a miss leaves him down
const GK_POKE = { try: 0.035, reach: 28, missDown: 32 };
function resolveGoaliePoke(g) {
  const c = puck.owner;
  if (!c || c.team === g.team || c.g) return;
  const st = { x: g.x + g.fx * 12, y: g.y + g.fy * 12 };
  const near = hyp(puck.x - st.x, puck.y - st.y) < 15;
  const chance = cpuT(g.team) && !S.autoAI ? DIFF[S.diff].gPoke : 0.6;
  const won = near && Math.random() < chance;
  if (typeof dlGk === 'function') dlGk({ k: 'poke', g: g.pl && g.pl.id, c: c.pl && c.pl.id, near, chance: near ? chance : 0, won });
  if (won) {
    const side = puck.x < CX ? -1 : 1;           // swat it away from the net, toward the boards
    releasePuck(c, side * rand(1.8, 2.8), -attackDir(g.team) * -rand(0.6, 1.4), 30);
    c.charge = -1; puck.lastTouch = g; puck.passTarget = null; puck.shotTeam = null;
    floaters.push({ x: g.x, y: g.y - 34, text: 'POKE TACKLE!', life: 50, color: '#ffffff' });
    if (MS && g.pl) { const s = pst(g.pl, g.team); s.hds++; s.cv += 0.2 * (clutchMult(g.team) - 1); }
    say(['POKE TACKLE! THE KEEPER COMES OUT AND STRIPS HIM!', 'WHAT A POKE TACKLE!', 'THE KEEPER SWEEPS IT AWAY!'], 2);
    excite(0.5); sfx.save();
  } else {
    g.down = GK_POKE.missDown; g.vx *= 0.25; g.vy *= 0.25; g.pokeMiss = true;   // gambled and missed: down where he dove (no slide)
    floaters.push({ x: g.x, y: g.y - 34, text: 'MISSED!', life: 40, color: '#ff7a6e' });
    say(['THE KEEPER GAMBLES... AND MISSES! OPEN NET!', 'HE CAME OUT TOO FAR!'], 2, 0.7);
    excite(0.6);
  }
}

// ====================================================================
//  REFEREES
// ====================================================================
// the officials are in place for the drop (the countdown waits for them)
function refsSet() {
  const r = refs[0]; if (!r || r.tx == null) return true;
  return hyp(r.tx - r.x, r.ty - r.y) < 7;
}
function updateRefs() {
  const fx = puck.owner ? puck.owner.x : puck.x, fy = puck.owner ? puck.owner.y : puck.y;
  refs.forEach((r, i) => {
    let tx, ty;
    if (S.phase === 'faceoff') {
      if (i === 0) { tx = S.fo.x + (S.fo.kick != null ? 46 : 16); ty = S.fo.y - (S.fo.kick != null ? 22 : 3); }
      else { tx = S.fo.x < CX ? R.r - 30 : R.l + 30; ty = clamp(S.fo.y + (S.fo.y < CY ? 80 : -80), R.t + 34, R.b - 34); }
    } else if (S.phase === 'penalty' && S.pen) {
      const gy = oppGoalY(S.pen.team);
      if (i === 0) { tx = R.r - 41; ty = gy - attackDir(S.pen.team) * 30; } else { tx = R.r - 32; ty = CY + 34; }
    } else {
      const toward = fy < CY ? -1 : 1;
      if (i === 0) { tx = fx < CX ? R.r - 28 : R.l + 28; ty = clamp(fy + toward * 39, R.t + 30, R.b - 30); }
      else { tx = CX + (fx < CX ? 74 : -74); ty = clamp(fy - toward * 109, R.t + 46, R.b - 46); }
    }
    // keep out of the way of players
    for (const p of players) {
      const dx = tx - p.x, dy = ty - p.y, d = hyp(dx, dy);
      if (d < 16 && d > 0.01) { tx += dx / d * (16 - d); ty += dy / d * (16 - d); }
    }
    r.tx = tx; r.ty = ty;
    const dx = tx - r.x, dy = ty - r.y, d = hyp(dx, dy);
    // getting to a faceoff: skate hard so the official is always set before the drop
    const hustle = S.phase === 'faceoff' && !S.fo.dropped;
    const sp = Math.min(hustle ? 4.6 : 1.5, d * (hustle ? 0.22 : 0.05));
    const dvx = d > 0.5 ? dx / d * sp : 0, dvy = d > 0.5 ? dy / d * sp : 0;
    const k = hustle ? 0.3 : 0.08;
    r.vx += (dvx - r.vx) * k; r.vy += (dvy - r.vy) * k;
    r.x += r.vx; r.y += r.vy;
    constrain(r, 6, 0.2); pushOutOfNets(r, 6);
    const s = hyp(r.vx, r.vy);
    if (s > 0.3) { r.fx = r.vx / s; r.fy = r.vy / s; }
    r.anim += s * 0.22;
    if (r.arm > 0) r.arm--;
  });
}

// ====================================================================
//  PHYSICS
// ====================================================================
// top speed from the Speed rating (5 = normal) and difficulty for CPU skaters
function baseSpeed(p) { return 2.05 * (cpuT(p.team) && !S.autoAI ? DIFF[S.diff].cpuSpd : 1) * (0.86 + A(p, 'spd') * 0.028); }
function stamOf(p) { return p.pl && MS ? (MS.stam[p.pl.id] ?? 100) : 100; }
// BIG HITS COST STAMINA FOR GOOD: every big hit takes a chunk off the victim's MAXIMUM stamina for the rest of the game
// (about 15%: more from a strong, heavy checker or from behind, less for a fit, sturdy player, 70% if he stays on his
// skates), and once he's back up he is WOBBLED (dazed) for a while relative to that chunk: no sprinting until it clears.
const HIT_TOLL = { base: 15, min: 6, max: 26, floor: 50, dazePer: 28 };
const stamCapOf = id => MS && MS.stamCap && MS.stamCap[id] != null ? MS.stamCap[id] : 100;
// the daze belongs to the PLAYER, not the skater slot: it goes to the bench with him (and keeps wearing off there)
function dazeSwap(p, np) {
  if (!MS) return; MS.daze = MS.daze || {};
  if (p.pl && p.daze > 0) MS.daze[p.pl.id] = { left: p.daze, at: S.t };
  const d = np && MS.daze[np.id]; p.daze = d ? Math.max(0, d.left - (S.t - d.at)) : 0; if (np) delete MS.daze[np.id];
}
function bigHitToll(p, t, flat, behind) {
  if (t.g) return;
  let pct = HIT_TOLL.base * (1 + (A(p, 'chk') - 5) * 0.06 + (A(p, 'pow') - 5) * 0.03 - (A(t, 'sta') - 5) * 0.05 - (A(t, 'def') - 5) * 0.03);
  pct *= (flat ? 1 : 0.7) * (behind ? 1.15 : 1) * (typeof traitMul === 'function' ? traitMul(t.pl, 'stunMul') : 1) * rand(0.88, 1.12);
  pct = clamp(pct, HIT_TOLL.min, HIT_TOLL.max);
  if (MS && t.pl) {
    MS.stamCap = MS.stamCap || {}; const id = t.pl.id;
    MS.stamCap[id] = Math.max(HIT_TOLL.floor, stamCapOf(id) - pct);
    MS.stam[id] = Math.min(MS.stam[id] ?? 100, MS.stamCap[id]);
  }
  t.daze = Math.max(t.daze || 0, Math.round(pct * HIT_TOLL.dazePer));
  t.dazeMax = t.daze;
}
function fatigueMul(p) { return 0.8 + 0.2 * clamp(stamOf(p) / 55, 0, 1); }
// the same rule the human skater lives by: within 120 of the opposing carrier you face him, so skating away from him is
// backwards (70% speed, no sprint) and skating across him is a turn (86%). Like the human's double-tap PIVOT, a CPU
// skater who is being beaten can turn and skate forward, paying the same pivot cost (a moment at reduced speed)
const MOMENTUM = { acc: 0.06, taper: 0.6 };
function aiSkateMul(p, max) {
  p.bwd = false;
  const cr = puck.owner;
  if (!cr || cr.team === p.team || cr.g || S.phase !== 'live' || hasPuck(p) || p.lunge > 0 || p.stun > 0 || !(p.inx || p.iny)) { p.aiPivot = null; return 1; }
  const cd = dist(p, cr) || 1, m = hyp(p.inx, p.iny);
  if (p.aiPivot && ((p.inx * p.aiPivot.dx + p.iny * p.aiPivot.dy) / m <= 0.3 || cd > 200)) p.aiPivot = null;   // changed direction: back to normal
  if (p.aiPivot || cd >= 120) return 1;
  const fx0 = (cr.x - p.x) / cd, fy0 = (cr.y - p.y) / cd, dot = (p.inx * fx0 + p.iny * fy0) / m;
  if (dot < -0.35) {
    const crSp = (cr.vx * p.inx + cr.vy * p.iny) / m;          // how fast the carrier is going the way he's backing
    if (crSp > max * 0.68 && (p.pvCd || 0) < S.t) { p.aiPivot = { dx: p.inx / m, dy: p.iny / m }; p.slow = Math.max(p.slow || 0, PIVOT.slow); p.pvCd = S.t + 45; return 1; }
    p.bwd = true; p.sprint = false; return 0.7;
  }
  return dot < 0.35 ? 0.86 : 1;
}
function movePlayer(p) {
  const D = DIFF[S.diff];
  let max = p.g ? (p.gLunge > 0 ? 2.5 * RINK_S : p.down > 0 ? 0.6 * RINK_S : 1.55 * RINK_S * (0.9 + A(p, 'pos') * 0.02) * (hasPuck(p) && !p.covering ? PLAY.gPuckMove / RINK_S : 1)) : baseSpeed(p) * fatigueMul(p);   // goalies move across the (bigger) crease a bit quicker
  if (hasPuck(p)) max *= p.g ? 0.72 : 0.93;                  // goalies carry it slowly
  if (!p.g && typeof shortHanded === 'function' && shortHanded(p.team)) max *= PP_EDGE.pkSpd;   // a man short: the killers can't cover all the ice
  if (p === ctrl && !S.autoAI && p.speedMul) max *= p.speedMul;
  else if (!p.g) max *= aiSkateMul(p, max);                   // CPU skaters obey the exact same back-skating / turning rule
  if (p.daze > 0) { if (!(p.stun > 0)) p.daze--; p.sprint = false; }   // WOBBLED: no sprinting until it clears
  if (p.sprint) max *= 1.13;
  if (p.dkHead) max *= 0.98;                                     // stickhandling costs a hair of speed
  if (p.covering) { p.covering--; max = 0; }
  if (!p.g) tickDeke(p);
  if (p.charge >= 0 && !p.g) { const c = clamp(p.charge, 0, 1); max *= c <= 0.45 ? 1 - c * 0.3 : c < 0.75 ? 0.865 - (c - 0.45) * 2.05 : 1 - c; }   // a wrist or snap shot comes off in stride; only the slapshot's full wind-up plants him
  if (p.slow > 0) { max *= 0.55; p.slow--; }
  if (p.stun > 0) { p.stun--; p.vx *= 0.93; p.vy *= 0.93; }
  else if (p.lunge > 0) {
    // committed to the man: the lunge keeps steering onto where he is going, as long as he is still in front
    const ct = p.checkTarget;
    const spinning = ct && ct.dkMove && ct.dkMove.kind === 'spin' && ct.dkMove.t <= ct.dkMove.dur * DEKES.spin.window;   // he's committed: a spin rolls out of his line
    if (ct && !ct.g && ct.stun <= 0 && !spinning) {
      const ax = ct.x + ct.vx * 3 - p.x, ay = ct.y + ct.vy * 3 - p.y, ad = hyp(ax, ay) || 1, ux = ax / ad, uy = ay / ad;
      if (ux * p.lungeDx + uy * p.lungeDy > 0.3) { const nx = p.lungeDx + (ux - p.lungeDx) * CHECK.home, ny = p.lungeDy + (uy - p.lungeDy) * CHECK.home, nd = hyp(nx, ny) || 1; p.lungeDx = nx / nd; p.lungeDy = ny / nd; p.fx = p.lungeDx; p.fy = p.lungeDy; }
    }
    const lm = max * 1.75;
    p.vx += (p.lungeDx * lm - p.vx) * 0.3; p.vy += (p.lungeDy * lm - p.vy) * 0.3;
    resolveLunge(p);
    p.lunge = Math.max(0, p.lunge - 1);
    if (p.lunge === 0 && p.checkTarget && !(p.checkTarget.stun > 0)) { p.missT = S.t; p.missTgt = p.checkTarget; }   // ran out of lunge without landing it: he got by
  } else if (p.inx || p.iny) {
    const resp = p.g ? 0.22 : 0.15, sp0 = hyp(p.vx, p.vy);
    p.vx += (p.inx * max - p.vx) * resp; p.vy += (p.iny * max - p.vy) * resp;
    // SKATING MOMENTUM (everyone, you included): stopping and turning are quick, but speed has to be BUILT stride by
    // stride, faster from a standstill than near the top. Turned round flat-out, nobody is back to full speed in
    // two strides any more (about 0.4 s from a stop to 90%, 0.6 s from full speed one way to 90% the other way);
    // quick skaters build it a little faster
    if (!p.g) { const sp1 = hyp(p.vx, p.vy), mx = Math.max(0.1, max), cap = sp0 + mx * MOMENTUM.acc * (1 - MOMENTUM.taper * Math.min(1, sp0 / mx)) * (0.85 + A(p, 'spd') * 0.03);
      if (sp1 > cap && sp1 > 0.05) { p.vx *= cap / sp1; p.vy *= cap / sp1; } }
  } else { p.vx *= 0.955; p.vy *= 0.955; }
  if (!p.g && hasPuck(p)) turnFumble(p);
  const sp = hyp(p.vx, p.vy), lsp = hyp(p.lastVx, p.lastVy);
  if (lsp > 1.3 && !p.g && (p.vx * p.lastVx + p.vy * p.lastVy) / (sp * lsp + 1e-6) < 0.75 && Math.random() < 0.7) {
    particles.push({ x: p.x + rand(-3, 3), y: p.y, vx: -p.lastVx * 0.5 + rand(-0.4, 0.4), vy: -p.lastVy * 0.5 + rand(-0.4, 0.4), life: rand(8, 16), color: '#ffffff' });
    markSpray(p.x, p.y);
    if ((p.stopT || 0) < S.t - 25 && p.y > camY - 10 && p.y < camY + viewH() + 10) { p.stopT = S.t; sfx.stop(); }
  }
  if (p.sprint && sp > 1.5 && Math.random() < 0.35) particles.push({ x: p.x - p.vx * 3 + rand(-2, 2), y: p.y - p.vy * 3, vx: -p.vx * 0.2, vy: -p.vy * 0.2, life: rand(6, 12), color: '#dbe9ff' });
  p.lastVx = p.vx; p.lastVy = p.vy;
  if ((p !== ctrl || S.autoAI) && !p.g && p.charge < 0 && p.lunge <= 0 && !(p.dkMove && p.dkMove.t < p.dkMove.dur)) {
    // with the puck, or skating hard toward the play: face where he's going. Without it and backing off,
    // or standing still: face the puck (defenders back-skate facing the carrier, never their own goalie)
    // everyone keeps an eye on the puck: the only time he looks away from it is when he is skating hard with it behind
    // him (racing back, or breaking up the ice for a pass), or he is the one it is being passed to
    const watch = !hasPuck(p) && (S.phase === 'live' || S.phase === 'whistle' || S.phase === 'faceoff' || S.phase === 'penalty') && puck.passTarget !== p && !(p.rcvSet > 0);
    let tx = sp > 0.35 ? p.vx / sp : p.fx, ty = sp > 0.35 ? p.vy / sp : p.fy;
    if (watch) {
      const px0 = (puck.owner || puck).x - p.x, py0 = (puck.owner || puck).y - p.y, pd = hyp(px0, py0) || 1;
      const along = sp > 0.35 ? (p.vx * px0 + p.vy * py0) / (sp * pd) : 0;      // 1 = skating straight at the puck, -1 = straight away
      const hard = sp > baseSpeed(p) * 0.72;
      if (!(hard && along < -0.25) && !p.aiPivot && pd < 320) { tx = px0 / pd; ty = py0 / pd; }
    }
    if (p.stun <= 0) { const k = hasPuck(p) ? 1 : sp > 0.35 ? 0.35 : 0.2; p.fx += (tx - p.fx) * k; p.fy += (ty - p.fy) * k; const m = hyp(p.fx, p.fy) || 1; p.fx /= m; p.fy /= m; }
  }
  p.x += p.vx; p.y += p.vy;
  if (p.g) {   // GOALIE SET: squared up on the puck (on the line from it to the middle of his net) and not on the move
    const sx = puck.owner ? puck.owner.x : puck.x, sy = puck.owner ? puck.owner.y : puck.y, gl = ownGoalY(p.team), lx = CX - sx, ly = gl - sy, ll = hyp(lx, ly) || 1;
    const off = Math.abs(((p.x - sx) * ly - (p.y - sy) * lx) / ll), ok = hyp(p.vx, p.vy) < 0.7 && off < 4 && !(p.down > 0) && !(p.gLunge > 0);
    p.setT = ok ? Math.min(60, (p.setT || 0) + 1) : Math.max(0, (p.setT || 0) - 3);
  }
  const r = p.g ? GOALIE_R : SKATER_R;
  const bh = constrain(p, r, 0.25);
  if (!p.g && puck.owner === p && S.phase === 'live' && !p.restart) keepOnPitch(p, 5);   // SOCCER: the ball carrier can't dribble it out of play
  if (p.boardT > 0) {                       // knocked into the boards right after a hit: crunch
    p.boardT--;
    if (bh > 1.1 && p.stun > 0) {
      p.boardT = 0;
      if (!S.demo) { sfx.glass(bh); S.shake = Math.max(S.shake || 0, p.boardBig ? 2.6 : 1.2); if (p.boardBig) S.hitStop = Math.max(S.hitStop || 0, 3); }
      glassShake(p.x, p.y, p.boardBig);
      p.stun += p.boardBig ? 12 : 6; excite(0.25);
      for (let i = 0; i < 8; i++) particles.push({ x: p.x, y: p.y - 4, vx: rand(-1.2, 1.2), vy: rand(-1.2, 1.2), life: rand(10, 20), color: '#e6f2ff' });
      if (p.boardBig) floaters.push({ x: p.x, y: p.y - 40, text: 'INTO THE HOARDINGS!', life: 45, color: '#ffb36b' });
    }
  }
  pushOutOfNets(p, r - 1);
  if (p.outroFree || (p.g && p.kUp)) { /* end-of-game lap, or a keeper up for a corner: anywhere */ }
  else if (p.g && (p.roam || p.fetch || (hasPuck(p) && p === ctrl))) {
    // your goalie skating with the puck: a limited area in front of the net (further out = less protection)
    const gl = ownGoalY(p.team), sgn = attackDir(p.team);
    p.roam = true;
    const big = !(hasPuck(p) && p === ctrl && !S.autoAI) && (p.fetch || p.fetched);   // out stopping a clear: the bigger area (behind the net too)
    const bx = big ? FETCH.box : 83, y0 = big ? -FETCH.behind : 3, y1 = big ? FETCH.front : 76;
    p.x = clamp(p.x, CX - bx, CX + bx);
    p.y = clamp(p.y, Math.min(gl + sgn * y0, gl + sgn * y1), Math.max(gl + sgn * y0, gl + sgn * y1));
    if (!hasPuck(p) && !p.fetch && Math.abs(p.x - CX) <= 25 && Math.abs(p.y - gl) <= 23 && (p.y - gl) * sgn > 0) { p.roam = false; p.fetched = false; }
  } else if (p.g) {
    const gl = ownGoalY(p.team), sgn = attackDir(p.team);
    const out = p.gLunge > 0 ? GK_POKE.reach : p.down > 0 ? (p.pokeMiss ? 24 : 16) : 20;        // can leave the crease to poke check; down after a save he stays in it
    p.x = clamp(p.x, CX - (out > 20 ? 30 : 22), CX + (out > 20 ? 30 : 22));
    const lo = Math.min(gl + sgn * 3, gl + sgn * out), hi = Math.max(gl + sgn * 3, gl + sgn * out);
    p.y = clamp(p.y, lo, hi);
  }
  if (p.down > 0) { p.down--; if (p.down === 0) { p.upT = S.t; p.pokeMiss = false; } } if (p.bumpCd > 0) p.bumpCd--; if (p.wobble > 0) p.wobble--;
  if (p.cd > 0) p.cd--; if (p.poke > 0) p.poke--; if (p.block > 0) p.block--; if (p.passCd > 0) p.passCd--;
  p.anim += sp * 0.22;
}
function collidePlayers(list = players) {
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    const ra = a.g ? GOALIE_R : SKATER_R, rb = b.g ? GOALIE_R : SKATER_R;
    let dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy); const min = ra + rb - 1;
    if (d < 0.01 && a.on !== false && b.on !== false) { dx = (i % 2 ? 1 : -1) * 0.1; dy = 0.05; d = hyp(dx, dy); }   // exactly on top of each other: still push apart
    if (d > 0 && d < min) {
      if (typeof DBG !== 'undefined') DBG.collisions = (DBG.collisions || 0) + 1;
      const nx = dx / d, ny = dy / d, o = (min - d) / 2;
      // goalies can't be run over: a skater bounces off a goalie (his own or theirs) and a check into one ends on the spot
      const gk2 = a.g !== b.g, wa = a.g ? (gk2 ? 0 : 0.2) : 1, wb = b.g ? (gk2 ? 0 : 0.2) : 1;
      if (gk2) { const sk = a.g ? b : a; if (sk.lunge > 0) { sk.lunge = 0; sk.checkTarget = null; sk.bigHit = false; sk.slow = Math.max(sk.slow || 0, 20); } }
      const pa = gk2 ? (a.g ? 0 : 2) : wa, pb = gk2 ? (b.g ? 0 : 2) : wb;            // vs a goalie, the skater takes the whole separation
      a.x -= nx * o * pa; a.y -= ny * o * pa; b.x += nx * o * pb; b.y += ny * o * pb;
      const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rv < -0.9 && a.team !== b.team && !a.g && !b.g && S.phase === 'live' && (list === players || list.length === players.length)) bodyBump(a, b, nx, ny);
      if (rv < 0) { const ka = gk2 && !a.g ? 0.8 : 0.4, kb2 = gk2 && !b.g ? 0.8 : 0.4; a.vx += nx * rv * ka * wa; a.vy += ny * rv * ka * wa; b.vx -= nx * rv * kb2 * wb; b.vy -= ny * rv * kb2 * wb; }
    }
  }
}
// skating into an opponent: a light shoulder bump. Mostly a quarter-second stagger; speed, checking and
// size decide who gives way. Only a big mismatch at full speed puts someone down, and very rarely.
function bodyBump(a, b, nx, ny) {
  if ((a.bumpCd || 0) > 0 || (b.bumpCd || 0) > 0 || a.stun > 0 && b.stun > 0) return;
  const ca = a.vx * nx + a.vy * ny, cb = -(b.vx * nx + b.vy * ny);          // how hard each was skating into the other
  const dr = ca >= cb ? a : b, v = dr === a ? b : a, closing = Math.max(ca, cb) + Math.max(0, Math.min(ca, cb)) * 0.5;
  const trait = pl => (pl && hasTrait(pl, 'enforcer') ? 1.25 : 1) * (pl && hasTrait(pl, 'hotheaded') ? 1.1 : 1);
  const push = closing * (0.55 + A(dr, 'chk') * 0.07) * trait(dr.pl), hold = 0.55 + A(v, 'chk') * 0.05 + (hasPuck(v) ? (A(v, 'stk') - 5) * 0.03 : 0) + (v.sprint ? 0.1 : 0);
  const pow = push - hold;
  a.bumpCd = b.bumpCd = 30;
  if (pow <= 0.4) return;
  v.wobble = Math.round(10 + Math.min(10, pow * 6));                       // ~a quarter second off balance
  v.slow = Math.max(v.slow || 0, v.wobble); v.vx *= 0.8; v.vy *= 0.8;
  const sx = dr === a ? nx : -nx, sy = dr === a ? ny : -ny;
  v.vx += sx * Math.min(1.2, pow * 0.5); v.vy += sy * Math.min(1.2, pow * 0.5);
  if (!S.demo) sfx.bump(Math.min(1, pow / 2));
  if (typeof addGrudge === 'function') addGrudge(v, dr, 0.04);
  if (hasPuck(v) && Math.random() < Math.min(0.3, 0.08 * pow)) { releasePuck(v, v.vx * 0.6 + rand(-0.8, 0.8), v.vy * 0.6 + rand(-0.8, 0.8), 16); floaters.push({ x: v.x, y: v.y - 30, text: 'BUMPED OFF IT', life: 35, color: '#ffd23f' }); }
  if (pow > 2.4 && Math.random() < 0.03) {                                  // the rare one: flattened by a bump
    v.stun = 34; v.stunType = 'small'; if (hasPuck(v)) releasePuck(v, v.vx, v.vy, 20);
    floaters.push({ x: v.x, y: v.y - 30, text: 'DOWN HE GOES', life: 40, color: '#ff9e94' });
  }
}
function puckNets(prevX, prevY) {
  for (const n of NETS) {
    const inside = puck.x > n.x0 - PUCK_R && puck.x < n.x1 + PUCK_R && puck.y > n.y0 - PUCK_R && puck.y < n.y1 + PUCK_R;
    if (!inside) continue;
    const fromFront = n.front > 0 ? prevY >= n.lineY : prevY <= n.lineY;
    if (fromFront) {
      // pucks last played by your own skaters: a goalie in his net stops them 99.9% of the time (accidents still happen).
      // An empty net is just empty: nothing stops it.
      const g = goalies[n.team], lt = puck.lastTouch;
      if (Math.abs(puck.x - CX) <= GOAL_HW - 0.5 && lt && lt.team === n.team && !lt.g) {
        const inNet = g && !g.ghost && g.on !== false && !(MS && MS.rs && MS.rs.pulled && MS.rs.pulled[n.team]) && hyp(g.x - CX, g.y - n.lineY) < 34;   // he's home, in front of it
        if (inNet && Math.random() < PLAY.ownSave) {    // the goalie gloves it
          puck.shot = null; puck.shotTeam = null; puck.passTarget = null;
          puck.x = clamp(puck.x, CX - GOAL_HW + 3, CX + GOAL_HW - 3); puck.y = n.lineY + n.front * 6; puck.vx = puck.vy = 0;
          puck.owner = g; g.hold = 55; g.gpT = 0; g.gCharge = null; g.gAim = null; puck.lastTouch = g;
          return true;
        }
      }
      if (Math.abs(puck.x - CX) <= GOAL_HW - 0.5) {
        puck.inNet = true; puck.x = clamp(puck.x, CX - GOAL_HW + 2, CX + GOAL_HW - 2); sfx.twine();
        puck.y = n.lineY - n.front * 6; puck.vx *= 0.1; puck.vy = 0;
        scoreGoal(1 - n.team);
        return true;
      }
      puck.y = n.lineY + n.front * (PUCK_R + 0.5); puck.vy = -puck.vy * 0.6; puck.vx += rand(-0.6, 0.6);
      sfx.post(); excite(0.6); puck.shot = null;
      floaters.push({ x: puck.x, y: n.lineY - 18, text: 'POST!', life: 45, color: '#ffffff' });
      say(['DING! OFF THE IRON!', 'OFF THE POST! SO CLOSE!', 'HE RINGS IT OFF THE POST!'], 2);
      continue;
    }
    if (prevX <= n.x0 - PUCK_R) { puck.x = n.x0 - PUCK_R - 0.1; puck.vx = -Math.abs(puck.vx) * 0.5; }
    else if (prevX >= n.x1 + PUCK_R) { puck.x = n.x1 + PUCK_R + 0.1; puck.vx = Math.abs(puck.vx) * 0.5; }
    else if (n.front > 0) { puck.y = n.y0 - PUCK_R - 0.1; puck.vy = -Math.abs(puck.vy) * 0.5; }
    else { puck.y = n.y1 + PUCK_R + 0.1; puck.vy = Math.abs(puck.vy) * 0.5; }
  }
  return false;
}
function goalieSave(g) {
  if (puck.owner || puck.inNet || puck.air || g.stun > 0 || g.block > 0 || puck.passed.has(g.id)) return false;
  // out of his net stopping a clear: he gathers it when it reaches him
  if (g.fetch && !puck.shot && hyp(puck.x - g.x, puck.y - g.y) < 13) {
    puck.owner = g; g.hold = 55; g.gpT = 0; g.gCharge = null; g.gAim = null; puck.vx = puck.vy = 0; puck.lastTouch = g;
    puck.passTarget = null; puck.shotTeam = null; puck.iceTeam = null; puck.passed.clear(); g.fetch = null; g.fetched = true;
    sfx.pick(); return true;
  }
  // a teammate's pass back to him: he gathers it (then plays it like any puck he holds)
  if (puck.passTarget === g && puck.passFrom && puck.passFrom.team === g.team) {
    if (hyp(puck.x - g.x, (puck.y - g.y) * 1.2) > 17) return false;
    if (MS && !S.so) statPossess(g, puck.passFrom);
    puck.owner = g; g.hold = 55; g.gpT = 0; g.gCharge = null; g.gAim = null; puck.vx = puck.vy = 0; puck.lastTouch = g;
    puck.passTarget = null; puck.shotTeam = null; puck.iceTeam = null; puck.shot = null; puck.passed.clear();
    sfx.pick(); return true;
  }
  const sh = puck.shot;
  if (sh && sh.cat !== 'net') return false;              // headed for the post / bar / glass
  const sp = hyp(puck.vx, puck.vy);
  const towardGoal = puck.vy * attackDir(g.team) < 0;
  const dx = Math.abs(puck.x - g.x), dyA = Math.abs(puck.y - g.y);
  const mod = GOALIE_BASE + (S.autoAI ? 0 : GK_HUMAN + (cpuT(g.team) ? DIFF[S.diff].save : DIFF[S.diff].gHelp)) + (typeof shortHanded === 'function' && shortHanded(g.team) ? PP_EDGE.save + (typeof activeTactic === 'function' ? (PP_EDGE.tac[activeTactic(1 - g.team).key] || 0) + (PP_EDGE.tac[activeTactic(g.team).key] || 0) : 0) : 0);
  let pSave, zone = sh ? sh.zone : null;
  if (!sh || sp < 3) {
    if (hyp(dx, dyA * 1.2) > 12) return false;
    if (!towardGoal && sp > 2.2) return false;
    const ownTeam = puck.lastTouch && puck.lastTouch.team === g.team;
    if (ownTeam && sp > 2.2) { puck.passed.add(g.id); return false; }
    pSave = sp < 3 ? 1 : clamp(0.94 - (sp - 3) * 0.075 + mod, 0.3, 0.97);
    // a real shot that wasn't aimed at the net (from way out, beyond aiming range: centre ice, his own end) that
    // happens to reach him: he's watched it come the whole way; almost always stopped
    if (sp >= 3 && puck.shotTeam != null && puck.shotTeam !== g.team && puck.shotT != null && S.t - puck.shotT < 150) pSave = clamp(0.975 + mod * 0.3 - (sp - 7) * 0.006, 0.94, 0.995);
    if (g.down > 0 && sp >= 3) pSave -= 0.2;
  } else if (GKR.lat.on && Math.abs(puck.vx) > Math.abs(puck.vy) * 1.3 && dyA < 14 && (puck.y - g.y) * Math.sign(oppGoalY(1 - g.team) - g.y) > -3) {   // (level with him or between him and his goal line)
    // ACROSS HIM (a sharp-angle shot or a puck along the goal line): judged when it reaches him from the side; his pads,
    // skates and stick cover about 8 units front to back (more when he's down), better positioned goalies a bit more
    if (dx > GKR.lat.w) return false;                                                 // not across his pads yet
    const depthR = (g.down > 0 ? GKR.lat.d + 2 : GKR.lat.d) + (A(g, 'pos') - 5) * 0.3 - (puck.oneTimer ? (puck.oneTimer === 'weak' ? 1 : 2.5) : 0) - Math.abs(g.vx) * 1.5 - gFat(g) * 2,
      margin = depthR - dyA;
    pSave = margin >= GKR.band ? 1 : margin <= -GKR.band ? 0 : 0.5 + 0.5 * margin / GKR.band;
    if (pSave <= 0) { puck.passed.add(g.id); return false; }
  } else {
    if (!towardGoal || dyA > 3.2) return false;          // judged as the shot reaches the goalie
    const down = g.down > 0;
    if (zone === 'five' && dx > 6) zone = 'low';
    // REACH, not dice: how far from his centre he gets a pad, glove, blocker or body to it. The five-hole is open
    // unless he is down (or set and square); a hard shot from close in gives him less time, so he covers less;
    // from far out he sees it all the way
    const far0 = Math.max(0, ((sh.d0 || 0) - 110) / RINK_S), close = clamp(1 - (sh.d0 || 0) / 220, 0.15, 1);
    let reach;
    if (zone === 'five') reach = down || Math.abs(g.vx) < 0.6 ? 99 : -1;              // the five-hole opens only while he is sliding across
    else reach = ((zone === 'high' ? (down ? GKR.rHighDown : GKR.rHigh) : zone === 'mid' ? (down ? GKR.rMidDown : GKR.rMid) : (down ? GKR.rLowDown : GKR.rLow)) + (A(g, 'pos') - 5) * 0.25) * RINK_S * GK_REACH;   // (SOCCER: GK_REACH: a bigger goal, a longer stretch) measured where the puck reaches him (he plays out to cut the angle)
    if (reach > 0 && reach < 90 && sh.lone) reach *= GKR.lone;              // one on one: the shooter has time and space to pick his spot
    if (reach > 0 && reach < 90 && puck.bkAI) reach += BK_REACH * RINK_S;   // computer breakaways now always finish with a shot: the goalie gets a little more on those
    if (reach > 0 && reach < 90) {
      reach += (A(g, 'ref') - 5) * GKR.ref - Math.max(0, sp - 4) * GKR.speed * close + Math.min(GKR.farMax, far0 * GKR.far)
        - (puck.oneTimer ? (puck.oneTimer === 'weak' ? 0.8 : 2) * (SHOTX.otBase + (1 - SHOTX.otBase) * (puck.otLat || 0)) : 0) - (puck.tipT != null && S.t - puck.tipT < 25 ? GKR.tip : 0)
        - (puck.rel && !(puck.tipT != null && S.t - puck.tipT < 25) ? releaseEdge(g, puck.rel, sh.d0 || 0, !!puck.laneScr) : 0)
        - (SETUP.maxBonus * (puck.setup || 0) + SETUP.pressMax * (g.press || 0)) * GKR.setup - gFat(g) * GKR.fat - Math.abs(g.vx) * GKR.moving
        + (mod + GKR.base) * GKR.mod;
      if (typeof goalieStrongSide === 'function' && g.pl) {           // glove side or blocker side: some goalies are better on one
        const r = rightOf(g), onRight = (puck.x - g.x) * r.x + (puck.y - g.y) * r.y > 0, gloveSide = onRight === (goalieCatch(g.pl) === 'R'), ss = goalieStrongSide(g.pl);
        if (ss) reach += ss === (gloveSide ? 'glove' : 'blocker') ? 1 : -1;
      }
    }
    // HYBRID: well inside his reach = always stopped; well outside = always in; within GKR.band pixels of the edge it
    // is a stretch, and the chance fades smoothly from likely to unlikely across that band
    const margin = reach - dx;
    if (window.__gkdbg) window.__gkdbg.push({ zone, dx: +dx.toFixed(1), reach: +reach.toFixed(1), sp: +sp.toFixed(1), gx: +(g.x - CX).toFixed(1), px: +(puck.x - CX).toFixed(1), down: g.down > 0 });
    pSave = margin >= GKR.band ? 1 : margin <= -GKR.band ? 0 : 0.5 + 0.5 * margin / GKR.band;
    if (pSave <= 0 && typeof dlGk === 'function') dlGk({ k: 'shot', g: g.pl && g.pl.id, s: puck.shooterPl && puck.shooterPl.id, zone, sp: +sp.toFixed(1), reach: +reach.toFixed(1), dx: +dx.toFixed(1), down: g.down > 0, save: 0, won: false });
    if (pSave <= 0) { if (puck.vx * (g.x - puck.x) <= 0 || Math.abs(puck.vx) < Math.abs(puck.vy)) puck.passed.add(g.id); if (sp >= 3) addPressure(g, puck.xg || 0, S.t - (puck.reboundT || -999) < 60); return false; }   // past him (a cross-crease shot still coming at him gets judged again as it arrives)
    if (pSave < 1) g.stretch = true;
    { const exp = puck.shooter ? gkExpect(g, puck.shooter) : null; if (exp && dist(puck.shooter, g) < 140) floaters.push({ x: g.x, y: g.y - 44, text: 'READ IT!', life: 40, color: '#ffd23f' }); }
    if (false) {
    pSave = clamp(1.02 - (sp - 3) * 0.025 + mod * 0.6, 0.5, 0.97);
    if (zone === 'high') pSave -= down ? 0.22 : 0.04;
    else if (zone === 'mid') pSave += down ? -0.03 : 0.025;       // off the hip, under the arm: right at his body when he's up
    // glove side or blocker side: some goalies are better on one of them
    if (typeof goalieStrongSide === 'function' && g.pl) {
      const r = rightOf(g), onRight = (puck.x - g.x) * r.x + (puck.y - g.y) * r.y > 0, gloveSide = onRight === (goalieCatch(g.pl) === 'R');
      const ss = goalieStrongSide(g.pl);
      if (ss) pSave += (ss === (gloveSide ? 'glove' : 'blocker') ? 0.035 : -0.03) * (zone === 'high' ? 1.3 : 0.7);
    }
    if (zone === 'five') pSave = down ? 0.97 : pSave - 0.08 - Math.min(0.2, Math.abs(g.vx) * 0.25);
    else if (down && zone !== 'high' && zone !== 'mid') pSave += 0.05;   // low shots: the butterfly takes the bottom of the net away
    const far = Math.max(0, ((sh.d0 || 0) - 110) / RINK_S);            // how far beyond the top of the circles it came from
    if (puck.oneTimer && far < 40) pSave -= puck.oneTimer === 'weak' ? 0.02 : 0.06;     // the goalie has to move across, but it is no gimme (not from way out)
    // a long shot: he sees it all the way. From the edge of the box a little easier to stop, from centre ice almost never in
    pSave += Math.min(0.16, far * 0.0022);
    if (puck.tipT != null && S.t - puck.tipT < 25) pSave -= PLAY.tipSavePen;
    }
  }
  if (sp >= 3 && !(sh && sh.cat === 'net')) pSave += (A(g, 'ref') - 5) * 0.022 - gFat(g) * 0.13 - (S.t - (g.lastSaveT || -999) < 90 ? gFat(g) * 0.06 : 0);   // loose pucks and stray shots: still a judgement
  pSave = clamp(pSave, 0.12, 1);
  if (sp >= 3 && sh) addPressure(g, puck.xg || 0, S.t - (puck.reboundT || -999) < 60);
  const saved = Math.random() < pSave;
  if (sp >= 3 && typeof dlGk === 'function') dlGk({ k: sh ? 'shot' : 'loose', g: g.pl && g.pl.id, s: puck.shooterPl && puck.shooterPl.id, zone, sp: +sp.toFixed(1), down: g.down > 0, save: +pSave.toFixed(2), won: saved });
  if (saved) {
    // GLOVE or BLOCKER: a shot off the ice (or wide of his body) is taken with the hand on that side, and he shows it
    if (sp >= 3 && (zone === 'high' || zone === 'mid' || (sh && dx > 5)) && g.down <= 0 && g.pl) {
      const r = rightOf(g), onRight = (puck.x - g.x) * r.x + (puck.y - g.y) * r.y > 0, gloveSide = onRight === (goalieCatch(g.pl) === 'R');
      g.saveAnim = { kind: gloveSide ? 'glove' : 'blocker', t0: S.t, hi: zone === 'high' };
    }
    if (puck.shotTeam !== null && puck.shotTeam !== g.team) { S.sog[puck.shotTeam]++; statShotSaved(g); }
    puck.shotTeam = null; puck.passTarget = null; puck.iceTeam = null; puck.shot = null;
    excite(0.45);
    const hard = sp > 5.4;
    if (sp >= 3) goalieWork(g, sp);
    // a REBOUND or a clean catch: decided by how hard it was, where it hit him and his rebound control (no dice)
    const rebLine = GKR.rebSpeed + (A(g, 'reb') - 5) * 0.35 - gFat(g) * 1.2 + (zone === 'high' ? 1.6 : zone === 'mid' ? 0.6 : 0);
    if (sp > GKR.rebMin && sp > rebLine) {
      // REBOUND (Nov 22 goalie pass): it used to always kick straight back into the slot, and only off the hardest shots, so
      // goalies caught 86% of everything. Now more shots come off him, and his Rebound Control decides WHERE: a good one
      // steers it wide to the corner, a poor one leaves it in the slot. The goalie is down for a moment either way.
      const ctl = clamp(GKR.rebCtl + (A(g, 'reb') - 5) * GKR.rebCtlPer - gFat(g) * 0.2, 0.1, 0.85);
      if (Math.random() < ctl) { const side = Math.sign(puck.x - g.x) || (Math.random() < 0.5 ? -1 : 1); puck.vx = side * rand(1.5, 2.5); puck.vy = -puck.vy * rand(0.08, 0.2); }
      else { puck.vy = -puck.vy * rand(0.3, 0.45); puck.vx = puck.vx * 0.3 + rand(-2.4, 2.4); }
      g.block = 22; g.down = Math.round(45 * (1.4 - A(g, 'rec') * 0.08) * (1 + gFat(g) * 0.5)); puck.lastTouch = g; puck.reboundT = S.t;
      floaters.push({ x: g.x, y: g.y - 32, text: 'SAVE!', life: 40, color: '#ffffff' });
    } else {
      resolvePending(g.team);
      puck.owner = g; g.hold = 55; g.gpT = 0; g.gCharge = null; g.gAim = null; puck.vx = puck.vy = 0; puck.lastTouch = g; statPossess(g);
      if (sp > 3) floaters.push({ x: g.x, y: g.y - 32, text: 'SAVE!', life: 40, color: '#ffffff' });
    }
    if (hard && zone && S.phase === 'live') clipEvent('save', { text: 'SAVE! ' + plTag(g) + (puck.shooterPl ? ' STOPS ' + puck.shooterPl.last.toUpperCase() : ''), team: g.team, goalie: g.pl ? g.pl.id : null, players: [g.pl && g.pl.id, puck.shooterPl && puck.shooterPl.id].filter(Boolean) }, sp > 6.6 ? 30 : 22);
    if (hard && zone && Math.random() < 0.45) typeof voiceCue === 'function' && voiceCue('save');
    if (hard && zone) say(zone === 'high' ? ['FLASHES THE LEATHER! GLOVE SAVE!', `ROBBED BY #${g.num}!`, 'WHAT A GLOVE SAVE!']
                                          : zone === 'five' ? ['CLOSES THE NUTMEG JUST IN TIME!', 'SHUTS THE DOOR DOWN LOW!']
                                          : ['KICKS IT AWAY WITH THE PAD!', 'WHAT A SAVE!', 'THE KEEPER SAYS NO!'], 1, 0.45);
    sfx.save(zone === 'high' ? 'glove' : zone === 'five' ? 'pad' : null);
    return true;
  }
  puck.passed.add(g.id);
  return false;
}
// a skater who is facing the shooter and gets his body in the way of a travelling shot can block it.
// Defencemen are best at it; anyone in front of their own net gets a bonus; high shots are harder to block.
function tryBodyBlock(sh) {
  const sp = hyp(puck.vx, puck.vy); if (sp < 1.2 || puck.shotTeam == null) return false;
  const ux = puck.vx / sp, uy = puck.vy / sp, z = puckZ();
  if (z > 12) return false;
  puck.blockTried = puck.blockTried || new Set();
  for (const p of skaters) {
    if (p.team === puck.shotTeam || p.stun > 0 || p.block > 0 || p === puck.shooter) continue;
    const dx = p.x - puck.x, dy = p.y - puck.y, lane = puck.laneBlock === p.id;
    if (dx * dx + dy * dy > (lane ? Math.pow(Math.max(15, puck.laneR || 0), 2) : 7.2 * 7.2)) continue;
    if (puck.blockTried.has(p.id)) continue;
    puck.blockTried.add(p.id);
    const facing = -(p.fx * ux + p.fy * uy);                           // 1 = squared up to the shooter
    if (facing < 0.2 && !lane) continue;
    const isD = p.pl && /D$/.test(p.pl.spos || '') || p.pl && p.pl.pos === 'D';
    const ogy = ownGoalY(p.team), dNet = hyp(p.x - CX, p.y - ogy);
    let q = (isD ? PLAY.bodyBlockD : PLAY.bodyBlockF) + (dNet < 70 ? PLAY.bodyBlockNet : 0) + (A(p, 'def') - 5) * 0.035 + (facing - 0.6) * 0.25 - Math.max(0, sp - 4) * 0.025;
    if (z > 6) q *= 0.45;
    if (typeof lever === 'function') q *= lever(p.team, 'blockMul');
    if (lane) { q = 1; puck.laneBlock = null; }
    if (Math.random() >= clamp(q, 0.05, 0.85)) continue;
    // blocked: the puck comes off the body with most of its pace gone, bouncing off the way the angles send it
    // (square on: back toward the shooter; a glancing hit: off to the side)
    if (lane) {                                                       // a shell block in the lane: it dies at his feet and he gathers it
      const st = stickPoint(p, 6); puck.x = st.x; puck.y = st.y; puck.vx = puck.vy = 0;
    } else {
    deflectOff(p, p.x, p.y, rand(0.12, 0.22));                       // (off his body: same geometry whichever way the shot travels)
    { const a = Math.atan2(puck.vy, puck.vx); puck.x = p.x + Math.cos(a) * 7; puck.y = p.y + Math.sin(a) * 7; }
    }
    sh.done = true; puck.shot = null; puck.air = false; puck.lastTouch = p; puck.shotTeam = null; puck.passTarget = null;
    if (MS && !S.so) defEvent(p, 'block', puck.shooter);
    if (!lane && Math.random() < 0.15) { p.stun = 8; p.stunType = 'small'; }
    sfx.oof && sfx.oof(); excite(0.3);
    floaters.push({ x: p.x, y: p.y - 30, text: 'BLOCKED!', life: 45, color: '#ffffff' });
    say([`BLOCKED BY #${p.num}!`, `#${p.num} GETS IN FRONT OF IT!`, 'SHOT BLOCKED! WHAT A SACRIFICE!'], 1, 0.6);
    return true;
  }
  return false;
}
// the puck bounces off something at (cx, cy): mirrored about the line from that point to the puck, keeping `keep` of its speed
function deflectOff(p, cx, cy, keep) {
  const sp = hyp(puck.vx, puck.vy) || 1;
  let nx = puck.x - cx, ny = puck.y - cy, nd = hyp(nx, ny);
  if (nd < 0.01) { nx = -puck.vx / sp; ny = -puck.vy / sp; } else { nx /= nd; ny /= nd; }
  const dot = puck.vx * nx + puck.vy * ny;
  let rx = puck.vx - 2 * dot * nx, ry = puck.vy - 2 * dot * ny;
  if (rx * puck.vx + ry * puck.vy > 0.6 * sp * sp) { const s2 = Math.sign(nx * -puck.vy + ny * puck.vx) || 1; rx = -puck.vy * s2; ry = puck.vx * s2; }   // a glancing touch: it squirts off to the side, never straight on through
  const a = Math.atan2(ry, rx) + rand(-0.35, 0.35), out = Math.max(0.6, sp * keep);
  puck.vx = Math.cos(a) * out; puck.vy = Math.sin(a) * out;
  if (p) p.block = Math.max(p.block || 0, 8);
}
// PASS STEAL: press Shift as a loose puck or one of their passes goes by your stick and you reach out and take it
const STEAL = { window: 10, reach: 15, base: 0.85 };
function stealable(p) {
  if (puck.owner || puck.shot || puck.inNet || S.phase !== 'live') return false;
  if (puck.passFrom && puck.passFrom.team === p.team) return false;        // not your own team's pass
  if (hyp(puck.vx, puck.vy) < 0.6) return false;                           // just sitting there: an ordinary poke / pickup
  const bw = bladeWorld(p);
  for (let t = 0; t <= STEAL.window; t += 1) {                              // does it come within reach of the blade in the next few frames?
    const px = puck.x + puck.vx * t, py = puck.y + puck.vy * t, bx = bw.x + p.vx * t, by = bw.y + p.vy * t;
    if (hyp(px - bx, py - by) <= STEAL.reach) return true;
  }
  return false;
}
function tryPickup() {
  const sp = hyp(puck.vx, puck.vy);
  let best = null, bd = 1e9;
  for (const p of ((S.t & 1) ? skaters.slice().reverse() : skaters)) {
    if (p.stun > 0 || p.block > 0) continue;
    if (cpuT(p.team) && S.cpuDelay > 0 && !(p.role === 1 && S.foWinner === p.team)) continue;
    if (S.phase === 'penalty' && (S.pen.taken || p !== S.pen.shooter)) continue;
    const st = stickPoint(p, 5), bw = bladeWorld(p);
    const d = Math.min(hyp(puck.x - p.x, puck.y - p.y), hyp(puck.x - st.x, puck.y - st.y), hyp(puck.x - bw.x, puck.y - bw.y));   // (his blade, where you see it, counts)
    let r = p === puck.passTarget ? 11.5 : 8.5;
    if (S.assist && p === ctrl && !S.autoAI) r = Math.max(r, PLAY.humanReach);   // a little forgiveness for keyboard aim on loose pucks (passes to anyone: 11.5)
    const stealing = (p.stealT || 0) >= S.t && !puck.shot && !(puck.passFrom && puck.passFrom.team === p.team);
    if (stealing) r = Math.max(r, STEAL.reach);
    if (puck.passFrom && puck.passFrom.team !== p.team && p !== puck.passTarget && typeof lever === 'function') {
      r *= lever(p.team, 'cutReach');                                                                 // Weak-Side Lock: sticks in the passing lanes
      if (hyp(puck.x - CX, puck.y - ownGoalY(p.team)) < RK(85)) r *= 1 + (lever(p.team, 'slotCut') - 1) * 0.5;   // Defensive Shell: sticks down in the slot
    }
    if (d > r) continue;
    if (stealing) {                                                         // the steal: one stab at it, much better than a passive stick in the lane
      p.stealT = 0;
      const q = clamp(STEAL.base - Math.max(0, sp - 3) * 0.05 + (A(p, 'def') - 5) * 0.03 - Math.max(0, d - 10) * 0.02, 0.5, 0.95);
      if (Math.random() >= q) { puck.vx *= 0.8; puck.vy *= 0.8; p.block = 8; floaters.push({ x: p.x, y: p.y - 30, text: 'JUST MISSED IT', life: 30, color: '#ff7a6e' }); sfx.stick(); continue; }
      p.stoleT = S.t;
    } else {
    if (sp > 5.2 && p !== puck.passTarget && Math.random() > 0.07) continue;
    // a moving shot or pass reaching an opponent: blocked / picked off only some of the time (once per player per puck)
    if (p !== puck.passTarget && sp > 2.4 && S.phase === 'live' && ((puck.shot && puck.shotTeam !== p.team) || (puck.passFrom && puck.passFrom.team !== p.team))) {
      puck.cutTried = puck.cutTried || new Set();
      if (puck.cutTried.has(p.id)) continue;
      puck.cutTried.add(p.id);
      const isShot = !!puck.shot;
      const q = clamp((isShot ? PLAY.blockBase : PLAY.cutBase) - (sp - 2.5) * 0.1 - (isShot ? 0 : (puck.passPow || 0) * PLAY.passPowCut) + (A(p, 'def') - 5) * 0.035 - d * 0.03, 0.04, 0.75) * (!isShot && typeof lever === 'function' ? lever(p.team, 'cutPass') * (hyp(puck.x - CX, puck.y - ownGoalY(p.team)) < RK(85) ? lever(p.team, 'slotCut') : 1) * (TAC.poss[1 - p.team] && TAC.poss[1 - p.team].settled ? lever(p.team, 'vsCycleCut') : 1) * (zoneOf(p.team, puck.y) === 'neu' ? lever(p.team, 'nzCut') : 1) : 1);
      if (Math.random() >= q) {
        // not controlled, but it can still clip his stick: it glances off with most of its pace gone
        if (isShot && d < 6.5 && Math.random() < 0.45) {
          const stp = stickPoint(p, 5); deflectOff(p, stp.x, stp.y, rand(0.22, 0.34));
          puck.shot = null; puck.shotTeam = null; puck.lastTouch = p; puck.passTarget = null; puck.passed.clear();
          floaters.push({ x: p.x, y: p.y - 30, text: 'OFF THE BOOT', life: 30, color: '#dbe9ff' }); sfx.stick();
          return false;
        }
        continue;
      }
    }
    }
    if (p === puck.passTarget && !puck.recvTried) {          // a hard pass can skip off the stick
      puck.recvTried = true;
      let rc = receiveChance(p, sp);
      if (typeof lever === 'function' && (puck.passD || 0) > RK(110) && TAC.regainT && S.t - TAC.regainT[p.team] < 200 && lever(1 - p.team, 'killStretch', 0) <= 0)   // Counterattack: the stretch pass (not through a trap)
        rc = 1 - (1 - rc) * lever(p.team, 'stretch') * (TAC.deep && S.t - TAC.deep[p.team] < 200 ? lever(p.team, 'deepStretch') : 1);
      if (Math.random() > rc) { puck.vx *= 0.7; puck.vy *= 0.7; puck.vx += rand(-0.8, 0.8); puck.passTarget = null; p.block = 10; floaters.push({ x: p.x, y: p.y - 30, text: 'OFF THE BOOT', life: 30, color: '#ff7a6e' }); continue; }
    }
    if (d < bd) { bd = d; best = p; }
  }
  if (!best) return false;
  const prevTeam = puck.lastTouch ? puck.lastTouch.team : -1;
  if (MS && !S.so && S.phase === 'live') {
    resolvePending(best.team);
    const sh = puck.shot && puck.shotTeam !== null && puck.shotTeam !== best.team && !puck.shot.done;
    if (sh) defEvent(best, 'block', puck.shooter);                                   // got in front of a shot
    else if (puck.passFrom && puck.passFrom.team !== best.team && S.t - (puck.passT || -999) < 110) {   // picked off a pass
      defEvent(best, 'intercept', puck.passTarget && puck.passTarget.team !== best.team ? puck.passTarget : null);
      if (puck.passFrom.pl) { pst(puck.passFrom.pl, puck.passFrom.team).gv++; if (typeof chillEv === 'function') chillEv(puck.passFrom, 'gv'); }
    }
  }
  const wasPass = best === puck.passTarget;
  statPossess(best, wasPass && puck.passFrom && puck.passFrom.team === best.team ? puck.passFrom : null);
  const rebound = S.t - (puck.reboundT || -999) < 70 && puck.lastTouch && puck.lastTouch.g && puck.lastTouch.team !== best.team;
  if (wasPass) { best.recvT = S.t; best.recvAt = performance.now(); best.otUsed = false; }
  puck.owner = best; puck.passTarget = null; puck.shotTeam = null; puck.lastTouch = best; puck.passed.clear(); puck.iceTeam = null; puck.shot = null; puck.air = false; puck.h = 0; puck.vh = 0;
  puck.vx = puck.vy = 0;
  sfx.pick();
  if (rebound) { best.rebT = S.t; floaters.push({ x: best.x, y: best.y - 32, text: 'REBOUND!', life: 40, color: '#9fd0ff' }); excite(0.6); say(['REBOUND! LOOSE BALL IN THE BOX!', 'HE POUNCES ON THE REBOUND!'], 1, 0.45); }
  else if (best.stoleT === S.t) { floaters.push({ x: best.x, y: best.y - 32, text: 'PICKED OFF!', life: 40, color: '#ffd23f' }); say(['PICKED OFF! WHAT A READ!', 'HE STEPS IN FRONT OF IT!', 'READ THAT PASS ALL THE WAY!'], 1, 0.6); excite(0.4); }
  else if (best.team === 0 && prevTeam === 1) { floaters.push({ x: best.x, y: best.y - 32, text: 'STEAL', life: 30, color: '#9fd0ff' }); say(['STRIPPED HIM CLEAN!', 'NICE TAKEAWAY!'], 1, 0.2); }
  if (S.phase === 'live' && wasPass) {
    // YOUR ONE-TIMER: SHOOT pressed while the pass was on its way (or held as it arrives). Timed just before it gets
    // there = the full one-timer; pressed early = a solid one, a little less sharp
    // YOUR ONE-TIMER: one press of SHOOT just before the pass gets there (or just after, below). Pressed too early or
    // more than once while it travelled: no one-timer this time, and no second try after it arrives
    if (best === ctrl && !S.autoAI) {
      const pressed = best.otPass === puck.passT, spam = best.otSpam === puck.passT;
      const timed = pressed && !spam && performance.now() - best.otAt <= otAntiWindow() * (1 - passHardness(best) * 0.3) + ((best.rcvSet || 0) > 4 ? 110 : 0);
      best.otAt = 0; best.otPass = null; best.otSpam = null; best.otUsed = pressed;
      if (timed) { oneTimer(best, 0.8, 'anti'); return true; }
    }
    if (best !== ctrl || S.autoAI) {
      const gy = oppGoalY(best.team), up = attackDir(best.team), dg = hyp(CX - best.x, gy - best.y);
      const q = aiD(best.team).oneT * (typeof lever === 'function' ? lever(1 - best.team, 'oneTAgainst') : 1) * ((best.rcvSet || 0) > 8 ? PLAY.otSetMul : 1) * (1 - passHardness(best) * 0.45);
      const ozD = (best.y - (isUp(best.team) ? BLUE_TOP : BLUE_BOT)) * up, pointOk = ozD >= 34 * RINK_S || (A(best, 'pow') >= 9 && A(best, 'acc') >= 8 && Math.random() < 0.15);
      if (dg < 140 && (gy - best.y) * up > 14 && ozD >= 0 && pointOk && Math.random() < q) { best.rcvSet = 0; oneTimer(best, rand(0.5, 0.95)); return true; }
    }
    best.rcvSet = 0;
  }
  return true;
}
function updatePuck() {
  if (puck.inNet) { puck.vx *= 0.9; return; }
  const o = puck.owner;
  if (o) {
    // stick-handling taps (only the puck carrier you can see)
    if (!o.g && hyp(o.vx, o.vy) > 0.5) { const ph = Math.floor(o.anim * 0.8 / Math.PI); if (ph !== o.drib) { o.drib = ph; if (S.phase !== 'title') sfx.dribble(); } }
    // a skater carries it on the tape of his blade, exactly where it is drawn (the deke and the backhand are already in
    // the blade's place); a goalie holds it on his own right, whichever end he guards
    const st = o.g ? { x: o.x - 7 * attackDir(o.team), y: o.y + 8 * attackDir(o.team) } : bladeWorld(o);
    const prevX = puck.x, prevY = puck.y;
    puck.x = st.x; puck.y = st.y;
    if (!o.g) { const tmp = { x: puck.x, y: puck.y, vx: 0, vy: 0 }; constrain(tmp, PUCK_R + 1, 0); puck.x = tmp.x; puck.y = tmp.y; if (S.phase === 'live' && !o.restart) keepOnPitch(puck, PUCK_R + 0.5, true); }
    puck.vx = o.vx; puck.vy = o.vy;
    if (!o.g) {
      for (const n of NETS) {
        if (puck.x > n.x0 && puck.x < n.x1 && puck.y > n.y0 && puck.y < n.y1) {
          const fromFront = n.front > 0 ? prevY >= n.lineY - 0.5 : prevY <= n.lineY + 0.5;
          if (fromFront && Math.abs(puck.x - CX) <= GOAL_HW && n.team !== o.team) { if (!creaseStop(o, n)) { puck.owner = null; puckNets(prevX, n.lineY + n.front); } }
          else if (n.team === o.team && fromFront) {      // your own net: an invisible wall on the goal line; you keep the puck
            puck.x = prevX; puck.y = n.lineY + n.front * (PUCK_R + 1.5);
            const into = o.vy * -n.front; if (into > 0) o.vy += into * n.front;   // stop his skating into it
          }
          else { releasePuck(o, -o.vx * 0.5, -o.vy * 0.5, 20); puck.x = prevX; puck.y = prevY; }
          break;
        }
      }
    }
    return;
  }
  if (puck.h > 0 || puck.vh > 0) airTick();
  if (puck.curve) curveTick();
  const sp = hyp(puck.vx, puck.vy);
  const n = Math.max(1, Math.ceil(sp / 2.5));
  for (let i = 0; i < n; i++) {
    const px = puck.x, py = puck.y;
    puck.x += puck.vx / n; puck.y += puck.vy / n;
    const hit = constrain(puck, PUCK_R, puck.rim ? 0 : 0.62);
    if (puck.rim) rimHug(puck);
    if (hit > 1.5) { if (puck.air) sfx.glassPuck(hit); else sfx.board(hit); boardScuff(puck.x, puck.y, hit); }   // (a puck in the air hits the glass, not a post)
    if (hit > 0.3) { puck.air = false; if (puck.shot && puck.shot.done) puck.shot = null; }
    const sh = puck.shot;
    if (sh && !sh.done && S.phase === 'live' && tryBodyBlock(sh)) break;
    if (sh && !sh.done) {
      const crossed = sh.gy === GL_TOP ? (py >= GL_TOP && puck.y < GL_TOP) : (py <= GL_BOT && puck.y > GL_BOT);
      if (crossed) {
        sh.done = true;
        if (sh.cat === 'bar' && Math.abs(puck.x - CX) <= GOAL_HW + 1.5) {
          puck.y = sh.gy + (sh.gy === GL_TOP ? 2 : -2); puck.vy = -puck.vy * 0.45; puck.vx += rand(-1.6, 1.6); puck.shot = null;
          sfx.post(); excite(0.6);
          floaters.push({ x: puck.x, y: sh.gy - 22, text: 'CROSSBAR!', life: 50, color: '#ffffff' });
          say(['CROSSBAR! INCHES AWAY!', 'OFF THE BAR AND OUT!', 'DING! HE HITS THE CROSSBAR!'], 2);
          continue;
        }
        if (sh.cat === 'over') { puck.air = true; say(['HE MISSES HIGH. OFF THE STANDS.', 'OVER THE NET AND OFF THE BACK HOARDINGS.'], 1, 0.5); }
        if (sh.cat === 'wide') say(['WIDE OF THE NET.', 'JUST MISSES THE FAR SIDE.'], 1, 0.35);
      }
    }
    if (puck.h > AIR.foot && i === n - 1 && aerialContact()) return;   // SOCCER: headers, volleys, the keeper's hands
    if (puck.air) {   // sailing over the net: no net or goalie until it is past the back of the net
      if (puck.y < GL_TOP - NET_D - 3 || puck.y > GL_BOT + NET_D + 3) puck.air = false; else continue;
    }
    if (puckNets(px, py)) return;
    if (!live()) continue;
    if (false && S.rules && S.phase === 'live' && puck.iceTeam !== null && !S.icing &&   // SOCCER: no icing !(typeof shortHanded === 'function' && shortHanded(puck.iceTeam)) &&
        (isUp(puck.iceTeam) ? puck.y < GL_TOP - 1 : puck.y > GL_BOT + 1)) { startIcingRace(puck.iceTeam); }
    if (puck.h > AIR.foot) continue;
    if (tipCheck()) continue;
    if ((goalies[0] && goalieSave(goalies[0])) || (goalies[1] && goalieSave(goalies[1]))) return;
    if (tryPickup()) return;
  }
  if (puck.rim && (puck.owner || puck.shot || hyp(puck.vx, puck.vy) < RIM.minSp || S.t - puck.rim.t > RIM.life || S.phase !== 'live')) puck.rim = null;
  if (sp > 4) puck.trail.push({ x: puck.x, y: puck.y, life: 10 });
  { const f = puck.h > 0 ? AIR.fric : BALL_FRIC; puck.vx *= f; puck.vy *= f; }   // SOCCER: grass slows it more than ice did (and the air hardly at all)
  if (hyp(puck.vx, puck.vy) < 0.03) { puck.vx = puck.vy = 0; }
  if (puck.passTarget && hyp(puck.vx, puck.vy) < 1.3) puck.passTarget = null;
}
// ---------- SOCCER: THE SLIDE TACKLE. He goes to ground and slides through: get the ball first and it's yours to
// knock away; take the man first (worse from behind) and it's a foul, maybe a card. Committed: a miss leaves you on
// the floor while he runs on
const SLIDE = { speed: 2.7, frames: 26, reach: 9, ballFirst: 3, aiRate: 0.007 };
function slideTackle(p) {
  if (p.g || p.cd > 0 || p.stun > 0 || hasPuck(p) || p.slide > 0) return false;
  const o = puck.owner, tx = o ? puck.x + o.vx * 6 : puck.x + puck.vx * 4, ty = o ? puck.y + o.vy * 6 : puck.y + puck.vy * 4;
  const d = hyp(tx - p.x, ty - p.y) || 1;
  const fx = d < 60 ? (tx - p.x) / d : p.fx, fy = d < 60 ? (ty - p.y) / d : p.fy;
  p.fx = fx; p.fy = fy;
  p.slide = SLIDE.frames; p.stun = SLIDE.frames + 10; p.stunType = 'slide'; p.cd = 50; p.charge = -1; p.lunge = 0;
  p.vx = fx * SLIDE.speed * (0.9 + A(p, 'spd') * 0.02); p.vy = fy * SLIDE.speed * (0.9 + A(p, 'spd') * 0.02);
  p.slideHit = false;
  if (!S.fastSim) sfx.poke();
  return true;
}
function slideTick() {
  for (const p of skaters) {
    if (p.slide > 0) {
      p.slide--;
      if (p.slideHit || S.phase !== 'live') continue;
      const o = puck.owner, dBall = hyp(puck.x - p.x, puck.y - p.y);
      if (o && o.team === p.team) continue;
      if (dBall < SLIDE.reach + 1.5 && (!o || dBall + SLIDE.ballFirst < hyp(o.x - p.x, o.y - p.y) + 4)) {   // the ball first: won
        p.slideHit = true;
        const kx = p.vx * 0.9 + rand(-0.6, 0.6), ky = p.vy * 0.9 + rand(-0.6, 0.6);
        if (o) { releasePuck(o, kx, ky, 26); o.slow = 30; if (Math.random() < 0.4) { o.stun = Math.max(o.stun, 24); o.stunType = 'trip'; o.down = 30; o.fall = 0; o.fallSide = Math.random() < 0.5 ? -1 : 1; } }
        else { puck.vx = kx; puck.vy = ky; puck.h = 0; puck.vh = 0; }
        puck.lastTouch = p; puck.passTarget = null; puck.shot = null; puck.shotTeam = null;
        floaters.push({ x: p.x, y: p.y - 26, text: 'SLIDE TACKLE!', life: 40, color: '#ffd23f' });
        if (MS && p.pl) { if (typeof statHit === 'function') statHit(p); if (o) defEvent(p, 'poke', o); }   // (counts as a tackle: the TKL stat)
        if (!S.fastSim) sfx.stick();
        continue;
      }
      if (o && !o.g && hyp(o.x - p.x, o.y - p.y) < SLIDE.reach) {                  // the man first: a foul (a late one from behind is worse)
        p.slideHit = true;
        const s0 = hyp(o.vx, o.vy), hx = s0 > 0.4 ? o.vx / s0 : o.fx, hy = s0 > 0.4 ? o.vy / s0 : o.fy;
        const behind = (p.x - o.x) * hx + (p.y - o.y) * hy < -2;
        o.down = 46; o.stun = Math.max(o.stun, 48); o.stunType = 'trip'; o.fall = 0; o.fallSide = Math.random() < 0.5 ? -1 : 1;
        releasePuck(o, o.vx * 0.6, o.vy * 0.6, 30);
        floaters.push({ x: o.x, y: o.y - 30, text: behind ? 'FROM BEHIND!' : 'TRIPPED!', life: 40, color: '#ff7a6e' });
        if (S.rules && Math.random() < (behind ? 0.9 : 0.45)) callFoul(behind ? 'behind' : 'trip', p, o);
      }
    } else if (cpuT(p.team) && S.phase === 'live' && !(p.stun > 0) && !(p.cd > 0) && !hasPuck(p) && S.cpuDelay <= 0) {
      const o = puck.owner;                                                           // the computer slides in now and then
      if (o && !o.g && o.team !== p.team) {
        const d = hyp(o.x - p.x, o.y - p.y);
        if (d > 10 && d < 24 && Math.random() < SLIDE.aiRate * (S.diff === 'EASY' ? 0.5 : S.diff === 'HARD' ? 1.3 : 1) * (0.6 + A(p, 'def') * 0.08)) slideTackle(p);
      }
    }
  }
}
// ---------- SOCCER: BEND. Strike it with the direction keys held ACROSS the line of the kick and it curls that way
// (free kicks round the wall, crosses whipped in, shots bent inside the post). puck.curve = turn per frame (radians)
function curveTick() {
  const c = Math.cos(puck.curve), s = Math.sin(puck.curve), vx = puck.vx, vy = puck.vy;
  puck.vx = vx * c - vy * s; puck.vy = vx * s + vy * c;
  puck.curve *= 0.965; if (Math.abs(puck.curve) < 0.0004 || puck.owner || hyp(puck.vx, puck.vy) < 0.6) puck.curve = 0;
  const sh = puck.shot;                                                       // re-judge a shot's line as it bends
  if (sh && !sh.done && (sh.cat === 'net' || sh.cat === 'wide' || sh.cat === 'post') && Math.abs(puck.vy) > 0.3) {
    let x = puck.x, y = puck.y, bx = puck.vx, by = puck.vy, k = puck.curve;
    for (let i = 0; i < 80 && (sh.gy === GL_TOP ? y > GL_TOP : y < GL_BOT); i++) { const cc = Math.cos(k), ss = Math.sin(k), nx = bx * cc - by * ss; by = bx * ss + by * cc; bx = nx; k *= 0.965; x += bx; y += by; }
    const off = Math.abs(x - CX);
    sh.cat = off < GOAL_HW - 1 ? 'net' : off < GOAL_HW + 1.5 ? 'post' : 'wide';
  }
}
function humanBend(p) {   // after a kick of yours: the direction held across it becomes bend
  if (cpuT(p.team) || puck.owner === p) return;
  const ix = p.inx || 0, iy = p.iny || 0, sp = hyp(puck.vx, puck.vy) || 1;
  if (!ix && !iy) return;
  const across = (puck.vx * iy - puck.vy * ix) / sp;                          // + = bend to the right of the ball's path
  if (Math.abs(across) < 0.3) return;
  puck.curve = clamp(across, -1, 1) * 0.011 * (0.6 + (A(p, 'acc') + A(p, 'fo')) * 0.04);   // (the SP set-piece rating bends it most)
}
// ---------- SOCCER: THE AERIAL GAME
function airTick() {
  puck.vh -= AIR.grav; puck.h += puck.vh;
  if (puck.h <= 0) {
    puck.h = 0;
    if (puck.vh < -1.3) { puck.vh = -puck.vh * AIR.bounce; puck.vx *= 0.8; puck.vy *= 0.8; if (!S.fastSim) sfx.stick(); }   // a bounce
    else puck.vh = 0;
  }
  puck.air = puck.h > AIR.bar;                     // over the bar: it sails over the goal (and the keeper's net) untouched
}
// launch the ball in the air: it comes down about at (tx, ty); `hang` = frames until it would land
function loftBall(p, tx, ty, hang, target) {
  const d = hyp(tx - puck.x, ty - puck.y) || 1, T = hang || clamp(18 + d * 0.12, 22, 56);
  const v = Math.min(8.5, d * (1 - AIR.fric) / (1 - Math.pow(AIR.fric, T)));   // (air drag over the flight: it lands where aimed)
  releasePuck(p, (tx - puck.x) / d * v, (ty - puck.y) / d * v, 14);
  puck.h = 0.5; puck.vh = AIR.grav * T / 2; puck.loftT = S.t; puck.lastTouch = p;
  puck.passTarget = target || null; puck.passFrom = p; puck.passT = S.t; puck.passD = d;
  p.charge = -1; sfx.pass();
}
// a cross / lofted pass to a teammate: dropping onto his head (it lands a step past him)
function crossTo(p, m) {
  const d = hyp(m.x - puck.x, m.y - puck.y) || 1, T = clamp(20 + d * 0.11, 24, 52);
  const lead = Math.min(14, T * 0.5);
  const tx = m.x + (m.vx || 0) * lead + (m.x - puck.x) / d * 5, ty = m.y + (m.vy || 0) * lead + (m.y - puck.y) / d * 5;
  loftBall(p, tx, ty, T, m);
  const wide = Math.abs(p.x - CX) > PEN_HW - 30 && Math.abs(oppGoalY(p.team) - p.y) < PEN_D + 70;
  floaters.push({ x: p.x, y: p.y - 30, text: wide ? 'CROSS!' : 'LOFTED BALL', life: 30, color: '#dbe9ff' });
  if (wide) say(['HE WHIPS IN A CROSS...', 'A BALL INTO THE BOX...', 'CROSSED IN FROM THE WING...'], 1, 0.5);
  if (MS && p.pl) { const st = pst(p.pl, p.team); st.crs = (st.crs || 0) + 1; }
}
// THE LOFT BUTTON (you): near goal and facing it = a CHIP over the keeper; out wide = a cross to the man in the box;
// anywhere else = a lofted pass to the teammate you're facing (or straight ahead, long, if there's nobody)
function loftAction(p) {
  if (!hasPuck(p)) return;
  const t = p.team, gy = oppGoalY(t), up = attackDir(t), dGoal = hyp(CX - p.x, gy - p.y) || 1;
  const facing = ((CX - p.x) * p.fx + (gy - p.y) * p.fy) / dGoal;
  if (dGoal < 170 && facing > 0.55 && Math.abs(p.x - CX) < PEN_HW + 10) {        // the CHIP
    const g = goalies[1 - t], side = g ? (g.x > CX ? -1 : 1) : (Math.random() < 0.5 ? -1 : 1);
    const ax = CX + side * (GOAL_HW - 7) + rand(-4, 4) * (1.4 - A(p, 'acc') * 0.08), ay = gy + up * (7 + rand(-4, 8) * (1.4 - A(p, 'acc') * 0.08));   // lands inside the net: it crosses the line falling, under the bar
    const dC = hyp(ax - puck.x, ay - puck.y);
    const T = clamp(34 + dC * 0.12, 40, 54);
    loftBall(p, ax, ay, T);   // a high arc: over him, dropping under the bar
    if (g && Math.abs(g.y - gy) > 14) { g.lobbed = S.t + T; g.lobX = ax; g.lobY = gy + up * 6; }   // caught off his line: he has to turn and scramble back
    puck.shotTeam = t; puck.shooter = p; puck.shotT = S.t;
    floaters.push({ x: p.x, y: p.y - 30, text: 'CHIP!', life: 34, color: '#ffd23f' });
    say(['HE TRIES TO CHIP IT...', 'A CHEEKY CHIP!', 'HE LIFTS IT OVER...'], 1, 0.6);
    return;
  }
  const mates = teamSkaters(t).filter(m => m !== p && m.stun <= 0);
  let best = null, bs = -1e9;
  for (const m of mates) {
    const dx = m.x - p.x, dy = m.y - p.y, d = hyp(dx, dy) || 1, dot = (dx * p.fx + dy * p.fy) / d;
    if (d < 40) continue;
    const s = dot * 120 + (m.y - p.y) * up * 0.4 - d * 0.1 + (Math.abs(m.y - gy) < PEN_D + 12 && Math.abs(m.x - CX) < PEN_HW ? 40 : 0);
    if (dot > 0.2 && s > bs) { bs = s; best = m; }
  }
  if (best) { crossTo(p, best); return; }
  const tx = clamp(p.x + p.fx * 160, TL_L + 20, TL_R - 20), ty = clamp(p.y + p.fy * 160, GL_TOP + 20, GL_BOT - 20);
  loftBall(p, tx, ty, null, null);
  floaters.push({ x: p.x, y: p.y - 30, text: 'LONG BALL', life: 30, color: '#dbe9ff' });
}
// the ball comes down among players: the keeper claims it in his box; an attacker near goal HEADS or VOLLEYS it at
// goal; a defender heads it clear; anyone else brings it down
function aerialContact() {
  if ((S.phase !== 'live' && S.phase !== 'penalty') || puck.owner || puck.inNet) return false;
  if (S.t - (puck.loftT || -99) < 5) return false;
  const h = puck.h;
  for (const g of goalies) {
    if (!g || g.stun > 0 || g.down > 0 || g.on === false) continue;
    const gl = ownGoalY(g.team), inBox = Math.abs(puck.y - gl) < PEN_D && Math.abs(puck.x - CX) < PEN_HW;
    const sixYd = Math.abs(puck.y - gl) < SIX_D + 6 && Math.abs(puck.x - CX) < SIX_HW;
    const d = hyp(puck.x - g.x, puck.y - g.y), reach = (sixYd ? 16 : 11) + A(g, 'pos') * 0.5;   // he comes for anything into his six-yard box
    const lob = g.lobbed > S.t;                                                  // chipped and scrambling back: only a ball dropping right on him
    if (!inBox || d > (lob ? 11 : reach) || h > (lob ? 12 : AIR.keeperReach + A(g, 'ref') * 0.6)) continue;
    if (puck.lastTouch && puck.lastTouch.team === g.team && !puck.lastTouch.g) continue;   // (a back-pass in the air: he leaves it)
    puck.h = 0; puck.vh = 0; puck.air = false;
    if (Math.random() < 0.82 + (A(g, 'ref') - 5) * 0.03 - (h > 24 ? 0.15 : 0)) {
      puck.owner = g; puck.lastTouch = g; g.hold = 55; g.gpT = 0; g.gCharge = null; g.gAim = null; puck.vx = puck.vy = 0;
      puck.passTarget = null; puck.shotTeam = null; puck.shot = null; puck.passed.clear(); g.saveAnim = { kind: 'glove', hi: true, t0: S.t };
      floaters.push({ x: g.x, y: g.y - 40, text: 'CLAIMED!', life: 40, color: '#ffffff' }); sfx.pick();
      if (MS && g.pl) { const st = pst(g.pl, g.team); st.claims = (st.claims || 0) + 1; }
    } else {                                                                     // punched away
      const a = attackDir(g.team);
      puck.vx = rand(-2.5, 2.5); puck.vy = a * rand(2.8, 3.8); puck.h = 8; puck.vh = 1.6; puck.lastTouch = g; puck.passTarget = null;
      g.saveAnim = { kind: 'blocker', hi: true, t0: S.t }; floaters.push({ x: g.x, y: g.y - 40, text: 'PUNCHED CLEAR!', life: 40, color: '#ffffff' }); sfx.post && sfx.stick();
    }
    return true;
  }
  if (h > AIR.headHi) return false;
  let best = null, bd = 1e9;
  for (const p of (typeof keeperUpList === 'function' ? skaters.concat(keeperUpList()) : skaters)) {   // (a keeper up for a corner goes for it too)
    if (p.stun > 0 || p.block > 0 || p.on === false) continue;
    if (cpuT(p.team) && S.cpuDelay > 0) continue;
    if (S.phase === 'penalty' && p !== S.pen.shooter) continue;
    const d = hyp(puck.x - p.x, puck.y - (p.y - 2));
    const r = (p === puck.passTarget ? 11 : 8.5) + (h >= AIR.headLo ? 1.5 : 0);
    if (d < r && d < bd) { bd = d; best = p; }
  }
  if (!best) return false;
  // a contested ball: the strongest in the air wins it
  const rival = skaters.filter(o => o !== best && o.team !== best.team && o.stun <= 0 && o.on !== false && hyp(puck.x - o.x, puck.y - o.y) < 13)[0];
  if (rival) {
    const air = q => A(q, 'pow') + A(q, 'chk') * 0.7 + (typeof hasTrait === 'function' && q.pl && hasTrait(q.pl, 'counterpuncher') ? 3 : 0) + 2;
    if (Math.random() < air(rival) / (air(best) + air(rival))) best = rival;
    if (h >= AIR.headLo) floaters.push({ x: best.x, y: best.y - 36, text: 'WINS THE HEADER', life: 30, color: '#dbe9ff' });
  }
  const p = best, t = p.team, gy = oppGoalY(t), dGoal = hyp(CX - p.x, gy - p.y) || 1;
  const attacking = Math.abs(p.y - gy) < PEN_D + 30 && Math.abs(p.x - CX) < PEN_HW + 12;
  const nearOwn = Math.abs(p.y - ownGoalY(t)) < PEN_D + 50;
  const header = h >= AIR.headLo;
  puck.h = 0; puck.vh = 0; puck.air = false;
  if (attacking) {                                                               // HEADER / VOLLEY at goal
    puck.owner = p; puck.lastTouch = p; puck.passTarget = null; puck.passed.clear(); puck.shot = null; p.charge = -1;
    p.fx = (CX - p.x) / dGoal; p.fy = (gy - p.y) / dGoal;
    puck.x = p.x + p.fx * 4; puck.y = p.y + p.fy * 4;
    floaters.push({ x: p.x, y: p.y - 40, text: header ? 'HEADER!' : 'VOLLEY!', life: 45, color: '#ffd23f' });
    if (header) say(['HE RISES... HEADER!', 'GETS HIS HEAD ON IT!', 'A BULLET HEADER!'], 2); else say(['ON THE VOLLEY!', 'HE HITS IT FIRST TIME, IN THE AIR!'], 2);
    shoot(p, header ? clamp(0.3 + A(p, 'pow') * 0.03, 0.3, 0.6) : 0.9);
    if (puck.shot) puck.shot.kind = header ? 'header' : 'volley';
    if (MS && p.pl) { const st = pst(p.pl, t); if (header) st.hdr = (st.hdr || 0) + 1; }
    excite(0.4);
    return true;
  }
  if (nearOwn && header && (!puck.lastTouch || puck.lastTouch.team !== t)) {   // a defender heads it clear
    const a = attackDir(t);
    if (Math.random() < 0.3) releasePuck(p, (p.x < CX ? -1 : 1) * rand(2.6, 3.6), -a * rand(0.6, 1.6), 12);   // under pressure: just away, wide (often out for a corner)
    else releasePuck(p, rand(-1.8, 1.8), a * rand(3, 4), 12);
    puck.h = 6; puck.vh = 1.7; puck.lastTouch = p; puck.loftT = S.t;
    floaters.push({ x: p.x, y: p.y - 36, text: 'HEADED CLEAR', life: 30, color: '#dbe9ff' });
    if (MS) defEvent && defEvent(p, 'block', null);
    return true;
  }
  // brought down: chest, thigh or a first touch, and it drops at his feet
  puck.vx *= 0.25; puck.vy *= 0.25; puck.x = p.x + (p.fx || 0) * 6; puck.y = p.y + (p.fy || 0) * 6;
  if (header) floaters.push({ x: p.x, y: p.y - 34, text: 'CHESTED DOWN', life: 26, color: '#dbe9ff' });
  return false;
}
function checkOffside() {
  return;   // SOCCER: no blue-line offside (3-on-3 plays without offside)
  if (!S.rules || S.phase !== 'live') return;
  const py = puck.y, prev = S.prevPY;
  const resp = puck.owner ? puck.owner.team : puck.lastTouch ? puck.lastTouch.team : -1;
  if (resp < 0) return;
  if (isUp(resp) && prev >= BLUE_TOP && py < BLUE_TOP) {
    if (teamSkaters(resp).some(s => s !== puck.owner && !s.chgGo && s.y < BLUE_TOP - 10)) callOffside(resp);
  } else if (!isUp(resp) && prev <= BLUE_BOT && py > BLUE_BOT) {
    if (teamSkaters(resp).some(s => s !== puck.owner && !s.chgGo && s.y > BLUE_BOT + 10)) callOffside(resp);
  }
}

// ====================================================================
//  MAIN UPDATE
// ====================================================================
function tickFx() {
  S.t++;
  if (S.hintT > 0) S.hintT--;
  if (S.goalFlash > 0) S.goalFlash--;
  if (S.cheer > 0) S.cheer--;
  for (let i = 0; i < 2; i++) if (S.lamp[i] > 0) S.lamp[i]--;
  for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vx *= 0.92; p.vy *= 0.92; p.life--; }
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
  for (const f of floaters) { f.y -= f.big ? 0.15 : 0.35; f.life--; }
  for (let i = floaters.length - 1; i >= 0; i--) if (floaters[i].life <= 0) floaters.splice(i, 1);
  for (const tr of puck.trail) tr.life--;
  puck.trail = puck.trail.filter(t => t.life > 0);
  if (S.banner && S.banner.life > 0) S.banner.life--;
  if (S.comm && S.comm.life > 0) S.comm.life--;
}
function update() {
  if (S.phase !== 'live' && S.phase !== 'penalty') for (const g of goalies) if (g) g.press = 0;
  // checking feel: a short freeze on contact (hit-stop) and a quick camera shake
  if (S.shake > 0.08 && !(S.pres && S.pres.shake === false)) { S.shake *= 0.84; S.shkX = (Math.random() * 2 - 1) * S.shake; S.shkY = (Math.random() * 2 - 1) * S.shake; } else { S.shake = 0; S.shkX = S.shkY = 0; }
  if (S.hitStop > 0) { S.hitStop--; return; }
  if (puck.owner) puck.owner.hadPuckT = S.t;     // (for interference: who just had it)
  tickFx(); setupTick(); if (typeof grudgeTick === "function") grudgeTick(); if (typeof pbTick === 'function') pbTick();
  if (!S.fastSim) updateRefs();           // (S.fastSim: the balance-test runner, nobody watching)
  const clearIn = () => { input.spacePressed = input.shiftPressed = input.passPressed = input.pokePressed = input.linePressed = input.coverPressed = input.dekePressed = false; input.dekeKind = null; };
  if (S.scen && typeof scenTick === 'function' && scenTick()) { clearIn(); updateCamera(); return; }
  if (S.mode && typeof modeTick === 'function' && modeTick()) { clearIn(); for (const p of players) movePlayer(p); updatePuck(); updateCamera(); return; }
  if (S.walk && typeof walkTick === 'function') { walkTick(); clearIn(); updateCamera(); return; }   // the teams are walking out
  for (const p of players) if (p.foSwipe > 0) p.foSwipe--;
  barFadeTick();                    // (Nov 22) the faceoff stick swipe
  if (S.phase === 'faceoff' && S.fo && S.fo.kick != null) {
    if (S.pendingFight) S.pendingFight = null;
    const jbHold = typeof jbHolds === 'function' && jbHolds() && S.timer <= 40 && (S.fo.jbN = (S.fo.jbN || 0) + 1) < 60 * 12;   // (a replay on the big screen can hold the kickoff a while, never for ever)
    if (S.spot && S.spot.active) tickSpotlight(); else if (!S.lineHold && !jbHold) S.timer--;
    if (S.timer <= 30) kickOff();
    clearIn(); updateCamera(); drawMarks(); return;
  }
  if (S.phase === 'faceoff') {
    if (S.spot && S.spot.active) tickSpotlight(); else if (!S.lineHold && !(typeof extraPickVisible === 'function' && extraPickVisible() && RS().pick.held) && !(typeof jbHolds === 'function' && jbHolds() && S.timer <= FO.cueT + 30 && (S.fo.jbN = (S.fo.jbN || 0) + 1) < 60 * 12) && !(S.timer <= FO.readyT + 1 && !refsSet() && (S.fo.refN = (S.fo.refN || 0) + 1) < 60 * 3)) S.timer--;   // (the big screen, or a referee still getting set, can hold it a while, never for ever)
    if (!S.fo.readySaid && S.timer <= FO.readyT && !S.so && !S.demo && refs[0]) { S.fo.readySaid = true; floaters.push({ x: refs[0].x, y: refs[0].y - 30, text: 'READY?', life: 62, bubble: true }); }
    if (S.pendingFight && !(S.mode && /fight|spar/.test(S.mode.id || ''))) S.pendingFight = null;   // SOCCER: no fights
    if (S.pendingFight && S.timer < 128) {
      const pf = S.pendingFight; S.pendingFight = null;
      if (pf.ch.on && pf.target.on) { if (pf.go) startFight(pf.ch, pf.target); else offerFight(pf.ch, pf.target); clearIn(); return; }   // (go: already agreed during play)
    }
    // one tap only (a held key never counts; the first tap after the referee is set is the attempt)
    // the draw direction can be pressed before the tap: the last direction held during the faceoff counts, so Space
    // can be tapped on its own (two arrows + Space at once is a combo many laptop keyboards can't register)
    { const hx = (KR() ? 1 : 0) - (KL() ? 1 : 0), hy = (KD() ? 1 : 0) - (KU() ? 1 : 0); const f = S.fo; if (hx || hy) { if (f.aimC && f.aimC.x === hx && f.aimC.y === hy) f.aimN++; else { f.aimC = { x: hx, y: hy }; f.aimN = 1; } const nk = v => (v.x ? 1 : 0) + (v.y ? 1 : 0); if (!f.aim || f.aimN >= (nk(f.aimC) >= nk(f.aim) ? 4 : 14)) f.aim = f.aimC; } }   // (held a few frames: letting go of a diagonal one key at a time keeps it)
    if (input.spacePressed && !(S.spot && S.spot.active)) {
      if (S.fo.humanAt == null && S.timer <= FO.cueT) {
        S.fo.humanAt = input.spaceAt || performance.now(); S.fo.dir = input.spaceDir && (input.spaceDir.x || input.spaceDir.y) ? input.spaceDir : (S.fo.aim || { x: 0, y: 0 });
        const tk = S.fo.takers[0]; if (tk) tk.foSwipe = 10;                                       // (Nov 22) your centre swipes the moment you tap
        if (typeof sfx !== 'undefined' && sfx.poke) sfx.poke();
      }
    }
    if (!S.fo.dropped) {
      // whistle countdown: pip ... pip ... DROP (the referee's arm rises with each pip)
      const beat = S.timer <= S.fo.dropT + FO.beat ? 2 : S.timer <= S.fo.dropT + FO.beat * 2 ? 1 : 0;
      if (beat > (S.fo.beat || 0) && !(S.spot && S.spot.active)) { S.fo.beat = beat; if (!S.demo) whistleTone(0.07, beat === 1 ? 2350 : 2650); }
      if (S.timer <= S.fo.dropT) dropPuck();
    }
    else {
      S.fo.wait++;
      const k = S.fo.kind || FO_DROPS[0];
      if (S.fo.iceAt == null && S.fo.wait * k.g >= k.h) {                                      // the puck reaches the ice
        S.fo.iceAt = performance.now();
        if (!S.demo && typeof sfx !== 'undefined' && sfx.drop) sfx.drop();
        for (let i = 0; i < 5; i++) particles.push({ x: S.fo.x + rand(-1, 1), y: S.fo.y, vx: rand(-0.7, 0.7), vy: rand(-0.4, 0.3), life: rand(8, 14), color: i % 2 ? '#ffffff' : '#bfe3ff' });
      }
      // the computer's centre swipes at its own moment (early ones before the puck lands)
      if (S.fo.cpuE) { const ms = S.fo.wait * 16.7, land = k.h / k.g * 16.7;
        for (const t of [0, 1]) { const e = S.fo.cpuE[t], tk = S.fo.takers[t]; if (e != null && tk && !tk.foSwipe && ms >= land + e) tk.foSwipe = 10; } }
      if (S.fo.wait >= FO.resolveT || (S.fo.iceAt != null && S.fo.humanAt != null && S.fo.humanAt >= S.fo.dropAt && S.fo.wait >= Math.ceil(k.h / k.g) + 2)) resolveFaceoff();
    }
    clearIn(); updateCamera(); drawMarks(); return;
  }
  if (S.phase === 'goal' || S.phase === 'whistle') {
    S.timer--;
    for (const p of players) { p.inx = p.iny = 0; }
    if (S.phase === 'goal') { celebrateTick(); tickHats(); }
    for (const p of players) movePlayer(p);
    collidePlayers(); updatePuck(); clearIn(); updateCamera(); drawMarks();
    if (S.timer <= 0) {
      if (S.phase === 'goal') { if (S.so) return nextShootout(); if (typeof modeAfterGoal === 'function' && modeAfterGoal()) return; if (S.period >= 4) return endMatch(); S.kickNext = 1 - S.lastGoalTeam; setupFaceoff(CX, CY); }
      else { S.banner = null; const n = S.next; S.next = null; if (n) n(); }
    }
    return;
  }
  if (S.phase === 'penalty') return updatePenalty();
  if (S.phase === 'fight') { fightTick(); drawMarks(); return; }
  if (S.phase === 'ask') { tickFx(); updateRefs(); clearIn(); updateCamera(); if (S.ask && (S.ask.t += 1 / SPEEDS[S.speed]) >= (S.ask.limit || 180)) answerFight(false); return; }   // three real seconds, whatever the game speed
  // live
  if (S.ask && S.ask.live && (S.ask.t += 1 / SPEEDS[S.speed]) >= S.ask.limit) { S.ask = null; }   // nobody answered: it lapses
  if (typeof injuryTick === 'function') injuryTick();
  icingTick();
  if (S.cpuDelay > 0) S.cpuDelay--;
  const dtc = 1 / (60 * SPEEDS[S.speed]);
  S.clock -= dtc;
  statTick(dtc); lineTick(dtc); if (typeof rulesTick === 'function') rulesTick(dtc); if (typeof pressureTick === 'function') pressureTick(); if (typeof scoutTick === 'function') scoutTick(); if (puck.owner && !puck.owner.g) gkTrackCarrier(puck.owner);
  if (MS && MS.note && MS.note.life > 0) MS.note.life--;
  if (S.clock <= 0) { S.clock = 0; if (!(typeof addedTimeTick === 'function' && addedTimeTick(dtc))) { clearIn(); return endPeriod(); } }   // SOCCER: added time first
  if (!(S.fastSim && S.autoAI)) updateControl();      // (nobody to switch for when the computer plays both sides in a test)
  // whoever acts first in a frame gets the first touch (a poke, a pass, a check): the order alternates every frame,
  // so neither side is always first
  const flip = (S.t & 1) === 1, plans = flip ? (() => { const b = teamPlan(1); return [teamPlan(0), b]; })() : [teamPlan(0), teamPlan(1)];
  for (const p of (flip ? players.slice().reverse() : players)) {
    if (p.g) { if (p === ctrl && !S.autoAI) thinkGoalieHuman(p); else thinkGoalie(p); }
    else if (p === ctrl && !S.autoAI) thinkHuman(p);
    else if (p.restart && p.restart.kind === 'corner' && typeof keeperUpWait === 'function' && keeperUpWait(p.team, S.t - p.restart.t)) { p.inx = p.iny = 0; }   // SOCCER: the taker waits for his keeper
    else thinkAI(p, plans[p.team]);
  }
  clearIn();
  if (S.phase !== 'live') { updateCamera(); return; }   // a penalty was called mid-think
  for (const p of (flip ? players.slice().reverse() : players)) movePlayer(p);
  collidePlayers(flip ? players.slice().reverse() : players);
  S.prevPY = puck.y;
  updatePuck();
  if (puck.owner !== S.lastOwner) { S.lastOwner = puck.owner; if (puck.owner) { onPossessionChange(puck.owner); if (puck.owner.team !== S.lastOwnTeam) tacOnPossession(puck.owner); if (typeof tacOwner === 'function') tacOwner(puck.owner, S.lastOwnTeam); S.lastOwnTeam = puck.owner.team; } }
  checkOffside(); restartTick(); slideTick(); checkOutOfPlay();
  // breakaways and late-period calls
  const o = puck.owner;
  bwTick(o);
  if (S.clock < 60 && !S.saidMin && S.clock > 1) { S.saidMin = true; say('ONE MINUTE LEFT IN THE HALF!', 2); }
  updateCamera(); drawMarks();
}
// breakaway call (commentary)
function bwTick(o) {
  if (o && !o.g && S.phase === 'live' && S.t - (S.bwT || -999) > 600) {
    const gy = oppGoalY(o.team), up = attackDir(o.team);
    if (Math.abs(gy - o.y) < 230 && teamSkaters(1 - o.team).every(d => (d.y - o.y) * up < -8)) {
      S.bwT = S.t;
      typeof voiceCue === 'function' && voiceCue('breakaway');
      say(o.team === 0 ? ['BREAKAWAY! #' + o.num + ' IS ALL ALONE!', 'HE\'S GOT A STEP... BREAKAWAY!'] : ['UH OH... #' + o.num + ' IS IN ALL ALONE!', 'BREAKAWAY THE OTHER WAY!'], 2);
      excite(0.5);
    }
  }
}
// the computer on a penalty shot or in the shootout: pick a plan, come in with speed, never turn back,
// and finish with a shot from the slot or a deke across the crease
function thinkPenaltyAI(p, P) {
  const up = attackDir(p.team), gy = oppGoalY(p.team), g = P.goalie;
  if (!P.ai) {
    const stk = A(p, 'stk'), sht = A(p, 'sht');
    const r = Math.random(), deke = r < 0.25 + (stk - sht) * 0.05;
    P.ai = { style: r < 0.9 ? 'shoot' : 'fake', side: Math.random() < 0.5 ? -1 : 1, lane: rand(4, 12), at: 99, phase: 'in' };   // SOCCER: from the spot: strike it (or a little shimmy first)   // SOCCER: from the spot, nearly always a straight strike
  }
  const A_ = P.ai, ax = CX + A_.side * A_.lane;
  const dLine = (gy - p.y) * up;                                        // how far in front of the goal line he still is
  if (p.charge >= 0) {                                                  // the wind-up: keep driving at the net, then release
    const tx = CX + (g ? Math.sign(CX - g.x || A_.side) * 9 : 0), dx = tx - p.x, dy = gy - p.y, d = hyp(dx, dy) || 1;
    p.fx = dx / d; p.fy = dy / d; p.inx = p.fx * 0.6; p.iny = up * 0.6;
    p.charge = Math.min(1, p.charge + 1 / shotFrames());
    if (p.charge >= p.chargeTarget || dLine < 14) shoot(p, p.charge);
    return;
  }
  if (dLine < 16) { p.charge = 0; p.chargeTarget = 0.1; return; }      // out of room: just get it away
  if (A_.phase === 'in') {
    const ty = gy - up * Math.max(A_.at, 20), dx = ax - p.x, dy = ty - p.y, d = hyp(dx, dy) || 1;
    p.inx = dx / d; p.iny = Math.max(0.35, (dy / d) * up) * up;        // always some forward drive
    p.fx = p.inx; p.fy = p.iny;
    if (dLine < A_.at + 6) A_.phase = A_.style === 'deke' ? 'deke' : A_.style === 'fake' ? 'fake' : 'shot';
    return;
  }
  if (A_.phase === 'fake') { if (startDeke(p, -A_.side)) A_.phase = 'shot'; p.inx = 0; p.iny = up * 0.7; return; }
  if (A_.phase === 'deke') {                                            // pull it across the crease to the far side
    if (!A_.dk) { A_.dk = startDeke(p, -A_.side) ? 1 : 0; }
    const tx = CX - A_.side * 20, dx = tx - p.x;
    p.inx = clamp(dx / 12, -1, 1); p.iny = up * 0.55; p.fx = p.inx; p.fy = p.iny;
    const gOff = g ? Math.abs(g.x - p.x) : 99;
    if (Math.abs(dx) < 6 || gOff > 14 || dLine < 22) { p.charge = 0; p.chargeTarget = rand(0.05, 0.2); }
    return;
  }
  p.charge = 0; p.chargeTarget = rand(0.25, 0.6);                       // the shot from the slot
}
function updatePenalty() {
  const P = S.pen, sh = P.shooter, g = P.goalie;
  P.t++;
  if (sh.team === 0 && !S.autoAI) thinkHuman(sh);
  else if (P.t > 45 && hasPuck(sh)) thinkPenaltyAI(sh, P);
  else if (hasPuck(sh)) { sh.inx = 0; sh.iny = 0; sh.fx = 0; sh.fy = attackDir(sh.team); }
  else { sh.inx = sh.iny = 0; }
  thinkGoalie(g);
  input.spacePressed = input.shiftPressed = input.passPressed = input.pokePressed = input.linePressed = input.coverPressed = false;
  movePlayer(sh); movePlayer(g); collidePlayers([sh, g]);
  // SOCCER: a penalty KICK: the taker stands over the ball on the spot and strikes it (no run-in, no dribble; you aim
  // with the direction keys), and the keeper must stay on his line until it's kicked
  if (hasPuck(sh) && !P.taken) {
    if (P.sx == null) { P.sx = sh.x; P.sy = sh.y; }
    sh.x = P.sx; sh.y = P.sy; sh.vx = sh.vy = 0;
    if (P.t > 60 * 8 && !(sh.charge > 0)) { shoot(sh, 0.7); }                              // (he has to take it)
    if (g && g.on !== false) { const gl = ownGoalY(g.team), a = attackDir(g.team); if ((g.y - gl) * a > 7) { g.y = gl + a * 7; g.vy = 0; } g.x = clamp(g.x, CX - GOAL_HW + 4, CX + GOAL_HW - 4); }
  }
  updatePuck();
  updateCamera(); drawMarks();
  if (S.phase !== 'penalty') return;
  const behind = isUp(sh.team) ? sh.y < GL_TOP : sh.y > GL_BOT;
  // a penalty shot must keep going at the net: skating back toward centre (or losing the puck) ends it
  if (!P.taken && hasPuck(sh)) {
    const up = attackDir(sh.team), prog = (sh.y - (P.y0 ?? (P.y0 = sh.y))) * up;
    P.best = Math.max(P.best || 0, prog);
    P.back = sh.vy * up < -0.15 ? (P.back || 0) + 1 : Math.max(0, (P.back || 0) - 1);
    if (false && P.t > 20 && (P.back > 6 || prog < P.best - 16)) {   // SOCCER: he's on the spot; nothing to turn back from
      P.taken = true; P.endT = P.t; releasePuck(sh, sh.vx * 0.5, sh.vy * 0.5, 60);
      floaters.push({ x: sh.x, y: sh.y - 34, text: 'TURNED BACK: NO GOAL', life: 60, color: '#ff9e94' });
    }
  }
  if (!P.taken && (!hasPuck(sh) || behind || P.t > 60 * 12)) { P.taken = true; P.endT = P.t + (hasPuck(sh) ? 0 : 110); }
  if (P.taken) {
    const sp = hyp(puck.vx, puck.vy);
    if (P.t >= P.endT || puck.owner === g || (!puck.owner && sp < 0.25)) endPenalty();
  }
}

// ====================================================================
//  CAMERA
// ====================================================================
function updateCamera(snap) {
  const vh = viewH(), vw = viewW();
  if (S.cam === 'FULL') { camY = Math.round(R.b + 58 - vh); camX = Math.round(CX - vw / 2); return; }   // ~40 above the top boards, ~58 below the bottom ones (the commentary bar sits there)
  let fy = puck.owner ? puck.owner.y : puck.y, fx = puck.owner ? puck.owner.x : puck.x;
  if (puck.owner && S.phase === 'live') fy += attackDir(puck.owner.team) * 40;
  if (S.phase === 'faceoff') { fy = S.fo.y; fx = S.fo.x; }
  if (S.phase === 'penalty' && S.pen) fy = (fy * 2 + oppGoalY(S.pen.team)) / 3;
  // anticipation: lead the play along the puck's travel (a pass or shot) and the carrier's skating
  if (S.phase === 'live') { const vx = puck.owner ? puck.owner.vx : puck.vx, vy = puck.owner ? puck.owner.vy : puck.vy; fy += clamp(vy * 14, -60, 60); fx += clamp(vx * 10, -40, 40); }
  if (S.walk && S.walk.focus) { fx = S.walk.focus.x; fy = S.walk.focus.y; }
  if (S.screen === 'outro') { const L = S.outro && S.outro.lapper; fx = L && L.p && L.phase !== 'wait' ? L.p.x : CX; fy = L && L.p && L.phase !== 'wait' ? L.p.y : CY; }   // follow the star on his lap
  if (S.screen === 'outro' && S.outro && S.outro.pre === 'walk') { fx = R.l; fy = CY; }   // watch the benches empty down the tunnel
  const ty = clamp(fy - vh / 2 + 8, 0, H - vh);
  // drift sideways a little toward the play (shows the side stands), never losing much of the rink
  const lo = Math.max(0, R.r - 44 - vw), hi = Math.min(W - vw, R.l + 44);
  const tx = clamp(fx - vw / 2, Math.min(lo, hi), Math.max(lo, hi));
  if (snap) { camY = ty; camX = tx; S.camVY = S.camVX = 0; return; }
  // critically damped follow: smooth starts and stops, no jitter on quick direction changes
  const dy = ty - camY, dx = tx - camX;
  S.camVY = ((S.camVY || 0) + dy * 0.018) * 0.8; S.camVX = ((S.camVX || 0) + dx * 0.012) * 0.8;
  if (Math.abs(dy) < 2 && Math.abs(S.camVY) < 0.2) S.camVY *= 0.5;
  camY += S.camVY; camX += S.camVX;
  camY = clamp(camY, 0, H - vh);
}

// ====================================================================
//  RENDERING
// ====================================================================
const cvs = document.getElementById('c');
let ctx = cvs.getContext('2d');
let crowdSeats = [], crowdVN = null;
let crowdMake = null, crowdRedraw0 = null, rinkImg = null, crowdImgs = null, marksCvs = null, marksCtx = null, vignette = null;
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; };

function sizeCanvas() {
  cvs.width = Math.ceil(viewW() * K); cvs.height = Math.ceil((HUDH + viewH()) * K);
  ctx = cvs.getContext('2d'); ctx.imageSmoothingEnabled = false;
  vignette = null; fit();
}
const camOff = () => Math.round((HUDH - camY + (S.shkY || 0)) * K), camOffX = () => Math.round((-camX + (S.shkX || 0)) * K);
function toWorld() { ctx.setTransform(K, 0, 0, K, camOffX(), camOff()); }
function toScreen() { ctx.setTransform(K, 0, 0, K, 0, 0); }
function toSprite(x, y) { ctx.setTransform(K * SS, 0, 0, K * SS, Math.round(x * K) + camOffX(), Math.round(y * K) + camOff()); }
function px(x, y, w = 1, h = 1) { ctx.fillRect(x, y, w, h); }
function pxLine(x0, y0, x1, y1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, n = 0;
  while (n++ < 64) { ctx.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
}
function roundRectPath(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r);
  c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r);
  c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r);
  c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath();
}

// ---------- skate marks layer (resurfaced each period)
function clearMarks() {
  if (!marksCvs) { marksCvs = mkCanvas(W * K, H * K); marksCtx = marksCvs.getContext('2d'); }
  marksCtx.setTransform(1, 0, 0, 1, 0, 0); marksCtx.clearRect(0, 0, marksCvs.width, marksCvs.height);
  marksCtx.setTransform(K, 0, 0, K, 0, 0);
  marksCtx.save(); roundRectPath(marksCtx, R.l, R.t, R.r - R.l, R.b - R.t, R.cr); marksCtx.clip();
  for (const p of players) { p.mx = p.x; p.my = p.y; }
}
function drawMarks() {
  if (!marksCtx) return;
  marksCtx.strokeStyle = 'rgba(30,80,25,0.10)'; marksCtx.lineWidth = 0.6;   // SOCCER: boot scuffs in the grass
  marksCtx.beginPath();
  for (const p of players.concat(refs)) {
    const d = hyp(p.x - p.mx, p.y - p.my);
    if (d > 2.5) {
      if (d < 12) { const o = Math.sin(p.anim) * 2; marksCtx.moveTo(p.mx + o, p.my); marksCtx.lineTo(p.x - o, p.y); }
      p.mx = p.x; p.my = p.y;
    }
  }
  marksCtx.stroke();
}
function markSpray(x, y) {
  if (!marksCtx) return;
  marksCtx.fillStyle = 'rgba(110,80,40,0.35)';   // SOCCER: a divot
  for (let i = 0; i < 4; i++) marksCtx.fillRect(x + rand(-3, 3), y + rand(-1, 1), rand(0.5, 1.5), 0.5);
}

// ---------- BOARDS, GLASS AND ADS (arena options: boards = classic / wood / black / led, glass = clear / tinted / netting)
const BOARD_STYLES = {
  classic: { face: '#f4f6fa', seam: '#d3d9e4', cap: '#eef1f7', capLo: '#d4dae6', edge: '#5d6480', kick: '#f2c230', rivet: '#b9c1d0' },
  wood:    { face: '#9a6a3c', seam: '#5e3c1f', cap: '#7a4f2a', capLo: '#5e3c1f', edge: '#3a2412', kick: '#c9a14a', rivet: '#d9b25a', grain: ['#86592f', '#a8754a'] },
  black:   { face: '#1b1e2c', seam: '#2e3348', cap: '#2a2e40', capLo: '#151826', edge: '#05060d', kick: null, rivet: '#454b66' },
  led:     { face: '#0a0d1a', seam: '#1b2036', cap: '#1f2336', capLo: '#101322', edge: '#05060d', kick: '#2a2f48', rivet: '#3c4260', led: true },
};
const boardStyleOf = AC => BOARD_STYLES[(AC && AC.boards) || 'classic'] || BOARD_STYLES.classic;
// the ad strips round the rink: the far boards' face, the rail tops down both sides, and the near boards
function adSlots() {
  const out = [], skipL = [BENCH_Y[0] - 6, BENCH_Y[1] + BENCH_LEN + 6], skipR = [CY - 64, CY + 64], skipB = [CX - ZGATE_HW - 4, CX + ZGATE_HW + 4];
  // the far boards: 4 wide panels across the straight (art audit: was 7 narrow ones, too small to read)
  { const x0 = R.l + R.cr, span = R.r - R.cr - x0, n = 4, gap = 4, w = Math.floor((span - gap * (n - 1)) / n), lft = Math.round(x0 + (span - (w * n + gap * (n - 1))) / 2);
    for (let i = 0; i < n; i++) out.push({ side: 't', x: lft + i * (w + gap), y: Math.round(R.t - BOARD_FACE + 1), w, h: BOARD_FACE - 3 }); }
  for (let y = R.t + R.cr + 2; y + 28 < R.b - R.cr; y += 32) {
    if (y + 28 < skipL[0] || y > skipL[1]) out.push({ side: 'l', x: R.l - 5.5, y, w: 5, h: 28 });
    if (y + 28 < skipR[0] || y > skipR[1]) out.push({ side: 'r', x: R.r + 0.5, y, w: 5, h: 28 });
  }
  for (let x = R.l + R.cr - 4; x < R.r - R.cr; x += 34) if (x + 30 < skipB[0] || x > skipB[1]) out.push({ side: 'b', x: Math.round(x), y: R.b + 0.5, w: 30, h: 5 });
  return out;
}
// the ads read clockwise all the way round the rink: along the top, down the right, upside down along the bottom
// (as if walking round the boards) and up the left
const adTurn = side => side === 'l' ? -Math.PI / 2 : side === 'r' ? Math.PI / 2 : side === 'b' ? Math.PI : 0;
// the ad's lettering: as big as the panel allows (taller far boards: bigger words), shrunk to fit long words
function adFont(sl, c, word) {
  const vert = sl.side === 'l' || sl.side === 'r', len = (vert ? sl.h : sl.w) - 2;
  let sz = Math.min(3.4, Math.max(2.6, (vert ? sl.w : sl.h) * 0.6));
  if (c && word) { c.font = "10px 'PH Pixel', monospace"; const w10 = c.measureText(word).width; if (w10 > 0) sz = Math.min(sz, len / (w10 / 10)); }
  return Math.max(1.8, sz).toFixed(2) + "px 'PH Pixel', monospace";
}
// one ad panel (art audit, Nov 22): the sponsor's colours, a light top edge and a shaded bottom edge, its pixel icon
// and its name in the blocky pText font, one dot per world unit so it stays sharp. Narrow rails get the short mark.
// br: { bg, fg, ac, icon, word, short } (adBrand), or a team panel { team } / a tournament panel { tKey, bg, fg }
function drawAdArt(c, sl, br, opt = {}) {
  const vert = sl.side === 'l' || sl.side === 'r', L = vert ? sl.h : sl.w, Tk = vert ? sl.w : sl.h;
  c.save(); c.beginPath(); c.rect(sl.x, sl.y, sl.w, sl.h); c.clip();
  c.translate(sl.x + sl.w / 2, sl.y + sl.h / 2); c.rotate(adTurn(sl.side));
  const x0 = -L / 2, y0 = -Tk / 2;
  c.fillStyle = br.bg; c.fillRect(x0, y0, L, Tk);
  if (!opt.led && Tk >= 7) { c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x0, y0, L, 0.6); c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(x0, y0 + Tk - 0.7, L, 0.7); }
  const big = Tk >= 7, pt = typeof pText === 'function';
  if (br.team) {                                                         // the club's own panel: its badge and its letters
    const ab = (br.team.abbr || '').toUpperCase(), tw = pt ? pTextW(ab) : 0, r = big ? 3.4 : 2.1, gapw = big ? 3 : 2, tot = r * 2 + (big && tw ? gapw + tw : 0);
    drawLogo(c, br.team, x0 + (L - tot) / 2 + r, 0, r);
    if (big && pt) pText(c, ab, Math.round(x0 + (L - tot) / 2 + r * 2 + gapw), Math.round(-2.5), br.fg || '#ffffff');
  } else if (br.tKey && typeof drawTourneyEmblem === 'function') {
    drawTourneyEmblem(c, br.tKey, big ? x0 + 6 : -10, 0.15, big ? 4.6 : 4.2);
    const w = big && pt ? (br.word || '') : ''; if (w) { const tw = pTextW(w), room = L - 14; if (tw <= room) pText(c, w, Math.round(x0 + 12 + (room - tw) / 2), -2, br.fg); }
    else { c.fillStyle = br.fg; c.fillRect(-5, -0.75, 17, 1.5); }
  } else if (pt) {
    // the fullest name that fits: the name, else the short mark; with the icon when there's room for it
    const isz = big ? 7 : 5, pad = big ? 2 : 1, cands = big ? [br.word, br.short] : [br.short, br.word.split(' ')[0]];
    let txt = cands.find(w => w && pTextW(w) + isz + pad * 3 <= L) || null, icon = true;
    if (!txt) { txt = cands.find(w => w && pTextW(w) + pad * 2 <= L) || ''; icon = false; }
    const tw = txt ? pTextW(txt) : 0, tot = (icon ? isz + (tw ? pad + 1 : 0) : 0) + tw, sx = Math.round(x0 + (L - tot) / 2), sy = Math.round(-2.5);
    if (icon) adIcon(c, br.icon, sx, Math.round(-isz / 2), br.ac, isz);
    if (txt) pText(c, txt, icon ? sx + isz + pad + 1 : sx, sy, br.fg);
  }
  c.restore();
}
// the far boards stand BOARD_FACE tall (the face we see at the top end); the glass above them is GLASS_UP tall
const BOARD_FACE = 12, GLASS_UP = 12;   // art audit (Nov 22): 8 / 10 before; taller far boards so their ads can be read
// the glass round the top end: flat panes on posts, angled round the two corners and narrowing to an edge-on line
// down the sides (seen from above). Returns the panes as quads [base0, base1, top1, top0] (base hidden under the rail)
function glassPanes() {
  const out = [], yRail = R.t - BOARD_FACE - 2, rr = R.cr + 6, cyc = yRail + rr, n = 4;
  const pt = (cx, ph) => { const x = cx + rr * Math.cos(ph), y = cyc - rr * Math.sin(ph), h = GLASS_UP * Math.sin(ph); return [[x, y + 2], [x, y - h]]; };
  for (const [cx, a0, a1] of [[R.l + R.cr, Math.PI, Math.PI / 2], [R.r - R.cr, Math.PI / 2, 0]]) {
    for (let i = 0; i < n; i++) {
      const pa = a0 + (a1 - a0) * i / n, pb = a0 + (a1 - a0) * (i + 1) / n, [ba, ta] = pt(cx, pa), [bb, tb] = pt(cx, pb);
      out.push({ q: [ba, bb, tb, ta], corner: true });
    }
    if (cx === R.l + R.cr) for (let x = R.l + R.cr; x < R.r - R.cr - 1; x += 32) { const x1 = Math.min(R.r - R.cr, x + 32); out.push({ q: [[x, yRail + 2], [x1, yRail + 2], [x1, yRail - GLASS_UP], [x, yRail - GLASS_UP]], corner: false }); }
  }
  return out;
}
function glassPath(c) { c.beginPath(); for (const p of glassPanes()) { const q = p.q; c.moveTo(q[0][0], q[0][1]); for (let i = 1; i < 4; i++) c.lineTo(q[i][0], q[i][1]); c.closePath(); } }
// SOCCER: the ball-stop net behind the far goal. NET_UP tall, from BSN_X0 to BSN_X1, standing on the hoardings' rail.
const BSN_UP = 22;
function ballStopSpan() { const hw = Math.min(PEN_HW + 22, (R.r - R.l) / 2 - R.cr - 4); return [Math.round(CX - hw), Math.round(CX + hw)]; }
function drawBallStopNet(c, col, bulge) {
  const [x0, x1] = ballStopSpan(), yB = R.t - BOARD_FACE - 2, yT = yB - BSN_UP, nP = 6, step = (x1 - x0) / nP;
  const sag = x => { const k = ((x - x0) / step) % 1; return 1.2 * Math.sin(Math.PI * k); };   // the top cable droops between posts
  const bl = bulge || null, push = (x, y) => {                                                     // a shot in the net pushes it back (up, from this camera)
    if (!bl) return 0; const d = Math.abs(x - bl.x) / 16; return d >= 1 ? 0 : -bl.a * (1 - d * d) * Math.min(1, (y - yT) / BSN_UP + 0.3); };
  c.save();
  c.beginPath(); c.moveTo(x0, yB + 1); for (let x = x0; x <= x1; x += 2) c.lineTo(x, yT + sag(x) + push(x, yT)); c.lineTo(x1, yT + sag(x1)); c.lineTo(x1, yB + 1); c.closePath();
  c.fillStyle = 'rgba(10,14,22,0.18)'; c.fill(); c.clip();                                          // the faint shadow the mesh makes
  c.strokeStyle = col; c.lineWidth = 0.3; c.beginPath();                                            // the mesh: a fine diamond lattice
  for (let x = x0 - BSN_UP; x < x1 + BSN_UP; x += 2.5) { c.moveTo(x, yB + 1 + push(x, yB)); c.lineTo(x + BSN_UP + 1, yT - 1 + push(x + BSN_UP, yT)); c.moveTo(x + BSN_UP + 1, yB + 1 + push(x + BSN_UP, yB)); c.lineTo(x, yT - 1 + push(x, yT)); }
  c.stroke(); c.restore();
  for (let i = 0; i <= nP; i++) {                                                                   // the posts, and their shadows on the net
    const x = Math.round(x0 + i * step);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x + 0.6, yT + 1, 0.5, BSN_UP - 1);
    c.fillStyle = '#4a5368'; c.fillRect(x - 0.4, yT - 0.8, 1, BSN_UP + 1.8);
    c.fillStyle = '#7b859c'; c.fillRect(x - 0.4, yT - 0.8, 0.4, BSN_UP + 1.8);
    c.fillStyle = '#9aa3b8'; c.fillRect(x - 0.6, yT - 1.2, 1.4, 0.6);                                 // the cap
  }
  c.strokeStyle = 'rgba(200,206,220,.55)'; c.lineWidth = 0.35; c.beginPath();                       // the top cable
  for (let x = x0; x <= x1; x += 1) { const y = yT + sag(x) + push(x, yT); x === x0 ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke();
}
function drawBoardsStatic(c, AC, H0, H1, ads, adWords, tAds) {
  const B = boardStyleOf(AC), netCol = AC.glass === 'tinted' ? 'rgba(15,18,26,.55)' : AC.glass === 'netting' ? 'rgba(255,214,120,.32)' : 'rgba(235,240,250,.34)', glass = 'netting', kick = B.kick || H0.trim, BF = BOARD_FACE, BU = BF - 6;   // SOCCER: no glass, ball-stop nets behind the hoardings (the arena option picks their colour)
  // SOCCER: no glass. The ball-stop net behind the far goal is drawn live, in front of the crowd (drawBoardsLive)
  // BOARDS: the rail tops all round (outer edge, cap, inner lip)
  roundRectPath(c, R.l - 6, R.t - 8 - BU, R.r - R.l + 12, R.b - R.t + 18 + BU, R.cr + 6); c.fillStyle = B.edge; c.fill();
  roundRectPath(c, R.l - 6, R.t - 8 - BU, R.r - R.l + 12, R.b - R.t + 13 + BU, R.cr + 6); c.fillStyle = B.cap; c.fill();
  roundRectPath(c, R.l - 3, R.t - 5 - BU, R.r - R.l + 6, R.b - R.t + 8 + BU, R.cr + 3); c.fillStyle = B.capLo; c.fill();
  // the far boards' face: panels with seams and rivets (wood: planks with grain)
  roundRectPath(c, R.l, R.t - BF, R.r - R.l, R.b - R.t + BF, R.cr); c.fillStyle = B.face; c.fill();
  c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(R.l + R.cr - 8, R.t - BF, R.r - R.l - 2 * R.cr + 16, 0.5);          // the cap rail's lip
  if (B.grain) for (let y = R.t - BF + 0.5; y < R.t; y += 1.1) { c.fillStyle = B.grain[(y * 10 | 0) % 2]; c.fillRect(R.l + R.cr - 8, y, R.r - R.l - 2 * R.cr + 16, 0.35); }
  for (let x = R.l + R.cr - 8 + 24; x < R.r - R.cr + 8; x += 24) {
    c.fillStyle = B.seam; c.fillRect(x, R.t - BF, 0.5, BF);
    c.fillStyle = B.rivet; for (const ry of [R.t - BF + 0.6, R.t - 2.6]) { c.fillRect(x - 1.2, ry, 0.5, 0.5); c.fillRect(x + 1.2, ry, 0.5, 0.5); }
  }
  // seams across the rail tops down the sides and along the near boards
  c.fillStyle = B.seam;
  for (let y = R.t + R.cr + 24; y < R.b - R.cr; y += 24) { c.fillRect(R.l - 6, y, 6, 0.4); c.fillRect(R.r, y, 6, 0.4); }
  for (let x = R.l + R.cr + 24; x < R.r - R.cr; x += 24) c.fillRect(x, R.b, 0.4, 6);
  // ADS on all four sides (the LED boards' panels are lit up live, each frame)
  let ai = 0;
  for (const sl of adSlots()) {
    const k = ai++, [bgc, fg] = ads[k % ads.length];
    if (B.led) { c.fillStyle = '#05070f'; c.fillRect(sl.x, sl.y, sl.w, sl.h); continue; }
    const logoT = !tAds && (k % 5 === 1 || k % 5 === 3) ? (k % 5 === 1 ? H0 : H1) : null;
    const word = adWords.length ? adWords[k % adWords.length] : '';
    const br = logoT ? { team: logoT, bg: logoT.main, fg: logoT.trim || '#ffffff' }
      : tAds && k % 5 !== 0 ? { tKey: tAds.key, bg: bgc, fg, word: (tAds.name || '').toUpperCase() }
      : typeof adBrand === 'function' ? adBrand(word, k, [bgc, fg], H0, AC.ads) : { bg: bgc, fg, ac: fg, icon: 'star', word, short: word };
    drawAdArt(c, sl, br);
  }
  // the kickplate along the bottom of the far boards
  c.fillStyle = kick; c.fillRect(R.l + R.cr - 8, R.t - 1.7, R.r - R.l - 2 * R.cr + 16, 1.7);
  c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(R.l + R.cr - 8, R.t - 1.7, R.r - R.l - 2 * R.cr + 16, 0.35);
}
// ---------- the live parts of the boards (each frame): LED dasher boards, glints running across the glass,
// glass shaking after a big hit into the boards, and the puck's scuff marks building up through the game
const BOARDFX = { scuffs: [], shake: null };
function boardScuff(x, y, hit) {
  if (BOARDFX.scuffs.length > 260) BOARDFX.scuffs.shift();
  const side = y <= R.t + 2 ? 't' : y >= R.b - 2 ? 'b' : x <= R.l + 2 ? 'l' : x >= R.r - 2 ? 'r' : null; if (!side) return;
  BOARDFX.scuffs.push({ x: side === 'l' ? R.l - 1.2 : side === 'r' ? R.r + 0.4 : x + rand(-1, 1), y: side === 't' ? R.t - rand(0.6, 2.4) : side === 'b' ? R.b + rand(0.3, 1.2) : y + rand(-1, 1), w: Math.min(2.6, 0.6 + hit * 0.25), a: Math.min(0.55, 0.18 + hit * 0.05), side });
}
function glassShake(x, y, big) { BOARDFX.shake = { x, y, t: S.t, big }; }
function ballStopNetCol(AC) { return AC.glass === 'tinted' ? 'rgba(15,18,26,.55)' : AC.glass === 'netting' ? 'rgba(255,214,120,.38)' : 'rgba(235,240,250,.4)'; }
function drawBoardsLive(noNet) {
  const AC = typeof arenaCfg === 'function' ? arenaCfg() : {}, B = boardStyleOf(AC), glass = 'netting', t = S.t, c = ctx;   // SOCCER: nets, not glass
  // SOCCER: the BALL-STOP NET behind the far goal, as at a football ground: a straight run of tall netting on posts,
  // in front of the fans behind that goal. A shot that flies over the bar into it pushes it back for a moment.
  if (!noNet) { const sh = BOARDFX.net, [nx0, nx1] = ballStopSpan(), age = sh ? t - sh.t : 99;
    const hit = sh && age >= 0 && age < 34 && sh.x > nx0 - 6 && sh.x < nx1 + 6;
    drawBallStopNet(c, ballStopNetCol(AC), hit ? { x: sh.x, a: (sh.big ? 3.2 : 2) * (1 - age / 34) * Math.abs(Math.cos(age * 0.35)) } : null); }
  if (!S.match) return;
  c.save();
  // scuffs
  for (const sc of BOARDFX.scuffs) { c.fillStyle = `rgba(20,22,30,${sc.a})`; if (sc.side === 't' || sc.side === 'b') c.fillRect(sc.x, sc.y, sc.w, 0.5); else c.fillRect(sc.x, sc.y, 0.6, sc.w); }
  // glints sliding across the far glass now and then
  const gT = R.t - BOARD_FACE - 2 - GLASS_UP, gB = R.t - BOARD_FACE - 2;
  if (glass !== 'netting') { const ph = (t % 420) / 420, gx = R.l + R.cr + (R.r - R.l - 2 * R.cr - 10) * ph / 0.8;
    if (ph < 0.8) { c.fillStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.moveTo(gx, gB); c.lineTo(gx + 5, gT); c.lineTo(gx + 7, gT); c.lineTo(gx + 2, gB); c.fill(); } }
  // glass shake after a big hit into the boards
  const sh = BOARDFX.shake;
  if (sh && t - sh.t < 26 && glass !== 'netting') {
    const k = 1 - (t - sh.t) / 26, amp = (sh.big ? 1.6 : 0.8) * k * Math.sin((t - sh.t) * 1.9);
    c.strokeStyle = `rgba(220,240,255,${0.65 * k})`; c.lineWidth = 0.6;
    if (sh.y < CY - (R.b - R.t) * 0.35) { const sx = clamp(sh.x, R.l + R.cr + 16, R.r - R.cr - 16); c.strokeRect(sx - 16 + amp, gT, 32, GLASS_UP); c.fillStyle = `rgba(255,255,255,${0.18 * k})`; c.fillRect(sx - 16 + amp, gT, 32, GLASS_UP); }
    else if (sh.x < CX) { c.beginPath(); c.moveTo(R.l - 7 + amp, sh.y - 18); c.lineTo(R.l - 7 + amp, sh.y + 18); c.stroke(); }
    else if (sh.x >= CX && sh.y < R.b - 8) { c.beginPath(); c.moveTo(R.r + 7 + amp, sh.y - 18); c.lineTo(R.r + 7 + amp, sh.y + 18); c.stroke(); }
  }
  // LED DASHER BOARDS: sponsors scroll and cycle; on a goal they flash GOAL! in the scorer's colours
  if (B.led) {
    const hm = S.match.home ?? 0, H0 = TEAM[hm], words = (typeof AD_SETS !== 'undefined' ? (AD_SETS[AC.ads] || AD_SETS.classic) : ['GO']).map(a => a.replace('{N}', (H0.nick || '').toUpperCase()).replace('{A}', H0.abbr || ''));
    const goal = S.phase === 'goal' || S.screen === 'celebrate', sc = TEAM[S.cheerKind === 'away' ? 1 - hm : hm], cyc = (t / 240) | 0, cols = [['#ff3ad1', '#ffffff'], ['#3ad7ff', '#05070f'], ['#ffd23f', '#05070f'], [H0.main, H0.trim]];
    let k = 0;
    for (const sl of adSlots()) {
      const vert = sl.side === 'l' || sl.side === 'r', i = k++;
      let br;
      if (goal) { const on = ((t >> 3) + i) % 2; br = { bg: on ? sc.main : '#05070f', fg: on ? (sc.trim || '#ffffff') : sc.main, ac: '#ffd23f', icon: 'star', word: 'GOAL!', short: 'GOAL!' }; }
      else {
        // each panel shows a sponsor lit up on black (its own colours as the light), and they change together
        const word = words[(cyc + i) % words.length], b = typeof adBrand === 'function' ? adBrand(word, i, cols[(cyc + i) % cols.length], H0, AC.ads) : { fg: '#ffffff', ac: '#ffd23f', icon: 'star', word, short: word };
        const lit = typeof lum === 'function' && lum(b.bg) > 0.18 ? b.bg : b.fg;
        br = { bg: '#05070f', fg: lit, ac: b.ac === b.bg ? '#ffffff' : b.ac, icon: b.icon, word: b.word, short: b.short };
      }
      // a short sweep when the panels change over
      const ph = (t % 240) / 240;
      drawAdArt(c, sl, br, { led: true });
      if (!goal && ph < 0.06) { c.fillStyle = `rgba(255,255,255,${0.35 * (1 - ph / 0.06)})`; c.fillRect(sl.x, sl.y, sl.w, sl.h); }
      c.fillStyle = 'rgba(0,0,0,.28)'; for (let q = 0.5; q < (vert ? sl.h : sl.w); q += 1) vert ? c.fillRect(sl.x, sl.y + q, sl.w, 0.22) : c.fillRect(sl.x + q, sl.y, 0.22, sl.h);   // the LED pixel grid
    }
  }
  c.restore();
}

// ---------- static arena / rink
function buildRink() {
  const off = mkCanvas(W * K, H * K), c = off.getContext('2d');
  c.setTransform(K, 0, 0, K, 0, 0);
  const hm = S.match ? S.match.home : 0;
  const H0 = TEAM[hm], H1 = TEAM[1 - hm];
  // arena floor
  const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#191d36'); bg.addColorStop(1, '#0f1224');
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
  // walkway between stands and boards
  c.fillStyle = '#12152a'; c.fillRect(R.l - 17, R.t - 20, 11, R.b - R.t + 36); c.fillRect(R.r + 6, R.t - 20, 11, R.b - R.t + 36);
  c.fillRect(R.l - 17, R.t - 22, R.r - R.l + 34, 4); c.fillRect(R.l - 17, R.b + 12, R.r - R.l + 34, 4);
  // team benches (left) and penalty boxes + scorer's table (right)
  const EP = typeof enclPal === 'function' ? enclPal() : { wall: '#080a16', floor: '#2b3150', pat: 'mat', frame: '#0b0e1e', hall: '#262b48', booth: '#3b3f58' };
  const bench = (y0, T) => {
    const x0 = BENCH_X0, x1 = R.l - 5, y1 = y0 + BENCH_LEN;
    c.fillStyle = EP.wall; c.fillRect(x0 - 3, y0 - 4, x1 - x0 + 4, BENCH_LEN + 8);                   // walls round the enclosure
    drawEnclFloor(c, x0, y0, x1 - x0, BENCH_LEN, EP);                                                // the floor, in the building's style
    c.fillStyle = T.dark; c.fillRect(x0 - 3, y0 - 4, 4, BENCH_LEN + 8);                                // back wall in team colours
    c.fillStyle = T.main; c.fillRect(x0 - 2, y0 - 4, 2, BENCH_LEN + 8);
    c.fillStyle = shade(T.dark, 0.15); c.fillRect(x0 - 3, y0 - 4, x1 - x0 + 4, 3); c.fillRect(x0 - 3, y1 + 1, x1 - x0 + 4, 3);   // end partitions
    c.fillStyle = 'rgba(170,210,255,.18)'; c.fillRect(x0 + 1, y0 - 3, x1 - x0 - 2, 1); c.fillRect(x0 + 1, y1 + 2, x1 - x0 - 2, 1);   // glass on top
    drawLogo(c, T, x0 + 20, y0 + BENCH_LEN / 2, 5, 0.25);                                               // team logo on the floor mat
    // the back bench (spare goalies and the coaches), along the back wall
    c.fillStyle = EP.frame; c.fillRect(BACK_BENCH_X - 4, y0 + 8, 7, BENCH_LEN - 16);
    c.fillStyle = shade(T.main, -0.15); c.fillRect(BACK_BENCH_X - 3, y0 + 9, 5, BENCH_LEN - 18);
    c.fillStyle = shade(T.main, 0.15); c.fillRect(BACK_BENCH_X - 3, y0 + 9, 5, 1);
    c.fillStyle = EP.frame; c.fillRect(R.l - 15, y0 + 2, 8, BENCH_LEN - 4);                           // the bench itself, in team colours
    c.fillStyle = T.main; c.fillRect(R.l - 14, y0 + 3, 6, BENCH_LEN - 6);
    c.fillStyle = shade(T.main, -0.3); c.fillRect(R.l - 9, y0 + 3, 1, BENCH_LEN - 6);
  };
  bench(BENCH_Y[0], H0); bench(BENCH_Y[1], H1);
  // doorways from the corridor into each bench (at the back, by the wall)
  c.fillStyle = EP.floor; c.fillRect(BENCH_DOOR_X - 7, BENCH_Y[0] + BENCH_LEN, 14, 7); c.fillRect(BENCH_DOOR_X - 7, BENCH_Y[1] - 7, 14, 7);
  // the corridor between the benches: from the tunnel to the gate in the boards
  c.fillStyle = EP.hall; c.fillRect(BENCH_X0, TUN.y0, R.l - 5 - BENCH_X0, TUN.y1 - TUN.y0);
  c.fillStyle = EP.trim || shade(EP.hall, 0.08); c.fillRect(BENCH_X0, TUN.y0, R.l - 5 - BENCH_X0, 1); c.fillRect(BENCH_X0, TUN.y1 - 1, R.l - 5 - BENCH_X0, 1);
  c.fillStyle = H0.main; for (let x = BENCH_X0 + 3; x < R.l - 8; x += 6) c.fillRect(x, CY - 0.5, 3, 1);   // a stripe down the middle
  // the tunnel mouth under the stands: dark inside, a lit concrete lip, a banner over it
  const tg = c.createLinearGradient(TUN.x0, 0, TUN.x1, 0); tg.addColorStop(0, '#020308'); tg.addColorStop(1, '#14172a');
  c.fillStyle = tg; c.fillRect(TUN.x0, TUN.y0, TUN.x1 - TUN.x0, TUN.y1 - TUN.y0);
  c.fillStyle = '#3a3f58'; c.fillRect(TUN.x0, TUN.y0 - 3, TUN.x1 - TUN.x0, 3); c.fillRect(TUN.x0, TUN.y1, TUN.x1 - TUN.x0, 3);
  c.fillStyle = '#5a6080'; c.fillRect(TUN.x1 - 2, TUN.y0 - 3, 2, TUN.y1 - TUN.y0 + 6);
  c.fillStyle = 'rgba(255,240,200,.10)'; c.fillRect(TUN.x1 - 14, TUN.y0, 12, TUN.y1 - TUN.y0);
  c.fillStyle = H0.main; c.fillRect(TUN.x1 - 5, TUN.y0 + 3, 2, TUN.y1 - TUN.y0 - 6); c.fillStyle = H0.trim; c.fillRect(TUN.x1 - 5, CY - 2, 2, 4);
  if (typeof drawPenBoxStatic === 'function') drawPenBoxStatic(c, H0, H1);                // penalty boxes and the officials' booth (penbox.js)
  const tAds = typeof tourneyAds === 'function' ? tourneyAds() : null;
  const AC = typeof arenaCfg === 'function' ? arenaCfg() : { ads: 'classic', logo: 'emblem' };
  const adCols = { classic: [['#1b2a5c', '#ffd23f'], ['#d9342b', '#ffffff'], ['#16a085', '#ffffff']], retro: [['#2b0a3d', '#ff4fd8'], ['#05060d', '#5ee07a'], ['#102a6b', '#7ec8ff']], local: [['#6b4423', '#f1e3b5'], ['#2f5d3a', '#ffffff'], ['#8a3a26', '#ffe2a8']], team: [[H0.dark, H0.trim], [H0.main, '#ffffff'], [H0.trim, H0.dark]], premium: [['#0b0b0f', '#d9b25a'], ['#1a1a1a', '#ffffff'], ['#2b2f45', '#cfd6ff']], charity: [['#ff7aa8', '#ffffff'], ['#ffffff', '#d9342b'], ['#2a8f5a', '#ffffff']] }[AC.ads] || [];
  const ads = tAds ? tAds.ads.concat([[H0.main, H0.trim]]) : [[H0.main, H0.trim], adCols[0], [H1.main, H1.trim], adCols[1], adCols[2]];
  let adWords = AC.adWords ? AC.adWords.slice() : typeof AD_SETS !== 'undefined' ? (AD_SETS[AC.ads] || AD_SETS.classic).map(a => a.replace('{N}', (H0.nick || '').toUpperCase()).replace('{A}', H0.abbr || '')) : [];
  if (!AC.adWords && typeof dealBoardWords === 'function') adWords = dealBoardWords(H0, adWords);   // your rink-board sponsor (franchise deal)
  drawBoardsStatic(c, AC, H0, H1, ads, adWords, tAds);

  // SOCCER: THE PITCH. Mown grass in stripes out to the hoardings, the white lines, the home crest in the centre circle
  c.save(); roundRectPath(c, R.l, R.t, R.r - R.l, R.b - R.t, R.cr); c.clip();
  const STRIPE = (GL_BOT - GL_TOP) / 18;
  for (let i = -3; i < 22; i++) { const y0 = GL_TOP + i * STRIPE; c.fillStyle = i % 2 ? '#3f9a3a' : '#48a843'; c.fillRect(R.l, y0, R.r - R.l, STRIPE + 0.5); }
  for (let i = 0; i < 3200; i++) { c.fillStyle = Math.random() < 0.5 ? 'rgba(20,70,20,.22)' : 'rgba(170,230,140,.18)'; c.fillRect(R.l + Math.random() * (R.r - R.l), R.t + Math.random() * (R.b - R.t), 0.5, rand(0.8, 2)); }
  // the run-off beyond the lines, a shade darker
  c.fillStyle = 'rgba(10,40,10,.16)';
  c.fillRect(R.l, R.t, R.r - R.l, GL_TOP - R.t); c.fillRect(R.l, GL_BOT, R.r - R.l, R.b - GL_BOT);
  c.fillRect(R.l, GL_TOP, TL_L - R.l, GL_BOT - GL_TOP); c.fillRect(TL_R, GL_TOP, R.r - TL_R, GL_BOT - GL_TOP);
  c.globalAlpha = 0.92;
  const LINE = '#f4f8f0';
  c.strokeStyle = LINE; c.lineWidth = 1.1;
  c.strokeRect(TL_L, GL_TOP, TL_R - TL_L, GL_BOT - GL_TOP);                                   // touchlines and goal lines
  c.fillStyle = LINE; c.fillRect(TL_L, CY - 0.55, TL_R - TL_L, 1.1);                          // halfway line
  const ring = (x, y, r, a0 = 0, a1 = Math.PI * 2) => { c.beginPath(); c.arc(x, y, r, a0, a1); c.stroke(); };
  const dot = (x, y, r = 1.6) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
  ring(CX, CY, CIRCLE_R); dot(CX, CY);
  for (const [gy, s] of [[GL_TOP, 1], [GL_BOT, -1]]) {
    c.strokeRect(CX - PEN_HW, s > 0 ? gy : gy - PEN_D, PEN_HW * 2, PEN_D);                     // the penalty area
    c.strokeRect(CX - SIX_HW, s > 0 ? gy : gy - SIX_D, SIX_HW * 2, SIX_D);                     // the goal area
    const sy = gy + s * PEN_SPOT; dot(CX, sy);                                                 // the penalty spot
    const edge = gy + s * PEN_D, ang = Math.acos(clamp(Math.abs(edge - sy) / CIRCLE_R, 0, 1));   // the arc outside the box
    if (s > 0) ring(CX, sy, CIRCLE_R, Math.PI / 2 - ang, Math.PI / 2 + ang); else ring(CX, sy, CIRCLE_R, -Math.PI / 2 - ang, -Math.PI / 2 + ang);
  }
  for (const [x, y, a0] of [[TL_L, GL_TOP, 0], [TL_R, GL_TOP, Math.PI / 2], [TL_R, GL_BOT, Math.PI], [TL_L, GL_BOT, -Math.PI / 2]]) ring(x, y, 5, a0, a0 + Math.PI / 2);   // corner arcs
  // centre circle: the home crest, mown into the grass
  c.globalAlpha = 1;
  if (AC.logo === 'tourney' && AC.tEmblem) drawLogo(c, AC.tEmblem, CX, CY, 22, 0.55);
  else if (AC.logo === 'emblem' || AC.logo === 'crest') drawLogo(c, H0, CX, CY, 20, 0.5);
  else if (AC.logo === 'wordmark') { c.globalAlpha = 0.55; c.fillStyle = H0.main; c.font = "11.5px 'PH Pixel', monospace"; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText((H0.nick || H0.abbr || '').toUpperCase().slice(0, 9), CX, CY); c.globalAlpha = 1; }
  if (typeof paintTourneyIce === 'function') paintTourneyIce(c);
  // the dugouts' technical areas by the left touchline
  c.globalAlpha = 0.55; c.strokeStyle = LINE; c.lineWidth = 0.6; c.setLineDash([2, 2]);
  for (const by of BENCH_Y) c.strokeRect(R.l + 0.5, by + 10, TL_L - R.l - 1.5, BENCH_LEN - 20);
  c.setLineDash([]); c.globalAlpha = 1;
  // corner flags
  for (const [x, y] of [[TL_L, GL_TOP], [TL_R, GL_TOP], [TL_L, GL_BOT], [TL_R, GL_BOT]]) {
    c.fillStyle = '#e8e8e8'; c.fillRect(x - 0.4, y - 7, 0.8, 7);
    c.fillStyle = x < CX ? H0.main : H1.main; c.fillRect(x + (x < CX ? 0.4 : -3.4), y - 7, 3, 2);
  }
  // floodlight pools
  for (const [x, y, r] of [[R.l + 40, R.t + 60, 120], [R.r - 40, R.t + 60, 120], [R.l + 40, R.b - 60, 120], [R.r - 40, R.b - 60, 120]]) {
    const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,230,.10)'); g.addColorStop(1, 'rgba(255,255,230,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 1; i <= 4; i++) { c.strokeStyle = `rgba(10,40,10,${0.05 * (5 - i) / 4 * 2})`; c.lineWidth = i * 2; roundRectPath(c, R.l, R.t, R.r - R.l, R.b - R.t, R.cr); c.stroke(); }
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 0.6; roundRectPath(c, R.l - 0.5, R.t - 0.5, R.r - R.l + 1, R.b - R.t + 1, R.cr); c.stroke();
  // the players' gate in the left boards (opposite centre ice), between the two benches
  c.fillStyle = '#c9d0de'; c.fillRect(R.l - 6, GATE.y0, 6, GATE.y1 - GATE.y0);
  c.fillStyle = '#8a93a8'; c.fillRect(R.l - 6, GATE.y0, 6, 1); c.fillRect(R.l - 6, GATE.y1 - 1, 6, 1); c.fillRect(R.l - 4, CY - 0.5, 4, 1);
  c.fillStyle = '#5d6480'; c.fillRect(R.l - 6, GATE.y0 + 2, 1, 2); c.fillRect(R.l - 6, GATE.y1 - 4, 1, 2);
  // the bench gates: two doors in the boards along each bench (hinges, frame, latch)
  for (const home of [true, false]) { const G = benchGateSpots(home); for (const g of [G.upper, G.lower]) {
    c.fillStyle = '#dfe4ee'; c.fillRect(R.l - 6, g.y0, 6, g.y1 - g.y0);
    c.fillStyle = '#8a93a8'; c.fillRect(R.l - 6, g.y0, 6, 1); c.fillRect(R.l - 6, g.y1 - 1, 6, 1); c.fillRect(R.l - 6, g.y0, 1, g.y1 - g.y0);
    c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(R.l - 3.5, g.y0 + 2, 0.6, g.y1 - g.y0 - 4);
    c.fillStyle = '#5d6480'; c.fillRect(R.l - 6, g.y0 + 2, 1.5, 2); c.fillRect(R.l - 6, g.y1 - 4, 1.5, 2);       // hinges
    c.fillStyle = '#3a3f58'; c.fillRect(R.l - 2, (g.y0 + g.y1) / 2 - 1.5, 1.5, 3);                              // latch
  } }
  if (typeof drawPenBoxDoors === 'function') drawPenBoxDoors(c);
  // the Zamboni tunnel behind the bottom boards: a garage mouth with a lit frame and a team stripe
  { const T = ZTUN, w = T.x1 - T.x0, tg = c.createLinearGradient(0, T.y0, 0, T.y1); tg.addColorStop(0, '#1a1e33'); tg.addColorStop(0.35, '#0a0c18'); tg.addColorStop(1, '#020308');
    c.fillStyle = '#05060d'; c.fillRect(T.x0 - 4, T.y0, w + 8, T.y1 - T.y0);
    c.fillStyle = tg; c.fillRect(T.x0, T.y0, w, T.y1 - T.y0);
    c.fillStyle = 'rgba(255,255,255,.05)'; for (let y = T.y0 + 6; y < T.y1; y += 6) c.fillRect(T.x0, y, w, 1);    // floor seams
    c.fillStyle = '#ffd23f'; for (let y = T.y0 + 8; y < T.y1; y += 10) c.fillRect(CX - 0.5, y, 1, 5);                    // centre line
    c.fillStyle = '#3a3f58'; c.fillRect(T.x0 - 4, T.y0, 4, T.y1 - T.y0); c.fillRect(T.x1, T.y0, 4, T.y1 - T.y0);       // concrete walls
    c.fillStyle = '#5a6080'; c.fillRect(T.x0 - 1, T.y0, 1, T.y1 - T.y0); c.fillRect(T.x1, T.y0, 1, T.y1 - T.y0);
    c.fillStyle = H0.main; c.fillRect(T.x0 - 3, T.y0 + 12, 2, T.y1 - T.y0 - 12); c.fillRect(T.x1 + 1, T.y0 + 12, 2, T.y1 - T.y0 - 12);
    c.fillStyle = '#f2c230'; for (let x = T.x0 - 4; x < T.x1 + 4; x += 6) c.fillRect(x, T.y0 + 12, 3, 2);              // hazard stripe at the doorway
    c.fillStyle = 'rgba(255,240,200,.08)'; c.fillRect(T.x0, T.y0, w, 14);
  }
  // the resurfacer's doors in the bottom boards (closed)
  c.fillStyle = '#dfe4ee'; c.fillRect(CX - ZGATE_HW, R.b + 0.5, ZGATE_HW * 2, 5); c.fillStyle = '#8a93a8'; c.fillRect(CX - 0.5, R.b + 0.5, 1, 5); c.fillRect(CX - ZGATE_HW, R.b + 0.5, 1, 5); c.fillRect(CX + ZGATE_HW - 1, R.b + 0.5, 1, 5);
  rinkImg = off;
  buildCrowd();
}
// ---------- CROWD FANS, drawn on a grid 1.5x finer than the old crowd pixels (the same grid as the players):
// one cell is 12 x 15 fine pixels. Every fan snaps to the target canvas's device grid so nothing blurs.
const CROWD_FINE = 1.5;
const FAN_CW = 12, FAN_RH = 15;      // one seat in crowd pixels (a fan is 18 x 22 fine pixels, the players' scale)
function fanBegin(c, x, y) {
  const m = c.getTransform(), sx = Math.round(m.a * x + m.e), sy = Math.round(m.d * y + m.f);
  c.save(); c.setTransform(m.a / CROWD_FINE, 0, 0, m.d / CROWD_FINE, sx, sy);
}
// a fan's poster (fine pixels). Twelve kinds, all about the team or a favourite player (by the real numbers
// dressed tonight): GO <TEAM>!, I ♥ #NN, a fire sign, a heart board, a gold star, a cardboard jersey, the team
// logo painted on, MARRY ME #NN?, #NN 4 MVP (with a crown), <US> > <THEM>, HI MOM! (with a smiley), #NN IS MY DAD!
const SIGN_HEART5 = ['01010', '11111', '11111', '01110', '00100'];
const SIGN_HEART = ['00011100000111000', '00111110001111100', '01111111011111110', '11111111111111111', '11111111111111111', '11111111111111111', '11111111111111111', '01111111111111110', '00111111111111100', '00011111111111000', '00001111111110000', '00000111111100000', '00000011111000000', '00000001110000000', '00000000100000000'];
const SIGN_SMILE = ['01110', '10001', '01010', '10001', '01110'].map((r, j) => j === 2 ? '10101' : j === 3 ? '10001' : j === 1 ? '11011' : r);
const SIGN_CROWN = ['1001001', '1101011', '1111111', '1111111'];
const SIGN_JERSEY = ['0001111111000', '1111100011111', '1111111111111', '1111111111111', '0011111111100', '0011111111100', '0011111111100', '0011111111100', '0011111111100', '0011111111100', '0011111111100', '0011111111100'];
// a star (or any polygon) rasterised on the fine grid, cached
const SIGN_POLY = {};
function polyBits(key, pts, w, h) {
  if (SIGN_POLY[key]) return SIGN_POLY[key];
  const rows = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) {
      const px = x + 0.5, py = y + 0.5; let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside; }
      r += inside ? '1' : '0';
    }
    rows.push(r);
  }
  return (SIGN_POLY[key] = rows);
}
const SIGN_STAR = polyBits('star', Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 4.2 : 10; return [10.5 + Math.cos(a) * rr, 10.8 + Math.sin(a) * rr]; }), 21, 20);
function signBits(c, rows, x, y, col) { c.fillStyle = col; rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '1') c.fillRect(x + i, y + j, 1, 1); }); }
function outlined(c, rows, x, y, fill, edge) { for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) signBits(c, rows, x + ox, y + oy, edge || '#141832'); signBits(c, rows, x, y, fill); }
function inkText(c, str, x, y, col, shadow) { if (shadow) pText(c, str, x + 1, y + 1, shadow); pText(c, str, x, y, col); }
// the size of a sign (fine px)
function fanSignSize(sg) {
  switch (sg.k) {
    case 'heart': return [17, 15];
    case 'star': return [21, 20];
    case 'jersey': return [13, 12];
    case 'emblem': return [20, 20];
    case 'fire': return [Math.max(17, pTextW(sg.n) + 8), 15];
    case 'love': return [Math.max(15, 2 + 3 + 1 + 5 + 1 + pTextW(sg.n) + 2 + 2), 9];
    case 'mvp': return [Math.max(pTextW(sg.n), pTextW('4 MVP')) + 6, 21];
    case 'himom': return [pTextW('HI MOM!') + 11, 9];
    default: { const ls = [sg.a, sg.b].filter(Boolean); return [Math.max(11, Math.max(...ls.map(l => pTextW(l))) + 4 + (sg.k === 'marry' ? 7 : 0)), ls.length * 6 + 3]; }
  }
}
function drawFanSign(c, st, X, Y, raised, sway) {
  const sc = st.signScale || 1;
  if (sc !== 1 && raised) {                                                     // a big poster (the few signs held up at a time)
    c.save(); c.translate(X + 9 + sway, Y + 1); c.scale(sc, sc);
    try { drawFanSign(c, Object.assign({}, st, { signScale: 1, noHands: true }), -9, -1, true, 0); } finally { c.restore(); }
    c.fillStyle = st.s; c.fillRect(X + 1 + sway, Y - 2, 3, 3); c.fillRect(X + 14 + sway, Y - 2, 3, 3);
    return;
  }
  const sg = st.sg || { k: 'go', a: 'GO!' };
  const [w, hgt] = fanSignSize(sg);
  if (!raised && hgt > 9) return;                                               // big signs only come out when the fans stand
  const sx = X + 9 - (w >> 1) + sway, sy = raised ? Y - hgt + 1 : Y + 12;
  const T0 = st.T, tc = T0.main, tt = lum(T0.trim) > 0.85 && lum(tc) > 0.85 ? '#141832' : T0.trim, sty = st.sty || 0;
  const ink = lum(tc) > 0.45 ? (T0.dark && lum(T0.dark) < 0.45 ? T0.dark : '#141832') : tc;
  const centre = (str, y, col, sh) => inkText(c, str, sx + ((w - pTextW(str)) >> 1), y, col, sh);
  const k = sg.k;
  if (k === 'heart') {                                                          // a heart cut out of foam board
    const fill = sg.c || '#e0302a';
    outlined(c, SIGN_HEART, sx, sy, fill);
    c.fillStyle = shade(fill, -0.25); c.fillRect(sx + 6, sy + 12, 5, 1); c.fillRect(sx + 3, sy + 9, 2, 1); c.fillRect(sx + 12, sy + 9, 2, 1);
    c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(sx + 3, sy + 2, 2, 1); c.fillRect(sx + 2, sy + 3, 1, 2);
    centre(String(sg.n).replace('#', ''), sy + 5, '#ffffff', 'rgba(0,0,0,.4)');
  } else if (k === 'star') {                                                    // a gold foil star with the number
    outlined(c, SIGN_STAR, sx, sy, '#f2c230');
    c.fillStyle = '#fff3a0'; c.fillRect(sx + 9, sy + 3, 1, 3); c.fillRect(sx + 4, sy + 8, 3, 1);
    c.fillStyle = '#c99a1f'; c.fillRect(sx + 7, sy + 15, 7, 1);
    centre(String(sg.n).replace('#', ''), sy + 8, '#141832');
  } else if (k === 'jersey') {                                                  // a cardboard jersey in team colours
    outlined(c, SIGN_JERSEY, sx, sy, tc);
    c.fillStyle = tt; c.fillRect(sx, sy + 3, 5, 1); c.fillRect(sx + 8, sy + 3, 5, 1); c.fillRect(sx + 2, sy + 10, 9, 1);
    c.fillStyle = shade(tc, -0.3); c.fillRect(sx + 5, sy + 1, 3, 1);
    const n = String(sg.n).replace('#', ''); inkText(c, n, sx + ((w - pTextW(n)) >> 1), sy + 4, lum(tc) > 0.6 ? '#141832' : '#ffffff');
  } else if (k === 'emblem') {                                                  // the team logo painted on a round board
    c.fillStyle = '#141832'; c.fillRect(sx + 2, sy - 1, 16, 22); c.fillRect(sx - 1, sy + 2, 22, 16); c.fillRect(sx, sy, 20, 20);
    c.fillStyle = tc; c.fillRect(sx + 2, sy, 16, 20); c.fillRect(sx, sy + 2, 20, 16); c.fillRect(sx + 1, sy + 1, 18, 18);
    c.fillStyle = tt; c.fillRect(sx + 3, sy + 1, 14, 1); c.fillRect(sx + 3, sy + 18, 14, 1);
    if (typeof crestRuns === 'function' && T0.colors) for (const [col, rx, ry, rw] of crestRuns(T0)) { c.fillStyle = col; c.fillRect(sx + 2 + rx, sy + 2 + ry, rw, 1); }
  } else {
    // rectangular boards: white with a team stripe, solid team colour, cardboard, or black (the fire sign)
    const fire = k === 'fire', bg = fire ? '#1a1a24' : sty === 1 ? tc : sty === 2 ? '#d8b483' : '#f4f4ee';
    const fg = fire ? '#ffffff' : sty === 1 ? (lum(tc) > 0.6 ? '#141832' : '#ffffff') : sty === 2 ? '#1a1a24' : ink;
    const sh = sty === 1 ? 'rgba(0,0,0,.35)' : null;
    c.fillStyle = '#141832'; c.fillRect(sx - 1, sy - 1, w + 2, hgt + 2);
    c.fillStyle = bg; c.fillRect(sx, sy, w, hgt);
    if (!fire) {
      if (sty === 0) { c.fillStyle = tc; c.fillRect(sx, sy, w, 1); }
      if (sty === 1) { c.fillStyle = tt; c.fillRect(sx, sy, w, 1); c.fillRect(sx, sy + hgt - 1, w, 1); }
      if (sty === 2) { c.fillStyle = 'rgba(120,80,40,.35)'; c.fillRect(sx + 2, sy + hgt - 2, w - 4, 1); }
    }
    if (fire) {                                                                  // flames licking up from the bottom edge
      const TONGUE = [3, 5, 8, 6, 4, 6, 9, 7, 5, 3, 6, 8, 10, 7, 4, 5, 7, 5, 3, 6, 8, 6], o = (st.ph * 7) | 0;
      for (let i = 0; i < w; i++) {
        const fh = TONGUE[(i + o) % TONGUE.length];
        c.fillStyle = '#c42a1f'; c.fillRect(sx + i, sy + hgt - fh, 1, fh);
        if (fh > 2) { c.fillStyle = '#ff7a1a'; c.fillRect(sx + i, sy + hgt - fh + 2, 1, fh - 2); }
        if (fh > 5) { c.fillStyle = '#ffd23f'; c.fillRect(sx + i, sy + hgt - fh + 5, 1, fh - 5); }
      }
      const tx = sx + ((w - pTextW(sg.n)) >> 1);
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) pText(c, sg.n, tx + ox, sy + 2 + oy, '#1a1a24');
      pText(c, sg.n, tx, sy + 2, '#ffffff');
    } else if (k === 'love') {
      const iw = 3 + 1 + 5 + 1 + pTextW(sg.n), ix = sx + ((w - iw) >> 1), iy = sy + 2;
      inkText(c, 'I', ix, iy, fg, sh); signBits(c, SIGN_HEART5, ix + 4, iy, '#e0302a'); inkText(c, sg.n, ix + 10, iy, fg, sh);
    } else if (k === 'mvp') {
      signBits(c, SIGN_CROWN, sx + ((w - 7) >> 1), sy + 2, '#f2c230');
      centre(sg.n, sy + 8, fg, sh); centre('4 MVP', sy + 14, sty === 1 ? fg : '#c42a1f', sh);
    } else if (k === 'himom') {
      signBits(c, SIGN_SMILE, sx + 2, sy + 2, '#e0a020');
      inkText(c, 'HI MOM!', sx + 9, sy + 2, fg, sh);
    } else {
      [sg.a, sg.b].filter(Boolean).forEach((l, i) => inkText(c, l, sx + ((w - pTextW(l) - (k === 'marry' ? 7 : 0)) >> 1), sy + 2 + i * 6, fg, sh));
      if (k === 'marry') signBits(c, SIGN_HEART5, sx + w - 7, sy + hgt - 8, '#e0302a');
    }
    c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(sx, sy, 1, hgt - 1);
    c.fillStyle = 'rgba(0,0,0,.16)'; c.fillRect(sx + 1, sy + hgt - 1, w - 1, 1);
  }
  if (raised && !st.noHands) { c.fillStyle = st.s; c.fillRect(X + 1, sy + hgt - 1, 3, 2); c.fillRect(X + 14, sy + hgt - 1, 3, 2); }   // hands on the edge
}
// what a fan writes (tIdx = the team he cheers for, oIdx = the other one)
function fanSignPick(T0, tIdx, kind) {
  let nums = [];
  try { nums = (typeof dressedSkaters === 'function' ? dressedSkaters(tIdx) : []).map(pl => pl.num).filter(n => n != null); } catch (e) { nums = []; }
  if (!nums.length) nums = [9, 19, 91, 87, 8, 13, 27, 44];
  const num = '#' + nums[Math.min(nums.length - 1, (Math.random() * Math.random() * nums.length) | 0)];   // the top line gets the most love
  const nick = String(T0.nick || T0.abbr || 'TEAM').toUpperCase(), ab = String(T0.abbr || nick.slice(0, 3)).toUpperCase();
  const opp = typeof TEAM !== 'undefined' && TEAM[1 - tIdx] ? String(TEAM[1 - tIdx].abbr || 'THEM').toUpperCase() : 'THEM';
  const K = kind || FAN_SIGN_KINDS[(Math.random() * FAN_SIGN_KINDS.length) | 0];
  switch (K) {
    case 'go': return nick.length <= 5 ? { k: 'go', a: 'GO ' + nick + '!' } : { k: 'go', a: 'GO', b: (nick.length > 8 ? ab : nick) + '!' };
    case 'love': return { k: 'love', n: num };
    case 'fire': return { k: 'fire', n: num };
    case 'heart': return { k: 'heart', n: num, c: Math.random() < 0.6 ? '#e0302a' : '#ff5fa2' };
    case 'star': return { k: 'star', n: num };
    case 'jersey': return { k: 'jersey', n: num };
    case 'emblem': return { k: 'emblem' };
    case 'marry': return { k: 'marry', a: 'MARRY ME', b: num + '?' };
    case 'mvp': return { k: 'mvp', n: num };
    case 'versus': return { k: 'versus', a: ab + ' > ' + opp };
    case 'himom': return { k: 'himom' };
    default: return { k: 'dad', a: num + ' IS', b: 'MY DAD!' };
  }
}
const FAN_SIGN_KINDS = ['go', 'love', 'fire', 'heart', 'star', 'jersey', 'emblem', 'marry', 'mvp', 'versus', 'himom', 'dad'];
// fan looks, picked once per seat
function fanLook(st) {
  if (st.lk) return st.lk;
  const r = (st.ph * 9973) % 1, r2 = (st.ph * 7919) % 1;
  return (st.lk = { hs: (r * 5) | 0, jer: !st.away && st.c === st.T.main ? r2 < 0.55 : st.away ? r2 < 0.5 : false, paint: r2 > 0.93, glasses: r > 0.9 && r2 < 0.3, beard: r2 > 0.4 && r2 < 0.52, hatK: (r2 * 3) | 0 });
}
// one seated fan (one FAN_CW x FAN_RH crowd cell) in crowd frame f; shared by the stands around the rink and the stadium beside it
function drawFanSprite(c, st, f, VN, force) {
  fanBegin(c, st.x, st.y);
  try { drawFanFine(c, st, f, VN, force); } finally { c.restore(); }
}
// one seated fan, 18 x 22 fine pixels (the same pixel size as the players): a seat, a body with arms, a face with
// brows, eyes, nose and mouth, hair or a hat, and the props (foam finger, thundersticks, scarf, flag, sign)
const FAN_FINGER = [   // the foam finger: index finger up, knuckles, thumb, the printed "1", the cuff (1 = foam, 2 = ink, 3 = cuff)
  '...11....', '...11....', '..1111...', '..1111...', '..1111...', '..1111...', '.1111111.', '11111211.', '11112211.',
  '11111211.', '11111211.', '1111121111', '.11111111', '.3333333.', '.3333333.', '..33333..'];
function drawFanFine(c, st, f, VN, force) {
  // the seat: back with a lit top edge and a seam, the step below
  c.fillStyle = VN.back; c.fillRect(1, 11, 16, 10);
  c.fillStyle = shade(VN.back, 0.14); c.fillRect(1, 11, 16, 1); c.fillRect(1, 12, 1, 8);
  c.fillStyle = shade(VN.back, -0.2); c.fillRect(1, 20, 16, 1); c.fillRect(8, 12, 2, 8); c.fillRect(16, 12, 1, 8);
  c.fillStyle = shade(VN.floor, -0.22); c.fillRect(0, 21, 18, 1);
  if ((st.empty || st.dyn) && !force) return;
  // frames: 0/1 idle sway, 2/3 home jumps, 4/5 away fans jump, 6/7 everyone jumps
  const grp = f >> 1, alt = f & 1;
  const jumping = (grp === 1 && !st.away) || (grp === 2 && st.away) || grp === 3;
  const up = jumping ? ((st.ph < 0.5) === !!alt ? -6 : -3) : 0;
  const lean = grp === 0 && alt && st.ph < 0.3 ? (st.ph < 0.15 ? -1 : 1) : 0;
  const X = lean, Y = up, L = fanLook(st);
  const raised = jumping || (grp === 0 && (alt ? st.ph < 0.35 : st.ph > 0.7));
  const tc = st.T.main, tt = lum(st.T.trim) > 0.85 && lum(tc) > 0.85 ? '#141832' : st.T.trim;
  const sway = raised && jumping ? (alt ? 1 : -1) : 0;
  const armsUp = (jumping && st.arms) || (raised && st.prop === 'sign');
  const shirt = st.c, shirtD = shade(shirt, -0.24), shirtL = shade(shirt, 0.16), skin = st.s, skinD = shade(skin, -0.18);
  const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(X + x, Y + y, w, h); };
  // flag pole goes behind the fan
  if (st.prop === 'flag') {
    const wv = alt ? 1 : 0;
    R(15, -22, 1, 34, '#9aa3c7'); R(15, -23, 1, 1, '#ffffff');
    R(16, -22 + wv, 18, 12, tc); R(34, -21 + wv * 2, 1, 10, tc); R(16, -18 + wv, 18, 3, tt); R(24, -22 + wv, 2, 12, shade(tc, -0.2));
    R(16, -11 + wv, 18, 1, shade(tc, -0.3));
  }
  // torso: a shirt, or a team jersey (shoulder yoke, a stripe across the chest, a crest or the number on the back)
  R(4, 10, 10, 1, shirt); R(3, 11, 12, 10, shirt);
  R(14, 11, 1, 10, shirtD); R(3, 20, 12, 1, shirtD); R(7, 10, 4, 1, shirtD);
  R(4, 11, 3, 1, shirtL);
  if (L.jer) {
    R(3, 11, 12, 2, shade(shirt, 0.1)); R(3, 16, 12, 2, tt); R(3, 11, 2, 2, tt); R(13, 11, 2, 2, tt);
    if (st.back) { R(6, 12, 2, 4, tt); R(10, 12, 2, 4, tt); R(7, 13, 1, 2, shirt); }                        // the number on his back
    else { R(8, 13, 2, 2, tt); R(8, 13, 1, 1, shade(tt, -0.3)); }                                          // the crest
  }
  // arms: up (cheering, or holding a sign) or resting on the lap; a foam-finger fan keeps that arm up
  const fingerSide = st.prop === 'finger' ? (st.ph < 0.5 ? 1 : -1) : 0, fUp = st.prop === 'finger' && raised;
  const armUp = sx => { const ax = sx < 0 ? 1 : 15; R(ax, 4, 2, 8, shirt); R(sx < 0 ? ax : ax + 1, 4, 1, 8, shirtD); R(ax, 0, 2, 4, skin); R(sx < 0 ? 0 : 15, -2, 3, 3, skin); R(sx < 0 ? 0 : 17, -1, 1, 2, skinD); };
  const armDown = sx => { const ax = sx < 0 ? 1 : 15; R(ax, 11, 2, 7, shirt); R(ax + (sx < 0 ? 0 : 1), 12, 1, 6, shirtD); R(sx < 0 ? 3 : 13, 18, 2, 2, skin); };
  const phoneUp = st.prop === 'phone';                                    // in the dark light show: one arm up, filming on his phone
  for (const sx of [-1, 1]) (armsUp || (fUp && sx === fingerSide) || (phoneUp && sx > 0) ? armUp : armDown)(sx);
  if (phoneUp) {
    R(15, -8, 4, 7, '#14161f'); R(16, -7, 2, 5, '#2a2e40');                // the phone, held up at the end of his arm (its back to the ice)
    const fl = st.flash || 0; R(16, -7, 1, 1, fl > 0.5 ? '#ffffff' : '#cfe4ff');   // the camera light
  }
  // props in hand
  if (st.prop === 'finger') {
    const wv = raised ? (alt ? 1 : -1) : 0, fx = X + (fingerSide > 0 ? 12 : -4) + wv, fy = Y + (raised ? -17 : 2);
    const ink = lum(tc) > 0.6 ? '#141832' : '#ffffff';
    c.fillStyle = '#141832';                                                                               // outline
    FAN_FINGER.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.') { c.fillRect(fx + i - 1, fy + j, 3, 1); c.fillRect(fx + i, fy + j - 1, 1, 3); } });
    FAN_FINGER.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const k = r[i]; if (k === '.') continue; c.fillStyle = k === '1' ? tc : k === '2' ? ink : tt; c.fillRect(fx + i, fy + j, 1, 1); } });
    c.fillStyle = shade(tc, -0.25); c.fillRect(fx + 1, fy + 8, 6, 1); c.fillRect(fx + 1, fy + 10, 6, 1); c.fillRect(fx + 8, fy + 7, 1, 5);   // curled fingers
    c.fillStyle = 'rgba(255,255,255,.45)'; c.fillRect(fx + 3, fy, 1, 5); c.fillRect(fx, fy + 7, 1, 3);                                     // shine
    c.fillStyle = skin; c.fillRect(fx + 3, fy + 16, 3, 2);
  } else if (st.prop === 'sticks' && raised) {                         // thundersticks banging together
    const k = alt ? 1 : 0;
    for (const [sx, d] of [[1 + k, 1], [14 - k, -1]]) { R(sx, -14, 3, 16, tc); R(sx, -14, 3, 2, tt); R(sx, -6, 3, 1, tt); R(sx + (d > 0 ? 2 : 0), -13, 1, 14, shade(tc, -0.25)); R(sx + (d > 0 ? 0 : 2), -13, 1, 6, 'rgba(255,255,255,.35)'); }
  } else if (st.prop === 'scarf') {                                     // scarf twirled overhead / worn
    if (raised) { const k = alt ? 2 : -2; for (let i = 0; i < 18; i++) { c.fillStyle = (i >> 1) % 2 ? tt : tc; c.fillRect(X + i + (i < 9 ? 0 : k), Y - 5 - (i === 0 || i === 17 ? 1 : 0), 1, 3); } }
    else { R(4, 10, 10, 2, tc); R(5, 12, 3, 6, tc); R(5, 13, 3, 1, tt); R(5, 16, 3, 1, tt); R(5, 18, 3, 1, tt); }
  }
  // head: neck, ears, the face with shading; hair or a hat over it
  R(7, 9, 4, 1, skinD);
  R(5, 1, 8, 8, skin); R(4, 4, 1, 2, skin); R(13, 4, 1, 2, skinD); R(12, 2, 1, 7, skinD); R(6, 8, 6, 1, skinD);
  const hair = st.h, hairL = shade(hair, 0.22);
  if (st.back) {
    if (st.hat) { R(5, -1, 8, 4, st.hatC); R(4, 1, 10, 2, st.hatC); R(5, 2, 8, 1, shade(st.hatC, -0.25)); if (L.hatK === 1) R(8, -2, 2, 1, '#f4f4f4'); if (L.hatK === 2) R(5, 0, 8, 1, tt); R(5, 3, 8, 3, hair); }
    else if (L.hs !== 4) { R(5, 0, 8, 7, hair); R(4, 1, 1, 3, hair); R(13, 1, 1, 3, hair); R(6, 1, 3, 1, hairL); if (L.hs === 1) { R(4, 4, 10, 5, hair); } if (L.hs === 2) R(4, -1, 10, 2, hair); }
    else { R(6, 1, 2, 1, shade(skin, 0.15)); }
  } else {
    if (st.hat) {
      R(5, -1, 8, 3, st.hatC); R(4, 0, 10, 2, st.hatC); R(5, -1, 2, 1, shade(st.hatC, 0.2));
      if (L.hatK === 0) { R(4, 2, 9, 1, shade(st.hatC, -0.3)); R(8, -1, 2, 1, shade(st.hatC, -0.15)); }                  // cap with its brim
      else if (L.hatK === 1) { R(8, -2, 2, 1, '#f4f4f4'); R(4, 2, 10, 1, shade(st.hatC, 0.18)); }                          // toque with a pompom
      else { R(4, 1, 10, 1, tt); R(4, 2, 10, 1, shade(st.hatC, -0.25)); }                                                  // team beanie
    } else if (L.hs !== 4) {
      R(5, 0, 8, 2, hair); R(6, 0, 3, 1, hairL);
      if (L.hs === 0) R(5, 2, 2, 1, hair);                                                                                  // short, swept
      if (L.hs === 1) { R(4, 1, 2, 7, hair); R(12, 1, 2, 7, hair); R(5, 2, 8, 1, hair); }                                  // long
      if (L.hs === 2) { R(5, -1, 8, 1, hair); R(4, 0, 1, 4, hair); R(13, 0, 1, 4, hair); R(6, -1, 1, 1, hairL); R(10, 0, 1, 1, hairL); }   // curly / big
      if (L.hs === 3) { R(6, -1, 1, 1, hair); R(8, -1, 1, 1, hair); R(10, -1, 1, 1, hair); }                              // spiky
    } else R(6, 1, 2, 1, shade(skin, 0.15));                                                                                // bald, with a shine
    if (L.paint) { R(5, 4, 2, 3, tc); R(11, 4, 2, 3, tt); }                                                                // face paint
    R(6, 3, 2, 1, shade(hair, -0.15)); R(10, 3, 2, 1, shade(hair, -0.15));                                               // brows
    R(7, 4, 1, 1, '#1a1a24'); R(10, 4, 1, 1, '#1a1a24'); R(6, 4, 1, 1, '#ffffff'); R(11, 4, 1, 1, '#ffffff');            // eyes
    if (L.glasses) { R(5, 4, 3, 1, '#1a1a24'); R(10, 4, 3, 1, '#1a1a24'); R(8, 4, 2, 1, '#1a1a24'); R(6, 4, 1, 1, 'rgba(200,230,255,.8)'); R(11, 4, 1, 1, 'rgba(200,230,255,.8)'); }
    R(9, 5, 1, 1, skinD);                                                                                                  // nose
    if (L.beard) { R(5, 6, 8, 3, hair); R(6, 8, 6, 1, hair); }
    if (jumping) { R(8, 6, 2, 2, '#7a2020'); R(8, 6, 2, 1, '#ffffff'); }                                                   // cheering, mouth open
    else R(8, 7, 2, 1, shade(skin, -0.35));
  }
  if (!fanSignsLater && st.prop === 'sign' && typeof pText === 'function' && (raised || st.ph < 0.5)) drawFanSign(c, st, X, Y, raised, sway);   // in front of the fan
}
// signs go on top of the whole crowd in a second pass, so neighbours never cover the lettering
let fanSignsLater = false;
function drawFanSigns(c, seats, f) {
  for (const st of seats) {
    if (st.prop !== 'sign' || st.empty || st.dyn) continue;
    const grp = f >> 1, alt = f & 1, jumping = (grp === 1 && !st.away) || (grp === 2 && st.away) || grp === 3;
    const raised = jumping || (grp === 0 && (alt ? st.ph < 0.35 : st.ph > 0.7));
    if (!raised && st.ph >= 0.5) continue;
    const up = jumping ? ((st.ph < 0.5) === !!alt ? -4 : -2) : 0, lean = grp === 0 && alt && st.ph < 0.3 ? (st.ph < 0.15 ? -1 : 1) : 0;
    fanBegin(c, st.x, st.y);
    try { drawFanSign(c, st, lean, up, raised, raised && jumping ? (alt ? 1 : -1) : 0); } finally { c.restore(); }
  }
}
// festoons of streamers: a sagging line of little alternating flags, every few pixels
function drawStreamers(c, runs, T) {
  const cols = [T.main, T.trim || '#ffffff', shade(T.main, 0.25)];
  for (const [x0, y0, len] of runs) for (let x = x0, k = 0; x < x0 + len; x += 2, k++) {
    const sag = Math.round(Math.sin((x % 24) / 24 * Math.PI) * 2);
    c.fillStyle = cols[k % 3]; c.fillRect(x, y0 + sag, 2, 1); if (k % 2) c.fillRect(x, y0 + sag + 1, 1, 1);
  }
}
function buildCrowd() {
  const hm = S.match ? S.match.home : 0;
  const H0 = TEAM[hm], H1 = TEAM[1 - hm];
  const SW = Math.ceil(W / SS), SH = Math.ceil(H / SS);        // 1 canvas px = 1 sprite px (same scale as players)
  const pick = a => a[(Math.random() * a.length) | 0];
  const skins = ['#f0c49b', '#d9a066', '#a8714a', '#7a4b2a', '#f5d0b0', '#e8b48a'];
  const hairs = ['#2b1d12', '#5a3a1e', '#c9a050', '#1a1a1a', '#8a3a1a', '#d8d8d8', '#6a4a2a'];
  const homeCols = [H0.main, H0.main, H0.main, H0.trim, H0.dark], awayCols = [H1.main, H1.main, H1.trim];
  const misc = ['#d8d8d8', '#555b7a', '#c94a3a', '#e0b030', '#3a8a5a', '#8a5ad0', '#2a2a2a'];
  const CW = FAN_CW, RH = FAN_RH;
  const AC0 = typeof arenaCfg === 'function' ? arenaCfg() : {};
  const VN = Object.assign({}, typeof venueOf === 'function' && typeof arenaCfg === 'function' ? venueOf(AC0) : { floor: '#1c2144', aisle: '#363f78', step: '#2a3266', back: '#2b3266', bg: '#0b0d1a' });
  // SEATING COLOUR (arena option): the seat backs; 'steel' keeps the building's own
  { const sc = AC0.seatHex || { red: '#8a2430', team: shade(H0.main, -0.3), black: '#16171d', gold: '#a8842a' }[AC0.seats]; if (sc) VN.back = sc; }
  // CROWD COLOURS (promotion nights): what the home fans wear
  const promo = AC0.crowd || 'home', promoCol = { whiteout: ['#f2f4f8', '#e6e9f0', '#ffffff'], blackout: ['#16171d', '#22242c', '#0e0f13'], gold: ['#e6b422', '#f2c230', '#d9a516'] }[promo];
  // a tournament is a neutral site: both teams' fans in about equal numbers, plus fans in the tournament's colours
  const neutral = promo === 'tourney', tCols = AC0.crowdHex || null;
  const topEnd = Math.floor((R.t - 24) / SS), botStart = Math.ceil((R.b + 20) / SS);
  const leftEnd = Math.floor((R.l - 22) / SS), rightStart = Math.ceil((R.r + 22) / SS);
  const aisleX = [0.25, 0.5, 0.75].map(a => Math.round(SW * a));
  const aisleY = [Math.round((R.t + 110) / SS), Math.round((R.b - 110) / SS)];
  const seats = [];
  // how full it is: career games follow the home side's popularity and record; Quick Play / exhibitions sell out
  const fill = S.match && S.match.fill != null ? clamp(S.match.fill, 0.3, 1) : 1;
  const emptyP = 0.015 + (1 - fill) * 0.97;
  // fans come in groups of 2-5 sitting together (families, friends), mostly home colours, some visitors' groups,
  // and the odd lone road-tripper in the away colours dotted around
  let grp = { left: 0, kind: 'home', y: null, empty: false };
  const nextGroup = y => {
    const r = Math.random();
    if (r < 0.07) return { left: 1, kind: 'away', y, empty: Math.random() < emptyP };                   // a lone visitor
    const kind = neutral ? (r < 0.4 ? 'away' : r < 0.6 ? 'misc' : 'home') : r < 0.27 ? 'away' : r < 0.37 ? 'misc' : 'home';
    // empty seats come in gaps too (a group that didn't show), so a thin crowd has holes, not static
    return { left: 2 + ((Math.random() * 4) | 0), kind, y, empty: Math.random() < emptyP };
  };
  const mkFan = (x, y, back) => {
    if (grp.left <= 0 || grp.y !== y) grp = nextGroup(y);
    grp.left--;
    let kind = Math.random() < 0.12 && grp.kind !== 'away' ? 'misc' : grp.kind;     // a neutral shirt here and there in a group
    if (promo === 'mixed' && kind === 'home' && Math.random() < 0.45) kind = 'misc';    // a mixed crowd: plenty of everyday clothes
    const c = kind === 'home' ? (promoCol && Math.random() < 0.88 ? pick(promoCol) : pick(homeCols)) : kind === 'away' ? pick(awayCols) : (tCols && Math.random() < 0.65 ? pick(tCols) : pick(misc));
    const T0 = kind === 'away' ? H1 : H0, pr = Math.random();
    // props: foam fingers, text signs, thundersticks, scarves, flags (fans of the visiting team bring theirs too)
    // (signs are not baked in: a handful of fans hold them up at a time, see crowdFx in crowd.js)
    const fl = AC0.deco === 'flags' ? 0.07 : 0.015;   // FAN FLAGS decoration: lots more flags in the stands
    const prop = kind === 'misc' ? null : pr < 0.06 ? 'finger' : pr < 0.11 ? 'sticks' : pr < 0.15 ? 'scarf' : pr < 0.15 + fl ? 'flag' : null;
    return ({ x, y, back, empty: grp.empty || Math.random() < 0.012, s: pick(skins), h: pick(hairs), c, away: kind === 'away',
      hat: Math.random() < 0.18, hatC: Math.random() < 0.5 ? c : pick(misc), arms: Math.random() < 0.7,
      prop, T: T0, sty: (Math.random() * 4) | 0, ph: Math.random() });
  };
  const offLimits = (x, y) => {                       // (crowd px) seats removed for the bench enclosures, the corridor and the tunnel
    const wx0 = x * SS, wx1 = (x + CW) * SS, wy0 = y * SS, wy1 = (y + RH) * SS;
    if (wx1 > BENCH_X0 - 4 && wx0 < R.l && wy1 > BENCH_Y[0] - 6 && wy0 < BENCH_Y[1] + BENCH_LEN + 6) return true;
    if (wx1 > ZTUN.x0 - 5 && wx0 < ZTUN.x1 + 5 && wy1 > ZTUN.y0) return true;
    if (typeof pbOffLimits === 'function' && pbOffLimits(wx0, wx1, wy0, wy1)) return true;
    return wx1 > TUN.x0 - 2 && wx0 < TUN.x1 && wy1 > TUN.y0 - 4 && wy0 < TUN.y1 + 4;
  };
  const fan = (x, y, back) => { if (!offLimits(x, y)) seats.push(mkFan(x, y, back)); };
  const inAisleX = x => aisleX.some(a => x + CW > a - 3 && x < a + 3);
  const inAisleY = y => aisleY.some(a => y + RH > a - 3 && y < a + 3);
  for (let y = topEnd - RH, i = 0; y > -RH + 3; y -= RH, i++) for (let x = (i % 2) * 6 - 3 - (i % 2 ? CW : 0); x < SW; x += CW) if (!inAisleX(x)) fan(x, y, false);
  for (let y = botStart, i = 0; y < SH - 2; y += RH, i++) for (let x = (i % 2) * 6 - 3 - (i % 2 ? CW : 0); x < SW; x += CW) if (!inAisleX(x)) fan(x, y, true);
  for (let y = topEnd + 2; y < botStart - RH + 2; y += RH) {
    if (inAisleY(y)) continue;
    for (let x = leftEnd - CW; x > -CW + 2; x -= CW) fan(x, y, false);
    for (let x = rightStart; x < SW; x += CW) fan(x, y, false);
  }
  if (typeof stadDrawWorld === 'function') for (const sd of [0, 1]) {   // a few fans by the edges get up for snacks (animated by stadium.js)
    const pool = seats.filter(st => !st.empty && !st.prop && st.y > topEnd && st.y < botStart - RH && (sd ? st.x >= rightStart : st.x < leftEnd));
    for (let k = 0; k < Math.round(7 * (0.3 + 0.7 * crowdLife())) && pool.length; k++) { const st = pool.splice((Math.random() * pool.length) | 0, 1)[0]; st.dyn = true; st.side = sd ? 'R' : 'L'; }
  }
  seats.sort((a, b) => a.y - b.y);
  crowdSeats = seats; crowdVN = VN;
  if (typeof stadOnCrowd === 'function') stadOnCrowd({ mkFan, VN, topEnd, botStart, leftEnd, rightStart, aisleY, SW, SH, CW, RH, seats });
  const drawFan = (c, st, f) => drawFanSprite(c, st, f, VN);
  // the floor, aisles and steps are drawn once at crowd-pixel resolution, then each frame is built at the fine
  // resolution (CROWD_FINE) so the fans get their extra detail
  const base = mkCanvas(SW, SH), bc = base.getContext('2d');
  bc.fillStyle = VN.floor;
  bc.fillRect(0, 0, SW, topEnd); bc.fillRect(0, botStart, SW, SH - botStart);
  bc.fillRect(0, topEnd, leftEnd, botStart - topEnd); bc.fillRect(rightStart, topEnd, SW - rightStart, botStart - topEnd);
  bc.fillStyle = VN.aisle;
  for (const a of aisleX) { bc.fillRect(a - 3, 0, 6, topEnd); bc.fillRect(a - 3, botStart, 6, SH - botStart); }
  for (const a of aisleY) { bc.fillRect(0, a - 3, leftEnd, 6); bc.fillRect(rightStart, a - 3, SW - rightStart, 6); }
  bc.fillStyle = VN.step;
  for (const a of aisleX) for (let y = topEnd - 1; y > 0; y -= 4) { bc.fillRect(a - 3, y, 6, 1); }
  for (const a of aisleX) for (let y = botStart + 2; y < SH; y += 4) { bc.fillRect(a - 3, y, 6, 1); }
  // STREAMERS decoration: garlands in the home colours along the front of the stands
  if (AC0.deco === 'streamers') drawStreamers(bc, [[0, topEnd - 2, SW], [0, botStart + 1, SW], ...aisleY.flatMap(a => [[0, a - 3, leftEnd], [rightStart, a - 3, SW - rightStart]])], H0);
  // holes for the bench enclosures, the corridor and the tunnel (the rink image shows through)
  bc.clearRect(Math.floor((BENCH_X0 - 4) / SS), Math.floor((BENCH_Y[0] - 6) / SS), Math.ceil((R.l - BENCH_X0 + 4) / SS), Math.ceil((BENCH_Y[1] + BENCH_LEN - BENCH_Y[0] + 12) / SS));
  bc.clearRect(Math.floor((ZTUN.x0 - 5) / SS), Math.floor(ZTUN.y0 / SS), Math.ceil((ZTUN.x1 - ZTUN.x0 + 10) / SS), Math.ceil((H - ZTUN.y0) / SS) + 2);
  bc.clearRect(Math.floor((TUN.x0 - 2) / SS), Math.floor((TUN.y0 - 4) / SS), Math.ceil((TUN.x1 - TUN.x0 + 2) / SS), Math.ceil((TUN.y1 - TUN.y0 + 8) / SS));
  if (typeof PBX !== 'undefined') bc.clearRect(Math.floor((PBX.x0 - 2) / SS), Math.floor((PBX.box[0].y0 - 6) / SS), Math.ceil((PBX.x1 - PBX.x0 + 8) / SS), Math.ceil((PBX.box[1].y1 - PBX.box[0].y0 + 12) / SS));   // the penalty boxes
  const makeCrowdFrame = f => {
    const cv = mkCanvas(Math.round(SW * CROWD_FINE), Math.round(SH * CROWD_FINE)), c = cv.getContext('2d');
    c.imageSmoothingEnabled = false; c.drawImage(base, 0, 0, cv.width, cv.height);
    c.setTransform(CROWD_FINE, 0, 0, CROWD_FINE, 0, 0);
    fanSignsLater = true; try { for (const st of seats) drawFan(c, st, f); } finally { fanSignsLater = false; }
    drawFanSigns(c, seats, f);
    if (typeof stadTint === 'function') stadTint(c, 0, 0, SW, SH);
    return cv;
  };
  crowdImgs = [makeCrowdFrame(0)]; crowdMake = makeCrowdFrame;          // other frames are drawn the first time they are needed
  crowdRedraw0 = () => { crowdImgs.length = 0; crowdImgs[0] = makeCrowdFrame(0); };
}

// ---------- nets & lamps (world coords)
function drawMesh(x0, y0, x1, y1) {
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  for (let y = y0; y < y1; y += 1.5) for (let x = x0 + ((Math.round(y / 1.5)) % 2) * 0.75; x < x1; x += 1.5) ctx.fillRect(x, y, 0.5, 0.5);
}
function drawNetTop() {
  toWorld();
  const x0 = CX - GOAL_HW, x1 = CX + GOAL_HW, y = GL_TOP;
  ctx.fillStyle = 'rgba(10,40,10,.28)'; ctx.fillRect(x0 - 1, y - NET_D, x1 - x0 + 2, NET_D);
  drawMesh(x0 + 1, y - NET_D - 5, x1 - 1, y - 1);
  ctx.fillStyle = '#c9ced8'; ctx.fillRect(x0, y - NET_D - 5, x1 - x0, 1);
  ctx.fillStyle = '#f6f6f2';
  ctx.fillRect(x0 - 1, y - NET_H + 1, 1.4, NET_H - 0.5); ctx.fillRect(x1 - 0.4, y - NET_H + 1, 1.4, NET_H - 0.5);
  ctx.fillRect(x0 - 1, y - NET_H, x1 - x0 + 2, 1.4);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x0 - 1, y - 0.5, x1 - x0 + 2, 1);
}
function drawNetBottom() {
  toWorld();
  const x0 = CX - GOAL_HW, x1 = CX + GOAL_HW, y = GL_BOT;
  ctx.fillStyle = 'rgba(10,40,10,.28)'; ctx.fillRect(x0 - 1, y, x1 - x0 + 2, NET_D + 2);
  drawMesh(x0, y - NET_H + 1.5, x1, y + NET_D);
  ctx.fillStyle = '#f6f6f2';
  ctx.fillRect(x0 - 1, y - NET_H + 1, 1.4, NET_H - 0.5); ctx.fillRect(x1 - 0.4, y - NET_H + 1, 1.4, NET_H - 0.5);
  ctx.fillRect(x0 - 1, y - NET_H, x1 - x0 + 2, 1.4);
  ctx.fillStyle = '#c9ced8'; ctx.fillRect(x0 - 1, y + NET_D - 1, x1 - x0 + 2, 1);
}
// the benches: the players who are not on the ice (by their real colours and numbers), the head coach and an
// assistant; players in the penalty box sit in the box across the ice
// who sits where on a team's bench: the skaters who are off on the front bench by the boards; the spare goalies
// and the two coaches on the back bench by the wall
function benchLayout(t) {
  const hm = S.match.home ?? 0, r = typeof RS === 'function' ? RS() : null;
  const y0 = BENCH_Y[t === hm ? 0 : 1], on = onIceIds(t), home = t === hm;
  const boxed = r ? dressedSkaters(t).filter(pl => r.box && r.box[pl.id] && !on.has(pl.id)) : [];
  const bench = dressedSkaters(t).filter(pl => !on.has(pl.id) && !boxed.includes(pl) && !(typeof isOutPid === 'function' && isOutPid(pl.id)));
  const lu = S.match.lineups[t], gOn = goalies[t] && goalies[t].pl ? goalies[t].pl.id : null;
  const spareG = [lu.goalie].concat(lu.backups || []).filter(g => g && g.id !== gOn && !(typeof isOutPid === 'function' && isOutPid(g.id))).slice(0, 2);
  const list = bench.slice(0, 10).map(pl => ({ pl, g: false }));
  const n = Math.max(list.length, 10), gap = (BENCH_LEN - 30) / (n - 1);
  list.forEach((s, i) => { s.x = R.l - 11; s.y = y0 + 22 + i * gap; s.key = t + ':' + i; });   // (y is the feet: heads stay inside the enclosure)
  // back bench: head coach and assistant at the ends nearest the action, goalies in between (door end kept free)
  const by = k => y0 + (home ? [31, 64, 97, 129] : [36, 68, 100, 133])[k] - 4;   // feet; goalies in the middle with room for their pads
  spareG.forEach((pl, i) => list.push({ pl, g: true, x: BACK_BENCH_X, y: by(1 + i) + 4, key: t + ':g' + i }));
  const coaches = [{ x: BACK_BENCH_X, y: by(0) + 4, asst: 0, key: t + ':c0' }, { x: BACK_BENCH_X, y: by(3) + 4, asst: 1, key: t + ':c1' }];
  return { seats: list, coaches, boxed, y0, home };
}
function drawBenches() {
  if (!S.match || !S.match.lineups || typeof dressedSkaters !== 'function') return;
  if (S.screen === 'intermission') return;                                  // everyone is in the dressing room
  const hm = S.match.home ?? 0, W0 = S.walk, figs = [];
  for (const t of [hm, 1 - hm]) {
    const T = TEAM[t], L = benchLayout(t);
    const cheer = S.cheer > 0 && ((S.cheerKind === 'home') === (t === hm) || S.cheerKind === 'all') && S.phase === 'goal';
    const hopping = new Set(((MS && MS.hops) || []).filter(hp => hp.team === t).map(hp => hp.pl.id));
    if (MS && MS.hops && S.phase !== 'live' && MS.hopT !== S.t) { MS.hopT = S.t; MS.hops = MS.hops.filter(hp => ++hp.t < hp.dur); }   // (play stopped: they still finish)
    for (const hp of ((MS && MS.hops) || [])) if (hp.team === t) {          // a man coming off: over the boards and onto the bench
      const k = Math.min(1, hp.t / hp.dur), e = k * (2 - k), x = hp.x + (hp.tx - hp.x) * e, y = hp.y + (hp.ty - hp.y) * e - Math.sin(k * Math.PI) * 2;
      const f = fakeSkater({ x, y, team: t, pl: hp.pl, num: hp.pl.num, g: false, fx: -1, fy: 0, hand: hp.hand });
      figs.push({ y, d: () => drawSkater(f) });
    }
    L.seats.forEach((s, i) => {
      if (W0 && !W0.arrived.has(s.key)) return;                             // still walking out of the tunnel
      if (S.outro && S.outro.gone && S.outro.gone.has(s.key)) return;        // after the game: already up and off down the tunnel
      if (s.pl && hopping.has(s.pl.id)) return;                             // still climbing over the boards
      const bob = cheer && ((S.t >> 3) + i) % 2 ? -1.5 : 0;
      // drawn exactly like on the ice (same sprites, gear and numbers), facing the play
      const f = fakeSkater({ x: s.x, y: s.y + bob, team: t, pl: s.pl, num: s.pl ? s.pl.num : 0, g: !!s.g, fx: 0, fy: 1, hand: (s.pl && s.pl.hand) || 'L' });
      if (cheer && !s.g) { f.celebT = 40; f.celebType = 'stick'; }
      figs.push({ y: s.y, d: () => (s.g ? drawGoalie(f) : drawSkater(f)) });
    });
    figs.push({ y: -1e9, d: () => drawBenchGates(t) }, { y: 1e9, d: () => drawBenchGateLamps(t) });
    if (t === hm) figs.push({ y: -1e9, d: drawPlayersGate });
    for (const co of L.coaches) if ((!W0 || W0.arrived.has(co.key)) && !(S.outro && S.outro.gone && S.outro.gone.has(co.key))) figs.push({ y: co.y, d: () => drawCoach(co.x, co.y, T, t, co.asst) });
    // (the penalty boxes are drawn by drawPenBoxes, penbox.js)
  }
  figs.sort((a, b) => a.y - b.y); for (const f of figs) f.d();
}
// the players' gate opposite centre ice: double doors that swing back into the corridor while the starters come
// through during the walkout, and close again after the last one
const PGATE = { open: 0, t: -1 };
function drawPlayersGate() {
  if (PGATE.t !== S.t) {                                       // ease once per frame (this is drawn on more than one canvas)
    PGATE.t = S.t;
    // open from the moment the first starter reaches it until the last one is through, then shut
    const W0 = S.walk, st = W0 ? W0.movers.filter(m => m.kind === 'starter') : [];
    const begun = st.some(m => m.pos && (m.seg > 1 || m.pos.x > R.l - 40)), left = st.some(m => !m.pos || (!m.done && m.pos.x < R.l + 22));
    PGATE.want = !!(W0 && begun && left);
    PGATE.open += ((PGATE.want ? 1 : 0) - PGATE.open) * 0.14;
  }
  const k = PGATE.open;
  // the two gate attendants, one each side of the doors: they hold them open and wave the players through
  const hold = k > 0.4;
  drawAttendant(R.l - 9, GATE.y0 - 3, 1, hold, hold && PGATE.want, '#e8b48a');
  drawAttendant(R.l - 9, GATE.y1 + 9, 1, hold, hold && PGATE.want, '#a8714a');
  if (k < 0.02) return;
  toPSprite(R.l, 0); ctx.scale(1 / PSS, 1 / PSS);
  const h = (GATE.y1 - GATE.y0) / 2;
  ctx.fillStyle = typeof enclPal === 'function' ? enclPal().hall : '#262b48'; ctx.fillRect(-6, GATE.y0 + 0.5, 6, GATE.y1 - GATE.y0 - 1);
  for (const [hy, s0] of [[GATE.y0, 1], [GATE.y1, -1]]) {
    const a = s0 > 0 ? Math.PI / 2 + k * Math.PI / 2 : -Math.PI / 2 - k * Math.PI / 2, hx = -3;
    const ex = hx + Math.cos(a) * h, ey = hy + Math.sin(a) * h;
    ctx.strokeStyle = '#8a93a8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = '#dfe4ee'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
  }
}
// gate lamps (red over the OFF gate, green over the ON gate) and the doors swinging open on a line change
function drawBenchGates(t) {
  const G = benchGates(t), since = MS && MS.gateT ? S.t - MS.gateT[t] : 999;
  toPSprite(R.l, 0); ctx.scale(1 / PSS, 1 / PSS);   // world units, x measured from the boards
  const open = (g, a, b) => {
    if (since < a || since > b) return;
    const k = Math.min(1, (since - a) / 10, (b - since) / 10), L = g.y1 - g.y0 - 2, ang = Math.PI / 2 + k * Math.PI / 2;
    ctx.fillStyle = typeof enclPal === 'function' ? enclPal().floor : '#2b3150'; ctx.fillRect(-6, g.y0 + 1, 6, (g.y1 - g.y0 - 2) * k + 1);                   // the gap opening in the boards
    const ex = -3 + Math.cos(ang) * L, ey = g.y0 + 1 + Math.sin(ang) * L;                                  // the door swings back into the bench
    ctx.strokeStyle = '#8a93a8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-3, g.y0 + 1); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = '#dfe4ee'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-3, g.y0 + 1); ctx.lineTo(ex, ey); ctx.stroke();
  };
  open(G.off, 0, 70); open(G.on, 14, 86);
}
function drawBenchGateLamps(t) {
  const G = benchGates(t), since = MS && MS.gateT ? S.t - MS.gateT[t] : 999;
  toPSprite(R.l, 0); ctx.scale(1 / PSS, 1 / PSS);
  const lamp = (g, col) => { ctx.fillStyle = '#0b0e1e'; ctx.fillRect(-5, g.y0 - 1.5, 4, 3); ctx.fillStyle = col; ctx.fillRect(-4.5, g.y0 - 1, 3, 2); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(-4.5, g.y0 - 1, 1, 1); };
  lamp(G.off, since < 70 && (S.t >> 3) & 1 ? '#ffd0c8' : '#ff4a3a'); lamp(G.on, since > 14 && since < 86 && (S.t >> 3) & 1 ? '#d8ffe0' : '#3ccf63');
}
// a figure drawn with the walkout fade and shadow: the sprite at its alpha, then the same sprite as a dark
// silhouette on top (no canvas filters: they are far too slow for pixel sprites)
function drawShadowed(fn, a, dk) {
  if (a < 1) ctx.globalAlpha = a;
  try {
    fn();
    if (dk < 0.99) {
      const c = ctx, fr = c.fillRect;
      c.globalAlpha = a * (1 - dk);
      c.fillRect = function (x, y, w, h) { const f = this.fillStyle; this.fillStyle = '#04050c'; fr.call(this, x, y, w, h); this.fillStyle = f; };
      try { fn(); } finally { delete c.fillRect; }
    }
  } finally { ctx.globalAlpha = 1; }
}
function drawWalkingPlayer(p) {
  if (p.hopIn > 0 && S.screen !== 'replay') {          // stepping over the boards from the bench: drawn sliding out of the gate
    const k = p.hopIn / 14, x0 = p.x, y0 = p.y;
    p.x = x0 + (R.l - 11 - x0) * k * k; p.y = y0 - Math.sin(k * Math.PI) * 2;
    try { drawShadowed(() => drawSkater(p), 1, 1); } finally { p.x = x0; p.y = y0; }
    return;
  }
  drawShadowed(() => (p.g ? drawGoalie(p) : drawSkater(p)), p.walkAlpha ?? 1, p.walkDark ?? 1);
}
// the bench people and the walkout on the stadium canvases beside the rink (so nobody is cut off at the view's edge)
// ====================================================================
//  THE WORLD IN FRONT OF THE RINK: one pass, drawn on the rink view AND on the stands canvases beside it
// ====================================================================
// The stands beside the rink are separate canvases that overlap the rink view's edges a little. Anything on the ice
// that can reach the side boards (skaters, refs, the puck, the Zamboni, aims, stamina bars, meters, sparks, floating
// text, name tags, streak icons...) must be drawn on those canvases too, or the stands slice it in half.
// RULE: draw such things ONLY inside worldItems / worldBars / worldFx / worldTags (or something they call), through
// toWorld / toSprite / toPSprite, and they show on all three canvases automatically. Pure drawing only: no game state
// changes in here (it runs up to three times a frame). `near` is null on the rink view, or (x) => bool on a side
// canvas, to skip things that are nowhere near that edge (just a speed-up: the canvas clips the rest).
const nearOK = (near, x) => !near || near(x);
function worldItems(near) {
  const inter = S.screen === 'intermission' && !!S.inter, items = [];
  if (!near) { items.push({ y: GL_TOP - 6, d: drawNetTop }); items.push({ y: GL_BOT, d: drawNetBottom }); }
  if (inter) items.push({ y: S.inter.zam.y, d: () => drawZamboni(S.inter.zam) });
  else {
    if (typeof drawPenBoxes === 'function') items.push({ y: -1e7, d: () => drawPenBoxes(near) });   // the penalty boxes and who's in them
    if (typeof HATS !== 'undefined' && HATS.length) items.push({ y: -1e9, d: drawHats });
    if (puck.owner && !S.walk && S.screen !== 'intro' && S.screen !== 'celebrate' && nearOK(near, puck.owner.x)) { const o = puck.owner; items.push({ y: o.y - 0.3, d: () => drawCarrierRing(o) }); }
    for (const p of players) if (!p.walkHide && nearOK(near, p.x)) items.push({ y: p.y, d: () => drawWalkingPlayer(p) });
    if (S.walk && typeof walkItems === 'function') walkItems(items, !!near);
    if (S.outro && S.outro.walkoff && typeof walkOffItems === 'function') walkOffItems(items);   // the benches emptying down the tunnel after the game
    for (const r of refs) if (nearOK(near, r.x)) items.push({ y: r.y, d: () => drawRef(r) });
    if (S.fightGear && typeof drawFightGear === 'function') items.push({ y: -1e8, d: drawFightGear });
    if (nearOK(near, puck.x)) items.push({ y: puck.owner ? puck.owner.y + (puck.owner.fy < 0 ? -0.5 : 0.5) : puck.y, d: drawPuck });
  }
  const showCtrl = ctrlShown(inter);
  if (showCtrl && nearOK(near, ctrl.x)) items.push({ y: ctrl.y - 0.1, d: () => drawMarker(ctrl) });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.d();
  if (showCtrl) { if (ctrl.g) drawGoalieAim(ctrl); else { drawAim(ctrl); drawPassAim(ctrl); } }
}
function ctrlShown(inter) {
  return ctrl && !S.walk && !S.autoAI && !inter && S.screen !== 'menu' && S.screen !== 'replay' && S.screen !== 'intro' && S.screen !== 'celebrate' && (S.phase !== 'penalty' || S.pen.team === 0);
}
// everybody's stamina, both teams (who is gassed is part of the game): a small bar under each skater; then the meters
// (Nov 23) the strips under the skaters (stamina, sprint, threat badge) fade away while players are bunched up in front of
// a net, where the frames covered more than the players did, and come back as the pile breaks up (~1/4 s either way)
const BAR_FADE = { net: 62, dx: 16, dy: 15, low: 0.12, rate: 0.16 };
function barFadeTick() {
  const nearNet = p => [GL_TOP, GL_BOT].some(gy => hyp(p.x - CX, p.y - gy) < RK(BAR_FADE.net));
  for (const p of skaters) {
    const crowded = nearNet(p) && skaters.some(q => q !== p && q.on !== false && Math.abs(q.x - p.x) < BAR_FADE.dx && Math.abs(q.y - p.y) < BAR_FADE.dy && nearNet(q));
    const a = p.barA ?? 1; p.barA = a + ((crowded ? BAR_FADE.low : 1) - a) * BAR_FADE.rate;
  }
}
function worldBars(near) {
  const inter = S.screen === 'intermission' && !!S.inter;
  if (!inter && S.match && MS && S.screen !== 'replay' && S.screen !== 'intro' && !S.walk && S.screen !== 'outro') {
    toWorld();
    for (const p of skaters) {
      if (!p.pl || p === ctrl || p.walkHide || !nearOK(near, p.x)) continue;
      const ba = p.barA ?? 1; if (ba < 0.04) continue;
      ctx.globalAlpha = ba;
      const st = stamOf(p), k = clamp(st / 100, 0, 1), bx = p.x - 6, by = p.y + 4.6, cb = S.pres && S.pres.cb;
      ctx.fillStyle = 'rgba(8,10,24,.7)'; ctx.fillRect(bx - 0.5, by - 0.5, 13, 2.2);
      ctx.fillStyle = cb ? (st > 70 ? '#3b8bff' : st > 45 ? '#7fd3ff' : st > 25 ? '#ffd23f' : '#e040c8') : st > 70 ? '#5ee07a' : st > 45 ? '#ffd23f' : st > 25 ? '#ff9a3a' : '#ff4a3d';
      ctx.fillRect(bx, by, Math.max(0.5, 12 * k), 1.2);
      { const cap = stamCapOf(p.pl.id); if (cap < 100) { ctx.fillStyle = '#6a1a22'; ctx.fillRect(bx + 12 * cap / 100, by, 12 * (1 - cap / 100), 1.2); } }
      sprintBox(bx + 12.9, by - 0.5, 2.2, !!p.sprint);
      drawThreat(p, bx, by);
      ctx.globalAlpha = 1;
    }
  }
  if (!inter) for (const p of players) if (nearOK(near, p.x)) drawMeter(p);
}
// sparks and floating text (few, and big text can be wide: never skipped)
function worldFx(near) {
  if (S.screen === 'intermission' && S.inter && S.inter.alien && typeof alienDraw === 'function') alienDraw(near);   // the saucers glow over the blackout
  toWorld();
  for (const pt of particles) { ctx.fillStyle = pt.color; ctx.fillRect(pt.x, pt.y, pt.life > 12 ? 1.5 : 1, 1); }
  for (const f of floaters) {
    ctx.globalAlpha = Math.min(1, f.life / 20);
    if (f.bubble) {
      ctx.font = "8px 'PH Pixel', monospace";
      const w = f.text.length * 8 * CTS + 8, x = f.x - w / 2 + 10, y = f.y - 6;
      ctx.fillStyle = '#141832'; ctx.fillRect(x - 1, y - 1, w + 2, 16);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, w, 14);
      ctx.fillStyle = '#141832'; ctx.beginPath(); ctx.moveTo(x + 6, y + 14); ctx.lineTo(x + 3, y + 21); ctx.lineTo(x + 12, y + 14); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x + 7, y + 13); ctx.lineTo(x + 4.5, y + 18.5); ctx.lineTo(x + 11, y + 13); ctx.fill();
      text(f.text, x + w / 2, y + 3, '#d9342b', 8, 'center', null);
    } else if (f.big) text(f.text, f.x, f.y, f.color, 16, 'center', '#5a2a00');
    else text(f.text, f.x, f.y, f.color, 8);
    ctx.globalAlpha = 1;
  }
}
// labels over heads: the open-man ring, streak icons, name tags, the wind-up "!" (only while playing)
function worldTags(near) {
  if (S.demo || (S.screen !== 'play' && S.screen !== 'paused')) return;
  if (!near) drawOpenCut();
  drawStreakIcons(); drawTagBoxes();
  for (const q of players) if (q.daze > 0 && !(q.stun > 0) && !q.walkHide && nearOK(near, q.x)) {   // WOBBLED, with little stars
    toWorld(); const bob = (S.t >> 4) & 1, al = Math.min(1, q.daze / 30);
    ctx.globalAlpha = al; text('WOBBLED', q.x, q.y - 40 - bob, '#c8a8ff', 7, 'center', '#1a1030');
    for (let k = 0; k < 3; k++) { const a = S.t * 0.15 + k * 2.09; ctx.fillStyle = k === 1 ? '#ffffff' : '#ffd23f'; ctx.fillRect(q.x + Math.cos(a) * 7 - 0.5, q.y - 30 + Math.sin(a) * 2 - 0.5, 1.2, 1.2); }
    ctx.globalAlpha = 1;
  }
  for (const q of players) if (q.windUp && nearOK(near, q.x)) { toWorld(); const k = q.windUp.t; text('!', q.x, q.y - 44 - (k & 2 ? 1 : 0), q.windUp.kind === 'check' ? '#ff6a4a' : '#ffd23f', 15, 'center', '#000'); }
}
// run a world-drawing function on a stands canvas: every world transform helper is pointed at that canvas meanwhile
function drawWorldOn(c, ox, oy, scale, fn) {
  const keep = ctx, kp = toPSprite, ks = toSprite, kw = toWorld;
  ctx = c;
  toPSprite = (x, y) => c.setTransform(scale * PSS, 0, 0, scale * PSS, Math.round((x - ox) * scale), Math.round((y - oy) * scale));
  toSprite = (x, y) => c.setTransform(scale * SS, 0, 0, scale * SS, Math.round((x - ox) * scale), Math.round((y - oy) * scale));
  toWorld = () => c.setTransform(scale, 0, 0, scale, -ox * scale, -oy * scale);
  c.save();
  try { fn(); }
  catch (e) { if (!drawWorldOn.err) { drawWorldOn.err = 1; console.warn('side canvas draw', e); } }
  finally { c.restore(); ctx = keep; toPSprite = kp; toSprite = ks; toWorld = kw; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; }
}
const sideNear = side => side === 'L' ? x => x < R.l + 70 : x => x > R.r - 70;
// the bench side gets its benches too; then everything on the ice near that edge
function drawBenchesOn(c, ox, oy, scale, side = 'L') {
  if (!S.match || !S.match.lineups) return;
  drawWorldOn(c, ox, oy, scale, () => { if (side === 'L') drawBenches(); worldItems(sideNear(side)); });
}
// later in the stands canvas (over its lights, like on the rink view): bars, meters, sparks, text, tags
function drawOverlaysOn(c, ox, oy, scale, side = 'L') {
  if (!S.match) return;
  drawWorldOn(c, ox, oy, scale, () => { const n = sideNear(side); worldBars(n); worldFx(n); worldTags(n); });
}
// ---------- COACHES: each one has his own look and habits (from the team and his job, so always the same man):
// suit, hair, glasses, a cap; a clipboard, a whiteboard or a tablet he brings out now and then; and how fired up he
// gets (some leap onto the bench after goals, penalties and fights; others barely move).
function coachLook(t, asst) {
  const key = (TEAM[t].id || TEAM[t].abbr || 't') + (asst ? ':a' : ':h'), H = k => (typeof hashF === 'function' ? hashF(key, k) : Math.random());
  return {
    key, suit: asst ? ['#3a3f52', TEAM[t].dark, '#2e3346'][(H('suit') * 3) | 0] : ['#1f2230', '#2a3045', '#3a2a1e', '#4a4f5e', '#2b1d12'][(H('suit') * 5) | 0],
    hair: ['#9a9a9a', '#d8d8d8', '#2b1d12', '#5a3a1e', '#c9a050', '#1a1a1a'][(H('hair') * 6) | 0], bald: H('bald') < 0.18,
    skin: ['#f0c49b', '#d9a066', '#a8714a', '#7a4b2a', '#f5d0b0'][(H('skin') * 5) | 0], glasses: H('gl') < 0.35, cap: asst && H('cap') < 0.4,
    prop: ['clip', 'board', 'tablet'][(H('prop') * 3) | 0], propOften: 0.25 + H('often') * 0.55, fire: H('fire'),
  };
}
function coachPose(t, asst, L) {
  // something big just happened? (a goal, a penalty, a fight, the last minute of a close game)
  const big = S.phase === 'goal' || S.phase === 'fight' || (S.lastPenT != null && S.t - S.lastPenT < 150) || (S.period >= 3 && S.clock < 60 && Math.abs(S.score[0] - S.score[1]) <= 1 && S.phase === 'live');
  const win = S.t >> 7, r = typeof hashF === 'function' ? hashF(L.key, 'w' + win) : 0.5;
  const ours = S.phase === 'goal' ? S.lastGoalTeam === t : S.lastPenT != null && S.t - S.lastPenT < 150 ? S.lastPenTeam !== t : null;
  if (big && r < L.fire * 0.95) return { mode: 'onbench', happy: ours === true };             // up on the bench!
  if (big && r < 0.5 + L.fire * 0.4) return { mode: 'stand', happy: ours === true };
  if (r < 0.08 + L.fire * 0.1) return { mode: 'stand', happy: false };                           // paces a little
  return { mode: 'sit' };
}
function drawCoach(x, y, T, t, asst) {
  const L = coachLook(t, asst), P = coachPose(t, asst, L), mode = P.mode;
  const sit = mode === 'sit', lift = mode === 'onbench' ? -6 : 0;
  const propOn = !P.happy && mode !== 'onbench' && (typeof hashF === 'function' ? hashF(L.key, 'p' + (S.t >> 9)) : 0) < L.propOften;
  const jump = mode === 'onbench' && P.happy && ((S.t >> 3) & 1) ? -1 : 0;
  toPSprite(x, y);
  const R = (x0, y0, w, h, c) => { ctx.fillStyle = c; px(x0, y0, w, h); };
  R(-6, 0, 12, 1, 'rgba(0,0,0,.3)'); R(-5, 1, 10, 1, 'rgba(0,0,0,.3)');
  ctx.translate(0, lift + jump + (sit ? 4 : 0));
  const suit = L.suit, suitD = shade(suit, -0.22), suitL = shade(suit, 0.14), skin = L.skin;
  const pants = asst ? suitD : shade(suit, -0.08), pantsD = shade(pants, -0.2), shoe = '#121318', shoeL = '#3a3c46';
  // legs and shoes (seated: thighs toward us, shins down to the floor)
  if (sit) {
    R(-5, -8, 4, 3, pants); R(1, -8, 4, 3, pants); R(-5, -6, 10, 1, pantsD);
    R(-5, -5, 4, 4, pants); R(1, -5, 4, 4, pants); R(-2, -5, 1, 4, pantsD); R(4, -5, 1, 4, pantsD);
    R(-6, -1, 5, 1, shoe); R(1, -1, 5, 1, shoe); R(-6, -1, 1, 1, shoeL); R(1, -1, 1, 1, shoeL);
  } else {
    R(-5, -11, 4, 9, pants); R(1, -11, 4, 9, pants); R(-5, -11, 1, 9, shade(pants, 0.1));
    R(-2, -11, 1, 9, pantsD); R(4, -11, 1, 9, pantsD);                                             // the gap and a crease
    if (asst) { R(-5, -10, 1, 8, T.main); R(4, -10, 1, 8, T.main); }                               // track-pants stripe
    R(-6, -2, 5, 2, shoe); R(1, -2, 5, 2, shoe); R(-6, -2, 1, 1, shoeL); R(1, -2, 1, 1, shoeL);
  }
  // torso: a suit jacket (head coach) or a zipped team track jacket (assistant)
  const ty = -20;
  R(-6, ty, 12, 9, suit); R(-7, ty, 14, 3, suit); R(-6, ty + 8, 12, 1, suitD);
  R(-7, ty, 1, 3, suitL); R(-6, ty + 3, 1, 5, suitL); R(6, ty, 1, 3, suitD); R(5, ty + 3, 1, 5, suitD);
  if (!asst) {
    R(-2, ty, 4, 6, '#eef1f6'); R(-3, ty, 1, 7, suitD); R(2, ty, 1, 7, suitD); R(-2, ty + 5, 4, 1, suit);   // shirt and lapels
    R(-1, ty, 2, 1, shade(T.main, -0.3)); R(-1, ty + 1, 2, 5, T.main); R(0, ty + 1, 1, 4, shade(T.main, 0.15));   // the tie
    R(-5, ty + 3, 2, 1, T.trim || '#ffffff');                                                              // pocket square
    R(0, ty + 6, 1, 1, '#c9ced8'); R(0, ty + 8, 1, 1, '#c9ced8');                                        // buttons
  } else {
    R(-7, ty + 3, 14, 2, T.main); R(-7, ty + 5, 14, 1, T.trim || '#ffffff');
    R(0, ty, 1, 9, '#c9ced8'); R(-2, ty - 1, 5, 1, shade(suit, 0.3));                                   // zip and collar
    if (T.colors && typeof drawCrest === 'function') drawCrest(T, -5, ty + 6, 3);
  }
  // arms: up (celebrating on the bench), pointing at the ice and yelling, holding his clipboard / board / tablet, or down
  const hand = (hx, hy) => { R(hx, hy, 2, 2, skin); R(hx, hy + 1, 2, 1, shade(skin, -0.18)); };
  const sleeve = (ax, ay, h) => { R(ax, ay, 2, h, suit); R(ax + (ax > 0 ? 1 : 0), ay + 1, 1, h - 1, suitD); };
  if (mode === 'onbench' && P.happy) {
    sleeve(-9, ty - 7, 10); sleeve(7, ty - 7, 10); hand(-9, ty - 9); hand(7, ty - 9);
  } else if (mode === 'onbench' || (mode === 'stand' && !P.happy && !propOn && ((S.t >> 5) & 1))) {
    sleeve(-9, ty + 1, 8); hand(-9, ty + 9);                                                           // one hand on the hip...
    R(7, ty + 1, 6, 2, suit); R(7, ty + 2, 6, 1, suitD); hand(13, ty + 1);                             // ...the other pointing at the ice
  } else if (propOn) {
    sleeve(-9, ty + 1, 6); sleeve(7, ty + 1, 6);
    const bx = -5, by = ty + 2;
    if (L.prop === 'clip') {
      R(bx, by, 10, 12, '#6a4423'); R(bx, by, 1, 12, '#8a5a30'); R(bx + 1, by + 1, 8, 10, '#f4f4ee'); R(bx + 3, by - 1, 4, 2, '#c9ced8');
      for (let r = 3; r < 10; r += 2) R(bx + 2, by + r, r === 5 ? 4 : 6, 1, '#7a86a0');
    } else if (L.prop === 'board') {
      R(bx - 1, by, 12, 10, '#9aa3b8'); R(bx, by + 1, 10, 8, '#ffffff');
      R(bx + 1, by + 2, 1, 1, '#d9342b'); R(bx + 2, by + 3, 1, 1, '#d9342b'); R(bx + 2, by + 2, 1, 1, '#d9342b'); R(bx + 1, by + 3, 1, 1, '#d9342b');
      R(bx + 6, by + 5, 2, 2, '#2f6fe8'); R(bx + 3, by + 5, 3, 1, '#1a1a24'); R(bx + 5, by + 4, 1, 1, '#1a1a24');
    } else {
      R(bx, by + 1, 10, 8, '#16181f'); R(bx + 1, by + 2, 8, 6, (S.t >> 5) & 1 ? '#7ec8ff' : '#5ee07a');
      R(bx + 2, by + 3, 2, 1, '#ffffff'); R(bx + 5, by + 5, 3, 1, '#ffffff');
    }
    hand(-6, ty + 6); hand(4, ty + 6);
  } else { sleeve(-9, ty + 1, 8); sleeve(7, ty + 1, 8); hand(-9, ty + 9); hand(7, ty + 9); }
  // neck, then the head (hair, a team cap, or bald with a fringe; glasses; yelling or grinning)
  R(-1, ty - 1, 2, 1, shade(skin, -0.18));
  const yell = mode === 'onbench' || (mode === 'stand' && (S.t >> 4) & 1);
  staffHead((x0, y0, w, h, c) => R(-4 + x0, ty - 9 + y0, w, h, c), {
    skin, hair: L.hair, hs: L.bald ? 4 : (L.key.length % 3 === 0 ? 2 : 0), hat: L.cap ? 'cap' : null, hatC: T.main, badge: T.trim,
    glasses: L.glasses, look: x < R0l() ? 1 : -1, mouth: P.happy ? 'smile' : yell ? 'open' : null,
  });
}
const R0l = () => R.l;
function drawLamps() {
  toWorld();
  for (const [i, y] of [[S.upTeam, R.t - 22], [1 - S.upTeam, R.b + 14]]) {
    const on = S.lamp[i] > 0 && ((S.lamp[i] >> 3) & 1);
    if (on) { const g = ctx.createRadialGradient(CX, y + 2, 0, CX, y + 2, 26); g.addColorStop(0, 'rgba(255,60,40,.7)'); g.addColorStop(1, 'rgba(255,60,40,0)'); ctx.fillStyle = g; ctx.fillRect(CX - 26, y - 24, 52, 52); }
    ctx.fillStyle = '#20242f'; ctx.fillRect(CX - 3.5, y, 7, 5);
    ctx.fillStyle = on ? '#ff5a3c' : '#7a2620'; ctx.fillRect(CX - 2.5, y + 0.5, 5, 3);
  }
}

// ---------- jersey designs (patterns in art.js)
function drawJersey(C, x0, y0, w, h) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { ctx.fillStyle = jerseyColor(C, i, j, w, h); ctx.fillRect(x0 + i, y0 + j, 1, 1); }
}

function drawLogo(c, T, x, y, r, alpha = 1) { drawEmblemBadge(c, T, x, y, r, alpha); }
// small logo pixel-crest for the front of the jersey (uses the logo's trim colour)
// ---------- sprites (sprite pixels, origin at the feet)
// tripped: he staggers for a few frames, goes down, slides, then climbs back to his feet
// goalie mask designs (5 x 5 at ox, oy)
function drawPuck() {
  if (puck.owner && puck.owner.g) return;
  toWorld();
  // (Nov 23 visuals) a loose puck gets a faint ring on the ice so the eye finds it among the skaters (the carried puck
  // already has the carrier ring); it goes with the CARRIER RING presentation option
  if (!puck.owner && S.pres && S.pres.carrier !== false && (S.phase === 'live' || S.phase === 'penalty') && S.screen !== 'replay' && !puck.inNet) {
    const sp = hyp(puck.vx, puck.vy), a = clamp(0.5 - sp * 0.08, 0.12, 0.45) * (0.8 + 0.2 * Math.sin(S.t * 0.2));
    ctx.strokeStyle = 'rgba(40,90,170,' + a.toFixed(3) + ')'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(puck.x, puck.y + 0.5, 5, 3.4, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  for (const t of puck.trail) ctx.fillRect(t.x - 1.5, t.y - 0.5, 3, 1);
  let z = 0;
  const sh = puck.shot;
  if (!puck.owner && sh && !sh.done) z = sh.h * 9 * Math.sqrt(clamp(1 - Math.abs(sh.gy - puck.y) / sh.d0, 0, 1));
  if (puck.h > 0) z = puck.h; else if (puck.air) z = 11;
  if (S.screen === 'replay') z = puck.rz || 0;
  else if (S.phase === 'faceoff' && S.fo && !S.so && S.fo.kick == null) {   // in the referee's hand, then dropped (a drop ball)
    const kd = S.fo.kind || FO_DROPS[0];
    if (!S.fo.dropped && S.timer <= FO.cueT) z = kd.h + (S.fo.beat || 0) * 2.5;
    else if (S.fo.dropped) z = Math.max(0, kd.h - S.fo.wait * kd.g);
  }
  // carried: it sits on the tape of the carrier's blade, exactly where the sprite draws it
  const o = puck.owner, bl = o && !o.g && S.screen !== 'replay' && o._blade && S.t - o._blade.t <= 2 ? o._blade : null;
  if (bl) z = 0;
  toSprite(bl ? o.x + bl.dx : puck.x, bl ? o.y + bl.dy + 0.6 : puck.y);
  // SOCCER: a white ball with black patches that roll as it moves; its shadow stays on the grass when it's in the air
  ctx.fillStyle = 'rgba(10,40,10,.35)'; px(-1, 1, 3, 1);
  const zz = Math.round(z / SS), rr = ((puck.roll = (puck.roll || 0) + hyp(puck.vx, puck.vy) * 0.35) | 0) % 4;
  if (zz > 5) { ctx.fillStyle = 'rgba(10,40,10,.22)'; px(-2, 0, 5, 2); }                       // (high up: a bigger, softer shadow, and the ball looks closer)
  ctx.fillStyle = '#ffffff'; px(-1, -2 - zz, 3, 3); px(-2, -1 - zz, 1, 1); px(2, -1 - zz, 1, 1);
  if (zz > 10) { px(-2, -2 - zz, 1, 1); px(2, -2 - zz, 1, 1); px(-1, -3 - zz, 3, 1); }
  ctx.fillStyle = '#1b1d24'; px([-1, 0, 1, 0][rr], [-2, -1, -1, 0][rr] - zz, 1, 1);
  ctx.fillStyle = 'rgba(0,0,0,.22)'; px(-1, -zz, 3, 1);
}
function drawMarker(p) {
  toWorld();
  const [no] = nearestOpp(p);
  let tv = hyp(p.vx, p.vy);
  if (no) { const d = dist(p, no) || 1; tv = (p.vx * (no.x - p.x) + p.vy * (no.y - p.y)) / d; }
  const hot = !hasPuck(p) && tv >= 0.7 * 2.05;   // closing fast enough for a big hit
  ctx.strokeStyle = hot ? '#ff6a4a' : '#ffd23f'; ctx.lineWidth = hot ? 1.4 : 1;
  ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 8.5, 3.8, 0, 0, Math.PI * 2); ctx.stroke();
  // stamina: a bar under the ring, green -> yellow -> orange -> red as he tires
  const ba = S.screen === 'play' || S.screen === 'paused' ? p.barA ?? 1 : 1;   // (Nov 23) fades in a net-front pile too; the ring and arrow stay
  if (p.pl && MS && ba >= 0.04) {
    ctx.globalAlpha = ba;
    const st = stamOf(p), k = clamp(st / 100, 0, 1), bx = p.x - 9, by = p.y + 6.2;
    ctx.fillStyle = 'rgba(8,10,24,.85)'; ctx.fillRect(bx - 0.6, by - 0.6, 19.2, 3.2);
    ctx.fillStyle = '#2a3150'; ctx.fillRect(bx, by, 18, 2);
    const cb = S.pres && S.pres.cb;   // colour-blind palette: blue -> sky -> yellow -> magenta (no red/green pairs)
    ctx.fillStyle = cb ? (st > 70 ? '#3b8bff' : st > 45 ? '#7fd3ff' : st > 25 ? '#ffd23f' : ((S.t >> 3) & 1 ? '#e040c8' : '#8a1f7a')) : st > 70 ? '#5ee07a' : st > 45 ? '#ffd23f' : st > 25 ? '#ff9a3a' : ((S.t >> 3) & 1 ? '#ff4a3d' : '#b02a22');
    ctx.fillRect(bx, by, Math.max(0.6, 18 * k), 2);
    { const cap = stamCapOf(p.pl.id); if (cap < 100) { ctx.fillStyle = '#6a1a22'; ctx.fillRect(bx + 18 * cap / 100, by, 18 * (1 - cap / 100), 2); } }
    sprintBox(bx + 19.4, by - 0.6, 3.2, S.sprintOn && !S.autoAI || !!p.sprint);   // green = sprint on, red = off
    drawThreat(p, bx, by, 18, 3.1);
    ctx.globalAlpha = 1;
  }
  toSprite(p.x, p.y);
  const bob = (S.t >> 4) & 1;
  const top = (p.charge >= 0 ? -29 : -24) + bob;
  ctx.fillStyle = '#ffd23f'; px(-2, top, 5, 1); px(-1, top + 1, 3, 1); px(0, top + 2, 1, 1);
}
function drawMeter(p) {
  if (p.passAt != null && hasPuck(p)) {          // pass power
    const k = clamp((performance.now() - p.passAt - PLAY.passTapMs) / (PLAY.passFullMs - PLAY.passTapMs), 0, 1);
    toSprite(p.x, p.y);
    ctx.fillStyle = '#0d1020'; px(-9, -25, 18, 4);
    ctx.fillStyle = '#26314f'; px(-8, -24, 16, 2);
    ctx.fillStyle = k >= 1 ? '#ffffff' : '#7ec8ff'; px(-8, -24, Math.round(k * 16), 2);
    return;
  }
  if (p.charge < 0) return;
  toSprite(p.x, p.y);
  const x = -8, y = -24;
  ctx.fillStyle = '#0d1020'; px(x - 1, y - 1, 18, 5);
  ctx.fillStyle = '#3a3f62'; px(x, y, 16, 3);
  ctx.fillStyle = p.charge < 0.45 ? '#5ee07a' : p.charge < 0.85 ? '#ffd23f' : ((S.t >> 2) & 1 ? '#ff4a3d' : '#ffffff');
  px(x, y, Math.round(p.charge * 16), 3);
}
// your goalie with the puck: pass direction, pass power, and the possession clock
// the pass you are lining up while skating a different way
function drawPassAim(p) {
  if (!p.passAim || p.passAt == null || !hasPuck(p)) return;
  const a = p.passAim, held = performance.now() - p.passAt;
  const pow = clamp((held - PLAY.passTapMs) / (PLAY.passFullMs - PLAY.passTapMs), 0, 1);
  const tgt = bestPassTarget(p, a.x, a.y, true);
  toWorld();
  for (const pass2 of [0, 1]) {
    ctx.fillStyle = pass2 ? (pow > 0.85 ? '#ffd23f' : '#7ec8ff') : 'rgba(10,14,34,.8)';
    const sz = pass2 ? 2 : 3.4;
    for (let s2 = 10; s2 < 22 + pow * 42; s2 += 6) ctx.fillRect(p.x + a.x * s2 - sz / 2, p.y - 4 + a.y * s2 - sz / 2, sz, sz);
  }
  if (tgt) { const k = (S.t >> 2) & 1; ctx.strokeStyle = k ? '#ffd23f' : '#7ec8ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(tgt.x, tgt.y + 1, 9.5, 4.5, 0, 0, Math.PI * 2); ctx.stroke(); }
}
function drawGoalieAim(g) {
  if (!hasPuck(g) || g.covering) return;
  const a = g.gAim || { x: 0, y: -1 }, charging = g.gCharge != null;
  const len = 26 + (charging ? g.gCharge * 70 : 0);
  toWorld();
  ctx.globalAlpha = charging ? 1 : 0.7;
  for (const pass of [0, 1]) {
    ctx.fillStyle = pass ? (charging ? '#ffd23f' : '#ffffff') : 'rgba(15,20,45,.85)';
    const sz = pass ? 2 : 3.5;
    for (let s2 = 10; s2 < len; s2 += 7) ctx.fillRect(g.x + a.x * s2 - sz / 2, g.y - 6 + a.y * s2 - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;
  toSprite(g.x, g.y);
  if (charging) {
    ctx.fillStyle = '#0d1020'; px(-9, -29, 18, 5); ctx.fillStyle = '#3a3f62'; px(-8, -28, 16, 3);
    ctx.fillStyle = g.gCharge < 0.5 ? '#5ee07a' : '#ffd23f'; px(-8, -28, Math.round(g.gCharge * 16), 3);
  }
  const left = 1 - (g.gpT || 0) / GOALIE_HOLD_FRAMES;
  if ((g.gpT || 0) > 40) {
    ctx.fillStyle = '#0d1020'; px(-9, 3, 18, 3);
    ctx.fillStyle = left < 0.4 ? ((S.t >> 2) & 1 ? '#ff4a3d' : '#ffd23f') : '#9fd0ff'; px(-8, 4, Math.max(0, Math.round(left * 16)), 1);
  }
}
function drawAim(p) {
  const a = p.aim;
  if (!a) return;
  toWorld();
  const charging = p.charge >= 0;
  if (!hasPuck(p) && !charging) return;
  const ox = hasPuck(p) ? puck.x : p.x, oy = hasPuck(p) ? puck.y : p.y;   // one-timer wind-up aims from the body
  const dx = a.x - ox, dy = a.y - oy, d = hyp(dx, dy) || 1, ux = dx / d, uy = dy / d;
  if (!charging && (!a.on || d > 220)) return;
  const len = charging ? d : Math.min(d, 36);
  const col = a.on ? '#ffd23f' : '#ffffff';
  ctx.globalAlpha = charging ? 1 : 0.65;
  const off = (S.t * 0.5) % 7;
  const head = () => { const hx = ox + ux * len, hy = oy + uy * len, nx = -uy, ny = ux;
    ctx.beginPath(); ctx.moveTo(hx + ux * 1.5, hy + uy * 1.5); ctx.lineTo(hx - ux * 7 + nx * 4.5, hy - uy * 7 + ny * 4.5); ctx.lineTo(hx - ux * 7 - nx * 4.5, hy - uy * 7 - ny * 4.5); ctx.closePath(); };
  // dark outline pass, then colour pass
  for (const pass of [0, 1]) {
    ctx.fillStyle = pass ? col : 'rgba(15,20,45,.85)';
    const sz = pass ? 2 : 3.5;
    for (let s = 7 + off; s < len - 7; s += 7) ctx.fillRect(ox + ux * s - sz / 2, oy + uy * s - sz / 2, sz, sz);
    head();
    if (pass) ctx.fill(); else { ctx.strokeStyle = 'rgba(15,20,45,.85)'; ctx.lineWidth = 2; ctx.stroke(); }
  }
  if (charging && a.on) {   // the seven targets in the net; the chosen one glows
    const g = gk(1);
    for (const [z, sd] of [['high', -1], ['high', 1], ['mid', -1], ['mid', 1], ['low', -1], ['low', 1], ['five', 0]]) {
      const pt = zonePoint(z, sd, g), sx = pt.x, sy = oppGoalY(0) - 1 - pt.h * 10;
      const sel = a.zone === z && (z === 'five' || a.side === sd);
      const r = sel ? 2.4 + ((S.t >> 3) & 1) * 0.5 : 1.3;
      ctx.fillStyle = sel ? '#ffd23f' : 'rgba(255,255,255,.6)'; ctx.strokeStyle = 'rgba(15,20,45,.9)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.rect(sx - r, sy - r, r * 2, r * 2); ctx.fill(); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}
function textW(str, size = 8) { const f = ctx.font; ctx.font = (size * CTS).toFixed(1) + "px 'PH Pixel', monospace"; const w = ctx.measureText(String(str)).width; ctx.font = f; return w; }   // (from Pixel Hockey, Nov 24)
function text(str, x, y, color = '#fff', size = 8, align = 'center', shadow = '#000') {
  ctx.font = (size * CTS).toFixed(1) + "px 'PH Pixel', monospace"; ctx.textAlign = align; ctx.textBaseline = 'top';
  if (shadow) { ctx.fillStyle = shadow; ctx.fillText(str, x + 1, y + 1); }
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}
function fmtClock(s) { s = Math.ceil(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function drawHUD() {
  toScreen();
  const SW = viewW(), SC = SW / 2;
  ctx.fillStyle = '#0b0e1e'; ctx.fillRect(0, 0, SW, HUDH);
  ctx.fillStyle = '#20264a'; ctx.fillRect(0, HUDH - 1, SW, 1);
  for (const t of [0, 1]) {
    const T = TEAM[t], x = t ? SW - 86 : 6;
    ctx.fillStyle = T.main; ctx.fillRect(x, 4, 80, 17);
    ctx.fillStyle = T.trim; ctx.fillRect(x, 19, 80, 2);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(t ? x : x + 56, 4, 24, 15);
    const tc = T.main === '#f2a51a' ? '#1b2a5c' : '#ffffff';
    if (t) { drawLogo(ctx, T, x + 70, 12.5, 7); text(T.abbr, x + 28, 8, tc, 8, 'left'); text(String(S.score[1]), x + 12, 8, '#ffd23f', 8, 'center'); }
    else { drawLogo(ctx, T, x + 10, 12.5, 7); text(T.abbr, x + 20, 8, tc, 8, 'left'); text(String(S.score[0]), x + 68, 8, '#ffd23f', 8, 'center'); }
  }
  if (MS) for (const t of [0, 1]) {         // current line: three small pips under each team panel
    const x = t ? SW - 86 : 6;
    for (let i = 0; i < 3; i++) { ctx.fillStyle = MS.lines[t].idx === i ? '#ffd23f' : 'rgba(255,255,255,.22)'; ctx.fillRect(x + 28 + i * 9, 22.5, 7, 1.6); }
  }
  if (MS && S.screen === 'play' && !S.so) for (const t of [0, 1]) {     // every skater's stamina on both teams (yours highlighted)
    const sk = teamSkaters(t).slice().sort((a, b) => a.role - b.role), x0 = t ? SW - 86 - sk.length * 11 - 4 : 92;
    sk.forEach((p, i) => {
      const st = stamOf(p), x = x0 + i * 11, me = p === ctrl && t === 0;
      ctx.fillStyle = me ? '#ffd23f' : 'rgba(0,0,0,.6)'; ctx.fillRect(x - 1, 4, 10, me ? 7 : 6);
      ctx.fillStyle = '#20263f'; ctx.fillRect(x, 5, 8, me ? 5 : 4);
      ctx.fillStyle = st < 35 ? '#ff6a4a' : st < 65 ? '#ffd23f' : '#5ee07a'; ctx.fillRect(x, 5, Math.max(1, Math.round(st / 100 * 8)), me ? 5 : 4);
      if (me) text(String(p.num), x + 4, 13, '#ffd23f', 5, 'center', null);
    });
    const g = goalies[t];
    if (g && g.pl) { const st = gStam(g), x = x0 + sk.length * 11 + 2; ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - 1, 4, 6, 6); ctx.fillStyle = st < 50 ? '#ff6a4a' : '#7ec8ff'; ctx.fillRect(x, 5 + Math.round((1 - st / 100) * 4), 4, Math.max(1, Math.round(st / 100 * 4))); }
  }
  const per = (typeof modeHudPeriod === 'function' && !S.so && modeHudPeriod()) || (S.so ? 'SO' : S.period >= 5 ? 'ET' + (S.period - 3) : S.period >= 4 ? 'ET' : ['1ST', '1ST', '2ND'][S.period - 1]);
  text(S.phase === 'penalty' ? 'PEN' : per, SC, S.phase === 'penalty' ? 4 : 3, S.phase === 'penalty' ? '#ffd23f' : '#9aa3c7', S.phase === 'penalty' ? 6 : 8);   // (fits beside the flags)
  const addOn = typeof addedLive === 'function' && addedLive();
  text(addOn ? clockText() : fmtClock(S.clock), SC, 14, addOn ? '#5ee07a' : S.clock < 10 && S.phase === 'live' ? '#ff4a3d' : '#ffffff', 8);
  if (typeof drawRulesHud === 'function' && !(S.mode && (S.mode.kind === 'drill' || S.mode.kind === 'practice'))) drawRulesHud();
  if (typeof drawModeHud === 'function') drawModeHud();
}
// faceoff prompt for the human: wait for the drop, then the timing verdict
function foTipsLeft() { try { return 4 - (+(localStorage.getItem('psph-fotips') || 0)); } catch (e) { return 0; } }
function foTipUsed() { try { localStorage.setItem('psph-fotips', String(5 - foTipsLeft())); } catch (e) {} }
function drawFaceoffCue() {
  if (S.screen !== 'play' || S.autoAI || !S.fo || S.so || S.fo.kick != null) return;
  const fb = S.fo.fb;
  if (S.phase !== 'faceoff' && !(fb && fb.life > 0)) return;
  if (S.phase !== 'faceoff' && S.phase !== 'live') { if (fb) fb.life = 0; return; }   // (Nov 23) a goal card or whistle takes over the bottom
  if (S.spot && S.spot.active) return;
  toScreen();
  const SW = viewW(), vh = viewH();
  // (Nov 22) everything sits above the commentary box when it is up (they used to print on top of each other)
  const bottom = Math.min(HUDH + vh - 47, S.botY || 1e9);
  const panel = (lines, col, meter) => {
    const w = Math.max(150, ...lines.map(l => l.length * 8 * CTS + 16)), h = 15 + (meter ? 16 : 0) + (lines.length - 1) * 11, x = SW / 2 - w / 2, y = bottom - h;
    ctx.fillStyle = S.phase === 'faceoff' ? 'rgba(11,14,30,.88)' : 'rgba(11,14,30,.72)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = col; ctx.fillRect(x, y, w, 2);
    text(lines[0], SW / 2, y + 5, col, 8, 'center', null);
    for (let i = 1; i < lines.length; i++) text(lines[i], SW / 2, y + 5 + i * 11, '#c9ced8', 6, 'center', null);
    if (meter) foMeter(SW / 2, y + 15 + (lines.length - 1) * 11 + 1, Math.min(w - 60, 140), meter);
    return y;
  };
  let top;
  if (S.phase === 'faceoff') {
    if (!S.fo.takers || S.fo.takers[0] !== ctrl) return;
    const early = S.fo.humanAt != null && (!S.fo.dropped || (S.fo.iceAt == null && S.fo.humanAt < S.fo.dropAt));
    if (early) top = panel(['TOO EARLY!', 'YOU MOVED BEFORE THE BALL LANDED'], '#ff7a6e');        // every level: it can't be taken back, so say so now
    else if (S.diff === 'EASY') {                                                          // the timing helper (Easy only)
      const ready = S.timer <= FO.cueT || S.fo.dropped, bt = S.fo.beat || 0, k = Input.first('shoot');
      const msg = S.fo.dropped ? (S.fo.iceAt != null ? 'NOW!' : 'DROP...') : !ready ? 'TAP ' + k + ' AS IT LANDS' : bt === 0 ? 'READY...' : bt === 1 ? '1 ...' : '1 · 2 ...';
      const sub = !ready ? (attackDir(0) < 0 ? '↓' : '↑') + ' HELD AS YOU TAP DRAWS IT BACK' : 'PIP · PIP · DROP · TAP AS IT LANDS';
      top = panel([msg, sub], S.fo.dropped ? '#5ee07a' : ready ? '#ffd23f' : '#9aa3c7');
    } else return;
  } else {
    fb.life--;
    ctx.globalAlpha = Math.min(1, fb.life / 15);
    const head = (fb.won ? 'KICKOFF WON' : 'KICKOFF LOST') + (fb.how ? ' · ' + fb.how : '');
    top = panel([head, 'YOU ' + fb.you + (fb.e != null ? ' ' + (fb.e >= 0 ? '+' : '') + Math.round(fb.e) + 'MS' : '') + '   ·   THEM ' + fb.them], fb.won ? '#5ee07a' : '#ff7a6e', fb);
  }
  if (S.phase === 'faceoff' && S.diff === 'EASY' && foTipsLeft() > 0) {      // the first few faceoffs you take (Easy): how they work
    const tips = ['TIP: TAP ' + Input.first('shoot') + ' THE MOMENT THE BALL HITS THE PITCH', 'HOLD ' + (attackDir(0) < 0 ? '↓' : '↑') + ' AS YOU TAP TO DRAW IT BACK TO A TEAMMATE'];
    tips.forEach((tp, i) => { const w2 = tp.length * 6 * CTS + 12; ctx.fillStyle = 'rgba(11,14,30,.85)'; ctx.fillRect(SW / 2 - w2 / 2, top - 27 + i * 12, w2, 12); text(tp, SW / 2, top - 24 + i * 12, '#7ec8ff', 6, 'center', null); });
  }
  ctx.globalAlpha = 1;
}
// (Nov 22) the timing strip under the faceoff result: the puck landing in the middle, early to the left, late to the right,
// the grade bands, your tap (white) and their centre's (red)
const FO_BAND_COL = ['#5ee07a', '#a6e05e', '#ffd23f', '#ff9a4a'];
function foMeter(cx, y, w, fb) {
  const span = FO.gradeMs[3] + 80, sx = e => cx + clamp(e / span, -1, 1) * w / 2;
  ctx.fillStyle = '#5a2030'; ctx.fillRect(cx - w / 2, y + 4, w, 5);                       // EARLY / LATE beyond the bands
  for (let g = 3; g >= 0; g--) { const r = FO.gradeMs[g]; ctx.fillStyle = FO_BAND_COL[g]; ctx.fillRect(sx(-r), y + 4, sx(r) - sx(-r), 5); }
  ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 0.5, y + 2, 1, 9);                           // the puck lands
  text('EARLY', cx - w / 2 - 3, y + 4, '#80869c', 4, 'right', null); text('LATE', cx + w / 2 + 3, y + 4, '#80869c', 4, 'left', null);   // (Nov 23) beside the strip, not under it: a shorter panel
  const mark = (e, col, below) => {
    const x = Math.round(sx(e));
    ctx.fillStyle = col;
    if (below) { ctx.fillRect(x - 1, y + 10, 3, 1); ctx.fillRect(x, y + 9, 1, 1); ctx.fillRect(x - 0.5, y + 4, 1, 5); }
    else { ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x - 1, y + 1, 3, 1); ctx.fillRect(x, y + 2, 1, 2); ctx.fillRect(x - 0.5, y + 4, 1, 5); }
  };
  if (fb.ce != null && Math.abs(fb.ce) < 5000) mark(fb.ce, '#ff5a4e', true);
  if (fb.e != null) mark(fb.e, '#ffffff', false);
  else text('NO PRESS', cx + w / 2 - 2, y - 1, '#ff7a6e', 5, 'right', null);
}
function drawBanner() {
  const b = S.banner; if (!b) return;
  if (typeof jbVisible === 'function' && jbVisible() && S.screen === 'play') return;   // (Nov 23) the replay screen is down over it: its edges stuck out either side
  toScreen();
  const vh = viewH(), y = HUDH + vh * 0.38;
  const a = Math.min(1, b.life / 15);
  ctx.globalAlpha = a;
  const SW = viewW(), SC = SW / 2;
  ctx.fillStyle = 'rgba(11,14,30,.85)'; ctx.fillRect(20, y - 6, SW - 40, b.sub ? 42 : 30);
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(20, y - 6, SW - 40, 2);
  // little ref icon
  ctx.save(); ctx.setTransform(K * SS, 0, 0, K * SS, 36 * K, Math.round((y + 22) * K));
  for (let i = 0; i < 8; i++) { ctx.fillStyle = (i >> 1) % 2 ? '#141414' : '#f4f4f4'; px(-4 + i, -12, 1, 6); }
  ctx.fillStyle = '#f4f4f4'; px(4, -18, 1, 6); ctx.fillStyle = '#111'; px(-2, -16, 4, 2); ctx.fillStyle = '#f0c49b'; px(-2, -14, 4, 2);
  ctx.restore(); toScreen();
  text(b.text, SC + 8, y + 2, '#ffffff', 16, 'center', '#5a2a00');
  if (b.sub) text(b.sub, SC + 8, y + 22, '#ffd23f', 8, 'center', null);
  if (S.phase === 'whistle' && !S.autoAI && foHurryOK()) text(Input.first('check') + ' ▶ SKIP', SW - 26, y + (b.sub ? 28 : 16), '#80869c', 5, 'right', null);
  ctx.globalAlpha = 1;
}
// the little sprint light beside a stamina bar: green while he is sprinting (or your sprint is switched on), red when not
// ---------- THREAT MARKERS (Nov 21): under a skater's stamina bar, a strip coloured by how good he is (never the number),
// a badge for what kind of player he is, and a gold ring round the very best. Off / opponents only / everyone (Settings).
// On Hard the colour stays hidden until you have played that club this season (the badges always show).
const THR_CUT = [0, 55, 64, 71, 79];                                   // tier starts on the 0-100 overall
const THR_COL = ['#80869c', '#5ec46a', '#3f8fe0', '#a06cf2', '#ffc63a'];
const THR_COL_CB = ['#80869c', '#7fd3ff', '#3b6bff', '#e040c8', '#ffd23f'];
const THR_NAMES = ['DEPTH', 'SOLID', 'GOOD', 'STRONG', 'ELITE'];
const THR_GLYPH = {
  shield: ['#####', '#####', '#####', '.###.', '..#..'], sniper: ['..#..', '.#.#.', '##.##', '.#.#.', '..#..'],
  playmaker: ['..#..', '...#.', '#####', '...#.', '..#..'], speedster: ['...##', '..##.', '.###.', '.##..', '##...'],
  enforcer: ['###..', '#####', '#####', '.####', '.###.'], star: ['..#..', '#####', '.###.', '.#.#.', '#...#'],
};
const thrTier = o => { let k = 0; for (let i = 0; i < THR_CUT.length; i++) if (o >= THR_CUT[i]) k = i; return k; };
function thrRole(pl) {
  if (pl.arch === 'defensive' || (pl.arch === 'balanced' && (pl.spos === 'LD' || pl.spos === 'RD'))) return 'shield';
  return THR_GLYPH[pl.arch] ? pl.arch : null;
}
function threatInfo(p) {
  const m = S.match; if (!m || !p.pl) return null;
  const c = m.thr || (m.thr = {});
  if (c[p.pl.id]) return c[p.pl.id];
  if (!m.thrStar) m.thrStar = [0, 1].map(t => {                    // a club's stars: its two best dressed skaters, if they are good enough
    const lu = m.lineups && m.lineups[t], sk = lu ? [].concat(lu.lines ? lu.lines.flat() : [], lu.bench || []).filter(x => x && x.pos !== 'G') : [];
    return sk.map(x => [x.id, ovrInt(x)]).sort((a, b) => b[1] - a[1]).slice(0, 2).filter(x => x[1] >= 72).map(x => x[0]);
  });
  const o = ovrInt(p.pl), star = m.thrStar[p.team].includes(p.pl.id);
  return c[p.pl.id] = { tier: thrTier(o), role: star ? 'star' : thrRole(p.pl), ring: o >= THR_CUT[4] || p.pl.tier === 'gen' };
}
// bw: the stamina bar's width; sbot: how far below `by` the bar / sprint box reach. Everything sits underneath.
function drawThreat(p, bx, by, bw = 12, sbot = 2.5) {
  const mode = (S.pres && S.pres.threat) || 'ALL', m = S.match;
  if (mode === 'OFF' || !m || (mode === 'OPP' && (m.userTeams || []).includes(p.team))) return;
  const th = threatInfo(p); if (!th) return;
  const k = bw / 12, hide = m.thrHide && m.thrHide[p.team], cb = S.pres && S.pres.cb;
  const y = by + sbot + 0.6, w = bw - 0.5, sh = 1.7 * k, u = 0.95 * k, gx = bx + bw + 0.4, gy = by + sbot + 0.4;
  ctx.fillStyle = 'rgba(8,10,24,.78)'; ctx.fillRect(bx - 0.5, y - 0.5, w + 1, sh + 1);
  ctx.fillStyle = hide ? '#3a4060' : (cb ? THR_COL_CB : THR_COL)[th.tier]; ctx.fillRect(bx, y, w, sh);
  if (cb && !hide) { ctx.fillStyle = 'rgba(8,10,24,.9)'; const n = th.tier + 1; for (let i = 1; i < n; i++) ctx.fillRect(bx + w * i / n - 0.3, y, 0.6, sh); }   // 1-5 segments: the tier without colour
  if (th.ring && !hide) { ctx.strokeStyle = (S.t >> 4) & 1 ? '#ffd23f' : '#c8961e'; ctx.lineWidth = 0.5 * k; ctx.strokeRect(bx - 1.3, by - 1.3, bw + 5 * u + 2.6, sbot + 5 * u + 2.4); }
  if (!th.role) return;
  const ps = MS && MS.p[p.pl.id], hot = ps && ps.g + ps.a >= 2, fl = hot && ((S.t >> 3) & 1);   // two points tonight: the badge pulses
  const G = THR_GLYPH[th.role];
  ctx.fillStyle = fl ? '#a8401a' : 'rgba(8,10,24,.88)'; ctx.fillRect(gx - 0.45, gy - 0.45, 5 * u + 0.9, 5 * u + 0.9);
  ctx.fillStyle = th.role === 'star' ? '#ffd23f' : hot ? '#ffb36a' : '#dfe6ff';
  for (let r = 0; r < 5; r++) for (let q = 0; q < 5; q++) if (G[r][q] === '#') ctx.fillRect(gx + q * u, gy + r * u, u, u);
}
function sprintBox(x, y, sz, on) {
  const cb = S.pres && S.pres.cb;
  ctx.fillStyle = 'rgba(8,10,24,.85)'; ctx.fillRect(x - 0.4, y - 0.4, sz + 0.8, sz + 0.8);
  ctx.fillStyle = on ? (cb ? '#3b8bff' : '#5ee07a') : (cb ? '#e040c8' : '#ff4a3d'); ctx.fillRect(x, y, sz, sz);
}
function render() {
  if (!rinkImg) buildRink();
  if (!marksCvs) clearMarks();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = S.match && S.match.arena && typeof venueOf === 'function' ? venueOf(S.match.arena).bg : '#0b0d1a'; ctx.fillRect(0, 0, cvs.width, cvs.height);
  toWorld();
  ctx.drawImage(rinkImg, 0, 0, W, H);
  let cf = ((S.t / 50) | 0) % 2;
  if (S.cheer > 0) cf = (S.cheerKind === 'away' ? 4 : S.cheerKind === 'all' ? 6 : 2) + ((S.cheer >> 3) & 1);
  if (S.pres && S.pres.crowdLite) cf &= 1;                    // light crowd: two frames only (slower devices)
  if (S.outro && S.outro.leave > 0) cf = 0;                      // the fans are leaving: the remaining ones sit still
  const ci = crowdImgs[cf] || (crowdImgs[cf] = crowdMake ? crowdMake(cf) : crowdImgs[0]);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(ci, 0, 0, ci.width * SS / CROWD_FINE, ci.height * SS / CROWD_FINE);
  S.crowdF = cf; if (typeof stadDrawWorld === 'function') stadDrawWorld(cf);
  if (typeof crowdFxWorld === 'function') crowdFxWorld();
  ctx.drawImage(marksCvs, 0, 0, W, H);
  drawBoardsLive();
  const inter = S.screen === 'intermission' && !!S.inter;
  if (inter && wetCvs) ctx.drawImage(wetCvs, 0, 0, W, H);
  if (inter) drawGateOpen();
  drawLamps();
  drawBenches();
  if (typeof drawCrowdBubbles === 'function') drawCrowdBubbles();
  worldItems(null);
  if (typeof drawBlimp === 'function') drawBlimp();                    // above everything on the ice and in the stands
  worldBars(null);
  if (S.cam !== 'FULL' && S.screen !== 'menu') {      // arrows for skaters off the top/bottom of the view
    for (const p of skaters) {
      const top = p.y < camY + 4, bot = p.y > camY + viewH() - 2;
      if (!top && !bot) continue;
      toWorld();
      const yy = top ? camY + 4 : camY + viewH() - 4, d = top ? -1 : 1;
      ctx.fillStyle = 'rgba(10,12,30,.8)';
      ctx.beginPath(); ctx.moveTo(p.x, yy + d * 4.5); ctx.lineTo(p.x - 5, yy - d * 2.5); ctx.lineTo(p.x + 5, yy - d * 2.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = TEAM[p.team].main;
      ctx.beginPath(); ctx.moveTo(p.x, yy + d * 3); ctx.lineTo(p.x - 3.5, yy - d * 1.8); ctx.lineTo(p.x + 3.5, yy - d * 1.8); ctx.closePath(); ctx.fill();
    }
  }
  if (typeof arenaLightsWorld === 'function') arenaLightsWorld();
  if (typeof crowdPhonesWorld === 'function') crowdPhonesWorld();
  worldFx(null);
  if (S.hitFlash > 0) { S.hitFlash--; ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(camX, camY, viewW(), viewH()); }
  if (S.goalFlash > 0 && (S.goalFlash >> 2) & 1) { ctx.fillStyle = 'rgba(255,210,63,.10)'; ctx.fillRect(R.l, R.t, R.r - R.l, R.b - R.t); }
  // vignette
  toScreen();
  if (!vignette) {
    const vh = viewH(), vw = viewW();
    vignette = mkCanvas(vw * K, (HUDH + vh) * K);
    const vc = vignette.getContext('2d'); vc.setTransform(K, 0, 0, K, 0, 0);
    const g = vc.createRadialGradient(vw / 2, HUDH + vh / 2, Math.min(vw, vh) * 0.45, vw / 2, HUDH + vh / 2, Math.max(vw, vh) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,10,.38)');
    vc.fillStyle = g; vc.fillRect(0, HUDH, vw, vh);
  }
  if (typeof drawVenueWorld === 'function') drawVenueWorld();
  ctx.setTransform(1, 0, 0, 1, 0, 0); if (!document.body.classList.contains('stad')) ctx.drawImage(vignette, 0, 0); toScreen();   // with the stadium beside the rink, one vignette covers the whole screen (CSS)
  if (S.demo) { updateLinePick(); return; }                   // main menu live game: no HUD, labels or prompts
  // (Nov 22 text pass) the bottom of the view is a stack: coach tip / last-goal strip at the very bottom, then the
  // commentary, the power-play pill, the injury note and the faceoff panel, each placed above the one below it
  S.botY = HUDH + viewH() - (typeof C2 !== 'undefined' && C2.cur && typeof coachLive === 'function' && coachLive() ? 34 : S.lastGoalHud && S.phase !== 'goal' ? 21 : 10);
  drawBanner();
  if (S.screen === 'play' || S.screen === 'paused') { tickTags(); worldTags(null); }
  if (!(S.goalCard && S.phase === 'goal')) drawComm();
  if (S.screen === 'play' || S.screen === 'paused') { drawCarrierHud(); drawLastGoalHud(); drawGoalCard(); drawHatCard(); drawSpotlight(); }
  updateLinePick();
  if (inter) drawIntermissionBar();
  if (S.screen === 'replay') drawReplayCard();
  if (MS && MS.note && MS.note.life > 0 && S.screen === 'play') {
    toScreen();
    ctx.globalAlpha = Math.min(1, MS.note.life / 20);
    const SW = viewW(), w = MS.note.text.length * 8 * CTS + 14, x = MS.note.t === 0 ? 8 : SW - w - 8, y = HUDH + 6;
    ctx.fillStyle = 'rgba(11,14,30,.85)'; ctx.fillRect(x, y, w, 14);
    ctx.fillStyle = TEAM[MS.note.t].main; ctx.fillRect(x, y, 3, 14);
    text(MS.note.text, x + 8, y + 3, '#ffffff', 8, 'left', null);
    ctx.globalAlpha = 1;
  }
  drawHUD();
  if (typeof drawRulesOverlay === 'function') drawRulesOverlay();
  if (typeof drawPresentationOverlay === 'function') drawPresentationOverlay();
  drawFaceoffCue();
}

// ====================================================================
//  ENGINE GLUE (menus live in ui.js)
// ====================================================================
const $ = id => document.getElementById(id);
function hideOverlays() { for (const o of ['ovPause', 'ovMsg', 'ovFocus']) $(o).classList.remove('show'); }
function showOverlay(id) { hideOverlays(); $(id).classList.add('show'); }
function showMsg(kind) {
  const ords = ['1ST', '1ST', '2ND'];
  $('msgS0').textContent = TEAM[0].abbr + ' ' + S.score[0]; $('msgS1').textContent = S.score[1] + ' ' + TEAM[1].abbr;
  $('msgS0').style.color = textCol(TEAM[0]); $('msgS1').style.color = textCol(TEAM[1]);
  $('msgSub').textContent = 'Shots on goal ' + S.sog[0] + ' - ' + S.sog[1];
  S.screen = 'intermission';
  if (kind === 'freshlegs') {
    $('msgTitle').textContent = 'NO GOAL YET';
    $('msgSub').textContent = 'Everyone is fully rested. The first goal still wins.';
    $('btnMsg').textContent = 'NEXT HALF';
  } else if (kind === 'overtime') {
    $('msgTitle').textContent = S.period === 3 ? 'TIED! EXTRA TIME' : 'STILL TIED!';
    $('msgSub').textContent = S.match && S.match.decider === 'sudden' ? 'Sudden death - next goal wins' : 'Sudden death extra time, then a shootout';
    $('btnMsg').textContent = 'START ET';
    if (typeof aiIntermissionTactics === 'function') for (const t of [0, 1]) aiIntermissionTactics(t);   // every computer-coached side (a human side is skipped inside)
    if (typeof scoutFade === 'function') scoutFade();
    if (typeof showTacPick === 'function') showTacPick(true);
  } else {
    $('msgTitle').textContent = S.period === 2 ? 'HALF-TIME' : 'END OF THE ' + ords[S.period - 1] + ' HALF';
    $('btnMsg').textContent = 'NEXT HALF';
  }
  showOverlay('ovMsg');
}
// Start a match. cfg: { teams:[identityYou, identityThem], home:0|1, lineups:[{lines:[[pl,pl,pl]x3], goalie:pl}, ...],
//   decider:'shootout'|'sudden', kind, title, onEnd(result), onQuit(), canRestart }
function startMatch(cfg) {
  // franchise games only (season, tournament and franchise exhibition games; never Quick Play, modes or the menu demo)
  S.gkAdj = cfg && cfg.kind !== 'quick' && !cfg.demo && !cfg.test && typeof gkLeagueAdj === 'function' && typeof UI !== 'undefined' && UI.save ? gkLeagueAdj(UI.save) : 0;
  S.match = cfg; S.icing = null; S.ask = null; S.pendingFight = null; S.injWait = null;
  if (typeof scoutReset === 'function') scoutReset();
  if (!cfg.test) S.scen = null;
  S.mode = null;
  // tactics: given by the menus (franchise), otherwise the AI picks from the rosters
  const skOf = lu => (lu && lu.lines ? lu.lines.flat() : []).filter(Boolean);
  if (typeof aiChooseTactics === 'function') {
    cfg.tac = cfg.tac || [S.autoAI ? aiChooseTactics(skOf(cfg.lineups[0])) : DEFAULT_TAC(), aiChooseTactics(skOf(cfg.lineups[1]))];
    const hadTempo = cfg.tac.map(x => !!(x && Array.isArray(x.tempo)));
    cfg.tac = cfg.tac.map(validTac);
    // EASY: no tactics to worry about. Both teams play Balanced (power play and penalty kill stay as they are)
    cfg.easyTac = S.diff === 'EASY' && !S.autoAI && !cfg.mode && !cfg.demo && !cfg.test;
    if (!SPEEDS[S.speed] || (S.diff === 'HARD' && !S.autoAI && !cfg.demo && !cfg.test)) S.speed = 'NORMAL';          // Hard is always played at Normal speed
    if (cfg.easyTac) for (const tc of cfg.tac) { tc.lines = ['balanced', 'balanced', 'balanced']; tc.tempo = ['mixed', 'mixed', 'mixed']; tc.form = {}; }
    cfg.userTeams = S.autoAI ? [] : [0];
    // a computer-coached side with no tempo of its own picks one per line from its players
    if (typeof aiLineTempo === 'function') for (const t of [0, 1]) if (!cfg.userTeams.includes(t) && !hadTempo[t] && cfg.lineups[t])
      cfg.tac[t].tempo = [0, 1, 2].map(i => aiLineTempo((cfg.lineups[t].lines[i] || []).filter(Boolean), cfg.tac[t].lines[i], { diff: 0, late: false, lost: 0, stam: 100 }));
  }
  const hm = cfg.home ?? 0;
  // each side's kit: the one chosen for this game (cfg.kits: 'home' / 'away' / 'alt0'...), else home or away
  const kitOf = t => (cfg.kits && cfg.kits[t]) || (hm !== t ? 'away' : 'home');
  TEAM[0] = teamPalette(cfg.teams[0], kitOf(0));
  TEAM[1] = teamPalette(cfg.teams[1], kitOf(1));
  if (colorDist(TEAM[0].main, TEAM[1].main) < 80) {          // jerseys too alike: the computer side switches to its most different kit
    const ai = cfg.kits && cfg.kits[0] && !cfg.kits[1] ? 1 : 1 - hm, other = TEAM[1 - ai];
    const best = kitKeys(cfg.teams[ai]).map(k => teamPalette(cfg.teams[ai], k)).sort((a, b) => colorDist(b.main, other.main) - colorDist(a.main, other.main))[0];
    if (best) TEAM[ai] = best;
  }
  if (S.pres && S.pres.cb && cvdDist(TEAM[0].main, TEAM[1].main) < 110) {   // colour-blind setting: make sure the two teams also differ in lightness
    const ai = 1 - hm, alt = teamPalette(cfg.teams[ai], !TEAM[ai].away);
    if (cvdDist(TEAM[hm].main, alt.main) > cvdDist(TEAM[hm].main, TEAM[ai].main)) TEAM[ai] = alt;
  }
  cfg.form = cfg.mode || cfg.soOnly || cfg.demo || cfg.test ? null : [rollForm(), rollForm()]; cfg.formShown = null;
  newMatchStats(); S.so = null; recReset(); S.sprintOn = false; S.bw = null; S.bwLast = null;
  if (typeof Music !== 'undefined' && !cfg.demo) Music.stop();
  initAudio();
  S.score = [0, 0]; S.sog = [0, 0];
  newGame();
  S.screen = 'play'; hideOverlays(); S.tbanner = cfg.tourney && cfg.tourney.tier ? { life: 140 } : null;
  sizeCanvas(); updateCamera(true);
  S.lastGoalHud = null; S.goalCard = null; S.hatCard = null; S.lastOwner = null; S.spot = null; S.lineHold = false;
  if (typeof HATS !== 'undefined') HATS.length = 0;
  if (cfg.spotlight && typeof startSpotlights === 'function') startSpotlights(cfg.spotlight);
  if (typeof startWalkout === 'function') startWalkout(true, !!cfg.intro);
  if (cfg.intro && typeof startIntro === 'function') startIntro(cfg.intro);
  $('wrap').classList.add('show');
  if (typeof modeStart === 'function') modeStart(cfg);
  if (!cfg.demo) cvs.focus();
}
function newGame() {
  makeTeams(); buildRink(); clearMarks(); BOARDFX.scuffs = []; BOARDFX.shake = null; BOARDFX.net = null;
  S.kickFirst = Math.random() < 0.5 ? 0 : 1; S.kickNext = null; S.kickSaid = null;
  S.score = [0, 0]; S.sog = [0, 0]; S.period = 2; setEnds();   // SOCCER: two halves, numbered 2 (1ST HALF) and 3 (2ND HALF); 4+ is extra time
  S.clock = S.periodLen; S.saidMin = false; S.comm = null;
  particles.length = 0; floaters.length = 0; S.banner = null; S.lamp = [0, 0]; S.cheer = 0;
  setupFaceoff(CX, CY);
  updateCamera(true);
  S.hintT = 0;   // the on-ice controls bar is gone (controls live in HOW TO PLAY / CONTROLS)
  S.firstMatch = false;
}
function leaveMatch() { $('wrap').classList.remove('show'); hideOverlays(); S.screen = 'menu'; if (typeof updateLinePick === 'function') updateLinePick(); }
function pauseKeysHtml() {
  const k = a => Input.label(a).split(' / ').map(x => '<kbd>' + x.replace(/[<>&]/g, '') + '</kbd>').join('/');
  return `${k('up')} ${k('left')} ${k('down')} ${k('right')} run &middot; ${k('shoot')} shoot (hold to charge; hold a direction after to bend it) &middot; ${k('loft')} loft: chip / cross / long ball<br>${k('check')} PASS / TACKLE: with the ball it passes; without it tap = poke, hold = shoulder charge<br>` +
    `${k('deke')} drag-back: switch strong foot / weak foot (hold: close control) &middot; ${k('dangle')} dangle (juke) &middot; ${k('spin')} roulette (dodge a tackle) &middot; ${k('sprint')} sprint &middot; ${k('line')} rolling sub &middot; ${k('poke')} slide tackle<br>Your keeper with the ball: ${k('pass')} tap/hold to pass &middot; ${k('cover')} kick it long`;
}
function togglePause() {
  if (S.screen === 'play') { $('pauseHint').textContent = Input.label('pause'); S.screen = 'paused'; $('btnRestart').style.display = S.match && S.match.canRestart ? '' : 'none'; if (typeof renderPause === 'function') renderPause('main'); showOverlay('ovPause'); }
  else if (S.screen === 'paused') { S.screen = 'play'; hideOverlays(); cvs.focus(); }
}
function toggleFS() {
  try {
    if (!document.fullscreenElement) { const r = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen({ navigationUI: 'hide' }); if (r && r.then) r.then(fsLockEsc).catch(() => {}); }
    else { fsUnlockEsc(); if (document.exitFullscreen) document.exitFullscreen().catch(() => {}); }
  } catch (e) {}
}
// ESC stays in the game while fullscreen: the Keyboard Lock API (Chrome / Edge / Android) hands Esc to the page, so it
// pauses instead of leaving fullscreen. Browsers still let a player HOLD Esc to get out (they never allow trapping it),
// and where the API is missing or refused (Firefox, Safari, some embedded frames) Esc keeps the browser's behaviour.
function fsLockEsc() { try { if (document.fullscreenElement && navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(['Escape']).catch(() => {}); } catch (e) {} }
function fsUnlockEsc() { try { if (navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock(); } catch (e) {} }
document.addEventListener('fullscreenchange', () => { if (document.fullscreenElement) fsLockEsc(); else fsUnlockEsc(); });
const cyc = (obj, cur) => { const ks = Object.keys(obj); return ks[(ks.indexOf(cur) + 1) % ks.length]; };
$('btnResume').onclick = togglePause;
$('btnPauseSet').onclick = () => renderPause('settings');
$('btnPauseKeys').onclick = () => renderPause('controls');
$('btnRestart').onclick = () => { const m = S.match; if (m) startMatch(m); };
$('btnQuit').onclick = () => { const m = S.match; leaveMatch(); if (m && m.onQuit) m.onQuit(); };
$('btnFS2').onclick = toggleFS;
$('btnMsg').onclick = () => { continueAfterMsg(); cvs.focus(); };
$('ovFocus').onclick = () => { hideOverlays(); cvs.focus(); if (S.screen === 'paused') S.screen = 'play'; };

// the game owns the keyboard: no key it receives reaches the browser or the system (no alert beeps, no scrolling,
// no find-as-you-type), on any screen. Left alone: Cmd/Ctrl shortcuts, the F-keys, typing in a text box or menu,
// and Tab / Enter / Space on a focused menu button (so keyboard menu navigation still works)
function keyIsOurs(e) {
  if (e.metaKey || e.ctrlKey || /^F\d+$/.test(e.code)) return false;
  const t = e.target, tag = t && t.tagName;
  if ((tag && /INPUT|TEXTAREA|SELECT/.test(tag)) || (t && t.isContentEditable)) return false;
  const live = S.screen === 'play' || S.screen === 'intro' || S.screen === 'celebrate' || S.screen === 'replay';
  if (!live && (e.code === 'Tab' || ((e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') && tag === 'BUTTON'))) return false;
  return true;
}
for (const ev of ['keydown', 'keypress', 'keyup']) addEventListener(ev, e => { if (keyIsOurs(e)) e.preventDefault(); }, true);
// in fullscreen, also ask the browser for the whole keyboard (Chrome/Edge): Esc and other system keys then belong to
// the game too (hold Esc to leave fullscreen). Released automatically when fullscreen ends.
document.addEventListener('fullscreenchange', () => { try { if (document.fullscreenElement && navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock().catch(() => {}); } catch (e) {} });

addEventListener('keydown', e => {
  const c = e.code;
  const inField = e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
  if (inField || Input.capturing || S.demo) return;
  const inGame = S.screen === 'play' || S.screen === 'paused' || S.screen === 'timeout' || S.screen === 'intermission' || S.screen === 'intro' || S.screen === 'replay' || S.screen === 'celebrate' || S.screen === 'outro';
  const acts = Input.keyDown(c);
  if (inGame) input.lastKeyAt = performance.now();
  // in a game (not the pause menu) every key belongs to the game: nothing reaches the browser or the system
  // (no scrolling, no 'unknown shortcut' beeps), except browser/system combos and the F-keys
  const live = inGame && S.screen !== 'paused';
  if ((live && !e.metaKey && !e.ctrlKey && !e.altKey && !/^F\d+$/.test(c)) || (inGame && (acts.length || c === 'Space' || c.startsWith('Arrow')))) e.preventDefault();
  initAudio();
  if (AC && AC.state === 'suspended') AC.resume().catch(() => {});
  if (e.repeat) return;
  if (acts.includes('fullscreen') && (inGame || (!Input.capturing && !(e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName))))) { toggleFS(); return; }   // in menus too
  if (S.screen === 'intermission') {
    for (let i = 1; i <= 3; i++) if (acts.includes('line' + i)) { pickLine(i - 1); return; }
    if (c === 'Space' || c === 'Enter' || acts.includes('shoot')) { Input.clear(); skipIntermission(); } return; }
  if (S.screen === 'intro') { skipIntro(); return; }
  if (S.screen === 'celebrate') { if (S.celeb && S.celeb.t > 40) finishCelebration(); return; }
  if (S.screen === 'outro' && c === 'KeyK' && typeof outroKeep === 'function') { outroKeep(); return; }
  if (typeof walkSkip === 'function' && walkSkip(c)) return;
  if (S.screen === 'outro') { if (S.outro && S.outro.t > 20 && (c === 'Space' || c === 'Enter' || c === 'NumpadEnter' || c === 'Escape' || acts.includes('shoot'))) { if (c === 'Escape') finishOutro(); else outroSkip(); } return; }
  if (S.screen === 'replay') { replayKey(c, acts); return; }
  if (S.screen === 'paused' && typeof pauseKey === 'function' && pauseKey(c, acts)) return;
  if (S.screen === 'timeout') { if (acts.includes('timeout') || acts.includes('pause') || c === 'Enter') endTimeout(); return; }
  if (acts.includes('timeout') && S.screen === 'play' && !S.autoAI && typeof callTimeout === 'function') { if (!callTimeout(0)) floaters.push({ x: CX, y: CY, text: toLeft(0) > 0 ? 'TIMEOUTS ONLY AT A STOPPAGE' : 'NO TIMEOUTS LEFT', life: 50, color: '#ff9a7a' }); return; }
  if (acts.includes('pause') && (S.screen === 'play' || S.screen === 'paused')) { togglePause(); return; }
  if (acts.includes('help') && (S.screen === 'play' || S.screen === 'paused')) {   // the cheat sheet, any time: opens straight to it, and closes it again
    if (S.screen === 'paused' && pauseView === 'controls') togglePause(); else { if (S.screen === 'play') togglePause(); renderPause('controls'); }
    return; }
  if (S.screen === 'play' && S.ask && S.ask.live && (acts.includes('fightYes') || acts.includes('fightNo'))) { answerFight(acts.includes('fightYes')); return; }
  if (S.screen === 'play' && S.phase === 'ask') { if (acts.includes('fightYes')) answerFight(true); else if (acts.includes('fightNo') || c === 'Escape') answerFight(false); return; }
  if (S.screen === 'play' && typeof extraPickKey === 'function' && extraPickKey(acts, c)) return;
  for (let i = 1; i <= 3; i++) if (acts.includes('line' + i) && pickLine(i - 1)) return;
  if (S.screen !== 'play') return;
  if (acts.includes('pull')) return;   // SOCCER: there's no pulling the keeper
  if (false && acts.includes('pull') && MS && MS.rs && S.phase !== 'fight') { if (!pullGoalie(0, !MS.rs.pulled[0])) floaters.push({ x: CX, y: ownGoalY(0) + attackDir(0) * 70, text: MS.rs.pulled[0] ? 'CAN\'T RETURN NOW' : 'CAN\'T PULL THE KEEPER NOW', life: 60, color: '#ff9e94' }); return; }
  if (acts.includes('fight')) return;   // SOCCER: no scuffles
  if (S.spot && S.spot.active && skipSpotlight()) return;
  if (S.phase === 'goal' && acts.length && skipGoalPresentation()) return;
  // (Nov 22 stoppage pass) PASS (the pass/check key) hurries a stoppage along: a whistle once its banner has been up half a second, and the
  // faceoff lineup straight to the referee's READY? (never into the drop countdown itself, so the timing is untouched)
  if ((acts.includes('check') || acts.includes('pass')) && !S.autoAI && !S.lineHold && foHurryOK()) { foHurry(); return; }
  if (acts.includes('line') && (S.phase === 'whistle' || S.phase === 'goal' || S.phase === 'faceoff') && linePickVisible()) { S.lineHold = !S.lineHold; updateLinePick(true); return; }
  if (acts.includes('sprint') && !S.autoAI) { S.sprintOn = !S.sprintOn; if (ctrl) floaters.push({ x: ctrl.x, y: ctrl.y - 34, text: S.sprintOn ? 'SPRINT ON' : 'SPRINT OFF', life: 40, color: S.sprintOn ? '#7ec8ff' : '#9aa3c7' }); }
  if (acts.includes('shoot')) { input.spacePressed = true; input.spaceAt = performance.now(); input.spaceDir = { x: (KR() ? 1 : 0) - (KL() ? 1 : 0), y: (KD() ? 1 : 0) - (KU() ? 1 : 0) }; }
  if (acts.includes('check')) input.shiftPressed = true;
  if (acts.includes('pass')) input.passPressed = true;
  if (acts.includes('poke')) input.pokePressed = true;
  if (acts.includes('loft')) input.loftPressed = true;
  if (acts.includes('line')) input.linePressed = true;
  if (acts.includes('cover')) input.coverPressed = true;
  if (!e.repeat) { const dk = acts.includes('deke') ? 'drag' : acts.includes('dangle') ? 'dangle' : acts.includes('spin') ? 'spin' : null; if (dk) { input.dekeKind = dk; input.dekePressed = true; input.dekeAt = performance.now(); } }
});
addEventListener('keyup', e => { Input.keyUp(e.code); if ((S.screen === 'play' || S.screen === 'intermission' || S.screen === 'intro' || S.screen === 'celebrate' || S.screen === 'outro') && !e.metaKey && !e.ctrlKey && !/^F\d+$/.test(e.code) && !(e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) e.preventDefault(); });
// lost focus: release every key so nothing stays "held", and pause a live game
const dropKeys = () => { Input.clear(); input.shiftPending = false; for (const p of players) if (p.charge >= 0 && p === ctrl) p.charge = -1; };
addEventListener('blur', () => {
  dropKeys();
  if (S.screen === 'play' && !S.demo) { S.screen = 'paused'; showOverlay('ovFocus'); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { dropKeys(); if (S.screen === 'play' && !S.demo) { S.screen = 'paused'; showOverlay('ovFocus'); } } });
cvs.addEventListener('mousedown', () => { cvs.focus(); if (S.screen === 'intermission') skipIntermission(); else if (S.screen === 'intro' && typeof skipIntro === 'function') skipIntro(); });

function fit() {
  const lw = viewW(), lh = HUDH + viewH();
  const s = Math.max(0.5, Math.min((innerWidth - 8) / lw, (innerHeight - 8) / lh));
  cvs.style.width = Math.floor(lw * s) + 'px'; cvs.style.height = Math.floor(lh * s) + 'px';
}
addEventListener('resize', () => { fit(); if (typeof fitScene === 'function') setTimeout(fitScene, 0); });

// ====================================================================
//  LOOP
// ====================================================================
makeTeams(); sizeCanvas(); setupFaceoff(CX, CY); updateCamera(true);
let last = performance.now(), acc = 0;
function frame(now) {
  if (S.demo && typeof demoTick === 'function') demoTick();
  if (typeof jbTick === 'function') jbTick(now);
  if (typeof Music !== 'undefined' && Music.matchTick) Music.matchTick();
  if (S.spectate && S.screen === 'play' && S.phase === 'ask' && typeof answerFight === 'function') answerFight(Math.random() < 0.5);
  if (S.screen === 'play' && typeof crowdTick === 'function') crowdTick();
  acc += Math.min(100, now - last); last = now;
  const step = 1000 / (60 * SPEEDS[S.speed]);
  while (acc >= step) {
    if (S.screen === 'play') { update(); recTick(); }
    else if (S.screen === 'intermission') interTick();
    else if (S.screen === 'replay') replayTick();
    else if (S.screen === 'intro' && typeof introTick === 'function') introTick();
    else if (S.screen === 'celebrate' && typeof celebTick === 'function') celebTick();
    else if (S.screen === 'outro' && typeof outroTick === 'function') outroTick();
    acc -= step;
  }
  if (!S.demo && (S.camPref || 'AUTO') === 'AUTO' && ++S.camChk % 30 === 0) applyCamPref();   // (the window turned or was resized)
  if (S.screen !== 'menu') render();
  if (typeof drawScene === 'function') { if (S.screen !== S.sceneScr || ++S.sceneFitT % 30 === 0) { S.sceneScr = S.screen; fitScene(); } if (S.screen !== 'menu') drawScene(); }
  updateAudio();
  requestAnimationFrame(frame);
}
if (document.fonts && document.fonts.load) document.fonts.load("8px 'PH Pixel'").then(() => { buildRink(); }).catch(() => {});
requestAnimationFrame(frame);
