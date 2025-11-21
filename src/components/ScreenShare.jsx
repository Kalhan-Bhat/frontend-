/**
 * Screen Share Component
 * Allows teacher to share their screen with students
 * Uses a separate Agora client to avoid multiple video track conflicts
 */

import { useState, useEffect, useRef } from 'react'
import AgoraRTC from 'agora-rtc-sdk-ng'
import { getAgoraToken } from '../services/api'

function ScreenShare({ channelName,isTeacher }) {
  const [isSharing, setIsSharing] = useState(false)
  const [screenTrack, setScreenTrack] = useState(null)
  const [remoteScreenTrack, setRemoteScreenTrack] = useState(null)
  const [error, setError] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const screenPlayerRef = useRef(null)
  const screenClientRef = useRef(null)
  const containerRef = useRef(null)

  // Initialize separate screen share client for receiving (students only)
  useEffect(() => {
    if (!channelName || isTeacher) return

    let screenClient = null
    let isJoining = false

    // Create a separate client just for screen share viewing
    const initScreenClient = async () => {
      try {
        // Check if already has a client
        if (screenClientRef.current) {
          console.log('⚠️ Screen client already exists, skipping initialization')
          return
        }

        if (isJoining) {
          console.log('⚠️ Already joining screen channel, skipping')
          return
        }

        isJoining = true
        screenClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
        screenClientRef.current = screenClient

        const handleUserPublished = async (user, mediaType) => {
          if (mediaType === 'video') {
            try {
              await screenClient.subscribe(user, mediaType)
              console.log('📺 Screen share detected from:', user.uid)
              setRemoteScreenTrack(user.videoTrack)
            } catch (err) {
              console.error('❌ Error subscribing to screen share:', err)
            }
          }
        }

        const handleUserUnpublished = (user, mediaType) => {
          if (mediaType === 'video') {
            console.log('📺 Screen share stopped from:', user.uid)
            setRemoteScreenTrack(null)
          }
        }

        screenClient.on('user-published', handleUserPublished)
        screenClient.on('user-unpublished', handleUserUnpublished)

        // Join the screen share channel (separate from main video channel)
        const screenChannelName = `${channelName}-screen`
        const { token, uid, appId } = await getAgoraToken(screenChannelName, 'student')
        await screenClient.join(appId, screenChannelName, token, uid)
        console.log('✅ Joined screen share channel:', screenChannelName)
        isJoining = false
      } catch (err) {
        console.error('❌ Error initializing screen share client:', err)
        isJoining = false
        screenClientRef.current = null
      }
    }

    initScreenClient()

    return () => {
      const cleanup = async () => {
        if (screenClientRef.current) {
          try {
            await screenClientRef.current.leave()
            console.log('👋 Left screen share channel')
          } catch (err) {
            console.error('❌ Error leaving screen share channel:', err)
          }
          screenClientRef.current = null
        }
      }
      cleanup()
    }
  }, [channelName, isTeacher])

  useEffect(() => {
    if (remoteScreenTrack && screenPlayerRef.current) {
      remoteScreenTrack.play(screenPlayerRef.current)
    }

    return () => {
      if (remoteScreenTrack) {
        remoteScreenTrack.stop()
      }
    }
  }, [remoteScreenTrack])

  const startScreenShare = async () => {
    if (!isTeacher) {
      setError('Only teachers can share screen')
      return
    }

    // Check if already sharing
    if (isSharing || screenClientRef.current) {
      console.log('⚠️ Already sharing or client exists')
      return
    }

    try {
      setError(null)
      console.log('🖥️ Starting screen share...')

      // Create a separate client for screen sharing
      const screenClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
      
      // Join a separate screen share channel
      const screenChannelName = `${channelName}-screen`
      const { token, uid, appId } = await getAgoraToken(screenChannelName, 'teacher')
      await screenClient.join(appId, screenChannelName, token, uid)
      console.log('✅ Joined screen share channel:', screenChannelName)

      // Create screen video track
      const track = await AgoraRTC.createScreenVideoTrack({
        encoderConfig: '1080p_1'
      }, 'disable') // Disable screen audio for now

      setScreenTrack(track)
      screenClientRef.current = screenClient

      // Publish screen track in the separate channel
      await screenClient.publish([track])

      setIsSharing(true)
      console.log('✅ Screen share started')

      // Listen for screen share stop (when user clicks browser's stop sharing button)
      track.on('track-ended', () => {
        console.log('🖥️ Screen share ended by user')
        stopScreenShare()
      })
    } catch (err) {
      console.error('❌ Error starting screen share:', err)
      setError(err.message || 'Failed to start screen share')
      setIsSharing(false)
      
      // Cleanup on error
      if (screenClientRef.current) {
        try {
          await screenClientRef.current.leave()
        } catch (leaveErr) {
          console.error('Error during cleanup:', leaveErr)
        }
        screenClientRef.current = null
      }
    }
  }

  const stopScreenShare = async () => {
    try {
      if (screenTrack) {
        screenTrack.close()
        setScreenTrack(null)
      }

      if (screenClientRef.current && isTeacher) {
        try {
          // Unpublish first if still connected
          if (screenClientRef.current.connectionState === 'CONNECTED') {
            await screenClientRef.current.unpublish()
          }
          await screenClientRef.current.leave()
        } catch (err) {
          console.error('Error during client cleanup:', err)
        }
        screenClientRef.current = null
      }

      setIsSharing(false)
      setError(null)
      console.log('🛑 Screen share stopped')
    } catch (err) {
      console.error('❌ Error stopping screen share:', err)
      // Force cleanup
      screenClientRef.current = null
      setIsSharing(false)
    }
  }

  const toggleFullscreen = async () => {
    const element = containerRef.current
    
    if (!isFullscreen) {
      // Enter fullscreen
      try {
        if (element.requestFullscreen) {
          await element.requestFullscreen()
        } else if (element.webkitRequestFullscreen) {
          await element.webkitRequestFullscreen()
        } else if (element.msRequestFullscreen) {
          await element.msRequestFullscreen()
        }
      } catch (err) {
        console.error('❌ Fullscreen error:', err)
      }
    } else {
      // Exit fullscreen
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen()
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen()
        }
      } catch (err) {
        console.error('❌ Exit fullscreen error:', err)
      }
    }
  }

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement
      )
      setIsFullscreen(isCurrentlyFullscreen)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('msfullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('msfullscreenchange', handleFullscreenChange)
    }
  }, [])

  return (
    <div 
      ref={containerRef}
      style={{ 
        background: isFullscreen ? '#000' : '#fff', 
        borderRadius: isFullscreen ? '0' : '8px', 
        padding: '1rem', 
        boxShadow: isFullscreen ? 'none' : '0 2px 8px rgba(0,0,0,0.1)',
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? '0' : 'auto',
        left: isFullscreen ? '0' : 'auto',
        width: isFullscreen ? '100vw' : 'auto',
        height: isFullscreen ? '100vh' : 'auto',
        zIndex: isFullscreen ? '9999' : 'auto',
        overflow: isFullscreen ? 'hidden' : 'visible'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ margin: 0, color: isFullscreen ? '#fff' : '#000' }}>🖥️ Screen Share {isFullscreen && '(Fullscreen)'}</h3>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {remoteScreenTrack && (
            <button
              onClick={toggleFullscreen}
              style={{
                padding: '0.5rem 1rem',
                background: '#6b7280',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              {isFullscreen ? '🔙 Exit Fullscreen' : '⛶ Fullscreen'}
            </button>
          )}
        
          {isTeacher && (
          <button
            onClick={isSharing ? stopScreenShare : startScreenShare}
            style={{
              padding: '0.5rem 1rem',
              background: isSharing ? '#ef4444' : '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            {isSharing ? '🛑 Stop Sharing' : '🖥️ Share Screen'}
          </button>
        )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {isSharing && isTeacher && (
        <div style={{ padding: '1rem', background: '#dbeafe', borderRadius: '4px', marginBottom: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#1e40af' }}>
            ✅ You are sharing your screen with students
          </p>
        </div>
      )}

      {remoteScreenTrack && !isTeacher && (
        <div style={{ marginTop: isFullscreen ? '0' : '1rem', flex: isFullscreen ? '1' : 'none', display: 'flex', flexDirection: 'column' }}>
          <div
            ref={screenPlayerRef}
            style={{
              width: '100%',
              height: isFullscreen ? 'calc(100vh - 80px)' : '500px',
              background: '#000',
              borderRadius: isFullscreen ? '0' : '4px',
              overflow: 'hidden'
            }}
          />
          {!isFullscreen && (
            <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280', textAlign: 'center' }}>
              📺 Teacher is sharing their screen
            </p>
          )}
        </div>
      )}

      {!isSharing && !remoteScreenTrack && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', border: '2px dashed #e5e7eb', borderRadius: '4px' }}>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            {isTeacher ? '📺 Click "Share Screen" to start presenting' : '📺 Waiting for teacher to share screen...'}
          </p>
        </div>
      )}
    </div>
  )
}

export default ScreenShare
