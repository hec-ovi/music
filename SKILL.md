---
name: personal-music-yt-player-playlists
description: Produce a Personal Music YT Player bulk-import block so a user can build a YouTube playlist in their browser. Use when a user asks you to make, fill, or extend a Personal Music YT Player playlist, or to turn a list of songs/videos into something they can paste into the app.
---

# Making Personal Music YT Player playlists

Personal Music YT Player is a static, browser-only YouTube playlist player. Playlists live in
the user's own browser (localStorage); nothing is stored server-side. Your job as
an agent is to emit a plain-text **bulk-import block** for a single playlist that
the user pastes into the app's "Paste playlists" box. You only emit YouTube video ids;
you do not attach or play media yourself.

## How users will ask you

Two shapes, same job:

1. **A theme or vibe**: "make me a chill-out playlist", "build a 90s hip-hop set".
   You choose the songs, then resolve each to a YouTube video id.
2. **An existing list to convert**: the user pastes or attaches a list of songs
   (a text list, an exported library, an XML/CSV of "Artist - Title" rows, etc.)
   and wants it turned into this format. You do not invent the songs; you take
   each entry as given and resolve it to a YouTube video id.

Either way the per-song pipeline is identical: **decide the song, find its video
id, normalize the name, emit `Name | id`.** The hard part agents get wrong is the
id lookup, so there is a dedicated procedure for it below. Do it once per song.

## The format

Emit exactly **one playlist on one line**:

```
Playlist Title, [Song Name | VIDEO_ID, Song Name | VIDEO_ID, Song Name | VIDEO_ID]
```

- Everything before `[` is the playlist title. The comma before `[` is optional.
- Inside the `[ ]` brackets is the song list. Each song is `Song Name | VIDEO_ID`.
- `VIDEO_ID` is a **bare 11-character YouTube id** from `A-Z a-z 0-9 _ -`, e.g.
  `CsQ59uMYB_Y`. Nothing else.
- The `|` only **separates** the name from the id; it is not an "or". The id is
  **required** and the name is optional. A label with no id (or a name without a
  `|`) resolves to nothing and is dropped by the app, so never emit a label by
  itself. Always pair every name with an id: `Song Name | VIDEO_ID`.

### Only emit bare ids, never links

Do **not** emit `https://www.youtube.com/watch?v=...`, `https://youtu.be/...`,
`youtube.com/...`, `youtu.be/...`, `/embed/`, `/shorts/`, or any other URL. The
app accepts links when a *human* types them by hand, but at the agent level you
output the bare 11-character id only. One id per song.

### One playlist only

Emit a single playlist per answer. Do not output multiple `Title, [...]` lines.
If the user asks for several themes, ask which one they want, or fold them into one
list. A title that matches a playlist the user already has is **rejected** by the
app (no merge, no overwrite), so pick a fresh name.

## Normalizing the song name (the label)

The label before each `|` must be the **clean song name only**. Normalize every
title you find on YouTube:

1. **Drop the artist / channel.** Keep just the track name. `Artist - Song` becomes
   `Song`.
2. **Strip every bracketed or parenthetical tag**, e.g. `(Official Video)`,
   `[NCS Release]`, `(Lyrics)`, `(Visualizer)`, `(prod. ...)`, `(feat. ...)`.
3. **Remove special characters** entirely: `[ ] ( ) - . _ / \ * " ' : ; ! ?` and
   any other punctuation. The label must contain letters, numbers, and spaces only.
4. **Compact it.** Collapse runs of spaces, trim the ends, and use plain
   Title Case. Short and readable beats verbatim.

Never let a label contain a comma, a `|`, a `[`, or a `]`. Those characters break
the parser. Removing special characters in step 3 already takes care of this.

As a safety net the app also strips stray punctuation from any name it stores, and
when you pass a bare id with no `Label |`, it auto-names that track from the
YouTube video title (punctuation removed). Do not lean on this: still emit clean,
artist-free names yourself so the user sees exactly what you intend.

### Normalization examples

| Raw YouTube title                                  | Label you emit   |
| -------------------------------------------------- | ---------------- |
| `2frers - EYES ON US`                              | `Eyes On Us`     |
| `NAVARA - FALLEN ANGEL (Official Visualizer)`     | `Fallen Angel`   |
| `Oxlo - Anesthesia [NCS Release]`                 | `Anesthesia`     |
| `Pat - Shotgun.`                                  | `Shotgun`        |
| `Sano - SET ME FREE (Lyrics)`                     | `Set Me Free`    |
| `ruindkid - Bad Pitch For You (prod. xyz)`        | `Bad Pitch For You` |
| `Earth, Wind & Fire - September (Official Audio)` | `September`      |

The last row is the one that matters most: the raw title has a **comma** in it.
A comma is the song separator, so it can never appear inside a label. Drop the
artist and the tags and you are left with `September`, comma gone. If you ever
keep a comma in a name, the app reads it as the start of the next song and your
list breaks.

## Finding the video id for each song

This is the step agents get wrong: they fan out several web searches per song, get
lost in results, or paste the wrong id. Treat every song as **one lookup that
returns exactly one id**, and resolve one song at a time.

### Build the query

Put the artist and title **together** in the search query, even though the emitted
label drops the artist. Append `official audio` to bias toward the canonical upload
instead of live clips, covers, or reactions:

```
<artist> <title> official audio
```

### Preferred: the Invidious search API (one HTTP call per song)

Invidious is an open-source YouTube front end. Its search endpoint returns the
real, canonical 11-character YouTube `videoId` as JSON, so you get the id in a
single call instead of scraping a results page or guessing:

```
GET https://<instance>/api/v1/search?q=<url-encoded query>&type=video&sort=relevance
```

Take the **first** video result's `videoId`. Each result object also has `title`,
`author`, and `lengthSeconds`, so you can sanity-check the hit (the title contains
the song; the length is a few minutes, not 1 second or 3 hours). For free or
reusable music, add `&features=creative_commons` to the query.

Verified high-uptime public instances (as of mid-2026):

- `https://inv.nadeko.net`
- `https://invidious.nerdvpn.de`
- `https://invidious.f5.si`

Public instances are community-run, so they can be slow, rate-limit you, or return
`403`/timeouts with no warning. That is expected, not a bug in your query: if one
instance fails, try the next. The current ranked list lives at
`https://api.invidious.io` and `https://docs.invidious.io/instances/` if all three
above are down.

Illustrative flow (the ids below are the repo's real NCS sample tracks):

```
GET https://inv.nadeko.net/api/v1/search?q=2frers%20eyes%20on%20us%20official%20audio&type=video
first result -> videoId: CsQ59uMYB_Y
emit         -> Eyes On Us | CsQ59uMYB_Y
```

### Fallback: one targeted web search

If Invidious is unreachable or returns nothing matching, do **one** ordinary web
search with the same `<artist> <title> official audio` query, open the first
`youtube.com/watch?v=` or `youtu.be/` result, and read the id out of the URL. One
search per song: do not loop through many searches hoping for a better hit. The top
result for a specific "artist title" query is almost always the right video, which
is exactly why a single lookup is enough.

### Validate before you emit

Every id must match `^[A-Za-z0-9_-]{11}$`: exactly 11 characters, letters, digits,
`-` and `_` only. If what you extracted is longer, shorter, or has other
characters, you grabbed a playlist id or a stray URL fragment, not a video id.
Discard it and re-resolve.

### If a song cannot be resolved

Never invent an id (an invented id plays nothing). If you truly cannot find a real
id after the API plus one web search, **skip that song** and list the skipped
titles to the user *outside* the block, never inside it.

## How the commas work

The comma is the **only** separator, and it separates songs and nothing else:

- One comma between each `Song Name | VIDEO_ID` pair.
- Never put a comma inside a label (that is why you strip punctuation above).
- The single optional comma before `[` separates the title from the list.

So a comma always means "next song starts here."

## Examples

A finished block (bare ids, clean labels, one line):

```
Late Night Coding, [Eyes On Us | CsQ59uMYB_Y, Fallen Angel | sWd8bc_LkqM, Anesthesia | f59m5Pugdw4]
```

An empty playlist the user will fill later (title only, no brackets):

```
Road Trip
```

The **plain bulk block is your primary deliverable**: it is paste-ready and has
nothing to encode, so it is the hardest thing to get wrong. The clickable link
below is an optional bonus on top of it.

## How to present it in your reply

Put the block inside a **fenced code snippet** so the chat UI gives the user a
one-click copy button:

````
```
Playlist Title, [Song Name | id, Song Name | id, ...]
```
````

If you also give the ready-to-play link, put it in its own separate code snippet.
Keep the reply to just those: a one-line lead-in is fine, the snippet(s), done.

### Leave these out of your reply

They make the answer noisy or broken, so do not include them:

- **No YouTube embeds or players.** Do not paste `<iframe>`s, embed codes,
  thumbnails, or "now playing" widgets. The app does the playing; you only hand
  over the text block.
- **Do not echo the user's list back.** When converting a list the user gave you,
  reply with the finished block, not a restatement of their input followed by the
  block.
- **No raw links inside the block.** Bare ids only (covered above).
- **No extra prose between songs**, no per-song explanations, no track-by-track
  commentary. The snippet speaks for itself.

## Before you send it: self-check

Run this checklist on your block before you reply. It catches the mistakes that
make the app reject an import or show garbled names:

1. **One line, one playlist.** No second `Title, [...]` line.
2. **Brackets balanced.** Exactly one `[` and one `]`, the `]` at the very end. A
   missing `]` is the most common break.
3. **Every id is bare and 11 chars**, matching `^[A-Za-z0-9_-]{11}$`. No
   `http`, no `youtu`, no `watch?v=`, no `&t=` tails.
4. **Commas only between songs.** None inside any name. One comma per song gap.
5. **No `%` codes.** If you see `%20`, `%5B`, `%7C`, you pasted an encoded string
   into the block by mistake. Use the decoded, human-readable text here.
6. **Block is in a code snippet**, with no prose or extra lines inside the fence.

The app is forgiving and will try to recover from a stray fence or a missing
bracket, but a block that passes this check imports cleanly every time.

## Giving the user a ready-to-play link

On top of the block, you can hand back **one clickable link** that opens the app
with the playlist already loaded. The player reads a playlist from a `?playlist=`
URL parameter, so the user just clicks and presses play. This is a nice finish
when a user says "make me a playlist of X".

Build it in three steps:

1. Resolve each song to its 11-character id with the lookup procedure above
   (Invidious search, web-search fallback), and normalize each name.
2. Assemble one bulk block: `Playlist Title, [Song Name | id, Song Name | id, ...]`.
3. URL-encode that whole block **exactly once** (the `encodeURIComponent`
   equivalent) and append it to the player URL:

```
https://hec-ovi.github.io/music/?playlist=<URL-encoded block>
```

Encode the block one time only. Encoding an already-encoded string is the classic
bug that turns names into `%2520`/`%20` soup; if your link contains `%25`, you
double-encoded it. The plain block stays human-readable; only the copy inside the
link is encoded.

The user clicks it, the playlist loads, they press play. If they already have a
playlist with that exact name, the link is ignored rather than overwriting it, so
pick a fresh name.

### Worked example

Bulk block (bare ids, artists dropped, labels cleaned):

```
Sample List, [Eyes On Us | CsQ59uMYB_Y, Fallen Angel | sWd8bc_LkqM, Set Me Free | e1QIqXmZ2os, Bad Pitch For You | UhaU1ZVu9v0, Ascend | ibPYPD8Hl4Q, Anesthesia | f59m5Pugdw4, Shotgun | 9fHjcTKV-kg]
```

Ready-to-play link (click and press play):

```
https://hec-ovi.github.io/music/?playlist=Sample%20List%2C%20%5BEyes%20On%20Us%20%7C%20CsQ59uMYB_Y%2C%20Fallen%20Angel%20%7C%20sWd8bc_LkqM%2C%20Set%20Me%20Free%20%7C%20e1QIqXmZ2os%2C%20Bad%20Pitch%20For%20You%20%7C%20UhaU1ZVu9v0%2C%20Ascend%20%7C%20ibPYPD8Hl4Q%2C%20Anesthesia%20%7C%20f59m5Pugdw4%2C%20Shotgun%20%7C%209fHjcTKV-kg%5D
```
