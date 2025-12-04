import { useState } from 'react'
import './App.css'

function App() {
  const [filter, setFilter] = useState('all')

  // サンプルデータ - 後で実際のデータに置き換え
  const videos = [
    {
      id: 1,
      title: '3D Live サンプル',
      type: '3dlive',
      url: 'https://www.youtube.com/watch?v=example1',
      thumbnail: 'https://via.placeholder.com/320x180',
      date: '2024-01-01'
    },
    {
      id: 2,
      title: '歌枠 サンプル',
      type: 'utawaku',
      url: 'https://www.youtube.com/watch?v=example2',
      thumbnail: 'https://via.placeholder.com/320x180',
      date: '2024-02-01'
    },
    {
      id: 3,
      title: 'MV サンプル',
      type: 'mv',
      url: 'https://www.youtube.com/watch?v=example3',
      thumbnail: 'https://via.placeholder.com/320x180',
      date: '2024-03-01'
    }
  ]

  const filteredVideos = filter === 'all' 
    ? videos 
    : videos.filter(v => v.type === filter)

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
          すべて
        </button>
        <button 
          className={filter === '3dlive' ? 'active' : ''} 
          onClick={() => setFilter('3dlive')}
        >
          3D Live
        </button>
        <button 
          className={filter === 'utawaku' ? 'active' : ''} 
          onClick={() => setFilter('utawaku')}
        >
          歌枠
        </button>
        <button 
          className={filter === 'mv' ? 'active' : ''} 
          onClick={() => setFilter('mv')}
        >
          MV
        </button>
      </nav>

      <div className="video-grid">
        {filteredVideos.map(video => (
          <div key={video.id} className="video-card">
            <a href={video.url} target="_blank" rel="noopener noreferrer">
              <img src={video.thumbnail} alt={video.title} />
              <div className="video-info">
                <h3>{video.title}</h3>
                <p className="video-date">{video.date}</p>
              </div>
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
