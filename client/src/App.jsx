import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import Privacy from './pages/Privacy.jsx'
import Terms from './pages/Terms.jsx'
import NotFound from './pages/NotFound.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Admin from './pages/Admin.jsx'
import MarkAttendance from './pages/MarkAttendance.jsx'
import ShowAttendance from './pages/ShowAttendance.jsx'
import Predict from './pages/Predict.jsx'
import Statistics from './pages/Statistics.jsx'
import Todos from './pages/Todos.jsx'
import Timetable from './pages/Timetable.jsx'
import Profile from './pages/Profile.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route element={<ProtectedRoute role="student" />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="attendance" element={<ShowAttendance />} />
          <Route path="attendance/mark" element={<MarkAttendance />} />
          <Route path="attendance/predict" element={<Predict />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="todos" element={<Todos />} />
          <Route path="timetable" element={<Timetable />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route element={<ProtectedRoute role="admin" />}>
          <Route path="admin" element={<Admin />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
