'use strict';
// ====================================================================
//  ARENA: replay recorder + compact clip format, the shared replay player,
//  intermission (ice resurfacer + Jumbotron highlights)
//  (loaded after engine.js and shares its globals)
// ====================================================================

// ---------- compact clip encoding: zig-zag varint deltas, base64
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64enc(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2], n = (a << 16) | ((b || 0) << 8) | (c || 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (b === undefined ? '=' : B64[(n >> 6) & 63]) + (c === undefined ? '=' : B64[n & 63]);
  }
  return out;
}
function b64dec(str) {
  const out = []; const lut = {}; for (let i = 0; i < 64; i++) lut[B64[i]] = i;
  for (let i = 0; i < str.length; i += 4) {
    const n = (lut[str[i]] << 18) | (lut[str[i + 1]] << 12) | ((lut[str[i + 2]] || 0) << 6) | (lut[str[i + 3]] || 0);
    out.push((n >> 16) & 255); if (str[i + 2] !== '=') out.push((n >> 8) & 255); if (str[i + 3] !== '=') out.push(n & 255);
  }
  return out;
}
function encodeFrames(frames) {
  const bytes = [], W0 = frames[0].length;
  const put = v => { let z = v < 0 ? (-v * 2 - 1) : v * 2; do { let b = z & 127; z = Math.floor(z / 128); if (z) b |= 128; bytes.push(b); } while (z); };
  let prev = new Array(W0).fill(0);
  for (const f of frames) { for (let i = 0; i < W0; i++) put((f[i] | 0) - prev[i]); prev = f; }
  return { w: W0, n: frames.length, d: b64enc(bytes) };
}
// a clip's frames, mapped onto the current rink (clips recorded before the rink grew are stretched about centre ice)
function clipFrames(clip) {
  const fr = decodeFrames(clip.frames);
  if ((clip.geo || 1) >= RINK_GEO) return fr;
  const OCX = 244 * 4, OCY = 373 * 4, NCX = CX * 4, NCY = CY * 4, k = RINK_S;
  const np = (clip.v || 1) >= 2 ? (clip.np || 8) : 8, X = v => Math.round(NCX + (v - OCX) * k), Y = v => Math.round(NCY + (v - OCY) * k);
  for (const f of fr) {
    f[3] = X(f[3]); f[4] = Y(f[4]);
    const sd = clipStride(clip);
    for (let i = 0; i < np; i++) { const o = 8 + i * sd; f[o] = X(f[o]); f[o + 1] = Y(f[o + 1]); }
    for (let o = 8 + np * sd; o + 1 < f.length; o += 3) { f[o] = X(f[o]); f[o + 1] = Y(f[o + 1]); }
  }
  return fr;
}
function decodeFrames(enc) {
  const bytes = b64dec(enc.d), frames = []; let k = 0;
  const get = () => { let z = 0, m = 1, b; do { b = bytes[k++]; z += (b & 127) * m; m *= 128; } while (b & 128); return z & 1 ? -(z + 1) / 2 : z / 2; };
  let prev = new Array(enc.w).fill(0);
  for (let n = 0; n < enc.n; n++) { const f = new Array(enc.w); for (let i = 0; i < enc.w; i++) f[i] = prev[i] + get(); frames.push(f); prev = f; }
  return frames;
}

// ---------- recorder: every 4th simulation tick (15 frames per second of game time)
const REC_EVERY = 4, REC_KEEP = 150, CLIP_PRE = 40, CLIP_POST = 30;   // recorded at 15 fps; clipEvent frames each kind of clip around its key action
// clip layout: 8 header values, then per player x, y, facing, flags, deke offset, player index (v2: 6 values) +
// the shot charge (0 = none, 1-101) and an 8-step... (v3: 8 values); then 3 per referee
const clipStride = clip => ((clip && clip.v) || 1) >= 3 ? 8 : 6;
const REC = { buf: [], total: 0, tick: 0, pids: [], pidKey: {}, pending: [], clips: [], goals: [], on: false };
function recReset() { Object.assign(REC, { buf: [], total: 0, tick: 0, pids: [], pidKey: {}, pending: [], clips: [], goals: [], on: true, cuts: [], lastPh: null }); }
function puckZ() {
  let z = 0; const sh = puck.shot;
  if (!puck.owner && sh && !sh.done) z = sh.h * 9 * Math.sqrt(clamp(1 - Math.abs(sh.gy - puck.y) / sh.d0, 0, 1));
  if (puck.air) z = 11;
  return z;
}
function pidIndex(p) {
  if (!p.pl) return 0;
  const key = p.pl.id + '#' + p.num;
  if (REC.pidKey[key] == null) { REC.pids.push({ pid: p.pl.id, num: p.num, name: (p.pl.first ? p.pl.first[0] + '. ' : '') + p.pl.last, last: p.pl.last, pos: p.pl.pos, team: p.team, cap: p.cap || null, celeb: p.pl.look ? p.pl.look.celeb : null, hand: p.pl.hand || null }); REC.pidKey[key] = REC.pids.length; }
  return REC.pidKey[key];
}
function capFrame() {
  const f = [Math.round(S.clock * 10), S.score[0], S.score[1], Math.round(puck.x * 4), Math.round(puck.y * 4), Math.round(puckZ() * 4), puck.owner ? POOL.indexOf(puck.owner) + 1 : 0, S.period];
  for (const p of POOL) {            // v2: every slot is recorded (flag 256 = on the ice), so 4-on-3, 4-on-4 and empty nets replay correctly
    const ang = Math.round(((Math.atan2(p.fy, p.fx) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * 64) % 64;
    const fl = (p.stun > 14 && p.stunType === 'big' ? 1 : 0) | (p.stun > 0 && p.stunType === 'small' ? 2 : 0) | (p.down > 0 ? 4 : 0) | (p.poke > 0 ? 8 : 0) |
      (p.charge >= 0 ? 16 : 0) | (p.covering > 0 ? 32 : 0) | (p.lunge > 0 ? 64 : 0) | (p.celebT > 0 ? 128 : 0) | (p.on ? 256 : 0) | (p.fight ? 512 : 0) | ((p.side || 1) < 0 ? 1024 : 0);
    f.push(Math.round(p.x * 4), Math.round(p.y * 4), ang, fl, Math.round((p.dkOff || 0) * 4), pidIndex(p), p.charge >= 0 ? Math.round(p.charge * 100) + 1 : 0, Math.round((p.shotAt && p.charge >= 0 ? Math.min(1, (performance.now() - p.shotAt) / 2000) : 0) * 100));
  }
  for (const r of refs) f.push(Math.round(r.x * 4), Math.round(r.y * 4), r.arm > 0 ? 1 : 0);
  return f;
}
function recTick() {
  if (!REC.on || !players.length) return;
  if (++REC.tick % REC_EVERY) return;
  // every puck drop (a faceoff, a penalty shot, a shootout attempt) starts a new piece of play: remember where, so a
  // replay's lead-in never reaches back past it into the previous play (Barry, Nov 22: "extra footage from before")
  const ph = S.phase, liveNow = ph === 'live' || ph === 'penalty';
  if (liveNow && REC.lastPh !== ph && !(REC.lastPh === 'live' || REC.lastPh === 'penalty')) { (REC.cuts = REC.cuts || []).push(REC.total); if (REC.cuts.length > 40) REC.cuts.shift(); }
  REC.lastPh = ph;
  REC.buf.push(capFrame()); REC.total++;
  if (REC.buf.length > REC_KEEP) REC.buf.shift();
  for (let i = REC.pending.length - 1; i >= 0; i--) if (REC.total >= REC.pending[i].endAt) { finishClip(REC.pending[i]); REC.pending.splice(i, 1); }
}
// something worth keeping just happened: grab the lead-up now, the follow-through over the next second and a half
function clipEvent(kind, meta, imp) {
  if (!REC.on || S.screen === 'replay') return;
  // don't stack near-identical clips (a save right before a goal is folded into the goal)
  const big = k => k === 'goal' || k === 'so' || k === 'pen';
  const recent = REC.pending.find(c => REC.total - c.at < 20);
  if (recent && !big(kind)) return;
  if (recent && !big(recent.kind)) REC.pending.splice(REC.pending.indexOf(recent), 1);
  // frame each clip around what matters: a short run-up to the key action (the shot, the hit, the move, the foul),
  // the moment itself, then enough afterward to see how it turned out
  const since = f => (f == null ? 1e9 : REC.total - f);
  const shotAgo = since(REC.lastShot);
  const lead = { goal: 24, save: 24, so: 34, hit: 30, deke: 26, pen: 32, fight: 16 }[kind] || 30;
  // the release, not the moment it went in, but only the shot that scored (an earlier shot up to 4 s before used to
  // start the replay far too soon): a goal/save replay starts about 1.6 s before the shot, at most ~3 s before the goal
  const keyAgo = (kind === 'goal' || kind === 'save') && shotAgo < 22 ? shotAgo : 0;
  const post = { goal: 45, save: 30, so: 40, hit: 30, deke: 24, pen: 34, fight: 45 }[kind] || CLIP_POST;
  const ev = { kind, meta: Object.assign({ period: S.period, up: S.upTeam, clock: Math.round(S.clock), score: S.score.slice() }, meta), imp: imp || 10, at: REC.total, key: REC.total - keyAgo,
    pre: Math.min(REC_KEEP - post - 4, keyAgo + lead), endAt: REC.total + post };
  REC.pending.push(ev);
}
function finishClip(ev) {
  const first = REC.total - REC.buf.length;                 // frame number of buf[0]
  let from = Math.max(first, ev.at - (ev.pre || CLIP_PRE));
  // start no earlier than just before the puck drop that began this piece of play (half a second, to show the drop)
  const cut = (REC.cuts || []).filter(c => c <= ev.at).pop();
  if (cut != null && cut - 8 > from) from = Math.min(cut - 8, ev.at - 6);
  const frames = REC.buf.slice(from - first);
  if (frames.length < 8) return;
  const m = S.match || {};
  const look = { teams: (m.teams || []).map(t => t && JSON.parse(JSON.stringify(t))), home: m.home ?? 0, away: [TEAM[0].kit || TEAM[0].away, TEAM[1].kit || TEAM[1].away], tourney: m.tourney || null };
  REC.clips.push({ v: 3, f0: from, geo: RINK_GEO, np: POOL.length, kind: ev.kind, imp: ev.imp, fps: 60 / REC_EVERY, frames: encodeFrames(frames), pids: REC.pids.slice(), look, meta: ev.meta, mark: ev.at - from, key: Math.max(0, (ev.key ?? ev.at) - from),   // key: the release (goals/saves) or the moment itself
   
    snd: typeof rsndSlice === 'function' ? rsndSlice(from, frames.length) : null });   // its sounds (replaysound.js)
  // keep every goal; only the best of the rest
  const others = REC.clips.filter(c => c.kind !== 'goal' && c.kind !== 'so' && c.kind !== 'pen');
  const pens = REC.clips.filter(c => c.kind === 'pen'); if (pens.length > 4) REC.clips.splice(REC.clips.indexOf(pens[0]), 1);
  if (others.length > 6) { const worst = others.sort((a, b) => a.imp - b.imp)[0]; REC.clips.splice(REC.clips.indexOf(worst), 1); }
}
function flushClips() { for (const ev of REC.pending) finishClip(ev); REC.pending = []; }
const plTag = p => p && p.pl ? '#' + p.num + ' ' + p.pl.last.toUpperCase() : '';

// ====================================================================
//  REPLAY PLAYER (shared: Jumbotron uses the data, menus use the full viewer)
// ====================================================================
function playReplay(clip, opts = {}) {
  let frames;
  try { frames = clipFrames(clip); } catch (e) { frames = null; }
  if (!frames || !frames.length) { if (opts.onClose) opts.onClose('broken'); return false; }
  const look = clip.look || {};
  const teams = (look.teams && look.teams[0]) ? look.teams : [DEFAULT_TEAMS.blizzard, DEFAULT_TEAMS.inferno];
  S.match = { teams, home: look.home || 0, lineups: null, tourney: look.tourney || null, replay: true };
  TEAM[0] = teamPalette(teams[0], look.away ? look.away[0] : (look.home !== 0));
  TEAM[1] = teamPalette(teams[1], look.away ? look.away[1] : (look.home !== 1));
  initAudio();
  MS = null; S.so = null; makeTeams(); buildRink(); clearMarks(); if (typeof BOARDFX !== 'undefined') { BOARDFX.scuffs = []; BOARDFX.shake = null; }
  for (const p of players) resetPlayerState(p);
  particles.length = 0; floaters.length = 0; S.banner = null; S.comm = null; S.lamp = [0, 0]; S.cheer = 0; S.goalFlash = 0; S.hintT = 0;
  ctrl = null;
  document.querySelectorAll('.modal').forEach(m => m.remove());                // nothing left open on top of the replay
  S.rp = { clip, frames, f: 0, speed: 1, paused: false, endHold: 0, opts, lastScore: frames[0].slice(1, 3) };
  S.screen = 'replay'; S.phase = 'live';
  applyReplayFrame(0, true);
  sizeCanvas(); updateCamera(true);
  hideOverlays(); $('wrap').classList.add('show'); showReplayBar(true);
  cvs.focus();
  return true;
}
// facing between two recorded frames: the short way round (64 steps a turn)
function replayAng(a, b, t) { let d = ((b - a) % 64 + 96) % 64 - 32; return (a + d * t) / 64 * Math.PI * 2; }
function applyReplayFrame(fi, snap) {
  const R2 = S.rp, fr = R2.frames, i0 = Math.min(fr.length - 1, Math.floor(fi)), i1 = Math.min(fr.length - 1, i0 + 1), t = fi - i0;
  const a = fr[i0], b = fr[i1], L = (k) => (a[k] + (b[k] - a[k]) * t);
  S.clock = a[0] / 10; S.score = [a[1], a[2]]; S.period = a[7] || 1; setEnds(R2.clip.meta && R2.clip.meta.up != null ? R2.clip.meta.up : 0);
  puck.x = L(3) / 4; puck.y = L(4) / 4; puck.rz = L(5) / 4;
  const v2 = (R2.clip.v || 1) >= 2, np = v2 ? (R2.clip.np || POOL.length) : 8;
  const ow = t < 0.5 ? a[6] : b[6]; puck.owner = ow ? POOL[ow - 1] || null : null;   // a pass changes hands halfway between frames puck.shot = null; puck.air = false; puck.trail = puck.trail || [];
  let changed = false; const sd = clipStride(R2.clip), v3 = sd === 8;
  POOL.forEach((p, k) => {
    const on = k < np && (v2 ? !!(a[8 + k * sd + 3] & 256) : true);
    if (p.on !== on) { p.on = on; changed = true; }
  });
  if (changed) rebuildActive();
  POOL.forEach((p, k) => {
    if (k >= np) return;
    const o = 8 + k * sd;
    const nx = L(o) / 4, ny = L(o + 1) / 4;
    p.vx = snap ? 0 : nx - p.x; p.vy = snap ? 0 : ny - p.y;
    p.x = nx; p.y = ny;
    const ang = replayAng(a[o + 2], b[o + 2], t); p.fx = Math.cos(ang); p.fy = Math.sin(ang);
    const fl = a[o + 3];
    p.side = fl & 1024 ? -1 : 1;
    p.stun = fl & 1 ? 30 : fl & 2 ? 10 : 0; p.stunType = fl & 1 ? 'big' : fl & 2 ? 'small' : null;
    p.down = fl & 4 ? 10 : 0; p.poke = fl & 8 ? 7 : 0; p.charge = fl & 16 ? (v3 && a[o + 6] ? (L(o + 6) - 1) / 100 : 0.5) : -1; p.covering = fl & 32 ? 10 : 0;
    p.lunge = fl & 64 ? 5 : 0; p.lungeDx = p.fx; p.lungeDy = p.fy;
    p.dkOff = L(o + 4) / 4;
    const pi = a[o + 5]; const info = pi ? R2.clip.pids[pi - 1] : null;
    if (info) { p.num = info.num; p.cap = info.cap || null; p.rpHand = info.hand || null; const real = UI.save && UI.save.players && UI.save.players[info.pid]; if (real && p.pl !== real) p.pl = real; }
    p.fight = !!(fl & 512); p.celebT = fl & 128 ? 10 + (S.t % 40) : 0; p.celebType = info && info.celeb ? info.celeb : 'arms';
    p.anim += hyp(p.vx, p.vy) * 0.22 * 4 / REC_EVERY;
  });
  const ro = 8 + np * sd;
  refs.forEach((r, k) => { const nx = L(ro + k * 3) / 4, ny = L(ro + k * 3 + 1) / 4; r.vx = snap ? 0 : nx - r.x; r.vy = snap ? 0 : ny - r.y; r.x = nx; r.y = ny; r.arm = a[ro + k * 3 + 2] ? 20 : 0; r.anim += hyp(r.vx, r.vy) * 0.22; const s2 = hyp(r.vx, r.vy); if (s2 > 0.1) { r.fx = r.vx / s2; r.fy = r.vy / s2; } });
  // a goal in the clip: lamp, crowd, banner
  if (!snap && (a[1] > R2.lastScore[0] || a[2] > R2.lastScore[1])) {
    const team = a[1] > R2.lastScore[0] ? 0 : 1;
    S.lamp[team] = 150; S.goalFlash = 40; S.cheer = 150; S.cheerKind = team === S.match.home ? 'home' : 'away';
    floaters.push({ x: CX, y: isUp(team) ? GL_TOP + 40 : GL_BOT - 60, text: 'GOAL!', life: 120, big: true, color: '#ffd23f' });
    for (let i = 0; i < 30; i++) particles.push({ x: puck.x, y: puck.y, vx: rand(-2.5, 2.5), vy: rand(-2.5, 2.5), life: rand(30, 70), color: ['#ffd23f', '#ffffff', TEAM[team].main][i % 3] });
    if (typeof clipSnd !== 'function') { sfx.goalSound(team); if (team === S.match.home) sfx.cheer(1.2); else sfx.boo(); }   // (otherwise the clip's own sounds play it)
  }
  R2.lastScore = [a[1], a[2]];
}
function replayTick() {
  const R2 = S.rp; if (!R2) return;
  tickFx();
  if (!R2.paused) {
    if (R2.f >= R2.frames.length - 1) { if (++R2.endHold > 90) { R2.paused = true; R2.ended = true; showReplayBar(true); } }
    else { const f0 = R2.f; R2.f = Math.min(R2.frames.length - 1, R2.f + R2.speed / REC_EVERY); applyReplayFrame(R2.f); if (typeof rsndAdvance === 'function') rsndAdvance(R2.clip, R2.frames, f0, R2.f, 'clean', 1); }   // one recorded frame = 4 simulation ticks; the clip's sounds play along
  }
  updateCamera();
}
function replayRestart() { const R2 = S.rp; if (!R2) return; R2.f = 0; R2.endHold = 0; R2.paused = false; R2.ended = false; R2.lastScore = R2.frames[0].slice(1, 3); S.lamp = [0, 0]; floaters.length = 0; applyReplayFrame(0, true); updateCamera(true); showReplayBar(true); }
function replayClose() {
  const R2 = S.rp; S.rp = null; showReplayBar(false);
  $('wrap').classList.remove('show'); S.screen = 'menu'; S.match = null;
  if (R2 && R2.opts.onClose) R2.opts.onClose();
}
function replayKey(c, acts) {
  const R2 = S.rp; if (!R2) return;
  if (c === 'Escape' || c === 'Backspace' || acts.includes('pause') && c !== 'KeyP') return replayClose();
  if (c === 'Space' || c === 'KeyP') { if (R2.ended) replayRestart(); else R2.paused = !R2.paused; showReplayBar(true); }
  else if (c === 'KeyR') replayRestart();
  else if (c === 'KeyS' || c === 'ArrowDown') { R2.speed = R2.speed === 1 ? 0.35 : 1; showReplayBar(true); }
  else if (c === 'Enter') replayClose();
}
function showReplayBar(on) {
  const bar = $('replayBar'); if (!bar) return;
  bar.classList.toggle('show', !!on);
  if (!on || !S.rp) return;
  $('rpPause').textContent = S.rp.ended ? '⟲ WATCH AGAIN' : S.rp.paused ? '▶ PLAY' : '❚❚ PAUSE';
  $('rpSlow').textContent = S.rp.speed < 1 ? 'NORMAL SPEED' : 'SLOW-MO';
}
// title card drawn over the replay (retro broadcast style, in the competition's colours)
function drawReplayCard() {
  const R2 = S.rp; if (!R2) return;
  toScreen();
  const SW = viewW(), th = R2.opts.theme || { main: '#1d2449', accent: '#ffd23f', text: '#ffffff' };
  const title = (R2.opts.title || 'REPLAY').toUpperCase(), sub = (R2.opts.sub || R2.clip.meta.text || '').toUpperCase();
  // (Nov 23 broadcast pass) measured, not guessed: a long caption ("CHT 3 - 4 ORB OT · OT WINNER! #17 ...") used to run
  // past the card. Smaller type first, then the caption wraps onto a second line
  const maxW = SW - 16, mw = (str, f) => { ctx.font = (f * CTS).toFixed(1) + "px 'PH Pixel', monospace"; return ctx.measureText(str).width; };
  let fs = 8; if (Math.max(mw(title, 8), mw(sub, 8)) + 24 > maxW) fs = 6;
  let lines = [sub];
  if (mw(sub, fs) + 24 > maxW) { const ws = sub.split(' '); let a = ''; const out = []; for (const wd of ws) { const nx = a ? a + ' ' + wd : wd; if (mw(nx, fs) + 24 > maxW && a) { out.push(a); a = wd; } else a = nx; } if (a) out.push(a); lines = out.slice(0, 2); if (out.length > 2) lines[1] += '…'; }
  const lh = fs + 4, w = Math.min(maxW, Math.max(mw(title, fs), ...lines.map(l => mw(l, fs))) + 24), x = 8, y = HUDH + 8, hgt = 18 + lines.length * lh;
  ctx.fillStyle = 'rgba(5,7,16,.82)'; ctx.fillRect(x - 2, y - 2, w + 4, hgt + 4);
  ctx.fillStyle = th.main; ctx.fillRect(x, y, w, hgt);
  ctx.fillStyle = th.accent; ctx.fillRect(x, y, 4, hgt); ctx.fillRect(x, y + hgt - 1, w, 1);
  text(title, x + 12, y + 5, th.accent, fs, 'left', null);
  lines.forEach((l, k) => text(l, x + 12, y + 7 + lh + k * lh, th.text || '#fff', fs, 'left', null));
  // REPLAY bug in the corner
  const blink = (S.t >> 4) & 1;
  const by = HUDH + 14 + hgt;
  ctx.fillStyle = 'rgba(5,7,16,.8)'; ctx.fillRect(8, by, 62, 14);
  ctx.fillStyle = blink || R2.paused ? '#ff4a3d' : '#7a2620'; ctx.fillRect(12, by + 4, 6, 6);
  text(R2.paused ? 'PAUSED' : R2.speed < 1 ? 'SLO-MO' : 'REPLAY', 22, by + 3, '#ffffff', 8, 'left', null);
}

// ====================================================================
//  INTERMISSION: resurfacer cleans the ice while the Jumbotron shows the highlights
// ====================================================================
let wetCvs = null, wetCtx = null;
function ensureWet() {
  if (!wetCvs) { wetCvs = mkCanvas(W * K, H * K); wetCtx = wetCvs.getContext('2d'); }
  wetCtx.setTransform(1, 0, 0, 1, 0, 0); wetCtx.clearRect(0, 0, wetCvs.width, wetCvs.height); wetCtx.setTransform(K, 0, 0, K, 0, 0);
}
const ZAM_W = 32, ZAM_SPEED = 5.3, GATE_X = CX;    // (Nov 22: the machine is ~12% bigger, wider most of all)    // out of the Zamboni tunnel behind the bottom end boards
// the resurfacing pattern: laps around the rink, spiralling in one machine-width at a time, the way a real driver
// does it. The nets stay on the ice, so he works around them carefully: the outside lap creeps along behind each
// net (driving sideways there, it just fits), the next lap swings out around the front of the crease, and the
// inner laps clear them on their own. In and out of the tunnel he turns away from the bottom net at once.
const ZAM = { hw: 16, hl: 24, gap: 6, turn: 34 };   // the machine's footprint (half-width, half-length, world units) and the room he leaves
function zamboniPath() {
  const pts = [], add = (x, y) => { const l = pts[pts.length - 1]; if (!l || hyp(l.x - x, l.y - y) > 0.5) pts.push({ x, y }); };
  const behind = (GL_TOP - NET_D) - R.t - ZAM.hw - 3.5;                          // deepest inset that still passes behind a net
  const front = GL_TOP - R.t + 3 + ZAM.hw + ZAM.gap;                             // the inset that clears the front of a crease
  const netX = GOAL_HW + 2 + ZAM.hl + ZAM.gap, ease = 24, halfW = (R.r - R.l) / 2, d0 = Math.min(14, behind);
  // the rounded rectangle at inset d, from the middle of the left side heading up (clockwise on screen)
  const lapPoint = (d, s) => {
    const x0 = R.l + d, x1 = R.r - d, y0 = R.t + d, y1 = R.b - d, r = Math.max(10, R.cr - d);
    const hW = (x1 - x0) / 2 - r, hH = (y1 - y0) / 2 - r, arc = Math.PI * r / 2;
    const segs = [hH, arc, 2 * hW, arc, 2 * hH, arc, 2 * hW, arc, hH], tot = segs.reduce((a, b) => a + b, 0);
    let u = s * tot, i = 0; while (i < segs.length - 1 && u > segs[i]) { u -= segs[i]; i++; }
    const cxl = x0 + r, cxr = x1 - r, cyt = y0 + r, cyb = y1 - r, a = u / arc * Math.PI / 2;
    const P = [() => ({ x: x0, y: CY - u }), () => ({ x: cxl - Math.cos(a) * r, y: cyt - Math.sin(a) * r }),
      () => ({ x: cxl + u, y: y0 }), () => ({ x: cxr + Math.sin(a) * r, y: cyt - Math.cos(a) * r }),
      () => ({ x: x1, y: cyt + u }), () => ({ x: cxr + Math.cos(a) * r, y: cyb + Math.sin(a) * r }),
      () => ({ x: cxr - u, y: y1 }), () => ({ x: cxl - Math.sin(a) * r, y: cyb + Math.cos(a) * r }), () => ({ x: x0, y: cyb - u })];
    return Object.assign(P[i](), { seg: i, u, len: tot });
  };
  // a lap whose ends would run into a net swings out around the front of the crease (smoothly, over 'ease')
  const clearNets = (p, d) => {
    if (d <= behind || d >= front) return p;
    const ax = Math.abs(p.x - CX), w = ax <= netX ? 1 : ax >= netX + ease ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * (ax - netX) / ease);
    if (!w) return p;
    if (p.seg === 2) return { x: p.x, y: p.y + (front - d) * w };
    if (p.seg === 6) return { x: p.x, y: p.y - (front - d) * w };
    return p;
  };
  const arcTo = (cx, cy, r, a0, a1, n = 6) => { for (let k = 1; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; add(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } };
  // in through the gate, and straight away a tight turn to the left along the bottom boards (behind the net)
  const rr = d0 + (ZAM.turn || 18), ry = R.b - d0 + rr;                                 // (a wide turn, so the tail swings clear of the net)
  add(GATE_X, R.b + 70); add(GATE_X, ry);
  arcTo(GATE_X - rr, ry, rr, 0, -Math.PI / 2, 8);
  const lap = (d, from, prev) => {
    const N = Math.max(40, Math.round(lapPoint(d, 0).len / 4));
    for (let i = 1; i <= N; i++) {
      const s = from + (1 - from) * i / N;
      let p = lapPoint(d, s), dd = d;
      if (from === 0 && prev != null && p.seg === 0 && p.u < 44) {         // moving in from the lap before, on the left side
        const k = p.u / 44, e = k * k * (3 - 2 * k); dd = prev + (d - prev) * e; p = Object.assign({}, p, { x: R.l + dd });
      }
      if (from > 0 && (p.seg < 6 || (p.seg === 6 && p.x > GATE_X - rr))) continue;   // (the entry joins the first lap on its bottom side)
      p = clearNets(p, dd);
      add(p.x, p.y);
    }
  };
  lap(d0, 0.5, null);                                                      // the rest of the first lap's bottom, round to the left side
  const laps = []; for (let d = d0; halfW - d > 16; d += ZAM_W - 1) laps.push(d);
  laps.forEach((d, li) => lap(d, 0, li ? laps[li - 1] : null));
  // out: a wide U-turn in the middle, down the right of the bottom net, along behind it and back through the gate
  const L = pts[pts.length - 1], ox = GATE_X + rr + 18, ur = (ox - L.x) / 2;
  arcTo(L.x + ur, L.y, ur, Math.PI, 2 * Math.PI, 10);
  add(ox, R.b - d0 - 14);
  arcTo(ox - 14, R.b - d0 - 14, 14, 0, Math.PI / 2);
  add(GATE_X + rr, R.b - d0);
  arcTo(GATE_X + rr, ry, rr, -Math.PI / 2, -Math.PI, 8);
  add(GATE_X, R.b + 74);
  return pts;
}
// near a net he slows right down
function zamNearNet(Z) {
  for (const [gy, back] of [[GL_TOP, -1], [GL_BOT, 1]]) {
    const ny0 = Math.min(gy, gy + back * NET_D), ny1 = Math.max(gy, gy + back * NET_D);
    const dx = Math.max(0, Math.abs(Z.x - CX) - GOAL_HW - 2), dy = Math.max(0, ny0 - Z.y, Z.y - ny1);
    if (hyp(dx, dy) < ZAM.hl + 16) return true;
  }
  return false;
}
function startIntermission() {
  hideOverlays();
  flushClips();
  S.screen = 'intermission';
  if (typeof alienTeamClear === 'function') alienTeamClear();   // the alien skaters (if any) are back to normal
  ensureWet();
  const path = zamboniPath();
  const per = S.period;
  const clips = REC.clips.filter(c => c.meta.period === per && (c.kind === 'goal' || c.imp >= 20)).concat(REC.clips.filter(c => c.meta.period !== per && c.kind === 'goal')).slice(0, 6);
  S.inter = { t: 0, zam: { path, seg: 0, x: path[0].x, y: path[0].y, dx: 0, dy: -1, done: false, out: false }, clips, ci: 0, cf: 0, cframes: null, stats: [S.sog[0], S.sog[1]] };
  for (const p of players) { p.charge = -1; p.inx = p.iny = 0; }
  S.cheer = 0; S.comm = null; S.banner = null;
  const why = typeof alienPick === 'function' ? alienPick() : null;
  if (why) S.inter.alien = alienStart(S.inter, why); else zamboniHum(true);   // (or the Alien Ice Crew: aliens.js)
  if (typeof aiIntermissionTactics === 'function') for (const t of [0, 1]) aiIntermissionTactics(t);   // every computer-coached side (a human side is skipped inside)
  if (typeof scoutFade === 'function') scoutFade();
  if (typeof showTacPick === 'function') showTacPick(true);
}
function skipIntermission() {
  if (S.screen !== 'intermission') return;
  if (!S.inter) return continueAfterMsg();            // overtime break: no resurfacing
  zamboniHum(false); if (typeof alienHum === 'function') alienHum(false);
  S.inter = null; if (wetCtx) ensureWet();
  continueAfterMsg();                          // resurfaced: clearMarks + next period
}
function interTick() {
  const I = S.inter; if (!I) return;
  tickFx(); I.t++;
  const Z = I.zam;
  if (I.alien) { if (!Z.done) alienTick(I); }
  else if (!Z.done) {
    let move = ZAM_SPEED / SPEEDS[S.speed] * (zamNearNet(Z) ? 0.4 : 1);   // a time-lapse lap (~23 s whatever the game speed), crawling past the nets
    while (move > 0 && Z.seg < Z.path.length - 1) {
      const a = Z.path[Z.seg + 1], dx = a.x - Z.x, dy = a.y - Z.y, d = hyp(dx, dy);
      if (d <= move) { Z.x = a.x; Z.y = a.y; move -= d; Z.seg++; continue; }
      Z.dx = dx / d; Z.dy = dy / d; Z.x += Z.dx * move; Z.y += Z.dy * move; move = 0;
    }
    // clean behind the machine: skate marks wiped, fresh wet sheen laid down
    if (Z.y < R.b - 4 && Z.y > R.t + 4) {
      const bx = Z.x - Z.dx * 18, by = Z.y - Z.dy * 18;
      if (marksCtx) { marksCtx.save(); marksCtx.globalCompositeOperation = 'destination-out'; marksCtx.beginPath(); marksCtx.arc(bx, by, ZAM_W / 2, 0, Math.PI * 2); marksCtx.fill(); marksCtx.restore(); }
      if (wetCtx) {
        wetCtx.save(); roundRectPath(wetCtx, R.l, R.t, R.r - R.l, R.b - R.t, R.cr); wetCtx.clip();
        wetCtx.fillStyle = 'rgba(20,80,20,0.05)';   // SOCCER: a freshly mown stripe
        wetCtx.beginPath(); wetCtx.arc(bx, by, ZAM_W / 2 - 1, 0, Math.PI * 2); wetCtx.fill(); wetCtx.restore();
      }
    }
    if ((I.t & 3) === 0) particles.push({ x: Z.x - Z.dx * 6 + rand(-2, 2), y: Z.y - Z.dy * 6 - 10, vx: rand(-0.2, 0.2), vy: -rand(0.3, 0.7), life: rand(16, 30), color: Math.random() < 0.5 ? 'rgba(120,190,90,.85)' : 'rgba(80,150,60,.85)' });   // grass clippings
    if (Z.seg >= Z.path.length - 1) { Z.done = true; zamboniHum(false); }
  }
  // camera rides along with the machine
  const vh = viewH(), vw = viewW();
  if (S.cam !== 'FULL') {
    const ty = clamp(Z.y + Z.dy * 50 - vh * 0.5, 0, H - vh), tx = clamp(Z.x + Z.dx * 30 - vw / 2, 0, W - vw);
    camY += (ty - camY) * 0.12; camX += (tx - camX) * 0.1;
  }
  // Jumbotron: step through this period's highlights
  if (I.clips.length) {
    if (!I.cframes) { try { I.cframes = clipFrames(I.clips[I.ci]); } catch (e) { I.cframes = []; } I.cf = 0; }
    I.cf += 15 / (60 * SPEEDS[S.speed]);
    if (I.cf >= I.cframes.length + 20) { I.ci = (I.ci + 1) % I.clips.length; I.cframes = null; }
  }
}
// ---------- resurfacer sprite, on the players' fine pixel grid. Five machines: three everyday models (the classic in
// home colours, a compact electric, a vintage with a chrome grille) and two premium ones that only the renovated
// buildings own (the Modern Dome's black-and-chrome PRO with an LED light bar, the Grand Hockey Palace's ROYAL in
// crimson and gold). The driver is different every intermission: hat, jacket, hair, skin, and whether he waves.
const ZAM_MODELS = {
  classic: { name: 'Classic',      body: null,      tank: '#6fae5c', trim: null,      wheel: '#15161c', hub: '#8e95a6', beacon: 'amber' },
  compact: { name: 'Electric',     body: '#f2f4f8', tank: '#7fbf6a', trim: '#18b38a', wheel: '#15161c', hub: '#c9ced8', beacon: 'amber', bolt: true },
  vintage: { name: 'Vintage',      body: '#c0392b', tank: '#f1e3b5', trim: '#f4f4ee', wheel: '#1b1c22', hub: '#d8dde6', beacon: 'red', grille: true, stack: true },
  pro:     { name: 'Pro',          body: '#15171e', tank: '#2a2e3a', trim: null,      wheel: '#0b0c10', hub: '#e8ecf4', beacon: 'led', canopy: true, glow: true },
  royal:   { name: 'Royal',        body: '#7a1424', tank: '#f4ead2', trim: '#d9b04a', wheel: '#1b0a0e', hub: '#ffd86a', beacon: 'gold', crown: true, canopy: true },
};
function zamboniPick() {
  const v = S.match && S.match.arena ? S.match.arena.venue : 'classic', r = Math.random();
  const model = v === 'palace' ? (r < 0.75 ? 'royal' : 'pro') : v === 'modern' ? (r < 0.8 ? 'pro' : 'classic')
    : (v === 'barn' || v === 'outdoor') ? (r < 0.55 ? 'vintage' : r < 0.8 ? 'classic' : 'compact') : (r < 0.5 ? 'classic' : r < 0.78 ? 'compact' : 'vintage');
  const pick = a => a[(Math.random() * a.length) | 0];
  const driver = {
    hat: pick(['toque', 'toque', 'cap', 'cap', 'muffs', 'none', 'hard']), hatC: pick(['#d9342b', '#2f6fe8', '#1b1c22', '#f2c230', '#18b38a', '#f4f4f4', null]),
    coat: pick(['#1b2a5c', '#2a2f3a', '#8a2a2a', '#3a5a2a', '#e86a1a', null]), skin: pick(['#f0c49b', '#e0a878', '#c68a5e', '#8d5a3b', '#5c3a26']),
    hair: pick(['#2a1a10', '#5a3a1e', '#c9a050', '#8a8a8a', '#e8e8e8', '#1b1c22']), shades: Math.random() < 0.25, waves: Math.random() < 0.6,
  };
  if (model === 'royal') { driver.hat = 'none'; driver.coat = '#1b1c22'; driver.bow = true; }
  if (model === 'pro' && Math.random() < 0.6) driver.hat = 'muffs';
  return { model, driver };
}
const ZAM_SCALE = { x: 1.15, y: 1.1 };
let ZAM_OFF = null;
function drawZamboni(Z) {
  if (!Z || Z.done || Z.alien) return;
  const FW = 150, FH = 170, OX = 75, OY = 100;
  if (!ZAM_OFF) { ZAM_OFF = document.createElement('canvas'); ZAM_OFF.width = FW; ZAM_OFF.height = FH; }
  const oc = ZAM_OFF.getContext('2d'); oc.setTransform(1, 0, 0, 1, 0, 0); oc.clearRect(0, 0, FW, FH); oc.globalAlpha = 1;
  const keep = ctx, kp = toPSprite;
  ctx = oc; toPSprite = () => oc.setTransform(1, 0, 0, 1, OX, OY);
  try { drawZamboniRaw(Z); } finally { ctx = keep; toPSprite = kp; }
  ctx.save(); kp(Z.x, Z.y); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(ZAM_OFF, -OX * ZAM_SCALE.x, -OY * ZAM_SCALE.y, FW * ZAM_SCALE.x, FH * ZAM_SCALE.y);
  ctx.restore();
}
function drawZamboniRaw(Z) {
  if (!Z || Z.done || Z.alien) return;
  const hm = S.match ? S.match.home : 0, C = TEAM[hm];
  if (!Z.look) Z.look = zamboniPick();
  const M = ZAM_MODELS[Z.look.model] || ZAM_MODELS.classic, D = Z.look.driver;
  // which way it faces: four upright views (no rotation, so its pixels stay on the same grid as everyone else)
  const ax = Math.abs(Z.dx), ay = Math.abs(Z.dy);
  if (!Z.face || ay > ax * 1.25) Z.face = ay >= ax ? (Z.dy < 0 ? 'up' : 'down') : Z.face;
  if (ax > ay * 1.25) Z.face = Z.dx < 0 ? 'left' : 'right';
  // fades in out of the dark tunnel and back into it at the end
  const a = clamp(Math.min((ZTUN.y0 + 46 - Z.y) / 34, 1), 0, 1);
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  toPSprite(Z.x, Z.y);
  const side = Z.face === 'left' || Z.face === 'right', m = Z.face === 'left' ? -1 : 1;
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; px(m > 0 ? x : -x - w, y, w, h); };
  const t8 = (S.t >> 3) & 1, wob = (S.t >> 2) & 1;
  const body = M.body || C.main, bodyD = shade(body, -0.28), bodyL = shade(body, 0.16), trim = M.trim || C.trim || '#ffffff';
  const tank = M.tank, tankD = shade(tank, -0.18), tankL = shade(tank, 0.1), wheel = M.wheel, hub = M.hub;
  const metal = '#c9ced8', metalD = '#8e95a6', dark = '#20232d';
  const coat = D.coat || C.dark, coatD = shade(coat, -0.25), skin = D.skin;
  const head = { skin, hair: D.hair, hs: 0, hat: D.hat === 'none' ? null : D.hat, hatC: D.hatC || C.main, shades: D.shades };
  const crest = (x0, y0) => { if (C.colors && typeof drawCrest === 'function') { if (m < 0) { ctx.save(); ctx.scale(-1, 1); drawCrest(C, -x0 - 8, y0, 8); ctx.restore(); } else drawCrest(C, x0, y0, 8); } };
  const crestBadge = (cx, cy) => {                               // the home crest on a round plate (or the crown on the royal)
    if (M.crown) { R(cx - 4, cy - 1, 9, 4, '#ffd86a'); R(cx - 4, cy - 3, 1, 2, '#ffd86a'); R(cx, cy - 4, 1, 3, '#ffd86a'); R(cx + 4, cy - 3, 1, 2, '#ffd86a'); R(cx, cy, 1, 1, '#d9342b'); R(cx - 2, cy + 1, 1, 1, '#2f6fe8'); R(cx + 2, cy + 1, 1, 1, '#2f6fe8'); return; }
    R(cx - 4, cy - 5, 9, 10, trim); R(cx - 5, cy - 4, 11, 8, trim); R(cx - 3, cy - 4, 7, 8, shade(C.main, -0.1)); R(cx - 4, cy - 3, 9, 6, shade(C.main, -0.1));
    crest(cx - 4 + (m < 0 ? 1 : 0), cy - 4);
  };
  const beacon = (bx, by) => {
    if (M.beacon === 'led') return;
    const on = M.beacon === 'gold' ? '#ffd86a' : M.beacon === 'red' ? '#ff4a3a' : '#ffb02e';
    R(bx, by + 2, 4, 1, dark); R(bx + 1, by, 2, 2, t8 ? on : shade(on, -0.55));
    if (t8) { const h = M.beacon === 'red' ? 'rgba(255,74,58,.45)' : 'rgba(255,176,46,.45)'; R(bx, by, 1, 1, h); R(bx + 3, by, 1, 1, h); R(bx + 1, by - 1, 2, 1, h); R(bx - 1, by + 1, 1, 1, h); R(bx + 4, by + 1, 1, 1, h); }
  };
  const tyre = (x, y, w, h) => {                                  // a tyre seen side-on: rounded, tread rolling, hub
    R(x + 1, y, w - 2, h, wheel); R(x, y + 1, w, h - 2, wheel);
    for (let k = wob; k < h; k += 2) R(x, y + k, 1, 1, shade(wheel, 0.3));
    R(x + (w >> 1) - 1, y + (h >> 1) - 1, 3, 3, hub); R(x + (w >> 1), y + (h >> 1), 1, 1, shade(hub, -0.35));
  };
  if (Z.face === 'down' || Z.face === 'up') {
    const down = Z.face === 'down', gy = 15;
    R(-19, gy, 38, 2, 'rgba(20,30,60,.3)');                                                          // shadow
    if (!down) { R(-17, gy + 2, 34, 3, 'rgba(40,120,40,.45)'); R(-16, gy + 5, 32, 2, 'rgba(40,120,40,.2)'); }   // the wet towel's trail
    // the deck, seen from above (31 px deep), with the tyres peeking out at the corners
    R(-20, -27, 3, 7, wheel); R(17, -27, 3, 7, wheel); R(-20, -27 + wob, 3, 1, shade(wheel, 0.3)); R(17, -27 + wob, 3, 1, shade(wheel, 0.3));
    R(-18, -30, 36, 31, bodyD); R(-17, -29, 34, 30, body); R(-17, -29, 34, 1, bodyL); R(-17, -29, 1, 30, bodyL);
    const cabY = down ? -10 : -30, tankY = down ? -30 : -18;                                          // cab at the front end
    R(-16, cabY + 1, 32, 9, '#2a2e3a'); R(-16, cabY + 1, 32, 1, '#383d4c');
    const driver = () => {
      const dx = -12, dy = down ? -2 : -21;                                                           // seated on the left side of the cab
      R(dx - 1, dy - 11, 10, 11, M.crown ? '#5a0a14' : dark); R(dx - 1, dy - 11, 10, 1, M.crown ? '#8a1a2a' : '#3a3e4c');   // seat back
      R(dx, dy - 10, 8, 8, coat); R(dx, dy - 10, 1, 8, shade(coat, 0.15)); R(dx + 7, dy - 10, 1, 8, coatD); R(dx, dy - 3, 8, 1, coatD);
      if (D.bow && down) { R(dx + 2, dy - 10, 4, 1, '#f4f4f4'); R(dx + 3, dy - 10, 2, 1, '#d9342b'); }
      if (down) {
        R(dx - 2, dy - 9, 2, 6, coat); R(dx + 8, dy - 9, 2, 6, coat); R(dx - 1, dy - 3, 2, 2, skin); R(dx + 7, dy - 3, 2, 2, skin);
        R(dx - 2, dy - 1, 12, 1, '#0b0c10'); R(dx + 3, dy - 2, 2, 1, '#0b0c10');                       // the steering wheel
        if (D.waves && ((S.t >> 5) % 6 === 0)) { R(dx - 3, dy - 16, 2, 7, coat); R(dx - 3, dy - 18 - t8, 2, 2, skin); }
      } else { R(dx - 2, dy - 9, 2, 5, coat); R(dx + 8, dy - 9, 2, 5, coat); }
      R(dx + 3, dy - 11, 2, 1, shade(skin, -0.18));
      staffHead((x0, y0, w, h, c) => R(dx + x0, dy - 19 + y0, w, h, c), Object.assign({ back: !down }, head));
    };
    if (!down) driver();                                                                               // behind the tank: drawn first
    // the snow tank: a raised box with a lid, ribs and the crest
    const tH = 8;
    R(-15, tankY - tH, 30, 20, tankD); R(-14, tankY - tH, 28, 19, tank); R(-14, tankY - tH, 28, 1, tankL);
    for (let y = tankY - tH + 4; y < tankY - tH + 18; y += 4) R(-13, y, 26, 1, tankD);
    R(-15, tankY + 12 - tH, 30, tH, shade(tank, -0.1)); R(-15, tankY + 12 - tH, 30, 1, tankL); R(-15, tankY + 11, 30, 1, tankD);
    for (let x = -12; x < 14; x += 5) R(x, tankY + 13 - tH, 1, tH - 2, tankD);
    if (M.glow) { const g = t8 ? C.main : shade(C.main, 0.3); R(-15, tankY - tH, 30, 1, g); R(-15, tankY + 11, 30, 1, g); }
    crestBadge(0, tankY - tH + 9);
    if (M.beacon === 'led') for (let i = 0; i < 14; i++) R(-14 + i * 2, tankY - tH - 1, 2, 1, ((i + (S.t >> 2)) % 14) < 4 ? (i < 7 ? '#4aa8ff' : '#ffffff') : dark);
    else beacon(9, tankY - tH - 4);
    if (M.stack) { R(13, tankY - tH - 8, 2, 10, '#3a3c46'); R(13, tankY - tH - 8, 1, 10, metalD); if (t8) { R(13, tankY - tH - 12, 3, 3, 'rgba(230,235,245,.6)'); } }
    if (down) driver();
    if (M.canopy) {                                                                                   // glass canopy over the cab
      const y0 = down ? -24 : -44, y1 = down ? -1 : -21, col = M.crown ? '#d9b04a' : metal;
      R(-15, y0, 15, 2, col); R(-15, y0, 1, y1 - y0, col); R(-1, y0, 1, y1 - y0, col);
      ctx.fillStyle = 'rgba(170,215,255,.2)'; px(-14, y0 + 2, 13, y1 - y0 - 2); R(-13, y0 + 3, 1, 8, 'rgba(255,255,255,.35)');
    }
    // the face toward us: the front (headlights, bumper, crest) or the back (conditioner, tail lights)
    R(-18, 1, 36, 14, body); R(-18, 1, 36, 1, bodyL); R(-18, 1, 1, 14, bodyL); R(17, 1, 1, 14, bodyD);
    R(-18, 9, 36, 1, trim); R(-18, 11, 36, 1, trim);
    R(-21, 6, 4, 9, wheel); R(17, 6, 4, 9, wheel); R(-21, 6 + wob * 2, 4, 1, shade(wheel, 0.3)); R(17, 6 + wob * 2, 4, 1, shade(wheel, 0.3));
    if (down) {
      if (M.grille) { R(-8, 2, 16, 7, '#d8dde6'); for (let x = -7; x < 8; x += 2) R(x, 3, 1, 5, metalD); R(-16, 3, 4, 3, '#ffe9a0'); R(12, 3, 4, 3, '#ffe9a0'); }
      else { R(-16, 3, 5, 3, dark); R(-15, 4, 3, 1, '#fff4c0'); R(11, 3, 5, 3, dark); R(12, 4, 3, 1, '#fff4c0'); crestBadge(0, 5); }
      if (M.bolt) { R(9, 2, 2, 2, trim); R(8, 4, 2, 1, trim); R(9, 5, 2, 1, trim); R(8, 6, 2, 1, trim); }
      R(-19, 12, 38, 3, dark); R(-19, 12, 38, 1, '#3a3e4c');                                           // bumper
    } else {
      R(-16, 3, 3, 2, '#ff4a3a'); R(13, 3, 3, 2, '#ff4a3a'); R(-4, 3, 8, 4, shade(body, -0.12));      // tail lights, rear panel
      R(-20, 11, 40, 5, metal); R(-20, 11, 40, 1, '#eef1f6'); R(-20, 15, 40, 1, metalD);                 // the conditioner
      for (let x = -18; x < 19; x += 4) R(x, 13, 2, 1, metalD);
      R(-19, 16, 38, 2, 'rgba(40,120,40,.5)');
    }
  } else {
    // side view: 56 long, the deck 20 deep, the front toward m
    const gy = 10;
    R(-30, gy, 60, 2, 'rgba(20,30,60,.3)');
    R(-38, gy + 1, 9, 2, 'rgba(40,120,40,.45)'); R(-46, gy + 1, 8, 1, 'rgba(40,120,40,.2)');
    R(-28, -24, 56, 20, bodyD); R(-27, -23, 54, 19, body); R(-27, -23, 54, 1, bodyL);                 // the deck from above
    R(6, -22, 20, 17, '#2a2e3a'); R(6, -22, 20, 1, '#383d4c');                                         // the cab floor
    // the driver in profile, sat at the front facing forward
    const dx = 10, dy = -6;
    R(dx - 3, dy - 13, 3, 13, M.crown ? '#5a0a14' : dark);                                            // seat back
    R(dx, dy - 10, 7, 9, coat); R(dx, dy - 10, 1, 9, shade(coat, 0.15)); R(dx, dy - 2, 7, 1, coatD);
    if (D.bow) { R(dx + 6, dy - 10, 1, 2, '#f4f4f4'); }
    R(dx + 4, dy - 7, 6, 2, coat); R(dx + 4, dy - 6, 6, 1, coatD); R(dx + 10, dy - 7, 2, 2, skin);     // arm out to the wheel
    R(dx + 11, dy - 9, 1, 8, '#0b0c10'); R(dx + 10, dy - 10, 3, 1, '#0b0c10');                          // steering column and wheel
    R(dx + 3, dy - 11, 2, 1, shade(skin, -0.18));
    const hx = dx, hy = dy - 19;
    R(hx, hy, 8, 8, skin); R(hx, hy + 7, 8, 1, shade(skin, -0.18)); R(hx + 8, hy + 4, 1, 1, skin);    // face in profile, nose
    R(hx + 6, hy + 3, 1, 1, '#ffffff'); R(hx + 7, hy + 3, 1, 1, STAFF_DARK); R(hx + 6, hy + 2, 2, 1, shade(D.hair, -0.15));
    R(hx + 6, hy + 6, 2, 1, shade(skin, -0.35)); R(hx + 2, hy + 3, 2, 2, shade(skin, -0.12));          // mouth, ear
    if (D.shades) R(hx + 5, hy + 3, 3, 1, '#0b0c10');
    const hat = head.hat, hc = head.hatC;
    if (hat === 'toque' || hat === 'cap') { R(hx - 1, hy - 2, 9, 3, hc); R(hx, hy - 2, 3, 1, shade(hc, 0.18)); if (hat === 'cap') R(hx + 7, hy + 1, 3, 1, shade(hc, -0.3)); else { R(hx - 1, hy + 1, 9, 1, shade(hc, 0.18)); R(hx + 2, hy - 3, 2, 1, '#f4f4f4'); } R(hx, hy + 2, 2, 3, D.hair); }
    else if (hat === 'hard') { R(hx - 1, hy - 2, 9, 3, '#f2c230'); R(hx - 2, hy + 1, 12, 1, '#d9a810'); R(hx, hy + 2, 2, 3, D.hair); }
    else { R(hx, hy - 1, 8, 3, D.hair); R(hx, hy + 2, 3, 4, D.hair); R(hx + 1, hy - 1, 3, 1, shade(D.hair, 0.22)); if (hat === 'muffs') { R(hx - 1, hy - 1, 9, 1, '#1b1c22'); R(hx + 1, hy + 2, 3, 3, hc); } }
    // the snow tank over the back two thirds: lid from above, then its side with the big crest
    const tH = 10;
    R(-26, -23 - tH, 32, 19, tankD); R(-25, -23 - tH, 30, 18, tank); R(-25, -23 - tH, 30, 1, tankL);
    for (let x = -21; x < 5; x += 5) R(x, -22 - tH, 1, 16, tankD);
    R(-26, -4 - tH, 32, tH, shade(tank, -0.1)); R(-26, -4 - tH, 32, 1, tankL); R(5, -4 - tH, 1, tH, tankD);
    if (M.glow) { const g = t8 ? C.main : shade(C.main, 0.3); R(-26, -23 - tH, 32, 1, g); R(-26, -5, 32, 1, g); }
    crestBadge(-10, -9);
    if (M.beacon === 'led') for (let i = 0; i < 15; i++) R(-25 + i * 2, -24 - tH, 2, 1, ((i + (S.t >> 2)) % 15) < 4 ? (i < 7 ? '#4aa8ff' : '#ffffff') : dark);
    else beacon(1, -27 - tH);
    if (M.stack) { R(3, -30 - tH, 2, 18, '#3a3c46'); R(3, -30 - tH, 1, 18, metalD); if (t8) R(3, -34 - tH, 3, 3, 'rgba(230,235,245,.6)'); }
    if (M.canopy) {
      const col = M.crown ? '#d9b04a' : metal;
      R(6, -34, 21, 2, col); R(6, -34, 1, 30, col); R(26, -34, 1, 30, col);
      ctx.fillStyle = 'rgba(170,215,255,.2)'; px(m > 0 ? 7 : -26, -32, 19, 28); R(8, -31, 1, 10, 'rgba(255,255,255,.35)');
    }
    // the side of the machine: panel, stripes, the conditioner at the back, the bumper and lamp at the front, two big wheels
    R(-28, -4, 56, 14, body); R(-28, -4, 56, 1, bodyL); R(-28, 9, 56, 1, bodyD);
    R(-28, 2, 56, 1, trim); R(-28, 4, 56, 1, trim);
    if (M.bolt) { R(16, -2, 2, 2, trim); R(15, 0, 2, 1, trim); }
    R(-34, 2, 7, 7, metal); R(-34, 2, 7, 1, '#eef1f6'); R(-34, 8, 7, 1, metalD); R(-34, 9, 7, 1, 'rgba(40,120,40,.5)');
    R(28, 1, 3, 8, dark); R(27, -2, 2, 3, M.grille ? '#ffe9a0' : '#fff4c0');
    R(-29, 1, 2, 2, '#ff4a3a');
    tyre(-24, 1, 11, 11); tyre(13, 1, 11, 11);
  }
  ctx.restore();
}
// the Zamboni doors in the bottom boards: they swing open into the tunnel as the machine comes near, and shut behind it
const ZGATE = { open: 0 };
function drawGateOpen() {
  const Z = S.inter && S.inter.zam;
  const near = Z && !Z.done && !Z.alien && Math.abs(Z.x - GATE_X) < 40 && Z.y > R.b - 64 && Z.y < R.b + 52;   // shut once it is through
  ZGATE.open += ((near ? 1 : 0) - ZGATE.open) * 0.12;
  // two attendants work the Zamboni doors, one each side
  if (typeof drawAttendant === 'function') { const hold = ZGATE.open > 0.4, ax = ZGATE_HW + 8; drawAttendant(GATE_X - ax, R.b + 16, 1, hold, false, '#d9a066'); drawAttendant(GATE_X + ax, R.b + 16, -1, hold, false, '#7a4b2a'); }
  if (ZGATE.open < 0.02) return;
  toWorld();
  const k = ZGATE.open, hw = ZGATE_HW, y0 = R.b + 0.5;
  ctx.fillStyle = '#1a1e33'; ctx.fillRect(GATE_X - hw, y0, hw * 2, 5);                          // the opening
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(GATE_X - hw, y0 + 4.5, hw * 2, 0.6);
  for (const s0 of [-1, 1]) {                                                                   // two doors, hinged at the posts
    const hx = GATE_X + s0 * hw, a = s0 < 0 ? k * Math.PI / 2 : Math.PI - k * Math.PI / 2;
    const ex = hx + Math.cos(a) * hw, ey = y0 + 2.5 + Math.sin(a) * hw;
    ctx.strokeStyle = '#8a93a8'; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(hx, y0 + 2.5); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = '#dfe4ee'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(hx, y0 + 2.5); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = '#5d6480'; ctx.fillRect(hx - 1, y0 + 1.5, 2, 2);
  }
}
// mini replay on the big screen (drawn in screen space)
function drawJumbotron() {
  const I = S.inter; if (!I) return;
  toScreen();
  const SW = viewW(), w = Math.min(120, Math.round(SW * 0.36)), hgt = Math.round(w * 0.62), x = SW - w - 10, y = HUDH + 8;
  const hm = S.match ? S.match.home : 0, C = TEAM[hm], th = S.match && S.match.tourney ? tourneyTheme(S.match.tourney.key) : null;
  // housing
  ctx.fillStyle = '#05060d'; ctx.fillRect(x - 6, y - 4, w + 12, hgt + 26);
  ctx.fillStyle = th ? th.main : C.dark; ctx.fillRect(x - 5, y - 3, w + 10, hgt + 24);
  ctx.fillStyle = th ? th.accent : C.trim; ctx.fillRect(x - 5, y + hgt + 6, w + 10, 1);
  ctx.fillStyle = '#0b1020'; ctx.fillRect(x, y, w, hgt);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, hgt); ctx.clip();
  const clip = I.clips[I.ci], fr = I.cframes;
  if (clip && fr && fr.length) {
    const fi = Math.min(fr.length - 1, Math.floor(I.cf)), f = fr[fi];
    const px0 = f[3] / 4, py0 = f[4] / 4, sc = 0.42;            // centred on the puck
    const ox = x + w / 2 - px0 * sc, oy = y + hgt / 2 - py0 * sc;
    const X = v => ox + v * sc, Y = v => oy + v * sc;
    ctx.fillStyle = '#dfe9f4'; roundRectPath(ctx, X(R.l), Y(R.t), (R.r - R.l) * sc, (R.b - R.t) * sc, R.cr * sc); ctx.fill();
    ctx.fillStyle = '#c0392b'; ctx.fillRect(X(R.l), Y(CY) - 1, (R.r - R.l) * sc, 2); ctx.fillRect(X(R.l), Y(GL_TOP), (R.r - R.l) * sc, 1); ctx.fillRect(X(R.l), Y(GL_BOT), (R.r - R.l) * sc, 1);
    ctx.fillStyle = '#2f5fd0'; ctx.fillRect(X(R.l), Y(BLUE_TOP) - 1, (R.r - R.l) * sc, 3); ctx.fillRect(X(R.l), Y(BLUE_BOT) - 1, (R.r - R.l) * sc, 3);
    ctx.fillStyle = '#7fb4ff'; ctx.fillRect(X(CX - CREASE_R), Y(GL_TOP), CREASE_R * 2 * sc, 10 * sc); ctx.fillRect(X(CX - CREASE_R), Y(GL_BOT) - 10 * sc, CREASE_R * 2 * sc, 10 * sc);
    ctx.fillStyle = '#c0392b'; ctx.fillRect(X(CX - GOAL_HW), Y(GL_TOP) - 5, GOAL_HW * 2 * sc, 4); ctx.fillRect(X(CX - GOAL_HW), Y(GL_BOT) + 1, GOAL_HW * 2 * sc, 4);
    const tcol = [teamPalette(clip.look.teams[0] || DEFAULT_TEAMS.blizzard, clip.look.away ? clip.look.away[0] : false), teamPalette(clip.look.teams[1] || DEFAULT_TEAMS.inferno, clip.look.away ? clip.look.away[1] : true)];
    const np = (clip.v || 1) >= 2 ? clip.np || 10 : 8;
    for (let k = 0; k < np; k++) {
      const o = 8 + k * clipStride(clip), team = k < 8 ? (k < 4 ? 0 : 1) : (k - 8), gk = k < 8 && k % 4 === 3, s = gk ? 4.5 : 3.5;
      if ((clip.v || 1) >= 2 && !(f[o + 3] & 256)) continue;
      ctx.fillStyle = '#05060d'; ctx.fillRect(X(f[o] / 4) - s / 2 - 1, Y(f[o + 1] / 4) - s - 1, s + 2, s + 2);
      ctx.fillStyle = tcol[team].main; ctx.fillRect(X(f[o] / 4) - s / 2, Y(f[o + 1] / 4) - s, s, s);
      ctx.fillStyle = tcol[team].trim; ctx.fillRect(X(f[o] / 4) - s / 2, Y(f[o + 1] / 4) - 1.2, s, 0.8);
    }
    ctx.fillStyle = '#05060d'; ctx.fillRect(X(px0) - 1, Y(py0) - 1 - f[5] / 10, 2, 2);
  } else {
    // nothing to replay yet: logo and the shot count
    drawEmblemBadge(ctx, C, x + w / 2, y + hgt / 2 - 6, Math.min(22, hgt * 0.3));
    text('SHOTS ' + I.stats[0] + ' - ' + I.stats[1], x + w / 2, y + hgt - 14, '#ffd23f', 6, 'center', null);
  }
  // scanlines
  ctx.fillStyle = 'rgba(0,0,0,.18)'; for (let yy = y; yy < y + hgt; yy += 2) ctx.fillRect(x, yy, w, 1);
  ctx.restore();
  const cap = clip ? clipCaption(clip) : (th ? th.short : 'HALF-TIME');
  text(cap.slice(0, Math.floor((w + 8) / 6)), x + w / 2, y + hgt + 7, '#ffffff', 6, 'center', null);
}
function clipCaption(c) {
  const per = ['1ST', '1ST', '2ND'][c.meta.period - 1] || 'ET';
  return (per + ' · ' + (c.meta.text || c.kind)).toUpperCase();
}
function drawIntermissionBar() {
  toScreen();
  const SW = viewW(), y = HUDH + viewH() - 34, I = S.inter;
  ctx.fillStyle = 'rgba(11,14,30,.88)'; ctx.fillRect(10, y, SW - 20, 26);
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(10, y, 3, 26);
  const ords = ['1ST', '1ST', '2ND'];
  const fitSz = str => Math.max(5, Math.min(8, Math.floor((SW - 36) / Math.max(1, str.length))));    // never clipped: shrink to fit narrow cameras
  const l1 = 'END OF ' + (ords[S.period - 1] || '') + ' · ' + TEAM[0].abbr + ' ' + S.score[0] + ' - ' + S.score[1] + ' ' + TEAM[1].abbr;
  const l2 = (I && I.zam.done ? 'PITCH IS READY · ' : I && I.alien ? 'UNIDENTIFIED RESURFACING · ' : 'RESURFACING · ') + Input.first('shoot') + ' / CLICK: NEXT HALF';
  text(l1, 20, y + 4, '#ffffff', fitSz(l1), 'left', null);
  text(l2, 20, y + 15, I && I.zam.done && (S.t >> 4) & 1 ? '#ffd23f' : '#9aa3c7', fitSz(l2), 'left', null);
}
let humNodes = null;
function zamboniHum(on) {
  if (!AC || !master) return;
  try {
    if (on && !humNodes) {
      const o = AC.createOscillator(), lfo = AC.createOscillator(), lg = AC.createGain(), g = AC.createGain(), f = AC.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = 46; lfo.frequency.value = 7; lg.gain.value = 5; lfo.connect(lg).connect(o.frequency);
      f.type = 'lowpass'; f.frequency.value = 260; g.gain.value = 0.0001; g.gain.setTargetAtTime(0.03, AC.currentTime, 0.6);
      o.connect(f).connect(g).connect(master); o.start(); lfo.start();
      humNodes = { o, lfo, g };
    } else if (!on && humNodes) {
      const n = humNodes; humNodes = null;
      n.g.gain.setTargetAtTime(0.0001, AC.currentTime, 0.3); setTimeout(() => { try { n.o.stop(); n.lfo.stop(); } catch (e) {} }, 1200);
    }
  } catch (e) {}
}

// replay viewer buttons
$('rpBack').onclick = () => replayClose();
$('rpPause').onclick = () => { const R2 = S.rp; if (!R2) return; if (R2.ended) replayRestart(); else R2.paused = !R2.paused; showReplayBar(true); cvs.focus(); };
$('rpRestart').onclick = () => { replayRestart(); cvs.focus(); };
$('rpSlow').onclick = () => { const R2 = S.rp; if (!R2) return; R2.speed = R2.speed === 1 ? 0.35 : 1; showReplayBar(true); cvs.focus(); };

// ====================================================================
//  THE BLIMP: in the top-tier buildings (Modern Dome, Grand Hockey Palace) a little remote-controlled blimp in the
//  home team's colours putters around above the stands, with a digital ad panel on its side
// ====================================================================
const BLIMP_VENUES = ['modern', 'palace'];
function blimpOn() { return !!(S.match && S.match.arena && BLIMP_VENUES.includes(S.match.arena.venue) && S.screen !== 'replay' && S.screen !== 'menu'); }
function blimpPos(t) {
  // a slow lap around the building over the first rows of seats (a rounded-rectangle loop), with a gentle bob
  const a = t * 0.0009, ax = (R.r - R.l) / 2 + 150, ay = (R.b - R.t) / 2 + 70;
  const c = Math.cos(a), s = Math.sin(a), sg = v => (v < 0 ? -1 : 1);
  const x = CX + ax * sg(c) * Math.pow(Math.abs(c), 0.45), y = CY + ay * sg(s) * Math.pow(Math.abs(s), 0.45) + Math.sin(t * 0.03) * 2;
  return { x, y };
}
// drawn on the rink view (world units) and on the stadium canvases beside it, so it is seen wherever it flies
function drawBlimp(cOpt, ox, oy, scale) {
  if (!blimpOn()) return;
  const t = S.t || 0, p = blimpPos(t), q = blimpPos(t + 6), dir = q.x - p.x >= 0 ? 1 : -1;
  const H0 = TEAM[S.match.home ?? 0]; if (!H0) return;
  const c = cOpt || ctx, L = 96, Hh = 30;
  if (cOpt) c.setTransform(scale, 0, 0, scale, -ox * scale, -oy * scale); else toWorld();
  // its shadow on the seats below
  c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(p.x + 14, p.y + 40, L / 2, Hh / 3, 0, 0, Math.PI * 2); c.fill();
  c.save(); c.translate(Math.round(p.x), Math.round(p.y)); c.scale(dir, 1);
  // tail fins
  c.fillStyle = H0.dark || '#111'; c.beginPath(); c.moveTo(-L / 2 + 6, 0); c.lineTo(-L / 2 - 8, -15); c.lineTo(-L / 2 - 4, 0); c.lineTo(-L / 2 - 8, 15); c.closePath(); c.fill();
  c.fillStyle = H0.trim || '#fff'; c.fillRect(-L / 2 - 8, -15, 3, 1.5); c.fillRect(-L / 2 - 8, 13.5, 3, 1.5);
  // the envelope: team colour, a lighter top and a trim stripe
  c.fillStyle = H0.main; c.beginPath(); c.ellipse(0, 0, L / 2, Hh / 2, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.ellipse(-3, -5.5, L / 2 - 8, Hh / 5, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = H0.trim || '#fff'; c.fillRect(-L / 2 + 8, 8, L - 16, 1.5);
  c.strokeStyle = 'rgba(10,12,24,.7)'; c.lineWidth = 0.6; c.beginPath(); c.ellipse(0, 0, L / 2, Hh / 2, 0, 0, Math.PI * 2); c.stroke();
  // the team badge on the nose
  if (typeof drawEmblemBadge === 'function') { try { drawEmblemBadge(c, H0, L / 2 - 13, -1, 8); } catch (e) {} }
  // gondola and a blinking light
  c.fillStyle = '#1a1e2c'; c.fillRect(-9, Hh / 2 - 2, 18, 5); c.fillStyle = (t >> 4) & 1 ? '#ff4a3a' : '#5a1a14'; c.fillRect(7, Hh / 2 + 2, 2, 2);
  c.restore();
  // the digital ad panel on its side (drawn unmirrored so the text reads): team slogan and sponsors take turns
  const ads = (typeof JB_ADS !== 'undefined' ? JB_ADS : []).map(a => [a.brand, a.bg[0], a.fg]);
  const msgs = [['GO ' + ((H0.nick || H0.abbr || 'TEAM') + '').toUpperCase() + '!', H0.dark || '#111', H0.trim || '#fff'], ...ads];
  const m = msgs[Math.floor(t / 240) % msgs.length], pw = 54, ph = 13, px0 = Math.round(p.x - pw / 2 - dir * 6), py0 = Math.round(p.y - 7);
  c.fillStyle = '#05060d'; c.fillRect(px0 - 1, py0 - 1, pw + 2, ph + 2);
  c.fillStyle = m[1]; c.fillRect(px0, py0, pw, ph);
  if (typeof pText === 'function') {
    const k = 1.6, tw = pTextW(m[0]) * k;
    c.save(); c.beginPath(); c.rect(px0, py0, pw, ph); c.clip();
    if (tw <= pw - 4) pText(c, m[0], px0 + (pw - tw) / 2, py0 + 2.5, m[2], k);
    else { const off = ((t * 0.35) % (tw + pw)); pText(c, m[0], px0 + pw - off, py0 + 2.5, m[2], k); }   // too long: it scrolls
    c.restore();
  }
  c.fillStyle = 'rgba(0,0,0,.18)'; for (let yy = py0; yy < py0 + ph; yy += 1.6) c.fillRect(px0, yy, pw, 0.4);   // LED rows
}
