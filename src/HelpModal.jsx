import React from "react";

export default function HelpModal({ open, onClose, isMobile = false, piPSupported = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#181c24] rounded-2xl shadow-2xl p-8 w-full max-w-md border border-[#23272f] relative">
        <button
          className="absolute top-4 right-4 text-white/60 hover:text-white text-xl"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="text-lg font-semibold mb-4">Keyboard Shortcuts</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span>Toggle grid picker</span>
            <span className="kbd">G</span>
          </div>
          <div className="flex justify-between">
            <span>Focus tile 1-9</span>
            <span className="kbd">1–9</span>
          </div>
          <div className="flex justify-between">
            <span>Toggle chat (focused tile)</span>
            <span className="kbd">C</span>
          </div>
          <div className="flex justify-between">
            <span>Picture-in-Picture mode</span>
            <span className="kbd">P</span>
          </div>
          <div className="flex justify-between">
            <span>Show this help</span>
            <span>
              <span className="kbd">?</span> / <span className="kbd">H</span>
            </span>
          </div>
          <div className="flex justify-between">
            <span>Close modals</span>
            <span className="kbd">ESC</span>
          </div>
        </div>
        <hr className="my-4 border-white/10" />
        <div className="text-xs text-white/50 mb-4">
          <div className="font-semibold mb-2">PiP Window Controls:</div>
          <div className="space-y-1">
            <div>• <span className="kbd">←</span> - Previous stream</div>
            <div>• <span className="kbd">→</span> or <span className="kbd">Space</span> - Next stream</div>
            <div>• <span className="kbd">ESC</span> - Close PiP window</div>
          </div>
        </div>
        <hr className="my-4 border-white/10" />
        <div className="text-xs text-white/50 text-center">
          Press <span className="kbd">?</span> anytime to toggle this help
        </div>
        <style>{`
          .kbd {
            @apply inline-block px-2 py-1 rounded bg-[#23272f] text-white/90 text-xs font-mono;
          }
        `}</style>
      </div>
    </div>
  );
}