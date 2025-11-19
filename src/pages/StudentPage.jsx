/**
 * Student Page Component
 * Student view with video call and emotion detection
 */

import { useState, useEffect, useRef } from 'react'
import { useAgora } from '../hooks/useAgora'
import { useSocket } from '../hooks/useSocket'
import VideoPlayer from '../components/VideoPlayer'
import EmotionDisplay from '../components/EmotionDisplay'
import Whiteboard from '../components/Whiteboard'
import ScreenShare from '../components/ScreenShare'

function StudentPage() {
  // VERIFICATION: This code is loaded
  console.log('🔵 StudentPage component loaded - NEW VERSION')
  
  // Form state
  const [channelName, setChannelName] = useState('')
  const [studentName, setStudentName] = useState('')
  
  // Engagement state
  const [currentEngagement, setCurrentEngagement] = useState(null)
  const [confidence, setConfidence] = useState(0)
  
  // Store remote user names
  const [remoteUserNames, setRemoteUserNames] = useState({})
  
  // Video state
  const { localTracks, remoteUsers, isJoined, isLoading, error, join, leave, currentUid, client } = useAgora()
  const { socket, emit, on, off } = useSocket()
  
  // Refs
  const frameIntervalRef = useRef(null)
  const canvasRef = useRef(null)

  /**
   * Handle joining channel
   */
  const handleJoin = async () => {
    if (!channelName.trim()) {
      alert('Please enter a channel name')
      return
    }

    try {
      console.log('🎥 Joining channel as student...')
      const { uid } = await join(channelName, 'student')
      console.log('✅ Joined successfully, UID:', uid)
      
      // Notify backend that student joined
      emit('student:join', {
        studentId: uid,
        studentName: studentName || `Student ${uid}`,
        channelName
      })
      console.log('📡 Notified backend of join')
      
      // Frame capture will start automatically via useEffect when video track is ready
    } catch (err) {
      console.error('❌ Failed to join:', err)
    }
  }

  /**
   * Handle leaving channel
   */
  const handleLeave = async () => {
    stopFrameCapture()
    
    if (currentUid) {
      emit('student:leave', {
        studentId: currentUid,
        channelName
      })
    }
    
    await leave()
    setCurrentEngagement(null)
    setConfidence(0)
  }

  /**
   * Start capturing and sending video frames
   */
  const startFrameCapture = (uid, channel) => {
    if (!localTracks.video) {
      console.warn('⚠️ No video track available')
      return
    }

    console.log('📸 Starting frame capture...')

    // Create canvas for frame capture
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas')
      canvasRef.current.width = 224
      canvasRef.current.height = 224
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    // Capture and send frames every 2 seconds
    frameIntervalRef.current = setInterval(() => {
      try {
        // Try multiple selectors to find the video element
        let videoElement = document.querySelector('.local-video video')
        
        // If not found, try alternative selectors
        if (!videoElement) {
          videoElement = document.querySelector('.video-player.local-video video')
        }
        if (!videoElement) {
          videoElement = document.querySelector('[class*="local-video"] video')
        }
        
        if (!videoElement) {
          console.warn('⚠️ Video element not found, selectors tried:', [
            '.local-video video',
            '.video-player.local-video video',
            '[class*="local-video"] video'
          ])
          return
        }

        // Check if video is ready
        if (videoElement.readyState < 2) {
          console.warn('⚠️ Video not ready yet, readyState:', videoElement.readyState)
          return
        }

        console.log('✅ Found video element, capturing frame...')

        // Draw current frame to canvas
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)
        
        // Convert to base64
        const frameData = canvas.toDataURL('image/jpeg', 0.8)

        // Send frame to backend
        emit('frame:send', {
          studentId: uid,
          frame: frameData,
          channelName: channel,
          timestamp: Date.now()
        })

        console.log('📤 Sent frame to backend (size:', Math.round(frameData.length / 1024), 'KB)')
      } catch (err) {
        console.error('❌ Error capturing frame:', err)
      }
    }, 2000) // Send frame every 2 seconds
  }

  /**
   * Stop frame capture
   */
  const stopFrameCapture = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current)
      frameIntervalRef.current = null
      console.log('⏹️ Stopped frame capture')
    }
  }

  /**
   * Start frame capture when video track becomes available
   */
  useEffect(() => {
    if (isJoined && localTracks.video && currentUid && channelName) {
      console.log('🎬 Video track is ready, starting frame capture in 3 seconds...')
      const timer = setTimeout(() => {
        startFrameCapture(currentUid, channelName)
      }, 3000)
      
      return () => clearTimeout(timer)
    }
  }, [isJoined, localTracks.video, currentUid, channelName])

  /**
   * Listen for engagement results from backend
   */
  useEffect(() => {
    const handleEngagementResult = (data) => {
      console.log('🎯 Received engagement:', data)
      setCurrentEngagement(data.engagement)
      setConfidence(data.confidence)
    }

    const handleEngagementError = (data) => {
      console.error('❌ Engagement error:', data)
    }

    // Listen for when students join
    const handleStudentJoined = (data) => {
      console.log('👨‍🎓 Student joined:', data)
      if (data.studentId && data.studentName) {
        setRemoteUserNames(prev => ({
          ...prev,
          [data.studentId]: data.studentName
        }))
      }
    }
    
    // Listen for when teachers join
    const handleTeacherJoined = (data) => {
      console.log('👨‍🏫 Teacher joined:', data)
      if (data.teacherId && data.teacherName) {
        setRemoteUserNames(prev => ({
          ...prev,
          [data.teacherId]: data.teacherName
        }))
      }
    }

    const handleUserLeft = (data) => {
      console.log('👋 User left:', data)
      const userId = data.studentId || data.teacherId
      if (userId) {
        setRemoteUserNames(prev => {
          const newNames = { ...prev }
          delete newNames[userId]
          return newNames
        })
      }
    }

    on('engagement:result', handleEngagementResult)
    on('engagement:error', handleEngagementError)
    on('student:joined', handleStudentJoined)
    on('teacher:joined', handleTeacherJoined)
    on('student:left', handleUserLeft)
    on('teacher:left', handleUserLeft)

    return () => {
      off('engagement:result', handleEngagementResult)
      off('engagement:error', handleEngagementError)
      off('student:joined', handleStudentJoined)
      off('teacher:joined', handleTeacherJoined)
      off('student:left', handleUserLeft)
      off('teacher:left', handleUserLeft)
    }
  }, [on, off])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopFrameCapture()
      if (isJoined) {
        handleLeave()
      }
    }
  }, [])

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">👨‍🎓 Student Portal</h1>
        
        {!isJoined ? (
          <div className="join-form">
            <input
              type="text"
              className="join-input"
              placeholder="Your Name"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
            />
            <input
              type="text"
              className="join-input"
              placeholder="Channel Name"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
            />
            <button
              className="join-button"
              onClick={handleJoin}
              disabled={isLoading}
            >
              {isLoading ? 'Joining...' : 'Join Class'}
            </button>
          </div>
        ) : (
          <div className="join-form">
            <div className="status-message status-success">
              Connected to: <strong>{channelName}</strong>
            </div>
            <button className="leave-button" onClick={handleLeave}>
              Leave Class
            </button>
          </div>
        )}

        {error && (
          <div className="status-message status-error" style={{ marginTop: '1rem' }}>
            Error: {error}
          </div>
        )}
      </div>

      {/* Video Section */}
      {isJoined && (
        <>
          <div className="video-section">
            <h3 className="section-title">Video Call</h3>
            <div className="video-grid">
              {/* Local Video */}
              {localTracks.video && (
                <VideoPlayer
                  videoTrack={localTracks.video}
                  audioTrack={localTracks.audio}
                  uid={currentUid}
                  label={`You (${studentName || currentUid})`}
                  isLocal={true}
                />
              )}

              {/* Remote Videos */}
              {Object.keys(remoteUsers).map((uid) => {
                // Get name from remoteUserNames state
                const displayName = remoteUserNames[uid] || `User ${uid}`;
                
                return (
                  <VideoPlayer
                    key={uid}
                    videoTrack={remoteUsers[uid].videoTrack}
                    audioTrack={remoteUsers[uid].audioTrack}
                    uid={uid}
                    label={displayName}
                    isLocal={false}
                  />
                );
              })}
            </div>
          </div>

          {/* Engagement Display */}
          <EmotionDisplay engagement={currentEngagement} confidence={confidence} />

          {/* Teaching Tools Section */}
          <div style={{ marginTop: '2rem' }}>
            <h2 className="section-title">📚 Learning Materials</h2>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
              gap: '2rem', 
              marginTop: '1rem' 
            }}>
              {/* Whiteboard - Students can view teacher's drawings */}
              <Whiteboard socket={socket} channelName={channelName} isTeacher={false} />

              {/* Screen Share - Students can view teacher's screen */}
              <ScreenShare client={client} channelName={channelName} isTeacher={false} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default StudentPage
