# Pixel Soccer: nightly reports (newest first)

The two reports below were written before this repository existed and were first kept in the Claude project (claude/pixel-soccer-nightly.md). From 25 Nov 2026 the nightly run writes here.

## Night of 24 Nov 2026 (run at 04:10 Dawson Creek time)

**Short version:** published a fixed build. The half-time clock bug from last night is fixed (every match now starts its first half on the full time, and your very first game really gets one-minute halves). I also fixed two wording slips and replaced two leftover hockey pictures: the main-menu backdrop and the Settings camera preview now show a grass pitch instead of an ice rink. Zero errors in testing. Goals are running high (about 5 a match), which needs your call.

### Health (tests and errors)
- **Page errors:** none, across 24 computer-vs-computer matches, a keyboard-controlled match, every main menu and a new franchise with 3 simulated games. (The only failed load is the missing browser tab icon, which is harmless.)
- **Restarts never got stuck:** 65 throw-ins, free kicks and corners in the final 10 matches, plus kickoffs, goal kicks and penalties. The longest anyone stood over a restart was under 1 second of play; the longest stoppage of any kind was about 9 seconds (a goal celebration).
- **Clock:** all 24 matches started their first half at 1:40, including every match played straight after another one. Before the fix, matches after the first started on 0:00.
- **Your first game:** Quick Play started with one-minute halves (1:00 on the clock), as promised.
- **Goals:** about **5 a match** (4.8 over 12 matches, 5.5 over 10; one 9–5 thriller), well above the 2–3 target.
- **Season mode:** created a franchise, ran the draft lottery, auto-drafted and simulated 3 games. No errors; the results screen and the hub both show the record as wins-draws-losses.

### What I did
- Fixed: half-time clock not reset at the start of a match; results screen record order (now wins-draws-losses); How to Play "is a penalty" → "is a foul"; main-menu backdrop now a grass pitch; Settings camera preview now a green pitch with its two penalty boxes.
- Couldn't open the to-do list (no access to the repository it was pointed at).

### What Barry should check
- Play two Quick Play games in a row: both should start their first half at the full time.
- Main menu and Settings > Gameplay: grass, not ice.
- Season mode: the record on the results screen and the hub read the same way.

### Questions for Barry
- Goals are about 5 a match (target 2–3). Bring it down now, or play first and decide? (Now on the list under "Ask Barry first".)

### Page versions
- Started from 1795505280-8255, published 1795533811-0755 (version 7). To roll back, republish 1795505280-8255.

### For the developer chat (technical)
- js/engine.js (newGame: `S.clock = S.periodLen; S.saidMin = false; S.comm = null;` moved out of a comment), js/season2.js line 82 (`st.w-st.otl-st.l`), js/ui.js (help text; drawCamPreview grass + PEN boxes), js/music.js (MenuBG.draw: pitch, ball).
- Not changed: season2.js line 282 "Your record over them: w-l" leaves out draws (now on the list).

## Night of 23–24 Nov 2026 (run at 00:40 Dawson Creek time)

**Short version:** tested only, no changes made (the page had changed 12 minutes before the run). Zero errors, one real bug found: the first half often started with the wrong time on the clock (fixed by the 04:10 run). 20 computer-vs-computer matches, a keyboard match, menus and 6 simulated season games; 3.8 goals a match over 10 matches. Page left at 1795505280-8255.
