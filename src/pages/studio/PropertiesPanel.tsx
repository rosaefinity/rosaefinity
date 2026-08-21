import React, { useState, useCallback, useMemo, memo } from 'react';
import { cn } from '../../lib/utils';
import { SectionCard, SliderControl, ColorControl, ToggleControl, FontSelector, DropdownControl } from '../../components/controls';
import {
  DEFAULT_POSITION, DEFAULT_SIZE, DEFAULT_SCALE, DEFAULT_ROTATION,
  DEFAULT_COLORS, DEFAULT_BORDER, DEFAULT_SHADOW, DEFAULT_SPACING,
  DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE, DEFAULT_FONT_WEIGHT,
  DEFAULT_LETTER_SPACING, DEFAULT_LINE_HEIGHT,
  DEFAULT_TEXT_ALIGN, DEFAULT_TEXT_TRANSFORM, DEFAULT_TEXT_SHADOW,
  DEFAULT_ANIMATION_PRESET, DEFAULT_ANIMATION_DURATION,
  DEFAULT_ANIMATION_DELAY, DEFAULT_ANIMATION_EASING, DEFAULT_ANIMATION_LOOP,
  DEFAULT_COOLDOWN, DEFAULT_HIDDEN_WHEN_INACTIVE, DEFAULT_AUTO_HIDE,
  DEFAULT_AUTO_HIDE_DELAY, DEFAULT_AUTO_PLAY, DEFAULT_MAX_ITEMS,
  DEFAULT_CLICK_THROUGH, DEFAULT_LOCK_POSITION,
} from '../../overlays/base/constants';
import type { OverlayInstance, AnyOverlayModule, BaseOverlayConfig } from '../../overlays/types';
import {
  Move, Palette, Type, Play, Settings2,
  Link, Sliders,
} from 'lucide-react';

interface PropertiesPanelProps {
  instance: OverlayInstance | undefined;
  module: AnyOverlayModule | undefined;
  onConfigChange: (patch: Record<string, unknown>) => void;
  className?: string;
}

type TabId = 'customize' | 'browser-source' | 'advanced';

const TABS: { id: TabId; label: string }[] = [
  { id: 'customize', label: 'Customize' },
  { id: 'browser-source', label: 'Browser Source' },
  { id: 'advanced', label: 'Advanced' },
];

// ─── Layout Defaults for Reset ───
const LAYOUT_DEFAULTS = {
  position: { ...DEFAULT_POSITION },
  size: { ...DEFAULT_SIZE },
  scale: DEFAULT_SCALE,
  rotation: DEFAULT_ROTATION,
};

// ─── Layout Section ───

interface LayoutSectionProps {
  config: BaseOverlayConfig;
  onChange: (patch: Record<string, unknown>) => void;
}

function LayoutSection({ config, onChange }: LayoutSectionProps): React.ReactElement {
  const handlePositionX = useCallback((v: number) => {
    onChange({ position: { ...config.position, x: v } });
  }, [config.position, onChange]);

  const handlePositionY = useCallback((v: number) => {
    onChange({ position: { ...config.position, y: v } });
  }, [config.position, onChange]);

  const handleWidth = useCallback((v: number) => {
    onChange({ size: { ...config.size, width: v } });
  }, [config.size, onChange]);

  const handleHeight = useCallback((v: number) => {
    onChange({ size: { ...config.size, height: v } });
  }, [config.size, onChange]);

  const handleScale = useCallback((v: number) => {
    onChange({ scale: v });
  }, [onChange]);

  const handleRotation = useCallback((v: number) => {
    onChange({ rotation: v });
  }, [onChange]);

  const handleReset = useCallback(() => {
    onChange(LAYOUT_DEFAULTS);
  }, [onChange]);

  const isDirty = useMemo(() => {
    return (
      config.position.x !== LAYOUT_DEFAULTS.position.x ||
      config.position.y !== LAYOUT_DEFAULTS.position.y ||
      config.size.width !== LAYOUT_DEFAULTS.size.width ||
      config.size.height !== LAYOUT_DEFAULTS.size.height ||
      config.scale !== LAYOUT_DEFAULTS.scale ||
      config.rotation !== LAYOUT_DEFAULTS.rotation
    );
  }, [config]);

  return (
    <SectionCard
      title="Layout"
      icon={<Move className="w-3.5 h-3.5" />}
      onReset={handleReset}
      isDirty={isDirty}
      defaultOpen
    >
      <SliderControl
        label="X Position"
        value={config.position.x}
        onChange={handlePositionX}
        onCommit={handlePositionX}
        min={0}
        max={1920}
        step={1}
        defaultValue={LAYOUT_DEFAULTS.position.x}
      />
      <SliderControl
        label="Y Position"
        value={config.position.y}
        onChange={handlePositionY}
        onCommit={handlePositionY}
        min={0}
        max={1080}
        step={1}
        defaultValue={LAYOUT_DEFAULTS.position.y}
      />
      <SliderControl
        label="Width"
        value={config.size.width}
        onChange={handleWidth}
        onCommit={handleWidth}
        min={50}
        max={1920}
        step={1}
        defaultValue={LAYOUT_DEFAULTS.size.width}
      />
      <SliderControl
        label="Height"
        value={config.size.height}
        onChange={handleHeight}
        onCommit={handleHeight}
        min={50}
        max={1080}
        step={1}
        defaultValue={LAYOUT_DEFAULTS.size.height}
      />
      <SliderControl
        label="Scale"
        value={config.scale}
        onChange={handleScale}
        onCommit={handleScale}
        min={0.1}
        max={5}
        step={0.1}
        formatValue={(v) => v.toFixed(1)}
        defaultValue={LAYOUT_DEFAULTS.scale}
      />
      <SliderControl
        label="Rotation"
        value={config.rotation}
        onChange={handleRotation}
        onCommit={handleRotation}
        min={-360}
        max={360}
        step={1}
        formatValue={(v) => `${v}°`}
        defaultValue={LAYOUT_DEFAULTS.rotation}
      />
    </SectionCard>
  );
}

// ─── Appearance Defaults for Reset ───
const APPEARANCE_DEFAULTS = {
  colors: { ...DEFAULT_COLORS },
  border: { ...DEFAULT_BORDER },
  shadow: { ...DEFAULT_SHADOW },
  padding: { ...DEFAULT_SPACING },
  margin: { ...DEFAULT_SPACING },
};

// ─── Appearance Section ───

interface AppearanceSectionProps {
  config: BaseOverlayConfig;
  onChange: (patch: Record<string, unknown>) => void;
}

function AppearanceSection({ config, onChange }: AppearanceSectionProps): React.ReactElement {
  // Background
  const handleBgColor = useCallback((v: string) => {
    onChange({ colors: { ...config.colors, background: v } });
  }, [config.colors, onChange]);

  const handleOpacity = useCallback((v: number) => {
    onChange({ opacity: v / 100 });
  }, [onChange]);

  // Border
  const handleBorderRadius = useCallback((v: number) => {
    onChange({ border: { ...config.border, radius: v } });
  }, [config.border, onChange]);

  const handleBorderWidth = useCallback((v: number) => {
    onChange({ border: { ...config.border, width: v } });
  }, [config.border, onChange]);

  const handleBorderColor = useCallback((v: string) => {
    onChange({ border: { ...config.border, color: v } });
  }, [config.border, onChange]);

  // Shadow
  const handleShadowEnabled = useCallback((v: boolean) => {
    onChange({ shadow: { ...config.shadow, enabled: v } });
  }, [config.shadow, onChange]);

  const handleShadowBlur = useCallback((v: number) => {
    onChange({ shadow: { ...config.shadow, blur: v } });
  }, [config.shadow, onChange]);

  const handleShadowOffsetX = useCallback((v: number) => {
    onChange({ shadow: { ...config.shadow, offsetX: v } });
  }, [config.shadow, onChange]);

  const handleShadowOffsetY = useCallback((v: number) => {
    onChange({ shadow: { ...config.shadow, offsetY: v } });
  }, [config.shadow, onChange]);

  const handleShadowColor = useCallback((v: string) => {
    onChange({ shadow: { ...config.shadow, color: v } });
  }, [config.shadow, onChange]);

  // Padding
  const handlePaddingTop = useCallback((v: number) => {
    onChange({ padding: { ...config.padding, top: v } });
  }, [config.padding, onChange]);

  const handlePaddingRight = useCallback((v: number) => {
    onChange({ padding: { ...config.padding, right: v } });
  }, [config.padding, onChange]);

  const handlePaddingBottom = useCallback((v: number) => {
    onChange({ padding: { ...config.padding, bottom: v } });
  }, [config.padding, onChange]);

  const handlePaddingLeft = useCallback((v: number) => {
    onChange({ padding: { ...config.padding, left: v } });
  }, [config.padding, onChange]);

  // Margin
  const handleMarginTop = useCallback((v: number) => {
    onChange({ margin: { ...config.margin, top: v } });
  }, [config.margin, onChange]);

  const handleMarginRight = useCallback((v: number) => {
    onChange({ margin: { ...config.margin, right: v } });
  }, [config.margin, onChange]);

  const handleMarginBottom = useCallback((v: number) => {
    onChange({ margin: { ...config.margin, bottom: v } });
  }, [config.margin, onChange]);

  const handleMarginLeft = useCallback((v: number) => {
    onChange({ margin: { ...config.margin, left: v } });
  }, [config.margin, onChange]);

  const handleReset = useCallback(() => {
    onChange(APPEARANCE_DEFAULTS);
  }, [onChange]);

  const isDirty = useMemo(() => {
    return (
      config.colors.background !== APPEARANCE_DEFAULTS.colors.background ||
      config.opacity !== 1 ||
      config.border.radius !== APPEARANCE_DEFAULTS.border.radius ||
      config.border.width !== APPEARANCE_DEFAULTS.border.width ||
      config.border.color !== APPEARANCE_DEFAULTS.border.color ||
      config.shadow.enabled !== APPEARANCE_DEFAULTS.shadow.enabled ||
      config.shadow.blur !== APPEARANCE_DEFAULTS.shadow.blur ||
      config.shadow.offsetX !== APPEARANCE_DEFAULTS.shadow.offsetX ||
      config.shadow.offsetY !== APPEARANCE_DEFAULTS.shadow.offsetY ||
      config.shadow.color !== APPEARANCE_DEFAULTS.shadow.color ||
      config.padding.top !== 0 || config.padding.right !== 0 ||
      config.padding.bottom !== 0 || config.padding.left !== 0 ||
      config.margin.top !== 0 || config.margin.right !== 0 ||
      config.margin.bottom !== 0 || config.margin.left !== 0
    );
  }, [config]);

  return (
    <SectionCard
      title="Appearance"
      icon={<Palette className="w-3.5 h-3.5" />}
      onReset={handleReset}
      isDirty={isDirty}
      defaultOpen={false}
    >
      {/* Background */}
      <ColorControl
        label="Background Color"
        value={config.colors.background}
        onChange={handleBgColor}
        onCommit={handleBgColor}
        defaultValue={APPEARANCE_DEFAULTS.colors.background}
      />
      <SliderControl
        label="Opacity"
        value={Math.round(config.opacity * 100)}
        onChange={handleOpacity}
        onCommit={handleOpacity}
        min={0}
        max={100}
        step={1}
        formatValue={(v) => `${v}%`}
        defaultValue={100}
      />

      {/* Border */}
      <SliderControl
        label="Border Radius"
        value={config.border.radius}
        onChange={handleBorderRadius}
        onCommit={handleBorderRadius}
        min={0}
        max={100}
        step={1}
        defaultValue={APPEARANCE_DEFAULTS.border.radius}
      />
      <SliderControl
        label="Border Width"
        value={config.border.width}
        onChange={handleBorderWidth}
        onCommit={handleBorderWidth}
        min={0}
        max={20}
        step={1}
        defaultValue={APPEARANCE_DEFAULTS.border.width}
      />
      <ColorControl
        label="Border Color"
        value={config.border.color}
        onChange={handleBorderColor}
        onCommit={handleBorderColor}
        defaultValue={APPEARANCE_DEFAULTS.border.color}
      />

      {/* Shadow */}
      <ToggleControl
        label="Enable Shadow"
        value={config.shadow.enabled}
        onChange={handleShadowEnabled}
        defaultValue={APPEARANCE_DEFAULTS.shadow.enabled}
      />
      {config.shadow.enabled && (
        <>
          <SliderControl
            label="Shadow Blur"
            value={config.shadow.blur}
            onChange={handleShadowBlur}
            onCommit={handleShadowBlur}
            min={0}
            max={100}
            step={1}
            defaultValue={APPEARANCE_DEFAULTS.shadow.blur}
          />
          <SliderControl
            label="Shadow Offset X"
            value={config.shadow.offsetX}
            onChange={handleShadowOffsetX}
            onCommit={handleShadowOffsetX}
            min={-50}
            max={50}
            step={1}
            defaultValue={APPEARANCE_DEFAULTS.shadow.offsetX}
          />
          <SliderControl
            label="Shadow Offset Y"
            value={config.shadow.offsetY}
            onChange={handleShadowOffsetY}
            onCommit={handleShadowOffsetY}
            min={-50}
            max={50}
            step={1}
            defaultValue={APPEARANCE_DEFAULTS.shadow.offsetY}
          />
          <ColorControl
            label="Shadow Color"
            value={config.shadow.color}
            onChange={handleShadowColor}
            onCommit={handleShadowColor}
            defaultValue={APPEARANCE_DEFAULTS.shadow.color}
          />
        </>
      )}

      {/* Padding */}
      <SliderControl label="Padding Top" value={config.padding.top} onChange={handlePaddingTop} onCommit={handlePaddingTop} min={0} max={100} step={1} defaultValue={0} />
      <SliderControl label="Padding Right" value={config.padding.right} onChange={handlePaddingRight} onCommit={handlePaddingRight} min={0} max={100} step={1} defaultValue={0} />
      <SliderControl label="Padding Bottom" value={config.padding.bottom} onChange={handlePaddingBottom} onCommit={handlePaddingBottom} min={0} max={100} step={1} defaultValue={0} />
      <SliderControl label="Padding Left" value={config.padding.left} onChange={handlePaddingLeft} onCommit={handlePaddingLeft} min={0} max={100} step={1} defaultValue={0} />

      {/* Margin */}
      <SliderControl label="Margin Top" value={config.margin.top} onChange={handleMarginTop} onCommit={handleMarginTop} min={0} max={100} step={1} defaultValue={0} />
      <SliderControl label="Margin Right" value={config.margin.right} onChange={handleMarginRight} onCommit={handleMarginRight} min={0} max={100} step={1} defaultValue={0} />
      <SliderControl label="Margin Bottom" value={config.margin.bottom} onChange={handleMarginBottom} onCommit={handleMarginBottom} min={0} max={100} step={1} defaultValue={0} />
      <SliderControl label="Margin Left" value={config.margin.left} onChange={handleMarginLeft} onCommit={handleMarginLeft} min={0} max={100} step={1} defaultValue={0} />
    </SectionCard>
  );
}

// ─── Typography Defaults for Reset ───
const TYPOGRAPHY_DEFAULTS = {
  fontFamily: DEFAULT_FONT_FAMILY,
  fontSize: DEFAULT_FONT_SIZE,
  fontWeight: DEFAULT_FONT_WEIGHT,
  letterSpacing: DEFAULT_LETTER_SPACING,
  lineHeight: DEFAULT_LINE_HEIGHT,
  textAlign: DEFAULT_TEXT_ALIGN,
  textTransform: DEFAULT_TEXT_TRANSFORM,
  textShadow: { ...DEFAULT_TEXT_SHADOW },
};

const TEXT_ALIGN_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

const TEXT_TRANSFORM_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'uppercase', label: 'Uppercase' },
  { value: 'lowercase', label: 'Lowercase' },
  { value: 'capitalize', label: 'Capitalize' },
];

// ─── Typography Section ───

interface TypographySectionProps {
  config: BaseOverlayConfig;
  onChange: (patch: Record<string, unknown>) => void;
}

function TypographySection({ config, onChange }: TypographySectionProps): React.ReactElement {
  const handleFontFamily = useCallback((v: string) => {
    onChange({ fontFamily: v });
  }, [onChange]);

  const handleFontSize = useCallback((v: number) => {
    onChange({ fontSize: v });
  }, [onChange]);

  const handleFontWeight = useCallback((v: number) => {
    onChange({ fontWeight: v });
  }, [onChange]);

  const handleLetterSpacing = useCallback((v: number) => {
    onChange({ letterSpacing: v });
  }, [onChange]);

  const handleLineHeight = useCallback((v: number) => {
    onChange({ lineHeight: v });
  }, [onChange]);

  const handleTextAlign = useCallback((v: string) => {
    onChange({ textAlign: v });
  }, [onChange]);

  const handleTextTransform = useCallback((v: string) => {
    onChange({ textTransform: v });
  }, [onChange]);

  const handleTextShadowEnabled = useCallback((v: boolean) => {
    onChange({ textShadow: { ...config.textShadow, enabled: v } });
  }, [config.textShadow, onChange]);

  const handleTextShadowBlur = useCallback((v: number) => {
    onChange({ textShadow: { ...config.textShadow, blur: v } });
  }, [config.textShadow, onChange]);

  const handleTextShadowOffsetX = useCallback((v: number) => {
    onChange({ textShadow: { ...config.textShadow, offsetX: v } });
  }, [config.textShadow, onChange]);

  const handleTextShadowOffsetY = useCallback((v: number) => {
    onChange({ textShadow: { ...config.textShadow, offsetY: v } });
  }, [config.textShadow, onChange]);

  const handleTextShadowColor = useCallback((v: string) => {
    onChange({ textShadow: { ...config.textShadow, color: v } });
  }, [config.textShadow, onChange]);

  const handleReset = useCallback(() => {
    onChange(TYPOGRAPHY_DEFAULTS);
  }, [onChange]);

  const isDirty = useMemo(() => {
    return (
      config.fontFamily !== TYPOGRAPHY_DEFAULTS.fontFamily ||
      config.fontSize !== TYPOGRAPHY_DEFAULTS.fontSize ||
      config.fontWeight !== TYPOGRAPHY_DEFAULTS.fontWeight ||
      config.letterSpacing !== TYPOGRAPHY_DEFAULTS.letterSpacing ||
      config.lineHeight !== TYPOGRAPHY_DEFAULTS.lineHeight ||
      config.textAlign !== TYPOGRAPHY_DEFAULTS.textAlign ||
      config.textTransform !== TYPOGRAPHY_DEFAULTS.textTransform ||
      config.textShadow.enabled !== TYPOGRAPHY_DEFAULTS.textShadow.enabled ||
      config.textShadow.blur !== TYPOGRAPHY_DEFAULTS.textShadow.blur ||
      config.textShadow.offsetX !== TYPOGRAPHY_DEFAULTS.textShadow.offsetX ||
      config.textShadow.offsetY !== TYPOGRAPHY_DEFAULTS.textShadow.offsetY ||
      config.textShadow.color !== TYPOGRAPHY_DEFAULTS.textShadow.color
    );
  }, [config]);

  return (
    <SectionCard
      title="Typography"
      icon={<Type className="w-3.5 h-3.5" />}
      onReset={handleReset}
      isDirty={isDirty}
      defaultOpen={false}
    >
      <FontSelector
        label="Font Family"
        value={config.fontFamily}
        onChange={handleFontFamily}
        defaultValue={TYPOGRAPHY_DEFAULTS.fontFamily}
      />
      <SliderControl
        label="Font Size"
        value={config.fontSize}
        onChange={handleFontSize}
        onCommit={handleFontSize}
        min={8}
        max={120}
        step={1}
        formatValue={(v) => `${v}px`}
        defaultValue={TYPOGRAPHY_DEFAULTS.fontSize}
      />
      <SliderControl
        label="Font Weight"
        value={config.fontWeight}
        onChange={handleFontWeight}
        onCommit={handleFontWeight}
        min={100}
        max={900}
        step={100}
        defaultValue={TYPOGRAPHY_DEFAULTS.fontWeight}
      />
      <ColorControl
        label="Text Color"
        value={config.colors.text}
        onChange={(v) => onChange({ colors: { ...config.colors, text: v } })}
        onCommit={(v) => onChange({ colors: { ...config.colors, text: v } })}
        defaultValue={TYPOGRAPHY_DEFAULTS.fontFamily}
      />
      <SliderControl
        label="Letter Spacing"
        value={config.letterSpacing}
        onChange={handleLetterSpacing}
        onCommit={handleLetterSpacing}
        min={-10}
        max={20}
        step={0.1}
        formatValue={(v) => `${v.toFixed(1)}px`}
        defaultValue={TYPOGRAPHY_DEFAULTS.letterSpacing}
      />
      <SliderControl
        label="Line Height"
        value={config.lineHeight}
        onChange={handleLineHeight}
        onCommit={handleLineHeight}
        min={0.8}
        max={3}
        step={0.1}
        formatValue={(v) => v.toFixed(1)}
        defaultValue={TYPOGRAPHY_DEFAULTS.lineHeight}
      />
      <DropdownControl
        label="Text Align"
        value={config.textAlign}
        options={TEXT_ALIGN_OPTIONS}
        onChange={handleTextAlign}
        defaultValue={TYPOGRAPHY_DEFAULTS.textAlign}
      />
      <DropdownControl
        label="Text Transform"
        value={config.textTransform}
        options={TEXT_TRANSFORM_OPTIONS}
        onChange={handleTextTransform}
        defaultValue={TYPOGRAPHY_DEFAULTS.textTransform}
      />

      {/* Text Shadow */}
      <ToggleControl
        label="Enable Text Shadow"
        value={config.textShadow.enabled}
        onChange={handleTextShadowEnabled}
        defaultValue={TYPOGRAPHY_DEFAULTS.textShadow.enabled}
      />
      {config.textShadow.enabled && (
        <>
          <SliderControl
            label="Shadow Blur"
            value={config.textShadow.blur}
            onChange={handleTextShadowBlur}
            onCommit={handleTextShadowBlur}
            min={0}
            max={50}
            step={1}
            defaultValue={TYPOGRAPHY_DEFAULTS.textShadow.blur}
          />
          <SliderControl
            label="Shadow Offset X"
            value={config.textShadow.offsetX}
            onChange={handleTextShadowOffsetX}
            onCommit={handleTextShadowOffsetX}
            min={-20}
            max={20}
            step={1}
            defaultValue={TYPOGRAPHY_DEFAULTS.textShadow.offsetX}
          />
          <SliderControl
            label="Shadow Offset Y"
            value={config.textShadow.offsetY}
            onChange={handleTextShadowOffsetY}
            onCommit={handleTextShadowOffsetY}
            min={-20}
            max={20}
            step={1}
            defaultValue={TYPOGRAPHY_DEFAULTS.textShadow.offsetY}
          />
          <ColorControl
            label="Shadow Color"
            value={config.textShadow.color}
            onChange={handleTextShadowColor}
            onCommit={handleTextShadowColor}
            defaultValue={TYPOGRAPHY_DEFAULTS.textShadow.color}
          />
        </>
      )}
    </SectionCard>
  );
}

// ─── Animation Defaults for Reset ───
const ANIMATION_DEFAULTS = {
  transition: DEFAULT_ANIMATION_PRESET,
  animationDuration: DEFAULT_ANIMATION_DURATION,
  animationDelay: DEFAULT_ANIMATION_DELAY,
  animationEasing: DEFAULT_ANIMATION_EASING,
  animationLoop: DEFAULT_ANIMATION_LOOP,
};

const ANIMATION_PRESET_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'pop', label: 'Pop' },
  { value: 'slide-up', label: 'Slide Up' },
  { value: 'slide-down', label: 'Slide Down' },
  { value: 'slide-left', label: 'Slide Left' },
  { value: 'slide-right', label: 'Slide Right' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'pulse', label: 'Pulse' },
];

const ANIMATION_EASING_OPTIONS = [
  { value: 'ease', label: 'Ease' },
  { value: 'ease-in', label: 'Ease In' },
  { value: 'ease-out', label: 'Ease Out' },
  { value: 'ease-in-out', label: 'Ease In Out' },
  { value: 'linear', label: 'Linear' },
];

// ─── Animation Section ───

interface AnimationSectionProps {
  config: BaseOverlayConfig;
  onChange: (patch: Record<string, unknown>) => void;
}

function AnimationSection({ config, onChange }: AnimationSectionProps): React.ReactElement {
  const handlePreset = useCallback((v: string) => {
    onChange({ transition: v });
  }, [onChange]);

  const handleDuration = useCallback((v: number) => {
    onChange({ animationDuration: v });
  }, [onChange]);

  const handleDelay = useCallback((v: number) => {
    onChange({ animationDelay: v });
  }, [onChange]);

  const handleEasing = useCallback((v: string) => {
    onChange({ animationEasing: v });
  }, [onChange]);

  const handleLoop = useCallback((v: boolean) => {
    onChange({ animationLoop: v });
  }, [onChange]);

  const handleReset = useCallback(() => {
    onChange(ANIMATION_DEFAULTS);
  }, [onChange]);

  const isDirty = useMemo(() => {
    return (
      config.transition !== ANIMATION_DEFAULTS.transition ||
      (config.animationDuration ?? 0) !== ANIMATION_DEFAULTS.animationDuration ||
      config.animationDelay !== ANIMATION_DEFAULTS.animationDelay ||
      config.animationEasing !== ANIMATION_DEFAULTS.animationEasing ||
      config.animationLoop !== ANIMATION_DEFAULTS.animationLoop
    );
  }, [config]);

  return (
    <SectionCard
      title="Animation"
      icon={<Play className="w-3.5 h-3.5" />}
      onReset={handleReset}
      isDirty={isDirty}
      defaultOpen={false}
    >
      <DropdownControl
        label="Animation Preset"
        value={config.transition}
        options={ANIMATION_PRESET_OPTIONS}
        onChange={handlePreset}
        defaultValue={ANIMATION_DEFAULTS.transition}
      />
      <SliderControl
        label="Duration"
        value={config.animationDuration ?? 0}
        onChange={handleDuration}
        onCommit={handleDuration}
        min={0}
        max={10}
        step={0.1}
        formatValue={(v) => `${v.toFixed(1)}s`}
        defaultValue={ANIMATION_DEFAULTS.animationDuration}
      />
      <SliderControl
        label="Delay"
        value={config.animationDelay}
        onChange={handleDelay}
        onCommit={handleDelay}
        min={0}
        max={10}
        step={0.1}
        formatValue={(v) => `${v.toFixed(1)}s`}
        defaultValue={ANIMATION_DEFAULTS.animationDelay}
      />
      <DropdownControl
        label="Easing"
        value={config.animationEasing}
        options={ANIMATION_EASING_OPTIONS}
        onChange={handleEasing}
        defaultValue={ANIMATION_DEFAULTS.animationEasing}
      />
      <ToggleControl
        label="Loop"
        value={config.animationLoop}
        onChange={handleLoop}
        defaultValue={ANIMATION_DEFAULTS.animationLoop}
      />
    </SectionCard>
  );
}

// ─── Behavior Defaults for Reset ───
const BEHAVIOR_DEFAULTS = {
  enabled: true,
  hiddenWhenInactive: DEFAULT_HIDDEN_WHEN_INACTIVE,
  cooldown: DEFAULT_COOLDOWN,
  autoHide: DEFAULT_AUTO_HIDE,
  autoHideDelay: DEFAULT_AUTO_HIDE_DELAY,
  maxItems: DEFAULT_MAX_ITEMS,
  autoPlay: DEFAULT_AUTO_PLAY,
  clickThrough: DEFAULT_CLICK_THROUGH,
  lockPosition: DEFAULT_LOCK_POSITION,
};

// ─── Behavior Section ───

interface BehaviorSectionProps {
  config: BaseOverlayConfig;
  onChange: (patch: Record<string, unknown>) => void;
}

function BehaviorSection({ config, onChange }: BehaviorSectionProps): React.ReactElement {
  const handleEnabled = useCallback((v: boolean) => {
    onChange({ enabled: v });
  }, [onChange]);

  const handleHiddenWhenInactive = useCallback((v: boolean) => {
    onChange({ hiddenWhenInactive: v });
  }, [onChange]);

  const handleCooldown = useCallback((v: number) => {
    onChange({ cooldown: v });
  }, [onChange]);

  const handleAutoHide = useCallback((v: boolean) => {
    onChange({ autoHide: v });
  }, [onChange]);

  const handleAutoHideDelay = useCallback((v: number) => {
    onChange({ autoHideDelay: v });
  }, [onChange]);

  const handleMaxItems = useCallback((v: number) => {
    onChange({ maxItems: v });
  }, [onChange]);

  const handleAutoPlay = useCallback((v: boolean) => {
    onChange({ autoPlay: v });
  }, [onChange]);

  const handleClickThrough = useCallback((v: boolean) => {
    onChange({ clickThrough: v });
  }, [onChange]);

  const handleLockPosition = useCallback((v: boolean) => {
    onChange({ lockPosition: v });
  }, [onChange]);

  const handleReset = useCallback(() => {
    onChange(BEHAVIOR_DEFAULTS);
  }, [onChange]);

  const isDirty = useMemo(() => {
    return (
      config.enabled !== BEHAVIOR_DEFAULTS.enabled ||
      config.hiddenWhenInactive !== BEHAVIOR_DEFAULTS.hiddenWhenInactive ||
      config.cooldown !== BEHAVIOR_DEFAULTS.cooldown ||
      config.autoHide !== BEHAVIOR_DEFAULTS.autoHide ||
      config.autoHideDelay !== BEHAVIOR_DEFAULTS.autoHideDelay ||
      config.maxItems !== BEHAVIOR_DEFAULTS.maxItems ||
      config.autoPlay !== BEHAVIOR_DEFAULTS.autoPlay ||
      config.clickThrough !== BEHAVIOR_DEFAULTS.clickThrough ||
      config.lockPosition !== BEHAVIOR_DEFAULTS.lockPosition
    );
  }, [config]);

  return (
    <SectionCard
      title="Behavior"
      icon={<Settings2 className="w-3.5 h-3.5" />}
      onReset={handleReset}
      isDirty={isDirty}
      defaultOpen={false}
    >
      {/* Visibility */}
      <ToggleControl
        label="Enabled"
        value={config.enabled}
        onChange={handleEnabled}
        defaultValue={BEHAVIOR_DEFAULTS.enabled}
      />
      <ToggleControl
        label="Hidden When Inactive"
        value={config.hiddenWhenInactive}
        onChange={handleHiddenWhenInactive}
        defaultValue={BEHAVIOR_DEFAULTS.hiddenWhenInactive}
      />

      {/* Timing */}
      <SliderControl
        label="Cooldown"
        value={config.cooldown}
        onChange={handleCooldown}
        onCommit={handleCooldown}
        min={0}
        max={60}
        step={1}
        formatValue={(v) => `${v}s`}
        defaultValue={BEHAVIOR_DEFAULTS.cooldown}
      />
      <ToggleControl
        label="Auto Hide"
        value={config.autoHide}
        onChange={handleAutoHide}
        defaultValue={BEHAVIOR_DEFAULTS.autoHide}
      />
      {config.autoHide && (
        <SliderControl
          label="Auto Hide Delay"
          value={config.autoHideDelay}
          onChange={handleAutoHideDelay}
          onCommit={handleAutoHideDelay}
          min={0}
          max={60}
          step={1}
          formatValue={(v) => `${v}s`}
          defaultValue={BEHAVIOR_DEFAULTS.autoHideDelay}
        />
      )}

      {/* Playback */}
      <SliderControl
        label="Max Queue Size"
        value={config.maxItems}
        onChange={handleMaxItems}
        onCommit={handleMaxItems}
        min={1}
        max={100}
        step={1}
        defaultValue={BEHAVIOR_DEFAULTS.maxItems}
      />
      <ToggleControl
        label="Auto Play"
        value={config.autoPlay}
        onChange={handleAutoPlay}
        defaultValue={BEHAVIOR_DEFAULTS.autoPlay}
      />

      {/* Interaction */}
      <ToggleControl
        label="Click Through"
        value={config.clickThrough}
        onChange={handleClickThrough}
        defaultValue={BEHAVIOR_DEFAULTS.clickThrough}
      />
      <ToggleControl
        label="Lock Position"
        value={config.lockPosition}
        onChange={handleLockPosition}
        defaultValue={BEHAVIOR_DEFAULTS.lockPosition}
      />
    </SectionCard>
  );
}

// ─── Placeholder Sections ───

function PlaceholderRow({ label }: { label: string }): React.ReactElement {
  return (
    <div className="flex items-center justify-center py-4">
      <span className="text-[11px] text-white/20 italic">{label}</span>
    </div>
  );
}

// ─── Tab Content ───

function CustomizeTab({
  config,
  onChange,
}: {
  config: BaseOverlayConfig | undefined;
  onChange: (patch: Record<string, unknown>) => void;
}): React.ReactElement {
  return (
    <div className="space-y-3">
      {config ? (
        <LayoutSection config={config} onChange={onChange} />
      ) : (
        <SectionCard title="Layout" icon={<Move className="w-3.5 h-3.5" />} defaultOpen>
          <PlaceholderRow label="Select an overlay to edit" />
        </SectionCard>
      )}

      {config ? (
        <AppearanceSection config={config} onChange={onChange} />
      ) : (
        <SectionCard title="Appearance" icon={<Palette className="w-3.5 h-3.5" />} defaultOpen={false}>
          <PlaceholderRow label="Select an overlay to edit" />
        </SectionCard>
      )}

      {config ? (
        <TypographySection config={config} onChange={onChange} />
      ) : (
        <SectionCard title="Typography" icon={<Type className="w-3.5 h-3.5" />} defaultOpen={false}>
          <PlaceholderRow label="Select an overlay to edit" />
        </SectionCard>
      )}

      {config ? (
        <AnimationSection config={config} onChange={onChange} />
      ) : (
        <SectionCard title="Animation" icon={<Play className="w-3.5 h-3.5" />} defaultOpen={false}>
          <PlaceholderRow label="Select an overlay to edit" />
        </SectionCard>
      )}

      {config ? (
        <BehaviorSection config={config} onChange={onChange} />
      ) : (
        <SectionCard title="Behavior" icon={<Settings2 className="w-3.5 h-3.5" />} defaultOpen={false}>
          <PlaceholderRow label="Select an overlay to edit" />
        </SectionCard>
      )}
    </div>
  );
}

function BrowserSourceTab(): React.ReactElement {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#18181f] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Link className="w-4 h-4 text-white/40" />
        <span className="text-sm font-semibold text-white/80">Browser Source</span>
      </div>
      <div className="space-y-3">
        <div className="h-8 rounded-md bg-white/[0.03] border border-white/[0.06] flex items-center px-3">
          <span className="text-xs text-white/30 font-mono truncate">http://localhost:5173/overlay/...</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 h-8 rounded-lg bg-primary/20 text-primary border border-primary/30 text-xs font-medium hover:bg-primary/30 transition-colors"
          >
            Copy URL
          </button>
          <button
            type="button"
            className="flex-1 h-8 rounded-lg bg-white/[0.03] text-white/50 border border-white/10 text-xs font-medium hover:bg-white/[0.06] transition-colors"
          >
            Open Preview
          </button>
        </div>
      </div>
    </div>
  );
}

function AdvancedTab(): React.ReactElement {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#18181f] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sliders className="w-4 h-4 text-white/40" />
        <span className="text-sm font-semibold text-white/80">Advanced Settings</span>
      </div>
      <PlaceholderRow label="Advanced controls coming later" />
    </div>
  );
}

// ─── Main Panel ───

function PropertiesPanelInner({
  instance,
  module: mod,
  onConfigChange,
  className,
}: PropertiesPanelProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<TabId>('customize');

  const handleTabClick = useCallback((id: TabId) => {
    setActiveTab(id);
  }, []);

  const config = instance?.config;

  return (
    <div className={cn('flex flex-col h-full bg-[#0f0f13] border-l border-white/[0.06]', className)}>
      {/* Tabs */}
      <div className="flex border-b border-white/[0.06]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabClick(tab.id)}
            className={cn(
              'flex-1 px-3 py-2.5 text-xs font-medium transition-colors relative',
              activeTab === tab.id
                ? 'text-white/80'
                : 'text-white/30 hover:text-white/50',
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {activeTab === 'customize' && (
          <CustomizeTab config={config} onChange={onConfigChange} />
        )}
        {activeTab === 'browser-source' && <BrowserSourceTab />}
        {activeTab === 'advanced' && <AdvancedTab />}
      </div>
    </div>
  );
}

export const PropertiesPanel = memo(PropertiesPanelInner);
PropertiesPanel.displayName = 'PropertiesPanel';
