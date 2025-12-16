import React from 'react'

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
  buildSongUrl
}) {
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
      ) : (
        <>
          <div className="video-grid">
            {filteredVideos.map(video => {
              const expanded = isExpanded(video)
              return (
                <div 
                  key={video.id} 
                  className={`video-card ${expanded ? 'expanded' : 'collapsed'}`}
                >
                  <a className="video-thumb" href={video.url} target="_blank" rel="noopener noreferrer">
                    <img 
                      src={`https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`} 
                      alt={video.title} 
                      onError={(e) => e.target.src = 'https://via.placeholder.com/320x180?text=No+Image'}
                    />
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

          <footer className="copyright-notice">
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
