# Pixel Soccer: to-do list

The nightly run takes the top unticked item under "Next up". Barry and his chats edit this list. Anything under "Ask Barry first" is never built until Barry decides.

## Next up
- [ ] **From Pixel Hockey (compared 24 Nov with hockey page version 1795563867-b742), one at a time:**
  - [x] **Real-name guard:** *(done 24 Nov, version 1795570671-461c)* generated players never share a full name with a famous real player. Hockey uses NHL names; soccer needs a list of famous footballers (realnames.js).
  - [x] **Small screen fixes:** *(done 24 Nov, version 1795570671-461c)* coach tips sized to the real text, never more than two pop-up messages piled up, help lines as "plain sentence, details underneath", side-screen captions and star card text that no longer wrap or get cut off (coach.js, broadcast.js, help.js, index.html).
  - [x] **Smaller saves that never lose anything:** *(done 24 Nov, version 1795570913-2b76: saves about 5x smaller; round-trip, old-save and storage tests pass in this browser; the account-storage path is hockey's, untested here)* season saves compressed (about 5 times smaller), and old records go to a "vault" instead of being deleted (store.js, league.js). Old saves must still load.
  - [x] **Highlights kept until you delete them:** *(done 24 Nov, version 1795571007-98ff)* with DELETE and SELECT in League History > Highlights (legacy.js, present.js, league.js).
  - [x] **"While you were away" card:** *(done 24 Nov, version 1795571054-dfe0)* everything that happened since you last looked, biggest moments first (ui2.js).
  - [ ] **Jersey backs:** a player's shirt back with his name and number on cards, captions and the scoreboard; each kit picks its number style (plain, shadow, outline) and colour (clubjersey.js, sprites.js, art.js, scenery.js, broadcast.js, present.js).
  - [ ] **The Look Studio:** *(the football gear part is DONE 24 Nov, version 1795579059-7bca: no sticks, skates, helmets or masks anywhere; see Done. Still open: hockey's single "Look Studio" screen that puts identity, colours, kits, gear and saved looks with share codes in one place)*
  - [ ] **Broadcast desk:** hockey's PUCK TALK show has grown a lot (much more banter and audio). Check what soccer's desk shows today and port what fits, rewritten for soccer (desk.js, deskaudio.js, deskbanter.js, a big job).
  - Skipped (hockey only): fight changes (players fired up / rattled after a fight).

- [ ] **Football feel:** ball physics, first touch, keeper positioning and saves, set pieces, crowd and chants. *(from the old list)*

## Ask Barry first
(Nothing waiting. Barry answered the four questions on 24 Nov, see "Barry's decisions" below.)

## Barry's decisions
- 24 Nov 2026: **Goals stay high** (about 5 a match). Arcade scoring is fine; don't tune it down.
- 24 Nov 2026: **Keeper goes up for a last-minute corner** when his team is losing: yes, build it.
- 24 Nov 2026: **No video-review moment** for penalties (keeps the game moving).
- 24 Nov 2026: **Cup extra time stays as it is**: full extra time, then penalties (no golden goal).

## Found by the nightly run
- 24 Nov 2026 (chat): the in-match REPORT button (flag) sat on top of the scoreboard's middle label on sharp screens, covering it. It now sits just right of it on every screen. Fixed.
- 24 Nov 2026 (chat): the half-time mowing machine left the drawing state stacked up every frame (a line of code joined onto a note). Fixed.
- 24 Nov 2026 (chat): a restart could wait for ever if the big-screen replay or a referee never got set. Each wait now has a limit (12 s and 3 s).
- 24 Nov 2026: half-time clock not reset at the start of a match. Fixed.
- 24 Nov 2026: results screen showed wins-losses-draws. Fixed.
- 24 Nov 2026: How to Play said a big tackle from behind "is a penalty". Fixed ("is a foul").
- 24 Nov 2026: main-menu backdrop and Settings camera preview still showed an ice rink. Fixed (grass pitch).

## Done
- [x] **Football kit and gear overhaul** (24 Nov evening, version 1795579059-7bca):
  - Player cards show footballers' heads: hair on top (eight styles), a headband or keeper cap if worn. No more hockey helmets, visors, cages or goalie masks.
  - Gear is all football: boots (11 colours), boot stripes, shin pads, sock tape, and extras (wristbands, taped wrists, snood, undershirt, keeper cap, armband).
  - Team kit: shirt fit (long or short sleeves, polo or laced collar), shorts colour and style (short, baggy, cycling), socks (rolled down showing shin pads, over the knee, hoops), gloves, headbands.
  - Keepers: the 52 mask designs are now keeper shirts. The Mask Studio is now the Keeper Shirt Studio, with the same shop, legends and paint shop. Keepers also get glove colours and glove-back designs.
  - Three new hairstyles: mohawk, man bun, shaved.
  - Every player has his own seeded boots, stripes, tape and extras.
- [x] **Commentary that still read like hockey:** a full sweep of every commentary line and the big-screen ads. About 25 lines rewritten (e.g. "blue paint", "pad save", "lost the handle", "what a snipe", the Winter Classic, "sharper every shift"), plus menu labels (PP/PK challenge, organ, harder punches, odd-man rushes). The broadcast desk's chat is left for its own item. (24 Nov evening, version 1795577594-2097)
- [x] **Hoardings:** square corners, a dark steel frame round the ad panels, no hockey kickplate; Arena option renamed "Steel frame" (24 Nov evening, version 1795575974-d33a).
- [x] 24 Nov 2026: Merged the old soccer list from the pixel-hockey repo (its soccer/ folder has since been removed there).
- [x] 24 Nov 2026 (project chat, version 1795563851-4b63): Hockey glass replaced by a straight ball-stop net on posts behind the far goal that ripples when a shot flies over; White / Black / Gold in the Arena menu.
- [x] 23 Nov 2026: Golden Boot trophy drawn as a gold boot.
- [x] 23–24 Nov 2026: Team crests and board icons with puck or stick designs now show a ball or a boot.
- [x] 24 Nov 2026 (chat, page version 1795564774-6935): **Keeper goes up for a last-minute corner.** Losing side, last 15% of the second half, added time or late extra time. He sprints up, the corner waits for him (defenders keep their distance), the cross often goes to him, and he races back if it's cleared. In 16 test corners the trailing side equalised 5 times and conceded into the empty net once.
- [x] 24 Nov 2026: **Added time and advantage tested** in 48 full CPU matches: added time +1 to +4 a half, no freezes, no errors. Advantage was too rare (1 foul in 15): now allowed anywhere outside the fouled side's own third, with a teammate as close to the ball as any opponent; it now comes up on about 1 foul in 4.
- [x] 24 Nov 2026: Head-to-head record now shows wins-draws-losses.
- [x] 24 Nov 2026: Today's Challenge: "Extra Attacker" became "Last Gasp" (no pulled keeper, 1:00 to play); "the third" → "the second half"; "they will pull their keeper" → "they will throw everyone forward".
- [x] 24 Nov 2026: "The Hammer" award is for the best tackler (it counts the TKL stat).
- [x] 24 Nov 2026: Browser tab icon: a little pixel soccer ball.
- [x] 24 Nov 2026: Wording pass: hockey terms players could see replaced with soccer ones.
- [x] 24 Nov 2026: Added time and advantage rules; three unwinnable achievements replaced; help updated.
- [x] 24 Nov 2026: Moved to its own repository (OrigarBarry/Pixel-Soccer).
