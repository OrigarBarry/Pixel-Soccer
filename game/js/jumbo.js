'use strict';
// ====================================================================
//  JUMBOTRON: drops down from the rafters over the middle of the screen during breaks in play.
//  It shows the game's own saved highlights (the exact clips you can watch after the game), rendered
//  with the real game sprites: an instant replay of each new highlight at the next stoppage, every saved
//  highlight on a loop during intermissions, and (made-up) sponsor ads in between. It always lifts back
//  up before play resumes; the faceoff waits for it. SPACE / ENTER skips it during a stoppage.
// ====================================================================
const JB_VW = 300, JB_VH = 188;                   // world units shown on the screen (same look as the camera)
const JB = { el: null, cv: null, c: null, head: null, cap: null, state: 'off', mode: null, item: null, frames: null, f: 0, end: 0,
  queue: [], seen: new Set(), list: [], li: 0, adI: 0, matchRef: null, stopId: 0, adStop: -1, ghosts: [], gRefs: [], cam: null, last: 0, pl: null, liftAt: 0 };
const JB_ADS = [
  { brand: 'PIXEL COLA', line: 'TASTE THE GAME!', bg: ['#b8262b', '#7a1018'], fg: '#ffffff', ac: '#ffd23f', icon: 'bottle' },
  { brand: 'PITCH KING', line: 'SHARPER EVERY MATCH', bg: ['#1b3a8a', '#0e1f4f'], fg: '#ffffff', ac: '#7ec8ff', icon: 'skate' },
  { brand: 'NORTH AIR', line: 'FLY THE TRUE NORTH', bg: ['#0e5a6a', '#06323b'], fg: '#ffffff', ac: '#ffd23f', icon: 'plane' },
  { brand: 'MAPLE BANK', line: 'SAVING SINCE 1898', bg: ['#2a6a3a', '#123a1e'], fg: '#ffffff', ac: '#ff6a4a', icon: 'maple' },
  { brand: 'POWER SHOT TV', line: 'EVERY GAME. LIVE.', bg: ['#3a1a5a', '#1a0a2a'], fg: '#ffffff', ac: '#ff3ea5', icon: 'tv' },
  { brand: 'STUDS CO.', line: 'BOOTS FOR SNIPERS', bg: ['#2a2a2a', '#0e0e0e'], fg: '#ffd23f', ac: '#ffffff', icon: 'stick' },
  { brand: 'RINKSIDE PIZZA', line: 'HOT SLICE. HALF-TIME HERO.', bg: ['#d9701f', '#8a3a0e'], fg: '#ffffff', ac: '#ffd23f', icon: 'pizza' },
  { brand: 'GLIDE WASH', line: 'SMOOTH AS A FRESH-CUT PITCH', bg: ['#2a7ad7', '#123a7a'], fg: '#ffffff', ac: '#e8f4ff', icon: 'drop' },
];
function jbEnsure() {
  if (JB.el) return;
  const el = document.createElement('div'); el.id = 'jumbo';
  el.innerHTML = '<div class="jb-cables"></div><div class="jb-house"><div class="jb-top"><span class="jb-brand">PIXEL VISION</span><span class="jb-head"></span><span class="jb-live">● REPLAY</span></div><canvas></canvas><div class="jb-cap"></div><div class="jb-skip">SPACE: SKIP</div></div>';
  (document.getElementById('wrap') || document.body).appendChild(el);
  JB.el = el; JB.cv = el.querySelector('canvas'); JB.head = el.querySelector('.jb-head'); JB.cap = el.querySelector('.jb-cap'); JB.live = el.querySelector('.jb-live'); JB.skip = el.querySelector('.jb-skip');
  JB.cv.width = Math.round(JB_VW * K); JB.cv.height = Math.round(JB_VH * K);
  JB.c = JB.cv.getContext('2d'); JB.c.imageSmoothingEnabled = false;
}
const jbVisible = () => JB.state === 'down' || JB.state === 'dropping';
// the faceoff countdown waits (just before the referee gets set) while the Jumbotron is down
const jbHolds = () => JB.state !== 'off' && JB.state !== 'up' && S.screen === 'play';
function jbDrop(mode, item) {
  jbEnsure();
  JB.mode = mode; jbLoad(item);
  const H0 = TEAM[S.match ? S.match.home ?? 0 : 0];
  JB.el.style.setProperty('--jb-team', H0.main); JB.el.style.setProperty('--jb-trim', H0.trim);
  JB.skip.style.display = mode === 'inter' ? 'none' : '';
  JB.el.classList.toggle('inter', mode === 'inter');            // intermission: hung beside the rink so the Zamboni and the ice stay in view
  if (JB.state === 'off' || JB.state === 'up') { JB.el.classList.remove('up'); void JB.el.offsetWidth; JB.el.classList.add('down'); JB.state = 'dropping'; JB.downAt = performance.now(); }
}
function jbLift() {
  if (!JB.el || JB.state === 'off' || JB.state === 'up') return;
  JB.el.classList.remove('down'); JB.el.classList.add('up'); JB.state = 'up'; JB.liftAt = performance.now();
}
function jbOff() { if (!JB.el) return; JB.el.classList.remove('down', 'up', 'inter'); JB.state = 'off'; JB.queue = []; }
// an item is a highlight clip or an ad
function jbLoad(item) {
  JB.item = item; JB.f = 0; JB.doneSent = false; JB.rx = null;
  if (item.card) { JB.frames = null; JB.end = item.len || 200; JB.head.textContent = item.head || 'FINAL'; JB.cap.textContent = item.cap || ''; JB.live.style.display = 'none'; return; }
  if (item.ad) { JB.frames = null; JB.end = item.len || 210; JB.head.textContent = 'A WORD FROM OUR SPONSORS'; JB.cap.textContent = item.ad.brand + ' · ' + item.ad.line; JB.live.style.display = 'none'; return; }
  let fr = null; try { fr = clipFrames(item.clip); } catch (e) { fr = null; }
  if (!fr || fr.length < 4) { JB.frames = null; JB.end = 1; return; }
  // instant replays: from a few seconds before the moment; intermission highlights: the whole clip
  const mark = item.clip.mark || fr.length - 8;
  // the saved clip keeps its whole run-up (Replay Centre, trophies); on the Jumbotron a play starts just before its key
  // action (the shot that scored, the hit, the deke), because the big screen plays slower than real time and the full
  // run-up read as "extra footage" (Barry, Nov 22: goals, and every other replay too). A penalty keeps a little more
  // lead-in so the foul itself is in the shot.
  const key = item.clip.key != null ? item.clip.key : item.clip.gen ? mark : Math.max(0, mark - 20);   // generated clips mark the shot itself
  const lead = item.clip.kind === 'pen' ? 20 : 13;
  JB.from = Math.max(0, Math.min(key - lead, fr.length - 12));
  JB.frames = fr; JB.f = JB.from; JB.end = fr.length - 1; JB.mark = mark;
  JB.ghosts = []; JB.gRefs = []; JB.cam = null; JB.pl = jbPlayers();
  const m = item.clip.meta || {}, per = m.period >= 4 ? 'ET' : ['1ST', '1ST', '2ND'][(m.period || 1) - 1] || '';
  JB.head.textContent = JB.mode === 'inter' ? 'HIGHLIGHTS · ' + (item.n + 1) + ' OF ' + item.of : 'INSTANT REPLAY';
  JB.cap.textContent = (m.text || item.clip.kind.toUpperCase()) + (per ? ' · ' + per + (m.clock != null && !m.so ? ' ' + fmtClock(m.clock) : '') : '');
  JB.live.style.display = '';
}
function jbPlayers() {
  const map = {}, lus = (S.match && S.match.lineups) || [];
  for (const lu of lus) if (lu) for (const pl of (lu.lines || []).flat().concat([lu.goalie], lu.bench || [], lu.extra || [])) if (pl) map[pl.id] = pl;
  return map;
}
// the next instant replay: a goal first, then the most recent other highlight (older ones are dropped)
function jbNext() {
  const pi = JB.queue.findIndex(c => c.kind === 'pen');
  if (pi >= 0) { const c = JB.queue[pi]; JB.queue = []; return c; }   // a penalty stoppage: only the penalty itself
  JB.queue = JB.queue.slice(-3);
  const gi = JB.queue.findIndex(c => c.kind === 'goal');
  const c = gi >= 0 ? JB.queue.splice(gi, 1)[0] : JB.queue.pop();
  if (gi < 0) JB.queue = [];
  return c;
}
function jbAd() { const ad = JB_ADS[JB.adI++ % JB_ADS.length]; return { ad, len: 200 }; }
// between periods and after the game the board shows only the big moments: goals, big hits and big saves
function bigHighlight(c) { return c && (c.kind === 'goal' || c.kind === 'so' || c.kind === 'hit' || (c.kind === 'save' && (c.imp || 0) >= 22)); }
// the intermission loop: every saved big moment, with an ad after every two
function jbInterList() {
  const clips = (REC.clips || []).filter(c => typeof bigHighlight === 'function' ? bigHighlight(c) : true), list = [];
  clips.forEach((c, i) => { list.push({ clip: c, n: i, of: clips.length }); if (i % 2 === 1) list.push(jbAd()); });
  if (!list.length) list.push(jbAd(), jbAd());
  return list;
}

// ---------- each animation frame
function jbTick(now) {
  const dt = Math.min(100, now - (JB.last || now)); JB.last = now;
  const inMatch = S.match && !S.demo && !S.match.replay && REC.on && (S.screen === 'play' || S.screen === 'paused' || S.screen === 'intermission' || S.screen === 'outro');
  if (!inMatch) { if (JB.state !== 'off') jbOff(); if (!S.match || S.match !== JB.matchRef) { JB.seen.clear(); JB.matchRef = S.match; } return; }
  if (JB.matchRef !== S.match) { JB.matchRef = S.match; JB.seen.clear(); JB.queue = []; JB.adI = (Math.random() * JB_ADS.length) | 0; }
  if (JB.state === 'up' && now - JB.liftAt > 500) { JB.state = 'off'; JB.el.classList.remove('up'); }
  if (JB.state === 'dropping' && now - JB.downAt > 750) JB.state = 'down';
  // new highlights are queued for the next instant replay
  for (const c of REC.clips || []) if (!JB.seen.has(c)) { JB.seen.add(c); if (c.kind !== 'so') JB.queue.push(c); }
  const paused = S.screen === 'paused';
  if (S.screen === 'outro') { JB.queue = []; }
  else if (S.screen === 'intermission') {
    JB.queue = [];
    if (JB.mode !== 'inter' || JB.state === 'off' || JB.state === 'up') { JB.list = jbInterList(); JB.li = 0; jbDrop('inter', JB.list[0]); }
  } else {
    if (JB.mode === 'inter' && JB.state !== 'off') { jbLift(); JB.mode = null; }
    const stopped = S.screen === 'paused' ? jbVisible() : !S.minorStop && (S.phase === 'goal' || S.phase === 'whistle' || (S.phase === 'faceoff' && !(S.fo && S.fo.free)));   // SOCCER: not for throw-ins, corners, goal kicks or free kicks
    if (!stopped) { if (JB.state === 'down' || JB.state === 'dropping') jbLift(); JB.stopId++; }
    else if (JB.state === 'off' || JB.state === 'up') {
      // a penalty was just called: its clip is still being recorded (the follow-through); wait for it rather than
      // showing an older highlight, so the replay is the infraction itself
      const penPending = (REC.pending || []).some(c => c.kind === 'pen') || S.fight || S.ask || S.pendingFight || S.scrumHold;
      if (penPending) {}
      else if (JB.queue.length && !(S.phase === 'faceoff' && S.timer <= FO.cueT + 30)) jbDrop('replay', { clip: jbNext() });
      else if (S.phase === 'whistle' && JB.adStop !== JB.stopId && S.timer > 40) { JB.adStop = JB.stopId; if (Math.random() < 0.22) jbDrop('ad', jbAd()); }
    }
  }
  if (JB.state === 'off' || JB.state === 'up' && now - JB.liftAt > 500) return;
  // play
  if (!paused) {
    const slow = JB.frames && JB.mode !== 'inter' && JB.item && !JB.item.ad && !JB.item.card && Math.abs(JB.f - JB.mark) < 9 && /goal|save|hit|pen|deke/.test(JB.item.clip.kind);
    // replays run a little under real time (they read better on the big screen), the key moment in slow motion
    const f0 = JB.f;
    JB.f += dt / 1000 * (JB.item && (JB.item.ad || JB.item.card) ? 60 : JB.mode === 'inter' ? 11 : 9.5) * (slow ? 0.4 : 1);
    if (JB.frames && JB.item && JB.item.clip && typeof rsndAdvance === 'function') {
      const clip = JB.item.clip, inter = JB.mode === 'inter';
      rsndAdvance(clip, JB.frames, f0, JB.f, 'arena', inter ? 0.4 : 0.6);          // the play's own sounds, through the arena speakers
      // the crowd watching it: a murmur building, then the reaction at the moment (intermission loop: goals only)
      if (!JB.rx) { let at = JB.mark + 1; for (let i = 1; i < JB.frames.length; i++) if (JB.frames[i][1] !== JB.frames[i - 1][1] || JB.frames[i][2] !== JB.frames[i - 1][2]) { at = i; break; } JB.rx = { at, built: false, done: false }; }
      if ((!inter || clip.kind === 'goal') && typeof rsndCrowdReact === 'function') {
        if (!JB.rx.built && JB.f >= JB.rx.at - 7) { JB.rx.built = true; if (!inter) rsndCrowdReact(clip, 'build'); }
        if (!JB.rx.done && JB.f >= JB.rx.at) { JB.rx.done = true; rsndCrowdReact(clip, 'react'); }
      }
    }
  }
  if (JB.f >= JB.end + (JB.frames ? 8 : 0)) {
    if (JB.mode === 'outro') { if (!JB.doneSent) { JB.doneSent = true; if (typeof outroItemDone === 'function') outroItemDone(); } }
    else if (JB.mode === 'inter') { JB.li = (JB.li + 1) % JB.list.length; if (JB.li === 0) JB.list = jbInterList(); jbLoad(JB.list[JB.li]); }
    else if (JB.state !== 'up') { if (JB.queue.length && S.phase !== 'live') jbLoad({ clip: jbNext() }); else jbLift(); }
  }
  if (JB.item && JB.item.card) JB.item.card(JB.c, JB.f, JB.cv.width, JB.cv.height); else if (JB.item && JB.item.ad) jbDrawAd(JB.c, JB.item.ad, JB.f); else if (JB.frames) jbRender(Math.min(JB.f, JB.end));
}
// SPACE / ENTER skips the Jumbotron during a stoppage
addEventListener('keydown', e => {
  if (!JB.el || !jbVisible() || JB.mode === 'inter' || S.screen !== 'play') return;
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') { jbLift(); JB.queue = []; e.preventDefault(); e.stopImmediatePropagation(); }
}, true);

// ---------- the replay itself, drawn with the game's own rink, crowd and player sprites
function jbGhost(k) {
  if (!JB.ghosts[k]) JB.ghosts[k] = { id: 'jb' + k, team: POOL[k] ? POOL[k].team : 0, g: POOL[k] ? POOL[k].g : false, x: 0, y: 0, fx: 0, fy: -1, vx: 0, vy: 0, anim: 0, stun: 0, down: 0, poke: 0, charge: -1, covering: 0, lunge: 0, dkOff: 0, dkFake: 0, dkMove: null, celebT: 0, num: 0, cap: null, pl: null };
  return JB.ghosts[k];
}
function jbRender(fi) {
  const clip = JB.item.clip, fr = JB.frames, i0 = Math.max(0, Math.min(fr.length - 1, Math.floor(fi))), i1 = Math.min(fr.length - 1, i0 + 1), t = fi - i0;
  const a = fr[i0], b = fr[i1], L = k => a[k] + (b[k] - a[k]) * t;
  const v2 = (clip.v || 1) >= 2, np = v2 ? (clip.np || POOL.length) : 8;
  const pk = { x: L(3) / 4, y: L(4) / 4, z: L(5) / 4, owner: (t < 0.5 ? a[6] : b[6]) ? (t < 0.5 ? a[6] : b[6]) - 1 : -1 };
  const items = [], sd = clipStride(clip), v3 = sd === 8;
  for (let k = 0; k < np && k < POOL.length; k++) {
    const o = 8 + k * sd, fl = a[o + 3];
    if (v2 && !(fl & 256)) continue;
    const g = jbGhost(k), nx = L(o) / 4, ny = L(o + 1) / 4;
    g.vx = nx - g.x; g.vy = ny - g.y; if (Math.abs(g.vx) > 20 || Math.abs(g.vy) > 20) g.vx = g.vy = 0;
    g.x = nx; g.y = ny;
    const ang = replayAng(a[o + 2], b[o + 2], t); g.fx = Math.cos(ang); g.fy = Math.sin(ang); g.side = fl & 1024 ? -1 : 1;
    g.stun = fl & 1 ? 30 : fl & 2 ? 10 : 0; g.stunType = fl & 1 ? 'big' : fl & 2 ? 'small' : null;
    g.down = fl & 4 ? 10 : 0; g.poke = fl & 8 ? 7 : 0; g.charge = fl & 16 ? (v3 && a[o + 6] ? (L(o + 6) - 1) / 100 : 0.5) : -1; g.covering = fl & 32 ? 10 : 0;
    g.lunge = fl & 64 ? 5 : 0; g.lungeDx = g.fx; g.lungeDy = g.fy; g.dkOff = L(o + 4) / 4;
    const info = a[o + 5] ? clip.pids[a[o + 5] - 1] : null;
    if (info) { g.num = info.num; g.cap = info.cap || null; g.pl = JB.pl[info.pid] || null; g.rpHand = info.hand || (g.pl && g.pl.hand) || null; g.ghost = true; g.team = info.team ?? g.team; g.celebType = info.celeb || 'arms'; }
    g.celebT = fl & 128 ? 10 + (S.t % 40) : 0; g.fight = !!(fl & 512);
    g.anim += hyp(g.vx, g.vy) * 0.22 * 4 / REC_EVERY * 4;
    items.push({ y: g.y, d: () => g.g ? drawGoalie(g) : drawSkater(g) });
  }
  const ro = 8 + np * sd;
  for (let k = 0; ro + k * 3 + 2 < a.length; k++) {
    const r = JB.gRefs[k] || (JB.gRefs[k] = { x: 0, y: 0, vx: 0, vy: 0, anim: 0, arm: 0 });
    const nx = L(ro + k * 3) / 4, ny = L(ro + k * 3 + 1) / 4; r.vx = nx - r.x; r.vy = ny - r.y; r.x = nx; r.y = ny; r.arm = a[ro + k * 3 + 2] ? 20 : 0; r.anim += hyp(r.vx, r.vy) * 0.9;
    items.push({ y: r.y, d: () => drawRef(r) });
  }
  // camera: follow the puck carrier / the puck, smoothly
  // penalties: watch the players involved (the infraction is often away from the puck)
  const fs = clip.meta && clip.meta.focus != null ? JB.ghosts[clip.meta.focus] : null;
  const own = pk.owner >= 0 ? JB.ghosts[pk.owner] : null, tx = fs ? fs.x : own ? own.x : pk.x, ty = fs ? fs.y : own ? own.y : pk.y;
  if (!JB.cam) JB.cam = { x: tx, y: ty }; else { JB.cam.x += (tx - JB.cam.x) * 0.12; JB.cam.y += (ty - JB.cam.y) * 0.12; }
  const cx = clamp(JB.cam.x - JB_VW / 2, 0, W - JB_VW), cy = clamp(JB.cam.y - JB_VH / 2, 0, H - JB_VH);
  const keepCtx = ctx, kx = camX, ky = camY;
  try {
    ctx = JB.c; camX = cx; camY = cy + HUDH;          // toWorld() offsets by (HUDH - camY): this puts the view's top at cy
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0b0d1a'; ctx.fillRect(0, 0, JB.cv.width, JB.cv.height);
    toWorld(); ctx.imageSmoothingEnabled = false;
    if (rinkImg) ctx.drawImage(rinkImg, 0, 0, W, H);
    if (crowdImgs) { const ci = crowdImgs[S.crowdF || 0] || crowdImgs[0]; ctx.drawImage(ci, 0, 0, ci.width * SS / CROWD_FINE, ci.height * SS / CROWD_FINE); }
    items.push({ y: GL_TOP - 6, d: drawNetTop }, { y: GL_BOT, d: drawNetBottom });
    if (!(own && own.g)) items.push({ y: own ? own.y + 0.5 : pk.y, d: () => { toWorld(); const x = pk.x, y = pk.y;   /* the recorded puck: where it really was (on his blade when he carries it) */ ctx.fillStyle = 'rgba(20,30,60,.35)'; ctx.fillRect(x - 2, y + 0.4, 4, 1.2); ctx.fillStyle = '#111318'; ctx.fillRect(x - 2, y - 1.6 - (own ? 0 : pk.z), 4, 2.2); ctx.fillStyle = '#4a4d5a'; ctx.fillRect(x - 2, y - 1.6 - (own ? 0 : pk.z), 4, 0.6); } });
    items.sort((p, q) => p.y - q.y);
    for (const it of items) it.d();
    // TV look: scanlines + a corner bug
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,.10)'; for (let y = 0; y < JB.cv.height; y += 4) ctx.fillRect(0, y, JB.cv.width, 1);
    const slow = Math.abs(JB.f - JB.mark) < 9 && /goal|save|hit|pen|deke/.test(clip.kind) && JB.mode !== 'inter';
    if (slow) pText(ctx, 'SLOW MOTION', 12, JB.cv.height - 30, '#ffd23f', 3);
  } finally { ctx = keepCtx; camX = kx; camY = ky; }
}
// ---------- made-up sponsor ads (pixel art, animated)
function jbDrawAd(c, ad, f) {
  const w = JB.cv.width, h = JB.cv.height, t = f | 0;
  c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false;
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, ad.bg[0]); g.addColorStop(1, ad.bg[1]); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,255,255,.06)'; for (let x = -h + ((t * 2) % 40); x < w; x += 40) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + 20, h); c.lineTo(x + 20 + h, 0); c.lineTo(x + h, 0); c.fill(); }
  const s = Math.max(4, Math.round(w / 110)), bob = Math.round(Math.sin(t * 0.08) * s * 1.2);
  // art audit (Nov 22): a bigger product icon on a soft spotlight, the brand name, and the tagline on a ribbon
  // across the bottom (it used to float under the name and leave the bottom third empty)
  const is = Math.round(s * 1.7), ix = Math.round(w * 0.19), iy = Math.round(h * 0.42);
  const sp = c.createRadialGradient(ix, iy, 2, ix, iy, h * 0.3); sp.addColorStop(0, 'rgba(255,255,255,.22)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = sp; c.fillRect(ix - h * 0.3, iy - h * 0.3, h * 0.6, h * 0.6);
  jbIcon(c, ad.icon, ix, iy + bob, is, ad);
  const sz = Math.max(3, Math.floor((w * 0.54) / (pTextW(ad.brand) + 1)));
  const bx = Math.round(w * 0.38), by = Math.round(h * 0.32);
  pText(c, ad.brand, bx + sz, by + sz, 'rgba(0,0,0,.45)', sz); pText(c, ad.brand, bx, by, ad.fg, sz);
  c.fillStyle = ad.ac; c.fillRect(bx, by + sz * 6.4, Math.min(pTextW(ad.brand) * sz, w - bx - s * 3), Math.max(2, Math.round(sz * 0.5)));   // an underline in the accent colour
  const rb = Math.round(h * 0.72), rh = Math.round(h * 0.16);
  c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, rb, w, rh); c.fillStyle = ad.ac; c.fillRect(0, rb, w, Math.max(2, s / 2)); c.fillRect(0, rb + rh - Math.max(2, s / 2), w, Math.max(2, s / 2));
  const ls = Math.max(2, Math.min(Math.floor(rh * 0.55 / 5), Math.floor((w * 0.86) / (pTextW(ad.line) + 1))));
  const slide = Math.max(0, 40 - t) * s;                                 // the tagline slides in from the right
  pText(c, ad.line, Math.round((w - pTextW(ad.line) * ls) / 2) + slide, Math.round(rb + (rh - 5 * ls) / 2), '#ffffff', ls);
  for (let k = 0; k < 6; k++) { const sx = (k * 97 + t * 3) % w, sy = (k * 53 + t) % h; if ((t + k * 7) % 20 < 6) { c.fillStyle = '#ffffff'; c.fillRect(sx, sy - s, s / 2, s * 2.5); c.fillRect(sx - s, sy, s * 2.5, s / 2); } }
  c.fillStyle = 'rgba(0,0,0,.10)'; for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
}
function jbIcon(c, kind, x, y, s, ad) {
  const R = (dx, dy, ww, hh, col) => { c.fillStyle = col; c.fillRect(x + dx * s, y + dy * s, ww * s, hh * s); };
  if (kind === 'bottle') { R(-2, -9, 4, 3, '#e8e8e8'); R(-3, -6, 6, 14, ad.ac); R(-3, -2, 6, 5, '#ffffff'); R(-1, -1, 2, 3, ad.bg[0]); R(-3, 8, 6, 1, '#00000055'); }
  else if (kind === 'skate') { R(-6, -6, 8, 8, '#1a1a24'); R(-6, -6, 8, 2, ad.ac); R(-6, 2, 13, 2, '#1a1a24'); R(-8, 5, 17, 1, '#e8e8e8'); R(-6, 4, 1, 1, '#9aa3c7'); R(4, 4, 1, 1, '#9aa3c7'); }
  else if (kind === 'plane') { R(-9, -1, 18, 3, '#ffffff'); R(-2, -7, 4, 15, '#ffffff'); R(-9, -4, 3, 3, '#ffffff'); R(7, -1, 3, 3, ad.ac); R(-6, 0, 12, 1, ad.bg[0]); }
  else if (kind === 'maple') { R(-1, -9, 2, 4, ad.ac); R(-5, -6, 10, 6, ad.ac); R(-8, -3, 16, 3, ad.ac); R(-3, 0, 6, 3, ad.ac); R(-1, 3, 2, 5, '#5a3a1e'); }
  else if (kind === 'tv') { R(-8, -7, 16, 12, '#1a1a24'); R(-7, -6, 14, 10, ad.ac); R(-3, 5, 6, 2, '#1a1a24'); R(-6, 7, 12, 1, '#1a1a24'); R(-5, -4, 4, 2, '#ffffff'); }
  else if (kind === 'stick') { for (let i = 0; i < 12; i++) R(-6 + i, -8 + i, 2, 2, '#c08040'); R(5, 4, 6, 2, '#1a1a24'); R(-7, -9, 2, 2, ad.ac); }
  else if (kind === 'pizza') { for (let i = 0; i < 10; i++) R(-5 + i * 0.5, -6 + i, 10 - i, 1, '#ffd23f'); R(-6, -7, 12, 2, '#c08040'); R(-2, -4, 2, 2, '#c0392b'); R(1, -2, 2, 2, '#c0392b'); R(-1, 0, 2, 2, '#c0392b'); }
  else if (kind === 'drop') { R(-1, -9, 2, 2, ad.ac); R(-2, -7, 4, 3, ad.ac); R(-4, -4, 8, 6, ad.ac); R(-3, 2, 6, 2, ad.ac); R(-2, -2, 2, 3, '#ffffff'); }
}
// the arena's side scoreboard no longer plays clips (the Jumbotron does)
jbPickClip = () => null;
