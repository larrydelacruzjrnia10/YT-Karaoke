const fetch = require('node-fetch');

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes — reduces repeat-search quota burn
const searchCache = new Map(); // key: lowercase query → { ts, results }

// Extract an 11-char YouTube video ID from any common URL form,
// or return the raw value if it already looks like an ID.
function parseVideoId(input) {
  if (!input) return null;
  const str = input.trim();

  // Already a bare ID (11 chars, base64url charset)
  if (/^[A-Za-z0-9_-]{11}$/.test(str)) return str;

  try {
    const url = new URL(str);
    // youtu.be/ID
    if (url.hostname === 'youtu.be') return url.pathname.slice(1).split('?')[0] || null;
    // youtube.com/shorts/ID  or  /embed/ID  or  /v/ID
    const pathMatch = url.pathname.match(/\/(?:shorts|embed|v)\/([A-Za-z0-9_-]{11})/);
    if (pathMatch) return pathMatch[1];
    // youtube.com/watch?v=ID
    const v = url.searchParams.get('v');
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
  } catch {
    // not a URL — fall through
  }
  return null;
}

// Decode HTML entities that YouTube occasionally puts in titles (e.g. &#39; → ')
function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

// Search YouTube. Auto-appends "karaoke" if not already in query.
// Returns array of { videoId, title, thumbnail, channel }.
// Each search costs ~100 quota units; results are cached for CACHE_TTL_MS.
async function searchYouTube(rawQuery) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error('YOUTUBE_API_KEY not set');

  const query = /karaoke/i.test(rawQuery) ? rawQuery : `${rawQuery} karaoke`;
  const cacheKey = query.toLowerCase();

  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.results;

  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    videoEmbeddable: 'true',
    maxResults: '8',
    key: apiKey,
  });

  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube search failed ${res.status}: ${body}`);
  }
  const data = await res.json();

  const results = (data.items || []).map(item => ({
    videoId: item.id.videoId,
    title: decodeEntities(item.snippet.title),
    thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
    channel: decodeEntities(item.snippet.channelTitle),
  }));

  searchCache.set(cacheKey, { ts: Date.now(), results });
  return results;
}

// Fetch title/thumbnail for a single video ID (costs ~1 quota unit).
// Falls back gracefully so a link-reserve still works even if this fails.
async function fetchVideoMeta(videoId) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return { title: `Video ${videoId}`, thumbnail: '' };

  try {
    const params = new URLSearchParams({ part: 'snippet', id: videoId, key: apiKey });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    const snippet = data.items?.[0]?.snippet;
    if (!snippet) throw new Error('no item');
    return {
      title: decodeEntities(snippet.title),
      thumbnail: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '',
    };
  } catch {
    return { title: `YouTube Video (${videoId})`, thumbnail: '' };
  }
}

module.exports = { parseVideoId, searchYouTube, fetchVideoMeta };
