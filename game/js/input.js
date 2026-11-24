'use strict';
// ====================================================================
//  INPUT: one table of gameplay actions, each with up to two keys.
//  Gameplay asks about actions ('pass', 'deke'...), never about keys.
//  Uses physical key codes, so ShiftLeft and ShiftRight are different keys.
// ====================================================================
const ACTIONS = [
  // id, label, group (actions in different groups may share a key: they never happen at the same time)
  ['up', 'Run up', 'move'], ['down', 'Run down', 'move'], ['left', 'Run left', 'move'], ['right', 'Run right', 'move'],
  ['shoot', 'Shoot (hold to charge) · first-time shot · switch player', 'skater'],
  ['check', 'PASS / TACKLE · with the ball: pass · without: tap = poke (or steal a pass going by your boot), hold = shoulder charge · keeper: tap = short pass, hold = aim & power', 'skater'],
  ['poke', 'SLIDE TACKLE: go to ground for the ball (get the ball first or it is a foul)', 'skater'],
  ['loft', 'LOFT · with the ball: cross to the man in the box, chip the keeper (near goal, facing it), or a long ball over the top', 'skater'],
  ['sprint', 'Sprint on / off (toggle; burns stamina)', 'skater'],
  ['deke', 'Drag-back: move the ball to your other side (strong foot / weak foot) and keep it there · hold = close control', 'skater'],
  ['dangle', 'Dangle: the juke · fake past the man in front (shoot during it for a quick shot)', 'skater'],
  ['spin', 'Roulette: read a big tackle and spin around it (risky if you guess wrong)', 'skater'],
  ['line', 'Call a rolling sub', 'skater'],
  ['cover', 'Keeper: kick it long (punt upfield)', 'goalie'],
  ['line1', 'Coach: line 1 at the next kickoff', 'coach'], ['line2', 'Coach: line 2 at the next kickoff', 'coach'], ['line3', 'Coach: line 3 at the next kickoff', 'coach'],
  ['timeout', 'Call a timeout (at a stoppage · 3 per game)', 'coach'], ['pull', 'Pull the keeper / send him back', 'coach'], ['extra', '4th player: hold the kickoff to choose (man advantage / extra attacker)', 'coach'], ['pick4', 'Coach: 4th option in a chooser', 'coach'],
  ['fight', 'Challenge to a scuffle (stoppages, after a dirty hit)', 'coach'], ['fightYes', 'Accept a scuffle', 'fightans'], ['fightNo', 'Refuse a scuffle', 'fightans'],
  ['pause', 'Pause', 'general'], ['help', 'Controls cheat sheet (opens it any time in a game)', 'general'],
  ['fullscreen', 'Fullscreen', 'general'],
];
const ACTION_GROUP = Object.fromEntries(ACTIONS.map(a => [a[0], a[2]]));
const DEFAULT_BINDS = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  shoot: ['Space', null], check: ['ShiftLeft', 'ShiftRight'], poke: ['KeyV', null], loft: ['KeyE', null], sprint: ['KeyC', 'Numpad0'],
  deke: ['KeyQ', null], line: ['KeyR', null], line1: ['Digit1', null], line2: ['Digit2', null], line3: ['Digit3', null], cover: ['KeyZ', 'Enter'], pull: [null, null], timeout: ['KeyH', null], extra: ['KeyX', null], pick4: ['Digit4', null], fight: [null, null], fightYes: [null, null], fightNo: [null, null], pause: ['Escape', 'KeyP'], fullscreen: ['Backquote', null], help: ['Slash', null], dangle: ['KeyF', null], spin: ['KeyZ', null],
};
// keys are read by position (so the layout feels the same everywhere), but shown by the letter printed on the
// player's own keyboard: on a French AZERTY keyboard the deke key is labelled A, not Q
let KEY_LAYOUT = null;
try { if (navigator.keyboard && navigator.keyboard.getLayoutMap) navigator.keyboard.getLayoutMap().then(m => { KEY_LAYOUT = m; }).catch(() => {}); } catch (e) {}
function keyName(code) {
  if (!code) return '—';
  const m = { Space: 'SPACE', ShiftLeft: 'LEFT SHIFT', ShiftRight: 'RIGHT SHIFT', ControlLeft: 'LEFT CTRL', ControlRight: 'RIGHT CTRL', AltLeft: 'LEFT ALT', AltRight: 'RIGHT ALT',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'ESC', Enter: 'ENTER', Backspace: 'BKSP', Tab: 'TAB', CapsLock: 'CAPS',
    Slash: '/', Backslash: '\\', Period: '.', Comma: ',', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: 'TILDE',
    MetaLeft: 'LEFT META', MetaRight: 'RIGHT META', ContextMenu: 'MENU' };
  if (m[code]) return m[code];
  if (KEY_LAYOUT && KEY_LAYOUT.get(code)) return String(KEY_LAYOUT.get(code)).toUpperCase();   // the letter printed on THIS keyboard
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6).toUpperCase();
  return code.toUpperCase();
}
const Input = {
  binds: null, held: {}, heldAt: {}, map: {},
  load() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('psbk-controls') || 'null'); } catch (e) {}
    this.binds = {};
    for (const [id] of ACTIONS) {
      const s = saved && Array.isArray(saved[id]) ? saved[id] : DEFAULT_BINDS[id];
      this.binds[id] = [s[0] || null, s[1] || null];
    }
    // later default additions: give them to older saved layouts when the key is still free
    if (saved && !this.binds.sprint[1] && !Object.values(this.binds).some(b => b.includes('Numpad0'))) this.binds.sprint[1] = 'Numpad0';
    // the dangle and spin keys arrived later: an older layout with fullscreen still on F hands F to the dangle
    if (saved && !saved.dangle) {
      if (this.binds.fullscreen[0] === 'KeyF' && !this.binds.fullscreen[1]) this.binds.fullscreen = ['Backquote', null];
      const used = c => Object.entries(this.binds).some(([id, b]) => id !== 'dangle' && id !== 'spin' && ACTION_GROUP[id] !== 'goalie' && b.includes(c));
      this.binds.dangle = used('KeyF') ? [null, null] : ['KeyF', null];
      this.binds.spin = used('KeyZ') ? [null, null] : ['KeyZ', null];
    }
    // one PASS / CHECK key (both Shifts): the separate Pass key is gone. Older layouts: Right Shift moves from the deke to it
    let v = 1; try { v = +(localStorage.getItem('psbk-controls-v') || 1); } catch (e) {}
    if (saved && v < 2) {
      if (this.binds.deke[1] === 'ShiftRight') this.binds.deke[1] = null;
      if (!Object.values(this.binds).some(b => b.includes('ShiftRight')) && !this.binds.check[1]) this.binds.check[1] = 'ShiftRight';
      try { localStorage.setItem('psbk-controls-v', '2'); localStorage.setItem('psbk-controls', JSON.stringify(this.binds)); } catch (e) {}
    } else if (!saved) { try { localStorage.setItem('psbk-controls-v', '2'); } catch (e) {} }
    this.rebuild();
  },
  save() { try { localStorage.setItem('psbk-controls', JSON.stringify(this.binds)); } catch (e) {} this.rebuild(); },
  rebuild() {
    this.map = {};
    for (const [id] of ACTIONS) for (const c of this.binds[id]) if (c) (this.map[c] = this.map[c] || []).push(id);
  },
  reset() { this.binds = JSON.parse(JSON.stringify(DEFAULT_BINDS)); this.save(); },
  actionsFor(code) { return this.map[code] || []; },
  // who else uses this key? -> [{id, shared}] shared = allowed context reuse
  conflicts(action, code) {
    const out = [];
    for (const [id] of ACTIONS) {
      if (id === action || !this.binds[id].includes(code)) continue;
      const ga = ACTION_GROUP[action], gb = ACTION_GROUP[id];
      out.push({ id, shared: (ga === 'goalie' && gb === 'skater') || (ga === 'skater' && gb === 'goalie') });
    }
    return out;
  },
  bind(action, slot, code) { this.binds[action][slot] = code; if (slot === 0 && !code && this.binds[action][1]) { this.binds[action] = [this.binds[action][1], null]; } this.save(); },
  unbindEverywhere(code, except) { for (const [id] of ACTIONS) if (id !== except) this.binds[id] = this.binds[id].map(c => c === code ? null : c); },
  label(action, sep = ' / ') { const b = (this.binds[action] || []).filter(Boolean); return b.length ? b.map(keyName).join(sep) : 'UNBOUND'; },
  first(action) { const b = (this.binds[action] || []).filter(Boolean); return b.length ? keyName(b[0]) : '—'; },
  // ---- live state
  keyDown(code) { if (!this.held[code]) { this.held[code] = true; this.heldAt[code] = performance.now(); } return this.actionsFor(code); },
  keyUp(code) { this.held[code] = false; return this.actionsFor(code); },
  down(action) { const b = this.binds[action]; return !!this.vheld[action] || !!(b && ((b[0] && this.held[b[0]]) || (b[1] && this.held[b[1]]))); },
  // ---- other input devices (gamepad / touch): they drive actions, never keys. setVirtual = hold state, press = one tap.
  vheld: {},
  setVirtual(action, on) { this.vheld[action] = !!on; },
  press(action) { const code = (this.binds[action] || []).find(Boolean); if (code) { dispatchEvent(new KeyboardEvent('keydown', { code })); setTimeout(() => dispatchEvent(new KeyboardEvent('keyup', { code })), 60); } },
  heldMs(action) {
    let t = 0; const now = performance.now();
    for (const c of this.binds[action] || []) if (c && this.held[c]) t = Math.max(t, now - this.heldAt[c]);
    return t;
  },
  clear() { for (const k in this.held) this.held[k] = false; this.vheld = {}; },
  allCodes() { return Object.keys(this.map); },
};
Input.load();
