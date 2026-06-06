(function () {
  const playlists = window.MUSIC_PLAYLISTS || {};
  const playlistKeys = Object.keys(playlists);
  const storage = window.localStorage;

  const els = {
    librarySummary: document.getElementById("library-summary"),
    playlistTabs: document.getElementById("playlist-tabs"),
    orderedButton: document.getElementById("ordered-button"),
    shuffleButton: document.getElementById("shuffle-button"),
    loopToggle: document.getElementById("loop-toggle"),
    copyButton: document.getElementById("copy-button"),
    exportButton: document.getElementById("export-button"),
    nowPlaylist: document.getElementById("now-playlist"),
    nowTitle: document.getElementById("now-title"),
    nowSubtitle: document.getElementById("now-subtitle"),
    previousButton: document.getElementById("previous-button"),
    playButton: document.getElementById("play-button"),
    nextButton: document.getElementById("next-button"),
    youtubeLink: document.getElementById("youtube-link"),
    statusText: document.getElementById("status-text"),
    currentPosition: document.getElementById("current-position"),
    playlistSize: document.getElementById("playlist-size"),
    queueTitle: document.getElementById("queue-title"),
    queueCount: document.getElementById("queue-count"),
    search: document.getElementById("search"),
    trackList: document.getElementById("track-list")
  };

  const savedPlaylist = storage.getItem("musicLooper.playlist");
  let activeKey = playlistKeys.includes(savedPlaylist) ? savedPlaylist : playlistKeys[0];
  let playMode = storage.getItem("musicLooper.mode") === "shuffle" ? "shuffle" : "ordered";
  let loopPlaylist = storage.getItem("musicLooper.loop") !== "false";
  let player = null;
  let playerReady = false;
  let currentIndex = 0;
  let shuffleQueue = [];
  let historyStack = [];

  function activePlaylist() {
    return playlists[activeKey];
  }

  function activeTracks() {
    const playlist = activePlaylist();
    return playlist ? playlist.tracks : [];
  }

  function currentTrack() {
    return activeTracks()[currentIndex];
  }

  function totalTracks() {
    return playlistKeys.reduce((sum, key) => sum + playlists[key].tracks.length, 0);
  }

  function saveState() {
    storage.setItem("musicLooper.playlist", activeKey);
    storage.setItem("musicLooper.mode", playMode);
    storage.setItem("musicLooper.loop", String(loopPlaylist));
  }

  function setStatus(message) {
    els.statusText.textContent = message;
  }

  function shuffledIndexes() {
    const indexes = activeTracks()
      .map((_, index) => index)
      .filter((index) => index !== currentIndex);

    for (let index = indexes.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]];
    }

    return indexes;
  }

  function resetShuffleQueue() {
    shuffleQueue = shuffledIndexes();
  }

  function renderTabs() {
    els.playlistTabs.replaceChildren();

    playlistKeys.forEach((key) => {
      const playlist = playlists[key];
      const button = document.createElement("button");
      const title = document.createElement("strong");
      const meta = document.createElement("span");

      button.type = "button";
      button.className = "playlist-tab" + (key === activeKey ? " active" : "");
      button.setAttribute("aria-pressed", String(key === activeKey));
      title.textContent = playlist.name;
      meta.textContent = playlist.tracks.length + " tracks";
      button.append(title, meta);
      button.addEventListener("click", () => selectPlaylist(key, false));
      els.playlistTabs.append(button);
    });
  }

  function renderMode() {
    els.orderedButton.classList.toggle("active", playMode === "ordered");
    els.shuffleButton.classList.toggle("active", playMode === "shuffle");
    els.orderedButton.setAttribute("aria-pressed", String(playMode === "ordered"));
    els.shuffleButton.setAttribute("aria-pressed", String(playMode === "shuffle"));
    els.loopToggle.checked = loopPlaylist;
  }

  function renderNow() {
    const playlist = activePlaylist();
    const tracks = activeTracks();
    const track = currentTrack();
    const mode = playMode === "shuffle" ? "Shuffle" : "Ordered";

    els.librarySummary.textContent = playlistKeys.length + " playlists, " + totalTracks() + " tracks, served from GitHub Pages.";
    els.nowPlaylist.textContent = playlist ? playlist.name : "Playlist";
    els.nowTitle.textContent = track ? track.label : "No tracks";
    els.nowSubtitle.textContent = track && playlist ? mode + " - " + playlist.mood : "Ready";
    els.currentPosition.textContent = track ? String(currentIndex + 1) : "0";
    els.playlistSize.textContent = String(tracks.length);
    els.queueTitle.textContent = playlist ? playlist.name : "Queue";
    els.queueCount.textContent = tracks.length + " tracks";
    els.youtubeLink.href = track ? "https://youtu.be/" + track.videoId : "https://youtube.com";
  }

  function renderTracks() {
    const query = els.search.value.trim().toLowerCase();
    const fragment = document.createDocumentFragment();
    const rows = activeTracks()
      .map((track, index) => ({ track, index }))
      .filter(({ track }) => {
        const text = (track.label + " " + track.videoTitle).toLowerCase();
        return !query || text.includes(query);
      });

    els.trackList.replaceChildren();

    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No matching tracks";
      els.trackList.append(empty);
      return;
    }

    rows.forEach(({ track, index }) => {
      const row = document.createElement("div");
      const number = document.createElement("div");
      const info = document.createElement("div");
      const title = document.createElement("div");
      const source = document.createElement("div");
      const actions = document.createElement("div");
      const play = document.createElement("button");
      const youtube = document.createElement("a");

      row.className = "track" + (index === currentIndex ? " active" : "");
      number.className = "track-num";
      number.textContent = String(index + 1).padStart(2, "0");
      title.className = "track-title";
      title.textContent = track.label;
      source.className = "track-source";
      source.textContent = track.videoTitle;

      actions.className = "track-actions";
      play.className = "track-button";
      play.type = "button";
      play.textContent = "Play";
      play.addEventListener("click", () => loadTrack(index, { autoplay: true }));

      youtube.className = "link-button";
      youtube.href = "https://youtu.be/" + track.videoId;
      youtube.target = "_blank";
      youtube.rel = "noopener";
      youtube.textContent = "Open";

      info.append(title, source);
      actions.append(play, youtube);
      row.append(number, info, actions);
      fragment.append(row);
    });

    els.trackList.append(fragment);
  }

  function render() {
    renderTabs();
    renderMode();
    renderNow();
    renderTracks();
  }

  function cueCurrentTrack() {
    const track = currentTrack();
    if (!playerReady || !track) {
      return;
    }

    player.cueVideoById(track.videoId);
    setStatus("Ready");
  }

  function loadTrack(index, options = {}) {
    const tracks = activeTracks();
    const autoplay = options.autoplay !== false;
    const keepShuffle = options.keepShuffle === true;
    const recordHistory = options.recordHistory !== false;

    if (!tracks.length || index < 0 || index >= tracks.length) {
      return;
    }

    if (recordHistory && currentIndex !== index) {
      historyStack.push(currentIndex);
    }

    currentIndex = index;

    if (playMode === "shuffle" && !keepShuffle) {
      resetShuffleQueue();
    }

    renderNow();
    renderTracks();

    const track = currentTrack();
    if (!playerReady || !track) {
      setStatus("YouTube player loading");
      return;
    }

    if (autoplay) {
      player.loadVideoById(track.videoId);
      setStatus("Playing");
    } else {
      player.cueVideoById(track.videoId);
      setStatus("Ready");
    }
  }

  function selectPlaylist(key, autoplay) {
    if (!playlists[key]) {
      return;
    }

    activeKey = key;
    currentIndex = 0;
    historyStack = [];
    els.search.value = "";
    resetShuffleQueue();
    saveState();
    render();
    loadTrack(0, { autoplay, keepShuffle: true, recordHistory: false });
  }

  function setMode(mode) {
    playMode = mode;
    historyStack = [];
    resetShuffleQueue();
    saveState();
    renderMode();
    renderNow();
  }

  function finishPlaylist() {
    setStatus("Playlist complete");
    els.playButton.textContent = "Play";

    try {
      player.pauseVideo();
    } catch (error) {
      return;
    }
  }

  function nextTrack() {
    const tracks = activeTracks();
    if (!tracks.length) {
      return;
    }

    if (playMode === "shuffle") {
      if (!shuffleQueue.length) {
        if (!loopPlaylist) {
          finishPlaylist();
          return;
        }
        resetShuffleQueue();
      }

      loadTrack(shuffleQueue.shift(), { autoplay: true, keepShuffle: true });
      return;
    }

    if (currentIndex + 1 >= tracks.length) {
      if (!loopPlaylist) {
        finishPlaylist();
        return;
      }
      loadTrack(0, { autoplay: true, keepShuffle: true });
      return;
    }

    loadTrack(currentIndex + 1, { autoplay: true, keepShuffle: true });
  }

  function previousTrack() {
    const previousIndex = historyStack.pop();
    if (typeof previousIndex === "number") {
      loadTrack(previousIndex, { autoplay: true, keepShuffle: true, recordHistory: false });
      return;
    }

    const tracks = activeTracks();
    const fallback = currentIndex <= 0 ? tracks.length - 1 : currentIndex - 1;
    loadTrack(fallback, { autoplay: true, keepShuffle: true, recordHistory: false });
  }

  function togglePlay() {
    if (!playerReady) {
      setStatus("YouTube player loading");
      return;
    }

    if (player.getPlayerState() === YT.PlayerState.PLAYING) {
      player.pauseVideo();
      setStatus("Paused");
      return;
    }

    player.playVideo();
    setStatus("Playing");
  }

  function updatePlayButton() {
    if (!playerReady) {
      els.playButton.textContent = "Play";
      return;
    }

    els.playButton.textContent = player.getPlayerState() === YT.PlayerState.PLAYING ? "Pause" : "Play";
  }

  function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.ENDED) {
      nextTrack();
      return;
    }

    if (event.data === YT.PlayerState.PLAYING) {
      setStatus("Playing");
    } else if (event.data === YT.PlayerState.PAUSED) {
      setStatus("Paused");
    } else if (event.data === YT.PlayerState.BUFFERING) {
      setStatus("Buffering");
    } else if (event.data === YT.PlayerState.CUED) {
      setStatus("Ready");
    }

    updatePlayButton();
  }

  function onPlayerError() {
    setStatus("Track unavailable, skipping");
    window.setTimeout(nextTrack, 1100);
  }

  function loadYouTubeApi() {
    window.onYouTubeIframeAPIReady = function () {
      player = new YT.Player("youtube-player", {
        width: "100%",
        height: "100%",
        playerVars: {
          playsinline: 1,
          modestbranding: 1,
          rel: 0
        },
        events: {
          onReady: function () {
            playerReady = true;
            cueCurrentTrack();
            updatePlayButton();
          },
          onStateChange: onPlayerStateChange,
          onError: onPlayerError
        }
      });
    };

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.append(script);
  }

  function copyLinks() {
    const urls = activeTracks().map((track) => "https://youtu.be/" + track.videoId).join("\n");
    navigator.clipboard.writeText(urls)
      .then(() => setStatus("Links copied"))
      .catch(() => window.prompt("Copy these links:", urls));
  }

  function exportM3U() {
    const playlist = activePlaylist();
    const lines = ["#EXTM3U", "# " + playlist.name, ""];

    playlist.tracks.forEach((track) => {
      lines.push("#EXTINF:-1," + track.label);
      lines.push("https://youtu.be/" + track.videoId);
    });

    const blob = new Blob([lines.join("\n")], { type: "audio/x-mpegurl" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = activeKey + ".m3u";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function bindEvents() {
    els.orderedButton.addEventListener("click", () => setMode("ordered"));
    els.shuffleButton.addEventListener("click", () => setMode("shuffle"));
    els.loopToggle.addEventListener("change", () => {
      loopPlaylist = els.loopToggle.checked;
      saveState();
    });
    els.copyButton.addEventListener("click", copyLinks);
    els.exportButton.addEventListener("click", exportM3U);
    els.previousButton.addEventListener("click", previousTrack);
    els.playButton.addEventListener("click", togglePlay);
    els.nextButton.addEventListener("click", nextTrack);
    els.search.addEventListener("input", renderTracks);

    document.addEventListener("keydown", (event) => {
      if (event.target instanceof HTMLInputElement) {
        return;
      }

      if (event.key === " ") {
        event.preventDefault();
        togglePlay();
      } else if (event.key === "ArrowRight") {
        nextTrack();
      } else if (event.key === "ArrowLeft") {
        previousTrack();
      }
    });
  }

  function boot() {
    if (!playlistKeys.length) {
      setStatus("No playlists found");
      return;
    }

    bindEvents();
    resetShuffleQueue();
    render();
    loadYouTubeApi();
  }

  boot();
})();
