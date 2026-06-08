# Personal Music YT Player

*If you are an agent, read [`SKILL.md`](SKILL.md) first.*

*Live: [hec-ovi.github.io/music](https://hec-ovi.github.io/music/)*

[![demo](https://img.shields.io/badge/demo-live-black.svg)](https://hec-ovi.github.io/music/)
[![play a sample list](https://img.shields.io/badge/%E2%96%B6-sample%20list-black.svg)](https://hec-ovi.github.io/music/?playlist=Sample%20List%2C%20%5B2frers%20-%20EYES%20ON%20US%20%7C%20CsQ59uMYB_Y%2C%20NAVARA%20-%20FALLEN%20ANGEL%20%7C%20sWd8bc_LkqM%2C%20Sano%20-%20SET%20ME%20FREE%20%7C%20e1QIqXmZ2os%2C%20ruindkid%20-%20Bad%20Pitch%20For%20You%20%7C%20UhaU1ZVu9v0%2C%20KORZIX%20-%20ascend%20%7C%20ibPYPD8Hl4Q%2C%20Oxlo%20-%20Anesthesia%20%7C%20f59m5Pugdw4%2C%20Pat%20-%20Shotgun%20%7C%209fHjcTKV-kg%5D)
[![license: MIT](https://img.shields.io/badge/license-MIT-black.svg)](./LICENSE)
![backend: none](https://img.shields.io/badge/backend-none-black.svg)
![vanilla JS + ES modules](https://img.shields.io/badge/vanilla-JS%20%2B%20ES%20modules-black.svg)
[![player: YouTube IFrame API](https://img.shields.io/badge/player-YouTube%20IFrame%20API-black.svg)](https://developers.google.com/youtube/iframe_api_reference)
![tests: 93 passing](https://img.shields.io/badge/tests-93%20passing-black.svg)

<table>
  <tr>
    <td width="50%"><img src="docs/demo_redesign.gif" alt="Redesigned hero and player UI"></td>
    <td width="50%"><img src="docs/demo.gif" alt="Playing a public-domain classical playlist, then a free-music sample list"></td>
  </tr>
  <tr>
    <td align="center"><sub>Redesigned hero and player</sub></td>
    <td align="center"><sub>Building and playing a list</sub></td>
  </tr>
</table>

A static, no-backend YouTube playlist player. The page can be public, but your
playlists never are: they live only in your browser's `localStorage`, not in this
repo. You build them yourself by pasting YouTube ids or links.

The YouTube video shows by default, and on top of the standard player you get a
thumbnail-first queue, play/pause, stop, prev/next, a seek timeline, shuffle,
loop, volume, and direct YouTube links. If you just want it as background audio,
"Show video" is a toggle you can turn off.

## What it does

- Create playlists from the Paste playlists box: paste a `Playlist Title, [songs]`
  block, or just a title on its own line to start an empty playlist. Rename and
  delete them later. A title that matches an existing playlist is rejected, so an
  import never silently overwrites or merges what you already have. You can also
  import a playlist from a `.md`/`.txt` file.
- Add tracks by pasting a video id or any YouTube link. Both work in the same
  field, mixed and comma or newline separated: `id, link, id, link`. With an empty
  library, the first add spins up a default "My Playlist" for you, so you can drop
  in a song without making a playlist first.
- Reorder tracks (drag, or the up/down arrows), rename or remove them, add more
  on the fly.
- Play any track on demand, shuffle, loop, scrub the timeline, set volume.
- Flip "Play all" (a toggle over the playlist list) to play every playlist as one
  continuous queue. Shuffle then mixes your whole library; duplicates across lists
  just raise a track's odds. It is a listening mode, so editing is off while it's on.
- See YouTube thumbnails for playlists and tracks. Tracks you add as a bare id or
  link with no name get auto-named from the YouTube title (when the browser allows
  the lookup), and any name is cleaned of commas, dots, and other punctuation so it
  stays readable and safe to export.
- Export a playlist as text (copy to clipboard or download a `.md` file), or
  share it as a URL that rebuilds it in someone else's browser.
- Use internal modals for rename/delete flows; no browser prompt/confirm popups.
- Everything persists to `localStorage`, so a reload keeps your library. Wipe it
  all from the drawer's "Remove" (trash) button.

## Using it

Open the page, open the Playlists drawer, and paste into the Paste playlists box:
a full `Playlist Title, [songs]` block, or just a title to make an empty playlist
(or use "Import from file"). The info button next to "Paste playlists" opens the
format guide with examples. Then paste ids/links into the Add field and click a
track to play it.
Click a playlist to select it, which reveals its collapse, rename, and delete
controls; the collapse arrow opens and folds its editor. The "?" button in the
top right opens a quick visual guide to the controls and keys.

Keyboard controls (experimental) follow the old Winamp layout. They listen at
the page level and skip text fields, so they work whenever the page has focus. If
you click into the embedded video, the YouTube player captures keystrokes until
you click back onto the page.

```
Z previous
X play current track from the beginning
C pause
V stop
B next
Space pause/resume the current track (does not start playback from scratch)
```

Accepted track inputs (any mix, in one field):

```
VIDEOID0001
https://youtu.be/VIDEOID0002, VIDEOID0003, https://www.youtube.com/watch?v=VIDEOID0004
Track label | VIDEOID0005             # optional "Label | id-or-link"
```

### Paste playlists / AI agent format

The Paste playlists box accepts one playlist per line:

```
Playlist Title, [id, https://youtu.be/id, Song Name | id]
```

Ask an AI agent to find videos for a list of songs and emit that format, then
paste the result. Agents should read [`SKILL.md`](SKILL.md), a short, copy-paste
ready guide for producing import blocks. The longer reference and a ready prompt
are in [`PLAYLISTS_FORMAT.md`](PLAYLISTS_FORMAT.md).

## Files

- `index.html` is the GitHub Pages entry point.
- `main.js` mounts the app and wires the real YouTube IFrame player.
- `app.js` renders the UI and handles playback; `store.js` holds all the
  localStorage, YouTube URL, thumbnail, and id/link parsing logic.
- `styles.css` is the styling. `PLAYLISTS_FORMAT.md` documents the import format.

No build step. GitHub Pages serves it straight from the repository root.

## Development

```bash
npm install
npm test          # vitest + jsdom, unit + end-to-end UI tests
```

To run it locally, serve the folder over HTTP (ES modules need it; `file://`
will not work):

```bash
python3 -m http.server 8137
# open http://localhost:8137/
```

## GitHub Pages

Publish from the `main` branch root:

```bash
gh api repos/<owner>/music/pages \
  --method POST \
  -f source.branch=main \
  -f source.path=/
```

Then the site is at `https://<owner>.github.io/music/`. The repo can stay public
since it carries no personal playlist data.

## For AI agents

If you are an agent building a playlist for someone, read [`SKILL.md`](SKILL.md).
It is a short, copy-paste ready guide for emitting the playlist block the user
pastes into the app. [`PLAYLISTS_FORMAT.md`](PLAYLISTS_FORMAT.md) is the longer
reference.

## Notes

Playback runs through YouTube's official [IFrame Player API](https://developers.google.com/youtube/iframe_api_reference), so videos stream from YouTube with their ads and embedding settings intact; this repo hosts no audio, video, or playlists (only fake placeholder ids), and you're responsible for adding only what you have the right to watch. Not affiliated with YouTube or Google. MIT, no warranty; see [`LICENSE`](LICENSE).
