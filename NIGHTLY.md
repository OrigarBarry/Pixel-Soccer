# Pixel Soccer: nightly reports (newest first)

The two reports below were written before this repository existed and were first kept in the Claude project (claude/pixel-soccer-nightly.md). From 25 Nov 2026 the nightly run writes here.

## 25 Nov 2026, evening (Pixel Soccer project chat, not a nightly run)

**Short version:** bigger goals, as Barry asked: about 20% wider and taller. Keepers reach further to match, so a good keeper can still get across to the posts, and only keepers with good reflexes jump high enough for the top of the bar. Goals went from about 5 to about 6 a match. Published, zero errors.
- [Before (left) and after (right)](nightly/2026-11-25/bigger-goals.png).
- Tested: 10 computer-vs-computer matches (6.1 goals a match), one-on-one shot tests, a real-time match with intro and celebrations, a season sim.
- Page versions: started from **1795583122-8d57**, published **1795672662-d6e8**. To roll back, republish 1795583122-8d57.

## 24 Nov 2026, last thing (Pixel Soccer project chat, not a nightly run)

**Short version:** bigger, more detailed boots, as Barry asked: an ankle collar, laces, a toe pointing outward, the stripes down the side and a studded sole. [Picture](nightly/2026-11-24/boots.png). Published, zero errors (3 computer matches, a real-time match with intro and celebrations, gear screens).
- Page versions: started from **1795581487-cef7**, published **1795583122-8d57**. To roll back, republish 1795581487-cef7.

## 24 Nov 2026, later still (Pixel Soccer project chat, not a nightly run)

**Short version:** slimmer waists, as Barry asked. The shirt now tapers from the chest to a narrow waist, and the shorts and legs are slimmer too, so players have an athletic V shape. Keepers match. Published, zero errors.
- [Before (top) and after (bottom)](nightly/2026-11-24/slim-waist.png).
- Tested: 4 computer-vs-computer matches, a real-time match with intro, goal card and three stars, a season sim, and the gear screens: no page errors.
- Page versions: started from **1795580776-74a0**, published **1795581487-cef7**. To roll back, republish 1795580776-74a0.

## 24 Nov 2026, late night (Pixel Soccer project chat, not a nightly run)

**Short version:** as Barry asked, players are now a little taller and slimmer, and keepers have exactly the same build, just with gloves. Referees and bench players match. The pixels stay sharp. Published, zero errors.

### What I did
- Every player, keeper, referee and bench player is about 12% taller and 14% slimmer, standing on the same spot. [Before (left) and after (right)](nightly/2026-11-24/taller-slimmer.png).
- The ball still sits at the player's feet.
- Small wording fixes: the first-goal unlock is orange **sock** tape, the first-win unlock is purple **boot stripes**, and the legends screen says "Keeper shirt" instead of "Mask".

### Health
- 4 computer-vs-computer matches, a real-time match with intro, goal card and three stars, a 115-game season sim, every menu screen and the gear screens: no page errors (the Dream Builder note from earlier still applies).
- Speed: about 1 to 3 thousandths of a second more per frame in testing, too little to notice.

### What Barry should check
- Play a match and see if the new build feels right. It's one setting, so it's easy to make them even taller or slimmer.

### Page versions
- Started from **1795579059-7bca**, published **1795580776-74a0**. To roll back, republish 1795579059-7bca.

## 24 Nov 2026, night (Pixel Soccer project chat, not a nightly run)

**Short version:** every player and all the customisation are now football kit. Player cards show footballers instead of hockey helmets and goalie masks. The gear menus offer boots, socks, shorts, shirts, shin pads, sock tape and extras, and keepers get shirt designs (52 of them) instead of masks. Published, zero errors.

### What I did
- **Player cards:** a footballer's head with his hairstyle, plus a headband, keeper cap or snood if he wears one. Keepers wear their own shirt. [Portraits](nightly/2026-11-24/portraits.png).
- **Player Gear & Look:** Boots (11 colours, gold boots unlocked by the Golden Boot award), Boot stripes, Shin pads, Sock tape and Extras (wristbands, taped wrists, snood, long undershirt, keeper cap, armband). [Boots page](nightly/2026-11-24/gear-boots.png).
- **Team kit (Team Look > Uniforms):** shirt fit (long or short sleeves, polo or laced collar), shorts colour and style (retro short-shorts, long and baggy, cycling shorts under), socks (rolled down showing the shin pads, over the knee, hoops, stripes), gloves and headbands.
- **Keepers:** the Mask Studio is now the **Keeper Shirt Studio**: 52 shirt designs (tiger, shark teeth, galaxy, hornet, camo, flames and more) with the same shop, legendary unlocks and paint shop. Keepers also pick glove colours and glove designs. [Keeper Shirt Studio](nightly/2026-11-24/keeper-shirt-studio.png).
- **Hair:** three new hairstyles: mohawk, man bun and shaved.
- **Variety:** every player now wears his own boots, stripes, sock tape and extras, the same every season.
- [All the kit options on players](nightly/2026-11-24/kit-options.png).
- Old saves load fine: any old hockey item turns into the football default.

### Health
- 4 computer-vs-computer matches, a real-time match with intro, goal card and three-stars outro, a 115-game season sim, every menu screen, and the gear, keeper shirt and uniform screens: no page errors.
- Found, already there before tonight: the Dream Builder screen errors if opened directly without a player. The normal menus always open it with one.

### What Barry should check
- Season > Gear & Look: step through the parts for an outfield player and for a keeper.
- Team Look > Uniforms: try the shorts and socks styles.
- Look at a few player cards (roster, draft).

### Page versions
- Started from **1795577594-2097**, published **1795579059-7bca**. To roll back, republish 1795577594-2097.

## 24 Nov 2026, later evening (Pixel Soccer project chat, not a nightly run)

**Short version:** the commentary no longer sounds like hockey. I read every commentary line and big-screen ad and rewrote about 25 that still did, plus a few menu labels. I also fixed the in-match report button, which was covering the middle of the scoreboard. Published, zero errors.

### What I did
- Took the commentary item on the list and marked it taken first.
- Rewrote, for example:
  - "he was in the blue paint" is now "he went through the keeper"
  - "kicks it away with the pad" is now "saved with his feet"
  - "what a snipe" is now "what a strike"
  - "he loses the handle" is now "heavy touch! He loses it!"
  - "over the net and off the back hoardings" is now "over the bar and into the net behind"
- Big screen: "sharper every shift", "cold pitch" and "taste the pitch" now read like football ads. The Winter Classic tournament is now The Boxing Day Classic.
- Menus:
  - "PP / PK challenge" (in football PK means penalty kick) is now Overload / Hold Out.
  - "Organ" sound options are now "Band".
  - "Harder punches" is now "harder challenges".
  - "Odd-man rushes" are now "counter-attacks".
- **Bug fixed:** the little report flag in matches sat on top of the scoreboard's middle label on sharp screens. It now sits just to the right. [Picture](nightly/2026-11-24/scoreboard-report-button.png).
- Noticed, left for the Look Studio item: hockey gear in the cosmetics (keeper masks, cages, a "Gold Visor" reward).

### Health
- 7 computer-vs-computer matches, a real-time match with intro, goal card and three-stars outro, a 115-game season sim, the Overload challenge, and the Challenges, Arena, main menu and Settings screens: no page errors.

### What Barry should check
- Play a match and listen to the commentary.
- Start a challenge from Challenges & Drills: the scoreboard should read OVERLOAD with the flag button beside it, not on top.

### Page versions
- Started from **1795575974-d33a**, published **1795577594-2097**. To roll back, republish 1795575974-d33a.

## 24 Nov 2026, evening (Pixel Soccer project chat, not a nightly run)

**Short version:** the pitch is now edged like a football ground: straight advertising hoardings that meet at square corners, in a dark steel frame, with no yellow hockey kick strip. Published, zero errors.

### What I did
- Took the top item on the list (hoardings) and marked it taken first.
- The pitch's corners were the rink's rounded corners. They're now square. They sit behind the goal lines, so nothing changes while the ball is in play.
- The default boards were white hockey boards with a yellow strip along the bottom. They're now a dark steel frame around the adverts. No board style has the yellow strip any more.
- In Arena > Hoardings, the default is now called **Steel frame**.
- Picture: [the far end with the new hoardings and the net](nightly/2026-11-24/hoardings.png).

### Health
- 4 computer-vs-computer matches, a real-time match with intro, goal card and three-stars outro, a 115-game season sim, and the Arena, main menu and Settings screens: no page errors.

### What Barry should check
- Play a match and look at the corners and the far end.
- Season > Arena > Hoardings: Steel frame, Vintage wood, All black and Digital LED should all look right.

### Page versions
- Started from **1795571054-dfe0**, published **1795575974-d33a**. To roll back, republish 1795571054-dfe0.

## 24 Nov 2026, afternoon (Pixel Soccer project chat, not a nightly run)

**Short version:** the hockey glass is gone. Behind the far goal there's now a football-style ball-stop net: a straight run of netting on posts, standing in front of the fans, and it ripples when a shot flies over the bar. Published, zero errors.

### What I did
- Took the top item on the list (the hockey glass) and marked it taken first.
- The old "glass" (already drawn as netting) curved round the rink's corners on posts like hockey glass, and sat behind the crowd, so only a dark band showed. Now:
  - **One straight net behind the far goal**, about as wide as the penalty box, on seven posts with a sagging top cable. Nothing round the corners or down the sides.
  - **It stands in front of the fans** behind that goal, so you see them through the mesh.
  - **A shot over the bar ripples it.**
  - **Arena menu > Ball-stop nets** (White / Black / Gold) changes its colour, and the menu's preview shows it.
- Pictures: [the net, still and rippling](nightly/2026-11-24/ball-stop-net.png), [the Arena menu preview](nightly/2026-11-24/arena-preview.png).
- Added a new item to the list: the hoardings still have the rink's rounded corners and white hockey boards.

### Health
- 5 computer-vs-computer matches, a real-time match with intro, goal card and three-stars outro, a 115-game season sim, and the Arena, main menu and Settings screens: no page errors.
- Goals were about 5 a match, as the nightly run found. That question is still under "Ask Barry first".

### What Barry should check
- Play a match and look at the far end: the net behind the goal, and blaze one over the bar.
- Season > Arena > Ball-stop nets: try White, Black and Gold.

### Page versions
- Started from **1795533811-0755**, published **1795563851-4b63**. To roll back, republish 1795533811-0755.

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
