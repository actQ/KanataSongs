import React, { useEffect, useRef, useState } from 'react'
import YouTubePlayer from './YouTubePlayer'

function TickerText({ as: Component = 'div', children, className = '', gap = 32 }) {
  const containerRef = useRef(null)
  const contentRef = useRef(null)
  const [meta, setMeta] = useState({ scroll: false, distance: 0, duration: 12 })

  useEffect(() => {
    const measure = () => {
      if (!containerRef.current || !contentRef.current) return

      const containerWidth = containerRef.current.offsetWidth
      const contentWidth = contentRef.current.scrollWidth
      const shouldScroll = contentWidth > containerWidth + 2
      const distance = contentWidth + gap
      const pxPerSec = 80
      const duration = Math.min(30, Math.max(12, distance / pxPerSec))

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

    const resizeObserver = new ResizeObserver(measure)
    if (containerRef.current) resizeObserver.observe(containerRef.current)
    if (contentRef.current) resizeObserver.observe(contentRef.current)

    window.addEventListener('resize', measure)

    return () => {
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

  const handleSeekbarClick = (e) => {
    if (!seekbarRef.current || !playlist.length) return
    
    const rect = seekbarRef.current.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    const duration = getSongDuration(playlist[currentIndex])
    
    if (duration > 0) {
      const newTime = playlist[currentIndex].start + (percent * duration)
      issueSeek('absolute', newTime)
    }
  }
  return (
    <div className="shuffle-mode">
      {/* フィルタ */}
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

      {/* エラー表示 */}
      {(shuffleMovieTypes.size === 0 || shuffleSingerTypes.size === 0) && (
        <div className="shuffle-error">
          少なくとも1つの動画タイプと1つの出演形式を選択してください
        </div>
      )}

      {/* 再生開始/再シャッフルボタン */}
      <div className="shuffle-controls-top">
        <button 
          className="reshuffle-btn" 
          onClick={generatePlaylist}
          disabled={shuffleMovieTypes.size === 0 || shuffleSingerTypes.size === 0}
        >
          {playlist.length === 0 ? '▶️ 再生開始' : '🔀 再シャッフル'}
        </button>
      </div>

      {/* プレイヤーとコンテンツ */}
      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : playlist.length === 0 ? (
        <div className="shuffle-empty">
          {shuffleMovieTypes.size === 0 || shuffleSingerTypes.size === 0 
            ? 'フィルタを選択してから「再生開始」を押してください' 
            : 'フィルタを設定して「再生開始」を押してください'}
        </div>
      ) : (
        <div className="shuffle-player-container">
          {/* 現在の曲情報 */}
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
            <TickerText as="div" className="song-singers" gap={16}>
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

          {/* YouTubeプレーヤー */}
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

          {/* シークバー */}
          <div className="seekbar-container">
            <span className="time-label">
              {formatTime(currentTime - playlist[currentIndex].start)}
            </span>
            <div 
              className="seekbar"
              ref={seekbarRef}
              onClick={handleSeekbarClick}
            >
              <div 
                className="seekbar-progress" 
                style={{ 
                  width: `${getSongProgress(playlist[currentIndex], currentTime)}%` 
                }}
              />
            </div>
            <span className="time-label">
              {formatTime(getSongDuration(playlist[currentIndex]))}
            </span>
          </div>

          {/* コントロールボタン */}
          <div className="player-controls">
            <button 
              className="control-btn"
              onClick={goToPrevSong}
              disabled={currentIndex === 0}
            >
              ⏮ 前の曲
            </button>
            <button 
              className="control-btn"
              onClick={togglePlayPause}
              disabled={!playlist.length}
            >
              {isPlaying ? '⏸ 一時停止' : '▶️ 再生'}
            </button>
            <button 
              className="control-btn"
              onClick={goToNextSong}
              disabled={currentIndex === playlist.length - 1}
            >
              次の曲 ⏭
            </button>
          </div>

          {/* プレイリスト表示 */}
          <div className="playlist-container">
            <h3>プレイリスト</h3>
            <div className="playlist">
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
          </div>
        </div>
      )}
    </div>
  )
}

export default ShuffleView
