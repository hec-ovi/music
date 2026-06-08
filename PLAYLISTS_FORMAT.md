# Playlist format (for humans and AI agents)

Personal Music YT Player keeps all playlists in your browser's `localStorage`. Nothing is
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

The `|` only separates the name from the id/link; it does not mean "or". The
id or link is required and the name is optional, so a label by itself (no id, or
no `|`) is dropped. Always pair a name with an id/link.

## Paste playlists (the agent format)

This is the format an AI agent should output. The user pastes it into the
**Paste playlists** box and each block becomes a playlist.

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

## For AI agents

Agents have tighter rules than the human Add field above. The full agent guide is
[`SKILL.md`](SKILL.md); the short version:

- **One playlist per answer**, on one line.
- **Bare 11-character ids only**, never links. Links are a convenience for a human
  typing into the Add field, not for agent output.
- **Clean the name.** Drop the artist, strip bracketed tags and all punctuation,
  and keep a compact song name. Letters, numbers, and spaces only.
- **The comma is the only separator** and separates songs, nothing else. A comma
  must never appear inside a name (it would start a new song). Example: a raw
  title `Earth, Wind & Fire - September (Official Audio)` becomes the label
  `September`.

### Prompt template for an AI agent

> You are building a Personal Music YT Player import block. I will give you a theme
> or a list of song names. For each song, find its YouTube video and output its
> bare 11-character video id. Return exactly this format, a single playlist on one
> line, nothing else:
>
> `Playlist Title, [Song Name | VIDEO_ID, Song Name | VIDEO_ID, ...]`
>
> For each label, use the clean song name only: drop the artist, remove bracketed
> tags, and strip every comma, dot, and other punctuation (letters, numbers, and
> spaces only). The comma only separates songs. Do not invent ids; only use ids you
> can verify resolve to a real YouTube video. No commentary, no code fences.
