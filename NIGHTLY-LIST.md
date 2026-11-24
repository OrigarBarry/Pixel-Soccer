# Pixel Soccer: to-do list

The nightly run takes the top unticked item under "Next up". Barry and his chats edit this list. Anything under "Ask Barry first" is never built until Barry decides.

## Next up
- [ ] **Merge the old list.** Before 24 Nov another chat kept a soccer to-do list at soccer/NIGHTLY-LIST.md inside the OrigarBarry/pixel-hockey repo. If you can open that repo, copy any of its open items that are missing here (keep their order, above the items below), then stop using it. If you can't open it, say so in the report and carry on.
- [ ] **Glass screens on the default setting.** With Settings' glass option on "clear" (the default), see-through hockey glass is still drawn above the boards. A soccer ground has none: draw nothing there (or the ball-stop netting) for every option.
- [ ] **Play-test added time and advantage** (added 24 Nov). In computer-vs-computer matches, record how long added time runs per half, how often the referee plays advantage, how often it's called back, and check no restart stalls around them. Report the numbers; tune `ADDED` / `ADV` in js/rules.js only if something is clearly broken (e.g. advantage almost every foul, or never).
- [ ] **Head-to-head record leaves out draws.** js/season2.js around line 282, "Your record over them: w-l", should read wins-draws-losses like everywhere else.
- [ ] **Today's Challenge scenarios that pull the keeper.** Keeper pulling is off in soccer, but some challenge scenarios still set `sc.pull`. Check each one still makes sense and can be won; reword or replace any that can't.
- [ ] **"The Hammer" award** counts shoulder-charge hits. Switch it to tackles won (TKL), and reword its description.
- [ ] **Browser tab icon** is missing (one failed load on every visit). Add a small soccer-ball icon.
- [ ] **Bring over what Pixel Hockey gained.** Compare with the hockey page (slug 3850523d-6db4-4a2b-ad0f-b80e343e08e5) file by file, write each new feature here as its own line, then port one at a time (skip anything hockey-only: fights, icing, line rules).

## Ask Barry first
- **Goals are about 5 a match** (target 2–3) since the clock fix on 24 Nov. Options: keepers reach a little further; shorter added time; slightly slower shots. Waiting for Barry to play a few games and decide.
- **Keeper goes up for a last-minute corner** when his team is losing (a famous soccer moment; replaces the hockey "pull the goalie").
- **Video review moment** for penalties (a short "checking the replay" pause that can overturn the call).
- **Extra time format:** full extra time (current) or golden goal (next goal wins).

## Found by the nightly run
- 24 Nov 2026: half-time clock not reset at the start of a match. Fixed.
- 24 Nov 2026: results screen showed wins-losses-draws. Fixed.
- 24 Nov 2026: How to Play said a big tackle from behind "is a penalty". Fixed ("is a foul").
- 24 Nov 2026: main-menu backdrop and Settings camera preview still showed an ice rink. Fixed (grass pitch).

## Done
- [x] 24 Nov 2026: Wording pass: hockey terms players could see replaced with soccer ones.
- [x] 24 Nov 2026: Added time and advantage rules; three unwinnable achievements replaced; help updated.
- [x] 24 Nov 2026: Moved to its own repository (OrigarBarry/Pixel-Soccer).
