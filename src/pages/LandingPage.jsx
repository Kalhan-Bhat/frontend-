/**
 * Landing Page Component
 * Modern landing page with authentication
 */

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './LandingPage.css'

function LandingPage() {
  const navigate = useNavigate()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState('login') // login or signup
  const [role, setRole] = useState('student') // student or teacher
  const [visitors, setVisitors] = useState(1247) // Mock data, will be from backend
  const [activeUsers, setActiveUsers] = useState(23) // Mock data

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    rollNumber: '',
    course: '',
    employeeId: '',
    department: ''
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Simulate visitor count update
    const interval = setInterval(() => {
      setVisitors(prev => prev + Math.floor(Math.random() * 3))
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup'
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://backend-node-production-59a3.up.railway.app'
      
      const response = await fetch(`${backendUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          role
        })
      })

      const data = await response.json()

      if (response.ok) {
        // Store user data in localStorage
        localStorage.setItem('user', JSON.stringify(data.user))
        localStorage.setItem('token', data.token)
        
        // Navigate to appropriate portal
        if (role === 'student') {
          navigate('/student')
        } else {
          navigate('/teacher')
        }
      } else {
        // Show user-friendly message for unavailable auth
        if (data.available === false) {
          setError('Authentication is temporarily unavailable. Please use demo access below.')
        } else {
          setError(data.message || 'Authentication failed')
        }
      }
    } catch (err) {
      console.error('Auth error:', err)
      setError('Authentication service is unavailable. Please use demo access below.')
    } finally {
      setLoading(false)
    }
  }

  const scrollToSection = (id) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="landing-page">
      {/* Navigation Bar */}
      <nav className="landing-nav">
        <div className="nav-container">
          <div className="nav-logo">
            <span className="logo-icon">🎓</span>
            <span className="logo-text">EduEngage</span>
          </div>
          
          <div className="nav-links">
            <button onClick={() => scrollToSection('features')} className="nav-link">Features</button>
            <button onClick={() => scrollToSection('about')} className="nav-link">About</button>
            <button onClick={() => scrollToSection('documentation')} className="nav-link">Documentation</button>
            <button onClick={() => scrollToSection('stats')} className="nav-link">Stats</button>
          </div>

          <button className="nav-cta" onClick={() => setShowAuthModal(true)}>
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            Transform Virtual Learning with
            <span className="gradient-text"> Real-Time Engagement Detection</span>
          </h1>
          <p className="hero-subtitle">
            AI-powered emotion recognition helps teachers understand student engagement in virtual classrooms
          </p>
          <div className="hero-buttons">
            <button className="btn-primary" onClick={() => setShowAuthModal(true)}>
              Start Free Trial
            </button>
            <button className="btn-secondary" onClick={() => scrollToSection('features')}>
              Learn More
            </button>
          </div>

          {/* Live Stats */}
          <div className="hero-stats">
            <div className="stat-item">
              <div className="stat-value">{activeUsers}</div>
              <div className="stat-label">Active Users Now</div>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <div className="stat-value">{visitors.toLocaleString()}</div>
              <div className="stat-label">Total Visitors</div>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="floating-card card-1">
            <div className="card-icon">😊</div>
            <div className="card-text">Engaged</div>
          </div>
          <div className="floating-card card-2">
            <div className="card-icon">🤔</div>
            <div className="card-text">Confused</div>
          </div>
          <div className="floating-card card-3">
            <div className="card-icon">📊</div>
            <div className="card-text">Analytics</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <h2 className="section-title">Powerful Features</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🎥</div>
            <h3>Video Conferencing</h3>
            <p>High-quality video calls powered by Agora RTC</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🧠</div>
            <h3>AI Emotion Detection</h3>
            <p>Real-time engagement analysis using PyTorch ML models</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📝</div>
            <h3>Interactive Whiteboard</h3>
            <p>Collaborative drawing with multi-page support</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🖥️</div>
            <h3>Screen Sharing</h3>
            <p>Share presentations and content seamlessly</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Analytics Dashboard</h3>
            <p>Track student engagement over time</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📄</div>
            <h3>PDF Notes Export</h3>
            <p>Download whiteboard notes as formatted PDFs</p>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="about-section">
        <h2 className="section-title">About This Project</h2>
        <div className="about-content">
          <div className="about-text">
            <h3>Mission</h3>
            <p>
              EduEngage is designed to bridge the gap in virtual education by providing teachers 
              with real-time insights into student engagement levels. Using advanced AI and machine 
              learning, we help create more interactive and effective online learning experiences.
            </p>
            <h3>Technology Stack</h3>
            <div className="tech-stack">
              <span className="tech-badge">React</span>
              <span className="tech-badge">Node.js</span>
              <span className="tech-badge">Python</span>
              <span className="tech-badge">PyTorch</span>
              <span className="tech-badge">MongoDB</span>
              <span className="tech-badge">Socket.IO</span>
              <span className="tech-badge">Agora RTC</span>
            </div>
          </div>
          <div className="about-visual">
            <div className="timeline">
              <div className="timeline-item">
                <div className="timeline-dot"></div>
                <div className="timeline-content">
                  <h4>Phase 1: Research</h4>
                  <p>ML model development and training</p>
                </div>
              </div>
              <div className="timeline-item">
                <div className="timeline-dot"></div>
                <div className="timeline-content">
                  <h4>Phase 2: Development</h4>
                  <p>Full-stack implementation</p>
                </div>
              </div>
              <div className="timeline-item">
                <div className="timeline-dot"></div>
                <div className="timeline-content">
                  <h4>Phase 3: Testing</h4>
                  <p>Real classroom deployments</p>
                </div>
              </div>
              <div className="timeline-item">
                <div className="timeline-dot"></div>
                <div className="timeline-content">
                  <h4>Phase 4: Launch</h4>
                  <p>Public release and scaling</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Documentation Section */}
      <section id="documentation" className="documentation-section">
        <h2 className="section-title">Quick Start Guide</h2>
        <div className="docs-grid">
          <div className="doc-card">
            <div className="doc-number">1</div>
            <h3>Sign Up</h3>
            <p>Create your account as a student or teacher</p>
          </div>
          <div className="doc-card">
            <div className="doc-number">2</div>
            <h3>Join Class</h3>
            <p>Enter your class name or create a new one</p>
          </div>
          <div className="doc-card">
            <div className="doc-number">3</div>
            <h3>Start Learning</h3>
            <p>Engage with real-time collaboration tools</p>
          </div>
          <div className="doc-card">
            <div className="doc-number">4</div>
            <h3>Track Progress</h3>
            <p>View analytics and engagement insights</p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section id="stats" className="stats-section">
        <h2 className="section-title">Platform Statistics</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number">{visitors.toLocaleString()}</div>
            <div className="stat-description">Total Visitors</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{activeUsers}</div>
            <div className="stat-description">Active Users</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">95%</div>
            <div className="stat-description">Accuracy Rate</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">50+</div>
            <div className="stat-description">Classes Hosted</div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <h2>Ready to Transform Your Virtual Classroom?</h2>
        <p>Join hundreds of educators using AI-powered engagement detection</p>
        <button className="btn-primary-large" onClick={() => setShowAuthModal(true)}>
          Get Started Now
        </button>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-column">
            <h4>EduEngage</h4>
            <p>AI-powered student engagement platform</p>
          </div>
          <div className="footer-column">
            <h4>Quick Links</h4>
            <Link to="/student">Student Portal</Link>
            <Link to="/teacher">Teacher Portal</Link>
          </div>
          <div className="footer-column">
            <h4>Contact</h4>
            <p>support@eduengage.com</p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2025 EduEngage. All rights reserved.</p>
        </div>
      </footer>

      {/* Authentication Modal */}
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAuthModal(false)}>✕</button>
            
            <h2 className="modal-title">
              {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>

            {/* Role Selection */}
            <div className="role-selector">
              <button 
                className={`role-btn ${role === 'student' ? 'active' : ''}`}
                onClick={() => setRole('student')}
              >
                👨‍🎓 Student
              </button>
              <button 
                className={`role-btn ${role === 'teacher' ? 'active' : ''}`}
                onClick={() => setRole('teacher')}
              >
                👨‍🏫 Teacher
              </button>
            </div>

            <form onSubmit={handleAuth} className="auth-form">
              {authMode === 'signup' && (
                <input
                  type="text"
                  name="name"
                  placeholder="Full Name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="auth-input"
                />
              )}

              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="auth-input"
              />

              <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleInputChange}
                required
                className="auth-input"
              />

              {authMode === 'signup' && role === 'student' && (
                <>
                  <input
                    type="text"
                    name="rollNumber"
                    placeholder="Roll Number"
                    value={formData.rollNumber}
                    onChange={handleInputChange}
                    required
                    className="auth-input"
                  />
                  <input
                    type="text"
                    name="course"
                    placeholder="Course (e.g., CE, IT)"
                    value={formData.course}
                    onChange={handleInputChange}
                    required
                    className="auth-input"
                  />
                </>
              )}

              {authMode === 'signup' && role === 'teacher' && (
                <>
                  <input
                    type="text"
                    name="employeeId"
                    placeholder="Employee ID"
                    value={formData.employeeId}
                    onChange={handleInputChange}
                    required
                    className="auth-input"
                  />
                  <input
                    type="text"
                    name="department"
                    placeholder="Department (e.g., CE, IT)"
                    value={formData.department}
                    onChange={handleInputChange}
                    required
                    className="auth-input"
                  />
                </>
              )}

              {error && <div className="error-message">{error}</div>}

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? 'Please wait...' : (authMode === 'login' ? 'Login' : 'Sign Up')}
              </button>
            </form>

            <div className="auth-switch">
              {authMode === 'login' ? (
                <p>
                  Don't have an account?{' '}
                  <button onClick={() => setAuthMode('signup')} className="link-btn">
                    Sign Up
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{' '}
                  <button onClick={() => setAuthMode('login')} className="link-btn">
                    Login
                  </button>
                </p>
              )}
            </div>

            <div className="demo-access">
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '1rem' }}>
                Demo Access: Skip authentication and go directly to{' '}
                <Link to="/student" style={{ color: '#667eea' }}>Student Portal</Link> or{' '}
                <Link to="/teacher" style={{ color: '#667eea' }}>Teacher Portal</Link>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LandingPage
