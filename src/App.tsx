import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { AppShell } from './components/layout/AppShell'
import { Button, EmptyState, PageLoader } from './components/ui/primitives'
import { isSupabaseConfigured } from './lib/supabase'
import { DashboardPage } from './pages/DashboardPage'
import { NewRetroPage } from './pages/NewRetroPage'
import { JoinPage } from './pages/JoinPage'
import { BoardPage } from './pages/BoardPage'
import { SummaryPage } from './pages/SummaryPage'
import { PresentPage } from './pages/PresentPage'
import { RetroListPage } from './pages/RetroListPage'
import { ActionsPage } from './pages/ActionsPage'

function SessionGate() {
  const { loading, error, user, retry } = useAuth()
  if (loading && !user) return <PageLoader label="Connexion sécurisée…" />
  if (error || !user) {
    return (
      <EmptyState
        className="min-h-screen"
        icon={<AlertTriangle className="size-10 text-amber-400" />}
        title="Connexion au serveur impossible"
        description={error ?? 'Session indisponible.'}
        action={
          <Button variant="secondary" onClick={retry}>
            <RefreshCw className="size-4" /> Réessayer
          </Button>
        }
      />
    )
  }
  return (
    <Routes>
      <Route path="/join/:token" element={<JoinPage />} />
      <Route path="/r/:id/present" element={<PresentPage />} />
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="/new" element={<NewRetroPage />} />
        <Route path="/retros" element={<RetroListPage />} />
        <Route path="/actions" element={<ActionsPage />} />
        <Route path="/r/:id" element={<BoardPage />} />
        <Route path="/r/:id/summary" element={<SummaryPage />} />
        <Route
          path="*"
          element={
            <EmptyState
              className="min-h-[60vh]"
              title="Page introuvable"
              description="Le lien que vous avez suivi n’existe pas."
              action={
                <Link to="/">
                  <Button variant="secondary">Retour à l’accueil</Button>
                </Link>
              }
            />
          }
        />
      </Route>
    </Routes>
  )
}

function MissingConfig() {
  return (
    <EmptyState
      className="min-h-screen"
      icon={<AlertTriangle className="size-10 text-amber-400" />}
      title="Configuration Supabase manquante"
      description={
        <>
          Copiez <code>.env.example</code> en <code>.env.local</code> et renseignez <code>VITE_SUPABASE_URL</code> et{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>, puis relancez l’application.
        </>
      }
    />
  )
}

export function App() {
  if (!isSupabaseConfigured) return <MissingConfig />
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <SessionGate />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
