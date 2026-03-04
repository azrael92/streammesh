# StreamMESH

A browser-only multi-stream Twitch viewer. Watch up to 9 streams at once, toggle chat per tile, share your layout via URL — no backend needed.

## What it does

- **Grid layouts** from 1x1 up to 3x3 (9 simultaneous streams)
- **Per-tile controls** — toggle chat, fullscreen, volume, drag-and-drop reorder
- **Picture-in-Picture** — floating window that cycles through your active streams with keyboard nav
- **Shareable links** — URL encodes your layout, channels, and chat visibility so you can send it to anyone
- **No server** — runs entirely in the browser using Twitch's public embed API

## Tech stack

| Layer | Tools |
|-------|-------|
| UI | React 18, Tailwind CSS |
| Build | Vite 5 |
| Streaming | Twitch Embedded Player + Chat iframes |
| PiP | Document Picture-in-Picture API, WebKit PiP (iOS), Canvas fallback |

## How it works

Each stream tile is a Twitch embed iframe. The app reads `window.location.hostname` and passes it as the `parent` param that Twitch requires — so it works on localhost, Vercel, Cloudflare Pages, or any custom domain without config.

Layouts and channels are encoded in the URL query string:

```
?layout=3x2&streams=pokimane,valkyrae,sykkuno&count=3&chat=111000000
```

The `chat` param is a 9-bit bitmask — each bit controls whether chat is visible on that tile.

Picture-in-Picture uses the Document PiP API (Chrome 108+) with a canvas-based fallback for iOS that renders animated frames into a video element for WebKit's native PiP.

## Getting started

```bash
git clone https://github.com/azrael92/streammesh.git
cd streammesh
npm install
npm run dev
```

Open the printed URL. Twitch embeds auto-detect your hostname.

## Production build

```bash
npm run build
npm run preview
```

Output goes to `dist/`. Deploy to Vercel, Netlify, Cloudflare Pages, or any static host — just point the build command at `vite build` and the output directory at `dist`.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `P` | Toggle Picture-in-Picture |
| `?` / `H` | Help modal |
| `1`–`9` | Focus a specific tile |
| `C` | Toggle chat on focused tile |
| `ESC` | Close modals / PiP |
| Arrow keys / Space | Navigate streams in PiP |

## Browser support

PiP requires Chrome 108+, Edge 108+, or Opera 94+. Everything else works in all modern browsers. The app detects PiP support and hides the button if it's unavailable.

## License

MIT
