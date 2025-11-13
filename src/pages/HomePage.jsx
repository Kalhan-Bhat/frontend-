import { Link } from 'react-router-dom'

/**
 * Home Page Component
 * Landing page with navigation to Student and Teacher portals
 */
function HomePage() {
  return (
    <div className="home-container">
      <h1 className="home-title">Student Engagement Portal</h1>
      <p className="home-subtitle">
        Real-time emotion detection in virtual classrooms
      </p>
      
      <div className="home-buttons">
        <Link to="/student" className="home-button">
          Join as Student
        </Link>
        <Link to="/teacher" className="home-button">
          Join as Teacher
        </Link>
      </div>
    </div>
  )
}

export default HomePage
