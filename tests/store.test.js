import { describe, it, expect, beforeEach } from "vitest";
import {
  extractVideoId,
  parseTrackToken,
  parseTracks,
  parseImport,
  emptyState,
  loadState,
  saveState,
  createPlaylist,
  deletePlaylist,
  renamePlaylist,
  addTracks,
  removeTrack,
  renameTrack,
  moveTrack,
  importPlaylists,
  STORAGE_KEY
} from "../store.js";

describe("extractVideoId", () => {
  it("accepts a bare 11-char id", () => {
    expect(extractVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractVideoId("  cWvtB0YNu5k ")).toBe("cWvtB0YNu5k");
  });

  it("parses watch?v= links with extra params", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s")).toBe("dQw4w9WgXcQ");
  });

  it("parses youtu.be short links", () => {
    expect(extractVideoId("https://youtu.be/cWvtB0YNu5k?si=abc")).toBe("cWvtB0YNu5k");
  });

  it("parses embed, shorts and live paths", () => {
    expect(extractVideoId("https://www.youtube.com/embed/8GW6sLrK40k")).toBe("8GW6sLrK40k");
    expect(extractVideoId("https://youtube.com/shorts/9hc6hSKTAEA")).toBe("9hc6hSKTAEA");
    expect(extractVideoId("https://www.youtube.com/live/rcU-IfF-CWY")).toBe("rcU-IfF-CWY");
  });

  it("parses links without a scheme", () => {
    expect(extractVideoId("youtu.be/cWvtB0YNu5k")).toBe("cWvtB0YNu5k");
  });

  it("rejects junk", () => {
    expect(extractVideoId("")).toBeNull();
    expect(extractVideoId("not a video")).toBeNull();
    expect(extractVideoId("https://example.com/watch?v=tooShort")).toBeNull();
  });
});

describe("parseTrackToken", () => {
  it("returns id + default label", () => {
    expect(parseTrackToken("dQw4w9WgXcQ")).toEqual({ videoId: "dQw4w9WgXcQ", label: "dQw4w9WgXcQ" });
  });
  it("honors a Label | id form", () => {
    expect(parseTrackToken("Never Gonna | dQw4w9WgXcQ")).toEqual({
      videoId: "dQw4w9WgXcQ",
      label: "Never Gonna"
    });
  });
  it("honors a Label | link form", () => {
    expect(parseTrackToken("Voyage | https://youtu.be/cWvtB0YNu5k")).toEqual({
      videoId: "cWvtB0YNu5k",
      label: "Voyage"
    });
  });
});

describe("parseTracks", () => {
  it("splits mixed ids and links on commas", () => {
    const out = parseTracks("dQw4w9WgXcQ, https://youtu.be/cWvtB0YNu5k, 9hc6hSKTAEA");
    expect(out.map((t) => t.videoId)).toEqual(["dQw4w9WgXcQ", "cWvtB0YNu5k", "9hc6hSKTAEA"]);
  });

  it("splits on newlines too and drops junk", () => {
    const out = parseTracks("dQw4w9WgXcQ\nnonsense\n9hc6hSKTAEA");
    expect(out.map((t) => t.videoId)).toEqual(["dQw4w9WgXcQ", "9hc6hSKTAEA"]);
  });

  it("de-dupes within the input", () => {
    const out = parseTracks("dQw4w9WgXcQ, dQw4w9WgXcQ, https://youtu.be/dQw4w9WgXcQ");
    expect(out).toHaveLength(1);
  });
});

describe("parseImport", () => {
  it("parses a single Title, [songs] block", () => {
    const out = parseImport("My Mix, [dQw4w9WgXcQ, https://youtu.be/cWvtB0YNu5k]");
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("My Mix");
    expect(out[0].tracks.map((t) => t.videoId)).toEqual(["dQw4w9WgXcQ", "cWvtB0YNu5k"]);
  });

  it("parses multiple playlists, one per line, with labels", () => {
    const text = [
      "Electronic Gems, [Voyage | cWvtB0YNu5k, 9hc6hSKTAEA]",
      "Stoned Songs, [NvfRPXEXOcQ, Kyuss - Space Cadet | rcU-IfF-CWY]"
    ].join("\n");
    const out = parseImport(text);
    expect(out).toHaveLength(2);
    expect(out[0].name).toBe("Electronic Gems");
    expect(out[0].tracks[0]).toEqual({ videoId: "cWvtB0YNu5k", label: "Voyage" });
    expect(out[1].name).toBe("Stoned Songs");
    expect(out[1].tracks[1].label).toBe("Kyuss - Space Cadet");
  });

  it("tolerates a missing comma before the bracket", () => {
    const out = parseImport("My Mix [dQw4w9WgXcQ]");
    expect(out[0].name).toBe("My Mix");
  });

  it("ignores blocks with no valid tracks", () => {
    expect(parseImport("Empty, [nope, junk]")).toHaveLength(0);
  });
});

describe("playlist CRUD", () => {
  let state;
  beforeEach(() => {
    state = emptyState();
  });

  it("creates and activates a playlist", () => {
    const p = createPlaylist(state, "Test");
    expect(state.playlists).toHaveLength(1);
    expect(state.activePlaylistId).toBe(p.id);
    expect(p.name).toBe("Test");
  });

  it("adds tracks and skips duplicates", () => {
    const p = createPlaylist(state, "Test");
    const r1 = addTracks(state, p.id, "dQw4w9WgXcQ, https://youtu.be/cWvtB0YNu5k");
    expect(r1).toEqual({ added: 2, skipped: 0 });
    const r2 = addTracks(state, p.id, "dQw4w9WgXcQ, 9hc6hSKTAEA");
    expect(r2).toEqual({ added: 1, skipped: 1 });
    expect(p.tracks).toHaveLength(3);
  });

  it("removes a track and renames a track", () => {
    const p = createPlaylist(state, "Test");
    addTracks(state, p.id, "dQw4w9WgXcQ, 9hc6hSKTAEA, cWvtB0YNu5k");
    expect(renameTrack(state, p.id, 1, "Middle")).toBe(true);
    expect(p.tracks[1].label).toBe("Middle");
    expect(removeTrack(state, p.id, 0)).toBe(true);
    expect(p.tracks.map((t) => t.videoId)).toEqual(["9hc6hSKTAEA", "cWvtB0YNu5k"]);
  });

  it("moves tracks into a new order with clamping", () => {
    const p = createPlaylist(state, "Test");
    addTracks(state, p.id, "aaaaaaaaaaa, bbbbbbbbbbb, ccccccccccc");
    expect(moveTrack(state, p.id, 0, 2)).toBe(2);
    expect(p.tracks.map((t) => t.videoId)).toEqual(["bbbbbbbbbbb", "ccccccccccc", "aaaaaaaaaaa"]);
    expect(moveTrack(state, p.id, 2, 99)).toBe(2); // clamped, no-op move
    expect(moveTrack(state, p.id, 1, -5)).toBe(0);
    expect(p.tracks.map((t) => t.videoId)).toEqual(["ccccccccccc", "bbbbbbbbbbb", "aaaaaaaaaaa"]);
  });

  it("renames and deletes a playlist", () => {
    const a = createPlaylist(state, "A");
    const b = createPlaylist(state, "B");
    expect(renamePlaylist(state, a.id, "Renamed")).toBe(true);
    expect(a.name).toBe("Renamed");
    deletePlaylist(state, b.id);
    expect(state.playlists).toHaveLength(1);
    expect(state.activePlaylistId).toBe(a.id);
  });

  it("imports playlists and merges into same-named ones", () => {
    importPlaylists(state, "Mix, [dQw4w9WgXcQ]");
    const summary = importPlaylists(state, "Mix, [9hc6hSKTAEA, dQw4w9WgXcQ]");
    expect(state.playlists).toHaveLength(1);
    expect(state.playlists[0].tracks).toHaveLength(2);
    expect(summary[0]).toMatchObject({ added: 1, created: false });
  });
});

describe("persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips through localStorage", () => {
    const state = emptyState();
    const p = createPlaylist(state, "Saved");
    addTracks(state, p.id, "dQw4w9WgXcQ");
    state.settings.shuffle = true;
    saveState(localStorage, state);

    const loaded = loadState(localStorage);
    expect(loaded.playlists).toHaveLength(1);
    expect(loaded.playlists[0].name).toBe("Saved");
    expect(loaded.playlists[0].tracks[0].videoId).toBe("dQw4w9WgXcQ");
    expect(loaded.settings.shuffle).toBe(true);
    expect(loaded.activePlaylistId).toBe(p.id);
  });

  it("returns a clean state for missing or corrupt storage", () => {
    expect(loadState(localStorage)).toEqual(emptyState());
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadState(localStorage)).toEqual(emptyState());
  });

  it("drops tracks with invalid ids when normalizing", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        playlists: [{ id: "p1", name: "X", tracks: [{ videoId: "good_id_123", label: "ok" }, { videoId: "bad" }] }]
      })
    );
    const loaded = loadState(localStorage);
    expect(loaded.playlists[0].tracks).toHaveLength(1);
    expect(loaded.playlists[0].tracks[0].videoId).toBe("good_id_123");
  });
});
