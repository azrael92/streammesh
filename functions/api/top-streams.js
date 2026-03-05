/**
 * Cloudflare Pages Function — /api/top-streams
 *
 * Fetches currently live top Twitch streams via Twitch's GQL API.
 * Filters to SFW content (excludes Pools/Hot Tubs, ASMR, etc.)
 * Runs server-side so no CORS issues.
 */

const TWITCH_GQL = 'https://gql.twitch.tv/gql';
const TWITCH_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko'; // Twitch web app public client ID

const NSFW_CATEGORIES = new Set([
  'Pools, Hot Tubs, and Beaches',
  'ASMR',
  'Just Chatting', // often borderline, skip for auto-load
  'I\'m Only Sleeping',
  'Art',
]);

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const count = Math.min(parseInt(url.searchParams.get('count') || '6', 10), 20);

  try {
    const res = await fetch(TWITCH_GQL, {
      method: 'POST',
      headers: {
        'Client-Id': TWITCH_CLIENT_ID,
        'Content-Type': 'application/json',
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

    if (!res.ok) throw new Error(`Twitch GQL returned ${res.status}`);

    const data = await res.json();
    const edges = data?.data?.streams?.edges || [];

    const live = edges
      .map((e) => e.node)
      .filter((n) => n.type === 'live') // only actually live, not reruns
      .filter((n) => !NSFW_CATEGORIES.has(n.game?.name || ''))
      .slice(0, count)
      .map((n) => ({
        login: n.broadcaster.login,
        displayName: n.broadcaster.displayName,
        game: n.game?.name || '',
        viewers: n.viewersCount,
      }));

    return new Response(JSON.stringify(live), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // cache 5 min
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
