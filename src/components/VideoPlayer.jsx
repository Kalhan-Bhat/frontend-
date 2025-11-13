/**
 * Video Player Component
 * Displays video stream for local or remote user
 */

import { useEffect, useRef } from 'react'

function VideoPlayer({ videoTrack, audioTrack, uid, label, isLocal = false }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoTrack && videoRef.current) {
      videoTrack.play(videoRef.current)
    }

    return () => {
      if (videoTrack) {
        videoTrack.stop()
      }
    }
  }, [videoTrack])

  useEffect(() => {
    if (audioTrack && !isLocal) {
      audioTrack.play()
    }

    return () => {
      if (audioTrack && !isLocal) {
        audioTrack.stop()
      }
    }
  }, [audioTrack, isLocal])

  return (
    <div className={`video-player ${isLocal ? 'local-video' : ''}`}>
      <div ref={videoRef} style={{ width: '100%', height: '100%' }} />
      <div className="video-label">{label}</div>
    </div>
  )
}

export default VideoPlayer
