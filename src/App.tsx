import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Panel from './Panel'
import Auth from './pages/Auth'
import Landing from './pages/Landing'
import Pricing from './pages/Pricing'
import ProtectedRoute from './pages/ProtectedRoute'
import Dashboard from './pages/Dashboard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/signin/*" element={<Auth />} />
        <Route path="/signup/*" element={<Auth />} />
        <Route path="/onboarding" element={<Navigate to="/app" replace />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<Dashboard />} />
          <Route path="/app/events/new" element={<Panel />} />
          <Route path="/app/events/:eventId" element={<Panel />} />
        </Route>
        {/* Catch-all: redirect to landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
