import React, { useEffect, useMemo, useRef, useState } from 'react'

function LazyThumbnail({ videoId, alt }) {
  const [shouldLoad, setShouldLoad] = useState(false)
  const imgRef = useRef(null)

  useEffect(() => {
    const target = imgRef.current
    if (!target) return

    if (typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting) {
          setShouldLoad(true)
          observer.disconnect()
        }
      },
      { rootMargin: '280px 0px' }
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={imgRef} className="video-thumb-image-wrap">
      {shouldLoad ? (
        <img
          src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
          alt={alt}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = 'https://via.placeholder.com/320x180?text=No+Image'
          }}
        />
      ) : (
        <div className="video-thumb-skeleton" aria-hidden="true" />
      )}
    </div>
  )
}

function ListView({
  loading,
  filteredVideos,
  movieType,
  singerType,
  setMovieType,
  setSingerType,
  expandAll,
  collapseAll,
  isExpanded,
  toggleCard,
  buildSongUrl,
  showFooter = true,
  songSearchQuery = '',
  setSongSearchQuery = () => {}
}) {
  const [displayMode, setDisplayMode] = useState('card')
  const [sortMode, setSortMode] = useState('date-desc')

  // 曲名検索によるフィルタリング
  const searchFilteredVideos = songSearchQuery.trim() === ''
    ? filteredVideos
    : filteredVideos.map(video => ({
        ...video,
        songs: video.songs.filter(song =>
          song.title.toLowerCase().includes(songSearchQuery.toLowerCase())
        )
      })).filter(video => video.songs.length > 0)

  const sortedVideos = useMemo(() => {
    const cloned = [...searchFilteredVideos]

    cloned.sort((a, b) => {
      if (sortMode === 'date-asc') {
        return new Date(a.published_at) - new Date(b.published_at)
      }
      if (sortMode === 'songs-desc') {
        if (b.songCount !== a.songCount) {
          return b.songCount - a.songCount
        }
        return new Date(b.published_at) - new Date(a.published_at)
      }
      if (sortMode === 'title-asc') {
        return a.title.localeCompare(b.title, 'ja')
      }
      return new Date(b.published_at) - new Date(a.published_at)
    })

    return cloned
  }, [searchFilteredVideos, sortMode])

  const tableRows = useMemo(() => {
    return sortedVideos.flatMap((video) =>
      (video.songs || []).map((song) => ({
        rowId: `${video.id}-${song.id}`,
        song,
        video,
      }))
    )
  }, [sortedVideos])

  return (
    <>
      {/* Filter Navigation - Two Axes */}
      <nav className="filter-nav">
        <div className="filter-group">
          <h3>動画タイプ</h3>
          <div className="filter-buttons">
            <button 
              className={`filter-btn ${movieType === 'all' ? 'active' : ''}`}
              onClick={() => setMovieType('all')}
            >
              すべて
            </button>
            <button 
              className={`filter-btn ${movieType === 'live' ? 'active' : ''}`}
              onClick={() => setMovieType('live')}
            >
              3D ライブ
            </button>
            <button 
              className={`filter-btn ${movieType === 'streaming' ? 'active' : ''}`}
              onClick={() => setMovieType('streaming')}
            >
              歌枠
            </button>
            <button 
              className={`filter-btn ${movieType === 'mv' ? 'active' : ''}`}
              onClick={() => setMovieType('mv')}
            >
              MV
            </button>
            <button 
              className={`filter-btn ${movieType === 'other' ? 'active' : ''}`}
              onClick={() => setMovieType('other')}
            >
              その他
            </button>
          </div>
        </div>

        <div className="filter-group">
          <h3>出演形式</h3>
          <div className="filter-buttons">
            <button 
              className={`filter-btn ${singerType === 'all' ? 'active' : ''}`}
              onClick={() => setSingerType('all')}
            >
              すべて
            </button>
            <button 
              className={`filter-btn ${singerType === 'solo' ? 'active' : ''}`}
              onClick={() => setSingerType('solo')}
            >
              ソロ
            </button>
            <button 
              className={`filter-btn ${singerType === 'unit' ? 'active' : ''}`}
              onClick={() => setSingerType('unit')}
            >
              コラボ
            </button>
          </div>
        </div>
      </nav>

      {/* Song Search */}
      <div className="song-search-container">
        <div className="song-search-inner">
          <input 
            type="text"
            placeholder="曲名で検索..."
            value={songSearchQuery}
            onChange={(e) => setSongSearchQuery(e.target.value)}
            className="song-search-input"
          />
          {songSearchQuery && (
            <button
              type="button"
              className="song-search-clear"
              onClick={() => setSongSearchQuery('')}
              aria-label="検索をクリア"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="list-toolbar">
        <div className="view-switch" role="tablist" aria-label="表示形式">
          <button
            type="button"
            className={`view-switch-btn ${displayMode === 'card' ? 'active' : ''}`}
            onClick={() => setDisplayMode('card')}
          >
            カード表示
          </button>
          <button
            type="button"
            className={`view-switch-btn ${displayMode === 'table' ? 'active' : ''}`}
            onClick={() => setDisplayMode('table')}
          >
            表形式
          </button>
        </div>

        <label className="sort-select-wrap">
          <span>並び順</span>
          <select
            className="sort-select"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
          >
            <option value="date-desc">新しい動画順</option>
            <option value="date-asc">古い動画順</option>
            <option value="songs-desc">収録曲が多い順</option>
            <option value="title-asc">動画タイトル順</option>
          </select>
        </label>
      </div>

      {/* Expand/Collapse All Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1.5rem', position: 'relative' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="expand-btn" onClick={expandAll}>
            すべて展開
          </button>
          <button className="expand-btn" onClick={collapseAll}>
            すべて閉じる
          </button>
        </div>
        
        {/* Info Tooltip - positioned absolutely to the right */}
        <div className="info-icon" style={{ marginLeft: '1rem', position: 'absolute', right: 0 }}>?
          <div className="info-tooltip">
            <strong>このページのリンクについて</strong>
            <ul>
              <li><strong>サムネイル・動画タイトル:</strong><br />YouTube動画へのリンク</li>
              <li><strong>曲名:</strong><br />その曲の開始位置へのリンク</li>
            </ul>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : displayMode === 'table' ? (
        <div className="songs-table-wrap">
          <table className="songs-table">
            <thead>
              <tr>
                <th>曲名</th>
                <th>歌手</th>
                <th>動画</th>
                <th>動画タイプ</th>
                <th>公開日</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map(({ rowId, song, video }) => (
                <tr key={rowId}>
                  <td>
                    <a href={buildSongUrl(video.video_id, song)} target="_blank" rel="noopener noreferrer">
                      {song.title}
                    </a>
                  </td>
                  <td>
                    <div className="table-singers">
                      {song.singers?.map((singer, idx) => (
                        <span
                          key={`${rowId}-${idx}`}
                          className="singer-tag"
                          style={singer.color ? { backgroundColor: singer.color } : {}}
                        >
                          {singer.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <a href={video.url} target="_blank" rel="noopener noreferrer">
                      {video.title}
                    </a>
                  </td>
                  <td>{video.movie_type}</td>
                  <td>{video.published_at?.split('T')[0] || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="video-grid">
            {sortedVideos.map(video => {
              const expanded = isExpanded(video)
              return (
                <div 
                  key={video.id} 
                  className={`video-card ${expanded ? 'expanded' : 'collapsed'}`}
                >
                  <a className="video-thumb" href={video.url} target="_blank" rel="noopener noreferrer">
                    <LazyThumbnail videoId={video.video_id} alt={video.title} />
                  </a>
                  <div className="video-info">
                    <div 
                      className="video-header"
                      onClick={() => toggleCard(video)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          toggleCard(video)
                        }
                      }}
                    >
                      <h3>
                        <a href={video.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                          {video.title}
                        </a>
                      </h3>
                      <p className="video-date">{video.published_at?.split('T')[0]}</p>
                      <p className="video-songs">{video.songCount} 曲</p>
                    </div>
                    <div className="song-area">
                      {video.songCount > 1 && !expanded && (
                        <div className="song-placeholder" aria-hidden="true" />
                      )}
                      {expanded && video.songs && video.songs.length > 0 && (
                        <div className="song-list">
                          {video.songs.map(song => (
                            <div key={song.id} className="song-item">
                              <div className="song-title">
                                <a 
                                  href={buildSongUrl(video.video_id, song)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {song.title}
                                </a>
                              </div>
                              <div className="song-singers">
                                {song.singers?.map((singer, idx) => (
                                  <span 
                                    key={idx} 
                                    className="singer-tag"
                                    style={singer.color ? { backgroundColor: singer.color } : {}}
                                  >
                                    {singer.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {video.songCount > 1 && (
                      <div 
                        className="song-toggle"
                        onClick={() => toggleCard(video)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggleCard(video)
                          }
                        }}
                      >
                        {expanded ? '楽曲情報を閉じる' : `${video.songCount}曲の楽曲情報を表示`}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <footer className="copyright-notice" style={{ display: showFooter ? 'block' : 'none' }}>
            <h2>このサイトについて</h2>
            <p>
              このサイトは <strong>ホロライブ</strong> 所属の 
              <strong>天音かなた</strong> の 3Dライブ・歌枠・MVなどの動画から歌唱部分をまとめた非公式のファンサイトです。
            </p>
            <p>
              掲載されている動画、楽曲等のすべてのコンテンツは、
              それぞれの著作権者に帰属しています。
            </p>
            <p>
              本サイトは営利目的ではなく、天音かなたの歌活動の情報提供を目的としています。
            </p>
            <p>
              本サイトはYouTubeの動画をリンク形式で紹介しており、
              曲名・動画リンク・再生位置などのメタデータのみで機能実現しています。
            </p>
            <p>
              メタデータはすべて人力で作成しており、YouTubeへのスクレイピングや動画データの保存は一切行っていません。
            </p>
            <p>
              <a href="https://twitter.com/act_q" target="_blank" rel="noopener noreferrer">
                連絡先 ( Twitter: @act_Q )
              </a>
            </p>
          </footer>
        </>
      )}
    </>
  )
}

export default ListView
