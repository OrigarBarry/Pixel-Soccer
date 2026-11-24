'use strict';
// ====================================================================
//  THE ALIEN ICE CREW (a secret). Now and then the house lights cut out between periods, the fans' phones come up,
//  portals open at the ends of the rink and six little saucers come through. Each one takes a lane, sweeps it end to
//  end and back with a green scanner beam that leaves the ice like new, then they slip back through and the lights
//  come up. Same length as a Zamboni lap.
//  Unlocks (account-wide, PROFILE.secrets; never on Easy, never in demo or test games):
//    LIGHTS OUT: win by 5 or more while your goalie gets the shutout (quick play or franchise)
//    PURE CHANCE: about 1 intermission in 150 they show up anyway; seeing them unlocks them
//  Once unlocked: PROFILE.alienMode 'off' | 'some' (about 1 intermission in 5) | 'every' (quick play only)
// ====================================================================
const ALIEN = { lanes: 6, chance: 1 / 150, some: 0.2, alt: 30 };
function alienSecrets() { if (!PROFILE.secrets) PROFILE.secrets = {}; return PROFILE.secrets; }
const alienUnlocked = () => !!(PROFILE && PROFILE.secrets && PROFILE.secrets.aliens) || (typeof dbgUnlockAll === 'function' && dbgUnlockAll());
function alienGrant(key, label) {
  const s = alienSecrets(), fresh = !s.aliens;
  if (!s[key]) s[key] = { at: Date.now() };
  if (fresh) s.aliens = { at: Date.now(), from: key };
  PROFILE.dirty = true;
  if (fresh && typeof toast === 'function') setTimeout(() => toast('SECRET UNLOCKED: ' + label + '. The Alien Grounds Crew is in your Trophy Rooms.', 5200), 600);
  return fresh;
}
// a real game, played by a person, not on Easy
function alienEligible() {
  return !!(S.match && !S.demo && !S.match.demo && !S.match.test && !S.match.dbg && S.diff !== 'EASY' && !(S.mode && !S.mode.game)
    && !(S.match.season && typeof UI !== 'undefined' && UI.save && UI.save.debug && UI.save.debug.modified));   // (debug-modified franchises can't earn secrets)
}
// called as an intermission starts: do they come this time?
function alienPick() {
  if (typeof window !== 'undefined' && window.ALIEN_FORCE && S.match && !S.demo && !S.match.demo) return 'force';   // debug: every intermission
  if (!alienEligible()) return null;
  if (alienUnlocked()) {
    const m = PROFILE.alienMode || 'some';
    if (m === 'off') return null;
    if (m === 'every' && S.match.kind === 'quick') return 'mode';
    return Math.random() < ALIEN.some ? 'mode' : null;
  }
  return Math.random() < ALIEN.chance ? 'chance' : null;
}
// LIGHTS OUT, checked at the final horn (the user is always team 0)
function alienCheckLightsOut() {
  if (!alienEligible() || S.mode) return;
  if (S.score[1] === 0 && S.score[0] - S.score[1] >= 5) alienGrant('lightsout', 'LIGHTS OUT');
}
function alienStart(I, why) {
  const Z = I.zam; let len = 0;
  for (let i = 1; i < Z.path.length; i++) len += hyp(Z.path[i].x - Z.path[i - 1].x, Z.path[i].y - Z.path[i - 1].y);
  const lw = (R.r - R.l) / ALIEN.lanes, ufos = [];
  const heads = ['#7be36a', '#5fd88a', '#a6e85a', '#6ad6c0', '#8ee07a', '#4fcf9a'];
  const order = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5);
  for (let i = 0; i < ALIEN.lanes; i++) {
    const top = i % 2 === 0, x = R.l + lw * (i + 0.5);
    ufos.push({ i, x0: x, x, top, y0: top ? R.t + 30 : R.b - 30, y1: top ? R.b - 30 : R.t + 30, y: top ? R.t + 30 : R.b - 30, s: 0, por: 0, d: order[i] * 0.011,
      head: heads[i], ant: Math.random() < 0.6, wave: Math.random() < 0.5, ph: Math.random() * 6 });
  }
  Z.alien = true;
  if (why === 'chance') I.alienChance = true;
  // somebody saw something: the desk will be talking about it tomorrow
  if (typeof UI !== 'undefined' && UI.save && S.match && S.match.season && typeof deskDay === 'function') UI.save.ufo = { day: deskDay(UI.save) };
  return { f: 0, D: Math.max(900, len / ZAM_SPEED * 1.2), lw, ufos, lit: false };
}
const alienEase = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
function alienTick(I) {
  const A = I.alien, Z = I.zam;
  A.f += 1 / SPEEDS[S.speed];
  const p = A.f / A.D, t = S.t;
  for (const u of A.ufos) {
    const d = u.d, a = 0.17 + d, b = 0.8 + d;
    u.por = p < 0.06 + d ? 0 : p < 0.12 + d ? alienEase((p - 0.06 - d) / 0.06) : p < b + 0.03 ? 1 : 1 - alienEase((p - b - 0.03) / 0.05);
    u.s = p < 0.11 + d ? 0 : p < a ? alienEase((p - 0.11 - d) / (a - 0.11 - d)) : p < b ? 1 : 1 - alienEase((p - b) / 0.05);
    const q = clamp((p - a) / (b - a), 0, 1), k = q < 0.5 ? alienEase(q * 2) : alienEase(2 - q * 2);
    u.y = u.y0 + (u.y1 - u.y0) * k;
    u.x = u.x0 + Math.sin(t * 0.05 + u.ph) * 2.5 * (q > 0 && q < 1 ? 1 : 0);
    u.beam = q > 0 && q < 1 && u.s > 0.9;
    if (u.beam) {
      const r = A.lw * 0.6;
      if (marksCtx) { marksCtx.save(); marksCtx.globalCompositeOperation = 'destination-out'; marksCtx.beginPath(); marksCtx.arc(u.x, u.y, r, 0, Math.PI * 2); marksCtx.fill(); marksCtx.restore(); }
      if (wetCtx) {
        wetCtx.save(); roundRectPath(wetCtx, R.l, R.t, R.r - R.l, R.b - R.t, R.cr); wetCtx.clip();
        wetCtx.fillStyle = 'rgba(225,242,255,0.05)'; wetCtx.beginPath(); wetCtx.arc(u.x, u.y, r - 2, 0, Math.PI * 2); wetCtx.fill(); wetCtx.restore();
      }
      if ((t + u.i) % 5 === 0) particles.push({ x: u.x + rand(-r, r) * 0.7, y: u.y + rand(-r, r) * 0.5, vx: rand(-0.15, 0.15), vy: -rand(0.2, 0.6), life: rand(14, 26), color: 'rgba(140,255,180,.9)' });
    }
  }
  if (p >= 0.22 && I.alienChance && !A.granted) {               // seen them? (once they're through the portals) they're yours
    A.granted = true;
    if (alienGrant('chance', 'PURE CHANCE')) floaters.push({ text: 'SECRET UNLOCKED', x: CX, y: Z.y - 20, color: '#8dffb0', big: true, life: 220 });
  }
  if (p >= 0.95) A.lit = true;
  if (p >= 1 && !Z.done) { Z.done = true; alienHum(false); }
  // the camera keeps the first saucer in view (the one that starts at the far end)
  const u0 = A.ufos[0]; Z.x = CX; Z.y = u0.y; Z.dx = 0; Z.dy = 0;
  if (A.f > 4 && !A.hum && !Z.done) { A.hum = true; alienHum(true); }
}
// ---------- ALIEN SKATERS (a hidden secret inside the secret). After the Alien Ice Crew has done the ice, there's a
// 1-in-10 chance your own team skates back out as aliens: green faces, big black eyes, antennae out the top of the
// helmet. They stay that way for the period and are back to normal at the next intermission (or the final horn).
// Never mentioned anywhere until it has happened to you once; after that the Secrets room has an ON/OFF switch.
const ALIEN_TEAM = { chance: 0.10, skin: '#7be36a', skinD: '#4fae48', tip: '#ff5ad1' };
const alienTeamSeen = () => !!(PROFILE && PROFILE.secrets && PROFILE.secrets.alienTeam);
// true while team t (the user is always team 0) is the aliens this period
function alienTeamOn(t) { return t === 0 && !!S.alienTeam && S.alienTeam.match === S.match && S.screen !== 'post'; }
function alienTeamClear() { S.alienTeam = null; }
// called as the period after an intermission starts
function alienTeamRoll(I) {
  if (!I || !I.alien || !S.match) return;
  const force = typeof window !== 'undefined' && window.ALIEN_TEAM_FORCE;
  if (!force && !alienEligible()) return;
  if (alienTeamSeen() && PROFILE.alienTeam === 'off') return;
  if (!force && Math.random() >= ALIEN_TEAM.chance) return;
  S.alienTeam = { match: S.match, period: S.period };
  if (!alienTeamSeen() && alienEligible()) {      // (a debug or test match doesn't unlock it)
    alienSecrets().alienTeam = { at: Date.now() }; PROFILE.dirty = true;
    if (typeof toast === 'function') setTimeout(() => toast('SECRET UNLOCKED: ALIEN PLAYERS. Something came back out of that tunnel... (switch it in Trophy Rooms > Secrets)', 6000), 2600);
  }
}
// drawn over a skater's face and helmet (sprite space, as drawHead): big eyes and two antennae
function alienSkaterHead(p, ln, back) {
  const blink = (S.t + (p.num || 0) * 7) >> 3 & 1;
  if (!back) {
    const e = p.fx > 0.3 ? 1 : p.fx < -0.3 ? -1 : 0;
    ctx.fillStyle = ALIEN_TEAM.skin; px(-4 + ln, -24, 8, 2);
    ctx.fillStyle = '#0b0c10'; px(-3 + ln + e, -24, 2, 2); px(1 + ln + e, -24, 2, 2);
    ctx.fillStyle = '#ffffff'; px(-3 + ln + e, -24, 1, 1); px(1 + ln + e, -24, 1, 1);
  }
  ctx.fillStyle = ALIEN_TEAM.skinD; px(-3 + ln, -32, 1, 3); px(2 + ln, -32, 1, 3);
  ctx.fillStyle = blink ? ALIEN_TEAM.tip : '#8a2a70'; px(-4 + ln, -33, 2, 1); px(2 + ln, -33, 2, 1);
}
// the goalie keeps his mask on; the antennae come out the top of it, and his eyes glow through the cage
function alienGoalieHead(p, back) {
  const blink = (S.t >> 3) & 1;
  ctx.fillStyle = ALIEN_TEAM.skinD; px(-3, -39, 1, 3); px(2, -39, 1, 3);
  ctx.fillStyle = blink ? ALIEN_TEAM.tip : '#8a2a70'; px(-4, -40, 2, 1); px(2, -40, 2, 1);
  if (!back) { ctx.fillStyle = '#8dffb0'; px(-2, -32, 1, 1); px(1, -32, 1, 1); }
}
// pools of green light under each saucer (the arena light map draws them; see alsPaintStyled)
function alienLights() {
  const A = S.inter && S.inter.alien; if (!A) return [];
  const out = [];
  for (const u of A.ufos) {
    if (u.s > 0.2) out.push({ x: u.x, y: u.y, r: A.lw * 0.62 * u.s, col: '#8dffb0', k: 0, rx: u.x, ry: u.y - ALIEN.alt - 12, i: u.i });
    if (u.por > 0.05) out.push({ x: u.x, y: u.top ? R.t + 30 : R.b - 30, r: 20 * u.por, col: '#c08aff', k: 0, rx: u.x, ry: (u.top ? R.t + 30 : R.b - 30) - 1, i: u.i + 6 });
  }
  return out;
}
// drawn after the light map (worldFx), so the portals and the saucers glow in the dark; on every canvas
function alienDraw(near) {
  const A = S.inter && S.inter.alien; if (!A) return;
  const t = S.t;
  for (const u of A.ufos) {
    if (near && !near(u.x)) continue;
    if (u.por > 0.02) {                                         // the portal, flat on the ice at the lane's end
      const py = u.top ? R.t + 30 : R.b - 30, r = 22 * u.por;
      toWorld(); ctx.save();
      ctx.fillStyle = 'rgba(6,2,18,.92)'; ctx.beginPath(); ctx.ellipse(u.x, py, r * 0.8, r * 0.36, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 4; k++) {
        const rr = r * (1 - k * 0.17), col = k % 2 ? '90,255,200' : '176,124,255';
        ctx.strokeStyle = `rgba(${col},${0.75 - k * 0.12})`; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.ellipse(u.x, py, rr, rr * 0.42, 0, t * 0.09 * (k % 2 ? -1 : 1) + k, t * 0.09 * (k % 2 ? -1 : 1) + k + Math.PI * 1.4); ctx.stroke();
      }
      ctx.fillStyle = `rgba(176,124,255,${0.18 * u.por})`; ctx.beginPath(); ctx.ellipse(u.x, py, r * 1.3, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (u.s > 0.02) alienSaucer(u, t);
  }
  toWorld();
}
function alienSaucer(u, t) {
  const bob = Math.sin(t * 0.07 + u.ph) * 1.5, h = ALIEN.alt * u.s + bob;
  if (u.beam) {                                                 // the scanner: a bright line sweeping across the beam's footprint
    toWorld(); ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const r = S.inter.alien.lw * 0.55, sy = u.y + Math.sin(t * 0.18 + u.ph) * r * 0.45, w = Math.sqrt(Math.max(0, 1 - ((sy - u.y) / (r * 0.6)) ** 2)) * r;
    ctx.fillStyle = 'rgba(140,255,180,.55)'; ctx.fillRect(u.x - w, sy - 0.4, w * 2, 0.8);
    ctx.fillStyle = 'rgba(140,255,180,.12)'; ctx.fillRect(u.x - w, sy - 2, w * 2, 4);
    ctx.restore();
  }
  toPSprite(u.x, u.y - h);
  ctx.scale(1.25 * u.s, 1.25 * u.s);
  const Rr = (x, y, w, hh, c) => { ctx.fillStyle = c; px(x, y, w, hh); };
  const blink = (t >> 3) & 1, hd = u.head, hdD = shade(hd, -0.3);
  // the alien, behind the glass
  if (u.ant) { Rr(0, -17, 1, 4, hdD); Rr(-1, -18, 3, 2, blink ? '#ff5ad1' : '#8a2a70'); }
  Rr(-4, -13, 9, 8, hd); Rr(-5, -12, 11, 5, hd); Rr(-3, -14, 7, 1, hd);
  Rr(-4, -11, 3, 3, '#0b0c10'); Rr(2, -11, 3, 3, '#0b0c10'); Rr(-3, -11, 1, 1, '#ffffff'); Rr(3, -11, 1, 1, '#ffffff');
  Rr(0, -7, 1, 1, hdD);
  if (u.wave && ((t >> 4) % 4 === 0)) { Rr(5, -10, 2, 1, hd); Rr(6, -12, 1, 2, hd); }
  // the glass dome
  for (let yy = -16; yy <= -4; yy++) {
    const hw = Math.round(10 * Math.sqrt(Math.max(0, 1 - ((yy + 4) / 13) ** 2)));
    if (hw <= 0) continue;
    Rr(-hw, yy, hw * 2 + 1, 1, 'rgba(150,255,210,.28)');
    Rr(-hw, yy, 1, 1, 'rgba(200,255,230,.6)'); Rr(hw, yy, 1, 1, 'rgba(120,200,180,.5)');
  }
  Rr(-6, -14, 2, 1, 'rgba(255,255,255,.75)'); Rr(-7, -13, 1, 2, 'rgba(255,255,255,.6)');
  // the disc
  const rows = [[-3, 15, '#e3e8f0'], [-2, 19, '#cfd5e0'], [-1, 22, '#b4bccb'], [0, 23, '#9aa3b5'], [1, 23, '#8a93a6'], [2, 21, '#6d7488'], [3, 17, '#545a6e'], [4, 10, '#3f4558']];
  for (const [yy, hw, c] of rows) Rr(-hw, yy, hw * 2 + 1, 1, c);
  Rr(-23, 0, 1, 2, '#3f4558'); Rr(23, 0, 1, 2, '#3f4558');
  const lc = ['#ff5ad1', '#ffe14a', '#7dffa0'];
  for (let k = 0; k < 7; k++) { const on = ((t >> 3) + k) % 3; Rr(-18 + k * 6, 0, 2, 1, on === 0 ? lc[k % 3] : shade(lc[k % 3], -0.55)); }
  Rr(-5, 5, 11, 1, u.beam ? '#bfffd0' : '#6ad68a'); Rr(-3, 6, 7, 1, u.beam ? 'rgba(160,255,190,.8)' : 'rgba(90,200,120,.5)');
}
// a wobbling theremin while they work
let alienNodes = null;
function alienHum(on) {
  if (typeof AC === 'undefined' || !AC || !master) return;
  try {
    if (on && !alienNodes) {
      const o = AC.createOscillator(), lfo = AC.createOscillator(), lg = AC.createGain(), w = AC.createOscillator(), wg = AC.createGain(), g = AC.createGain();
      o.type = 'sine'; o.frequency.value = 520; lfo.frequency.value = 6.5; lg.gain.value = 18; lfo.connect(lg).connect(o.frequency);
      w.frequency.value = 0.23; wg.gain.value = 140; w.connect(wg).connect(o.frequency);
      g.gain.value = 0.0001; g.gain.setTargetAtTime(0.018, AC.currentTime, 0.8);
      o.connect(g).connect(master); o.start(); lfo.start(); w.start();
      alienNodes = { o, lfo, w, g };
    } else if (!on && alienNodes) {
      const n = alienNodes; alienNodes = null;
      n.g.gain.setTargetAtTime(0.0001, AC.currentTime, 0.4); setTimeout(() => { try { n.o.stop(); n.lfo.stop(); n.w.stop(); } catch (e) {} }, 1600);
    }
  } catch (e) {}
}
// ---------- THE SECRETS ROOM (Trophy Rooms): every secret is a locked card with a dark silhouette and hints, never
// the steps. A hint gets a tick once you've found that way in. Unlocked secrets get their switch here.
const SECRETS = [
  { id: 'aliens', name: 'The Alien Grounds Crew', draw: 'saucer',
    hints: [{ key: 'lightsout', text: 'Turn the lights out on them completely, and something might come to see what happened.' },
            { key: 'chance', text: 'Keep your eyes on the pitch between halves. Not everything that cleans it is from around here.' }],
    aside: 'They never bother with easy games.',
    desc: 'Every so often the lights go out between halves and six saucers take care of the pitch instead of the Mower.' },
];
function secretPic(sc, open) {
  const c = h('canvas', { width: 120, height: 72, class: 'px', style: { width: '180px', height: '108px', background: '#05060d', borderRadius: '4px' } }), g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  if (sc.draw === 'saucer' && typeof drawWorldOn === 'function') {
    const u = { x: 60 / 1.6, y: 58 / 1.6 + ALIEN.alt, s: 1, beam: false, head: '#7be36a', ant: true, wave: false, ph: 0, i: 0 };
    if (open) { g.fillStyle = 'rgba(141,255,176,.18)'; g.beginPath(); g.ellipse(60, 62, 34, 8, 0, 0, Math.PI * 2); g.fill(); }
    drawWorldOn(g, 0, 0, 1.6, () => alienSaucer(u, 0));
    if (!open) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = '#1b2036'; g.fillRect(0, 0, 120, 72); g.globalCompositeOperation = 'source-over'; }
  }
  return c;
}
function secretsRoomEl(rerender) {
  const S0 = (PROFILE && PROFILE.secrets) || {}, wrap = h('div', { class: 'panel' });
  wrap.appendChild(h('div', { class: 'sub', style: { marginTop: 0 } }, 'Some things in this game are never explained. Here are a few whispers.'));
  for (const sc of SECRETS) {
    const open = !!S0[sc.id] || (typeof dbgUnlockAll === 'function' && dbgUnlockAll());
    const hints = h('div', {}, sc.hints.map(x => h('div', { style: { margin: '6px 0', fontSize: '8px', lineHeight: '1.6', color: S0[x.key] ? '#8dffb0' : '#c9cfe6' } }, (S0[x.key] ? '✓ ' : '• ') + x.text)),
      sc.aside ? h('div', { class: 'muted', style: { fontSize: '7px', marginTop: '4px' } }, sc.aside) : null);
    let ctl = null;
    if (open && sc.id === 'aliens') {
      const cur = PROFILE.alienMode || 'some';
      const set = m => { PROFILE.alienMode = m; PROFILE.dirty = true; rerender(); };
      ctl = h('div', { class: 'row', style: { justifyContent: 'flex-start', gap: '4px', marginTop: '6px' } },
        [['off', 'OFF'], ['some', 'NOW AND THEN'], ['every', 'EVERY HALF-TIME (QUICK PLAY)']].map(([m, l]) => h('button', { class: 'small' + (cur === m ? ' sel' : ''), onclick: () => set(m) }, l)));
      if (alienTeamSeen() || (typeof dbgUnlockAll === 'function' && dbgUnlockAll())) {     // the hidden one: only once it has happened to you
        const at = PROFILE.alienTeam || 'on', setT = m => { PROFILE.alienTeam = m; PROFILE.dirty = true; rerender(); };
        ctl = h('div', {}, ctl,
          h('div', { style: { fontSize: '8px', lineHeight: '1.6', margin: '10px 0 4px', color: '#8dffb0' } }, 'ALIEN PLAYERS: after the saucers do the pitch, 1 time in 10 your team comes back out as aliens for the half.'),
          h('div', { class: 'row', style: { justifyContent: 'flex-start', gap: '4px' } },
            [['on', 'ON'], ['off', 'OFF']].map(([m, l]) => h('button', { class: 'small' + (at === m ? ' sel' : ''), onclick: () => setT(m) }, l))));
      }
    }
    wrap.appendChild(h('div', { class: 'panel', style: { display: 'flex', gap: '14px', alignItems: 'flex-start', flexWrap: 'wrap', background: 'rgba(5,6,13,.55)' } },
      h('div', { style: { flex: '0 0 auto' } }, secretPic(sc, open)),
      h('div', { style: { flex: '1 1 300px' } },
        h('h3', { style: { marginTop: 0, color: open ? '#8dffb0' : '#7a83a8' } }, open ? sc.name.toUpperCase() : '? ? ?'),
        open ? h('div', { style: { fontSize: '8px', lineHeight: '1.6', marginBottom: '6px' } }, sc.desc) : null,
        hints, ctl)));
  }
  wrap.appendChild(h('div', { class: 'hint' }, 'Secrets belong to you, not to a franchise: once found, they are found in every save and in Quick Play.'));
  return wrap;
}
