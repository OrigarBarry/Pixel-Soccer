# Pixel Soccer: to-do list

The nightly run takes the top unticked item under "Next up". Barry and his chats edit this list. Anything under "Ask Barry first" is never built until Barry decides.

## Next up
- [ ] **Merge the old list.** Before 24 Nov another chat kept a soccer to-do list at soccer/NIGHTLY-LIST.md inside the OrigarBarry/pixel-hockey repo. If you can open that repo, copy any of its open items that are missing here (keep their order, above the items below), then stop using it. If you can't open it, say so in the report and carry on.
- [ ] **From Pixel Hockey (compared 24 Nov with hockey page version 1795563867-b742), one at a time:**
  - [x] **Real-name guard:** *(done 24 Nov, version 1795570671-461c)* generated players never share a full name with a famous real player. Hockey uses NHL names; soccer needs a list of famous footballers (realnames.js).
  - [x] **Small screen fixes:** *(done 24 Nov, version 1795570671-461c)* coach tips sized to the real text, never more than two pop-up messages piled up, help lines as "plain sentence, details underneath", side-screen captions and star card text that no longer wrap or get cut off (coach.js, broadcast.js, help.js, index.html).
  - [ ] **Smaller saves that never lose anything:** season saves compressed (about 5 times smaller), and old records go to a "vault" instead of being deleted (store.js, league.js). Old saves must still load.
  - [ ] **Highlights kept until you delete them:** with DELETE and SELECT in League History > Highlights (legacy.js, present.js, league.js).
  - [ ] **"While you were away" card:** everything that happened since you last looked, biggest moments first (ui2.js).
  - [ ] **Jersey backs:** a player's shirt back with his name and number on cards, captions and the scoreboard; each kit picks its number style (plain, shadow, outline) and colour (clubjersey.js, sprites.js, art.js, scenery.js, broadcast.js, present.js).
  - [ ] **The Look Studio:** one screen for everything your team wears (identity, colours, kits, player gear, saved looks with share codes), replacing three editors. Needs soccer gear (boots, shin pads, keeper gloves) instead of sticks, skates and goalie masks (studio.js, a big job).
  - [ ] **Broadcast desk:** hockey's PUCK TALK show has grown a lot (much more banter and audio). Check what soccer's desk shows today and port what fits, rewritten for soccer (desk.js, deskaudio.js, deskbanter.js, a big job).
  - Skipped (hockey only): fight changes (players fired up / rattled after a fight).

## Ask Barry first
(Nothing waiting. Barry answered the four questions on 24 Nov, see "Barry's decisions" below.)

## Barry's decisions
- 24 Nov 2026: **Goals stay high** (about 5 a match). Arcade scoring is fine; don't tune it down.
- 24 Nov 2026: **Keeper goes up for a last-minute corner** when his team is losing: yes, build it.
- 24 Nov 2026: **No video-review moment** for penalties (keeps the game moving).
- 24 Nov 2026: **Cup extra time stays as it is**: full extra time, then penalties (no golden goal).

## Found by the nightly run
- 24 Nov 2026 (chat): the half-time mowing machine left the drawing state stacked up every frame (a line of code joined onto a note). Fixed.
- 24 Nov 2026 (chat): a restart could wait for ever if the big-screen replay or a referee never got set. Each wait now has a limit (12 s and 3 s).
- 24 Nov 2026: half-time clock not reset at the start of a match. Fixed.
- 24 Nov 2026: results screen showed wins-losses-draws. Fixed.
- 24 Nov 2026: How to Play said a big tackle from behind "is a penalty". Fixed ("is a foul").
- 24 Nov 2026: main-menu backdrop and Settings camera preview still showed an ice rink. Fixed (grass pitch).

## Done
- [x] 24 Nov 2026 (chat, page version 1795564774-6935): **Keeper goes up for a last-minute corner.** Losing side, last 15% of the second half, added time or late extra time. He sprints up, the corner waits for him (defenders keep their distance), the cross often goes to him, and he races back if it's cleared. In 16 test corners the trailing side equalised 5 times and conceded into the empty net once.
- [x] 24 Nov 2026: **Added time and advantage tested** in 48 full CPU matches: added time +1 to +4 a half, no freezes, no errors. Advantage was too rare (1 foul in 15): now allowed anywhere outside the fouled side's own third, with a teammate as close to the ball as any opponent; it now comes up on about 1 foul in 4.
- [x] 24 Nov 2026: Head-to-head record now shows wins-draws-losses.
- [x] 24 Nov 2026: Today's Challenge: "Extra Attacker" became "Last Gasp" (no pulled keeper, 1:00 to play); "the third" → "the second half"; "they will pull their keeper" → "they will throw everyone forward".
- [x] 24 Nov 2026: "The Hammer" award is for the best tackler (it counts the TKL stat).
- [x] 24 Nov 2026: Browser tab icon: a little pixel soccer ball.
- [x] 24 Nov 2026: Glass behind the goals: already netting on every setting; another chat is drawing a proper ball-stop net (page version 1795563851-4b63).
- [x] 24 Nov 2026: Wording pass: hockey terms players could see replaced with soccer ones.
- [x] 24 Nov 2026: Added time and advantage rules; three unwinnable achievements replaced; help updated.
- [x] 24 Nov 2026: Moved to its own repository (OrigarBarry/Pixel-Soccer).
