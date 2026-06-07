// Pure, framework-free playlist store backed by localStorage.
// Everything here is testable without a DOM or the YouTube API.

export const STORAGE_KEY = "musicLooper.v2";

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function youtubeWatchUrl(videoId) {
  return "https://www.youtube.com/watch?v=" + videoId;
}

export function youtubeThumbnailUrl(videoId) {
  return "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg";
}

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

// Strip punctuation and symbols from a display name so labels stay parseable
// (no commas, dots, brackets, or pipes to confuse the bulk format) and read
// cleanly. Keeps letters of any language, numbers, and collapses runs of space.
export function normalizeLabel(value) {
  return String(value == null ? "" : value)
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeTrack(videoId, label, extra = {}) {
  const title = cleanText(extra.youtubeTitle);
  // A label that is just the id is the "no name yet" placeholder, so keep the id
  // verbatim (it carries _ and - that normalization would otherwise strip).
  const raw = cleanText(label);
  const cleaned = raw && raw !== videoId ? normalizeLabel(raw) : "";
  return {
    videoId,
    label: cleaned || videoId,
    url: youtubeWatchUrl(videoId),
    thumbnailUrl: youtubeThumbnailUrl(videoId),
    youtubeTitle: title
  };
}

// Pull an 11-char YouTube video id out of a bare id or any YouTube URL shape
// (watch?v=, youtu.be/, /embed/, /shorts/, /live/, /v/, with extra params).
export function extractVideoId(raw) {
  const s = String(raw == null ? "" : raw).trim();
  if (!s) return null;
  if (ID_RE.test(s)) return s;

  let url = null;
  try {
    url = new URL(s.includes("://") ? s : "https://" + s);
  } catch (_) {
    url = null;
  }

  if (url) {
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      if (ID_RE.test(id)) return id;
    }
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      const v = url.searchParams.get("v");
      if (v && ID_RE.test(v)) return v;
      const parts = url.pathname.split("/").filter(Boolean);
      const marker = parts.findIndex((p) =>
        ["embed", "shorts", "v", "live"].includes(p)
      );
      if (marker !== -1 && parts[marker + 1] && ID_RE.test(parts[marker + 1])) {
        return parts[marker + 1];
      }
    }
  }

  // Last resort: find an id after v= or a slash inside arbitrary text.
  const m = s.match(/(?:v=|\/)([A-Za-z0-9_-]{11})(?:[?&/]|$)/);
  return m ? m[1] : null;
}

// One token -> { videoId, label }. Supports an optional "Label | id" form so a
// human-readable name survives. Returns null when no id can be recovered.
export function parseTrackToken(token) {
  const t = String(token == null ? "" : token).trim();
  if (!t) return null;

  let label = null;
  let idPart = t;
  const sep = t.indexOf("|");
  if (sep !== -1) {
    label = t.slice(0, sep).trim();
    idPart = t.slice(sep + 1).trim();
  }

  const videoId = extractVideoId(idPart);
  if (!videoId) return null;
  return makeTrack(videoId, label || videoId);
}

// A blob of ids/links -> deduped track list. Splits on commas and newlines so
// "id, id, link" and one-per-line both work. Square brackets are tolerated.
export function parseTracks(raw) {
  const text = String(raw == null ? "" : raw).replace(/[[\]]/g, " ");
  const seen = new Set();
  const tracks = [];
  text
    .split(/[,\n\r]+/)
    .map((part) => parseTrackToken(part))
    .filter(Boolean)
    .forEach((track) => {
      if (seen.has(track.videoId)) return;
      seen.add(track.videoId);
      tracks.push(track);
    });
  return tracks;
}

// A playlist title can never hold a comma or a bracket: the comma separates the
// title from the song list, and the brackets delimit it. Scrub both (plus the
// surrounding whitespace) so a stray one never lands in a playlist name.
function cleanPlaylistName(value) {
  return String(value == null ? "" : value)
    .replace(/[[\],]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Undo URL-encoding when a blob was pasted encoded (e.g. someone copies an
// agent's share link into the bulk box instead of opening it). Decodes up to
// twice to also undo double-encoding, and only when the text actually carries an
// encoded bracket or pipe, so a clean paste is never altered.
function decodeIfEncoded(text) {
  let out = String(text == null ? "" : text);
  // %5B/%5D = brackets, %7C = pipe, %25 = an encoded percent (i.e. double-encoded).
  for (let i = 0; i < 3 && /%(5[BD]|7C|25)/i.test(out); i += 1) {
    try {
      const next = decodeURIComponent(out);
      if (next === out) break;
      out = next;
    } catch (_) {
      break; // Malformed encoding: keep what we have.
    }
  }
  return out;
}

// Bulk import format meant for AI agents and copy/paste, one playlist per line:
//   Playlist Title, [id, https://youtu.be/id, Song Name | id]
// A line that is just a title (no brackets) becomes an empty playlist, so the
// bulk box doubles as the "make an empty playlist" entry point.
//
// Forgiving by design, because agents fumble the exact shape: a missing closing
// bracket, code fences, and URL-encoded blobs are all recovered rather than
// turned into a junk playlist whose name is the malformed line.
export function parseImport(raw) {
  const text = decodeIfEncoded(String(raw == null ? "" : raw));
  const results = [];
  text.split(/\r?\n/).forEach((rawLine) => {
    // Strip stray backticks so a ```-fenced block does not become its own line.
    const line = rawLine.replace(/`+/g, "").trim();
    if (!line) return;

    const open = line.indexOf("[");
    if (open === -1) {
      // No bracket at all: a bare title makes an empty playlist.
      const name = cleanPlaylistName(line);
      if (name) results.push({ name, tracks: [] });
      return;
    }

    // Bracketed line: title before "[", songs inside. A missing closing "]" is
    // tolerated by reading the songs through to the end of the line.
    const name = cleanPlaylistName(line.slice(0, open));
    let close = line.lastIndexOf("]");
    if (close <= open) close = line.length;
    const tracks = parseTracks(line.slice(open + 1, close));
    if (tracks.length) {
      results.push({ name: name || "Imported playlist", tracks });
    }
  });
  return results;
}

export function playlistToBulkText(playlist) {
  if (!playlist || typeof playlist !== "object") return "";
  const name = cleanText(playlist.name) || "Playlist";
  const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
  const parts = tracks
    .filter((track) => track && ID_RE.test(track.videoId))
    .map((track) => {
      const label = cleanText(track.label);
      return label && label !== track.videoId
        ? label + " | " + track.videoId
        : track.videoId;
    });
  return name + ", [" + parts.join(", ") + "]";
}

export function genId(prefix = "pl") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return prefix + "-" + crypto.randomUUID();
  }
  return prefix + "-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function emptyState() {
  return {
    playlists: [],
    activePlaylistId: null,
    settings: { shuffle: false, loop: true, showVideo: true, volume: 100 }
  };
}

function normalizeState(value) {
  const base = emptyState();
  if (!value || typeof value !== "object") return base;

  function normalizeTrack(t) {
    if (!t || typeof t !== "object" || !ID_RE.test(t.videoId)) return null;
    return makeTrack(t.videoId, t.label, { youtubeTitle: t.youtubeTitle });
  }

  const playlists = Array.isArray(value.playlists)
    ? value.playlists
        .filter((p) => p && typeof p === "object")
        .map((p) => ({
          id: typeof p.id === "string" ? p.id : genId(),
          name: typeof p.name === "string" && p.name.trim() ? p.name : "Playlist",
          tracks: Array.isArray(p.tracks)
            ? p.tracks
                .map(normalizeTrack)
                .filter(Boolean)
            : []
        }))
    : [];

  const ids = new Set(playlists.map((p) => p.id));
  const settings = value.settings && typeof value.settings === "object" ? value.settings : {};

  return {
    playlists,
    activePlaylistId: ids.has(value.activePlaylistId)
      ? value.activePlaylistId
      : playlists[0]
      ? playlists[0].id
      : null,
    settings: {
      shuffle: !!settings.shuffle,
      loop: settings.loop !== false,
      showVideo: settings.showVideo !== false,
      volume:
        typeof settings.volume === "number" &&
        settings.volume >= 0 &&
        settings.volume <= 100
          ? settings.volume
          : 100
    }
  };
}

export function loadState(storage) {
  if (!storage) return emptyState();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return normalizeState(JSON.parse(raw));
  } catch (_) {
    return emptyState();
  }
}

export function saveState(storage, state) {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {
    /* quota or unavailable storage: ignore */
  }
}

export function getPlaylist(state, id) {
  return state.playlists.find((p) => p.id === id) || null;
}

export function createPlaylist(state, name) {
  const playlist = {
    id: genId(),
    name: String(name == null ? "" : name).trim() || "New playlist",
    tracks: []
  };
  state.playlists.push(playlist);
  state.activePlaylistId = playlist.id;
  return playlist;
}

export function deletePlaylist(state, id) {
  const index = state.playlists.findIndex((p) => p.id === id);
  if (index === -1) return false;
  state.playlists.splice(index, 1);
  if (state.activePlaylistId === id) {
    state.activePlaylistId = state.playlists[0] ? state.playlists[0].id : null;
  }
  return true;
}

export function renamePlaylist(state, id, name) {
  const playlist = getPlaylist(state, id);
  if (!playlist) return false;
  const next = String(name == null ? "" : name).trim();
  if (!next) return false;
  playlist.name = next;
  return true;
}

// Add ids/links to a playlist, skipping any already present. Returns counts.
export function addTracks(state, id, raw) {
  const playlist = getPlaylist(state, id);
  if (!playlist) return { added: 0, skipped: 0 };
  const incoming = parseTracks(raw);
  const existing = new Set(playlist.tracks.map((t) => t.videoId));
  let added = 0;
  let skipped = 0;
  incoming.forEach((track) => {
    if (existing.has(track.videoId)) {
      skipped += 1;
      return;
    }
    existing.add(track.videoId);
    playlist.tracks.push(track);
    added += 1;
  });
  return { added, skipped };
}

export function removeTrack(state, id, index) {
  const playlist = getPlaylist(state, id);
  if (!playlist || index < 0 || index >= playlist.tracks.length) return false;
  playlist.tracks.splice(index, 1);
  return true;
}

export function renameTrack(state, id, index, label) {
  const playlist = getPlaylist(state, id);
  if (!playlist || index < 0 || index >= playlist.tracks.length) return false;
  const next = normalizeLabel(label);
  playlist.tracks[index].label = next || playlist.tracks[index].videoId;
  return true;
}

// Move a track to a new index, clamping into range. Returns the landing index.
export function moveTrack(state, id, from, to) {
  const playlist = getPlaylist(state, id);
  if (!playlist) return -1;
  const len = playlist.tracks.length;
  if (from < 0 || from >= len) return -1;
  let target = to;
  if (target < 0) target = 0;
  if (target > len - 1) target = len - 1;
  const [moved] = playlist.tracks.splice(from, 1);
  playlist.tracks.splice(target, 0, moved);
  return target;
}

// Import one or more "Title, [songs]" blocks. Same-named playlists are rejected
// so imports never silently overwrite or merge existing user data.
export function importPlaylists(state, raw) {
  const blocks = parseImport(raw);
  const summary = [];
  blocks.forEach((block) => {
    const duplicate = state.playlists.find(
      (p) => p.name.toLowerCase() === block.name.toLowerCase()
    );
    if (duplicate) {
      summary.push({
        name: block.name,
        id: duplicate.id,
        added: 0,
        created: false,
        duplicate: true
      });
      return;
    }

    const playlist = createPlaylist(state, block.name);
    let added = 0;
    block.tracks.forEach((track) => {
      playlist.tracks.push(track);
      added += 1;
    });
    state.activePlaylistId = playlist.id;
    summary.push({ name: playlist.name, id: playlist.id, added, created: true, duplicate: false });
  });
  return summary;
}
