import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Panel from './Panel'
import Auth from './pages/Auth'
import Landing from './pages/Landing'
import Onboarding from './pages/Onboarding'
import Pricing from './pages/Pricing'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/signin" element={<Auth />} />
        <Route path="/signup" element={<Auth />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/app" element={<Panel />} />
        {/* Catch-all: redirect to landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
