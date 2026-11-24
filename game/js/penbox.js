// ====================================================================
//  PENALTY BOXES: across the ice from the benches, at centre: the home box, the off-ice officials' booth, the
//  visitors' box. One man per team in the box (more penalties add time to him, see rules.js). He skates over,
//  the attendant opens the door, he sits down (the door slams), the penalty clock over the box counts down, and
//  when his time is up he jumps back into the play through the door.
//  Drawn from worldItems (engine.js), so it shows on the rink view and the stands canvas beside it.
//  Pure drawing in drawPenBoxes; all timing/state changes happen in pbTick / pbEnter / pbRelease.
// ====================================================================
const PBX = { x0: R.r + 6, x1: R.r + 40, len: 42, gap: 4 };     // the boxes' inner wall (the boards) and back wall
PBX.box = [{ y0: CY - 18 - PBX.len, y1: CY - 18 }, { y0: CY + 18, y1: CY + 18 + PBX.len }];   // [top box, bottom box]
PBX.booth = { y0: CY - 14, y1: CY + 14 };
// which box a team uses: the home team the top one (its bench is the top one too)
const pbIdx = t => (t === ((S.match && S.match.home) ?? 0) ? 0 : 1);
const pbBox = t => PBX.box[pbIdx(t)];
// the door in the boards: the middle of the box; hinge at the end away from the booth, the door swings into the box
const pbDoor = t => { const b = pbBox(t), top = pbIdx(t) === 0, m = (b.y0 + b.y1) / 2; return { y0: m - 9, y1: m + 9, hinge: top ? m - 9 : m + 9, s: top ? 1 : -1 }; };
const pbSeat = t => { const b = pbBox(t); return { x: PBX.x1 - 7, y: (b.y0 + b.y1) / 2 + 9 }; };   // (feet; the bench is along the back wall)
const pbAttend = t => { const b = pbBox(t), top = pbIdx(t) === 0; return { x: PBX.x0 + 8, y: top ? b.y1 - 4 : b.y0 + 22 }; };
// seats taken out of the stands for the boxes (crowd.js / buildCrowd)
const pbOffLimits = (wx0, wx1, wy0, wy1) => wx1 > PBX.x0 - 2 && wx0 < PBX.x1 + 6 && wy1 > PBX.box[0].y0 - 6 && wy0 < PBX.box[1].y1 + 6;

const pbPal = () => typeof enclPal === 'function' ? enclPal() : { wall: '#080a16', floor: '#2b3150', pat: 'mat', frame: '#0b0e1e', hall: '#262b48', booth: '#3b3f58', trim: null };
function PBS() {
  if (!MS) return null;
  if (!MS.pb) MS.pb = { enter: [null, null], out: [null, null], ghost: [null, null], tap: [null, null], tapNext: [0, 0], slump: [0, 0], door: [-999, -999], bang: null, bangNext: 0, phoneT: -999, goalRef: null };
  return MS.pb;
}
const pbLive = () => !S.fastSim && !S.demo;

// ---------- events (state changes)
// a player is sent off: he skates from where he is to the box door, steps in, the door slams behind him
function pbEnter(t, pl) {
  const P = PBS(); if (!P || !pl || S.fastSim) return;
  const o = players.find(p => p.pl === pl && p.team === t && !p.g), D = pbDoor(t);
  const fx = o ? o.x : CX, fy = o ? o.y : CY, tx = R.r - 8, ty = (D.y0 + D.y1) / 2;
  const travel = Math.round(clamp(hyp(tx - fx, ty - fy) / 2.4, 16, 110));
  P.enter[t] = { pl, t0: S.t, fx, fy, tx, ty, travel, sitAt: travel + 16, slamAt: travel + 20, done: travel + 24 };
  P.ghost[t] = null; P.slump[t] = 0;
}
// his time is up: through the door and straight back into the play (taking the place of the teammate furthest
// from the puck, who heads for the bench). After a power-play goal there is no play to jump into: he sits a
// moment, head down, then skates off to his bench.
function pbRelease(t, pid, why) {
  const P = PBS(); if (!P) return;
  const pl = typeof dressedSkaters === 'function' ? dressedSkaters(t).find(q => q.id === pid) : null;
  P.enter[t] = null; P.tap[t] = null;
  if (!pl || S.fastSim) return;
  const D = pbDoor(t), dy = (D.y0 + D.y1) / 2;
  if (why === 'time' && S.phase === 'live' && !(typeof isOutPid === 'function' && isOutPid(pid)) && !onIceIds(t).has(pid)) {
    const c = teamSkaters(t).filter(p => p.pl && p !== puck.owner && (p !== ctrl || S.autoAI) && !p.chgOut).sort((a, b) => dist(b, puck) - dist(a, puck))[0];
    if (c) {
      P.out[t] = { kind: 'toBench', pl: c.pl, t0: S.t, fx: c.x, fy: c.y, dur: Math.round(clamp(hyp(R.l + 10 - c.x, CY - c.y) / 1.7, 30, 200)) };   // at skating speed
      seat(c, pl); resetPlayerState(c);
      c.x = R.r - 7; c.y = dy; c.mx = c.x; c.my = c.y; c.vx = -1.6; c.vy = 0; c.fx = -1; c.fy = 0; c.chgOut = null; c.chgGo = false;
      P.door[pbIdx(t)] = S.t;
      if (typeof refreshEff === 'function') refreshEff();
      return;
    }
  }
  P.ghost[t] = { pl, t0: S.t, wait: why === 'goal' ? 150 : 30, slump: why === 'goal' };
}
// a power-play goal against while he still has time to serve: head down
function pbSlump(t) { const P = PBS(); if (P) P.slump[t] = S.t + 240; }

// each frame (update): scheduled sounds, reactions, the crowd at the visitors' box, the phone on a goal
function pbTick() {
  const P = PBS(); if (!P || S.so || !S.match) return;
  const r = typeof RS === 'function' ? RS() : null, hm = S.match.home ?? 0, quiet = !pbLive() || S.screen !== 'play';
  for (const t of [0, 1]) {
    const e = P.enter[t];
    if (e) { const k = S.t - e.t0; if (k === e.slamAt && !quiet) { sfx.glass(0); P.door[pbIdx(t)] = -999; } if (k > e.done) P.enter[t] = null; }
    if (P.ghost[t] && S.t - P.ghost[t].t0 > P.ghost[t].wait + 200) P.ghost[t] = null;
    if (P.out[t] && S.t - P.out[t].t0 > P.out[t].dur) P.out[t] = null;
    // now and then he bangs his stick on the floor (impatient), never while slumped
    const inBox = r && pbSeated(t, r);
    if (inBox && !P.enter[t] && S.t > P.slump[t] && (!P.tap[t] || S.t > P.tap[t].t0 + 40) && S.t >= P.tapNext[t] && S.phase === 'live') {
      if (Math.random() < 0.02) { P.tap[t] = { t0: S.t }; P.tapNext[t] = S.t + 360 + Math.random() * 600; }
    }
  }
  // the home fans behind the visitors' box bang on its glass while a visitor is sitting in there
  const vis = 1 - hm, occupied = r && (pbSeated(vis, r) || P.ghost[vis]);
  if (occupied && S.t >= P.bangNext && S.screen === 'play') {
    const b = pbBox(vis), n = 2 + ((Math.random() * 2) | 0), fists = [];
    for (let i = 0; i < n; i++) fists.push({ y: b.y0 + 6 + Math.random() * (b.y1 - b.y0 - 12), ph: Math.random() * 6 });
    P.bang = { t0: S.t, fists }; P.bangNext = S.t + 90 + Math.random() * 180;
    if (!quiet) noise(0.09, 0.035, 220, 'lowpass', 0.9);
  }
  if (P.bang && S.t - P.bang.t0 > 30) P.bang = null;
  // a goal: one of the scorekeepers picks up the phone to the league
  if (MS.lastGoal && MS.lastGoal !== P.goalRef) {
    P.goalRef = MS.lastGoal; P.phoneT = S.t;
    if (occupied && MS.lastGoal.team === hm) P.bangNext = S.t + 4;          // and the fans let the visitor hear it
  }
}
// who is actually sitting in a team's box (not still skating over)
function pbSeated(t, r) {
  const pid = Object.keys(r.box || {}).find(id => r.box[id] && typeof dressedSkaters === 'function' && dressedSkaters(t).some(q => String(q.id) === String(id)));
  return pid ? dressedSkaters(t).find(q => String(q.id) === String(pid)) : null;
}

// ---------- the static part (baked into the rink image): floors, walls, benches, the booth, the doors
function drawPenBoxStatic(c, H0, H1) {
  const X0 = PBX.x0, X1 = PBX.x1, top = PBX.box[0].y0, bot = PBX.box[1].y1, EP = pbPal();
  c.fillStyle = EP.wall; c.fillRect(X0 - 1, top - 4, X1 - X0 + 5, bot - top + 8);                  // the walls round it all
  for (const [i, T] of [[0, H0], [1, H1]]) {
    const b = PBX.box[i], y0 = b.y0, y1 = b.y1;
    if (typeof drawEnclFloor === 'function') drawEnclFloor(c, X0, y0, X1 - X0, y1 - y0, EP); else { c.fillStyle = EP.floor; c.fillRect(X0, y0, X1 - X0, y1 - y0); }                                                     // the floor, in the building's style
    drawLogo(c, T, (X0 + X1) / 2 - 4, (y0 + y1) / 2, 5, 0.22);
    c.fillStyle = T.dark; c.fillRect(X1, y0 - 3, 3, y1 - y0 + 6); c.fillStyle = T.main; c.fillRect(X1, y0 - 3, 1.5, y1 - y0 + 6);   // back wall in team colours
    c.fillStyle = EP.frame; c.fillRect(X1 - 10, y0 + 5, 9, y1 - y0 - 10);                              // the bench along the back wall
    c.fillStyle = T.main; c.fillRect(X1 - 9, y0 + 6, 7, y1 - y0 - 12); c.fillStyle = shade(T.main, 0.18); c.fillRect(X1 - 9, y0 + 6, 7, 1);
    c.fillStyle = 'rgba(170,210,255,.22)'; c.fillRect(X0, i === 0 ? y0 - 2 : y1 + 1, X1 - X0, 1);       // glass on the end partition
  }
  // the off-ice officials' booth: a desk along the boards side, papers, the phone, a game clock
  const B = PBX.booth;
  c.fillStyle = EP.booth; c.fillRect(X0, B.y0, X1 - X0, B.y1 - B.y0);
  if (EP.trim) { c.fillStyle = EP.trim; c.fillRect(X0, B.y0, X1 - X0, 0.6); c.fillRect(X0, B.y1 - 0.6, X1 - X0, 0.6); }
  c.fillStyle = 'rgba(170,210,255,.22)'; c.fillRect(X0, B.y0 - 2, X1 - X0, 1); c.fillRect(X0, B.y1 + 1, X1 - X0, 1);
  c.fillStyle = '#4a321f'; c.fillRect(X0 + 1, B.y0 + 2, 7, B.y1 - B.y0 - 4); c.fillStyle = '#6a4a2e'; c.fillRect(X0 + 1, B.y0 + 2, 7, 1);
  c.fillStyle = '#e8ecf4'; c.fillRect(X0 + 2.5, B.y0 + 9, 3.5, 4.5); c.fillRect(X0 + 2, CY + 3, 4, 5);
  c.fillStyle = '#3a3f58'; c.fillRect(X0 + 3, B.y0 + 10, 2.5, 0.4); c.fillRect(X0 + 3, B.y0 + 11.2, 2.5, 0.4); c.fillRect(X0 + 2.5, CY + 4.5, 3, 0.4);
  c.fillStyle = '#16171d'; c.fillRect(X0 + 1.6, B.y0 + 3, 4.4, 4.4);                                   // the phone's base
  c.fillStyle = '#d9342b'; c.fillRect(X0 + 2.2, B.y0 + 3.4, 1.2, 3.6);
  c.fillStyle = '#05070f'; c.fillRect(X1 - 9, CY - 3, 9, 6); c.fillStyle = '#ffd23f'; c.fillRect(X1 - 8, CY - 0.5, 7, 1);   // the timekeeper's console
}
// the box doors in the boards (closed; drawn open live). Drawn after the boards, like the bench gates
function drawPenBoxDoors(c) {
  for (const i of [0, 1]) {
    const b = PBX.box[i], m = (b.y0 + b.y1) / 2;
    c.fillStyle = '#dfe4ee'; c.fillRect(R.r, m - 9, 6, 18);
    c.fillStyle = '#8a93a8'; c.fillRect(R.r, m - 9, 6, 1); c.fillRect(R.r, m + 8, 6, 1); c.fillRect(R.r + 5, m - 9, 1, 18);
    c.fillStyle = '#5d6480'; c.fillRect(R.r + 4.5, i === 0 ? m - 7 : m + 4, 1.5, 3);                     // hinge
    c.fillStyle = '#3a3f58'; c.fillRect(R.r + 0.5, m - 1.5, 1.5, 3);                                     // latch
  }
}

// ---------- each frame (pure drawing)
function drawPenBoxes(near) {
  if (!S.match || !MS || S.so || (near && !near(PBX.x0 + 10))) return;
  const P = PBS(), r = typeof RS === 'function' ? RS() : null, hm = S.match.home ?? 0;
  if (!P || !r) return;
  const figs = [];
  for (const t of [0, 1]) {
    const T = TEAM[t], D = pbDoor(t), seatP = pbSeat(t), att = pbAttend(t), e = P.enter[t], g = P.ghost[t];
    const k = e ? S.t - e.t0 : 999;
    // the door: open while he steps in, while a ghost steps out, or just after a release
    let open = 0;
    if (e) open = k < e.travel - 10 ? 0 : k < e.slamAt ? Math.min(1, (k - (e.travel - 10)) / 8) : 0;
    if (g) { const gk = S.t - g.t0 - g.wait; if (gk > -8 && gk < 40) open = Math.max(open, Math.min(1, (gk + 8) / 8, (40 - gk) / 8)); }
    const sinceRel = S.t - P.door[pbIdx(t)]; if (sinceRel >= 0 && sinceRel < 36) open = Math.max(open, Math.min(1, sinceRel / 6, (36 - sinceRel) / 8));
    if (open > 0) figs.push({ y: -1e6, d: () => pbDrawDoor(D, open) });
    // the attendant: by the door, reaching for it when it opens
    figs.push({ y: att.y, d: () => drawOfficial(att.x, att.y, { faceLeft: true, arm: open > 0.2 ? 'door' : null, coat: '#1b2a4a', skin: t === hm ? '#e8b48a' : '#a8714a', hair: t === hm ? '#5a3a1e' : '#1a1a1a' }) });
    // the man in the box
    const pl = pbSeated(t, r);
    if (e && k < e.sitAt) {                                   // still on his way: skating over, then through the door
      const pos = k < e.travel ? (() => { const u = k / e.travel, q = u * (2 - u); return { x: e.fx + (e.tx - e.fx) * q, y: e.fy + (e.ty - e.fy) * q, fx: e.tx - e.fx, fy: e.ty - e.fy }; })()
        : (() => { const u = (k - e.travel) / (e.sitAt - e.travel); return { x: e.tx + (seatP.x - 4 - e.tx) * u, y: e.ty + (seatP.y - e.ty) * u, fx: 1, fy: 0 }; })();
      const m = hyp(pos.fx, pos.fy) || 1, f = fakeSkater({ x: pos.x, y: pos.y, team: t, pl: e.pl, num: e.pl.num, fx: pos.fx / m, fy: pos.fy / m, vx: pos.fx / m * 2, vy: pos.fy / m * 2, anim: S.t * 0.25, hand: e.pl.hand || 'L' });
      figs.push({ y: pos.y, d: () => drawSkater(f) });
    } else if (pl || g) {
      const who = pl || g.pl, gk = g ? S.t - g.t0 - g.wait : -1;
      if (g && gk >= 0) {                                      // a ghost leaving: out of the door, then away to his bench
        const u = Math.min(1, gk / 14), x = gk < 14 ? seatP.x - 4 + (R.r - 8 - (seatP.x - 4)) * u : R.r - 8 - (gk - 14) * 2.2, y = gk < 14 ? seatP.y + ((D.y0 + D.y1) / 2 - seatP.y) * u : (D.y0 + D.y1) / 2;
        if (x > R.l + 20) { const f = fakeSkater({ x, y, team: t, pl: who, num: who.num, fx: -1, fy: 0, vx: -2, vy: 0, anim: S.t * 0.25, hand: who.hand || 'L' }); figs.push({ y, d: () => drawSkater(f) }); }
      } else {
        const tp = P.tap[t] && S.t - P.tap[t].t0 < 40 ? (S.t - P.tap[t].t0) / 40 : -1;
        const pose = (g && g.slump) || S.t < P.slump[t] ? 'slump' : tp >= 0 ? 'tap' : null;
        const slam = e ? S.t - e.t0 - e.slamAt : 99, jolt = slam >= 0 && slam < 6 ? (slam & 1 ? 1 : -1) : 0;
        figs.push({ y: seatP.y, d: () => { drawBenchie.pose = pose; drawBenchie.tapK = tp; try { drawBenchie(seatP.x + jolt * 0.4, seatP.y, TEAM[t], who, 0, false, true); } finally { drawBenchie.pose = null; } } });
        if (slam >= 0 && slam < 10) figs.push({ y: 1e6, d: () => pbDrawSlam(D, slam) });
      }
    }
    // a teammate leaving the ice to make room for him (released during play)
    const o = P.out[t];
    if (o) { const u = Math.min(1, (S.t - o.t0) / o.dur), tx = R.l + 10, ty = BENCH_Y[t === hm ? 0 : 1] + BENCH_LEN / 2, x = o.fx + (tx - o.fx) * u, y = o.fy + (ty - o.fy) * u, m = hyp(tx - o.fx, ty - o.fy) || 1;
      const f = fakeSkater({ x, y, team: t, pl: o.pl, num: o.pl.num, fx: (tx - o.fx) / m, fy: (ty - o.fy) / m, vx: (tx - o.fx) / m * 2, vy: (ty - o.fy) / m * 2, anim: S.t * 0.25, hand: o.pl.hand || 'L' });
      figs.push({ y, d: () => drawSkater(f) }); }
  }
  // the power-play team's extra skater heading off when the penalty ends (rules.js removeExtra)
  if (P.leaving) { P.leaving = P.leaving.filter(o => S.t - o.t0 <= o.dur);
    for (const o of P.leaving) { const u = Math.min(1, (S.t - o.t0) / o.dur), q = u * (2 - u) * 0.5 + u * 0.5, tx = R.l + 10, ty = BENCH_Y[o.t === hm ? 0 : 1] + BENCH_LEN / 2, x = o.fx + (tx - o.fx) * q, y = o.fy + (ty - o.fy) * q, m = hyp(tx - o.fx, ty - o.fy) || 1;
      const f = fakeSkater({ x, y, team: o.t, pl: o.pl, num: o.pl.num, fx: (tx - o.fx) / m, fy: (ty - o.fy) / m, vx: (tx - o.fx) / m * 1.7, vy: (ty - o.fy) / m * 1.7, anim: S.t * 0.25, hand: o.pl.hand || 'L' });
      figs.push({ y, d: () => drawSkater(f) }); } }
  // the booth: two scorekeepers; on a goal the first one gets on the phone for a while
  const ph = S.t - P.phoneT, onPhone = ph >= 20 && ph < 300;
  figs.push({ y: CY - 2, d: () => drawOfficial(PBX.x0 + 14, CY - 1, { seated: true, pants: '#8a8f9e', faceLeft: true, phone: onPhone, coat: '#2b2f45', tie: '#3b8bff', skin: '#f0c49b', hair: '#d8d8d8', mouth: onPhone && (S.t >> 3) & 1 ? 'open' : null }) });
  figs.push({ y: CY + 12, d: () => drawOfficial(PBX.x0 + 21, CY + 12, { seated: true, pants: '#a08a62', faceLeft: true, coat: '#2b2f45', tie: '#b0282a', skin: '#a8714a', hair: '#1a1a1a' }) });
  figs.sort((a, b) => a.y - b.y);
  for (const f of figs) f.d();
  pbDrawClocks(P, r, hm);
  if (P.bang) pbDrawBang(P.bang);
}
// a box door swung open into the box (like the bench gates): the gap in the boards and the door on its hinge
function pbDrawDoor(D, k) {
  toWorld();
  const L = D.y1 - D.y0 - 2, ang = k * Math.PI / 2, hx = R.r + 3, hy = D.hinge;
  ctx.fillStyle = pbPal().floor; if (D.s > 0) ctx.fillRect(R.r, D.y0 + 1, 6, (D.y1 - D.y0 - 2) * k); else ctx.fillRect(R.r, D.y1 - 1 - (D.y1 - D.y0 - 2) * k, 6, (D.y1 - D.y0 - 2) * k);
  const ex = hx + Math.sin(ang) * L, ey = hy + D.s * Math.cos(ang) * L;
  ctx.strokeStyle = '#8a93a8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.strokeStyle = '#dfe4ee'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
}
// the door slamming shut: the glass above it shudders
function pbDrawSlam(D, k) {
  toWorld();
  const a = (1 - k / 10) * 0.7, w = (k & 1 ? 1 : -1) * (1 - k / 10) * 1.2;
  ctx.strokeStyle = `rgba(230,245,255,${a})`; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(R.r + 6.5 + w, D.y0 - 4); ctx.lineTo(R.r + 6.5 + w, D.y1 + 4); ctx.stroke();
  ctx.fillStyle = `rgba(255,255,255,${a * 0.5})`; ctx.fillRect(R.r + 1, D.y0, 4, D.y1 - D.y0);
}
// the penalty clock over each box: time left in the team's colours, flashing for the last ten seconds
function pbDrawClocks(P, r, hm) {
  toWorld();
  for (const t of [0, 1]) {
    const b = pbBox(t), i = pbIdx(t), T = TEAM[t], cx = (PBX.x0 + PBX.x1) / 2 + 2, cy = i === 0 ? b.y0 - 1 : b.y1 + 1;
    const q = r.pens[t], left = q.length && !q[0].perm ? penTimeLeft(t) : 0, on = q.length > 0 || !!P.ghost[t];
    const col = lum(T.main) > 0.22 ? T.main : (T.trim || '#ffffff');
    ctx.fillStyle = '#05070f'; ctx.fillRect(cx - 9, cy - 3.5, 18, 7);
    ctx.fillStyle = col; ctx.fillRect(cx - 9, cy - 3.5, 18, 0.6); ctx.fillRect(cx - 9, cy + 2.9, 18, 0.6);
    const flash = on && left > 0 && left <= 10 && ((S.t >> 3) & 1);
    if (flash) continue;
    const s = q.length && q[0].perm ? 'ALL' : on ? fmtPen(left) : '-:--';
    ctx.globalAlpha = on ? 1 : 0.35;
    text(s, cx, cy - 2.4, on ? col : '#8a93a8', 5, 'center', null);
    ctx.globalAlpha = 1;
  }
}
// home fans' fists on the back glass of the visitors' box
function pbDrawBang(B) {
  toWorld();
  const k = S.t - B.t0, X = PBX.x1 + 3;
  for (const f of B.fists) {
    const hit = Math.max(0, Math.sin((k + f.ph) * 0.55)), x = X + 2 - hit * 2.2;
    ctx.fillStyle = '#c94a3a'; ctx.fillRect(x + 1.6, f.y - 1, 3, 2.4);                    // sleeve
    ctx.fillStyle = '#e8b48a'; ctx.fillRect(x, f.y - 1.2, 2, 2.6);                         // fist
    if (hit > 0.9) { ctx.strokeStyle = 'rgba(230,245,255,.7)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(X - 0.5, f.y - 4); ctx.lineTo(X - 0.5, f.y + 4); ctx.stroke(); }
  }
}
