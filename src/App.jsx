import { useState, useEffect } from 'react'
import './App.css'

const API_BASE = 'https://d34uks5q5372sl.cloudfront.net'

function App() {
  const [viewMode, setViewMode] = useState('list') // 'list' or 'random'
  const [movieType, setMovieType] = useState('all') // 'all', 'live', 'mv', 'streaming', 'other'
  const [singerType, setSingerType] = useState('all') // 'all', 'solo', 'unit'
  const [loading, setLoading] = useState(true)
  const [movies, setMovies] = useState([])
  const [songs, setSongs] = useState([])
  const [singerMap, setSingerMap] = useState({}) // singer_id -> name
  const [singerColors, setSingerColors] = useState({}) // singer_id -> color
  const [expandedCards, setExpandedCards] = useState(new Set())

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
        // moviesを取得
        const moviesResponse = await fetch(`${API_BASE}/movies.json`)
        const moviesData = await moviesResponse.json()
        // console.log('Fetched movies data:', moviesData)
        
        // moviesオブジェクトを配列に変換
        const moviesArray = Object.values(moviesData.movies)
        setMovies(moviesArray)
        
        // 全データを取得
        const allResponse = await fetch(`${API_BASE}/kanata/all.json`)
        const allData = await allResponse.json()
        setSongs(allData.songs)
        setSingerMap(allData.singers || allData.singer_map || {})
        // console.log('Fetched songs data:', allData.songs)

        // talentsから歌手情報を取得
        const talentsResponse = await fetch(`${API_BASE}/talents.json`)
        const talentsData = await talentsResponse.json()
        const map = talentsData.talents || talentsData.singers || talentsData.singer_map || talentsData
        if (map) {
          // 配列の場合は id -> name に整形
          if (Array.isArray(map)) {
            const m = {}
            const c = {}
            map.forEach(t => {
              if (t && t.id) {
                m[t.id] = t.name || t.name_jp || t.name_en || t.display_name || t.title
                if (t.color_b) {
                  c[t.id] = t.color_b
                }
              }
            })
            setSingerMap(m)
            setSingerColors(c)
          } else {
            setSingerMap(map)
          }
        }
      } catch (error) {
        console.error('データ取得エラー:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // movie_id から動画情報を取得
  const getMovieById = (movieId) => {
    return movies.find(m => m.id === movieId)
  }

  // 動画タイプを判定
  const getMovieType = (type) => {
    const lowerType = type.toLowerCase()
    if (lowerType.includes('live')) return 'live'
    if (lowerType.includes('mv')) return 'mv'
    if (lowerType.includes('streaming')) return 'streaming'
    return 'other'
  }

  // ソロ・ユニットを判定
  const getSingerType = (singerIds) => {
    // 複数の歌手がいればユニット、1人ならソロ
    return singerIds && singerIds.length > 1 ? 'unit' : 'solo'
  }

  const uniq = (arr = []) => Array.from(new Set(arr.filter(Boolean)))

  const resolveSingerNames = (singerIds = [], fallbackNames = [], info = null) => {
    const officialIds = (singerIds || []).filter(id => Number(id) < 9000)
    const official = officialIds.map(id => ({ 
      name: singerMap[id] || `ID: ${id}`, 
      color: singerColors[id] || null 
    }))

    // info から追加歌手名を抽出
    const infoNames = () => {
      if (!info) return []
      if (Array.isArray(info)) return info.filter(v => typeof v === 'string' && v.trim().length > 0).map(v => v.trim())
      if (typeof info === 'string') {
        // JSON文字列か単なる区切りテキストかを判定
        const trimmed = info.trim()
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            const parsed = JSON.parse(trimmed)
            if (Array.isArray(parsed)) {
              return parsed.filter(v => typeof v === 'string' && v.trim().length > 0).map(v => v.trim())
            }
            if (parsed && typeof parsed === 'object') {
              if (Array.isArray(parsed.singer)) {
                return parsed.singer.filter(v => typeof v === 'string' && v.trim().length > 0).map(v => v.trim())
              }
              if (Array.isArray(parsed.singers)) {
                return parsed.singers.filter(v => typeof v === 'string' && v.trim().length > 0).map(v => v.trim())
              }
              // singer/singersが無い空オブジェクト -> 空配列を返す
              return []
            }
          } catch (_) {
            // JSONパース失敗 -> 空配列を返す（{}などが文字列として扱われないようにする）
            return []
          }
        }
        // JSONでない通常の文字列は区切り文字で分割
        const parts = trimmed.split(/[、,&+\/]/).map(v => v.trim()).filter(v => v.length > 0)
        // ただし "{}" のような記号だけの場合は無視
        return parts.filter(v => !v.match(/^[{}[\]]+$/))
      }
      if (typeof info === 'object') {
        if (Array.isArray(info.singers)) {
          return info.singers.filter(v => typeof v === 'string' && v.trim().length > 0).map(v => v.trim())
        }
      }
      return []
    }

    const extras = infoNames().map(name => ({ name, color: null }))
    const fallback = (fallbackNames || []).map(name => ({ name, color: null }))
    const allSingers = [...official, ...fallback, ...extras]
    const result = uniq(allSingers.map(s => s.name))
      .map(name => allSingers.find(s => s.name === name))
    if (result.length > 0) return result
    return [{ name: '不明', color: null }]
  }

  const parseTimeToSeconds = (value) => {
    if (value == null) return null
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value))
    if (typeof value === 'string') {
      // support "mm:ss" or "hh:mm:ss"
      const parts = value.split(':').map(Number)
      if (parts.some(isNaN)) return null
      let sec = 0
      while (parts.length) {
        sec = sec * 60 + (parts.shift() || 0)
      }
      return Math.max(0, sec)
    }
    return null
  }

  const buildSongUrl = (videoId, song) => {
    const base = `https://www.youtube.com/watch?v=${videoId}`
    const startRaw = song.start ?? song.start_sec ?? song.start_time ?? song.time ?? song.offset
    const startSec = parseTimeToSeconds(startRaw)
    if (startSec == null) return base
    return `${base}&t=${startSec}s`
  }

  const isExpanded = (video) => {
    if (video.songCount <= 1) return true
    return expandedCards.has(video.id)
  }

  const toggleCard = (video) => {
    if (video.songCount <= 1) return
    setExpandedCards(prev => {
      const next = new Set(prev)
      if (next.has(video.id)) {
        next.delete(video.id)
      } else {
        next.add(video.id)
      }
      return next
    })
  }

  const expandAll = () => {
    const multiSongVideos = filteredVideos.filter(v => v.songCount > 1)
    setExpandedCards(new Set(multiSongVideos.map(v => v.id)))
  }

  const collapseAll = () => {
    setExpandedCards(new Set())
  }

  // 歌から動画カードを作成（movie_idごとにグループ化）
  const getGroupedMovies = () => {
    const movieMap = new Map()
    
    songs.forEach(song => {
      if (!movieMap.has(song.movie_id)) {
        const movie = getMovieById(song.movie_id)
        if (movie) {
          movieMap.set(song.movie_id, {
            id: movie.id,
            title: movie.title,
            url: `https://www.youtube.com/watch?v=${movie.video_id}`,
            video_id: movie.video_id,
            published_at: movie.publish,
            movie_type: getMovieType(movie.type),
            songs: [],
            songCount: 0
          })
        }
      }

      const entry = movieMap.get(song.movie_id)
      if (entry) {
        entry.songs.push({
          id: song.id,
          title: song.title,
          start: song.start_sec ?? song.start ?? song.start_time ?? song.time ?? song.offset,
          singers: resolveSingerNames(song.singer_ids, song.singers, song.info),
          singer_type: getSingerType(song.singer_ids)
        })
        entry.songCount = entry.songs.length
      }
    })

    return Array.from(movieMap.values()).sort((a, b) => 
      new Date(b.published_at) - new Date(a.published_at)
    )
  }

  const groupedMovies = getGroupedMovies()

  // フィルタリング
  const filteredVideos = groupedMovies.filter(m => {
    // 動画タイプでフィルタ
    if (movieType !== 'all' && m.movie_type !== movieType) {
      return false
    }
    // ソロ・ユニットでフィルタ: 動画内に該当する曲があるかチェック
    if (singerType !== 'all') {
      const hasMatchingSongs = m.songs.some(song => song.singer_type === singerType)
      if (!hasMatchingSongs) {
        return false
      }
    }
    return true
  }).map(m => {
    // singerTypeフィルタが適用されている場合、曲リストもフィルタ
    if (singerType !== 'all') {
      return {
        ...m,
        songs: m.songs.filter(song => song.singer_type === singerType),
        songCount: m.songs.filter(song => song.singer_type === singerType).length
      }
    }
    return m
  })

  // グラデーション設定を動的に変更
  useEffect(() => {
    const cardCount = filteredVideos.length
    let gradient
    if (cardCount < 6) {
      // 6:2:2 - ライトブルーを少し多めに
      gradient = 'linear-gradient(180deg, #9BCBDF 0%, #9BCBDF 60%, #0B01DF 80%, #060519 100%)'
    } else {
      // 1:4:3 - 通常のグラデーション
      gradient = 'linear-gradient(180deg, #9BCBDF 0%, #9BCBDF 25%, #0B01DF 65%, #060519 100%)'
    }
    document.body.style.background = gradient
  }, [filteredVideos])

  return (
    <div className="container">
      <header>
        <h1>天界学園 音楽資料室💫</h1>
        <p>ホロライブ4期生 天音かなたの3Dライブ・歌枠・MVまとめ</p>
      </header>

      {/* View Mode Selection */}
      <div className="view-mode-selector">
        <button 
          className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
          onClick={() => setViewMode('list')}
        >
          楽曲一覧
        </button>
        <button 
          className={`view-mode-btn ${viewMode === 'random' ? 'active' : ''}`}
          onClick={() => setViewMode('random')}
        >
          ランダム再生
        </button>
      </div>

      {/* Conditional Rendering Based on View Mode */}
      {viewMode === 'list' ? (
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
          <div className="expand-controls">
            <button className="expand-btn" onClick={expandAll}>
              すべて展開
            </button>
            <button className="expand-btn" onClick={collapseAll}>
              すべて閉じる
            </button>
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
      ) : (
        <div className="random-mode-placeholder">
          <p>ランダム再生機能は準備中です</p>
        </div>
      )}
    </div>
  )
}

export default App
