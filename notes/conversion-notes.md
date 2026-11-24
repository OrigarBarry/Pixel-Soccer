# Pixel Soccer: conversion notes

Built from Pixel Hockey (artifact 3850523d…, unchanged). Pixel Soccer artifact: d709d040-1b8c-484b-a6a5-32bd7e068c54. Own storage keys (ps*-, pixelsoccer-franchise), so saves never collide with hockey. Audit doc: https://claude.ai/artifact/Fb6bUdFtGvoRcsvGxneEgB.

Barry knows hockey well but not soccer, and has given creative liberty on soccer rules and gameplay: pick what makes it most fun and explain it.

Since 24 Nov 2026 the game has its own repository, OrigarBarry/Pixel-Soccer (game/ = copy of the page, NIGHTLY-LIST.md = to-do list, NIGHTLY.md = nightly reports). It no longer lives in the pixel-hockey repo.

## Design decisions
- Stays 3-on-3 with rolling line changes (the AI, tactics and league are built around it). No offside.
- Pitch = TL_L..TL_R × GL_TOP..GL_BOT inside the old rink walls; the strip beyond is run-off grass to the hoardings. Ball-stop nets replace the glass.
- Halves: the match starts in internal period 2 (1ST HALF); period 3 = 2ND HALF; 4+ = extra time. Labels via halfName().
- Out of play: throw-in / corner / goal kick. The taker is pinned until he plays it; CPU corners are crossed, free kicks within 150 of goal are shot with bend.
- Kickoffs go to the team that conceded; halves alternate.
- Keepers never freeze the ball; they punt it upfield in the air. Icing, fights and pulling the keeper are off (canPull() returns false).
- Goals: GOAL_HW 28, NET_H 16, NET_D 15. GK_REACH 1.9 (was 1.8 until round 6).
- Keepers use the outfield body with a keeper kit and gloves.

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
- **Advantage.** callFoul → advantageCheck(): a foul in the fouled team's attacking half, with a teammate first to the loose ball (within RK(55), 8 px closer than any opponent), is not whistled: "ADVANTAGE! PLAY ON", the yellow is still given at once. If the fouling team wins clean possession within ADV.callback (90 frames) it comes back for the free kick (advTick in rulesTick). Never for box fouls (penalty), fouls on the keeper, straight reds, or a man already on a yellow. S.adv is cleared by whistle(), setupFaceoff() and endPeriod().
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
- **Goal rate:** added time and the keeper changes together pushed goals to about 3.7 a match, so GK_REACH went 1.8 → 1.9 with GK.chal 26. In 22 CPU matches since: about 3.4 a match (small samples swing between 2.9 and 4.8). Season sim: 2.8 a game, points correct.
- **Wording:**
  - Sponsors: Puckstop → Kickstop, Slapshot → Screamer, with ball and boot board icons.
  - The memorabilia "stick" is now drawn as a boot, with BOOT, LACES and STUDS options (saved values are unchanged).
  - Crowd sign, "on the tape", "Goal guard, box man, presser", "Boots, shin pads, tape".
  - The pause-screen controls now show loft, bend and slide tackle, and no longer show pull or fight.
- **Gear screen:** it only failed with no season loaded, which a player can't reach. A guard message has been added anyway.
- Test note: launching a new match on top of a running one (without quitting) carries the clock over. That's a test-harness artifact; real play always quits first.

## Round 7: nightly fixes (Nov 24, version 1795533811-0755)
See NIGHTLY.md: half-time clock reset at match start, W-D-L on the results screen, "is a foul" help text, grass-pitch menu backdrop and Settings camera preview.

## Known leftovers / ideas
The live to-do list is NIGHTLY-LIST.md. Background:
- Goal rate: the 24 Nov nightly measured about 5 a match once the clock bug was fixed (target 2–3). Waiting on Barry. Levers: GK_REACH 1.9 → 2.0, shorter ADDED.
- Keepers rarely catch crosses cleanly (they collect on the bounce); could tune the claim reach if crosses feel too strong.
- fight.js is still loaded (other files call it) but never triggers.
- Overload and Hold Out challenges keep 4v3 / 3v2 as optional arcade modes. Some daily scenarios still set sc.pull.
