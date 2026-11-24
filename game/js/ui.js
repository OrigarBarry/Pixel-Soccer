'use strict';
// ====================================================================
//  UI: menus, franchise hub and all management screens
// ====================================================================
const app = document.getElementById('app');
const UI = { save: null, saves: [], dayGids: [], statSort: { k: 'pts', dir: -1 }, statOpts: { scope: 'season', cat: 'reg', team: 'all', pos: 'S', retired: false } };

// ---------- tiny DOM helpers
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') { if (typeof v.fontSize === 'string' && /^[\d.]+px$/.test(v.fontSize)) { Object.assign(e.style, v, { fontSize: `calc(${Math.max(7.5, parseFloat(v.fontSize))}px * var(--ts, 1.2))` }); } else Object.assign(e.style, v); }
    else if (k === 'class') e.className = v;
    else if (k in e && k !== 'list') e[k] = v;
    else e.setAttribute(k, v);
  }
  for (const c of kids.flat(3)) if (c != null && c !== false) e.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  return e;
}
// ---------- THE STAGE (laptop): screens marked 'staged' are laid out on a fixed logical stage of at least 960 x 560 units and
// scaled up to fill the window (x1 to x1.6), with the type scale lifted a step, so a 1280 x 720 laptop shows 14 px body
// text and nothing scrolls. Screens are converted one at a time; the rest keep the old free layout until then.
// (The phone version later uses the same idea with a smaller stage: see the project's mobile plan.)
const STAGE = { w: 1000, h: 560, max: 1.6, tsBoost: 1.12 };
const stageScale = () => Math.max(1, Math.min(innerWidth / STAGE.w, innerHeight / STAGE.h, STAGE.max));
function applyStage() {
  if (typeof app === 'undefined' || !app) return;
  const staged = !!app.querySelector(':scope > .screen.staged'), s = staged ? stageScale() : 1;
  app.classList.toggle('staged', staged);
  app.style.zoom = staged ? String(s) : '';
  // viewport units don't shrink under zoom, so staged screens size themselves from these instead
  if (staged) { app.style.setProperty('--sw', (innerWidth / s) + 'px'); app.style.setProperty('--sh', (innerHeight / s) + 'px'); }
  else { app.style.removeProperty('--sw'); app.style.removeProperty('--sh'); }
  if (staged) app.style.setProperty('--ts', String((typeof TS !== 'undefined' ? TS : 1.2) * STAGE.tsBoost)); else app.style.removeProperty('--ts');
}
addEventListener('resize', () => { if (typeof app !== 'undefined' && app && app.classList.contains('staged')) applyStage(); });
// a paged list on a staged screen shows as many rows as the stage holds: get/set the page size, rerender, measure, repeat
function stageFitRows(node, rowSel, get, set, rerender, min = 3, max = 99) {
  let n = 0;
  const step = () => requestAnimationFrame(() => {
    if (!node.isConnected || n++ > 6 || !app.classList.contains('staged')) return;
    const row = node.querySelector(rowSel); if (!row) return;
    const rh = row.offsetHeight || 20, scr = app.querySelector(':scope > .screen');
    const spare = app.clientHeight - 24 - scr.offsetHeight, cur = get();
    const want = Math.max(min, Math.min(max, spare < 0 ? cur - Math.ceil(-spare / rh) : cur + Math.floor(spare / rh)));
    if (want !== cur) { set(want); rerender(); step(); }
  });
  step();
}
function go(render) {
  UI.cur = render; if (render === scrHub || render === scrMain) UI.stack = [];
  app.innerHTML = ''; const node = render();
  // every menu screen sits on the stage unless it opts out (class 'nostage')
  if (node && node.classList && node.classList.contains('screen') && !node.classList.contains('nostage')) node.classList.add('staged');
  app.appendChild(node); app.classList.add('show'); app.scrollTop = 0;
  applyStage();
  if (typeof Music !== 'undefined') Music.onScreen(render);
  if (typeof MenuBG !== 'undefined') { if (render === scrMain) { const m = UI.save ? UI.save.teams[UI.save.userTeamId] : (UI.saves.slice().sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))[0]); if (!(typeof Demo !== 'undefined' && (Demo.on || demoStart()))) MenuBG.show(m || null); } else { MenuBG.hide(); if (typeof demoStop === 'function') demoStop(); } }
}
// ---------- no-scroll safety net (Nov 23): a screen (or pop-up) still taller than the window after its own fitting shrinks
// just enough to fit, never below SAFE_FIT.min. It only ever changes style.zoom, which the observer below doesn't watch,
// so it can't re-trigger itself (see the Nov 22 MutationObserver rule). Screens that fit are left at 1.
const SAFE_FIT = { min: 0.72, step: 0.02, raf: 0 };
function safeFit() {
  SAFE_FIT.raf = 0;
  if (typeof app === 'undefined' || !app || !app.classList.contains('show')) return;
  const scr = app.querySelector(':scope > .screen');
  // a screen that sizes itself (fitZoomEl on the screen element) is left alone: only zoom set here is ever reset
  if (scr && !(scr.style.zoom && scr.dataset.sf !== '1')) { scr.style.zoom = ''; scr.dataset.sf = ''; for (let z = 1 - SAFE_FIT.step; z >= SAFE_FIT.min - 1e-6 && app.scrollHeight > app.clientHeight + 1; z -= SAFE_FIT.step) { scr.style.zoom = z.toFixed(2); scr.dataset.sf = '1'; } }
  // pop-ups: the box has a max height, so zooming the box itself changes nothing; zoom what's inside it instead
  for (const box of document.querySelectorAll('.modal > .box')) { const kids = [...box.children]; kids.forEach(k => { if (k.dataset.sf === '1') { k.style.zoom = ''; k.dataset.sf = ''; } });
    for (let z = 1 - SAFE_FIT.step; z >= SAFE_FIT.min - 1e-6 && box.scrollHeight > box.clientHeight + 1; z -= SAFE_FIT.step) kids.forEach(k => { if (!k.style.zoom || k.dataset.sf === '1') { k.style.zoom = z.toFixed(2); k.dataset.sf = '1'; } }); }
}
function safeFitSoon() { if (!SAFE_FIT.raf) SAFE_FIT.raf = requestAnimationFrame(() => setTimeout(safeFit, 0)); }
if (typeof MutationObserver === 'function') {
  const mo = new MutationObserver(safeFitSoon);
  const hook = () => { if (typeof app !== 'undefined' && app) mo.observe(app, { childList: true, subtree: true }); mo.observe(document.body, { childList: true }); };
  if (document.body) hook(); else addEventListener('DOMContentLoaded', hook);
  addEventListener('resize', safeFitSoon);
  // dropdowns and toggles that only flip a class or style add no elements: re-check after every click and key too
  addEventListener('click', () => setTimeout(safeFitSoon, 30), true); addEventListener('keyup', () => setTimeout(safeFitSoon, 30), true);
}
function badge(t, size = 40) {
  const c = h('canvas', { width: size * 2, height: size * 2, class: 'badge' });
  c.style.width = size + 'px'; c.style.height = size + 'px';
  drawEmblemBadge(c.getContext('2d'), t, size, size, size * 0.92);
  return c;
}
function modal(build, wide) {
  const close = () => m.remove();
  const box = h('div', { class: 'box' }); if (wide) box.style.width = 'min(98vw, 960px)';
  const m = h('div', { class: 'modal', onclick: e => { if (e.target === m) close(); } }, box);
  // pop-ups over a staged screen get the same scale and text size as the screen beneath
  if (typeof app !== 'undefined' && app && app.classList.contains('staged') && app.style.zoom && app.classList.contains('show') && getComputedStyle(app).display !== 'none') {
    m.classList.add('staged'); m.style.zoom = app.style.zoom;
    for (const k of ['--sw', '--sh', '--ts']) { const v = app.style.getPropertyValue(k); if (v) m.style.setProperty(k, v); }
    if (wide) box.style.width = 'min(calc(var(--sw) * .98), 960px)';
  }
  box.appendChild(build(close));
  document.body.appendChild(m);
  return close;
}
function confirmDlg(msg, okLabel, onOk, danger) {
  modal(close => h('div', null, h('h2', null, 'ARE YOU SURE?'), h('div', { class: 'sub', style: { fontSize: '9px' } }, msg),
    h('div', { class: 'row' }, h('button', { class: danger ? 'danger' : 'primary', onclick: () => { close(); onOk(); } }, okLabel), h('button', { onclick: close }, 'CANCEL'))));
}
function toast(msg, ms = 2600) {
  const t = h('div', { class: 'toast' }, msg);
  // (Nov 22 text pass) during a game the bottom of the view is the commentary and the faceoff panel: an unlock toast
  // goes over the stands beside the rink when there's room, otherwise just under the scoreboard
  if (typeof S !== 'undefined' && ['play', 'paused', 'replay', 'intermission'].includes(S.screen)) {
    const r = document.getElementById('c') && document.getElementById('c').getBoundingClientRect();
    if (r && innerWidth - r.right > 230) { const room = innerWidth - r.right; t.classList.add('toast-side'); t.style.left = 'auto'; t.style.transform = 'none'; t.style.right = Math.round(Math.max(10, (room - Math.min(340, room - 20)) / 2)) + 'px'; t.style.maxWidth = Math.min(340, room - 20) + 'px'; }
    else t.classList.add('toast-top');
  }
  document.body.appendChild(t); setTimeout(() => t.remove(), ms);
}
const T = id => UI.save.teams[id];
const Pl = id => UI.save.players[id];
const pname = p => p.first + ' ' + p.last;
// procedural player portrait (stable face; current team's uniform, or the team he played for)
function portrait(p, team, size = 40, opts = {}) {
  const c = h('canvas', { width: 32, height: 32, class: 'px portrait' }); c.style.width = size + 'px'; c.style.height = size + 'px';
  const t = team || (p.teamId && UI.save ? UI.save.teams[p.teamId] : p.lastTeamId && UI.save ? UI.save.teams[p.lastTeamId] : null);
  drawPortrait(c.getContext('2d'), p, t, 0, 0, 2, Object.assign({ num: p.num, cap: t ? leaderOf(t, p.id) : null, fav: p.fav }, opts));
  return c;
}
function favBtn(p, after) {
  const b = h('button', { class: 'small favbtn' + (p.fav ? ' on' : ''), title: p.fav ? 'Remove from favourites' : 'Mark as a favourite', onclick: e => { e.stopPropagation(); p.fav = !p.fav; if (!p.fav) delete p.fav; Store.autosave(UI.save); b.classList.toggle('on', !!p.fav); b.textContent = p.fav ? '★' : '☆'; if (after) after(); } }, p.fav ? '★' : '☆');
  return b;
}
function teamLabel(t, size = 22) { return h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '8px' } }, badge(t, size), h('span', { style: { color: teamTextColor(t) } }, fullName(t))); }
// Escape works like the BACK button: closes the top pop-up window, otherwise goes back a screen
addEventListener('keydown', e => {
  if (e.key !== 'Escape' || e.repeat) return;
  if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) { e.target.blur(); return; }
  if (typeof Input !== 'undefined' && Input.capturing) return;
  const mods = document.querySelectorAll('.modal');
  if (mods.length) {
    const m = mods[mods.length - 1], btns = [...m.querySelectorAll('button')];
    const b = btns.find(x => /^\s*(◀|✕)|\b(CANCEL|CLOSE|BACK|GOT IT|NOT NOW|NO)\b/i.test(x.textContent));
    if (b) { b.click(); e.preventDefault(); e.stopImmediatePropagation(); }
    return;                                   // pop-ups that need an answer stay open
  }
  const inMenus = app.classList.contains('show') && (S.screen === 'menu' || S.demo);
  if (!inMenus) return;
  const bk = [...app.querySelectorAll('.bar button')].find(x => /^\s*◀/.test(x.textContent));
  if (bk) { bk.click(); e.preventDefault(); e.stopImmediatePropagation(); }
}, true);
function back(label, fn) { return h('button', { onclick: fn }, '◀ ' + label); }
// each menu family has its own accent (set from the title); the screen picks it up through CSS
const SCREEN_THEMES = [
  [/TRADE/, 'trade'], [/FINANC|CONTRACT|FREE AGENT|SALAR/, 'money'], [/TROPH|LEGACY|HISTORY|HALL|RECORD|AWARD/, 'legacy'],
  [/CUSTOM|GEAR|ARENA|LOOK|JERSEY/, 'style'], [/DRAFT/, 'draft'], [/SETTING|CONTROL|HOW TO/, 'system'],
];
// ---------- no-scroll menus: long screens show one section at a time behind tabs, long lists go in pages
// tabbed(key, [{ label, el }]): el is an element or a function returning one (built when its tab opens); the open tab is
// remembered per screen key
// big text sizes: shrink one block (CSS zoom) until the screen fits without scrolling
function fitZoomEl(el) {
  const app = document.getElementById('app'); if (!app || !el || !el.isConnected) return;
  el.style.zoom = '';
  for (let z = 0.95; z > 0.55 && app.scrollHeight > app.clientHeight + 1; z -= 0.05) el.style.zoom = z.toFixed(2);
}
function tabbed(key, sections, opts = {}) {
  UI.tabMem = UI.tabMem || {};
  sections = sections.filter(Boolean);
  const bar = h('div', { class: 'tabs tabbar' }), body = h('div', { class: 'tabbody' });
  const show = i => {
    UI.tabMem[key] = i;
    [...bar.children].forEach((b, j) => b.classList.toggle('sel', j === i));
    body.innerHTML = ''; const s = sections[i]; const el = typeof s.el === 'function' ? s.el() : s.el; if (el) body.appendChild(el);
    if (opts.onShow) opts.onShow(i);
  };
  sections.forEach((s, i) => bar.appendChild(h('button', { class: 'small', onclick: () => show(i) }, s.label)));
  show(Math.min(UI.tabMem[key] || 0, sections.length - 1));
  return h('div', { class: 'tabbed' }, bar, body);
}
// pages(key, items, per, renderPage): renderPage(slice, offset) builds one page; PREV / NEXT and "page x of y" underneath
function pages(key, items, per, renderPage) {
  UI.pageMem = UI.pageMem || {};
  const n = Math.max(1, Math.ceil(items.length / per)), wrap = h('div', { class: 'paged' });
  let pg = Math.min(UI.pageMem[key] || 0, n - 1);
  const draw = () => {
    UI.pageMem[key] = pg; wrap.innerHTML = '';
    wrap.appendChild(renderPage(items.slice(pg * per, pg * per + per), pg * per));
    if (n > 1) wrap.appendChild(h('div', { class: 'pagebar' },
      h('button', { class: 'small', disabled: pg === 0, onclick: () => { pg--; draw(); } }, '◀ PREV'),
      h('span', { class: 'muted' }, 'PAGE ' + (pg + 1) + ' OF ' + n),
      h('button', { class: 'small', disabled: pg >= n - 1, onclick: () => { pg++; draw(); } }, 'NEXT ▶')));
  };
  draw();
  wrap.goTo = i => { pg = clamp(Math.floor(i / per), 0, n - 1); draw(); };
  return wrap;
}
// a "show details" toggle: the summary is always there, the rest opens in place of nothing
function moreBtn(label, build) {
  const box = h('div'); let open = false;
  const b = h('button', { class: 'small ghost', onclick: () => { open = !open; b.textContent = (open ? 'HIDE ' : 'SHOW ') + label; box.innerHTML = ''; if (open) box.appendChild(build()); } }, 'SHOW ' + label);
  return h('div', null, b, box);
}
function header(title, onBack, backLabel = 'BACK', ...extra) {
  const t = String(title || '').toUpperCase(), th = (SCREEN_THEMES.find(([re]) => re.test(t)) || [0, 'ice'])[1];
  return h('div', { class: 'bar', 'data-theme': th }, onBack ? back(backLabel, onBack) : null, h('h2', { class: 'scrtitle', style: { margin: 0 } }, title), h('div', { class: 'grow' }), ...extra);
}
function attrBars(p, cmp) {
  const keys = p.pos === 'G' ? G_ATTRS : SK_ATTRS;
  return h('div', null, keys.map(([k, nm]) => {
    const v = p.attrs[k] ?? 5, d = cmp ? r100(v - (cmp.attrs[k] ?? 5)) : 0;
    return h('div', { class: 'attr' }, h('span', { class: 'nm', 'data-help': (typeof HELP !== 'undefined' && HELP.stat[STAT_SHORT[k]]) || null }, nm), h('span', { class: 'bar' }, h('div', { class: 'fill', style: { width: v * 10 + '%', background: v >= 8 ? '#5ee07a' : v <= 3 ? '#ff6a4a' : '#6aa2ff' } })),
      h('span', { class: 'v' }, r100(v)), cmp ? h('span', { class: d > 0 ? 'green' : d < 0 ? 'red' : 'muted', style: { width: '30px', fontSize: '7px' } }, d > 0 ? '+' + d : d < 0 ? d : '=') : null);
  }));
}
const stars = n => '★'.repeat(Math.round(n / 2)) + '☆'.repeat(5 - Math.round(n / 2));

// ---------- settings (kept in this browser)
const SETTING_KEYS = ['diff', 'speed', 'cam', 'camPref', 'periodLen', 'rules', 'assist', 'sound', 'pres', 'textSize'];
function loadSettings() { try { const o = JSON.parse(localStorage.getItem('psbk-settings') || '{}'); for (const k of SETTING_KEYS) if (o[k] != null) S[k] = k === 'pres' ? Object.assign(S.pres, o[k]) : o[k]; if (!o.camV) S.cam = 'FULL'; if (!o.spdV) S.speed = 'NORMAL'; if (!(o.camV >= 7)) S.camPref = o.cam && o.cam !== 'FULL' && CAMS[o.cam] ? o.cam : 'AUTO'; } catch (e) {} if (!SPEEDS[S.speed]) S.speed = 'NORMAL'; if (!S.camPref || (S.camPref !== 'AUTO' && !CAMS[S.camPref])) S.camPref = 'AUTO'; if (typeof applyCamPref === 'function') applyCamPref(); applyTextSize(); }   // (Normal became the default speed everywhere, v2)   // Full became the default camera (v6)
function saveSettings() { try { localStorage.setItem('psbk-settings', JSON.stringify(Object.assign({ camV: 7, spdV: 2 }, Object.fromEntries(SETTING_KEYS.map(k => [k, S[k]]))))); } catch (e) {} }
// what each camera shows: the rink with the visible frame (immediate preview in Settings)
function drawCamPreview(cv) {
  if (!cv || !cv.getContext) return;
  const c = cv.getContext('2d'), sc = cv.height / H * 0.95, ox = (cv.width - W * sc) / 2, oy = (cv.height - H * sc) / 2;
  c.fillStyle = '#0b0e1e'; c.fillRect(0, 0, cv.width, cv.height);
  c.fillStyle = '#2a3150'; c.fillRect(ox, oy, W * sc, H * sc);
  c.fillStyle = '#3a8a36'; c.fillRect(ox + R.l * sc, oy + R.t * sc, (R.r - R.l) * sc, (R.b - R.t) * sc);      // SOCCER (Nov 24 nightly): grass and pitch lines, not ice
  c.fillStyle = '#eef2ea'; c.fillRect(ox + R.l * sc, oy + CY * sc, (R.r - R.l) * sc, 1);
  if (typeof PEN_HW !== 'undefined' && typeof GL_TOP !== 'undefined') { c.strokeStyle = '#eef2ea'; c.lineWidth = 1;
    c.strokeRect(Math.round(ox + (CX - PEN_HW) * sc) + 0.5, Math.round(oy + GL_TOP * sc) + 0.5, Math.round(PEN_HW * 2 * sc), Math.round(PEN_D * sc));
    c.strokeRect(Math.round(ox + (CX - PEN_HW) * sc) + 0.5, Math.round(oy + (GL_BOT - PEN_D) * sc) + 0.5, Math.round(PEN_HW * 2 * sc), Math.round(PEN_D * sc)); }
  const cam = CAMS[S.cam], fw = Math.min(W, cam.w) * sc, fh = Math.min(H, cam.h) * sc, fx = ox + (W * sc - fw) / 2, fy = oy + (S.cam === 'FULL' ? 0 : H * sc * 0.55 - fh / 2);
  c.strokeStyle = '#ffd23f'; c.lineWidth = 2; c.strokeRect(fx, fy, fw, fh);
  c.fillStyle = '#ffd23f'; c.font = "8px 'PH Pixel', monospace"; c.fillText(camLabel(), 6, 12);
  c.fillStyle = '#9aa3c7'; c.fillText(S.cam === 'FULL' ? 'whole pitch' : S.cam === 'CLOSE' ? 'big players, tight' : 'broad view', 6, cv.height - 6);
  // arena scenery beside the rink when the screen is wider
  if (S.pres.arena !== false) { c.fillStyle = '#7ec8ff'; c.fillRect(2, 20, 4, cv.height - 40); c.fillRect(cv.width - 6, 20, 4, cv.height - 40); }
}

// ====================================================================
//  MAIN MENU
// ====================================================================
function scrLoading() { return h('div', { class: 'screen' }, h('h1', { style: { textAlign: 'center', marginTop: '30vh' } }, "PIXEL SOCCER"), h('div', { class: 'sub', style: { textAlign: 'center' } }, 'Loading your saves...')); }
function scrMain() {
  const hasSave = UI.saves.length > 0 || UI.save;
  const pickSave = then => () => UI.save ? go(then) : go(() => scrChooseSave(then));
  // personalise with the franchise you were last playing
  const recent = UI.save ? saveMeta(UI.save) : UI.saves.slice().sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))[0];
  const accent = recent ? recent.colors : null;
  const logo = h('canvas', { width: 1280, height: 420, class: 'titlelogo' });
  drawTitleLogo(logo);
  const cont = recent ? h('button', { class: 'primary huge', onclick: async () => { if (UI.save && UI.save.id === recent.id) return go(scrHub); if (await loadSave(recent.id)) go(scrHub); } },
    'CONTINUE ▶', h('div', { class: 'tsub' }, recent.name + ' · ' + recent.teamName + ' · Season ' + recent.season)) : null;
  const card = recent ? h('div', { class: 'franchcard', style: { borderColor: accent.a } }, badge({ colors: accent, emblem: recent.emblem }, 44),
    h('div', { style: { textAlign: 'left', flex: 1 } }, h('div', { style: { color: accent.a === '#ffffff' ? '#fff' : accent.a, fontSize: '9px' } }, recent.teamName.toUpperCase()),
      h('div', { class: 'muted', style: { fontSize: '7px', marginTop: '6px' } }, `${recent.label} · ${recent.record}` + (recent.champs ? ` · ${recent.champs} league title${recent.champs > 1 ? 's' : ''}` : ''))),
    recent.champs ? drawTrophyCanvas('league', 2, true) : null) : null;
  const node = h('div', { class: 'screen mainmenu' },
    logo, card,
    h('div', { class: 'scoreboard', style: accent ? { boxShadow: `0 0 0 3px #05060d, 0 0 0 6px ${accent.p}, 0 0 40px rgba(0,0,0,.6)` } : null },
      h('div', { class: 'ledhead' }, '● MAIN MENU ●'), fsBtn('small ghost mmfs', true),
      h('div', { class: 'menu', style: { margin: '10px auto 4px' } }, cont,
        h('div', { class: 'menu2' },
          h('button', { class: cont ? '' : 'primary', onclick: () => go(scrQuickPlay) }, 'QUICK PLAY', h('div', { class: 'tsub' }, 'Jump straight into a game')),
          h('button', { onclick: () => go(scrSaves) }, 'SEASON MODE', h('div', { class: 'tsub' }, hasSave ? 'Your franchises' : 'Start a franchise'))),
        h('div', { class: 'menu3' },
          h('button', { class: 'small ghost', onclick: () => { UI.legBack = scrMain; if (hasSave) pickSave(scrLegacy)(); else go(() => scrLocker(scrMain)); }, title: 'Trophy cabinet, achievements and account unlocks' }, hasSave ? 'LEGACY' : 'THE LOCKER'),
          h('button', { class: 'small ghost', onclick: () => go(scrHowTo) }, 'HOW TO PLAY'),
          h('button', { class: 'small ghost', onclick: () => go(scrSettings) }, 'SETTINGS')))),
    !S.sound || !VOL.menuMusic || VOL.master * VOL.music === 0 ? h('button', { class: 'link', id: 'musicOff', onclick: () => go(scrSettings) }, '♪ Menu music is turned off. Open SETTINGS to turn it back on.')
      : Music.started ? null : h('div', { id: 'musicHint', class: 'hint' }, '♪ Click or press a key for music'),
    h('div', { class: 'hint' }, '↑↓ choose · ENTER select · ' + Store.modeLabel()));
  setTimeout(() => { const b = node.querySelector('button.primary'); if (b) b.focus({ preventScroll: true }); }, 0);
  // big text sizes: the whole menu shrinks just enough to fit the screen instead of scrolling
  setTimeout(() => { const a = document.getElementById('app'); if (!a || !node.isConnected) return; let z = 1; node.style.zoom = '';
    while (z > 0.6 && a.scrollHeight > a.clientHeight + 1) { z -= 0.04; node.style.zoom = z; } }, 0);
  return node;
}
function scrHowTo() {
  const k = act => h('span', null, [0, 1].filter(i => (Input.binds[act] || [])[i] || (i === 0 && !(Input.binds[act] || []).some(Boolean))).map(i => bindKbd(act, i)));   // click any key to change it
  const mv = () => h('span', null, ['up', 'left', 'down', 'right'].map(a => bindKbd(a, 0)), ' or ', ['up', 'left', 'down', 'right'].map(a => bindKbd(a, 1)));
  // each tip is a card: the key (or topic) on top, the explanation underneath; cards sit two to a row
  const li = (key, t) => h('div', { class: 'htcard' }, h('div', { class: 'htkey' }, key), h('div', { class: 'httxt' }, t));
  const sec = (title, t) => h('div', { class: 'htcard' }, h('div', { class: 'htkey gold' }, title), h('div', { class: 'httxt' }, t));
  return h('div', { class: 'screen howtoS' }, header('HOW TO PLAY', () => go(scrMain), 'BACK', h('button', { onclick: () => go(() => scrControls(scrHowTo)) }, 'CHANGE CONTROLS')),
    h('div', { class: 'sub' }, 'These are your current keys: click one, then press the key you want instead.'),
    tabbed('howto', [
    { label: 'PLAYERS', el: h('div', { class: 'panel htgrid' }, h('div', null,
      li(mv(), 'Run. Teams switch ends at half-time (and again for extra time).'),
      li(h('span', null, 'Double-tap backwards'), 'Defending, you run backwards facing the carrier (slower). Double-tap the way you are backing to PIVOT and race back at full speed.'),
      li(k('shoot'), 'Hold to charge, release to shoot (charging slows you). Aim while charging: up = top corner, down = nutmeg, sides and diagonals = those spots. Hold it as a pass arrives for a first-time shot. Without the ball: switch player.'),
      li(k('check'), 'PASS / TACKLE. With the ball: pass to the best-placed teammate (aim with your running direction). Without it: tap = poke tackle, hold = shoulder charge (you only lunge when someone is in range). Run hard at someone for a BIG TACKLE. Only hit the ball carrier: a big tackle from behind, or flattening a man without the ball, is a foul.'),
      li(k('loft'), 'LOFT: the ball in the air. Out wide: a cross to the man in the box (he heads it at goal). Near goal and facing it: a chip over the keeper. Anywhere else: a lofted pass to the teammate you face, or a long ball over the top.'),
      li(h('span', null, k('poke'), ' ', k('pause'), ' ', k('fullscreen')), 'Slide tackle (win the ball first, or it is a foul) · pause · fullscreen.'),
      li(k('sprint'), 'Turn sprint on or off. Sprinting burns stamina fast, and tired players slow down.'),
      li(k('line'), 'Call for a rolling sub. Your line goes off as soon as it is safe (not in the middle of an attack).'),
    )) },
    { label: 'FEINTING', el: h('div', { class: 'panel htgrid' }, h('div', null,
      li(h('span', null, k('deke')), 'DRAG-BACK: the sudden cut. Pulls the ball to your other side and cuts your angle that way. Pull AWAY from a poke or a hitter and you beat it; pull into it and you lose the ball or get laid out. Do it just as he winds up (the "!") for a PERFECT FEINT.'),
      li(h('span', null, k('dangle')), 'DANGLE: the everyday juke. A quick fake: the man in front freezes for a moment and you get a little burst. Press SHOOT during it for a snap shot. While you dangle the ball is exposed: a poke strips it easily.'),
      li(h('span', null, k('spin')), 'SPIN-O-RAMA: the gamble. Spin just before a big tackle lands and you roll round it while he sails past. Spin too early, or into a poke, and you get laid out or stripped.'),
      li('Pick the tool', 'You choose the move; the game does it the smart way and your arrows stay free to steer. Moves pressed as one finishes chain together. Keepers remember what you did against them.'),
      li(h('span', null, 'Hold ', k('deke')), 'Hand control: hold the feint key and the arrows move the ball around your player while he keeps his line.'),

      li('Risk', 'Every move costs a little stamina. Rapid repeats, exhaustion and feints at full speed can lose the handle. Better Dribbling makes everything safer.'),
      li('Keepers', 'In tight, a feint can pull the keeper across: weaker or aggressive keepers bite more often; good ones read it. Works on breakaways and penalty kicks too.'))) },
    { label: 'SHOTS', el: h('div', { class: 'panel htgrid' }, h('div', null,
      sec('WHAT MAKES A GOAL', 'Not where you shoot from but how: a keeper who is set and square stops most shots. Beat him by making him move, catching him before he is set, or hiding the ball.'),
      sec('FIRST-TIME SHOT', 'The deadliest shot. Best when the pass goes ACROSS the six-yard box: the keeper has to slide and cannot get set.'),
      sec('DEFLECTION', 'Stand in front and get a boot on a long-range shot. Good defenders tie up your boot; a shoulder charge on the man in front stops it.'),
      sec('SNAP SHOT', 'A short, quick charge: little power but fast to get off. Best off a dangle or a pass, before the keeper is set.'),
      sec('PLACED SHOT', 'The quick tap. Accurate but easy for a set keeper from distance: use it in tight or on the move.'),
      sec('WEAK FOOT', 'A quick release on your weak foot side, running across. Weak from far out; in tight, after a feint, it fools keepers.'),
      sec('POWER SHOT', 'A full charge. From the edge of the box it rarely goes in clean, but through traffic it is a great screen and tip chance.'),
      sec('SHOT INFO', 'Turn on SHOT INFO in Settings to see, on every shot, how set the keeper was and why it was dangerous.'))) },
    { label: 'COACHING', el: h('div', { class: 'panel htgrid' }, h('div', null,
      li(h('span', null, k('line1'), k('line2'), k('line3')), 'At any stoppage (and between halves) pick the line for the next kickoff. The panel shows each line\'s players, stamina, role and a recommendation; your pick always takes the pitch, then lines rotate automatically again. ' + Input.label('line') + ' during a stoppage holds the kickoff while you decide.'),
      li('Who has it?', 'The ball carrier stands on a filled team-coloured disc and is named under the scoreboard; YOUR player has the yellow ring and arrow. Names pop up briefly when possession changes (labels can be turned off in Settings).'),
      li('Captains', 'Set a C and two A\'s in Roster. Letters show on the jersey; the captain steadies his line a little (less fatigue, steadier passes).'),
      sec('POSITIONS (3-ON-3)', 'No wings or defence: lines are LEFT, CENTRE, RIGHT. On his own side a player loses nothing. A D badge marks the stay-at-home type: he takes the most defensive spot your tactic offers.'),
      sec('AUTO-ARRANGE', 'In ROSTER: lines built for each line\'s tactic, with the reasons. AUTO LINES ON runs it before every game.'),
      sec('THREAT MARKERS', 'Under every stamina bar: grey, green, blue, purple, gold = depth to elite. Badges: shield (defender), crosshair (sniper), arrow (playmaker), bolt (speed), fist (hard man), star (their best). Gold ring: elite. A pulsing badge has 2+ points tonight.'))) },
    { label: 'YOUR KEEPER', el: h('div', { class: 'panel htgrid' }, h('div', null,
      li(mv(), 'Run a few slow strides to open a passing angle. Inside the six-yard box area nobody may touch him; far out, a poke tackle can strip him (keepers are never body checked).'),
      li(h('span', null, k('check'), ' / ', k('shoot')), 'Tap for a quick short pass. Hold to charge a harder, longer pass; while holding, the arrows aim it and the keeper stands still. Release to pass. Hard passes are less accurate.'),
      li(k('cover'), 'Kick it long: the keeper punts it upfield (toward a teammate if he can find one).'),
      li('Clock', 'Play the ball within 5 seconds or the keeper punts it automatically.'))) },
    { label: 'RULES', el: h('div', { class: 'panel htgrid' }, h('div', null,
      sec('ROLLING SUBS', 'Three lines rotate automatically every 45-60 seconds. Tired players slow down; rested ones recover on the bench.'),
      sec('OUT OF PLAY', 'Over a touchline: a throw-in to the other side. Over the goal line: a corner if the defenders put it there, otherwise a goal kick. The taker must play the ball from the spot.'),
      sec('KICKOFFS', 'The side that conceded kicks off. No offside in 3-on-3.'),
      sec('FOULS & CARDS', 'Tripping, a late tackle from behind, a foul on the keeper, and flattening a player who doesn\'t have the ball. A foul is a free kick and a yellow card. Two yellows, or a reckless tackle from behind, is a RED: he\'s sent off for the rest of the match and a substitute comes on (it stays 3-on-3, but your bench gets shorter). A foul in the box, or one that denies a clear chance, is a penalty kick.'),
      sec('ADVANTAGE', 'Fouled in their half but your team still has the ball? The referee shouts PLAY ON and lets you keep attacking (the yellow card is still given). If they win the ball straight back, he brings it back for your free kick.'),
      sec('ADDED TIME', 'When the clock runs out, the fourth official adds 1 to 5 minutes for goals, fouls and injuries in that half. The clock turns green and counts down the added time (+0:07). If you are attacking near the box when it runs out, the referee lets the move finish.'),
      sec('DRAWS & TIES', 'League games can end level: 3 points for a win, 1 for a draw. Cup and playoff ties go to extra time, then a penalty shootout.'),
      sec('HALF-TIME', 'The groundskeeper mows the pitch while the big screen replays the highlights. Press SPACE to skip.'))) },
    { label: 'QUICK PLAY', el: h('div', { class: 'panel htgrid' }, h('div', null,
      sec('MY CLUB', 'Pick one Quick Play team that is yours for good. Rename it, dress it in your unlocks, and climb THE LADDER: ten clubs, weakest to strongest. Every ladder win makes one or two of your players better.'),
      sec("TODAY'S CHALLENGE", 'One game situation a day, the same for everyone, always on Normal. Your first try counts; keep a daily streak going. Seven daily wins unlock the Sunset Jersey.'),
      sec('CHALLENGES', 'Power-play and penalty-kill ladders, SCENARIOS (tie it with the keeper pulled, hold a late lead, sudden death...), and skill drills with medals. A gold on HARD is PLATINUM.'),
      sec('2 PLAYERS', 'BREAKAWAY DUEL: two players take turns on one keyboard or controller, five breakaways each, sudden death if tied.'),
      sec('THE LOCKER', 'Every unlock and how to earn it, your medals and your personal bests. It opens from the main menu (and from LEGACY once you have a franchise).'),
      sec('CONTROLLER', 'Plug in any standard gamepad: boot or d-pad to run, A shoot, X pass / check, B poke, Y drag-back, LB dangle, RB spin, LT sprint, START pause.'))) },
    { label: 'SEASON MODE', el: h('div', { class: 'panel htgrid' }, h('div', null,
      sec('START', 'Every club starts equal. The Inaugural League Draft builds the 24 rosters in snake order (the order reverses every round).'),
      sec('THE SEASON', '24 regular-season games. The clubs are redrawn into four divisions of six (two conferences) every season.'),
      sec('TOURNAMENTS', 'The Opening Invitational (every club: groups of four, then an eight-team knockout). The Midseason Classic, Winter Cup and Season Finale Cup are by invitation and optional: decline one to rest or train instead.'),
      sec('PLAYOFFS', 'The top four in each division play best-of-five series for the League Championship, then the best clubs meet in the optional Tournament of Champions.'),
      sec('ROOKIE DRAFT', 'Every class has 1-3 GENERATIONAL prospects, ready-now IMPORTS and EXPOSED veterans (each club protects 7 players). Cup winners pick up to 8 places earlier. FITS chips show who fills a hole for you.'),
      sec('FARM TEAM & IR', 'ROSTER > FARM & IR: 6 farm spots (3 call-ups a week, send-downs free), injured reserve for players out 5+ games, releases with a buyout. Farm players dress in an emergency.'),
      sec('YOUR CLUB', 'Set lines, tactics, leaders and player development in ROSTER. Contracts, trades, free agents, sponsors and finances are in FRONT OFFICE. Keep players happy: mood changes what they ask for and how they play.'),
      sec('THE OWNER', 'Three goals every season. Meet them for a bonus and reputation; two poor seasons put you on the HOT SEAT, and a third brings the owner in. A halfway report comes at game 12.'),
      sec('RIVALS & SIM AHEAD', 'Close games, extra time, scuffles, trash talk and the playoffs build a RIVAL: rival nights draw bigger crowds. SIM AHEAD runs to the next event and stops for anything that needs you.'),
      sec('AFTER THE SEASON', 'Awards Night (awards, finalists and All-Stars), then the offseason: season review, contract renewals, free agency and trades, the rookie draft, and final roster moves. Players age, develop and retire.'),
      sec('LEGACY', 'Trophies, memorabilia and achievements collect in LEGACY. Open any trophy to relive its championship moments. Click a cabinet piece to customize it with the player it honours.')))}], { onShow: () => setTimeout(() => fitZoomEl(document.querySelector('.howtoS .tabbody')), 0) }));
}
// ---------- rebindable controls
// click a key anywhere it's shown (Controls, the at-a-glance sheet, the pause menu, How to Play), then press the new key.
// Esc cancels. A key already in use asks whether to move it here (or share it, when the two actions never clash).
function rebindKey(id, slot, btn, after) {
  if (Input.capturing) return;
  after = after || refreshBindLabels;
  btn.textContent = 'PRESS A KEY...'; btn.classList.add('sel', 'capturing');
  Input.capturing = true;
  const done = () => { removeEventListener('keydown', onKey, true); setTimeout(() => { Input.capturing = false; }, 0); };
  const onKey = e => {
    e.preventDefault(); e.stopPropagation();
    done();
    const code = e.code;
    if (!code || code === 'Escape') return after();
    const cf = Input.conflicts(id, code);
    if (!cf.length) { Input.bind(id, slot, code); return after(); }
    const names = cf.map(c => ACTIONS.find(a => a[0] === c.id)[1]).join('; ');
    const canShare = cf.every(c => c.shared);
    modal(close => h('div', null, h('h2', null, keyName(code) + ' IS ALREADY IN USE'),
      h('div', { class: 'sub', style: { fontSize: '9px' } }, 'Currently used for: ' + names + '.'),
      canShare ? h('div', { class: 'sub' }, 'These actions never happen at the same time (keeper vs player), so the key can do both.') : null,
      h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: () => { close(); Input.unbindEverywhere(code, id); Input.bind(id, slot, code); after(); } }, 'REPLACE (MOVE KEY HERE)'),
        canShare ? h('button', { onclick: () => { close(); Input.bind(id, slot, code); after(); } }, 'USE FOR BOTH') : null,
        h('button', { onclick: () => { close(); after(); } }, 'CANCEL'))));
  };
  addEventListener('keydown', onKey, true);
}
// a keycap that shows the key for (action, slot) and changes it when clicked
const bindShort = c => keyName(c).replace(/^LEFT /, 'L ').replace(/^RIGHT /, 'R ');
function bindKbd(id, slot, short) {
  const lab = () => { const c = (Input.binds[id] || [])[slot]; return c ? (short ? bindShort(c) : keyName(c)) : '—'; };
  const el = h('kbd', { class: 'rebind', 'data-bind': id + ':' + slot + (short ? ':s' : ''), title: 'Click, then press a key to change it',
    onclick: e => { e.stopPropagation(); rebindKey(id, slot, el); } }, lab());
  return el;
}
// after a change, every keycap on screen shows its new key (a key moved here leaves its old action showing —)
function refreshBindLabels() {
  for (const el of document.querySelectorAll('[data-bind]')) {
    const [id, slot, sh] = el.dataset.bind.split(':'), c = (Input.binds[id] || [])[+slot];
    el.textContent = c ? (sh ? bindShort(c) : keyName(c)) : '—'; el.classList.remove('sel', 'capturing');
  }
}
function scrControls(backTo) {
  const body = h('div');
  const render = () => {
    body.innerHTML = '';
    // one group of actions at a time (tabs), so the page never scrolls
    const groupName = { move: 'RUNNING', skater: 'PLAYER', goalie: 'KEEPER', coach: 'COACHING', fightans: 'SCUFFLES', general: 'GENERAL' };
    const groupNote = { coach: 'Coaching and pulling the keeper.' };
    const groups = [...new Set(ACTIONS.map(a => a[2]))].filter(g => g !== 'fightans');   // SOCCER: no scuffles
    body.appendChild(tabbed('controls', [{ label: 'AT A GLANCE', el: () => controlsSheet() }].concat(groups.map(grp => ({ label: groupName[grp] || grp.toUpperCase(), el: () => {
      const rows = ACTIONS.filter(a => a[2] === grp && !['fight', 'pull', 'extra'].includes(a[0])).map(([id, label]) => {
        const slotBtn = i => h('button', { class: 'small keybtn', onclick: e => capture(id, i, e.target) }, keyName(Input.binds[id][i]));
        // the action's name first, its details smaller underneath
        const L0 = String(label), cut = L0.search(/:| \(/), nm = cut > 0 ? L0.slice(0, cut) : L0;
        let det = cut > 0 ? L0.slice(cut).replace(/^:\s*/, '').trim() : '';
        if (/^\(.*\)$/.test(det) && det.indexOf('(', 1) < 0) det = det.slice(1, -1);
        return h('tr', null, h('td', { class: 'l ctlact' }, h('span', { class: 'ctlnm' }, nm), det ? h('span', { class: 'ctldet' }, det) : null), h('td', null, slotBtn(0)), h('td', null, slotBtn(1)),
          h('td', null, h('button', { class: 'small ghost', title: 'Clear both keys', onclick: () => { Input.binds[id] = [null, null]; Input.save(); render(); } }, 'CLEAR')));
      });
      // long groups split into two side-by-side tables so nothing scrolls
      const head = () => h('tr', null, h('th', { class: 'l' }, 'ACTION'), h('th', null, 'KEY 1'), h('th', null, 'KEY 2'), h('th'));
      const half = rows.length > 10 ? Math.ceil(rows.length / 2) : rows.length;
      return h('div', { class: 'panel ctlgroup' }, groupNote[grp] ? h('div', { class: 'muted ctlgnote', 'data-help': groupNote[grp] }, groupNote[grp]) : null,
        h('div', { class: 'ctlcols' + (half < rows.length ? ' two' : '') }, h('table', null, head(), rows.slice(0, half)), half < rows.length ? h('table', null, head(), rows.slice(half)) : null));
    } })))));
  };
  const capture = (id, slot, btn) => rebindKey(id, slot, btn, render);
  render();
  return h('div', { class: 'screen controlsS' }, header('CONTROLS', () => { Input.capturing = false; go(backTo || scrSettings); }, 'BACK',
      h('button', { class: 'danger', onclick: () => confirmDlg('Put every control back to the default keys?', 'RESTORE DEFAULTS', () => { Input.reset(); render(); toast('Default controls restored.'); }) }, 'RESTORE DEFAULTS')),
    h('div', { class: 'sub', 'data-help': 'Each action can have two keys. Left and right Shift (and Ctrl/Alt) are different keys. Changes save automatically and apply to every franchise.' }, 'Click a key, then press the one you want (Esc cancels). Saved automatically for every franchise.'),
    body);
}
function optBtn(label, get, next) {
  const b = h('button', { onclick: () => { next(); b.textContent = get(); saveSettings(); } }, get());
  return h('div', { class: 'optrow' }, h('span', { class: 'optlab' }, label), b);
}
function slider(label, get, set) {
  const out = h('span', { class: 'gold', style: { width: '4.2em', flex: '0 0 auto', display: 'inline-block', textAlign: 'right' } }, Math.round(get() * 100) + '%');
  const inp = h('input', { type: 'range', min: 0, max: 100, value: Math.round(get() * 100), style: { flex: 1, maxWidth: '220px', minWidth: '90px' }, oninput: () => { set(inp.value / 100); out.textContent = inp.value + '%'; } });
  return h('div', { class: 'optrow' }, h('span', { class: 'optlab' }, label), inp, out);
}
// ---------- GOALIE FEEL: live knobs for the save model and the goalie's reactions, saved on this device
const GKFEEL = [
  ['lone', 'ONE-ON-ONE KEEPER SIZE', 'Breakaways, penalty kicks and shootouts: how much of his normal reach the keeper has (lower = easier to score)', 0.3, 1, 0.05, () => GKR.lone, v => GKR.lone = v],
  ['band', 'CONTESTED BAND (px)', 'How close to the edge of his reach a shot is a coin-flip. 0 = pure position, bigger = more luck near the edge', 0, 6, 0.5, () => GKR.band, v => GKR.band = v],
  ['base', 'KEEPER REACH', 'How much net every keeper covers (px, + or -)', -0.15, 0.2, 0.005, () => GKR.base, v => GKR.base = v, v => (v * GKR.mod >= 0 ? '+' : '') + (v * GKR.mod).toFixed(1)],
  ['speed', 'HARD SHOTS BEAT HIM', 'How much shot speed shrinks his reach from close in', 0, 1.5, 0.05, () => GKR.speed, v => GKR.speed = v],
  ['far', 'LONG SHOTS EASY TO STOP', 'Extra reach on shots from far out (he sees them all the way)', 0, 0.4, 0.01, () => GKR.far, v => GKR.far = v],
  ['moving', 'SLIDING KEEPER IS SMALLER', 'Reach lost while he is still moving across', 0, 6, 0.25, () => GKR.moving, v => GKR.moving = v],
  ['react', 'REACTION TIME (frames)', 'How late he sees the ball (an average keeper; ratings move it)', 3, 16, 1, () => GK.react, v => GK.react = v],
  ['antic', 'READS AHEAD / BITES', 'How far aggressive keepers read ahead of the ball (and over-commit on a fake)', 0, 2, 0.1, () => GK.anticK ?? 1, v => { GK.anticK = v; GK.antic = [0, 4 * v, 8 * v]; }],
  ['memReact', 'MEMORY: QUICKER ON REPEATS', 'Each time he has seen a move his reaction time is multiplied by this (1 = no memory)', 0.1, 1, 0.05, () => GK.memReact, v => GK.memReact = v],
  ['memShift', 'MEMORY: SLIDES TO YOUR SPOT', 'How far (px per time seen) he leans to where that move\'s shot went', 0, 10, 0.5, () => GK.memShift, v => GK.memShift = v],
  ['spray', 'YOUR SHOT SPRAY', 'How far your shots stray from your aim (1 = the old amount)', 0, 1, 0.05, () => SKILLSHOT.humanSpray, v => SKILLSHOT.humanSpray = v],
];
const GKFEEL_DEF = Object.fromEntries(GKFEEL.map(k => [k[0], k[6]()]));
function gkFeelSave() { try { localStorage.setItem('psph-gkfeel', JSON.stringify(Object.fromEntries(GKFEEL.map(k => [k[0], k[6]()])))); } catch (e) {} }
(function gkFeelLoad() { try { const v = JSON.parse(localStorage.getItem('psph-gkfeel') || '{}'); for (const k of GKFEEL) if (typeof v[k[0]] === 'number') k[7](v[k[0]]); } catch (e) {} })();
function gkFeelPanel() {
  const box = h('div', { class: 'panel gkfeel' });
  const draw = () => {
    box.innerHTML = '';
    box.appendChild(h('h3', { style: { marginTop: 0 } }, 'KEEPER FEEL (TUNING)'));
    const items = h('div', { class: 'gkitems' });
    box.appendChild(h('div', { class: 'hint' }, 'Saves come from where the keeper is: inside his reach it is stopped, outside it is in, and only shots near the edge are a toss-up. He sees the ball a moment late and remembers each shooter\'s moves for the game. Changes apply straight away.'));
    for (const [key, label, tip, lo, hi, step, get, set, fmt] of GKFEEL) {
      const show = v => fmt ? fmt(v) : (+v).toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0);
      const out = h('span', { class: 'gold', style: { width: '4.4em', flex: '0 0 auto', display: 'inline-block', textAlign: 'right' } }, show(get()));
      const inp = h('input', { type: 'range', min: lo, max: hi, step, value: get(), title: tip, style: { flex: 1, maxWidth: '240px', minWidth: '90px' }, oninput: () => { set(+inp.value); out.textContent = show(+inp.value); gkFeelSave(); } });
      items.appendChild(h('div', { class: 'gkitem' }, h('div', { class: 'optrow', title: tip }, h('span', { class: 'optlab' }, label), inp, out),
        h('div', { class: 'muted gktip', style: { fontSize: 'calc(6.5px * var(--ts, 1.2))', margin: '-2px 0 6px' } }, tip)));
    }
    box.appendChild(items);
    box.appendChild(h('button', { class: 'small', onclick: () => { for (const k of GKFEEL) k[7](GKFEEL_DEF[k[0]]); gkFeelSave(); draw(); toast('Keeper feel reset'); } }, '↺ RESET TO DEFAULTS'));
  };
  draw(); return box;
}
// a fullscreen switch for menus (the label follows the real state, whichever way it was changed)
function fsBtn(cls, short) {
  const lab = () => short ? (document.fullscreenElement ? '⤡ EXIT FULL' : '⤢ FULL') : document.fullscreenElement ? '⤡ EXIT FULLSCREEN' : '⤢ FULLSCREEN';
  const b = h('button', { class: cls || '', title: 'Fullscreen (or press ' + Input.label('fullscreen') + ' any time)', onclick: () => { if (typeof toggleFS === 'function') toggleFS(); } }, lab());
  const upd = () => { if (!b.isConnected) return document.removeEventListener('fullscreenchange', upd); b.textContent = lab(); };
  document.addEventListener('fullscreenchange', upd);
  return b;
}
function scrSettings(back) {
  const camPrev = h('canvas', { width: 220, height: 150, class: 'px', style: { display: 'block', margin: '4px 0 10px' } }); setTimeout(() => drawCamPreview(camPrev), 0);
  const audioChanged = () => { saveAudioPrefs(); applySfxVolume(); Music.setLevel(true); };
  const backTo = typeof back === 'function' ? back : scrMain;
  return h('div', { class: 'screen wide compact staged settingsS' }, header('SETTINGS', () => go(backTo), backTo === scrHub ? 'BACK TO TEAM' : undefined, fsBtn('primary')),
    tabbed('settings', [
    { label: 'GAMEPLAY', el: () => h('div', { class: 'setgrid' }, h('div', { class: 'setcol' },
    h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'GAMEPLAY'),
      optBtn('CPU DIFFICULTY', () => S.diff, () => { S.diff = cyc(DIFF, S.diff); if (S.diff === 'HARD') S.speed = 'NORMAL'; }),
      optBtn('GAME SPEED', () => S.diff === 'HARD' ? 'NORMAL (HARD)' : S.speed, () => { if (S.diff !== 'HARD') S.speed = cyc(SPEEDS, S.speed); }),
      optBtn('CAMERA', camLabel, () => { S.camPref = nextCamPref(); applyCamPref(); drawCamPreview(camPrev); }),
      optBtn('HALF LENGTH', () => fmtToi(S.periodLen), () => { const ls = [60, 100, 120, 180]; S.periodLen = ls[(ls.indexOf(S.periodLen) + 1) % ls.length]; }),
      optBtn('FOULS & CARDS', () => S.rules ? 'ON' : 'OFF', () => { S.rules = !S.rules; }),
      optBtn('PICKUP & PASS ASSIST', () => S.assist ? 'ON' : 'OFF', () => { S.assist = !S.assist; }),
      h('div', { class: 'hint' }, 'Two halves of this length make a game. Pass assist also aims your keeper\'s passes.'))),
    h('div', { class: 'setcol' }, h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'CAMERA PREVIEW'), camPrev),
      // what you see around the game (moved beside the camera so the tab fits on one screen)
      h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'DISPLAY'),
        optBtn('TEXT SIZE', () => S.textSize, () => { S.textSize = cyc(TEXT_SIZES, S.textSize); applyTextSize(); }),
        optBtn('MAIN MENU BACKGROUND', () => S.pres.menuDemo === false ? 'CLASSIC' : 'LIVE GAME', () => { S.pres.menuDemo = S.pres.menuDemo === false; }),
        optBtn('ARENA SCENERY', () => S.pres.arena === false ? 'OFF' : 'ON', () => { S.pres.arena = S.pres.arena === false; })))) },
    { label: 'CONTROLS', el: () => h('div', null, controlsSheet(),
      h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' } },
        h('div', { class: 'hint', style: { margin: 0 } }, 'Press ' + Input.label('help') + ' in a game to bring this up any time.'),
        h('button', { class: 'primary', onclick: () => go(() => scrControls(scrSettings)) }, 'CHANGE KEYS ▶'))) },
    { label: 'PRESENTATION', el: () => h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'PRESENTATION'), h('div', { class: 'optcols' },
      optBtn('BALL CARRIER INDICATOR', () => S.pres.carrier ? 'ON' : 'OFF', () => { S.pres.carrier = !S.pres.carrier; }),
      optBtn('PLAYER NAME LABELS', () => S.pres.labels ? 'ON' : 'OFF', () => { S.pres.labels = !S.pres.labels; }),
      optBtn('SCREEN SHAKE ON BIG TACKLES', () => S.pres.shake === false ? 'OFF' : 'ON', () => { S.pres.shake = S.pres.shake === false; }),
      optBtn('THREAT MARKERS (UNDER STAMINA BARS)', () => ({ OPP: 'OPPONENTS', ALL: 'EVERYONE', OFF: 'OFF' })[S.pres.threat || 'ALL'], () => { S.pres.threat = { ALL: 'OPP', OPP: 'OFF', OFF: 'ALL' }[S.pres.threat || 'ALL']; }),
      optBtn('SHOT INFO (WHY A SHOT WAS DANGEROUS)', () => S.pres.shotInfo ? 'ON' : 'OFF', () => { S.pres.shotInfo = !S.pres.shotInfo; }),
      optBtn('COLOUR-BLIND FRIENDLY COLOURS', () => S.pres.cb ? 'ON' : 'OFF', () => { S.pres.cb = !S.pres.cb; }),
      optBtn('CROWD ANIMATION', () => S.pres.crowdLite ? 'LIGHT (SLOWER DEVICES)' : 'FULL', () => { S.pres.crowdLite = !S.pres.crowdLite; }),
      optBtn('GOAL PRESENTATIONS', () => S.pres.goal, () => { S.pres.goal = { FULL: 'SHORT', SHORT: 'OFF', OFF: 'FULL' }[S.pres.goal]; }),
      optBtn('HAT-TRICK CELEBRATIONS', () => S.pres.hats ? 'ON' : 'OFF', () => { S.pres.hats = !S.pres.hats; }),
      optBtn('TEAM WALKOUTS FROM THE TUNNEL', () => S.pres.walkout === false ? 'OFF' : 'ON', () => { S.pres.walkout = S.pres.walkout === false; }),
      optBtn('PREGAME SPOTLIGHTS', () => S.pres.spot ? 'ON' : 'OFF', () => { S.pres.spot = !S.pres.spot; }),
      optBtn('THREE STARS', () => S.pres.stars, () => { S.pres.stars = { FULL: 'SHORT', SHORT: 'OFF', OFF: 'FULL' }[S.pres.stars]; }),
      optBtn('END-OF-GAME JUMBOTRON SHOW', () => S.pres.outro === false ? 'OFF' : 'ON', () => { S.pres.outro = S.pres.outro === false; }),
      optBtn('LINE CHOOSER AT STOPPAGES', () => S.pres.linePick ? 'ON' : 'OFF', () => { S.pres.linePick = !S.pres.linePick; }),
      optBtn('4TH-PLAYER CHOOSER (OVERLOAD CHALLENGES)', () => S.pres.extraPick !== false ? 'ON' : 'OFF', () => { S.pres.extraPick = S.pres.extraPick === false; }),
      ), h('div', { class: 'hint' }, 'These only change what is shown: statistics, awards and history are always recorded.')) },
    { label: 'AUDIO', el: () => h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'AUDIO'),
      optBtn('SOUND', () => S.sound ? 'ON' : 'OFF', () => { S.sound = !S.sound; initAudio(); applySfxVolume(); Music.setLevel(true); }),
      slider('MASTER VOLUME', () => VOL.master, v => { VOL.master = v; audioChanged(); }),
      slider('MUSIC VOLUME', () => VOL.music, v => { VOL.music = v; audioChanged(); }),
      slider('PUMP-UP SONGS (STOPPAGES)', () => VOL.pump ?? 1, v => { VOL.pump = v; audioChanged(); }),
      slider('EFFECTS VOLUME', () => VOL.sfx, v => { VOL.sfx = v; audioChanged(); MenuFX.play('move'); }),
      optBtn('ARENA ORGAN STINGS', () => S.pres.voice === false ? 'OFF' : 'ON', () => { S.pres.voice = S.pres.voice === false; if (S.pres.voice !== false && typeof voiceCue === 'function') { lastVoice = 0; voiceCue('goal', 1, true); } }),
      optBtn('MUSIC', () => VOL.menuMusic ? 'ON' : 'OFF', () => { VOL.menuMusic = !VOL.menuMusic; audioChanged(); if (VOL.menuMusic) Music.unlock(); }),
      ) },
    { label: 'SONGS', el: () => h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'SONGS'), h('div', { class: 'hint' }, 'Untick a song to drop it from the rotation. Menu songs shuffle every two minutes; the pump-up songs play at stoppages and between halves.'),
      songsPanel()) },
    { label: 'KEEPER FEEL', el: () => h('div', { class: 'setgrid' }, h('div', { class: 'setcol' }, gkFeelPanel())) },
    (typeof DBG !== 'undefined' || typeof DEVLOG !== 'undefined') ? { label: 'DEBUG', el: () => h('div', { class: 'setgrid' }, h('div', { class: 'setcol' },
    typeof DBG !== 'undefined' ? h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'DEBUG'), h('div', { class: 'sub' }, 'Test tools: balance tuning, player and team editing, test scenarios, franchise testing, unlocks and diagnostics.'), h('button', { class: 'primary', onclick: () => dbgOpen() }, '\uE002 OPEN DEBUG MENU ▶')) : null,
    typeof DEVLOG !== 'undefined' ? h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'GAME LOG (DEVELOPER)'),
      h('div', { class: 'sub' }, 'Records your quick-play games for gameplay auditing. In a game, press J to flag a moment and add a note.'),
      optBtn('RECORD QUICK-PLAY GAMES', () => DEVLOG.on ? 'ON' : 'OFF', () => { devlogSet(!DEVLOG.on); }),
      h('button', { class: 'small', onclick: () => devlogExport() }, 'EXPORT RECENT LOGS')) : null)) } : null], { onShow: () => setTimeout(() => fitZoomEl(document.querySelector('#app .tabbody')), 0) }),
    h('div', { class: 'row', style: { justifyContent: 'space-between', margin: 0 } }, h('div', { class: 'hint', style: { margin: 0 } }, 'Settings are kept in this browser and apply to every franchise.'),
      typeof versionLine === 'function' ? versionLine() : null));
}
// ====================================================================
//  QUICK PLAY (standard, or linked to a franchise save)
// ====================================================================
// scrQuickPlay lives in quickplay.js (seeded generated teams)
function launchMatch(cfg) { if (typeof demoStop === 'function') demoStop(); app.classList.remove('show'); Music.stop(); MenuBG.hide(); startMatch(cfg); }
function scrExhibition() {
  const save = UI.save, user = save.userTeamId;
  let opp = save.teamOrder.find(id => id !== user), userHome = true;
  const box = h('div');
  const render = () => {
    box.innerHTML = '';
    box.appendChild(h('div', { class: 'teampick' }, save.teamOrder.filter(id => id !== user).map(id =>
      h('div', { class: 'teamcard' + (id === opp ? ' on' : ''), onclick: () => { opp = id; render(); } }, badge(T(id), 34), h('div', null, fullName(T(id)), h('div', { class: 'muted', 'data-help': 'Team OVR: the average rating of the dressed lineup (players 75%, keeper 25%).' }, 'Team OVR ' + Math.round(teamStrength(save, id) * 10)))))));
    box.appendChild(h('div', { class: 'row' }, h('button', { class: userHome ? 'sel' : '', onclick: () => { userHome = true; render(); } }, 'HOME'), h('button', { class: !userHome ? 'sel' : '', onclick: () => { userHome = false; render(); } }, 'AWAY')));
  };
  render();
  return h('div', { class: 'screen' }, header('EXHIBITION: ' + fullName(T(user)).toUpperCase(), () => go(scrQuickPlay)),
    h('div', { class: 'sub' }, `Choose an opponent from your league. Your team OVR: ${Math.round(teamStrength(save, user) * 10)}.`), box,
    h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => go(() => scrPregame(null, [], { exh: true, opp, userHome })) }, 'NEXT ▶')));
}
function scrChooseSave(then) {
  return h('div', { class: 'screen' }, header('CHOOSE A FRANCHISE', () => go(scrMain)),
    UI.saves.length ? h('div', { class: 'grid g2' }, UI.saves.map(m => saveCard(m, [h('button', { class: 'primary', onclick: async () => { if (await loadSave(m.id)) go(then); } }, 'SELECT')])))
      : h('div', { class: 'panel sub' }, 'No franchise saves yet. Start one from SEASON MODE.'));
}

// ====================================================================
//  SAVE MANAGEMENT
// ====================================================================
function saveCard(m, buttons) {
  const t = { colors: m.colors, emblem: m.emblem };
  return h('div', { class: 'panel', style: { margin: 0 } },
    h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } }, badge(t, 44),
      h('div', { style: { fontSize: '9px', lineHeight: 2 } }, h('div', { class: 'gold' }, m.name, m.dream ? h('span', { class: 'dtbadge' }, '★ DREAM TEAM') : null), h('div', { style: { color: teamTextColor(t) } }, m.teamName),
        h('div', { class: 'muted' }, `Season ${m.season} (${m.label}) · ${m.record} · ${m.champs} title${m.champs === 1 ? '' : 's'}`),
        h('div', { class: 'muted', style: { fontSize: '7px' } }, 'Last played ' + new Date(m.lastPlayed).toLocaleString()))),
    h('div', { class: 'row', style: { justifyContent: 'flex-start', marginTop: '10px' } }, buttons));
}
async function loadSave(id) {
  try { Store.repairNote = null; const s = await Store.load(id); if (!s) { toast('Could not load that save.'); return false; } UI.save = s;
    if (Store.repairNote) { toast(Store.repairNote, 9000); if (typeof pushNews === 'function') pushNews(s, Store.repairNote); Store.save(s); } if (typeof syncProfileFromSave === 'function') syncProfileFromSave(s); return true; }
  catch (e) { toast('Could not load that save: ' + (e.message || e.code || e)); return false; }
}
async function refreshSaves() { UI.saves = await Store.list(); }
function scrSaves() {
  const list = h('div', { class: 'grid g2' });
  const fill = () => {
    list.innerHTML = '';
    if (!UI.saves.length) list.appendChild(h('div', { class: 'panel sub' }, 'No franchises yet. Create one to start your first season.'));
    for (const m of UI.saves.slice().sort((a, b) => b.lastPlayed - a.lastPlayed)) list.appendChild(saveCard(m, [
      h('button', { class: 'primary', onclick: async e => { const b = e.currentTarget; if (b.disabled) return; b.disabled = true; b.textContent = 'LOADING...'; if (await loadSave(m.id)) go(scrHub); else { b.disabled = false; b.textContent = 'LOAD'; } } }, 'LOAD'),
      h('button', { onclick: () => renameSave(m, fill) }, 'RENAME'),
      h('button', { onclick: async () => { if (await loadSave(m.id)) doExport(UI.save); } }, 'EXPORT'),
      h('button', { class: 'danger', onclick: () => confirmDlg(`Delete "${m.name}" (${m.teamName})? Its seasons, stats and trophies will be gone for good.`, 'DELETE', async () => {
        await Store.remove(m.id); if (UI.save && UI.save.id === m.id) UI.save = null; await refreshSaves(); fill(); toast('Save deleted.'); }, true) }, 'DELETE')]));
  };
  fill();
  return h('div', { class: 'screen' }, header('SEASON MODE', () => go(scrMain), 'MAIN MENU',
      h('button', { class: 'primary', onclick: () => go(scrNewFranchise) }, '+ NEW FRANCHISE'), h('button', { onclick: () => importDlg(fill) }, 'IMPORT')),
    h('div', { class: 'sub' }, Store.modeLabel() + '. Each franchise is its own league: nothing carries over between saves.'), list);
}
function renameSave(m, refill) {
  modal(close => {
    const inp = h('input', { type: 'text', value: m.name, maxLength: 28, style: { width: '100%' } });
    return h('div', null, h('h2', null, 'RENAME SAVE'), inp, h('div', { class: 'row', style: { marginTop: '12px' } },
      h('button', { class: 'primary', onclick: async () => { const s = (UI.save && UI.save.id === m.id) ? UI.save : await Store.load(m.id); if (!s) return; s.name = inp.value.trim() || s.name; await Store.save(s); await refreshSaves(); close(); refill(); } }, 'SAVE'),
      h('button', { onclick: close }, 'CANCEL')));
  });
}
async function doExport(save) {
  await Store.flush();
  const r = await exportSave(save);
  if (r.ok) return toast('Exported ' + r.filename);
  if (r.declined) return toast('Export cancelled.');
  modal(close => {
    const ta = h('textarea', { readOnly: true }, r.json);
    return h('div', null, h('h2', null, 'EXPORT SAVE'), h('div', { class: 'sub' }, "This page can't download files here, so copy the save text below and paste it into a file named " + r.filename + '.'), ta,
      h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'primary', onclick: async () => { try { await navigator.clipboard.writeText(r.json); toast('Copied!'); } catch (e) { ta.select(); toast('Select all and copy.'); } } }, 'COPY'), h('button', { onclick: close }, 'CLOSE')));
  });
}
function importDlg(refill) {
  modal(close => {
    const msg = h('div', { class: 'sub' }, 'Choose an exported .json file, or paste its text.');
    const ta = h('textarea', { placeholder: 'Paste save text here...' });
    const handle = async text => {
      const r = parseImport(text);
      if (r.error) { msg.textContent = r.error; msg.className = 'sub red'; return; }
      const s = r.save, dup = UI.saves.find(m => m.id === s.id);
      const finish = async (copy) => {
        if (copy) { s.id = newUid(); s.name = s.name + ' (copy)'; }
        await Store.save(s); await refreshSaves(); close(); refill(); toast('Imported ' + s.name + '.');
      };
      if (!dup) return finish(false);
      close();
      modal(c2 => h('div', null, h('h2', null, 'THIS SAVE ALREADY EXISTS'), h('div', { class: 'sub' }, `"${dup.name}" (${dup.teamName}, season ${dup.season}) is already here. The imported file is season ${s.seasonNum}.`),
        h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => { c2(); finish(true); } }, 'KEEP BOTH (IMPORT AS A COPY)'),
          h('button', { class: 'danger', onclick: () => { c2(); confirmDlg(`Replace "${dup.name}" with the imported file? The current version will be overwritten.`, 'REPLACE', async () => { if (UI.save && UI.save.id === s.id) UI.save = null; await Store.save(s); await refreshSaves(); refill(); toast('Save replaced.'); }, true); } }, 'REPLACE EXISTING'),
          h('button', { onclick: c2 }, 'CANCEL'))));
    };
    const file = h('input', { type: 'file', accept: '.json,application/json', onchange: () => { const f = file.files[0]; if (f) f.text().then(handle); } });
    return h('div', null, h('h2', null, 'IMPORT SAVE'), msg, file, h('div', { style: { margin: '12px 0 6px' }, class: 'sub' }, 'or paste:'), ta,
      h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'primary', onclick: () => handle(ta.value) }, 'IMPORT PASTED TEXT'), h('button', { onclick: close }, 'CANCEL')));
  });
}
// a random team identity for the new league: a city, a nickname (with its emblem), colours, a jersey style and a
// unique abbreviation, none of them already used by another team in the league being set up
function randomTeamIdentity(id, others) {
  const pools = {
    cities: QP_CITIES.concat(Object.values(DEFAULT_TEAMS).map(t => t.city)),
    nicks: QP_NICKS.concat(Object.values(DEFAULT_TEAMS).map(t => [t.nick, t.emblem])),
    pals: QP_PALETTES.concat(Object.values(DEFAULT_TEAMS).map(t => [t.colors.p, t.colors.s, t.colors.a])),
  };
  const used = k => new Set(others.map(t => t[k]));
  const pick = (arr, bad) => { const ok = arr.filter(x => !bad(x)); const from = ok.length ? ok : arr; return from[(Math.random() * from.length) | 0]; };
  const uc = used('city'), un = used('nick'), ua = used('abbr'), up = new Set(others.map(t => t.colors.p));
  const city = pick([...new Set(pools.cities)], c => uc.has(c));
  const [nick, emb] = pick(pools.nicks, n => un.has(n[0]));
  const pal = pick(pools.pals, pp => up.has(pp[0]));
  const letters = city.replace(/[^A-Za-z]/g, '').toUpperCase(), nl = nick.replace(/[^A-Za-z]/g, '').toUpperCase();
  const tries = [letters.slice(0, 3), letters[0] + letters.slice(-2), letters.slice(0, 2) + nl[0], letters[0] + nl.slice(0, 2), nl.slice(0, 3)];
  let abbr = tries.find(x => x.length === 3 && !ua.has(x)) || (letters[0] + nl[0] + String.fromCharCode(65 + ((Math.random() * 26) | 0)));
  const styles = JERSEY_STYLES.filter(st => !st.cos).map(st => st.id);
  return { id, city, nick, abbr, colors: { p: pal[0], s: pal[1], a: pal[2] }, style: styles[(Math.random() * styles.length) | 0], emblem: EMBLEMS[emb] ? emb : 'puck', trim: null, logo: null };
}
function scrNewFranchise() {
  const nf = UI.nf || (UI.nf = { teamId: 'eagles', name: 'My Franchise', identity: null, league: {} });
  nf.league = nf.league || {};
  const box = h('div');
  const nameIn = h('input', { type: 'text', value: nf.name, maxLength: 28, oninput: () => { nf.name = nameIn.value; } });
  const teamOf = id => (id === nf.teamId && nf.identity) ? nf.identity : nf.league[id] || DEFAULT_TEAMS[id];
  const othersThan = id => LEAGUE_TEAM_IDS.filter(x => x !== id).map(teamOf);
  const render = () => {
    box.innerHTML = '';
    box.appendChild(h('div', { class: 'teampick' }, LEAGUE_TEAM_IDS.map(id => {
      const t = teamOf(id);
      return h('div', { class: 'teamcard' + (id === nf.teamId ? ' on' : ''), onclick: () => {
          // switching teams: your customised identity becomes that team's league identity, so nothing is lost
          if (nf.teamId !== id && nf.identity) { nf.league[nf.teamId] = nf.identity; nf.identity = null; }
          nf.teamId = id; render(); } }, badge(t, 40),
        h('div', null, h('div', { style: { color: teamTextColor(t) } }, fullName(t)), h('div', { class: 'muted', style: { fontSize: '7px' } }, id === nf.teamId ? (nf.identity || nf.league[id] ? 'SELECTED · NEW IDENTITY' : 'SELECTED') : '')));
    })));
  };
  render();
  const reroll = () => { nf.identity = randomTeamIdentity(nf.teamId, othersThan(nf.teamId)); delete nf.league[nf.teamId]; render(); };
  const rerollAll = () => {
    nf.identity = null; nf.league = {};
    const done = [];
    for (const id of LEAGUE_TEAM_IDS) { const t = randomTeamIdentity(id, done); nf.league[id] = t; done.push(t); }
    render();
  };
  const resetAll = () => { nf.identity = null; nf.league = {}; render(); };
  const create = async () => {
    const mine = nf.identity || nf.league[nf.teamId] || null, league = Object.assign({}, nf.league); delete league[nf.teamId];
    const save = newFranchise({ name: nf.name.trim() || 'My Franchise', teamId: nf.teamId, identity: mine, league });
    UI.nf = null; UI.save = save;
    go(scrHub);                                                          // straight in: the first save finishes in the background
    toast('Franchise created. Welcome to the ' + fullName(save.teams[save.userTeamId]) + '!');
    Store.save(save).then(() => refreshSaves());
  };
  const changed = nf.identity || Object.keys(nf.league).length;
  const diffRow = h('div', { class: 'row nfdiff', style: { justifyContent: 'flex-start', alignItems: 'center', gap: '6px', margin: '8px 0 0' } },
    h('span', { class: 'sub', style: { margin: 0 } }, 'CPU DIFFICULTY'), Object.keys(DIFF).map(d => h('button', { class: 'small' + (S.diff === d ? ' sel' : ''), onclick: () => { S.diff = d; if (d === 'HARD') S.speed = 'NORMAL'; saveSettings(); go(scrNewFranchise); } }, d)),
    h('span', { class: 'muted', style: { fontSize: 'calc(7px * var(--ts, 1.2))' }, 'data-help': 'You can change the difficulty any time in Settings.' }, 'ⓘ'));
  return h('div', { class: 'screen newfr' }, header('NEW FRANCHISE', () => { UI.nf = null; go(scrSaves); }, 'BACK', h('button', { class: 'primary', onclick: create }, 'CREATE FRANCHISE ▶')),
    h('div', { class: 'panel' }, h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'flex-end', gap: '14px', margin: 0 } }, h('div', null, h('label', { class: 'f' }, 'SAVE NAME'), nameIn), diffRow),
      h('label', { class: 'f' }, 'CHOOSE YOUR TEAM ', h('span', { class: 'muted nfnote' }, '· all 24 clubs start equal: you build the roster in the Inaugural Draft. Your club is locked to this save.')), box,
      h('div', { class: 'row', style: { marginTop: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' } },
        h('button', { onclick: () => { reroll(); go(scrNewFranchise); }, title: 'A new random city, name, colours and logo for the selected team' }, 'RANDOMIZE TEAM'),
        h('button', { onclick: () => { rerollAll(); go(scrNewFranchise); }, title: 'A whole new league: every team gets a random identity' }, 'RANDOMIZE ALL'),
        changed ? h('button', { class: 'ghost', onclick: () => { resetAll(); go(scrNewFranchise); } }, 'ORIGINAL TEAMS') : null,
        h('button', { onclick: () => go(() => scrCustomizer(clone(teamOf(nf.teamId)), DEFAULT_TEAMS[nf.teamId], id => { nf.identity = id; delete nf.league[nf.teamId]; go(scrNewFranchise); }, () => go(scrNewFranchise))) }, 'CUSTOMIZE...'),
        )),
    typeof dreamEntry === 'function' ? dreamEntry() : null);
}

// ====================================================================
//  FRANCHISE HUB
// ====================================================================
function recordStr(st) { return `${st.w}-${st.otl}-${st.l}`; }   // SOCCER: W-D-L (draws live in the old otl field)
// little pixel icons for the hub tiles (8x8, drawn in the tile's colour)
const HUB_ICONS = {
  people:  ['.##..##.', '.##..##.', '........', '####.###', '########', '########', '###..###', '........'],
  bars:    ['......#.', '......#.', '...#..#.', '...#..#.', '#..#..#.', '#..#..#.', '#..#..#.', '########'],
  brush:   ['......##', '.....###', '....###.', '...###..', '..###...', '.##.....', '###.....', '##......'],
  medal:   ['##....##', '.##..##.', '..####..', '.######.', '.##..##.', '.##..##.', '.######.', '..####..'],
  cup:     ['########', '#.####.#', '#.####.#', '.######.', '..####..', '...##...', '..####..', '.######.'],
  helmet:  ['..####..', '.######.', '########', '###..###', '##....##', '##.##.##', '##.##.##', '##....##'],
  arena:   ['...##...', '..####..', '.######.', '########', '#.#.#.##', '########', '#.#.#.##', '########'],
  dollar:  ['...##...', '.######.', '##.##...', '.#####..', '...##.##', '######..', '...##...', '...##...'],
  paper:   ['######..', '#....##.', '#.###.##', '#......#', '#.####.#', '#......#', '#.###..#', '########'],
  swap:    ['..#.....', '.##.....', '########', '.##.....', '.....##.', '########', '.....##.', '.....#..'],
  plus:    ['.##.....', '.##..#..', '.....#..', '####.###', '####..#.', '####..#.', '#..#....', '........'],
  list:    ['##.#####', '........', '##.#####', '........', '##.#####', '........', '##.#####', '........'],
  cal:     ['.#....#.', '########', '#......#', '#.#.#.##', '#......#', '#.#.#.##', '#......#', '########'],
  bracket: ['###.....', '..#.....', '..####..', '..#..#..', '###..###', '.....#..', '..####..', '..#.....'],
  book:    ['.######.', '##....##', '##.##.##', '##....##', '##.##.##', '##....##', '########', '.######.'],
};
function hubIcon(key, col) {
  const rows = HUB_ICONS[key] || HUB_ICONS.list, cv = h('canvas', { width: 16, height: 16, class: 'hubicon' }), c = cv.getContext('2d');
  c.fillStyle = col; rows.forEach((r, y) => { for (let x = 0; x < 8; x++) if (r[x] === '#') c.fillRect(x * 2, y * 2, 2, 2); });
  return cv;
}
// ---- GAME REPORT: everything saved about one played game (your games keep a full box score)
function gameReport(save, g) {
  const se = save.season, A = T(g.away), Hm = T(g.home), B = g.box, nm = id => { const p = Pl(id); return p ? '#' + p.num + ' ' + p.last.toUpperCase() : '?'; };
  const head = h('div', { class: 'row', style: { alignItems: 'center', justifyContent: 'center', gap: '18px' } },
    h('div', { style: { textAlign: 'center' } }, badge(A, 48), h('div', { style: { color: teamTextColor(A), marginTop: '4px' } }, A.abbr)),
    h('div', { style: { textAlign: 'center' } }, h('div', { class: 'big gold' }, g.as + ' - ' + g.hs), h('div', { class: 'muted', style: { fontSize: '7px' } }, (g.so ? 'FINAL (SO)' : g.ot ? 'FINAL (ET)' : 'FINAL') + (g.sim ? ' · simulated' : ''))),
    h('div', { style: { textAlign: 'center' } }, badge(Hm, 48), h('div', { style: { color: teamTextColor(Hm), marginTop: '4px' } }, Hm.abbr)));
  const parts = [h('h2', { style: { margin: '0 0 6px', textAlign: 'center' } }, (g.label || 'GAME').toUpperCase()), head];
  if (B && B.goals && B.goals.length) {
    const byPer = {}; for (const x of B.goals) (byPer[x.per || 0] = byPer[x.per || 0] || []).push(x);
    const perName = k => +k === 0 ? 'GOALS' : +k >= 4 ? 'EXTRA TIME' : ['1ST', '1ST', '2ND'][k - 1] + ' HALF';
    parts.push(h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'SCORING'), Object.keys(byPer).sort().map(k => h('div', null, h('div', { class: 'gold', style: { fontSize: '7px', margin: '6px 0 2px' } }, perName(k)),
      byPer[k].map(x => h('div', { style: { fontSize: '8px', margin: '3px 0' } }, badge(T(x.t), 12), ' ', h('span', { style: { color: teamTextColor(T(x.t)) } }, T(x.t).abbr), ' ', nm(x.p),
        h('span', { class: 'muted' }, (x.a && x.a.length ? '  (' + x.a.map(nm).join(', ') + ')' : '  (unassisted)') + (x.pp ? ' · PP' : '') + (x.sh ? ' · SH' : '') + (x.en ? ' · EN' : '') + (x.ps ? ' · PENALTY KICK' : '') + (x.clk != null ? ' · ' + fmtClock(x.clk) : ''))))))));
  } else if (B) parts.push(h('div', { class: 'panel muted' }, g.so ? 'Decided in the shootout: no goals in regulation or extra time.' : 'No goals.'));
  if (g.stars && g.stars.length) parts.push(h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'THREE STARS'),
    g.stars.map(s => h('div', { style: { fontSize: '8px', margin: '3px 0' } }, '★'.repeat(s.rank) + ' ', '#' + s.num + ' ' + s.name.toUpperCase(), h('span', { class: 'muted' }, ' · ' + T(s.teamId).abbr + (s.stat ? ' · ' + s.stat : ''))))));
  if (g.gwg) parts.push(h('div', { class: 'sub' }, 'Game-winning goal: #' + g.gwg.num + ' ' + g.gwg.name + (g.gwg.ot ? ' (ET)' : '')));
  if (B && B.lines && B.lines.length) {
    const sum = (t, k) => B.lines.filter(l => l.t === t).reduce((a, l) => a + (l[k] || 0), 0), ts = B.ts || {};
    const row = (lab, f) => h('tr', null, h('td', { class: 'l' }, lab), h('td', null, f(g.away)), h('td', null, f(g.home)));
    parts.push(h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'TEAM STATS'), h('table', null, h('tr', null, h('th', { class: 'l' }), h('th', null, A.abbr), h('th', null, Hm.abbr)),
      row('SHOTS', t => sum(t, 's')), row('TACKLES', t => sum(t, 'h')), row('CARDS', t => ts[t] ? Math.round(ts[t].pim / (typeof BAL !== 'undefined' && BAL.pen && BAL.pen.len || 30)) : '-'),
      null)));   // (SOCCER: no contested kickoffs to count)
    const teamBox = t => { const ls = B.lines.filter(l => l.t === t), sk = ls.filter(l => (Pl(l.p) || {}).pos !== 'G').sort((a, b) => (b.g + b.a) - (a.g + a.a) || b.toi - a.toi), gk = ls.filter(l => (Pl(l.p) || {}).pos === 'G' && (l.sa || l.toi));
      return h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0, color: teamTextColor(T(t)) } }, T(t).abbr),
        h('table', null, h('tr', null, h('th', { class: 'l' }, 'PLAYER'), h('th', null, 'G'), h('th', null, 'A'), h('th', null, 'SOG'), h('th', null, 'TKL'), h('th', null, 'CRD')),
          sk.map(l => h('tr', null, h('td', { class: 'l' }, nm(l.p)), h('td', null, l.g), h('td', null, l.a), h('td', null, l.s), h('td', null, l.h), h('td', null, Math.round((l.pim || 0) / (BAL.pen.len || 30)) || '')))),
        gk.length ? h('table', { style: { marginTop: '6px' } }, h('tr', null, h('th', { class: 'l' }, 'KEEPER'), h('th', null, 'SA'), h('th', null, 'GA'), h('th', null, 'SV%')),
          gk.map(l => h('tr', null, h('td', { class: 'l' }, nm(l.p)), h('td', null, l.sa), h('td', null, l.ga), h('td', null, l.sa ? fmtSv((l.sa - l.ga) / l.sa) : '-')))) : null); };
    parts.push(h('div', { class: 'grid two' }, teamBox(g.away), teamBox(g.home)));
  }
  if (B && B.inj && B.inj.length) parts.push(h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'INJURIES'), B.inj.map(i => h('div', { class: 'red', style: { fontSize: '8px' } }, nm(i.p) + ' · ' + i.k + ' · out ' + i.g + ' game' + (i.g === 1 ? '' : 's')))));
  if (!B) parts.push(h('div', { class: 'hint' }, 'The full box score is kept for games played from now on; this one only has its result' + (g.stars ? ' and three stars.' : '.')));
  modal(close => h('div', null, ...parts, h('div', { class: 'row' }, h('button', { class: 'primary', onclick: close }, 'CLOSE'))), true);
}
// ---- SCOUTING: what you know about a team: form, best players, starting goalie, injuries, style
function teamScout(save, t) {
  const se = save.season, ln = id => (se.stats[id] || {}).reg || emptyLine();
  const sk = [...t.roster.lines.flat(), ...t.roster.reserves].filter(Boolean).map(Pl).filter(Boolean);
  const stars = sk.map(p => { const l = ln(p.id); return { p, pts: l.g + l.a, l, line: l.gp ? `${l.g}G ${l.a}A` : 'OVR ' + ovrInt(p) }; })
    .sort((a, b) => b.pts - a.pts || ovrInt(b.p) - ovrInt(a.p));
  const g0 = t.roster.goalies[0] ? Pl(t.roster.goalies[0]) : null, gl = g0 ? ln(g0.id) : null;
  const goalie = g0 ? { p: g0, line: gl && gl.gp ? fmtSv(svPct(gl)) + ' SV%' : 'OVR ' + ovrInt(g0) } : null;
  const inj = [...sk, ...t.roster.goalies.filter(Boolean).map(Pl)].filter(p => p && p.inj && p.inj.g > 0).map(p => ({ p, g: p.inj.g, kind: p.inj.kind }));
  const played = Object.values(se.games).filter(g => g.played && (g.home === t.id || g.away === t.id)).slice(-5);   // (games are kept in schedule order)
  const form = played.length ? played.map(g => { const us = g.home === t.id ? g.hs : g.as, them = g.home === t.id ? g.as : g.hs; return us > them ? 'W' : us === them ? 'D' : 'L'; }).join(' ') : '';
  return { stars, goalie, inj, form, sk };
}
function scoutReport(save, t) {
  const se = save.season, s = se.standings[t.id] || {}, sc = teamScout(save, t), hard = S.diff === 'HARD';
  const order = sortedStandings(save);
  modal(close => h('div', null,
    h('div', { class: 'row', style: { alignItems: 'center', gap: '14px', justifyContent: 'flex-start' } }, badge(t, 56),
      h('div', null, h('h2', { style: { margin: 0, color: teamTextColor(t) } }, fullName(t).toUpperCase()),
        h('div', { class: 'sub', style: { margin: '4px 0 0' } }, (s.gp != null ? recordStr(s) + ' · ' + s.pts + ' PTS · ' : '') + ordinal(order.indexOf(t.id) + 1) + ' in the league · GF ' + (s.gf || 0) + ' · GA ' + (s.ga || 0) + (sc.form ? ' · LAST 5: ' + sc.form : '')))),
    h('div', { class: 'grid two', style: { marginTop: '10px' } },
      h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'TOP PLAYERS'),
        sc.stars.slice(0, 5).map(x => h('div', { style: { margin: '4px 0', fontSize: '8px' } }, '#' + x.p.num + ' ' + x.p.last.toUpperCase(), h('span', { class: 'muted' }, ' · OVR ' + ovrInt(x.p) + ' · ' + x.line), typeof traitChips === 'function' ? traitChips(x.p) : null))),
      h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'IN GOAL'),
        t.roster.goalies.filter(Boolean).map(Pl).filter(Boolean).map((g, i) => { const l = (se.stats[g.id] || {}).reg || emptyLine(); return h('div', { style: { margin: '4px 0', fontSize: '8px' } }, (i === 0 ? 'STARTER ' : 'BACKUP ') + '#' + g.num + ' ' + g.last.toUpperCase(), h('span', { class: 'muted' }, ' · OVR ' + ovrInt(g) + (l.gp ? ' · ' + fmtSv(svPct(l)) + ' SV%' : ''))); }),
        h('h3', null, 'INJURIES'),
        sc.inj.length ? sc.inj.map(x => h('div', { class: 'red', style: { fontSize: '8px', margin: '3px 0' } }, '#' + x.p.num + ' ' + x.p.last.toUpperCase() + ' · ' + x.kind + ' · out ' + x.g + ' game' + (x.g === 1 ? '' : 's'))) : h('div', { class: 'muted' }, 'Nobody on the injury list.'),
        h('h3', null, 'STYLE'),
        h('div', { class: 'muted', style: { fontSize: '7px', lineHeight: 1.8 } }, hard ? 'Opponent tactics are hidden on Hard.' : (typeof tacSummary === 'function' && typeof teamTacFor === 'function' ? tacSummary(teamTacFor(save, t)) : '')))),
    h('div', { class: 'row' }, h('button', { class: 'primary', onclick: close }, 'CLOSE'))), true);
}
// shrink the game card's contents until they fit, instead of clipping them (large text sizes)
function fitHero(hero) {
  if (!hero || !hero.isConnected) return;
  const kids = [...hero.children];
  let z = 1;
  kids.forEach(k => { k.style.zoom = ''; });
  const clipped = () => hero.scrollHeight > hero.clientHeight + 1 || [...hero.querySelectorAll('*')].some(e => e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0);
  while (z > 0.6 && clipped()) {
    z -= 0.05; kids.forEach(k => { k.style.zoom = z; });
  }
}
// tile titles shrink to fit rather than being cut short with '…'
function fitTileTitles(root) {
  if (!root || !root.isConnected) return;
  root.querySelectorAll('.tile .ttitle').forEach(t => {
    if (t.dataset.fit === '1') return;
    t.dataset.fit = '1'; t.style.zoom = '';
    let z = 1;
    while (z > 0.6 && t.scrollWidth > t.clientWidth + 1) { z -= 0.05; t.style.zoom = z; }
  });
}
function scrHub() {
  const save = UI.save;
  if (save.draft0 && !save.draft0.done) return scrDraft0();
  if (save.dream && !save.dream.built && typeof scrDreamBuilder === 'function') return scrDreamBuilder();   // a Dream Team still being built
  if (typeof moraleCheck === 'function') moraleCheck(save);                  // promises that came due (a tournament or the playoffs just ended)
  setTimeout(() => { if (typeof showNotices === 'function') showNotices(); }, 60);
  const se = save.season, user = T(save.userTeamId);
  const order = sortedStandings(save), st = se.standings[user.id], pos = order.indexOf(user.id) + 1;
  const draftOpen = se.done && save.draft && !save.draft.done;
  const g = draftOpen ? null : nextUserGame(save);
  const ups = upcomingComps(save);
  const leave = to => async () => { await Store.flush(); await refreshSaves(); go(to); };
  // ---- top bar: who we are, plus the two "get out" buttons kept small
  const top = h('div', { class: 'hubtop' }, badge(user, 44),
    h('div', { style: { flex: 1, minWidth: 0 } },
      h('div', { style: { color: teamTextColor(user), fontSize: '12px' } }, fullName(user).toUpperCase()),
      h('div', { class: 'muted', style: { fontSize: '8px', marginTop: '6px' } }, `SEASON ${se.num} · ${seasonLabel(se.year)} · `,
        h('span', { class: 'gold' }, recordStr(st)), ` · ${ordinal(pos)} PLACE`, h('span', { class: 'muted hubsavename', style: { marginLeft: '10px', fontSize: '7px' } }, '(' + save.name + ' · autosaves)'), save.dream ? h('span', { class: 'dtbadge' }, '★ DREAM TEAM') : null)),
    h('span', { class: 'hubplay' }),
    h('div', { class: 'hubmenu' },
      h('button', { class: 'small ghost', onclick: () => go(() => scrSettings(scrHub)) }, 'SETTINGS'),
      h('button', { class: 'small ghost', onclick: leave(scrSaves) }, 'SAVES'),
      h('button', { class: 'small ghost', onclick: leave(scrMain) }, 'MAIN MENU')));
  // ---- hero: the one thing to do next
  let hero, primary = null;                                      // primary: the big button in the top bar (game days)
  const today = draftOpen ? null : currentDay(save);
  if (save.off) hero = offseasonHero(save);
  else if (today && today.invite) {
    const k = today.key, th = tourneyTheme(k), cname = COMP_INFO[k].name;
    let why, field, after;
    if (k === 'toc') {
      const f = tocField(Object.assign({}, save, { season: Object.assign({}, se, { tocChoice: 'accept' }) }));
      const q = f.qual[user.id] || {};
      why = q.how === 'champion' ? `You qualified as ${q.titles.join(' and ')} champions.` : `You qualified as a wildcard (${ordinal(q.place)} in the standings).`;
      field = 'Field: ' + f.seeds.map(id => T(id).abbr + (f.qual[id].how === 'champion' ? ' (champion)' : ' (wildcard)')).join(', ');
      after = 'If you decline, your place goes to the next team in the standings and the tournament is played without you.';
    } else {
      why = `You qualified for the ${cname}: ${ordinal(sortedStandings(save).indexOf(user.id) + 1)} in the standings (the top ${COMP_INFO[k].size} are invited).`;
      field = '';
      after = 'If you decline, the next team in the standings takes your place, and your team rests or trains instead.';
    }
    hero = h('div', { class: 'hero tourney t2', style: { borderColor: th.accent, background: `linear-gradient(180deg, ${th.dark}, #161a30)` } },
      h('div', { style: { margin: '-6px -2px 12px' } }, tourneyBannerCanvas({ key: k, tier: 2, title: th.short, round: 'YOU ARE INVITED', sub: 'SEASON ' + seasonLabel(se.year) }, 620, 110)),
      h('div', { class: 'sub' }, why, field ? h('br') : null, field),
      h('div', { class: 'sub' }, 'Entry is optional. ' + after),
      typeof tourRewardLine === 'function' && tourRewardLine(k) ? h('div', { class: 'sub gold', style: { margin: '2px 0 6px' } }, tourRewardLine(k)) : null,
      h('div', { class: 'row' }, h('button', { class: 'primary huge', onclick: () => { setChoice(se, k, 'accept'); Store.autosave(save); toast(`See you at the ${cname}!`); go(scrHub); } }, 'ACCEPT INVITATION ★'),
        h('button', { class: 'danger', onclick: () => chooseAlternative(k, cname, after) }, 'DECLINE')));
  } else if (draftOpen) {
    hero = h('div', { class: 'hero' }, h('div', { class: 'kicker' }, 'SEASON COMPLETE'),
      h('div', { class: 'big gold' }, 'ROOKIE DRAFT'),
      h('div', { class: 'sub' }, 'Pick one of three rookies, then the new season starts.'),
      h('button', { class: 'primary huge', onclick: () => go(scrDraft) }, 'GO TO ROOKIE DRAFT ★'));
  } else if (g) {
    const oppId = g.home === user.id ? g.away : g.home, opp = T(oppId);
    const stg = gameStage(save, g), th = tourneyTheme(stg.key);
    // both teams in matching boxes, each with a quick preview; the opponent's opens the full scouting report
    const side = (t, s, tag) => { const sc = teamScout(save, t), isOpp = t.id !== user.id;
      return h('div', { class: 'side mside' + (isOpp ? ' click' : ''), title: isOpp ? 'Scouting report' : '', onclick: isOpp ? () => scoutReport(save, t) : null }, badge(t, 64),
        h('div', { style: { color: teamTextColor(t), fontSize: '9px', marginTop: '8px' } }, t.abbr),
        h('div', { class: 'muted', style: { fontSize: '7px', marginTop: '4px' } }, (s ? recordStr(s) + ' · ' + ordinal(order.indexOf(t.id) + 1) + ' · ' : '') + tag),
        h('div', { class: 'mprev' },
          sc.form ? h('div', null, h('span', { class: 'muted' }, 'LAST 5 '), sc.form) : null,
          sc.stars.slice(0, 2).map(x => h('div', null, '★ #' + x.p.num + ' ' + x.p.last.toUpperCase(), h('span', { class: 'muted' }, ' ' + x.line))),
          sc.goalie ? h('div', null, h('span', { class: 'muted' }, 'G '), '#' + sc.goalie.p.num + ' ' + sc.goalie.p.last.toUpperCase(), h('span', { class: 'muted' }, ' ' + sc.goalie.line)) : null,
          h('div', { class: sc.inj.length ? 'red' : 'muted' }, sc.inj.length ? 'INJ: ' + sc.inj.map(x => x.p.last.toUpperCase() + ' (' + x.g + 'g)').join(', ') : 'NO INJURIES')),
        isOpp ? h('div', { class: 'gold', style: { fontSize: 'calc(6px * var(--ts, 1.2))', marginTop: '6px' } }, 'SCOUTING REPORT ▸') : null); };
    const awayT = g.home === user.id ? opp : user, homeT = g.home === user.id ? user : opp;
    const gameNo = Object.values(se.games).filter(x => x.type === 'reg' && x.played && (x.home === user.id || x.away === user.id)).length + 1;
    const top = stg.key === 'reg'
      ? h('div', { class: 'kicker' }, `REGULAR SEASON · GAME ${gameNo} OF ${Object.values(se.games).filter(x => x.type === 'reg' && (x.home === user.id || x.away === user.id)).length} · ${seasonLabel(se.year)}`)
      : h('div', { style: { margin: '-6px -2px 12px' } }, tourneyBannerCanvas({ key: stg.key, tier: stg.tier, title: th.short, round: stg.round.toUpperCase(), sub: stg.series && stg.series.bestOf > 1 ? `GAME ${stg.series.gids.indexOf(g.id) + 1} · BEST OF ${stg.series.bestOf} · SERIES ${T(stg.series.hi).abbr} ${stg.series.winsHi}-${stg.series.winsLo} ${T(stg.series.lo).abbr}` : 'SEASON ' + seasonLabel(se.year), teams: [awayT, homeT] }, 620, stg.tier >= 2 ? 120 : 86));
    hero = h('div', { class: 'hero' + (stg.key !== 'reg' ? ' tourney t' + stg.tier : ''), style: stg.key !== 'reg' ? { borderColor: th.accent, background: `linear-gradient(180deg, ${th.dark}, #161a30)` } : null }, top,
      h('div', { class: 'matchup' }, side(awayT, se.standings[awayT.id], 'AWAY'), h('div', { class: 'big gold' }, '@'), side(homeT, se.standings[homeT.id], 'HOME')),
      ups.length ? h('div', { class: 'muted hubnext' }, h('span', { class: 'gold' }, ups[0].name), ups[0].roundsAway ? ` in ${ups[0].roundsAway} game day${ups[0].roundsAway > 1 ? 's' : ''}` : ' is up now') : null);
    primary = { label: stg.final ? 'PLAY THE FINAL ▶' : 'PLAY NEXT GAME ▶', sim: true };
  } else {
    hero = h('div', { class: 'hero' }, h('div', { class: 'kicker' }, 'NO GAME FOR YOU THIS ROUND'),
      h('div', { class: 'sub' }, 'The rest of the league plays on. Continue to simulate their games.'));
    primary = { label: 'CONTINUE ▶', sim: false };
  }
  // ---- tiles: grouped, each with a live one-line summary
  const mine = [...user.roster.lines.flat(), ...user.roster.reserves].filter(Boolean);
  let lead = null;
  for (const id of mine) { const l = (se.stats[id] || {}).reg; if (l && (!lead || l.g + l.a > lead.pts)) lead = { id, pts: l.g + l.a }; }
  const left = Object.values(se.games).filter(x => x.type === 'reg' && !x.played && (x.home === user.id || x.away === user.id)).length;
  const myTro = save.trophies.filter(t => t.teamId === user.id).length;
  // every tile its own colour and pixel icon, so they're easy to tell apart at a glance
  const TILE_LOOK = {
    'ROSTER': ['#4f8cff', 'people'], 'PLAYER STATS': ['#38c6d9', 'bars'], 'CUSTOMIZE': ['#e05ac8', 'brush'], 'TEAM LOOK': ['#e05ac8', 'brush'], 'GEAR': ['#9a7cff', 'helmet'], 'LEGACY': ['#e8b04a', 'medal'],
    'TROPHY ROOMS': ['#ffd23f', 'cup'], 'GEAR & LOOK': ['#9a7cff', 'helmet'], 'ARENA': ['#ff8a3d', 'arena'],
    'FINANCES': ['#5ee07a', 'dollar'], 'CONTRACTS': ['#7fd0a0', 'paper'], 'TRADES': ['#3fd0c9', 'swap'], 'FREE AGENTS': ['#a6e05e', 'plus'], 'SPONSORS & GM': ['#ff8a3d', 'dollar'],
    'NEWS': ['#ff8a3d', 'paper'], 'GOALS': ['#ffd23f', 'medal'], 'PLAYERS': ['#4f8cff', 'people'],
    'STANDINGS': ['#6aa2ff', 'list'], 'SCHEDULE': ['#3fd0c9', 'cal'], 'BRACKETS': ['#ff6a8a', 'bracket'], 'HISTORY': ['#c9a26a', 'book'] };
  const tile = (title, sub, fn) => { const [col, ic] = TILE_LOOK[title] || ['#6aa2ff', 'list'];
    const el = h('button', { class: 'tile', onclick: fn, 'data-tip': sub, 'aria-label': title + ': ' + sub }, hubIcon(ic, col), h('div', { class: 'ttext' }, h('div', { class: 'ttitle' }, title), h('div', { class: 'tsub' }, sub)));
    el.style.setProperty('--tc', col); return el; };
  const custom = () => go(() => scrCustomizer(teamIdentity(user), user.defaults, id => { Object.assign(user, id, { id: user.id }); Store.autosave(save); toast('Team updated.'); go(scrHub); }, () => go(scrHub)));
  // the schedule, always one click away: what's left, and the next event
  const schedBtn = h('button', { class: 'schedbtn', onclick: () => go(scrSchedule) }, hubIcon('cal', '#0b1a2a'),
    h('div', { class: 'ttext' }, h('div', { class: 'ttitle' }, 'SCHEDULE'),
      h('div', { class: 'tsub' }, (left ? `${left} regular-season game${left > 1 ? 's' : ''} left` : 'Regular season done') + (ups.length ? ` · next event: ${ups[0].name}` + (ups[0].roundsAway ? ` in ${ups[0].roundsAway} game day${ups[0].roundsAway > 1 ? 's' : ''}` : ' (now)') : ''))),
    h('div', { class: 'go' }, '▶'));
  const tiles = tabbed('hubtiles', [
    { label: 'MY TEAM', el: () => h('div', { class: 'tiles t3' },
      tile('ROSTER', 'Lines, keepers, swaps', () => go(scrRoster)),
      tile('PLAYER STATS', lead && lead.pts ? `${Pl(lead.id).last} ${lead.pts} PTS` : 'Leaders', () => go(scrStats)),
      tile('TEAM LOOK', 'Colors, jersey, logo', custom),
      tile('GEAR', 'Headbands, masks, boots', () => go(() => scrGear())),
      tile('LEGACY', `${myTro ? myTro + ' troph' + (myTro > 1 ? 'ies' : 'y') : 'No trophies yet'} · ${Object.values(save.ach || {}).filter(a => a.done).length}/${ACHIEVEMENTS.length}`, () => { UI.legBack = scrHub; go(scrRooms); }),
      tile('ARENA', 'Logo, ads, lights', () => go(scrArena))) },
    { label: 'FRONT OFFICE' + ((save.tradeOffers || []).length ? ' •' : ''), el: () => h('div', { class: 'tiles' },
      tile('FINANCES', `Funds ${fmtM(finOf(user).cash)}`, () => go(scrFinances)),
      tile('CONTRACTS', save.off && save.off.phase === 'renew' ? `${(save.off.expiring[user.id] || []).length} expiring` : (n => n ? `${n} in final year` : 'Salaries')(rosterIds(user).map(Pl).filter(p => p && p.contract && p.contract.yrs <= 1).length), () => go(scrContracts)),
      tile('TRADES', (save.tradeOffers || []).length ? `${save.tradeOffers.length} offer${save.tradeOffers.length > 1 ? 's' : ''} waiting!` : (save.listings || []).length && tradeOpen(save) ? `${save.listings.length} player${save.listings.length > 1 ? 's' : ''} on the block` : tradeOpen(save) ? 'Trade block & offers' : 'Closed until free agency', () => go(scrTrade)),
      tile('FREE AGENTS', `${freeAgents(save).length} available`, () => go(scrFreeAgents)),
      tile('SPONSORS & GM', typeof gmMe === 'function' ? `${gmMe(save).offers.length} offer${gmMe(save).offers.length === 1 ? '' : 's'} · rep ${Math.round(gmMe(save).rep)}` : 'Deals & reputation', () => go(scrSponsors)),
      tile('GOALS', "Owner's targets", () => pop("OWNER'S GOALS", () => ownerGoalsPanel(save) || h('div', { class: 'panel muted' }, 'No goals set.')))) },
    { label: 'LEAGUE', el: () => h('div', { class: 'tiles' },
      tile('STANDINGS', `${ordinal(pos)} of ${order.length}`, () => go(scrStandings)),
      tile('SCHEDULE', left ? `${left} game${left > 1 ? 's' : ''} left` : 'Season done', () => go(scrSchedule)),
      tile('BRACKETS', ups.length ? ups[0].name : 'Tournaments', () => go(scrBrackets)),
      // these used to be buttons under PUCK TALK (the owner's goals moved to FRONT OFFICE)
      tile('NEWS', 'News & scores', () => pop('NEWS REPORT', newsReport)),
      tile('PLAYERS', 'Hot & favourites', () => pop('PLAYERS', () => h('div', null, hotPlayersPanel(save, 4), favouritesPanel(save)), ['PLAYER STATS ▸', scrStats])),
      tile('HISTORY', save.history.length ? `${save.history.length} past season${save.history.length > 1 ? 's' : ''}` : 'Awards & records', () => go(scrHistory))) }]);
  // ---- sidebar: glanceable info only
  const mini = h('div', { class: 'mini', onclick: () => go(scrStandings), title: 'Open standings' },
    order.map((id, i) => [id, i]).slice(Math.max(0, Math.min(order.length - 10, pos - 6)), Math.max(0, Math.min(order.length - 10, pos - 6)) + 10).map(([id, i]) => { const s = se.standings[id]; return h('div', { class: 'mrow' + (id === user.id ? ' me' : '') }, h('span', { class: 'muted' }, (i + 1) + '.'), badge(T(id), 14), h('span', { style: { flex: 1 } }, T(id).abbr), h('span', { class: 'muted' }, recordStr(s)), h('span', { class: 'gold', style: { width: '26px', textAlign: 'right' } }, s.pts)); }));
  const side = h('div', { class: 'hubside' }, tabbed('hubside', [
    { label: 'STANDINGS', el: () => h('div', { class: 'panel' }, mini,
      ups.length ? h('div', { class: 'muted', style: { fontSize: '7px', marginTop: '10px', lineHeight: 1.9 } }, h('span', { class: 'gold' }, ups[0].name), ups[0].roundsAway ? ` in ${ups[0].roundsAway} game day${ups[0].roundsAway > 1 ? 's' : ''}` : ' is up now') : null),
 },
    { label: 'GOALS', el: () => ownerGoalsPanel(save) || h('div', { class: 'panel muted' }, 'No goals set.') },
    { label: 'PLAYERS', el: () => h('div', null, hotPlayersPanel(save, 4), favouritesPanel(save)) },
    { label: 'NEWS', el: () => h('div', { class: 'panel' }, h('div', { class: 'news' }, save.news.length ? save.news.slice(0, 5).map(n => h('div', null, '• ', n.text)) : h('div', null, 'The season is about to begin.'))) }]));
  if (primary) top.querySelector('.hubplay').replaceWith(h('div', { class: 'hubplay' },
    h('button', { class: 'primary hubgo', onclick: () => advance(false) }, primary.label),
    primary.sim ? h('button', { class: 'link', onclick: () => advance(true) }, 'or simulate it') : null));
  // the desk's buttons: quick looks in a pop-up (the full screens one click further)
  const pop = (title, body, more) => modal(close => h('div', null, h('h2', null, title), body(),
    h('div', { class: 'row', style: { marginTop: '10px' } }, more ? h('button', { onclick: () => { close(); go(more[1]); } }, more[0]) : null, h('button', { onclick: close }, 'CLOSE'))));
  // NEWS REPORT: the full league news feed (what the old hub's news panel had) + the latest scores around the league
  const newsReport = () => {
    const rec = ((se.hlRecent || []).slice()).reverse(), newest = rec.length ? rec[0].d : null;
    const scores = rec.filter(x => x.d === newest).map(x => { const H0 = save.teams[x.home], A0 = save.teams[x.away]; return h('div', { class: 'mrow' }, h('span', { style: { flex: 1 } }, `${A0.abbr} ${x.as}  @  ${H0.abbr} ${x.hs}`), h('span', { class: 'muted' }, x.ot ? 'OT' : x.so ? 'SO' : 'FINAL')); });
    return tabbed('newsrep', [{ label: 'LEAGUE NEWS', el: () =>
      h('div', { class: 'panel' }, save.news.length ? pages('newsrep', save.news.slice(0, 40), 8, sl => h('div', { class: 'news' }, sl.map(n => h('div', null, '• ', n.text)))) : h('div', { class: 'news' }, 'The season is about to begin.')),
      }, scores.length ? { label: 'LATEST SCORES', el: () => h('div', { class: 'panel scoregrid' }, scores) } : null]);
  };
  const deskBtns = h('div', { class: 'deskbtns' },
    h('button', { class: 'newsbtn', onclick: () => pop('NEWS REPORT', newsReport) }, h('span', { class: 'nl' }, 'NEWS REPORT'), h('span', { class: 'ns' }, 'NEWS')),
    h('button', { onclick: () => pop('STANDINGS', () => h('div', { class: 'panel' }, mini.cloneNode(true)), ['FULL STANDINGS ▸', scrStandings]) }, 'STANDINGS'),
    h('button', { onclick: () => pop("OWNER'S GOALS", () => ownerGoalsPanel(save) || h('div', { class: 'panel muted' }, 'No goals set.')) }, 'GOALS'),
    h('button', { onclick: () => pop('PLAYERS', () => h('div', null, hotPlayersPanel(save, 4), favouritesPanel(save)), ['PLAYER STATS ▸', scrStats]) }, 'PLAYERS'),
    h('button', { onclick: () => go(scrSchedule), title: left ? `${left} regular-season games left` : '' }, 'SCHEDULE'));
  void side; void schedBtn; void deskBtns;
  if (hero) setTimeout(() => fitHero(hero), 0);
  setTimeout(() => fitTileTitles(tiles), 0);
  if (typeof MutationObserver === 'function' && tiles) new MutationObserver(() => fitTileTitles(tiles)).observe(tiles, { childList: true, subtree: true });
  return h('div', { class: 'screen hubA staged' }, top,
    h('div', { class: 'hubAgrid' + (primary ? '' : ' act') }, h('div', { class: 'hubleft' }, hero, tiles), h('div', { class: 'hubright' }, fsBtn('small ghost hubfs'), typeof deskPanel === 'function' ? deskPanel(save) : null)));
}
// THE OWNER'S GOALS: three targets set at the start of each season from how strong the roster is
function ownerGoals(save) {
  const se = save.season; if (!se) return null;
  if (!se.owner) {
    const rank = save.teamOrder.map(id => [id, teamStrength(save, id)]).sort((a, b) => b[1] - a[1]).findIndex(x => x[0] === save.userTeamId) + 1, n = save.teamOrder.length;
    const top = Math.max(2, Math.min(n - 2, rank + 2));
    se.owner = { top, rank, home: rank <= n / 2 ? 0.55 : 0.45, gd: rank <= n / 3 ? 10 : rank <= (2 * n) / 3 ? 0 : -10 };
    Store.autosave(save);
  }
  const O = se.owner, user = save.userTeamId, st = se.standings[user], pos = sortedStandings(save).indexOf(user) + 1;
  let hw = 0, hg = 0; for (const g of Object.values(se.games)) if (g.played && g.type === 'reg' && g.home === user) { hg++; if (g.hs > g.as) hw++; }
  const gd = st.gf - st.ga, started = st.gp > 0;
  return [
    { label: `FINISH TOP ${O.top}`, now: started ? ordinal(pos) : '-', ok: pos <= O.top },
    { label: `WIN ${Math.round(O.home * 100)}% AT HOME`, now: hg ? Math.round(hw / hg * 100) + '%' : '-', ok: hg ? hw / hg >= O.home : true },
    { label: `GOAL DIFFERENCE ${O.gd > 0 ? '+' + O.gd : O.gd === 0 ? 'EVEN OR BETTER' : 'NO WORSE THAN ' + O.gd}`, now: started ? (gd > 0 ? '+' + gd : String(gd)) : '-', ok: gd >= O.gd },
  ];
}
function ownerGoalsPanel(save) {
  const G = ownerGoals(save); if (!G) return null;
  const O = save.season.owner, n = save.teamOrder.length;
  const tone = O.rank <= n / 3 ? 'The owner expects a contender.' : O.rank <= (2 * n) / 3 ? 'The owner wants a step forward.' : 'The owner knows it is a building year.';
  return h('div', { class: 'panel' }, h('div', { class: 'grouplab', style: { marginTop: 0 } }, "OWNER'S GOALS"),
    h('div', { class: 'muted', style: { fontSize: '7px', marginBottom: '8px', lineHeight: 1.7 } }, tone),
    G.map(g => h('div', { class: 'mrow', style: { gap: '6px', fontSize: 'calc(7px * var(--ts, 1.2))', lineHeight: 1.6 } },
      g.now === '-' ? h('span', { class: 'muted' }, '·') : h('span', { style: { color: g.ok ? (S.pres && S.pres.cb ? '#3b8bff' : '#5ee07a') : (S.pres && S.pres.cb ? '#e040c8' : '#ff9e94') } }, g.ok ? '✓' : '✕'),
      h('span', { style: { flex: 1 } }, g.label), h('span', { class: 'gold' }, g.now))));
}
// HOT PLAYERS: league-wide, ranked by average Game Impact over each player's last three games (any team, any rating)
function hotPlayers(save, n = 5) {
  return Object.values(save.players).filter(p => p.status === 'active' && p.form && p.form.length >= 2).map(p => {
    const f = p.form.slice(-3), avg = f.reduce((a, x) => a + x.imp, 0) / f.length;
    return { p, avg, f };
  }).sort((a, b) => b.avg - a.avg).slice(0, n);
}
function formLine(p, f) {
  if (p.pos === 'G') { const sv = f.reduce((a, x) => a + (x.sv || 0), 0), ga = f.reduce((a, x) => a + (x.ga || 0), 0); return `last ${f.length}: ${sv} SV, ${ga} GA`; }
  const g = f.reduce((a, x) => a + x.g, 0), a = f.reduce((a2, x) => a2 + x.a, 0), ds = f.reduce((a2, x) => a2 + (x.ds || 0), 0);
  return `last ${f.length}: ${g}G ${a}A` + (ds ? `, ${ds} DS` : '');
}
function hotPlayersPanel(save, n) {
  const list = hotPlayers(save, n); if (!list.length) return null;
  return h('div', { class: 'panel' }, h('div', { class: 'grouplab', style: { marginTop: 0 } }, 'HOT PLAYERS'),
    list.map(({ p, avg, f }) => h('div', { class: 'hotrow', onclick: () => profile(p.id) }, portrait(p, null, 26),
      h('div', { style: { flex: 1, minWidth: 0 } }, h('div', null, (p.fav ? '★ ' : '') + '#' + p.num + ' ' + p.last.toUpperCase(), h('span', { class: 'muted' }, ' ' + (p.teamId ? T(p.teamId).abbr : '') + ' ' + (p.pos === 'G' ? 'G' : 'F'))),
        h('div', { class: 'muted', style: { fontSize: 'calc(6px * var(--ts, 1.2))', marginTop: '3px' } }, formLine(p, f))),
      h('span', { class: 'heat', title: 'Recent form' }, avg >= 20 ? '\uE003\uE003' : avg >= 12 ? '\uE003' : '▲'))));
}
function favouritesPanel(save) {
  const favs = Object.values(save.players).filter(p => p.fav).sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1)).slice(0, 6);
  if (!favs.length) return null;
  return h('div', { class: 'panel' }, h('div', { class: 'grouplab', style: { marginTop: 0 } }, '★ FAVOURITES'),
    favs.map(p => { const l = (save.season.stats[p.id] || emptyCats()).reg; return h('div', { class: 'hotrow', onclick: () => profile(p.id) }, portrait(p, null, 22),
      h('div', { style: { flex: 1 } }, '#' + p.num + ' ' + p.last.toUpperCase(), h('div', { class: 'muted', style: { fontSize: 'calc(6px * var(--ts, 1.2))', marginTop: '3px' } }, p.status !== 'active' ? (p.status === 'retired' ? 'Retired' : 'Free agent') : (p.teamId ? T(p.teamId).abbr + ' · ' : '') + (p.pos === 'G' ? `${l.gp} GP, ${fmtSv(svPct(l))}` : `${l.gp} GP, ${l.g}G ${l.a}A`)))); }));
}
const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
// simulate days without a user game, then go to the user's next game (or the end of the season)
function advance(simUser) {
  const save = UI.save, simmed = [];
  for (let guard = 0; guard < 80; guard++) {
    const day = currentDay(save);
    if (day.invite) { Store.autosave(save); return go(scrHub); }          // optional tournament: your call
    if (day.key === 'end') { finishSeason(save); Store.autosave(save); const hs = save.history[save.history.length - 1]; return go(() => hs && hs.awardsNight && typeof scrAwardsNight === 'function' ? scrAwardsNight(hs, () => go(() => scrSeasonEnd(simmed))) : scrSeasonEnd(simmed)); }
    if (day.userGid) {
      UI.dayGids = day.gids.slice();
      preGameAutoLines(save, day.userGid);
      if (!simUser) { Store.autosave(save); return go(() => scrPregame(day.userGid, simmed)); }
      const g = save.season.games[day.userGid];
      const res = simGame(save, g, { homeGoalie: null, awayGoalie: null });
      applyResult(save, g.id, res);
      const others = simRestOfDay(g.id);
      Store.autosave(save);
      return go(() => scrPostgame({ title: g.label, mode: 'season', g, res: null, lines: res.stats, others: simmed.concat(others), simulated: true }));
    }
    for (const id of day.gids) { applyResult(save, id, simGame(save, save.season.games[id])); simmed.push(id); }
  }
}
function simRestOfDay(exceptGid) {
  const save = UI.save, out = [];
  for (const id of UI.dayGids) { const g = save.season.games[id]; if (id !== exceptGid && !g.played) { applyResult(save, id, simGame(save, g)); out.push(id); } }
  if (typeof aiTradeProposal === 'function') aiTradeProposal(save);
  if (typeof marketTick === 'function') marketTick(save);
  return out;
}
// STAR PLAYER SPOTLIGHTS: real numbers only (form, scoring, goaltending, rookies, milestone chances, favourites)
function spotlightsFor(save, teamIds, max) {
  const se = save.season, out = [], used = new Set();
  const seasonLine = p => { const s2 = se.stats[p.id]; return s2 ? lifetime(s2) : emptyLine(); };
  const add = (p, title, stat, prio) => { if (!p || used.has(p.id)) return; used.add(p.id); out.push({ p, title, stat, prio }); };
  const roster = id => rosterIds(T(id)).map(Pl).filter(Boolean);
  const league = save.teamOrder.flatMap(roster);
  for (const tid of teamIds) {
    const ps = roster(tid);
    // milestone opportunities (within two)
    for (const p of ps) { const lt = lifetime(p.career);
      for (const [k, n2] of p.pos === 'G' ? [['w', 25], ['w', 50], ['w', 100]] : [['g', 25], ['g', 50], ['g', 100], ['g', 200]]) { const v = lt[k], need = n2 - v; if (need > 0 && need <= 2 && !(p.ms || {})[k + n2]) add(p, 'MILESTONE WATCH', `${need} ${k === 'g' ? 'GOAL' : 'WIN'}${need > 1 ? 'S' : ''} FROM ${n2}`, 90); } }
    for (const p of ps.filter(x => x.fav)) { const l = seasonLine(p); add(p, '★ FAVOURITE', p.pos === 'G' ? `${l.gp} GP · ${fmtSv(svPct(l))} SV% THIS SEASON` : `${l.g} GOALS · ${l.g + l.a} POINTS THIS SEASON`, 80); }
    const hot = hotPlayers({ players: Object.fromEntries(ps.map(p => [p.id, p])) }, 1)[0];
    if (hot && hot.avg >= 10) add(hot.p, 'PLAYER TO WATCH', formLine(hot.p, hot.f).toUpperCase().replace('LAST', 'IN HIS LAST') , 70);
    const lead = ps.filter(p => p.pos !== 'G').sort((a, b) => { const la = seasonLine(a), lb = seasonLine(b); return (lb.g + lb.a) - (la.g + la.a); })[0];
    if (lead) { const l = seasonLine(lead); if (l.g + l.a >= 3) add(lead, 'TEAM SCORING LEADER', `${l.g + l.a} POINTS IN ${l.gp} GAMES`, 60); }
    const gk = ps.filter(p => p.pos === 'G').map(p => ({ p, l: seasonLine(p) })).filter(x => x.l.sa >= 30).sort((a, b) => (b.l.xga - b.l.ga * 100) - (a.l.xga - a.l.ga * 100))[0];
    if (gk && gk.l.xga - gk.l.ga * 100 >= 100) add(gk.p, 'HOT KEEPER', `+${((gk.l.xga - gk.l.ga * 100) / 100).toFixed(1)} GOALS SAVED ABOVE EXPECTED`, 65);
  }
  // rising rookie: leads all rookies in points
  const rookies = league.filter(p => p.pos !== 'G' && !p.seasons.length && p.age <= 22).map(p => ({ p, pts: seasonLine(p).g + seasonLine(p).a })).sort((a, b) => b.pts - a.pts);
  if (rookies[0] && rookies[0].pts >= 3 && teamIds.includes(rookies[0].p.teamId)) add(rookies[0].p, 'RISING ROOKIE', 'LEADS ALL ROOKIES IN POINTS (' + rookies[0].pts + ')', 75);
  return out.sort((a, b) => b.prio - a.prio).slice(0, max || 3);
}
function spotlightCard(sp) {
  const t = sp.p.teamId ? T(sp.p.teamId) : null;
  return h('div', { class: 'spotcard', onclick: () => profile(sp.p.id) }, portrait(sp.p, t, 44),
    h('div', null, h('div', { class: 'gold', style: { fontSize: '8px' } }, sp.title), h('div', { style: { margin: '5px 0' } }, '#' + sp.p.num + ' ' + pname(sp.p).toUpperCase()),
      h('div', { class: 'muted', style: { fontSize: '7px' } }, (t ? t.abbr + ' · ' : '') + sp.stat)));
}
function starSnap(l) { const p = Pl(l.pid); return { pid: l.pid, name: pname(p), num: p.num, teamId: l.teamId, stat: statString(p.pos, l) }; }
function aiGoalie(save, teamId) {
  const t = T(teamId), gp = save.season.standings[teamId] ? save.season.standings[teamId].gp : 0;
  return (gp % 4 === 3 && t.roster.goalies[1]) ? t.roster.goalies[1] : t.roster.goalies[0];
}
function resultLine(g) {
  const save = UI.save, hw = g.hs > g.as;
  return h('div', { style: { fontSize: '8px', lineHeight: 2.2 } }, h('span', { class: hw ? '' : 'muted' }, T(g.home).abbr + ' ' + g.hs), ' - ', h('span', { class: hw ? 'muted' : '' }, g.as + ' ' + T(g.away).abbr),
    g.so ? ' (SO)' : g.ot ? ' (ET)' : '', h('span', { class: 'muted' }, '  ' + g.label));
}

// ====================================================================
//  PRE-GAME (goalie choice) and POST-GAME SUMMARY
// ====================================================================
// ---------- SMART AUTO-ARRANGE: preview (before / after, with the reasons) and the "before every game" option
function aaPreview(save, team, onDone) {
  const o = autoArrange(save, team, { dry: true }), cur = team.roster;
  const row = (id, j, other) => { const p = id && Pl(id); if (!p) return h('div', { class: 'aarow muted' }, '—');
    const pen = j != null ? offPosPenalty(p.spos, j, p) : 0;
    return h('div', { class: 'aarow' + (other && other !== id ? ' chg' : '') }, h('span', { class: 'aapos' }, j != null ? ['L', 'C', 'R'][j] : 'B'), ' ',
      h('span', { class: 'aatag' + (isDefPos(p.spos) ? ' d' : '') }, posShort(p.spos)), ' #' + p.num + ' ' + p.last.toUpperCase(), h('span', { class: 'muted' }, ' ' + ovrInt(p)),
      pen > 0 ? h('span', { class: 'red' }, ' -' + Math.round(pen * 100) + '%') : null, condBand(p.cond)[0] !== 'Fresh' && condBand(p.cond)[0] !== 'Ready' ? h('span', { class: 'gold' }, ' ' + Math.round(p.cond)) : null); };
  const col = (r, other, lab) => h('div', { class: 'aacol' }, h('div', { class: 'gold', style: { marginBottom: '4px' } }, lab),
    [0, 1, 2].map(i => h('div', { class: 'aaline' }, h('div', { class: 'muted aalh' }, 'LINE ' + (i + 1) + ' · ' + STRATEGIES[validTac(team.tac).lines[i]].short + ' · ' + TEMPOS[validTac(team.tac).tempo[i]].short),
      r.lines[i].map((id, j) => row(id, j, other.lines[i][j])))),
    h('div', { class: 'aaline' }, h('div', { class: 'muted aalh' }, 'BENCH'), r.reserves.map((id, k) => row(id, null, other.reserves[k]))));
  const same = JSON.stringify(o.lines) === JSON.stringify(cur.lines) && JSON.stringify(o.reserves) === JSON.stringify(cur.reserves);
  modal(close => h('div', { class: 'aaprev' }, h('h2', { style: { marginTop: 0 } }, 'AUTO-ARRANGE'),
    h('div', { class: 'sub', style: { margin: '0 0 6px' } }, 'Built for each line\'s tactic and tempo: natural sides, a stay-at-home D on every line, kickoffs at centre, the captain on line 1, tired players rested.'),
    same ? h('div', { class: 'sub green' }, 'Your lines are already the best fit. Nothing to change.') : h('div', { class: 'aagrid' }, col(cur, o, 'NOW'), col(o, cur, 'SUGGESTED'),
      h('div', { class: 'aacol aanotes' }, h('div', { class: 'gold', style: { marginBottom: '4px' } }, 'WHY'), o.notes.map(n => h('div', { class: 'aanote' }, '• ' + n)), h('div', { class: 'muted aamore' }))),
    h('div', { class: 'row' }, same ? null : h('button', { class: 'primary', onclick: () => { autoArrange(save, team); Store.autosave(save); close(); toast('Lines arranged.'); onDone && onDone(); } }, 'APPLY'),
      h('button', { onclick: close }, same ? 'OK' : 'CANCEL'))), true);
  setTimeout(() => { const box = document.querySelector('.modal .aaprev'), bx = box && box.closest('.box'); if (!bx) return;
    const ns = [...bx.querySelectorAll('.aanote')]; let cut = 0;
    while (ns.length && bx.scrollHeight > bx.clientHeight + 1) { ns.pop().remove(); cut++; }
    const m = bx.querySelector('.aamore'); if (m && cut) m.textContent = `+ ${cut} more small move${cut === 1 ? '' : 's'}`; }, 0);
}
function autoLinesToggle(save, rerender, small) {
  return h('button', { class: (small ? 'small ' : '') + (save.autoLines ? 'sel' : ''),
    'data-help': 'AUTO LINES BEFORE EVERY GAME: just before each of your games, your lines are rebuilt for your tactics: injured players out, tired ones rested, everyone on his best side, a stay-at-home D on every line. Your own changes are kept until the next game. Works on every difficulty.',
    onclick: () => { save.autoLines = !save.autoLines; Store.autosave(save); toast(save.autoLines ? 'Auto lines ON: your lines are set before every game.' : 'Auto lines OFF: your lines stay as you set them.'); rerender && rerender(); } },
    'AUTO LINES: ' + (save.autoLines ? 'ON' : 'OFF'));
}
// runs just before the user's game (play or simulate) when the option is on; keeps the reasons for the pre-game screen
function preGameAutoLines(save, gid) {
  if (!save.autoLines) return;
  const t = save.teams[save.userTeamId], before = JSON.stringify([t.roster.lines, t.roster.reserves]);
  const o = autoArrange(save, t);
  UI.autoLines = { gid, notes: JSON.stringify([o.lines, o.reserves]) === before ? [] : o.notes };
}
function autoLinesNote(save, gid) {
  const a = UI.autoLines; if (!save.autoLines || !a || a.gid !== gid) return null;
  if (!a.notes.length) return h('div', { class: 'sub green', style: { margin: '2px 0' } }, 'AUTO LINES: already the best fit tonight.');
  const moves = a.notes.filter(n => !/^Line \d has no/.test(n)).length;
  return h('div', { class: 'sub gold', style: { margin: '2px 0' } }, `AUTO LINES: ${moves} change${moves === 1 ? '' : 's'} tonight · `,
    h('a', { class: 'lnk', onclick: () => modal(close => h('div', null, h('h2', { style: { marginTop: 0 } }, 'AUTO LINES'), h('div', { class: 'aanotes' }, a.notes.slice(0, 12).map(n => h('div', null, '• ' + n))),
      h('div', { class: 'row' }, h('button', { onclick: () => { close(); go(scrRoster); } }, 'SEE LINES'), h('button', { class: 'primary', onclick: close }, 'OK')))) }, 'WHY ▸'));
}
function scrPregame(gid, simmed, exh) {
  const save = UI.save, user = save.userTeamId;
  const g = gid ? save.season.games[gid] : null;
  const opp = g ? (g.home === user ? g.away : g.home) : exh.opp;
  const userHome = g ? g.home === user : exh.userHome;
  let goalie = T(user).roster.goalies[0];
  const gbox = h('div', { class: 'grid g3' });
  const fillG = () => {
    gbox.innerHTML = '';
    for (const id of T(user).roster.goalies.filter(Boolean)) {
      const p = Pl(id), l = (save.season.stats[id] || emptyCats()).reg;
      gbox.appendChild(h('div', { class: 'pcard' + (id === goalie ? ' sel' : ''), onclick: () => { goalie = id; fillG(); } },
        h('span', { class: 'num' }, '#' + p.num), ' ', pname(p), h('div', { class: 'muted' }, `OVR ${ovrInt(p)} · REF ${r100(p.attrs.ref)} POS ${r100(p.attrs.pos)}`),
        h('div', { class: 'muted' }, `${l.gp} GP · ${l.w} W · ${fmtSv(svPct(l))} SV%`), condTag(p)));
    }
  };
  fillG();
  let series = null;
  if (g && g.comp) { const c = save.season.comps[g.comp], sr = findSeries(c, g.seriesId); if (sr.bestOf > 1) series = `Series: ${T(sr.hi).abbr} ${sr.winsHi} - ${sr.winsLo} ${T(sr.lo).abbr} (best of ${sr.bestOf})`; }
  const play = () => {
    const lus = [lineupFor(save, user, goalie), lineupFor(save, opp, aiGoalie(save, opp))];
    const tIds = [teamIdentity(T(user)), teamIdentity(T(opp))];
    const tourney = stg && stg.key !== 'reg' ? { key: stg.key, tier: stg.tier, round: stg.round.toUpperCase() } : null;
    const yr = g && g.comp ? save.season.year + COMP_INFO[g.comp].yearOff : save.season.year;
    // season/career goal totals so the goal card can show "29th this season" from recorded numbers
    const base = {};
    for (const lu of lus) for (const pl of lu.lines.flat().concat([lu.goalie])) if (pl) { const ss = save.season.stats[pl.id]; base[pl.id] = { sg: ss ? ss.reg.g + ss.po.g + ss.tour.g : 0, cg: lifetime(pl.career).g }; }
    const notable = stg && stg.key !== 'reg' || spots.some(x => x.prio >= 75);
    const spotlight = notable ? spots.map(sp => ({ pl: sp.p, title: sp.title, stat: sp.stat, num: sp.p.num, name: pname(sp.p).toUpperCase(), team: sp.p.teamId === user ? 0 : 1, cap: leaderOf(T(sp.p.teamId), sp.p.id), fav: sp.p.fav })) : null;
    const tac = [validTac(T(user).tac), teamTacFor(save, T(opp))];
    const homeT = T(userHome ? user : opp);
    // tournaments are played in their own arena (playoff and regular-season games in the home team's building)
    const tArena = stg && TOUR_KEYS.includes(stg.key) && typeof tourneyArenaCfg === 'function' ? tourneyArenaCfg(stg.key) : null;
    const arena = tArena || (typeof teamArena === 'function' ? teamArena(homeT) : null);
    const banners = save.trophies.filter(t => t.teamId === homeT.id && t.type === 'league').map(t => ({ year: seasonLabel(t.year || 0).slice(-2) }));
    const retired = Object.values(save.players).filter(p => p.status === 'retired' && p.lastTeamId === homeT.id && (p.awards || []).length + (p.allStar || []).filter(x => x.team === 1).length >= 2).map(p => p.num).slice(0, 8);
    // the crowd: how full the building is follows the home team's popularity and record (big games draw more)
    const fill = typeof attendance === 'function' && typeof FIN !== 'undefined' ? attendance(save, homeT, stg && stg.key === 'po' ? 1.6 : tourney ? 1.25 : 1) / FIN.capacity : 1;
    // uniforms: yours as picked on this screen (home at home, away on the road by default); the computer club wears
    // its alternate now and then at home (about one game in six)
    const aiKit = (!userHome && g && (hashStr(g.id) % 6 === 0) && kitKeys(T(opp)).length > 2) ? 'alt0' : null;
    const thrHide = [false, S.diff === 'HARD' && !Object.values(save.season.games).some(x => x.played && ((x.home === user && x.away === opp) || (x.home === opp && x.away === user)))];   // Hard: their colours show once you have met them this season
    launchMatch({ thrHide, fill, teams: tIds, home: userHome ? 0 : 1, kits: [UI.kitPick && UI.kitPick.gid === gid ? UI.kitPick.key : null, aiKit], lineups: lus, tourney, base, spotlight, season: !!g, bigGame: !!(g && (g.comp || (typeof isRivalGame === 'function' && isRivalGame(save, g)))), tac, arena, banners, retired, arenaName: tArena ? TOURNEY_ARENA[stg.key].name : typeof arenaTitle === 'function' ? arenaTitle(homeT, arena) : null,
      intro: stg && stg.final ? { key: stg.key, tier: 2, full: introFull(), round: 'CHAMPIONSHIP FINAL', year: String(yr), teams: userHome ? [tIds[1], tIds[0]] : tIds } : null,
      onIntroShown: key => { save.introsSeen = save.introsSeen || {}; save.introsSeen[key] = (save.introsSeen[key] || 0) + 1; UI.introFull = null; Store.autosave(save); },
      clinch: g && clinchesIfWin(save, g, user) ? { key: stg.key, year: String(yr), round: stg.round, name: COMP_INFO[stg.key].name } : null,
      decider: !g || g.type === 'reg' ? (g ? 'draw' : 'shootout') : 'sudden',   // SOCCER: league games can be drawn; exhibitions go to extra time and penalties kind: g ? g.type : 'exh', canRestart: false,
      onEnd: res => { leaveMatch(); g ? finishUserGame(g.id, res, userHome, opp, simmed) : finishExhibition(res, userHome, opp); },
      onQuit: () => { toast(g ? "Game abandoned: it hasn't been counted. Play it again any time." : 'Exhibition abandoned.'); go(g ? scrHub : scrQuickPlay); } });
  };
  const simIt = () => {
    const res = simGame(save, g, userHome ? { homeGoalie: goalie } : { awayGoalie: goalie });
    applyResult(save, g.id, res);
    const others = simRestOfDay(g.id); Store.autosave(save);
    go(() => scrPostgame({ title: g.label, mode: 'season', g, lines: res.stats, others: simmed.concat(others), simulated: true }));
  };
  const H0 = userHome ? T(user) : T(opp), A0 = userHome ? T(opp) : T(user);
  const stg = g ? gameStage(save, g) : null, th = stg ? tourneyTheme(stg.key) : null;
  const spots = spotlightsFor(save, [user, opp], stg && stg.tier >= 2 ? 3 : 2);
  const introBtn = stg && stg.final ? h('button', { class: 'small', onclick: () => { UI.introFull = !introFull(); introBtn.textContent = 'CHAMPIONSHIP INTRO: ' + (introFull() ? 'FULL' : 'SHORT'); } }) : null;
  if (introBtn) introBtn.textContent = 'CHAMPIONSHIP INTRO: ' + (introFull() ? 'FULL' : 'SHORT');
  function introFull() { return UI.introFull != null ? UI.introFull : !(save.introsSeen || {})[stg.key]; }
  // lineup check: anyone in your lines who is hurt or worn out, with a way to fix it
  const ut = T(user), inLines = ut.roster.lines.flat().filter(Boolean).map(Pl).filter(Boolean);
  const hurt = inLines.filter(p => p.inj && p.inj.g > 0), tired = inLines.filter(p => !(p.inj && p.inj.g > 0) && (p.cond ?? 100) < 60);
  const check = h('div', { class: 'panel pgcheck' }, h('h3', { style: { marginTop: 0 } }, 'LINEUP CHECK'),
    !hurt.length && !tired.length ? h('div', { class: 'sub green', style: { margin: 0 } }, 'Everyone in your lines is fit to play.') : null,
    hurt.length ? h('div', { class: 'sub red', style: { margin: '2px 0' } }, 'Injured (a reserve takes his place): ' + hurt.map(p => `${p.last} (${p.inj.g}g)`).join(', ')) : null,
    tired.length ? h('div', { class: 'sub gold', style: { margin: '2px 0' } }, 'Tired (slower): ' + tired.map(p => `${p.last} ${Math.round(p.cond)}`).join(', ')) : null,
    autoLinesNote(save, gid),
    h('div', { class: 'row', style: { justifyContent: 'flex-start', margin: '6px 0 0', gap: '6px' } }, g ? h('button', { class: 'small', onclick: () => go(scrRoster) }, 'EDIT LINES') : null,
      g ? autoLinesToggle(save, () => go(() => scrPregame(gid, simmed, exh)), true) : null,
      h('button', { class: 'small', title: 'Scouting report on ' + fullName(T(opp)), onclick: () => scoutReport(save, T(opp)) }, 'SCOUT ' + T(opp).abbr)),
    h('div', { class: 'sub', style: { margin: '6px 0 0' } }, S.diff === 'HARD' ? 'Opponent tactics are hidden on Hard.' : 'Their tactics: ' + tacSummary(teamTacFor(save, T(opp)))));
  const tacBox = h('div'); const drawTac = () => { tacBox.innerHTML = ''; tacBox.appendChild(tacticsPanel(validTac(T(user).tac), tc => { T(user).tac = tc; if (g && save.autoLines) { const o = autoArrange(save, T(user)); UI.autoLines = { gid, notes: o.notes }; toast('Lines re-arranged for the new tactics.'); } Store.autosave(save); drawTac(); }, { compact: true, showOnEasy: true, showDesc: false, diagrams: false })); }; drawTac();
  return h('div', { class: 'screen pregameS' }, header(g ? g.label.toUpperCase() : 'EXHIBITION', () => go(g ? scrHub : scrExhibition), 'BACK',
      introBtn, g ? (() => { const keys = kitKeys(T(user)), cur = UI.kitPick && UI.kitPick.gid === gid ? UI.kitPick.key : (userHome ? 'home' : 'away');
        return h('select', { class: 'kitsel hdrkit', title: 'Which uniform your team wears tonight (design them in TEAM LOOK > UNIFORMS)', onchange: e => { UI.kitPick = { gid, key: e.target.value }; } },
          keys.map(k => h('option', { value: k, selected: k === cur }, '👕 ' + kitByKey(T(user), k).name.toUpperCase()))); })() : null, g ? h('button', { onclick: simIt }, 'SIMULATE') : null, h('button', { class: 'primary', onclick: play }, 'PLAY ▶')),
    stg && stg.key !== 'reg' ? h('div', { style: { marginBottom: '6px' } }, tourneyBannerCanvas({ key: stg.key, tier: stg.tier, title: th.short, round: stg.round.toUpperCase(), sub: 'SEASON ' + seasonLabel(save.season.year), teams: [A0, H0] }, 760, stg.tier >= 2 ? 130 : 92)) : null,
    h('div', { class: 'panel pgmatch', style: { textAlign: 'center' } },
      h('div', { class: 'row', style: { gap: '30px', margin: 0 } }, h('div', { class: 'row', style: { gap: '8px', margin: 0 } }, badge(A0, 40), h('div', { style: { textAlign: 'left' } }, h('div', { style: { color: teamTextColor(A0) } }, fullName(A0)), h('div', { class: 'muted' }, 'AWAY · TEAM OVR ' + Math.round(teamStrength(save, A0.id) * 10)))),
        h('div', { class: 'big gold' }, '@'),
        h('div', { class: 'row', style: { gap: '8px', margin: 0 } }, badge(H0, 40), h('div', { style: { textAlign: 'left' } }, h('div', { style: { color: teamTextColor(H0) } }, fullName(H0)), h('div', { class: 'muted' }, 'HOME · TEAM OVR ' + Math.round(teamStrength(save, H0.id) * 10))))),
      h('div', { class: 'sub', style: { margin: '4px 0 0' } }, (series ? series + ' · ' : '') + (g ? (g.type === 'reg' ? 'Ties go to extra time, then a shootout.' : 'Ties go to sudden-death extra time.') : 'Exhibition: stats count only as exhibition.'))),
    tabbed('pregame', [
      { label: 'MATCHUP', el: () => h('div', null, h('div', { class: 'grid two', style: { alignItems: 'start' } }, check, spots.length ? h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'SPOTLIGHT'), spots.map(spotlightCard)) : null),
        h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'STARTING KEEPER ', h('span', { class: 'muted', style: { fontSize: 'calc(7px * var(--ts, 1.2))' } }, '(click to choose)')), gbox)) },
      { label: 'TACTICS', el: () => tacBox },
      simmed.length ? { label: 'AROUND THE LEAGUE', el: () => h('div', { class: 'panel' }, simmed.map(id => resultLine(save.season.games[id]))) } : null]));
}
function engineLines(res, userId, oppId) {
  return res.stats.map(l => { const o = Object.assign({}, l); o.teamId = l.team === 0 ? userId : oppId; return o; });
}
function finishUserGame(gid, res, userHome, opp, simmed) {
  const save = UI.save, user = save.userTeamId, g = save.season.games[gid];
  const lines = engineLines(res, user, opp);
  const goals = (res.goals || []).map(x => ({ teamId: x.team === 0 ? user : opp, pid: x.pid, a: x.a || [], per: x.period, clk: x.clock, ps: x.pen || undefined }));
  const stg = gameStage(save, g);
  const tstats = res.tstats ? { [user]: res.tstats[0], [opp]: res.tstats[1] } : null;
  applyResult(save, gid, { hs: userHome ? res.score[0] : res.score[1], as: userHome ? res.score[1] : res.score[0], ot: res.ot, so: res.so, stats: lines, goals, gameSec: res.gameSec, tstats, injuries: res.injuries || [] });
  const clipIds = archiveGameClips(save, g, res, { opp, userHome });
  const others = simRestOfDay(gid);
  let trophyId = null;
  if (stg.final) {                                 // did this game decide a championship? crown its defining moment
    currentDay(save);                              // lets a finished competition hand out its trophy
    const tr = save.trophies.find(t => t.editionId === stg.editionId && (t.finalGids || []).includes(gid));
    if (tr) { crownChampionshipClip(save, tr, clipIds); trophyId = tr.id; }
  }
  Store.autosave(save);
  const o = { title: g.label, mode: 'season', g, res, lines, others: (simmed || []).concat(others), clipIds, trophyId };
  go(() => scrPostgame(o));
}
function finishExhibition(res, userHome, opp) {
  const save = UI.save, user = save.userTeamId;
  const lines = engineLines(res, user, opp);
  applyExhibition(save, { stats: lines }, res.score[0] > res.score[1]);
  const clipIds = archiveGameClips(save, null, res, { opp, userHome });
  Store.autosave(save);
  const g = { home: userHome ? user : opp, away: userHome ? opp : user, hs: userHome ? res.score[0] : res.score[1], as: userHome ? res.score[1] : res.score[0], ot: res.ot, so: res.so, label: 'Exhibition' };
  const o = { title: 'EXHIBITION', mode: 'exh', g, res, lines, others: [], clipIds };
  go(() => scrPostgame(o));
}
function scrPostgame(o) {
  UI.tabMem = UI.tabMem || {}; UI.tabMem.postgame = 0;            // always open on the stars
  // o: { title, mode:'season'|'exh'|'quick', g?, res?, lines?, teams? (quick), others? }
  let teams, score, ot, so, lines;
  if (o.mode === 'quick') {
    teams = o.teams; score = o.res.score; ot = o.res.ot; so = o.res.so;
    lines = o.res.stats.map(l => Object.assign({}, l, { teamId: teams[l.team].id }));
  } else {
    const g = o.g; teams = [T(g.away), T(g.home)]; score = [g.as, g.hs]; ot = g.ot; so = g.so; lines = o.lines;
  }
  const info = id => {                      // name/number for a stats line
    if (o.mode === 'quick') { const l = lines.find(x => x.pid === id); return { name: l.name, num: l.num, pos: l.pos }; }
    const p = Pl(id); return { name: pname(p), num: p.num, pos: p.pos };
  };
  const tl = lines.map(l => Object.assign({ pos: info(l.pid).pos }, l));
  const gameSec = o.res && o.res.gameSec || 300;
  // Three Stars: recorded for franchise games when the result was applied; computed the same way otherwise
  const stars = o.mode === 'season' && o.g.stars ? o.g.stars : threeStars(tl, gameSec).map((l, i) => ({ pid: l.pid, num: info(l.pid).num, name: info(l.pid).name, pos: l.pos, teamId: l.teamId, stat: starStat(l, l.pos), why: l._why, rank: i + 1 }));
  const teamTotals = t => {
    const ls = tl.filter(l => l.teamId === t.id), sum = k => ls.reduce((a, l) => a + (l[k] || 0), 0);
    const engT = o.res && o.res.team ? o.res.team[(o.mode === 'quick' ? teams.indexOf(t) : (t.id === UI.save.userTeamId ? 0 : 1))] : null;
    return { g: sum('g'), sog: sum('sog'), hit: sum('hit'), pas: sum('pas'), fo: engT ? engT.fo : null, xg: (sum('xg') / 100).toFixed(2), hd: sum('hd'), ds: sum('ds') };
  };
  const tt = teams.map(teamTotals);
  const statRow = (k, lab) => h('tr', null, h('td', null, tt[0][k] == null ? '-' : tt[0][k]), h('td', { class: 'l', style: { textAlign: 'center' } }, lab), h('td', { class: 'l' }, tt[1][k] == null ? '-' : tt[1][k]));
  const playerTable = t => {
    const sk = tl.filter(l => l.teamId === t.id && l.pos !== 'G').sort((a, b) => (b.g + b.a) - (a.g + a.a) || b.g - a.g || b.toi - a.toi);
    const gs = tl.filter(l => l.teamId === t.id && l.pos === 'G');
    return h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, teamLabel(t, 20)),
      h('div', { class: 'scroll', style: { maxHeight: 'none' } }, h('table', null,
        h('tr', null, ...['#', 'PLAYER', 'G', 'A', 'PTS', 'SOG', 'XG', 'TKL', 'DS', 'CRD', 'TOI'].map((x, i) => h('th', { class: i < 2 ? 'l' : '' }, x))),
        sk.map(l => { const i = info(l.pid); return h('tr', null, h('td', { class: 'l' }, i.num), h('td', { class: 'l' }, i.name, l.hat ? h('span', { class: 'gold' }, ' \uE00B') : null), h('td', null, l.g), h('td', null, l.a), h('td', null, l.g + l.a), h('td', null, l.sog), h('td', null, ((l.xg || 0) / 100).toFixed(2)), h('td', null, l.hit), h('td', null, l.ds || 0), h('td', null, Math.round((l.pim || 0) / (BAL.pen.len || 30)) || ''), h('td', null, fmtToi(l.toi))); }),
        h('tr', null, ...['#', 'KEEPER', 'SA', 'SV', 'GA', 'SV%', 'HDSV', 'GSAX', 'DEC', '', 'TOI'].map((x, i) => h('th', { class: i < 2 ? 'l' : '' }, x))),
        gs.map(l => { const i = info(l.pid); return h('tr', null, h('td', { class: 'l' }, i.num), h('td', { class: 'l' }, i.name), h('td', null, l.sa), h('td', null, l.sv), h('td', null, l.ga), h('td', null, fmtSv(svPct(l))), h('td', null, l.hds || 0), h('td', null, (((l.xga || 0) / 100 - l.ga) >= 0 ? '+' : '') + ((l.xga || 0) / 100 - l.ga).toFixed(1)), h('td', null, l.w ? 'W' : l.toi ? 'L' : '-'), h('td'), h('td', null, fmtToi(l.toi))); }))));
  };
  const winnerIdx = score[0] > score[1] ? 0 : 1;
  const done = () => o.done ? o.done() : o.mode === 'quick' ? go(scrQuickPlay) : o.mode === 'exh' ? go(scrExhibition) : go(scrHub);
  const btns = h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' } }, o.again ? h('button', { class: 'primary', onclick: o.again }, 'PLAY AGAIN') : null,
      h('button', { class: o.again ? '' : 'primary', onclick: done }, o.mode === 'season' ? 'CONTINUE TO HUB ▶' : o.doneLabel || 'CONTINUE ▶'),
      o.mode === 'quick' ? h('button', { onclick: () => go(scrMain) }, 'MAIN MENU') : null);
  return h('div', { class: 'screen compact postgame' }, header('FINAL' + (so ? ' (SO)' : ot ? ' (ET)' : '') + ' · ' + (o.title || '').toUpperCase(), null, null),
    // one compact strip: the score, and the buttons always in view (no scrolling to find CONTINUE)
    h('div', { class: 'panel', style: { display: 'flex', alignItems: 'center', gap: '18px', padding: '8px 14px', flexWrap: 'wrap' } },
      h('div', { class: 'row', style: { gap: '18px', margin: 0 } },
        h('div', { style: { textAlign: 'center' } }, badge(teams[0], 40), h('div', { style: { fontSize: '8px', color: teamTextColor(teams[0]), marginTop: '3px' } }, teams[0].abbr)),
        h('div', { style: { fontSize: '22px' } }, h('span', { class: winnerIdx === 0 ? 'gold' : '' }, score[0]), ' - ', h('span', { class: winnerIdx === 1 ? 'gold' : '' }, score[1])),
        h('div', { style: { textAlign: 'center' } }, badge(teams[1], 40), h('div', { style: { fontSize: '8px', color: teamTextColor(teams[1]), marginTop: '3px' } }, teams[1].abbr))),
      h('div', { style: { flex: 1, minWidth: '10px' } }, o.simulated ? h('div', { class: 'sub', style: { margin: 0 } }, 'This game was simulated.') : null,
        o.mode !== 'quick' ? h('div', { class: 'muted', style: { fontSize: '7px' } }, 'AWAY @ HOME') : null,
        (() => { const t = o.mode === 'quick' ? (typeof hkTeaser === 'function' && !o.spectate ? hkTeaser(o.res, o) : null) : (typeof movedTeaser === 'function' && UI.lastMove && o.g && UI.lastMove.gid === o.g.id ? movedTeaser(UI.lastMove) : null);
          return t ? h('div', { class: 'gold hkteaser', style: { fontSize: '7px', marginTop: '3px' } }, t) : null; })()),
      btns),
    tabbed('postgame', [
      o.mode === 'quick' && typeof hkProgressPanel === 'function' && !o.spectate ? { label: 'PROGRESS', el: () => hkProgressPanel(o.res, o) } : null,
      o.mode === 'season' && typeof movedPanel === 'function' && UI.lastMove && UI.lastMove.gid === o.g.id ? { label: 'THIS GAME', el: () => movedPanel(UI.lastMove) } : null,
      { label: 'STARS', el: () => h('div', null, postgameChampion(o), threeStarsPanel(stars, teams, o), o.res && o.res.you && o.mode !== 'quick' && typeof youGameCard === 'function' ? youGameCard(o.res.you) : null) },
      (() => { const m = postgameMilestones(o); return m ? { label: 'MILESTONES', el: () => postgameMilestones(o) } : null; })(),
      { label: 'HIGHLIGHTS', el: () => h('div', null, postgameHighlights(o) || emptyState('clips', 'No highlights recorded.'), typeof postgameEvents === 'function' ? postgameEvents(o) : null) },
      { label: 'TEAM STATS', el: () => h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'TEAM STATS'),
        h('table', { style: { maxWidth: '420px', margin: '0 auto' } }, h('tr', null, h('th', null, teams[0].abbr), h('th', { style: { textAlign: 'center' } }, ''), h('th', { class: 'l' }, teams[1].abbr)),
          statRow('g', 'GOALS'), statRow('sog', 'SHOTS ON GOAL'), statRow('xg', 'EXPECTED GOALS'), statRow('hd', 'HIGH-DANGER SHOTS'), statRow('ds', 'DEFENSIVE STOPS'), statRow('hit', 'TACKLES'), statRow('pas', 'COMPLETED PASSES')),
        h('div', { class: 'hint', style: { textAlign: 'center' } }, 'Expected goals come from the game\'s shot-danger model (an estimate, not a measurement).')) },
      { label: teams[0].abbr + ' PLAYERS', el: () => playerTable(teams[0]) },
      { label: teams[1].abbr + ' PLAYERS', el: () => playerTable(teams[1]) },
      o.others && o.others.length ? { label: 'AROUND THE LEAGUE', el: () => h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'AROUND THE LEAGUE'), o.others.map(id => resultLine(UI.save.season.games[id]))) } : null,
    ].filter(Boolean)));
}

// ====================================================================
//  STANDINGS, SCHEDULE, BRACKETS
// ====================================================================
// a player object for a stat line (franchise players, or Quick Play's default rosters)
function plFor(pid, teamId) {
  if (UI.save && UI.save.players[pid]) return UI.save.players[pid];
  const m = String(pid).match(/^q-(\w+)-/); if (!m) return null;
  const lu = defaultLineup(m[1]); return lu.lines.flat().concat([lu.goalie]).find(p => p && p.id === pid) || null;
}
// what earns a star, in plain words
function starsHelp() {
  const row = (lab, txt) => h('div', { style: { fontSize: '8px', margin: '5px 0', lineHeight: 1.8 } }, h('b', { class: 'gold' }, lab), ' — ', txt);
  modal(close => h('div', null, h('h2', null, 'HOW THE THREE STARS ARE PICKED'),
    h('div', { class: 'sub' }, 'Everyone who played is given a score for what they actually did in this game. The three highest are the stars, best first. Nothing is random.'),
    h('h3', null, 'WHAT COUNTS'),
    row('Goals', 'The biggest thing a player can do. An extra time winner counts for far more than any other goal, and a game-winning goal in regulation counts extra.'),
    row('Assists', 'Half the value of a goal.'),
    row('Chances created', 'Shots and scoring chances count a little even when they do not go in, so a player who carried the play is not ignored.'),
    row('Defensive work', 'Takeaways, blocked shots, interceptions and stopped breakaways. Stops in front of your own net and breakaway stops count for much more than routine ones, and each one after the first counts for clearly less, so a long night of routine defending cannot outweigh a goal.'),
    row('Big moments', 'Anything done late in a tied or one-goal game counts for more than the same thing in a blowout.'),
    row('Keepers', 'Goals saved above what an average keeper would have stopped, high-danger saves, total saves and clean sheets. A keeper who faced a handful of easy shots will not be a star.'),
    row('Mistakes', 'Giveaways and penalties taken subtract.'),
    row('Playing time', 'Doing the same in less playing time rates slightly higher, and a player who barely played is not eligible at all.'),
    h('div', { class: 'hint' }, 'The line under each star names the most distinctive true thing that player did.'),
    h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'primary', onclick: close }, 'GOT IT'))), true);
}
function threeStarsPanel(stars, teams, o) {
  const mode = S.pres.stars;
  if (!stars.length) return null;
  const ord = ['FIRST', 'SECOND', 'THIRD'];
  if (mode === 'OFF') return h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'THREE STARS'),
    stars.map(st => h('div', { style: { fontSize: '8px', lineHeight: 2 } }, '★'.repeat(st.rank) + ' #' + st.num + ' ' + st.name + ' (' + (teams.find(x => x.id === st.teamId) || {}).abbr + ') · ' + st.stat + ' · ' + st.why)));
  const box = h('div', { class: 'stars3' + (mode === 'FULL' ? ' anim' : '') });
  // presented third to first, broadcast style
  stars.slice().reverse().forEach((st, k) => {
    const t = teams.find(x => x.id === st.teamId) || teams[0], pl = plFor(st.pid, st.teamId);
    const col = t.colors ? t.colors : { p: '#2a2e45', s: '#141832', a: '#ffd23f' };
    box.appendChild(h('div', { class: 'starcard r' + st.rank, style: { animationDelay: (k * 0.9) + 's', background: `linear-gradient(135deg, ${col.p}, ${col.s})`, borderColor: col.a } },
      h('div', { class: 'starrank' }, h('div', { class: 'starsyms s' + st.rank }, '★'.repeat(st.rank)), h('div', null, ord[st.rank - 1] + ' STAR')),   // 1st: one big star · 2nd: two medium · 3rd: three little
      pl ? portrait(pl, t, 56, { num: st.num }) : null,
      h('div', { class: 'startxt' }, h('div', { class: 'starname' }, '#' + st.num + ' ' + st.name.toUpperCase()),
        h('div', { class: 'muted2' }, (t.city ? fullName(t) : t.abbr) + ' · ' + (POS_WORDS[(pl && pl.spos) || st.spos || st.pos] || (st.pos === 'G' ? 'Keeper' : 'Forward')) + ' · ' + st.stat),
        h('div', { class: 'why' }, '"' + st.why + '"')),
      UI.save && UI.save.players[st.pid] ? h('button', { class: 'small', onclick: () => profile(st.pid) }, 'PROFILE') : null));
  });
  const panel = h('div', { class: 'panel' }, h('div', { class: 'bar' }, h('h3', { style: { margin: 0 } }, 'THREE STARS OF THE GAME'), h('div', { class: 'grow' }),
    h('button', { class: 'small', onclick: () => starsHelp() }, 'ⓘ HOW ARE STARS PICKED?'),
    mode === 'FULL' ? h('button', { class: 'small ghost', onclick: e => { box.classList.remove('anim'); e.target.remove(); } }, 'SKIP ▶▶') : null), box);
  if (mode === 'FULL' && !o._starsShown) {      // applause + a short cue as each star appears (once)
    o._starsShown = true;
    try { initAudio(); [0, 0.9, 1.8].forEach((d, i) => setTimeout(() => { sfx.cheer(0.8); tone(523 + i * 131, 0.18, 'square', 0.03); }, d * 1000 + 300)); } catch (e) {}
  }
  return panel;
}
function postgameMilestones(o) {
  if (o.mode !== 'season' || !o.g || !o.g.milestones || !o.g.milestones.length || !UI.save.milestones) return null;
  const ms = o.g.milestones.map(id => UI.save.milestones.find(m => m.id === id)).filter(Boolean);
  if (!ms.length) return null;
  return h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'MILESTONES TONIGHT'),
    ms.map(m => { const p = Pl(m.pid); return h('div', { class: 'hotrow', onclick: () => profile(m.pid) }, portrait(p, T(m.teamId), 28), h('div', null, h('span', { class: 'gold' }, m.text.toUpperCase()), h('div', { class: 'muted', style: { fontSize: '7px', marginTop: '4px' } }, '#' + m.num + ' ' + pname(p) + ' · ' + T(m.teamId).abbr))); }));
}
function postgameChampion(o) {
  if (!o.trophyId) return null;
  const save = UI.save, t = save.trophies.find(x => x.id === o.trophyId); if (!t) return null;
  const mine = t.teamId === save.userTeamId, m = trophyMoments(save, t)[0];
  return h('div', { class: 'panel', style: { textAlign: 'center' } },
    tourneyBannerCanvas({ key: t.comp, tier: 2, title: tourneyTheme(t.comp).short, round: mine ? 'CHAMPIONS!' : 'CHAMPIONS: ' + t.abbr, sub: 'SEASON ' + t.seasonLabel }, 760, 110),
    h('div', { class: 'row', style: { marginTop: '12px' } },
      m ? h('button', { class: 'primary', onclick: () => watchClip(m) }, '▶ WATCH CHAMPIONSHIP MOMENT') : null,
      h('button', { onclick: () => push(() => scrTrophyDetail('team', t.id)) }, mine ? 'SEE YOUR NEW TROPHY ▸' : 'OPEN THE TROPHY RECORD ▸')),
    m ? h('div', { class: 'sub', style: { marginTop: '6px' } }, 'Saved as a Legendary Moment: ' + (m.meta.text || '')) : null);
}
function postgameHighlights(o) {
  const save = UI.save;
  let clips;
  if (o.clipIds) clips = o.clipIds.map(id => save && save.clips[id]).filter(Boolean);
  else if (o.res && o.res.clips) clips = o.res.clips.map(c => Object.assign(c, { ctx: c.ctx || { type: 'quick', label: 'Quick Play', teamIds: [], score: o.res.score } }));
  if (!clips || !clips.length) return o.simulated ? null : emptyState('clips', 'No highlights recorded in this game.');
  clips = clips.slice().sort((a, b) => (b.legendary - a.legendary) || (a.meta.period - b.meta.period) || (b.meta.clock - a.meta.clock));
  const box = h('div');
  const render = () => {
    box.innerHTML = '';
    box.appendChild(h('div', { class: 'bar' }, h('h3', { style: { margin: 0 } }, 'GAME HIGHLIGHTS'), h('div', { class: 'grow' }),
      h('span', { class: 'muted', style: { fontSize: '7px' } }, o.clipIds ? 'Saved to your highlight archive. ★ KEEP stops a clip from ever being recycled.' : 'Quick Play highlights are not saved.')));
    const per = innerHeight < 700 ? 3 : 4;   // a page at a time: the screen never scrolls
    UI.pageMem = UI.pageMem || {}; if (!box.__pg) { UI.pageMem.pgHl = 0; box.__pg = true; }
    box.appendChild(pages('pgHl', clips, per, list => h('div', null, list.map(c => clipRow(c, o.clipIds && c.auto ? h('button', { class: 'small', onclick: () => { c.auto = false; Store.autosave(save); render(); toast('Kept in your archive.'); } }, '★ KEEP') : (o.clipIds && !c.auto ? h('span', { class: 'gold', style: { fontSize: '8px' } }, c.legendary ? 'LEGENDARY' : 'KEPT') : null))))));
  };
  render();
  return h('div', { class: 'panel' }, box);
}
function standingsTable(save, rows, opts = {}) {
  return h('table', { class: opts.tight === false ? '' : 'tight' }, h('tr', null, ...['', 'TEAM', 'GP', 'W', 'D', 'L', 'PTS', 'GF', 'GA', 'DIFF'].map((x, i) => h('th', { class: i < 2 ? 'l' : '' }, x))),
    rows.map((r, i) => {
      const t = r.colors ? r : T(r.teamId);
      return h('tr', { class: ((r.teamId || t.id) === save.userTeamId ? 'me' : '') + (opts.link ? ' click' : ''), style: i === 3 && opts.line ? { borderBottom: '2px dashed #ffd23f' } : null, onclick: opts.link ? () => push(() => scrTeam(r.teamId || t.id)) : null },
        h('td', { class: 'l' }, i + 1 + (opts.offset || 0)), h('td', { class: 'l' }, h('span', { style: { display: 'inline-flex', gap: '6px', alignItems: 'center' } }, badge(t, 16), h('span', { class: 'stnm', title: r.name || fullName(t) }, h('span', { class: 'stcity' }, (r.name || fullName(t)).slice(0, Math.max(0, (r.name || fullName(t)).length - (t.nick || '').length)).trim() + ' '), t.nick || ''))),
        h('td', null, r.gp), h('td', null, r.w), h('td', null, r.otl), h('td', null, r.l), h('td', { class: 'gold' }, r.pts), h('td', null, r.gf), h('td', null, r.ga), h('td', null, (r.gf - r.ga > 0 ? '+' : '') + (r.gf - r.ga)));
    }));
}
function scrStandingsOld() {
  const save = UI.save, se = save.season;
  const rows = sortedStandings(save).map(id => Object.assign({ teamId: id }, se.standings[id]));
  return h('div', { class: 'screen' }, header('STANDINGS ' + seasonLabel(se.year), () => go(scrHub)),
    h('div', { class: 'panel' }, standingsTable(save, rows, { line: true, link: true }), h('div', { class: 'hint' }, 'Win = 3 pts, draw = 1 pt. The top four (above the dashed line) make the playoffs.')));
}
function scrSchedule() {
  const save = UI.save, se = save.season, uid = save.userTeamId;
  let mine = !!UI.schedMine;
  const box = h('div');
  const score = g => g.played ? `${g.as}-${g.hs}${g.so ? ' SO' : g.ot ? ' ET' : ''}` : '';
  const userRes = g => { const home = g.home === uid, us = home ? g.hs : g.as, them = home ? g.as : g.hs; return us > them ? 'W' : us === them ? 'D' : 'L'; };
  const render = () => {
    UI.schedMine = mine; box.innerHTML = '';
    // your season at a glance, in calendar order: a tile per game (coloured by the result) and, in their real place
    // between the game days, a tile for each event in its own colours, followed by your games in it
    const EV_SHORT = { inv: 'INVITE', classic: 'CLASSIC', winter: 'WINTER CUP', finale: 'FINALE', po: 'PLAYOFFS', toc: 'CHAMPS' };
    const tiles = []; let regN = 0;
    const gameTile = (g, label, ev) => {
      const opp = T(g.home === uid ? g.away : g.home), r = g.played ? userRes(g) : null;
      return h('div', { class: 'schedtile ' + (r === 'W' ? 'w' : r ? 'l' : 'up') + (ev ? ' evg' : '') + (g.played ? ' click' : ''), onclick: g.played ? () => gameReport(save, g) : null, style: ev ? { borderTopColor: tourneyTheme(ev).accent === '#ffffff' ? tourneyTheme(ev).main : tourneyTheme(ev).accent } : null,
          title: (g.label ? g.label + ' · ' : '') + (g.home === uid ? 'vs ' : '@ ') + fullName(opp) + (g.played ? ' · ' + score(g) : ' · upcoming') },
        h('div', { class: 'muted' }, (g.home === uid ? 'vs' : '@') + ' ' + label), badge(opp, 22), h('div', null, opp.abbr), h('div', { class: 'res' }, r ? r + ' ' + (g.home === uid ? g.hs + '-' + g.as : g.as + '-' + g.hs) : '—'));
    };
    for (const step of CALENDAR) {
      if (/^r\d+$/.test(step)) {
        const ids = se.rounds[+step.slice(1)] || [];
        const gid = ids.find(id => se.games[id] && isUserGame(save, se.games[id]));
        if (gid) tiles.push(gameTile(se.games[gid], String(++regN)));
        continue;
      }
      if (!COMP_INFO[step]) continue;
      const th = tourneyTheme(step), c = se.comps[step], info = COMP_INFO[step];
      const myIds = c ? compSeriesAll(c).flatMap(sr => sr.gids || []).filter(id => se.games[id] && isUserGame(save, se.games[id])) : [];
      const inField = c && c.seeds.includes(uid);
      let status;
      if (c && c.done) status = c.champion === uid ? 'CHAMPIONS ★' : inField ? 'OUT' : declinedComp(save, step) ? 'DECLINED' : 'NOT IN';
      else if (c) status = inField ? 'IN THE FIELD' : declinedComp(save, step) ? 'DECLINED' : 'NOT IN';
      else status = step === 'toc' ? 'TITLE WINNERS' : step === 'po' ? 'TOP ' + info.size : 'TOP ' + info.size + ' INVITED';
      tiles.push(h('div', { class: 'schedtile evt' + (c && !inField ? ' dim' : ''), style: { background: `linear-gradient(180deg, ${th.main}, ${th.dark})`, borderColor: th.accent, color: th.text || '#fff' },
          title: info.name + ' · ' + info.month + ' · ' + status, onclick: () => { if (c) { UI.brKey = step; UI.brKeySeason = se.num; go(scrBrackets); } } },
        h('div', { style: { opacity: 0.8 } }, info.month), h('div', { class: 'evname' }, EV_SHORT[step] || info.name), h('div', { class: 'evst' }, status)));
      myIds.forEach((id, i) => tiles.push(gameTile(se.games[id], 'G' + (i + 1), step)));
    }
    const seasonEl = (h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'YOUR SEASON'),
      h('div', { class: 'schedstrip' }, tiles),
      h('div', { class: 'hint' }, 'Coloured tiles are the season\'s events, in their place on the calendar; your games in an event follow its tile.')));
    const days = [];
    se.rounds.forEach((r, i) => days.push({ label: 'GAME DAY ' + (i + 1), gids: r }));
    for (const k of ['inv', 'classic', 'winter', 'finale', 'po', 'toc']) { const c = se.comps[k]; if (c) days.push({ label: c.name.toUpperCase(), gids: compSeriesAll(c).flatMap(s => s.gids), comp: true }); }
    const dayList = days.map(d => Object.assign({}, d, { gs: d.gids.map(id => se.games[id]).filter(g => g && (!mine || isUserGame(save, g))) })).filter(d => d.gs.length);
    const dayPanel = d => {
      const gs = d.gs, done = gs.every(g => g.played);
      return (h('div', { class: 'panel dayp' + (d.comp ? ' comp' : '') + (done ? ' done' : '') }, h('h3', { style: { marginTop: 0 } }, d.label, done ? h('span', { class: 'muted' }, '  ✓') : null),
        gs.map(g => h('div', { class: 'mrow2' + (isUserGame(save, g) ? ' me' : '') + (g.played ? ' click' : ''), onclick: g.played ? () => gameReport(save, g) : null },
          badge(T(g.away), 14), h('span', { style: { color: teamTextColor(T(g.away)) } }, T(g.away).abbr), h('span', { class: 'muted' }, '@'),
          badge(T(g.home), 14), h('span', { style: { color: teamTextColor(T(g.home)) } }, T(g.home).abbr),
          h('span', { class: 'sc' }, g.played ? score(g) : h('span', { class: 'muted' }, 'upcoming')),
          g.comp ? h('span', { class: 'muted', style: { fontSize: '.85em' } }, g.label.replace(se.comps[g.comp].name, '').trim()) : null))));
    };
    const future = CALENDAR.slice(se.calIdx).filter(k => COMP_INFO[k] && !se.comps[k]);
    // game days a page at a time (opening on the page with the next games to play)
    const per = mine ? 12 : 4, cur = Math.max(0, dayList.findIndex(d => !d.gs.every(g => g.played)));
    UI.pageMem = UI.pageMem || {}; const pk = 'sched' + (mine ? 'M' : 'A');
    if (UI.pageMem[pk] == null) UI.pageMem[pk] = Math.floor(cur / per);
    box.appendChild(tabbed('sched', [
      { label: 'YOUR SEASON', el: seasonEl },
      { label: 'GAME DAYS', el: () => pages(pk, dayList, per, list => h('div', { class: 'daygrid' }, list.map(dayPanel))) },
      { label: 'UPCOMING EVENTS', el: () => future.length ? h('div', { class: 'panel' }, pages('schedev', future, 1, list => h('div', null, list.map(k => eventPreview(save, k))))) : h('div', { class: 'panel sub' }, 'No more events this season.') },
    ]));
  };
  render();
  return h('div', { class: 'screen wide' }, header('SCHEDULE ' + seasonLabel(se.year), () => go(scrHub), 'BACK', h('button', { onclick: e => { mine = !mine; e.target.textContent = mine ? 'SHOW ALL GAMES' : 'MY GAMES ONLY'; render(); } }, mine ? 'SHOW ALL GAMES' : 'MY GAMES ONLY')), box);
}
function bracketView(save, c) {
  const nm = id => T(id);
  const roundName = (i, n) => (typeof roundNameOf === 'function' ? roundNameOf(c, i) : n === 1 ? 'Final' : 'Semifinals').toUpperCase();
  const gameStr = id => { const g = save.season.games[id]; return g.played ? `${nm(g.away).abbr} ${g.as}-${g.hs} ${nm(g.home).abbr}${g.so ? ' SO' : g.ot ? ' ET' : ''}` : 'next: ' + nm(g.away).abbr + ' @ ' + nm(g.home).abbr; };
  const seriesBox = sr => {
    const rows = [[sr.hi, sr.winsHi], [sr.lo, sr.winsLo]].map(([id, w]) =>
      h('div', { class: 't' + (sr.winner === id ? ' w' : '') },
        h('a', { class: 'lnk', style: { display: 'inline-flex', gap: '6px', alignItems: 'center' }, onclick: () => push(() => scrTeam(id)) }, badge(nm(id), 16), `(${c.seeds.indexOf(id) + 1}) ${nm(id).abbr}`),
        h('span', null, sr.bestOf > 1 || sr.winner ? w : '')));
    const games = sr.gids.map(gameStr).join(' | ') || (sr.bestOf > 1 ? 'best of ' + sr.bestOf : '');
    return h('div', { class: 'series' }, rows, h('div', { class: 'muted', style: { fontSize: '7px' } }, games));
  };
  const rounds = c.rounds.map((r, i) => h('div', { class: 'bround' }, h('div', { class: 'rt' }, roundName(i, r.length)), r.map(seriesBox)));
  if (c.done) rounds.push(h('div', { class: 'bround' }, h('div', { class: 'rt' }, 'CHAMPION'),
    h('div', { class: 'series', style: { textAlign: 'center', borderColor: '#ffd23f', cursor: c.trophyId ? 'pointer' : 'default' }, onclick: c.trophyId ? () => push(() => scrTrophyDetail('team', c.trophyId)) : null }, badge(nm(c.champion), 40), h('div', { class: 'gold' }, fullName(nm(c.champion))),
      c.mvp ? h('div', { class: 'muted', style: { fontSize: '7px' } }, 'MVP: #' + c.mvp.num + ' ' + c.mvp.name + ' (' + c.mvp.stat + ')') : null)));
  const groupsEl = c.groups ? h('div', { class: 'groupgrid' }, c.groups.map((_, gi) => {
    const tab = groupTable(save, c, gi), ko = c.stage !== 'groups';
    return h('div', { class: 'gtable' }, h('div', { class: 'rt' }, 'GROUP ' + GROUP_LETTERS[gi]),
      h('table', null, h('tr', null, h('th', { class: 'l' }, ''), h('th', null, 'GP'), h('th', null, 'W'), h('th', { 'data-help': 'Extra time / shootout losses (1 point)' }, 'ETL'), h('th', null, 'GD'), h('th', null, 'PTS')),
        tab.map((r, i) => { const q = ko && c.seeds.includes(r.id), me = r.id === save.userTeamId;
          return h('tr', { class: (q ? 'gq' : ko ? 'gout' : '') + (me ? ' gme' : '') }, h('td', { class: 'l' }, h('a', { class: 'lnk', style: { display: 'inline-flex', gap: '5px', alignItems: 'center' }, onclick: () => push(() => scrTeam(r.id)) }, badge(nm(r.id), 14), nm(r.id).abbr), q ? h('span', { class: 'gold', title: i === 0 ? 'Group winner' : 'Wildcard' }, i === 0 ? ' ✓' : ' WC') : null),
            h('td', null, r.gp), h('td', null, r.w), h('td', null, r.otl), h('td', null, (r.gf - r.ga > 0 ? '+' : '') + (r.gf - r.ga)), h('td', { class: 'gold' }, r.pts)); })));
  })) : null;
  if (c.groups && c.stage === 'groups') return h('div', null, h('div', { class: 'sub' }, `Group stage: game ${Math.min(3, c.gr + 1)} of 3. Top of each group plus the two best runners-up reach the knockout.`), groupsEl);
  if (c.groups) {         // groups or knockout, one at a time (no scrolling)
    const wrap = h('div'), view = () => UI.invView === 'groups' ? 'groups' : 'ko';
    const draw = () => { wrap.innerHTML = '';
      wrap.appendChild(h('div', { class: 'row', style: { justifyContent: 'flex-start', gap: '4px', marginBottom: '8px' } },
        [['ko', 'KNOCKOUT'], ['groups', 'GROUP STAGE']].map(([k, l]) => h('button', { class: 'small' + (view() === k ? ' sel' : ''), onclick: () => { UI.invView = k; draw(); } }, l))));
      wrap.appendChild(view() === 'groups' ? groupsEl : bracketMirror(save, c, true)); };
    draw(); return wrap;
  }
  return bracketMirror(save, c);
}
// ---------- the bracket as a poster: two halves meet in the middle under the trophy, the final between them.
// Team bars carry the club colour, seed and series wins (a single game shows the goals); lines join each series to the next.
function bracketMirror(save, c, short) {
  const th = tourneyTheme(c.key), n0 = c.rounds[0].length, R = Math.round(Math.log2(n0)) + 1;
  const sr = (r, k) => (c.rounds[r] || [])[k] || null;
  const rName = r => (typeof roundNameOf === 'function' ? roundNameOf(c, r) : r === R - 1 ? 'Final' : 'Semifinals').toUpperCase();
  const gStr = id => { const g = save.season.games[id]; return g.played ? `${T(g.away).abbr} ${g.as}-${g.hs} ${T(g.home).abbr}${g.so ? ' SO' : g.ot ? ' ET' : ''}` : `next: ${T(g.away).abbr} @ ${T(g.home).abbr}`; };
  const goalsOf = (s, id) => { const g = s.gids[0] && save.season.games[s.gids[0]]; return g && g.played ? (g.home === id ? g.hs : g.as) : ''; };
  const slot = (s, id, side, big) => {
    const t = id ? T(id) : null, won = !!(s && s.winner && s.winner === id), lost = !!(s && s.winner && s.winner !== id);
    const val = !t || !s ? '' : s.bestOf === 1 ? goalsOf(s, id) : (id === s.hi ? s.winsHi : s.winsLo);
    return h('div', { class: 'bslot' + (t ? '' : ' tbd') + (side === 'R' ? ' rt' : '') + (won ? ' won' : '') + (lost ? ' lost' : '') + (id && id === save.userTeamId ? ' me' : '') + (big ? ' big' : ''),
        style: t ? { '--tc': t.colors.p } : null, onclick: t ? () => push(() => scrTeam(id)) : null },
      t ? badge(t, big ? 24 : 16) : h('span', { class: 'bnob' }),
      h('span', { class: 'bseed' }, t ? (c.seeds.indexOf(id) + 1) + '.' : ''),
      h('span', { class: 'babbr', style: t ? { color: teamTextColor(t) } : null }, t ? t.abbr : 'TBD'),
      h('span', { class: 'bwins' }, val === '' ? '' : String(val)));
  };
  const help = s => s && s.gids.length ? (s.bestOf > 1 ? `Best of ${s.bestOf}: ` : '') + s.gids.map(gStr).join(' · ') : s ? (s.bestOf > 1 ? 'Best of ' + s.bestOf : 'One game') : 'Waiting for the round before';
  const box = (r, k, side) => { const s = sr(r, k); return h('div', { class: 'bser', 'data-r': r, 'data-k': k, 'data-side': side, 'data-help': help(s) }, slot(s, s && s.hi, side), slot(s, s && s.lo, side)); };
  const col = (r, side) => { const cnt = n0 >> r, ks = []; for (let k = side === 'L' ? 0 : cnt / 2; k < (side === 'L' ? cnt / 2 : cnt); k++) ks.push(k);
    return h('div', { class: 'bcol' }, h('div', { class: 'bcolt', style: { color: th.accent } }, rName(r)), h('div', { class: 'bcolb' }, ks.map(k => box(r, k, side)))); };
  // the final: the left half's winner on the left
  const fin = sr(R - 1, 0), lw = sr(R - 2, 0) && sr(R - 2, 0).winner;
  const fl = fin ? (fin.hi === lw ? fin.hi : fin.lo === lw ? fin.lo : fin.hi) : null, fr = fin ? (fl === fin.hi ? fin.lo : fin.hi) : null;
  const emb = h('canvas', { width: 64, height: 64, class: 'px bemb' }); drawTourneyEmblem(emb.getContext('2d'), c.key, 32, 32, 64);
  const tro = drawTrophyCanvas(c.key === 'po' ? 'league' : c.key, 4, !!c.done); tro.classList.add('btro');
  const ctr = h('div', { class: 'bctr' },
    h('div', { class: 'bctrt', style: { color: th.accent } }, (c.name || '').toUpperCase()), emb,
    h('div', { class: 'btrow', style: { cursor: c.trophyId ? 'pointer' : 'default' }, onclick: c.trophyId ? () => push(() => scrTrophyDetail('team', c.trophyId)) : null }, tro),
    c.done ? h('div', { class: 'bchamp gold' }, '★ ' + fullName(T(c.champion)) + ' ★') : h('div', { class: 'bchamp muted' }, 'CHAMPION: ?'),
    c.done && c.mvp ? h('div', { class: 'bmvp muted' }, 'MVP #' + c.mvp.num + ' ' + c.mvp.name + ' (' + c.mvp.stat + ')') : null,
    h('div', { class: 'bcolt', style: { color: th.accent, marginTop: '6px' } }, rName(R - 1)),
    h('div', { class: 'bser bfin', 'data-r': R - 1, 'data-k': 0, 'data-side': 'C', 'data-help': help(fin) }, slot(fin, fl, 'L', true), slot(fin, fr, 'R', true)));
  const cols = [];
  for (let r = 0; r < R - 1; r++) cols.push(col(r, 'L'));
  cols.push(ctr);
  for (let r = R - 2; r >= 0; r--) cols.push(col(r, 'R'));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'bkl');
  const wrap = h('div', { class: 'bkt' + (short ? ' short' : ''), style: { background: `radial-gradient(ellipse at 50% 42%, ${th.main}55 0, transparent 58%), repeating-linear-gradient(118deg, rgba(255,255,255,.035) 0 3px, transparent 3px 26px), linear-gradient(180deg, ${th.dark}cc, #070916 92%)`, borderColor: th.accent } }, svg, cols);
  // connector lines, drawn once the boxes have their places (gold where the winner went through)
  const draw = () => {
    if (!wrap.isConnected) return;
    const W = wrap.getBoundingClientRect(); if (!W.width) return;
    const z = W.width / wrap.offsetWidth || 1, P = e => { const b = e.getBoundingClientRect(); return { l: (b.left - W.left) / z, r: (b.right - W.left) / z, y: (b.top + b.bottom) / 2 / z - W.top / z }; };
    svg.setAttribute('viewBox', `0 0 ${wrap.offsetWidth} ${wrap.offsetHeight}`); svg.innerHTML = '';
    for (const e of wrap.querySelectorAll('.bser')) {
      const r = +e.dataset.r, k = +e.dataset.k, side = e.dataset.side; if (r >= R - 1) continue;
      const tgt = wrap.querySelector(`.bser[data-r="${r + 1}"][data-k="${r + 1 === R - 1 ? 0 : k >> 1}"]`); if (!tgt) continue;
      const a = P(e), b = r + 1 === R - 1 ? P(side === 'L' ? tgt.firstChild : tgt.lastChild) : P(tgt);
      const x1 = side === 'L' ? a.r : a.l, x2 = side === 'L' ? b.l : b.r, mx = (x1 + x2) / 2;
      const s = sr(r, k), s2 = sr(r + 1, r + 1 === R - 1 ? 0 : k >> 1), on = s && s.winner && s2 && (s2.hi === s.winner || s2.lo === s.winner);
      const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      pl.setAttribute('points', `${x1},${a.y} ${mx},${a.y} ${mx},${b.y} ${x2},${b.y}`);
      pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', on ? '#ffd23f' : 'rgba(150,170,255,.45)'); pl.setAttribute('stroke-width', on ? 3 : 2);
      svg.appendChild(pl);
    }
  };
  // no scrolling: give back height if the screen overflows (big text sizes)
  const fit = () => { const app = document.getElementById('app'); if (!app || !wrap.isConnected) return;
    const cut = () => [...wrap.querySelectorAll('.babbr')].some(e => e.scrollWidth > e.clientWidth + 1);
    if (cut()) wrap.classList.add('tight'); if (cut()) wrap.classList.add('tight2');
    for (let g = 0; g < 30 && app.scrollHeight > app.clientHeight + 1 && wrap.offsetHeight > 200; g++) wrap.style.minHeight = (wrap.offsetHeight - 12) + 'px'; draw(); };
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(draw).observe(wrap);
  setTimeout(fit, 0);
  return wrap;
}
function scrBrackets() {
  const save = UI.save, se = save.season;
  const KEYS = ['inv', 'classic', 'winter', 'finale', 'po', 'toc'];
  let key = UI.brKey && UI.brKeySeason === se.num ? UI.brKey : (KEYS.find(k => se.comps[k] && !se.comps[k].done) || 'inv');
  const body = h('div');
  const tabs = h('div', { class: 'tabs' });
  const render = () => {
    tabs.innerHTML = '';
    UI.brKey = key; UI.brKeySeason = se.num;
    for (const k of KEYS) tabs.appendChild(h('button', { class: k === key ? 'sel' : '', title: COMP_INFO[k].name, onclick: () => { key = k; render(); } }, { inv: 'INVITATIONAL', classic: 'CLASSIC', winter: 'WINTER CUP', finale: 'FINALE CUP', po: 'PLAYOFFS', toc: 'CHAMPIONS' }[k]));
    body.innerHTML = '';
    const c = se.comps[key];
    const formats = { inv: `Opens the season. Every club plays: six groups of four (one team from each strength pot), three group games each (win 2 points, extra time loss 1). The six group winners and the two best runners-up go to an eight-team knockout. Making the knockout pays $${INV_BONUS.ko}K; the champion picks ${INV_BONUS.draftUp} places earlier in each round of the next Rookie Draft. Trophy: Invitational Cup.`,
      classic: 'Optional. Eight teams: the top eight in the standings when it begins (invitations go out only then; decline and the next team takes your place). Single elimination. Trophy: Classic Trophy.',
      winter: 'Optional. Four teams: the top four in the standings. Single-game semifinals, best-of-three final. Trophy: Winter Cup.',
      finale: 'Optional. Closes the regular season. Four teams: the top four in the standings. Single elimination. Trophy: Season Finale Cup.',
      toc: 'After the playoffs. Eight unique teams: this season\'s four cup winners and the league champion (one entry each), then the best remaining teams in the standings. Optional. Best-of-three final. Trophy: Champions\' Crown.',
      po: 'The top four teams in each division (16). Best-of-five series in a 2-2-1 pattern (higher seed hosts games 1, 2 and 5): division semifinals, division finals, conference finals, then the final.' };
    // the format on one line, the full rules on hover
    const short = { inv: 'Every club: six groups of four, then an eight-team knockout.', classic: 'Optional · the top eight · single elimination.', winter: 'Optional · the top four · best-of-three final.',
      finale: 'Optional · the top four · single elimination.', toc: 'Optional · eight teams after the playoffs · best-of-three final.', po: 'The top four in each division · best-of-five series.' };
    body.appendChild(h('div', { class: 'sub brfmt', 'data-help': formats[key] }, COMP_INFO[key].name + ': ' + short[key] + ' ', h('span', { class: 'gold' }, 'Full format ⓘ')));
    if (!c) { const ra = upcomingComps(save).find(u => u.key === key); body.appendChild(h('div', { class: 'panel sub' }, ra ? `Starts in ${ra.roundsAway} game day${ra.roundsAway === 1 ? '' : 's'}. Seeds are set when it begins.` : 'Not played this season.')); return; }
    body.appendChild(h('div', { class: 'panel brpanel', style: { marginTop: '4px' } }, h('div', { class: 'brhead gold' }, tourneyTheme(key).short + (c.done ? ' · CHAMPIONS: ' + fullName(T(c.champion)) : ' · ' + seasonLabel(se.year))), bracketView(save, c)));
    if (c.qual) body.appendChild(h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'QUALIFICATION'),
      c.seeds.map(id => { const q = c.qual[id] || {}; return h('div', { style: { fontSize: '8px', lineHeight: 2.1 } }, teamLabel(T(id), 16), h('span', { class: 'muted' }, ' · ' + (q.how === 'champion' ? q.titles.join(' + ') + ' champion' : q.how === 'replacement' ? `replacement for ${T(c.declined).abbr} (${ordinal(q.place)} in standings)` : `wildcard (${ordinal(q.place)} in standings)`))); }),
      c.declined ? h('div', { class: 'sub' }, `${fullName(T(c.declined))} declined the invitation.`) : null));
    else if (c.declined) body.appendChild(h('div', { class: 'panel sub' }, `${fullName(T(c.declined))} declined the invitation; the event is played without them.`));
  };
  render();
  return h('div', { class: 'screen wide bracketsS' }, header('BRACKETS ' + seasonLabel(se.year), () => go(scrHub)), tabs, body);
}

// ====================================================================
//  PLAYER STATISTICS + PROFILE
// ====================================================================
function statLineFor(save, p, scope, cat) {
  if (scope === 'season') { const s = save.season.stats[p.id]; if (!s) return emptyLine(); return cat === 'life' ? lifetime(s) : s[cat]; }
  return cat === 'life' ? lifetime(p.career) : p.career[cat];
}
function scrStats() {
  const save = UI.save, O = UI.statOpts;
  const body = h('div'), ctl = h('div');
  const skCols = [['num', '#'], ['name', 'PLAYER'], ['team', 'TEAM'], ['gp', 'GP'], ['g', 'G'], ['a', 'A'], ['pts', 'PTS'], ['sog', 'SOG'], ['xg', 'XG'], ['ds', 'DS'], ['tk', 'INT'], ['hit', 'TKL'], ['crd', 'CRD'], ['stars', '★'], ['toig', 'TOI/GP']];
  const gCols = [['num', '#'], ['name', 'KEEPER'], ['team', 'TEAM'], ['gp', 'GP'], ['w', 'W'], ['sa', 'SA'], ['sv', 'SV'], ['ga', 'GA'], ['svp', 'SV%'], ['sho', 'CS'], ['hds', 'HDSV'], ['gsax', 'GSAX'], ['stars', '★'], ['toig', 'TOI/GP']];
  const render = () => {
    ctl.innerHTML = '';
    const pill = (lab, on, fn) => h('button', { class: 'small' + (on ? ' sel' : ''), onclick: fn }, lab);
    ctl.appendChild(h('div', { class: 'tabs' }, pill('THIS SEASON', O.scope === 'season', () => { O.scope = 'season'; render(); }), pill('CAREER', O.scope === 'career', () => { O.scope = 'career'; render(); }),
      h('span', { style: { width: '14px' } }), ...['reg', 'po', 'tour', 'exh', 'life'].map(k => pill(CAT_NAMES[k].toUpperCase(), O.cat === k, () => { O.cat = k; render(); }))));
    ctl.appendChild(h('div', { class: 'tabs' }, pill('PLAYERS', O.pos === 'S', () => { O.pos = 'S'; UI.statSort = { k: 'pts', dir: -1 }; render(); }), pill('KEEPERS', O.pos === 'G', () => { O.pos = 'G'; UI.statSort = { k: 'svp', dir: -1 }; render(); }),
      h('span', { style: { width: '14px' } }), h('select', { onchange: e => { O.team = e.target.value; render(); } }, h('option', { value: 'all', selected: O.team === 'all' }, 'ALL TEAMS'), save.teamOrder.map(id => h('option', { value: id, selected: O.team === id }, fullName(T(id)) + (id === save.userTeamId ? ' (you)' : '')))),
      O.scope === 'career' ? pill(O.retired ? 'INCLUDING RETIRED' : 'ACTIVE ONLY', O.retired, () => { O.retired = !O.retired; render(); }) : null,
      pill('★ FAVOURITES', !!O.fav, () => { O.fav = !O.fav; render(); })));
    const rows = Object.values(save.players).filter(p => p.pos === O.pos && (!O.fav || p.fav) && (O.scope === 'season' ? save.season.stats[p.id] : (O.retired || p.status !== 'retired')))
      .map(p => {
        const l = fullLine(statLineFor(save, p, O.scope, O.cat)), tid = p.teamId || p.lastTeamId;
        return { p, l, num: p.num, name: p.last + ', ' + p.first[0], team: tid ? T(tid).abbr : 'FA', gp: l.gp, g: l.g, a: l.a, pts: l.g + l.a, sog: l.sog, hit: l.hit, pas: l.pas, pm: l.pm, w: l.w, sa: l.sa, sv: l.sv, ga: l.ga,
          svp: l.sa ? l.sv / l.sa : 0, toig: l.gp ? l.toi / l.gp : 0, tid, xg: l.xg / 100, ds: l.ds, tk: l.tk, crd: Math.round((l.pim || 0) / (BAL.pen.len || 30)), sho: l.sho, hds: l.hds, gsax: (l.xga - l.ga * 100) / 100, stars: l.s1 * 3 + l.s2 * 2 + l.s3 };
      }).filter(r => (O.team === 'all' || r.tid === O.team) && r.gp > 0);
    const S2 = UI.statSort;
    rows.sort((a, b) => { const va = a[S2.k], vb = b[S2.k]; return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * S2.dir; });
    const cols = O.pos === 'S' ? skCols : gCols;
    body.innerHTML = '';
    const HELPS = { xg: 'Expected goals (shot-danger model).', ds: 'Defensive stops: plays that killed a real scoring chance.', tk: 'Interceptions and steals.', hit: 'Tackles (shoulder charges and slide tackles that won the ball).', crd: 'Cards (yellow and red).', sho: 'Clean sheets.', stars: 'Three Stars points (3/2/1).', hds: 'High-danger saves.', gsax: 'Goals saved above expected (shot-danger model).', pm: 'Plus / minus.', sog: 'Shots on goal.', toig: 'Time on the pitch per game.', sho: 'Shutouts.' };
    body.appendChild(h('div', { class: 'panel statp' }, rows.length ? pages('stats' + O.pos + O.scope + O.cat + O.team, rows.slice(0, 200), UI.statRows || 12, sl => h('table', null,
      h('tr', null, cols.map(([k, lab], i) => h('th', { class: 'sort' + (i < 3 ? ' l' : '') + (S2.k === k ? ' on' : ''), 'data-help': HELPS[k] || null, onclick: () => { UI.statSort = { k, dir: S2.k === k ? -S2.dir : (k === 'name' || k === 'team' || k === 'num' ? 1 : -1) }; render(); } }, lab + (S2.k === k ? (S2.dir < 0 ? '▼' : '▲') : '')))),
      sl.map(r => h('tr', { class: 'click' + (r.tid === save.userTeamId ? ' me' : ''), onclick: () => profile(r.p.id) }, cols.map(([k], i) => h('td', { class: i < 3 ? 'l' : '' },
        k === 'svp' ? fmtSv(r.svp) : k === 'toig' ? fmtToi(r.toig) : k === 'pm' ? (r.pm > 0 ? '+' : '') + r.pm : k === 'xg' ? r.xg.toFixed(1) : k === 'gsax' ? (r.gsax >= 0 ? '+' : '') + r.gsax.toFixed(1) : k === 'name' ? (r.p.fav ? '★ ' : '') + r.name + (r.p.status === 'retired' ? ' (R)' : '') : r[k])))))) : h('div', { class: 'sub' }, 'No games played in this category yet.')));
  };
  render();
  setTimeout(() => stageFitRows(body, '.statp table tr:nth-child(2)', () => UI.statRows || 12, v => { UI.statRows = v; }, render, 6, 30), 0);
  return h('div', { class: 'screen wide statsS' }, header('PLAYER STATISTICS', () => go(UI.save ? scrHub : scrMain)), ctl, body, h('div', { class: 'hint' }, 'Click a column to sort, or a player for his profile. Hover a column name for what it means.'));
}
function profile(pid) { push(() => scrPlayer(pid)); }

// ====================================================================
//  ROSTER MANAGEMENT (click two players to swap)
// ====================================================================
// the LINES + BENCH panel runs to the bottom of the window (desktop): its four rows share the spare height
function rlFill(el) {
  requestAnimationFrame(() => {
    if (!el.isConnected || innerWidth <= 1000 || el.closest('.staged')) return;   // staged screens fill the stage with flex instead
    const zr = el.getBoundingClientRect().height / Math.max(1, el.offsetHeight) || 1;   // the text-size setting zooms the screen
    el.style.minHeight = Math.max(0, (innerHeight - 14 - el.getBoundingClientRect().top) / zr) + 'px';
  });
  return el;
}
// a player you've PROMISED ice time (top-line minutes, or the starter's net): a gold frame and a badge on his card, so
// you don't forget. Green while he's where you promised (it's kept once the deadline comes), red-gold when he isn't.
function promChip(p) {
  const pr = (p.morale && p.morale.prom || []).find(x => x.k === 'ice' && !x.res); if (!pr) return null;
  const save = UI.save, ok = typeof promiseKept === 'function' && promiseKept(save, p, pr);
  const left = pr.due != null && typeof mDay === 'function' ? Math.max(0, pr.due - mDay(save)) : null, what = p.pos === 'G' ? 'THE STARTER\'S NET' : 'TOP LINE';
  const help = `PROMISED ${what}${left != null ? `: ${left} game day${left === 1 ? '' : 's'} left` : ''}. ` + (ok ? 'He has it now: keep him there until the deadline and the promise is kept.' : (p.pos === 'G' ? 'Make him your starter' : 'Put him on Line 1') + ' or the promise will be broken.');
  return { ok, el: h('span', { class: 'prombadge' + (ok ? ' ok' : ''), 'data-help': help }, (ok ? '✓ ' : '! ') + 'PROMISED' + (left != null ? ' ' + left + 'D' : '')) };
}
function scrRoster() {
  const save = UI.save, team = T(save.userTeamId);
  let sel = null;
  const body = h('div');
  const card = (slot, compact) => {
    const id = getSlot(team.roster, slot), p = id ? Pl(id) : null;
    const isSel = sel && sel.kind === slot.kind && sel.i === slot.i && sel.j === slot.j;
    const click = () => {
      if (!sel) { sel = slot; return render(); }
      if (isSel) { sel = null; return render(); }
      if ((sel.kind === 'g') !== (slot.kind === 'g')) { toast('Players swap with players, keepers with keepers.'); sel = slot; return render(); }
      swapSlots(team, sel, slot); sel = null; Store.autosave(save); render();
    };
    if (!p) return h('div', { class: 'pcard empty' + (isSel ? ' sel' : ''), onclick: click }, 'EMPTY');
    const s = save.season.stats[p.id], l = s ? s.reg : emptyLine();
    const cgp = p.career ? ['reg', 'po', 'tour'].reduce((a, c) => a + ((p.career[c] && p.career[c].gp) || 0), 0) : 0, cgpEl = () => h('span', { class: 'muted cgp', 'data-help': `CAREER GAMES PLAYED: ${cgp} (every league, playoff and tournament game of his career)` }, cgp + ' CGP');
    const prm = promChip(p), pcls = prm ? (prm.ok ? ' promised ok' : ' promised') : '';
    if (compact === 'tight') {
      // the lines grid: four short rows per card, so all four lines fit on one screen without scrolling
      const lt = leaderOf(team, p.id), lw = leadWish(p);
      const role = slot.kind === 'line' ? slot.j : null, pen = role != null ? offPosPenalty(p.spos, role, p) : 0;
      const b = condBand(p.cond), inj = p.inj && p.inj.g > 0;
      return h('div', { class: 'pcard tight' + pcls + (isSel ? ' sel' : ''), onclick: click },
        h('div', { class: 'tname' }, portrait(p, team, 24),
          h('span', { class: 'tn' }, h('span', { class: 'num' }, '#' + p.num), ' ', p.last.toUpperCase()),
          lt ? h('span', { class: 'capbadge' }, lt) : null,
          h('span', { class: 'pbtns' }, favBtn(p), h('button', { class: 'small', title: 'Profile', onclick: e => { e.stopPropagation(); profile(p.id); } }, 'i'))),
        h('div', { class: 'trow' }, h('span', { class: 'covr', 'data-help': 'OVERALL rating (out of 100)' }, 'OVR ' + ovrInt(p)), ' ', h('span', { class: 'carch', 'data-help': ARCHETYPES[p.arch].name }, ARCHETYPES[p.arch].name.replace(/ (Specialist|Skater|Prospect)$/, '').replace(/^Physical /, '')), ' ', h('span', { class: 'muted' }, p.age + 'y'), !lt && lw ? [' ', h('span', { class: 'leadwish ' + lw.k, 'data-help': lw.help }, lw.short)] : null),
        h('div', { class: 'trow' }, h('span', { class: 'cstat', 'data-help': `${l.gp} games played this season: ${l.g} goals, ${l.a} assists` }, `${l.g}G ${l.a}A`), ' · ', cgpEl(), h('span', { class: 'muted', 'data-help': `Plays ${POS_NAMES[p.spos] || p.spos}, shoots ${(HAND_NAMES[p.hand] || 'Left').toLowerCase()}.` }, ` · ${posShort(p.spos)} · ${p.hand || 'L'} shot`),
),
        h('div', { class: 'trow' }, prm ? [prm.el, ' '] : null, (p.traits || []).map(id => { const t = TRAITS[id]; return t ? h('span', { class: 'trait r' + t.rarity, 'data-help': t.name.toUpperCase() + ': ' + t.desc }, t.icon) : null; }),
          h('span', { class: b[0] === 'Fresh' ? 'green' : b[0] === 'Ready' ? '' : b[0] === 'Tired' ? 'gold' : 'red' }, b[0].toUpperCase() + ' ' + Math.round(p.cond ?? 100)),
          inj ? h('span', { class: 'red', 'data-help': `Injured: ${p.inj.kind}, out ${p.inj.g} game${p.inj.g === 1 ? '' : 's'}.` }, ` · INJ ${p.inj.g}g`) : null,
          pen > 0 ? h('span', { style: { color: pen > 0.2 ? '#ff9a7a' : 'var(--gold)' }, 'data-help': `Playing the ${['left', 'centre', 'right'][role]} slot, away from his natural position: -${Math.round(pen * 100)}%.` }, ` · ${['L', 'C', 'R'][role]} SLOT -${Math.round(pen * 100)}%`) : null));
    }
    const keys = p.pos === 'G' ? [['ref', 'REF'], ['pos', 'POS'], ['reb', 'REB'], ['rec', 'REC']] : [['spd', 'SPD'], ['pow', 'PWR'], ['acc', 'ACC'], ['pas', 'PAS'], ['def', 'DEF'], ['chk', 'TKL'], ['fo', 'SP']];
    const lt = leaderOf(team, p.id), lw = leadWish(p);
    return h('div', { class: 'pcard' + pcls + (isSel ? ' sel' : ''), onclick: click },
      // portrait, name (gets all the room it needs), then the two little buttons in their own column on the right
      h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, portrait(p, team, compact ? 26 : 34),
        h('div', { style: { flex: 1, minWidth: 0, overflowWrap: 'anywhere' } }, h('span', { class: 'num' }, '#' + p.num), ' ', p.last.toUpperCase(), lt ? h('span', { class: 'capbadge' }, lt) : null, !lt && lw ? h('span', { class: 'leadwish ' + lw.k, 'data-help': lw.help }, lw.short) : null, prm ? prm.el : null),
        h('span', { class: 'pbtns' }, favBtn(p), h('button', { class: 'small', title: 'Profile', onclick: e => { e.stopPropagation(); profile(p.id); } }, 'i'))),
      compact
        // the facts in chips that wrap (never cut off): rating first, then type, age and this season's line
        ? h('div', { class: 'cstrip' }, h('span', { class: 'covr', 'data-help': 'OVERALL rating (out of 100)' }, 'OVR ' + ovrInt(p)), h('span', { class: 'carch' }, ARCHETYPES[p.arch].name), h('span', {}, p.age + 'y'),
            h('span', { class: 'cstat' }, p.pos === 'G' ? `${l.gp} GP · ${fmtSv(svPct(l))}` : `${l.gp} GP · ${l.g} G · ${l.a} A`), cgpEl(),
            p.pos !== 'G' ? posFitLine(p, slot) : null, typeof traitChips === 'function' ? traitChips(p) : null, typeof condTag === 'function' ? condTag(p) : null)
        : h('div', { class: 'muted' }, ARCHETYPES[p.arch].name + ' · ' + p.age + 'y · OVR ' + ovrInt(p) + ' · ' + (p.pos === 'G' ? `${l.gp} GP ${fmtSv(svPct(l))}` : `${l.gp} GP ${l.g}G ${l.a}A`) + ` · ${cgp} CGP`),
      !compact && p.pos !== 'G' ? posFitLine(p, slot) : null,
      compact ? null : [typeof traitChips === 'function' ? traitChips(p) : null, typeof condTag === 'function' ? condTag(p) : null],
      compact ? null : h('div', { style: { fontSize: '7px' } }, keys.map(([k, lab]) => lab + ' ' + r100(p.attrs[k])).join('  ')));
  };
  // who wants a letter, and who would be good with one (top leader scores without a letter)
  const leadWish = p => {
    const wants = typeof motiveOf === 'function' && motiveOf(p) === 'leader', nat = hasTrait(p, 'natural_leader');
    const all = rosterIds(team).map(Pl).filter(Boolean).sort((a, b) => standingOf(b, team) - standingOf(a, team)), top = all.slice(0, 4).includes(p) && standingOf(p, team) >= 40;
    if (wants) { const wait = !leaderOf(team, p.id) && typeof lettersOutrank === 'function' && lettersOutrank(save, team, p);
      return { k: 'want', short: wait ? 'WAITS FOR C' : 'WANTS C', label: wait ? 'WAITING HIS TURN' : 'WANTS A LETTER', help: `WANTS A LETTER: leading is what drives him (his motive). Giving him the C or an A makes him happier${top || nat ? ', and he has what it takes' : ''}.` + (wait ? ' For now he is happy to wait: everyone wearing a letter has more standing than he does, so going without one doesn\'t bother him.' : '') }; }
    if (nat) return { k: 'nat', short: 'NATURAL', label: 'NATURAL LEADER', help: 'NATURAL LEADER: his leadership bonuses are 35% stronger with a letter.' };
    if (top) return { k: 'good', short: 'LEADER', label: 'LEADER MATERIAL', help: 'LEADER MATERIAL: one of the most established players on your roster (rating, age, seasons, awards). He would do well with a letter.' };
    return null;
  };
  const render = () => {
    body.innerHTML = '';
    const r = team.roster;
    // each line's tactics right beside the players on it: strategy + tempo (the TACTICS tab has the full detail)
    const lineTacEl = i => { const tc = validTac(team.tac), setT = fn => { const t = validTac(team.tac); fn(t); team.tac = t; Store.autosave(save); render(); };
      return h('div', { class: 'linetac', onclick: e => e.stopPropagation() },
        h('select', { class: 'tp2sel', title: STRATEGIES[tc.lines[i]].strength, onchange: e => setT(t => { t.lines[i] = e.target.value; }) }, Object.entries(STRATEGIES).map(([k, v]) => h('option', { value: k, selected: k === tc.lines[i] }, v.name))),
        // tempo as a second menu (three buttons don't fit beside the cards at a readable size)
        h('select', { class: 'tp2sel', title: (TEMPOS[tc.tempo[i]] || {}).plain || (TEMPOS[tc.tempo[i]] || {}).desc || '', onchange: e => setT(t => { t.tempo[i] = e.target.value; }) }, Object.entries(TEMPOS).map(([k, t2]) => h('option', { value: k, selected: k === tc.tempo[i] }, t2.name)))); };
    const lineRow = i => h('div', { class: 'linerow' }, h('div', { class: 'lab' }, h('span', { class: 'lname' }, 'LINE ' + (i + 1), h('span', { class: 'lice', 'data-help': 'Share of the pitch time this line gets.' }, i === 0 ? '~40%' : i === 1 ? '~33%' : '~27%')), h('span', { class: 'gold', style: { whiteSpace: 'nowrap' } }, lineComp(r.lines[i].map(id => id && Pl(id))).replace(/ \/ /g, '/'),
        (ps => ps.length ? h('span', { class: 'lavg', 'data-help': 'Average OVR of the three players on this line.' }, ' ' + Math.round(ps.reduce((a, p) => a + ovrInt(p), 0) / ps.length)) : null)(r.lines[i].map(id => id && Pl(id)).filter(Boolean))), lineTacEl(i)), [0, 1, 2].map(j => card({ kind: 'line', i, j }, 'tight')));
    // one part of the roster at a time; a swap can still go between tabs (pick a player, switch tab, pick the other)
    const selNote = sel ? h('div', { class: 'gold', style: { fontSize: '7px', margin: '0 0 4px' } }, 'SWAPPING: pick another player (on any tab), or click him again to cancel.') : null;
    const mkTabs = () => tabbed('roster', [
      { label: 'LINES + BENCH', el: () => rlFill(h('div', { class: 'panel rlines' }, selNote, lineRow(0), lineRow(1), lineRow(2), h('div', { class: 'linerow' }, h('div', { class: 'lab', 'data-help': 'RESERVES are dressed: they replace injured, boxed or ejected players and can be your 4th player.' }, 'BENCH', h('br'), '(reserves)'), [0, 1, 2].map(i => card({ kind: 'res', i }, 'tight'))))) },
      { label: 'KEEPERS', el: () => h('div', { class: 'panel' }, selNote, h('div', { class: 'linerow' }, h('div', { class: 'lab' }, 'STARTER', h('br'), '+ BACKUPS'), [0, 1, 2].map(i => card({ kind: 'g', i })))) },
      { label: 'TACTICS', el: () => tacticsPanel(validTac(team.tac), tc => { team.tac = tc; Store.autosave(save); render(); }, { showOnEasy: true, compact: true, note: 'Applies from the next game. Hover for details.', showDesc: false }) },
      { label: 'LEADERSHIP', el: () => leaderEl },
      { label: 'DEVELOPMENT', el: () => typeof devTab === 'function' ? devTab(save, team, render) : h('div') },
      { label: 'FARM & IR' + (irIds(team).some(id => !(Pl(id).inj && Pl(id).inj.g > 0)) ? ' •' : ''), el: () => farmTab(save, team, render) },
    ]);
    // leadership: one captain, up to two alternates (skaters only; vacated automatically when a player leaves)
    const L = teamLeaders(team), sks = rosterIds(team).map(Pl).filter(Boolean).sort((a, b) => standingOf(b, team) - standingOf(a, team));
    const pickL = (role, cur, lab) => h('label', { class: 'f', style: { display: 'inline-block', marginRight: '14px' } }, lab + ' ',
      h('select', { onchange: e => { const pid = e.target.value || null, info = letterChangeInfo(save, team, role, pid);
        const go2 = () => { const err = applyLetterChange(save, team, role, pid); if (err) toast(err); Store.autosave(save); render(); };
        if (!info.change) return go2();
        const old = Pl(info.cur); render();                              // the menu snaps back until it's confirmed
        confirmDlg(info.free ? `Take the letter from ${old.first} ${old.last}? This is your one free letter change this season. He'll be upset for a while.`
          : `You've already changed letters this season. Changing again costs 3 GM reputation, upsets ${old.last} badly, and the whole room a little.`, info.free ? 'CHANGE (FREE)' : 'CHANGE ANYWAY', go2, !info.free); } },
        h('option', { value: '' }, '— none —'), sks.map(p => { const w = leadWish(p); return h('option', { value: p.id, selected: p.id === cur }, '#' + p.num + ' ' + pname(p) + (p.pos === 'G' ? ' (G)' : '') + ' · standing ' + standingOf(p, team) + (w && !leaderOf(team, p.id) ? ' · ' + w.label : '')); })));
    const pickS = (slot, pid) => pid ? h('select', { style: { marginLeft: '6px' }, onchange: e => { const err = setLeaderStyle(save, team, slot, e.target.value); if (err) toast(err); Store.autosave(save); render(); } },
      availableStyles(save, team, pid).map(k => h('option', { value: k, selected: (L.st[slot] || (slot === 'c' ? 'general' : 'champion')) === k }, LEAD_STYLES[k].name))) : null;
    const respLine = pid => { const p = Pl(pid), sv = standingOf(p, team), r = respectOf(p, team); return h('div', { class: r < 0.85 ? 'red' : r < 1 ? 'gold' : 'green', style: { fontSize: '7px', marginTop: '2px' }, 'data-help': 'STANDING (0-100): rating, age, seasons with your club, games played, awards and titles as captain. It grows over his career. A leader\'s bonuses work at his room-respect strength: about 42 standing is full strength, a green kid is much weaker, a respected veteran a little stronger.' }, `Standing ${sv} · ${standTier(sv)} · bonuses at ${Math.round(r * 100)}%`); };
    const styleDesc = (slot, pid) => pid ? h('div', { class: 'muted', style: { fontSize: '7px', margin: '2px 0 8px' } }, LEAD_STYLES[L.st[slot] || (slot === 'c' ? 'general' : 'champion')].desc, h('br'), h('span', { class: 'gold' }, styleBonusText(L.st[slot] || (slot === 'c' ? 'general' : 'champion'), slot === 'c' ? 1 : BAL.lead.assistMul, Pl(pid))), respLine(pid)) : null;
    const leaderEl = (h('div', { class: 'panel ldpanel' },
      // the three letters side by side, each a card: who, which style, what it does
      h('div', { class: 'ldcols' },
        h('div', { class: 'ldcard' }, pickL('c', L.c, 'CAPTAIN (C)'), pickS('c', L.c), styleDesc('c', L.c)),
        h('div', { class: 'ldcard' }, pickL('a0', L.a[0], 'ALTERNATE (A)'), pickS('a0', L.a[0]), styleDesc('a0', L.a[0])),
        h('div', { class: 'ldcard' }, pickL('a1', L.a[1], 'ALTERNATE (A)'), pickS('a1', L.a[1]), styleDesc('a1', L.a[1]))),
      (() => { const ws = sks.filter(p => !leaderOf(team, p.id) && leadWish(p)); return ws.length ? h('div', { class: 'ldwait', style: { margin: '6px 0 10px' } }, h('div', { class: 'sub gold' }, 'WAITING FOR A LETTER'),
        ws.map(p => { const w = leadWish(p); return h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', fontSize: '8px', margin: '3px 0' } }, portrait(p, team, 22), h('span', { style: { flex: 1 } }, '#' + p.num + ' ' + pname(p) + (p.pos === 'G' ? ' (G)' : '')), h('span', { class: 'leadwish ' + w.k, 'data-help': w.help }, w.label)); })) : null; })(),
      [L.c, L.a[0], L.a[1]].some(id => id && Pl(id) && Pl(id).pos === 'G') ? h('div', { class: 'sub', style: { margin: '4px 0 8px' } }, 'A KEEPER WITH A LETTER: keepers have their own four styles (The Backbone, The Brick Wall, The Quarterback, The Rock), each boosting one keeper rating for him. He is always out there, so his aura lifts whichever line is on, at half strength, whenever no player with a letter is on the pitch.') : null,
      (() => { const on = letterSeasonOn(save), used = save.season && save.season.letterS === save.season.num ? save.season.letterN || 0 : 0;
        return h('div', { class: 'sub', style: { margin: '4px 0 8px' } }, !on ? 'LETTER CHANGES: free until your first regular-season game.' : used < 1 ? 'LETTER CHANGES: 1 free change left this season (filling an empty letter is always free).' : 'LETTER CHANGES: your free change is used. Another one costs GM reputation and happiness.'); })(),
      leadershipStylesInfo(save, team),
      h('div', { class: 'hint', 'data-help': 'Every letter carries a leadership style: a personal bonus for the leader, plus an aura for his linemates while he is on the pitch. Only one aura works at a time: the captain\'s if he is out there, otherwise one alternate\'s (60% strength). New styles unlock through franchise achievements; a few are earned by individual players.' }, 'Every letter carries a leadership style: a personal bonus for the leader, plus an aura for his linemates while he is on the pitch. Only one aura works at a time: the captain\'s if he is out there, otherwise one alternate\'s (60% strength). New styles unlock through franchise achievements; a few are earned by individual players.')));
    body.appendChild(mkTabs());
  };
  render();
  return h('div', { class: 'screen staged rosterS' }, header('ROSTER: ' + fullName(team).toUpperCase(), () => go(scrHub), 'BACK',
      autoLinesToggle(save, () => go(scrRoster), true), h('button', { class: 'small', 'data-help': 'Build the best lines for each line\'s tactic and tempo. Shows you the changes and why before anything moves.', onclick: () => aaPreview(save, team, () => render()) }, 'AUTO-ARRANGE')),
    h('div', { class: 'sub rsub', style: { margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '8px' } }, h('span', { style: { flex: 1 } }, `Click two players to swap · ${rosterSkaters(team).length}/12 players · ${rosterGoalies(team).length}/3 keepers · ★ favourite · i profile`),
      typeof teamPromiseDlg === 'function' ? h('button', { class: 'small', 'data-help': 'Make a team-wide promise (the next tournament, the League Championship) to every player at once.', onclick: () => teamPromiseDlg(save, team, () => render()) }, 'TEAM PROMISE') : null),
    body);
}

// ====================================================================
//  TEAM CUSTOMIZER (live preview)
// ====================================================================
function scrCustomizer(identity, defaults, onSave, onCancel) {
  const id = clone(identity);
  const prev = h('div', { class: 'panel', style: { textAlign: 'center' } });
  const cv = () => h('canvas', { width: 128, height: 176, class: 'px', style: { width: '80px', height: '110px' } });
  const homeF = cv(), homeB = cv(), awayF = cv(), awayB = cv();
  const big = h('canvas', { width: 220, height: 220, style: { width: '96px', height: '96px' } });
  const nameEl = h('div', { style: { fontSize: '12px', margin: '8px 0' } });
  const labA = h('div', { class: 'muted', style: { fontSize: '7px' } }, 'HOME'), labB = h('div', { class: 'muted', style: { fontSize: '7px' } }, 'AWAY');
  let kitSel = 'home';                                          // the kit being edited on the UNIFORMS tab (shown first in the preview)
  const chips = h('div', { class: 'row' });
  prev.append(big, nameEl, chips, h('div', { class: 'row', style: { flexWrap: 'nowrap', justifyContent: 'center' } }, h('div', null, homeF, homeB, labA), h('div', null, awayF, awayB, labB)));
  const update = () => {
    const c = big.getContext('2d'); c.clearRect(0, 0, 220, 220); drawEmblemBadge(c, id, 110, 110, 100);
    nameEl.textContent = (id.city + ' ' + id.nick).toUpperCase() + '  (' + id.abbr + ')'; nameEl.style.color = teamTextColor(id);
    chips.innerHTML = ''; for (const k of ['p', 's', 'a']) chips.appendChild(h('span', { class: 'sw', style: { background: id.colors[k], cursor: 'default' } }));
    const keys = kitKeys(id); if (!keys.includes(kitSel)) kitSel = 'home';
    const a = kitSel, b = kitSel === 'home' ? 'away' : 'home';
    drawUniformPreview(homeF, id, a, false, 19); drawUniformPreview(homeB, id, a, true, 19);
    drawUniformPreview(awayF, id, b, false, 19); drawUniformPreview(awayB, id, b, true, 19);
    labA.textContent = kitByKey(id, a).name.toUpperCase(); labB.textContent = kitByKey(id, b).name.toUpperCase();
  };
  const form = h('div', { class: 'panel' });
  const renderForm = () => {
    form.innerHTML = '';
    const secs = { name: [], col: [], jersey: [], emblem: [], logo1: [], logo2: [], logo3: [] };
    const inp = (k, max) => h('input', { type: 'text', value: id[k], maxLength: max, oninput: e => { id[k] = e.target.value; if (k === 'nick' && !id._abbrTouched) id.abbr = (e.target.value.replace(/[^a-z]/gi, '').slice(0, 3) || 'XXX').toUpperCase(); if (k === 'abbr') { id._abbrTouched = true; id.abbr = e.target.value.toUpperCase().slice(0, 3); } update(); } });
    secs.name.push(h('label', { class: 'f' }, 'CITY / LOCATION'), inp('city', 14), h('label', { class: 'f' }, 'NICKNAME'), inp('nick', 12), h('label', { class: 'f' }, 'ABBREVIATION (3 LETTERS)'), inp('abbr', 3));
    for (const [k, lab] of [['p', 'PRIMARY COLOR'], ['s', 'SECONDARY COLOR'], ['a', 'ACCENT COLOR']]) {
      const pick = h('input', { type: 'color', value: id.colors[k], oninput: e => { id.colors[k] = e.target.value; renderForm(); update(); }, style: { verticalAlign: 'middle', width: '40px', height: '26px', padding: 0 } });
      secs.col.push(h('label', { class: 'f' }, lab), h('div', null, PRESET_COLORS.map(c => h('span', { class: 'sw' + (c.toLowerCase() === id.colors[k].toLowerCase() ? ' on' : ''), title: c, style: { background: c }, onclick: () => { id.colors[k] = c; renderForm(); update(); } })), ' ', pick));
    }
    // every style shows on a skater; locked ones are dark silhouettes that say how to unlock them
    const owns = c => !c || (typeof hasCosmetic === 'function' && hasCosmetic(c));
    secs.jersey.push(h('label', { class: 'f' }, 'JERSEY STYLE'), pages('custjersey', JERSEY_STYLES, 10, list => h('div', { class: 'row', style: { justifyContent: 'flex-start', gap: '4px' } }, list.map(s => {
      const lock = !owns(s.cos) && s.id !== id.style, cv = h('canvas', { width: 36, height: 66, class: 'px', style: { width: '36px', height: '66px', display: 'block', margin: '0 auto' } });
      drawFigureOn(cv, teamPalette(Object.assign({}, id, { style: s.id }), false), [fakeSkater({ num: 19, px: 18, py: 60 })], 2);
      if (lock) silhouette(cv);
      return h('button', { class: 'small styleopt gearopt' + (s.id === id.style ? ' sel' : '') + (lock ? ' locked' : ''), title: lock ? unlockHint(s.cos) : s.name,
        onclick: () => { if (lock) return toast(unlockHint(s.cos)); id.style = s.id; renderForm(); update(); } }, cv, h('div', null, lock ? '\uE001 ???' : s.name.toUpperCase()));
    }))));
    { const lockT = !(typeof hasCosmetic === 'function' && hasCosmetic('gold_trim')) && id.trim !== 'gold';
      secs.jersey.push(h('label', { class: 'f' }, 'TRIM'), h('div', { class: 'row', style: { justifyContent: 'flex-start' } }, h('button', { class: 'small' + (id.trim === 'gold' ? ' sel' : '') + (lockT ? ' locked' : ''), title: lockT ? unlockHint('gold_trim') : '',
        onclick: () => { if (lockT) return toast(unlockHint('gold_trim')); id.trim = id.trim === 'gold' ? null : 'gold'; renderForm(); update(); } }, lockT ? '\uE001 GOLD TRIM' : id.trim === 'gold' ? 'GOLD TRIM: ON' : 'GOLD TRIM: OFF'))); }
    secs.emblem.push(h('label', { class: 'f' }, 'TEAM EMBLEM'), h('div', { class: 'row', style: { justifyContent: 'flex-start' } }, EMBLEM_IDS.map(e => {
      const lock = !owns(EMBLEMS[e].cos) && e !== id.emblem;
      const b = badge(Object.assign({}, id, { emblem: e }), 34); b.style.cursor = lock ? 'help' : 'pointer'; b.style.outline = e === id.emblem ? '3px solid #ffd23f' : 'none';
      if (lock) { silhouette(b, '#2a3050'); { const c = b.getContext('2d'), em = EMBLEMS[e], ps = (b.width * 0.6) / 16, x0 = b.width / 2 - ps * 8; c.fillStyle = '#0e1124'; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const ch = (em.rows[y] || '')[x]; if (ch && ch !== '.') c.fillRect(x0 + x * ps, x0 + y * ps, ps + 0.05, ps + 0.05); } } b.title = unlockHint(EMBLEMS[e].cos); b.onclick = () => toast(unlockHint(EMBLEMS[e].cos)); }
      else { b.title = EMBLEMS[e].name; b.onclick = () => { id.emblem = e; renderForm(); update(); }; }
      return b; })));
    // logo: badge shape, border, background, emblem colours, mirror, ribbon (each option previewed on your own logo)
    const L = logoOf(id);
    const logoRow = (k, lab) => h('div', null, h('label', { class: 'f' }, lab), h('div', { class: 'row logorow', style: { justifyContent: 'flex-start', gap: '6px' } }, Object.entries(LOGO_OPTS[k]).map(([v, nm]) => {
      const cos = LOGO_LOCK[k + ':' + v], lock = cos && !owns(cos) && L[k] !== v;
      const b = badge(Object.assign({}, id, { logo: Object.assign({}, L, { [k]: v }) }), 34);
      if (lock) silhouette(b, '#2a3050');
      return h('button', { class: 'small logoopt' + (L[k] === v ? ' sel' : '') + (lock ? ' locked' : ''), title: lock ? unlockHint(cos) : nm,
        onclick: () => { if (lock) return toast(unlockHint(cos)); id.logo = Object.assign({}, L, { [k]: v }); renderForm(); update(); } }, b, h('div', null, lock ? '\uE001 ???' : nm.toUpperCase()));
    })));
    secs.logo1.push(logoRow('shape', 'BADGE SHAPE'), logoRow('fill', 'BADGE COLOUR'));
    secs.logo3.push(logoRow('border', 'BORDER'), logoRow('orn', 'ORNAMENT'));
    secs.logo2.push(logoRow('bg', 'BACKGROUND'), logoRow('tint', 'EMBLEM COLOURS (also on the jerseys)'),
      h('div', { class: 'row', style: { justifyContent: 'flex-start', marginTop: '6px' } },
        h('button', { class: 'small' + (L.flip ? ' sel' : ''), onclick: () => { id.logo = Object.assign({}, L, { flip: !L.flip }); renderForm(); update(); } }, 'MIRROR EMBLEM: ' + (L.flip ? 'ON' : 'OFF')),
        h('button', { class: 'small' + (L.ribbon ? ' sel' : ''), onclick: () => { id.logo = Object.assign({}, L, { ribbon: !L.ribbon }); renderForm(); update(); } }, 'NAME RIBBON: ' + (L.ribbon ? 'ON' : 'OFF'))));
      // one part at a time (no scrolling): the preview on the right shows every change
    form.append(tabbed('cust', [{ label: 'NAME', el: h('div', null, ...secs.name) }, { label: 'COLOURS', el: h('div', null, ...secs.col) },
      { label: 'JERSEY', el: h('div', null, ...secs.jersey) }, { label: 'UNIFORMS', el: () => kitEditor(id, () => kitSel, v => { kitSel = v; }, () => { renderForm(); update(); }) }, { label: 'EMBLEM', el: h('div', null, ...secs.emblem) },
      { label: 'LOGO: SHAPE', el: h('div', null, ...secs.logo1) }, { label: 'LOGO: BORDER', el: h('div', null, ...secs.logo3) }, { label: 'LOGO: COLOURS', el: h('div', null, ...secs.logo2) }]));
  };
  renderForm(); update();
  const doSave = () => {
    if (!id.city.trim() || !id.nick.trim()) return toast('Give the team a city and a nickname.');
    const out = { city: id.city.trim(), nick: id.nick.trim(), abbr: (id.abbr || id.nick.slice(0, 3)).toUpperCase().slice(0, 3), colors: { ...id.colors }, style: id.style, emblem: id.emblem, logo: id.logo ? { ...id.logo } : null, trim: id.trim || null, kits: id.kits ? JSON.parse(JSON.stringify(id.kits)) : null };
    onSave(out);
  };
  return h('div', { class: 'screen custS' }, header('TEAM CUSTOMIZER', onCancel, 'CANCEL',
      h('button', { onclick: () => confirmDlg('Reset the name, colors, jersey and emblem to the original look?', 'RESET', () => { Object.assign(id, clone(defaults)); delete id._abbrTouched; renderForm(); update(); }) }, 'RESET TO DEFAULT'),
      h('button', { class: 'primary', onclick: doSave }, 'SAVE')),
    h('div', { class: 'sub', 'data-help': 'Past trophies and records keep the name and colours used when they were won.' }, 'Changes show up everywhere once you SAVE.'),
    h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(260px,1fr)', gap: '12px' } }, form, h('div', null, prev)));
}

// ====================================================================
//  SEASON END + ROOKIE DRAFT
// ====================================================================
function scrSeasonEnd(simmed) {
  const save = UI.save, hs = save.history[save.history.length - 1];
  const aw = hs.awards.map(id => save.awards.find(a => a.id === id)).filter(Boolean);
  const userChamp = hs.champion && hs.champion.teamId === save.userTeamId;
  return h('div', { class: 'screen seasonendS' }, header('SEASON ' + hs.label + ' COMPLETE', null, undefined, hs.awardsNight && typeof scrAwardsNight === 'function' ? h('button', { onclick: () => go(() => scrAwardsNight(hs, () => go(() => scrSeasonEnd(simmed)))) }, '★ REPLAY AWARDS NIGHT') : null,
      h('button', { class: 'primary', onclick: () => go(scrHub) }, 'CONTINUE TO THE OFFSEASON ▶')),
    tabbed('seasonend', [{ label: 'CHAMPIONS', el: () => h('div', null,
    h('div', { class: 'panel', style: { textAlign: 'center' } },
      hs.champion ? h('div', null, drawTrophyCanvas('league', 4, userChamp), h('div', { class: 'gold', style: { fontSize: '13px', margin: '10px 0' } }, userChamp ? 'YOU ARE THE CHAMPIONS!' : 'CHAMPIONS: ' + hs.champion.name.toUpperCase()),
        h('div', { class: 'sub' }, 'Runner-up: ' + hs.runnerUp.name + (hs.champMvp ? ' · Playoff MVP: #' + hs.champMvp.num + ' ' + hs.champMvp.name : ''))) : null,
      h('div', { class: 'sub' }, `Your ${fullName(T(save.userTeamId))} finished ${ordinal(hs.userFinish)} with a ${recordStr(hs.userRecord)} record.`)),
    h('div', { class: 'sub' }, 'Players have aged a year: some improved, some declined, and a few veterans retired. Next: contract renewals, free agency and trades, the rookie draft, then roster finalization.'),
    simmed && simmed.length ? h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'FINAL RESULTS'), simmed.slice(-4).map(id => resultLine(save.season.games[id]))) : null) },
    { label: 'AWARDS (' + aw.length + ')', el: () => h('div', { class: 'panel' }, h('div', { class: 'awgrid' }, aw.map(a => h('div', { class: 'hotrow', onclick: () => push(() => scrAwardDetail(a.id)) }, Pl(a.pid) ? portrait(Pl(a.pid), a.teamId ? T(a.teamId) : null, 34) : null, h('div', { style: { fontSize: '8px', lineHeight: 1.9 } }, h('span', { class: 'gold' }, a.name.toUpperCase()), h('br'), '#' + a.num + ' ' + a.playerName + ' (' + a.abbr + ') · ' + a.stat))))) },
    hs.fin ? { label: 'FINANCES', el: () => h('div', { class: 'panel' }, h('h3', { style: { marginTop: 0 } }, 'FINANCIAL REVIEW'),
      h('table', null, [['Starting funds', hs.fin.start], ['Revenue', hs.fin.rev], ...Object.entries(REV_KEYS).filter(([k]) => hs.fin.cur && hs.fin.cur[k]).map(([k, n]) => ['  ' + n, hs.fin.cur[k]]),
        ['Expenses', -hs.fin.exp], ...Object.entries(EXP_KEYS).filter(([k]) => hs.fin.cur && hs.fin.cur[k]).map(([k, n]) => ['  ' + n, -hs.fin.cur[k]]), ['Ending funds', hs.fin.end]]
        .map(([lab, v]) => h('tr', null, h('td', { class: 'l' }, lab), h('td', { class: v < 0 ? 'red' : '' }, fmtM(v))))),
      h('div', { class: 'sub', style: { marginTop: '6px' } }, finAssessment(hs.fin))) } : null]));
}
function drawTrophyCanvas(type, ps, glow) {
  const c = h('canvas', { width: 28 * ps, height: 26 * ps, class: 'px' });
  drawTrophy(c.getContext('2d'), type, 6 * ps, 4 * ps, ps, glow);
  return c;
}
function scrHistory() {
  const save = UI.save;
  let tab = UI.histTab || 'seasons';
  const body = h('div'), tabs = h('div', { class: 'tabs' });
  const render = () => {
    UI.histTab = tab;
    tabs.innerHTML = '';
    for (const [k, lab] of [['seasons', 'SEASONS'], ['teams', 'TEAMS'], ['highlights', 'HIGHLIGHTS'], ['decorated', 'MOST DECORATED'], ['awards', 'ALL AWARDS'], ['draft', 'DRAFT HISTORY']]) tabs.appendChild(h('button', { class: k === tab ? 'sel' : '', onclick: () => { tab = k; render(); } }, lab));
    body.innerHTML = '';
    // long tables page instead of scrolling (Nov 23): 14 rows a page, ◀ ▶ under the table
    const paged = (key, list, headRow, rowFn, empty) => {
      UI.histPg = UI.histPg || {}; const per = Math.max(key === 'dec' ? 3 : 6, Math.floor((key === 'dec' ? 6 : 11) / (TEXT_SIZES[S.textSize] || 1))), pages = Math.max(1, Math.ceil(list.length / per)), pg = Math.min(UI.histPg[key] || 0, pages - 1);
      if (!list.length) return h('div', { class: 'panel' }, h('div', { class: 'sub' }, empty));
      const panel = h('div', { class: 'panel' }, h('table', null, headRow, list.slice(pg * per, pg * per + per).map(rowFn)),
        pages > 1 ? h('div', { class: 'row', style: { justifyContent: 'center', gap: '8px', margin: '6px 0 0' } },
          h('button', { class: 'small', disabled: pg === 0, onclick: () => { UI.histPg[key] = pg - 1; render(); } }, '◀'),
          h('span', { class: 'muted' }, 'PAGE ' + (pg + 1) + ' OF ' + pages),
          h('button', { class: 'small', disabled: pg >= pages - 1, onclick: () => { UI.histPg[key] = pg + 1; render(); } }, '▶')) : null);
      setTimeout(() => fitZoomEl(panel), 0); return panel;
    };
    if (tab === 'highlights') return body.appendChild(highlightArchive());
    if (tab === 'teams') {
      const rows = save.teamOrder.map(id => ({ id, n: save.trophies.filter(x => x.teamId === id).length, lg: save.trophies.filter(x => x.teamId === id && x.type === 'league').length })).sort((a, b) => b.lg - a.lg || b.n - a.n);
      const top = Math.max(1, ...rows.map(r => r.n));
      const tg = h('div', { class: 'grid g4' }, rows.map((r, i) => { const t = T(r.id);   // 4 across, smaller badges: 24 clubs in 3 across ran ~300px off the screen (Nov 23)
        return h('div', { class: 'teamcard histteam' + (r.id === save.userTeamId ? ' on' : ''), onclick: () => push(() => scrTeam(r.id)) }, h('span', { class: 'rank' }, i + 1), badge(t, 28),
          h('div', { style: { flex: 1, minWidth: 0 } }, h('div', { style: { color: teamTextColor(t) } }, fullName(t)), h('div', { class: 'salbar', style: { marginTop: '4px' } }, h('i', { style: { width: (r.n / top * 100) + '%' } }), h('span', null, r.n + (r.n === 1 ? ' trophy' : ' trophies'))),
            h('div', { class: 'muted', style: { fontSize: '.85em', marginTop: '3px' } }, r.lg ? r.lg + ' league title' + (r.lg > 1 ? 's' : '') : 'no league titles yet'))); }));
      setTimeout(() => fitZoomEl(tg), 0); return body.appendChild(tg);
    }
    if (tab === 'seasons') {
      if (!save.history.length) return body.appendChild(emptyState('history', 'No completed seasons yet. Finish a season to start writing history.'));
      // at a glance: seasons played, the most successful club, your titles
      const lg = {}; for (const hs of save.history) if (hs.champion) lg[hs.champion.teamId || hs.champion.id] = (lg[hs.champion.teamId || hs.champion.id] || 0) + 1;
      const best = Object.entries(lg).sort((a, b) => b[1] - a[1])[0], mine = save.history.filter(hs => hs.champion && (hs.champion.teamId || hs.champion.id) === save.userTeamId).length;
      body.appendChild(h('div', { class: 'grid g3' },
        h('div', { class: 'panel stat' }, h('div', { class: 'sub', style: { margin: 0 } }, 'SEASONS PLAYED'), h('div', { class: 'big gold' }, save.history.length)),
        h('div', { class: 'panel stat' }, h('div', { class: 'sub', style: { margin: 0 } }, 'MOST LEAGUE TITLES'), best && T(best[0]) ? h('div', { class: 'row', style: { justifyContent: 'flex-start' } }, badge(T(best[0]), 30), h('div', { class: 'big' }, T(best[0]).abbr + ' × ' + best[1])) : h('div', { class: 'big' }, '—')),
        h('div', { class: 'panel stat' }, h('div', { class: 'sub', style: { margin: 0 } }, 'YOUR LEAGUE TITLES'), h('div', { class: 'big ' + (mine ? 'gold' : '') }, mine))));
      body.appendChild(h('div', { class: 'histgrid' }, save.history.slice().reverse().map(hs => {
        const me = hs.champion && (hs.champion.teamId || hs.champion.id) === save.userTeamId, fin = hs.userFinish;
        return h('div', { class: 'panel histcard' + (me ? ' champ' : ''), onclick: () => seasonDetail(hs) },
          h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center', margin: 0 } }, h('div', { class: 'gold' }, 'SEASON ' + hs.season), h('div', { class: 'muted' }, hs.label)),
          h('div', { class: 'row', style: { justifyContent: 'flex-start', alignItems: 'center', gap: '10px' } }, drawTrophyCanvas('league', 2, me), hs.champion ? badge(hs.champion, 40) : null,
            h('div', null, h('div', { class: 'muted', style: { fontSize: '.85em' } }, 'CHAMPIONS'), h('div', null, hs.champion ? hs.champion.name : '—'), h('div', { class: 'muted', style: { fontSize: '.85em' } }, 'Runner-up: ' + (hs.runnerUp ? hs.runnerUp.name : '—')))),
          h('div', { class: 'row', style: { justifyContent: 'flex-start', margin: '4px 0 0' } }, h('span', { class: 'chip ' + (fin <= 4 ? 'good' : fin > 16 ? 'bad' : '') }, 'YOU: ' + ordinal(fin)), h('span', { class: 'muted' }, recordStr(hs.userRecord)), hs.champMvp ? h('span', { class: 'muted' }, 'Playoff MVP #' + hs.champMvp.num + ' ' + hs.champMvp.name) : null));
      })));
    } else if (tab === 'decorated') {
      const cnt = {};
      for (const a of save.awards) { (cnt[a.pid] = cnt[a.pid] || { pid: a.pid, n: 0, list: [] }).n++; cnt[a.pid].list.push(a.name); }
      for (const tr of save.trophies) if (tr.mvp) { (cnt[tr.mvp.pid] = cnt[tr.mvp.pid] || { pid: tr.mvp.pid, n: 0, list: [] }).n++; cnt[tr.mvp.pid].list.push(tr.compName + ' MVP'); }
      const rows = Object.values(cnt).sort((a, b) => b.n - a.n).slice(0, 25);
      body.appendChild(paged('dec', rows, h('tr', null, h('th', { class: 'l' }, 'PLAYER'), h('th', { class: 'l' }, 'STATUS'), h('th', null, 'HONOURS'), h('th', { class: 'l' }, 'BREAKDOWN')),
        r => { const p = Pl(r.pid); const by = {}; r.list.forEach(x => by[x] = (by[x] || 0) + 1);
          return h('tr', { class: 'click', onclick: () => profile(r.pid) }, h('td', { class: 'l' }, '#' + p.num + ' ' + pname(p)), h('td', { class: 'l' }, p.status === 'retired' ? 'Retired' : p.teamId ? T(p.teamId).abbr : 'FA'), h('td', { class: 'gold' }, r.n),
            h('td', { class: 'l', style: { whiteSpace: 'normal' } }, Object.entries(by).map(([k, v]) => v + 'x ' + k).join(', '))); }, 'No awards handed out yet.'));
    } else if (tab === 'awards') {
      body.appendChild(paged('awards', save.awards.slice().reverse(), h('tr', null, ['SEASON', 'AWARD', 'PLAYER', 'TEAM', 'STATS'].map((x, i) => h('th', { class: 'l' }, x))),
        a => h('tr', { class: 'click' + (a.teamId === save.userTeamId ? ' me' : ''), onclick: () => push(() => scrAwardDetail(a.id)) }, h('td', { class: 'l' }, a.seasonLabel), h('td', { class: 'l gold' }, a.name), h('td', { class: 'l' }, '#' + a.num + ' ' + a.playerName), h('td', { class: 'l' }, a.abbr), h('td', { class: 'l' }, a.stat)), 'No awards yet.'));
    } else {
      const story = dh => { const p = save.players[dh.pid]; if (!p || dh.ovr == null) return ''; const yrs = save.season.num - dh.season, now = ovrInt(p), mid = String(dh.pot).includes('–') ? String(dh.pot).split('–').map(Number).reduce((x, y) => x + y) / 2 : +dh.pot;
        if (yrs < 2) return ''; if (dh.no >= 15 && now >= 72) return 'STEAL'; if (now >= mid + 4) return 'BOOM'; if (dh.no <= 6 && yrs >= 4 && now < Math.min(66, mid - 10)) return 'BUST'; return ''; };
      const SC = { STEAL: '#5ee07a', BOOM: '#ffd23f', BUST: '#ff6b6b' };
      body.appendChild(paged('draft', save.draftHistory.slice().reverse(), h('tr', null, ['DRAFTED', 'PICK', 'TEAM', 'PLAYER', 'AT DRAFT', 'NOW', ''].map(x => h('th', { class: 'l' }, x))),
        dh => { const p = save.players[dh.pid], st = story(dh);
          return h('tr', { class: 'click' + (dh.user ? ' me' : ''), onclick: () => profile(dh.pid) }, h('td', { class: 'l' }, dh.season ? 'After season ' + dh.season : 'Inaugural'), h('td', { class: 'l' }, dh.type),
            h('td', { class: 'l' }, dh.teamName || (save.teams[dh.teamId] ? fullName(save.teams[dh.teamId]) : '')), h('td', { class: 'l' }, dh.name), h('td', { class: 'l' }, dh.ovr != null ? `${dh.ovr} · pot ${dh.pot}` : ''),
            h('td', { class: 'l' }, p && dh.ovr != null ? (p.status === 'retired' ? 'retired' : ovrInt(p) + ' · pot ' + potTxt(p)) : ''), h('td', { class: 'l', style: { color: SC[st] || '' } }, st)); }, 'No drafts yet.'));
    }
  };
  render();
  return h('div', { class: 'screen wide' }, header('LEAGUE HISTORY', () => go(UI.save ? scrHub : scrMain)), tabs, body);
}
function seasonDetail(hs) {
  const save = UI.save;
  modal(close => {
    const comp = (k, c) => !c ? null : h('div', { class: 'panel', style: { margin: '0 0 10px' } }, h('h3', { style: { marginTop: 0 } }, c.name.toUpperCase()),
      h('div', { style: { fontSize: '8px', lineHeight: 2.1 } }, 'Champion: ', h('a', { class: 'lnk gold', onclick: () => { close(); push(() => scrTeam(c.champion.teamId)); } }, c.champion.name), ' · Runner-up: ', h('a', { class: 'lnk', onclick: () => { close(); push(() => scrTeam(c.runnerUp.teamId)); } }, c.runnerUp.name),
        (() => { const tr = save.trophies.find(x => x.editionId === 's' + hs.season + '-' + k); return tr ? h('span', null, ' · ', h('a', { class: 'lnk', onclick: () => { close(); push(() => scrTrophyDetail('team', tr.id)); } }, 'open trophy ▸')) : null; })(), h('br'), c.result, h('br'),
        c.mvp ? 'MVP: #' + c.mvp.num + ' ' + c.mvp.name + ' (' + c.mvp.abbr + ') ' + c.mvp.stat : ''),
      c.rounds ? h('div', { class: 'muted', style: { fontSize: '7px', lineHeight: 2, marginTop: '6px' } }, c.rounds.map((r, i) => h('div', null, r.map(sr => `${sr.hi.abbr} ${sr.winsHi}-${sr.winsLo} ${sr.lo.abbr} [${sr.scores.map(s => `${s.away} ${s.as}-${s.hs} ${s.home}${s.so ? ' SO' : s.ot ? ' ET' : ''}`).join(', ')}]`).join('   ')))) : null);
    const leaders = (lab, arr, fmt) => h('div', { style: { fontSize: '8px', lineHeight: 2 } }, h('span', { class: 'muted' }, lab + ': '), arr.slice(0, 3).map(x => `#${x.num} ${x.name} (${x.abbr}) ${fmt ? fmt(x.v) : x.v}`).join(' · '));
    const aw = hs.awards.map(id => save.awards.find(a => a.id === id)).filter(Boolean);
    return h('div', null, h('h2', null, 'SEASON ' + hs.season + ' · ' + hs.label),
      h('h3', null, 'FINAL STANDINGS'), standingsTable(save, hs.standings, { line: true }),
      h('h3', null, 'PLAYOFFS & TOURNAMENTS'), comp('po', hs.playoffs), ['toc', 'finale', 'winter', 'classic', 'inv'].map(k => comp(k, hs.tournaments[k])),
      h('h3', null, 'AWARDS'), aw.map(a => h('div', { style: { fontSize: '8px', lineHeight: 2 } }, h('span', { class: 'gold' }, a.name), ': #' + a.num + ' ' + a.playerName + ' (' + a.abbr + ') ' + a.stat)),
      h('h3', null, 'LEAGUE LEADERS'), leaders('Goals', hs.leaders.goals), leaders('Assists', hs.leaders.assists), leaders('Points', hs.leaders.points), leaders('Save %', hs.leaders.svp, v => fmtSv(v)),
      h('div', { class: 'row', style: { marginTop: '12px' } }, h('button', { onclick: close }, 'CLOSE')));
  }, true);
}

// ====================================================================
//  TROPHY CASE (pixel-art cabinet; click a trophy to inspect its engraving)
// ====================================================================
function scrTrophies() {
  const save = UI.save, user = save.userTeamId;
  const TS = UI.tro = UI.tro || { tab: 'team', page: 0 };
  let tab = TS.tab, page = TS.page, hover = -1;
  const W2 = 760, H2 = 540, PER = 4, SHELVES = 2;   // fewer, bigger trophies: each fills its spot on the shelf
  const cv = h('canvas', { width: W2 * 2, height: H2 * 2, style: { width: '100%', maxWidth: '600px', display: 'block', margin: '0 auto', cursor: 'pointer' } });
  const ctx2 = cv.getContext('2d');
  const items = () => tab === 'team'
    ? save.trophies.filter(t => t.teamId === user).map(t => ({ kind: 'team', type: t.type, rec: t, label: 'S' + t.season }))
    : save.awards.filter(a => a.teamId === user).map(a => ({ kind: 'award', type: a.key, rec: a, label: 'S' + a.season }));
  const slots = [];
  const draw = () => {
    const it = items(), pages = Math.max(1, Math.ceil(it.length / (PER * SHELVES)));
    page = Math.min(page, pages - 1); TS.tab = tab; TS.page = page;
    const c = ctx2; c.setTransform(2, 0, 0, 2, 0, 0); c.imageSmoothingEnabled = false;
    // cabinet frame
    c.fillStyle = '#0b0d1a'; c.fillRect(0, 0, W2, H2);
    c.fillStyle = '#3a2412'; c.fillRect(20, 10, W2 - 40, H2 - 20);
    c.fillStyle = '#5a3a1e'; c.fillRect(28, 18, W2 - 56, H2 - 36);
    c.fillStyle = '#7a5230'; c.fillRect(28, 18, W2 - 56, 6); c.fillRect(28, 18, 6, H2 - 36);
    const g = c.createLinearGradient(0, 40, 0, H2 - 40); g.addColorStop(0, '#1d2449'); g.addColorStop(1, '#10142a');
    c.fillStyle = g; c.fillRect(46, 40, W2 - 92, H2 - 80);
    c.fillStyle = '#8a5a2b'; c.font = "10px 'PH Pixel', monospace"; c.textAlign = 'center';
    c.fillStyle = '#e0b050'; c.fillRect(W2 / 2 - 150, 22, 300, 14); c.fillStyle = '#3a2412';
    c.fillText(tab === 'team' ? fullName(T(user)).toUpperCase() + ' TROPHIES' : 'INDIVIDUAL AWARDS', W2 / 2, 33);
    slots.length = 0;
    const shelfH = (H2 - 80) / SHELVES, TPS = Math.max(4, Math.floor(Math.min(((W2 - 128) / PER - 8) / 16 * 0.85, (shelfH - 46) / 18)));
    for (let sIdx = 0; sIdx < SHELVES; sIdx++) {
      const y0 = 40 + sIdx * shelfH;
      // shelf plank
      c.fillStyle = '#6a4424'; c.fillRect(46, y0 + shelfH - 18, W2 - 92, 10); c.fillStyle = '#8a5a2b'; c.fillRect(46, y0 + shelfH - 18, W2 - 92, 3);
      c.fillStyle = '#2a1a0c'; c.fillRect(46, y0 + shelfH - 8, W2 - 92, 4);
      for (let k = 0; k < PER; k++) {
        const idx = page * PER * SHELVES + sIdx * PER + k, x = 64 + k * ((W2 - 128) / PER);
        const cell = { x, y: y0 + 10, w: (W2 - 128) / PER - 8, h: shelfH - 30, idx };
        slots.push(cell);
        const item = it[idx];
        if (!item) {          // empty spot: a ghost of a team trophy the club has never won, with its name
          if (tab !== 'team' || typeof drawTrophyGhost !== 'function') continue;
          const wonT = new Set(it.map(x => x.type)), miss = Object.keys(TROPHY_PRESTIGE).filter(k2 => !wonT.has(k2)).sort((a2, b2) => TROPHY_PRESTIGE[b2] - TROPHY_PRESTIGE[a2]);
          const gk = miss[idx - it.length]; if (!gk) continue;
          const ps = TPS; drawTrophyGhost(c, gk, x + (cell.w - 16 * ps) / 2, y0 + shelfH - 18 - 18 * ps, ps);
          c.fillStyle = '#5a6a9a'; c.font = "9px 'PH Pixel', monospace"; c.fillText(({ league: 'LEAGUE', inv: 'INVITATIONAL', classic: 'CLASSIC', winter: 'WINTER CUP', finale: 'FINALE CUP', toc: 'CHAMPIONS' })[gk] || '?', x + cell.w / 2, y0 + shelfH - 10);
          continue;
        }
        const ps = TPS, tx = x + (cell.w - 16 * ps) / 2, ty = y0 + shelfH - 18 - 18 * ps;   // the art is 18 units tall: its base sits on the plank
        drawTrophy(c, item.kind === 'team' ? item.type : item.type, tx, ty, ps, idx === hover);
        c.fillStyle = '#e0b050'; c.fillRect(x + cell.w / 2 - 34, y0 + shelfH - 17, 68, 9);
        c.fillStyle = '#3a2412'; c.font = "8px 'PH Pixel', monospace"; c.fillText(item.label, x + cell.w / 2, y0 + shelfH - 10);
      }
    }
    // glass glare
    c.fillStyle = 'rgba(255,255,255,.05)'; c.beginPath(); c.moveTo(80, 40); c.lineTo(180, 40); c.lineTo(110, H2 - 40); c.lineTo(10 + 46, H2 - 40); c.fill();
    if (!it.length) { c.fillStyle = '#9aa3c7'; c.font = "9px 'PH Pixel', monospace"; c.fillText(tab === 'team' ? 'NO TROPHIES YET. GO WIN SOMETHING!' : 'NO INDIVIDUAL AWARDS YET.', W2 / 2, H2 / 2); }
    pageLab.textContent = `PAGE ${page + 1} / ${pages}  ·  ${it.length} ${tab === 'team' ? 'TROPHIES' : 'AWARDS'}`;
  };
  const at = e => { const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * W2 / r.width, y = (e.clientY - r.top) * H2 / r.height; const it = items(); return slots.find(s => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h && it[s.idx]); };
  cv.onmousemove = e => { const s = at(e); const nh = s ? s.idx : -1; if (nh !== hover) { hover = nh; draw(); } };
  cv.onclick = e => { const s = at(e); if (s) inspect(items()[s.idx]); };
  const pageLab = h('span', { class: 'sub', style: { margin: 0 } });
  const tabs = h('div', { class: 'tabs' });
  const renderTabs = () => { tabs.innerHTML = ''; for (const [k, lab] of [['team', 'TEAM TROPHIES'], ['award', 'INDIVIDUAL AWARDS']]) tabs.appendChild(h('button', { class: k === tab ? 'sel' : '', onclick: () => { tab = k; page = 0; renderTabs(); draw(); } }, lab)); };
  renderTabs();
  const node = h('div', { class: 'screen' }, header('TROPHY CASE', () => go(scrRooms), 'BACK TO TROPHY ROOMS'), tabs, cv,
    h('div', { class: 'row' }, h('button', { onclick: () => { page = Math.max(0, page - 1); draw(); } }, '◀ PREV'), pageLab, h('button', { onclick: () => { page++; draw(); } }, 'NEXT ▶')),
    h('div', { class: 'hint', style: { textAlign: 'center' } }, 'Click a trophy to open its history and championship memories.'));
  setTimeout(draw, 0);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  return node;
}
function inspect(item) { push(() => scrTrophyDetail(item.kind, item.rec.id)); }

// ====================================================================
//  BOOT
// ====================================================================
(async function boot() {
  loadSettings();
  go(scrLoading);
  await Store.init();
  if (typeof loadProfile === 'function') await loadProfile();
  await refreshSaves();
  go(scrMain);
  addEventListener('beforeunload', () => { if (Store.pending) Store.flush(); });
})();

// ---------- TEAM LOOK > UNIFORMS: home, away and any number of alternates; the whole team wears the kit alike
function kitEditor(id, getSel, setSel, redraw) {
  const K = teamKits(id), keys = kitKeys(id), sel = keys.includes(getSel()) ? getSel() : 'home';
  const own = c => !c || (typeof hasCosmetic === 'function' && hasCosmetic(c));
  // materialise the kits on first edit so every field is stored
  const store = () => { id.kits = id.kits || {}; if (!id.kits.home) id.kits.home = Object.assign({}, K.home); if (!id.kits.away) id.kits.away = Object.assign({}, K.away); if (!id.kits.alts || !id.kits.alts.length) id.kits.alts = K.alts.map(a => Object.assign({}, a)); return id.kits; };
  const cur = kitByKey(id, sel);
  const set = patch => { const S0 = store(); if (sel === 'home') Object.assign(S0.home, patch); else if (sel === 'away') Object.assign(S0.away, patch); else Object.assign(S0.alts[+sel.slice(3)], patch); redraw(); };
  const pickRow = (lab, k) => h('div', { class: 'kitrow' }, h('span', { class: 'gold' }, lab),
    ['p', 's', 'a'].map(c => id.colors[c]).concat(['#eef1f6', '#141832']).map(c => h('span', { class: 'sw' + (String(cur[k]).toLowerCase() === c.toLowerCase() ? ' on' : ''), title: c, style: { background: c }, onclick: () => set({ [k]: c }) })),
    h('input', { type: 'color', value: cur[k], oninput: e => set({ [k]: e.target.value }), style: { width: '34px', height: '20px', verticalAlign: 'middle' } }));
  const sel2 = (lab, k, opts) => h('label', { class: 'kitrow' }, h('span', { class: 'gold' }, lab), h('select', { onchange: e => set({ [k]: e.target.value }) }, opts.map(([v, n]) => h('option', { value: v, selected: cur[k] === v }, n))));
  const styles = JERSEY_STYLES.filter(s2 => own(s2.cos) || s2.id === cur.style).map(s2 => [s2.id, s2.name]);
  const helmets = Object.entries(GEAR_OPTS.helmet).filter(([v]) => !gearLocked(v, 'helmet') || v === cur.helmet).map(([v, n]) => [v, n.replace(' ★', '')]);
  const gloves = Object.entries(GEAR_OPTS.gloves).filter(([v]) => !gearLocked(v, 'gloves') || v === cur.gloves).map(([v, n]) => [v, n.replace(' ★', '')]);
  const S1 = id.kits && id.kits.alts && id.kits.alts.length ? id.kits.alts : K.alts;
  return h('div', null,
    h('div', { class: 'tabs', style: { marginBottom: '6px' } }, keys.map(k => h('button', { class: 'small' + (k === sel ? ' sel' : ''), onclick: () => { setSel(k); redraw(); } }, kitByKey(id, k).name.toUpperCase())),
      h('button', { class: 'small', title: 'Design another alternate uniform', onclick: () => { const S0 = store(); const base = K.alts[0]; S0.alts.push(Object.assign({}, base, { name: 'Alternate ' + (S0.alts.length + 1), main: id.colors.a, dark: id.colors.p, trim: id.colors.s })); setSel('alt' + (S0.alts.length - 1)); redraw(); } }, '+ ALTERNATE'),
      /^alt/.test(sel) && S1.length > 1 ? h('button', { class: 'small ghost', onclick: () => { const S0 = store(); S0.alts.splice(+sel.slice(3), 1); setSel('home'); redraw(); } }, 'DELETE') : null),
    /^alt/.test(sel) ? h('label', { class: 'kitrow' }, h('span', { class: 'gold' }, 'NAME'), h('input', { type: 'text', value: cur.name, maxLength: 16, onchange: e => set({ name: e.target.value.trim() || cur.name }) })) : null,
    pickRow('JERSEY', 'main'), pickRow('SECOND', 'dark'), pickRow('TRIM', 'trim'),
    h('div', { class: 'kitgrid' }, sel2('PATTERN', 'style', styles), sel2('HEADBANDS', 'helmet', helmets), sel2('GLOVES', 'gloves', gloves),
      sel2('SOCKS', 'socks', Object.entries(GEAR_OPTS.socks)), sel2('FIT', 'fit', Object.entries(GEAR_OPTS.jersey))),
    h('div', { class: 'hint', 'data-help': 'Every player wears the same uniform: headbands, gloves, socks and fit come from the kit. Boots, shin pads, tape and keeper gear stay personal. Pick tonight\'s kit on the pre-game screen.' }, 'The whole team wears it alike · pick tonight\'s kit before each game.'));
}
