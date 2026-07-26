# Overlay Studio — Implementation Plan

> Sprint 3: Overlay customization editor with live preview
> Extends BaseOverlayConfig with new fields + builds a TikFinity-style studio UI

---

## Phase 1: Extend BaseOverlayConfig

### New Fields

| Field | Type | Default | Section |
|-------|------|---------|---------|
| `letterSpacing` | `number` | `0` | Typography |
| `lineHeight` | `number` | `1.5` | Typography |
| `animationDelay` | `number` | `0` | Animation |
| `animationEasing` | `string` | `'ease'` | Animation |
| `animationLoop` | `boolean` | `false` | Animation |
| `cooldown` | `number` | `0` | Behavior |

**Type constraints:**
- `letterSpacing`: px units, range -2 to 10, step 0.1
- `lineHeight`: unitless multiplier, range 0.5 to 3, step 0.1
- `animationDelay`: ms, range 0 to 5000, step 50
- `animationEasing`: typed as `'ease' | 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'` (union, not free string). Default `'ease'`
- `animationLoop`: boolean toggle
- `cooldown`: seconds, range 0 to 60, step 1. Default `0` = no cooldown

**Note:** `animationEasing` is distinct from the existing `transition` field. `transition` controls the entrance/exit animation preset (fade, slide, bounce, etc.). `animationEasing` controls the CSS timing function within those animations.

### Files Changed (Phase 1)

| # | File | Change |
|---|------|--------|
| 1 | `src/overlays/types.ts` | Add 6 fields to `BaseOverlayConfig` interface |
| 2 | `src/overlays/base/constants.ts` | Add 6 new `DEFAULT_*` constants |
| 3 | `src/overlays/createConfig.ts` | Add 6 fields to `baseOverlayDefaults` |

**Total: 3 files modified. 0 files created. 0 files deleted.**

### Backward Compatibility Strategy

1. **Type safety**: All new fields are optional in the interface (marked with `?` initially, then filled by defaults). Since every overlay config `extends BaseOverlayConfig`, adding optional fields is non-breaking — TypeScript won't complain about missing properties.

2. **Serialization**: Existing saved configs in `localStorage` (`rf-overlay-instances`) won't have the new fields. The `createOverlayConfig()` factory merges `baseOverlayDefaults` (which now includes new fields) with the module's `defaultConfig`. When the store loads an existing instance, its `config` object won't have the new fields, but `BaseOverlay.tsx` and renderers will read them with fallback defaults via a `resolveConfig()` helper.

3. **Runtime fallback**: A `resolveConfig(config)` helper in `createConfig.ts` ensures any missing fields get filled from defaults. Called once when loading from store, not on every render.

4. **No migration needed**: The `migrateConfig` function on each overlay module handles version-based migration. Since we're only ADDING optional fields with defaults, no existing migration logic needs to change.

---

## Phase 2: Overlay Studio

### Component Tree

```
OverlayStudioPage (src/pages/OverlayStudioPage.tsx)
├── Header
│   ├── BackButton → /overlays
│   ├── OverlayName (editable)
│   └── Tabs: [Customize] [Browser Source]
├── SplitPanel
│   ├── Left: PreviewPanel (60%)
│   │   ├── OverlayPreview (existing)
│   │   └── BrowserSourceUrl (copy button)
│   └── Right: SettingsPanel (40%, scrollable)
│       ├── SectionCard: Layout
│       │   ├── SliderControl: X Position
│       │   ├── SliderControl: Y Position
│       │   ├── SliderControl: Width
│       │   ├── SliderControl: Height
│       │   ├── SliderControl: Scale
│       │   ├── SliderControl: Rotation
│       │   └── ResetButton
│       ├── SectionCard: Appearance
│       │   ├── SliderControl: Opacity
│       │   ├── ColorControl: Background Color
│       │   ├── SliderControl: Border Radius
│       │   ├── SliderControl: Border Width
│       │   ├── ColorControl: Border Color
│       │   ├── ToggleControl: Shadow Enabled
│       │   ├── ColorControl: Shadow Color
│       │   ├── SliderControl: Shadow Blur
│       │   ├── SliderControl: Shadow Offset X
│       │   ├── SliderControl: Shadow Offset Y
│       │   └── ResetButton
│       ├── SectionCard: Typography
│       │   ├── FontSelector: Font Family
│       │   ├── SliderControl: Font Size
│       │   ├── SliderControl: Font Weight
│       │   ├── SliderControl: Letter Spacing
│       │   ├── SliderControl: Line Height
│       │   ├── ColorControl: Text Color
│       │   └── ResetButton
│       ├── SectionCard: Animation
│       │   ├── AnimationSelector: Entrance Animation
│       │   ├── AnimationSelector: Exit Animation
│       │   ├── SliderControl: Duration
│       │   ├── SliderControl: Animation Speed
│       │   ├── SliderControl: Animation Delay
│       │   ├── DropdownControl: Animation Easing
│       │   ├── ToggleControl: Animation Loop
│       │   └── ResetButton
│       ├── SectionCard: Behavior
│       │   ├── SliderControl: Max Items
│       │   ├── SliderControl: Cooldown
│       │   ├── ToggleControl: Visible (maps to config.visible)
│       │   └── ResetButton
│       ├── ResetAllButton (resets ALL sections)
│       ├── Divider
│       └── SchemaSettings (overlay-specific settings)
│           └── Rendered from module.settingsSchema
```

### New Reusable Controls

| Component | File | Purpose |
|-----------|------|---------|
| `SliderControl` | `src/components/studio/controls/SliderControl.tsx` | Labeled range slider with numeric readout |
| `ColorControl` | `src/components/studio/controls/ColorControl.tsx` | Color picker with hex input + swatch |
| `ToggleControl` | `src/components/studio/controls/ToggleControl.tsx` | Boolean toggle switch |
| `DropdownControl` | `src/components/studio/controls/DropdownControl.tsx` | Select dropdown |
| `FontSelector` | `src/components/studio/controls/FontSelector.tsx` | Font family dropdown with preview |
| `AnimationSelector` | `src/components/studio/controls/AnimationSelector.tsx` | Animation preset picker |
| `NumberControl` | `src/components/studio/controls/NumberControl.tsx` | Number input with +/- buttons |
| `SectionCard` | `src/components/studio/SectionCard.tsx` | Collapsible section with reset button |
| `ResetButton` | `src/components/studio/ResetButton.tsx` | Small reset icon per section |
| `OverlayStudio` | `src/components/studio/OverlayStudio.tsx` | Main studio component |

### Control Interfaces

Every control follows the same pattern:

```typescript
interface ControlProps {
  label: string;
  value: number | string | boolean;
  onChange: (value: number | string | boolean) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}
```

`SectionCard` interface:

```typescript
interface SectionCardProps {
  title: string;
  icon: React.ReactNode;
  defaultValues: Record<string, unknown>;
  onReset: () => void;
  children: React.ReactNode;
  defaultOpen?: boolean;
}
```

### Section Reset Strategy

Each `SectionCard` knows its default values (from `baseOverlayDefaults` + module defaults). On reset:
1. `SectionCard` calls `onReset(defaultValues)`
2. `OverlayStudio` spreads the reset values into the current config: `store.updateConfig(id, { ...currentConfig, ...resetValues })`
3. Preview re-renders with updated config

"Reset All" merges ALL section defaults into one object and calls `updateConfig` once. No new store methods needed — `updateConfig` already accepts a full config object.

### Files Created (Phase 2)

| # | File | Purpose |
|---|------|---------|
| 1 | `src/components/studio/OverlayStudio.tsx` | Main studio component |
| 2 | `src/components/studio/SectionCard.tsx` | Collapsible section with reset |
| 3 | `src/components/studio/ResetButton.tsx` | Reset icon button |
| 4 | `src/components/studio/controls/SliderControl.tsx` | Range slider control |
| 5 | `src/components/studio/controls/ColorControl.tsx` | Color picker control |
| 6 | `src/components/studio/controls/ToggleControl.tsx` | Toggle switch control |
| 7 | `src/components/studio/controls/DropdownControl.tsx` | Select dropdown control |
| 8 | `src/components/studio/controls/FontSelector.tsx` | Font family selector |
| 9 | `src/components/studio/controls/AnimationSelector.tsx` | Animation preset picker |
| 10 | `src/components/studio/controls/NumberControl.tsx` | Number input control |
| 11 | `src/pages/OverlayStudioPage.tsx` | Page route wrapper |

**Total: 11 files created.**

### Files Modified (Phase 2)

| # | File | Change |
|---|------|--------|
| 1 | `src/App.tsx` | Add route: `/studio/:instanceId` → `OverlayStudioPage` |
| 2 | `src/pages/OverlayGallery.tsx` | Change customize navigation to `/studio/:id` |
| 3 | `src/pages/components/OverlayCard.tsx` | Change customize navigation to `/studio/:id` |

**Total: 3 files modified.**

### Design Tokens (consistent with RosaeFinity)

```css
/* Section card */
bg: #18181f → border: #262631 → radius: 12px → padding: 16px

/* Control label */
text: white/50 → font-size: 11px → uppercase tracking-wider

/* Control value readout */
text: white/70 → font-size: 12px → font-mono

/* Slider track */
bg: white/[0.06] → accent: #7c3aed (purple)

/* Reset button */
text: white/20 → hover: white/40 → size: 20px

/* Collapsible chevron */
text: white/30 → transition: transform 0.2s
```

### Performance

- All controls use `React.memo` to prevent unnecessary re-renders
- `onChange` fires on every slider movement for live preview
- `onCommit` (on mouse-up / blur) triggers store persistence
- Config updates use `useCallback` to maintain referential stability
- `SectionCard` collapse state is local, not in store

---

## Implementation Order

| Step | What | Depends on |
|------|------|-----------|
| 1 | Add fields to `BaseOverlayConfig` | — |
| 2 | Add `DEFAULT_*` constants | Step 1 |
| 3 | Update `baseOverlayDefaults` + `createOverlayConfig` | Step 2 |
| 4 | Add `resolveConfig()` helper | Step 3 |
| 5 | Build reusable controls (SliderControl, ColorControl, etc.) | — |
| 6 | Build SectionCard + ResetButton | — |
| 7 | Build OverlayStudio component | Steps 4, 5, 6 |
| 8 | Build OverlayStudioPage | Step 7 |
| 9 | Add route + update navigation | Step 8 |
| 10 | Test all overlays render correctly | Step 9 |
