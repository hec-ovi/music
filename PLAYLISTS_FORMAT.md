# Playlist format (for humans and AI agents)

Music Looper keeps all playlists in your browser's `localStorage`. Nothing is
stored in this repo, so the page can be public while your playlists stay private
to your machine. You build playlists two ways: type ids/links into a playlist,
or paste a bulk block produced by an AI agent.

## Quick rules

- A track is a YouTube **video id** or **any YouTube link**. Both are accepted in
  the same field, mixed freely.
- Accepted link shapes: `https://www.youtube.com/watch?v=ID`, `https://youtu.be/ID`,
  `https://youtube.com/shorts/ID`, `/embed/ID`, `/live/ID`, plus extra query params.
- A bare id is 11 characters from `A-Z a-z 0-9 _ -` (e.g. `VIDEOID0001`).
- Duplicates inside the same playlist are skipped automatically.

## Adding tracks to a playlist (the "Add" field)

Paste one id/link, or many separated by commas or new lines. Mixing is fine:

```
VIDEOID0001
https://youtu.be/VIDEOID0002, VIDEOID0003, https://www.youtube.com/watch?v=VIDEOID0004
```

Optional readable name per track with a pipe (`Label | id-or-link`):

```
Track one | VIDEOID0001, Track two | https://youtu.be/VIDEOID0002
```

## Bulk import (the agent format)

This is the format an AI agent should output. The user pastes it into the
**Bulk import** box and each block becomes a playlist.

```
Playlist Title, [item, item, item]
```

- Everything before `[` is the playlist title (the comma before `[` is optional).
- Inside the brackets: comma-separated ids and/or links.
- Each item may carry a label with `Label | id-or-link`.
- Put **one playlist per line** to create several at once.
- A line with just a title and no brackets creates an empty playlist.
- A title that matches an existing playlist is rejected (no append, merge, or
  overwrite). Rename or remove the existing one first.

### Example output an agent can produce

```
First Playlist, [Track one | VIDEOID0001, Track two | VIDEOID0002, https://youtu.be/VIDEOID0003]
Second Playlist, [VIDEOID0004, https://www.youtube.com/watch?v=VIDEOID0005, Track three | VIDEOID0006]
```

## Prompt template for an AI agent

> You are building a Music Looper import block. I will give you a theme or a list
> of song names. For each song, find its YouTube video and output the 11-character
> video id (or a full YouTube link). Return exactly this format, one playlist per
> line, nothing else:
>
> `Playlist Title, [Song Name | VIDEO_ID, Song Name | VIDEO_ID, ...]`
>
> Use the real song title as the label before each `|`. Do not invent ids; only
> use ids you can verify resolve to a real YouTube video. No commentary, no code
> fences in the final answer.

### Notes for the agent

- Never put a comma inside a label or title (commas separate items). Use the `|`
  pipe to attach a label.
- A bare id is preferred over a long link, but both work.
- If you are unsure of an id, prefer a full `https://www.youtube.com/watch?v=...`
  link so the user can verify it.
