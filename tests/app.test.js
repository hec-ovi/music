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
  const box = q.getByRole("textbox", { name: "Bulk import" });
  await user.click(box);
  await user.clear(box);
  await user.paste(text);
  await user.click(q.getByRole("button", { name: "Import" }));
}

beforeEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
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

  it("plays a track when clicking the row outside controls and links", async () => {
    const { user, fake, root } = await setup();
    await user.click(root.querySelectorAll(".track")[1]);
    expect(fake.calls.load.at(-1)).toBe("bbbbbbbbbbb");
  });

  it("advances with Next and wraps with loop on", async () => {
    const { user, fake, root } = await setup();
    await user.click(root.querySelector("#next-button"));
    expect(fake.calls.load.at(-1)).toBe("bbbbbbbbbbb");
    await user.click(root.querySelector("#next-button"));
    await user.click(root.querySelector("#next-button")); // from 3rd wraps to 1st
    expect(fake.calls.load.at(-1)).toBe("aaaaaaaaaaa");
  });

  it("toggles play/pause through the fake player", async () => {
    const { user, fake, root } = await setup();
    const play = root.querySelector("#play-button");
    await user.click(play); // loads first track, playing
    expect(play.textContent).toBe("Pause");
    await user.click(play); // pause
    expect(fake.calls.pause).toBe(1);
    expect(play.textContent).toBe("Play");
  });

  it("stops and resets the seek bar", async () => {
    const { user, fake, root } = await setup();
    await user.click(root.querySelector("#play-button"));
    await user.click(root.querySelector("#stop-button"));
    expect(fake.calls.stop).toBe(1);
    expect(root.querySelector("#seek").value).toBe("0");
    expect(root.querySelector("#status-text").textContent).toBe("Stopped");
  });

  it("updates the timeline from player time callbacks", async () => {
    const { user, fake, root } = await setup();
    await user.click(root.querySelector("#play-button")); // create the player
    fake.time(42, 200);
    expect(root.querySelector("#time-current").textContent).toBe("0:42");
    expect(root.querySelector("#time-total").textContent).toBe("3:20");
    expect(root.querySelector("#seek").value).toBe("42");
  });

  it("auto-advances to the next track when one ends", async () => {
    const { user, fake, root } = await setup();
    await user.click(root.querySelector("#play-button")); // play track 1
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
    await user.click(root.querySelector("#play-button"));
    fake.time(42, 120);
    expect(fake.calls.load.at(-1)).toBe("aaaaaaaaaaa");
    expect(root.querySelector("#play-button").textContent).toBe("Pause");

    await user.click(q.getByRole("button", { name: /B 1 track/ }));
    expect(fake.calls.stop).toBeGreaterThan(0);
    expect(fake.calls.cue.at(-1)).toBe("bbbbbbbbbbb");
    expect(root.querySelector("#now-title").textContent).toBe("bbbbbbbbbbb");
    expect(root.querySelector("#play-button").textContent).toBe("Play");
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
    expect(root.querySelector("#play-button").textContent).toBe("Play");

    // Start playback explicitly; space then pauses and resumes with no reload.
    await user.click(root.querySelector("#play-button"));
    const loads = fake.calls.load.length;
    root.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(root.querySelector("#play-button").textContent).toBe("Play");
    root.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(root.querySelector("#play-button").textContent).toBe("Pause");
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
    await user.click(q.getByRole("textbox", { name: "Bulk import" }));
    await user.paste(text); // realistic: the user pastes the agent's output
    await user.click(q.getByRole("button", { name: "Import" }));

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

  it("opens a help modal explaining the format and the title-only rule", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();
    await user.click(q.getByRole("button", { name: "Import format help" }));
    expect(q.getByRole("dialog")).toBeTruthy();
    expect(root.querySelector("#modal-title").textContent).toBe("Bulk import format");
    const message = root.querySelector("#modal-message").textContent;
    expect(message).toMatch(/Playlist Title/);
    expect(message).toMatch(/empty playlist/);
  });

  it("copying a playlist leaves the playback status line untouched", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();
    await importViaBulk(user, q, "Mix, [VIDEOID0001]");
    const status = root.querySelector("#status-text");
    const before = status.textContent;
    root.querySelector("#export-playlist").click();
    root.querySelector("#share-playlist").click();
    await Promise.resolve();
    await Promise.resolve();
    expect(status.textContent).toBe(before);
  });

  it("dismisses a modal with the top-right close button", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();
    await user.click(q.getByRole("button", { name: "Import format help" }));
    expect(root.querySelector("#modal").hidden).toBe(false);
    await user.click(q.getByRole("button", { name: "Close" }));
    expect(root.querySelector("#modal").hidden).toBe(true);
  });

  it("keeps the modal open when the backdrop is clicked (only the X/Cancel closes it)", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();
    await user.click(q.getByRole("button", { name: "Import format help" }));
    const modalEl = root.querySelector("#modal");
    expect(modalEl.hidden).toBe(false);

    // Releasing a drag-selection outside the card lands a click on the backdrop.
    // That must not dismiss the modal.
    modalEl.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(modalEl.hidden).toBe(false);

    await user.click(q.getByRole("button", { name: "Close" }));
    expect(modalEl.hidden).toBe(true);
  });
});

describe("playlist collapse", () => {
  it("expands an imported playlist and collapses it when its header is clicked again", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();
    await importViaBulk(user, q, "Collapse Me, [VIDEOID0001]");
    expect(root.querySelector(".drawer-playlist-card.expanded")).toBeTruthy();

    await user.click(q.getByRole("button", { name: /Collapse Me/ }));
    expect(root.querySelector(".drawer-playlist-card.expanded")).toBeNull();
  });

  it("collapses through the collapse button in the detail toolbar", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();
    await importViaBulk(user, q, "Collapse Me, [VIDEOID0001]");
    const expanded = root.querySelector(".drawer-playlist-card.expanded");
    await user.click(within(expanded).getByRole("button", { name: "Collapse playlist" }));
    expect(root.querySelector(".drawer-playlist-card.expanded")).toBeNull();
  });
});

describe("playlist drawer editor", () => {
  it("adds and removes tracks from the expanded playlist detail", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();

    // A title-only import makes an empty playlist and auto-expands its editor.
    await importViaBulk(user, q, "Drawer List");

    await user.type(q.getByLabelText("Add tracks to Drawer List"), "aaaaaaaaaaa, bbbbbbbbbbb");
    await user.click(q.getByRole("button", { name: "Add tracks to playlist" }));

    expect(root.querySelectorAll(".drawer-track")).toHaveLength(2);
    expect(root.querySelector("#queue-count").textContent).toBe("2 tracks");

    const expanded = root.querySelector(".drawer-playlist-card.expanded");
    await user.click(within(expanded).getAllByRole("button", { name: "Remove track" })[0]);

    expect(loadState(localStorage).playlists[0].tracks.map((track) => track.videoId)).toEqual([
      "bbbbbbbbbbb"
    ]);
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

    await user.click(root.querySelector("#play-button")); // start at track 1
    fake.fire("ended");
    fake.fire("ended");
    const played = new Set(fake.calls.load);
    expect(played.size).toBe(3); // visited all three across the cycle
  });
});
