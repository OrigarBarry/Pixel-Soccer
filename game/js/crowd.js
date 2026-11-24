'use strict';
// ====================================================================
//  CROWD VOICE: speech-bubble cheers from fans in the stands (rink stands and the arena scenery beside it),
//  reacting to what happens on the ice, plus synthesized crowd chants, claps, "ooh"s and boos.
// ====================================================================
const CROWD_LINES = {
  idle:     ["LET'S GO {N}!", '{N}! {N}!', 'GO {N} GO!', 'WE WANT A GOAL!', "C'MON {N}!", 'LOUDER!', 'HERE WE GO!'],
  awayIdle: ['GO {A}!', "LET'S GO {A}!", '{A} ALL THE WAY!'],
  defense:  ['DE-FENSE!', 'DE-FENSE! DE-FENSE!', 'HOLD THEM!', 'GET IT OUT!'],
  shoot:    ['SHOOOOT!', 'SHOOT IT!', 'TAKE THE SHOT!', 'FIRE!'],
  save:     ['OOOOH!', 'SO CLOSE!', 'ROBBED!', 'WHAT A SAVE!'],
  oursave:  ['GREAT SAVE!', 'BRICK WALL!', 'NOT TODAY!', 'THANK YOU!'],
  goal:     ['GOOOAL!', 'YEAHHH!', 'WHAT A GOAL!', 'GET IN THERE!', 'SCORE!!'],
  awayGoal: ['NOOO!', 'BOOO!', 'UGH!', 'COME ON!'],
  awayFans: ['YEAH!!', 'GOAL!!', 'TAKE THAT!'],
  penUs:    ['BOOO!', 'REF, YOU BLIND?!', 'NO WAY!', 'TERRIBLE CALL!'],
  penThem:  ['SEE YA!', 'SIT DOWN!', 'BYE BYE!', 'OFF YOU GO!'],
  fight:    ['SCUFFLE! SCUFFLE!', 'DROP EM!', 'GET HIM!'],
  late:     ['ONE MORE!', 'HANG ON!', 'COME ON!!'],
  wave:     ['HERE COMES THE WAVE!', 'WAAAVE!', 'STAND UP!', 'GET UP! GET UP!'],
  ball:     ['BEACH BALL!', 'HIT IT HERE!', 'OVER HERE!', 'KEEP IT UP!'],
};
const CV = { bubbles: [], lastScore: [0, 0], lastSog: [0, 0], lastPens: [0, 0], cd: 0, idleT: 0, defT: 0, shootT: 0, fightSeen: false, saveWatch: null, matchRef: null };
function crowdVoiceReset() { CV.bubbles.length = 0; CV.matchRef = null; }
const cvHome = () => (S.match ? S.match.home ?? 0 : 0);
// how full the building is (1 = sold out); a thin crowd makes less noise, holds up fewer signs and has fewer vendors
const crowdFill = () => (S.match && S.match.fill != null ? S.match.fill : 1);
const crowdLife = () => Math.max(0, Math.min(1, (crowdFill() - 0.3) / 0.65));   // 0 = near empty, 1 = packed
function cvFill(str) {
  const hm = cvHome();
  return str.replace(/\{N\}/g, ((TEAM[hm].nick || TEAM[hm].abbr || 'HOME') + '').toUpperCase()).replace(/\{A\}/g, ((TEAM[1 - hm].nick || TEAM[1 - hm].abbr || 'AWAY') + '').toUpperCase());
}
// add one bubble (away: said by the visiting fans); picks a fan the camera (or the scenery) can see
function crowdSay(kind, opts = {}) {
  const lines = CROWD_LINES[kind]; if (!lines) return;
  if (Math.random() > 0.25 + 0.75 * crowdLife()) return;                // fewer voices in a half-empty rink
  const txt = cvFill(lines[(Math.random() * lines.length) | 0]).slice(0, 22);
  const away = !!opts.away, hm = cvHome(), team = away ? 1 - hm : hm;
  const sides = ['L', 'R'].filter(k => typeof STAD !== 'undefined' && STAD.view[k] && STAD.view[k].x1 - STAD.view[k].x0 > 40);
  let where = 'rink';
  if (sides.length && Math.random() < (opts.side ?? (S.cam === 'FULL' ? 0.85 : 0.45))) where = sides[(Math.random() * sides.length) | 0];
  const b = { txt, team, where, life: opts.life || 120, max: opts.life || 120, big: !!opts.big };
  if (where === 'rink') {
    const vx0 = camX, vx1 = camX + viewW(), vy0 = camY, vy1 = camY + viewH();
    const cand = crowdSeats.filter(st => !st.empty && !st.dyn && st.away === away && st.x * SS > vx0 + 24 && st.x * SS < vx1 - 24 && st.y * SS > vy0 + 26 && st.y * SS < vy1 - 8);
    if (!cand.length) { if (sides.length) b.where = sides[0]; else return; }
    else { const st = cand[(Math.random() * cand.length) | 0]; b.x = st.x * SS + 6 * SS; b.y = st.y * SS; }
  }
  if (b.where !== 'rink') {
    const f = stadPickFan(b.where, away); if (!f) return;
    b.x = f.x; b.y = f.y;
  }
  // don't stack two bubbles on the same spot
  // (Nov 23) and lift it clear of any bubble it would cover, by the width of the two texts; if it can't be, skip it
  const bw = o => o.txt.length * 5 + 12;
  for (let k = 0; k < 5; k++) { const hit = CV.bubbles.find(o => o.where === b.where && o.life > 10 && Math.abs(o.x - b.x) < (bw(o) + bw(b)) / 2 && Math.abs(o.y - b.y) < 17); if (!hit) break; if (k === 4) return; b.y = hit.y - 18; }
  CV.bubbles.push(b);
  if (CV.bubbles.length > 9) CV.bubbles.shift();
}
function crowdBurst(kind, n, opts) { for (let i = 0; i < n; i++) crowdSay(kind, opts); }

// ---------- event detection (once per frame during live play)
function crowdTick() {
  if (!S.match || !TEAM[0] || typeof crowdSeats === 'undefined') return;
  if (CV.matchRef !== S.match) { CV.matchRef = S.match; CV.bubbles.length = 0; CV.lastScore = S.score.slice(); CV.lastSog = S.sog.slice(); CV.lastPens = [0, 0]; CV.idleT = 360; CV.fightSeen = false; }
  for (const b of CV.bubbles) b.life--;
  CV.bubbles = CV.bubbles.filter(b => b.life > 0);
  if (CV.cd > 0) CV.cd--;
  const hm = cvHome(), aw = 1 - hm;
  // goals
  for (const t of [0, 1]) if (S.score[t] > CV.lastScore[t]) {
    if (t === hm) { crowdBurst('goal', 4, { big: true, life: 150 }); crowdSfx('roar'); }
    else { crowdBurst('awayGoal', 2); crowdBurst('awayFans', 2, { away: true, life: 140 }); crowdSfx('groan'); }
    CV.cd = 200; CV.idleT = 600;
  }
  CV.lastScore = S.score.slice();
  // shots on goal: watch for the save
  for (const t of [0, 1]) if (S.sog[t] > CV.lastSog[t]) CV.saveWatch = { t, until: S.t + 40 };
  CV.lastSog = S.sog.slice();
  if (CV.saveWatch && S.t <= CV.saveWatch.until && S.phase !== 'goal' && puck.owner && puck.owner.g && CV.cd < 60) {
    const shooterHome = CV.saveWatch.t === hm;
    if (Math.random() < 0.7) { crowdSay(shooterHome ? 'save' : 'oursave'); crowdSfx(shooterHome ? 'ooh' : 'cheer'); CV.cd = 90; }
    CV.saveWatch = null;
  } else if (CV.saveWatch && S.t > CV.saveWatch.until) CV.saveWatch = null;
  // penalties
  if (MS && MS.rs && MS.rs.ts) {
    for (const t of [0, 1]) {
      const n = MS.rs.ts[t].pim;
      if (n > CV.lastPens[t]) { if (t === hm) { crowdBurst('penUs', 2); crowdSfx('boo'); } else { crowdSay('penThem'); crowdSfx('cheer'); } CV.cd = 160; }
      CV.lastPens[t] = n;
    }
  }
  // fights
  if (S.phase === 'fight' && !CV.fightSeen) { CV.fightSeen = true; crowdBurst('fight', 3); crowdSfx('roar'); CV.cd = 200; }
  else if (S.phase !== 'fight') CV.fightSeen = false;
  if (S.phase !== 'live' || CV.cd > 0) return;
  const own = puck.owner;
  // visitors pinned in the home end: DE-FENSE!
  const gH = goalies[hm];
  if (own && own.team === aw && gH && Math.abs(puck.y - gH.y) < 170) { if (++CV.defT > 200) { crowdSay('defense', { life: 150 }); crowdSfx('defense'); CV.defT = -300; CV.cd = 200; } }
  else if (CV.defT > 0) CV.defT = 0; else CV.defT = Math.min(0, CV.defT + 1);
  // home carrier in the slot not shooting: SHOOT!
  const gA = goalies[aw];
  if (own && own.team === hm && !own.g && gA && Math.hypot(own.x - gA.x, own.y - gA.y) < 95) { if (++CV.shootT > 70) { crowdSay('shoot'); CV.shootT = -240; CV.cd = 120; } }
  else if (CV.shootT > 0) CV.shootT = 0; else CV.shootT = Math.min(0, CV.shootT + 1);
  // late in a close game
  if (S.period >= 3 && S.clock < 25 && Math.abs(S.score[0] - S.score[1]) <= 1 && Math.random() < 0.004) { crowdSay('late'); CV.cd = 220; }
  // chants every so often
  if (--CV.idleT <= 0) {
    CV.idleT = 900 + Math.random() * 900;
    if (Math.random() < 0.78) { crowdSay('idle', { life: 160 }); crowdSfx('letsgo'); }
    else crowdSay('awayIdle', { away: true, life: 140 });
    CV.cd = 160;
  }
}

// ---------- drawing: bubbles over the rink stands (world space) ...
// a crowd shout: an oval speech bubble (team-coloured rim) with a tail pointing down at the fan
function bubbleBox(c, x, y, txt, team, big, k, fontPx, charW, pad) {
  const w = txt.length * charW + pad * 2, hgt = fontPx + pad * 2 - 1, bx = Math.round(x - w / 2), by = Math.round(y - hgt - 6);
  const Tm = TEAM[team] || { main: '#ffd23f' }, cx = bx + w / 2, cy = by + hgt / 2, rx = w / 2 * 1.14 + 1, ry = hgt / 2 * 1.5, fill = big ? '#fff3b0' : '#ffffff';
  const lw = Math.max(0.6, fontPx / 9);
  c.globalAlpha = k;
  // tail first (the oval covers its top)
  c.fillStyle = '#141832'; c.beginPath(); c.moveTo(cx - fontPx * 0.55, cy + ry * 0.6); c.lineTo(x - 1, cy + ry + fontPx * 0.95); c.lineTo(cx + fontPx * 0.2, cy + ry * 0.7); c.closePath(); c.fill();
  c.fillStyle = fill; c.beginPath(); c.moveTo(cx - fontPx * 0.4, cy + ry * 0.55); c.lineTo(x - 1, cy + ry + fontPx * 0.95 - lw * 2); c.lineTo(cx + fontPx * 0.05, cy + ry * 0.6); c.closePath(); c.fill();
  c.beginPath(); c.ellipse(cx, cy, rx + lw, ry + lw, 0, 0, Math.PI * 2); c.fillStyle = '#141832'; c.fill();
  c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = Tm.main; c.fill();
  c.beginPath(); c.ellipse(cx, cy, rx - lw, ry - lw, 0, 0, Math.PI * 2); c.fillStyle = fill; c.fill();
  return { bx, by, w, hgt };
}
function drawCrowdBubbles() {
  if (!CV.bubbles.length || !ctx) return;
  ctx.save(); toWorld();
  for (const b of CV.bubbles) {
    if (b.where !== 'rink') continue;
    const age = b.max - b.life, k = Math.min(1, age / 6, b.life / 14), pop = age < 6 ? 0.6 + age / 15 : 1;
    const cssPerWorld = cvs.getBoundingClientRect().width / Math.max(1, viewW()), fs = Math.min(6.5, Math.max(b.big ? 5.5 : 4.5, 7 / Math.max(0.3, cssPerWorld))), cw = fs, half = (b.txt.length * cw + 6) / 2;
    const x = Math.max(camX + half * 1.3 + 3, Math.min(camX + viewW() - half * 1.3 - 3, b.x));
    const box = bubbleBox(ctx, x, b.y - (age < 6 ? (6 - age) : 0), b.txt, b.team, b.big, k * pop, fs, cw, 3);
    ctx.font = fs + "px 'PH Pixel', monospace"; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#141832'; ctx.fillText(b.txt, box.bx + 3, box.by + 3);
  }
  ctx.globalAlpha = 1; ctx.restore();
}
// ... and on the arena scenery beside the rink (pixel font, canvas pixels)
function drawSideBubbles(c, side) {
  const v = STAD.view[side]; if (!v) return;
  for (const b of CV.bubbles) {
    if (b.where !== side) continue;
    const age = b.max - b.life, k = Math.min(1, age / 6, b.life / 14);
    const sc = 1, w = pTextW(b.txt, sc) + sc + 6;
    const x = Math.max(v.x0 + w * 0.65 + 3, Math.min(v.x1 - w * 0.65 - 3, b.x));   // the oval is wider than the text
    const box = bubbleBox(c, x, b.y - (age < 6 ? 6 - age : 0), b.txt, b.team, b.big, k, 5 * sc, 4 * sc, 3);
    pText(c, b.txt, box.bx + 3, box.by + 3, '#141832', sc);
  }
  c.globalAlpha = 1;
}

// ---------- crowd sounds (synthesized; follow the sound-effects volume)
function crowdVoices(t0, dur, f0, f1, opts = {}) {
  if (!AC || !master) return;
  const n = opts.n || 9, out = AC.createGain(), bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = opts.formant || 700; bp.Q.value = 0.9;
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = opts.lp || 1800;
  out.gain.setValueAtTime(0.0001, t0); out.gain.linearRampToValueAtTime((opts.vol || 0.05), t0 + (opts.att || 0.05)); out.gain.setValueAtTime(opts.vol || 0.05, t0 + dur * 0.7); out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  bp.connect(lp).connect(out).connect(master);
  for (let i = 0; i < n; i++) {
    const o = AC.createOscillator(); o.type = 'sawtooth';
    const det = 1 + (Math.random() - 0.5) * 0.06, dl = Math.random() * 0.04;
    o.frequency.setValueAtTime(f0 * det, t0 + dl); o.frequency.linearRampToValueAtTime(f1 * det, t0 + dur);
    if (opts.vib) { const lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = 4 + Math.random() * 2; lg.gain.value = f0 * 0.03; lfo.connect(lg).connect(o.frequency); lfo.start(t0); lfo.stop(t0 + dur + 0.05); }
    o.connect(bp); o.start(t0 + dl); o.stop(t0 + dur + 0.05);
  }
}
function crowdClap(t0, vol = 0.22) {
  if (!AC || !master || !noiseBuf) return;
  for (let i = 0; i < 4; i++) {
    const s = AC.createBufferSource(); s.buffer = noiseBuf; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100 + Math.random() * 900; f.Q.value = 1.2;
    const g = AC.createGain(), t = t0 + Math.random() * 0.025;
    g.gain.setValueAtTime(vol / 4 + Math.random() * 0.02, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    s.connect(f).connect(g).connect(master); s.start(t, Math.random() * 1.5, 0.09);
  }
}
function crowdSfx(kind) {
  if (!AC || !master || S.demo || !S.sound) return;
  const t = AC.currentTime + 0.02;
  if (kind === 'letsgo') {          // LET'S - GO - TEAM - NAME, clap clap, clap clap clap
    [[0, 0.22, 330], [0.27, 0.3, 294], [0.62, 0.22, 392], [0.86, 0.3, 330]].forEach(([dt, d, f]) => crowdVoices(t + dt, d, f, f * 0.98, { formant: 750 }));
    [1.3, 1.55, 1.95, 2.1, 2.25].forEach(dt => crowdClap(t + dt));
  } else if (kind === 'defense') {  // DE - FENSE, clap clap (twice)
    for (const r of [0, 1.4]) { crowdVoices(t + r, 0.24, 300, 300, { formant: 650 }); crowdVoices(t + r + 0.32, 0.42, 247, 240, { formant: 600 }); crowdClap(t + r + 0.85); crowdClap(t + r + 1.1); }
  } else if (kind === 'boo') crowdVoices(t, 1.6, 150, 132, { n: 12, formant: 420, lp: 700, vol: 0.06, att: 0.25, vib: true });
  else if (kind === 'ooh') crowdVoices(t, 1.0, 190, 280, { n: 12, formant: 520, lp: 900, vol: 0.055, att: 0.12 });
  else if (kind === 'groan') crowdVoices(t, 1.1, 230, 160, { n: 10, formant: 480, lp: 800, vol: 0.05, att: 0.1 });
  else if (kind === 'cheer') { crowdVoices(t, 0.9, 260, 300, { n: 10, formant: 900, lp: 2200, vol: 0.04, att: 0.08 }); for (let i = 0; i < 6; i++) crowdClap(t + 0.1 + i * 0.11 + Math.random() * 0.05, 0.14); }
  else if (kind === 'roar') { crowdVoices(t, 2.2, 280, 330, { n: 14, formant: 950, lp: 2600, vol: 0.06, att: 0.1, vib: true }); for (let i = 0; i < 14; i++) crowdClap(t + 0.3 + i * 0.09 + Math.random() * 0.06, 0.16); }
}

// ====================================================================
//  CROWD SHOW: fan signs held up a few at a time, the wave, and a beach ball bouncing over the stands.
//  Drawn over the pre-rendered crowd each frame (rink stands in world space, the stadium beside it on the
//  side canvases). Everything runs on the frame counter S.t.
// ====================================================================
const CFX = { ref: null, holders: [], nextSign: 0, wave: null, nextWave: 0, ball: null, nextBall: 0, pops: [] };
const cfxRand = (a, b) => a + Math.random() * (b - a);
const seatAng = st => st.ang ?? (st.ang = Math.atan2(st.y * SS + 7 - CY, st.x * SS + 6 - CX));
function cfxReset() {
  CFX.ref = S.match; CFX.holders.length = 0; CFX.wave = null; CFX.ball = null; CFX.pops.length = 0;
  const t = S.t; CFX.nextSign = t + 60; CFX.nextWave = t + 60 * cfxRand(40, 80); CFX.nextBall = t + 60 * cfxRand(25, 60);
}
function cfxSignsOn() { try { return arenaCfg().signs !== false; } catch (e) { return true; } }
// is a rink-stand seat on screen (in the rink view, or in the stadium canvases, which repeat the rink stands)?
function cfxViews() {
  const out = [{ x0: camX / SS, x1: (camX + viewW()) / SS, y0: camY / SS, y1: (camY + viewH()) / SS }];
  if (typeof STAD !== 'undefined') for (const sd of ['L', 'R']) if (STAD.view[sd]) out.push(STAD.view[sd]);
  return out;
}
const cfxIn = (st, v, m = 0) => st.x > v.x0 + 3 - m && st.x < v.x1 - 14 + m && st.y > v.y0 + 12 - m && st.y < v.y1 - 6 + m;
// a seat the camera can see right now (the stands round the rink first, then the stadium beside it)
function cfxPickSeat(rinkOnly) {
  const ok = st => !st.empty && !st.dyn && !st.prop && st.T && !CFX.holders.some(h => h.st === st);
  const views = cfxViews();
  const rink = crowdSeats.filter(st => ok(st) && views.some(v => cfxIn(st, v)));
  const pools = [['rink', rink]];
  if (typeof STAD !== 'undefined' && !rinkOnly) for (const sd of ['L', 'R']) {
    const v = STAD.view[sd], side = STAD.sides[sd]; if (!v || !side) continue;
    pools.push([sd, side.seats.filter(st => ok(st) && cfxIn(st, v, -4))]);
  }
  const all = pools.filter(([, l]) => l.length);
  if (!all.length) return null;
  const [where, list] = all[(Math.random() * all.length) | 0];
  return { where, st: list[(Math.random() * list.length) | 0] };
}
// where a held-up sign sits (crowd pixels), so new signs can keep their distance
const CFX_SIGN_SCALE = 1.5, CFX_SIGN_GAP = 6;
function cfxSignBox(st, sg) {
  const [w, hgt] = fanSignSize(sg), k = CFX_SIGN_SCALE / CROWD_FINE;
  return { x0: st.x + (9 - w / 2 * CFX_SIGN_SCALE) / CROWD_FINE - 1, x1: st.x + (9 + w / 2 * CFX_SIGN_SCALE) / CROWD_FINE + 1, y0: st.y - hgt * k - 4, y1: st.y + 15 };
}
const cfxBoxHit = (a, b, g) => !!b && a.x0 < b.x1 + g && b.x0 < a.x1 + g && a.y0 < b.y1 + g && b.y0 < a.y1 + g;
function crowdFxUpdate() {
  if (!S.match || !TEAM[0] || typeof crowdSeats === 'undefined' || !crowdSeats.length) return false;
  if (CFX.ref !== S.match) cfxReset();
  if (S.outro && S.outro.leave > 0) return false;
  const t = S.t, hm = S.match.home ?? 0;
  // signs: three to five up at once, each for 12-25 s, every kind different
  CFX.holders = CFX.holders.filter(h => t < h.end);
  const want = Math.round((3 + ((Math.floor(t / 1500) * 7) % 3)) * (0.2 + 0.8 * crowdLife()));   // 3, 4 or 5 in a full house, changing every ~25 s; one or two in a thin crowd
  if (cfxSignsOn() && CFX.holders.length < want && t >= CFX.nextSign) {
    // try a few seats: a new sign must keep clear of every sign already up (no overlaps, a gap between them)
    const shown = new Set(CFX.holders.map(h => h.sg.k)), kinds = FAN_SIGN_KINDS.filter(k => !shown.has(k));
    const kind = kinds[(Math.random() * kinds.length) | 0];
    for (let tries = 0; tries < 14; tries++) {
      const pick = cfxPickSeat(); if (!pick) break;
      const team = pick.st.away ? 1 - hm : hm, sg = fanSignPick(TEAM[team], team, kind), box = cfxSignBox(pick.st, sg);
      if (CFX.holders.some(h => cfxBoxHit(box, h.box, CFX_SIGN_GAP))) continue;
      CFX.holders.push({ where: pick.where, st: pick.st, sg, box, sty: (Math.random() * 3) | 0, t0: t, end: t + 60 * cfxRand(12, 25) });
      break;
    }
    CFX.nextSign = t + 60 * cfxRand(2, 6) / (0.3 + 0.7 * crowdLife());
  }
  if (S.pres && S.pres.crowdLite) return true;
  // the wave: twice round the building, now and then when nothing big is happening
  if (CFX.wave && t > CFX.wave.end) CFX.wave = null;
  if (!CFX.wave && t >= CFX.nextWave && !(S.cheer > 0) && crowdFill() > 0.65) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    CFX.wave = { a0: cfxRand(-Math.PI, Math.PI), dir, t0: t, end: t + 2 * 330 };
    CFX.nextWave = t + 60 * cfxRand(80, 150);
    if (typeof crowdSay === 'function') crowdSay('wave');
  }
  // the beach ball: hops from fan to fan for half a minute, then security takes it
  const B = CFX.ball;
  if (B) {
    if (t >= B.t0 + B.dur) {
      CFX.pops.push({ st: B.to, end: t + 24 });
      if (t >= B.end) CFX.ball = null;
      else { const nx = cfxNextHop(B.to, B); if (!nx) CFX.ball = null; else { B.from = B.to; B.to = nx; B.t0 = t; B.dur = 34 + Math.random() * 18; B.h = 18 + Math.random() * 14; } }
    }
  } else if (t >= CFX.nextBall) {
    const pick = cfxPickSeat(true);
    if (pick) {
      const nx = cfxNextHop(pick.st, null);
      if (nx && typeof crowdSay === 'function') crowdSay('ball');
      if (nx) CFX.ball = { from: pick.st, to: nx, t0: t, dur: 40, h: 22, end: t + 60 * cfxRand(20, 35), col: Math.random() < 0.5 ? 0 : 1, dx: 0, dy: 0 };
    }
    CFX.nextBall = t + 60 * cfxRand(70, 140);
  }
  CFX.pops = CFX.pops.filter(p => t < p.end);
  return true;
}
// the next fan to knock the ball on: a few seats away, mostly carrying on in the same direction
function cfxNextHop(st, B) {
  const views = cfxViews();
  const cand = crowdSeats.filter(o => o !== st && !o.empty && !o.dyn && Math.abs(o.x - st.x) < 46 && Math.abs(o.y - st.y) < 46 && Math.hypot(o.x - st.x, o.y - st.y) > 13
    && views.some(v => cfxIn(o, v, 20)));
  if (!cand.length) return null;
  if (B && (B.dx || B.dy)) cand.sort((a, b) => ((b.x - st.x) * B.dx + (b.y - st.y) * B.dy) - ((a.x - st.x) * B.dx + (a.y - st.y) * B.dy) + (Math.random() - 0.5) * 300);
  const nx = B ? cand[(Math.random() * Math.min(4, cand.length)) | 0] : cand[(Math.random() * cand.length) | 0];
  if (B) { B.dx = nx.x - st.x; B.dy = nx.y - st.y; }
  return nx;
}
// a fan drawn over the crowd in a pose: 'sign' (holding his sign up), 'up' (on his feet, arms up)
function cfxFan(c, st, VN, pose, extra) {
  fanLook(st);
  const o = Object.assign({}, st, extra || {});
  if (pose === 'phone') { o.prop = 'phone'; drawFanSprite(c, o, 0, VN, true); return; }
  if (pose === 'sign') { o.prop = 'sign'; o.arms = true; const cheer = S.cheer > 0 && ((S.cheerKind === 'home') !== !!st.away || S.cheerKind === 'all'); drawFanSprite(c, o, cheer ? 6 + ((S.t >> 4) & 1) : 0, VN, true); }
  else { o.arms = true; if (o.prop === 'sign') o.prop = null; drawFanSprite(c, o, 6 + ((S.t >> 3) & 1), VN, true); }
}
function cfxWaveOn(st) {
  const W0 = CFX.wave; if (!W0) return false;
  const a = W0.a0 + W0.dir * (S.t - W0.t0) / 330 * Math.PI * 2;
  return Math.abs(angDiff(seatAng(st), a)) < 0.26;
}
function cfxDrawSet(c, seats, VN, x0, y0, x1, y1, where, withBall) {
  const inV = st => st.x > x0 - 18 && st.x < x1 + 6 && st.y > y0 - 6 && st.y < y1 + 28;
  if (CFX.wave) for (const st of seats) if (!st.empty && !st.dyn && inV(st) && cfxWaveOn(st)) cfxFan(c, st, VN(st), 'up');
  for (const p of CFX.pops) if (seats === crowdSeats && inV(p.st)) cfxFan(c, p.st, VN(p.st), 'up');
  for (const h of CFX.holders) if (h.where === where && inV(h.st)) {
    // the sign goes up for a moment, stays up, and comes down again
    const age = S.t - h.t0, left = h.end - S.t, lift = Math.min(1, age / 12, left / 12);
    if (lift < 0.5) continue;
    cfxFan(c, h.st, VN(h.st), 'sign', { sg: h.sg, sty: h.sty, ph: 0.8, signScale: CFX_SIGN_SCALE });
  }
  // PHONE LIGHTS: in the dark light show about one fan in twenty films it on his phone, the camera light twinkling
  if (typeof ALS !== 'undefined' && (ALS.mode === 'show' || ALS.mode === 'alien') && ALS.lvl > 0.35) {
    const held = new Set(CFX.holders.map(hh => hh.st));
    for (const st of seats) {
      if (st.empty || st.dyn || held.has(st) || !inV(st)) continue;
      const hsh = Math.abs(Math.sin(st.x * 12.9898 + st.y * 78.233) * 43758.5453) % 1; if (hsh > (ALS.mode === 'alien' ? 0.14 : 0.05)) continue;   // (everybody films the saucers)
      const tw = 0.5 + 0.5 * Math.sin(S.t * (0.05 + hsh * 1.2) + hsh * 400);
      cfxFan(c, st, VN(st), 'phone', { flash: tw });
      (c.__phones = c.__phones || []).push({ st, tw });                          // its light is added after the house lights go down (crowdPhonesGlow)
    }
  }
  if (withBall && CFX.ball) { const B = CFX.ball; if (inV(B.from) || inV(B.to)) cfxDrawBall(c); }
}
// the phones' camera lights, drawn after the light map so they shine in the dark (same transform as the fans)
function crowdPhonesGlow(c) {
  const L = c.__phones; if (!L || !L.length) return;
  for (const { st, tw } of L) {
    fanBegin(c, st.x, st.y);
    try {
      c.globalCompositeOperation = 'lighter'; const a = (0.35 + 0.5 * tw) * ALS.lvl, g = c.createRadialGradient(16.5, -6.5, 0, 16.5, -6.5, 10);
      g.addColorStop(0, `rgba(255,255,245,${a})`); g.addColorStop(0.35, `rgba(220,235,255,${a * 0.35})`); g.addColorStop(1, 'rgba(220,235,255,0)');
      c.fillStyle = g; c.fillRect(6, -17, 21, 21);
      c.fillStyle = `rgba(255,255,255,${0.6 + 0.4 * tw})`; c.fillRect(16, -7, 1, 1);
    } finally { c.restore(); }
  }
}
function crowdPhonesWorld() { if (!ctx.__phones || !ctx.__phones.length) return; ctx.save(); toWorld(); ctx.scale(SS, SS); try { crowdPhonesGlow(ctx); } finally { ctx.restore(); } }
function crowdFxWorld() {
  ctx.__phones = [];
  if (!crowdFxUpdate() || !crowdVN) return;
  ctx.save(); toWorld(); ctx.scale(SS, SS);
  const x0 = camX / SS, y0 = camY / SS, x1 = x0 + viewW() / SS, y1 = y0 + viewH() / SS;
  try {
    cfxDrawSet(ctx, crowdSeats, () => crowdVN, x0, y0, x1, y1, 'rink', true);
  } finally { ctx.restore(); }
}
function crowdFxSide(c, sd, x0, y0, x1, y1) {
  c.__phones = [];
  if (!CFX.ref || CFX.ref !== S.match || typeof STAD === 'undefined' || !STAD.sides[sd]) return;
  const VN = STAD.g.VN, vz = new Map(), vnFor = st => { const z = st.z; if (!z || !z.tint) return VN; if (!vz.has(z)) vz.set(z, Object.assign({}, VN, { back: shade(VN.back, z.tint) })); return vz.get(z); };
  cfxDrawSet(c, STAD.sides[sd].seats, vnFor, x0, y0, x1, y1, sd, false);
  if (crowdVN && x1 > 0 && x0 < W / SS) cfxDrawSet(c, crowdSeats, () => crowdVN, Math.max(x0, 0), y0, Math.min(x1, W / SS), y1, 'rink', true);   // the rink stands seen from here
}
// the ball itself: striped panels, a highlight and its shadow on the seats below
function cfxDrawBall(c) {
  const B = CFX.ball, k = Math.min(1, (S.t - B.t0) / B.dur);
  const x = B.from.x + 6 + (B.to.x - B.from.x) * k, gy = B.from.y + 3 + (B.to.y - B.from.y) * k, y = gy - Math.sin(k * Math.PI) * B.h;
  fanBegin(c, x, gy);
  try { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(-22, 0, 44, 6); } finally { c.restore(); }
  fanBegin(c, x, y);
  try {
    // a big beach ball (three times the old size): 16 x 16 px at 3x, coloured panels that turn as it flies
    c.scale(3, 3);
    const cols = B.col ? ['#ffffff', '#ff4a3d', '#ffd23f', '#2f8fe8'] : ['#ffffff', '#2ee6a6', '#ff5fa2', '#ffd23f'];
    const spin = (S.t - B.t0) * 0.12, r = 7.6, cx = 0, cy = -9;
    c.fillStyle = '#141832';
    for (let j = -9; j <= 8; j++) for (let i = -9; i <= 8; i++) { const d = Math.hypot(i + 0.5, j + 0.5); if (d <= r + 1 && d > r) c.fillRect(cx + i, cy + j, 1, 1); }
    for (let j = -8; j <= 7; j++) for (let i = -8; i <= 7; i++) {
      const dx = i + 0.5, dy = j + 0.5, d = Math.hypot(dx, dy); if (d > r) continue;
      const a = Math.atan2(dy, dx) + spin, seg = ((Math.floor(a / (Math.PI / 3)) % 6) + 6) % 6;
      c.fillStyle = d < 1.6 ? '#ffffff' : cols[seg % 4];
      c.fillRect(cx + i, cy + j, 1, 1);
      if (d > r - 1.2 && dy > 0) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(cx + i, cy + j, 1, 1); }
    }
    c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(cx - 5, cy - 5, 2, 2); c.fillRect(cx - 4, cy - 6, 2, 1);
  } finally { c.restore(); }
}

// ====================================================================
//  ARENA LIGHT SHOW: during breaks the house lights dim and spotlights sweep over the ice and the stands.
//  Stoppages: a soft dim and three white spots. Goals: team-coloured spots and strobes. Intermissions, the
//  pregame and the end-of-game show: the full show with beams from the rig. Drawn in world units
//  (u = canvas units per world unit), on the rink view and on the stadium canvases beside it.
// ====================================================================
const ALS = { lvl: 0, mode: null, goalT: 0 };
function arenaLightsMode() {
  if (!S.match || S.screen === 'menu' || S.screen === 'paused' || S.screen === 'replay') return null;
  if (S.screen === 'intermission' && S.inter && S.inter.alien && !S.inter.alien.lit) return 'alien';   // blackout for the Alien Ice Crew
  if (typeof outroShowOn === 'function' && outroShowOn()) return 'goal';   // after the game, on the empty ice: the full show in the winners' colours
  if (S.screen === 'intermission' || S.screen === 'outro' || S.screen === 'intro' || (S.walk && S.walk.first)) return 'show';   // periods 2-3: the teams come back out under the house lights
  if (S.walk && !S.walk.first) return null;                               // ...with no light show at all
  if (ALS.post > 0 && S.screen === 'play' && S.phase === 'faceoff' && !(S.fo && S.fo.dropped)) return 'show';   // after the walkout, until the puck drops
  if (S.phase === 'goal' || S.screen === 'celebrate') return 'goal';
  if (S.phase === 'whistle' || S.phase === 'faceoff' || S.phase === 'penalty' || S.phase === 'fight') return 'break';
  return null;
}
function arenaLightsTick() {
  // after the walkout: once every starter is on the ice the lights scatter and dance, then gather on the opening
  // faceoff (both centres and the referee); the moment the puck drops they cut out and the house lights come up
  if (ALS.tickT !== S.t) {
    ALS.tickT = S.t;
    const W1 = S.walk && S.walk.first ? S.walk : null, allOut = W1 && W1.movers.some(mv => mv.kind === 'starter') && W1.movers.every(mv => mv.kind !== 'starter' || mv.done);
    if (allOut || (ALS.post > 0 && !W1)) ALS.post = (ALS.post || 0) + 1;
    else if (W1) ALS.post = 0;
    if (ALS.post > 0 && S.fo && S.fo.dropped) { ALS.post = 0; ALS.lvl = 0; ALS.mode = null; ALS.spot = 0; ALS.cut = S.t; return false; }
    if (ALS.post > 0 && !W1 && S.phase !== 'faceoff') ALS.post = 0;
  }
  const m = arenaLightsMode(), target = m === 'show' || m === 'goal' || m === 'alien' ? 1 : m === 'break' ? 0.55 : 0;
  if (m === 'goal' && ALS.lastMode !== 'goal') ALS.goalT0 = S.t;
  ALS.lastMode = m;
  if (S.t - (ALS.cut || -999) < 90 && m === 'break') return false;          // the house lights stay up right after the drop
  if (m) ALS.mode = m;
  ALS.lvl += (target - ALS.lvl) * (target > ALS.lvl ? 0.04 : 0.08);
  // the walkout: every light follows the newest starter out of the tunnel to his spot, then swings to the next one
  const W0 = S.walk && S.walk.first ? S.walk : null; let f = null;
  if (W0 && !(ALS.post > 0)) for (const mv of W0.movers) if (mv.kind === 'starter' && mv.pos) f = mv.done ? { x: mv.p.x, y: mv.p.y } : mv.pos;
  if (!f && S.outro && S.outro.lapper && S.outro.lapper.p && S.outro.lapper.phase !== 'off') { const q = S.outro.lapper.p; f = { x: q.x + q.vx * 7, y: q.y + q.vy * 7 }; }   // the star of the game: from the moment he's announced (at the bench door) and all through his lap
  if (!f && m === 'goal' && typeof MS !== 'undefined' && MS && MS.lastGoal && MS.lastGoal.scorer && typeof skaters !== 'undefined') {   // GOAL-SCORER SPOTLIGHT: one light rides with him
    const sc = skaters.find(p => p.pl && p.pl.id === MS.lastGoal.scorer); if (sc) f = { x: sc.x + sc.vx * 4, y: sc.y + sc.vy * 4 };
  }
  ALS.spot = f ? Math.min(1, (ALS.spot || 0) + 0.06) : Math.max(0, (ALS.spot || 0) - 0.025);
  if (f) { if (ALS.fx == null) { ALS.fx = f.x; ALS.fy = f.y; } ALS.fx += (f.x - ALS.fx) * 0.2; ALS.fy += (f.y - ALS.fy) * 0.2; }
  if (ALS.lvl < 0.01) { ALS.lvl = 0; ALS.mode = null; }
  return ALS.lvl > 0;
}
// ---- LIGHTING STYLES: the light show as a real light map (darkness with pools cut into it, multiplied over the scene)
// plus additive beams / glints / lasers. 'classic' is the original overlay.
const ALS_STYLES = { classic: 'Classic', pixel: 'Pixel Stage', broadcast: 'Broadcast', concert: 'Concert', stage: 'Arena (A+B)' };
function alsStyle() { return (typeof window !== 'undefined' && window.ALS_STYLE) || (S.pres && S.pres.lightStyle) || 'stage'; }
function alsCanvas(key, w, h) { const k = '_' + key; let cv = ALS[k]; if (!cv) cv = ALS[k] = document.createElement('canvas'); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, w, h); return [cv, g]; }
const ALS_SHOWS = { standard: 'Standard show', lasers: 'Laser show', projection: 'Pitch projection', pyro: 'Pyro & CO2', mirror: 'Mirror ball', aurora: 'Northern lights', storm: 'Lightning storm', search: 'Searchlights', full: 'The Works (everything)' };
// the arena's light show: any mix of effects ('lasers+mirror+storm'); 'full' (The Works) is the four classics together
function alsFx() {
  let sh = typeof window !== 'undefined' && window.ALS_SHOW; if (!sh) { try { sh = (arenaCfg() || {}).show; } catch (e) {} }
  const tk = String(sh || 'standard').split('+'), all = tk.includes('full'), has = k => all && ['lasers', 'projection', 'pyro', 'mirror'].includes(k) || tk.includes(k);
  return { lasers: has('lasers'), projection: has('projection'), pyro: has('pyro'), mirror: has('mirror'), aurora: has('aurora'), storm: has('storm'), search: has('search') };
}
function alsLights(mode, L, t, u) {
  const n = mode === 'break' ? 3 : 5, ax = W * 0.7, ay = H * 0.42, spd = mode === 'goal' ? 2.2 : 1, out = [];
  const hm = S.match.home ?? 0, tk = TEAM[S.cheerKind === 'away' ? 1 - hm : hm];
  const cols = mode === 'goal' ? [tk.main, '#ffffff', tk.trim] : mode === 'show' ? ['#fff3d0', '#9fd0ff', '#ffd23f', '#ff9ad8', '#ffffff'] : ['#ffffff', '#fff3d0', '#e8f0ff'];
  for (let i = 0; i < n; i++) {
    const post = mode === 'show' ? (ALS.post || 0) : 0, dance = (post > 0 && post < 75) || (typeof outroShowOn === 'function' && outroShowOn()) ? 2.6 : 1, gather = post > 75 ? Math.min(1, (post - 75) / 28) : 0;
    const ph = i * 2.1, k = mode === 'show' ? Math.max(ALS.spot || 0, gather) : mode === 'goal' && i === 0 ? (ALS.spot || 0) : 0;
    let wx = CX + ax * Math.sin(t * 0.011 * spd * dance + ph) * (0.6 + 0.4 * Math.sin(t * 0.004 + i)), wy = CY + ay * Math.sin(t * 0.0083 * spd * dance + ph * 1.7);
    if (gather > 0) { const fx = S.fo ? S.fo.x : CX, fy = S.fo ? S.fo.y : CY; wx += (fx + Math.sin(t * 0.04 + ph) * 6 - wx) * gather; wy += (fy - 6 + Math.cos(t * 0.037 + ph) * 5 - wy) * gather; }
    if (k > 0 && gather === 0 && ALS.fx != null) { wx += (ALS.fx + Math.sin(t * 0.05 + ph) * 3 - wx) * k; wy += (ALS.fy - 8 + Math.cos(t * 0.043 + ph) * 3 - wy) * k; }
    const r = mode === 'break' ? 40 : 50 - (gather > 0 ? 10 : mode === 'goal' ? 26 : 22) * k;
    out.push({ x: wx, y: wy, r, col: k > 0.5 ? (i % 2 ? '#fff3d0' : '#ffffff') : cols[i % cols.length], k, rx: CX + (i - (n - 1) / 2) * W * 0.35, ry: CY - H * 0.75, i });
  }
  return out;
}
function alsPaintStyled(c, u, x0, y0, x1, y1, style) {
  const L = ALS.lvl, mode = ALS.mode, t = S.t, lights = mode === 'alien' ? alienLights() : alsLights(mode, L, t, u);
  const stage = style === 'stage', pix = style === 'pixel';
  let cell = (pix ? 1.6 : 0.8) * u;                                              // light-map resolution: sprite-sized pixels for Pixel Stage
  let bw = Math.max(8, Math.ceil((x1 - x0) / cell)), bh = Math.max(8, Math.ceil((y1 - y0) / cell));
  const B = (wx) => (wx * u - x0) / cell, Bv = (wy) => (wy * u - y0) / cell, Br = r => r * u / cell;
  const setCell = k => { cell = k * u; bw = Math.max(8, Math.ceil((x1 - x0) / cell)); bh = Math.max(8, Math.ceil((y1 - y0) / cell)); };
  // 1) the light map: house lights down to an ambient navy, pools added on top
  const dark = mode === 'alien' ? 0.94 * L : (mode === 'break' ? 0.38 : mode === 'goal' ? 0.66 : style === 'broadcast' || stage ? 0.84 : 0.82) * L;
  const [lm, g] = alsCanvas('lm', bw, bh);
  const amb = [255 - (255 - 34) * dark, 255 - (255 - 40) * dark, 255 - (255 - 78) * dark].map(Math.round);
  g.fillStyle = `rgb(${amb})`; g.fillRect(0, 0, bw, bh);
  g.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    const px = B(l.x), py = Bv(l.y), pr = Br(l.r), dx = l.x - l.rx, dy = l.y - l.ry, ang = Math.atan2(dy, dx);
    const col = style === 'concert' || mode === 'goal' || mode === 'alien' ? l.col : (l.i % 2 ? '#fff3d0' : '#ffffff'), am = (1 - 0.6 * l.k) * L * (stage ? 0.58 : 1);   // (Arena: whites a touch softer)
    g.save(); g.translate(px, py); g.rotate(ang); g.scale(1.14, 0.9);            // a pool thrown from the rig is a little longer along the beam
    if (pix) {                                                                    // banded pixel pool: rim, body, hot core
      for (const [rr, a, cc] of [[1, 0.3, col], [0.9, 0.42, col], [0.55, 0.3, '#fff0c8']]) { g.fillStyle = hexA(cc, a * am); g.beginPath(); g.arc(0, 0, pr * rr, 0, Math.PI * 2); g.fill(); }
    } else {                                                                      // theatrical: flat-bright body, crisp edge, soft spill
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, pr * 1.25);
      gr.addColorStop(0, hexA(col, 0.95 * am)); gr.addColorStop(0.72, hexA(col, 0.85 * am)); gr.addColorStop(0.8, hexA(col, 0.45 * am)); gr.addColorStop(0.86, hexA(col, 0.12 * am)); gr.addColorStop(1, hexA(col, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, pr * 1.25, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  c.save();
  c.imageSmoothingEnabled = !pix;
  c.globalCompositeOperation = 'multiply'; c.drawImage(lm, x0, y0, bw * cell, bh * cell);
  // 2) additive: beams through the haze, glints, the ice's reflection, lasers
  const FX = alsFx(), fog = mode === 'show' ? 1.7 : mode === 'alien' ? 2.4 : 1;                          // haze from the fog machine makes the beams stand out
  if (stage) setCell(1.6);                                                        // Arena: the beams and dust are pixel art
  const adPix = pix || stage;
  const [ad, a2] = alsCanvas('ad', bw, bh); a2.globalCompositeOperation = 'lighter';
  if (mode !== 'break') for (const l of lights) {
    const px = B(l.x), py = Bv(l.y), pr = Br(l.r) * 0.55, sx = B(l.rx), sy = Bv(l.ry), col = style === 'concert' || mode === 'goal' || mode === 'alien' ? l.col : '#fff3d0', am = (1 - 0.5 * l.k) * L;
    const nx = -(py - sy), ny = px - sx, nd = Math.hypot(nx, ny) || 1, ox = nx / nd * pr, oy = ny / nd * pr, am2 = am * fog;
    const bg = a2.createLinearGradient(sx, sy, px, py);
    if (style === 'broadcast') { bg.addColorStop(0, hexA(col, 0.1 * am)); bg.addColorStop(0.7, hexA(col, 0.035 * am)); bg.addColorStop(1, hexA(col, 0.02 * am)); }
    else { bg.addColorStop(0, hexA(col, 0.03 * am2)); bg.addColorStop(1, hexA(col, 0.06 * am2)); }
    a2.fillStyle = bg; a2.beginPath(); a2.moveTo(sx - ox * 0.08, sy - oy * 0.08); a2.lineTo(sx + ox * 0.08, sy + oy * 0.08); a2.lineTo(px + ox, py + oy); a2.lineTo(px - ox, py - oy); a2.closePath(); a2.fill();
    if (adPix || style === 'concert') {                                          // dust in the beam
      // dust falling straight down through the beam: each speck has its own spot in the cone and drifts down, swaying a
      // little, and only shows while it's inside the light
      const bl = Math.hypot(px - sx, py - sy) || 1, ux = (px - sx) / bl, uy = (py - sy) / bl;
      for (let d = 0; d < 9; d++) {
        const h1 = Math.abs(Math.sin((d + 1) * 91.7 + l.i * 13.1)) % 1, h2 = Math.abs(Math.sin((d + 1) * 47.3 + l.i * 7.7)) % 1;
        const q = 0.2 + 0.75 * h1, fall = ((t * (0.18 + 0.1 * h2) + h2 * 400) % 60) - 30;
        const mx = sx + (px - sx) * q + ox * (h2 - 0.5) * 1.6 * q + Math.sin(t * 0.03 + d) * 0.8, my = sy + (py - sy) * q + oy * (h2 - 0.5) * 1.6 * q + fall / cell * u;
        const along = (mx - sx) * ux + (my - sy) * uy, lat = Math.abs((mx - sx) * -uy + (my - sy) * ux), half = pr * (along / bl);
        if (along < 0 || along > bl || lat > half) continue;
        a2.fillStyle = hexA('#ffffff', 0.4 * am * (1 - Math.abs(fall) / 32)); a2.fillRect(Math.round(mx), Math.round(my), 1, 1);
      }
    }
    if (style === 'broadcast') {                                                 // glossy ice: a soft streak of the pool's light toward the camera
      const rg = a2.createLinearGradient(px, py, px, py + pr * 2.4); rg.addColorStop(0, hexA(col, 0.16 * am)); rg.addColorStop(1, hexA(col, 0));
      a2.fillStyle = rg; a2.fillRect(px - pr * 0.18, py, pr * 0.36, pr * 2.4);
    }
  }
  const projOn = FX.projection && mode === 'show' && !((ALS.spot || 0) > 0.2);
  if ((style === 'concert' || FX.lasers) && mode !== 'break' && mode !== 'alien' && !projOn) {      // LASERS: two fans from the rig, scanning, a dot where each hits the ice (they wait while the ice projection plays)
    const lc = ['#39ff88', '#3ad7ff', '#ff3ad1', '#39ff88', '#fff23a'];
    for (const [sxw, syw, dir] of [[CX - W * 0.48, CY - H * 0.62, 1], [CX + W * 0.48, CY - H * 0.62, -1]]) {
      const sx = B(sxw), sy = Bv(syw);
      for (let j = 0; j < 6; j++) {
        const sweep = Math.sin(t * 0.03 * dir + j * 0.6), ex = CX + dir * (W * 0.2 + sweep * W * 0.42) - dir * j * 18, ey = CY - H * 0.35 + j * H * 0.16 + Math.cos(t * 0.021 + j) * 30;
        const exb = B(ex), eyb = Bv(ey), col = lc[(j + (dir > 0 ? 0 : 2)) % lc.length];
        a2.strokeStyle = hexA(col, 0.16 * L); a2.lineWidth = 2.2; a2.beginPath(); a2.moveTo(sx, sy); a2.lineTo(exb, eyb); a2.stroke();
        a2.strokeStyle = hexA(col, 0.85 * L); a2.lineWidth = 0.6; a2.beginPath(); a2.moveTo(sx, sy); a2.lineTo(exb, eyb); a2.stroke();
        a2.fillStyle = hexA(col, 0.9 * L); a2.fillRect(exb - 1, eyb - 1, 2, 2); a2.fillStyle = hexA(col, 0.25 * L); a2.fillRect(exb - 2.5, eyb - 2.5, 5, 5);
      }
    }
  }
  c.globalCompositeOperation = 'lighter'; c.imageSmoothingEnabled = !adPix; c.drawImage(ad, x0, y0, bw * cell, bh * cell);
  // the home logo gobo, as before (show and goal)
  if ((mode === 'show' && !((ALS.spot || 0) > 0.2)) || mode === 'goal') {
    const T0 = TEAM[S.match.home ?? 0], img = arenaGobo(T0);
    if (img) { const gx = (CX + 110 * Math.sin(t * 0.0061 + 0.7)) * u, gy = (CY + 200 * Math.sin(t * 0.0039)) * u, gr = 30 * u; c.globalAlpha = 0.5 * L; c.drawImage(img, gx - gr, gy - gr * 0.92, gr * 2, gr * 1.84); c.globalAlpha = 1; }
  }
  if (mode === 'goal' && ((t >> 3) % 5 === 0)) { c.globalCompositeOperation = 'lighter'; c.fillStyle = hexA(lights[0].col, 0.12 * L); c.fillRect(x0, y0, x1 - x0, y1 - y0); }   // strobe
  c.restore();
  alsExtras(c, u, x0, y0, x1, y1, mode, L, t, FX);
}
// ---- LIGHT SHOW EXTRAS (on top of the light map). Standard in every arena: fog in the walkout / intermission show,
// fans' phone lights in the dark stands, the LED chase round the boards on a goal (the goal-scorer spotlight is in the
// tick). Bought or unlocked: lasers, ice projection, pyro & CO2, mirror ball.
function alsExtras(c, u, x0, y0, x1, y1, mode, L, t, FX) {
  if (!L || !mode || mode === 'break') return;
  const hm = S.match.home ?? 0, T0 = TEAM[hm], main = c === ctx;
  const sinceGoal = t - (ALS.goalT0 || -9999), walk = (S.walk && S.walk.first) || (typeof outroShowOn === 'function' && outroShowOn());
  c.save(); c.globalCompositeOperation = 'lighter';
  const rk = (cb) => { c.save(); if (typeof roundRectPath === 'function') { roundRectPath(c, R.l * u, R.t * u, (R.r - R.l) * u, (R.b - R.t) * u, R.cr * u); c.clip(); } cb(); c.restore(); };
  // FOG: low haze drifting over the ice (and it makes the beams glow, above)
  if (mode === 'show' && main) rk(() => {
    for (let i = 0; i < 9; i++) {
      const fx = (CX + Math.sin(t * 0.0021 + i * 1.7) * (R.r - R.l) * 0.55) * u, fy = (CY + Math.sin(t * 0.0013 + i * 2.9) * (R.b - R.t) * 0.48) * u, fr = (80 + 30 * Math.sin(i * 3.1 + t * 0.004)) * u;
      const g = c.createRadialGradient(fx, fy, 0, fx, fy, fr); g.addColorStop(0, `rgba(200,210,235,${0.07 * L})`); g.addColorStop(1, 'rgba(200,210,235,0)');
      c.fillStyle = g; c.fillRect(fx - fr, fy - fr, fr * 2, fr * 2);
    }
  });
  // ICE PROJECTION (before puck drop and in intermissions): team-colour waves, the logo assembling, fire racing up the ice, a countdown
  if (FX.projection && mode === 'show' && !((ALS.spot || 0) > 0.2) && main) rk(() => {
    const ph = t % 960;
    if (ph < 320) {
      for (let k = 0; k < 6; k++) {
        const off = ((ph * 2.4 + k * 110) % 760) - 120, yb = R.b - off;
        c.fillStyle = hexA(k % 2 ? T0.trim : T0.main, 0.3 * L); c.beginPath();
        c.moveTo(R.l * u, yb * u); c.lineTo(R.r * u, (yb - 70) * u); c.lineTo(R.r * u, (yb - 44) * u); c.lineTo(R.l * u, (yb + 26) * u); c.closePath(); c.fill();
      }
    } else if (ph < 560) {
      const q = Math.min(1, (ph - 320) / 150), img = arenaGobo(T0), gr = 46 * u, n = 4;
      if (img) for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
        const fly = (1 - q) * (1 - q), sw = img.width / n, sh = img.height / n;
        c.globalAlpha = Math.min(1, 0.15 + 0.7 * q) * L;
        c.drawImage(img, a * sw, b * sh, sw, sh, CX * u - gr + a * 2 * gr / n + (a - 1.5) * 150 * fly * u, CY * u - gr + b * 2 * gr / n + (b - 1.5) * 230 * fly * u, 2 * gr / n + 0.5, 2 * gr / n + 0.5);
      }
      c.globalAlpha = 1;
      if (q >= 1) for (let k = 0; k < 3; k++) { const rr = ((ph - 470 + k * 30) % 90) * 2.2; if (rr <= 0) continue; c.strokeStyle = hexA(T0.trim, 0.45 * (1 - rr / 200) * L); c.lineWidth = 3 * u; c.beginPath(); c.arc(CX * u, CY * u, (48 + rr) * u, 0, Math.PI * 2); c.stroke(); }
    } else if (ph < 720) {
      const q = (ph - 560) / 160, fy = R.b + 30 - (R.b - R.t + 90) * q;
      for (let x = R.l; x < R.r; x += 3) {
        const hg = 22 + 10 * Math.sin(x * 0.31 + t * 0.55) + 7 * Math.sin(x * 0.13 - t * 0.33);
        for (const [hh, col, a] of [[1, '#ff3b1d', 0.32], [0.62, '#ff9a2a', 0.4], [0.3, '#fff2a0', 0.5]]) { c.fillStyle = hexA(col, a * L); c.fillRect(x * u, (fy - hg * hh) * u, 3 * u, (hg * hh + 8) * u); }
      }
      c.fillStyle = `rgba(255,120,40,${0.12 * L})`; c.fillRect(R.l * u, (fy + 8) * u, (R.r - R.l) * u, 60 * u);   // the scorched trail
    } else {
      const n = 3 - Math.floor((ph - 720) / 80), q = ((ph - 720) % 80) / 80;
      c.font = `${Math.round((64 + 16 * q) * u)}px 'PH Pixel', monospace`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.globalCompositeOperation = 'source-over'; c.fillStyle = hexA('#05060d', 0.55 * (1 - q) * L); c.fillText(String(Math.max(1, n)), (CX + 3) * u, (CY + 3) * u);
      c.globalCompositeOperation = 'lighter'; c.fillStyle = hexA('#ffffff', (0.95 - 0.55 * q) * L); c.fillText(String(Math.max(1, n)), CX * u, CY * u);
      c.fillStyle = hexA(T0.trim, (0.5 - 0.3 * q) * L); c.fillText(String(Math.max(1, n)), CX * u, CY * u);
      c.strokeStyle = hexA(T0.main, 0.5 * (1 - q) * L); c.lineWidth = 4 * u; c.beginPath(); c.arc(CX * u, CY * u, (60 + 80 * q) * u, 0, Math.PI * 2); c.stroke();
    }
  });
  // PYRO & CO2: flame jets at the tunnel in the walkout, and round the home end on a home goal
  if (FX.pyro && main) {
    const homeGoal = mode === 'goal' && S.cheerKind !== 'away' && sinceGoal < 170;
    const on = walk ? (t % 150) < 50 : homeGoal ? (sinceGoal % 56) < 34 : false, co2 = walk ? (t % 300) >= 150 : sinceGoal > 110;
    const jets = [[TUN.x1 + 6, TUN.y0 - 8], [TUN.x1 + 6, TUN.y1 + 8], [R.l - 12, R.t + 30], [R.r + 12, R.t + 30], [R.l - 12, R.b - 30], [R.r + 12, R.b - 30]];
    if (on || co2) for (const [jx, jy] of jets) {
      const env = walk ? Math.sin(Math.PI * ((t % 150) / 50)) : Math.sin(Math.PI * ((sinceGoal % 56) / 34));
      if (on && !co2 && env > 0) {
        const hg = 78 * env;
        const g = c.createRadialGradient(jx * u, jy * u, 0, jx * u, jy * u, 34 * u); g.addColorStop(0, `rgba(255,150,60,${0.45 * env * L})`); g.addColorStop(1, 'rgba(255,150,60,0)');
        c.fillStyle = g; c.fillRect((jx - 34) * u, (jy - 34) * u, 68 * u, 68 * u);
        for (let yy = 0; yy < hg; yy += 2) {
          const f = yy / hg, w = (12 - 8 * f) + Math.sin(t * 0.9 + yy) * 2, col = f < 0.2 ? '#fffbe0' : f < 0.45 ? '#ffd23f' : f < 0.75 ? '#ff7a1d' : '#d9342b';
          c.fillStyle = hexA(col, (0.9 - 0.5 * f) * L); c.fillRect((jx - w / 2 + Math.sin(t * 0.7 + yy * 0.5) * f * 3) * u, (jy - yy - 2) * u, w * u, 2.2 * u);
        }
      } else if (co2) {
        const q = walk ? ((t % 150) / 150) : Math.min(1, (sinceGoal - 110) / 60);
        for (let k = 0; k < 5; k++) { const rr = (6 + 30 * q) * (0.6 + k * 0.12); c.fillStyle = `rgba(235,240,255,${0.16 * (1 - q) * L})`; c.beginPath(); c.arc((jx + Math.sin(k * 2.3) * 8 * q) * u, (jy - 10 - k * 9 * q) * u, rr * u, 0, Math.PI * 2); c.fill(); }
      }
    }
  }
  // MIRROR BALL: sparkles wheeling over the ice and the crowd
  if (FX.mirror && (mode === 'show' || mode === 'goal')) {
    const ext = Math.max(W, H);
    for (let i = 0; i < 90; i++) {
      const a = i * 2.39996 + t * 0.006 * (mode === 'goal' ? 2 : 1), rr = (0.08 + (i * 0.618 % 1)) * ext * 0.75;
      const sx = (CX + Math.cos(a) * rr * 0.9) * u, sy = (CY + Math.sin(a) * rr * 1.15) * u, fl = 0.5 + 0.5 * Math.sin(t * 0.35 + i * 1.3);
      if (sx < x0 - 4 || sx > x1 + 4 || sy < y0 - 4 || sy > y1 + 4) continue;
      c.fillStyle = `rgba(255,255,255,${0.75 * fl * L})`; c.fillRect(sx - 1.2 * u, sy - 1.2 * u, 2.4 * u, 2.4 * u);
      if (fl > 0.85) { c.fillStyle = `rgba(255,255,255,${0.35 * L})`; c.fillRect(sx - 4 * u, sy - 0.4 * u, 8 * u, 0.8 * u); c.fillRect(sx - 0.4 * u, sy - 4 * u, 0.8 * u, 8 * u); }
    }
  }
  // NORTHERN LIGHTS: curtains of green, teal and violet ripple slowly across the ice (and drift up over the crowd)
  if (FX.aurora && (mode === 'show' || mode === 'goal')) {
    const ext = Math.max(W, H), cols = ['#2ee6a6', '#1fd0c8', '#7b4fd6', '#3aff9a'];
    for (let k = 0; k < 3; k++) {
      const base = CY - H * 0.55 + k * H * 0.5 + Math.sin(t * 0.004 + k * 2) * 60;
      for (let x = CX - ext * 0.9; x < CX + ext * 0.9; x += 4) {
        const sx = x * u; if (sx < x0 - 8 || sx > x1 + 8) continue;
        const wave = Math.sin(x * 0.012 + t * 0.013 + k * 1.7) * 70 + Math.sin(x * 0.031 - t * 0.021 + k) * 26, top = base + wave;
        const len = 120 + 60 * Math.sin(x * 0.02 + t * 0.017 + k * 3), sh = 0.5 + 0.5 * Math.sin(x * 0.05 + t * 0.06 + k * 4);
        const col = cols[(k + (Math.floor(x / 90) & 1)) % cols.length], sy = top * u;
        if (sy > y1 || sy + len * u < y0) continue;
        const g = c.createLinearGradient(0, sy, 0, sy + len * u); g.addColorStop(0, hexA(col, 0)); g.addColorStop(0.2, hexA(col, (0.14 + 0.26 * sh) * L)); g.addColorStop(0.55, hexA(col, 0.12 * sh * L)); g.addColorStop(1, hexA(col, 0));
        c.fillStyle = g; c.fillRect(sx, sy, 4 * u, len * u);
      }
    }
  }
  // SEARCHLIGHTS: four big white beams from the corners of the rig, sweeping slowly over the ice and up into the stands
  if (FX.search && (mode === 'show' || mode === 'goal')) {
    const spd = mode === 'goal' ? 2.4 : 1, hmT = TEAM[S.match.home ?? 0], len = Math.max(W, H) * 1.6;
    [[CX - W * 0.62, CY - H * 0.7], [CX + W * 0.62, CY - H * 0.7], [CX - W * 0.62, CY + H * 0.7], [CX + W * 0.62, CY + H * 0.7]].forEach(([ox, oy], i) => {
      const toC = Math.atan2(CY - oy, CX - ox), a = toC + Math.sin(t * 0.008 * spd + i * 1.9) * 0.75, wid = 0.075;
      const col = mode === 'goal' && i % 2 ? hmT.trim : '#f4f8ff';
      const ax = ox * u, ay = oy * u, bx1 = (ox + Math.cos(a - wid) * len) * u, by1 = (oy + Math.sin(a - wid) * len) * u, bx2 = (ox + Math.cos(a + wid) * len) * u, by2 = (oy + Math.sin(a + wid) * len) * u;
      const g = c.createLinearGradient(ax, ay, (ox + Math.cos(a) * len) * u, (oy + Math.sin(a) * len) * u); g.addColorStop(0, hexA(col, 0.2 * L)); g.addColorStop(0.5, hexA(col, 0.09 * L)); g.addColorStop(1, hexA(col, 0));
      c.fillStyle = g; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx1, by1); c.lineTo(bx2, by2); c.closePath(); c.fill();
      c.fillStyle = hexA(col, 0.5 * L); c.beginPath(); c.arc(ax, ay, 5 * u, 0, Math.PI * 2); c.fill();
    });
  }
  // LIGHTNING STORM: every few seconds a bolt cracks across the ice, the whole building flashes, thunder-white
  if (FX.storm && (mode === 'show' || mode === 'goal')) {
    const per = mode === 'goal' ? 70 : 130, n = Math.floor(t / per), ph = t % per;
    if (ph < 16) {
      const rnd = k => { const v = Math.sin(n * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
      const fl = ph < 3 ? 1 : ph < 6 ? 0.35 : ph < 8 ? 0.8 : Math.max(0, 1 - (ph - 8) / 8);
      c.fillStyle = hexA('#dfe8ff', 0.22 * fl * L); c.fillRect(x0, y0, x1 - x0, y1 - y0);
      if (main) rk(() => {
        let px0 = R.l + (R.r - R.l) * (0.15 + 0.7 * rnd(1)), py0 = R.t - 10, tx = R.l + (R.r - R.l) * rnd(2), ty = R.b + 10;
        const pts = [[px0, py0]], steps = 14;
        for (let k = 1; k <= steps; k++) { const q = k / steps; pts.push([px0 + (tx - px0) * q + (rnd(10 + k) - 0.5) * 70, py0 + (ty - py0) * q]); }
        for (const [lw, col, a] of [[9, '#7fb0ff', 0.25], [4, '#cfe0ff', 0.6], [1.6, '#ffffff', 1]]) {
          c.strokeStyle = hexA(col, a * fl * L); c.lineWidth = lw * u; c.lineJoin = 'miter'; c.beginPath(); pts.forEach(([x, y], k) => k ? c.lineTo(x * u, y * u) : c.moveTo(x * u, y * u)); c.stroke();
        }
        const bi = 4 + Math.floor(rnd(30) * 6), [bx0, by0] = pts[bi];                         // a fork off the main bolt
        c.strokeStyle = hexA('#e8f0ff', 0.7 * fl * L); c.lineWidth = 1.2 * u; c.beginPath(); c.moveTo(bx0 * u, by0 * u);
        for (let k = 1; k <= 5; k++) c.lineTo((bx0 + k * (rnd(40) > 0.5 ? 14 : -14) + (rnd(40 + k) - 0.5) * 18) * u, (by0 + k * 20) * u); c.stroke();
        const [ex, ey] = pts[pts.length - 2], gg = c.createRadialGradient(ex * u, ey * u, 0, ex * u, ey * u, 60 * u); gg.addColorStop(0, hexA('#cfe0ff', 0.35 * fl * L)); gg.addColorStop(1, hexA('#cfe0ff', 0));
        c.fillStyle = gg; c.fillRect((ex - 60) * u, (ey - 60) * u, 120 * u, 120 * u);
      });
    }
  }
  // LED CHASE: on a goal, lights race round the boards in the scoring team's colours
  const oShow = typeof outroShowOn === 'function' && outroShowOn();
  if (((mode === 'goal' && sinceGoal < 240) || oShow) && main) {
    const sc = oShow && S.outro.result ? TEAM[S.outro.result.winner ?? hm] || TEAM[hm] : TEAM[S.cheerKind === 'away' ? 1 - hm : hm], bx = R.l - 3, by = R.t - 4, bw = R.r - R.l + 6, bh = R.b - R.t + 8, br = R.cr + 3;
    const sL = bw - 2 * br, sH = bh - 2 * br, arc = Math.PI * br / 2, per = 2 * sL + 2 * sH + 4 * arc;
    const at = d => { d = ((d % per) + per) % per;
      if (d < sL) return [bx + br + d, by]; d -= sL; if (d < arc) { const a = -Math.PI / 2 + d / br; return [bx + bw - br + Math.cos(a) * br, by + br + Math.sin(a) * br]; } d -= arc;
      if (d < sH) return [bx + bw, by + br + d]; d -= sH; if (d < arc) { const a = d / br; return [bx + bw - br + Math.cos(a) * br, by + bh - br + Math.sin(a) * br]; } d -= arc;
      if (d < sL) return [bx + bw - br - d, by + bh]; d -= sL; if (d < arc) { const a = Math.PI / 2 + d / br; return [bx + br + Math.cos(a) * br, by + bh - br + Math.sin(a) * br]; } d -= arc;
      if (d < sH) return [bx, by + bh - br - d]; d -= sH; { const a = Math.PI + d / br; return [bx + br + Math.cos(a) * br, by + br + Math.sin(a) * br]; } };
    const fade = oShow ? Math.min(1, (S.outro.show || 0) / 40, (OUTRO_PRE.show - (S.outro.show || 0)) / 30) : Math.min(1, (240 - sinceGoal) / 60), cols = [sc.main, sc.trim, '#ffffff'];
    for (let d = 0, k = 0; d < per; d += 9, k++) { const [px, py] = at(d + t * 4); c.fillStyle = hexA(cols[k % 3], 0.9 * fade * L); c.fillRect((px - 1.6) * u, (py - 1.6) * u, 3.2 * u, 3.2 * u); }
  }
  c.restore();
}
function arenaLightsPaint(c, u, x0, y0, x1, y1) {
  const L = ALS.lvl, mode = ALS.mode, t = S.t;
  if (!L || !mode) return;
  const style = alsStyle(); if (style !== 'classic' || mode === 'alien') return alsPaintStyled(c, u, x0, y0, x1, y1, mode === 'alien' ? 'stage' : style);
  const hm = S.match.home ?? 0, cols = mode === 'goal' ? [TEAM[S.cheerKind === 'away' ? 1 - hm : hm].main, '#ffffff', TEAM[S.cheerKind === 'away' ? 1 - hm : hm].trim] : mode === 'show' ? ['#fff3d0', '#9fd0ff', '#ffd23f', '#ff9ad8'] : ['#fff6e0'];
  c.save();
  const focus = mode === 'show' && (ALS.spot || 0) > 0 && ALS.fx != null && !((ALS.post || 0) > 75) ? ALS.spot : 0;
  if (focus > 0) {
    // everything goes dark except a pool of light around the man in the spotlight
    const fx = ALS.fx * u, fy = (ALS.fy - 6) * u, inner = 16 * u, outer = 70 * u, dark = (0.4 + 0.32 * focus) * L;
    c.fillStyle = `rgba(4,6,22,${dark})`;
    c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.arc(fx, fy, outer, 0, Math.PI * 2, true); c.fill('evenodd');
    const hg = c.createRadialGradient(fx, fy, inner, fx, fy, outer); hg.addColorStop(0, 'rgba(4,6,22,0)'); hg.addColorStop(1, `rgba(4,6,22,${dark})`);
    c.fillStyle = hg; c.beginPath(); c.arc(fx, fy, outer, 0, Math.PI * 2); c.fill();
  } else { c.fillStyle = `rgba(4,6,22,${(mode === 'break' ? 0.22 : 0.4) * L})`; c.fillRect(x0, y0, x1 - x0, y1 - y0); }
  c.globalCompositeOperation = 'lighter';
  const n = mode === 'break' ? 3 : 5, ax = W * 0.7, ay = H * 0.42, spd = mode === 'goal' ? 2.2 : 1;
  for (let i = 0; i < n; i++) {
    const post = mode === 'show' ? (ALS.post || 0) : 0, dance = post > 0 && post < 75 ? 2.6 : 1;     // the scatter: lights race around
    const gather = post > 75 ? Math.min(1, (post - 75) / 28) : 0;
    const ph = i * 2.1, k = mode === 'show' ? Math.max(ALS.spot || 0, gather) : 0;
    let wx = CX + ax * Math.sin(t * 0.011 * spd * dance + ph) * (0.6 + 0.4 * Math.sin(t * 0.004 + i)), wy = CY + ay * Math.sin(t * 0.0083 * spd * dance + ph * 1.7);
    if (gather > 0) {                                                                        // on the opening faceoff
      const fx = S.fo ? S.fo.x : CX, fy = S.fo ? S.fo.y : CY;
      const jx = fx + Math.sin(t * 0.04 + ph) * 6, jy = fy - 6 + Math.cos(t * 0.037 + ph) * 5;
      wx += (jx - wx) * gather; wy += (jy - wy) * gather;
    }
    if (k > 0 && gather === 0 && ALS.fx != null) {                                         // converge on the starter, a little jitter each
      const jx = ALS.fx + Math.sin(t * 0.05 + ph) * 3, jy = ALS.fy - 8 + Math.cos(t * 0.043 + ph) * 3;
      wx += (jx - wx) * k; wy += (jy - wy) * k;
    }
    const x = wx * u, y = wy * u, r = (mode === 'break' ? 46 : 58 - (gather > 0 ? 12 : 24) * k) * u, col = k > 0.5 ? (i % 2 ? '#fff3d0' : '#ffffff') : cols[i % cols.length];
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    const am = 1 - 0.84 * k;                                                                  // stacked on one man, each light is dimmer
    g.addColorStop(0, hexA(col, 0.42 * L * am)); g.addColorStop(0.55, hexA(col, 0.18 * L * am)); g.addColorStop(1, hexA(col, 0));
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    if (mode !== 'break') {                                                                 // the beam down from the light rig
      const rx = (CX + (i - (n - 1) / 2) * W * 0.35) * u, ry = (CY - H * 0.75) * u;
      c.fillStyle = hexA(col, 0.06 * L * (1 - 0.5 * k)); c.beginPath(); c.moveTo(rx - 3 * u, ry); c.lineTo(rx + 3 * u, ry); c.lineTo(x + r * 0.7, y); c.lineTo(x - r * 0.7, y); c.closePath(); c.fill();
    }
  }
  if (focus > 0.3) {
    const rank = S.outro && S.outro.cur && S.outro.cur.star ? S.outro.cur.rank : -1;
    const tint = ['#ffe08a', '#e8f0ff', '#ffc49a'][rank] || '#fff3d0';
    const fx = ALS.fx * u, fy = (ALS.fy - 6) * u, r = 22 * u, a = (focus - 0.3) / 0.7 * L;
    const sg = c.createRadialGradient(fx, fy, 0, fx, fy, r);
    sg.addColorStop(0, hexA(tint, 0.2 * a)); sg.addColorStop(0.8, hexA(tint, 0.15 * a)); sg.addColorStop(0.93, hexA(tint, 0.28 * a)); sg.addColorStop(1, hexA(tint, 0));   // softer in the middle so the player reads clearly
    c.fillStyle = sg; c.fillRect(fx - r, fy - r, r * 2, r * 2);
  }
  // the home team's logo, projected on the ice by its own light, sweeping slowly around the rink
  if ((mode === 'show' && focus < 0.2) || mode === 'goal') {
    const T0 = TEAM[hm], img = arenaGobo(T0);
    if (img) {
      const gx = (CX + 110 * Math.sin(t * 0.0061 + 0.7)) * u, gy = (CY + 200 * Math.sin(t * 0.0039)) * u, gr = 34 * u;
      const gl = c.createRadialGradient(gx, gy, 0, gx, gy, gr * 1.25); gl.addColorStop(0, `rgba(255,250,235,${0.32 * L})`); gl.addColorStop(1, 'rgba(255,250,235,0)');
      c.fillStyle = gl; c.fillRect(gx - gr * 1.3, gy - gr * 1.3, gr * 2.6, gr * 2.6);
      c.globalAlpha = 0.55 * L; c.drawImage(img, gx - gr, gy - gr * 0.92, gr * 2, gr * 1.84); c.globalAlpha = 1;
    }
  }
  if (mode === 'goal' && ((t >> 3) % 5 === 0)) { c.fillStyle = hexA(cols[0], 0.10 * L); c.fillRect(x0, y0, x1 - x0, y1 - y0); }   // strobe
  c.restore();
}
// the logo slide for the gobo light (drawn once per team, slightly squashed as if projected at an angle)
function arenaGobo(T0) {
  if (!T0 || typeof drawEmblemBadge !== 'function') return null;
  const key = (T0.abbr || '') + (T0.emblem || '') + (T0.main || '');
  if (ALS.goboKey === key) return ALS.gobo;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  try { drawEmblemBadge(c, T0, 64, 64, 58); } catch (e) { return null; }
  ALS.gobo = cv; ALS.goboKey = key; return cv;
}
function hexA(col, a) {
  let s = String(col).replace('#', ''); if (s.length === 3) s = s.split('').map(ch => ch + ch).join('');
  const n = parseInt(s.slice(0, 6), 16); if (isNaN(n)) return `rgba(255,255,255,${a})`;
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}
function arenaLightsWorld() {
  if (!arenaLightsTick()) return;
  ctx.save(); toWorld();
  try { arenaLightsPaint(ctx, 1, camX - 20, camY - 20, camX + viewW() + 40, camY + viewH() + 40); } finally { ctx.restore(); }
}
function arenaLightsSide(c, x0, y0, x1, y1) { if (ALS.lvl > 0) arenaLightsPaint(c, 1 / SS, x0, y0, x1, y1); }
