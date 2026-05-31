import React, { useEffect, useRef, useState } from 'react'
import YouTubePlayer from './YouTubePlayer'

function TickerText({ as: Component = 'div', children, className = '', gap = 32 }) {
  const containerRef = useRef(null)
  const contentRef = useRef(null)
  const [meta, setMeta] = useState({ scroll: false, distance: 0, duration: 12 })

  useEffect(() => {
    let rafId = 0
    let rafId2 = 0

    const measure = () => {
      if (!containerRef.current || !contentRef.current) return

      const containerWidth = containerRef.current.getBoundingClientRect().width
      const contentWidth = contentRef.current.getBoundingClientRect().width
      if (!containerWidth || !contentWidth) return

      const shouldScroll = contentWidth - containerWidth > 1
      const distance = Math.ceil(contentWidth + gap)
      const pxPerSec = 80
      const duration = Number(Math.min(30, Math.max(12, distance / pxPerSec)).toFixed(2))

      setMeta((prev) => {
        if (
          prev.scroll === shouldScroll &&
          prev.distance === distance &&
          prev.duration === duration
        ) {
          return prev
        }
        return { scroll: shouldScroll, distance, duration }
      })
    }

    measure()
    rafId = window.requestAnimationFrame(measure)
    rafId2 = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(measure)
    })

    const resizeObserver = new ResizeObserver(measure)
    if (containerRef.current) resizeObserver.observe(containerRef.current)
    if (contentRef.current) resizeObserver.observe(contentRef.current)

    window.addEventListener('resize', measure)

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId)
      if (rafId2) window.cancelAnimationFrame(rafId2)
      resizeObserver.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [children, gap])

  const combinedClassName = `${meta.scroll ? 'ticker-shell scrolling' : 'ticker-shell'}${
    className ? ` ${className}` : ''
  }`

  return (
    <Component
      className={combinedClassName}
      ref={containerRef}
    >
      <div
        className="ticker-rail"
        style={
          meta.scroll
            ? {
                '--ticker-distance': `${meta.distance}px`,
                '--ticker-duration': `${meta.duration}s`,
                animationDuration: `${meta.duration}s`
              }
            : undefined
        }
      >
        <span className="ticker-content" ref={contentRef}>
          {children}
        </span>
        {meta.scroll && (
          <span className="ticker-content ticker-clone" aria-hidden="true">
            {children}
          </span>
        )}
      </div>
    </Component>
  )
}

function ShuffleView({
  loading,
  playlist,
  currentIndex,
  currentTime,
  isPlaying,
  shuffleMovieTypes,
  shuffleSingerTypes,
  toggleShuffleMovieType,
  toggleShuffleSingerType,
  generatePlaylist,
  goToPrevSong,
  goToNextSong,
  goToSong,
  togglePlayPause,
  onPlayerReady,
  onPlayerStateChange,
  onPlayerTimeUpdate,
  onReachEndPoint,
  onPlayerError,
  issueSeek,
  seekRequest,
  formatTime,
  getSongDuration,
  getSongProgress,
  getVisiblePlaylist
}) {
  const seekbarRef = useRef(null)
  const playlistRef = useRef(null)
  const isSeekDraggingRef = useRef(false)
  const [queueCollapsed, setQueueCollapsed] = useState(false)
  const [isSideBySideLayout, setIsSideBySideLayout] = useState(false)
  const [dragSeekPercent, setDragSeekPercent] = useState(null)
  const isFilterInvalid = shuffleMovieTypes.size === 0 || shuffleSingerTypes.size === 0

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const media = window.matchMedia('(min-width: 1025px)')

    const applyLayout = (matches) => {
      setIsSideBySideLayout(matches)
      if (matches) {
        setQueueCollapsed(false)
      }
    }

    applyLayout(media.matches)

    const handleChange = (event) => applyLayout(event.matches)

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleChange)
      return () => media.removeEventListener('change', handleChange)
    }

    media.addListener(handleChange)
    return () => media.removeListener(handleChange)
  }, [])

  const getSeekPercentFromClientX = (clientX) => {
    if (!seekbarRef.current) return null
    const rect = seekbarRef.current.getBoundingClientRect()
    if (!rect.width) return null
    const raw = (clientX - rect.left) / rect.width
    return Math.max(0, Math.min(1, raw))
  }

  const issueSeekByPercent = (percent) => {
    if (!playlist.length) return
    const duration = getSongDuration(playlist[currentIndex])
    if (!(duration > 0)) return
    const start = playlist[currentIndex].start || 0
    issueSeek('absolute', start + duration * percent)
  }

  const handleSeekPointerDown = (e) => {
    if (!playlist.length) return
    const percent = getSeekPercentFromClientX(e.clientX)
    if (percent === null) return

    isSeekDraggingRef.current = true
    setDragSeekPercent(percent)
    if (typeof e.currentTarget?.setPointerCapture === 'function') {
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  const handleSeekPointerMove = (e) => {
    if (!isSeekDraggingRef.current) return
    const percent = getSeekPercentFromClientX(e.clientX)
    if (percent === null) return
    setDragSeekPercent(percent)
  }

  const handleSeekPointerUp = (e) => {
    const percent = getSeekPercentFromClientX(e.clientX)
    if (percent !== null && (isSeekDraggingRef.current || dragSeekPercent !== null)) {
      issueSeekByPercent(percent)
    }
    isSeekDraggingRef.current = false
    setDragSeekPercent(null)
    if (typeof e.currentTarget?.releasePointerCapture === 'function') {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch (_) {
        // no-op: pointer may already be released
      }
    }
  }

  const handleSeekPointerCancel = () => {
    isSeekDraggingRef.current = false
    setDragSeekPercent(null)
  }

  const getDisplayedProgress = () => {
    if (!playlist.length) return 0
    if (dragSeekPercent !== null) {
      return dragSeekPercent * 100
    }
    return getSongProgress(playlist[currentIndex], currentTime)
  }

  useEffect(() => {
    if (queueCollapsed || !playlistRef.current || !playlist.length) {
      return
    }

    const container = playlistRef.current
    const currentItem = container.querySelector('.playlist-item.current.song')
    if (!currentItem) {
      return
    }

    const relativeTop = currentItem.offsetTop - container.offsetTop
    const nextTop = Math.max(0, relativeTop - 4)
    container.scrollTo({ top: nextTop, behavior: 'smooth' })
  }, [currentIndex, queueCollapsed, playlist.length])

  return (
    <div className="shuffle-mode">
      <section className="shuffle-topbar">
        <nav className="shuffle-filter-nav">
          <div className="filter-group">
            <h3>動画タイプ</h3>
            <div className="filter-buttons">
              <button
                className={`filter-btn toggle-btn ${shuffleMovieTypes.has('live') ? 'active' : ''}`}
                onClick={() => toggleShuffleMovieType('live')}
              >
                3D ライブ
              </button>
              <button
                className={`filter-btn toggle-btn ${shuffleMovieTypes.has('streaming') ? 'active' : ''}`}
                onClick={() => toggleShuffleMovieType('streaming')}
              >
                歌枠
              </button>
              <button
                className={`filter-btn toggle-btn ${shuffleMovieTypes.has('mv') ? 'active' : ''}`}
                onClick={() => toggleShuffleMovieType('mv')}
              >
                MV
              </button>
              <button
                className={`filter-btn toggle-btn ${shuffleMovieTypes.has('other') ? 'active' : ''}`}
                onClick={() => toggleShuffleMovieType('other')}
              >
                その他
              </button>
            </div>
          </div>

          <div className="filter-group">
            <h3>出演形式</h3>
            <div className="filter-buttons">
              <button
                className={`filter-btn toggle-btn ${shuffleSingerTypes.has('solo') ? 'active' : ''}`}
                onClick={() => toggleShuffleSingerType('solo')}
              >
                ソロ
              </button>
              <button
                className={`filter-btn toggle-btn ${shuffleSingerTypes.has('unit') ? 'active' : ''}`}
                onClick={() => toggleShuffleSingerType('unit')}
              >
                コラボ
              </button>
            </div>
          </div>
        </nav>

        <div className="shuffle-controls-top">
          <button
            className="reshuffle-btn"
            onClick={generatePlaylist}
            disabled={isFilterInvalid}
          >
            {playlist.length === 0 ? '▶ 再生開始' : '🔀 再シャッフル'}
          </button>
        </div>
      </section>

      {isFilterInvalid && (
        <div className="shuffle-error">
          少なくとも1つの動画タイプと1つの出演形式を選択してください
        </div>
      )}

      {/* プレイヤーとコンテンツ */}
      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : playlist.length === 0 ? (
        <div className="shuffle-stage">
          <div className="shuffle-main-panel">
            <div className="shuffle-empty">
            {shuffleMovieTypes.size === 0 || shuffleSingerTypes.size === 0
              ? 'フィルタを選択してから「再生開始」を押してください'
              : 'フィルタを設定して「再生開始」を押してください'}
            </div>

            {/* iPhoneでの初回再生安定化のため、プレイリスト未生成時もiframeを先にマウントする */}
            <div className="youtube-player-wrapper preload-player-disabled">
              <YouTubePlayer
                source={{
                  videoId: '',
                  startSeconds: 0,
                  endSeconds: null,
                  label: 'preload',
                }}
                isPlaying={false}
                volume={undefined}
                seekRequest={null}
                onReady={(payload) => onPlayerReady?.(payload)}
                onStateChange={(payload) => onPlayerStateChange?.(payload)}
                onTimeUpdate={(payload) => onPlayerTimeUpdate?.(payload)}
                onReachEndPoint={(payload) => onReachEndPoint?.(payload)}
                onFullscreenChange={() => {}}
                onError={(payload) => onPlayerError?.(payload)}
              />

              <button
                type="button"
                className="preload-player-overlay"
                onClick={generatePlaylist}
                disabled={isFilterInvalid}
                aria-label="再生開始"
              />
            </div>

            <div className="seekbar-container">
              <span className="time-label">0:00</span>
              <div className="seekbar" ref={seekbarRef}>
                <div className="seekbar-progress" style={{ width: '0%' }} />
              </div>
              <span className="time-label">0:00</span>
            </div>

            <div className="player-controls">
              <button
                className="control-btn control-btn-secondary"
                disabled
                aria-label="前の曲"
              >
                <span className="control-icon" aria-hidden="true">
                  <svg className="control-svg" viewBox="0 0 24 24" role="presentation" focusable="false">
                    <rect x="4" y="5" width="2" height="14" rx="1" />
                    <path d="M18 6L8 12L18 18V6Z" />
                  </svg>
                </span>
              </button>
              <button
                className="control-btn control-btn-primary"
                disabled
                aria-label="再生"
              >
                <span className="control-icon" aria-hidden="true">
                  <svg className="control-svg" viewBox="0 0 24 24" role="presentation" focusable="false">
                    <path d="M8 6L18 12L8 18V6Z" />
                  </svg>
                </span>
              </button>
              <button
                className="control-btn control-btn-secondary"
                disabled
                aria-label="次の曲"
              >
                <span className="control-icon" aria-hidden="true">
                  <svg className="control-svg" viewBox="0 0 24 24" role="presentation" focusable="false">
                    <rect x="18" y="5" width="2" height="14" rx="1" />
                    <path d="M6 6L16 12L6 18V6Z" />
                  </svg>
                </span>
              </button>
            </div>
          </div>

          <aside className="shuffle-queue-panel">
            <div className="playlist-header">
              <h3>キュー</h3>
              <div className="playlist-meta">
                <span>0/0</span>
              </div>
            </div>
            <div className="playlist-empty-message">
              再生開始するとキューが表示されます
            </div>
          </aside>
        </div>
      ) : (
        <div className="shuffle-stage">
          <div className="shuffle-main-panel">
            <div className="current-song-info">
              <TickerText
                as="h2"
                className="song-title"
                gap={24}
              >
                <a
                  href={`https://www.youtube.com/watch?v=${playlist[currentIndex].video_id}&t=${playlist[currentIndex].start}s`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {playlist[currentIndex].title}
                </a>
              </TickerText>
              <TickerText as="div" className="video-title" gap={20}>
                {playlist[currentIndex].video_title}
              </TickerText>
              <TickerText as="div" className="song-singers-ticker" gap={16}>
                {playlist[currentIndex].singers?.map((singer, idx) => (
                  <span
                    key={idx}
                    className="singer-tag"
                    style={singer.color ? { backgroundColor: singer.color } : {}}
                  >
                    {singer.name}
                  </span>
                ))}
              </TickerText>
            </div>

            <div className="youtube-player-wrapper">
              <YouTubePlayer
                source={{
                  videoId: playlist[currentIndex].video_id,
                  startSeconds: playlist[currentIndex].start || 0,
                  endSeconds: playlist[currentIndex].end || null,
                  label: playlist[currentIndex].title,
                }}
                isPlaying={isPlaying}
                volume={undefined}
                seekRequest={seekRequest}
                onReady={(payload) => onPlayerReady?.(payload)}
                onStateChange={(payload) => onPlayerStateChange?.(payload)}
                onTimeUpdate={(payload) => onPlayerTimeUpdate?.(payload)}
                onReachEndPoint={(payload) => onReachEndPoint?.(payload)}
                onFullscreenChange={() => {}}
                onError={(payload) => onPlayerError?.(payload)}
              />
            </div>

            <div className="seekbar-container">
              <span className="time-label">
                {formatTime(currentTime - playlist[currentIndex].start)}
              </span>
              <div
                className={`seekbar ${dragSeekPercent !== null ? 'dragging' : ''}`}
                ref={seekbarRef}
                onPointerDown={handleSeekPointerDown}
                onPointerMove={handleSeekPointerMove}
                onPointerUp={handleSeekPointerUp}
                onPointerCancel={handleSeekPointerCancel}
              >
                <div
                  className="seekbar-progress"
                  style={{
                    width: `${getDisplayedProgress()}%`
                  }}
                />
              </div>
              <span className="time-label">
                {formatTime(getSongDuration(playlist[currentIndex]))}
              </span>
            </div>

            <div className="player-controls">
              <button
                className="control-btn control-btn-secondary"
                onClick={goToPrevSong}
                disabled={currentIndex === 0}
                aria-label="前の曲"
              >
                <span className="control-icon" aria-hidden="true">
                  <svg className="control-svg" viewBox="0 0 24 24" role="presentation" focusable="false">
                    <rect x="4" y="5" width="2" height="14" rx="1" />
                    <path d="M18 6L8 12L18 18V6Z" />
                  </svg>
                </span>
              </button>
              <button
                className="control-btn control-btn-primary"
                onClick={togglePlayPause}
                disabled={!playlist.length}
                aria-label={isPlaying ? '一時停止' : '再生'}
              >
                <span className="control-icon" aria-hidden="true">
                  {isPlaying ? (
                    <svg className="control-svg" viewBox="0 0 24 24" role="presentation" focusable="false">
                      <rect x="7" y="5" width="3" height="14" rx="1" />
                      <rect x="14" y="5" width="3" height="14" rx="1" />
                    </svg>
                  ) : (
                    <svg className="control-svg" viewBox="0 0 24 24" role="presentation" focusable="false">
                      <path d="M8 6L18 12L8 18V6Z" />
                    </svg>
                  )}
                </span>
              </button>
              <button
                className="control-btn control-btn-secondary"
                onClick={goToNextSong}
                disabled={currentIndex === playlist.length - 1}
                aria-label="次の曲"
              >
                <span className="control-icon" aria-hidden="true">
                  <svg className="control-svg" viewBox="0 0 24 24" role="presentation" focusable="false">
                    <rect x="18" y="5" width="2" height="14" rx="1" />
                    <path d="M6 6L16 12L6 18V6Z" />
                  </svg>
                </span>
              </button>
            </div>
          </div>

          <aside className={`shuffle-queue-panel ${queueCollapsed ? 'collapsed' : ''}`}>
            <div className="playlist-header">
              <h3>キュー</h3>
              <div className="playlist-meta">
                <span>{currentIndex + 1}/{playlist.length}</span>
                {!isSideBySideLayout ? (
                  <button
                    type="button"
                    className="queue-toggle-btn"
                    onClick={() => setQueueCollapsed((prev) => !prev)}
                  >
                    {queueCollapsed ? '開く' : '閉じる'}
                  </button>
                ) : null}
              </div>
            </div>

            {!queueCollapsed && (
              <div className="playlist" ref={playlistRef}>
                {getVisiblePlaylist().map((item) => (
                  <div
                    key={item.globalIndex}
                    className={`playlist-item ${item.globalIndex === currentIndex ? 'current' : ''} ${item.type}`}
                    onClick={() => item.type === 'song' && goToSong(item.globalIndex)}
                  >
                    {item.type === 'separator' ? (
                      <div className="playlist-separator">...</div>
                    ) : (
                      <>
                        <div className="playlist-song-title">{item.song.title}</div>
                        <div className="playlist-song-video">{item.song.video_title}</div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

export default ShuffleView
