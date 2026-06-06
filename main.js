// Browser entry: mount the app with a real YouTube IFrame player.
import { initApp } from "./app.js";

// Load the YouTube IFrame API once and resolve when it is ready.
let apiPromise = null;
function loadYouTubeApi() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () {
      if (typeof prev === "function") prev();
      resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.append(script);
  });
  return apiPromise;
}

// Adapter that exposes the small player interface app.js expects. It defers all
// real calls until the IFrame API and the YT.Player instance are ready, queuing
// the latest requested action so an early click still plays once loaded.
function createPlayer(opts) {
  let yt = null;
  let ready = false;
  let pending = null; // { videoId, autoplay }
  let timer = null;

  function startTimer() {
    if (timer) return;
    timer = window.setInterval(() => {
      if (!yt || !ready) return;
      try {
        opts.onTime(yt.getCurrentTime(), yt.getDuration());
      } catch (_) {
        /* not ready yet */
      }
    }, 250);
  }

  loadYouTubeApi().then((YT) => {
    yt = new YT.Player(opts.container, {
      width: "100%",
      height: "100%",
      playerVars: { playsinline: 1, modestbranding: 1, rel: 0 },
      events: {
        onReady: () => {
          ready = true;
          startTimer();
          if (pending) {
            const { videoId, autoplay } = pending;
            pending = null;
            if (autoplay) yt.loadVideoById(videoId);
            else yt.cueVideoById(videoId);
          }
          opts.onReady();
        },
        onStateChange: (e) => {
          const map = {
            "-1": "unstarted",
            0: "ended",
            1: "playing",
            2: "paused",
            3: "buffering",
            5: "cued"
          };
          opts.onStateChange(map[String(e.data)] || "unknown");
        },
        onError: () => opts.onError()
      }
    });
  });

  return {
    load(videoId) {
      if (yt && ready) yt.loadVideoById(videoId);
      else pending = { videoId, autoplay: true };
    },
    cue(videoId) {
      if (yt && ready) yt.cueVideoById(videoId);
      else pending = { videoId, autoplay: false };
    },
    play() {
      if (yt && ready) yt.playVideo();
    },
    pause() {
      if (yt && ready) yt.pauseVideo();
    },
    stop() {
      if (yt && ready) yt.stopVideo();
    },
    seekTo(seconds) {
      if (yt && ready) yt.seekTo(seconds, true);
    },
    setVolume(value) {
      if (yt && ready) yt.setVolume(value);
    }
  };
}

initApp({
  root: document.getElementById("app-root"),
  storage: window.localStorage,
  createPlayer
});
