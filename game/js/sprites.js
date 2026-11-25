'use strict';
// ====================================================================
//  PLAYER SPRITES (skaters, goalies, referees, bench players)
//  Drawn on a pixel grid 1.5x finer than the rest of the art, at exactly the same size on the ice:
//  one sprite pixel = PSS world units. Origin at the skater's feet; x right, y down.
// ====================================================================
const PSS = SS / 1.5;
// SOCCER (Nov 24): footballers' build: a little taller and slimmer than the hockey players the art was drawn for.
// Applied at the feet (the sprite origin), so everyone still stands on the same spot; keepers, refs and the bench too.
const BODY_SX = 0.86, BODY_SY = 1.12;
// Squeezing pixel art by a fraction would smear each pixel over two screen pixels, so a body is drawn at its native
// pixel size on a small canvas and stretched onto the screen with sharp (nearest-neighbour) scaling: crisp, and one
// image copy per figure. drawShadowed's dark pass (a patched fillRect on the screen canvas) is carried over.
const BODY_BOX = { w: 84, h: 76, ox: 42, oy: 58 };   // sprite x -42..42, y -58..18 (arms up, a dive, the shadow)
const BODY_OC = { cv: null, c: null };
const bodyScale = () => {};
function drawBodyFit(x, y, draw) {
  const keep = ctx, keepTo = toPSprite;
  if (typeof document === 'undefined' || !keep || !keep.getTransform) return draw();
  toPSprite(x, y); const m = keep.getTransform();                                                // where he stands on the real canvas
  if (!BODY_OC.cv) { BODY_OC.cv = document.createElement('canvas'); BODY_OC.cv.width = BODY_BOX.w; BODY_OC.cv.height = BODY_BOX.h; BODY_OC.c = BODY_OC.cv.getContext('2d'); }
  const oc = BODY_OC.c; oc.setTransform(1, 0, 0, 1, 0, 0); oc.globalAlpha = 1; oc.globalCompositeOperation = 'source-over'; oc.clearRect(0, 0, BODY_BOX.w, BODY_BOX.h); oc.imageSmoothingEnabled = false;
  const dark = Object.prototype.hasOwnProperty.call(keep, 'fillRect');                          // drawShadowed's dark pass
  try { ctx = oc; toPSprite = () => oc.setTransform(1, 0, 0, 1, BODY_BOX.ox, BODY_BOX.oy); draw(); }
  finally { ctx = keep; toPSprite = keepTo; }
  if (dark) { oc.setTransform(1, 0, 0, 1, 0, 0); oc.globalAlpha = 1; oc.globalCompositeOperation = 'source-atop'; oc.fillStyle = '#04050c'; oc.fillRect(0, 0, BODY_BOX.w, BODY_BOX.h); oc.globalCompositeOperation = 'source-over'; }
  const sm = keep.imageSmoothingEnabled;
  keep.setTransform(m.a * BODY_SX, m.b, m.c, m.d * BODY_SY, m.e, m.f); keep.imageSmoothingEnabled = false;
  keep.drawImage(BODY_OC.cv, -BODY_BOX.ox, -BODY_BOX.oy);
  keep.imageSmoothingEnabled = sm; keep.setTransform(m);
}
let toPSprite = (x, y) => ctx.setTransform(K * PSS, 0, 0, K * PSS, Math.round(x * K) + camOffX(), Math.round(y * K) + camOff());

const skinOf = LK => (LK && LK.alien ? '#7be36a' : null) || (LK && typeof SKIN_COL !== 'undefined' ? SKIN_COL[LK.skin] : null) || '#f0c49b';
const hairOf = LK => (LK && typeof HAIR !== 'undefined' ? HAIR[LK.hair] : null) || '#3a2a1a';
const darker = (c, k = 0.25) => typeof shade === 'function' ? shade(c, -k) : c;

// the team crest on the chest. The 16x16 emblem is drawn pixel for pixel at half a sprite pixel
// (one device pixel in play), so it fills an 8x8 sprite-pixel patch with nothing lost to resampling.
// Earlier versions sampled it down to 6x6, which dropped strokes and broke shapes.
const CREST_CACHE = new Map();
function crestRuns(C) {
  const em = EMBLEMS[C.emblem] || EMBLEMS.star, col = emblemColors(C), flip = !!(C.logo && C.logo.flip), key = (C.emblem || 'star') + col.a + col.s + col.w + C.colors.p + (C.main || '') + flip;
  let runs = CREST_CACHE.get(key);
  if (runs) return runs;
  runs = [];
  const shf = emblemShift(em), ox = Math.round(flip ? -shf.dx : shf.dx), oy = Math.round(shf.dy);   // centred on the chest
  for (let y = 0; y < 16; y++) {
    const row0 = em.rows[y] || '', row = flip ? row0.split('').reverse().join('') : row0;
    for (let x = 0; x < 16;) {
      const ch = row[x];
      if (!ch || ch === '.') { x++; continue; }
      let e = x + 1; while (e < 16 && row[e] === ch) e++;
      const pc = col[ch] || col.a, bg = C.main || C.colors.p;
      runs.push([ch !== 'k' && colorDist(pc, bg) < 60 ? shade(pc, lum(pc) > 0.5 ? -0.45 : 0.45) : pc, x + ox, y + oy, e - x]); x = e;   // readable on the jersey
    }
  }
  if (CREST_CACHE.size > 200) CREST_CACHE.clear();
  CREST_CACHE.set(key, runs); return runs;
}
function drawCrest(C, x0, y0, size = 8) {
  if (typeof EMBLEMS === 'undefined' || !C.colors) return;
  const u = size / 16;
  for (const [c, x, y, w] of crestRuns(C)) { ctx.fillStyle = c; ctx.fillRect(x0 + x * u, y0 + y * u, w * u, u); }
}

// ---------- the stick: held diagonally across the body, blade on the side he shoots from
function stickGeo(p, reachBoost) {
  const s = typeof handSign === 'function' ? handSign(p) : -1;
  const aim = p._aim || { x: p.fx || 0, y: p.fy == null ? 1 : p.fy };          // (winding up, his body turns but the stick works along the shot line)
  const fx = aim.x, fy = aim.y, rx = -fy, ry = fx;
  const d0 = p.dkOff || 0, bh = typeof BACKHAND_OFF !== 'undefined' ? -s * BACKHAND_OFF : -s * 12;
  const k = Math.min(1, Math.min(Math.abs(d0), Math.abs(d0 - bh)) / DEKE_REACH), off = d0 / PSS;   // reach shortens mid-move, full again at rest on either side
  const kUp = clamp(-fy, 0, 1);                                                   // facing up the ice (seen from behind): the blade sits closer to his skates, further out to the side
  const R = (10 + reachBoost * 1.5) * (1 - 0.3 * k), lat = (s * 3 + off) * (1 + 0.3 * kUp);   // SOCCER: the ball sits just in front of his strong foot
  const blade = { x: fx * R + rx * lat, y: (fy * R * (1 - 0.8 * kUp) + ry * lat * 0.65) * 0.85 };   // (side-on, the sideways spread is mostly depth)
  const bk = clamp(-d0 * s / (typeof BACKHAND_OFF !== 'undefined' ? BACKHAND_OFF : 12), 0, 1), ts = s * (1 - 2 * bk);   // on the backhand the hands roll over: the whole stick mirrors
  const top = { x: -rx * ts * 5 + fx * 2, y: -16 - ry * ts * 2 };
  const tl = clamp((-9 - top.y) / ((blade.y - top.y) || 1), 0.25, 0.7);
  let low = { x: top.x + (blade.x - top.x) * tl, y: top.y + (blade.y - top.y) * tl };
  const sx = Math.abs(rx * s) > 0.3 ? Math.sign(rx * s) : (Math.sign(fx) || 1);
  const rest = { x: blade.x, y: blade.y };
  // WIND-UP: the stick swings up around his hands, which gather at his hip, to about 40 degrees above the ice: on his
  // stick side when he shoots up or down the ice, back away from the target when he shoots across it. It sweeps back
  // along the ice first (never through it), and pointing away from us (shooting down the screen) it looks shorter.
  // It snaps most of the way there at once and the last of it loads as the shot charges. The puck stays where it was.
  const w = windAmount(p);
  let behindUs = 0;
  if (w > 0) {
    let side = Math.sign(blade.x - top.x) || 1; if (Math.abs(fx) > 0.5) side = -Math.sign(fx);
    const up = fy < -0.5, down = fy > 0.5;
    // up the ice (seen from behind): the stick is on the far side of him, hidden by his body but for the end of it
    // poking out past his shoulder. Down the ice (facing us): hands low at the hip on his other side, the shaft
    // crossing in front of his chest up to the blade. Across the ice: back away from the target at 40 degrees.
    const L = (Math.hypot(blade.x - top.x, blade.y - top.y) + 2) * (down ? 0.95 : up ? 0.95 : 1);
    const ang = (up ? 22 : 40) * Math.PI / 180;
    const P1 = down ? { x: -side * 5, y: -12 } : up ? { x: side * 1, y: -15 } : { x: side * 2, y: -13 };
    const a0 = Math.atan2(blade.y - top.y, (blade.x - top.x) * side), a = a0 + (-ang - a0) * w;
    const P = { x: top.x + (P1.x - top.x) * w, y: top.y + (P1.y - top.y) * w };
    const v = { x: side * Math.cos(a), y: Math.sin(a) };
    let bl = { x: P.x + v.x * L, y: P.y + v.y * L };
    if (bl.y > 0) { bl.y = 0; bl.x = P.x + side * Math.sqrt(Math.max(0, L * L - P.y * P.y)); }
    const u = { x: (bl.x - P.x) / L, y: (bl.y - P.y) / L };
    top.x = P.x - u.x * 2; top.y = P.y - u.y * 2; blade.x = bl.x; blade.y = bl.y;
    low = { x: P.x + u.x * 5, y: P.y + u.y * 5 };
    behindUs = up ? 1 : 0;
  }
  return { top, low, blade, dir: sx, s, rest, wind: w, behindUs };
}
// how far into his wind-up he is: most of the way at once (the anticipation pose), the rest as the shot charges
function windAmount(p) {
  if (!(p.charge >= 0) || p.g || (puck.owner && puck.owner !== p)) return 0;
  return 0.7 * Math.min(1, p.charge / 0.18) + 0.3 * clamp((p.charge - 0.18) / 0.7, 0, 1);
}
function drawStick(p, reachBoost, geo) {
  return;   // SOCCER: no stick (the geometry above still places the ball at his feet)
  const g = geo || stickGeo(p, reachBoost);
  const C0 = TEAM[p.team], G = typeof gearOf === 'function' ? uniformGear(gearOf(p.pl), C0, p.g) : null;
  const sc = G ? gearCol(G, 'stick', C0) : '#9a6a35', sc2 = G && G.stick === 'twotone' ? '#eef1f6' : darker(sc, 0.3);
  const bx = Math.round(g.blade.x), by = Math.round(g.blade.y);
  // shaft from just above the top hand down to the heel of the blade (a darker edge gives it some body)
  const ux = g.blade.x - g.top.x, uy = g.blade.y - g.top.y, ul = Math.hypot(ux, uy) || 1;
  ctx.fillStyle = sc2; pxLine(g.top.x - ux / ul * 2 + 1, g.top.y - uy / ul * 2, bx + 1, by);
  ctx.fillStyle = sc; pxLine(g.top.x - ux / ul * 2, g.top.y - uy / ul * 2, bx, by);
  if (G && G.stick === 'gold' && ((S.t >> 4) & 1)) { ctx.fillStyle = '#fff6c0'; px(Math.round(g.low.x), Math.round(g.low.y) - 2, 1, 1); }
  // blade with tape
  const tc = G ? gearCol(G, 'tape', C0) : '#18191f';
  for (let i = 0; i < 5; i++) { ctx.fillStyle = G && G.tape === 'candy' ? (i % 2 ? '#ffffff' : '#d9342b') : (i === 0 ? sc : tc); px(bx + g.dir * i, by, 1, 1); }
  ctx.fillStyle = 'rgba(30,50,90,.18)'; px(Math.min(bx, bx + g.dir * 4), by + 1, 5, 1);
}
// arms: shoulder -> elbow -> glove. The elbow bends out to the side so the arm reads as an arm, not a bar.
// In the back view the arms go behind the torso (drawn first) and only the shoulders and elbows show.
function armPath(s0, hd, side) {
  const dx = hd.x - s0.x, dy = hd.y - s0.y, L = Math.hypot(dx, dy) || 1;
  const bend = Math.min(2.5, Math.max(0.8, 6 - L * 0.35));        // short reach = more bend
  const el = { x: s0.x + dx * 0.45 + side * bend, y: s0.y + dy * 0.5 + 1 };
  return [s0, el, hd];
}
function drawArms(C, G, ln, hands, sleeveTop, back) {
  const sh = [{ x: -8 + ln, y: -19, side: -1 }, { x: 7 + ln, y: -19, side: 1 }];
  const ex = G ? G.visor : 'none', under = ex === 'under' ? darker(C.dark || C.main, 0.15) : null;
  const glove = drawArms.glove || drawArms.oglove || skinOf(drawArms.lk), cuff = darker(glove, 0.2), gs = drawArms.glove ? 3 : 2;   // SOCCER: bare hands, winter gloves (the kit), or a keeper's gloves
  const thr = G && G.jersey === 'elbow' ? 9 : G && G.jersey === 'rolled' ? 0.3 : 0.42;   // where the sleeve ends (long sleeves: never)
  for (const hd of hands) {
    const s0 = Math.abs(sh[0].x - hd.x) + Math.abs(sh[0].y - hd.y) <= Math.abs(sh[1].x - hd.x) + Math.abs(sh[1].y - hd.y) ? sh[0] : sh[1];
    sh.splice(sh.indexOf(s0), 1); sh.push({ x: 999, y: 999, side: 0 });
    const pts = armPath(s0, hd, s0.side);
    let seg = 0;
    for (let k = 0; k < 2; k++) {
      const a = pts[k], b = pts[k + 1], n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y)));
      for (let i = 0; i <= n; i++, seg++) {
        const x = Math.round(a.x + (b.x - a.x) * i / n), y = Math.round(a.y + (b.y - a.y) * i / n);
        const t = (k + i / n) / 2;
        ctx.fillStyle = !drawArms.glove && t > thr ? (under || skinOf(drawArms.lk)) : sleeveColor(C, Math.min(3, Math.floor(t * 4)));   // short sleeves (or an undershirt)
        px(x, y, 2, 2);
        if (k === 0 && i === 0) { ctx.fillStyle = darker(sleeveColor(C, 0), 0.18); px(x, y + 1, 2, 1); }   // shoulder cap shadow
      }
      if (k === 0 && ex === 'armband' && s0.side < 0) { ctx.fillStyle = '#1b1c22'; px(Math.round(b.x), Math.round(b.y) - 1, 2, 1); }   // a black armband on the left arm
    }
    if (back) continue;
    ctx.fillStyle = glove; px(Math.round(hd.x) - 1, Math.round(hd.y) - 1, gs, gs); ctx.fillStyle = cuff; px(Math.round(hd.x) - 1, Math.round(hd.y) + gs - 2, gs, 1);
    if (drawArms.glove && drawArms.gback) { ctx.fillStyle = drawArms.gback; px(Math.round(hd.x) - 1, Math.round(hd.y), gs, 1); }
    if (ex === 'wrist' || ex === 'gold' || ex === 'tapewrist') { ctx.fillStyle = ex === 'gold' ? '#e6b800' : ex === 'tapewrist' ? '#eef1f6' : (C.trim || '#ffffff'); px(Math.round(hd.x) - 1, Math.round(hd.y) - 2, 2, 1); }   // wristbands / taped wrists
  }
}

// SOCCER kit pieces (shared by outfield players and keepers): legs = [[x, lift], ...]
function sockKit(C, G) {
  const so = G ? G.socks : 'team';
  return { so, col: so === 'dark' ? C.dark : so === 'white' ? '#eef1f6' : C.main, band: so === 'white' ? C.main : so === 'stripe' ? '#ffffff' : C.trim };
}
function drawLegsKit(C, G, LK, legs, sockOver) {
  const sk = G ? gearCol(G, 'skates', C) : '#1d1f27', K = sockKit(C, G), sc = sockOver || K.col;
  const stripe = G ? gearCol(G, 'stick', C) : '#eef1f6', tape = G ? gearCol(G, 'tape', C) : null, pad = G ? gearCol(G, 'pads', C) : '#f2f2f2';
  for (const [lx, up] of legs) {
    if (K.so === 'high') { ctx.fillStyle = sc; px(lx, -8 - up, 4, 6); ctx.fillStyle = K.band; px(lx, -8 - up, 4, 1); }      // over the knee
    else {
      ctx.fillStyle = skinOf(LK); px(lx, -8 - up, 4, 2);                                                                      // knee
      if (K.so === 'rolled') {                                                                                                // rolled down: the shin pad shows
        ctx.fillStyle = pad; px(lx, -6 - up, 4, 2); ctx.fillStyle = darker(pad, 0.25); px(lx + 3, -6 - up, 1, 2);
        if (G && G.pads === 'stripes') { ctx.fillStyle = '#d9342b'; px(lx + 1, -6 - up, 1, 2); }
        ctx.fillStyle = sc; px(lx, -4 - up, 4, 2); ctx.fillStyle = K.band; px(lx, -4 - up, 4, 1);
      } else {
        ctx.fillStyle = sc; px(lx, -6 - up, 4, 4);
        ctx.fillStyle = K.band;
        if (K.so === 'hoops') { px(lx, -6 - up, 4, 1); px(lx, -4 - up, 4, 1); } else if (K.so === 'stripe') { px(lx, -5 - up, 4, 1); px(lx, -3 - up, 4, 1); } else px(lx, -6 - up, 4, 1);
      }
    }
    if (tape && K.so !== 'rolled') { ctx.fillStyle = G.tape === 'candy' ? ((S.t >> 3) & 1 ? '#ffffff' : '#d9342b') : tape; px(lx, (K.so === 'high' ? -5 : -4) - up, 4, 1); }   // sock tape below the knee
    // the boot: upper, a lighter top edge, the stripes on its side, the sole
    ctx.fillStyle = sk; px(lx, -2 - up, 5, 2);
    ctx.fillStyle = G && G.skates === 'twotone' ? '#eef1f6' : darker(sk, -0.25); px(lx, -2 - up, 5, 1);
    if (stripe) { ctx.fillStyle = G && G.skates === 'retro' ? '#eef1f6' : stripe; px(lx + 1, -1 - up, 1, 1); px(lx + 3, -1 - up, 1, 1); }
    if (G && G.skates === 'gold' && ((S.t >> 4) & 1)) { ctx.fillStyle = '#fff6c0'; px(lx + 2, -2 - up, 1, 1); }
    ctx.fillStyle = 'rgba(20,30,20,.35)'; px(lx, -up, 5, 1);                                                                    // studs / sole
  }
}
function drawShortsKit(C, G) {
  const st = G ? G.shorts : 'standard', pc = C.pants, pd = darker(C.pants, 0.3);
  if (st === 'short') { ctx.fillStyle = pc; px(-6, -11, 12, 2); px(-6, -9, 5, 1); px(1, -9, 5, 1); }
  else if (st === 'long') { ctx.fillStyle = pc; px(-6, -11, 12, 3); px(-6, -8, 5, 2); px(1, -8, 5, 2); ctx.fillStyle = pd; px(-6, -7, 5, 1); px(1, -7, 5, 1); }
  else {
    ctx.fillStyle = pc; px(-6, -11, 12, 3); px(-6, -8, 5, 1); px(1, -8, 5, 1);
    if (st === 'cycling') { ctx.fillStyle = darker(pc, 0.5); px(-6, -7, 4, 1); px(2, -7, 4, 1); }                             // cycling shorts peeking out
  }
  ctx.fillStyle = pd; px(-6, -11, 12, 1);
  ctx.fillStyle = C.trim; px(-6, -10, 1, 2); px(5, -10, 1, 2);
}
// a keeper's shirt: his design (the old mask designs and their paint jobs, now shirts) or the plain keeper colour
const KEEPER_STYLE = { bucket: 'shoulder', white: 'minimal', retro: 'classic', checkers: 'checker', wolf: 'yoke', skull: 'minimal', tiger: 'tiger', flame: 'flames', shark: 'zigzag', lightning: 'diagonal', star: 'stars', galaxy: 'galaxy', laststand: 'laststand', chrome: 'pinstripe', gold: 'goldsash' };
const KEEPER_STYLE_POOL = ['hoops', 'diagonal', 'chevron', 'yoke', 'dots', 'bands', 'shoulder', 'split', 'pinstripe', 'zigzag', 'tiger', 'checker'];
function keeperShirt(G, C, team) {
  const KK = keeperKit(C, team), m = G ? G.mask : 'team';
  const plain = { main: KK.main, dark: KK.dark, light: KK.light, trim: KK.trim, pants: KK.pants, style: 'minimal' };
  if (!m || m === 'team' || m === 'split' || typeof maskSpec !== 'function') return plain;
  let sp = null; try { sp = maskSpec(m, C, G); } catch (e) {}
  if (!sp) return plain;
  const main = sp.L || KK.main; let dark = sp.R || darker(main, 0.3);
  if (typeof colorDist === 'function' && colorDist(dark, main) < 18) dark = darker(main, 0.3);
  let trim = sp.ridge || sp.a || C.main; if (typeof colorDist === 'function' && colorDist(trim, main) < 30) trim = sp.a || sp.a2 || (lum(main) > 0.5 ? '#1b1c22' : '#ffffff');
  let hsh = 0; for (const ch of String(m)) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
  const style = KEEPER_STYLE[m] || KEEPER_STYLE_POOL[hsh % KEEPER_STYLE_POOL.length];
  return { main, dark, light: darker(main, -0.15), trim, pants: darker(dark, 0.25), style };
}

// ---------- skater
function drawSkater(p) { return drawBodyFit(p.x, p.y, () => drawSkaterBody(p)); }
function drawSkaterBody(p, K) {   // K: a keeper's kit ({ C, glove, hands }): the same body as everyone else, in his own colours
  const C = K ? K.C : TEAM[p.team];
  toPSprite(p.x, p.y);
  ctx.fillStyle = 'rgba(30,50,90,.25)'; px(-8, 0, 16, 1); px(-6, 1, 12, 1);
  if (p.stun > 0 && p.stunType === 'trip') { drawTripped(p, C); return; }
  if (p.stun > 0 && p.stunType === 'slide') { drawSliding(p, C); return; }
  if (p.stun > 0 && p.stunType === 'small') ctx.translate((S.t >> 1) % 2 ? 0.75 : -0.75, 0);
  if (p.stun > 14 && p.stunType === 'big') { drawFlattened(p, C); return; }
  const back = p.fy < -0.35, sp = hyp(p.vx || 0, p.vy || 0);
  const la = sp > 0.3 ? Math.round(Math.sin(p.anim || 0) * 2) : 0;
  const pokeBoost = p.poke > 0 ? Math.sin((14 - p.poke) / 14 * Math.PI) * 8 : p.foSwipe > 0 ? Math.sin((10 - p.foSwipe) / 10 * Math.PI) * 5 : 0;   // (a faceoff swipe: a short jab at the dot)
  let ln = p.lunge > 0 ? Math.round(p.lungeDx * 3) : 0;
  if (p.wobble > 0) ln += ((p.wobble >> 2) & 1) ? 1 : -1;
  if (p.dkFake > 0 && p.dkMove) ln += Math.round(rightOf(p).x * p.dkMove.dir * (p.dkFake > 3 ? -2 : 2));
  const stickUp = typeof celebHoldsStick === 'function' && celebHoldsStick(p);
  const G = typeof gearOf === 'function' ? uniformGear(gearOf(p.pl), TEAM[p.team], p.g) : null, LK = p.pl && typeof lookOf === 'function' ? lookOf(p.pl) : null;
  const fighting = !!p.fight && !p.g;
  drawArms.lk = LK; drawArms.glove = K ? K.glove : null; drawArms.oglove = !K && G && G.gloves && G.gloves !== 'team' ? gearCol(G, 'gloves', C) : null;
  drawArms.gback = K && G ? ({ pro: C.trim, logo: TEAM[p.team] && TEAM[p.team].main, split: darker(K.glove || '#f4f4f6', 0.4), retro: '#d8c7a0' })[G.blocker] || null : null;   // a keeper's glove backs
  const geo = stickUp || fighting || K ? null : stickGeo(p, pokeBoost);
  if (geo) p._blade = { dx: (geo.rest.x + geo.dir * 2) * PSS * BODY_SX, dy: geo.rest.y * PSS * BODY_SY, t: S.t };   // where the tape is, for the puck (relative to him, so it never lags a frame)
  const windUp = !!(geo && geo.wind > 0.3), stickBehind = geo && (windUp ? !!geo.behindUs : back);   // wound up: hidden behind him going up the ice, across his chest coming down it
  if (stickBehind) drawStick(p, pokeBoost, geo);
  // SOCCER: boots, long socks, bare knees, shorts (the kicking foot lifts as he winds up a shot)
  const kick = geo && geo.wind > 0.3 ? 2 : 0;
  drawLegsKit(C, G, LK, [[-5 + la, 0], [1 - la, kick]]);
  drawShortsKit(C, G);
  // SOCCER: no stick in his hands: arms swing as he runs, and go out for balance as he winds up a kick
  let armHands = K && K.hands ? K.hands(ln) : geo && geo.wind > 0.3 ? [{ x: -12 + ln, y: -17 }, { x: 11 + ln, y: -16 }] : [{ x: -9 + ln, y: -13 + la }, { x: 8 + ln, y: -13 - la }];
  const celeb = !fighting && p.celebT > 0 && typeof drawCelebrationPose === 'function';
  if (fighting) {           // no gloves, no stick: one fist balled in his jersey, the other cocked or flying
    const d = (p.fx || 0) >= 0 ? 1 : -1, pose = p.fightPose || 'grab', w = Math.sin((S.t || 0) * 0.3);
    const grab = { x: d * 12 + ln, y: -18 + Math.round(w) };
    const free = pose === 'cock' ? { x: -d * 6 + ln, y: -21 } : pose === 'cockBig' ? { x: -d * 11 + ln, y: -23 } : pose === 'swing' ? { x: d * 14 + ln, y: -20 }
      : pose === 'swingBig' ? { x: d * 15 + ln, y: -22 } : pose === 'duck' ? { x: d * 3 + ln, y: -19 } : { x: d * 3 + ln, y: -21 + Math.round(w) };
    armHands = [grab, free];
  }
  if (back && !celeb && !(windUp && !geo.behindUs)) drawArms(C, G, ln, armHands, 0, true);
  // jersey
  const fit = G ? G.jersey : 'standard', jTop = -20 + (fit === 'tuck' ? 1 : 0), jH = fit === 'loose' ? 10 : fit === 'tuck' ? 8 : 9;
  for (let j = 0; j < jH; j++) for (let i = 0; i < 14; i++) { ctx.fillStyle = jerseyColor(C, i, j, 14, jH); ctx.fillRect(-7 + ln + i, jTop + j, 1, 1); }
  ctx.fillStyle = 'rgba(0,0,0,.12)'; px(-7 + ln, jTop, 1, jH); px(6 + ln, jTop, 1, jH);     // a little shading at the sides
  if (back) {
    ctx.save(); ctx.translate(ln, 0);
    // shoulder yoke and shoulder caps over the arms, then the number
    ctx.fillStyle = sleeveColor(C, 0); px(-8, -20, 16, 2);
    ctx.fillStyle = darker(sleeveColor(C, 0), 0.18); px(-8, -18, 2, 1); px(6, -18, 2, 1);
    ctx.fillStyle = C.main; px(-5, -18, 10, 6); drawDigits(ctx, p.num, 0, -17, 1, numColor(C));
    ctx.fillStyle = 'rgba(0,0,0,.10)'; px(-1, -12, 2, 1);
    { const pa = typeof teamPatch === 'function' ? teamPatch(C) : null; if (pa && pa.big) { ctx.fillStyle = pa.c; px(-3, -12, 6, 1); } }   // a large patch deal: the sponsor's bar on the back too
    ctx.restore();
  } else {
    drawCrest(C, -4 + ln, -19, 8);
    if (p.cap) { ctx.fillStyle = numColor(C); const L2 = p.cap === 'C' ? ['111', '100', '111'] : ['010', '111', '101']; L2.forEach((row, j) => [...row].forEach((b, i) => { if (b === '1') px(4 + ln + i, -19 + j, 1, 1); })); }
    if (fit === 'laces') { ctx.fillStyle = C.trim; px(-1 + ln, -20, 2, 1); ctx.fillStyle = '#eef1f6'; px(-1 + ln, -19, 1, 1); px(0 + ln, -18, 1, 1); }
    if (fit === 'polo') { ctx.fillStyle = C.trim; px(-3 + ln, -20, 2, 1); px(1 + ln, -20, 2, 1); ctx.fillStyle = darker(C.trim, 0.25); px(-1 + ln, -20, 2, 2); }
    const pa = typeof teamPatch === 'function' ? teamPatch(C) : null;   // sponsor patch on the chest (franchise deal)
    if (pa) { const pw = pa.big ? 3 : 2; ctx.fillStyle = pa.c2; px(3 + ln, -16, pw + 1, pw + 1); ctx.fillStyle = pa.c; px(3 + ln, -16, pw, pw); if (pa.big) { ctx.fillStyle = pa.c2; px(4 + ln, -15, 1, 1); } }   // upper right chest, under the letter
  }
  if (celeb) drawCelebrationPose(p, C, ln);
  else if (!back || (windUp && !geo.behindUs)) drawArms(C, G, ln, armHands);
  if (fighting) { ctx.fillStyle = skinOf(LK); for (const hd of armHands) px(Math.round(hd.x) - 1, Math.round(hd.y) - 1, 3, 3); ctx.fillStyle = darker(skinOf(LK), 0.2); for (const hd of armHands) px(Math.round(hd.x) - 1, Math.round(hd.y) + 1, 3, 1); }
  const al = typeof alienTeamOn === 'function' && alienTeamOn(p.team);
  drawHead(p, C, G, al ? { ...(LK || {}), alien: 1, beard: 0, style: 0 } : LK, ln, back);
  if (al) alienSkaterHead(p, ln, back);
  if (geo && !stickBehind) drawStick(p, pokeBoost, geo);
}
function drawHead(p, C, G, LK, ln, back) {
  // SOCCER: no helmet: his hair, and a headband if his gear has one
  const hv = G ? G.helmet : 'team', band = G ? gearCol(G, 'helmet', C) : C.helm, hc = hairOf(LK), style = LK ? LK.style : 0;
  // collar
  ctx.fillStyle = back ? C.dark : C.trim; px(-3 + ln, -21, 6, 1);
  if (!back) {
    ctx.fillStyle = skinOf(LK); px(-4 + ln, -26, 8, 5);
    ctx.fillStyle = darker(skinOf(LK), 0.15); px(-4 + ln, -22, 8, 1);
    ctx.fillStyle = skinOf(LK); px(-5 + ln, -24, 1, 2); px(4 + ln, -24, 1, 2);                                // ears
    const e = p.fx > 0.3 ? 1 : p.fx < -0.3 ? -1 : 0;
    ctx.fillStyle = '#20222b'; px(-2 + ln + e, -24, 1, 1); px(1 + ln + e, -24, 1, 1);
    const bd = LK ? LK.beard : 0;
    if (bd >= 2) { ctx.fillStyle = hc; if (bd === 2) px(-2 + ln, -23, 4, 1); else if (bd === 3) px(-1 + ln, -22, 2, 2); else px(-4 + ln, -23, 8, 2); }
    ctx.fillStyle = hc;
    if (style === 5) { ctx.fillStyle = darker(skinOf(LK), 0.12); px(-4 + ln, -28, 8, 2); ctx.fillStyle = hc; px(-1 + ln, -31, 2, 4); }   // mohawk: shaved sides, a crest
    else if (style === 7) { ctx.fillStyle = darker(skinOf(LK), 0.1); px(-3 + ln, -29, 6, 1); px(-4 + ln, -28, 8, 2); }                 // shaved
    else { px(-3 + ln, -29, 6, 1); px(-4 + ln, -28, 8, 2); px(-4 + ln, -26, 1, 1); px(3 + ln, -26, 1, 1); if (style === 6) px(-1 + ln, -31, 3, 2); }   // hair (man bun: a knot on top)
    if (style === 1 || style === 3) { px(-5 + ln, -27, 1, 4); px(4 + ln, -27, 1, 4); }                         // long at the sides
    if (style === 2) { px(-5 + ln, -28, 1, 2); px(4 + ln, -28, 1, 2); px(-2 + ln, -30, 4, 1); }                 // curls
  } else {
    ctx.fillStyle = skinOf(LK); px(-4 + ln, -23, 8, 2); px(-5 + ln, -25, 1, 2); px(4 + ln, -25, 1, 2);
    ctx.fillStyle = style === 7 || style === 5 ? darker(skinOf(LK), 0.12) : hc; px(-3 + ln, -29, 6, 1); px(-4 + ln, -28, 8, 5);
    ctx.fillStyle = hc; if (style === 5) px(-1 + ln, -31, 2, 7); if (style === 6) px(-1 + ln, -31, 3, 3);
    if (style === 1) px(-3 + ln, -23, 6, 2);                     // the mullet
    else if (style === 3) px(-4 + ln, -23, 8, 3);
  }
  if (style !== 7) { ctx.fillStyle = 'rgba(255,255,255,.18)'; px(-2 + ln, -29, 2, 1); }
  const ex = G ? G.visor : 'none';
  if (ex === 'snood') { ctx.fillStyle = '#1b1c22'; px(-3 + ln, -22, 6, 2); }                                   // a snood round the neck
  if (ex === 'cap') { ctx.fillStyle = C.dark || '#1b1c22'; px(-4 + ln, -30, 8, 3); ctx.fillStyle = darker(C.dark || '#1b1c22', 0.3); if (!back) px(-5 + ln, -27, 10, 1); return; }   // a keeper's cap (and its peak)
  if (hv && hv !== 'team') {                                                                                     // a headband
    ctx.fillStyle = band; px(-4 + ln, -27, 8, 1);
    if (hv === 'stripe') { ctx.fillStyle = C.trim; px(-1 + ln, -27, 2, 1); }
    if ((hv === 'chrome' || hv === 'gold') && (S.t >> 4) & 1) { ctx.fillStyle = '#ffffff'; px(-2 + ln, -27, 1, 1); }
  }
}
// SOCCER: sliding in, feet first along the grass (the leading boot toward the ball), turf flying behind
function drawSliding(p, C) {
  const LK = p.pl && typeof lookOf === 'function' ? lookOf(p.pl) : null, G = typeof gearOf === 'function' ? uniformGear(gearOf(p.pl), C, false) : null;
  const d = (p.fx || 0) >= 0 ? 1 : -1, L = (x, y, w, h) => px(d > 0 ? x : -x - w, y, w, h);
  const sk = G ? gearCol(G, 'skates', C) : '#1d1f27', sockC = G && G.socks === 'dark' ? C.dark : G && G.socks === 'white' ? '#eef1f6' : C.main;
  if ((p.slide || 0) > 4) { ctx.fillStyle = 'rgba(120,90,50,.6)'; L(-16 - (S.t % 3), -2, 3, 1); L(-19, -4, 2, 1); ctx.fillStyle = 'rgba(150,210,110,.7)'; L(-17, -5, 1, 1); L(-14, -1, 1, 1); }
  ctx.fillStyle = sk; L(13, -5, 4, 2); L(9, -2, 4, 2);                  // boots, the front one leading
  ctx.fillStyle = sockC; L(8, -5, 5, 2); L(5, -2, 4, 2);
  ctx.fillStyle = skinOf(LK); L(6, -5, 2, 2); L(3, -2, 2, 2);
  ctx.fillStyle = C.pants; L(-1, -6, 7, 5);                              // shorts
  for (let j = 0; j < 6; j++) for (let i = 0; i < 9; i++) { ctx.fillStyle = jerseyColor(C, i, j, 9, 6); L(-10 + i, -10 + j + (i > 6 ? 1 : 0), 1, 1); }   // shirt, leaning back
  ctx.fillStyle = skinOf(LK); L(-13, -12, 2, 4);                         // the trailing arm down for balance
  ctx.fillStyle = skinOf(LK); L(-15, -15, 5, 5); ctx.fillStyle = hairOf(LK); L(-15, -16, 5, 2); L(-16, -15, 1, 3);   // head
  ctx.fillStyle = '#20222b'; L(-12, -13, 1, 1);
}
// leveled by a big hit: flat on the ice, seeing stars
// flat on the ice after a big hit: sprawled out with his stick knocked away, birdies round the helmet; near the end
// he's up on his hands and knees, shaking it off, before he gets back on his skates
function drawLying(p, C, slide = 0) {
  const s = p.fallSide || (p.vx >= 0 ? 1 : -1);
  const L = (x, y, w = 1, h = 1) => px(s > 0 ? x + slide : -x - w - slide, y, w, h);
  const G = typeof gearOf === 'function' ? uniformGear(gearOf(p.pl), C, p.g) : null;
  const sk = G ? gearCol(G, 'skates', C) : '#1d1f27', glove = C.dark || darker(C.main, 0.35);
  ctx.fillStyle = 'rgba(30,50,90,.28)'; L(-15, 0, 29, 2);                                  // his shadow on the ice
  ctx.fillStyle = 'rgba(120,90,50,.55)'; L(-18, 1, 5, 1); L(-20, -1, 2, 1);                // a little turf kicked up behind him
  // skates and socks (legs out behind him, one bent)
  ctx.fillStyle = sk; L(-16, -2, 4, 3); L(-15, -6, 4, 3);
  ctx.fillStyle = C.main; L(-12, -2, 4, 3); L(-11, -6, 4, 3);
  ctx.fillStyle = C.trim; L(-10, -2, 1, 3); L(-9, -6, 1, 3);
  // breezers
  ctx.fillStyle = C.pants; L(-8, -6, 6, 7); ctx.fillStyle = darker(C.pants, 0.3); L(-8, 0, 6, 1);
  ctx.fillStyle = C.trim; L(-8, -3, 6, 1);
  // the jersey, number on his back
  ctx.fillStyle = C.main; L(-2, -7, 10, 8);
  ctx.fillStyle = darker(C.main, 0.22); L(-2, 0, 10, 1);
  ctx.fillStyle = C.trim; L(-2, -2, 10, 1); L(6, -7, 1, 8);
  ctx.fillStyle = darker(C.main, 0.12); L(0, -7, 5, 1);                                     // shoulder yoke
  // arms: one flung out ahead past the helmet, one tucked under him
  ctx.fillStyle = C.main; L(7, -9, 5, 2); ctx.fillStyle = glove; L(12, -10, 3, 3);
  ctx.fillStyle = darker(C.main, 0.3); L(1, 1, 5, 1); ctx.fillStyle = glove; L(6, 1, 2, 1);
  // his head, face down in the grass
  ctx.fillStyle = (hairOf(p.pl && typeof lookOf === 'function' ? lookOf(p.pl) : null)); L(8, -6, 6, 6); ctx.fillStyle = 'rgba(255,255,255,.25)'; L(9, -6, 2, 1);
}
function drawFlattened(p, C) {
  if (p.stun > 40) {
    drawLying(p, C);
    // birdies circling the helmet
    const s = p.fallSide || (p.vx >= 0 ? 1 : -1), hx = s * 11, t = S.t * 0.12;
    for (let k = 0; k < 3; k++) { const a = t + k * 2.09, bx = hx + Math.cos(a) * 6, by = -12 + Math.sin(a) * 2;
      ctx.fillStyle = k === 1 ? '#ffffff' : '#ffd23f'; px(Math.round(bx), Math.round(by)); px(Math.round(bx) - 1, Math.round(by)); px(Math.round(bx) + 1, Math.round(by)); px(Math.round(bx), Math.round(by) - 1); }
    return;
  }
  // on his hands and knees, head hanging, shaking it off
  const s = p.fallSide || (p.vx >= 0 ? 1 : -1), L = (x, y, w = 1, h = 1) => px(s > 0 ? x : -x - w, y, w, h);
  const sh = ((S.t >> 3) & 1) ? 1 : 0, glove = C.dark || darker(C.main, 0.35);
  ctx.fillStyle = 'rgba(30,50,90,.28)'; L(-12, 0, 24, 2);
  ctx.fillStyle = '#1d1f27'; L(-13, -2, 4, 2);                                                             // boot, toe in the grass
  ctx.fillStyle = C.main; L(-9, -4, 3, 4); ctx.fillStyle = C.trim; L(-8, -4, 1, 4);                       // shin down
  ctx.fillStyle = C.pants; L(-7, -9, 6, 6); ctx.fillStyle = C.trim; L(-7, -6, 6, 1);                      // hips up
  ctx.fillStyle = C.main; L(-1, -10, 9, 6); ctx.fillStyle = C.trim; L(-1, -6, 9, 1);                      // back, arched
  ctx.fillStyle = C.main; L(6, -6, 2, 5); ctx.fillStyle = glove; L(6, -1, 3, 1);                          // arm propping him up
  ctx.fillStyle = (hairOf(p.pl && typeof lookOf === 'function' ? lookOf(p.pl) : null)); L(8 + sh, -8, 5, 5);                                                   // head down, shaking
}
// tripped: stagger, go down, slide, climb back up
function drawTripped(p, C) {
  const f = (p.fall = (p.fall || 0) + 1), s = p.fallSide || 1, left = p.stun;
  if (f < 9) {
    const tilt = Math.round(f / 2) * s;
    ctx.fillStyle = C.pants; px(-5 + tilt, -7, 10, 6);
    ctx.fillStyle = C.main; px(-6 + tilt, -15, 12, 8);
    ctx.fillStyle = C.trim; px(-6 + tilt, -10, 12, 1);
    ctx.fillStyle = C.main; px(-12 + tilt, -17, 6, 3); px(6 + tilt, -17, 6, 3);
    ctx.fillStyle = (hairOf(p.pl && typeof lookOf === 'function' ? lookOf(p.pl) : null)); px(-4 + tilt * 2, -22, 8, 7);
    ctx.fillStyle = '#1d1f27'; px(-6, -1, 5, 2); px(2, -1, 5, 2);
  } else if (left > 14) {
    const sl = Math.min(4, (f - 9) >> 2);
    drawLying(p, C, sl);                                              // sliding on his front, then still
  } else {
    const up = Math.round((14 - left) * 1.5);
    ctx.fillStyle = C.pants; px(-5, -5 - up, 10, 5 + up);
    ctx.fillStyle = C.main; px(-6, -11 - up, 12, 7);
    ctx.fillStyle = C.trim; px(-6, -6 - up, 12, 1);
    ctx.fillStyle = (hairOf(p.pl && typeof lookOf === 'function' ? lookOf(p.pl) : null)); px(-4, -18 - up, 8, 7);
    ctx.fillStyle = '#1d1f27'; px(-6, -1, 5, 2); px(2, -1, 5, 2);
  }
}

// ---------- goalie (SOCCER: the goalkeeper: his own colour of shirt, big gloves, no pads, no mask, no stick)
function keeperKit(C, team) {
  const opts = team === 0 ? ['#f2c230', '#3ec46a', '#ff8a2b', '#b45cf0'] : ['#3ec46a', '#ff8a2b', '#f2c230', '#b45cf0'];
  const far = c => typeof colorDist !== 'function' || ((!TEAM[0] || colorDist(c, TEAM[0].main) > 120) && (!TEAM[1] || colorDist(c, TEAM[1].main) > 120));
  const m = opts.find(far) || opts[0];
  return { main: m, dark: darker(m, 0.3), light: darker(m, -0.15), trim: C.main, pants: C.dark || '#1d1f27' };
}
function drawGoalie(p) { return drawBodyFit(p.x, p.y, () => drawGoalieRaw(p)); }
function drawGoalieRaw(p) {
  const C = TEAM[p.team], G = typeof gearOf === 'function' ? gearOf(p.pl) : null, KK = keeperShirt(G, C, p.team);   // SOCCER: his shirt design
  const LK = p.pl && typeof lookOf === 'function' ? lookOf(p.pl) : null, sk = skinOf(LK), hc = hairOf(LK);
  toPSprite(p.x, p.y);
  const fr = (typeof goalieCatch === 'function' ? goalieCatch(p.pl || (p.hand ? { hand: p.hand } : null)) : 'L') === 'R';
  if (p.gTurn && !p.down && !p.covering && S.screen !== 'replay') ctx.rotate(p.gTurn);
  if (fr) ctx.scale(-1, 1);
  ctx.fillStyle = 'rgba(20,40,20,.25)'; px(-12, 0, 24, 1); px(-10, 1, 20, 1);
  const gl = G && G.gloves && G.gloves !== 'team' ? gearCol(G, 'gloves', C) : '#f4f4f6', glD = darker(gl, 0.28);
  const glove = (x, y) => { ctx.fillStyle = gl; px(x, y, 5, 5); ctx.fillStyle = glD; px(x, y + 4, 5, 1); px(x + 1, y + 2, 3, 1); ctx.fillStyle = KK.trim; px(x, y + 5, 5, 1); };
  const shirt = (x, y, w, h) => {
    for (let j = 0; j < h; j++) { ctx.fillStyle = j === 0 ? KK.light : j === h - 1 ? KK.dark : KK.main; px(x, y + j, w, 1); }
    ctx.fillStyle = 'rgba(0,0,0,.12)'; px(x, y + 1, 1, h - 1); px(x + w - 1, y + 1, 1, h - 1);
  };
  const head = (x, y, back) => {
    ctx.fillStyle = sk; px(x, y, 8, 6); px(x - 1, y + 2, 1, 2); px(x + 8, y + 2, 1, 2);
    ctx.fillStyle = hc; px(x + 1, y - 2, 6, 1); px(x, y - 1, 8, back ? 6 : 2);
    if (!back) { ctx.fillStyle = '#20222b'; px(x + 2, y + 3, 1, 1); px(x + 5, y + 3, 1, 1); }
  };
  const ball = (x, y) => { ctx.fillStyle = '#ffffff'; px(x, y, 4, 4); ctx.fillStyle = '#1b1d24'; px(x + 1, y + 1, 1, 1); px(x + 3, y + 2, 1, 1); ctx.fillStyle = 'rgba(0,0,0,.18)'; px(x, y + 3, 4, 1); };
  const legs = (x0, x1, y) => {
    for (const lx of [x0, x1]) {
      ctx.fillStyle = sk; px(lx, y - 8, 4, 2);
      ctx.fillStyle = KK.dark; px(lx, y - 6, 4, 4); ctx.fillStyle = KK.trim; px(lx, y - 6, 4, 1);
      ctx.fillStyle = '#1d1f27'; px(lx, y - 2, 5, 2); ctx.fillStyle = '#3a3d48'; px(lx, y - 2, 5, 1);
    }
  };
  // standing (and gathering it in): exactly an outfield player's body, in the keeper's shirt, with his gloves
  if (!(p.down > 0)) {
    const KC = Object.assign({}, C, { main: KK.main, dark: KK.dark, trim: KK.trim, pants: KK.pants, style: KK.style });   // his keeper shirt (plain, or his design)
    let co = { x: 0, y: 0 }, bo = { x: 0, y: 0 };
    const sa = p.saveAnim, age = sa ? S.t - sa.t0 : 99, held = hasPuck(p) || p.covering > 0;
    if (sa && age >= 0 && age < 20 && S.screen !== 'replay') {
      const k = age < 4 ? age / 4 : age < 13 ? 1 : (20 - age) / 7, side = fr ? -1 : 1;
      if (sa.kind === 'glove') co = { x: Math.round(6 * k) * side, y: Math.round((sa.hi ? -9 : -3) * k) };
      else bo = { x: Math.round(-6 * k) * side, y: Math.round((sa.hi ? -8 : -2) * k) };
    }
    const hands = held ? () => [{ x: -3, y: -15 }, { x: 3, y: -15 }]
      : ln => [{ x: -11 + ln + bo.x, y: -15 + bo.y }, { x: 10 + ln + co.x, y: -15 + co.y }];   // the ready stance: gloves out
    drawSkaterBody(p, { C: KC, glove: gl, hands });   // (sets its own transform)
    if (held) ball(-2, -16);
    if (p.poke > 0) {                                                                 // rushing out: a long leg out to block
      const r = 6 + Math.sin((16 - p.poke) / 16 * Math.PI) * 12, ex = Math.round(p.fx * r), ey = Math.round(p.fy * r * 0.85);
      ctx.fillStyle = KK.dark; pxLine(2, -3, ex, ey); ctx.fillStyle = '#1d1f27'; px(ex - 1, ey - 1, 3, 2);
    }
    if ((p.press || 0) > 0.35) { const k = (S.t >> 2) % 6; ctx.fillStyle = '#bfe6ff'; px(-7 - (k >> 1), -31 + k, 1, 1); px(7 + (k >> 1), -32 + k, 1, 1); }
    return;
  }
  if (p.down > 0) {                                                           // full stretch along the ground, sideways: a dive
    const d = (p.vx || 0) < -0.05 ? -1 : (p.vx || 0) > 0.05 ? 1 : (puck.x < p.x ? -1 : 1), L = (x, y, w, h) => px(d > 0 ? x : -x - w, y, w, h);
    if (fr) ctx.scale(-1, 1);                                                  // (the dive goes the way he's going, not the glove hand)
    ctx.fillStyle = '#1d1f27'; L(-23, -9, 3, 2); L(-22, -5, 3, 2);            // boots
    ctx.fillStyle = KK.dark; L(-20, -9, 5, 2); L(-19, -5, 5, 2);               // socks
    ctx.fillStyle = KK.trim; L(-16, -9, 1, 2); L(-15, -5, 1, 2);
    ctx.fillStyle = sk; L(-15, -9, 2, 2); L(-14, -5, 2, 2);                    // knees
    ctx.fillStyle = KK.pants; L(-13, -10, 7, 7);                               // shorts
    ctx.fillStyle = KK.main; L(-6, -11, 10, 8); ctx.fillStyle = KK.dark; L(-6, -4, 10, 1); ctx.fillStyle = KK.light; L(-6, -11, 10, 1);   // shirt, side on
    ctx.fillStyle = KK.trim; L(3, -10, 1, 6);                                  // collar
    ctx.fillStyle = sk; L(4, -10, 5, 5); ctx.fillStyle = hc; L(4, -11, 5, 1); L(4, -10, 1, 3);   // head
    ctx.fillStyle = '#20222b'; L(7, -8, 1, 1);
    ctx.fillStyle = KK.main; L(3, -13, 9, 2); L(3, -4, 8, 2);                  // arms out at full stretch
    ctx.fillStyle = gl; L(12, -14, 3, 3); L(11, -5, 3, 3);                     // gloves
    if (hasPuck(p)) ball(d > 0 ? 13 : -17, -11);
    return;
  }
}
// back views of the goalie's gear
function drawBlockerBack(x, y, bc, C) {                // the hand side: a padded glove with fingers and a cuff
  const P = (a, b, w = 1, h = 1) => px(x + a, y + b, w, h), gl = darker(bc, 0.12);
  ctx.fillStyle = darker(bc, 0.4); P(1, 1, 8, 11);
  ctx.fillStyle = gl; P(2, 2, 6, 9);
  ctx.fillStyle = darker(bc, 0.3); for (let k = 3; k < 8; k += 2) P(k, 2, 1, 4);   // finger rolls
  ctx.fillStyle = shade(bc, 0.2); P(2, 2, 6, 1);
  ctx.fillStyle = C.main; P(2, 9, 6, 1); ctx.fillStyle = darker(bc, 0.2); P(2, 10, 6, 1);
}
function drawCatcherBack(style, x, y, cc, C, coloured) {   // the back of the mitt: finger shell, thumb, cuff (no pocket)
  if (style === 'retro' && !coloured) cc = '#8a5a2b';
  const rows = CATCHERS[style] || CATCHERS.classic, out = darker(cc, 0.45);
  x -= 1; y -= 1;
  ctx.fillStyle = out;
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.') { px(x + i - 1, y + j, 3, 1); px(x + i, y + j - 1, 1, 3); } });
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const k = r[i]; if (k === '.') continue; ctx.fillStyle = k === 'C' ? darker(cc, -0.15) : k === 'S' ? C.main : k === 'W' ? darker(cc, 0.2) : k === 'T' ? darker(cc, 0.08) : cc; px(x + i, y + j, 1, 1); } });
  ctx.fillStyle = darker(cc, 0.25); for (let k = 2; k < 8; k += 2) px(x + k, y + 3, 1, 5);                 // the finger stalls
  ctx.fillStyle = shade(cc, 0.25); px(x + 1, y + 3, 1, 4);
}
// the back of the mask: the shell and its paint, the strap and the back plate
function drawGoalieMaskBack(G, C, ox, oy) {
  let m = G ? G.mask : 'team'; if (m === 'team' || !MASK_KEEP.has(m)) m = MASK_DEFAULT;
  const sp = maskSpec(m, C, G), P = (x, y, w = 1, h = 1) => px(ox + x, oy + y, w, h);
  const span = (y, c, x0 = 0, x1 = 10) => { const [s0, n] = MASK_ROWS[y]; const a = Math.max(s0, x0), b = Math.min(s0 + n, x1); if (b > a) { ctx.fillStyle = c; P(a, y, b - a, 1); } };
  const base = sp.b === 'bucket' ? (sp.shell || '#e8ecf2') : null;
  for (let y = 0; y < 10; y++) { if (base && y >= 4) span(y, base); else { span(y, sp.L, 0, 5); span(y, sp.R, 5, 10); } }
  ctx.fillStyle = darker(sp.b === 'bucket' ? sp.L : sp.R, 0.35); for (let y = 0; y < 10; y++) { const [s0, n] = MASK_ROWS[y]; P(s0, y); P(s0 + n - 1, y); } P(3, 0, 4, 1); P(3, 9, 4, 1);
  ctx.fillStyle = sp.ridge; P(4, 0, 2, sp.b === 'bucket' ? 3 : 5);                                         // the stripe carries over the top
  if (sp.b === 'bucket') { ctx.fillStyle = darker(sp.L, 0.3); P(0, 3, 10, 1); }
  ctx.fillStyle = '#20222b'; P(1, 5, 8, 1);                                                                // the strap
  ctx.fillStyle = '#c9ced8'; P(3, 6, 4, 3); ctx.fillStyle = '#8a93a3'; P(3, 8, 4, 1); P(4, 6, 2, 1);       // back plate
  ctx.fillStyle = shade(sp.L, 0.25); P(2, 2, 2, 1);
}
// ---------- goalie equipment styles (colours still come from the GLOVES / STICK / TAPE parts)
// blocker: 10 x 13 at (x, y), the stick hand (the same size as the catcher)
function drawBlocker(style, x, y, bc, bf, C, coloured) {
  const P = (a, b, w = 1, h = 1) => px(x + a, y + b, w, h), tt = C.trim || '#ffffff', W = 10, H = 13;
  if (style === 'retro' && !coloured) { bc = '#7a4a1b'; bf = '#9a6a35'; }
  const out = darker(bc, 0.35), cuffC = darker(bc, 0.15);
  // the board: outline, body, a lit edge, the shaded side, the cuff at the bottom
  const board = (r0) => { ctx.fillStyle = out; P(r0 ? 1 : 0, 0, W - (r0 ? 1 : 0), H); if (r0) P(0, 1, 1, H - 2); ctx.fillStyle = bc; P(1, 1, W - 2, H - 2); ctx.fillStyle = shade(bc, 0.2); P(1, 1, W - 2, 1); P(1, 1, 1, H - 4); ctx.fillStyle = darker(bc, 0.18); P(W - 2, 2, 1, H - 4); };
  switch (style) {
    case 'pro':      // curved face, the thumb guard down the inside edge, a team swoosh across the face
      board(true); ctx.fillStyle = bf; P(2, 2, 6, 7); P(1, 3, 1, 5);
      ctx.fillStyle = tt; P(2, 8, 1, 1); P(3, 7, 1, 1); P(4, 6, 1, 1); P(5, 5, 1, 1); P(6, 4, 1, 1); P(7, 3, 1, 1);
      ctx.fillStyle = shade(bf, 0.25); P(2, 2, 2, 1); ctx.fillStyle = darker(bc, 0.3); P(W - 1, 2, 1, H - 4);
      ctx.fillStyle = cuffC; P(1, H - 3, W - 2, 1); ctx.fillStyle = C.main; P(1, H - 2, W - 2, 1); break;
    case 'logo':     // the face carries a round team badge
      board(false); ctx.fillStyle = C.main; P(3, 2, 4, 8); P(2, 3, 6, 6); ctx.fillStyle = tt; P(3, 4, 4, 4); P(4, 3, 2, 6); ctx.fillStyle = C.dark; P(4, 5, 2, 2);
      ctx.fillStyle = cuffC; P(1, H - 2, W - 2, 1); break;
    case 'retro':    // flat leather board with stitching round the edge
      ctx.fillStyle = out; P(0, 1, W, H - 2); ctx.fillStyle = bc; P(1, 2, W - 2, H - 4);
      ctx.fillStyle = shade(bc, 0.3); for (let k = 1; k < W - 1; k += 2) { P(k, 2); P(k, H - 3); } for (let k = 4; k < H - 3; k += 2) { P(1, k); P(W - 2, k); }
      ctx.fillStyle = '#5a3412'; P(1, H - 2, W - 2, 1); break;
    case 'split':    // two-tone halves split down the middle, a trim stripe between
      board(false); ctx.fillStyle = C.main; P(1, 1, 4, H - 3); ctx.fillStyle = C.dark; P(5, 1, 4, H - 3);
      ctx.fillStyle = tt; P(5, 1, 1, H - 3); ctx.fillStyle = shade(C.main, 0.25); P(1, 1, 1, 4);
      ctx.fillStyle = cuffC; P(1, H - 2, W - 2, 1); break;
    default:         // classic: the board with a team panel and the cuff
      board(false); ctx.fillStyle = bf; P(2, 2, 6, 7); ctx.fillStyle = tt; P(2, 6, 6, 1); ctx.fillStyle = shade(bf, 0.2); P(2, 2, 6, 1);
      ctx.fillStyle = cuffC; P(1, H - 3, W - 2, 2);
  }
}
// catching glove, 11 x 13 at (x, y), seen from the front: the web and T-trap at the top between the thumb and the
// finger shell, the deep pocket, the long finger shell down the outside, the thumb down the inside, the wide cuff.
// Legend: W web, P pocket, O finger shell, T thumb, C cuff, S cuff stripe, . empty
const CATCHERS = {
  classic: ['..WWW......', '.WWWWW.....', '.WWWWWOOO..', 'TWWWWWOOOO.', 'TPPPPPOOOOO', 'TPPPPPOOOOO', 'TPPPPPOOOOO', '.TPPPPOOOOO', '.TTPPPOOOO.', '..CCCCCCCC.', '..SSSSSSSS.', '..CCCCCCCC.', '...CCCCCC..'],
  pro:     ['.WWW.......', 'WWWWWW.....', 'WWWWWWOOOO.', 'TWWWWWOOOOO', 'TPPPPPOOOOO', 'TPPPPPOOOOO', 'TPPPPPOOOOO', 'TPPPPPOOOOO', '.TPPPPOOOO.', '.CCCCCCCCC.', '.SSSSSSSSS.', '.CCCCCCCCC.', '..CCCCCCC..'],
  hweb:    ['..WWWW.....', '.WWWWWW....', '.WWWWWWOO..', 'TWWWWWWOOO.', 'TPPPPPPOOOO', 'TPPPPPPOOOO', 'TPPPPPPOOOO', '.TPPPPPOOOO', '.TTPPPPOOO.', '..CCCCCCCC.', '..SSSSSSSS.', '..CCCCCCCC.', '...CCCCCC..'],
  stripe:  ['..WWW......', '.WWWWW.....', '.WWWWWOOO..', 'TWWWWWOOOO.', 'TPPPPPOOOOO', 'TPPPPPOSSOO', 'TPPPPPSSOOO', '.TPPPSSOOOO', '.TTPSSOOOO.', '..CCCCCCCC.', '..SSSSSSSS.', '..CCCCCCCC.', '...CCCCCC..'],
  retro:   ['...........', '...OOOOO...', '..OWWWWOO..', '.TWWWWWOOO.', '.TPPPPPOOO.', 'TTPPPPPOOO.', 'TTPPPPPOOO.', '.TTPPPPOO..', '..TTPPOOO..', '...CCCCC...', '...CCCCC...', '...........', '...........'],
};
function drawCatcher(style, x, y, cc, C, coloured) {
  const rows = CATCHERS[style] || CATCHERS.classic;
  if (style === 'retro' && !coloured) cc = '#8a5a2b';
  const cd = darker(cc, 0.32), out = darker(cc, 0.45), lace = style === 'retro' ? '#f1e3b5' : '#ffffff';
  const cuff = style === 'retro' ? darker(cc, 0.15) : darker(cc, -0.15), stripe = style === 'retro' ? cuff : C.main;
  const col = { W: darker(cc, 0.12), P: cd, O: cc, T: darker(cc, 0.08), C: cuff, S: stripe };
  x -= 1; y -= 1;
  // outline, then the fill
  ctx.fillStyle = out;
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.') { px(x + i - 1, y + j, 3, 1); px(x + i, y + j - 1, 1, 3); } });
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const k = r[i]; if (k !== '.') { ctx.fillStyle = col[k]; px(x + i, y + j, 1, 1); } } });
  // lacing on the web
  ctx.fillStyle = lace;
  if (style === 'pro') { px(x + 1, y + 1, 5, 1); px(x + 3, y + 1, 1, 4); }                               // single-T
  else if (style === 'hweb') { px(x + 2, y + 1, 1, 4); px(x + 5, y + 1, 1, 4); px(x + 2, y + 2, 4, 1); }   // H-web
  else if (style === 'retro') { px(x + 3, y + 3, 4, 1); px(x + 5, y + 2, 1, 3); for (let k = 3; k < 9; k += 2) px(x + 2, y + k, 1, 1); }
  else { px(x + 2, y + 1, 4, 1); px(x + 3, y + 1, 1, 4); px(x + 2, y + 3, 1, 1); px(x + 4, y + 3, 1, 1); }  // T-trap
  // shading: the finger shell's roll and break lines, shine on the thumb, the pocket's depth
  ctx.fillStyle = darker(cc, 0.2); px(x + 8, y + 4, 1, 4); px(x + 7, y + 3, 1, 1);
  ctx.fillStyle = shade(cc, 0.28); px(x, y + 4, 1, 2); px(x + 7, y + 2, 2, 1);
  ctx.fillStyle = darker(cc, 0.45); px(x + 3, y + 5, 2, 2);
  if (style === 'pro') { ctx.fillStyle = C.trim || '#ffffff'; px(x + 9, y + 5, 1, 3); }                  // logo flash on the shell
}
// goalie stick at double resolution (half sprite pixels, so the diagonal is smooth): the shaft runs under the
// blocker, the wide paddle comes out from under it and sweeps diagonally down toward the middle, then a short blade
// lies flat on the ice. The style paints the paddle; colours come from STICK and TAPE.
function drawGoalieStick(style, sc, tc, C) {
  const sd = darker(sc, 0.28), sl = darker(sc, -0.2), tt = C.trim || '#ffffff';
  ctx.save(); ctx.scale(0.5, 0.5);
  // shaft (mostly hidden under the blocker): 3 half-pixels wide
  for (let y = -46; y <= -26; y++) { const x = Math.round(-42 + (y + 46) * 0.62); ctx.fillStyle = sd; ctx.fillRect(x + 2, y, 1, 1); ctx.fillStyle = sc; ctx.fillRect(x, y, 2, 1); }
  if (style === 'retro') { ctx.fillStyle = tc; ctx.fillRect(-44, -48, 5, 4); }
  // paddle: 7 half-pixels wide, from under the blocker (-30,-26) down to (-14,-4)
  const y0 = -26, y1 = -4;
  for (let y = y0; y <= y1; y++) {
    const t = (y - y0) / (y1 - y0), x = Math.round(-31 + t * 16);
    let main = sc;
    if (style === 'pro') main = t < 0.3 ? C.main : t < 0.38 ? tt : sc;
    else if (style === 'flag') main = t < 0.5 ? C.main : tt;
    ctx.fillStyle = main; ctx.fillRect(x, y, 7, 1);
    ctx.fillStyle = sl; ctx.fillRect(x, y, 1, 1);
    ctx.fillStyle = sd; ctx.fillRect(x + 6, y, 1, 1);
    if (style === 'carbon' && (y & 3) === 0) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x + 2, y, 2, 1); }
    if (style === 'retro' && (y % 5) === 0) { ctx.fillStyle = shade(sc, -0.3); ctx.fillRect(x + 2, y, 3, 1); }
  }
  if (style === 'pro') { ctx.fillStyle = C.main; ctx.fillRect(-18, -8, 6, 1); }
  // blade: heel curls out of the paddle, toe lies flat to the right
  ctx.fillStyle = sc; ctx.fillRect(-17, -5, 8, 2); ctx.fillRect(-17, -3, 22, 3); ctx.fillStyle = sd; ctx.fillRect(-16, 0, 21, 1);
  // tape wrapped round the blade from heel to toe: diagonal turns, each with a lighter/darker seam so the wraps read
  const seam = lum(tc) > 0.5 ? darker(tc, 0.5) : shade(tc, 0.55);
  for (let x = -12; x <= 4; x++) for (let y = -4; y <= 0; y++) {
    if (y === -4 && x > -9) continue;
    ctx.fillStyle = ((x + y + 40) % 4 === 0) ? seam : tc; ctx.fillRect(x, y, 1, 1);
  }
  if (style === 'pro') { ctx.fillStyle = C.main; ctx.fillRect(4, -3, 2, 3); }
  ctx.restore();
}
// goalie masks: 10 x 10 sprite pixels at (ox, oy). Two builds, and every design is painted on one of them:
//  SPLIT  - a moulded mask, two-tone halves with a raised ridge down the middle and a straight-bar cage
//  BUCKET - a helmet with a band and ear clips over a wide open wire cage (the old-school combo)
const MASK_DEFAULT = 'split';
const MASK_ROWS = [[3, 4], [2, 6], [1, 8], [0, 10], [0, 10], [0, 10], [0, 10], [1, 8], [2, 6], [3, 4]];
// design -> build, the two halves, the ridge/band colour (C = team palette)
function maskSpec(m, C, G) {
  const base = maskSpec0(m, C), cu = typeof maskCustom === 'function' ? maskCustom(G, m) : null;
  if (!cu) return base;
  const out = Object.assign({}, base); for (const k of ['L', 'R', 'ridge', 'a', 'a2', 'cage', 'eye', 'shell']) if (cu[k]) out[k] = cu[k];
  return out;
}
function maskSpec0(m, C) {
  const tm = C.main, td = C.dark, tt = C.trim || '#ffffff';
  if (typeof MASKS_X !== 'undefined' && MASKS_X[m]) return MASKS_X[m].spec(C);
  return ({
    split:     { b: 'split', L: tm, R: td, ridge: tt },
    bucket:    { b: 'bucket', L: tm, R: tm, ridge: tt },
    white:     { b: 'split', L: '#f4f4f4', R: '#d6dbe4', ridge: '#ffffff' },
    skull:     { b: 'split', L: '#ece6d6', R: '#cfc6b0', ridge: '#f8f4ea' },
    tiger:     { b: 'split', L: '#f2a51a', R: '#d9850c', ridge: '#1b1c22' },
    flame:     { b: 'split', L: '#22232b', R: '#121318', ridge: '#ff6a1f' },
    shark:     { b: 'split', L: '#8a99ae', R: '#6a7890', ridge: '#4a5466' },
    lightning: { b: 'split', L: '#22232b', R: '#121318', ridge: '#ffd23f' },
    star:      { b: 'split', L: '#1b2a5c', R: '#121d42', ridge: '#ffd23f' },
    galaxy:    { b: 'split', L: '#1e1846', R: '#0e1030', ridge: '#b07aff' },
    laststand: { b: 'split', L: '#3a3d46', R: '#22242b', ridge: '#c8a03a' },
    chrome:    { b: 'split', L: '#e2e7ef', R: '#a8b1c0', ridge: '#ffffff' },
    gold:      { b: 'split', L: '#f2c230', R: '#c99a10', ridge: '#fff3a0' },
    retro:     { b: 'bucket', L: '#a8875a', R: '#a8875a', ridge: '#6a4422', cage: '#6a4422', shell: '#d8c7a0' },
    checkers:  { b: 'bucket', L: '#f4f4f4', R: '#f4f4f4', ridge: tm },
    wolf:      { b: 'bucket', L: '#8a8f9c', R: '#8a8f9c', ridge: '#eef1f6', cage: '#3a3f4c', shell: '#b8bcc6' },
  })[m] || { b: 'split', L: tm, R: td, ridge: tt };
}
function drawGoalieMask(G, C, ox, oy) {
  let m = G ? G.mask : 'team'; if (m === 'team' || !MASK_KEEP.has(m)) m = MASK_DEFAULT;
  const sp = maskSpec(m, C, G), P = (x, y, w = 1, h = 1) => px(ox + x, oy + y, w, h);
  const span = (y, c, x0 = 0, x1 = 10) => { const [s0, n] = MASK_ROWS[y]; const a = Math.max(s0, x0), b = Math.min(s0 + n, x1); if (b > a) { ctx.fillStyle = c; P(a, y, b - a, 1); } };
  const X = typeof MASKS_X !== 'undefined' ? MASKS_X[m] : null;
  // the design painters (masks.js): D paints a block, M paints it on both halves, E paints mask cells by a rule
  const D = (c, x, y, w = 1, hh = 1) => { if (!c || w <= 0 || hh <= 0) return; ctx.fillStyle = c; P(x, y, w, hh); };
  const Mi = (c, x, y, w = 1, hh = 1) => { D(c, x, y, w, hh); D(c, 10 - x - w, y, w, hh); };
  const E = f => { for (let y = 0; y < 10; y++) { const [s0, n] = MASK_ROWS[y]; for (let x = s0; x < s0 + n; x++) { const c = f(x, y); if (c) { ctx.fillStyle = c; P(x, y); } } } };
  const rim = c => { ctx.fillStyle = c; for (let y = 0; y < 10; y++) { const [s0, n] = MASK_ROWS[y]; P(s0, y); P(s0 + n - 1, y); } P(3, 0, 4, 1); P(3, 9, 4, 1); };
  const tm = C.main, tt = C.trim || '#ffffff';
  if (sp.b === 'split') {
    for (let y = 0; y < 10; y++) { span(y, sp.L, 0, 5); span(y, sp.R, 5, 10); }
    rim(darker(sp.R, 0.35));
    ctx.fillStyle = shade(sp.L, 0.25); P(2, 2, 2, 1); P(1, 3, 1, 2);                                      // shine on the lit half
    ctx.fillStyle = sp.ridge; P(4, 0, 2, 4);                                                              // the ridge down the middle
    ctx.fillStyle = darker(sp.ridge, 0.25); P(5, 1, 1, 3);
    // paint over the halves
    if (X) X.paint(D, Mi, E, sp, C);
    else switch (m) {
      case 'skull': ctx.fillStyle = '#20222b'; P(1, 2, 2, 2); P(7, 2, 2, 2); ctx.fillStyle = '#9a927e'; P(2, 7, 1, 1); P(7, 7, 1, 1); P(3, 9, 4, 1); break;
      case 'tiger': ctx.fillStyle = '#1b1c22'; P(1, 2, 1, 2); P(8, 2, 1, 2); P(0, 4, 2, 1); P(8, 4, 2, 1); P(2, 1, 1, 1); P(7, 1, 1, 1); P(0, 6, 1, 1); P(9, 6, 1, 1); P(2, 8, 1, 1); P(7, 8, 1, 1); break;
      case 'flame': ctx.fillStyle = '#ff6a1f'; P(0, 5, 1, 2); P(9, 5, 1, 2); P(1, 6, 1, 2); P(8, 6, 1, 2); P(1, 2, 1, 2); P(8, 2, 1, 2); P(2, 8, 1, 1); P(7, 8, 1, 1);
        ctx.fillStyle = '#ffd23f'; P(1, 3); P(8, 3); P(1, 7); P(8, 7); break;
      case 'shark': ctx.fillStyle = '#eef1f6'; P(0, 6, 2, 2); P(8, 6, 2, 2); P(2, 8, 6, 1); ctx.fillStyle = '#20222b'; P(1, 3, 1, 1); P(8, 3, 1, 1); ctx.fillStyle = '#ffffff'; P(2, 7, 1, 1); P(7, 7, 1, 1); break;
      case 'lightning': ctx.fillStyle = '#ffd23f'; P(1, 2, 1, 1); P(2, 3, 1, 1); P(1, 4, 1, 1); P(0, 5, 1, 1); P(8, 2, 1, 1); P(7, 3, 1, 1); P(8, 4, 1, 1); P(9, 5, 1, 1); break;
      case 'star': ctx.fillStyle = '#ffd23f'; P(1, 3); P(2, 2); P(2, 4); P(3, 3); P(8, 3); P(7, 2); P(7, 4); P(6, 3); P(1, 7); P(8, 7); break;
      case 'galaxy': ctx.fillStyle = '#ffffff'; P(1, 3); P(8, 2); P(2, 7); P(7, 6); ctx.fillStyle = '#9fd0ff'; P(2, 2); P(7, 4); P(0, 5); ctx.fillStyle = '#ff7ab8'; P(1, 6); P(8, 7); break;
      case 'laststand': ctx.fillStyle = '#b3202a'; P(1, 2, 1, 3); P(2, 4, 1, 2); P(8, 2, 1, 3); P(7, 4, 1, 2); P(0, 6, 1, 1); P(9, 6, 1, 1); ctx.fillStyle = '#e8c860'; P(1, 7); P(8, 7); P(2, 1); P(7, 1); ctx.fillStyle = '#ff4a4a'; P(1, 3); P(8, 3); break;
      case 'chrome': ctx.fillStyle = '#ffffff'; P(1, 2, 2, 1); P(1, 3, 1, 3); ctx.fillStyle = '#7d8696'; P(8, 3, 1, 4); P(6, 8, 2, 1); ctx.fillStyle = tm; P(4, 0, 2, 1); break;
      case 'gold': ctx.fillStyle = '#fff8c8'; P(1, 2, 2, 1); P(1, 3, 1, 3); ctx.fillStyle = '#8a6a00'; P(8, 3, 1, 4); P(6, 8, 2, 1); break;
      case 'split': case 'white': default: ctx.fillStyle = tt; if (m === 'split') { P(0, 6, 1, 1); P(9, 6, 1, 1); } break;
    }
    // straight-bar cage
    if (!sp.noCage) {
      ctx.fillStyle = '#141824'; P(2, 4, 6, 2); P(3, 6, 4, 3);
      const light = colorDist(sp.R, '#ffffff') < 140;
      ctx.fillStyle = sp.cage || (m === 'gold' ? '#a07800' : light ? '#7d8696' : '#d4d9e2');
      P(2, 6, 6, 1); P(3, 8, 4, 1); P(4, 4, 2, 2); P(3, 6, 1, 3); P(6, 6, 1, 3);
      ctx.fillStyle = sp.eye || (m === 'galaxy' || m === 'flame' || m === 'lightning' || m === 'laststand' ? (m === 'laststand' ? '#ff4a4a' : sp.ridge) : '#ffffff'); P(3, 5); P(6, 5);
    }
  } else {
    // the helmet & cage: a light moulded shell with the helmet dome painted on top (band, centre stripe, ear clips)
    // and a wide wire cage over the face
    const base = sp.shell || '#e8ecf2';
    for (let y = 0; y < 10; y++) span(y, base);
    rim(darker(base, 0.35));
    ctx.fillStyle = darker(base, 0.14); P(8, 3, 1, 4); P(7, 7, 1, 1);
    for (let y = 0; y < 4; y++) { span(y, sp.L, 0, 5); span(y, sp.R, 5, 10); }
    ctx.fillStyle = darker(sp.L, 0.3); P(0, 3, 10, 1);
    ctx.fillStyle = darker(sp.L, -0.25); P(2, 1, 2, 1);
    ctx.fillStyle = sp.ridge; P(4, 0, 2, 3);
    if (m === 'checkers') { ctx.fillStyle = tm; P(3, 1); P(6, 1); P(2, 2); P(7, 2); P(5, 2); P(4, 1, 1, 1); }
    if (m === 'wolf') { ctx.fillStyle = '#5a5f6c'; P(1, -1, 2, 2); P(7, -1, 2, 2); ctx.fillStyle = '#e6a0a8'; P(2, 0); P(7, 0); }
    if (m === 'retro') { ctx.fillStyle = '#8a5a2b'; P(1, 2, 1, 1); P(8, 2, 1, 1); }
    if (X) X.paint(D, Mi, E, sp, C);
    ctx.fillStyle = '#20222b'; P(0, 4, 1, 2); P(9, 4, 1, 2);                                                // ear clips
    ctx.fillStyle = '#141824'; P(1, 4, 8, 5);                                                               // behind the wire
    ctx.fillStyle = sp.cage || '#8a93a3';
    P(1, 6, 8, 1); P(2, 8, 6, 1); for (let x = 2; x < 9; x += 3) P(x, 6, 1, 3); P(4, 4, 2, 2);
    ctx.fillStyle = '#20222b'; P(3, 9, 4, 1);                                                               // chin cup
    ctx.fillStyle = sp.eye || (m === 'wolf' ? '#ffb02e' : '#ffffff'); P(3, 5); P(6, 5);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; P(2, 5); P(7, 5);
  }
}
const MASK_KEEP = new Set(['split', 'bucket', 'white', 'skull', 'tiger', 'flame', 'shark', 'lightning', 'star', 'galaxy', 'laststand', 'chrome', 'gold', 'retro', 'checkers', 'wolf']);

// ---------- referee
function drawRef(r) { return drawBodyFit(r.x, r.y, () => drawRefRaw(r)); }
function drawRefRaw(r) {
  toPSprite(r.x, r.y);
  ctx.fillStyle = 'rgba(30,50,90,.25)'; px(-8, 0, 16, 1); px(-6, 1, 12, 1);
  const sp = hyp(r.vx, r.vy), la = sp > 0.3 ? Math.round(Math.sin(r.anim) * 2) : 0;
  ctx.fillStyle = '#cfd6e0'; px(-6 + la, 0, 6, 1); px(1 - la, 0, 6, 1);
  ctx.fillStyle = '#111'; px(-5 + la, -2, 5, 2); px(1 - la, -2, 5, 2); px(-5 + la, -11, 4, 9); px(1 - la, -11, 4, 9);
  for (let i = 0; i < 14; i++) { ctx.fillStyle = (i >> 1) % 2 ? '#141414' : '#f4f4f4'; px(-7 + i, -20, 1, 9); }
  ctx.fillStyle = '#141414'; px(-3, -21, 6, 1);
  ctx.fillStyle = '#f4f4f4'; px(-9, -19, 2, 6); ctx.fillStyle = '#ff6a1f'; px(-9, -18, 2, 1);
  if (r.arm > 0) { ctx.fillStyle = '#f4f4f4'; px(7, -28, 2, 9); ctx.fillStyle = '#ff6a1f'; px(7, -25, 2, 1); ctx.fillStyle = '#111'; px(7, -29, 2, 1); }
  else { ctx.fillStyle = '#f4f4f4'; px(7, -19, 2, 6); ctx.fillStyle = '#ff6a1f'; px(7, -18, 2, 1); }
  ctx.fillStyle = '#f0c49b'; px(-4, -25, 8, 4);
  ctx.fillStyle = '#20222b'; px(-2, -24, 1, 1); px(1, -24, 1, 1);
  ctx.fillStyle = '#111'; px(-3, -29, 6, 1); px(-4, -28, 8, 3);
  if (r === refs[0] && S.phase === 'faceoff' && S.fo && !S.so && S.fo.kick == null && (S.timer <= FO.cueT || S.fo.dropped) && (!S.fo.dropped || S.fo.wait < 5)) {
    const kd = S.fo.kind || FO_DROPS[0], z = S.fo.dropped ? Math.max(1, kd.h - S.fo.wait * kd.g) : kd.h + (S.fo.beat || 0) * 2.5;
    const hx = Math.round((S.fo.x - r.x) / PSS), hy = Math.round((S.fo.y - r.y - z) / PSS);
    ctx.fillStyle = '#f4f4f4'; pxLine(-9, -17, hx + 3, hy + 2); pxLine(-8, -17, hx + 4, hy + 2);
    ctx.fillStyle = '#141414'; pxLine(-8, -16, hx + 4, hy + 3);
    ctx.fillStyle = '#f0c49b'; px(hx, hy, 3, 3);
  }
}

// ---------- arena staff and bench people, drawn to the same standard as the players and the fans:
// an 8x8 head (brows, eye whites, nose, mouth, ears, shading on the right), a 12-wide body lit from the left,
// standing about as tall as a skater. R(x, y, w, h, colour) draws one rectangle of sprite pixels.
const STAFF_DARK = '#1a1a24';
function staffHat(R, o, back) {
  const c = o.hatC || '#1b2a5a', cD = shade(c, -0.3), cL = shade(c, 0.18);
  if (o.hat === 'cap') { R(-1, -2, 10, 3, c); R(0, -2, 3, 1, cL); R(3, -3, 2, 1, cD); if (!back) { R(-1, 1, 10, 1, cD); if (o.badge) R(3, -1, 2, 1, o.badge); } else R(2, 0, 4, 1, cD); }
  else if (o.hat === 'toque') { R(-1, -2, 10, 3, c); R(0, -2, 3, 1, cL); R(-1, 1, 10, 1, cL); R(3, -3, 2, 1, '#f4f4f4'); }
  else if (o.hat === 'hard') { R(-1, -2, 10, 3, '#f2c230'); R(3, -3, 2, 4, '#c99a10'); R(-2, 1, 12, 1, '#d9a810'); R(0, -2, 2, 1, '#ffe27a'); }
  else if (o.hat === 'muffs') { R(-1, -2, 10, 1, '#1b1c22'); R(-2, 2, 2, 3, c); R(8, 2, 2, 3, c); R(-2, 2, 1, 1, cL); }
}
function staffHead(R, o) {               // the head's top-left is (0, 0); the face is 8x8
  const sk = o.skin, skD = shade(sk, -0.18), hair = o.hair || '#3a2a1a', hairL = shade(hair, 0.22), hs = o.hs ?? 0;
  const covered = o.hat && o.hat !== 'muffs';
  R(0, 0, 8, 8, sk); R(-1, 3, 1, 2, sk); R(8, 3, 1, 2, skD);
  if (o.back) {                                                              // seen from behind: hair (or a bald crown) and the hat
    if (hs !== 4) { R(0, -1, 8, 7, hair); R(-1, 0, 1, 4, hair); R(8, 0, 1, 4, hair); R(1, -1, 3, 1, hairL); if (hs === 1) R(-1, 4, 10, 4, hair); }
    else { R(1, 0, 2, 1, shade(sk, 0.15)); R(0, 4, 8, 2, hair); }
    R(1, 7, 6, 1, skD); staffHat(R, o, true); return;
  }
  R(7, 1, 1, 7, skD); R(1, 7, 6, 1, skD);                                    // shading on the right and under the chin
  if (!covered) {
    if (hs === 4) { R(1, 0, 2, 1, shade(sk, 0.15)); R(-1, 1, 1, 3, hair); R(8, 1, 1, 3, hair); }        // bald, with a fringe
    else {
      R(0, -1, 8, 2, hair); R(1, -1, 3, 1, hairL);
      if (hs === 0) R(0, 1, 2, 1, hair);                                                               // short, swept
      if (hs === 1) { R(-1, 0, 2, 7, hair); R(7, 0, 2, 7, hair); }                                      // long
      if (hs === 2) { R(0, -2, 8, 1, hair); R(-1, -1, 1, 4, hair); R(8, -1, 1, 4, hair); R(2, -2, 1, 1, hairL); }   // curly
      if (hs === 3) { R(1, -2, 1, 1, hair); R(3, -2, 1, 1, hair); R(5, -2, 1, 1, hair); }               // spiky
    }
  } else if (hs !== 4) { R(-1, 1, 1, 3, hair); R(8, 1, 1, 3, hair); }                                  // hair showing under the hat
  const brow = shade(hair, -0.15), e = o.look || 0;
  R(1, 2, 2, 1, brow); R(5, 2, 2, 1, brow);
  R(1, 3, 2, 1, '#ffffff'); R(5, 3, 2, 1, '#ffffff');
  R(e < 0 ? 1 : 2, 3, 1, 1, STAFF_DARK); R(e > 0 ? 6 : 5, 3, 1, 1, STAFF_DARK);
  if (o.glasses) { R(0, 3, 3, 1, STAFF_DARK); R(5, 3, 3, 1, STAFF_DARK); R(3, 3, 2, 1, STAFF_DARK); R(1, 3, 1, 1, 'rgba(200,230,255,.85)'); R(6, 3, 1, 1, 'rgba(200,230,255,.85)'); }
  if (o.shades) { R(0, 3, 8, 1, '#0b0c10'); R(1, 3, 1, 1, '#3a4a6a'); R(5, 3, 1, 1, '#3a4a6a'); }
  R(4, 4, 1, 1, skD);                                                                                 // nose
  if (o.beard) { R(0, 5, 8, 2, hair); R(1, 7, 6, 1, hair); R(-1, 4, 1, 2, hair); R(8, 4, 1, 2, hair); }
  if (o.mouth === 'open') { R(3, 5, 2, 2, '#7a2020'); R(3, 5, 2, 1, '#ffffff'); }
  else if (o.mouth === 'smile') { R(2, 5, 1, 1, shade(sk, -0.35)); R(3, 6, 2, 1, shade(sk, -0.35)); R(5, 5, 1, 1, shade(sk, -0.35)); }
  else R(3, 6, 2, 1, shade(sk, -0.35));
  staffHat(R, o, false);
}
// a 2-wide arm hanging at the side (sleeve with its shaded inner edge, then the hand)
function staffArmDown(R, x, top, len, sleeve, sk, inner) {
  R(x, top, 2, len, sleeve); R(inner > 0 ? x + 1 : x, top + 1, 1, len - 1, shade(sleeve, -0.22));
  R(x, top + len, 2, 2, sk); R(x, top + len + 1, 2, 1, shade(sk, -0.18));
}
// ---------- gate attendants: smart (white shirt, tie, dark trousers) under a hi-vis vest with reflective stripes.
// arm: 0 = at his side, 1 = reaching out to hold the door (toward dir: -1 left / +1 right), wave: a little 'come on through'
function drawAttendant(x, y, dir, arm, wave, skin) {
  toPSprite(x, y);
  const sk = skin || '#e8b48a', vest = '#d8f23a', vestD = '#a9c21c', vestL = '#ecff7a', refl = '#e8eef6';
  const shirt = '#f4f6fa', shirtD = '#d4dae4', trou = '#2a2d38', trouD = '#1b1d25';
  const bob = !arm && ((S.t >> 5) & 1) ? 1 : 0;                    // shifting his weight while he waits
  const R = (x0, y0, w, h, c) => { ctx.fillStyle = c; px(dir > 0 ? x0 : -x0 - w, y0, w, h); };   // drawn facing the door
  R(-7, 0, 14, 1, 'rgba(30,50,90,.28)'); R(-5, 1, 10, 1, 'rgba(30,50,90,.28)');
  // shoes and trousers (creased)
  R(-5, -2, 4, 2, '#0e0f14'); R(1, -2, 5, 2, '#0e0f14'); R(-5, -2, 1, 1, '#3a3d48'); R(1, -2, 2, 1, '#3a3d48');
  R(-5, -11 + bob, 4, 9 - bob, trou); R(1, -11, 4, 9, trou); R(-2, -11 + bob, 1, 9 - bob, trouD); R(4, -11, 1, 9, trouD); R(-5, -11, 1, 9, shade(trou, 0.12));
  R(-6, -12, 12, 1, '#14151b'); R(-1, -12, 2, 1, '#b8a36a');                                          // belt and buckle
  // shirt and tie, the vest open over them
  R(-6, -20, 12, 8, shirt); R(-7, -20, 14, 2, shirt); R(-6, -13, 12, 1, shirtD);
  R(-1, -20, 2, 1, '#1b2a5a'); R(-1, -19, 2, 6, '#1b2a5a'); R(0, -19, 1, 5, '#34478a');                 // tie
  R(-7, -20, 5, 8, vest); R(2, -20, 5, 8, vest); R(-7, -20, 1, 8, vestL); R(6, -20, 1, 8, vestD); R(-7, -13, 5, 1, vestD); R(2, -13, 5, 1, vestD);
  R(-3, -20, 1, 7, vestD); R(2, -20, 1, 7, vestL);                                                     // the open edges
  R(-7, -17, 5, 1, refl); R(2, -17, 5, 1, refl); R(-7, -15, 5, 1, refl); R(2, -15, 5, 1, refl);           // reflective bands
  R(3, -19, 2, 2, '#ffffff'); R(3, -19, 2, 1, '#2f6fe8');                                              // ID badge
  R(-6, -19, 2, 3, '#1e1f26'); R(-6, -19, 1, 1, '#ff4a3d');                                            // radio on the vest
  // the arm away from the door at his side; the door arm held out on the door (waving them through when they come)
  staffArmDown(R, -9, -20, 8, shirt, sk, 1); R(-9, -20, 2, 3, vest);
  if (arm) {
    const wy = wave ? ((S.t >> 3) & 1) : 0;
    R(7, -20, 2, 3, vest); R(9, -20 - wy, 4, 2, shirt); R(9, -19 - wy, 4, 1, shirtD);
    R(13, -21 - wy, 2, 3, sk); R(13, -19 - wy, 2, 1, shade(sk, -0.18));
  } else { staffArmDown(R, 7, -20, 8, shirt, sk, -1); R(7, -20, 2, 3, vest); }
  // collar, neck and head under an arena-staff cap, an earpiece and its wire
  R(-1, -21, 2, 1, shade(sk, -0.18)); R(-3, -21, 2, 1, '#c9cfd8'); R(1, -21, 2, 1, '#c9cfd8');
  staffHead((x0, y0, w, h, c) => R(-4 + x0, -29 + y0, w, h, c), { skin: sk, hair: '#2a1d14', hs: 0, hat: 'cap', hatC: '#1b2a5a', badge: '#ffd23f', look: 1 });
  R(-6, -26, 1, 3, '#111');                                                                            // earpiece
}
// ---------- the penalty box: a player sitting out his minutes (helmet on, gloves off, stick across his knees)
// A PLAYER SITTING (on the bench or in the penalty box), built from the SAME parts as his on-ice sprite: his skates,
// sock style, breezers with the trim stripe, jersey fit, crest and C/A, gloves, stick and tape colours, and the on-ice
// head (helmet colour and style, visor or cage, hair, beard). Only the pose differs: knees toward us, shins down.
// (drawBenchie.pose, set by the caller for one draw: 'slump' = head down after a goal against, 'tap' = stick
// banging on the floor of the penalty box, frame drawBenchie.tapK 0..1)
function drawBenchie(x, y, T, pl, bob, cheer, faceLeft) { return drawBodyFit(x, y + (bob || 0), () => drawBenchieRaw(x, y, T, pl, bob, cheer, faceLeft)); }
function drawBenchieRaw(x, y, T, pl, bob, cheer, faceLeft) {
  toPSprite(x, y + bob);
  const C = T, G = typeof gearOf === 'function' ? uniformGear(gearOf(pl), T, pl && pl.pos === 'G') : null, LK = pl && typeof lookOf === 'function' ? lookOf(pl) : null;
  const d = faceLeft ? -1 : 1, pose = drawBenchie.pose || null;
  const R = (x0, y0, w, h, c) => { ctx.fillStyle = c; px(x0, y0, w, h); };
  R(-7, 1, 14, 1, 'rgba(0,0,0,.3)');
  // skates on the floor, shins (socks) up to the knees: his own skates and sock style
  const sk = G ? gearCol(G, 'skates', C) : '#1d1f27';
  R(-6, 0, 5, 1, '#cfd6e0'); R(1, 0, 5, 1, '#cfd6e0');
  R(-5, -2, 4, 2, sk); R(1, -2, 4, 2, sk); R(-5, -2, 4, 1, G && G.skates === 'retro' ? '#d8c7a0' : darker(sk, -0.2)); R(1, -2, 4, 1, G && G.skates === 'retro' ? '#d8c7a0' : darker(sk, -0.2));
  const so = G ? G.socks : 'team', sockC = so === 'dark' ? C.dark : so === 'white' ? '#eef1f6' : C.main, sockS = so === 'white' ? C.main : so === 'stripe' ? '#ffffff' : C.trim;
  for (const lx of [-5, 1]) { R(lx, -5, 4, 3, sockC); if (so === 'hoops') { R(lx, -5, 4, 1, sockS); R(lx, -3, 4, 1, sockS); } else if (so === 'stripe') { R(lx, -4, 4, 1, sockS); } else R(lx, -3, 4, 1, sockS); }
  // breezers: thighs coming toward us, his team's pants with the trim stripe down the side
  R(-6, -9, 12, 4, C.pants); R(-6, -9, 12, 1, darker(C.pants, 0.3)); R(-6, -8, 1, 3, C.trim); R(5, -8, 1, 3, C.trim); R(-1, -8, 1, 3, darker(C.pants, 0.35));
  // upper body: the on-ice jersey, arms, gloves and head, sitting 3 px lower than standing (slumped: 3 more)
  const hy = pose === 'slump' ? 3 : 0;
  ctx.save(); ctx.translate(0, 3);
  const fit = G ? G.jersey : 'standard', jTop = -20 + (fit === 'tuck' ? 1 : 0), jH = Math.min(fit === 'loose' ? 10 : fit === 'tuck' ? 8 : 9, 8);
  for (let j = 0; j < jH; j++) for (let i = 0; i < 14; i++) { ctx.fillStyle = jerseyColor(C, i, j, 14, jH); ctx.fillRect(-7 + i, jTop + j, 1, 1); }
  R(-7, jTop, 1, jH, 'rgba(0,0,0,.12)'); R(6, jTop, 1, jH, 'rgba(0,0,0,.12)');
  drawCrest(C, -4, -19, 8);
  const ti = TEAM.indexOf(T), lu = ti >= 0 && S.match && S.match.lineups ? S.match.lineups[ti] : null, cap = pl && lu && lu.leaders ? lu.leaders[pl.id] : null;
  if (cap) { ctx.fillStyle = numColor(C); const L2 = cap === 'C' ? ['111', '100', '111'] : ['010', '111', '101']; L2.forEach((row, j) => [...row].forEach((b, i) => { if (b === '1') px(4 + i, -19 + j, 1, 1); })); }
  if (fit === 'laces') { R(-1, -20, 2, 1, C.trim); R(-1, -19, 1, 1, '#eef1f6'); R(0, -18, 1, 1, '#eef1f6'); }
  const stC = G ? gearCol(G, 'stick', C) : '#9a6a35', tpC = G ? gearCol(G, 'tape', C) : '#18191f';
  if (cheer) drawArms(C, G, 0, [{ x: -10, y: -27 }, { x: 9, y: -27 }]);
  else if (pose === 'tap') {                                    // both gloves on the stick, banging the blade on the floor
    const up = Math.round(Math.abs(Math.sin((drawBenchie.tapK || 0) * Math.PI * 3)) * 5), s = -d;
    drawArms(C, G, 0, [{ x: -8 * s, y: -12 - up }, { x: -4 * s, y: -11 - up }]);
    ctx.fillStyle = stC; pxLine(-7 * s, -12 - up, -15 * s, -2 - up); ctx.fillStyle = tpC; px(s > 0 ? -18 : 15, -2 - up, 4, 1);
  } else {                                                      // forearms on his knees, the stick across his lap
    drawArms(C, G, 0, [{ x: -8, y: -11 }, { x: 7, y: -11 }]);
    ctx.fillStyle = stC; pxLine(-9 * d, -9, 10 * d, -11); ctx.fillStyle = tpC; px(d > 0 ? 10 : -13, -11, 3, 1);
  }
  ctx.translate(0, hy);
  drawHead({ fx: pose === 'slump' ? 0 : d * 0.6, fy: 1 }, C, G, LK, 0, false);
  ctx.restore();
}
// an off-ice official (penalty box attendant, scorekeeper): navy blazer, grey trousers, a lanyard. Standing, or
// seated at the desk (only the top half shows over it); arm out to a door, or a phone at his ear
function drawOfficial(x, y, o = {}) {
  toPSprite(x, y);
  const R = (x0, y0, w, h, c) => { ctx.fillStyle = c; px(x0, y0, w, h); };
  const sk = o.skin || '#e8b48a', coat = o.coat || '#1b2a4a', coatL = shade(coat, 0.18), coatD = shade(coat, -0.3), d = o.faceLeft ? -1 : 1;
  R(-6, 0, 12, 1, 'rgba(0,0,0,.3)');
  const pants = o.pants || '#5a5f6e', pantsD = shade(pants, -0.22), pantsL = shade(pants, 0.12);
  if (!o.seated) {
    R(-4, -10, 3, 9, pants); R(1, -10, 3, 9, pants); R(-4, -10, 1, 9, pantsL);
    R(-5, -1, 4, 1, '#121318'); R(1, -1, 4, 1, '#121318');
  } else {
    // sitting on a desk chair: the chair (seat, post and wheels), shins down to the floor, shoes
    R(-7, -9, 14, 3, '#2a2d38'); R(-7, -9, 14, 1, '#4a4f60'); R(-1, -6, 2, 4, '#1a1c24'); R(-5, -2, 10, 1, '#1a1c24'); R(-6, -1, 2, 1, '#3a3f4e'); R(4, -1, 2, 1, '#3a3f4e');
    R(-5, -7, 3, 6, pants); R(2, -7, 3, 6, pants); R(-5, -7, 1, 6, pantsL); R(4, -7, 1, 6, pantsD);
    R(-6, -1, 4, 1, '#121318'); R(2, -1, 4, 1, '#121318'); R(-6, -1, 1, 1, '#3a3c46'); R(2, -1, 1, 1, '#3a3c46');
    ctx.translate(0, 4);                                                                   // the upper body sits lower
  }
  R(-6, -19, 12, 9, coat); R(-6, -19, 1, 9, coatL); R(5, -19, 1, 9, coatD);
  R(-1, -19, 2, 6, '#f2f4f8'); R(0, -17, 1, 4, o.tie || '#b0282a');   // shirt and tie
  R(-2, -14, 1, 4, '#ffd23f');                                    // lanyard pass
  if (o.arm === 'door') { R(-6 * d - (d < 0 ? 4 : 0), -17, 6, 2, coat); R(d < 0 ? -12 : 10, -17, 2, 2, sk); R(5 * -d - (d > 0 ? 0 : 1), -18, 2, 7, coat); }
  else if (o.phone) { R(d < 0 ? 5 : -7, -18, 2, 5, coat); R(d < 0 ? 5 : -7, -23, 2, 5, coat); R(-7 * d - (d < 0 ? 1 : 0), -18, 2, 7, coat); }
  else if (o.seated) { R(-8, -18, 2, 6, coat); R(6, -18, 2, 6, coat); }
  else { R(-8, -18, 2, 7, coat); R(6, -18, 2, 7, coat); R(-8, -11, 2, 2, sk); R(6, -11, 2, 2, sk); }
  if (o.seated) { R(-5, -12, 4, 3, pants); R(1, -12, 4, 3, pants); R(-5, -12, 10, 1, pantsL); R(-1, -11, 1, 2, pantsD); if (!o.phone && o.arm !== 'door') { R(-6, -12, 2, 2, sk); R(4, -12, 2, 2, sk); } }   // his lap, hands resting on it
  R(-1, -20, 2, 1, shade(sk, -0.18));
  if (typeof staffHead === 'function') staffHead((x0, y0, w, h, c) => R(-4 + x0, -28 + y0, w, h, c), { skin: sk, hair: o.hair || '#2b1d12', hs: o.hs || 0, look: d, mouth: o.mouth || null });
  if (o.phone) { const hx = d < 0 ? 3 : -6; R(hx, -27, 3, 8, o.phoneCol || '#d9342b'); R(hx, -27, 3, 1, shade(o.phoneCol || '#d9342b', 0.3)); R(hx + (d < 0 ? 0 : 1), -22, 2, 3, sk); }   // the receiver at his ear, hand on it
}
function drawBenchGoalie(x, y, T, bob, cheer) { return drawBodyFit(x, y + (bob || 0), () => drawBenchGoalieRaw(x, y, T, bob, cheer)); }
function drawBenchGoalieRaw(x, y, T, bob, cheer) {
  toPSprite(x, y + bob);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; px(-6, 5, 13, 1);
  for (let j = 0; j < 7; j++) for (let i = 0; i < 13; i++) { ctx.fillStyle = jerseyColor(T, i, j, 13, 7); ctx.fillRect(-6 + i, -2 + j, 1, 1); }
  if (cheer) { ctx.fillStyle = T.main; px(-8, -9, 2, 6); px(6, -9, 2, 6); }
  ctx.fillStyle = '#d9a066'; px(-3, -8, 6, 6); ctx.fillStyle = '#3a2a1a'; px(-3, -9, 6, 2); ctx.fillStyle = '#20222b'; px(-2, -6, 1, 1); px(1, -6, 1, 1);   // SOCCER: the sub keeper's head (no mask)
  ctx.fillStyle = '#d9dde6'; px(6, -1, 3, 5);
}

// ---------- celebrations: arms up, the stick held high in one hand (drawn over the normal skater)
const celebHoldsStick = p => false;   // SOCCER: nothing to hold up
function drawCelebrationPose(p, C, ln) {
  const ty = p.celebType === 'big' ? (((p.celebT >> 4) & 1) ? 'arms' : 'stick') : p.celebType;
  const hop = p.celebType === 'big' ? -Math.abs(Math.round(Math.sin(p.celebT * 0.3) * 3)) : 0;
  ctx.translate(0, hop);
  const G = typeof gearOf === 'function' ? uniformGear(gearOf(p.pl), C, p.g) : null, glove = G ? gearCol(G, 'gloves', C) : C.dark;
  const arm = (x, up) => { for (let j = 0; j < 8 + up; j++) { ctx.fillStyle = sleeveColor(C, Math.min(3, j >> 1)); px(x, -20 - up + j, 2, 1); } ctx.fillStyle = glove; px(x - 1, -23 - up, 3, 3); };
  const held = (x, up, tilt) => {
    return;   // SOCCER: no stick to raise
    const top = -24 - up, sc = G ? gearCol(G, 'stick', C) : '#9a6a35', tc = G ? gearCol(G, 'tape', C) : '#18191f';
    // a real stick raised over his head: shaft leaning out, the blade hooking off ONE side at the top (heel, then toe)
    const lean = tilt + 2, L = 17, tx = x + lean, ty0 = top - L;
    ctx.fillStyle = sc; for (let j = 0; j < L; j++) px(x + Math.round(lean * j / L), top - j, 1, 1);
    px(x, top + 1, 1, 3);                                                   // the butt end below his glove
    ctx.fillStyle = tc; px(x, top + 3, 1, 1);                               // knob of tape
    ctx.fillStyle = sc; px(tx, ty0 - 1, 1, 1); px(tx + 1, ty0 - 1, 2, 2); px(tx + 3, ty0, 2, 2); px(tx + 5, ty0 + 1, 1, 1);   // heel -> toe, curling down
    ctx.fillStyle = tc; px(tx + 2, ty0 - 1, 2, 1); px(tx + 3, ty0, 2, 1);   // tape on the blade
  };
  const sh = ln + 7;
  if (ty === 'fist') { const up = (p.celebT >> 3) & 1 ? 3 : 0; arm(sh, up); held(sh, up, 2); drawArms(C, G, ln, [{ x: -8 + ln, y: -12 }]); }
  else if (ty === 'arms' || ty === 'huddle') { arm(-9 + ln, 1); arm(sh, 1); held(sh, 1, ((p.celebT >> 4) & 1) ? 2 : 0); }
  else if (ty === 'stick') { arm(sh, 3); held(sh, 3, 0); drawArms(C, G, ln, [{ x: -8 + ln, y: -12 }]); }
  else if (ty === 'slide') { ctx.fillStyle = 'rgba(255,255,255,.6)'; px(-9, 1, 18, 1); }
  else { arm(sh, 1); held(sh, 1, 0); drawArms(C, G, ln, [{ x: -8 + ln, y: -12 }]); }
}

// ---------- previews (menus): the real sprite on a small canvas
function drawFigureOn(cv, C, fakes, scale) {
  const keepCtx = ctx, oldT = TEAM[0], keepTo = toPSprite;
  try {
    TEAM[0] = C; ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    for (const f of fakes) {
      toPSprite = () => ctx.setTransform(scale, 0, 0, scale, f.px, f.py);
      if (f.g) drawGoalie(f); else drawSkater(f);
    }
  } catch (e) { /* best effort */ }
  finally { ctx = keepCtx; TEAM[0] = oldT; toPSprite = keepTo; }
}
const fakeSkater = (o) => Object.assign({ x: 0, y: 0, fx: 0, fy: 1, vx: 0, vy: 0, team: 0, pl: null, num: 9, role: 1, g: false, anim: 0, stun: 0, lunge: 0, poke: 0, dkOff: 0, cap: null, charge: -1, covering: 0, down: 0, hand: 'L' }, o);
