/**
 * MobilePiP.jsx — Mobile OS-level PiP via Document PiP API
 *
 * On Android Chrome (116+), opens a floating OS window that persists
 * above other apps. Shows one stream at a time with prev/next cycling.
 *
 * Falls back to an in-page mini overlay on browsers without Document PiP
 * (iOS Safari, older browsers).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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

const btnStyle = {
  background: '#7c3aed',
  border: 'none',
  color: '#fff',
  padding: '4px 10px',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  lineHeight: 1,
};

// ---- Document PiP (OS-level floating window) ----

function openDocumentPiP(channels, parentHost, onClosed) {
  if (!('documentPictureInPicture' in window)) return false;

  initCycling(channels, parentHost);
  const channel = getCurrentChannel();
  const url = buildCurrentStreamUrl();
  const index = getCurrentIndex();
  const total = getChannelCount();

  window.documentPictureInPicture
    .requestWindow({ width: 320, height: 220 })
    .then((pipWin) => {
      pipWin.document.write(buildPiPHTML(channel, url, index, total));
      pipWin.document.close();

      // Wire controls
      const doc = pipWin.document;
      doc.getElementById('prevBtn').addEventListener('click', () => prevStream());
      doc.getElementById('nextBtn').addEventListener('click', () => nextStream());
      doc.getElementById('closeBtn').addEventListener('click', () => {
        pipWin.close();
      });

      doc.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); prevStream(); }
        else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextStream(); }
        else if (e.key === 'Escape') { e.preventDefault(); pipWin.close(); }
      });

      // Listen for stream changes
      const unsub = onChange((state) => {
        try {
          const iframe = doc.getElementById('stream-frame');
          const nameEl = doc.getElementById('channelName');
          const counterEl = doc.getElementById('channelCounter');
          if (iframe) iframe.src = state.url;
          if (nameEl) nameEl.textContent = state.channel?.channel || '';
          if (counterEl) counterEl.textContent = `${state.index + 1}/${state.total}`;
        } catch {}
      });

      pipWin.addEventListener('pagehide', () => {
        unsub();
        destroyCycling();
        onClosed();
      });
    })
    .catch((err) => {
      console.error('Document PiP failed:', err);
      destroyCycling();
      onClosed();
    });

  return true;
}

function buildPiPHTML(channel, url, index, total) {
  return `<!DOCTYPE html><html><head>
<title>StreamMESH</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#000;color:#fff}
#stream-frame{width:100%;height:calc(100% - 36px);border:0;display:block;background:#000}
.controls{height:36px;display:flex;align-items:center;justify-content:center;gap:6px;background:rgba(0,0,0,.95);padding:0 8px;border-top:1px solid rgba(255,255,255,.1)}
.btn{background:#7c3aed;border:none;color:#fff;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer}
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

// ---- Fallback in-page overlay (iOS, older browsers) ----

function FallbackOverlay({ channels, parentHost, onClose }) {
  const [streamState, setStreamState] = useState({
    channel: null, index: 0, total: 0, url: '',
  });

  useEffect(() => {
    initCycling(channels, parentHost);
    setStreamState({
      channel: getCurrentChannel(),
      index: getCurrentIndex(),
      total: getChannelCount(),
      url: buildCurrentStreamUrl(),
    });
    const unsub = onChange((state) => setStreamState(state));
    return () => { unsub(); destroyCycling(); };
  }, [channels, parentHost]);

  const handleClose = useCallback(() => {
    destroyCycling();
    onClose();
  }, [onClose]);

  if (!streamState.channel) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16,
      width: '55vw', minWidth: 180, maxWidth: 280,
      zIndex: 9999, borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      border: '2px solid #7c3aed', background: '#000',
    }}>
      <div style={{ position: 'relative', paddingBottom: '56.25%' }}>
        <iframe
          src={streamState.url}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
          allow="autoplay; fullscreen; picture-in-picture"
          title={`PiP: ${streamState.channel.channel}`}
        />
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 8px', background: 'rgba(0,0,0,0.95)',
        borderTop: '1px solid rgba(255,255,255,0.1)', gap: 4,
      }}>
        <button onClick={prevStream} style={btnStyle}>&#9664;</button>
        <div style={{
          flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 600,
          color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', padding: '0 4px',
        }}>
          {streamState.channel.channel}
          <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 4, fontSize: 10 }}>
            {streamState.index + 1}/{streamState.total}
          </span>
        </div>
        <button onClick={nextStream} style={btnStyle}>&#9654;</button>
        <button onClick={handleClose} style={{ ...btnStyle, background: '#ef4444' }}>&#10005;</button>
      </div>
    </div>
  );
}

// ---- Main export ----

export default function MobilePiP({ channels, parentHost, onClose }) {
  const [docPiPOpened, setDocPiPOpened] = useState(false);
  const triedRef = useRef(false);

  useEffect(() => {
    if (triedRef.current) return;
    triedRef.current = true;

    // Try Document PiP first (Android Chrome — gives OS-level floating window)
    const opened = openDocumentPiP(channels, parentHost, () => {
      setDocPiPOpened(false);
      onClose();
    });

    if (opened) {
      setDocPiPOpened(true);
    }
  }, []);

  // If Document PiP opened successfully, render nothing in-page
  if (docPiPOpened) return null;

  // Fallback: in-page overlay (iOS, older browsers)
  return <FallbackOverlay channels={channels} parentHost={parentHost} onClose={onClose} />;
}
