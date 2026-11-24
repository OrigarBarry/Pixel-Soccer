// ====================================================================
//  LEGACY: one area for your honours (trophy rooms, the trophy case, the cabinet & achievements)
//  The three old screens keep their own code; this wraps each one under a single header and tab bar,
//  so every way in (hub tile, main menu, links inside them) lands in the same place.
// ====================================================================
(function legacyHub() {
  if (typeof scrRooms !== 'function' || typeof scrTrophies !== 'function' || typeof scrLegacy !== 'function') return;
  const parts = { rooms: scrRooms, case: scrTrophies, cabinet: scrLegacy, locker: () => scrLocker(UI.legBack || scrHub) };
  const TABS = [['rooms', 'TROPHY ROOMS'], ['case', 'TROPHY CASE'], ['cabinet', 'CABINET & ACHIEVEMENTS'], ['locker', 'THE LOCKER']];
  const shell = key => {
    const inner = parts[key]();
    const kids = [...inner.children].filter(c => !c.classList.contains('bar'));      // drop the old screen's own header
    const backTo = UI.legBack || scrHub;
    const bar = h('div', { class: 'tabs tabbar legtabs' }, TABS.map(([k, lab]) =>
      h('button', { class: 'small' + (k === key ? ' sel' : ''), onclick: () => { if (k !== key) go(wrapped[k]); } }, lab)));
    const node = h('div', { class: inner.className + ' legacyS' }, header('LEGACY', () => { UI.legBack = null; go(backTo); }), bar, ...kids);
    return node;
  };
  const wrapped = { rooms: () => shell('rooms'), case: () => shell('case'), cabinet: () => shell('cabinet'), locker: () => shell('locker') };
  scrRooms = wrapped.rooms; scrTrophies = wrapped.case; scrLegacy = wrapped.cabinet;
})();
