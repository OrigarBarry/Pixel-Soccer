'use strict';
// ====================================================================
//  HOVER HELP: any element with data-help="..." shows a game-styled pop-up explaining it.
//  Mouse: hover (a short delay). Touch: tap the word to show it, tap anywhere else to hide it.
//  Keyboard: shown while the element has focus.
// ====================================================================
const HELP = {
  tier: {
    franchise: 'FRANCHISE: the very best in the pool (low-to-high 80s). Rare players who can carry a team for years. They go first.',
    elite: 'ELITE: a franchise keeper (high 70s to mid 80s). Can win games on his own.',
    star: 'STAR: an established top player (mid 70s to about 80). A first-liner or a starting keeper.',
    specialist: 'SPECIALIST: elite at one or two things and weaker elsewhere. Great in the right role (set pieces, shutdown, finishing).',
    veteran: 'VETERAN: experienced (31+) and solid right now, but he will start to decline within a few seasons.',
    prospect: 'PROSPECT: young (18 to 21) and still growing. Lower rating today, room to get much better.',
    depth: 'DEPTH: a dependable bottom-of-the-lineup player who fills out lines 3 and 4 (or the third keeper spot).',
    backup: 'BACKUP: a backup keeper. Fine for the odd start, not your number one.',
    top: 'TOP PROSPECT: a high-end young player, likely to become a regular and maybe more.',
    mid: 'PROSPECT: a young player with a decent chance to make the team in a couple of seasons.',
  },
  type: {
    speedster: 'SPEEDSTER: built around speed and stamina. Gets in behind defences, a little light on the body.',
    sniper: 'SNIPER: shot power and accuracy. Scores goals, does less in his own end.',
    defensive: 'DEFENSIVE SPECIALIST: positioning and tackling. Shuts down the other team, chips in little offence.',
    enforcer: 'PHYSICAL HARD MAN: tackling and power. Wins battles and scuffles, weak with the ball.',
    playmaker: 'PLAYMAKER: passing and ball skills. Sets up goals and is good on set pieces.',
    balanced: 'TWO-WAY: no big weakness, no big standout. Fits anywhere in the lineup.',
    goalie: 'KEEPER.',
  },
  col: {
    OVR: 'OVERALL: how good he is right now (0 to 100).',
    POT: 'POTENTIAL: how good he could become. A range (like 62–78) is the scouts\' guess: the real ceiling is somewhere inside it. Scouting narrows it.',
    'BEST AT': 'His two best ratings.',
    TAGS: 'Scouting notes on how he will develop. Hover a tag for details.',
    TRAITS: 'Special abilities that boost certain ratings. Hover an icon for details.',
    AGE: 'Younger players still improve. Players start to slow down in their 30s.',
    POS: 'Position: LW/C/RW are forwards, LD/RD defenders, G keeper.',
  },
  stat: { SPD: 'SPEED: running speed.', STA: 'STAMINA: how long he lasts on a shift and over a game.', PWR: 'SHOT POWER: how hard he shoots.', ACC: 'ACCURACY: how well he picks his spot.', PAS: 'PASSING: pass speed and accuracy.', HND: 'TOUCH: dribbling and ball control.', DEF: 'DEFENCE: positioning, poke tackles and taking away lanes.', CHK: 'TACKLING: shoulder charges and winning battles.', FO: 'KICKOFFS: winning draws.', REF: 'REFLEXES: reaction saves.', POS: 'POSITIONING: being square to the shooter.', REB: 'REBOUND CONTROL: smothering or steering rebounds away.', REC: 'RECOVERY: getting back up and set after a save.' },
};
const helpTier = p => { const k = p.tierV || p.tier; return k ? (p.pos === 'G' && k === 'franchise' ? HELP.tier.elite : HELP.tier[k] || '') : ''; };

(function helpInit() {
  if (typeof document === 'undefined') return;
  let tip = null, cur = null, tmr = null;
  const hide = () => { clearTimeout(tmr); if (tip) tip.style.display = 'none'; cur = null; };
  const show = el => {
    const txt = el.getAttribute('data-help'); if (!txt) return;
    if (!tip) { tip = document.createElement('div'); tip.className = 'helptip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
    // (Nov 23, from Pixel Hockey) 'plain sentence\ndetails': the first line reads on its own, the numbers sit underneath, dimmer
    const cut = txt.indexOf('\n');
    if (cut > 0) { tip.textContent = ''; const a = document.createElement('div'), b = document.createElement('div'); a.className = 'ht-lead'; b.className = 'ht-more';
      a.textContent = txt.slice(0, cut); b.textContent = txt.slice(cut + 1); tip.append(a, b); }
    else tip.textContent = txt;
    tip.style.display = 'block'; cur = el;
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, hh = tip.offsetHeight;
    let x = r.left + r.width / 2 - w / 2, y = r.top - hh - 8;
    if (y < 6) y = r.bottom + 8;
    x = Math.max(6, Math.min(innerWidth - w - 6, x));
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  };
  const target = e => e.target && e.target.closest ? e.target.closest('[data-help]') : null;
  document.addEventListener('pointerover', e => { if (e.pointerType === 'touch') return; const el = target(e); if (el === cur) return; clearTimeout(tmr); if (!el) return hide(); tmr = setTimeout(() => show(el), 140); });
  document.addEventListener('pointerout', e => { if (e.pointerType === 'touch') return; const el = target(e); if (el && !el.contains(e.relatedTarget)) hide(); });
  document.addEventListener('pointerdown', e => { const el = target(e); if (e.pointerType === 'touch' && el) { if (cur === el) hide(); else show(el); } else if (!el) hide(); }, true);
  document.addEventListener('focusin', e => { const el = target(e); if (el) show(el); });
  document.addEventListener('focusout', hide);
  addEventListener('scroll', hide, true); addEventListener('resize', hide);
})();
