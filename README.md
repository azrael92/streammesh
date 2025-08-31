# StreamMESH — multi-stream Twitch viewer

**What this is:** A browser-only React app that lets you watch and chat across multiple Twitch streams, with a shareable mini-URL.

- Layouts: 1×1, 2×1, 3×1, 1×2, 2×2, 3×2, 2×3, 3×3
- Toggle chat per tile, fullscreen any tile
- Picture-in-Picture mode for cycling through streams
- URL encodes layout + channels + chat toggles (copy link to share)
- No server required

## Features

### Multi-Stream Grid
- Support for up to 9 streams (3×3 layout)
- Drag-and-drop tile reordering
- Per-tile chat toggle, fullscreen, and volume controls
- Keyboard navigation and shortcuts

### Picture-in-Picture Mode
- **PiP All Streams** button opens a floating window
- Cycle through all active streams with Next/Previous buttons
- Keyboard shortcuts: `←` (previous), `→` or `Space` (next), `ESC` (close)
- Automatic stream cycling through your active channels
- Works with any layout configuration

### Keyboard Shortcuts
- `P` - Toggle Picture-in-Picture mode
- `?` or `H` - Show help modal
- `ESC` - Close modals and PiP windows
- `1-9` - Focus specific tiles
- `C` - Toggle chat on focused tile

## Local Dev

```bash
npm install
npm run dev
```

Open the printed URL (e.g. blahblah.com). The app auto-sets Twitch's `parent` param to your current domain/host.

## Browser Support

- **Picture-in-Picture**: Chrome 108+, Edge 108+, Opera 94+
- **General features**: All modern browsers
- **Note**: PiP mode requires user interaction and may not work in all browsers
- **Browser Detection**: The app automatically detects PiP support and only shows the feature for compatible browsers
- **Fallback**: App works perfectly without PiP - all core multi-stream functionality is available in all browsers

## Build

```bash
npm run build
npm run preview
```

## Deploy Options

### A) Vercel (simplest, no Actions needed)
1. Push this repo to GitHub.
2. In https://vercel.com, **Add New Project** → Import your repo.
3. Framework: **Vite**. Build: `npm run build`, Output: `dist/`.
4. Deploy. The app will work on the vercel.app domain automatically.

### B) Netlify (with GitHub Actions)
- Create a site in Netlify from your GitHub repo.
- Add repo secrets: `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID`.
- Push to `main` to auto-deploy via `.github/workflows/netlify.yml`.

### C) Vercel via GitHub Actions (optional)
- Add repo secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
- Push to `main` to auto-deploy via `.github/workflows/vercel.yml`.

## Twitch Embed Note
Twitch requires a `parent` URL param matching your domain. This app uses `window.location.hostname`, so it should just work locally and on your hosted domain.

## Shareable Links
After entering channels and selecting layout, use the **Copy** button to get a URL that restores everything.


