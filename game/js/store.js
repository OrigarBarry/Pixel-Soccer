'use strict';
// ====================================================================
//  STORE: franchise saves (account storage if available, else this browser),
//  autosave, export / import
// ====================================================================
// run async jobs a few at a time (account storage is a network round trip per document: doing them one by one was the lag)
async function inPool(jobs, n = 6) { let i = 0; const run = async () => { while (i < jobs.length) { const j = jobs[i++]; await j(); } }; await Promise.all(Array.from({ length: Math.min(n, jobs.length) }, run)); }
const CHUNK = 90000;                       // characters per stored chunk (documents are capped at 256 KiB)
const Store = {
  mode: 'memory', db: null, uid: null, mem: {}, written: {}, queue: Promise.resolve(), pending: null, timer: null, lastError: null,
  modeLabel() {
    const lbl = { cloud: 'Saved to your account (private to you)', local: 'Saved in this browser only', ls: 'Saved in this browser only', memory: 'Not saved: storage is unavailable here' }[this.mode];
    return this.cloudBlocked && this.mode !== 'cloud' ? lbl + ' (view-only access)' : lbl;
  },
  async init() {
    try {
      if (window.claude && window.claude.use) {
        const timeout = ms => new Promise(r => setTimeout(() => r(null), ms));
        const db = await Promise.race([window.claude.use('db'), timeout(10000)]);
        const user = db ? await Promise.race([window.claude.use('user'), timeout(10000)]) : null;
        const uid = user ? await Promise.race([user.id(), timeout(10000)]) : null;
        if (db && uid) {
          this.db = db; this.uid = uid;
          // the database being there doesn't mean we may write to it: someone the artifact was shared with as a viewer
          // can read but not write (even his own private space). Probe once; if refused, keep saves in this browser.
          const ok = await Promise.race([this.col().doc('probe').set({ t: Date.now() }).then(() => true, () => false), timeout(8000).then(() => false)]);
          if (ok) { this.mode = 'cloud'; return this.mode; }
          this.cloudBlocked = true; this.db = null;
        }
      }
    } catch (e) { /* fall through to local storage */ }
    return this.useLocal();
  },
  async useLocal() {
    if (await IDB.open()) this.mode = 'local';
    else { try { localStorage.setItem('psbk-probe', '1'); localStorage.removeItem('psbk-probe'); this.mode = 'ls'; } catch (e) { this.mode = 'memory'; } }
    return this.mode;
  },
  col() { return this.db.collection('data/users/' + this.uid); },
  // ---------- listing
  async list() {
    try {
      if (this.mode === 'cloud') { const s = await this.col().doc('index').get(); return s.exists ? (s.data().saves || []) : []; }
      if (this.mode === 'local') return (await IDB.all('meta')) || [];
      if (this.mode === 'ls') return JSON.parse(localStorage.getItem('psbk-index') || '[]');
      return Object.values(this.mem).map(x => x.meta);
    } catch (e) { this.lastError = e; return []; }
  },
  async setIndex(metaList) {
    if (this.mode === 'cloud') await this.col().doc('index').set({ saves: metaList });
    else if (this.mode === 'ls') localStorage.setItem('psbk-index', JSON.stringify(metaList));
  },
  // ---------- saving (serialised so writes never overlap)
  save(save) { return (this.queue = this.queue.then(() => this._put(save)).catch(e => { this.lastError = e; })); },
  autosave(save) {                         // coalesce bursts into one write
    this.pending = save; clearTimeout(this.timer);
    this.timer = setTimeout(() => { const s = this.pending; this.pending = null; if (s) this.save(s); }, 500);
  },
  async flush() { clearTimeout(this.timer); if (this.pending) { const s = this.pending; this.pending = null; await this.save(s); } await this.queue; },
  async _put(save) {
    const meta = saveMeta(save);
    if (this.mode === 'cloud') {
      try { await this._putCloud(save, meta); return; }
      catch (e) { this.lastError = e; this.cloudBlocked = true; this.db = null; await this.useLocal(); }   // any refusal: keep it in this browser instead of losing it
    }
    const json = serializeSave(save);
    this.lastSize = json.length;
    if (this.mode === 'local') { await IDB.put('saves', { id: save.id, json }); await IDB.put('meta', meta); return; }
    if (this.mode === 'ls') {
      localStorage.setItem('psbk-save-' + save.id, json);
      const idx = JSON.parse(localStorage.getItem('psbk-index') || '[]').filter(m => m.id !== save.id); idx.push(meta);
      localStorage.setItem('psbk-index', JSON.stringify(idx)); return;
    }
    this.mem[save.id] = { json, meta };
  },
  async _putCloud(save, meta) {
    // Pieces are written under fresh names (…-k~gen) whenever they change, and the head (written last) lists the exact
    // pieces of this save. A save cut off part-way (tab closed, connection dropped) or a second tab writing at the same
    // time can no longer leave a mix of old and new pieces behind the head: the head always points at one whole save.
    // Pieces the new head no longer uses are deleted only after the head is written.
    const col = this.col(), sec = splitSave(save), w = this.written[save.id] || (this.written[save.id] = {});
    const head = { v: SAVE_VERSION, at: Date.now(), sections: {}, keys: {} }, jobs = [], stale = [], gen = Date.now().toString(36);
    for (const [name, str] of Object.entries(sec)) {
      const n = Math.max(1, Math.ceil(str.length / CHUNK)), prev = w['keys-' + name] || [], keys = [];
      head.sections[name] = n;
      for (let k = 0; k < n; k++) {
        const part = str.slice(k * CHUNK, (k + 1) * CHUNK), old = prev[k];
        if (old && w[old] === part) { keys.push(old); continue; }       // unchanged: keep the piece already stored
        const key = `sv-${save.id}-${name}-${k}~${gen}`; keys.push(key);
        jobs.push(async () => { await col.doc(key).set({ d: part }); w[key] = part; });
        if (old) stale.push(old);
      }
      for (let k = n; k < prev.length; k++) if (prev[k]) stale.push(prev[k]);
      head.keys[name] = keys;
    }
    const listP = this.list();                                           // fetch the index while the pieces upload
    await inPool(jobs);                                                  // all pieces at once (a few at a time), not one by one
    await col.doc(`sv-${save.id}-head`).set(head);                       // the head last: it only points at pieces that exist
    for (const [name, keys] of Object.entries(head.keys)) w['keys-' + name] = keys;
    const idx = (await listP).filter(m => m.id !== save.id); idx.push(meta);
    if (JSON.stringify(idx) !== w.idx) { await this.setIndex(idx); w.idx = JSON.stringify(idx); }
    const used = new Set(Object.values(head.keys).flat());
    inPool([...new Set(stale)].filter(k => !used.has(k)).map(k => async () => { try { await col.doc(k).delete(); } catch (e) {} delete w[k]; }), 4);
    this.backupLocal(save);                                              // and a spare copy in this browser
  },
  // a spare copy of the latest cloud save in this browser: if the account copy is ever damaged, the game falls back to it
  async backupLocal(save) {
    try { if (!IDB.db && !(await IDB.open())) return; await IDB.put('saves', { id: save.id, json: serializeSave(save), at: Date.now(), backup: true }); } catch (e) { /* best effort */ }
  },
  async localBackup(id) { try { if (!IDB.db && !(await IDB.open())) return null; const r = await IDB.get('saves', id); return r && r.json ? migrateSave(JSON.parse(r.json)) : null; } catch (e) { return null; } },
  // ---------- loading
  async load(id) {
    if (this.mode === 'cloud') {
      const col = this.col(), hs = await col.doc(`sv-${id}-head`).get();
      if (!hs.exists) return null;
      const head = hs.data(), sec = {}, w = this.written[id] = {};
      await Promise.all(Object.entries(head.sections).map(async ([name, n]) => {          // every section at once
        const keys = (head.keys && head.keys[name]) || Array.from({ length: n }, (_, k) => `sv-${id}-${name}-${k}`);
        const parts = await Promise.all(keys.map(key => col.doc(key).get()));
        sec[name] = parts.map((p, k) => { const d = p.exists ? p.data().d : ''; w[keys[k]] = d; return d; }).join('');
        w['keys-' + name] = keys;
      }));
      const fixed = repairSections(sec);
      if (fixed.lost.length) {
        // a damaged piece: fall back to the spare copy in this browser if it is at least as new; otherwise use the repair
        const spare = await this.localBackup(id);
        if (spare && (spare.lastPlayed || 0) >= (head.at || 0) - 60000) { this.repairNote = 'Your account copy was damaged; loaded the backup kept in this browser.'; for (const k of Object.keys(w)) delete w[k]; return spare; }
        this.repairNote = fixed.note;
      }
      const save = migrateSave(joinSave(sec));
      if (fixed.lost.length) save.repaired = { at: Date.now(), note: fixed.note };
      return save;
    }
    let json = null;
    if (this.mode === 'local') { const r = await IDB.get('saves', id); json = r && r.json; }
    else if (this.mode === 'ls') json = localStorage.getItem('psbk-save-' + id);
    else json = this.mem[id] && this.mem[id].json;
    return json ? migrateSave(JSON.parse(json)) : null;
  },
  async remove(id) {
    if (this.mode === 'cloud') {
      const col = this.col(), hs = await col.doc(`sv-${id}-head`).get();
      if (hs.exists) { const hd = hs.data(); for (const [name, n] of Object.entries(hd.sections)) for (const key of (hd.keys && hd.keys[name]) || Array.from({ length: n }, (_, k) => `sv-${id}-${name}-${k}`)) await col.doc(key).delete(); }
      await col.doc(`sv-${id}-head`).delete();
      await this.setIndex((await this.list()).filter(m => m.id !== id));
      delete this.written[id]; return;
    }
    if (this.mode === 'local') { await IDB.del('saves', id); await IDB.del('meta', id); return; }
    if (this.mode === 'ls') { localStorage.removeItem('psbk-save-' + id); localStorage.setItem('psbk-index', JSON.stringify((await this.list()).filter(m => m.id !== id))); return; }
    delete this.mem[id];
  },
};
// ---------- account-wide profile (cosmetic unlocks, lifetime achievement record); never stored inside a franchise save
Object.assign(Store, {
  async getProfile() {
    try {
      if (this.mode === 'cloud') { const d = await this.col().doc('profile').get(); return d.exists ? JSON.parse(d.data().d || '{}') : {}; }
      return JSON.parse(localStorage.getItem('psph98-profile') || '{}');
    } catch (e) { this.lastError = e; return {}; }
  },
  async putProfile(pr) {
    const str = JSON.stringify(pr);
    try {
      if (this.mode === 'cloud') await this.col().doc('profile').set({ d: str });
      else localStorage.setItem('psph98-profile', str);
    } catch (e) { this.lastError = e; try { localStorage.setItem('psph98-profile', str); } catch (e2) {} }
  },
});
// split a save into sections that change at different rates (only changed chunks get rewritten)
function splitSave(save) {
  const active = {}, retired = {};
  for (const [id, p] of Object.entries(save.players)) (p.status === 'retired' ? retired : active)[id] = p;
  const core = Object.assign({}, save); delete core.players; delete core.history; delete core.trophies; delete core.awards; delete core.draftHistory; delete core.clips; delete core.memorabilia;
  const J = o => JSON.stringify(o, saveReplacer);
  return { core: J(core), active: J(active), retired: J(retired),
    archive: J({ history: save.history, trophies: save.trophies, awards: save.awards, draftHistory: save.draftHistory, memorabilia: save.memorabilia }),
    clips: JSON.stringify(save.clips || {}) };
}
// A section that won't parse is repaired instead of losing the whole save. The usual damage: one piece came from an
// older write (the save was interrupted, or two tabs wrote at once), so the text holds a complete OLDER copy of that
// section followed by leftovers. That older copy is kept; replay clips that can't be read are simply dropped.
function repairSections(sec) {
  const lost = [], names = { core: 'league and schedule', active: 'players', retired: 'retired players', archive: 'history and trophies', clips: 'replay clips' };
  for (const name of Object.keys(sec)) {
    const str = sec[name] || '';
    try { JSON.parse(str || '{}'); continue; } catch (e) {
      const m = /position (\d+)/.exec(e.message || ''), pos = m ? +m[1] : -1;
      let ok = false;
      if (pos > 0 && /after JSON/i.test(e.message || '')) { try { JSON.parse(str.slice(0, pos)); sec[name] = str.slice(0, pos); ok = true; } catch (e2) {} }
      if (!ok && name === 'clips') { sec[name] = '{}'; ok = true; }
      if (!ok && name === 'retired') { sec[name] = '{}'; ok = true; }
      lost.push({ name, ok, kept: ok && sec[name] !== '{}' });
      if (!ok) throw new Error(`the ${names[name] || name} part of this save is damaged beyond repair (${e.message})`);
    }
  }
  const note = lost.length ? 'Repaired a damaged save: ' + lost.map(x => (names[x.name] || x.name) + (x.kept ? ' (restored from an earlier point)' : ' (reset)')).join(', ') + '.' : '';
  return { lost, note };
}
function joinSave(sec) {
  const core = JSON.parse(sec.core), arch = JSON.parse(sec.archive || '{}');
  core.memorabilia = arch.memorabilia || core.memorabilia || [];
  core.players = Object.assign({}, JSON.parse(sec.active || '{}'), JSON.parse(sec.retired || '{}'));
  return Object.assign(core, { history: arch.history || [], trophies: arch.trophies || [], awards: arch.awards || [], draftHistory: arch.draftHistory || [], clips: JSON.parse(sec.clips || '{}') });
}
function saveMeta(save) {
  const t = save.teams[save.userTeamId], st = save.season.standings[save.userTeamId];
  const sizeKB = Math.round((Store.lastSize || 0) / 1024);
  return { id: save.id, name: save.name, teamId: t.id, teamName: fullName(t), abbr: t.abbr, colors: { ...t.colors }, emblem: t.emblem,
    season: save.seasonNum, label: seasonLabel(save.season.year), record: `${st.w}-${st.otl}-${st.l}`,
    champs: save.trophies.filter(x => x.type === 'league' && x.teamId === save.userTeamId).length, lastPlayed: save.lastPlayed, version: SAVE_VERSION, draft0: !!(save.draft0 && !save.draft0.done), debug: !!save.debug, dream: !!save.dream };
}
// ---------- IndexedDB (browser-local fallback)
const IDB = {
  db: null,
  open() {
    return new Promise(res => {
      try {
        if (!window.indexedDB) return res(false);
        const rq = indexedDB.open('pixelsoccer-franchise', 1);
        rq.onupgradeneeded = () => { const d = rq.result; d.createObjectStore('saves', { keyPath: 'id' }); d.createObjectStore('meta', { keyPath: 'id' }); };
        rq.onsuccess = () => { this.db = rq.result; res(true); };
        rq.onerror = () => res(false);
        setTimeout(() => res(!!this.db), 3000);
      } catch (e) { res(false); }
    });
  },
  tx(store, mode, fn) {
    return new Promise((res, rej) => {
      try { const t = this.db.transaction(store, mode), st = t.objectStore(store), r = fn(st); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }
      catch (e) { rej(e); }
    });
  },
  put(store, v) { return this.tx(store, 'readwrite', st => st.put(v)); },
  get(store, k) { return this.tx(store, 'readonly', st => st.get(k)); },
  del(store, k) { return this.tx(store, 'readwrite', st => st.delete(k)); },
  all(store) { return this.tx(store, 'readonly', st => st.getAll()); },
};
// ---------- export / import
async function exportSave(save) {
  const json = serializeSave(save);
  const t = save.teams[save.userTeamId];
  const filename = `pixelsoccer-${t.nick.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-season-${save.seasonNum}.json`;
  try {
    if (window.claude && window.claude.use) {
      const dl = await Promise.race([window.claude.use('downloads'), new Promise(r => setTimeout(() => r(null), 4000))]);
      if (dl) { await dl.save({ filename, data: json }); return { ok: true, filename }; }
    }
  } catch (e) { if (e && e.code === 'declined') return { ok: false, declined: true }; }
  return { ok: false, json, filename };         // caller shows a copy box instead
}
function parseImport(text) {
  let save;
  try { save = JSON.parse(text); } catch (e) { return { error: "That file isn't valid JSON." }; }
  if (!save || !isSaveFormat(save.format)) return { error: "That isn't a Pixel Soccer franchise save." };
  save = migrateSave(save);
  const errs = validateSave(save);
  if (errs.length) return { error: 'This save looks damaged: ' + errs.slice(0, 3).join('; ') };
  return { save };
}
