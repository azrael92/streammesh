import React from "react";

export default function GridPicker({
  maxRows = 3,
  maxCols = 3,
  value = null,
  enabled,
  onChange,
  className = "",
}) {
  const [hover, setHover] = React.useState({ rows: 0, cols: 0 });
  const isEnabled = (r, c) => (enabled ? enabled(r, c) : true);
  const toKey = (r, c) => `${c}x${r}`; // key is cols x rows

  const palette = [];
  for (let r = 1; r <= maxRows; r++) {
    for (let c = 1; c <= maxCols; c++) palette.push([r, c]);
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <div className="px-3 py-2 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-sm cursor-default">
        Grid
      </div>
      <div className="absolute z-30 mt-2 p-3 rounded-2xl border border-white/15 bg-[#111] shadow-2xl">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${maxCols}, minmax(0, 1fr))` }}
        >
          {palette.map(([r, c]) => {
            const active = hover.rows >= r && hover.cols >= c;
            const key = toKey(r, c);
            const ok = isEnabled(r, c);
            const selected =
              value && value.rows === r && value.cols === c;

            return (
              <div
                key={key}
                onMouseEnter={() => setHover({ rows: r, cols: c })}
                onClick={() => ok && onChange?.({ rows: r, cols: c, key })}
                className={[
                  "w-10 h-8 rounded-md border text-xs grid place-items-center select-none transition",
                  ok ? "cursor-pointer" : "opacity-30 cursor-not-allowed",
                  active ? "bg-white/20 border-white/40" : "bg-white/5 border-white/15",
                  selected ? "ring-2 ring-white/60" : "",
                ].join(" ")}
                title={`${c}×${r}`}
              >
                {c}×{r}
              </div>
            );
          })}
        </div>
        <div className="text-[11px] text-white/70 mt-2">
          Hover to preview, click to apply
        </div>
      </div>
    </div>
  );
}
