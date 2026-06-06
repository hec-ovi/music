// DOM wiring + playback. The UI is rendered fully from JS into a root element
// so it can be mounted in a real page (main.js) or a jsdom test with the same
// code path. The YouTube player is injected (createPlayer) so tests run without
// the network or the IFrame API.
import {
  loadState,
  saveState,
  getPlaylist,
  createPlaylist,
  deletePlaylist,
  renamePlaylist,
  addTracks,
  removeTrack,
  renameTrack,
  moveTrack,
  importPlaylists
} from "./store.js";

const SHELL = `
  <header class="topbar">
    <div class="brand">
      <h1>Music Looper</h1>
      <p class="subhead" id="library-summary">No playlists yet</p>
    </div>
  </header>

  <section class="manage panel" aria-label="Manage playlists">
    <form class="row" id="create-form">
      <input id="create-name" class="search" type="text" placeholder="New playlist name" aria-label="New playlist name" autocomplete="off">
      <button class="button primary" id="create-button" type="submit">Create playlist</button>
    </form>
    <details class="import">
      <summary>Bulk import (paste agent output)</summary>
      <p class="hint">Format: <code>Title, [id, https://youtu.be/id, Song Name | id]</code>. One playlist per line. See <code>PLAYLISTS_FORMAT.md</code>.</p>
      <textarea id="import-text" class="import-text" rows="4" placeholder="My Playlist, [VIDEOID0001, https://youtu.be/VIDEOID0002, Track label | VIDEOID0003]" aria-label="Bulk import"></textarea>
      <div class="row">
        <button class="button" id="import-button" type="button">Import</button>
        <span class="hint" id="import-status"></span>
      </div>
    </details>
  </section>

  <nav class="playlist-tabs" id="playlist-tabs" aria-label="Playlists"></nav>

  <section class="layout" aria-label="Player">
    <div class="panel">
      <div class="player-frame" id="player-frame" data-show="false">
        <div id="youtube-player"></div>
      </div>

      <div class="player-meta">
        <div class="now">
          <div class="now-kicker" id="now-playlist">Playlist</div>
          <div class="now-title" id="now-title">Select a playlist</div>
          <div class="now-subtitle" id="now-subtitle">Ready</div>
        </div>
      </div>

      <div class="seekbar">
        <span class="time" id="time-current">0:00</span>
        <input id="seek" type="range" min="0" max="0" value="0" step="1" aria-label="Seek">
        <span class="time" id="time-total">0:00</span>
      </div>

      <div class="transport" aria-label="Transport controls">
        <button class="button" id="previous-button" type="button" aria-label="Previous">Prev</button>
        <button class="button primary" id="play-button" type="button">Play</button>
        <button class="button" id="stop-button" type="button">Stop</button>
        <button class="button" id="next-button" type="button" aria-label="Next">Next</button>
      </div>

      <div class="options" aria-label="Playback options">
        <label class="switch"><input id="shuffle-toggle" type="checkbox"><span>Shuffle</span></label>
        <label class="switch"><input id="loop-toggle" type="checkbox" checked><span>Loop</span></label>
        <label class="switch"><input id="show-video-toggle" type="checkbox"><span>Show video</span></label>
        <label class="switch volume"><span>Vol</span><input id="volume" type="range" min="0" max="100" value="100" aria-label="Volume"></label>
      </div>

      <div class="status-line">
        <span id="status-text">Create or import a playlist to begin</span>
        <span><strong id="current-position">0</strong> / <span id="playlist-size">0</span></span>
      </div>
    </div>

    <aside class="panel" aria-label="Track queue">
      <div class="queue-head">
        <div class="queue-title">
          <span id="queue-title">Queue</span>
          <span class="queue-actions">
            <button class="link-button" id="rename-playlist" type="button">Rename</button>
            <button class="link-button danger" id="delete-playlist" type="button">Delete</button>
          </span>
        </div>
        <form class="row" id="add-form">
          <input id="add-input" class="search" type="text" placeholder="Add id or link(s): id, link, id" aria-label="Add tracks" autocomplete="off">
          <button class="button" id="add-button" type="submit">Add</button>
        </form>
        <span class="queue-count" id="queue-count">0 tracks</span>
        <input class="search" id="search" type="search" placeholder="Filter tracks" aria-label="Filter tracks">
      </div>
      <div class="track-list" id="track-list"></div>
    </aside>
  </section>
`;

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ":" + String(s).padStart(2, "0");
}

export function initApp(options) {
  const root = options.root;
  const storage = options.storage || (typeof window !== "undefined" ? window.localStorage : null);
  const createPlayer = options.createPlayer;

  root.innerHTML = SHELL;
  const $ = (id) => root.querySelector("#" + id);

  const els = {
    librarySummary: $("library-summary"),
    createForm: $("create-form"),
    createName: $("create-name"),
    importText: $("import-text"),
    importButton: $("import-button"),
    importStatus: $("import-status"),
    playlistTabs: $("playlist-tabs"),
    playerFrame: $("player-frame"),
    nowPlaylist: $("now-playlist"),
    nowTitle: $("now-title"),
    nowSubtitle: $("now-subtitle"),
    seek: $("seek"),
    timeCurrent: $("time-current"),
    timeTotal: $("time-total"),
    previousButton: $("previous-button"),
    playButton: $("play-button"),
    stopButton: $("stop-button"),
    nextButton: $("next-button"),
    shuffleToggle: $("shuffle-toggle"),
    loopToggle: $("loop-toggle"),
    showVideoToggle: $("show-video-toggle"),
    volume: $("volume"),
    statusText: $("status-text"),
    currentPosition: $("current-position"),
    playlistSize: $("playlist-size"),
    queueTitle: $("queue-title"),
    queueCount: $("queue-count"),
    renamePlaylistButton: $("rename-playlist"),
    deletePlaylistButton: $("delete-playlist"),
    addForm: $("add-form"),
    addInput: $("add-input"),
    search: $("search"),
    trackList: $("track-list")
  };

  const ui = {
    confirm: options.confirm || ((msg) => (typeof window !== "undefined" ? window.confirm(msg) : true)),
    prompt: options.prompt || ((msg, def) => (typeof window !== "undefined" ? window.prompt(msg, def) : null))
  };

  let state = loadState(storage);
  let player = null;
  let playerReady = false;
  let isPlaying = false;
  let seeking = false;
  let currentIndex = 0;
  let shuffleQueue = [];
  let history = [];

  function persist() {
    saveState(storage, state);
  }

  function activePlaylist() {
    return getPlaylist(state, state.activePlaylistId);
  }

  function activeTracks() {
    const p = activePlaylist();
    return p ? p.tracks : [];
  }

  function currentTrack() {
    return activeTracks()[currentIndex] || null;
  }

  function setStatus(message) {
    els.statusText.textContent = message;
  }

  function buildShuffleQueue() {
    const indexes = activeTracks()
      .map((_, i) => i)
      .filter((i) => i !== currentIndex);
    for (let i = indexes.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
    }
    shuffleQueue = indexes;
  }

  function applyShowVideo() {
    els.playerFrame.setAttribute("data-show", String(!!state.settings.showVideo));
  }

  function renderTabs() {
    els.playlistTabs.replaceChildren();
    if (!state.playlists.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No playlists yet. Create one or import above.";
      els.playlistTabs.append(empty);
      return;
    }
    state.playlists.forEach((playlist) => {
      const button = document.createElement("button");
      const title = document.createElement("strong");
      const meta = document.createElement("span");
      button.type = "button";
      button.className = "playlist-tab" + (playlist.id === state.activePlaylistId ? " active" : "");
      button.setAttribute("aria-pressed", String(playlist.id === state.activePlaylistId));
      title.textContent = playlist.name;
      meta.textContent = playlist.tracks.length + " tracks";
      button.append(title, meta);
      button.addEventListener("click", () => selectPlaylist(playlist.id));
      els.playlistTabs.append(button);
    });
  }

  function renderNow() {
    const playlist = activePlaylist();
    const tracks = activeTracks();
    const track = currentTrack();
    const totalTracks = state.playlists.reduce((sum, p) => sum + p.tracks.length, 0);

    els.librarySummary.textContent = state.playlists.length
      ? state.playlists.length + " playlists, " + totalTracks + " tracks, stored in your browser."
      : "No playlists yet. Create one or paste an agent import below.";
    els.nowPlaylist.textContent = playlist ? playlist.name : "Playlist";
    els.nowTitle.textContent = track ? track.label : playlist ? "Empty playlist" : "Select a playlist";
    els.nowSubtitle.textContent = playlist
      ? (state.settings.shuffle ? "Shuffle" : "Ordered") + (state.settings.loop ? " • Loop" : "")
      : "Ready";
    els.currentPosition.textContent = track ? String(currentIndex + 1) : "0";
    els.playlistSize.textContent = String(tracks.length);
    els.queueTitle.textContent = playlist ? playlist.name : "Queue";
    els.queueCount.textContent = tracks.length + (tracks.length === 1 ? " track" : " tracks");
  }

  function renderTracks() {
    const query = els.search.value.trim().toLowerCase();
    els.trackList.replaceChildren();
    const tracks = activeTracks();

    if (!activePlaylist()) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No playlist selected.";
      els.trackList.append(empty);
      return;
    }

    const rows = tracks
      .map((track, index) => ({ track, index }))
      .filter(({ track }) =>
        !query || (track.label + " " + track.videoId).toLowerCase().includes(query)
      );

    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = tracks.length ? "No matching tracks" : "No tracks yet. Add ids or links above.";
      els.trackList.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    rows.forEach(({ track, index }) => {
      const row = document.createElement("div");
      row.className = "track" + (index === currentIndex ? " active" : "");
      row.setAttribute("draggable", "true");
      row.dataset.index = String(index);

      const number = document.createElement("div");
      number.className = "track-num";
      number.textContent = String(index + 1).padStart(2, "0");

      const info = document.createElement("div");
      const title = document.createElement("button");
      title.className = "track-title-button";
      title.type = "button";
      title.textContent = track.label;
      title.title = "Play";
      title.addEventListener("click", () => playIndex(index));
      const source = document.createElement("div");
      source.className = "track-source";
      source.textContent = track.videoId;
      info.append(title, source);

      const actions = document.createElement("div");
      actions.className = "track-actions";

      const up = document.createElement("button");
      up.className = "icon-button";
      up.type = "button";
      up.textContent = "↑";
      up.title = "Move up";
      up.setAttribute("aria-label", "Move up");
      up.disabled = index === 0;
      up.addEventListener("click", () => reorder(index, index - 1));

      const down = document.createElement("button");
      down.className = "icon-button";
      down.type = "button";
      down.textContent = "↓";
      down.title = "Move down";
      down.setAttribute("aria-label", "Move down");
      down.disabled = index === tracks.length - 1;
      down.addEventListener("click", () => reorder(index, index + 1));

      const rename = document.createElement("button");
      rename.className = "icon-button";
      rename.type = "button";
      rename.textContent = "✎";
      rename.title = "Rename";
      rename.setAttribute("aria-label", "Rename track");
      rename.addEventListener("click", () => {
        const next = ui.prompt("Track name", track.label);
        if (next == null) return;
        renameTrack(state, state.activePlaylistId, index, next);
        persist();
        render();
      });

      const remove = document.createElement("button");
      remove.className = "icon-button danger";
      remove.type = "button";
      remove.textContent = "✕";
      remove.title = "Remove";
      remove.setAttribute("aria-label", "Remove track");
      remove.addEventListener("click", () => removeAt(index));

      actions.append(up, down, rename, remove);
      row.append(number, info, actions);

      row.addEventListener("dragstart", (e) => {
        row.classList.add("dragging");
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", String(index));
        }
      });
      row.addEventListener("dragend", () => row.classList.remove("dragging"));
      row.addEventListener("dragover", (e) => e.preventDefault());
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        const from = Number(e.dataTransfer ? e.dataTransfer.getData("text/plain") : NaN);
        if (Number.isInteger(from)) reorder(from, index);
      });

      fragment.append(row);
    });
    els.trackList.append(fragment);
  }

  function render() {
    renderTabs();
    renderNow();
    renderTracks();
    els.shuffleToggle.checked = state.settings.shuffle;
    els.loopToggle.checked = state.settings.loop;
    els.showVideoToggle.checked = state.settings.showVideo;
    els.volume.value = String(state.settings.volume);
    applyShowVideo();
  }

  function updatePlayButton() {
    els.playButton.textContent = isPlaying ? "Pause" : "Play";
  }

  function ensurePlayer() {
    if (player || !createPlayer) return;
    player = createPlayer({
      container: els.playerFrame.querySelector("#youtube-player"),
      onReady: () => {
        playerReady = true;
        if (player.setVolume) player.setVolume(state.settings.volume);
        const track = currentTrack();
        if (track && player.cue) player.cue(track.videoId);
      },
      onStateChange: (info) => {
        if (info === "ended") {
          nextTrack(true);
          return;
        }
        isPlaying = info === "playing";
        if (info === "playing") setStatus("Playing");
        else if (info === "paused") setStatus("Paused");
        else if (info === "buffering") setStatus("Buffering");
        else if (info === "cued") setStatus("Ready");
        updatePlayButton();
      },
      onError: () => {
        setStatus("Track unavailable, skipping");
        setTimeout(() => nextTrack(true), 1000);
      },
      onTime: (current, duration) => {
        if (!seeking) {
          els.seek.max = String(Math.floor(duration) || 0);
          els.seek.value = String(Math.floor(current) || 0);
          els.timeCurrent.textContent = formatTime(current);
        }
        els.timeTotal.textContent = formatTime(duration);
      }
    });
  }

  function playIndex(index, options = {}) {
    const tracks = activeTracks();
    if (index < 0 || index >= tracks.length) return;
    if (options.recordHistory !== false && index !== currentIndex) {
      history.push(currentIndex);
    }
    currentIndex = index;
    renderNow();
    renderTracks();

    const track = currentTrack();
    if (!track) return;
    ensurePlayer();
    if (!player) {
      setStatus("Player unavailable");
      return;
    }
    player.load(track.videoId);
    isPlaying = true;
    setStatus("Playing");
    updatePlayButton();
  }

  function nextTrack(auto) {
    const tracks = activeTracks();
    if (!tracks.length) return;

    if (state.settings.shuffle) {
      if (!shuffleQueue.length) {
        if (auto && !state.settings.loop) {
          finish();
          return;
        }
        buildShuffleQueue();
        if (!shuffleQueue.length) {
          playIndex(currentIndex);
          return;
        }
      }
      playIndex(shuffleQueue.shift());
      return;
    }

    if (currentIndex + 1 >= tracks.length) {
      if (auto && !state.settings.loop) {
        finish();
        return;
      }
      playIndex(0);
      return;
    }
    playIndex(currentIndex + 1);
  }

  function previousTrack() {
    const prev = history.pop();
    if (typeof prev === "number") {
      playIndex(prev, { recordHistory: false });
      return;
    }
    const tracks = activeTracks();
    if (!tracks.length) return;
    const fallback = currentIndex <= 0 ? tracks.length - 1 : currentIndex - 1;
    playIndex(fallback, { recordHistory: false });
  }

  function finish() {
    setStatus("Playlist complete");
    isPlaying = false;
    updatePlayButton();
    if (player && player.pause) player.pause();
  }

  function togglePlay() {
    const track = currentTrack();
    if (!track) {
      setStatus("Nothing to play");
      return;
    }
    ensurePlayer();
    if (!player) return;
    if (!isPlaying && !playerReady) {
      // First interaction before the iframe finished loading: load + play.
      player.load(track.videoId);
      isPlaying = true;
      updatePlayButton();
      return;
    }
    if (isPlaying) {
      player.pause();
      isPlaying = false;
    } else {
      player.play();
      isPlaying = true;
    }
    updatePlayButton();
  }

  function stop() {
    if (player && player.stop) player.stop();
    isPlaying = false;
    els.seek.value = "0";
    els.timeCurrent.textContent = "0:00";
    setStatus("Stopped");
    updatePlayButton();
  }

  function selectPlaylist(id) {
    state.activePlaylistId = id;
    currentIndex = 0;
    history = [];
    shuffleQueue = [];
    els.search.value = "";
    if (state.settings.shuffle) buildShuffleQueue();
    persist();
    render();
    const track = currentTrack();
    if (track) {
      ensurePlayer();
      if (player && player.cue) player.cue(track.videoId);
      setStatus("Ready");
    }
  }

  function reorder(from, to) {
    const playlistId = state.activePlaylistId;
    const playing = currentTrack();
    const landed = moveTrack(state, playlistId, from, to);
    if (landed === -1) return;
    // Keep the highlighted/playing row pointing at the same track.
    if (playing) {
      const newIndex = activeTracks().findIndex((t) => t === playing);
      if (newIndex !== -1) currentIndex = newIndex;
    }
    persist();
    render();
  }

  function removeAt(index) {
    const wasCurrent = index === currentIndex;
    removeTrack(state, state.activePlaylistId, index);
    if (index < currentIndex) currentIndex -= 1;
    const tracks = activeTracks();
    if (currentIndex >= tracks.length) currentIndex = Math.max(0, tracks.length - 1);
    if (state.settings.shuffle) buildShuffleQueue();
    persist();
    render();
    if (wasCurrent && !tracks.length) stop();
  }

  // --- event wiring ---
  els.createForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = els.createName.value.trim();
    if (!name) return;
    createPlaylist(state, name);
    els.createName.value = "";
    currentIndex = 0;
    history = [];
    persist();
    render();
  });

  els.importButton.addEventListener("click", () => {
    const summary = importPlaylists(state, els.importText.value);
    if (!summary.length) {
      els.importStatus.textContent = "Nothing imported. Check the format.";
      return;
    }
    const totalAdded = summary.reduce((sum, s) => sum + s.added, 0);
    els.importStatus.textContent =
      "Imported " + summary.length + " playlist(s), " + totalAdded + " track(s).";
    els.importText.value = "";
    currentIndex = 0;
    history = [];
    if (state.settings.shuffle) buildShuffleQueue();
    persist();
    render();
  });

  els.addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!activePlaylist()) {
      setStatus("Create a playlist first");
      return;
    }
    const result = addTracks(state, state.activePlaylistId, els.addInput.value);
    els.addInput.value = "";
    if (state.settings.shuffle) buildShuffleQueue();
    persist();
    render();
    setStatus(
      result.added
        ? "Added " + result.added + " track(s)" + (result.skipped ? ", skipped " + result.skipped + " duplicate(s)" : "")
        : "No valid ids or links found"
    );
  });

  els.renamePlaylistButton.addEventListener("click", () => {
    const playlist = activePlaylist();
    if (!playlist) return;
    const next = ui.prompt("Playlist name", playlist.name);
    if (next == null) return;
    renamePlaylist(state, playlist.id, next);
    persist();
    render();
  });

  els.deletePlaylistButton.addEventListener("click", () => {
    const playlist = activePlaylist();
    if (!playlist) return;
    if (!ui.confirm('Delete playlist "' + playlist.name + '"?')) return;
    deletePlaylist(state, playlist.id);
    currentIndex = 0;
    history = [];
    shuffleQueue = [];
    stop();
    persist();
    render();
  });

  els.previousButton.addEventListener("click", previousTrack);
  els.playButton.addEventListener("click", togglePlay);
  els.stopButton.addEventListener("click", stop);
  els.nextButton.addEventListener("click", () => nextTrack(false));

  els.shuffleToggle.addEventListener("change", () => {
    state.settings.shuffle = els.shuffleToggle.checked;
    history = [];
    if (state.settings.shuffle) buildShuffleQueue();
    persist();
    renderNow();
  });
  els.loopToggle.addEventListener("change", () => {
    state.settings.loop = els.loopToggle.checked;
    persist();
    renderNow();
  });
  els.showVideoToggle.addEventListener("change", () => {
    state.settings.showVideo = els.showVideoToggle.checked;
    persist();
    applyShowVideo();
  });
  els.volume.addEventListener("input", () => {
    state.settings.volume = Number(els.volume.value);
    if (player && player.setVolume) player.setVolume(state.settings.volume);
    persist();
  });

  els.seek.addEventListener("input", () => {
    seeking = true;
    els.timeCurrent.textContent = formatTime(els.seek.value);
  });
  els.seek.addEventListener("change", () => {
    seeking = false;
    if (player && player.seekTo) player.seekTo(Number(els.seek.value));
  });

  els.search.addEventListener("input", renderTracks);

  root.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.key === " ") {
      event.preventDefault();
      togglePlay();
    } else if (event.key === "ArrowRight") {
      nextTrack(false);
    } else if (event.key === "ArrowLeft") {
      previousTrack();
    }
  });

  if (state.settings.shuffle) buildShuffleQueue();
  render();
  if (activeTracks().length) {
    ensurePlayer();
    setStatus("Ready");
  }

  // Exposed for tests / debugging.
  return {
    getState: () => state,
    render,
    playIndex,
    nextTrack,
    previousTrack,
    stop,
    togglePlay,
    selectPlaylist,
    els
  };
}
