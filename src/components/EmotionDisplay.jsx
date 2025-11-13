/**
 * Emotion Display Component
 * Shows current detected emotion and confidence
 */

function EmotionDisplay({ emotion, engagement, confidence }) {
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

  if (!engagement) {
    return (
      <div className="emotion-section">
        <h3 className="section-title">Engagement Detection</h3>
        <div className="status-message status-info">
          Waiting for engagement detection...
        </div>
      </div>
    )
  }

  return (
    <div className="emotion-section">
      <h3 className="section-title">Your Engagement Status</h3>
      <div className="emotion-display">
        <span style={{ fontSize: '3rem' }}>{getEngagementEmoji(engagement)}</span>
        <div style={{ flex: 1 }}>
          <div className="emotion-label">
            Status: <span className="emotion-value" style={{ color: getEngagementColor(engagement) }}>{engagement}</span>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <small>Confidence: {(confidence * 100).toFixed(1)}%</small>
            <div className="confidence-bar">
              <div
                className="confidence-fill"
                style={{ width: `${confidence * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmotionDisplay
