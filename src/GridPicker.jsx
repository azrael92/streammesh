import React from "react";

const GRID_OPTIONS = [
  { key: "1x1", label: "1×1" },
  { key: "2x1", label: "2×1" },
  { key: "1x2", label: "1×2" },
  { key: "2x2", label: "2×2" },
  { key: "3x2", label: "3×2" },
  { key: "2x3", label: "2×3" },
  { key: "3x3", label: "3×3" },
];

export default function GridPicker({ value, onChange }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-white/60 mr-1">Layout:</span>
      <select
        className="bg-[#181c24] text-white text-xs rounded px-2 py-1 border border-[#23272f] focus:outline-none"
        value={`${value.rows}x${value.cols}`}
        onChange={e => onChange({ key: e.target.value })}
        aria-label="Select grid layout"
      >
        {GRID_OPTIONS.map(opt => (
          <option key={opt.key} value={opt.key}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}