'use strict';
// ====================================================================
//  DEBUG 2: Unlock Everything (session preview / persistent in marked debug saves), test scenarios,
//  business testing (contracts, finances, cap, trades, free agency, invitations), extra diagnostics.
//  Nothing here ever touches legitimate account-wide progress (PROFILE).
// ====================================================================
DBG.sessionUnlock = false;                     // preview only: gone when the page reloads
const dbgUnlockAll = () => DBG.on && (DBG.sessionUnlock || !!(UI.save && UI.save.debug && UI.save.debug.unlockAll));
// cosmetics / rooms / arena locks consult this (never written into the account profile)
if (typeof ROOMS !== 'undefined') for (const k of Object.keys(ROOMS)) { const ok = ROOMS[k].ok; ROOMS[k].ok = s => ok(s) || dbgUnlockAll(); }
DBG.collisions = 0; DBG.collPerSec = 0;
setInterval(() => { DBG.collPerSec = DBG.collisions; DBG.collisions = 0; }, 1000);

function dbgUnlocksTab(body, render) {
  const save = UI.save;
  body.appendChild(h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'UNLOCK EVERYTHING'),
    h('div', { class: 'sub' }, 'Preview every cosmetic, gear option, customization option, trophy room, the Secrets Room secrets (the Alien Grounds Crew) and every item that is normally bought with franchise funds (arena renovations and upgrades, trophy-room decor). Legitimate progress is never touched: your account unlocks and achievements stay exactly as earned.'),
    h('div', { class: 'row', style: { justifyContent: 'flex-start' } },
      h('button', { class: DBG.sessionUnlock ? 'primary' : '', onclick: () => { DBG.sessionUnlock = !DBG.sessionUnlock; toast(DBG.sessionUnlock ? 'Session preview ON (until reload).' : 'Session preview OFF.'); render(); } }, 'SESSION PREVIEW: ' + (DBG.sessionUnlock ? 'ON' : 'OFF')),
      save ? h('button', { class: save.debug && save.debug.unlockAll ? 'primary' : '', onclick: () => {
        markDebug(save, 'unlock-all toggle'); save.debug.unlockAll = !save.debug.unlockAll; Store.autosave(save);
        toast(save.debug.unlockAll ? 'This franchise is now a marked DEBUG save with everything unlocked.' : 'Persistent debug unlocks OFF for this save.'); render();
      } }, 'PERSISTENT IN THIS (DEBUG) SAVE: ' + (save.debug && save.debug.unlockAll ? 'ON' : 'OFF')) : null,
      h('button', { class: 'danger', onclick: () => { DBG.sessionUnlock = false; if (save && save.debug) { save.debug.unlockAll = false; Store.autosave(save); } toast('Debug unlocks reset.'); render(); } }, 'RESET DEBUG UNLOCKS')),
    h('div', { class: 'hint' }, 'Turning on the persistent switch marks the franchise as debug-modified: it can no longer earn account-wide cosmetics.')));
}

// ---------- franchise business testing
function dbgBizTab(body, render) {
  const save = UI.save; if (!save) return body.appendChild(h('div', { class: 'panel sub' }, 'Open a franchise first.'));
  const user = save.teams[save.userTeamId], out = h('pre', { style: { fontSize: '7px', whiteSpace: 'pre-wrap' } });
  const act = (lab, fn) => h('button', { class: 'small', onclick: () => { try { const r = fn(); markDebug(save, lab); Store.autosave(save); out.textContent = r || 'Done.'; render && setTimeout(() => {}, 0); } catch (e) { out.textContent = 'Error: ' + e.message; } } }, lab);
  body.appendChild(h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'CONTRACTS · FINANCES · CAP · TRADES · FREE AGENCY'),
    h('div', { class: 'sub' }, `Funds ${fmtM(finOf(user).cash)} · payroll ${fmtM(payroll(save, user))} · cap ${fmtM(FIN.cap)} · popularity ${Math.round(finOf(user).pop)} · offseason: ${save.off ? save.off.phase + (save.off.phase === 'fa' ? ' day ' + save.off.day : '') : 'no'}`),
    h('div', { class: 'row', style: { justifyContent: 'flex-start' } },
      act('+$5M FUNDS', () => { finOf(user).cash += 5000; return 'Funds ' + fmtM(finOf(user).cash); }),
      act('-$5M FUNDS', () => { finOf(user).cash -= 5000; return 'Funds ' + fmtM(finOf(user).cash); }),
      act('POPULARITY 95', () => { finOf(user).pop = 95; return 'Popularity 95.'; }),
      act('ALL MY CONTRACTS EXPIRE THIS YEAR', () => { for (const id of rosterIds(user)) { const p = P(save, id); if (p.contract) p.contract.yrs = 1; } return 'Every contract is now in its final year (extensions open; expires next offseason).'; }),
      act('PUSH MY PAYROLL OVER THE CAP', () => { const p = rosterIds(user).map(id => P(save, id)).sort((a, b) => salOf(b) - salOf(a))[0]; p.contract.sal += Math.max(0, FIN.cap + 1500 - payroll(save, user)); return `${p.last} now earns ${fmtM(p.contract.sal)}; payroll ${fmtM(payroll(save, user))}, projected penalty ${fmtM(capTax(payroll(save, user)))}.`; }),
      act('GET A TRADE OFFER', () => { const o = aiTradeProposal(save, true); return o ? o.msg : 'No club found a deal right now (or trading is closed).'; }),
      act('ADD 5 FREE AGENTS', () => { const out2 = []; for (let i = 0; i < 5; i++) { const p = registerPlayer(save, genPlayer(Math.random, i === 4 ? 'G' : 'S', { q: 5 + Math.random() * 2.5 })); p.status = 'free'; p.freeSince = save.seasonNum; out2.push(p.first + ' ' + p.last); } return 'Free agents added: ' + out2.join(', '); }),
      act('ADVANCE OFFSEASON STEP', () => { if (!save.off) return 'Not in the offseason.'; const r = advanceOffseason(save); return 'Now: ' + (r === 'start' ? 'new season' : r); }),
      act('NEXT FREE-AGENCY DAY', () => { if (!save.off || save.off.phase !== 'fa') return 'Free agency is not open.'; faNextDay(save); return 'Day ' + save.off.day; }),
      act('QUALIFY ME FOR NEXT EVENT', () => { const st = save.season.standings[user.id], top = save.season.standings[sortedStandings(save)[0]]; st.pts = top.pts + 2; return 'You are first in the standings (+points).'; }),
      act('CLOSE FINANCES NOW (TEST)', () => { const r = closeFinances(save)[user.id]; return finAssessment(r) + '\n' + JSON.stringify(r); })),
    out, h('div', { class: 'hint' }, 'Every action marks the franchise as debug-modified.')));
}

// ====================================================================
//  TEST SCENARIOS (a sandbox match against generated teams; rules off unless the scenario needs them)
// ====================================================================
const SCENARIOS = {
  '1v1': { name: '1 attacker vs 1 defender', desc: 'You carry from centre pitch; one defender, one keeper.' },
  '2v1': { name: '2 attackers vs 1 defender', desc: 'An odd-man rush: pass or shoot.' },
  faceoff: { name: 'Kickoff timing', desc: 'Repeated centre-ice draws: press SHOOT on the drop. Results are tallied.' },
  pp: { name: 'Power play / man down', desc: 'You start a 30-second power play (4-on-3), rules on.' },
  tip: { name: 'Deflections', desc: 'A teammate fires from the edge of the box: stand in front and press SHOOT as it comes.' },
  deke: { name: 'Feint vs poke tackle', desc: 'One defender stands up at the halfway line: beat his poke with a feint.' },
  wrap: { name: 'Near-post pokes', desc: 'Start behind the net with the ball: press SHOOT next to a post.' },
};
const SCN_T = { level: 5, stats: null };
function dbgScenTab(body) {
  body.appendChild(h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'TEST SCENARIOS'),
    h('div', { class: 'sub' }, 'Sandbox matches (not part of any franchise). Reps reset automatically after a goal, save or dead ball.'),
    h('div', { style: { margin: '6px 0' } }, h('span', { class: 'sub' }, 'ATTRIBUTE LEVEL FOR EVERY PLAYER  '), numIn(SCN_T.level * 10, 10, 100, 10, v => { SCN_T.level = Math.round(v / 10); toast('Level ' + v + ' for the next scenario.'); })),
    Object.entries(SCENARIOS).map(([k, sc]) => h('div', { class: 'hotrow' }, h('div', { style: { flex: 1 } }, h('b', null, sc.name), h('div', { class: 'muted', style: { fontSize: '7px' } }, sc.desc)), h('button', { class: 'small primary', onclick: () => startScenario(k) }, 'RUN')))));
}
function startScenario(kind) {
  const teams = generateQuickTeams('DEBUG-TEST');
  const a = teams[2], b = teams[5];
  for (const q of [a, b]) for (const id of rosterIds(q.t)) { const p = q.fake.players[id]; for (const k in p.attrs) p.attrs[k] = SCN_T.level; }
  SCN_T.stats = { kind, reps: 0, goals: 0, saves: 0, fo: 0, foWon: 0, tips: 0, labels: {} };
  SCN_T.prevRules = S.rules;
  S.rules = kind === 'pp';
  launchMatch({ teams: [a.ident, b.ident], home: 0, lineups: [qpLineup(a), qpLineup(b)], tac: [a.tac, b.tac], decider: 'shootout', kind: 'quick', canRestart: true, test: kind,
    onEnd: () => { leaveMatch(); S.rules = SCN_T.prevRules; S.scen = null; go(scrDebug); }, onQuit: () => { S.rules = SCN_T.prevRules; S.scen = null; go(scrDebug); } });
  S.scen = { kind, t: 0, armed: false };
  scenSetup();
}
function scenSetup() {
  const sc = S.scen; if (!sc) return;
  sc.t = 0; sc.armed = true; sc.shotFired = false;
  setEnds(0);   // scenarios are laid out with us attacking up
  const kind = sc.kind;
  if (kind === 'faceoff') { setupFaceoff(CX, CY); return; }
  if (kind === 'pp') { setupFaceoff(CX, CY); if (MS && MS.rs && !MS.rs.pens[1].length) { const p = teamSkaters(1).find(x => x.pl); startTimed(1, p.pl, 'trip'); applyManpower(false); } return; }
  // positional scenarios: choose who plays, park the rest out of the play
  const me = teamSkaters(0).slice().sort((x, y) => x.role - y.role);
  const them = teamSkaters(1).slice().sort((x, y) => x.role - y.role);
  const use0 = kind === '2v1' || kind === 'tip' ? 2 : 1, use1 = kind === 'tip' ? 1 : 1;
  me.forEach((p, i) => { resetPlayerState(p); p.scenOut = i >= use0; });
  them.forEach((p, i) => { resetPlayerState(p); p.scenOut = i >= use1; });
  const park = (p, i) => { p.x = p.team === 0 ? R.l + 14 + i * 12 : R.r - 14 - i * 12; p.y = CY + (p.team === 0 ? 120 : -120); p.vx = p.vy = 0; };
  let k = 0; for (const p of me.concat(them)) if (p.scenOut) park(p, k++);
  for (const g of goalies) if (g) goalieHome(g);
  const att = me[0], d = them[0];
  ctrl = att;
  resetPuck(CX, CY);
  if (kind === '1v1' || kind === '2v1') { att.x = CX - 10; att.y = CY + 30; d.x = CX; d.y = BLUE_TOP - 20; if (me[1]) { me[1].x = CX + 70; me[1].y = CY + 20; } }
  else if (kind === 'deke') { att.x = CX; att.y = BLUE_TOP + 30; d.x = CX; d.y = BLUE_TOP - 12; }
  else if (kind === 'wrap') { att.x = CX + GOAL_HW + 8; att.y = GL_TOP - 12; d.x = CX - 40; d.y = GL_TOP + 60; }
  else if (kind === 'tip') { const sh = me[1]; sh.x = CX + 40; sh.y = BLUE_TOP + 8; att.x = CX + 6; att.y = GL_TOP + 22; d.x = CX - 30; d.y = GL_TOP + 40; puck.owner = sh; puck.lastTouch = sh; sh.fx = 0; sh.fy = -1; }
  if (kind !== 'tip') { puck.owner = att; puck.lastTouch = att; att.fx = 0; att.fy = -1; }
  S.phase = 'live'; S.cpuDelay = 30; S.clock = S.periodLen - 1;
}
// called each live frame: keep the parked players out, run the scenario clock, reset after each rep
function scenTick() {
  const sc = S.scen; if (!sc || S.screen !== 'play') return false;
  S.clock = Math.max(S.clock, S.periodLen - 1);
  const st = SCN_T.stats;
  if (sc.kind === 'faceoff') {
    if (S.phase === 'live' && sc.armed) { sc.armed = false; st.fo++; if (S.foWinner === 0) st.foWon++; const lab = S.fo && S.fo.fb ? S.fo.fb.label : '?'; st.labels[lab] = (st.labels[lab] || 0) + 1; sc.t = 0; }
    if (S.phase === 'live' && ++sc.t > 45) scenSetup();
    return false;
  }
  if (sc.kind === 'pp') return false;
  for (const p of skaters) if (p.scenOut) { p.vx = p.vy = 0; p.inx = p.iny = 0; p.stun = 2; }
  if (sc.kind === 'tip' && !sc.shotFired && S.phase === 'live' && ++sc.t > 50 && puck.owner && puck.owner.team === 0 && puck.owner !== ctrl) { sc.shotFired = true; shoot(puck.owner, 0.65); }
  if (S.phase === 'goal' || S.phase === 'whistle' || S.phase === 'faceoff') { st.reps++; if (S.phase === 'goal') st.goals++; scenSetup(); return true; }
  if (puck.owner && puck.owner.g) { st.reps++; st.saves++; scenSetup(); return true; }
  if (S.phase === 'live' && ++sc.t > 420) { st.reps++; scenSetup(); return true; }
  return false;
}
function scenHud() {
  if (!S.scen || !SCN_T.stats) return '';
  const st = SCN_T.stats;
  return `TEST: ${SCENARIOS[S.scen.kind].name} · reps ${st.reps} goals ${st.goals} saves ${st.saves}` + (S.scen.kind === 'faceoff' ? ` · kickoffs ${st.foWon}/${st.fo} · ` + Object.entries(st.labels).map(([k, v]) => k + ' ' + v).join(' ') : '');
}
// AI state readout for the match debug panel
function aiStateText() {
  const plans = [teamPlan(0), teamPlan(1)];
  return [0, 1].map(t => TEAM[t].abbr + ' ' + activeTactic(t).sit + '/' + activeTactic(t).key + ': ' + teamSkaters(t).map(p => {
    const g = plans[t][p.id]; const tag = !g ? (p === ctrl ? 'YOU' : hasPuck(p) ? 'CARRIER' : '-') : g.chase ? 'PRESS' : g.slot ? 'SLOT' : g.mark ? 'LANE' : g.high ? 'HIGH' : g.stretch ? 'STRETCH' : g.screen ? 'SCREEN' : g.rebound ? 'REBOUND' : g.tip ? 'TIP' : g.loose ? 'LOOSE' : g.recover ? 'RECOVER' : 'SUPPORT';
    return '#' + p.num + ' ' + tag;
  }).join(', ')).join('\n');
}

// ====================================================================
//  SHOWCASE (added Nov 19): everything presentation-side that came after the debug menu: the broadcast desk and its
//  hosts, the Alien Ice Crew and the Secrets Room, and a sandbox match in any arena / boards / glass / light show.
//  None of it touches a franchise; only "RESET MY SECRETS" touches the account (it asks first).
// ====================================================================
function dbgProfileLine() {
  const P0 = PROFILE || {}, sc = P0.secrets || {};
  const found = ['lightsout', 'chance'].filter(k => sc[k]).map(k => k === 'lightsout' ? 'Lights Out' : 'Pure Chance');
  return `Account: ${Object.keys(P0.cos || {}).length} cosmetics · ${Object.keys(P0.ach || {}).length} achievements · secrets: ${sc.aliens ? 'Alien Grounds Crew (' + (found.join(' + ') || '?') + ', mode ' + (P0.alienMode || 'some') + ')' : 'none found'}`;
}
const DBG_DESK = { who: 0, talk: true, frame: 0, iv: null };
function dbgShowTab(body, render) {
  const save = UI.save;
  // ---- the broadcast desk
  const desk = h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'BROADCAST DESK'));
  const cv = h('canvas', { width: DESK_W, height: DESK_H, class: 'px', style: { width: '480px', maxWidth: '100%', height: 'auto', background: '#000' } });
  const hostSel = h('select', { onchange: e => { DBG.deskHost = e.target.value || null; } }, [h('option', { value: '' }, "Co-host: today's")].concat(COHOSTS.map(c0 => h('option', { value: c0.id, selected: DBG.deskHost === c0.id }, 'Co-host: ' + c0.name))));
  const suitSel = h('select', { onchange: e => { DBG.deskSuit = e.target.value === '' ? null : +e.target.value; } }, [h('option', { value: '' }, "Suit: today's")].concat(SUITS.map((s0, i) => h('option', { value: i, selected: DBG.deskSuit === i }, 'Suit ' + (i + 1) + ': ' + s0[0]))));
  const whoSel = h('select', { onchange: e => { const v = e.target.value; DBG_DESK.talk = v !== 'none'; DBG_DESK.who = v === 'barry' ? 1 : 0; } }, [['host', 'Co-host talking'], ['barry', 'Barron talking'], ['none', 'Nobody talking']].map(([v, l]) => h('option', { value: v, selected: (DBG_DESK.talk ? (DBG_DESK.who ? 'barry' : 'host') : 'none') === v }, l)));
  const lines = h('pre', { style: { fontSize: '7px', whiteSpace: 'pre-wrap', maxHeight: '160px', overflow: 'auto' } });
  desk.appendChild(h('div', { class: 'sub' }, 'Live preview with the real animations (lip-sync, blinks, brows, glances, nods, gestures). The co-host and suit picks also override the Season hub until you reload or clear them.'));
  desk.appendChild(h('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-start' } }, cv,
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, hostSel, suitSel, whoSel,
      h('button', { class: 'small', onclick: () => { DBG.deskHost = null; DBG.deskSuit = null; render(); } }, 'CLEAR OVERRIDES'),
      save ? h('button', { class: 'small', onclick: () => { const sc = deskScript(save); lines.textContent = sc.lines.map(L => Array.isArray(L) ? (L[0] ? 'BARRON: ' : sc.host.name.toUpperCase() + ': ') + L[1] : '[REPLAY CENTRE: MR ANDERSON, ' + L.replays.length + ' replay' + (L.replays.length > 1 ? 's' : '') + ']').join('\n'); } }, "READ TODAY'S SCRIPT") : null,
      save ? h('button', { class: 'small', onclick: () => { save.ufo = save.ufo && deskDay(save) - save.ufo.day <= 1 ? null : { day: deskDay(save) }; Store.autosave(save); toast(save.ufo ? 'Barry will talk about the UFO sighting.' : 'UFO sighting cleared.'); } }, 'TOGGLE "UFO LAST NIGHT" SEGMENT') : null)),
    lines);
  body.appendChild(desk);
  clearInterval(DBG_DESK.iv);
  const sv = save || null, c = cv.getContext('2d');
  let n = 0;
  const tick = () => {
    if (!cv.isConnected && ++n > 5) { clearInterval(DBG_DESK.iv); return; }
    DBG_DESK.frame++;
    const host = DBG.deskHost ? COHOSTS.find(x => x.id === DBG.deskHost) : sv ? deskCohost(sv) : COHOSTS[0];
    const s0 = SUITS[DBG.deskSuit != null ? DBG.deskSuit : 0], suit = sv && DBG.deskSuit == null ? deskSuit(sv) : { name: s0[0], coat: s0[1], acc: s0[2], pat: s0[3], tie: s0[4], tieAcc: s0[5], tiePat: s0[6] };
    try { deskScene(c, sv || { userTeamId: null }, { frame: DBG_DESK.frame, who: DBG_DESK.who, talking: DBG_DESK.talk, host, suit }); } catch (e) { c.fillStyle = '#300'; c.fillRect(0, 0, DESK_W, 20); }
  };
  DBG_DESK.iv = setInterval(tick, 70); tick();
  // ---- aliens and secrets
  const sc = (PROFILE && PROFILE.secrets) || {};
  body.appendChild(h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'ALIEN GROUNDS CREW & SECRETS'),
    h('div', { style: { fontSize: '8px', lineHeight: 2 } }, dbgProfileLine()),
    h('div', { class: 'sub' }, 'Real unlocks only come from real games: not Easy, not test/debug matches, not debug-modified franchises. Lights Out = win by 5+ with a clean sheet; Pure Chance = 1 half-time in ' + Math.round(1 / ALIEN.chance) + '.'),
    h('div', { class: 'row', style: { justifyContent: 'flex-start' } },
      h('button', { class: window.ALIEN_FORCE ? 'primary' : '', onclick: () => { window.ALIEN_FORCE = !window.ALIEN_FORCE; toast(window.ALIEN_FORCE ? 'Aliens at every half-time (this session, any game).' : 'Aliens back to normal.'); render(); } }, 'ALIENS EVERY HALF-TIME: ' + (window.ALIEN_FORCE ? 'ON' : 'OFF')),
      h('button', { class: 'small', onclick: () => { window.ALIEN_FORCE = true; dbgArenaMatch(dbgArenaCfg(), { inter: true }); } }, 'WATCH THEM NOW (TEST MATCH)'),
      h('button', { class: 'small', onclick: () => { UI.room = 'secrets'; if (UI.save) go(scrRooms); else toast('The Secrets Room is in the Trophy Rooms: open a franchise first.'); } }, 'OPEN SECRETS ROOM'),
      h('button', { class: 'small danger', onclick: () => { if (!confirm('Reset your REAL account secrets (the Alien Grounds Crew will be locked again)?')) return; if (PROFILE.secrets) delete PROFILE.secrets; delete PROFILE.alienMode; PROFILE.dirty = true; toast('Account secrets reset.'); render(); } }, 'RESET MY SECRETS (ACCOUNT)')),
    h('div', { class: 'hint' }, "To preview the Secrets Room unlocked without earning it, use UNLOCKS → SESSION PREVIEW (it now covers secrets too).")));
  // ---- arena test match
  const A = DBG.arena = DBG.arena || { venue: 'classic', boards: 'classic', glass: 'clear', lighting: 'classic', show: 'standard', style: '', walk: true };
  const opt = (k, list, lab) => h('label', { style: { fontSize: '7px' } }, lab + ' ', h('select', { onchange: e => { A[k] = e.target.value; } }, Object.entries(list).map(([v, n]) => h('option', { value: v, selected: A[k] === v }, n))));
  body.appendChild(h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'ARENA TEST MATCH'),
    h('div', { class: 'sub' }, 'A sandbox quick match (no franchise, no unlocks) in any combination. Use the in-game debug panel (backquote) for goals, sin bins, rolling subs and the half-time.'),
    h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '10px', margin: '6px 0' } },
      opt('venue', ARENA_OPTS.venue, 'VENUE'), ARENA_OPTS.boards ? opt('boards', ARENA_OPTS.boards, 'HOARDINGS') : null, ARENA_OPTS.glass ? opt('glass', ARENA_OPTS.glass, 'NETS') : null,
      ARENA_OPTS.lighting ? opt('lighting', ARENA_OPTS.lighting, 'LIGHTING') : null, ARENA_OPTS.show ? opt('show', ARENA_OPTS.show, 'LIGHT SHOW') : null,
      opt('style', Object.assign({ '': 'Light style: my setting' }, ALS_STYLES), 'STYLE'),
      h('label', { style: { fontSize: '7px' } }, h('input', { type: 'checkbox', checked: A.walk, onchange: e => { A.walk = e.target.checked; } }), ' WALKOUT + LIGHT SHOW')),
    h('div', { class: 'row', style: { justifyContent: 'flex-start' } },
      h('button', { class: 'primary', onclick: () => dbgArenaMatch(dbgArenaCfg(), {}) }, 'PLAY TEST MATCH'),
      h('button', { class: 'small', onclick: () => dbgArenaMatch(dbgArenaCfg(), { inter: true }) }, 'START AT AN HALF-TIME'))));
}
function dbgArenaCfg() { const A = DBG.arena || {}; const cfg = Object.assign({}, ARENA_DEFAULT); for (const k of ['venue', 'boards', 'glass', 'lighting', 'show']) if (A[k]) cfg[k] = A[k]; return cfg; }
function dbgArenaMatch(arena, o) {
  const A = DBG.arena || {};
  if (typeof window !== 'undefined') window.ALS_STYLE = A.style || undefined;
  const teams = generateQuickTeams('DEBUG-ARENA'), a = teams[1], b = teams[4];
  clearInterval(DBG_DESK.iv);
  const back = () => { window.ALS_STYLE = undefined; go(scrDebug); };
  launchMatch({ teams: [a.ident, b.ident], home: 0, lineups: [qpLineup(a), qpLineup(b)], tac: [a.tac, b.tac], decider: 'shootout', kind: 'quick', canRestart: true, dbg: true,
    arena, fill: 0.92, noWalk: !A.walk || !!o.inter, onEnd: () => { leaveMatch(); back(); }, onQuit: back });
  if (o.inter) setTimeout(() => { try { if (S.walk && typeof endWalkout === 'function') endWalkout(); startIntermission(); } catch (e) { toast('Could not start the half-time: ' + e.message); } }, 400);
}
// extra rows for the in-game debug panel (backquote)
function dbgMatchExtras(el, btn, r) {
  const sk = t => teamSkaters(t).find(x => x.pl && x !== puck.owner && !(r && r.pens[t].some(q => q.pid === x.pl.id))) || teamSkaters(t).find(x => x.pl);
  el.appendChild(h('div', { class: 'row' },
    btn('REAL GOAL US', () => { if (S.phase !== 'live') S.phase = 'live'; scoreGoal(0); }),
    btn('REAL GOAL THEM', () => { if (S.phase !== 'live') S.phase = 'live'; scoreGoal(1); }),
    btn('2ND PENALTY US (STACKS IN BOX)', () => { if (!r || !r.pens[0].length) throw new Error('Nobody in our box yet: use PENALTY US first.'); startTimed(0, sk(0).pl, 'hook'); }),
    btn('2ND PENALTY THEM', () => { if (!r || !r.pens[1].length) throw new Error('Nobody in their box yet: use PENALTY THEM first.'); startTimed(1, sk(1).pl, 'hook'); }),
    btn('ROLLING SUB US', () => changeLine(0, 'debug')),
    btn('ROLLING SUB THEM', () => changeLine(1, 'debug'))));
  el.appendChild(h('div', { class: 'row' },
    btn('HALF-TIME NOW', () => { if (S.period >= 3) throw new Error('No half-time after the 2nd half.'); startIntermission(); }),
    btn('ALIENS EVERY BREAK: ' + (window.ALIEN_FORCE ? 'ON' : 'OFF'), () => { window.ALIEN_FORCE = !window.ALIEN_FORCE; }),
    btn('ALIEN PLAYERS NOW: ' + (S.alienTeam ? 'ON' : 'OFF'), () => { S.alienTeam = S.alienTeam ? null : { match: S.match, period: S.period }; }),
    btn('STYLE: ' + (typeof alsStyle === 'function' ? alsStyle() : '?'), () => { const ks = Object.keys(ALS_STYLES), i = ks.indexOf(alsStyle()); window.ALS_STYLE = ks[(i + 1) % ks.length]; })));
  if (r) el.appendChild(h('div', { style: { fontSize: '6px' } }, 'BOXES: ' + [0, 1].map(t => TEAM[t].abbr + ' ' + (r.pens[t].length ? '#' + r.pens[t][0].num + ' ' + Math.ceil(penTimeLeft(t)) + 's (' + r.pens[t].length + ' pen.)' : 'empty')).join(' · ') + (S.inter && S.inter.alien ? ' · ALIENS ON THE PITCH' : '')));
}
