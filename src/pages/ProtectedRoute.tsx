import { useAuth } from '@clerk/react'
import { Navigate, Outlet } from 'react-router-dom'

export default function ProtectedRoute() {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) return <main className="gl-route-loading">Loading GuestLens…</main>
  if (!isSignedIn) return <Navigate to="/signin" replace />
  return <Outlet />
}
