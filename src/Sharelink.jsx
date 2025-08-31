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
  
  if (isMobile) {
    // Mobile: Minimal share button
    return (
      <button
        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 transform hover:scale-105 ${
          copied 
            ? 'bg-green-500 text-white shadow-lg' 
            : 'bg-gradient-to-r from-[#7c3aed] to-[#a78bfa] text-white shadow-md hover:shadow-lg'
        }`}
        onClick={handleShare}
      >
        {copied ? "✓ Copied!" : "📤 Share"}
      </button>
    );
  }
  
  // Desktop: Minimal share button
  return (
    <button
      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 transform hover:scale-105 ${
        copied 
          ? 'bg-green-500 text-white shadow-lg' 
          : 'bg-gradient-to-r from-[#7c3aed] to-[#a78bfa] text-white shadow-md hover:shadow-lg'
      }`}
      onClick={handleShare}
    >
      {copied ? "✓ Copied!" : "📤 Share"}
    </button>
  );
}