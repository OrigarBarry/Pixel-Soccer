'use strict';
// ====================================================================
//  PROGRESSION: trait acquisition, player development, leadership distinctions,
//  achievements, memorabilia (franchise) and cosmetic unlocks (account-wide profile)
// ====================================================================

// ---------- account profile (cosmetics are account-wide; loaded by the UI from Store, never part of a franchise save)
let PROFILE = { cos: {}, ach: {}, v: 1 };
const COSMETICS = {
  banner_wall:    { name: 'Championship Banner Wall', kind: 'cabinet', desc: 'Your trophy room hangs a banner for every league title.' },
  pedestals:      { name: 'Marble Pedestals', kind: 'cabinet', desc: 'Trophies stand on lit marble pedestals.' },
  carpet:         { name: 'Red Carpet Hall', kind: 'cabinet', desc: 'A red-carpet trophy hall.' },
  spotlights:     { name: 'Trophy Spotlights', kind: 'cabinet', desc: 'Spotlights sweep across the cabinet.' },
  jersey_gold:    { name: 'Champion Gold Jersey', kind: 'jersey', style: 'goldsash', desc: 'A gold-sash jersey style for any franchise.' },
  jersey_heritage:{ name: 'Heritage Laces Jersey', kind: 'jersey', style: 'heritage', desc: 'A vintage lace-up jersey style.' },
  gold_trim:      { name: 'Gold Jersey Trim', kind: 'trim', desc: 'Gold trim option for your jerseys.' },
  emblem_laurel:  { name: 'Laurel Emblem', kind: 'emblem', emblem: 'laurel', desc: 'The champions\' laurel crest.' },
  chrome_gear:    { name: 'Chrome Headband', kind: 'gear', desc: 'A mirror-chrome headband for your players.' },
  gold_gear:      { name: 'Gold Gear', kind: 'gear', desc: 'Gold headbands, gloves, boots, shin pads and tape.' },
  star_mask:      { name: 'All-Star Mask', kind: 'gear', desc: 'A star-studded keeper mask.' },
  arena_show:     { name: 'Arena Light Show', kind: 'arena', desc: 'Disco lighting and fireworks for your home arena.' },
  emblem_inv:     { name: 'Invitational Torch Emblem', kind: 'emblem', emblem: 'torch', hint: 'Win the Opening Invitational.', desc: 'The torch of the Opening Invitational.' },
  emblem_classic: { name: 'Winged Ball Emblem', kind: 'emblem', emblem: 'wingpuck', hint: 'Win the Midseason Classic.', desc: 'The winged ball of the Midseason Classic.' },
  emblem_winter:  { name: 'Frost Crown Emblem', kind: 'emblem', emblem: 'frostcrown', hint: 'Win the Winter Cup.', desc: 'The frost crown of the Winter Cup.' },
  emblem_finale:  { name: 'Finale Cup Emblem', kind: 'emblem', emblem: 'cup', hint: 'Win the Season Finale Cup.', desc: 'The trophy of the Season Finale Cup.' },
  emblem_toc:     { name: 'Knight Helm Emblem', kind: 'emblem', emblem: 'knight', hint: 'Win the Tournament of Champions.', desc: 'The helm of the Tournament of Champions.' },
  emblem_po:      { name: 'Champion Ring Emblem', kind: 'emblem', emblem: 'ring', hint: 'Win the League Championship.', desc: 'The ring of a League Champion.' },
  palace_qp:      { name: 'Grand Soccer Palace (Quick Play)', kind: 'arena', desc: 'Play Quick Play games in the Grand Soccer Palace.' },
  gold_visor:     { name: 'Gold Visor', kind: 'gear', desc: 'A mirrored gold visor.' },
  gold_stick:     { name: 'Golden Boot', kind: 'gear', desc: 'A gleaming gold boot.' },
  flame_helmet:   { name: 'Flame Headband Decal', kind: 'gear', desc: 'Hot-rod flames down the sides of the headband.' },
  galaxy_mask:    { name: 'Galaxy Mask', kind: 'gear', desc: 'A deep-space keeper mask full of stars.' },
  jersey_galaxy:  { name: 'Galaxy Jersey', kind: 'jersey', style: 'galaxy', desc: 'A night-sky jersey style that twinkles.' },
  jersey_flames:  { name: 'Flames Jersey', kind: 'jersey', style: 'flames', desc: 'A jersey style with flames licking up from the hem.' },
  emblem_phoenix: { name: 'Phoenix Emblem', kind: 'emblem', emblem: 'phoenix', desc: 'The crest of a team that never stays down.' },
  laststand_mask: { name: 'Last Stand Mask', kind: 'gear', desc: 'Battle-scarred iron, blood-red cracks and gold rivets. For keepers who never break.' },
  jersey_laststand: { name: 'Last Stand Jersey', kind: 'jersey', style: 'laststand', desc: 'Iron grey with a crimson-and-gold shield chevron.' },
  golden_horn:    { name: 'Golden Fanfare', kind: 'presentation', desc: 'A golden trumpet fanfare after your home goals.' },
};
const hasCosmetic = id => !!(PROFILE && PROFILE.cos && PROFILE.cos[id]) || (typeof dbgUnlockAll === 'function' && dbgUnlockAll());
function grantCosmetic(save, id, from) {
  if (!COSMETICS[id]) return false;
  if (save && save.debug && save.debug.modified) return false;           // debug-modified franchises never unlock account cosmetics
  if (save && save.dream) return false;                                  // Dream Team records stay in their own save
  if (PROFILE.cos[id]) return false;
  PROFILE.cos[id] = { at: Date.now(), from: from || '', save: save ? save.name : '' };
  PROFILE.dirty = true;
  return true;
}
// importing / loading a franchise re-grants the cosmetics it legitimately earned (never removes any)
function syncProfileFromSave(save) {
  let n = 0;
  if (save.dream) return 0;                                                // Dream Team saves never feed the account
  if ((save.history || []).length >= 10 && !(save.debug && save.debug.modified) && COSMETICS.dream_team && !PROFILE.cos.dream_team) { PROFILE.cos.dream_team = { at: Date.now(), from: 'Dynasty', save: save.name }; PROFILE.dirty = true; n++; }
  for (const [id, a] of Object.entries(save.ach || {})) {
    const def = ACH_BY_ID[id]; if (!a.done || a.test || !def || !def.reward || !def.reward.cosmetic) continue;
    if (!PROFILE.cos[def.reward.cosmetic]) { PROFILE.cos[def.reward.cosmetic] = { at: a.at || Date.now(), from: def.name, save: save.name }; PROFILE.dirty = true; n++; }
  }
  if (!(save.debug && save.debug.modified)) for (const tr of save.trophies || []) {                 // tournament emblems from titles already won
    const id = 'emblem_' + tr.comp; if (tr.teamId === save.userTeamId && COSMETICS[id] && !PROFILE.cos[id]) { PROFILE.cos[id] = { at: Date.now(), from: tr.compName, save: save.name }; PROFILE.dirty = true; n++; }
  }
  const ut = save.teams && save.teams[save.userTeamId];                    // a franchise that built the Palace unlocks it for Quick Play
  if (ut && (ut.arenaOwned || []).includes('venue:palace') && !PROFILE.cos.palace_qp && !(save.debug && save.debug.modified)) { PROFILE.cos.palace_qp = { at: Date.now(), from: 'Built the Grand Soccer Palace', save: save.name }; PROFILE.dirty = true; n++; }
  return n;
}

// ---------- notices shown by the UI (trait gains, legacy items, achievements, distinctions)
function notify(save, n) { (save.notices = save.notices || []).push(Object.assign({ at: Date.now() }, n)); if (save.notices.length > 40) save.notices.shift(); }

// ---------- traits gained through play (rare), development (offseason) and distinctions
function tryGainTrait(save, pl, pool, chance, why, rng = Math.random) {
  if (!pl || (pl.traits || []).length >= BAL.trait.max) return null;
  pool = pool.filter(id => canAddTrait(pl, id));
  if (!pool.length || rng() >= chance) return null;
  const id = weightedPick(pool, x => (TRAITS[x].rarity === 3 ? 1 : TRAITS[x].rarity === 2 ? 2 : 3), rng);
  pl.traits.push(id);
  (pl.traitLog = pl.traitLog || []).push({ s: save.season ? save.season.num : save.seasonNum, id, why });
  if (pl.traitLog.length > 8) pl.traitLog.shift();
  if (pl.teamId === save.userTeamId || pl.fav) {
    pushNews(save, `${pl.first} ${pl.last} developed a new trait: ${TRAITS[id].name} (${why}).`);
    notify(save, { kind: 'trait', pid: pl.id, trait: id, why });
  }
  return id;
}
const xpBoost = (pl, key) => { pl.xp = pl.xp || {}; pl.xp[key] = (pl.xp[key] || 0) + 1; return 1 + Math.min(4, pl.xp[key] - 1) * 0.5; };
function postgameTraits(save, g, res) {
  const winT = res.hs > res.as ? g.home : g.away;
  for (const l of res.stats) {
    const pl = P(save, l.pid); if (!pl || !(l.gp || l.toi)) continue;
    const E = BAL.trait.event;
    if (l.s1 || l.s2 || l.s3) tryGainTrait(save, pl, Object.keys(TRAITS).filter(id => !TRAITS[id].earnedOnly), BAL.trait.postgame, 'a starring performance');
    if (l.hat) tryGainTrait(save, pl, ['sharpshooter', 'rebound_hunter'], E * xpBoost(pl, 'hat'), 'a hat trick');
    if (l.gwg && (l.otw || l.cgw || (l.cv || 0) >= 50)) tryGainTrait(save, pl, ['clutch'], E * xpBoost(pl, 'clutch'), 'a decisive goal');
    if (l.fw) tryGainTrait(save, pl, ['enforcer', 'counterpuncher', 'intimidating'], E * xpBoost(pl, 'fight'), 'winning a scuffle');
    if (l.fl) tryGainTrait(save, pl, ['iron_chin', 'tough'], E * 0.6 * xpBoost(pl, 'fightL'), 'standing in there');
    if (l.protect) tryGainTrait(save, pl, ['protector'], E * 1.4 * xpBoost(pl, 'protect'), 'standing up for a teammate');
    if (l.sho) tryGainTrait(save, pl, ['brick_wall', 'acrobat', 'big_game'], E * xpBoost(pl, 'sho'), 'a clean sheet');
    if ((l.hit || 0) >= 4) tryGainTrait(save, pl, ['tough', 'steady_footing'], E * 0.5 * xpBoost(pl, 'hits'), 'a physical game');
    if ((l.ds || 0) >= 3) tryGainTrait(save, pl, ['def_spec', 'disciplined'], E * 0.7 * xpBoost(pl, 'def'), 'shutting down the opposition');
    if ((l.a || 0) >= 3) tryGainTrait(save, pl, ['playmaker'], E * xpBoost(pl, 'ast'), 'a three-assist night');
    if (l.teamId === winT && l.g && res.comeback === l.teamId) tryGainTrait(save, pl, ['comeback'], E * 1.2 * xpBoost(pl, 'comeback'), 'leading a comeback');
  }
}
function offseasonProgress(save, p, st) {
  if (p.status !== 'active' && p.status !== 'free') return;
  const lt = lifetime(p.career), gp = lt.gp;
  if (p.age >= 21 && p.age <= 31) {
    const reg = st ? st.reg : null, pool = [];
    if (reg && reg.gp) {
      if (p.pos === 'G') pool.push('brick_wall', 'acrobat', 'durable', 'rink_rat');
      else {
        if (reg.g >= 8) pool.push('sharpshooter', 'rebound_hunter'); if (reg.a >= 10) pool.push('playmaker'); if (reg.hit >= 25) pool.push('tough', 'enforcer');
        if (reg.ds >= 6) pool.push('def_spec', 'steady_footing'); if ((reg.pen || 0) <= 0 && reg.gp >= 10) pool.push('disciplined'); if (reg.toi >= 2400) pool.push('iron_lungs', 'durable');
        pool.push('speedster', 'rink_rat');
      }
    }
    if (pool.length) tryGainTrait(save, p, pool, BAL.trait.offseason, 'off-season training');
  }
  if (p.pos !== 'G' && p.age >= 31 && gp >= 250) tryGainTrait(save, p, ['veteran'], 0.25, 'years of experience');
  // player-specific leadership distinctions (stay with the player, not the franchise)
  p.leadStyles = p.leadStyles || [];
  const leagueCaps = (p.capTitles || []).map(id => save.trophies.find(t => t.id === id)).filter(t => t && t.type === 'league').length;
  const mvps = (p.awards || []).map(id => save.awards.find(a => a.id === id)).filter(a => a && a.key === 'mvp').length;
  if (p.pos !== 'G' && !p.leadStyles.includes('legend') && (leagueCaps >= 2 || mvps >= 2)) {
    p.leadStyles.push('legend');
    if (p.teamId === save.userTeamId) { pushNews(save, `${p.first} ${p.last} earned the leadership distinction THE LEGEND.`); notify(save, { kind: 'distinction', pid: p.id, style: 'legend' }); }
  }
  if (p.pos !== 'G' && !p.leadStyles.includes('iron') && gp >= 400) {
    p.leadStyles.push('iron');
    if (p.teamId === save.userTeamId) { pushNews(save, `${p.first} ${p.last} earned the leadership distinction THE IRON MAN.`); notify(save, { kind: 'distinction', pid: p.id, style: 'iron' }); }
  }
}
// ---------- Player Development: one action per player per season (persistent, seeded: reloading does not change the outcome)
function devAvailable(save, p) { return p && p.status === 'active' && p.teamId === save.userTeamId && p.devS !== save.season.num; }
function devAction(save, pid, traitId, mode) {
  const p = P(save, pid), se = save.season;
  if (!devAvailable(save, p)) return { error: 'This player has already had his development session this season.' };
  if (!(p.traits || []).includes(traitId)) return { error: 'He does not have that trait.' };
  const rng = mulberry32(hashStr(save.id + '|' + pid + '|' + se.num + '|' + traitId + '|' + mode));
  p.devS = se.num;
  if (mode === 'remove') {
    p.traits = p.traits.filter(x => x !== traitId);
    (p.traitLog = p.traitLog || []).push({ s: se.num, id: traitId, why: 'removed in development', removed: true });
    pushNews(save, `${p.first} ${p.last} worked ${TRAITS[traitId].name} out of his game.`);
    return { ok: true, removed: traitId, text: `${TRAITS[traitId].name} removed.` };
  }
  // reroll: chance to swap for a different eligible trait (respecting rarity and incompatibilities)
  const others = p.traits.filter(x => x !== traitId), probe = Object.assign({}, p, { traits: others });
  const pool = Object.keys(TRAITS).filter(id => id !== traitId && !TRAITS[id].earnedOnly);
  const nid = rng() < BAL.trait.reroll ? rollTrait(probe, rng, pool) : null;
  if (!nid) return { ok: true, kept: traitId, text: `The new routine didn't boot: ${TRAITS[traitId].name} stays.` };
  p.traits = others.concat(nid);
  (p.traitLog = p.traitLog || []).push({ s: se.num, id: nid, why: 'development (replaced ' + TRAITS[traitId].name + ')' });
  pushNews(save, `${p.first} ${p.last} reinvented his game: ${TRAITS[traitId].name} became ${TRAITS[nid].name}.`);
  return { ok: true, replaced: traitId, gained: nid, text: `${TRAITS[traitId].name} became ${TRAITS[nid].name}!` };
}

// ---------- declining an optional tournament: rest or focused training (modest and capped)
const ALT_CHOICES = { rest: 'Rest & recovery', train_off: 'Offense training', train_def: 'Defense training', train_cond: 'Conditioning' };
const TRAIN_ATTRS = { train_off: ['acc', 'pow', 'pas', 'stk'], train_def: ['def', 'chk'], train_cond: ['sta', 'spd'] };
function applyAlternative(save, compKey, kind) {
  const se = save.season, t = save.teams[save.userTeamId], out = [];
  se.alts = se.alts || {};
  if (se.alts[compKey]) return se.alts[compKey];
  if (kind === 'rest') {
    for (const id of rosterIds(t)) { const p = P(save, id); p.cond = Math.min(100, (p.cond ?? 90) + BAL.cond.rest); }
    se.alts[compKey] = { kind, text: `The team rested: condition +${BAL.cond.rest} for everyone.` };
  } else {
    const keys = TRAIN_ATTRS[kind] || TRAIN_ATTRS.train_off, rng = mulberry32(hashStr(save.id + compKey + se.num));
    for (const id of rosterIds(t)) {
      const p = P(save, id);
      if (kind === 'train_cond') p.cond = Math.min(100, (p.cond ?? 90) + 10);
      if (p.trainS === se.num || p.pos === 'G') continue;                     // one training gain per player per season
      if (rng() >= BAL.train.chance || overall(p) >= p.pot + 0.3) continue;   // never past his potential
      const k = keys.filter(x => p.attrs[x] < 10).sort((a, b) => p.attrs[a] - p.attrs[b])[0];
      if (!k) continue;
      p.attrs[k]++; p.trainS = se.num; out.push(`${p.first[0]}. ${p.last} +1 ${SK_ATTRS.find(a => a[0] === k)[1]}`);
    }
    se.alts[compKey] = { kind, text: `${ALT_CHOICES[kind]}: ` + (out.length ? out.join(', ') : 'no breakthroughs this time') + (kind === 'train_cond' ? ' · condition +10' : '') };
  }
  pushNews(save, se.alts[compKey].text);
  return se.alts[compKey];
}

// ====================================================================
//  ACHIEVEMENTS (franchise records; cosmetic rewards go to the account profile, styles stay with the franchise)
// ====================================================================
const userLines = (save, res) => res.stats.filter(l => { const p = P(save, l.pid); return p && l.teamId === save.userTeamId; });
const userTitles = (save, type) => save.trophies.filter(t => t.teamId === save.userTeamId && (!type || t.type === type));
const ACHIEVEMENTS = [
  { id: 'cup1', name: 'Raise the Banner', cat: 'Championships', desc: 'Win the League Championship.', on: 'comp', test: s => userTitles(s, 'league').length >= 1, reward: { cosmetic: 'banner_wall', memo: 'banner' } },
  { id: 'cup3', name: 'Dynasty', cat: 'Championships', desc: 'Win three League Championships.', on: 'comp', goal: 3, prog: s => userTitles(s, 'league').length, reward: { cosmetic: 'jersey_gold', memo: 'ring' } },
  { id: 'tour1', name: 'Silverware', cat: 'Tournaments', desc: 'Win any tournament.', on: 'comp', test: s => s.trophies.some(t => t.teamId === s.userTeamId && t.type !== 'league'), reward: { style: 'maestro' } },
  { id: 'slam', name: 'Grand Slam', cat: 'Tournaments', desc: 'Win all four cups (Invitational, Classic, Winter, Finale) over your franchise history.', on: 'comp', goal: 4, prog: s => ['inv', 'classic', 'winter', 'finale'].filter(k => s.trophies.some(t => t.teamId === s.userTeamId && t.comp === k)).length, reward: { cosmetic: 'pedestals' } },
  { id: 'toc1', name: 'Champion of Champions', cat: 'Tournaments', desc: 'Win the Tournament of Champions.', on: 'comp', test: s => s.trophies.some(t => t.teamId === s.userTeamId && t.comp === 'toc'), reward: { cosmetic: 'gold_trim' } },
  { id: 'treble', name: 'The Treble', cat: 'Championships', desc: 'Win the League Championship and two other trophies in the same season.', on: 'season', test: s => { const n = s.season.num, mine = s.trophies.filter(t => t.season === n && t.teamId === s.userTeamId); return mine.some(t => t.type === 'league') && mine.length >= 3; }, reward: { cosmetic: 'emblem_laurel' } },
  { id: 'mvp', name: 'Most Valuable', cat: 'Awards', desc: 'One of your players wins League MVP.', on: 'season', test: s => s.awards.some(a => a.key === 'mvp' && a.season === s.season.num && a.teamId === s.userTeamId), reward: { cosmetic: 'gold_visor', memo: 'plaque' } },
  { id: 'glove', name: 'Lockdown', cat: 'Awards', desc: 'Your keeper wins the Golden Glove or a player wins Defensive Player of the Year.', on: 'season', test: s => s.awards.some(a => (a.key === 'glove' || a.key === 'def') && a.season === s.season.num && a.teamId === s.userTeamId), reward: { cosmetic: 'galaxy_mask', style: 'wall', memo: 'mask' } },
  { id: 'stick', name: 'Golden Boot', cat: 'Awards', desc: 'One of your players leads the league in goals.', on: 'season', test: s => s.awards.some(a => a.key === 'stick' && a.season === s.season.num && a.teamId === s.userTeamId), reward: { cosmetic: 'gold_stick', memo: 'stick' } },
  { id: 'rookie', name: 'Rookie Sensation', cat: 'Awards', desc: 'One of your players wins Rookie of the Year.', on: 'season', test: s => s.awards.some(a => a.key === 'rookie' && a.season === s.season.num && a.teamId === s.userTeamId) },
  { id: 'hat', name: 'Hats Off', cat: 'Milestones', desc: 'One of your players scores a hat trick.', on: 'game', test: (s, e) => userLines(s, e.res).some(l => l.g >= 3), reward: { cosmetic: 'chrome_gear' } },
  { id: 'g100', name: 'Century Sniper', cat: 'Milestones', desc: 'One of your players reaches 100 career goals.', on: 'game', test: s => rosterSkaters(s.teams[s.userTeamId]).some(id => lifetime(P(s, id).career).g >= 100), reward: { cosmetic: 'gold_gear', memo: 'jersey' } },
  { id: 'p500', name: 'Five Hundred', cat: 'Milestones', desc: 'One of your players reaches 500 career points.', on: 'game', test: s => rosterSkaters(s.teams[s.userTeamId]).some(id => { const l = lifetime(P(s, id).career); return l.g + l.a >= 500; }), reward: { memo: 'jersey' } },
  { id: 'iron', name: 'Iron Man', cat: 'Milestones', desc: 'One of your players plays 400 career games (earns THE IRON MAN distinction).', on: 'game', test: s => rosterSkaters(s.teams[s.userTeamId]).some(id => lifetime(P(s, id).career).gp >= 400) },
  { id: 'fight1', name: 'Square up', cat: 'Scuffling', desc: 'Win a scuffle.', on: 'game', test: (s, e) => userLines(s, e.res).some(l => l.fw) },
  { id: 'fight10', name: 'Heavyweight', cat: 'Scuffling', desc: 'Your franchise wins 10 scuffles.', on: 'game', goal: 10, prog: s => Object.values(s.players).filter(p => p.teamId === s.userTeamId || (p.seasons || []).some(x => x.teamId === s.userTeamId)).reduce((a, p) => a + (p.ufw || 0), 0), reward: { cosmetic: 'flame_helmet', memo: 'gloves' } },
  { id: 'sho1', name: 'Brick Wall', cat: 'Keepers', desc: 'Your keeper keeps a clean sheet.', on: 'game', test: (s, e) => userLines(s, e.res).some(l => l.sho) },
  { id: 'sho10', name: 'Clean Sheet Artist', cat: 'Keepers', desc: 'One of your keepers reaches 10 career clean sheets.', on: 'game', test: s => rosterGoalies(s.teams[s.userTeamId]).some(id => lifetime(P(s, id).career).sho >= 10), reward: { cosmetic: 'star_mask', memo: 'mask' } },
  { id: 'sweep', name: 'Clean Sweep', cat: 'Playoffs', desc: 'Sweep a best-of-five playoff series 3-0.', on: 'series', test: (s, e) => e.c.key === 'po' && e.sr.winner === s.userTeamId && Math.min(e.sr.winsHi, e.sr.winsLo) === 0, reward: { cosmetic: 'jersey_flames' } },
  { id: 'nsd', name: 'Never Say Die', cat: 'Playoffs', desc: 'Win a playoff series after losing the first two games.', on: 'series', test: (s, e) => e.c.key === 'po' && e.sr.winner === s.userTeamId && e.sr.down2 === s.userTeamId, reward: { cosmetic: 'emblem_phoenix' } },
  { id: 'gold_goal', name: 'Golden Goal', cat: 'Playoffs', desc: 'Win a championship final in extra time.', on: 'comp', test: (s, e) => { const fin = e.c && e.c.rounds[e.c.rounds.length - 1][0]; const g = fin && s.season.games[fin.gids[fin.gids.length - 1]]; return e.c.champion === s.userTeamId && g && g.ot; }, reward: { memo: 'puck' } },
  { id: 'y5', name: 'Five Seasons', cat: 'Longevity', desc: 'Complete five seasons with your franchise.', on: 'season', goal: 5, prog: s => s.season.num, reward: { cosmetic: 'jersey_heritage' } },
  { id: 'y10', name: 'A Decade of Soccer', cat: 'Longevity', desc: 'Complete ten seasons.', on: 'season', goal: 10, prog: s => s.season.num, reward: { cosmetic: 'carpet' } },
  { id: 'y25', name: 'Silver Jubilee', cat: 'Longevity', desc: 'Complete twenty-five seasons.', on: 'season', goal: 25, prog: s => s.season.num, reward: { cosmetic: 'golden_horn' } },
  { id: 'w100', name: 'Century Club', cat: 'Longevity', desc: '100 regular-season wins for your franchise.', on: 'game', goal: 100, prog: s => s.history.reduce((a, h) => a + ((h.userRecord && h.userRecord.w) || 0), 0) + (s.season.standings[s.userTeamId].w || 0), reward: { style: 'jet' } },
  { id: 'comeback', name: 'Comeback Kids', cat: 'Exceptional', desc: 'Win a game after trailing by two goals or more.', on: 'game', test: (s, e) => e.res.comeback === s.userTeamId, reward: { style: 'spark' } },
  { id: 'pp3', name: 'Stoppage-Time Hero', cat: 'Exceptional', desc: 'Score a goal in added time.', on: 'game', test: (s, e) => userLines(s, e.res).some(l => l.addg), reward: { cosmetic: 'arena_show' } },
  { id: 'eng', name: 'Play On!', cat: 'Exceptional', desc: 'Score while the referee is playing advantage.', on: 'game', test: (s, e) => userLines(s, e.res).some(l => l.advg) },
  { id: 'xatk', name: 'Last-Gasp Winner', cat: 'Exceptional', desc: 'Win a game after scoring in added time.', on: 'game', test: (s, e) => { const home = e.g.home === s.userTeamId, hs = e.res.hs ?? e.g.hs, as = e.res.as ?? e.g.as, won = home ? hs > as : as > hs; return won && userLines(s, e.res).some(l => l.addg); } },
  { id: 'div1', name: 'Division Kings', cat: 'Championships', desc: 'Finish first in your division.', on: 'season', test: s => [0, 1, 2, 3].some(d => divStandings(s, d)[0] === s.userTeamId) },
  { id: 'top1', name: 'Best in the League', cat: 'Championships', desc: 'Finish first overall in the regular season.', on: 'season', test: s => sortedStandings(s)[0] === s.userTeamId, reward: { cosmetic: 'spotlights' } },
  { id: 'legend', name: 'Franchise Legend', cat: 'Exceptional', desc: 'A captain of yours lifts two League Championships wearing the C (earns THE LEGEND).', on: 'comp', test: s => Object.values(s.players).some(p => (p.capTitles || []).map(id => s.trophies.find(t => t.id === id)).filter(t => t && t.type === 'league' && t.teamId === s.userTeamId).length >= 2), reward: { cosmetic: 'jersey_galaxy', memo: 'capstick' } },
];
const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));
const MEMO_KINDS = {
  banner: { name: 'Championship Banner', icon: 'banner' }, ring: { name: 'Dynasty Ring', icon: 'ring' }, plaque: { name: 'MVP Award Display', icon: 'plaque' },
  mask: { name: 'Legendary Keeper Mask', icon: 'mask' }, stick: { name: 'Game-Used Boot', icon: 'stick' }, jersey: { name: 'Commemorative Jersey', icon: 'jersey' },
  gloves: { name: 'Heavyweight Gloves', icon: 'gloves' }, puck: { name: 'Golden Goal Ball', icon: 'puck' }, capstick: { name: "The Captain's Boot", icon: 'stick' },
};
// the player a piece of memorabilia honours (attribution survives retirement: name, id, number, seasons, team)
function memoSubject(save, def, e) {
  const se = save.season, ut = save.userTeamId;
  const award = key => save.awards.filter(a => a.key === key && a.season === se.num && a.teamId === ut)[0];
  const top = (f) => rosterIds(save.teams[ut]).map(id => P(save, id)).sort((a, b) => f(b) - f(a))[0];
  switch (def.id) {
    case 'mvp': { const a = award('mvp'); return a && P(save, a.pid); }
    case 'glove': { const a = award('glove') || award('def'); return a && P(save, a.pid); }
    case 'stick': { const a = award('stick'); return a && P(save, a.pid); }
    case 'g100': return top(p => lifetime(p.career).g);
    case 'p500': return top(p => { const l = lifetime(p.career); return l.g + l.a; });
    case 'sho10': return top(p => lifetime(p.career).sho);
    case 'fight10': return top(p => p.ufw || 0);
    case 'gold_goal': case 'cup1': case 'cup3': { const c = se.comps.po, fin = c && c.rounds.length && c.rounds[c.rounds.length - 1][0]; const g = fin && se.games[fin.gids[fin.gids.length - 1]]; return g && g.gwg ? P(save, g.gwg.pid) : null; }
    case 'legend': return Object.values(save.players).find(p => (p.capTitles || []).map(id => save.trophies.find(t => t.id === id)).filter(t => t && t.type === 'league' && t.teamId === ut).length >= 2);
  }
  return null;
}
function addMemorabilia(save, def, e) {
  const kind = def.reward.memo, mk = MEMO_KINDS[kind]; if (!mk) return null;
  const p = memoSubject(save, def, e), t = save.teams[save.userTeamId], se = save.season;
  const item = { id: 'mm' + (save.nextId.x = (save.nextId.x || 1) + 1), kind, icon: mk.icon, name: mk.name, ach: def.id, achName: def.name, season: se.num, year: se.year, seasonLabel: seasonLabel(se.year),
    teamId: t.id, teamName: fullName(t), abbr: t.abbr, colors: { ...t.colors }, test: !!(save.debug && save.debug.modified) };
  if (p) Object.assign(item, { pid: p.id, playerName: p.first + ' ' + p.last, num: p.num, pos: posLabel(p), seasons: [...new Set((p.seasons || []).filter(x => x.teamId === t.id).map(x => x.s).concat(p.teamId === t.id ? [se.num] : []))] });
  if (kind === 'banner') item.name = `${seasonLabel(se.year)} Championship Banner`;
  if (kind === 'capstick' && p) item.name = `${p.last}'s Captain's Boot`;
  item.text = memoText(item, def);
  if (typeof memoFirstPicks === 'function') memoFirstPicks(save, item);
  save.memorabilia.push(item);
  if (p) { p.memo = p.memo || []; p.memo.push(item.id); }
  notify(save, { kind: 'legacy', memo: item.id });
  return item;
}
function memoText(it, def) {
  const who = it.playerName ? `#${it.num} ${it.playerName}` : it.teamName;
  switch (it.kind) {
    case 'banner': return `${it.teamName}, League Champions ${it.seasonLabel}.`;
    case 'ring': return `Three championships. A dynasty in ${it.teamName.split(' ')[0]}.`;
    case 'capstick': return `Two championships. One captain. A franchise legend: ${who}.`;
    case 'mask': return `${who}: the mask that stopped everything in ${it.seasonLabel}.`;
    case 'stick': return `${who}: game-used, ${it.seasonLabel}.`;
    case 'jersey': return `${who}: ${def.name}.`;
    case 'puck': return `The golden-goal ball, ${it.seasonLabel}${it.playerName ? ' (scored by ' + who + ')' : ''}.`;
    case 'plaque': return `${who}: League MVP ${it.seasonLabel}.`;
    case 'gloves': return `The gloves of ${who}, franchise heavyweight.`;
  }
  return def.desc;
}
// evaluate achievements for an event ('game' | 'comp' | 'series' | 'season')
function checkAchievements(save, on, e = {}) {
  const out = [];
  for (const def of ACHIEVEMENTS) {
    if (def.on !== on) continue;
    const cur = save.ach[def.id];
    if (cur && cur.done) continue;
    let done = false;
    try {
      if (def.goal) { const v = def.prog(save, e); save.achProg[def.id] = Math.max(save.achProg[def.id] || 0, v); done = v >= def.goal; }
      else done = !!def.test(save, e);
    } catch (err) { done = false; }
    if (!done) continue;
    const test = !!(save.debug && save.debug.modified), dreamS = !!save.dream;
    const rec = save.ach[def.id] = { done: true, at: Date.now(), s: save.season.num, year: save.season.year, test, dream: dreamS || undefined };
    out.push(def);
    pushNews(save, `${test ? '[TEST] ' : dreamS ? '[DREAM TEAM] ' : ''}Achievement unlocked: ${def.name}.`);
    notify(save, { kind: 'ach', ach: def.id, test });
    const R = def.reward || {};
    if (R.style && !save.unlocks.styles.includes(R.style)) { save.unlocks.styles.push(R.style); rec.style = R.style; pushNews(save, `New leadership style unlocked for your franchise: ${LEAD_STYLES[R.style].name}.`); }
    if (R.cosmetic) { rec.cosmetic = R.cosmetic; if (!test && !dreamS) grantCosmetic(save, R.cosmetic, def.name); }
    if (R.memo) { const it = addMemorabilia(save, def, e); if (it) rec.memo = it.id; }
    if (!test && !dreamS) { PROFILE.ach[def.id] = (PROFILE.ach[def.id] || 0) + 1; PROFILE.dirty = true; }
  }
  return out;
}
// hooks called by league.js
function afterGameProgress(save, g, res) {
  // franchise fight wins (for Heavyweight) and comeback detection
  for (const l of res.stats) if (l.fw && l.teamId === save.userTeamId) { const p = P(save, l.pid); if (p) p.ufw = (p.ufw || 0) + 1; }
  postgameTraits(save, g, res);
  if (g.home === save.userTeamId || g.away === save.userTeamId) checkAchievements(save, 'game', { g, res });
  if (g.comp) {
    const c = save.season.comps[g.comp], sr = c && findSeries(c, g.seriesId);
    if (sr) {
      if (sr.winsHi + sr.winsLo === 2 && sr.bestOf >= 5) { if (sr.winsHi === 2) sr.down2 = sr.lo; else if (sr.winsLo === 2) sr.down2 = sr.hi; }
      if (sr.winner && (sr.hi === save.userTeamId || sr.lo === save.userTeamId)) checkAchievements(save, 'series', { c, sr });
    }
  }
}
function onCompFinal(save, c) { checkAchievements(save, 'comp', { c }); }
function onSeasonFinal(save) { checkAchievements(save, 'season', {}); }
// comeback detection from the goal sequence (team ids): who won after trailing by 2+
function comebackTeam(goals, home, away, hs, as) {
  let a = 0, b = 0, maxDownH = 0, maxDownA = 0;
  for (const x of goals || []) { if (x.teamId === home) a++; else if (x.teamId === away) b++; maxDownH = Math.max(maxDownH, b - a); maxDownA = Math.max(maxDownA, a - b); }
  if (hs > as && maxDownH >= 2) return home;
  if (as > hs && maxDownA >= 2) return away;
  return null;
}
