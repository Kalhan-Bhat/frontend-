/**
 * Custom Hook: useAgora
 * Manages Agora RTC client and video call functionality
 */

import { useState, useEffect, useRef } from 'react'
import AgoraRTC from 'agora-rtc-sdk-ng'
import { getAgoraToken } from '../services/api'

export const useAgora = () => {
  const [localTracks, setLocalTracks] = useState({ video: null, audio: null })
  const [remoteUsers, setRemoteUsers] = useState({})
  const [isJoined, setIsJoined] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const clientRef = useRef(null)
  const channelRef = useRef(null)
  const uidRef = useRef(null)

  /**
   * Initialize Agora client
   */
  useEffect(() => {
    // Create Agora client
    clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })

    // Set up event listeners
    clientRef.current.on('user-published', async (user, mediaType) => {
      await clientRef.current.subscribe(user, mediaType)
      console.log('User published:', user.uid, mediaType)

      setRemoteUsers((prev) => ({
        ...prev,
        [user.uid]: user
      }))
    })

    clientRef.current.on('user-unpublished', (user, mediaType) => {
      console.log('User unpublished:', user.uid, mediaType)
    })

    clientRef.current.on('user-left', (user) => {
      console.log('User left:', user.uid)
      setRemoteUsers((prev) => {
        const updated = { ...prev }
        delete updated[user.uid]
        return updated
      })
    })

    return () => {
      // Cleanup on unmount
      if (clientRef.current) {
        leave()
      }
    }
  }, [])

  /**
   * Join a channel
   */
  const join = async (channelName, role = 'student') => {
    try {
      setIsLoading(true)
      setError(null)

      // Get token from backend
      const { token, uid, appId } = await getAgoraToken(channelName, role)
      
      // Join channel
      await clientRef.current.join(appId, channelName, token, uid)
      
      console.log('✅ Joined channel:', channelName, 'as UID:', uid)
      
      channelRef.current = channelName
      uidRef.current = uid

      // Create local tracks
      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks()
      
      setLocalTracks({ audio: audioTrack, video: videoTrack })

      // Publish local tracks
      await clientRef.current.publish([audioTrack, videoTrack])
      
      console.log('📡 Published local tracks')
      
      setIsJoined(true)
      setIsLoading(false)

      return { uid, channelName }
    } catch (err) {
      console.error('❌ Error joining channel:', err)
      setError(err.message)
      setIsLoading(false)
      throw err
    }
  }

  /**
   * Leave the channel
   */
  const leave = async () => {
    try {
      // Stop and close local tracks
      if (localTracks.audio) {
        localTracks.audio.stop()
        localTracks.audio.close()
      }
      if (localTracks.video) {
        localTracks.video.stop()
        localTracks.video.close()
      }

      // Leave channel
      if (clientRef.current) {
        await clientRef.current.leave()
      }

      setLocalTracks({ audio: null, video: null })
      setRemoteUsers({})
      setIsJoined(false)
      channelRef.current = null
      uidRef.current = null

      console.log('👋 Left channel')
    } catch (err) {
      console.error('Error leaving channel:', err)
    }
  }

  /**
   * Mute/unmute audio
   */
  const toggleAudio = async () => {
    if (localTracks.audio) {
      await localTracks.audio.setEnabled(!localTracks.audio.enabled)
    }
  }

  /**
   * Mute/unmute video
   */
  const toggleVideo = async () => {
    if (localTracks.video) {
      await localTracks.video.setEnabled(!localTracks.video.enabled)
    }
  }

  return {
    localTracks,
    remoteUsers,
    isJoined,
    isLoading,
    error,
    join,
    leave,
    toggleAudio,
    toggleVideo,
    currentChannel: channelRef.current,
    currentUid: uidRef.current
  }
}
