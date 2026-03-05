/**
 * topStreams.js — Fetch top live Twitch streams for auto-population
 *
 * Calls /api/top-streams (Cloudflare Pages Function) which hits
 * Twitch's GQL API server-side. Falls back to hardcoded popular
 * streamers if the API is down or returns nothing.
 */

// Large channels that stream daily — used if API fails
const FALLBACK = ['kaicenat', 'xqc', 'hasanabi', 'tarik', 'shroud', 'summit1g'];

/**
 * Returns an array of channel login strings that are currently live.
 * Never returns empty — falls back to popular streamers so the page
 * always has content on first load.
 */
export async function getTopStreams(count = 2) {
  try {
    // Cache-bust so browsers don't serve a stale empty response
    const res = await fetch('/api/top-streams?count=' + count + '&_t=' + Date.now(), {
      signal: AbortSignal.timeout(4000),
      cache: 'no-cache',
    });
    if (!res.ok) return FALLBACK.slice(0, count);

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return FALLBACK.slice(0, count);

    return data.slice(0, count).map((s) => s.login);
  } catch {
    return FALLBACK.slice(0, count);
  }
}
