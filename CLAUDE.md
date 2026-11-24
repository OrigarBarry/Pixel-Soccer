# Working rules for Claude (chats and scheduled runs)

Barry is not technical. Write to him in plain words, with screenshots, not code.

## The game and its copy
- The live page (artifact slug `d709d040-1b8c-484b-a6a5-32bd7e068c54`) is the source of truth. `game/` is a copy of it.
- **Before changing anything, sync:** list_files on the page, then read_file with `paths` in batches of up to 32. The files are saved under random names, so match each to its path by sha256. Put them in `game/` (index.html and js/). If anything differs from the repo, commit "Sync from live page <version>" first.
- **After publishing** a new page version (publish_files, changed files only, base_version = the version you started from), copy the same files into `game/` and push, so the repo never falls behind the page.
- This game has nothing to do with the Pixel Hockey repo (OrigarBarry/pixel-hockey). Never look for soccer files there and never change hockey files.

## Gameplay rules
- Read `notes/conversion-notes.md` before changing gameplay; add every new decision to it.
- Agreed so far: 3-on-3 with rolling subs, no offside, cards (no sin bin), league draws (3-1-0), added time, advantage, ball friction 0.983. Change these only with Barry's say-so.
- Never build anything listed under "Ask Barry first" in `NIGHTLY-LIST.md`.
- Never rename save keys; migrate old saves on load.

## Testing (before every publish)
Serve `game/` locally (`python3 -m http.server`) and drive it with Playwright (/usr/bin/google-chrome, --no-sandbox) at 1280×720. The game state is global: `S`, `update()`; `S.autoAI = true` plays computer against computer. Expect zero page errors, roughly 2–3 goals a game, and restarts that never stall (watch `S.phase`). Publish only a passing build.

## Git
Never force-push main. If a push is rejected, rebase onto the new main and try again.
