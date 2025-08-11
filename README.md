# StreamMESH — multi-stream Twitch viewer

**What this is:** A browser-only React app that lets you watch and chat across multiple Twitch streams, with a shareable mini-URL.

- Layouts: 2×1, 1×2, 2×2
- Toggle chat per tile, fullscreen any tile
- URL encodes layout + channels + chat toggles (copy link to share)
- No server required

## Local Dev

```bash
npm install
npm run dev
```

Open the printed URL (e.g. blahblah.com). The app auto-sets Twitch's `parent` param to your current domain/host.

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


