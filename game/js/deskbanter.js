// ====================================================================
//  PUCK TALK: the cast's personalities, their chirps, and Mr Anderson's post-game interviews.
//  Everyone on the show has a character of their own:
//   THE BONE (Barron Barracuda): loud, vain about his suits, old-school, superstitious. Bald, and very shiny.
//   T: the deadpan straight man. Dry, unimpressed, and the best at getting under Bone's skin.
//   DANA LACROIX: the analytics brain. Corrects Bone with numbers, which he hates.
//   MARCUS BELL: the ex-coach. Systems, whiteboards, "it's about structure".
//   PRIYA SANDHU: the insider. Has sources, has scoops, has no patience for Bone's theories.
//   GORD WHITLEY: the old-timer. Every story starts "back in my day" and never quite ends.
//   KENJI MOREAU: the young hype guy. Slang, highlights, and the group chat.
//   MR ANDERSON: the Replay Centre. A former star power forward ("the Anderson Era") who never stopped training and
//   never stopped telling you about it. The flexing is him reliving the glory days.
//  The three chirp each other constantly; a show gets one or two exchanges, never the same one twice running.
// ====================================================================
const DESK_PERSONA = {
  t: 'deadpan', dana: 'stats', marcus: 'coach', priya: 'insider', gord: 'oldtimer', kenji: 'hype',
};

// ---------- the chirps: [speaker, text], speaker 0 = the co-host, 1 = The Bone. {suit} = today's suit, {host} = the co-host
const CHIRPS = {
  // Bone's suits (beyond "a suit nobody asked for")
  suit: [
    [[0, 'Bone, is that a suit or a cry for help?'], [1, 'It\'s the {suit}! It\'s a statement!'], [0, 'So is a fire alarm.']],
    [[0, 'I want everyone at home to know: we did ask him to change.'], [1, 'You can\'t change perfection, {host}.']],
    [[1, 'Notice anything today, {host}?'], [0, 'The colour-blind fans calling in to say thank you?'], [1, 'Jealousy is a terrible look on you.']],
    [[0, 'The {suit}. Bone, the curtains want their pattern back.'], [1, 'These curtains have won awards!'], [0, 'For what?']],
    [[0, 'Our cameras had to recalibrate for that suit.'], [1, 'Good. Raise the standard!']],
    [[1, 'This suit has a matching tie. On purpose. You know what that takes?'], [0, 'A lot of confidence and no mirrors.']],
    [[0, 'Somewhere a sofa from 1978 is missing its cover.'], [1, 'Vintage, {host}. The word is VINTAGE.']],
    [[1, 'My tailor says the {suit} is the boldest thing he\'s ever made.'], [0, 'Is your tailor okay?'], [1, 'He\'s resting.']],
  ],
  // Bone's head: shiny
  head: [
    [[0, 'Could we dim the studio lights? Bone\'s head is blinding the camera again.'], [1, 'That\'s called a healthy glow!']],
    [[0, 'Bone, I can see the scoreboard in your forehead.'], [1, 'Then you know we\'re WINNING.']],
    [[1, 'You know why I don\'t wear a hat?'], [0, 'Pilots use your head to land at night?'], [1, '...That\'s not why.']],
    [[0, 'The lighting crew says you count as a second key light.'], [1, 'Bill me for it. I\'m worth it.']],
    [[0, 'Bone polished his head for the show. I could do my makeup in it.'], [1, 'You\'re welcome to. Two dollars a minute.']],
    [[1, 'Mower guy says I give the best shine in the building.'], [0, 'He was talking about the pitch, Bone.']],
  ],
  // Mr Anderson's glory days, from the desk
  anderson: [
    [[0, 'Mr Anderson flexed in the parking lot again.'], [1, 'At who?'], [0, 'At his own car. He said it "remembers the Anderson Era."']],
    [[1, 'Anderson told me he once scored a goal with his shoulder. On purpose.'], [0, 'He tells that story every day.'], [1, 'And every day it gets better!']],
    [[0, 'Did Anderson really have his own cereal back in his playing days?'], [1, 'Had his own CEREAL. "Anderson-Os". Protein in every loop.']],
    [[1, 'Anderson still does a victory lap after he parks.'], [0, 'Glory days, Bone. Glory days.']],
    [[0, 'Anderson\'s gym bag has his old jersey in it. He wears it to bench press.'], [1, 'Number never retired, he says. "Retiring is for quitters."']],
    [[1, 'Every time Anderson flexes, he says "that one\'s for the fans of '+'\'03."'], [0, 'There were no fans in \'03, Bone. He played in an empty pitch once and never let it go.']],
  ],
  // the co-host's own character
  deadpan: [
    [[1, 'T, give me some energy! It\'s soccer night!'], [0, 'This is my energy, Bone.'], [1, 'Unbelievable.']],
    [[1, 'Did you see my power ranking? Bold!'], [0, 'I saw it. I\'m still recovering.']],
    [[1, 'T, I need you to be excited for once.'], [0, 'I\'m thrilled. Look at my face.'], [1, '...Same face as always!']],
  ],
  stats: [
    [[1, 'They just want it more, Dana!'], [0, 'Their expected goals say otherwise, Bone.'], [1, 'You can\'t measure HEART.'], [0, 'I can measure shots. Hearts don\'t score.']],
    [[0, 'Bone, your predictions are right forty-one percent of the time.'], [1, 'That\'s nearly HALF!']],
  ],
  coach: [
    [[0, 'It\'s about structure, Bone. Their neutral-zone gap is too wide.'], [1, 'It\'s about WANT, Marcus!'], [0, 'You can\'t draw "want" on a whiteboard.']],
    [[1, 'Marcus, you brought the whiteboard again?'], [0, 'Somebody on this panel has to explain the soccer.']],
  ],
  insider: [
    [[1, 'Priya, I have a source too!'], [0, 'Your source is your barber, Bone.'], [1, '...I don\'t have a barber.'], [0, 'Exactly.']],
    [[0, 'My sources say a trade is close.'], [1, 'My sources say I look GREAT today.'], [0, 'Your sources are mirrors.']],
  ],
  oldtimer: [
    [[0, 'Back in my day, we didn\'t have suits like that.'], [1, 'Back in your day you didn\'t have COLOUR, Gord.']],
    [[0, 'In \'74 I played a whole half with one run.'], [1, 'Was the other one in the shop?'], [0, 'It was in a snowbank in Moose Jaw. Long story.']],
  ],
  hype: [
    [[0, 'Bone, that suit is giving main character energy.'], [1, 'I don\'t know what that means but THANK you, Kenji.']],
    [[0, 'The chat is going off about your head, Bone.'], [1, 'What chat?! Who\'s chatting?!'], [0, 'Everyone, Bone. Everyone.']],
  ],
};

function deskChirps(save, host, pick, rng) {
  const sub = { '{suit}': deskSuit(save).name, '{host}': host.name.split(' ')[0] };
  const fill = s => s.replace(/\{suit\}|\{host\}/g, k => sub[k]);
  const own = DESK_PERSONA[host.id];
  // two exchanges a show: one about Bone (suit or head), one in the co-host's style or about Anderson
  const first = rng() < 0.6 ? 'suit' : 'head', second = rng() < 0.5 && own && CHIRPS[own] ? own : 'anderson';
  const day = deskDay(save), pickEx = k => { const a = CHIRPS[k]; return a[(day * 7 + (k === first ? 1 : 3) + Math.floor(rng() * a.length)) % a.length]; };
  return [pickEx(first).map(([w, t]) => [w, fill(t)]), pickEx(second).map(([w, t]) => [w, fill(t)])];
}

// ---------- Mr Anderson: more of him in the Replay Centre (glory days, and the odd shot at Bone's head)
const ANDERSON_EXTRA = {
  intro: ['Thanks, Bone. Love the head. Very aerodynamic. Welcome to the Replay Centre!', 'Mr Anderson here. Back in the Anderson Era we didn\'t need replays. We just REMEMBERED. Roll it!',
    'Welcome to the Replay Centre! Quick flex for the fans of the old days... okay, two flexes. Roll it.', 'Bone, turn your head a little, you\'re glaring on my monitor. Thank you. Let\'s go!'],
  mine: n => [`${n}! That's the kind of goal I used to score. Every night. Just saying.`, `Look at ${n} drive the net. That's my move. He owes me royalties.`, `${n} with the shoulders into it. I respect that. I invented that.`],
  league: n => [`${n} with the release! Not bad. I'd give it an eight. My goals were tens.`, `${n}! Reminds me of the Anderson Era. Faster than me? No. But close.`, `Watch ${n}'s touch. Soft. Mine was softer. Ask anyone.`],
  back: h0 => [`Alright, that's the Replay Centre. Back to ${h0} and the shiniest head in broadcasting!`, `Back to you, ${h0}. Bone, love the suit. Said no one. Kidding! Kidding.`, `I'm off to do curls. Back to ${h0} and The Bone!`],
};
if (typeof andersonLines === 'function') {
  const orig = andersonLines;
  andersonLines = function (save, host, reps, rng) {
    const A = orig(save, host, reps, rng), pick = a => a[Math.floor(rng() * a.length)];
    const intro = rng() < 0.55 ? pick(ANDERSON_EXTRA.intro) : A.intro, back = rng() < 0.6 ? pick(ANDERSON_EXTRA.back(host.name)) : A.back;
    const say = r => rng() < 0.5 ? pick((r.src === 'mine' ? ANDERSON_EXTRA.mine : ANDERSON_EXTRA.league)(r.scorerLast || 'him')) : A.say(r);
    return { intro, say, back };
  };
}

// ---------- POST-GAME WITH MR ANDERSON: after your last game he grabs one of your players (the top star you had,
// or whoever played best) for a quick interview; the answers follow the player's personality and mood
function deskPostgame(save, rng) {
  const se = save.season, user = save.userTeamId; if (!se) return null;
  const mine = Object.values(se.games).filter(g => g.played && (g.home === user || g.away === user));
  const g = mine[mine.length - 1]; if (!g) return null;
  const day = deskDay(save); if (save.pgDone && save.pgDone.gid === g.id && save.pgDone.day !== day) return null;   // once per game (the day after it)
  const P0 = id => save.players[id];
  let star = (g.stars || []).find(s => s.teamId === user && P0(s.pid) && P0(s.pid).teamId === user);
  let p = star ? P0(star.pid) : null;
  if (!p) {
    const t = save.teams[user]; let best = null;
    for (const id of [...t.roster.lines.flat(), ...t.roster.goalies].filter(Boolean)) { const q = P0(id), f = q && (q.form || []).find(x => x.gid === g.id); if (f && (!best || f.imp > best.f.imp)) best = { q, f }; }
    if (!best) return null; p = best.q;
  }
  save.pgDone = { gid: g.id, day };
  const us = g.home === user ? g.hs : g.as, them = g.home === user ? g.as : g.hs, won = us > them, opp = save.teams[g.home === user ? g.away : g.home];
  const oN = opp.nick || opp.name, pick = a => a[Math.floor(rng() * a.length)];
  const m = typeof motiveOf === 'function' ? motiveOf(p) : 'loyal', mood = typeof moodOf === 'function' ? moodOf(save, p).v : 60;
  const fl = (p.form || []).find(x => x.gid === g.id) || {};
  const line = p.pos === 'G' ? `${fl.sv || 0} saves` : (fl.g || fl.a) ? `${fl.g || 0} goal${fl.g === 1 ? '' : 's'}, ${fl.a || 0} assist${fl.a === 1 ? '' : 's'}`
    : star && star.stat ? star.stat.replace(/^\d+G \d+A,? ?/, '') || 'a big defensive night' : (fl.ds ? `${fl.ds} defensive stops` : 'a big night without the ball');
  const nm = p.last;
  const Q = [];
  Q.push(pick(won ? [`I'm here with ${p.first} ${nm}. ${line} against the ${oN}. Big night! How did it feel?`, `${nm}! ${line}. Talk to me. Talk to the people.`]
                  : [`${p.first} ${nm} joins me. ${line}, but a tough result against the ${oN}. What happened out there?`, `${nm}, rough one tonight. ${line} for you, though. Your take?`]));
  const A1 = {
    loyal: won ? ['It\'s all the guys. Every line chipped in. I just got lucky with the bounces.'] : ['We boot together. We\'ll look at the tape, fix it, and come back as a group.'],
    leader: won ? ['We set a standard tonight. Now we have to do it again Thursday.'] : ['That\'s on us. On me, first. We\'ll be better. I promise you that.'],
    scorer: won ? ['Felt great. When I get the ball in that spot, it\'s going in. Simple.'] : ['I had chances. I\'ll bury them next time. Nobody\'s more upset than me.'],
    money: won ? ['Big night, big games, that\'s what I\'m here for. Write that down for my agent.'] : ['Business is business. We\'ll get the next one.'],
    winner: won ? ['Two points. That\'s all that matters. Stats are nice, wins are better.'] : ['I hate losing. Hate it. Can\'t sleep tonight.'],
  };
  const Q2 = pick(['Be honest. Did you see me flex at you before the game?', 'Some say your style reminds them of the Anderson Era. Comment?', 'What do you eat before a game? Asking for me. I\'m always eating.',
    'Did The Bone\'s suit distract you at all tonight?', 'You\'re on BALL TALK. Anything to say to the fans?']);
  const A2 = {
    'Be honest. Did you see me flex at you before the game?': ['I did. I thought something was wrong with you.', 'Everybody saw it, Mr Anderson. The whole arena saw it.'],
    'Some say your style reminds them of the Anderson Era. Comment?': ['Who says that?', 'I was two years old in the Anderson Era. But sure. Thank you?'],
    'What do you eat before a game? Asking for me. I\'m always eating.': ['Pasta. Same as always. You know that, you asked me last week.', 'Chicken, rice. And whatever you leave in the fridge.'],
    'Did The Bone\'s suit distract you at all tonight?': ['I could see it from the pitch. Through the hoardings.', 'Our keeper said he lost a shot in it.'],
    'You\'re on BALL TALK. Anything to say to the fans?': mood >= 60 ? ['Thanks for being loud tonight. We heard you.', 'Keep coming. We feed off it.'] : ['We\'ll give you more. That\'s all I\'ll say.', 'Thanks for sticking with us.'],
  };
  const unhappy = mood < 35 ? pick([' And I\'d like more playing time, if anyone\'s listening.', ' Not my favourite stretch here, honestly.']) : '';
  const lines = [
    [3, Q[0]], [2, pick(A1[m] || A1.loyal) + unhappy],
    [3, Q2], [2, pick(A2[Q2])],
    [3, pick([`${nm}, everybody. Back to the desk!`, `Great stuff, ${nm}. Go pitch those legs. Back to you guys.`, `That's ${nm}. Not as strong as me. But strong. Back to the desk!`])],
  ];
  return { pid: p.id, lines, won };
}

// ---------- weave it into the show: the chirps after the opening (and one later on), the interview after the replays
if (typeof deskScript === 'function') {
  const origScript = deskScript;
  deskScript = function (save) {
    const sc = origScript(save), day = deskDay(save), rng = mulberry32(day * 131 + 11);
    const ch = deskChirps(save, sc.host, null, rng), L = sc.lines;
    // after the welcome and the suit line (the first two or three lines)
    const k1 = Math.min(L.length, (Array.isArray(L[0]) && Array.isArray(L[1]) && Array.isArray(L[2]) && /WHAT A GAME|not happy|Unacceptable|DID YOU SEE/i.test(L[0][1])) ? 3 : 2);
    L.splice(k1, 0, ...ch[0]);
    // the interview, right after the Replay Centre (or before the next-opponent segment if there were no replays)
    const pg = typeof deskPostgame === 'function' ? deskPostgame(save, rng) : null;
    const ri = L.findIndex(x => x && x.replays);
    let after = ri >= 0 ? ri + 2 : Math.min(L.length, k1 + ch[0].length + 2);
    if (pg && ri >= 0) L[ri].postgame = pg;                               // the interview closes the Replay Centre segment
    else if (pg) L.splice(after, 0, [1, 'Mr Anderson has one of the boys down at the Replay Centre. Anderson?'], { postgame: pg });
    // the second chirp: near the end, before the headlines run out
    L.splice(Math.max(after + 1, L.length - 2), 0, ...ch[1]);
    return sc;
  };
}
