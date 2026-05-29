import { useState, useMemo } from "react";
import { encodeStateToURL } from "./App"; // or wherever this function lives

export default function ShareLink({ appState, isMobile }) {
  const [copied, setCopied] = useState(false);
  const url = useMemo(() => encodeStateToURL(appState), [appState]);
  
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  
  // Mobile: filled purple share button (same as PiP, secondary action)
  if (isMobile) {
    return (
      <button
        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-opacity ${
          copied
            ? 'bg-[#7c3aed]/60 text-white/80'
            : 'bg-gradient-to-r from-[#7c3aed] to-[#a78bfa] text-white hover:opacity-90'
        }`}
        onClick={handleShare}
      >
        {copied ? "Copied!" : "Share"}
      </button>
    );
  }

  // Desktop: outlined — creates visual hierarchy vs filled PiP button
  return (
    <button
      className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
        copied
          ? 'border-[#7c3aed]/40 text-[#a78bfa]/60 bg-transparent'
          : 'border-[#7c3aed] text-[#a78bfa] bg-transparent hover:bg-[#7c3aed]/10'
      }`}
      onClick={handleShare}
    >
      {copied ? "Copied!" : "Share"}
    </button>
  );
}