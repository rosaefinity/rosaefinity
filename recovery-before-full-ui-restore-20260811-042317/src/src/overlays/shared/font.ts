export interface FontConfig {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
}

export const defaultFont: FontConfig = {
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 1.4,
};

export const fontSchemaFields = [
  { key: 'fontFamily', label: 'Font Family', type: 'text' as const },
  { key: 'fontSize', label: 'Font Size', type: 'range' as const, min: 8, max: 72, step: 1 },
  { key: 'fontWeight', label: 'Font Weight', type: 'range' as const, min: 100, max: 900, step: 100 },
  { key: 'lineHeight', label: 'Line Height', type: 'range' as const, min: 0.8, max: 2.5, step: 0.1 },
];
