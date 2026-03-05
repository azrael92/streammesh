# StreamMESH

Multi-view streaming, the way it should work. Live at [streammesh.io](https://www.streammesh.io).

## The problem

You want to watch a gaming tournament and follow three players at once. Or catch a Twitch stream while a Premier League match runs in the corner. Or have a muted YouTube recipe up next to whatever you're actually watching. None of this works today because every streaming service is a walled garden, and no single app lets you combine content across them.

Twitch barely supports multi-view on its own platform. Throw YouTube into the mix and you're already stuck juggling tabs. Add a streaming service like ESPN+ or Netflix and it's completely off the table.

## What StreamMESH is building toward

The long-term vision is a single app where you sign in once and build a multi-view from any combination of services: Twitch, YouTube, Netflix, ESPN+, whatever you subscribe to. You choose what goes in each tile. If you want a Twitch streamer next to a live match next to a muted cooking video, that's your call.

Getting there means solving two things:
1. **Data rights** — brokering the agreements that let content from different services appear side by side in one player
2. **Authentication** — a single sign-in layer that connects your accounts across services so you don't have to manage logins per tile

Until the industry builds this into the TV operating system itself (letting you multiview across apps natively), there's room for a standalone product that handles the cross-service layer.

## Where it stands today

StreamMESH currently supports Twitch multi-view as the starting point. The primary use case is esports and gaming — tournaments where viewers want multiple POVs running simultaneously, which Twitch doesn't handle well on its own.

### Current features

- **Grid layouts** from 1x1 up to 3x3 (9 simultaneous streams)
- **Per-tile controls** — toggle chat, fullscreen individual streams, drag-and-drop reorder
- **Picture-in-Picture** — floating window that cycles through active streams, persists across tabs
- **Shareable links** — URL encodes your layout, channels, and chat visibility so you can send your setup to anyone
- **Auto-load** — new visitors see top live Twitch streams immediately, no setup required
- **Mobile and desktop** — responsive layouts with stacked mobile view and grid desktop view

## Tech stack

| Layer | Tools |
|-------|-------|
| UI | React 18, Tailwind CSS |
| Build | Vite 5 |
| Hosting | Cloudflare Pages + Pages Functions |
| Streaming | Twitch Embedded Player + Chat iframes |
| PiP | Document Picture-in-Picture API with popup fallback |
| Live data | Twitch GQL API (server-side via Cloudflare Functions) |

## How it works

Each stream tile is a Twitch embed iframe. The app reads `window.location.hostname` and passes it as the `parent` param that Twitch requires, so it works on localhost or any custom domain without config.

Layouts and channels are encoded in the URL query string:

```
?layout=3x2&streams=pokimane,valkyrae,sykkuno&count=3&chat=111000000
```

The `chat` param is a 9-bit bitmask controlling chat visibility per tile.

On first visit (no URL params), a Cloudflare Pages Function calls Twitch's GQL API server-side to fetch the highest-viewership live streams and auto-populates the grid.

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

Output goes to `dist/`. Deployed on Cloudflare Pages — push to `main` triggers auto-deploy. The `functions/` directory contains the Pages Functions for the top streams API.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `P` | Toggle Picture-in-Picture |
| `?` / `H` | Help modal |
| `1`-`9` | Focus a specific tile |
| `C` | Toggle chat on focused tile |
| `ESC` | Close modals / PiP |
| Arrow keys / Space | Navigate streams in PiP |

## License

MIT
