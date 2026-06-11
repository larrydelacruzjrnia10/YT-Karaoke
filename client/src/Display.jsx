import { useState, useEffect, useRef } from 'react';
import { useLiveQueue } from './useLiveQueue';
import { api } from './api';

// The YouTube IFrame Player API is loaded once via a script tag and then
// accessed through window.YT. The API fires window.onYouTubeIframeAPIReady
// when ready — we resolve a promise so any code can await it.
let ytApiReady = false;
let ytApiResolvers = [];
function waitForYtApi() {
  if (ytApiReady) return Promise.resolve();
  return new Promise(res => ytApiResolvers.push(res));
}
window.onYouTubeIframeAPIReady = () => {
  ytApiReady = true;
  ytApiResolvers.forEach(r => r());
  ytApiResolvers = [];
};

export default function Display() {
  const { queue, nowPlaying, wsStatus } = useLiveQueue();
  const [started, setStarted] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState(null);
  const playerRef = useRef(null);
  const playerDivRef = useRef(null);
  const advancingRef = useRef(false);

  // Inject YouTube IFrame Player API script (once)
  useEffect(() => {
    if (!document.getElementById('yt-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'yt-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  }, []);

  // Create / recreate the player when a new video needs to load
  async function playVideo(videoId) {
    if (!videoId) return;
    setCurrentVideoId(videoId);
    await waitForYtApi();

    if (playerRef.current) {
      playerRef.current.loadVideoById(videoId);
      return;
    }

    playerRef.current = new window.YT.Player(playerDivRef.current, {
      videoId,
      playerVars: {
        autoplay: 1,
        controls: 1,
        rel: 0,
        modestbranding: 1,
      },
      events: {
        onStateChange: handleStateChange,
        onError: handlePlayerError,
      },
    });
  }

  async function advance() {
    if (advancingRef.current) return;
    advancingRef.current = true;
    try {
      await api.advance();
    } finally {
      advancingRef.current = false;
    }
  }

  function handleStateChange(event) {
    // YT.PlayerState.ENDED === 0
    if (event.data === 0) advance();
  }

  function handlePlayerError() {
    // Skip unplayable / region-locked videos automatically
    advance();
  }

  // When the queue updates and we have a nowPlaying, keep the player in sync
  useEffect(() => {
    if (!started || !nowPlaying) return;
    if (nowPlaying.video_id !== currentVideoId) {
      playVideo(nowPlaying.video_id);
    }
  }, [nowPlaying, started]);

  function handleStart() {
    // Browsers require a user gesture before audio can play — this button is it.
    setStarted(true);
    if (nowPlaying) playVideo(nowPlaying.video_id);
  }

  const upNext = queue.slice(1, 6); // show up to 5 upcoming songs
  const wsColor = wsStatus === 'connected' ? '#4ade80' : wsStatus === 'polling' ? '#f59e0b' : '#f87171';

  return (
    <div className="display">
      {/* Status dot */}
      <div className="display-ws-dot" style={{ background: wsColor }} title={`WebSocket: ${wsStatus}`} />

      {/* Player area */}
      <div className="display-player">
        {!started ? (
          <div className="display-start-screen">
            <div className="display-start-logo">🎤</div>
            <h1 className="display-start-title">Karaoke Night</h1>
            {queue.length > 0 ? (
              <p className="display-start-sub">
                {queue.length} kanta sa queue — handa na!
              </p>
            ) : (
              <p className="display-start-sub">Naghihintay ng mga reservation…</p>
            )}
            {queue.length > 0 && (
              <button className="btn-start" onClick={handleStart}>
                ▶ Start Karaoke
              </button>
            )}
          </div>
        ) : nowPlaying ? (
          <div className="display-iframe-wrap">
            <div ref={playerDivRef} id="yt-player" />
          </div>
        ) : (
          <div className="display-start-screen">
            <div className="display-start-logo">🎤</div>
            <p className="display-start-sub">Naghihintay ng susunod na kanta…</p>
          </div>
        )}
      </div>

      {/* Side panel */}
      <aside className="display-panel">
        <div className="display-panel-now">
          <p className="display-panel-label">NOW PLAYING</p>
          {nowPlaying ? (
            <>
              {nowPlaying.thumbnail && (
                <img className="display-panel-thumb" src={nowPlaying.thumbnail} alt="" />
              )}
              <p className="display-panel-title">{nowPlaying.title}</p>
              <p className="display-panel-by">{nowPlaying.reserved_by}</p>
            </>
          ) : (
            <p className="display-panel-empty">Walang kanta ngayon</p>
          )}
        </div>

        {upNext.length > 0 && (
          <div className="display-panel-upnext">
            <p className="display-panel-label">UP NEXT</p>
            <ul className="display-upnext-list">
              {upNext.map((item, i) => (
                <li key={item.id} className="display-upnext-item">
                  <span className="display-upnext-num">{i + 2}</span>
                  <div>
                    <p className="display-upnext-title">{item.title}</p>
                    <p className="display-upnext-by">{item.reserved_by}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
