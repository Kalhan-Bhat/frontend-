/**
 * Analytics Component
 * Shows timeline and statistics of student engagement
 */

import { useState, useEffect } from 'react'
import axios from 'axios'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

function Analytics({ channelName, students }) {
  const [analytics, setAnalytics] = useState([])
  const [topics, setTopics] = useState([])
  const [currentTopic, setCurrentTopic] = useState('')
  const [showReport, setShowReport] = useState(false)

  useEffect(() => {
    if (!channelName) return

    // Fetch analytics data periodically
    const fetchAnalytics = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/analytics/${channelName}`)
        setAnalytics(response.data.analytics)
      } catch (error) {
        console.error('Error fetching analytics:', error)
      }
    }

    const fetchTopics = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/topics/${channelName}`)
        setTopics(response.data.topics)
      } catch (error) {
        console.error('Error fetching topics:', error)
      }
    }

    fetchAnalytics()
    fetchTopics()

    const interval = setInterval(() => {
      fetchAnalytics()
      fetchTopics()
    }, 5000)

    return () => clearInterval(interval)
  }, [channelName])

  const startTopic = async () => {
    if (!currentTopic.trim()) return

    try {
      await axios.post(`${API_URL}/api/topics/${channelName}`, {
        topicName: currentTopic
      })
      setCurrentTopic('')
      alert(`Topic "${currentTopic}" started!`)
    } catch (error) {
      console.error('Error starting topic:', error)
    }
  }

  const endTopic = async () => {
    try {
      await axios.put(`${API_URL}/api/topics/${channelName}/end`)
      alert('Topic ended!')
    } catch (error) {
      console.error('Error ending topic:', error)
    }
  }

  const generateReport = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/report/${channelName}`)
      const reportData = response.data
      
      // Create PDF with jsPDF
      const doc = new jsPDF()
      let yPos = 20

      // Title Page Header
      doc.setFontSize(24)
      doc.setTextColor(16, 185, 129)
      doc.text('Student Engagement Report', 105, yPos, { align: 'center' })
      
      yPos += 12
      doc.setFontSize(11)
      doc.setTextColor(107, 114, 128)
      doc.text(`Channel: ${channelName}`, 105, yPos, { align: 'center' })
      
      yPos += 6
      doc.text(`Generated: ${new Date(reportData.generatedAt).toLocaleString()}`, 105, yPos, { align: 'center' })
      
      yPos += 15

      // Overall Class Average Box
      doc.setFillColor(240, 253, 244)
      doc.rect(20, yPos - 7, 170, 15, 'F')
      doc.setFontSize(14)
      doc.setTextColor(16, 185, 129)
      doc.text(`Overall Class Average Engagement: ${reportData.overallClassAverage}%`, 105, yPos, { align: 'center' })
      
      yPos += 20

      // Overall Student Performance Section
      doc.setFontSize(16)
      doc.setTextColor(31, 41, 55)
      doc.text('Overall Student Performance', 20, yPos)
      
      yPos += 8

      const overallStudentData = reportData.overallStats.map((student, index) => [
        `${index + 1}`,
        student.studentName,
        `${student.engagementPercentage}%`,
        student.totalDataPoints
      ])

      doc.autoTable({
        startY: yPos,
        head: [['#', 'Student Name', 'Engagement', 'Data Points']],
        body: overallStudentData,
        theme: 'grid',
        headStyles: { 
          fillColor: [16, 185, 129], 
          textColor: 255,
          fontSize: 11,
          fontStyle: 'bold'
        },
        bodyStyles: { fontSize: 10 },
        columnStyles: {
          0: { cellWidth: 15, halign: 'center' },
          1: { cellWidth: 70 },
          2: { cellWidth: 40, halign: 'center' },
          3: { cellWidth: 40, halign: 'center' }
        },
        margin: { left: 20, right: 20 }
      })

      yPos = doc.lastAutoTable.finalY + 15

      // Topic-wise Analysis
      reportData.topics.forEach((topic, topicIndex) => {
        // Check if we need a new page
        if (yPos > 240) {
          doc.addPage()
          yPos = 20
        }

        // Topic Header
        doc.setFillColor(239, 246, 255)
        doc.rect(20, yPos - 5, 170, 12, 'F')
        doc.setFontSize(14)
        doc.setTextColor(59, 130, 246)
        doc.text(`Topic ${topicIndex + 1}: ${topic.topicName}`, 25, yPos, { maxWidth: 160 })
        
        yPos += 10

        // Topic Stats
        doc.setFontSize(10)
        doc.setTextColor(107, 114, 128)
        const durationText = topic.duration ? `Duration: ${Math.round(topic.duration / 1000 / 60)} minutes` : 'Duration: Ongoing'
        doc.text(durationText, 25, yPos)
        
        yPos += 5
        doc.text(`Class Average Engagement: ${topic.classAverageEngagement}%`, 25, yPos)
        
        yPos += 10

        // Engagement Distribution Table
        const engagementDistData = [
          ['Engaged', topic.engagementCounts.Engaged, '✅'],
          ['Bored', topic.engagementCounts.Bored, '😴'],
          ['Confused', topic.engagementCounts.Confused, '🤔'],
          ['Not Paying Attention', topic.engagementCounts['Not Paying Attention'], '😐']
        ]

        doc.autoTable({
          startY: yPos,
          head: [['Status', 'Count', ' ']],
          body: engagementDistData,
          theme: 'striped',
          headStyles: { 
            fillColor: [243, 244, 246], 
            textColor: [55, 65, 81],
            fontSize: 9
          },
          bodyStyles: { fontSize: 9 },
          columnStyles: {
            0: { cellWidth: 80 },
            1: { cellWidth: 40, halign: 'center' },
            2: { cellWidth: 15, halign: 'center' }
          },
          didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 0) {
              const colors = {
                'Engaged': [16, 185, 129],
                'Bored': [245, 158, 11],
                'Confused': [239, 68, 68],
                'Not Paying Attention': [107, 114, 128]
              }
              const state = data.cell.raw
              data.cell.styles.textColor = colors[state] || [55, 65, 81]
              data.cell.styles.fontStyle = 'bold'
            }
          },
          margin: { left: 25, right: 25 }
        })

        yPos = doc.lastAutoTable.finalY + 10

        // Individual Student Breakdown
        doc.setFontSize(11)
        doc.setTextColor(31, 41, 55)
        doc.text('Individual Student Breakdown', 25, yPos)
        
        yPos += 6

        const studentData = topic.studentStats.map((student, idx) => [
          `${idx + 1}`,
          student.studentName,
          `${student.engagementPercentage}%`,
          `${student.boredPercentage}%`,
          `${student.confusedPercentage}%`,
          `${student.notPayingAttentionPercentage}%`,
          student.totalDataPoints
        ])

        doc.autoTable({
          startY: yPos,
          head: [['#', 'Student', 'Engaged', 'Bored', 'Confused', 'Not Paying', 'Data']],
          body: studentData,
          theme: 'grid',
          headStyles: { 
            fillColor: [243, 244, 246], 
            textColor: [55, 65, 81],
            fontSize: 8
          },
          bodyStyles: { fontSize: 7 },
          columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 40 },
            2: { cellWidth: 23, halign: 'center', textColor: [16, 185, 129], fontStyle: 'bold' },
            3: { cellWidth: 20, halign: 'center', textColor: [245, 158, 11] },
            4: { cellWidth: 23, halign: 'center', textColor: [239, 68, 68] },
            5: { cellWidth: 25, halign: 'center', textColor: [107, 114, 128] },
            6: { cellWidth: 15, halign: 'center' }
          },
          margin: { left: 25, right: 25 }
        })

        yPos = doc.lastAutoTable.finalY + 15
      })

      // Add page numbers and footer
      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(9)
        doc.setTextColor(156, 163, 175)
        doc.text(`Page ${i} of ${pageCount}`, 105, 285, { align: 'center' })
        doc.setFontSize(8)
        doc.text('Generated by Student Engagement Portal', 105, 290, { align: 'center' })
      }

      // Save PDF
      doc.save(`engagement-report-${channelName}-${Date.now()}.pdf`)
      
      setShowReport(true)
      alert('PDF Report generated successfully!')
    } catch (error) {
      console.error('Error generating report:', error)
      alert('Error generating report. Please try again.')
    }
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

  // Group analytics by minute for timeline - show unique students per state
  const getTimelineData = () => {
    const grouped = {}
    
    analytics.forEach(item => {
      const minute = Math.floor(item.timestamp / 60000) * 60000
      if (!grouped[minute]) {
        grouped[minute] = {
          Engaged: new Set(),
          Bored: new Set(),
          Confused: new Set(),
          'Not Paying Attention': new Set()
        }
      }
      // Add student ID to the set for their engagement state
      if (grouped[minute][item.engagement]) {
        grouped[minute][item.engagement].add(item.studentId)
      }
    })
    
    // Convert Sets to counts
    return Object.entries(grouped)
      .sort((a, b) => a[0] - b[0])
      .map(([timestamp, sets]) => ({
        time: new Date(parseInt(timestamp)),
        Engaged: sets.Engaged.size,
        Bored: sets.Bored.size,
        Confused: sets.Confused.size,
        'Not Paying Attention': sets['Not Paying Attention'].size,
        total: sets.Engaged.size + sets.Bored.size + sets.Confused.size + sets['Not Paying Attention'].size
      }))
  }

  const timelineData = getTimelineData()
  const currentTopicObj = topics.find(t => !t.endTime)

  // Calculate current student engagement status (not historical totals)
  const overallStats = {
    Engaged: 0,
    Bored: 0,
    Confused: 0,
    'Not Paying Attention': 0
  }
  
  // Count current engagement state of each student (use their latest state)
  students.forEach(student => {
    if (student.engagement && overallStats.hasOwnProperty(student.engagement)) {
      overallStats[student.engagement]++
    }
  })

  return (
    <div className="analytics-section">
      <h3 className="section-title">📊 Class Analytics</h3>
      
      {/* Topic Management */}
      <div className="topic-management" style={{ marginBottom: '2rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
        <h4 style={{ marginBottom: '1rem' }}>📚 Topic Tracking</h4>
        
        {currentTopicObj && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#e7f3ff', borderRadius: '4px', border: '2px solid #2196F3' }}>
            <strong>Current Topic:</strong> {currentTopicObj.topicName}
            <button 
              onClick={endTopic}
              style={{ marginLeft: '1rem', padding: '0.5rem 1rem', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              End Topic
            </button>
          </div>
        )}
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={currentTopic}
            onChange={(e) => setCurrentTopic(e.target.value)}
            placeholder="Enter topic name..."
            style={{ flex: 1, padding: '0.75rem', borderRadius: '4px', border: '1px solid #ddd' }}
          />
          <button 
            onClick={startTopic}
            disabled={!currentTopic.trim() || !!currentTopicObj}
            style={{ padding: '0.75rem 1.5rem', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: currentTopicObj ? 'not-allowed' : 'pointer', opacity: currentTopicObj ? 0.5 : 1 }}
          >
            Start New Topic
          </button>
        </div>
        
        {topics.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <strong>Topics Covered:</strong>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
              {topics.map((topic, index) => (
                <li key={index}>
                  {topic.topicName} 
                  {topic.endTime && ` (${Math.round((topic.endTime - topic.startTime) / 1000 / 60)} min)`}
                  {!topic.endTime && ' (In Progress)'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Overall Statistics */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1rem', background: '#10b981', color: 'white', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{overallStats.Engaged}</div>
          <div>✅ Engaged</div>
        </div>
        <div style={{ padding: '1rem', background: '#f59e0b', color: 'white', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{overallStats.Bored}</div>
          <div>😴 Bored</div>
        </div>
        <div style={{ padding: '1rem', background: '#ef4444', color: 'white', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{overallStats.Confused}</div>
          <div>🤔 Confused</div>
        </div>
        <div style={{ padding: '1rem', background: '#6b7280', color: 'white', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{overallStats['Not Paying Attention']}</div>
          <div>😐 Not Paying Attention</div>
        </div>
      </div>

      {/* Timeline */}
      {timelineData.length > 0 && (
        <div className="timeline" style={{ marginBottom: '2rem' }}>
          <h4 style={{ marginBottom: '1rem' }}>📈 Engagement Timeline</h4>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
            Shows percentage distribution of engagement per minute
          </div>
          <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem', background: 'white' }}>
            {timelineData.map((data, index) => {
              const total = data.total || 1; // Avoid division by zero
              const engagedPct = ((data.Engaged / total) * 100).toFixed(0);
              const boredPct = ((data.Bored / total) * 100).toFixed(0);
              const confusedPct = ((data.Confused / total) * 100).toFixed(0);
              const notPayingPct = ((data['Not Paying Attention'] / total) * 100).toFixed(0);
              
              return (
                <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem', gap: '1rem' }}>
                  <div style={{ width: '80px', flexShrink: 0, fontSize: '0.75rem', fontWeight: '500', color: '#374151' }}>
                    {data.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <div style={{ display: 'flex', height: '36px', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', width: '100%' }}>
                      {data.Engaged > 0 && (
                        <div 
                          style={{ 
                            background: '#10b981', 
                            width: `${engagedPct}%`,
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            color: 'white', 
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            minWidth: '24px'
                          }}
                          title={`Engaged: ${data.Engaged} students (${engagedPct}%)`}
                        >
                          {engagedPct}%
                        </div>
                      )}
                      {data.Bored > 0 && (
                        <div 
                          style={{ 
                            background: '#f59e0b', 
                            width: `${boredPct}%`,
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            color: 'white', 
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            minWidth: '24px'
                          }}
                          title={`Bored: ${data.Bored} students (${boredPct}%)`}
                        >
                          {boredPct}%
                        </div>
                      )}
                      {data.Confused > 0 && (
                        <div 
                          style={{ 
                            background: '#ef4444', 
                            width: `${confusedPct}%`,
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            color: 'white', 
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            minWidth: '24px'
                          }}
                          title={`Confused: ${data.Confused} students (${confusedPct}%)`}
                        >
                          {confusedPct}%
                        </div>
                      )}
                      {data['Not Paying Attention'] > 0 && (
                        <div 
                          style={{ 
                            background: '#6b7280', 
                            width: `${notPayingPct}%`,
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            color: 'white', 
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            minWidth: '24px'
                          }}
                          title={`Not Paying Attention: ${data['Not Paying Attention']} students (${notPayingPct}%)`}
                        >
                          {notPayingPct}%
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', fontSize: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '16px', height: '16px', background: '#10b981', borderRadius: '3px' }}></div>
              <span>Engaged</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '16px', height: '16px', background: '#f59e0b', borderRadius: '3px' }}></div>
              <span>Bored</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '16px', height: '16px', background: '#ef4444', borderRadius: '3px' }}></div>
              <span>Confused</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '16px', height: '16px', background: '#6b7280', borderRadius: '3px' }}></div>
              <span>Not Paying Attention</span>
            </div>
          </div>
        </div>
      )}

      {/* Student Engagement Summary */}
      {students.length > 0 && (
        <div style={{ marginTop: '2rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
          <h4 style={{ marginBottom: '1rem' }}>👥 Current Student Status</h4>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {students.map(student => (
              <div key={student.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'white', borderRadius: '4px', alignItems: 'center' }}>
                <span style={{ fontWeight: '500' }}>{student.name}</span>
                {student.engagement && (
                  <span style={{ 
                    padding: '0.25rem 0.75rem', 
                    borderRadius: '12px', 
                    fontSize: '0.875rem',
                    background: getEngagementColor(student.engagement) + '20',
                    color: getEngagementColor(student.engagement),
                    fontWeight: 'bold'
                  }}>
                    {student.engagement}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generate Report Button */}
      <button 
        onClick={generateReport}
        disabled={analytics.length === 0}
        style={{ 
          width: '100%', 
          padding: '1rem', 
          marginTop: '1rem',
          background: analytics.length === 0 ? '#ccc' : '#2196F3', 
          color: 'white', 
          border: 'none', 
          borderRadius: '8px', 
          fontSize: '1rem', 
          fontWeight: 'bold', 
          cursor: analytics.length === 0 ? 'not-allowed' : 'pointer',
          opacity: analytics.length === 0 ? 0.6 : 1
        }}
      >
        📄 Generate Detailed Report
      </button>
      
      {analytics.length === 0 && (
        <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.875rem', marginTop: '0.5rem' }}>
          No data available yet. Start a topic and wait for student engagement data.
        </p>
      )}
    </div>
  )
}

export default Analytics
