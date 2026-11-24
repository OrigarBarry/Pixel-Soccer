'use strict';
// ====================================================================
//  FRANCHISE BUSINESS: contracts & negotiation, free agency, trades, finances (soft cap), transactions.
//  Money is kept in thousands of dollars ($K). All tuning in FIN.
// ====================================================================
const FIN = {
  cap: 16000,               // soft salary cap (payroll above it is taxed progressively)
  taxBrackets: [[1000, 0.5], [1000, 1.0], [1000, 1.5], [Infinity, 2.0]],
  minSal: 300, maxSal: 6500,
  ops: 3600,                // operating costs per season
  tv: 7600,                 // league TV share per season (equal for all)
  startCash: 5000,
  capacity: 12000, ticket: 0.042,   // $K per fan (a $42 ticket)
  merchBase: 1400, sponsBase: 2400, // scaled by popularity (50 = 1x)
  tourEntry: 250, tourWin: { inv: 600, classic: 700, winter: 800, finale: 700, toc: 1200 },
  poRound: 400, champ: 2500,
  regGames: 24,
  faDays: 3,                // offseason free-agency days
  soughtTop: 0.12,          // the top 12% of free agents (by value) compare offers before deciding
  tradeMargin: 1.04,        // AI wants a little more value than it gives
  rookieYrs: 3,
};
const fmtM = k => (k < 0 ? '-$' : '$') + (Math.abs(k) / 1000).toFixed(Math.abs(k) >= 10000 ? 1 : 2) + 'M';
const hashF = (id, salt) => { let h = 2166136261; for (const c of String(id) + salt) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 1000) / 1000; };

// ---------- player preferences (stable per player): 1..5 each
const PREF_KEYS = { money: 'Money', win: 'Winning', ice: 'Playing time', loyal: 'Loyalty', role: 'Team role' };
function prefOf(p) {
  if (!p.pref) { p.pref = {}; for (const k in PREF_KEYS) p.pref[k] = 1 + Math.floor(hashF(p.id, k) * 5); }
  return p.pref;
}
function topPrefs(p, n = 2) { const pr = prefOf(p); return Object.keys(PREF_KEYS).sort((a, b) => pr[b] - pr[a]).slice(0, n); }

// ---------- market value of a player (one season's fair salary), relative to the league's talent level
let LEAGUE_ADJ = 0;                   // league mean rating minus the reference mean (kept up to date each season)
function setLeagueAdj(save) {
  const act = Object.values(save.players).filter(p => p.status === 'active' && p.teamId);
  if (act.length < 50) return;
  LEAGUE_ADJ = clampF(act.reduce((a, p) => a + overall(p), 0) / act.length - 5.55, -1.5, 1.5);
}
function worth(p) {
  const o = overall(p) - LEAGUE_ADJ;
  let v = 300 + 95 * Math.pow(Math.max(0, o - 3), 1.9);
  if (p.pos === 'G') v *= 1.05;
  if (p.age <= 23) v += Math.max(0, (typeof potE === 'function' ? potE(p) : p.pot || o) - o) * 90;
  if (p.age >= 33) v *= 0.86; if (p.age >= 36) v *= 0.8;
  v *= 1 + (p.traits || []).length * 0.03;
  return Math.round(clampF(v, FIN.minSal, FIN.maxSal) / 10) * 10;
}
const clampF = (v, a, b) => Math.max(a, Math.min(b, v));
const contractOf = p => p.contract || null;
const salOf = p => (p.contract ? p.contract.sal : 0);
function payroll(save, team) { return rosterIds(team).reduce((a, id) => a + salOf(P(save, id)), 0); }
function capTax(pay) {
  let over = pay - FIN.cap, tax = 0;
  for (const [w, r] of FIN.taxBrackets) { if (over <= 0) break; const x = Math.min(over, w); tax += x * r; over -= x; }
  return Math.round(tax);
}
function capSpace(save, team) { return FIN.cap - payroll(save, team); }

// ---------- team context for a player: quality and the role he'd have
function teamQuality(save, teamId) {
  // cached per moment (season day / offseason step): ranking 24 rosters is not free
  const key = save.seasonNum + '|' + (save.off ? save.off.phase + ':' + save.off.day : '') + '|' + (save.season ? save.season.calIdx : '');
  if (!save._tq || save._tq.key !== key) {
    const ids = save.teamOrder.slice().sort((a, b) => teamStrength(save, b) - teamStrength(save, a));
    Object.defineProperty(save, '_tq', { value: { key, rank: Object.fromEntries(ids.map((id, i) => [id, i])) }, writable: true, configurable: true, enumerable: false });
  }
  return 1 - (save._tq.rank[teamId] ?? 12) / Math.max(1, save.teamOrder.length - 1);           // 1 = best
}
function projectedRole(save, team, p) {
  const same = (p.pos === 'G' ? rosterGoalies(team) : rosterSkaters(team)).map(id => P(save, id)).filter(x => x.id !== p.id);
  const better = same.filter(x => overall(x) > overall(p)).length;
  if (p.pos === 'G') return better === 0 ? { k: 'starter', s: 1, label: 'Starting keeper' } : { k: 'backup', s: 0.35, label: 'Backup keeper' };
  return better < 3 ? { k: 'top', s: 1, label: 'Top line' } : better < 6 ? { k: 'mid', s: 0.7, label: 'Second line' } : better < 9 ? { k: 'depth', s: 0.45, label: 'Third line' } : { k: 'res', s: 0.15, label: 'Reserve' };
}
// ---------- MOTIVES (separate from on-ice traits): what each player wants most from his club.
// money: takes the biggest cheque, no loyalty · winner: wants a contender · loyal: wants to stay put
// scorer: wants goals, points and top-line minutes · leader: wants a letter and a big role
const MOTIVES = {
  money:  { name: 'MONEY FIRST', short: 'Money', desc: 'Only the cheque matters. He takes the highest offer and gives no hometown discount.' },
  winner: { name: 'WINNER', short: 'Winning', desc: 'Wants to win now. Happy on a contender, restless on a losing team.' },
  loyal:  { name: 'ONE-CLUB MAN', short: 'Loyalty', desc: 'Wants to stay with his club for years. Big hometown discount, slow to leave.' },
  scorer: { name: 'GOAL-HUNGRY', short: 'Scoring', desc: 'Wants goals, points and top-line minutes. Happy when he is producing.' },
  leader: { name: 'LEADER', short: 'Leadership', desc: 'Wants a letter on his jersey and a big role in the room.' },
};
// the motive as shown for this player (a goal-hungry goalie wants the crease)
const motiveInfo = p => { const m = motiveOf(p); return p.pos === 'G' && m === 'scorer' ? { name: 'WANTS THE NET', short: 'Starts', desc: 'Wants to be the starting keeper and play every night.' } : MOTIVES[m]; };
const MOTIVE_OF_PREF = { money: 'money', win: 'winner', loyal: 'loyal', ice: 'scorer', role: 'leader' };
const motiveOf = p => {                                                                   // his strongest want (ties settled by a stable coin flip)
  if (p._mot) return p._mot;
  const pr = prefOf(p), ks = Object.keys(MOTIVE_OF_PREF), top = Math.max(...ks.map(k => pr[k])), tied = ks.filter(k => pr[k] === top);
  const m = MOTIVE_OF_PREF[tied[Math.floor(hashF(p.id, 'motive') * tied.length)]];
  Object.defineProperty(p, '_mot', { value: m, enumerable: false, configurable: true });
  return m;
};
// how happy he is with his current club (0-100), and why
function moodBase(save, p) {
  const t = p.teamId && save.teams[p.teamId]; if (!t) return { v: 50, why: '' };
  const m = motiveOf(p), clamp100 = v => Math.round(clampF(v, 0, 100));
  if (m === 'money') { const r = p.contract ? p.contract.sal / Math.max(1, worth(p)) : 1; return { v: clamp100(50 + (r - 1) * 120), why: r >= 1 ? 'well paid' : 'feels underpaid' }; }
  if (m === 'winner') {
    const st = save.season && save.season.standings[t.id], wp = st && st.gp >= 4 ? st.w / st.gp : null, q = teamQuality(save, t.id);
    const v = wp != null ? wp * 100 * 0.7 + q * 100 * 0.3 : q * 100;
    return { v: clamp100(v), why: v >= 55 ? 'likes the team\'s chances' : 'tired of losing' };
  }
  if (m === 'loyal') { const tn = tenureOf(save, p); return { v: clamp100(60 + tn.seasons * 8), why: tn.seasons ? `${tn.seasons} season${tn.seasons > 1 ? 's' : ''} here` : 'new here' }; }
  if (m === 'scorer') {
    const cur = save.season && save.season.stats[p.id], reg = cur && cur.reg, gp = reg ? reg.gp : 0;
    const exp = p.pos === 'G' ? 0 : Math.max(0.15, (ovrInt(p) - 35) / 55);           // points per game he expects
    const role = projectedRole(save, t, p).s;
    const v = p.pos === 'G' ? role * 100 : (gp >= 3 ? 50 + ((reg.g + reg.a) / gp / exp - 1) * 55 : 50) + (role - 0.6) * 40;
    return { v: clamp100(v), why: role >= 0.7 ? (v >= 50 ? 'producing on a top line' : 'not scoring enough') : 'wants more playing time' };
  }
  const L = leaderOf(t, p.id), role = projectedRole(save, t, p).s, wait = !L && lettersOutrank(save, t, p);
  const v = L === 'C' ? 92 : L === 'A' ? 72 : wait ? Math.max(58, 30 + role * 30) : 30 + role * 30;
  return { v: clamp100(v), why: L === 'C' ? 'wears the C' : L === 'A' ? 'wears an A' : wait ? 'happy to wait his turn' : 'wants a letter' };
}
// no shame in waiting: the C is worn, and everyone wearing a letter has more standing in the room than he does.
// A player who wants a letter takes no hit (mood or contract appeal) for going without one then.
function lettersOutrank(save, t, p) {
  const L = t && t.leaders; if (!L || !L.c || typeof standingOf !== 'function' || leaderOf(t, p.id)) return false;
  const ids = [L.c, ...(L.a || [])].filter(id => id && save.players[id]); if (!ids.length) return false;
  const me = standingOf(p, t); return ids.every(id => standingOf(save.players[id], t) >= me);
}
// how attractive a team is to this player (1 = neutral; higher = he'll take less)
function teamAppeal(save, p, team) {
  const pr = prefOf(p), q = teamQuality(save, team.id), role = projectedRole(save, team, p).s;
  const own = p.teamId === team.id || (p.lastTeamId === team.id && p.status === 'free');
  const lead = leaderOf(team, p.id) || lettersOutrank(save, team, p) ? 1 : 0;                // a letter, or no shame in waiting for one
  const m = motiveOf(p), k = key => (MOTIVE_OF_PREF[key] === m ? 2 : 1);              // his main motive counts double
  if (m === 'money') return 1;                                                             // a mercenary only reads the number
  let a = 1 + (pr.win - 3) * 0.045 * (q - 0.5) * 2 * k('win') + (pr.ice - 3) * 0.045 * (role - 0.55) * 2 * k('ice') + (pr.loyal - 3) * (own ? 0.05 : -0.012) * k('loyal') + (pr.role - 3) * 0.03 * (role >= 0.7 || lead ? 1 : -0.6) * k('role');
  return clampF(a, 0.7, 1.35);
}
const prefYears = p => p.age >= 31 ? 3 : p.age <= 23 ? 2 : 3;
// what he asks from this team for a given length
// ---------- LOYALTY & DEVELOPMENT: a player who has grown with a club gives it a hometown discount.
// It builds with seasons together, with every rating point he gained there and if the club drafted him;
// players who value loyalty give more. It only applies when his own club re-signs or extends him.
function tenureOf(save, p) {
  if (!p.teamId) return null;
  if (!p.tj || p.tj.t !== p.teamId) {                        // older saves: rebuild the tenure from his season log
    const ss = p.seasons || []; let i = ss.length;
    while (i > 0 && ss[i - 1].teamId === p.teamId) i--;
    const streak = ss.slice(i);
    p.tj = { t: p.teamId, s: streak.length ? streak[0].s : (save.season ? save.season.num : 0), o: i > 0 ? ss[i - 1].ovr : streak.length ? streak[0].ovr : ovrInt(p) };
  }
  const cur = save.season ? save.season.num : 0;
  return { seasons: Math.max(0, cur - p.tj.s), growth: Math.max(0, ovrInt(p) - p.tj.o), home: !!(p.draft && p.draft.teamId === p.teamId), from: p.tj.o };
}
function loyaltyInfo(save, p, team) {
  const t = tenureOf(save, p);
  if (!t || !team || p.teamId !== team.id) return { pct: 0, seasons: 0, growth: 0, home: false };
  const loyal = prefOf(p).loyal, mult = 0.7 + (loyal - 1) * 0.15;                         // 0.70 .. 1.30
  const raw = Math.min(0.10, t.seasons * 0.025) + Math.min(0.20, t.growth * 0.012) + (t.home ? 0.05 : 0);
  const m = motiveOf(p), mm = m === 'money' ? 0 : m === 'loyal' ? 1.5 : 1;            // mercenaries give nothing back, one-club men give the most
  return { pct: Math.min(m === 'loyal' ? 0.45 : 0.35, raw * mult * mm), seasons: t.seasons, growth: t.growth, home: t.home, from: t.from, icon: t.seasons >= 5, motive: m };
}
function loyaltyLine(li) {
  if (!li.pct) return '';
  const why = [li.seasons ? `${li.seasons} season${li.seasons > 1 ? 's' : ''} with you` : '', li.growth ? `developed +${li.growth} OVR here` : '', li.home ? 'drafted by you' : ''].filter(Boolean).join(', ');
  return `Hometown discount -${Math.round(li.pct * 100)}% (${why}).`;
}
function askFor(save, p, team, yrs) {
  const pr = prefOf(p), w = worth(p), py = prefYears(p);
  const heat = p.status === 'free' && isSought(save, p) ? 1.08 : 1;
  let s = w * (1 + (pr.money - 3) * 0.06) / teamAppeal(save, p, team) * heat;
  s *= 1 + Math.abs((yrs || py) - py) * 0.04;
  if (p.age >= 33 && yrs > 2) s *= 0.97;                               // veterans like security
  if (team && p.teamId === team.id && p.status !== 'free') {
    s *= 1 - loyaltyInfo(save, p, team).pct;                                               // hometown discount
    s *= 1 + (50 - moodOf(save, p).v) / 300;                                               // a happy player asks less, an unhappy one more (±17%)
    if (motiveOf(p) === 'money') s = Math.max(s, worth(p) * 1.05);                         // he knows what the market pays
  }
  if (typeof fameAsk === 'function') s *= fameAsk(p);                                       // famous players know their worth (max +10%)
  return Math.round(clampF(s, FIN.minSal, FIN.maxSal) / 10) * 10;
}

// ---------- negotiation (state persisted, so patience can't be reset by reloading)
const negKey = (pid, teamId) => pid + '@' + teamId;
function negState(save, p, team) {
  save.neg = save.neg || {};
  const k = negKey(p.id, team.id), pr = prefOf(p);
  return save.neg[k] || (save.neg[k] = { pat: 3 + (pr.loyal >= 4 ? 1 : 0) - (pr.money >= 5 ? 1 : 0) + (p.teamId === team.id ? 1 : 0) + (p.teamId === team.id && loyaltyInfo(save, p, team).seasons >= 4 ? 1 : 0) + (p.teamId === team.id && moodOf(save, p).v < 25 ? -1 : 0), round: 0, s: save.seasonNum, last: null, walked: false });
}
// likelihood (0-1) this offer is accepted outright
function acceptLikelihood(save, p, team, offer) {
  const r = offer.sal / askFor(save, p, team, offer.yrs);
  return clampF((r - 0.9) / 0.1, 0, 1);
}
function evalOffer(save, p, team, offer) {
  const st = negState(save, p, team);
  if (st.walked) return { result: 'walk', msg: `${p.first} ${p.last} is no longer listening to your offers.` };
  offer = { sal: Math.round(clampF(offer.sal, FIN.minSal, FIN.maxSal)), yrs: clampF(Math.round(offer.yrs), 1, 4) };
  const ask = askFor(save, p, team, offer.yrs), r = offer.sal / ask;
  st.round++; st.last = offer;
  if (r >= 1) return { result: 'accept', offer, msg: 'Deal! ' + p.last + ' accepts.' };
  if (r < 0.78) { st.pat -= 2; if (st.pat <= 0) { st.walked = true; return { result: 'walk', msg: `That was insulting. ${p.last} ends the talks.` }; } return { result: 'reject', ask, msg: `"Not even close." He wants about ${fmtM(ask)} a season.`, pat: st.pat }; }
  st.pat -= 1;
  if (st.pat <= 0) { st.walked = true; return { result: 'walk', msg: `${p.last} has run out of patience and walks away.` }; }
  // counter: meet partway, a little lower each round
  const counter = Math.round((ask - (ask - offer.sal) * (0.18 + 0.08 * st.round)) / 10) * 10;
  return { result: 'counter', counter: { sal: Math.max(counter, offer.sal + 10), yrs: offer.yrs }, msg: `He counters at ${fmtM(Math.max(counter, offer.sal + 10))} for ${offer.yrs} year${offer.yrs > 1 ? 's' : ''}.`, pat: st.pat };
}
// the GM's advice for a player and an offer
function gmAdvice(save, p, team, offer) {
  const w = worth(p), ask = askFor(save, p, team, offer.yrs), lik = acceptLikelihood(save, p, team, offer);
  const payAfter = payroll(save, team) - (p.teamId === team.id ? salOf(p) : 0) + offer.sal;
  const tax = capTax(payAfter), fin = finOf(team);
  const motives = topPrefs(p).map(k => PREF_KEYS[k]);
  const role = projectedRole(save, team, p);
  const lines = [];
  lines.push(`Fair market value: ${fmtM(w)} / season. He's asking about ${fmtM(ask)} for ${offer.yrs} yr${offer.yrs > 1 ? 's' : ''}.`);
  lines.push(`Motivated by ${motives.join(' and ').toLowerCase()}. He'd be your ${role.label.toLowerCase()}.`);
  { const m = motiveInfo(p); lines.push(`${m.name}: ${m.desc}` + (p.teamId === team.id ? ` Mood ${moodOf(save, p).v}/100 (${moodOf(save, p).why}).` : '')); }
  const li = loyaltyInfo(save, p, team); if (li.pct) lines.push(loyaltyLine(li) + ' A player of his level from outside would cost about ' + fmtM(Math.round(ask / (1 - li.pct) / 10) * 10) + '.');
  lines.push(`This offer: ${Math.round(lik * 100)}% chance he accepts outright.`);
  lines.push(`Payroll after signing: ${fmtM(payAfter)} (${payAfter > FIN.cap ? fmtM(payAfter - FIN.cap) + ' over' : fmtM(FIN.cap - payAfter) + ' under'} the ${fmtM(FIN.cap)} soft cap)` + (tax ? `, projected cap penalty ${fmtM(tax)} this season.` : '.'));
  if (offer.sal > w * 1.25) lines.push('Warning: that is well above his market value.');
  if (fin.cash < offer.sal) lines.push(`Cash on hand is ${fmtM(fin.cash)}: watch your budget.`);
  return { w, ask, lik, payAfter, tax, lines };
}

// ---------- contracts
function setContract(save, p, team, sal, yrs, kind) {
  p.contract = { sal: Math.round(sal / 10) * 10, yrs: clampF(yrs, 1, 4), len: clampF(yrs, 1, 4), s: save.seasonNum, team: team ? team.id : null, kind: kind || 'standard' };
}
function rookieContract(save, p, team) { setContract(save, p, team, clampF(worth(p) * 0.6, 350, 900), FIN.rookieYrs, 'rookie'); }
function ensureContract(save, p, team, kind) {
  if (p.contract && p.contract.team === team.id && p.contract.yrs > 0) return;
  if (kind === 'rookie') return rookieContract(save, p, team);
  if (kind === 'depth') return setContract(save, p, team, Math.max(FIN.minSal, Math.round(worth(p) * 0.8)), 1, 'depth');
  setContract(save, p, team, worth(p) * (0.85 + Math.random() * 0.3), 1 + Math.floor(Math.random() * 4), kind || 'standard');
}
// every rostered player without a valid contract gets one (new leagues, migrated saves)
function initContracts(save) {
  setLeagueAdj(save);
  for (const id of save.teamOrder) {
    const t = save.teams[id]; let fresh = false;
    for (const pid of orgIds(t)) { const p = P(save, pid); if (!(p.contract && p.contract.team === t.id && p.contract.yrs > 0)) { ensureContract(save, p, t); fresh = true; } }
    // a brand-new league starts every club under the cap (the inaugural contracts are scaled to fit)
    const pay = payroll(save, t);
    if (fresh && pay > FIN.cap * 0.95) { const k = FIN.cap * 0.95 / pay; for (const pid of orgIds(t)) { const c = P(save, pid).contract; if (c) c.sal = Math.max(FIN.minSal, Math.round(c.sal * k / 10) * 10); } }
  }
  for (const id of save.teamOrder) { const t = save.teams[id]; const f = finOf(t); if (f.cash == null) f.cash = FIN.startCash; }
}

// ---------- finances: ledger per team per season
function finOf(team) {
  if (!team.fin) team.fin = { cash: FIN.startCash, pop: 50 + Math.round(((hashF(team.id, 'pop')) - 0.5) * 20), cur: {}, hist: [], att: 0, purchases: [] };
  if (!team.fin.cur) team.fin.cur = {};
  return team.fin;
}
const REV_KEYS = { gate: 'Ticket sales', tv: 'TV & league share', spons: 'Sponsorship', merch: 'Merchandise', tour: 'Tournament fees & prizes', po: 'Playoff revenue & prizes', deals: 'Sponsor deals' };
const EXP_KEYS = { salary: 'Player salaries', bonus: 'Player bonuses', coaches: 'Coaching staff', ops: 'Operating costs', capPen: 'Salary-cap penalty', buy: 'Purchases & customization' };
function ledger(team, key, amt) { const f = finOf(team); f.cur[key] = Math.round((f.cur[key] || 0) + amt); f.cash = Math.round(f.cash + (EXP_KEYS[key] ? -amt : amt)); }
const popMul = team => 0.6 + finOf(team).pop / 125;            // 50 = 1.0x, 100 = 1.4x
function attendance(save, team, mult = 1) {
  const st = save.season.standings[team.id] || { w: 0, gp: 0 }, wp = st.gp ? st.w / st.gp : 0.5;
  return Math.round(FIN.capacity * clampF(0.48 + finOf(team).pop * 0.0045 + (wp - 0.5) * 0.35 + (mult - 1) * 0.25, 0.35, 1));
}
// one game's money: gate + merch for the home team; league share, sponsors, salaries and operations accrue per regular-season game
function financeGame(save, g, res) {
  const home = save.teams[g.home], away = save.teams[g.away];
  if (!home || !away) return;
  const mult = g.type === 'po' ? 1.6 : g.type === 'tour' ? 1.25 : 1;
  const att = attendance(save, home, mult + (typeof hypeGate === 'function' ? hypeGate(save, g) : 0)); finOf(home).att = att;
  ledger(home, g.type === 'po' ? 'po' : g.type === 'tour' ? 'tour' : 'gate', att * FIN.ticket * mult);
  ledger(home, 'merch', FIN.merchBase / FIN.regGames * 0.5 * popMul(home) * mult);
  if (g.type === 'reg') for (const t of [home, away]) {
    ledger(t, 'tv', FIN.tv / FIN.regGames); ledger(t, 'spons', FIN.sponsBase / FIN.regGames * popMul(t)); ledger(t, 'merch', FIN.merchBase / FIN.regGames * 0.5 * popMul(t));
    ledger(t, 'salary', payroll(save, t) / FIN.regGames); ledger(t, 'ops', FIN.ops / FIN.regGames);
    if (typeof deadTick === 'function') deadTick(t);
  }
  // popularity follows results
  const hw = res.hs > res.as;
  for (const [t, won] of [[home, hw], [away, !hw]]) { const f = finOf(t); f.pop = clampF(f.pop + (won ? 0.45 : -0.3) * (g.type === 'reg' ? 1 : 1.6), 5, 100); }
  if (typeof dealsPay === 'function') dealsPay(save, g, res);
  if (typeof devPay === 'function') devPay(save, g);
}
// competition money: entry fees, prizes, playoff rounds, the championship
function financeComp(save, c) {
  if (c.finDone) return; c.finDone = true;
  if (c.key === 'po') {
    for (const r of c.rounds) for (const sr of r) if (sr.winner) { ledger(save.teams[sr.winner], 'po', FIN.poRound); if (sr.winner === save.userTeamId) save.poSeriesWon = (save.poSeriesWon || 0) + 1; }
    if (c.champion) { ledger(save.teams[c.champion], 'po', FIN.champ); finOf(save.teams[c.champion]).pop = clampF(finOf(save.teams[c.champion]).pop + 10, 5, 100); }
    for (const id of c.seeds) finOf(save.teams[id]).pop = clampF(finOf(save.teams[id]).pop + 3, 5, 100);
    return;
  }
  for (const id of (c.field || c.seeds)) ledger(save.teams[id], 'tour', FIN.tourEntry);
  if (c.champion) { ledger(save.teams[c.champion], 'tour', FIN.tourWin[c.key] || 600); finOf(save.teams[c.champion]).pop = clampF(finOf(save.teams[c.champion]).pop + 3, 5, 100); }
}
// season close: cap penalty, archive the ledger, carry the cash forward, popularity drifts to the middle
function closeFinances(save) {
  const out = {};
  for (const id of save.teamOrder) {
    const t = save.teams[id], f = finOf(t), pay = payroll(save, t), tax = capTax(pay);
    if (tax) ledger(t, 'capPen', tax);
    const rev = Object.keys(REV_KEYS).reduce((a, k) => a + (f.cur[k] || 0), 0), exp = Object.keys(EXP_KEYS).reduce((a, k) => a + (f.cur[k] || 0), 0);
    const start = f.cash - rev + exp;
    const rec = { s: save.season.num, start: Math.round(start), rev: Math.round(rev), exp: Math.round(exp), end: f.cash, pay, tax, pop: Math.round(f.pop), att: f.att, cur: f.cur };
    f.hist.push(rec); if (f.hist.length > 40) f.hist.shift();
    // AI clubs reinvest a share of a big bank balance (facilities, scouting, arena upgrades)
    if (id !== save.userTeamId && f.cash > 15000) ledger(t, 'buy', Math.round((f.cash - 15000) * 0.35));
    out[id] = rec;
    f.cur = {}; f.pop = f.pop + (50 - f.pop) * 0.12;
  }
  return out;
}
function finAssessment(rec) {
  if (!rec) return '';
  const net = rec.end - rec.start;
  const parts = [net >= 0 ? `A profit of ${fmtM(net)}.` : `A loss of ${fmtM(-net)}.`];
  if (rec.tax) parts.push(`The cap penalty cost ${fmtM(rec.tax)}: trimming payroll under ${fmtM(FIN.cap)} saves that money.`);
  if (rec.pop >= 70) parts.push('Fans are buzzing: attendance and sponsors are strong.'); else if (rec.pop < 35) parts.push('Fan interest is low: winning (and playoff runs) bring them back.');
  if (rec.end < 0) parts.push('The club is in the red: avoid expensive signings until cash recovers.');
  return parts.join(' ');
}
function finRecommendations(save, team) {
  const f = finOf(team), pay = payroll(save, team), tips = [];
  if (pay > FIN.cap) tips.push(`You are ${fmtM(pay - FIN.cap)} over the soft cap: projected penalty ${fmtM(capTax(pay))} at season end. Trade or let an expensive contract expire.`);
  else tips.push(`Cap room: ${fmtM(FIN.cap - pay)} under the soft cap.`);
  if (f.cash < 0) tips.push('Cash is negative: hold off on purchases and big contracts.');
  const exp = orgIds(team).map(id => P(save, id)).filter(p => p.contract && p.contract.yrs <= 1);
  if (exp.length) tips.push(`${exp.length} contract${exp.length > 1 ? 's' : ''} expire after this season: plan renewals.`);
  const over = orgIds(team).map(id => P(save, id)).filter(p => p.contract && p.contract.sal > worth(p) * 1.4 && p.contract.yrs >= 2);
  if (over.length) tips.push(`Overpaid: ${over.slice(0, 2).map(p => p.last).join(', ')} (contract well above current value).`);
  if (f.pop < 40) tips.push('Popularity is low: a winning streak or a tournament run will lift attendance.');
  return tips;
}
// a purchase: allowed only with the money in the bank
function spend(save, team, amt, what) {
  const f = finOf(team);
  if (f.cash < amt) return `Not enough funds: ${what} costs ${fmtM(amt)}, you have ${fmtM(f.cash)}.`;
  ledger(team, 'buy', amt); f.purchases.push({ s: save.seasonNum, what, amt }); if (f.purchases.length > 200) f.purchases.shift();
  return null;
}

// ====================================================================
//  OFFSEASON: 1 review → 2 renewals → 3 free agency & trades → 4 rookie draft → 5 roster finalization → new season
// ====================================================================
const OFF_PHASES = ['review', 'renew', 'fa', 'draft', 'final'];
const OFF_NAMES = { review: 'Season review', renew: 'Contract renewals', fa: 'Free agency & trades', draft: 'Rookie draft', final: 'Roster finalization' };
const signedFor = (save, p) => p.contract && p.contract.s > save.season.num;   // signed this offseason for next season
function startOffseason(save) {
  setLeagueAdj(save);
  const off = save.off = { phase: 'review', day: 0, expiring: {}, offers: {}, sought: [], s: save.season.num, log: [] };
  save.neg = {};
  for (const id of save.teamOrder) {
    const t = save.teams[id]; off.expiring[id] = [];
    for (const pid of orgIds(t)) {
      const p = P(save, pid);
      if (!p.contract) ensureContract(save, p, t);
      if (signedFor(save, p)) continue;
      p.contract.yrs--;
      if (p.contract.yrs <= 0) {
        if (p.contract.ext) { const e = p.contract.ext; setContract(save, p, t, e.sal, e.yrs, 'extension'); p.contract.s = save.season.num + 1; logTx(save, 'renew', { pid, teamId: id }); }
        else off.expiring[id].push(pid);
      }
    }
  }
  // AI clubs decide on their own expiring players right away, and shed salary when far over the cap
  for (const id of save.teamOrder) if (id !== save.userTeamId) { aiRenewals(save, save.teams[id]); aiCapDiscipline(save, save.teams[id]); }
}
function aiCapDiscipline(save, t) {
  for (let k = 0; k < 2 && payroll(save, t) > FIN.cap + 400; k++) {
    const cands = orgIds(t).map(id => P(save, id)).filter(p => p.contract && !signedFor(save, p) && !(save.off.expiring[t.id] || []).includes(p.id))
      .filter(p => p.pos === 'G' ? rosterGoalies(t).length > 2 : rosterSkaters(t).length > 10)
      .sort((a, b) => worth(a) / salOf(a) - worth(b) / salOf(b));
    const p = cands[0]; if (!p || worth(p) / salOf(p) > 0.95) break;
    releaseToFA(save, p, 'release');
  }
}
function aiRenewals(save, t) {
  const exp = save.off.expiring[t.id] || [];
  const sk = rosterSkaters(t).map(id => P(save, id)), med = sk.map(overall).sort((a, b) => a - b)[Math.floor(sk.length / 2)] || 5;
  for (const pid of exp.slice()) {
    const p = P(save, pid), yrs = prefYears(p), ask = askFor(save, p, t, yrs);
    const valued = (p.pos === 'G' ? overall(p) >= 4.5 : overall(p) >= med - 0.3) && p.age <= 34;
    const fits = payroll(save, t) - salOf(p) + ask <= FIN.cap + 300;
    if (valued && fits && ask <= worth(p) * 1.25) { signFor(save, p, t, ask, yrs, 'renew'); exp.splice(exp.indexOf(pid), 1); }
  }
}
// sign (or re-sign) for next season
function signFor(save, p, t, sal, yrs, kind) {
  const inSeasonFA = !save.off && p.status === 'free';
  if (p.teamId !== t.id) {
    if (p.teamId) removeFromRoster(save.teams[p.teamId], p.id);
    p.status = 'active'; p.freeSince = null; p.teamId = null;
    if (!joinOrg(save, t, p.id)) placeAnywhere(save, t, p.id); p.joined = p.joined || save.seasonNum;
    if (!p.num || numberTaken(save, t, p.num, p.id)) p.num = freeNumber(save, t, p.num);
  }
  setContract(save, p, t, sal, yrs, kind === 'renew' ? 'standard' : kind);
  if (save.off) p.contract.s = save.season.num + 1;
  else if (inSeasonFA) p.contract.s = save.season.num;
  logTx(save, kind === 'renew' ? 'renew' : 'fa', { pid: p.id, teamId: t.id, sal: p.contract.sal, yrs: p.contract.yrs });
  if (save.off && save.off.offers) delete save.off.offers[p.id];
}
function releaseToFA(save, p, why) {
  const t = p.teamId && save.teams[p.teamId];
  if (t) removeFromRoster(t, p.id);
  p.lastTeamId = p.teamId || p.lastTeamId; p.teamId = null; p.status = 'free'; p.freeSince = save.seasonNum; p.contract = null;
  logTx(save, why || 'expire', { pid: p.id, teamId: p.lastTeamId });
}
const freeAgents = save => Object.values(save.players).filter(p => p.status === 'free');
function isSought(save, p) { return !!(save.off && save.off.sought && save.off.sought.includes(p.id)); }
function advanceOffseason(save) {
  const off = save.off; if (!off) return null;
  const user = save.teams[save.userTeamId];
  if (off.phase === 'review') off.phase = 'renew';
  else if (off.phase === 'renew') {
    for (const id of save.teamOrder) for (const pid of (off.expiring[id] || [])) { const p = P(save, pid); if (p.teamId === id && !signedFor(save, p)) releaseToFA(save, p, 'expire'); }
    off.expiring = {};
    const fas = freeAgents(save).filter(p => p.age <= 34).sort((a, b) => worth(b) - worth(a));
    off.sought = fas.slice(0, Math.max(3, Math.round(fas.length * FIN.soughtTop))).filter(p => worth(p) >= 1000).map(p => p.id);
    off.phase = 'fa'; off.day = 0; off.offers = {};
    aiFreeAgencyDay(save);
  } else if (off.phase === 'fa') {
    while (off.day < FIN.faDays) faNextDay(save);
    resolveSought(save, true);
    for (const id of save.teamOrder) if (id !== save.userTeamId) { fillRoster(save, save.teams[id]); autoArrange(save, save.teams[id]); }
    off.phase = 'draft';
  } else if (off.phase === 'draft') { if (save.draft && save.draft.v === 2 && !save.draft.done) rdAutoAll(save); off.phase = 'final'; }
  else if (off.phase === 'final') { startNextSeason(save); return 'start'; }
  return off.phase;
}
// one day of free agency: AI clubs sign ordinary free agents and bid on the sought-after ones; then decisions
function faNextDay(save) {
  const off = save.off; if (!off || off.phase !== 'fa' || off.day >= FIN.faDays) return;
  off.day++;
  aiFreeAgencyDay(save);
  if (off.day >= FIN.faDays) resolveSought(save, true);
  if (typeof marketTick === 'function') marketTick(save);
}
function aiFreeAgencyDay(save, includeUser) {
  const off = save.off;
  const ids = save.teamOrder.filter(id => includeUser || id !== save.userTeamId).sort(() => Math.random() - 0.5);
  for (const id of ids) {
    const t = save.teams[id], room = FIN.cap + 600 - payroll(save, t);
    const needS = 12 - rosterSkaters(t).length, needG = 3 - rosterGoalies(t).length;
    const fas = freeAgents(save).filter(p => p.age <= 35);
    // bid on one sought-after player if there is cap room and a real upgrade
    const sk = rosterSkaters(t).map(x => P(save, x)), worst = sk.sort((a, b) => overall(a) - overall(b))[0];
    for (const p of fas.filter(p => isSought(save, p)).sort((a, b) => worth(b) - worth(a))) {
      if ((off.offers[p.id] || []).some(o => o.teamId === id)) continue;
      const yrs = prefYears(p), ask = askFor(save, p, t, yrs);
      const upgrade = p.pos === 'G' ? needG > 0 || overall(p) > overall(P(save, rosterGoalies(t)[0] || p.id)) : !worst || overall(p) > overall(worst) + 1;
      if (upgrade && ask <= room + (needS + needG ? 0 : salOf(worst || {})) && Math.random() < 0.55) { (off.offers[p.id] = off.offers[p.id] || []).push({ teamId: id, sal: Math.round(ask * (0.96 + Math.random() * 0.12) / 10) * 10, yrs }); break; }
    }
    // fill holes with ordinary free agents (they answer right away)
    for (const pos of ['G', 'S']) {
      let need = pos === 'G' ? needG : needS;
      while (need > 0) {
        const room2 = FIN.cap + 600 - payroll(save, t);
        const c = fas.filter(p => p.pos === pos && p.status === 'free' && !isSought(save, p)).map(p => ({ p, ask: askFor(save, p, t, prefYears(p)) })).filter(x => x.ask <= Math.max(room2, FIN.minSal + 200)).sort((a, b) => overall(b.p) - overall(a.p))[0];
        if (!c) break;
        signFor(save, c.p, t, c.ask, prefYears(c.p), 'fa'); need--;
      }
    }
  }
}
// sought-after free agents compare every offer (yours included) and pick the best fit
function resolveSought(save, final) {
  const off = save.off; if (!off) return;
  for (const pid of off.sought.slice()) {
    const p = P(save, pid); if (!p || p.status !== 'free') continue;
    const offers = (off.offers[pid] || []).filter(o => save.teams[o.teamId]);
    if (!offers.length) { if (final) off.sought.splice(off.sought.indexOf(pid), 1); continue; }
    if (!final) continue;
    const sc = o => o.sal / askFor(save, p, save.teams[o.teamId], o.yrs) + (o.user ? 0.001 : 0);
    const rank = motiveOf(p) === 'money' ? (o => o.sal + (o.user ? 0.1 : 0)) : sc;                  // a mercenary simply takes the highest offer
    // the best offer from a club that still has room for him
    const best = offers.slice().sort((a, b) => rank(b) - rank(a)).find(o => sc(o) >= 0.97 && (o.teamId === save.userTeamId ? !orgFull(save.teams[o.teamId], p.pos) : !rosterFull(save.teams[o.teamId], p.pos)));
    const t = best && save.teams[best.teamId];
    if (best) {
      signFor(save, p, t, best.sal, best.yrs, 'fa');
      if (best.teamId === save.userTeamId) pushNews(save, `${p.first} ${p.last} chose your club! Signed: ${fmtM(best.sal)} x ${best.yrs}.`);
      else if (offers.some(o => o.user)) pushNews(save, `${p.first} ${p.last} signed with the ${t.nick} instead (${fmtM(best.sal)} x ${best.yrs}).`);
    }
    off.sought.splice(off.sought.indexOf(pid), 1);
  }
}
// your offer to a free agent: ordinary ones answer at once, sought-after ones take it into consideration
function offerFreeAgent(save, p, offer) {
  const user = save.teams[save.userTeamId];
  if (p.status !== 'free') return { result: 'reject', msg: 'He is no longer a free agent.' };
  if (orgFull(user, p.pos)) return { result: 'reject', msg: `Your roster is full at ${p.pos === 'G' ? 'keeper (3)' : 'player (12)'} and so is your farm team (${FARM.size}): release or trade someone first.` };
  const r = evalOffer(save, p, user, offer);
  if (save.off && save.off.phase === 'fa' && isSought(save, p) && (r.result === 'accept' || r.result === 'counter')) {
    if (r.result === 'accept') {
      const list = save.off.offers[p.id] = (save.off.offers[p.id] || []).filter(o => !o.user);
      list.push({ teamId: user.id, sal: r.offer.sal, yrs: r.offer.yrs, user: true });
      return { result: 'pending', msg: `${p.last} likes it. He is comparing offers from ${list.length - 1} other club${list.length === 2 ? '' : 's'} and decides after day ${FIN.faDays}. You can still improve your offer.` };
    }
    return r;
  }
  if (r.result === 'accept') { signFor(save, p, user, r.offer.sal, r.offer.yrs, 'fa'); }
  return r;
}
// your own player's renewal (offseason) or extension (final contract year, in season)
function offerRenewal(save, p, offer) {
  const user = save.teams[save.userTeamId];
  const r = evalOffer(save, p, user, offer);
  if (r.result !== 'accept') return r;
  if (save.off && save.off.phase === 'renew') { signFor(save, p, user, r.offer.sal, r.offer.yrs, 'renew'); const e = save.off.expiring[user.id]; if (e && e.includes(p.id)) e.splice(e.indexOf(p.id), 1); }
  else { p.contract.ext = { sal: r.offer.sal, yrs: r.offer.yrs }; logTx(save, 'extend', { pid: p.id, teamId: user.id }); }
  return r;
}
const canExtend = (save, p) => !save.off && p.contract && p.contract.yrs <= 1 && !p.contract.ext && p.status === 'active';

// ====================================================================
//  TRADES (no draft picks): value, validation, AI answers with reasons, counteroffers, AI proposals
// ====================================================================
function posNeed(save, team, p) {
  if (p.pos === 'G') { const gs = rosterGoalies(team).map(id => P(save, id)); return gs.length < 2 || gs.every(g => overall(g) < overall(p) - 0.5) ? 1 : 0; }
  // 3-on-3: a club wants a skater for every line on each side (three a side, four for the middle); a line without a
  // stay-at-home D counts as a gap too
  const c = { L: 0, C: 0, R: 0, D: 0 }; for (const id of rosterSkaters(team)) { const q = P(save, id); c[sideOf(q.spos)]++; if (isDefPos(q.spos)) c.D++; }
  return c[sideOf(p.spos)] < 3 || (isDefPos(p.spos) && c.D < 3) ? 1 : 0;
}
function tradeValue(save, p, team) {
  const w = worth(p), sal = salOf(p), yrs = p.contract ? Math.max(1, p.contract.yrs) : 1;
  let v = w + (w - sal) * Math.min(yrs, 3) * 0.35;
  if (p.age <= 24) v += Math.max(0, potE(p) - overall(p)) * 140;
  if (p.age >= 33) v *= 0.85;
  if (team) v *= 1 + posNeed(save, team, p) * 0.12;
  if (p.inj && p.inj.g > 0) v *= 0.9;
  return Math.max(50, v);
}
const tradeOpen = save => !!save.off ? save.off.phase === 'fa' : !!(save.season && !save.season.done && (currentDay(save).key || '').startsWith('r'));
function rosterAfter(save, team, out, inn) {
  const ids = rosterIds(team).concat(farmIds(team)).filter(id => !out.includes(id)).concat(inn);
  const S = ids.filter(id => P(save, id).pos !== 'G').length, G = ids.filter(id => P(save, id).pos === 'G').length;
  // the main roster holds 12 skaters and 3 goalies; anyone beyond that goes to the farm team (6 spots)
  const over = Math.max(0, S - 12) + Math.max(0, G - 3);
  return { S, G, over, farmOK: over <= FARM.size, pay: ids.concat(irIds(team)).reduce((a, id) => a + salOf(P(save, id)), 0) + (typeof deadCapNow === 'function' ? deadCapNow(team) : 0) };
}
// the AI club's verdict on: it gives `give` (its players) and receives `get` (yours)
function evalTrade(save, aiTeam, give, get, pk) {
  const user = save.teams[save.userTeamId], reasons = [];
  pk = pk || { give: [], get: [] };   // picks: give = the AI club's picks to you, get = yours to them
  if (!tradeOpen(save)) return { ok: false, verdict: 'closed', reasons: ['Trading is closed right now (the deadline is the start of the playoffs; it reopens in free agency).'] };
  if (!give.length && !get.length && !pk.give.length && !pk.get.length) return { ok: false, verdict: 'empty', reasons: ['Add players or picks to both sides.'] };
  const ra = rosterAfter(save, aiTeam, give, get), ru = rosterAfter(save, user, get, give);
  if (!ra.farmOK) reasons.push(`${aiTeam.nick} would have no room for everyone, even with their farm team (${ra.over} extra, ${FARM.size} farm spots).`);
  if (!ru.farmOK) reasons.push(`You would have no room for everyone, even with your farm team (${ru.over} extra, ${FARM.size} farm spots): release someone first.`);
  if (ra.S < 9 || ra.G < 2 || ru.S < 9 || ru.G < 2) reasons.push('Both clubs need at least 9 players and 2 keepers after the trade.');
  if (reasons.length) return { ok: false, verdict: 'invalid', reasons };
  const pvIn = pk.get.reduce((a, k) => a + pickTradeValue(save, aiTeam, k), 0), pvOut = pk.give.reduce((a, k) => a + pickTradeValue(save, aiTeam, k), 0);
  const vin = get.reduce((a, id) => a + tradeValue(save, P(save, id), aiTeam), 0) + pvIn, vout = give.reduce((a, id) => a + tradeValue(save, P(save, id), aiTeam), 0) + pvOut;
  const ratio = vout ? vin / vout : 9;
  const payNow = payroll(save, aiTeam), capHit = ra.pay > FIN.cap + 800 && ra.pay > payNow;
  // explain
  const fmtV = v => Math.round(v / 100) / 10;
  reasons.push(`Value to ${aiTeam.nick}: receiving ${fmtV(vin)} vs giving ${fmtV(vout)} (${Math.round(ratio * 100)}%).`);
  for (const id of get) { const p = P(save, id);
    if (p.age >= 33) reasons.push(`${p.last} is ${p.age}: his best years are behind him.`);
    if (p.contract && p.contract.sal > worth(p) * 1.25) reasons.push(`${p.last}'s contract (${fmtM(p.contract.sal)}) is expensive for his ability.`);
    if (posNeed(save, aiTeam, p)) reasons.push(`They need a ${p.pos === 'G' ? 'keeper' : SIDE_NAMES[sideOf(p.spos)].toLowerCase() + ' side player'}: ${p.last} fills it.`);
    if (p.age <= 23 && potE(p) - overall(p) >= 2) reasons.push(`${p.last} has real upside (potential ${potTxt(p)}).`);
  }
  if (pvIn) reasons.push(`They count your pick${pk.get.length > 1 ? 's' : ''} as ${fmtV(pvIn)}${(aiTeam.ai || {}).strat === 'youth' || gmOf(save, aiTeam) === 'youth' ? ' (rebuilding: they love picks)' : (aiTeam.ai || {}).strat === 'contend' ? ' (contending: they want players now)' : ''}.`);
  if (pvOut) reasons.push(`They count their pick${pk.give.length > 1 ? 's' : ''} as ${fmtV(pvOut)}.`);
  for (const id of give) { const p = P(save, id); if (overall(p) >= 7) reasons.push(`${p.last} is one of their key players.`); if (leaderOf(aiTeam, id) === 'C') reasons.push(`${p.last} is their captain.`); }
  if (capHit) reasons.push(`It would push them to ${fmtM(ra.pay)}, over the ${fmtM(FIN.cap)} soft cap.`);
  const ok = ratio >= FIN.tradeMargin && !capHit;
  let counter = null;
  if (!ok && ratio >= 0.72 && !capHit) {
    // ask for one more of your players (the smallest that closes the gap), or drop one of theirs
    const need = vout * FIN.tradeMargin - vin;
    const extra = rosterIds(user).filter(id => !get.includes(id)).map(id => ({ id, v: tradeValue(save, P(save, id), aiTeam) })).filter(x => x.v >= need)
      .filter(x => { const r1 = rosterAfter(save, aiTeam, give, get.concat([x.id])), r2 = rosterAfter(save, user, get.concat([x.id]), give); return r1.S <= 12 && r1.G <= 3 && r2.S >= 9 && r2.G >= 2 && r1.pay <= FIN.cap + 1200; })
      .sort((a, b) => a.v - b.v)[0];
    if (extra) counter = { give: give.slice(), get: get.concat([extra.id]), pk, msg: `They'd do it if you add ${P(save, extra.id).first} ${P(save, extra.id).last}.` };
    else if (give.length > 1) { const drop = give.map(id => ({ id, v: tradeValue(save, P(save, id), aiTeam) })).sort((a, b) => b.v - a.v)[0]; const g2 = give.filter(x => x !== drop.id); counter = { give: g2, get: get.slice(), pk, msg: `They'd do it without ${P(save, drop.id).last}.` }; }
  }
  return { ok, verdict: ok ? 'accept' : counter ? 'counter' : 'reject', ratio, reasons, counter, vin, vout, payAfterUser: ru.pay, payAfterAI: ra.pay };
}
function executeTrade(save, aiTeam, give, get, pk) {
  const user = save.teams[save.userTeamId];
  pk = pk || { give: [], get: [] };
  const plab = ks => ks.map(k => pickLabelK(save, k));
  const pIn = plab(pk.give), pOut = plab(pk.get);
  for (const k of pk.give) movePick(save, k, user.id);
  for (const k of pk.get) movePick(save, k, aiTeam.id);
  // everyone leaves first, THEN everyone arrives: a straight swap at a full position (a goalie for a goalie with three
  // goalies each) used to find the slot still taken, and the incoming player fell off both rosters
  const out = give.map(pid => [pid, aiTeam, user]).concat(get.map(pid => [pid, user, aiTeam]));
  for (const [pid, from] of out) { removeFromRoster(from, pid); P(save, pid).teamId = null; }
  for (const [pid, from, to] of out) {
    const p = P(save, pid);
    const where = joinOrg(save, to, pid) || (placeAnywhere(save, to, pid) ? 'roster' : null);
    if (where === 'farm' && to.id === save.userTeamId) pushNews(save, `${p.first} ${p.last} joins your farm team (the main roster is full at ${p.pos === 'G' ? 'keeper' : 'outfield player'}). Call him up from ROSTER > FARM & IR.`);
    if (!p.num || numberTaken(save, to, p.num, pid)) p.num = freeNumber(save, to, p.num);
    if (p.contract) p.contract.team = to.id;
    p.block = false;
    logTx(save, 'trade', { pid, teamId: to.id, from: from.id });
  }
  for (const t of [user, aiTeam]) { fillLinesFromReserves(t.roster); compactGoalies(t.roster); autoLeaders(save, t, true); }
  if (typeof aiFarmManage === 'function') aiFarmManage(save, aiTeam); else autoArrange(save, aiTeam);
  const nm = ids => ids.map(id => P(save, id).last).join(', ');
  const lst = (a, b) => a.concat(b).join(', ');
  pushNews(save, `TRADE with the ${aiTeam.nick}: you get ${lst(give.length ? [nm(give)] : [], pIn) || 'nothing'}, they get ${lst(get.length ? [nm(get)] : [], pOut) || 'nothing'}.`);
  (save.trades = save.trades || []).push({ s: save.seasonNum, with: aiTeam.id, got: give.slice(), gave: get.slice() });
  if (save.trades.length > 300) save.trades.shift();
  save.tradeOffers = (save.tradeOffers || []).filter(o => !o.give.concat(o.get).some(id => give.includes(id) || get.includes(id)));
}
// now and then an AI club calls with an offer (more often for players on your trade block)
function aiTradeProposal(save, force) {
  if (!tradeOpen(save)) return null;
  save.tradeOffers = (save.tradeOffers || []).filter(o => (save.seasonNum - o.s) === 0 && (o.until == null || o.until > (save.season.calIdx || 0)));
  if (save.tradeOffers.length >= 3 && !force) return null;
  const user = save.teams[save.userTeamId];
  const mine = rosterIds(user).map(id => P(save, id));
  const block = mine.filter(p => p.block);
  if (!force && Math.random() > (block.length ? 0.22 : 0.06)) return null;
  const target = (block.length ? pickR(block) : pickR(mine.filter(p => overall(p) >= 4.5)));
  if (!target) return null;
  const others = save.teamOrder.filter(id => id !== user.id).sort(() => Math.random() - 0.5);
  for (const id of others) {
    const t = save.teams[id];
    const want = tradeValue(save, target, t);
    if (want < 600) continue;
    const pool = rosterIds(t).map(x => P(save, x)).filter(p => p.pos === target.pos || Math.random() < 0.3).sort((a, b) => tradeValue(save, b, t) - tradeValue(save, a, t));
    let give = [], v = 0;
    for (const p of pool) { const pv = tradeValue(save, p, t); if (v + pv <= want / FIN.tradeMargin * 1.02) { give.push(p.id); v += pv; } if (v >= want / FIN.tradeMargin * 0.92 || give.length >= 2) break; }
    if (!give.length) continue;
    const ev = evalTrade(save, t, give, [target.id]);
    if (!ev.ok) continue;
    const o = { id: 'to' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), s: save.seasonNum, teamId: id, give, get: [target.id], until: (save.season.calIdx || 0) + 6,
      msg: `The ${t.nick} want ${target.first} ${target.last}${target.block ? ' (on your trade block)' : ''} and offer ${give.map(x => P(save, x).first + ' ' + P(save, x).last).join(' and ')}.` };
    save.tradeOffers.push(o);
    pushNews(save, 'TRADE OFFER: ' + o.msg);
    return o;
  }
  return null;
}

// ====================================================================
//  TRANSACTIONS: a bounded league feed (save.tx) + a permanent compact history on every player (p.txh)
// ====================================================================
const TX_NAMES = { draft0: 'Inaugural draft pick', alloc: 'Assigned after the inaugural draft', draft: 'Rookie draft pick', trade: 'Traded', fa: 'Signed as a free agent', renew: 'Re-signed',
  extend: 'Contract extension agreed', expire: 'Contract expired (free agent)', release: 'Released', retire: 'Retired', sign: 'Signed (depth)' };
function playerTx(save, p) {
  return (p.txh || []).map(x => ({ s: x[0], kind: x[1], teamId: x[2], from: x[3] || null, extra: x[4] || null }));
}

// automated offseason (simulation runs and tests): your club is handled like an AI club up to the rookie draft
function autoOffseason(save) {
  if (!save.off) return;
  const user = save.teams[save.userTeamId];
  if (save.off.phase === 'review') advanceOffseason(save);
  if (save.off.phase === 'renew') { aiRenewals(save, user); aiCapDiscipline(save, user); advanceOffseason(save); }
  if (save.off.phase === 'fa') { aiFreeAgencyDay(save, true); advanceOffseason(save); fillRoster(save, user); }
}
