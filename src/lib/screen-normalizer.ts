// ═══════════════════════════════════════════════════════════════════
// Screen Normalization Utility
// Converts various screen representations to normalized screen ID (e.g., "1")
// ═══════════════════════════════════════════════════════════════════

/**
 * Normalizes a screen value to a consistent screen ID string.
 *
 * Supported input formats:
 * - "Screen 1" → "1"
 * - "Screen 2" → "2"
 * - "screen 3" → "3"
 * - "screen-0" → "0"
 * - "1" → "1"
 * - 1 → "1"
 * - null/undefined → "1" (default)
 *
 * @param screen - The screen value to normalize
 * @param fallback - Fallback screen ID if normalization fails (default: "1")
 * @returns Normalized screen ID string
 */
export function normalizeScreen(screen: string | number | null | undefined, fallback: string = "1"): string {
  if (screen === null || screen === undefined) {
    return fallback;
  }

  const str = String(screen).trim();

  // Handle empty string
  if (str === "") {
    return fallback;
  }

  // Match patterns like "Screen 1", "screen 1", "Screen-1", "screen-1", "screen-0"
  const screenMatch = str.match(/^screen[-\s](\d+)$/i);
  if (screenMatch) {
    return screenMatch[1];
  }

  // Match patterns like "Screen 1" (with space) - more specific than above
  const screenSpaceMatch = str.match(/^screen\s+(\d+)$/i);
  if (screenSpaceMatch) {
    return screenSpaceMatch[1];
  }

  // If it's already just a number (string or numeric), return as string
  const numMatch = str.match(/^(\d+)$/);
  if (numMatch) {
    return numMatch[1];
  }

  // Fallback: try to extract any digit from the string
  const anyDigit = str.match(/(\d+)/);
  if (anyDigit) {
    return anyDigit[1];
  }

  // Default fallback
  return fallback;
}

// Log wrapper for tracing
export function normalizeScreenWithTrace(screen: string | number | null | undefined, fallback: string = "1"): string {
  const normalized = normalizeScreen(screen, fallback);
  console.log('[TIKTOK-OVERLAY-SCREEN-TRACE]', JSON.stringify({
    originalScreen: screen,
    normalizedScreen: normalized,
    timestamp: Date.now(),
  }));
  return normalized;
}

/**
 * Normalizes an action's overlay screen property.
 * Handles action.overlayScreen, action.screen, and falls back to default.
 *
 * @param action - The action object with overlayScreen/screen properties
 * @returns Normalized screen ID string
 */
export function getNormalizedActionScreen(action: { overlayScreen?: string; screen?: string }): string {
  return normalizeScreen(action.overlayScreen || action.screen);
}

/**
 * Audit log helper for screen normalization tracing.
 *
 * @param actionId - The action ID
 * @param actionType - The action type (sound, video, image, keystroke, etc.)
 * @param originalScreen - The original screen value before normalization
 * @param normalizedScreen - The normalized screen value
 * @param overlayType - The overlay payload type being dispatched
 */
export function logScreenTrace(
  actionId: string,
  actionType: string,
  originalScreen: string | number | null | undefined,
  normalizedScreen: string,
  overlayType: string
): void {
  console.log('[TIKTOK-OVERLAY-SCREEN-TRACE]', JSON.stringify({
    actionId,
    actionType,
    originalScreen,
    normalizedScreen,
    overlayType,
    timestamp: Date.now(),
  }));
}