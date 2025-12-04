import { useState, useEffect } from 'react'
import './App.css'

const API_BASE = 'https://d34uks5q5372sl.cloudfront.net'

function App() {
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [movies, setMovies] = useState([])
  const [songs, setSongs] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
        // moviesを取得
        const moviesResponse = await fetch(`${API_BASE}/movies.json`)
        const moviesData = await moviesResponse.json()
        
        // moviesオブジェクトを配列に変換
        const moviesArray = Object.values(moviesData.movies)
        setMovies(moviesArray)
        
        // 全データを取得
        const allResponse = await fetch(`${API_BASE}/kanata/all.json`)
        const allData = await allResponse.json()
        setSongs(allData.songs)
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
            movie_type: movie.type.toLowerCase().includes('live') ? 'live' : 
                        movie.type.toLowerCase().includes('mv') ? 'mv' : 
                        movie.type.toLowerCase().includes('sing') ? 'streaming' : 'other',
            singer_type: 'solo', // 仮: すべてsoloとして扱う（後で改善可能）
            songCount: 1
          })
        }
      } else {
        const existing = movieMap.get(song.movie_id)
        existing.songCount++
      }
    })

    return Array.from(movieMap.values()).sort((a, b) => 
      new Date(b.published_at) - new Date(a.published_at)
    )
  }

  const groupedMovies = getGroupedMovies()

  const filteredVideos = filter === 'all' 
    ? groupedMovies 
    : groupedMovies.filter(m => {
        if (filter === 'live-solo') return m.movie_type === 'live'
        if (filter === 'live-unit') return m.movie_type === 'live'
        if (filter === 'mv-solo') return m.movie_type === 'mv'
        if (filter === 'mv-unit') return m.movie_type === 'mv'
        if (filter === 'streaming-solo') return m.movie_type === 'streaming'
        if (filter === 'streaming-unit') return m.movie_type === 'streaming'
        return true
      })

  return (
    <div className="container">
      <header>
        <h1>🎵 天音かなた 歌アーカイブ</h1>
        <p>ホロライブ4期生 天音かなたの3D Live・歌枠・MVまとめ</p>
      </header>

      <nav className="filter-nav">
        <button 
          className={filter === 'all' ? 'active' : ''} 
          onClick={() => setFilter('all')}
        >
          すべて ({groupedMovies.length})
        </button>
        <button 
          className={filter === 'live-solo' ? 'active' : ''} 
          onClick={() => setFilter('live-solo')}
        >
          Live (Solo)
        </button>
        <button 
          className={filter === 'live-unit' ? 'active' : ''} 
          onClick={() => setFilter('live-unit')}
        >
          Live (Unit)
        </button>
        <button 
          className={filter === 'mv-solo' ? 'active' : ''} 
          onClick={() => setFilter('mv-solo')}
        >
          MV (Solo)
        </button>
        <button 
          className={filter === 'mv-unit' ? 'active' : ''} 
          onClick={() => setFilter('mv-unit')}
        >
          MV (Unit)
        </button>
        <button 
          className={filter === 'streaming-solo' ? 'active' : ''} 
          onClick={() => setFilter('streaming-solo')}
        >
          歌枠 (Solo)
        </button>
        <button 
          className={filter === 'streaming-unit' ? 'active' : ''} 
          onClick={() => setFilter('streaming-unit')}
        >
          歌枠 (Unit)
        </button>
      </nav>

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : (
        <div className="video-grid">
          {filteredVideos.map(video => (
            <div key={video.id} className="video-card">
              <a href={video.url} target="_blank" rel="noopener noreferrer">
                <img 
                  src={`https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`} 
                  alt={video.title} 
                  onError={(e) => e.target.src = 'https://via.placeholder.com/320x180?text=No+Image'}
                />
                <div className="video-info">
                  <h3>{video.title}</h3>
                  <p className="video-date">{video.published_at?.split('T')[0]}</p>
                  <p className="video-songs">{video.songCount} 曲</p>
                </div>
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default App
