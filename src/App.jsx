import { useState, useEffect, useRef } from 'react'
import ListView from './components/ListView'
import ShuffleView from './components/ShuffleView'
import './App.css'

// Allow overriding API base per environment (dev:local uses /dev)
const API_BASE = import.meta.env.VITE_API_BASE || 'https://d34uks5q5372sl.cloudfront.net'

function App() {
  const [viewMode, setViewMode] = useState(() => {
    const hash = (window.location.hash || '').toLowerCase()
    if (hash.includes('list')) return 'list'
    return 'random'
  }) // 'list' or 'random'
  const [movieType, setMovieType] = useState('all') // 'all', 'live', 'mv', 'streaming', 'other'
  const [singerType, setSingerType] = useState('all') // 'all', 'solo', 'unit'
  const [songSearchQuery, setSongSearchQuery] = useState('') // 曲名検索
  const [loading, setLoading] = useState(true)
  const [movies, setMovies] = useState([])
  const [songs, setSongs] = useState([])
  const [singerMap, setSingerMap] = useState({}) // singer_id -> name
  const [singerColors, setSingerColors] = useState({}) // singer_id -> color
  const [expandedCards, setExpandedCards] = useState(new Set())

  // シャッフル再生用の状態
  const [shuffleMovieTypes, setShuffleMovieTypes] = useState(new Set(['live', 'mv', 'streaming', 'other']))
  const [shuffleSingerTypes, setShuffleSingerTypes] = useState(new Set(['solo', 'unit']))
  const [playlist, setPlaylist] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playerDuration, setPlayerDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const playAttemptRef = useRef(0)
  const playerRef = useRef(null)
  const lastLoadedVideoIdRef = useRef(null)

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

  // シャッフル再生用: フィルタリングされた全楽曲を取得
  const getFilteredSongsForShuffle = () => {
    const allSongs = []
    
    songs.forEach(song => {
      const movie = getMovieById(song.movie_id)
      if (!movie) return

      const movieTypeValue = getMovieType(movie.type)
      const singerTypeValue = getSingerType(song.singer_ids)

      // フィルタ条件チェック
      if (!shuffleMovieTypes.has(movieTypeValue)) return
      if (!shuffleSingerTypes.has(singerTypeValue)) return

      allSongs.push({
        id: song.id,
        title: song.title,
        video_id: movie.video_id,
        video_title: movie.title,
        start: parseTimeToSeconds(song.start_sec ?? song.start ?? song.start_time ?? song.time ?? song.offset) || 0,
        end: parseTimeToSeconds(song.end_sec ?? song.end ?? song.end_time) || null,
        singers: resolveSingerNames(song.singer_ids, song.singers, song.info),
        movie_type: movieTypeValue,
        singer_type: singerTypeValue
      })
    })

    return allSongs
  }

  // 配列をシャッフル
  const shuffleArray = (array) => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  // プレイリストを生成（シャッフル）
  const generatePlaylist = () => {
    const filteredSongs = getFilteredSongsForShuffle()
    if (filteredSongs.length === 0) {
      setPlaylist([])
      setCurrentIndex(0)
      setPlayerDuration(0)
      setCurrentTime(0)
      return
    }
    const shuffled = shuffleArray(filteredSongs)
    // const shuffled = filteredSongs // デバッグ用。
    setPlaylist(shuffled)
    setCurrentIndex(0)
    setCurrentTime(0)
    setPlayerDuration(0)
  }

  // シャッフル再生モードに切り替えたときはプレイリストをクリア
  useEffect(() => {
    if (viewMode === 'random') {
      setPlaylist([])
      setCurrentIndex(0)
      setCurrentTime(0)
      setPlayerDuration(0)
      playerRef.current = null
      lastLoadedVideoIdRef.current = null
    }
  }, [viewMode])

  // 次の曲へ
  const goToNextSong = () => {
    if (currentIndex < playlist.length - 1) {
      setCurrentIndex(prev => prev + 1)
      setCurrentTime(0)
      setPlayerDuration(0)
    }
  }

  // 前の曲へ
  const goToPrevSong = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
      setCurrentTime(0)
      setPlayerDuration(0)
    }
  }

  // 特定の曲へジャンプ
  const goToSong = (index) => {
    if (index >= 0 && index < playlist.length) {
      setCurrentIndex(index)
      setCurrentTime(0)
      setPlayerDuration(0)
    }
  }

  // YouTubeプレーヤーの準備完了時
  const onPlayerReady = (event) => {
    const currentSong = playlist[currentIndex]
    if (!currentSong) return
    
    // console.log(`📢 [onPlayerReady] Called for song at index ${currentIndex}`)
    
    // alert("ready");
    // iframe が DOM に接続されているか確認し、別動画のイベントは無視
    const iframe = event?.target?.getIframe?.()
    if (!iframe || !iframe.isConnected){
      // console.log(`   ❌ Rejected: iframe not connected`)
      // alert("iframe");
      return
    } 
    const data = event?.target?.getVideoData?.()
    // console.log(`   Video data:`, data?.video_id, `Expected:`, currentSong.video_id)
    if (data && data.video_id && data.video_id !== currentSong.video_id){
      // console.log(`   ❌ Rejected: video_id mismatch`)
      // alert("data");
      return
    } 
    // console.log(`   ✅ Accepted: Setting up player`)
    playerRef.current = event.target
    // ShuffleView用にグローバル参照も設定
    window.__shuffleViewPlayerRef = playerRef
    
    // 初回読み込み時の動画IDを記録
    if (data?.video_id) {
      lastLoadedVideoIdRef.current = data.video_id
    }
    
    if (typeof event.target.getDuration === 'function') {
      const dur = event.target.getDuration()
      if (Number.isFinite(dur)) setPlayerDuration(dur)
    }
    if (currentSong.start > 0) {
      // console.log(`🎯 [onPlayerReady] Seeking to ${currentSong.start}s`)
      event.target.seekTo(currentSong.start, true)
    }
    // //再生状態を取得
    // const playerState = event.data
    // //再生状態でない場合は再生する
    // if (playerState !== window.YT?.PlayerState?.PLAYING) {
    //   if (typeof event.target.playVideo === 'function') {
    //     event.target.playVideo()
    //     alert("play");
    //     setIsPlaying(true)
    //   }
    // }
  }

  // YouTubeプレーヤーの状態変化時
  const onPlayerStateChange = (event) => {
    const currentSong = playlist[currentIndex]
    if (!currentSong) return

    // 別動画からのイベントは無視
    const data = event?.target?.getVideoData?.()
    if (data && data.video_id && data.video_id !== currentSong.video_id) return

    const playerState = event.data
    if (playerState === window.YT?.PlayerState?.PLAYING) {
      setIsPlaying(true)
    } else if (playerState === window.YT?.PlayerState?.PAUSED) {
      setIsPlaying(false)
    // } else if (playerState === window.YT?.PlayerState?.ENDED) { // 別のところで終了時刻チェックしているので不要
    //   setIsPlaying(false)
    //   goToNextSong()
    } else if (playerState === window.YT?.PlayerState?.CUED) {
      // CUED は待機状態なので再生待ちへ
      setIsPlaying(false)
    } else if (playerState === window.YT?.PlayerState?.BUFFERING) {
      // BUFFERING 中にplayがブロックされているケースがあるので、様子見
    }
  }

  // 再生/一時停止を切り替え
  const togglePlayPause = () => {
    if (!playerRef.current) return
    
    if (isPlaying) {
      if (typeof playerRef.current.pauseVideo === 'function') {
        playerRef.current.pauseVideo()
        setIsPlaying(false)
      }
    } else {
      if (typeof playerRef.current.playVideo === 'function') {
        playAttemptRef.current += 1
        const attemptId = playAttemptRef.current
        playerRef.current.playVideo()
        // 300ms 後に PLAYING へ遷移しなければ再生されていないとみなす
        setTimeout(() => {
          if (playAttemptRef.current === attemptId && playerRef.current) {
            const state = playerRef.current.getPlayerState?.()
            if (state !== window.YT?.PlayerState?.PLAYING) {
              setIsPlaying(false)
            }
          }
        }, 300)
        setIsPlaying(true)
      }
    }
  }

  // 曲が切り替わるたびに既存プレイヤーで動画を読み替える
  useEffect(() => {
    if (viewMode !== 'random') return
    const player = playerRef.current
    const song = playlist[currentIndex]
    if (!player || !song) return

    const iframe = player.getIframe?.()
    if (!iframe || !iframe.isConnected) {
      // プレイヤーが既に破棄/未接続なら処理しない
      playerRef.current = null
      return
    }

    // 現在再生中の動画IDを取得（getVideoDataが使えない場合は前回読み込んだIDを使用）
    let currentVideoId = lastLoadedVideoIdRef.current
    if (typeof player.getVideoData === 'function') {
      const currentVideoData = player.getVideoData()
      if (currentVideoData && currentVideoData.video_id) {
        currentVideoId = currentVideoData.video_id
      }
    }
    
    // console.log(`currentVideoId: ${currentVideoId}, song.video_id: ${song.video_id}`)

    // 常にloadVideoByIdを使用して確実に指定位置から再生
    if (typeof player.loadVideoById === 'function') {
      // console.log(`🎯 [useEffect-trackChange] Loading video ${song.video_id} at ${song.start || 0}s`)
      player.loadVideoById({
        videoId: song.video_id,
        startSeconds: song.start || 0,
      })
      lastLoadedVideoIdRef.current = song.video_id
      setIsPlaying(false)
      setCurrentTime(song.start || 0)
      setPlayerDuration(0)
      // console.log(`✓ Loaded video ${song.video_id} at ${song.start || 0}s`)
      
      // ロード直後の実際の位置を確認
      // setTimeout(() => {
      //   if (typeof player.getCurrentTime === 'function') {
      //     const actualTime = player.getCurrentTime()
      //     console.log(`   ⏱️ Actual position after load: ${actualTime}s (expected: ${song.start || 0}s)`)
      //   }
      // }, 500)
    }
  }, [currentIndex, viewMode, playlist])

  // 再生時刻の更新（定期的に呼び出す）
  useEffect(() => {
    if (viewMode !== 'random' || playlist.length === 0) return

    const interval = setInterval(() => {
      const player = playerRef.current
      if (!player) return

      if (typeof player.getCurrentTime === 'function') {
        const time = player.getCurrentTime()
        setCurrentTime(time)

        // 終了時刻チェック
        const currentSong = playlist[currentIndex]
        if (currentSong && currentSong.end && time >= currentSong.end) {
          // console.log(`🔚 Song ended at ${time}s (end: ${currentSong.end}s)`)
          // console.log(`   Current player state:`, player.getPlayerState?.())
          // console.log(`   getVideoData available:`, typeof player.getVideoData === 'function')
          // if (typeof player.getVideoData === 'function') {
          //   console.log(`   getVideoData result:`, player.getVideoData())
          // }
          setIsPlaying(false)
          goToNextSong()
        }
      }

      if (typeof player.getDuration === 'function') {
        const dur = player.getDuration()
        if (Number.isFinite(dur)) {
          setPlayerDuration(dur)
        }
      }
    }, 200)

    return () => clearInterval(interval)
  }, [viewMode, currentIndex, playlist])

  // プレイヤー破棄: プレイリストが空になったら古いプレイヤー参照を破棄
  useEffect(() => {
    if (viewMode !== 'random') return
    if (playlist.length === 0 && playerRef.current) {
      try {
        const iframe = playerRef.current.getIframe?.()
        if (iframe && iframe.isConnected && typeof playerRef.current.destroy === 'function') {
          playerRef.current.destroy()
        }
      } catch (_) {
        // noop
      }
      playerRef.current = null
    }
  }, [viewMode, playlist.length])

  // シャッフル再生用フィルタのトグル
  const toggleShuffleMovieType = (type) => {
    setShuffleMovieTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  const toggleShuffleSingerType = (type) => {
    setShuffleSingerTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  // 時間をフォーマット（秒 -> mm:ss）
  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // 曲の長さを取得
  const getSongDuration = (song) => {
    if (!song) return 0
    const start = song.start || 0

    if (song.end && Number.isFinite(song.end) && song.end > start) {
      return song.end - start
    }

    // YouTubeプレイヤーの動画尺をフォールバックに使用
    if (Number.isFinite(playerDuration) && playerDuration > 0) {
      const adjusted = playerDuration - start
      if (adjusted > 0) return adjusted
      return playerDuration
    }

    return 0
  }

  // 曲の再生進捗（0-100%）
  const getSongProgress = (song, now) => {
    if (!song || !Number.isFinite(now)) return 0
    const duration = getSongDuration(song)
    if (!duration) return 0
    const elapsed = Math.max(0, now - (song.start || 0))
    return Math.max(0, Math.min(100, (elapsed / duration) * 100))
  }

  // 表示するプレイリスト（前5曲、現在、次5曲）
  const getVisiblePlaylist = () => {
    if (playlist.length === 0) return []
    
    const visible = []
    const startIdx = Math.max(0, currentIndex - 5)
    const endIdx = Math.min(playlist.length - 1, currentIndex + 5)
    
    if (startIdx > 0) {
      visible.push({ type: 'separator', globalIndex: -1 })
    }

    for (let i = startIdx; i <= endIdx; i++) {
      visible.push({ 
        type: 'song', 
        song: playlist[i], 
        globalIndex: i 
      })
    }

    if (endIdx < playlist.length - 1) {
      visible.push({ type: 'separator', globalIndex: -2 })
    }

    return visible
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

  // Route sync (hash-based): #/shuffle (default) and #/list
  useEffect(() => {
    const applyHash = () => {
      const hash = (window.location.hash || '').toLowerCase()
      if (hash.includes('list')) {
        setViewMode('list')
      } else if (hash.includes('shuffle') || hash.includes('random')) {
        setViewMode('random')
      }
      // / でアクセスした場合はハッシュを変更しない（shuffleをデフォルト表示）
    }

    applyHash()

    const onHashChange = () => applyHash()
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    // viewModeがlistに変わった場合は常にハッシュを更新
    if (viewMode === 'list') {
      if (window.location.hash !== '#/list') {
        window.history.replaceState(null, '', '#/list')
      }
      return
    }
    
    // viewModeがrandomの場合、既にハッシュがある場合のみ更新（/からの場合は維持）
    if (window.location.hash && window.location.hash !== '#/shuffle') {
      window.history.replaceState(null, '', '#/shuffle')
    }
  }, [viewMode])

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
          className={`view-mode-btn ${viewMode === 'random' ? 'active' : ''}`}
          onClick={() => setViewMode('random')}
        >
          シャッフル再生
        </button>
        <button 
          className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
          onClick={() => setViewMode('list')}
        >
          楽曲一覧
        </button>
      </div>

      {/* Conditional Rendering Based on View Mode */}
      {viewMode === 'list' ? (
        <ListView
          loading={loading}
          filteredVideos={filteredVideos}
          movieType={movieType}
          singerType={singerType}
          setMovieType={setMovieType}
          setSingerType={setSingerType}
          expandAll={expandAll}
          collapseAll={collapseAll}
          isExpanded={isExpanded}
          toggleCard={toggleCard}
          buildSongUrl={buildSongUrl}
          songSearchQuery={songSearchQuery}
          setSongSearchQuery={setSongSearchQuery}
          showFooter={false}
        />
      ) : (
        <ShuffleView
          loading={loading}
          playlist={playlist}
          currentIndex={currentIndex}
          currentTime={currentTime}
          isPlaying={isPlaying}
          shuffleMovieTypes={shuffleMovieTypes}
          shuffleSingerTypes={shuffleSingerTypes}
          toggleShuffleMovieType={toggleShuffleMovieType}
          toggleShuffleSingerType={toggleShuffleSingerType}
          generatePlaylist={generatePlaylist}
          goToPrevSong={goToPrevSong}
          goToNextSong={goToNextSong}
          goToSong={goToSong}
          togglePlayPause={togglePlayPause}
          onPlayerReady={onPlayerReady}
          onPlayerStateChange={onPlayerStateChange}
          formatTime={formatTime}
          getSongDuration={getSongDuration}
          getSongProgress={getSongProgress}
          getVisiblePlaylist={getVisiblePlaylist}
        />
      )}

      {/* Common Footer */}
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
    </div>
  )
}

export default App
