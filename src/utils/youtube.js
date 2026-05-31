export function extractYouTubeVideoId(input) {
  const value = String(input || '').trim()
  if (!value) {
    return ''
  }

  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) {
    return value
  }

  try {
    const url = new URL(value)
    if (url.hostname.includes('youtu.be')) {
      const idFromPath = url.pathname.replace('/', '')
      return /^[a-zA-Z0-9_-]{11}$/.test(idFromPath) ? idFromPath : ''
    }
    const idFromQuery = url.searchParams.get('v')
    if (idFromQuery && /^[a-zA-Z0-9_-]{11}$/.test(idFromQuery)) {
      return idFromQuery
    }
    const parts = url.pathname.split('/').filter(Boolean)
    const embedIndex = parts.indexOf('embed')
    if (embedIndex !== -1 && parts[embedIndex + 1]) {
      const idFromEmbed = parts[embedIndex + 1]
      return /^[a-zA-Z0-9_-]{11}$/.test(idFromEmbed) ? idFromEmbed : ''
    }
    return ''
  } catch {
    return ''
  }
}

let apiLoadPromise

export function loadYouTubeIframeApi() {
  if (window.YT && window.YT.Player) {
    return Promise.resolve(window.YT)
  }
  if (apiLoadPromise) {
    return apiLoadPromise
  }

  apiLoadPromise = new Promise((resolve) => {
    const previousReady = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousReady === 'function') {
        previousReady()
      }
      resolve(window.YT)
    }

    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    document.body.appendChild(script)
  })

  return apiLoadPromise
}
