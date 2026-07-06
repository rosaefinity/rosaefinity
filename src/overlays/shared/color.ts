export interface ColorConfig {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  accent: string;
}

export const defaultColor: ColorConfig = {
  primary: '#7C3AED',
  secondary: '#EC4899',
  background: 'rgba(20, 20, 30, 0.88)',
  text: '#FFFFFF',
  accent: '#A78BFA',
};

export const colorSchemaFields = [
  { key: 'primary', label: 'Primary', type: 'color' as const },
  { key: 'secondary', label: 'Secondary', type: 'color' as const },
  { key: 'background', label: 'Background', type: 'text' as const },
  { key: 'text', label: 'Text', type: 'color' as const },
  { key: 'accent', label: 'Accent', type: 'color' as const },
];
