import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, Suspense, lazy } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { KeystrokeOverlay } from "./overlays/keystroke/KeystrokeOverlay";
import { TestNotification } from "./components/TestNotification";
import { ToastContainer } from "./components/Toast";
import { UpdateNotification } from "./components/UpdateNotification";
import { ModalProvider } from "./components/ui/modal";
import { NotificationProvider } from "./components/ui/notification-center";
import { ThemeProvider } from "./theme/ThemeProvider";
import { AnimationProvider } from "./animation/AnimationProvider";
import { useAuthStore } from "./store/auth-store";
import { useLicenseStore } from "./store/license-store";
import { useUpdateStore } from "./store/update-store";
import { useSyncStore } from "./store/sync-store";
import { useInit } from "./hooks/use-init";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { RouteGuard } from "./components/auth/RouteGuard";

// ── Route-based Code Splitting ──
// Only Dashboard and Auth are eagerly loaded (visited first).
// Everything else is lazy-loaded on navigation.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const OverlayGallery = lazy(() => import("./pages/OverlayGallery"));
const CustomizePage = lazy(() => import("./pages/CustomizePage"));
const OverlayStudioPage = lazy(() => import("./pages/studio/OverlayStudioPage"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const ActionsPage = lazy(() => import("./pages/ActionsPage"));
const AlertsPage = lazy(() => import("./pages/AlertsPage"));
const SoundsPage = lazy(() => import("./pages/SoundsPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const SongPage = lazy(() => import("./pages/SongPage"));
const CanvasPage = lazy(() => import("./pages/CanvasPage"));
const CapturePage = lazy(() => import("./pages/CapturePage"));
const OverlayPage = lazy(() => import("./pages/OverlayPage"));
const MediaLibraryPage = lazy(() => import("./pages/MediaLibraryPage"));
const LicensePage = lazy(() => import("./pages/LicensePage"));
const UpdatePage = lazy(() => import("./pages/UpdatePage"));
const WorkflowPage = lazy(() => import("./pages/WorkflowPage"));
const StressTestPage = lazy(() => import("./pages/StressTestPage"));
const PerformancePage = lazy(() => import("./pages/PerformancePage"));
const PaymentPage = lazy(() => import("./pages/PaymentPage"));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage"));
const AdminPaymentsPage = lazy(() => import("./pages/AdminPaymentsPage"));
const CoinJarEditor = lazy(() => import("./pages/CoinJarEditor"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000, retry: 2, refetchOnWindowFocus: false } },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );
}

function App() {
  useInit();
  const { initialize, user, initialized } = useAuthStore();
  const { initialize: initLicense } = useLicenseStore();
  const { initialize: initUpdate } = useUpdateStore();
  const { initialize: initSync } = useSyncStore();

  // Step 1: Initialize auth (restore session from storage)
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Step 2: After auth is initialized and user is available, load license/sync/update
  // DEFERRED: Use requestIdleCallback to avoid blocking first interactive paint.
  // License/sync/update are not required for Dashboard to render.
  useEffect(() => {
    if (initialized && user?.id) {
      const runDeferredInit = () => {
        initLicense(user.id);
        initSync(user.id);
        initUpdate();
      };
      if (typeof requestIdleCallback !== 'undefined') {
        const id = requestIdleCallback(runDeferredInit, { timeout: 3000 });
        return () => cancelIdleCallback(id);
      } else {
        const timer = setTimeout(runDeferredInit, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [initialized, user?.id, initLicense, initSync, initUpdate]);

  return (
    <QueryClientProvider client={queryClient}>
      <ModalProvider>
        <NotificationProvider>
          <ThemeProvider>
            <AnimationProvider>
          <ErrorBoundary pageName="App">
            <KeystrokeOverlay screen="1" opacity={85} scale={100} animation="fade" duration={5} />
            <TestNotification />
            <ToastContainer />
            <HashRouter>
              <UpdateNotification />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/auth" element={
                    <ErrorBoundary pageName="Login">
                      <RouteGuard publicOnly>
                        <AuthPage />
                      </RouteGuard>
                    </ErrorBoundary>
                  } />
                  <Route element={
                    <RouteGuard>
                      <AppLayout />
                    </RouteGuard>
                  }>
                    <Route path="/" element={<ErrorBoundary pageName="Dashboard"><Dashboard /></ErrorBoundary>} />
                    <Route path="/overlays" element={<ErrorBoundary pageName="Overlay Gallery"><OverlayGallery /></ErrorBoundary>} />
                    <Route path="/customize/:instanceId" element={<ErrorBoundary pageName="Customize"><CustomizePage /></ErrorBoundary>} />
                    <Route path="/studio/:instanceId" element={<ErrorBoundary pageName="Overlay Studio"><OverlayStudioPage /></ErrorBoundary>} />
                    <Route path="/settings" element={<ErrorBoundary pageName="Settings"><SettingsPage /></ErrorBoundary>} />
                    <Route path="/actions" element={<ErrorBoundary pageName="Actions"><ActionsPage /></ErrorBoundary>} />
                    <Route path="/alerts" element={<ErrorBoundary pageName="Alerts"><AlertsPage /></ErrorBoundary>} />
                    <Route path="/sounds" element={<ErrorBoundary pageName="Sounds"><SoundsPage /></ErrorBoundary>} />
                    <Route path="/overlay" element={<ErrorBoundary pageName="Overlay"><OverlayPage /></ErrorBoundary>} />
                    <Route path="/overlays/coin-jar" element={<ErrorBoundary pageName="Coin Jar"><CoinJarEditor /></ErrorBoundary>} />
                    <Route path="/capture" element={<ErrorBoundary pageName="Capture"><CapturePage /></ErrorBoundary>} />
                    <Route path="/canvas" element={<ErrorBoundary pageName="Canvas"><CanvasPage /></ErrorBoundary>} />
                    <Route path="/chat" element={<ErrorBoundary pageName="Chat"><ChatPage /></ErrorBoundary>} />
                    <Route path="/song" element={<ErrorBoundary pageName="Song"><SongPage /></ErrorBoundary>} />
                    <Route path="/media" element={<ErrorBoundary pageName="Media"><MediaLibraryPage /></ErrorBoundary>} />
                    <Route path="/license" element={<ErrorBoundary pageName="License"><LicensePage /></ErrorBoundary>} />
                    <Route path="/update" element={<ErrorBoundary pageName="Updates"><UpdatePage /></ErrorBoundary>} />
                    <Route path="/workflows" element={<ErrorBoundary pageName="Workflows"><WorkflowPage /></ErrorBoundary>} />
                    <Route path="/stress-test" element={<ErrorBoundary pageName="Stress Test"><StressTestPage /></ErrorBoundary>} />
                    <Route path="/performance" element={<ErrorBoundary pageName="Performance"><PerformancePage /></ErrorBoundary>} />
                    <Route path="/payment" element={<ErrorBoundary pageName="Payment"><PaymentPage /></ErrorBoundary>} />
                    <Route path="/admin/users" element={<ErrorBoundary pageName="User Management"><RouteGuard requiredRole="admin"><AdminUsersPage /></RouteGuard></ErrorBoundary>} />
                    <Route path="/admin/payments" element={<ErrorBoundary pageName="Payment Management"><RouteGuard requiredRole="admin"><AdminPaymentsPage /></RouteGuard></ErrorBoundary>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </Suspense>
            </HashRouter>
          </ErrorBoundary>
        </AnimationProvider>
        </ThemeProvider>
        </NotificationProvider>
      </ModalProvider>
    </QueryClientProvider>
  );
}

export default App;
