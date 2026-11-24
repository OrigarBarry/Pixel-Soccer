// ====================================================================
//  DRAFTS
//  - prospects: tiers, spiky specialists, a hidden real ceiling (p.pot) shown as a scouted range (p.potR),
//    story tags (Pro-ready, Raw, Late bloomer, Bust risk), development that follows the real ceiling
//  - AI general managers with personalities (they take players you wanted, go on position runs, sometimes reach)
//  - the Inaugural League Draft pool + your slot (lottery or chosen)
//  - the yearly two-round Rookie Draft: one shared class, order by standings with a bottom-4 lottery,
//    class strength announced in advance, scouting points, pick trades, signing your picks
// ====================================================================

// ---------- potential: the real ceiling is hidden; young players show a range on the 0-100 scale
const potTxt = p => p.potR ? p.potR[0] + '–' + p.potR[1] : String(pot100(p));
const potE = p => p.potR ? (p.potR[0] + p.potR[1]) / 20 : (p.pot || overall(p));     // what everyone (the AI included) believes
function setPotRange(p, width, rng = Math.random, place) {
  const T = Math.round(p.pot * 10), o = ovrInt(p), w = Math.round(width);
  let lo = Math.round(T - (place != null ? place : rng()) * w), hi = lo + w;
  if (lo < o) { hi += o - lo; lo = o; }
  if (hi > 99) { lo -= hi - 99; hi = 99; }
  lo = Math.max(o, Math.min(lo, T)); hi = Math.min(99, Math.max(hi, T));
  if (hi - lo < 4 || o >= T) { delete p.potR; return; }
  p.potR = [lo, hi];
}
// each season played (or a scout's visit) narrows the range around the truth
function narrowPot(p, f) {
  if (!p.potR) return;
  const T = Math.round(p.pot * 10), o = ovrInt(p);
  const lo = Math.max(o, Math.round(T - (T - p.potR[0]) * f)), hi = Math.round(T + (p.potR[1] - T) * f);
  if (o >= T || hi - lo <= 6) delete p.potR; else p.potR = [Math.min(lo, T), Math.max(hi, T)];
}
const PTAGS = {
  pro: { name: 'PRO-READY', col: '#5ee07a', desc: 'Can play real minutes right away.' },
  raw: { name: 'RAW', col: '#ffb347', desc: 'Big upside, lots of work to do: his range is wide.' },
  late: { name: 'LATE BLOOMER', col: '#7fd3ff', desc: 'Grows slowly at first, then takes off around 22–23.' },
  bust: { name: 'BUST RISK', col: '#ff6b6b', desc: 'The scouts have doubts: his ceiling may be close to what he is now.' },
  vet: { name: 'VETERAN', col: '#c9b8ff', desc: 'Good now; expect a decline within a few seasons.' },
};
const tagsShown = p => (p.tags || []).filter(t => !(p.hidTags || []).includes(t));
const traitsHidden = p => !!p.trH;

// ---------- generation helpers
const SPIKE = { speedster: { hi: ['spd', 'sta'], lo: ['def', 'chk'] }, sniper: { hi: ['acc', 'pow'], lo: ['def', 'chk'] }, defensive: { hi: ['def', 'chk'], lo: ['acc', 'pow'] },
  playmaker: { hi: ['pas', 'stk'], lo: ['chk', 'pow'] }, enforcer: { hi: ['chk', 'pow'], lo: ['stk', 'acc'] } };
const ARCH_BY_POS = { C: ['playmaker', 'playmaker', 'sniper', 'speedster', 'balanced'], LW: ['sniper', 'sniper', 'speedster', 'enforcer', 'playmaker', 'balanced'],
  RW: ['sniper', 'sniper', 'speedster', 'enforcer', 'playmaker', 'balanced'], LD: ['defensive', 'defensive', 'enforcer', 'playmaker', 'balanced'], RD: ['defensive', 'defensive', 'enforcer', 'playmaker', 'balanced'] };
const POS_W = { LW: 3.1, C: 3.6, RW: 3.1, LD: 2.1, RD: 2.1 };
// n positions in league proportions (largest remainder, random tie-break), shuffled
function posAlloc(n, rng = Math.random) {
  const tot = Object.values(POS_W).reduce((a, b) => a + b, 0), out = [];
  const share = Object.entries(POS_W).map(([k, w]) => ({ k, x: n * w / tot, r: rng() }));
  for (const s of share) for (let i = 0; i < Math.floor(s.x); i++) out.push(s.k);
  share.sort((a, b) => (b.x % 1) - (a.x % 1) || a.r - b.r);
  for (let i = 0; out.length < n; i++) out.push(share[i % share.length].k);
  return out.sort(() => rng() - 0.5);
}
// nudge attributes (leaving `keep` alone) until the 0-100 overall is inside [lo, hi]
function fitOvr(p, lo, hi, rng = Math.random, keep = []) {
  const keys = (p.pos === 'G' ? G_ATTRS : SK_ATTRS).map(k => k[0]).filter(k => !keep.includes(k));
  for (let i = 0; i < 300; i++) {
    const o = ovrInt(p);
    if (o < lo) { const c = keys.filter(k => p.attrs[k] < 10); if (!c.length) break; p.attrs[pickR(c, rng)]++; }
    else if (o > hi) { const c = keys.filter(k => p.attrs[k] > 1); if (!c.length) break; p.attrs[pickR(c, rng)]--; }
    else break;
  }
}
function genProspect(rng, o) {
  const pos = o.pos, spos = pos === 'G' ? null : o.spos;
  const arch = pos === 'G' ? 'goalie' : o.arch || pickR(ARCH_BY_POS[spos].filter(a => !o.spiky || a !== 'balanced'), rng);
  const p = genPlayer(rng, pos, { q: (o.lo + o.hi) / 20, arch, age: ri(o.age[0], o.age[1], rng), spos, noTraits: true });
  const lo = o.lo, hi = o.hi, t = ri(lo, hi, rng);
  if (o.spiky && pos !== 'G' && SPIKE[arch]) {
    const sp = SPIKE[arch];
    for (const k of sp.hi) p.attrs[k] = ri(9, 10, rng);
    for (const k of sp.lo) p.attrs[k] = ri(2, 4, rng);
    fitOvr(p, t, t, rng, sp.hi.concat(sp.lo));
  } else fitOvr(p, t, t, rng);
  fitOvr(p, lo, hi, rng);
  p.pot = overall(p); p.dv = 1; p.tags = [];
  p.traits = genTraits(p, rng);
  while (p.traits.length < (o.minTraits || 0)) { const t = rollTrait(p, rng); if (!t) break; p.traits.push(t); }
  return p;
}
// how much a young player really grows (0-100 points): busts, normal, high, booms
const GAIN = { bust: [0, 6], normal: [7, 15], high: [16, 24], boom: [25, 34] };
function rollGain(rng, mix) {
  let r = rng(), kind = 'normal';
  for (const k of ['bust', 'normal', 'high', 'boom']) { if (r < (mix[k] || 0)) { kind = k; break; } r -= mix[k] || 0; }
  const g = GAIN[kind];
  return [kind, g[0] + rng() * (g[1] - g[0])];
}
// the hidden truth + what the scouts say about it
function youngPot(p, rng, cfg) {
  const [kind, gain] = cfg.kind ? [cfg.kind, GAIN[cfg.kind][0] + rng() * (GAIN[cfg.kind][1] - GAIN[cfg.kind][0])] : rollGain(rng, cfg.mix);
  p.kind = kind;
  p.pot = Math.round(Math.min(9.4, overall(p) + (gain + (cfg.gainAdj || 0)) / 10) * 10) / 10;
  const w = ri(cfg.width[0], cfg.width[1], rng);
  setPotRange(p, w, rng, cfg.place != null ? cfg.place : null);
  const tags = [], hid = [];
  if ((kind === 'high' || kind === 'boom') && rng() < (cfg.lateP != null ? cfg.lateP : 0.3)) {
    tags.push('late'); p.bloom = ri(22, 23, rng); p.peak = Math.max(p.peak || 27, 27);
    if (rng() < 0.7) hid.push('late');
  }
  if (kind === 'bust' ? rng() < 0.55 : kind === 'normal' && rng() < 0.07) tags.push('bust');
  if (ovrInt(p) >= (cfg.proAt || 60) && p.age >= 19) tags.push('pro');
  if (p.potR && (p.potR[1] - p.potR[0] >= 24 || (ovrInt(p) <= 48 && p.potR[1] >= 70))) tags.push('raw');
  p.tags = tags; p.hidTags = hid;
}

// ---------- AI general managers: each club drafts with a personality
const GM_TYPES = { speed: 'Loves speed', size: 'Plays heavy', skill: 'Skill first', defense: 'Defense first', youth: 'Youth movement', winnow: 'Win now', goalie: 'Keeper first', bpa: 'Best available' };
function gmOf(save, t) {
  if (!t || t.id === save.userTeamId) return 'bpa';
  t.ai = t.ai || { strat: 'balanced' };
  if (!t.ai.gm) { const k = Object.keys(GM_TYPES); t.ai.gm = k[Math.floor(hashF(t.id + (save.id || ''), 'gm') * k.length) % k.length]; }
  return t.ai.gm;
}
function gmBonus(save, t, p) {
  const a = p.attrs, g = gmOf(save, t);
  if (g === 'goalie') return p.pos === 'G' ? 0.7 : 0;
  if (p.pos === 'G') return 0;
  if (g === 'speed') return (a.spd - 6) * 0.16;
  if (g === 'size') return (a.chk + a.pow - 12) * 0.09;
  if (g === 'skill') return (a.stk + a.pas + a.acc - 18) * 0.07;
  if (g === 'defense') return (isDefPos(p.spos) ? 0.35 : 0) + (a.def - 6) * 0.08;
  return 0;
}
const posKey = p => p.pos === 'G' ? 'G' : p.spos;
// a run: when two of the last four picks were the same position, the rest of the league panics a little
function runKey(recent) { const c = {}; for (const k of (recent || []).slice(-4)) c[k] = (c[k] || 0) + 1; const k = Object.keys(c).find(x => c[x] >= 2); return k || null; }

// ====================================================================
//  INAUGURAL LEAGUE DRAFT POOL (counts are per 24 franchises)
// ====================================================================
const TIER_NAMES = { franchise: 'FRANCHISE', star: 'STAR', specialist: 'SPECIALIST', veteran: 'VETERAN', prospect: 'PROSPECT', depth: 'DEPTH', backup: 'BACKUP', top: 'TOP PROSPECT', mid: 'PROSPECT' };
const TIER_COL = { franchise: '#ffd23f', star: '#ffb347', specialist: '#7fd3ff', veteran: '#c9b8ff', prospect: '#5ee07a', depth: '#9aa3c7', backup: '#9aa3c7', top: '#ffb347', mid: '#5ee07a' };
const POOL_SK = [
  ['franchise', 6, { lo: 82, hi: 90, age: [23, 29], minTraits: 2 }],
  ['star', 18, { lo: 74, hi: 81, age: [23, 31], minTraits: 1 }],
  ['specialist', 54, { lo: 60, hi: 71, age: [21, 30], spiky: true }],
  ['veteran', 42, { lo: 64, hi: 74, age: [31, 35], vet: true }],
  ['prospect', 66, { lo: 44, hi: 60, age: [18, 21], young: true }],
  ['depth', 120, { lo: 46, hi: 60, age: [22, 33] }],
];
const POOL_G = [
  ['franchise', 4, { lo: 78, hi: 86, age: [25, 31], minTraits: 1 }],
  ['star', 10, { lo: 68, hi: 76, age: [24, 32] }],
  ['backup', 24, { lo: 56, hi: 66, age: [23, 34] }],
  ['prospect', 10, { lo: 44, hi: 56, age: [18, 21], young: true }],
  ['depth', 28, { lo: 46, hi: 58, age: [22, 34] }],
];
const MIX_INAUG = { bust: 0.18, normal: 0.52, high: 0.22, boom: 0.08 };
function genPoolPlayer(rng, pos, spos, tier, o) {
  const p = genProspect(rng, { pos, spos, lo: o.lo, hi: o.hi, age: o.age, spiky: o.spiky, minTraits: o.minTraits });
  if (o.young) youngPot(p, rng, { mix: MIX_INAUG, width: [22, 32], proAt: 57 });
  else { p.pot = Math.round((overall(p) + (p.age <= 25 ? rng() * 0.3 : 0)) * 10) / 10; if (o.vet) p.tags = ['vet']; }
  p.tier = tier;
  return p;
}
function createInauguralDraft(save, rng = Math.random) {
  const pool = [], f = save.teamOrder.length / 24;
  const add = p => { registerPlayer(save, p); p.status = 'pool'; p.joined = 1; pool.push(p.id); };
  for (const [tier, n0, o] of POOL_SK) for (const sp of posAlloc(Math.round(n0 * f), rng)) add(genPoolPlayer(rng, 'S', sp, tier, o));
  for (const [tier, n0, o] of POOL_G) for (let i = 0; i < Math.round(n0 * f); i++) add(genPoolPlayer(rng, 'G', null, tier, o));
  const order = save.teamOrder.slice().sort(() => rng() - 0.5);
  save.draft0 = { done: false, phase: 'main', order, round: 0, idx: 0, picks: [], pool, finalLeft: { S: 3, G: 1 }, watch: [], recent: [], needSlot: !!save.userTeamId };
  for (const id of save.teamOrder) gmOf(save, save.teams[id]);
}
// your first-round slot: drawn in a lottery or chosen. Later slots start richer (+$80K a slot; +25% for taking the lottery).
const D0_SLOT_CASH = 80;
const d0SlotBonus = (slot, how) => Math.round((slot - 1) * D0_SLOT_CASH * (how === 'lottery' ? 1.25 : 1) / 10) * 10;
function d0SetSlot(save, slot, how) {
  const d = save.draft0; if (!d || !d.needSlot) return;
  const u = save.userTeamId, T0 = d.order.length;
  slot = Math.max(1, Math.min(T0, slot | 0));
  d.order.splice(d.order.indexOf(u), 1); d.order.splice(slot - 1, 0, u);
  d.needSlot = false; d.slot = slot; d.slotHow = how; d.slotBonus = d0SlotBonus(slot, how);
  if (d.slotBonus && typeof finOf === 'function') finOf(save.teams[u]).cash += d.slotBonus;
}
function d0Value(save, team, p, rng = Math.random) {
  const o = overall(p), gm = gmOf(save, team), st = (team.ai || {}).strat || 'balanced';
  const youthy = gm === 'youth' || st === 'youth', win = gm === 'winnow' || st === 'contend';
  const growth = Math.max(0, potE(p) - o) * (p.age <= 23 ? 0.45 : 0.18) * (youthy ? 1.7 : win ? 0.45 : 1);
  const agePen = p.age >= 32 ? (p.age - 31) * (youthy ? 0.35 : win ? 0.1 : 0.18) : 0;
  const tagAdj = tagsShown(p).includes('bust') ? -0.25 : 0;
  return o * (win ? 1.1 : 1) + growth - agePen + tagAdj + (p.traits || []).length * 0.22 + (p.pos === 'G' ? 0.35 : 0) + gmBonus(save, team, p) + rng() * 0.6;
}
function d0Choose(save, teamId) {
  const d = save.draft0, team = save.teams[teamId];
  const legal = d.pool.filter(id => !d0Legal(save, teamId, id)).map(id => P(save, id));
  if (!legal.length) return null;
  const n = d.phase === 'main' ? d0Needs(save, teamId) : null;
  const c = n ? n.counts : d0Counts(save, teamId);
  const ai = teamId !== save.userTeamId, run = ai && d.phase === 'main' ? runKey(d.recent) : null;
  const reach = ai && Math.random() < 0.07, rng = reach ? () => Math.random() * 4 : ai ? Math.random : () => 0.5;
  const posNeed = p => p.pos === 'G' ? 0 : Math.max(0, (POS_TARGET[p.spos] || 2) * 0.75 - (c[p.spos] || 0)) * 0.22;
  const sc = p => d0Value(save, team, p, rng) + (n && n.need[d0Slot(p)] ? 0.25 * n.need[d0Slot(p)] : 0) + posNeed(p) + (run && posKey(p) === run ? 0.3 : 0);
  return legal.map(p => [p, sc(p)]).sort((a, b) => b[1] - a[1])[0][0].id;
}

// ---------- development: players from the new generator grow toward their real ceiling (bigger gap = faster),
// late bloomers wait until their breakout age
function developDv(p, keys, toi, perf, dm) {
  const peak = p.peak || 27;
  const slow = p.bloom && p.age < p.bloom ? 0.3 : p.bloom && p.age <= p.bloom + 2 ? 1.35 : 1;
  for (const k of keys) {
    let v = p.attrs[k];
    const gap = p.pot - overall(p);
    if (p.age <= peak && gap > 0) { if (Math.random() < Math.min(0.85, (0.06 + gap * 0.14 + Math.min(0.12, toi / 4000) + Math.max(0, Math.min(0.08, perf * 0.08))) * dm * slow)) v++; }
    else if (p.age <= peak + 3) { const r = Math.random(); if (r < 0.04 * dm && gap > -0.3) v++; else if (r > 0.94) v--; }
    else if (Math.random() < (p.age - peak - 3) * 0.06 * (k === 'spd' || k === 'sta' || k === 'rec' ? 1.4 : 1)) v--;
    p.attrs[k] = clampI(v, 1, 10);
  }
}

// ====================================================================
//  YEARLY ROOKIE DRAFT
// ====================================================================
const CLASS_STR = {
  thin: { name: 'THIN', fr: [0, 1], top: [5, 7], gems: [2, 3], q: -3, gain: -2, news: 'DRAFT WATCH: scouts expect a THIN draft class next summer. Few sure things at the top.' },
  normal: { name: 'NORMAL', fr: [1, 2], top: [6, 9], gems: [3, 4], q: 0, gain: 0, news: 'DRAFT WATCH: next summer\'s draft class looks like a normal year, with a prize or two at the top.' },
  deep: { name: 'DEEP', fr: [2, 2], top: [8, 10], gems: [4, 5], q: 1, gain: 1, news: 'DRAFT WATCH: a DEEP draft class is coming. Good players should last well into the second round.' },
  gen: { name: 'GENERATIONAL', fr: [3, 3], top: [9, 10], gems: [4, 5], q: 2, gain: 3, news: 'DRAFT WATCH: a GENERATIONAL draft class is coming! Scouts have not seen talent like this in years.' },
};
const rollClassStr = (rng = Math.random) => { const r = rng(); return r < 0.22 ? 'thin' : r < 0.72 ? 'normal' : r < 0.92 ? 'deep' : 'gen'; };
const RD_ROUNDS = 2, RD_EXTRA = 8;                       // 2 rounds; a few more prospects than picks
const SCOUT_BASE = 3, SCOUT_BUY = 300, SCOUT_BUY_MAX = 3, SCOUT_STAFF = [1000, 2000, 3500];
const scoutLvl = t => (t && t.scoutLvl) || 0;
function announceClass(save) {
  save.nextClass = rollClassStr();
  pushNews(save, CLASS_STR[save.nextClass].news);
}
// the league's talent level at the start of the franchise; classes get a little thinner when the league runs hot (and richer when it runs cold)
const lgMedian = save => { const o = []; for (const id of save.teamOrder) for (const pid of rosterSkaters(save.teams[id])) o.push(ovrInt(P(save, pid))); o.sort((a, b) => a - b); return o[Math.floor(o.length / 2)] || 58; };
const lgGoalieMedian = save => { const o = save.teamOrder.map(id => Math.max(0, ...rosterGoalies(save.teams[id]).map(pid => ovrInt(P(save, pid))))).sort((a, b) => a - b); return o[Math.floor(o.length / 2)] || 66; };
function goalieDrift(save) { if (save.lgBaseG == null) save.lgBaseG = lgGoalieMedian(save); return Math.max(-6, Math.min(8, Math.round((save.lgBaseG - lgGoalieMedian(save)) * 1.5))); }
function classDrift(save) { if (save.lgBase == null) save.lgBase = lgMedian(save); return Math.max(-10, Math.min(4, Math.round((save.lgBase - lgMedian(save)) * 2))); }
function genClass(save, strKey, rng = Math.random) {
  const drift = classDrift(save), S0 = CLASS_STR[strKey] || CLASS_STR.normal, S = Object.assign({}, S0, { gain: S0.gain + Math.min(0, drift) }), q = S.q + drift, N = save.teamOrder.length * RD_ROUNDS + RD_EXTRA;
  const out = [];
  const nFr = ri(S.fr[0], S.fr[1], rng), nTop = ri(S.top[0], S.top[1], rng), nGem = ri(S.gems[0], S.gems[1], rng), nMid = N - nFr - nTop - nGem;
  const spec = [];
  for (let i = 0; i < nFr; i++) spec.push({ tier: 'franchise', tierV: 'franchise', lo: 64 + q, hi: 73 + q, age: [18, 19], mix: { bust: 0.12, normal: 0.25, high: 0.38, boom: 0.25 }, width: [12, 18], minTraits: 1, proAt: 60, gP: 0.08 });
  for (let i = 0; i < nTop; i++) spec.push({ tier: 'top', tierV: 'top', lo: 54 + q, hi: 63 + q, age: [18, 20], mix: { bust: 0.2, normal: 0.45, high: 0.27, boom: 0.08 }, width: [14, 22], gP: 0.14 });
  for (let i = 0; i < nGem; i++) spec.push({ tier: 'gem', tierV: 'mid', lo: 42 + q, hi: 50 + q, age: [18, 19], kind: rng() < 0.6 ? 'high' : 'boom', width: [18, 26], place: 0.82 + rng() * 0.18, lateP: 0.5, gP: 0.1 });
  for (let i = 0; i < nMid; i++) spec.push({ tier: 'mid', tierV: 'mid', lo: 42 + q, hi: 55 + q, age: [18, 20], mix: { bust: 0.3, normal: 0.5, high: 0.16, boom: 0.04 }, width: [16, 26], gP: 0.12 });
  const sk = posAlloc(spec.length, rng), gq = goalieDrift(save); let k = 0;
  for (const s of spec) {
    const pos = rng() < s.gP ? 'G' : 'S', gd = pos === 'G' ? gq : 0;
    const p = genProspect(rng, { pos, spos: sk[k++], lo: s.lo + gd, hi: s.hi + gd, age: s.age, minTraits: s.minTraits });
    youngPot(p, rng, { mix: s.mix, kind: s.kind, width: s.width, place: s.place, lateP: s.lateP, proAt: s.proAt || 60, gainAdj: S.gain });
    p.tier = s.tier; p.tierV = s.tierV; p.trH = true;
    if (p.tier === 'franchise') p.tags = Array.from(new Set(['pro'].concat(p.tags)));
    p.kid = 'k' + out.length;
    p.look = makeLook('rk-' + (save.id || '') + '-' + save.season.num + '-' + p.kid, p.age);
    out.push(p);
  }
  return out;
}
// worst record picks first; the bottom four draw for #1 (40/30/20/10)
function rdOrder(save) {
  const st = sortedStandings(save).slice().reverse();
  const bottom = st.slice(0, 4), w = [40, 30, 20, 10];
  let r = Math.random() * 100, win = 0;
  for (let i = 0; i < 4; i++) { if (r < w[i]) { win = i; break; } r -= w[i]; }
  const first = [bottom[win]].concat(bottom.filter((_, i) => i !== win), st.slice(4));
  // (cup winners' move-ups, the Invitational's included, are applied in tourrewards.js)
  return { first, winner: bottom[win], jumped: win };
}
function createDraftClass(save) {
  const se = save.season, strKey = save.nextClass || rollClassStr();
  const o = rdOrder(save), order = [];
  for (let r = 0; r < RD_ROUNDS; r++) o.first.forEach((id, i) => order.push({ no: order.length + 1, r: r + 1, team: fpOwner(save, se.num, r + 1, id), orig: id }));
  save.futurePicks = (save.futurePicks || []).filter(x => x.s > se.num);
  const cls = genClass(save, strKey);
  const d = save.draft = { v: 2, season: se.num, str: strKey, cls, order, at: 0, picks: [], watch: [], log: [], offers: [], mine: [], done: false,
    scout: { pts: SCOUT_BASE + scoutLvl(save.teams[save.userTeamId]), bought: 0, used: 0 }, lottery: { winner: o.winner, jumped: o.jumped } };
  save.nextClass = null;
  const wt = save.teams[o.winner];
  d.log.push(`LOTTERY: the ${wt.nick} win the #1 pick${o.jumped ? ` (jumping ${o.jumped} spot${o.jumped > 1 ? 's' : ''})` : ''}.`);
  d.ups = o.ups || [];
  pushNews(save, `DRAFT LOTTERY: the ${fullName(wt)} win the first overall pick. This class is rated ${CLASS_STR[strKey].name}.`);
  if (o.winner === save.userTeamId) pushNews(save, 'You won the draft lottery: the first pick is yours!');
  for (const id of save.teamOrder) gmOf(save, save.teams[id]);
  rdContendersSell(save);
  return d;
}
const rdCur = d => d.order[d.at] || null;
const rdLeft = d => d.cls.filter(p => !p.taken);
const rdPicksOf = (d, teamId) => d.order.filter((o, i) => i >= d.at && o.team === teamId);
const pickValue = no => Math.round(1000 * Math.exp(-(no - 1) / 14) + 60);
const pickLabel = o => `#${o.no} (R${o.r})`;
// what the AI thinks a prospect is worth to this club
function rdValue(save, t, p, rng = Math.random) {
  const gm = gmOf(save, t), st = (t.ai || {}).strat || 'balanced', youthy = gm === 'youth' || st === 'youth', win = gm === 'winnow' || st === 'contend';
  const tg = tagsShown(p), gs = rosterGoalies(t).map(id => overall(P(save, id))).sort((a, b) => b - a);
  const gAdj = p.pos === 'G' ? (gs.length < 3 || (gs[1] || 0) < potE(p) - 0.5 ? 0.25 : -0.45) : 0;
  return overall(p) * (win ? 0.75 : 0.5) + potE(p) * (youthy ? 0.75 : 0.55) + gAdj + gmBonus(save, t, p) * 0.8
    + (tg.includes('bust') ? -0.35 : 0) + (tg.includes('pro') ? (win ? 0.3 : 0.12) : 0) + (tg.includes('raw') ? (youthy ? 0.2 : -0.1) : 0) + rng() * 0.5;
}
function rdAIChoose(save, t) {
  const d = save.draft, run = runKey(d.picks.map(x => x.pk)), reach = Math.random() < 0.07;
  const rng = reach ? () => Math.random() * 3 : Math.random;
  if (typeof rdVetCheck === 'function') rdVetCheck(save);
  return rdLeft(d).filter(p => p.vetFrom !== t.id).map(p => [p, rdValue(save, t, p, rng) + (run && posKey(p) === run ? 0.25 : 0)]).sort((a, b) => b[1] - a[1])[0][0];
}
// make the pick that is on the clock
function rdMakePick(save, kid) {
  const d = save.draft, cur = rdCur(d); if (!cur || d.done) return 'The draft is over.';
  const p = d.cls.find(x => x.kid === kid && !x.taken); if (!p) return 'That player is gone.';
  const t = save.teams[cur.team];
  p.taken = { no: cur.no, r: cur.r, team: cur.team };
  d.picks.push({ no: cur.no, r: cur.r, teamId: cur.team, kid, name: p.first + ' ' + p.last, pos: posLabel(p), pk: posKey(p), ovr: ovrInt(p), pot: potTxt(p), tierV: p.tierV, user: cur.team === save.userTeamId });
  d.log.push(`#${cur.no}: the ${t.nick} select ${p.first} ${p.last} (${posLabel(p)}, ${ovrInt(p)}, pot ${potTxt(p)})`);
  if (d.log.length > 120) d.log.splice(0, d.log.length - 120);
  if (cur.team === save.userTeamId) { p.hidTags = []; p.trH = false; d.mine.push(p.kid); }
  d.offers = [];
  d.at++;
  if (d.at >= d.order.length) rdFinish(save);
  return null;
}
// AI clubs pick until it is your turn (or for at most n picks); returns the picks made
function rdSimToUser(save, n = 1e9) {
  const d = save.draft, made = [];
  while (!d.done && n-- > 0) {
    const cur = rdCur(d); if (!cur || cur.team === save.userTeamId) break;
    if (cur.r === 1 && Math.random() < 0.05) rdAITradeUp(save);
    const c2 = rdCur(d), t = save.teams[c2.team], p = rdAIChoose(save, t);
    made.push(p.kid); rdMakePick(save, p.kid);
  }
  if (!d.done && rdCur(d) && rdCur(d).team === save.userTeamId) rdMaybeOffer(save);
  return made;
}
function rdAutoAll(save) {
  const d = save.draft; if (!d || d.v !== 2) return;
  for (let g = 0; g < 200 && !d.done; g++) {
    rdSimToUser(save);
    if (!d.done && rdCur(d).team === save.userTeamId) { const p = rdLeft(d).filter(x => x.vetFrom !== save.userTeamId).map(x => [x, rdValue(save, save.teams[save.userTeamId], x, () => 0.25)]).sort((a, b) => b[1] - a[1])[0][0]; rdMakePick(save, p.kid); }
  }
}
// picks left after the class runs out are skipped; leftover prospects become free agents
function rdFinish(save) {
  const d = save.draft; if (d.done) return;
  d.done = true;
  for (const p of rdLeft(d)) { p.taken = { none: true }; }
  // AI clubs decide on their rookies right away: sign him if he beats the weakest man, otherwise he goes to the market
  const byTeam = {};
  for (const pk of d.picks) if (!pk.user) (byTeam[pk.teamId] = byTeam[pk.teamId] || []).push(pk);
  for (const id in byTeam) for (const pk of byTeam[id]) rdAISign(save, save.teams[id], d.cls.find(x => x.kid === pk.kid), pk);
  if (typeof rdCampHold === 'function') rdCampHold(save);
  for (const p of d.cls.filter(x => x.taken && x.taken.none && !x.vetPid && !(d.campPool || []).includes(x.kid) && (x.tier === 'franchise' || x.tier === 'top' || x.tier === 'gen' || x.tier === 'imp' || ovrInt(x) >= 50))) rdToMarket(save, p, null);
  if (save.off && save.off.phase === 'draft') save.off.phase = 'final';
}
function rdRegister(save, p, teamId, pk) {
  const r = clone(p);
  for (const k of ['kid', 'taken', 'trH']) delete r[k];
  r.hidTags = [];
  r.id = null; r.num = 0; r.status = 'active'; r.teamId = null;
  registerPlayer(save, r);
  r.joined = save.draft.season + 1;
  if (teamId) r.draft = { season: save.draft.season, teamId, no: pk ? pk.no : null, r: pk ? pk.r : null, ovr: ovrInt(p), pot: potTxt(p) };
  return r;
}
function rdKeepScore(save, t, p) {
  const st = (t.ai || {}).strat || 'balanced';
  return overall(p) - (st === 'youth' ? Math.max(0, p.age - 28) * 0.15 : 0) + (st === 'contend' ? 0 : Math.max(0, potE(p) - overall(p)) * 0.2);
}
function rdAISign(save, t, p, pk) {
  if (!p) return;
  if (p.vetPid) return rdMoveVet(save, t, p, pk);
  const r = rdRegister(save, p, t.id, pk);
  let ok = !rosterFull(t, r.pos) || farmRoom(t) > 0;
  if (!ok) {
    const ids = r.pos === 'G' ? rosterGoalies(t) : rosterSkaters(t);
    const worst = ids.map(i => P(save, i)).sort((a, b) => rdKeepScore(save, t, a) - rdKeepScore(save, t, b))[0];
    if (worst && rdKeepScore(save, t, worst) < overall(r) + Math.max(0, potE(r) - overall(r)) * 0.45) { releasePlayer(save, worst.id); ok = true; }
  }
  if (ok) {
    joinOrg(save, t, r.id); logTx(save, 'draft', { pid: r.id, teamId: t.id });
    if (typeof rookieContract === 'function') { rookieContract(save, r, t); r.contract.s = save.draft.season + 1; }
    autoArrange(save, t);
  } else { r.status = 'free'; r.freeSince = save.draft.season; logTx(save, 'draft', { pid: r.id, teamId: t.id }); }
  save.draftHistory.push({ season: save.draft.season, teamId: t.id, teamName: fullName(t), pid: r.id, name: r.first + ' ' + r.last, type: `Round ${pk.r}, #${pk.no}`, no: pk.no, r: pk.r, ovr: ovrInt(p), pot: potTxt(p), user: false, unsigned: !ok });
}
// an unsigned prospect: an AI club with a need and room may take him; otherwise a free agent
function rdToMarket(save, p, fromTeamId, already) {
  const r = already || rdRegister(save, p, null, null);
  const cands = save.teamOrder.filter(id => id !== save.userTeamId && id !== fromTeamId).map(id => save.teams[id]).filter(t => !rosterFull(t, r.pos))
    .sort((a, b) => (gmOf(save, b) === 'youth' ? 1 : 0) - (gmOf(save, a) === 'youth' ? 1 : 0));
  const t = cands[0];
  if (t && (r.tier === 'franchise' || r.tier === 'top' || Math.random() < 0.5)) {
    r.status = 'active'; addToRoster(save, t, r.id); logTx(save, 'fa', { pid: r.id, teamId: t.id });
    if (typeof rookieContract === 'function') { rookieContract(save, r, t); r.contract.s = save.draft.season + 1; }
    autoArrange(save, t);
    return t;
  }
  r.status = 'free'; r.freeSince = save.draft.season; r.teamId = null;
  return null;
}
// your picks: sign (optionally spending a scouting point on a training-camp focus), or let him go
function rdSignMine(save, kid, custom = {}, releasePid) {
  const d = save.draft, user = save.teams[save.userTeamId];
  const p = d.cls.find(x => x.kid === kid); if (!p || !d.mine.includes(kid)) return 'He is not one of your unsigned picks.';
  if (custom.spos && NAT_POS.includes(custom.spos) && p.pos !== 'G') p.spos = custom.spos;
  if (custom.hand && HAND_NAMES[custom.hand] && p.pos !== 'G') p.hand = custom.hand;
  if (custom.focus && p.attrs[custom.focus] != null) {
    if (rdScoutLeft(d) < 1) return 'No scouting points left for a training-camp focus.';
    if (p.attrs[custom.focus] >= 10) return 'That attribute is already maxed.';
  }
  if (orgFull(user, p.pos)) {
    if (!releasePid) return 'Your roster and farm team are full: choose a player to release.';
    const rel = P(save, releasePid);
    if (!rel || rel.teamId !== user.id || rel.pos !== p.pos) return 'Choose a player in the same position to release.';
    releasePlayer(save, releasePid);
    pushNews(save, `Released ${rel.first} ${rel.last} to make room.`);
  }
  if (custom.focus) { p.attrs[custom.focus]++; d.scout.used++; }
  const pk = d.picks.find(x => x.kid === kid);
  const r = rdRegister(save, p, user.id, pk);
  if (custom.first) r.first = custom.first.trim().slice(0, 14);
  if (custom.last) r.last = custom.last.trim().slice(0, 16);
  const where = joinOrg(save, user, r.id) || (placeAnywhere(save, user, r.id) ? 'roster' : null);
  logTx(save, 'draft', { pid: r.id, teamId: user.id });
  if (typeof rookieContract === 'function') { rookieContract(save, r, user); r.contract.s = d.season + 1; }
  r.num = 0;
  if (custom.num) { const err = setNumber(save, r.id, custom.num); if (err) r.num = freeNumber(save, user, 0); } else r.num = freeNumber(save, user, 0);
  save.draftHistory.push({ season: d.season, teamId: user.id, teamName: fullName(user), pid: r.id, name: r.first + ' ' + r.last, type: pk.camp ? 'Camp invite' : `Round ${pk.r}, #${pk.no}`, no: pk.no, r: pk.r, ovr: ovrInt(p), pot: potTxt(p), user: true });
  pushNews(save, `Signed ${pk.camp ? 'camp invite' : 'your pick #' + pk.no}, ${r.first} ${r.last} (${posLabel(r)})` + (where === 'farm' ? ', to the farm team.' : '.'));
  d.mine.splice(d.mine.indexOf(kid), 1);
  return null;
}
function rdLetGo(save, kid) {
  const d = save.draft, p = d.cls.find(x => x.kid === kid); if (!p || !d.mine.includes(kid)) return;
  const pk = d.picks.find(x => x.kid === kid);
  const r = rdRegister(save, p, save.userTeamId, pk);
  const t = rdToMarket(save, p, save.userTeamId, r);
  save.draftHistory.push({ season: d.season, teamId: save.userTeamId, teamName: fullName(save.teams[save.userTeamId]), pid: r.id, name: r.first + ' ' + r.last, type: `Round ${pk.r}, #${pk.no} (unsigned)`, no: pk.no, r: pk.r, ovr: ovrInt(p), pot: potTxt(p), user: true, unsigned: true });
  pushNews(save, t ? `Your unsigned pick ${r.first} ${r.last} joins the ${t.nick}.` : `Your unsigned pick ${r.first} ${r.last} becomes a free agent.`);
  d.mine.splice(d.mine.indexOf(kid), 1);
}

// ---------- scouting
const rdScoutLeft = d => d.scout.pts + d.scout.bought - d.scout.used;
function rdScout(save, kid) {
  const d = save.draft, p = d.cls.find(x => x.kid === kid);
  if (!p || p.taken) return 'He is no longer available.';
  if (p.scouted) return 'Already scouted.';
  if (rdScoutLeft(d) < 1) return 'No scouting points left.';
  d.scout.used++;
  p.scouted = true; p.hidTags = []; p.trH = false;
  const T = Math.round(p.pot * 10);
  if (p.potR) setPotRange(p, Math.min(8, p.potR[1] - p.potR[0]), Math.random);
  // the closer look also corrects a false alarm
  if (p.tags.includes('bust') && p.kind !== 'bust' && p.kind !== 'normal') p.tags = p.tags.filter(t => t !== 'bust');
  if (p.kind === 'bust' && !p.tags.includes('bust')) p.tags.push('bust');
  return null;
}
function rdBuyScout(save) {
  const d = save.draft, u = save.teams[save.userTeamId];
  if (d.scout.bought >= SCOUT_BUY_MAX) return `You can buy at most ${SCOUT_BUY_MAX} extra scouting trips per draft.`;
  const err = spend(save, u, SCOUT_BUY, 'Extra scouting trip'); if (err) return err;
  d.scout.bought++; return null;
}
function rdBuyStaff(save) {
  const u = save.teams[save.userTeamId], lvl = scoutLvl(u);
  if (lvl >= SCOUT_STAFF.length) return 'Your scouting department is already at the top level.';
  const err = spend(save, u, SCOUT_STAFF[lvl], 'Scouting department level ' + (lvl + 1)); if (err) return err;
  u.scoutLvl = lvl + 1;
  if (save.draft && save.draft.v === 2 && !save.draft.done) save.draft.scout.pts++;
  return null;
}

// ---------- draft picks as trade assets: this summer's class (exact numbers) and next year's (projected slot)
const futureDraftSeason = save => (save.off || (save.season && save.season.done)) ? save.season.num + 1 : save.season.num;
function fpOwner(save, s, r, orig) { const e = (save.futurePicks || []).find(x => x.s === s && x.r === r && x.orig === orig); return e ? e.team : orig; }
function projSlot(save, teamId) {
  const se = save.season, ids = save.teamOrder.slice(), st = se && se.standings;
  const live = st && !save.off && !se.done && (st[teamId] || {}).gp >= 10;
  const sc = id => live ? st[id].pts / Math.max(1, st[id].gp) : teamStrength(save, id);
  const v = {}; for (const id of ids) v[id] = sc(id);
  ids.sort((a, b) => v[a] - v[b]); return ids.indexOf(teamId) + 1;
}
function teamPicks(save, teamId) {
  const out = [], d = save.draft, T0 = save.teamOrder.length, Y = s => START_YEAR + s;
  if (d && d.v === 2 && !d.done) for (const o of rdPicksOf(d, teamId)) out.push({ key: 'c' + o.no, label: `${Y(d.season)} #${o.no} (R${o.r})` + (o.orig !== o.team ? ' from ' + save.teams[o.orig].abbr : ''), value: pickValue(o.no), now: true });
  const S = futureDraftSeason(save);
  if (!(d && d.v === 2 && d.season === S)) for (const orig of save.teamOrder) for (const r of [1, 2]) if (fpOwner(save, S, r, orig) === teamId) {
    const slot = Math.min(T0, projSlot(save, orig)) + (r - 1) * T0;
    out.push({ key: `f${S}-${r}-${orig}`, label: `${Y(S)} R${r}` + (orig !== teamId ? ' from ' + save.teams[orig].abbr : '') + ` (proj. #${slot})`, value: Math.round(pickValue(slot) * 0.85), now: false });
  }
  return out;
}
function pickInfo(save, key) { for (const id of save.teamOrder) { const x = teamPicks(save, id).find(p => p.key === key); if (x) return Object.assign({ owner: id }, x); } return null; }
function movePick(save, key, to) {
  if (key[0] === 'c') { const o = save.draft.order.find(x => x.no === +key.slice(1)); if (o) o.team = to; return; }
  const m = /^f(\d+)-(\d)-(.+)$/.exec(key); if (!m) return;
  const s = +m[1], r = +m[2], orig = m[3];
  save.futurePicks = (save.futurePicks || []).filter(x => !(x.s === s && x.r === r && x.orig === orig));
  if (to !== orig) save.futurePicks.push({ s, r, orig, team: to });
}
// picks measured on the same scale as players in trades
function pickTradeValue(save, team, key) {
  const pi = pickInfo(save, key); if (!pi) return 0;
  const st = (team.ai || {}).strat, gm = gmOf(save, team);
  return Math.round(pi.value * 2.6 * (gm === 'youth' || st === 'youth' ? 1.15 : st === 'contend' || gm === 'winnow' ? 0.8 : 1));
}
const pickLabelK = (save, key) => { const pi = pickInfo(save, key); return pi ? pi.label : key; };
function rdTradeEval(save, aiId, giveKeys, getKeys) {
  const ai = save.teams[aiId];
  if (!giveKeys.length || !getKeys.length) return { ok: false, msg: 'Pick at least one pick on each side.' };
  const mine = teamPicks(save, save.userTeamId).map(p => p.key), theirs = teamPicks(save, aiId).map(p => p.key);
  if (!giveKeys.every(k => mine.includes(k)) || !getKeys.every(k => theirs.includes(k))) return { ok: false, msg: 'Those picks are not available.' };
  const vin = giveKeys.reduce((a, k) => a + pickTradeValue(save, ai, k), 0), vout = getKeys.reduce((a, k) => a + pickTradeValue(save, ai, k), 0);
  const ok = vin >= vout * 1.06;
  let msg = ok ? `The ${ai.nick} accept.` : `The ${ai.nick} say no: they value what they give at ${Math.round(vout / 10)} and what they get at ${Math.round(vin / 10)}.`;
  if (!ok) {
    const need = vout * 1.06 - vin;
    const add = mine.filter(k => !giveKeys.includes(k)).map(k => ({ k, v: pickTradeValue(save, ai, k) })).filter(x => x.v >= need).sort((a, b) => a.v - b.v)[0];
    if (add) msg += ` Add ${pickLabelK(save, add.k)} and they would do it.`;
  }
  return { ok, vin, vout, msg };
}
function rdTradeDo(save, aiId, giveKeys, getKeys) {
  const ai = save.teams[aiId], lab = ks => ks.map(k => pickLabelK(save, k)).join(' + ');
  const txt = `PICK TRADE: you send ${lab(giveKeys)} to the ${ai.nick} for ${lab(getKeys)}.`;
  for (const k of giveKeys) movePick(save, k, aiId);
  for (const k of getKeys) movePick(save, k, save.userTeamId);
  if (save.draft && save.draft.v === 2) { save.draft.log.push(txt); save.draft.offers = []; }
  pushNews(save, txt);
}
// when you are on the clock in round 1, a club further down may call to move up
function rdMaybeOffer(save) {
  const d = save.draft, cur = rdCur(d);
  if (!cur || cur.r !== 1 || d.offers.some(o => o.no === cur.no) || d.offered === cur.no || Math.random() > 0.45) { d.offered = cur && cur.no; return; }
  d.offered = cur.no;
  const later = d.order.slice(d.at + 1, d.at + 11).filter(o => o.team !== save.userTeamId && o.r === 1).sort(() => Math.random() - 0.5);
  for (const o of later) {
    const second = d.order.find((x, i) => i > d.at && x.team === o.team && x.r === 2);
    if (!second) continue;
    if (pickValue(o.no) + pickValue(second.no) >= pickValue(cur.no) * 0.95) {
      d.offers.push({ no: cur.no, teamId: o.team, get: ['c' + o.no, 'c' + second.no], msg: `The ${save.teams[o.team].nick} want your #${cur.no} and offer #${o.no} + #${second.no}.` });
      return;
    }
  }
}
// AI clubs trade up on their own now and then
function rdAITradeUp(save) {
  const d = save.draft, cur = rdCur(d);
  if (!cur || cur.team === save.userTeamId) return;
  const cand = d.order.slice(d.at + 3, d.at + 10).filter(o => o.team !== save.userTeamId && o.team !== cur.team && o.r === 1).sort(() => Math.random() - 0.5)[0];
  if (!cand) return;
  const second = d.order.find((x, i) => i > d.at && x.team === cand.team && x.r === 2);
  if (!second || pickValue(cand.no) + pickValue(second.no) < pickValue(cur.no) * 1.05) return;
  const a = save.teams[cand.team], b = save.teams[cur.team];
  const from = cur.team; cur.team = cand.team; cand.team = from; second.team = from;
  d.log.push(`TRADE: the ${a.nick} move up to #${cur.no}, sending #${cand.no} and #${second.no} to the ${b.nick}.`);
}
// before the draft: contenders sell their first-round pick for a veteran
function rdContendersSell(save) {
  const d = save.draft;
  const sellers = save.teamOrder.filter(id => id !== save.userTeamId && ((save.teams[id].ai || {}).strat === 'contend' || gmOf(save, save.teams[id]) === 'winnow'));
  const buyers = save.teamOrder.filter(id => id !== save.userTeamId && ((save.teams[id].ai || {}).strat === 'youth' || gmOf(save, save.teams[id]) === 'youth'));
  for (const sid of sellers) {
    if (Math.random() > 0.35 || !buyers.length) continue;
    const pick = d.order.find(o => o.team === sid && o.r === 1); if (!pick) continue;
    const bid = pickR(buyers.filter(x => x !== sid)); if (!bid) continue;
    const S = save.teams[sid], B = save.teams[bid];
    const vet = rosterSkaters(B).map(id => P(save, id)).filter(p => p.age >= 28).sort((a, b) => overall(b) - overall(a))[0];
    const worst = rosterSkaters(S).map(id => P(save, id)).sort((a, b) => overall(a) - overall(b))[0];
    if (!vet || !worst || overall(vet) < overall(worst) + 0.5) continue;
    const move = (p, from, to) => { if (!joinOrg(save, to, p.id)) placeAnywhere(save, to, p.id); if (!p.num || numberTaken(save, to, p.num, p.id)) p.num = freeNumber(save, to, p.num); if (p.contract) p.contract.team = to.id; logTx(save, 'trade', { pid: p.id, teamId: to.id, from: from.id }); };
    // both leave first, then both arrive (a straight swap into full rosters used to lose a player)
    removeFromRoster(B, vet.id); vet.teamId = null; removeFromRoster(S, worst.id); worst.teamId = null;
    move(vet, B, S); move(worst, S, B);
    pick.team = bid;
    autoArrange(save, S); autoArrange(save, B);
    const txt = `TRADE: the ${S.nick} send their first-round pick (#${pick.no}) and ${worst.last} to the ${B.nick} for veteran ${vet.first} ${vet.last}.`;
    d.log.push(txt); pushNews(save, txt);
  }
}
// the board value the user sees (best available without personality or noise)
const rdBoardValue = (save, p) => overall(p) * 0.5 + potE(p) * 0.55 + (tagsShown(p).includes('bust') ? -0.35 : 0) + (tagsShown(p).includes('pro') ? 0.12 : 0);
