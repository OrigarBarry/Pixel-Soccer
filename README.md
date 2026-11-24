# Pixel Soccer

Pixel-art arcade 3-on-3 soccer with a full franchise mode (draft, trades, finances, crowds, commentary). It started on 23 Nov 2026 as a copy of Pixel Hockey and was converted to soccer. It is now its own game with its own repository: nothing here depends on the Pixel Hockey repo.

- **Play it:** the live page is the Claude artifact "Pixel Soccer" (slug `d709d040-1b8c-484b-a6a5-32bd7e068c54`). The live page is the source of truth; this repo keeps a copy of it plus the notes, the to-do list and the nightly reports.
- **Owner:** Barry (GitHub OrigarBarry). Desktop first: 1280×720, mouse and keyboard, gamepad.

## What's where

| Path | What it is |
|---|---|
| `game/` | A copy of the live page: `index.html` and `js/`. Open `game/index.html` through a local web server to play it. |
| `NIGHTLY-LIST.md` | The to-do list. The top unticked item under "Next up" is the nightly run's next job. Barry and his chats edit it. |
| `NIGHTLY.md` | The nightly run's reports, newest first. |
| `notes/conversion-notes.md` | How the game was converted from hockey and every design decision since. Read it before changing gameplay. |
| `nightly/<date>/` | Screenshots from nightly runs. |
| `CLAUDE.md` | Working rules for Claude chats and scheduled runs. |

## Saves

Saves live in the browser under their own keys (`pixelsoccer-*`, the `ps` prefixes, IndexedDB `pixelsoccer-franchise`). They never collide with Pixel Hockey's and must never be renamed.
