// Pure, framework-free playlist store backed by localStorage.
// Everything here is testable without a DOM or the YouTube API.

export const STORAGE_KEY = "musicLooper.v2";

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

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
  return { videoId, label: label || videoId };
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

// Bulk import format meant for AI agents and copy/paste:
//   Title, [id, https://youtu.be/id, Song Name | id]
// Multiple playlists allowed (repeat the pattern, one per line or inline).
export function parseImport(raw) {
  const text = String(raw == null ? "" : raw);
  const results = [];
  const re = /([^[\]]*?)\s*,?\s*\[([^[\]]*)\]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1].replace(/[\n\r,]+/g, " ").trim();
    const tracks = parseTracks(m[2]);
    if (tracks.length) {
      results.push({ name: name || "Imported playlist", tracks });
    }
  }
  return results;
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
    settings: { shuffle: false, loop: true, showVideo: false, volume: 100 }
  };
}

function normalizeState(value) {
  const base = emptyState();
  if (!value || typeof value !== "object") return base;

  const playlists = Array.isArray(value.playlists)
    ? value.playlists
        .filter((p) => p && typeof p === "object")
        .map((p) => ({
          id: typeof p.id === "string" ? p.id : genId(),
          name: typeof p.name === "string" && p.name.trim() ? p.name : "Playlist",
          tracks: Array.isArray(p.tracks)
            ? p.tracks
                .filter((t) => t && ID_RE.test(t.videoId))
                .map((t) => ({
                  videoId: t.videoId,
                  label:
                    typeof t.label === "string" && t.label.trim()
                      ? t.label
                      : t.videoId
                }))
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
      showVideo: !!settings.showVideo,
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
  const next = String(label == null ? "" : label).trim();
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

// Import one or more "Title, [songs]" blocks. Merges into a same-named
// playlist when one exists, otherwise creates it. Returns a per-block summary.
export function importPlaylists(state, raw) {
  const blocks = parseImport(raw);
  const summary = [];
  blocks.forEach((block) => {
    let playlist = state.playlists.find(
      (p) => p.name.toLowerCase() === block.name.toLowerCase()
    );
    let created = false;
    if (!playlist) {
      playlist = createPlaylist(state, block.name);
      created = true;
    }
    const existing = new Set(playlist.tracks.map((t) => t.videoId));
    let added = 0;
    block.tracks.forEach((track) => {
      if (existing.has(track.videoId)) return;
      existing.add(track.videoId);
      playlist.tracks.push(track);
      added += 1;
    });
    state.activePlaylistId = playlist.id;
    summary.push({ name: playlist.name, id: playlist.id, added, created });
  });
  return summary;
}
