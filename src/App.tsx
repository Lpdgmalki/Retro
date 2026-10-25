import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SettingsProvider } from './context/SettingsContext'
import { ToastProvider } from './context/ToastContext'
import { AppShell } from './components/layout/AppShell'
import { GuestShell } from './components/layout/GuestShell'
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
import { VitrinePage } from './pages/VitrinePage'
import { AdminGuard, AdminLoginPage } from './pages/AdminLoginPage'
import { MembersPage } from './pages/MembersPage'
import { SettingsPage } from './pages/SettingsPage'

/** Les pages de rétrospective s'affichent dans le back office pour un admin, dans la vitrine sinon. */
function RetroShell() {
  const { isAdmin, rolesLoading } = useAuth()
  if (rolesLoading) return <PageLoader />
  return isAdmin ? <AppShell /> : <GuestShell />
}

function NotFound() {
  return (
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
  )
}

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
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/join/:token" element={<JoinPage />} />
      <Route element={<AdminGuard />}>
        <Route path="/r/:id/present" element={<PresentPage />} />
        <Route element={<AppShell />}>
          <Route path="/admin" element={<DashboardPage />} />
          <Route path="/admin/new" element={<NewRetroPage />} />
          <Route path="/admin/retros" element={<RetroListPage />} />
          <Route path="/admin/members" element={<MembersPage />} />
          <Route path="/admin/actions" element={<ActionsPage />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route element={<RetroShell />}>
        <Route path="/r/:id" element={<BoardPage />} />
        <Route path="/r/:id/summary" element={<SummaryPage />} />
      </Route>

      <Route element={<GuestShell />}>
        <Route index element={<VitrinePage />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Anciennes adresses */}
      <Route path="/new" element={<Navigate to="/admin/new" replace />} />
      <Route path="/retros" element={<Navigate to="/admin/retros" replace />} />
      <Route path="/actions" element={<Navigate to="/admin/actions" replace />} />
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
          <SettingsProvider>
            <SessionGate />
          </SettingsProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
