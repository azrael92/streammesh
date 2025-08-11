import { encodeStateToURL } from "./App"; // or wherever this function lives

export default function ShareLink({ appState }) {
  const [copied, setCopied] = useState(false);
  const url = useMemo(() => encodeStateToURL(appState), [appState]);
  return (
    <div className="flex items-center gap-2">
      <input
        className="w-[420px] max-w-[70vw] px-3 py-2 rounded-xl border border-gray-300 text-sm"
        readOnly
        value={url}
      />
      <button
        className="px-3 py-2 rounded-xl border border-gray-300 hover:border-black text-sm"
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