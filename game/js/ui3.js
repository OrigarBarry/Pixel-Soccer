'use strict';
// ====================================================================
//  UI 3: positions & handedness, tactics panels, shared small widgets for the newer systems
// ====================================================================

// natural position, shooting hand, and how he fits the slot he occupies
function posFitLine(p, slot) {
  const role = slot && slot.kind === 'line' ? slot.j : null;
  const pen = role != null ? offPosPenalty(p.spos, role, p) : 0;
  const fit = role == null ? '' : pen === 0 ? ' · natural slot' : ` · in ${['left', 'centre', 'right'][role]} slot (-${Math.round(pen * 100)}%)`;
  const fitTxt = role == null ? null : pen === 0 ? 'natural slot' : `in ${['left', 'centre', 'right'][role]} slot (-${Math.round(pen * 100)}%)`;
  return h('div', { class: 'muted posfit', style: { fontSize: '7px', color: pen > 0.2 ? '#ff9a7a' : undefined } }, h('span', { class: 'pf' }, `${posShort(p.spos)} · shoots ${p.hand || 'L'}`), fitTxt ? [' · ', h('span', { class: 'pf' }, fitTxt)] : null);
}
const lineComp = pls => pls.map(p => p ? sideOf(p.spos) : '—').join(' / ');
const handLabel = p => p && p.pos !== 'G' ? (HAND_NAMES[p.hand] || 'Left') : '';
function posDetail(p) { return p.pos === 'G' ? 'Keeper · ' + (goalieCatch(p) === 'L' ? 'left' : 'right') + '-handed' : `${POS_NAMES[p.spos] || p.spos} · ${handLabel(p).toLowerCase()}-footed · set pieces ${r100(p.attrs.fo)}`; }

// little diagrams of each strategy: where the three skaters stand with the puck (attacking their net) and
// without it (defending ours). x: -1 (left boards) .. 1 (right boards); y: 0 = goal line .. 1 = blue line (1.4 = past it)
const TAC_SHAPES = {
  balanced:  { off: [[0.68, 0.5, 1], [-0.42, 0.86], [0, 0.24]], def: [[0.62, 0.48], [0, 0.26], [-0.4, 0.72]], opp: [0.78, 0.5], note: 'Two up, one low' },
  forecheck: { off: [[0.68, 0.5, 1], [-0.42, 0.86], [0.05, 0.22]], def: [[0.55, 0.06], [0.2, 0.3], [-0.2, 0.92]], opp: [0.62, -0.02], deep: true, note: 'Two in deep, one high' },
  shell:     { off: [[0.62, 0.5, 1], [-0.35, 0.7], [0.05, 0.16]], def: [[0.55, 0.5], [0.05, 0.36], [0, 0.12]], opp: [0.78, 0.55], note: 'Goal guard, box man, presser' },
  counter:   { off: [[0.68, 0.5, 1], [-0.35, 0.9], [0.0, 1.32]], def: [[0.62, 0.48], [0.05, 0.3], [-0.35, 1.25]], opp: [0.78, 0.5], note: 'One man leaks out' },
  crash:     { off: [[0.62, 0.62, 1], [-0.16, 0.12], [0.16, 0.16]], def: [[0.62, 0.48], [0, 0.26], [-0.4, 0.72]], opp: [0.78, 0.5], note: 'Two crash the six-yard box' },
  splitlanes:{ off: [[0.68, 0.5, 1], [-0.42, 0.86], [0, 0.24]], def: [[0.62, 0.44], [0.12, 0.34], [-0.28, 0.12]], opp: [0.8, 0.5], lane: true, note: 'Boot in the lane, lock the far post' },
  trap:      { off: [[0.68, 0.5, 1], [-0.42, 0.86], [0, 0.24]], def: [[0.45, 1.38], [0.38, 1.08], [-0.38, 1.08]], opp: [0.7, 1.55], note: '1-2-2 across the midfield' },
};
function tacDiagram(key) {
  const sh = TAC_SHAPES[key] || TAC_SHAPES.balanced, Wd = 64, Hd = 62, cv = h('canvas', { width: (Wd * 2 + 4) * 3, height: Hd * 3, class: 'tacdia' });
  const c = cv.getContext('2d'); c.scale(3, 3); c.imageSmoothingEnabled = false;
  const panel = (ox, list, label, defending) => {
    // half a rink: blue line at the top, the net at the bottom
    c.fillStyle = '#e9f1f8'; c.fillRect(ox, 0, Wd, Hd);
    c.fillStyle = '#3a6fd8'; c.fillRect(ox, 6, Wd, 2);
    c.fillStyle = '#d84a4a'; c.fillRect(ox, Hd - 12, Wd, 1);
    c.fillStyle = 'rgba(80,140,230,.35)'; c.beginPath(); c.arc(ox + Wd / 2, Hd - 12, 5, Math.PI, 0); c.fill();
    c.fillStyle = '#d84a4a'; c.fillRect(ox + Wd / 2 - 4, Hd - 11, 8, 3);
    c.strokeStyle = '#9aa3c7'; c.lineWidth = 1; c.strokeRect(ox + 0.5, 0.5, Wd - 1, Hd - 1);
    const P = (x, y) => [ox + Wd / 2 + x * (Wd / 2 - 6), Hd - 12 - y * (Hd - 22)];
    if (defending && sh.opp) {                    // their puck carrier
      const [qx, qy] = P(sh.opp[0], sh.opp[1]); c.fillStyle = '#c0392b'; c.fillRect(qx - 2, qy - 2, 4, 4); c.fillStyle = '#111'; c.fillRect(qx + 2, qy + 1, 2, 1);
      if (sh.lane) { const [mx, my] = P(0, 0.3); c.strokeStyle = 'rgba(192,57,43,.5)'; c.setLineDash([2, 2]); c.beginPath(); c.moveTo(qx, qy); c.lineTo(mx, my); c.stroke(); c.setLineDash([]); }
    }
    list.forEach(([x, y, car], i) => {
      const [px0, py0] = P(x, Math.min(y, 1.35)); c.fillStyle = '#141832'; c.fillRect(px0 - 3.5, py0 - 3.5, 7, 7);
      c.fillStyle = car ? '#ffd23f' : '#5ee07a'; c.fillRect(px0 - 2.5, py0 - 2.5, 5, 5);
      if (car) { c.fillStyle = '#111'; c.fillRect(px0 + 3, py0 + 1, 2, 1); }
    });
  };
  panel(0, sh.off, 'WITH BALL', false);
  panel(Wd + 4, sh.def, sh.deep ? 'FORECHECK' : 'DEFENDING', true);
  return h('div', { class: 'tacdiawrap', title: sh.note }, cv,
    h('div', { class: 'tacdialab' }, h('span', null, 'WITH BALL'), h('span', null, sh.deep ? 'PRESS (THEIR END)' : 'DEFENDING')),
    h('div', { class: 'gold', style: { fontSize: '7px', marginTop: '2px' } }, sh.note));
}
// FORMATION EDITOR: half a rink, the net at the bottom and the blue line at the top (always the same way up), the
// puck's side on the right (on the ice it mirrors to wherever the puck is). Drag a dot; your skaters hold that shape
// whenever the play allows. kind: 'att' (their end, with the puck), 'def' (our end), 'pp' (4 dots), 'pk'.
function formEditor(dots, kind, opts = {}) {
  const W = 72, H = 84, S3 = 3, cv = h('canvas', { width: W * S3, height: H * S3, class: 'formcv' + (opts.locked ? '' : ' edit') });
  const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  let cur = dots.map(d => d.slice()), drag = -1;
  const gyL = H - 14, byL = 18;                                // goal line / blue line rows
  const P = d => [W / 2 + d[0] * (W / 2 - 7), gyL - d[1] * (gyL - byL)];
  const Q = (px, py) => [clamp((px - W / 2) / (W / 2 - 7), -1, 1), clamp((gyL - py) / (gyL - byL), 0, 1.4)];
  const attack = kind === 'att' || kind === 'pp';
  const draw = () => {
    c.setTransform(S3, 0, 0, S3, 0, 0);
    c.fillStyle = '#e9f1f8'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#dde6f0'; c.fillRect(0, 0, W, byL - 1);                         // just outside the zone
    c.fillStyle = '#3a6fd8'; c.fillRect(0, byL - 1, W, 2);                          // blue line
    c.fillStyle = '#d84a4a'; c.fillRect(0, gyL, W, 1);                               // goal line
    c.strokeStyle = 'rgba(216,74,74,.55)'; c.lineWidth = 0.8;
    for (const sx of [-1, 1]) { c.beginPath(); c.arc(W / 2 + sx * 19, gyL - 20, 9, 0, Math.PI * 2); c.stroke(); }   // faceoff circles
    c.fillStyle = 'rgba(80,140,230,.35)'; c.beginPath(); c.arc(W / 2, gyL, 6, Math.PI, 0); c.fill();             // crease
    c.fillStyle = attack ? '#d84a4a' : '#3a6fd8'; c.fillRect(W / 2 - 4, gyL + 1, 8, 3);                          // the net (theirs / ours)
    c.strokeStyle = '#9aa3c7'; c.lineWidth = 1; c.strokeRect(0.5, 0.5, W - 1, H - 1);
    // the puck's side
    if (attack) { c.fillStyle = '#111'; c.beginPath(); c.arc(W - 8, gyL - 34, 1.6, 0, Math.PI * 2); c.fill(); }
    else { c.fillStyle = '#c0392b'; c.fillRect(W - 10, gyL - 36, 4, 4); c.fillStyle = '#111'; c.beginPath(); c.arc(W - 5, gyL - 32, 1.3, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#6b7396'; c.font = "5px 'PH Pixel', monospace"; c.textAlign = 'right'; c.fillText('BALL', W - 3, gyL - 40);
    // the dots
    cur.forEach((d, i) => {
      const [x, y] = P(d);
      c.fillStyle = '#141832'; c.fillRect(Math.round(x) - 4, Math.round(y) - 4, 8, 8);
      c.fillStyle = drag === i ? '#ffd23f' : attack ? '#5ee07a' : '#7ec8ff'; c.fillRect(Math.round(x) - 3, Math.round(y) - 3, 6, 6);
    });
  };
  const at = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
  if (!opts.locked) {
    cv.addEventListener('pointerdown', e => {
      const [px, py] = at(e); let bi = -1, bd = 9;
      cur.forEach((d, i) => { const [x, y] = P(d), dd = hyp(x - px, y - py); if (dd < bd) { bd = dd; bi = i; } });
      if (bi < 0) return; drag = bi; cv.setPointerCapture(e.pointerId); e.preventDefault(); draw();
    });
    cv.addEventListener('pointermove', e => { if (drag < 0) return; cur[drag] = Q(...at(e)).map(v => Math.round(v * 100) / 100); draw(); });
    const up = () => { if (drag < 0) return; drag = -1; draw(); if (opts.onChange) opts.onChange(cur.map(d => d.slice())); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw); draw();
  return h('div', { class: 'formwrap' }, cv, opts.label ? h('div', { class: 'formlab' }, opts.label) : null);
}
// the dots shown for a slot: the team's own, else its tactic's preset
function formDots(tac, slot, kind) {
  const f = tac.form || {};
  if (slot === 'pp') return f.pp || PP_FORM_PRESETS[tac.pp];
  if (slot === 'pk') return f.pk || PK_FORM_PRESETS[tac.pk];
  return (f.lines && f.lines[slot] && f.lines[slot][kind]) || FORM_PRESETS[tac.lines[slot]][kind];
}
const formIsCustom = (tac, slot, kind) => { const f = tac.form || {}; return slot === 'pp' ? !!f.pp : slot === 'pk' ? !!f.pk : !!(f.lines && f.lines[slot] && f.lines[slot][kind]); };
// tactics editor: per-line strategy, power play and penalty kill; shows strengths and weaknesses
function tacticsPanel(tac, onChange, opts = {}) {
  tac = validTac(tac);
  const wrap = h('div', { class: 'panel' + (opts.compact ? ' tpc' : '') }), C = !!opts.compact;   // compact: one screen, no scrolling (details on hover)
  if (S.diff === 'EASY' && !opts.ignoreEasy) {            // on Easy both teams play Balanced: nothing to set (Quick Play's sheet decides for itself)
    if (C) wrap.appendChild(h('div', { class: 'gold', style: { margin: '0 0 2px' }, 'data-help': 'No tactics to worry about: just play. Strategies, tempos and formations unlock on Normal and Hard. Anything you set here is kept for when you switch.' }, 'EASY: BOTH TEAMS PLAY BALANCED ', h('span', { class: 'muted' }, '(these apply on Normal and Hard)')));
    else {
    wrap.appendChild(h('div', { class: 'gold', style: { margin: '6px 0' } }, 'EASY: BOTH TEAMS PLAY BALANCED'));
    wrap.appendChild(h('div', { class: 'muted', style: { lineHeight: 1.7 } }, 'No tactics to worry about: just play. Strategies, tempos and formations unlock on Normal and Hard. Anything you set here is kept for when you switch.')); }
    if (!opts.showOnEasy) return wrap;
  }
  if (opts.title) wrap.appendChild(h('h3', { style: { marginTop: 0 } }, opts.title));
  const set = (k, v, i) => { const t = validTac(tac); if (k === 'line') t.lines[i] = v; else if (k === 'tempo') t.tempo[i] = v; else t[k] = v; onChange(t); };
  // a formation edit (dots = null: back to the tactic's preset)
  const setForm = (slot, kind, dots) => {
    const t = validTac(tac), f = t.form || { lines: [{}, {}, {}], pp: null, pk: null };
    f.lines = [0, 1, 2].map(i => Object.assign({ att: null, def: null }, (f.lines || [])[i] || {}));
    if (slot === 'pp') f.pp = dots; else if (slot === 'pk') f.pk = dots; else f.lines[slot][kind] = dots;
    t.form = validForm(f) || undefined; if (!t.form) delete t.form; onChange(t);
  };
  const formBox = (slot, kinds) => opts.diagrams === false ? null : h('div', { class: 'formbox' },
    h('div', { class: 'formrow' }, kinds.map(([kind, lab]) => formEditor(formDots(tac, slot, kind), slot === 'pp' ? 'pp' : slot === 'pk' ? 'pk' : kind,
      { locked: !!opts.locked, label: lab + (formIsCustom(tac, slot, kind) ? ' *' : ''), onChange: d => setForm(slot, kind, d) }))),
    opts.locked ? null : h('button', { class: 'small', style: { marginTop: '3px', width: '100%', visibility: kinds.some(([kind]) => formIsCustom(tac, slot, kind)) ? 'visible' : 'hidden' },
      onclick: () => { for (const [kind] of kinds) setForm(slot, kind, null); } }, 'RESET SHAPE'));
  const sel = (opts2, cur, fn) => h('select', { class: 'tp2sel', disabled: !!opts.locked, onchange: e => fn(e.target.value) }, Object.entries(opts2).map(([k, v]) => h('option', { value: k, selected: k === cur }, v.name)));
  // shapes are tucked away until asked for: the words come first
  const shapes = false;
  const ICE = C ? ['~40%', '~33%', '~27%'] : ['plays about 40% of the game', 'about 33%', 'about 27%'];
  wrap.appendChild(h('div', { class: 'tp2head' }, h('span', null, 'EVEN STRENGTH'), h('span', { class: 'tp2sub' }, 'each line has a strategy (how it defends and attacks) and a tempo (how fast it attacks)')));
  for (const i of [0, 1, 2]) {
    const st = STRATEGIES[tac.lines[i]], tp = TEMPOS[tac.tempo[i]];
    wrap.appendChild(h('div', { class: 'tp2row' + (shapes ? ' shapes' : '') },
      h('div', { class: 'tp2lab' }, h('div', { class: 'tp2line' }, 'LINE ' + (i + 1)), h('div', { class: 'tp2ice' }, ICE[i])),
      h('div', { class: 'tp2col' },
        h('div', { class: 'tp2k' }, 'STRATEGY'), sel(STRATEGIES, tac.lines[i], v => set('line', v, i)),
        h('div', { class: 'tp2pro', 'data-help': C ? st.strength : null }, '✓ ' + st.strength), C ? null : h('div', { class: 'tp2con' }, '✗ ' + st.weakness)),
      h('div', { class: 'tp2col' },
        h('div', { class: 'tp2k' }, 'TEMPO'),
        h('div', { class: 'tp2seg' }, Object.entries(TEMPOS).map(([k, t2]) =>
          h('button', { class: 'tp2tb' + (tac.tempo[i] === k ? ' sel' : ''), title: C ? t2.name + ': ' + (t2.plain || t2.desc) : null, disabled: !!opts.locked, onclick: () => set('tempo', k, i) }, t2.name.toUpperCase()))),
        C ? h('div', { class: 'tp2con', 'data-help': st.weakness }, '✗ ' + st.weakness) : h('div', { class: 'tp2tdesc' }, h('b', null, tp.name + ': '), tp.plain || tp.desc)),
      shapes ? formBox(i, [['att', 'ATTACK'], ['def', 'DEFEND']]) : null));
  }
  wrap.appendChild(h('div', { class: 'tp2head' }, h('span', null, 'SPECIAL TEAMS'), h('span', { class: 'tp2sub' }, 'used automatically whenever a team is a man up or a man down')));
  const st2 = (lab, sub, table, key, k, slot, kinds) => h('div', { class: 'tp2st' },
    h('div', { class: 'tp2line' }, lab), h('div', { class: 'tp2ice' }, sub), sel(table, tac[key], v => set(key, v)),
    h('div', { class: 'tp2tdesc' }, table[tac[key]].desc), shapes ? formBox(slot, kinds) : null);
  wrap.appendChild(h('div', { class: 'tp2strow' },
    st2('MAN UP', 'you have an extra player', PP_TACTICS, 'pp', 0, 'pp', [['pp', 'ATTACK (4)']]),
    st2('MAN DOWN', 'you are a player short', PK_TACTICS, 'pk', 0, 'pk', [['pk', 'DEFEND']])));
  const foot = h('div', { class: 'tp2foot' });
  // (Nov 22) the formation editor was folded into the strategies: each strategy plays its own built-in shape
  foot.appendChild(tacInfoBtn());
  wrap.appendChild(foot);
  if (shapes && !opts.locked) wrap.appendChild(h('div', { class: 'hint' }, 'FORMATIONS: drag the dots to change where players stand. The net is at the bottom, the halfway line at the top, the ball on the right. The ball carrier plays free; the others take the dots. * = your own shape.'));
  if (opts.showDesc !== false) wrap.appendChild(h('details', { style: { marginTop: '6px' } }, h('summary', { style: { cursor: 'pointer' } }, 'WHAT EACH STRATEGY DOES'),
    Object.values(STRATEGIES).map(st => h('div', { class: 'tp2tdesc', style: { margin: '6px 0' } }, h('b', null, st.name + ': '), st.desc))));
  if (opts.note) (C ? foot : wrap).appendChild(h('div', { class: 'hint' }, opts.note));
  return wrap;
}
// the opponent's tactics as a short scouting line
const tacSummary = tac => { tac = validTac(tac); return tac.lines.map((k, i) => 'L' + (i + 1) + ' ' + STRATEGIES[k].short + '/' + TEMPOS[tac.tempo[i]].short).join(' · ') + ' · PP ' + PP_TACTICS[tac.pp].name + ' · PK ' + PK_TACTICS[tac.pk].name; };

const tacLong = tac => { tac = validTac(tac); return tac.lines.map((k, i) => 'Line ' + (i + 1) + ': ' + STRATEGIES[k].name).join(' · ') + ' · Man advantage: ' + PP_TACTICS[tac.pp].name + ' · Man down: ' + PK_TACTICS[tac.pk].name; };
// what the strategy codes mean (BAL, FCK, SHL, CTR...), with their strengths and weaknesses
function tacticsHelp() {
  modal(close => h('div', null, h('h2', null, 'TEAM TACTICS EXPLAINED'),
    h('div', { class: 'sub' }, 'Each of a team\'s three lines (L1, L2, L3) plays one strategy at even strength. The three-letter code is the strategy. Man-advantage and man-down tactics are used when a team has an extra player or is a player short (only if a team runs out of subs after a red card).'),
    // no scrolling: the strategies two at a time (with their diagrams), then special teams
    pages('tachelp', Object.entries(STRATEGIES).concat([['__special', null]]), 2, list => h('div', { class: 'grid g2' }, list.map(([k, st]) => k === '__special'
      ? h('div', { class: 'panel', style: { margin: '6px 0', padding: '8px 10px' } }, h('b', { class: 'gold' }, 'MAN ADVANTAGE (PP)'),
        Object.values(PP_TACTICS).map(t => h('div', { style: { fontSize: '8px', margin: '4px 0', lineHeight: 1.8 } }, h('b', null, t.name), ' — ', t.desc)),
        h('b', { class: 'gold' }, 'MAN DOWN (PK)'),
        Object.values(PK_TACTICS).map(t => h('div', { style: { fontSize: '8px', margin: '4px 0', lineHeight: 1.8 } }, h('b', null, t.name), ' — ', t.desc)))
      : h('div', { class: 'panel', style: { margin: '6px 0', padding: '8px 10px' } },
        h('div', null, h('b', { class: 'gold' }, st.short), '  ' + st.name),
        h('div', { class: 'muted', style: { fontSize: '8px', margin: '4px 0', lineHeight: 1.8 } }, st.desc),
        h('div', { style: { fontSize: '8px', lineHeight: 1.8 } }, h('span', { style: { color: '#5ee07a' } }, '+ '), st.strength),
        h('div', { style: { fontSize: '8px', lineHeight: 1.8 } }, h('span', { style: { color: '#ff6a4a' } }, '− '), st.weakness),
        h('div', { class: 'formrow', style: { justifyContent: 'flex-start' } }, formEditor(FORM_PRESETS[k].att, 'att', { locked: true, label: 'ATTACK' }), formEditor(FORM_PRESETS[k].def, 'def', { locked: true, label: 'DEFEND' })))))),
    h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'primary', onclick: close }, 'GOT IT'))), true);
}
const tacInfoBtn = () => h('button', { class: 'small', title: 'What do the tactics codes mean?', onclick: e => { e.stopPropagation(); tacticsHelp(); } }, 'ⓘ WHAT DO THESE MEAN?');

// ---------- intermission tactics (the only in-game moment tactics may change)
function showTacPick(on) {
  let el = document.getElementById('tacPick');
  if (!on || S.autoAI || !S.match || !S.match.tac || S.match.easyTac || !S.match.userTeams || !S.match.userTeams.includes(0)) { if (el) el.classList.remove('show'); document.body.classList.remove('tacOpen'); return; }
  if (!el) {
    el = document.createElement('div'); el.id = 'tacPick';
    el.addEventListener('keydown', e => e.stopPropagation()); el.addEventListener('keyup', e => e.stopPropagation());
    (document.getElementById('wrap') || document.body).appendChild(el);
  }
  // collapsed to a button until you open it
  let open = false;
  const draw = () => {
    el.innerHTML = ''; el.classList.toggle('mini', !open); document.body.classList.toggle('tacOpen', !!open);   // the line chooser steps aside while it's open
    if (!open) { el.appendChild(h('button', { class: 'small primary', onclick: () => { open = true; draw(); } }, '\uE00C CHANGE TACTICS ▸')); return; }
    el.appendChild(h('div', { class: 'lphead' }, 'HALF-TIME TACTICS'));
    el.appendChild(tacticsPanel(S.match.tac[0], tc => { S.match.tac[0] = tc; draw(); }, { showDesc: false }));
    el.appendChild(h('div', { class: 'muted', style: { marginTop: '4px' } }, TEAM[1].abbr + ': ' + (S.diff === 'HARD' ? 'their tactics are hidden on Hard' : tacSummary(S.match.tac[1])), ' ', tacInfoBtn()));
    { const a = S.diff !== 'HARD' && S.match.adjust && S.match.adjust[1]; if (a) el.appendChild(h('div', { class: 'gold', style: { marginTop: '3px', fontSize: 'calc(7px * var(--ts, 1.2))' } }, 'THEY ADJUSTED · ' + a.text)); }
    el.appendChild(h('button', { class: 'small', onclick: () => { open = false; draw(); } }, '▴ CLOSE'));
  };
  draw(); el.classList.add('show');
}

// ====================================================================
//  PAUSE MENU: scoreline, main menu, Settings (incl. Controls) — keyboard friendly
// ====================================================================
// CONTROLS CHEAT SHEET: grouped cards, big keycaps, one short line per action. Always shows the player's own keys.
function controlsSheet() {
  const short = c => keyName(c).replace(/^LEFT /, 'L ').replace(/^RIGHT /, 'R ');
  const keys = (...ids) => ids.map(id => { const b = Input.binds[id] || [], i = b[0] ? 0 : b[1] ? 1 : 0; return bindKbd(id, i, true); });   // your main key for each action: click it to change it
  const row = (what, ks, note) => h('div', { class: 'ctlrow' }, h('div', { class: 'ctlwhat' }, what, note ? h('div', { class: 'ctlnote' }, note) : null), h('div', { class: 'ctlkeys' }, ...ks));
  const card = (title, color, ...rows) => h('div', { class: 'ctlcard', style: { borderColor: color } }, h('div', { class: 'ctlhead', style: { color } }, title), ...rows);
  return h('div', { class: 'ctlsheet' },
    card('RUN', '#7fd4ff',
      row('Run', keys('up', 'left', 'down', 'right')),
      row('Sprint on / off', keys('sprint'), 'burns stamina')),
    card('WITH THE BALL', '#ffd23f',
      row('Shoot', keys('shoot'), 'hold to charge'),
      row('Pass', keys('check'), 'the PASS / TACKLE key'),
      row('Cross / chip / long ball', keys('loft'), 'LOFT'),   // SOCCER: the ball in the air
      row('First-time shot', keys('shoot'), 'as the pass arrives')),
    card('FEINTS', '#b8f0a0',
      row('Dangle', keys('dangle'), 'juke the man in front'),
      row('Drag-back', keys('deke'), 'cut away from a poke or hit'),
      row('Roulette', keys('spin'), 'spin around a big tackle')),
    card('DEFENCE', '#ff8a8a',
      row('Poke tackle', keys('check'), 'tap'),
      row('Shoulder charge', keys('check'), 'hold'),
      row('Slide tackle', keys('poke'), 'ball first!'),
      row('Steal a pass', keys('check'), 'tap as it goes by your boot'),
      row('Switch player', keys('shoot'), 'without the ball')),
    card('KEEPER', '#c9a7ff',
      row('Pass it out', keys('check'), 'tap: short · hold: aim'),
      row('Kick it long', keys('cover'), 'punt upfield')),
    card('BENCH', '#ffb86b',
      row('Rolling sub', keys('line')),
      row('Next line', keys('line1', 'line2', 'line3')),
      row('Timeout', keys('timeout'))),
    card('GAME', '#e9ecff',
      row('Pause', keys('pause')),
      row('This cheat sheet', keys('help')),
      row('Fullscreen', keys('fullscreen'))));
}
let pauseView = 'main', pauseFocus = 0;
function renderPause(view) {
  pauseView = view || pauseView; pauseFocus = 0;
  const sc = $('pauseScore');
  if (sc) sc.innerHTML = `<span style="color:${textCol(TEAM[0])}">${TEAM[0].abbr} ${S.score[0]}</span><span class="muted" style="font-size:calc(8px * var(--ts, 1.2))">${S.so ? 'SHOOTOUT' : S.period >= 4 ? 'EXTRA TIME' : ['1ST', '1ST', '2ND'][S.period - 1] + ' · ' + (typeof clockText === 'function' ? clockText() : fmtClock(S.clock))}<br>SHOTS ${S.sog[0]}-${S.sog[1]}</span><span style="color:${textCol(TEAM[1])}">${S.score[1]} ${TEAM[1].abbr}</span>`;
  const main = $('pauseMain'), body = $('pauseBody');
  main.style.display = pauseView === 'main' ? '' : 'none';
  const card = $('ovPause').querySelector('.card'); if (card) card.classList.toggle('wide', pauseView === 'controls' || pauseView === 'settings');
  body.innerHTML = '';
  // never scroll: shrink the card a little if a view (or a big text size) would run off the screen
  if (card) { card.style.zoom = ''; setTimeout(() => { const ov = $('ovPause'); if (!ov || !card.isConnected) return; card.style.zoom = ''; for (let z = 0.95; z > 0.6 && ov.scrollHeight > ov.clientHeight + 1; z -= 0.05) card.style.zoom = z.toFixed(2); }, 0); }
  if (pauseView === 'settings') {
    const opt = (label, get, next) => { const b = h('button', { onclick: () => { next(); saveSettings(); renderPause('settings'); } }, h('span', null, label), h('span', { class: 'gold' }, get())); return b; };
    body.appendChild(h('div', { class: 'pauseopts two' },
      h('div', { class: 'gold', style: { fontSize: '10px', margin: '4px 0', gridColumn: '1 / -1' } }, 'SETTINGS'),
      h('button', { onclick: () => { toggleFS(); setTimeout(() => renderPause('settings'), 250); } }, h('span', null, 'FULLSCREEN'), h('span', { class: 'gold' }, document.fullscreenElement ? 'ON' : 'OFF')),
      opt('CAMERA', camLabel, () => { S.camPref = nextCamPref(); applyCamPref(true); }),
      opt('ARENA SCENERY', () => S.pres.arena === false ? 'OFF' : 'ON', () => { S.pres.arena = S.pres.arena === false; fitScene(); }),
      opt('BALL CARRIER INDICATOR', () => S.pres.carrier ? 'ON' : 'OFF', () => { S.pres.carrier = !S.pres.carrier; }),
      opt('PLAYER NAME LABELS', () => S.pres.labels ? 'ON' : 'OFF', () => { S.pres.labels = !S.pres.labels; }),
      opt('THREAT MARKERS', () => ({ OPP: 'OPPONENTS', ALL: 'EVERYONE', OFF: 'OFF' })[S.pres.threat || 'ALL'], () => { S.pres.threat = { ALL: 'OPP', OPP: 'OFF', OFF: 'ALL' }[S.pres.threat || 'ALL']; }),
      opt('SCREEN SHAKE', () => S.pres.shake === false ? 'OFF' : 'ON', () => { S.pres.shake = S.pres.shake === false; }),
      opt('SHOT INFO', () => S.pres.shotInfo ? 'ON' : 'OFF', () => { S.pres.shotInfo = !S.pres.shotInfo; }),
      opt('GOAL PRESENTATIONS', () => S.pres.goal, () => { S.pres.goal = { FULL: 'SHORT', SHORT: 'OFF', OFF: 'FULL' }[S.pres.goal]; }),
      opt('LINE SELECTOR', () => S.pres.linePick ? 'ON' : 'OFF', () => { S.pres.linePick = !S.pres.linePick; }),
      opt('SOUND', () => S.sound ? 'ON' : 'OFF', () => { S.sound = !S.sound; }),
      h('button', { onclick: () => renderPause('songs') }, h('span', null, '♪ SONGS'), h('span', { class: 'gold' }, '▸')),
      h('button', { onclick: () => renderPause('gkfeel') }, h('span', null, 'KEEPER FEEL (TUNING)'), h('span', { class: 'gold' }, '▸')),
      h('button', { onclick: () => { dbgEnable(); hideOverlays(); S.screen = 'play'; if (!$('dbgMatch')) toggleMatchDebug(); cvs.focus(); } }, h('span', null, '\uE002 DEBUG TOOLS (THIS GAME)'), h('span', { class: 'gold' }, '▸')),
      opt('TEXT SIZE', () => S.textSize, () => { S.textSize = cyc(TEXT_SIZES, S.textSize); applyTextSize(); }),
      h('button', { onclick: () => renderPause('controls') }, h('span', null, '⌨ CONTROLS'), h('span', { class: 'gold' }, '▸')),
      h('button', { onclick: () => renderPause('main') }, h('span', null, '◀ BACK'), h('span'))));
  } else if (pauseView === 'gkfeel') {
    body.appendChild(gkFeelPanel());
    body.appendChild(h('div', { class: 'pauseopts' }, h('button', { onclick: () => renderPause('settings') }, h('span', null, '◀ BACK'), h('span'))));
  } else if (pauseView === 'songs') {
    body.appendChild(h('div', { class: 'gold', style: { fontSize: '10px', margin: '4px 0' } }, 'SONGS'));
    body.appendChild(songsPanel());
    body.appendChild(h('div', { class: 'pauseopts' }, h('button', { onclick: () => renderPause('settings') }, h('span', null, '◀ BACK'), h('span'))));
  } else if (pauseView === 'controls') {
    body.appendChild(h('div', { class: 'ctltitle' }, 'CONTROLS'));
    body.appendChild(controlsSheet());
    body.appendChild(h('div', { class: 'ctlfoot muted' }, 'Change keys from the main menu: SETTINGS → CONTROLS'));
    body.appendChild(h('div', { class: 'pauseopts ctlbtns' }, h('button', { class: 'primary', onclick: () => togglePause() }, h('span', null, '▶ RESUME'), h('span', { class: 'gold' }, Input.label('help'))),
      h('button', { onclick: () => renderPause('main') }, h('span', null, '◀ BACK'), h('span'))));
  }
  markPauseFocus();
}
function pauseButtons() { const ov = $('ovPause'); return [...ov.querySelectorAll(pauseView === 'main' ? '#pauseMain button' : '#pauseBody button')].filter(b => b.offsetParent !== null); }
function markPauseFocus() { const bs = pauseButtons(); bs.forEach((b, i) => b.classList.toggle('kfocus', i === pauseFocus)); }
function pauseKey(c, acts) {
  const bs = pauseButtons(); if (!bs.length) return false;
  if (c === 'ArrowDown' || acts.includes('down')) { pauseFocus = (pauseFocus + 1) % bs.length; markPauseFocus(); return true; }
  if (c === 'ArrowUp' || acts.includes('up')) { pauseFocus = (pauseFocus - 1 + bs.length) % bs.length; markPauseFocus(); return true; }
  if (c === 'Enter' || c === 'Space') { bs[pauseFocus] && bs[pauseFocus].click(); return true; }
  if ((c === 'Escape' || c === 'Backspace') && pauseView !== 'main') { renderPause(pauseView === 'controls' || pauseView === 'songs' ? 'settings' : 'main'); return true; }
  return false;
}
document.addEventListener('DOMContentLoaded', () => {});

// ---------- an upcoming event: timing, format, eligibility, rewards, projected qualifiers and bubble teams
const EVENT_FORMAT = { inv: 'Single elimination, 8 teams', classic: 'Single elimination, 8 teams', winter: 'Single-game semifinals, best-of-three final', finale: 'Single elimination, 4 teams', po: 'Four best-of-five rounds (2-2-1), 16 teams', toc: 'Single-game quarterfinals and semifinals, best-of-three final' };
function eventPreview(save, key) {
  const se = save.season, user = save.userTeamId, info = COMP_INFO[key];
  const idx = CALENDAR.indexOf(key), roundsAway = CALENDAR.slice(se.calIdx, idx).filter(k => /^r\d+$/.test(k)).length;
  const after = CALENDAR.slice(0, idx).filter(k => /^r\d+$/.test(k)).length;
  const pj = compProjection(save, key), th = tourneyTheme(key);
  const prize = key === 'po' ? `Champion ${fmtM(FIN.champ)} + ${fmtM(FIN.poRound)} per series won` : `Winner ${fmtM(FIN.tourWin[key] || 600)} · entry fee ${fmtM(FIN.tourEntry)} per club`;
  const tag = id => h('span', { class: 'chip', style: { padding: '2px 5px', margin: '2px', fontSize: '7px', display: 'inline-block', border: '1px solid ' + (id === user ? '#ffd23f' : '#3b4583'), color: id === user ? '#ffd23f' : teamTextColor(T(id)) } }, T(id).abbr);
  const mandatory = key === 'inv' ? 'Mandatory' : key === 'po' ? 'Mandatory if you qualify' : 'Optional (by invitation when you qualify)';
  let proj;
  if (key === 'po') proj = h('div', null, pj.divs.map(d => h('div', { style: { fontSize: '7px', margin: '3px 0' } }, h('b', null, DIV_NAMES[d.div] + ': '), d.in.map(tag), h('span', { class: 'muted' }, '  bubble: '), d.bubble.map(tag))));
  else proj = h('div', { style: { fontSize: '7px' } }, h('span', { class: 'muted' }, 'Projected: '), pj.in.map(tag), pj.bubble.length ? h('span', null, h('span', { class: 'muted' }, '  bubble: '), pj.bubble.map(tag)) : null);
  const status = key === 'inv' ? 'Your club is in.' : key === 'po' ? (pj.divs.some(d => d.in.includes(user)) ? 'You are currently in a playoff spot.' : 'You are currently outside the playoff spots.')
    : pj.in.includes(user) ? 'You are currently projected to qualify.' : (pj.bubble || []).includes(user) ? 'You are on the bubble.' : 'You are currently outside the qualifying places.';
  return h('div', { class: 'panel', style: { borderColor: th.accent } },
    h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { color: th.accent } }, info.name.toUpperCase()), h('span', { class: 'muted', style: { fontSize: '7px' } }, `${info.month} · after game day ${after}` + (roundsAway ? ` · in ${roundsAway} game day${roundsAway > 1 ? 's' : ''}` : ' · next'))),
    h('div', { class: 'sub', style: { margin: '4px 0' } }, `${EVENT_FORMAT[key]} · ${pj.rule} · ${mandatory}`),
    h('div', { class: 'sub', style: { margin: '4px 0' } }, `Rewards: the ${info.name} trophy · ${prize}`),
    proj, h('div', { class: 'sub ' + (status.includes('outside') ? 'red' : status.includes('bubble') ? 'gold' : 'green'), style: { margin: '6px 0 0' } }, status));
}
// ---------- alignment: current conferences/divisions and each team's history
function alignmentPanel(save) {
  const se = save.season, user = save.userTeamId;
  return h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'CURRENT ALIGNMENT · SEASON ' + se.num),
    h('div', { class: 'grid g2' }, [0, 1].map(c => h('div', null, h('div', { class: 'gold', style: { fontSize: '8px', marginBottom: '4px' } }, CONF_NAMES[c].toUpperCase()),
      [c * 2, c * 2 + 1].map(d => h('div', { style: { fontSize: '7px', lineHeight: 2 } }, h('b', null, DIV_NAMES[d] + ': '), se.divs[d].map(id => h('span', { style: { color: id === user ? '#ffd23f' : teamTextColor(T(id)), marginRight: '6px' } }, T(id).abbr))))))),
    h('div', { class: 'hint' }, 'Divisions are redrawn at random every season; identities, rosters, histories and rivalries carry on.'));
}
function alignmentHistory(save, teamId) {
  const rows = (save.alignHist || []).slice().reverse();
  if (!rows.length) return null;
  return h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'DIVISION HISTORY'),
    h('div', { style: { fontSize: '7px', lineHeight: 2 } }, rows.slice(0, 30).map(r => { const d = r.divOf[teamId]; const mates = Object.keys(r.divOf).filter(id => r.divOf[id] === d && id !== teamId && save.teams[id]); return h('div', null, h('b', null, 'S' + r.s + ' '), DIV_NAMES[d] + ' (' + CONF_NAMES[d < 2 ? 0 : 1].split(' ')[0] + ') with ' + mates.map(id => save.teams[id].abbr).join(', ')); })));
}

// ---------- leadership: exact bonuses, unlock requirements and progress
const STAT_LAB = { pos: 'POS', ref: 'REF', reb: 'REB', rec: 'REC', spd: 'SPD', sta: 'STA', pow: 'PWR', acc: 'ACC', pas: 'PAS', stk: 'DRB', def: 'DEF', chk: 'TKL', fo: 'SP', all: 'ALL', low3: '3 lowest', recover: 'bench recovery', goalie: 'goalie', trailing: 'ALL when trailing', late: 'ALL in 2nd half/ET' };
function styleBonusText(key, mul, pl) {
  const st = LEAD_STYLES[key]; if (!st) return '';
  const nat = pl && hasTrait(pl, 'natural_leader') ? BAL.lead.naturalMul : 1;
  const fmt = o => Object.entries(o).map(([k, v]) => `+${Math.round(v * mul * nat * 10)} ${STAT_LAB[k] || k.toUpperCase()}`).join(', ');
  if (pl && pl.pos === 'G' && typeof goalieMods === 'function') return `Personal (keeper): ${fmt(goalieMods(st.personal))} · Every line when no player leader is on: ${Object.entries(st.aura).map(([k, v]) => { const x = v * mul * nat * BAL.lead.goalieAura * 10; return `+${x < 1 ? x.toFixed(1) : Math.round(x)} ${STAT_LAB[k] || k.toUpperCase()}`; }).join(', ')}` + (nat > 1 ? ' · Natural Leader boost' : '');
  return `Personal: ${fmt(st.personal)} · Linemates: ${fmt(st.aura)}` + (mul < 1 ? ' (alternate: ' + Math.round(mul * 100) + '% strength)' : '') + (nat > 1 ? ' · Natural Leader boost' : '');
}
function leadershipStylesInfo(save, team) {
  const unlocked = new Set((save.unlocks && save.unlocks.styles) || []);
  const req = {}; for (const a of (typeof ACHIEVEMENTS !== 'undefined' ? ACHIEVEMENTS : [])) if (a.reward && a.reward.style) req[a.reward.style] = a;
  const holders = k => rosterSkaters(team).map(id => Pl(id)).filter(p => (p.leadStyles || []).includes(k));
  return h('details', { style: { margin: '6px 0' } }, h('summary', { style: { fontSize: '8px', cursor: 'pointer' } }, 'ALL LEADERSHIP STYLES · UNLOCKS & PROGRESS'),
    Object.entries(LEAD_STYLES).map(([k, st]) => {
      const base = BASE_STYLES.includes(k) || st.gk, fr = st.unlock === 'franchise', pl = st.unlock === 'player';
      const a = req[k], prog = a && a.goal ? ` (${Math.min(a.goal, (save.achProg || {})[a.id] || 0)}/${a.goal})` : '';
      const status = base ? h('span', { class: 'green' }, st.gk ? 'available to keepers' : 'available to players') : fr ? (unlocked.has(k) ? h('span', { class: 'green' }, 'UNLOCKED for your franchise') : h('span', { class: 'gold' }, 'Locked: ' + (a ? a.name + ' — ' + a.desc + prog : 'franchise achievement')))
        : h('span', { class: holders(k).length ? 'green' : 'gold' }, holders(k).length ? 'Earned by ' + holders(k).map(p => p.last).join(', ') : (k === 'legend' ? 'Player distinction: 2 League titles as captain or 2 MVP awards' : 'Player distinction: 400 career games'));
      return h('div', { style: { fontSize: '7px', lineHeight: 1.9, margin: '4px 0' } }, h('b', null, st.name + (st.gk ? ' (G)' : '') + ': '), styleBonusText(k, 1, st.gk ? { pos: 'G' } : null), h('br'), status);
    }));
}
