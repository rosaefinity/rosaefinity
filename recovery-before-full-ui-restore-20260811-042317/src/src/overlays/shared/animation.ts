export interface AnimationConfig {
  entrance: 'fade' | 'slide-up' | 'slide-left' | 'scale' | 'none';
  exit: 'fade' | 'slide-up' | 'slide-left' | 'scale' | 'none';
  duration: number;
  easing: string;
}

export const defaultAnimation: AnimationConfig = {
  entrance: 'slide-up',
  exit: 'fade',
  duration: 500,
  easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};

export const animationSchemaFields = [
  {
    key: 'entrance', label: 'Entrance', type: 'select' as const,
    options: [
      { value: 'fade', label: 'Fade' },
      { value: 'slide-up', label: 'Slide Up' },
      { value: 'slide-left', label: 'Slide Left' },
      { value: 'scale', label: 'Scale' },
      { value: 'none', label: 'None' },
    ],
  },
  {
    key: 'exit', label: 'Exit', type: 'select' as const,
    options: [
      { value: 'fade', label: 'Fade' },
      { value: 'slide-up', label: 'Slide Up' },
      { value: 'slide-left', label: 'Slide Left' },
      { value: 'scale', label: 'Scale' },
      { value: 'none', label: 'None' },
    ],
  },
  { key: 'duration', label: 'Duration (ms)', type: 'range' as const, min: 100, max: 2000, step: 50 },
  { key: 'easing', label: 'Easing', type: 'text' as const },
];
