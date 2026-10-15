// ═══════════════════════════════════════════════════════════════════
// Browser Source URL Helper
// Handles Electron file:// protocol where window.location.hostname is empty
// ═══════════════════════════════════════════════════════════════════

const SSE_PORT = 18890;

/**
 * Returns the correct host for Browser Source URLs.
 * In Electron (file:// protocol), window.location.hostname is empty,
 * so we must default to 127.0.0.1.
 */
export function getBrowserSourceHost(): string {
  // Always use 127.0.0.1 — TikTok LIVE Studio requires this, not "localhost"
  return '127.0.0.1';
}

/**
 * Returns the base SSE server URL for Browser Source connections.
 * Always uses 127.0.0.1 in Electron/production contexts.
 */
export function getSSEBaseUrl(): string {
  if (typeof window === 'undefined') {
    return `http://127.0.0.1:${SSE_PORT}`;
  }

  const protocol = window.location.protocol === 'file:' ? 'http:' : window.location.protocol;
  const host = getBrowserSourceHost();

  return `${protocol}//${host}:${SSE_PORT}`;
}

/**
 * Generates the Browser Source URL for an overlay instance.
 * Used in OBS Browser Source configuration.
 */
export function getBrowserSourceUrl(browserSourceId: string): string {
  return `${getSSEBaseUrl()}/overlay/${browserSourceId}.html`;
}

/**
 * Generates the overlay widget URL with screen parameter.
 * Used for direct overlay-widget.html access with screen filtering.
 */
export function getOverlayWidgetUrl(screen?: string | number, maxQueue?: number): string {
  const baseUrl = `${getSSEBaseUrl()}/overlay-widget.html`;
  if (screen !== undefined && screen !== null && screen !== '') {
    const params = new URLSearchParams();
    params.set('screen', String(screen));
    if (maxQueue !== undefined && maxQueue !== null) {
      params.set('maxQueue', String(maxQueue));
    }
    return `${baseUrl}?${params.toString()}`;
  }
  return baseUrl;
}

/**
 * Generates the SSE events URL for a specific browser source.
 */
export function getSSEEventsUrl(browserSourceId: string): string {
  return `${getSSEBaseUrl()}/overlay/${browserSourceId}/events`;
}

/**
 * Generates the SSE config URL for a specific browser source.
 */
export function getSSEConfigUrl(browserSourceId: string): string {
  return `${getSSEBaseUrl()}/overlay/${browserSourceId}/config`;
}

/**
 * Generates the Browser Source URL for an overlay module.
 * Uses moduleId (deterministic) instead of instanceId.
 * This allows showing a URL even before an instance is created.
 */
export function getBrowserSourceUrlForModule(moduleId: string): string {
  return `${getSSEBaseUrl()}/overlay/${moduleId}`;
}