import { describe, it, expect, beforeEach, vi } from "vitest";
import { within } from "@testing-library/dom";
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

beforeEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
});

describe("creating and filling a playlist", () => {
  it("creates a playlist, adds mixed ids and links, and persists", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();

    await user.type(q.getByLabelText("New playlist name"), "My Playlist");
    await user.click(q.getByRole("button", { name: "Create playlist" }));

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
    await user.type(q.getByLabelText("New playlist name"), "X");
    await user.click(q.getByRole("button", { name: "Create playlist" }));
    await user.type(q.getByLabelText("Add tracks"), "just some words");
    await user.click(q.getByRole("button", { name: "Add" }));
    expect(root.querySelector("#status-text").textContent).toMatch(/No valid ids/);
  });
});

describe("playback", () => {
  async function setup() {
    const user = userEvent.setup();
    const harness = mount();
    await user.type(harness.q.getByLabelText("New playlist name"), "List");
    await user.click(harness.q.getByRole("button", { name: "Create playlist" }));
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
});

describe("reordering and removing", () => {
  async function setup() {
    const user = userEvent.setup();
    const harness = mount();
    await user.type(harness.q.getByLabelText("New playlist name"), "List");
    await user.click(harness.q.getByRole("button", { name: "Create playlist" }));
    await user.type(harness.q.getByLabelText("Add tracks"), "aaaaaaaaaaa, bbbbbbbbbbb, ccccccccccc");
    await user.click(harness.q.getByRole("button", { name: "Add" }));
    return { user, ...harness };
  }

  it("moves a track down with the arrow control and persists order", async () => {
    const { user, root } = await setup();
    const firstRow = root.querySelectorAll(".track")[0];
    await user.click(within(firstRow).getByRole("button", { name: "Move down" }));
    const order = [...root.querySelectorAll(".track-source")].map((n) => n.textContent);
    expect(order).toEqual(["bbbbbbbbbbb", "aaaaaaaaaaa", "ccccccccccc"]);
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
});

describe("bulk import", () => {
  it("imports multiple playlists from agent output", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();
    const details = root.querySelector("details.import");
    details.open = true;

    const text = [
      "First Playlist, [Track one | VIDEOID0002, VIDEOID0003]",
      "Second Playlist, [VIDEOID0005, Track three | VIDEOID0006]"
    ].join("\n");
    await user.click(q.getByLabelText("Bulk import"));
    await user.paste(text); // realistic: the user pastes the agent's output
    await user.click(q.getByRole("button", { name: "Import" }));

    expect(q.getByRole("button", { name: /First Playlist/ })).toBeTruthy();
    expect(q.getByRole("button", { name: /Second Playlist/ })).toBeTruthy();

    const saved = loadState(localStorage);
    expect(saved.playlists).toHaveLength(2);
    expect(saved.playlists[0].tracks[0]).toEqual({ videoId: "VIDEOID0002", label: "Track one" });
    expect(root.querySelector("#import-status").textContent).toMatch(/Imported 2 playlist/);
  });
});

describe("options", () => {
  it("reveals the video when Show video is toggled", async () => {
    const user = userEvent.setup();
    const { root, q } = mount();
    const frame = root.querySelector("#player-frame");
    expect(frame.getAttribute("data-show")).toBe("false");
    await user.click(q.getByLabelText("Show video"));
    expect(frame.getAttribute("data-show")).toBe("true");
    expect(loadState(localStorage).settings.showVideo).toBe(true);
  });

  it("persists shuffle and still plays every track without repeats in a cycle", async () => {
    const user = userEvent.setup();
    const { root, q, fake } = mount();
    await user.type(q.getByLabelText("New playlist name"), "S");
    await user.click(q.getByRole("button", { name: "Create playlist" }));
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
