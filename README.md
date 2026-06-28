# Quiet — a calm, local-first todo PWA

Private by design. Runs entirely in your browser. No account, no server, no network calls after the page loads. Your tasks live in this device's IndexedDB only.

## Features
- **One-box quick-add** with natural-language parsing: `Pay invoice #billing tomorrow 3pm` → title, `#billing` tag, due Mon 3:00 PM.
- **Calm date buckets**: Overdue · Today · This Week · Later · Someday. Quiet section rules, not a wall of checkboxes.
- **Fuzzy search** over titles, #tags, and notes (subsequence match — `invce` finds `invoice`).
- **Tagging** with `#inline` syntax; click any tag to filter.
- **Keyboard-first**: `/` search · `n` new · `j/k` move · `x` complete · `e` edit · `⌫` delete · `?` help · `esc` clear.
- **Backup, your way**: one-click JSON export, restore (merge or replace), and optional File System Access auto-backup to a folder you grant — rotating, keeps last 10.
- **Offline-first PWA**: installable, works with no connection.
- **Light/dark** automatic.

## Privacy model (honest)
This is *private-by-no-network*, not encrypted-at-rest. Data is readable by anything with access to this browser profile. The persistence layer (`Store` in `app.js`) is a single swappable interface, so a future `EncryptedStore` (WebAuthn-unlocked AES-GCM) is a drop-in — no rewrite.

## Run / deploy to GitHub Pages
Static files, zero build step.

1. Create a repo and copy these files (`index.html`, `app.js`, `sw.js`, `manifest.webmanifest`) into it.
2. Push, then enable **Settings → Pages → Deploy from branch → main /(root)**.
3. Visit `https://<user>.github.io/<repo>/`. Install via the browser's "Add to Home Screen" / install icon.

To serve from a project subpath, the relative paths and `start_url: "."` already work — no changes needed.

## Files
- `index.html` — shell + styles
- `app.js` — Store, parser, bucketing, fuzzy search, keyboard, backup, confetti
- `sw.js` — offline app-shell cache (bump `CACHE` to ship updates)
- `manifest.webmanifest` — install metadata

## Ambient beach (optional)

A calm, stylized beach can sit behind the list — palm fronds, a turquoise lagoon, drifting sun-sheen, and a gentle shore-foam wash that breathes. Tap the wave icon in the header to cycle three states:

1. **Off** — the clean default.
2. **Scene** — visuals only.
3. **Scene + waves** — adds a looping ocean-surf sound (`assets/waves.mp3`).

Details:
- **Off by default.** Your choice is remembered on the device (in IndexedDB meta).
- **No autoplay.** Per browser rules, the wave sound starts only after you tap — when restored from a saved session it arms on your first interaction.
- **Stylized, not a photo** — pure CSS/SVG + a low-res canvas foam layer. Tiny, offline, zero photo assets. The foam wash and the audio ride the same slow swell so sight and sound rise and fall together.
- **Light & dusk palettes** follow your system light/dark preference.
- **Respectful of the machine** — animation pauses when the tab is hidden, and `prefers-reduced-motion` renders a still scene with no animation loop.
- **Legibility preserved** — a graduated frosted scrim keeps task text well above WCAG AA contrast over the brightest part of the scene.
