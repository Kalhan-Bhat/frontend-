import { Routes, Route, Link } from 'react-router-dom'
import StudentPage from './pages/StudentPage'
import TeacherPage from './pages/TeacherPage'
import HomePage from './pages/HomePage'
import LandingPage from './pages/LandingPage'
import './App.css'

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/student" element={<StudentPage />} />
        <Route path="/teacher" element={<TeacherPage />} />
      </Routes>
    </div>
  )
}

export default App
