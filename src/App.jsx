import { useState, useEffect, useMemo, useRef } from "react";
import GridPicker from "./GridPicker";
import HelpModal from "./HelpModal";
import ShareLink from "./Sharelink";
import Loader from "./Loader";
import { openMultiViewPiP, closeMultiViewPiP, isPiPOpen, updatePiPChannels } from "./pip/multiview";

/**
 * StreamMESH - Multi-Twitch Viewer (production-ready)
 * -------------------------------------------------------------
 * - Advanced grid picker (1x1 to 3x3) with keyboard navigation
 * - Per-tile chat toggle, fullscreen, volume, and quality controls
 * - Drag-and-drop tile reordering (see DraggableTile component)
 * - Shareable URLs with full state encoding
 * - Keyboard shortcuts and accessibility
 * - Modern dark UI with purple accent
 * - Picture-in-Picture mode for cycling through streams
 * - Responsive layouts: Grid for desktop, Stacked for mobile
 */

// Responsive layouts - Desktop shows grid, Mobile shows stacked
const DESKTOP_LAYOUTS = {
  "1x1": { rows: 1, cols: 1, label: "1×1", minTiles: 1, maxTiles: 1, type: "grid" },
  "2x1": { rows: 1, cols: 2, label: "2×1", minTiles: 2, maxTiles: 2, type: "grid" },
  "3x1": { rows: 1, cols: 3, label: "3×1", minTiles: 3, maxTiles: 3, type: "grid" },
  "1x2": { rows: 2, cols: 1, label: "1×2", minTiles: 2, maxTiles: 2, type: "grid" },
  "2x2": { rows: 2, cols: 2, label: "2×2", minTiles: 2, maxTiles: 4, type: "grid" },
  "3x2": { rows: 2, cols: 3, label: "3×2", minTiles: 2, maxTiles: 6, type: "grid" },
  "2x3": { rows: 3, cols: 2, label: "2×3", minTiles: 2, maxTiles: 6, type: "grid" },
  "3x3": { rows: 3, cols: 3, label: "3×3", minTiles: 2, maxTiles: 9, type: "grid" },
};

const MOBILE_LAYOUTS = {
  "stacked": { rows: 1, cols: 1, label: "Stacked", minTiles: 1, maxTiles: 9, type: "stacked" },
  "2stacked": { rows: 1, cols: 1, label: "2 Stacked", minTiles: 2, maxTiles: 2, type: "stacked" },
  "3stacked": { rows: 1, cols: 1, label: "3 Stacked", minTiles: 3, maxTiles: 3, type: "stacked" },
};

// Hook to detect mobile vs desktop
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobile;
}



// Get appropriate layouts based on device
function getLayouts(isMobile) {
  return isMobile ? MOBILE_LAYOUTS : DESKTOP_LAYOUTS;
}

const getLayoutMeta = (key, isMobile) => {
  const layouts = getLayouts(isMobile);
  return layouts[key] || (isMobile ? layouts["stacked"] : layouts["2x1"]);
};

// ---------- helpers ----------
const parseQuery = () => new URLSearchParams(window.location.search);

export const encodeStateToURL = (state) => {
  const meta = getLayoutMeta(state.layout, false); // Use desktop for URL encoding
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

// Get default layout based on device
function getDefaultLayout(isMobile) {
  return isMobile ? "stacked" : "2x1";
}

function useRestoredState() {
  const [state, setState] = useState(() => {
    const q = parseQuery();

    const layout = q.get("layout") || DEFAULT_STATE.layout;
    const meta = getLayoutMeta(layout, false); // Use desktop for restoration

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

// Helper function to get visible channels for PiP
function getVisibleChannels(appState, visibleCount) {
  return appState.tiles
    .slice(0, visibleCount)
    .map(tile => ({
      channel: tile.channel.trim(),
      muted: false,
      showChat: tile.showChat
    }))
    .filter(tile => tile.channel); // Only include channels with actual content
}



/** Compact layout selector (closed by default, shows current value) */
function LayoutSelect({ layoutKey, onChange, isMobile }) {
  const layouts = getLayouts(isMobile);
  const entries = Object.entries(layouts);
  
  return (
    <label className="inline-flex items-center gap-2 text-xs text-white/70">
      <span>{isMobile ? "View" : "Layout"}</span>
      <select
        className="bg-[#111319] border border-white/20 rounded-lg px-2 py-1 text-white text-sm"
        value={layoutKey}
        onChange={(e) => onChange(e.target.value)}
      >
        {entries.map(([key, meta]) => (
          <option key={key} value={key}>
            {meta.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [appState, setAppState] = useRestoredState();
  const [helpOpen, setHelpOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  // Calculate visible count first (needed by PiP functions)
  const parentDomain = typeof window !== "undefined" ? window.location.hostname : "localhost";
  const meta = getLayoutMeta(appState.layout, isMobile);
  const visibleCount = useMemo(
    () => Math.min(appState.activeCount, meta.maxTiles),
    [appState.activeCount, meta.maxTiles]
  );

  // Expand to the layout's full capacity so every cell can accept input immediately
  const setLayout = (layout) => {
    const m = getLayoutMeta(layout, isMobile);
    setAppState((s) => ({ ...s, layout, activeCount: m.maxTiles }));
  };





  // Ensure activeCount within layout bounds
  useEffect(() => {
    setAppState((s) => {
      const m = getLayoutMeta(s.layout, isMobile);
      let next = s.activeCount;
      if (next < m.minTiles) next = m.minTiles;
      if (next > m.maxTiles) next = m.maxTiles;
      return { ...s, activeCount: next };
    });
  }, [appState.layout, isMobile]);

  // Auto-switch to appropriate layout when device changes
  useEffect(() => {
    const currentMeta = getLayoutMeta(appState.layout, isMobile);
    if (currentMeta.type === "stacked" && !isMobile) {
      // Switch from mobile to desktop layout
      setLayout("2x1");
    } else if (currentMeta.type === "grid" && isMobile) {
      // Switch from desktop to mobile layout
      setLayout("stacked");
    }
  }, [isMobile]);

  const updateTile = (idx, patch) => {
    setAppState((s) => {
      const tiles = s.tiles.map((t, i) => (i === idx ? { ...t, ...patch } : t));
      return { ...s, tiles };
    });
  };

  // Multiview PiP handler
  const handleMultiviewPiP = async () => {
    try {
      const channels = getVisibleChannels(appState, visibleCount);
      if (channels.length === 0) {
        alert('No channels to display. Please add some Twitch channels first.');
        return;
      }
      
      // Check if we're on iOS and suggest app alternative
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS && !('documentPictureInPicture' in window)) {
        const useApp = confirm(
          'Document PiP is not supported on iOS Safari. Would you like to open the first channel in the Twitch app instead?'
        );
        if (useApp && channels[0]) {
          window.open(`https://twitch.tv/${channels[0].channel}`, '_blank');
          return;
        }
      }
      
      await openMultiViewPiP(channels, { 
        parentHost: parentDomain,
        startIndex: 0
      });
    } catch (error) {
      console.error('Failed to open multiview PiP:', error);
      alert('Failed to open multiview PiP. Please check console for details.');
    }
  };

  // Listen for sync requests from PiP window
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data.type === 'SYNC_REQUEST') {
        const channels = getVisibleChannels(appState, visibleCount);
        updatePiPChannels(channels);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [appState, visibleCount]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeydown = (event) => {
      // Ctrl/Cmd + M for Multiview PiP
      if ((event.ctrlKey || event.metaKey) && event.key === 'm') {
        event.preventDefault();
        handleMultiviewPiP();
      }
    };
    
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [appState, visibleCount]);

  if (loading) return <Loader />;

  return (
    <div className="min-h-screen w-full bg-[#0b0b0b] text-white flex flex-col">
      {/* Top bar (no overlay, no left-side badges) */}
      <header className="sticky top-0 z-40 w-full bg-[#0b0b0b] border-b border-[#23272f] shadow">
        {isMobile ? (
          // Mobile: Beautiful stacked layout with modern styling
          <div className="px-4 py-4 space-y-4 bg-gradient-to-b from-[#0b0b0b] to-[#151a23]">
            {/* Top row: Logo and Layout Selector */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-[#7c3aed] to-[#a78bfa] rounded-lg flex items-center justify-center">
                  <span className="text-white text-lg font-bold">S</span>
                </div>
                <span className="text-xl font-bold select-none">
                  Stream<span className="text-[#7c3aed]">MESH</span>
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-white/40 bg-[#1a1a1a] px-2 py-1 rounded-lg">
                  {visibleCount} streams
                </span>
                <LayoutSelect layoutKey={appState.layout} onChange={setLayout} isMobile={isMobile} />
              </div>
            </div>
            
            {/* Bottom row: Multiview PiP and Share buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleMultiviewPiP}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#10b981] to-[#34d399] text-white shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                >
                  📺 Multiview PiP
                </button>
                <span className="text-sm text-white/60">Share this layout</span>
              </div>
              <ShareLink appState={appState} isMobile={isMobile} />
            </div>
          </div>
        ) : (
          // Desktop: Beautiful horizontal layout with modern styling
          <div className="flex items-center px-6 py-4 bg-gradient-to-r from-[#0b0b0b] to-[#151a23]">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#7c3aed] to-[#a78bfa] rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-xl font-bold">S</span>
              </div>
              <span className="text-2xl font-bold select-none">
                Stream<span className="text-[#7c3aed]">MESH</span>
              </span>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-4">
              <LayoutSelect layoutKey={appState.layout} onChange={setLayout} isMobile={isMobile} />
              <div className="bg-[#1a1a1a] px-3 py-2 rounded-xl border border-[#23272f]">
                <span className="text-sm text-white/80 font-medium">
                  {visibleCount}/{meta.maxTiles} tiles
                </span>
              </div>
              <button
                onClick={handleMultiviewPiP}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#10b981] to-[#34d399] text-white shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
              >
                📺 Multiview PiP
              </button>
              <ShareLink appState={appState} isMobile={isMobile} />
            </div>
          </div>
        )}
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
          isMobile={isMobile}
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
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} isMobile={isMobile} />
      

    </div>
  );
}

// --- Grid ---
function Grid({ layout, activeCount, tiles, parentDomain, onChangeChannel, onToggleChat, onFullscreen, isMobile }) {
  const meta = getLayoutMeta(layout, isMobile);
  const isStacked = meta.type === "stacked";
  
  if (isStacked) {
    // Stacked layout for mobile - vertical scrolling
    const cells = tiles.slice(0, activeCount);
    
    return (
      <div className="flex flex-col gap-4 w-full h-full min-h-0 flex-1 overflow-y-auto">
        {cells.map((tile, idx) => (
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
            isStacked={true}
          />
        ))}
        {activeCount === 0 && (
          <div className="rounded-2xl border border-dashed border-[#23272f] bg-[#151a23] flex flex-col items-center justify-center text-gray-500 text-sm py-12">
            <span className="text-3xl mb-2">📺</span>
            <span>Add some channels to get started</span>
          </div>
        )}
      </div>
    );
  }
  
  // Grid layout for desktop
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
            isStacked={false}

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
function StreamTile({ tile, parentDomain, idx, onChangeChannel, onToggleChat, onFullscreen, isStacked }) {
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
      className={`relative flex flex-col bg-[#181c24] rounded-2xl overflow-hidden border border-[#23272f] shadow-lg group ${
        isStacked ? 'min-h-[300px]' : 'h-full min-h-0'
      }`}
      style={isStacked ? {} : { minHeight: 0, height: "100%" }}
    >
      {/* Overlay controls — always visible when channel is empty; on hover otherwise */}
      <div
        className={
          "absolute top-0 left-0 w-full flex items-center gap-2 px-3 py-2 bg-black/60 backdrop-blur-sm z-10 transition " +
          (channel ? "opacity-0 group-hover:opacity-100" : "opacity-100")
        }
      >
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
                title={`Twitch stream for ${channel}`}
                src={playerSrc}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
                style={{ display: "block" }}
              />
            </div>
            {tile.showChat && (
              <div className={`${isStacked ? 'w-full h-[200px] border-t' : 'w-[320px] min-w-[220px] max-w-[40%] h-full border-l'} bg-[#0e0e10] border-[#23272f]`}>
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