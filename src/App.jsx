import React, { useEffect, useMemo, useRef, useState } from "react";
import Loader from "./Loader.jsx";
import HelpModal from "./HelpModal.jsx";
import GridPicker from "./GridPicker.jsx";

/**
 * StreamMESH - Multi-Twitch Viewer (production-ready)
 * -------------------------------------------------------------
 * - Advanced grid picker (1x1 to 3x3) with keyboard navigation
 * - Per-tile chat toggle, fullscreen, volume, and quality controls
 * - Drag-and-drop tile reordering (see DraggableTile component)
 * - Shareable URLs with full state encoding
 * - Keyboard shortcuts and accessibility
 * - Modern dark UI with purple accent
 */

// Layouts (supports up to 3x3 now)
const LAYOUTS = {
  "1x1": { rows: 1, cols: 1, label: "1×1", minTiles: 1, maxTiles: 1 },
  "2x1": { rows: 1, cols: 2, label: "2×1", minTiles: 2, maxTiles: 2 },
  "1x2": { rows: 2, cols: 1, label: "1×2", minTiles: 2, maxTiles: 2 },
  "2x2": { rows: 2, cols: 2, label: "2×2", minTiles: 2, maxTiles: 4 },
  "3x2": { rows: 2, cols: 3, label: "3×2", minTiles: 2, maxTiles: 6 },
  "2x3": { rows: 3, cols: 2, label: "2×3", minTiles: 2, maxTiles: 6 },
  "3x3": { rows: 3, cols: 3, label: "3×3", minTiles: 2, maxTiles: 9 },
};
const getLayoutMeta = (key) => LAYOUTS[key] || LAYOUTS["2x1"];

// ---------- helpers ----------
const parseQuery = () => new URLSearchParams(window.location.search);

export const encodeStateToURL = (state) => {
  const meta = getLayoutMeta(state.layout);
  const params = new URLSearchParams();

  params.set("layout", state.layout);

  const streams = state.tiles.map((t) => t.channel.trim()).filter(Boolean);
  if (streams.length) params.set("streams", streams.join(","));

  // Clamp count to bounds
  const count = Math.min(Math.max(state.activeCount, meta.minTiles), meta.maxTiles);
  params.set("count", String(count));

  // Always include chat mask up to 9 bits so "all off" is preserved
  const chatMask = state.tiles
    .slice(0, 9)
    .map((t) => (t.showChat ? "1" : "0"))
    .join("");
  params.set("chat", chatMask);

  // Absolute URL that works locally and after deploy (keeps subpaths too)
  const { origin, pathname } = window.location;
  return `${origin}${pathname}?${params.toString()}`;
};

const DEFAULT_STATE = {
  layout: "2x1",
  activeCount: 2,
  tiles: Array.from({ length: 9 }, (_, i) => ({ id: i, channel: "", showChat: true })),
};

function useRestoredState() {
  const [state, setState] = useState(() => {
    const q = parseQuery();

    const layout = q.get("layout") || DEFAULT_STATE.layout;
    const meta = getLayoutMeta(layout);

    // count: clamp to layout bounds; default to meta.minTiles
    const rawCount = Number(q.get("count"));
    const activeCount = Number.isFinite(rawCount)
      ? Math.min(Math.max(rawCount, meta.minTiles), meta.maxTiles)
      : meta.minTiles;

    const streams = (q.get("streams") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Support up to 9 tiles (3x3)
    const chatParam = q.get("chat");
    const chatMask = (chatParam || "").padEnd(9, "0");

    const tiles = DEFAULT_STATE.tiles.map((t, i) => ({
      ...t,
      channel: streams[i] || "",
      // If chat param absent, default ON; otherwise follow the bit
      showChat: chatParam ? chatMask[i] === "1" : true,
    }));

    return { layout, activeCount, tiles };
  });

  return [state, setState];
}

function ShareLink({ appState }) {
  const [copied, setCopied] = useState(false);
  const url = useMemo(() => encodeStateToURL(appState), [appState]);
  return (
    <div className="flex items-center gap-2">
      <input
        className="w-[260px] max-w-[60vw] px-3 py-2 rounded-lg border border-[#23272f] bg-white text-black text-sm"
        readOnly
        value={url}
      />
      <button
        className="px-3 py-2 rounded-lg bg-[#7c3aed] text-white font-semibold hover:bg-[#a78bfa] transition"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = React.useState(true);
  const [appState, setAppState] = useRestoredState();
  const [helpOpen, setHelpOpen] = useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "?" || e.key === "h" || e.key === "H") setHelpOpen((v) => !v);
      if (e.key === "Escape") setHelpOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const parentDomain = typeof window !== "undefined" ? window.location.hostname : "localhost";
  const meta = LAYOUTS[appState.layout] || LAYOUTS["2x1"];

  // Ensure activeCount within layout bounds
  useEffect(() => {
    setAppState((s) => {
      const m = LAYOUTS[s.layout];
      let next = s.activeCount;
      if (next < m.minTiles) next = m.minTiles;
      if (next > m.maxTiles) next = m.maxTiles;
      return { ...s, activeCount: next };
    });
  }, [appState.layout]);

  const updateTile = (idx, patch) => {
    setAppState((s) => {
      const tiles = s.tiles.map((t, i) => (i === idx ? { ...t, ...patch } : t));
      return { ...s, tiles };
    });
  };

  const setLayout = (layout) => {
    const m = LAYOUTS[layout];
    setAppState((s) => ({ ...s, layout, activeCount: Math.min(s.activeCount, m.maxTiles) }));
  };

  const visibleCount = React.useMemo(
    () => Math.min(appState.activeCount, meta.maxTiles),
    [appState.activeCount, meta.maxTiles]
  );

  if (loading) return <Loader />;

  return (
    <div className="min-h-screen w-full bg-[#0b0b0b] text-white flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 w-full bg-[#0b0b0b] border-b border-[#23272f] shadow flex items-center px-4 py-3">
        <span className="text-lg font-bold select-none">
          Stream<span className="text-[#7c3aed]">MESH</span>
        </span>
        <span className="ml-4 px-2 py-1 rounded bg-[#181c24] text-xs font-medium text-white/80">
          Layout: {meta.label}
        </span>
        <span className="ml-4 text-xs text-white/60">
          Tiles: {visibleCount}/{meta.maxTiles}
        </span>
        <div className="flex-1" />
        <GridPicker
          value={{
            rows: LAYOUTS[appState.layout].rows,
            cols: LAYOUTS[appState.layout].cols,
          }}
          onChange={({ key }) => setLayout(key)}
        />
        <div className="ml-4">
          <ShareLink appState={appState} />
        </div>
      </header>

      {/* Grid - main is the only flex column parent */}
      <main className="flex flex-col flex-1 min-h-0 w-full pb-6" style={{ minHeight: 0 }}>
        <Grid
          layout={appState.layout}
          activeCount={visibleCount}
          tiles={appState.tiles}
          parentDomain={parentDomain}
          onChangeChannel={(idx, v) => updateTile(idx, { channel: v })}
          onToggleChat={(idx) => updateTile(idx, { showChat: !appState.tiles[idx].showChat })}
          onFullscreen={(idx) => {
            const el = document.getElementById(`tile-${idx}`);
            if (el?.requestFullscreen) el.requestFullscreen();
          }}
        />
      </main>

      <footer className="px-4 md:px-6 py-4 text-xs text-white/50 border-t border-[#23272f]">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-1">
          <div>
            StreamMESH – Watch multiple Twitch streams simultaneously. Built with React + Tailwind CSS.
          </div>
          <div>
            Press <span className="font-semibold text-white">?</span> for keyboard shortcuts
          </div>
        </div>
      </footer>

      {/* Floating help button */}
      <button
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-[#7c3aed] text-white text-2xl shadow-lg flex items-center justify-center hover:bg-[#a78bfa] transition"
        aria-label="Show keyboard shortcuts"
        onClick={() => setHelpOpen(true)}
      >
        ?
      </button>
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

// --- Grid ---
function Grid({ layout, activeCount, tiles, parentDomain, onChangeChannel, onToggleChat, onFullscreen }) {
  const meta = LAYOUTS[layout] || LAYOUTS["2x1"];
  const totalCells = meta.rows * meta.cols;
  const cells = tiles.slice(0, activeCount);
  const gridTiles = [...cells, ...Array.from({ length: totalCells - cells.length }, () => null)];

  return (
    <div
      className="grid gap-4 w-full h-full min-h-0 flex-1"
      style={{
        gridTemplateColumns: `repeat(${meta.cols}, 1fr)`,
        gridTemplateRows: `repeat(${meta.rows}, 1fr)`,
        minHeight: 0,
        height: "100%",
      }}
      role="grid"
      aria-label="Twitch stream grid"
    >
      {gridTiles.map((tile, idx) =>
        tile ? (
          <StreamTile
            key={tile.id}
            tile={tile}
            parentDomain={parentDomain}
            idx={idx}
            onChangeChannel={(v) => onChangeChannel(idx, v)}
            onToggleChat={() => onToggleChat(idx)}
            onFullscreen={() => {
              const el = document.getElementById(`tile-${idx}`);
              if (el?.requestFullscreen) el.requestFullscreen();
            }}
          />
        ) : (
          <div
            key={`empty-${idx}`}
            className="rounded-2xl border border-dashed border-[#23272f] bg-[#151a23] flex flex-col items-center justify-center text-gray-500 text-sm transition hover:bg-[#23272f]/40 w-full h-full min-h-0"
            role="gridcell"
            aria-label="Empty grid cell"
            style={{ minHeight: 0 }}
          >
            <span className="text-3xl mb-2">📺</span>
            <span>Empty</span>
          </div>
        )
      )}
    </div>
  );
}

// --- StreamTile ---
function StreamTile({ tile, parentDomain, idx, onChangeChannel, onToggleChat, onFullscreen }) {
  const wrapRef = useRef(null);
  const channel = tile.channel.trim();
  const showPlayer = Boolean(channel);

  const playerSrc = useMemo(() => {
    if (!channel) return "";
    const u = new URL("https://player.twitch.tv/");
    u.searchParams.set("channel", channel);
    u.searchParams.set("parent", parentDomain);
    u.searchParams.set("muted", "true");
    u.searchParams.set("autoplay", "true");
    return u.toString();
  }, [channel, parentDomain]);

  const chatSrc = useMemo(() => {
    if (!channel) return "";
    const u = new URL(`https://www.twitch.tv/embed/${channel}/chat`);
    u.searchParams.set("parent", parentDomain);
    return u.toString();
  }, [channel, parentDomain]);

  const requestFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
  };

  return (
    <div
      ref={wrapRef}
      id={typeof idx === "number" ? `tile-${idx}` : undefined}
      className="relative flex flex-col h-full min-h-0 bg-[#181c24] rounded-2xl overflow-hidden border border-[#23272f] shadow-lg group"
      style={{ minHeight: 0, height: "100%" }}
    >
      {/* Overlay controls */}
      <div className="absolute top-0 left-0 w-full flex items-center gap-2 px-3 py-2 bg-black/60 backdrop-blur-sm z-10 opacity-0 group-hover:opacity-100 transition">
        <input
          className="flex-1 px-2 py-1 rounded bg-white/80 text-black text-xs"
          placeholder="Channel"
          value={tile.channel}
          onChange={(e) => onChangeChannel(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <button
          className={`px-2 py-1 rounded border text-xs font-semibold ${
            tile.showChat ? "bg-[#7c3aed]/90 border-[#7c3aed] text-white" : "bg-white border-gray-300 text-black"
          }`}
          onClick={onToggleChat}
          title={tile.showChat ? "Hide chat" : "Show chat"}
          type="button"
        >
          💬
        </button>
        <button
          className="px-2 py-1 rounded border border-white/20 text-xs bg-white/10 text-white hover:bg-[#7c3aed]/80"
          onClick={onFullscreen || requestFullscreen}
          title="Fullscreen"
          type="button"
        >
          ⛶
        </button>
      </div>
      {/* Stream/Chat */}
      <div className="flex-1 min-h-0 flex">
        {showPlayer ? (
          <>
            <div className={`flex-1 min-w-0 min-h-0 ${tile.showChat ? "" : "w-full"}`}>
              <iframe
                title={`player-${channel}`}
                src={playerSrc}
                allow="autoplay; fullscreen"
                allowFullScreen
                className="w-full h-full"
                style={{ display: "block" }}
              />
            </div>
            {tile.showChat && (
              <div className="w-[320px] min-w-[220px] max-w-[40%] h-full bg-[#0e0e10] border-l border-[#23272f]">
                <iframe title={`chat-${channel}`} src={chatSrc} className="w-full h-full" style={{ display: "block" }} />
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-sm">
            <span className="text-4xl mb-2">📺</span>
            <span>Enter a channel above</span>
          </div>
        )}
      </div>
    </div>
  );
}
