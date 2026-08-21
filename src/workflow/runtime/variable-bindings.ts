// =============================================
// RosaeFinity â€” Variable Bindings
// Maps TikTok events to workflow variables.
// Built-in variables available to all workflows.
// =============================================

import type { TikTokEvent } from '../../engine/tiktok/types.js';
import type { GiftCombo } from '../../engine/tiktok/types.js';

// â”€â”€ Built-in Variable Definitions â”€â”€
export interface VariableBinding {
  name: string;
  source: string; // Event field path
  type: 'string' | 'number' | 'boolean';
  description: string;
  defaultValue: unknown;
}

export const BUILTIN_BINDINGS: VariableBinding[] = [
  // User info
  { name: 'username', source: 'data.username', type: 'string', description: 'TikTok username', defaultValue: '' },
  { name: 'uniqueId', source: 'data.uniqueId', type: 'string', description: 'Unique ID', defaultValue: '' },
  { name: 'nickname', source: 'data.nickname', type: 'string', description: 'Display name', defaultValue: '' },
  { name: 'userId', source: 'data.userId', type: 'string', description: 'User ID', defaultValue: '' },
  { name: 'profilePicture', source: 'data.profilePicture', type: 'string', description: 'Profile picture URL', defaultValue: '' },
  { name: 'isSubscriber', source: 'data.isSubscriber', type: 'boolean', description: 'Is subscriber', defaultValue: false },

  // Gift info
  { name: 'giftName', source: 'data.giftName', type: 'string', description: 'Gift name', defaultValue: '' },
  { name: 'giftId', source: 'data.giftId', type: 'string', description: 'Gift ID', defaultValue: '' },
  { name: 'giftCount', source: 'data.giftCount', type: 'number', description: 'Gift count', defaultValue: 1 },
  { name: 'coinValue', source: 'data.diamondCount', type: 'number', description: 'Coin value', defaultValue: 0 },
  { name: 'comboCount', source: 'data.comboCount', type: 'number', description: 'Combo count', defaultValue: 0 },
  { name: 'totalComboCoins', source: 'data.totalComboCoins', type: 'number', description: 'Total combo coins', defaultValue: 0 },

  // Social
  { name: 'likeCount', source: 'data.likeCount', type: 'number', description: 'Like count', defaultValue: 0 },
  { name: 'totalLikeCount', source: 'data.totalLikeCount', type: 'number', description: 'Total likes', defaultValue: 0 },
  { name: 'shareCount', source: 'data.shareCount', type: 'number', description: 'Share count', defaultValue: 0 },
  { name: 'comment', source: 'data.comment', type: 'string', description: 'Comment text', defaultValue: '' },

  // Viewers
  { name: 'viewerCount', source: 'data.viewerCount', type: 'number', description: 'Current viewers', defaultValue: 0 },
  { name: 'totalUser', source: 'data.totalUser', type: 'number', description: 'Total users', defaultValue: 0 },

  // Room
  { name: 'roomId', source: 'data.roomId', type: 'string', description: 'Room ID', defaultValue: '' },
  { name: 'roomTitle', source: 'data.roomTitle', type: 'string', description: 'Room title', defaultValue: '' },

  // Time
  { name: 'timestamp', source: 'timestamp', type: 'number', description: 'Event timestamp', defaultValue: 0 },
  { name: 'hour', source: '_computed.hour', type: 'number', description: 'Current hour (0-23)', defaultValue: 0 },
  { name: 'minute', source: '_computed.minute', type: 'number', description: 'Current minute', defaultValue: 0 },
  { name: 'dayOfWeek', source: '_computed.dayOfWeek', type: 'number', description: 'Day of week (0-6)', defaultValue: 0 },
  { name: 'date', source: '_computed.date', type: 'string', description: 'Date string', defaultValue: '' },

  // Event
  { name: 'eventType', source: 'type', type: 'string', description: 'Event type', defaultValue: '' },
  { name: 'screenId', source: 'screenId', type: 'string', description: 'Screen ID', defaultValue: '' },

  // Goals (placeholders â€” set by goal system)
  { name: 'goalCurrent', source: '_goals.current', type: 'number', description: 'Goal current value', defaultValue: 0 },
  { name: 'goalTarget', source: '_goals.target', type: 'number', description: 'Goal target value', defaultValue: 0 },
  { name: 'goalProgress', source: '_goals.progress', type: 'number', description: 'Goal progress %', defaultValue: 0 },
  { name: 'goalName', source: '_goals.name', type: 'string', description: 'Goal name', defaultValue: '' },
];

// â”€â”€ Extract Variables from Event â”€â”€
export function extractVariables(event: TikTokEvent): Record<string, unknown> {
  const vars: Record<string, unknown> = {};

  for (const binding of BUILTIN_BINDINGS) {
    if (binding.source.startsWith('_computed.')) {
      // Computed variables
      const now = new Date();
      switch (binding.source) {
        case '_computed.hour': vars[binding.name] = now.getHours(); break;
        case '_computed.minute': vars[binding.name] = now.getMinutes(); break;
        case '_computed.dayOfWeek': vars[binding.name] = now.getDay(); break;
        case '_computed.date': vars[binding.name] = now.toISOString().split('T')[0]; break;
      }
    } else if (binding.source.startsWith('_goals.')) {
      // Goal variables â€” set externally
      vars[binding.name] = binding.defaultValue;
    } else {
      // Event data
      const value = resolvePath(event, binding.source);
      vars[binding.name] = value !== undefined ? value : binding.defaultValue;
    }
  }

  return vars;
}

// â”€â”€ Extract Variables from Gift Combo â”€â”€
export function extractComboVariables(combo: GiftCombo): Record<string, unknown> {
  return {
    username: combo.username,
    nickname: combo.nickname,
    giftName: combo.giftName,
    giftId: combo.giftId,
    giftCount: combo.giftCount,
    coinValue: combo.totalCoins,
    comboCount: combo.comboCount,
  };
}

// â”€â”€ Resolve dot path â”€â”€
function resolvePath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: any = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

// â”€â”€ Get binding by name â”€â”€
export function getBinding(name: string): VariableBinding | undefined {
  return BUILTIN_BINDINGS.find(b => b.name === name);
}

// â”€â”€ Get all binding names â”€â”€
export function getAllBindingNames(): string[] {
  return BUILTIN_BINDINGS.map(b => b.name);
}
