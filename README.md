<div align="center">

# 🌴 Tropical ToDos

### A calm, local-first to-do list with a cinematic beach backdrop and gentle ocean waves.

**▶ Live app: [troplist.com](https://www.troplist.com/)**

<img src="docs/screenshot.png" alt="Tropical ToDos — a vintage poster masthead over a cinematic beach video, with tasks on dark lava-rock pills" width="420" />

*Private by design · offline-first · zero network · installable PWA*

</div>

---

## What it is

A single-page to-do list that runs **entirely in your browser**. No account, no server, no network calls after the page loads — your tasks live only on your device. Behind the list plays a real, looping beach video with optional gentle wave sound and occasional real bird calls, framed by a vintage poster masthead.

## Features

- **Natural-language quick-add** — type `Pay invoice #billing tomorrow 3pm` and it parses the title, the `#billing` tag, and the due date/time automatically.
- **Work · Home · Misc** — wording and times suggest a box; a referenced time files it (e.g. `Pay invoice tomorrow 3pm` → Work). Drag any task onto a bucket, or click an icon under search to open it.
- **Calm date buckets** — Overdue · Today · This Week · Later · Someday.
- **Thesaurus + fuzzy search** over titles, `#tags`, and notes (`invce` finds "invoice"; `laundry` finds "wash the clothes").
- **Keyboard-first** — `/` search · `n` new · `j`/`k` move · `x` complete · `e` edit · `⌫` delete · `?` help.
- **Cinematic beach background** — an AI-rendered, seamlessly looping video (with a graceful still-image fallback). Tasks sit on dark "lava-rock" pills so text always reads.
- **Continuous ocean waves + birds** — a seamless 60-second PCM soundscape, on after the first interaction, with a one-tap mute toggle. The app keeps it playing when hidden; mobile operating systems may still suspend audio.
- **Backup, your way** — one-click JSON export, restore (merge or replace), and optional auto-backup to a folder you grant.
- **Offline-first PWA** — installable to your home screen with a tropical palm-and-sun icon; works with no connection.
- **Light & dusk themes** follow your system preference.

## Privacy

This is *private-by-no-network*. Data is stored in your browser's IndexedDB and never transmitted anywhere. The persistence layer is a single swappable module, so encrypted-at-rest storage can be added later without a rewrite.

## Install

Open [troplist.com](https://www.troplist.com/) and use your browser's **Install** / **Add to Home Screen** option. It launches full-screen as **Tropical ToDos**.

## Run it yourself / deploy

Static files, zero build step. To host on GitHub Pages:

1. Copy the repo contents into a repository.
2. **Settings → Pages → Deploy from branch → `main` /(root)**.
3. Visit `https://<user>.github.io/<repo>/`.

## Project structure

| File | Purpose |
| --- | --- |
| `index.html` | App shell, styles, poster masthead |
| `app.js` | Store (IndexedDB), parser, bucketing, fuzzy search, keyboard, backup |
| `ambient.js` | Beach video (dual-crossfade loop) + wave audio + sound toggle |
| `sw.js` | Offline app-shell service worker |
| `manifest.webmanifest` | PWA install metadata |
| `assets/` | Beach video (day/dusk, desktop/mobile), posters, waves loop, `birds/` chirp clips |
| `icons/` | App icons, maskable variants, Open Graph share card |
| `_build/` | Asset generators (icon, caustics, waves) — not shipped to runtime |

## Credits

- **Beach video** — AI-generated with Veo from the owner's own beach photograph; day/dusk grades via ffmpeg. Seamless loop via a dual-video crossfade (pattern adapted from [rain-view](https://github.com/StewAlexander-com/rain-view)).
- **Wave audio** — procedurally synthesized (CC0). Audio unlock pattern adapted from [pocket-card](https://github.com/StewAlexander-com/pocket-card).
- **Bird calls** — short clips from real recordings on [Wikimedia Commons](https://commons.wikimedia.org/) (Common Tailorbird, Indian White-eye & Song Wren, CC BY-SA 4.0; Indian Golden Oriole, public domain), mixed into the surf loop at build time, with their existing attribution retained.
- Built by [StewAlexander.com](https://stewalexander.com).

## Language and audio regression checks

Run `node tests/regression.cjs`, `node tests/soundscape.cjs`, and `python3 tests/audio_asset.py`. Rebuild the
combined audio using `python3 _build/make_ambient.py` (requires ffmpeg). The local
task thesaurus covers phrases and word forms for category suggestions and search;
it preserves original titles, explicit category choices, and learned vocabulary.
No remote model or thesaurus service receives task data.

The audio player decodes the soundscape once and loops on the Web Audio clock.
The mix uses a three-second equal-power crossfade with smooth easing, gentler
bird envelopes, and short gain ramps for mute/unmute. A media-element fallback
is retained for browsers without Web Audio (gapless playback is not guaranteed
in that fallback). `tests/audio-browser.html` renders two complete loops at
48 kHz using OfflineAudioContext and checks the actual rendered wrap.
