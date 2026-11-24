'use strict';
// ====================================================================
//  REPLAYS WITH SOUND. While a game is recorded, every sound effect is logged against the recording's frame
//  clock; each saved clip keeps the ones inside it (clip.snd = [[frame, name, arg], ...]). Played back, the same
//  synthesized effects fire at the same moments: in the replay viewer, on the Jumbotron (through the arena's
//  speakers: a little quieter, with an echo) and on the PUCK TALK desk TV. Clips saved before this existed, and the
//  league highlights the desk builds, get their sounds worked out from the clip itself (passes, shots, saves,
//  hits, the goal).
//  Also here: the crowd reacting to a Jumbotron replay (a murmur building to the moment, then a roar, a groan,
//  an "ooh"...), by what it was and whose team did it.
// ====================================================================
const RSND = { log: [], depth: 0, playing: false, buses: null, ac: null };
const RSND_KEYS = ['stick', 'shot', 'pass', 'board', 'post', 'bump', 'check', 'glass', 'bigHit', 'oof', 'poke', 'stop', 'save', 'goalSound', 'cheer', 'boo', 'ooh', 'whistle', 'buzzer', 'twine', 'drop', 'punch', 'glassPuck'];
// ---- recording: wrap the effects (only the outermost call is logged: goalSound's horn is part of goalSound)
function rsndLog(name, args) {
  if (RSND.playing || RSND.depth > 1 || typeof REC === 'undefined' || !REC.on || !S.match || S.match.replay || S.screen === 'replay') return;
  const a = args.length ? (typeof args[0] === 'number' ? Math.round(args[0] * 100) / 100 : typeof args[0] === 'boolean' ? (args[0] ? 1 : 0) : typeof args[0] === 'string' ? args[0] : null) : null;
  RSND.log.push([REC.total - 1 + (REC.tick % REC_EVERY) / REC_EVERY, name, a]);
  if (RSND.log.length > 900) RSND.log.splice(0, 300);
}
if (typeof sfx !== 'undefined') for (const k of RSND_KEYS) {
  const f = sfx[k]; if (typeof f !== 'function') continue;
  sfx[k] = function (...args) { RSND.depth++; try { rsndLog(k, args); return f.apply(this, args); } finally { RSND.depth--; } };
}
if (typeof crowdSfx === 'function') { const f0 = crowdSfx; crowdSfx = function (kind) { RSND.depth++; try { rsndLog('crowd:' + kind, []); return f0(kind); } finally { RSND.depth--; } }; }
if (typeof recReset === 'function') { const f0 = recReset; recReset = function () { RSND.log = []; return f0(); }; }
// the sounds inside one clip (called by finishClip): frames [from, from + n)
function rsndSlice(from, n) {
  const out = [];
  for (const [f, k, a] of RSND.log) if (f >= from - 0.5 && f < from + n) out.push([Math.round((f - from) * 10) / 10, k, a]);
  return out.length ? out : null;
}
// ---- clips with no sound list: work it out from the clip (passes, shots, saves, steals, hits, the goal)
const RSND_SYN = new WeakMap();
function clipSnd(clip, frames) {
  if (clip.snd && clip.snd.length) return clip.snd;
  if (RSND_SYN.has(clip)) return RSND_SYN.get(clip);
  const out = [];
  try {
    const fr = frames || clipFrames(clip), sd = clipStride(clip), np = (clip.v || 1) >= 2 ? (clip.np || 8) : 8, home = (clip.look && clip.look.home) || 0;
    const isG = k => k === 3 || k === 7;
    for (let i = 1; i < fr.length; i++) {
      const a = fr[i - 1], b = fr[i], o0 = a[6], o1 = b[6];
      if (o0 && !o1) {
        const c = fr[Math.min(fr.length - 1, i + 2)], n = Math.min(fr.length - 1, i + 2) - (i - 1) || 1;
        const vx = (c[3] - a[3]) / 4 / n, vy = (c[4] - a[4]) / 4 / n, sp = Math.hypot(vx, vy);
        const toNet = Math.abs(vy) > Math.abs(vx) * 0.6 && ((vy < 0 && b[4] / 4 < CY) || (vy > 0 && b[4] / 4 > CY));
        if (sp > 15 && toNet) out.push([i - 0.5, 'shot', Math.round(clamp((sp - 15) / 22, 0, 1) * 100) / 100]);
        else if (sp > 6) out.push([i - 0.5, 'pass', null]);
      } else if (!o0 && o1) out.push([i, isG(o1 - 1) ? 'save' : 'stick', null]);
      else if (o0 && o1 && o0 !== o1) out.push([i, isG(o1 - 1) ? 'save' : 'poke', null]);
      for (let k = 0; k < np; k++) {
        const fa = a[8 + k * sd + 3], fb = b[8 + k * sd + 3];
        if ((fb & 1) && !(fa & 1)) { const x = b[8 + k * sd] / 4; out.push([i, 'bigHit', null]); if (x < R.l + 16 || x > R.r - 16) out.push([i + 0.2, 'glass', 1]); }
        else if ((fb & 2) && !(fa & 2)) out.push([i, 'check', null]);
      }
      if (b[1] > a[1] || b[2] > a[2]) { const team = b[1] > a[1] ? 0 : 1; out.push([i, 'goalSound', team], [i + 0.3, team === home ? 'cheer' : 'boo', team === home ? 1.2 : null]); }
    }
  } catch (e) {}
  RSND_SYN.set(clip, out);
  return out;
}
// ---- playback
function rsndBuses() {
  if (!AC || !master) return null;
  if (RSND.buses && RSND.ac === AC && RSND.real === master) return RSND.buses;
  const real = master;
  const clean = AC.createGain(); clean.connect(real);
  // the arena's speakers: a touch of muffle and a slap-back echo off the far end of the building
  const arena = AC.createGain(), lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
  const dl = AC.createDelay(1); dl.delayTime.value = 0.16; const fb = AC.createGain(); fb.gain.value = 0.3; const wet = AC.createGain(); wet.gain.value = 0.42;
  arena.connect(lp); lp.connect(real); lp.connect(dl); dl.connect(fb).connect(dl); dl.connect(wet).connect(real);
  RSND.buses = { clean, arena }; RSND.ac = AC; RSND.real = real;
  return RSND.buses;
}
// fire one logged effect through a bus
function rsndFire(name, arg, bus, vol) {
  const B = rsndBuses(); if (!B || !S.sound) return;
  const node = B[bus] || B.clean; node.gain.value = vol;
  const keep = master; master = node; RSND.playing = true;
  try {
    if (name.startsWith('crowd:')) { if (typeof crowdSfx === 'function') crowdSfx(name.slice(6)); }
    else if (sfx[name]) arg == null ? sfx[name]() : sfx[name](name === 'goalSound' ? arg : arg);
  } catch (e) {} finally { master = keep; RSND.playing = false; }
}
// play everything between two playback positions (in recorded frames); a jump backwards plays nothing
// (on the Jumbotron the live crowd does the reacting, and the horn isn't sounded again: playOnly = the play itself)
const RSND_CROWDISH = k => k === 'goalSound' || k === 'cheer' || k === 'boo' || k === 'ooh' || k.startsWith('crowd:');
function rsndAdvance(clip, frames, f0, f1, bus = 'clean', vol = 1, playOnly = bus === 'arena') {
  if (!(f1 > f0) || f1 - f0 > 12) return;
  for (const [f, k, a] of clipSnd(clip, frames)) if (f > f0 && f <= f1 && !(playOnly && RSND_CROWDISH(k))) rsndFire(k, a, bus, vol);
}
// ---- the crowd reacting to a Jumbotron replay, by what it was and whose team it was
function rsndCrowdReact(clip, phase) {
  if (!S.sound || typeof crowdSfx !== 'function' || !S.match || !AC || !master) return;
  const home = S.match.home ?? 0, mine = clip.meta && clip.meta.team === home, k = clip.kind;
  const B = rsndBuses(); if (!B) return;
  const go = kind => { RSND.playing = true; try { crowdSfx(kind); } catch (e) {} finally { RSND.playing = false; } };
  if (phase === 'build') { if (typeof noise === 'function') noise(1.4, 0.03, 600, 'bandpass', 0.7, 0, 0.9); return; }   // a murmur rising to the moment
  if (k === 'goal' || k === 'so') go(mine ? 'roar' : 'groan');
  else if (k === 'save') go(mine ? 'cheer' : 'groan');
  else if (k === 'hit') { go('ooh'); if (mine) setTimeout(() => go('cheer'), 700); }
  else if (k === 'deke') { go('ooh'); if (mine) setTimeout(() => go('cheer'), 650); }
  else if (k === 'pen') go(mine ? 'boo' : 'cheer');
  else if (k === 'fight') go('roar');
}
