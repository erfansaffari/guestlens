import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient()
const content = <QueryClientProvider client={queryClient}><App /></QueryClientProvider>
const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {key ? <ClerkProvider publishableKey={key} signInUrl="/signin" signUpUrl="/signup" signInFallbackRedirectUrl="/app" signUpFallbackRedirectUrl="/app">{content}</ClerkProvider> : content}
  </StrictMode>,
)
