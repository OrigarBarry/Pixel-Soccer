'use strict';
// ====================================================================
//  LEAGUE: franchise data model, schedule, simulation, competitions,
//  awards, trophies, history, development, draft
// ====================================================================
const SAVE_FORMAT = 'pixelsoccer-franchise', LEGACY_FORMATS = ['breakaway-franchise'];   // storage keys keep their old names so existing saves load
const isSaveFormat = f => f === SAVE_FORMAT || LEGACY_FORMATS.includes(f);
const SAVE_VERSION = 7;   // 7 (Nov 23 in Pixel Hockey, ported Nov 24): compressed cloud sections + the vault (nothing is deleted any more)
const GAME_VERSION = '2.0';
const START_YEAR = 1998;

// ---------- small utilities
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hashStr = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const ri = (lo, hi, rng = Math.random) => lo + Math.floor(rng() * (hi - lo + 1));
const pickR = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)];
const clampI = (v, a, b) => Math.max(a, Math.min(b, Math.round(v)));
const clone = o => JSON.parse(JSON.stringify(o));
const newUid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const seasonLabel = y => y + '-' + String((y + 1) % 100).padStart(2, '0');
const weightedPick = (items, wf, rng = Math.random) => {
  const ws = items.map(wf), tot = ws.reduce((a, b) => a + b, 0);
  let r = rng() * tot; for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; } return items[items.length - 1];
};

// ---------- statistics lines
const STAT_KEYS = ['gp', 'g', 'a', 'sog', 'hit', 'pas', 'pm', 'toi', 'sa', 'sv', 'ga', 'w',
  // performance model (v3): hat tricks, shutouts, expected goals x100, high-danger shots, high-danger saves, expected goals against x100,
  // defensive stops, takeaways, giveaways, defensive value x10, clutch value x10, chances created, impact x10, defensive impact x10, star counts
  'hat', 'sho', 'xg', 'hd', 'hds', 'xga', 'ds', 'tk', 'gv', 'dv', 'cv', 'ch', 'imp', 'dimp', 's1', 's2', 's3', 'gpi', 'bws', 'pen', 'int',
  // v5: power play / shorthanded / empty-net goals, power-play assists, penalty seconds, fights won / lost, injuries, empty-net goals against (goalies)
  'ppg', 'ppa', 'shg', 'eng', 'pim', 'fw', 'fl', 'inj', 'ena',
  // v6: faceoffs won / taken, deflection (tip-in) goals
  'fow', 'fot', 'tip'];
const CATS = ['reg', 'po', 'tour', 'exh'];
const CAT_NAMES = { reg: 'Regular Season', po: 'Playoffs', tour: 'Tournaments', exh: 'Exhibition', life: 'Lifetime' };
const emptyLine = () => Object.fromEntries(STAT_KEYS.map(k => [k, 0]));
function addLine(dst, src) { if (!src) return dst; for (const k of STAT_KEYS) dst[k] = (dst[k] || 0) + (src[k] || 0); return dst; }
const emptyCats = () => ({ reg: emptyLine(), po: emptyLine(), tour: emptyLine(), exh: emptyLine() });
// archived lines are stored sparse (zeros dropped) to keep long franchises small; fullLine() restores them
const packLine = l => { const o = {}; for (const k of STAT_KEYS) if (l && l[k]) o[k] = l[k]; return o; };
const fullLine = l => Object.assign(emptyLine(), l || {});
function packCats(cats) { const o = {}; for (const c of CATS) if (cats && cats[c] && (cats[c].gp || cats[c].toi)) o[c] = packLine(cats[c]); return o; }
function lifetime(cats) { const l = emptyLine(); for (const c of CATS) addLine(l, cats && cats[c]); return l; }
const svPct = l => l.sa ? l.sv / l.sa : 0;
const fmtSv = v => v ? v.toFixed(3).replace(/^0/, '') : '-';
const fmtToi = s => { s = Math.round(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

// ---------- players
function overall(p) {
  const a = p.attrs;
  if (p.pos === 'G') return (a.ref * 1.3 + a.pos * 1.2 + a.reb + a.rec * 0.8 + a.sta * 0.7) / 5;
  return (a.spd * 1.1 + a.sta * 0.6 + a.pow + a.acc * 1.1 + a.pas + (a.stk ?? 5) * 0.7 + a.def + a.chk * 0.8 + (a.fo ?? 5) * 0.25) / 7.55;
}
// ratings are shown on a 0-100 scale (attributes are stored 1-10)
const ovrInt = p => Math.round(overall(p) * 10);
const r100 = v => Math.round((v || 0) * 10);
const pot100 = p => Math.round((p.pot || 0) * 10);
// line SLOTS are left / centre / right (SPOS); a skater's NATURAL position is one of NAT_POS. Any skater can fill any slot;
// natural position and attributes decide how well. Goalies are 'G'.
const SPOS = ['LW', 'C', 'RW'];
const NAT_POS = ['LW', 'C', 'RW', 'LD', 'RD'];
// 3-ON-3: there are no wings or defencemen, only sides. LW and LD both play LEFT, RW and RD both play RIGHT; the old LD/RD
// players keep a D badge: they are the stay-at-home type (the line's anchor). The stored values (spos) stay as they were.
const POS_NAMES = { LW: 'Left wing', C: 'Striker', RW: 'Right wing', LD: 'Left back', RD: 'Right back', G: 'Keeper' };   // SOCCER
const SIDE_OF = { LW: 'L', LD: 'L', C: 'C', RW: 'R', RD: 'R' };
const sideOf = spos => SIDE_OF[spos] || 'C';
const SIDE_NAMES = { L: 'Left', C: 'Centre', R: 'Right', D: 'Back (stay-at-home)', G: 'Keeper' };
// short tag for tables and lists: L, C, R, L·D, R·D, G
const posShort = spos => ({ LW: 'LW', C: 'ST', RW: 'RW', LD: 'LB', RD: 'RB', G: 'GK' })[spos] || 'ST';   // SOCCER: LW, ST, RW, LB, RB, GK
// does a player match a filter key (ALL, L, C, R, D, G)
const posMatch = (p, k) => k === 'ALL' || (k === 'G' ? p.pos === 'G' : p.pos !== 'G' && (k === 'D' ? (p.spos === 'LD' || p.spos === 'RD') : sideOf(p.spos) === k));
const POS_FILTERS = ['ALL', 'L', 'C', 'R', 'D', 'G'];
const isDefPos = s => s === 'LD' || s === 'RD';
const HAND_NAMES = { L: 'Left', R: 'Right' };
// deterministic handedness from an id (older saves get the same assignment every time they load)
// goalies: which hand wears the catcher ('L' = regular, catches left) and a hidden stronger side ('glove' / 'blocker' / even),
// derived from the id so old saves and new players agree without migration
function goalieCatch(pl) { if (!pl) return 'L'; if (pl.hand) return pl.hand; let h = 5; for (const c of String(pl.id)) h = (h * 37 + c.charCodeAt(0)) >>> 0; return (h % 1000) / 1000 < 0.6 ? 'L' : 'R'; }
function goalieStrongSide(pl) { if (!pl) return null; let h = 3; for (const c of String(pl.id)) h = (h * 53 + c.charCodeAt(0)) >>> 0; const r = (h % 1000) / 1000; return r < 0.3 ? 'glove' : r < 0.55 ? 'blocker' : null; }
function handFromId(id, spos) { let h = 7; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; const r = (h % 1000) / 1000; return r < (spos === 'RD' || spos === 'RW' ? 0.5 : 0.66) ? 'L' : 'R'; }
// natural faceoff skill for a player created before the Faceoff attribute existed
function foFromAttrs(p) { const a = p.attrs; return clampI(((a.pas || 5) + (a.def || 5) + (a.stk || 5)) / 3 + (p.spos === 'C' ? 1.5 : isDefPos(p.spos) ? -0.5 : -1) + (hashJit(p.id) - 0.5) * 2, 1, 10); }
function hashJit(id) { let h = 11; for (const c of String(id)) h = (h * 131 + c.charCodeAt(0)) >>> 0; return (h % 997) / 997; }
const posLabel = p => p.pos === 'G' ? 'G' : (p.spos ? posShort(p.spos) : 'F');
function genPlayer(rng, pos, opts = {}) {
  const q = opts.q ?? 5;
  const arch = pos === 'G' ? 'goalie' : (opts.arch || pickR(['speedster', 'sniper', 'defensive', 'enforcer', 'playmaker', 'balanced', 'balanced'], rng));
  const keys = pos === 'G' ? G_ATTRS : SK_ATTRS;
  const attrs = {};
  for (const [k] of keys) attrs[k] = clampI(q + (rng() - 0.5) * 3.2 + (ARCHETYPES[arch].mods[k] || 0), 1, 10);
  const age = opts.age ?? ri(19, 34, rng);
  const nm = genName(rng);
  const p = { id: null, first: nm.first, last: nm.last, nat: nm.nat, pos, num: 0, age, attrs, pot: 0, arch,
    status: 'active', teamId: null, career: emptyCats(), seasons: [], awards: [], joined: null, draft: null,
    peak: ri(24, 30, rng), cond: BAL.cond.start, traits: [], inj: null };
  if (pos !== 'G') {
    p.spos = opts.spos || (arch === 'playmaker' ? pickR(['C', 'C', 'LW', 'RW', 'RD'], rng) : arch === 'sniper' ? pickR(['LW', 'RW', 'RW', 'C'], rng)
      : arch === 'defensive' ? pickR(['LD', 'RD', 'LD', 'RD', 'C'], rng) : arch === 'enforcer' ? pickR(['LD', 'RD', 'LW', 'RW'], rng) : pickR(['LW', 'C', 'RW', 'LD', 'RD', 'C'], rng));
    p.hand = opts.hand || (rng() < (p.spos === 'RD' || p.spos === 'RW' ? 0.5 : 0.64) ? 'L' : 'R');
    // faceoff skill: natural centres take draws for a living
    attrs.fo = clampI(attrs.fo + (p.spos === 'C' ? 2 : isDefPos(p.spos) ? 0 : -1), 1, 10);
  }
  const o = overall(p);
  p.pot = clampI(age <= 22 ? o + ri(1, 4, rng) : age <= 26 ? o + ri(0, 2, rng) : o, 1, 10);
  if (opts.pot) p.pot = Math.max(p.pot, opts.pot);
  if (!opts.noTraits) p.traits = genTraits(p, rng);
  return p;
}
// starting traits: none, one or (rarely) two, flavoured by playstyle; stars and veterans a little more often
const ARCH_TRAITS = { speedster: ['speedster', 'iron_lungs', 'comeback'], sniper: ['sharpshooter', 'clutch', 'rebound_hunter'], defensive: ['def_spec', 'disciplined', 'steady_footing', 'protector'],
  enforcer: ['enforcer', 'tough', 'hotheaded', 'intimidating', 'iron_chin', 'protector', 'counterpuncher'], playmaker: ['playmaker', 'clutch', 'comeback'], balanced: [], goalie: ['brick_wall', 'acrobat', 'big_game', 'durable', 'rink_rat'] };
function traitWeight(p, id) {
  const t = TRAITS[id]; if (!t || t.earnedOnly || !traitFits(p, id)) return 0;
  let w = [0, 10, 5, 2][t.rarity] || 3;
  if ((ARCH_TRAITS[p.arch] || []).includes(id)) w *= 3;
  return w;
}
function rollTrait(p, rng = Math.random, pool) {
  const ids = (pool || Object.keys(TRAITS)).filter(id => canAddTrait(p, id) && traitWeight(p, id) > 0);
  if (!ids.length) return null;
  return weightedPick(ids, id => traitWeight(p, id), rng);
}
function genTraits(p, rng = Math.random) {
  const o = overall(p), r = rng();
  let n = r < 0.42 ? 0 : r < 0.86 ? 1 : 2;
  if (o >= 7 && rng() < 0.35) n = Math.min(2, n + 1);
  p.traits = [];
  for (let i = 0; i < n; i++) { const id = rollTrait(p, rng); if (id) p.traits.push(id); }
  return p.traits;
}
const hasTrait = (pl, id) => !!(pl && pl.traits && pl.traits.includes(id));
// a trait multiplier (injMul, condMul, penMul ...) across all of a player's traits
const traitMul = (pl, key) => (pl && pl.traits || []).reduce((m, id) => m * ((TRAITS[id] || {})[key] ?? 1), 1);
const traitFight = (pl, key) => (pl && pl.traits || []).reduce((m, id) => m + (((TRAITS[id] || {}).fight || {})[key] || 0), 0);
function registerPlayer(save, p) { p.id = 'p' + (save.nextId.p++); p.look = p.look || makeLook(p.id, p.age); save.players[p.id] = p; return p; }
const P = (save, id) => save.players[id];

// ---------- rosters: 3 lines of 3 + 3 reserves (12 skaters), 3 goalies (index 0 starts)
const emptyRoster = () => ({ lines: [[null, null, null], [null, null, null], [null, null, null]], reserves: [null, null, null], goalies: [null, null, null] });
function skaterSlots(r) { const out = []; r.lines.forEach((l, i) => l.forEach((id, j) => out.push({ kind: 'line', i, j, id }))); r.reserves.forEach((id, i) => out.push({ kind: 'res', i, id })); return out; }
function goalieSlots(r) { return r.goalies.map((id, i) => ({ kind: 'g', i, id })); }
const rosterSkaters = t => skaterSlots(t.roster).map(s => s.id).filter(Boolean);
const rosterGoalies = t => t.roster.goalies.filter(Boolean);
const rosterIds = t => rosterSkaters(t).concat(rosterGoalies(t));
// ---------- ROSTER FLEXIBILITY: the FARM TEAM (6 spots: prospects and spare players; they don't dress but they develop,
// more slowly) and INJURED RESERVE (a player out 5+ games can go on IR; his spot opens until he's healthy). Both belong
// to the club: their contracts count, their numbers are theirs. "orgIds" = everybody the club has.
const FARM = { size: 6, callsPerWeek: 3, devMul: 0.6, irMin: 5, irMax: 3, vetAge: 26 };
const farmIds = t => (t.farm || []).filter(Boolean);
const irIds = t => (t.ir || []).filter(Boolean);
const orgIds = t => rosterIds(t).concat(farmIds(t), irIds(t));
const farmRoom = t => FARM.size - farmIds(t).length;
const orgFull = (t, pos) => rosterFull(t, pos) && farmRoom(t) <= 0;
// a new player joins the club: the main roster if his position has room, otherwise the farm team (returns where he went)
function joinOrg(save, t, pid) {
  if (addToRoster(save, t, pid)) return 'roster';
  if (farmRoom(t) > 0) { const p = P(save, pid); (t.farm = t.farm || []).push(pid); p.teamId = t.id; p.status = 'active';
    if (!p.tj || p.tj.t !== t.id) p.tj = { t: t.id, s: save.season ? save.season.num : 0, o: ovrInt(p) };
    if (!p.num || numberTaken(save, t, p.num, pid)) p.num = freeNumber(save, t, p.num); return 'farm'; }
  return null;
}
function getSlot(r, s) { return s.kind === 'line' ? r.lines[s.i][s.j] : s.kind === 'res' ? r.reserves[s.i] : r.goalies[s.i]; }
function setSlot(r, s, v) { if (s.kind === 'line') r.lines[s.i][s.j] = v; else if (s.kind === 'res') r.reserves[s.i] = v; else r.goalies[s.i] = v; }
function swapSlots(team, a, b) {
  const ga = a.kind === 'g', gb = b.kind === 'g';
  if (ga !== gb) return false;                                    // skaters only swap with skaters
  const r = team.roster, va = getSlot(r, a), vb = getSlot(r, b);
  setSlot(r, a, vb); setSlot(r, b, va);
  if (ga) compactGoalies(r);
  return true;
}
function compactGoalies(r) { const g = r.goalies.filter(Boolean); r.goalies = [g[0] || null, g[1] || null, g[2] || null]; }
function addToRoster(save, team, pid) {
  const p = P(save, pid), r = team.roster;
  if (p.pos === 'G') { const i = r.goalies.indexOf(null); if (i < 0) return false; r.goalies[i] = pid; }
  else {
    const slot = skaterSlots(r).find(s => !s.id && s.kind === 'line') || skaterSlots(r).find(s => !s.id);
    if (!slot) return false; setSlot(r, slot, pid);
  }
  if (!p.tj || p.tj.t !== team.id) p.tj = { t: team.id, s: save.season ? save.season.num : 0, o: ovrInt(p) };   // joined this club: start of his tenure
  p.teamId = team.id; p.status = 'active';
  if (!p.num || numberTaken(save, team, p.num, pid)) p.num = freeNumber(save, team, p.num);
  return true;
}
// last resort when his position is full: any open roster spot (a goalie in an empty skater spot never happens, the
// roster checks stop it; this keeps a player from ever ending up on no team at all)
function placeAnywhere(save, team, pid) {
  const p = P(save, pid), r = team.roster;
  const slot = p.pos === 'G' ? null : skaterSlots(r).find(s => !s.id);
  if (slot) { setSlot(r, slot, pid); p.teamId = team.id; p.status = 'active'; return true; }
  if (p.pos === 'G' && r.goalies.length < 3) { r.goalies.push(pid); p.teamId = team.id; p.status = 'active'; return true; }
  p.teamId = null; p.status = 'free'; if (p.contract) p.contract = null;          // nowhere at all: he becomes a free agent (never lost)
  return false;
}
function removeFromRoster(team, pid) {
  if (team.farm) team.farm = team.farm.filter(x => x !== pid);
  if (team.ir) team.ir = team.ir.filter(x => x !== pid);
  if (team.leaders) { if (team.leaders.c === pid) team.leaders.c = null; team.leaders.a = team.leaders.a.map(x => x === pid ? null : x); }   // leadership is vacated
  const r = team.roster;
  for (const s of skaterSlots(r)) if (s.id === pid) setSlot(r, s, null);
  r.goalies = r.goalies.map(g => g === pid ? null : g); compactGoalies(r);
  fillLinesFromReserves(r);
}
function fillLinesFromReserves(r) {
  for (const l of r.lines) for (let j = 0; j < 3; j++) if (!l[j]) { const k = r.reserves.findIndex(Boolean); if (k >= 0) { l[j] = r.reserves[k]; r.reserves[k] = null; } }
}
const rosterFull = (team, pos) => pos === 'G' ? rosterGoalies(team).length >= 3 : rosterSkaters(team).length >= 12;
// ====================================================================
//  SMART AUTO-ARRANGE (3-on-3 lines). Builds the three lines and the bench from:
//   - how good each player is TODAY (rating, minus tiredness; injured players can't dress)
//   - his natural side (L / C / R): on his own side he loses nothing
//   - THE LINE'S TACTIC AND TEMPO: each strategy wants different skills (a forecheck line wants legs and hits,
//     a shell line wants defending, a cycle line wants hands and passing...)
//   - a stay-at-home anchor on every line (a D badge, the Defensive type, or at least a good defender)
//   - faceoffs at centre, the captain on line 1 (his aura is on the ice the most), linemate traits
//  Line 1 plays ~40% of the game, line 2 ~33%, line 3 ~27%, so the best fits go up top.
//  Returns { lines, reserves, goalies, notes }; with opts.dry the team is left untouched.
// ====================================================================
const AA_ICE = [0.40, 0.33, 0.27];
// what each strategy / tempo wants from its skaters (attribute weights; 1-10 attributes, 5 = average)
const AA_TAC = {
  balanced: {}, forecheck: { spd: 0.5, chk: 0.5, sta: 0.4 }, shell: { def: 0.7, chk: 0.3 }, counter: { spd: 0.6, acc: 0.3, pas: 0.3 },
  crash: { pow: 0.5, chk: 0.3, stk: 0.3 }, splitlanes: { def: 0.5, pas: 0.3 }, trap: { def: 0.5, spd: 0.3 },
};
const AA_TEMPO = { rush: { spd: 0.4, acc: 0.3 }, mixed: {}, cycle: { stk: 0.4, pas: 0.3, pow: 0.2 } };
const AA_NEEDS_ANCHOR = { shell: 1.4, trap: 1.3, splitlanes: 1.3, balanced: 1, forecheck: 1, counter: 0.8, crash: 0.7 };
const AA_WHY = { forecheck: 'speed, hitting and stamina', shell: 'defending', counter: 'speed and quick passing', crash: 'strength and ball protection',
  splitlanes: 'defending and passing', trap: 'defending and running', balanced: '' };
const aaDef = p => p.pos !== 'G' && (isDefPos(p.spos) || p.arch === 'defensive');
function aaFresh(p) { const b = condBand(p.cond); return 1 - b[2] * 2.5; }          // Tired ≈ -9%, Exhausted ≈ -15%
function aaTacFit(p, strat, tempo) {
  const a = p.attrs, w = Object.assign({}, AA_TAC[strat] || {}); for (const k in AA_TEMPO[tempo] || {}) w[k] = (w[k] || 0) + AA_TEMPO[tempo][k];
  let v = 0; for (const k in w) v += ((a[k] ?? 5) - 5) * w[k];
  return v * 0.12;
}
function autoArrange(save, team, opts = {}) {
  const avail = p => !(p.inj && p.inj.g > 0);
  const tac = typeof validTac === 'function' ? validTac(team.tac) : { lines: ['balanced', 'balanced', 'balanced'], tempo: ['mixed', 'mixed', 'mixed'] };
  const L = typeof teamLeaders === 'function' ? teamLeaders(team) : { c: null, a: [] };
  const sk = rosterSkaters(team).map(id => P(save, id)).filter(Boolean);
  const gs = rosterGoalies(team).map(id => P(save, id)).filter(Boolean).sort((a, b) => (avail(b) - avail(a)) || (overall(b) * aaFresh(b) - overall(a) * aaFresh(a)));
  const eff = p => overall(p) * aaFresh(p);
  // who can dress: healthy players first (an injured one only if there's nobody else)
  const order = sk.slice().sort((a, b) => (avail(b) - avail(a)) || (eff(b) - eff(a)));
  const healthy = order.filter(avail), dressed = healthy.length >= 9 ? healthy : order.slice(0, Math.max(9, healthy.length));
  // one line's value: its best slot order, the tactic fit, an anchor, a centre who wins draws, the captain, linemate traits
  const lineVal = (i, trio) => {
    const strat = tac.lines[i], tempo = tac.tempo[i];
    let best = -1e9, perm = null;
    for (const pm of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
      let v = 0; for (let j = 0; j < 3; j++) { const p = trio[pm[j]]; if (!p) continue; v += eff(p) * (1 - offPosPenalty(p.spos, j, p)) + aaTacFit(p, strat, tempo); }
      const c = trio[pm[1]]; if (c) v += ((c.attrs.fo ?? 5) - 5) * 0.05;
      if (v > best) { best = v; perm = pm; }
    }
    const ps = trio.filter(Boolean);
    const anc = Math.max(...ps.map(p => (aaDef(p) ? 1 : 0) + ((p.attrs.def || 5) - 5) * 0.1));
    best += Math.min(1, anc) * 0.35 * (AA_NEEDS_ANCHOR[strat] || 1);
    if (i === 0 && ps.some(p => p.id === L.c)) best += 0.25;
    const mods = typeof iceMods === 'function' ? iceMods(ps, 'onIce') : {}; for (const k in mods) best += mods[k] * 0.3;
    return { v: best, perm };
  };
  // try every choice of three lines from everyone who can dress (up to 12 skaters: ~370,000 lineups) and keep the best
  // weighted total; whoever is left over sits on the bench
  let top = null;
  const idx = dressed.map((_, k) => k), combos = (arr, k) => k === 0 ? [[]] : arr.flatMap((x, n) => combos(arr.slice(n + 1), k - 1).map(c => [x].concat(c)));
  const cache = new Map(); const lv = (i, c) => { const key = i * 4096 + c.reduce((m, k) => m | (1 << k), 0); let v = cache.get(key); if (!v) { v = lineVal(i, c.map(k => dressed[k])); cache.set(key, v); } return v; };
  const pad = a => a.concat([null, null, null]).slice(0, 3);
  if (dressed.length >= 9) {
    for (const a of combos(idx, 3)) { const x = lv(0, a), r1 = idx.filter(k => !a.includes(k));
      for (const b of combos(r1, 3)) { const y = lv(1, b), r2 = r1.filter(k => !b.includes(k)), xy = x.v * AA_ICE[0] + y.v * AA_ICE[1];
        if (top && xy + 12 * AA_ICE[2] < top.tot) continue;                                     // can't win even with a perfect third line
        for (const c of combos(r2, 3)) { const z = lv(2, c), tot = xy + z.v * AA_ICE[2];
          if (!top || tot > top.tot) top = { tot, parts: [[a, x], [b, y], [c, z]] }; } } }
  } else {                                     // short bench: fill line by line, best first
    const left = idx.slice(); top = { parts: [] };
    for (let i = 0; i < 3; i++) { const a = left.splice(0, 3); top.parts.push([a, lineVal(i, pad(a.map(k => dressed[k])))]); }
  }
  const r = emptyRoster();
  top.parts.forEach(([ks, res], i) => { const trio = pad(ks.map(k => dressed[k])); for (let j = 0; j < 3; j++) { const p = trio[res.perm ? res.perm[j] : j]; r.lines[i][j] = p ? p.id : null; } });
  const used = new Set(r.lines.flat().filter(Boolean));
  order.filter(p => !used.has(p.id)).slice(0, 3).forEach((p, k) => r.reserves[k] = p.id);
  gs.forEach((p, k) => r.goalies[k] = p.id);
  const out = { lines: r.lines, reserves: r.reserves, goalies: r.goalies, notes: aaNotes(save, team, r, tac, order) };
  if (!opts.dry) team.roster = r;
  return out;
}
// plain-language reasons for the arrangement (shown in the preview and after the pre-game auto lines)
function aaNotes(save, team, r, tac, order) {
  const notes = [], old = team.roster, nm = p => '#' + p.num + ' ' + p.last;
  const where = (rr, id) => { for (let i = 0; i < 3; i++) { const j = rr.lines[i].indexOf(id); if (j >= 0) return { i, j }; } return rr.reserves.includes(id) ? { res: true } : null; };
  for (const p of order) {
    const a = where(old, p.id), b = where(r, p.id);
    if (p.inj && p.inj.g > 0) { if (a && !a.res) notes.push(`${nm(p)} is injured (${p.inj.g} game${p.inj.g === 1 ? '' : 's'}): out of the lineup.`); continue; }
    if (!b || b.res) { if (a && !a.res) notes.push(`${nm(p)} to the bench` + (condBand(p.cond)[0] === 'Tired' || condBand(p.cond)[0] === 'Exhausted' ? `: ${condBand(p.cond)[0].toLowerCase()} (${Math.round(p.cond)}), a rest helps.` : ': others fit the lines better.')); continue; }
    if (a && !a.res && a.i === b.i && a.j === b.j) continue;
    const slot = ['left', 'centre', 'right'][b.j], strat = tac.lines[b.i];
    const why = [];
    if (offPosPenalty(p.spos, b.j, p) === 0) why.push('his natural side'); else why.push('best fit available');
    if (AA_WHY[strat] && aaTacFit(p, strat, tac.tempo[b.i]) > 0.08) why.push(`${STRATEGIES[strat].name} wants ${AA_WHY[strat]}`);
    if (aaDef(p) && !r.lines[b.i].some(id => id && id !== p.id && aaDef(P(save, id)))) why.push('the line\'s stay-at-home D');
    const cb = condBand(p.cond)[0]; if ((cb === 'Tired' || cb === 'Exhausted') && a && !a.res && b.i > a.i) why.push(`${cb.toLowerCase()} (${Math.round(p.cond)}): fewer minutes tonight`);
    notes.push(`${nm(p)} → line ${b.i + 1} ${slot}: ${why.join(', ')}.`);
  }
  for (let i = 0; i < 3; i++) if (!r.lines[i].some(id => id && aaDef(P(save, id)))) notes.push(`Line ${i + 1} has no D-type player: its best defender plays the anchor role.`);
  return notes;
}
// playing out of position costs a little (the wrong side, or a side player at centre)
function offPosPenalty(spos, role, pl) {
  const want = ['L', 'C', 'R'][role]; if (!spos || !want || role > 2) return 0;
  const side = sideOf(spos); if (side === want) return 0;                   // his own side: at home (a D on his side included)
  let pen;
  if (side === 'C') pen = 0.1;                                               // centres play either side comfortably
  else if (want === 'C') pen = spos === 'LD' || spos === 'RD' ? 0.3 : 0.25;    // a side player taking draws and covering the middle
  else pen = 0.12;                                                           // the wrong side (his stick is on the wrong side)
  if (pl && pl.attrs) {   // attributes that suit the job reduce it (playmaking/faceoffs in the middle; speed/shot on a side)
    const a = pl.attrs, fit = want === 'C' ? ((a.fo || 5) + (a.pas || 5)) / 2 - 5 : ((a.spd || 5) + (a.acc || 5)) / 2 - 5;
    pen *= Math.max(0.3, Math.min(1.2, 1 - fit * 0.12));
  }
  return Math.round(pen * 100) / 100;
}
// how well a player suits a line slot (higher = better): rating minus the off-position cost
const slotFit = (p, j) => overall(p) - offPosPenalty(p.spos, j, p) * 6;
// ---------- jersey numbers: unique per team (reserves included)
function numberTaken(save, team, num, exceptPid) { return orgIds(team).some(id => id !== exceptPid && P(save, id).num === num); }
function freeNumber(save, team, preferred) {
  if (preferred >= 1 && preferred <= 99 && !numberTaken(save, team, preferred)) return preferred;
  const common = [9, 19, 91, 10, 12, 14, 16, 17, 18, 20, 21, 22, 24, 27, 28, 8, 7, 11, 13, 15, 23, 25, 26, 29, 44, 55, 77, 88];
  for (const n of common) if (!numberTaken(save, team, n)) return n;
  for (let n = 1; n <= 99; n++) if (!numberTaken(save, team, n)) return n;
  return 99;
}
function setNumber(save, pid, num) {
  const p = P(save, pid), team = save.teams[p.teamId];
  num = Math.round(+num);
  if (!(num >= 1 && num <= 99)) return 'Numbers go from 1 to 99.';
  if (team && numberTaken(save, team, num, pid)) {
    const other = orgIds(team).map(id => P(save, id)).find(q => q.id !== pid && q.num === num);
    return `#${num} is already worn by ${other.first} ${other.last}. Pick another number.`;
  }
  p.num = num; return null;
}

// ---------- lineup for a match: injured players sit; holes in the lines are filled from healthy reserves, then by double shifts
const isAvailable = p => !!p && p.status === 'active' && !(p.inj && p.inj.g > 0);
function lineupFor(save, teamId, goalieId) {
  const t = save.teams[teamId], r = t.roster;
  const ok = id => id && isAvailable(P(save, id));
  const res = r.reserves.filter(ok).slice();
  const takeRes = role => { if (!res.length) return null; let k = 0, bs = -1e9; res.forEach((id, i) => { const sc = slotFit(P(save, id), role); if (sc > bs) { bs = sc; k = i; } }); return res.splice(k, 1)[0]; };
  const lines = r.lines.map(l => l.map((id, j) => ok(id) ? id : takeRes(j)));
  const extra = lines.flat().filter(Boolean);
  for (const l of lines) for (let j = 0; j < 3; j++) if (!l[j] && extra.length) {        // short-handed: double shift (never twice on one line)
    const c = extra.find(id => !l.includes(id)); l[j] = c || null;
  }
  const gl = r.goalies.filter(ok);
  const gid = goalieId && gl.includes(goalieId) ? goalieId : gl[0] || r.goalies.find(Boolean);
  const L = teamLeaders(t), leaders = {}, lead = { c: null, a: [] };
  if (L.c && ok(L.c)) { leaders[L.c] = 'C'; lead.c = { pid: L.c, style: L.st.c || 'general', resp: respectOf(P(save, L.c), t) }; }
  L.a.forEach((a, i) => { if (a && ok(a)) { leaders[a] = 'A'; lead.a.push({ pid: a, style: L.st['a' + i] || 'champion', resp: respectOf(P(save, a), t) }); } });
  const lineIds = new Set(lines.flat().filter(Boolean));
  return { lines: lines.map(l => l.map(id => id && P(save, id))), goalie: gid ? P(save, gid) : null, leaders, lead,
    bench: res.map(id => P(save, id)), backups: gl.filter(id => id !== gid).map(id => P(save, id)),
    dressed: lineIds.size + res.length, teamId };
}
// ---------- captains: one C, up to two A's, anyone on the roster (a goalie too). Each letter carries a leadership style.
function teamLeaders(t) {
  const L = t.leaders || (t.leaders = { c: null, a: [null, null] });
  if (!L.st) L.st = { c: 'general', a0: 'enforcer', a1: 'champion' };
  return L;
}
function setLeader(save, team, role, pid) {
  const L = teamLeaders(team);
  if (pid) { const p = P(save, pid); if (!p || p.teamId !== team.id) return 'Only players on this roster can wear a letter.'; }
  if (pid) { if (L.c === pid) L.c = null; L.a = L.a.map(x => x === pid ? null : x); }   // one letter per player
  if (role === 'c') L.c = pid || null; else L.a[role === 'a0' ? 0 : 1] = pid || null;
  const slot = role === 'c' ? 'c' : role, cur = L.st[slot];
  if (pid && !availableStyles(save, team, pid).includes(cur)) L.st[slot] = P(save, pid).pos === 'G' ? bestStyleFor(save, team, P(save, pid)) : 'general';
  return null;
}
// ---------- letter changes on your team: free before the season's first game (and in the offseason); after that,
// one free change a season, and every further change costs GM reputation and the room's happiness.
// Filling an empty letter is always free.
function letterSeasonOn(save) { const se = save.season; return !!(se && !se.done && Object.values(se.games).some(g => g.played && g.type === 'reg')); }
function letterChangeInfo(save, team, role, pid) {
  const L = teamLeaders(team), cur = role === 'c' ? L.c : L.a[role === 'a0' ? 0 : 1];
  if (team.id !== save.userTeamId || !cur || cur === pid || !letterSeasonOn(save)) return { free: true, change: false };
  const used = save.season.letterS === save.season.num ? save.season.letterN || 0 : 0;
  return { free: used < 1, change: true, used, cur };
}
function applyLetterChange(save, team, role, pid) {
  const info = letterChangeInfo(save, team, role, pid), err = setLeader(save, team, role, pid);
  if (err || !info.change) return err;
  const se = save.season; if (se.letterS !== se.num) { se.letterS = se.num; se.letterN = 0; }
  se.letterN++;
  const old = P(save, info.cur), d = typeof mDay === 'function' ? mDay(save) : 0;
  if (old && typeof moraleOf === 'function') moraleOf(old).fx.push({ label: 'Lost his letter', v: info.free ? -8 : -15, d, len: 30 });
  if (!info.free) {
    if (typeof gmRep === 'function') gmRep(save, -3);
    if (typeof moraleOf === 'function') for (const id of rosterIds(team)) { const q = P(save, id); if (q && q !== old) moraleOf(q).fx.push({ label: 'The letters keep changing', v: -3, d, len: 12 }); }
  }
  if (typeof pushNews === 'function' && old) pushNews(save, `${old.first} ${old.last} loses his ${role === 'c' ? 'captaincy' : 'A'}` + (pid && P(save, pid) ? ` to ${P(save, pid).first} ${P(save, pid).last}.` : '.'));
  return null;
}
// styles a given leader may use: the four basics, the franchise's unlocks (your team), and his own earned distinctions
function availableStyles(save, team, pid) {
  const p = pid && P(save, pid);
  if (p && p.pos === 'G') { const og = G_BASE_STYLES.slice(); for (const s of p.leadStyles || []) if (!og.includes(s)) og.push(s); return og; }   // goalies: their own styles (+ any he earned)
  const out = BASE_STYLES.slice();
  if (team && team.id === save.userTeamId) for (const s of (save.unlocks && save.unlocks.styles) || []) if (!out.includes(s)) out.push(s);
  for (const s of (p && p.leadStyles) || []) if (!out.includes(s)) out.push(s);
  return out;
}
function setLeaderStyle(save, team, slot, style) {
  const L = teamLeaders(team), pid = slot === 'c' ? L.c : L.a[slot === 'a0' ? 0 : 1];
  if (!LEAD_STYLES[style]) return 'Unknown style.';
  if (!availableStyles(save, team, pid).includes(style)) return 'That style is not unlocked for this player.';
  L.st[slot] = style; return null;
}
// AI (and vacancies on your team): appoint the most established skaters, give each the style that suits him
function bestStyleFor(save, team, p) {
  const a = p.attrs, av = availableStyles(save, team, p.id);
  if (p.pos === 'G') { if (av.includes('legend')) return 'legend'; const sc = { backbone: a.pos, brickwall: a.ref, quarterback: a.reb, rock: a.rec }; return Object.keys(sc).sort((x, y) => sc[y] - sc[x])[0]; }
  if (av.includes('legend')) return 'legend';
  if (av.includes('iron') && p.age >= 31) return 'iron';
  // his own strengths + what the team lacks (team fit)
  const sk = rosterSkaters(team).map(id => P(save, id)).filter(Boolean), avg = k => sk.reduce((x, q) => x + (q.attrs[k] || 5), 0) / Math.max(1, sk.length);
  const spread = Math.max(...['spd', 'pow', 'acc', 'pas', 'def', 'chk'].map(avg)) - Math.min(...['spd', 'pow', 'acc', 'pas', 'def', 'chk'].map(avg));
  const sc = { general: a.def + (a.pas || 5) * 0.5 + spread * 0.6, sharpshooter: a.acc + a.pow * 0.5 + (5.5 - (avg('acc') + avg('pow')) / 2) * 0.8, enforcer: a.chk + a.def * 0.5 + (5.5 - (avg('chk') + avg('def')) / 2) * 0.8, champion: a.sta + 3 + (5.5 - avg('sta')) * 0.6,
    maestro: (a.pas || 5) + (a.stk || 5) * 0.5 + (5.5 - avg('pas')) * 0.8, jet: a.spd + a.sta * 0.4 + (5.5 - avg('spd')) * 0.8, wall: a.def + a.chk * 0.4 + 0.5, spark: (a.stk || 5) + 2.5 };
  return Object.keys(sc).filter(k => av.includes(k)).sort((x, y) => sc[y] - sc[x])[0] || 'general';
}
// experience, accomplishments and rare distinctions make a leader
const leaderScore = p => overall(p) + p.age * 0.12 + (p.seasons ? p.seasons.length : 0) * 0.2 + (hasTrait(p, 'natural_leader') ? 2 : 0) + (p.awards ? p.awards.length : 0) * 0.35 + (p.capTitles ? p.capTitles.length : 0) * 0.6 + (p.leadStyles ? p.leadStyles.length : 0) * 1.2;
function autoLeaders(save, team, onlyVacant) {
  const L = teamLeaders(team);
  const cand = rosterSkaters(team).map(id => P(save, id)).filter(p => p && L.c !== p.id && !L.a.includes(p.id))
    .sort((a, b) => leaderScore(b) - leaderScore(a) || (overall(b) + b.age * 0.12 + (b.seasons ? b.seasons.length : 0) * 0.2 + (hasTrait(b, 'natural_leader') ? 2 : 0)) - (overall(a) + a.age * 0.12 + (a.seasons ? a.seasons.length : 0) * 0.2 + (hasTrait(a, 'natural_leader') ? 2 : 0)));
  const filled = [];
  if (!L.c && cand.length) { const p = cand.shift(); L.c = p.id; filled.push(p); if (team.id !== save.userTeamId || !onlyVacant) L.st.c = bestStyleFor(save, team, p); }
  for (let i = 0; i < 2; i++) if (!L.a[i] && cand.length) { const p = cand.shift(); L.a[i] = p.id; filled.push(p); if (team.id !== save.userTeamId || !onlyVacant) L.st['a' + i] = bestStyleFor(save, team, p); }
  return filled;
}
// STANDING in the room (0-100): rating, age, seasons with this club, games played, awards, titles as captain.
// It grows over a career, so a young star earns it. A leader's bonuses scale with it (room respect).
function standingOf(p, team) {
  if (!p) return 0;
  const tid = team ? team.id : p.teamId, ten = (p.seasons || []).filter(e => e.teamId === tid).length, gp = p.career ? lifetime(p.career).gp : 0;
  return Math.round(clampF(clampF((ovrInt(p) - 45) / 40, 0, 1) * 40 + clampF((p.age - 18) / 12, 0, 1) * 20 + Math.min(5, ten) * 3
    + clampF(gp / 400, 0, 1) * 10 + Math.min(3, (p.awards || []).length) * 3 + Math.min(3, (p.capTitles || []).length) * 2 + (hasTrait(p, 'natural_leader') ? 10 : 0), 0, 100));
}
const respectOf = (p, team) => clampF(0.4 + standingOf(p, team) / 70, 0.4, 1.1);   // ~42 standing = full strength
const standTier = v => v >= 70 ? 'RESPECTED VETERAN' : v >= 50 ? 'ESTABLISHED' : v >= 30 ? 'FINDING HIS VOICE' : 'TOO GREEN';
const leaderOf = (t, pid) => !t || !t.leaders ? null : t.leaders.c === pid ? 'C' : t.leaders.a.includes(pid) ? 'A' : null;

// ---------- teams
function teamIdentity(t) { return { id: t.id, city: t.city, nick: t.nick, abbr: t.abbr, colors: { ...t.colors }, style: t.style, emblem: t.emblem, trim: t.trim || null, logo: t.logo ? { ...t.logo } : null, kits: t.kits ? JSON.parse(JSON.stringify(t.kits)) : null }; }
function teamStrength(save, teamId) {
  const lu = lineupFor(save, teamId);
  const sk = lu.lines.flat().filter(Boolean);
  return sk.reduce((a, p) => a + overall(p), 0) / Math.max(1, sk.length) * 0.75 + (lu.goalie ? overall(lu.goalie) : 4) * 0.25;
}
const AI_STRATS = ['contend', 'youth', 'balanced', 'balanced'];
function makeLeagueTeam(save, id, rng) {
  const d = DEFAULT_TEAMS[id];
  const t = Object.assign(teamIdentity(d), { defaults: teamIdentity(d), roster: emptyRoster(), ai: { strat: pickR(AI_STRATS, rng) } });
  teamLeaders(t);
  save.teams[id] = t;
  return t;
}
// Quick Play (no franchise): stable default rosters
function defaultLineup(teamId) {
  const rng = mulberry32(hashStr('default-' + teamId));
  const fake = { nextId: { p: 1 }, players: {}, teams: {} };
  const d = DEFAULT_TEAMS[teamId];
  const t = Object.assign(teamIdentity(d), { roster: emptyRoster() });
  fake.teams[teamId] = t;
  for (let k = 0; k < 12; k++) { const p = genPlayer(rng, 'S', { q: 5.2 + (k < 6 ? 0.5 : -0.5), spos: SPOS[k % 3] }); p.id = 'q-' + teamId + '-' + k; fake.players[p.id] = p; addToRoster(fake, t, p.id); }
  for (let k = 0; k < 3; k++) { const p = genPlayer(rng, 'G', { q: 6 - k }); p.id = 'q-' + teamId + '-g' + k; fake.players[p.id] = p; addToRoster(fake, t, p.id); }
  autoArrange(fake, t); autoLeaders(fake, t);
  return lineupFor(fake, teamId);
}

// ---------- franchise creation: 24 empty franchises, one shared player pool, the Inaugural League Draft
function newFranchise(opts) {
  const rng = mulberry32((Math.random() * 2 ** 31) | 0);
  const save = {
    format: SAVE_FORMAT, version: SAVE_VERSION, id: newUid(), name: opts.name || 'My Franchise',
    created: Date.now(), lastPlayed: Date.now(), userTeamId: opts.teamId, seasonNum: 1,
    nextId: { p: 1, g: 1, t: 1, a: 1, c: 1, m: 1, x: 1 }, teamOrder: LEAGUE_TEAM_IDS.slice(), teams: {}, players: {},
    season: null, history: [], trophies: [], awards: [], draftHistory: [], draft: null, news: [],
    exhibition: { gp: 0, w: 0, l: 0 }, clips: {}, introsSeen: {}, milestones: [],
    ach: {}, achProg: {}, unlocks: { styles: [] }, memorabilia: [], tx: [], debug: null,
  };
  for (const id of save.teamOrder) makeLeagueTeam(save, id, rng);
  // a re-rolled league: the other teams' new identities (the original names stay as their 'defaults')
  if (opts.league) for (const id in opts.league) if (save.teams[id] && id !== opts.teamId) Object.assign(save.teams[id], teamIdentity(Object.assign({}, opts.league[id], { id })));
  if (opts.identity) Object.assign(save.teams[opts.teamId], clone(opts.identity), { id: opts.teamId });
  createInauguralDraft(save, rng);
  newSeason(save);
  return save;
}

// ====================================================================
//  INAUGURAL LEAGUE DRAFT (once per new franchise save)
//  11 snake rounds (9 skaters: 3 LW, 3 C, 3 RW + 2 goalies), then you make 4 final picks (3 skaters + 1 goalie),
//  then the remaining players are shared out so every franchise has 12 skaters and 3 goalies.
// ====================================================================
const D0_ROUNDS = 11, D0_NEED = { S: 9, G: 2 };
const d0Team = d => d.order[d.round % 2 === 0 ? d.idx : d.order.length - 1 - d.idx];
const d0Slot = p => p.pos === 'G' ? 'G' : 'S';
function d0Counts(save, teamId) {
  const c = { S: 0, G: 0, LW: 0, C: 0, RW: 0, LD: 0, RD: 0 };
  for (const id of rosterIds(save.teams[teamId])) { const p = P(save, id); c[d0Slot(p)]++; if (p.pos !== 'G') c[p.spos]++; }
  return c;
}
// what this franchise still has to draft in the first 11 rounds, and how many picks it has left
function d0Needs(save, teamId) {
  const c = d0Counts(save, teamId), d = save.draft0;
  const made = c.S + c.G, left = D0_ROUNDS - made;
  const need = {}; for (const k in D0_NEED) need[k] = Math.max(0, D0_NEED[k] - c[k]);
  return { counts: c, need, left, total: Object.values(need).reduce((a, b) => a + b, 0) };
}
function d0Legal(save, teamId, pid) {
  const d = save.draft0, p = P(save, pid);
  if (!d || d.done) return 'The draft is over.';
  if (!p || p.status !== 'pool') return 'That player has already been drafted.';
  if (d.phase === 'final') {
    if (teamId !== save.userTeamId) return 'Only you make the final picks.';
    const k = p.pos === 'G' ? 'G' : 'S';
    if (!d.finalLeft[k]) return k === 'G' ? 'You already have your third keeper.' : 'You already have 12 players.';
    return null;
  }
  const n = d0Needs(save, teamId), k = d0Slot(p);
  if (n.left <= 0) return 'No picks left in these rounds.';
  const after = n.total - (n.need[k] > 0 ? 1 : 0);
  if (after > n.left - 1) return `You still need ${Object.entries(n.need).filter(([, v]) => v).map(([k2, v]) => v + ' ' + k2).join(', ')} with ${n.left} pick${n.left === 1 ? '' : 's'} left.`;
  return null;
}
function d0Advance(d, T) { d.idx++; if (d.idx >= T) { d.idx = 0; d.round++; } if (d.round >= D0_ROUNDS) d.phase = 'final'; }
function draft0Pick(save, pid, teamId) {
  const d = save.draft0;
  teamId = teamId || (d.phase === 'final' ? save.userTeamId : d0Team(d));
  const err = d0Legal(save, teamId, pid); if (err) return err;
  const p = P(save, pid), team = save.teams[teamId];
  d.pool.splice(d.pool.indexOf(pid), 1);
  p.status = 'active'; p.num = 0;
  d.recent = (d.recent || []).concat([p.pos === 'G' ? 'G' : p.spos]).slice(-4);
  addToRoster(save, team, pid);
  const no = d.picks.length + 1;
  d.picks.push({ no, r: d.phase === 'final' ? 12 : d.round + 1, teamId, pid, name: p.first + ' ' + p.last, pos: posLabel(p), ovr: ovrInt(p), user: teamId === save.userTeamId });
  logTx(save, 'draft0', { pid, teamId, no });
  if (d.phase === 'final') { d.finalLeft[p.pos === 'G' ? 'G' : 'S']--; if (!d.finalLeft.S && !d.finalLeft.G) draft0Distribute(save); }
  else d0Advance(d, d.order.length);
  return null;
}
// AI franchises pick until it is your turn (or the first eleven rounds end)
function draft0SimToUser(save, maxPicks = 1e9) {
  const d = save.draft0; let n = 0;
  if (d.needSlot) return 0;
  while (!d.done && d.phase === 'main' && d0Team(d) !== save.userTeamId && n < maxPicks) {
    const tid = d0Team(d), pid = d0Choose(save, tid);
    if (!pid) { d0Advance(d, d.order.length); continue; }
    draft0Pick(save, pid, tid); n++;
  }
  return n;
}
// everyone else gets the remaining players: weakest rosters choose first, by need
function draft0Distribute(save) {
  const d = save.draft0; if (d.done) return;
  const others = save.teamOrder.filter(id => id !== save.userTeamId);
  for (let guard = 0; guard < 200; guard++) {
    const needy = others.filter(id => rosterSkaters(save.teams[id]).length < 12 || rosterGoalies(save.teams[id]).length < 3);
    if (!needy.length) break;
    needy.sort((a, b) => teamStrength(save, a) - teamStrength(save, b));
    for (const id of needy) {
      const t = save.teams[id], needS = rosterSkaters(t).length < 12, needG = rosterGoalies(t).length < 3;
      const cands = d.pool.map(x => P(save, x)).filter(p => (p.pos === 'G' ? needG : needS));
      if (!cands.length) continue;
      const pick = cands.map(p => [p, d0Value(save, t, p)]).sort((a, b) => b[1] - a[1])[0][0];
      d.pool.splice(d.pool.indexOf(pick.id), 1); pick.status = 'active'; pick.num = 0;
      addToRoster(save, t, pick.id);
      d.picks.push({ no: d.picks.length + 1, r: 13, teamId: id, pid: pick.id, name: pick.first + ' ' + pick.last, pos: posLabel(pick), ovr: ovrInt(pick), user: false, alloc: true });
      logTx(save, 'alloc', { pid: pick.id, teamId: id });
    }
  }
  for (const pid of d.pool) { const p = P(save, pid); p.status = 'free'; p.freeSince = 1; }
  d.pool = []; d.done = true; d.phase = 'done';
  if (typeof initContracts === 'function') initContracts(save);
  for (const id of save.teamOrder) {
    const t = save.teams[id];
    for (const pid of rosterIds(t)) { const p = P(save, pid); p.num = 0; }
    for (const pid of rosterIds(t)) { const p = P(save, pid); p.num = freeNumber(save, t, pickR([9, 10, 12, 14, 17, 19, 21, 22, 27, 44, 88, 91, 8, 7], Math.random)); }
    autoArrange(save, t); autoLeaders(save, t);
  }
  for (const pk of d.picks.filter(x => x.user)) save.draftHistory.push({ season: 0, teamId: pk.teamId, teamName: fullName(save.teams[pk.teamId]), pid: pk.pid, name: pk.name, type: 'Inaugural draft #' + pk.no, user: true });
  // compact the pick log for the record: keep yours, the first round, and a short summary
  d.picks = d.picks.filter(x => x.user || x.r === 1).map(x => ({ no: x.no, r: x.r, teamId: x.teamId, pid: x.pid, name: x.name, pos: x.pos, ovr: x.ovr, user: x.user }));
  if (typeof lgMedian === 'function') { save.lgBase = lgMedian(save); save.lgBaseG = lgGoalieMedian(save); }
  pushNews(save, 'The Inaugural League Draft is complete. Welcome to season one!');
}
// tests / debug: run the whole inaugural draft automatically (your picks too)
function draft0AutoAll(save) {
  const d = save.draft0;
  if (d.needSlot) d0SetSlot(save, ri(1, d.order.length), 'lottery');
  for (let g = 0; g < 1000 && !d.done; g++) {
    if (d.phase === 'main') { if (d0Team(d) === save.userTeamId) draft0Pick(save, d0Choose(save, save.userTeamId), save.userTeamId); else draft0SimToUser(save); }
    else if (d.phase === 'final') { const pid = d0Choose(save, save.userTeamId); if (!pid) { draft0Distribute(save); break; } draft0Pick(save, pid, save.userTeamId); }
  }
}
// transaction log (ownership history; groundwork for trades / free agency). Compact: [season, kind, pid, teamId]
// every transaction: a bounded league feed (recent) + a permanent, compact line on the player himself
function logTx(save, kind, o) {
  const s = save.season ? save.season.num : save.seasonNum;
  save.tx = save.tx || [];
  save.tx.push([s, kind, o.pid || null, o.teamId || null, o.from || null]);
  if (save.tx.length > 1700) vaultPush(save, 'tx', save.tx.splice(0, save.tx.length - 1500));   // older entries move to the vault in batches (kept, just not shown)
  const p = o.pid && save.players[o.pid];
  if (p) { const e = [s, kind, o.teamId || null]; if (o.from || o.sal) e.push(o.from || null); if (o.sal) e.push(o.sal + 'x' + (o.yrs || 1)); (p.txh = p.txh || []).push(e); if (p.txh.length > 40) p.txh.splice(1, p.txh.length - 40); }
}

// ---------- season & schedule
// 24 regular-season rounds; every franchise plays once per round. Tournaments interleave; the playoffs and the
// Tournament of Champions close the season. Mandatory for you: the Opening Invitational, and the playoffs if you qualify.
const N_ROUNDS = 24;
const CALENDAR = ['r0', 'r1', 'r2', 'inv', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'classic', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14', 'winter',
  'r15', 'r16', 'r17', 'r18', 'r19', 'r20', 'r21', 'finale', 'r22', 'r23', 'po', 'toc', 'end'];
const OPTIONAL_COMPS = ['classic', 'winter', 'finale', 'toc'];
const CHAMP_KEYS = ['inv', 'classic', 'winter', 'finale', 'po'];   // titles that qualify a team for the Tournament of Champions
const choiceOf = (se, k) => k === 'toc' ? se.tocChoice : (se.optIn || {})[k];
function setChoice(se, k, v) { if (k === 'toc') se.tocChoice = v; else (se.optIn = se.optIn || {})[k] = v; }
const declinedComp = (save, k) => OPTIONAL_COMPS.includes(k) && choiceOf(save.season, k) === 'decline';
const isByeFormat = c => false;            // (the old six-team Classic format no longer exists)
const COMP_INFO = {
  inv:     { name: 'Opening Invitational', trophy: 'inv',     type: 'tour', month: 'OCT', yearOff: 0, size: 8 },
  classic: { name: 'Midseason Classic',    trophy: 'classic', type: 'tour', month: 'DEC', yearOff: 0, size: 8 },
  winter:  { name: 'Winter Cup',           trophy: 'winter',  type: 'tour', month: 'FEB', yearOff: 1, size: 4 },
  finale:  { name: 'Season Finale Cup',    trophy: 'finale',  type: 'tour', month: 'MAR', yearOff: 1, size: 4 },
  po:      { name: 'League Championship',  trophy: 'league',  type: 'po',   month: 'APR', yearOff: 1, size: 16 },
  toc:     { name: 'Tournament of Champions', trophy: 'toc',   type: 'tour', month: 'MAY', yearOff: 1, size: 8 },
};
const TOUR_KEYS = ['inv', 'classic', 'winter', 'finale', 'toc'];
function roundRobin(ids) {
  const t = ids.slice(), n = t.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) { const a = t[i], b = t[n - 1 - i]; pairs.push((r + i) % 2 ? [a, b] : [b, a]); }
    rounds.push(pairs);
    t.splice(1, 0, t.pop());                      // rotate all but the first
  }
  return rounds;
}
function newGameRec(save, o) {
  const id = 'g' + (save.nextId.g++);
  const g = Object.assign({ id, home: null, away: null, hs: null, as: null, ot: false, so: false, played: false }, o);
  save.season.games[id] = g; return g;
}
// random realignment into 2 conferences x 2 divisions x 6 teams
function realign(save, rng = Math.random) {
  const ids = save.teamOrder.slice();
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const divs = [0, 1, 2, 3].map(d => ids.slice(d * 6, d * 6 + 6));
  const divOf = {}; divs.forEach((d, i) => d.forEach(id => divOf[id] = i));
  return { divs, divOf };
}
const confOf = (se, id) => Math.floor(se.divOf[id] / 2);
// 24 rounds: 10 divisional (5 opponents twice), 6 vs the other division of the conference, 8 cross-conference (rotating)
function buildSchedule(se, seasonNum, rng = Math.random) {
  const rounds = [];
  const divRounds = se.divs.map(d => { const f = roundRobin(d); return f.concat(f.map(pr => pr.map(([h, a]) => [a, h]))); });
  for (let r = 0; r < 10; r++) rounds.push([].concat(...divRounds.map(dr => dr[r])));
  for (let k = 0; k < 6; k++) {
    const rd = [];
    for (const c of [0, 1]) { const A = se.divs[c * 2], B = se.divs[c * 2 + 1]; for (let i = 0; i < 6; i++) { const a = A[i], b = B[(i + k) % 6]; rd.push(k % 2 === 0 ? [a, b] : [b, a]); } }
    rounds.push(rd);
  }
  const X = se.divs[0].concat(se.divs[1]), Y = se.divs[2].concat(se.divs[3]), start = (seasonNum * 8) % 12;
  for (let j = 0; j < 8; j++) {
    const off = (start + j) % 12, rd = [];
    for (let i = 0; i < 12; i++) { const a = X[i], b = Y[(i + off) % 12]; rd.push(j % 2 === 0 ? [a, b] : [b, a]); }
    rounds.push(rd);
  }
  for (let i = rounds.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rounds[i], rounds[j]] = [rounds[j], rounds[i]]; }
  return rounds;
}
function newSeason(save) {
  const num = save.seasonNum, year = START_YEAR + num - 1;
  const al = realign(save);
  // realignment announcement + permanent alignment history (division index per team, per season)
  save.alignHist = save.alignHist || [];
  save.alignHist.push({ s: num, divOf: Object.assign({}, al.divOf) }); if (save.alignHist.length > 200) save.alignHist.shift();
  if (save.teams && save.userTeamId && num > 1) { const d = al.divOf[save.userTeamId]; pushNews(save, `REALIGNMENT: your club joins the ${DIV_NAMES[d]} (${CONF_NAMES[d < 2 ? 0 : 1]}) with ${al.divs[d].filter(x => x !== save.userTeamId).map(x => save.teams[x].abbr).join(', ')}.`); save.alignNews = num; }
  save.season = { num, year, calIdx: 0, games: {}, rounds: [], standings: {}, comps: {}, stats: {}, done: false, divs: al.divs, divOf: al.divOf, dayNo: 0, teamStats: {}, alts: {} };
  for (const id of save.teamOrder) { save.season.standings[id] = { gp: 0, w: 0, l: 0, otl: 0, pts: 0, gf: 0, ga: 0, rw: 0 }; save.season.teamStats[id] = { ppo: 0, ppg: 0, pk: 0, pkga: 0, pim: 0, fights: 0, eng: 0 }; }
  buildSchedule(save.season, num).forEach((pairs, r) => save.season.rounds.push(pairs.map(([h, a]) => newGameRec(save, { type: 'reg', comp: null, home: h, away: a, label: 'Game day ' + (r + 1) }).id)));
  if (save.userTeamId && save.teams && typeof announceClass === 'function') announceClass(save);
}
// deterministic standings: points, regulation wins, wins, goal difference, goals for, head-to-head points, then name
function h2hPts(save, a, b) {
  let pa = 0, pb = 0;
  for (const g of Object.values(save.season.games)) {
    if (!g.played || g.type !== 'reg') continue;
    if (!((g.home === a && g.away === b) || (g.home === b && g.away === a))) continue;
    const aw = (g.home === a) === (g.hs > g.as);
    if (aw) { pa += 2; if (g.ot || g.so) pb += 1; } else { pb += 2; if (g.ot || g.so) pa += 1; }
  }
  return pa - pb;
}
function standCmp(save) {
  const st = save.season.standings;
  return (a, b) => st[b].pts - st[a].pts || (st[b].rw || 0) - (st[a].rw || 0) || st[b].w - st[a].w || (st[b].gf - st[b].ga) - (st[a].gf - st[a].ga) || st[b].gf - st[a].gf || -h2hPts(save, a, b) || (a < b ? -1 : 1);
}
function sortedStandings(save, ids) { return (ids || save.teamOrder).slice().sort(standCmp(save)); }
const divStandings = (save, d) => sortedStandings(save, save.season.divs[d]);
const confStandings = (save, c) => sortedStandings(save, save.season.divs[c * 2].concat(save.season.divs[c * 2 + 1]));

// ---------- competitions (tournaments + playoffs)
function newSeries(save, hi, lo, bestOf) { return { id: 's' + (save.nextId.g++), hi, lo, bestOf, winsHi: 0, winsLo: 0, gids: [], winner: null }; }
const BRACKET_PAIRS = { 2: [[0, 1]], 4: [[0, 3], [1, 2]], 8: [[0, 7], [3, 4], [1, 6], [2, 5]] };
function bestOfFor(c, roundIdx) {
  if (c.key === 'po') return 5;
  const total = Math.log2(c.seeds.length);
  if ((c.key === 'winter' || c.key === 'toc') && roundIdx === total - 1) return 3;
  return 1;
}
function compField(save, key) {
  const user = save.userTeamId, st = sortedStandings(save), size = COMP_INFO[key].size;
  const out = declinedComp(save, key);
  const others = st.filter(t => t !== user);
  if (key === 'inv' && false) {          // (the old 8-team draw; the Invitational is now every club: invStartGroups)
    const byStrength = save.teamOrder.slice().sort((a, b) => teamStrength(save, b) - teamStrength(save, a));
    const rnd = byStrength.filter(t => t !== user).sort(() => Math.random() - 0.5).slice(0, size - 1);
    return [user].concat(rnd).sort((a, b) => byStrength.indexOf(a) - byStrength.indexOf(b));
  }
  if (key === 'toc') return tocField(save).seeds;
  // Classic / Winter Cup / Finale: the top of the standings when the event begins (you only if you qualified and accepted)
  return st.filter(t => !(t === user && out)).slice(0, size).sort((a, b) => st.indexOf(a) - st.indexOf(b));
}
// does this team qualify for an optional event right now (standings-based)?
function qualifiesFor(save, key, teamId) {
  if (key === 'toc') return teamId === save.userTeamId ? userQualifies(save) : tocField(save).seeds.includes(teamId);
  if (!['classic', 'winter', 'finale'].includes(key)) return true;
  return sortedStandings(save).indexOf(teamId) < COMP_INFO[key].size;
}
// projections for an upcoming event: who is in, who is on the bubble (updates as the standings move)
function compProjection(save, key) {
  const st = sortedStandings(save), size = COMP_INFO[key].size;
  if (key === 'po') {
    const divs = save.season.divs.map((d, i) => { const ds = divStandings(save, i); return { div: i, in: ds.slice(0, 4), bubble: ds.slice(4, 6) }; });
    return { divs, rule: 'Top four in each division', size: 16 };
  }
  if (key === 'toc') { const f = tocField(save); return { in: f.seeds, bubble: st.filter(id => !f.seeds.includes(id)).slice(0, 3), rule: 'This season\'s champions, then the best remaining teams', size: 8 }; }
  if (key === 'inv') return { in: save.teamOrder.slice(), bubble: [], rule: 'Every club: six groups of four, then an eight-team knockout', size: 24 };
  return { in: st.slice(0, size), bubble: st.slice(size, size + 3), edge: st.slice(Math.max(0, size - 2), size), rule: `Top ${size} in the league standings when it begins`, size };
}
function createComp(save, key) {
  const se = save.season, user = save.userTeamId;
  const c = { key, name: COMP_INFO[key].name, seeds: [], rounds: [], done: false, champion: null, runnerUp: null, mvp: null, stats: {}, finalSeries: null };
  if (key === 'po') {
    // top four of each division; first round 1v4 & 2v3 inside the division; division final; conference final; final.
    const overall = sortedStandings(save);
    const q = [0, 1, 2, 3].map(d => divStandings(save, d).slice(0, 4));
    c.seeds = q.flat().sort((a, b) => overall.indexOf(a) - overall.indexOf(b));
    c.divSeeds = q;
    const better = (a, b) => overall.indexOf(a) < overall.indexOf(b) ? [a, b] : [b, a];
    const r0 = [];
    for (const d of q) { for (const [i, j] of [[0, 3], [1, 2]]) { const [hi, lo] = better(d[i], d[j]); r0.push(newSeries(save, hi, lo, 5)); } }
    c.rounds.push(r0);
  } else if (key === 'inv') {
    invStartGroups(save, c);
  } else {
    c.seeds = compField(save, key);
    if (key === 'toc') { const f = tocField(save); c.qual = f.qual; c.declined = f.declined; }
    else if (declinedComp(save, key)) c.declined = user;
    c.rounds.push(BRACKET_PAIRS[c.seeds.length].map(([i, j]) => newSeries(save, c.seeds[i], c.seeds[j], bestOfFor(c, 0))));
  }
  se.comps[key] = c;
  return c;
}
// ---------- THE OPENING INVITATIONAL: every club. Six groups of four (drawn from four pots by strength, so each group gets
// one team from each pot), a single round robin (3 game days), then the six group winners and the two best runners-up play
// an eight-team knockout. Points: win 2, overtime / shootout loss 1. Ties on points: goal difference, then goals for.
// Making the knockout pays INV_BONUS.ko; the champion gets an edge at the next Rookie Draft (INV_BONUS.draftUp spots).
const INV_BONUS = { ko: 300, draftUp: 3, scout: 3 };
const GROUP_LETTERS = 'ABCDEF';
function invStartGroups(save, c) {
  const byStr = save.teamOrder.slice().sort((a, b) => teamStrength(save, b) - teamStrength(save, a));
  const pots = [0, 1, 2, 3].map(k => byStr.slice(k * 6, k * 6 + 6).sort(() => Math.random() - 0.5));
  c.format = 'groups'; c.stage = 'groups'; c.gr = 0; c.field = byStr.slice();
  c.groups = [0, 1, 2, 3, 4, 5].map(g => pots.map(p => p[g]));
  c.groupRounds = [0, 1, 2].map(() => []);
  c.groups.forEach((grp, gi) => roundRobin(grp).forEach((pairs, r) => pairs.forEach(([a, b]) => { const sr = newSeries(save, a, b, 1); sr.grp = gi; c.groupRounds[r].push(sr); })));
}
function groupTable(save, c, gi) {
  const rows = c.groups[gi].map(id => ({ id, gp: 0, w: 0, otl: 0, l: 0, gf: 0, ga: 0, pts: 0 })), R = id => rows.find(x => x.id === id);
  for (const sr of c.groupRounds.flat()) {
    if (sr.grp !== gi) continue;
    for (const gid of sr.gids) {
      const g = save.season.games[gid]; if (!g || !g.played) continue;
      const hw = g.hs > g.as, W = R(hw ? g.home : g.away), L = R(hw ? g.away : g.home);
      for (const [id, gf, ga] of [[g.home, g.hs, g.as], [g.away, g.as, g.hs]]) { const x = R(id); x.gp++; x.gf += gf; x.ga += ga; }
      W.w++; W.pts += 3; L.l++;   // SOCCER: cup groups have no draws (extra time decides it), 3 for a win
    }
  }
  const str = id => c.field.indexOf(id);
  return rows.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || str(a.id) - str(b.id));
}
const groupCmp = (a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf;
function invStartKO(save, c) {
  const tabs = c.groups.map((_, gi) => groupTable(save, c, gi));
  const winners = tabs.map(t => t[0]).sort(groupCmp), runners = tabs.map(t => t[1]).sort(groupCmp);
  const qual = winners.concat(runners.slice(0, 2));
  c.seeds = qual.map(r => r.id);
  // no rematch of a group game in the quarterfinals: a wildcard drawn against its own group winner swaps with the other one
  const grpOf = id => c.groups.findIndex(g => g.includes(id));
  if (grpOf(c.seeds[0]) === grpOf(c.seeds[7]) || grpOf(c.seeds[1]) === grpOf(c.seeds[6])) [c.seeds[6], c.seeds[7]] = [c.seeds[7], c.seeds[6]];
  c.groupWin = tabs.map(t => t[0].id); c.wild = runners.slice(0, 2).map(r => r.id);
  c.stage = 'ko';
  c.rounds.push(BRACKET_PAIRS[8].map(([i, j]) => newSeries(save, c.seeds[i], c.seeds[j], bestOfFor(c, 0))));
  for (const id of c.seeds) if (typeof ledger === 'function') ledger(save.teams[id], 'tour', INV_BONUS.ko);
  const u = save.userTeamId;
  pushNews(save, `OPENING INVITATIONAL: the knockout field is set. Group winners: ${c.groupWin.map(id => save.teams[id].abbr).join(', ')}. Wildcards: ${c.wild.map(id => save.teams[id].abbr).join(', ')}.`);
  if (c.seeds.includes(u)) pushNews(save, `You made the Invitational knockout stage: a $${INV_BONUS.ko}K bonus is paid in.`);
  else pushNews(save, 'Your club went out in the Invitational group stage.');
}
const seedOf = (c, t) => c.seeds.indexOf(t);
function nextRound(save, c) {
  const last = c.rounds[c.rounds.length - 1], winners = last.map(x => x.winner);
  if (last.length < 2) return false;
  const r = [];
  for (let k = 0; k < winners.length; k += 2) {
    const a = winners[k], b = winners[k + 1];
    const [hi, lo] = seedOf(c, a) < seedOf(c, b) ? [a, b] : [b, a];
    r.push(newSeries(save, hi, lo, bestOfFor(c, c.rounds.length)));
  }
  c.rounds.push(r);
  return true;
}
// Tournament of Champions: eight unique teams. This season's champions (four cups + the league title) first, one entry each,
// then the best remaining teams in the standings. If you qualify you may decline; your place goes to the next eligible team.
function tocField(save) {
  const se = save.season, st = sortedStandings(save), user = save.userTeamId;
  const declined = se.tocChoice === 'decline' ? user : null;
  const qual = {}, field = [];
  for (const k of CHAMP_KEYS) {
    const c = se.comps[k]; if (!c || !c.done) continue;
    if (qual[c.champion]) { qual[c.champion].titles.push(COMP_INFO[k].name); continue; }
    if (c.champion === declined) continue;
    qual[c.champion] = { how: 'champion', titles: [COMP_INFO[k].name] }; field.push(c.champion);
  }
  let replaced = false;
  for (const id of st) {
    if (field.length >= 8) break;
    if (field.includes(id) || id === declined) continue;
    const how = declined && !replaced && userQualifies(save) ? 'replacement' : 'wildcard';
    if (how === 'replacement') replaced = true;
    qual[id] = { how, place: st.indexOf(id) + 1 };
    field.push(id);
  }
  const seeds = field.slice(0, 8).sort((a, b) => (qual[a].how === 'champion' ? 0 : 1) - (qual[b].how === 'champion' ? 0 : 1) || st.indexOf(a) - st.indexOf(b));
  return { seeds, qual, declined };
}
function userQualifies(save) {
  const se = save.season, user = save.userTeamId;
  const uniq = [...new Set(CHAMP_KEYS.map(k => se.comps[k] && se.comps[k].done ? se.comps[k].champion : null).filter(Boolean))];
  if (uniq.includes(user)) return true;
  return sortedStandings(save).filter(id => !uniq.includes(id)).slice(0, Math.max(0, 8 - uniq.length)).includes(user);
}
// higher seed hosts: best-of-5 games 1, 2, 5 (2-2-1); best-of-3 games 1 and 3; single games
const hostsHi = (bestOf, n) => bestOf === 5 ? [1, 2, 5].includes(n) : bestOf === 3 ? n !== 2 : true;
function compPendingGames(save, c) {
  if (c.stage === 'groups') {
    for (let guard = 0; guard < 4 && c.stage === 'groups'; guard++) {
      const cur = c.groupRounds[c.gr];
      if (cur.every(sr => sr.winner)) { c.gr++; if (c.gr >= c.groupRounds.length) invStartKO(save, c); continue; }
      const out = [];
      for (const sr of cur) {
        if (sr.winner) continue;
        let g = sr.gids.map(id => save.season.games[id]).find(x => !x.played);
        if (!g) { g = newGameRec(save, { type: 'tour', comp: c.key, seriesId: sr.id, home: sr.hi, away: sr.lo, label: `${c.name} Group ${GROUP_LETTERS[sr.grp]} (game ${c.gr + 1} of 3)` }); sr.gids.push(g.id); }
        out.push(g.id);
      }
      return out;
    }
  }
  for (let guard = 0; guard < 6; guard++) {
    const cur = c.rounds[c.rounds.length - 1];
    if (cur.every(sr => sr.winner)) { if (!nextRound(save, c)) { finalizeComp(save, c); return []; } continue; }
    const out = [], roundName = roundNameOf(c, c.rounds.length - 1);
    for (const sr of cur) {
      if (sr.winner) continue;
      let g = sr.gids.map(id => save.season.games[id]).find(x => !x.played);
      if (!g) {
        const n = sr.gids.length + 1, homeHi = COMP_INFO[c.key].type === 'tour' ? n % 2 === 1 : hostsHi(sr.bestOf, n);   // tournaments: the higher seed hosts game 1, then home alternates
        g = newGameRec(save, { type: COMP_INFO[c.key].type, comp: c.key, seriesId: sr.id, home: homeHi ? sr.hi : sr.lo, away: homeHi ? sr.lo : sr.hi,
          label: c.name + ' ' + roundName + (sr.bestOf > 1 ? ' - Game ' + n : '') });
        sr.gids.push(g.id);
      }
      out.push(g.id);
    }
    return out;
  }
  return [];
}
const compTotalRounds = c => c.seeds.length ? Math.round(Math.log2(c.seeds.length)) : 3;
function roundNameOf(c, r) {
  const fromEnd = compTotalRounds(c) - 1 - r;
  return fromEnd === 0 ? 'Final' : fromEnd === 1 ? 'Semifinal' : fromEnd === 2 ? 'Quarterfinal' : 'First Round';
}
// where a game sits in its competition: tier 0 early round, 1 semifinal, 2 championship final
function gameStage(save, g) {
  if (!g || !g.comp) return { key: 'reg', tier: 0, round: 'Regular Season', final: false };
  const c = save.season.comps[g.comp]; if (!c) return { key: g.comp, tier: 0, round: '', final: false };
  const gsr = (c.groupRounds || []).flat().find(sr => sr.id === g.seriesId);
  if (gsr) return { key: c.key, tier: 0, round: 'Group ' + GROUP_LETTERS[gsr.grp], final: false, r: -1, total: 3, series: gsr, group: gsr.grp, editionId: 's' + save.season.num + '-' + c.key };
  const total = compTotalRounds(c);
  let r = 0; c.rounds.forEach((rd, i) => { if (rd.some(sr => sr.id === g.seriesId)) r = i; });
  const fromEnd = total - 1 - r;
  const round = fromEnd === 0 ? 'Championship Final' : fromEnd === 1 ? 'Semifinal' : fromEnd === 2 ? 'Quarterfinal' : 'First Round';
  const sr = findSeries(c, g.seriesId);
  return { key: c.key, tier: fromEnd === 0 ? 2 : fromEnd === 1 ? 1 : 0, round, final: fromEnd === 0, r, total, series: sr, editionId: 's' + save.season.num + '-' + c.key };
}
// would this game end the competition if `teamId` wins it?
function clinchesIfWin(save, g, teamId) {
  const st = gameStage(save, g); if (!st.final || !st.series) return false;
  const sr = st.series, need = Math.ceil(sr.bestOf / 2);
  return (teamId === sr.hi ? sr.winsHi : sr.winsLo) + 1 >= need;
}
function findSeries(c, id) { for (const r of (c.groupRounds || []).concat(c.rounds)) for (const s of r) if (s.id === id) return s; return null; }
const compSeriesAll = c => (c.groupRounds || []).concat(c.rounds).flat();     // every series, group games included
const compTeams = c => c.field || c.seeds;                                      // everyone taking part (the Invitational: all 24)
// competition / playoff MVP: summed Game Impact over the competition, a bonus for the champions
function compScore(l, onChamp) {
  if (l.gpi) return (l.imp || 0) / 10 + (onChamp ? 1.5 : 0);
  return (l.g * 1.5 + l.a + l.pm * 0.3 + l.hit * 0.03) + (l.sa ? l.sv * 0.06 + l.w * 1.2 - l.ga * 0.25 : 0) + (onChamp ? 1.5 : 0);   // pre-v3 lines
}
function playerSnap(save, pid, line, teamId) {
  const p = P(save, pid), t = save.teams[teamId || p.teamId];
  return { pid, name: p.first + ' ' + p.last, num: p.num, pos: p.pos, teamId: t ? t.id : null, teamName: t ? fullName(t) : '', abbr: t ? t.abbr : '', stat: statString(p.pos, line) };
}
function statString(pos, l) {
  if (pos === 'G') return `${l.w}W, ${fmtSv(svPct(l))} SV%, ${l.sv} SV`;
  return `${l.g}G ${l.a}A ${l.g + l.a}PTS` + (l.pm ? ` ${l.pm > 0 ? '+' : ''}${l.pm}` : '');
}
function finalizeComp(save, c) {
  if (c.done) return;
  const fin = c.rounds[c.rounds.length - 1][0];
  c.done = true; c.champion = fin.winner; c.runnerUp = fin.winner === fin.hi ? fin.lo : fin.hi; c.finalSeries = fin.id;
  if (typeof financeComp === 'function') financeComp(save, c);
  // MVP: best performer in this competition (champions get a bonus)
  let best = null, bs = -1e9;
  for (const pid in c.stats) { const p = P(save, pid); if (!p) continue; const sc = compScore(c.stats[pid], (c.statsTeam || {})[pid] === c.champion); if (sc > bs) { bs = sc; best = pid; } }
  c.mvp = best ? playerSnap(save, best, c.stats[best], (c.statsTeam || {})[best]) : null;
  // tournament awards (finalised once per edition): MVP, outstanding goalie (goals saved above expected), leading scorer
  let bg = null, bgv = -1e9, bsc = null, bsv = -1;
  for (const pid in c.stats) {
    const p = P(save, pid), l = c.stats[pid]; if (!p) continue;
    if (p.pos === 'G' && l.sa >= 10) { const v = (l.xga - l.ga * 100) / 100 + svPct(l) * 2; if (v > bgv) { bgv = v; bg = pid; } }
    if (p.pos !== 'G') { const v = (l.g + l.a) * 100 + l.g; if (v > bsv) { bsv = v; bsc = pid; } }
  }
  if (!c.awardsDone) {
    c.awardsDone = true;
    const ed = 's' + save.season.num + '-' + c.key, tag = { comp: c.key, compName: c.name, editionId: ed };
    c.awards = {};
    if (best) c.awards.mvp = seasonAward(save, 'tmvp', c.name + ' MVP', best, c.stats[best], null, tag).id;
    if (bg) c.awards.goalie = seasonAward(save, 'tgoal', c.name + ' Outstanding Keeper', bg, c.stats[bg], `${fmtSv(svPct(c.stats[bg]))} SV%, ${((c.stats[bg].xga - c.stats[bg].ga * 100) / 100).toFixed(1)} GSAx`, tag).id;
    if (bsc && bsv > 0) c.awards.scorer = seasonAward(save, 'tscore', c.name + ' Leading Scorer', bsc, c.stats[bsc], null, tag).id;
  }
  const games = fin.gids.map(id => save.season.games[id]);
  const champT = save.teams[c.champion], oppT = save.teams[c.runnerUp], info = COMP_INFO[c.key];
  const scoreOf = g => { const w = g.hs > g.as ? g.home : g.away; const ws = Math.max(g.hs, g.as), ls = Math.min(g.hs, g.as); return (w === c.champion ? ws + '-' + ls : ls + '-' + ws) + (g.so ? ' SO' : g.ot ? ' ET' : ''); };
  const result = fin.bestOf > 1 ? `Won final series ${Math.max(fin.winsHi, fin.winsLo)}-${Math.min(fin.winsHi, fin.winsLo)} (${games.map(scoreOf).join(', ')})` : `Won final ${scoreOf(games[games.length - 1])}`;
  c.result = result;
  const tr = { id: 't' + (save.nextId.t++), type: info.trophy, comp: c.key, compName: c.name, season: save.season.num, year: save.season.year, seasonLabel: seasonLabel(save.season.year),
    date: info.month + ' ' + (save.season.year + info.yearOff), teamId: champT.id, teamName: fullName(champT), abbr: champT.abbr, colors: { ...champT.colors }, emblem: champT.emblem,
    mvp: c.mvp, finalOpp: { teamId: oppT.id, name: fullName(oppT), abbr: oppT.abbr, colors: { ...oppT.colors }, emblem: oppT.emblem }, result,
    editionId: 's' + save.season.num + '-' + c.key, finalGids: fin.gids.slice(), finalScores: games.map(scoreOf), clipIds: [], decisiveClip: null, keyPlayers: compKeyPlayers(save, c, games[games.length - 1]),
    captain: (() => { const L = champT.leaders; const cp = L && L.c ? P(save, L.c) : null; return cp ? { pid: cp.id, num: cp.num, name: cp.first + ' ' + cp.last } : null; })(),
    qual: c.qual ? c.qual[champT.id] || null : null, awards: c.awards || null };
  if (tr.captain) { const cp = P(save, tr.captain.pid); (cp.capTitles = cp.capTitles || []).push(tr.id); }
  // highlights already archived from this final (earlier games of the series) join the trophy automatically
  for (const cl of Object.values(save.clips || {})) if (cl.ctx && cl.ctx.editionId === tr.editionId && cl.ctx.final && (cl.meta.gwg || cl.meta.ot || cl.meta.pen || cl.imp >= 60)) tr.clipIds.push(cl.id);
  save.trophies.push(tr);
  c.trophyId = tr.id;
  if (tr.teamId === save.userTeamId && typeof grantCosmetic === 'function' && grantCosmetic(save, 'emblem_' + c.key, c.name) && typeof notify === 'function')
    notify(save, { kind: 'unlock', text: 'New emblem unlocked: ' + COSMETICS['emblem_' + c.key].name + ' (for winning the ' + c.name + ').' });
  pushNews(save, `${champT.city} ${champT.nick} win the ${c.name}! MVP: ${c.mvp ? c.mvp.name : '-'}`);
  if (typeof onCompFinal === 'function') onCompFinal(save, c);
}
// the players worth engraving: MVP, top scorer, best goalie, the championship-winning goal
function compKeyPlayers(save, c, lastGame) {
  const out = {};
  let best = null, bp = -1, bg = null, bsv = -1;
  for (const pid in c.stats) {
    const p = P(save, pid), l = c.stats[pid]; if (!p) continue;
    if (p.pos !== 'G' && l.g + l.a > bp) { bp = l.g + l.a; best = pid; }
    if (p.pos === 'G' && l.sa > 0 && svPct(l) > bsv) { bsv = svPct(l); bg = pid; }
  }
  const aw = c.awards || {}, A = id => id ? save.awards.find(a => a.id === id) : null;
  if (A(aw.scorer)) best = A(aw.scorer).pid, bp = 1;
  if (A(aw.goalie)) bg = A(aw.goalie).pid;
  if (best && bp > 0) out.topScorer = playerSnap(save, best, c.stats[best], (c.statsTeam || {})[best]);
  if (bg) out.goalie = Object.assign(playerSnap(save, bg, c.stats[bg], (c.statsTeam || {})[bg]), c.stats[bg].xga ? { stat: statString('G', c.stats[bg]) + ` · ${((c.stats[bg].xga - c.stats[bg].ga * 100) / 100).toFixed(1)} GSAx` } : {});
  if (lastGame && lastGame.gwg) out.gwg = Object.assign({}, lastGame.gwg, { abbr: save.teams[lastGame.gwg.teamId].abbr });
  if (lastGame && lastGame.so) out.soWin = true;
  return out;
}
function pushNews(save, text) { save.news.unshift({ s: save.season ? save.season.num : save.seasonNum, text }); save.news.length = Math.min(save.news.length, 30); }

// ---------- what is playable now
function currentDay(save) {
  const se = save.season;
  if (save.draft0 && !save.draft0.done) return { key: 'draft0', gids: [] };
  const day = (() => {
    for (let guard = 0; guard < 60; guard++) {
      const step = CALENDAR[se.calIdx];
      if (!step || step === 'end') return { key: 'end', gids: [] };
      if (step[0] === 'r') {
        const gids = se.rounds[+step.slice(1)].filter(id => !se.games[id].played);
        if (gids.length) return { key: step, label: se.games[gids[0]].label, gids, userGid: gids.find(id => isUserGame(save, se.games[id])) || null };
        se.calIdx++; continue;
      }
      if (OPTIONAL_COMPS.includes(step) && !se.comps[step] && choiceOf(se, step) == null && qualifiesFor(save, step, save.userTeamId)) return { key: step, invite: true, gids: [], userGid: null };
      const c = se.comps[step] || createComp(save, step);
      const gids = compPendingGames(save, c);
      if (gids.length) return { key: step, label: c.name, gids, userGid: gids.find(id => isUserGame(save, se.games[id])) || null };
      se.calIdx++;
    }
    return { key: 'end', gids: [] };
  })();
  // a new set of games = a new day (rest days accumulate for teams that are not playing)
  const sig = day.gids.join(',');
  if (sig && sig !== se.daySig) { se.daySig = sig; se.dayNo = (se.dayNo || 0) + 1; if (typeof moraleDay === 'function') moraleDay(save); if (typeof devDay === 'function') devDay(save); }
  return day;
}
const isUserGame = (save, g) => g.home === save.userTeamId || g.away === save.userTeamId;
function nextUserGame(save) {
  // looks ahead through the regular season schedule (competitions are created as they come)
  const day = currentDay(save);
  if (day.userGid) return save.season.games[day.userGid];
  const se = save.season;
  for (let i = se.calIdx; i < CALENDAR.length; i++) {
    const step = CALENDAR[i];
    if (step[0] === 'r') { const g = se.rounds[+step.slice(1)].map(id => se.games[id]).find(x => !x.played && isUserGame(save, x)); if (g) return g; }
  }
  return null;
}
function upcomingComps(save) {
  const se = save.season, out = [];
  for (let i = se.calIdx; i < CALENDAR.length; i++) { const k = CALENDAR[i]; if (COMP_INFO[k] && !(se.comps[k] && se.comps[k].done)) out.push({ key: k, name: COMP_INFO[k].name, roundsAway: CALENDAR.slice(se.calIdx, i).filter(x => x[0] === 'r').length }); }
  return out;
}

// ---------- applying a finished game (user-played or simulated)
const catOf = g => g.type === 'reg' ? 'reg' : g.type === 'po' ? 'po' : 'tour';
function applyResult(save, gid, res) {
  const se = save.season, g = se.games[gid];
  if (!g || g.played) return false;                        // never count a game twice
  g.hs = res.hs; g.as = res.as; g.ot = !!res.ot; g.so = !!res.so; g.played = true; g.sim = !!res.sim;
  if (!isUserGame(save, g) && typeof hlRemember === 'function') hlRemember(save, g, res);   // its best goals, for the PUCK TALK desk (hlgen.js)
  if (typeof financeGame === 'function' && g.type !== 'exh') financeGame(save, g, res);
  if (res.stars) g.stars = res.stars;
  // the box score of your own games is kept, so any of them can be opened again later (compact: goals, every player's
  // line, team stats, injuries)
  if (isUserGame(save, g)) {
    try {
      g.box = {
        goals: (res.goals || []).map(x => { const o = { t: x.teamId, p: x.pid, a: (x.a || []).slice() }; for (const k of ['per', 'clk', 'pp', 'sh', 'en', 'ps', 'tip']) if (x[k] != null && x[k] !== false) o[k] = x[k]; return o; }),
        lines: (res.stats || []).filter(l => l.pid && P(save, l.pid) && (l.gp || l.toi || l.g || l.a || l.sa || l.sog)).map(l => ({ p: l.pid, t: l.teamId, g: l.g || 0, a: l.a || 0, s: l.sog || 0, h: l.hit || 0, pm: l.pm || 0, toi: Math.round(l.toi || 0), sa: l.sa || 0, ga: l.ga || 0, pim: l.pim || l.pen || 0, fo: [l.fow || 0, l.fot || 0] })),
        ts: res.tstats || null,
        inj: (res.injuries || []).map(i => ({ p: i.pid, k: i.kind, g: i.games })),
      };
    } catch (e) { g.box = null; }
  }
  const cat = catOf(g);
  const c = g.comp ? se.comps[g.comp] : null;
  if (c && !c.statsTeam) c.statsTeam = {};
  // finalise the per-game performance numbers once, here
  const gameSec = res.gameSec || 300, homeWonG = res.hs > res.as, winT = homeWonG ? g.home : g.away;
  // game-winning goal, identified only now that the result is final (none for shootouts)
  if (res.goals && !res.so) {
    const lg = homeWonG ? res.as : res.hs, gw = res.goals.filter(x => x.teamId === winT)[lg];
    const pl = gw && gw.pid ? P(save, gw.pid) : null;
    if (pl) {
      g.gwg = { pid: pl.id, num: pl.num, name: pl.first + ' ' + pl.last, teamId: winT, a: (gw.a || []).filter(id => P(save, id)), ot: !!res.ot };
      const sl = res.stats.find(x => x.pid === pl.id);
      if (sl) {
        sl.gwg = 1; if (res.ot) sl.otw = 1;
        // championship-deciding play: clutch weight 1.8x for that goal (capped: the OT 1.7x is topped up, not stacked)
        if (c && clinchesIfWin(save, g, winT)) { sl.cgw = 1; sl.cv = (sl.cv || 0) + (res.ot ? 1 : 8); g.cgw = true; }
      }
    }
  }
  for (const l of res.stats) {
    const pl = P(save, l.pid); if (!pl) continue;
    l.pos = pl.pos;
    if (pl.pos !== 'G' && l.g >= 3) l.hat = 1;
    if (pl.pos === 'G' && (l.gp || l.toi) && !l.ga && l.sa && (l.teamId === winT || res.hs === res.as) && !res.so) l.sho = 1;
    if (typeof devMoment === 'function' && (l.hat || l.sho || (l.otw && g.type === 'po'))) devMoment(save, pl, l.hat ? 'hat' : l.sho ? 'sho' : 'otw');
    const ip = impactParts(l, pl.pos, gameSec);
    l.imp = Math.round(ip.total * 10); l.dimp = Math.round(ip.def * 10); l.gpi = 1;
  }
  const stars = threeStars(res.stats.filter(l => P(save, l.pid)), gameSec);
  stars.forEach((l, i) => { l['s' + (i + 1)] = 1; });
  g.stars = stars.map((l, i) => { const pl = P(save, l.pid); return { pid: l.pid, name: pl.first + ' ' + pl.last, num: pl.num, pos: pl.pos, spos: pl.spos, teamId: l.teamId, stat: starStat(l, pl.pos), why: l._why, rank: i + 1 }; });
  const newMs = [];
  for (const l of res.stats) {
    const pl = P(save, l.pid); if (!pl) continue;
    const line = {}; for (const k of STAT_KEYS) line[k] = l[k] || 0;
    const before = lifetime(pl.career);
    // recent form, best games, stars, hat tricks: compact per-player history
    const mine = pl.teamId === save.userTeamId || pl.fav;            // full detail for your players and favourites, compact for the rest
    pl.form = (pl.form || []).concat(pl.pos === 'G' ? { s: se.num, gid, imp: line.imp, sv: line.sv, ga: line.ga } : { s: se.num, gid, imp: line.imp, g: line.g, a: line.a, ds: line.ds }).slice(-5);
    const st = g.stars.find(x => x.pid === l.pid);
    if (st) { pl.starsHist = pl.starsHist || []; pl.starsHist.push(mine ? { s: se.num, gid, r: st.rank, why: st.why } : { s: se.num, r: st.rank }); if (pl.starsHist.length > (mine ? 15 : 6)) { pl.starsN = (pl.starsN || 0) + 1; pl.starsHist.shift(); } }
    if (line.hat) (pl.hats = pl.hats || []).push({ s: se.num, gid, label: g.label, g: line.g, teamId: l.teamId });
    if (line.imp >= 15 || st) {
      const b = { s: se.num, gid, label: g.label, imp: line.imp, stat: starStat(line, pl.pos), opp: l.teamId === g.home ? g.away : g.home, score: [res.hs, res.as], home: g.home, away: g.away };
      if (mine) b.why = starWhy(line, pl.pos, null);
      pl.best = (pl.best || []).concat(b).sort((a, b2) => b2.imp - a.imp).slice(0, mine ? 5 : 2);
    }
    l._before = before;
    const ss = se.stats[l.pid] || (se.stats[l.pid] = emptyCats());
    addLine(ss[cat], line); addLine(pl.career[cat], line);
    if (c) { c.stats[l.pid] = addLine(c.stats[l.pid] || emptyLine(), line); c.statsTeam[l.pid] = l.teamId; }
    for (const m of checkMilestones(save, pl, g, l._before)) if (!m.quiet) newMs.push(m);
    delete l._before;
  }
  g.milestones = newMs.map(m => m.id);
  for (const m of newMs) { const pl = P(save, m.pid); if (pl.fav || pl.teamId === save.userTeamId) pushNews(save, `${pl.fav ? '★ ' : ''}${m.text} for #${m.num} ${pl.first} ${pl.last}!`); }
  // team special-teams numbers (power plays, penalties, fights, empty-net goals)
  for (const tid of [g.home, g.away]) { const a = se.teamStats[tid], b = (res.tstats || {})[tid]; if (a && b) for (const k in b) a[k] = (a[k] || 0) + (b[k] || 0); }
  upkeepAfterGame(save, g, res);
  if (typeof comebackTeam === 'function') res.comeback = comebackTeam(res.goals, g.home, g.away, res.hs, res.as);
  if (typeof afterGameProgress === 'function') afterGameProgress(save, g, res);
  const homeWon = g.hs > g.as, winner = homeWon ? g.home : g.away, loser = homeWon ? g.away : g.home;
  if (g.type === 'reg') {
    const W = se.standings[winner], L = se.standings[loser];
    for (const [id, gf, ga] of [[g.home, g.hs, g.as], [g.away, g.as, g.hs]]) { const s = se.standings[id]; s.gp++; s.gf += gf; s.ga += ga; }
    // SOCCER: 3 points for a win, 1 each for a draw (the old OTL column now counts draws)
    if (g.hs === g.as) { se.standings[g.home].otl++; se.standings[g.home].pts += 1; se.standings[g.away].otl++; se.standings[g.away].pts += 1; }
    else { W.w++; W.pts += 3; L.l++; W.rw = (W.rw || 0) + 1; }
  }
  if (c) {
    const sr = findSeries(c, g.seriesId);
    if (winner === sr.hi) sr.winsHi++; else sr.winsLo++;
    const need = Math.ceil(sr.bestOf / 2);
    if (sr.winsHi >= need) sr.winner = sr.hi; else if (sr.winsLo >= need) sr.winner = sr.lo;
  }
  save.lastPlayed = Date.now();
  return true;
}
// ---------- condition and injuries after every game (played or simulated)
const condCost = (pl, l, tour) => (BAL.cond.base + (l.toi || 0) / 60 * BAL.cond.perMin + (tour ? BAL.cond.tour : 0)) * traitMul(pl, 'condMul');
function upkeepAfterGame(save, g, res) {
  const se = save.season, dressed = new Set(res.stats.filter(l => l.gp || l.toi).map(l => l.pid));
  for (const tid of [g.home, g.away]) {
    const t = save.teams[tid]; if (!t) continue;
    const days = Math.max(1, (se.dayNo || 1) - (t.lastDay ?? ((se.dayNo || 1) - 1)));
    t.lastDay = se.dayNo || 1;
    for (const pid of orgIds(t)) {
      const pl = P(save, pid);
      pl.cond = Math.min(100, (pl.cond ?? BAL.cond.start) + BAL.cond.recover * days * (2 - traitMul(pl, 'condMul')));
      if (pl.inj && pl.inj.g > 0 && !dressed.has(pid)) {                       // missed this game
        pl.inj.g--;
        if (pl.inj.g <= 0) { pl.inj = null; if (tid === save.userTeamId) pushNews(save, `${pl.first} ${pl.last} is healthy again.`); }
      }
    }
  }
  for (const l of res.stats) {
    const pl = P(save, l.pid); if (!pl || !(l.gp || l.toi)) continue;
    pl.cond = Math.max(5, (pl.cond ?? BAL.cond.start) - condCost(pl, l, g.type !== 'reg'));
  }
  // injuries that outlast the game (validated: a team always keeps six healthy skaters for its next games)
  for (const inj of res.injuries || []) {
    const pl = P(save, inj.pid); if (!pl || !inj.games) continue;
    const t = save.teams[pl.teamId]; if (!t) continue;
    if (healthySkaters(save, t, pl.id) < BAL.minSkaters) continue;
    pl.inj = { g: inj.games, kind: inj.kind || 'upper body', s: se.num };
    (pl.injHist = pl.injHist || []).push({ s: se.num, gid: g.id, g: inj.games, kind: pl.inj.kind });
    if (pl.injHist.length > 8) pl.injHist.shift();
    if (t.id === save.userTeamId || pl.fav) pushNews(save, `${pl.first} ${pl.last} is out ${inj.games} game${inj.games === 1 ? '' : 's'} (${pl.inj.kind}).`);
  }
}
const healthySkaters = (save, t, except) => rosterSkaters(t).filter(id => id !== except && isAvailable(P(save, id))).length;
function applyExhibition(save, res, userWon) {
  const se = save.season;
  for (const l of res.stats) {
    const pl = P(save, l.pid); if (!pl) continue;
    const line = {}; for (const k of STAT_KEYS) line[k] = l[k] || 0;
    const ss = se.stats[l.pid] || (se.stats[l.pid] = emptyCats());
    addLine(ss.exh, line); addLine(pl.career.exh, line);
  }
  save.exhibition.gp++; if (userWon) save.exhibition.w++; else save.exhibition.l++;
  save.lastPlayed = Date.now();
}

// ====================================================================
//  EFFECTIVE ATTRIBUTES (shared by the match engine and the simulator)
//  base ratings + traits + personal leadership bonus + the team's single leadership aura + linemate / opponent effects,
//  scaled by condition and morale/momentum, minus any out-of-position cost. Base ratings are never modified.
// ====================================================================
const ATTR_CAP = 11;
const keysOf = pl => (pl.pos === 'G' ? G_ATTRS : SK_ATTRS).map(k => k[0]);
function lowest3(pl) {
  const ks = keysOf(pl);
  return ks.slice().sort((a, b) => (pl.attrs[a] - pl.attrs[b]) || (ks.indexOf(a) - ks.indexOf(b))).slice(0, 3);
}
// which leader's aura is active for a set of on-ice skaters: the captain first, else the first alternate on the ice
function activeAura(lead, onIds, gid) {
  if (!lead) return null;
  if (lead.c && onIds.has(lead.c.pid)) return { pid: lead.c.pid, style: lead.c.style, mul: lead.c.resp ?? 1 };
  for (const a of lead.a || []) if (onIds.has(a.pid)) return { pid: a.pid, style: a.style, mul: BAL.lead.assistMul * (a.resp ?? 1) };
  // a goalie with a letter is always out there: when no skater leader is on, his aura works at reduced strength
  if (gid) { if (lead.c && lead.c.pid === gid) return { pid: gid, style: lead.c.style, mul: BAL.lead.goalieAura * (lead.c.resp ?? 1), g: true };
    const a = (lead.a || []).find(x => x.pid === gid); if (a) return { pid: gid, style: a.style, mul: BAL.lead.assistMul * BAL.lead.goalieAura * (a.resp ?? 1), g: true }; }
  return null;
}
// a goalie leader's personal bonus goes to his goalie ratings
const G_LEAD_MAP = { def: 'pos', chk: 'reb', sta: 'rec', acc: 'ref', pow: 'ref', pas: 'ref', stk: 'ref', spd: 'ref' };
function goalieMods(mods) { const o = {}; for (const k in mods) { const kk = k === 'all' || ['pos', 'ref', 'reb', 'rec'].includes(k) ? k : G_LEAD_MAP[k]; if (kk) o[kk] = (o[kk] || 0) + mods[k]; } return o; }
function leaderRole(lead, pid) {
  if (!lead) return null;
  if (lead.c && lead.c.pid === pid) return { style: lead.c.style, mul: lead.c.resp ?? 1 };
  const a = (lead.a || []).find(x => x.pid === pid); return a ? { style: a.style, mul: BAL.lead.assistMul * (a.resp ?? 1) } : null;
}
function addMods(out, mods, mul, keys) {
  for (const k in mods) {
    if (k === 'all') { for (const kk of keys) out[kk] = (out[kk] || 0) + mods.all * mul; }
    else if (keys.includes(k)) out[k] = (out[k] || 0) + mods[k] * mul;
  }
}
// aura bonus for one teammate (calculated from HIS base ratings for low3)
function auraBonus(aura, pl, state, leaderPl) {
  const out = {}; if (!aura) return out;
  const st = LEAD_STYLES[aura.style]; if (!st) return out;
  const mul = aura.mul * (hasTrait(leaderPl, 'natural_leader') ? BAL.lead.naturalMul : 1), ks = keysOf(pl), A = st.aura;
  if (pl.pos === 'G') { if (A.goalie) { out.pos = A.goalie * mul; out.ref = A.goalie * mul * 0.6; } return out; }
  for (const k in A) {
    const v = A[k] * mul;
    if (k === 'low3') for (const kk of lowest3(pl)) out[kk] = (out[kk] || 0) + v;
    else if (k === 'all') for (const kk of ks) out[kk] = (out[kk] || 0) + v;
    else if (k === 'late') { if (state.late) for (const kk of ks) out[kk] = (out[kk] || 0) + v; }
    else if (k === 'trailing') { if (state.trailing) for (const kk of ks) out[kk] = (out[kk] || 0) + v; }
    else if (ks.includes(k)) out[k] = (out[k] || 0) + v;
  }
  return out;
}
// o: { role, lead (lineup.lead), aura, auraPl, state:{clutch,trailing,bigGame,late}, onIce:{}, opp:{}, morale, noCond }
// ---------- ON-ICE BALANCE: how far apart ratings play, game-day form, hot and cold streaks
// RATING_COMP: attribute gaps play ~30% smaller than they read (around a league-average 6.75), so an 85 beats a 75
// about two times in three, not three in four. FORM: every team has a game-day form (skaters a little, the goalie more:
// a hot goalie is the classic upset). STREAKS: a player can get hot (or cold) in a game and carry it a few games;
// what it touches depends on his traits (a sniper's shot, a defender's defending...).
const RATING_COMP = { c: 6.75, k: 0.68 };
const FORM = { sk: 0.18, skMax: 0.35, g: 0.4, gMax: 0.8, gShow: 0.45 };
const STREAK = { shakeOff: 6, mag: 0.45, coldMag: 0.4, gamesMin: 2, gamesMax: 4, check: 30, perCheck: 0.0025, coldPerCheck: 0.0015, onGoal: 0.1, gSaves: 8, gHot: 0.25, gCold: 0.2, simHot: 0.012, simCold: 0.008 };
const STREAK_TYPES = { shoot: { name: 'SCORING', keys: ['acc', 'pow'] }, pass: { name: 'PLAYMAKING', keys: ['pas', 'stk'] }, speed: { name: 'RUNNING', keys: ['spd', 'sta'] },
  def: { name: 'DEFENDING', keys: ['def', 'chk'] }, phys: { name: 'PHYSICAL', keys: ['chk', 'def'] }, goalie: { name: 'GOALKEEPING', keys: ['ref', 'pos'] } };
const TRAIT_STREAK = { sharpshooter: 'shoot', clutch: 'shoot', rebound_hunter: 'shoot', comeback: 'shoot', playmaker: 'pass', veteran: 'pass', natural_leader: 'pass',
  speedster: 'speed', iron_lungs: 'speed', def_spec: 'def', disciplined: 'def', protector: 'def', steady_footing: 'def',
  enforcer: 'phys', hotheaded: 'phys', tough: 'phys', intimidating: 'phys', iron_chin: 'phys', counterpuncher: 'phys' };
function streakType(pl) {
  if (pl.pos === 'G') return 'goalie';
  for (const t of pl.traits || []) if (TRAIT_STREAK[t]) return TRAIT_STREAK[t];
  return /D$/.test(pl.spos || '') || pl.pos === 'D' ? 'def' : 'shoot';           // no trait: forwards score, defencemen defend
}
function startStreak(pl, kind, rng = Math.random) {
  if (!pl || pl.streak) return false;
  pl.streak = { k: kind, type: streakType(pl), n: STREAK.gamesMin + Math.floor(rng() * (STREAK.gamesMax - STREAK.gamesMin + 1)) };
  return true;
}
function endOfGameStreaks(pls) { for (const pl of pls) if (pl && pl.streak && --pl.streak.n <= 0) delete pl.streak; }
const gaussR = rng => { let u = 0, v = 0; while (!u) u = rng(); while (!v) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
function rollForm(rng = Math.random) { const c = (x, m) => Math.max(-m, Math.min(m, x)); return { sk: c(gaussR(rng) * FORM.sk, FORM.skMax), g: c(gaussR(rng) * FORM.g, FORM.gMax) }; }
function effAttrs(pl, o = {}) {
  const ks = keysOf(pl), bonus = {}, st = o.state || {};
  if (o.form) for (const k of ks) bonus[k] = (bonus[k] || 0) + o.form;
  if (pl.streak && STREAK_TYPES[pl.streak.type]) for (const k of STREAK_TYPES[pl.streak.type].keys) if (ks.includes(k)) bonus[k] = (bonus[k] || 0) + (pl.streak.k === 'hot' ? STREAK.mag : -STREAK.coldMag);
  for (const id of pl.traits || []) { const t = TRAITS[id]; if (t && t.mods && (!t.when || st[t.when])) addMods(bonus, t.mods, 1, ks); }
  const lr = leaderRole(o.lead, pl.id);
  if (lr && LEAD_STYLES[lr.style]) addMods(bonus, pl.pos === 'G' ? goalieMods(LEAD_STYLES[lr.style].personal) : LEAD_STYLES[lr.style].personal, lr.mul * (hasTrait(pl, 'natural_leader') ? BAL.lead.naturalMul : 1), ks);
  if (o.aura && o.aura.pid !== pl.id) addMods(bonus, auraBonus(o.aura, pl, st, o.auraPl), 1, ks);
  if (o.onIce) addMods(bonus, o.onIce, 1, ks);
  if (o.opp) addMods(bonus, o.opp, 1, ks);
  const condPen = o.noCond ? 0 : condBand(pl.cond)[2], off = o.role != null ? offPosPenalty(pl.spos, o.role) : 0, mor = 1 + (o.morale || 0) + (pl.happyLift || 0) + (pl.fireUp || 0);
  const out = {};
  for (const k of ks) { const raw = pl.attrs[k] ?? 5, base = o.noComp ? raw : RATING_COMP.c + (raw - RATING_COMP.c) * RATING_COMP.k; out[k] = Math.max(0.5, Math.min(ATTR_CAP, (base + (bonus[k] || 0) - off) * (1 - condPen) * mor)); }
  return out;
}
// linemate trait effects (Protector, Veteran Presence) and opponent effects (Intimidating) for a group on the ice
function iceMods(pls, key) {
  const out = {};
  for (const pl of pls) for (const id of pl.traits || []) { const t = TRAITS[id]; if (t && t[key]) for (const k in t[key]) out[k] = (out[k] || 0) + t[key][k]; }
  return out;
}

// ---------- AI game simulation (attributes, goaltending, special teams, randomness)
// Calibrated against AI-vs-AI games of the match engine (see the debug panel's simulation report).
const SIM_HD = 0.13;
const SIM = { shot: 0.41, pg: 0.072, pgK: 0.0096, ppShot: 1.45, ppPg: 1.12, shShot: 0.55, evenFour: 1.08, pen: 0.011, penShot: 0.14, psGoal: 0.36,
  enShot: 0.32, enPg: 0.42, pullShot: 1.45, homeAdv: 1, ot: 1.35, foPerTick: 0.9, tipShare: 0.09 };
// ---------- goalie strength vs the league (Nov 23, Barry's choice) ----------
// Elite goalies keep improving over a franchise, so league scoring drifted from ~3.4 to ~2.9 goals a game in 5 seasons
// (soak: average starter 7.3 -> 8.2, shooters flat). Every goalie is now rated against the league's average starter:
// his ratings are shifted by (GK_NORM.base - league average), the same for everyone, so a better goalie still matters
// exactly as much and league scoring stays where it was tuned. base = the average starter after season 1 of a new league.
const GK_NORM = { base: 7.15, lo: -1.5, hi: 1.0 };   // 7.3 soaked at 3.27 goals a game; ~0.55 goals per rating point -> 7.15 for ~3.35
function gkValue(p) { const A = (p && p.attrs) || {}; return (A.ref || 5) * 0.45 + (A.pos || 5) * 0.35 + (A.reb || 5) * 0.2; }
function gkLeagueAdj(save) {
  if (!save || !save.teams || !save.season) return 0;
  let key; try { key = save.season.num + ':' + currentDay(save).key; } catch (e) { key = save.season.num + ':?'; }
  if (save._gkAdj && save._gkAdj.key === key) return save._gkAdj.v;
  const vals = [];
  for (const t of Object.values(save.teams)) { try { const g = lineupFor(save, t.id).goalie; if (g) vals.push(gkValue(g)); } catch (e) {} }
  const v = vals.length ? clamp(GK_NORM.base - vals.reduce((a, b) => a + b, 0) / vals.length, GK_NORM.lo, GK_NORM.hi) : 0;
  Object.defineProperty(save, '_gkAdj', { value: { key, v: +v.toFixed(3) }, enumerable: false, writable: true, configurable: true });   // not saved
  return save._gkAdj.v;
}

function simGame(save, g, opts = {}) {
  const rng = opts.rng || Math.random;
  const big = g.type !== 'reg';
  const sides = [g.home, g.away].map((tid, side) => {
    const lu = lineupFor(save, tid, side === 0 ? opts.homeGoalie : opts.awayGoalie);
    return { tid, lu, form: rollForm(rng), lines: lu.lines.map(l => l.filter(Boolean)), score: 0, out: new Set(), pen: [], penQ: [], pulled: false, mom: 0, dressed: lu.lines.flat().filter(Boolean).length + lu.bench.length };
  });
  const lines = {}, line = (pl, side) => lines[pl.id] || (lines[pl.id] = Object.assign(emptyLine(), { pid: pl.id, teamId: sides[side].tid, gp: 1 }));
  const goals = [], injuries = [], ts = sides.map(() => ({ ppo: 0, ppg: 0, pk: 0, pkga: 0, pim: 0, fights: 0, eng: 0 }));
  for (const [i, s] of sides.entries()) { for (const l of s.lines) for (const p of l) line(p, i); if (s.lu.goalie) line(s.lu.goalie, i); }
  const dressedAll = sides.flatMap(s => s.lines.flat().concat(s.lu.goalie ? [s.lu.goalie] : []));
  if (!opts.noStreaks) for (const pl of dressedAll) { const r = rng(); if (r < STREAK.simHot) startStreak(pl, 'hot', rng); else if (r < STREAK.simHot + STREAK.simCold) startStreak(pl, 'cold', rng); }
  const tickSec = 5, lineSeq = [];
  for (let t = 0; t < 60; t++) { const ph = t % 12; lineSeq.push(ph < 5 ? 0 : ph < 9 ? 1 : 2); }  // ~40/33/27% ice time
  const avail = (s, pl) => !s.out.has(pl.id);
  const iceOf = (s, li) => { let l = (s.lines[li] || []).filter(p => avail(s, p)); if (l.length < 2) l = s.lines.flat().filter(p => avail(s, p)).slice(0, 3); return l; };
  const benchOf = (s, onIce) => s.lines.flat().concat(s.lu.bench).filter(p => avail(s, p) && !onIce.includes(p));
  const effLine = (s, side, onIce, extra, t) => {
    const op = sides[1 - side], state = { late: t >= 40 || t >= 60, trailing: s.score < op.score, clutch: (t >= 48 || t >= 60) && Math.abs(s.score - op.score) <= 1, bigGame: big };
    const all = extra ? onIce.concat(extra) : onIce, ids = new Set(all.map(p => p.id));
    const aura = activeAura(s.lu.lead, ids, !s.pulled && s.lu.goalie ? s.lu.goalie.id : null), auraPl = aura ? all.find(p => p.id === aura.pid) || (aura.g ? s.lu.goalie : null) : null;
    const opp = iceMods(iceOf(op, lineSeq[t % 60]), 'oppIce'), mor = s.mom > 0 ? BAL.morale.momentumMul : 0;
    return all.map((p, j) => ({ p, a: effAttrs(p, { role: j < 3 ? j : null, lead: s.lu.lead, aura, auraPl, state, onIce: iceMods(all.filter(x => x !== p), 'onIce'), opp, morale: mor, form: s.form.sk }) }));
  };
  const gk = (s, t) => { if (!s.lu.goalie || s.pulled) return 2; const op = sides[sides.indexOf(s) === 0 ? 1 : 0];
    const ga = effAttrs(s.lu.goalie, { form: s.form.g, lead: s.lu.lead, state: { bigGame: big }, aura: activeAura(s.lu.lead, new Set(iceOf(s, lineSeq[t % 60]).map(p => p.id))), auraPl: null });
    return ga.ref * 0.45 + ga.pos * 0.35 + ga.reb * 0.2 + gkLeagueAdj(save); };
  const avgK = (E, f) => E.reduce((a, e) => a + f(e.a), 0) / Math.max(1, E.length);
  const pickW = (E, f) => weightedPick(E, e => Math.max(0.1, f(e)), rng);
  const startPen = (side, offender, t) => {
    const s = sides[side], op = sides[1 - side];
    const l = line(offender, side); l.pen++; l.pim += BAL.pen.len;
    ts[side].pim += BAL.pen.len; ts[1 - side].ppo++; ts[side].pk++;
    ts[1 - side].ppo--; ts[side].pk--;                   // SOCCER: a card, no power play (nobody leaves the pitch)
    void s; void op;
  };
  const tickPens = () => { for (const s of sides) { if (!s.pen.length) continue; s.pen[0].rem -= tickSec; if (s.pen[0].rem <= 0) { s.pen.shift(); if (s.penQ.length) s.pen.push(s.penQ.shift()); } } };
  const nSk = side => 3 + (sides[1 - side].pen.length ? 1 : 0) + (sides[side].pulled ? 1 : 0);
  let fought = false;
  const playTick = (t, boost = 1) => {
    const li = lineSeq[t % 60];
    tickPens();
    for (const s of sides) if (s.mom > 0) s.mom--;
    // late in the third: a team down by one or two pulls its goalie (never while on the power play)
    if (boost === 1) for (const [side, s] of sides.entries()) {
      const diff = sides[1 - side].score - s.score, left = (60 - t) * tickSec;
      s.pulled = false; void diff; void left;          // SOCCER: nobody empties the net
    }
    // faceoffs (about 55 a game): each side's best taker on the ice (centres favoured), decided by the Faceoff attribute
    if (false && rng() < SIM.foPerTick) {               // SOCCER: no faceoffs (kickoffs aren't contested)
      const tk = [0, 1].map(sd => iceOf(sides[sd], li).slice().sort((x, y) => ((y.attrs.fo ?? 5) + (y.spos === 'C' ? 1.5 : 0)) - ((x.attrs.fo ?? 5) + (x.spos === 'C' ? 1.5 : 0)))[0]);
      if (tk[0] && tk[1]) {
        const pw = Math.max(0.15, Math.min(0.85, 0.5 + ((tk[0].attrs.fo ?? 5) - (tk[1].attrs.fo ?? 5)) * 0.04));
        const w = rng() < pw ? 0 : 1;
        line(tk[0], 0).fot++; line(tk[1], 1).fot++; line(tk[w], w).fow++;
      }
    }
    for (const side of (rng() < 0.5 ? [0, 1] : [1, 0])) {        // who goes first each tick is a coin toss (no home edge)
      const me = sides[side], op = sides[1 - side];
      const onIce = iceOf(me, li), opIce = iceOf(op, li);
      const extra = nSk(side) > 3 ? (benchOf(me, onIce).sort((a, b) => (b.attrs.acc + b.attrs.pow) - (a.attrs.acc + a.attrs.pow))[0] || null) : null;
      const opExtra = nSk(1 - side) > 3 ? (benchOf(op, opIce)[0] || null) : null;
      const E = effLine(me, side, onIce, extra, t), D = effLine(op, 1 - side, opIce, opExtra, t);
      for (const e of E) line(e.p, side).toi += tickSec;
      if (me.lu.goalie && !me.pulled) line(me.lu.goalie, side).toi += tickSec;
      const off = avgK(E, a => a.pow * 0.33 + a.acc * 0.33 + a.pas * 0.18 + a.spd * 0.08 + (a.stk ?? 5) * 0.08);
      const def = avgK(D, a => a.def * 0.5 + a.chk * 0.25 + a.spd * 0.25);
      const myN = E.length, opN = D.length, pp = myN > opN && op.pen.length, sh = myN < opN && me.pen.length;
      const strength = pp ? SIM.ppShot : sh ? SIM.shShot : (myN === 4 && opN === 4 ? SIM.evenFour : 1);
      const homeAdv = side === 0 ? SIM.homeAdv : 1, late = t >= 50 || boost > 1, close = Math.abs(me.score - op.score) <= 1;
      // penalties (timed minor, or a penalty shot for fouls in the defensive zone)
      if (boost === 1 || rng() < 0.5) {
        const penP = SIM.pen * avgK(E, () => 1) * E.reduce((m, e) => m + traitMul(e.p, 'penMul'), 0) / E.length * (1 + (avgK(E, a => a.chk) - 5) * 0.04);
        if (rng() < penP) {
          const off2 = pickW(E, e => e.a.chk + (hasTrait(e.p, 'hotheaded') ? 3 : 0) - (hasTrait(e.p, 'disciplined') ? 3 : 0));
          if (rng() < SIM.penShot) {
            const shooter = pickW(D, e => e.a.acc + e.a.stk), gl = me.lu.goalie && !me.pulled ? me.lu.goalie : null;
            const ls = line(shooter.p, 1 - side); ls.sog++; line(off2.p, side).pen++;
            if (gl) line(gl, side).sa++;
            if (rng() < SIM.psGoal * (1 + (shooter.a.acc - 5) * 0.04) * (gl ? 1 - (gk(me, t) - 5) * 0.05 : 1.6)) { op.score++; ls.g++; if (gl) line(gl, side).ga++; goals.push({ teamId: op.tid, pid: shooter.p.id, a: [], ps: true }); if (boost > 1) return 1 - side; }
            else if (gl) line(gl, side).sv++;
          } else startPen(side, off2.p, t);
        }
      }
      // routine takeaways and giveaways
      if (rng() < 0.14 * avgK(D, a => a.def) / 5) { const d = line(pickW(D, e => e.a.def + 1).p, 1 - side); d.tk++; d.dv += 1.5; }
      if (rng() < 0.1 * (1.3 - avgK(E, a => a.stk ?? 5) / 10)) line(pickW(E, e => 11 - (e.a.stk ?? 5)).p, side).gv++;
      const emptyNet = op.pulled;
      if (rng() < SIM.shot * Math.pow(off / def, 0.9) * homeAdv * boost * strength * (me.pulled ? SIM.pullShot : 1) * (me.mom > 0 ? 1.05 : 1)) {
        if (rng() < 0.16 * avgK(D, a => a.def) / 5) {
          const d = line(pickW(D, e => e.a.def * 1.0 + e.a.chk * 0.3).p, 1 - side);
          const bw = rng() < 0.08; d.ds++; d.tk++; d.dv += (bw ? 10 : 4) * (late && close ? 1.2 : 1); if (bw) d.bws++;
          continue;
        }
        const shE = pickW(E, e => e.a.pow + e.a.acc + (hasTrait(e.p, 'rebound_hunter') ? 2 : 0));
        const shq = shE.a.acc * 0.6 + shE.a.pow * 0.4;
        let pg = Math.max(0.03, Math.min(0.24, SIM.pg + (shq - gk(op, t)) * SIM.pgK)) * boost * (pp ? SIM.ppPg : 1);
        if (emptyNet) pg = SIM.enPg;
        const ls = line(shE.p, side); ls.sog++;
        const hd = pg >= SIM_HD; ls.xg += pg * 100; if (hd) ls.hd++;
        const mates0 = E.filter(e => e !== shE);
        if (mates0.length && rng() < (hd ? 0.6 : 0.35)) line(pickW(mates0, e => e.a.pas + 1).p, side).ch++;
        const gl = op.lu.goalie && !emptyNet ? line(op.lu.goalie, 1 - side) : null;
        if (gl) { gl.sa++; gl.xga += pg * 100; }
        if (rng() < pg) {
          me.score++; ls.g++; if (gl) gl.ga++;
          const diff = me.score - op.score;
          if (boost > 1) ls.cv += 7; else if (late && diff === 0) ls.cv += 5; else if (late && Math.abs(diff) <= 1) ls.cv += 2;
          const mates = E.filter(e => e !== shE), ast = [];
          if (mates.length && rng() < 0.85) { const a1 = pickW(mates, e => e.a.pas + 1); line(a1.p, side).a++; ast.push(a1.p.id);
            const m2 = mates.filter(e => e !== a1); if (m2.length && rng() < 0.55) { const a2 = pickW(m2, e => e.a.pas + 1); line(a2.p, side).a++; ast.push(a2.p.id); } }
          const gx = { teamId: me.tid, pid: shE.p.id, a: ast };
          if (ast.length && rng() < SIM.tipShare) { gx.tip = true; ls.tip++; }
          if (pp) { gx.pp = true; ls.ppg++; for (const id of ast) lines[id].ppa++; ts[side].ppg++; ts[1 - side].pkga++; op.pen.shift(); if (op.penQ.length) op.pen.push(op.penQ.shift()); }
          else if (sh) { gx.sh = true; ls.shg++; }
          if (emptyNet) { gx.en = true; ls.eng++; ts[side].eng++; if (op.lu.goalie) line(op.lu.goalie, 1 - side).ena++; }
          goals.push(gx);
          if (!pp) { for (const e of E) line(e.p, side).pm++; for (const e of D) line(e.p, 1 - side).pm--; }
          if (boost > 1) return side;                     // overtime goal ends it
        } else if (gl) { gl.sv++; if (hd) { gl.hds++; if (late && close) gl.cv += 0.5; } }
      }
      if (rng() < 0.2 * (avgK(E, a => a.chk) / 5)) {
        const hitter = pickW(E, e => e.a.chk); line(hitter.p, side).hit++;
        // a heavy hit can injure (never below six available skaters)
        const victim = pickW(D, e => 1);
        if (rng() < BAL.inj.simRate * 0.06 * condBand(victim.p.cond)[3] * traitMul(victim.p, 'injMul')) {
          const avail2 = op.dressed - op.out.size;
          if (avail2 - 1 >= BAL.minSkaters) {
            const r = rng(), lv = line(victim.p, 1 - side); lv.inj++;
            if (r > BAL.inj.pMinor + BAL.inj.pModerate) {             // serious: done for the night, maybe longer
              op.out.add(victim.p.id);
              if (rng() < BAL.inj.carry) injuries.push({ pid: victim.p.id, games: ri(BAL.inj.carryGames[0], BAL.inj.carryGames[1], rng), kind: pickR(['upper body', 'lower body', 'knee', 'shoulder', 'wrist'], rng) });
            }
          }
        }
      }
      const np = Math.round((0.6 + avgK(E, a => a.pas) * 0.13) * rng() * 2);
      for (let k = 0; k < np; k++) line(pickW(E, e => e.a.pas).p, side).pas++;
    }
    // one fight at most: enforcers and hotheads raise the odds
    if (false && !fought && boost === 1 && t > 4 && rng() <   // SOCCER: no fights
        BAL.fight.simRate / 55 * sides.reduce((m, s) => m * (1 + iceOf(s, li).filter(p => hasTrait(p, 'enforcer') || hasTrait(p, 'hotheaded')).length * 0.6), 1)) {
      const [a, b] = sides.map(s => iceOf(s, li));
      if (a.length && b.length && sides.every(s => s.dressed - s.out.size - 1 >= BAL.minSkaters)) {
        fought = true;
        const fa = weightedPick(a, p => p.attrs.chk + (hasTrait(p, 'enforcer') ? 4 : 0), rng), fb = weightedPick(b, p => p.attrs.chk + (hasTrait(p, 'enforcer') ? 4 : 0), rng);
        const ra = fightRating(fa) + rng() * 3, rb = fightRating(fb) + rng() * 3, w = ra >= rb ? 0 : 1;
        line(w === 0 ? fa : fb, w).fw++; line(w === 0 ? fb : fa, 1 - w).fl++;
        sides[0].out.add(fa.id); sides[1].out.add(fb.id); ts[0].fights++; ts[1].fights++;
        sides[w].mom = 2;
      }
    }
    return -1;
  };
  for (let t = 0; t < 60; t++) playTick(t);
  for (const s of sides) s.pulled = false;
  let ot = false, so = false;
  if (sides[0].score === sides[1].score && !(g.type === 'reg' && opts.decider !== 'sudden')) {   // SOCCER: a league game can end level
    ot = true;
    const sudden = g.type !== 'reg' || opts.decider === 'sudden';
    let decided = -1;
    for (let per = 0; per < (sudden ? 12 : 1) && decided < 0; per++) for (let t = 0; t < 20 && decided < 0; t++) decided = playTick(60 + t, SIM.ot);
    if (decided < 0 && sudden) { decided = rng() < 0.5 ? 0 : 1; sides[decided].score++; }
    if (decided < 0) {                                   // shootout (regular season)
      so = true;
      const shooters = sides.map(s => s.lines.flat().filter(p => !s.out.has(p.id)).sort((a, b) => (b.attrs.acc + b.attrs.pow) - (a.attrs.acc + a.attrs.pow)));
      const sg = [0, 0];
      for (let r = 0; r < 20; r++) {
        for (const side of [0, 1]) {
          const sh = shooters[side][r % Math.max(1, shooters[side].length)], gk2 = gk(sides[1 - side], 0);
          if (sh && rng() < Math.max(0.12, Math.min(0.6, 0.33 + (sh.attrs.acc * 0.5 + sh.attrs.pow * 0.3 - gk2 * 0.8) * 0.03))) sg[side]++;
        }
        if (r >= 2 && sg[0] !== sg[1]) break;
      }
      if (sg[0] === sg[1]) sg[rng() < 0.5 ? 0 : 1]++;
      sides[sg[0] > sg[1] ? 0 : 1].score++;
    }
  }
  const win = sides[0].score > sides[1].score ? 0 : 1;
  if (sides[0].score !== sides[1].score && sides[win].lu.goalie) line(sides[win].lu.goalie, win).w = 1;
  for (const l of Object.values(lines)) { l.xg = Math.round(l.xg); l.xga = Math.round(l.xga); l.dv = Math.round(l.dv); l.cv = Math.round(l.cv); }
  if (!opts.noStreaks) endOfGameStreaks(dressedAll);
  return { hs: sides[0].score, as: sides[1].score, ot: ot && !so, so, stats: Object.values(lines), sim: true, goals, gameSec: 300, injuries,
    tstats: { [g.home]: ts[0], [g.away]: ts[1] } };
}
// fighting ability from ratings + traits (used by the simulator and by the fight mini-game's AI)
function fightRating(pl) {
  const a = pl.attrs;
  return a.chk * 0.45 + a.pow * 0.25 + a.def * 0.15 + a.sta * 0.15 + (traitFight(pl, 'pow') + traitFight(pl, 'bal') + traitFight(pl, 'chin')) * 6;
}
// convenience: simulate every unplayed game of the current day except (optionally) the user's
function simDay(save, includeUser) {
  let day = currentDay(save);
  while (day.invite) { setChoice(save.season, day.key, 'accept'); day = currentDay(save); }   // automated runs always accept
  if (day.key === 'end') return day;
  for (const gid of day.gids) {
    const g = save.season.games[gid];
    if (!includeUser && isUserGame(save, g)) continue;
    applyResult(save, gid, simGame(save, g));
  }
  if (typeof aiTradeProposal === 'function' && !save.autoRun) aiTradeProposal(save);
  if (typeof marketTick === 'function' && !save.autoRun) marketTick(save);
  return day;
}

// ====================================================================
//  GAME IMPACT RATING (hidden): what a player actually did in one game, separate from his ratings.
//  Skaters: offence + defence + clutch + efficiency, adjusted for ice time with a confidence cap.
//  Goalies: goals saved above expected + high-danger saves + volume, scaled down for tiny workloads.
// ====================================================================
// Game Impact weights. A goal is the rarest, most decisive thing a skater does in this low-scoring game, so it counts
// most; defensive work counts with clearly diminishing returns (a long shift piles it up), and so does clutch value
// (tuned on 660 simulated games: no goal scorer gets passed over for a quiet night with lots of ice time)
const IMPACT_W = { def: 0.5, defTail: 0.35, g: 1.3, a: 0.65, xg: 0.6, ch: 0.12, hd: 0.06, hit: 0.04, gv: 0.15, pen: 0.5, gsax: 1.25, hds: 0.18, sv: 0.03, sho: 0.8, gkWork: 8, clutchDiv: 15 };
function impactParts(l, pos, gameSec = 300) {
  if (pos === 'G') {
    const sa = l.sa || 0, gsax = (l.xga || 0) / 100 - (l.ga || 0);
    const work = Math.min(1, sa / IMPACT_W.gkWork);                 // two routine saves don't make a star
    let gk = gsax * IMPACT_W.gsax + (l.hds || 0) * IMPACT_W.hds + (l.sv || 0) * IMPACT_W.sv + (l.sho ? IMPACT_W.sho : 0);
    if (gk > 0) gk *= work;
    const clutch = (l.cv || 0) / IMPACT_W.clutchDiv * work;
    return { off: 0, def: 0, gk, clutch, eff: 0, gsax, total: gk + clutch };
  }
  const off = (l.g || 0) * IMPACT_W.g + (l.a || 0) * IMPACT_W.a + (l.xg || 0) / 100 * IMPACT_W.xg + (l.ch || 0) * IMPACT_W.ch + (l.hd || 0) * IMPACT_W.hd;
  const dv = (l.dv || 0) / 10, def = (dv <= 1 ? dv : 1 + (dv - 1) * IMPACT_W.defTail) * IMPACT_W.def + (l.hit || 0) * IMPACT_W.hit;   // defensive work counts, with diminishing returns
  const clutch = (l.cv || 0) / IMPACT_W.clutchDiv;
  const eff = -(l.gv || 0) * IMPACT_W.gv - (l.pen || 0) * IMPACT_W.pen;
  const raw = off + def + clutch + eff;
  const share = (l.toi || 0) / Math.max(30, gameSec / 3);          // 1.0 = a normal line's share of the game
  const m = raw < 0 ? 1 : Math.max(0.8, Math.min(1.25, 2 / (share + 1)));   // efficiency, but capped both ways
  let total = raw * m;
  if (share < 0.25 && total > 0) total *= share / 0.25;          // minimum participation
  return { off: off * m, def: def * m, gk: 0, clutch: clutch * m, eff, total };
}
const posOfLine = (save, l) => l.pos || (save && P(save, l.pid) ? P(save, l.pid).pos : 'S');
// the most distinctive true reason a player earned a star (only from recorded numbers)
function starWhy(l, pos, all) {
  const c = [], add = (score, txt) => c.push([score, txt]);
  if (l.cgw) add(120, 'Scored the championship-winning goal.');
  if (l.otw) add(110, 'Scored the extra time winner.');
  if (pos === 'G') {
    const gsax = (l.xga || 0) / 100 - (l.ga || 0);
    if (l.sho && l.sv) add(100, `Kept a clean sheet with ${l.sv} saves.`);
    if ((l.hds || 0) >= 3) add(80 + l.hds, `Stopped ${l.hds} high-danger shots.`);
    if (gsax >= 1) add(70 + gsax, `Saved ${gsax.toFixed(1)} goals above expected on ${l.sa} shots.`);
    add(30, `Made ${l.sv} saves on ${l.sa} shots.`);
  } else {
    const team = all ? all.filter(x => x.teamId === l.teamId && x !== l) : [];
    if (l.g >= 3) add(95, `Scored ${l.g} goals for a hat trick.`);
    if (l.g === 2) add(60, l.a ? `Scored twice and added ${l.a === 1 ? 'an assist' : l.a + ' assists'}.` : 'Scored twice.');
    if (l.a >= 2) add(55 + l.a, `Recorded ${l.a} assists` + ((l.ch || 0) >= 2 ? ` and created ${l.ch} scoring chances.` : '.'));
    if ((l.bws || 0) >= 2) add(75, `Broke up ${l.bws} breakaways.`);
    if ((l.ds || 0) >= 3 && team.every(x => (x.ds || 0) < l.ds)) add(62 + l.ds, `Led the team with ${l.ds} defensive stops.`);
    else if ((l.ds || 0) >= 2) add(45 + l.ds, `Shut down ${l.ds} dangerous chances.`);
    if (l.gwg) add(52, 'Scored the game-winning goal.');
    if (l.g === 1 && l.a) add(40, 'Scored a goal and set up another.');
    if ((l.ch || 0) >= 3) add(42, `Created ${l.ch} scoring chances.`);
    if ((l.tk || 0) >= 3) add(41, `Made ${l.tk} takeaways.`);
    if (l.g === 1) add(35, 'Scored a goal.');
    if (l.a === 1) add(30, 'Set up a goal.');
    if ((l.hit || 0) >= 3) add(25, `Delivered ${l.hit} hits.`);
    if ((l.xg || 0) >= 30) add(20, `Generated ${((l.xg || 0) / 100).toFixed(1)} expected goals on ${l.sog} shots.`);
    add(10, (l.toi || 0) < 45 ? (l.pm > 0 ? `On the pitch for ${l.pm === 1 ? 'a goal' : l.pm + ' goals'} for, none against.` : 'Made the most of limited playing time.') : `Steady shifts: ${fmtToi(l.toi)} on the pitch` + (l.pm > 0 ? `, +${l.pm}.` : '.'));
  }
  return c.sort((a, b) => b[0] - a[0])[0][1];
}
// a star's line, written out in words (no abbreviations)
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');
function starStat(l, pos) {
  if (pos === 'G') return plural(l.sv || 0, 'save') + ' · ' + plural(l.ga || 0, 'goal against', 'goals against') + ((l.hds || 0) ? ' · ' + plural(l.hds, 'high-danger save') : '');
  const parts = [];
  if (l.g || l.a) parts.push(plural(l.g || 0, 'goal') + ', ' + plural(l.a || 0, 'assist'));
  if (l.otw) parts.push('extra time winner');
  else if (l.gwg) parts.push('game-winning goal');
  if ((l.ds || 0) >= 1) parts.push(plural(l.ds, 'defensive stop'));
  if ((l.tk || 0) >= 2) parts.push(plural(l.tk, 'takeaway'));
  if ((l.blk || 0) >= 2) parts.push(plural(l.blk, 'blocked shot'));
  if (!parts.length || parts.length < 2) parts.push(plural(l.sog || 0, 'shot on goal', 'shots on goal'));
  return parts.join(' · ');
}
const POS_WORDS = { G: 'Keeper', D: 'Player', C: 'Centre', LW: 'Left', RW: 'Right', LD: 'Left · D', RD: 'Right · D', F: 'Player', S: 'Player' };
// Three Stars: ranked by Game Impact Rating; both teams eligible, no positional quotas
function threeStars(lines, gameSec) {
  // eligible: dressed and actually used (a few seconds of ice time is not a performance)
  let el = lines.filter(l => (l.gp || l.toi) && (l.toi || 0) >= (gameSec || 300) * 0.06);
  if (el.length < 3) el = lines.filter(l => l.gp || l.toi);
  for (const l of el) { const pos = l.pos || 'S'; l._imp = impactParts(l, pos, gameSec).total + (l.otw ? 1.6 : l.gwg ? 0.35 : 0) + (l.cgw ? 0.8 : 0); }
  return el.slice().sort((a, b) => b._imp - a._imp).slice(0, 3).map(l => Object.assign(l, { _why: starWhy(l, l.pos || 'S', el) }));
}
// ---------- career milestones (recorded once per player; never invented for old seasons)
const MILESTONES_S = [['g', 1, 'First career goal'], ['a', 1, 'First career assist'], ['hat', 1, 'First career hat trick'], ['g', 25, '25 career goals'], ['g', 50, '50 career goals'],
  ['g', 100, '100 career goals'], ['g', 200, '200 career goals'], ['pts', 50, '50 career points'], ['pts', 100, '100 career points'], ['pts', 250, '250 career points'], ['pts', 500, '500 career points'], ['gp', 100, '100 career games'], ['gp', 250, '250 career games']];
const MILESTONES_G = [['w', 1, 'First career win'], ['sho', 1, 'First career clean sheet'], ['w', 25, '25 career wins'], ['w', 50, '50 career wins'], ['w', 100, '100 career wins'], ['gp', 100, '100 career games']];
const careerVal = (lt, k) => k === 'pts' ? lt.g + lt.a : (lt[k] || 0);
function markPassedMilestones(p) {           // existing careers: remember what is already behind them, without inventing records
  const lt = lifetime(p.career); p.ms = p.ms || {};
  for (const [k, n] of p.pos === 'G' ? MILESTONES_G : MILESTONES_S) if (careerVal(lt, k) >= n) p.ms[k + n] = 'before';
}
function checkMilestones(save, p, g, before) {
  const out = [], lt = lifetime(p.career); p.ms = p.ms || {};
  for (const [k, n, txt] of p.pos === 'G' ? MILESTONES_G : MILESTONES_S) {
    const key = k + n;
    if (p.ms[key] || careerVal(before, k) >= n || careerVal(lt, k) < n) continue;
    const m = { id: 'm' + (save.nextId.m = (save.nextId.m || 1) + 1), pid: p.id, key, text: txt, s: save.season.num, gid: g ? g.id : null, label: g ? g.label : '', teamId: p.teamId, num: p.num };
    // the league-wide log keeps every milestone for your players and favourites, and the big ones for everyone else
    const major = (k === 'g' && n >= 100) || (k === 'pts' && n >= 250) || (k === 'w' && n >= 50) || (k === 'gp' && n >= 250);
    if (p.teamId === save.userTeamId || p.fav || major) { p.ms[key] = m.id; (save.milestones = save.milestones || []).push(m); out.push(m); }
    else { p.ms[key] = 1; out.push(Object.assign(m, { quiet: true })); }
  }
  return out;
}

// one persistent award instance (season honours and tournament honours share this)
function seasonAward(save, key, name, pid, line, extra, tag) {
  const p = P(save, pid), t = save.teams[p.teamId] || null, se = save.season;
  const a = Object.assign({ id: 'a' + (save.nextId.a++), key, name, season: se.num, year: se.year, seasonLabel: seasonLabel(se.year), pid, playerName: p.first + ' ' + p.last, num: p.num, pos: p.pos,
    teamId: p.teamId, teamName: t ? fullName(t) : '', abbr: t ? t.abbr : '', colors: t ? { ...t.colors } : null, stat: extra || statString(p.pos, line) }, tag || {});
  save.awards.push(a); p.awards.push(a.id); return a;
}
// ---------- season end: awards, trophies, history
function compactHistoryEntry(save, hs) {
  const u = hs.userTeamId || save.userTeamId;
  for (const c of [hs.playoffs].concat(Object.values(hs.tournaments || {}))) {
    if (!c || !c.rounds) continue;
    const last = c.rounds.length - 1;
    c.rounds = c.rounds.map((r, ri) => r.filter(sr => ri === last || [sr.hi, sr.lo].some(x => x && x.teamId === u)).map(sr => ri === last ? sr : Object.assign({}, sr, { scores: [] })));
    if (c.qual) for (const q of Object.values(c.qual)) delete q.name;
  }
  for (const st of hs.standings || []) { delete st.name; delete st.colors; delete st.emblem; delete st.rw; }
  if (hs.leaders) for (const k in hs.leaders) if (Array.isArray(hs.leaders[k])) hs.leaders[k] = hs.leaders[k].slice(0, 3);
  // old trophies of other teams keep their three key players
  for (const t of save.trophies) if (t.season === hs.season && t.teamId !== u && t.keyPlayers && t.keyPlayers.length > 3) { const V = save.vault = save.vault || {}; (V.keyPlayers = V.keyPlayers || {})[t.id] = t.keyPlayers.slice(); t.keyPlayers = t.keyPlayers.slice(0, 3); }
  hs.compact = true;
}
function finishSeason(save) {
  const se = save.season;
  if (se.done) return;
  const po = se.comps.po;
  const yr = se.year, lbl = seasonLabel(yr);
  const reg = pid => (se.stats[pid] || emptyCats()).reg;
  const all = Object.keys(se.stats).filter(pid => P(save, pid));
  const sk = all.filter(pid => P(save, pid).pos === 'S'), gs = all.filter(pid => P(save, pid).pos === 'G');
  const award = (key, name, pid, line, extra) => {
    if (!pid) return null;
    const p = P(save, pid), t = save.teams[p.teamId] || null;
    const a = { id: 'a' + (save.nextId.a++), key, name, season: se.num, year: yr, seasonLabel: lbl, pid, playerName: p.first + ' ' + p.last, num: p.num, pos: p.pos,
      teamId: p.teamId, teamName: t ? fullName(t) : '', abbr: t ? t.abbr : '', colors: t ? { ...t.colors } : null, stat: extra || statString(p.pos, line) };
    save.awards.push(a); p.awards.push(a.id); return a;
  };
  const by = (ids, f, minF) => ids.filter(minF || (() => true)).sort((a, b) => f(b) - f(a))[0];
  const stick = by(sk, pid => reg(pid).g * 1000 + (reg(pid).g + reg(pid).a) * 10 - reg(pid).gp * 0.01, pid => reg(pid).gp > 0);
  // MVP: season Game Impact (what they did, not their ratings) blended with production
  const mvpScore = pid => { const l = reg(pid), p = P(save, pid); if (l.gpi) return l.imp / 10 * (p.pos === 'G' ? 0.72 : 1) + (p.pos === 'G' ? 0 : (l.g + l.a) * 0.25);
    return p.pos === 'G' ? (l.gp >= 5 ? (svPct(l) - 0.9) * 100 + l.w * 0.8 : -99) : l.g * 1.2 + l.a + l.pm * 0.25 + l.hit * 0.03; };
  const mvp = by(all, mvpScore, pid => reg(pid).gp >= 5);
  // Golden Glove = goalie of the year: goals saved above expected, then save percentage (workload minimum)
  const glove = by(gs, pid => { const l = reg(pid); return (l.xga - l.ga * 100) / 100 * 10 + svPct(l) * 100 + l.w * 0.1; }, pid => reg(pid).gp >= 4 && reg(pid).sa >= 30);
  const rookieIds = all.filter(pid => { const p = P(save, pid); return !p.seasons.length && ((p.draft && p.draft.season === se.num - 1) || (se.num === 1 && p.age <= 21) || (p.joined === se.num && p.age <= 22)); });
  const rookie = by(rookieIds, pid => reg(pid).imp / 10 * (P(save, pid).pos === 'G' ? 0.72 : 1) + (reg(pid).g + reg(pid).a) * 0.3, pid => reg(pid).gp >= 4);
  const defp = by(sk, pid => reg(pid).dimp / 10 + reg(pid).ds * 0.3 + reg(pid).bws * 0.5, pid => reg(pid).gp >= 5 && reg(pid).gpi > 0);
  const poStat = pid => (se.stats[pid] || emptyCats()).po;
  const pmvp = po && po.done ? by(all.filter(pid => poStat(pid).gp > 0), pid => { const onC = ((po.statsTeam || {})[pid] || P(save, pid).teamId) === po.champion, sc = compScore(poStat(pid), onC) * (P(save, pid).pos === 'G' ? 0.82 : 1); return onC ? sc * 1.25 : sc; }) : null;
  const aw = [
    award('stick', 'Golden Boot', stick, stick && reg(stick), stick ? `${reg(stick).g} goals in ${reg(stick).gp} games` : ''),
    award('mvp', 'League MVP', mvp, mvp && reg(mvp)),
    award('glove', 'Golden Glove', glove, glove && reg(glove), glove ? `${fmtSv(svPct(reg(glove)))} SV%` + (reg(glove).xga ? `, ${((reg(glove).xga - reg(glove).ga * 100) / 100).toFixed(1)} GSAx` : '') : ''),
    award('rookie', 'Rookie of the Year', rookie, rookie && reg(rookie)),
    award('def', 'Defensive Player of the Year', defp, defp && reg(defp), defp ? `${reg(defp).ds} defensive stops, ${reg(defp).tk} takeaways, ${reg(defp).bws} breakaway${reg(defp).bws === 1 ? '' : 's'} broken up` : ''),
    award('pmvp', 'Playoff MVP', pmvp, pmvp && poStat(pmvp)),
  ].filter(Boolean);
  // ---- AWARDS NIGHT: the new awards, three finalists for each, the All-Star teams, and the GM of the Year
  const fin3 = (ids, f, minF) => ids.filter(minF || (() => true)).sort((a, b) => f(b) - f(a)).slice(0, 3);
  const pts = pid => reg(pid).g + reg(pid).a, prevSeason = pid => { const ss = P(save, pid).seasons || []; return ss.length ? ss[ss.length - 1] : null; };
  const isD = pid => /D$/.test(P(save, pid).spos || '');
  const EXTRA = [
    ['points', 'Point Leader', sk, pid => pts(pid) * 1000 + reg(pid).g, pid => reg(pid).gp > 0, pid => `${pts(pid)} points (${reg(pid).g}G ${reg(pid).a}A)`],
    ['bestd', 'Best Defender', sk.filter(isD), mvpScore, pid => reg(pid).gp >= 8, null],
    ['improved', 'Most Improved Player', all, pid => { const pv = prevSeason(pid); return pv ? ovrInt(P(save, pid)) - (pv.ovr || 0) + pts(pid) * 0.05 : -99; }, pid => reg(pid).gp >= 8 && !!prevSeason(pid), pid => { const pv = prevSeason(pid); return `Overall ${pv.ovr} → ${ovrInt(P(save, pid))}`; }],
    ['iron', 'Iron Man', sk, pid => reg(pid).gp * 10000 + reg(pid).toi, pid => reg(pid).gp >= 10, pid => `${reg(pid).gp} games, ${Math.round(reg(pid).toi / 60)} minutes on the pitch`],
    ['hammer', 'The Hammer', sk, pid => reg(pid).hit, pid => reg(pid).gp >= 8, pid => `${reg(pid).hit} tackle${reg(pid).hit === 1 ? '' : 's'}`],   // SOCCER: tackles (slide tackles + shoulder charges, the TKL stat)
    ['sport', 'Sportsmanship Award', sk, pid => -reg(pid).pim * 100 + pts(pid) * 3 + reg(pid).gp, pid => reg(pid).gp >= 12 && pts(pid) >= 5, pid => `${pts(pid)} points, ${Math.round(reg(pid).pim / (BAL.pen.len || 30))} card${Math.round(reg(pid).pim / (BAL.pen.len || 30)) === 1 ? '' : 's'}`],
    ['clutch', 'Clutch Performer', all, pid => reg(pid).cv, pid => reg(pid).gp >= 8 && reg(pid).cv > 0, null],
    ['comeback', 'Comeback Player', all, mvpScore, pid => { const pv = prevSeason(pid); return reg(pid).gp >= 10 && !!pv && (pv.gp || 0) < 12; }, null],
  ];
  const finalists = {};
  for (const [k, , ids, f, mf, stat] of EXTRA) {
    const top3 = fin3(ids, f, mf); finalists[k] = top3;
    const a = top3.length ? award(k, EXTRA.find(x => x[0] === k)[1], top3[0], reg(top3[0]), stat ? stat(top3[0]) : null) : null;
    if (a) aw.push(a);
  }
  // finalists for the original six, with the same scoring the winner was picked by
  finalists.stick = fin3(sk, pid => reg(pid).g * 1000 + pts(pid) * 10, pid => reg(pid).gp > 0);
  finalists.mvp = fin3(all, mvpScore, pid => reg(pid).gp >= 5);
  finalists.glove = fin3(gs, pid => { const l = reg(pid); return (l.xga - l.ga * 100) / 100 * 10 + svPct(l) * 100 + l.w * 0.1; }, pid => reg(pid).gp >= 4 && reg(pid).sa >= 30);
  finalists.rookie = fin3(rookieIds, pid => reg(pid).imp / 10 * (P(save, pid).pos === 'G' ? 0.72 : 1) + pts(pid) * 0.3, pid => reg(pid).gp >= 4);
  finalists.def = fin3(sk, pid => reg(pid).dimp / 10 + reg(pid).ds * 0.3 + reg(pid).bws * 0.5, pid => reg(pid).gp >= 5 && reg(pid).gpi > 0);
  if (pmvp) finalists.pmvp = fin3(all.filter(pid => poStat(pid).gp > 0), pid => compScore(poStat(pid), ((po.statsTeam || {})[pid] || P(save, pid).teamId) === po.champion));
  for (const k in finalists) { const w0 = aw.find(a => a.key === k); if (w0 && finalists[k][0] !== w0.pid) finalists[k] = [w0.pid].concat(finalists[k].filter(x => x !== w0.pid)).slice(0, 3); }
  // ALL-STAR TEAMS (3-on-3): the two best on each side (L, C, R), the two best stay-at-home D, and the two best goalies
  const allStars = { first: [], second: [], pos: ['L', 'C', 'R', 'D', 'G'] }, picked = new Set();
  for (const pos of allStars.pos) {
    const fits = pid => { const s0 = P(save, pid).spos; return pos === 'D' ? s0 === 'LD' || s0 === 'RD' : sideOf(s0) === pos; };
    const ids = (pos === 'G' ? gs : sk.filter(pid => !picked.has(pid) && fits(pid))).filter(pid => reg(pid).gp >= 8).sort((a, b) => mvpScore(b) - mvpScore(a));
    ids.slice(0, 2).forEach(pid => picked.add(pid));
    allStars.first.push(ids[0] || null); allStars.second.push(ids[1] || null);
    ids.slice(0, 2).forEach((pid, i) => { const pl = P(save, pid); (pl.allStar = pl.allStar || []).push({ s: se.num, year: yr, team: i + 1, pos }); });
  }
  // GM OF THE YEAR: the club that did the most with what it had (its points, plus how much it improved on last season)
  const lastH = save.history.length ? save.history[save.history.length - 1] : null;
  const prevPts = id => { const r = lastH && (lastH.standings || []).find(x => x.teamId === id); return r ? r.pts : null; };
  const gmScore = id => { const st = se.standings[id], pv = prevPts(id); return st.pts + (pv != null ? (st.pts - pv) * 1.5 : 0); };
  const gmTop = save.teamOrder.slice().sort((a, b) => gmScore(b) - gmScore(a)).slice(0, 3);
  const gmYear = { teamId: gmTop[0], finalists: gmTop, why: (() => { const st = se.standings[gmTop[0]], pv = prevPts(gmTop[0]); return `${st.w}-${st.otl}-${st.l}, ${st.pts} points` + (pv != null ? ` (${st.pts - pv >= 0 ? '+' : ''}${st.pts - pv} on last season)` : ''); })() };
  // AWARDS MATTER: fame and mood for winners and finalists, your GM reputation for your players' honours
  const boost = (pid, fame, mood, label) => { const pl = P(save, pid); if (!pl) return;
    if (typeof addFame === 'function') addFame(pl, fame);
    if (typeof moraleOf === 'function' && typeof mDay === 'function') moraleOf(pl).fx.push({ label, v: mood, d: mDay(save), len: 45 }); };
  const user = save.userTeamId; let repGain = 0;
  for (const a of aw) { boost(a.pid, 8, 8, 'Won the ' + a.name); if (a.teamId === user) repGain += 1.5; }
  for (const k in finalists) for (const pid of finalists[k].slice(1)) boost(pid, 3, 3, 'Finalist: ' + ((aw.find(a => a.key === k) || {}).name || 'award'));
  allStars.first.forEach(pid => { if (pid) { boost(pid, 5, 5, 'First Team All-Star'); if (P(save, pid).teamId === user) repGain += 1; } });
  allStars.second.forEach(pid => { if (pid) { boost(pid, 3, 3, 'Second Team All-Star'); if (P(save, pid).teamId === user) repGain += 0.5; } });
  if (gmYear.teamId === user) repGain += 6;
  if (repGain && typeof gmRep === 'function') gmRep(save, repGain);
  if (gmYear.teamId === user) pushNews(save, 'AWARDS NIGHT: you are the GM of the Year!');
  // leaders
  const top = (ids, f, n = 5) => ids.filter(pid => reg(pid).gp > 0).sort((a, b) => f(b) - f(a)).slice(0, n).map(pid => {
    const p = P(save, pid), t = save.teams[p.teamId]; return { pid, name: p.first + ' ' + p.last, num: p.num, abbr: t ? t.abbr : '', v: f(pid) }; });
  const leaders = {
    goals: top(sk, pid => reg(pid).g), assists: top(sk, pid => reg(pid).a), points: top(sk, pid => reg(pid).g + reg(pid).a),
    svp: top(gs.filter(pid => reg(pid).gp >= 4), pid => +svPct(reg(pid)).toFixed(3)),
  };
  const tsnap = id => { const t = save.teams[id]; return { teamId: id, name: fullName(t), abbr: t.abbr, colors: { ...t.colors }, emblem: t.emblem }; };
  const tmin = id => ({ teamId: id, abbr: save.teams[id].abbr });
  const reachOf = c => { const o = {}; c.rounds.forEach((r, ri) => r.forEach(sr => { o[sr.hi] = ri; o[sr.lo] = ri; })); return o; };
  const compSnap = c => c && c.done ? { name: c.name, champion: tsnap(c.champion), runnerUp: tsnap(c.runnerUp), mvp: c.mvp, result: c.result, awards: c.awards || null, reach: reachOf(c), nr: c.rounds.length,
    qual: c.qual ? Object.fromEntries(Object.entries(c.qual).map(([id, q]) => [id, Object.assign({ name: fullName(save.teams[id]) }, q)])) : null, declined: c.declined || null,
    rounds: c.rounds.map((r, ri) => r.map(sr => ({ hi: tmin(sr.hi), lo: tmin(sr.lo), winsHi: sr.winsHi, winsLo: sr.winsLo, winner: sr.winner, bestOf: sr.bestOf,
      scores: (ri >= c.rounds.length - 2 || sr.hi === save.userTeamId || sr.lo === save.userTeamId) ? sr.gids.map(id => { const g = se.games[id]; return { home: save.teams[g.home].abbr, away: save.teams[g.away].abbr, hs: g.hs, as: g.as, ot: g.ot, so: g.so }; }) : [] }))) } : null;
  const order = sortedStandings(save);
  // older seasons keep results, not every series: compact anything more than eight seasons back
  for (const hs of save.history) if (!hs.compact && hs.season <= se.num - 8) compactHistoryEntry(save, hs);
  for (const p of Object.values(save.players)) {
    if (p.status !== 'retired') continue;
    if (!p.compact || p.compact < 2) compactRetired(save, p);
    // ten seasons on, careers with no tie to your franchise keep their totals and honours, not every season
    if (p.compact === 2 && p.retired <= se.num - 10 && !p.fav && !(p.memo || []).length && !(p.seasons || []).some(x => x.teamId === save.userTeamId)) {
      if ((p.seasons || []).length) { p.teamsPlayed = [...new Set(p.seasons.map(x => x.abbr))]; p.seasonsN = p.seasons.length; p.peakOvr = Math.max(...p.seasons.map(x => x.ovr || 0)); p.seasons = []; }
      delete p.best; delete p.hats; delete p.starsHist; p.compact = 3;
    }
  }
  const finRecs = typeof closeFinances === 'function' ? closeFinances(save) : {};
  save.history.push({
    season: se.num, year: yr, label: lbl, fin: finRecs[save.userTeamId] || null,
    standings: order.map(id => Object.assign({ teamId: id, name: fullName(save.teams[id]), abbr: save.teams[id].abbr, div: se.divOf[id] }, se.standings[id])),
    divs: se.divs.map(d => d.slice()), special: Object.fromEntries(Object.entries(se.teamStats || {}).map(([id, v]) => [id, [v.ppo, v.ppg, v.pk, v.pkga, v.fights]])),
    champion: po && po.done ? tsnap(po.champion) : null, runnerUp: po && po.done ? tsnap(po.runnerUp) : null, champMvp: po ? po.mvp : null,
    playoffs: compSnap(po), tournaments: Object.fromEntries(TOUR_KEYS.map(k => [k, compSnap(se.comps[k])])),
    leaders, awards: aw.map(a => a.id), finalists, allStars, gmYear, awardsNight: true, userTeamId: save.userTeamId, userFinish: order.indexOf(save.userTeamId) + 1, userRecord: { ...se.standings[save.userTeamId] },
  });
  // archive each player's season line
  for (const pid of all) {
    const p = P(save, pid), t = save.teams[p.teamId];
    { const e = Object.assign({ s: se.num, year: yr, teamId: p.teamId, abbr: t ? t.abbr : 'FA', num: p.num, ovr: ovrInt(p) }, archiveCats(se.stats[pid])); const cp = leaderOf(t, p.id); if (cp) e.cap = cp; p.seasons.push(e); }
  }
  for (const id of save.teamOrder) { const t = save.teams[id], L = teamLeaders(t); (t.capHist = t.capHist || []).push({ s: se.num, c: L.c, a: L.a.slice() }); }
  if (typeof onSeasonFinal === 'function') onSeasonFinal(save);
  se.done = true;
  pushNews(save, `Season ${lbl} complete. Champion: ${po && po.done ? fullName(save.teams[po.champion]) : '-'}`);
  runOffseason(save);
}

// archived season lines keep the stats the history screens use (the full per-game detail lives only in the current season)
const ARCH_KEYS = ['gp', 'g', 'a', 'pm', 'toi', 'sog', 'hit', 'sa', 'sv', 'ga', 'w', 'hat', 'sho', 'xg', 'xga', 'ds', 'tk', 'imp', 's1', 's2', 's3', 'gpi', 'ppg', 'shg', 'eng', 'pim', 'fw', 'fl', 'pen'];
function archiveCats(cats) {
  const o = {};
  for (const c of CATS) if (cats && cats[c] && (cats[c].gp || cats[c].toi)) { const l = {}; for (const k of ARCH_KEYS) if (cats[c][k]) l[k] = cats[c][k]; o[c] = l; }
  return o;
}
// ---------- offseason: aging, development, retirement, AI draft, user draft offer
// Development follows potential until a personal peak age (24-30), plateaus for a few years, then declines.
function develop(save, p, st) {
  const toi = st ? (st.reg.toi + st.po.toi + st.tour.toi) : 0;
  const perf = st ? (p.pos === 'G' ? svPct(st.reg) - 0.88 : (st.reg.g + st.reg.a) / Math.max(1, st.reg.gp)) : 0;
  const keys = (p.pos === 'G' ? G_ATTRS : SK_ATTRS).map(k => k[0]);
  const peak = p.peak || 27, dm = traitMul(p, 'devMul');
  if (p.dv) return developDv(p, keys, toi, perf, dm * (typeof OFF_DEV !== 'undefined' ? OFF_DEV : 1));
  for (const k of keys) {
    let v = p.attrs[k];
    if (p.age <= peak && overall(p) < p.pot) { if (Math.random() < (0.12 + Math.min(0.15, toi / 3500) + Math.max(0, Math.min(0.1, perf * 0.1))) * dm * (typeof OFF_DEV !== 'undefined' ? OFF_DEV : 1)) v++; }
    else if (p.age <= peak + 3) { const r = Math.random(); if (r < 0.05 * dm && overall(p) < p.pot + 0.5) v++; else if (r > 0.94) v--; }
    else if (Math.random() < (p.age - peak - 3) * 0.06 * (k === 'spd' || k === 'sta' || k === 'rec' ? 1.4 : 1) * condSlow(save, p, k)) v--;
    p.attrs[k] = clampI(v, 1, 10);
  }
}
// a conditioning coach slows a veteran's physical decline (10% per level, your club)
function condSlow(save, p, k) { if (!save || p.teamId !== save.userTeamId || !['spd', 'sta', 'rec'].includes(k) || typeof teamDev !== 'function') return 1; const t = save.teams[p.teamId]; return t ? 1 - 0.1 * (teamDev(t).coaches.cond || 0) : 1; }
// who stays in the record books with full season-by-season detail once retired
const MAJOR_AWARDS = ['mvp', 'stick', 'glove', 'def', 'rookie', 'pmvp'];
function isNotable(save, p) {
  if (p.fav || (p.capTitles || []).length || (p.leadStyles || []).length || (p.memo || []).length) return true;
  const withUs = (p.seasons || []).filter(s => s.teamId === save.userTeamId);
  if (withUs.length >= 2 || withUs.reduce((a, s) => a + ((s.reg || {}).gp || 0), 0) >= 30) return true;
  if ((p.awards || []).some(id => { const a = save.awards.find(x => x.id === id); return a && MAJOR_AWARDS.includes(a.key); })) return true;
  const lt = lifetime(p.career);
  return p.pos === 'G' ? lt.w >= 120 : lt.g + lt.a >= 260;
}
// retired players are compacted: identity, career totals, honours; season detail only for notable careers
const RETIRED_KEEP = ['id', 'first', 'last', 'pos', 'spos', 'hand', 'txh', 'num', 'age', 'arch', 'status', 'retired', 'lastTeamId', 'teamId', 'career', 'seasons', 'awards', 'look', 'attrs', 'pot',
  'traits', 'leadStyles', 'capTitles', 'memo', 'fav', 'starsHist', 'starsN', 'hats', 'best', 'teamsPlayed', 'seasonsN', 'draft', 'joined', 'ufw', 'injN', 'retiredWhy', 'compact', 'vault'];
function compactRetired(save, p) {
  if (p.compact >= 2) return;
  const before = JSON.parse(JSON.stringify(p));                    // Nov 23: what compaction removes goes to p.vault, not the bin
  compactRetired0(save, p);
  const V = before.vault || {};
  for (const k of Object.keys(before)) if (k !== 'compact' && k !== 'vault' && JSON.stringify(p[k]) !== JSON.stringify(before[k])) { if (!(k in V)) V[k] = before[k]; }
  if (Object.keys(V).length) p.vault = V;
}
// THE VAULT: details the screens no longer show (a retired player's full record, old transactions and milestones,
// full key-player lists) are kept here instead of deleted. The store writes it as its own section, compressed and
// rarely rewritten. Restoring a retired player's full record: Object.assign({}, p, p.vault).
function vaultPush(save, key, items) { if (!items || !items.length) return; const V = save.vault = save.vault || {}; (V[key] = V[key] || []).push(...items); }
function compactRetired0(save, p) {
  const notable = isNotable(save, p);
  // career lines keep the record-book numbers only
  for (const c of CATS) if (p.career && p.career[c]) { const l = {}; for (const k of ARCH_KEYS) if (p.career[c][k]) l[k] = p.career[c][k]; p.career[c] = fullLine(l); }
  if (p.injHist) p.injN = p.injHist.length;
  for (const k of Object.keys(p)) if (!RETIRED_KEEP.includes(k)) delete p[k];
  if (!notable) { delete p.best; delete p.hats; if (p.starsHist) { p.starsN = (p.starsN || 0) + p.starsHist.length; delete p.starsHist; } }
  else if (!(p.seasons || []).some(x => x.teamId === save.userTeamId)) {          // notable elsewhere: regular season + playoffs per season, a short highlight list
    for (const x of p.seasons || []) { delete x.tour; delete x.exh; delete x.year; }
    if (p.best) p.best = p.best.slice(0, 1);
    if (p.starsHist) { p.starsN = (p.starsN || 0) + p.starsHist.length; delete p.starsHist; }
    if (p.hats && p.hats.length > 2) p.hats = p.hats.slice(-2);
  }
  p.compact = 2;
  const keepSeasons = notable;
  if (!keepSeasons) { p.teamsPlayed = [...new Set((p.seasons || []).map(s => s.abbr))]; p.seasonsN = (p.seasons || []).length; p.seasons = []; }
  delete p.form; delete p.injHist; delete p.inj; delete p.cond;
  if (p.best) p.best = p.best.slice(0, keepSeasons ? 3 : 1);
  if (p.starsHist && p.starsHist.length > 6) { p.starsN = (p.starsN || 0) + p.starsHist.length - 6; p.starsHist = p.starsHist.slice(-6); }
  if (p.hats && p.hats.length > 4) p.hats = p.hats.slice(-4);
}
function retirePlayer(save, p, why) {
  const t = p.teamId ? save.teams[p.teamId] : null;
  if (t) removeFromRoster(t, p.id);
  p.lastTeamId = p.teamId || p.lastTeamId; p.teamId = null; p.status = 'retired'; p.retired = save.season.num;
  logTx(save, 'retire', { pid: p.id, teamId: p.lastTeamId });
  if (t && t.id === save.userTeamId) pushNews(save, `${p.first} ${p.last} (#${p.num}) retires at ${p.age}.`);
  compactRetired(save, p);
}
function releasePlayer(save, pid) {
  const p = P(save, pid), t = save.teams[p.teamId];
  if (t) removeFromRoster(t, pid);
  p.lastTeamId = p.teamId; p.teamId = null; p.status = 'free'; p.freeSince = save.season ? save.season.num : save.seasonNum; p.contract = null; p.block = false;
  logTx(save, 'release', { pid, teamId: p.lastTeamId });
}
// depth signing: the best unsigned free agent at the position the roster needs (a new player only if nobody is left)
function signDepth(save, team, pos, spos) {
  const free = Object.values(save.players).filter(p => p.status === 'free' && p.pos === pos && p.age < 35).sort((a, b) => (overall(b) + (spos && b.spos === spos ? 0.6 : 0)) - (overall(a) + (spos && a.spos === spos ? 0.6 : 0)))[0];
  const p = free || registerPlayer(save, genPlayer(Math.random, pos, { q: 3.6 + Math.random() * 1.4, age: ri(23, 30), spos }));
  p.joined = p.joined || save.seasonNum; p.freeSince = null; p.status = 'active';
  addToRoster(save, team, p.id);
  if (typeof ensureContract === 'function') { p.contract = null; ensureContract(save, p, team, 'depth'); if (save.off) p.contract.s = save.season.num + 1; }
  logTx(save, 'sign', { pid: p.id, teamId: team.id });
  return p;
}
const POS_TARGET = { LW: 3, C: 3, RW: 3, LD: 1.5, RD: 1.5 };
const neededSpos = (save, t) => { const c = { LW: 0, C: 0, RW: 0, LD: 0, RD: 0 }; for (const id of rosterSkaters(t)) c[P(save, id).spos] = (c[P(save, id).spos] || 0) + 1; return NAT_POS.slice().sort((a, b) => c[a] / POS_TARGET[a] - c[b] / POS_TARGET[b])[0]; };
function fillRoster(save, t, news) {
  const out = [];
  while (rosterSkaters(t).length < 12) out.push(signDepth(save, t, 'S', neededSpos(save, t)));
  while (rosterGoalies(t).length < 3) out.push(signDepth(save, t, 'G'));
  if (news) for (const p of out) pushNews(save, `Signed ${p.first} ${p.last} (${posLabel(p)}) to fill out the roster.`);
  return out;
}
function runOffseason(save) {
  const se = save.season;
  if (typeof devOffseason === 'function') devOffseason(save);
  for (const p of Object.values(save.players)) {
    if (p.status === 'retired' || p.status === 'pool') continue;
    if (p.potR) narrowPot(p, 0.6);                               // a season of evidence narrows what scouts believe
    if (save.dream && save.dream.aging === false && p.teamId === save.userTeamId) { p.cond = BAL.cond.start; p.inj = null; continue; }   // Dream Team, development frozen: your creations stay as built
    p.age++;
    develop(save, p, se.stats[p.id]);
    if (typeof offseasonProgress === 'function') offseasonProgress(save, p, se.stats[p.id]);
    p.cond = BAL.cond.start; p.inj = null;                       // a summer heals everything
    const ovr = overall(p);
    let pr = p.age >= 40 ? 1 : p.age >= 34 ? 0.12 + (p.age - 34) * 0.16 : 0;
    if (p.age >= 31 && ovr < 3.5) pr += 0.15;
    if (p.status === 'free') { const yrs = se.num - (p.freeSince || se.num); if (p.age >= 31) pr += 0.3; if (yrs >= 2 && p.age >= 27) pr += 0.5; if (yrs >= 4) pr = 1; }
    if (Math.random() < pr) retirePlayer(save, p);
  }
  const order = sortedStandings(save);
  for (const id of save.teamOrder) {
    if (id === save.userTeamId) continue;
    const t = save.teams[id], ai = t.ai || (t.ai = { strat: 'balanced' });
    // franchise direction: bottom teams with an old core rebuild, top teams push to contend
    const place = order.indexOf(id), ages = rosterSkaters(t).map(x => P(save, x).age), avgAge = ages.reduce((a, b) => a + b, 0) / Math.max(1, ages.length);
    if (place >= 18 && avgAge > 27) ai.strat = 'youth'; else if (place <= 5) ai.strat = 'contend'; else if (Math.random() < 0.2) ai.strat = pickR(AI_STRATS);
    // contenders upgrade from the free-agent pool when someone clearly better is available
    if (ai.strat === 'contend') {
      const fa = Object.values(save.players).filter(p => p.status === 'free' && p.pos === 'S' && p.age < 33).sort((a, b) => overall(b) - overall(a))[0];
      const worst = rosterSkaters(t).map(i => P(save, i)).sort((a, b) => overall(a) - overall(b))[0];
      if (fa && worst && overall(fa) > overall(worst) + 0.8 && (typeof payroll !== 'function' || payroll(save, t) - salOf(worst) + worth(fa) <= FIN.cap + 600)) { releasePlayer(save, worst.id); fa.status = 'active'; fa.freeSince = null; addToRoster(save, t, fa.id); logTx(save, 'fa', { pid: fa.id, teamId: id }); if (typeof setContract === 'function') { setContract(save, fa, t, worth(fa), prefYears(fa), 'standard'); fa.contract.s = se.num + 1; } }
    }
    fillRoster(save, t);
    autoArrange(save, t);
    autoLeaders(save, t);
  }
  // your vacated letters are filled (you can change them any time)
  const ut = save.teams[save.userTeamId];
  for (const p of autoLeaders(save, ut, true)) pushNews(save, `${p.first} ${p.last} takes over a vacant letter (${leaderOf(ut, p.id)}).`);
  if (save.draftHistory.length > 3000) save.draftHistory.splice(0, save.draftHistory.length - 3000);
  if (save.milestones && save.milestones.length > 2700) vaultPush(save, 'milestones', save.milestones.splice(0, save.milestones.length - 2500));
  createDraftClass(save);
  if (typeof startOffseason === 'function') startOffseason(save);
}
function startNextSeason(save) {
  const user = save.teams[save.userTeamId];
  if (save.draft && save.draft.v === 2) { if (!save.draft.done) rdAutoAll(save); for (const kid of save.draft.mine.slice()) rdLetGo(save, kid); }
  save.off = null; save.neg = {}; save.tradeOffers = [];
  fillRoster(save, user, true);
  for (const id of save.teamOrder) { const t = save.teams[id]; if (rosterSkaters(t).length < 12 || rosterGoalies(t).length < 3) fillRoster(save, t); }
  if (typeof initContracts === 'function') initContracts(save);
  fillLinesFromReserves(user.roster); compactGoalies(user.roster);
  save.seasonNum++;
  save.draft = null;
  newSeason(save);
}

// ---------- highlight archive: clips live once in save.clips; trophies, players and teams only reference ids
const CLIP_AUTO_CAP = 60;
const CLIP_KIND_NAMES = { goal: 'Goal', so: 'Shootout goal', save: 'Save', hit: 'Big tackle', deke: 'Feint' };
// a finished user game hands over its recorded clips; tag them with stable context and keep the good ones
function archiveGameClips(save, g, res, opts = {}) {
  if (!res || !res.clips || !res.clips.length) return [];
  save.clips = save.clips || {}; save.nextId.c = save.nextId.c || 1;
  const se = save.season, user = save.userTeamId, opp = opts.opp;
  const slotTeam = [user, opp];
  const st = g && g.comp ? gameStage(save, g) : { key: g && g.type === 'reg' ? 'reg' : 'exh', tier: 0, round: g ? (g.type === 'reg' ? 'Regular Season' : 'Exhibition') : 'Exhibition', final: false };
  // decisive goal of this game: the winner's goal that put them ahead for good, or the winning shootout goal
  const winSlot = res.score[0] > res.score[1] ? 0 : 1;
  let gwIdx = -1;
  if (!res.so && res.goals) { const lg = res.score[1 - winSlot]; let n = 0; res.goals.forEach((x, i) => { if (x.team === winSlot) { if (n === lg) gwIdx = i; n++; } }); }
  const soWin = res.so ? res.clips.filter(c => c.kind === 'so' && c.meta.team === winSlot).pop() : null;
  const out = [];
  for (const c of res.clips) {
    const id = 'c' + (save.nextId.c++);
    const m = Object.assign({}, c.meta);
    m.teamId = slotTeam[m.team] || null;
    if (c.kind === 'goal' && m.goalIdx === gwIdx && gwIdx >= 0) { m.gwg = true; c.imp += 15; }
    if (c === soWin) { m.gwg = true; m.soWinner = true; c.imp += 20; }
    if (st.tier) c.imp += st.tier * 8;
    if (st.final && m.gwg) c.imp += 10;
    if (!g) c.imp -= 20;                                       // exhibitions are the first to go
    const ctx = { season: se.num, year: se.year, seasonLabel: seasonLabel(se.year), gameId: g ? g.id : null, type: g ? g.type : 'exh', comp: g ? g.comp || null : null,
      compName: g && g.comp ? COMP_INFO[g.comp].name : null, editionId: st.editionId || null, round: st.round, final: !!st.final, tier: st.tier || 0,
      label: g ? g.label : 'Exhibition', teamIds: slotTeam.slice(), home: opts.userHome ? user : opp, score: res.score.slice() };
    save.clips[id] = Object.assign(c, { id, meta: m, ctx, auto: !c.kept, created: Date.now() });   // kept from the end-of-game show: never recycled
    out.push(id);
  }
  pruneClips(save);
  return out.filter(id => save.clips[id]);
}
const clipPinned = (save, c) => !c.auto || c.legendary || save.trophies.some(t => (t.clipIds || []).includes(c.id));
function pruneClips(save) {
  const auto = Object.values(save.clips).filter(c => !clipPinned(save, c));
  if (auto.length <= CLIP_AUTO_CAP) return;
  auto.sort((a, b) => (a.imp - b.imp) || (a.created - b.created));
  for (const c of auto.slice(0, auto.length - CLIP_AUTO_CAP)) delete save.clips[c.id];
}
// after a competition ends on a user-played game: crown the decisive clip as a Legendary Moment
function crownChampionshipClip(save, trophy, clipIds) {
  if (!trophy || !clipIds.length) return null;
  const cs = clipIds.map(id => save.clips[id]).filter(Boolean);
  const dec = cs.find(c => c.meta.gwg) || cs.filter(c => c.kind === 'goal' || c.kind === 'so').pop() || cs.slice().sort((a, b) => b.imp - a.imp)[0];
  if (!dec) return null;
  dec.legendary = true; dec.imp = 100; dec.auto = false; dec.meta.decisive = true;
  dec.ctx.trophyId = trophy.id;
  trophy.decisiveClip = dec.id;
  for (const c of cs) if (c === dec || c.meta.gwg || c.meta.ot || c.imp >= 60) { if (!trophy.clipIds.includes(c.id)) trophy.clipIds.push(c.id); c.ctx.trophyId = trophy.id; }
  return dec.id;
}
const clipsForPlayer = (save, pid) => Object.values(save.clips || {}).filter(c => (c.meta.players || []).includes(pid) || c.meta.scorer === pid);
const clipsForTeam = (save, tid) => Object.values(save.clips || {}).filter(c => c.ctx && c.ctx.teamIds.includes(tid));
// clips that may hang on this trophy: same competition edition only
const clipEligible = (trophy, c) => !!(c && c.ctx && trophy.editionId && c.ctx.editionId === trophy.editionId);
function attachClip(save, trophyId, clipId) {
  const t = save.trophies.find(x => x.id === trophyId), c = save.clips[clipId];
  if (!t || !c || !clipEligible(t, c)) return 'That highlight is from a different competition.';
  t.clipIds = t.clipIds || [];
  if (!t.clipIds.includes(clipId)) t.clipIds.push(clipId);
  return null;
}
function detachClip(save, trophyId, clipId) {
  const t = save.trophies.find(x => x.id === trophyId); if (!t) return;
  t.clipIds = (t.clipIds || []).filter(id => id !== clipId);
  if (t.decisiveClip === clipId) t.decisiveClip = null;
}
// deleting a clip from the archive removes every reference to it (trophies keep everything else)
function deleteClip(save, clipId) {
  delete save.clips[clipId];
  for (const t of save.trophies) { if (t.clipIds) t.clipIds = t.clipIds.filter(id => id !== clipId); if (t.decisiveClip === clipId) t.decisiveClip = null; }
}
// the one to show on WATCH CHAMPIONSHIP MOMENT
function trophyMoments(save, t) {
  const cs = (t.clipIds || []).map(id => save.clips[id]).filter(Boolean);
  const rank = c => (c.id === t.decisiveClip ? 1000 : 0) + (c.meta.decisive ? 500 : 0) + (c.meta.gwg && c.ctx.final ? 300 : 0) + (c.meta.ot ? 120 : 0) + (c.ctx.final ? 50 : 0) + c.imp;
  return cs.sort((a, b) => rank(b) - rank(a));
}

// ---------- integrity checks (used by tests, on load and on import)
function validateSave(save) {
  const errs = [];
  if (!save || !isSaveFormat(save.format)) return ["Not a Pixel Soccer franchise file."];
  if (typeof save.version !== 'number' || save.version > SAVE_VERSION) errs.push('This save comes from a newer version of the game.');
  if (save.version < 5) return ['This save was made before the 24-team league update and can no longer be continued. Start a new franchise.'];
  for (const k of ['id', 'teams', 'players', 'season', 'history', 'trophies', 'awards', 'userTeamId']) if (save[k] == null) errs.push('Missing ' + k);
  if (errs.length) return errs;
  if (!save.teams[save.userTeamId]) errs.push('Controlled team missing.');
  if (save.teamOrder.length !== 24 || new Set(save.teamOrder).size !== 24) errs.push('The league must have 24 distinct franchises.');
  const owner = {};
  for (const t of Object.values(save.teams)) {
    const ids = orgIds(t);
    if (farmIds(t).length > FARM.size) errs.push(t.id + ': farm team over ' + FARM.size);
    if (rosterSkaters(t).length > 12) errs.push(t.id + ': too many players');
    if (rosterGoalies(t).length > 3) errs.push(t.id + ': too many keepers');
    if (new Set(ids).size !== ids.length) errs.push(t.id + ': player listed twice');
    const nums = ids.map(id => save.players[id] ? save.players[id].num : -1);
    if (nums.includes(-1)) errs.push(t.id + ': unknown player on roster');
    if (new Set(nums).size !== nums.length) errs.push(t.id + ': duplicate jersey numbers');
    for (const id of ids) {
      if (save.players[id] && save.players[id].teamId !== t.id) errs.push(id + ': team mismatch');
      if (owner[id]) errs.push(id + ': on two rosters'); owner[id] = t.id;
      const pl = save.players[id]; if (pl && pl.traits && pl.traits.length > 3) errs.push(id + ': more than three traits');
    }
  }
  if (save.season && save.season.divs && (save.season.divs.length !== 4 || save.season.divs.some(d => d.length !== 6))) errs.push('Invalid divisions.');
  const tids = new Set(save.trophies.map(t => t.id)); if (tids.size !== save.trophies.length) errs.push('Duplicate trophy ids');
  return errs;
}
// stat lines are written sparse (zeros dropped) and restored on load; keeps long franchises small
const isStatLine = v => v && typeof v === 'object' && !Array.isArray(v) && 'toi' in v && 'gp' in v && 'sv' in v && 'g' in v;
// storage encoding: live stat lines are written sparse; archived season lines (player.seasons[].reg/po/tour/exh)
// become plain number arrays in ARCH_KEYS order (trailing zeros trimmed). hydrateSave restores both.
const isSeasonEntry = o => o && typeof o === 'object' && 's' in o && 'abbr' in o && 'teamId' in o;
// two key orders so the zeros of the other position don't take space: skaters 'S', goalies 'G'
const ARCH_S = ['gp', 'g', 'a', 'pm', 'toi', 'sog', 'hit', 'ppg', 'pim', 'fw', 'fl', 'hat', 's1', 's2', 's3', 'shg', 'eng', 'imp'];
const ARCH_G = ['gp', 'w', 'sa', 'sv', 'ga', 'sho', 'toi', 's1', 's2', 's3', 'imp', 'a', 'g', 'pim'];
function packArch(l) { const G = !!(l.sa || l.sv || l.ga || l.sho), ks = G ? ARCH_G : ARCH_S; const a = ks.map(k => l[k] || 0); while (a.length && !a[a.length - 1]) a.pop(); a.unshift(G ? 'G' : 'S'); return a; }
function unpackArch(a) { const o = {}; if (typeof a[0] === 'string') { const ks = a[0] === 'G' ? ARCH_G : ARCH_S; for (let i = 1; i < a.length; i++) if (a[i]) o[ks[i - 1]] = a[i]; } else ARCH_KEYS.forEach((k, i) => { if (a[i]) o[k] = a[i]; }); return o; }
function saveReplacer(k, v) {
  if (v && typeof v === 'object' && !Array.isArray(v) && CATS.includes(k) && isSeasonEntry(this)) return packArch(v);
  if (typeof v === 'number' && !Number.isInteger(v) && isFinite(v)) return Math.round(v * 1000) / 1000;   // 48.136700000001355 -> 48.137 (no stored value needs more)
  return isStatLine(v) ? packLine(v) : v;
}
function serializeSave(save, pretty) { return JSON.stringify(save, saveReplacer, pretty ? 1 : 0); }
function hydrateSave(save) {
  if (!save || !save.players) return save;
  const fullCats = c => { const o = c || {}; for (const k of CATS) o[k] = fullLine(o[k]); return o; };
  for (const p of Object.values(save.players)) {
    p.career = fullCats(p.career); if (!p.traits) p.traits = []; if (!p.seasons) p.seasons = []; if (!p.awards) p.awards = [];
    for (const se of p.seasons) { for (const c of CATS) if (Array.isArray(se[c])) se[c] = unpackArch(se[c]); if (se.year == null) se.year = START_YEAR + se.s - 1; }
    if (p.vault) { if (p.vault.career) p.vault.career = fullCats(p.vault.career); for (const se of p.vault.seasons || []) for (const c of CATS) if (Array.isArray(se[c])) se[c] = unpackArch(se[c]); }
  }
  const se = save.season;
  if (se) {
    for (const pid in se.stats || {}) se.stats[pid] = fullCats(se.stats[pid]);
    for (const c of Object.values(se.comps || {})) for (const pid in c.stats || {}) c.stats[pid] = fullLine(c.stats[pid]);
  }
  return save;
}
function migrateSave(save) {
  if (!save) return save;
  if ((save.version || 1) < 5) { save.tooOld = true; return save; }       // pre-expansion saves are not continued (see validateSave)
  hydrateSave(save);
  // REPAIR (Nov 21): a goalie-for-goalie (or full-position) trade could leave the incoming player on no team. Anyone
  // active with no team but a contract with a club goes back to that club (or becomes a free agent if it's full).
  for (const p of Object.values(save.players || {})) {
    if (p.status !== 'active' || p.teamId || !p.contract || !p.contract.team || !save.teams || !save.teams[p.contract.team]) continue;
    const t = save.teams[p.contract.team]; if (orgIds(t).includes(p.id)) { p.teamId = t.id; continue; }
    if (!joinOrg(save, t, p.id)) placeAnywhere(save, t, p.id);
    (save.news = save.news || []).unshift({ s: save.seasonNum, text: `Roster fix: #${p.num} ${p.first} ${p.last} is back with the ${t.nick} (lost in a trade by a bug).` });
  }
  save.clips = save.clips || {};
  save.introsSeen = save.introsSeen || {};
  save.nextId = save.nextId || {};
  save.ach = save.ach || {}; save.achProg = save.achProg || {}; save.unlocks = save.unlocks || { styles: [] }; save.memorabilia = save.memorabilia || []; save.tx = save.tx || [];
  if (!save.nextId.c) save.nextId.c = 1 + Object.keys(save.clips).reduce((m, id) => Math.max(m, +id.slice(1) || 0), 0);
  for (const t of save.trophies || []) {
    t.clipIds = (t.clipIds || []).filter(id => save.clips[id]);
    if (t.decisiveClip && !save.clips[t.decisiveClip]) t.decisiveClip = null;
  }
  for (const t of Object.values(save.teams || {})) teamLeaders(t);
  if ((save.version || 5) < 6) migrateV6(save);
  save.vault = save.vault || {};
  if (save.version < SAVE_VERSION) save.version = SAVE_VERSION;
  if (save.format !== SAVE_FORMAT && isSaveFormat(save.format)) save.format = SAVE_FORMAT;
  return save;
}
// v6: natural positions incl. defense, handedness, the Faceoff attribute (existing players get consistent values)
function migrateV6(save) {
  for (const p of Object.values(save.players || {})) {
    if (p.pos === 'G') continue;
    if (!p.spos || !NAT_POS.includes(p.spos)) p.spos = 'C';
    if (!p.hand) p.hand = handFromId(p.id, p.spos);
    if (p.attrs && p.attrs.fo == null) p.attrs.fo = foFromAttrs(p);
  }
  const sc = o => o && o.ovr != null && o.ovr <= 10.5 ? (o.ovr = Math.round(o.ovr * 10)) : 0;
  for (const p of Object.values(save.players || {})) for (const e of p.seasons || []) sc(e);
  if (save.draft0) for (const x of save.draft0.picks || []) sc(x);
  for (const d of save.draftHist || []) for (const x of (d.picks || [d])) sc(x);
  if (typeof initContracts === 'function') initContracts(save);
  for (const p of Object.values(save.players || {})) if (typeof prefOf === 'function' && p.status !== 'retired') prefOf(p);
  if (typeof migrateV6More === 'function') migrateV6More(save);
  save.version = 6;
}
