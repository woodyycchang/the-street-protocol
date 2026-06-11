# STREET PROTOCOL

A 3D browser action game in one HTML file. Ride a motorcycle 3 km down a neon Street, talk to avatars of different render tiers, then duel the visual virus a courier just unfurled in front of Club Eclipse. Katana, parries, i-frame dashes, one angry daemon.

**Play:** open `index.html` in a desktop browser. That's the whole install. No server, no internet connection, no assets to download. The file is 699 KB with three.js embedded.

Once GitHub Pages is enabled for this repo (Settings → Pages → deploy from `main`, root), the game is playable at:
`https://woodyycchang.github.io/the-street-protocol/`

## Controls

| Input | Action |
|---|---|
| W / S | throttle, brake (walk forward/back on foot) |
| A / D | lean on the bike, strafe on foot |
| Shift | turbo |
| E | talk to avatars |
| Left mouse | katana slash |
| Right mouse | guard. Tap as a glyph lands to parry it back |
| Space | dash (brief invulnerability) |
| P / M | pause, mute |

Parried glyphs fly back at the boss and build expose stacks. Three stacks knock it low; that's your punish window. Slain wisps sometimes drop integrity shards.

## What's inside

Everything is procedural: geometry, textures, music, and sound are generated in code at load time. There are no asset files. The build embeds three.js r128 (MIT, banner preserved), so the game runs offline and never drifts with a CDN.

Production hardening in v1.0.0: auto-pause when the tab loses focus, WebGL context-loss recovery screen, a runtime error overlay instead of silent black screens, a reduce-flashing mode for photosensitive players, and adaptive resolution under sustained slow frames.

## Development

Source lives in `parts/` (nine concatenated sections), assembled by `build.py`, which also embeds the vendored three.js and syntax-checks the result.

```bash
npm install        # jsdom + three (dev only, for tests and the embed)
npm run build      # parts/ -> index.html
npm run test:all   # main suite + honest end-to-end + production checks
```

The game was built and validated headless, without a GPU. The test harness boots the real game logic under jsdom with a stubbed renderer and plays it with scripted inputs:

- `test/play.js` — 82 assertions: bike physics, dialog, arrival, every combat mechanic in a clean room, defeat/restart cycles, and a two-minute input fuzz soak
- `test/e2e_honest.js` — no debug warps: a full ride on real key events, walking to the courier, and the duel, with retries through the death screen like a real player
- `test/prod.js` — 29 assertions on the hardening features
- `test/sweep.js` — the shared duel bot across 8 RNG seeds (currently wins 7/8)
- `test/bot.js` — the fighter both suites share: guard-cycling, lunge dashes, shard pickups

The rendering layer is the one thing headless testing can't see, so visuals were tuned by construction and verified on real hardware afterward.

## Status and license

v1.0.0. Game code is copyright © 2026 Yung-Chia Chang, all rights reserved for now; a source license may follow. three.js is MIT (see `NOTICE`).

An original homage to Neuromancer, Snow Crash, The Matrix, and Ghost in the Shell. No text from these works appears here; every name and line of dialogue is original.
