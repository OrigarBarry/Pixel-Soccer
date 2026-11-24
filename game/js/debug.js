'use strict';
// ====================================================================
//  HIDDEN DEBUG MODE (Settings: click the version line five times)
//  Edits are validated; anything that changes gameplay or progression marks the franchise as debug-modified,
//  which keeps it from unlocking account-wide cosmetics and flags achievements/memorabilia earned there as TEST.
// ====================================================================
const DBG = { on: false, taps: 0, fps: 0, lastErr: null };
try { DBG.on = localStorage.getItem('psph98-debug') === '1'; const b = JSON.parse(localStorage.getItem('psph98-bal') || 'null'); if (DBG.on && b) for (const k in b) if (BAL[k] && typeof b[k] === 'object') Object.assign(BAL[k], b[k]); else if (k in BAL) BAL[k] = b[k]; } catch (e) {}
addEventListener('error', e => { DBG.lastErr = (e.message || '') + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno; });
{ let n = 0, t0 = performance.now(); const tick = () => { n++; const t = performance.now(); if (t - t0 >= 1000) { DBG.fps = n; n = 0; t0 = t; } requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
function versionLine() {
  return h('div', { class: 'hint', style: { cursor: 'default', userSelect: 'none' }, onclick: () => {
    if (++DBG.taps >= 5) { DBG.taps = 0; DBG.on = !DBG.on; try { localStorage.setItem('psph98-debug', DBG.on ? '1' : '0'); } catch (e) {} toast(DBG.on ? 'Debug mode enabled.' : 'Debug mode disabled.'); go(scrSettings); }
  } }, `PIXEL SOCCER · VERSION ${GAME_VERSION} · SAVE FORMAT ${SAVE_VERSION}` + (DBG.on ? ' · DEBUG' : ''));
}
function markDebug(save, what) {
  if (!save) return;
  save.debug = save.debug || { modified: true, at: Date.now(), edits: 0, log: [] };
  save.debug.modified = true; save.debug.edits++; save.debug.log.push(what); if (save.debug.log.length > 30) save.debug.log.shift();
}
const numIn = (val, min, max, step, on) => h('input', { type: 'number', value: val, min, max, step: step || 1, style: { width: '64px' }, onchange: e => { const v = +e.target.value; if (!isFinite(v) || v < min || v > max) { toast(`Must be ${min} to ${max}.`); e.target.value = val; return; } on(v); } });
function dbgEnable() { if (!DBG.on) { DBG.on = true; try { localStorage.setItem('psph98-debug', '1'); } catch (e) {} } }
function dbgOpen() { dbgEnable(); go(scrDebug); }
function scrDebug() {
  if (!DBG.on) return scrSettings();
  let tab = UI.dbgTab || 'diag';
  const body = h('div'), tabs = h('div', { class: 'tabs' });
  const save = UI.save;
  const render = () => {
    UI.dbgTab = tab; tabs.innerHTML = ''; body.innerHTML = '';
    for (const k of ['diag', 'balance', 'player', 'team', 'match', 'showcase', 'franchise', 'business', 'scenarios', 'unlocks', 'achievements']) tabs.appendChild(h('button', { class: k === tab ? 'sel' : '', onclick: () => { tab = k; render(); } }, k.toUpperCase()));
    const needSave = () => body.appendChild(h('div', { class: 'panel sub' }, 'Open a franchise first (Season Mode), then come back here.'));
    if (tab === 'diag') {
      const js = save ? serializeSave(save) : '';
      body.appendChild(h('div', { class: 'panel', style: { fontSize: '8px', lineHeight: 2 } },
        h('div', null, `Storage: ${Store.mode || '?'} · last error: ${Store.lastError ? String(Store.lastError).slice(0, 120) : 'none'} · page error: ${DBG.lastErr || 'none'}`),
        h('div', null, `Frame rate: ${DBG.fps} fps · players in memory: ${save ? Object.keys(save.players).length : 0}`),
        save ? h('div', null, `Save: ${save.name} · ${Math.round(js.length / 1024)} KB · season ${save.season.num} · ${save.debug && save.debug.modified ? 'DEBUG-MODIFIED (' + save.debug.edits + ' edits)' : 'clean'}`) : null,
        save ? h('div', null, 'Validation: ' + (validateSave(save).slice(0, 4).join('; ') || 'OK')) : null,
        h('div', null, dbgProfileLine()),
        save && typeof deskCohost === 'function' ? h('div', null, `Broadcast desk today: ${deskCohost(save).name} with Barry · suit "${deskSuit(save).name}" · desk day ${deskDay(save)}${DBG.deskHost || DBG.deskSuit != null ? ' (DEBUG OVERRIDE)' : ''}`) : null,
        save ? h('div', { class: 'muted' }, 'Sections: ' + Object.entries(saveSectionSizes(save)).map(([k, v]) => k + ' ' + Math.round(v / 1024) + 'KB').join(' · ')) : null));
      if (save) body.appendChild(h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'SIMULATION REPORT'), h('button', { onclick: e => { e.target.parentNode.appendChild(h('pre', { style: { fontSize: '7px' } }, simReport(save, 120))); } }, 'SIMULATE 120 GAMES (NOTHING IS SAVED)')));
    } else if (tab === 'balance') {
      const box = h('div', { class: 'panel' }, h('div', { class: 'sub' }, 'Central balance values (data.js BAL). Changes apply immediately and are kept in this browser. Editing them marks the open franchise as debug-modified.'));
      for (const [g, obj] of Object.entries(BAL)) {
        if (typeof obj !== 'object') { box.appendChild(h('div', { style: { fontSize: '8px', margin: '4px 0' } }, g + ' ', numIn(obj, 0, 100, 'any', v => { BAL[g] = v; balChanged(); }))); continue; }
        box.appendChild(h('div', { style: { fontSize: '8px', margin: '8px 0 2px' }, class: 'gold' }, g.toUpperCase()));
        box.appendChild(h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px' } }, Object.entries(obj).map(([k, v]) => typeof v === 'number'
          ? h('label', { style: { fontSize: '7px' } }, k + ' ', numIn(v, 0, 1000, 'any', nv => { obj[k] = nv; balChanged(); }))
          : Array.isArray(v) ? h('label', { style: { fontSize: '7px' } }, k + ' ', h('input', { type: 'text', value: JSON.stringify(v), style: { width: '80px' }, onchange: e => { try { const a = JSON.parse(e.target.value); if (!Array.isArray(a) || a.some(x => typeof x !== 'number')) throw 0; obj[k] = a; balChanged(); } catch (err) { toast('Expected a list of numbers, like [10,30].'); } } })) : null)));
      }
      box.appendChild(h('div', { class: 'row' }, h('button', { class: 'danger', onclick: () => { resetBalance(); try { localStorage.removeItem('psph98-bal'); } catch (e) {} toast('Balance reset to defaults.'); render(); } }, 'RESET TO DEFAULTS')));
      body.appendChild(box);
    } else if (tab === 'player') {
      if (!save) return needSave();
      const tid = UI.dbgTeam || save.userTeamId, t = save.teams[tid];
      const sel = h('select', { onchange: e => { UI.dbgTeam = e.target.value; UI.dbgPid = null; render(); } }, save.teamOrder.map(id => h('option', { value: id, selected: id === tid }, fullName(save.teams[id]))));
      const ids = rosterIds(t), pid = UI.dbgPid && ids.includes(UI.dbgPid) ? UI.dbgPid : ids[0], p = P(save, pid);
      const psel = h('select', { onchange: e => { UI.dbgPid = e.target.value; render(); } }, ids.map(id => { const x = P(save, id); return h('option', { value: id, selected: id === pid }, `${posTag(x)} #${x.num} ${x.first} ${x.last} (${ovrInt(x)})`); }));
      const edit = (what, fn) => { fn(); markDebug(save, what + ' ' + p.id); const errs = validateSave(save); if (errs.length) toast('Validation: ' + errs[0]); Store.autosave(save); render(); };
      const keys = p.pos === 'G' ? G_ATTRS : SK_ATTRS;
      body.appendChild(h('div', { class: 'panel' }, h('div', { class: 'row' }, sel, psel),
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '7px', marginTop: '8px' } },
          keys.map(([k, nm]) => h('label', null, nm + ' ', numIn(r100(p.attrs[k]), 10, 100, 10, v => edit('attr', () => { p.attrs[k] = Math.round(v / 10); })))),
          h('label', null, 'AGE ', numIn(p.age, 16, 45, 1, v => edit('age', () => { p.age = v; }))),
          h('label', null, 'POTENTIAL ', numIn(pot100(p), 10, 100, 10, v => edit('pot', () => { p.pot = Math.round(v / 10); }))),
          p.pos !== 'G' ? h('label', null, 'POSITION ', h('select', { onchange: e => edit('pos', () => { p.spos = e.target.value; }) }, NAT_POS.map(k => h('option', { value: k, selected: p.spos === k }, k)))) : null,
          p.pos !== 'G' ? h('label', null, 'SHOOTS ', h('select', { onchange: e => edit('hand', () => { p.hand = e.target.value; }) }, ['L', 'R'].map(k => h('option', { value: k, selected: p.hand === k }, k)))) : null,
          h('label', null, 'CONDITION ', numIn(Math.round(p.cond ?? 100), 0, 100, 1, v => edit('cond', () => { p.cond = v; }))),
          h('label', null, 'INJURED GAMES ', numIn(p.inj ? p.inj.g : 0, 0, 4, 1, v => edit('injury', () => {
            if (v > 0 && p.pos !== 'G' && healthySkaters(save, t, p.id) < BAL.minSkaters) { toast('Would leave fewer than six healthy players.'); return; }
            p.inj = v > 0 ? { g: v, kind: 'debug', s: save.season.num } : null; }))),
          h('label', null, 'JERSEY # ', numIn(p.num, 0, 99, 1, v => edit('num', () => { const err = setNumber(save, p.id, v); if (err) toast(err); })))),
        h('div', { class: 'gold', style: { fontSize: '7px', margin: '10px 0 4px' } }, `TRAITS (max ${BAL.trait.max}; incompatible ones are greyed out)`),
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } }, Object.entries(TRAITS).filter(([id]) => traitFits(p, id)).map(([id, tr]) => {
          const has = (p.traits || []).includes(id), ok = has || canAddTrait(p, id);
          return h('button', { class: 'small' + (has ? ' primary' : ''), disabled: !ok, title: tr.desc, onclick: () => edit('trait', () => { p.traits = has ? p.traits.filter(x => x !== id) : (p.traits || []).concat(id); }) }, tr.icon + ' ' + tr.name);
        })),
        p.pos !== 'G' ? h('div', { class: 'row', style: { marginTop: '10px' } }, ['c', 'a0', 'a1'].map(r => h('button', { class: 'small', onclick: () => edit('leader', () => { const err = setLeader(save, t, r, p.id); if (err) toast(err); }) }, 'MAKE ' + (r === 'c' ? 'CAPTAIN' : 'ALTERNATE ' + r[1])))) : null,
        h('div', { class: 'row' }, h('button', { class: 'small', onclick: () => edit('develop', () => { develop(save, p, save.season.stats[p.id] ? lifetime(save.season.stats[p.id]) : emptyLine()); toast('One season of development applied.'); }) }, 'RUN ONE SEASON OF DEVELOPMENT'),
          h('button', { class: 'small', onclick: () => { p.devS = null; markDebug(save, 'dev reset'); Store.autosave(save); toast('Development session available again.'); } }, 'RESET DEV SESSION'))));
    } else if (tab === 'team') {
      if (!save) return needSave();
      const tid = UI.dbgTeam || save.userTeamId, t = save.teams[tid];
      body.appendChild(h('div', { class: 'panel' }, h('select', { onchange: e => { UI.dbgTeam = e.target.value; render(); } }, save.teamOrder.map(id => h('option', { value: id, selected: id === tid }, fullName(save.teams[id])))),
        h('div', { style: { fontSize: '8px', lineHeight: 2, marginTop: '8px' } }, `Strength ${teamStrength(save, tid).toFixed(2)} · ${rosterSkaters(t).length} players · ${rosterGoalies(t).length} keepers · healthy players ${healthySkaters(save, t)} · AI strategy: ${(t.ai || {}).strat || '-'}`),
        h('div', { style: { fontSize: '7px', lineHeight: 2 } }, t.roster.lines.map((l, i) => 'L' + (i + 1) + ': ' + l.map(id => id ? P(save, id).last : '-').join(', ')).join(' | ') + ' | RES: ' + t.roster.reserves.map(id => id ? P(save, id).last : '-').join(', ') + ' | G: ' + t.roster.goalies.map(id => id ? P(save, id).last : '-').join(', ')),
        h('div', { class: 'row' }, h('button', { class: 'small', onclick: () => { autoArrange(save, t); markDebug(save, 'arrange ' + tid); Store.autosave(save); render(); } }, 'AUTO-ARRANGE LINES'),
          h('button', { class: 'small', onclick: () => { autoLeaders(save, t); markDebug(save, 'leaders ' + tid); Store.autosave(save); render(); } }, 'AUTO LEADERS'),
          t.ai ? h('select', { onchange: e => { t.ai.strat = e.target.value; markDebug(save, 'strat ' + tid); Store.autosave(save); render(); } }, ['contend', 'balanced', 'youth'].map(k => h('option', { value: k, selected: t.ai.strat === k }, 'AI: ' + k))) : null,
          h('button', { class: 'small', onclick: () => { const e = validateSave(save); toast(e.length ? e.slice(0, 2).join('; ') : 'Roster constraints OK.'); } }, 'VALIDATE'))));
    } else if (tab === 'match') {
      body.appendChild(h('div', { class: 'panel', style: { fontSize: '8px', lineHeight: 2 } },
        h('div', { class: 'sub' }, `In a game, press the ${'`'} key (backquote) to open the match debug panel: score, clock, real goals, penalties (incl. stacking in the box), power plays, keeper pulls, rolling subs, half-time/aliens, injuries, scuffles, speed and a state readout. For arena, light-show, broadcast-desk and alien testing, see the SHOWCASE tab.`),
        h('label', null, 'HALF LENGTH (seconds) ', numIn(S.periodLen, 20, 600, 1, v => { S.periodLen = v; saveSettings(); toast('Half length set.'); }))));
    } else if (tab === 'franchise') {
      if (!save) return needSave();
      const out = h('pre', { style: { fontSize: '7px', whiteSpace: 'pre-wrap' } });
      const act = (lab, fn) => h('button', { class: 'small', onclick: () => { try { const r = fn(); markDebug(save, lab); Store.autosave(save); out.textContent = r || 'Done.'; } catch (e) { out.textContent = 'Error: ' + e.message; } } }, lab);
      const simDays = n => { let k = 0; for (; k < n; k++) { const d = currentDay(save); if (d.key === 'end' || d.invite) break; simDay(save, true); } return k; };
      body.appendChild(h('div', { class: 'panel' }, h('div', { class: 'row' },
        act('SIM 1 DAY', () => 'Simulated ' + simDays(1) + ' day.'),
        act('SIM 10 DAYS', () => 'Simulated ' + simDays(10) + ' days.'),
        act('SIM TO SEASON END', () => { let n = 0; for (let i = 0; i < 400; i++) { const d = currentDay(save); if (d.key === 'end') break; if (d.invite) { setChoice(save.season, d.key, 'accept'); continue; } simDay(save, true); n++; } return n + ' days simulated. Open the hub to finish the season.'; }),
        act('FINISH SEASON + AUTO DRAFT', () => { if (currentDay(save).key !== 'end') return 'The season is not over yet.'; finishSeason(save); let g = 0; while (save.off && g++ < 12) { if (save.off.phase === 'draft') rdAutoAll(save); if (advanceOffseason(save) === 'start') break; } return 'Now season ' + save.season.num + '.'; }),
        act('+3 PTS TO MY TEAM', () => { save.season.standings[save.userTeamId].pts += 3; return 'Standings edited.'; }),
        act('RETIREMENT WATCH', () => Object.values(save.players).filter(p => p.status === 'active' && p.age >= 33).sort((a, b) => b.age - a.age).slice(0, 30).map(p => `${p.first} ${p.last} ${p.age}y OVR ${ovrInt(p)} ${save.teams[p.teamId] ? save.teams[p.teamId].abbr : ''}`).join('\n')),
        act('TEST INAUGURAL DRAFT (SANDBOX)', () => { const t0 = performance.now(), s2 = newFranchise({ name: 'sandbox', teamId: save.userTeamId }); draft0AutoAll(s2); const bad = s2.teamOrder.filter(id => rosterSkaters(s2.teams[id]).length !== 12 || rosterGoalies(s2.teams[id]).length !== 3); return `Sandbox draft: ${Math.round(performance.now() - t0)} ms, rosters invalid: ${bad.length}, validation: ${validateSave(s2).join('; ') || 'OK'}`; })),
        out, h('div', { class: 'hint' }, 'Every action here marks this franchise as debug-modified.')));
    } else if (tab === 'showcase') { dbgShowTab(body, render);
    } else if (tab === 'business') { dbgBizTab(body, render);
    } else if (tab === 'scenarios') { dbgScenTab(body);
    } else if (tab === 'unlocks') { dbgUnlocksTab(body, render);
    } else if (tab === 'achievements') {
      if (!save) return needSave();
      body.appendChild(h('div', { class: 'panel' }, h('div', { class: 'sub' }, 'Test unlocks are recorded as TEST: they never reach your account-wide cosmetics and are labelled in the cabinet.'),
        ACHIEVEMENTS.map(a => { const r = save.ach[a.id]; return h('div', { class: 'achrow' + (r && r.done ? ' done' : '') }, h('span', { style: { flex: 1, fontSize: '8px' } }, a.name + (r && r.test ? ' (TEST)' : r && r.done ? ' (earned)' : '')),
          !r ? h('button', { class: 'small', onclick: () => { markDebug(save, 'ach ' + a.id); save.ach[a.id] = { done: true, at: Date.now(), s: save.season.num, test: true }; if (a.reward && a.reward.style && !save.unlocks.styles.includes(a.reward.style)) save.unlocks.styles.push(a.reward.style); if (a.reward && a.reward.memo) addMemorabilia(save, a, {}); notify(save, { kind: 'ach', ach: a.id, test: true }); Store.autosave(save); render(); } }, 'GRANT (TEST)') : null,
          r && r.test ? h('button', { class: 'small', onclick: () => { delete save.ach[a.id]; save.memorabilia = save.memorabilia.filter(m => !(m.ach === a.id && m.test)); if (a.reward && a.reward.style && !Object.entries(save.ach).some(([id, x]) => x.done && ACH_BY_ID[id] && ACH_BY_ID[id].reward && ACH_BY_ID[id].reward.style === a.reward.style)) save.unlocks.styles = save.unlocks.styles.filter(s => s !== a.reward.style); Store.autosave(save); render(); } }, 'REVOKE') : null); })));
    }
  };
  render();
  return h('div', { class: 'screen' }, header('DEBUG MODE', () => go(scrSettings)), tabs, body);
}
function balChanged() { try { localStorage.setItem('psph98-bal', JSON.stringify(BAL)); } catch (e) {} if (UI.save) markDebug(UI.save, 'balance'); }
function saveSectionSizes(save) { try { const sec = splitSave(save); return Object.fromEntries(Object.entries(sec).map(([k, v]) => [k, v.length])); } catch (e) { return {}; } }
// quick statistical report from the simulator on a throwaway copy
function simReport(save, n) {
  const copy = hydrateSave(migrateSave(JSON.parse(serializeSave(save)))), ids = copy.teamOrder;
  const a = { g: 0, sog: 0, ppo: 0, ppg: 0, eng: 0, fights: 0, inj: 0, ot: 0, so: 0, toiG: 0 };
  for (let i = 0; i < n; i++) {
    const h0 = ids[i % 24], a0 = ids[(i * 5 + 7) % 24] === h0 ? ids[(i + 1) % 24] : ids[(i * 5 + 7) % 24];
    const r = simGame(copy, { id: 'dbg' + i, home: h0, away: a0, type: 'reg' });
    a.g += r.hs + r.as; a.ot += r.ot ? 1 : 0; a.so += r.so ? 1 : 0; a.inj += r.injuries.length;
    for (const t of Object.values(r.tstats)) { a.ppo += t.ppo; a.ppg += t.ppg; a.eng += t.eng; a.fights += t.fights / 2; }
    for (const l of r.stats) { a.sog += l.sog || 0; if (copy.players[l.pid] && copy.players[l.pid].pos === 'G') a.toiG += l.toi || 0; }
  }
  return `${n} simulated games\ngoals/game ${(a.g / n).toFixed(2)} · shots/game ${(a.sog / n).toFixed(1)} · ET ${(a.ot / n * 100).toFixed(0)}% · SO ${(a.so / n * 100).toFixed(0)}%\npower plays/game ${(a.ppo / n).toFixed(2)} · PP% ${(a.ppg / Math.max(1, a.ppo) * 100).toFixed(1)} · empty-net goals/game ${(a.eng / n).toFixed(2)}\nfights/game ${(a.fights / n).toFixed(2)} · multi-game injuries/game ${(a.inj / n).toFixed(3)} · keeper TOI/game ${(a.toiG / n / 2).toFixed(0)}s each`;
}
// ---------- in-game debug panel (backquote key)
function toggleMatchDebug() {
  let el = $('dbgMatch');
  if (el) { const s = $('dbgShow'); if (s) s.remove(); el.remove(); return; }
  if (!DBG.on) return;
  el = h('div', { id: 'dbgMatch' });
  document.body.appendChild(el);
  const btn = (lab, fn) => h('button', { class: 'small', onclick: e => { e.stopPropagation(); try { fn(); } catch (err) { toast(err.message); } if (UI.save && S.match && S.match.season) markDebug(UI.save, 'match: ' + lab); draw(); cvs.focus(); } }, lab);
  const draw = () => {
    el.innerHTML = '';
    const r = RS();
    el.appendChild(h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' } },
      h('span', { class: 'gold' }, 'MATCH DEBUG'),
      h('span', null,
        h('button', { class: 'small', onclick: e => { e.stopPropagation(); el.classList.add('hidden'); if (!$('dbgShow')) { const s = h('button', { id: 'dbgShow', class: 'small', onclick: ev => { ev.stopPropagation(); el.classList.remove('hidden'); s.remove(); } }, '\uE002 SHOW DEBUG'); document.body.appendChild(s); } } }, '▾ HIDE MENU'),
        h('button', { class: 'small danger', onclick: e => { e.stopPropagation(); const s = $('dbgShow'); if (s) s.remove(); el.remove(); } }, '✕ CLOSE MENU'))));
    el.appendChild(h('div', { class: 'row' }, btn('+1 US', () => { S.score[0]++; }), btn('+1 THEM', () => { S.score[1]++; }), btn('CLOCK 0:15', () => { S.clock = 15; }), btn('END HALF', () => { S.clock = 0.05; }), btn('2ND HALF', () => { S.period = 3; setEnds(); S.clock = Math.min(S.clock, S.periodLen); })));
    el.appendChild(h('div', { class: 'row' }, btn('PENALTY US', () => { const p = teamSkaters(0).find(x => x.pl); startTimed(0, p.pl, 'trip'); const d = nearestDot(puck.x, puck.y); setupFaceoff(d.x, d.y); }),
      btn('PENALTY THEM', () => { const p = teamSkaters(1).find(x => x.pl); startTimed(1, p.pl, 'trip'); const d = nearestDot(puck.x, puck.y); setupFaceoff(d.x, d.y); }),
      btn('EXPIRE PENALTIES', () => { for (const t of [0, 1]) while (r.pens[t].length) penEnd(t, 'time'); applyManpower(S.phase === 'live'); }),
      btn('PENALTY KICK US', () => setupPenaltyShot(0, teamSkaters(0)[0]))));
    el.appendChild(h('div', { class: 'row' }, btn('PULL/RETURN THEIR G', () => { pullGoalie(1, !r.pulled[1]); }), btn('INJURE ONE OF THEIRS', () => { const o = teamSkaters(1).find(x => x.pl); const v = BAL.inj.bigHit; BAL.inj.bigHit = 1; maybeInjure(o, 'hit'); BAL.inj.bigHit = v; }),
      btn('SCUFFLE NOW', () => { const a = ctrl && !ctrl.g ? ctrl : teamSkaters(0)[0], b = teamSkaters(1).find(x => x.pl); if (S.phase === 'live' || S.phase === 'faceoff' || S.phase === 'whistle') startFight(a, b); }),
      btn('AI CHALLENGES ME', () => { const ch = aiChallenger(1, ctrl) || teamSkaters(1)[0]; offerFight(ch, ctrl && !ctrl.g ? ctrl : teamSkaters(0)[0]); }),
      btn('SPEED', () => { S.speed = cyc(SPEEDS, S.speed); })));
    el.appendChild(h('div', { class: 'row' },
      btn('GIVE US THE BALL', () => { const p = ctrl && !ctrl.g ? ctrl : teamSkaters(0)[0]; puck.owner = p; puck.lastTouch = p; puck.z = 0; S.phase = 'live'; }),
      btn('GIVE THEM THE BALL', () => { const p = teamSkaters(1)[0]; puck.owner = p; puck.lastTouch = p; puck.z = 0; S.phase = 'live'; }),
      btn('LOOSE BALL AT CENTRE', () => { resetPuck(CX, CY); S.phase = 'live'; }),
      btn('ME TO THEIR SLOT', () => { const p = ctrl && !ctrl.g ? ctrl : teamSkaters(0)[0]; const gy = goalies[1 - p.team] ? goalies[1 - p.team].y : oppGoalY(p.team); p.x = CX; p.y = gy + (gy < CY ? 50 : -50); p.vx = p.vy = 0; }),
      btn('THEIR G: TIRED', () => { const g = goalies[1]; if (g && g.pl && MS) MS.stam[g.pl.id] = 15; }),
      btn('THEIR G: FRESH', () => { const g = goalies[1]; if (g && g.pl && MS) MS.stam[g.pl.id] = 100; }),
      btn('THEIR G OUT OF POSITION', () => { const g = goalies[1]; if (g) { g.x = CX + 30; } }),
      S.scen ? btn('RESET TEST MATCH', () => { const k = S.scen.kind; SCN_T.stats = { kind: k, reps: 0, goals: 0, saves: 0, fo: 0, foWon: 0, tips: 0, labels: {} }; S.score = [0, 0]; scenSetup(); }) : null));
    if (typeof dbgMatchExtras === 'function') dbgMatchExtras(el, btn, r);
    el.appendChild(h('pre', { style: { fontSize: '6px', whiteSpace: 'pre-wrap', margin: '4px 0 0' } }, r ? `phase ${S.phase} · ${strengthLabel()} · clock ${S.clock.toFixed(1)} · elapsed ${r.el.toFixed(0)}s · speed ${S.speed}\npenalties ${JSON.stringify(r.pens.map(q => q.map(p => '#' + p.num + ' ' + p.left.toFixed(0))))} · pulled ${r.pulled} · out ${Object.keys(r.out).filter(id => outInfo(id)).length} · box ${Object.keys(r.box).length}\nfights ${r.fights.n} · morale ${r.morale.map(a => a.reduce((x, m) => x + m.v, 0).toFixed(2))} · fps ${DBG.fps} · collisions/s ${DBG.collPerSec || 0}` + (typeof aiStateText === 'function' ? '\n' + aiStateText() : '') + (typeof scenHud === 'function' && S.scen ? '\n' + scenHud() : '') : 'No match state.'));
  };
  draw();
  el._t = setInterval(() => { if (!document.body.contains(el)) return clearInterval(el._t); if (S.screen !== 'play' && S.screen !== 'paused') { clearInterval(el._t); el.remove(); return; } draw(); }, 1000);
}
addEventListener('keydown', e => { if (e.code === 'Backquote' && DBG.on && (S.screen === 'play' || S.screen === 'paused')) toggleMatchDebug(); });
