// =============================================
// Overlay Repository Interface — Storage-agnostic
// contract for overlay persistence.
// =============================================

import type { Overlay } from '../../types/overlay-types';

export interface OverlayRepository {
  save(overlay: Overlay): Promise<void>;
  load(id: string): Promise<Overlay | null>;
  delete(id: string): Promise<void>;
  list(): Promise<Overlay[]>;
  update(id: string, patch: Partial<Overlay>): Promise<void>;
}
