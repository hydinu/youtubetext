// ══════════════════════════════════════════════════
// api.js — YouTube video fetching
//
// Strategy:
//   1. Try GET /api/search-videos (ytfetcher backend) — no quota cost
//   2. On failure, fall back to YouTube Data API v3 directly
//
// Depends on: config.js, utils.js, ai-content.js
// ══════════════════════════════════════════════════


// ── 1. ytfetcher backend search ───────────────────

/**
 * Fetch videos via the ytfetcher-powered backend endpoint.
 * @param {string} topic
 * @returns {Promise<{topic: string, videos: Array, source: string}>}
 */
async function fetchVideosViaBackend(topic) {
  const url = `${BACKEND_URL}/api/search-videos?topic=${encodeURIComponent(topic)}&max_results=${MAX_RESULTS}`;
  const res = await fetch(url);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Backend returned ${res.status}`);
  }

  const data = await res.json();           // { topic, videos, source }

  // Normalise to the same shape the rest of the app expects
  const videos = data.videos.map(v => ({
    title:        v.title,
    video_id:     v.video_id,
    link:         v.link,
    thumbnail:    v.thumbnail,
    channel:      v.channel,
    published_at: v.published_at,
    view_count:   0,                       // ytfetcher doesn't expose view count
    duration:     '',                      // ytfetcher doesn't expose duration
    description:  v.description || '',
    has_transcript: v.has_transcript,
    ai_content:   generateAIContent(v.title, v.description || '', topic),
  }));

  return { topic, videos, source: 'ytfetcher' };
}


// ── 2. YouTube Data API v3 (fallback) ─────────────

/**
 * Fetch educational YouTube videos directly from YouTube Data API v3.
 * Used as a fallback when the backend is unreachable.
 * @param {string} topic
 * @returns {Promise<{topic: string, videos: Array, source: string}>}
 */
async function fetchVideosViaYouTubeAPI(topic) {
  // Step 1: search.list
  const searchParams = new URLSearchParams({
    part:            'snippet',
    q:               topic + ' tutorial explanation educational',
    type:            'video',
    maxResults:      MAX_RESULTS,
    order:           'relevance',
    videoCategoryId: '27',
    safeSearch:      'strict',
    key:             YOUTUBE_API_KEY,
  });

  const searchRes = await fetch(`${YOUTUBE_SEARCH_URL}?${searchParams}`);
  if (!searchRes.ok) {
    const errData = await searchRes.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `YouTube API ${searchRes.status}`);
  }
  const searchData = await searchRes.json();

  if (!searchData.items || searchData.items.length === 0) {
    return { topic, videos: [], source: 'youtube-api' };
  }

  // Step 2: videos.list for duration + stats
  const videoIds   = searchData.items.map(i => i.id.videoId).join(',');
  const detailRes  = await fetch(
    `${YOUTUBE_VIDEOS_URL}?${new URLSearchParams({
      part: 'snippet,contentDetails,statistics',
      id:   videoIds,
      key:  YOUTUBE_API_KEY,
    })}`
  );
  if (!detailRes.ok) throw new Error('Failed to fetch video details');
  const detailData = await detailRes.json();

  const videos = detailData.items.map(item => {
    const snippet = item.snippet;
    const stats   = item.statistics;
    return {
      title:          snippet.title,
      video_id:       item.id,
      link:           `https://youtube.com/watch?v=${item.id}`,
      thumbnail:      snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url,
      channel:        snippet.channelTitle,
      published_at:   snippet.publishedAt,
      view_count:     parseInt(stats.viewCount || 0),
      duration:       formatDuration(item.contentDetails.duration),
      description:    snippet.description || '',
      has_transcript: false,
      ai_content:     generateAIContent(snippet.title, snippet.description || '', topic),
    };
  });

  return { topic, videos, source: 'youtube-api' };
}


// ── 3. Public API used by app.js ──────────────────

/**
 * Main entry point: try ytfetcher backend first, fall back to YouTube API.
 * @param {string} topic - The search query
 * @returns {Promise<{topic: string, videos: Array, source: string}>}
 */
async function fetchYouTubeVideos(topic) {
  try {
    console.info('[api] Using ytfetcher backend…');
    const result = await fetchVideosViaBackend(topic);
    console.info(`[api] ytfetcher returned ${result.videos.length} videos`);
    return result;
  } catch (backendErr) {
    console.warn('[api] ytfetcher backend failed, falling back to YouTube Data API:', backendErr.message);
    const result = await fetchVideosViaYouTubeAPI(topic);
    console.info(`[api] YouTube API returned ${result.videos.length} videos`);
    return result;
  }
}
