export interface SoundConfig {
  enabled: boolean;
  soundUrl: string;
  volume: number;
  repeat: number;
}

export const defaultSound: SoundConfig = {
  enabled: true,
  soundUrl: '',
  volume: 0.8,
  repeat: 1,
};

export const soundSchemaFields = [
  { key: 'enabled', label: 'Enable Sound', type: 'boolean' as const },
  { key: 'soundUrl', label: 'Sound URL', type: 'text' as const },
  { key: 'volume', label: 'Volume', type: 'range' as const, min: 0, max: 1, step: 0.05 },
  { key: 'repeat', label: 'Repeat', type: 'number' as const, min: 1, max: 10 },
];
