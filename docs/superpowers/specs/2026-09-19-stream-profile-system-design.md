# Stream Profile System Design Specification

## Overview
The Stream Profile System provides streamers with selectable configuration profiles in RosaeFinity. Free tier users are limited to 1 profile, while Pro tier subscribers unlock up to 10 isolated profiles.

## Goals & Entitlements
1. **Free Tier**: 1 usable profile (`Profile 1`). Profiles 2–10 are locked and cannot be activated.
2. **Pro Tier**: Up to 10 usable profiles (`Profiles 1–10`). Can switch between profiles seamlessly.
3. **Data Isolation**: Each profile maintains independent configuration for actions, events, alert settings, and TikTok connection details.
4. **UI Integration**: Profile selector dropdown placed in the top-right application header next to the User Account menu. Points/coin indicator removed.

## Entitlement Architecture
Centralized in `src/store/license-store.ts`:
- `getMaxStreamProfiles()` selector returning `10` when `effectivePlan() === 'pro'`, otherwise `1`.
- Direct enforcement at both store level (`switchProfile`) and UI level (disabled locked profile cards).

## Data Model & Types
Updated `StreamProfile` in `src/types/index.ts`:
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

## Default Profiles
Pre-seeded 10 profiles in `app-store.ts`:
1. `stream-profile-1`: "Stream Profile 1", icon: `🌹`
2. `stream-profile-2`: "Stream Profile 2", icon: `🔥`
3. `stream-profile-3`: "Stream Profile 3", icon: `🎮`
4. `stream-profile-4`: "Stream Profile 4", icon: `❤️`
5. `stream-profile-5`: "Stream Profile 5", icon: `💬`
6. `stream-profile-6`: "Stream Profile 6", icon: `🎁`
7. `stream-profile-7`: "Stream Profile 7", icon: `🙂`
8. `stream-profile-8`: "Stream Profile 8", icon: `👍`
9. `stream-profile-9`: "Stream Profile 9", icon: `📞`
10. `stream-profile-10`: "Stream Profile 10", icon: `☑️`

## Components & UI Flow
1. **Header Placement** (`src/components/header/Header.tsx`):
   - Mounted in `AppLayout.tsx`.
   - Top-right layout: `[ 🌹 Stream Profile 1 ▾ ] [ User / Account ]`.
   - No points/coin indicator between selector and account.
2. **Profile Selector Dropdown**:
   - Displays active profile with "Aktif" badge.
   - Pro users can click any profile to switch or click `⚙` gear icon to open settings.
   - Free users see Profiles 2–10 locked with `🔒 Profile lainnya hanya tersedia untuk Pro` and `[ Upgrade ke Pro ]`.
3. **Profile Settings Modal**:
   - Allows changing Profile Name (validated, non-empty, max 30 chars).
   - Allows selecting icon from predefined emoji set (`🌹`, `🔥`, `🎮`, `❤️`, `💬`, `🎁`, `🙂`, `👍`, `📞`, `☑️`, `🎵`, `⭐`).
   - Supports Save and Cancel options.

## Testing Strategy
- **Free Account Test**: Verify 1 profile usable, profiles 2–10 locked, upgrade CTA active, name/icon edit works on Profile 1.
- **Pro Account Test**: Verify switching between 10 profiles, full state isolation, name/icon editing, and persistence after app restart.
- **Header Verification**: Confirm top-right selector placement and absence of points/coin counter.
- **Regression Check**: Verify live connection, actions, events, sounds, media, and overlay rendering remain unaffected.
