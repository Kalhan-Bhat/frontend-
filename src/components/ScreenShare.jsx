/**
 * Screen Share Component
 * Allows teacher to share their screen with students
 * Uses a separate Agora client to avoid multiple video track conflicts
 */

import { useState, useEffect, useRef } from 'react'
import AgoraRTC from 'agora-rtc-sdk-ng'
import { getAgoraToken } from '../services/api'

function ScreenShare({ channelName, isTeacher }) {
  const [isSharing, setIsSharing] = useState(false)
  const [screenTrack, setScreenTrack] = useState(null)
  const [remoteScreenTrack, setRemoteScreenTrack] = useState(null)
  const [error, setError] = useState(null)
  const screenPlayerRef = useRef(null)
  const screenClientRef = useRef(null)

  // Initialize separate screen share client for receiving
  useEffect(() => {
    if (!channelName) return

    // Create a separate client just for screen share viewing
    const initScreenClient = async () => {
      try {
        const screenClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
        screenClientRef.current = screenClient

        const handleUserPublished = async (user, mediaType) => {
          if (mediaType === 'video') {
            await screenClient.subscribe(user, mediaType)
            console.log('📺 Screen share detected from:', user.uid)
            setRemoteScreenTrack(user.videoTrack)
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
      } catch (err) {
        console.error('❌ Error initializing screen share client:', err)
      }
    }

    initScreenClient()

    return () => {
      if (screenClientRef.current) {
        screenClientRef.current.leave()
        screenClientRef.current = null
      }
    }
  }, [channelName])

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
    }
  }

  const stopScreenShare = async () => {
    try {
      if (screenTrack) {
        screenTrack.close()
        setScreenTrack(null)
      }

      if (screenClientRef.current) {
        await screenClientRef.current.leave()
        screenClientRef.current = null
      }

      setIsSharing(false)
      setError(null)
      console.log('🛑 Screen share stopped')
    } catch (err) {
      console.error('❌ Error stopping screen share:', err)
    }
  }

  return (
    <div style={{ background: '#fff', borderRadius: '8px', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>🖥️ Screen Share</h3>
        
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
        <div style={{ marginTop: '1rem' }}>
          <div
            ref={screenPlayerRef}
            style={{
              width: '100%',
              height: '500px',
              background: '#000',
              borderRadius: '4px',
              overflow: 'hidden'
            }}
          />
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280', textAlign: 'center' }}>
            📺 Teacher is sharing their screen
          </p>
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
