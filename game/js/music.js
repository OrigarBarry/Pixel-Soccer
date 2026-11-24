'use strict';
// ====================================================================
//  MUSIC + MENU AUDIO + MAIN MENU BACKDROP
//  An original synthesized arcade-rock theme (WebAudio, no samples),
//  menu blips, volume mixing, and the animated arena behind the main menu.
// ====================================================================
const VOL = { master: 0.8, music: 0.7, sfx: 0.9, menuMusic: true, songsOff: [], pump: 1 };
function loadAudioPrefs() { try { const o = JSON.parse(localStorage.getItem('psbk-audio') || '{}'); for (const k in VOL) if (o[k] != null) VOL[k] = o[k]; } catch (e) {} }
function saveAudioPrefs() { try { localStorage.setItem('psbk-audio', JSON.stringify(VOL)); } catch (e) {} }
loadAudioPrefs();
// engine sound effects follow master x sfx (and the old ON/OFF switch)
function applySfxVolume() { if (AC && master) master.gain.setTargetAtTime(S.sound && !S.demo ? 0.9 * VOL.master * VOL.sfx : 0, AC.currentTime, 0.05); }

const Music = {
  gain: null, playing: false, wanted: false, ducked: false, timer: null, step: 0, nextT: 0, started: false, shaper: null,
  BPM: 138,
  ensure() {
    initAudio(); if (!AC) return false;
    if (!this.gain) {
      this.gain = AC.createGain(); this.gain.gain.value = 0.0001;
      const comp = AC.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
      this.gain.connect(comp).connect(AC.destination);
      this.shaper = AC.createWaveShaper(); const n = 1024, curve = new Float32Array(n);
      for (let i = 0; i < n; i++) { const x = i / n * 2 - 1; curve[i] = Math.tanh(x * 6) * 0.8; }
      this.shaper.curve = curve; this.shaper.oversample = '2x';
      this.gtrBus = AC.createBiquadFilter(); this.gtrBus.type = 'lowpass'; this.gtrBus.frequency.value = 2600;
      this.shaper.connect(this.gtrBus).connect(this.gain);
      applySfxVolume();
    }
    return true;
  },
  // (Nov 22 sound pass) per-song trims in dB, measured offline: the songs were 6 dB apart (Neon Nights -31.7 LUFS,
  // Title Challenge -25.7), so the menu shuffle jumped in volume. Everything now sits at about -28; the PUCK TALK
  // studio bed stays soft (-34) under the voices
  TRIM: { title: -2.3, intense: -2.5, rival: -0.4, pump2: -0.7, pump3: -0.5, theme: 0.2, champ: 0, cuprun: 0, otalarm: 0.6, pump1: 0.7, rink: 1.1, cruise: 1.9, career: 2.8, neon: 3.7, studio: 1.5 },
  trim() { return Math.pow(10, ((this.TRIM && this.TRIM[this.song]) || 0) / 20); },
  level() { return this.wanted && !this.ducked && VOL.menuMusic && S.sound && !S.demo ? this.trim() * 0.42 * VOL.master * VOL.music * (this.inGame ? 0.62 : 1) * (this.talk ? 0.55 : 1) * (this.PUMP.includes(this.song) ? (VOL.pump ?? 1) : 1) : (this.wanted && !this.ducked && VOL.menuMusic && S.sound && S.demo ? this.trim() * 0.42 * VOL.master * VOL.music : 0.0001); },
  talkDuck(on) { this.talk = !!on; this.setLevel(); },             // the desk is talking: the studio music sits well under the voices
  setLevel(fast) { if (this.gain && AC) this.gain.gain.setTargetAtTime(this.level(), AC.currentTime, fast ? 0.05 : 0.4); },
  // the menus want music; matches don't
  onScreen(render) {
    this.wanted = true;
    // the Season hub has its own soft broadcast-style music under the PUCK TALK desk
    if (typeof scrHub !== 'undefined' && render === scrHub && this.songOn('studio')) { this.setSong('studio'); if (this.started) this.start(); return; }
    if (this.song === 'studio') this.setSong(this.pick(this.MENU));
    const menu = ['scrMain', 'scrQuickPlay', 'scrQuickPlayAll', 'scrSettings', 'scrHowTo', 'scrLoading', 'scrDebug', 'scrChooseSave', 'scrPostgame'];
    if (!this.MENU.includes(this.song) || !this.songOn(this.song)) this.setSong(this.pick(this.MENU));
    if (!this.started) return;
    this.start();
  },
  // called from the first click / key press (browsers block sound until then)
  unlock() {
    if (!this.ensure()) return;
    if (AC.state === 'suspended') AC.resume().catch(() => {});
    this.started = true;
    if (this.wanted && (S.screen === 'menu' || S.demo)) this.start();
    const hint = document.getElementById('musicHint'); if (hint) hint.remove();
  },
  start() {
    if (!this.ensure()) return;
    if (this.fadeTimer) { clearInterval(this.fadeTimer); clearTimeout(this.fadeTO); this.fadeTimer = null; }
    if (!this.playing) {
      this.playing = true; this.step = 0; this.nextT = AC.currentTime + 0.08;
      this.timer = setInterval(() => this.schedule(), 25);
    }
    this.setLevel();
  },
  stop(fade) {
    this.wanted = false;
    if (!this.playing) return;
    if (fade && this.gain && AC) this.gain.gain.setTargetAtTime(0.0001, AC.currentTime, 0.3); else this.setLevel(true);
    const t = this.timer; this.timer = null; this.playing = false;
    this.fadeTimer = t; this.fadeTO = setTimeout(() => { clearInterval(t); if (this.fadeTimer === t) this.fadeTimer = null; }, fade ? 1500 : 450);
  },
  duck(on) { this.ducked = on; this.setLevel(true); },
  // ---- the arrangement (16th-note grid, 8 bars, loops seamlessly)
  // three original songs: the main theme (main menu, Quick Play), "Front Office" (career-mode menus),
  // and "Sudden Death" (in-game: overtime and tournament games)
  song: 'theme',
  SONGS: {
    theme:  { bpm: 138, len: 128, fn: 'playTheme', name: 'KICKOFF ANTHEM' },
    career: { bpm: 108, len: 128, fn: 'playCareer', name: 'FRONT OFFICE' },
    cruise: { bpm: 124, len: 128, fn: 'playCruise', name: 'OPEN PITCH' },
    neon:   { bpm: 100, len: 128, fn: 'playNeon', name: 'NEON NIGHTS' },
    rink:   { bpm: 132, len: 128, fn: 'playRink', name: 'ORGAN LOFT' },
    intense: { bpm: 172, len: 128, fn: 'playIntense', name: 'SUDDEN DEATH' },
    pump1:  { bpm: 92, len: 64, fn: 'playPump1', name: 'STOMP THE HOARDINGS' },
    pump2:  { bpm: 150, len: 64, fn: 'playPump2', name: 'LET\'S GO!' },
    pump3:  { bpm: 132, len: 128, fn: 'playPump3', name: 'THE BUILD' },
    // handheld-style chip songs (two pulse channels, a wave bass, noise drums), all original melodies
    title:  { bpm: 152, len: 256, fn: 'playChip', chip: 'title', name: 'TITLE CHALLENGE' },
    rival:  { bpm: 158, len: 256, fn: 'playChip', chip: 'rival', name: 'RIVAL ON THE PITCH' },
    cuprun: { bpm: 160, len: 256, fn: 'playChip', chip: 'cuprun', name: 'CUP RUN' },
    champ:  { bpm: 168, len: 256, fn: 'playChip', chip: 'champ', name: 'CHAMPIONSHIP NIGHT' },
    otalarm:{ bpm: 174, len: 128, fn: 'playChip', chip: 'otalarm', name: 'EXTRA TIME!' },
    studio: { bpm: 94, len: 128, fn: 'playStudio', name: 'BALL TALK TONIGHT' },       // the Season hub (the broadcast desk): soft studio music
  },
  MENU: ['title', 'rival', 'cuprun', 'theme', 'cruise', 'career', 'neon', 'rink'],     // menus shuffle these every two minutes (mostly the chip songs)
  MENU_WEIGHT: { title: 3, rival: 3, cuprun: 2, pump3: 2 },   // (pump3, The Build: half of all stoppages)
  PUMP: ['pump1', 'pump2', 'pump3'],                                 // stoppages and intermissions
  songOn(k) { return !(VOL.songsOff || []).includes(k); },
  pick(list) {
    const on = list.filter(k => this.songOn(k) && k !== this.song), pool = on.length ? on : list.filter(k => this.songOn(k));
    if (!pool.length) return null;
    const w = k => (this.MENU_WEIGHT && this.MENU_WEIGHT[k]) || 1, tot = pool.reduce((a, k) => a + w(k), 0); let r = Math.random() * tot;
    for (const k of pool) { r -= w(k); if (r <= 0) return k; }
    return pool[0];
  },
  setSong(k) {
    if (!k || !this.SONGS[k] || k === this.song) return;
    this.song = k; this.songAt = AC ? AC.currentTime : 0; if (this.gain) this.setLevel();
    if (this.playing && AC) { this.step = 0; this.nextT = AC.currentTime + 0.06; }
  },
  schedule() {
    if (!AC || !this.playing) return;
    if (!this.songOn(this.song) && !this.inGame) { const k = this.pick(this.MENU); if (k) this.setSong(k); else return this.stop(); }
    const sg = this.SONGS[this.song] || this.SONGS.theme, spb = 60 / sg.bpm / 4;
    // menus: a new song every two minutes (at the end of a phrase)
    if (!this.inGame && this.MENU.includes(this.song) && AC.currentTime - (this.songAt || 0) > 120 && this.step % 64 === 0 && this.step > 0) { const k = this.pick(this.MENU); if (k) this.setSong(k); }
    while (this.nextT < AC.currentTime + 0.14) { const g2 = this.SONGS[this.song]; this[g2.fn](this.step % g2.len, this.nextT, 60 / g2.bpm / 4); this.nextT += 60 / g2.bpm / 4; this.step++; }
  },
  // in-game: the intense song plays through overtime and through tournament / playoff games
  matchTick() {
    const inGame = S.match && !S.demo && !S.match.replay && ['play', 'paused', 'intermission', 'celebrate', 'intro'].includes(S.screen);
    if (!inGame) { if (this.inGame) { this.inGame = false; this.setLevel(); } return; }
    if (!this.inGame) { this.inGame = true; this.setLevel(); }
    // music only plays while play is dead (stoppages, goals, the faceoff before the drop, intermissions).
    // Which song: overtime / shootout, a final, a semifinal, any other tournament or big game; otherwise the pump-ups
    const tn = S.match.tourney, sd = S.period >= 4 || S.so;
    const want = sd ? 'otalarm' : tn && tn.tier >= 2 ? 'champ' : tn && tn.tier === 1 ? 'rival' : tn || S.match.bigGame ? 'cuprun' : null;
    const special = want && this.songOn(want) ? want : null;
    const stop = S.screen === 'intermission' || (S.screen === 'play' && (S.phase === 'whistle' || S.phase === 'goal' || (S.phase === 'faceoff' && !(S.fo && S.fo.dropped))));
    if (stop && this.started && !S.match.test && (special || this.PUMP.some(k => this.songOn(k)))) {
      if (special) { if (!this.playing || this.song !== special || !this.wanted) { this.wanted = true; this.setSong(special); this.start(); } }
      else if (!this.playing || !this.PUMP.includes(this.song) || !this.wanted) { this.wanted = true; const k = this.pick(this.PUMP); if (k) { this.setSong(k); this.step = 0; this.start(); } }
    } else if (this.playing) this.stop(S.screen !== 'play');     // play resuming (the puck drop) cuts it dead
  },
  // "Puck Talk Tonight": the studio bed under the broadcast desk. Soft electric piano on major-seventh chords, a
  // bell arpeggio, brushed hats and a rim click, a round bass. Original.
  playStudio(s, t, spb) {
    const bar = Math.floor(s / 16), st = s % 16;
    const roots = [38, 35, 43, 45, 38, 42, 43, 45], ty = 'MmMDMmMD'[bar], iv = ty === 'M' ? [0, 4, 7, 11] : ty === 'm' ? [0, 3, 7, 10] : [0, 4, 7, 10];
    const ch = iv.map(i => roots[bar] + 24 + i);
    if (st === 0) this.keys(t, ch, spb * 15, 0.013);
    if (st === 6 || st === 14) this.keys(t, ch.slice(1).map(n => n + 12), spb * 2, 0.006);
    if (st === 0 || st === 10) this.bass(t, roots[bar], spb * (st ? 5 : 9));
    if (st % 4 === 2) this.hat(t, 0.011);
    if (st === 4 || st === 12) this.snare(t, 0.14);
    if (st % 2 === 0) this.lead(t, ch[[0, 2, 1, 3, 2, 1, 3, 2][st / 2]] + 12, spb * 1.6, 0.007);
    if (bar >= 4) {
      const mel = { 4: [[0, 78, 4], [6, 76, 2], [8, 73, 6]], 5: [[0, 74, 3], [4, 76, 3], [8, 78, 8]], 6: [[0, 79, 4], [4, 78, 2], [6, 76, 2], [8, 74, 8]], 7: [[0, 76, 6], [8, 73, 8]] }[bar] || [];
      for (const [pos, note, len] of mel) if (pos === st) this.lead(t, note, spb * len, 0.016);
    }
  },
  playCareer(s, t, spb) {
    const bar = Math.floor(s / 16), st = s % 16;
    const roots = [43, 40, 36, 38, 43, 40, 36, 38], r = roots[bar], minor = bar % 4 === 1;
    const triad = [0, minor ? 3 : 4, 7].map(i => r + 24 + i);
    // laid-back drums with a little swing on the hats
    if (st === 0 || st === 10 || (st === 7 && bar % 2)) this.kick(t);
    if (st === 4 || st === 12) this.snare(t, 0.55);
    if (st % 2 === 0) this.hat(t + (st % 4 === 2 ? spb * 0.18 : 0), st % 4 === 2 ? 0.035 : 0.022);
    if (st === 0 && bar === 0) this.crash(t);
    // walking groove bass
    const bl = { 0: [0, 3], 3: [12, 1], 6: [0, 2], 8: [0, 2], 11: [7, 1], 14: [12, 2] }[st];
    if (bl) this.bass(t, r + bl[0], spb * bl[1]);
    // electric-piano chords: a soft pad on the one, off-beat stabs
    if (st === 0) this.keys(t, triad, spb * 14, 0.018);
    if (st === 2 || st === 6 || st === 10 || st === 14) this.keys(t, triad.map(n => n + 12), spb * 1.2, 0.022);
    if (bar >= 4) {
      const mel = {
        4: [[0, 79, 3], [3, 78, 1], [4, 76, 4], [10, 74, 2], [12, 71, 4]],
        5: [[0, 76, 2], [2, 79, 2], [4, 83, 6], [12, 81, 4]],
        6: [[0, 79, 2], [2, 76, 2], [4, 72, 4], [8, 74, 2], [10, 76, 2], [12, 79, 4]],
        7: [[0, 81, 4], [4, 78, 4], [8, 79, 8]],
      }[bar] || [];
      for (const [pos, note, len] of mel) if (pos === st) this.lead(t, note, spb * len, 0.03);
    } else if (bar === 3 && st >= 10 && st % 2 === 0) this.lead(t, [74, 76, 78][(st - 10) / 2], spb * 1.5, 0.02);
  },
  // "Open Ice": bright, major-key rock for the menus
  playCruise(s, t, spb) {
    const bar = Math.floor(s / 16), st = s % 16;
    const roots = [40, 45, 47, 45, 40, 44, 45, 47], r = roots[bar];
    const triad = [0, bar === 5 ? 3 : 4, 7].map(i => r + 24 + i);
    if (st === 0 || st === 8 || (st === 10 && bar % 2)) this.kick(t);
    if (st === 4 || st === 12) this.snare(t, 0.6);
    this.hat(t, st % 2 ? 0.018 : 0.03);
    if (st === 0 && bar % 4 === 0) this.crash(t);
    if (st % 2 === 0) this.bass(t, r + (st === 6 || st === 14 ? 7 : 0), spb * 1.6);
    if (st === 0 || st === 8) this.power(t, r + 12, spb * 6, 0.03);
    if (st === 0) this.keys(t, triad, spb * 16, 0.014);
    const mel = {
      0: [[0, 76, 4], [4, 79, 2], [6, 80, 2], [8, 83, 6]],
      1: [[0, 81, 4], [4, 80, 2], [6, 78, 2], [8, 76, 8]],
      2: [[0, 78, 2], [2, 80, 2], [4, 83, 4], [8, 85, 4], [12, 83, 4]],
      3: [[0, 81, 6], [8, 78, 4], [12, 76, 4]],
      4: [[0, 76, 2], [2, 79, 2], [4, 83, 2], [6, 88, 6], [12, 86, 4]],
      5: [[0, 84, 4], [4, 83, 4], [8, 81, 8]],
      6: [[0, 81, 2], [2, 83, 2], [4, 85, 4], [8, 83, 2], [10, 81, 2], [12, 80, 4]],
      7: [[0, 78, 4], [4, 80, 4], [8, 83, 8]],
    }[bar] || [];
    for (const [pos, note, len] of mel) if (pos === st) this.lead(t, note, spb * len, 0.03);
  },
  // "Neon Nights": slow synth-wave with an arpeggio and a big pad
  playNeon(s, t, spb) {
    const bar = Math.floor(s / 16), st = s % 16;
    const roots = [45, 41, 36, 43, 45, 41, 38, 40], r = roots[bar], minor = bar % 4 !== 2 && bar !== 3;
    const ch = [0, minor ? 3 : 4, 7, 12].map(i => r + 24 + i);
    if (st === 0 || st === 8) this.kick(t);
    if (st === 4 || st === 12) this.snare(t, 0.45);
    if (st % 2 === 1) this.hat(t, 0.016);
    if (st === 0) { this.keys(t, ch.slice(0, 3), spb * 16, 0.02); if (bar % 4 === 0) this.crash(t); }
    if (st % 2 === 0) this.bass(t, r + (st % 4 === 2 ? 12 : 0), spb * 1.8);
    this.lead(t, ch[[0, 1, 2, 3, 2, 1][st % 6]] + 12, spb * 0.9, 0.012);
    if (bar >= 4) {
      const mel = { 4: [[0, 81, 6], [8, 84, 4], [12, 83, 4]], 5: [[0, 81, 8], [8, 77, 8]], 6: [[0, 74, 4], [4, 76, 4], [8, 79, 8]], 7: [[0, 76, 12]] }[bar] || [];
      for (const [pos, note, len] of mel) if (pos === st) this.lead(t, note, spb * len, 0.03);
    }
  },
  // "Organ Loft": the arena organist noodling between whistles, with a backbeat
  playRink(s, t, spb) {
    const bar = Math.floor(s / 16), st = s % 16;
    const roots = [36, 41, 43, 36, 36, 41, 43, 43], r = roots[bar];
    if (st === 0 || st === 6 || st === 8) this.kick(t);
    if (st === 4 || st === 12) this.snare(t, 0.5);
    if (st % 2 === 0) this.hat(t, 0.02);
    if (st % 4 === 0) this.bass(t, r + (st === 8 ? 7 : 0), spb * 3);
    if (st === 2 || st === 6 || st === 10 || st === 14) this.keys(t, [r + 24, r + 28, r + 31], spb * 1.4, 0.02);
    const run = [0, 4, 7, 12, 16, 12, 7, 4];
    if (bar % 2 === 0) { if (st % 2 === 0) this.lead(t, r + 36 + run[(st / 2) | 0], spb * 1.8, 0.026); }
    else { const mel = [[0, 12, 4], [4, 11, 2], [6, 9, 2], [8, 7, 4], [12, 4, 4]]; for (const [pos, n, len] of mel) if (pos === st) this.lead(t, r + 36 + n, spb * len, 0.03); }
  },
  // pump-up 1, "Stomp the Boards": heavy half-time stomps, claps and a gritty riff
  playPump1(s, t, spb) {
    const bar = Math.floor(s / 16), st = s % 16;
    const r = [38, 38, 41, 36][bar];
    if (st === 0 || st === 3 || st === 8 || st === 11) this.kick(t);
    if (st === 4 || st === 12) { this.snare(t, 0.9); this.snare(t + spb * 0.12, 0.4); }
    if (st === 0 && bar === 0) this.crash(t);
    const riff = { 0: [0, 3], 3: [0, 1], 6: [3, 2], 8: [5, 3], 12: [3, 2], 14: [0, 2] }[st];
    if (riff) { this.power(t, r + 12 + riff[0], spb * riff[1], 0.05); this.bass(t, r + riff[0], spb * riff[1]); }
  },
  // pump-up 2, "Let's Go!": a rising organ arpeggio over double-time drums and claps
  playPump2(s, t, spb) {
    const bar = Math.floor(s / 16), st = s % 16;
    const r = [43, 45, 47, 48][bar];
    if (st % 4 === 0) this.kick(t);
    if (st === 4 || st === 12 || (bar === 3 && st >= 8 && st % 2 === 0)) this.snare(t, 0.6);
    this.hat(t, st % 2 ? 0.02 : 0.04);
    if (st === 0) { this.crash(t); this.keys(t, [r + 24, r + 28, r + 31], spb * 8, 0.02); }
    if (st % 2 === 0) this.bass(t, r + (st % 8 === 4 ? 7 : 0), spb * 1.5);
    const arp = [0, 4, 7, 12, 7, 12, 16, 19];
    if (st < 8) this.lead(t, r + 24 + arp[st], spb * 0.9, 0.04);
    else if (st === 8) this.lead(t, r + 36 + 4, spb * 4, 0.05);
    else if (st === 12) this.lead(t, r + 36 + 7, spb * 4, 0.05);
  },
  // pump-up 3, "The Build": the arena organist hammers one note, then climbs a half step at a time, faster and
  // louder, until the whole building is on its feet: a big chord, the crowd clapping along, and round again.
  // An original line (repeated notes rising chromatically, a closing fanfare of its own)
  playPump3(s, t, spb) {
    const bar = Math.floor(s / 16), st = s % 16, v = 0.024 + bar * 0.006;
    const hit = (m, len = 0.7) => { this.organ(t, [m, m + 12], spb * len, v); };
    if (bar === 0 && st % 2 === 0) hit(55);                                   // dun dun dun dun...
    else if (bar === 1 && st % 2 === 0) hit(56);
    else if (bar === 2 && st % 2 === 0) hit(st < 8 ? 57 : 58);                // climbing
    else if (bar === 3 && st % 2 === 0) hit(st < 8 ? 59 : 60);
    else if (bar === 4) hit(61 + (st >> 2), 0.8);                             // every sixteenth now, up each beat
    else if (bar === 5) hit(65 + (st >> 2), 0.8);
    else if (bar === 6) {                                                      // the big chord, held, then stabs
      if (st === 0) { this.organ(t, [69, 73, 76, 81], spb * 6, v * 0.9); if (this.inGame && typeof excite === 'function') { excite(0.35); if (S.cheer < 90) { S.cheer = 90; S.cheerKind = 'all'; } } }   // the building rises with it
      if (st === 8 || st === 10 || st === 12) this.organ(t, [69, 73, 76, 81], spb * 1, v);
      if (st === 14) this.organ(t, [71, 74, 78, 83], spb * 2, v);
    } else if (bar === 7) {                                                    // the fanfare (its own), then the crowd claps
      const fan = { 0: [[74, 78, 81], 2], 2: [[76, 79, 83], 2], 4: [[78, 81, 86], 6] }[st];
      if (fan) this.organ(t, fan[0], spb * fan[1], v * 0.95);
      if (st === 12 || st === 14) this.clap(t);
    }
    // drums join in as it builds
    if (bar >= 2 && bar <= 5 && st % 4 === 0) this.kick(t);
    if (bar >= 4 && bar <= 5 && (st === 4 || st === 12)) this.snare(t, 0.5);
    if (bar === 5 && st >= 8) this.snare(t, 0.25 + (st - 8) * 0.08);          // a snare roll into the chord
    if ((bar === 6 || bar === 7) && st === 0) { this.crash(t); this.kick(t); }
    if (bar === 6 && (st === 8 || st === 10 || st === 12 || st === 14)) this.kick(t);
    if (bar >= 1 && bar <= 3 && st % 4 === 2) this.clap(t, 0.5);
  },
  // a pipe/theatre organ: drawbars (fundamental, octave, twelfth, a little bite) with a fast tremolo
  organ(t, notes, d, v) {
    for (const m of notes) {
      const f = this.hz(m), out = AC.createGain();
      out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(v, t + 0.012); out.gain.setValueAtTime(v, t + Math.max(0.02, d - 0.03)); out.gain.linearRampToValueAtTime(0.0001, t + d + 0.04);
      // SOCCER: the terrace BAND, not an organ: a pair of slightly detuned trumpets (saw through a brassy filter, a little scoop up into the note)
      const trem = AC.createOscillator(), tg = AC.createGain(); trem.frequency.value = 5.2; tg.gain.value = f * 0.006; const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 2, t); lp.frequency.linearRampToValueAtTime(f * 5, t + 0.06); lp.Q.value = 2; lp.connect(out);
      for (const det of [-6, 5]) {
        const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.97, t); o.frequency.linearRampToValueAtTime(f, t + 0.05); o.detune.value = det; trem.connect(tg).connect(o.frequency); g.gain.value = 0.42; o.connect(g).connect(lp); o.start(t); o.stop(t + d + 0.08);
      }
      out.connect(this.gain); trem.start(t); trem.stop(t + d + 0.08);
    }
  },
  clap(t, v = 1) {                                                             // the crowd clapping along: a burst of noise, slightly smeared
    for (let i = 0; i < 3; i++) { const s0 = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); s0.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.9;
      const tt = t + i * 0.012; g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.09 * v, tt + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.09); s0.connect(f).connect(g).connect(this.gain); s0.start(tt); s0.stop(tt + 0.12); }
  },
  playIntense(s, t, spb) {
    const bar = Math.floor(s / 16), st = s % 16;
    // D minor, driving: D D Bb C | D D F E
    const roots = [38, 38, 34, 36, 38, 38, 41, 40], r = roots[bar], B = bar >= 4;
    if (st % 4 === 0 || st === 14 || (st === 7 && bar % 2)) this.kick(t);
    if (st === 4 || st === 12) this.snare(t);
    if ((bar === 3 || bar === 7) && st >= 8) this.snare(t, 0.35 + (st - 8) * 0.06);   // snare-roll builds
    this.hat(t, st % 2 ? 0.02 : 0.045);
    if (st === 0 && bar % 2 === 0) this.crash(t);
    // galloping bass and guitar
    const gal = st % 4 !== 1;
    if (gal) this.bass(t, r + (st % 8 === 6 ? 12 : 0), spb * 0.9);
    if (gal && st !== 0 && st !== 8) this.power(t, r + 12, spb * 0.8, 0.028);
    if (st === 0 || st === 8) this.power(t, r + 12, spb * 3.5, 0.055);
    if (B) {
      const hook = {
        4: [[0, 74, 2], [2, 77, 2], [4, 81, 2], [6, 77, 2], [8, 74, 2], [10, 77, 2], [12, 81, 4]],
        5: [[0, 70, 2], [2, 74, 2], [4, 77, 2], [6, 74, 2], [8, 72, 2], [10, 76, 2], [12, 79, 4]],
        6: [[0, 74, 2], [2, 77, 2], [4, 81, 2], [6, 86, 4], [10, 84, 2], [12, 81, 4]],
        7: [[0, 84, 3], [3, 81, 3], [6, 79, 2], [8, 77, 2], [10, 76, 2], [12, 73, 4]],
      }[bar] || [];
      for (const [pos, note, len] of hook) if (pos === st) this.lead(t, note, spb * len, 0.05);
    } else if ((bar === 1 || bar === 3) && (st === 0 || st === 6 || st === 12)) this.lead(t, [86, 84, 81][st / 6], spb * 3, 0.04);   // alarm stabs
  },
  // ---------------- CHIP SONGS -------------------------------------------------------------------------------
  // a handheld sound: pulse 1 (lead, 25% duty), pulse 2 (harmony / arpeggios, 12.5%), a wave-channel bass and
  // noise drums. Each song: chords per bar, a bass figure, a drum pattern, the lead phrases and the arpeggio voice.
  pulseWave(duty) {
    this._pw = this._pw || {};
    if (!this._pw[duty]) { const n = 48, re = new Float32Array(n), im = new Float32Array(n); for (let k = 1; k < n; k++) im[k] = 2 / (k * Math.PI) * Math.sin(k * Math.PI * duty) * 2; this._pw[duty] = AC.createPeriodicWave(re, im); }
    return this._pw[duty];
  },
  pulse(t, m, d, v, duty = 0.25, vib = true) {
    const o = AC.createOscillator(), g = AC.createGain();
    o.setPeriodicWave(this.pulseWave(duty)); o.frequency.value = this.hz(m);
    if (vib && d > 0.22) { const l = AC.createOscillator(), lg = AC.createGain(); l.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(this.hz(m) * 0.012, t + d * 0.6); l.connect(lg).connect(o.frequency); l.start(t + 0.12); l.stop(t + d + 0.03); }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.006); g.gain.setValueAtTime(v, t + d * 0.55); g.gain.exponentialRampToValueAtTime(v * 0.55, t + d * 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(this.gain); o.start(t); o.stop(t + d + 0.02);
  },
  wavBass(t, m, d, v = 0.2) {
    if (!this._wb) { const n = 8, re = new Float32Array(n), im = new Float32Array(n); im[1] = 1; im[2] = 0.35; im[3] = 0.22; im[4] = 0.08; this._wb = AC.createPeriodicWave(re, im); }
    const o = AC.createOscillator(), g = AC.createGain(); o.setPeriodicWave(this._wb); o.frequency.value = this.hz(m);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.setValueAtTime(v, t + d * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(this.gain); o.start(t); o.stop(t + d + 0.02);
  },
  noise(t, kind, v = 1) {
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = noiseBuf;
    const P = { k: ['lowpass', 260, 0.09, 0.55], s: ['bandpass', 2600, 0.11, 0.32], h: ['highpass', 8500, 0.025, 0.07], o: ['highpass', 6500, 0.09, 0.06] }[kind];
    f.type = P[0]; f.frequency.value = P[1]; this.env(g, t, 0.001, P[2], P[3] * v); s.connect(f).connect(g).connect(this.gain); s.start(t, Math.random()); s.stop(t + P[2] + 0.03);
    if (kind === 'k') { const o = AC.createOscillator(), g2 = AC.createGain(); o.type = 'square'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.07); this.env(g2, t, 0.001, 0.08, 0.16 * v); o.connect(g2).connect(this.gain); o.start(t); o.stop(t + 0.1); }
  },
  CHIP: {
    // ---- TITLE CHALLENGE (main menu): A minor with lifts to C major, a bright, adventurous lead
    title: {
      chords: ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'F', 'E', 'C', 'C', 'G', 'G', 'F', 'G', 'Am', 'E'],
      bass: [0, 0, 12, 0, 7, 0, 12, 0, 0, 0, 12, 0, 10, 0, 7, 0], drums: 'k.h.s.h.k.hks.hh',
      lead: {
        0: [[0, 69, 1], [2, 72, 1], [4, 76, 1], [6, 81, 1], [8, 79, 2], [10, 76, 2], [12, 72, 4]],
        1: [[0, 69, 1], [2, 72, 1], [4, 76, 1], [6, 81, 1], [8, 83, 2], [10, 84, 2], [12, 83, 4]],
        2: [[0, 77, 6], [8, 81, 6]], 3: [[0, 83, 4], [4, 81, 4], [8, 79, 8]],
        4: [[0, 76, 3], [3, 77, 1], [4, 76, 2], [6, 72, 2], [8, 69, 4], [12, 72, 2], [14, 74, 2]],
        5: [[0, 76, 6], [6, 79, 2], [8, 77, 2], [10, 76, 2], [12, 74, 4]],
        6: [[0, 72, 3], [3, 74, 1], [4, 77, 4], [8, 81, 4], [12, 79, 2], [14, 77, 2]],
        7: [[0, 76, 8], [8, 80, 4], [12, 83, 4]],
        8: [[0, 84, 6], [6, 83, 2], [8, 79, 4], [12, 76, 4]],
        9: [[0, 77, 2], [2, 79, 2], [4, 84, 4], [8, 88, 4], [12, 86, 4]],
        10: [[0, 83, 6], [6, 81, 2], [8, 79, 2], [10, 81, 2], [12, 83, 4]],
        11: [[0, 86, 8], [8, 83, 4], [12, 79, 4]],
        12: [[0, 81, 4], [4, 77, 2], [6, 81, 2], [8, 84, 4], [12, 81, 4]],
        13: [[0, 83, 4], [4, 79, 2], [6, 83, 2], [8, 86, 4], [12, 83, 4]],
        14: [[0, 81, 2], [2, 83, 2], [4, 84, 2], [6, 86, 2], [8, 88, 8]],
        15: [[0, 83, 4], [4, 80, 4], [8, 76, 4], [12, 71, 4]],
      }, arpFrom: 4,
    },
    // ---- RIVAL ON THE ICE (menus, semifinals): E minor, darker and sharper, a 3-3-2 syncopated bass
    rival: {
      chords: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'B', 'Em', 'C', 'D', 'B', 'Em', 'C', 'Am', 'B'],
      bass: [0, null, null, 0, null, null, 12, null, 0, null, null, 7, null, null, 10, null], drums: 'k..s..k.k.s..khs', bassLen: 2.6,
      lead: {
        0: [[0, 76, 2], [3, 79, 1], [4, 78, 2], [6, 76, 2], [8, 71, 6], [14, 74, 2]],
        1: [[0, 76, 3], [3, 78, 3], [6, 79, 2], [8, 81, 4], [12, 79, 2], [14, 78, 2]],
        2: [[0, 76, 2], [2, 72, 2], [4, 76, 2], [6, 79, 4], [10, 76, 2], [12, 84, 4]],
        3: [[0, 83, 3], [3, 81, 3], [6, 78, 2], [8, 74, 4], [12, 78, 4]],
        4: [[0, 79, 2], [2, 78, 2], [4, 76, 2], [6, 71, 2], [8, 76, 2], [10, 79, 2], [12, 83, 4]],
        5: [[0, 82, 2], [2, 83, 2], [4, 86, 6], [10, 83, 2], [12, 79, 4]],
        6: [[0, 84, 4], [4, 83, 2], [6, 79, 2], [8, 76, 4], [12, 72, 4]],
        7: [[0, 75, 4], [4, 78, 4], [8, 81, 4], [12, 83, 4]],
        8: [[0, 88, 6], [6, 86, 2], [8, 83, 4], [12, 79, 4]],
        9: [[0, 84, 4], [4, 83, 2], [6, 84, 2], [8, 88, 8]],
        10: [[0, 86, 4], [4, 81, 2], [6, 86, 2], [8, 90, 6], [14, 88, 2]],
        11: [[0, 87, 8], [8, 83, 4], [12, 78, 4]],
        12: [[0, 79, 2], [2, 83, 2], [4, 88, 4], [8, 86, 2], [10, 83, 2], [12, 79, 4]],
        13: [[0, 84, 2], [2, 88, 2], [4, 91, 4], [8, 88, 4], [12, 84, 4]],
        14: [[0, 81, 4], [4, 84, 4], [8, 88, 4], [12, 86, 2], [14, 84, 2]],
        15: [[0, 83, 4], [4, 87, 4], [8, 90, 4], [12, 95, 4]],
      }, arpFrom: 0, stab: true,
    },
    // ---- CUP RUN (tournament games): D minor, urgent and syncopated, pushes on the off-beats
    cuprun: {
      chords: ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A', 'Dm', 'Dm', 'Bb', 'C', 'Bb', 'C', 'Gm', 'A'],
      bass: [0, 12, 0, 12, 0, 12, 10, 12, 0, 12, 0, 12, 7, 12, 10, 12], drums: 'k.hsk.hsk.hsk.ss', bassLen: 0.9,
      lead: {
        0: [[0, 74, 1], [2, 74, 1], [3, 77, 2], [6, 74, 1], [8, 81, 3], [11, 79, 3], [14, 77, 2]],
        1: [[0, 76, 3], [3, 77, 3], [6, 79, 2], [8, 81, 6], [14, 79, 2]],
        2: [[0, 77, 1], [2, 77, 1], [3, 82, 2], [6, 81, 2], [8, 77, 3], [11, 74, 3], [14, 77, 2]],
        3: [[0, 79, 6], [6, 76, 2], [8, 72, 4], [12, 76, 4]],
        4: [[0, 74, 1], [2, 74, 1], [3, 77, 2], [6, 74, 1], [8, 86, 3], [11, 84, 3], [14, 81, 2]],
        5: [[0, 82, 3], [3, 81, 3], [6, 79, 2], [8, 77, 6], [14, 76, 2]],
        6: [[0, 79, 3], [3, 82, 3], [6, 86, 2], [8, 84, 4], [12, 82, 4]],
        7: [[0, 81, 4], [4, 85, 4], [8, 88, 4], [12, 85, 4]],
        8: [[0, 86, 1], [2, 86, 1], [3, 89, 2], [6, 86, 1], [8, 93, 3], [11, 91, 3], [14, 89, 2]],
        9: [[0, 88, 3], [3, 89, 3], [6, 91, 2], [8, 93, 6], [14, 91, 2]],
        10: [[0, 89, 1], [2, 89, 1], [3, 94, 2], [6, 93, 2], [8, 89, 3], [11, 86, 3], [14, 89, 2]],
        11: [[0, 91, 6], [6, 88, 2], [8, 84, 4], [12, 88, 4]],
        12: [[0, 86, 4], [4, 89, 4], [8, 86, 2], [10, 84, 2], [12, 82, 4]],
        13: [[0, 84, 4], [4, 86, 2], [6, 84, 2], [8, 81, 8]],
        14: [[0, 82, 2], [2, 84, 2], [4, 86, 4], [8, 91, 4], [12, 89, 4]],
        15: [[0, 88, 8], [8, 85, 4], [12, 81, 4]],
      }, arpFrom: 0, harm: [8, 9, 10, 11],
    },
    // ---- CHAMPIONSHIP NIGHT (finals): relentless 16th-note bass, a triumphant, soaring lead
    champ: {
      chords: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'D', 'G', 'G', 'C', 'C', 'Am', 'B', 'Em', 'Em'],
      bass: [0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 7, 12], drums: 'k.hhs.hhk.hhs.hs', bassLen: 0.9,
      lead: {
        0: [[0, 83, 4], [4, 81, 2], [6, 83, 2], [8, 86, 4], [12, 83, 4]],
        1: [[0, 79, 2], [2, 81, 2], [4, 83, 4], [8, 76, 8]],
        2: [[0, 84, 4], [4, 83, 2], [6, 84, 2], [8, 88, 4], [12, 84, 4]],
        3: [[0, 86, 6], [6, 84, 2], [8, 83, 4], [12, 81, 4]],
        4: [[0, 83, 4], [4, 86, 2], [6, 88, 2], [8, 91, 6], [14, 90, 2]],
        5: [[0, 88, 4], [4, 86, 4], [8, 83, 4], [12, 79, 4]],
        6: [[0, 81, 2], [2, 83, 2], [4, 84, 4], [8, 88, 2], [10, 86, 2], [12, 84, 4]],
        7: [[0, 86, 4], [4, 90, 4], [8, 93, 8]],
        8: [[0, 91, 6], [6, 90, 2], [8, 86, 4], [12, 83, 4]],
        9: [[0, 86, 4], [4, 88, 2], [6, 86, 2], [8, 83, 8]],
        10: [[0, 88, 6], [6, 86, 2], [8, 84, 4], [12, 88, 4]],
        11: [[0, 91, 4], [4, 88, 4], [8, 84, 4], [12, 79, 4]],
        12: [[0, 81, 2], [2, 84, 2], [4, 88, 4], [8, 86, 4], [12, 84, 4]],
        13: [[0, 87, 4], [4, 90, 4], [8, 93, 4], [12, 90, 4]],
        14: [[0, 88, 12], [12, 86, 2], [14, 87, 2]],
        15: [[0, 88, 8], [8, 83, 4], [12, 79, 4]],
      }, arpFrom: 0, harm: [4, 5, 8, 9, 12, 13, 14], crashEvery: 4,
    },
    // ---- OVERTIME! (overtime and shootouts): a pulsing alarm, then a frantic C minor drive
    otalarm: {
      chords: ['Cm', 'Cm', 'Cm', 'Cm', 'Ab', 'Bb', 'Cm', 'G'],
      bass: [0, 0, 12, 0, 0, 12, 0, 12, 0, 0, 12, 0, 10, 12, 7, 12], drums: 'kshskshskshskshs', bassLen: 0.85,
      alarm: [0, 1],
      lead: {
        2: [[0, 79, 2], [2, 80, 2], [4, 79, 2], [6, 75, 2], [8, 72, 4], [12, 75, 4]],
        3: [[0, 77, 4], [4, 79, 4], [8, 82, 6], [14, 80, 2]],
        4: [[0, 79, 3], [3, 84, 3], [6, 82, 2], [8, 79, 4], [12, 75, 4]],
        5: [[0, 77, 2], [2, 79, 2], [4, 80, 4], [8, 84, 4], [12, 87, 4]],
        6: [[0, 86, 4], [4, 84, 2], [6, 82, 2], [8, 80, 4], [12, 79, 4]],
        7: [[0, 79, 4], [4, 83, 4], [8, 86, 4], [12, 89, 4]],
      }, arpFrom: 2,
    },
  },
  chord(name) {
    const R = { C: 48, D: 50, E: 52, F: 53, G: 55, A: 45, B: 47, Ab: 44, Bb: 46 }, m = /^([A-G]b?)(m?)$/.exec(name);
    const r = R[m[1]], minor = m[2] === 'm';
    return { r, tri: [0, minor ? 3 : 4, 7].map(i => r + 12 + i) };
  },
  playChip(s, t, spb) {
    const sg = this.SONGS[this.song], C = this.CHIP[sg.chip], nb = C.chords.length, bar = Math.floor(s / 16) % nb, st = s % 16;
    const ch = this.chord(C.chords[bar]);
    // noise drums
    const dk = C.drums[st]; if (dk && dk !== '.') this.noise(t, dk, st === 0 ? 1.15 : 1);
    if (st === 0 && (C.crashEvery ? bar % C.crashEvery === 0 : bar % 8 === 0)) this.noise(t, 'o', 1.4);
    if (bar % 4 === 3 && st >= 12) this.noise(t, 's', 0.6 + (st - 12) * 0.15);                         // a fill into each phrase
    // wave bass
    const b = C.bass[st]; if (b != null) this.wavBass(t, ch.r - 12 + b, spb * (C.bassLen || 1.7), 0.21);
    // the alarm intro (overtime): octave pulses that climb a semitone every beat
    if (C.alarm && C.alarm.includes(bar)) { const up = Math.floor(st / 4) + (bar - C.alarm[0]) * 4; this.pulse(t, (st % 2 ? 72 : 84) + up, spb * 0.9, 0.05, 0.5, false); return; }
    // pulse 2: a fast arpeggio of the chord (or a harmony a third under the lead in the marked bars)
    const lead = (C.lead[bar] || []), harm = C.harm && C.harm.includes(bar);
    if (bar >= (C.arpFrom || 0)) {
      if (harm) { for (const [pos, note, len] of lead) if (pos === st) this.pulse(t, note - (C.chords[bar].endsWith('m') ? 3 : 4), spb * len, 0.022, 0.125); }
      else this.pulse(t, ch.tri[st % 3] + 12 + (st % 6 >= 3 ? 12 : 0), spb * 0.85, 0.016, 0.125, false);
    }
    if (C.stab && (st === 0 || st === 6 || st === 12) && bar < 8) this.pulse(t, ch.tri[2] + 12, spb * 1.2, 0.02, 0.125, false);
    // pulse 1: the lead
    for (const [pos, note, len] of lead) if (pos === st) this.pulse(t, note, spb * len * 0.96, 0.05, 0.25);
  },
  keys(t, notes, d, v) {
    for (const m of notes) { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'triangle'; o.frequency.value = this.hz(m); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(this.gain); o.start(t); o.stop(t + d + 0.03); }
  },
  playTheme(s, t, spb) {
    const bar = Math.floor(s / 16), st = s % 16;
    // progression in E minor: E5 C5 G5 D5 | E5 C5 G5 B5  (root MIDI notes)
    const roots = [40, 36, 43, 38, 40, 36, 43, 47], r = roots[bar];
    const B = bar >= 4;                                                  // second half adds the lead hook
    // drums
    if (st % 8 === 0 || (st === 10 && bar % 2) || (st === 14 && bar === 7)) this.kick(t);
    if (st === 4 || st === 12) this.snare(t);
    if (bar === 7 && st >= 12) this.snare(t, 0.5);                         // fill into the loop
    this.hat(t, st % 4 === 2 ? 0.05 : 0.025);
    if (st === 0 && bar % 4 === 0) this.crash(t);
    // bass: driving eighths with an octave pop
    if (st % 2 === 0) this.bass(t, r + (st === 6 || st === 14 ? 12 : 0), spb * 1.8);
    // rhythm guitar: palm-muted chugs, accented open chords on the "and" of 2 and on 4
    if (st % 2 === 0 && st !== 6 && st !== 12) this.power(t, r + 12, spb * 1.4, 0.035);
    if (st === 6 || st === 12) this.power(t, r + 12, spb * 5, 0.06);
    // lead: an original eight-bar hook in E minor pentatonic
    if (B) {
      const hook = {
        4: [[0, 76, 2], [2, 79, 2], [4, 81, 4], [10, 79, 2], [12, 76, 4]],
        5: [[0, 74, 2], [2, 76, 2], [4, 79, 6], [12, 76, 2], [14, 74, 2]],
        6: [[0, 71, 2], [2, 74, 2], [4, 76, 4], [8, 79, 2], [10, 81, 2], [12, 83, 4]],
        7: [[0, 83, 3], [3, 81, 3], [6, 79, 2], [8, 78, 4], [12, 76, 4]],
      }[bar] || [];
      for (const [pos, note, len] of hook) if (pos === st) this.lead(t, note, spb * len);
    } else if (bar === 3 && st >= 8 && st % 2 === 0) this.lead(t, [71, 74, 76, 78][(st - 8) / 2], spb * 1.6, 0.03);   // pickup
  },
  hz: m => 440 * Math.pow(2, (m - 69) / 12),
  env(g, t, a, d, peak) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); },
  kick(t) { const o = AC.createOscillator(), g = AC.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); this.env(g, t, 0.002, 0.2, 0.9); o.connect(g).connect(this.gain); o.start(t); o.stop(t + 0.25); },
  snare(t, v = 1) {
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8;
    this.env(g, t, 0.002, 0.16, 0.5 * v); s.connect(f).connect(g).connect(this.gain); s.start(t, Math.random()); s.stop(t + 0.2);
    const o = AC.createOscillator(), g2 = AC.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08); this.env(g2, t, 0.002, 0.09, 0.35 * v); o.connect(g2).connect(this.gain); o.start(t); o.stop(t + 0.12);
  },
  hat(t, v) { const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 7500; this.env(g, t, 0.001, 0.04, v); s.connect(f).connect(g).connect(this.gain); s.start(t, Math.random()); s.stop(t + 0.06); },
  crash(t) { const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 4500; this.env(g, t, 0.003, 1.1, 0.12); s.connect(f).connect(g).connect(this.gain); s.start(t, Math.random()); s.stop(t + 1.2); },
  bass(t, m, d) { const o = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain(); o.type = 'sawtooth'; o.frequency.value = this.hz(m); f.type = 'lowpass'; f.frequency.value = 520; this.env(g, t, 0.004, d, 0.32); o.connect(f).connect(g).connect(this.gain); o.start(t); o.stop(t + d + 0.05); },
  power(t, m, d, v) {           // root + fifth + octave through the distortion = an 8-bit "guitar"
    for (const iv of [0, 7, 12]) { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sawtooth'; o.frequency.value = this.hz(m + iv) * (1 + (Math.random() - 0.5) * 0.004); this.env(g, t, 0.004, d, v); o.connect(g).connect(this.shaper); o.start(t); o.stop(t + d + 0.05); }
  },
  lead(t, m, d, v = 0.05) {
    const o = AC.createOscillator(), lfo = AC.createOscillator(), lg = AC.createGain(), g = AC.createGain();
    o.type = 'square'; o.frequency.value = this.hz(m); lfo.frequency.value = 6; lg.gain.value = this.hz(m) * 0.01; lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.setValueAtTime(v, t + d * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(this.gain); o.start(t); lfo.start(t); o.stop(t + d + 0.02); lfo.stop(t + d + 0.02);
  },
};
// ---- menu blips (sound effects volume)
const MenuFX = {
  last: 0,
  play(kind) {
    if (!AC || !master || !S.sound) return;
    const now = performance.now(); if (kind === 'move' && now - this.last < 45) return; this.last = now;
    if (kind === 'move') tone(880, 0.04, 'square', 0.025);
    else if (kind === 'confirm') { tone(660, 0.05, 'square', 0.035); tone(990, 0.08, 'square', 0.035, 0, 0.05); }
    else if (kind === 'back') { tone(520, 0.05, 'square', 0.03); tone(330, 0.08, 'square', 0.03, 0, 0.05); }
  },
};
// first gesture unlocks audio; buttons click/hover with menu blips
addEventListener('pointerdown', () => Music.unlock(), true);
addEventListener('keydown', () => Music.unlock(), true);
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('#app button, .modal button');
  if (!b || b.disabled) return;
  MenuFX.play(/^\s*◀/.test(b.textContent) || /CANCEL|CLOSE/.test(b.textContent) ? 'back' : 'confirm');
}, true);
document.addEventListener('mouseover', e => {
  const b = e.target.closest && e.target.closest('#app button');
  if (b && !b.disabled && b !== MenuFX.hover) { MenuFX.hover = b; MenuFX.play('move'); }
});
// keyboard navigation of any menu screen: arrows (or your skate keys) move between buttons, Enter/Space selects
addEventListener('keydown', e => {
  if (!app.classList.contains('show') || Input.capturing || document.querySelector('.modal')) return;
  if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const acts = Input.actionsFor(e.code);
  const dir = e.code === 'ArrowDown' || e.code === 'ArrowRight' || acts.includes('down') || acts.includes('right') ? 1 : e.code === 'ArrowUp' || e.code === 'ArrowLeft' || acts.includes('up') || acts.includes('left') ? -1 : 0;
  if (!dir || !UI.cur || UI.cur !== scrMain) return;
  const btns = [...app.querySelectorAll('button')].filter(b => !b.disabled && b.offsetParent);
  if (!btns.length) return;
  e.preventDefault();
  const i = btns.indexOf(document.activeElement);
  const n = btns[(i + dir + btns.length) % btns.length];
  n.focus(); MenuFX.play('move');
});

// ====================================================================
//  MAIN MENU BACKDROP: arena bowl, sweeping spotlights, flashing crowd, warm-up skaters
// ====================================================================
const MenuBG = {
  cv: null, raf: 0, t: 0, team: null,
  show(team) {
    this.team = team || null;
    if (!this.cv) { this.cv = document.getElementById('menuBg'); }
    if (!this.cv) return;
    this.cv.style.display = 'block';
    if (!this.raf) { const loop = () => { this.raf = requestAnimationFrame(loop); this.draw(); }; this.raf = requestAnimationFrame(loop); }
  },
  hide() { if (this.cv) this.cv.style.display = 'none'; if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; },
  draw() {
    const cv = this.cv, dpr = Math.min(2, devicePixelRatio || 1), Wd = innerWidth, Hd = innerHeight;
    if (cv.width !== Math.round(Wd * dpr) || cv.height !== Math.round(Hd * dpr)) { cv.width = Math.round(Wd * dpr); cv.height = Math.round(Hd * dpr); }
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.imageSmoothingEnabled = false;
    this.t++; const t = this.t;
    const ps = Math.max(3, Math.round(Hd / 180));            // chunky pixels that scale with the window
    const acc = this.team ? this.team.colors : { p: '#203a7a', s: '#0f1d40', a: '#e8b923' };
    // arena darkness
    const g = c.createLinearGradient(0, 0, 0, Hd); g.addColorStop(0, '#07081a'); g.addColorStop(0.55, '#0e1230'); g.addColorStop(1, '#05060f');
    c.fillStyle = g; c.fillRect(0, 0, Wd, Hd);
    // crowd: rows of pixel fans in the upper bowl, a few camera flashes
    const rowsTop = Math.round(Hd * 0.06), crowdH = Math.round(Hd * 0.34);
    const pal = ['#2b2f55', '#3a3f6e', '#4b3a5e', '#30405a', acc.p, acc.a, '#5a4a3a', '#2f5a4a'];
    for (let y = rowsTop, row = 0; y < rowsTop + crowdH; y += ps * 3, row++) {
      const dim = 0.35 + row / (crowdH / (ps * 3)) * 0.4;
      for (let x = (row % 2) * ps; x < Wd; x += ps * 3) {
        const h0 = (x * 7 + row * 131) % 97, bob = (h0 % 5 === 0 && ((t >> 4) + h0) % 6 === 0) ? -ps : 0;
        c.globalAlpha = dim; c.fillStyle = pal[h0 % pal.length]; c.fillRect(x, y + ps + bob, ps * 2, ps * 2);
        c.fillStyle = '#c99a78'; c.fillRect(x + ps * 0.5, y + bob, ps, ps);
        if ((h0 * 13 + t) % 997 === 0) { c.globalAlpha = 1; c.fillStyle = '#ffffff'; c.fillRect(x - ps, y - ps, ps * 4, ps * 4); }
      }
    }
    c.globalAlpha = 1;
    // advertising hoardings line (SOCCER, Nov 24 nightly: this backdrop was still a hockey rink with skaters and sticks)
    const iceTop = rowsTop + crowdH + ps * 2;
    c.fillStyle = '#e8ecf2'; c.fillRect(0, iceTop - ps * 2, Wd, ps); c.fillStyle = acc.p; c.fillRect(0, iceTop - ps, Wd, ps);
    // the pitch: mown stripes, halfway line, centre circle and spot
    const ig = c.createLinearGradient(0, iceTop, 0, Hd); ig.addColorStop(0, '#3f8f3a'); ig.addColorStop(1, '#2f7530');
    c.fillStyle = ig; c.fillRect(0, iceTop, Wd, Hd - iceTop);
    c.fillStyle = 'rgba(255,255,255,.05)'; for (let k = 0; k < 10; k += 2) c.fillRect(Wd * k / 10, iceTop, Wd / 10, Hd);
    c.fillStyle = 'rgba(245,248,240,.75)'; c.fillRect(Wd / 2 - ps / 2, iceTop, ps, Hd);
    c.strokeStyle = 'rgba(245,248,240,.7)'; c.lineWidth = ps; c.beginPath(); c.ellipse(Wd / 2, iceTop + (Hd - iceTop) * 0.55, Wd * 0.09, (Hd - iceTop) * 0.3, 0, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(245,248,240,.8)'; c.fillRect(Wd / 2 - ps, iceTop + (Hd - iceTop) * 0.55 - ps, ps * 2, ps * 2);
    // warm-up players jogging round the pitch
    for (let k = 0; k < 6; k++) {
      const sp = 0.0035 + k * 0.0004, a = t * sp + k * 1.05;
      const x = Wd / 2 + Math.cos(a) * Wd * 0.38, y = iceTop + (Hd - iceTop) * (0.52 + Math.sin(a) * 0.3);
      const team = k % 2 ? { m: acc.p, t: acc.a } : { m: '#eef1f6', t: acc.p };
      const s = ps, dirx = -Math.sin(a) > 0 ? 1 : -1, leg = ((t >> 3) + k) % 2;
      c.fillStyle = 'rgba(10,30,10,.3)'; c.fillRect(x - s * 3, y + s * 0.5, s * 6, s);
      c.fillStyle = '#1d1f27'; c.fillRect(x - s * 2 + leg * s, y - s, s * 2, s); c.fillRect(x + leg * -s, y - s, s * 2, s);
      c.fillStyle = team.m; c.fillRect(x - s * 2, y - s * 6, s * 4, s * 5); c.fillStyle = team.t; c.fillRect(x - s * 2, y - s * 4, s * 4, s);
      c.fillStyle = team.m === '#eef1f6' ? acc.p : acc.s; c.fillRect(x - s * 1.5, y - s * 8, s * 3, s * 2);
      if (k === 0) { c.fillStyle = '#f4f4f0'; c.fillRect(x + dirx * s * 3, y - s * 1.5, s * 2, s * 2); c.fillStyle = '#18191f'; c.fillRect(x + dirx * s * 3 + (leg ? 0 : s), y - s * 1.5 + (leg ? s : 0), s, s); }   // the ball at his feet
    }
    // sweeping spotlights
    c.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) {
      const cx = Wd * (0.5 + Math.sin(t * 0.007 + k * 2.1) * 0.42), top = 0;
      const gr = c.createRadialGradient(cx, iceTop + (Hd - iceTop) * 0.5, 0, cx, iceTop + (Hd - iceTop) * 0.5, Hd * 0.22);
      gr.addColorStop(0, 'rgba(255,240,200,.16)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
      c.fillStyle = gr; c.fillRect(0, iceTop, Wd, Hd - iceTop);
      c.fillStyle = 'rgba(255,240,200,.035)'; c.beginPath(); c.moveTo(Wd / 2 + (k - 1) * Wd * 0.3, top); c.lineTo(cx - Wd * 0.08, Hd); c.lineTo(cx + Wd * 0.08, Hd); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
    // vignette
    const vg = c.createRadialGradient(Wd / 2, Hd * 0.45, Math.min(Wd, Hd) * 0.3, Wd / 2, Hd * 0.45, Math.max(Wd, Hd) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,8,.7)'); c.fillStyle = vg; c.fillRect(0, 0, Wd, Hd);
  },
};
// the title logo: chunky gold letters, chrome outline, a glint that sweeps across, crossed sticks behind
// the title logo: one centre line for everything. Crossed sticks behind the title (crossing dead centre), the puck
// under the crossing, chunky 3-D gold letters with a moving shine, and the tagline on a ribbon of its own below
function drawTitleLogo(cv) {
  const c = cv.getContext('2d'), Wl = cv.width, Hl = cv.height; let t = 0;
  const cx = Wl / 2, s = Wl / 640;
  const titleY = Hl * 0.40, puckY = Hl * 0.70, ribY = Hl * 0.885;
  // the title is centred on the screen as a whole; it is sized to fit with its outline and 3-D edge, and the sticks
  // cross in the middle of the gap between the two words (so they sit just off the screen's centre line)
  let size = Math.round(54 * s), L = null;
  const layout = () => {
    c.font = `${size}px 'PH Pixel', monospace`; c.textAlign = 'left';
    let w1 = c.measureText('PIXEL').width, w2 = c.measureText('SOCCER').width, gap = c.measureText(' ').width * 1.15;
    const room = Wl - size * 0.16 - 12 * s * 2;                       // outline + the extrusion, both sides
    if (w1 + gap + w2 > room) { size = Math.floor(size * room / (w1 + gap + w2)); c.font = `${size}px 'PH Pixel', monospace`; w1 = c.measureText('PIXEL').width; w2 = c.measureText('SOCCER').width; gap = c.measureText(' ').width * 1.15; }
    let left = cx - (w1 + gap + w2) / 2;
    // centre on the letters' actual ink (the font's side bearings aren't even)
    const m1 = c.measureText('PIXEL'), m2 = c.measureText('SOCCER');
    const inkL = left - (m1.actualBoundingBoxLeft || 0), inkR = left + w1 + gap + (m2.actualBoundingBoxRight || w2);
    left += cx - (inkL + inkR) / 2;
    L = { x1: left, x2: left + w1 + gap, crossX: left + w1 + gap / 2, w: w1 + gap + w2, left };
  };
  const stick = (sg) => {                   // sg -1: handle top-left, blade bottom-right; +1 mirrored
    const ax = L.crossX;
    // the crossing lands exactly at the title's mid-height: handle and blade offsets in the ratio of the heights above and below it
    const topY = Hl * 0.03, botY = puckY - 4 * s, f = (titleY - topY) / (botY - topY), span = 242 * s;
    const top = { x: ax + sg * span * f, y: topY }, bot = { x: ax - sg * span * (1 - f), y: botY };
    const ang = Math.atan2(bot.y - top.y, bot.x - top.x), len = hyp(bot.x - top.x, bot.y - top.y);
    c.save(); c.translate(top.x, top.y); c.rotate(ang);
    c.fillStyle = '#2a1a0c'; c.fillRect(-2 * s, -7 * s, len + 2 * s, 14 * s);               // outline
    c.fillStyle = '#8a5a2b'; c.fillRect(0, -5 * s, len, 10 * s);                          // the shaft
    c.fillStyle = '#b07a3e'; c.fillRect(0, -5 * s, len, 3 * s);                           // its lit edge
    c.fillStyle = '#16171d'; c.fillRect(0, -5 * s, 22 * s, 10 * s);                       // knob tape
    for (let k = 0; k < 3; k++) { c.fillStyle = '#e8ecf6'; c.fillRect(len * 0.8 + k * 6 * s, -5 * s, 3 * s, 10 * s); }   // a little white tape
    c.restore();
    // the blade, turned outward along the ice
    const dir = -sg, bx = bot.x, by = bot.y;
    c.fillStyle = '#2a1a0c'; c.fillRect(bx - (dir < 0 ? 46 * s : 4 * s), by - 4 * s, 50 * s, 16 * s);
    c.fillStyle = '#1d1e26'; c.fillRect(bx - (dir < 0 ? 44 * s : 2 * s), by - 2 * s, 46 * s, 12 * s);
    c.fillStyle = '#e8ecf6'; c.fillRect(bx - (dir < 0 ? 30 * s : -10 * s), by - 2 * s, 20 * s, 12 * s);   // blade tape
    c.fillStyle = '#1d1e26'; c.fillRect(bx + dir * 40 * s - (dir < 0 ? 6 * s : 0), by - 8 * s, 6 * s, 8 * s);  // the toe curls up
  };
  const sparkle = (x, y, k) => { c.fillStyle = `rgba(255,246,200,${k})`; c.fillRect(x - 1 * s, y - 5 * s, 2 * s, 10 * s); c.fillRect(x - 5 * s, y - 1 * s, 10 * s, 2 * s); c.fillStyle = `rgba(255,255,255,${k})`; c.fillRect(x - 1 * s, y - 1 * s, 2 * s, 2 * s); };
  const draw = () => {
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, Wl, Hl); c.imageSmoothingEnabled = false;
    // a soft dark pool behind it all, so it reads over the live game
    const bg = c.createRadialGradient(cx, Hl * 0.48, 10, cx, Hl * 0.48, Wl * 0.48);
    bg.addColorStop(0, 'rgba(5,6,16,.62)'); bg.addColorStop(0.6, 'rgba(5,6,16,.35)'); bg.addColorStop(1, 'rgba(5,6,16,0)');
    c.fillStyle = bg; c.fillRect(0, 0, Wl, Hl);
    if (!L) layout();
    const px = L.crossX;
    // SOCCER: a big pixel ball under the title, with its shadow on the grass
    { const R0 = 34 * s, by = puckY - 6 * s, cell = Math.max(2, Math.round(3 * s));
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(px, by + R0 + 6 * s, R0 * 1.1, 8 * s, 0, 0, Math.PI * 2); c.fill();
      const spin = t * 0.01, pent = (ang, d, r) => ({ x: px + Math.cos(ang + spin) * d, y: by + Math.sin(ang + spin) * d * 0.92, r });
      const pents = [pent(0, 0, R0 * 0.3)].concat([0, 1, 2, 3, 4].map(k => pent(-Math.PI / 2 + k * Math.PI * 2 / 5, R0 * 0.78, R0 * 0.26)));
      for (let y = -R0 - cell; y <= R0 + cell; y += cell) for (let x = -R0 - cell; x <= R0 + cell; x += cell) {
        const d = Math.hypot(x, y); if (d > R0 + cell * 0.6) continue;
        const wx = px + x, wy = by + y;
        let col = d > R0 - cell * 0.6 ? '#05060d' : '#f4f6f8';
        if (col !== '#05060d') { for (const p of pents) if (Math.hypot(wx - p.x, wy - p.y) < p.r) col = '#16171d';
          if (col === '#f4f6f8' && x + y > R0 * 0.55) col = '#c9ced8'; if (col === '#f4f6f8' && x + y < -R0 * 0.9) col = '#ffffff'; }
        c.fillStyle = col; c.fillRect(Math.round(wx - cell / 2), Math.round(wy - cell / 2), cell, cell);
      } }
    // the title: deep 3-D extrusion, dark outline, gold face with a bright band, then the travelling shine
    c.font = `${size}px 'PH Pixel', monospace`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.lineJoin = 'miter';
    const words = [['PIXEL', L.x1], ['SOCCER', L.x2]];
    const each = fn => { for (const [w, x] of words) fn(w, x); };
    for (let d = 7; d >= 1; d--) { c.fillStyle = d > 4 ? '#3a1600' : '#6a2c00'; each((w, x) => c.fillText(w, x + d * 0.6 * s, titleY + d * s)); }
    c.lineWidth = size * 0.16; c.strokeStyle = '#05060d'; each((w, x) => c.strokeText(w, x, titleY));
    const gr = c.createLinearGradient(0, titleY - size / 2, 0, titleY + size / 2);
    gr.addColorStop(0, '#fff3b0'); gr.addColorStop(0.28, '#ffd23f'); gr.addColorStop(0.5, '#ffb627'); gr.addColorStop(0.52, '#f08a00'); gr.addColorStop(1, '#c86400');
    c.fillStyle = gr; each((w, x) => c.fillText(w, x, titleY));
    const gx = ((t * 7) % (Wl * 2.2)) - Wl * 0.6;
    c.save(); c.globalCompositeOperation = 'source-atop';
    const gg = c.createLinearGradient(gx - 50 * s, 0, gx + 50 * s, 0); gg.addColorStop(0, 'rgba(255,255,255,0)'); gg.addColorStop(0.5, 'rgba(255,255,255,.8)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gg; each((w, x) => c.fillText(w, x, titleY)); c.restore();
    // twinkles on the letters
    [[0.04, -0.42], [0.6, -0.48], [0.97, 0.30]].forEach(([fx, fy], i) => { const k = Math.max(0, Math.sin(t * 0.05 + i * 2.1)); if (k > 0.2) sparkle(L.left + fx * L.w, titleY + fy * size, k); });
    // the tagline on a ribbon
    c.font = `${Math.round(11 * s)}px 'PH Pixel', monospace`; c.textAlign = 'center';
    const tag = '3-ON-3 ARCADE SOCCER', tagW = c.measureText(tag).width, rw = tagW + 44 * s, rh = 22 * s, rx = cx - rw / 2, ry = ribY - rh / 2;
    c.fillStyle = '#0b1a3a';                                                                 // the folded tails
    for (const sg of [-1, 1]) { const ex = sg < 0 ? rx : rx + rw; c.beginPath(); c.moveTo(ex, ry + 5 * s); c.lineTo(ex + sg * 26 * s, ry + 5 * s); c.lineTo(ex + sg * 18 * s, ry + rh / 2 + 5 * s); c.lineTo(ex + sg * 26 * s, ry + rh + 5 * s); c.lineTo(ex, ry + rh + 5 * s); c.closePath(); c.fill(); }
    c.fillStyle = '#05060d'; c.fillRect(rx - 3 * s, ry - 3 * s, rw + 6 * s, rh + 6 * s);
    const rg = c.createLinearGradient(0, ry, 0, ry + rh); rg.addColorStop(0, '#2f6fe8'); rg.addColorStop(1, '#1b3f94');
    c.fillStyle = rg; c.fillRect(rx, ry, rw, rh);
    c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(rx, ry, rw, 2 * s);
    c.fillStyle = '#ffd23f'; c.fillRect(rx + 8 * s, ribY - 2 * s, 4 * s, 4 * s); c.fillRect(rx + rw - 12 * s, ribY - 2 * s, 4 * s, 4 * s);
    c.textBaseline = 'middle'; c.fillStyle = '#05060d'; c.fillText(tag, cx + 1 * s, ribY + 2 * s); c.fillStyle = '#ffffff'; c.fillText(tag, cx, ribY + 1 * s);
    t++;
  };
  const loop = () => { if (!cv.isConnected && t > 2) return; draw(); requestAnimationFrame(loop); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { size = Math.round(54 * s); L = null; draw(); });
  loop();
}
Music.song = null; Music.song = Music.pick(Music.MENU) || 'theme';   // a random menu song each time the game loads
// the SONGS list (Settings and Pause → Settings): tick a song to include it in the rotation
function songsPanel(onChange) {
  const box = h('div', { class: 'songs' });
  const row = (k, note) => h('label', { class: 'songrow', style: { display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0', cursor: 'pointer' } },
    h('input', { type: 'checkbox', checked: Music.songOn(k), onchange: e => { const off = new Set(VOL.songsOff || []); if (e.target.checked) off.delete(k); else off.add(k); VOL.songsOff = [...off]; saveAudioPrefs(); if (onChange) onChange(); } }),
    h('span', null, '♪ ' + Music.SONGS[k].name), h('span', { class: 'muted', style: { fontSize: 'calc(7px * var(--ts, 1.2))' } }, note));
  Music.MENU.forEach(k => box.appendChild(row(k, k === 'rival' ? 'MENUS · SEMIFINALS' : k === 'cuprun' ? 'MENUS · TOURNAMENT GAMES' : 'MENUS')));
  box.appendChild(row('champ', 'FINALS'));
  box.appendChild(row('otalarm', 'EXTRA TIME · SHOOTOUTS'));
  Music.PUMP.forEach(k => box.appendChild(row(k, 'STOPPAGES')));
  box.appendChild(row('intense', 'EXTRA TIME (OLD)'));
  return box;
}
