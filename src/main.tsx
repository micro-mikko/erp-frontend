import { StrictMode, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  state = { hasError: false, message: '' }
  static getDerivedStateFromError(err: unknown) {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) }
  }
  render() {
    if (this.state.hasError)
      return (
        <div style={{ minHeight: '100vh', background: '#0a0b0f', color: '#fff', padding: 24, fontFamily: 'system-ui' }}>
          <h1 style={{ color: '#f97316' }}>Något gick fel</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>{this.state.message}</p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 16 }}>Öppna utvecklarverktyget (F12) → Console för mer information.</p>
        </div>
      )
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
