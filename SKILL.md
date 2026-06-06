---
name: music-looper-playlists
description: Produce a Music Looper bulk-import block so a user can build a YouTube playlist in their browser. Use when a user asks you to make, fill, or extend a Music Looper playlist, or to turn a list of songs/videos into something they can paste into the app.
---

# Making Music Looper playlists

Music Looper is a static, browser-only YouTube playlist player. Playlists live in
the user's own browser (localStorage); nothing is stored server-side. Your job as
an agent is to emit a plain-text **bulk-import block** that the user pastes into
the app's "Bulk import" box.

You never download, host, or attach any audio or video. You only emit YouTube
video ids or links. Playback happens inside YouTube's own embedded player.

## The format

One playlist per line:

```
Playlist Title, [item, item, item]
```

- Everything before `[` is the playlist title. The comma before `[` is optional.
- Items inside `[ ]` are comma-separated. Each item is one of:
  - a bare 11-character video id, e.g. `VIDEOID0001`
  - a full YouTube link, e.g. `https://youtu.be/VIDEOID0001` or
    `https://www.youtube.com/watch?v=VIDEOID0001`
  - a labeled item: `Readable Name | id-or-link`
- A line with **just a title and no brackets** makes an empty playlist.
- A title that matches an existing playlist is **rejected** (no merge, no
  overwrite). Pick a new name or tell the user to rename/remove the old one.

## Rules that keep it parseable

- Never put a comma inside a title or a label. Commas only separate items. Use the
  `|` pipe to attach a label.
- A bare id is preferred over a long link, but both work.
- Only emit ids you can actually verify resolve to a real, embeddable YouTube
  video. Do not invent ids. If unsure, emit a full `watch?v=` link so the user can
  check it.
- Output the block only, no commentary and no code fences in the final answer.

## Examples

One playlist, mixed item shapes:

```
Late Night Coding, [Lofi beat | VIDEOID0001, VIDEOID0002, https://youtu.be/VIDEOID0003]
```

Several playlists at once:

```
Morning Focus, [Deep work | VIDEOID0001, VIDEOID0002]
Workout, [VIDEOID0003, https://www.youtube.com/watch?v=VIDEOID0004]
```

An empty playlist the user will fill later:

```
Road Trip
```

## Responsible use

This tool is for organizing videos the user has the right to watch and embed
(for example, their own channel's uploads, or public videos). It embeds via
YouTube's official player and does not strip ads or download content. Only build
playlists the user asks for, from real public/owned videos.
