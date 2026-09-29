// =============================================
// RosaeFinity TTS Text Sanitization
// =============================================

import type { TTSSettings } from '../../types/tts';

/**
 * Sanitize text for TTS
 * - trim whitespace
 * - reject empty strings
 * - truncate to maxTextLength
 * - normalize excessive whitespace
 * - safely handle Unicode/emojis
 */
export function sanitizeForTTS(text: string, settings: TTSSettings): string | null {
  if (!text || typeof text !== 'string') {
    return null;
  }

  // Trim whitespace
  let sanitized = text.trim();

  // Reject empty strings
  if (!sanitized) {
    return null;
  }

  // Normalize excessive whitespace (multiple spaces, tabs, newlines)
  sanitized = sanitized.replace(/\s+/g, ' ');

  // Truncate to maxTextLength
  const maxLength = Math.max(1, Math.floor(settings.maxTextLength || 200));
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength).trim();
  }

  // Final empty check after truncation
  if (!sanitized) {
    return null;
  }

  return sanitized;
}

/**
 * Get sanitization preview for UI
 */
export function getSanitizationPreview(text: string, settings: TTSSettings): {
  original: string;
  sanitized: string | null;
  wasModified: boolean;
  wasTruncated: boolean;
} {
  const original = text || '';
  const sanitized = sanitizeForTTS(text, settings);
  const wasModified = original !== sanitized;
  const wasTruncated = sanitized !== null && original.length > (settings.maxTextLength || 200);

  return {
    original,
    sanitized,
    wasModified,
    wasTruncated,
  };
}