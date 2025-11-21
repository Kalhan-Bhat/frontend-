import { Routes, Route, Link } from 'react-router-dom'
import StudentPage from './pages/StudentPage'
import StudentPageNew from './pages/StudentPageNew'
import TeacherPage from './pages/TeacherPage'
import HomePage from './pages/HomePage'
import './App.css'

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/student" element={<StudentPageNew />} />
        <Route path="/student-old" element={<StudentPage />} />
        <Route path="/teacher" element={<TeacherPage />} />
      </Routes>
    </div>
  )
}

export default App
