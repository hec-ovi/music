---
name: personal-music-yt-player-playlists
description: Produce a Personal Music YT Player bulk-import block so a user can build a YouTube playlist in their browser. Use when a user asks you to make, fill, or extend a Personal Music YT Player playlist, or to turn a list of songs/videos into something they can paste into the app.
---

# Making Personal Music YT Player playlists

Personal Music YT Player is a static, browser-only YouTube playlist player. Playlists live in
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

## Giving the user a ready-to-play link

You do not have to make the user paste anything. The player reads a playlist from
a `?playlist=` URL parameter, so you can hand back **one clickable link** that
opens the app with the playlist already loaded. This is the ideal flow when a
user says "make me a playlist of X" — search YouTube, collect the ids, and reply
with a link they just click and press play.

Build it in three steps:

1. Find the videos on YouTube and collect their 11-character ids.
2. Assemble one bulk block: `Playlist Title, [Label | id, Label | id, ...]`.
3. URL-encode that whole block and append it to the player URL:

```
https://hec-ovi.github.io/music/?playlist=<URL-encoded block>
```

The user clicks it, the playlist loads, they press play. If they already have a
playlist with that exact name, the link is ignored rather than overwriting it, so
pick a fresh name.

**The user is responsible for the content played through any link you generate.**
Only build playlists the user asks for, and prefer free-to-use, Creative Commons,
or public-domain sources when you can. The sample below uses NoCopyrightSounds
tracks, which are free for anyone to use.

### Worked example: a free-music sample list

Bulk block:

```
Sample List, [2frers - EYES ON US | CsQ59uMYB_Y, NAVARA - FALLEN ANGEL | sWd8bc_LkqM, Sano - SET ME FREE | e1QIqXmZ2os, ruindkid - Bad Pitch For You | UhaU1ZVu9v0, KORZIX - ascend | ibPYPD8Hl4Q, Oxlo - Anesthesia | f59m5Pugdw4, Pat - Shotgun | 9fHjcTKV-kg]
```

Ready-to-play link (click and press play):

```
https://hec-ovi.github.io/music/?playlist=Sample%20List%2C%20%5B2frers%20-%20EYES%20ON%20US%20%7C%20CsQ59uMYB_Y%2C%20NAVARA%20-%20FALLEN%20ANGEL%20%7C%20sWd8bc_LkqM%2C%20Sano%20-%20SET%20ME%20FREE%20%7C%20e1QIqXmZ2os%2C%20ruindkid%20-%20Bad%20Pitch%20For%20You%20%7C%20UhaU1ZVu9v0%2C%20KORZIX%20-%20ascend%20%7C%20ibPYPD8Hl4Q%2C%20Oxlo%20-%20Anesthesia%20%7C%20f59m5Pugdw4%2C%20Pat%20-%20Shotgun%20%7C%209fHjcTKV-kg%5D
```

## Responsible use

This tool is for organizing videos the user has the right to watch and embed
(for example, their own channel's uploads, or public videos). It embeds via
YouTube's official player and does not strip ads or download content. Only build
playlists the user asks for, from real public/owned videos, and the user is
responsible for what they choose to play.
