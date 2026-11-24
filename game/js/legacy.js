'use strict';
// ====================================================================
//  LEGACY: trophy details, player & team history, highlight archive.
//  Everything links to everything; BACK always returns to where you were.
// ====================================================================

// ---------- clips: titles, lists, playback
function clipYear(x) { return x.comp && COMP_INFO[x.comp] ? x.year + COMP_INFO[x.comp].yearOff : x.year; }
function clipTitle(c) {
  const x = c.ctx || {};
  if (x.comp && COMP_INFO[x.comp]) return `${clipYear(x)} ${COMP_INFO[x.comp].name} — ${x.round || ''}`.toUpperCase();
  if (x.type === 'reg') return `${x.seasonLabel || ''} REGULAR SEASON`;
  return x.type === 'quick' ? 'QUICK PLAY' : 'EXHIBITION';
}
function watchClip(c, from) {
  if (!c) return toast('That highlight is no longer in the archive.');
  const back = from || UI.cur, sc = app.scrollTop;
  const th = tourneyTheme(c.ctx && c.ctx.comp ? c.ctx.comp : 'reg');
  app.classList.remove('show');
  if (typeof Music !== 'undefined') Music.duck(true);
  const ok = playReplay(c, { title: clipTitle(c), sub: c.meta.text || CLIP_KIND_NAMES[c.kind], theme: { main: th.main, accent: th.accent, text: th.text },
    onClose: () => { if (typeof Music !== 'undefined') Music.duck(false); go(back); app.scrollTop = sc; } });
  if (!ok) { go(back); toast("This highlight couldn't be played (its data is damaged)."); }
}
const KIND_ICON = { goal: '\uE005', so: '\uE006', save: '\uE007', hit: '\uE008', deke: '\uE009' };
function clipRow(c, extra) {
  const x = c.ctx || {}, th = tourneyTheme(x.comp || 'reg');
  return h('div', { class: 'cliprow' + (c.legendary ? ' legend' : '') },
    h('div', { class: 'clipbadge', style: { background: th.main, borderColor: th.accent } }, (CLIP_KIND_NAMES[c.kind] || c.kind).toUpperCase().split(' ')[0]),
    h('div', { style: { flex: 1, minWidth: 0 } },
      h('div', { style: { color: c.legendary ? 'var(--gold)' : 'var(--ink)' } }, (c.legendary ? '★ LEGENDARY MOMENT · ' : '') + (c.meta.text || CLIP_KIND_NAMES[c.kind])),
      h('div', { class: 'muted', style: { fontSize: '7px', marginTop: '4px' } }, clipTitle(c) + ' · ' + (x.label || '') + ' · ' + ['1ST', '1ST', '2ND'][c.meta.period - 1 >= 0 ? c.meta.period - 1 : 0] + (c.meta.period > 3 ? ' ET' : '') + ' ' + fmtToi(c.meta.clock) + (c.meta.score ? ' · ' + c.meta.score.join('-') : ''))),
    h('button', { class: 'small primary', onclick: () => watchClip(c) }, '▶ WATCH'),
    (() => { const tr = UI.save && UI.cur && !/scrTrophyDetail/.test(String(UI.cur)) ? (UI.save.trophies || []).find(t => (t.clipIds || []).includes(c.id)) : null;
      return tr ? h('button', { class: 'small', title: 'Open the ' + tr.compName + ' trophy', onclick: () => push(() => scrTrophyDetail('team', tr.id)) }, '\uE00A') : null; })(),
    extra || null);
}

// ---------- navigation stack (BACK returns to the previous screen and its scroll position)
function push(render) { UI.stack = UI.stack || []; if (UI.cur) UI.stack.push({ r: UI.cur, sc: app.scrollTop }); go(render); }
function pop(fallback) {
  const prev = (UI.stack || []).pop();
  if (prev) { go(prev.r); app.scrollTop = prev.sc; } else go(fallback || (UI.save ? scrHub : scrMain));
}
const navBack = () => pop();
function teamLink(save, teamId, snap, size = 18) {
  const live = save.teams[teamId];
  const look = snap && snap.colors ? { colors: snap.colors, emblem: snap.emblem || (live && live.emblem), abbr: snap.abbr } : live;
  const name = snap && snap.name ? snap.name : (live ? fullName(live) : teamId);
  return h('a', { class: 'lnk', onclick: () => push(() => scrTeam(teamId)) }, h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } }, look ? badge(look, size) : null, name));
}
function playerLink(pid, label) {
  const p = UI.save.players[pid];
  return p ? h('a', { class: 'lnk', onclick: () => push(() => scrPlayer(pid)) }, label || ('#' + p.num + ' ' + pname(p))) : h('span', null, label || 'Unknown player');
}

// ====================================================================
//  TROPHY DETAIL (team trophies and individual awards)
// ====================================================================
function scrTrophyDetail(kind, id) {
  const save = UI.save;
  if (kind === 'award') return scrAwardDetail(id);
  const t = save.trophies.find(x => x.id === id);
  if (!t) return h('div', { class: 'screen' }, header('TROPHY', navBack), h('div', { class: 'panel sub' }, 'This trophy record could not be found.'));
  const th = tourneyTheme(t.comp), kp = t.keyPlayers || {};
  const moments = trophyMoments(save, t);
  const big = drawTrophyCanvas(t.type, 10, true); big.style.width = '130px';
  const faces = [t.captain, t.mvp, kp.topScorer, kp.goalie].filter(Boolean).filter((x, i, a) => a.findIndex(y => y.pid === x.pid) === i).map(x => save.players[x.pid]).filter(Boolean);
  const yr = t.year + (COMP_INFO[t.comp] ? COMP_INFO[t.comp].yearOff : 0);
  const line = (lab, ...v) => h('div', { class: 'kv' }, h('span', { class: 'muted' }, lab), h('span', null, ...v));
  const snap = (who, label) => who ? line(label, playerLink(who.pid, '#' + who.num + ' ' + who.name), who.abbr ? h('span', { class: 'muted' }, ' · ' + who.abbr) : null, who.stat ? h('span', { class: 'muted' }, ' · ' + who.stat) : null) : null;
  const relatedAwards = save.awards.filter(a => a.season === t.season && (t.comp === 'po' ? a.key === 'pmvp' : false));
  const memBox = h('div');
  // after attaching or removing a clip, redraw the whole page (it stays on MEMORIES): the tab count and the WATCH
  // CHAMPIONSHIP MOMENT box used to keep showing the old state (Barry, Nov 22: "attaching replays doesn't seem to work")
  const refresh = () => { UI.tabMem = UI.tabMem || {}; UI.tabMem.trophydet = 1; go(() => scrTrophyDetail(kind, id)); };
  const renderMem = () => {
    memBox.innerHTML = '';
    const cs = trophyMoments(save, t);
    memBox.appendChild(h('div', { class: 'bar' }, h('h3', { style: { margin: 0 } }, 'CHAMPIONSHIP MEMORIES'), h('div', { class: 'grow' }),
      h('button', { class: 'small', onclick: () => attachDialog(t, refresh) }, '+ ATTACH SAVED HIGHLIGHT')));
    if (!cs.length) memBox.appendChild(h('div', { class: 'sub' }, t.editionId && t.season >= (save.replaysSince || 1) ? 'No highlights are attached to this trophy. Highlights are recorded in games you play (simulated games have none).' : 'This trophy was won before highlights were recorded.'));
    for (const c of cs) memBox.appendChild(clipRow(c, h('button', { class: 'small ghost', title: 'Remove from this trophy (the clip stays in the archive)', onclick: () => { detachClip(save, t.id, c.id); Store.autosave(save); refresh(); toast('Removed from the trophy. The clip is still in your highlight archive.'); } }, 'REMOVE')));
  };
  const watchBox = h('div', { style: { textAlign: 'center', margin: '14px 0' } });
  const renderWatch = () => {
    watchBox.innerHTML = '';
    const m = trophyMoments(save, t)[0];
    if (m) watchBox.appendChild(h('button', { class: 'primary huge', onclick: () => watchClip(m) }, '▶ WATCH CHAMPIONSHIP MOMENT'), h('div', { class: 'sub', style: { marginTop: '8px' } }, m.meta.text || ''));
    else watchBox.appendChild(h('div', { class: 'unavail' }, h('div', null, 'NO CHAMPIONSHIP MOMENT ON FILE'), h('div', { class: 'muted', style: { fontSize: '7px', marginTop: '6px' } }, 'Only games you play are recorded. Attach a saved highlight from this ' + t.compName + ' below if you have one.')));
  };
  renderMem(); renderWatch();
  return h('div', { class: 'screen trophyS' }, header(t.compName.toUpperCase(), navBack),
    tabbed('trophydet', [{ label: 'THE TROPHY', el: () => h('div', null,
    tourneyBannerCanvas({ key: t.comp, tier: 2, title: th.short, round: 'CHAMPIONS', sub: 'SEASON ' + t.seasonLabel }, 760, 80),
    h('div', { class: 'grid two', style: { marginTop: '6px', alignItems: 'start' } },
      h('div', { class: 'panel', style: { textAlign: 'center' } }, big,
        faces.length ? h('div', { class: 'row' }, faces.map(fp => h('span', { style: { cursor: 'pointer' }, title: pname(fp), onclick: () => push(() => scrPlayer(fp.id)) }, portrait(fp, T(t.teamId), 40)))) : null,
        h('div', { class: 'plate' }, h('div', { style: { fontSize: '11px' } }, t.compName.toUpperCase()), h('div', null, t.teamName), h('div', null, `${t.date || ''} · Season ${t.season}`), h('div', { style: { fontSize: '7px', opacity: 0.7 } }, 'Trophy ' + t.id))),
      h('div', { class: 'panel' },
        line('Competition', t.compName), line('Season', `${t.seasonLabel} · ${t.date || yr}`), line('Round', 'Championship Final'),
        line('Winner', teamLink(save, t.teamId, { name: t.teamName, abbr: t.abbr, colors: t.colors, emblem: t.emblem })),
        t.finalOpp ? line('Final opponent', teamLink(save, t.finalOpp.teamId, t.finalOpp)) : null,
        line('Result', t.result || '-'), t.finalScores && t.finalScores.length ? line('Final games', t.finalScores.join(' · ')) : null,
        snap(t.mvp, t.comp === 'po' ? 'Playoff MVP' : 'Tournament MVP'), snap(kp.topScorer, 'Leading scorer'), snap(kp.goalie, 'Top keeper'),
        kp.gwg ? line('Championship-winning goal', playerLink(kp.gwg.pid, '#' + kp.gwg.num + ' ' + kp.gwg.name), h('span', { class: 'muted' }, ' · ' + (kp.gwg.abbr || ''))) : kp.soWin ? line('Decided by', 'Shootout') : null,
        t.captain ? line('Captain', playerLink(t.captain.pid, '#' + t.captain.num + ' ' + t.captain.name + ' (C)')) : null,
        t.qual ? line('Qualified as', t.qual.how === 'champion' ? (t.qual.titles || []).join(' + ') + ' champion' : t.qual.how === 'replacement' ? `Replacement (${ordinal(t.qual.place)} in standings)` : `Wildcard (${ordinal(t.qual.place)} in standings)`) : null,
        relatedAwards.map(a => line(a.name, h('a', { class: 'lnk', onclick: () => push(() => scrAwardDetail(a.id)) }, '#' + a.num + ' ' + a.playerName), h('span', { class: 'muted' }, ' · ' + a.stat)))))) },
    { label: 'MEMORIES (' + moments.length + ')', el: () => h('div', null, watchBox, h('div', { class: 'panel' }, memBox)) }]));
}
function attachDialog(t, after) {
  const save = UI.save;
  const elig = Object.values(save.clips || {}).filter(c => clipEligible(t, c) && !(t.clipIds || []).includes(c.id));
  modal(close => h('div', null, h('h2', null, 'ATTACH A HIGHLIGHT'),
    h('div', { class: 'sub' }, `Only highlights from the ${t.compName} of season ${t.seasonLabel} can be attached to this trophy.`),
    elig.length ? elig.map(c => clipRow(c, h('button', { class: 'small', onclick: () => { const err = attachClip(save, t.id, c.id); if (err) return toast(err); Store.autosave(save); close(); after(); toast('Attached to the trophy.'); } }, 'ATTACH')))
      : h('div', { class: 'panel sub' }, 'No other recorded highlights from this competition are in your archive.'),
    h('div', { class: 'row' }, h('button', { onclick: close }, 'CLOSE'))), true);
}
function scrAwardDetail(id) {
  const save = UI.save, a = save.awards.find(x => x.id === id);
  if (!a) return h('div', { class: 'screen' }, header('AWARD', navBack), h('div', { class: 'panel sub' }, 'Award record not found.'));
  const big = drawTrophyCanvas(a.key, 10, true); big.style.width = '180px';
  const clips = clipsForPlayer(save, a.pid).filter(c => c.ctx && c.ctx.season === a.season);
  const line = (lab, ...v) => h('div', { class: 'kv' }, h('span', { class: 'muted' }, lab), h('span', null, ...v));
  return h('div', { class: 'screen' }, header(a.name.toUpperCase(), navBack),
    h('div', { class: 'grid two', style: { alignItems: 'start' } },
      h('div', { class: 'panel', style: { textAlign: 'center' } }, big, save.players[a.pid] ? h('div', null, portrait(save.players[a.pid], a.teamId ? save.teams[a.teamId] : null, 64, { num: a.num })) : null, h('div', { class: 'plate' }, h('div', { style: { fontSize: '11px' } }, a.name.toUpperCase()), h('div', null, '#' + a.num + ' ' + a.playerName), h('div', null, a.teamName), h('div', null, 'Season ' + a.season + ' · ' + a.seasonLabel))),
      h('div', { class: 'panel' }, line('Award', a.name), line('Season', a.seasonLabel), line('Recipient', playerLink(a.pid, '#' + a.num + ' ' + a.playerName)),
        a.teamId ? line('Team', teamLink(save, a.teamId, { name: a.teamName, abbr: a.abbr, colors: a.colors })) : null, line('Numbers', a.stat), line('Award ID', a.id))),
    h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'HIGHLIGHTS FROM THAT SEASON'), clips.length ? clips.map(c => clipRow(c)) : emptyState('clips', 'No recorded highlights of this player from that season.', '')));
}

// ====================================================================
//  PLAYER HISTORY
// ====================================================================
function playerTeams(save, p) {
  const out = [];
  const add = (tid, s, abbr) => { if (!tid) return; const last = out[out.length - 1]; if (last && last.tid === tid) last.to = s; else out.push({ tid, from: s, to: s, abbr }); };
  for (const s of p.seasons) add(s.teamId, s.s, s.abbr);
  if (p.status === 'active' && p.teamId) add(p.teamId, UI.save.season.num, save.teams[p.teamId].abbr);
  return out;
}
function playerChampionships(save, p) {
  const out = [];
  const lines = p.seasons.map(s => ({ s: s.s, teamId: s.teamId, po: s.po, tour: s.tour }));
  const cur = save.season.stats[p.id];
  if (cur && !save.season.done && p.teamId) lines.push({ s: save.season.num, teamId: p.teamId, po: cur.po, tour: cur.tour });
  for (const t of save.trophies) {
    const l = lines.find(x => x.s === t.season && x.teamId === t.teamId);
    if (l && ((t.comp === 'po' ? l.po : l.tour) || {}).gp > 0) out.push(t);
  }
  return out;
}
function playerMilestones(p) {
  const out = [], tot = { gp: 0, g: 0, a: 0, w: 0 };
  const marks = p.pos === 'G' ? [['gp', [50, 100, 200], 'games played'], ['w', [10, 25, 50, 100], 'wins']] : [['gp', [50, 100, 200, 300], 'games played'], ['g', [10, 25, 50, 100, 200], 'goals'], ['pts', [25, 50, 100, 200, 300], 'points']];
  for (const s of p.seasons) {
    const before = Object.assign({}, tot);
    for (const c of ['reg', 'po', 'tour']) { const l = s[c] || {}; tot.gp += l.gp || 0; tot.g += l.g || 0; tot.a += l.a || 0; tot.w += l.w || 0; }
    for (const [k, list, lab] of marks) for (const m of list) {
      const b = k === 'pts' ? before.g + before.a : before[k], n = k === 'pts' ? tot.g + tot.a : tot[k];
      if (b < m && n >= m) out.push({ s: s.s, year: s.year, text: `${m} career ${lab}` });
    }
  }
  return out;
}
function scrPlayer(pid) {
  const save = UI.save, p = save.players[pid];
  if (!p) return h('div', { class: 'screen' }, header('PLAYER', navBack), h('div', { class: 'panel sub' }, 'Player not found.'));
  const t = p.teamId ? save.teams[p.teamId] : null, lastT = !t && p.lastTeamId ? save.teams[p.lastTeamId] : null;
  let cat = UI.pcat || 'reg';
  const wrap = h('div');
  const render = () => {
    wrap.innerHTML = '';
    const awards = p.awards.map(id => save.awards.find(a => a.id === id)).filter(Boolean);
    const mine = t && t.id === save.userTeamId && p.status === 'active';
    const prev = h('canvas', { width: 96, height: 132, class: 'px' });
    const gk = p.pos === 'G', uni = t || lastT; if (uni) drawUniformPreview(prev, uni, false, true, p.num, { g: gk, pl: p });
    const numIn = h('input', { type: 'number', min: 1, max: 99, value: p.num, style: { width: '70px' }, oninput: () => { const v = +numIn.value; if (t && v >= 1 && v <= 99) drawUniformPreview(prev, t, false, true, v, { g: gk, pl: p }); } });
    const numMsg = h('div', { class: 'sub red', style: { margin: '6px 0 0' } });
    const catRow = c => { const l = fullLine(c === 'life' ? lifetime(p.career) : p.career[c]); return p.pos === 'G'
      ? h('tr', null, h('td', { class: 'l' }, CAT_NAMES[c]), h('td', null, l.gp), h('td', null, l.w), h('td', null, l.sa), h('td', null, l.sv), h('td', null, l.ga), h('td', null, fmtSv(svPct(l))), h('td', null, l.sho), h('td', null, l.hds), h('td', null, l.xga ? ((l.xga / 100 - l.ga) >= 0 ? '+' : '') + (l.xga / 100 - l.ga).toFixed(1) : '-'), h('td', null, fmtToi(l.toi)))
      : h('tr', null, h('td', { class: 'l' }, CAT_NAMES[c]), h('td', null, l.gp), h('td', null, l.g), h('td', null, l.a), h('td', null, l.g + l.a), h('td', null, l.sog), h('td', null, (l.xg / 100).toFixed(1)), h('td', null, l.hd), h('td', null, l.ds), h('td', null, l.tk), h('td', null, l.hit), h('td', null, l.hat), h('td', null, (l.pm > 0 ? '+' : '') + l.pm), h('td', null, fmtToi(l.toi))); };
    const head = p.pos === 'G' ? ['', 'GP', 'W', 'SA', 'SV', 'GA', 'SV%', 'CS', 'HDSV', 'GSAX', 'TOI'] : ['', 'GP', 'G', 'A', 'PTS', 'SOG', 'XG', 'HD', 'DS', 'INT', 'TKL', 'HAT', '+/-', 'TOI'];
    const seasons = p.seasons.slice().reverse();
    const cur = save.season.stats[p.id];
    if (cur && !save.season.done && p.status === 'active') seasons.unshift(Object.assign({ s: save.season.num, year: save.season.year, teamId: p.teamId, abbr: t ? t.abbr : 'FA', num: p.num, live: true, ovr: ovrInt(p) }, cur));
    const teams = playerTeams(save, p), champs = playerChampionships(save, p), miles = playerMilestones(p);
    const clips = clipsForPlayer(save, p.id).sort((a, b) => (b.legendary - a.legendary) || b.imp - a.imp);
    const status = p.status === 'retired' ? `Retired after season ${p.retired}` + (lastT ? ' (last team: ' + lastT.abbr + ')' : '') : p.status === 'free' ? 'Free agent' : 'Active';
    const origin = p.draft ? h('span', null, `Drafted after season ${p.draft.season} by `, teamLink(save, p.draft.teamId, null, 14)) : p.joined === 1 ? 'Original league roster (season 1)' : `Signed in season ${p.joined || '?'}`;
    wrap.appendChild(h('div', null,
      h('div', { class: 'panel pcardtop', style: { display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' } }, portrait(p, t || lastT, 72), prev,
        h('div', { class: 'pinfo', style: { fontSize: '9px', lineHeight: 2.1, flex: 1, minWidth: '240px' } },
          h('div', { class: 'gold', style: { fontSize: '13px' } }, '#' + p.num + ' ' + pname(p).toUpperCase(), ' ', favBtn(p, render), t && leaderOf(t, p.id) ? h('span', { class: 'capbadge' }, leaderOf(t, p.id) === 'C' ? 'CAPTAIN' : 'ALTERNATE') : null),
          h('div', null, posDetail(p) + ' · ' + ARCHETYPES[p.arch].name + ' · Age ' + p.age + (p.pos === 'G' ? ' · Style: ' + ['Calm', 'Balanced', 'Aggressive'][goalieTendency({ pl: p })] : ''),
            h('span', { class: 'muted', 'data-help': p.pos === 'G' && typeof GEAR_OPTS !== 'undefined' ? (() => { const G = gearOf(p); return 'Mask: ' + (GEAR_OPTS.mask[G.mask] || G.mask) + ' · Shin pads: ' + (GEAR_OPTS.pads[G.pads] || G.pads); })() : 'Signature celebration: ' + CELEBRATIONS[lookOf(p).celeb] }, ' ⓘ')),
          typeof motiveOf === 'function' && p.status !== 'retired' ? (() => { const M = motiveInfo(p), md = t && p.status === 'active' ? moodOf(save, p) : null;
            return h('div', { style: { fontSize: '7px' } }, h('span', { class: 'gold' }, 'WANTS: '), h('span', { class: 'chip mot', 'data-help': M.desc }, M.name), md ? h('span', { class: md.v >= 60 ? 'green' : md.v >= 35 ? 'gold' : 'red' }, `  Mood ${md.v}/100 (${md.why})`) : null); })() : null,
          (() => { if (!t || typeof tenureOf !== 'function' || p.status !== 'active') return null; const tn = tenureOf(save, p), li = loyaltyInfo(save, p, t);
            return h('div', { style: { fontSize: '7px' } }, h('span', { class: 'gold' }, 'WITH ' + t.abbr + ': '), `${tn.seasons} season${tn.seasons === 1 ? '' : 's'} · joined at OVR ${tn.from} · now ${ovrInt(p)}${tn.growth ? ' (+' + tn.growth + ')' : ''}${tn.home ? ' · drafted here' : ''}`,
              li.pct ? h('span', { class: 'chip loyal' }, 'HOMETOWN DISCOUNT -' + Math.round(li.pct * 100) + '%') : null); })(),
          h('div', null, t ? teamLink(save, t.id) : null, h('span', { class: 'muted' }, ` ${t ? '· ' : ''}${status} · OVR ${ovrInt(p)} · Potential ${potTxt(p)}`)),
          numMsg),
        h('div', { style: { minWidth: '250px', flex: 1 } }, attrBars(p))),
      // everything below the player card sits in tabs, so the profile never scrolls
      tabbed('profile', [
      mine && typeof moralePanel === 'function' ? { label: 'MOOD & PAY', el: () => moralePanel(save, p, render) } : null,
      typeof devPanel === 'function' && p.status === 'active' ? { label: 'DEVELOPMENT', el: () => h('div', { class: 'grid two', style: { alignItems: 'start' } }, typeof devFocusPanel === 'function' ? devFocusPanel(p, render) : null, devPanel(p, render)) } : null,
      { label: 'CAREER', el: () =>
      h('div', { class: 'grid pcareer', style: { alignItems: 'start', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.6fr)' } },
        h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'CAREER HISTORY'),
          h('div', { class: 'kv' }, h('span', { class: 'muted' }, 'Origin'), h('span', null, origin)),
          h('div', { class: 'kv' }, h('span', { class: 'muted' }, 'Teams'), h('span', null, teams.length ? teams.map((x, i) => h('span', null, i ? ' → ' : '', h('a', { class: 'lnk', onclick: () => push(() => scrTeam(x.tid)) }, x.abbr || x.tid), h('span', { class: 'muted' }, ` (S${x.from}${x.to !== x.from ? '-' + x.to : ''})`))) : '-')),
          p.status === 'retired' ? h('div', { class: 'kv' }, h('span', { class: 'muted' }, 'Retired'), h('span', null, `After season ${p.retired}, age ${p.age}`)) : null,
          h('div', { class: 'kv' }, h('span', { class: 'muted' }, 'Championships'), h('span', null, champs.length ? champs.map((x, i) => h('span', null, i ? ', ' : '', h('a', { class: 'lnk', onclick: () => push(() => scrTrophyDetail('team', x.id)) }, x.compName + ' ' + x.seasonLabel))) : 'None yet')),
          h('div', { class: 'kv' }, h('span', { class: 'muted' }, 'Awards'), h('span', null, awards.length ? awards.map((a, i) => h('span', null, i ? ', ' : '', h('a', { class: 'lnk', onclick: () => push(() => scrAwardDetail(a.id)) }, a.name + ' ' + a.seasonLabel))) : 'None yet')),
          (p.allStar || []).length ? h('div', { class: 'kv' }, h('span', { class: 'muted' }, 'All-Star'), h('span', null, p.allStar.map((x, i) => h('span', { class: x.team === 1 ? 'gold' : '' }, (i ? ', ' : '') + (x.team === 1 ? '★ 1st Team ' : '☆ 2nd Team ') + (SIDE_OF[x.pos] ? posShort(x.pos) : x.pos) + ' ' + seasonLabel(x.year).slice(-5))))) : null,
          h('div', { class: 'kv' }, h('span', { class: 'muted' }, 'Milestones'), h('span', null, miles.length ? miles.map(m => m.text + ' (S' + m.s + ')').join(', ') : 'None yet'))),
        h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'CAREER TOTALS'),
          h('table', null, h('tr', null, head.map((x, i) => h('th', { class: i ? '' : 'l' }, x))), ['reg', 'po', 'tour', 'exh', 'life'].map(catRow)))) },
      { label: 'SEASONS', el: () =>
      h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'SEASON BY SEASON'),
        h('div', { class: 'tabs' }, ['reg', 'po', 'tour', 'exh'].map(c => h('button', { class: 'small' + (c === cat ? ' sel' : ''), onclick: () => { cat = UI.pcat = c; render(); } }, CAT_NAMES[c].toUpperCase()))),
        h('div', { class: 'scroll', style: { maxHeight: 'none' } }, h('table', null, h('tr', null, ['SEASON', 'TEAM', '#', 'OVR'].concat(head.slice(1)).map((x, i) => h('th', { class: i < 2 ? 'l' : '' }, x))),
          seasons.map(s => { const l = fullLine(s[cat]); return h('tr', null, h('td', { class: 'l' }, seasonLabel(s.year) + (s.live ? ' *' : '')),
            h('td', { class: 'l' }, s.teamId && save.teams[s.teamId] ? h('a', { class: 'lnk', onclick: () => push(() => scrTeam(s.teamId)) }, s.abbr) : s.abbr, s.cap ? h('span', { class: 'capbadge' }, s.cap) : null), h('td', null, s.num), h('td', null, s.ovr != null ? s.ovr : '-'),
            ...(p.pos === 'G' ? [l.gp, l.w, l.sa, l.sv, l.ga, fmtSv(svPct(l)), l.sho, l.hds, l.xga ? (l.xga / 100 - l.ga).toFixed(1) : '-', fmtToi(l.toi)] : [l.gp, l.g, l.a, l.g + l.a, l.sog, (l.xg / 100).toFixed(1), l.hd, l.ds, l.tk, l.hit, l.hat, (l.pm > 0 ? '+' : '') + l.pm, fmtToi(l.toi)]).map(v => h('td', null, v))); }))),
        h('div', { class: 'hint' }, '* = season in progress. OVR is the rating at the end of each season.')) },
      { label: 'PERFORMANCE', el: () => performanceHistory(p) },
      p.status === 'active' && (mine || typeof profileBusiness === 'function') ? { label: 'FAME & DEALS', el: () => h('div', { class: 'grid two', style: { alignItems: 'start' } }, typeof spotlightPanel === 'function' ? spotlightPanel(save, p, render) : null, typeof profileBusiness === 'function' ? profileBusiness(p) : null) } : null,
      { label: 'CLIPS (' + clips.length + ')', el: () => h('div', { class: 'panel' }, clips.length ? pages('pclips', clips.slice(0, 30), 8, sl => h('div', null, sl.map(c => clipRow(c)))) : emptyState('clips', 'No recorded highlights yet. Clips come from games you play.', '')) }])));
  };
  render();
  // the jersey number sits in the title bar (your players only)
  const pp = save.players[pid], numBox = pp && pp.teamId === save.userTeamId && pp.status === 'active' ? (() => {
    const inp = h('input', { type: 'number', min: 1, max: 99, value: pp.num, style: { width: '56px' } });
    return h('span', { class: 'pnumrow' }, h('span', { class: 'muted' }, 'JERSEY # '), inp, ' ', h('button', { class: 'small', onclick: () => { const err = setNumber(save, pp.id, inp.value); if (err) { toast(err); inp.value = pp.num; } else { Store.autosave(save); toast('#' + pp.num + ' it is.'); go(() => scrPlayer(pid)); } } }, 'SAVE')); })() : null;
  const relBox = pp && pp.teamId === save.userTeamId && pp.status === 'active' && typeof releaseBtn === 'function' ? releaseBtn(save, T(save.userTeamId), pp, () => go(scrHub)) : null;
  // where he is in the club: farm team / injured reserve
  const where = pp && pp.teamId && save.teams[pp.teamId] ? (farmIds(save.teams[pp.teamId]).includes(pp.id) ? 'FARM TEAM' : irIds(save.teams[pp.teamId]).includes(pp.id) ? 'INJURED RESERVE' : null) : null;
  return h('div', { class: 'screen wide profileS' }, header('PLAYER PROFILE', navBack, 'BACK', where ? h('span', { class: 'chip' }, where) : null, numBox, relBox), wrap);
}

function performanceHistory(p) {
  const save = UI.save;
  const sh = p.starsHist || [], cnt = [1, 2, 3].map(r => sh.filter(x => x.r === r).length);
  const best = p.best || [], hats = p.hats || [], ms = (save.milestones || []).filter(m => m.pid === p.id);
  const capSeasons = p.seasons.filter(s => s.cap).map(s => `${s.cap === 'C' ? 'Captain' : 'Alternate'} ${seasonLabel(s.year)} (${s.abbr})`);
  const cur = p.teamId && leaderOf(T(p.teamId), p.id); if (cur && p.status === 'active') capSeasons.push(`${cur === 'C' ? 'Captain' : 'Alternate'} ${seasonLabel(save.season.year)} (current)`);
  const capTitles = (p.capTitles || []).map(id => save.trophies.find(t => t.id === id)).filter(Boolean);
  const tAwards = p.awards.map(id => save.awards.find(a => a.id === id)).filter(a => a && a.comp);
  const oppAbbr = b => b.opp && T(b.opp) ? T(b.opp).abbr : '';
  const gameRow = b => h('div', { class: 'hotrow', onclick: () => gameDetail(p, b) }, h('span', { class: 'gold', style: { width: '64px' } }, 'S' + b.s), h('div', { style: { flex: 1 } }, `${b.label} vs ${oppAbbr(b)} · ${b.stat}`, h('div', { class: 'muted', style: { fontSize: 'calc(6px * var(--ts, 1.2))', marginTop: '3px' } }, b.why)), h('span', null, '▸'));
  // form: last eight games, as a simple bar per game
  const form = (p.form || []).slice(-8);
  const bars = h('div', { class: 'formbars', title: 'Recent games (Game Impact)' }, form.map(f => h('i', { style: { height: Math.max(3, Math.min(40, f.imp * 1.6 + 3)) + 'px', background: f.imp >= 15 ? '#ffd23f' : f.imp >= 6 ? '#5ee07a' : '#6aa2ff' }, title: `S${f.s}: ${f.g}G ${f.a}A` })));
  return h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'PERFORMANCE HISTORY'),
    h('div', { class: 'two grid', style: { alignItems: 'start' } },
      h('div', null,
        h('div', { class: 'kv' }, h('span', { class: 'muted' }, 'Three Stars'), h('span', null, `★★★ ${cnt[0]} · ★★ ${cnt[1]} · ★ ${cnt[2]}`)),
        h('div', { class: 'kv' }, h('span', { class: 'muted' }, 'Hat tricks'), h('span', null, hats.length ? hats.map(x => `S${x.s} ${x.label} (${x.g} G)`).join(', ') : 'None yet')),
        h('div', { class: 'kv' }, h('span', { class: 'muted' }, 'Milestones'), h('span', null, ms.length ? ms.map(m => `${m.text} (S${m.s})`).join(', ') : 'None recorded yet')),
        h('div', { class: 'kv' }, h('span', { class: 'muted' }, 'Leadership'), h('span', null, capSeasons.length ? capSeasons.join(', ') : 'No letter yet')),
        capTitles.length ? h('div', { class: 'kv' }, h('span', { class: 'muted' }, 'Titles as captain'), h('span', null, capTitles.map((t, i) => h('span', null, i ? ', ' : '', h('a', { class: 'lnk', onclick: () => push(() => scrTrophyDetail('team', t.id)) }, t.compName + ' ' + t.seasonLabel))))) : null,
        tAwards.length ? h('div', { class: 'kv' }, h('span', { class: 'muted' }, 'Tournament awards'), h('span', null, tAwards.map((a, i) => h('span', null, i ? ', ' : '', h('a', { class: 'lnk', onclick: () => push(() => scrAwardDetail(a.id)) }, a.name + ' ' + a.seasonLabel))))) : null,
        form.length ? h('div', { class: 'kv' }, h('span', { class: 'muted' }, 'Recent form'), bars) : null),
      h('div', null, h('div', { class: 'grouplab', style: { marginTop: 0 } }, 'STANDOUT GAMES'), best.length ? best.slice(0, 4).map(b => { const r = gameRow(b); r.title = `${b.label} vs ${oppAbbr(b)} · ${b.stat}`; return r; }) : h('div', { class: 'sub' }, 'No standout games recorded yet.'),
        null)));
}
// a noteworthy game: the line, why it stood out, and any recorded clip from it
function gameDetail(p, b) {
  const save = UI.save, clips = Object.values(save.clips || {}).filter(c => c.ctx && c.ctx.gameId === b.gid && c.ctx.season === b.s && ((c.meta.players || []).includes(p.id)));
  modal(close => h('div', null, h('h2', null, `${b.label.toUpperCase()} · SEASON ${b.s}`),
    h('div', { class: 'sub', style: { fontSize: '9px' } }, `#${p.num} ${pname(p)} vs ${T(b.opp) ? fullName(T(b.opp)) : ''}`),
    h('div', { class: 'panel' }, h('div', { class: 'kv' }, h('span', { class: 'muted' }, 'Line'), h('span', null, b.stat)), h('div', { class: 'kv' }, h('span', { class: 'muted' }, 'Why it stood out'), h('span', null, b.why)),
      b.score ? h('div', { class: 'kv' }, h('span', { class: 'muted' }, 'Final'), h('span', null, `${T(b.away) ? T(b.away).abbr : ''} ${b.score[1]} @ ${T(b.home) ? T(b.home).abbr : ''} ${b.score[0]}`)) : null),
    clips.length ? clips.map(c => clipRow(c)) : h('div', { class: 'sub' }, 'No recorded highlight from this game (simulated games are not recorded).'),
    h('div', { class: 'row' }, h('button', { onclick: close }, 'CLOSE'))), true);
}
// ====================================================================
//  TEAM HISTORY
// ====================================================================
function teamSeasonRows(save, tid) {
  const rows = [];
  for (const hs of save.history) {
    const st = hs.standings.find(x => x.teamId === tid); if (!st) continue;
    const place = hs.standings.indexOf(st) + 1;
    let po = 'Missed playoffs';
    if (hs.playoffs) {
      const rds = hs.playoffs.rounds, n = hs.playoffs.nr || rds.length;
      const reach = hs.playoffs.reach ? hs.playoffs.reach[tid] : (() => { let m = -1; rds.forEach((r, i) => { if (r.some(sr => sr.hi.teamId === tid || sr.lo.teamId === tid)) m = i; }); return m < 0 ? undefined : m; })();
      const names = n === 4 ? ['Lost in the first round', 'Lost in the quarterfinals', 'Lost in the semifinals', 'Lost the final'] : n === 2 ? ['Lost semifinal', 'Lost final'] : [];
      if (hs.playoffs.champion.teamId === tid) po = 'Champion'; else if (reach != null) po = names[reach] || 'Playoffs';
    }
    const tours = TOUR_KEYS.filter(k => hs.tournaments[k] && hs.tournaments[k].champion.teamId === tid).map(k => COMP_INFO[k].name);
    rows.push({ season: hs.season, label: hs.label, place, st, po, tours, identity: { name: st.name || fullName(save.teams[tid]), abbr: st.abbr, colors: st.colors || save.teams[tid].colors, emblem: st.emblem || save.teams[tid].emblem } });
  }
  return rows;
}
function scrTeam(tid) {
  const save = UI.save, t = save.teams[tid];
  if (!t) return h('div', { class: 'screen' }, header('TEAM', navBack), h('div', { class: 'panel sub' }, 'Team not found.'));
  const rows = teamSeasonRows(save, tid);
  const cur = save.season.standings[tid];
  const all = { gp: 0, w: 0, l: 0, otl: 0, gf: 0, ga: 0 };
  for (const r of rows) for (const k in all) all[k] += r.st[k];
  if (cur && !save.season.done) for (const k in all) all[k] += cur[k];
  const trophies = save.trophies.filter(x => x.teamId === tid);
  let apps = 0, finals = 0;
  for (const hs of save.history) for (const c of [hs.playoffs].concat(TOUR_KEYS.map(k => hs.tournaments[k]))) {
    if (!c || !c.rounds) continue;
    if (c.rounds.some(r => r.some(sr => sr.hi.teamId === tid || sr.lo.teamId === tid))) apps++;
    const fin = c.rounds[c.rounds.length - 1][0]; if (fin && (fin.hi.teamId === tid || fin.lo.teamId === tid)) finals++;
  }
  const poApps = rows.filter(r => r.po !== 'Missed playoffs').length;
  // identities used over the years (trophies and highlights keep the original look)
  const idents = [];
  for (const r of rows) { const k = r.identity.name + '|' + JSON.stringify(r.identity.colors); const last = idents[idents.length - 1]; if (last && last.k === k) last.to = r.season; else idents.push({ k, from: r.season, to: r.season, id: r.identity }); }
  // notable players: points (or goalie wins) while wearing this team's sweater
  const agg = {};
  for (const p of Object.values(save.players)) {
    const lines = p.seasons.filter(s => s.teamId === tid).map(s => s);
    const cur2 = save.season.stats[p.id];
    if (p.teamId === tid && cur2 && !save.season.done) lines.push(cur2);
    if (!lines.length) continue;
    const a = { pid: p.id, gp: 0, g: 0, a: 0, w: 0, seasons: lines.length };
    for (const s of lines) for (const c of ['reg', 'po', 'tour']) { const l = s[c] || {}; a.gp += l.gp || 0; a.g += l.g || 0; a.a += l.a || 0; a.w += l.w || 0; }
    agg[p.id] = a;
  }
  const sk = Object.values(agg).filter(a => save.players[a.pid].pos !== 'G').sort((a, b) => (b.g + b.a) - (a.g + a.a)).slice(0, 8);
  const gk = Object.values(agg).filter(a => save.players[a.pid].pos === 'G').sort((a, b) => b.w - a.w).slice(0, 3);
  // rivalries: championship finals against each opponent
  const riv = {};
  for (const x of save.trophies) {
    if (!x.finalOpp) continue;
    if (x.teamId === tid) (riv[x.finalOpp.teamId] = riv[x.finalOpp.teamId] || { w: 0, l: 0 }).w++;
    else if (x.finalOpp.teamId === tid) (riv[x.teamId] = riv[x.teamId] || { w: 0, l: 0 }).l++;
  }
  const F = UI.teamHl = UI.teamHl && UI.teamHl.tid === tid ? UI.teamHl : { tid, season: 'all', comp: 'all', kind: 'all', pid: 'all' };
  const hlBox = h('div');
  const renderHl = () => {
    hlBox.innerHTML = '';
    const clips = clipsForTeam(save, tid);
    const seasons = [...new Set(clips.map(c => c.ctx.season))].sort((a, b) => b - a);
    const pids = [...new Set(clips.flatMap(c => (c.meta.players || []).filter(id => save.players[id] && save.players[id].seasons.concat([{ teamId: save.players[id].teamId }]).some(s => s.teamId === tid))))];
    const sel = (val, opts, set) => h('select', { onchange: e => { set(e.target.value); renderHl(); } }, opts.map(([v, l]) => h('option', { value: v, selected: String(v) === String(val) }, l)));
    hlBox.appendChild(h('div', { class: 'row', style: { justifyContent: 'flex-start' } },
      sel(F.season, [['all', 'All seasons']].concat(seasons.map(s => [s, 'Season ' + s])), v => F.season = v),
      sel(F.comp, [['all', 'All competitions'], ['reg', 'Regular season'], ['exh', 'Exhibition']].concat(Object.keys(COMP_INFO).map(k => [k, COMP_INFO[k].name])), v => F.comp = v),
      sel(F.kind, [['all', 'All events']].concat(Object.entries(CLIP_KIND_NAMES)), v => F.kind = v),
      sel(F.pid, [['all', 'All players']].concat(pids.map(id => [id, pname(save.players[id])])), v => F.pid = v)));
    const list = clips.filter(c => (F.season === 'all' || String(c.ctx.season) === String(F.season)) && (F.comp === 'all' || (c.ctx.comp || c.ctx.type) === F.comp) && (F.kind === 'all' || c.kind === F.kind) && (F.pid === 'all' || (c.meta.players || []).includes(F.pid)))
      .sort((a, b) => (b.legendary - a.legendary) || (b.ctx.season - a.ctx.season) || b.imp - a.imp);
    hlBox.appendChild(list.length ? h('div', null, list.slice(0, 40).map(c => clipRow(c))) : h('div', { class: 'sub' }, 'No archived highlights match.'));
  };
  renderHl();
  const trs = [];
  if (cur && !save.season.done) trs.push(h('tr', { class: 'me' }, h('td', { class: 'l' }, seasonLabel(save.season.year) + ' *'), h('td', { class: 'l' }, t.abbr), h('td', null, ordinal(sortedStandings(save).indexOf(tid) + 1)),
    h('td', null, cur.gp), h('td', null, cur.w), h('td', null, cur.otl), h('td', null, cur.l), h('td', null, cur.pts), h('td', null, cur.gf), h('td', null, cur.ga), h('td', { class: 'l' }, 'In progress'),
    h('td', { class: 'l' }, save.trophies.filter(x => x.teamId === tid && x.season === save.season.num && x.comp !== 'po').map(x => x.compName).join(', ') || '-')));
  for (const r of rows.slice().reverse()) trs.push(h('tr', null, h('td', { class: 'l' }, r.label), h('td', { class: 'l' }, r.identity.abbr), h('td', null, ordinal(r.place)),
    h('td', null, r.st.gp), h('td', null, r.st.w), h('td', null, r.st.otl), h('td', null, r.st.l), h('td', null, r.st.pts), h('td', null, r.st.gf), h('td', null, r.st.ga),
    h('td', { class: 'l' + (r.po === 'Champion' ? ' gold' : '') }, r.po), h('td', { class: 'l' }, r.tours.join(', ') || '-')));
  const seasonTable = trs.length ? h('div', { class: 'scroll', style: { maxHeight: 'none' } }, h('table', null,
    h('tr', null, ['SEASON', 'AS', 'PLACE', 'GP', 'W', 'D', 'L', 'PTS', 'GF', 'GA', 'PLAYOFFS', 'TOURNAMENTS WON'].map((x, i) => h('th', { class: i < 2 || i > 9 ? 'l' : '' }, x))), trs)) : h('div', { class: 'sub' }, 'No seasons yet.');
  const swatch = c => h('span', { class: 'sw', style: { background: c, cursor: 'default' } });
  const notOurs = tid !== save.userTeamId && save.season && save.season.standings && save.season.standings[tid];
  return h('div', { class: 'screen wide teamS' }, header('TEAM HISTORY', navBack, 'BACK', notOurs ? h('button', { onclick: () => scoutReport(save, t) }, 'SCOUTING REPORT') : null),
    h('div', { class: 'panel', style: { display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' } }, badge(t, 48),
      h('div', { style: { fontSize: '9px', lineHeight: 2.1, flex: 1 } },
        h('div', { style: { fontSize: '13px', color: teamTextColor(t) } }, fullName(t).toUpperCase()),
        h('div', null, swatch(t.colors.p), swatch(t.colors.s), swatch(t.colors.a), h('span', { class: 'muted' }, '  ' + ((JERSEY_STYLES.find(j => j.id === t.style) || { name: t.style }).name) + ' jerseys')),
        h('div', { class: 'muted' }, tid === save.userTeamId ? 'Your franchise' : 'League team', ' · ', `All-time ${all.w}-${all.otl}-${all.l} · GF ${all.gf} · GA ${all.ga}`)),
      h('div', { style: { fontSize: '8px', lineHeight: 2.1 } },
        h('div', null, h('span', { class: 'gold' }, trophies.length), ' trophies'), h('div', null, h('span', { class: 'gold' }, trophies.filter(x => x.comp === 'po').length), ' league championships'),
        h('div', null, h('span', { class: 'gold' }, poApps), ' playoff appearances'), h('div', null, h('span', { class: 'gold' }, apps), ' tournament/playoff entries · ', finals, ' finals'))),
    tabbed('teampage', [{ label: 'OVERVIEW', el: () => h('div', null,
    typeof alignmentHistory === 'function' ? alignmentHistory(save, tid) : null,
    idents.length > 1 ? h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'IDENTITIES OVER THE YEARS'),
      idents.map(x => h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', fontSize: '8px', margin: '4px 0' } }, badge(x.id, 18), x.id.name, h('span', { class: 'muted' }, ` seasons ${x.from}-${x.to}`)))) : null,
) },
    { label: 'CHAMPIONSHIPS (' + trophies.length + ')', el: () =>
      h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'CHAMPIONSHIPS'),
        trophies.length ? trophies.slice().reverse().map(x => h('div', { class: 'teamcard', style: { marginBottom: '6px' }, onclick: () => push(() => scrTrophyDetail('team', x.id)) },
          drawTrophyCanvas(x.type, 2, false), h('div', null, h('div', { class: 'gold' }, x.compName), h('div', { class: 'muted' }, x.seasonLabel + ' · ' + x.result)))) : h('div', { class: 'sub' }, 'No championships yet.')) },
    { label: 'PLAYERS', el: () =>
      h('div', { class: 'panel tplayers' }, h('h3', { style: { marginTop: 0 } }, 'NOTABLE PLAYERS'),
        sk.length || gk.length ? h('table', null, h('tr', null, h('th', { class: 'l' }, 'PLAYER'), h('th', null, 'SEASONS'), h('th', null, 'GP'), h('th', null, 'G'), h('th', null, 'A'), h('th', null, 'PTS / W')),
          sk.concat(gk).map(a => { const p = save.players[a.pid]; return h('tr', null, h('td', { class: 'l' }, playerLink(a.pid), p.status === 'retired' ? h('span', { class: 'muted' }, ' (R)') : null), h('td', null, a.seasons), h('td', null, a.gp), h('td', null, p.pos === 'G' ? '-' : a.g), h('td', null, p.pos === 'G' ? '-' : a.a), h('td', { class: 'gold' }, p.pos === 'G' ? a.w + ' W' : a.g + a.a)); })) : h('div', { class: 'sub' }, 'Finish a season to build a history.'),
        (t.capHist || []).length ? h('div', null, h('h3', null, 'CAPTAINS'), t.capHist.slice().reverse().slice(0, 8).map(ch => h('div', { style: { fontSize: '8px', lineHeight: 2 } }, 'S' + ch.s + ' · ', ch.c && save.players[ch.c] ? playerLink(ch.c, pname(save.players[ch.c]) + ' (C)') : '-', ch.a.filter(Boolean).map(a => save.players[a] ? h('span', null, ', ', playerLink(a, pname(save.players[a]) + ' (A)')) : null)))) : null,
        Object.keys(riv).length ? h('div', null, h('h3', null, 'FINALS RIVALRIES'), Object.entries(riv).map(([oid, r]) => h('div', { style: { fontSize: '8px', lineHeight: 2 } }, teamLink(save, oid, null, 14), h('span', { class: 'muted' }, ` · finals won ${r.w}, lost ${r.l}`)))) : null) },
    { label: 'SEASONS', el: () => h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'SEASON BY SEASON'), seasonTable) },
    { label: 'HIGHLIGHTS', el: () => h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'TEAM HIGHLIGHTS'), hlBox) }]));
}

// ====================================================================
//  HIGHLIGHT ARCHIVE (League History tab)
// ====================================================================
function highlightArchive() {
  const save = UI.save, box = h('div');
  const F = UI.archF = UI.archF || { kind: 'all', comp: 'all' };
  const render = () => {
    box.innerHTML = '';
    const clips = Object.values(save.clips || {});
    const used = clips.reduce((a, c) => a + (c.frames ? c.frames.d.length : 0), 0);
    box.appendChild(h('div', { class: 'row', style: { justifyContent: 'flex-start' } },
      h('select', { onchange: e => { F.kind = e.target.value; render(); } }, [['all', 'All events']].concat(Object.entries(CLIP_KIND_NAMES)).map(([v, l]) => h('option', { value: v, selected: v === F.kind }, l))),
      h('select', { onchange: e => { F.comp = e.target.value; render(); } }, [['all', 'All competitions'], ['reg', 'Regular season'], ['exh', 'Exhibition']].concat(Object.keys(COMP_INFO).map(k => [k, COMP_INFO[k].name])).map(([v, l]) => h('option', { value: v, selected: v === F.comp }, l))),
      h('span', { class: 'muted', style: { fontSize: '7px' } }, `${clips.length} clips · ${Math.round(used / 1024)} KB · automatic clips beyond ${CLIP_AUTO_CAP} are recycled (kept, legendary and trophy clips never are)`)));
    const list = clips.filter(c => (F.kind === 'all' || c.kind === F.kind) && (F.comp === 'all' || (c.ctx.comp || c.ctx.type) === F.comp))
      .sort((a, b) => (b.legendary - a.legendary) || (b.ctx.season - a.ctx.season) || (b.created - a.created));
    if (!list.length) box.appendChild(h('div', { class: 'panel sub' }, 'No highlights yet. Goals, big saves, big tackles and feints from games you play are recorded automatically.'));
    for (const c of list.slice(0, 80)) {
      const pinned = clipPinned(save, c), tr = save.trophies.filter(t => (t.clipIds || []).includes(c.id));
      box.appendChild(clipRow(c, h('span', { style: { display: 'flex', gap: '6px' } },
        c.auto ? h('button', { class: 'small', title: 'Keep forever (never recycled)', onclick: () => { c.auto = false; Store.autosave(save); render(); } }, '★ KEEP') : (!c.legendary && !tr.length ? h('button', { class: 'small ghost', title: 'Let it be recycled', onclick: () => { c.auto = true; Store.autosave(save); render(); } }, 'UNKEEP') : null),
        h('button', { class: 'small danger', onclick: () => confirmDlg(`Delete this clip from the archive?${tr.length ? ' It is attached to ' + tr.length + ' trophy record(s); the trophies stay, the link is removed.' : ''} This can't be undone.`, 'DELETE CLIP', () => { deleteClip(save, c.id); Store.autosave(save); render(); }, true) }, 'DELETE'))));
    }
  };
  render();
  return box;
}
