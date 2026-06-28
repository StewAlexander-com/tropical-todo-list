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
