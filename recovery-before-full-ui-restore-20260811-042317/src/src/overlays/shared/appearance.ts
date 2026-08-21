export interface AppearanceConfig {
  opacity: number;
  borderRadius: number;
  border: string;
  boxShadow: string;
  background: string;
}

export const defaultAppearance: AppearanceConfig = {
  opacity: 1,
  borderRadius: 12,
  border: '1px solid rgba(255, 255, 255, 0.1)',
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.35)',
  background: 'rgba(20, 20, 30, 0.88)',
};

export const appearanceSchemaFields = [
  { key: 'opacity', label: 'Opacity', type: 'range' as const, min: 0, max: 1, step: 0.05 },
  { key: 'borderRadius', label: 'Border Radius', type: 'range' as const, min: 0, max: 50, step: 1 },
  { key: 'border', label: 'Border', type: 'text' as const },
  { key: 'boxShadow', label: 'Box Shadow', type: 'text' as const },
  { key: 'background', label: 'Background', type: 'text' as const },
];
