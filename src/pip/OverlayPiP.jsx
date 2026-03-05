/**
 * OverlayPiP.jsx — Desktop PiP using Document PiP API
 *
 * Opens a real floating window (via documentPictureInPicture API)
 * that stays visible across tabs and above other windows.
 * Shows a compact video-only grid of all active streams.
 *
 * Falls back to window.open() popup on browsers without Document PiP.
 */

import { useEffect, useRef } from 'react';

function calculateGrid(count) {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count <= 2) return { cols: 2, rows: 1 };
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  return { cols: 3, rows: 3 };
}

function buildHTML(channels, parentHost) {
  const grid = calculateGrid(channels.length);

  const iframes = channels
    .map((ch) => {
      const url = new URL('https://player.twitch.tv/');
      url.searchParams.set('channel', ch.channel);
      url.searchParams.set('parent', parentHost);
      url.searchParams.set('muted', 'false');
      url.searchParams.set('autoplay', 'true');
      return `<iframe src="${url}" style="width:100%;height:100%;border:0" allow="autoplay; fullscreen; picture-in-picture" title="${ch.channel}"></iframe>`;
    })
    .join('\n');

  return `<!DOCTYPE html><html><head>
<title>StreamMESH PiP</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.grid{display:grid;width:100%;height:calc(100% - 32px);gap:2px;background:#111;
  grid-template-columns:repeat(${grid.cols},1fr);
  grid-template-rows:repeat(${grid.rows},1fr)}
.bar{height:32px;display:flex;align-items:center;justify-content:space-between;padding:0 10px;background:#000;border-top:1px solid rgba(255,255,255,.1)}
.bar span{font-size:11px;color:rgba(255,255,255,.5);font-weight:600}
.close{background:#ef4444;border:none;color:#fff;padding:3px 12px;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer}
.close:hover{background:#dc2626}
</style></head><body>
<div class="grid">${iframes}</div>
<div class="bar">
  <span>${channels.length} stream${channels.length !== 1 ? 's' : ''}</span>
  <button class="close" id="closeBtn">Close</button>
</div>
<script>
document.getElementById('closeBtn').addEventListener('click',()=>window.close());
document.addEventListener('keydown',(e)=>{if(e.key==='Escape')window.close()});
</script>
</body></html>`;
}

export default function OverlayPiP({ channels, parentHost, onClose }) {
  const winRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function openPiP() {
      const html = buildHTML(channels, parentHost);
      const count = channels.length;
      const grid = calculateGrid(count);
      const w = Math.min(grid.cols * 320, 960);
      const h = Math.min(grid.rows * 200 + 32, 632);

      let pipWin = null;

      // Try Document PiP API first (Chrome/Edge 116+)
      if ('documentPictureInPicture' in window) {
        try {
          pipWin = await window.documentPictureInPicture.requestWindow({
            width: w,
            height: h,
          });
          pipWin.document.write(html);
          pipWin.document.close();

          pipWin.addEventListener('pagehide', () => {
            winRef.current = null;
            if (!cancelled) onClose();
          });
        } catch (err) {
          console.warn('Document PiP failed, trying popup:', err);
          pipWin = null;
        }
      }

      // Fallback: popup window
      if (!pipWin) {
        pipWin = window.open(
          '', 'streammesh_pip',
          `width=${w},height=${h},resizable=yes,scrollbars=no,menubar=no,toolbar=no,location=no,status=no`
        );
        if (pipWin) {
          pipWin.document.write(html);
          pipWin.document.close();
          pipWin.addEventListener('beforeunload', () => {
            winRef.current = null;
            if (!cancelled) onClose();
          });
        }
      }

      winRef.current = pipWin;
    }

    openPiP();

    return () => {
      cancelled = true;
      if (winRef.current) {
        try { winRef.current.close(); } catch {}
        winRef.current = null;
      }
    };
  }, []); // Only open once on mount

  // Render nothing in-page — the PiP is a separate window
  return null;
}
