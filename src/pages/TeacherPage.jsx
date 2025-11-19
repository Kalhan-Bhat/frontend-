/**
 * Teacher Page Component
 * Teacher dashboard with video call and real-time student emotion monitoring
 */

import { useState, useEffect } from 'react'
import { useAgora } from '../hooks/useAgora'
import { useSocket } from '../hooks/useSocket'
import VideoPlayer from '../components/VideoPlayer'
import Analytics from '../components/Analytics'
import Whiteboard from '../components/Whiteboard'
import ScreenShare from '../components/ScreenShare'

function TeacherPage() {
  // Form state
  const [channelName, setChannelName] = useState('')
  const [teacherName, setTeacherName] = useState('')
  
  // Students state
  const [students, setStudents] = useState([])
  const [remoteUserNames, setRemoteUserNames] = useState({})
  
  // Video state
  const { localTracks, remoteUsers, isJoined, isLoading, error, join, leave, currentUid, client } = useAgora()
  const { socket, emit, on, off } = useSocket()

  /**
   * Handle joining channel
   */
  const handleJoin = async () => {
    if (!channelName.trim()) {
      alert('Please enter a channel name')
      return
    }

    try {
      console.log('🎥 Teacher joining channel:', channelName)
      const { uid } = await join(channelName, 'teacher')
      console.log('✅ Teacher joined with UID:', uid)
      
      // Notify backend that teacher joined
      console.log('📡 Sending teacher:join event to backend')
      emit('teacher:join', {
        teacherId: uid,
        teacherName: teacherName || `Teacher ${uid}`,
        channelName
      })
      console.log('📡 teacher:join event sent')
    } catch (err) {
      console.error('❌ Failed to join:', err)
    }
  }

  /**
   * Handle leaving channel
   */
  const handleLeave = async () => {
    if (currentUid) {
      emit('teacher:leave', {
        teacherId: currentUid,
        channelName
      })
    }
    
    await leave()
    setStudents([])
  }

  /**
   * Format timestamp
   */
  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString()
  }

  /**
   * Get engagement emoji and color
   */
  const getEngagementEmoji = (engagement) => {
    const emojiMap = {
      'Engaged': '✅',
      'Bored': '😴',
      'Confused': '🤔',
      'Not Paying Attention': '😐'
    }
    return emojiMap[engagement] || '🤔'
  }
  
  const getEngagementColor = (engagement) => {
    const colorMap = {
      'Engaged': '#10b981',
      'Bored': '#f59e0b',
      'Confused': '#ef4444',
      'Not Paying Attention': '#6b7280'
    }
    return colorMap[engagement] || '#6b7280'
  }

  /**
   * Listen for student events
   */
  useEffect(() => {
    // Initial students list
    const handleStudentsList = (data) => {
      console.log('📋 Received students list:', data)
      const studentsList = (data.students || []).map(s => ({
        id: s.id,
        name: s.name,
        engagement: s.engagement || null,
        confidence: s.confidence || null,
        timestamp: s.timestamp || Date.now()
      }))
      console.log('📋 Processed students list:', studentsList)
      setStudents(studentsList)
      
      // Also store names for video display
      studentsList.forEach(s => {
        if (s.id && s.name) {
          setRemoteUserNames(prev => ({
            ...prev,
            [s.id]: s.name
          }))
        }
      })
    }

    // Student joined
    const handleStudentJoined = (data) => {
      console.log('👨‍🎓 Student joined:', data)
      
      // Store name for video display
      if (data.studentId && data.studentName) {
        setRemoteUserNames(prev => ({
          ...prev,
          [data.studentId]: data.studentName
        }))
      }
      
      // Check if student already exists to avoid duplicates
      setStudents((prev) => {
        const exists = prev.some(s => s.id === data.studentId)
        if (exists) {
          console.log('Student already in list, skipping:', data.studentId)
          return prev
        }
        
        return [
          ...prev,
          {
            id: data.studentId,
            name: data.studentName,
            engagement: null,
            confidence: null,
            timestamp: data.timestamp
          }
        ]
      })
    }

    // Student left
    const handleStudentLeft = (data) => {
      console.log('👋 Student left:', data)
      setStudents((prev) => prev.filter((s) => s.id !== data.studentId))
    }

    // Engagement update
    const handleEngagementUpdate = (data) => {
      console.log('🎯 Engagement update:', data)
      setStudents((prev) =>
        prev.map((student) =>
          student.id === data.studentId
            ? {
                ...student,
                name: data.studentName || student.name,
                engagement: data.engagement,
                confidence: data.confidence,
                timestamp: data.timestamp
              }
            : student
        )
      )
    }

    on('students:list', handleStudentsList)
    on('student:joined', handleStudentJoined)
    on('student:left', handleStudentLeft)
    on('engagement:update', handleEngagementUpdate)

    return () => {
      off('students:list', handleStudentsList)
      off('student:joined', handleStudentJoined)
      off('student:left', handleStudentLeft)
      off('engagement:update', handleEngagementUpdate)
    }
  }, [on, off])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (isJoined) {
        handleLeave()
      }
    }
  }, [])

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">👨‍🏫 Teacher Dashboard</h1>
        
        {!isJoined ? (
          <div className="join-form">
            <input
              type="text"
              className="join-input"
              placeholder="Your Name"
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
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
              Connected to: <strong>{channelName}</strong> | Students: <strong>{students.length}</strong>
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

      {isJoined && (
        <div className="dashboard-grid">
          {/* Left Column: Video Grid */}
          <div>
            <div className="video-section">
              <h3 className="section-title">Video Call</h3>
              <div className="video-grid">
                {/* Local Video */}
                {localTracks.video && (
                  <VideoPlayer
                    videoTrack={localTracks.video}
                    audioTrack={localTracks.audio}
                    uid={currentUid}
                    label={`You (${teacherName || currentUid})`}
                    isLocal={true}
                  />
                )}

                {/* Remote Videos */}
                {Object.keys(remoteUsers).map((uid) => {
                  // Try to find student name from multiple sources
                  const student = students.find(s => String(s.id) === String(uid));
                  const nameFromState = remoteUserNames[uid];
                  const displayName = student?.name || nameFromState || `User ${uid}`;
                  
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

          </div>

          {/* Right Column: Students List & Analytics */}
          <div>
            <div className="students-list">
              <h3 className="section-title">Student Engagement Status</h3>
              
              {students.length === 0 ? (
                <div className="status-message status-info">
                  No students in the class yet
                </div>
              ) : (
                students.map((student) => (
                  <div key={student.id} className="student-card">
                    <div className="student-name">
                      {student.name}
                    </div>
                    
                    {student.engagement ? (
                      <>
                        <div className="student-emotion" style={{ background: `${getEngagementColor(student.engagement)}20`, border: `2px solid ${getEngagementColor(student.engagement)}`, padding: '0.75rem', borderRadius: '8px' }}>
                          <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: getEngagementColor(student.engagement) }}>
                            {getEngagementEmoji(student.engagement)} {student.engagement}
                          </span>
                          <span className="emotion-badge" style={{ background: getEngagementColor(student.engagement) }}>
                            {(student.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="timestamp" style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                          Updated: {formatTime(student.timestamp)}
                        </div>
                      </>
                    ) : (
                      <div style={{ color: '#999', fontSize: '0.9rem' }}>
                        Waiting for engagement data...
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            
            {/* Analytics Component */}
            {isJoined && channelName && (
              <Analytics channelName={channelName} students={students} />
            )}
          </div>
        </div>
      )}

      {/* Teaching Tools Section - Only visible when joined */}
      {isJoined && (
        <div style={{ marginTop: '2rem' }}>
          <h2 className="section-title">🎓 Teaching Tools</h2>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: '2rem', 
            marginTop: '1rem' 
          }}>
            {/* Whiteboard */}
            <Whiteboard socket={socket} channelName={channelName} isTeacher={true} />
            
            {/* Screen Share */}
            <ScreenShare channelName={channelName} isTeacher={true} />
          </div>
        </div>
      )}
    </div>
  )
}

export default TeacherPage
