import { describe, it, expect, beforeEach } from "vitest";
import {
  extractVideoId,
  normalizeLabel,
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
    expect(extractVideoId("VIDEOID0001")).toBe("VIDEOID0001");
    expect(extractVideoId("  VIDEOID0002 ")).toBe("VIDEOID0002");
  });

  it("parses watch?v= links with extra params", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=VIDEOID0001&t=42s")).toBe("VIDEOID0001");
  });

  it("parses youtu.be short links", () => {
    expect(extractVideoId("https://youtu.be/VIDEOID0002?si=abc")).toBe("VIDEOID0002");
  });

  it("parses embed, shorts and live paths", () => {
    expect(extractVideoId("https://www.youtube.com/embed/VIDEOID0004")).toBe("VIDEOID0004");
    expect(extractVideoId("https://youtube.com/shorts/VIDEOID0003")).toBe("VIDEOID0003");
    expect(extractVideoId("https://www.youtube.com/live/VIDEOID0006")).toBe("VIDEOID0006");
  });

  it("parses links without a scheme", () => {
    expect(extractVideoId("youtu.be/VIDEOID0002")).toBe("VIDEOID0002");
  });

  it("rejects junk", () => {
    expect(extractVideoId("")).toBeNull();
    expect(extractVideoId("not a video")).toBeNull();
    expect(extractVideoId("https://example.com/watch?v=tooShort")).toBeNull();
  });
});

describe("normalizeLabel", () => {
  it("removes commas, the most important separator, from a name", () => {
    expect(normalizeLabel("Hello, Goodbye")).toBe("Hello Goodbye");
    expect(normalizeLabel("Earth, Wind, and Fire")).toBe("Earth Wind and Fire");
  });

  it("strips dots, brackets, pipes and other punctuation/symbols", () => {
    expect(normalizeLabel("Anesthesia [NCS Release]")).toBe("Anesthesia NCS Release");
    expect(normalizeLabel("Song. (Official) | extra")).toBe("Song Official extra");
    expect(normalizeLabel("2frers - EYES ON US")).toBe("2frers EYES ON US");
  });

  it("keeps letters of any language and numbers, collapsing spaces", () => {
    expect(normalizeLabel("  Café   del   Mar 2  ")).toBe("Café del Mar 2");
  });
});

describe("parseTrackToken", () => {
  it("strips a comma and other punctuation from an explicit label", () => {
    expect(parseTrackToken("Set Me Free, Radio Edit. | VIDEOID0001")).toMatchObject({
      videoId: "VIDEOID0001",
      label: "Set Me Free Radio Edit"
    });
  });

  it("keeps the bare id as the label (underscores/dashes intact) when unnamed", () => {
    expect(parseTrackToken("CsQ59uMYB_Y").label).toBe("CsQ59uMYB_Y");
  });

  it("returns id + default label", () => {
    expect(parseTrackToken("VIDEOID0001")).toMatchObject({
      videoId: "VIDEOID0001",
      label: "VIDEOID0001",
      url: "https://www.youtube.com/watch?v=VIDEOID0001",
      thumbnailUrl: "https://i.ytimg.com/vi/VIDEOID0001/hqdefault.jpg",
      youtubeTitle: ""
    });
  });
  it("honors a Label | id form", () => {
    expect(parseTrackToken("My label | VIDEOID0001")).toMatchObject({
      videoId: "VIDEOID0001",
      label: "My label"
    });
  });
  it("honors a Label | link form", () => {
    expect(parseTrackToken("Track one | https://youtu.be/VIDEOID0002")).toMatchObject({
      videoId: "VIDEOID0002",
      label: "Track one"
    });
  });
});

describe("parseTracks", () => {
  it("splits mixed ids and links on commas", () => {
    const out = parseTracks("VIDEOID0001, https://youtu.be/VIDEOID0002, VIDEOID0003");
    expect(out.map((t) => t.videoId)).toEqual(["VIDEOID0001", "VIDEOID0002", "VIDEOID0003"]);
  });

  it("splits on newlines too and drops junk", () => {
    const out = parseTracks("VIDEOID0001\nnonsense\nVIDEOID0003");
    expect(out.map((t) => t.videoId)).toEqual(["VIDEOID0001", "VIDEOID0003"]);
  });

  it("de-dupes within the input", () => {
    const out = parseTracks("VIDEOID0001, VIDEOID0001, https://youtu.be/VIDEOID0001");
    expect(out).toHaveLength(1);
  });
});

describe("parseImport", () => {
  it("parses a single Title, [songs] block", () => {
    const out = parseImport("My Mix, [VIDEOID0001, https://youtu.be/VIDEOID0002]");
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("My Mix");
    expect(out[0].tracks.map((t) => t.videoId)).toEqual(["VIDEOID0001", "VIDEOID0002"]);
  });

  it("parses multiple playlists, one per line, with labels", () => {
    const text = [
      "First Playlist, [Track one | VIDEOID0002, VIDEOID0003]",
      "Second Playlist, [VIDEOID0005, Track three | VIDEOID0006]"
    ].join("\n");
    const out = parseImport(text);
    expect(out).toHaveLength(2);
    expect(out[0].name).toBe("First Playlist");
    expect(out[0].tracks[0]).toMatchObject({ videoId: "VIDEOID0002", label: "Track one" });
    expect(out[1].name).toBe("Second Playlist");
    expect(out[1].tracks[1].label).toBe("Track three");
  });

  it("tolerates a missing comma before the bracket", () => {
    const out = parseImport("My Mix [VIDEOID0001]");
    expect(out[0].name).toBe("My Mix");
  });

  it("ignores blocks with no valid tracks", () => {
    expect(parseImport("Empty, [nope, junk]")).toHaveLength(0);
  });

  it("treats a bracket-less line as an empty playlist", () => {
    const out = parseImport("Just A Title");
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Just A Title");
    expect(out[0].tracks).toEqual([]);
  });

  it("strips a trailing comma from a title-only line", () => {
    expect(parseImport("Solo Title,")[0].name).toBe("Solo Title");
  });

  it("mixes title-only and track-bearing lines", () => {
    const out = parseImport("Empty One\nFull, [VIDEOID0001]");
    expect(out.map((p) => p.name)).toEqual(["Empty One", "Full"]);
    expect(out[0].tracks).toHaveLength(0);
    expect(out[1].tracks).toHaveLength(1);
  });
});

describe("parseImport recovers from common agent mistakes", () => {
  it("tolerates a missing closing bracket (the single-song [ bug)", () => {
    const out = parseImport("Chill, [Lofi | VIDEOID0001");
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Chill"); // not "Chill, [Lofi | VIDEOID0001"
    expect(out[0].tracks.map((t) => t.videoId)).toEqual(["VIDEOID0001"]);
  });

  it("ignores code fences wrapped around the block", () => {
    const out = parseImport("```\nChill, [VIDEOID0001]\n```");
    expect(out).toHaveLength(1); // no junk ``` playlists
    expect(out[0].name).toBe("Chill");
  });

  it("decodes a URL-encoded block pasted into the bulk box", () => {
    const out = parseImport("Chill%2C%20%5BLofi%20%7C%20VIDEOID0001%5D");
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Chill");
    expect(out[0].tracks[0]).toMatchObject({ videoId: "VIDEOID0001", label: "Lofi" });
  });

  it("decodes a double-encoded block too", () => {
    const out = parseImport("Chill%252C%2520%255BLofi%2520%257C%2520VIDEOID0001%255D");
    expect(out[0].name).toBe("Chill");
    expect(out[0].tracks[0].videoId).toBe("VIDEOID0001");
  });

  it("never leaves a bracket or comma in the playlist name", () => {
    expect(parseImport("Weird] Name, [VIDEOID0001]")[0].name).toBe("Weird Name");
    expect(parseImport("Earth, Wind, [VIDEOID0001]")[0].name).toBe("Earth Wind");
  });

  it("leaves a clean block byte-for-byte intact", () => {
    const out = parseImport("My Mix, [Track | VIDEOID0001, VIDEOID0002]");
    expect(out[0].name).toBe("My Mix");
    expect(out[0].tracks.map((t) => t.videoId)).toEqual(["VIDEOID0001", "VIDEOID0002"]);
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
    const r1 = addTracks(state, p.id, "VIDEOID0001, https://youtu.be/VIDEOID0002");
    expect(r1).toEqual({ added: 2, skipped: 0 });
    const r2 = addTracks(state, p.id, "VIDEOID0001, VIDEOID0003");
    expect(r2).toEqual({ added: 1, skipped: 1 });
    expect(p.tracks).toHaveLength(3);
  });

  it("removes a track and renames a track", () => {
    const p = createPlaylist(state, "Test");
    addTracks(state, p.id, "VIDEOID0001, VIDEOID0003, VIDEOID0002");
    expect(renameTrack(state, p.id, 1, "Middle")).toBe(true);
    expect(p.tracks[1].label).toBe("Middle");
    expect(removeTrack(state, p.id, 0)).toBe(true);
    expect(p.tracks.map((t) => t.videoId)).toEqual(["VIDEOID0003", "VIDEOID0002"]);
  });

  it("strips a comma and punctuation when renaming a track", () => {
    const p = createPlaylist(state, "Test");
    addTracks(state, p.id, "VIDEOID0001");
    expect(renameTrack(state, p.id, 0, "Hello, World. Mix")).toBe(true);
    expect(p.tracks[0].label).toBe("Hello World Mix");
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

  it("rejects imports that reuse an existing playlist name", () => {
    importPlaylists(state, "Mix, [VIDEOID0001]");
    const summary = importPlaylists(state, "Mix, [VIDEOID0003, VIDEOID0001]");
    expect(state.playlists).toHaveLength(1);
    expect(state.playlists[0].tracks).toHaveLength(1);
    expect(summary[0]).toMatchObject({ added: 0, created: false, duplicate: true });
  });

  it("creates a new playlist when the name is unused", () => {
    const summary = importPlaylists(state, "Fresh, [VIDEOID0001, VIDEOID0002]");
    expect(state.playlists).toHaveLength(1);
    expect(state.playlists[0].tracks).toHaveLength(2);
    expect(summary[0]).toMatchObject({ added: 2, created: true, duplicate: false });
  });

  it("imports a title-only line as an empty playlist", () => {
    const summary = importPlaylists(state, "Solo Title");
    expect(state.playlists).toHaveLength(1);
    expect(state.playlists[0].name).toBe("Solo Title");
    expect(state.playlists[0].tracks).toHaveLength(0);
    expect(summary[0]).toMatchObject({ added: 0, created: true, duplicate: false });
  });
});

describe("persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips through localStorage", () => {
    const state = emptyState();
    const p = createPlaylist(state, "Saved");
    addTracks(state, p.id, "VIDEOID0001");
    state.settings.shuffle = true;
    saveState(localStorage, state);

    const loaded = loadState(localStorage);
    expect(loaded.playlists).toHaveLength(1);
    expect(loaded.playlists[0].name).toBe("Saved");
    expect(loaded.playlists[0].tracks[0].videoId).toBe("VIDEOID0001");
    expect(loaded.settings.shuffle).toBe(true);
    expect(loaded.activePlaylistId).toBe(p.id);
  });

  it("returns a clean state for missing or corrupt storage", () => {
    expect(loadState(localStorage)).toEqual(emptyState());
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadState(localStorage)).toEqual(emptyState());
  });

  it("defaults playAll off and round-trips it when set", () => {
    expect(emptyState().settings.playAll).toBe(false);

    const state = emptyState();
    state.settings.playAll = true;
    saveState(localStorage, state);
    expect(loadState(localStorage).settings.playAll).toBe(true);
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
