/**
 * Student Page Component - Modern UI
 * Google Meet-style interface with floating panels
 */

import { useState, useEffect, useRef } from 'react'
import { useAgora } from '../hooks/useAgora'
import { useSocket } from '../hooks/useSocket'
import VideoPlayer from '../components/VideoPlayer'
import EmotionDisplay from '../components/EmotionDisplay'
import Whiteboard from '../components/Whiteboard'
import ScreenShare from '../components/ScreenShare'
import './StudentPageNew.css'

function StudentPageNew() {
  console.log('🔵 StudentPage Modern UI loaded')
  
  // Form state
  const [channelName, setChannelName] = useState('')
  const [studentName, setStudentName] = useState('')
  
  // Engagement state
  const [currentEngagement, setCurrentEngagement] = useState(null)
  const [confidence, setConfidence] = useState(0)
  
  // UI state
  const [activeView, setActiveView] = useState('main') // main, whiteboard, screenshare
  const [showEngagement, setShowEngagement] = useState(true)
  
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
      
      emit('student:join', {
        studentId: uid,
        studentName: studentName || `Student ${uid}`,
        channelName
      })
      console.log('📡 Notified backend of join')
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

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas')
      canvasRef.current.width = 224
      canvasRef.current.height = 224
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    frameIntervalRef.current = setInterval(() => {
      try {
        let videoElement = document.querySelector('.local-video video')
        
        if (!videoElement) {
          videoElement = document.querySelector('.video-player.local-video video')
        }
        if (!videoElement) {
          videoElement = document.querySelector('[class*="local-video"] video')
        }
        
        if (!videoElement) {
          console.warn('⚠️ Video element not found')
          return
        }

        if (videoElement.readyState < 2) {
          console.warn('⚠️ Video not ready yet')
          return
        }

        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)
        const frameData = canvas.toDataURL('image/jpeg', 0.8)

        emit('frame:send', {
          studentId: uid,
          frame: frameData,
          channelName: channel,
          timestamp: Date.now()
        })

        console.log('📤 Sent frame to backend')
      } catch (err) {
        console.error('❌ Error capturing frame:', err)
      }
    }, 2000)
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

    const handleStudentJoined = (data) => {
      console.log('👨‍🎓 Student joined:', data)
      if (data.studentId && data.studentName) {
        setRemoteUserNames(prev => ({
          ...prev,
          [data.studentId]: data.studentName
        }))
      }
    }
    
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

  // Join Form Screen
  if (!isJoined) {
    return (
      <div className="modern-join-screen">
        <div className="join-container">
          <div className="join-header">
            <h1>👨‍🎓 Student Portal</h1>
            <p>Join your virtual classroom</p>
          </div>
          
          <div className="join-form-modern">
            <input
              type="text"
              className="modern-input"
              placeholder="Your Name"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
            />
            <input
              type="text"
              className="modern-input"
              placeholder="Class Name"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
            />
            <button
              className="modern-join-button"
              onClick={handleJoin}
              disabled={isLoading}
            >
              {isLoading ? 'Joining...' : 'Join Class'}
            </button>
          </div>

          {error && (
            <div className="modern-error">
              {error}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Main classroom view
  return (
    <div className="modern-classroom">
      {/* Top Bar */}
      <div className="modern-top-bar">
        <div className="class-info">
          <h2>{channelName}</h2>
          <span className="participant-count">
            {Object.keys(remoteUsers).length + 1} participants
          </span>
        </div>
        
        <button className="modern-leave-btn" onClick={handleLeave}>
          Leave Class
        </button>
      </div>

      {/* Main Content Area */}
      <div className="modern-content">
        {/* Video Grid - Always visible in background */}
        <div className="video-grid-modern">
          {localTracks.video && (
            <VideoPlayer
              videoTrack={localTracks.video}
              audioTrack={localTracks.audio}
              uid={currentUid}
              label={`You (${studentName || currentUid})`}
              isLocal={true}
            />
          )}

          {Object.keys(remoteUsers).map((uid) => {
            const displayName = remoteUserNames[uid] || `User ${uid}`
            return (
              <VideoPlayer
                key={uid}
                videoTrack={remoteUsers[uid].videoTrack}
                audioTrack={remoteUsers[uid].audioTrack}
                uid={uid}
                label={displayName}
                isLocal={false}
              />
            )
          })}
        </div>

        {/* Floating Panels */}
        {activeView === 'whiteboard' && (
          <div className="floating-panel">
            <div className="panel-header">
              <h3>📝 Whiteboard</h3>
              <button className="close-panel" onClick={() => setActiveView('main')}>✕</button>
            </div>
            <div className="panel-content">
              <Whiteboard socket={socket} channelName={channelName} isTeacher={false} />
            </div>
          </div>
        )}

        {activeView === 'screenshare' && (
          <div className="floating-panel">
            <div className="panel-header">
              <h3>🖥️ Screen Share</h3>
              <button className="close-panel" onClick={() => setActiveView('main')}>✕</button>
            </div>
            <div className="panel-content">
              <ScreenShare client={client} channelName={channelName} isTeacher={false} />
            </div>
          </div>
        )}
      </div>

      {/* Sidebar - Engagement Display */}
      {showEngagement && (
        <div className="modern-sidebar">
          <div className="sidebar-header">
            <h3>Your Engagement</h3>
            <button className="close-sidebar" onClick={() => setShowEngagement(false)}>✕</button>
          </div>
          <EmotionDisplay engagement={currentEngagement} confidence={confidence} />
        </div>
      )}

      {/* Bottom Control Bar */}
      <div className="modern-controls">
        <button 
          className={`control-btn ${activeView === 'whiteboard' ? 'active' : ''}`}
          onClick={() => setActiveView(activeView === 'whiteboard' ? 'main' : 'whiteboard')}
        >
          <span className="control-icon">📝</span>
          <span className="control-label">Whiteboard</span>
        </button>

        <button 
          className={`control-btn ${activeView === 'screenshare' ? 'active' : ''}`}
          onClick={() => setActiveView(activeView === 'screenshare' ? 'main' : 'screenshare')}
        >
          <span className="control-icon">🖥️</span>
          <span className="control-label">Screen Share</span>
        </button>

        <button 
          className={`control-btn ${showEngagement ? 'active' : ''}`}
          onClick={() => setShowEngagement(!showEngagement)}
        >
          <span className="control-icon">📊</span>
          <span className="control-label">Engagement</span>
        </button>
      </div>
    </div>
  )
}

export default StudentPageNew
