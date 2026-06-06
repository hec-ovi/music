# Music Looper

A static, no-backend YouTube playlist player. The page can be public, but your
playlists never are: they live only in your browser's `localStorage`, not in this
repo. You build them yourself by pasting YouTube ids or links.

It plays like a classic audio player. The YouTube video is hidden by default
(toggle "Show video" if you want it), and you get play/pause, stop, prev/next, a
seek timeline, shuffle, and loop.

## What it does

- Create named playlists, rename and delete them.
- Add tracks by pasting a video id or any YouTube link. Both work in the same
  field, mixed and comma or newline separated: `id, link, id, link`.
- Bulk import whole playlists from a `Title, [songs]` block (handy for AI agents,
  see below).
- Reorder tracks (drag, or the up/down arrows), rename or remove them, add more
  on the fly.
- Play any track on demand, shuffle, loop, scrub the timeline, set volume.
- Everything persists to `localStorage`, so a reload keeps your library.

## Using it

Open the page, type a playlist name, hit Create. Paste ids/links into the Add
field. Click a track title to play it. That is the whole loop.

Accepted track inputs (any mix, in one field):

```
dQw4w9WgXcQ
https://youtu.be/cWvtB0YNu5k, 9hc6hSKTAEA, https://www.youtube.com/watch?v=8GW6sLrK40k
Voyage - Allude | cWvtB0YNu5k          # optional "Label | id-or-link"
```

### Bulk import / AI agent format

The Bulk import box accepts one playlist per line:

```
Playlist Title, [id, https://youtu.be/id, Song Name | id]
```

Ask an AI agent to find videos for a list of songs and emit that format, then
paste the result. Full details and a ready prompt are in
[`PLAYLISTS_FORMAT.md`](PLAYLISTS_FORMAT.md).

## Files

- `index.html` is the GitHub Pages entry point.
- `main.js` mounts the app and wires the real YouTube IFrame player.
- `app.js` renders the UI and handles playback; `store.js` holds all the
  localStorage and id/link parsing logic.
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
