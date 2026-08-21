// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RosaeFinity Theme Engine â€” CSS Variable Generator
// v3.1 Architecture Spec (Frozen)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import type { RosaeTheme, ThemeTokens } from './ThemeTokens';

/**
 * Generate CSS custom properties from a RosaeTheme.
 * Returns a flat Record<string, string> ready for style injection.
 */
export function generateCSSVariables(theme: RosaeTheme): Record<string, string> {
  const t = theme.tokens;
  const vars: Record<string, string> = {};

  // â”€â”€ Colors â”€â”€
  vars['--rf-bg'] = t.colors.background;
  vars['--rf-surface'] = t.colors.surface;
  vars['--rf-surface-secondary'] = t.colors.surfaceSecondary;
  vars['--rf-primary'] = t.colors.primary;
  vars['--rf-secondary'] = t.colors.secondary;
  vars['--rf-accent'] = t.colors.accent;
  vars['--rf-success'] = t.colors.success;
  vars['--rf-warning'] = t.colors.warning;
  vars['--rf-danger'] = t.colors.danger;
  vars['--rf-info'] = t.colors.info;
  vars['--rf-text'] = t.colors.textPrimary;
  vars['--rf-text-secondary'] = t.colors.textSecondary;
  vars['--rf-border'] = t.colors.border;
  vars['--rf-overlay'] = t.colors.overlay;
  vars['--rf-shadow'] = t.colors.shadow;

  // â”€â”€ Typography â”€â”€
  vars['--rf-font'] = t.typography.fontFamily;
  vars['--rf-text-xs'] = `${t.typography.xs}px`;
  vars['--rf-text-sm'] = `${t.typography.sm}px`;
  vars['--rf-text-md'] = `${t.typography.md}px`;
  vars['--rf-text-lg'] = `${t.typography.lg}px`;
  vars['--rf-text-xl'] = `${t.typography.xl}px`;
  vars['--rf-text-xxl'] = `${t.typography.xxl}px`;
  vars['--rf-weight-normal'] = String(t.typography.weight.normal);
  vars['--rf-weight-medium'] = String(t.typography.weight.medium);
  vars['--rf-weight-semibold'] = String(t.typography.weight.semibold);
  vars['--rf-weight-bold'] = String(t.typography.weight.bold);
  vars['--rf-tracking-tight'] = t.typography.letterSpacing.tight;
  vars['--rf-tracking-normal'] = t.typography.letterSpacing.normal;
  vars['--rf-tracking-wide'] = t.typography.letterSpacing.wide;
  vars['--rf-leading-tight'] = String(t.typography.lineHeight.tight);
  vars['--rf-leading-normal'] = String(t.typography.lineHeight.normal);
  vars['--rf-leading-relaxed'] = String(t.typography.lineHeight.relaxed);

  // â”€â”€ Spacing â”€â”€
  for (const [key, value] of Object.entries(t.spacing)) {
    vars[`--rf-space-${key}`] = value;
  }

  // â”€â”€ Radius â”€â”€
  vars['--rf-radius-none'] = t.radius.none;
  vars['--rf-radius-sm'] = t.radius.sm;
  vars['--rf-radius-md'] = t.radius.md;
  vars['--rf-radius-lg'] = t.radius.lg;
  vars['--rf-radius-xl'] = t.radius.xl;
  vars['--rf-radius-full'] = t.radius.full;

  // â”€â”€ Shadow â”€â”€
  vars['--rf-shadow-sm'] = t.shadow.sm;
  vars['--rf-shadow-md'] = t.shadow.md;
  vars['--rf-shadow-lg'] = t.shadow.lg;
  vars['--rf-shadow-glow'] = t.shadow.glow;
  vars['--rf-shadow-inner'] = t.shadow.inner;

  // â”€â”€ Animation â”€â”€
  vars['--rf-anim-fast'] = t.animation.fast;
  vars['--rf-anim-normal'] = t.animation.normal;
  vars['--rf-anim-slow'] = t.animation.slow;
  vars['--rf-anim-spring'] = t.animation.spring;
  vars['--rf-anim-bounce'] = t.animation.bounce;
  vars['--rf-anim-elastic'] = t.animation.elastic;

  return vars;
}

/**
 * Inject CSS variables into the document root.
 */
export function injectCSSVariables(vars: Record<string, string>): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

/**
 * Remove all rf- CSS variables from the document root.
 */
export function removeCSSVariables(): void {
  const root = document.documentElement;
  const style = root.style;
  const toRemove: string[] = [];
  for (let i = 0; i < style.length; i++) {
    const prop = style[i];
    if (prop.startsWith('--rf-')) {
      toRemove.push(prop);
    }
  }
  for (const prop of toRemove) {
    root.style.removeProperty(prop);
  }
}

/**
 * Count active CSS variables on the root.
 */
export function countCSSVariables(): number {
  let count = 0;
  const style = document.documentElement.style;
  for (let i = 0; i < style.length; i++) {
    if (style[i].startsWith('--rf-')) count++;
  }
  return count;
}
