/**
 * topStreams.js — Fetch top live Twitch streams for auto-population
 *
 * Tries /api/top-streams (Cloudflare Pages Function) first.
 * Falls back to a curated list of high-traffic SFW channels.
 */

// Curated fallback channels — popular, consistently live, SFW
const FALLBACK_CHANNELS = [
  'shroud',
  'pokimane',
  'timthetatman',
  'summit1g',
  'lirik',
  'nickmercs',
];

/**
 * Returns an array of channel name strings (2 by default).
 * Tries the API first, falls back to hardcoded channels.
 */
export async function getTopStreams(count = 2) {
  try {
    const res = await fetch('/api/top-streams?count=' + count, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.slice(0, count).map((s) => s.login || s.channel || s);
      }
    }
  } catch {
    // API not configured or unreachable — use fallback
  }

  // Shuffle and pick from fallback list
  const shuffled = [...FALLBACK_CHANNELS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
