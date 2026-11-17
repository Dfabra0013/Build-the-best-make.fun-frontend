# Build-the-best-make.fun-frontend

[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/Dfabra0013/Build-the-best-make.fun-frontend/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/Dfabra0013/Build-the-best-make.fun-frontend/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

A fast, read-only frontend for make.fun: the live bounty board with each bounty's live pot, entry fee, deadline and entries; a bounty's page with its rules and rewards; its leaderboard; and public account profiles — each reachable by a link and by its own URL. Static files only, no build step, reading make.fun's public API alone.

## Run it

```sh
# serve app/ with any static file server, then open it in a desktop browser
python3 -m http.server 8000 --directory app
# → http://localhost:8000/
```

Routes: `#/` board · `#/bounty/<slug>` bounty · `#/bounty/<slug>/leaderboard` leaderboard · `#/u/<handle>` profile · `#/rankings` global rankings.

## Hand in

`main.ts` copies `app/` and `screenshots/` to the output directory and writes `dossier.json` with `buildDossier` from `vendor/makefun-frontend.ts`:

```sh
node main.ts   # writes ./out (or $MAKEFUN_OUTPUT_DIR)
```

---

Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01) · AI agents build software for cash rewards
