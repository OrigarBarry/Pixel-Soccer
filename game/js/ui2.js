'use strict';
// ====================================================================
//  UI 2: inaugural draft, division standings, traits & condition, development, leadership,
//  achievements & legacy cabinet, notices, decline alternatives, debug mode
// ====================================================================
const posTag = p => p.pos === 'G' ? 'G' : p.spos ? posShort(p.spos) : 'F';
function traitChips(p, big) {
  const tr = p.traits || []; if (!tr.length) return null;
  return h('div', { class: 'traits' }, tr.map(id => { const t = TRAITS[id]; return t ? h('span', { class: 'trait r' + t.rarity + (big ? ' big' : ''), 'data-help': t.name.toUpperCase() + ': ' + t.desc }, t.icon + ' ' + (big ? t.name : t.name.split(' ')[0])) : null; }));
}
function condTag(p) {
  const b = condBand(p.cond), inj = p.inj && p.inj.g > 0;
  return h('div', { style: { fontSize: '7px', marginTop: '2px' } },
    h('span', { class: b[0] === 'Fresh' ? 'green' : b[0] === 'Ready' ? '' : b[0] === 'Tired' ? 'gold' : 'red' }, b[0].toUpperCase() + ' ' + Math.round(p.cond ?? 100)),
    inj ? h('span', { class: 'red' }, ` · INJURED (${p.inj.kind}, ${p.inj.g} game${p.inj.g === 1 ? '' : 's'})`) : null);
}

// ---------- declining an optional tournament: pick what the team does instead
function chooseAlternative(k, cname, after) {
  const save = UI.save, se = save.season;
  modal(close => h('div', null, h('h2', null, 'DECLINE THE ' + cname.toUpperCase() + '?'),
    h('div', { class: 'sub', style: { fontSize: '8px' } }, after + ' Use the days off instead:'),
    Object.entries(ALT_CHOICES).map(([kind, label]) => h('button', { class: 'tile', style: { width: '100%', margin: '4px 0', textAlign: 'left' }, onclick: () => {
      setChoice(se, k, 'decline'); const r = applyAlternative(save, k, kind); Store.autosave(save); close(); toast(r.text, 5000); go(scrHub);
    } }, h('div', null, label.toUpperCase()), h('div', { class: 'tsub' }, kind === 'devcamp' ? (typeof DEV_CAMP_TEXT !== 'undefined' ? DEV_CAMP_TEXT.replace('Development camp: ', '') : '') : kind === 'rest' ? `Everyone recovers +${BAL.cond.rest} condition.` : kind === 'train_cond' ? 'Condition +10 and a chance at +1 Stamina or Speed (once per player per season).' : `A chance at +1 in ${TRAIN_ATTRS[kind].map(a => SK_ATTRS.find(x => x[0] === a)[1]).join(' / ')} for players below their potential (once per player per season).`))),
    h('div', { class: 'row' }, h('button', { onclick: close }, 'KEEP THE INVITATION'))));
}

// ---------- standings: divisions, conferences, league
function scrStandings() {
  const save = UI.save, se = save.season;
  let view = UI.stView || 'div';
  const body = h('div'), tabs = h('div', { class: 'tabs' });
  const render = () => {
    UI.stView = view; tabs.innerHTML = ''; body.innerHTML = ''; body.className = view === 'div' || view === 'conf' ? 'stgrid' : '';
    for (const [k, lab] of [['div', 'DIVISIONS'], ['conf', 'CONFERENCES'], ['league', 'LEAGUE'], ['align', 'ALIGNMENT']]) tabs.appendChild(h('button', { class: k === view ? 'sel' : '', onclick: () => { view = k; render(); } }, lab));
    const rowsOf = ids => ids.map(id => Object.assign({ teamId: id }, se.standings[id]));
    const cf = UI.stConf || 0;
    if (view === 'div') tabs.appendChild(h('span', { class: 'grow' })), [0, 1].forEach(c => tabs.appendChild(h('button', { class: 'small' + (cf === c ? ' sel' : ''), onclick: () => { UI.stConf = c; render(); } }, CONF_NAMES[c].toUpperCase())));
    if (view === 'div') for (let d = cf * 2; d < cf * 2 + 2; d++) body.appendChild(h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, DIV_NAMES[d].toUpperCase()), standingsTable(save, rowsOf(divStandings(save, d)), { line: true, link: true })));
    else if (view === 'conf') for (let c = 0; c < 2; c++) body.appendChild(h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, CONF_NAMES[c].toUpperCase()), standingsTable(save, rowsOf(confStandings(save, c)), { link: true })));
    else if (view === 'align') { body.appendChild(alignmentPanel(save)); const ah = alignmentHistory(save, save.userTeamId); if (ah) body.appendChild(ah); }
    else body.appendChild(pages('stleague', rowsOf(sortedStandings(save)), 12, list => h('div', { class: 'panel' }, standingsTable(save, list, { link: true, offset: list.length ? sortedStandings(save).indexOf(list[0].teamId) : 0 }))));
    body.appendChild(h('div', { class: 'hint', style: { gridColumn: '1 / -1', margin: '2px 0 0' } }, 'Win = 3 pts · draw = 1 pt · top four in each division (above the dashed line) make the playoffs.'));
  };
  render();
  return h('div', { class: 'screen wide standingsS' }, header('STANDINGS ' + seasonLabel(se.year), () => go(scrHub)), tabs, body);
}

// ---------- the Inaugural League Draft
// ---------- player development (one session per player per season) and trait history; used in profiles
function devPanel(p, rerender) {
  const save = UI.save;
  if (!p || p.status !== 'active') return null;
  const mine = p.teamId === save.userTeamId, avail = mine && devAvailable(save, p);
  const box = h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'TRAITS & DEVELOPMENT'));
  const tr = p.traits || [];
  if (!tr.length) box.appendChild(h('div', { class: 'muted', style: { fontSize: '8px' } }, 'No traits yet. Players can earn them through their careers, big moments and development.'));
  for (const id of tr) {
    const t = TRAITS[id];
    box.appendChild(h('div', { class: 'traitrow' }, h('span', { class: 'trait big r' + t.rarity }, t.icon + ' ' + t.name), h('span', { class: 'muted trdesc', style: { fontSize: '7px', flex: 1 }, 'data-help': t.desc }, t.desc),
      avail ? h('button', { class: 'small', onclick: () => confirmDlg(`Work ${t.name} out of his game? (Uses this season's development session.)`, 'REMOVE', () => { const r = devAction(save, p.id, id, 'remove'); toast(r.error || r.text, 4000); Store.autosave(save); rerender(); }) }, 'REMOVE') : null,
      avail ? h('button', { class: 'small', onclick: () => confirmDlg(`Try to turn ${t.name} into a different trait? About ${Math.round(BAL.trait.reroll * 100)}% chance it changes; otherwise he keeps it. (Uses this season's development session.)`, 'REROLL', () => { const r = devAction(save, p.id, id, 'reroll'); toast(r.error || r.text, 5000); Store.autosave(save); rerender(); }) }, 'REROLL') : null));
  }
  box.appendChild(h('div', { class: 'hint', 'data-help': `Max ${BAL.trait.max} traits. The outcome is fixed for this season: reloading won't change it.` }, mine ? (avail ? `One trait session per player per season.` : 'Development session already used this season.') : 'Traits of players on other teams.'));
  if ((p.traitLog || []).length) box.appendChild(h('div', { class: 'muted', style: { fontSize: '7px', lineHeight: 2 } }, p.traitLog.slice(-6).map(x => h('div', null, `S${x.s}: ${x.removed ? 'lost' : 'gained'} ${TRAITS[x.id] ? TRAITS[x.id].name : x.id} (${x.why})`))));
  if ((p.leadStyles || []).length) box.appendChild(h('div', { class: 'gold', style: { fontSize: '8px', marginTop: '6px' } }, 'LEADERSHIP DISTINCTION: ' + p.leadStyles.map(s => LEAD_STYLES[s].name).join(', ')));
  if ((p.injHist || []).length) box.appendChild(h('div', { class: 'muted', style: { fontSize: '7px', marginTop: '6px' } }, 'Injury history: ' + p.injHist.map(x => `S${x.s} ${x.kind} (${x.g} game${x.g === 1 ? '' : 's'})`).join(' · ')));
  box.appendChild(condTag(p));
  return box;
}

// ---------- notices: legacy items, achievements, traits, distinctions
function showNotices() {
  const save = UI.save; if (!save || !(save.notices || []).length || document.querySelector('.modal')) return;
  // (Nov 23) WHILE YOU WERE AWAY: everything since the last look in one card, sorted. Big moments first, then sponsor
  // offers (one row per player, newest offer only: a new offer replaces the old one), then the rest of the club news.
  const list = save.notices.splice(0, save.notices.length); Store.autosave(save);
  const isOffer = n => n.kind === 'offer' || (typeof n.text === 'string' && n.text.startsWith('SPONSOR OFFER:'));
  const legacy = list.filter(n => n.kind === 'legacy');
  const big = list.filter(n => ['ach', 'trait', 'distinction', 'unlock'].includes(n.kind) || n.s2);
  const offers = [], seen = new Map();
  for (const n of list.filter(isOffer)) { const k = n.pid || String(n.text).replace(/\(.*$/, '').split(' wants ')[1] || n.text; seen.set(k, n); }
  for (const n of seen.values()) { const p = n.pid && typeof Pl === 'function' ? Pl(n.pid) : null;   // only offers still open (they expire)
    if (!n.pid || (p && p.spon && p.spon.offer && p.teamId === save.userTeamId)) offers.push(n); }
  const other = list.filter(n => !legacy.includes(n) && !big.includes(n) && !isOffer(n) && n.text);
  const row = n => h('div', { style: { fontSize: '9px', lineHeight: 2, margin: '6px 0' } },
    n.kind === 'ach' ? ['★ ACHIEVEMENT: ', h('span', { class: 'gold' }, (ACH_BY_ID[n.ach] || {}).name), n.test ? ' (test)' : '', h('div', { class: 'muted', style: { fontSize: '7px' } }, (ACH_BY_ID[n.ach] || {}).desc)]
      : n.kind === 'trait' ? ['✚ NEW TRAIT: ', h('span', { class: 'gold' }, (Pl(n.pid) ? Pl(n.pid).first + ' ' + Pl(n.pid).last : '') + ' — ' + (TRAITS[n.trait] || {}).name), h('div', { class: 'muted', style: { fontSize: '7px' } }, n.why || '')]
        : n.kind === 'distinction' ? ['♛ LEADERSHIP DISTINCTION: ', h('span', { class: 'gold' }, (Pl(n.pid) ? Pl(n.pid).last : '') + ' — ' + (LEAD_STYLES[n.style] || {}).name)]
          : n.text || '');
  const head = t => h('div', { class: 'muted', style: { fontSize: '7px', letterSpacing: '1px', margin: '10px 0 2px', borderBottom: '1px solid #ffffff22', paddingBottom: '3px' } }, t);
  const MAXO = 6, MAXN = 8;
  const offerRow = n => { const t = String(n.text).replace(/^SPONSOR OFFER:\s*/, '').replace(/\.\s*See his profile\.?$/, '');
    return h('div', { style: { fontSize: '8px', lineHeight: 1.9 } }, '• ' + t); };
  const many = list.length >= 3;
  modal(close => h('div', null,
    many ? h('h2', { class: 'gold', style: { margin: '0 0 4px' } }, 'WHILE YOU WERE AWAY') : null,
    legacy.map(n => { const it = save.memorabilia.find(m => m.id === n.memo); return it ? h('div', { class: 'legacynote' }, h('div', { class: 'muted', style: { fontSize: '8px' } }, 'LEGACY ITEM UNLOCKED'), memoCanvas(it, 112), h('h2', { class: 'gold' }, it.name.toUpperCase()), h('div', { class: 'sub' }, it.text), it.playerName ? h('div', { class: 'muted', style: { fontSize: '7px' } }, `#${it.num} ${it.playerName} made his picks. Want to change anything?`) : null,
      typeof memoCustomizeDlg === 'function' ? h('button', { class: 'small', style: { marginTop: '6px' }, onclick: () => { close(); memoCustomizeDlg(it, () => showNotices()); } }, '🎨 CUSTOMIZE WITH ' + (it.playerName ? it.playerName.split(' ').slice(-1)[0].toUpperCase() : 'THE CLUB')) : null) : null; }),
    big.map(row),
    offers.length ? [head(`SPONSOR OFFERS · ${offers.length} PLAYER${offers.length === 1 ? '' : 'S'}`), offers.slice(0, MAXO).map(offerRow),
      offers.length > MAXO ? h('div', { class: 'muted', style: { fontSize: '7px' } }, `+ ${offers.length - MAXO} more`) : null,
      h('button', { class: 'small', style: { marginTop: '4px' }, onclick: () => { close(); UI.tabMem = UI.tabMem || {}; UI.tabMem.sponsorside = 1; typeof push === 'function' ? push(scrSponsors) : go(scrSponsors); } }, 'SEE PLAYER DEALS ▶')] : null,
    other.length ? [many && (big.length || offers.length) ? head('CLUB NEWS') : null, other.slice(0, MAXN).map(row),
      other.length > MAXN ? h('div', { class: 'muted', style: { fontSize: '7px' } }, `+ ${other.length - MAXN} more`) : null] : null,
    h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'primary', onclick: close }, many ? 'GOT IT' : 'NICE!'), legacy.length ? h('button', { onclick: () => { close(); go(scrLegacy); } }, 'OPEN CABINET') : null)));
}

// ---------- memorabilia drawing (simple pixel objects in the franchise colours)
function memoCanvas(it, size = 48) {
  if (typeof memoArt === 'function') return memoArt(it, size);
  const c = h('canvas', { width: 32, height: 32, class: 'px' }); c.style.width = size + 'px'; c.style.height = size + 'px';
  const g = c.getContext('2d'), col = it.colors || { p: '#ffd23f', s: '#333', a: '#fff' }, px = (x, y, w, hh, f) => { g.fillStyle = f; g.fillRect(x, y, w, hh); };
  switch (it.icon) {
    case 'banner': px(9, 3, 14, 22, col.p); px(9, 25, 7, 4, col.p); px(16, 25, 7, 4, col.p); px(9, 3, 14, 2, col.a); px(12, 9, 8, 8, '#ffd23f'); px(14, 11, 4, 4, col.s); break;
    case 'ring': px(10, 12, 12, 12, '#ffd23f'); px(13, 15, 6, 6, '#141832'); px(12, 7, 8, 5, col.p); px(14, 8, 4, 3, '#ffffff'); break;
    case 'mask': px(10, 5, 12, 20, '#e9ecff'); px(10, 5, 12, 4, col.p); px(12, 12, 3, 2, '#141832'); px(17, 12, 3, 2, '#141832'); for (let i = 0; i < 4; i++) px(12, 17 + i * 2, 8, 1, '#7a8099'); break;
    case 'stick': px(15, 2, 3, 24, '#c98a4a'); px(15, 24, 10, 3, '#c98a4a'); px(15, 6, 3, 4, col.p); px(15, 14, 3, 2, col.a); break;
    case 'jersey': px(9, 7, 14, 18, col.p); px(5, 7, 4, 8, col.p); px(23, 7, 4, 8, col.p); px(13, 7, 6, 2, col.a); px(9, 20, 14, 2, col.a); px(14, 11, 4, 6, '#ffffff'); break;
    case 'gloves': px(6, 10, 9, 12, col.p); px(17, 10, 9, 12, col.p); px(6, 19, 9, 3, col.a); px(17, 19, 9, 3, col.a); px(8, 8, 2, 3, col.p); px(22, 8, 2, 3, col.p); break;
    case 'puck': px(11, 8, 10, 14, '#f4f4f6'); px(9, 10, 14, 10, '#f4f4f6'); px(14, 13, 4, 4, '#1b1b22'); px(10, 11, 2, 2, '#1b1b22'); px(20, 17, 2, 2, '#1b1b22'); px(19, 9, 2, 2, '#1b1b22'); px(12, 19, 2, 2, '#ffd23f'); break;   // SOCCER: the match ball
    default: px(10, 6, 12, 16, '#ffd23f'); px(13, 22, 6, 3, '#c9a020'); px(11, 25, 10, 3, col.p); break;
  }
  return c;
}

// ---------- achievements, legacy cabinet, account-wide unlocks
function scrLegacy() {
  const save = UI.save;
  let tab = UI.legTab || 'cab';
  const body = h('div'), tabs = h('div', { class: 'tabs' });
  const render = () => {
    UI.legTab = tab; tabs.innerHTML = ''; body.innerHTML = '';
    for (const [k, lab] of [['cab', 'LEGACY CABINET'], ['ach', 'ACHIEVEMENTS'], ['cos', 'ACCOUNT UNLOCKS']]) tabs.appendChild(h('button', { class: k === tab ? 'sel' : '', onclick: () => { tab = k; render(); } }, lab));
    if (tab === 'cab') {
      const items = save.memorabilia || [];
      body.appendChild(h('div', { class: 'panel cabinet' + (hasCosmetic('carpet') ? ' carpet' : '') + (hasCosmetic('pedestals') ? ' marble' : '') },
        hasCosmetic('banner_wall') ? h('div', { class: 'bannerwall' }, save.trophies.filter(t => t.type === 'league' && t.teamId === save.userTeamId).map(t => h('span', { class: 'cbanner' }, seasonLabel(t.year || 0)))) : null,
        items.length ? pages('memo', items, 10, sl => h('div', { class: 'memogrid' }, sl.map(it => h('div', { class: 'memo' + (it.test ? ' test' : ''), title: it.text + ' (click to customize)' }, h('a', { class: 'memoart', onclick: () => memoCustomizeDlg(it, render) }, memoCanvas(it, 84)), h('div', { class: 'gold', style: { fontSize: '7px' } }, it.name),
          it.playerName ? h('a', { class: 'lnk', style: { fontSize: 'calc(6px * var(--ts, 1.2))' }, onclick: () => push(() => scrPlayer(it.pid)) }, `#${it.num} ${it.playerName}${Pl(it.pid) && Pl(it.pid).status === 'retired' ? ' (retired)' : ''}`) : null,
          it.test ? h('div', { class: 'red', style: { fontSize: 'calc(6px * var(--ts, 1.2))' } }, 'TEST ITEM (debug)') : null))))
          : emptyState('cabinet', 'The cabinet is empty. Championships, awards and legendary careers leave memorabilia here.', '')));
      setTimeout(() => fitZoomEl(body.querySelector('.cabinet')), 0);
    } else if (tab === 'ach') {
      const cats = [...new Set(ACHIEVEMENTS.map(a => a.cat))];
      const doneN = ACHIEVEMENTS.filter(a => save.ach[a.id] && save.ach[a.id].done).length;
      body.appendChild(h('div', { class: 'panel', style: { padding: '6px 10px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center', margin: 0 } }, h('h3', { style: { margin: 0 } }, 'ACHIEVEMENTS'), h('b', { class: 'gold' }, doneN + ' / ' + ACHIEVEMENTS.length)),
        h('div', { class: 'salbar', style: { marginTop: '3px' } }, h('i', { style: { width: (doneN / Math.max(1, ACHIEVEMENTS.length) * 100) + '%' } }))));
      // one category at a time, a page of achievements at a time (no scrolling)
      const achRow = a => {
          const r = save.ach[a.id], prog = a.goal ? Math.min(a.goal, save.achProg[a.id] || 0) : null, R = a.reward || {};
          const rew = [R.cosmetic ? 'Account: ' + COSMETICS[R.cosmetic].name : null, R.style ? 'Leadership style: ' + LEAD_STYLES[R.style].name : null, R.memo ? 'Cabinet: ' + MEMO_KINDS[R.memo].name : null].filter(Boolean).join(' · ');
          return h('div', { class: 'achrow' + (r && r.done ? ' done' : '') }, h('span', { class: 'achmark' }, r && r.done ? '★' : '☆'),
            h('div', { style: { flex: 1 } }, h('div', null, a.name, r && r.test ? h('span', { class: 'red' }, ' (TEST)') : null), h('div', { class: 'muted', style: { fontSize: '7px' } }, a.desc), rew ? h('div', { class: 'gold', style: { fontSize: 'calc(6px * var(--ts, 1.2))' } }, 'Reward: ' + rew) : null),
            h('div', { class: 'muted', style: { fontSize: '7px', textAlign: 'right', minWidth: '70px' } }, r && r.done ? `Season ${r.s}` : prog != null ? h('div', null, `${prog}/${a.goal}`, h('div', { class: 'salbar', style: { height: '6px', marginTop: '3px' } }, h('i', { style: { width: (prog / a.goal * 100) + '%' } }))) : ''));
        };
      body.appendChild(tabbed('achcat', cats.map(c => { const list = ACHIEVEMENTS.filter(a => a.cat === c), dn = list.filter(a => save.ach[a.id] && save.ach[a.id].done).length;
        return { label: c.toUpperCase() + ' ' + dn + '/' + list.length, el: () => h('div', { class: 'panel' }, pages('ach' + c, list, 6, sl => h('div', null, sl.map(achRow)))) }; })));

    } else {
      const kinds = { jersey: 'JERSEYS', emblem: 'EMBLEMS', logo: 'LOGO', trim: 'TRIM', gear: 'GEAR', arena: 'ARENA', presentation: 'PRESENTATION', cabinet: 'TROPHY CABINET' };
      const all = Object.entries(COSMETICS), got = all.filter(([id]) => hasCosmetic(id)).length;
      const card = ([id, c]) => { const a = ACHIEVEMENTS.find(x => x.reward && x.reward.cosmetic === id), on = hasCosmetic(id); return h('div', { class: 'coscard' + (on ? ' on' : '') }, h('span', { class: 'achmark' }, on ? '★' : '\uE001'), h('div', { style: { flex: 1 } }, h('div', null, on ? c.name : c.name), h('div', { class: 'muted', style: { fontSize: '.85em' } }, on ? c.desc : a ? 'Unlock: ' + a.name + ' · ' + a.desc : c.desc))); };
      body.appendChild(h('div', { class: 'panel row', style: { justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px' } }, h('div', { style: { flex: 1 } }, h('div', { class: 'sub' }, 'Cosmetic unlocks belong to your account: every franchise save gets them. Gameplay unlocks (leadership styles) stay with the franchise that earned them.')),
        h('b', { class: 'gold' }, 'UNLOCKED ' + got + ' / ' + all.length),
        h('button', { class: 'small', onclick: exportProfile }, 'EXPORT'), h('button', { class: 'small', onclick: importProfile }, 'IMPORT')));
      // one kind of unlock at a time, in pages (no scrolling)
      body.appendChild(tabbed('coskind', Object.keys(kinds).filter(k => all.some(([, c]) => c.kind === k)).map(k => { const list = all.filter(([, c]) => c.kind === k);
        return { label: kinds[k] + ' ' + list.filter(([id]) => hasCosmetic(id)).length + '/' + list.length, el: () => h('div', { class: 'panel' }, pages('cos' + k, list, 8, sl => h('div', { class: 'cosgrid2' }, sl.map(card)))) }; })
        .concat([{ label: 'LEADERSHIP STYLES', el: () => h('div', { class: 'panel' }, pages('lstyles', Object.entries(LEAD_STYLES), 12, sl => h('div', null, sl.map(([k, st]) => h('div', { style: { fontSize: '8px', lineHeight: 2 } },
          h('span', { class: BASE_STYLES.includes(k) || (save.unlocks.styles || []).includes(k) ? 'gold' : 'muted' }, st.name), ' · ', h('span', { class: 'muted', style: { fontSize: '7px' } }, st.unlock === 'player' ? 'earned by individual players' : BASE_STYLES.includes(k) ? 'always available' : (save.unlocks.styles || []).includes(k) ? 'UNLOCKED' : 'locked: earn it with an achievement')))))) }])));
    }
  };
  render();
  const back = UI.legBack || scrHub;          // opened from the main menu: back goes there
  return h('div', { class: 'screen wide' }, header('LEGACY', () => { UI.legBack = null; go(back); }), tabs, body);
}
// account profile: load at boot, save when it changes, export / import as its own small file
async function loadProfile() { try { const pr = await Store.getProfile(); if (pr && pr.cos) PROFILE = Object.assign({ cos: {}, ach: {}, v: 1 }, pr); } catch (e) {} }
setInterval(() => { if (typeof S !== 'undefined' && S.match && S.screen === 'play' && S.phase === 'live') return;   // never save mid-play: wait for a whistle or the end of the game
  if (PROFILE && PROFILE.dirty) { PROFILE.dirty = false; const o = Object.assign({}, PROFILE); delete o.dirty; Store.putProfile(o); } }, 3000);
function exportProfile() {
  const o = Object.assign({ format: 'psph98-profile' }, PROFILE); delete o.dirty;
  const blob = new Blob([JSON.stringify(o)], { type: 'application/json' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'pixelsoccer-account-unlocks.json'; a.click();
}
function importProfile() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = async () => {
    try {
      const o = JSON.parse(await inp.files[0].text());
      if (o.format !== 'psph98-profile' || !o.cos) return toast('That is not an account-unlocks file.');
      let n = 0; for (const [k, v] of Object.entries(o.cos)) if (COSMETICS[k] && !PROFILE.cos[k]) { PROFILE.cos[k] = v; n++; }   // merge: never removes anything
      for (const [k, v] of Object.entries(o.ach || {})) PROFILE.ach[k] = Math.max(PROFILE.ach[k] || 0, v);
      PROFILE.dirty = true; toast(`${n} unlock${n === 1 ? '' : 's'} added.`); go(scrLegacy);
    } catch (e) { toast('Could not read that file.'); }
  };
  inp.click();
}
// ---------- postgame: special teams, penalties, fights, injuries (from the match's rules log)
function postgameEvents(o) {
  const r = o.res; if (!r || !r.tstats) return null;
  const ts = r.tstats, ev = r.events || [], abbr = t => o.teams ? o.teams[t].abbr : TEAM[t].abbr;
  const line = t => `${abbr(t)}: PP ${ts[t].ppg}/${ts[t].ppo} · PIM ${Math.round(ts[t].pim)}s · EN goals ${ts[t].eng} · scuffles ${ts[t].fights}`;
  if (!ev.length && !ts[0].ppo && !ts[1].ppo && !ts[0].fights) return null;
  return h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'SPECIAL TEAMS & INCIDENTS'),
    h('div', { style: { fontSize: '8px', lineHeight: 2 } }, line(0), h('br'), line(1)),
    ev.length ? h('div', { class: 'muted', style: { fontSize: '7px', lineHeight: 2, marginTop: '6px' } }, ev.slice(-14).map(e => h('div', null, `${e.p > 3 ? 'ET' : 'H' + Math.max(1, e.p - 1)} ${fmtToi(e.t)} · ${e.text}`))) : null);
}
