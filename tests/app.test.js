import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { within, waitFor } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { initApp } from "../app.js";
import { loadState } from "../store.js";

// A fake of the small player interface app.js expects. Records calls and lets
// tests drive state-change / time callbacks the way the real YouTube player would.
function makeFakePlayer() {
  const calls = { load: [], cue: [], play: 0, pause: 0, stop: 0, seek: [], volume: [] };
  let handlers = null;
  const player = {
    load: (id) => calls.load.push(id),
    cue: (id) => calls.cue.push(id),
    play: () => (calls.play += 1),
    pause: () => (calls.pause += 1),
    stop: () => (calls.stop += 1),
    seekTo: (s) => calls.seek.push(s),
    setVolume: (v) => calls.volume.push(v)
  };
  const createPlayer = (opts) => {
    handlers = opts;
    // The real YouTube player fires onReady asynchronously, after createPlayer
    // has returned and the app has stored the player reference.
    Promise.resolve().then(() => opts.onReady());
    return player;
  };
  return {
    createPlayer,
    calls,
    fire: (state) => handlers && handlers.onStateChange(state),
    time: (c, d) => handlers && handlers.onTime(c, d)
  };
}

function mount(extra = {}) {
  const root = document.createElement("main");
  document.body.append(root);
  const fake = makeFakePlayer();
  const app = initApp({
    root,
    storage: localStorage,
    createPlayer: fake.createPlayer,
    confirm: () => true,
    prompt: extra.prompt || (() => "Renamed"),
    ...extra
  });
  return { root, app, fake, q: within(root) };
}

// The only way to create a playlist now is the bulk import box. A bare title
// (no brackets) makes an empty playlist; "Title, [ids]" makes a filled one.
async function importViaBulk(user, q, text) {
  const box = q.getByRole("textbox", { name: "Paste playlists" });
  await user.click(box);
  await user.clear(box);
  await user.paste(text);
  await user.click(q.getByRole("button", { name: "Add to library" }));
}

beforeEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
  window.history.pushState({}, "", "/"); // drop any ?playlist= from a prior test
  // Stop any tab-title marquee a prior test left scrolling.
  if (window.__musicTitleTimer) {
    clearInterval(window.__musicTitleTimer);
    window.__musicTitleTimer = null;
  }
  document.title = "";
});

describe("creating and filling a playlist", () => {
  it("creates a playlist, adds mixed ids and links, and persists", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();

    await importViaBulk(user, q, "My Playlist");

    expect(q.getByRole("button", { name: /My Playlist/ })).toBeTruthy();

    const addInput = q.getByLabelText("Add tracks");
    await user.type(
      addInput,
      "VIDEOID0001, https://youtu.be/VIDEOID0002, VIDEOID0003"
    );
    await user.click(q.getByRole("button", { name: "Add" }));

    expect(root.querySelectorAll(".track")).toHaveLength(3);
    expect([...root.querySelectorAll(".track-source")].map((n) => n.textContent)).toEqual([
      "VIDEOID0001",
      "VIDEOID0002",
      "VIDEOID0003"
    ]);
    expect(root.querySelector("#queue-count").textContent).toBe("3 tracks");
    expect(root.querySelector(".track-link").textContent).toContain(
      "https://www.youtube.com/watch?v=VIDEOID0001"
    );

    // Persisted to localStorage.
    const saved = loadState(localStorage);
    expect(saved.playlists[0].name).toBe("My Playlist");
    expect(saved.playlists[0].tracks.map((t) => t.videoId)).toEqual([
      "VIDEOID0001",
      "VIDEOID0002",
      "VIDEOID0003"
    ]);
  });

  it("reports when no valid ids are found", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();
    await importViaBulk(user, q, "X");
    await user.type(q.getByLabelText("Add tracks"), "just some words");
    await user.click(q.getByRole("button", { name: "Add" }));
    expect(root.querySelector("#status-text").textContent).toMatch(/No valid ids/);
  });
});

describe("playback", () => {
  async function setup() {
    const user = userEvent.setup();
    const harness = mount();
    await importViaBulk(user, harness.q, "List");
    await user.type(harness.q.getByLabelText("Add tracks"), "aaaaaaaaaaa, bbbbbbbbbbb, ccccccccccc");
    await user.click(harness.q.getByRole("button", { name: "Add" }));
    return { user, ...harness };
  }

  it("plays a track on demand by clicking its title", async () => {
    const { user, fake, root } = await setup();
    const list = within(root.querySelector("#track-list"));
    await user.click(list.getByRole("button", { name: "bbbbbbbbbbb" }));
    expect(fake.calls.load).toEqual(["bbbbbbbbbbb"]);
    expect(root.querySelector("#now-title").textContent).toBe("bbbbbbbbbbb");
    expect(root.querySelector("#current-position").textContent).toBe("2");
  });

  it("scrolls the playing track into view when it changes", async () => {
    // jsdom has no scrollIntoView, so install a mock to observe the call.
    const spy = vi.fn(function () {
      this.dataset.scrolled = "1";
    });
    Element.prototype.scrollIntoView = spy;
    try {
      const { user, root } = await setup();
      await user.click(root.querySelector("#hero-next")); // play track 2
      const active = root.querySelector(".track.active");
      expect(active.querySelector(".track-title-button").textContent).toBe("bbbbbbbbbbb");
      expect(active.dataset.scrolled).toBe("1");
      expect(spy).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
    } finally {
      delete Element.prototype.scrollIntoView;
    }
  });

  it("does not scroll the list when the active track is filtered out by search", async () => {
    const spy = vi.fn();
    Element.prototype.scrollIntoView = spy;
    try {
      const { user, root } = await setup();
      await user.click(root.querySelector("#hero-play")); // play track 1 (aaaa...)
      spy.mockClear();
      const search = root.querySelector("#search");
      await user.type(search, "ccccccccccc"); // active track 1 is now filtered out
      expect(root.querySelector(".track.active")).toBeNull();
      // Re-rendering on search must not try to scroll a now-absent active row.
      expect(spy).not.toHaveBeenCalled();
    } finally {
      delete Element.prototype.scrollIntoView;
    }
  });

  it("plays a track when clicking the row outside controls and links", async () => {
    const { user, fake, root } = await setup();
    await user.click(root.querySelectorAll(".track")[1]);
    expect(fake.calls.load.at(-1)).toBe("bbbbbbbbbbb");
  });

  it("advances with Next and wraps with loop on", async () => {
    const { user, fake, root } = await setup();
    await user.click(root.querySelector("#hero-next"));
    expect(fake.calls.load.at(-1)).toBe("bbbbbbbbbbb");
    await user.click(root.querySelector("#hero-next"));
    await user.click(root.querySelector("#hero-next")); // from 3rd wraps to 1st
    expect(fake.calls.load.at(-1)).toBe("aaaaaaaaaaa");
  });

  it("toggles play/pause through the fake player", async () => {
    const { user, fake, root } = await setup();
    const play = root.querySelector("#hero-play");
    await user.click(play); // loads first track, playing
    expect(play.textContent).toBe("Pause");
    await user.click(play); // pause
    expect(fake.calls.pause).toBe(1);
    expect(play.textContent).toBe("Play");
  });

  it("stops and resets the seek bar", async () => {
    const { user, fake, root } = await setup();
    await user.click(root.querySelector("#hero-play"));
    await user.click(root.querySelector("#hero-stop"));
    expect(fake.calls.stop).toBe(1);
    expect(root.querySelector("#seek").value).toBe("0");
    expect(root.querySelector("#status-text").textContent).toBe("Stopped");
  });

  it("updates the timeline from player time callbacks", async () => {
    const { user, fake, root } = await setup();
    await user.click(root.querySelector("#hero-play")); // create the player
    fake.time(42, 200);
    expect(root.querySelector("#time-current").textContent).toBe("0:42");
    expect(root.querySelector("#time-total").textContent).toBe("3:20");
    expect(root.querySelector("#seek").value).toBe("42");
  });

  it("auto-advances to the next track when one ends", async () => {
    const { user, fake, root } = await setup();
    await user.click(root.querySelector("#hero-play")); // play track 1
    fake.fire("ended");
    expect(fake.calls.load.at(-1)).toBe("bbbbbbbbbbb");
    expect(root.querySelector("#now-title").textContent).toBe("bbbbbbbbbbb");
  });

  it("stops the old song and cues the new first track when switching playlists", async () => {
    const user = userEvent.setup();
    const { fake, root, q } = mount();

    await importViaBulk(user, q, "A, [aaaaaaaaaaa]");
    await importViaBulk(user, q, "B, [bbbbbbbbbbb]");

    await user.click(q.getByRole("button", { name: /A 1 track/ }));
    await user.click(root.querySelector("#hero-play"));
    fake.time(42, 120);
    expect(fake.calls.load.at(-1)).toBe("aaaaaaaaaaa");
    expect(root.querySelector("#hero-play").textContent).toBe("Pause");

    await user.click(q.getByRole("button", { name: /B 1 track/ }));
    expect(fake.calls.stop).toBeGreaterThan(0);
    expect(fake.calls.cue.at(-1)).toBe("bbbbbbbbbbb");
    expect(root.querySelector("#now-title").textContent).toBe("bbbbbbbbbbb");
    expect(root.querySelector("#hero-play").textContent).toBe("Play");
    expect(root.querySelector("#seek").value).toBe("0");
  });

  it("supports Winamp-style keyboard controls outside form fields", async () => {
    const { fake, root } = await setup();

    root.dispatchEvent(new KeyboardEvent("keydown", { key: "x", bubbles: true }));
    expect(fake.calls.load.at(-1)).toBe("aaaaaaaaaaa");

    root.dispatchEvent(new KeyboardEvent("keydown", { key: "b", bubbles: true }));
    expect(fake.calls.load.at(-1)).toBe("bbbbbbbbbbb");

    root.dispatchEvent(new KeyboardEvent("keydown", { key: "c", bubbles: true }));
    expect(fake.calls.pause).toBe(1);

    root.dispatchEvent(new KeyboardEvent("keydown", { key: "z", bubbles: true }));
    expect(fake.calls.load.at(-1)).toBe("aaaaaaaaaaa");

    root.dispatchEvent(new KeyboardEvent("keydown", { key: "v", bubbles: true }));
    expect(fake.calls.stop).toBe(1);
  });

  it("space resumes/pauses only and is inert before playback has started", async () => {
    const { user, fake, root } = await setup();

    // Nothing has played yet, so space must not start or load a track.
    root.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(fake.calls.play).toBe(0);
    expect(fake.calls.load).toEqual([]);
    expect(root.querySelector("#hero-play").textContent).toBe("Play");

    // Start playback explicitly; space then pauses and resumes with no reload.
    await user.click(root.querySelector("#hero-play"));
    const loads = fake.calls.load.length;
    root.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(root.querySelector("#hero-play").textContent).toBe("Play");
    root.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(root.querySelector("#hero-play").textContent).toBe("Pause");
    expect(fake.calls.load.length).toBe(loads);
  });
});

describe("reordering and removing", () => {
  async function setup() {
    const user = userEvent.setup();
    const harness = mount();
    await importViaBulk(user, harness.q, "List");
    await user.type(harness.q.getByLabelText("Add tracks"), "aaaaaaaaaaa, bbbbbbbbbbb, ccccccccccc");
    await user.click(harness.q.getByRole("button", { name: "Add" }));
    return { user, ...harness };
  }

  it("moves a track down with the arrow control and persists order", async () => {
    const { user, root } = await setup();
    const coversBefore = [...root.querySelectorAll(".cover-tile img")].map((img) => img.src);
    const firstRow = root.querySelectorAll(".track")[0];
    await user.click(within(firstRow).getByRole("button", { name: "Move down" }));
    const order = [...root.querySelectorAll(".track-source")].map((n) => n.textContent);
    const coversAfter = [...root.querySelectorAll(".cover-tile img")].map((img) => img.src);
    expect(order).toEqual(["bbbbbbbbbbb", "aaaaaaaaaaa", "ccccccccccc"]);
    expect(coversAfter).toEqual(coversBefore);
    expect(loadState(localStorage).playlists[0].tracks.map((t) => t.videoId)).toEqual([
      "bbbbbbbbbbb",
      "aaaaaaaaaaa",
      "ccccccccccc"
    ]);
  });

  it("removes a track", async () => {
    const { user, root } = await setup();
    const firstRow = root.querySelectorAll(".track")[0];
    await user.click(within(firstRow).getByRole("button", { name: "Remove track" }));
    const order = [...root.querySelectorAll(".track-source")].map((n) => n.textContent);
    expect(order).toEqual(["bbbbbbbbbbb", "ccccccccccc"]);
  });

  it("pins the drag image to the dragged row so the footer is not dragged along", async () => {
    const { root } = await setup();
    const row = root.querySelectorAll(".track")[0];
    const setDragImage = vi.fn();
    const dataTransfer = { effectAllowed: "", setData: vi.fn(), setDragImage };

    const event = new Event("dragstart", { bubbles: true });
    Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
    row.dispatchEvent(event);

    expect(setDragImage).toHaveBeenCalledTimes(1);
    // The ghost is exactly this row element, nothing larger (e.g. the player dock).
    expect(setDragImage.mock.calls[0][0]).toBe(row);
    expect(row.classList.contains("dragging")).toBe(true);
  });
});

describe("bulk import", () => {
  it("imports multiple playlists from agent output", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();
    expect(root.querySelector("#import-panel")).toBeTruthy();

    const text = [
      "First Playlist, [Track one | VIDEOID0002, VIDEOID0003]",
      "Second Playlist, [VIDEOID0005, Track three | VIDEOID0006]"
    ].join("\n");
    await user.click(q.getByRole("textbox", { name: "Paste playlists" }));
    await user.paste(text); // realistic: the user pastes the agent's output
    await user.click(q.getByRole("button", { name: "Add to library" }));

    expect(q.getByRole("button", { name: /First Playlist/ })).toBeTruthy();
    expect(q.getByRole("button", { name: /Second Playlist/ })).toBeTruthy();

    const saved = loadState(localStorage);
    expect(saved.playlists).toHaveLength(2);
    expect(saved.playlists[0].tracks[0]).toMatchObject({ videoId: "VIDEOID0002", label: "Track one" });
    expect(root.querySelector("#import-status").textContent).toMatch(/Imported 2 playlist/);
  });

  it("creates an empty playlist from a title-only line", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();
    await importViaBulk(user, q, "Just A Title");
    expect(q.getByRole("button", { name: /Just A Title/ })).toBeTruthy();
    const saved = loadState(localStorage);
    expect(saved.playlists).toHaveLength(1);
    expect(saved.playlists[0].name).toBe("Just A Title");
    expect(saved.playlists[0].tracks).toHaveLength(0);
  });

  it("rejects a second import that reuses an existing playlist name", async () => {
    const user = userEvent.setup();
    const { root, q } = mount({ alert: () => true });
    await importViaBulk(user, q, "Dup, [VIDEOID0001]");
    await importViaBulk(user, q, "Dup, [VIDEOID0002, VIDEOID0003]");

    const saved = loadState(localStorage);
    expect(saved.playlists).toHaveLength(1);
    expect(saved.playlists[0].tracks).toHaveLength(1); // duplicate import discarded
    expect(root.querySelector("#import-status").textContent).toMatch(/already exist/);
  });

  it("opens the playlist format modal explaining the pipe and the label rule", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();
    await user.click(q.getByRole("button", { name: "Playlist format help" }));
    const modal = root.querySelector("#import-modal");
    expect(modal.hidden).toBe(false);
    expect(root.querySelector("#import-modal-title").textContent).toBe("Playlist format");
    // The | is explained as a separator (not "or") and a name alone is useless.
    expect(modal.textContent).toMatch(/does not mean/i);
    expect(modal.textContent).toMatch(/name on its own does nothing/i);
    expect(modal.textContent).toMatch(/empty playlist/i);
    // Examples are shown in dedicated snippet boxes.
    expect(modal.querySelectorAll(".help-snippet").length).toBeGreaterThan(0);
  });

  it("export and share leave the playback status line untouched", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();
    await importViaBulk(user, q, "Mix, [VIDEOID0001]");
    const status = root.querySelector("#status-text");
    const before = status.textContent;

    await user.click(root.querySelector("#export-playlist")); // opens the export modal
    await user.click(root.querySelector("#export-copy")); // copy to clipboard
    root.querySelector("#share-playlist").click(); // copy share link
    await Promise.resolve();
    await Promise.resolve();

    expect(status.textContent).toBe(before);
    // Copy feedback lands in the modal's own status, not the player status line.
    expect(root.querySelector("#export-status").textContent).toMatch(/clipboard|failed/i);
  });

  it("downloads the active playlist as a .md file named after it", async () => {
    const user = userEvent.setup();
    const createURL = vi.fn(() => "blob:mock");
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    const origClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = createURL;
    URL.revokeObjectURL = vi.fn();
    let downloaded = null;
    HTMLAnchorElement.prototype.click = function () {
      downloaded = this.download;
    };
    try {
      const { root, q } = mount();
      await importViaBulk(user, q, "Mix Tape, [VIDEOID0001]");
      await user.click(root.querySelector("#export-playlist"));
      await user.click(root.querySelector("#export-download"));

      expect(createURL).toHaveBeenCalled();
      expect(downloaded).toBe("Mix-Tape.md");
      expect(root.querySelector("#export-status").textContent).toMatch(/Downloaded/);
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
      HTMLAnchorElement.prototype.click = origClick;
    }
  });

  it("imports playlists from an uploaded text file", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();
    const file = new File(["From File, [VIDEOID0001, VIDEOID0002]"], "playlist.md", {
      type: "text/markdown"
    });

    // The input is hidden (triggered by its label), so set files directly and
    // fire change rather than going through user.upload on a hidden element.
    const input = root.querySelector("#import-file-input");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));

    await waitFor(() => {
      const saved = loadState(localStorage);
      const imported = saved.playlists.find((p) => p.name === "From File");
      expect(imported).toBeTruthy();
      expect(imported.tracks.map((t) => t.videoId)).toEqual(["VIDEOID0001", "VIDEOID0002"]);
    });
    expect(root.querySelector("#import-status").textContent).toMatch(/Imported/);
  });

  it("share copies the link and opens a confirmation modal showing it", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();
    await importViaBulk(user, q, "Share Me, [VIDEOID0001]");

    await user.click(root.querySelector("#share-playlist"));
    const modal = root.querySelector("#share-modal");
    await waitFor(() => expect(modal.hidden).toBe(false));
    expect(root.querySelector("#share-name").textContent).toContain("Share Me");
    expect(root.querySelector("#share-url").textContent).toMatch(/\?playlist=/);

    await user.click(within(modal).getByRole("button", { name: "Close" }));
    expect(modal.hidden).toBe(true);
  });

  it("dismisses the import format modal with its close button", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();
    await user.click(q.getByRole("button", { name: "Playlist format help" }));
    const modal = root.querySelector("#import-modal");
    expect(modal.hidden).toBe(false);
    await user.click(within(modal).getByRole("button", { name: "Close" }));
    expect(modal.hidden).toBe(true);
  });

  it("keeps the import format modal open when its backdrop is clicked", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();
    await user.click(q.getByRole("button", { name: "Playlist format help" }));
    const modal = root.querySelector("#import-modal");
    expect(modal.hidden).toBe(false);

    // A stray click on the backdrop must not dismiss it (only the X does).
    modal.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(modal.hidden).toBe(false);

    await user.click(within(modal).getByRole("button", { name: "Close" }));
    expect(modal.hidden).toBe(true);
  });

  it("keeps the alert modal open when its backdrop is clicked (only X/OK closes it)", async () => {
    const user = userEvent.setup();
    const { root, q } = mount(); // no alert stub: a duplicate opens the real modal
    await importViaBulk(user, q, "Dup, [VIDEOID0001]");
    await importViaBulk(user, q, "Dup, [VIDEOID0002]"); // duplicate name -> alert

    const modalEl = root.querySelector("#modal");
    await waitFor(() => expect(modalEl.hidden).toBe(false));
    // Releasing a drag-selection outside the card lands a click on the backdrop.
    modalEl.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(modalEl.hidden).toBe(false);

    await user.click(within(modalEl).getByRole("button", { name: "OK" }));
    expect(modalEl.hidden).toBe(true);
  });
});

describe("playlist selection and collapse", () => {
  it("nothing is selected or open when a saved library first appears", async () => {
    const user = userEvent.setup();
    // Seed storage with a playlist, then mount fresh to simulate a reload.
    const seed = mount();
    await importViaBulk(user, seed.q, "Saved, [VIDEOID0001]");
    seed.root.remove();

    const { root } = mount();
    expect(root.querySelector(".drawer-playlist-card")).toBeTruthy(); // the row is there
    expect(root.querySelector(".drawer-playlist-card.selected")).toBeNull(); // but unselected
    expect(root.querySelector(".drawer-playlist-card.open")).toBeNull();
    expect(root.querySelector(".drawer-playlist-controls")).toBeNull(); // and no controls
  });

  it("does not fold the editor when the already-selected row's body is clicked", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();
    await importViaBulk(user, q, "Collapse Me, [VIDEOID0001]"); // selected + open
    expect(root.querySelector(".drawer-playlist-card.open")).toBeTruthy();

    // Clicking the body of the already-selected row does nothing: it stays open.
    await user.click(q.getByRole("button", { name: /Collapse Me/ }));
    expect(root.querySelector(".drawer-playlist-card.open")).toBeTruthy();

    // Only the collapse arrow folds it; the row stays selected (controls remain).
    await user.click(q.getByRole("button", { name: "Collapse playlist" }));
    expect(root.querySelector(".drawer-playlist-card.open")).toBeNull();
    expect(root.querySelector(".drawer-playlist-card.selected")).toBeTruthy();
  });

  it("folds and reopens the selected playlist with its collapse arrow", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();
    await importViaBulk(user, q, "Collapse Me, [VIDEOID0001]");
    await user.click(q.getByRole("button", { name: "Collapse playlist" }));
    expect(root.querySelector(".drawer-playlist-card.open")).toBeNull();

    await user.click(q.getByRole("button", { name: "Expand playlist" }));
    expect(root.querySelector(".drawer-playlist-card.open")).toBeTruthy();
  });

  it("shows controls only on the selected row and moves them when selection changes", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();
    await importViaBulk(user, q, "Alpha, [VIDEOID0001]");
    await importViaBulk(user, q, "Beta, [VIDEOID0002]"); // Beta is now the selected one

    // Exactly one selected row, carrying a single set of controls.
    expect(root.querySelectorAll(".drawer-playlist-card.selected")).toHaveLength(1);
    expect(q.getAllByRole("button", { name: "Rename playlist" })).toHaveLength(1);

    // Selecting Alpha moves the selection there and collapses everything.
    await user.click(q.getByRole("button", { name: /Alpha/ }));
    const selected = root.querySelector(".drawer-playlist-card.selected");
    expect(within(selected).getByText("Alpha")).toBeTruthy();
    expect(root.querySelector(".drawer-playlist-card.open")).toBeNull();
    expect(q.getAllByRole("button", { name: "Rename playlist" })).toHaveLength(1);
  });
});

describe("playlist drawer editor", () => {
  it("adds and removes tracks from the open playlist detail", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();

    // A title-only import makes an empty playlist and opens its editor.
    await importViaBulk(user, q, "Drawer List");

    await user.type(q.getByLabelText("Add tracks to Drawer List"), "aaaaaaaaaaa, bbbbbbbbbbb");
    await user.click(q.getByRole("button", { name: "Add tracks to playlist" }));

    expect(root.querySelectorAll(".drawer-track")).toHaveLength(2);
    expect(root.querySelector("#queue-count").textContent).toBe("2 tracks");

    const open = root.querySelector(".drawer-playlist-card.open");
    await user.click(within(open).getAllByRole("button", { name: "Remove track" })[0]);

    expect(loadState(localStorage).playlists[0].tracks.map((track) => track.videoId)).toEqual([
      "bbbbbbbbbbb"
    ]);
  });
});

describe("loading a shared playlist from the URL", () => {
  it("rebuilds the playlist even when the agent double-encoded the link", async () => {
    const block = "Shared Mix, [Lofi | VIDEOID0001, VIDEOID0002]";
    // encodeURIComponent twice models an agent that encoded an already-encoded block.
    const param = encodeURIComponent(encodeURIComponent(block));
    window.history.pushState({}, "", "/?playlist=" + param);

    mount();

    await waitFor(() => {
      const saved = loadState(localStorage);
      const shared = saved.playlists.find((p) => p.name === "Shared Mix");
      expect(shared).toBeTruthy();
      expect(shared.tracks.map((t) => t.videoId)).toEqual(["VIDEOID0001", "VIDEOID0002"]);
    });
  });
});

describe("auto-naming from the YouTube title", () => {
  afterEach(() => {
    delete global.fetch;
  });

  it("names an unlabeled track after its title, stripping the comma and punctuation", async () => {
    const user = userEvent.setup();
    // A real oembed title with a comma, which must never survive into the name.
    const rawTitle = "Earth, Wind & Fire - September (Official Audio)";
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ title: rawTitle }) })
    );

    const { root, q } = mount({ resolveTitles: true });
    await importViaBulk(user, q, "Disco, [VIDEOID0001]");

    await waitFor(() => {
      const track = loadState(localStorage).playlists[0].tracks[0];
      expect(track.label).toBe("Earth Wind Fire September Official Audio");
      expect(track.youtubeTitle).toBe(rawTitle); // raw title kept for the source line
    });
    expect(global.fetch).toHaveBeenCalled();
  });

  it("never overwrites a label the user supplied with the fetched title", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ title: "Some Other Title" }) })
    );

    const { root, q } = mount({ resolveTitles: true });
    await importViaBulk(user, q, "Named, [My Song | VIDEOID0001]");

    await waitFor(() => {
      expect(loadState(localStorage).playlists[0].tracks[0].youtubeTitle).toBe("Some Other Title");
    });
    expect(loadState(localStorage).playlists[0].tracks[0].label).toBe("My Song");
  });

  it("resolves the title for every track, including playlists that are not active", async () => {
    const user = userEvent.setup();
    // The title comes back keyed off the requested video id, so each track must
    // end up with its own real title rather than falling back to the bare id.
    global.fetch = vi.fn((url) => {
      const which = String(url).includes("VIDEOID0001") ? "One" : "Two";
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ title: "Song " + which + " (Official Video)" })
      });
    });

    const { q } = mount({ resolveTitles: true });
    await importViaBulk(user, q, "A, [VIDEOID0001]");
    await importViaBulk(user, q, "B, [VIDEOID0002]"); // B becomes active, A is not

    await waitFor(() => {
      const saved = loadState(localStorage);
      const a = saved.playlists.find((p) => p.name === "A");
      const b = saved.playlists.find((p) => p.name === "B");
      // The non-active playlist's track must still carry the real video title.
      expect(a.tracks[0].youtubeTitle).toBe("Song One (Official Video)");
      expect(b.tracks[0].youtubeTitle).toBe("Song Two (Official Video)");
    });
  });
});

describe("tooltips", () => {
  it("shows tooltips for hero tools but not the transport, queue, or drawer", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();
    await importViaBulk(user, q, "T, [VIDEOID0001]");
    const tip = root.querySelector("#tooltip");
    const fire = (el) => el.dispatchEvent(new Event("pointerover", { bubbles: true }));

    // Transport buttons: no tooltip.
    for (const id of ["#hero-previous", "#hero-play", "#hero-stop", "#hero-next"]) {
      fire(root.querySelector(id));
      expect(tip.hidden).toBe(true);
    }

    // Track queue rows: no tooltip.
    fire(root.querySelector(".track-title-button"));
    expect(tip.hidden).toBe(true);

    // Hero YouTube link: no tooltip.
    fire(root.querySelector("#now-subtitle"));
    expect(tip.hidden).toBe(true);

    // Modal close buttons: no tooltip.
    fire(root.querySelector("#help-close"));
    expect(tip.hidden).toBe(true);

    // Hero tools keep their tooltip.
    fire(root.querySelector("#share-playlist"));
    expect(tip.hidden).toBe(false);
    expect(tip.textContent).toBe("Copy share link");
  });
});

describe("options", () => {
  it("shows the video by default and hides it when the user toggles it off", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();
    const frame = root.querySelector("#player-frame");
    expect(frame.getAttribute("data-show")).toBe("true"); // visible by default
    await user.click(q.getByLabelText("Show video")); // user chooses to hide it
    expect(frame.getAttribute("data-show")).toBe("false");
    expect(loadState(localStorage).settings.showVideo).toBe(false);
  });

  it("persists shuffle and still plays every track without repeats in a cycle", async () => {
    const user = userEvent.setup();
    const { root, q, fake } = mount();
    await importViaBulk(user, q, "S");
    await user.type(q.getByLabelText("Add tracks"), "aaaaaaaaaaa, bbbbbbbbbbb, ccccccccccc");
    await user.click(q.getByRole("button", { name: "Add" }));

    await user.click(q.getByLabelText("Shuffle"));
    expect(loadState(localStorage).settings.shuffle).toBe(true);

    await user.click(root.querySelector("#hero-play")); // start at track 1
    fake.fire("ended");
    fake.fire("ended");
    const played = new Set(fake.calls.load);
    expect(played.size).toBe(3); // visited all three across the cycle
  });
});

describe("now-playing tab title marquee", () => {
  async function setupPlaying() {
    const user = userEvent.setup();
    const harness = mount();
    await importViaBulk(user, harness.q, "Tab, [My Label | VIDEOID0001]");
    return { user, ...harness };
  }

  it("scrolls 'Now Playing: label - title' while playing and restores it on stop", async () => {
    const { user, root } = await setupPlaying();

    await user.click(within(root.querySelector("#track-list")).getByRole("button", { name: "My Label" }));
    // The marquee seeds the title with the un-rotated string before the first tick.
    expect(document.title).toContain("Now Playing: My Label - VIDEOID0001");
    expect(window.__musicTitleTimer).toBeTruthy();

    await user.click(root.querySelector("#hero-stop"));
    expect(document.title).toBe("Personal Music YT Player");
    expect(window.__musicTitleTimer).toBeFalsy();
  });

  it("uses the resolved YouTube title in the marquee once it arrives", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ title: "Real Song Title" }) })
    );
    const { q, root } = mount({ resolveTitles: true });
    await importViaBulk(user, q, "Tab, [VIDEOID0001]");
    // The label auto-renames once the title resolves, so click the row itself
    // (stable) rather than a name that is about to change.
    await user.click(root.querySelector(".track-title-button"));

    await waitFor(() => {
      expect(document.title).toContain("Real Song Title");
    });
    delete global.fetch;
  });
});

describe("how-to-use help modal", () => {
  it("opens from the hero info button and shows the keyboard guide, then closes", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();

    const help = root.querySelector("#help-modal");
    expect(help.hidden).toBe(true);

    await user.click(q.getByRole("button", { name: "How to use" }));
    expect(help.hidden).toBe(false);
    const dialog = within(help);
    expect(dialog.getByText("Pause / resume")).toBeTruthy();
    expect(dialog.getByText("Space")).toBeTruthy();
    expect(dialog.getByText("Next")).toBeTruthy();

    await user.click(dialog.getByRole("button", { name: "Close" }));
    expect(help.hidden).toBe(true);
  });
});

describe("hero now-playing lines", () => {
  it("shows the song name, the YouTube subtitle, and a link out to the video", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();
    await importViaBulk(user, q, "Hero, [Tycho Song | VIDEOID0001]");

    await user.click(within(root.querySelector("#track-list")).getByRole("button", { name: "Tycho Song" }));

    expect(root.querySelector("#now-song").textContent).toBe("Tycho Song");
    const link = root.querySelector("#now-subtitle");
    expect(link.getAttribute("href")).toBe("https://www.youtube.com/watch?v=VIDEOID0001");
    expect(link.hasAttribute("aria-disabled")).toBe(false);

    // The "PLAYLIST:" kicker plus name live under the hero, in the queue header.
    expect(root.querySelector("#queue-kicker").hidden).toBe(false);
    expect(root.querySelector("#queue-name").textContent).toBe("Hero");
  });
});
