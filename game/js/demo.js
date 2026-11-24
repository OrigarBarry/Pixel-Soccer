'use strict';
// ====================================================================
//  MAIN MENU LIVE GAME ("attract mode"): the real match engine plays a computer-vs-computer game behind
//  the main menu, with the real rink, players, arena scenery and crowd. Silent (the menu music plays),
//  never recorded anywhere, and every setting it touches is put back the moment you leave the menu.
// ====================================================================
const Demo = { on: false, saved: null, t: 0, stuckT: 0 };
const demoWanted = () => !(S.pres && S.pres.menuDemo === false);
function demoStart() {
  if (Demo.on || !demoWanted() || S.screen !== 'menu' || UI.cur !== scrMain) return false;
  if (typeof generateQuickTeams !== 'function' || typeof startMatch !== 'function') return false;
  try {
    const teams = generateQuickTeams('MENU' + ((Math.random() * 1e6) | 0));
    const a = (Math.random() * teams.length) | 0; let b = (a + 1 + ((Math.random() * (teams.length - 1)) | 0)) % teams.length;
    const A = teams[a], B = teams[b];
    Demo.saved = { autoAI: S.autoAI, cam: S.cam, pres: Object.assign({}, S.pres), firstMatch: S.firstMatch, rules: S.rules, periodLen: S.periodLen, speed: S.speed, match: S.match, assist: S.assist };
    Demo.on = true; S.demo = true; Demo.t = 0; Demo.stuckT = 0;
    S.autoAI = true; S.cam = 'WIDE'; S.rules = true; S.periodLen = 100; S.speed = 'NORMAL';
    S.pres = Object.assign({}, S.pres, { linePick: false, extraPick: false, spot: false, stars: 'OFF', hats: false, goal: 'SHORT' });
    startMatch({ teams: [A.ident, B.ident], home: 0, lineups: [qpLineup(A), qpLineup(B)], tac: [A.tac, B.tac], decider: 'shootout', kind: 'demo', demo: true, arena: typeof aiArena === 'function' ? aiArena(A.ident) : null,
      onEnd: () => { Demo.endAt = Demo.t + 180; }, onQuit: () => {} });
    S.hintT = 0;
    document.body.classList.add('demo');
    if (typeof MenuBG !== 'undefined') MenuBG.hide();
    if (typeof applySfxVolume === 'function') applySfxVolume();
    return true;
  } catch (e) { console.warn('menu demo failed', e); demoStop(); return false; }
}
function demoStop() {
  if (!Demo.on) return;
  Demo.on = false; S.demo = false;
  const sv = Demo.saved || {};
  for (const k of ['autoAI', 'cam', 'pres', 'firstMatch', 'rules', 'periodLen', 'speed', 'assist']) if (k in sv) S[k] = sv[k];
  if (typeof applyCamPref === 'function') applyCamPref(true);   // (Nov 23) the camera the player chose (or AUTO for this window), not the demo's
  S.match = sv.match || null; S.so = null; S.inter = null; Demo.endAt = 0;
  if (typeof zamboniHum === 'function') zamboniHum(false);
  leaveMatch();
  document.body.classList.remove('demo');
  if (typeof applySfxVolume === 'function') applySfxVolume();
  if (typeof crowdVoiceReset === 'function') crowdVoiceReset();
}
// every frame while the demo runs: keep it moving through stoppages, intermissions and the final horn
function demoTick() {
  if (!Demo.on) return;
  Demo.t++;
  if (UI.cur !== scrMain || !$('app').classList.contains('show')) { demoStop(); return; }
  if (S.screen === 'paused') S.screen = 'play';
  if (S.screen === 'intermission') { if (++Demo.stuckT > 60 * 7) { Demo.stuckT = 0; continueAfterMsg(); } }
  else if (S.screen === 'intro' && typeof skipIntro === 'function') skipIntro();
  else if (S.screen === 'celebrate' && typeof finishCelebration === 'function') finishCelebration();
  else if (S.screen === 'replay' && typeof replayClose === 'function') replayClose();
  else Demo.stuckT = 0;
  if (S.phase === 'ask' && typeof answerFight === 'function') answerFight(Math.random() < 0.5);
  hideDemoDom();
  if ((Demo.endAt && Demo.t > Demo.endAt) || S.screen === 'post') { if (!Demo.endAt) Demo.endAt = Demo.t + 180; if (Demo.t > Demo.endAt) { Demo.endAt = 0; demoStop(); demoStart(); } }
}
function hideDemoDom() {
  for (const id of ['linePick', 'extraPick', 'tacPick', 'replayBar']) { const el = document.getElementById(id); if (el) el.classList.remove('show'); }
  for (const id of ['ovMsg', 'ovPause', 'ovFocus']) { const el = document.getElementById(id); if (el) el.classList.remove('show'); }
}
