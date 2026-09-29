// =============================================
// RosaeFinity TTS Filters
// =============================================

import type { TTSFilterMode, TTSSettings } from '../../types/tts';

/**
 * Check if a comment should be read by TTS based on filter mode
 */
export function shouldReadComment(comment: string, settings: TTSSettings): boolean {
  if (!comment || !comment.trim()) {
    return false;
  }

  const trimmed = comment.trim();

  switch (settings.filterMode) {
    case 'any':
      // Accept every non-empty comment
      return true;

    case 'dot':
      // Only comments starting with "."
      return trimmed.startsWith('.');

    case 'slash':
      // Only comments starting with "/"
      return trimmed.startsWith('/');

    case 'command':
      // Only comments starting with the configured command prefix
      const prefix = settings.commandPrefix?.trim() || '!';
      return trimmed.startsWith(prefix);

    default:
      // Unknown filter mode - default to any for safety
      return true;
  }
}

/**
 * Get the filter mode display label
 */
export function getFilterModeLabel(mode: TTSFilterMode): string {
  switch (mode) {
    case 'any':
      return 'Any comment';
    case 'dot':
      return 'Starts with "."';
    case 'slash':
      return 'Starts with "/"';
    case 'command':
      return 'Command';
    default:
      return 'Any comment';
  }
}

/**
 * Get all available filter modes for UI
 */
export function getAvailableFilterModes(): { value: TTSFilterMode; label: string }[] {
  return [
    { value: 'any', label: 'Any comment' },
    { value: 'dot', label: 'Starts with "."' },
    { value: 'slash', label: 'Starts with "/"' },
    { value: 'command', label: 'Command' },
  ];
}