# Music Looper

A static GitHub Pages playlist player for three YouTube-backed playlists:

- Electronic Gems
- Stoned Songs
- Extended Songs

Open `index.html` to use the player. It supports playlist switching, ordered playback, shuffle playback, playlist looping, previous/next, YouTube fallback links, copied links, and M3U export.

The site has no backend and no build step. GitHub Pages can serve it directly from the repository root.

## Files

- `index.html` is the GitHub Pages entry point.
- `styles.css`, `playlists.js`, and `app.js` contain the player UI, playlist data, and playback logic.
- `playlists.md` keeps the human-readable song list.
- `electronic-gems.txt`, `stoned-songs.txt`, and `extended-songs.txt` keep one source list per playlist.

## GitHub Pages

This repo is intended to publish from the `main` branch root:

```bash
gh api repos/hec-ovi/music/pages \
  --method POST \
  -f source.branch=main \
  -f source.path=/
```

After Pages is enabled, the site should be available at:

```text
https://hec-ovi.github.io/music/
```
