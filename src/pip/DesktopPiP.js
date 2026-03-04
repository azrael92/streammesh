/**
 * DesktopPiP.js — Desktop PiP window (Document PiP API + popup fallback)
 *
 * Opens a small floating window with one Twitch stream and prev/next/close
 * controls. Subscribes to cyclingPiP for stream changes.
 */

import {
  nextStream,
  prevStream,
  getCurrentChannel,
  getCurrentIndex,
  getChannelCount,
  buildCurrentStreamUrl,
  onChange,
} from './cyclingPiP.js';

let pipWindow = null;
let unsubscribe = null;

// ---- Public API ----

export async function openDesktopPiP() {
  closePiP();

  if ('documentPictureInPicture' in window) {
    await openDocumentPiP();
  } else {
    openPopupPiP();
  }
}

export function closePiP() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (pipWindow) {
    try { pipWindow.close(); } catch {}
    pipWindow = null;
  }
}

export function isDesktopPiPOpen() {
  if (!pipWindow) return false;
  // Popup windows have a .closed property
  if (pipWindow.closed) {
    pipWindow = null;
    return false;
  }
  return true;
}

// ---- Document PiP (Chrome/Edge 116+) ----

async function openDocumentPiP() {
  const pipWin = await window.documentPictureInPicture.requestWindow({
    width: 400,
    height: 300,
  });
  pipWindow = pipWin;

  pipWin.document.write(buildPiPHTML());
  pipWin.document.close();

  wireControls(pipWin);

  unsubscribe = onChange((state) => {
    updatePiPContent(pipWin, state);
  });

  pipWin.addEventListener('pagehide', () => {
    pipWindow = null;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  });
}

// ---- Popup fallback (Firefox, others) ----

function openPopupPiP() {
  const popup = window.open(
    '',
    'streammesh_pip',
    'width=400,height=300,resizable=yes,scrollbars=no,menubar=no,toolbar=no,location=no,status=no'
  );
  if (!popup) {
    console.error('Popup blocked by browser');
    return;
  }
  pipWindow = popup;

  popup.document.write(buildPiPHTML());
  popup.document.close();

  wireControls(popup);

  unsubscribe = onChange((state) => {
    updatePiPContent(popup, state);
  });

  popup.addEventListener('beforeunload', () => {
    pipWindow = null;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  });
}

// ---- HTML template ----

function buildPiPHTML() {
  const channel = getCurrentChannel();
  const url = buildCurrentStreamUrl();
  const index = getCurrentIndex();
  const total = getChannelCount();

  return `<!DOCTYPE html>
<html><head>
<title>StreamMESH</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 100%; height: 100%; overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #000; color: #fff;
  }
  #stream-frame {
    width: 100%;
    height: calc(100% - 40px);
    border: 0;
    display: block;
    background: #000;
  }
  .controls {
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.95);
    padding: 0 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
  .btn {
    background: #7c3aed;
    border: none;
    color: #fff;
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
  }
  .btn:hover { background: #8b5cf6; }
  .btn:active { background: #6d28d9; }
  .btn.close-btn { background: #ef4444; }
  .btn.close-btn:hover { background: #dc2626; }
  .channel-info {
    flex: 1;
    text-align: center;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: rgba(255, 255, 255, 0.9);
  }
  .counter {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.45);
    margin-left: 6px;
  }
</style>
</head><body>
<iframe id="stream-frame" src="${url}"
  allow="autoplay; fullscreen; picture-in-picture"></iframe>
<div class="controls">
  <button class="btn" id="prevBtn">&#9664; Prev</button>
  <div class="channel-info">
    <span id="channelName">${channel?.channel || ''}</span>
    <span class="counter" id="channelCounter">${index + 1}/${total}</span>
  </div>
  <button class="btn" id="nextBtn">Next &#9654;</button>
  <button class="btn close-btn" id="closeBtn">&#10005;</button>
</div>
</body></html>`;
}

// ---- Wire controls inside PiP window ----

function wireControls(win) {
  const doc = win.document;

  doc.getElementById('prevBtn').addEventListener('click', () => prevStream());
  doc.getElementById('nextBtn').addEventListener('click', () => nextStream());
  doc.getElementById('closeBtn').addEventListener('click', () => closePiP());

  doc.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevStream();
    } else if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      nextStream();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePiP();
    }
  });
}

// ---- Update PiP content on stream change ----

function updatePiPContent(win, state) {
  try {
    const doc = win.document;
    const iframe = doc.getElementById('stream-frame');
    const nameEl = doc.getElementById('channelName');
    const counterEl = doc.getElementById('channelCounter');

    if (iframe && state.url) {
      iframe.src = state.url;
    }
    if (nameEl) {
      nameEl.textContent = state.channel?.channel || '';
    }
    if (counterEl) {
      counterEl.textContent = `${state.index + 1}/${state.total}`;
    }
  } catch (e) {
    console.warn('Failed to update PiP content:', e);
  }
}
