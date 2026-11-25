'use strict';
// ====================================================================
//  COACH (Nov 22): your first games teach themselves.
//  One tip at a time, at the moment it matters (you just got the puck, a carrier is coming at you, a pass is on
//  its way to you...). Each tip retires once you have done the thing twice, or after it has been shown three times.
//  Dekes are only introduced after your first goal. Settings > PRESENTATION: COACH TIPS on/off (and reset).
//  Also here: your very first Quick Play game is EASY with one-minute periods, and every difficulty picker says
//  what the level changes.
// ====================================================================
const COACH_TIPS = {
  carry:   { need: 2, text: () => `YOU HAVE THE BALL: hold ${CK('shoot')} to wind up, let go to shoot. ${CK('check')} passes.` },
  defend:  { need: 2, text: () => `HE'S COMING AT YOU: tap ${CK('check')} to poke the ball away, hold it to make a tackle.` },
  switch:  { need: 2, text: () => `THEY HAVE IT: ${CK('shoot')} switches you to the player nearest the ball.` },
  onetimer:{ need: 2, text: () => `PASS COMING TO YOU: hold ${CK('shoot')} as it arrives for a first-time shot.` },
  sprint:  { need: 1, text: () => `${CK('sprint')} turns sprint on and off. It burns stamina: tired players slow down.` },
  tired:   { need: 1, text: () => `YOUR LINE IS TIRED: press ${CK('line')} for a rolling sub (it waits until it's safe).` },
  deke:    { need: 2, after: 'goal', text: () => `DEFENDER IN FRONT? ${CK('dangle')} = dangle (fake him out) · ${CK('deke')} = drag-back · ${CK('spin')} = spin away from a hit.` },
};
const CK = a => (typeof Input !== 'undefined' && Input.label ? Input.label(a).split(' / ')[0] : a.toUpperCase());
const coachData = () => { const q = qpProg(); q.coach = q.coach || { n: {}, done: {}, on: true }; return q.coach; };
const coachOn = () => { const c = coachData(); return c.on !== false && Object.keys(COACH_TIPS).some(k => !c.done[k]); };
const C2 = { cur: null, t: 0, cool: 0, last: {} };
function coachDone(k, by = 1) {
  const c = coachData(); if (c.done[k]) return;
  c.n[k] = (c.n[k] || 0) + by; if (c.n[k] >= COACH_TIPS[k].need) { c.done[k] = Date.now(); if (C2.cur === k) C2.t = Math.min(C2.t, 40); }
  PROFILE.dirty = true;
}
const coachLive = () => S.screen === 'play' && S.match && !S.autoAI && !S.match.demo && !S.match.test && !S.spectate && !S.so && coachOn() && !(S.mode && (S.mode.kind === 'drill' && isFightDrill(S.mode)));
function coachPick() {
  const c = coachData(), me = ctrl; if (!me || me.g || S.phase !== 'live') return null;
  const open = k => !c.done[k] && (c.shown || {})[k] !== -1 && (!COACH_TIPS[k].after || c.done[COACH_TIPS[k].after] || qpHas('firstgoal')) && ((c.shown || {})[k] || 0) < 3;
  if (puck.owner === me) {
    const d = typeof teamSkaters === 'function' ? teamSkaters(1).some(o => Math.hypot(o.x - me.x, o.y - me.y) < 34) : false;
    if (d && open('deke') && qpHas('firstgoal')) return 'deke';
    if (open('carry')) return 'carry';
    return null;
  }
  if (puck.passTarget === me && open('onetimer')) return 'onetimer';
  const own = puck.owner;
  if (own && own.team === 1 && !own.g) {
    const dd = Math.hypot(own.x - me.x, own.y - me.y);
    if (dd < 46 && open('defend')) return 'defend';
    if (dd > 120 && open('switch')) return 'switch';
  }
  if (S.t > 60 * 45 && open('sprint') && !S.sprintOn) return 'sprint';
  if (me.pl && typeof stamOf === 'function' && stamOf(me) < 35 && open('tired')) return 'tired';
  return null;
}
function coachTick() {
  if (!coachLive()) { C2.cur = null; return; }
  if (C2.cur) { if (--C2.t <= 0) { C2.cur = null; C2.cool = 150; } return; }
  if (C2.cool > 0) { C2.cool--; return; }
  const k = coachPick(); if (!k) return;
  const c = coachData(); c.shown = c.shown || {}; c.shown[k] = (c.shown[k] || 0) + 1; PROFILE.dirty = true;
  if (c.shown[k] >= 3 && !c.done[k]) c.done[k] = Date.now();                 // shown enough: retire it
  C2.cur = k; C2.t = 300;
}
function coachDraw() {
  if (!C2.cur || !coachLive()) return;
  if (S.phase === 'goal' || S.goalCard) return;                     // (Nov 23) the goal card sits there
  if (typeof jbVisible === 'function' && jbVisible()) return;         // (Nov 23 UI) or the replay screen is down over it
  // (Nov 24 nightly) sized from the real text widths: long tips ran out of the bar and into the COACH label.
  // A tip too long for one line wraps onto two (the bar grows upward), so nothing is ever cut off.
  const msg = COACH_TIPS[C2.cur].text(), SW = viewW(), lw = textW('COACH', 4) + 10, room = SW - 16 - lw - 14;
  let lines = [msg];
  if (textW(msg, 5) > room) {
    const ws = msg.split(' '); let best = null;
    for (let k = 1; k < ws.length; k++) { const l1 = ws.slice(0, k).join(' '), l2 = ws.slice(k).join(' '), m = Math.max(textW(l1, 5), textW(l2, 5)); if (!best || m < best.m) best = { m, l: [l1, l2] }; }
    if (best) lines = best.l;
  }
  const fs = Math.max(...lines.map(l => textW(l, 5))) <= room ? 5 : 4, bh = lines.length > 1 ? 23 : 15,
    w = Math.min(SW - 16, Math.max(...lines.map(l => textW(l, fs))) + lw + 14), x = SW / 2 - w / 2, y = HUDH + viewH() - 15 - bh;
  const a = Math.min(1, C2.t / 20);
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(11,14,30,.9)'; ctx.fillRect(x, y, w, bh);
  ctx.fillStyle = '#5ee07a'; ctx.fillRect(x, y, 2, bh);
  text('COACH', x + 6, y + bh / 2 - 2.5, '#5ee07a', 4, 'left', null);
  ctx.beginPath(); ctx.rect(x + lw, y, w - lw - 4, bh); ctx.clip();
  lines.forEach((l, k) => text(l, x + lw + 2, y + (fs === 5 ? 5 : 5.5) + k * 8, '#ffffff', fs, 'left', null));
  ctx.restore();
}
{ const _dmh = drawModeHud; drawModeHud = function () { const r = _dmh.apply(this, arguments); try { coachDraw(); } catch (e) {} return r; }; }
{ const _up = update; update = function () { const r = _up.apply(this, arguments); try { coachTick(); } catch (e) {} return r; }; }
// doing the thing retires the tip
{ const _sh = shoot; shoot = function (p) { if (p === ctrl && p && p.team === 0 && !S.autoAI) { coachDone('carry'); if (puck.passTarget === p || (S.t - (p.recvT || -999) < 20)) coachDone('onetimer'); } return _sh.apply(this, arguments); }; }
{ const _sp = statPossess; statPossess = function (p, passer) { if (passer === ctrl && passer && passer.team === 0 && p.team === 0 && !S.autoAI) coachDone('carry'); return _sp.apply(this, arguments); }; }
{ const _de = defEvent; defEvent = function (p) { if (p === ctrl && p && p.team === 0 && !S.autoAI) coachDone('defend'); return _de.apply(this, arguments); }; }
{ const _ce = clipEvent; clipEvent = function (kind, o) { if (kind === 'deke' && ctrl && ctrl.pl && o && o.team === 0 && (o.players || []).includes(ctrl.pl.id)) coachDone('deke'); return _ce.apply(this, arguments); }; }
{ let lastCtrl = null; const _up2 = update; update = function () { const r = _up2.apply(this, arguments); if (S.screen === 'play' && ctrl && lastCtrl && ctrl !== lastCtrl && ctrl.team === 0 && puck.owner && puck.owner.team === 1) coachDone('switch'); lastCtrl = ctrl; if (S.sprintOn) coachDone('sprint'); if (input.linePressed) coachDone('tired'); return r; }; }

// ---------- the very first Quick Play game: EASY, one-minute periods, and you are the favourite
const qpFirstTimer = () => !(qpProg().n.games > 0);
{ const _qs = qpStart;
  qpStart = function (teams, spectate) {
    if (!spectate && qpFirstTimer() && !UI.qpFirstDone) {
      UI.qpFirstDone = true;
      const keep = S.periodLen; S.periodLen = 60;
      const r = _qs.apply(this, arguments);
      if (S.match) { const end = S.match.onEnd, quit = S.match.onQuit; S.match.onEnd = res => { S.periodLen = keep; end(res); }; S.match.onQuit = () => { S.periodLen = keep; quit(); }; }
      try { floaters.push({ x: CX, y: CY - 30, text: 'FIRST GAME: ONE-MINUTE HALVES', life: 200, color: '#5ee07a' }); } catch (e) {}
      return r;
    }
    return _qs.apply(this, arguments);
  }; }

// ---------- what each difficulty changes (shown wherever you pick one)
const DIFF_BLURB = {
  EASY: 'EASY: a slower CPU that tackles less, a weaker CPU keeper, no tactics. Best to start.',
  NORMAL: 'NORMAL: an even game; tactics matter; "!" warns you before a CPU shoulder charge.',
  HARD: 'HARD: the CPU reacts twice as fast, tackles more, sharper keeper, no "!" warning.',
};
function diffNote(d) { return h('div', { class: 'modetxt hkdiff' }, DIFF_BLURB[d] || ''); }
{ const _qp = scrQuickPlay;
  scrQuickPlay = function () {
    if (!UI.qpDiff && qpFirstTimer()) UI.qpDiff = 'EASY';
    const node = _qp.apply(this, arguments);
    try {
      // only touch the page when the note is missing or out of date: replacing it every time is itself a change the
      // observer below sees, which looped forever on the EXHIBITION tab and froze the screen (fixed Nov 22)
      const fix = () => { const opts = node.querySelector('.qp2opts'); if (!opts) return;
        const want = qpFirstTimer() ? 'FIRST GAME: EASY, one-minute halves, and you get the strongest team.' : (DIFF_BLURB[UI.qpDiff || 'NORMAL'] || '');
        const old = node.querySelector('.hkdiff');
        if (old && old.previousElementSibling === opts && old.textContent === want) return;
        if (old) old.remove();
        const note = diffNote(UI.qpDiff || 'NORMAL'); note.textContent = want;
        opts.after(note); };
      fix(); new MutationObserver(fix).observe(node.querySelector('.qp2') || node, { childList: true });
    } catch (e) {}
    return node;
  }; }

// ---------- Settings: COACH TIPS on / off / again
{ const _ss = scrSettings;
  scrSettings = function () {
    const node = _ss.apply(this, arguments);
    try {
      const c = coachData(), left = Object.keys(COACH_TIPS).filter(k => !c.done[k]).length;
      const row = h('div', { class: 'panel hkcoachset', style: { padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '8px' } },
        h('b', { style: { flex: 1 } }, 'COACH TIPS', h('span', { class: 'muted', style: { fontSize: '7px' } }, ' · ' + (left ? left + ' of ' + Object.keys(COACH_TIPS).length + ' still to show' : 'all learned'))),
        h('button', { class: 'small' + (c.on !== false ? ' sel' : ''), onclick: () => { c.on = c.on === false; PROFILE.dirty = true; go(scrSettings); } }, c.on !== false ? 'ON' : 'OFF'),
        h('button', { class: 'small ghost', onclick: () => { c.n = {}; c.done = {}; c.shown = {}; c.on = true; PROFILE.dirty = true; toast('Coach tips will show again.'); go(scrSettings); } }, 'SHOW THEM AGAIN'));
      const anchor = node.querySelector('.tabbody') || node.lastElementChild; if (anchor) anchor.parentNode.insertBefore(row, anchor);
    } catch (e) {}
    return node;
  }; }
// the new-franchise difficulty row says what it means too
{ const _nf = scrNewFranchise;
  scrNewFranchise = function () {
    const node = _nf.apply(this, arguments);
    try { const row = node.querySelector('.nfdiff'); if (row) row.title = DIFF_BLURB[S.diff] || '';  } catch (e) {}
    return node;
  }; }
