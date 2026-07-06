# Task 3 Report: Overlay Registry

**Status:** COMPLETE

## Files Created

| File | Purpose |
|------|---------|
| `src/overlays/registry.ts` | Static registry with frozen array and indexed Maps |
| `src/overlays/index.ts` | Barrel re-exporting all overlay types, helpers, and registry |
| `src/overlays/__tests__/registry.test.ts` | 10 tests covering all registry behavior |

## Implementation Details

### Design Decisions

1. **Indexed Maps built once at module load.** Two Maps are constructed when the module initializes:
   - `byId`: `Map<string, AnyOverlayModule>` for O(1) id lookup
   - `byCategory`: `Map<string, readonly AnyOverlayModule[]>` for O(1) category filtering

2. **`Object.freeze()` on the registry array** and on each category bucket array. Runtime mutation is impossible.

3. **Duplicate id detection at module load.** The `registryBuilder` function iterates once, using a `Set<string>` to detect duplicates and throws immediately.

4. **Exported `registryBuilder`** for testing and potential future dynamic registration. The internal Maps are not exported — only the public lookup helpers are.

### Helpers Provided

| Function | Signature | Notes |
|----------|-----------|-------|
| `getOverlayModule(id)` | `(id: string) => AnyOverlayModule \| undefined` | O(1) Map lookup |
| `getOverlayModules()` | `() => readonly AnyOverlayModule[]` | Returns frozen array |
| `getOverlaysByCategory(category)` | `(category: string) => readonly AnyOverlayModule[]` | O(1) Map lookup, returns `[]` if unknown |
| `hasOverlay(id)` | `(id: string) => boolean` | O(1) Map.has |
| `registryBuilder(modules)` | `(modules: AnyOverlayModule[]) => RegistryResult` | Builds frozen registry + Maps; throws on duplicate ids |

### Constraints Met

- No `any` types
- Framework-agnostic (no React/Zustand/Dexie imports)
- Single source of truth (registry array is the source; Maps are derived indexes)
- Registry is frozen/readonly after initialization
- All lookups are Map-based, not array scans

## Test Results

```
Test Files  1 passed (1)
Tests       10 passed (10)
Duration    160ms
```

Tests cover: frozen registry, getOverlayModule, getOverlayModules, getOverlaysByCategory, hasOverlay, duplicate detection, and registryBuilder internals.
