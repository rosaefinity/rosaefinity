# Stream Profile System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the RosaeFinity Stream Profile system with top-right header placement, Profile 1 (Free) vs Profiles 1–10 (Pro) entitlement enforcement, profile name/icon customization, profile configuration data isolation, and removal of any points/coin indicator in the header.

**Architecture:** Extend `StreamProfile` in `src/types/index.ts`, add `getMaxStreamProfiles` selector in `useLicenseStore`, enhance `useAppStore` with 10 pre-seeded profiles and profile snapshotting on profile switch, build `ProfileSettingsModal` for name/icon editing, and integrate `ProfileSelector` into `<Header />` mounted in `AppLayout.tsx`.

**Tech Stack:** React 19, TypeScript 6.0, Zustand (with persist middleware), Lucide React icons, Framer Motion animations, Tailwind CSS.

## Global Constraints
- Free tier max profiles: 1.
- Pro tier max profiles: 10.
- Profile selector located in TOP-RIGHT application header next to User/Account menu.
- NO points/coin indicator between selector and account.
- File modifications must follow existing type definitions, imports, and styling conventions.

---

### Task 1: Type Definitions and License Entitlement Helper

**Files:**
- Modify: `src/types/index.ts:316-326`
- Modify: `src/store/license-store.ts:30-49`
- Modify: `src/store/license-store.ts:163-183`

**Interfaces:**
- Consumes: Existing `LicenseStore` and `StreamProfile` definitions.
- Produces: `StreamProfile.icon?: string`, `getMaxStreamProfiles(): number` selector on `useLicenseStore`.

- [ ] **Step 1: Update StreamProfile interface in `src/types/index.ts`**

Edit `src/types/index.ts` to include optional `icon` property:

```typescript
export interface StreamProfile {
  id: string;
  name: string;
  icon?: string;
  tiktokUsername: string;
  overlaySettings: any;
  alertsSettings: any;
  actions: Action[];
  events: Event[];
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Add `getMaxStreamProfiles` method interface to `LicenseStore` in `src/store/license-store.ts`**

Add signature under `Centralized subscription state`:

```typescript
  /** Max stream profiles allowed: 10 if Pro active, 1 otherwise */
  getMaxStreamProfiles: () => number;
```

- [ ] **Step 3: Implement `getMaxStreamProfiles` in `useLicenseStore` implementation in `src/store/license-store.ts`**

```typescript
    getMaxStreamProfiles: () => {
      const { effectivePlan } = get();
      return effectivePlan() === 'pro' ? 10 : 1;
    },
```

- [ ] **Step 4: Verify TypeScript build**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit changes**

```bash
git add src/types/index.ts src/store/license-store.ts
git commit -m "feat(license): add icon to StreamProfile and getMaxStreamProfiles entitlement selector"
```

---

### Task 2: Profile Store State, Seeding, Data Isolation & Enforcement

**Files:**
- Modify: `src/store/app-store.ts`

**Interfaces:**
- Consumes: `StreamProfile`, `getMaxStreamProfiles` from `useLicenseStore`.
- Produces: 10 default profiles seeded in `useAppStore`, `switchProfile(id)` with data isolation snapshotting and entitlement enforcement.

- [ ] **Step 1: Define DEFAULT_STREAM_PROFILES constant in `src/store/app-store.ts`**

Create 10 pre-seeded profiles:

```typescript
const DEFAULT_STREAM_PROFILES: StreamProfile[] = [
  { id: "profile-1", name: "Stream Profile 1", icon: "🌹", tiktokUsername: "", overlaySettings: {}, alertsSettings: {}, actions: [], events: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-2", name: "Stream Profile 2", icon: "🔥", tiktokUsername: "", overlaySettings: {}, alertsSettings: {}, actions: [], events: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-3", name: "Stream Profile 3", icon: "🎮", tiktokUsername: "", overlaySettings: {}, alertsSettings: {}, actions: [], events: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-4", name: "Stream Profile 4", icon: "❤️", tiktokUsername: "", overlaySettings: {}, alertsSettings: {}, actions: [], events: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-5", name: "Stream Profile 5", icon: "💬", tiktokUsername: "", overlaySettings: {}, alertsSettings: {}, actions: [], events: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-6", name: "Stream Profile 6", icon: "🎁", tiktokUsername: "", overlaySettings: {}, alertsSettings: {}, actions: [], events: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-7", name: "Stream Profile 7", icon: "🙂", tiktokUsername: "", overlaySettings: {}, alertsSettings: {}, actions: [], events: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-8", name: "Stream Profile 8", icon: "👍", tiktokUsername: "", overlaySettings: {}, alertsSettings: {}, actions: [], events: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-9", name: "Stream Profile 9", icon: "📞", tiktokUsername: "", overlaySettings: {}, alertsSettings: {}, actions: [], events: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-10", name: "Stream Profile 10", icon: "☑️", tiktokUsername: "", overlaySettings: {}, alertsSettings: {}, actions: [], events: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];
```

- [ ] **Step 2: Update initial store state for streamProfiles and currentProfileId in `src/store/app-store.ts`**

Set `streamProfiles: DEFAULT_STREAM_PROFILES` and `currentProfileId: "profile-1"`.

- [ ] **Step 3: Implement switchProfile action in `src/store/app-store.ts` with data isolation & enforcement**

```typescript
      switchProfile: (targetId: string) => {
        const { streamProfiles, currentProfileId, actions, events, alertSettings, setupConfig } = get();
        if (targetId === currentProfileId) return;

        // Entitlement check
        const maxProfiles = useLicenseStore.getState().getMaxStreamProfiles();
        const targetIndex = streamProfiles.findIndex(p => p.id === targetId);
        if (targetIndex < 0 || targetIndex >= maxProfiles) {
          console.warn(`[PROFILE-ENFORCEMENT] Profile index ${targetIndex} blocked (max ${maxProfiles})`);
          return;
        }

        const updatedProfiles = streamProfiles.map(p => {
          if (p.id === currentProfileId) {
            return {
              ...p,
              actions,
              events,
              alertsSettings: alertSettings,
              tiktokUsername: setupConfig.tikTokName,
              updatedAt: new Date().toISOString(),
            };
          }
          return p;
        });

        const targetProfile = updatedProfiles.find(p => p.id === targetId);
        if (!targetProfile) return;

        set({
          streamProfiles: updatedProfiles,
          currentProfileId: targetId,
          actions: targetProfile.actions || [],
          events: targetProfile.events || [],
          alertSettings: targetProfile.alertsSettings || DEFAULT_ALERTS,
          setupConfig: { ...setupConfig, tikTokName: targetProfile.tiktokUsername || "" },
        });
      },
```

- [ ] **Step 4: Update `addProfile`, `updateProfile`, and `deleteProfile` actions in `useAppStore`**

Ensure `addProfile` respects entitlement, `updateProfile` persists name/icon updates, and `switchProfile` is exposed in `AppStore` interface.

- [ ] **Step 5: Verify TypeScript build**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 6: Commit changes**

```bash
git add src/store/app-store.ts
git commit -m "feat(profiles): seed 10 default profiles, add profile switching data isolation and entitlement enforcement"
```

---

### Task 3: Profile Settings Modal (`ProfileSettingsModal`)

**Files:**
- Create: `src/components/profile/ProfileSettingsModal.tsx`

**Interfaces:**
- Consumes: `StreamProfile`, `useAppStore.updateProfile`.
- Produces: `ProfileSettingsModal` component.

- [ ] **Step 1: Create `src/components/profile/ProfileSettingsModal.tsx`**

Write the modal component supporting name editing (validated, non-empty, max 30 chars), icon selection, cancel, and save handlers:

```tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera } from "lucide-react";
import type { StreamProfile } from "../../types";
import { useAppStore } from "../../store/app-store";

const PROFILE_ICONS = ["🌹", "🔥", "🎮", "❤️", "💬", "🎁", "🙂", "👍", "📞", "☑️", "🎵", "⭐"];

interface ProfileSettingsModalProps {
  profile: StreamProfile | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileSettingsModal({ profile, isOpen, onClose }: ProfileSettingsModalProps) {
  if (!isOpen || !profile) return null;

  const updateProfile = useAppStore(s => s.updateProfile);
  const [name, setName] = useState(profile.name);
  const [icon, setIcon] = useState(profile.icon || "🌹");
  const [error, setError] = useState("");

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Nama profil tidak boleh kosong");
      return;
    }
    if (trimmed.length > 30) {
      setError("Nama profil maksimal 30 karakter");
      return;
    }

    updateProfile(profile.id, { name: trimmed, icon });
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md rounded-2xl bg-[#16161e] border border-white/10 p-6 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h2 className="text-lg font-bold text-white">Pengaturan Profil</h2>
            <button onClick={onClose} className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Profile Icon Preview */}
          <div className="flex flex-col items-center my-6">
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/30 to-secondary/30 border border-primary/40 flex items-center justify-center text-4xl shadow-inner">
              {icon}
              <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-background border border-white/20 text-white/70">
                <Camera className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Profile Name Input */}
          <div className="space-y-2 mb-5">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider">Nama Profil</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              maxLength={30}
              placeholder="Stream Profile 1"
              className="w-full h-10 px-3.5 rounded-xl bg-white/[0.05] border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-primary transition-all"
            />
            {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
          </div>

          {/* Icon Picker Grid */}
          <div className="space-y-2 mb-6">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider">Pilih Icon</label>
            <div className="grid grid-cols-4 gap-2.5">
              {PROFILE_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={`h-11 rounded-xl text-xl flex items-center justify-center border transition-all ${
                    icon === ic
                      ? "bg-primary/20 border-primary shadow-[0_0_12px_rgba(124,58,237,0.4)] scale-105"
                      : "bg-white/[0.03] border-white/10 hover:bg-white/[0.08]"
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              onClick={onClose}
              className="px-4 h-9 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              className="px-5 h-9 rounded-xl text-sm font-medium bg-gradient-to-r from-primary to-secondary text-white hover:shadow-lg hover:shadow-primary/30 active:scale-95 transition-all"
            >
              Simpan
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit component**

```bash
git add src/components/profile/ProfileSettingsModal.tsx
git commit -m "feat(ui): add ProfileSettingsModal component for profile name and icon customization"
```

---

### Task 4: Profile Selector Component, Header Integration & App Layout

**Files:**
- Create: `src/components/profile/ProfileSelector.tsx`
- Modify: `src/components/header/Header.tsx`
- Modify: `src/components/layout/AppLayout.tsx`

**Interfaces:**
- Consumes: `useAppStore`, `useLicenseStore`, `ProfileSettingsModal`.
- Produces: `ProfileSelector` dropdown in top-right header adjacent to user account.

- [ ] **Step 1: Create `src/components/profile/ProfileSelector.tsx`**

Write `ProfileSelector` rendering `[ 🌹 Stream Profile 1 ▾ ]` and dropdown handling Free vs Pro states:

```tsx
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Settings, Lock, Crown } from "lucide-react";
import { useAppStore } from "../../store/app-store";
import { useLicenseStore } from "../../store/license-store";
import { ProfileSettingsModal } from "./ProfileSettingsModal";
import type { StreamProfile } from "../../types";
import { useNavigate } from "react-router-dom";

export function ProfileSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<StreamProfile | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const streamProfiles = useAppStore((s) => s.streamProfiles);
  const currentProfileId = useAppStore((s) => s.currentProfileId);
  const switchProfile = useAppStore((s) => s.switchProfile);
  const getMaxStreamProfiles = useLicenseStore((s) => s.getMaxStreamProfiles);
  const isPro = useLicenseStore((s) => s.isProActive());

  const maxProfiles = getMaxStreamProfiles();
  const activeProfile = streamProfiles.find((p) => p.id === currentProfileId) || streamProfiles[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectProfile = (profile: StreamProfile, index: number) => {
    if (index >= maxProfiles) return; // Blocked for Free users
    switchProfile(profile.id);
    setIsOpen(false);
  };

  const handleOpenSettings = (e: React.MouseEvent, profile: StreamProfile) => {
    e.stopPropagation();
    setEditingProfile(profile);
    setIsOpen(false);
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Selector Trigger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 h-9 px-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white text-sm font-medium transition-all"
        >
          <span className="text-base">{activeProfile?.icon || "🌹"}</span>
          <span className="truncate max-w-[130px]">{activeProfile?.name || "Stream Profile 1"}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-white/50 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {/* Dropdown Menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-[#16161e] border border-white/10 shadow-2xl overflow-hidden z-50 p-2 space-y-1"
            >
              {/* Menu Title */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] mb-1">
                <span className="text-xs font-semibold text-white/60">Profil Streaming Saya</span>
                {isPro && (
                  <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-primary/30 to-secondary/30 text-primary text-[10px] font-bold border border-primary/30 uppercase">
                    PRO
                  </span>
                )}
              </div>

              {/* Profiles List */}
              <div className="max-h-72 overflow-y-auto space-y-1 pr-0.5 scrollbar-thin">
                {streamProfiles.map((profile, index) => {
                  const isUsable = index < maxProfiles;
                  const isActive = profile.id === currentProfileId;

                  return (
                    <div
                      key={profile.id}
                      onClick={() => isUsable && handleSelectProfile(profile, index)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
                        isUsable
                          ? isActive
                            ? "bg-primary/20 border border-primary/30 text-white cursor-pointer"
                            : "hover:bg-white/[0.06] text-white/80 cursor-pointer"
                          : "opacity-40 text-white/40 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base">{profile.icon || "🌹"}</span>
                        <span className="text-sm font-medium truncate">{profile.name}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isActive && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-success/20 text-success border border-success/30">
                            Aktif
                          </span>
                        )}
                        {isUsable && (
                          <button
                            onClick={(e) => handleOpenSettings(e, profile)}
                            className="p-1 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-all"
                            title="Pengaturan Profil"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Free Plan Lock Banner */}
              {!isPro && (
                <div className="mt-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-center space-y-2">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-white/70">
                    <Lock className="w-3.5 h-3.5 text-warning" />
                    <span>Profile lainnya hanya tersedia untuk Pro</span>
                  </div>
                  <button
                    onClick={() => { setIsOpen(false); navigate("/payment"); }}
                    className="w-full h-8 rounded-lg bg-gradient-to-r from-primary to-secondary text-white text-xs font-medium flex items-center justify-center gap-1.5 hover:shadow-md transition-all"
                  >
                    <Crown className="w-3.5 h-3.5" /> Upgrade ke Pro
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Settings Modal */}
      <ProfileSettingsModal
        profile={editingProfile}
        isOpen={!!editingProfile}
        onClose={() => setEditingProfile(null)}
      />
    </>
  );
}
```

- [ ] **Step 2: Embed `ProfileSelector` into `Header.tsx` in top-right controls next to user account**

Edit `src/components/header/Header.tsx` to include `<ProfileSelector />` right before the User dropdown menu in the top-right controls area:

```tsx
import { ProfileSelector } from "../profile/ProfileSelector";
...
        {/* Stream Profile Selector */}
        <ProfileSelector />

        {/* User */}
        <div className="relative">
          ...
```

Verify that no points/coin indicator (`🟡 25` or similar) exists in the header.

- [ ] **Step 3: Mount `<Header />` in `AppLayout.tsx`**

Edit `src/components/layout/AppLayout.tsx`:

```tsx
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "../sidebar/Sidebar";
import { Header } from "../header/Header";
import { AnimatePresence, motion } from "framer-motion";

export function AppLayout() {
  const location = useLocation();

  return (
    <div className="h-screen flex bg-background text-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="h-9 shrink-0 title-bar" />
        <Header />
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="min-h-full">
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify full application build**

Run: `npx tsc --noEmit` and `npm run build`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit complete implementation**

```bash
git add src/components/profile/ProfileSelector.tsx src/components/header/Header.tsx src/components/layout/AppLayout.tsx
git commit -m "feat(header): add ProfileSelector component, mount Header in AppLayout, enforce Pro entitlement"
```
