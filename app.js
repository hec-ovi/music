// DOM wiring + playback. Still framework-free, but organized around small
// render helpers so the static app stays easy to change.
import {
  emptyState,
  STORAGE_KEY,
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
  importPlaylists,
  playlistToBulkText,
  normalizeLabel
} from "./store.js";

const ICONS = {
  add: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
  import: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v10.2l3.6-3.6L17 11l-6 6-6-6 1.4-1.4 3.6 3.6V3z"/><path d="M5 19h14v2H5z"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 13.5a3 3 0 1 1 0-3l6-3.1a3 3 0 1 1 .9 1.8l-6 3.1 6 3.1a3 3 0 1 1-.9 1.8z"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10H7z"/></svg>',
  previous: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2v14H6zM9 12l9-7v14z"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5h2v14h-2zM6 5l9 7-9 7z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17.2V20h2.8L17.1 9.7l-2.8-2.8z"/><path d="M18 8.8 15.2 6 17 4.2c.4-.4 1-.4 1.4 0l1.4 1.4c.4.4.4 1 0 1.4z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 9h2v9H8zM14 9h2v9h-2z"/><path d="M5 6h14v2H5zM9 4h6l1 2H8zM7 8h10l-.8 12H7.8z"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z"/></svg>',
  external: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h6v2H8v8h8v-4h2v6H6z"/><path d="M14 4h6v6h-2V7.4l-6.3 6.3-1.4-1.4L16.6 6H14z"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 7 6 6-1.4 1.4L13 10.8V18h-2v-7.2l-3.6 3.6L6 13z"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 17-6-6 1.4-1.4L11 13.2V6h2v7.2l3.6-3.6L18 11z"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3h4v4h-2V6.4l-4.4 4.4-1.4-1.4L17.6 5H17zM4 7h3.2c1.8 0 3.1.7 4.2 2.1l6.2 8.5H21v2h-4.4l-6.8-9.3C9.1 9.4 8.3 9 7.2 9H4z"/><path d="M4 17h3.2c1.1 0 1.9-.4 2.6-1.3l1-1.4 1.4 1.4-.8 1.2C10.3 18.3 9 19 7.2 19H4z"/></svg>',
  loop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h8.6L14 5.4 15.4 4 19.4 8l-4 4L14 10.6 15.6 9H7a3 3 0 0 0 0 6h1v2H7A5 5 0 0 1 7 7z"/><path d="M17 17H8.4l1.6 1.6L8.6 20l-4-4 4-4 1.4 1.4L8.4 15H17a3 3 0 0 0 0-6h-1V7h1a5 5 0 0 1 0 10z"/></svg>',
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c5 0 8.5 4.2 9.7 6.2.2.5.2 1.1 0 1.6C20.5 14.8 17 19 12 19s-8.5-4.2-9.7-6.2a1.8 1.8 0 0 1 0-1.6C3.5 9.2 7 5 12 5zm0 2c-4 0-6.9 3.3-8 5 1.1 1.7 4 5 8 5s6.9-3.3 8-5c-1.1-1.7-4-5-8-5z"/><path d="M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/></svg>',
  more: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM12 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM18 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 1.9a8.1 8.1 0 1 1 0 16.2 8.1 8.1 0 0 1 0-16.2z"/><path d="M11 10.5h2V17h-2zM11 6.7h2v2.2h-2z"/></svg>',
  upload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 4 5 5-1.4 1.4L13 7.8V16h-2V7.8L8.4 10.4 7 9z"/><path d="M5 18h14v2H5z"/></svg>'
};

const DUPLICATE_PLAYLIST_MESSAGE = "playlist already exist, remove actual, or rename it";

// Tab title shown when nothing is playing; while a track plays it is replaced by
// a scrolling "Now Playing: ..." marquee (see startTitleMarquee).
const DEFAULT_TITLE = "Personal Music YT Player";

const SHELL = `
  <div class="app-shell">
    <section class="hero" aria-label="Playlist overview">
      <div class="hero-bg" id="hero-bg"></div>
      <div class="cover-grid" id="cover-grid" aria-hidden="true"></div>
      <div class="hero-copy">
        <div class="eyebrow" id="now-song">Song</div>
        <div class="hero-title" id="now-title">Select a playlist</div>
        <a class="hero-subtitle" id="now-subtitle" href="#" target="_blank" rel="noreferrer" aria-disabled="true">Ready</a>
        <div class="hero-transport" aria-label="Quick playback">
          <button class="round-button" id="hero-previous" type="button" aria-label="Previous"></button>
          <button class="round-button primary hero-play" id="hero-play" type="button" aria-label="Play"></button>
          <button class="round-button" id="hero-stop" type="button" aria-label="Stop"></button>
          <button class="round-button" id="hero-next" type="button" aria-label="Next"></button>
        </div>
      </div>
      <div class="hero-actions" aria-label="Playlist tools">
        <div class="hero-tools" aria-label="Playlist tools">
          <button class="hero-tool-button" id="export-playlist" type="button" aria-label="Export playlist"></button>
          <button class="hero-tool-button" id="share-playlist" type="button" aria-label="Copy share link"></button>
          <button class="hero-tool-button" id="help-button" type="button" aria-label="How to use"></button>
        </div>
      </div>
    </section>

    <main class="workspace" aria-label="Music library">
      <section class="queue-panel" aria-label="Track queue">
        <div class="queue-head">
          <div>
            <div class="queue-title" id="queue-title"><span class="queue-kicker" id="queue-kicker">PLAYLIST:</span> <span class="queue-name" id="queue-name">Queue</span></div>
            <div class="queue-count" id="queue-count">0 tracks</div>
          </div>
          <input class="field search-field" id="search" type="search" placeholder="Filter tracks" aria-label="Filter tracks">
        </div>

        <form class="add-form" id="add-form">
          <input id="add-input" class="field add-field" type="text" placeholder="To add a track, paste a YouTube link and hit enter, e.g. https://youtube.com/watch?v=VIDEOID" aria-label="Add tracks" autocomplete="off">
          <button class="icon-submit add-submit" id="add-button" type="submit" aria-label="Add"></button>
        </form>

        <div class="track-list" id="track-list"></div>
      </section>
    </main>

    <button class="drawer-tab" id="drawer-toggle" type="button" aria-label="Open playlists" aria-expanded="false">
      <span>Playlists</span>
    </button>

    <aside class="playlist-drawer" id="playlist-drawer" data-open="false" aria-label="Playlists">
      <div class="drawer-head">
        <div>
          <div class="drawer-title">Playlist editor</div>
          <div class="drawer-summary" id="library-summary">No playlists yet</div>
        </div>
        <button class="round-button" id="drawer-close" type="button" aria-label="Close playlists"></button>
      </div>

      <section class="drawer-panel drawer-add-panel" id="playlist-add-panel" aria-label="Add playlists">
        <div class="drawer-section-title">Add playlists</div>

        <section class="import" id="import-panel" aria-label="Paste playlists">
          <div class="import-head">
            <div class="import-title">Paste playlists</div>
            <button class="info-button" id="import-info" type="button" aria-label="Playlist format help"></button>
          </div>
          <p class="hint">Write a playlist as text. The "?" explains the format.</p>
          <textarea id="import-text" class="import-text" rows="3" placeholder="My Playlist, [https://youtu.be/VIDEOID, Song name | https://youtu.be/VIDEOID]" aria-label="Paste playlists"></textarea>
          <div class="inline-actions">
            <button class="mode-button import-action" id="import-button" type="button">Add to library</button>
            <span class="hint" id="import-status"></span>
          </div>
        </section>

        <div class="drawer-mini-panel import-mini" aria-label="Import from file">
          <div>
            <div class="drawer-section-title">Import</div>
            <p class="drawer-note">Load playlists straight from a <code>.md</code> or <code>.txt</code> file.</p>
          </div>
          <button class="round-button import-file-action" id="import-file-button" type="button" aria-label="Import from file"></button>
          <input id="import-file-input" type="file" accept=".md,.txt,text/plain,text/markdown" hidden>
        </div>
      </section>

      <section class="drawer-panel drawer-library-panel" aria-label="Playlist list">
        <div class="drawer-list-title">Playlist list</div>
        <nav class="playlist-tabs" id="playlist-tabs" aria-label="Playlists"></nav>
      </section>

      <section class="drawer-panel drawer-reset-panel" aria-label="Local data">
        <div>
          <div class="drawer-section-title">Remove</div>
          <p class="drawer-note">Wipe all playlists and player settings stored in this browser.</p>
        </div>
        <button class="round-button danger clean-action" id="clear-local" type="button" aria-label="Wipe local data"></button>
      </section>
    </aside>

    <footer class="player-dock" aria-label="Player">
      <div class="player-frame" id="player-frame" data-show="false">
        <div id="youtube-player"></div>
      </div>

      <div class="now-card">
        <img class="now-art" id="now-art" alt="">
        <div class="now-text">
          <div class="now-label" id="dock-title">Nothing selected</div>
          <a class="now-link" id="dock-link" href="#" target="_blank" rel="noreferrer">YouTube</a>
        </div>
      </div>

      <div class="dock-center">
        <div class="seekbar">
          <span class="time" id="time-current">0:00</span>
          <input id="seek" type="range" min="0" max="0" value="0" step="1" aria-label="Seek">
          <span class="time" id="time-total">0:00</span>
        </div>
      </div>

      <div class="options" aria-label="Playback options">
        <label class="switch" title="Shuffle"><input id="shuffle-toggle" type="checkbox"><span data-icon="shuffle"></span><span class="sr-only">Shuffle</span></label>
        <label class="switch" title="Loop"><input id="loop-toggle" type="checkbox" checked><span data-icon="loop"></span><span class="sr-only">Loop</span></label>
        <label class="switch" title="Show video"><input id="show-video-toggle" type="checkbox" checked><span data-icon="eye"></span><span class="sr-only">Show video</span></label>
        <label class="volume"><span class="sr-only">Volume</span><input id="volume" type="range" min="0" max="100" value="100" aria-label="Volume"></label>
      </div>

      <div class="status-line">
        <span id="status-text">Create or import a playlist to begin</span>
        <span><strong id="current-position">0</strong> / <span id="playlist-size">0</span></span>
      </div>
    </footer>
  </div>

  <div class="modal-backdrop" id="modal" hidden>
    <form class="modal-card" id="modal-form" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button class="modal-close" id="modal-close" type="button" aria-label="Close"></button>
      <h2 id="modal-title">Confirm</h2>
      <p id="modal-message"></p>
      <input id="modal-input" class="field" type="text" autocomplete="off">
      <div class="modal-actions">
        <button class="button primary" id="modal-confirm" type="submit">OK</button>
        <button class="button" id="modal-cancel" type="button">Cancel</button>
      </div>
    </form>
  </div>

  <div class="modal-backdrop help-backdrop" id="help-modal" hidden>
    <div class="help-card" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <button class="modal-close" id="help-close" type="button" aria-label="Close"></button>
      <h2 id="help-title">How to use</h2>
      <ol class="help-steps">
        <li><span class="help-step-num">1</span><span>Open <strong>Playlists</strong>, paste a title or a bulk block to build a list.</span></li>
        <li><span class="help-step-num">2</span><span>Drop a YouTube link in the <strong>Add</strong> field, then click a track to play.</span></li>
        <li><span class="help-step-num">3</span><span>Drive it with the transport buttons, or the keys below.</span></li>
      </ol>
      <div class="help-keys-title">Keyboard</div>
      <div class="help-keys">
        <div class="help-key"><kbd class="key key-wide">Space</kbd><span>Pause / resume</span></div>
        <div class="help-key"><kbd class="key">Z</kbd><span>Previous</span></div>
        <div class="help-key"><kbd class="key">X</kbd><span>Restart track</span></div>
        <div class="help-key"><kbd class="key">C</kbd><span>Pause</span></div>
        <div class="help-key"><kbd class="key">V</kbd><span>Stop</span></div>
        <div class="help-key"><kbd class="key">B</kbd><span>Next</span></div>
      </div>
    </div>
  </div>

  <div class="modal-backdrop help-backdrop" id="import-modal" hidden>
    <div class="help-card" role="dialog" aria-modal="true" aria-labelledby="import-modal-title">
      <button class="modal-close" id="import-modal-close" type="button" aria-label="Close"></button>
      <h2 id="import-modal-title">Playlist format</h2>
      <p class="help-intro">Each line is one playlist: a <strong>title</strong>, then its songs in square brackets, separated by commas.</p>
      <pre class="help-snippet">My Playlist, [song, song, song]</pre>

      <div class="help-keys-title">A song</div>
      <p class="help-intro">A song is a <strong>YouTube link</strong> (or just the 11-character id):</p>
      <pre class="help-snippet">https://youtu.be/VIDEOID</pre>

      <div class="help-keys-title">Naming a song (optional)</div>
      <p class="help-intro">Put a name <strong>before</strong> the link and a vertical bar <code>|</code>. The bar only separates the name from the link, it does not mean "or". The link is always required, so a name on its own does nothing.</p>
      <pre class="help-snippet">Song name | https://youtu.be/VIDEOID</pre>

      <div class="help-keys-title">Putting it together</div>
      <pre class="help-snippet">Chill Mix, [https://youtu.be/VIDEOID, Deep work | https://youtu.be/VIDEOID]</pre>

      <div class="help-keys-title">Empty playlist</div>
      <p class="help-intro">Just a title on its own line (no brackets):</p>
      <pre class="help-snippet">My New Playlist</pre>
    </div>
  </div>

  <div class="modal-backdrop help-backdrop" id="export-modal" hidden>
    <div class="help-card" role="dialog" aria-modal="true" aria-labelledby="export-modal-title">
      <button class="modal-close" id="export-modal-close" type="button" aria-label="Close"></button>
      <h2 id="export-modal-title">Export playlist</h2>
      <p class="help-intro">Save <strong id="export-name">this playlist</strong> as text you can re-import anywhere. It holds only ids/links, no personal data.</p>
      <div class="export-actions">
        <button class="button primary" id="export-copy" type="button">Copy to clipboard</button>
        <button class="button" id="export-download" type="button">Download .md file</button>
      </div>
      <span class="hint" id="export-status"></span>
    </div>
  </div>

  <div class="modal-backdrop help-backdrop" id="share-modal" hidden>
    <div class="help-card" role="dialog" aria-modal="true" aria-labelledby="share-modal-title">
      <button class="modal-close" id="share-modal-close" type="button" aria-label="Close"></button>
      <h2 id="share-modal-title">Share playlist</h2>
      <p class="help-intro">The link to <strong id="share-name">this playlist</strong> <span id="share-tip">is on your clipboard. Paste it anywhere to share.</span></p>
      <pre class="help-snippet" id="share-url"></pre>
      <p class="help-intro">Whoever opens the link gets this playlist loaded in their own browser, nothing is stored anywhere else.</p>
    </div>
  </div>

  <div class="tooltip" id="tooltip" role="tooltip" hidden></div>
`;

function icon(name) {
  return ICONS[name] || "";
}

function sr(text) {
  const span = document.createElement("span");
  span.className = "sr-only";
  span.textContent = text;
  return span;
}

function setIconButton(button, name, label) {
  button.innerHTML = icon(name);
  button.append(sr(label));
  button.dataset.tooltip = label;
  button.setAttribute("aria-label", label);
}

function makeIconButton(name, label, className = "icon-button") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  setIconButton(button, name, label);
  return button;
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ":" + String(s).padStart(2, "0");
}

function currentPageUrl() {
  if (typeof window === "undefined" || !window.location) {
    return new URL("http://localhost/");
  }
  return new URL(window.location.href);
}

function playlistShareUrl(playlist) {
  const url = currentPageUrl();
  url.search = "";
  url.hash = "";
  url.searchParams.set("playlist", playlistToBulkText(playlist));
  return url.toString();
}

function sharedPlaylistTextFromUrl() {
  if (typeof window === "undefined" || !window.location) return "";
  const url = new URL(window.location.href);
  return url.searchParams.get("playlist") || "";
}

async function copyText(text) {
  if (!text) return false;
  if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      /* Fall through to the textarea fallback. */
    }
  }
  if (typeof document === "undefined") return false;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = typeof document.execCommand === "function" && document.execCommand("copy");
  } catch (_) {
    ok = false;
  }
  textarea.remove();
  return ok;
}

// Save `text` to a local file via a transient object URL. The content is plain
// text; the .md extension just makes it open nicely and re-import cleanly.
function downloadText(text, filename) {
  if (typeof document === "undefined" || typeof URL === "undefined" || !URL.createObjectURL) {
    return false;
  }
  const blob = new Blob([text], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}

// Read an uploaded file as text. Uses FileReader for the widest support (every
// browser plus jsdom), resolving to the file's contents.
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result == null ? "" : reader.result));
    reader.onerror = () => reject(reader.error || new Error("read failed"));
    reader.readAsText(file);
  });
}

// Turn a playlist name into a safe file name (keep letters/numbers/space/-, then
// hyphenate). Falls back to "playlist" so the download always has a name.
function playlistFileName(name) {
  const base = String(name == null ? "" : name)
    .replace(/[^\w\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return (base || "playlist") + ".md";
}

function tooltipTargetFrom(node) {
  if (!(node instanceof Element)) return null;
  // No tooltips inside the track queue, the playlist drawer, any modal, the hero
  // transport (prev/play/stop/next), or on the hero YouTube link: those are
  // self-explanatory and the auto-derived text read poorly. The hero tools and
  // footer keep theirs.
  if (node.closest(".queue-panel, .playlist-drawer, .modal-backdrop, .hero-transport, .hero-subtitle")) {
    return null;
  }
  return node.closest("button, label.switch, a, input[type='range'], [data-tooltip]");
}

function tooltipText(target) {
  if (!target) return "";
  const title = target.getAttribute("title");
  if (title) {
    target.dataset.tooltip = title;
    target.removeAttribute("title");
    return title;
  }
  return (
    target.dataset.tooltip ||
    target.getAttribute("aria-label") ||
    target.textContent.trim()
  );
}

function setupTooltips(root, tooltip) {
  let active = null;

  function place(x, y) {
    if (!active || tooltip.hidden) return;
    const margin = 14;
    const rect = tooltip.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - margin;
    const maxY = window.innerHeight - rect.height - margin;
    const left = Math.max(margin, Math.min(x + 14, maxX));
    const top = Math.max(margin, Math.min(y + 16, maxY));
    tooltip.style.left = left + "px";
    tooltip.style.top = top + "px";
  }

  function show(target, x, y) {
    const text = tooltipText(target);
    if (!text) return;
    active = target;
    tooltip.textContent = text;
    tooltip.hidden = false;
    window.requestAnimationFrame(() => {
      tooltip.dataset.show = "true";
      place(x, y);
    });
  }

  function hide() {
    active = null;
    tooltip.dataset.show = "false";
    window.setTimeout(() => {
      if (!active) tooltip.hidden = true;
    }, 120);
  }

  root.addEventListener("pointerover", (event) => {
    const target = tooltipTargetFrom(event.target);
    if (!target || target === active) return;
    show(target, event.clientX, event.clientY);
  });
  root.addEventListener("pointermove", (event) => {
    if (active) place(event.clientX, event.clientY);
  });
  root.addEventListener("pointerout", (event) => {
    if (!active) return;
    const next = tooltipTargetFrom(event.relatedTarget);
    if (next === active) return;
    hide();
  });
  root.addEventListener("focusin", (event) => {
    const target = tooltipTargetFrom(event.target);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    show(target, rect.left + rect.width / 2, rect.bottom);
  });
  root.addEventListener("focusout", hide);
}

function createModalController(els) {
  let active = null;

  function finish(value) {
    if (!active) return;
    const resolve = active.resolve;
    active = null;
    els.modal.hidden = true;
    resolve(value);
  }

  function open(config) {
    if (active) finish(null);
    return new Promise((resolve) => {
      active = { resolve, type: config.type };
      els.modalTitle.textContent = config.title;
      els.modalMessage.textContent = config.message;
      els.modalConfirm.textContent = config.confirmLabel || "OK";
      els.modalCancel.textContent = config.cancelLabel || "Cancel";
      els.modalCancel.hidden = config.type === "alert";
      els.modalInput.hidden = config.type !== "prompt";
      els.modalInput.value = config.defaultValue || "";
      els.modal.hidden = false;
      window.setTimeout(() => {
        if (config.type === "prompt") {
          els.modalInput.focus();
          els.modalInput.select();
        } else {
          els.modalConfirm.focus();
        }
      }, 0);
    });
  }

  els.modalForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!active) return;
    finish(active.type === "prompt" ? els.modalInput.value : true);
  });
  function dismiss() {
    if (!active) return;
    finish(active.type === "prompt" ? null : false);
  }
  els.modalCancel.addEventListener("click", dismiss);
  els.modalClose.addEventListener("click", dismiss);
  // No backdrop-click-to-close: selecting text inside a field and releasing the
  // mouse outside the card fires a click on the backdrop and would wrongly close
  // the modal. Use the close (X) or Cancel button instead.
  els.modal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      finish(active && active.type === "prompt" ? null : false);
    }
  });

  return {
    prompt(message, defaultValue = "") {
      return open({
        type: "prompt",
        title: "Rename",
        message,
        defaultValue,
        confirmLabel: "Save"
      });
    },
    confirm(message, confirmLabel = "Delete") {
      return open({
        type: "confirm",
        title: "Confirm",
        message,
        confirmLabel
      });
    },
    alert(message, title = "Notice") {
      return open({
        type: "alert",
        title,
        message,
        confirmLabel: "OK"
      });
    }
  };
}

export function initApp(options) {
  const root = options.root;
  const storage = options.storage || (typeof window !== "undefined" ? window.localStorage : null);
  const createPlayer = options.createPlayer;
  const resolveTitles = !!options.resolveTitles;

  root.innerHTML = SHELL;
  const $ = (id) => root.querySelector("#" + id);

  const els = {
    librarySummary: $("library-summary"),
    drawerToggle: $("drawer-toggle"),
    drawerClose: $("drawer-close"),
    playlistDrawer: $("playlist-drawer"),
    exportPlaylist: $("export-playlist"),
    sharePlaylist: $("share-playlist"),
    helpButton: $("help-button"),
    helpModal: $("help-modal"),
    helpClose: $("help-close"),
    importModal: $("import-modal"),
    importModalClose: $("import-modal-close"),
    importFileInput: $("import-file-input"),
    importFileButton: $("import-file-button"),
    exportModal: $("export-modal"),
    exportModalClose: $("export-modal-close"),
    exportName: $("export-name"),
    exportCopy: $("export-copy"),
    exportDownload: $("export-download"),
    exportStatus: $("export-status"),
    shareModal: $("share-modal"),
    shareModalClose: $("share-modal-close"),
    shareName: $("share-name"),
    shareTip: $("share-tip"),
    shareUrl: $("share-url"),
    heroPrevious: $("hero-previous"),
    heroPlay: $("hero-play"),
    heroStop: $("hero-stop"),
    heroNext: $("hero-next"),
    heroBg: $("hero-bg"),
    coverGrid: $("cover-grid"),
    importPanel: $("import-panel"),
    importInfo: $("import-info"),
    importText: $("import-text"),
    importButton: $("import-button"),
    importStatus: $("import-status"),
    playlistTabs: $("playlist-tabs"),
    clearLocal: $("clear-local"),
    playerFrame: $("player-frame"),
    nowSong: $("now-song"),
    nowTitle: $("now-title"),
    nowSubtitle: $("now-subtitle"),
    dockTitle: $("dock-title"),
    dockLink: $("dock-link"),
    nowArt: $("now-art"),
    seek: $("seek"),
    timeCurrent: $("time-current"),
    timeTotal: $("time-total"),
    shuffleToggle: $("shuffle-toggle"),
    loopToggle: $("loop-toggle"),
    showVideoToggle: $("show-video-toggle"),
    volume: $("volume"),
    statusText: $("status-text"),
    currentPosition: $("current-position"),
    playlistSize: $("playlist-size"),
    queueName: $("queue-name"),
    queueKicker: $("queue-kicker"),
    queueCount: $("queue-count"),
    addForm: $("add-form"),
    addButton: $("add-button"),
    addInput: $("add-input"),
    search: $("search"),
    trackList: $("track-list"),
    modal: $("modal"),
    modalForm: $("modal-form"),
    modalTitle: $("modal-title"),
    modalMessage: $("modal-message"),
    modalInput: $("modal-input"),
    modalCancel: $("modal-cancel"),
    modalConfirm: $("modal-confirm"),
    modalClose: $("modal-close"),
    tooltip: $("tooltip")
  };

  setIconButton(els.exportPlaylist, "import", "Export playlist");
  setIconButton(els.sharePlaylist, "share", "Copy share link");
  setIconButton(els.helpButton, "info", "How to use");
  setIconButton(els.drawerClose, "close", "Close playlists");
  setIconButton(els.heroPrevious, "previous", "Previous");
  setIconButton(els.heroPlay, "play", "Play");
  setIconButton(els.heroStop, "stop", "Stop");
  setIconButton(els.heroNext, "next", "Next");
  setIconButton(els.importInfo, "info", "Playlist format help");
  setIconButton(els.modalClose, "close", "Close");
  setIconButton(els.helpClose, "close", "Close");
  setIconButton(els.importModalClose, "close", "Close");
  setIconButton(els.exportModalClose, "close", "Close");
  setIconButton(els.shareModalClose, "close", "Close");
  setIconButton(els.addButton, "add", "Add");
  setIconButton(els.importFileButton, "upload", "Import from file");
  setIconButton(els.clearLocal, "trash", "Wipe local data");
  root.querySelector('[data-icon="shuffle"]').innerHTML = icon("shuffle");
  root.querySelector('[data-icon="loop"]').innerHTML = icon("loop");
  root.querySelector('[data-icon="eye"]').innerHTML = icon("eye");
  root.querySelector('[title="Shuffle"]').dataset.tooltip = "Shuffle playback";
  root.querySelector('[title="Shuffle"]').removeAttribute("title");
  root.querySelector('[title="Loop"]').dataset.tooltip = "Loop playlist";
  root.querySelector('[title="Loop"]').removeAttribute("title");
  root.querySelector('[title="Show video"]').dataset.tooltip = "Show / hide video";
  root.querySelector('[title="Show video"]').removeAttribute("title");
  els.volume.dataset.tooltip = "Volume";
  els.drawerToggle.dataset.tooltip = "Manage your playlists";
  setupTooltips(root, els.tooltip);

  const modal = createModalController(els);
  const ui = {
    confirm: options.confirm
      ? (message, label) => Promise.resolve(options.confirm(message, label))
      : modal.confirm,
    prompt: options.prompt
      ? (message, value) => Promise.resolve(options.prompt(message, value))
      : modal.prompt,
    alert: options.alert
      ? (message, title) => Promise.resolve(options.alert(message, title))
      : modal.alert
  };

  let state = loadState(storage);
  let player = null;
  let playerReady = false;
  let isPlaying = false;
  let hasStarted = false; // true once a track has actually been played this session
  let seeking = false;
  let currentIndex = 0;
  let shuffleQueue = [];
  let history = [];
  const titleRequests = new Set();
  const coverTrackIdsByPlaylist = new Map();
  // Drawer selection model: a playlist is "selected" when its row is clicked,
  // which reveals its collapse/edit/delete controls and closes any other open
  // editor. "Expanded" (editor open) only ever applies to the selected playlist
  // and is toggled by its collapse arrow. On first appearance both are null, so
  // nothing is selected or open.
  let drawerSelectedPlaylistId = null;
  let drawerExpandedPlaylistId = null;

  // Tab-title marquee. The interval handle lives on the window so a fresh mount
  // (and the tests) can always cancel a previously running scroller, while the
  // current source string is kept per-instance to skip needless restarts.
  const titleDoc = root.ownerDocument || (typeof document !== "undefined" ? document : null);
  const titleWin =
    (titleDoc && titleDoc.defaultView) || (typeof window !== "undefined" ? window : null);
  let marqueeSource = "";

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

  async function reportDuplicatePlaylists(duplicates) {
    if (!duplicates.length) return;
    await ui.alert(DUPLICATE_PLAYLIST_MESSAGE, "Playlist already exists");
  }

  async function importPlaylistText(raw) {
    const summary = importPlaylists(state, raw);
    const imported = summary.filter((item) => !item.duplicate);
    const duplicates = summary.filter((item) => item.duplicate);
    if (!summary.length) {
      return { summary, imported, duplicates };
    }

    await reportDuplicatePlaylists(duplicates);
    if (!imported.length) {
      return { summary, imported, duplicates };
    }

    const totalAdded = imported.reduce((sum, item) => sum + item.added, 0);
    // A freshly imported playlist is selected and its editor opened, so you can
    // immediately add tracks to it.
    drawerSelectedPlaylistId = imported[imported.length - 1].id;
    drawerExpandedPlaylistId = drawerSelectedPlaylistId;
    currentIndex = 0;
    history = [];
    shuffleQueue = [];
    if (state.settings.shuffle) buildShuffleQueue();
    persist();
    render();
    resetPlayerForSelection("Ready");
    renderNow();
    return { summary, imported, duplicates, totalAdded };
  }

  async function processSharedPlaylistParam() {
    const shared = sharedPlaylistTextFromUrl();
    if (!shared) return;
    const result = await importPlaylistText(shared);
    if (!result.summary.length) {
      await ui.alert("No valid playlist found in the URL.", "Playlist link");
      return;
    }
    if (result.imported.length) {
      setStatus("Loaded shared playlist");
    }
  }


  async function clearLocalData() {
    const ok = await ui.confirm(
      "Wipe all playlists and settings stored in this browser?",
      "Wipe"
    );
    if (!ok) return;
    if (storage && typeof storage.clear === "function") {
      storage.clear();
    } else if (storage && typeof storage.removeItem === "function") {
      storage.removeItem(STORAGE_KEY);
    }
    state = emptyState();
    drawerSelectedPlaylistId = null;
    drawerExpandedPlaylistId = null;
    currentIndex = 0;
    shuffleQueue = [];
    history = [];
    titleRequests.clear();
    coverTrackIdsByPlaylist.clear();
    stop();
    render();
    setStatus("Local data cleaned");
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

  function resetTimeline() {
    seeking = false;
    els.seek.max = "0";
    els.seek.value = "0";
    els.timeCurrent.textContent = "0:00";
    els.timeTotal.textContent = "0:00";
  }

  function applyShowVideo() {
    els.playerFrame.setAttribute("data-show", String(!!state.settings.showVideo));
  }

  function coverTracksForPlaylist(playlist) {
    if (!playlist) return [];
    const validIds = new Set(playlist.tracks.map((track) => track.videoId));
    const existing = (coverTrackIdsByPlaylist.get(playlist.id) || []).filter((id) =>
      validIds.has(id)
    );
    playlist.tracks.forEach((track) => {
      if (existing.length < 4 && !existing.includes(track.videoId)) {
        existing.push(track.videoId);
      }
    });
    if (existing.length) coverTrackIdsByPlaylist.set(playlist.id, existing);
    else coverTrackIdsByPlaylist.delete(playlist.id);
    return existing
      .map((id) => playlist.tracks.find((track) => track.videoId === id))
      .filter(Boolean);
  }

  function renderCoverGrid() {
    const playlist = activePlaylist();
    const tracks = coverTracksForPlaylist(playlist);
    const selected = currentTrack() || tracks[0] || null;
    const coverKey = tracks.map((track) => track.videoId).join("|");

    if (els.coverGrid.dataset.coverKey !== coverKey) {
      els.coverGrid.dataset.coverKey = coverKey;
      els.coverGrid.replaceChildren();
      for (let i = 0; i < 4; i += 1) {
        const tile = document.createElement("div");
        tile.className = "cover-tile";
        const track = tracks[i];
        if (track) {
          const img = document.createElement("img");
          img.src = track.thumbnailUrl;
          img.alt = "";
          tile.append(img);
        }
        els.coverGrid.append(tile);
      }
    }

    if (selected) {
      els.heroBg.style.backgroundImage = "url(" + selected.thumbnailUrl + ")";
    } else {
      els.heroBg.style.backgroundImage = "";
    }
  }

  function trackCountText(count) {
    return count + (count === 1 ? " track" : " tracks");
  }

  function addToPlaylist(playlistId, raw, input) {
    const result = addTracks(state, playlistId, raw);
    if (input) input.value = "";
    if (state.activePlaylistId === playlistId && state.settings.shuffle) buildShuffleQueue();
    persist();
    render();
    setStatus(
      result.added
        ? "Added " + result.added + " track(s)" + (result.skipped ? ", skipped " + result.skipped + " duplicate(s)" : "")
        : "No valid ids or links found"
    );
  }

  async function renamePlaylistById(playlistId) {
    const playlist = getPlaylist(state, playlistId);
    if (!playlist) return;
    const next = await ui.prompt("Playlist name", playlist.name);
    if (next == null) return;
    renamePlaylist(state, playlist.id, next);
    persist();
    render();
  }

  async function deletePlaylistById(playlistId) {
    const playlist = getPlaylist(state, playlistId);
    if (!playlist) return;
    const ok = await ui.confirm('Delete playlist "' + playlist.name + '"?');
    if (!ok) return;
    const wasActive = playlist.id === state.activePlaylistId;
    deletePlaylist(state, playlist.id);
    // Deleting clears the selection if it was the deleted row; the list returns
    // to the unselected, nothing-open state.
    if (drawerSelectedPlaylistId === playlist.id) {
      drawerSelectedPlaylistId = null;
      drawerExpandedPlaylistId = null;
    }
    if (wasActive) {
      currentIndex = 0;
      history = [];
      shuffleQueue = [];
      stop();
    }
    persist();
    render();
  }

  function removeFromPlaylist(playlistId, index) {
    const wasActive = playlistId === state.activePlaylistId;
    const wasCurrent = wasActive && index === currentIndex;
    removeTrack(state, playlistId, index);
    if (wasActive) {
      if (index < currentIndex) currentIndex -= 1;
      const tracks = activeTracks();
      if (currentIndex >= tracks.length) currentIndex = Math.max(0, tracks.length - 1);
      if (state.settings.shuffle) buildShuffleQueue();
    }
    persist();
    render();
    if (wasCurrent) {
      resetPlayerForSelection(activeTracks().length ? "Ready" : "Playlist empty");
      renderNow();
    }
  }

  function renderDrawerTrack(playlist, track, index) {
    const row = document.createElement("div");
    row.className = "drawer-track" + (playlist.id === state.activePlaylistId && index === currentIndex ? " active" : "");

    const play = document.createElement("button");
    play.type = "button";
    play.className = "drawer-track-play";
    play.setAttribute("aria-label", "Play " + track.label);
    const img = document.createElement("img");
    img.src = track.thumbnailUrl;
    img.alt = "";
    play.append(img);
    play.addEventListener("click", () => {
      if (playlist.id !== state.activePlaylistId) {
        state.activePlaylistId = playlist.id;
        currentIndex = index;
        persist();
        render();
      }
      playIndex(index);
    });

    const copy = document.createElement("div");
    copy.className = "drawer-track-copy";
    const title = document.createElement("div");
    title.className = "drawer-track-title";
    title.textContent = track.label;
    const source = document.createElement("a");
    source.className = "drawer-track-link";
    source.href = track.url;
    source.target = "_blank";
    source.rel = "noreferrer";
    source.textContent = track.youtubeTitle || track.url;
    copy.append(title, source);

    const actions = document.createElement("div");
    actions.className = "drawer-track-actions";
    const rename = makeIconButton("edit", "Rename track", "drawer-icon-button");
    rename.addEventListener("click", async () => {
      const next = await ui.prompt("Track name", track.label);
      if (next == null) return;
      renameTrack(state, playlist.id, index, next);
      persist();
      render();
    });
    const remove = makeIconButton("trash", "Remove track", "drawer-icon-button danger");
    remove.addEventListener("click", () => removeFromPlaylist(playlist.id, index));
    actions.append(rename, remove);

    row.append(play, copy, actions);
    return row;
  }

  function renderDrawerPlaylistDetail(playlist) {
    const detail = document.createElement("div");
    detail.className = "drawer-playlist-detail";

    const form = document.createElement("form");
    form.className = "drawer-add-track-form";
    const input = document.createElement("input");
    input.className = "field drawer-add-field";
    input.type = "text";
    input.placeholder = "To add a track, paste a YouTube link and hit enter, e.g. https://youtube.com/watch?v=VIDEOID";
    input.setAttribute("aria-label", "Add tracks to " + playlist.name);
    const submit = makeIconButton("add", "Add tracks to playlist", "drawer-submit-button");
    submit.type = "submit";
    form.append(input, submit);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      addToPlaylist(playlist.id, input.value, input);
    });

    const tracks = document.createElement("div");
    tracks.className = "drawer-track-list";
    if (!playlist.tracks.length) {
      const empty = document.createElement("div");
      empty.className = "drawer-empty";
      empty.textContent = "No tracks yet.";
      tracks.append(empty);
    } else {
      playlist.tracks.forEach((track, index) => {
        tracks.append(renderDrawerTrack(playlist, track, index));
      });
    }

    detail.append(form, tracks);
    return detail;
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
    // Drop selection/expansion that points at a playlist that no longer exists.
    const ids = new Set(state.playlists.map((playlist) => playlist.id));
    if (drawerSelectedPlaylistId && !ids.has(drawerSelectedPlaylistId)) {
      drawerSelectedPlaylistId = null;
    }
    if (drawerExpandedPlaylistId && drawerExpandedPlaylistId !== drawerSelectedPlaylistId) {
      drawerExpandedPlaylistId = null;
    }
    state.playlists.forEach((playlist) => {
      const card = document.createElement("article");
      const head = document.createElement("div");
      const button = document.createElement("button");
      const thumb = document.createElement("span");
      const body = document.createElement("span");
      const title = document.createElement("strong");
      const meta = document.createElement("span");
      // A row is "selected" once clicked (this is the only highlighted state and
      // the only one that shows controls); "open" means its editor is unfolded.
      // On first appearance nothing is selected, so nothing is coloured.
      const isSelected = playlist.id === drawerSelectedPlaylistId;
      const isOpen = isSelected && playlist.id === drawerExpandedPlaylistId;

      button.type = "button";
      button.className = "playlist-tab";
      button.setAttribute("aria-pressed", String(isSelected));
      button.setAttribute("aria-expanded", String(isOpen));
      thumb.className = "playlist-thumb";
      if (playlist.tracks[0]) {
        thumb.style.backgroundImage = "url(" + playlist.tracks[0].thumbnailUrl + ")";
      }
      body.className = "playlist-copy";
      title.textContent = playlist.name;
      meta.textContent = trackCountText(playlist.tracks.length);
      body.append(title, meta);
      button.append(thumb, body);
      // Clicking a row only changes the selection: it never opens the editor (the
      // collapse arrow does that) and it closes any other open editor.
      button.addEventListener("click", () => selectDrawerPlaylist(playlist.id));

      head.className = "drawer-playlist-head";
      head.append(button);

      // The collapse, rename, and delete controls live inside the selected row's
      // coloured header and only appear there.
      if (isSelected) {
        const controls = document.createElement("div");
        controls.className = "drawer-playlist-controls";
        const collapse = makeIconButton(
          isOpen ? "up" : "down",
          isOpen ? "Collapse playlist" : "Expand playlist",
          "drawer-icon-button"
        );
        collapse.addEventListener("click", () => {
          drawerExpandedPlaylistId = isOpen ? null : playlist.id;
          renderTabs();
        });
        const rename = makeIconButton("edit", "Rename playlist", "drawer-icon-button");
        rename.addEventListener("click", () => renamePlaylistById(playlist.id));
        const remove = makeIconButton("trash", "Delete playlist", "drawer-icon-button danger");
        remove.addEventListener("click", () => deletePlaylistById(playlist.id));
        controls.append(collapse, rename, remove);
        head.append(controls);
      }

      card.className =
        "drawer-playlist-card" + (isSelected ? " selected" : "") + (isOpen ? " open" : "");
      card.append(head);
      if (isOpen) card.append(renderDrawerPlaylistDetail(playlist));
      els.playlistTabs.append(card);
    });
  }

  // Selecting a playlist in the drawer just changes the selection: it reveals the
  // collapse/edit/delete controls on that row, folds any other open editor, and
  // makes it the active playlist. It does not open the editor by itself.
  function selectDrawerPlaylist(id) {
    if (id === drawerSelectedPlaylistId) return; // already selected, nothing happens
    drawerSelectedPlaylistId = id;
    drawerExpandedPlaylistId = null;
    if (id !== state.activePlaylistId) {
      selectPlaylist(id);
    } else {
      renderTabs();
    }
  }

  function renderNow() {
    const playlist = activePlaylist();
    const tracks = activeTracks();
    const track = currentTrack();
    const totalTracks = state.playlists.reduce((sum, p) => sum + p.tracks.length, 0);

    els.librarySummary.textContent = state.playlists.length
      ? state.playlists.length + " playlists, " + totalTracks + " tracks"
      : "Create or import a private local playlist";
    // Hero shows three stacked lines: the song name (accent), a white subtitle
    // (the YouTube title), and a grey line that links out to the video.
    els.nowSong.textContent = track ? track.label : playlist ? "Empty playlist" : "Select a playlist";
    els.nowTitle.textContent = track
      ? track.youtubeTitle || track.videoId
      : playlist
      ? "Add tracks to start listening"
      : "Ready";
    if (track) {
      els.nowSubtitle.textContent = track.url;
      els.nowSubtitle.href = track.url;
      els.nowSubtitle.removeAttribute("aria-disabled");
    } else {
      els.nowSubtitle.textContent = "YouTube";
      els.nowSubtitle.href = "#";
      els.nowSubtitle.setAttribute("aria-disabled", "true");
    }
    els.currentPosition.textContent = track ? String(currentIndex + 1) : "0";
    els.playlistSize.textContent = String(tracks.length);
    els.queueName.textContent = playlist ? playlist.name : "Queue";
    els.queueKicker.hidden = !playlist;
    els.queueCount.textContent = tracks.length + (tracks.length === 1 ? " track" : " tracks");
    els.dockTitle.textContent = track ? track.label : "Nothing selected";
    els.dockLink.textContent = track ? track.url : "YouTube";
    if (track) {
      els.dockLink.href = track.url;
      els.dockLink.removeAttribute("aria-disabled");
      els.nowArt.src = track.thumbnailUrl;
      els.nowArt.hidden = false;
    } else {
      els.dockLink.href = "#";
      els.dockLink.setAttribute("aria-disabled", "true");
      els.nowArt.removeAttribute("src");
      els.nowArt.hidden = true;
    }
    // Keep the tab marquee in step when the track or its resolved title changes.
    syncNowPlayingTitle();
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
        !query ||
        (track.label + " " + track.videoId + " " + (track.youtubeTitle || ""))
          .toLowerCase()
          .includes(query)
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

      const thumbButton = document.createElement("button");
      thumbButton.className = "track-thumb-button";
      thumbButton.type = "button";
      thumbButton.setAttribute("aria-label", "Play " + track.label);
      const thumb = document.createElement("img");
      thumb.className = "track-thumb-img";
      thumb.src = track.thumbnailUrl;
      thumb.alt = "";
      thumbButton.append(thumb);
      thumbButton.addEventListener("click", () => playIndex(index));

      const info = document.createElement("div");
      info.className = "track-info";
      const title = document.createElement("button");
      title.className = "track-title-button";
      title.type = "button";
      title.textContent = track.label;
      title.title = "Play";
      title.addEventListener("click", () => playIndex(index));
      const source = document.createElement("div");
      source.className = "track-source";
      source.textContent = track.youtubeTitle || track.videoId;
      const meta = document.createElement("div");
      meta.className = "track-meta";
      const indexText = document.createElement("span");
      indexText.textContent = String(index + 1).padStart(2, "0");
      const link = document.createElement("a");
      link.href = track.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.className = "track-link";
      link.innerHTML = icon("external");
      link.append(" " + track.url, sr("Open on YouTube"));
      meta.append(indexText, link);
      info.append(title, source, meta);

      const actions = document.createElement("div");
      actions.className = "track-actions";

      const up = makeIconButton("up", "Move up");
      up.disabled = index === 0;
      up.addEventListener("click", () => reorder(index, index - 1));

      const down = makeIconButton("down", "Move down");
      down.disabled = index === tracks.length - 1;
      down.addEventListener("click", () => reorder(index, index + 1));

      const rename = makeIconButton("edit", "Rename track");
      rename.addEventListener("click", async () => {
        const next = await ui.prompt("Track name", track.label);
        if (next == null) return;
        renameTrack(state, state.activePlaylistId, index, next);
        persist();
        render();
      });

      const remove = makeIconButton("trash", "Remove track", "icon-button danger");
      remove.addEventListener("click", () => removeAt(index));

      actions.append(up, down, rename, remove);
      row.append(thumbButton, info, actions);

      row.addEventListener("dragstart", (event) => {
        row.classList.add("dragging");
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", String(index));
          // Pin the drag ghost to just this row. Without an explicit drag image
          // the browser can snapshot a larger region (e.g. the player footer
          // underneath), so the row looks like it drags glued to the dock.
          if (typeof event.dataTransfer.setDragImage === "function") {
            const rect = row.getBoundingClientRect();
            const offsetX = (event.clientX || 0) - rect.left;
            const offsetY = (event.clientY || 0) - rect.top;
            event.dataTransfer.setDragImage(row, offsetX, offsetY);
          }
        }
      });
      row.addEventListener("dragend", () => row.classList.remove("dragging"));
      row.addEventListener("dragover", (event) => event.preventDefault());
      row.addEventListener("drop", (event) => {
        event.preventDefault();
        const from = Number(event.dataTransfer ? event.dataTransfer.getData("text/plain") : NaN);
        if (Number.isInteger(from)) reorder(from, index);
      });
      row.addEventListener("click", (event) => {
        if (event.target.closest("button, a, input, textarea")) return;
        playIndex(index);
      });

      fragment.append(row);
    });
    els.trackList.append(fragment);
  }

  // Scroll the currently playing row into view. Uses block: "nearest" so it only
  // moves when the row is actually off-screen (no jump if it is already visible),
  // and no-ops when the active track is filtered out by the search query.
  function scrollActiveTrackIntoView() {
    const activeRow = els.trackList.querySelector(".track.active");
    if (activeRow && typeof activeRow.scrollIntoView === "function") {
      activeRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function render() {
    renderTabs();
    renderCoverGrid();
    renderNow();
    renderTracks();
    els.shuffleToggle.checked = state.settings.shuffle;
    els.loopToggle.checked = state.settings.loop;
    els.showVideoToggle.checked = state.settings.showVideo;
    els.volume.value = String(state.settings.volume);
    applyShowVideo();
    enrichTitles();
  }

  function clearTitleTimer() {
    if (titleWin && titleWin.__musicTitleTimer) {
      titleWin.clearInterval(titleWin.__musicTitleTimer);
      titleWin.__musicTitleTimer = null;
    }
  }

  function setBaseTitle() {
    clearTitleTimer();
    marqueeSource = "";
    if (titleDoc) titleDoc.title = DEFAULT_TITLE;
  }

  // Scroll `text` across the tab title one character at a time, like an old
  // Winamp marquee. A trailing separator makes the loop wrap seamlessly.
  function startTitleMarquee(text) {
    if (!titleDoc || !titleWin) return;
    if (text === marqueeSource && titleWin.__musicTitleTimer) return;
    clearTitleTimer();
    marqueeSource = text;
    const full = text + "    •    ";
    let pos = 0;
    titleDoc.title = full;
    titleWin.__musicTitleTimer = titleWin.setInterval(() => {
      pos = (pos + 1) % full.length;
      titleDoc.title = full.slice(pos) + full.slice(0, pos);
    }, 280);
  }

  // Marquee the current track while it plays; otherwise restore the plain title.
  function syncNowPlayingTitle() {
    if (!titleDoc) return;
    const track = isPlaying ? currentTrack() : null;
    if (!track) {
      setBaseTitle();
      return;
    }
    const youtube = track.youtubeTitle || track.videoId;
    startTitleMarquee("Now Playing: " + track.label + " - " + youtube);
  }

  function updatePlayButton() {
    setIconButton(els.heroPlay, isPlaying ? "pause" : "play", isPlaying ? "Pause" : "Play");
    syncNowPlayingTitle();
  }

  function ensurePlayer() {
    if (player || !createPlayer) return;
    player = createPlayer({
      container: els.playerFrame.querySelector("#youtube-player"),
      onReady: () => {
        playerReady = true;
        if (player.setVolume) player.setVolume(state.settings.volume);
        const track = currentTrack();
        if (track && player.cue && !isPlaying) player.cue(track.videoId);
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
        window.setTimeout(() => nextTrack(true), 1000);
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

  function resetPlayerForSelection(status) {
    if (player && player.stop) player.stop();
    isPlaying = false;
    resetTimeline();
    updatePlayButton();
    const track = currentTrack();
    if (track && player && player.cue) player.cue(track.videoId);
    setStatus(track ? status || "Ready" : activePlaylist() ? "Playlist ready" : "Create or import a playlist to begin");
  }

  function playIndex(index, options = {}) {
    const tracks = activeTracks();
    if (index < 0 || index >= tracks.length) return;
    if (options.recordHistory !== false && index !== currentIndex) {
      history.push(currentIndex);
    }
    currentIndex = index;
    renderCoverGrid();
    renderNow();
    renderTracks();
    scrollActiveTrackIntoView();

    const track = currentTrack();
    if (!track) return;
    ensurePlayer();
    if (!player) {
      setStatus("Player unavailable");
      return;
    }
    player.load(track.videoId);
    isPlaying = true;
    hasStarted = true;
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
      player.load(track.videoId);
      isPlaying = true;
      hasStarted = true;
      updatePlayButton();
      return;
    }
    if (isPlaying) {
      player.pause();
      isPlaying = false;
    } else {
      player.play();
      isPlaying = true;
      hasStarted = true;
    }
    updatePlayButton();
  }

  function pauseOnly() {
    if (!isPlaying) return;
    if (player && player.pause) player.pause();
    isPlaying = false;
    setStatus("Paused");
    updatePlayButton();
  }

  // Space is pause/resume only: it toggles the current track between playing and
  // paused and never starts a fresh load. Use the track list or X to start play.
  function toggleResume() {
    if (isPlaying) {
      pauseOnly();
      return;
    }
    if (!player || !playerReady || !hasStarted) return;
    if (!currentTrack()) return;
    player.play();
    isPlaying = true;
    setStatus("Playing");
    updatePlayButton();
  }

  function restartCurrent() {
    const track = currentTrack();
    if (!track) {
      setStatus("Nothing to play");
      return;
    }
    playIndex(currentIndex, { recordHistory: false });
  }

  function stop() {
    if (player && player.stop) player.stop();
    isPlaying = false;
    hasStarted = false;
    resetTimeline();
    setStatus("Stopped");
    updatePlayButton();
  }

  function selectPlaylist(id) {
    if (id === state.activePlaylistId) return;
    drawerSelectedPlaylistId = id;
    drawerExpandedPlaylistId = null;
    state.activePlaylistId = id;
    currentIndex = 0;
    history = [];
    shuffleQueue = [];
    els.search.value = "";
    if (state.settings.shuffle) buildShuffleQueue();
    persist();
    render();
    resetPlayerForSelection("Ready");
    renderNow();
  }

  function reorder(from, to) {
    const playlistId = state.activePlaylistId;
    const playing = currentTrack();
    const landed = moveTrack(state, playlistId, from, to);
    if (landed === -1) return;
    if (playing) {
      const newIndex = activeTracks().findIndex((t) => t === playing);
      if (newIndex !== -1) currentIndex = newIndex;
    }
    persist();
    render();
  }

  function removeAt(index) {
    removeFromPlaylist(state.activePlaylistId, index);
  }

  function enrichTitles() {
    if (!resolveTitles || typeof fetch !== "function") return;
    // Resolve the official YouTube title for every track in the library that does
    // not have one yet, no matter which playlist it lives in or where it sits in
    // the list. The grey "source" line under a track must always settle on the
    // real video title, so this can't be limited to the active playlist's head.
    const pending = [];
    const queued = new Set();
    state.playlists.forEach((playlist) => {
      playlist.tracks.forEach((track) => {
        if (track.youtubeTitle) return;
        if (titleRequests.has(track.videoId) || queued.has(track.videoId)) return;
        queued.add(track.videoId);
        pending.push(track);
      });
    });

    pending.forEach((track) => {
      titleRequests.add(track.videoId);
      const endpoint =
        "https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent(track.url);
      fetch(endpoint)
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (!data || !data.title) return;
          const rawTitle = String(data.title).trim();
          const nameFromTitle = normalizeLabel(rawTitle);
          state.playlists.forEach((playlist) => {
            playlist.tracks.forEach((item) => {
              if (item.videoId !== track.videoId) return;
              if (!item.youtubeTitle) item.youtubeTitle = rawTitle;
              // Only auto-name tracks the user never labeled (label still the id),
              // so a real name typed or imported is never overwritten.
              if (item.label === item.videoId && nameFromTitle) {
                item.label = nameFromTitle;
              }
            });
          });
          persist();
          render();
        })
        .catch(() => {
          // A transient network failure must not leave the track stuck showing
          // its id: drop it from the in-flight set so a later render retries.
          titleRequests.delete(track.videoId);
        });
    });
  }

  function setDrawerOpen(open) {
    els.playlistDrawer.dataset.open = String(open);
    els.drawerToggle.dataset.open = String(open);
    els.drawerToggle.setAttribute("aria-expanded", String(open));
    els.drawerToggle.setAttribute("aria-label", open ? "Close playlists" : "Open playlists");
    els.drawerToggle.querySelector("span").textContent = open ? "Close" : "Playlists";
  }

  // --- event wiring ---
  els.drawerToggle.addEventListener("click", () => {
    setDrawerOpen(els.playlistDrawer.dataset.open !== "true");
  });
  els.drawerClose.addEventListener("click", () => setDrawerOpen(false));
  els.heroPrevious.addEventListener("click", previousTrack);
  els.heroPlay.addEventListener("click", togglePlay);
  els.heroStop.addEventListener("click", stop);
  els.heroNext.addEventListener("click", () => nextTrack(false));

  // A small static modal (help / format / export): open from a trigger, close via
  // its X or Escape. Focus moves into the dialog on open so Escape works and focus
  // does not linger on a control hidden behind the backdrop. onOpen runs first so
  // a modal can refresh its contents (e.g. the current playlist name).
  function wireSimpleModal(modalEl, closeEl, openEl, onOpen) {
    function setOpen(open) {
      if (open && onOpen) onOpen();
      modalEl.hidden = !open;
      if (open) window.setTimeout(() => closeEl.focus(), 0);
    }
    if (openEl) openEl.addEventListener("click", () => setOpen(true));
    closeEl.addEventListener("click", () => setOpen(false));
    modalEl.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    });
    return setOpen;
  }
  wireSimpleModal(els.helpModal, els.helpClose, els.helpButton);
  wireSimpleModal(els.importModal, els.importModalClose, els.importInfo);
  wireSimpleModal(els.exportModal, els.exportModalClose, els.exportPlaylist, () => {
    const playlist = activePlaylist();
    els.exportName.textContent = playlist ? '"' + playlist.name + '"' : "this playlist";
    els.exportStatus.textContent = "";
  });

  // Share copies the link, then opens a modal confirming it is on the clipboard
  // and showing the link itself as a fallback to select and copy by hand.
  const setShareOpen = wireSimpleModal(els.shareModal, els.shareModalClose);
  els.sharePlaylist.addEventListener("click", async () => {
    const playlist = activePlaylist();
    if (!playlist) return;
    const url = playlistShareUrl(playlist);
    const ok = await copyText(url);
    els.shareName.textContent = '"' + playlist.name + '"';
    els.shareTip.textContent = ok
      ? "is on your clipboard. Paste it anywhere to share."
      : "is in the box below. Select it and copy it to share.";
    els.shareUrl.textContent = url;
    setShareOpen(true);
  });

  function reportImport(result, statusEl) {
    if (!result.summary.length) {
      statusEl.textContent = "Nothing imported. Check the format.";
      return false;
    }
    if (!result.imported.length) {
      statusEl.textContent = DUPLICATE_PLAYLIST_MESSAGE;
      return false;
    }
    statusEl.textContent =
      "Imported " + result.imported.length + " playlist(s), " + result.totalAdded + " track(s)." +
      (result.duplicates.length ? " Skipped " + result.duplicates.length + " duplicate(s)." : "");
    return true;
  }

  els.importButton.addEventListener("click", async () => {
    const result = await importPlaylistText(els.importText.value);
    if (reportImport(result, els.importStatus)) els.importText.value = "";
  });

  els.importFileButton.addEventListener("click", () => els.importFileInput.click());
  els.importFileInput.addEventListener("change", async () => {
    const file = els.importFileInput.files && els.importFileInput.files[0];
    els.importFileInput.value = ""; // allow re-selecting the same file later
    if (!file) return;
    let text = "";
    try {
      text = await readFileAsText(file);
    } catch (_) {
      els.importStatus.textContent = "Could not read that file.";
      return;
    }
    reportImport(await importPlaylistText(text), els.importStatus);
  });

  els.exportCopy.addEventListener("click", async () => {
    const playlist = activePlaylist();
    if (!playlist) {
      els.exportStatus.textContent = "No playlist selected.";
      return;
    }
    const ok = await copyText(playlistToBulkText(playlist));
    els.exportStatus.textContent = ok ? "Copied to clipboard." : "Copy failed, select the text manually.";
  });

  els.exportDownload.addEventListener("click", () => {
    const playlist = activePlaylist();
    if (!playlist) {
      els.exportStatus.textContent = "No playlist selected.";
      return;
    }
    const ok = downloadText(playlistToBulkText(playlist), playlistFileName(playlist.name));
    els.exportStatus.textContent = ok ? "Downloaded." : "Download not supported here.";
  });

  els.addForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!activePlaylist()) {
      setStatus("Create a playlist first");
      return;
    }
    addToPlaylist(state.activePlaylistId, els.addInput.value, els.addInput);
  });

  els.clearLocal.addEventListener("click", clearLocalData);

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

  // Listen on the document, not the app container: keyboard shortcuts should work
  // wherever focus sits on the page, except while typing in a text field.
  const ownerDocument = root.ownerDocument || document;
  ownerDocument.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    const key = event.key.toLowerCase();
    if (event.key === " ") {
      event.preventDefault();
      toggleResume();
    } else if (key === "b" || event.key === "ArrowRight") {
      event.preventDefault();
      nextTrack(false);
    } else if (key === "z" || event.key === "ArrowLeft") {
      event.preventDefault();
      previousTrack();
    } else if (key === "x") {
      event.preventDefault();
      restartCurrent();
    } else if (key === "c") {
      event.preventDefault();
      pauseOnly();
    } else if (key === "v") {
      event.preventDefault();
      stop();
    }
  });

  if (state.settings.shuffle) buildShuffleQueue();
  render();
  updatePlayButton();
  if (activeTracks().length) {
    ensurePlayer();
    setStatus("Ready");
  }
  processSharedPlaylistParam();

  return {
    getState: () => state,
    render,
    playIndex,
    nextTrack,
    previousTrack,
    stop,
    togglePlay,
    restartCurrent,
    selectPlaylist,
    els
  };
}
