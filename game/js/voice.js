'use strict';
// ====================================================================
//  THE ANNOUNCER: short synthesized voice calls for the big moments ("GOOOAL!", "SAVE!", "OHHH!", ...).
//  A tiny formant synthesizer written for this game: a buzzing source shaped by three vowel resonances,
//  plus noise for the consonants. No recordings, no speech engine; every call is generated live.
// ====================================================================
const VOWELS = {             // formant frequencies (Hz) of a male announcer's vowels
  a: [730, 1090, 2440], o: [570, 840, 2410], u: [300, 870, 2240], e: [530, 1840, 2480], i: [270, 2290, 3010],
  ae: [660, 1720, 2410], er: [490, 1350, 1690], l: [360, 1000, 2400], ah: [700, 1220, 2600],
};
// each call: a list of segments. ['v', vowel, seconds, pitchStart, pitchEnd, (nextVowel for a glide)] or ['n', kind, seconds]
const CALLS = {
  goal:     [['n', 'g', 0.05], ['v', 'o', 0.95, 150, 205, 'o'], ['v', 'o', 0.35, 205, 150], ['v', 'l', 0.14, 150, 130]],
  bigGoal:  [['n', 'g', 0.05], ['v', 'o', 1.5, 160, 225, 'o'], ['v', 'o', 0.4, 225, 160], ['v', 'l', 0.16, 160, 135]],
  save:     [['n', 's', 0.13], ['v', 'e', 0.22, 170, 185, 'i'], ['v', 'i', 0.1, 185, 160], ['n', 'v', 0.07]],
  hit:      [['v', 'u', 0.08, 140, 170, 'o'], ['v', 'o', 0.55, 175, 115]],
  breakaway:[['n', 'h', 0.06], ['v', 'ae', 0.12, 160, 170], ['n', 'r', 0.04], ['v', 'i', 0.12, 170, 180], ['n', 's', 0.08], ['n', 'g', 0.04], ['v', 'o', 0.32, 185, 200, 'o'], ['n', 'n', 0.08]],
  fight:    [['v', 'o', 0.2, 150, 165], ['n', 'b', 0.04], ['v', 'o', 0.18, 165, 175, 'i'], ['v', 'i', 0.22, 175, 150]],
  star:     [['n', 's', 0.1], ['n', 't', 0.03], ['v', 'ah', 0.38, 160, 185, 'er'], ['v', 'er', 0.2, 185, 150]],
  hattrick: [['n', 'h', 0.06], ['v', 'ae', 0.16, 165, 175], ['n', 't', 0.03], ['n', 't', 0.03], ['v', 'i', 0.14, 175, 180], ['n', 'k', 0.05]],
  scores:   [['n', 's', 0.1], ['n', 'k', 0.04], ['v', 'o', 0.32, 160, 190, 'er'], ['v', 'er', 0.16, 190, 165], ['n', 'z', 0.12]],
};
let voiceBus = null, lastVoice = 0;
function voiceOn() { return S.sound && !S.demo && !(S.pres && S.pres.voice === false) && typeof AC !== 'undefined' && AC && master; }
// ====================================================================
//  ARENA STINGS (in place of the old synthesized announcer): the sounds a real rink makes at the big moments.
//  An arena organ playing short original riffs, the crowd swelling, a bass thump. All generated live, nothing
//  recorded or borrowed. Same moments as before; the old voice calls are kept below, unused.
// ====================================================================
const stingHz = (name) => { const m = /^([A-G])(#?)(\d)$/.exec(name); const k = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0); return 440 * Math.pow(2, (k - 9) / 12 + (+m[3] - 4)); };
// riffs: [note or chord ('C5+E5'), beats]; 'r' = rest. All written for this game.
const STINGS = {
  goal:      { bpm: 300, riff: [], crowd: 'roar' },       // goals: the horn (or buzzer) and the crowd, no organ
  bigGoal:   { bpm: 280, riff: [], crowd: 'roar' },
  scores:    { bpm: 320, riff: [], crowd: 'roar' },
  save:      { bpm: 340, riff: [['A4+E5', 1], ['C5+G5', 3]], crowd: 'ooh', organ: 0.55 },
  hit:       { bpm: 260, riff: [['E3+B3', 1], ['r', 1], ['E3+B3', 1], ['G3+D4', 3]], crowd: 'ooh', thump: true, organ: 0.6 },
  breakaway: { bpm: 520, riff: [['C4', 1], ['D4', 1], ['E4', 1], ['F#4', 1], ['G4', 1], ['A4', 1], ['B4', 1], ['C5+E5', 4]], crowd: 'swell' },
  fight:     { bpm: 240, riff: [['D3+A3', 1], ['r', 1], ['D3+A3', 1], ['F3+C4', 1], ['r', 1], ['E3+B3', 1], ['D3+A3', 3]], crowd: 'roar' },
  star:      { bpm: 300, riff: [['C5+G5', 1], ['E5+C6', 1], ['G5+E6', 3]], crowd: 'cheer' },
  hattrick:  { bpm: 300, riff: [['G4+D5', 1], ['B4+G5', 1], ['D5+B5', 1], ['G5+D6', 1], ['r', 1], ['G5+D6', 1], ['B5+G6', 4]], crowd: 'roar', whistle: true },
};
function stingBus() {
  if (voiceBus) return voiceBus;
  voiceBus = AC.createGain(); voiceBus.gain.value = 1;
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;      // a big room, a little dull
  const dl = AC.createDelay(0.5), fb = AC.createGain(), wet = AC.createGain(); dl.delayTime.value = 0.13; fb.gain.value = 0.32; wet.gain.value = 0.35;
  voiceBus.connect(lp); lp.connect(master); lp.connect(dl); dl.connect(fb).connect(dl); dl.connect(wet).connect(master);   // arena echo
  return voiceBus;
}
// one organ note: drawbar-style (fundamental, octave, twelfth) with a slow tremolo
function organNote(f, t, dur, vol) {
  const out = AC.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(vol, t + 0.015);
  out.gain.setValueAtTime(vol, t + Math.max(0.02, dur - 0.04)); out.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
  // SOCCER: the terrace band's trumpets in place of the arena organ
  const trem = AC.createOscillator(), tg = AC.createGain(); trem.frequency.value = 5.2; tg.gain.value = f * 0.006; const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 2, t); lp.frequency.linearRampToValueAtTime(f * 5, t + 0.06); lp.Q.value = 2; lp.connect(out);
  for (const det of [-6, 5]) {
    const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.97, t); o.frequency.linearRampToValueAtTime(f, t + 0.05); o.detune.value = det; trem.connect(tg).connect(o.frequency); g.gain.value = 0.42; o.connect(g).connect(lp); o.start(t); o.stop(t + dur + 0.1);
  }
  out.connect(stingBus()); trem.start(t); trem.stop(t + dur + 0.1);
}
// the crowd going "OOOHHH": lots of voices on an 'oo' vowel, each at its own pitch, swelling up and sliding down
// (a sawtooth chorus through the 'oo' formants, plus a little breath)
function crowdOoh(vol = 1, t0) {
  const t = t0 != null ? t0 : AC.currentTime + 0.12, dur = 1.9;
  const out = AC.createGain(); out.gain.value = vol;
  const f1 = AC.createBiquadFilter(), f2 = AC.createBiquadFilter(), mix = AC.createGain();
  f1.type = 'bandpass'; f1.frequency.value = 330; f1.Q.value = 3.5; f2.type = 'bandpass'; f2.frequency.value = 820; f2.Q.value = 5;
  const g2 = AC.createGain(); g2.gain.value = 0.45;
  mix.connect(f1).connect(out); mix.connect(f2).connect(g2).connect(out);
  out.connect(stingBus());
  for (let i = 0; i < 18; i++) {
    const o = AC.createOscillator(), g = AC.createGain(), base = 120 + Math.random() * 170, st = t + Math.random() * 0.12;
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(base * 0.92, st); o.frequency.linearRampToValueAtTime(base * 1.08, st + 0.6); o.frequency.exponentialRampToValueAtTime(base * 0.78, st + dur);
    const a = 0.085 + Math.random() * 0.04;
    g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(a, st + 0.5); g.gain.setValueAtTime(a, st + 0.85); g.gain.exponentialRampToValueAtTime(0.0001, st + dur);
    o.connect(g).connect(mix); o.start(st); o.stop(st + dur + 0.05);
  }
  if (typeof noise === 'function') noise(dur, 0.025 * vol, 500, 'bandpass', 1, 0, 0.3);
}
function voiceCue(kind, vol = 1, force) {
  if (force) { initAudio(); if (!AC || !master || !S.sound) return; } else if (!voiceOn()) return;
  const st = STINGS[kind]; if (!st) return;
  const now = AC.currentTime; if (now - lastVoice < 1.2) return;          // never two at once
  lastVoice = now;
  try {
    // (Nov 22 sound pass) the save and hit stings were the loudest sounds in the game (-19 LUFS, ahead of the goal
    // horn): they're reactions, so they now sit under the horn and the crowd. Bigger moments keep more
    vol *= kind === 'save' || kind === 'hit' ? SND.sting : SND.stingBig;
    const beat = 60 / st.bpm; let t = now + 0.04;
    for (const [n, b] of st.riff) {
      const dur = b * beat;
      if (n !== 'r') for (const nn of n.split('+')) organNote(stingHz(nn), t, dur * 0.92, 0.055 * vol * (st.organ || 1));
      t += dur;
    }
    if (st.thump && typeof tone === 'function') { tone(70, 0.3, 'sine', 0.13 * vol, -20); tone(52, 0.32, 'sine', 0.07 * vol, -10, 0.12); }   // (less sub: it boomed on laptop speakers as a buzz)
    if (st.whistle && typeof tone === 'function') for (let i = 0; i < 3; i++) tone(2100 + i * 140, 0.22, 'sine', 0.025 * vol, 300, 0.25 + i * 0.28);
    if (typeof noise === 'function') {
      const cv = 1.7 * vol;                                                   // the crowd, well up in the mix
      if (st.crowd === 'roar') { noise(2.4, 0.06 * cv, 900, 'bandpass', 0.5, 0.05, 0.25); noise(1.8, 0.03 * cv, 2400, 'bandpass', 0.8, 0.2, 0.2); }
      else if (st.crowd === 'ooh') crowdOoh(1.1 * cv);
      else if (st.crowd === 'swell') { noise(2.0, 0.05 * cv, 700, 'bandpass', 0.6, 0, 1.2); }
      else if (st.crowd === 'cheer') noise(1.6, 0.05 * cv, 1100, 'bandpass', 0.6, 0.05, 0.15);
    }
  } catch (e) {}
}
function voiceVowel(t, [, v, dur, p0, p1, next], vol) {
  const src = AC.createOscillator(); src.type = 'sawtooth';
  src.frequency.setValueAtTime(p0, t); src.frequency.linearRampToValueAtTime(p1, t + dur);
  const vib = AC.createOscillator(), vg = AC.createGain(); vib.frequency.value = 5.5; vg.gain.value = 3; vib.connect(vg).connect(src.frequency);
  const out = AC.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.22 * vol, t + 0.03);
  out.gain.setValueAtTime(0.22 * vol, t + Math.max(0.03, dur - 0.05)); out.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02);
  const F = VOWELS[v], N = next ? VOWELS[next] : F, amp = [1, 0.55, 0.25];
  for (let k = 0; k < 3; k++) {
    const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 8 + k * 3;
    bp.frequency.setValueAtTime(F[k], t); bp.frequency.linearRampToValueAtTime(N[k], t + dur);
    const g = AC.createGain(); g.gain.value = amp[k] * 3.2;
    src.connect(bp).connect(g).connect(out);
  }
  out.connect(voiceBus);
  src.start(t); vib.start(t); src.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
  return t + dur * 0.92;
}
function voiceNoise(t, [, kind, dur], vol) {
  const spec = { s: [5200, 'highpass', 0.09], z: [4200, 'highpass', 0.06], h: [1600, 'bandpass', 0.05], t: [3800, 'bandpass', 0.12], k: [2000, 'bandpass', 0.12],
    g: [700, 'lowpass', 0.14], b: [500, 'lowpass', 0.14], v: [2600, 'bandpass', 0.05], r: [1300, 'bandpass', 0.05], n: [400, 'lowpass', 0.08] }[kind] || [1500, 'bandpass', 0.06];
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; f.type = spec[1]; f.frequency.value = spec[0]; f.Q.value = 1.2;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(spec[2] * vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(voiceBus); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  return t + dur * 0.85;
}
