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
    // Only create if doesn't exist
    if (!clientRef.current) {
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
    }

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
      // Check if already joined
      if (isJoined || channelRef.current) {
        console.warn('⚠️ Already joined a channel. Please leave first.')
        throw new Error('Already in a channel. Please leave first.')
      }

      setIsLoading(true)
      setError(null)

      // Check camera/mic permissions first
      console.log('🎥 Checking camera and microphone permissions...')
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const hasCamera = devices.some(device => device.kind === 'videoinput')
        const hasMicrophone = devices.some(device => device.kind === 'audioinput')
        
        console.log('📹 Camera available:', hasCamera)
        console.log('🎤 Microphone available:', hasMicrophone)
        
        if (!hasCamera || !hasMicrophone) {
          throw new Error('Camera or microphone not found. Please check your devices.')
        }
      } catch (deviceErr) {
        console.error('❌ Device check failed:', deviceErr)
        throw new Error('Cannot access camera/microphone. Please allow permissions.')
      }

      // Get token from backend
      const { token, uid, appId } = await getAgoraToken(channelName, role)
      
      // Check if client exists
      if (!clientRef.current) {
        throw new Error('Agora client not initialized')
      }

      // Join channel
      await clientRef.current.join(appId, channelName, token, uid)
      
      console.log('✅ Joined channel:', channelName, 'as UID:', uid)
      
      channelRef.current = channelName
      uidRef.current = uid

      // Create local tracks with better error handling
      console.log('📹 Creating camera and microphone tracks...')
      let audioTrack = null
      let videoTrack = null
      
      try {
        // Try to create both audio and video
        const tracks = await AgoraRTC.createMicrophoneAndCameraTracks(
          {
            // Audio config
            encoderConfig: "music_standard",
          },
          {
            // Video config
            encoderConfig: {
              width: 640,
              height: 480,
              frameRate: 15,
              bitrateMax: 1000,
              bitrateMin: 400,
            }
          }
        )
        audioTrack = tracks[0]
        videoTrack = tracks[1]
        console.log('✅ Both audio and video tracks created successfully')
      } catch (trackErr) {
        console.error('❌ Error creating tracks:', trackErr)
        console.log('⚠️ Camera is blocked or in use. Trying alternatives...')
        
        // Try creating tracks separately - audio first, then video
        try {
          // Try audio first
          console.log('🎤 Trying to create audio track...')
          audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
            encoderConfig: "music_standard"
          })
          console.log('✅ Audio track created')
          
          // Then try video separately
          try {
            console.log('📹 Trying to create video track separately...')
            videoTrack = await AgoraRTC.createCameraVideoTrack({
              encoderConfig: {
                width: 640,
                height: 480,
                frameRate: 15,
                bitrateMax: 1000,
                bitrateMin: 400,
              }
            })
            console.log('✅ Video track created')
          } catch (videoErr) {
            console.warn('⚠️ Camera unavailable, continuing with audio-only')
            alert('⚠️ Camera not available. Joining with audio only.\n\nPossible reasons:\n- Camera is used by another app\n- Camera permissions not granted\n- Try closing other video apps')
            videoTrack = null
          }
        } catch (audioErr) {
          console.error('❌ Cannot access microphone either:', audioErr)
          throw new Error('Cannot access microphone or camera.\n\nPlease:\n1. Allow microphone/camera permissions\n2. Close other apps using camera (Zoom, Teams, etc.)\n3. Refresh the page and try again')
        }
      }
      
      setLocalTracks({ audio: audioTrack, video: videoTrack })

      // Publish local tracks (only those that exist)
      const tracksToPublish = [audioTrack, videoTrack].filter(Boolean)
      if (tracksToPublish.length > 0) {
        await clientRef.current.publish(tracksToPublish)
        console.log(`📡 Published ${tracksToPublish.length} track(s):`, 
          tracksToPublish.map(t => t.trackMediaType).join(', '))
      } else {
        console.warn('⚠️ No tracks to publish')
      }
      
      setIsJoined(true)
      setIsLoading(false)

      return { uid, channelName }
    } catch (err) {
      console.error('❌ Error joining channel:', err)
      setError(err.message)
      setIsLoading(false)
      
      // Cleanup on error
      if (clientRef.current && channelRef.current) {
        try {
          await clientRef.current.leave()
        } catch (leaveErr) {
          console.error('Error during cleanup:', leaveErr)
        }
      }
      
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
    currentUid: uidRef.current,
    client: clientRef.current
  }
}
