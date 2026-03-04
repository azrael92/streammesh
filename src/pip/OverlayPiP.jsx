/**
 * OverlayPiP.jsx — Desktop in-page floating overlay
 *
 * Shows a compact video-only grid of all active streams,
 * fixed-positioned above all page content. No chat, no inputs —
 * just the video iframes in a clean grid with a close button.
 */

import { useMemo } from 'react';

function calculateGrid(count) {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count <= 2) return { cols: 2, rows: 1 };
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  return { cols: 3, rows: 3 };
}

export default function OverlayPiP({ channels, parentHost, onClose }) {
  const grid = useMemo(() => calculateGrid(channels.length), [channels.length]);

  const iframes = useMemo(() => {
    return channels.map((ch) => {
      const url = new URL('https://player.twitch.tv/');
      url.searchParams.set('channel', ch.channel);
      url.searchParams.set('parent', parentHost);
      url.searchParams.set('muted', 'false');
      url.searchParams.set('autoplay', 'true');
      return { channel: ch.channel, src: url.toString() };
    });
  }, [channels, parentHost]);

  if (iframes.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: '50vw',
        maxWidth: 720,
        minWidth: 360,
        zIndex: 9999,
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 12px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(124,58,237,0.4)',
        background: '#000',
      }}
    >
      {/* Video grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
          gridTemplateRows: `repeat(${grid.rows}, 1fr)`,
          gap: 2,
          aspectRatio: `${grid.cols * 16} / ${grid.rows * 9}`,
          background: '#111',
        }}
      >
        {iframes.map(({ channel, src }) => (
          <iframe
            key={channel}
            src={src}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            allow="autoplay; fullscreen; picture-in-picture"
            title={channel}
          />
        ))}
      </div>

      {/* Bottom bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: 'rgba(0,0,0,0.95)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.6)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          {iframes.length} stream{iframes.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={onClose}
          style={{
            background: '#ef4444',
            border: 'none',
            color: '#fff',
            padding: '4px 14px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
