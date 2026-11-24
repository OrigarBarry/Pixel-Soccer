'use strict';
// ====================================================================
//  AROUND THE LEAGUE: highlights of games the computer simulated. A simulated game has a score and its goals
//  (scorer, assists, power play, tip-in, empty net...) but no skating to replay, so for the PUCK TALK desk the
//  goal is re-staged as a short play that matches it: the real scorer and assist men, both teams' real players
//  and colours, the right kind of goal. The clip is in the same format as a recorded one, so the Jumbotron
//  renderer draws it and replaysound.js gives it its sounds. It is labelled AROUND THE LEAGUE.
//  Plays: an odd-man rush finished off a cross-ice pass, a breakaway deke, a long-range shot tipped or put back in
//  on the rebound, an empty-netter from distance.
// ====================================================================
const HL_KEEP = 40;
// a simulated (not the user's) game is over: keep its best goal or two for the desk (compact, last 40 games)
function hlRemember(save, g, res) {
  try {
    const se = save.season; if (!se || g.type === 'exh') return;
    const goals = (res.goals || []).filter(x => x.pid && !x.ps); if (!goals.length) return;
    const homeWon = res.hs > res.as, winT = homeWon ? g.home : g.away, lg = homeWon ? res.as : res.hs;
    const gw = !res.so ? goals.filter(x => x.teamId === winT)[lg] : null;
    const pickG = [gw || goals[goals.length - 1]];
    const other = goals.filter(x => x !== pickG[0] && !x.en); if (other.length) pickG.push(other[(Math.random() * other.length) | 0]);
    se.hlRecent = (se.hlRecent || []).concat([{ gid: g.id, d: (se.num || 1) * 1000 + ((se.dayNo || 0) % 1000), home: g.home, away: g.away, hs: res.hs, as: res.as, ot: !!res.ot, so: !!res.so,
      comp: g.comp || null, goals: pickG.map(x => ({ t: x.teamId, p: x.pid, a: (x.a || []).slice(0, 2), tip: !!x.tip, pp: !!x.pp, sh: !!x.sh, en: !!x.en, gw: x === gw })) }]).slice(-HL_KEEP);
  } catch (e) {}
}
// the most watchable games from the last day or two (overtime, a big comeback, lots of goals, stars scoring)
function hlPicks(save, n = 2) {
  const se = save.season, list = (se && se.hlRecent) || []; if (!list.length) return [];
  const newest = list[list.length - 1].d, recent = list.filter(x => newest - x.d <= 1);
  const ovr = id => { const p = save.players[id]; return p && typeof ovrInt === 'function' ? ovrInt(p) : 50; };
  const score = x => (x.ot ? 30 : 0) + (x.so ? 10 : 0) + (x.hs + x.as) * 3 + Math.max(...x.goals.map(q => ovr(q.p))) / 4 + (x.comp ? 20 : 0) + (x.d === newest ? 15 : 0) + Math.random() * 10;
  return recent.slice().sort((a, b) => score(b) - score(a)).slice(0, n);
}
// ---------- staging the play
const HLN = 104;                                       // frames (15 a second): about 7 seconds
function hlTrack(keys) {                               // smooth path through [frame, x, y] keys
  return f => {
    if (f <= keys[0][0]) return [keys[0][1], keys[0][2]];
    const L = keys.length - 1; if (f >= keys[L][0]) return [keys[L][1], keys[L][2]];
    let i = 0; while (i < L - 1 && f > keys[i + 1][0]) i++;
    const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(L, i + 2)], t = (f - p1[0]) / (p2[0] - p1[0] || 1);
    const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
    return [cr(p0[1], p1[1], p2[1], p3[1]), cr(p0[2], p1[2], p2[2], p3[2])];
  };
}
function hlBuild(save, game, goal, seed) {
  const rnd = mulberry32(seed >>> 0), R0 = (a, b) => a + rnd() * (b - a);
  const sc = goal.t === game.home ? 0 : 1, df = 1 - sc;                 // slot 0 = the home team
  const teamOf = [save.teams[game.home], save.teams[game.away]];
  const P0 = id => save.players[id];
  // who's on the ice: the scorer's line (with the assist men), and a line + goalie for the other side
  const lineWith = (t, must) => {
    const L = (t.roster.lines || []).map(l => (l || []).filter(id => id && P0(id)));
    const best = (L.find(l => must.length && l.includes(must[0])) || L[0] || []).slice(0, 3);
    for (const id of must) if (!best.includes(id)) { const j = best.findIndex(x => !must.includes(x)); if (j >= 0) best[j] = id; else if (best.length < 3) best.push(id); }
    for (const id of L.flat()) { if (best.length >= 3) break; if (!best.includes(id)) best.push(id); }
    return best;
  };
  const scorer = goal.p, ast = (goal.a || []).filter(id => P0(id));
  const atk = lineWith(teamOf[sc], [scorer].concat(ast)), def = lineWith(teamOf[df], []);
  const order = [scorer].concat(ast.filter(id => atk.includes(id)), atk.filter(id => id !== scorer && !ast.includes(id)));
  const [S_, A1, A3] = [order[0], order[1] || order[2], order[1] ? order[2] : null];
  const gk = t => (t.roster.goalies || []).find(id => id && P0(id) && !(P0(id).inj)) || (t.roster.goalies || [])[0];
  // pids (index + 1 is stored per player per frame)
  const pids = [], pidIx = {};
  const addPid = (id, team) => { if (!id || !P0(id)) return 0; if (pidIx[id] == null) { const p = P0(id); pids.push({ pid: id, num: p.num, name: (p.first ? p.first[0] + '. ' : '') + p.last, last: p.last, pos: p.pos, team, cap: null, celeb: p.look ? p.look.celeb : null, hand: p.hand }); pidIx[id] = pids.length; } return pidIx[id]; };
  // slots: team 0 skaters 0-2, goalie 3; team 1 skaters 4-6, goalie 7; 8, 9 spare (off the ice)
  const slotS = (t, i) => t * 4 + i, slotG = t => t * 4 + 3;
  const gy = GL_TOP, gyB = GL_BOT;
  const kind = goal.en ? 'en' : goal.tip ? 'tip' : !(goal.a || []).length ? 'break' : rnd() < 0.45 ? 'rush' : rnd() < 0.5 ? 'rebound' : 'break';
  const flip = rnd() < 0.5 ? 1 : -1, X = x => CX + (x - CX) * flip;   // mirror left/right for variety
  const tr = {}, faceP = {}, events = {};
  let puck, shotF, goalF, target;
  const net = side => [CX + side * (GOAL_HW - 3.5) * flip, gy - 3];
  if (kind === 'rush') {
    tr.S = [[0, CX + 48, CY + 40], [22, CX + 46, BLUE_TOP + 6], [40, CX + 30, gy + 48], [47, CX + 24, gy + 38], [55, CX + 20, gy + 31], [72, CX + 54, gy + 20], [HLN, CX + 70, gy + 42]];
    tr.A1 = [[0, CX - 34, CY + 60], [22, CX - 36, BLUE_TOP + 14], [40, CX - 26, gy + 54], [52, CX - 14, gy + 46], [72, CX + 34, gy + 30], [HLN, CX + 56, gy + 46]];
    tr.A3 = [[0, CX - 6, CY + 110], [30, CX - 4, CY + 20], [55, CX - 2, BLUE_TOP + 30], [80, CX + 30, gy + 62], [HLN, CX + 46, gy + 52]];
    tr.D1 = [[0, CX - 8, BLUE_TOP - 14], [25, CX - 12, gy + 82], [42, CX - 10, gy + 54], [50, CX + 6, gy + 42], [72, CX - 10, gy + 52], [HLN, CX - 30, gy + 72]];
    tr.D2 = [[0, CX + 10, CY + 72], [30, CX + 2, BLUE_TOP + 22], [52, CX - 6, gy + 66], [HLN, CX - 20, gy + 82]];
    tr.D3 = [[0, CX + 70, CY - 30], [30, CX + 62, gy + 72], [50, CX + 44, gy + 52], [HLN, CX + 40, gy + 82]];
    faceP.D1 = faceP.D3 = true;
    shotF = 48; target = net(-1); goalF = 51;
    puck = [{ a: 0, b: 40, own: 'A1' }, { a: 40, b: 44, from: 'A1', to: 'S' }, { a: 44, b: shotF, own: 'S', charge: true }, { a: shotF, b: goalF, from: 'S', at: target, z: 4 }];
    events.down = [49, 70];
  } else if (kind === 'break') {
    const pass = !!A1;
    tr.A1 = [[0, CX - 50, CY + 72], [8, CX - 44, CY + 56], [40, CX - 30, CY + 6], [HLN, CX - 12, BLUE_TOP + 40]];
    tr.S = [[0, CX + 16, CY + 6], [12, CX + 12, CY - 26], [28, CX + 6, BLUE_TOP - 22], [44, CX + 2, gy + 42], [52, CX - 2, gy + 27], [62, CX + 30, gy + 14], [80, CX + 56, gy + 22], [HLN, CX + 70, gy + 40]];
    tr.A3 = [[0, CX + 44, CY + 82], [50, CX + 36, BLUE_TOP + 10], [HLN, CX + 34, gy + 60]];
    tr.D1 = [[0, CX - 6, CY - 12], [30, CX + 0, BLUE_TOP - 6], [54, CX + 4, gy + 50], [HLN, CX + 20, gy + 72]];
    tr.D2 = [[0, CX - 64, CY + 30], [HLN, CX - 44, BLUE_TOP - 10]];
    tr.D3 = [[0, CX + 64, CY + 40], [HLN, CX + 52, BLUE_TOP + 14]];
    shotF = 53; target = net(1); goalF = 55;
    puck = (pass ? [{ a: 0, b: 8, own: 'A1' }, { a: 8, b: 13, from: 'A1', to: 'S' }, { a: 13, b: shotF, own: 'S' }] : [{ a: 0, b: shotF, own: 'S' }]).concat([{ a: shotF, b: goalF, from: 'S', at: target, z: 3 }]);
    events.deke = [44, 52]; events.lunge = [47, 58];
  } else if (kind === 'tip' || kind === 'rebound') {
    tr.A1 = [[0, CX - 26, BLUE_TOP + 32], [24, CX - 44, BLUE_TOP + 8], [50, CX - 44, BLUE_TOP + 14], [80, CX - 10, gy + 50], [HLN, CX + 20, gy + 40]];
    tr.S = [[0, CX + 30, gy + 72], [24, CX + 8, gy + 28], [36, CX + 5, gy + 23], [44, CX + 8, gy + 21], [62, CX + 40, gy + 14], [HLN, CX + 62, gy + 36]];
    tr.A3 = [[0, CX + 52, BLUE_TOP + 22], [40, CX + 40, gy + 50], [HLN, CX + 48, gy + 42]];
    tr.D1 = [[0, CX + 18, gy + 42], [30, CX + 12, gy + 28], [44, CX + 13, gy + 25], [HLN, CX - 6, gy + 46]];
    tr.D2 = [[0, CX - 30, gy + 42], [HLN, CX - 22, gy + 52]];
    tr.D3 = [[0, CX - 22, BLUE_TOP + 44], [28, CX - 34, BLUE_TOP + 22], [HLN, CX - 30, gy + 60]];
    faceP.D1 = faceP.D2 = true;
    const tipAt = [CX + 4 * flip, gy + 21];
    if (kind === 'tip') { shotF = 30; target = net(-1); goalF = 36;
      puck = [{ a: 0, b: shotF, own: 'A1', charge: [22, 30] }, { a: shotF, b: 34, from: 'A1', at: tipAt, z: 2 }, { a: 34, b: goalF, fromXY: tipAt, at: target, z: 1 }]; }
    else { shotF = 30; target = net(1); goalF = 42; const pad = [CX - 2 * flip, gy + 11], reb = [CX + 10 * flip, gy + 24];
      puck = [{ a: 0, b: shotF, own: 'A1', charge: [22, 30] }, { a: shotF, b: 34, from: 'A1', at: pad, z: 3 }, { a: 34, b: 38, fromXY: pad, at: reb, z: 0 }, { a: 38, b: 40, own: 'S' }, { a: 40, b: goalF, from: 'S', at: target, z: 2 }];
      events.down = [34, 48]; events.save = 34; }
  } else {                                               // empty net, from his own side of centre
    tr.S = [[0, CX - 20, CY + 90], [24, CX - 10, CY + 30], [34, CX, CY + 10], [60, CX + 20, CY - 30], [HLN, CX + 40, CY - 60]];
    tr.A1 = [[0, CX + 30, CY + 120], [HLN, CX + 20, CY + 30]];
    tr.A3 = [[0, CX - 50, CY + 140], [HLN, CX - 40, CY + 60]];
    tr.D1 = [[0, CX - 10, CY - 10], [30, CX - 14, CY + 20], [HLN, CX - 20, CY - 20]];
    tr.D2 = [[0, CX + 40, CY - 40], [HLN, CX + 30, BLUE_TOP + 10]];
    tr.D3 = [[0, CX - 60, CY - 30], [HLN, CX - 40, BLUE_TOP + 30]];
    shotF = 34; target = [CX, gy - 3]; goalF = 50;
    puck = [{ a: 0, b: shotF, own: 'S', charge: [28, 34] }, { a: shotF, b: goalF, from: 'S', at: target, z: 0 }];
  }
  for (const k in tr) tr[k] = hlTrack(tr[k].map(([f, x, y]) => [f, X(x), y]));
  if (target) target = [target[0], target[1]];
  // players → slots
  const who = { S: [slotS(sc, 0), S_], A1: [slotS(sc, 1), A1], A3: [slotS(sc, 2), A3], D1: [slotS(df, 0), def[0]], D2: [slotS(df, 1), def[1]], D3: [slotS(df, 2), def[2]] };
  if (!A1) { who.A1 = [slotS(sc, 1), atk.find(id => id !== S_)]; }
  const blade = (p, fx, fy, sideK) => [p[0] + fx * 7 + -fy * 3 * sideK, p[1] + fy * 7 + fx * 3 * sideK];
  const posAt = (k, f) => tr[k](f);
  const vel = (k, f) => { const a = posAt(k, Math.max(0, f - 1)), b = posAt(k, Math.min(HLN, f + 1)); return [b[0] - a[0], b[1] - a[1]]; };
  // puck position each frame
  const pk = [];
  for (let f = 0; f <= HLN; f++) {
    const seg = puck.find(s => f >= s.a && f < s.b) || puck[puck.length - 1];
    if (f >= goalF) { pk.push({ x: target[0] + (f - goalF) * 0.02, y: target[1] - Math.min(3, (f - goalF) * 0.6), z: 0, own: null }); continue; }
    if (seg.own) { const p = posAt(seg.own, f), v = vel(seg.own, f), m = Math.hypot(v[0], v[1]) || 1, fx = v[0] / m, fy = m > 0.6 ? v[1] / m : -1, b = blade(p, fx, fy, 1); pk.push({ x: b[0], y: b[1], z: 0, own: seg.own }); continue; }
    const from = seg.fromXY || (() => { const p = posAt(seg.from, seg.a), v = vel(seg.from, seg.a), m = Math.hypot(v[0], v[1]) || 1; return blade(p, v[0] / m, m > 0.6 ? v[1] / m : -1, 1); })();
    const to = seg.at || (() => { const p = posAt(seg.to, seg.b), v = vel(seg.to, seg.b), m = Math.hypot(v[0], v[1]) || 1; return blade(p, v[0] / m, m > 0.6 ? v[1] / m : -1, 1); })();
    const t = (f - seg.a) / (seg.b - seg.a);
    pk.push({ x: from[0] + (to[0] - from[0]) * t, y: from[1] + (to[1] - from[1]) * t, z: (seg.z || 0) * Math.sin(Math.PI * t), own: null });
  }
  // the clock and score
  const per = game.ot && goal.gw ? 4 : 1 + ((rnd() * 3) | 0), clk = Math.round(R0(25, 270));
  const before = [0, 0]; before[sc] = Math.max(0, (sc === 0 ? game.hs : game.as) - 1); before[df] = Math.min(sc === 0 ? game.as : game.hs, before[sc] + (rnd() < 0.5 ? 0 : 1));
  if (goal.gw && game.ot) before[df] = before[sc];
  const ang = (fx, fy) => Math.round(((Math.atan2(fy, fx) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * 64) % 64;
  const frames = [], ownerKey = {};
  for (const [k, [slot, id]] of Object.entries(who)) ownerKey[k] = slot;
  const gk0 = [gk(teamOf[0]), gk(teamOf[1])];
  for (let f = 0; f <= HLN; f++) {
    const P = pk[f], sc2 = before.slice(); if (f >= goalF) sc2[sc]++;
    const own = P.own ? ownerKey[P.own] + 1 : 0;
    const fr = [Math.max(0, Math.round((clk - f / 15) * 10)), sc2[0], sc2[1], Math.round(P.x * 4), Math.round(P.y * 4), Math.round(P.z * 4), own, per];
    const slots = new Array(10).fill(null);
    for (const [k, [slot, id]] of Object.entries(who)) {
      const p = posAt(k, f), v = vel(k, f), m = Math.hypot(v[0], v[1]);
      let fx = m > 0.5 ? v[0] / m : 0, fy = m > 0.5 ? v[1] / m : -1;
      if (faceP[k] || (m < 0.8)) { const dx = P.x - p[0], dy = P.y - p[1], d = Math.hypot(dx, dy) || 1; fx = dx / d; fy = dy / d; }
      if (k === 'S' && f > goalF + 2) { fx = 0.3; fy = 1; }
      let fl = 256;
      if (k === 'S' && f > goalF + 1 && f < goalF + 45) fl |= 128;
      if ((k === 'A1' || k === 'A3') && f > goalF + 8 && f < goalF + 46) fl |= 128;
      let charge = 0;
      const seg = puck.find(s => s.own === k && s.charge && f >= (Array.isArray(s.charge) ? s.charge[0] : s.a) && f < (Array.isArray(s.charge) ? s.charge[1] : s.b));
      if (seg) { fl |= 16; const c0 = Array.isArray(seg.charge) ? seg.charge[0] : seg.a, c1 = Array.isArray(seg.charge) ? seg.charge[1] : seg.b; charge = Math.round(clamp((f - c0) / (c1 - c0), 0, 1) * 100) + 1; }
      const dk = k === 'S' && events.deke && f >= events.deke[0] && f <= events.deke[1] ? Math.sin((f - events.deke[0]) / 3) * 6 : 0;
      slots[slot] = [Math.round(p[0] * 4), Math.round(p[1] * 4), ang(fx, fy), fl, Math.round(dk * 4), addPid(id, slot < 4 ? 0 : 1), charge, 0];
    }
    // goalies: the defending one tracks the puck at the top crease (beaten on the goal), the other stays home
    for (const t of [0, 1]) {
      const top = t === df, empty = top && kind === 'en';
      if (empty) { slots[slotG(t)] = [Math.round(CX * 4), Math.round((gy - 40) * 4), 16, 0, 0, 0, 0, 0]; continue; }
      const baseY = top ? gy + 7 : gyB - 7;
      let x = top ? CX + clamp((P.x - CX) * 0.35, -GOAL_HW + 4, GOAL_HW - 4) : CX + Math.sin(f / 20) * 2, fl = 256;
      if (top && events.lunge && f >= events.lunge[0] && f <= events.lunge[1]) { x += -6 * flip; fl |= 64; }
      if (top && events.down && f >= events.down[0] && f <= events.down[1]) fl |= 4;
      const dx = P.x - x, dy = P.y - baseY, d = Math.hypot(dx, dy) || 1;
      slots[slotG(t)] = [Math.round(x * 4), Math.round(baseY * 4), top ? ang(dx / d, Math.max(0.3, dy / d)) : ang(dx / d, Math.min(-0.3, dy / d)), fl | (top && f >= goalF ? 0 : 0), 0, addPid(gk0[t], t), 0, 0];
    }
    for (let i = 0; i < 10; i++) fr.push(...(slots[i] || [Math.round(CX * 4), Math.round((CY + 300) * 4), 16, 0, 0, 0, 0, 0]));
    // the referees: one trailing the play, one on the goal line (pointing at the net after the goal)
    const ay = clamp(P.y + 70, gy + 30, R.b - 30);
    fr.push(Math.round((R.l + 14) * 4), Math.round(ay * 4), 0, Math.round((R.r - 12) * 4), Math.round((gy + 12) * 4), f >= goalF + 1 && f < goalF + 30 ? 1 : 0);
    frames.push(fr);
  }
  const nm = id => { const p = P0(id); return p ? p.last.toUpperCase() : ''; };
  const text = (goal.pp ? 'MAN-UP GOAL! ' : goal.sh ? 'MAN-DOWN GOAL! ' : goal.en ? 'EMPTY NET! ' : per >= 4 ? 'ET WINNER! ' : 'GOAL! ') + '#' + (P0(scorer) ? P0(scorer).num : '') + ' ' + nm(scorer) + ((goal.a || []).length ? ' FROM ' + goal.a.map(nm).join(', ') : '');
  const look = { teams: [teamIdentity(teamOf[0]), teamIdentity(teamOf[1])], home: 0, away: [false, true], tourney: null };
  return { v: 3, geo: RINK_GEO, np: 10, kind: 'goal', imp: 40, fps: 15, gen: kind, frames: null, _frames: frames, pids, look, mark: shotF,
    meta: { team: sc, text, period: per, clock: clk, scorer, players: [scorer].concat(goal.a || []), league: true } };
}
