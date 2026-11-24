'use strict';
// ====================================================================
//  DRAFT NIGHT (Nov 21): the yearly draft as the place to find the missing piece
//  - 1 to 3 GENERATIONAL prospects in every class (ready to play, a ceiling near 90), spread over different roles
//  - a mixed pool: rookies, IMPORTS (overseas pros, ready now) and EXPOSED VETERANS (each club protects 8 skaters;
//    the best unprotected ones are up for grabs on draft night and come with their contracts)
//  - FITS: every card says when a player fills a hole on your roster or beats one of your starters
//  - PUCK TALK hosts the night: an opening show, then reactions to the big picks
//  - a CAMP INVITE (Season Finale Cup): first claim on one undrafted prospect when the draft ends
// ====================================================================
Object.assign(TIER_NAMES, { gen: 'GENERATIONAL', imp: 'IMPORT' });
Object.assign(TIER_COL, { gen: '#ff8af0', imp: '#7fd3ff' });
PTAGS.imp = { name: 'IMPORT', col: '#7fd3ff', desc: 'An overseas pro: ready to play now, little growth left.' };
PTAGS.exposed = { name: 'EXPOSED', col: '#c9b8ff', desc: 'Left off his club\'s protection list. A ready-made player: he comes with his contract.' };
PTAGS.gen = { name: 'GENERATIONAL', col: '#ff8af0', desc: 'A once-in-years talent: ready to play now, and the scouts see a ceiling near 90.' };
const GEN_COUNT = { thin: [1, 0], normal: [1, 0.3], deep: [2, 0.25], gen: [3, 0] };   // [sure, chance of one more]
const IMP_COUNT = { thin: 3, normal: 4, deep: 5, gen: 4 };
const PROTECT_N = 7, EXPOSED_MAX = 8;

// ---------- the class: generational prospects and imports join (the weakest middle prospects make room)
// the spot the league is thinnest at (the average best player there, club by club)
function lgNeedSpos(save) {
  const sc = {};
  for (const k of NAT_POS) { let s = 0; for (const id of save.teamOrder) s += Math.max(0, ...rosterSkaters(save.teams[id]).map(pid => P(save, pid)).filter(p => p && p.spos === k).map(ovrInt)); sc[k] = s; }
  return NAT_POS.slice().sort((a, b) => sc[a] - sc[b])[0];
}
function genGenerational(save, rng, spos, archs, q, i) {
  const goalie = i > 0 && rng() < 0.12;
  let arch = 'goalie';
  if (!goalie) { arch = archs.find(a => ARCH_BY_POS[spos].includes(a)) || ARCH_BY_POS[spos][0]; if (archs.includes(arch)) archs.splice(archs.indexOf(arch), 1); }
  const gd = goalie ? goalieDrift(save) : 0;
  const p = genProspect(rng, { pos: goalie ? 'G' : 'S', spos, arch, lo: 72 + q + gd, hi: 78 + q + gd, age: [18, 19], minTraits: 2 });
  youngPot(p, rng, { kind: rng() < 0.55 ? 'boom' : 'high', width: [6, 10], place: 0.5, lateP: 0, proAt: 60 });
  if (p.pot < 8.8) { p.pot = Math.min(9.4, 8.8 + rng() * 0.3); setPotRange(p, ri(6, 10, rng), rng, 0.5); }
  p.tier = 'gen'; p.tierV = 'gen'; p.trH = false;
  p.tags = Array.from(new Set(['gen', 'pro'].concat((p.tags || []).filter(t => t !== 'bust' && t !== 'raw')))); p.hidTags = [];
  return p;
}
function genImport(save, rng, q) {
  const p = genProspect(rng, { pos: 'S', spos: pickR(NAT_POS, rng), lo: 63 + q, hi: 70 + q, age: [23, 26], spiky: rng() < 0.5 });
  p.pot = Math.round((overall(p) + rng() * 0.4) * 10) / 10; p.kind = 'normal';
  p.tags = ['pro', 'imp']; p.hidTags = []; p.tier = 'imp'; p.tierV = 'imp'; p.trH = false;
  return p;
}
{ const _gc = genClass;
  genClass = function (save, strKey, rng = Math.random) {
    const out = _gc.apply(this, arguments);
    const C = GEN_COUNT[strKey] || GEN_COUNT.normal, nGen = C[0] + (rng() < C[1] ? 1 : 0), nImp = IMP_COUNT[strKey] || 4;
    const mids = out.filter(p => p.tier === 'mid').sort((a, b) => (overall(a) + potE(a)) - (overall(b) + potE(b)));
    const drop = new Set(mids.slice(0, nGen + nImp));
    const keep = out.filter(p => !drop.has(p));
    const q = Math.max(-3, Math.min(2, classDrift(save))), need = lgNeedSpos(save);
    const archs = ['sniper', 'playmaker', 'defensive', 'speedster', 'enforcer'].sort(() => rng() - 0.5);
    const add = (p, kid) => { p.kid = kid; p.look = makeLook('rk-' + (save.id || '') + '-' + save.season.num + '-' + kid, p.age); keep.push(p); };
    for (let i = 0; i < nGen; i++) add(genGenerational(save, rng, i === 0 ? need : pickR(NAT_POS, rng), archs, q, i), 'g' + i);
    for (let i = 0; i < nImp; i++) add(genImport(save, rng, q), 'i' + i);
    return keep;
  }; }

// ---------- protection lists and exposed veterans
const protScore = p => overall(p) + (p.age <= 23 ? Math.max(0, potE(p) - overall(p)) * 0.5 : 0);
function protectedOf(save, t) {
  const sk = rosterSkaters(t).map(id => P(save, id)).filter(Boolean);
  const mine = t.id === save.userTeamId ? (t.protect || []).filter(id => sk.some(p => p.id === id)).slice(0, PROTECT_N) : [];
  const rest = sk.filter(p => !mine.includes(p.id)).sort((a, b) => protScore(b) - protScore(a)).slice(0, PROTECT_N - mine.length).map(p => p.id);
  return mine.concat(rest);
}
function exposedOf(save, t) {
  const pr = protectedOf(save, t);
  return rosterSkaters(t).map(id => P(save, id)).filter(p => p && !pr.includes(p.id) && !(p.inj && p.inj.g > 0)).sort((a, b) => overall(b) - overall(a))[0] || null;
}
function rdExposeVets(save) {
  const d = save.draft; if (!d || d.v !== 2 || d.vetsIn || d.done) return;
  d.vetsIn = true;
  const ex = save.teamOrder.map(id => ({ t: save.teams[id], p: exposedOf(save, save.teams[id]) })).filter(x => x.p).sort((a, b) => overall(b.p) - overall(a.p)).slice(0, EXPOSED_MAX);
  ex.forEach((x, i) => {
    const s = clone(x.p);
    s.kid = 'v' + i; s.vetPid = x.p.id; s.vetFrom = x.t.id; s.tier = 'veteran'; s.tierV = 'veteran'; s.trH = false; s.hidTags = [];
    s.tags = ['exposed'].concat(x.p.age >= 31 ? ['vet'] : []); delete s.taken;
    d.cls.push(s);
  });
  const mineEx = ex.find(x => x.t.id === save.userTeamId);
  d.log.push(`PROTECTION LISTS ARE IN: ${ex.length} veterans are exposed for draft night.`);
  pushNews(save, `PROTECTION LISTS ARE IN: ${ex.length} veterans are exposed for tonight's draft` + (ex[0] ? `, led by ${ex[0].p.first} ${ex[0].p.last} (${ovrInt(ex[0].p)}) of the ${ex[0].t.nick}.` : '.'));
  if (mineEx) pushNews(save, `Your ${mineEx.p.first} ${mineEx.p.last} was left unprotected: another club may claim him tonight.`);
}
// a veteran who left his club (traded, released, retired) since the lists came in is no longer available
function rdVetCheck(save) {
  const d = save.draft; if (!d || !d.cls) return;
  for (const p of d.cls) if (p.vetPid && !p.taken) { const r = P(save, p.vetPid); if (!r || r.teamId !== p.vetFrom || r.status !== 'active') p.taken = { none: true, stale: true }; }
}
// the claimed veteran moves to his new club with his contract
function rdMoveVet(save, t, p, pk, releasePid) {
  const r = P(save, p.vetPid), from = save.teams[p.vetFrom];
  if (!r || r.teamId !== p.vetFrom) return 'He is no longer with his club.';
  if (releasePid) releasePlayer(save, releasePid);
  removeFromRoster(from, r.id); r.teamId = null;
  if (!joinOrg(save, t, r.id)) {
    if (t.id !== save.userTeamId) { const worst = rosterSkaters(t).map(i => P(save, i)).sort((a, b) => rdKeepScore(save, t, a) - rdKeepScore(save, t, b))[0]; if (worst) releasePlayer(save, worst.id); }
    if (!joinOrg(save, t, r.id) && !placeAnywhere(save, t, r.id)) { addToRoster(save, from, r.id); r.teamId = from.id; return 'No room for him.'; }
  }
  if (!r.num || numberTaken(save, t, r.num, r.id)) r.num = freeNumber(save, t, r.num);
  if (r.contract) r.contract.team = t.id;
  logTx(save, 'draft', { pid: r.id, teamId: t.id, from: from.id });
  autoArrange(save, t); autoArrange(save, from);
  save.draftHistory.push({ season: save.draft.season, teamId: t.id, teamName: fullName(t), pid: r.id, name: r.first + ' ' + r.last, type: `Exposed veteran (from ${from.abbr}), #${pk ? pk.no : '?'}`, no: pk ? pk.no : null, r: pk ? pk.r : null, ovr: ovrInt(r), pot: potTxt(r), user: t.id === save.userTeamId });
  if (from.id === save.userTeamId) pushNews(save, `The ${t.nick} claim your exposed ${r.first} ${r.last} on draft night.`);
  return null;
}
// your claimed veteran (signing is just adding him; letting him go leaves him with his club)
{ const _sm = rdSignMine;
  rdSignMine = function (save, kid, custom, releasePid) {
    const d = save.draft, p = d.cls.find(x => x.kid === kid);
    if (!p || !p.vetPid) return _sm.apply(this, arguments);
    if (!d.mine.includes(kid)) return 'He is not one of your picks.';
    const u = save.teams[save.userTeamId], r = P(save, p.vetPid);
    if (r && orgFull(u, r.pos) && !releasePid) return 'Your roster and farm team are full: choose a player to release.';
    const err = rdMoveVet(save, u, p, d.picks.find(x => x.kid === kid), releasePid); if (err) return err;
    pushNews(save, `${r.first} ${r.last} joins you from the ${save.teams[p.vetFrom].nick}.`);
    d.mine.splice(d.mine.indexOf(kid), 1);
    return null;
  }; }
{ const _lg = rdLetGo;
  rdLetGo = function (save, kid) {
    const d = save.draft, p = d.cls.find(x => x.kid === kid);
    if (!p || !p.vetPid) return _lg.apply(this, arguments);
    if (!d.mine.includes(kid)) return;
    d.mine.splice(d.mine.indexOf(kid), 1);
    pushNews(save, `You pass on ${p.first} ${p.last}: he stays with the ${save.teams[p.vetFrom].nick}.`);
  }; }
// clubs weigh a veteran's salary and age against a cheap rookie
{ const _rv = rdValue;
  rdValue = function (save, t, p) { const v = _rv.apply(this, arguments); return p.vetPid ? v - 0.45 - Math.max(0, p.age - 28) * 0.08 : v; }; }
// draft night starts: the lists come in
{ const _ao = advanceOffseason;
  advanceOffseason = function (save) { const r = _ao.apply(this, arguments); if (save.off && save.off.phase === 'draft') rdExposeVets(save); return r; }; }

// ---------- FITS: does he fill a hole or beat one of your starters?
function rdFit(save, p) {
  const u = save.teams[save.userTeamId]; if (!u || !p) return null;
  const o = ovrInt(p);
  if (p.pos === 'G') {
    const gs = rosterGoalies(u).map(id => ovrInt(P(save, id))).sort((a, b) => b - a);
    if (!gs.length || o >= gs[0] + 2) return { k: 'up', txt: 'NEW STARTER', help: 'Better than your starting keeper right now.' };
    return gs.length < 3 ? { k: 'need', txt: 'FILLS NEED', help: 'You are short of keepers.' } : null;
  }
  const side = sideOf(p.spos), sk = rosterSkaters(u).map(id => P(save, id)).filter(Boolean);
  const same = sk.filter(q => sideOf(q.spos) === side).map(ovrInt).sort((a, b) => b - a), starters = same.slice(0, 3);
  if (starters.length >= 3 && o >= starters[2] + 2) return { k: 'up', txt: 'UPGRADE NOW', help: `Better today than your weakest regular on the ${side === 'C' ? 'middle' : side === 'L' ? 'left' : 'right'} (${starters[2]}).` };
  if (typeof posNeed === 'function' && posNeed(save, u, p)) return { k: 'need', txt: 'FILLS NEED', help: isDefPos(p.spos) ? 'Your lines are short of stay-at-home D.' : `You are thin on the ${side === 'C' ? 'middle' : side === 'L' ? 'left' : 'right'}.` };
  if (p.age <= 21 && potE(p) * 10 >= (same[0] || 0) + 4) return { k: 'fut', txt: 'FUTURE #1', help: `His ceiling is above your best ${side === 'C' ? 'centre' : side === 'L' ? 'left side' : 'right side'} player.` };
  return null;
}
const FIT_COL = { up: '#ffd23f', need: '#5ee07a', fut: '#9ad0ff' };
const fitChip = (save, p) => { const f = rdFit(save, p); return f ? h('span', { class: 'dtag dfit', style: { color: FIT_COL[f.k], borderColor: FIT_COL[f.k] }, 'data-help': f.txt + ': ' + f.help }, f.txt) : null; };

// ---------- PUCK TALK on draft night
function rdTalk(save, who, txt) { const d = save.draft; (d.talk = d.talk || []).push({ who, txt }); if (d.talk.length > 40) d.talk.splice(0, d.talk.length - 40); }
const talkHosts = save => { const c = typeof deskCohost === 'function' ? deskCohost(save) : null; return [typeof BARRY !== 'undefined' ? BARRY.short : 'BONE', c ? (c.plate || c.name).toUpperCase() : 'DANA']; };
function rdNightOpen(save) {
  const d = save.draft; if (!d || d.talkOpen) return; d.talkOpen = true;
  const [A, B] = talkHosts(save), gens = d.cls.filter(p => p.tier === 'gen' && !p.taken), ex = d.cls.filter(p => p.vetPid && !p.taken).sort((a, b) => overall(b) - overall(a));
  const imps = d.cls.filter(p => p.tier === 'imp');
  rdTalk(save, A, `Welcome to DRAFT NIGHT on BALL TALK! A ${CLASS_STR[d.str].name} class, and the phones are already ringing.`);
  if (gens.length) rdTalk(save, B, gens.length === 1 ? `Everybody is talking about ONE name: ${gens[0].first} ${gens[0].last}, a generational ${posLabel(gens[0])}. Ready now, ceiling near 90.`
    : `${gens.length} generational talents this year: ${gens.map(p => p.last + ' (' + posLabel(p) + ')').join(', ')}. That doesn't happen often.`);
  if (ex.length) rdTalk(save, A, `Protection lists are in: ${ex.length} veterans exposed. The best of them? ${ex[0].first} ${ex[0].last}, ${ovrInt(ex[0])} overall, off the ${save.teams[ex[0].vetFrom].nick}.`);
  if (imps.length) rdTalk(save, B, `And watch the ${imps.length} imports: pros from overseas who can play tomorrow.`);
  const mine = d.order.filter((o, i) => i >= d.at && o.team === save.userTeamId);
  rdTalk(save, A, mine.length ? `You're up at ${mine.map(o => '#' + o.no).join(' and ')}. Who's your missing piece?` : `No picks for you tonight. Better make a call.`);
}
// a few words on the picks that matter
{ const _mp = rdMakePick;
  rdMakePick = function (save, kid) {
    const d = save.draft; rdVetCheck(save);
    const p = d.cls.find(x => x.kid === kid && !x.taken), cur = rdCur(d);
    if (p && p.vetPid && cur && p.vetFrom === cur.team) return 'He is your own player.';
    const rank = p ? rdLeft(d).filter(x => !x.vetPid || x.vetFrom !== (cur && cur.team)).sort((a, b) => rdBoardValue(save, b) - rdBoardValue(save, a)).indexOf(p) : -1;
    const err = _mp.apply(this, arguments); if (err || !p || !cur || !d.talkOpen) return err;
    const [A, B] = talkHosts(save), t = save.teams[cur.team], me = cur.team === save.userTeamId, nm = p.first + ' ' + p.last;
    const f = me ? rdFit(save, p) : null, any = (arr) => arr[Math.floor(Math.random() * arr.length)];
    if (p.tier === 'gen') rdTalk(save, any([A, B]), me ? `YOU land ${nm}! A generational ${posLabel(p)}. That's a franchise changer, folks.` : `The ${t.nick} take ${nm} at #${cur.no}. A generational player. Their fans will remember tonight.`);
    else if (p.vetPid) rdTalk(save, any([A, B]), `${me ? 'You claim' : `The ${t.nick} claim`} ${nm} off the ${save.teams[p.vetFrom].nick}'s exposed list. Ready-made${p.age >= 31 ? ', if a little grey' : ''}.`);
    else if (me) rdTalk(save, B, f ? `I like it. ${nm}: ${f.txt.toLowerCase()}. ${f.help}` : rank >= 6 ? `${nm}? A bold pick. The board had him lower, but you see something.` : `${nm} at #${cur.no}. Solid, sensible, the best guy left.`);
    else if (rank >= 10 && cur.r === 1) rdTalk(save, A, `REACH ALERT: the ${t.nick} take ${nm} at #${cur.no}. I had him well down my board.`);
    else if (rank === 0 && (p.tier === 'franchise' || p.tier === 'imp') && cur.no >= 6) rdTalk(save, B, `STEAL! ${nm} falls to the ${t.nick} at #${cur.no}.`);
    else if (p.tier === 'imp' && cur.r === 1 && Math.random() < 0.5) rdTalk(save, A, `The ${t.nick} want help NOW: import ${nm}, ${ovrInt(p)} overall.`);
    return err;
  }; }

// ---------- CAMP INVITE: the best undrafted prospects wait for you before the rest of the league sees them
function rdCampHold(save) {
  const d = save.draft; if (!d.campInvite || d.campPool) return;
  d.campPool = d.cls.filter(x => x.taken && x.taken.none && !x.vetPid && !x.taken.stale).sort((a, b) => rdBoardValue(save, b) - rdBoardValue(save, a)).slice(0, 6).map(x => x.kid);
  if (d.campPool.length) pushNews(save, 'CAMP INVITE: pick one undrafted prospect before the rest of the league can sign them (see the draft board).');
}
function rdCampPick(save, kid) {
  const d = save.draft; if (!d.campPool || d.campDone) return 'No camp invite.';
  if (kid) { const p = d.cls.find(x => x.kid === kid); if (!p || !d.campPool.includes(kid)) return 'He is not on the camp list.';
    d.picks.push({ no: 0, r: 0, teamId: save.userTeamId, kid, name: p.first + ' ' + p.last, pos: posLabel(p), pk: posKey(p), ovr: ovrInt(p), pot: potTxt(p), tierV: p.tierV, user: true, camp: true });
    p.taken = { no: 0, r: 0, team: save.userTeamId, camp: true }; p.hidTags = []; p.trH = false; d.mine.push(kid); }
  rdCampFlush(save, kid);
  return null;
}
function rdCampFlush(save, keep) {
  const d = save.draft; if (!d || !d.campPool || d.campDone) return;
  d.campDone = true;
  for (const k of d.campPool) if (k !== keep) { const p = d.cls.find(x => x.kid === k); if (p) rdToMarket(save, p, null); }
}
{ const _sn = startNextSeason;
  startNextSeason = function (save) { if (save.draft && save.draft.v === 2) rdCampFlush(save); return _sn.apply(this, arguments); }; }

// ---------- the hype starts when the class is made
{ const _cd = createDraftClass;
  createDraftClass = function (save) {
    const d = _cd.apply(this, arguments), gens = d.cls.filter(p => p.tier === 'gen');
    if (gens.length) pushNews(save, `BALL TALK: "${gens.length === 1 ? `One name to know this summer: ${gens[0].first} ${gens[0].last}, a generational ${posLabel(gens[0])}.` : `${gens.length} generational prospects in one class: ${gens.map(p => p.first + ' ' + p.last).join(', ')}.`}"`);
    return d;
  }; }
if (typeof HELP !== 'undefined' && HELP.tier) Object.assign(HELP.tier, {
  gen: 'GENERATIONAL: one to three a year. Ready to play now, with a ceiling near 90.',
  imp: 'IMPORT: an overseas pro, 23-26. Ready now; what you see is mostly what you get.',
  veteran: HELP.tier.veteran || 'VETERAN: a proven player. Good now; expect a decline within a few seasons.',
});
