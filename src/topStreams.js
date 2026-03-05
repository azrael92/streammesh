/**
 * topStreams.js — Fetch top live Twitch streams for auto-population
 *
 * Calls /api/top-streams (Cloudflare Pages Function) which hits
 * Twitch's GQL API server-side. Returns only channels that are
 * actually live right now.
 */

/**
 * Returns an array of channel login strings that are currently live.
 * Returns empty array if the API is unreachable (better than showing
 * offline screens).
 */
export async function getTopStreams(count = 2) {
  try {
    const res = await fetch('/api/top-streams?count=' + count, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return [];

    return data.slice(0, count).map((s) => s.login);
  } catch {
    return [];
  }
}
