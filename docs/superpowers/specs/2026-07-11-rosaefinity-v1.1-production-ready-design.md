# RosaeFinity v1.1 — Production Ready Design Specification

**Date:** 2026-07-11
**Version:** 1.1.0
**Author:** RosaeFinity Engineering
**Status:** Approved — Ready for Implementation

---

## Executive Summary

This specification defines the complete architecture for transforming RosaeFinity from a v1.0.1 Beta into a v1.1 Production Ready application. The work is organized into 10 phases, each building on the previous, covering: critical bug fixes, stability, authentication, licensing, auto-updates, server backend, cloud sync, production polish, performance, and final QA.

### Key Decisions
- **Auth Provider:** Supabase (provider-agnostic abstraction for future swap)
- **Server:** Express + Prisma + PostgreSQL (same repo, `/server` folder)
- **Auto Update:** electron-updater + GitHub Releases
- **Architecture:** Hybrid (Supabase for auth, custom server for license/sync)

---

## Phase 1: Critical Black Screen Fix

### Problem
Electron production builds show a black screen due to path resolution failures.

### Implementation

**Path Resolution Engine (`electron/path-resolver.cjs`):**
- Multi-strategy path resolution (asar, resourcesPath, `__dirname`, cwd)
- Fallback error page with debug info if no index.html found
- Dev vs production detection via `app.isPackaged`

**Window Configuration:**
- `show: false` → show on `ready-to-show` (prevents white flash)
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false`
- Secure preload bridge with whitelisted IPC channels

**Error Handling:**
- `did-fail-load` → load error page
- `crashed` → auto-reload after 2s
- Path resolution failure → styled debug error page

**Flow:**
```
App Start → Resolve index.html (multi-strategy)
  → Found → loadFile() → ready-to-show → show window
  → Not Found → error debug page
  → Load failed → did-fail-load → error page
  → Renderer crashed → auto-reload
```

### Verification
- Fresh install on clean Windows PC
- Portable mode
- Update install (overwrite)

---

## Phase 2: Application Stability

### 2.1 Process Supervision (`electron/process-supervisor.cjs`)
- Renderer crash detection via `render-process-gone`
- Main process exception handler (`uncaughtException`, `unhandledRejection`)
- Auto-restart renderer (max 5 attempts, 2s delay)
- Crash report logging to `logs/crashes/`

### 2.2 Memory Management (`electron/memory-manager.cjs`)
- Named interval/timeout tracking with cleanup
- IPC listener deduplication (`safeIpcOn`, `safeIpcHandle`)
- Disposable resource tracking (media players, SSE connections)
- Memory monitor: check every 30s, warn if heap > 500MB
- Force GC if available

### 2.3 IPC Security (`electron/ipc-security.cjs`)
- Whitelist-based channel validation
- Reject unknown IPC messages
- Never expose raw `ipcRenderer`
- `contextIsolation: true`, `nodeIntegration: false`

### 2.4 Background Service Monitoring (`electron/service-monitor.cjs`)
- Register: SSE server, TikTok, OBS, Browser Source, Keystroke
- Health check every 10s
- Auto-recovery after 3 consecutive failures
- Non-blocking notification to renderer
- Manual restart from UI

### 2.5 Structured Logging (`electron/logger.cjs`)
- Levels: DEBUG, INFO, WARNING, ERROR
- Production: INFO+ only; Development: DEBUG+
- Rotating log files (14-day retention, 50MB max)
- Log export for troubleshooting
- Format: `{ timestamp, level, message, pid, memory, data }`

### 2.6 Diagnostics Page (`src/pages/DiagnosticsPage.tsx`)
- Hidden at `/diagnostics` (not in sidebar)
- Shows: memory, CPU, IPC channels, services, connections, versions
- Auto-refresh every 3 seconds
- Export diagnostics as JSON

---

## Phase 3: Authentication System

### 3.1 Provider-Agnostic Auth Layer

**Types (`src/services/auth/types.ts`):**
```typescript
interface AuthProvider {
  signInWithEmail(email, password): Promise<AuthResult>;
  signUpWithEmail(email, password, displayName?): Promise<AuthResult>;
  signInWithGoogle(): Promise<AuthResult>;
  signInWithDiscord(): Promise<AuthResult>;
  signInWithGitHub(): Promise<AuthResult>;
  signInWithMicrosoft(): Promise<AuthResult>;
  signInWithMagicLink(email): Promise<AuthResult>;
  signInAnonymously(): Promise<AuthResult>;
  signOut(): Promise<void>;
  refreshSession(): Promise<AuthSession | null>;
  getCurrentSession(): Promise<AuthSession | null>;
  resetPassword(email): Promise<void>;
  updatePassword(newPassword): Promise<void>;
  verifyEmail(token): Promise<AuthResult>;
  resendVerification(email): Promise<void>;
  updateProfile(updates): Promise<AuthUser>;
  onAuthStateChange(callback): () => void;
  supportsOffline(): boolean;
  supportsProvider(provider): boolean;
}
```

**User Model:**
```typescript
interface AuthUser {
  id: string;
  email: string | null;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  provider: AuthProviderType;
  accountType: 'guest' | 'free' | 'pro' | 'admin';
  subscriptionStatus: SubscriptionStatus;
  licenseStatus: LicenseStatus;
  isAnonymous: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 3.2 Supabase Implementation
- Provider: Supabase Auth
- OAuth: Google, Discord, GitHub, Microsoft
- Magic Link support
- Anonymous/Guest mode
- Email verification
- Password reset
- Error message mapping (user-friendly)

### 3.3 Session Management
- Persistent login via localStorage
- Auto token refresh (5 min before expiry)
- Secure logout
- Offline session cache
- Multi-device support

### 3.4 Auth Store (Zustand)
- `currentUser`, `session`, `isLoading`, `initialized`
- Actions: `initialize`, `login`, `register`, `loginWithGoogle`, `logout`, `refreshSession`, `updateProfile`, `restoreSession`
- Role checks: `hasRole()`, `canAccess()`
- Persistence: `rf-auth-storage`

### 3.5 Route Protection (`src/components/auth/RouteGuard.tsx`)
- Public routes
- Authenticated routes
- Role-gated routes (free, pro, admin)
- Loading spinner during init
- Auto-redirect

### 3.6 Offline Support
- Cached session allows offline launch
- Local features continue working
- Auto-reconnect and sync when online

### 3.7 Login UI
- Google sign-in button
- Email/password form
- Remember me checkbox
- Forgot password link
- Loading states
- Error messages
- Dark theme consistent with RosaeFinity

---

## Phase 4: License & Account System

### 4.1 Account Types
- **Guest:** Local-only, minimal features
- **Free:** Basic features, limited counts
- **Pro:** All features, unlimited
- **Admin:** Everything + admin access

### 4.2 Feature Flags
Every premium capability controlled by flags:
```typescript
type FeatureFlag =
  | 'unlimited_actions' | 'unlimited_overlays' | 'unlimited_sounds'
  | 'premium_overlays' | 'browser_source_premium' | 'cloud_sync'
  | 'marketplace' | 'plugin_store' | 'ai_features'
  | 'stream_analytics' | 'advanced_editor' | 'multi_profile'
  | 'priority_support' | 'no_watermark' | 'export_config'
  | 'import_config' | 'custom_themes';
```

### 4.3 Plan Registry (No Hardcoding)
```typescript
const PLAN_REGISTRY: Record<PlanTier, PlanDefinition> = {
  free: { maxOverlays: 2, maxActions: 10, featureFlags: {...} },
  pro: { maxOverlays: Infinity, maxActions: Infinity, featureFlags: {...} },
  admin: { ... },
};
// New plans added via registerPlan() without changing app code
```

### 4.4 Device Management
- Max active devices per license
- Device registration, removal, transfer
- Last active timestamp tracking

### 4.5 License Validation
- Background validation (hourly)
- Grace period when offline (7 days configurable)
- Cached license state
- Never interrupt livestreams for validation

### 4.6 License Store (Zustand)
- `currentPlan`, `featureFlags`, `licenseStatus`, `expiresAt`
- `activateLicense()`, `deactivateLicense()`, `refreshLicense()`
- `hasFeature()`, `canCreate()`, `getMax()`
- Persistence: `rf-license-storage`

### 4.7 UI Behavior
- Premium features remain visible with lock icon
- Upgrade modal on click
- `FeatureGate` component wraps locked features
- Never hide premium features from Free users

### 4.8 Payment Architecture
- Payment completely separate from license validation
- Prepared for: Stripe, PayPal, Midtrans, Xendit
- Changing providers requires no licensing code changes

---

## Phase 5: Auto Update System

### 5.1 Update Channels
- **Stable** — production releases
- **Beta** — pre-release testing
- **Dev** — development builds

### 5.2 Update Workflow
1. Auto-check on startup (30s delay)
2. Periodic check (every 4 hours)
3. Manual check from Settings
4. Download with progress
5. Release notes display
6. Restart & Install
7. Remind Me Later
8. Skip Version (optional updates only)

### 5.3 Update Policies
- **Optional** — user decides
- **Recommended** — default download
- **Mandatory** — auto-install (security updates)

### 5.4 Rollback Safety
- Save `rollback-state.json` before update
- Check version match after launch
- Log failures, keep previous version usable

### 5.5 Security
- Verify metadata (version format, trusted hosts)
- SHA256 integrity check after download
- Code signing preparation

### 5.6 Update Store (Zustand)
- `currentVersion`, `latestVersion`, `updateAvailable`, `downloadProgress`
- `releaseNotes`, `updateChannel`, `updateStatus`, `lastCheckedAt`

### 5.7 Update UI
- Non-blocking popup in bottom-right
- Download progress bar
- Release notes toggle
- Restart button
- Error display

### 5.8 Enterprise Features
- Staged rollout (percentage-based)
- Minimum supported version
- Maintenance mode (server kill switch)
- Update analytics preparation

---

## Phase 6: Server Backend

### 6.1 Architecture
```
server/
├── src/
│   ├── modules/          # Feature modules
│   │   ├── auth/
│   │   ├── user/
│   │   ├── license/
│   │   ├── device/
│   │   ├── version/
│   │   ├── sync/
│   │   ├── analytics/
│   │   ├── admin/
│   │   └── jobs/
│   ├── middleware/        # auth, validate, rateLimit, errorHandler, audit
│   ├── config/           # env, database, supabase
│   ├── utils/            # logger, errors, response, crypto
│   └── types/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── openapi/
│   └── spec.ts
└── package.json
```

### 6.2 Stack
- **Runtime:** Node.js + TypeScript
- **Framework:** Express
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Auth:** Supabase JWT verification
- **Validation:** Zod
- **Logging:** Winston
- **API Docs:** OpenAPI/Swagger

### 6.3 API Versioning
- All endpoints: `/api/v1/...`
- Future versions coexist: `/api/v2/...`

### 6.4 Auth Middleware
- Supabase JWT verification
- Role extraction (guest, free, pro, admin)
- `requireRole()` middleware

### 6.5 Core Modules
| Module | Endpoints |
|---|---|
| Auth | session, refresh |
| User | profile CRUD |
| License | validate, activate, deactivate |
| Device | register, list, remove |
| Version | latest, maintenance |
| Sync | full, partial |
| Analytics | events |
| Admin | users, licenses, health |

### 6.6 Security
- Helmet, CORS, rate limiting
- Zod validation on every request
- Audit logging
- No stack traces in production
- Structured error responses

### 6.7 Offline Queue (Electron)
- Queue sync operations when offline
- Process queue on reconnect
- Preserve operation order
- Max retries with exponential backoff

---

## Phase 7: Cloud Sync

### 7.1 Architecture
- **Offline-first:** Local database is source of truth
- **Background sync:** Never blocks UI
- **Delta sync:** Only changed objects uploaded
- **Conflict resolution:** Server wins by default, user dialog for conflicts

### 7.2 Sync Scope
Actions, Overlays, Scenes, Browser Source settings, Global settings, Hotkeys, User preferences, Profiles, Media metadata (not files)

### 7.3 Sync Engine
```typescript
class SyncEngine {
  startupSync()      // On app start
  shutdownSync()     // On app quit
  fullSync()         // Complete sync
  pushModule()       // Single module sync
  processQueue()     // Process offline queue
  setStreaming()     // Live session awareness
}
```

### 7.4 Conflict Resolution
- Last Modified Timestamp
- Version Number
- Merge when possible
- User dialog when auto-merge fails
- Backup before resolving

### 7.5 Multi-Device
- Device ID, Name, Last Sync, Last Online, App Version
- Remove inactive devices
- Sync status per device

### 7.6 Sync Store (Zustand)
- `syncStatus`, `pendingOperations`, `failedOperations`
- `lastSuccessfulSync`, `onlineStatus`, `autoSyncEnabled`, `conflictCount`

### 7.7 Live Session Safety
- Queue silently during livestream
- Never block actions or browser sources
- Never restart during stream
- Prioritize streaming over sync

---

## Phase 8: Production Polish

### 8.1 Modal System
- `useModal()` hook: alert, confirm, prompt, warning, success, loading
- Replaces all native `alert()`, `confirm()`, `prompt()`
- Accessible (keyboard, ARIA)

### 8.2 Error Boundaries
- Per-page `ErrorBoundary` component
- Friendly recovery screen
- Crash logging

### 8.3 State Views
- `LoadingView`, `EmptyView`, `ErrorView` components
- Every page uses all three states

### 8.4 UI Consistency
- Standardized spacing, typography, colors, buttons, borders
- Design tokens applied across all pages

### 8.5 Production Logging
- Disable verbose dev logs in production
- Structured production logs only

### 8.6 Cleanup
- Remove dead code, unused imports, duplicates
- Remove console.log in production
- Remove hardcoded demo data
- Remove debug components

### 8.7 Diagnostics Page
- System info, memory, services, connections
- QA self-check
- Export diagnostics + support bundle

### 8.8 QA Self-Check
- Automated checks for required services, assets, configs
- Accessible via `/diagnostics?qa=true`

---

## Phase 9: Performance

### 9.1 Startup
- Defer non-critical service init (1s after window visible)
- Track cold vs warm startup

### 9.2 Bundle
- Route-based code splitting (React.lazy)
- Vendor chunk optimization
- Target: < 5MB total

### 9.3 React
- `React.memo`, `useMemo`, `useCallback`
- Stable keys, colocated state

### 9.4 Virtualization
- `@tanstack/react-virtual` for long lists (actions, media, chat)

### 9.5 SSE Delta Broadcasting
- Only send changed data
- JSON.stringify comparison before broadcast

### 9.6 Database
- Proper Dexie indexes
- Batched writes
- Debounced auto-save
- Paginated queries

### 9.7 CPU
- Throttle expensive operations
- Work scheduler: defer background tasks during livestream
- Idle-time processing

### 9.8 Memory
- Monitor every 30s
- Automatic cleanup (timers, listeners, disposables)
- Cache limits

### 9.9 Performance Budgets
| Metric | Target |
|---|---|
| Startup | < 3s |
| UI interaction | < 50ms |
| Browser Source latency | < 100ms |
| Memory (1hr) | < 250MB |
| CPU (live) | < 10% |
| FPS (overlay) | 60fps |

### 9.10 Stress Testing
- 1000+ rapid events, 5000 keystrokes
- Memory check after stress

---

## Phase 10: Final QA & Release

### 10.1 Regression Testing
- Smoke tests for all features
- Feature verification matrix
- Performance certification

### 10.2 QA Dashboard
- `/qa` page (hidden from sidebar)
- Passed/failed tests, performance metrics
- Security validation
- Release checklist
- Production sign-off gate

### 10.3 Release Automation
```bash
scripts/release.sh <version> <stage>
```
- Run QA → Security audit → Build → Git tag → GitHub Release → Update manifest

### 10.4 Cross-Version Testing
- Verify upgrade from previous versions
- Settings preservation
- Database migration

### 10.5 Support Bundle
- Export logs, diagnostics, config, crashes as ZIP
- Accessible from Diagnostics page

### 10.6 Documentation
- BUILD.md, RELEASE.md, DEPLOYMENT.md
- TROUBLESHOOTING.md, ARCHITECTURE.md
- API.md (auto-generated OpenAPI)

### 10.7 Production Sign-Off Gate
Release only when:
- Zero critical bugs
- Zero high-priority bugs
- All automated tests pass
- Performance budgets met
- QA checklist complete
- Release artifacts generated
- Documentation complete

---

## File Structure (Post-Implementation)

```
rosaefinity/
├── electron/
│   ├── main.cjs
│   ├── preload.cjs
│   ├── path-resolver.cjs
│   ├── error-handler.cjs
│   ├── logger.cjs
│   ├── memory-manager.cjs
│   ├── crash-recovery.cjs
│   ├── service-monitor.cjs
│   ├── auto-updater.cjs
│   ├── ipc-security.cjs
│   └── backend/
├── server/
│   ├── src/modules/
│   ├── prisma/
│   └── openapi/
├── src/
│   ├── services/auth/
│   ├── services/license/
│   ├── services/sync/
│   ├── services/auto-update/
│   ├── services/server/
│   ├── store/
│   ├── components/auth/
│   ├── components/ui/
│   ├── pages/
│   ├── hooks/
│   ├── lib/
│   └── __tests__/
├── docs/
├── scripts/
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## Implementation Order

1. **Phase 1** — Black screen fix (unblocks everything)
2. **Phase 2** — Stability (foundation for reliability)
3. **Phase 3** — Auth (required for Phase 4-7)
4. **Phase 4** — License (builds on auth)
5. **Phase 5** — Auto Update (independent, can parallel with 4)
6. **Phase 6** — Server (required for Phase 7)
7. **Phase 7** — Cloud Sync (requires server)
8. **Phase 8** — Polish (after features stable)
9. **Phase 9** — Performance (after polish)
10. **Phase 10** — Final QA (last, gates release)

Each phase must pass build before continuing to the next.
