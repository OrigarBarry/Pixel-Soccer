'use strict';
// ====================================================================
//  GAMEPAD (Nov 22): any standard controller (Xbox, PlayStation, Switch Pro, most Bluetooth pads, Chromebooks and
//  Android TV). Buttons press the keys bound to each action, so everything the keyboard does works, rebinding
//  included. In menus: the d-pad / left stick move, A = select, B = back.
//    left stick or d-pad  skate                 A  shoot (hold to charge) · switch skater
//    X  pass / check (tap = poke, hold = hit)   B  slide tackle
//    Y  drag-back  LB  dangle   RB  roulette     LT  sprint   RT  loft (cross / chip / long ball)
//    BACK / VIEW  line change   START / MENU  pause
// ====================================================================
const PAD_MAP = { 0: 'shoot', 1: 'poke', 2: 'check', 3: 'deke', 4: 'dangle', 5: 'spin', 6: 'sprint', 7: 'loft', 8: 'line', 9: 'pause', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
const PAD_MENU = { 0: ['Enter', 'Enter'], 1: ['Escape', 'Escape'], 12: ['ArrowUp', 'ArrowUp'], 13: ['ArrowDown', 'ArrowDown'], 14: ['ArrowLeft', 'ArrowLeft'], 15: ['ArrowRight', 'ArrowRight'], 9: ['Escape', 'Escape'] };
const PAD = { prev: {}, axes: {}, on: false, seen: false, rep: {} };
const padPlaying = () => typeof S !== 'undefined' && !S.demo && !(S.match && S.match.demo) && ['play', 'paused', 'replay', 'intermission', 'intro', 'celebrate', 'outro'].includes(S.screen);
// menus: move focus through the visible buttons and fields (top pop-up first), A clicks, B goes back
function padFocusables() {
  const mods = document.querySelectorAll('.modal'), root = mods.length ? mods[mods.length - 1] : document.getElementById('app');
  return root ? [...root.querySelectorAll('button, select, a.lnk, .teamcard, .qp2side')].filter(x => x.offsetParent !== null && !x.disabled) : [];
}
function padMenu(dir) {
  const els = padFocusables(); if (!els.length) return;
  const cur = els.indexOf(document.activeElement);
  if (dir === 'ok') { const el = cur >= 0 ? els[cur] : (els.find(x => x.classList.contains('primary')) || els[0]); if (el.tagName === 'SELECT') { el.selectedIndex = (el.selectedIndex + 1) % el.options.length; el.dispatchEvent(new Event('change')); } else el.click(); return; }
  const step = dir === 'up' || dir === 'left' ? -1 : 1;
  const nx = cur < 0 ? (els.find(x => x.classList.contains('primary')) || els[0]) : els[(cur + step + els.length) % els.length];
  if (!nx.hasAttribute('tabindex') && !/BUTTON|SELECT|A/.test(nx.tagName)) nx.setAttribute('tabindex', '0');
  nx.focus({ preventScroll: false }); nx.classList.add('padfocus'); setTimeout(() => nx.classList.remove('padfocus'), 900);
}
function padKey(code, key, down) {
  if (!padPlaying() && down) { const m = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok' }[code]; if (m) return padMenu(m); } dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: key || code, bubbles: true })); }
function padAction(act, down) { const code = (Input.binds[act] || []).find(Boolean); if (code) padKey(code, null, down); }
function padTick() {
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  const gp = pads.find(p => p.mapping === 'standard') || pads[0];
  if (!gp) { if (PAD.on) { padRelease(); PAD.on = false; } return requestAnimationFrame(padTick); }
  if (!PAD.seen) { PAD.seen = true; try { toast('CONTROLLER CONNECTED · A shoot · X pass/check · B poke · Y/LB/RB feints · LT sprint · START pause', 5000); } catch (e) {} }
  PAD.on = true;
  const play = padPlaying(), now = performance.now();
  // buttons: edges only
  gp.buttons.forEach((b, i) => {
    const on = typeof b === 'object' ? b.pressed || b.value > 0.5 : b > 0.5, was = !!PAD.prev[i];
    if (on === was) { if (on && !play && PAD_MENU[i] && i >= 12 && now - (PAD.rep[i] || 0) > 180) { PAD.rep[i] = now; padKey(PAD_MENU[i][0], PAD_MENU[i][1], true); padKey(PAD_MENU[i][0], PAD_MENU[i][1], false); } return; }
    PAD.prev[i] = on;
    if (play) { if (PAD_MAP[i]) padAction(PAD_MAP[i], on); }
    else if (PAD_MENU[i]) { if (on) { PAD.rep[i] = now + 200; padKey(PAD_MENU[i][0], PAD_MENU[i][1], true); } else padKey(PAD_MENU[i][0], PAD_MENU[i][1], false); }
  });
  // left stick as a d-pad (with a dead zone)
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, dz = 0.38;
  const want = { left: ax < -dz, right: ax > dz, up: ay < -dz, down: ay > dz };
  for (const d of ['left', 'right', 'up', 'down']) {
    if (want[d] === !!PAD.axes[d]) { if (want[d] && !play && now - (PAD.rep['a' + d] || 0) > 220) { PAD.rep['a' + d] = now; const k = 'Arrow' + d[0].toUpperCase() + d.slice(1); padKey(k, k, true); padKey(k, k, false); } continue; }
    PAD.axes[d] = want[d];
    if (play) padAction(d, want[d]);
    else if (want[d]) { PAD.rep['a' + d] = now + 150; const k = 'Arrow' + d[0].toUpperCase() + d.slice(1); padKey(k, k, true); padKey(k, k, false); }
  }
  requestAnimationFrame(padTick);
}
// let go of everything (controller unplugged, or the screen changed under a held button)
function padRelease() { for (const i in PAD.prev) if (PAD.prev[i] && PAD_MAP[i]) padAction(PAD_MAP[i], false); for (const d in PAD.axes) if (PAD.axes[d]) padAction(d, false); PAD.prev = {}; PAD.axes = {}; }
addEventListener('gamepadconnected', () => { PAD.seen = false; });
addEventListener('gamepaddisconnected', () => padRelease());
requestAnimationFrame(padTick);
