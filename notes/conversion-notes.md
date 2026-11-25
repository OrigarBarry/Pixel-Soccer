# Pixel Soccer: conversion notes

Built from Pixel Hockey (artifact 3850523d…, unchanged). Pixel Soccer artifact: d709d040-1b8c-484b-a6a5-32bd7e068c54. Own storage keys (ps*-, pixelsoccer-franchise), so saves never collide with hockey. Audit doc: https://claude.ai/artifact/Fb6bUdFtGvoRcsvGxneEgB.

The user knows hockey well but not soccer, and has given creative liberty on soccer rules and gameplay: pick what makes it most fun and explain it.

Nightly runs (from Nov 24): two a night, run 1 at 11:09 pm and run 2 at 4:09 am America/Dawson_Creek. Both prompts were rewritten on Nov 24 (about 10:15 Whitehorse) for the new repo below; they no longer mention the sin bin.

Repository: **OrigarBarry/Pixel-Soccer** (Barry, Nov 24: Pixel Soccer should not depend on Pixel Hockey). It holds game/ (copy of the live page, synced at version 1795533811-0755), NIGHTLY-LIST.md (the to-do list), NIGHTLY.md (the nightly reports), notes/conversion-notes.md (this doc) and CLAUDE.md (working rules). Earlier on Nov 24 another chat had put a soccer/ folder inside OrigarBarry/pixel-hockey (commit 2e90712) with its own soccer/NIGHTLY-LIST.md; that folder is now retired. Its list couldn't be read from the chat that made the move (no access to pixel-hockey there), so its open items still need merging into the new NIGHTLY-LIST.md: a chat that can open pixel-hockey should copy any items missing from the new list, then mark soccer/ as moved.

## Design decisions
- Stays 3-on-3 with rolling line changes (the AI, tactics and league are built around it). No offside.
- Pitch = TL_L..TL_R × GL_TOP..GL_BOT inside the old rink walls; the strip beyond is run-off grass to the hoardings. Every glass option is drawn as netting (glass = 'netting' is forced in drawBoardsStatic / drawBoardsLive); another chat (page version 1795563851-4b63) is adding a proper ball-stop net behind the far goal (ballStopSpan / drawBallStopNet, BSN_UP).
- Halves: the match starts in internal period 2 (1ST HALF); period 3 = 2ND HALF; 4+ = extra time. Labels via halfName().
- Out of play: throw-in / corner / goal kick. The taker is pinned until he plays it; CPU corners are crossed, free kicks within 150 of goal are shot with bend.
- Kickoffs go to the team that conceded; halves alternate.
- Keepers never freeze the ball; they punt it upfield in the air. Icing, fights and pulling the keeper are off (canPull() returns false).
- Goals: GOAL_HW 28, NET_H 16, NET_D 15. GK_REACH 1.9 (was 1.8 until round 6).
- Keepers use the outfield body with a keeper kit and gloves.

## Barry's decisions (24 Nov 2026, 16:38 Whitehorse)
- Goals stay high (about 4–5 a match): arcade scoring is fine, don't tune it down.
- Keeper goes up for a last-minute corner: yes (built in round 8).
- No video-review moment for penalties.
- Cup extra time stays: full extra time, then penalties (no golden goal).

## Round 4 systems (audit follow-up)
- **Cards, no sin bin.** Fouls give a free kick and a yellow; a foul in the box gives a penalty kick. Second yellow or straight red (15% of fouls from behind, BAL.card.straightRed) sends the player off for the match, but his team is never a man down: the next man on the bench comes on (sendOff → refillIce). Only if no sub is left does the team play short. Cards are stored in the old PIM field (cards = pim / BAL.pen.len).
- **Draws.** League games can end level (decider 'draw'); points are 3-1-0, draws are stored in the old `otl` field. Cups/playoffs still go to extra time and shootouts.
- **Aerial game.** Ball has height (puck.h / vh, AIR constants). Loft key (E / RT) chips, crosses or plays a long ball depending on context. Headers, volleys, chest control, keeper claims and punches (aerialContact). CPU crosses out wide.
- **Slide tackle** replaces the stick poke (SLIDE constants). Ball first = tackle (TKL stat); man first = foul, likely if from behind.
- **Bend.** Holding a direction after shooting curves the ball (humanBend, curveTick).
- **Penalties** from the spot with the keeper on his line; shooter has 8 s.
- **Shoulder charges** knock players down far less often.
- **Sound.** Referee whistles, terrace drums, trumpet band instead of organ and horns.
- Stats renamed: INT/TKL/CRD/CS; W-D-L everywhere.

## Wording pass (Nov 24, version 1795503411-be28)
Swept every player-visible string literal for hockey terms. Changed:
- Scoreboard half label: "P1/P2" → "1H/2H" (scenery.js); last-goal HUD "OT" → "ET" (broadcast.js).
- "Power play" / "shorthanded" → "man advantage" / "man up" / "man down" (hlgen highlight captions, crowd signs, input help, 4th-player chooser in rules.js, special-teams panel in ui3.js).
- Sportsmanship award said "penalty minutes" (and divided pim by 60, wrong): now shows cards (pim / BAL.pen.len).
- goalie/skater → keeper/outfield player in farm, finance and gear prompts; promise "the starter's net / top-line minutes" → "the No. 1 shirt / first-team minutes".
- Skills coach "FO" → "set pieces"; "CPU check" → "CPU shoulder charge"; tactics "zone" / "shorthanded chances" text.
Deliberately kept: hat trick, glove save, hits the crossbar, empty net (all fine in soccer); "Dangle"/"Deke" move names; internal identifiers (puck, pim, otl, rink geo); code comments; debug screens; fight.js text (never triggers).

## Round 5: match-flow rules (Nov 24, version 1795504071-a256)
All new code is the "SOCCER MATCH FLOW" section at the end of rules.js; unit-tested in Node with a stubbed engine (19 checks). Round 6 ran it in browser CPU matches too: no errors.
- **Added time.** When a half's clock hits 0, addedTimeTick() (called from the engine's clock check) starts added time: mins = clamp(1 + floor(0.5·goals + 0.5·fouls/cards + 1·penalties/injuries + coin flip), 1, 5). One added minute = max(3, periodLen/30) game seconds (+3 in a 100 s half ≈ 10 s). Board floater + commentary; HUD, scoreboards and pause screen show "+0:07" in green (clockText()). At zero the ref lets an attack near either box finish (addedAttackOn), for at most one more added minute. Clock is held at 0 meanwhile, so all "late game" logic stays on. Only real matches: off when S.mode (challenges, drills, daily), S.so. State keyed on S.match, so a new match starts clean. Tuning: ADDED constants.
- **Advantage.** callFoul → advantageCheck(): a foul in the fouled team's attacking half, with a teammate first to the loose ball (within RK(55), 8 px closer than any opponent; loosened in round 8, see there), is not whistled: "ADVANTAGE! PLAY ON", the yellow is still given at once. If the fouling team wins clean possession within ADV.callback (90 frames) it comes back for the free kick (advTick in rulesTick). Never for box fouls (penalty), fouls on the keeper, straight reds, or a man already on a yellow. S.adv is cleared by whistle(), setupFaceoff() and endPeriod().
- Goals flagged in the scorer's stat line: addg (added time), advg (during advantage), with "IN ADDED TIME!" / "ADVANTAGE PAYS OFF!" floaters.
- **Achievements** that needed keeper pulling or long man advantages were replaced in place (same ids, same rewards): pp3 → Stoppage-Time Hero (score in added time), eng → Play On! (score during advantage), xatk → Last-Gasp Winner (win after an added-time goal). "Pull the keeper" removed from the in-game cheat sheet (already hidden on the controls screen).
- Help: new ADVANTAGE and ADDED TIME entries; TIES rewritten as DRAWS & TIES (league draws, cups go to extra time + penalties).
- Removed the `<script src="js/present.js">` tag because the file was missing from the page (it 404'd). Round 6 uploaded the file and restored the tag.

## Round 6: chips, keepers, present.js restored (Nov 24, version 1795505280-8255)
Merged on top of round 5 (the other chat's added time / advantage / wording pass), keeping its wording ("man advantage") where both chats had changed the same text.
- **present.js is back.** It did exist: it holds the match intros (starting lineups), goal celebrations and goal cards, the end-of-match three stars / stats outro, walkouts and tournament dressing. The first full publish left it out by mistake, so the page 404'd and the engine's `typeof` guards silently skipped all of that. Now uploaded and its script tag restored. Tested in a real-time browser match: intro, goal card, three-stars outro, no page errors. Its outro stats card shows CARDS and SAVES instead of POWER PLAY and KICKOFFS.
- **Chips work.** Before, 0 of 90 chips scored in a clean 1v1: the keeper stood 13–17 px out (hockey crease depth) and could reach any height up to ~32, above the chip's peak. Now:
  - 1v1 keepers come further off their line (GK.chal 18 → 26; mid-range depth 0.7×).
  - Keeper air reach AIR.keeperReach 30 → 20 (+ref×0.6). Still above the bar (16), so a keeper on his line claims anything under it.
  - A chip has a higher arc (hang 40–54 frames) and lands just inside the net, with a scatter from the shooter's accuracy, so an overhit sails over.
  - A keeper caught more than 14 px off his line is "lobbed": he scrambles back at about half speed and can only claim a ball dropping right on him.
  - Result in 1v1 tests from mid-range: chip about 40%, shot about 20–45% depending on angle; against a keeper who stays home the chip is claimed.
- **Lofted balls land where aimed.** loftBall() now allows for air drag over the whole flight (it only allowed 3%, so long chips and crosses dropped about 9% short).
- **Keepers come for crosses** that will drop in or near their six-yard box. They mostly collect on the bounce; few clean catches yet.
- **Goal rate:** added time and the keeper changes together pushed goals to about 3.7 a match, so GK_REACH went 1.8 → 1.9 with GK.chal 26. In 22 CPU matches since: about 3.4 a match (small samples swing between 2.9 and 4.8). Season sim: 2.8 a game, points correct. These numbers were measured while the clock bug was still in (see the correction below). With full-length halves the nightly run measured about 5 goals a match.
- **Wording:**
  - Sponsors: Puckstop → Kickstop, Slapshot → Screamer, with ball and boot board icons.
  - The memorabilia "stick" is now drawn as a boot, with BOOT, LACES and STUDS options (saved values are unchanged).
  - Crowd sign, "on the tape", "Goal guard, box man, presser", "Boots, shin pads, tape".
  - The pause-screen controls now show loft, bend and slide tackle, and no longer show pull or fight.
- **Gear screen:** it only failed with no season loaded, which a player can't reach. A guard message has been added anyway.
- **Correction:** I called "a new match carries the clock over" a test-harness artifact. It was a real bug: matches after the first started their first half on 0:00. The nightly run fixed it on Nov 24 (version 1795533811-0755). It also means the round 6 goal-rate tuning ran mostly on short matches.

## Round 8: keeper up, advantage tune, fixes (Nov 24 evening, version 1795564774-6935)
Merged on top of the other chat's 1795563851-4b63 (ball-stop net work in engine.js and gear.js; three-way merge, no conflicts). First chat round with a real browser test harness: 48 full CPU matches plus targeted tests, zero page errors.
- **Keeper up for a late corner** (KUP section at the end of rules.js). keeperUpCheck(team) runs in setupRestart for corners: losing side, S.period >= 3, last 15% of the half (min 10 s), added time or late extra time; not in modes/shootouts; never a keeper the human is steering. g.kUp = { st: 'up' | 'back', target }. thinkGoalie hands him to keeperUpThink (before goalieFetch); movement bounds are lifted while p.kUp is set (like outroFree). The corner waits up to KUP.waitMax 420 frames for him: restartTick holds the taker and pushes defenders 30 px away; the taker's thinkAI is skipped while waiting. Crosses go to him 45% of the time once he arrives; aerialContact lets an up-keeper head it like an outfield player. He turns back the moment the other side has the ball, the ball crosses halfway, or KUP.maxUp 600 frames pass, and the clamp returns once he is within 24 px of home. setupFaceoff and endPeriod clear it. Goal by an up-keeper: "THE KEEPER SCORES!!!" (stat kupg). Test: 16 corners, keeper arrived every time (about 3.7 s), trailing side equalised 5 times, conceded into the empty net once.
- **Advantage loosened:** measured 1 advantage in 15 fouls (most fouls were in the fouled side's own half or the fouler was nearer the ball). Now: anywhere outside the fouled side's own defensive third ((vic.y - CY)·dir ≥ −pitch/6), a teammate within RK(70) and no further from the ball than the nearest opponent (ADV.near 70, margin 0). Now about 1 foul in 4; most are called back when the defenders win it straight back. Help text updated.
- **Added time** in 48 matches: +1 to +4 a half; never froze a restart.
- **Fixes:** half-time mower line joined onto a comment (wetCtx.save() with no restore every frame); drop-ball restarts could wait for ever on the big-screen replay or on a referee who never got set: capped at 12 s and 3 s (S.fo.jbN, S.fo.refN), like kickoffs already were.
- **Small items:** head-to-head after a sim shows W-D-L (start.otl recorded); The Hammer = most tackles (the hit stat, shown as TKL); challenge "pulled" is now "Last Gasp" (no pulled keeper, 1:00, id kept for saves) and the other challenge texts say "second half" / "throw everyone forward" / "level after 90 minutes"; pixel soccer-ball tab icon (inline SVG in index.html).
- **Test harness** (kept outside the repo in the chat's tools folder): serves game/, steps the loop directly (update / interTick / introTick / celebTick), presses continue at half-time, treats the outro as full time. The jumbotron runs on real time, so a fast-forward harness can see it hold a drop-ball restart longer than real play would.

## Known leftovers / ideas
The live to-do list is NIGHTLY-LIST.md in the Pixel-Soccer repo. Background:
- Goal rate about 4–5 a match: Barry is happy with it (24 Nov). Levers if that changes: GK_REACH (1.9), GK.chal (26), ADDED.
- Keepers rarely catch crosses cleanly (they collect on the bounce); could tune the claim reach if crosses feel too strong.
- fight.js is still loaded (other files call it) but never triggers.
- Overload and Hold Out challenges keep 4v3 / 3v2 as optional arcade modes.
- The old soccer list in the pixel-hockey repo still needs merging (top of NIGHTLY-LIST.md).
