import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLayout } from "./components/layout/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { OverlayGallery } from "./pages/OverlayGallery";
import { SettingsPage } from "./pages/Settings";
import { AuthPage } from "./pages/AuthPage";
import { ActionsPage } from "./pages/ActionsPage";
import { AlertsPage } from "./pages/AlertsPage";
import { SoundsPage } from "./pages/SoundsPage";
import { ChatPage } from "./pages/ChatPage";
import { OverlayPage } from "./pages/OverlayPage";
import { SongPage } from "./pages/SongPage";
import { CapturePage } from "./pages/CapturePage";
import { useAuthStore } from "./store/auth-store";
import { useInit } from "./hooks/use-init";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000, retry: 2, refetchOnWindowFocus: false } },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function App() {
  useInit();
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary pageName="App">
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={
              <ErrorBoundary pageName="Login">
                <AuthPage />
              </ErrorBoundary>
            } />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={
                <ErrorBoundary pageName="Dashboard">
                  <Dashboard />
                </ErrorBoundary>
              } />
              <Route path="/overlays" element={
                <ErrorBoundary pageName="Overlay Gallery">
                  <OverlayGallery />
                </ErrorBoundary>
              } />
              <Route path="/settings" element={
                <ErrorBoundary pageName="Settings">
                  <SettingsPage />
                </ErrorBoundary>
              } />
              <Route path="/actions" element={
                <ErrorBoundary pageName="Actions">
                  <ActionsPage />
                </ErrorBoundary>
              } />
              <Route path="/alerts" element={
                <ErrorBoundary pageName="Alerts">
                  <AlertsPage />
                </ErrorBoundary>
              } />
              <Route path="/sounds" element={
                <ErrorBoundary pageName="Sounds">
                  <SoundsPage />
                </ErrorBoundary>
              } />
              <Route path="/overlay" element={
                <ErrorBoundary pageName="Overlay">
                  <OverlayPage />
                </ErrorBoundary>
              } />
              <Route path="/capture" element={
                <ErrorBoundary pageName="Capture">
                  <CapturePage />
                </ErrorBoundary>
              } />
              <Route path="/chat" element={
                <ErrorBoundary pageName="Chat">
                  <ChatPage />
                </ErrorBoundary>
              } />
              <Route path="/song" element={
                <ErrorBoundary pageName="Song Requests">
                  <SongPage />
                </ErrorBoundary>
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
