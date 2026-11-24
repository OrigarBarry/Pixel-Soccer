'use strict';
// ====================================================================
//  TOURNAMENT REWARDS (Nov 21). Winning a cup is worth it for the FUTURE (draft capital, for every club that wins
//  one) plus a perk right away (your club); declining an invitation buys DEVELOPMENT for the players you have (a
//  development camp, besides the old rest / training choices). The invite card shows both sides before you choose.
// ====================================================================
const TOUR_REWARDS = {
  inv:     { up: 3, scout: 3, draft: 'pick 3 places earlier in both rounds of the next draft, +3 scouting points',        perk: 'HOT START: the whole roster +5 mood for 10 days' },
  classic: { up: 3, scout: 2, draft: 'pick 3 places earlier in both rounds of the next draft, +2 scouting points',        perk: 'FAN FEVER: +8 popularity (bigger crowds and sales)' },
  winter:  { up: 3, scout: 2, draft: 'pick 3 places earlier in both rounds of the next draft, +2 scouting points',        perk: 'TRAINING CAMP: +25% development for every player for 14 days' },
  finale:  { up: 4, scout: 2, camp: true, draft: 'pick 4 places earlier in both rounds, +2 scouting points, and a CAMP INVITE (first claim on one undrafted prospect)', perk: 'MOMENTUM: the whole roster +8 mood for 12 days, into the playoffs' },
  toc:     { up: 5, scout: 2, look: 6, draft: 'pick 5 places earlier in both rounds, +2 scouting points, and a FIRST LOOK (the top 6 prospects scouted for free)', perk: 'LEGACY: +5 GM reputation' },
};
// move-ups add up, but a club never moves more than UP_CAP places in all, and never into the lottery four
const UP_CAP = 8;
// declining: a development camp (the days off spent on the players you have)
const DEV_CAMP = { mul: 1.4, days: 10 };
const DEV_CAMP_TEXT = `Development camp: +${Math.round((DEV_CAMP.mul - 1) * 100)}% development for every player for ${DEV_CAMP.days} days (focus and general progress).`;

// ---------- a team-wide development boost (used by the camp and the Winter Cup perk)
function devBoostOf(save, t) {
  const b = t && t.devBoost, d = save.season ? save.season.dayNo || 0 : 0;
  return b && b.s === save.seasonNum && d <= b.until ? b.mul : 1;
}
function giveDevBoost(save, t, mul, days) { const d = save.season ? save.season.dayNo || 0 : 0; t.devBoost = { s: save.seasonNum, until: d + days, mul: Math.max(mul, devBoostOf(save, t)) }; }

// ---------- winning: the perk now (your club); the draft capital waits for the draft (createDraftClass below)
function tourWon(save, c) {
  const R = TOUR_REWARDS[c.key]; if (!R || !c.champion) return;
  const t = save.teams[c.champion], mine = c.champion === save.userTeamId, d = typeof mDay === 'function' ? mDay(save) : 0;
  if (c.key === 'classic') finOf(t).pop = Math.min(100, finOf(t).pop + 8);
  if (!mine) return;
  const roster = rosterIds(t).map(id => P(save, id));
  if (c.key === 'inv' && typeof moraleOf === 'function') for (const p of roster) moraleOf(p).fx.push({ label: 'Invitational champions', v: 5, d, len: 10 });
  if (c.key === 'finale' && typeof moraleOf === 'function') for (const p of roster) moraleOf(p).fx.push({ label: 'Finale Cup momentum', v: 8, d, len: 12 });
  if (c.key === 'winter') giveDevBoost(save, t, 1.25, 14);
  if (c.key === 'toc' && save.gm) save.gm.rep = Math.min(100, (save.gm.rep || 0) + 5);
  pushNews(save, `${COMP_INFO[c.key].name.toUpperCase()} REWARDS: ${R.perk}; at the draft, ${R.draft}.`);
}
{ const _fc = finalizeComp;
  finalizeComp = function (save, c) { const was = c.done, r = _fc.apply(this, arguments); if (!was && c.done && c.key !== 'po') tourWon(save, c); return r; }; }

// ---------- the draft: every cup winner (yours or not) moves up; yours also brings scouting points, a first look, a camp invite
{ const _ro = rdOrder;
  rdOrder = function (save) {
    const o = _ro.apply(this, arguments), comps = (save.season && save.season.comps) || {}, won = {};
    for (const k of Object.keys(TOUR_REWARDS)) { const c = comps[k], ch = c && c.done ? c.champion : null; if (ch) (won[ch] = won[ch] || []).push(k); }
    o.ups = [];
    for (const ch of Object.keys(won).sort((a, b) => o.first.indexOf(a) - o.first.indexOf(b))) {
      const want = Math.min(UP_CAP, won[ch].reduce((a, k) => a + TOUR_REWARDS[k].up, 0)), i = o.first.indexOf(ch), to = Math.max(4, i - want);
      if (i > to) { o.first.splice(i, 1); o.first.splice(to, 0, ch); }
      o.ups.push({ ch, ks: won[ch], n: Math.max(0, i - to), want });
    }
    return o;
  }; }
{ const _cd = createDraftClass;
  createDraftClass = function (save) {
    const d = _cd.apply(this, arguments), comps = (save.season && save.season.comps) || {}, user = save.userTeamId;
    for (const u of d.ups || []) {
      const t = save.teams[u.ch], names = u.ks.map(k => COMP_INFO[k].name).join(' + ');
      d.log.push(`${names.toUpperCase()}: the ${t.nick} pick ${u.n ? `${u.n} place${u.n > 1 ? 's' : ''} earlier in each round` : 'where they were (already as high as a move-up allows)'}${u.want === UP_CAP && u.ks.length > 1 ? ' (the most allowed)' : ''}.`);
    }
    const mine = Object.keys(TOUR_REWARDS).filter(k => comps[k] && comps[k].done && comps[k].champion === user);
    for (const k of mine) d.scout.pts += TOUR_REWARDS[k].scout;
    if (mine.includes('finale')) d.campInvite = true;
    if (mine.includes('toc')) {                         // FIRST LOOK: the board's top prospects, scouted before anyone else
      const top = d.cls.filter(p => !p.vetPid).sort((a, b) => rdBoardValue(save, b) - rdBoardValue(save, a)).slice(0, TOUR_REWARDS.toc.look);
      for (const p of top) if (!p.scouted) { p.scouted = true; p.hidTags = []; p.trH = false; if (p.potR) setPotRange(p, Math.min(8, p.potR[1] - p.potR[0]), Math.random);
        if (p.tags.includes('bust') && p.kind !== 'bust' && p.kind !== 'normal') p.tags = p.tags.filter(t => t !== 'bust'); if (p.kind === 'bust' && !p.tags.includes('bust')) p.tags.push('bust'); }
      d.firstLook = top.map(p => p.kid);
    }
    if (mine.length) { const up = (d.ups || []).find(u => u.ch === user);
      pushNews(save, `DRAFT REWARDS for your ${mine.map(k => COMP_INFO[k].name).join(', ')} title${mine.length > 1 ? 's' : ''}: you pick ${up ? up.n : 0} place${up && up.n === 1 ? '' : 's'} earlier in each round, +${mine.reduce((a, k) => a + TOUR_REWARDS[k].scout, 0)} scouting points${d.firstLook ? ', a first look at the top 6' : ''}${d.campInvite ? ', and a camp invite' : ''}.`); }
    return d;
  }; }

// ---------- declining: the development camp joins the old choices
{ const old = Object.assign({}, ALT_CHOICES); for (const k in old) delete ALT_CHOICES[k]; ALT_CHOICES.devcamp = 'Development camp'; Object.assign(ALT_CHOICES, old); }   // first in the list
{ const _aa = applyAlternative;
  applyAlternative = function (save, compKey, kind) {
    if (kind !== 'devcamp') return _aa.apply(this, arguments);
    const se = save.season; se.alts = se.alts || {}; if (se.alts[compKey]) return se.alts[compKey];
    giveDevBoost(save, save.teams[save.userTeamId], DEV_CAMP.mul, DEV_CAMP.days);
    se.alts[compKey] = { kind, text: DEV_CAMP_TEXT };
    pushNews(save, se.alts[compKey].text);
    return se.alts[compKey];
  }; }
// the invite card's reward line
function tourRewardLine(k) { const R = TOUR_REWARDS[k]; return R ? `WIN IT: ${R.perk}; ${R.draft}. DECLINE: a development camp (+${Math.round((DEV_CAMP.mul - 1) * 100)}% development for ${DEV_CAMP.days} days) or rest / training.` : ''; }
