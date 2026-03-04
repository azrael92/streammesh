/**
 * MobilePiP.jsx — Floating mini-player overlay for mobile
 *
 * Fixed-position component pinned to the bottom-right corner.
 * Shows one Twitch stream at a time with prev/next/close controls.
 */

import { useState, useEffect, useCallback } from 'react';
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
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  lineHeight: 1,
};

export default function MobilePiP({ channels, parentHost, onClose }) {
  const [streamState, setStreamState] = useState({
    channel: null,
    index: 0,
    total: 0,
    url: '',
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

    return () => {
      unsub();
      destroyCycling();
    };
  }, [channels, parentHost]);

  const handleClose = useCallback(() => {
    destroyCycling();
    onClose();
  }, [onClose]);

  if (!streamState.channel) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        width: '40vw',
        minWidth: 160,
        maxWidth: 220,
        zIndex: 9999,
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        border: '2px solid #7c3aed',
        background: '#000',
      }}
    >
      {/* Stream — 16:9 aspect ratio */}
      <div style={{ position: 'relative', paddingBottom: '56.25%' }}>
        <iframe
          src={streamState.url}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          allow="autoplay; fullscreen; picture-in-picture"
          title={`PiP: ${streamState.channel.channel}`}
        />
      </div>

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 8px',
          background: 'rgba(0,0,0,0.95)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          gap: 4,
        }}
      >
        <button onClick={prevStream} style={btnStyle}>
          &#9664;
        </button>
        <div
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 11,
            fontWeight: 600,
            color: '#fff',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            padding: '0 4px',
          }}
        >
          {streamState.channel.channel}
          <span
            style={{
              color: 'rgba(255,255,255,0.4)',
              marginLeft: 4,
              fontSize: 10,
            }}
          >
            {streamState.index + 1}/{streamState.total}
          </span>
        </div>
        <button onClick={nextStream} style={btnStyle}>
          &#9654;
        </button>
        <button
          onClick={handleClose}
          style={{ ...btnStyle, background: '#ef4444' }}
        >
          &#10005;
        </button>
      </div>
    </div>
  );
}
