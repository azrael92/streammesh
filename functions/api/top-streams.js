/**
 * Cloudflare Pages Function — /api/top-streams
 *
 * Fetches currently live top Twitch streams via Twitch's Helix API.
 * Falls back to a curated list of reliably active streamers if the
 * API is unreachable from Cloudflare's edge.
 */

const TWITCH_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

const NSFW_CATEGORIES = new Set([
  'Pools, Hot Tubs, and Beaches',
  'ASMR',
  'I\'m Only Sleeping',
]);

// Fallback streamers — large channels that stream daily, very likely live
const FALLBACK_STREAMERS = [
  { login: 'kaicenat', displayName: 'KaiCenat', game: '', viewers: 0 },
  { login: 'xqc', displayName: 'xQc', game: '', viewers: 0 },
  { login: 'hasanabi', displayName: 'HasanAbi', game: '', viewers: 0 },
  { login: 'tarik', displayName: 'tarik', game: '', viewers: 0 },
  { login: 'shroud', displayName: 'shroud', game: '', viewers: 0 },
  { login: 'summit1g', displayName: 'summit1g', game: '', viewers: 0 },
];

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const count = Math.min(parseInt(url.searchParams.get('count') || '6', 10), 20);
  const debug = url.searchParams.has('debug');

  try {
    // Use Twitch GQL API (same as Twitch web client)
    const res = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      headers: {
        'Client-Id': TWITCH_CLIENT_ID,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        query: `{
          streams(first: 40, options: {sort: VIEWER_COUNT}) {
            edges {
              node {
                broadcaster { login displayName }
                game { name }
                viewersCount
                type
              }
            }
          }
        }`,
      }),
    });

    if (!res.ok) {
      throw new Error(`Twitch GQL returned ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();

    // Debug mode: return the raw response for troubleshooting
    if (debug) {
      return new Response(JSON.stringify({ raw: data, edges: data?.data?.streams?.edges?.length || 0 }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const edges = data?.data?.streams?.edges || [];

    const live = edges
      .map((e) => e.node)
      .filter((n) => n.type === 'live')
      .filter((n) => !NSFW_CATEGORIES.has(n.game?.name || ''))
      .slice(0, count)
      .map((n) => ({
        login: n.broadcaster.login,
        displayName: n.broadcaster.displayName,
        game: n.game?.name || '',
        viewers: n.viewersCount,
      }));

    // If GQL returned results, use them
    if (live.length > 0) {
      return jsonResponse(live);
    }

    // Otherwise fall through to fallback
    throw new Error('GQL returned no usable streams');
  } catch (err) {
    // Fallback: return curated streamers so the page is never empty
    const fallback = FALLBACK_STREAMERS.slice(0, count);
    return jsonResponse(fallback);
  }
}

function jsonResponse(data) {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=120',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
