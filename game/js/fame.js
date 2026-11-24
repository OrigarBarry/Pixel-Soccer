// ====================================================================
//  FAME, INTERVIEWS & SPONSORS
//  Players: fame (0-100) grows with points, wins and interviews. Famous players get sponsorship offers: he keeps 75%
//  (a happy player), the club gets 25% and the fans grow. Fame nudges his asking price up a little (max +10%).
//  Interviews: book a player (or yourself, the GM) onto tonight's PUCK TALK and pick the tone: humble, confident or
//  trash talk. How it lands depends on his personality and his form; trash talk sells tickets but fires up the rival.
//  The GM: a reputation built from wins, titles, kept promises and interviews. Better rep, better sponsor offers:
//  team deals (some with a win target and a bonus), a sponsor patch on your jersey and your sponsor on the boards.
// ====================================================================
const BRANDS = [
  { name: 'Frostbite Energy', short: 'FROSTBITE', c: '#38c6ff', c2: '#0b1a2a' }, { name: 'Northpeak Sports', short: 'NORTHPEAK', c: '#2f6b4a', c2: '#ffffff' },
  { name: 'Halfway Line Burgers', short: 'HALFWAY LINE', c: '#2456c8', c2: '#ffd23f' }, { name: 'Glacier Water', short: 'GLACIER', c: '#a8e6ff', c2: '#103a5c' },
  { name: 'Kickstop Auto', short: 'KICKSTOP', c: '#d9342b', c2: '#ffffff' }, { name: 'Maplewood Bank', short: 'MAPLEWOOD', c: '#7a2a1a', c2: '#ffd9a0' },
  { name: 'Ironskate', short: 'IRONSKATE', c: '#3a3f4a', c2: '#e8edf5' }, { name: 'Twin Pitch Pizza', short: 'TWIN PITCH', c: '#e86a1e', c2: '#fff4d6' },
  { name: 'Aurora Mobile', short: 'AURORA', c: '#7a4cff', c2: '#5ee07a' }, { name: 'Boreal Outfitters', short: 'BOREAL', c: '#4a5d2a', c2: '#f1e3b5' },
  { name: 'Coldsnap Cola', short: 'COLDSNAP', c: '#b0122a', c2: '#ffffff' }, { name: 'Screamer Cereal', short: 'SCREAMER', c: '#ffd23f', c2: '#6a1b9a' },
  { name: 'Thunder Tires', short: 'THUNDER', c: '#141414', c2: '#ffd23f' }, { name: 'Polar Trust', short: 'POLAR', c: '#0f4c81', c2: '#d6ecff' },
  { name: 'Hat Trick Hot Sauce', short: 'HAT TRICK', c: '#c0281c', c2: '#ffb000' },
];
// ---------- SPONSOR CHOICES (Nov 22): deals used to be free money (take everything: ~$2M a season, no downside).
// Now each brand has a CATEGORY (one brand per category across the whole club, team and player deals alike) and a
// PERSONALITY (what it pays extra for), and each deal is signed in a SHAPE (safe / bonus / partner).
const BRAND_META = {
  'Frostbite Energy': ['drink', 'tough'], 'Glacier Water': ['drink', 'family'], 'Coldsnap Cola': ['drink', 'hometown'],
  'Halfway Line Burgers': ['food', 'hometown'], 'Twin Pitch Pizza': ['food', 'hometown'], 'Power shot Cereal': ['food', 'family'], 'Hat Trick Hot Sauce': ['food', 'tough'],
  'Maplewood Bank': ['money', 'family'], 'Polar Trust': ['money', 'winner'],
  'Puckstop Auto': ['auto', 'winner'], 'Thunder Tires': ['auto', 'tough'],
  'Northpeak Sports': ['gear', 'winner'], 'Ironskate': ['gear', 'tough'], 'Boreal Outfitters': ['gear', 'family'],
  'Aurora Mobile': ['tech', 'hometown'],
};
const BRAND_CATS = { drink: 'DRINKS', food: 'FOOD', money: 'BANKING', auto: 'CARS', gear: 'GEAR', tech: 'PHONES' };
const BRAND_STYLES = {
  family:   { name: 'FAMILY', col: '#7ec8ff', short: 'Extra for clean games. Three rough ones and they leave.', team: 'pays extra for every clean game (one penalty or none, no scuffles). Three rough games (a scuffle or 3+ penalties) and they walk away.', pl: 'wants him to stay clean: no scuffles, few penalties. If he scuffles, they drop him.' },
  tough:    { name: 'TOUGH', col: '#ff7a4a', short: 'Extra for every tackle and card.', team: 'pays extra for every tackle and every carde.', pl: 'pays for hits and scuffles.' },
  winner:   { name: 'WINNERS', col: '#ffd23f', short: 'Extra for every win.', team: 'pays extra for every win, nothing for a loss.', pl: 'pays when the team wins.' },
  hometown: { name: 'HOMETOWN', col: '#5ee07a', short: 'Extra on home games, more with a full arena.', team: 'pays extra on home games, more the fuller your arena.', pl: 'pays as his fame grows.' },
};
const DEAL_SHAPES = {
  safe:    { name: 'SAFE', base: 1, kick: 0.4, pBase: 1, pBonus: 0.5, desc: 'Full guaranteed pay, small extras.' },
  bonus:   { name: 'BONUS', base: 0.5, kick: 2.0, pBase: 0.5, pBonus: 2.2, desc: 'Half the guarantee, much bigger extras when you play their way.' },
  partner: { name: 'PARTNER', base: 0.9, kick: 1, pBase: 0.9, pBonus: 1, desc: 'Runs through next season too, 20% more next season. Ending it early costs a buyout.' },
};
const brandMeta = n => { const m = BRAND_META[n] || ['other', 'winner']; return { cat: m[0], style: m[1] }; };
const SP_BUYOUT = 0.3;                                                     // ending a PARTNER deal early: 30% of what's left
const FAME = { cut: 0.25, offerMin: 45, ivCool: 8, gmCool: 6, offerLife: 6, refresh: 6, maxTeamDeals: 2 };
const rnd = (a, b) => a + Math.random() * (b - a);
const fmtK = k => k >= 1000 ? fmtM(k) : '$' + Math.round(k) + 'K';            // per-game sponsor money reads better in thousands
const brandBy = n => BRANDS.find(b => b.name === n) || BRANDS[0];
const gmMe = save => save.gm || (save.gm = { rep: 30, deals: [], offers: [], ivDay: -99, w: 0, l: 0, tro: null, offDay: -99, hist: [] });
const userT = save => save.teams[save.userTeamId];
const regLeft = save => { const se = save.season; if (!se) return 0; return Object.values(se.games).filter(g => g.type === 'reg' && !g.played && (g.home === save.userTeamId || g.away === save.userTeamId)).length; };

// ---------- player fame
const fameNatural = p => clampF(ovrInt(p) - 22 + (p.awards || []).length * 3, 5, 90);
function fameOf(p) { if (p.fame == null) p.fame = Math.round(fameNatural(p)); return p.fame; }
const addFame = (p, v) => { p.fame = Math.round(clampF(fameOf(p) + v, 0, 100)); };
const fameTier = f => f >= 85 ? 'SUPERSTAR' : f >= 65 ? 'FAN FAVOURITE' : f >= 45 ? 'KNOWN' : 'UNDER THE RADAR';
const fameAsk = p => 1 + clampF((fameOf(p) - 50) / 400, 0, 0.10);            // stars know their worth (max +10%)
function ptsOf(save, p) { const st = save.season && save.season.stats[p.id]; if (!st) return 0; let n = 0; for (const c of ['reg', 'po', 'tour']) { const l = st[c]; if (l) n += p.pos === 'G' ? (l.w || 0) * 1.4 + (l.sho || 0) * 2 : (l.g || 0) * 1.3 + (l.a || 0); } return n; }

// a player's sponsorship: one active deal at most, offers come as his fame grows
const spOf = p => p.spon || (p.spon = { deal: null, offer: null, last: -99 });
function makePlayerOffer(save, p) {
  const f = fameOf(p), b = BRANDS[Math.floor(Math.random() * BRANDS.length)];
  const perSeason = Math.round((40 + (f - FAME.offerMin) * 6) * rnd(0.85, 1.15) / 10) * 10, seasons = f >= 75 ? 2 : 1;
  const o = { brand: b.name, perSeason, seasons, day: mDay(save), v: 2 };
  o.goals = spGoalsFor(save, p, o);                                   // the targets come with the offer, so you see them before he signs
  return o;
}
function acceptPlayerDeal(save, p, shape = 'safe', sw = false) {
  const S0 = spOf(p), o = S0.offer; if (!o) return 'No offer.';
  const cs = o.v ? brandConflicts(save, o.brand, p) : [];
  if (cs.length && !sw) return `${o.brand} won't share the ${BRAND_CATS[brandMeta(o.brand).cat]} category with ${conflictText(cs)}.`;
  for (const x of cs) { if (x.type === 'team') endTeamDeal(save, x.d, 'switched'); else voidPlayerDeal(save, x.p, 'switch'); }
  const sh = o.v && DEAL_SHAPES[shape] ? shape : 'safe', SH = DEAL_SHAPES[sh];
  const seasons = sh === 'partner' ? Math.max(2, o.seasons) : o.seasons;
  S0.deal = Object.assign({}, o, { s: save.season.num, until: save.season.num + seasons - 1, seasons, shape: o.v ? sh : undefined, perSeason: o.v ? Math.round(o.perSeason * SH.pBase / 10) * 10 : o.perSeason }); S0.offer = null;
  S0.deal.goals = (o.v ? spGoalsFor(save, p, S0.deal) : (o.goals && o.goals.length ? o.goals : spGoalsFor(save, p, S0.deal))).map(x => Object.assign({}, x));
  if (sh === 'partner') addFame(p, 3);
  const M = moraleOf(p); M.fx.push({ label: 'New sponsor deal', v: Math.round(8 * (motiveOf(p) === 'money' ? 1.5 : 1)), d: mDay(save), len: 30 });
  addFame(p, 3); pushNews(save, `${mName(p)} signs a sponsorship deal with ${o.brand}.`);
  return null;
}
// ---------- SPONSOR GOALS: each player deal carries two targets for this regular season, set from his own pace and
// the games left. Hit one and the sponsor pays a bonus (he keeps 75%, the club gets its 25% cut), his fame and mood
// go up and it makes the news. A two-season deal gets fresh targets when the new season starts.
const SPG = { bonus: 0.35, minLeft: 4 };
function spLine(save, p) { const st = save.season && save.season.stats[p.id]; return (st && st.reg) || { gp: 0, g: 0, a: 0, w: 0, sa: 0, sv: 0, sho: 0, hit: 0, ds: 0, pim: 0, fw: 0, fl: 0 }; }
function spGoalsFor(save, p, deal) {
  const left = regLeft(save); if (left < SPG.minLeft) return [];
  const pace = (cur, gp, base) => (cur + base * 4) / (gp + 4);           // his rate this season, steadied by what his rating says
  const tgt = (cur, rate, mul) => cur + Math.max(1, Math.ceil(rate * left * mul));
  const l = spLine(save, p), ovr = ovrInt(p), out = [], SH = deal.v && DEAL_SHAPES[deal.shape || 'safe'];
  // the base pay already reflects the shape, so scale from the offer's full value
  const full = SH ? deal.perSeason / SH.pBase : deal.perSeason, bonus = Math.round(full * SPG.bonus * (SH ? SH.pBonus : 1) / 10) * 10;
  if (deal.v) {
    // the first target is his game (points, or wins for a goalie); the second is what this brand is about
    const st = brandMeta(deal.brand).style, gk = p.pos === 'G';
    if (gk) { const t = save.teams[p.teamId], starter = t && t.roster.goalies[0] === p.id, ts0 = save.season.standings[p.teamId] || {}, wr = ((ts0.w || 0) + 2) / ((ts0.gp || 0) + 4);
      out.push({ k: 'w', label: 'wins', cur0: l.w, need: tgt(l.w, wr * (starter ? 0.85 : 0.25), 0.9), bonus }); }
    else { const base = 0.12 + Math.max(0, ovr - 45) / 110; out.push({ k: 'pts', label: 'points', cur0: l.g + l.a, need: tgt(l.g + l.a, pace(l.g + l.a, l.gp, base), 1.0), bonus }); }
    if (st === 'family') out.push({ k: 'clean', label: 'clean season', cur0: l.pim || 0, f0: (l.fw || 0) + (l.fl || 0), need: (l.pim || 0) + Math.max(2, Math.round(left * 0.25)) * ((typeof BAL !== 'undefined' && BAL.pen && BAL.pen.len) || 30), bonus });
    else if (st === 'tough') out.push(gk ? { k: 'w', label: 'wins', cur0: l.w, need: l.w + Math.max(1, Math.ceil(left * 0.4)), bonus } : { k: 'hit', label: 'tackles', cur0: l.hit || 0, need: tgt(l.hit || 0, pace(l.hit || 0, l.gp, 1.6), 1.0), bonus });
    else if (st === 'winner') { const tw = (save.season.standings[p.teamId] || {}).w || 0; out.push({ k: 'tw', label: 'team wins', cur0: tw, need: tw + Math.max(1, Math.ceil(left * 0.55)), bonus }); }
    else out.push({ k: 'fame', label: 'fame', cur0: fameOf(p), need: Math.min(98, fameOf(p) + 10), bonus });
    return out.map(x => Object.assign(x, { s: save.season.num }));
  }

  if (p.pos === 'G') {
    const t = save.teams[p.teamId], starter = t && t.roster.goalies[0] === p.id, share = starter ? 0.85 : 0.25;
    const ts = save.season.standings[p.teamId] || {}, wr = ((ts.w || 0) + 2) / ((ts.gp || 0) + 4);   // how often his team wins
    out.push({ k: 'w', label: 'wins', cur0: l.w, need: tgt(l.w, wr * share, 0.9), bonus });
    out.push(starter ? { k: 'sv', label: 'SV% (6+ GP)', need: 0.906 + clampF((ovr - 70) / 2000, -0.008, 0.01), minGp: 6, bonus } : { k: 'sv', label: 'SV% (3+ GP)', need: 0.898, minGp: 3, bonus });
  } else {
    const base = 0.12 + Math.max(0, ovr - 45) / 110, pts = pace(l.g + l.a, l.gp, base), gl = pace(l.g, l.gp, base * (['sniper', 'speedster'].includes(p.arch) ? 0.55 : 0.4));
    const def = p.spos === 'LD' || p.spos === 'RD' || p.arch === 'defensive' || p.arch === 'enforcer';
    out.push({ k: 'pts', label: 'points', cur0: l.g + l.a, need: tgt(l.g + l.a, pts, 1.0), bonus });
    out.push(def ? (p.arch === 'enforcer' ? { k: 'hit', label: 'tackles', cur0: l.hit || 0, need: tgt(l.hit || 0, pace(l.hit || 0, l.gp, 2.2), 0.95), bonus }
                                          : { k: 'ds', label: 'def. stops', cur0: l.ds || 0, need: tgt(l.ds || 0, pace(l.ds || 0, l.gp, 0.8), 0.9), bonus })
                 : { k: 'g', label: 'goals', cur0: l.g, need: tgt(l.g, gl, 1.0), bonus });
  }
  return out.map(x => Object.assign(x, { s: save.season.num }));
}
function spGoalNow(save, p, gl) {
  const l = spLine(save, p);
  if (gl.k === 'sv') return l.sa ? l.sv / l.sa : 0;
  if (gl.k === 'clean') return l.pim || 0;
  if (gl.k === 'tw') return (save.season.standings[p.teamId] || {}).w || 0;
  if (gl.k === 'fame') return fameOf(p);
  if (gl.k === 'pts') return l.g + l.a;
  return l[gl.k] || 0;
}
const spGoalText = gl => gl.k === 'sv' ? `${fmtSv(gl.need)} ${gl.label}` : gl.k === 'clean' ? `stay clean (no scuffles, ${spPens(gl.need - (gl.cur0 || 0))} penalties max)` : gl.k === 'fame' ? `reach fame ${gl.need}` : `${gl.need} ${gl.label}`;
const spPens = pim => Math.round(pim / ((typeof BAL !== 'undefined' && BAL.pen && BAL.pen.len) || 30));
const spFights = (save, p) => { const l = spLine(save, p); return (l.fw || 0) + (l.fl || 0); };
function spGoalProg(save, p, gl) {
  const now = spGoalNow(save, p, gl);
  if (gl.k === 'clean') { const over = regLeft(save) === 0, ok = now <= gl.need && spFights(save, p) <= (gl.f0 || 0); return { now, txt: `${spPens(now - (gl.cur0 || 0))} of ${spPens(gl.need - (gl.cur0 || 0))} penalties`, k: ok ? (over ? 1 : 0.5) : 0, bad: !ok }; }
  if (gl.k === 'sv') { const gp = spLine(save, p).gp; return { now, txt: `${fmtSv(now)} in ${gp} GP`, k: gp >= gl.minGp && now >= gl.need ? 1 : Math.min(0.99, now / gl.need * (gp >= gl.minGp ? 1 : 0.9)) }; }
  return { now, txt: `${now} / ${gl.need}`, k: Math.min(1, (now - (gl.cur0 || 0)) / Math.max(1, gl.need - (gl.cur0 || 0))) };
}
// every game day (fameDay): pay any target just reached; at the end of the regular season, the rest are missed
function spGoalsDay(save, p) {
  const d = p.spon && p.spon.deal; if (!d) return;
  if (!d.goals || (d.goals[0] && d.goals[0].s !== save.season.num)) {
    if (d.shape === 'partner' && d.s < save.season.num && d.raised !== save.season.num) { d.raised = save.season.num; d.perSeason = Math.round(d.perSeason * 1.2 / 10) * 10; pushNews(save, `${mName(p)} starts year two with ${d.brand} (+20%).`); }
    if (d.until >= save.season.num && !save.season.done) d.goals = spGoalsFor(save, p, d);
  }
  const t = save.teams[p.teamId], over = regLeft(save) === 0;
  for (const gl of d.goals || []) {
    if (gl.done || gl.missed) continue;
    const pr = spGoalProg(save, p, gl);
    if (pr.bad) {
      gl.missed = true;
      if (spFights(save, p) > (gl.f0 || 0)) { voidPlayerDeal(save, p, 'walk'); if (typeof notify === 'function') notify(save, { text: `${d.brand} DROPPED #${p.num} ${p.last}: he fought, and family brands want clean players.` }); return; }
      pushNews(save, `${mName(p)} takes too many penalties for the ${d.brand} clean-season bonus.`); continue;
    }
    if (pr.k >= 1) {
      gl.done = true; d.bonusPaid = (d.bonusPaid || 0) + gl.bonus;
      if (t) ledger(t, 'deals', Math.round(gl.bonus * FAME.cut));
      addFame(p, 4); const M = moraleOf(p); M.fx.push({ label: 'Earned a sponsor bonus', v: motiveOf(p) === 'money' ? 8 : 5, d: mDay(save), len: 25 });
      pushNews(save, `${d.brand} bonus! ${mName(p)} reaches ${spGoalText(gl)} and earns ${fmtK(gl.bonus)} (the club's cut: ${fmtK(Math.round(gl.bonus * FAME.cut))}).`);
      if (typeof notify === 'function') notify(save, { text: `SPONSOR TARGET HIT: #${p.num} ${p.last} reached ${spGoalText(gl)} for ${d.brand} (+${fmtK(gl.bonus)}).` });
    } else if (over) { gl.missed = true; pushNews(save, `${mName(p)} falls short of the ${d.brand} target (${spGoalText(gl)}).`); }
  }
}
function declinePlayerDeal(save, p) { const S0 = spOf(p); if (!S0.offer) return 'No offer.'; pushNews(save, `${mName(p)} turns down ${S0.offer.brand}.`); S0.offer = null; return null; }
// (moodOf in morale.js adds the standing bonus for an active deal)
function sponsorMood(p) { const d = p.spon && p.spon.deal; return d ? { label: 'Sponsored by ' + d.brand, v: motiveOf(p) === 'money' ? 5 : 3 } : null; }

// ---------- the GM
const repTier = r => r >= 85 ? 'LEGENDARY GM' : r >= 65 ? 'STAR GM' : r >= 45 ? 'RESPECTED' : r >= 25 ? 'UP AND COMING' : 'UNKNOWN';
const gmRep = (save, v) => { const G = gmMe(save); G.rep = Math.round(clampF(G.rep + v, 0, 100) * 10) / 10; };
function dealValueK(save) { const G = gmMe(save), pop = finOf(userT(save)).pop; return 0.6 + G.rep / 100 * 0.8 + (pop - 50) / 100 * 0.4; }
function makeTeamOffers(save) {
  const G = gmMe(save), k = dealValueK(save), d = mDay(save), left = regLeft(save), taken = new Set(G.deals.map(x => x.brand).concat(G.offers.map(x => x.brand)));
  const pickB = () => { const fr = BRANDS.filter(b => !taken.has(b.name)); const b = (fr.length ? fr : BRANDS)[Math.floor(Math.random() * (fr.length || BRANDS.length))]; taken.add(b.name); return b; };
  const out = [];
  if (left >= 6) for (let i = 0; i < 2; i++) {
    const n = Math.min(left, 6 + Math.floor(Math.random() * 7)), per = Math.round(20 * k * rnd(0.85, 1.2));
    out.push({ id: 'o' + d + i, kind: 'team', brand: pickB().name, per, games: n, day: d, v: 2 });
  }
  if (!G.deals.some(x => x.kind === 'patch') && left >= 4) { const big = Math.random() < 0.5; out.push({ id: 'op' + d, kind: 'patch', size: big ? 'large' : 'small', brand: pickB().name, per: Math.round((big ? 34 : 18) * k * rnd(0.9, 1.15)), day: d, v: 2 }); }
  if (!G.deals.some(x => x.kind === 'boards') && left >= 4) out.push({ id: 'ob' + d, kind: 'boards', brand: pickB().name, per: Math.round(14 * k * rnd(0.9, 1.15)), day: d, v: 2 });
  G.offers = out; G.offDay = d;
}
// every active deal at the club, team and players, with its brand's category
function clubDeals(save) {
  const G = gmMe(save), t = userT(save), out = [];
  for (const d of G.deals) out.push({ type: 'team', d, brand: d.brand, cat: brandMeta(d.brand).cat });
  if (t) for (const id of [...rosterSkaters(t), ...rosterGoalies(t), ...(typeof farmIds === 'function' ? farmIds(t) : [])]) {
    const p = P(save, id), d = p && p.spon && p.spon.deal; if (d) out.push({ type: 'player', p, d, brand: d.brand, cat: brandMeta(d.brand).cat });
  }
  return out;
}
// the deals a new brand would clash with (same category, a different brand), leaving out `self`
function brandConflicts(save, brand, self) { const c = brandMeta(brand).cat; return clubDeals(save).filter(x => x.cat === c && x.brand !== brand && x.d !== self && x.p !== self); }
const conflictText = cs => cs.map(x => x.type === 'team' ? x.brand + ' (team deal)' : x.brand + ' (#' + x.p.num + ' ' + x.p.last + ')').join(', ');
// what's left of a partner deal, and the buyout to end it now
function teamDealLeft(save, d) {
  const left = regLeft(save), base = d.per * (DEAL_SHAPES[d.shape] || DEAL_SHAPES.safe).base;
  const games = d.kind === 'team' ? Math.max(0, d.games - d.played) : left;
  return base * (games + (d.shape === 'partner' && d.until > save.season.num ? (d.kind === 'team' ? d.games : FIN.regGames) * 1.2 : 0));
}
const dealBuyout = (save, d) => d.shape === 'partner' ? Math.round(teamDealLeft(save, d) * SP_BUYOUT / 10) * 10 : 0;
function endTeamDeal(save, d, why) {
  const G = gmMe(save), t = userT(save), cost = dealBuyout(save, d);
  if (cost) { ledger(t, 'deals', -cost); }
  G.deals = G.deals.filter(x => x !== d); (G.past = G.past || []).push(Object.assign({}, d, { ended: why || 'ended' })); if (G.past.length > 20) G.past.shift();
  pushNews(save, `The ${t.nick} end their deal with ${d.brand}` + (cost ? ` (buyout ${fmtK(cost)})` : '') + '.');
  return cost;
}
function voidPlayerDeal(save, p, why) {
  const S0 = spOf(p), d = S0.deal; if (!d) return;
  S0.deal = null; const M = moraleOf(p); M.fx.push({ label: why === 'walk' ? 'Dropped by his sponsor' : 'Lost his sponsor deal', v: -6, d: mDay(save), len: 25 });
  pushNews(save, why === 'walk' ? `${d.brand} drops ${mName(p)}: not the image they signed up for.` : `${mName(p)}'s deal with ${d.brand} ends: the club signed a rival brand.`);
}
// sign a team offer in a shape; `sw` = also end any deals with rival brands in its category
function acceptTeamOffer(save, id, shape = 'safe', sw = false) {
  const G = gmMe(save), o = G.offers.find(x => x.id === id); if (!o) return 'That offer is gone.';
  if (o.kind === 'team' && G.deals.filter(x => x.kind === 'team').length >= FAME.maxTeamDeals) return `You can run ${FAME.maxTeamDeals} team deals at a time. End one in TEAM DEALS first.`;
  if (o.kind !== 'team' && G.deals.some(x => x.kind === o.kind)) return 'You already have one of those. End it in TEAM DEALS first.';
  const cs = brandConflicts(save, o.brand);
  if (cs.length && !sw) return `${o.brand} won't share the ${BRAND_CATS[brandMeta(o.brand).cat]} category with ${conflictText(cs)}.`;
  for (const x of cs) { if (x.type === 'team') endTeamDeal(save, x.d, 'switched'); else voidPlayerDeal(save, x.p, 'switch'); }
  G.offers = G.offers.filter(x => x !== o);
  const sh = DEAL_SHAPES[shape] ? shape : 'safe';
  G.deals.push(Object.assign({}, o, { s: save.season.num, played: 0, won: 0, paid: 0, extra: 0, strikes: 0, shape: sh, v: 2, until: save.season.num + (sh === 'partner' ? 1 : 0) }));
  pushNews(save, (o.kind === 'patch' ? `The ${userT(save).nick} will wear a ${o.brand} patch on their jerseys` : o.kind === 'boards' ? `${o.brand} signs on as the ${userT(save).nick}' pitch-board sponsor` : `The ${userT(save).nick} sign a sponsorship deal with ${o.brand}`) + (sh === 'partner' ? ' (a two-season partnership).' : '.'));
  return null;
}
// what one regular-season game earns a deal on top of its guarantee, as a share of its base pay (before the shape)
function dealKick(style, gm) {
  // tuned (Nov 22) so BONUS only beats SAFE when the brand suits the club: the break-even is an average extra of
  // ~0.31 of the base per game, and an average club sits a little under it for every personality
  if (style === 'family') return gm.pens <= 1 && !gm.fights ? 0.42 : 0;
  if (style === 'tough') return Math.max(0, gm.hits - 8) * 0.04 + gm.fights * 0.5;
  if (style === 'winner') return gm.won ? 0.58 : 0;
  if (style === 'hometown') return gm.home ? Math.max(0, gm.fill - 0.55) * 2.6 : 0;
  return 0;
}
const dealDesc = o => {
  const sh = o.shape && DEAL_SHAPES[o.shape], per = sh ? Math.round(o.per * sh.base) : o.per;
  const when = o.kind === 'team' ? `for ${o.games} games` : 'for the rest of the season';
  return (o.kind === 'patch' ? `${o.size === 'large' ? 'Large' : 'Small'} jersey patch · ` : o.kind === 'boards' ? 'Your home pitch hoardings · ' : '') + `${fmtK(per)} a game ${when}` +
    (sh ? (o.shape === 'partner' ? ', and again next season (+20%)' : '') : '') + (!o.v && o.goal ? ` · win ${o.goal.w} of them: +${fmtK(o.goal.bonus)} bonus` : '');
};
// (finance.js) every regular-season game: sponsor money for the user's club and its players' deals
function dealsPay(save, g, res) {
  if (g.type !== 'reg') return;
  const uid = save.userTeamId; if (g.home !== uid && g.away !== uid) return;
  const t = userT(save), G = gmMe(save), won = (g.home === uid ? res.hs > res.as : res.as > res.hs);
  // this game, as the sponsors see it: penalties, fights, hits, the result, a home crowd
  const ts = (res.tstats || {})[uid] || {}, home = g.home === uid, fill = home ? (finOf(t).att || 0) / FIN.capacity : 0;
  const hits = (res.stats || []).filter(l => l.teamId === uid).reduce((a, l) => a + (l.hit || 0), 0);
  // (pim is stored in game seconds: one minor = BAL.pen.len)
  const pens = Math.round((ts.pim || 0) / ((typeof BAL !== 'undefined' && BAL.pen && BAL.pen.len) || 30));
  const gm = { pim: ts.pim || 0, pens, fights: ts.fights || 0, hits, won, home, fill };
  if (!G.kick || G.kick.s !== save.season.num) G.kick = { s: save.season.num, n: 0, rough: 0, family: 0, tough: 0, winner: 0, hometown: 0 };
  G.kick.n++; if (gm.fights || gm.pens >= 3) G.kick.rough++;
  for (const st of Object.keys(BRAND_STYLES)) G.kick[st] += dealKick(st, gm);
  for (const d of G.deals.slice()) {
    if (d.s !== save.season.num) continue;
    if (!d.v) { ledger(t, 'deals', d.per); d.paid += d.per; if (d.kind === 'team') { d.played++; if (won) d.won++; } continue; }   // a deal from before Nov 22: as it was
    const sh = DEAL_SHAPES[d.shape] || DEAL_SHAPES.safe, st = brandMeta(d.brand).style;
    const base = Math.round(d.per * sh.base), extra = Math.round(d.per * dealKick(st, gm) * sh.kick);
    ledger(t, 'deals', base + extra); d.paid += base + extra; d.extra = (d.extra || 0) + extra;
    if (d.kind === 'team') { d.played++; if (won) d.won++; }
    if (st === 'family' && (gm.fights || gm.pens >= 3)) {
      d.strikes = (d.strikes || 0) + 1;
      if (d.strikes >= 3) { G.deals = G.deals.filter(x => x !== d); (G.past = G.past || []).push(Object.assign({}, d, { ended: 'walked' })); gmRep(save, -2);
        pushNews(save, `${d.brand} walks away from the ${t.nick}: too many scuffles and penalties for a family brand.`);
        if (typeof notify === 'function') notify(save, { text: `${d.brand} ENDED YOUR DEAL: three ugly games (a scuffle or 3+ penalties). Family brands want clean soccer.` }); }
      else pushNews(save, `${d.brand} is unhappy with the ${t.nick}' rough play (warning ${d.strikes} of 3).`);
    }
  }
  for (const d of G.deals.filter(x => x.kind === 'team' && x.played >= x.games)) {
    if (d.v && d.shape === 'partner' && d.until > save.season.num) { d.waiting = true; continue; }   // a partner deal picks up again next season
    if (d.v) pushNews(save, `The ${d.brand} deal is done: ${fmtK(d.paid)} over ${d.games} games` + (d.extra ? `, ${fmtK(d.extra)} of it for playing their way.` : '.'));
    if (!d.v && d.goal && d.won >= d.goal.w) { ledger(t, 'deals', d.goal.bonus); gmRep(save, 2); pushNews(save, `Target hit! ${d.won} wins in ${d.games}: ${d.brand} pays the ${t.nick} a ${fmtK(d.goal.bonus)} bonus.`); }
    else if (d.goal) pushNews(save, `The ${d.brand} deal ends: ${d.won} wins in ${d.games}, short of the ${d.goal.w}-win bonus.`);
    (G.past = G.past || []).push(d); if (G.past.length > 20) G.past.shift();
  }
  G.deals = G.deals.filter(x => !(x.kind === 'team' && x.played >= x.games) || x.waiting);
  // the players' deals: the club's cut
  const per = FIN.regGames;
  for (const id of [...rosterSkaters(t), ...rosterGoalies(t)]) { const p = P(save, id), d = p && p.spon && p.spon.deal; if (d) ledger(t, 'deals', Math.round(d.perSeason * FAME.cut / per)); }
  // trash talk sold tickets: done once that home game is played
  if (save.hype && save.hype.gate && g.home === uid && g.away === save.hype.team) save.hype.gate = false;
}
// (finance.js attendance) the hyped home game draws a bigger crowd
const hypeGate = (save, g) => save.hype && save.hype.gate && g.type === 'reg' && g.home === save.userTeamId && g.away === save.hype.team ? 0.3 : 0;
function hypeSet(save, oppId, fire) {
  hypeClear(save);
  const o = save.teams[oppId]; if (!o) return;
  const vs = Object.values(save.season.games).filter(x => x.played && ((x.home === oppId && x.away === save.userTeamId) || (x.away === oppId && x.home === save.userTeamId))).length;
  save.hype = { team: oppId, gate: true, fire, vs, s: save.season.num };
  for (const id of [...rosterSkaters(o), ...rosterGoalies(o)]) { const p = P(save, id); if (p) p.fireUp = fire; }
}
function hypeClear(save) { const h0 = save.hype; if (!h0) return; const o = save.teams[h0.team]; for (const id in save.players) if (save.players[id].fireUp) save.players[id].fireUp = 0; save.hype = null; }
function hypeCheck(save) {
  const h0 = save.hype; if (!h0) return;
  if (!save.season || save.season.num !== h0.s) return hypeClear(save);
  const vs = Object.values(save.season.games).filter(x => x.played && ((x.home === h0.team && x.away === save.userTeamId) || (x.away === h0.team && x.home === save.userTeamId))).length;
  if (vs > h0.vs) { for (const id in save.players) if (save.players[id].fireUp) save.players[id].fireUp = 0; h0.fire = 0; if (!h0.gate) save.hype = null; }
}

// ---------- every new game day (called from moraleDay)
function fameDay(save) {
  const t = userT(save); if (!t || !save.season) return;
  const d = mDay(save), G = gmMe(save);
  hypeCheck(save);
  // the GM: wins, losses, titles
  const st = save.season.standings[t.id] || { w: 0, l: 0 };
  if (G.ws !== save.season.num) { G.ws = save.season.num; G.w = st.w || 0; G.l = (st.gp || 0) - (st.w || 0); }
  const w = st.w || 0, l = (st.gp || 0) - w;
  if (w > G.w) gmRep(save, (w - G.w) * 0.5); if (l > G.l) gmRep(save, -(l - G.l) * 0.35); G.w = w; G.l = l;
  const tro = save.trophies.filter(x => x.teamId === t.id).length; if (G.tro == null) G.tro = tro; if (tro > G.tro) { gmRep(save, (tro - G.tro) * 8); G.tro = tro; }
  G.hist.push({ d, v: G.rep }); if (G.hist.length > 30) G.hist.shift();
  // patch and boards deals end with the season
  for (const d of G.deals) if (d.v && d.shape === 'partner' && d.s < save.season.num && d.until >= save.season.num) {
    d.s = save.season.num; d.per = Math.round(d.per * 1.2); d.played = 0; d.won = 0; d.waiting = false; d.strikes = 0; d.paid = 0; d.extra = 0;
    gmRep(save, 1); pushNews(save, `${d.brand} and the ${t.nick} start year two of their partnership (+20%).`);
  }
  G.deals = G.deals.filter(x => x.s === save.season.num);
  // new offers every few game days (old ones expire)
  if (d - G.offDay >= FAME.refresh || (save.season.num * 1000 > G.offDay)) makeTeamOffers(save);
  // players: fame from production, drift toward his natural level; sponsorship offers
  for (const id of [...rosterSkaters(t), ...rosterGoalies(t)]) {
    const p = P(save, id); if (!p) continue;
    const pts = ptsOf(save, p), S0 = spOf(p);
    if (S0.ptsS !== save.season.num) { S0.ptsS = save.season.num; S0.pts = pts; }
    if (pts > S0.pts) addFame(p, (pts - S0.pts) * 1.2); S0.pts = pts;
    addFame(p, (fameNatural(p) - fameOf(p)) * 0.02);
    if (S0.deal && S0.deal.until < save.season.num) { pushNews(save, `${mName(p)}'s deal with ${S0.deal.brand} has ended.`); S0.deal = null; }
    if (S0.deal) spGoalsDay(save, p);
    if (S0.offer && d - S0.offer.day > FAME.offerLife) S0.offer = null;
    if (!S0.deal && !S0.offer && fameOf(p) >= FAME.offerMin && d - S0.last > 10 && Math.random() < 0.05 + (fameOf(p) - FAME.offerMin) / 400) {
      S0.offer = makePlayerOffer(save, p); S0.last = d;
      pushNews(save, `${S0.offer.brand} wants ${mName(p)} as the face of their brand.`);
      if (typeof notify === 'function') notify(save, { text: `SPONSOR OFFER: ${S0.offer.brand} wants #${p.num} ${p.last} (${fmtK(S0.offer.perSeason)} a season). See his profile.` });
    }
  }
  // famous players bring fans
  const star = [...rosterSkaters(t), ...rosterGoalies(t)].reduce((a, id) => { const p = P(save, id); return a + (p ? Math.max(0, fameOf(p) - 60) : 0); }, 0);
  if (star) { const f = finOf(t); f.pop = clampF(f.pop + star / 2500, 5, 100); }
}

// ---------- interviews (PUCK TALK)
const TONES = {
  humble:    { name: 'HUMBLE', desc: 'Credit the team. Safe, likeable.', fit: { loyal: 2, leader: 1 } },
  confident: { name: 'CONFIDENT', desc: 'Back yourself. Big reward if he is playing well.', fit: { scorer: 2, leader: 1, winner: 1 } },
  trash:     { name: 'TRASH TALK', desc: 'Call out the next opponent. Sells tickets, but they get fired up.', fit: { money: 1, scorer: 1, winner: 1, loyal: -2 } },
};
const pickA = a => a[Math.floor(Math.random() * a.length)];
function formOf(save, p) {                                   // points in his last few team games vs what he usually gets
  const st = save.season && save.season.stats[p.id] && save.season.stats[p.id].reg, gp = st ? st.gp : 0;
  if (gp < 3) return 0;
  const ppg = p.pos === 'G' ? (st.w || 0) / gp : ((st.g || 0) + (st.a || 0)) / gp, exp = p.pos === 'G' ? 0.5 : Math.max(0.15, (ovrInt(p) - 35) / 55);
  return ppg > exp * 1.25 ? 1 : ppg < exp * 0.6 ? -1 : 0;
}
function ivCan(save, who) {
  const d = mDay(save), G = gmMe(save);
  if (!save.season || save.season.done) return 'BALL TALK is off the air until next season.';
  if (save.pt && save.pt.feat && save.pt.feat.day === deskDay(save)) return 'Tonight\'s show already has a guest.';
  if (who === 'gm') return d - G.ivDay < FAME.gmCool ? `Next GM interview in ${FAME.gmCool - (d - G.ivDay)} game day(s).` : null;
  const S0 = spOf(who); return d - (S0.iv ?? -99) < FAME.ivCool ? `He can do another interview in ${FAME.ivCool - (d - S0.iv)} game day(s).` : null;
}
function nextOpp(save) { const g = nextUserGame(save); return g ? save.teams[g.home === save.userTeamId ? g.away : g.home] : null; }
function bookInterview(save, p, tone) {
  const no = ivCan(save, p); if (no) return no;
  const T0 = TONES[tone], m = motiveOf(p), form = formOf(save, p), opp = nextOpp(save), t = userT(save);
  let sc = (T0.fit[m] || 0) + form + (tone === 'confident' && form < 0 ? -1 : 0) + rnd(-1.2, 1.2);
  if (tone === 'trash' && !opp) sc -= 1;
  const res = sc >= 1.6 ? 'great' : sc >= 0 ? 'good' : 'awkward', R = { great: 0, good: 1, awkward: 2 }[res];
  const nm = p.last, on = opp ? (opp.nick || opp.name) : 'everybody';
  const fame = { humble: [5, 3, 1], confident: [9, 5, 1], trash: [13, 8, 3] }[tone][R], mood = { humble: [6, 4, 0], confident: [8, 5, 0], trash: [6, 4, 0] }[tone][R], pop = { humble: [1, 1, 0], confident: [1.5, 1, 0], trash: [3, 2, 1] }[tone][R];
  addFame(p, fame); finOf(t).pop = clampF(finOf(t).pop + pop, 5, 100);
  if (mood) moraleOf(p).fx.push({ label: 'Good interview', v: mood, d: mDay(save), len: 20 });
  if (tone === 'trash' && opp) hypeSet(save, opp.id, res === 'awkward' ? 0.03 : 0.02);
  spOf(p).iv = mDay(save);
  const Q = [0, pickA([`Joining us tonight: #${p.num} ${p.first} ${p.last}! How are you feeling about the team?`, `Our guest tonight is ${p.first} ${p.last}. Talk to us, what's going on in that room?`, `${p.first} ${p.last} is here! What's the mood like in the dressing room?`])];
  const A = { humble: [`It's all about the guys. I just try to do my job and help the team win.`, `Credit to my linemates. They make me look good out there, honestly.`, `We just take it one game at a time. Nobody's bigger than the team.`],
    confident: [`I'm feeling great. Give me the ball and I'll put it in the net. Simple.`, `Honestly? I think I'm one of the best in this league right now.`, `We're going places this year, and I'm going to lead the way.`],
    trash: [`The ${on}? I'm not worried. I've seen beer-league teams with better legs.`, `Tell the ${on} to bring extra keepers. They'll need them.`, `The ${on} talk a big game. We'll see who's talking after the final buzzer.`] }[tone];
  const B = res === 'great' ? (tone === 'trash' ? pickA(['OH HO HO! Now THAT is how you sell tickets! Love it!', 'Bulletin board material! The fans are going to EAT that up!']) : tone === 'humble' ? pickA(['Now THAT is a team guy. Your mother raised you right!', 'Class act. That is how you do it, kids!']) : pickA(['I LIKE IT! Confidence! Backed up by the numbers, too!', 'Swagger! And he has earned it. Beautiful!']))
    : res === 'good' ? pickA(['Solid answer. No nonsense. I respect that.', 'Good stuff. Keep playing like that and you will be back on this show.', 'Hey, not bad! Not bad at all.'])
    : (tone === 'trash' ? pickA(['Ooh... you might regret that one, kid. They HEARD that.', 'Big words! Now the whole other room is fired up. Good luck!']) : tone === 'confident' ? pickA(['Confident? With those numbers lately? Easy there, buddy.', 'Talk is cheap, kid. Show me on the pitch!']) : pickA(['Okay... a little sleepy there. Wake up!', 'That was about as exciting as a Mower lap. Next!']));
  save.pt = { feat: { day: deskDay(save), kind: 'player', pid: p.id, tone, res, lines: [Q, [2, pickA(A)], [1, B]] } };
  save.deskSeen = null;                                               // the hub plays tonight's show (with him) next time you're there
  const what = res === 'great' ? 'went great' : res === 'good' ? 'went well' : 'was a bit awkward';
  pushNews(save, `BALL TALK: ${mName(p)} sits down with ${typeof deskCohost === 'function' ? deskCohost(save).name : 'the panel'} and The Bone.` + (tone === 'trash' && opp ? ` He calls out the ${opp.nick || opp.name}!` : ''));
  return { res, fame, mood, pop, what, opp: tone === 'trash' && opp ? opp : null };
}
const GM_TONES = {
  hype:    { name: 'HYPE THE TEAM', desc: 'Sell the fans on this group. Best when you are winning.' },
  defend:  { name: 'BACK THE ROOM', desc: 'Stand up for your players. Best after a rough stretch.' },
  callout: { name: 'CALL OUT A RIVAL', desc: 'Go after the next opponent. Big crowd, fired-up rival.' },
};
function gmInterview(save, tone) {
  const no = ivCan(save, 'gm'); if (no) return no;
  const G = gmMe(save), t = userT(save), st = save.season.standings[t.id] || { w: 0, gp: 0 }, wp = st.gp >= 3 ? st.w / st.gp : 0.5, opp = nextOpp(save), d = mDay(save);
  const mine = Object.values(save.season.games).filter(g => g.played && (g.home === t.id || g.away === t.id)).slice(-4), lw = mine.filter(g => (g.home === t.id ? g.hs > g.as : g.as > g.hs)).length;
  const fit = tone === 'hype' ? (wp - 0.5) * 4 + (lw >= 3 ? 1 : 0) : tone === 'defend' ? (lw <= 1 ? 1.5 : 0) + 0.3 : (opp ? 0.5 : -1) + (G.rep >= 50 ? 0.5 : 0);
  const sc = fit + rnd(-1, 1), res = sc >= 1.2 ? 'great' : sc >= -0.2 ? 'good' : 'awkward', R = { great: 0, good: 1, awkward: 2 }[res];
  const rep = [3, 1.5, -1][R], pop = { hype: [3, 1.5, 0], defend: [1, 0.5, 0], callout: [3, 2, 1] }[tone][R], mood = { hype: [5, 3, 0], defend: [7, 4, 1], callout: [3, 2, 0] }[tone][R];
  gmRep(save, rep); finOf(t).pop = clampF(finOf(t).pop + pop, 5, 100); G.ivDay = d;
  if (mood) for (const id of [...rosterSkaters(t), ...rosterGoalies(t)]) { const p = P(save, id); if (p) moraleOf(p).fx.push({ label: 'The GM backed us', v: mood, d, len: 12 }); }
  if (tone === 'callout' && opp) hypeSet(save, opp.id, res === 'awkward' ? 0.03 : 0.02);
  const nick = t.nick || t.name, on = opp ? (opp.nick || opp.name) : 'the rest of the league';
  const Q = [0, pickA([`A special guest tonight: the general manager of the ${nick}! Thanks for coming in.`, `We've got the man in charge of the ${nick} with us. Welcome to BALL TALK!`])];
  const A = { hype: [`This group is special. Buy your tickets now, because this is going to be a ride.`, `I've never been prouder of a room. We're just getting started.`],
    defend: [`I believe in every guy in that room. Bumps in the road happen. We boot together.`, `Nobody outside our room gets to tell us who we are. We'll be fine.`],
    callout: [`The ${on}? Overrated. We'll show everybody when we see them.`, `I'd tell the ${on} to enjoy their record while it lasts.`] }[tone];
  const B = res === 'great' ? pickA(['Now THAT is a GM! The fans will love it!', 'Fire in the belly! I like this guy!']) : res === 'good' ? pickA(['Fair enough. Straight shooter.', 'Good answer. Now go make a trade, I\'m bored!']) : pickA(['Hmm. Bold words for where you are, my friend.', 'The fans might not buy that one. Just saying.']);
  save.pt = { feat: { day: deskDay(save), kind: 'gm', tone, res, lines: [Q, [2, pickA(A)], [1, B]] } };
  save.deskSeen = null;
  pushNews(save, `BALL TALK: the ${nick} GM goes on air` + (tone === 'callout' && opp ? ` and calls out the ${on}.` : '.'));
  return { res, rep, pop, mood, opp: tone === 'callout' && opp ? opp : null };
}
// the interview result pop-up
function ivResultBox(r, who) {
  modal(close => h('div', null, h('h2', null, 'BOOKED FOR TONIGHT\'S BALL TALK'),
    h('div', { class: 'sub', style: { fontSize: '9px', lineHeight: 2 } },
      r.res === 'great' ? 'It went GREAT. ' : r.res === 'good' ? 'It went well. ' : 'It was a bit awkward. ',
      r.fame != null ? `Fame +${r.fame} · mood +${r.mood} · fans +${r.pop}.` : `GM reputation ${r.rep >= 0 ? '+' : ''}${r.rep} · fans +${r.pop} · the room +${r.mood}.`,
      r.opp ? h('div', { class: 'gold' }, `The ${r.opp.nick || r.opp.name} heard it: they'll be fired up next time you play them, and your next home game against them draws a bigger crowd.`) : null),
    h('div', { class: 'muted', style: { fontSize: '8px' } }, 'Watch it on the BALL TALK desk on the hub.'),
    h('div', { class: 'row' }, h('button', { class: 'primary', onclick: close }, 'NICE'))));
}

// ---------- jersey patch & boards (drawn in sprites.js / engine.js)
function teamPatch(C) {
  const save = typeof UI !== 'undefined' && UI.save; if (!save || !C || C.id !== save.userTeamId || !save.gm) return null;
  const d = save.gm.deals.find(x => x.kind === 'patch' && save.season && x.s === save.season.num); if (!d) return null;
  const b = brandBy(d.brand); return { c: b.c, c2: b.c2, big: d.size === 'large' };
}
function dealBoardWords(H0, words) {
  const save = typeof UI !== 'undefined' && UI.save; if (!save || !H0 || H0.id !== save.userTeamId || !save.gm) return words;
  const d = save.gm.deals.find(x => x.kind === 'boards' && save.season && x.s === save.season.num); if (!d) return words;
  const w = brandBy(d.brand).short, out = []; words.forEach((x, i) => { out.push(i % 2 ? x : w); }); return out.length ? out : [w];
}

// ---------- UI pieces for the sponsor choices
function brandTags(name) {
  const m = brandMeta(name), st = BRAND_STYLES[m.style];
  return [h('span', { class: 'chip sptag', 'data-help': 'One brand per category at your club: a rival ' + (BRAND_CATS[m.cat] || '').toLowerCase() + ' brand would replace it.' }, BRAND_CATS[m.cat] || 'OTHER'),
    st ? h('span', { class: 'chip sptag', style: { color: st.col, borderColor: st.col }, 'data-help': name + ' ' + st.team }, st.name) : null];
}
// how well a brand suits the club as it plays this season
// how well a brand suits the club: what its extras would have paid in your games this season (BONUS beats SAFE when the
// average extra is above ~0.31 of the base), and for a family brand how often a game turned rough
function teamFit(save, brand) {
  const K = gmMe(save).kick, st = brandMeta(brand).style, S = BRAND_STYLES[st];
  if (!K || K.s !== save.season.num || K.n < 3 || !S) return null;
  const avg = K[st] / K.n, pct = Math.round(avg / 0.31 * 100), why = `in your ${K.n} games so far, BONUS would have paid ${pct}% of what SAFE pays`;
  if (st === 'family' && K.rough / K.n > 0.17) return ['RISKY', `${K.rough} of your ${K.n} games were rough (a scuffle or 3+ penalties): three in a deal and they walk`];
  return avg >= 0.35 ? ['GOOD FIT', why] : avg < 0.26 ? ['WEAK FIT', why] : ['OK FIT', why];
}
function playerFit(save, p, brand) {
  const st = brandMeta(brand).style, l = spLine(save, p), gp = Math.max(1, l.gp), rough = p.arch === 'enforcer' || (l.fw || 0) + (l.fl || 0) > 0 || spPens(l.pim || 0) / gp > 0.35;
  if (st === 'family') return rough ? ['RISKY', 'he plays rough: one scuffle and they drop him'] : ['GOOD FIT', 'he plays a clean game'];
  if (st === 'tough') return p.arch === 'enforcer' || p.arch === 'defensive' || (l.hit || 0) / gp >= 1.5 ? ['GOOD FIT', 'he tackles a lot'] : ['WEAK FIT', "he doesn't hit much"];
  if (st === 'winner') { const s0 = save.season.standings[p.teamId] || {}; const wp = s0.gp ? s0.w / s0.gp : 0.5; return wp >= 0.55 ? ['GOOD FIT', 'the team is winning'] : wp < 0.45 ? ['RISKY', 'the team is losing'] : ['OK FIT', 'the team is around .500']; }
  return fameOf(p) >= 65 ? ['GOOD FIT', 'he is already a fan favourite'] : ['OK FIT', 'his fame needs to grow'];
}
const spFitChip = f => f ? h('span', { class: 'chip sptag', style: { color: /GOOD/.test(f[0]) ? '#5ee07a' : /RISKY/.test(f[0]) ? '#ff7a6e' : '#c3c9e6', borderColor: 'currentColor' }, 'data-help': f[1] }, f[0]) : null;
// the three ways to sign: SAFE / BONUS / PARTNER, with what each pays; `cs` = rival deals it would replace
function shapeRow(vals, onPick, cs, extra) {
  const sw = cs && cs.length;
  return h('div', null,
    sw ? h('div', { class: 'sub red', style: { margin: '2px 0' } }, `Replaces ${conflictText(cs)} (same category).`) : null,
    h('div', { class: 'row spshapes', style: { margin: '3px 0 0', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-start' } },
      Object.entries(DEAL_SHAPES).map(([k, SH]) => h('button', { class: 'small' + (k === 'safe' ? ' primary' : ''), 'data-help': SH.desc, onclick: () => onPick(k, !!sw) },
        (sw ? 'SWITCH · ' : '') + SH.name, h('span', { class: 'muted' }, ' ' + vals[k]))), extra || null));
}
// ---------- UI: the player's SPOTLIGHT (inside the profile's KEEP HIM HAPPY panel)
function spotlightBlock(save, p, act, line) {
  const f = fameOf(p), S0 = spOf(p), no = ivCan(save, p);
  const bar = h('span', { class: 'moodbar', style: { width: '90px', display: 'inline-block' } }, h('i', { style: { width: f + '%', background: '#ffd23f' } }));
  return h('div', { style: { marginTop: '10px' } },
    h('div', { class: 'sub gold' }, 'SPOTLIGHT'),
    line(h('span', { 'data-help': 'FAME grows with points, wins and good interviews. Famous players attract sponsors and fans, and ask for a little more at contract time (up to +10%).' }, `Fame ${f}/100 · ${fameTier(f)}`), bar),
    h('div', { class: 'sub muted' }, no || 'Book him on tonight\'s BALL TALK. Pick his tone:'),
    no ? null : h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' } }, Object.entries(TONES).map(([k, T0]) => h('button', { class: 'small', title: T0.desc, onclick: () => act(() => { const r = bookInterview(save, p, k); if (typeof r === 'string') return r; setTimeout(() => ivResultBox(r), 50); return null; }) }, T0.name))),
    S0.deal ? h('div', { class: 'sub', style: { marginTop: '6px' } }, `Sponsor: ${S0.deal.brand} · ${fmtK(S0.deal.perSeason)} a season (club gets ${Math.round(FAME.cut * 100)}%) · through season ${S0.deal.until}`) : null,
    S0.deal && (S0.deal.goals || []).length ? h('div', { class: 'sub', style: { margin: '2px 0 0' }, 'data-help': 'Sponsor bonus targets this regular season: ' + S0.deal.goals.map(gl => `${spGoalText(gl)} (${spGoalProg(save, p, gl).txt}, +${fmtK(gl.bonus)})`).join(' · ') }, 'Targets: ' + S0.deal.goals.map(gl => `${gl.done ? '✓' : gl.missed ? '✕' : '◎'} ${spGoalText(gl)}`).join(' · ')) : null,
    S0.offer && S0.offer.v ? playerOfferBox(save, p, S0.offer, act) :
    S0.offer ? h('div', { class: 'panel', style: { margin: '6px 0 0', padding: '8px' } }, h('div', { class: 'sub gold' }, `OFFER: ${S0.offer.brand}`),
      h('div', { class: 'sub' }, `${fmtK(S0.offer.perSeason)} a season for ${S0.offer.seasons} season${S0.offer.seasons > 1 ? 's' : ''}. He keeps ${Math.round((1 - FAME.cut) * 100)}%, the club gets ${Math.round(FAME.cut * 100)}%. He'd be thrilled.`),
      (S0.offer.goals || []).length ? h('div', { class: 'sub' }, 'Bonus targets: ' + S0.offer.goals.map(gl => `${spGoalText(gl)} (+${fmtK(gl.bonus)})`).join(' · ')) : null,
      h('div', { style: { display: 'flex', gap: '6px', marginTop: '4px' } }, h('button', { class: 'small primary', onclick: () => act(() => acceptPlayerDeal(save, p)) }, 'SIGN'), h('button', { class: 'small', onclick: () => act(() => { spOf(p).offer = null; return null; }) }, 'TURN IT DOWN'))) : null);
}

// a player offer (new style): who, what the brand is about, the fit, and the three shapes
function playerOfferBox(save, p, o, act, compact) {
  const st = BRAND_STYLES[brandMeta(o.brand).style], ps = o.perSeason, cs = brandConflicts(save, o.brand, p);
  const vals = { safe: fmtK(ps) + '/yr', bonus: fmtK(Math.round(ps * 0.5 / 10) * 10) + '/yr +big bonus', partner: fmtK(Math.round(ps * 0.9 / 10) * 10) + '/yr · 2 yrs' };
  return h('div', { class: compact ? '' : 'panel', style: compact ? null : { margin: '6px 0 0', padding: '8px' } },
    compact ? null : h('div', { class: 'sub gold' }, `OFFER: ${o.brand}`),
    h('div', { class: 'row', style: { margin: '2px 0', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-start' } }, ...brandTags(o.brand), spFitChip(playerFit(save, p, o.brand))),
    h('div', { class: 'sub', style: { margin: '2px 0' }, 'data-help': `He keeps ${Math.round((1 - FAME.cut) * 100)}% of the money, the club gets ${Math.round(FAME.cut * 100)}%.` }, `${o.brand} ${st ? st.pl : ''}`),
    shapeRow(vals, (k, sw) => act(() => acceptPlayerDeal(save, p, k, sw)), cs, h('button', { class: 'small ghost', onclick: () => act(() => declinePlayerDeal(save, p)) }, 'TURN IT DOWN')));
}

// ---------- the SPONSORS & GM screen
function scrSponsors() {
  const save = UI.save, t = userT(save), G = gmMe(save), wrap = h('div');
  if (!G.offers.length && save.season && !save.season.done && mDay(save) - G.offDay >= FAME.refresh) makeTeamOffers(save);
  const render = () => {
    wrap.innerHTML = '';
    const msg = h('div', { class: 'sub', style: { minHeight: '1em' } });
    const act = fn => { const err = fn(); if (err) { msg.className = 'sub red'; msg.textContent = err; return; } Store.autosave(save); render(); };
    const st = save.season.standings[t.id] || { w: 0, gp: 0 }, tro = save.trophies.filter(x => x.teamId === t.id).length, no = ivCan(save, 'gm');
    const brandChip = n => { const b = brandBy(n); return h('span', { class: 'chip', style: { background: b.c, color: b.c2, borderColor: b.c2 } }, b.short); };
    const spark = h('canvas', { width: 150, height: 30, class: 'px', style: { width: '150px', height: '30px', background: '#0b1424', borderRadius: '3px' } });
    { const c = spark.getContext('2d'), H = G.hist.slice(-30); if (H.length > 1) { c.strokeStyle = '#ffd23f'; c.lineWidth = 2; c.beginPath(); H.forEach((x, i) => { const X = 3 + i * 144 / (H.length - 1), Y = 27 - x.v * 0.24; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.stroke(); } }
    wrap.appendChild(h('div', { class: 'grid two spgrid', style: { alignItems: 'start' } },
      h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'YOU, THE GM'),
        h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } }, badge(t, 56), h('div', { style: { fontSize: '9px', lineHeight: 2 } },
          h('div', { class: 'gold' }, repTier(G.rep)), h('div', null, `Reputation ${Math.round(G.rep)}/100`), h('div', { class: 'muted' }, `${t.city} ${t.nick} · ${st.w || 0}-${(st.gp || 0) - (st.w || 0)} this season · ${tro} troph${tro === 1 ? 'y' : 'ies'}`))),
        h('div', { style: { margin: '6px 0' } }, spark),
        h('div', { class: 'hint', 'data-help': 'Reputation grows with wins, titles, kept promises, deal targets hit and good interviews.' }, 'Better reputation brings better sponsor offers.'),
        h('h3', null, 'GO ON BALL TALK'),
        h('div', { class: 'sub muted' }, no || 'Pick your message:'),
        no ? null : h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' } }, Object.entries(GM_TONES).map(([k, T0]) => h('button', { class: 'small', style: { textAlign: 'left' }, onclick: () => act(() => { const r = gmInterview(save, k); if (typeof r === 'string') return r; setTimeout(() => ivResultBox(r), 50); return null; }) }, T0.name, h('span', { class: 'muted' }, ' · ' + T0.desc))))),
      (() => {
        // the right side in tabs: the club's deals, the players' deals (with their bonus targets), and new offers
        const roster = [...rosterSkaters(t), ...rosterGoalies(t)].map(id => P(save, id)).filter(Boolean);
        const signed = roster.filter(p => p.spon && p.spon.deal), pending = roster.filter(p => p.spon && p.spon.offer);
        const near = roster.filter(p => !(p.spon && (p.spon.deal || p.spon.offer))).sort((a, b) => fameOf(b) - fameOf(a)).slice(0, 4);
        const goalRow = (p, gl) => { const pr = spGoalProg(save, p, gl);
          return h('div', { class: 'spgoal' + (gl.done ? ' done' : gl.missed ? ' missed' : '') },
            h('span', null, gl.done ? '✓ ' : gl.missed ? '✕ ' : '◎ ', spGoalText(gl)),
            h('span', { class: 'spbar' }, h('i', { style: { width: Math.round(Math.max(0, pr.k) * 100) + '%' } })),
            h('span', { class: 'muted' }, pr.txt), h('b', { class: gl.done ? 'green' : 'gold' }, '+' + fmtK(gl.bonus))); };
        const pCard = (p, o, isOffer) => h('div', { class: 'spcard' },
          h('div', { class: 'sphead' }, portrait(p, t, 22), h('div', { style: { flex: 1, minWidth: 0 } },
            h('div', { class: 'spname' }, isOffer ? h('span', { class: 'chip', style: { color: '#ffd23f', borderColor: '#ffd23f' } }, 'NEW OFFER') : null, ' ', h('a', { class: 'lnk', onclick: () => profile(p.id) }, '#' + p.num + ' ' + p.last.toUpperCase()), ' ', brandChip(o.brand)),
            h('div', { class: 'muted', 'data-help': `He keeps ${100 - Math.round(FAME.cut * 100)}%, the club gets ${Math.round(FAME.cut * 100)}% of the deal and of every bonus.` }, `${fmtK(o.perSeason)}/season · ${isOffer ? o.seasons + ' season' + (o.seasons > 1 ? 's' : '') : 'to ' + seasonLabel(save.season.year + (o.until - save.season.num)).slice(-5)} · club ${Math.round(FAME.cut * 100)}%` + (o.bonusPaid ? ` · bonuses ${fmtK(o.bonusPaid)}` : ''))),
            isOffer && o.v ? null :
            isOffer ? h('div', { class: 'row', style: { margin: 0, gap: '4px', flexWrap: 'nowrap' } },
              h('button', { class: 'small primary', onclick: () => act(() => acceptPlayerDeal(save, p)) }, 'SIGN'), h('button', { class: 'small', onclick: () => act(() => declinePlayerDeal(save, p)) }, 'DECLINE')) : null,
            !isOffer && o.v ? h('div', { class: 'row', style: { margin: '2px 0 0', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-start' } }, ...brandTags(o.brand), h('span', { class: 'chip sptag' }, (DEAL_SHAPES[o.shape] || DEAL_SHAPES.safe).name)) : null),
          isOffer && o.v ? h('div', { style: { margin: '2px 0 4px' } }, playerOfferBox(save, p, o, act, true)) : null,
          (o.goals || []).length ? h('div', null, h('div', { class: 'muted spgl' }, 'BONUS TARGETS THIS REGULAR SEASON'), o.goals.map(gl => goalRow(p, gl)))
            : h('div', { class: 'muted spgl' }, 'No bonus targets: too few regular-season games left.'));
        const teamDeals = () => h('div', { class: 'panel' },
          G.deals.length ? G.deals.map(d => h('div', { class: 'sprow' }, brandChip(d.brand),
            h('div', { style: { flex: 1 } }, h('div', { class: 'row', style: { margin: 0, gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-start' } }, h('span', null, d.brand), ...(d.v ? brandTags(d.brand) : []), d.v ? h('span', { class: 'chip sptag' }, (DEAL_SHAPES[d.shape] || DEAL_SHAPES.safe).name) : null),
              h('div', { class: 'muted' }, dealDesc(d) + (d.kind === 'team' ? ` · ${d.played}/${d.games} played, ${d.won} won` : '') + ` · paid ${fmtK(d.paid)}` + (d.v && d.extra ? ` (${fmtK(d.extra)} extras)` : '')),
              d.v && brandMeta(d.brand).style === 'family' ? h('div', { class: d.strikes ? 'sub red' : 'sub muted', style: { margin: 0 } }, `Warnings: ${d.strikes || 0} of 3 (a game with a scuffle or 3+ penalties)`) : null,
              d.v ? h('button', { class: 'small ghost', style: { marginTop: '3px' }, onclick: () => confirmDlg(`End the ${d.brand} deal now?` + (dealBuyout(save, d) ? ` It's a partnership: the buyout is ${fmtK(dealBuyout(save, d))}.` : ''), 'END DEAL', () => { endTeamDeal(save, d, 'ended'); Store.autosave(save); render(); }) }, 'END DEAL' + (dealBuyout(save, d) ? ' (' + fmtK(dealBuyout(save, d)) + ')' : '')) : null,
              d.kind === 'team' && d.goal ? h('div', { class: 'spgoal' }, h('span', null, `◎ ${d.goal.w} wins`), h('span', { class: 'spbar' }, h('i', { style: { width: Math.round(Math.min(1, d.won / d.goal.w) * 100) + '%' } })), h('span', { class: 'muted' }, `${d.won} / ${d.goal.w}`), h('b', { class: 'gold' }, '+' + fmtK(d.goal.bonus))) : null)))
            : h('div', { class: 'sub muted' }, 'No team deals yet. Sign one from OFFERS.'));
        const cards = pending.map(p => ({ p, o: p.spon.offer, off: true })).concat(signed.map(p => ({ p, o: p.spon.deal, off: false })));
        const playerDeals = () => h('div', { class: 'panel' },
          cards.length ? pages('spcards', cards, 2, sl => h('div', null, sl.map(c => pCard(c.p, c.o, c.off)))) : null,
          !signed.length && !pending.length ? h('div', { class: 'sub muted' }, 'No player sponsorships yet. Brands come calling once a player\'s fame reaches ' + FAME.offerMin + '.') : null,
          near.length ? h('div', { class: 'spnear' }, h('span', { class: 'muted', 'data-help': 'Fame (0-100). Offers can come once a player reaches ' + FAME.offerMin + '; the higher his fame, the sooner and the bigger.' }, 'Next in line (fame): '), near.map((p, k) => h('span', { 'data-help': `Fame ${fameOf(p)}/100 (${fameTier(fameOf(p))}). Fame grows with points, wins and good interviews.` }, (k ? ' · ' : '') + p.last + ' ' + fameOf(p)))) : null);
        const offersEl = () => h('div', { class: 'panel' },
          save.season.done ? h('div', { class: 'sub muted' }, 'New offers when the season starts.') : G.offers.length ? G.offers.map(o => { const st = BRAND_STYLES[brandMeta(o.brand).style];
            const vals = { safe: fmtK(o.per) + '/g', bonus: fmtK(Math.round(o.per * 0.5)) + '/g +2x extras', partner: fmtK(Math.round(o.per * 0.9)) + '/g · 2 yrs' };
            return h('div', { class: 'sprow', style: { alignItems: 'flex-start' } }, brandChip(o.brand),
            h('div', { style: { flex: 1, minWidth: 0 } }, h('div', { class: 'row', style: { margin: 0, gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-start' } }, h('span', null, o.brand + (o.kind === 'patch' ? ' · JERSEY PATCH' : o.kind === 'boards' ? ' · PITCH HOARDINGS' : ' · ' + o.games + ' GAMES')), ...brandTags(o.brand), spFitChip(teamFit(save, o.brand))),
              h('div', { class: 'muted', 'data-help': st ? o.brand + ' ' + st.team : '' }, st ? st.short : dealDesc(o)),
              shapeRow(vals, (k, sw) => act(() => acceptTeamOffer(save, o.id, k, sw)), brandConflicts(save, o.brand)))); }) : h('div', { class: 'sub muted' }, 'No offers right now.'),
          h('div', { class: 'hint', 'data-help': 'A patch shows on your jerseys and a hoardings deal puts the sponsor on your home pitch. SAFE pays the most up front; BONUS pays half up front and much more when you play the way the brand likes; PARTNER keeps the deal through next season with a 20% raise, but costs a buyout to end early. Only one brand per category across the club.' }, `New offers every ${FAME.refresh} game days. One brand per category: pick the ones that suit how you play.`));
        if (UI.tabMem && UI.tabMem.sponsorside == null && pending.length) UI.tabMem.sponsorside = 1;
        return h('div', null, tabbed('sponsorside', [
          { label: 'TEAM DEALS (' + G.deals.length + ')', el: teamDeals },
          { label: 'PLAYER DEALS (' + signed.length + (pending.length ? ' +' + pending.length + ' NEW' : '') + ')', el: playerDeals },
          { label: 'OFFERS (' + (save.season.done ? 0 : G.offers.length) + ')', el: offersEl }]), msg);
      })()));
  };
  render();
  return h('div', { class: 'screen wide sponsorS' }, header('SPONSORS & GM', () => go(scrHub)), wrap);
}
