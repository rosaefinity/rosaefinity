import { describe, it, expect } from 'vitest';
import {
  defaultAppearance,
  defaultAnimation,
  defaultSound,
  defaultFont,
  defaultColor,
  defaultLayout,
  appearanceSchemaFields,
  animationSchemaFields,
  soundSchemaFields,
  colorSchemaFields,
  fontSchemaFields,
  layoutSchemaFields,
} from '..';

describe('Shared Config Defaults', () => {
  it('defaultAppearance has all required fields', () => {
    expect(defaultAppearance).toHaveProperty('opacity');
    expect(defaultAppearance).toHaveProperty('borderRadius');
    expect(defaultAppearance).toHaveProperty('border');
    expect(defaultAppearance).toHaveProperty('boxShadow');
    expect(defaultAppearance).toHaveProperty('background');
    expect(defaultAppearance.opacity).toBeGreaterThanOrEqual(0);
    expect(defaultAppearance.opacity).toBeLessThanOrEqual(1);
  });

  it('defaultAnimation has all required fields', () => {
    expect(defaultAnimation).toHaveProperty('entrance');
    expect(defaultAnimation).toHaveProperty('exit');
    expect(defaultAnimation).toHaveProperty('duration');
    expect(defaultAnimation).toHaveProperty('easing');
    expect(defaultAnimation.duration).toBeGreaterThan(0);
  });

  it('defaultSound has all required fields', () => {
    expect(defaultSound).toHaveProperty('enabled');
    expect(defaultSound).toHaveProperty('volume');
    expect(defaultSound.volume).toBeGreaterThanOrEqual(0);
    expect(defaultSound.volume).toBeLessThanOrEqual(1);
  });

  it('defaultFont has all required fields', () => {
    expect(defaultFont).toHaveProperty('fontFamily');
    expect(defaultFont).toHaveProperty('fontSize');
    expect(defaultFont).toHaveProperty('fontWeight');
    expect(defaultFont.fontSize).toBeGreaterThan(0);
  });

  it('defaultColor has all required fields', () => {
    expect(defaultColor).toHaveProperty('primary');
    expect(defaultColor).toHaveProperty('secondary');
    expect(defaultColor).toHaveProperty('background');
    expect(defaultColor).toHaveProperty('text');
    expect(defaultColor).toHaveProperty('accent');
  });

  it('defaultLayout has all required fields', () => {
    expect(defaultLayout).toHaveProperty('position');
    expect(defaultLayout).toHaveProperty('alignment');
    expect(defaultLayout).toHaveProperty('padding');
    expect(defaultLayout).toHaveProperty('maxWidth');
  });
});

describe('Shared Schema Fields', () => {
  it('appearanceSchemaFields returns array of field definitions', () => {
    expect(Array.isArray(appearanceSchemaFields)).toBe(true);
    expect(appearanceSchemaFields.length).toBeGreaterThan(0);
    const opacityField = appearanceSchemaFields.find((f) => f.key === 'opacity');
    expect(opacityField).toBeDefined();
    expect(opacityField?.type).toBe('range');
  });

  it('animationSchemaFields returns array of field definitions', () => {
    expect(Array.isArray(animationSchemaFields)).toBe(true);
    const durationField = animationSchemaFields.find((f) => f.key === 'duration');
    expect(durationField).toBeDefined();
  });

  it('soundSchemaFields returns array of field definitions', () => {
    expect(Array.isArray(soundSchemaFields)).toBe(true);
    const volumeField = soundSchemaFields.find((f) => f.key === 'volume');
    expect(volumeField).toBeDefined();
  });

  it('colorSchemaFields returns array of field definitions', () => {
    expect(Array.isArray(colorSchemaFields)).toBe(true);
    const primaryField = colorSchemaFields.find((f) => f.key === 'primary');
    expect(primaryField).toBeDefined();
    expect(primaryField?.type).toBe('color');
  });

  it('fontSchemaFields returns array of field definitions', () => {
    expect(Array.isArray(fontSchemaFields)).toBe(true);
  });

  it('layoutSchemaFields returns array of field definitions', () => {
    expect(Array.isArray(layoutSchemaFields)).toBe(true);
  });
});
