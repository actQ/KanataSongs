import { useEffect, useRef } from 'react'
import { loadYouTubeIframeApi } from '../utils/youtube'

const ENDPOINT_EPSILON_SECONDS = 0.2
const IOS_SOFT_VIDEO_END_PADDING_SECONDS = 0.35

function buildSourceKey(source) {
  return [
    source.videoId || '',
    toSeconds(source.startSeconds),
    typeof source.endSeconds === 'number' ? toSeconds(source.endSeconds) : 'end',
  ].join(':')
}

function mapPlayerState(state) {
  const mapping = {
    '-1': 'unstarted',
    0: 'ended',
    1: 'playing',
    2: 'paused',
    3: 'buffering',
    5: 'cued',
  }
  return mapping[state] || 'unstarted'
}

function toSeconds(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0
}

function toOptionalVolume(value) {
  if (value === undefined || value === null || value === '') {
    return null
  }
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return null
  }
  return Math.max(0, Math.min(100, numeric))
}

function isIPhoneDevice() {
  if (typeof navigator === 'undefined') {
    return false
  }
  const ua = navigator.userAgent || ''
  return /iPhone|iPod/i.test(ua)
}

export default function YouTubePlayer({
  source,
  isPlaying,
  volume,
  seekRequest,
  onReady,
  onStateChange,
  onTimeUpdate,
  onReachEndPoint,
  onFullscreenChange,
  onError,
}) {
  const SOURCE_SWITCH_GUARD_MS = 800
  const hostRef = useRef(null)
  const playerRef = useRef(null)
  const mountedRef = useRef(false)
  const lastSourceKeyRef = useRef('')
  const lastSeekIdRef = useRef(-1)
  const endEventSentRef = useRef(false)
  const pollingTimerRef = useRef(null)
  const sourceSwitchGuardUntilRef = useRef(0)
  const pendingResumeAfterSwitchRef = useRef(false)
  const resumeAttemptsLeftRef = useRef(0)
  const resumeTimerRef = useRef(null)
  const isIPhoneRef = useRef(isIPhoneDevice())
  const isPlayingRef = useRef(isPlaying)
  const sourceRef = useRef(source)
  const callbacksRef = useRef({
    onReady,
    onStateChange,
    onTimeUpdate,
    onReachEndPoint,
    onFullscreenChange,
    onError,
  })

  useEffect(() => {
    isIPhoneRef.current = isIPhoneDevice()
    sourceRef.current = source
  }, [source])

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  useEffect(() => {
    callbacksRef.current = {
      onReady,
      onStateChange,
      onTimeUpdate,
      onReachEndPoint,
      onFullscreenChange,
      onError,
    }
  }, [onError, onFullscreenChange, onReachEndPoint, onReady, onStateChange, onTimeUpdate])

  useEffect(() => {
    mountedRef.current = true

    function clearResumeTimer() {
      if (resumeTimerRef.current) {
        window.clearTimeout(resumeTimerRef.current)
        resumeTimerRef.current = null
      }
    }

    function scheduleResumeTry(player) {
      if (!pendingResumeAfterSwitchRef.current) {
        clearResumeTimer()
        return
      }
      if (resumeAttemptsLeftRef.current <= 0) {
        clearResumeTimer()
        return
      }

      clearResumeTimer()
      resumeTimerRef.current = window.setTimeout(() => {
        if (!mountedRef.current || !playerRef.current) {
          return
        }
        resumeAttemptsLeftRef.current -= 1
        player.playVideo()
        scheduleResumeTry(player)
      }, 180)
    }

    function handleFullscreenEvent() {
      callbacksRef.current.onFullscreenChange(Boolean(document.fullscreenElement))
    }

    document.addEventListener('fullscreenchange', handleFullscreenEvent)

    loadYouTubeIframeApi()
      .then((YT) => {
        if (!mountedRef.current || playerRef.current || !hostRef.current) {
          return
        }

        const initialStart = toSeconds(source.startSeconds)
        const playerVars = {
          autoplay: 0,
          controls: 1,
          rel: 0,
          playsinline: 1,
          start: initialStart,
        }
        if (typeof source.endSeconds === 'number') {
          playerVars.end = toSeconds(source.endSeconds)
        }

        playerRef.current = new YT.Player(hostRef.current, {
          videoId: source.videoId,
          playerVars,
          events: {
            onReady: () => {
              const player = playerRef.current
              if (!player) {
                return
              }
              const initialVolume = toOptionalVolume(volume)
              if (initialVolume !== null) {
                player.setVolume(initialVolume)
              }
              lastSourceKeyRef.current = buildSourceKey(sourceRef.current)
              callbacksRef.current.onReady({
                playerAvailable: true,
                videoId: sourceRef.current.videoId,
              })

              // 初回マウント時も「再生開始」意図を維持して、cued/paused遷移で止まらないようにする
              if (isPlayingRef.current) {
                pendingResumeAfterSwitchRef.current = true
                resumeAttemptsLeftRef.current = 8
                player.playVideo()
                scheduleResumeTry(player)
              }
            },
            onStateChange: (event) => {
              const player = playerRef.current
              if (!player) {
                return
              }
              const currentSource = sourceRef.current
              const state = mapPlayerState(event.data)
              const currentTime = player.getCurrentTime() || 0

              const isTransientSwitchState =
                pendingResumeAfterSwitchRef.current &&
                (state === 'unstarted' || state === 'cued' || state === 'paused')

              if (!isTransientSwitchState) {
                callbacksRef.current.onStateChange({
                  videoId: currentSource.videoId,
                  state,
                  currentTime,
                })
              }

              if (pendingResumeAfterSwitchRef.current && state !== 'playing') {
                if (state === 'unstarted' || state === 'cued' || state === 'paused') {
                  player.playVideo()
                  scheduleResumeTry(player)
                }
              }

              if (state === 'ended' && !endEventSentRef.current) {
                if (Date.now() < sourceSwitchGuardUntilRef.current) {
                  return
                }
                endEventSentRef.current = true
                callbacksRef.current.onReachEndPoint({
                  videoId: currentSource.videoId,
                  currentTime,
                  endSeconds: currentSource.endSeconds,
                  reason: 'video-ended',
                  shouldAutoAdvance: true,
                })
              }
              if (state === 'playing') {
                endEventSentRef.current = false
                pendingResumeAfterSwitchRef.current = false
                resumeAttemptsLeftRef.current = 0
                clearResumeTimer()
              }
            },
            onError: (event) => {
              callbacksRef.current.onError({
                videoId: sourceRef.current.videoId || null,
                code: String(event.data),
                message: '動画の読み込みに失敗しました。',
              })
            },
          },
        })
      })
      .catch(() => {
        callbacksRef.current.onError({
          videoId: sourceRef.current.videoId || null,
          code: 'api-load-failed',
          message: 'YouTube APIの読み込みに失敗しました。',
        })
      })

    return () => {
      mountedRef.current = false
      document.removeEventListener('fullscreenchange', handleFullscreenEvent)
      if (resumeTimerRef.current) {
        window.clearTimeout(resumeTimerRef.current)
      }
      if (pollingTimerRef.current) {
        window.clearInterval(pollingTimerRef.current)
      }
      if (playerRef.current?.destroy) {
        playerRef.current.destroy()
      }
    }
  }, [])

  useEffect(() => {
    if (pollingTimerRef.current) {
      window.clearInterval(pollingTimerRef.current)
    }

    pollingTimerRef.current = window.setInterval(() => {
      const player = playerRef.current
      if (!player || typeof player.getCurrentTime !== 'function') {
        return
      }
      const time = player.getCurrentTime() || 0
      const total = player.getDuration() || 0
      const currentSource = sourceRef.current
      const playerState =
        typeof player.getPlayerState === 'function' ? player.getPlayerState() : -1

      callbacksRef.current.onTimeUpdate({
        videoId: currentSource.videoId,
        currentTime: time,
        duration: total,
      })

      if (
        Date.now() >= sourceSwitchGuardUntilRef.current &&
        playerState === 1 &&
        typeof currentSource.endSeconds === 'number' &&
        !endEventSentRef.current &&
        time >= currentSource.endSeconds - ENDPOINT_EPSILON_SECONDS
      ) {
        endEventSentRef.current = true
        callbacksRef.current.onReachEndPoint({
          videoId: currentSource.videoId,
          currentTime: time,
          endSeconds: currentSource.endSeconds,
          reason: 'segment-end',
          shouldAutoAdvance: true,
        })
      }

      if (
        Date.now() >= sourceSwitchGuardUntilRef.current &&
        playerState === 1 &&
        typeof currentSource.endSeconds !== 'number' &&
        !endEventSentRef.current &&
        isIPhoneRef.current &&
        total > IOS_SOFT_VIDEO_END_PADDING_SECONDS &&
        time >= total - IOS_SOFT_VIDEO_END_PADDING_SECONDS
      ) {
        endEventSentRef.current = true
        callbacksRef.current.onReachEndPoint({
          videoId: currentSource.videoId,
          currentTime: time,
          endSeconds: total,
          reason: 'ios-soft-video-end',
          shouldAutoAdvance: true,
        })

        // iPhone native fullscreen exits when the player reaches true "ended".
        // Pause slightly before the physical end to keep fullscreen from closing.
        if (typeof player.pauseVideo === 'function') {
          player.pauseVideo()
        }
      }
    }, 100)

    return () => {
      if (pollingTimerRef.current) {
        window.clearInterval(pollingTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const player = playerRef.current
    if (!player || !source.videoId) {
      return
    }

    const nextSourceKey = buildSourceKey(source)
    const changed = lastSourceKeyRef.current !== nextSourceKey
    if (!changed) {
      return
    }

    sourceSwitchGuardUntilRef.current = Date.now() + SOURCE_SWITCH_GUARD_MS
    endEventSentRef.current = false
    pendingResumeAfterSwitchRef.current = isPlaying
    resumeAttemptsLeftRef.current = isPlaying ? 8 : 0
    if (resumeTimerRef.current) {
      window.clearTimeout(resumeTimerRef.current)
      resumeTimerRef.current = null
    }
    const payload = {
      videoId: source.videoId,
      startSeconds: toSeconds(source.startSeconds),
      endSeconds:
        typeof source.endSeconds === 'number'
          ? toSeconds(source.endSeconds)
          : undefined,
    }

    if (isPlaying) {
      player.loadVideoById(payload)
      player.playVideo()
    } else {
      pendingResumeAfterSwitchRef.current = false
      resumeAttemptsLeftRef.current = 0
      player.cueVideoById(payload)
    }

    lastSourceKeyRef.current = nextSourceKey
  }, [isPlaying, source.videoId, source.startSeconds, source.endSeconds])

  useEffect(() => {
    const player = playerRef.current
    if (!player) {
      return
    }
    const nextVolume = toOptionalVolume(volume)
    if (nextVolume === null) {
      return
    }
    player.setVolume(nextVolume)
  }, [volume])

  useEffect(() => {
    const player = playerRef.current
    if (!player || !source.videoId) {
      return
    }

    if (isPlaying) {
      player.playVideo()
    } else {
      const state =
        typeof player.getPlayerState === 'function' ? player.getPlayerState() : -1
      if (state === 1 || state === 3) {
        player.pauseVideo()
      }
    }
  }, [isPlaying, source.videoId])

  useEffect(() => {
    const player = playerRef.current
    if (!player || !seekRequest) {
      return
    }
    if (seekRequest.requestId === lastSeekIdRef.current) {
      return
    }

    const now = player.getCurrentTime() || 0
    const target =
      seekRequest.mode === 'relative' ? now + seekRequest.value : seekRequest.value

    player.seekTo(Math.max(0, target), true)
    lastSeekIdRef.current = seekRequest.requestId
  }, [seekRequest])

  return (
    <div className="player-shell">
      <div ref={hostRef} className="player-host" />
    </div>
  )
}
