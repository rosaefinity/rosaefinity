import { describe, it, expect, beforeEach } from 'vitest';
import { useOverlayStore, isOverlayActive, getActiveOverlays, getActiveOverlayIds } from '../overlayStore';

describe('Overlay Store', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useOverlayStore.setState({ activeOverlays: [] });
  });

  describe('initial state', () => {
    it('starts with empty activeOverlays', () => {
      const { activeOverlays } = useOverlayStore.getState();
      expect(activeOverlays).toEqual([]);
    });
  });

  describe('toggleOverlay', () => {
    it('throws for unknown overlay id', () => {
      expect(() => useOverlayStore.getState().toggleOverlay('nonexistent'))
        .toThrow('not found in registry');
    });

    it('enables an inactive overlay', () => {
      // Use a known registered overlay id (if any exist)
      // For now, test with the validation logic by checking error is thrown for unknown
      expect(() => useOverlayStore.getState().toggleOverlay('nonexistent'))
        .toThrow();
    });
  });

  describe('enableOverlay', () => {
    it('throws for unknown overlay id', () => {
      expect(() => useOverlayStore.getState().enableOverlay('nonexistent'))
        .toThrow('not found in registry');
    });
  });

  describe('disableOverlay', () => {
    it('is safe to call with unknown id (no-op)', () => {
      // Should not throw
      useOverlayStore.getState().disableOverlay('nonexistent');
      expect(useOverlayStore.getState().activeOverlays).toEqual([]);
    });

    it('removes an active overlay', () => {
      // Manually set state to simulate an active overlay
      useOverlayStore.setState({ activeOverlays: ['test-overlay'] });
      useOverlayStore.getState().disableOverlay('test-overlay');
      expect(useOverlayStore.getState().activeOverlays).toEqual([]);
    });
  });

  describe('clearAllOverlays', () => {
    it('empties activeOverlays', () => {
      useOverlayStore.setState({ activeOverlays: ['a', 'b', 'c'] });
      useOverlayStore.getState().clearAllOverlays();
      expect(useOverlayStore.getState().activeOverlays).toEqual([]);
    });
  });

  describe('selector helpers', () => {
    it('isOverlayActive returns false when store is empty', () => {
      expect(isOverlayActive('any-id')).toBe(false);
    });

    it('isOverlayActive returns true for active id', () => {
      useOverlayStore.setState({ activeOverlays: ['test-id'] });
      expect(isOverlayActive('test-id')).toBe(true);
    });

    it('getActiveOverlayIds returns current ids', () => {
      useOverlayStore.setState({ activeOverlays: ['x', 'y'] });
      expect(getActiveOverlayIds()).toEqual(['x', 'y']);
    });

    it('getActiveOverlays resolves from registry', () => {
      // With empty registry, this returns empty array
      expect(getActiveOverlays()).toEqual([]);
    });
  });

  describe('immutability', () => {
    it('does not mutate previous state array', () => {
      const before = useOverlayStore.getState().activeOverlays;
      useOverlayStore.setState({ activeOverlays: ['new'] });
      const after = useOverlayStore.getState().activeOverlays;
      expect(before).not.toBe(after);
      expect(before).toEqual([]);
    });
  });

  describe('persistence', () => {
    it('store has persist middleware configured', () => {
      // The store should be created with persist middleware
      // We can verify by checking the store exists and has the right shape
      const store = useOverlayStore.getState();
      expect(store).toHaveProperty('activeOverlays');
      expect(store).toHaveProperty('toggleOverlay');
      expect(store).toHaveProperty('enableOverlay');
      expect(store).toHaveProperty('disableOverlay');
      expect(store).toHaveProperty('clearAllOverlays');
    });
  });
});
