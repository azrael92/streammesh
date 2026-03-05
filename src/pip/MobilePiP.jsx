/**
 * MobilePiP.jsx — Mobile PiP using Document PiP API
 *
 * Opens a real floating OS window (via documentPictureInPicture API)
 * that persists above other apps/tabs. Shows one stream at a time
 * with prev/next cycling.
 *
 * Falls back to window.open() popup on browsers without Document PiP.
 */

import { useEffect, useRef } from 'react';
import {
  nextStream,
  prevStream,
  getCurrentChannel,
  getCurrentIndex,
  getChannelCount,
  buildCurrentStreamUrl,
  onChange,
  initCycling,
  destroyCycling,
} from './cyclingPiP.js';

function buildHTML(channel, url, index, total) {
  return `<!DOCTYPE html><html><head>
<title>StreamMESH</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#000;color:#fff}
#stream-frame{width:100%;height:calc(100% - 36px);border:0;display:block;background:#000}
.controls{height:36px;display:flex;align-items:center;justify-content:center;gap:6px;background:rgba(0,0,0,.95);padding:0 8px;border-top:1px solid rgba(255,255,255,.1)}
.btn{background:#7c3aed;border:none;color:#fff;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;min-width:32px}
.btn:active{background:#6d28d9}
.btn.close-btn{background:#ef4444}
.info{flex:1;text-align:center;font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:rgba(255,255,255,.9)}
.counter{font-size:10px;color:rgba(255,255,255,.4);margin-left:4px}
</style></head><body>
<iframe id="stream-frame" src="${url}" allow="autoplay; fullscreen; picture-in-picture"></iframe>
<div class="controls">
<button class="btn" id="prevBtn">&#9664;</button>
<div class="info"><span id="channelName">${channel?.channel || ''}</span><span class="counter" id="channelCounter">${index + 1}/${total}</span></div>
<button class="btn" id="nextBtn">&#9654;</button>
<button class="btn close-btn" id="closeBtn">&#10005;</button>
</div></body></html>`;
}

function wireControls(doc, onCloseWindow) {
  doc.getElementById('prevBtn').addEventListener('click', () => prevStream());
  doc.getElementById('nextBtn').addEventListener('click', () => nextStream());
  doc.getElementById('closeBtn').addEventListener('click', onCloseWindow);

  doc.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); prevStream(); }
    else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextStream(); }
    else if (e.key === 'Escape') { e.preventDefault(); onCloseWindow(); }
  });
}

function subscribeToChanges(win) {
  return onChange((state) => {
    try {
      const doc = win.document;
      const iframe = doc.getElementById('stream-frame');
      const nameEl = doc.getElementById('channelName');
      const counterEl = doc.getElementById('channelCounter');
      if (iframe) iframe.src = state.url;
      if (nameEl) nameEl.textContent = state.channel?.channel || '';
      if (counterEl) counterEl.textContent = `${state.index + 1}/${state.total}`;
    } catch {}
  });
}

export default function MobilePiP({ channels, parentHost, onClose }) {
  const winRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let unsub = null;

    initCycling(channels, parentHost);

    const channel = getCurrentChannel();
    const url = buildCurrentStreamUrl();
    const index = getCurrentIndex();
    const total = getChannelCount();
    const html = buildHTML(channel, url, index, total);

    function cleanup() {
      if (unsub) unsub();
      destroyCycling();
      winRef.current = null;
      if (!cancelled) onClose();
    }

    async function openPiP() {
      let pipWin = null;

      // Try Document PiP API (Android Chrome, desktop Chrome/Edge)
      if ('documentPictureInPicture' in window) {
        try {
          pipWin = await window.documentPictureInPicture.requestWindow({
            width: 320,
            height: 220,
          });
          pipWin.document.write(html);
          pipWin.document.close();
          wireControls(pipWin.document, () => pipWin.close());
          unsub = subscribeToChanges(pipWin);
          pipWin.addEventListener('pagehide', cleanup);
        } catch (err) {
          console.warn('Document PiP failed, trying popup:', err);
          pipWin = null;
        }
      }

      // Fallback: popup window
      if (!pipWin) {
        pipWin = window.open(
          '', 'streammesh_pip',
          'width=320,height=220,resizable=yes,scrollbars=no,menubar=no,toolbar=no,location=no,status=no'
        );
        if (pipWin) {
          pipWin.document.write(html);
          pipWin.document.close();
          wireControls(pipWin.document, () => pipWin.close());
          unsub = subscribeToChanges(pipWin);
          pipWin.addEventListener('beforeunload', cleanup);
        } else {
          // Both failed
          cleanup();
          return;
        }
      }

      winRef.current = pipWin;
    }

    openPiP();

    return () => {
      cancelled = true;
      if (unsub) unsub();
      destroyCycling();
      if (winRef.current) {
        try { winRef.current.close(); } catch {}
        winRef.current = null;
      }
    };
  }, []);

  // Render nothing — the PiP is a separate window
  return null;
}
