// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RosaeFinity Animation Engine â€” Animation Provider
// v3.1 Architecture Spec (Frozen)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import React, { useEffect, useMemo } from 'react';
import { AnimationContext, type AnimationContextValue } from './AnimationContext';
import { getAnimationManager } from './AnimationManager';

interface AnimationProviderProps {
  children: React.ReactNode;
}

export function AnimationProvider({ children }: AnimationProviderProps): React.ReactElement {
  const manager = useMemo(() => getAnimationManager(), []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      manager.destroy();
    };
  }, [manager]);

  // Listen for reduced motion
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    manager.setReducedMotion(mq.matches);

    const handler = (e: MediaQueryListEvent) => manager.setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [manager]);

  const contextValue: AnimationContextValue = useMemo(() => ({ manager }), [manager]);

  return (
    <AnimationContext.Provider value={contextValue}>
      {children}
    </AnimationContext.Provider>
  );
}
