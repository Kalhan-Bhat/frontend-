/**
 * Screen Share Component
 * Allows teacher to share their screen with students
 */

import { useState, useEffect, useRef } from 'react'
import AgoraRTC from 'agora-rtc-sdk-ng'

function ScreenShare({ client, channelName, isTeacher }) {
  const [isSharing, setIsSharing] = useState(false)
  const [screenTrack, setScreenTrack] = useState(null)
  const [remoteScreenTrack, setRemoteScreenTrack] = useState(null)
  const [error, setError] = useState(null)
  const screenPlayerRef = useRef(null)

  useEffect(() => {
    if (!client) return

    const handleUserPublished = async (user, mediaType) => {
      if (mediaType === 'video' && user._videoTrack) {
        // Check if this is a screen share track
        const track = user._videoTrack
        if (track._ID && track._ID.includes('screen')) {
          await client.subscribe(user, mediaType)
          console.log('📺 Screen share detected from:', user.uid)
          setRemoteScreenTrack(track)
        }
      }
    }

    const handleUserUnpublished = (user, mediaType) => {
      if (mediaType === 'video') {
        console.log('📺 Screen share stopped from:', user.uid)
        setRemoteScreenTrack(null)
      }
    }

    client.on('user-published', handleUserPublished)
    client.on('user-unpublished', handleUserUnpublished)

    return () => {
      client.off('user-published', handleUserPublished)
      client.off('user-unpublished', handleUserUnpublished)
    }
  }, [client])

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

      // Create screen video track
      const track = await AgoraRTC.createScreenVideoTrack({
        encoderConfig: '1080p_1'
      }, 'disable') // Disable screen audio for now

      setScreenTrack(track)

      // Publish screen track (without unpublishing camera)
      await client.publish([track])

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
        // Unpublish and close screen track
        await client.unpublish([screenTrack])
        screenTrack.close()
        setScreenTrack(null)
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
