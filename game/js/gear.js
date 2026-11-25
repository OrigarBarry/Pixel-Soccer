'use strict';
// ====================================================================
//  GEAR & ROOMS: player cosmetics (in-game sprites + portraits), arena customization, trophy rooms.
//  Nothing here changes attributes. Prestige items are account-wide unlocks earned through achievements;
//  arena and trophy-room options are bought with franchise funds.
// ====================================================================
// SOCCER (Nov 24): every part is football kit. The keys stay the hockey ones so old saves load (gearOf maps any old value
// a part no longer has to that part's default): helmet = headband, visor = extras, skates = boots, stick = boot stripe,
// tape = sock tape, pads = shin pads, jersey = shirt, mask = keeper shirt design, gloves / blocker = gloves.
const GEAR_OPTS = {
  helmet: { team: 'No headband', teamband: 'Team headband', black: 'Black headband', white: 'White headband', stripe: 'Striped headband', retro: 'Thin Alice band', chrome: 'Silver headband ★', gold: 'Gold headband ★', flame: 'Flame headband ★' },
  visor: { none: 'Nothing extra', wrist: 'Wristbands', tapewrist: 'Taped wrists', snood: 'Snood', under: 'Long undershirt', cap: 'Keeper cap', armband: 'Black armband', gold: 'Gold wristbands ★' },
  gloves: { team: 'No gloves', black: 'Black gloves', white: 'White gloves', brown: 'Brown gloves', twotone: 'Two-tone gloves', neon: 'Neon gloves', gold: 'Gold gloves ★' },
  skates: { black: 'Black boots', white: 'White boots', red: 'Red boots', blue: 'Blue boots', neon: 'Neon green', pink: 'Hot pink', orange: 'Blaze orange', cyan: 'Ice blue', twotone: 'Black & white', retro: 'Classic leather', gold: 'Gold boots ★' },
  stick: { white: 'White stripes', black: 'Black stripes', team: 'Team colour', red: 'Red stripes', blue: 'Blue stripes', green: 'Neon stripes', none: 'Plain, no stripes', gold: 'Gold stripes ★' },
  tape: { none: 'No sock tape', white: 'White tape', black: 'Black tape', team: 'Team colour', blue: 'Blue tape', pink: 'Pink tape', red: 'Red tape', green: 'Green tape', candy: 'Candy stripe', gold: 'Gold tape ★' },
  jersey: { standard: 'Standard', tuck: 'Tucked in', loose: 'Untucked & baggy', elbow: 'Long sleeves', rolled: 'Short sleeves', laces: 'Laced collar (retro)', polo: 'Polo collar' },
  shorts: { standard: 'Standard', short: 'Retro short-shorts', long: 'Long & baggy', cycling: 'Cycling shorts under' },
  socks: { team: 'Team socks', dark: 'Dark socks', white: 'White socks', stripe: 'Striped tops', hoops: 'Hooped socks', rolled: 'Rolled down (pads show)', high: 'Pulled over the knee' },
  mask: { team: 'Plain keeper shirt', bucket: 'Shoulder panels', white: 'All white', retro: 'Vintage tan', checkers: 'Checkerboard', wolf: 'Storm grey', skull: 'Bone white', tiger: 'Tiger stripes', flame: 'Flames', shark: 'Shark teeth', lightning: 'Lightning', star: 'All-Star ★', galaxy: 'Galaxy ★', laststand: 'Last Stand ★', chrome: 'Silver ★', gold: 'Gold ★' },
  catcher: { classic: 'Flat palm', pro: 'Roll finger', hweb: 'Negative cut', stripe: 'Finger saves', retro: 'Vintage cotton' },
  blocker: { classic: 'Plain backs', pro: 'Stripe backs', logo: 'Team badge', split: 'Two-tone', retro: 'Vintage' },
  gstick: { classic: 'Classic', pro: 'Pro', carbon: 'Carbon', flag: 'Team colours', retro: 'Vintage' },
  pads: { white: 'White shin pads', team: 'Team shin pads', black: 'Black shin pads', brown: 'Vintage brown', retro: 'Retro tan', stripes: 'Racing stripe', gold: 'Gold shin pads ★' },
};
const GEAR_DEFAULT = { helmet: 'team', visor: 'none', gloves: 'team', skates: 'black', stick: 'white', tape: 'none', jersey: 'standard', shorts: 'standard', socks: 'team', mask: 'team', pads: 'white', catcher: 'classic', blocker: 'classic', gstick: 'classic' };
// option -> account unlock (part-specific first)
const GEAR_LOCK = { chrome: 'chrome_gear', gold: 'gold_gear', star: 'star_mask', 'visor:gold': 'gold_visor', 'skates:gold': 'gold_stick', 'helmet:flame': 'flame_helmet', 'mask:galaxy': 'galaxy_mask', 'mask:laststand': 'laststand_mask' };   // SOCCER: the Golden Boot award unlocks gold boots
const gearLockId = (part, v) => GEAR_LOCK[part + ':' + v] || GEAR_LOCK[v] || null;
// how to unlock a cosmetic, for the locked silhouettes
function unlockHint(cos) {
  const a = typeof ACHIEVEMENTS !== 'undefined' ? ACHIEVEMENTS.find(x => x.reward && x.reward.cosmetic === cos) : null;
  const what = typeof COSMETICS !== 'undefined' && COSMETICS[cos] ? COSMETICS[cos].name : 'This item';
  const hint = typeof COSMETICS !== 'undefined' && COSMETICS[cos] && COSMETICS[cos].hint;
  return a ? `LOCKED · ${what}. Unlock it with the achievement "${a.name}": ${a.desc}` : hint ? `LOCKED · ${what}. ${hint}` : `LOCKED · ${what}.`;
}
// a skater's personal equipment (helmet, gloves, socks and jersey fit are the team uniform: TEAM LOOK > UNIFORMS)
const GEAR_PARTS_S = ['skates', 'stick', 'pads', 'tape', 'visor'];
const GEAR_NAMES = { skates: 'Boots', stick: 'Boot stripes', pads: 'Shin pads', tape: 'Sock tape', visor: 'Extras', mask: 'Keeper shirt', gloves: 'Glove colour', blocker: 'Glove backs', catcher: 'Glove cut', helmet: 'Headband', jersey: 'Shirt', shorts: 'Shorts', socks: 'Socks' };
const GEAR_NAMES_G = GEAR_NAMES;
const GEAR_PARTS_G = ['mask', 'gloves', 'blocker', 'visor', 'skates', 'stick', 'pads', 'tape'];
const LOOK_PARTS = { skin: 6, hair: 6, style: 8, beard: 5 };   // SOCCER: hairstyles 5-7 (mohawk, man bun, shaved) added
const LOOK_NAMES = { skin: 'Skin tone', hair: 'Hair colour', style: 'Hairstyle', beard: 'Facial hair' };
const gearLocked = (v, part) => { const id = gearLockId(part, v); return !!id && !(typeof hasCosmetic === 'function' && hasCosmetic(id)); };
// goalies on other teams who never picked a mask wear one of their own (masks.js aiMaskFor: seeded, so it stays his)
// SOCCER: every player picks his own boots: seeded by the player, so he keeps them season to season (anything set by hand wins)
const AI_BOOTS = ['black', 'black', 'black', 'white', 'white', 'neon', 'orange', 'pink', 'cyan', 'red', 'blue', 'twotone', 'retro'];
const AI_STRIPES = ['white', 'white', 'black', 'team', 'none', 'green'];
const AI_TAPE = ['none', 'none', 'none', 'white', 'white', 'black', 'team'];
const AI_EXTRA = ['none', 'none', 'none', 'none', 'none', 'none', 'wrist', 'tapewrist', 'snood'];
function aiKitFor(pl) {
  let hh = 2166136261; for (const ch of 'kit|' + String(pl.id) + (pl.last || '')) hh = Math.imul(hh ^ ch.charCodeAt(0), 16777619) >>> 0;
  const pick = (arr, sh) => arr[(((hh >>> sh) ^ (hh >>> (sh + 11))) >>> 0) % arr.length];
  return { skates: pick(AI_BOOTS, 0), stick: pick(AI_STRIPES, 5), tape: pick(AI_TAPE, 9), visor: pl.pos === 'G' ? 'none' : pick(AI_EXTRA, 13) };
}
const gearOf = pl => {
  const g = Object.assign({}, GEAR_DEFAULT, (pl && pl.gear) || {});
  for (const k of Object.keys(GEAR_DEFAULT)) if (GEAR_OPTS[k] && !(g[k] in GEAR_OPTS[k])) g[k] = GEAR_DEFAULT[k];   // an old (hockey) value: the football default
  if (pl && pl.id) { const own = pl.gear || {}, ai = aiKitFor(pl); for (const k in ai) if (!(k in own) || !(own[k] in GEAR_OPTS[k])) g[k] = ai[k]; }   // his own boots, stripes, tape and extras unless picked
  if (pl && pl.pos === 'G' && pl.id && !(pl.gear && pl.gear.mask) && typeof aiMaskFor === 'function' && !(typeof UI !== 'undefined' && UI && UI.save && pl.teamId === UI.save.userTeamId)) g.mask = aiMaskFor(pl);
  return g;
};
const SKIN_COL = ['#f5d0b0', '#f0c49b', '#d9a066', '#a8714a', '#7a4b2a', '#e8b48a'];
// the team uniform wins: helmet, gloves, socks and jersey fit come from the kit the team is wearing (skaters); a
// player's own picks only show for his personal equipment (visor, skates, stick, tape; a goalie's whole kit is his own)
function uniformGear(G, C, isG) { if (!G || !C || !C.uni || isG) return G; return Object.assign({}, G, C.uni); }
// colour of a gear part for the sprite (C = team palette)
function gearCol(gear, part, C) {
  const v = gear[part];
  const base = { team: C.main, black: '#1b1c22', white: '#eef1f6', chrome: '#c8d0dc', gold: '#e6b800', brown: '#7a4a1b', dark: C.dark, carbon: '#4a4f5c', red: '#c0392b', wood: '#9a6a35', blue: '#2f6fe8', pink: '#ff4fa8', green: '#3ad15a', twotone: '#1b1c22', retro: '#a8875a', candy: '#d9342b', stripes: '#f2f2f2',
    neon: '#9cff2e', orange: '#ff8a1f', cyan: '#6fd6ff', teamband: C.main };
  if (part === 'helmet') return v === 'stripe' ? C.helm : v === 'retro' ? '#1b1c22' : v === 'flame' ? '#1b1c22' : base[v] || C.helm;   // a headband
  if (part === 'gloves' && v === 'twotone') return C.dark;
  if (part === 'gloves') return v === 'team' ? C.dark : base[v];
  if (part === 'skates') return v === 'retro' ? '#141418' : base[v] || '#1d1f27';                  // boots (classic leather: black, white stripes)
  if (part === 'stick') return v === 'none' ? null : v === 'team' ? (C.trim || C.main) : base[v] || '#eef1f6';   // the boot stripes
  if (part === 'tape') return v === 'none' ? null : v === 'team' ? C.main : v === 'black' ? '#18191f' : base[v] || '#eef1f6';
  if (part === 'pads') return v === 'team' ? C.main : base[v] || '#f2f2f2';
  if (part === 'socks') return v === 'dark' ? C.dark : C.main;
  return base[v] || C.main;
}

// ---------- the editor (your franchise players)
// PLAYER GEAR & LOOK: one part at a time (◀ ▶ or the PART menu), so nothing needs scrolling
function scrGear(pid) {
  if (!UI.save || UI.save.userTeamId == null) return h('div', { class: 'screen' }, header('PLAYER GEAR & LOOK', () => go(scrMain)), h('div', { class: 'panel' }, 'Gear belongs to your season players: start or load a season first.'));
  const save = UI.save, team = T(save.userTeamId);
  const ids = rosterIds(team);
  let sel = pid && ids.includes(pid) ? pid : ids[0];
  const body = h('div', { class: 'gearscr' });
  save.gearPresets = save.gearPresets || [];
  const render = () => {
    body.innerHTML = '';
    const p = Pl(sel), g = gearOf(p), L = lookOf(p), parts = p.pos === 'G' ? GEAR_PARTS_G : GEAR_PARTS_S;
    const cats = parts.map(k => ({ k, kind: 'gear', name: (GEAR_NAMES[k] || k).toUpperCase() })).concat(Object.keys(LOOK_PARTS).map(k => ({ k, kind: 'look', name: LOOK_NAMES[k].toUpperCase() })));
    let ci = Math.max(0, cats.findIndex(c => c.k === UI.gearPart)); if (!cats[ci]) ci = 0; UI.gearPart = cats[ci].k;
    const cat = cats[ci];
    // left: the player
    const cv = h('canvas', { width: 220, height: 160, class: 'px', style: { width: '330px', height: '240px', background: '#dfe9f4', display: 'block', margin: '0 auto' } });
    drawGearPreview(cv, p, team);
    const step = d => { const k = ids.indexOf(sel); sel = ids[(k + d + ids.length) % ids.length]; render(); };
    const pick = h('select', { onchange: e => { sel = e.target.value; render(); } }, ids.map(id => h('option', { value: id, selected: id === sel }, '#' + Pl(id).num + ' ' + pname(Pl(id)) + ' (' + posLabel(Pl(id)) + ')')));
    const presetSel = h('select', { style: { flex: 1, minWidth: 0 } }, save.gearPresets.length ? save.gearPresets.map((pr, k) => h('option', { value: k }, pr.name + (pr.g ? ' (G)' : ''))) : [h('option', { value: '' }, 'No presets yet')]);
    const left = h('div', { class: 'panel gearleft' },
      h('div', { class: 'row', style: { gap: '6px', flexWrap: 'nowrap' } }, h('button', { class: 'small', onclick: () => step(-1), title: 'Previous player' }, '◀'), pick, h('button', { class: 'small', onclick: () => step(1), title: 'Next player' }, '▶')),
      h('div', { style: { margin: '10px 0 6px' } }, cv),
      p.pos !== 'G' ? h('div', { class: 'muted', style: { fontSize: '7px', textAlign: 'center' } }, 'Headband, gloves, shirt, shorts and socks: the team kit (TEAM LOOK > UNIFORMS).') : null,
      h('div', { class: 'muted gearnote', style: { fontSize: '7px', lineHeight: 1.5 } }, 'Cosmetic only. Hover a dark silhouette to see how to unlock it.'),
      h('div', { class: 'grouplab' }, 'PRESETS'),
      h('div', { class: 'row', style: { gap: '6px', flexWrap: 'nowrap' } }, presetSel,
        h('button', { class: 'small', disabled: !save.gearPresets.length, onclick: () => { const pr = save.gearPresets[+presetSel.value]; if (!pr) return; p.gear = Object.assign({}, pr.gear); Store.autosave(save); render(); } }, 'APPLY'),
        h('button', { class: 'small danger', disabled: !save.gearPresets.length, onclick: () => { save.gearPresets.splice(+presetSel.value, 1); Store.autosave(save); render(); } }, '✕')),
      h('div', { class: 'row', style: { gap: '6px', marginTop: '6px' } },
        h('button', { class: 'small', onclick: () => { const name = 'Preset ' + (save.gearPresets.length + 1); save.gearPresets.push({ name, gear: gearOf(p), g: p.pos === 'G' }); if (save.gearPresets.length > 8) save.gearPresets.shift(); Store.autosave(save); toast('Saved ' + name + '.'); render(); } }, 'SAVE AS PRESET'),
        h('button', { class: 'small', onclick: () => confirmDlg('Give every ' + (p.pos === 'G' ? 'keeper' : 'outfield player') + ' on your roster this player\'s gear?', 'APPLY TO TEAM', () => { for (const id of ids) { const q = Pl(id); if ((q.pos === 'G') === (p.pos === 'G')) q.gear = Object.assign({}, gearOf(p)); } Store.autosave(save); toast('Gear applied to the team.'); render(); }) }, 'APPLY TO WHOLE TEAM')));
    // right: one part at a time
    const go2 = d => { UI.gearPart = cats[(ci + d + cats.length) % cats.length].k; render(); };
    const menu = h('div', { class: 'gearmenu', style: { display: 'none' } }, cats.map((c, k) => h('button', { class: 'small' + (k === ci ? ' sel' : ''), onclick: () => { UI.gearPart = c.k; render(); } }, c.name)));
    const head = h('div', { class: 'gearhead' },
      h('button', { class: 'gearnav', title: 'Previous part', onclick: () => go2(-1) }, '◀'),
      h('button', { class: 'gearpart', title: 'Choose a part', onclick: () => { menu.style.display = menu.style.display === 'none' ? 'grid' : 'none'; } }, h('span', { class: 'muted' }, 'PART ' + (ci + 1) + '/' + cats.length + ' · '), cat.name, ' ▾'),
      h('button', { class: 'gearnav', title: 'Next part', onclick: () => go2(1) }, '▶'));
    let opts;
    if (cat.kind === 'gear') {
      opts = Object.entries(GEAR_OPTS[cat.k]).map(([v, label]) => {
        const lockId = gearLockId(cat.k, v), lock = gearLocked(v, cat.k);
        return h('button', { class: 'small gearopt' + (g[cat.k] === v ? ' sel' : '') + (lock ? ' locked' : ''), title: lock ? unlockHint(lockId) : label,
          onclick: () => { if (lock) return toast(unlockHint(lockId)); p.gear = Object.assign(gearOf(p), { [cat.k]: v }); Store.autosave(save); render(); } },
          gearOptionCanvas(p, team, cat.k, v, lock), h('div', null, lock ? ' ???' : label.replace(' ★', '')));
      });
    } else {
      const k = cat.k;
      opts = Array.from({ length: LOOK_PARTS[k] }, (_, i2) => {
        const cvl = h('canvas', { width: 54, height: 96, class: 'px', style: { width: '54px', height: '96px', display: 'block', margin: '0 auto 3px' } });
        const pr = Object.assign({}, p, { look: Object.assign({}, L, { [k]: i2 }) });
        drawFigureOn(cvl, teamPalette(teamIdentity(team), false), [fakeSkater({ pl: pr, num: p.num, g: p.pos === 'G', fy: 1, px: 27, py: 88, hand: p.hand || 'L' })], 3);
        const sw = k === 'skin' ? SKIN_COL[i2] : k === 'hair' ? (typeof HAIR !== 'undefined' && HAIR[i2]) : null;
        return h('button', { class: 'small gearopt' + (L[k] === i2 ? ' sel' : ''), onclick: () => { p.look = Object.assign({}, lookOf(p), { [k]: i2 }); Store.autosave(save); render(); } },
          cvl, sw ? h('div', { style: { height: '10px', background: sw, border: '2px solid #141832', margin: '0 8px' } }) : h('div', null, (k === 'style' ? ['SHORT', 'MULLET', 'CURLY', 'LONG', 'BUZZ', 'MOHAWK', 'MAN BUN', 'SHAVED'] : ['CLEAN', 'STUBBLE', 'MOUSTACHE', 'GOATEE', 'FULL BEARD'])[i2] || String(i2 + 1)));
      });
    }
    const right = cat.k === 'mask' && typeof maskStudio === 'function' ? h('div', { class: 'panel gearright' }, head, menu, maskStudio(p, team, render))
      : h('div', { class: 'panel gearright' }, head, menu, pages('gearopt' + cat.k, opts, 12, sl => h('div', { class: 'gearopts' }, sl)),
        h('div', { class: 'muted', style: { fontSize: '7px', marginTop: '8px' } }, 'Tip: ◀ ▶ step through the parts, or click the part name for the full list.'));
    body.appendChild(h('div', { class: 'gearlayout' }, left, right));
    setTimeout(() => typeof fitZoomEl === 'function' && fitZoomEl(body.querySelector('.gearlayout')), 0);
  };
  render();
  return h('div', { class: 'screen wide gearS' }, header('PLAYER GEAR & LOOK', () => go(scrHub)), body);
}
// a sprite-accurate preview: the real in-game drawing on a small canvas
// one option, shown on the player himself (a dark silhouette while it is still locked)
function gearOptionCanvas(pl, team, part, v, locked) {
  const cv = h('canvas', { width: 54, height: 96, class: 'px', style: { width: '54px', height: '96px', display: 'block', margin: '0 auto 3px' } });
  let C = teamPalette(teamIdentity(team), false); const pr = Object.assign({}, pl, { gear: Object.assign(gearOf(pl), { [part]: v }) });
  // SOCCER: small kit is shown close up: the legs for boots, stripes, shin pads (socks rolled down so they show) and sock tape; the upper body for extras
  const legs = ['skates', 'stick', 'pads', 'tape'].includes(part), top = part === 'visor';
  if (part === 'pads') { C = Object.assign({}, C, { uni: Object.assign({}, C.uni, { socks: 'rolled' }) }); pr.gear.socks = 'rolled'; }
  drawFigureOn(cv, C, [fakeSkater({ pl: pr, num: pl.num, g: pl.pos === 'G', fy: 1, px: 27, py: legs ? 92 : top ? 150 : 88, hand: pl.hand || 'L' })], legs ? 6 : top ? 4.5 : 3);
  if (locked) silhouette(cv);
  return cv;
}
// turn everything drawn on a canvas into a flat dark shape (locked items)
function silhouette(cv, col = '#0e1124') {
  const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-atop'; c.fillStyle = col; c.fillRect(0, 0, cv.width, cv.height); c.globalCompositeOperation = 'source-over';
}
function drawGearPreview(cv, pl, team) {
  const C = teamPalette(teamIdentity(team), false), c = cv.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#e9f1f8'; c.fillRect(0, 0, cv.width, cv.height);
  const mk = (fy, x) => fakeSkater({ pl, num: pl.num, g: pl.pos === 'G', fy, px: x, py: 124, hand: pl.hand || 'L' });
  drawFigureOn(cv, C, [mk(1, 60), mk(-1, 160)], 8 / 3);
}

// ====================================================================
//  ARENA CUSTOMIZATION (home games): bought with franchise funds, saved presets, live preview
// ====================================================================
// Prices ($K) are set against a season's profit: an average club clears about $1M, a playoff club $3-8M.
// A few cheap pieces are within reach in season one; the big items take several good seasons.
const ARENA_PRICES = {
  venue: { modern: 14000, palace: 30000 },
  logo: { wordmark: 600, classic: 250, crest: 1200 }, ads: { retro: 700, local: 300, team: 900, premium: 1500, charity: 500 }, seats: { red: 1800, team: 2400, black: 1800, gold: 3000 },
  crowd: { mixed: 0, whiteout: 900, blackout: 900, gold: 1400 }, lighting: { bright: 1200, dim: 500, disco: 2600 }, banners: { retired: 400, flags: 250, none: 0 },
  deco: { streamers: 450, flags: 600, fireworks: 2800, confetti: 1200 }, show: { lasers: 1600, projection: 2200, mirror: 900, pyro: 2400, aurora: 2000, storm: 1800, search: 1400, full: 6500 },
  boards: { wood: 900, black: 1100, led: 3200 }, glass: { tinted: 600, netting: 400 }, horn: { deep: 700, train: 1100, siren: 1100, triple: 800, rising: 900 },
};
const SHOW_WORKS = ['lasers', 'projection', 'pyro', 'mirror'];
const ARENA_LOCK = { disco: 'arena_show', fireworks: 'arena_show', pyro: 'arena_show', full: 'the_works', led: 'led_boards', premium: 'premium_ads' };
const arenaOwned = team => (team.arenaOwned = team.arenaOwned || []);
// debug unlock-all also makes every purchasable item owned (nothing is written into the save)
const dbgFree = () => typeof dbgUnlockAll === 'function' && dbgUnlockAll();
// the light show can stack effects: cfg.show is 'standard', one effect, or several joined with '+' ('lasers+mirror')
const showTokens = v => String(v || 'standard').split('+').filter(x => x && x !== 'standard');
const arenaHas = (team, k, v) => k === 'show' && String(v).includes('+') ? showTokens(v).every(x => arenaHas(team, 'show', x)) : dbgFree() || ARENA_DEFAULT[k] === v || !((ARENA_PRICES[k] || {})[v]) || arenaOwned(team).includes(k + ':' + v);
function teamArena(team) {
  if (!team) return Object.assign({}, ARENA_DEFAULT);
  const mine = UI.save && team.id === UI.save.userTeamId;
  return Object.assign({}, ARENA_DEFAULT, mine || team.arena ? team.arena || {} : (typeof aiArena === 'function' ? aiArena(team) : {}));
}
function scrArena() {
  const save = UI.save, team = T(save.userTeamId);
  let cfg = teamArena(team);
  save.arenaPresets = save.arenaPresets || [];
  const body = h('div');
  const render = () => {
    body.innerHTML = '';
    const prev = h('canvas', { width: 520, height: 300, class: 'px', style: { width: '468px', height: 'auto', maxWidth: '100%' } });   // art audit: wider, with the real centre ice
    previewArena(prev, cfg, team);
    const f = finOf(team);
    // each part is one row: its name and a menu (price beside anything you don't own yet; locked items say how to unlock)
    const row = (k, label) => {
      if (k === 'show') return showRow(label);
      const locks = [];
      const sel = h('select', { onchange: e => { const v = e.target.value; cfg = Object.assign({}, cfg, { [k]: v }); if (k === 'horn') hornSample(v); render(); } },
        Object.entries(ARENA_OPTS[k]).map(([v, nm]) => {
          const owned = arenaHas(team, k, v), price = (ARENA_PRICES[k] || {})[v] || 0, lock = ARENA_LOCK[v] && !hasCosmetic(ARENA_LOCK[v]);
          if (lock) locks.push(nm + ': ' + unlockHint(ARENA_LOCK[v]));
          return h('option', { value: v, selected: cfg[k] === v, disabled: !!lock }, (lock ? '🔒 ' : '') + nm + (owned ? (cfg[k] === v ? '' : ' · owned') : ' · ' + fmtM(price)));
        }));
      return h('div', { class: 'arow' }, h('span', { class: 'gold alab' }, label), sel,
        locks.length ? h('span', { class: 'muted alock', 'data-help': locks.join(' · ') }, '🔒 ' + locks.length) : h('span', { class: 'alock' }));
    };
    // LIGHT SHOW: effects toggle on and off and stack (STANDARD clears them; THE WORKS is all four classics at once)
    const showRow = label => {
      const on = showTokens(cfg.show), worksOn = on.includes('full');
      const set = list => { cfg = Object.assign({}, cfg, { show: list.length ? list.join('+') : 'standard' }); render(); };
      const chip = v => {
        const nm = ARENA_OPTS.show[v], owned = arenaHas(team, 'show', v), price = ARENA_PRICES.show[v] || 0, lock = ARENA_LOCK[v] && !hasCosmetic(ARENA_LOCK[v]);
        const sel = v === 'standard' ? !on.length : on.includes(v) || (worksOn && SHOW_WORKS.includes(v));
        return h('button', { class: 'small showchip' + (sel ? ' sel' : '') + (lock ? ' locked' : ''), title: lock ? unlockHint(ARENA_LOCK[v]) : nm + (owned ? ' (owned)' : ' · ' + fmtM(price)),
          onclick: () => {
            if (lock) return toast(unlockHint(ARENA_LOCK[v]), 4000);
            if (v === 'standard') return set([]);
            if (v === 'full') return set(worksOn ? on.filter(x => x !== 'full') : on.filter(x => !SHOW_WORKS.includes(x)).concat('full'));
            if (worksOn && SHOW_WORKS.includes(v)) return set(on.filter(x => x !== 'full').concat(SHOW_WORKS.filter(x => x !== v)));   // un-pick one piece of The Works
            set(on.includes(v) ? on.filter(x => x !== v) : on.concat(v));
          } }, (lock ? '🔒 ' : sel ? '✓ ' : '') + nm.replace(' show', '').toUpperCase(), !owned && !lock && price ? h('span', { class: 'muted' }, ' ' + fmtM(price)) : null);
      };
      return h('div', { class: 'arow showrow' }, h('span', { class: 'gold alab' }, label), h('div', { class: 'showchips' }, Object.keys(ARENA_OPTS.show).map(chip)), h('span', { class: 'alock' }));
    };
    // what this configuration still needs to buy: one entry per part (and per light-show effect)
    const unpaidL = []; for (const k of Object.keys(ARENA_OPTS)) { if (k === 'show') { for (const v of showTokens(cfg.show)) if (!arenaHas(team, 'show', v)) unpaidL.push([k, v]); } else if (!arenaHas(team, k, cfg[k])) unpaidL.push([k, cfg[k]]); }
    const unpaid = unpaidL, cost = unpaidL.reduce((a, [k, v]) => a + ((ARENA_PRICES[k] || {})[v] || 0), 0);
    // the building itself: two renovations, bought once (cosmetic only)
    const buildEl = () => (h('div', { class: 'panel' },
      h('div', { class: 'sub', style: { margin: '0 0 6px' } }, 'Renovations change the look and name of your home arena, and every purchase lifts attendance and your home edge. Buy once, switch any time.'),
      h('div', { class: 'grid g3' }, Object.keys(ARENA_OPTS.venue).map(v => {
        const V = VENUES[v], owned = arenaHas(team, 'venue', v), price = ARENA_PRICES.venue[v] || 0, needs = v === 'palace' && !arenaHas(team, 'venue', 'modern');
        const mini = h('canvas', { width: 255, height: 225, class: 'px', style: { width: '100%', maxWidth: '150px', height: 'auto', display: 'block', margin: '4px auto' } });
        setTimeout(() => previewArena(mini, Object.assign({}, cfg, { venue: v }), team, true), 0);
        return h('div', { class: 'teamcard' + (cfg.venue === v ? ' on' : ''), style: { flexDirection: 'column', alignItems: 'stretch', opacity: needs ? 0.6 : 1 }, onclick: () => { if (needs) return toast('Buy the Modern Dome renovation first.'); cfg = Object.assign({}, cfg, { venue: v }); render(); } },
          h('div', { class: 'gold' }, V.name.toUpperCase()), mini,
          h('div', { class: 'muted', style: { fontSize: '7px', lineHeight: 1.8 } }, V.desc),
          h('div', { style: { marginTop: '4px', fontSize: '8px' } }, owned ? (cfg.venue === v ? '✓ SELECTED' : 'OWNED') : needs ? '\uE001 ' + fmtM(price) + ' · needs the Modern Dome' : fmtM(price)));
      })),
      h('div', { class: 'hint' }, 'Your arena will be called the ' + arenaTitle(team, cfg) + '.')));
    const prevEl = () => h('div', { class: 'panel', style: { textAlign: 'center' } }, h('div', { class: 'sub' }, 'PREVIEW (your home arena)'), prev,
        h('div', { class: 'sub' }, 'Jumbotron message: ', h('input', { type: 'text', value: cfg.text || '', maxLength: 24, placeholder: 'GO ' + team.nick.toUpperCase() + '!', oninput: e => { cfg.text = e.target.value.toUpperCase().replace(/[^A-Z0-9 !'.-]/g, ''); clearTimeout(prev._t); prev._t = setTimeout(() => previewArena(prev, cfg, team), 150); } })));
    const customEl = part => () => (h('div', { class: 'grid g2', style: { gridTemplateColumns: 'auto 1fr' } }, prevEl(),
      part === 0 ? h('div', { class: 'panel' }, row('logo', 'CENTRE-CIRCLE LOGO'), row('boards', 'HOARDINGS'), row('glass', 'BALL-STOP NETS'), row('ads', 'ADVERTISEMENTS'), row('seats', 'SEATING COLOUR'), row('crowd', 'CROWD COLOURS'), h('div', { class: 'hint' }, 'Pick from each menu to preview it. Prices show beside anything you don\'t own yet; BUY & APPLY at the top pays for the new pieces. Spending on the building lifts attendance (up to +8%) and your home edge.'))
        : h('div', { class: 'panel' }, row('lighting', 'LIGHTING'), row('show', 'LIGHT SHOW'), row('banners', 'BANNERS'),
          h('div', { style: { margin: '6px 0' } }, h('label', { class: 'f' }, h('input', { type: 'checkbox', checked: cfg.signs !== false, onchange: e => { cfg.signs = e.target.checked; render(); } }), ' Fans hold up signs')),
          row('deco', 'DECORATIONS'), row('horn', 'GOAL CELEBRATION'))));
    const buyEl = (h('div', { class: 'panel row arenabuy', style: { justifyContent: 'space-between', alignItems: 'center', margin: '0 0 8px', padding: '6px 10px' } },
      h('div', { class: 'sub', style: { margin: 0 } }, `Funds ${fmtM(f.cash)} · ` + (cost ? `New items: ${fmtM(cost)}` : 'All owned')),
      h('div', { class: 'row' },
        h('button', { class: 'primary small', onclick: () => {
          if (showTokens(cfg.show).some(v => ARENA_LOCK[v] && !hasCosmetic(ARENA_LOCK[v]))) return toast('Part of that light show is still locked.');
          if (cost) { const err = spend(save, team, cost, 'Arena: ' + unpaid.map(([k, v]) => ARENA_OPTS[k][v]).join(', ')); if (err) return toast(err); for (const [k, v] of unpaid) arenaOwned(team).push(k + ':' + v); }
          if (cfg.venue === 'palace' && typeof grantCosmetic === 'function') grantCosmetic(save, 'palace_qp', 'Built the Grand Soccer Palace');
          team.arena = Object.assign({}, cfg); Store.autosave(save); toast(cost ? 'Purchased and applied to your home games.' : 'Arena updated.'); render();
        } }, cost ? 'BUY & APPLY (' + fmtM(cost) + ')' : 'APPLY'),
        h('button', { class: 'small', onclick: () => { save.arenaPresets.push({ name: 'Arena ' + (save.arenaPresets.length + 1), cfg: Object.assign({}, cfg) }); if (save.arenaPresets.length > 6) save.arenaPresets.shift(); Store.autosave(save); render(); } }, 'SAVE PRESET'),
        h('button', { class: 'small', onclick: () => { cfg = teamArena(team); render(); } }, 'RESET'))));
    const presetEl = () => save.arenaPresets.length ? (h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'ARENA PRESETS'), save.arenaPresets.map((pr, i) => h('div', { class: 'hotrow' }, h('span', { style: { flex: 1 } }, pr.name + ' · ' + ARENA_OPTS.lighting[pr.cfg.lighting] + ', ' + ARENA_OPTS.seats[pr.cfg.seats] + ', ' + ARENA_OPTS.deco[pr.cfg.deco]),
      h('button', { class: 'small', onclick: () => { cfg = Object.assign({}, ARENA_DEFAULT, pr.cfg); render(); } }, 'LOAD'), h('button', { class: 'small danger', onclick: () => { save.arenaPresets.splice(i, 1); Store.autosave(save); render(); } }, 'DELETE'))))) : h('div', { class: 'panel muted' }, 'No presets saved yet: use SAVE PRESET on the CUSTOMIZE tab.');
    body.appendChild(buyEl);
    body.appendChild(tabbed('arena', [{ label: 'PITCH & STANDS', el: customEl(0) }, { label: 'LIGHTS & SOUND', el: customEl(1) }, { label: 'BUILDING', el: buildEl }, { label: 'PRESETS (' + save.arenaPresets.length + ')', el: presetEl }, { label: 'AROUND THE LEAGUE', el: () => road }],
      { onShow: () => setTimeout(() => typeof fitZoomEl === 'function' && fitZoomEl(body.querySelector('.tabbody')), 0) }));
  };
  // the road: every other club's building
  var road = h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'AROUND THE LEAGUE (where you play away games)'),
    h('div', { class: 'grid g3' }, save.teamOrder.filter(id => id !== team.id).map(id => { const t = T(id), a = teamArena(t); return h('div', { class: 'hotrow' }, badge(t, 22), h('div', { style: { flex: 1 } }, h('div', { style: { fontSize: '8px' } }, arenaTitle(t, a)), h('div', { class: 'muted', style: { fontSize: '7px' } }, VENUES[a.venue].name))); })));
  render();
  return h('div', { class: 'screen' }, header('ARENA', () => go(scrHub)), body);
}
// draws a crop of the arena (stands, aisles, a concourse) with the given config into a preview canvas
// the goal horn can't be seen: picking one plays it
function hornSample(v) {
  try { initAudio(); const keep = S.match; S.match = { arena: { horn: v } }; try { sfx.horn(); } finally { S.match = keep; } } catch (e) {}
}
function previewArena(cv, cfg, team, noLogo) {
  const oldM = S.match, oldT0 = TEAM[0], oldR = Math.random;
  // always the same crowd (a fixed seed), three quarters full, so every option is easy to see and compare
  let seed = 12345; Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  try {
    const save = UI.save;
    const retired = save ? Object.values(save.players).filter(p => p.status === 'retired' && p.lastTeamId === team.id && (p.awards || []).length + (p.allStar || []).filter(x => x.team === 1).length >= 2).map(p => p.num).slice(0, 8) : [];
    S.match = { arena: cfg, home: 0, fill: 0.75, retired, banners: (save ? save.trophies.filter(t => t.teamId === team.id && t.type === 'league').map(t => ({ year: seasonLabel(t.year || 0).slice(-2) })) : []) };
    TEAM[0] = teamPalette(teamIdentity(team), false);
    STAD.preview = true; buildRink(); stadPreview(cv);
    if (!noLogo) arenaPreviewOverlays(cv, cfg, team);
  } catch (e) { console.warn('arena preview', e); }
  finally { Math.random = oldR; S.match = oldM; TEAM[0] = oldT0; STAD.preview = false; rinkImg = null; crowdImgs = null; STAD.g = null; STAD.sides = { L: null, R: null }; STAD.walkers = []; }
}
// everything else the options change, drawn over the stands so each choice shows: the Jumbotron message and the
// banners in the rafters (top), the rink boards with their ads and the centre-ice logo (bottom), the lighting,
// and a sample of the goal fireworks / confetti
// the preview's right side: a real slice of centre ice from the rink image just built with these options (the
// centre-ice logo, the side boards and their ads, the glass), drawn 1:1 so it looks as it will in a game
const APV_RINK_W = 352;
function arenaPreviewIce(c, w, hgt) {
  if (typeof rinkImg === 'undefined' || !rinkImg) return 0;
  const x0 = w - APV_RINK_W, y0 = 50, wx0 = CX - APV_RINK_W / 2, led = typeof boardStyleOf === 'function' && boardStyleOf(arenaCfg()).led && typeof drawBoardsLive === 'function';
  // two real slices: the far end (boards, ads, corner glass) on top, centre ice (the logo, the side boards) below
  const endH = 92, iceH = hgt - y0 - endH - 3;
  // z: zoom (the end boards are shown at 2x so the ads and glass can be read)
  const slice = (wy0, sy, sh, z = 1) => {
    const ww = APV_RINK_W / z, wxa = CX - ww / 2, wh = sh / z;
    c.save(); c.beginPath(); c.rect(x0, sy, APV_RINK_W, sh); c.clip();
    c.fillStyle = '#05060d'; c.fillRect(x0, sy, APV_RINK_W, sh);
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(rinkImg, wxa * K, wy0 * K, ww * K, wh * K, x0, sy, APV_RINK_W, sh);
    c.imageSmoothingEnabled = false;
    { const keep = ctx; ctx = c; c.setTransform(z, 0, 0, z, x0 - wxa * z, sy - wy0 * z);   // SOCCER: the ball-stop net (drawn live in a game), then LED boards
      try { if (typeof drawBallStopNet === 'function') drawBallStopNet(c, ballStopNetCol(arenaCfg())); if (led) drawBoardsLive(true); } catch (e) {} finally { ctx = keep; c.setTransform(1, 0, 0, 1, 0, 0); } }
    c.restore();
  };
  slice(R.t - BOARD_FACE - 17, y0, endH, 2);
  c.fillStyle = '#05060d'; c.fillRect(x0, y0 + endH, APV_RINK_W, 3);
  slice(CY - iceH / 2, y0 + endH + 3, iceH);
  c.fillStyle = '#05060d'; c.fillRect(x0 - 2, y0, 2, hgt - y0);
  const tag = (t, y) => { c.fillStyle = 'rgba(5,6,13,.85)'; c.fillRect(x0 + 2, y, pTextW(t) + 6, 9); pText(c, t, x0 + 5, y + 2, '#ffd23f'); };
  tag('HOARDINGS AND NETS', y0 + endH - 11); tag('CENTRE PITCH', y0 + endH + 5);
  return x0;
}
function arenaPreviewOverlays(cv, cfg, team) {
  const c = cv.getContext('2d'), w = cv.width, hgt = cv.height, H0 = TEAM[0];
  c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false;
  const iceX = arenaPreviewIce(c, w, hgt) || w;
  // lighting over the whole scene
  if (cfg.lighting === 'dim') { c.fillStyle = 'rgba(0,0,8,.32)'; c.fillRect(0, 0, w, hgt); }
  else if (cfg.lighting === 'bright') { c.fillStyle = 'rgba(255,255,240,.1)'; c.fillRect(0, 0, w, hgt); }
  else if (cfg.lighting === 'disco') {
    c.fillStyle = 'rgba(0,0,10,.25)'; c.fillRect(0, 0, w, hgt);
    c.save(); c.globalCompositeOperation = 'lighter';
    [['#ff3ea5', 70, 140], ['#3ec8ff', 200, 110], ['#ffd23f', 290, 190], ['#5ee07a', 130, 230]].forEach(([col, x, y]) => {
      const g = c.createRadialGradient(x, y, 2, x, y, 46); g.addColorStop(0, col + 'aa'); g.addColorStop(1, col + '00'); c.fillStyle = g; c.beginPath(); c.arc(x, y, 46, 0, 7); c.fill();
      c.fillStyle = col + '22'; c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(x - 18, y); c.lineTo(x + 18, y); c.fill();
    });
    c.restore();
  }
  // the rafters: Jumbotron with your message on the left, banners on the right
  c.fillStyle = 'rgba(5,6,13,.92)'; c.fillRect(0, 0, w, 50);
  { const x = 6, y = 6, bw = 104, bh = 38;
    c.fillStyle = H0.dark; c.fillRect(x - 2, y - 2, bw + 4, bh + 4); c.fillStyle = '#0b1020'; c.fillRect(x, y, bw, bh);
    const msg = (cfg.text || ('GO ' + (team.nick || team.abbr) + '!')).toUpperCase().slice(0, 24);
    const k = Math.max(1, Math.min(2, Math.floor((bw - 6) / Math.max(1, pTextW(msg)))));
    pText(c, msg, x + (bw - pTextW(msg) * k) / 2, y + bh / 2 - 3 * k, '#ffffff', k);
    c.fillStyle = H0.main; c.fillRect(x, y + bh - 3, bw, 3); }
  { c.save(); c.translate(118, 0); c.scale(2, 2);
    const items = S.match.banners || [];
    const none = (cfg.banners === 'champions' && !items.length) || (cfg.banners === 'retired' && !(S.match.retired || []).length);
    if (none) { c.globalAlpha = 0.35; c.strokeStyle = '#9aa3c7'; c.setLineDash([1, 1]); c.lineWidth = 0.5; c.strokeRect(4, 3, 16, 18); c.setLineDash([]); c.globalAlpha = 1; }
    else { drawBanners(c, 120, 22, 'R', cfg); drawBanners(c, 120, 22, 'L', cfg); }
    c.restore();
    if (none) pText(c, cfg.banners === 'retired' ? 'NO RETIRED NUMBERS YET' : 'NO TITLES YET', 168, 20, '#9aa3c7'); }
  // goal effects (decorations): a sample burst up in the rafters
  if (cfg.deco === 'fireworks' || cfg.deco === 'confetti') {
    const cx = w - 50, cy = 90;
    if (cfg.deco === 'fireworks') for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283, r = 18 + (i % 3) * 5; c.fillStyle = ['#ffd23f', '#ff4a3d', '#ffffff', H0.main][i % 4]; c.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 3, 3); }
    else for (let i = 0; i < 60; i++) { c.fillStyle = [H0.main, H0.trim || '#fff', '#ffd23f', '#ff5fa2'][i % 4]; c.fillRect(Math.round(30 + ((i * 97) % (w - 60))), Math.round(56 + ((i * 53) % 120)), 2, 3); }
    c.fillStyle = 'rgba(5,6,13,.8)'; c.fillRect(cx - 34, cy + 30, 68, 11); pText(c, 'ON GOALS', cx - pTextW('ON GOALS') / 2, cy + 32, '#ffd23f');
  }
  // the rink boards along the bottom with their ads, and the centre-ice logo sample in the corner
  if (iceX < w) return;   // the real slices on the right already show the boards, ads, glass and centre ice
  { const y = hgt - 30, x1 = w - 60, adCols = { classic: [['#1b2a5c', '#ffd23f'], ['#d9342b', '#ffffff'], ['#16a085', '#ffffff']], retro: [['#2b0a3d', '#ff4fd8'], ['#05060d', '#5ee07a'], ['#102a6b', '#7ec8ff']], local: [['#6b4423', '#f1e3b5'], ['#2f5d3a', '#ffffff'], ['#8a3a26', '#ffe2a8']], team: [[H0.dark, H0.trim], [H0.main, '#ffffff'], [H0.trim, H0.dark]], premium: [['#0b0b0f', '#d9b25a'], ['#1a1a1a', '#ffffff'], ['#2b2f45', '#cfd6ff']], charity: [['#ff7aa8', '#ffffff'], ['#ffffff', '#d9342b'], ['#2a8f5a', '#ffffff']] }[cfg.ads] || [];
    const words = (AD_SETS[cfg.ads] || AD_SETS.classic).map(a => a.replace('{N}', (H0.nick || '').toUpperCase()).replace('{A}', H0.abbr || ''));
    // the real thing: a slice of the far end of YOUR rink (the corner glass, the boards in the chosen style, the ads),
    // cut from the rink image just built with these options; LED boards lit up as they are in a game
    if (typeof rinkImg !== 'undefined' && rinkImg) {
      const sc = 2, wx0 = R.l - 8, wy0 = R.t - 23, sh = 54, sy0 = hgt - sh, ww = x1 / sc, wh = sh / sc;
      c.save(); c.beginPath(); c.rect(0, sy0, x1, sh); c.clip();
      c.drawImage(rinkImg, wx0 * K, wy0 * K, ww * K, wh * K, 0, sy0, x1, sh);
      if (typeof drawBoardsLive === 'function') {
        const keep = ctx; ctx = c; c.setTransform(sc, 0, 0, sc, -wx0 * sc, sy0 - wy0 * sc);
        try { if (typeof drawBallStopNet === 'function') drawBallStopNet(c, ballStopNetCol(cfg)); if (boardStyleOf(cfg).led) drawBoardsLive(true); } finally { ctx = keep; c.setTransform(1, 0, 0, 1, 0, 0); }
      }
      c.restore();
      c.fillStyle = 'rgba(5,6,13,.85)'; c.fillRect(2, sy0 + 2, pTextW('HOARDINGS AND NETS') + 6, 9); pText(c, 'HOARDINGS AND NETS', 5, sy0 + 4, '#ffd23f');
    } else {
      c.fillStyle = '#dfe9f4'; c.fillRect(0, y - 4, x1, 34); c.fillStyle = '#c94a3a'; c.fillRect(0, y - 4, x1, 2);
      const pw = Math.floor((x1 - 8) / 3);
      for (let i = 0; i < 3; i++) { const [bg, fg] = adCols[i] || [H0.main, '#fff'], px0 = 4 + i * pw, wd = words[i] || '';
        c.fillStyle = bg; c.fillRect(px0, y + 1, pw - 4, 20); pText(c, wd, px0 + (pw - 4 - pTextW(wd)) / 2, y + 8, fg, 1); }
    }
    c.fillStyle = '#dfe9f4'; c.fillRect(w - 56, hgt - 56, 52, 52); c.strokeStyle = '#2a5bd7'; c.strokeRect(w - 50, hgt - 50, 40, 40);
    if (cfg.logo === 'crest') { c.fillStyle = H0.main; c.fillRect(w - 56, hgt - 40, 52, 3); c.fillRect(w - 56, hgt - 22, 52, 3); }
    if (cfg.logo !== 'classic') drawEmblemBadge(c, teamIdentity(team), w - 30, hgt - 30, cfg.logo === 'crest' ? 18 : 15);
    else { c.strokeStyle = '#c94a3a'; c.beginPath(); c.arc(w - 30, hgt - 30, 14, 0, 7); c.stroke(); c.fillStyle = '#c94a3a'; c.fillRect(w - 31, hgt - 31, 2, 2); }
    if (cfg.logo === 'wordmark') pText(c, team.abbr, w - 30 - pTextW(team.abbr) / 2, hgt - 14, '#05060d'); }
}

// ====================================================================
//  TROPHY ROOMS: Wooden Memorabilia Room, Professional Gallery, Grand Hall of Fame (+ Champions' Vault)
// ====================================================================
const ROOMS = {
  wood: { name: 'Wooden Memorabilia Room', short: 'WOODEN ROOM', req: 'Available from day one.', ok: s => true },
  gallery: { name: 'Professional Gallery', short: 'GALLERY', req: 'Win your first League Championship.', ok: s => userTitles(s, 'league').length >= 1 },
  hall: { name: 'Grand Hall of Fame', short: 'HALL OF FAME', req: 'Win three League Championships (or earn THE LEGEND / Immortals achievements).', ok: s => userTitles(s, 'league').length >= 3 || !!(s.ach.legend && s.ach.legend.done) || !!(s.ach.hof && s.ach.hof.done) },
  vault: { name: "Champions' Vault", short: 'VAULT', req: 'Win 12 trophies of any kind.', ok: s => userTitles(s).length >= 12 },
  secrets: { name: 'Secrets Room', short: 'SECRETS', req: 'Always open.', ok: s => true, secret: true },   // account-wide secrets (aliens.js): hints only
};
const ROOM_DECOR = {
  finish: { wood: { oak: 0, walnut: 600, cherry: 900 }, gallery: { white: 0, charcoal: 1200, navy: 1200 }, hall: { marble: 0, granite: 1800, goldleaf: 4500 }, vault: { steel: 0, bronze: 2500, obsidian: 3800 } },
  light: { warm: 0, cool: 300, spot: 900, neon: 1400 },
  furn: { none: 0, benches: 350, tables: 900, ropes: 1200 },
  arr: { date: 0, type: 0, featured: 250 },
};
const DECOR_NAMES = { oak: 'Oak panels', walnut: 'Walnut panels', cherry: 'Cherry panels', white: 'Gallery white', charcoal: 'Charcoal', navy: 'Navy', marble: 'Marble', granite: 'Granite', goldleaf: 'Gold leaf', steel: 'Steel', bronze: 'Bronze', obsidian: 'Obsidian',
  warm: 'Warm lights', cool: 'Cool lights', spot: 'Spotlights', neon: 'Neon trim', none: 'No furniture', benches: 'Leather benches', tables: 'Display tables', ropes: 'Velvet ropes', date: 'By date', type: 'By type', featured: 'Featured first' };
const roomState = (team, r) => { team.rooms = team.rooms || {}; return team.rooms[r] || (team.rooms[r] = { finish: Object.keys(ROOM_DECOR.finish[r])[0], light: 'warm', furn: 'none', arr: 'date', owned: [] }); };
const unlockedRooms = save => Object.keys(ROOMS).filter(k => !ROOMS[k].secret && ROOMS[k].ok(save));
function roomItems(save, r) { const def = 'wood'; return (save.memorabilia || []).filter(it => (it.room && ROOMS[it.room] && ROOMS[it.room].ok(save) ? it.room : def) === r); }
function scrRooms() {
  const save = UI.save, team = T(save.userTeamId);
  let room = UI.room && ROOMS[UI.room] && ROOMS[UI.room].ok(save) ? UI.room : 'wood', preview = null;
  const body = h('div'), tabs = h('div', { class: 'tabs' });
  const render = () => {
    UI.room = room; tabs.innerHTML = ''; body.innerHTML = '';
    for (const [k, R0] of Object.entries(ROOMS)) { const ok = R0.ok(save); tabs.appendChild(h('button', { class: (k === room ? 'sel' : '') + (ok ? '' : ' muted'), title: ok ? R0.name : R0.name + ' (locked): ' + R0.req, onclick: () => { if (!ok) return toast('Locked: ' + R0.req); room = k; preview = null; render(); } }, (R0.short || R0.name.toUpperCase()) + (ok ? '' : ' \uE001'))); }
    const locked = Object.values(ROOMS).filter(R0 => !R0.ok(save) && !R0.secret);
    if (locked.length) tabs.appendChild(h('span', { class: 'muted roomreq', 'data-help': locked.map(R0 => R0.name + ': ' + R0.req).join(' · ') }, '🔒 ' + locked.length + ' locked (hover)'));
    if (ROOMS[room].secret && typeof secretsRoomEl === 'function') { body.appendChild(secretsRoomEl(render)); return; }
    const st = Object.assign({}, roomState(team, room), preview || {});
    const items = roomItems(save, room).slice();
    if (st.arr === 'type') items.sort((a, b) => String(a.kind).localeCompare(String(b.kind))); else if (st.arr === 'featured') items.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (b.s || 0) - (a.s || 0)); else items.sort((a, b) => (a.s || 0) - (b.s || 0));
    const cv = h('canvas', { width: 480, height: 200, class: 'px roomcv', style: { width: '100%', maxWidth: '100%', height: 'auto', cursor: 'pointer' } });
    drawRoom(cv, room, st, items, save, team);
    // the trophy case stands in every room: click it to open it
    cv.onclick = e => { const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * cv.width / r.width, y = (e.clientY - r.top) * cv.height / r.height;
      const J = cv._cj; if (J && x >= J.x && x <= J.x + J.w && y >= J.y && y <= J.y + J.h && typeof clubJerseyDlg === 'function') return clubJerseyDlg(team, save, render);
      if (x >= cv.width - (cv._caseW || TCASE_W + 12)) go(scrTrophies); };
    const nT = save.trophies.filter(t => t.teamId === team.id).length;
    const viewEl = (h('div', { class: 'panel', style: { textAlign: 'center' } }, cv, preview ? h('div', { class: 'gold sub' }, 'PREVIEW — not purchased yet') : null,
      h('div', { class: 'sub', style: { margin: '4px 0 0' } }, `TROPHY CASE: ${nT ? nT + ' troph' + (nT > 1 ? 'ies' : 'y') + ' (click the case to open it)' : 'empty for now'} · CLUB JERSEY: click it to customize `,
        typeof clubJerseyDlg === 'function' ? h('button', { class: 'small', style: { marginLeft: '6px' }, onclick: () => clubJerseyDlg(team, save, render) }, '🎨 CUSTOMIZE JERSEY') : null)));
    // decor shop
    const f = finOf(team), own = roomState(team, room);
    // one dropdown per part (picking one previews it; nothing is bought until BUY & APPLY)
    const opts = (k, list) => h('label', { class: 'decorow' }, h('span', { class: 'gold' }, { finish: 'FINISH', light: 'LIGHTING', furn: 'FURNITURE', arr: 'ARRANGEMENT' }[k]),
      h('select', { onchange: e => { preview = Object.assign({}, preview || {}, { [k]: e.target.value }); render(); } },
        Object.entries(list).map(([v, price]) => { const has = !price || dbgFree() || own.owned.includes(k + ':' + v); return h('option', { value: v, selected: st[k] === v }, DECOR_NAMES[v] + (has ? (price ? ' · owned' : '') : ' · ' + fmtM(price))); })));
    const pending = preview ? Object.entries(preview).filter(([k, v]) => { const price = (k === 'finish' ? ROOM_DECOR.finish[room] : ROOM_DECOR[k])[v]; return price && !dbgFree() && !own.owned.includes(k + ':' + v); }) : [];
    const cost = pending.reduce((a, [k, v]) => a + (k === 'finish' ? ROOM_DECOR.finish[room] : ROOM_DECOR[k])[v], 0);
    const cv2 = h('canvas', { width: 480, height: 200, class: 'px roomcv', style: { width: '100%', maxWidth: '100%', height: 'auto' } }); drawRoom(cv2, room, st, items, save, team);
    const decoEl = () => (h('div', { class: 'panel', style: { display: 'grid', gridTemplateColumns: 'minmax(0, 44%) minmax(0, 1fr)', gap: '14px', alignItems: 'start' } }, h('div', null, cv2), h('div', { style: { minWidth: 0 } }, h('h3', { style: { marginTop: 0 } }, 'DECORATE: ' + ROOMS[room].name.toUpperCase()),
      opts('finish', ROOM_DECOR.finish[room]), opts('light', ROOM_DECOR.light), opts('furn', ROOM_DECOR.furn), opts('arr', ROOM_DECOR.arr),
      h('div', { class: 'row', style: { justifyContent: 'flex-start' } },
        h('button', { class: 'primary', disabled: !preview, onclick: () => {
          if (cost) { const err = spend(save, team, cost, 'Trophy room: ' + pending.map(([, v]) => DECOR_NAMES[v]).join(', ')); if (err) return toast(err); for (const [k, v] of pending) own.owned.push(k + ':' + v); }
          Object.assign(own, preview); preview = null; Store.autosave(save); toast(cost ? 'Purchased!' : 'Room updated.'); render();
        } }, cost ? 'BUY & APPLY (' + fmtM(cost) + ')' : 'APPLY'), h('button', { disabled: !preview, onclick: () => { preview = null; render(); } }, 'CANCEL PREVIEW'),
        h('span', { class: 'muted', style: { fontSize: '7px' } }, 'Funds ' + fmtM(f.cash))))));
    // items: move between unlocked rooms (attribution stays with each piece)
    const rooms = unlockedRooms(save);
    const itemsEl = () => (h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, `ON DISPLAY HERE (${items.length})`),
      items.length ? pages('roomitems' + room, items, 6, sl => h('div', null, sl.map(it => h('div', { class: 'hotrow' }, memoCanvas(it, 28), h('div', { style: { flex: 1, fontSize: '7px' } }, h('b', { class: 'gold' }, it.name), ' — ', it.text, it.playerName ? h('span', { class: 'muted' }, ` · #${it.num} ${it.playerName}`) : null),
        h('label', { style: { fontSize: '7px' } }, h('input', { type: 'checkbox', checked: !!it.featured, onchange: e => { it.featured = e.target.checked; Store.autosave(save); render(); } }), ' featured '),
        rooms.length > 1 ? h('select', { onchange: e => { it.room = e.target.value; Store.autosave(save); render(); } }, rooms.map(r => h('option', { value: r, selected: r === room }, 'Room: ' + ROOMS[r].name))) : null))))
        : h('div', { class: 'muted' }, 'Nothing on display in this room yet.'),
      h('div', { class: 'hint' }, 'Rooms unlock through achievements. Memorabilia keeps its player, number, season, award and team wherever you display it.')));
    body.appendChild(tabbed('rooms', [{ label: 'THE ROOM', el: viewEl }, { label: 'DECORATE', el: decoEl }, { label: 'ON DISPLAY (' + items.length + ')', el: itemsEl }]));
    // the room fills the screen: as wide as the panel allows, then just small enough that nothing scrolls
    // (if THE ROOM isn't the open tab yet, it waits until it is shown)
    let tries = 0;
    const fit = () => { const a = document.getElementById('app'); if (!a || tries++ > 600) return; if (!cv.isConnected || !cv.offsetParent) return setTimeout(fit, 120);
      let pct = 100; const set = v => cv.style.setProperty('width', v + '%', 'important'); set(pct);
      while (pct > 30 && a.scrollHeight > a.clientHeight) { pct -= 2; set(pct); } };
    setTimeout(fit, 0);
  };
  render();
  return h('div', { class: 'screen' }, header('TROPHY ROOMS', () => go(scrHub)), tabs, body);
}
function drawRoom(cv, room, st, items, save, team) {
  const c = cv.getContext('2d'), w = cv.width, h0 = cv.height; c.imageSmoothingEnabled = false;
  const wall = { oak: ['#7a4f2a', '#5e3b1f'], walnut: ['#4e3220', '#3a2416'], cherry: ['#8a3a26', '#66281a'], white: ['#e8e6e0', '#cfcac0'], charcoal: ['#3a3d45', '#2a2c33'], navy: ['#1d2b4f', '#141f3a'],
    marble: ['#e6e2da', '#c9c3b8'], granite: ['#5a5c62', '#44464c'], goldleaf: ['#c9a050', '#a07c30'], steel: ['#6f7884', '#565e69'], bronze: ['#8a6232', '#6b4a24'], obsidian: ['#1a1a22', '#0e0e14'] }[st.finish] || ['#7a4f2a', '#5e3b1f'];
  c.fillStyle = wall[0]; c.fillRect(0, 0, w, h0 * 0.72);
  c.fillStyle = wall[1]; for (let x = 0; x < w; x += room === 'wood' ? 12 : 30) c.fillRect(x, 0, 1, h0 * 0.72);
  if (room === 'hall' || room === 'vault') for (let x = 18; x < w; x += 60) { c.fillStyle = wall[1]; c.fillRect(x, 10, 10, h0 * 0.62); c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(x + 1, 10, 2, h0 * 0.62); }   // columns
  c.fillStyle = room === 'gallery' ? '#b8b2a6' : room === 'hall' ? '#7a1f2a' : room === 'vault' ? '#2a2f3a' : '#4a3018'; c.fillRect(0, h0 * 0.72, w, h0 * 0.28);   // floor / carpet
  // the club banner hanging on the left wall: the team name on top, a line for every playoff final won
  const bannerW = drawClubBanner(c, 6, 0, h0, team, save);
  drawRecordsBoard(c, 234, 3, team, save);
  if (room === 'hall') {
    const legends = Object.values(save.players).filter(p => p.status === 'retired' && p.lastTeamId === team.id && (p.awards || []).length + (p.allStar || []).filter(x => x.team === 1).length >= 2).slice(0, 6);
    legends.forEach((p, i) => { const x = w - 26 - i * 24; c.fillStyle = team.colors.s; c.fillRect(x, 4, 20, 24); pText(c, String(p.num), x + 10 - pTextW(String(p.num)) / 2, 12, '#ffffff'); });   // retired jerseys
    // statues of the very best
    legends.slice(0, 2).forEach((p, i) => { const x = i ? w - 40 : 24, y = h0 * 0.72; c.fillStyle = '#9a9a9a'; c.fillRect(x - 6, y - 4, 16, 6); c.fillStyle = '#b8b8b8'; c.fillRect(x - 2, y - 26, 8, 22); c.fillRect(x - 1, y - 32, 6, 6); c.fillRect(x + 6, y - 24, 6, 2); });
  }
  // shelves / pedestals with the memorabilia
  const shelfY = [h0 * 0.36, h0 * 0.62];
  // the first spot on the top shelf: the club's framed jersey (on the wall from day one)
  const x0 = bannerW + 22;                                                   // everything on the wall starts right of the banner
  const JF = typeof CJ_W !== 'undefined' ? CJ_W + 6 : 58;
  drawFramedJersey(c, x0 - 4, typeof CJ_W !== 'undefined' ? 22 : 30, team, save);
  cv._cj = { x: x0 - 6, y: 16, w: JF, h: 80 };
  const perShelf = Math.max(1, Math.floor((w - x0 - JF - TCASE_W - 12) / 46));   // the jersey frame takes the first part of the top shelf
  items.slice(0, perShelf * 2).forEach((it, i) => {
    const sh = Math.floor(i / perShelf), k = i % perShelf, x = x0 + JF * (1 - sh) + k * 46, y = shelfY[sh];
    if (room === 'wood') { c.fillStyle = '#3a2412'; c.fillRect(x - 6, y + 2, 42, 3); } else { c.fillStyle = room === 'gallery' ? '#ffffff' : '#d8d2c8'; c.fillRect(x, y - 2, 30, 6); c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x + 2, y + 4, 26, 2); }
    try { const m = memoCanvas(it, 30); c.drawImage(m, x, y - 30, 30, 30); } catch (e) { /* skip */ }
    if (it.featured) { c.fillStyle = '#ffd23f'; c.fillRect(x + 13, y - 34, 4, 2); }
  });
  // furniture
  if (st.furn === 'benches') for (const x of [w * 0.25, w * 0.65]) { c.fillStyle = '#2a1a10'; c.fillRect(x, h0 * 0.84, 50, 6); c.fillStyle = '#5a2a1a'; c.fillRect(x, h0 * 0.82, 50, 3); }
  if (st.furn === 'tables') for (const x of [w * 0.2, w * 0.5, w * 0.8]) { c.fillStyle = '#d8d2c8'; c.fillRect(x - 12, h0 * 0.8, 24, 4); c.fillStyle = 'rgba(180,220,255,.35)'; c.fillRect(x - 10, h0 * 0.72, 20, 8); }
  if (st.furn === 'ropes') { c.fillStyle = '#c9a050'; for (let x = 10; x < w; x += 40) c.fillRect(x, h0 * 0.78, 2, 14); c.fillStyle = '#a0182a'; c.fillRect(10, h0 * 0.8, w - 20, 2); }
  // lighting
  if (st.light === 'cool') { c.fillStyle = 'rgba(120,170,255,.10)'; c.fillRect(0, 0, w, h0); }
  else if (st.light === 'warm') { c.fillStyle = 'rgba(255,200,120,.08)'; c.fillRect(0, 0, w, h0); }
  else if (st.light === 'spot') { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, 0, w, h0); for (let k = 0; k < Math.min(perShelf, 6); k++) { const x = 45 + k * 46; c.fillStyle = 'rgba(255,246,208,.18)'; c.beginPath(); c.moveTo(x - 4, 0); c.lineTo(x + 4, 0); c.lineTo(x + 22, h0 * 0.66); c.lineTo(x - 22, h0 * 0.66); c.fill(); } }
  else if (st.light === 'neon') { c.fillStyle = team.colors.a; c.fillRect(0, h0 * 0.72 - 1, w, 1); c.fillRect(0, 2, w, 1); c.fillStyle = 'rgba(255,80,200,.06)'; c.fillRect(0, 0, w, h0); }
  // the case first (its width decides where the room's middle is), then the centrepiece in front of everything
  const caseW = drawRoomTrophyCase(c, w, h0, room, save, team);
  cv._caseW = caseW;
  drawCentrepiece(c, w, h0, room, save, team, caseW);
  pText(c, ROOMS[room].name, 6, h0 - 8, '#ffffff');
}
// the team's trophy case, standing against the right wall of every room (the most recent trophies on show)
const TCASE_W = 104;
// the case grows with the collection: a glass display stand for the first few trophies, a full cabinet from 4, and a
// second cabinet beside it from 10. Trophies are shown half again bigger than before; any empty spot holds a faint
// "ghost" of a trophy the club has never won, with its name, so an empty case reads as a list of goals.
const TROPHY_PRESTIGE = { league: 6, toc: 5, finale: 4, winter: 3, classic: 3, inv: 2 };
const TROPHY_SHORT = { league: 'LEAGUE', inv: 'INVITE', classic: 'CLASSIC', winter: 'WINTER', finale: 'FINALE', toc: 'CHAMPS' };
const TROPHY_LONG = { league: 'LEAGUE CHAMPIONSHIP', inv: 'OPENING INVITATIONAL', classic: 'MIDSEASON CLASSIC', winter: 'WINTER CUP', finale: 'SEASON FINALE CUP', toc: 'TOURNAMENT OF CHAMPIONS' };
function drawRoomTrophyCase(c, w, h0, room, save, team) {
  const all = save.trophies.filter(t => t.teamId === team.id), n = all.length;
  const won = new Set(all.map(t => t.type)), missing = Object.keys(TROPHY_PRESTIGE).filter(k => !won.has(k)).sort((a, b) => TROPHY_PRESTIGE[b] - TROPHY_PRESTIGE[a]);
  const wood = room === 'vault' ? ['#3a3f4a', '#59606e', '#22262e'] : room === 'hall' ? ['#4a2e14', '#c9a050', '#2a1a0c'] : room === 'gallery' ? ['#e8e6e0', '#ffffff', '#b8b2a6'] : ['#3a2412', '#6a4424', '#24160a'];
  const floorY = Math.round(h0 * 0.72), cases = n >= 10 ? 2 : 1, stand = n <= 3;
  const list = all.slice().reverse();                     // newest first
  let shown = 0, ghostI = 0;
  for (let ci = cases - 1; ci >= 0; ci--) {               // left to right: the newest first
    const cw = TCASE_W, x0 = w - 8 - (ci + 1) * cw - ci * 6, shelves = stand ? 1 : 3;
    const y0 = stand ? floorY - 58 : 40, ch = stand ? 58 + 10 : floorY - y0 + 10;
    c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x0 + 4, y0 + ch, cw, 4);
    c.fillStyle = wood[0]; c.fillRect(x0, y0, cw, ch);
    c.fillStyle = wood[1]; c.fillRect(x0, y0, cw, 3); c.fillRect(x0, y0, 3, ch);
    c.fillStyle = wood[2]; c.fillRect(x0 + cw - 3, y0, 3, ch); c.fillRect(x0, y0 + ch - 6, cw, 6);
    const gx = x0 + 6, gy = y0 + 12, gw = cw - 12, gh = ch - 22;
    const g = c.createLinearGradient(0, gy, 0, gy + gh); g.addColorStop(0, '#1d2449'); g.addColorStop(1, '#10142a'); c.fillStyle = g; c.fillRect(gx, gy, gw, gh);
    const lab = stand ? 'DISPLAY' : 'TROPHIES';
    c.fillStyle = '#e0b050'; c.fillRect(x0 + 20, y0 + 4, cw - 40, 6); pText(c, lab, Math.round(x0 + cw / 2 - pTextW(lab) / 2), y0 + 5, '#3a2412');
    const sh = gh / shelves, tp = 1.5, slotW = Math.floor(gw / 3);
    for (let i = 0; i < shelves; i++) {
      const sy = Math.round(gy + (i + 1) * sh) - 6;
      c.fillStyle = wood[1]; c.fillRect(gx, sy, gw, 2); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(gx, sy + 2, gw, 1);
      for (let k = 0; k < 3; k++) {
        const tx = Math.round(gx + k * slotW + (slotW - 16 * tp) / 2), ty = Math.round(sy - 18 * tp), it = list[shown];
        if (it) { shown++; try { drawTrophy(c, it.type, tx, ty, tp, false); } catch (e) { /* skip */ } continue; }
        const gk = missing[ghostI++]; if (!gk) continue;
        if (typeof drawTrophyGhost === 'function') drawTrophyGhost(c, gk, tx, ty, tp);
        const nm = TROPHY_SHORT[gk]; pText(c, nm, Math.round(gx + k * slotW + slotW / 2 - pTextW(nm) / 2), sy + 4, '#5a6a9a');
      }
    }
    c.fillStyle = 'rgba(255,255,255,.07)'; c.beginPath(); c.moveTo(gx + 8, gy); c.lineTo(gx + 26, gy); c.lineTo(gx + 10, gy + gh); c.lineTo(gx, gy + gh); c.lineTo(gx, gy + Math.min(14, gh)); c.fill();   // glass glare
  }
  if (n > shown) { const t = '+' + (n - shown); pText(c, t, w - 14 - pTextW(t), 43, "#e0b050"); }
  return cases * TCASE_W + (cases - 1) * 6 + 12;          // the width it takes (the click area)
}
// the centrepiece: the club's biggest trophy (newest of its kind) alone on a pedestal in the middle of the room, under
// a spotlight, three times its shelf size, with a brass plaque. Before the first title: an empty pedestal and a ghost.
function drawCentrepiece(c, w, h0, room, save, team, caseW) {
  const all = save.trophies.filter(t => t.teamId === team.id);
  const best = all.slice().sort((a, b) => (TROPHY_PRESTIGE[b.type] || 0) - (TROPHY_PRESTIGE[a.type] || 0) || (b.season || 0) - (a.season || 0))[0];
  const floorY = Math.round(h0 * 0.72), cx = Math.round((w - caseW) / 2 + 30), tp = 2.5;
  const ped = room === 'vault' ? ['#59606e', '#3a3f4a'] : room === 'hall' ? ['#e6e2da', '#b8b0a2'] : room === 'gallery' ? ['#ffffff', '#cfcac0'] : ['#6a4424', '#3a2412'];
  // spotlight cone and its pool on the floor
  c.save(); c.globalCompositeOperation = 'lighter';
  const cone = c.createLinearGradient(0, 0, 0, floorY + 26); cone.addColorStop(0, 'rgba(255,240,190,.02)'); cone.addColorStop(1, 'rgba(255,240,190,.16)');
  c.fillStyle = cone; c.beginPath(); c.moveTo(cx - 6, 0); c.lineTo(cx + 6, 0); c.lineTo(cx + 34, floorY + 26); c.lineTo(cx - 34, floorY + 26); c.fill();
  c.fillStyle = 'rgba(255,240,190,.12)'; c.beginPath(); c.ellipse(cx, floorY + 28, 34, 6, 0, 0, Math.PI * 2); c.fill();
  c.restore();
  // pedestal: a column with a cap and a base, standing on the floor
  const pw = 34, top = floorY - 4, bot = floorY + 28;
  c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(cx - pw / 2 + 3, bot, pw, 3);
  c.fillStyle = ped[1]; c.fillRect(cx - pw / 2 - 3, bot - 4, pw + 6, 4); c.fillRect(cx - pw / 2 - 3, top, pw + 6, 4);
  c.fillStyle = ped[0]; c.fillRect(cx - pw / 2, top + 4, pw, bot - top - 8); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(cx - pw / 2 + 2, top + 4, 3, bot - top - 8);
  c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(cx + pw / 2 - 5, top + 4, 5, bot - top - 8);
  // brass plaque
  const pl = best ? (TROPHY_SHORT[best.type] || 'CUP') + ' ' + (seasonLabel(best.year || 0) || '').slice(-5) : 'YOUR FIRST TITLE';
  const plW = Math.min(pw + 18, pTextW(pl) + 6);
  c.fillStyle = '#7a5a20'; c.fillRect(cx - plW / 2 - 1, top + 10, plW + 2, 9); c.fillStyle = '#e0b050'; c.fillRect(cx - plW / 2, top + 11, plW, 7);
  pText(c, pl, Math.round(cx - pTextW(pl) / 2), top + 12, '#3a2412');
  const tx = Math.round(cx - 8 * tp), ty = Math.round(top - 18 * tp);
  if (best) drawTrophy(c, best.type, tx, ty, tp, true);
  else if (typeof drawTrophyGhost === 'function') drawTrophyGhost(c, 'league', tx, ty, tp);
}
// a framed jersey of the club on the wall, there from day one: the club's real home jersey (its pattern, colours and
// trim), the crest on the chest, and a brass name plate under the frame
function drawFramedJersey(c, x, y, team, save) {
  if (typeof drawClubJersey === 'function') return drawClubJersey(c, x, y, team, clubJerseyOf(team), save || (typeof UI !== 'undefined' ? UI.save : null));
  const K = typeof teamPalette === 'function' ? teamPalette(team) : { main: team.colors.p, dark: team.colors.s, trim: team.colors.a, style: team.style };
  const FW = 50, FH = 52;
  c.fillStyle = '#2a180c'; c.fillRect(x - 2, y - 2, FW + 4, FH + 4); c.fillStyle = '#c9a050'; c.fillRect(x - 1, y - 1, FW + 2, FH + 2);
  c.fillStyle = '#e4dccb'; c.fillRect(x, y, FW, FH); c.fillStyle = '#0e1226'; c.fillRect(x + 2, y + 2, FW - 4, FH - 4);   // mat + backing
  const bx = x + 13, by = y + 8, bw = 24, bh = 34;                     // body
  const px = (i, j, col) => { c.fillStyle = col; c.fillRect(i, j, 1, 1); };
  for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) px(bx + i, by + j, typeof jerseyColor === 'function' ? jerseyColor(K, i, j, bw, bh) : K.main);
  // sleeves (main colour, a trim stripe and a dark cuff), angled out from the shoulders
  for (const sd of [-1, 1]) for (let j = 0; j < 16; j++) { const w0 = 7, sx = sd < 0 ? bx - w0 - Math.floor(j / 4) : bx + bw + Math.floor(j / 4);
    for (let i = 0; i < w0; i++) px(sx + i, by + 1 + j, j >= 13 ? K.dark : (j === 9 || j === 10) ? K.trim : K.main); }
  // collar: a V in the dark colour with a trim edge
  for (let k = 0; k < 4; k++) { c.fillStyle = K.dark; c.fillRect(bx + 8 + k, by + k, bw - 16 - 2 * k, 1); }
  c.fillStyle = K.trim; c.fillRect(bx + 7, by, 1, 2); c.fillRect(bx + bw - 8, by, 1, 2);
  // the crest on the chest (16x16 emblem, centred)
  if (typeof drawEmblemPlain === 'function') try {
    // the crest stitched on with a 1px outline in the trim colour, so it reads on any pattern
    const e = document.createElement('canvas'); e.width = e.height = 18; const ec = e.getContext('2d'); drawEmblemPlain(ec, team, 1, 1, 1);
    const o = document.createElement('canvas'); o.width = o.height = 18; const oc = o.getContext('2d');
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) oc.drawImage(e, dx, dy);
    oc.globalCompositeOperation = 'source-in'; oc.fillStyle = K.trim; oc.fillRect(0, 0, 18, 18);
    c.drawImage(o, bx + 3, by + 7); c.drawImage(e, bx + 3, by + 7);
  } catch (e) {}
  // hanger hook + the name plate
  c.fillStyle = '#8a8f99'; c.fillRect(x + FW / 2 - 1, y + 3, 2, 4);
  const nm = (team.nick || team.abbr || '').toUpperCase().slice(0, 10), tw = pTextW(nm);
  c.fillStyle = '#7a5a20'; c.fillRect(x + FW / 2 - tw / 2 - 4, y + FH + 3, tw + 8, 9); c.fillStyle = '#e0b850'; c.fillRect(x + FW / 2 - tw / 2 - 3, y + FH + 4, tw + 6, 7);
  pText(c, nm, Math.round(x + FW / 2 - tw / 2), y + FH + 5, '#3a2410');
}
// the club banner: a tall rafter banner in the team's colours with the club name at the top, nothing else. It starts
// empty; every playoff final the club wins (the League Championship, the Tournament of Champions) adds a line, newest
// at the bottom, and the banner grows a little longer each time.
const BANNER_TITLES = { league: 'CHAMPS', toc: 'T.O.C.' };
function drawClubBanner(c, x, y, h0, team, save) {
  const C = team.colors || {}, bg = C.p || '#2a5bd7', edge = C.a || '#ffffff', dk = C.s || '#14275e';
  const wins = (save.trophies || []).filter(t => t.teamId === team.id && BANNER_TITLES[t.type]).sort((a, b) => (a.year || 0) - (b.year || 0));
  const W = 62, rows = wins.slice(-8), H = Math.min(Math.round(h0 * 0.68), 48 + Math.max(4, rows.length) * 10);
  c.fillStyle = '#3a3d45'; c.fillRect(x - 2, y + 2, W + 4, 3);                                  // the rod
  c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x + 2, y + 6, W, H);                                // shadow
  c.fillStyle = bg; c.fillRect(x, y + 4, W, H - 6);
  for (let k = 0; k < W / 2; k++) { c.fillRect(x + k, y + H - 2, 1, Math.max(0, 6 - Math.round(k * 12 / W) - 2)); c.fillRect(x + W - 1 - k, y + H - 2, 1, Math.max(0, 6 - Math.round(k * 12 / W) - 2)); }  // swallowtail
  c.fillStyle = edge; c.fillRect(x + 2, y + 6, W - 4, 1); c.fillRect(x + 2, y + 6, 1, H - 10); c.fillRect(x + W - 3, y + 6, 1, H - 10);
  // the club name at the top (city small, nickname big)
  const city = String(team.city || '').toUpperCase(), nick = String(team.nick || team.abbr || '').toUpperCase();
  const fit = s => { let t = s; while (t.length > 1 && pTextW(t) > W - 8) t = t.slice(0, -1); return t; };
  pText(c, fit(city), Math.round(x + W / 2 - pTextW(fit(city)) / 2), y + 10, edge);
  pText(c, fit(nick), Math.round(x + W / 2 - pTextW(fit(nick)) / 2), y + 18, '#ffffff');

  // the titles: one line each; until the first one, the space is simply empty
  rows.forEach((t, i) => { const yy = y + 32 + i * 10, yr = seasonLabel(t.year || 0).slice(-5), lab = BANNER_TITLES[t.type];
    c.fillStyle = dk; c.fillRect(x + 5, yy - 1, W - 10, 9);
    const txt = fit(lab + ' ' + yr); pText(c, txt, Math.round(x + W / 2 - pTextW(txt) / 2), yy, t.type === 'toc' ? '#ffffff' : '#ffd23f'); });
  return W;
}
// the records board: best season, all-time top scorer, biggest win (kept on the team as it happens)
function teamRecordLines(save, team) {
  const se = save.season, out = [];
  let best = null;
  for (const hs of save.history || []) { if (hs.userTeamId !== team.id || !hs.userRecord) continue; const r = hs.userRecord; if (!best || r.pts > best.pts) best = { pts: r.pts, txt: `${r.w}-${r.otl || 0}-${r.l} ${String(hs.label || '').slice(-5)}` }; }
  const cur = se && se.standings && se.standings[team.id];
  out.push(best ? 'BEST ' + best.txt : cur ? `NOW ${cur.w}-${cur.otl || 0}-${cur.l}` : 'BEST -');
  let top = null;
  for (const p of Object.values(save.players || {})) {
    let pts = 0; for (const e of p.seasons || []) if (e.teamId === team.id) pts += (e.g || 0) + (e.a || 0);
    if (p.teamId === team.id && se && se.stats && se.stats[p.id] && se.stats[p.id].reg) pts += se.stats[p.id].reg.g + se.stats[p.id].reg.a;
    if (pts > 0 && (!top || pts > top.pts)) top = { pts, name: p.last };
  }
  out.push(top ? `TOP ${top.name.toUpperCase().slice(0, 9)} ${top.pts}P` : 'TOP SCORER -');
  if (se && se.games) for (const g of Object.values(se.games)) {
    if (!g.played || (g.home !== team.id && g.away !== team.id)) continue;
    const us = g.home === team.id ? g.hs : g.as, them = g.home === team.id ? g.as : g.hs, m = us - them;
    if (m > 0 && (!team.recWin || m > team.recWin.m)) { const o = save.teams[g.home === team.id ? g.away : g.home]; team.recWin = { m, txt: `${us}-${them} ${o ? o.abbr : ''}` }; }
  }
  out.push(team.recWin ? 'BIG WIN ' + team.recWin.txt : 'BIG WIN -');
  return out;
}
function drawRecordsBoard(c, x, y, team, save) {
  const L = teamRecordLines(save, team), bw = 112, bh = 31;
  c.fillStyle = '#3a2412'; c.fillRect(x - 2, y - 2, bw + 4, bh + 4); c.fillStyle = '#0d1a14'; c.fillRect(x, y, bw, bh);
  pText(c, 'CLUB RECORDS', x + 3, y + 2, '#e0b050');
  L.forEach((t, i) => { let s0 = t; while (pTextW(s0) > bw - 6 && s0.length > 3) s0 = s0.slice(0, -1); pText(c, s0, x + 3, y + 9 + i * 7, '#e8f0ff'); });
}

// ====================================================================
//  New prestige content: account cosmetics and the achievements that unlock them
// ====================================================================
Object.assign(COSMETICS, {
  gold_gear: { name: 'Golden Gear', kind: 'gear', desc: 'Gold headbands, gloves, boots, boot stripes, shin pads and sock tape for your players.' },
  chrome_gear: { name: 'Silver Headbands', kind: 'gear', desc: 'Shining silver headbands.' },
  star_mask: { name: 'All-Star Keeper Shirt', kind: 'gear', desc: 'The star-studded keeper shirt.' },
  arena_show: { name: 'Arena Light Show', kind: 'arena', desc: 'Light-show lighting, goal fireworks and pyro jets for your arena.' },
  the_works: { name: 'The Works', kind: 'arena', desc: 'The full light show for your arena: lasers, pitch projection, pyro, mirror ball.' },
  led_boards: { name: 'Digital LED Hoardings', kind: 'arena', desc: 'Animated LED hoardings that cycle your sponsors and flash GOAL!' },
  premium_ads: { name: 'Premium Sponsors', kind: 'arena', desc: 'Big-name (made-up) sponsors on your hoardings.' },
  emblem_tiger: { name: 'Tiger Emblem', kind: 'emblem', emblem: 'tiger', desc: 'A roaring tiger crest.' },
  emblem_mask: { name: 'Keeper Gloves Emblem', kind: 'emblem', emblem: 'mask', desc: 'A pair of keeper gloves on your crest.' },
  logo_star: { name: 'Star-Burst Logo Shape', kind: 'logo', desc: 'A star-burst badge shape for your team logo.' },
  logo_studs: { name: 'Studded Logo Border', kind: 'logo', desc: 'Gold studs around your team logo.' },
  logo_sunburst: { name: 'Sunburst Logo Background', kind: 'logo', desc: 'Sun rays behind your team emblem.' },
  logo_gold: { name: 'Solid Gold Emblem', kind: 'logo', desc: 'Your emblem in solid gold, on the logo and the jerseys.' },
  logo_crest: { name: 'Royal Crest Logo Shape', kind: 'logo', desc: 'A heraldic shield with crown points for your team logo.' },
  logo_laurel: { name: 'Laurel Wreath Logo Border', kind: 'logo', desc: 'Champions\' laurels around your team logo.' },
  logo_crown: { name: 'Crown Logo Ornament', kind: 'logo', desc: 'A golden crown above your team logo.' },
  logo_wings: { name: 'Winged Logo Ornament', kind: 'logo', desc: 'Gold and white wings on your team logo.' },
  jersey_sunset: { name: 'Sunset Jersey', kind: 'jersey', style: 'sunset', desc: 'A jersey that fades from gold through red to violet.' },
  jersey_aurora: { name: 'Northern Lights Jersey', kind: 'jersey', style: 'aurora', desc: 'A jersey with shimmering northern lights across the chest.' },
});
const NEW_ACH = [
  { id: 'trophy10', name: 'Trophy Hunter', cat: 'Customization', desc: 'Win 10 trophies of any kind over your franchise history.', on: 'comp', goal: 10, prog: s => userTitles(s).length, reward: { cosmetic: 'gold_gear' } },
  { id: 'po10', name: 'Playoff Veterans', cat: 'Customization', desc: 'Win 10 playoff series over your franchise history.', on: 'comp', goal: 10, prog: s => (s.poSeriesWon || 0), reward: { cosmetic: 'chrome_gear' } },
  { id: 'glove2', name: 'Wall of Fame', cat: 'Customization', desc: 'Your keepers win the Golden Glove twice.', on: 'season', goal: 2, prog: s => s.awards.filter(a => a.key === 'glove' && a.teamId === s.userTeamId).length, reward: { cosmetic: 'star_mask' } },
  { id: 'sellout', name: 'Sellout Crowd', cat: 'Customization', desc: 'Reach 90 fan popularity.', on: 'game', test: s => finOf(s.teams[s.userTeamId]).pop >= 90, reward: { cosmetic: 'arena_show' } },
  { id: 'hof', name: 'Immortals', cat: 'Customization', desc: 'Three of your retired players finished their careers with two or more awards each (opens the Grand Hall of Fame).', on: 'season', goal: 3, prog: s => Object.values(s.players).filter(p => p.status === 'retired' && p.lastTeamId === s.userTeamId && (p.awards || []).length + (p.allStar || []).filter(x => x.team === 1).length >= 2).length },
  { id: 'topseed', name: 'Top Seed', cat: 'Customization', desc: 'Finish first in the regular-season standings.', on: 'season', goal: 1, prog: s => (s.history || []).filter(hs => hs.userFinish === 1).length, reward: { cosmetic: 'emblem_tiger' } },
  { id: 'glove1', name: 'Brick Wall', cat: 'Customization', desc: 'One of your keepers wins the Golden Glove.', on: 'season', goal: 1, prog: s => s.awards.filter(a => a.key === 'glove' && a.teamId === s.userTeamId).length, reward: { cosmetic: 'emblem_mask' } },
  { id: 'seasons5', name: 'Five-Year Plan', cat: 'Customization', desc: 'Complete five seasons with one franchise.', on: 'season', goal: 5, prog: s => (s.history || []).length, reward: { cosmetic: 'logo_star' } },
  { id: 'tour4', name: 'Road Warriors', cat: 'Customization', desc: 'Win four tournaments (any kind except the league championship).', on: 'comp', goal: 4, prog: s => userTitles(s).filter(t => t.type !== 'league').length, reward: { cosmetic: 'logo_studs' } },
  { id: 'wins100', name: 'Century Club', cat: 'Customization', desc: 'Win 100 regular-season games over your franchise history.', on: 'season', goal: 100, prog: s => (s.history || []).reduce((a, hs) => a + ((hs.userRecord && hs.userRecord.w) || 0), 0), reward: { cosmetic: 'logo_sunburst' } },
  { id: 'dynasty3', name: 'Golden Era', cat: 'Customization', desc: 'Win three League Championships.', on: 'comp', goal: 3, prog: s => userTitles(s, 'league').length, reward: { cosmetic: 'logo_gold' } },
  { id: 'champ1', name: 'First Banner', cat: 'Customization', desc: 'Win your first League Championship.', on: 'comp', goal: 1, prog: s => userTitles(s, 'league').length, reward: { cosmetic: 'logo_laurel' } },
  { id: 'seasons10', name: 'Decade of Soccer', cat: 'Customization', desc: 'Complete ten seasons with one franchise.', on: 'season', goal: 10, prog: s => (s.history || []).length, reward: { cosmetic: 'logo_crown' } },
  { id: 'gf90', name: 'Scoring Machine', cat: 'Customization', desc: 'Score 90 goals in one regular season.', on: 'season', goal: 90, prog: s => Math.max(0, ...(s.history || []).map(hs => (hs.userRecord && hs.userRecord.gf) || 0)), reward: { cosmetic: 'logo_wings' } },
  { id: 'silver20', name: 'Silverware Collector', cat: 'Customization', desc: 'Win 20 trophies of any kind over your franchise history.', on: 'comp', goal: 20, prog: s => userTitles(s).length, reward: { cosmetic: 'jersey_sunset' } },
  { id: 'po3', name: 'Playoff Pedigree', cat: 'Customization', desc: 'Win three playoff series over your franchise history.', on: 'comp', goal: 3, prog: s => (s.poSeriesWon || 0), reward: { cosmetic: 'logo_crest' } },
  { id: 'bigstage', name: 'Big Stage', cat: 'Customization', desc: 'Reach 85 fan popularity.', on: 'game', test: s => finOf(s.teams[s.userTeamId]).pop >= 85, reward: { cosmetic: 'led_boards' } },
  { id: 'contender', name: 'Contender', cat: 'Customization', desc: 'Make the playoffs three times with one franchise.', on: 'season', goal: 3, prog: s => (s.history || []).filter(hs => hs.playoffs && hs.playoffs.reach && hs.playoffs.reach[hs.userTeamId] != null).length, reward: { cosmetic: 'premium_ads' } },
  { id: 'showtime', name: 'Showtime', cat: 'Customization', desc: 'Win two League Championships.', on: 'comp', goal: 2, prog: s => userTitles(s, 'league').length, reward: { cosmetic: 'the_works' } },
  { id: 'fanfave', name: 'Fan Favourites', cat: 'Customization', desc: 'Reach 75 fan popularity.', on: 'game', test: s => finOf(s.teams[s.userTeamId]).pop >= 75, reward: { cosmetic: 'jersey_aurora' } },
];
for (const a of NEW_ACH) if (!ACH_BY_ID[a.id]) { ACHIEVEMENTS.push(a); ACH_BY_ID[a.id] = a; }
