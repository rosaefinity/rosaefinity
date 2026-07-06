export interface LayoutConfig {
  position: 'top-left' | 'top-center' | 'top-right' | 'center' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  alignment: 'left' | 'center' | 'right';
  padding: number;
  maxWidth: number;
}

export const defaultLayout: LayoutConfig = {
  position: 'bottom-center',
  alignment: 'center',
  padding: 16,
  maxWidth: 420,
};

export const layoutSchemaFields = [
  {
    key: 'position', label: 'Position', type: 'select' as const,
    options: [
      { value: 'top-left', label: 'Top Left' },
      { value: 'top-center', label: 'Top Center' },
      { value: 'top-right', label: 'Top Right' },
      { value: 'center', label: 'Center' },
      { value: 'bottom-left', label: 'Bottom Left' },
      { value: 'bottom-center', label: 'Bottom Center' },
      { value: 'bottom-right', label: 'Bottom Right' },
    ],
  },
  {
    key: 'alignment', label: 'Alignment', type: 'select' as const,
    options: [
      { value: 'left', label: 'Left' },
      { value: 'center', label: 'Center' },
      { value: 'right', label: 'Right' },
    ],
  },
  { key: 'padding', label: 'Padding', type: 'range' as const, min: 0, max: 64, step: 1 },
  { key: 'maxWidth', label: 'Max Width', type: 'range' as const, min: 100, max: 1200, step: 10 },
];
